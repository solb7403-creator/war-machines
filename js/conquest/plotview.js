/* Command Base plot view (Session 5). The pilot's private base plot on the phone: site choice at first build, build mode
   (top-down camera, pinch zoom, grid snapping, rotate, move, hologram preview with valid/invalid tint, turret range rings),
   drag-to-draw walls, live construction (scaffolding and drones), crew and rovers, the Defense Drill replay and the base
   status. Presentation only: every change is a Worker action (worker/src/conquest-plot.js) validated with the shared rules
   (js/conquest/plot.js). Renders through the Conquest view's own renderer (one WebGL context, shared style programs);
   the 2D canvas renderer or the 2D setting gets a top-down canvas plot with the same controls. */
(function(root){
'use strict';
const P=root.ConquestPlot;
let X=null;   // the open plot view
const fmt=n=>typeof fmtNum==='function'?fmtNum(n):String(n);
const LABEL={cp:'CP',alloy:'ALLOY',biomass:'BIOMASS',helium:'HELIUM-3',fe:'FERRITE',il:'ILMENITE',ar:'ARMALCOLITE',tq:'TRANQ.',se:'SELENITE',mh:'MOONHEART'};
const price=c=>Object.entries(c||{}).filter(([,n])=>n>0).map(([k,n])=>fmt(n)+' '+LABEL[k]).join(' + ');
const dur=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return s<60?s+'s':s<3600?Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s':Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';};
const ICON={cc:'◆',refinery:'⚙',storage:'▦',reactor:'⚡',biodome:'✿',hangar:'⌂',helium:'⛽',radar:'◎',shield:'⛨',lab:'⚗',uplink:'⇡',trophy:'♛',cannon:'●',laser:'✦',missile:'➹',mortar:'◉',gate:'▯'};
const TIER_COL=['#000','#8a6a4c','#8fa3b5','#5f7ea8','#d9d2ff','#7fe3ff'];
function guideStep(p,s){// one clear step at a time, never a wall of options
 if(!p)return null;const has=t=>Object.values(p.b).some(b=>b.t===t&&(b.l>0||p.job?.id&&p.b[p.job.id]===b));
 if(!has('refinery'))return {id:'refinery',text:'STEP 1 · BUILD A REFINERY: it turns salvage into alloy. Tap BUILD.'};
 if(!P.TURRETS.some(has))return {id:'cannon',text:'STEP 2 · PLACE A CANNON TURRET: your first defense.'};
 if(!(p.log||[]).length)return {id:'drill',text:'STEP 3 · RUN A DEFENSE DRILL: watch Parasites test your layout (no rewards).'};
 if(p.cc<2)return {id:'cc',text:'STEP 4 · UPGRADE THE COMMAND CENTER TO CC2: it unlocks the Biodome, Hangar and Laser.'};
 return null;}
function unlockLine(p){const cc=p.cc,next=Object.entries(P.BUILDINGS).filter(([,B])=>B.cc===cc+1).map(([,B])=>B.n),walls=P.WALLS.filter(w=>w&&w.cc===cc+1).map(w=>w.n);return cc>=P.CC.max?'COMMAND CENTER AT MAXIMUM':'NEXT UNLOCK AT CC'+(cc+1)+': '+([...next,...walls].join(', ')||'higher building levels');}

// ------------------------------------------------------------------- 3D models (style kit) -----------------------------
function kit(S){const T=S.T,K=S.K,G=S.G,lin=h=>new T.Color(h),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3();
 const M=(x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>{_e.set(rx,ry,rz);_q.setFromEuler(_e);return new T.Matrix4().compose(_p.set(x,y,z),_q,_s.set(sx,sy,sz));};
 const C={rust:lin(0x7a4a2c),sand:lin(0x8f7c62),moss:lin(0x3f5a2a),plant:lin(0x3fae4a),glass:lin(0x9fd8ff),furnace:lin(0xff8a3d),steel:lin(0x6d7884),gold:K.gold,cyan:K.cyan,amber:K.amber,dark:K.dark,dark2:K.dark2,mid:K.mid,panel:K.panelA,panelB:K.panelB,roof:K.roof,violet:K.violet,red:K.red,teal:K.teal,ice:K.ice};
 const accent=l=>l>=5?C.gold:l>=3?C.teal:C.cyan;
 // A building at the local origin, footprint centred, facing +z; every level visibly changes it.
 function building(type,l,theme){const b=new S.Bld(),fin=theme?.finish==='sand'?C.sand:theme?.finish==='graphite'?C.dark:C.steel,s=P.sizeOf(type),W=s.w*P.GRID.cell,D=s.d*P.GRID.cell,L=Math.max(1,l),a=accent(L),hw=W/2,hd=D/2;
  const pad=()=>{b.box(0,.15,0,W-.4,.3,D-.4,C.dark2);b.box(0,.32,hd-.5,W-.6,.05,.12,a,1);};
  switch(type){
   case 'cc':{pad();let y=.3;const tiers=Math.min(10,L);for(let k=0;k<tiers;k++){const r=6.6-k*.48,h=1.5+(k%2)*.5;b.add(G.oct,M(0,y,0,0,k*.2,0,r,h,r),k%2?C.mid:fin);b.add(G.oct,M(0,y+h,0,0,k*.2,0,r*1.02,.12,r*1.02),a,1);y+=h;}
    b.add(G.cyl,M(0,y,0,0,0,0,.25,6+L*.4,.25),C.panel);b.box(0,y+6.4+L*.4,0,.7,.7,.7,L>=9?C.gold:C.ice,1.6);if(L>=5)for(const sx of [-1,1])for(const sz of [-1,1]){b.box(sx*5.6,2.2,sz*5.6,1.6,4.4+L*.25,1.6,C.dark);b.box(sx*5.6,4.5+L*.25,sz*5.6,1.8,.2,1.8,a,1);}
    if(L>=9){b.add(G.torus,M(0,y+2,0,Math.PI/2,0,0,4.2,4.2,4.2),C.gold,1.2);}break;}
   case 'refinery':{pad();b.box(-hw*.35,2.2,-hd*.2,W*.5,4.4,D*.55,fin);b.box(-hw*.35,4.5,-hd*.2,W*.52,.25,D*.57,C.roof);
    b.add(G.cyl,M(hw*.42,0,-hd*.35,0,0,0,1.5,6+L*.8,1.5),C.mid);b.add(G.cyl,M(hw*.42,5.8+L*.8,-hd*.35,0,0,0,1.65,.3,1.65),a,1);b.add(G.cyl,M(hw*.42,2,-hd*.35,0,0,0,1.55,.6,1.55),C.furnace,1.5);
    b.box(hw*.12,1.1,hd*.25,1,.25,D*.5,C.dark);b.box(hw*.12,1.25,hd*.25,.8,.06,D*.5,C.amber,.6);b.box(-hw*.2,1.6,hd*.62,2.2,2.2,1.6,C.rust);   // conveyor + ore hopper
    if(L>=2)b.add(G.cyl,M(-hw*.75,0,hd*.45,0,0,0,.6,4+L,.6),C.dark);if(L>=3)b.add(G.cyl,M(hw*.42,0,hd*.1,0,0,0,1.1,4+L*.6,1.1),C.mid);if(L>=4)b.box(-hw*.35,5,-hd*.2,W*.3,1.2,D*.3,C.panel);if(L>=5)b.add(G.cyl,M(hw*.42,0,hd*.42,0,0,0,.9,8,.9),C.gold,.3);break;}
   case 'storage':{pad();for(let k=0;k<Math.min(5,L)+1;k++){const x=-hw+1.8+(k%3)*3.6,z=-hd+2+Math.floor(k/3)*4.5;b.add(G.cyl,M(x,.3,z,0,0,0,1.4,2.6+L*.4,1.4),k%2?fin:C.mid);b.add(G.cyl,M(x,2.9+L*.4,z,0,0,0,1.45,.15,1.45),a,1);}
    for(let k=0;k<3+L;k++)b.box(-hw+1+(k%4)*1.6,.7+Math.floor(k/4)*.9,hd-1.4,1.3,.85,1.3,k%2?C.rust:C.sand);break;}
   case 'reactor':{pad();b.add(G.cyl,M(0,.3,0,0,0,0,3.6,3+L*.6,3.6),C.dark);const top=3.3+L*.6;for(let k=0;k<L+1;k++)b.add(G.torus,M(0,1+k*(top-1)/(L+1),0,Math.PI/2,0,0,3.75,3.75,3.75),C.cyan,1.6);b.add(G.ico,M(0,top+.8,0,0,0,0,1.3,1.3,1.3),C.ice,2);
    if(L>=3)for(const sx of [-1,1])b.add(G.cyl,M(sx*(hw-1.4),.3,-hd+1.4,0,0,0,1,4+L*.5,1),fin);break;}
   case 'biodome':{pad();b.add(G.hex,M(0,.3,0,0,0,0,hw-.4,.8,hd-.4),C.dark2);const R=Math.min(hw,hd)-.8,h=2.4+L*.7;for(let k=0;k<8;k++){const ang=k/8*Math.PI*2;b.add(G.box,M(Math.cos(ang)*R*.5,1.1+h*.45,Math.sin(ang)*R*.5,0,-ang,Math.PI/2-.9,.12,R*1.25,.12),C.panel);}
    b.add(G.ico,M(0,1.1,0,0,0,0,R*.98,h,R*.98),C.glass,.18);for(let k=0;k<4+L*2;k++){const ang=k*2.4,r=(k%3+1)*R*.22;b.add(G.cone6,M(Math.cos(ang)*r,1.1,Math.sin(ang)*r,0,ang,0,.5,.8+L*.35+(k%2)*.4,.5),k%2?C.plant:C.moss,.25);}break;}
   case 'hangar':{pad();b.box(0,3,-hd*.15,W-1,6,D*.7,fin);b.box(0,6.1,-hd*.15,W-.8,.3,D*.72,C.roof);b.box(0,3,hd*.2+.1,W-2.4,5.2,.2,C.dark);for(let k=0;k<Math.min(4,L);k++){const x=-hw+2.5+k*((W-5)/Math.max(1,Math.min(4,L)-1||1));b.box(x,.9,hd*.35,2.2,1,3.2,C.mid);b.box(x,1.7,hd*.3,1.4,.6,1.6,C.dark2);b.box(x,1.75,hd*.3+1.4,.18,.18,1.8,C.dark);}
    b.box(0,5.9,hd*.21,W-2.4,.2,.15,a,1);break;}
   case 'helium':{pad();for(const sx of [-1,1])for(const sz of [-1,1])b.seg(new T.Vector3(sx*1.8,.3,sz*1.8),new T.Vector3(0,6+L,0),.18,C.panel);b.add(G.cyl,M(0,.3,0,0,0,0,.45,4,.45),C.dark);for(let k=0;k<Math.min(4,L);k++)b.add(G.cyl,M(-hw+1.2+k*1.9,.3,hd-1.2,0,0,0,.8,1.8,.8),C.ice,.25);b.box(0,6+L,0,.5,.5,.5,a,1.4);break;}
   case 'radar':{pad();b.add(G.cyl,M(0,.3,0,0,0,0,.5,3+L*.5,.5),C.mid);b.box(0,.8,0,3,1,3,C.dark);break;}
   case 'shield':{pad();b.add(G.hex,M(0,.3,0,0,0,0,1.8,1.4,1.8),C.dark);b.add(G.cone6,M(0,1.7,0,0,0,0,.9,3+L*.6,.9),C.mid);b.add(G.ico,M(0,5+L*.6,0,0,0,0,.7,.7,.7),C.cyan,2);break;}
   case 'lab':{pad();b.box(0,2,0,W-1.4,4,D-1.4,fin);b.box(0,4.1,0,W-1.2,.25,D-1.2,C.roof);b.add(G.cyl,M(0,4.2,0,0,0,0,1.6,.4+L*.4,1.6),C.violet,.8);b.box(0,2.4,hd-.65,W-3,1.4,.1,C.violet,1);break;}
   case 'uplink':{pad();const h=6+L*1.6;for(const sx of [-1,1])for(const sz of [-1,1])b.seg(new T.Vector3(sx*1.4,.3,sz*1.4),new T.Vector3(sx*.25,h,sz*.25),.12,C.panel);for(let k=1;k<4;k++)b.box(0,h*k/4,0,2.8*(1-k/4)+.3,.08,.08,C.mid);b.box(0,h+.3,0,.35,.6,.35,C.red,2);break;}
   case 'trophy':{pad();b.box(0,2.2,-hd*.2,W-1.4,4.4,D*.55,C.dark2);b.add(G.cone5,M(0,4.4,-hd*.2,0,Math.PI/4,0,W*.5,1.6,D*.4),C.gold,.2);for(let k=0;k<3+L*2;k++){const x=-hw+1.4+(k%5)*((W-2.8)/4),z=hd-1.8+Math.floor(k/5)*-1.2;b.box(x,.7,z,.8,.8,.8,C.dark);b.add(G.octa,M(x,1.5,z,0,k,0,.3,.4,.3),k%3?C.gold:C.ice,1.4);}break;}
   case 'gate':{b.box(0,1.8,0,3.8,3.6,3.8,C.dark);b.box(0,1.6,1.95,2.4,3,.1,C.amber,.8);b.box(0,3.65,0,4,.15,4,C.cyan,1);break;}
   default:{if(P.BUILDINGS[type]?.turret){b.add(G.hex,M(0,0,0,0,0,0,1.6,.6,1.6),C.dark2);b.add(G.cyl,M(0,.6,0,0,0,0,.9,.6+L*.15,.9),fin);b.add(G.hex,M(0,1.2+L*.15,0,0,0,0,1.66,.08,1.66),a,1);}}}
  return b;}
 // The rotating head of turrets (and the radar dish): a separate small mesh so it can aim.
 function head(type,l){const b=new S.Bld(),L=Math.max(1,l),a=accent(L);
  if(type==='cannon'){b.box(0,0,0,1.4,.9,1.6,C.mid);b.add(G.cyl,M(0,.15,.6,Math.PI/2,0,0,.18,2.2+L*.2,.18),C.dark);b.box(0,.5,0,1.1,.1,1.1,a,1);}
  else if(type==='laser'){b.add(G.ico,M(0,.2,0,0,0,0,.75,.75,.75),C.dark);b.add(G.cyl,M(0,.2,.4,Math.PI/2,0,0,.28,1.4,.28),C.panel);b.box(0,.2,1.85,.32,.32,.1,C.cyan,2.2);}
  else if(type==='missile'){b.box(0,.3,0,1.6,1,1.4,C.mid);for(let k=0;k<4;k++)b.box(-.4+(k%2)*.8,.1+Math.floor(k/2)*.45,.72,.35,.35,.12,C.red,1);}
  else if(type==='mortar'){b.add(G.cyl,M(0,0,0,-.7,0,0,.45,1.8+L*.15,.45),C.dark);b.add(G.cyl,M(0,0,0,0,0,0,.7,.4,.7),C.mid);}
  else if(type==='radar'){b.add(G.cone6,M(0,.4,0,Math.PI*.38,0,0,1.6+l*.25,.6,1.6+l*.25),C.panelB);b.box(0,.2,0,.3,.6,.3,a,1.2);}
  return b;}
 // Wall cells by tier: visibly different minerals.
 function wallCell(b,x,z,t,nb){const h=[0,2.6,3,3.3,3.5,3.8][t],col=[null,C.rust,C.steel,lin(0x55657e),lin(0xcfc6ff),lin(0x141a2a)][t],em=t===4?.35:0;
  b.box(x,h/2,z,3.6,h,3.6,col,em);b.box(x,h+.08,z,3.8,.16,3.8,t>=3?(t===5?lin(0x9fe8ff):t===4?lin(0xe7dcff):C.cyan):C.dark2,t>=3?1.2:0);
  if(t===5)for(const s of [-1,1])b.box(x+s*1.81,h*.55,z,.06,h*.8,2.6,lin(0x9fe8ff),2);if(t===2)b.box(x,h*.5,z+1.81,3,.1,.06,C.panelB);
  for(const [dx,dz] of nb)b.box(x+dx*2,h*.45,z+dz*2,dx?.8:3.2,h*.9,dz?.8:3.2,col,em);}
 function person(){const b=new S.Bld();b.box(0,.55,0,.35,.7,.25,C.amber);b.box(0,1.08,0,.24,.26,.24,C.panelB);return b.geometry();}
 function rover(){const b=new S.Bld();b.box(0,.6,0,1.2,.5,2,C.sand);b.box(0,1,-.3,.9,.4,.9,C.dark2);for(const sx of [-1,1])for(const sz of [-.7,.7])b.add(G.cylC,M(sx*.7,.35,sz,0,0,Math.PI/2,.35,.25,.35),C.dark);b.box(0,1.25,-.3,.2,.1,.2,C.cyan,1.5);return b.geometry();}
 function foe(kind){const b=new S.Bld();if(kind==='d'){b.add(G.blob1,M(0,0,0,0,0,0,.8,.35,.8),K.chitin);b.box(0,0,0,2,.06,.25,K.mag,1.4);}else{const s=kind==='s'?1.6:1;b.add(G.blob1,M(0,s*.7,0,0,0,0,s,s*.7,s*1.3),K.chitin);b.box(0,s*.9,s*1.1,s*.5,s*.15,.15,K.mag,1.6);}return b.geometry();}
 return {T,M,C,building,head,wallCell,person,rover,foe,lin};}

// ------------------------------------------------------------------- scene ---------------------------------------------
function scene3d(view){const S=view.style,T=view.T;if(!S||view.renderer.isConquestCanvas)return null;const k=kit(S),sc=new T.Scene();sc.background=new T.Color(0x05070d);sc.fog=new T.Fog(0x06070f,240,900);
 const cam=new T.PerspectiveCamera(50,1,.5,1600);const g={terrain:new T.Group(),build:new T.Group(),walls:new T.Group(),holo:new T.Group(),grid:new T.Group(),fx:new T.Group(),actors:new T.Group()};for(const v of Object.values(g))sc.add(v);
 const crewN=S.low?6:12,crew=new T.InstancedMesh(k.person(),S.MAT.solid,crewN),rovers=new T.InstancedMesh(k.rover(),S.MAT.solid,S.low?2:3);crew.frustumCulled=rovers.frustumCulled=false;g.actors.add(crew,rovers);
 const foes={r:new T.InstancedMesh(k.foe('r'),S.MAT.solid,48),s:new T.InstancedMesh(k.foe('s'),S.MAT.solid,24),d:new T.InstancedMesh(k.foe('d'),S.MAT.solid,24)};for(const m of Object.values(foes)){m.count=0;m.frustumCulled=false;g.actors.add(m);}
 const shotGeo=(()=>{const b=new S.Bld();b.box(0,0,.5,.18,.18,1,k.C.amber,2.4);return b.geometry();})(),shots=new T.InstancedMesh(shotGeo,S.MAT.solid,40);shots.count=0;shots.frustumCulled=false;g.actors.add(shots);
 return {S,T,k,sc,cam,g,crew,rovers,foes,shots,meshes:new Map(),heads:[],keys:{},anim:[]};}
function terrainMesh(R,site){const {S,T,k}=R,b=new S.Bld(),n=P.GRID.n,c=P.GRID.cell,half=n*c/2,step=4,ext=60;
 const col=(x,z)=>{const i=Math.round(x/c+(n-1)/2),j=Math.round(z/c+(n-1)/2),t=P.terrainAt(site,i,j),h=P.heightAt(site,x,z);
  if(Math.abs(x)>half+2||Math.abs(z)>half+2)return [.05,.05,.06];if(t==='water')return [.03,.08,.14];if(t==='lush')return [.09,.14,.06];if(t==='deposit')return [.24,.12,.06];if(t==='lane')return [.11,.1,.09];
  const r=h>1.2?.075:.1;return site==='delta'?[r*.8,r*.95,r*.6]:site==='crater'?[r*1.05,r*.95,r*.85]:[r,r,r*1.05];};
 const H=(x,z)=>Math.abs(x)>half+2||Math.abs(z)>half+2?P.heightAt(site,Math.sign(x)*Math.min(Math.abs(x),half),Math.sign(z)*Math.min(Math.abs(z),half))+(site==='canyon'?8:2)+((Math.abs(x)+Math.abs(z))%23)*.05:P.heightAt(site,x,z);
 for(let x=-half-ext;x<half+ext;x+=step)for(let z=-half-ext;z<half+ext;z+=step){const q=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]].map(([a,bb])=>[a,H(a,bb),bb]),cc=col(x+step/2,z+step/2),tc=new T.Color(cc[0],cc[1],cc[2]);b.quad(q[0],q[3],q[2],q[1],tc,0);}
 if(site==='delta'){const w=new S.Bld(),wc=new T.Color(.05,.16,.26);for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(P.terrainAt(site,i,j)==='water')w.box(P.cellX(i),-.35,P.cellZ(j),c,.1,c,wc,.35);R.g.terrain.add(w.mesh());}
 if(site==='crater')for(const d of P.RIM_DEPOSITS){const bb=new S.Bld();for(let k2=0;k2<6;k2++)bb.add(S.G.rock,k.M(P.cellX(d.i)+2+(k2%3-1)*1.6,.4,P.cellZ(d.j)+2+(k2>2?1.2:-1.2),0,k2,0,1.1,.8,1.1),k.C.rust);bb.box(P.cellX(d.i)+2,.05,P.cellZ(d.j)+2,7,.08,7,k.C.amber,.5);R.g.terrain.add(bb.mesh());}
 // lane markers: amber chevrons where attackers enter
 for(const L of P.SITES[site].lanes){const bb=new S.Bld(),x=P.cellX(L.i),z=P.cellZ(L.j);bb.box(x,.06,z,L.j===0||L.j===n-1?L.w*c:2,.05,L.j===0||L.j===n-1?2:L.w*c,k.C.red,.9);R.g.terrain.add(bb.mesh());}
 const m=b.mesh();R.g.terrain.add(m);
 const earth=new S.Bld();earth.add(S.G.ico,k.M(-500,260,-900,0,0,0,90,90,90),new T.Color(.06,.16,.34),.9);earth.add(S.G.ico,k.M(-520,276,-880,0,0,0,62,62,62),new T.Color(.12,.24,.12),.5);R.g.terrain.add(earth.mesh());}
