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
const {MODEL}=await import('./economy-model.mjs');const {GEAR}=await import('../tests/combat-sim.mjs');
const YEAR=400,DAY=86400000,HOUR=3600000,start=Date.UTC(2026,10,10,0),at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),K=['cp','alloy','biomass','helium'];
// ---- profiles (the audit's: the economy model's town ladder uses them) ----
const AUDIT=JSON.parse(readFileSync(new URL('../../docs/conquest/audit/model/audit-economy.json',import.meta.url),'utf8')).profiles;
export const PROFILES={
 regular:{label:'Regular (60 min a day, one session)',sessions:[[19,60]],ladder:'regular',share:.5,builders:1,citadel:[[0,0],[17,1],[49,3],[135,6],[320,9]],gear:[[0,0],[30,1],[150,2]]},
 grinder:{label:'Grinder (4 h a day, two sessions)',sessions:[[10,120],[19,120]],ladder:'grinder',share:.5,builders:1,citadel:[[0,0],[6,1],[21,3],[60,6],[135,9]],gear:[[0,0],[10,1],[60,2]]},
 // the paying pilot at the grinder's play time: the store's planned levers (docs/ROADMAP.md standing decisions: second builder, speed-ups,
 // wall extension packs, common / uncommon ore; checkout off until Session 8): two builders, the extension packs, Ferrite and Ilmenite
 // bought as needed, Epic gear from day 1 (crates); never CP, never rare-or-better ore (earn-only)
 // the heavy player (owner, Nov 23: "I'd be shocked if players played for more than 2 [hours a day]"; Session 7T-P decision 2 targets
 // them): 2 h a day in two sessions, the economy model's town ladder at 120 minutes (ladderOf: the log-midpoint of the regular's and the
 // grinder's), the Citadel and gear paced between the two; otherwise as the grinder
 heavy:{label:'Heavy (2 h a day, two sessions)',sessions:[[10,60],[19,60]],ladder:'heavy',share:.5,builders:1,citadel:[[0,0],[10,1],[32,3],[90,6],[208,9]],gear:[[0,0],[17,1],[95,2]]},
 payer:{label:'Paying pilot at the grinder\'s play time (store levers as planned)',sessions:[[10,120],[19,120]],ladder:'grinder',share:.5,builders:2,citadel:[[0,0],[6,1],[21,3],[60,6],[135,9]],gear:[[0,2]],buyFeIl:true,extPacks:true}};
const interp=(pts,d)=>{let v=pts[0][1];for(let i=0;i<pts.length;i++){if(d>=pts[i][0])v=pts[i][1];if(i+1<pts.length&&d>=pts[i][0]&&d<pts[i+1][0]){const [a,va]=pts[i],[b,vb]=pts[i+1];return va+(vb-va)*(d-a)/(b-a);}}return v;};
export const tiersAt=(pr,d)=>Math.max(0,Math.min(9,Math.floor(interp(pr.citadel,d))));
const HEAVY=MODEL.ladderOf(120),hitOf=pr=>pr.ladder==='heavy'?Object.fromEntries(Object.entries(HEAVY).map(([k,day])=>[k,{day}])):AUDIT[pr.ladder].base.hit;
const ccAt=(pr,d)=>{const L=hitOf(pr);let cc=0;for(let k=1;k<=10;k++)if(d>=L['CC'+k].day)cc=k;return cc;};
// ---- 1. income (the war model's method, any play time) ----
const cache={};
export function income(pr,days){const key=JSON.stringify(pr.sessions)+days+(KNOB.cit7b?JSON.stringify(pr.citadel||0):'');if(cache[key])return cache[key];const s=createState(R.STOCK_L,start);s.lseed=7919;delete s.wo;s.war.sc={n:9,done:1};
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
 const out=[];for(let day=0;day<days;day++){const row={day,cc:0,...Object.fromEntries(K.map(k=>[k,0]))};citFor(s,pr,day);
  for(const [h,mins] of pr.sessions){let now=start+day*DAY+h*HOUR;const a0=tot();
   if(s.base.tier){atGate();try{baseAction(s,{action:'base-claim'},now);}catch(e){}try{plotAction(s,{action:'plot-collect',plot:{}},now);}catch(e){}}
   const b0=tot();build(now);const spent=diff(tot(),b0);if(s.base.tier)orderEvent(s,'drill',1);
   for(let m=0;m<mins;m+=1.5){now+=90000;played+=1.5;const id=played<=75?legacy[serial%legacy.length]:C.raidIds[serial%C.raidIds.length];serial++;delete s.chain;s.mission=id;s.attempt=serial;s.featuredMission=false;refreshState(s,now);
    missionReward(s,now);orderEvent(s,'kill',6);s.mission=null;s.position=at(1174,1168);bank(s,now);
    for(const o of (s.wo?.list||[]).filter(o=>o.done&&!o.claimed)){try{claimOrder(s,{seq:0,action:'claim-order',order:o.id},now);}catch(e){}}
    const b1=tot();build(now);const sp=diff(tot(),b1);for(const k of K)spent[k]+=sp[k];}
   const d=diff(a0,tot());for(const k of K)row[k]+=d[k]+spent[k];}   // gross: what the session earned (the earning town's own spend added back)
  row.cc=s.plot?.cc||0;out.push(row);}
 return cache[key]=out;}
