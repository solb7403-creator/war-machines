// Session 7T-P decision 2 (owner brief docs/conquest/audit/SESSION_07TP_BRIEF.md): Selenite for the late fortress, through the real Worker
// reducers. A raid at the cap level (ConquestTown.TOWN.se.from) settled HELD with the pilot really fighting drops TOWN.se.n Selenite into
// the pilot's cargo (banked at the Refuge like every mineral), on the receipt and in the town's log (the War Report's line); never below the
// cap, never for an unfought raid, never for a fight that did not hold, never points or CP beyond the 675 defense points the fight already
// pays (8: the owner's addendum, Nov 23); Selenite stays earn-only (never in the store). Raids reach the cap only once the Citadel's tiers VIII-IX (Session 11; 7B's tiers I-III top out at level 8) pass to the town clock:
// today every town attack is level 1-4, so the drop is dormant (checked through the live defense below). The measurement that set the
// amount: dev/tools/selenite-candidates.mjs (docs/conquest/session7tp/selenite-candidates.json) and dev/tests/conquest-fortress.mjs (e).
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Plot:P,War:WR,Raid:RD,Town:TN}=CONQUEST;
const {createState,applyAction,applyCommands}=await import('../../worker/src/conquest-sim.js');
const {settle,plotOfSnap}=await import('../../worker/src/conquest-town.js');
const {townPilot,townAttack}=await import('./lib/town-helpers.mjs');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};const H=3600000,t0=Date.UTC(2026,10,23,1);
// ---- 1. the rule ----
ok(TN.TOWN.se.from===TN.TOWN.cap&&TN.TOWN.se.n===8,'the rule (the owner\'s addendum, Nov 23: the 2-hour heavy player\'s amount): '+TN.TOWN.se.n+' Selenite for a raid at the cap level ('+TN.TOWN.cap+') held in person');
ok([1,2,3,4,5,6,7,8].every(l=>TN.seOf(l)===0)&&TN.seOf(9)===8,'none below the cap: levels 1-8 pay 0, level 9 pays 8');
ok(P.STORE.ores.se===false&&!P.STORE.items.some(i=>JSON.stringify(i.grants||{}).includes('se')),'Selenite stays earn-only: never in the store');
// a cap-level attack: THREAT = a five-star general + every Citadel tier + the Grand Offensive surge (+ the portal while open) -> level 9
const G5=WR.GENERALS.find(g=>g.stars===5).id;
const capRaid=(strong=true)=>{const s=townPilot(CONQUEST,R,createState,t0,{cc:10,strong});const e=townAttack(CONQUEST,s,t0,{g:G5,go:true});return {s,e};};
{const w=CONQUEST.War.fresh(t0),top3=WR.threatOf(w,{g:WR.GENERALS.filter(g=>g.stars<=TN.STARS[3][1]).sort((a,b)=>b.stars-a.stars)[0].id,t:'town'},{now:t0,tiers:3},true).total;
 ok(TN.levelOf(top3)<TN.TOWN.cap,'review B1: with 7B\'s tiers I-III the strongest town raid is THREAT '+top3+' -> level '+TN.levelOf(top3)+' (below the cap): the drop wakes with tiers VIII-IX (Session 11)');}
{const {s,e}=capRaid();const st=TN.strength(s.war,e,{now:t0+H,tiers:9});ok(st.level===TN.TOWN.cap,'a five-star general with every Citadel tier cleared and the surge: THREAT '+st.total+' -> level '+st.level);}
// the fight: a real raid machine at the cap with the pilot's tank (bot) beside the garrison, as the Worker steps it
function fightOf(s,e,cit=9){const p=s.plot,lv=TN.strength(s.war,e,{now:t0+H,tiers:cit}).level,seed=7;const me=RD.unitOf({id:'you',kind:'p',L:s.loadout});
 const M=RD.make(p,seed,{threat:lv,lane:e.ln,units:[me],dt:.05,damage:true,frames:false,events:false});
 for(let g=0;!M.over&&g<40000;g++){const q=M.pilot;let f=null,fd=Infinity;for(const x of M.foes)if(!x.dead){const d=Math.hypot(x.x-q.x,x.z-q.z);if(d<fd){fd=d;f=x;}}M.step(f&&!q.down?{x:fd<22?0:(f.x-q.x)/fd,z:fd<22?0:(f.z-q.z)/fd,aimYaw:Math.atan2(f.x-q.x,f.z-q.z),fire:true,lockId:f.id}:{x:0,z:0,fire:false});}
 return {R:M.result(),lv};}