function gridMesh(R,site){const {S}=R,X=new S.Fx(),n=P.GRID.n,c=P.GRID.cell,half=n*c/2,ring=S.AT.SOLID||S.AT.BLOB;for(let i=0;i<=n;i++){const v=-half+i*c;X.flat(v,.12,0,.05,half,ring,[.05,.28,.34],0);X.flat(0,.12,v,half,.05,ring,[.05,.28,.34],0);}
 for(let i=0;i<n;i++)for(let j=0;j<n;j++)if(P.BLOCKED[P.terrainAt(site,i,j)]&&Math.abs(P.heightAt(site,P.cellX(i),P.cellZ(j)))<3)X.flat(P.cellX(i),.14,P.cellZ(j),c*.42,c*.42,ring,[.16,.03,.05],0);R.g.grid.add(X.mesh());}
function holoMesh(R,cellsList,ok,ring){const {S}=R,X=new S.Fx(),c=P.GRID.cell,col=ok?[.1,.9,.45]:[1,.18,.22],reg=S.AT.SOLID||S.AT.BLOB;
 for(const [i,j] of cellsList){const x=P.cellX(i),z=P.cellZ(j);X.flat(x,.2,z,c*.47,c*.47,reg,col.map(v=>v*.35),0);for(const [dx,dz,w,d] of [[0,-c/2,c/2,.06],[0,c/2,c/2,.06],[-c/2,0,.06,c/2],[c/2,0,.06,c/2]])X.flat(x+dx,.24,z+dz,w,d,reg,col,0);}
 if(ring)X.ringGlow(ring.x,ring.z,.6,ring.r,.5,ok?[.1,.75,1]:[1,.3,.3],64);return X.mesh();}