// minerals a day (the economy model's own formula: gathering, operation caches, Meteor Strikes with Resonance), for a play time
const Pm=MODEL.P,A=Pm.conquest.activities,MIN=['fe','il','ar','tq','se','mh'],ramp=(d,from,full)=>d<from?0:d>=full?1:.5;
// measurement knobs (Session 7T-P decision 2, the Selenite candidates: dev/tools/selenite-candidates.mjs): resonanceSe overrides the
// strikes a Strike Resonance Selenite takes (candidate A); noTownSe turns off the town defenses' Selenite (the 7T economy); townSeN sets
// the Selenite a cap-level defense held in person pays (the amount's measurement). Empty = the live rules.
export const KNOB={};
// Session 7B (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md, STEP 3 "with every 7B change on"): the Citadel tiers a profile
// has cleared by a day (its pacing, PROFILES[x].citadel) are written to the pilot's record (s.cit.t), so the Worker's own code applies
// the production bonus (+5% a tier: ConquestCombat.baseYield / ConquestPlot.rates cpb) and the Retaliation (the town attack's THREAT).
// KNOB.cit7b=false turns it off (the Session 7T-P measurement). KNOB.heldCache: model-only factors on the held UNFOUGHT raid's defense
// cache {cp, mat} (STEP 3's options: full {1,1}, half {.5,.5}, without its CP {0,1}, none {0,0}); the game pays its own rule.
KNOB.cit7b=true;KNOB.heldCache=null;   // null: the game's own rule (ConquestTown.TOWN.away for a held unfought raid)
const citFor=(s,pr,d)=>{if(!KNOB.cit7b||!pr?.citadel)return;const t=tiersAt(pr,d);if((s.cit?.t|0)!==t||s.cit?.v!==1)s.cit=CONQUEST.Citadel.norm({...(s.cit||{}),v:1,t});};
// the held unfought raids a town meets a day (Session 7T-P decision 1: perDay at the Command Center level x the 60% chance) and the share
// it holds (an approximation for the income only: the fortress test's hold rates run 62-100% by day; 85% is their mean), paying the cache
const HOLD=.85,heldCacheOf=cc=>{const n=(TN.TOWN.perDay[cc]||0)*TN.TOWN.chance*HOLD,f=KNOB.heldCache,c=f?TN.TOWN.cache:TN.TOWN.away,x=f||{cp:1,mat:1};return {cp:n*c.cp*x.cp,alloy:n*c.alloy*x.mat,biomass:n*c.biomass*x.mat,helium:n*c.helium*x.mat};};
export function minerals(pr,d){const m=pr.sessions.reduce((a,x)=>a+x[1],0),n=pr.sessions.length,inc=Object.fromEntries(MIN.map(k=>[k,0])),add=(o,x=1)=>{for(const [k,v] of Object.entries(o))inc[k]+=v*x;};
 const aAr=ramp(d,3,8),aTq=ramp(d,14,30),aVet=ramp(d,30,45),g=.25*m,sh={fe:.45,il:.30,ar:.17*aAr,tq:.08*aTq},tot=Object.values(sh).reduce((a,b)=>a+b,0);
 for(const k of ['fe','il','ar','tq']){const D=Pm.deposits[k],minutes=g*sh[k]/tot,supply=D.veins*D.cap*(D.regrowH<=24?Math.min(n,24/D.regrowH):24/D.regrowH)/D.yield,h=Math.min(minutes/A['gather_'+k].par,supply);inc[k]+=h*D.yield;if(k==='tq')inc.se+=h*D.seVein;}
 const ops=.45*m,mix=d<1?{field:1}:d<7?{field:.5,raid_hard:.5}:d<30?{field:.2,raid_hard:.6,defense:.2}:{raid_hard:.4*(1-aVet)+.1,raid_veteran:.4*aVet+.1*(1-aVet),defense:.2,field:.3*(1-aVet)},mt=Object.values(mix).reduce((a,b)=>a+b,0);
 for(const [id,f] of Object.entries(mix)){const k=ops*(f/mt)/A[id].par,win=id==='raid_hard'?(d<7?.7:.9):id==='raid_veteran'?.8:1;add(Pm.opMinerals[id],k*win);}
 const strikes=Math.min(1440/Pm.strike.everyMin,n*(m/n+Pm.strike.windowMin)/Pm.strike.everyMin),okp=d<7?.6:d<21?.85:.95,st=strikes*okp;add(Pm.strike.guaranteed,st);inc.se+=st*(Pm.strike.se+1/(KNOB.resonanceSe||Pm.strike.resonance.se));inc.mh+=st*(Pm.strike.mh+1/Pm.strike.resonance.mh);
 if(!pr.noTownSe&&!KNOB.noTownSe)inc.se+=townSe(pr,d);
 return inc;}
// ---- Session 7T-P decision 2: Selenite from the town's defenses held in person (ConquestTown.TOWN.se: n Selenite for a raid at the cap
// level held in person and really fought). A day's Selenite = the attacks that land that day and that the pilot's sessions can meet in
// person (the real town clock, ConquestTown.step on Session 7's war clock, 24 pilot seeds: an attack can be fought from its announcement,
// 12 h ahead, until it lands) x the share of the day's raids at that level (raidSet) x the in-person hold rate at that level (the pilot's
// tank driven by a bot that heads for the nearest raider and fires, beside the fielded Platoon and the garrison; the better of the fight
// and the unfought replay; HELD and really fought; measured on the profile's towns without this Selenite, so the model never feeds on
// itself) x n. Half of it reaches the town (minerals(): the other half goes to plating), as for every mineral.
const AUD=AUDIT,clockMemo=new Map(),shareMemo=new Map(),ipMemo=new Map(),nameOf=pr=>Object.keys(PROFILES).find(k=>PROFILES[k].label===pr.label)||'grinder';
export function inPersonDays(pr,{seeds=24,days=YEAR}={}){const key=JSON.stringify(pr.sessions)+pr.ladder;if(clockMemo.has(key))return clockMemo.get(key);const T=WR.WAR.tickMs,out=new Float64Array(days+1),all=new Float64Array(days+1);
 const claim=start+hitOf(pr).CC1.day*DAY,sess=[];for(let d=0;d<=days+1;d++)for(const [h,m] of pr.sessions)sess.push([start+d*DAY+h*HOUR,start+d*DAY+h*HOUR+m*60000]);
 for(let sd=1;sd<=seeds;sd++){const war=WR.fresh(start),tw=TN.fresh(start);tw.k=WR.tickOf(start);for(let k=WR.tickOf(start)+1,K=WR.tickOf(start+days*DAY);k<=K;k++){const d=(k*T-start)/DAY,info={cc:ccAt(pr,d),townAt:claim,shieldUntil:0,war,tiers:0,seed:String(sd*7919+13)+':town'};
  for(const x of TN.step(tw,k,info,()=>'held'))if(x.kind==='land'){const a=x.ev.a*T,l=x.ev.l*T,dd=Math.floor((l-start)/DAY);if(dd>days)continue;all[dd]+=1/seeds;if(sess.some(([s0,s1])=>s0<l&&s1>a))out[dd]+=1/seeds;}}}
 const r={inPerson:out,all};clockMemo.set(key,r);return r;}
