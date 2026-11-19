/* Session 6C: your pilots and LDF regulars in the 3D world (owner, Nov 18). Each ally is drawn from the kit it fights with on the
   SAME builders as your own tank (M3.chassisKit / M3.weaponKit: the existing Meshy tanks; the plain foundation tank stands in, in the
   shared hull material, while a Meshy file loads), so allies look as good as every other tank. Paint: stock by default; your
   Battalion livery when you wear one ('Battalion colors' puts your own paint and your town banner on every ally; a plain set paints
   every ally one scheme); LDF regulars always wear the LDF livery. Over each tank a HUD insignia: the role badge in its colour, the
   call sign and the hull bar (DOWN when downed). A downed ally sits low and tilted with its gun dropped and smoking. Ally effects are
   halved on LOW graphics (view.js: their impacts, kills and muzzle flashes, and their shots drop the glow halo). No new 3D model;
   presentation only: nothing here changes a rule, a stat or the record. */
(function(root){
'use strict';
const RANGE=260,TAG_FAR=150,NAME_NEAR=75,EASE=16,SNAP=25;
const W=()=>root.ConquestWorld;
const ROLE_L=Object.freeze({'':'W',guardian:'G',breacher:'B',lancer:'L',mender:'M',corroder:'C',frostline:'F'});
const ROLE_C=Object.freeze({'':'#d9c27a',guardian:'#5aa9ff',breacher:'#ff8a3d',lancer:'#e8f4ff',mender:'#7be07b',corroder:'#c28bff',frostline:'#7fe3ff'});
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function shade(hex,k){const n=parseInt(String(hex).slice(1),16)||0,c=v=>Math.max(0,Math.min(255,Math.round(v*k)));return '#'+((1<<24)|(c(n>>16&255)<<16)|(c(n>>8&255)<<8)|c(n&255)).toString(16).slice(1);}
// the paint an ally wears (and whether it carries your banner)
function paintOf(f,s,playerPaint){
 if(f.side==='ldf'){const L=typeof LDF_LIVERY==='object'?LDF_LIVERY:{p:'#5b646b',a:'#d9c27a'};return {key:'ldf',P:{n:'LDF',hull:L.p,tur:shade(L.p,1.18),trim:L.a},banner:false};}
 const id=s?.bat?.lv||'',L=id&&typeof LIVERIES==='object'?LIVERIES[id]:null;
 if(L&&L.own){const k=PAINTS[playerPaint]?playerPaint:'stock';return {key:'own:'+k,P:PAINTS[k],banner:true};}
 if(L)return {key:id,P:{n:L.n,hull:L.p,tur:shade(L.p,1.15),trim:L.a},banner:false};
 return {key:'stock',P:PAINTS.stock,banner:false};}
const loadoutOf=f=>root.ConquestCombat.allyLoadout(f.kit);
function specKey(f,pt,bn){const L=loadoutOf(f),my=typeof Meshy3D!=='undefined'?Meshy3D.stamp(L.c.c,L.c.t,L.w.a,L.w.t)+(Meshy3D.pending(L.c.c,L.c.t,L.w.a,L.w.t)?'w':''):'';
 return [L.c.c,L.c.t,L.w.a,L.w.t,pt.key,my,pt.banner&&bn?JSON.stringify(bn):'',typeof Equipment3D!=='undefined'?Equipment3D.generation:0].join('|');}
function build(v,f,pt,key,bn){const T=v.T,L=loadoutOf(f),team='#88cbdc',g=new T.Group(),body=new T.Group();body.rotation.y=-Math.PI/2;g.add(body);
 if(!v.modelMats)v.syncLoadout();const mats=v.modelMats,P=pt.P;
 const wait=typeof Meshy3D!=='undefined'&&Meshy3D.pending(L.c.c,L.c.t,L.w.a,L.w.t);
 // exactly the player's own path (view.js syncLoadout): the Meshy kit, or the plain foundation tank merged into the hull material
 const add=(raw,parent)=>{const to=wait?new T.Group():parent;to.add(M3.meshOf(M3.bake(raw.k),null,mats));for(const a of raw.anims||[]){const m=M3.meshOf(M3.bake(a.k),null,mats);m.position.set(...a.p);to.add(m);}if(wait){let n=0;to.traverse(o=>{if(o.isMesh)n++;});if(n){parent.add(to);v.mergeArchitecture(to);}}};
 const H=wait?M3.foundationChassis(L.c.c,L.c.t,P,team,[],false):M3.chassisKit(L.c.c,L.c.t,P,team,[],false);add(H,body);
 const gun=new T.Group();gun.position.y=H.meta.ty;body.add(gun);const Wk=wait?M3.foundationWeapon(L.w.a,L.w.t,P,team,false,L.c.c):M3.weaponKit(L.w.a,L.w.t,P,team,false,L.c.c,L.c.t);gun.scale.setScalar(Wk.meta.scale||M3.weaponScale(L.w.a,L.c.c));add(Wk,gun);
 if(pt.banner&&bn&&v.style&&root.ConquestTownKit){try{const m=root.ConquestTownKit.kit(v.style).banner(bn,.42).mesh();m.position.set(-2.1,1.1,-.9);m.rotation.y=Math.PI;m.userData.noPick=true;m.userData.allyBanner=true;g.add(m);}catch(_){}}   // Battalion colors: your town banner on every ally
 g.scale.setScalar(1.65);g.userData.ally=f.id;
 // the player's own grounding (style.dressTank: contact shadow and ring) in the role's colour (LDF: their trim gold), no trim strips or lamp
 if(v.style){g.userData.body=body;g.userData.gun=gun;try{v.style.dressTank(g,{ring:parseInt(String(f.side==='ldf'?'#d9c27a':ROLE_C[f.role||'']||'#d9c27a').slice(1),16),ringA:.42,blobA:.14,strips:false,lamp:false});}catch(_){}}
 const motion=typeof GraphicsMotion!=='undefined'?GraphicsMotion.attach(g,H.meta.track||[(2.61-.48)/2,.24,.25,0],{includeOwned:!wait}):null;
 v.scene.add(g);return {g,body,gun,motion,key,arch:L.w.a,cls:L.c.c,ct:L.c.t,shots:f.n|0,x:f.x,y:f.y,z:f.z,h:f.heading||0,t:f.turret||0};}
function drop(v,F){v.scene.remove(F.g);try{F.motion?.dispose();}catch(_){}if(typeof Equipment3D!=='undefined')try{Equipment3D.releaseTree(F.g);}catch(_){}
 F.g.traverse(o=>{if(o.geometry&&!o.geometry.userData.hfShared&&!v.shared?.includes(o.geometry))o.geometry.dispose();});}
// every frame (view.js combatRender): build, place and animate the friendly units within RANGE of the pilot
function render(v,B){const V=v.friendViews||(v.friendViews=new Map()),list=B?.friends||[],p=v.renderP||v.p,seen=v.friendSeen||(v.friendSeen=new Set());seen.clear();
 if(v.renderer?.isConquestCanvas||!list.length){if(V.size)clear(v);return;}
 const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-(v.friendT||now))/1000));v.friendT=now;const s=v.authority?.state,pp=v.loadout?.paint||'stock',bn=s?.plot?.banner||null,T=v.T,ox=v.origin.x,oz=v.origin.z,k=1-Math.exp(-dt*EASE);
 const up=v.allyUp||(v.allyUp=new T.Vector3()),fw=v.allyFw||(v.allyFw=new T.Vector3()),rt=v.allyRt||(v.allyRt=new T.Vector3()),M=v.allyM||(v.allyM=new T.Matrix4()),Q=v.allyQ||(v.allyQ=new T.Quaternion()),AX=v.allyAx||(v.allyAx=new T.Vector3());
 for(const f of list){if(Math.hypot(f.x-p.x,f.z-p.z)>RANGE)continue;seen.add(f.id);const pt=paintOf(f,s,pp),key=specKey(f,pt,bn);let F=V.get(f.id);if(F&&F.key!==key){drop(v,F);F=null;}if(!F){F=build(v,f,pt,key,bn);V.set(f.id,F);}
  // ease toward the simulated hull (50 ms steps on both sides); a jump (a regroup, a respawn, a fast travel) snaps
  const fy=Number.isFinite(f.y)?f.y:W().groundAt(f.x,f.z),x0=F.x,z0=F.z;if(Math.hypot(f.x-F.x,f.z-F.z)>SNAP){F.x=f.x;F.z=f.z;F.y=fy;}else{F.x+=(f.x-F.x)*k;F.z+=(f.z-F.z)*k;F.y+=(fy-F.y)*k;}
  F.h+=wrap((f.heading||0)-F.h)*k;F.t+=wrap((f.turret||0)-F.t)*Math.min(1,k*1.4);
  const down=!!f.down||f.hp<=0;F.g.position.set(F.x-ox,F.y-(down?.35:0),F.z-oz);up.set(...W().surfaceNormal(F.x,F.z));fw.set(Math.sin(F.h),0,Math.cos(F.h));fw.addScaledVector(up,-fw.dot(up)).normalize();rt.crossVectors(up,fw).normalize();M.makeBasis(rt,up,fw);F.g.quaternion.setFromRotationMatrix(M);
  if(down){Q.setFromAxisAngle(AX.set(0,0,1),.13);F.g.quaternion.multiply(Q);}   // the downed look: low, tilted on its side, gun dropped
  F.gun.rotation.y=F.t-F.h;F.gun.rotation.z=down?.38:0;
  if(F.motion){const mx=F.x-x0,mz=F.z-z0,moved=Math.hypot(mx,mz);if((f.n|0)>F.shots&&typeof GraphicsMotion!=='undefined'){GraphicsMotion.shot(F.motion.state,F.arch);}F.shots=f.n|0;
   F.motion.step(dt,{dx:moved?mx/1.65:0,dz:moved?mz/1.65:0,heading:Math.PI/2-F.h,aim:F.t-F.h,trackHalfWidth:M3.CHASSIS_VISUALS[F.cls]?.[M3.visualTier(F.ct)]?.trackZ??.58},down);}}
 for(const [id,F] of V)if(!seen.has(id)){drop(v,F);V.delete(id);}}