// ------------------------------------------------------------------- open / close --------------------------------------
function open(ctx){if(X)return;const {view,panel,el,button}=ctx;const st=()=>view.authority?.state;
 const d=el('section','cq-dialog cq-plot',null,panel);d.setAttribute('role','dialog');d.setAttribute('aria-label','Command Base plot');
 X={ctx,d,mode:'view',sel:null,place:null,wall:null,cam:{x:0,z:6,dist:150,tilt:.95,yaw:0},drill:null,clock:0,lastKey:'',busy:false};
 const top=el('div','cq-plot-top',null,d),title=el('div','cq-plot-title','',top);top.append(button('LEAVE BASE',()=>close(),'cq-plot-leave'));X.title=title;
 X.stage=el('div','cq-plot-stage',null,d);X.coach=el('p','cq-plot-coach','',d);X.coach.setAttribute('role','status');
 X.sheet=el('div','cq-plot-sheet',null,d);X.msg=el('p','cq-plot-msg','',d);X.msg.setAttribute('aria-live','polite');
 const s=st();if(!s?.base?.tier){sitePicker();return;}
 X.R=scene3d(view);if(!X.R){X.cv=el('canvas','cq-plot-canvas',null,X.stage);}
 input();render();}
function close(){if(!X)return;const R=X.R;if(R){R.sc.traverse(o=>{if(o.isMesh||o.isInstancedMesh){o.geometry?.userData?.hfShared||o.geometry?.dispose?.();}});}X.d.remove();X=null;}
function isOpen(){return !!X;}
const say=t=>{if(X){X.msg.textContent=t;X.msgAt=Date.now();}};
async function act(action,plot,label){if(!X||X.busy)return false;X.busy=true;say(label||'SENDING ORDER…');try{const ok=await X.ctx.view.requestAction(action,plot===undefined?{}:{plot});say(ok?(label?label.replace('…',' ✓'):'DONE'):(X?.ctx.view.authority?.error||'Online verification required.').replace(/^conquest: /,'').toUpperCase());if(ok&&X){X.place=null;X.wall=null;X.sel=action==='plot-remove'?null:X.sel;}render();return ok;}finally{if(X)X.busy=false;}}

