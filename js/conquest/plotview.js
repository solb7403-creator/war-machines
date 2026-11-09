/* Command Base town view (Session 5 base builder, Session 5B Town Defense). The pilot's private town on the phone: site
   choice at first build, build mode (top-down camera, pinch zoom, two-finger pan, grid snapping, rotate, move, hologram
   preview with valid/invalid tint, turret range rings), the fast wall tools (line, rectangle, ring, copy/paste, erase, undo)
   with the ore-blend picker and live wall count/cost, live construction (scaffolding and drones), settler homes, crew and
   rovers, the whole-town raid replay (Defense Drill: breaches, fallen structures, vitals) and the town status.
   Presentation only: every change is a Worker action (worker/src/conquest-plot.js) validated with the shared rules
   (js/conquest/plot.js). Renders through the Conquest view's own renderer (one WebGL context, shared style programs; walls,
   turrets, homes and raiders are instanced); the 2D setting gets a top-down canvas town with the same controls. */
(function(root){
'use strict';
const P=root.ConquestPlot;
let X=null;   // the open town view
const fmt=n=>typeof fmtNum==='function'?fmtNum(n):String(n);
const LABEL={cp:'CP',alloy:'ALLOY',biomass:'BIOMASS',helium:'HELIUM-3',cm:'COMPOSITE',fe:'FERRITE',il:'ILMENITE',ar:'ARMALCOLITE',tq:'TRANQ.',se:'SELENITE',mh:'MOONHEART'};
const price=c=>Object.entries(c||{}).filter(([,n])=>n>0).map(([k,n])=>fmt(n)+' '+LABEL[k]).join(' + ');
const dur=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return s<60?s+'s':s<3600?Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s':Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';};
const ICON={cc:'◆',refinery:'⚙',storage:'▦',reactor:'⚡',foundry:'▤',biodome:'✿',hangar:'⌂',helium:'⛽',radar:'◎',shield:'⛨',lab:'⚗',uplink:'⇡',trophy:'♛',cannon:'●',mg:'⁞',laser:'✦',rocket:'⁂',missile:'➹',mortar:'◉',flame:'♨',siege:'■',tesla:'ϟ',lasercannon:'✷',railgun:'═',gate:'▯'};
// Card sprites (5C): every building, turret head and wall blend is rendered once to a 72 px image with the same style
// programs and cached for the session (queueSprite, below the scene code). Until one is ready, or in the 2D setting, the
// glyph stands in.
const SPRITES=new Map(),SPRITE_WAIT=[];
function sprite(kind,key,level){const k=kind+':'+key+':'+(level|0),url=SPRITES.get(k);if(url){const i=document.createElement('img');i.className='cq-plot-ico cq-plot-spr';i.src=url;i.alt='';i.dataset.spr=k;return i;}
 const s=document.createElement('span');s.className='cq-plot-ico'+(kind==='w'?' cq-plot-ico-w':'');s.textContent=kind==='w'?'':ICON[key]||'▪';s.dataset.spr=k;s.setAttribute('aria-hidden','true');if(!SPRITES.has(k))queueSprite(kind,key,level|0);return s;}
const ORE_LOOK=root.ConquestTownKit.ORE_LOOK;   // wall look per ore (index 0 = composite): body, accent, glow
const hex=n=>'#'+n.toString(16).padStart(6,'0');
const romanOf=n=>['','I','II','III','IV','V','VI','VII','VIII','IX','X'][n]||String(n);
const ownerUI=()=>typeof isOwnerUI==='function'&&isOwnerUI();
const devOn=()=>!!X?.ctx.view.authority?.state?.dev?.on;
const hasWallet=k=>((typeof save!=='undefined'&&save.mn?.[k])||0)>0;
function storesOf(s,p){const bm=(typeof save!=='undefined'&&save.bmn)||s?.airdrop?.view?.bmn||{},sp=p?.mnSpent||{},o={};for(const k of P.MNS)o[k]=Math.max(0,(bm[k]||0)-(sp[k]||0));return o;}
// One clear step at a time, never a wall of options (owner: nothing overwhelming). Plain words; "vital" is defined the
// first time it appears. k/n feed the "STEP k OF n" chip; tab is the tab the step needs (it glows).
const VITAL_DEF='VITAL: raiders hunt these; lose the Command Center and the raid wins.';
function guideStep(p,s){
 if(!p)return null;const has=t=>Object.values(p.b).some(b=>b.t===t&&(b.l>0||p.job?.id&&p.b[p.job.id]===b)),walls=Object.values(p.w||{}),fe=(storesOf(s,p).fe||0)>0||hasWallet('fe'),n=fe?7:6,st=(k,id,tab,text)=>({id,tab,k,n,text});
 if(!has('refinery'))return st(1,'refinery','build','BUILD A REFINERY: it turns rock and scrap into alloy, the metal you build with. Open BUILD.');
 if(!P.TURRETS.some(has))return st(2,'cannon','weapons','PLACE A CANNON TURRET: your first defense. Open WEAPONS.');
 if(!walls.length)return st(3,'wall','walls','BUILD YOUR FIRST WALL: open WALLS, pick RING and drag outward from your Command Center. You start with 200 composite, enough for a ring.');
 if(!has('reactor'))return st(4,'reactor','build','BUILD A REACTOR inside your walls: it powers your turrets. It is a '+VITAL_DEF);
 if(fe&&!walls.some(c=>P.wdecode(c).o>0))return st(5,'blend','walls','MAKE A STRONGER WALL: in WALLS pick FERRITE, then draw over your wall. Ore makes walls tougher.');
 if(!(p.log||[]).length)return st(fe?6:5,'drill','defend','RUN A DEFENSE DRILL in DEFEND: watch Parasites attack your whole town. It is practice: nothing is lost (milestones can add wall capacity).');
 if(p.cc<2)return st(n,'cc','home','UPGRADE THE COMMAND CENTER TO CC2 (tap it): the town grows and unlocks the Foundry, Biodome and Laser.');
 return null;}
function unlockLine(p){const cc=p.cc,next=Object.entries(P.BUILDINGS).filter(([,B])=>B.cc===cc+1).map(([,B])=>B.n),ores=P.ORES.filter((m,o)=>P.ORE_CC[o+1]===cc+1).map(m=>P.ORE_NAME[m]+' blends');
 return cc>=P.CC.max?'COMMAND CENTER AT MAXIMUM':'NEXT AT CC'+(cc+1)+': town '+P.townSide(cc+1)+'×'+P.townSide(cc+1)+', '+P.wallBase(cc+1)+' walls, '+P.TURRET_CAP[cc]+' turrets'+([...next,...ores].length?', '+[...next,...ores].join(', '):'');}

const TK=root.ConquestTownKit,kit=TK.kit;

// ------------------------------------------------------------------- scene ---------------------------------------------
// Firing effects by turret type: amber tracers, cyan beams, white-blue rails, violet arcs, flame cones, rocket/shell blasts.
const FX_OF={cannon:'tracer',mg:'tracer',laser:'beam',rocket:'blast',missile:'blast',mortar:'blast',flame:'flame',siege:'shell',tesla:'arc',lasercannon:'burst',railgun:'rail'};
const FX_LOOK={tracer:[0xffb347,.16,2.4],beam:[0x22e6ff,.12,2.6],rail:[0xd8f6ff,.18,3],arc:[0xb08cff,.1,3],flame:[0xff7a2d,.9,2.2],blast:[0xff5a2a,.3,2.6],shell:[0xffd36b,.34,2.8],burst:[0xff6ae0,.36,3]};
function scene3d(view){const S=view.style,T=view.T;if(!S||view.renderer.isConquestCanvas)return null;const k=kit(S),sc=new T.Scene();sc.background=new T.Color(0x05070d);sc.fog=new T.Fog(0x06070f,300,1100);
 // The same light counts as the world scene (hemi + sun + rim): the style programs are shared, no new program variants.
 const lights=[new T.HemisphereLight(0x3a5a9c,0x16131f,1.5),new T.DirectionalLight(0xe4ecff,2.9),new T.DirectionalLight(0x52c6ff,1.25)];lights[1].position.set(200,400,150);lights[2].position.set(-300,200,-200);sc.add(...lights);
 const cam=new T.PerspectiveCamera(50,1,.5,2000);const g={terrain:new T.Group(),build:new T.Group(),walls:new T.Group(),turrets:new T.Group(),homes:new T.Group(),holo:new T.Group(),grid:new T.Group(),fx:new T.Group(),actors:new T.Group()};for(const v of Object.values(g))sc.add(v);
 const im=(geo,n)=>{const m=new T.InstancedMesh(geo,S.MAT.solid,n);m.count=0;m.frustumCulled=false;m.visible=false;return m;};
 const crewN=S.low?8:16,crew=new T.InstancedMesh(k.person(),S.MAT.solid,crewN),rovers=new T.InstancedMesh(k.rover(),S.MAT.solid,S.low?2:4);crew.frustumCulled=rovers.frustumCulled=false;g.actors.add(crew,rovers);
 const foes={r:im(k.foe('r'),80),s:im(k.foe('s'),48),d:im(k.foe('d'),40),w:im(k.foe('w'),160),b:im(k.foe('b'),16)};for(const m of Object.values(foes))g.actors.add(m);
 const fx={};for(const [n,[col,w,em]] of Object.entries(FX_LOOK)){const b=new S.Bld();if(n==='flame')b.add(S.G.cone6,k.M(0,0,.5,Math.PI/2,0,0,.5,1,.5),new T.Color(col),em);else b.box(0,0,.5,w,w,1,new T.Color(col),em);fx[n]=im(b.geometry(),48);g.actors.add(fx[n]);}
 return {S,T,k,sc,cam,g,crew,rovers,foes,fx,meshes:new Map(),tur:new Map(),wim:new Map(),him:new Map(),wgeo:new Map(),hgeo:new Map(),tgeo:new Map(),keys:{},anim:[]};}
// Dispose a group's own geometries before clearing it (shared style geometries and cached kit geometries are kept).
function wipe(g,keep){for(const o of [...g.children]){o.traverse(q=>{if(q.geometry&&!q.geometry.userData?.hfShared&&!keep?.has(q.geometry))q.geometry.dispose();if(q.isInstancedMesh)q.dispose?.();});}g.clear();}
function holoMesh(R,cellsList,ok,ring,site){const {S}=R,X2=new S.Fx(),c=P.GRID.cell,reg=S.AT.SOLID||S.AT.BLOB,cols=Array.isArray(ok)?ok:null;
 cellsList.forEach(([i,j],n)=>{const x=P.cellX(i),z=P.cellZ(j),y=(site?P.groundY(site,i,j):0)+.2,good=cols?cols[n]:ok,col=good===2?[1,.75,.2]:good?[.1,.9,.45]:[1,.18,.22];X2.flat(x,y,z,c*.47,c*.47,reg,col.map(v=>v*.35),0);for(const [dx,dz,w,d] of [[0,-c/2,c/2,.06],[0,c/2,c/2,.06],[-c/2,0,.06,c/2],[c/2,0,.06,c/2]])X2.flat(x+dx,y+.04,z+dz,w,d,reg,col,0);});
 if(ring)X2.ringGlow(ring.x,ring.z,.6+(ring.y||0),ring.r,.5,ring.col||(ok?[.1,.75,1]:[1,.3,.3]),64);return X2.mesh();}

// Card sprites: one queued model per frame is drawn into a 144 px corner of the canvas (under the sheet, cleared by the next
// frame) with the town scene's own lights and fog (no new program variants), copied out at once (the drawing buffer is
// still valid in the same task) and cached as a data URL for the session. Placeholders on screen are swapped in place.
function queueSprite(kind,key,level){const k=kind+':'+key+':'+level;if(SPRITES.has(k)||SPRITE_WAIT.some(w=>w.k===k))return;SPRITE_WAIT.push({k,kind,key,level});}
function spriteModel(R,w){const {T,k}=R,g=new T.Group(),lv=Math.max(1,w.level||1);
 if(w.kind==='w'){const code=P.wcode(+w.key,+w.key?Math.max(1,w.level||2):0),geo=k.wallGeo(code,false);for(let n=-1;n<=1;n++){const m=new T.Mesh(geo,R.S.MAT.solid);m.position.x=n*4.02;g.add(m);}g.userData.geos=[geo];g.rotation.y=-.5;return g;}
 if(w.kind==='x'){const tint=(geo,c,e)=>{const a=geo.attributes.aCol;for(let i=0;i<a.count;i++){if(a.getW(i)>.3)a.setXYZW(i,c.r*1.4,c.g*1.4,c.b*1.4,e);else a.setXYZ(i,c.r*.55+a.getX(i)*.3,c.g*.55+a.getY(i)*.3,c.b*.55+a.getZ(i)*.3);}return geo;},gold=new T.Color(0xd8a640),neon=new T.Color(0xff2bd6);
  const add=(geo,x=0,y=0,ry=0)=>{const m=new T.Mesh(geo,R.S.MAT.solid);m.position.set(x,y,0);m.rotation.y=ry;g.add(m);};
  if(w.key==='wall-ext-10'){for(let n=-1;n<=1;n++)add(k.wallGeo(P.wcode(3,2),false),n*4.02);add(k.post(false),6.1);}else if(w.key==='skin-gilded'){for(let n=-1;n<=1;n++)add(tint(k.wallGeo(P.wcode(5,3),false),gold,1.4),n*4.02);}
  else if(w.key==='skin-turret-neon'){add(tint(k.building('railgun',5,null).geometry(),neon,2));add(tint(k.head('railgun',5).geometry(),neon,2),0,2.15,.7);}else if(w.key==='theme-aurora'){g.add(k.building('cc',10,{light:'violet',finish:'graphite'}).mesh());}
  else if(w.key==='foundry-rush'){g.add(k.building('foundry',5,{light:'amber'}).mesh());}else if(w.key==='builder-2'){g.add(k.building('hangar',4,null).mesh());}else g.add(k.building('storage',3,null).mesh());
  g.rotation.y=-.4;return g;}
 const b=k.building(w.key,w.key==='cc'?Math.min(10,lv):lv,null).mesh();g.add(b);const B=P.BUILDINGS[w.key];if(B?.turret||w.key==='radar'){const hd=k.head(w.key,lv).mesh();hd.position.y=w.key==='radar'?3.3+lv*.5:1.4+lv*.15;hd.rotation.y=.7;g.add(hd);}return g;}
function spriteStep(R){if(!SPRITE_WAIT.length||!R||!X)return;const w=SPRITE_WAIT.shift();if(SPRITES.has(w.k))return;const {T}=R,r=X.ctx.view.renderer,el=r.domElement,px=144;if(!el||el.height<px||el.width<px)return;
 try{if(!R.spr){const sc=new T.Scene();sc.fog=new T.Fog(0x06070f,3000,4000);const L=[new T.HemisphereLight(0x3a5a9c,0x16131f,1.5),new T.DirectionalLight(0xe4ecff,2.9),new T.DirectionalLight(0x52c6ff,1.25)];L[1].position.set(200,400,150);L[2].position.set(-300,200,-200);sc.add(...L);R.spr={sc,cam:new T.PerspectiveCamera(30,1,.1,500),v:new T.Vector3(),c:document.createElement('canvas')};R.spr.c.width=R.spr.c.height=px;}
  const Sp=R.spr,g=spriteModel(R,w);Sp.sc.add(g);g.updateMatrixWorld(true);const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9],v=Sp.v;g.traverse(o=>{const pa=o.geometry?.attributes?.position;if(!pa)return;for(let i=0;i<pa.count;i+=Math.max(1,pa.count>>9)){v.fromBufferAttribute(pa,i).applyMatrix4(o.matrixWorld);for(let a2=0;a2<3;a2++){const q=v.getComponent(a2);if(q<lo[a2])lo[a2]=q;if(q>hi[a2])hi[a2]=q;}}});   // the vendored three has no Box3
  const ctr=new T.Vector3((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2),rad=Math.max(1.5,Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])/2),d=rad/Math.sin(15*Math.PI/180)*1.02;
  Sp.cam.position.set(ctr.x+Math.sin(.65)*Math.cos(.5)*d,ctr.y+Math.sin(.5)*d,ctr.z+Math.cos(.65)*Math.cos(.5)*d);Sp.cam.lookAt(ctr);R.S.viewLights(Sp.cam);
  const old=new T.Color();r.getClearColor(old);const oa=r.getClearAlpha();r.setScissorTest(true);r.setViewport(0,0,px/(r.getPixelRatio?.()||1),px/(r.getPixelRatio?.()||1));r.setScissor(0,0,px/(r.getPixelRatio?.()||1),px/(r.getPixelRatio?.()||1));r.setClearColor(0x10283a,1);r.clear();r.render(Sp.sc,Sp.cam);r.setClearColor(old,oa);r.setScissorTest(false);
  const cx=Sp.c.getContext('2d');cx.clearRect(0,0,px,px);cx.drawImage(el,0,el.height-px,px,px,0,0,px,px);const url=Sp.c.toDataURL('image/png');Sp.sc.remove(g);g.traverse(o=>{if(o.geometry&&!o.geometry.userData?.hfShared)o.geometry.dispose();});
  SPRITES.set(w.k,url);for(const n of X.d.querySelectorAll('[data-spr="'+w.k+'"]')){const i=document.createElement('img');i.className='cq-plot-ico cq-plot-spr';i.src=url;i.alt='';i.dataset.spr=w.k;n.replaceWith(i);}}
 catch(e){SPRITES.set(w.k,'');if(X)X.sprErr=String(e&&e.message||e);}}

