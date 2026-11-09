// Owner playtest (Nov 8): "I have no idea how and where to find my base." Before this fix the HUD arrow pointed straight at
// the Command Gate: from the Refuge a towers detour sent pilots EAST (away from the base), and a straight drive jammed on a
// settler building; 80 of 108 nearby start points never arrived. This drives a tank with the real move() rules, steering
// only by what the HUD arrow shows (ConquestWorld.route + routeAim, re-routing when it strays), from the Refuge (where every
// pilot starts and respawns) and from rings around the gate. Pure node; no browser.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C}}=await import('../../worker/src/sim.gen.js');
const D=C.baseDefinition,G={x:D.x,z:D.z},R=C.refuge;let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
function drive(start,{steps=9000}={}){let p=at(start.x,start.z),path=W.route(p,G,{goal:D.radius-4}),i0=0,last={x:p.x,z:p.z,i:0},from=0,routes=1;
 if(!path)return {arrived:false,why:'no route'};
 for(let i=0;i<steps;i++){const a=W.routeAim(p,path,from);from=a.index;
  // the client re-routes when the pilot is 10 m off the line or has not moved for a while (pushed against something)
  if(a.off>10||i-last.i>60&&Math.hypot(p.x-last.x,p.z-last.z)<1){const n=W.route(p,G,{goal:D.radius-4});routes++;if(n){path=n;from=0;}last={x:p.x,z:p.z,i};continue;}
  if(i-last.i>60)last={x:p.x,z:p.z,i};
  const t=a.point,dx=t.x-p.x,dz=t.z-p.z,L=Math.hypot(dx,dz)||1;p=W.advance(p,dx/L*.4,dz/L*.4);
  if(Math.hypot(p.x-G.x,p.z-G.z)<=D.radius)return {arrived:true,steps:i,routes};}
 return {arrived:false,at:[Math.round(p.x),Math.round(p.z)],routes};}
// 1. the Refuge, the respawn point and the fast-travel arrival: must arrive, and the first leg must head WEST (toward the base)
const t0=performance.now(),first=W.route(at(R.x,R.z),G,{goal:D.radius-4}),ms=performance.now()-t0;
ok(first&&first.length>2,'a drivable route exists from the Refuge to the gate ('+first.length+' points, '+ms.toFixed(0)+' ms)');
const aim=W.routeAim(at(R.x,R.z),first,0).point;ok(aim.x<R.x,'the arrow at the Refuge points west, toward the base (aim x '+aim.x+' < '+R.x+')');
for(const s of [{x:R.x,z:R.z},{x:R.x-6,z:R.z-8},{x:R.x+10,z:R.z+6},{x:R.x,z:R.z-14}]){const r=drive(s);ok(r.arrived,'from the Refuge area ('+s.x+', '+s.z+') the arrow leads to the gate ('+(r.steps*.4|0)+' m driven)');}
// 2. rings around the gate (60-450 m): most must arrive by arrow alone (a person also steers; this is the floor)
let n=0,arrived=0;const stuck=[],times=[];
for(const r of [60,120,200,320,450])for(let k=0;k<24;k++){const s={x:G.x+Math.cos(k*Math.PI/12)*r,z:G.z+Math.sin(k*Math.PI/12)*r};if(W.solidAt(s.x,s.z)||W.waterAt(s.x,s.z)?.deep)continue;n++;
 const a=performance.now();W.route(at(s.x,s.z),G,{goal:D.radius-4});times.push(performance.now()-a);const res=drive(s);if(res.arrived)arrived++;else stuck.push(r+'m/'+k*15+'°');}
times.sort((a,b)=>a-b);const share=arrived/n;
console.log(JSON.stringify({starts:n,arrived,share:Math.round(share*100)+'%',before:'28/108 (straight arrow)',routeMs:{p50:+times[n>>1].toFixed(1),p95:+times[Math.floor(n*.95)].toFixed(1)},stuck}));
ok(share>=.85,'by arrow alone, '+arrived+'/'+n+' starts within 450 m reach the gate (straight arrow before: 28/108)');
ok(times[Math.floor(n*.95)]<1500,'route time stays bounded (p95 '+times[Math.floor(n*.95)].toFixed(0)+' ms in node, edges cached)');
// 3. the gate's arrival zone is the Session 5 Find My Base radius
ok(D.radius===30,'the Command Gate arrival zone is 30 m (was 18)');
console.log('conquest home route: passed '+passed);