// first build: pick one of four sites, then claim the plot (the existing first-base recipe)
function sitePicker(){const {el,button,view}=X.ctx,s=view.authority?.state,D=root.ConquestCombat.baseDefinition,L=s?.ledger;X.title.textContent='CLAIM YOUR BASE PLOT';X.stage.className='cq-plot-stage cq-plot-sites';
 el('p','cq-plot-intro','Your own private plot. Pick its site; it shapes your economy and your defense. You can change it once for free.',X.stage);let pick='ridge';const cards=[];
 for(const id of P.SITE_IDS){const S=P.SITES[id],c=button('',()=>{pick=id;cards.forEach(x=>x.classList.toggle('on',x.dataset.site===id));},'cq-site-card');c.dataset.site=id;el('b','',S.name,c);el('small','',S.bonus,c);if(id===pick)c.classList.add('on');cards.push(c);X.stage.append(c);}
 const need=Object.entries(D.recipe).map(([k,n])=>Math.min(n,k==='cp'?L?.cp||0:L?.banked?.[k]||0)+'/'+n+' '+LABEL[k]).join(' · ');el('p','cq-plot-need',need,X.sheet);
 X.sheet.append(button('CLAIM PLOT · '+price(D.recipe),async()=>{if(await act('build-base',undefined,'CLAIMING…')){}},'cq-plot-primary'));
 const claim=X.sheet.lastChild;claim.onclick=async()=>{if(X.busy)return;X.busy=true;try{const ok=await view.requestAction('build-base',{plot:{site:pick}});if(!X)return;if(!ok){say((view.authority?.error||'').replace(/^conquest: /,'').toUpperCase()||'ONLINE REQUIRED');return;}const ctx=X.ctx;close();open(ctx);say('PLOT CLAIMED · '+P.SITES[pick].name);}finally{if(X)X.busy=false;}};}

// ------------------------------------------------------------------- UI --------------------------------------------------
function render(){if(!X||!X.ctx.view.authority?.state?.plot)return;const {el,button,view}=X.ctx,s=view.authority.state,p=s.plot,L=s.ledger,now=Date.now(),sh=X.sheet;
 X.title.textContent='COMMAND BASE · '+P.SITES[p.site].name+' · CC'+p.cc+' · ⚡'+P.powerUse(p)+'/'+P.powerSupply(p)+' · POWER '+fmt(p.power||P.power(p));
 const g=guideStep(p,s);X.coach.textContent=g?g.text:'';X.coach.hidden=!g;
 sh.replaceChildren();const tabs=el('div','cq-plot-tabs',null,sh);for(const [m,lab] of [['view','BASE'],['build','BUILD'],['walls','WALLS'],['drill','DRILL']]){const b=button(lab,()=>{X.mode=m;X.place=null;X.wall=null;X.sel=null;render();},X.mode===m?'on':'');b.setAttribute('aria-pressed',String(X.mode===m));tabs.append(b);}
 const body=el('div','cq-plot-body',null,sh);
 const job=p.job;if(job){const B=job.t==='cc'?{n:'Command Center'}:P.BUILDINGS[job.t],left=job.ready-now,box=el('div','cq-plot-job',null,body);el('b','','BUILDER · '+B.n.toUpperCase()+' '+romanOf(job.l)+' · '+dur(left),box);const pr=el('progress','',null,box);pr.max=1;pr.value=Math.max(0,Math.min(1,1-left/Math.max(1,job.ready-job.at)));
  el('small','','SECOND BUILDER and SPEED-UPS: store items, unavailable until payments are certified.',box);}
 if(X.mode==='view')viewTab(body,s,p,L,now);else if(X.mode==='build')buildTab(body,s,p,L);else if(X.mode==='walls')wallTab(body,s,p);else drillTab(body,s,p);
 sync();}