function clear(v){for(const F of v.friendViews?.values()||[])drop(v,F);v.friendViews?.clear();}
// damage stages on your allies (FX3D's own armour wear: cracks, scorch, smoke) inside view.js fxFrame; downed allies always smoke.
// The nearest four (two on LOW: ally effects halved)
function wear(v,F,B,ox,oz,p,low){let n=0;const cap=low?2:4;for(const f of B?.friends||[]){if(n>=cap)break;if(!(f.maxHp>0)||Math.hypot(f.x-p.x,f.z-p.z)>140)continue;const fr=f.down||f.hp<=0?.05:f.hp/f.maxHp;if(fr>=.7)continue;n++;
  const S=v.friendViews?.get(f.id),x=S?S.x:f.x,y=S?S.y:f.y,z=S?S.z:f.z;F.wear('armor',x-ox,y+1.5,z-oz,2.2,1.2,3,-(f.heading||0),fr,(f.id|0)%9973+11);}}
// the HUD insignia over each ally (app.js combatHUD): role badge, call sign, hull bar; DOWN when downed
function tags(panel,v,el){if(!panel||!v?.camera)return;const B=v.battle||v.encounter,box=panel.querySelector('.cq-ally-tags')||el('div','cq-ally-tags',null,panel),have=new Map();for(const n of box.children)have.set(Number(n.dataset.id),n);
 const list=(B?.friends||[]).filter(f=>f.side==='mine'||f.side==='ldf'),r=v.host.getBoundingClientRect(),pr=panel.getBoundingClientRect(),p=v.renderP||v.p,T=v.T,ox=v.origin.x,oz=v.origin.z,P=v.allyTagP||(v.allyTagP=new T.Vector3()),used=new Set();
 if(!v.renderer?.isConquestCanvas&&B?.playerHp>0)for(const f of list){const d=Math.hypot(f.x-p.x,f.z-p.z);if(d>TAG_FAR)continue;const S=v.friendViews?.get(f.id),x=S?S.x:f.x,y=S?S.y:f.y,z=S?S.z:f.z;P.set(x-ox,y+6.2,z-oz).project(v.camera);if(P.z>1)continue;const edge=Math.abs(P.x)>.94||P.y>.86||P.y<-.6;if(edge){P.x=Math.max(-.94,Math.min(.94,P.x));P.y=Math.max(-.6,Math.min(.86,P.y));}   /* an ally just off-screen: its badge waits at the edge (above the controls) */
  used.add(f.id);let n=have.get(f.id);if(!n){n=el('div','cq-ally-tag',null,box);n.dataset.id=String(f.id);el('i','cq-ally-badge','',n);el('b','cq-ally-cs','',n);const bar=el('span','cq-ally-hp',null,n);el('i','',null,bar);}
  const down=!!f.down||f.hp<=0,role=f.role||'',ldf=f.side==='ldf',near=!edge&&(d<NAME_NEAR||down||f.hp<f.maxHp*.5),cls='cq-ally-tag'+(down?' cq-ally-down':'')+(ldf?' cq-ally-ldf':'')+(near?'':' cq-ally-far')+(edge?' cq-ally-edge':'');if(n.className!==cls)n.className=cls;
  const b=n.firstChild,cs=b.nextSibling,hp=cs.nextSibling.firstChild,letter=ldf?'◆':ROLE_L[role]||'W',col=ldf?'#d9c27a':ROLE_C[role]||'#d9c27a';if(b.textContent!==letter)b.textContent=letter;if(n.dataset.c!==col){n.dataset.c=col;n.style.setProperty('--rc',col);}
  const name=down?(f.name||'ALLY')+' · DOWN':(f.name||(ldf?'LDF':'ALLY'));if(cs.textContent!==name)cs.textContent=name;const w=Math.max(0,Math.min(1,f.hp/(f.maxHp||1))),tf='scaleX('+w.toFixed(2)+')';if(hp.style.transform!==tf)hp.style.transform=tf;
  const X=Math.round((P.x+1)/2*r.width+r.left-pr.left),Y=Math.round((1-P.y)/2*r.height+r.top-pr.top),t='translate('+X+'px,'+Y+'px)';if(n.style.transform!==t)n.style.transform=t;if(n.hidden)n.hidden=false;
  n.setAttribute('aria-label',(ldf?'LDF regular':(f.name||'ally')+' · '+(role?role:'wingman'))+(down?' · down':' · hull '+Math.round(w*100)+'%'));}
 for(const [id,n] of have)if(!used.has(id)){if(list.some(f=>f.id===id))n.hidden=true;else n.remove();}}
root.ConquestAllies=Object.freeze({render,clear,wear,tags,paintOf,ROLE_L,ROLE_C,get views(){return null;}});
})(globalThis);