// ------------------------------------------------------------------- open / close --------------------------------------
// Session 5C: five tabs left to right (icon + short label, fits 320 px) in a bottom sheet the pilot drags between PEEK,
// HALF and FULL (js/conquest/sheet.js). The map above it is the rest of the screen: one CSS variable (--cq-sheet) sizes
// both, and the renderer viewport, scissor and cellAt() read the stage's own rectangle, so taps land on the exact cell.
const TABS=[['home','⌂','HOME'],['build','⚙','BUILD'],['weapons','✛','WEAPONS'],['walls','▦','WALLS'],['defend','⛨','DEFEND']];
const SNAP_KEY='lunar-cq-sheet-v1',SNAP_DEF=Object.freeze({home:'half',build:'half',weapons:'half',walls:'peek',defend:'half'});
function loadSnaps(){let o={};try{o=JSON.parse(localStorage.getItem(SNAP_KEY)||'{}')||{};}catch(_){}const r={...SNAP_DEF};for(const k of Object.keys(SNAP_DEF))if(['peek','half','full'].includes(o[k]))r[k]=o[k];return r;}
function saveSnaps(){try{localStorage.setItem(SNAP_KEY,JSON.stringify(X.snapOf));}catch(_){}}
const defDist=cc=>{const h=P.townH(cc||1),h1=P.townH(1),hN=P.townH(P.CC.max);return Math.round(95+25*Math.max(0,Math.min(1,(h-h1)/Math.max(1,hN-h1))));};
const ccAt=p=>{const c=p?.b?.cc;if(!c)return {x:0,z:0};const s=P.sizeOf('cc',c.r|0);return {x:P.cellX(c.i)+(s.w-1)*P.GRID.cell/2,z:P.cellZ(c.j)+(s.d-1)*P.GRID.cell/2};};
// Default camera (5C): a 3/4 view framed on the Command Center at about 55% of the old distance (CC1 95 m, CC10 120 m).
function frameCam(p,yaw=0){const c=ccAt(p);return {x:c.x,z:c.z+4,dist:defDist(p?.cc),tilt:.78,yaw};}
const tabName=m=>(TABS.find(t=>t[0]===m)||TABS[0])[2];
function open(ctx){if(X)return;const {view,panel,el,button}=ctx;const st=()=>view.authority?.state;
 panel.classList.add('cq-in-plot');const d=el('section','cq-dialog cq-plot',null,panel);d.setAttribute('role','dialog');d.setAttribute('aria-label','Command Base town');
 X={ctx,d,mode:'home',sel:null,place:null,draw:null,cam:{x:0,z:6,dist:110,tilt:.78,yaw:0},drill:null,clock:0,lastKey:'',busy:false,tool:'ring',blend:{o:0,l:0},draft:[],clip:null,pan:false,snapOf:loadSnaps(),auto:null,busySnap:null};
 const top=el('div','cq-plot-top',null,d);X.top=top;X.title=el('div','cq-plot-title','',top);const chips=el('div','cq-plot-chips',null,top);X.chipPw=el('span','cq-plot-chip','',chips);X.chipDef=el('span','cq-plot-chip','',chips);X.chipPw.title='Power used / supplied';X.chipDef.title='Defense rating';
 const leave=button('LEAVE',()=>close(),'cq-plot-leave');leave.setAttribute('aria-label','Leave base');top.append(leave);
 d.addEventListener('touchmove',e=>e.stopPropagation(),{passive:true});   // the app-wide touchmove guard must not block the menu's native scroll (iPhone)
 X.stage=el('div','cq-plot-stage',null,d);X.coach=button('',()=>{const g=X.coachStep;if(!g)return;if(g.id==='cc'){X.sel='cc';if(X.view==='drive'){X.camFrom=camPose();X.camT=0;X.view='build';}X.mode='home';render();return;}if(g.tab!==X.mode||X.view==='drive')setTab(g.tab);else if(snapNow()==='peek'){X.snapOf[X.mode]='half';layout();}},'cq-plot-coach');X.coach.hidden=true;X.stage.append(X.coach);
 X.drawer=el('div','cq-plot-drawer',null,d);X.grab=el('div','cq-plot-grab',null,X.drawer);X.grab.tabIndex=0;X.grab.setAttribute('role','button');
 X.tabs=el('div','cq-plot-tabs',null,X.drawer);X.tabs.setAttribute('role','tablist');X.tabBtn={};for(const [m,ic,lab] of TABS){const b=button('',()=>setTab(m));b.setAttribute('role','tab');el('i','',ic,b);el('span','',lab,b);b.dataset.tab=m;X.tabs.append(b);X.tabBtn[m]=b;}
 X.sheet=el('div','cq-plot-sheet',null,X.drawer);X.sheet.id='cq-plot-panel';X.sheet.setAttribute('role','tabpanel');for(const b of Object.values(X.tabBtn))b.setAttribute('aria-controls','cq-plot-panel');
 X.tabs.addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;const i=TABS.findIndex(t=>t[0]===X.mode),n=TABS[(i+(e.key==='ArrowRight'?1:TABS.length-1))%TABS.length][0];e.preventDefault();setTab(n);X.tabBtn[n].focus();});X.msg=el('p','cq-plot-msg','',d);X.msg.setAttribute('aria-live','polite');
 root.ConquestSheet?.attach({handle:X.grab,H:freeH,minPeek,current:()=>X.sheetPx||0,apply:px=>{X.sheetPx=px;sheetVar(px,false);shortMap(px);},snap:snapNow,snapped:k=>{if(!X)return;if(X.visit){X.visitSnap=k;layout();return;}if(X.view==='drive'){if(k==='peek'){layout();return;}endTour();X.camFrom=camPose();X.camT=0;X.view='build';X.snapOf[X.mode]=k;saveSnaps();render();return;}if(busy())X.busySnap=k;else{X.snapOf[X.mode]=k;saveSnaps();}layout();}})   /* 5C review: in the drive view a drag or tap on the handle opens the build view of the current tab at that height */;
 X.onResize=()=>layout();root.addEventListener?.('resize',X.onResize);
 const s=st();if(!s?.base?.tier){sitePicker();return;}
 X.R=scene3d(view);if(!X.R){X.cv=el('canvas','cq-plot-canvas',null,X.stage);}
 X.cam=frameCam(s.plot);X.view='build';if(X.R&&ctx.drive!==false){startDrive();X.view='drive';}input();render();}
function close(){if(!X)return;X.ctx.panel.classList.remove('cq-in-plot');root.removeEventListener?.('resize',X.onResize);if(X.onKey){root.removeEventListener?.('keydown',X.onKey);root.removeEventListener?.('keyup',X.onKey);}const R=X.R;if(X.tank)X.tank.parent?.remove(X.tank);if(R){R.sc.traverse(o=>{if(o.isMesh||o.isInstancedMesh){if(!o.geometry?.userData?.hfShared)o.geometry?.dispose?.();if(o.isInstancedMesh)o.dispose?.();}});for(const m of [R.wgeo,R.hgeo,R.tgeo])for(const gq of m.values())gq.dispose?.();}X.d.remove();X=null;}
function isOpen(){return !!X;}
const say=t=>{if(X){X.msg.textContent=t;X.msgAt=Date.now();}};
async function act(action,plot,label){if(!X||X.busy)return false;X.busy=true;say(label||'SENDING ORDER…');try{const ok=await X.ctx.view.requestAction(action,plot===undefined?{}:{plot});say(ok?(label?label.replace('…',' ✓'):'DONE'):(X?.ctx.view.authority?.error||'Online verification required.').replace(/^conquest: /,'').toUpperCase());if(ok&&X){X.place=null;X.sel=action==='plot-remove'?null:X.sel;}render();return ok;}finally{if(X)X.busy=false;}}
function endTour(){if(X?.tour){X.camFrom=camPose();X.camT=0;X.tour=null;}}
function setTab(m){if(!X)return;endTour();if(X.view==='drive'){X.camFrom=camPose();X.camT=0;X.view='build';}X.mode=m;X.place=null;X.draw=null;X.erase=null;if(m==='walls')X.sel=null;render();}
// ---- the sheet: snap per tab (remembered), PEEK while a blueprint is placed or walls are drawn, restored after ----
const freeH=()=>Math.max(160,(X?.d.clientHeight||600)-(X?.top?.offsetHeight||48));
const minPeek=()=>(X?.grab?.offsetHeight||34)+(X?.tabs?.offsetHeight||48)+50;   // handle + tabs + one row of content (5C review)
const busy=()=>!!X&&(!!X.place||X.mode==='walls'&&(!!X.draw||X.draft.length>0));
function snapNow(){if(!X)return 'half';if(X.visit)return X.visitSnap||'peek';if(X.view==='drive')return 'peek';if(X.busySnap)return X.busySnap;if(X.auto)return X.auto;return X.snapOf[X.mode]||'half';}
function updateAuto(){if(busy()){if(!X.busySnap)X.auto='peek';}else{X.auto=null;X.busySnap=null;}}
function sheetVar(px,animate){X.d.classList.toggle('cq-plot-dragging',!animate);X.d.style.setProperty('--cq-sheet',Math.round(px)+'px');}
// a short map (the sheet near FULL) hides the floating coach and map buttons: they never cover the handle or the tabs
function shortMap(px){if(!X)return;const st=freeH()-px;X.d.classList.toggle('cq-plot-short',st<150);}
function layout(){if(!X||!X.grab)return;X.d.classList.toggle('cq-plot-walls',X.mode==='walls');if(X.claim)return;const k=snapNow(),hs=root.ConquestSheet?root.ConquestSheet.heights(freeH(),minPeek()):{peek:120,half:Math.round(freeH()/2),full:Math.round(freeH()*.88)};
 X.sheetPx=hs[k];sheetVar(hs[k],true);shortMap(hs[k]);X.d.dataset.snap=k;X.grab.setAttribute('aria-label','Menu size '+k.toUpperCase()+': drag up or down, or tap to change');}

// first build: pick one of seven sites, then claim the plot (the existing first-base recipe)
function sitePicker(){const {el,button,view}=X.ctx,s=view.authority?.state,D=root.ConquestCombat.baseDefinition,L=s?.ledger;X.claim=true;X.d.classList.add('cq-plot-claim');X.title.textContent='CLAIM YOUR TOWN';X.chipPw.hidden=X.chipDef.hidden=true;X.stage.className='cq-plot-stage cq-plot-sites';
 el('p','cq-plot-intro','Your own private town. It grows with your Command Center (45×45 cells now, 77×77 at CC10). Pick its site: it shapes your economy and your whole defense. You can change it once for free.',X.stage);let pick='ridge';const cards=[];
 for(const id of P.SITE_IDS){const S=P.SITES[id],c=button('',()=>{pick=id;cards.forEach(x=>x.classList.toggle('on',x.dataset.site===id));},'cq-site-card');c.dataset.site=id;el('b','',S.name+' · '+S.lanes.length+' LANES',c);el('small','',S.bonus,c);if(id===pick)c.classList.add('on');cards.push(c);X.stage.append(c);}
 const need=s?.dev?.on?'DEV MODE · UNLIMITED · the claim costs nothing':Object.entries(D.recipe).map(([k,n])=>Math.min(n,k==='cp'?L?.cp||0:L?.banked?.[k]||0)+'/'+n+' '+LABEL[k]).join(' · ');el('p','cq-plot-need',need+' · you start with '+P.COMPOSITE.start+' wall composite',X.sheet);
 if(ownerUI()){const on=!!s?.dev?.on,box=el('div','cq-plot-dev',null,X.sheet);el('b','',on?'DEV MODE · UNLIMITED RESOURCES':'DEV MODE · OFF',box);el('small','','Owner only. Turning it on makes this a test record: no Conquest airdrop points, no rankings.',box);box.append(button(on?'TURN OFF':'TURN ON UNLIMITED',async()=>{if(X.busy)return;X.busy=true;let ok=false;try{ok=await view.requestAction(on?'dev-off':'dev-on');}finally{if(X)X.busy=false;}if(!X)return;if(!ok){say((view.authority?.error||'').replace(/^conquest: /,'').toUpperCase()||'ONLINE REQUIRED');return;}const ctx=X.ctx;close();open(ctx);},'cq-plot-primary'));}
 const claim=button('CLAIM PLOT · '+price(D.recipe),async()=>{if(X.busy)return;X.busy=true;try{const ok=await view.requestAction('build-base',{plot:{site:pick}});if(!X)return;if(!ok){say((view.authority?.error||'').replace(/^conquest: /,'').toUpperCase()||'ONLINE REQUIRED');return;}const ctx=X.ctx;close();open(ctx);say('TOWN CLAIMED · '+P.SITES[pick].name);}finally{if(X)X.busy=false;}},'cq-plot-primary');X.sheet.append(claim);}

// ------------------------------------------------------------------- UI --------------------------------------------------
// A closed section that keeps its open state across re-renders by a stable key (its title carries live numbers).
function fold(body,k,title,cls=''){const {el}=X.ctx,f=el('details','cq-map-fold'+(cls?' '+cls:''),null,body),sm=el('summary','',title,f);sm.dataset.k=k;return f;}
const townName=p=>p?.nm||(P.SITES[p?.site]?.name||'')+' TOWN';
function header(p,visit){X.title.textContent=(visit?'VISITING · ':'')+townName(p)+' · CC'+p.cc;const use=P.powerUse(p),sup=P.powerSupply(p);X.chipPw.hidden=X.chipDef.hidden=false;X.chipPw.textContent='⚡ '+use+'/'+sup+(use>sup?' !':'');X.chipPw.classList.toggle('short',use>sup);X.chipPw.setAttribute('aria-label','Power '+use+' used of '+sup+(use>sup?', short: build a Reactor':''));X.chipDef.textContent='🛡 DEF '+fmt(visit?.dr||P.defenseRating(p));}
// The coach floats on the map in every tab but HOME (where it is a card with a GO button); tapping it opens its tab.
function coachUi(g){const {el}=X.ctx,c=X.coach,show=!!g&&!X.drill&&!X.visit&&!X.tour&&!busy();/* hidden while placing or drawing: a tap near it must never switch tabs */c.hidden=!show;if(!show){X.coachKey='';return;}const key=g.k+g.text+X.mode;if(X.coachKey===key)return;X.coachKey=key;c.replaceChildren();el('b','cq-plot-step','STEP '+g.k+' OF '+g.n,c);el('span','',g.text,c);c.setAttribute('aria-label','Step '+g.k+' of '+g.n+': '+g.text);}
function render(){if(X?.visit){visitUi();return;}if(!X||!X.ctx.view.authority?.state?.plot)return;const {el,view}=X.ctx,s=view.authority.state,p=s.plot,L=s.ledger,now=Date.now(),sh=X.sheet;
 // keep what the pilot had open (closed sections, scroll) across a re-render; a designer in progress is only rebuilt by a state change
 const openNow=new Set([...sh.querySelectorAll('details[open]>summary')].map(x=>x.dataset.k||x.textContent)),scroll=sh.scrollTop;if(sh.childNodes.length)X.openFolds=openNow;
 header(p);const g=guideStep(p,s);X.coachStep=g;coachUi(g);X.tabs.hidden=false;
 const bv=X.view!=='drive';for(const [m] of TABS){const b=X.tabBtn[m],on=bv&&X.mode===m;b.classList.toggle('on',on);b.classList.toggle('cq-plot-glow',g?.tab===m&&!on);b.setAttribute('aria-selected',String(on));}
 sh.replaceChildren();const body=el('div','cq-plot-body',null,sh);
 const sel=X.mode!=='walls'&&!X.place&&X.sel&&p.b[X.sel];if(sel)selCard(body,s,p,X.sel,sel);
 if(X.mode==='home')homeTab(body,s,p,L,now,g);else if(X.mode==='build'||X.mode==='weapons')buildTab(body,s,p,L);else if(X.mode==='walls')wallTab(body,s,p);else defendTab(body,s,p);
 for(const d of sh.querySelectorAll('details')){const k=d.querySelector('summary')?.dataset.k;if(k&&X.openFolds?.has(k))d.open=true;}
 sh.scrollTop=X.place&&!X.wasPlace||X.sel&&X.sel!==X.wasSel?0:scroll;X.wasPlace=!!X.place;X.wasSel=X.sel;   // a new blueprint or selection: its card at the top, on screen
 updateAuto();fab(s,p);layout();if(X.R)driveUi();sync();}
// While drawing walls the map is big and the menu small: UNDO and CONFIRM float on the map so the primary action is always
// on screen (owner rule: primary actions stay on screen).
function fab(s,p){const {button}=X.ctx;if(!X.fab){X.fab=document.createElement('div');X.fab.className='cq-plot-fab';X.stage.append(X.fab);}X.fab.replaceChildren();
 // placing or moving a building: ROTATE, CANCEL and CONFIRM float on the map too (the sheet drops to PEEK while placing)
 if(X.place&&X.view!=='drive'){const q=X.place,err=q.id?P.placeError(p,q.type,q.i,q.j,q.r,q.id):(P.buildCheck(p,q.type,1)||P.placeError(p,q.type,q.i,q.j,q.r)),ok=button(q.id?'CONFIRM MOVE':'CONFIRM BUILD',()=>q.id?act('plot-move',{id:q.id,i:q.i,j:q.j,r:q.r},'MOVING…'):act('plot-build',{type:q.type,i:q.i,j:q.j,r:q.r},'CONSTRUCTION ORDERED…'),'cq-plot-primary');const why=err?'✕ '+err.toUpperCase().slice(0,28):!q.id&&p.job?'BUILDER BUSY · '+dur(p.job.ready-Date.now()):'';ok.disabled=!!why;if(why){ok.textContent=why;ok.classList.add('cq-plot-why');}ok.title=why||'';
  X.fab.append(button('↻',()=>{q.r=(q.r+1)%4;render();},'cq-plot-fab-rot'),button('CANCEL',()=>{X.place=null;render();}),ok);X.fab.lastChild.previousSibling.previousSibling.setAttribute('aria-label','Rotate');X.fab.hidden=false;return;}
 const plan=X.mode==='walls'?draftPlan(p):null;X.fab.hidden=!plan;if(!plan)return;
 const ok=button('CONFIRM WALLS · '+plan.cells.length,async()=>{if(await act('plot-wall',{s:X.draft.map(d=>d.sec)},'BUILDING WALLS…')&&X){X.draft=[];render();}},'cq-plot-primary');ok.disabled=!!plan.err;ok.title=plan.err||price(plan.cost);X.fab.append(button('↶ UNDO',()=>{X.draft.pop();render();}),ok);}