const romanOf=n=>['','I','II','III','IV','V','VI','VII','VIII','IX','X'][n]||String(n);
function resLine(el,parent,s,p){const L=s.ledger,st=p.st||{},bm=(typeof save!=='undefined'&&save.bmn)||s.airdrop?.view?.bmn||{},sp=p.mnSpent||{},stores=P.MNS.filter(k=>(bm[k]||0)-(sp[k]||0)>0).map(k=>((bm[k]||0)-(sp[k]||0))+' '+LABEL[k]).join(' · ');
 el('p','cq-plot-res','BANKED · '+fmt(L.cp)+' CP · '+fmt(L.banked.alloy)+' ALLOY · '+fmt(L.banked.biomass)+' BIOMASS · '+fmt(L.banked.helium)+' HELIUM-3',parent);el('p','cq-plot-res','BASE STORES · '+(stores||'empty (walls use minerals from here)'),parent);return {st,stores};}
function viewTab(body,s,p,L,now){const {el,button}=X.ctx;const {st}=resLine(el,body,s,p);const c=P.caps(p),r=P.rates(p);
 const prod=el('div','cq-plot-prod',null,body);el('b','','PRODUCTION · stops when the Storage Depot is full',prod);el('span','',['alloy','biomass','helium','fe'].filter(k=>r[k]>0||st[k]>0).map(k=>Math.floor(st[k]||0)+'/'+c[k]+' '+LABEL[k]+' (+'+(Math.round(r[k]*100)/100)+'/h)').join(' · ')||'Build a Refinery, Biodome or Helium Extractor to produce.',prod);
 if(['alloy','biomass','helium','fe'].some(k=>(st[k]||0)>=1))prod.append(button('COLLECT PRODUCTION',()=>act('plot-collect',{},'COLLECTING…'),'cq-plot-primary'));
 const sel=X.sel&&p.b[X.sel];if(sel){selCard(body,s,p,X.sel,sel);}else el('p','cq-plot-hint','Tap a building to upgrade, move or inspect it. Drag to pan, pinch to zoom.',body);
 const term=el('details','cq-map-fold',null,body);el('summary','','BASE TERMINAL · YIELD, BANKING, DEFENSE',term);X.ctx.terminal?.(term);}
function selCard(body,s,p,id,b){const {el,button}=X.ctx,isCC=b.t==='cc',B=isCC?{n:'Command Center',desc:'Gates every unlock and the points multiplier (tier '+romanOf(P.tierOf(p.cc))+', ×'+(root.CQ_BASE_MULT||[1,1.05,1.1,1.15,1.2,1.25])[P.tierOf(p.cc)]+').'}:P.BUILDINGS[b.t],l=isCC?p.cc:b.l,box=el('div','cq-plot-sel',null,body);
 el('b','',(ICON[b.t]||'')+' '+B.n.toUpperCase()+' '+romanOf(l),box);el('small','',B.desc+(B.turret?' Range '+Math.round(B.turret.range*P.SITES[p.site].range*(1+.04*(l-1)))+' m.':'')+(B.prod?' Produces '+Object.entries(B.prod).map(([k,v])=>Math.round(v*Math.max(1,l)*100)/100+' '+LABEL[k]+'/h').join(', ')+'.':''),box);
 const nl=l+1,err=P.buildCheck(p,isCC?'cc':b.t,nl,isCC?null:id),cost=nl<=(isCC?P.CC.max:B.max)?P.costOf(isCC?'cc':b.t,nl):null;
 if(cost){const up=button((err?'LOCKED · '+err.toUpperCase():'UPGRADE TO '+romanOf(nl)+' · '+price(cost)+' · '+dur(P.timeOf(isCC?'cc':b.t,nl))),()=>act('plot-upgrade',{id},'UPGRADING…'),'cq-plot-primary');up.disabled=!!err||!!p.job;box.append(up);}else el('small','','MAXIMUM LEVEL',box);
 if(!isCC||true){const mv=button('MOVE / ROTATE',()=>{X.mode='build';X.place={type:b.t,id,i:b.i,j:b.j,r:b.r|0};render();});box.append(mv);}
 if(!['cc','storage'].includes(b.t)){const rm=button('REMOVE (no refund)',()=>{if(rm.dataset.sure){act('plot-remove',{id},'REMOVING…');}else{rm.dataset.sure='1';rm.textContent='TAP AGAIN TO REMOVE';}},'cq-plot-danger');box.append(rm);}}
function buildTab(body,s,p,L){const {el,button}=X.ctx;if(X.place){const q=X.place,B=q.type==='cc'?{n:'Command Center'}:P.BUILDINGS[q.type],err=q.id?P.placeError(p,q.type,q.i,q.j,q.r,q.id):(P.buildCheck(p,q.type,1)||P.placeError(p,q.type,q.i,q.j,q.r));
  el('b','',(q.id?'MOVE · ':'PLACE · ')+B.n.toUpperCase(),body);el('small','',err?'✕ '+err.toUpperCase():'✓ VALID · tap the ground to move the blueprint'+(q.id?'':' · '+price(P.costOf(q.type,1))+' · '+dur(P.timeOf(q.type,1))),body);
  const row=el('div','cq-plot-row',null,body);row.append(button('↻ ROTATE',()=>{q.r=(q.r+1)%4;render();}),button('CANCEL',()=>{X.place=null;render();}));const ok=button(q.id?'CONFIRM MOVE':'CONFIRM BUILD',()=>q.id?act('plot-move',{id:q.id,i:q.i,j:q.j,r:q.r},'MOVING…'):act('plot-build',{type:q.type,i:q.i,j:q.j,r:q.r},'CONSTRUCTION ORDERED…'),'cq-plot-primary');ok.disabled=!!err||(!q.id&&!!p.job);row.append(ok);return;}
 const g=guideStep(p,s),list=Object.entries(P.BUILDINGS).filter(([k,B])=>p.cc>=B.cc&&(B.turret?P.turretCount(p)<P.TURRET_CAP[p.cc-1]:P.countOf(p,k)<P.countCap(k,p.cc)));
 el('p','cq-plot-hint',list.length?'Buildable now at CC'+p.cc+':':'Everything available at CC'+p.cc+' is placed.',body);const grid=el('div','cq-plot-cards',null,body);
 for(const [k,B] of list){const err=P.buildCheck(p,k,1),c=button('',()=>{const at=P.autoPlace(p,k)||{i:20,j:20,r:0};X.place={type:k,...at};X.cam.x=P.cellX(at.i);X.cam.z=P.cellZ(at.j);render();},'cq-plot-card'+(g?.id===k?' cq-plot-glow':''));el('b','',(ICON[k]||'')+' '+B.n,c);el('small','',err?err.toUpperCase():price(B.cost[0])+' · '+dur(P.timeOf(k,1)),c);c.disabled=!!err;grid.append(c);}
 el('p','cq-plot-next',unlockLine(p),body);}
