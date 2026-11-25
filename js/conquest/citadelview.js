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
 if(view.citBattle!==B){view.citBattle=B;view.citShips=null;view.citWave=null;}   // a new fight: its ships' flights and waves start over
 if(view.citGroup&&view.citGroup.userData.tier!==B.cit.tier)drop(view);if(!view.citGroup){view.citGroup=build(view,B);view.scene.add(view.citGroup);}
 const g=view.citGroup;g.position.set(-view.origin.x,0,-view.origin.z);const T=CI().TIERS[B.cit.tier];g.userData.shield.visible=T.gate==='shield'&&B.cit.stage<1;
 for(const e of B.enemies)if(e.warden)core(view.enemyMeshes?.get(e.id),e);else if(e.ship)ship(view,e,B);
 if(root.ConquestDropship?.flight&&view.style?.unit)stepOff(view,B);}
// HOOKS.dropship (Session 5E-2d2; owner, Nov 14: "a visible dropship flies in and lands, and you see the Parasites getting off
// the ship"): the Citadel's ship is the heavy hauler of js/conquest/kit/warmodels.js, flown by ConquestDropship.flight() from
// ConquestCitadel.dropshipSpec(e). The fight keeps the ship's place, hit box and timing (shipPose: it reaches its pad at the
// wave's moment, spec.at); the flight gives the attitude (the banked approach, the nose-up flare), the bow ramp, the hit flash,
// the burning fall and the wreck, and the lift-away. What is drawn:
//   - the hull follows the fight's ship until its bow ramp's foot is over the pad, sets down there and lowers the ramp, so the
//     ramp is down before the wave's moment and the wave appears at the foot of the ramp
//   - the wave's units (the fight spawns them around the pad at that moment) are shown rolling down the ramp to their own
//     spots for their first second (they hold fire for 1.2 s after they land: nothing is hidden from the pilot)
//   - when the fight sends the ship away (unloadS after it landed) the ramp shuts and the flight's lift-away plays
//   - shot down before it lands: the flight's fall and wreck from where it was hit; its wave never lands (the fight's rule)
// Without dropship.js or the kit (the Canvas fallback, an old device) the box stand-in below is drawn as before.
const clamp01=v=>v<0?0:v>1?1:v,smooth=t=>{t=clamp01(t);return t*t*(3-2*t);},SHIP_Y=1.5,SETTLE=2.6,RAMP=[2.4,1.0],STEP=1.1;
function shipFlight(view,e,hit){const D=root.ConquestDropship,spec=CI().dropshipSpec(e);if(!D?.flight||!spec)return null;const key=e.id+':'+(hit&&spec.hitAt!==undefined?spec.hitAt:''),c=view.citShips||(view.citShips=new Map());let F=c.get(key);
 if(!F){const sp={...spec,ground:(x,z)=>Wd().groundAt(x,z)};if(!hit)delete sp.hitAt;F=D.flight(sp);F.spec=spec;c.set(key,F);}return F;}