// Once a second: only the live numbers change (builder countdown, production), never the open sections or a designer in progress.
function tickUi(){if(!X||X.visit)return;const s=X.ctx.view.authority?.state,p=s?.plot;if(!p)return;const now=Date.now(),j=p.job,box=X.sheet.querySelector('.cq-plot-job:not(.cq-plot-damage)');
 if(j&&box){const b=box.querySelector('b'),pr=box.querySelector('progress');if(b)b.textContent=jobText(j,now);if(pr)pr.value=Math.max(0,Math.min(1,1-(j.ready-now)/Math.max(1,j.ready-j.at)));}
 const pe=X.sheet.querySelector('.cq-plot-prod span');if(pe)pe.textContent=prodText(p,now)||pe.textContent;if(X.place&&p.job)fab(s,p);   // BUILDER BUSY countdown on the floating button
 const dr=[...X.sheet.querySelectorAll('.cq-plot-primary')].find(b=>/CREWS RESET/.test(b.textContent));if(dr){const w=Math.max(0,(p.drillAt||0)+60000-now);if(w>0)dr.textContent='CREWS RESET · '+dur(w);else render();}}
function prodText(p,now){const q={...p,st:{...(p.st||{})}},st=P.accrue(q,now),c=P.caps(p),r=P.rates(p);   // live preview of the Worker's accrual on a copy
 const parts=['alloy','biomass','helium','fe'].filter(k=>r[k]>0||st[k]>0).map(k=>Math.floor(st[k]||0)+'/'+c[k]+' '+LABEL[k]+' (+'+(Math.round(r[k]*100)/100)+'/h)');
 if(c.fh)parts.push('COMPOSITE '+Math.floor(q.cm||0)+'/'+c.cm+(q.fh>=.25?' (+'+r.cm+'/h from '+Math.floor(q.fh*10)/10+' alloy loaded)':' (load alloy in the Foundry, WALLS tab)'));return parts.join(' · ');}
// Owner dev mode (owner only, server-verified; conquest.js DEV_ACTIONS): unlimited resources, composite, ores, extensions, instant builds.
function devBar(body,s,p){if(!ownerUI())return;const {el,button}=X.ctx,on=!!s.dev?.on,box=el('div','cq-plot-dev'+(on?' on':''),null,body);
 el('b','',on?'DEV · UNLIMITED · INSTANT BUILDS':'DEV MODE · OFF',box);box.append(button(on?'TURN OFF':'TURN ON',()=>act(on?'dev-off':'dev-on',undefined,on?'DEV MODE OFF…':'UNLIMITED ON…')));
 if(!on)el('small','','Owner only: unlimited resources, composite, ores and wall extensions, instant builds. Makes this a test record (no Conquest airdrop points, never ranked).',box);
 else if(p.job)box.append(button('FINISH NOW',()=>act('dev-finish',undefined,'FINISHING…')));}
function resLine(el,parent,s,p){if(s.dev?.on){el('p','cq-plot-res cq-plot-dev-res','BANKED · ∞ UNLIMITED (DEV MODE) · COMPOSITE ∞ · ORES ∞',parent);return {stores:'∞'};}const L=s.ledger,o=storesOf(s,p),stores=P.MNS.filter(k=>o[k]>0).map(k=>o[k]+' '+LABEL[k]).join(' · ');
 el('p','cq-plot-res','BANKED · '+fmt(L.cp)+' CP · '+fmt(L.banked.alloy)+' ALLOY · '+fmt(L.banked.biomass)+' BIOMASS · '+fmt(L.banked.helium)+' HELIUM-3',parent);el('p','cq-plot-res','WALL COMPOSITE · '+fmt(Math.floor(p.cm||0))+' · BASE STORES · '+(stores||'empty (ore blends use minerals from here)'),parent);return {stores};}
const jobName=j=>j.t==='cc'?'Command Center':j.t==='repair'?'Repairs':P.BUILDINGS[j.t]?.n||j.t;
const jobText=(j,now)=>'BUILDER · '+jobName(j).toUpperCase()+(j.t==='repair'?'':' '+romanOf(j.l))+' · '+dur(j.ready-now);
function jobCard(body,p,now){const j=p.job;if(!j)return;const {el}=X.ctx,box=el('div','cq-plot-job',null,body);el('b','',jobText(j,now),box);const pr=el('progress','',null,box);pr.max=1;pr.value=Math.max(0,Math.min(1,1-(j.ready-now)/Math.max(1,j.ready-j.at)));pr.setAttribute('aria-label','Construction progress');}
const multOf=p=>(root.CQ_BASE_MULT||[1,1.05,1.1,1.15,1.2,1.25])[P.tierOf(p.cc)]||1;
// HOME: one status card (CC, site, power bar, defense rating, production + COLLECT, builder, damage + REPAIR ALL and the
// base terminal's three buttons), the coach step, then closed sections. The old BASE TERMINAL fold is gone.
function homeTab(body,s,p,L,now,g){const {el,button}=X.ctx;devBar(body,s,p);statusCard(body,s,p,L,now);
 if(g){const c=el('div','cq-plot-coachcard',null,body);el('b','cq-plot-step','STEP '+g.k+' OF '+g.n,c);el('span','',g.text,c);if(g.tab!=='home')c.append(button('GO TO '+tabName(g.tab),()=>setTab(g.tab),'cq-plot-primary'));else if(g.id==='cc')c.append(button('SELECT THE COMMAND CENTER',()=>{X.sel='cc';render();},'cq-plot-primary'));}
 else if(!X.sel)el('p','cq-plot-hint','Tap a building on the map to upgrade or move it. One finger pans, two fingers pinch to zoom, ⌖ frames the town.',body);
 const look=fold(body,'look','TOWN LOOK · BANNER, LIGHTS, DECORATIONS, SHARE');look.ontoggle=()=>{if(look.open&&!look.dataset.built){look.dataset.built='1';nameRow(look,p);designer(look,p);look.append(button('SHARE MY TOWN',()=>shareCard(s,p)));}};
 const vis=fold(body,'visit','VISIT TOWNS · TOP 20, SQUAD, BASE OF THE WEEK');vis.ontoggle=()=>{if(vis.open&&!vis.dataset.built){vis.dataset.built='1';visitList(vis);}};
 if(P.STORE.checkout){const shop=fold(body,'store','STORE · CAPACITY, COSMETICS AND TIME');storeList(shop);}else if(ownerUI()){const shop=fold(body,'store','STORE PREVIEW · OWNER ONLY · CHECKOUT OFF');storeList(shop);}}   // the store stays hidden from players until payments are enabled
// Name your town (5C): up to 16 characters; the Worker validates it (and its profanity list); shown on the HOME card, the
// header, visits, the hub and the share card.
function nameRow(box,p){const {el,button}=X.ctx,r=el('div','cq-plot-name',null,box);el('small','','TOWN NAME · up to '+P.TOWN_NAME_MAX+' letters, numbers, spaces',r);const row=el('div','cq-plot-row',null,r),inp=document.createElement('input');inp.type='text';inp.maxLength=P.TOWN_NAME_MAX;inp.value=p.nm||'';inp.placeholder=townName({...p,nm:''});inp.setAttribute('aria-label','Town name');inp.className='cq-plot-input';inp.autocomplete='off';inp.spellcheck=false;row.append(inp);
 const msg=el('small','',' ',r);inp.oninput=()=>{const t=P.townName(inp.value);msg.textContent=t.err?'✕ '+t.err.toUpperCase():' ';};
 row.append(button('SAVE NAME',()=>{const t=P.townName(inp.value);if(t.err){msg.textContent='✕ '+t.err.toUpperCase();return;}act('plot-name',{n:t.name},'NAMING YOUR TOWN…');},'cq-plot-primary'));}
function statusCard(body,s,p,L,now){const {el,button}=X.ctx,box=el('div','cq-plot-status',null,body),use=P.powerUse(p),sup=P.powerSupply(p),mult=multOf(p),site=P.SITES[p.site];
 const hd=el('div','cq-plot-status-head',null,box);hd.append(sprite('b','cc',p.cc));const t=el('div','cq-plot-status-name',null,hd);el('b','',townName(p)+' · CC'+p.cc,t);el('small','',site.name+(mult>1?' · points ×'+mult.toFixed(2):'')+' · TOWN SCORE '+fmt(p.power||P.power(p)),t);
 const pw=el('div','cq-plot-meter'+(use>sup?' short':''),null,box);el('span','','⚡ POWER',pw);const m=el('meter','',null,pw);m.min=0;m.max=Math.max(1,sup);m.value=Math.min(use,Math.max(1,sup));m.setAttribute('aria-label','Power used '+use+' of '+sup);el('small','',use+' / '+sup+(use>sup?' · SHORT':''),pw);
 el('small','cq-plot-defline','🛡 DEFENSE RATING '+fmt(P.defenseRating(p))+' · TURRETS '+P.turretCount(p)+'/'+P.TURRET_CAP[p.cc-1]+' · WALLS '+Object.keys(p.w).length,box);
 const prod=el('div','cq-plot-prod',null,box);el('b','','PRODUCTION · stops when the store is full',prod);el('span','',prodText(p,now)||'Build a Refinery, Biodome or Helium Extractor to produce.',prod);
 const stq=P.accrue({...p,st:{...(p.st||{})}},now);if(['alloy','biomass','helium','fe'].some(k=>(stq[k]||0)>=1))prod.append(button('COLLECT PRODUCTION',()=>act('plot-collect',{},'COLLECTING…'),'cq-plot-primary'));
 jobCard(box,p,now);damageCard(box,s,p);const row=el('div','cq-plot-row cq-plot-terminal',null,box);X.ctx.terminal?.(row);if(!row.childNodes.length)row.remove();}
// Raid damage persists (owner addendum): what is damaged, and one REPAIR order (composite for walls, alloy/CP for buildings, builder time).
function damageCard(body,s,p){const plan=P.repairPlan(p);if(!plan.keys.length)return;const {el,button}=X.ctx,box=el('div','cq-plot-job cq-plot-damage',null,body),ruinedN=plan.keys.filter(k=>P.ruined(p,k)).length;
 el('b','','RAID DAMAGE · '+plan.keys.length+' STRUCTURES'+(ruinedN?' ('+ruinedN+' ruined: no output until repaired)':''),box);const b=button(p.job?'BUILDER BUSY':'REPAIR ALL · '+(devOn()?'FREE':price(plan.cost))+' · '+dur(plan.ms),()=>act('plot-repair',{},'REPAIRING…'),'cq-plot-primary');b.disabled=!!p.job;box.append(b);}
// Layout slots: save the town as it stands, switch back in one tap (buildings and walls move; nothing is rebuilt or charged).
function layoutFold(body,s,p){const {el,button}=X.ctx,stored=Object.values(p.ws||{}).reduce((a,n)=>a+(n|0),0),f=fold(body,'layouts','TOWN LAYOUTS · '+P.LAYOUT.slots+' SLOTS'+(stored?' · '+stored+' WALLS IN STORAGE':''));
 el('small','','Save walls, turrets and vitals positions; APPLY moves everything in one tap. Nothing is rebuilt or charged: walls move as a stock of cells by blend, and cells a layout has no room for wait in storage (place them again for free with the wall tools).'+(Object.keys(p.dmg||{}).length?' Repair your town before switching.':''),f);
 for(let k=0;k<P.LAYOUT.slots;k++){const L=p.lay?.['s'+k],row=el('div','cq-plot-row',null,f);el('small','',String.fromCharCode(65+k)+' · '+(L?'CC'+L.cc+', '+Math.floor((L.w||'').length/4)+' walls, saved '+new Date(L.at).toLocaleDateString():'empty'),row);
  row.append(button('SAVE '+String.fromCharCode(65+k),()=>act('plot-layout',{op:'save',k},'SAVING LAYOUT…')));const ap=button('APPLY '+String.fromCharCode(65+k),()=>act('plot-layout',{op:'apply',k},'SWITCHING LAYOUT…'),'cq-plot-primary');ap.disabled=!L;row.append(ap);}}
// Raid protection (hooks used by player raids later): loot protection, peace shield, garrison slots, attack alerts.
function raidFold(body,s,p){const {el}=X.ctx,L=P.loot(p),sh=Math.max(0,(p.shieldUntil||0)-Date.now()),f=fold(body,'raid','RAID PROTECTION · SHIELD, GARRISON, ALERTS');
 el('small','','Player raids are coming. Banked goods are never raidable. Your Storage Depot protects '+Math.round(L.protect*100)+'% of the production store and composite; raidable now: '+(['alloy','biomass','helium','cm'].filter(k=>L.raidable[k]>0).map(k=>L.raidable[k]+' '+LABEL[k]).join(' · ')||'nothing')+'.',f);
 el('small','',(sh?'PEACE SHIELD · '+dur(sh)+' left (no new raids)':'PEACE SHIELD · none (a raided town gets a timed shield)')+' · GARRISON · '+(p.gar?.n||P.garrisonSlots(p))+' Hangar slots for defending tanks',f);
 const al=(p.alerts||[]).slice(0,3);el('small','',al.length?'ALERTS · '+al.map(e=>new Date(e.at).toLocaleTimeString()+' '+String(e.kind).toUpperCase()+' by '+e.by+': '+String(e.outcome).toUpperCase()).join(' · '):'ALERTS · none yet',f);}
// Foundry (composite), its research and the wall extensions: wall tooling, so it lives in WALLS (closed until needed).
function foundryFold(body,s,p){const {el,button}=X.ctx,c=P.caps(p),ex=P.extParts(p,devOn()),fd=fold(body,'foundry','FOUNDRY · COMPOSITE '+fmt(Math.floor(p.cm||0))+' · WALL EXTENSIONS +'+ex.total+'%','cq-plot-foundry');
 if(!c.fh){el('small','','Build a Foundry (BUILD tab, unlocks at CC2): load alloy and it turns it into wall composite ('+P.COMPOSITE.perAlloy+' per alloy, '+P.COMPOSITE.rate+'/h per level).',fd);}
 else{const room=Math.max(0,Math.floor(c.fh-(p.fh||0)));el('small','','HOPPER · '+(Math.floor((p.fh||0)*10)/10)+'/'+c.fh+' alloy loaded → '+P.COMPOSITE.perAlloy+' composite each · STOCK '+Math.floor(p.cm||0)+'/'+c.cm,fd);
  const row=el('div','cq-plot-row',null,fd);for(const n of [10,30])row.append(button('LOAD '+n+' ALLOY',()=>act('plot-feed',{n},'LOADING THE FOUNDRY…')));row.append(button('LOAD ALL',()=>act('plot-feed',{n:Math.max(1,Math.min(room,Math.floor(s.ledger.banked.alloy||0)))},'LOADING THE FOUNDRY…')));for(const b of row.children)b.disabled=room<1;
  const k=p.ext?.r|0,step=P.EXT.research[k];if(step){const lock=P.levelOf(p,'foundry')<step.fl,b=button((lock?'LOCKED · FOUNDRY '+romanOf(step.fl)+' · ':'')+'RESEARCH REINFORCED LATTICE '+romanOf(k+1)+' · +'+step.pct+'% WALL CAPACITY · '+price(step.cost),()=>act('plot-research',{},'RESEARCHING…'),'cq-plot-primary');b.disabled=lock;fd.append(b);
   const short=!lock&&storesShort(s,p,step.cost);if(short)fd.append(button('MOVE '+price(short)+' TO BASE STORES',()=>moveStores(short)));}else el('small','','All Foundry research done.',fd);}
 el('small','','WALL EXTENSIONS (up to +'+P.EXT.max+'% of your level\'s base cap): research +'+ex.research+'% · drill milestones +'+ex.drill+'% · base defenses +'+ex.defense+'%'+(ex.bought?' · bought +'+ex.bought+'%':'')+(ex.dev?' · DEV +'+ex.dev+'%':'')+'. Hold a Defense Drill at CC'+P.EXT.drill.map(m=>m.cc).join('/')+' (+'+P.EXT.drill[0].pct+'% each); win 3 and 10 real base defenses (+5% each).',fd);}
function selCard(body,s,p,id,b){const {el,button}=X.ctx,isCC=b.t==='cc',mult=multOf(p),B=isCC?{n:'Command Center',desc:'Gates every unlock and the town size'+(mult>1?'; your Conquest points ×'+mult.toFixed(2):'')+'. '+VITAL_DEF}:P.BUILDINGS[b.t],l=isCC?p.cc:b.l,box=el('div','cq-plot-sel',null,body);
 const hd=el('div','cq-plot-status-head',null,box);hd.append(sprite(B.turret?'t':'b',b.t,Math.max(1,l)));el('b','',B.n.toUpperCase()+' '+(isCC?'CC'+l:romanOf(l))+(P.VITALS[b.t]?' · ◆ VITAL':''),hd);
 const hpL=P.hpLeft(p,id),hpM=P.maxHpOf(p,id);if(hpL<hpM)el('small','cq-plot-vital-lost',(hpL<=0?'RUINED · output cut until repaired':'DAMAGED')+' · '+fmt(hpL)+'/'+fmt(hpM)+' HP',box);el('small','',B.desc+(B.turret?' Range '+Math.round(B.turret.range*P.SITES[p.site].range*(1+.04*(l-1)))+' m.':'')+(B.prod?' Produces '+Object.entries(B.prod).map(([k,v])=>Math.round(v*Math.max(1,l)*100)/100+' '+LABEL[k]+'/h').join(', ')+'.':''),box);
 const nl=l+1,err=P.buildCheck(p,isCC?'cc':b.t,nl,isCC?null:id),cost=nl<=(isCC?P.CC.max:B.max)?P.costOf(isCC?'cc':b.t,nl):null;
 if(cost){const up=button((err?'LOCKED · '+err.toUpperCase():'UPGRADE TO '+(isCC?'CC'+nl:romanOf(nl))+' · '+(devOn()?'FREE · INSTANT':price(cost)+' · '+dur(P.timeOf(isCC?'cc':b.t,nl)))),()=>act('plot-upgrade',{id},'UPGRADING…'),'cq-plot-primary');up.disabled=!!err||!!p.job;box.append(up);if(isCC&&!err)el('small','','CC'+nl+': the town grows to '+P.townSide(nl)+'×'+P.townSide(nl)+' cells, '+P.wallBase(nl)+' walls, '+P.TURRET_CAP[nl-1]+' turrets.',box);const short=!err&&storesShort(s,p,cost);if(short)box.append(button('MOVE '+price(short)+' TO BASE STORES',()=>moveStores(short)));}else el('small','','MAXIMUM LEVEL',box);
 const row=el('div','cq-plot-row',null,box);row.append(button('MOVE / ROTATE',()=>{X.mode=WEAPON_SET.has(b.t)?'weapons':'build';X.sel=null;X.place={type:b.t,id,i:b.i,j:b.j,r:b.r|0};render();}),button('CLOSE',()=>{X.sel=null;render();}));
 if(!['cc','storage'].includes(b.t)){const rm=button(B.turret?'REMOVE (50% OF ITS COST BACK)':'REMOVE (no refund)',()=>{if(rm.dataset.sure){act('plot-remove',{id},'REMOVING…');}else{rm.dataset.sure='1';rm.textContent='TAP AGAIN TO REMOVE';}},'cq-plot-danger');box.append(rm);}}
