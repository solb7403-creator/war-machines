// Session 7T fortress model (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md, decision 4). Deterministic and read-only: the real
// Worker reward, bank, claim, plot and War Order functions on a modelled pilot (the method of dev/tools/war-model.mjs and the audit),
// the real plot rules (js/conquest/plot.js) and the real raid engine (js/conquest/raid.js). Never a server, a save or Firebase.
//  1. Income: what a pilot earns a day at a play time (a completed sortie every 90 s in each session, the Daily Base Yield and the
//     town's production collected, War Orders claimed), the CP / alloy / biomass / He-3 the town can spend.
//  2. The town a pilot builds over the year (townAt): the Command Center on the audit ladder (docs/conquest/audit/model/audit-economy.json,
//     the economy model's town ladder: regular = 60 min a day, grinder = 4 h a day in two sessions), half of the income to the town's
//     defenses (the audit's split: the other half to engineering, Fortify and the other sinks), the builder's real job times in the
//     pilot's sessions (one builder; the Lunar Pass / store second builder for the paying pilot), walls from the Foundry's composite and
//     ore blends from half of the mineral income (the other half to plating), the garrison from the battalion model's roster and Hangar.
//     A decent player's layout on each of the seven sites (the balance fixtures' placement: vitals by the Command Center, turrets on two
//     rings, wall rings outside them).
//  3. Raids: THREAT from the Citadel tiers on the blueprint's pacing (§6 pacing targets), the attacking general's stars
//     (ConquestTown.STARS), the portal open three raids in four, the Grand Offensive surge one raid in eight; the raid level from
//     ConquestTown.levelOf; every site, several seeds and lanes.
// usage: node dev/tools/fortress-model.mjs [--quick] [--json out.json]
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST,RULES:R}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Plot:P,War:WR,Raid:RD,Town:TN,Battalion:BT}=CONQUEST;
const {createState,refreshState}=await import('../../worker/src/conquest-sim.js');
const {missionReward,bank}=await import('../../worker/src/conquest-economy.js');
const {campaign,baseAction}=await import('../../worker/src/conquest-campaign.js');
const {plotAction}=await import('../../worker/src/conquest-plot.js');
const {claimOrder,orderEvent}=await import('../../worker/src/conquest-orders.js');
const {MODEL}=await import('./economy-model.mjs');
const DAY=86400000,HOUR=3600000,start=Date.UTC(2026,10,10,0),at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),K=['cp','alloy','biomass','helium'];
// ---- profiles (the audit's: the economy model's town ladder uses them) ----
const AUDIT=JSON.parse(readFileSync(new URL('../../docs/conquest/audit/model/audit-economy.json',import.meta.url),'utf8')).profiles;
export const PROFILES={
 regular:{label:'Regular (60 min a day, one session)',sessions:[[19,60]],ladder:'regular',share:.5,builders:1,citadel:[[0,0],[17,1],[49,3],[135,6],[320,9]],gear:[[0,0],[30,1],[150,2]]},
 grinder:{label:'Grinder (4 h a day, two sessions)',sessions:[[10,120],[19,120]],ladder:'grinder',share:.5,builders:1,citadel:[[0,0],[6,1],[21,3],[60,6],[135,9]],gear:[[0,0],[10,1],[60,2]]},
 // the paying pilot at the grinder's play time: the store's planned levers (docs/ROADMAP.md standing decisions: second builder, speed-ups,
 // wall extension packs, common / uncommon ore; checkout off until Session 8): two builders, the extension packs, Ferrite and Ilmenite
 // bought as needed, Epic gear from day 1 (crates); never CP, never rare-or-better ore (earn-only)
 payer:{label:'Paying pilot at the grinder\'s play time (store levers as planned)',sessions:[[10,120],[19,120]],ladder:'grinder',share:.5,builders:2,citadel:[[0,0],[6,1],[21,3],[60,6],[135,9]],gear:[[0,2]],buyFeIl:true,extPacks:true}};
