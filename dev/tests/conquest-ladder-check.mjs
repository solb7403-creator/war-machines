// Session 6 economy gate for the town ladder (brief Part E, owner Decision 10a: "production x3 ... CP still binds every Command
// Center level ... re-run: CC timelines must stay within +-10% of the audit's table (regular CC5 day 6, CC10 day 29)").
// The audit's own method (docs/conquest/audit/model/audit-economy.mjs: a completed sortie every 90 s, all CP to the town until the
// old 2,550 CP claim is spent (Checkpoint 40: the claim split keeps this behaviour), then half to other sinks; real Worker reward,
// bank, claim and plot functions), run on the CURRENT code in three variants:
//   1. production x3 + every Session 6 change except the two new CP sources (the Sortie chain's CP, War Orders' CP): the
//      Decision 10 check. MUST stay within +-10% of the audit table.
//   2. + the Sortie chain (spec §5.7; owner correction Nov 16: +1.25% CP and salvage a link, was +10%).
//   3. + War Orders claimed by the pilot (spec §6.1, decided CP 150-300 a daily, 1,500 the weekly), with the same CP split:
//      EVERY Session 6 change on. Owner rule (Nov 16): MUST stay within +-10% of the audit table too (CC5 5.4-6.6, CC10
//      25.9-31.7). This variant depends on the pilot: War Orders are drawn from the pilot's own seed (s.lseed) and the greedy
//      builder turns a few hundred CP more or less into another build order (one pilot lands CC10 near day 18, another near
//      day 27), so it is judged on a FIXED panel of 101 pilot seeds: the median pilot must sit inside the band. Fixed seeds keep
//      the check deterministic. All variants keep "no instant max-out" (CC10 never inside the first week). Not a human playtest.
import assert from 'node:assert/strict';import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST,RULES:R}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Plot:P}=CONQUEST;
const {createState,refreshState}=await import('../../worker/src/conquest-sim.js');
const {missionReward,bank}=await import('../../worker/src/conquest-economy.js');
const {campaign,baseAction}=await import('../../worker/src/conquest-campaign.js');
const {plotAction}=await import('../../worker/src/conquest-plot.js');
const {claimOrder}=await import('../../worker/src/conquest-orders.js');
const DAY=86400000,start=Date.UTC(2026,10,10,0),at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
const AUDIT=JSON.parse(readFileSync(new URL('../../docs/conquest/audit/model/audit-economy.json',import.meta.url),'utf8')).profiles.regular.base.hit;
function run(sessions,{chain,orders,seed}){const s=createState(R.STOCK_L,start);s.lseed=seed;const hit={},legacy=['oxygen-line','relay','recon','convoy','rescue','redoubt'];let serial=0,played=0,spent=0,claimed=0;
 const afford=c=>Object.entries(c||{}).every(([k,n])=>k==='cp'?s.ledger.cp>=n:P.MNS.includes(k)?true:s.ledger.banked[k]>=n);
 const mark=(k,now)=>{if(hit[k]===undefined)hit[k]={day:+((now-start)/DAY).toFixed(1),playMin:Math.round(played)};};
 const atGate=()=>{s.position=at(C.baseDefinition.x,C.baseDefinition.z);s.battle.enemies=[];};
 const build=now=>{const cp0=s.ledger.cp;try{build0(now);}finally{spent+=Math.max(0,cp0-s.ledger.cp);}};
 const build0=now=>{campaign(s,now);if(!s.base.tier){if(afford(C.baseDefinition.recipe)){atGate();baseAction(s,{action:'build-base',plot:{site:'crater'}},now);mark('CC1',now);}return;}
  const p=s.plot;for(const k of [2,3,4,5,6,7,8,9,10])if(p.cc>=k)mark('CC'+k,now);if(p.job)return;atGate();
  if(p.cc<P.CC.max&&afford(P.costOf('cc',p.cc+1))){try{plotAction(s,{action:'plot-upgrade',plot:{id:'cc'}},now,{bmn:{il:99,ar:99}});return;}catch(e){}}
  const opts=[];for(const [t,B] of Object.entries(P.BUILDINGS)){if(B.gate)continue;const cur=Object.entries(p.b).filter(([,b])=>b.t===t);
   for(const [id,b] of cur)if(!P.buildCheck(p,t,b.l+1,id))opts.push({cp:P.costOf(t,b.l+1).cp,a:()=>plotAction(s,{action:'plot-upgrade',plot:{id}},now)});
   if(!P.buildCheck(p,t,1)&&!(B.turret&&P.turretCount(p)>=6)){const pos=P.autoPlace(p,t);if(pos)opts.push({cp:P.costOf(t,1).cp,a:()=>plotAction(s,{action:'plot-build',plot:{type:t,...pos}},now)});}}
  opts.sort((x,y)=>x.cp-y.cp);for(const o of opts){try{if(o.cp<=s.ledger.cp){o.a();return;}}catch(e){}}};
 const split=cp0=>{const half=spent>=2550?Math.floor((s.ledger.cp-cp0)/2):0;s.ledger.cp-=half;};
 for(let day=0;day<180;day++){for(const [h,mins] of sessions){let now=start+day*DAY+h*3600000;
  if(s.base.tier){atGate();try{baseAction(s,{action:'base-claim'},now);}catch(e){}try{plotAction(s,{action:'plot-collect',plot:{}},now);}catch(e){}}build(now);
  for(let m=0;m<mins;m+=1.5){now+=90000;played+=1.5;const id=played<=75?legacy[serial%legacy.length]:C.raidIds[serial%C.raidIds.length];serial++;
   if(!chain)delete s.chain;s.mission=id;s.attempt=serial;s.featuredMission=false;const cp0=s.ledger.cp;refreshState(s,now);missionReward(s,now);s.mission=null;split(cp0);
   s.position=at(1174,1168);bank(s,now);
   if(orders)for(const o of (s.wo?.list||[]).filter(o=>o.done&&!o.claimed)){const c0=s.ledger.cp;try{claimOrder(s,{seq:0,action:'claim-order',order:o.id},now);claimed++;}catch(e){}split(c0);}
   build(now);}}
  build(start+(day+1)*DAY-1000);if(hit.CC10&&day>hit.CC10.day+2)break;}
 return {hit,playedMin:Math.round(played),ordersClaimed:claimed};}