function capShare(pr,d){const k=pr.label+':'+d;if(!shareMemo.has(k)){const rs=raidSet(pr,d,400,{seed:77});shareMemo.set(k,rs.filter(r=>TN.seOf(r.level)>0).length/rs.length);}return shareMemo.get(k);}
// the in-person hold rate at the cap level, by day (samples, linear between them)
const IP_DAYS=[135,180,270,330,400];
export function inPersonRate(prName,d,{n=3}={}){const key=prName+':'+d+':'+n;if(ipMemo.has(key))return ipMemo.get(key);const pr=PROFILES[prName];let ok=0,all=0;
 for(const site of P.SITE_IDS){const t=townAt(prName,site,d,{se:false}),lanes=P.spawnCells(site,10).length;for(let i=0;i<n;i++){const x=fight(t,{level:TN.TOWN.se.from,lane:i%lanes},3000+i*17,d,pr);all++;if(x.se)ok++;}}
 const r=ok/all;ipMemo.set(key,r);return r;}
function townSe(pr,d){const n=KNOB.townSeN??TN.seOf(TN.TOWN.cap);if(!n)return 0;const sh=capShare(pr,Math.floor(d));if(!sh)return 0;const ip=inPersonDays(pr).inPerson[Math.min(YEAR,Math.floor(d))]||0;if(!ip)return 0;
 const nm=nameOf(pr),xs=IP_DAYS,i=xs.findIndex(x=>x>=d);let rate;if(i<=0)rate=inPersonRate(nm,xs[Math.max(0,i)]);else{const a=xs[i-1],b=xs[i],ra=inPersonRate(nm,a),rb=inPersonRate(nm,b);rate=ra+(rb-ra)*(d-a)/(b-a);}
 return ip*sh*rate*n;}
// A defense in person (decision 6 of 7T): the pilot's tank (a bot: drive at the nearest raider, aim and fire), the fielded Platoon (up to 4
// pilots, the garrison's kit) and the garrison beside the turrets, at the world's 50 ms step; the result is the better of the fight and the
// unfought replay; se: HELD and the pilot really fought (5 raiders or 4% of the damage dealt: the Worker's rule)
const padOf=p=>{const cc=p.b.cc,sz=P.sizeOf('cc',cc.r|0);return {x:Math.round((P.cellX(cc.i)+(sz.w-1)*P.GRID.cell/2)*10)/10,z:Math.round((P.cellZ(cc.j)+(sz.d-1)*P.GRID.cell/2+sz.d*P.GRID.cell/2+10)*10)/10,h:Math.PI};};
const PILOT_L=[GEAR.common,GEAR.rare,GEAR.epic];   // the pilot's own tank by the profile's gear tier (the economy model's kits)
export function fight(town,r,seed,d,pr){const tier=Math.round(interp(pr.gear,d)),kit={w:{a:tier>=2?'siege':'pulse',t:Math.min(2,tier),q:tier>=2?1.08:1},c:{c:'titan',t:Math.min(2,tier),q:tier>=2?1.08:1}};
 const lv=P.levelOf(town.plot,'hangar'),fielded=Math.min(4,BT.fieldCap(lv),Math.max(0,rosterAt(d)-town.garrison.length));
 const plat=Array.from({length:fielded},(_,i)=>RD.unitOf({id:'f'+i,kind:'f',kit,rk:Math.min(10,1+Math.floor(d/12))})),me=RD.unitOf({id:'you',kind:'p',L:PILOT_L[Math.min(2,tier)]});
 const uf=RD.make(town.plot,seed,{threat:r.level,lane:r.lane,units:town.garrison,damage:true,frames:false,events:false}).run();
 const M=RD.make(town.plot,seed,{threat:r.level,lane:r.lane,units:[...town.garrison,...plat,me],dt:.05,pilot:padOf(town.plot),damage:true,frames:false,events:false});
 for(let g=0;!M.over&&g<40000;g++){const p=M.pilot;let f=null,fd=Infinity;for(const q of M.foes)if(!q.dead){const dd=Math.hypot(q.x-p.x,q.z-p.z);if(dd<fd){fd=dd;f=q;}}let c={x:0,z:0,fire:false};
  if(f&&!p.down){const dx=f.x-p.x,dz=f.z-p.z,dd=Math.hypot(dx,dz)||1,near=dd<22;c={x:near?0:dx/dd,z:near?0:dz/dd,aimYaw:Math.atan2(dx,dz),fire:true,lockId:f.id};}M.step(c);}
 const Rr=M.result(),u=(Rr.units||[]).find(x=>x.k==='p'),all=Object.values(Rr.byTurret||{}).reduce((a,t)=>a+t.dmg,0)+(Rr.units||[]).reduce((a,x)=>a+x.dmg,0),fought=!!u&&(u.kills>=5||u.dmg>=.04*all);
 const rank=o=>({fallen:0,breached:1,held:2})[o],a=RD.outcomeOf(uf),b=RD.outcomeOf(Rr),best=rank(b)>=rank(a)?b:a;return {uf:a,live:b,best,fought,se:best==='held'&&fought};}
// ---- 2. the town a pilot builds ----
// One site plan per site (a decent player's: vitals and support by the Command Center, 42 turret slots on two rings typed so every
// Command Center level's slots are unlocked types, wall rings from radius 18 outward). Every profile builds the same plan, so a pilot
// who invests more always has the stronger town (more of the plan, at higher levels and better blends); the fully built town is the
// plan at its maximum.
const SLOT_TYPES=['cannon','mg','cannon','laser','mg','rocket','cannon','missile','laser','rocket','mortar','flame','missile','siege','mg','cannon','laser','tesla','rocket','missile','mortar','siege',
 'lasercannon','flame','tesla','cannon','missile','railgun','lasercannon','siege','mortar','tesla','laser','mg','railgun','lasercannon','missile','rocket','flame','siege','tesla','railgun'];
