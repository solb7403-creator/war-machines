// Conquest fun, retention + economy audit (Nov 10 2026). Read-only measurement with the LIVE rules and the real Worker
// reward/plot functions, for the three pilots the audit brief names: casual (2 x 15 min a day), regular (60 min a day) and
// grinder (4 h a day in two sessions). Nothing here is a human playtest; it is the same kind of model the economy spec uses.
import {buildSim} from '../../../../worker/build-sim.mjs';buildSim();
const {CONQUEST,RULES:R}=await import('../../../../worker/src/sim.gen.js');const {Combat:C,World:W,Plot:P}=CONQUEST;
const {createState}=await import('../../../../worker/src/conquest-sim.js');
const {missionReward,bank}=await import('../../../../worker/src/conquest-economy.js');
const {campaign,baseAction}=await import('../../../../worker/src/conquest-campaign.js');
const {plotAction}=await import('../../../../worker/src/conquest-plot.js');
const {MODEL}=await import('../../../../dev/tools/economy-model.mjs');
const DAY=86400000,start=Date.UTC(2026,10,10,0),at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
const PROFILES={casual:{label:'Casual (2 x 15 min a day)',sessions:[[8,15],[20,15]],cq:30,n:2},regular:{label:'Regular (60 min a day)',sessions:[[19,60]],cq:60,n:1},grinder:{label:'Grinder (4 h a day, two sessions)',sessions:[[10,120],[19,120]],cq:240,n:2}};
// ---------------------------------------------------------------- 1. base progression (CC levels) ------------------------
// Same method as dev/tests/conquest-base-progression.mjs: a completed sortie every 90 s (field missions for the first 75 min
// of play, then the authored raids in rotation), all CP to the first base, then half of all CP to engineering/other sinks.
function runBase(pr){const s=createState(R.STOCK_L,start),hit={},legacy=['oxygen-line','relay','recon','convoy','rescue','redoubt'];let serial=0,played=0,other=0,ptsRaw=0;
 const afford=c=>Object.entries(c||{}).every(([k,n])=>k==='cp'?s.ledger.cp>=n:P.MNS.includes(k)?true:s.ledger.banked[k]>=n);
 const mark=(k,now)=>{if(hit[k]===undefined)hit[k]={day:+((now-start)/DAY).toFixed(1),playMin:Math.round(played)};};
 const atGate=()=>{s.position=at(C.baseDefinition.x,C.baseDefinition.z);s.battle.enemies=[];};
 const build=now=>{campaign(s,now);if(!s.base.tier){if(afford(C.baseDefinition.recipe)){atGate();baseAction(s,{action:'build-base',plot:{site:'crater'}},now);mark('CC1',now);}return;}
  const p=s.plot;for(const k of [2,3,4,5,6,7,8,9,10])if(p.cc>=k)mark('CC'+k,now);if(p.job)return;atGate();
  if(p.cc<P.CC.max&&afford(P.costOf('cc',p.cc+1))){try{plotAction(s,{action:'plot-upgrade',plot:{id:'cc'}},now,{bmn:{il:99,ar:99}});return;}catch(e){}}
  const opts=[];for(const [t,B] of Object.entries(P.BUILDINGS)){if(B.gate)continue;const cur=Object.entries(p.b).filter(([,b])=>b.t===t);
   for(const [id,b] of cur)if(!P.buildCheck(p,t,b.l+1,id))opts.push({cp:P.costOf(t,b.l+1).cp,a:()=>plotAction(s,{action:'plot-upgrade',plot:{id}},now)});
   if(!P.buildCheck(p,t,1)&&!(B.turret&&P.turretCount(p)>=6)){const pos=P.autoPlace(p,t);if(pos)opts.push({cp:P.costOf(t,1).cp,a:()=>plotAction(s,{action:'plot-build',plot:{type:t,...pos}},now)});}}
  opts.sort((x,y)=>x.cp-y.cp);for(const o of opts){try{if(o.cp<=s.ledger.cp){o.a();return;}}catch(e){}}};
 let engineeringCP=0;
 for(let day=0;day<180;day++){for(const [h,mins] of pr.sessions){let now=start+day*DAY+h*3600000;
  if(s.base.tier){atGate();try{baseAction(s,{action:'base-claim'},now);}catch(e){}try{plotAction(s,{action:'plot-collect',plot:{}},now);}catch(e){}}build(now);
  for(let m=0;m<mins;m+=1.5){now+=90000;played+=1.5;const id=played<=75?legacy[serial%legacy.length]:C.raidIds[serial%C.raidIds.length];serial++;
   s.mission=id;s.attempt=serial;s.featuredMission=false;const cp0=s.ledger.cp;const rec=missionReward(s,now);ptsRaw+=rec.ptsRaw||0;s.mission=null;const half=s.base.tier?Math.floor((s.ledger.cp-cp0)/2):0;s.ledger.cp-=half;other+=half;
   s.position=at(1174,1168);bank(s,now);build(now);}}
  build(start+(day+1)*DAY-1000);if(hit.CC10&&day>hit.CC10.day+2)break;}
 return {hit,finalCC:s.plot?.cc,otherSinksCP:other,playedMin:Math.round(played)};}