// BUILD = economy and support buildings; WEAPONS = the eleven turrets, the Gate and the Shield Generator.
const ECON=['refinery','storage','reactor','foundry','biodome','helium','uplink'],SUPPORT=['hangar','radar','lab','trophy'],WEAPON_SET=new Set([...P.TURRETS,'gate','shield']);
const ROLE={vault:'STORES',hangar:'REPAIRS HULL',radar:'LONGER SCAN',defense:'LESS DAMAGE',uplink:'+YIELD CP'};
function roleOf(k,B){if(B.turret)return B.role;if(B.power)return '+'+B.power+' ⚡ POWER';if(B.prod)return Object.entries(B.prod).map(([r,v])=>'+'+v+' '+(LABEL[r]||r).toUpperCase()+'/H').join(' ');if(k==='foundry')return 'COMPOSITE';if(k==='lab')return 'RESEARCH';if(k==='trophy')return 'TROPHIES';if(B.gate)return 'OPENS';return ROLE[B.mod]||'';}
// What a turret does, in words (no hidden numbers): range, rate, hit size, area.
function weaponWords(t,p){const hit=t.dmg*(t.salvo||1),rate=t.rof<.3?'RAPID FIRE':t.rof<1.6?'STEADY FIRE':t.rof<3.8?'SLOW FIRE':'VERY SLOW FIRE',size=hit<15?'LIGHT HITS':hit<70?'MEDIUM HITS':hit<200?'HEAVY HITS':'HUGE HITS',area=t.chain?'CHAINS':t.line?'PIERCES A LINE':t.cone?'CONE':t.splash?'AREA':'';
 return 'RANGE '+Math.round(t.range*(P.SITES[p?.site]?.range||1))+' m · '+rate+' · '+size+(area?' · '+area:'')+(t.ground?' · GROUND ONLY':'')+(t.airFirst?' · AIR FIRST':'');}
function startPlace(p,k){const at=P.autoPlace(p,k)||{i:37,j:37,r:0};X.place={type:k,...at};X.sel=null;X.cam.x=P.cellX(at.i);X.cam.z=P.cellZ(at.j);render();}
// One full-width card per building: model sprite, name, role tag, description or stats, cost and time.
function card(box,p,k,B,o={}){const {el,button}=X.ctx,c=button('',()=>{if(!o.lock)startPlace(p,k);},'cq-plot-card'+(o.glow?' cq-plot-glow':'')+(o.lock?' cq-plot-locked':''));
 const head=el('span','cq-plot-card-head',null,c);head.append(sprite(B.turret?'t':'b',k,1));el('b','',B.n,head);el('span','cq-plot-tag',o.lock?'CC'+B.cc:(B.vital?'◆ VITAL · ':'')+roleOf(k,B),head);
 if(!o.lock)el('small','cq-plot-desc',B.desc||'',c);if(o.extra)el('small','cq-plot-statline',o.extra,c);
 el('small','cq-plot-cost',o.lock?'UNLOCKS AT CC'+B.cc:(o.err?'✕ '+o.err.toUpperCase():o.dev?'FREE · INSTANT':price(B.cost[0])+' · '+dur(P.timeOf(k,1)))+' · SIZE '+B.w+'×'+B.d+(B.pw?' · USES ⚡'+B.pw:''),c);c.disabled=!!o.err||!!o.lock;if(o.lock)c.setAttribute('aria-label',B.n+': unlocks at CC'+B.cc);box.append(c);return c;}
function placePanel(body,s,p){const {el,button}=X.ctx,q=X.place,B=q.type==='cc'?{n:'Command Center'}:P.BUILDINGS[q.type],err=q.id?P.placeError(p,q.type,q.i,q.j,q.r,q.id):(P.buildCheck(p,q.type,1)||P.placeError(p,q.type,q.i,q.j,q.r));
 // the primary action first, so it stays on screen even with the bigger map (owner rule: every screen fits or scrolls)
 // ROTATE, CANCEL and CONFIRM float on the map (fab), so the primary action is on screen at every sheet height
 el('b','',(q.id?'MOVE · ':'PLACE · ')+B.n.toUpperCase()+(P.VITALS[q.type]?' · ◆ VITAL':''),body);el('small','',err?'✕ '+err.toUpperCase():'✓ VALID · tap the ground to move the blueprint'+(q.id?'':' · '+(devOn()?'FREE · INSTANT':price(P.costOf(q.type,1))+' · '+dur(P.timeOf(q.type,1)))),body);
 if(!q.id&&p.job)el('small','','The builder is busy: '+jobText(p.job,Date.now()),body);if(P.VITALS[q.type])el('small','',VITAL_DEF+' Spread them out for coverage, or keep them behind your strongest walls.',body);}
function buildTab(body,s,p,L){const {el}=X.ctx;if(X.place){placePanel(body,s,p);return;}const g=guideStep(p,s),dev=devOn();resLine(el,body,s,p);jobCard(body,p,Date.now());
 if(X.mode==='weapons'){weaponsTab(body,s,p,g,dev);return;}
 for(const [title,keys] of [['ECONOMY · makes and stores resources',ECON],['SUPPORT · repairs, scanning, research',SUPPORT]]){const items=keys.filter(k=>p.cc>=P.BUILDINGS[k].cc&&P.countOf(p,k)<P.countCap(k,p.cc));if(!items.length)continue;el('b','cq-plot-group',title,body);const box=el('div','cq-plot-list',null,body);
  for(const k of items)card(box,p,k,P.BUILDINGS[k],{err:P.buildCheck(p,k,1),glow:g?.id===k,dev});}
 const locked=[...ECON,...SUPPORT].filter(k=>P.BUILDINGS[k].cc>p.cc).sort((a,b)=>P.BUILDINGS[a].cc-P.BUILDINGS[b].cc);if(locked.length){el('b','cq-plot-group','LOCKED · UNLOCK WITH THE COMMAND CENTER',body);const box=el('div','cq-plot-list',null,body);for(const k of locked)card(box,p,k,P.BUILDINGS[k],{lock:true});}
 if(![...ECON,...SUPPORT].some(k=>p.cc>=P.BUILDINGS[k].cc&&P.countOf(p,k)<P.countCap(k,p.cc)))el('p','cq-plot-hint','Every building available at CC'+p.cc+' is placed: tap one on the map to upgrade it.',body);
 el('p','cq-plot-next',unlockLine(p),body);}
function weaponsTab(body,s,p,g,dev){const {el}=X.ctx,cap=P.TURRET_CAP[p.cc-1],n=P.turretCount(p),keys=[...WEAPON_SET].sort((a,b)=>P.BUILDINGS[a].cc-P.BUILDINGS[b].cc),by={};for(const b of Object.values(p.b))if(P.BUILDINGS[b.t]?.turret)by[b.t]=(by[b.t]||0)+1;
 const sum=el('div','cq-plot-weapsum',null,body);el('b','','TURRETS '+n+'/'+cap+(n>=cap?' · CAP REACHED (the Command Center raises it)':''),sum);const chips=el('div','cq-plot-wchips',null,sum);
 for(const k of keys)if(by[k]){const chip=el('span','cq-plot-wchip',null,chips);chip.append(sprite('t',k,1));el('small','',by[k]+'× '+P.BUILDINGS[k].n.replace(/ Turret$/,'').toUpperCase(),chip);}
 if(!n)el('small','','No turrets yet: a Cannon is the best first pick.',sum);
 const box=el('div','cq-plot-list',null,body);for(const k of keys.filter(k=>P.BUILDINGS[k].cc<=p.cc)){const B=P.BUILDINGS[k],placed=P.countOf(p,k);card(box,p,k,B,{err:P.buildCheck(p,k,1),glow:g?.id==='cannon'&&k==='cannon',dev,extra:(B.turret?weaponWords(B.turret,p)+' · '+placed+' PLACED':(B.gate?'Opens for your tanks; raiders must break it':'Protective field: less damage at your base')+' · '+placed+'/'+P.countCap(k,p.cc)+' PLACED')});}
 const locked=keys.filter(k=>P.BUILDINGS[k].cc>p.cc);if(locked.length){el('b','cq-plot-group','LOCKED · UNLOCK WITH THE COMMAND CENTER',body);const lb=el('div','cq-plot-list',null,body);for(const k of locked){const B=P.BUILDINGS[k];card(lb,p,k,B,{lock:true,extra:B.turret?B.role+' · '+weaponWords(B.turret,p):''});}}}
// ---- walls: blend picker first, then the tools; draft (undo) and confirm; Foundry and layouts (wall tooling) ----
const SOFT={COMPOSITE:'COMPO\u00adSITE',ILMENITE:'ILMEN\u00adITE',ARMALCOLITE:'ARMAL\u00adCOLITE',TRANQUILLITYITE:'TRANQUIL\u00adLITYITE',SELENITE:'SELEN\u00adITE',MOONHEART:'MOON\u00adHEART'};   // soft hyphens: two clean lines at 320 px
const TOOLS=[['line','LINE','drag: a solid straight wall'],['rect','RECT','drag corner to corner: a rectangle'],['ring','RING','drag from the centre outward: a ring'],['erase','ERASE','drag over walls to remove them'],['copy','COPY','drag a box over walls to copy them'],['paste','PASTE','tap to paste the copied walls']];
function draftPlan(p){return X.draft.length?P.wallPlan(p,X.draft.map(d=>d.sec),{dev:devOn()}):null;}
function wallTab(body,s,p){const {el,button}=X.ctx,dev=devOn(),cap=P.wallCapOf(p,dev),base=P.wallBase(p.cc),n=Object.keys(p.w).length,plan=draftPlan(p);
 const stor=Object.values(P.stockOf(p)).reduce((a,v)=>a+v,0);el('b','cq-plot-wallcount','WALLS '+n+(stor?' (+'+stor+' STORED)':'')+(plan?.fresh?' + '+plan.fresh:'')+' / '+base+(cap>base?' (+EXT '+(cap-base)+')':'')+' · COMPOSITE '+(dev?'∞':fmt(Math.floor(p.cm||0))),body);
 // first row (5C review): LINE · RECT · RING · ERASE · MORE, usable at PEEK where walls are drawn; the blend picker follows
 const tr=el('div','cq-plot-row cq-plot-tools',null,body),more=X.moreTools||X.tool==='copy'||X.tool==='paste';for(const [id,lab,tip] of TOOLS.slice(0,4)){const b=button(lab,()=>{X.tool=id;X.draw=null;X.erase=null;render();},X.tool===id?'on':'');b.title=tip;b.setAttribute('aria-pressed',String(X.tool===id));tr.append(b);}
 const mb=button(more?'LESS':'MORE',()=>{X.moreTools=!more;if(more&&(X.tool==='copy'||X.tool==='paste'))X.tool='ring';render();});mb.setAttribute('aria-expanded',String(more));tr.append(mb);
 if(more){const r2=el('div','cq-plot-row cq-plot-tools',null,body);for(const [id,lab,tip] of TOOLS.slice(4)){const b=button(lab,()=>{X.tool=id;X.draw=null;render();},X.tool===id?'on':'');b.title=tip;b.setAttribute('aria-pressed',String(X.tool===id));if(id==='paste')b.disabled=!X.clip;r2.append(b);}}
 // the draft and its CONFIRM come first when there is one (primary action on screen); it also floats on the map
 if(plan){const sk=plan.skip,skipped=sk.outside+sk.blocked+sk.occupied+sk.same,box=el('div','cq-plot-draft',null,body);
  el('b','',X.draft.length+' SECTION'+(X.draft.length>1?'S':'')+' · '+plan.cells.length+' CELLS'+(skipped?' ('+skipped+' skipped: '+[sk.same&&sk.same+' same',sk.occupied&&sk.occupied+' buildings',sk.blocked&&sk.blocked+' blocked',sk.outside&&sk.outside+' outside'].filter(Boolean).join(', ')+')':''),box);
  el('small','',plan.err?'✕ '+plan.err.toUpperCase():'COST · '+(dev?'FREE (DEV MODE)':price(plan.cost)||'nothing'),box);
  const r=el('div','cq-plot-row',null,box);r.append(button('↶ UNDO',()=>{X.draft.pop();render();}),button('CLEAR',()=>{X.draft=[];render();}));const ok=button('CONFIRM WALLS',async()=>{if(await act('plot-wall',{s:X.draft.map(d=>d.sec)},'BUILDING WALLS…')&&X){X.draft=[];render();}},'cq-plot-primary');ok.disabled=!!plan.err;r.append(ok);
  const short=!plan.err&&storesShort(s,p,plan.cost);if(short)box.append(button('MOVE '+price(short)+' TO BASE STORES',()=>moveStores(short)));
  if(!dev&&(plan.cost.cm||0)>Math.floor(p.cm||0))el('small','','Not enough composite: load alloy in the FOUNDRY section below.',box);}
 if(X.tool==='erase'&&X.erase){const m=X.erase;el('b','',m.keys.length+' WALL CELLS SELECTED · '+P.wallRefund(m.keys.length)+' composite comes back (50%; the ore does not)',body);const r=el('div','cq-plot-row',null,body);r.append(button('CANCEL',()=>{X.erase=null;render();}));const rm=button('REMOVE '+m.keys.length+' WALLS',()=>{if(rm.dataset.sure){act('plot-remove',{w:[m.sec]},'REMOVING WALLS…').then(ok=>{if(ok&&X)X.erase=null;});}else{rm.dataset.sure='1';rm.textContent='TAP AGAIN TO REMOVE '+m.keys.length;}},'cq-plot-danger');r.append(rm);}
 if(X.tool!=='erase'&&X.tool!=='copy'){// the blend picker: big swatches with the ore's full name, level, live stats
  const st=storesOf(s,p),bp=el('div','cq-plot-blend',null,body),ores=el('div','cq-plot-ores',null,bp);
  for(let o=0;o<=6;o++){const m=P.ORES[o-1],lock=p.cc<P.ORE_CC[o],look=ORE_LOOK[o],name=o?P.ORE_NAME[m]:'Composite',b=button('',()=>{X.blend={o,l:o?(X.blend.l||1):0};render();},'cq-plot-ore'+(X.blend.o===o?' on':''));b.style.setProperty('--ore',hex(look[0]));b.style.setProperty('--acc',hex(look[1]));
   b.append(sprite('w',String(o),o?2:0));el('span','',(SOFT[name.toUpperCase()]||name.toUpperCase()),b);el('small','',lock?'CC'+P.ORE_CC[o]:o?(dev?'∞':st[m]+' in stores'):(dev?'∞':Math.floor(p.cm||0)+' composite'),b);b.disabled=lock;b.setAttribute('aria-pressed',String(X.blend.o===o));b.setAttribute('aria-label',(o?P.ORE_NAME[m]+' blend':'Composite only')+(lock?' (unlocks at CC'+P.ORE_CC[o]+')':''));ores.append(b);}
  if(X.blend.o){const lv=el('div','cq-plot-row cq-plot-levels',null,bp);for(let l=1;l<=3;l++){const b=button(P.BLEND_NAME[l],()=>{X.blend.l=l;render();},X.blend.l===l?'on':'');b.setAttribute('aria-pressed',String(X.blend.l===l));lv.append(b);}}}
 el('small','cq-plot-tooltip',(TOOLS.find(t=>t[0]===X.tool)||TOOLS[0])[2].toUpperCase()+' · two fingers (or ✥) pan the map',body);
 if(!plan&&X.tool!=='erase'&&X.tool!=='copy')el('p','cq-plot-hint','Draw on the map: sections collect, ↶ UNDO takes the last one back, CONFIRM builds them all at once.',body);
 if(X.tool==='copy'||X.tool==='paste')el('small','',X.clip?'COPIED '+X.clip.cells.length+' wall cells. PASTE, then tap where the top-left corner goes.':'COPY: drag a box over walls you built.',body);
 if(X.tool!=='erase'&&X.tool!=='copy'){const code=P.wcode(X.blend.o,X.blend.l),w=P.wallStats(code,p.site),bars=el('div','cq-plot-stats',null,body),best=P.wallStats(19,p.site);
  for(const [lab,v,mx,txt] of [['STRENGTH',w.hp,best.hp,fmt(w.hp)+' HP'],['DURABILITY',w.dr,.4,Math.round(w.dr*100)+'% less damage'],['REFLECT',w.refl,.35,Math.round(w.refl*100)+'% bounced back']]){const r=el('div','cq-plot-stat',null,bars);el('span','',lab,r);const m=el('meter','',null,r);m.min=0;m.max=mx;m.value=v;el('small','',txt,r);}
  const per=X.blend.o?P.ORE_UNITS[X.blend.o]*P.BLEND_UNITS[X.blend.l]/40:0;el('small','',P.blendName(code).toUpperCase()+' · a cell: 1 composite'+(per?' + '+(per>=1?per:'1 per '+Math.round(1/per)+' cells of')+' '+P.ORE_NAME[P.ORES[X.blend.o-1]]:'')+(X.blend.o>=3?' · rare ores are earn-only':''),body);}
 foundryFold(body,s,p);layoutFold(body,s,p);}
