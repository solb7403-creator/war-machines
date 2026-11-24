/* Session 7B Citadel Act I: the stand-in looks of the fortress, drawn by the Conquest world view (js/conquest/view.js calls sync() each
   frame and model() before it builds a Parasite). STAND-INS ONLY, through named hooks the Fable Citadel session after 5E-2d2 replaces
   (ConquestCitadel.HOOKS names each one): the rampart, the gate and the shield gate, the generators, outer guns, Spore Mortars and
   their shells, forward cover, marked zones, Swarm vents, the warden and its shield core, the dropships (5E-2d2's
   js/conquest/dropship.js is used for a dropship's look when it is loaded: ConquestDropship.flight / stage). Presentation only:
   nothing here is read back by the fight. HIGH and LOW draw the same few boxes (well inside the LOW budget); the 2D canvas fallback
   draws the battle's units and marked zones as it does for every operation. */
(function(root){
'use strict';
const CI=()=>root.ConquestCitadel,Wd=()=>root.ConquestWorld;
const COL=Object.freeze({wall:0x5b4a52,gate:0x7a5a46,shield:0x7dd8ff,cover:0x6f7f86,zone:0xff8a4a,vent:0x3a2a33,gen:0x9be7ff,core:0x8fe7ff,ship:0x6d5a66});
// the fortress's static pieces for the battle's tier (built once a tier, positioned on the floating origin every frame)
function build(view,B){const T=view.T,CIm=CI(),L=CIm.LAYOUT,c0=CIm.centre(),g=new T.Group(),mats=[],geos=[];g.name='cq-citadel';g.userData.tier=B.cit.tier;
 const mat=(color,o={})=>{const m=new T.MeshStandardMaterial({color,roughness:.85,metalness:.1,...o});mats.push(m);return m;},box=(w,h,d)=>{const q=new T.BoxGeometry(w,h,d);geos.push(q);return q;};
 const wallM=mat(COL.wall),gateM=mat(COL.gate),coverM=mat(COL.cover),shieldM=new T.MeshBasicMaterial({color:COL.shield,transparent:true,opacity:.42,depthWrite:false});mats.push(shieldM);
 const zoneM=new T.MeshBasicMaterial({color:COL.zone,transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide});mats.push(zoneM);
 // the rampart: 8-metre blocks following the ground along each wall
 for(const s of L.walls){const x1=c0.x+s[0],z1=c0.z+s[1],x2=c0.x+s[2],z2=c0.z+s[3],len=Math.hypot(x2-x1,z2-z1),n=Math.max(1,Math.round(len/8)),geo=box(len/n+.4,4.2,3);
  for(let i=0;i<n;i++){const k=(i+.5)/n,x=x1+(x2-x1)*k,z=z1+(z2-z1)*k,m=new T.Mesh(geo,wallM);m.position.set(x,Wd().groundAt(x,z)+1.6,z);m.rotation.y=Math.atan2(x2-x1,z2-z1)+Math.PI/2;m.userData.noPick=true;g.add(m);}}
 // the gate frame (towers) and the shield gate across the gap (tier I) — the hard gate itself is a Parasite unit (cit 'gate')
 const gu=c0.x+L.gate.u;for(const v of [L.gate.v0-2,L.gate.v1+2]){const z=c0.z+v,t=new T.Mesh(box(4,7,4),gateM);t.position.set(gu,Wd().groundAt(gu,z)+3,z);t.userData.noPick=true;g.add(t);}
 const sh=new T.Mesh(box(1,6,L.gate.v1-L.gate.v0),shieldM);sh.position.set(gu,Wd().groundAt(gu,c0.z)+3,c0.z);sh.userData.noPick=true;sh.name='cq-shield-gate';g.add(sh);g.userData.shield=sh;
 // forward cover bunkers and marked bombardment zones (tier II), the Swarm vents (dark pits)
 for(const [x,z] of B.cit.cover||[]){const b=new T.Mesh(box(5,2.4,4),coverM);b.position.set(x,Wd().groundAt(x,z)+1.1,z);b.userData.noPick=true;g.add(b);}
 const ringGeo=new T.RingGeometry(CIm.CIT.mortar.zoneR-1.2,CIm.CIT.mortar.zoneR,40);geos.push(ringGeo);
 for(const [x,z] of B.cit.zones||[]){const r=new T.Mesh(ringGeo,zoneM);r.rotation.x=-Math.PI/2;r.position.set(x,Wd().groundAt(x,z)+.25,z);r.userData.noPick=true;g.add(r);}
 const ventM=mat(COL.vent,{roughness:1}),ventGeo=new T.CylinderGeometry(2.4,3,.6,10);geos.push(ventGeo);
 if(CIm.TIERS[B.cit.tier].swarm)for(const [u,v] of [...L.ventsOut,...L.ventsIn]){const x=c0.x+u,z=c0.z+v,m=new T.Mesh(ventGeo,ventM);m.position.set(x,Wd().groundAt(x,z)+.2,z);m.userData.noPick=true;g.add(m);}
 g.userData.dispose=()=>{for(const m of mats)m.dispose();for(const q of geos)q.dispose();};return g;}
function drop(view){const g=view.citGroup;if(!g)return;view.scene.remove(g);g.userData.dispose?.();view.citGroup=null;}
// every frame: the fortress for a Citadel battle (none otherwise), on the floating origin; the shield gate while a generator stands
function sync(view){const B=view.battle;if(!B?.cit||!view.T||!view.scene||view.renderer?.isConquestCanvas||!CI()){drop(view);return;}
 if(view.citGroup&&view.citGroup.userData.tier!==B.cit.tier)drop(view);if(!view.citGroup){view.citGroup=build(view,B);view.scene.add(view.citGroup);}
 const g=view.citGroup;g.position.set(-view.origin.x,0,-view.origin.z);const T=CI().TIERS[B.cit.tier];g.userData.shield.visible=T.gate==='shield'&&B.cit.stage<1;
 for(const e of B.enemies)if(e.warden)core(view.enemyMeshes?.get(e.id),e);else if(e.ship)ship(view,e,B);}
// HOOKS.dropship: with 5E-2d2's js/conquest/dropship.js loaded, the stand-in plays its flight's animation (tilt, roll, the crash) from
// ConquestCitadel.dropshipSpec(e); the position and hit box stay the assault's own
function ship(view,e,B){const D=root.ConquestDropship,m=view.enemyMeshes?.get(e.id);if(!D?.flight||!m)return;const spec=CI().dropshipSpec(e);if(!spec)return;
 try{const key=e.id+':'+(spec.hitAt??''),c=view.citShips||(view.citShips=new Map());let F=c.get(key);if(!F){F=D.flight({...spec,ground:(x,z)=>root.ConquestWorld.groundAt(x,z)});c.set(key,F);}
  const P=F.pose(B.time||0);if(P&&P.vis!==false){m.userData.pose={p:P.pitch||0,r:P.roll||0};m.userData.dropshipPhase=P.phase;}else delete m.userData.pose;}catch(_){}}   // view.js applies the pose after the ground orientation
// a Citadel unit's stand-in model (null: the view's own). Shapes cached per view (shared, never disposed per unit), the view's own
// materials, a gun group and the selection / tell marker every Parasite model carries (the view turns the gun and shows the tell)
function model(view,e){if(!(e.cit||e.swarm||e.ship||e.warden)||!view.T||typeof view.mat!=='function'||typeof view.form!=='function')return null;const T=view.T,g=new T.Group(),gun=new T.Group(),C=view.citCache||(view.citCache=new Map());g.add(gun);g.userData.gun=gun;
 const geo=(key,make)=>{let q=C.get(key);if(!q){q=make();q.userData.hfShared=true;view.shared?.push(q);C.set(key,q);}return q;};
 const add=(parent,key,make,color,y,rx=0,rz=0)=>{const m=new T.Mesh(geo(key,make),view.mat(color));m.position.y=y;m.rotation.x=rx;m.rotation.z=rz;parent.add(m);return m;};
 let top=5;
 if(e.cit==='gen'){add(g,'gen-post',()=>new T.CylinderGeometry(.85,1.2,3.6,10),0x4b5a63,1.8);add(g,'gen-core',()=>new T.SphereGeometry(.9,12,8),COL.gen,4.1);top=6;}
 else if(e.cit==='gate'){add(g,'gate',()=>new T.BoxGeometry(1.8,4.2,11),COL.gate,2.1);top=6;}
 else if(e.cit==='gun'){add(g,'gun-base',()=>new T.BoxGeometry(2.4,1.4,2.4),0x5b4a52,.7);add(gun,'gun-barrel',()=>new T.CylinderGeometry(.3,.3,2.6,8),0x2c2f33,1.9,0,Math.PI/2);top=4;}
 else if(e.cit==='mortar'){add(g,'mortar-pit',()=>new T.CylinderGeometry(1.5,1.8,1,12),0x584a3e,.5);add(gun,'mortar-tube',()=>new T.CylinderGeometry(.55,.7,2.2,10),0x7d6a4e,1.6,0,.5);top=4;}
 else if(e.swarm){add(g,'swarm',()=>new T.ConeGeometry(.55,1.1,6),0xb35a76,.6,Math.PI/2);top=2.4;}
 else if(e.ship){/* HOOKS.dropship: 5E-2d2's look replaces this stand-in; its flight's animation plays already (ship() above) */add(g,'ship-hull',()=>new T.BoxGeometry(5,2,8),COL.ship,0);add(g,'ship-wing',()=>new T.BoxGeometry(8.5,.3,2.4),0x4d3f48,.3);top=3;}
 else if(e.warden){add(g,'warden-body',()=>new T.CylinderGeometry(2,2.3,2.1,14),0x6a4252,1.05);add(gun,'warden-gun',()=>new T.CylinderGeometry(.5,.5,3.2,8),0x2c2f33,2.4,0,Math.PI/2);
  g.userData.core=add(g,'warden-core',()=>new T.TorusGeometry(2.6,.22,8,28),COL.core,2.3,Math.PI/2);top=6;}
 else return null;
 g.userData.marker=view.form(g,view.cone,0,top,0,.6,1,.6,0xff4b48);view.scene.add(g);return g;}
// the warden's shield core ring: shown while the core holds (called with the unit each frame by sync's caller when present)
function core(group,e){const r=group?.userData?.core;if(r)r.visible=(e.core|0)>0;}
root.ConquestCitadelView=Object.freeze({sync,model,core,drop});
})(globalThis);