// where the hull is drawn at fight time t: {x,y,z (its base), yaw,pitch,roll, ramp 0..1, phase, wreck, flash, fire, dust, vis}
function shipLook(view,e,B){const F0=shipFlight(view,e,false);if(!F0)return null;const t=B.time||0,S=e.ship,sp=F0.spec,at=sp.at,D=F0.dims,ox=sp.out[0],oz=sp.out[1],W=Wd(),C=CI().CIT.ship;
 const foot=D.hinge[2]+D.rampLen*Math.cos(D.openAngle),rx=sp.pad.x+ox*foot,rz=sp.pad.z+oz*foot,ry=W.groundAt(rx,rz);
 // the fight's ship at time u (its own formula: ConquestCitadel shipPose), kept behind its resting place
 const sim=u=>{const k=clamp01((u-S.t0)/C.flyS),ease=1-(1-k)*(1-k),x=S.from[0]+(S.pad[0]-S.from[0])*ease,z=S.from[1]+(S.pad[1]-S.from[1])*ease,along=Math.max(foot,(x-sp.pad.x)*ox+(z-sp.pad.z)*oz),h=34*(1-ease);
  const px=sp.pad.x+ox*along,pz=sp.pad.z+oz*along,down=smooth((u-(at-SETTLE-.9))/.9);return {x:px,z:pz,y:(along>foot+.01?W.groundAt(px,pz):ry)+h*(1-down)};};
 const air=u=>{const q=sim(u),f=F0.pose(Math.min(u,at-4.21));return {x:q.x,y:q.y,z:q.z,yaw:F0.yawLand,pitch:u<at-4.2?f.pitch:0,roll:u<at-4.2?f.roll:0,ramp:0,phase:u<at-SETTLE?'approach':'landed',wreck:0,flash:0,fire:0,dust:u>at-7&&u<at-SETTLE+1?clamp01(1-(q.y-ry)/14):0,vis:true};};
 // shot down before it landed: the flight's own fall and wreck, carried from where the hull was when it was hit
 if(Number.isFinite(S.hitAt)){const F=shipFlight(view,e,true),th=F.hitAt??S.hitAt;if(t>=th){const a=air(Math.min(th,at-SETTLE-.9)),p0=F0.pose(th),p=F.pose(t),x=a.x+(p.x-p0.x),z=a.z+(p.z-p0.z),gy=W.groundAt(x,z),y=p.wreck?gy:Math.max(gy,a.y+(p.y-p0.y));
   return {x,y,z,yaw:a.yaw+(p.yaw-p0.yaw),pitch:p.pitch,roll:p.roll,ramp:0,phase:y>gy&&!p.wreck?'falling':'wreck',wreck:p.wreck||y<=gy?1:0,flash:p.flash,fire:p.fire,dust:0,vis:true};}}
 const leave=S.t0+C.flyS+C.unloadS;
 if(t>=leave&&e.landed){const p=F0.pose(F0.tLift+(t-leave));if(!p.vis)return {vis:false};return {x:rx+(p.x-sp.pad.x),y:ry+(p.y-F0.pad.y),z:rz+(p.z-sp.pad.z),yaw:p.yaw,pitch:p.pitch,roll:p.roll,ramp:0,phase:'leave',wreck:0,flash:0,fire:0,dust:p.dust,vis:true};}
 const q=air(t);if(t>=at-SETTLE){q.ramp=Math.min(smooth((t-(at-RAMP[0]))/(RAMP[0]-RAMP[1])),1-smooth((t-(leave-1.9))/1.5));q.phase=t<at?'unload':'landed';q.dust=Math.max(0,1-(t-(at-SETTLE))/1.5);}
 if(e.hp<=0){q.wreck=1;q.ramp=0;q.fire=.6;q.phase='wreck';}return q;}
// is the ship still on show although the fight has moved it away (its lift-away), or lies as a wreck?
function shown(view,e,B){if(!view.enemyMeshes?.get(e.id)?.userData?.ship)return false;try{const q=shipLook(view,e,B);return !!q&&q.vis!==false;}catch(_){return false;}}
function ship(view,e,B){const m=view.enemyMeshes?.get(e.id);if(!m||!root.ConquestDropship?.flight)return;
 try{const U=m.userData.ship;
  if(!U){const F=shipFlight(view,e,true),P=F&&F.pose(B.time||0);if(P&&P.vis!==false){m.userData.pose={p:P.pitch||0,r:P.roll||0};m.userData.dropshipPhase=P.phase;}else delete m.userData.pose;return;}   // the box stand-in: the flight's tilt only (view.js applies the pose after the ground orientation)
  const q=shipLook(view,e,B);if(!q||q.vis===false){m.userData.pose={abs:1,x:e.x,y:-500,z:e.z,yaw:0,p:0,r:0};return;}
  m.userData.pose={abs:1,x:q.x,y:q.y,z:q.z,yaw:q.yaw,p:q.pitch||0,r:q.roll||0};m.userData.dropshipPhase=q.phase;U.look=q;
  U.wreck.visible=!!q.wreck;U.hull.visible=U.ramp.visible=!q.wreck;if(!q.wreck)U.ramp.rotation.x=U.D.closedAngle+(U.D.openAngle-U.D.closedAngle)*q.ramp;   // the 80 ms hit flash is the view's own (js/conquest/feel.js swaps the solid material on every mesh of the unit)
  if(m.userData.marker)m.userData.marker.position.set(0,U.D.size[1]+2.5,0);
  // the hit box stays the fight's: the marker floats over the hull, the lock ring is drawn by the view at the fight's place
 }catch(_){}}