function storesShort(s,p,cost){if(s?.dev?.on)return null;const o2=storesOf(s,p),o={};for(const k of P.MNS)if(cost[k]&&o2[k]<cost[k])o[k]=cost[k]-o2[k];return Object.keys(o).length?o:null;}
async function moveStores(mn){if(typeof baseStore!=='function'){say('UPDATE THE GAME TO MOVE MINERALS');return;}say('MOVING MINERALS FROM YOUR WALLET…');const ok=await baseStore(mn);say(ok?'MINERALS IN BASE STORES':'NOT MOVED');render();}
// DEFEND: the Defense Drill (the one defense system), its report and breach tips, the base log and raid protection.
function defendTab(body,s,p){const {el,button}=X.ctx;el('p','cq-plot-hint','A practice raid on your whole town at threat '+p.cc+' ('+P.SITES[p.site].lanes.length+' lanes). Raiders path to your Command Center through the weakest wall and hit everything on the way; the raid wins if the Command Center falls. Drills never pay rewards and never damage your town.',body);
 const wait=Math.max(0,(p.drillAt||0)+60000-Date.now()),b=button(X.drill?'DRILL RUNNING…':wait?'CREWS RESET · '+dur(wait):'START DEFENSE DRILL',async()=>{if(await act('plot-drill',{},'DRILL CREWS DEPLOYING…'))startReplay();},'cq-plot-primary');b.disabled=!!X.drill||!!X.simulating||wait>0;body.append(b);
 if(X.drillResult){const r=X.drillResult,name=t=>t==='cc'?'Command Center':P.BUILDINGS[t]?.n||t,box=el('div','cq-plot-report',null,body);
  const L=r.log&&r.log.seed===r.seed?r.log:null,same=!L||L.outcome===r.outcome&&L.kills===r.kills,o=L?L.outcome:r.outcome;   // the Worker's log is the result; the phone's replay is the picture
  el('b','cq-plot-result '+o,(o==='breached'?'COMMAND CENTER FELL · RAID WON':o==='repelled'?'REPELLED':'HELD')+' · '+(L?L.kills:r.kills)+'/'+(L?L.spawned:r.spawned)+' PARASITES DOWN · COMMAND CENTER '+(L?L.core:r.core)+'%',box);
  const vit=L?(L.vitals||[]):r.vitals,br=L?L.breaches|0:r.breaches.length;el('small','','BREACHES · '+(br?br+' ('+(L?L.walls|0:r.wallsLost)+' wall cells lost; red rings on the map)':'none')+' · HOMES LOST '+(L?L.homes|0:r.homesLost)+(same&&r.power<100?' · POWER '+r.power+'%':''),box);
  if(vit.length)el('small','cq-plot-vital-lost','◆ VITALS LOST · '+vit.map(t=>name(t)+': '+(P.VITAL_EFFECT[t]||'')).join(' · '),box);
  if(same&&r.fell.length)el('small','','FELL · '+r.fell.map(f=>name(f.t)).join(', '),box);
  const e=p.log?.[0];if(e?.ext)el('small','cq-plot-next','MILESTONE · +'+e.ext+'% WALL CAPACITY EARNED',box);
  if(o==='breached')el('small','','TIP · raiders gather at the red chevrons outside your town edge. Wall across them, blend the walls they hit first, keep turrets covering the breach points and vitals behind walls.',box);}
 else el('small','','TIP · raiders gather at the red chevrons outside your town edge and come in along those lanes.',body);
 const log=fold(body,'log','BASE LOG · '+(p.log||[]).length+' DRILLS');for(const e of p.log||[])el('p','',new Date(e.at).toLocaleString()+' · '+e.outcome.toUpperCase()+' · '+e.kills+'/'+e.spawned+' · '+(e.breaches|0)+' breaches · '+e.lost+' lost · CC '+e.core+'%',log);
 raidFold(body,s,p);}

// ------------------------------------------------------------------- scene sync / frame -------------------------------
const fromSnap=v=>({nm:v.nm||'',site:v.site,cc:v.cc|0,power:v.pw|0,b:Object.fromEntries(Object.entries(v.b||{}).map(([id,a])=>[id,{t:a[0],i:a[1],j:a[2],r:a[3],l:a[4]}])),w:v.w||{},banner:v.bn||null,theme:v.th||null,log:[],st:{}});
const plotOf=()=>X?.visit?X.visit.plot:X?.ctx.view.authority?.state?.plot;
const cached=(m,key,make)=>{let g=m.get(key);if(!g){g=make();m.set(key,g);}return g;};
const keepSet=R=>new Set([...R.wgeo.values(),...R.hgeo.values(),...R.tgeo.values()]);
const footY=(site,b)=>{const s=P.sizeOf(b.t,b.r|0);return P.heightAt(site,P.cellX(b.i)+(s.w-1)*P.GRID.cell/2,P.cellZ(b.j)+(s.d-1)*P.GRID.cell/2);};
const _m=[];
function inst(R,geo,n){const m=new R.T.InstancedMesh(geo,R.S.MAT.solid,Math.max(1,n));m.count=n;m.frustumCulled=false;return m;}
function sync(){const R=X?.R,p=plotOf();if(!p)return;if(!R){draw2d();return;}const {S,T,k,g}=R,low=!!S.low||!!R.far,M4=R._sm||(R._sm=new T.Matrix4()),keep=keepSet(R);
 if(R.keys.ter!==p.site+':'+p.cc+':'+(p.b.cc?.i)+','+(p.b.cc?.j)){R.keys.ter=p.site+':'+p.cc+':'+(p.b.cc?.i)+','+(p.b.cc?.j);wipe(g.terrain);for(const m of TK.terrain(S,p.site,p.cc,p,{earth:true}))g.terrain.add(m);}
 const pl=TK.plan(p),want=new Set(),turs=[],theme=p.theme;R.anim=[];R.plan=pl;
 for(const [id,b,lvl,building] of pl.builds){const B=P.BUILDINGS[b.t];
  const key=[b.t,lvl,b.i,b.j,b.r|0,building?1:0,theme?.finish||'',theme?.light||''].join(':');want.add(id);let e=R.meshes.get(id);
  if(!e||e.key!==key){if(e){g.build.remove(e.o);e.o.traverse(o=>{if(!keep.has(o.geometry))o.geometry?.dispose?.();});}const o=new T.Group(),s2=P.sizeOf(b.t,b.r|0);o.position.set(P.cellX(b.i)+(s2.w-1)*P.GRID.cell/2,footY(p.site,b),P.cellZ(b.j)+(s2.d-1)*P.GRID.cell/2);o.rotation.y=-(b.r|0)*Math.PI/2;
   if(lvl>0||building){const m=k.building(b.t,Math.max(1,lvl),theme).mesh();m.userData.id=id;o.add(m);}
   const hd=B?.turret||b.t==='radar'?k.head(b.t,Math.max(1,lvl)).mesh():null;if(hd){hd.position.y=b.t==='radar'?3.3+lvl*.5:1.4+lvl*.15;o.add(hd);o.userData.head=hd;o.userData.radar=b.t==='radar';}
   if(building){const sc=new S.Bld(),s3=P.sizeOf(b.t),W=s3.w*P.GRID.cell,D=s3.d*P.GRID.cell,h=b.t==='cc'?10+p.cc:6;for(const [x,z] of [[-1,-1],[1,-1],[1,1],[-1,1]])sc.box(x*W/2,h/2,z*D/2,.18,h,.18,k.C.amber,.6);for(let y=1.5;y<h;y+=2.2){sc.box(0,y,-D/2,W,.12,.12,k.C.amber,.5);sc.box(0,y,D/2,W,.12,.12,k.C.amber,.5);sc.box(-W/2,y,0,.12,.12,D,k.C.amber,.5);sc.box(W/2,y,0,.12,.12,D,k.C.amber,.5);}
    o.add(sc.mesh());const dr=new S.Bld();for(let q=0;q<3;q++)dr.box(Math.cos(q*2.1)*W*.6,h+1.5,Math.sin(q*2.1)*D*.6,.8,.25,.8,k.C.cyan,2);const drm=dr.mesh();o.add(drm);o.userData.drones=drm;}
   g.build.add(o);e={o,key,id};R.meshes.set(id,e);}
  if(e.o.userData.drones)R.anim.push(e.o);}
 for(const [id,e] of R.meshes)if(!want.has(id)){g.build.remove(e.o);e.o.traverse(o=>{if(!keep.has(o.geometry))o.geometry?.dispose?.();});R.meshes.delete(id);}
 // complete turrets: one base and one head draw per turret type and level (a CC10 town has up to 42 turrets)
 const tk=JSON.stringify([[...pl.turrets].map(([kk,l])=>[kk,l.map(([id,b])=>[id,b.i,b.j])]),theme?.finish,theme?.light]);if(R.keys.tur!==tk){R.keys.tur=tk;wipe(g.turrets,keep);R.tur=TK.turrets(R,p,pl,theme,g.turrets);}
 // walls: one instanced draw per blend look (up to 3,000 cells at CC10 with extensions), one for corner posts, one for rubble
 const wk=JSON.stringify(p.w)+low+JSON.stringify(p.dmg||{});if(R.keys.walls!==wk){R.keys.walls=wk;wipe(g.walls,keep);const W=TK.walls(R,p,pl,low,g.walls);R.wim=W.wim;R.wcell=W.wcell;R.wpost=W.wpost;R.dmgFx=TK.damageFx(R,p,g.walls);}
 // settler homes: one instanced draw per home kind
 const hk=P.homes(p).map(h=>h.id).join()+p.site+p.cc+low;if(R.keys.homes!==hk){R.keys.homes=hk;wipe(g.homes,keep);const H=TK.homes(R,p,pl,low,g.homes);R.him=H.him;R.hcell=H.hcell;}
 const ck=JSON.stringify([p.banner,p.theme,p.b.cc?.i,p.b.cc?.j,p.site]);if(R.keys.deco!==ck){R.keys.deco=ck;if(R.deco){g.build.remove(R.deco);R.deco.traverse(o=>{if(!o.geometry?.userData?.hfShared)o.geometry?.dispose?.();});}R.deco=new T.Group();const c=p.b.cc,x0=P.cellX(c.i)+6,z0=P.cellZ(c.j)+6;R.deco.position.y=footY(p.site,c);
  if(p.banner){const m=k.banner(p.banner,1.6).mesh();m.position.set(x0+7,0,z0-7);R.deco.add(m);}if(p.theme?.decor?.length)R.deco.add(k.decor(p.theme.decor,x0,z0,16,16,p.theme.light).mesh());g.build.add(R.deco);}
 if(X.drill)for(const id of X.drill.gone)hideStruct(id,p);
 holo();}
// hologram blueprint, the wall tool preview, the draft, erase/copy selections, the selected building, breach markers
function holo(){const R=X?.R,p=plotOf();if(!R||!p)return;const g=R.g;wipe(g.holo);
 const gc=X.place?[X.place.i,X.place.j]:X.mode==='walls'&&X.draw?X.draw.b:null;if(gc&&!X.visit)g.holo.add(TK.gridPatch(R.S,p.site,gc[0],gc[1]));
 if(X.place){const q=X.place,err=q.id?P.placeError(p,q.type,q.i,q.j,q.r,q.id):P.buildCheck(p,q.type,1)||P.placeError(p,q.type,q.i,q.j,q.r),B=P.BUILDINGS[q.type],cl=P.cells({t:q.type,i:q.i,j:q.j,r:q.r});
  const ring=B?.turret?{x:P.cellX(q.i),z:P.cellZ(q.j),y:P.groundY(p.site,q.i,q.j),r:B.turret.range*P.SITES[p.site].range}:null;g.holo.add(holoMesh(R,cl,!err,ring,p.site));}
 if(X.mode==='walls'){const dcells=[];for(const d of X.draft)for(const c of P.shapeCells(d.sec)||[])dcells.push(c);if(dcells.length)g.holo.add(holoMesh(R,dcells,2,null,p.site));
  if(X.draw?.cells?.length)g.holo.add(holoMesh(R,X.draw.cells,X.draw.ok,null,p.site));if(X.erase)g.holo.add(holoMesh(R,X.erase.keys.map(k=>k.split(',').map(Number)),false,null,p.site));}
 if(X.sel&&p.b[X.sel]){const b=p.b[X.sel],B=P.BUILDINGS[b.t];g.holo.add(holoMesh(R,P.cells(b),true,B?.turret?{x:P.cellX(b.i),z:P.cellZ(b.j),y:P.groundY(p.site,b.i,b.j),r:B.turret.range*P.SITES[p.site].range*(1+.04*(b.l-1))}:null,p.site));}
 if(X.mode==='defend'&&X.drillResult&&!X.drill){for(const [i,j,n] of X.drillResult.breaches)g.holo.add(holoMesh(R,[[i,j]],false,{x:P.cellX(i),z:P.cellZ(j),y:P.groundY(p.site,i,j)+1,r:9+Math.min(12,2*n),col:[1.4,.2,.25]},p.site));}}
function frame(dt){if(!X)return;X.clock+=dt;const s=X.ctx.view.authority?.state;if(s?.plot&&!X.visit&&(s!==X.lastState||Date.now()-(X.lastUi||0)>1000)){X.lastState=s;const key=JSON.stringify([s.plot.b,s.plot.job,s.plot.cc,s.plot.site,s.plot.banner,s.plot.theme,Object.keys(s.plot.w).length,s.plot.cm|0,s.plot.fh,s.plot.ext,s.plot.st&&Math.floor((s.plot.st.alloy||0)+(s.plot.st.biomass||0)),s.ledger?.cp,(s.plot.log||[]).length,s.dev?.on]);if(key!==X.lastKey){X.lastKey=key;X.lastUi=Date.now();render();}else if(Date.now()-(X.lastUi||0)>1000){X.lastUi=Date.now();tickUi();}}
 if(X.msgAt&&Date.now()-X.msgAt>5000){X.msg.textContent='';X.msgAt=0;}
 // The world waits while you build: when the builder's time is up, re-open the session (the Worker settles the job) at most every 3 s.
 const job=s?.plot?.job,au=X.ctx.view.authority;if(job&&Date.now()>job.ready+250&&!X.syncing&&Date.now()-(X.syncAt||0)>3000&&au&&!X.busy){X.syncing=true;X.syncAt=Date.now();au.connect().finally(()=>{if(X)X.syncing=false;});}
 const R=X.R;if(!R){if(X.drill)drillStep(dt);draw2d();return;}const {view}=X.ctx,T=R.T,c=X.cam,host=view.host;
 // Draw only inside the visible stage with its own aspect, so cellAt() (stage rect) matches the picture exactly.
 const hr=host.getBoundingClientRect(),sr=X.stage.getBoundingClientRect(),w=Math.max(1,sr.width||390),h=Math.max(1,sr.height||400);if(R.cam.aspect!==w/h){R.cam.aspect=w/h;R.cam.updateProjectionMatrix();}
 if(X.view==='drive'&&X.drive&&!X.tour){driveStep(dt);if(!X)return;}placeCam(dt);driveUi();if(X.tank&&!X.visit&&s?.plot&&s.plot!==X.flagPlot){X.flagPlot=s.plot;tankFlag(R,s.plot);}
 for(const o of R.meshes.values()){const hd=o.o.userData.head;if(hd)hd.rotation.y=hd.userData.aim??(X.clock*(o.o.userData.radar?1:.4))%(Math.PI*2);}
 const M4=R._fm||(R._fm=new T.Matrix4()),_q=R._fq||(R._fq=new T.Quaternion()),_v=R._fv||(R._fv=new T.Vector3()),_s=R._fs||(R._fs=new T.Vector3()),up=R._up||(R._up=new T.Vector3(0,1,0));
 for(const t of R.tur.values()){for(const it of t.items){const a=it.aim??(X.clock*.4+it.spin)%(Math.PI*2);_q.setFromAxisAngle(up,a);M4.compose(_v.set(it.x,it.y,it.z),_q,_s.set(it.dead?0:1,it.dead?0:1,it.dead?0:1));t.hd.setMatrixAt(it.n,M4);}t.hd.instanceMatrix.needsUpdate=true;}
 for(const o of R.anim){const dr=o.userData.drones;dr.rotation.y=X.clock*1.4;dr.position.y=Math.sin(X.clock*3)*.4;}
 const big=(R.wcell?.size||0)>600,far=X.view==='drive'?big:big?(R.far?c.dist>60:c.dist>80):(R.far?c.dist>165:c.dist>195);/* 5C: big towns stay light in the close drive view and the closer default camera */if(far!==!!R.far){R.far=far;const lo=!!R.S.low||far;for(const [code,m] of R.wim)m.geometry=cached(R.wgeo,code+':'+lo,()=>R.k.wallGeo(code,lo));{const pm=R.wpost?.values().next().value?.[0];if(pm)pm.geometry=cached(R.wgeo,'post:'+lo,()=>R.k.post(lo));}for(const [kind,m] of R.him)m.geometry=cached(R.hgeo,kind+lo,()=>R.k.home(kind,lo));
  const pp=plotOf();if(pp){R.keys.walls=JSON.stringify(pp.w)+lo+JSON.stringify(pp.dmg||{});R.keys.homes=P.homes(pp).map(h=>h.id).join()+pp.site+pp.cc+lo;}}   // distance LOD with hysteresis: zoomed out, walls and homes switch to the lighter geometry (no instance rebuild)
 crewStep(R,plotOf());if(X.drill)drillStep(dt);if(R.dmgFx&&!reduced())TK.damageStep(R.dmgFx,X.clock);
 if(SPRITE_WAIT.length&&!X.drill)spriteStep(R);   // before the frame's full clear, so a sprite never shows on the map
 R.S.viewLights(R.cam);R.S.U.uTime.value=(R.S.U.uTime.value||0)+dt;const r=view.renderer,vx=sr.left-hr.left,vy=hr.bottom-sr.bottom;r.setScissorTest(false);r.clear();r.setViewport(vx,vy,w,h);r.setScissor(vx,vy,w,h);r.setScissorTest(true);r.render(R.sc,R.cam);r.setScissorTest(false);r.setViewport(0,0,hr.width||w,hr.height||h);if((X.frames=(X.frames||0)+1)%30===1)X.info={calls:r.info.render.calls,triangles:r.info.render.triangles,programs:r.info.programs?.length||0};}
