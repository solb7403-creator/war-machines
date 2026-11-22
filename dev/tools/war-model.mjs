// Session 7 Living Front pace model (owner brief decisions 6 and 11). Deterministic, read-only: the real Worker reward, bank, claim,
// plot and War Order functions on a modelled pilot; never a server, a save or Firebase.
//  1. The regular pilot's daily Conquest income (the economy model's regular: 60 min a day; the audit method: a completed sortie every
//     90 s, Command Base yield and town production collected each session, War Orders claimed), split into what the supply bonus
//     touches (production: the Daily Base Yield's CP and materials, the town's Refinery / Biodome / Helium Extractor) and what it does
//     not (sorties, War Orders). Level 1 of Fortify costs about half a day of it (decision 6: js/conquest/war.js WAR.fortify.l1).
//  2. The year-long pace (decisions 6 and 11): a regular free pilot who puts EVERY CP, alloy and He-3 of that income into Fortify, with
//     every bonus on (the supply bonus at the level the fortifications have reached, War Orders, the town's full production), fortifies
//     all 12 capturable human territories to level 5. No wear (wear only adds time). The same with the Lunar Pass (20% cheaper).
// usage: node dev/tools/war-model.mjs [--json out.json]
import {writeFileSync,mkdirSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST,RULES:R}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Plot:P,War:WR}=CONQUEST;
const {createState,refreshState}=await import('../../worker/src/conquest-sim.js');
const {missionReward,bank}=await import('../../worker/src/conquest-economy.js');
const {campaign,baseAction}=await import('../../worker/src/conquest-campaign.js');
const {plotAction}=await import('../../worker/src/conquest-plot.js');
const {claimOrder,orderEvent}=await import('../../worker/src/conquest-orders.js');
const DAY=86400000,start=Date.UTC(2026,10,10,0),at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),K=['cp','alloy','helium'];
const DAYS=Number(process.argv.find(a=>a.startsWith('--days='))?.slice(7))||120;
// the audit method, as dev/tests/conquest-ladder-check.mjs runs it (with War Orders on), but recording what each source paid
export function income(days=DAYS,seed=7919){const s=createState(R.STOCK_L,start);s.lseed=seed;delete s.wo;const legacy=['oxygen-line','relay','recon','convoy','rescue','redoubt'];let serial=0,played=0;
 s.war.sc={n:9,done:1};   // the pilot fights no war battle here: its front is left alone (supply comes only from fortifications, so 0)
 const tot=()=>({cp:s.ledger.cp,alloy:(s.ledger.banked.alloy||0)+(s.ledger.cargo?.alloy||0),helium:(s.ledger.banked.helium||0)+(s.ledger.cargo?.helium||0)});
 const diff=(a,b)=>Object.fromEntries(K.map(k=>[k,b[k]-a[k]])),add=(acc,d)=>{for(const k of K)acc[k]+=Math.max(0,d[k]);};
 const afford=c=>Object.entries(c||{}).every(([k,n])=>k==='cp'?s.ledger.cp>=n:P.MNS.includes(k)?true:s.ledger.banked[k]>=n);
 const atGate=()=>{s.position=at(C.baseDefinition.x,C.baseDefinition.z);s.battle.enemies=[];};
 const build=now=>{campaign(s,now);if(!s.base.tier){if(afford(C.baseDefinition.recipe)){atGate();baseAction(s,{action:'build-base',plot:{site:'crater'}},now);}return;}
  const p=s.plot;if(p.job)return;atGate();if(p.cc<P.CC.max&&afford(P.costOf('cc',p.cc+1))){try{plotAction(s,{action:'plot-upgrade',plot:{id:'cc'}},now,{bmn:{il:99,ar:99}});return;}catch(e){}}
  const opts=[];for(const [t,B] of Object.entries(P.BUILDINGS)){if(B.gate)continue;const cur=Object.entries(p.b).filter(([,b])=>b.t===t);for(const [id,b] of cur)if(!P.buildCheck(p,t,b.l+1,id))opts.push({cp:P.costOf(t,b.l+1).cp,a:()=>plotAction(s,{action:'plot-upgrade',plot:{id}},now)});
   if(!P.buildCheck(p,t,1)&&!(B.turret&&P.turretCount(p)>=6)){const pos=P.autoPlace(p,t);if(pos)opts.push({cp:P.costOf(t,1).cp,a:()=>plotAction(s,{action:'plot-build',plot:{type:t,...pos}},now)});}}
  opts.sort((x,y)=>x.cp-y.cp);for(const o of opts){try{if(o.cp<=s.ledger.cp){o.a();return;}}catch(e){}}};
 const out=[];for(let day=0;day<days;day++){const prod={cp:0,alloy:0,helium:0},sortie={cp:0,alloy:0,helium:0},orders={cp:0,alloy:0,helium:0};let now=start+day*DAY+19*3600000;
  const spentBuild=()=>{};
  if(s.base.tier){atGate();let a=tot();try{baseAction(s,{action:'base-claim'},now);}catch(e){}try{plotAction(s,{action:'plot-collect',plot:{}},now);}catch(e){}add(prod,diff(a,tot()));}
  const b0=tot();build(now);const spent0=diff(tot(),b0);
  if(s.base.tier)orderEvent(s,'drill',1);
  for(let m=0;m<60;m+=1.5){now+=90000;played+=1.5;const id=played<=75?legacy[serial%legacy.length]:C.raidIds[serial%C.raidIds.length];serial++;delete s.chain;s.mission=id;s.attempt=serial;s.featuredMission=false;refreshState(s,now);
   let a=tot();missionReward(s,now);orderEvent(s,'kill',6);s.mission=null;s.position=at(1174,1168);bank(s,now);add(sortie,diff(a,tot()));
   for(const o of (s.wo?.list||[]).filter(o=>o.done&&!o.claimed)){a=tot();try{claimOrder(s,{seq:0,action:'claim-order',order:o.id},now);}catch(e){}add(orders,diff(a,tot()));}
   build(now);}
  build(start+(day+1)*DAY-1000);out.push({day,cc:s.plot?.cc||0,prod,sortie,orders});}
 return out;}
