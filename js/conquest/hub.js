/* Conquest Command hub (Session 5 Phase 3): Conquest's own page, not just a mode button. One cinematic live 3D hero (your tank
   and base on the Moon, Earth on the horizon, the Neon Frontline warfront glowing beyond), one status column (warfront, your
   base with the Daily Base Yield meter and running timers, live events) and four actions (deploy, fast travel, base,
   research placeholder for Session 6). Fast first paint: the page and the last known status draw at once; the 3D hero and
   the live status load after it. Presentation only: the status is the Worker's own session state. Session 7 adds ladders,
   squad wars and the daily warfront event here. */
(function(root){
'use strict';
let H=null;
const CACHE='lunar-conquest-hub-v1';
const fmt=n=>typeof fmtNum==='function'?fmtNum(n):String(n);
const t2=ms=>{const v=Math.max(0,Math.ceil(ms/1000));return v>=3600?Math.floor(v/3600)+'h '+String(Math.floor(v%3600/60)).padStart(2,'0')+'m':Math.floor(v/60)+':'+String(v%60).padStart(2,'0');};
function render(panel,o){close();const {el,button}=o;panel.className='cq cq-hub cq-command';
 H={panel,o,raf:0,disposed:false,state:null};
 const top=el('div','cq-top',null,panel);top.append(button('← RETURN TO ARCADE',o.exit));
 const hero=el('div','cq-hub-hero',null,panel);H.hero=hero;const art=el('div','cq-hub-art',null,hero);art.setAttribute('aria-hidden','true');
 const copy=el('div','cq-hub-copy',null,hero);el('p','cq-kicker','LUNAR / CONQUEST COMMAND',copy);el('h1','','CONQUEST',copy);el('p','cq-premise','EARTH HAS FALLEN.\nWE HOLD THE MOON.',copy);
 const col=el('div','cq-hub-status',null,panel);H.col=col;   // not a live region: it refreshes every second
 const acts=el('div','cq-hub-actions',null,panel);
 const deploy=button('ENTER CONQUEST',()=>o.enter(),'cq-enter cq-hub-deploy');acts.append(deploy);
 acts.append(button('FAST TRAVEL',()=>o.enter('travel'),'cq-hub-act'),button('MY BASE',()=>o.enter('base'),'cq-hub-act'));
 const rs=button('RESEARCH · COMING SOON',()=>{},'cq-hub-act');rs.disabled=true;rs.setAttribute('aria-disabled','true');rs.title='The Science Lab research tree (tank mods) is coming soon.';acts.append(rs);
 el('div','cq-hub-foot',null,panel).append(button('WORLD INTEL',()=>o.map(),'cq-secondary'));
 let cached=null;try{cached=JSON.parse(localStorage.getItem(CACHE)||'null');}catch(e){}status(cached,true);
 // after first paint: live status, then the 3D hero
 const later=root.requestIdleCallback?f=>root.requestIdleCallback(f,{timeout:400}):f=>setTimeout(f,60),me=H;
 later(()=>{if(H!==me||me.disposed)return;live(me);hero3d(me);});}
function status(s,stale){if(!H)return;const {el}=H.o,col=H.col;col.replaceChildren();const now=Date.now(),C=root.ConquestCombat;
 const card=(title,cls)=>{const c=el('section','cq-hub-card '+(cls||''),null,col);el('h3','',title,c);return c;};
 // warfront
 const terr=s?.territory||{},secs=(root.ConquestWorld?.sectors||[]).map(x=>x.id),held=secs.filter(id=>terr[id]?.owner==='humanity').length,total=secs.length||6,alerts=Object.entries(terr).filter(([,t])=>t?.status==='defense-alert'||t?.status==='contested');
 const w=card('WARFRONT');el('p','cq-hub-big',held+' / '+total+' SECTORS HELD',w);const bar=el('progress','cq-hub-bar',null,w);bar.max=total;bar.value=held;bar.setAttribute('aria-label','Sectors held');
 el('small','',s?.warfront?.stage?'Stage '+s.warfront.stage+' of the shared warfront'+(s.warfront.name?' · '+s.warfront.name:''):'Every operation you win pushes the shared warfront.',w);
 // your base
 const b=card('YOUR BASE');const p=s?.plot,base=s?.base;
 if(base?.tier&&p){const PL=root.ConquestPlot;el('p','cq-hub-big',(p.nm||(PL?.SITES[p.site]?.name||'')+' TOWN')+' · CC'+p.cc,b);el('small','','TOWN SCORE '+fmt(p.power||0)+(p.def?' · DEFENSE RATING '+fmt(p.def):''),b);if(PL?.wallCapOf)el('small','','WALLS '+(p.wn??Object.keys(p.w||{}).length)+' / '+PL.wallCapOf(p)+' · TURRETS '+(p.tn??PL.turretCount(p))+' / '+PL.TURRET_CAP[(p.cc||1)-1]+(p.log?.[0]?' · LAST DRILL '+String(p.log[0].outcome).toUpperCase():' · run a Defense Drill'),b);
  if(C?.baseYield){const y=C.baseYield(base,s.reputation,now),m=el('progress','cq-hub-bar cq-hub-yield',null,b);m.max=1;m.value=Math.round(y.fill*1000)/1000;m.setAttribute('aria-label','Daily Base Yield');el('small','','DAILY BASE YIELD '+Math.floor(y.fill*100)+'%'+(y.fill>=1?' · FULL, COLLECT AT YOUR BASE':' · +'+fmt(y.cp)+' CP so far'),b);}
  const j=p.job;el('small','',j?'BUILDER · '+(j.t==='cc'?'COMMAND CENTER':(root.ConquestPlot?.BUILDINGS[j.t]?.n||j.t).toUpperCase())+' '+(j.l||'')+' · '+(j.ready>now?t2(j.ready-now):'READY'):'BUILDER FREE · open MY BASE to build',b);}
 else{el('p','cq-hub-big','NO BASE YET',b);const D=C?.baseDefinition,L=s?.ledger;el('small','',D&&L?'Claim your own town: '+Math.min(L.cp,D.recipe.cp)+' / '+fmt(D.recipe.cp)+' CP banked. Seven sites, from crater rim to ash field; it grows with your Command Center.':'Win operations, bank salvage, then claim your own town.',b);el('small','cq-hub-where','⌂ Your base gate is next to the Refuge, about 90 m west. Tap MY BASE: the gold arrow takes you there.',b);}
 // events
 const e=card('LIVE EVENTS');const M=C?.meteorStrike?.(now);
 if(M&&M.phase!=='idle')el('p','cq-hub-big cq-hub-meteor','☄ METEOR STRIKE · '+M.site.name+' · '+(M.phase==='telegraph'?'IMPACT IN '+t2(M.impactAt-now):'OPEN · '+t2(M.closesAt-now)+' LEFT'),e);
 else if(M){const next=Math.ceil(now/7200000)*7200000;el('p','cq-hub-big','☄ NEXT METEOR STRIKE IN '+t2(next-now),e);}
 for(const [id] of alerts.slice(0,2))el('small','cq-hub-alert','⚠ INVASION · '+((root.ConquestWorld?.sectors||[]).find(x=>x.id===id)?.name||id.toUpperCase())+' NEEDS DEFENDERS',e);
 if(!alerts.length)el('small','','No invasions right now.',e);
 if(stale&&s)el('small','cq-hub-stale','Last known status · updating…',col);if(!s)el('small','cq-hub-stale',typeof ACCOUNT_OK!=='undefined'&&ACCOUNT_OK?'Connecting to Conquest Command…':'Sign in to keep your Conquest progress.',col);}
async function live(me){if(!H||H!==me||typeof apiFetch!=='function'||typeof ACCOUNT_OK==='undefined'||!ACCOUNT_OK)return;try{const r=await apiFetch('/api/conquest/session',{}),j=await r.json();if(!H||H!==me||H.disposed||!r.ok||!j.state)return;H.state=j.state;
  const keep={territory:j.state.territory,warfront:j.state.warfront?{stage:j.state.warfront.stage,name:j.state.warfront.name}:null,base:j.state.base,plot:j.state.plot?{cc:j.state.plot.cc,site:j.state.plot.site,power:j.state.plot.power,def:j.state.plot.def|0,nm:j.state.plot.nm||'',job:j.state.plot.job,banner:j.state.plot.banner,w:{},b:{},log:(j.state.plot.log||[]).slice(0,1),wn:Object.keys(j.state.plot.w||{}).length,tn:root.ConquestPlot?.turretCount(j.state.plot)||0}:null,reputation:j.state.reputation,ledger:{cp:j.state.ledger?.cp||0}};
  try{localStorage.setItem(CACHE,JSON.stringify(keep));}catch(e){}status(j.state,false);H.tick=setInterval(()=>{if(H&&!H.disposed)status(H.state,false);},1000);H.rebuild?.(j.state);}catch(e){}}

// ------------------------------------------------------------------------- cinematic hero ---------------------------
async function hero3d(me){if(!H||H!==me||H.disposed)return;const gfx=typeof gfxMode==='function'?gfxMode():'auto';if(gfx==='2d'||root.LUNAR_HUB_STATIC)return;try{await H.o.three();}catch(e){return;}if(!H||H!==me||H.disposed||!root.THREE)return;
 const T=root.THREE,host=H.hero,low=gfx==='low',reduce=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;let renderer;try{renderer=new T.WebGLRenderer({antialias:!low,alpha:true,powerPreference:'low-power'});}catch(e){return;}
 renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,low?1:1.75));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;const cv=renderer.domElement;cv.className='cq-hub-canvas';cv.setAttribute('aria-hidden','true');host.prepend(cv);
 const sc=new T.Scene();sc.fog=new T.Fog(0x05070d,120,900);const cam=new T.PerspectiveCamera(42,1,.3,4000);
 sc.add(new T.HemisphereLight(0x5a7abc,0x1a1620,1.6));const key=new T.PointLight(0x7fe8ff,60,40,1.6);key.position.set(6,8,8);sc.add(key);const sun=new T.DirectionalLight(0xfff1dd,2.8);sun.position.set(260,160,420);sc.add(sun);const rim=new T.DirectionalLight(0x52c6ff,1.4);rim.position.set(200,80,300);sc.add(rim);
 // stars
 {const n=low?500:1400,pos=new Float32Array(n*3);let seed=7;const r=()=>(seed=(Math.imul(seed,1664525)+1013904223)|0,(seed>>>0)/4294967296);for(let i=0;i<n;i++){let x,y,z;do{x=r()*2-1;y=r();z=r()*2-1;}while(x*x+y*y+z*z>1);const l=Math.hypot(x,y,z)||1;pos.set([x/l*1800,y/l*1800+40,z/l*1800],i*3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));sc.add(new T.Points(g,new T.PointsMaterial({color:0xcfe6ff,size:low?2.2:1.6,sizeAttenuation:false,fog:false})));}
 // the Moon: a huge sphere so the horizon curves, grey regolith with darker maria and crater pocks (vertex colours)
 {const g=new T.SphereGeometry(1200,low?96:160,low?48:80,0,Math.PI*2,0,Math.PI/5);g.translate(0,-1200,0);const p=g.attributes.position,c=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),n=Math.sin(x*.021)*Math.cos(z*.017)+.5*Math.sin(x*.07+z*.05)+.25*Math.sin(x*.19-z*.23),k=.07+.03*n+(Math.sin(x*.4)*Math.cos(z*.37)>.92?-.03:0);c.set([k,k,k*1.06],i*3);p.setY(i,p.getY(i)+n*.9);}
  g.setAttribute('color',new T.BufferAttribute(c,3));g.computeVertexNormals();sc.add(new T.Mesh(g,new T.MeshPhongMaterial({vertexColors:true,shininess:4,flatShading:true})));}
 // Earth on the horizon, with its thin blue atmosphere
 const earth=new T.Group();{const g=new T.SphereGeometry(150,low?32:64,low?16:32),p=g.attributes.position,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const x=p.getX(i)/150,y=p.getY(i)/150,z=p.getZ(i)/150,land=Math.sin(x*4.1+z*2.3)*Math.cos(y*3.7-x*1.9)+.4*Math.sin(z*9+y*5)>.35,ice=Math.abs(y)>.86;c.set(ice?[.85,.9,.95]:land?[.16,.3,.12]:[.03,.12,.34],i*3);}
  g.setAttribute('color',new T.BufferAttribute(c,3));earth.add(new T.Mesh(g,new T.MeshPhongMaterial({vertexColors:true,shininess:30,emissive:0x061428,fog:false})));
  earth.add(new T.Mesh(new T.SphereGeometry(158,low?24:48,low?12:24),new T.MeshBasicMaterial({color:0x4fb4ff,transparent:true,opacity:.18,side:T.BackSide,depthWrite:false,fog:false})));}
 earth.position.set(170,150,-1100);sc.add(earth);
 // the warfront glowing on the far horizon (Neon Frontline magenta), and the pilot's base and tank in front
 const glow=new T.MeshBasicMaterial({color:0xff2bd6,fog:false}),cyan=new T.MeshBasicMaterial({color:0x22e6ff}),amber=new T.MeshBasicMaterial({color:0xffb347});
 for(let i=0;i<(low?6:12);i++){const m=new T.Mesh(new T.OctahedronGeometry(2+i%3,0),glow);m.position.set(-500+i*90+(i%2)*30,-6-(i%3)*4,-760-(i%4)*40);sc.add(m);}
 const pad=new T.Mesh(new T.RingGeometry(6.2,6.7,64),cyan);pad.rotation.x=-Math.PI/2;pad.position.y=.06;sc.add(pad);
 const baseG=new T.Group();sc.add(baseG);const steel=new T.MeshPhongMaterial({color:0x4a5664,shininess:20,flatShading:true}),dark=new T.MeshPhongMaterial({color:0x222932,shininess:10,flatShading:true});
 // Session 5C: once the live state has the town, the hero shows the pilot's actual town (CC height by level, walls in their
 // blends, turrets, homes, banner) from the shared town kit, drawn with simple lit vertex colours in this renderer.
 const townModel=p=>{const TKit=root.ConquestTownKit,CS=root.ConquestStyle,PL=root.ConquestPlot;if(!TKit||!CS||!PL||!p?.b?.cc||!p.w)return null;try{H.cs=H.cs||CS.create(T,{low:true});const half=(PL.townH(p.cc)+2.5)*PL.GRID.cell,sc=38/(2*half),d=TKit.diorama(H.cs,p,{low:true,scale:sc});
   const mat=H.townMat||(H.townMat=new T.MeshPhongMaterial({vertexColors:true,shininess:12,flatShading:true}));d.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,a=g.attributes.aCol;if(!a||!g.attributes.normal){o.visible=false;return;}
    if(!g.attributes.color){const c=new Float32Array(a.count*3);for(let i=0;i<a.count;i++){const e=1.7+a.getW(i)*.9;c[i*3]=Math.min(1,a.getX(i)*e);c[i*3+1]=Math.min(1,a.getY(i)*e);c[i*3+2]=Math.min(1,a.getZ(i)*e);}g.setAttribute('color',new T.BufferAttribute(c,3));}o.material=mat;});
   d.position.y=2.4+6.2*sc;const ped=new T.Mesh(new T.CylinderGeometry(19.5,21,2.4,8),dark);ped.position.y=1.2;const g2=new T.Group();g2.add(ped,d);const rim=new T.Mesh(new T.TorusGeometry(19.6,.12,6,48),cyan);rim.rotation.x=Math.PI/2;rim.position.y=2.42;g2.add(rim);H.town=d.userData.counts;return g2;}catch(e){H.townError=String(e&&e.message||e);return null;}};
 H.rebuild=s=>{baseG.clear();const p=s?.plot,cc=p?.cc||0;baseG.position.set(-13,0,-30);baseG.rotation.y=.5;
  const town=townModel(p);if(town){baseG.add(town);return;}
  if(!cc){const ring=new T.Mesh(new T.RingGeometry(10,10.6,64),amber);ring.rotation.x=-Math.PI/2;ring.position.y=.1;baseG.add(ring);return;}
  let y=0;for(let k=0;k<Math.min(10,cc);k++){const r=7-k*.5,h=1.8+(k%2)*.6,m=new T.Mesh(new T.CylinderGeometry(r*.96,r,h,8),k%2?steel:dark);m.position.y=y+h/2;baseG.add(m);const ringM=new T.Mesh(new T.TorusGeometry(r*.97,.09,6,32),cyan);ringM.rotation.x=Math.PI/2;ringM.position.y=y+h;baseG.add(ringM);y+=h;}
  const beacon=new T.Mesh(new T.OctahedronGeometry(.8,0),cc>=9?new T.MeshBasicMaterial({color:0xffd36b}):cyan);beacon.position.y=y+3;baseG.add(beacon);
  for(const [x,z,w,h,d] of [[-14,4,8,5,10],[13,6,9,6,8],[-6,16,6,3,6]]){const m=new T.Mesh(new T.BoxGeometry(w,h,d),steel);m.position.set(x,h/2,z);baseG.add(m);const strip=new T.Mesh(new T.BoxGeometry(w*1.01,.18,.18),cyan);strip.position.set(x,h*.8,z+d/2);baseG.add(strip);}
  if(p?.banner){const pole=new T.Mesh(new T.BoxGeometry(.25,9,.25),dark);pole.position.set(9,4.5,-6);baseG.add(pole);const flag=new T.Mesh(new T.BoxGeometry(4,2.6,.1),new T.MeshBasicMaterial({color:p.banner.colors[0]}));flag.position.set(11,7.6,-6);baseG.add(flag);const st=new T.Mesh(new T.BoxGeometry(4,.5,.12),new T.MeshBasicMaterial({color:p.banner.colors[1]}));st.position.set(11,7.6,-6);baseG.add(st);}};
 H.rebuild(H.state||(()=>{try{return JSON.parse(localStorage.getItem(CACHE)||'null');}catch(e){return null;}})());
 // your tank, built from your equipped loadout with the shared 3D kit
 const tank=new T.Group();sc.add(tank);try{const K3=typeof M3!=='undefined'?M3:null,L=typeof myLoadout==='function'?myLoadout():null;if(K3&&L){const mats={lit:new T.MeshPhongMaterial({vertexColors:true,shininess:45}),shine:new T.MeshPhongMaterial({vertexColors:true,shininess:65}),glow:new T.MeshBasicMaterial({vertexColors:true})},P=(typeof PAINTS!=='undefined'&&PAINTS[L.paint])||(typeof PAINTS!=='undefined'?PAINTS.stock:null);
  const body=new T.Group();body.rotation.y=-Math.PI/2;tank.add(body);const HK=K3.chassisKit(L.c.c,L.c.t,P,'#88cbdc',L.cores,L.skin==='lunar');body.add(K3.meshOf(K3.bake(HK.k),null,mats));for(const a of HK.anims||[]){const m=K3.meshOf(K3.bake(a.k),null,mats);m.position.set(...a.p);body.add(m);}
  const gun=new T.Group();gun.position.y=HK.meta.ty;body.add(gun);gun.scale.setScalar(K3.weaponScale(L.w.a,L.c.c));const W=K3.weaponKit(L.w.a,L.w.t,P,'#88cbdc',L.skin==='lunar',L.c.c);gun.add(K3.meshOf(K3.bake(W.k),null,mats));for(const a of W.anims||[]){const m=K3.meshOf(K3.bake(a.k),null,mats);m.position.set(...a.p);gun.add(m);}tank.scale.setScalar(2.3);}}catch(e){H.tankError=String(e&&e.message||e);tank.clear();}
 if(!tank.children.length){const b=new T.Mesh(new T.BoxGeometry(5,1.6,3.4),steel);b.position.y=1.2;tank.add(b);const t=new T.Mesh(new T.BoxGeometry(2.4,1,2),dark);t.position.y=2.4;tank.add(t);const g=new T.Mesh(new T.BoxGeometry(3.6,.3,.3),dark);g.position.set(2.4,2.4,0);tank.add(g);}
 const resize=()=>{const w=host.clientWidth||390,h=host.clientHeight||380;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();};resize();H.resize=resize;root.addEventListener('resize',resize);
 let t=0,last=performance.now();const loop=now=>{if(!H||H.disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(!document.hidden){t+=reduce?0:dt;const a=Math.sin(t*.05)*.18;cam.position.set(6+Math.sin(a)*8,5.5+Math.sin(t*.11)*.4,13+Math.cos(a)*2);cam.lookAt(-1,3,-18);earth.rotation.y=t*.02;tank.rotation.y=Math.sin(t*.2)*.12+.55;renderer.render(sc,cam);H.info={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,programs:renderer.info.programs?.length||0};}H.raf=requestAnimationFrame(loop);};
 H.renderer=renderer;H.scene=sc;cv.style.opacity='0';sc.background=new T.Color(0x03050a);H.raf=requestAnimationFrame(n=>{loop(n);cv.style.transition='opacity .6s';cv.style.opacity='1';const art=host.querySelector('.cq-hub-art');if(art){art.style.transition='opacity .6s';art.style.opacity='0';}});}
function close(){if(!H)return;H.disposed=true;cancelAnimationFrame(H.raf);clearInterval(H.tick);if(H.resize)root.removeEventListener('resize',H.resize);if(H.scene)H.scene.traverse(o=>{o.geometry?.dispose?.();const m=o.material;if(m)(Array.isArray(m)?m:[m]).forEach(x=>x.dispose?.());});if(H.renderer){H.renderer.dispose();H.renderer.forceContextLoss?.();H.renderer.domElement.remove();}H=null;}
root.ConquestHub=Object.freeze({render,close,get state(){return H;}});
})(globalThis);