// crew walk between buildings, rovers drive the lanes (presentation)
function crewStep(R,p){if(!p)return;const T=R.T,mt=R._m||(R._m=new T.Matrix4()),bs=Object.values(p.b).filter(b=>b.l>0||b.t==='cc');if(!bs.length)return;const pos=b=>[P.cellX(b.i)+2,P.cellZ(b.j)+2];
 for(let n=0;n<R.crew.count;n++){const a=bs[n%bs.length],b=bs[(n*7+3)%bs.length],[x0,z0]=pos(a),[x1,z1]=pos(b),L=Math.hypot(x1-x0,z1-z0)||1,ph=((X.clock*1.3+n*11)%(2*L))/L,f=ph>1?2-ph:ph,x=x0+(x1-x0)*f+(n%3-1)*1.2,z=z0+(z1-z0)*f+5;mt.makeRotationY(Math.atan2(x1-x0,z1-z0)+(ph>1?Math.PI:0));mt.setPosition(x,P.heightAt(p.site,x,z),z);R.crew.setMatrixAt(n,mt);}
 R.crew.instanceMatrix.needsUpdate=true;const sp=P.spawnCells(p.site,p.cc);for(let n=0;n<R.rovers.count;n++){const L=sp[n%sp.length][0],t=((X.clock*.05+n*.33)%1),x=P.cellX(L[0])*(1-t)+6*t,z=P.cellZ(L[1])*(1-t)+6*t;mt.makeRotationY(Math.atan2(6-P.cellX(L[0]),6-P.cellZ(L[1])));mt.setPosition(x,P.heightAt(p.site,x,z),z);R.rovers.setMatrixAt(n,mt);}R.rovers.instanceMatrix.needsUpdate=true;}

// ------------------------------------------------------------------- Home Sector: drive your own town ------------------
// Session 5C centrepiece. The Command Gate in the shared world is a portal: the pilot's town loads as the live world around
// their own tank (this scene, full scale, the site's real terrain, every wall, turret, home, crew and rover). The tank
// drives in it locally (a private instance: every pilot's plot shares the same coordinates, so it can't live in the shared
// world; no server movement, nothing to earn here). Walls, buildings, turrets, homes, water and cliffs block; gates open
// for the owner. BUILD is a camera: any tab lifts the camera to the build view over the same scene, DRIVE brings it back.
// Leaving through the gate pad (or LEAVE) returns to the shared world at the pad. Drills replay here too.
const TOUR_KEY='lunar-cq-town-tour-v1',SPEED=15,TANK_R=2.1;
const reduced=()=>!!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function tankModel(R){const v=X.ctx.view.vehicle;let t=null;try{if(v&&v.children.length){const ud=v.userData;v.userData={};try{t=v.clone(true);}finally{v.userData=ud;}const ob=t.getObjectByName('cq-tank-banner');if(ob)ob.parent.remove(ob);t.position.set(0,0,0);t.rotation.set(0,0,0);t.quaternion.identity();t.scale.copy(v.scale);}}catch(_){t=null;}
 if(!t){const b=new R.S.Bld();b.box(0,1.1,0,3.4,1.4,5.2,R.k.C.mid);b.box(0,2.2,-.3,2.2,.9,2.4,R.k.C.dark);b.box(0,2.3,2.2,.35,.35,3,R.k.C.dark);t=b.mesh();}
 t.traverse(o=>{o.frustumCulled=false;o.userData.noPick=true;});return t;}
// the town tank's own banner (built from the plot, kept in sync; the world tank's banner geometry is never shared)
function tankFlag(R,p){if(!X.tank||!p)return;const key=p.banner?JSON.stringify(p.banner):'';if(X.tankFlagKey===key)return;X.tankFlagKey=key;const old=X.tank.getObjectByName('cq-town-tank-banner');if(old){X.tank.remove(old);old.geometry?.dispose?.();}if(!p.banner)return;const m=R.k.banner(p.banner,.42).mesh();m.name='cq-town-tank-banner';m.position.set(-2.1,1.1,-.9);m.rotation.y=Math.PI;m.frustumCulled=false;X.tank.add(m);}
// what blocks a 4 m cell for the tank: off the plot, blocked terrain (rim, water, cliffs, rocks, vents, crevasses), walls
// (ruined ones are rubble you can cross), buildings and turrets, settler homes; gates open for the owner only
function blockMap(p,owner){const occ=P.occupancy(p),homes=new Set();for(const h of P.homes(p))for(const [a,b] of [[0,0],[1,0],[0,1],[1,1]])homes.add(P.key(h.i+a,h.j+b));
 return (i,j)=>{if(!P.inGrid(i,j))return true;if(P.BLOCKED[P.terrainAt(p.site,i,j)])return true;const k=P.key(i,j),o=occ.get(k);if(o){if(o==='wall')return !(p.dmg&&P.ruined(p,'w:'+k));if(p.b[o]?.t==='gate')return !owner;return true;}return homes.has(k);};}
const cellOf=v=>Math.round(v/P.GRID.cell+P.MID);
function hits(D,x,z){const r=TANK_R;for(const [dx,dz] of [[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]])if(D.block(cellOf(x+dx),cellOf(z+dz)))return true;return false;}
// The gate pad: the nearest free 3x3 patch south of the Command Center (so walls can never trap the tank at its spawn).
function padOf(p,block){const C0=TK.ccCenter(p),c=P.GRID.cell,ci=cellOf(C0.x),cj=cellOf(C0.z+C0.d*c/2)+2,free=(i,j)=>{for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)if(block(i+a,j+b))return false;return true;};
 for(let r=0;r<30;r++)for(let a=-r;a<=r;a++)for(const b of r?[-r,r]:[0]){for(const [i,j] of [[ci+a,cj+b],[ci+b,cj+a]])if(free(i,j))return {i,j,x:P.cellX(i),z:P.cellZ(j)};}
 return {i:ci,j:cj,x:P.cellX(ci),z:P.cellZ(cj)};}
function startDrive(){const R=X?.R,p=plotOf();if(!R||!p)return;const owner=!X.visit,block=blockMap(p,owner),pad=padOf(p,block);
 if(!X.tank){X.tank=tankModel(R);R.g.actors.add(X.tank);}X.tankFlagKey=null;if(!X.visit)tankFlag(R,p);
 X.drive={x:pad.x,z:pad.z,h:Math.PI,v:0,stick:{x:0,z:0},keys:{},pad,block,owner,left:false,exit:0,plot:p,key:JSON.stringify([p.b,p.w,p.dmg,p.cc,p.site])};X.chase={dist:26,yaw:0};
 // the gate pad: a lit ring you drive back onto to leave (the shared world's Command Gate on this side)
 if(X.padMesh){X.padMesh.parent?.remove(X.padMesh);X.padMesh.traverse(o=>o.geometry?.dispose?.());}{const S=R.S,y=P.heightAt(p.site,pad.x,pad.z),b=new S.Bld(),fx=new S.Fx(),grp=new R.T.Group();b.add(S.G.hex,R.k.M(pad.x,y,pad.z,0,0,0,5.2,.25,5.2),R.k.C.dark2);b.add(S.G.hex,R.k.M(pad.x,y+.27,pad.z,0,0,0,4.6,.05,4.6),R.k.C.cyan,.9);for(const sx of [-1,1]){b.box(pad.x+sx*6,y+2.2,pad.z,.6,4.4,.9,R.k.C.dark);b.box(pad.x+sx*6,y+4.6,pad.z,.9,.3,1.2,R.k.C.cyan,1.6);}fx.ringGlow(pad.x,pad.z,y+1.2,4.8,2.4,[.1,.8,1],32);grp.add(b.mesh(),fx.mesh());X.padMesh=grp;R.g.actors.add(grp);}
 if(!X.visit&&!reduced()){let seen=false;try{seen=localStorage.getItem(TOUR_KEY)==='1';}catch(_){seen=true;}if(!seen){X.tour={t:0,dur:6};try{localStorage.setItem(TOUR_KEY,'1');}catch(_){}}}}
function setView(v){if(!X||!X.R&&v==='drive')return;endTour();if(v===X.view)return;X.camFrom=camPose();X.camT=0;X.view=v;if(v==='drive'){X.place=null;X.draw=null;X.erase=null;X.sel=null;if(!X.drive)startDrive();}render();}
// the pilot's input: a floating stick (one finger anywhere on the map), WASD / arrow keys; camera-relative like the world
function driveStep(dt){const D=X.drive,p=plotOf();if(!D||!p)return;const k=D.keys;let sx=D.stick.x+((k.d||k.arrowright)?1:0)-((k.a||k.arrowleft)?1:0),sz=D.stick.z+((k.s||k.arrowdown)?1:0)-((k.w||k.arrowup)?1:0);const L=Math.hypot(sx,sz);if(L>1){sx/=L;sz/=L;}
 if(p!==D.plot){D.plot=p;const key=JSON.stringify([p.b,p.w,p.dmg,p.cc,p.site]);if(key!==D.key){D.key=key;D.block=blockMap(p,D.owner);}}   // only when the Worker sends a new plot, never per frame
 const cy=X.chase.yaw,fx=-Math.sin(cy),fz=-Math.cos(cy),rx=Math.cos(cy),rz=-Math.sin(cy),wx=rx*sx-fx*sz,wz=rz*sx-fz*sz,mag=Math.min(1,Math.hypot(wx,wz));
 const ti=cellOf(D.x),tj=cellOf(D.z),slow=P.inGrid(ti,tj)?(P.SLOW[P.terrainAt(p.site,ti,tj)]||1):1;D.v+=((mag>.08?SPEED*mag*slow:0)-D.v)*Math.min(1,dt*(mag>.08?3.5:6));
 if(mag>.08){const want=Math.atan2(wx,wz);let d=want-D.h;d=Math.atan2(Math.sin(d),Math.cos(d));D.h+=d*Math.min(1,dt*7);}
 const step=D.v*dt,nx=D.x+Math.sin(D.h)*step,nz=D.z+Math.cos(D.h)*step;if(!hits(D,nx,nz)){D.x=nx;D.z=nz;}else if(!hits(D,nx,D.z))D.x=nx;else if(!hits(D,D.x,nz))D.z=nz;else D.v*=.3;   // slide along walls
 const lim=(P.GRID.n/2-1)*P.GRID.cell;D.x=Math.max(-lim,Math.min(lim,D.x));D.z=Math.max(-lim,Math.min(lim,D.z));
 // the chase camera swings behind the hull while it moves (never while the pilot only turns on the spot)
 if(D.v>2){let d=D.h+Math.PI-X.chase.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));X.chase.yaw+=d*Math.min(1,dt*1.6);}
 const pd=Math.hypot(D.x-D.pad.x,D.z-D.pad.z);if(pd>9)D.left=true;if(D.left&&pd<5&&!X.visit){D.exit+=dt;if(D.exit>1.1){close();return;}}else D.exit=0;
 X.tank.position.set(D.x,P.heightAt(p.site,D.x,D.z),D.z);X.tank.rotation.set(0,D.h,0);}
const _cp={};
function camPose(){const R=X.R;if(!R)return null;return {p:R.cam.position.clone(),t:(X.camLook||new R.T.Vector3()).clone()};}
// camera: drive (chase), tour (a 6 s orbit of the town the first time), or the build view (3/4, overhead to place/draw)
function placeCam(dt){const R=X.R,T=R.T,c=X.cam,p=plotOf(),pos=R._cpos||(R._cpos=new T.Vector3()),look=R._clook||(R._clook=new T.Vector3());
 if(X.tour&&X.drive){const t=(X.tour.t+=dt),C0=TK.ccCenter(p),rad=(P.townH(p.cc)+4)*P.GRID.cell*.75,a=-Math.PI/2+t/X.tour.dur*Math.PI*1.6;pos.set(C0.x+Math.cos(a)*rad,55+20*Math.sin(t*.5),C0.z+Math.sin(a)*rad);look.set(C0.x,4,C0.z);
  if(t>=X.tour.dur){X.tour=null;X.camFrom={p:pos.clone(),t:look.clone()};X.camT=0;}}
 else if(X.view==='drive'&&X.drive){const D=X.drive,y=P.heightAt(p.site,D.x,D.z),cy=X.chase.yaw,d=X.chase.dist;pos.set(D.x+Math.sin(cy)*d,y+d*.56+3,D.z+Math.cos(cy)*d);look.set(D.x-Math.sin(cy)*9,y+1.5,D.z-Math.cos(cy)*9);}
 else{const tilt=X.place||X.mode==='walls'?1.38:Math.min(c.tilt,1.2),dist=c.dist;pos.set(c.x+Math.sin(c.yaw)*Math.cos(tilt)*dist,Math.sin(tilt)*dist,c.z+Math.cos(c.yaw)*Math.cos(tilt)*dist);look.set(c.x,0,c.z);}
 // ease from the last pose after a view change (0.6 s; instant with reduced motion)
 if(X.camFrom&&X.camT<1){X.camT=reduced()?1:Math.min(1,X.camT+dt/.6);const e=X.camT<.5?2*X.camT*X.camT:1-Math.pow(-2*X.camT+2,2)/2;pos.lerpVectors(X.camFrom.p,pos,e);look.lerpVectors(X.camFrom.t,look,e);if(X.camT>=1)X.camFrom=null;}
 R.cam.position.copy(pos);R.cam.lookAt(look);X.camLook=(X.camLook||new T.Vector3()).copy(look);}
function driveUi(){const st=X.stage;if(!X.driveBtn){const {button}=X.ctx;X.driveBtn=button('🚙 DRIVE',()=>setView('drive'),'cq-plot-drivebtn');X.driveBtn.setAttribute('aria-label','Drive your tank in your town');st.append(X.driveBtn);X.skip=button('SKIP ▸',()=>{if(X.tour){X.camFrom=camPose();X.camT=0;X.tour=null;}},'cq-plot-skip');st.append(X.skip);X.stickEl=document.createElement('div');X.stickEl.className='cq-plot-stick';X.stickEl.hidden=true;X.stickEl.append(document.createElement('i'));st.append(X.stickEl);X.exitEl=document.createElement('div');X.exitEl.className='cq-plot-exit';X.exitEl.hidden=true;st.append(X.exitEl);}
 const drive=X.view==='drive';X.d.classList.toggle('cq-plot-driving',drive);X.driveBtn.hidden=drive||!X.R||!!X.place;/* hidden while a blueprint is placed (the map is for placing then) */X.skip.hidden=!X.tour;
 const D=X.drive,ex=drive&&D&&D.exit>0;X.exitEl.hidden=!ex;if(ex)X.exitEl.textContent='LEAVING TOWN · BACK TO THE WORLD';}

// ------------------------------------------------------------------- raid replay (Defense Drill) -----------------------
// The phone replays the Worker's drill from its seed (same deterministic simulation): raiders, every turret type's firing
// effect, walls/homes/buildings falling, then the breach points and the fallen structures. The replay time is measured
// (X.drillMs) because the simulation runs once on the phone before the replay starts.
// The simulation runs in slices of about 8 ms (a generator), so the phone never freezes, even for a CC10 town; the time it
// took is X.drillMs (wall clock) and X.drillCpu (pure simulation time).
function startReplay(){const s=X?.ctx.view.authority?.state,p=s?.plot,e=p?.log?.[0];if(!e||X.simulating)return;const g=P.drillGen(p,e.seed,{threat:e.threat,yieldEvery:25}),t0=performance.now();let cpu=0;X.simulating=true;
 const pump=()=>{if(!X){return;}const a=performance.now();let r;do{r=g.next();}while(!r.done&&performance.now()-a<8);cpu+=performance.now()-a;
  if(!r.done){say('SIMULATING THE RAID… '+Math.round(100*r.value)+'%');setTimeout(pump,0);return;}
  X.simulating=false;X.drillMs=Math.round(performance.now()-t0);X.drillCpu=Math.round(cpu);say('');X.drill={r:r.value,log:e,t:0,fi:0,ei:0,shots:[],gone:new Set()};X.drillResult=null;X.mode='defend';X.cam.dist=Math.min(320,140+P.townH(p.cc)*3);X.cam.x=0;X.cam.z=8;render();};
 pump();}
function hideStruct(id,p){const R=X.R;if(!R)return;if(id.startsWith('w:')){const z=new R.T.Matrix4().makeScale(0,0,0);for(const e of [R.wcell?.get(id.slice(2)),R.wpost?.get(id.slice(2))])if(e){e[0].setMatrixAt(e[1],z);e[0].instanceMatrix.needsUpdate=true;}return;}
 const he=R.hcell?.get(id);if(he){he[0].setMatrixAt(he[1],new R.T.Matrix4().makeScale(0,0,0));he[0].instanceMatrix.needsUpdate=true;return;}
 for(const t of R.tur.values())for(const it of t.items)if(it.id===id){it.dead=true;t.base.setMatrixAt(it.n,new R.T.Matrix4().makeScale(0,0,0));t.base.instanceMatrix.needsUpdate=true;return;}
 const e=R.meshes.get(id);if(e)e.o.visible=false;}
