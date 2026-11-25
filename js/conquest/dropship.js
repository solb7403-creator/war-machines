/* LUNAR Conquest — the Parasite dropships (Session 5E-2d2; owner, Nov 14 and Nov 21): "a visible dropship flies in and lands,
 * and you see the Parasites getting off the ship".
 *
 * Two ships, one reusable sequence: fly in -> flare -> land (the heavy hauler: a bow ramp drops) or hover (the light shuttle:
 * the cargo drops from the bay) -> unload -> lift away. Used now by the town's Defense Drill (waves two and later); built so
 * Citadel tiers III and IX and the Living Front call the same three pieces:
 *   flight(spec)            pure: one ship's whole flight as a function of time (pose(t)), its shot-down variant (spec.hitAt)
 *   planDrill(P,plot,r,o)   pure: which ships a recorded drill needs (one per lane in use and wave), and who rides in each
 *   stage(S,K,opt)          THREE: the instanced draws of the ships and their ramps for any view (the town today)
 * PRESENTATION ONLY. A drill's result is computed before any of this runs and is never read back: every raid unit spawns at
 * the time and the place the simulation gave it. Before that moment a unit is only shown riding its ship to that exact place
 * (unitPose), so it steps off where and when it appears today (dev/tests/conquest-dropship.mjs proves both).
 * Shot down (blueprint 5, "Lancers and anti-air turrets can shoot one down first, which removes its wave"): flight() already
 * flies the hit flash, the burning fall and the wreck (spec.hitAt); nothing shoots a ship in the drill today, so a later
 * session only decides hitAt and removes the wave in its own simulation. */
