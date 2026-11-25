// Session 5E-2d2 (owner, Nov 14 + Nov 21): the Parasite dropships of the town's Defense Drill (js/conquest/dropship.js).
// GAMEPLAY UNCHANGED: with the dropships on, every raid unit spawns at the time and the place the simulation gave it.
//  1. the drill's result (frames, events, outcome) is identical with the module loaded and a plan made from it: the plan is
//     computed from a finished result and never read back
//  2. every unit of wave two and later rides a ship of its own lane, and the place it is shown at the wave's moment is
//     exactly its recorded first position (unitPose -> the recorded spot as t -> at; null at and after `at`, so the view
//     draws the simulation's own positions from then on, untouched)
//  3. the first wave enters as it always did (no ship); every lane a later wave uses gets one ship; the hauler where the
//     lane's share has a sentinel, a brute or drones, the shuttle where it is raiders and swarm only
//  4. the sequence: fly in -> flare -> land (ramp down before the unload, up after) or hover (bay) -> lift away; the ship is on
//     the ground (or in its hover) before its units roll, each lane has its own approach path and each raid its own patching
//  5. shot down: the hit flash, the fall, the wreck; its units are never shown riding it
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c=vm.createContext({console});for(const f of ['js/rules.js','js/conquest/world.js','js/conquest/combat.js','js/conquest/plot.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const {fullTown}=await import('./fixtures/town.mjs');const P=c.ConquestPlot;let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
const plain=(site,cc)=>{const p=P.newPlot(site,Date.UTC(2026,10,21));p.cc=cc;p.b.cc.l=cc;return p;};
// the same drills BEFORE the module exists in the context...
const CASES=[];for(const site of P.SITE_IDS)for(const cc of [1,3,6,10])CASES.push({site,cc,seed:7+cc*13+site.length,plot:plain(site,cc)});
CASES.push({site:'crater',cc:10,seed:99,plot:fullTown(P,'crater',{cells:600,turrets:30,now:Date.UTC(2026,10,21)})});CASES.push({site:'ash',cc:10,seed:5,plot:fullTown(P,'ash',{cells:400,turrets:24,now:Date.UTC(2026,10,21)})});
const J=o=>JSON.stringify(o);
for(const k of CASES)k.before=J(P.drill(JSON.parse(J(k.plot)),k.seed));
// ...and after it is loaded and has planned from the result
vm.runInContext(fs.readFileSync('js/conquest/dropship.js','utf8'),c,{filename:'js/conquest/dropship.js'});const DS=c.ConquestDropship;
ok(DS&&typeof DS.planDrill==='function'&&typeof DS.flight==='function'&&typeof DS.unitPose==='function','the dropship module loads without THREE');
let ships=0,riders=0,haulers=0,shuttles=0;const paths=new Set(),variants=new Set();
for(const k of CASES){const tag=k.site+' CC'+k.cc+' seed '+k.seed,r=P.drill(JSON.parse(J(k.plot)),k.seed),plan=DS.planDrill(P,k.plot,r,{seed:k.seed});
 ok(J(r)===k.before,tag+': the drill result is byte for byte the same with the dropships on');
 const again=J(P.drill(JSON.parse(J(k.plot)),k.seed));ok(again===k.before,tag+': ...and after a plan was made from it');
 // first appearance of every unit, straight from the recorded frames
 const first=new Map();for(const fr of r.frames)for(const q of fr.f)if(!first.has(q[0]))first.set(q[0],{id:q[0],k:q[1],t:fr.t,x:q[2],z:q[3]});
 const times=[...new Set([...first.values()].map(u=>u.t))].sort((a,b)=>a-b),waves=P.drillWaves(k.cc);
 ok(times.length>=2&&times[0]===waves[0].at,tag+': the first wave appears at '+waves[0].at+' s');
 for(const t of times)ok(waves.some(w=>w.at===t),tag+': units only appear at a wave moment ('+t+')');
 const rows=P.spawnCells(k.site,k.cc);
 for(const u of first.values()){const e=plan.byUnit.get(u.id);
  if(u.t===times[0]){ok(!e&&DS.unitPose(plan,u.id,u.t-.5)===null,tag+': a first-wave unit has no ship');continue;}
  ok(e&&e.ship.at===u.t,tag+': unit '+u.id+' rides a ship of its own wave');riders++;
  // its lane: the unit's recorded spot is in that lane's spawn row (cell centre +- 1 m, one 0.1 s step of movement)
  const row=rows[e.ship.lane],near=Math.min(...row.map(([i,j])=>Math.hypot(u.x-P.cellX(i),u.z-P.cellZ(j))));ok(near<4.2,tag+': unit '+u.id+' rides the ship of the lane it spawned in ('+near.toFixed(2)+' m from its row)');
  // riding: shown on the ship before the moment, converging on the recorded spot; not shown by the ship at or after it
  ok(DS.unitPose(plan,u.id,u.t)===null&&DS.unitPose(plan,u.id,u.t+.3)===null,tag+': at the moment the simulation owns unit '+u.id);
  const a=DS.unitPose(plan,u.id,u.t-1e-6);ok(a&&Math.abs(a.x-u.x)<1e-3&&Math.abs(a.z-u.z)<1e-3,tag+': unit '+u.id+' steps off exactly on its recorded spot ('+(a?[a.x-u.x,a.z-u.z].map(v=>v.toExponential(1)):'none')+')');
  const gy=P.heightAt(k.site,u.x,u.z);ok(Math.abs(a.y-(u.k==='d'?gy+7:gy))<.02,tag+': ...at the height it is drawn at (a drone at 7 m)');
  let last=1e9;for(const dt of [1.6,1.2,.8,.4,.1,.01]){const p=DS.unitPose(plan,u.id,u.t-dt);if(!p)continue;const d=Math.hypot(p.x-u.x,p.z-u.z);ok(d<=last+1e-9&&[p.x,p.y,p.z,p.yaw].every(Number.isFinite),tag+': unit '+u.id+' only moves toward its spot');last=d;}}
 // one ship per lane in use and wave; the right ship for the load
 for(const at of times.slice(1)){const lanesUsed=new Set();for(const u of first.values())if(u.t===at)lanesUsed.add(plan.byUnit.get(u.id).ship.lane);
  const here=plan.ships.filter(s=>s.at===at);ok(here.length===lanesUsed.size&&new Set(here.map(s=>s.lane)).size===here.length,tag+': wave at '+at+' s: one ship for each of its '+lanesUsed.size+' lanes');}
 ok(!plan.ships.some(s=>s.at===times[0]),tag+': no ship for the first wave');
 for(const s of plan.ships){ships++;const heavy=s.units.some(u=>'sbd'.includes(u.k));ok(s.kind===(heavy?'hauler':'shuttle'),tag+' '+s.key+': '+s.kind+' for '+s.units.map(u=>u.k).join(''));if(heavy)haulers++;else shuttles++;
  const F=s.flight,T=F.T;ok(F.tIn<F.tDown&&F.tDown<s.at&&s.at<F.tLift&&F.tLift<F.tOut,tag+' '+s.key+': in, down, the moment, lift, out in order');
  ok(F.tIn>=s.at-16&&F.tIn>=P.drillWaves(k.cc)[0].at-16,tag+' '+s.key+': the flight fits before its wave');
  // on the ground / in the hover before the cargo moves; the bow faces the town
  const down=F.pose(F.tDown+.05),gy=P.heightAt(k.site,F.pad.x,F.pad.z);
  if(s.kind==='hauler'){ok(Math.abs(down.y-gy)<.4&&down.down===1,tag+' '+s.key+': the hauler stands on the ground');ok(F.pose(s.at+T.roll).ramp>.98&&F.pose(s.at).ramp>.98,'the ramp is down for the whole unload');ok(F.pose(F.tDown).ramp<.02&&F.pose(F.tLift).ramp<.02,'the ramp is up in flight');
   // the lowered ramp's foot sits just outside the row, so cargo rolls onto the row
   const D=F.dims,foot=Math.hypot(F.pad.x-s.row.x,F.pad.z-s.row.z)-(D.hinge[2]+D.rampLen*Math.cos(D.openAngle));ok(foot>1.5&&foot<4,tag+' '+s.key+': the ramp foot is '+foot.toFixed(2)+' m outside the row');}
  else{ok(down.y>gy+3&&down.down===1,tag+' '+s.key+': the shuttle hovers');ok(F.pose(s.at+T.drop).bay>.98,'the bay is open for the drop');}
  const bow=[Math.sin(down.yaw),Math.cos(down.yaw)];ok(bow[0]*-s.out[0]+bow[1]*-s.out[1]>.999,tag+' '+s.key+': the bow faces the town');
  ok(!F.pose(F.tIn-.1).vis&&!F.pose(F.tOut+.1).vis&&F.pose(s.at).vis,'visible only during its flight');
  // a continuous flight: no jump between samples (the approach is the fastest leg)
  let prev=null,maxStep=0;for(let t=F.tIn;t<=F.tOut;t+=.05){const p=F.pose(t);ok([p.x,p.y,p.z,p.yaw,p.pitch,p.roll].every(Number.isFinite),'finite pose');if(prev)maxStep=Math.max(maxStep,Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z));prev=p;ok(p.y>=P.heightAt(k.site,p.x,p.z)-.6||Math.hypot(p.x,p.z)>P.GRID.size*.6,'never under the ground');}
  ok(maxStep<9,tag+' '+s.key+': no jump in the flight (largest 0.05 s step '+maxStep.toFixed(2)+' m)');
  const start=F.pose(F.tIn+.01);paths.add(k.site+k.cc+':'+s.wave+':'+Math.round(Math.atan2(start.x-F.pad.x,start.z-F.pad.z)*20)+':'+Math.round(Math.hypot(start.x-F.pad.x,start.z-F.pad.z)/5));}
 variants.add(plan.variant);
 // the same plan from the same inputs (a replay shows the same ships)
 ok(J(DS.planDrill(P,k.plot,r,{seed:k.seed}).ships.map(s=>[s.key,s.kind,s.seed,s.flight.pad]))===J(plan.ships.map(s=>[s.key,s.kind,s.seed,s.flight.pad])),tag+': the plan is deterministic');}
ok(haulers>10&&shuttles>10,'both ships fly ('+haulers+' haulers, '+shuttles+' shuttles)');
ok(paths.size>ships*.9,'each lane has its own approach path ('+paths.size+' distinct starts for '+ships+' ships)');
{const vs=new Set();for(let s=1;s<=40;s++)vs.add(DS.planDrill(P,CASES[0].plot,JSON.parse(CASES[0].before),{seed:s}).variant);ok(vs.size===6,'each raid seed patches its ships differently (6 looks seen over 40 seeds)');}
// ---- 5. shot down ----
{const k=CASES.find(x=>x.site==='crater'&&x.cc===6),r=JSON.parse(k.before),base=DS.planDrill(P,k.plot,r,{seed:k.seed});
 for(const kind of ['hauler','shuttle']){const s0=base.ships.find(s=>s.kind===kind);if(!s0)continue;const hitT=s0.at+s0.flight.T.flare-.8,plan=DS.planDrill(P,k.plot,r,{seed:k.seed,hit:{[s0.key]:hitT}}),s=plan.ships.find(x=>x.key===s0.key),F=s.flight;
  ok(F.hitAt!==null&&Math.abs(F.hitAt-hitT)<1e-9&&F.impactAt>F.hitAt+.4&&F.impactAt<F.hitAt+8,kind+': hit, then '+(F.impactAt-F.hitAt).toFixed(2)+' s of fall');
  ok(F.pose(F.hitAt+.05).flash===1&&F.pose(F.hitAt+.3).flash===0,kind+': the hit flash lasts under 0.3 s');
  const fall=F.pose((F.hitAt+F.impactAt)/2),end=F.pose(F.impactAt+4);ok(fall.phase==='falling'&&fall.fire===1&&fall.wreck===0,kind+': falls burning');
  ok(end.phase==='wreck'&&end.wreck===1&&Math.abs(end.y-P.heightAt(k.site,end.x,end.z))<.05,kind+': ends as a wreck on the ground');
  ok(J(F.pose(F.hitAt-.2))===J(s0.flight.pose(F.hitAt-.2)),kind+': identical to the intact flight until the hit');
  for(const u of s.units)for(const dt of [2,1,.3,.01])ok(DS.unitPose(plan,u.id,s.at-dt)===null,kind+': its units are never shown riding a ship that was shot down');
  // the other ships of the raid are untouched by it
  for(const o of plan.ships)if(o.key!==s.key)ok(o.flight.hitAt===null,'only the ship that was hit falls');}}
console.log('PASS conquest-dropship: '+checks+' checks; '+CASES.length+' drills identical with the dropships on, '+riders+' units step off on their recorded spot at their recorded moment, '+ships+' ships ('+haulers+' haulers, '+shuttles+' shuttles)');