// the wave a landed ship put out: for its first STEP seconds each unit is drawn rolling from the ramp to its own spot
function stepOff(view,B){const t=B.time||0,seen=view.citWave||(view.citWave=new Map());
 for(const e of B.enemies){if(e.wave!=='ship'||e.hp<=0)continue;const g=view.enemyMeshes?.get(e.id);if(!g)continue;let s=seen.get(e.id);
  if(!s){let best=null,bd=1e9;for(const o of B.enemies)if(o.ship&&o.landed&&!o.left){const d=Math.hypot(o.ship.pad[0]-e.x,o.ship.pad[1]-e.z);if(d<bd){bd=d;best=o;}}
   const q=best&&bd<40&&view.enemyMeshes?.get(best.id)?.userData?.ship?shipLook(view,best,B):null;s={t0:t,from:q&&q.ramp>.5?(()=>{const F=shipFlight(view,best,false),D=F.dims,sp=F.spec,k=D.hinge[2]-1.5+((e.id|0)%3)*1.6,side=(((e.id|0)%5)-2)*.9;return {x:q.x-sp.out[0]*k-sp.out[1]*side,z:q.z-sp.out[1]*k+sp.out[0]*side,y:q.y+D.deckY};})():null};seen.set(e.id,s);}
  const k=(t-s.t0)/STEP;if(!s.from||k>=1){if(g.userData.pose?.step)delete g.userData.pose;continue;}const u=smooth(k),gy=e.y;
  g.userData.pose={abs:1,step:1,x:s.from.x+(e.x-s.from.x)*u,y:s.from.y+(gy-s.from.y)*Math.min(1,u*1.6),z:s.from.z+(e.z-s.from.z)*u,yaw:Math.atan2(e.x-s.from.x,e.z-s.from.z),p:0,r:0};}
 if(seen.size>96)for(const id of seen.keys())if(!B.enemies.some(e=>e.id===id))seen.delete(id);}
// the ship's dust, fire and smoke (view.js fxFrame calls this between the effects' begin and end; positions on the floating origin)
function fx(view,B,F,dt){if(!B?.cit||!F?.thrustDust)return;const ox=view.origin.x,oz=view.origin.z,tick=(view.citFxT=(view.citFxT||0)+dt)>=.12;if(tick)view.citFxT=0;
 for(const e of B.enemies){if(!e.ship)continue;const U=view.enemyMeshes?.get(e.id)?.userData?.ship,q=U?.look;if(!q||q.vis===false)continue;
  if(q.phase!==U.was){if(q.phase==='wreck'&&U.was==='falling'){F.blast(q.x-ox,q.y+.5,q.z-oz,7,1);F.shatter('parasite',q.x-ox,q.y,q.z-oz,5,5,0,0);}else if(q.phase==='unload'&&U.was==='approach')F.thrustDust(q.x-ox,q.y,q.z-oz,9,1.4);U.was=q.phase;}
  if(q.fire>0){F.hullFlame(q.x-ox,q.y+1.2,q.z-oz,4.2,q.fire);if(tick)F.hullSmoke(q.x-ox,q.y+2,q.z-oz,4);}else if(tick&&q.dust>.05)F.thrustDust(q.x-ox,Wd().groundAt(q.x,q.z),q.z-oz,7,q.dust);}}
// the real hauler for a Citadel ship (null: the box stand-in): hull + bow ramp at its hinge + the wreck, in the fight's frame
function shipModel(view,e){const S=view.style,DS=root.ConquestDropship,WK=root.ConquestWorldKit;if(!S?.MAT||!S.marker||!DS?.flight||!WK?.MODELS?.['par-hauler'])return null;
 const T=view.T,K=WK.kit(S),D=DS.dims('hauler'),v=1+(((e.ship?.n|0)%6)+6)%6,g=new T.Group(),body=new T.Group(),gun=new T.Group(),mesh=o=>new T.Mesh(K.geometry('par-hauler',Object.assign({seed:v},o)),S.MAT.par||S.MAT.solid),hull=mesh({part:'hull'}),ramp=mesh({part:'ramp'}),wreck=mesh({wreck:1});
 ramp.position.set(D.hinge[0],D.hinge[1],D.hinge[2]);ramp.rotation.x=D.closedAngle;wreck.visible=false;body.add(hull,ramp,wreck);g.add(body,gun);const mk=S.marker();mk.position.y=D.size[1]+2.5;g.add(mk);
 Object.assign(g.userData,{gun,marker:mk,slot:'par-hauler',hook:'dropship',ship:{body,hull,ramp,wreck,D}});view.scene.add(g);return g;}
// a Citadel unit's stand-in model (null: the view's own). Shapes cached per view (shared, never disposed per unit), the view's own
// materials, a gun group and the selection / tell marker every Parasite model carries (the view turns the gun and shows the tell)
function model(view,e){if(e.ship){const h=shipModel(view,e);if(h)return h;}if(e.swarm&&!e.cit&&view.style?.unit)return null;   /* Session 5E-2d2: the Swarm is the view's own Grabber (par-swarm) */
 if(!(e.cit||e.swarm||e.ship||e.warden)||!view.T||typeof view.mat!=='function'||typeof view.form!=='function')return null;const T=view.T,g=new T.Group(),gun=new T.Group(),C=view.citCache||(view.citCache=new Map());g.add(gun);g.userData.gun=gun;
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
root.ConquestCitadelView=Object.freeze({sync,model,core,drop,shown,fx,shipLook});
})(globalThis);