const SUPPORT=Object.freeze([['storage',1],['reactor',5],['foundry',1],['hangar',1],['shield',3],['refinery',2],['biodome',2],['helium',1],['lab',1]]);
const PLANS={};
export function plan(site){if(PLANS[site])return PLANS[site];const p=P.newPlot(site,start);p.cc=10;p.b.cc.l=10;const sup=[],slots=[];
 for(const b of Object.values(p.b))if(b.t==='storage')sup.push({id:'storage',t:'storage',i:b.i,j:b.j,r:b.r|0});   // the town's own Storage Depot (st.lv.storage)
 for(const [t,n] of SUPPORT){if(t==='storage')continue;for(let k=0;k<n;k++){const at=P.autoPlace(p,t);if(!at)continue;const id='s'+sup.length;p.b[id]={t,...at,l:1};sup.push({id,t,...at});}}
 for(let k=0,n=0;n<42&&k<1600;k++){const t=SLOT_TYPES[n],R=k%2?16:12,a=k*2.399,i=Math.round(P.MID+Math.cos(a)*R),j=Math.round(P.MID+Math.sin(a)*R);if(!P.placeError(p,t,i,j,0)){const id='t'+n;p.b[id]={t,i,j,r:0,l:1};slots.push({id,t,i,j});n++;}}
 return PLANS[site]={sup,slots,base:P.newPlot(site,start).b,walls:wallOrder(site,p)};}
// The walls, in the order a decent player builds them: first SEAL every frozen-lake gap (a lake the raiders can cross reaches through
// the wall rings, and walls cannot stand on ice: every buildable cell inside the rings within 4 cells of such a lake's ice becomes a
// shore wall, nearest the ice first), then the square rings from radius 18 outward. Segments: [[i,j], ...]; only ICE BASIN has a shore.
// (Measured on ICE BASIN's fully built town at the top strength: without the shore the raiders walk the lake past most of the rings
// and 4 of 32 raids breach; 3 cells deep, 0 of 32 at level 9 but fragile; 4 deep, 0 of 32 with no building lost.)
const SHORE=4;
function wallOrder(site,p){const occ=P.occupancy(p),N=P.GRID.n,ok=(i,j)=>P.inGrid(i,j)&&P.inTown(10,i,j)&&!P.NOBUILD[P.terrainAt(site,i,j)]&&!occ.has(P.key(i,j)),gap=[];
 for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(P.terrainAt(site,i,j)==='ice'&&P.cheb(i,j)>=17&&P.inTown(10,i,j))gap.push([i,j]);
 const shore=[];if(gap.length)for(let i=0;i<N;i++)for(let j=0;j<N;j++){if(P.cheb(i,j)>18||!ok(i,j))continue;let d=Infinity;for(const [a,b] of gap)d=Math.min(d,Math.max(Math.abs(a-i),Math.abs(b-j)));if(d<=SHORE)shore.push([i,j,d]);}
 shore.sort((x,y)=>x[2]-y[2]||P.cheb(y[0],y[1])-P.cheb(x[0],x[1])||x[0]-y[0]||x[1]-y[1]);const used=new Set(shore.map(([i,j])=>P.key(i,j))),segs=[shore.map(([i,j])=>[i,j])];
 for(let R=18;R<=P.townH(10)-1;R++){const seg=[];for(let i=P.MID-R;i<=P.MID+R;i++)for(const j of (i===P.MID-R||i===P.MID+R)?Array.from({length:2*R+1},(_,k)=>P.MID-R+k):[P.MID-R,P.MID+R])if(ok(i,j)&&!used.has(P.key(i,j)))seg.push([i,j]);segs.push(seg);}
 return segs.filter(x=>x.length);}
const segMax=seg=>seg.reduce((a,[i,j])=>Math.max(a,P.cheb(i,j)),0);
// a slot's turret at its level, if its type is unlocked at this Command Center level
const BLENDS=(()=>{const out=[[0,0]];for(let o=1;o<=6;o++)for(let l=1;l<=3;l++)out.push([o,l]);return out.sort((a,b)=>P.blendQ(a[0],a[1])-P.blendQ(b[0],b[1]));})();
const oreFor=(o,l,n)=>o?{[P.ORES[o-1]]:P.ORE_UNITS[o]*P.BLEND_UNITS[l]*n/40}:{};
// the plot of a build state: {cc, lv: {id: level}, rings: [{s the wall segment (plan(site).walls), n cells built, code}]}
export function plotOf(site,st){const pl=plan(site),p=P.newPlot(site,start);p.cc=st.cc;p.b.cc.l=st.cc;for(const [id,b] of Object.entries(p.b))if(b.t==='storage')b.l=Math.max(1,st.lv.storage|0);
 for(const x of pl.sup){if(x.t==='storage')continue;const l=st.lv[x.id]|0;if(l>0&&st.cc>=P.BUILDINGS[x.t].cc)p.b[x.id]={t:x.t,i:x.i,j:x.j,r:x.r|0,l};}
 for(const x of pl.slots){const l=st.lv[x.id]|0;if(l>0)p.b[x.id]={t:x.t,i:x.i,j:x.j,r:0,l};}
 for(const g of st.rings){const seg=pl.walls[g.s].slice(0,g.n);if(!seg.length)continue;const {o,l}=P.wdecode(g.code),pl2=P.wallPlan({...p,devx:1},[{k:'cells',c:seg.flat(),o,l}],{dev:true});for(const x of pl2.cells)p.w[x.i+','+x.j]=x.code;}
 p.ext={r:5,d:31,w:12};return p;}