const avg=(rows,f)=>{const o={cp:0,alloy:0,helium:0};for(const r of rows){const x=f(r);for(const k of K)o[k]+=x[k]/rows.length;}for(const k of K)o[k]=Math.round(o[k]);return o;};
// the year-long pace: every CP, alloy and He-3 into the cheapest next level of the 12 capturable human territories, one at a time
export function pace(rows,{pass=false,supply=true}={}){const w=WR.fresh(start);for(const t of WR.TERRITORIES)if(t.cap&&t.start==='h')w.f[t.id]=0;
 const targets=WR.TERRITORIES.filter(t=>t.cap&&t.start==='h').map(t=>t.id),bag={cp:0,alloy:0,helium:0},steady=rows.slice(Math.min(60,rows.length-30));let days=0,levels=0;const milestones={};
 for(let d=0;d<3650;d++){const r=d<rows.length?rows[d]:steady[d%steady.length],sup=supply?WR.supply(w):0;for(const k of K)bag[k]+=r.sortie[k]+r.orders[k]+r.prod[k]*(1+sup);
  for(let guard=0;guard<60;guard++){const next=targets.filter(id=>(w.f[id]||0)<5).map(id=>({id,l:(w.f[id]||0)+1,c:WR.fortifyCost(id,(w.f[id]||0)+1,pass)})).sort((a,b)=>a.c.cp-b.c.cp)[0];if(!next)break;if(!K.every(k=>bag[k]>=next.c[k]))break;
   for(const k of K)bag[k]-=next.c[k];w.f[next.id]=next.l;levels++;if(!milestones['L'+next.l+'all']&&targets.every(id=>(w.f[id]||0)>=next.l))milestones['L'+next.l+'all']=d+1;if(!milestones.supplyMax&&WR.supply(w)>=WR.WAR.supply.max)milestones.supplyMax=d+1;}
  if(targets.every(id=>w.f[id]>=5)){days=d+1;break;}}
 return {days,levels,milestones,supplyAtEnd:WR.supply(w),pass};}
export function model(days=DAYS){const rows=income(days),steady=rows.slice(Math.min(60,rows.length-30)),all=avg(rows,r=>({cp:r.prod.cp+r.sortie.cp+r.orders.cp,alloy:r.prod.alloy+r.sortie.alloy+r.orders.alloy,helium:r.prod.helium+r.sortie.helium+r.orders.helium}));
 const l1=WR.WAR.fortify.l1,half=Object.fromEntries(K.map(k=>[k,Math.round(all[k]/2)]));
 return {scope:'the regular (60 min a day, audit method: a sortie every 90 s, yield and production collected, War Orders claimed) on the real Worker functions; modelled, not playtested',
  days,incomePerDay:all,production:avg(rows,r=>r.prod),sorties:avg(rows,r=>r.sortie),warOrders:avg(rows,r=>r.orders),steadyPerDay:avg(steady,r=>({cp:r.prod.cp+r.sortie.cp+r.orders.cp,alloy:r.prod.alloy+r.sortie.alloy+r.orders.alloy,helium:r.prod.helium+r.sortie.helium+r.orders.helium})),
  halfDay:half,fortifyL1:l1,l1VsHalfDay:Object.fromEntries(K.map(k=>[k,Math.round(l1[k]/half[k]*100)/100])),allTwelveToL5:WR.fortifyAll(),
  pace:{everyBonus:pace(rows,{supply:true}),noSupply:pace(rows,{supply:false}),lunarPass:pace(rows,{supply:true,pass:true})}};}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].split('/').pop())){const m=model(),o=process.argv.indexOf('--json');const j=JSON.stringify(m,null,1);if(o>0){mkdirSync('docs/economy',{recursive:true});writeFileSync(process.argv[o+1],j+'\n');}console.log(j);}
