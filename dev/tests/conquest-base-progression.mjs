// Session 5 progression model for the base plot (like conquest-first-base / long-progression): real Worker reward, bank,
// claim and plot functions on the Worker clock, scripted ordinary play. It answers "neither instant nor a wall": time to CC2,
// CC5 and CC10 in the first hour, first day and first weeks. Explicit assumptions (estimates, not a human playtest):
//  - one completed sortie every 90 s of play (field missions for the first 75 min, then the authored raids in rotation);
//  - all CP goes to the first base (as conquest-first-base); after it, half of all CP goes to engineering and other sinks,
//    half to the base; materials all to the base;
//  - each day: one session at 18:00 UTC (regular 45 min, dedicated 150 min split in two sessions), Daily Base Yield and plot
//    production collected at its start; the builder is given the next job after every sortie (Command Center first, then the
//    cheapest affordable building or upgrade), so real timers run while the pilot is away.
import assert from 'node:assert/strict';import {writeFileSync,mkdirSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST,RULES:R}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Plot:P}=CONQUEST;
const {createState,refreshState}=await import('../../worker/src/conquest-sim.js');
const {missionReward,bank}=await import('../../worker/src/conquest-economy.js');
const {campaign,baseAction}=await import('../../worker/src/conquest-campaign.js');
const {plotAction}=await import('../../worker/src/conquest-plot.js');
const DAY=86400000,start=Date.UTC(2026,10,9,0);
const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
function run(profile){const s=createState(R.STOCK_L,start),hit={},legacy=['oxygen-line','relay','recon','convoy','rescue','redoubt'];let serial=0,played=0,other=0;
 const afford=c=>Object.entries(c||{}).every(([k,n])=>k==='cp'?s.ledger.cp>=n:P.MNS.includes(k)?true:s.ledger.banked[k]>=n);
 const mark=(k,now)=>{if(hit[k]===undefined)hit[k]={day:+((now-start)/DAY).toFixed(2),playMin:played};};
 const atGate=()=>{s.position=at(C.baseDefinition.x,C.baseDefinition.z);s.battle.enemies=[];};
 const build=now=>{campaign(s,now);if(!s.base.tier){if(afford(C.baseDefinition.recipe)){atGate();baseAction(s,{action:'build-base',plot:{site:'crater'}},now);mark('CC1',now);}return;}
  const p=s.plot;for(const k of [2,3,5,7,9,10])if(p.cc>=k)mark('CC'+k,now);if(p.job)return;atGate();
  if(p.cc<P.CC.max&&afford(P.costOf('cc',p.cc+1))){try{plotAction(s,{action:'plot-upgrade',plot:{id:'cc'}},now,{bmn:{il:99,ar:99}});return;}catch(e){}}
  // cheapest legal build or upgrade the pilot can afford (turrets capped at 6 in this model)
  const opts=[];for(const [t,B] of Object.entries(P.BUILDINGS)){if(B.gate)continue;const cur=Object.entries(p.b).filter(([,b])=>b.t===t);
   for(const [id,b] of cur)if(!P.buildCheck(p,t,b.l+1,id))opts.push({cp:P.costOf(t,b.l+1).cp,a:()=>plotAction(s,{action:'plot-upgrade',plot:{id}},now)});
   if(!P.buildCheck(p,t,1)&&!(B.turret&&P.turretCount(p)>=6)){const pos=P.autoPlace(p,t);if(pos)opts.push({cp:P.costOf(t,1).cp,a:()=>plotAction(s,{action:'plot-build',plot:{type:t,...pos}},now)});}}
  opts.sort((x,y)=>x.cp-y.cp);for(const o of opts){try{if(o.cp<=s.ledger.cp){o.a();return;}}catch(e){}}};
 for(let day=0;day<120;day++){for(const [h,mins] of profile.sessions){let now=start+day*DAY+h*3600000;
  if(s.base.tier){atGate();try{baseAction(s,{action:'base-claim'},now);}catch(e){}try{plotAction(s,{action:'plot-collect',plot:{}},now);}catch(e){}}build(now);
  for(let m=0;m<mins;m+=1.5){now+=90000;played+=1.5;const id=played<=75?legacy[serial%legacy.length]:C.raidIds[serial%C.raidIds.length];serial++;
   s.mission=id;s.attempt=serial;s.featuredMission=false;const cp0=s.ledger.cp;missionReward(s,now);s.mission=null;const half=s.base.tier?Math.floor((s.ledger.cp-cp0)/2):0;s.ledger.cp-=half;other+=half;
   s.position=at(1174,1168);bank(s,now);build(now);}}
  build(start+(day+1)*DAY-1000);if(hit.CC10&&day>hit.CC10.day+2)break;}
 return {profile:profile.label,hit,finalCC:s.plot?.cc,buildings:s.plot?Object.values(s.plot.b).map(b=>b.t+(b.t==='cc'?s.plot.cc:b.l)).join(' '):'',power:s.plot?.power,otherSinksCP:other};}
const regular=run({label:'Regular, Conquest-focused (45 min/day)',sessions:[[18,45]]}),dedicated=run({label:'Dedicated (150 min/day in two sessions)',sessions:[[12,75],[19,75]]});
const out={scope:'Modeled settlement only (real reward/bank/plot functions, Worker clock, scripted 90 s sorties, half the CP to other sinks). Not a human playtest.',regular,dedicated};
mkdirSync('docs/conquest/session5',{recursive:true});writeFileSync('docs/conquest/session5/base-progression-model.json',JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1));
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const r=regular.hit,d=dedicated.hit;
ok(r.CC1&&r.CC1.playMin>=45&&r.CC1.playMin<=75,'first base (CC1) after '+r.CC1?.playMin+' min of play (target 45-75, existing recipe)');
ok(r.CC2&&r.CC2.playMin<=r.CC1.playMin+90&&r.CC2.day<=3,'CC2 soon after: '+r.CC2?.playMin+' play-min, day '+r.CC2?.day+' (not a wall)');
ok(r.CC5&&r.CC5.day>=4&&r.CC5.day<=21,'regular CC5 on day '+r.CC5?.day+' (about 1-3 weeks: not instant)');
ok(r.CC10&&r.CC10.day>=21&&r.CC10.day<=100,'regular CC10 on day '+r.CC10?.day+' (a long-term goal, reachable in months)');
ok(r.CC9&&r.CC9.day<=35,'regular CC9 (tier V, points ×1.25) on day '+r.CC9?.day+' (the Session 4 model had Base V on day 20 with every CP on the base)');
ok(d.CC10&&d.CC10.day<r.CC10.day&&r.CC10.day/d.CC10.day<=3.5,'dedicated CC10 on day '+d.CC10?.day+' ('+(r.CC10.day/d.CC10.day).toFixed(1)+'x faster, never 10x)');
console.log(`conquest base progression: passed ${passed}`);