// The pilot's town on a site at day `days`: the plan, built day by day with the town's share of the income, the builder in the pilot's
// sessions, the Foundry's composite and half of the mineral income.
const BUILT={};
export function townAt(prName,site,days,{share,se=true}={}){const key=prName+':'+site+':'+days+':'+share+':'+(se?1:0)+':'+(KNOB.cit7b?1:0)+':'+JSON.stringify(KNOB.heldCache||0);if(BUILT[key])return BUILT[key];const pr={...PROFILES[prName]};if(share!==undefined)pr.share=share;if(!se)pr.noTownSe=true;const rows=income(pr,YEAR),pl=plan(site);
 const st={cc:1,lv:{storage:1},rings:[]},bag={cp:0,alloy:0,biomass:0,helium:0,fe:0,il:0,ar:0,tq:0,se:0,mh:0};let cm=P.COMPOSITE.start,jobs=[];
 const can=c=>Object.entries(c||{}).every(([k,v])=>(bag[k]||0)>=v-1e-9),pay=c=>{for(const [k,v] of Object.entries(c||{}))bag[k]-=v;};
 const capOf=t=>P.levelCap(t,st.cc),countOK=(x)=>{const B=P.BUILDINGS[x.t];if(st.cc<B.cc)return false;if(B.turret)return pl.slots.indexOf(x)<P.TURRET_CAP[st.cc-1];const same=pl.sup.filter(y=>y.t===x.t),i=same.indexOf(x);return i<P.countCap(x.t,st.cc);};
 const S0=P.SITES[site],power=()=>{let use=0,sup=12+3*st.cc;for(const x of [...pl.sup,...pl.slots]){const l=st.lv[x.id]|0;if(!l)continue;use+=P.BUILDINGS[x.t].pw*l;if(x.t==='reactor')sup+=P.BUILDINGS.reactor.power*l*S0.power;}return {use,sup:Math.round(sup)};};   // the plot's own power rules, without building the plot
 for(let d=0;d<days;d++){const r=rows[d]||rows.at(-1);for(const k of K)bag[k]+=Math.max(0,r[k])*pr.share;if(st.cc>=2){const hc=heldCacheOf(st.cc);for(const k of K)bag[k]+=(hc[k]||0)*pr.share;}const mn=minerals(pr,d);for(const k of MIN)bag[k]+=mn[k]*.5;if(pr.buyFeIl){bag.fe+=200;bag.il+=60;}
  const want=ccAt(pr,d+1);while(st.cc<want){st.cc++;const c=P.CC.cost[st.cc];if(c)for(const k of K)bag[k]=Math.max(0,bag[k]-(c[k]||0));}
  const fl=st.lv.s2|0||0,foundry=pl.sup.find(x=>x.t==='foundry'),fL=foundry?st.lv[foundry.id]|0:0;if(fL){const make=Math.min(P.COMPOSITE.rate*fL*24,bag.alloy*P.COMPOSITE.perAlloy*.5);cm+=make;bag.alloy-=make/P.COMPOSITE.perAlloy;}
  // the builder: in each session, the next affordable job whenever a builder is free (jobs keep running on the Worker clock)
  for(const [h,mins] of pr.sessions){const t0=d*24+h,t1=t0+mins/60;let now=t0;
   for(let guard=0;guard<300;guard++){jobs=jobs.filter(j=>{if(j.end<=now){st.lv[j.id]=Math.max(st.lv[j.id]|0,j.l);return false;}return true;});if(jobs.length>=pr.builders){now=Math.min(...jobs.map(j=>j.end));if(now>t1)break;continue;}
    const job=next();if(!job)break;pay(job.c);jobs.push({id:job.id,l:job.l,end:now+P.timeOf(job.t,job.l)/HOUR});}}
  // walls: rings outside the turrets (instant orders), composite permitting, up to the cap with the extensions earned (or bought)
  const ext=Math.min(50,(st.cc>=9?20:st.cc>=7?16:st.cc>=5?12:st.cc>=3?8:4)+(d>=10?5:0)+(d>=30?5:0)+(fL>=5&&d>=40?30:fL*6)+(pr.extPacks?50:0)),cap=P.wallBase(st.cc)+Math.floor(P.wallBase(st.cc)*ext/100);
  let cells=st.rings.reduce((a,g)=>a+g.n,0);for(let guard=0;guard<40&&cells<cap&&cm>=1;guard++){let g=st.rings.find(x=>x.n<pl.walls[x.s].length);if(!g){const s0=st.rings.length;if(s0>=pl.walls.length||segMax(pl.walls[s0])>P.townH(st.cc)-1)break;g={s:s0,n:0,code:1};st.rings.push(g);}const k=Math.min(pl.walls[g.s].length-g.n,Math.floor(cm),cap-cells);if(k<=0)break;g.n+=k;cm-=k;cells+=k;}
  // blends: the weakest ring first, to the best blend its ore and the Command Center allow
  for(let guard=0;guard<60;guard++){const g=st.rings.filter(x=>x.n).sort((a,b)=>P.blendQ(P.wdecode(a.code).o,P.wdecode(a.code).l)-P.blendQ(P.wdecode(b.code).o,P.wdecode(b.code).l))[0];if(!g)break;const cur=P.wdecode(g.code),q0=P.blendQ(cur.o,cur.l);
   const up=BLENDS.filter(([o,l])=>P.blendQ(o,l)>q0&&st.cc>=P.ORE_CC[o]&&can(oreFor(o,l,g.n))).sort((a,b)=>P.blendQ(b[0],b[1])-P.blendQ(a[0],a[1]))[0];if(!up)break;pay(oreFor(up[0],up[1],g.n));g.code=P.wcode(up[0],up[1]);}}
 // the next job: support first (storage, power before it is short, the Foundry, the Hangar, shields), then a new turret slot, then the
 // lowest turret's next level; never past the power the town has
 function next(){const busy=new Set(jobs.map(j=>j.id)),{use,sup}=power(),c=[];
  for(const x of pl.sup){if(busy.has(x.id)||!countOK(x))continue;const l=(st.lv[x.id]|0)+1;if(l>capOf(x.t))continue;const pw=P.BUILDINGS[x.t].pw;if(x.t==='reactor'?use<=sup*.85&&(st.lv[x.id]|0)>0:use+pw>sup)continue;
   const prio=x.t==='reactor'?0:x.t==='storage'?1:x.t==='foundry'||x.t==='hangar'?2:x.t==='shield'?3:6;c.push({id:x.id,t:x.t,l,c:P.costOf(x.t,l),prio});}
  for(const x of pl.slots){if(busy.has(x.id)||!countOK(x))continue;const l=(st.lv[x.id]|0)+1;if(l>capOf(x.t))continue;if(use+P.BUILDINGS[x.t].pw>sup)continue;c.push({id:x.id,t:x.t,l,c:P.costOf(x.t,l),prio:l===1?4:5});}
  const ok=c.filter(x=>can(x.c)).sort((a,b)=>a.prio-b.prio||(st.lv[a.id]|0)-(st.lv[b.id]|0)||a.c.cp-b.c.cp);return ok[0]||null;}
 for(const j of jobs)st.lv[j.id]=st.lv[j.id]|0;   // a job still running does not fight at its new level
 const tier=Math.round(interp(pr.gear,days)),plot=plotOf(site,st);return BUILT[key]={plot,st,bag,garrison:garrisonAt(pr,plot,days,tier)};}