// ---- 2. held in person at the cap: 4 Selenite to cargo, on the receipt and in the log ----
{const {s,e}=capRaid();const {R:Rl,lv}=fightOf(s,e);ok(RD.outcomeOf(Rl)==='held','the fully built town holds the cap-level raid with the pilot fighting (level '+lv+')');
 const twin=structuredClone(s),mn0=s.ledger.mn?.se|0,cp0=s.ledger.cp,pts0=s.airdrop?.pend?.raw||0,live={R:Rl,uf:null,fought:true,snap:null,gar:[]};const o=settle(s,e,t0+H,live,9);
 const x=s.tw.log.at(-1);ok(o==='held'&&(s.ledger.mn.se|0)===mn0+8&&s.notice?.mn?.se===8&&x.se===8,'held in person at the cap: +8 Selenite in cargo, on the receipt (mn.se) and in the town log');
 // the same held fight one level below the cap (the 7T payout): identical CP, points and other minerals; only the Selenite differs
 const o2=settle(twin,structuredClone(e),t0+H,live,7),{se:_a,...mnA}=s.ledger.mn,{se:_b,...mnB}=twin.ledger.mn||{};
 ok(o2==='held'&&s.ledger.cp-cp0===twin.ledger.cp-cp0&&(s.airdrop?.pend?.raw||0)-pts0===(twin.airdrop?.pend?.raw||0)-pts0&&JSON.stringify(mnA)===JSON.stringify(mnB)&&!(twin.ledger.mn?.se|0),'... and nothing else new: the same CP ('+(s.ledger.cp-cp0)+', the defense cache), defense points ('+((s.airdrop?.pend?.raw||0)-pts0)+') and other minerals as the same fight one level below the cap');
 ok(TN.norm(s.tw,t0+2*H).log.at(-1).se===8,'the town log keeps it through the record\'s check (the War Report reads it)');}
// ---- 3. never otherwise ----
{const {s,e}=capRaid();const o=settle(s,e,t0+H,null,9);ok(o==='held'&&!(s.ledger.mn?.se|0)&&!s.tw.log.at(-1).se,'held unfought at the cap: the defense cache, no Selenite (it rewards defending in person)');}
{const {s,e}=capRaid();const {R:Rl}=fightOf(s,e);const o=settle(s,e,t0+H,{R:Rl,uf:null,fought:false,snap:null,gar:[]},9);ok(o==='held'&&!(s.ledger.mn?.se|0),'present but not really fighting (no AFK reward): no Selenite');}
{const {s,e}=capRaid(false);s.plot.cc=10;s.plot.b.cc.l=10;const {R:Rl}=fightOf(s,e);const o=settle(s,e,t0+H,{R:Rl,uf:null,fought:true,snap:null,gar:[]},9);ok(o!=='held'&&!(s.ledger.mn?.se|0),'a cap-level fight that did not hold (an unwalled town): no Selenite ('+o+')');}
{const {s,e}=capRaid();const {R:Rl,lv}=fightOf(s,e,7);const o=settle(s,e,t0+H,{R:Rl,uf:null,fought:true,snap:null,gar:[]},7);ok(o==='held'&&lv<TN.TOWN.cap&&!(s.ledger.mn?.se|0),'held in person one step below the cap (level '+lv+'): no Selenite');}
// ---- 4. today (no Citadel tiers on the town clock): the live defense pays no Selenite: the drop waits for tiers VIII-IX (Session 11) ----
{let s=townPilot(CONQUEST,R,createState,t0,{cc:10,strong:true});const e=townAttack(CONQUEST,s,t0,{g:G5,go:true});let now=t0+2*H;s.lastWall=now-1000;
 s=applyAction(s,{seq:s.seq+1,action:'town-defend',town:{id:e.id}},now);ok(s.td?.active&&s.td.lv<=7,'today a town attack is at most level '+s.td.lv+' (the Citadel tiers arrive with 7B and Session 11)');
 for(let k=0;k<400&&s.td?.active;k++){const d=s.td,M=RD.make(plotOfSnap(s.tdp),d.seed,{threat:d.lv,lane:d.ln,units:d.units,dt:.05,pilot:d.pilot,state:d.st,damage:true,frames:false,events:false}),cmds=[];
  for(let i=0;i<20&&!M.over;i++){const q=M.pilot;let f=null,fd=Infinity;for(const x of M.foes)if(!x.dead){const dd=Math.hypot(x.x-q.x,x.z-q.z);if(dd<fd){fd=dd;f=x;}}const c=f&&!q.down?{x:fd<22?0:(f.x-q.x)/fd,z:fd<22?0:(f.z-q.z)/fd,aimYaw:Math.atan2(f.x-q.x,f.z-q.z),fire:true,lockId:f.id}:{x:0,z:0,fire:false};cmds.push(c);M.step(c);}
  now+=cmds.length*50;s=applyCommands(s,{seq:s.seq+1,commands:cmds},now);}
 ok(!s.td?.active&&s.td.o==='held'&&!(s.ledger.mn?.se|0),'a held live defense today pays the 675 points and the defense minerals, and no Selenite');}
console.log('PASS Selenite for the late fortress (7T-P decision 2): '+pass+' checks');