function drillStep(dt){const D=X.drill,R=X.R,p=plotOf();D.t+=dt*1.6;const fr=D.r.frames;while(D.fi<fr.length-1&&fr[D.fi+1].t<=D.t)D.fi++;const a=fr[D.fi]||{f:[],s:[]},b=fr[Math.min(fr.length-1,D.fi+1)]||a,f=b.t>a.t?Math.max(0,Math.min(1,(D.t-a.t)/(b.t-a.t))):0;
 const bm=new Map(b.f.map(q=>[q[0],q]));D.now=a.f.map(q=>{const n=bm.get(q[0]);return n?[q[0],q[1],q[2]+(n[2]-q[2])*f,q[3]+(n[3]-q[3])*f]:q;});
 const ev=D.r.events;while(D.ei<ev.length&&ev[D.ei].t<=D.t){const e=ev[D.ei++];if(e.k==='shot')D.shots.push({...e,life:e.ty==='flame'?.35:.25});else if(e.k==='destroyed'){D.gone.add(e.id);hideStruct(e.id,p);}}D.shots=D.shots.filter(x=>(x.life-=dt)>0);
 if(R){const T=R.T,m=R._d||(R._d=new T.Matrix4()),sv=R._dv||(R._dv=new T.Vector3()),cnt={r:0,s:0,d:0,w:0,b:0};for(const [,kind,x,z] of D.now){const im=R.foes[kind];if(!im||cnt[kind]>=im.instanceMatrix.count)continue;m.makeRotationY(Math.atan2(-x,-z));m.setPosition(x,(kind==='d'?7:0)+P.heightAt(p.site,x,z),z);im.setMatrixAt(cnt[kind]++,m);}for(const [kk,im] of Object.entries(R.foes)){im.count=cnt[kk];im.visible=cnt[kk]>0;im.instanceMatrix.needsUpdate=true;}
  const fc={};for(const k2 of Object.keys(R.fx))fc[k2]=0;const from=id=>{const bb=p.b[id];return bb?[P.cellX(bb.i),P.groundY(p.site,bb.i,bb.j)+2,P.cellZ(bb.j)]:null;};
  const put=(kind,x0,y0,z0,x1,z1,scale=1)=>{const im=R.fx[kind];if(fc[kind]>=im.instanceMatrix.count)return;const dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz)||1;m.makeRotationY(Math.atan2(dx,dz));m.scale(sv.set(scale,scale,L));m.setPosition(x0,y0,z0);im.setMatrixAt(fc[kind]++,m);};
  for(const sh of D.shots){const o=from(sh.from);if(!o)continue;const kind=FX_OF[sh.ty]||'tracer';
   if(kind==='arc'&&sh.ch){let [px,pz]=[o[0],o[2]];for(const [cx,cz] of sh.ch){put('arc',px,o[1],pz,cx,cz);px=cx;pz=cz;}}
   else if(kind==='flame')put('flame',o[0],o[1]-.5,o[2],sh.x,sh.z,4);
   else if(kind==='blast'||kind==='shell'){const k3=1-Math.max(0,sh.life)/.25;put(kind,o[0]+(sh.x-o[0])*k3,o[1]+2-k3,o[2]+(sh.z-o[2])*k3,sh.x,sh.z,1);}
   else put(kind,o[0],o[1],o[2],sh.x,sh.z,kind==='burst'||kind==='rail'?1.6:1);
   for(const t of R.tur.values())for(const it of t.items)if(it.id===sh.from)it.aim=Math.atan2(sh.x-it.x,sh.z-it.z);const e=R.meshes.get(sh.from);if(e?.o.userData.head)e.o.userData.head.userData.aim=Math.atan2(sh.x-o[0],sh.z-o[2])+(e.o.rotation.y||0);}
  for(const [k2,im] of Object.entries(R.fx)){im.count=fc[k2];im.visible=fc[k2]>0;im.instanceMatrix.needsUpdate=true;}}
 if(D.t>=D.r.time+1){X.drillResult={...D.r,log:D.log};X.drill=null;if(R){for(const im of [...Object.values(R.foes),...Object.values(R.fx)]){im.count=0;im.visible=false;}for(const e of R.meshes.values()){e.o.visible=true;if(e.o.userData.head)delete e.o.userData.head.userData.aim;}for(const t of R.tur.values())for(const it of t.items){delete it.aim;}R.keys.walls=R.keys.homes=R.keys.tur=null;}render();}}

// ------------------------------------------------------------------- 2D fallback ---------------------------------------
// One pixel per cell in an offscreen canvas (terrain, walls by blend, homes), drawn scaled with no smoothing; buildings,
// raiders and previews on top. Cheap on any phone at any town size.
function layer2d(p){if(X.l2?.p===p)return X.l2.c;const key=p.site+p.cc+JSON.stringify(p.w)+JSON.stringify(p.b)+P.homes(p).length+Object.keys(p.dmg||{}).length;if(X.l2?.key===key){X.l2.p=p;return X.l2.c;}const c=TK.layer2d(p,X.l2?.c);X.l2={key,c,p};return c;}
function draw2d(){if(!X?.cv)return;const cv=X.cv,p=plotOf();if(!p)return;const r=X.stage.getBoundingClientRect(),dpr=Math.min(2,root.devicePixelRatio||1);if(cv.width!==Math.round(r.width*dpr)||cv.height!==Math.round(r.height*dpr)){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);}   // height too: the stage resizes whenever the menu does
 const g=cv.getContext('2d'),n=P.GRID.n,cs=Math.min(cv.width,cv.height)/(P.townSide(p.cc)+4)*(170/X.cam.dist),ox=cv.width/2-X.cam.x/P.GRID.cell*cs,oy=cv.height/2-X.cam.z/P.GRID.cell*cs,X0=i=>ox+(i-(n-1)/2-.5)*cs,Y0=j=>oy+(j-(n-1)/2-.5)*cs;X.map2d={cs,ox,oy};
 g.fillStyle='#05070d';g.fillRect(0,0,cv.width,cv.height);g.imageSmoothingEnabled=false;g.drawImage(layer2d(p),X0(0),Y0(0),n*cs,n*cs);
 const h=P.townH(p.cc);g.strokeStyle='#22e6ff';g.lineWidth=2;g.strokeRect(X0(P.MID-h),Y0(P.MID-h),(2*h+1)*cs,(2*h+1)*cs);g.fillStyle='#ff3048';for(const cl of P.spawnCells(p.site,p.cc))for(const [i,j] of cl)g.fillRect(X0(i)+cs*.2,Y0(j)+cs*.2,cs*.6,cs*.6);
 g.font=Math.round(cs*1.1)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';for(const [id,b] of Object.entries(p.b)){if(X.drill?.gone.has(id))continue;const s2=P.sizeOf(b.t,b.r|0),lvl=b.t==='cc'?p.cc:b.l;g.fillStyle=X.sel===id?'#ffd36b':P.VITALS[b.t]?'#6a5a3a':lvl>0?'#4a5664':'#6a4a2a';g.fillRect(X0(b.i)+1,Y0(b.j)+1,s2.w*cs-2,s2.d*cs-2);g.fillStyle='#e8f6ff';g.fillText((ICON[b.t]||'?')+(s2.w>1&&lvl>0?romanOf(lvl):''),X0(b.i)+s2.w*cs/2,Y0(b.j)+s2.d*cs/2);}
 const box=(cl,col)=>{g.strokeStyle=col;g.lineWidth=2;for(const [i,j] of cl)g.strokeRect(X0(i)+1,Y0(j)+1,cs-2,cs-2);};
 if(X.place)box(P.cells({t:X.place.type,i:X.place.i,j:X.place.j,r:X.place.r}),!(X.place.id?P.placeError(p,X.place.type,X.place.i,X.place.j,X.place.r,X.place.id):P.buildCheck(p,X.place.type,1)||P.placeError(p,X.place.type,X.place.i,X.place.j,X.place.r))?'#2dff8a':'#ff3048');
 if(X.mode==='walls'){for(const d of X.draft)box(P.shapeCells(d.sec)||[],'#ffb347');if(X.draw?.cells)box(X.draw.cells,'#2dff8a');if(X.erase)box(X.erase.keys.map(k=>k.split(',').map(Number)),'#ff3048');}
 if(X.place&&P.BUILDINGS[X.place.type]?.turret){g.strokeStyle='#22e6ff';g.beginPath();g.arc(X0(X.place.i)+cs/2,Y0(X.place.j)+cs/2,P.BUILDINGS[X.place.type].turret.range*P.SITES[p.site].range/P.GRID.cell*cs,0,7);g.stroke();}
 if(X.drill?.gone){g.fillStyle='#05070d';for(const id of X.drill.gone)if(id.startsWith('w:')){const [i,j]=id.slice(2).split(',').map(Number);g.fillRect(X0(i),Y0(j),cs,cs);}}
 if(X.drill?.now){for(const [,kind,x,z] of X.drill.now){g.fillStyle=kind==='d'?'#ff7ae8':kind==='b'?'#ff5a2a':'#ff2bd6';g.beginPath();g.arc(ox+x/P.GRID.cell*cs,oy+z/P.GRID.cell*cs,kind==='s'||kind==='b'?cs*.5:kind==='w'?cs*.2:cs*.3,0,7);g.fill();}}
 if(X.mode==='defend'&&X.drillResult&&!X.drill){g.strokeStyle='#ff3048';g.lineWidth=3;for(const [i,j,k] of X.drillResult.breaches){g.beginPath();g.arc(X0(i)+cs/2,Y0(j)+cs/2,cs*(1.4+Math.min(3,k*.3)),0,7);g.stroke();}}}
// ------------------------------------------------------------------- personal & social (Phase 2) ---------------------
const PALETTE=['#22e6ff','#ffb347','#ff3048','#2dffc4','#a07bff','#ffd36b','#f3f6fa','#1a2230','#3fae4a','#ff2bd6'];
const SHAPES=['shield','pennant','square','chevron'],EMBLEMS={moon:'☾',tank:'▰',star:'★',skull:'☠',gear:'⚙',wing:'❦',bolt:'ϟ',crown:'♛'};
function bannerCanvas(bn,w=120,h=150){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#0b1623';g.fillRect(0,0,w,h);g.fillStyle='#4a5664';g.fillRect(w*.12,h*.05,w*.05,h*.9);
 const x=w*.17,y=h*.08,W=w*.72,H=h*.55;g.fillStyle=bn.colors[0];g.beginPath();if(bn.shape==='pennant'){g.moveTo(x,y);g.lineTo(x+W,y+H/2);g.lineTo(x,y+H);}else if(bn.shape==='shield'){g.moveTo(x,y);g.lineTo(x+W,y);g.lineTo(x+W,y+H*.7);g.lineTo(x+W/2,y+H*1.1);g.lineTo(x,y+H*.7);}else if(bn.shape==='chevron'){g.moveTo(x,y);g.lineTo(x+W,y);g.lineTo(x+W*.8,y+H/2);g.lineTo(x+W,y+H);g.lineTo(x,y+H);}else g.rect(x,y,W,H);g.closePath();g.fill();
 g.fillStyle=bn.colors[1];g.fillRect(x,y+H*.42,W*(bn.shape==='pennant'?.55:1),H*.16);g.font='bold '+Math.round(H*.42)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(EMBLEMS[bn.emblem]||'★',x+W*.42,y+H*.5-H*.18);return c;}