const interp=(pts,d)=>{let v=pts[0][1];for(let i=0;i<pts.length;i++){if(d>=pts[i][0])v=pts[i][1];if(i+1<pts.length&&d>=pts[i][0]&&d<pts[i+1][0]){const [a,va]=pts[i],[b,vb]=pts[i+1];return va+(vb-va)*(d-a)/(b-a);}}return v;};
export const tiersAt=(pr,d)=>Math.max(0,Math.min(9,Math.floor(interp(pr.citadel,d))));
const ccAt=(pr,d)=>{const L=AUDIT[pr.ladder].base.hit;let cc=0;for(let k=1;k<=10;k++)if(d>=L['CC'+k].day)cc=k;return cc;};
// ---- 1. income (the war model's method, any play time) ----
const cache={};
export function income(pr,days){const key=JSON.stringify(pr.sessions)+days;if(cache[key])return cache[key];const s=createState(R.STOCK_L,start);s.lseed=7919;delete s.wo;s.war.sc={n:9,done:1};
 const legacy=['oxygen-line','relay','recon','convoy','rescue','redoubt'];let serial=0,played=0;
 const tot=()=>({cp:s.ledger.cp,alloy:(s.ledger.banked.alloy||0)+(s.ledger.cargo?.alloy||0),biomass:(s.ledger.banked.biomass||0)+(s.ledger.cargo?.biomass||0),helium:(s.ledger.banked.helium||0)+(s.ledger.cargo?.helium||0)});
 const diff=(a,b)=>Object.fromEntries(K.map(k=>[k,b[k]-a[k]])),add=(acc,d)=>{for(const k of K)acc[k]+=Math.max(0,d[k]);};
 const afford=c=>Object.entries(c||{}).every(([k,n])=>k==='cp'?s.ledger.cp>=n:P.MNS.includes(k)?true:s.ledger.banked[k]>=n);
 const atGate=()=>{s.position=at(C.baseDefinition.x,C.baseDefinition.z);s.battle.enemies=[];};
 // the earning town: the Command Center and the production buildings only (the income model's town; the defense spend is townAt's)
 const build=now=>{campaign(s,now);if(!s.base.tier){if(afford(C.baseDefinition.recipe)){atGate();baseAction(s,{action:'build-base',plot:{site:'crater'}},now);}return;}
  const p=s.plot;if(p.job)return;atGate();if(p.cc<P.CC.max&&afford(P.costOf('cc',p.cc+1))){try{plotAction(s,{action:'plot-upgrade',plot:{id:'cc'}},now,{bmn:{il:99,ar:99}});return;}catch(e){}}
  const opts=[];for(const t of ['refinery','biodome','helium','storage','reactor']){const B=P.BUILDINGS[t],cur=Object.entries(p.b).filter(([,b])=>b.t===t);for(const [id,b] of cur)if(!P.buildCheck(p,t,b.l+1,id))opts.push({cp:P.costOf(t,b.l+1).cp,a:()=>plotAction(s,{action:'plot-upgrade',plot:{id}},now)});
   if(!P.buildCheck(p,t,1)){const pos=P.autoPlace(p,t);if(pos)opts.push({cp:P.costOf(t,1).cp,a:()=>plotAction(s,{action:'plot-build',plot:{type:t,...pos}},now)});}}
  opts.sort((x,y)=>x.cp-y.cp);for(const o of opts){try{if(o.cp<=s.ledger.cp*.25){o.a();return;}}catch(e){}}};
 const out=[];for(let day=0;day<days;day++){const row={day,cc:0,...Object.fromEntries(K.map(k=>[k,0]))};
  for(const [h,mins] of pr.sessions){let now=start+day*DAY+h*HOUR;const a0=tot();
   if(s.base.tier){atGate();try{baseAction(s,{action:'base-claim'},now);}catch(e){}try{plotAction(s,{action:'plot-collect',plot:{}},now);}catch(e){}}
   const b0=tot();build(now);const spent=diff(tot(),b0);if(s.base.tier)orderEvent(s,'drill',1);
   for(let m=0;m<mins;m+=1.5){now+=90000;played+=1.5;const id=played<=75?legacy[serial%legacy.length]:C.raidIds[serial%C.raidIds.length];serial++;delete s.chain;s.mission=id;s.attempt=serial;s.featuredMission=false;refreshState(s,now);
    missionReward(s,now);orderEvent(s,'kill',6);s.mission=null;s.position=at(1174,1168);bank(s,now);
    for(const o of (s.wo?.list||[]).filter(o=>o.done&&!o.claimed)){try{claimOrder(s,{seq:0,action:'claim-order',order:o.id},now);}catch(e){}}
    const b1=tot();build(now);const sp=diff(tot(),b1);for(const k of K)spent[k]+=sp[k];}
   const d=diff(a0,tot());for(const k of K)row[k]+=d[k]-spent[k];}
  row.cc=s.plot?.cc||0;out.push(row);}
 return cache[key]=out;}