// ---------------------------------------------------------------- 2. minerals and plates (economy-model method) -------
const Pm=MODEL.P,A=Pm.conquest.activities,MIN=['fe','il','ar','tq','se','mh'];
const ramp=(d,from,full)=>d<from?0:d>=full?1:.5;
function dayIncome(pr,d,baseDays){const inc=Object.fromEntries(MIN.map(k=>[k,0])),add=(o,x=1)=>{for(const [k,v] of Object.entries(o))inc[k]+=v*x;};const m=pr.cq;
 const aAr=ramp(d,3,8),aTq=ramp(d,14,30),aVet=ramp(d,30,45),g=.25*m,sh={fe:.45,il:.30,ar:.17*aAr,tq:.08*aTq},tot=Object.values(sh).reduce((a,b)=>a+b,0);
 for(const k of ['fe','il','ar','tq']){const D=Pm.deposits[k],minutes=g*sh[k]/tot,supply=D.veins*D.cap*(D.regrowH<=24?Math.min(pr.n,24/D.regrowH):24/D.regrowH)/D.yield,h=Math.min(minutes/A['gather_'+k].par,supply);inc[k]+=h*D.yield;if(k==='tq')inc.se+=h*D.seVein;}
 const ops=.45*m,mix=d<1?{field:1}:d<7?{field:.5,raid_hard:.5}:d<30?{field:.2,raid_hard:.6,defense:.2}:{raid_hard:.4*(1-aVet)+.1,raid_veteran:.4*aVet+.1*(1-aVet),defense:.2,field:.3*(1-aVet)},mt=Object.values(mix).reduce((a,b)=>a+b,0);
 for(const [id,f] of Object.entries(mix)){const n=ops*(f/mt)/A[id].par,win=id==='raid_hard'?(d<7?.7:.9):id==='raid_veteran'?.8:1;add(Pm.opMinerals[id],n*win);}
 const strikes=Math.min(1440/Pm.strike.everyMin,pr.n*(m/pr.n+Pm.strike.windowMin)/Pm.strike.everyMin),ok=d<7?.6:d<21?.85:.95,st=strikes*ok;add(Pm.strike.guaranteed,st);inc.se+=st*(Pm.strike.se+1/Pm.strike.resonance.se);inc.mh+=st*(Pm.strike.mh+1/Pm.strike.resonance.mh);
 if(d===0)inc.fe+=Pm.starterVein;return inc;}