(function(root){
'use strict';
const TAU=Math.PI*2,clamp01=v=>v<0?0:v>1?1:v,lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp01(t);return t*t*(3-2*t);},easeOut=t=>{t=clamp01(t);return 1-(1-t)*(1-t);},easeIn=t=>{t=clamp01(t);return t*t;};
function hash(n){let h=Math.imul(n|0,374761393)^0x5bd1e995;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
const hash3=(a,b,c)=>hash(Math.imul((a|0)+1,73856093)^Math.imul((b|0)+7,19349663)^Math.imul((c|0)+13,83492791));
const wrap=a=>{a=(a+Math.PI)%TAU;if(a<0)a+=TAU;return a-Math.PI;},turn=(a,b,t)=>a+wrap(b-a)*t;
// The ships' own measures. kit/warmodels.js exports the real ones (ConquestWarModels); these stand in until it has loaded.
const DIMS={hauler:{size:[16,9,26],hinge:[0,1.2,11],rampLen:7,rampW:9,closedAngle:-1.25,openAngle:.17,deckY:1.2},shuttle:{size:[10,4.4,13],hoverY:5.5,bay:[0,.6,0]}};
function dims(kind){const W=root.ConquestWarModels,d=W&&W[kind];return Object.assign({},DIMS[kind],d||{});}
// Seconds from the wave's moment (0 = the moment its units appear). The clock is the caller's (the drill plays 1.6 x real time).
const TL=Object.freeze({
 hauler:Object.freeze({in:-15,flare:-6.4,down:-4.2,rampOpen:-3.8,rampDown:-2.2,roll:-1.9,rampUp:1.6,rampShut:3,lift:3.4,out:13}),
 shuttle:Object.freeze({in:-13,flare:-5.2,hover:-3,bay:-2.6,drop:-1.15,lift:1.2,out:10})});

/* One ship's flight. spec:
 *   kind 'hauler' | 'shuttle'; at = the wave's moment; pad {x,z} = where the ship stands (hauler) or hovers over (shuttle);
 *   out [x,z] = unit vector from the defended place out along the approach lane (the ship's bow faces -out, toward the town);
 *   ground(x,z) -> height; seed + lane give every lane its own approach path, side and exit;
 *   hitAt (optional) = the time it is shot down: it flashes, falls burning and ends as a wreck (its wave never unloads). */
function flight(spec){
 const kind=spec.kind==='shuttle'?'shuttle':'hauler',T=TL[kind],D=dims(kind),at=+spec.at||0,pad=spec.pad,ox=spec.out[0],oz=spec.out[1],gnd=spec.ground||(()=>0),seed=spec.seed|0,lane=spec.lane|0;
 const h=k=>hash3(seed,lane,k),side=h(1)<.5?-1:1,sx=-oz*side,sz=ox*side;   // the lane's own side: which way the approach bends in
 const gy=gnd(pad.x,pad.z),rest=kind==='shuttle'?(spec.hoverY??D.hoverY):0,yawLand=Math.atan2(-ox,-oz);
 // the approach: a cubic Bezier from far out and high (off the lane's axis, its own distance and bend) onto the lane's axis
 const R0=300+90*h(2),S0=140+110*h(3),H0=78+40*h(4),Rm=110+40*h(5),Rf=kind==='shuttle'?30:44,Hf=kind==='shuttle'?rest+9:15;
 const P0=[pad.x+ox*R0+sx*S0,gy+H0,pad.z+oz*R0+sz*S0],P1=[pad.x+ox*(R0*.62)+sx*S0*.9,gy+H0*.72,pad.z+oz*(R0*.62)+sz*S0*.9],P2=[pad.x+ox*Rm+sx*S0*.12,gy+H0*.3,pad.z+oz*Rm+sz*S0*.12],P3=[pad.x+ox*Rf,gy+Hf,pad.z+oz*Rf];
 const bez=(u,i)=>{const v=1-u;return v*v*v*P0[i]+3*v*v*u*P1[i]+3*v*u*u*P2[i]+u*u*u*P3[i];},dbez=(u,i)=>{const v=1-u;return 3*v*v*(P1[i]-P0[i])+6*v*u*(P2[i]-P1[i])+3*u*u*(P3[i]-P2[i]);};
 // the exit: up, turn to the lane's other side, away (never back over the approach)
 const ea=Math.atan2(ox*.55-sx,oz*.55-sz)+(h(6)-.5)*.5,ex=Math.sin(ea),ez=Math.cos(ea),tDown=at+(kind==='shuttle'?T.hover:T.down),tLift=at+T.lift,tOut=at+T.out,tIn=at+T.in,tFlare=at+T.flare;
 function intact(t){
  const o={kind,vis:t>=tIn&&t<=tOut,x:pad.x,y:gy+rest,z:pad.z,yaw:yawLand,pitch:0,roll:0,ramp:0,bay:0,thrust:0,dust:0,phase:'gone',wreck:0,flash:0,fire:0,down:0};if(!o.vis)return o;
  if(t<tFlare){const u=easeOut((t-tIn)/(tFlare-tIn));o.x=bez(u,0);o.y=bez(u,1);o.z=bez(u,2);const dx=dbez(u,0),dz=dbez(u,2),u2=Math.min(1,u+.04),ddx=dbez(u2,0),ddz=dbez(u2,2);
   o.yaw=Math.atan2(dx,dz);o.roll=Math.max(-.5,Math.min(.5,wrap(Math.atan2(ddx,ddz)-o.yaw)*-9))*(1-u*u);o.pitch=.1*(1-u);o.thrust=.55+.25*u;o.phase='approach';}
  else if(t<tDown){const u=(t-tFlare)/(tDown-tFlare),e=smooth(u);o.x=lerp(P3[0],pad.x,e);o.z=lerp(P3[2],pad.z,e);o.y=lerp(P3[1],gy+rest,easeOut(u));
   o.pitch=-.24*Math.sin(Math.PI*Math.min(1,u*1.25));o.thrust=1+.3*Math.sin(Math.PI*u);o.dust=kind==='shuttle'?.5*u:u*u;o.phase='flare';}
  else if(t<tLift){const k=t-tDown;o.down=1;
   if(kind==='hauler'){o.y=gy+.22*Math.exp(-k*3.2)*Math.cos(k*9);o.thrust=.18+.5*Math.exp(-k*2.5);o.dust=Math.exp(-k*1.4);   // the suspension settles
    o.ramp=t<at+T.rampUp?smooth((t-(at+T.rampOpen))/(T.rampDown-T.rampOpen)):1-smooth((t-(at+T.rampUp))/(T.rampShut-T.rampUp));o.phase=t<at+T.roll?'landed':t<at?'unload':'landed';}
   else{o.y=gy+rest+.28*Math.sin(k*2.1+lane);o.roll=.03*Math.sin(k*1.3+lane*2);o.thrust=.85;o.dust=.4;o.bay=t<at+T.drop+.9?smooth((t-(at+T.bay))/.5):1-smooth((t-(at+.5))/.5);o.phase=t<at+T.drop?'hover':t<at?'unload':'hover';}}
  else{const k=(t-tLift)/(tOut-tLift),up=easeOut(Math.min(1,k*3.2)),go=easeIn(Math.max(0,(k-.12)/.88)),Rx=520;o.y=gy+rest+up*16+go*90;o.x=pad.x+ex*go*Rx;o.z=pad.z+ez*go*Rx;
   o.yaw=turn(yawLand,ea,smooth(Math.min(1,k*2.6)));o.pitch=.16*go;o.roll=-side*.3*Math.sin(Math.PI*Math.min(1,k*2.2));o.thrust=1.2;o.dust=Math.max(0,1-k*6)*(kind==='hauler'?1:.4);o.phase='leave';}
  return o;}
 // shot down: the pose at the hit carries on ballistically, rolling and burning, to the ground; then it skids and lies as a wreck
 let crash=null;
 if(spec.hitAt!==undefined&&spec.hitAt!==null){const th=Math.max(tIn+.5,Math.min(+spec.hitAt,tDown-.2)),a=intact(th),b=intact(th-.1),vx=(a.x-b.x)/.1*.75,vz=(a.z-b.z)/.1*.75,vy0=Math.min(2,(a.y-b.y)/.1),g=17;
  // the fall ends on the ground under it (a few steps settle the height as it travels)
  let tf=1;for(let i=0;i<6;i++){const gx=a.x+vx*tf,gz=a.z+vz*tf,dy=a.y-(gnd(gx,gz)+1.1);tf=(vy0+Math.sqrt(vy0*vy0+2*g*Math.max(.2,dy)))/g;}
  const ix=a.x+vx*tf,iz=a.z+vz*tf,sp=Math.hypot(vx,vz),skid=Math.min(26,sp*.55),ux=sp?vx/sp:0,uz=sp?vz/sp:0,spin=(h(7)<.5?-1:1)*(1.7+h(8));
  crash={th,tf,ix,iz,a,vx,vz,vy0,g,skid,ux,uz,spin,yawEnd:a.yaw+spin*.35,rollEnd:(h(9)<.5?-1:1)*(.22+.2*h(10))};}
 function pose(t){
  if(!crash||t<crash.th)return intact(t);const c=crash,k=t-c.th,o=Object.assign({},c.a);o.vis=true;o.ramp=0;o.bay=0;o.flash=k<.14?1:0;o.dust=0;
  if(k<c.tf){o.x=c.a.x+c.vx*k;o.z=c.a.z+c.vz*k;o.y=c.a.y+c.vy0*k-.5*c.g*k*k;o.roll=c.a.roll+c.spin*k;o.pitch=c.a.pitch+.5*easeIn(k/c.tf);o.yaw=c.a.yaw+c.spin*.2*k;o.thrust=.3*Math.max(0,1-k*1.5);o.fire=1;o.phase='falling';return o;}
  const s=k-c.tf,e=1-Math.exp(-s*2.4),x=c.ix+c.ux*c.skid*e,z=c.iz+c.uz*c.skid*e;o.x=x;o.z=z;o.y=gnd(x,z);o.yaw=c.yawEnd+.25*e;o.pitch=.05;o.roll=c.rollEnd;o.thrust=0;o.wreck=1;o.fire=Math.max(.35,1-s*.12);o.dust=Math.exp(-s*1.2);o.phase='wreck';o.down=1;return o;}
 return {kind,at,pad:{x:pad.x,y:gy,z:pad.z},out:[ox,oz],side,seed,lane,dims:D,T,tIn,tDown,tLift,tOut,yawLand,hitAt:crash?crash.th:null,impactAt:crash?crash.th+crash.tf:null,pose};}

/* The drill's ships. r = a recorded drill (ConquestPlot.drill: frames of [id, kind, x, z]); the first wave enters as it always
 * did (no ship); every later wave gets one ship per lane it uses: the hauler where the lane's share has a sentinel, a brute or
 * drones (the drones fly out of the hauler), the shuttle where it is raiders and swarm only.
 * o.seed = the raid's seed (each raid's ships are patched and routed differently); o.hit = {shipKey: time} for a shot-down ship. */
function planDrill(P,plot,r,o={}){
 const S=P.SITES[plot.site]||P.SITES.ridge,cc=P.clampCC(plot.cc),rows=P.spawnCells(S.id,cc),seed=(o.seed|0)||1,ground=(x,z)=>P.heightAt(S.id,x,z),first=new Map();
 for(const fr of r.frames||[])for(const q of fr.f)if(!first.has(q[0]))first.set(q[0],{id:q[0],k:q[1],t:fr.t,x:q[2],z:q[3]});
 const times=[...new Set([...first.values()].map(u=>u.t))].sort((a,b)=>a-b),lanes=rows.map(cells=>{let x=0,z=0;for(const [i,j] of cells){x+=P.cellX(i);z+=P.cellZ(j);}x/=cells.length||1;z/=cells.length||1;const l=Math.hypot(x,z)||1;
  // a lane's row runs across it: the outward axis is the side of the square the row sits on
  const ax=Math.abs(x)>=Math.abs(z)?[Math.sign(x)||1,0]:[0,Math.sign(z)||1];return {x,z,out:ax,w:cells.length*P.GRID.cell,r:l};});
 const ships=[],byUnit=new Map();
 times.slice(1).forEach((at,wi)=>{const per=lanes.map(()=>[]);
  for(const u of first.values()){if(u.t!==at)continue;let best=0,bd=1e9;lanes.forEach((L,i)=>{const dx=u.x-L.x,dz=u.z-L.z,d=Math.abs(dx*L.out[0]+dz*L.out[1])+Math.max(0,Math.abs(dx*L.out[1]-dz*L.out[0])-L.w/2-1.5)*4;if(d<bd){bd=d;best=i;}});per[best].push(u);}
  per.forEach((units,li)=>{if(!units.length)return;const L=lanes[li],kind=units.some(u=>u.k==='s'||u.k==='b'||u.k==='d')?'hauler':'shuttle',D=dims(kind),key='w'+(wi+2)+'l'+li;
   // the hauler stands outside the row with the foot of its lowered ramp on the row's outer edge; the shuttle hovers over the row
   const reach=kind==='hauler'?D.hinge[2]+D.rampLen*Math.cos(D.openAngle)+2.6:.5,pad={x:L.x+L.out[0]*reach,z:L.z+L.out[1]*reach};
   const ship={key,wave:wi+2,at,lane:li,kind,row:{x:L.x,z:L.z,w:L.w},out:L.out,seed:Math.floor(hash3(seed,wi+2,li)*1e6),units:units.slice().sort((a,b)=>a.id-b.id),
    flight:flight({kind,at,pad,out:L.out,ground,seed,lane:li*7+wi*3,hitAt:o.hit&&o.hit[key]})};
   ships.push(ship);ship.units.forEach((u,n)=>byUnit.set(u.id,{ship,u,n}));});});
 return {ships,byUnit,lanes,waves:times.slice(1),seed,variant:Math.floor(hash(seed)*6),ground};}

/* Where a unit is shown while it rides its ship (t before its wave's moment), ending exactly on its recorded spawn spot at the
 * moment itself. Returns null when the unit is not on show (the ship has not reached the unload, the ship was shot down, or
 * the moment has passed: from then on the drill's own recorded positions are drawn, untouched).
 * {x,y,z,yaw,air}: y is the height of the unit's base. */
const ORDER={b:0,s:1,r:2,w:3,d:4};
function unitPose(plan,id,t){
 const e=plan.byUnit.get(id);if(!e)return null;const {ship,u,n}=e,F=ship.flight,T=F.T,at=ship.at;if(t>=at||F.hitAt!==null)return null;
 const gy=plan.ground(u.x,u.z),yaw=Math.atan2(-u.x,-u.z),air=u.k==='d';
 if(ship.kind==='hauler'){const t0=at+T.roll;if(t<at+T.rampOpen)return null;const D=F.dims,ox=ship.out[0],oz=ship.out[1],px=-oz,pz=ox;
  // the heavy ones stand at the bow and leave first; the small ones wait deeper in the well. Everyone reaches their own spot at `at`.
  const rank=ORDER[u.k]??2,depth=3.2+rank*2.6+((n*7)%5)*.9+D.rampLen*.6,tau=t<=t0?0:smooth((t-t0)/(at-t0)),d=depth*(1-tau);
  const lat=(u.x-ship.row.x)*px+(u.z-ship.row.z)*pz,along=(u.x-ship.row.x)*ox+(u.z-ship.row.z)*oz,squeeze=1-Math.min(1,d/6)*(1-Math.min(1,(D.rampW*.5-1.2)/Math.max(1,ship.row.w/2+1)));
  const x=ship.row.x+px*lat*squeeze+ox*(along+d),z=ship.row.z+pz*lat*squeeze+oz*(along+d);
  // the ramp's foot is `foot` out from the row; from there the floor climbs to the deck
  const foot=F.pad.x*ox+F.pad.z*oz-(ship.row.x*ox+ship.row.z*oz)-(D.hinge[2]+D.rampLen*Math.cos(D.openAngle)),run=along+d-foot,deck=F.pad.y+D.deckY,yd=run<=0?gy:lerp(plan.ground(x,z),deck,clamp01(run/(D.rampLen*Math.cos(D.openAngle))));
  return {x,y:air?lerp(yd+.4,gy+7,tau):yd,z,yaw:Math.atan2(-ox,-oz)+wrap(yaw-Math.atan2(-ox,-oz))*tau,air,tau};}
 const t0=at+T.drop;if(t<at+T.bay)return null;const D=F.dims,p=F.pose(Math.max(t,F.tDown)),tau=t<=t0?0:(t-t0)/(at-t0),e2=tau*tau,k=((n*5)%7)/7-.5,m=((n*3)%5)/5-.5;
 // hanging in the bay (a rack across the hull), then a free fall onto the unit's own spot
 const bx=p.x+Math.cos(F.yawLand)*k*D.size[0]*.6+Math.sin(F.yawLand)*m*D.size[2]*.5,bz=p.z-Math.sin(F.yawLand)*k*D.size[0]*.6+Math.cos(F.yawLand)*m*D.size[2]*.5,by=p.y+D.bay[1]-.4;
 return {x:lerp(bx,u.x,smooth(tau)),y:lerp(by,air?gy+7:gy,e2),z:lerp(bz,u.z,smooth(tau)),yaw,air,tau};}

/* The draws (any view that has a ConquestStyle instance S and its world kit K): one instanced draw for the haulers, one for
 * their ramps, one for the shuttles, and one each for a ship caught in its hit flash and for a wreck, only while there is
 * one. o.variant (0..5) = this raid's patching (kit/warmodels.js o.seed). draw(list of poses) -> what happened this frame. */
function stage(S,K,o={}){
 const T=S.T,g=new T.Group(),v=(o.variant|0)+1,D={hauler:dims('hauler'),shuttle:dims('shuttle')},max=o.max||6,low=!!S.low;g.name='cq-dropships';
 const PM=S.MAT.par||S.MAT.solid,PH=S.MAT.parHit||S.MAT.solidHit,mk=(id,par,mat,n)=>{const im=new T.InstancedMesh(K.geometry(id,par),mat||PM,n||max);im.count=0;im.visible=false;im.frustumCulled=false;im.userData.noPick=true;im.userData.slot=id;g.add(im);return im;};
 const M={hull:mk('par-hauler',{part:'hull',seed:v}),ramp:mk('par-hauler',{part:'ramp',seed:v}),shuttle:mk('par-shuttle',{seed:v}),
  hitH:mk('par-hauler',{part:'hull',seed:v},PH,2),hitS:mk('par-shuttle',{seed:v},PH,2),wreckH:mk('par-hauler',{wreck:1,seed:v},null,3),wreckS:mk('par-shuttle',{wreck:1,seed:v},null,3)};
 const m=new T.Matrix4(),m2=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),p=new T.Vector3(),s=new T.Vector3(1,1,1),was=new Map();
 function draw(list){const n={hull:0,ramp:0,shuttle:0,hitH:0,hitS:0,wreckH:0,wreckS:0},ev=[];
  for(const it of list){const P=it.pose;if(!P||!P.vis)continue;const hauler=P.kind==='hauler',key=it.key,prev=was.get(key);e.set(P.pitch,P.yaw,P.roll,'YXZ');q.setFromEuler(e);m.compose(p.set(P.x,P.y,P.z),q,s);
   const slot=P.wreck?(hauler?'wreckH':'wreckS'):P.flash?(hauler?'hitH':'hitS'):hauler?'hull':'shuttle',im=M[slot];if(n[slot]<im.instanceMatrix.count)im.setMatrixAt(n[slot]++,m);
   if(hauler&&!P.wreck&&n.ramp<M.ramp.instanceMatrix.count){const d=D.hauler;e.set(lerp(d.closedAngle,d.openAngle,P.ramp),0,0);q.setFromEuler(e);m2.compose(p.set(d.hinge[0],d.hinge[1],d.hinge[2]),q,s);M.ramp.setMatrixAt(n.ramp++,m2.premultiply(m));}
   // what a view may want to answer with dust, fire and sound
   if(prev){if(!prev.down&&P.down&&!P.wreck)ev.push({k:'down',key,kind:P.kind,x:P.x,y:P.y,z:P.z});if(!prev.flash&&P.flash)ev.push({k:'hit',key,kind:P.kind,x:P.x,y:P.y,z:P.z});if(!prev.wreck&&P.wreck)ev.push({k:'crash',key,kind:P.kind,x:P.x,y:P.y,z:P.z});
    if(prev.phase!=='leave'&&P.phase==='leave')ev.push({k:'lift',key,kind:P.kind,x:P.x,y:P.y,z:P.z});}
   was.set(key,{down:P.down,flash:P.flash,wreck:P.wreck,phase:P.phase});}
  for(const [k,im] of Object.entries(M)){im.count=n[k];im.visible=n[k]>0;if(n[k])im.instanceMatrix.needsUpdate=true;}return ev;}
 return {group:g,meshes:M,draw,low,clear(){was.clear();for(const im of Object.values(M)){im.count=0;im.visible=false;}},dispose(){g.parent&&g.parent.remove(g);}};}
root.ConquestDropship=Object.freeze({TL,DIMS,dims,flight,planDrill,unitPose,stage,hash3});
})(typeof globalThis!=='undefined'?globalThis:window);