// minerals a day (the economy model's own formula: gathering, operation caches, Meteor Strikes with Resonance), for a play time
const Pm=MODEL.P,A=Pm.conquest.activities,MIN=['fe','il','ar','tq','se','mh'],ramp=(d,from,full)=>d<from?0:d>=full?1:.5;
export function minerals(pr,d){const m=pr.sessions.reduce((a,x)=>a+x[1],0),n=pr.sessions.length,inc=Object.fromEntries(MIN.map(k=>[k,0])),add=(o,x=1)=>{for(const [k,v] of Object.entries(o))inc[k]+=v*x;};
 const aAr=ramp(d,3,8),aTq=ramp(d,14,30),aVet=ramp(d,30,45),g=.25*m,sh={fe:.45,il:.30,ar:.17*aAr,tq:.08*aTq},tot=Object.values(sh).reduce((a,b)=>a+b,0);
 for(const k of ['fe','il','ar','tq']){const D=Pm.deposits[k],minutes=g*sh[k]/tot,supply=D.veins*D.cap*(D.regrowH<=24?Math.min(n,24/D.regrowH):24/D.regrowH)/D.yield,h=Math.min(minutes/A['gather_'+k].par,supply);inc[k]+=h*D.yield;if(k==='tq')inc.se+=h*D.seVein;}
 const ops=.45*m,mix=d<1?{field:1}:d<7?{field:.5,raid_hard:.5}:d<30?{field:.2,raid_hard:.6,defense:.2}:{raid_hard:.4*(1-aVet)+.1,raid_veteran:.4*aVet+.1*(1-aVet),defense:.2,field:.3*(1-aVet)},mt=Object.values(mix).reduce((a,b)=>a+b,0);
 for(const [id,f] of Object.entries(mix)){const k=ops*(f/mt)/A[id].par,win=id==='raid_hard'?(d<7?.7:.9):id==='raid_veteran'?.8:1;add(Pm.opMinerals[id],k*win);}
 const strikes=Math.min(1440/Pm.strike.everyMin,n*(m/n+Pm.strike.windowMin)/Pm.strike.everyMin),okp=d<7?.6:d<21?.85:.95,st=strikes*okp;add(Pm.strike.guaranteed,st);inc.se+=st*(Pm.strike.se+1/Pm.strike.resonance.se);inc.mh+=st*(Pm.strike.mh+1/Pm.strike.resonance.mh);
 return inc;}