// the garrison: the roster by this day (a pilot a day from the rescue and the Hangar's RECRUIT job, at most 16), fielded by the
// Hangar (the rest are reserves), one slot a Hangar level, the spare gear tier the profile's pilot owns by then
function rosterAt(d){return Math.min(16,1+Math.max(0,Math.floor(d-1))+Math.max(0,Math.floor(d-3)));}
export function garrisonAt(pr,p,d,tier){const lv=P.levelOf(p,'hangar'),slots=Math.min(5,P.garrisonSlots(p)),fielded=BT.fieldCap(lv),n=Math.min(slots,Math.max(0,rosterAt(d)-fielded));
 const kit={w:{a:tier>=2?'siege':'pulse',t:Math.min(2,tier),q:tier>=2?1.08:1},c:{c:'titan',t:Math.min(2,tier),q:tier>=2?1.08:1}};
 return Array.from({length:n},(_,i)=>RD.unitOf({id:'g'+i,kind:'g',kit,rk:Math.min(10,1+Math.floor(d/12))}));}
// the fully built town (decision 4a): the plan at its maximum: Command Center 10, every support building and all 42 turrets at the highest
// levels the power budget allows (the dearest turrets a level lower until the draw fits), 3,000 cells (the +50% cap: the shore first) of Moonheart heavy,
// five garrison pilots in top gear (Epic, the best roll; one with Moonbeam)
export function fullTown(site){const pl=plan(site),st={cc:10,lv:{storage:5},rings:[]};for(const x of pl.sup)st.lv[x.id]=P.levelCap(x.t,10);for(const x of pl.slots)st.lv[x.id]=5;
 let p=plotOf(site,st);for(let guard=0;guard<300&&P.powerUse(p)>P.powerSupply(p);guard++){const x=pl.slots.filter(y=>st.lv[y.id]>1).sort((a,b)=>P.BUILDINGS[b.t].pw-P.BUILDINGS[a.t].pw||st.lv[b.id]-st.lv[a.id]||pl.slots.indexOf(b)-pl.slots.indexOf(a))[0];if(!x)break;st.lv[x.id]--;p=plotOf(site,st);}
 let left=3000;for(let s=0;left>0&&s<pl.walls.length;s++){const n=Math.min(pl.walls[s].length,left);st.rings.push({s,n,code:P.wcode(6,3)});left-=n;}p=plotOf(site,st);
 const kit={w:{a:'siege',t:2,q:1.1},c:{c:'titan',t:2,q:1.1}},gar=[0,1,2,3,4].map(i=>RD.unitOf({id:'g'+i,kind:'g',kit:i===0?{w:{a:'moon',t:2,q:1},c:kit.c}:kit,rk:10}));
 return {plot:p,st,garrison:gar};}
// ---- 3. raids ----
// THREAT for a raid at day d: the Citadel tiers on the profile's pacing (x citadelX), a general by those tiers, the portal open 3 raids
// in 4, the Grand Offensive's surge 1 raid in 8 (the weekend's town target among ~8 raids a week)
export function raidSet(pr,d,n,{citadelX=1,seed=1}={}){const out=[],tiers=Math.max(0,Math.min(9,Math.floor(interp(pr.citadel,d)*citadelX)));
 for(let i=0;i<n;i++){const r=WR.unit('fm:'+seed+':'+d+':'+i),[lo,hi]=TN.STARS[tiers],stars=lo+Math.floor(WR.unit('fs:'+seed+':'+d+':'+i)*(hi-lo+1)),portal=r<.75?1:0,go=WR.unit('fg:'+seed+':'+d+':'+i)<1/8?1:0,th=stars+portal+tiers+go;
  out.push({th,level:TN.levelOf(th),tiers,stars,portal,go,lane:i});}return out;}
export function raid(town,r,site,seed){const R2=RD.make(town.plot,seed,{threat:r.level,lane:r.lane,units:town.garrison,damage:true,frames:false,events:false}).run();return {o:RD.outcomeOf(R2),core:R2.core,lost:Object.values(R2.damage||{}).reduce((a,v)=>a+v,0),k:R2.kills,sp:R2.spawned};}
export function holdRate(prName,d,{sites=P.SITE_IDS,n=4,share,citadelX=1,se=true}={}){let held=0,all=0;const per=[];for(const site of sites){const t=townAt(prName,site,d,{share,se});const rs=raidSet(PROFILES[prName],d,n,{citadelX,seed:site.length});
  for(const [i,r] of rs.entries()){const x=raid(t,r,site,1000+i);all++;if(x.o==='held')held++;per.push({site,level:r.level,o:x.o});}}
 return {p:held/all,held,all,per};}