function plates(pr,baseDays){const bag=Object.fromEntries(MIN.map(k=>[k,0])),slots=[0,0,0,0],first={},full={};
 for(let d=0;d<900;d++){const inc=dayIncome(pr,d,baseDays);for(const k of MIN)bag[k]+=inc[k];
  for(let g=0;g<24;g++){const lo=Math.min(...slots);if(lo>=6)break;const i=slots.indexOf(lo),Cc=Pm.plating.cost[lo+1];if(!Object.entries(Cc).every(([k,v])=>k==='pts'||bag[k]>=v))break;for(const [k,v] of Object.entries(Cc))if(k!=='pts')bag[k]-=v;slots[i]=lo+1;const t=lo+1;if(first[t]===undefined)first[t]=d+1;if(slots.every(x=>x>=t))full[t]=d+1;}}
 return {first,full,day1:Object.fromEntries(MIN.map(k=>[k,+dayIncome(pr,1)[k].toFixed(2)])),day30:Object.fromEntries(MIN.map(k=>[k,+dayIncome(pr,30)[k].toFixed(2)]))};}
// ---------------------------------------------------------------- 3. airdrop points an hour -------------------------------
// Modeled Conquest base points a minute (economy-model KIT_MODEL mixes; stock kit = Rookie, rare kit = Veteran, epic = Master)
// x league pay x Command Base multiplier, plus the Daily Base Yield (flat, per tier), per day; then the 50,000 cap.
const ppm={stock:214,common:252,rare:307,epic:447,legend:620};   // Conquest, no base, Rookie-equivalent (economy-model table)
function pointsDay(pr,kit,lg,tier){const perMin=ppm[kit]*R.LG_BASE_PAY[lg]*R.CQ_BASE_MULT[tier],active=perMin*pr.cq,yieldPts=R.CQ_YIELD.pts[tier]*R.LG_BASE_PAY[lg],raw=active+yieldPts;return {perHour:Math.round(perMin*60),activeDay:Math.round(active),yield:Math.round(yieldPts),day:Math.round(Math.min(R.DAILY_CAP,raw)),capped:raw>R.DAILY_CAP,minutesToCap:Math.round((R.DAILY_CAP-yieldPts)/perMin)};}
// ---------------------------------------------------------------- 4. CP ladder ------------------------------------------
const engineeringCP=Object.keys(C.tracks).length*C.costs.reduce((a,c)=>a+c.cp,0),ccLadderCP=P.CC.claim.cp+P.CC.cost.filter(Boolean).reduce((a,c)=>a+c.cp,0);
let buildingsCP=0;for(const [t,B] of Object.entries(P.BUILDINGS)){if(B.gate)continue;const n=B.count?B.count.at(-1)[1]:1;for(let l=1;l<=B.max;l++)buildingsCP+=P.costOf(t,l).cp*n;}
let turretsCP=0;for(const t of P.TURRETS)for(let l=1;l<=5;l++)turretsCP+=P.costOf(t,l).cp;turretsCP=Math.round(turretsCP/P.TURRETS.length*42);
const out={scope:'Modeled with live rules and real Worker functions; not a human playtest.',profiles:{},cpLadder:{engineering8x6:engineeringCP,commandCenterCC1to10:ccLadderCP,everyBuildingMaxed:buildingsCP,turrets42avgMaxed:turretsCP,total:engineeringCP+ccLadderCP+buildingsCP+turretsCP},points:{}};
for(const [k,pr] of Object.entries(PROFILES)){const base=runBase(pr);out.profiles[k]={label:pr.label,base,plates:plates(pr,base.hit)};}
for(const [k,pr] of Object.entries(PROFILES))out.points[k]={rookieStockNoBase:pointsDay(pr,'stock',0,0),pilotCommonCC3:pointsDay(pr,'common',1,2),veteranRareCC5:pointsDay(pr,'rare',2,3),masterEpicCC9:pointsDay(pr,'epic',5,5),legendCC10:pointsDay(pr,'legend',6,5)};
console.log(JSON.stringify(out,null,1));