// ---- 2. the town a pilot builds ----
const SUPPORT=['storage','reactor','foundry','hangar','shield'];
const ORDER=['cannon','mg','laser','rocket','missile','mortar','flame','siege','tesla','lasercannon','railgun'];
// the walls' blend ladder, weakest to strongest (every unlocked (ore, level), by q)
const BLENDS=(()=>{const out=[[0,0]];for(let o=1;o<=6;o++)for(let l=1;l<=3;l++)out.push([o,l]);return out.sort((a,b)=>P.blendQ(a[0],a[1])-P.blendQ(b[0],b[1]));})();
const oreFor=(o,l,n)=>o?{[P.ORES[o-1]]:P.ORE_UNITS[o]*P.BLEND_UNITS[l]*n/40}:{};
// The pilot's town on a site at day `days` (the model replays every day up to it). Returns {plot, garrison units, log}.
export function townAt(prName,site,days,{share,citadelX}={}){const pr={...PROFILES[prName]};if(share!==undefined)pr.share=share;const rows=income(pr,Math.max(1,Math.ceil(days)+1)),p=P.newPlot(site,start);p.cc=1;p.b.cc.l=1;
 const bag={cp:0,alloy:0,biomass:0,helium:0,fe:0,il:0,ar:0,tq:0,se:0,mh:0},jobs=[],rings=[];let cm=P.COMPOSITE.start,n=0,wallCells=0,ext=0;
 const cost=(t,l)=>P.costOf(t,l)||{},can=c=>Object.entries(c).every(([k,v])=>(bag[k]||0)>=v-1e-9),pay=c=>{for(const [k,v] of Object.entries(c))bag[k]-=v;};
 const turrets=()=>Object.values(p.b).filter(b=>P.BUILDINGS[b.t]?.turret);
 const ring=(R,a)=>[Math.round(P.MID+Math.cos(a)*R),Math.round(P.MID+Math.sin(a)*R)];
 // a decent player's placement: support buildings by the Command Center, turrets on two rings inside the walls
 const place=t=>{if(P.BUILDINGS[t]?.turret){const h=P.townH(p.cc),R1=Math.max(6,Math.round(h*.3)),R2=Math.max(9,Math.round(h*.43));for(let k=0;k<800;k++){const [i,j]=ring(k%2?R2:R1,(n+k)*2.399);if(!P.placeError(p,t,i,j,0))return {i,j,r:0};}return null;}return P.autoPlace(p,t);};
 const wallR0=()=>Math.max(11,Math.round(P.townH(p.cc)*.5));
 const day0=s=>Math.floor(s);
 for(let d=0;d<days;d++){const r=rows[d]||rows.at(-1),gear=0;for(const k of K)bag[k]+=Math.max(0,r[k])*pr.share;const mn=minerals(pr,d);for(const k of MIN)bag[k]+=mn[k]*.5;
  if(pr.buyFeIl){bag.fe+=200;bag.il+=60;}   // common / uncommon ore bought as needed (the store's sellable ores)
  // the Command Center on the audit ladder (its cost paid from the town's share; the ladder already accounts for it, so it never stalls)
  const want=ccAt(pr,d+1);while(p.cc<want){p.cc++;p.b.cc.l=p.cc;const c=P.CC.cost[p.cc];if(c)for(const k of K)bag[k]=Math.max(0,bag[k]-(c[k]||0));}
  // composite: the Foundry turns loaded alloy into composite at its rate (5 an hour a level), all day
  const fl=P.levelSum(p,'foundry');if(fl){const make=Math.min(P.COMPOSITE.rate*fl*24,bag.alloy*P.COMPOSITE.perAlloy*.5);cm=Math.min(cm+make,P.COMPOSITE.cap0+P.COMPOSITE.capPer*fl+3000);bag.alloy-=make/P.COMPOSITE.perAlloy;}
  // wall extensions: drill milestones (CC1/3/5/7/9) and defense wins (3 and 10) as the pilot plays; Foundry research with ore; the store packs
  ext=Math.min(50,(p.cc>=9?20:p.cc>=7?16:p.cc>=5?12:p.cc>=3?8:4)+(d>=10?5:0)+(d>=30?5:0)+(P.levelOf(p,'foundry')>=5&&d>=40?30:P.levelOf(p,'foundry')*6)+(pr.extPacks?50:0));
  // the builder in the pilot's sessions: start the next job whenever the builder is free (jobs run on the Worker clock)
  for(const [h,mins] of pr.sessions){const t0=d*24+h,t1=t0+mins/60;let busy=[...jobs.filter(j=>j.end>t0)];for(const j of jobs.filter(j=>j.end<=t0))j.done?.();jobs.length=0;jobs.push(...busy);
   for(let guard=0;guard<200;guard++){const free=pr.builders-jobs.filter(j=>j.end>(jobs.at(-1)?.start??t0)).length;let now=t0;const ends=jobs.map(j=>j.end).sort((a,b)=>a-b);if(jobs.length>=pr.builders){now=ends[0];if(now>t1)break;for(const j of jobs.filter(j=>j.end<=now)){j.done?.();jobs.splice(jobs.indexOf(j),1);}}
    const job=nextJob();if(!job)break;pay(job.c);jobs.push({start:now,end:now+job.ms/HOUR,done:job.done});}}
  // walls: rings outside the turrets, composite and ore permitting (instant orders; no builder)
  const cap=P.wallBase(p.cc)+Math.floor(P.wallBase(p.cc)*ext/100);while(wallCells<cap&&cm>=1){const R0=wallR0()+rings.length,per=8*R0;if(R0>P.townH(p.cc)-1)break;const k=Math.min(per,Math.floor(cm),cap-wallCells);if(k<per*.5&&k<cap-wallCells)break;rings.push({R:R0,n:k,code:1});cm-=k;wallCells+=k;}
  // blends: the weakest ring first, to the best blend its ore and the Command Center allow
  for(let guard=0;guard<40;guard++){const g=rings.slice().sort((a,b)=>P.wallStats(a.code,site).hp-P.wallStats(b.code,site).hp)[0];if(!g)break;const cur=P.wdecode(g.code),q0=P.blendQ(cur.o,cur.l);
   const up=BLENDS.filter(([o,l])=>P.blendQ(o,l)>q0&&p.cc>=P.ORE_CC[o]&&can(oreFor(o,l,g.n))).sort((a,b)=>P.blendQ(b[0],b[1])-P.blendQ(a[0],a[1]))[0];if(!up)break;pay(oreFor(up[0],up[1],g.n));g.code=P.wcode(up[0],up[1]);}
 }
 function nextJob(){const cc=p.cc,cands=[];
  const add=(t,l,id,prio)=>{const c=t==='cc'?{}:cost(t,l);if(!can(c))return;cands.push({t,l,id,c,prio,ms:P.timeOf(t,l)});};
  for(const t of SUPPORT){const cur=Object.entries(p.b).filter(([,b])=>b.t===t);for(const [id,b] of cur)if(!P.buildCheck(p,t,(b.l|0)+1,id)&&(t!=='reactor'||P.powerUse(p)>P.powerSupply(p)*.8))add(t,(b.l|0)+1,id,t==='storage'?1:3);if(!P.buildCheck(p,t,1)&&(t!=='reactor'||P.powerUse(p)>P.powerSupply(p)*.8))add(t,1,null,2);}
  const ts=turrets(),capN=P.TURRET_CAP[cc-1],free=P.powerSupply(p)-P.powerUse(p);
  if(ts.length<capN){const types=ORDER.filter(t=>cc>=P.BUILDINGS[t].cc),t=types[ts.length%types.length];if(free>=P.BUILDINGS[t].pw)add(t,1,null,4);}
  const low=Object.entries(p.b).filter(([,b])=>P.BUILDINGS[b.t]?.turret&&(b.l|0)<P.levelCap(b.t,cc)).sort((a,b)=>a[1].l-b[1].l||P.costOf(a[1].t,a[1].l+1).cp-P.costOf(b[1].t,b[1].l+1).cp)[0];
  if(low&&free>=P.BUILDINGS[low[1].t].pw)add(low[1].t,low[1].l+1,low[0],5);
  const pick=cands.sort((a,b)=>a.prio-b.prio||a.c.cp-b.c.cp)[0];if(!pick)return null;
  if(!pick.id){const pos=place(pick.t);if(!pos)return null;const id='b'+(++p.n);p.b[id]={t:pick.t,...pos,l:0};return {c:pick.c,ms:pick.ms,done:()=>{p.b[id].l=1;}};}
  const b=p.b[pick.id],target=pick.l;b.busy=1;return {c:pick.c,ms:pick.ms,done:()=>{b.l=Math.max(b.l|0,target);delete b.busy;}};}
 // the walls on the plot: the rings, innermost first (each ring one blend)
 for(const g of rings){const pl=P.wallPlan({...p,devx:1},[{k:'rect',a:[P.MID-g.R,P.MID-g.R],b:[P.MID+g.R,P.MID+g.R],o:P.wdecode(g.code).o,l:P.wdecode(g.code).l}],{dev:true});let k=0;for(const x of pl.cells){if(k++>=g.n)break;p.w[x.i+','+x.j]=x.code;}}
 for(const b of Object.values(p.b))if(!(b.l>0)&&b.t!=='cc'){}   // a building still under construction does not fight (l 0)
 const tier=Math.round(interp(pr.gear,days));return {plot:p,rings,bag,garrison:garrisonAt(pr,p,days,tier),ext};}