function wallTab(body,s,p){const {el,button}=X.ctx;const tiers=P.WALLS.map((w,t)=>w&&p.cc>=w.cc?t:0).filter(Boolean);X.tier=tiers.includes(X.tier)?X.tier:tiers[0];resLine(el,body,s,p);
 const row=el('div','cq-plot-row',null,body);for(const t of tiers){const W=P.WALLS[t],b=button(W.n.replace(' wall',''),()=>{X.tier=t;render();},X.tier===t?'on':'');b.style.borderColor=TIER_COL[t];row.append(b);}
 el('small','','DRAG ON THE GROUND to draw a straight wall ('+Object.keys(p.w).length+'/'+P.wallCap(p.cc)+' sections). '+P.WALLS[X.tier].n+': '+price(P.WALLS[X.tier].cost)+' a section. Next tier at CC'+(P.WALLS.find(w=>w&&w.cc>p.cc)?.cc||'—')+'.',body);
 if(X.wall?.cells?.length){const err=P.wallError(p,X.wall.cells,X.tier),cost=P.wallCost(p,X.wall.cells,X.tier);el('b','',X.wall.cells.length+' SECTIONS · '+price(cost)+(err?' · ✕ '+err.toUpperCase():''),body);const r2=el('div','cq-plot-row',null,body);
  const ok=button('BUILD WALL',()=>act('plot-wall',{cells:X.wall.cells,tier:X.tier},'BUILDING WALL…'),'cq-plot-primary');ok.disabled=!!err;r2.append(button('CANCEL',()=>{X.wall=null;render();}),ok);
  const short=storesShort(s,p,cost);if(short)r2.append(button('MOVE '+price(short)+' TO BASE STORES',()=>moveStores(short)));
  r2.append(button('REMOVE THESE',()=>act('plot-remove',{cells:X.wall.cells},'REMOVING…'),'cq-plot-danger'));}}
function storesShort(s,p,cost){const bm=(typeof save!=='undefined'&&save.bmn)||{},sp=p.mnSpent||{},o={};for(const k of P.MNS)if(cost[k]){const have=(bm[k]||0)-(sp[k]||0);if(have<cost[k])o[k]=cost[k]-have;}return Object.keys(o).length?o:null;}
async function moveStores(mn){if(typeof baseStore!=='function'){say('UPDATE THE GAME TO MOVE MINERALS');return;}say('MOVING MINERALS FROM YOUR WALLET…');const ok=await baseStore(mn);say(ok?'MINERALS IN BASE STORES':'NOT MOVED');render();}
function drillTab(body,s,p){const {el,button}=X.ctx;el('p','cq-plot-hint','A simulated Parasite attack on your own layout ('+P.SITES[p.site].lanes.length+' approach lanes). Watch your defenses work. Drills never pay rewards.',body);
 const wait=Math.max(0,(p.drillAt||0)+60000-Date.now()),b=button(X.drill?'DRILL RUNNING…':wait?'CREWS RESET · '+dur(wait):'START DEFENSE DRILL',async()=>{if(await act('plot-drill',{},'DRILL CREWS DEPLOYING…'))startReplay();},'cq-plot-primary');b.disabled=!!X.drill||wait>0;body.append(b);
 if(X.drillResult){const r=X.drillResult;el('b','cq-plot-result '+r.outcome,(r.outcome==='breached'?'BREACHED':r.outcome==='repelled'?'REPELLED':'HELD')+' · '+r.kills+'/'+r.spawned+' PARASITES DOWN · '+r.lost+' STRUCTURES LOST · COMMAND CENTER '+r.core+'%',body);}
 const log=el('details','cq-map-fold',null,body);el('summary','','BASE LOG · '+(p.log||[]).length+' DRILLS',log);for(const e of p.log||[])el('p','',new Date(e.at).toLocaleString()+' · '+e.outcome.toUpperCase()+' · '+e.kills+'/'+e.spawned+' · '+e.lost+' lost · CC '+e.core+'%',log);}

// ------------------------------------------------------------------- scene sync / frame -------------------------------
function sync(){const R=X?.R,s=X?.ctx.view.authority?.state,p=s?.plot;if(!p)return;if(!R){draw2d();return;}const {S,T,k,g}=R;
 if(R.site!==p.site){R.site=p.site;g.terrain.clear();g.grid.clear();terrainMesh(R,p.site);gridMesh(R,p.site);}
 g.grid.visible=X.mode!=='view'&&X.mode!=='drill';
 const want=new Set();R.heads=[];R.anim=[];const theme=p.theme;
 for(const [id,b] of Object.entries(p.b)){const building=p.job?.id===id||p.job?.t==='cc'&&b.t==='cc',lvl=b.t==='cc'?p.cc:b.l,key=[b.t,lvl,b.i,b.j,b.r|0,building?1:0,theme?.finish||''].join(':');want.add(id);let e=R.meshes.get(id);
  if(!e||e.key!==key){if(e){g.build.remove(e.o);e.o.traverse(o=>o.geometry?.dispose?.());}const o=new T.Group(),s2=P.sizeOf(b.t,b.r|0);o.position.set(P.cellX(b.i)+(s2.w-1)*P.GRID.cell/2,0,P.cellZ(b.j)+(s2.d-1)*P.GRID.cell/2);o.rotation.y=-(b.r|0)*Math.PI/2;
   if(lvl>0||building){const m=k.building(b.t,Math.max(1,lvl),theme).mesh();m.userData.id=id;o.add(m);}
   const hd=P.BUILDINGS[b.t]?.turret||b.t==='radar'?k.head(b.t,lvl).mesh():null;if(hd){hd.position.y=b.t==='radar'?3.3+lvl*.5:1.4+lvl*.15;o.add(hd);o.userData.head=hd;}
   if(building){const sc=new S.Bld(),s3=P.sizeOf(b.t),W=s3.w*P.GRID.cell,D=s3.d*P.GRID.cell,h=b.t==='cc'?10+p.cc:6;for(const [x,z] of [[-1,-1],[1,-1],[1,1],[-1,1]])sc.box(x*W/2,h/2,z*D/2,.18,h,.18,k.C.amber,.6);for(let y=1.5;y<h;y+=2.2){sc.box(0,y,-D/2,W,.12,.12,k.C.amber,.5);sc.box(0,y,D/2,W,.12,.12,k.C.amber,.5);sc.box(-W/2,y,0,.12,.12,D,k.C.amber,.5);sc.box(W/2,y,0,.12,.12,D,k.C.amber,.5);}
    const scm=sc.mesh();scm.userData.scaffold=true;o.add(scm);const dr=new S.Bld();for(let q=0;q<3;q++)dr.box(Math.cos(q*2.1)*W*.6,h+1.5,Math.sin(q*2.1)*D*.6,.8,.25,.8,k.C.cyan,2);const drm=dr.mesh();o.add(drm);o.userData.drones=drm;}
   g.build.add(o);e={o,key,id};R.meshes.set(id,e);}
  if(e.o.userData.head)R.heads.push(e.o);if(e.o.userData.drones)R.anim.push(e.o);}
 for(const [id,e] of R.meshes)if(!want.has(id)){g.build.remove(e.o);e.o.traverse(o=>o.geometry?.dispose?.());R.meshes.delete(id);}
 const wk=JSON.stringify(p.w);if(R.keys.walls!==wk){R.keys.walls=wk;g.walls.clear();const b=new S.Bld();for(const [kk,t] of Object.entries(p.w)){const [i,j]=kk.split(',').map(Number),nb=[[1,0],[0,1]].filter(([a,c])=>p.w[P.key(i+a,j+c)]);k.wallCell(b,P.cellX(i),P.cellZ(j),t|0,nb);}if(b.n)g.walls.add(b.mesh());}
 // hologram blueprint / wall preview / selection ring
 g.holo.clear();if(X.place){const q=X.place,err=q.id?P.placeError(p,q.type,q.i,q.j,q.r,q.id):P.buildCheck(p,q.type,1)||P.placeError(p,q.type,q.i,q.j,q.r),B=P.BUILDINGS[q.type],s2=P.sizeOf(q.type,q.r),cl=P.cells({t:q.type,i:q.i,j:q.j,r:q.r});
  const ring=B?.turret?{x:P.cellX(q.i),z:P.cellZ(q.j),r:B.turret.range*P.SITES[p.site].range}:null;g.holo.add(holoMesh(R,cl,!err,ring));}
 if(X.wall?.cells)g.holo.add(holoMesh(R,X.wall.cells,!P.wallError(p,X.wall.cells,X.tier)));
 if(X.sel&&p.b[X.sel]){const b=p.b[X.sel],B=P.BUILDINGS[b.t];g.holo.add(holoMesh(R,P.cells(b),true,B?.turret?{x:P.cellX(b.i),z:P.cellZ(b.j),r:B.turret.range*P.SITES[p.site].range*(1+.04*(b.l-1))}:null));}}
