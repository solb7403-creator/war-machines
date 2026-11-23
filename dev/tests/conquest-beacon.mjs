// Session 7T (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md) decision 10, the Strike Beacon (the Nov 10 brief C): once a UTC day a
// pilot calls a Meteor Strike at the current slot's site within a 20-minute window of their choosing; identical waves, rewards, the
// slot's roll (the stored one if the slot was already started) and Resonance; it counts as that slot. Through the real Worker reducers.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST:{World:W,Combat:C,Town:TN}}=await import('../../worker/src/sim.gen.js');
const {createState,applyAction}=await import('../../worker/src/conquest-sim.js');
const {missionReward}=await import('../../worker/src/conquest-economy.js');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};const M=60000,H=3600000;
const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
const fresh=(x,z,t)=>{const s=createState(R.STOCK_L,t);s.position=at(x,z);s.battle.enemies=[];s.lastWall=t;s.creditMs=0;s.completed={};return s;};
// 10:30 UTC: the 10:00 strike closed at 10:20; the next impact is 12:00 (telegraph from 11:55)
const idle=Date.UTC(2026,10,24,10,30),I=C.meteorStrike(idle),site=I.site,other=C.strikeSites.find(x=>x.id!==site.id);
ok(I.phase==='idle'&&TN.beaconOf(fresh(site.x,site.z+10,idle),idle).ready,'between strikes the Beacon is ready ('+site.name+', the 10:00 slot)');
// 1. one a day, a 20-minute window from the call, at the current slot's site
{let s=fresh(site.x,site.z+10,idle);assert.throws(()=>applyAction(s,{seq:s.seq+1,action:'start-mission',mission:site.id},idle),/no meteor strike/);ok(true,'without the Beacon the closed crater cannot start');
 s=applyAction(s,{seq:s.seq+1,action:'strike-beacon'},idle);ok(s.bcn.slot===I.slot&&s.bcn.site===site.id&&s.bcn.until===idle+20*M&&s.notice.kind==='strike-beacon','the call opens '+site.name+' for 20 minutes');
 assert.throws(()=>applyAction(s,{seq:s.seq+1,action:'strike-beacon'},idle+5*M),/recharges at 00:00 UTC/);ok(true,'once a UTC day');
 const so=structuredClone(s);so.position=at(other.x,other.z+10);assert.throws(()=>applyAction(so,{seq:so.seq+1,action:'start-mission',mission:other.id},idle+M),/no meteor strike/);ok(true,'only at the called site');
 const late=structuredClone(s);assert.throws(()=>applyAction(late,{seq:late.seq+1,action:'start-mission',mission:site.id},idle+21*M),/no meteor strike/);ok(true,'the window ends 20 minutes after the call');
 // 2. identical: waves, the slot's roll, rewards; it counts as that slot
 s=applyAction(s,{seq:s.seq+1,action:'start-mission',mission:site.id},idle+2*M);const roll=structuredClone(s.strikes[I.slot].roll);
 ok(s.mission===site.id&&s.strikeSlot===I.slot&&s.battle.enemies.filter(e=>!e.resident).map(e=>e.kind).join()==='raider,raider,raider','the called strike starts as the slot\'s own: wave 1 is three interceptors, the roll stored for slot '+I.slot);
 s=applyAction(s,{seq:s.seq+1,action:'return-exploration'},idle+4*M);s.position=at(site.x,site.z+10);s=applyAction(s,{seq:s.seq+1,action:'start-mission',mission:site.id},idle+6*M);
 ok(JSON.stringify(s.strikes[I.slot].roll)===JSON.stringify(roll),'a retry inside the window keeps the roll');
 s.ledger.mn={};const r=missionReward(s,idle+10*M),want={il:2,ar:2};if(roll.tq<R.STRIKE.tq)want.tq=1;if(roll.se<R.STRIKE.se)want.se=1;if(roll.mh<R.STRIKE.mh)want.mh=1;
 ok(r.kind==='strike'&&r.ptsRaw===R.CQ_PTS.strike&&r.cp===R.STRIKE.cp&&JSON.stringify(r.mn)===JSON.stringify(want),'the same rewards as the real strike: '+R.CQ_PTS.strike+' raw points, '+R.STRIKE.cp+' CP, '+JSON.stringify(r.mn));
 ok(missionReward(s,idle+11*M).kind==='strike-claimed'&&!TN.beaconOf(s,idle+12*M).ready,'it counts as that slot: claimed once, never twice');}
// 3. the stored roll applies when the slot was already started in the real window
{const open=Date.UTC(2026,10,24,10,5),O=C.meteorStrike(open);let s=fresh(O.site.x,O.site.z+10,open);s=applyAction(s,{seq:s.seq+1,action:'start-mission',mission:O.site.id},open);const roll=structuredClone(s.strikes[O.slot].roll);
 s=applyAction(s,{seq:s.seq+1,action:'return-exploration'},open+60000);s.position=at(O.site.x,O.site.z+10);
 assert.throws(()=>applyAction(structuredClone(s),{seq:s.seq+1,action:'strike-beacon'},open+5*M),/open now: join it/);ok(true,'not while a real strike is open (join that one)');
 s=applyAction(s,{seq:s.seq+1,action:'strike-beacon'},idle);s=applyAction(s,{seq:s.seq+1,action:'start-mission',mission:O.site.id},idle+M);
 ok(O.slot===I.slot&&JSON.stringify(s.strikes[O.slot].roll)===JSON.stringify(roll),'a slot started in its real window keeps its roll when the Beacon calls it back (no re-roll)');}
// 4. Resonance counts the called strike like any other
{let s=fresh(site.x,site.z+10,idle);s.resonance=11;s=applyAction(s,{seq:s.seq+1,action:'strike-beacon'},idle);s=applyAction(s,{seq:s.seq+1,action:'start-mission',mission:site.id},idle+M);s.strikes[I.slot].roll={tq:.99,se:.99,mh:.99};
 const g=missionReward(s,idle+5*M);ok(g.mn.se===1&&g.core.includes('resonance-se')&&g.resonance===12,'Strike Resonance: the 12th secured strike, a called one, guarantees a Selenite');}
// 5. the next UTC day it is ready again; telegraph blocks it too
{let s=fresh(site.x,site.z+10,idle);s=applyAction(s,{seq:s.seq+1,action:'strike-beacon'},idle);const next=Date.UTC(2026,10,25,10,30);ok(TN.beaconOf(s,next).ready,'the next UTC day the Beacon is ready again');
 const tel=Date.UTC(2026,10,25,11,57);ok(C.meteorStrike(tel).phase==='telegraph'&&!TN.beaconOf(s,tel).ready,'not while the next strike is telegraphed');}
console.log('PASS Strike Beacon (decision 10): '+pass+' checks');