// the garrison: the battalion model's roster at this day, fielded by the Hangar (the rest are reserves), one slot a Hangar level, the
// spare gear tier the profile's pilot owns by then (Common / Rare / Epic)
const BAT={};function rosterAt(pr,d){const m=pr.sessions.reduce((a,x)=>a+x[1],0);const key=m;if(!BAT[key])BAT[key]=MODEL.battalionModel({minutes:m});const B=BAT[key];
 // pilots by day: the model's own rule (the wingman, a RECRUIT job each session once a Hangar stands, the day's rescue win)
 return Math.min(16,1+Math.max(0,Math.floor(d-1))+Math.max(0,Math.floor(d-3)));}
export function garrisonAt(pr,p,d,tier){const lv=P.levelOf(p,'hangar'),slots=Math.min(5,P.garrisonSlots(p)),roster=rosterAt(pr,d),fielded=BT.fieldCap(lv),reserves=Math.max(0,roster-fielded),n=Math.min(slots,reserves);
 const kit={w:{a:tier>=2?'siege':'pulse',t:Math.min(2,tier),q:tier>=2?1.08:1},c:{c:'titan',t:Math.min(2,tier),q:tier>=2?1.08:1}};
 return Array.from({length:n},(_,i)=>RD.unitOf({id:'g'+i,kind:'g',kit,rk:Math.min(10,1+Math.floor(d/12))}));}