const regular=[[19,60]],PANEL=101,SEED=k=>(1000+k)*7919;
const v1=run(regular,{chain:false,orders:false,seed:SEED(0)}),v2=run(regular,{chain:true,orders:false,seed:SEED(0)});
const panel=[];for(let k=1;k<=PANEL;k++)panel.push(run(regular,{chain:true,orders:true,seed:SEED(k)}));
const day=(v,c)=>v.hit[c]?.day,off=(a,b)=>Math.round((a/b-1)*1000)/10,inside=(a,b)=>a!==undefined&&Math.abs(a/b-1)<=.1;
const med=a=>[...a].sort((x,y)=>x-y)[a.length>>1],days=c=>panel.map(v=>day(v,c)??999);
const all={CC5:med(days('CC5')),CC10:med(days('CC10'))},share=c=>Math.round(100*panel.filter(v=>inside(day(v,c),AUDIT[c].day)).length/PANEL);
const out={scope:'audit method (60 min/day regular), current code; not a human playtest',chainPerLink:C.LIVING.chain.per,audit:{CC5:AUDIT.CC5.day,CC10:AUDIT.CC10.day},
 band:{CC5:[+(AUDIT.CC5.day*.9).toFixed(2),+(AUDIT.CC5.day*1.1).toFixed(2)],CC10:[+(AUDIT.CC10.day*.9).toFixed(2),+(AUDIT.CC10.day*1.1).toFixed(2)]},
 decision10:{CC5:day(v1,'CC5'),CC10:day(v1,'CC10')},withChain:{CC5:day(v2,'CC5'),CC10:day(v2,'CC10')},
 withChainAndOrders:{pilots:PANEL,CC5:all.CC5,CC10:all.CC10,CC5range:[Math.min(...days('CC5')),Math.max(...days('CC5'))],CC10range:[Math.min(...days('CC10')),Math.max(...days('CC10'))],
  inBandPct:{CC5:share('CC5'),CC10:share('CC10')},ordersClaimed:med(panel.map(v=>v.ordersClaimed))}};
mkdirSync('docs/conquest/session6',{recursive:true});writeFileSync('docs/conquest/session6/ladder.json',JSON.stringify(out,null,1)+'\n');console.log(JSON.stringify(out));
assert(inside(day(v1,'CC5'),AUDIT.CC5.day)&&inside(day(v1,'CC10'),AUDIT.CC10.day),'Decision 10 (production x3, storage x2): regular CC5 day '+day(v1,'CC5')+' ('+off(day(v1,'CC5'),AUDIT.CC5.day)+'%), CC10 day '+day(v1,'CC10')+' ('+off(day(v1,'CC10'),AUDIT.CC10.day)+'%) vs the audit table '+AUDIT.CC5.day+' / '+AUDIT.CC10.day);
console.log('PASS Decision 10: production x3 + storage x2 keep the regular CC5 day '+day(v1,'CC5')+' and CC10 day '+day(v1,'CC10')+' within +-10% of the audit table ('+AUDIT.CC5.day+' / '+AUDIT.CC10.day+')');
assert(inside(all.CC5,AUDIT.CC5.day)&&inside(all.CC10,AUDIT.CC10.day),'owner rule (Nov 16): with EVERY Session 6 change on (production x3, storage x2, the Sortie chain at +'+(+(C.LIVING.chain.per*100).toFixed(2))+'% a link, War Orders) the median of '+PANEL+' pilots reaches CC5 on day '+all.CC5+' ('+off(all.CC5,AUDIT.CC5.day)+'%) and CC10 on day '+all.CC10+' ('+off(all.CC10,AUDIT.CC10.day)+'%): outside +-10% of the audit table '+AUDIT.CC5.day+' / '+AUDIT.CC10.day);
console.log('PASS owner rule: every Session 6 change on (chain +'+(+(C.LIVING.chain.per*100).toFixed(2))+'% a link, War Orders): median of '+PANEL+' pilots CC5 day '+all.CC5+' / CC10 day '+all.CC10+' within +-10% of the audit table ('+out.withChainAndOrders.inBandPct.CC5+'% / '+out.withChainAndOrders.inBandPct.CC10+'% of pilots inside the band; CC10 range '+out.withChainAndOrders.CC10range.join('-')+')');
for(const [n,v] of [['the Sortie chain',v2],...panel.map((v,k)=>['pilot '+(k+1)+' with the chain and War Orders',v])])assert(day(v,'CC10')>=7,'no instant max-out with '+n+': CC10 day '+day(v,'CC10'));
console.log('PASS no instant max-out: CC10 never inside the first week (chain only: day '+day(v2,'CC10')+'; every panel pilot)');