function frame(dt){if(!X)return;X.clock+=dt;const s=X.ctx.view.authority?.state;if(s?.plot){const key=JSON.stringify([s.plot.b,s.plot.w,s.plot.job,s.plot.cc,s.plot.site,s.plot.st&&Math.floor((s.plot.st.alloy||0)+(s.plot.st.biomass||0)),s.ledger?.cp,(s.plot.log||[]).length]);if(key!==X.lastKey||Date.now()-(X.lastUi||0)>1000){X.lastKey=key;X.lastUi=Date.now();if(!X.d.contains(document.activeElement)||document.activeElement===document.body)render();else{X.title&&(X.title.textContent=X.title.textContent);sync();}}}
 if(X.msgAt&&Date.now()-X.msgAt>5000){X.msg.textContent='';X.msgAt=0;}
 const R=X.R;if(!R){if(X.drill)drillStep(dt);draw2d();return;}const {view}=X.ctx,T=R.T,c=X.cam,host=view.host;
 const w=host.clientWidth||390,h=host.clientHeight||844;if(R.cam.aspect!==w/h){R.cam.aspect=w/h;R.cam.updateProjectionMatrix();}
 const tilt=X.mode==='view'||X.mode==='drill'?Math.min(c.tilt,1.05):1.38,dist=c.dist;R.cam.position.set(c.x+Math.sin(c.yaw)*Math.cos(tilt)*dist,Math.sin(tilt)*dist,c.z+Math.cos(c.yaw)*Math.cos(tilt)*dist);R.cam.lookAt(c.x,0,c.z);
 for(const o of R.heads){const hd=o.userData.head;hd.rotation.y=hd.userData.aim??(X.clock*(o.userData.radar?1:.4))%(Math.PI*2);}
 for(const o of R.anim){const dr=o.userData.drones;dr.rotation.y=X.clock*1.4;dr.position.y=Math.sin(X.clock*3)*.4;}
 crewStep(R,s?.plot);if(X.drill)drillStep(dt);
 R.S.viewLights(R.cam);R.S.U.uTime.value=(R.S.U.uTime.value||0)+dt;const r=view.renderer;r.render(R.sc,R.cam);X.info={calls:r.info.render.calls,triangles:r.info.render.triangles,programs:r.info.programs?.length||0};}
// crew walk between buildings, rovers drive the lanes (presentation)
function crewStep(R,p){if(!p)return;const T=R.T,mt=R._m||(R._m=new T.Matrix4()),bs=Object.values(p.b).filter(b=>b.l>0||b.t==='cc');if(!bs.length)return;const pos=b=>[P.cellX(b.i)+2,P.cellZ(b.j)+2];
 for(let n=0;n<R.crew.count;n++){const a=bs[n%bs.length],b=bs[(n*7+3)%bs.length],[x0,z0]=pos(a),[x1,z1]=pos(b),L=Math.hypot(x1-x0,z1-z0)||1,ph=((X.clock*1.3+n*11)%(2*L))/L,f=ph>1?2-ph:ph,x=x0+(x1-x0)*f+(n%3-1)*1.2,z=z0+(z1-z0)*f+5;mt.makeRotationY(Math.atan2(x1-x0,z1-z0)+(ph>1?Math.PI:0));mt.setPosition(x,0,z);R.crew.setMatrixAt(n,mt);}
 R.crew.instanceMatrix.needsUpdate=true;const lanes=P.SITES[p.site].lanes;for(let n=0;n<R.rovers.count;n++){const L=lanes[n%lanes.length],t=((X.clock*.05+n*.33)%1),x=P.cellX(L.i)*(1-t)+6*t,z=P.cellZ(L.j)*(1-t)+6*t;mt.makeRotationY(Math.atan2(6-P.cellX(L.i),6-P.cellZ(L.j)));mt.setPosition(x,0,z);R.rovers.setMatrixAt(n,mt);}R.rovers.instanceMatrix.needsUpdate=true;}

// ------------------------------------------------------------------- Defense Drill replay -----------------------------
function startReplay(){const s=X?.ctx.view.authority?.state,p=s?.plot,e=p?.log?.[0];if(!e)return;const r=P.drill(p,e.seed);X.drill={r,t:0,fi:0,ei:0,shots:[]};X.drillResult=null;X.mode='drill';X.cam.dist=Math.min(X.cam.dist,170);render();}
function drillStep(dt){const D=X.drill,R=X.R;D.t+=dt*1.6;const fr=D.r.frames;while(D.fi<fr.length-1&&fr[D.fi+1].t<=D.t)D.fi++;const a=fr[D.fi],b=fr[Math.min(fr.length-1,D.fi+1)],f=b.t>a.t?Math.max(0,Math.min(1,(D.t-a.t)/(b.t-a.t))):0;
 const bm=new Map(b.f.map(q=>[q[0],q]));D.now=a.f.map(q=>{const n=bm.get(q[0]);return n?[q[0],q[1],q[2]+(n[2]-q[2])*f,q[3]+(n[3]-q[3])*f]:q;});D.dmg=new Map(a.s);
 const ev=D.r.events;while(D.ei<ev.length&&ev[D.ei].t<=D.t){const e=ev[D.ei++];if(e.k==='shot')D.shots.push({...e,life:.25});}D.shots=D.shots.filter(x=>(x.life-=dt)>0);
 if(R){const T=R.T,m=R._d||(R._d=new T.Matrix4()),cnt={r:0,s:0,d:0};for(const [,kind,x,z] of D.now){const im=R.foes[kind];if(cnt[kind]>=im.instanceMatrix.count)continue;m.makeRotationY(Math.atan2(-x,-z));m.setPosition(x,kind==='d'?6:0,z);im.setMatrixAt(cnt[kind]++,m);}for(const [kk,im] of Object.entries(R.foes)){im.count=cnt[kk];im.instanceMatrix.needsUpdate=true;}
  let n=0;const s=X.ctx.view.authority.state;for(const sh of D.shots){const b=s.plot.b[sh.from];if(!b||n>=40)continue;const x0=P.cellX(b.i),z0=P.cellZ(b.j),dx=sh.x-x0,dz=sh.z-z0,L=Math.hypot(dx,dz)||1;m.makeRotationY(Math.atan2(dx,dz));m.scale(new T.Vector3(1,1,L));m.setPosition(x0,2,z0);R.shots.setMatrixAt(n++,m);const e=R.meshes.get(sh.from);if(e?.o.userData.head)e.o.userData.head.userData.aim=Math.atan2(dx,dz)+(e.o.rotation.y||0);}R.shots.count=n;R.shots.instanceMatrix.needsUpdate=true;
  for(const [id,e] of R.meshes){const hp=D.dmg.get(id);e.o.visible=hp!==0;}}
 if(D.t>=D.r.time+1){X.drillResult=D.r;X.drill=null;if(R){for(const im of Object.values(R.foes))im.count=0;R.shots.count=0;for(const e of R.meshes.values()){e.o.visible=true;if(e.o.userData.head)delete e.o.userData.head.userData.aim;}}render();}}