// the fully built town (decision 4a): Command Center 10, 42 turrets of all eleven types at the highest levels the power budget allows,
// three Shield Generators, five Reactors, the Storage Depot, Hangar V, 3,000 cells (the +50% extension cap) of Moonheart heavy, a full
// garrison (five) in top gear
export function fullTown(site){const p=P.newPlot(site,start);p.cc=10;p.b.cc.l=10;p.ext={r:5,d:31,w:12};const put=(t,l,n=1)=>{for(let k=0;k<n;k++){const at=P.autoPlace(p,t);if(at)p.b['b'+(++p.n)]={t,...at,l};}};
 for(const b of Object.values(p.b))if(b.t==='storage')b.l=5;put('reactor',5,5);put('refinery',5,2);put('biodome',5,2);put('helium',5,1);put('foundry',5,1);put('shield',5,3);put('lab',4,1);put('hangar',5,1);
 let n=0;for(let k=0;P.turretCount(p)<42&&k<900;k++){const t=P.TURRETS[n%11],R=k%2?16:12,a=k*2.399,i=Math.round(P.MID+Math.cos(a)*R),j=Math.round(P.MID+Math.sin(a)*R);if(!P.placeError(p,t,i,j,0)){p.b['b'+(++p.n)]={t,i,j,r:0,l:5};n++;}}
 // the power budget: lower the dearest turrets a level at a time until the town's draw fits its supply
 for(let guard=0;guard<200&&P.powerUse(p)>P.powerSupply(p);guard++){const b=Object.values(p.b).filter(x=>P.BUILDINGS[x.t]?.turret&&x.l>1).sort((a,b)=>P.BUILDINGS[b.t].pw-P.BUILDINGS[a.t].pw||b.l-a.l)[0];if(!b)break;b.l--;}
 const cap=P.wallCapOf(p);for(let r=18;Object.keys(p.w).length<cap&&r<=P.townH(10);r++){const pl=P.wallPlan({...p,devx:1},[{k:'rect',a:[P.MID-r,P.MID-r],b:[P.MID+r,P.MID+r],o:6,l:3}],{dev:true});for(const x of pl.cells){if(Object.keys(p.w).length>=cap)break;p.w[x.i+','+x.j]=x.code;}}
 const kit={w:{a:'siege',t:2,q:1.1},c:{c:'titan',t:2,q:1.1}},gar=[0,1,2,3,4].map(i=>RD.unitOf({id:'g'+i,kind:'g',kit:i===0?{w:{a:'moon',t:2,q:1},c:kit.c}:kit,rk:10}));
 return {plot:p,garrison:gar};}