// ---- 5. Session 7T-P decision 3: REPAIR on the way to CC10 with town attacks on (the Nov 10 brief's 5% guard method, Checkpoint 47) ----
// The audit's town ladder (dev/tests/conquest-ladder-check.mjs's builder on the real reducers: a completed sortie every 90 s in a
// 60-minute session at 19:00 UTC, every CP to the town until 2,550 CP are spent and half after, the Command Center first, then the
// cheapest building or upgrade, at most 6 turrets, War Orders claimed, 6 kills a sortie, a Defense Drill a session) with the town clock
// running (the pilot seen at every request; never defending in person, so every raid is decided unfought) and REPAIR paid whenever the
// town is damaged, before any other build. raids:false keeps the pilot seen (Session 7's war runs as in every variant) and holds town
// attacks off with a standing shield: the same pilot without town attacks.
//  coach:false is the 7T undefended builder (no walls); coach:true follows the town coach's step 4 (decision 3): until CC4, whenever
//  ConquestTown.ringOf finds the town open, it taps SUGGEST A RING (ConquestTown.ringPlan: the inner ring that closes the town and, when
//  the composite allows, an outer one) and confirms it; when no wall can reach an exposed vital (beside ice or rock) it moves the vital in.
//  coach:'single' draws only the first ring (a pilot who closes it by hand). Walls are instant orders: composite only, no builder time.
//  repairX: a model-only price factor on the REPAIR of town-raid damage (the PROPOSAL's exact price; the game's REPAIR is unchanged).
export function ladderRun(seed,{raids=true,coach=false,repairX=1,cacheX=null,site='crater',days=200,cit=KNOB.cit7b}={}){   /* cacheX null: the game's own held-raid pay */const s=createState(R.STOCK_L,start);s.lseed=seed;s.twsd=(seed>>>0)||1;delete s.wo;const hit={};   // twsd: the town's own seed, fixed (review round 1: the Worker would draw it at random)
 const legacy=['oxygen-line','relay','recon','convoy','rescue','redoubt'];let serial=0,played=0,spent=0;const rep={n:0,cp:0,alloy:0,cm:0},ring={closedAt:null,cells:0,orders:0};
 const afford=c=>Object.entries(c||{}).every(([k,n])=>k==='cp'?s.ledger.cp>=n:k==='cm'?Math.floor(s.plot?.cm||0)>=n:P.MNS.includes(k)?true:(s.ledger.banked[k]||0)>=n);
 const mark=(k,now)=>{if(hit[k]===undefined)hit[k]=+((now-start)/DAY).toFixed(1);};
 const atGate=()=>{s.position=at(C.baseDefinition.x,C.baseDefinition.z);s.battle.enemies=[];};
 const build=now=>{scan();const cp0=s.ledger.cp;try{build0(now);}finally{spent+=Math.max(0,cp0-s.ledger.cp);}};
 const closeRing=now=>{const p=s.plot,RO={all:coach==='all',single:coach==='single'},R0=TN.ringOf(p,RO);if(R0.closed){if(ring.closedAt===null)ring.closedAt=+((now-start)/DAY).toFixed(2);return false;}const c=p.b.cc,sz=P.sizeOf('cc',c.r|0),ci=Math.round(c.i+(sz.w-1)/2),cj=Math.round(c.j+(sz.d-1)/2);
  // a vital outside the walls ("RING IN YOUR ..."): only when no wall can reach it (beside ice or rock) the pilot moves it inside (free),
  // the nearest spot to the Command Center that closes the town; walls first (a cramped core leaves the rest of the town outside: measured
  // worse, 49,000-102,000 CP of REPAIR on 21-pilot panels against a few hundred)
  const moveIn=()=>{if(R0.open==='cc'||!R0.id||!p.b[R0.id]||p.job?.id===R0.id)return false;const b=p.b[R0.id];for(let rad=1;rad<16;rad++)for(let a=-rad;a<=rad;a++)for(const [i,j] of [[ci+a,cj-rad],[ci+a,cj+rad],[ci-rad,cj+a],[ci+rad,cj+a]]){if(P.placeError(p,b.t,i,j,0,R0.id))continue;const q={...p,b:{...p.b,[R0.id]:{...b,i,j,r:0}}};if(!TN.ringOf(q,RO).closed)continue;
    try{plotAction(s,{action:'plot-move',plot:{id:R0.id,i,j,r:0}},now);ring.moves=(ring.moves|0)+1;return true;}catch(e){}}return false;};
  // the coach's SUGGEST A RING (ConquestTown.ringPlan, the same function as the phone's button), confirmed: the one wall order that closes the
  // town around as many buildings as it can; a failed search waits until the town changes
  const sig=p.cc+':'+Object.keys(p.b).length+':'+Object.keys(p.w).length+':'+Math.floor((p.cm||0)/25);if(ring.miss===sig)return false;
  const plan=TN.ringPlan(p,RO);if(plan){try{plotAction(s,{action:'plot-wall',plot:{s:plan.secs}},now);ring.cells+=plan.fresh;ring.orders++;if(TN.ringOf(s.plot,RO).closed&&ring.closedAt===null)ring.closedAt=+((now-start)/DAY).toFixed(2);return true;}catch(e){}}
  if(moveIn())return true;ring.miss=sig;return false;};
 const build0=now=>{campaign(s,now);if(!s.base.tier){if(afford(C.baseDefinition.recipe)){atGate();baseAction(s,{action:'build-base',plot:{site}},now);mark('CC1',now);}return;}
  const p=s.plot;for(const k of [2,3,4,5,6,7,8,9,10])if(p.cc>=k)mark('CC'+k,now);
  if(coach&&p.cc<4){atGate();closeRing(now);}
  if(p.job)return;atGate();
  const plan=P.repairPlan(p);if(plan.keys.length){const c=Object.fromEntries(Object.entries(plan.cost).map(([k,v])=>[k,Math.ceil(v*repairX)]));
   if(afford(c)){if(repairX===1)plotAction(s,{action:'plot-repair',plot:{}},now);else{for(const [k,v] of Object.entries(c)){if(k==='cp')s.ledger.cp-=v;else if(k==='cm')p.cm-=v;else s.ledger.banked[k]-=v;}p.job={id:'repair',t:'repair',l:0,fix:plan.fix,at:now,ready:now+plan.ms};}
    rep.n++;rep.cp+=c.cp||0;rep.alloy+=c.alloy||0;rep.cm+=c.cm||0;return;}}
  if(p.cc<P.CC.max&&afford(P.costOf('cc',p.cc+1))){try{plotAction(s,{action:'plot-upgrade',plot:{id:'cc'}},now,{bmn:{il:99,ar:99}});return;}catch(e){}}
  const opts=[];for(const [t,B] of Object.entries(P.BUILDINGS)){if(B.gate)continue;const cur=Object.entries(p.b).filter(([,b])=>b.t===t);
   for(const [id,b] of cur)if(!P.buildCheck(p,t,b.l+1,id))opts.push({cp:P.costOf(t,b.l+1).cp,a:()=>plotAction(s,{action:'plot-upgrade',plot:{id}},now)});
   if(!P.buildCheck(p,t,1)&&!(B.turret&&P.turretCount(p)>=6)){const pos=P.autoPlace(p,t);if(pos)opts.push({cp:P.costOf(t,1).cp,a:()=>plotAction(s,{action:'plot-build',plot:{type:t,...pos}},now)});}}
  opts.sort((x,y)=>x.cp-y.cp);for(const o of opts){try{if(o.cp<=s.ledger.cp){o.a();return;}}catch(e){}}};
 const split=cp0=>{const half=spent>=2550?Math.floor((s.ledger.cp-cp0)/2):0;s.ledger.cp-=half;};
 // every raid once, by its id (the town log keeps only the last 16): the tally, and cacheX, a model-only factor on the held unfought raid's
 // defense cache (a PROPOSAL's number)
 const ids=new Set(),tally={held:0,breached:0,fallen:0},scan=()=>{for(const x of s.tw?.log||[]){if(ids.has(x.id))continue;ids.add(x.id);if(x.o in tally)tally[x.o]++;
  const fx=cacheX===null||cacheX===undefined?null:typeof cacheX==='number'?{cp:cacheX,mat:cacheX}:{cp:cacheX?.cp??1,mat:cacheX?.mat??1};
  if(fx&&x.o==='held'&&!x.f){const c=TN.TOWN.cache,paid=TN.cacheOf(x)||{cp:0,alloy:0,biomass:0,helium:0};s.ledger.cp+=Math.round(c.cp*fx.cp)-paid.cp;for(const k of ['alloy','biomass','helium'])s.ledger.banked[k]=Math.max(0,(s.ledger.banked[k]||0)+Math.round(c[k]*fx.mat)-paid[k]);}}};   /* the option's share of 7T's whole cache in place of what the game paid (TOWN.away) */
 const seen=now=>{s.lastWall=now;if(!raids&&s.plot)s.plot.shieldUntil=start+4000*DAY;scan();};
 for(let day=0;day<days;day++){let now=start+day*DAY+19*HOUR;if(cit)citFor(s,PROFILES.regular,day);
  if(s.base.tier){atGate();try{baseAction(s,{action:'base-claim'},now);}catch(e){}try{plotAction(s,{action:'plot-collect',plot:{}},now);}catch(e){}}build(now);seen(now);
  if(s.base.tier)orderEvent(s,'drill',1);
  for(let m=0;m<60;m+=1.5){now+=90000;played+=1.5;const id=played<=75?legacy[serial%legacy.length]:C.raidIds[serial%C.raidIds.length];serial++;
   s.mission=id;s.attempt=serial;s.featuredMission=false;const cp0=s.ledger.cp;refreshState(s,now);missionReward(s,now);orderEvent(s,'kill',6);s.mission=null;split(cp0);
   s.position=at(1174,1168);bank(s,now);
   for(const o of (s.wo?.list||[]).filter(o=>o.done&&!o.claimed)){const c0=s.ledger.cp;try{claimOrder(s,{seq:0,action:'claim-order',order:o.id},now);}catch(e){}split(c0);}
   build(now);seen(now);}
  build(start+(day+1)*DAY-1000);if(hit.CC10&&day>hit.CC10+2)break;}
 scan();return {hit,cc10:hit.CC10??null,repair:rep,raids:tally,lost:tally.breached+tally.fallen,ring};}
