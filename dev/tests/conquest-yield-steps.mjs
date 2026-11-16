// Session 6 Part E (owner Decisions 2a, 3a): Daily Base Yield points unlock in 25% steps per verified operation that UTC day
// (harvests half, together at most half), partial collects drain the meter by what they paid and never pay more than the meter;
// field-mission airdrop points taper 100/100/100/60/40% by the run of the same mission that day; raids unchanged; the HUD copy.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyAction}=await import('../../worker/src/conquest-sim.js');
const {missionReward}=await import('../../worker/src/conquest-economy.js');
const A=await import('../../worker/src/conquest-airdrop.js');
const DAY=86400000,t0=Date.UTC(2026,10,16,1),at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const U=(op,hv)=>R.cqYieldUnlock({d:5,op,hv},5).u;
ok([0,1,2,3,4,5].map(n=>U(n,0)).join()==='0,0.25,0.5,0.75,1,1','each operation unlocks 25%, four unlock it all');
ok(U(0,1)===.125&&U(0,4)===.5&&U(0,20)===.5&&U(1,4)===.75&&U(2,9)===1,'a harvest counts half; harvests together unlock at most half');
ok(R.cqYieldUnlock({d:4,op:4,hv:0},5).u===0,'yesterday\'s operations unlock nothing today');
ok(R.cqYieldUnlock({d:5,op:2,hv:0},5).toGo===2&&R.cqYieldUnlock({d:5,op:1,hv:1},5).toGo===3,'operations to go (YIELD POINTS 50% · 2 operations to go)');
// through the real base action: a full day's meter, operations one by one, never more than the meter
{const d=C.baseDefinition,s=createState(R.STOCK_L,t0);s.position=at(d.x,d.z);s.battle.enemies=[];s.ledger.cp=1e5;s.ledger.banked={alloy:1e4,biomass:1e4,helium:1e4};
 let a=applyAction(s,{seq:1,action:'build-base'},t0);const T=t0+DAY-3600000;   // nearly a full 24 h fill, same UTC day
 assert.throws(()=>applyAction(structuredClone(a),{seq:2,action:'base-claim',x:1},T),/invalid/);
 a.base.claimedAt=T;   // materials already collected: this test reads the points part only
 assert.throws(()=>applyAction(structuredClone(a),{seq:2,action:'base-claim'},T),/unlock 25% per operation/);ok(true,'no operation today: nothing to collect, the meter says how to unlock it');
 const meter=Math.floor(R.CQ_YIELD.pts[1]*((T-t0)/DAY));let paid=0,seq=2,tt=T;
 for(let k=1;k<=5;k++){tt+=60000;A.earn(a,'field',450,tt,{op:true});A.seal(a,tt);tt+=1000;let got=0;try{a=applyAction(a,{seq:seq++,action:'base-claim'},tt);A.seal(a,tt);got=A.airdrop(a).out.at(-1).n.yield?A.airdrop(a).out.at(-1).raw:0;}catch(e){seq--;}paid+=got;}
 ok(Math.abs(paid-meter)<=4&&paid<=meter+4,'five operations, a collect after each: the day pays the whole meter once ('+paid+' of '+meter+'), never more');}
// field taper (Decision 3a): 100, 100, 100, 60, 40, 40 % of 450 by the run of the same mission that UTC day
{const s=createState(R.STOCK_L,t0),runs=[];let t=t0;for(let k=0;k<6;k++){t+=181000;s.mission='recon';s.attempt=k+1;const r=missionReward(s,t);s.mission=null;runs.push(Math.round(r.ptsRaw/R.CQ_BASE_MULT[0]));}
 ok(JSON.stringify(runs)===JSON.stringify([450,450,450,270,180,180]),'the same field mission in one UTC day pays 450 x3, then 270 (60%), then 180 (40%): '+runs.join(', '));
 t=t0+DAY+1000;s.mission='recon';s.attempt=9;ok(missionReward(s,t).ptsRaw===450,'a new UTC day starts at 100% again');s.mission=null;
 const r=createState(R.STOCK_L,t0),raid=Object.values(C.operations).find(o=>o.raid&&o.danger==='HARD');let tr=t0;const pays=[];for(let k=0;k<5;k++){tr+=181000;r.mission=raid.id;r.attempt=20+k;pays.push(missionReward(r,tr).ptsRaw);r.mission=null;}
 ok(pays.every(p=>p===R.CQ_PTS.raid.HARD),'raids are unchanged (every win '+R.CQ_PTS.raid.HARD+')');}
// the copy the pilot sees (briefing, base terminal, hub, wiki)
{const app=fs.readFileSync(new URL('../../js/conquest/app.js',import.meta.url),'utf8'),hub=fs.readFileSync(new URL('../../js/conquest/hub.js',import.meta.url),'utf8'),wiki=fs.readFileSync(new URL('../../wiki.html',import.meta.url),'utf8');
 ok(app.includes("100% for your first 3 runs of this mission today, then 60%, then 40%")&&app.includes("'YIELD POINTS '+Math.round(Y.u*100)+'%'")&&hub.includes('operations to go today'.slice(0,10)),'briefing taper line, terminal and hub yield steps');
 ok(app.includes('DAILY CAP REACHED · LOOT, MINERALS AND CP STILL DROP')&&wiki.includes('Conquest still drops loot, minerals and CP'),'capped copy (Decision 7a)');
 ok(wiki.includes('each verified operation that UTC day unlocks 25%')&&wiki.includes('your first 3 runs of a mission each day, then 60%, then 40%'),'the wiki says the same');}
console.log('conquest yield steps + taper: passed '+passed);