// ---- 3. raids ----
// THREAT for a raid at day d: the Citadel tiers on the profile's pacing (x citadelX), a general by those tiers, the portal open 3 raids
// in 4, the Grand Offensive's surge 1 raid in 8 (the weekend's town target among ~8 raids a week)
export function raidSet(pr,d,n,{citadelX=1,seed=1}={}){const out=[],tiers=Math.max(0,Math.min(9,Math.floor(interp(pr.citadel,d)*citadelX)));
 for(let i=0;i<n;i++){const r=WR.unit('fm:'+seed+':'+d+':'+i),[lo,hi]=TN.STARS[tiers],stars=lo+Math.floor(WR.unit('fs:'+seed+':'+d+':'+i)*(hi-lo+1)),portal=r<.75?1:0,go=WR.unit('fg:'+seed+':'+d+':'+i)<1/8?1:0,th=stars+portal+tiers+go;
  out.push({th,level:TN.levelOf(th),tiers,stars,portal,go,lane:i});}return out;}
export function raid(town,r,site,seed){const R2=RD.make(town.plot,seed,{threat:r.level,lane:r.lane,units:town.garrison,damage:true,frames:false,events:false}).run();return {o:RD.outcomeOf(R2),core:R2.core,lost:Object.values(R2.damage||{}).reduce((a,v)=>a+v,0),k:R2.kills,sp:R2.spawned};}
export function holdRate(prName,d,{sites=P.SITE_IDS,n=4,share,citadelX=1}={}){let held=0,all=0;const per=[];for(const site of sites){const t=townAt(prName,site,d,{share});const rs=raidSet(PROFILES[prName],d,n,{citadelX,seed:site.length});
  for(const [i,r] of rs.entries()){const x=raid(t,r,site,1000+i);all++;if(x.o==='held')held++;per.push({site,level:r.level,o:x.o});}}
 return {p:held/all,held,all,per};}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].split('/').pop())){const quick=process.argv.includes('--quick'),out={};
 for(const pr of ['regular','grinder','payer'])for(const d of [60,180,330]){const h=holdRate(pr,d,{n:quick?2:4});out[pr+'@'+d]={p:Math.round(h.p*100)/100,n:h.all,levels:[...new Set(h.per.map(x=>x.level))].sort((a,b)=>a-b)};console.log(pr,d,JSON.stringify(out[pr+'@'+d]));}
 const o=process.argv.indexOf('--json');if(o>0){mkdirSync('docs/conquest/session7t',{recursive:true});writeFileSync(process.argv[o+1],JSON.stringify(out,null,1)+'\n');}}