// --calibrate: hold rates by raid level for each profile through the year and for the fully built town (every site, n raids a site
// and level); the THREAT -> level table (js/conquest/townwar.js TOWN.level) is fitted to these (docs/conquest/session7t/fortress-calibration.txt)
export function levelRates(town,site,levels,n=4){const out={};for(const L of levels){let held=0;for(let i=0;i<n;i++){const lanes=P.spawnCells(site,10).length,R=RD.make(town.plot,2000+i*13,{threat:L,lane:i%lanes,units:town.garrison,damage:true,frames:false,events:false}).run();if(RD.outcomeOf(R)==='held')held++;}out[L]=held/n;}return out;}
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].split('/').pop())&&process.argv.includes('--calibrate')){const n=Number(process.argv[process.argv.indexOf('--calibrate')+1])||4,levels=[4,5,6,7,8,9,10],rows=[];
 const one=(name,mk)=>{const t0=Date.now(),acc={};let st=null;for(const site of P.SITE_IDS){const t=mk(site);st=st||t.st;const r=levelRates(t,site,levels,n);for(const L of levels)acc[L]=(acc[L]||0)+r[L]/P.SITE_IDS.length;}
  const line=name+' cc'+st.cc+' '+JSON.stringify(Object.fromEntries(levels.map(L=>[L,Math.round(acc[L]*100)])))+' ms '+(Date.now()-t0);rows.push(line);console.log(line);};
 for(const [pr,days] of [['regular',[30,60,120,180,330]],['grinder',[60,180,330]],['payer',[180,330]]])for(const d of days)one(pr+'@'+d,site=>townAt(pr,site,d));one('full',site=>fullTown(site));
 const o=process.argv.indexOf('--out');if(o>0)writeFileSync(process.argv[o+1],rows.join('\n')+'\n');}
else if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].split('/').pop())){const quick=process.argv.includes('--quick'),out={};
 for(const pr of ['regular','grinder','payer'])for(const d of [60,180,330]){const h=holdRate(pr,d,{n:quick?2:4});out[pr+'@'+d]={p:Math.round(h.p*100)/100,n:h.all,levels:[...new Set(h.per.map(x=>x.level))].sort((a,b)=>a-b)};console.log(pr,d,JSON.stringify(out[pr+'@'+d]));}
 const o=process.argv.indexOf('--json');if(o>0){mkdirSync('docs/conquest/session7t',{recursive:true});writeFileSync(process.argv[o+1],JSON.stringify(out,null,1)+'\n');}}