function designer(box,p){const {el,button}=X.ctx;const bn=JSON.parse(JSON.stringify(p.banner||{shape:'shield',colors:['#22e6ff','#1a2230'],emblem:'moon'})),th=JSON.parse(JSON.stringify(p.theme||{light:'cyan',finish:'steel',decor:[]}));
 const prev=el('div','cq-banner-prev',null,box);const draw=()=>{prev.replaceChildren(bannerCanvas(bn));};draw();
 const row=(label,items,get,set,fmt2)=>{el('small','',label,box);const r=el('div','cq-plot-row',null,box);for(const it of items){const b=button(fmt2?fmt2(it):it.toUpperCase(),()=>{set(it);[...r.children].forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',String(x===b));});draw();},get()===it?'on':'');b.setAttribute('aria-pressed',String(get()===it));if(/^#/.test(it)){b.style.background=it;b.textContent='';b.setAttribute('aria-label',label+' '+it);}r.append(b);}};
 row('SHAPE',SHAPES,()=>bn.shape,v=>bn.shape=v);row('MAIN COLOR',PALETTE,()=>bn.colors[0],v=>bn.colors[0]=v);row('STRIPE COLOR',PALETTE,()=>bn.colors[1],v=>bn.colors[1]=v);row('EMBLEM',Object.keys(EMBLEMS),()=>bn.emblem,v=>bn.emblem=v,k=>EMBLEMS[k]);
 box.append(button('SAVE BANNER · on your base and your tank',()=>act('plot-banner',bn,'RAISING BANNER…'),'cq-plot-primary'));
 row('BASE LIGHTS',['cyan','amber','violet','green','red'],()=>th.light,v=>th.light=v);row('FINISH',['steel','sand','graphite'],()=>th.finish,v=>th.finish=v);
 el('small','','DECORATIONS (up to 6)',box);const dr=el('div','cq-plot-row',null,box);for(const d of ['flags','lamps','crates','antenna','plants','statue']){const b=button(d.toUpperCase(),()=>{const i=th.decor.indexOf(d);if(i>=0)th.decor.splice(i,1);else if(th.decor.length<6)th.decor.push(d);b.classList.toggle('on',th.decor.includes(d));},th.decor.includes(d)?'on':'');dr.append(b);}
 box.append(button('SAVE THEME',()=>act('plot-theme',th,'REPAINTING…'),'cq-plot-primary'));el('small','','Banners, lights, finishes and decorations are free.',box);}
async function visitList(box){const {el,button,view}=X.ctx;const wait=el('p','','LOADING…',box);let L;try{L=await view.authority.transport('/api/conquest/visit',{});}catch(e){wait.textContent='VISITS NEED A CONNECTION';return;}wait.remove();
 if(L.week)el('p','cq-plot-next','★ BASE OF THE WEEK · '+L.week.n+' · +'+fmt(L.week.g)+' TOWN SCORE THIS WEEK',box);
 const sec=(title,list)=>{el('b','',title,box);if(!list.length){el('small','','None yet.',box);return;}for(const x of list){box.append(button((x.nm||x.n||'Pilot')+' · CC'+x.cc+' · '+(P.SITES[x.site]?.name||'')+' · SCORE '+fmt(x.pw),()=>visit(x.p,x.n)));}};
 sec('SQUAD',L.squad||[]);sec('TOP 20 BY TOWN SCORE',L.top||[]);if(L.week&&!(L.top||[]).some(x=>x.p===L.week.p))box.append(button('VISIT BASE OF THE WEEK · '+L.week.n,()=>visit(L.week.p,L.week.n)));}
async function visit(pid,name){const {view}=X.ctx;say('OPENING '+String(name||'BASE').toUpperCase()+'…');let r;try{r=await view.authority.transport('/api/conquest/visit',{pid});}catch(e){say(String(e.message||'').replace(/^conquest: /,'').toUpperCase()||'NOT AVAILABLE');return;}
 X.visit={base:r.base,plot:fromSnap(r.base)};X.sel=null;X.mode='home';X.place=null;X.draw=null;X.draft=[];if(X.R){X.R.keys={};}X.cam=frameCam(X.visit.plot);
 // 5C: a visit is a read-only Home Sector you can drive through (gates stay shut for visitors; nothing can be changed)
 if(X.R){X.drive=null;X.camFrom=camPose();X.camT=0;startDrive();X.view='drive';}visitUi();}
function visitUi(){const {el,button}=X.ctx,v=X.visit.base,p=X.visit.plot;header(p,v);X.title.textContent='VISITING · '+(v.nm||v.n)+' · CC'+v.cc;X.coach.hidden=true;X.tabs.hidden=true;const sh=X.sheet;sh.replaceChildren();
 el('p','cq-plot-hint','Read-only visit: look around '+(v.nm?v.nm+', ':'')+v.n+'\'s town on a '+(P.SITES[v.site]?.name||'')+'. Nothing here can be changed or taken. Player raids are coming. TOWN SCORE '+fmt(v.pw)+'.',sh);
 {const w=Object.values(p.w||{}),by={};for(const c of w){const n=P.blendName(c);by[n]=(by[n]||0)+1;}const tu={};for(const b of Object.values(p.b)){const B=P.BUILDINGS[b.t];if(B?.turret)tu[B.n]=(tu[B.n]||0)+1;}const vit=Object.values(p.b).filter(b=>P.VITALS[b.t]).map(b=>b.t==='cc'?'Command Center':P.BUILDINGS[b.t].n);
  el('p','cq-plot-res','WHAT YOU WOULD FACE · DEFENSE RATING '+fmt(v.dr||P.defenseRating(p))+' · '+w.length+' walls'+(w.length?' ('+Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n,k])=>k+' '+n).join(', ')+')':'')+' · '+(Object.entries(tu).map(([n,k])=>k+' '+n).join(', ')||'no turrets')+' · vitals: '+vit.join(', '),sh);}
 if(X.sel&&p.b[X.sel]){const b=p.b[X.sel],B=b.t==='cc'?{n:'Command Center'}:P.BUILDINGS[b.t],tag=document.createElement('b');tag.className='cq-plot-visit-sel';tag.textContent=(ICON[b.t]||'')+' '+B.n.toUpperCase()+' '+(b.t==='cc'?'CC'+p.cc:romanOf(b.l));sh.prepend(tag);}if(v.bn)sh.append(bannerCanvas(v.bn,90,110));layout();sh.prepend(button('RETURN TO MY BASE',()=>{X.visit=null;X.sel=null;if(X.R){X.R.keys={};X.drive=null;X.camFrom=camPose();X.camT=0;startDrive();X.view='drive';}X.cam=frameCam(X.ctx.view.authority?.state?.plot);render();},'cq-plot-primary'));if(X.R)driveUi();sync();}
// The share card (5C): a render of the pilot's town (the 3D scene from a 3/4 camera; the 2D map in the 2D setting), its
// name, CC, defense rating and banner. Rendered and copied in the same task (the drawing buffer is still valid), then the
// next frame redraws the map.
function townShot(p,w=720,h=520){const R=X?.R;if(!R)return null;const r=X.ctx.view.renderer,el=r.domElement,pr=r.getPixelRatio?.()||1,W=Math.min(w,el.width),H=Math.min(h,el.height);if(W<240||H<180)return null;
 const T=R.T,cam=new T.PerspectiveCamera(38,W/H,.5,2500),C0=TK.ccCenter(p),half=(P.townH(p.cc)+2)*P.GRID.cell,d=half*2.05;cam.position.set(C0.x+d*.5,d*.6,C0.z+d*.78);cam.lookAt(C0.x,0,C0.z);R.S.viewLights(cam);
 const hide=[R.g.holo,X.tank,X.padMesh,X.fab].filter(o=>o&&'visible' in o),vis=hide.map(o=>o.visible);hide.forEach(o=>o.visible=false);const old=new T.Color();r.getClearColor(old);const oa=r.getClearAlpha();
 try{r.setScissorTest(true);r.setViewport(0,0,W/pr,H/pr);r.setScissor(0,0,W/pr,H/pr);r.setClearColor(0x05070d,1);r.clear();r.render(R.sc,cam);r.setScissorTest(false);const c=document.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').drawImage(el,0,el.height-H,W,H,0,0,W,H);return c;}
 catch(e){return null;}finally{r.setClearColor(old,oa);hide.forEach((o,i)=>o.visible=vis[i]);R.S.viewLights(R.cam);}}
function shareCard(s,p){const {el,button}=X.ctx,c=document.createElement('canvas');c.width=720;c.height=900;const g=c.getContext('2d'),grad=g.createLinearGradient(0,0,0,900);grad.addColorStop(0,'#071426');grad.addColorStop(1,'#03060c');g.fillStyle=grad;g.fillRect(0,0,720,900);
 const name=townName(p),pilot=(typeof save!=='undefined'&&(save.callsign||save.name))||'Pilot';g.fillStyle='#22e6ff';g.font='800 40px sans-serif';g.fillText(name.toUpperCase().slice(0,22),40,72);g.fillStyle='#e8f6ff';g.font='600 24px sans-serif';g.fillText(String(pilot).slice(0,20)+'\'s town · '+P.SITES[p.site].name,40,110);
 g.fillStyle='#ffd36b';g.font='800 30px sans-serif';g.fillText('CC'+p.cc+' · DEFENSE '+fmt(P.defenseRating(p))+' · '+Object.keys(p.w||{}).length+' WALLS',40,154);
 const shot=townShot(p);if(shot){const k=Math.min(680/shot.width,600/shot.height),w=shot.width*k,h=shot.height*k;g.drawImage(shot,(720-w)/2,180+(600-h)/2,w,h);g.strokeStyle='#22e6ff66';g.lineWidth=2;g.strokeRect((720-w)/2,180+(600-h)/2,w,h);}
 else{const h=P.townH(p.cc),side=2*h+1,cs=Math.floor(600/side),i0=P.MID-h,ox=(720-side*cs)/2-i0*cs,oy=190-i0*cs;g.imageSmoothingEnabled=false;g.drawImage(layer2d(p),i0,i0,side,side,ox+i0*cs,oy+i0*cs,side*cs,side*cs);}
 if(p.banner)g.drawImage(bannerCanvas(p.banner,120,150),570,14);const link=typeof refLink==='function'?refLink():null;g.fillStyle='#ffb347';g.font='700 26px sans-serif';g.fillText('JOIN MY SQUAD · BUILD YOURS',40,818);g.fillStyle='#c9d6e2';g.font='500 24px sans-serif';g.fillText(link?link.replace(/^https?:\/\//,''):'LUNAR: War Machines · Telegram and web',40,858);
 const url=c.toDataURL('image/png'),box=el('div','cq-plot-share',null,X.sheet);X.sheet.scrollTop=X.sheet.scrollHeight;const img=document.createElement('img');img.src=url;img.alt=name+': CC'+p.cc+', defense rating '+P.defenseRating(p);img.className='cq-plot-share-img';box.append(img);X.shareShot=!!shot;
 const text='My LUNAR town '+name+': CC'+p.cc+' on a '+P.SITES[p.site].name+', defense rating '+fmt(P.defenseRating(p))+'. Join my squad and build yours.';
 box.append(button(typeof IN_TG!=='undefined'&&IN_TG?'SHARE IN TELEGRAM':'SHARE',async()=>{if(typeof IN_TG!=='undefined'&&IN_TG&&typeof shareRef==='function'){shareRef(text);return;}try{const blob=await (await fetch(url)).blob(),file=new File([blob],'lunar-town.png',{type:'image/png'}),data={title:'LUNAR: War Machines',text,...(link?{url:link}:{})};if(navigator.canShare?.({files:[file]}))data.files=[file];if(navigator.share)await navigator.share(data);else if(typeof shareRef==='function')shareRef(text);}catch(e){}},'cq-plot-primary'));
 const a=document.createElement('a');a.href=url;a.download='lunar-town.png';a.textContent='DOWNLOAD IMAGE';a.className='cq-plot-dl';box.append(a);}
// Revenue (fair, cosmetic or time only). Checkout stays disabled until payments are certified: shown honestly as unavailable.
const STORE=[['Aurora base lighting','theme'],['Gilded wall skin','skin'],['Animated war banner','banner'],['Commander statue','decoration'],['Second builder','two constructions at once'],['Speed-up','finish a construction sooner']];
// Revenue (owner MONEY RULE: what is sold and its limits live in ConquestPlot.STORE, one table). Checkout stays disabled
// until payments are certified: every tile is shown honestly as unavailable.
function storeList(box){const {el,button}=X.ctx;el('small','','Capacity, cosmetics and time only. Never airdrop points; rare-or-better ores are earn-only.',box);
 for(const it of P.STORE.items){const b=button('',()=>{});b.disabled=true;b.setAttribute('aria-disabled','true');b.className='cq-plot-store cq-plot-card';const hd=el('span','cq-plot-card-head',null,b);hd.append(sprite('x',it.id,1));el('b','',it.name,hd);el('span','cq-plot-tag','UNAVAILABLE',hd);el('small','cq-plot-desc',it.what,b);box.append(b);}
 el('small','','Checkout is not open: nothing here can be bought today. Everything a pack gives (wall capacity) can also be earned.',box);}

// ------------------------------------------------------------------- input ---------------------------------------------
// The tapped cell, with the terrain: a ray against the ground plane at the height of the cell it lands on (3 refinements,
// so terraces, the plateau and the canyon floor all land exactly).
function cellAt(clientX,clientY){const r=X.stage.getBoundingClientRect(),p=plotOf();if(X.R){const T=X.R.T,v=new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,X.R.cam);const o=ray.ray.origin,d=ray.ray.direction;let y=0,c=null;
  for(let k=0;k<4;k++){const t=(y-o.y)/d.y;if(!(t>0))return c;const x=o.x+d.x*t,z=o.z+d.z*t;c=[Math.round(x/P.GRID.cell+P.MID),Math.round(z/P.GRID.cell+P.MID)];const ny=p&&P.inGrid(c[0],c[1])?P.groundY(p.site,c[0],c[1]):0;if(Math.abs(ny-y)<.05)break;y=ny;}return c;}
 const m=X.map2d,dpr=X.cv.width/r.width;if(!m)return null;return [Math.floor(((clientX-r.left)*dpr-m.ox)/m.cs+P.MID+.5),Math.floor(((clientY-r.top)*dpr-m.oy)/m.cs+P.MID+.5)];}
function tap(cx,cy){const p=plotOf(),c=cellAt(cx,cy);if(!p||!c)return;const [i,j]=c;
 if(X.view==='drive'){endTour();const occ=P.occupancy(p).get(P.key(i,j)),id=occ&&occ!=='wall'?occ:null;if(!id)return;X.sel=id;if(X.visit){X.visitSnap='half';visitUi();return;}X.camFrom=camPose();X.camT=0;X.view='build';X.mode='home';const b=p.b[id];X.cam.x=P.cellX(b.i);X.cam.z=P.cellZ(b.j)+4;render();return;}if(X.visit){const occ=P.occupancy(p).get(P.key(i,j));X.sel=occ&&occ!=='wall'?occ:null;visitUi();return;}
 if(X.place){const s2=P.sizeOf(X.place.type,X.place.r);X.place.i=i-Math.floor((s2.w-1)/2);X.place.j=j-Math.floor((s2.d-1)/2);render();return;}
 if(X.mode==='walls')return;const occ=P.occupancy(p).get(P.key(i,j));X.sel=occ&&occ!=='wall'?occ:null;if(X.sel&&snapNow()==='peek')X.snapOf[X.mode]='half';render();}   // a selection opens its card in the current tab
// wall tool gestures: a drag draws the current tool's shape; COPY/ERASE drag a box; PASTE taps an anchor
const box2=(a,b)=>{const out=[];for(let i=Math.min(a[0],b[0]);i<=Math.max(a[0],b[0]);i++)for(let j=Math.min(a[1],b[1]);j<=Math.max(a[1],b[1]);j++)out.push([i,j]);return out;};
function drawCells(a,b){return X.tool==='line'?P.line4(a,b):X.tool==='rect'?P.rectCells(a,b):X.tool==='ring'?P.ringCells(a,b):box2(a,b);}
function classify(p,cells){const occ=P.occupancy(p),code=P.wcode(X.blend.o,X.blend.l);return cells.map(([i,j])=>{if(!P.inTown(p.cc,i,j)||P.NOBUILD[P.terrainAt(p.site,i,j)])return false;const o=occ.get(P.key(i,j));if(o&&o!=='wall')return false;if(X.tool==='erase'||X.tool==='copy')return o==='wall'?2:false;return (p.w[P.key(i,j)]|0)===code?2:true;});}
function drawStart(c){const p=plotOf();if(!p||!c)return;if(X.tool==='paste'){pasteAt(c);return;}X.draw={a:c,b:c,cells:drawCells(c,c)};X.draw.ok=classify(p,X.draw.cells);holo();if(!X.R)draw2d();}
function drawMove(c){if(!X.draw||!c)return;const p=plotOf();if(c[0]===X.draw.b[0]&&c[1]===X.draw.b[1])return;if(X.tool==='ring'&&Math.hypot(c[0]-X.draw.a[0],c[1]-X.draw.a[1])>44)return;X.draw.b=c;X.draw.cells=drawCells(X.draw.a,c);X.draw.ok=classify(p,X.draw.cells);holo();if(!X.R)draw2d();}
function drawEnd(){const d=X.draw,p=plotOf();X.draw=null;if(!d||!p){render();return;}
 const ONE=1000;   // one order carries at most 1,200 cells and 9,000 characters: copy and erase up to 1,000 at a time
 if(X.tool==='copy'){const cells=d.cells.filter(([i,j])=>p.w[P.key(i,j)]).map(([i,j])=>[i-Math.min(d.a[0],d.b[0]),j-Math.min(d.a[1],d.b[1]),p.w[P.key(i,j)]|0]);if(cells.length>ONE){say('COPY UP TO '+ONE+' WALL CELLS AT A TIME ('+cells.length+' IN THAT BOX)');render();return;}X.clip=cells.length?{cells}:null;say(cells.length?'COPIED '+cells.length+' WALL CELLS · PASTE IS READY':'NO WALLS IN THAT BOX');if(cells.length)X.tool='paste';render();return;}
 if(X.tool==='erase'){const keys=d.cells.filter(([i,j])=>p.w[P.key(i,j)]).map(([i,j])=>P.key(i,j));if(keys.length>ONE){say('ERASE UP TO '+ONE+' WALL CELLS AT A TIME ('+keys.length+' IN THAT BOX)');X.erase=null;render();return;}X.erase=keys.length?{keys,sec:{k:'cells',c:keys.flatMap(k=>k.split(',').map(Number))}}:null;if(!keys.length)say('NO WALLS IN THAT BOX');render();return;}
 if(X.draft.length>=P.MAX_SECTIONS){say('CONFIRM THESE FIRST (UP TO '+P.MAX_SECTIONS+' SECTIONS AN ORDER)');render();return;}
 X.draft.push({sec:{k:X.tool,a:d.a,b:d.b,o:X.blend.o,l:X.blend.l}});render();}
function pasteAt(c){const p=plotOf();if(!X.clip||!p)return;const by=new Map();for(const [di,dj,code] of X.clip.cells){const i=c[0]+di,j=c[1]+dj;if(!P.inGrid(i,j))continue;if(!by.has(code))by.set(code,[]);by.get(code).push(i,j);}
 if(X.draft.length+by.size>P.MAX_SECTIONS){say('CONFIRM THE DRAFT FIRST (UP TO '+P.MAX_SECTIONS+' SECTIONS AN ORDER)');return;}for(const [code,flat] of by){const {o,l}=P.wdecode(code);X.draft.push({sec:{k:'cells',c:flat,o,l}});}say('PASTED · CONFIRM WALLS TO BUILD');render();}
function input(){const el=X.stage,pts=new Map();let start=null,moved=0,pinch=0,mid=null;
 const drawing=()=>X.view!=='drive'&&X.mode==='walls'&&!X.pan&&!X.place,driving=()=>X.view==='drive'&&!!X.drive&&!X.tour;
 X.onKey=e=>{if(!X?.drive)return;if(e.target?.closest?.('input,textarea,select,[contenteditable]'))return;const k=String(e.key||'').toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){X.drive.keys[k]=e.type==='keydown'&&X.view==='drive';if(X.view==='drive')e.preventDefault();}};root.addEventListener?.('keydown',X.onKey);root.addEventListener?.('keyup',X.onKey);
 const stick=(e)=>{const D=X.drive,dx=e.clientX-start.x,dy=e.clientY-start.y,L=Math.hypot(dx,dy),k=Math.min(1,L/56)/(L||1);D.stick.x=dx*k;D.stick.z=dy*k;const se=X.stickEl;if(se){const r=X.stage.getBoundingClientRect();se.hidden=false;se.style.left=(start.x-r.left)+'px';se.style.top=(start.y-r.top)+'px';se.firstChild.style.transform='translate('+(D.stick.x*28)+'px,'+(D.stick.z*28)+'px)';}};
 el.addEventListener('pointerdown',e=>{if(e.target.closest?.('button'))return;   // ⟲ ⤢ ✥ sit on the map: tapping them never draws a wall cell
  el.setPointerCapture?.(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=0;
  if(pts.size===1){start={x:e.clientX,y:e.clientY,cx:X.cam.x,cz:X.cam.z};if(drawing())drawStart(cellAt(e.clientX,e.clientY));}
  else if(pts.size===2){const [a,b]=[...pts.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};start=null;if(X.draw){X.draw=null;holo();}}});
 const panBy=(dx,dy,cx,cz)=>{const k=X.cam.dist/((el.clientHeight||600)*.9),cs=Math.cos(X.cam.yaw),sn=Math.sin(X.cam.yaw),lim=(P.townH(plotOf()?.cc||1)+6)*P.GRID.cell;X.cam.x=Math.max(-lim,Math.min(lim,cx-(dx*cs+dy*sn)*k));X.cam.z=Math.max(-lim,Math.min(lim,cz-(-dx*sn+dy*cs)*k));};
 el.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===2){const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y),m={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(pinch){if(X.view==='drive'&&X.chase)X.chase.dist=Math.max(9,Math.min(40,X.chase.dist*pinch/d));else X.cam.dist=Math.max(45,Math.min(330,X.cam.dist*pinch/d));}if(mid)panBy(m.x-mid.x,m.y-mid.y,X.cam.x,X.cam.z);pinch=d;mid=m;return;}
  if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;moved=Math.max(moved,Math.hypot(dx,dy));
  if(driving()){if(moved>6)stick(e);return;}
  if(drawing()){drawMove(cellAt(e.clientX,e.clientY));return;}
  if(moved>8)panBy(dx,dy,start.cx,start.cz);});
 const end=e=>{if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);if(X.drive){X.drive.stick.x=X.drive.stick.z=0;if(X.stickEl)X.stickEl.hidden=true;}if(pts.size===0){if(drawing()&&X.draw)drawEnd();else if(start&&moved<8&&(X.mode!=='walls'||X.view==='drive'))tap(e.clientX,e.clientY);start=null;pinch=0;mid=null;}else if(pts.size===1)mid=null;};
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('wheel',e=>{e.preventDefault();if(X.view==='drive'&&X.chase){X.chase.dist=Math.max(9,Math.min(40,X.chase.dist*(e.deltaY>0?1.1:.9)));return;}X.cam.dist=Math.max(45,Math.min(330,X.cam.dist*(e.deltaY>0?1.1:.9)));},{passive:false});
 const rot=X.ctx.button('⟲',()=>{X.cam.yaw=(X.cam.yaw+Math.PI/2)%(Math.PI*2);},'cq-plot-rot');rot.setAttribute('aria-label','Rotate view');X.stage.append(rot);
 // ⌖ FRAME TOWN: back to the default 3/4 view on the Command Center (replaces the old ⤢ toggle: the sheet drags now).
 const fr=X.ctx.button('⌖',()=>{X.cam=frameCam(plotOf(),X.cam.yaw);},'cq-plot-frame');fr.setAttribute('aria-label','Frame town');fr.title='Frame town';X.stage.append(fr);
 // In WALLS one finger draws; ✥ switches one finger to panning (two fingers always pan and pinch).
 const pan=X.ctx.button('✥',()=>{X.pan=!X.pan;pan.classList.toggle('on',X.pan);pan.setAttribute('aria-pressed',String(X.pan));},'cq-plot-pan');pan.setAttribute('aria-label','One finger pans the map');pan.setAttribute('aria-pressed','false');X.stage.append(pan);X.panBtn=pan;}

function tankBanner(view){const bn=view?.authority?.state?.plot?.banner,veh=view?.vehicle,S=view?.style;if(!veh||!S||view.renderer?.isConquestCanvas)return;const key=bn?JSON.stringify(bn):'';if(veh.userData.bannerKey===key)return;veh.userData.bannerKey=key;
 const old=veh.getObjectByName('cq-tank-banner');if(old){veh.remove(old);old.traverse(o=>o.geometry?.dispose?.());}if(!bn)return;const m=kit(S).banner(bn,.42).mesh();m.name='cq-tank-banner';m.position.set(-2.1,1.1,-.9);m.rotation.y=Math.PI;m.userData.noPick=true;veh.add(m);}
root.ConquestPlotView=Object.freeze({open,close,frame,isOpen,render,setView,get state(){return X;},get sprites(){return {wait:SPRITE_WAIT.length,done:[...SPRITES.values()].filter(Boolean).length,failed:[...SPRITES.values()].filter(v=>!v).length,err:X?.sprErr||''};},guideStep,unlockLine,tankBanner,bannerCanvas});
})(globalThis);