// ------------------------------------------------------------------- 2D fallback ---------------------------------------
function draw2d(){if(!X?.cv)return;const cv=X.cv,s=X.ctx.view.authority?.state,p=s?.plot;if(!p)return;const r=X.stage.getBoundingClientRect(),dpr=Math.min(2,root.devicePixelRatio||1);if(cv.width!==Math.round(r.width*dpr)){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);}
 const g=cv.getContext('2d'),n=P.GRID.n,cs=Math.min(cv.width,cv.height)/(n+2)*(150/X.cam.dist),ox=cv.width/2-X.cam.x/P.GRID.cell*cs,oy=cv.height/2-X.cam.z/P.GRID.cell*cs,X0=i=>ox+(i-(n-1)/2-.5)*cs,Y0=j=>oy+(j-(n-1)/2-.5)*cs;X.map2d={cs,ox,oy};
 g.fillStyle='#05070d';g.fillRect(0,0,cv.width,cv.height);for(let i=0;i<n;i++)for(let j=0;j<n;j++){const t=P.terrainAt(p.site,i,j);g.fillStyle={rim:'#2a2a30',cliff:'#1a1b20',water:'#123a5c',deposit:'#7a4a2c',lush:'#203a1c',lane:'#3a1c20',ground:'#2b2f36'}[t];g.fillRect(X0(i),Y0(j),cs-1,cs-1);}
 for(const [kk,t] of Object.entries(p.w)){const [i,j]=kk.split(',').map(Number);g.fillStyle=TIER_COL[t];g.fillRect(X0(i)+1,Y0(j)+1,cs-3,cs-3);}
 g.font=Math.round(cs*1.1)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';for(const [id,b] of Object.entries(p.b)){const s2=P.sizeOf(b.t,b.r|0),lvl=b.t==='cc'?p.cc:b.l;g.fillStyle=X.sel===id?'#ffd36b':lvl>0?'#4a5664':'#6a4a2a';g.fillRect(X0(b.i)+1,Y0(b.j)+1,s2.w*cs-2,s2.d*cs-2);g.fillStyle='#e8f6ff';g.fillText((ICON[b.t]||'?')+(lvl>0?romanOf(lvl):'…'),X0(b.i)+s2.w*cs/2,Y0(b.j)+s2.d*cs/2);}
 const holo=(cl,ok)=>{g.strokeStyle=ok?'#2dff8a':'#ff3048';g.lineWidth=2;for(const [i,j] of cl)g.strokeRect(X0(i)+1,Y0(j)+1,cs-2,cs-2);};if(X.place)holo(P.cells({t:X.place.type,i:X.place.i,j:X.place.j,r:X.place.r}),!(X.place.id?P.placeError(p,X.place.type,X.place.i,X.place.j,X.place.r,X.place.id):P.buildCheck(p,X.place.type,1)||P.placeError(p,X.place.type,X.place.i,X.place.j,X.place.r)));if(X.wall?.cells)holo(X.wall.cells,!P.wallError(p,X.wall.cells,X.tier));
 if(X.place&&P.BUILDINGS[X.place.type]?.turret){g.strokeStyle='#22e6ff';g.beginPath();g.arc(X0(X.place.i)+cs/2,Y0(X.place.j)+cs/2,P.BUILDINGS[X.place.type].turret.range*P.SITES[p.site].range/P.GRID.cell*cs,0,7);g.stroke();}
 if(X.drill?.now){for(const [,kind,x,z] of X.drill.now){g.fillStyle=kind==='d'?'#ff7ae8':'#ff2bd6';g.beginPath();g.arc(ox+x/P.GRID.cell*cs,oy+z/P.GRID.cell*cs,kind==='s'?cs*.45:cs*.3,0,7);g.fill();}}}

// ------------------------------------------------------------------- input ---------------------------------------------
function cellAt(clientX,clientY){const r=X.stage.getBoundingClientRect();if(X.R){const T=X.R.T,v=new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,X.R.cam);const t=-ray.ray.origin.y/ray.ray.direction.y;if(!(t>0))return null;const x=ray.ray.origin.x+ray.ray.direction.x*t,z=ray.ray.origin.z+ray.ray.direction.z*t;return [Math.round(x/P.GRID.cell+(P.GRID.n-1)/2),Math.round(z/P.GRID.cell+(P.GRID.n-1)/2)];}
 const m=X.map2d,dpr=X.cv.width/r.width;if(!m)return null;return [Math.floor(((clientX-r.left)*dpr-m.ox)/m.cs+(P.GRID.n-1)/2+.5),Math.floor(((clientY-r.top)*dpr-m.oy)/m.cs+(P.GRID.n-1)/2+.5)];}
function tap(cx,cy){const p=X.ctx.view.authority?.state?.plot,c=cellAt(cx,cy);if(!p||!c)return;const [i,j]=c;
 if(X.place){const s2=P.sizeOf(X.place.type,X.place.r);X.place.i=i-Math.floor((s2.w-1)/2);X.place.j=j-Math.floor((s2.d-1)/2);render();return;}
 if(X.mode==='walls')return;const occ=P.occupancy(p).get(P.key(i,j));X.sel=occ&&occ!=='wall'?occ:null;if(X.mode!=='view'&&X.sel)X.mode='view';render();}
function input(){const el=X.stage,pts=new Map();let start=null,moved=0,pinch=0;
 el.addEventListener('pointerdown',e=>{el.setPointerCapture?.(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=0;if(pts.size===1){start={x:e.clientX,y:e.clientY,cx:X.cam.x,cz:X.cam.z};if(X.mode==='walls'){const c=cellAt(e.clientX,e.clientY);if(c)X.wall={a:c,cells:[c]};render();}}else if(pts.size===2){const [a,b]=[...pts.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);start=null;}});
 el.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pts.size===2){const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch){X.cam.dist=Math.max(45,Math.min(260,X.cam.dist*pinch/d));}pinch=d;return;}
  if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;moved=Math.max(moved,Math.hypot(dx,dy));
  if(X.mode==='walls'&&X.wall){const c=cellAt(e.clientX,e.clientY);if(c){const cells=P.wallLine(X.wall.a,c);if(cells.length!==X.wall.cells.length||cells.at(-1)+''!==X.wall.cells.at(-1)+''){X.wall.cells=cells;sync();if(!X.R)draw2d();}}return;}
  if(moved>8){const k=X.cam.dist/((el.clientHeight||600)*.9),cs=Math.cos(X.cam.yaw),sn=Math.sin(X.cam.yaw);X.cam.x=Math.max(-90,Math.min(90,start.cx-(dx*cs+dy*sn)*k));X.cam.z=Math.max(-90,Math.min(90,start.cz-(-dx*sn+dy*cs)*k));}});
 const end=e=>{if(!pts.has(e.pointerId))return;pts.delete(e.pointerId);if(pts.size===0){if(start&&moved<8&&X.mode!=='walls')tap(e.clientX,e.clientY);if(X.mode==='walls'&&X.wall)render();start=null;pinch=0;}};
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('wheel',e=>{e.preventDefault();X.cam.dist=Math.max(45,Math.min(260,X.cam.dist*(e.deltaY>0?1.1:.9)));},{passive:false});
 const rot=X.ctx.button('⟲',()=>{X.cam.yaw=(X.cam.yaw+Math.PI/2)%(Math.PI*2);},'cq-plot-rot');rot.setAttribute('aria-label','Rotate view');X.stage.append(rot);}

root.ConquestPlotView=Object.freeze({open,close,frame,isOpen,render,get state(){return X;},guideStep,unlockLine});
})(globalThis);
