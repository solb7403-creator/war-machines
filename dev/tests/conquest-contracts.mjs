// Session 6 War Orders (spec §6.1; the pool in js/rules.js CQ_ORDERS; worker/src/conquest-orders.js): the daily / weekly draw
// from the server seed with eligibility, progress only from verified reducer events, claims at the Refuge or the gate, rewards
// (CP + LOOT.order, the weekly's Armalcolite through the outbox), never airdrop points, no double claim, request validation.
import assert from 'node:assert/strict';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyAction,refreshState}=await import('../../worker/src/conquest-sim.js');
const {POLICY:P,killLoot,missionReward,bank}=await import('../../worker/src/conquest-economy.js');
const {orders,orderEvent,claimOrder,weekOf,ORDER_ACTIONS}=await import('../../worker/src/conquest-orders.js');
const A=await import('../../worker/src/conquest-airdrop.js');
const {publicState}=await import('../../worker/src/conquest.js');
const DAY=86400000,t0=Date.UTC(2026,10,16,9),point=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),fresh=(t=t0)=>createState(R.STOCK_L,t);
const O=R.CQ_ORDERS,ids=s=>s.wo.list.map(o=>o.id),daily=s=>s.wo.list.filter(o=>o.kind==='daily'),weekly=s=>s.wo.list.find(o=>o.kind==='weekly');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};

// ---- 1. the draw ----
{const s=fresh();ok(daily(s).length===3&&!!weekly(s)&&s.wo.list.every(o=>o.src==='board'),'three daily orders + one weekly, each stored with source "board"');
 ok(daily(s).every(o=>!['raids2','drill1','strike1'].includes(o.id))&&weekly(s).id==='ops15','a new pilot only draws what they can do now (no raids, drills or strikes yet): weekly = '+weekly(s).id);
 const again=structuredClone(s);refreshState(again,t0+3600000);ok(JSON.stringify(ids(again))===JSON.stringify(ids(s)),'the same day keeps the same orders');
 const next=structuredClone(s);refreshState(next,t0+DAY);ok(next.wo.day===s.wo.day+1&&next.wo.list.filter(o=>o.kind==='weekly').length===1&&next.wo.dc===0,'a new UTC day draws three new dailies and keeps the week\'s order');
 const other=fresh();other.lseed=(s.lseed+7)>>>0;delete other.wo;orders(other,t0);const sets=new Set();for(let k=0;k<40;k++){const q=fresh();q.lseed=k;delete q.wo;orders(q,t0);sets.add(ids(q).join());}ok(sets.size>1,'the draw differs between pilots (server seed): '+sets.size+' distinct sets of 40');
 const vet=fresh();vet.completed=Object.fromEntries(C.fieldMissionIds.map(id=>[id,{at:t0,attempt:1}]));vet.base.tier=1;vet.resonance=1;let seen=new Set();for(let k=0;k<60;k++){const q=structuredClone(vet);q.lseed=k;delete q.wo;orders(q,t0);ids(q).forEach(x=>seen.add(x));}
 ok(['raids2','drill1','strike1','raids10','hold4','strikes3'].every(x=>seen.has(x)),'raids, drills and strikes join the pool once unlocked');
 const wk=fresh(t0);const w0=weekOf(t0);let t=t0;while(weekOf(t)===w0)t+=DAY;refreshState(wk,t);ok(wk.wo.week===w0+1,'a new UTC week (Monday) draws a new weekly order');}

// ---- 2. progress only from verified events ----
{const s=fresh();s.wo.list=[{id:'kills15',src:'board',kind:'daily',n:0,goal:15,done:0,claimed:0},{id:'bank60',src:'board',kind:'daily',n:0,goal:60,done:0,claimed:0},{id:'sectors3',src:'board',kind:'daily',n:0,goal:3,done:0,claimed:0},{id:'ops15',src:'board',kind:'weekly',n:0,goal:15,done:0,claimed:0}];
 for(const e of s.battle.enemies.slice(0,5)){e.hp=0;killLoot(s,e,t0);killLoot(s,e,t0);}ok(s.wo.list[0].n===5,'a kill counts once (5 kills -> 5/15), a repeated kill call never twice');
 s.position=point(1174,1168);s.ledger.cargo.alloy=40;bank(s,t0);s.ledger.cargo.alloy=25;bank(s,t0);ok(s.wo.list[1].n===60&&s.wo.list[1].done===1&&s.wo.seen===1,'banking alloy counts the alloy banked (40 + 25 -> done at 60), and the HUD line opens');
 for(const id of ['oxygen-line','recon','relay','convoy']){s.mission=id;s.attempt=(s.attempt|0)+1;missionReward(s,t0+((s.attempt|0)*200000));s.mission=null;}
 const secs=s.wo.list[2].secs;ok(s.wo.list[2].done===1&&secs.length===3,'field missions in three different sectors: '+secs.join(', '));ok(s.wo.list[3].n===4,'every won operation counts toward "Win 15 operations"');
 ok(ORDER_ACTIONS.length===1&&ORDER_ACTIONS[0]==='claim-order','the only War Order action is the claim: the client never reports progress');}

// ---- 3. claim: place, rewards, third order, weekly, no points, no double claim ----
{const s=fresh();s.wo.list=[...['kills15','bank60','mine12'].map(id=>({id,src:'board',kind:'daily',n:99,goal:1,done:1,claimed:0})),{id:'ops15',src:'board',kind:'weekly',n:15,goal:15,done:1,claimed:0}];s.position=point(1162,1130);
 const far=structuredClone(s);far.position=point(1000,1000);assert.throws(()=>applyAction(far,{seq:far.seq+1,action:'claim-order',order:'kills15'},t0),/Refuge terminal or your Command Gate/);ok(true,'a claim needs the Refuge terminal or the Command Gate');
 assert.throws(()=>applyAction(structuredClone(s),{seq:s.seq+1,action:'claim-order',order:'nope'},t0),/no such War Order/);assert.throws(()=>applyAction(structuredClone(s),{seq:s.seq+1,action:'claim-order',order:'kills15',cp:9999},t0),/invalid/);ok(true,'unknown orders and extra fields are refused');
 s.position=point(1174,1168);const pts0=JSON.stringify(A.airdrop(s).pend||null);let a=s,cp=a.ledger.cp;
 a=applyAction(a,{seq:a.seq+1,action:'claim-order',order:'kills15'},t0);ok(a.ledger.cp-cp===O.pool.find(d=>d.id==='kills15').cp&&Object.values(a.inv.it).reduce((x,y)=>x+y,0)===1&&a.notice.kind==='order-claimed','a daily pays its CP and one consumable');
 assert.throws(()=>applyAction(structuredClone(a),{seq:a.seq+1,action:'claim-order',order:'kills15'},t0),/already claimed/);ok(true,'no double claim');
 a=applyAction(a,{seq:a.seq+1,action:'claim-order',order:'bank60'},t0);const fr0=a.inv.fr.u;a=applyAction(a,{seq:a.seq+1,action:'claim-order',order:'mine12'},t0);ok(a.inv.fr.u===fr0+1&&a.notice.third===1,'the day\'s third claim adds an uncommon fragment');
 cp=a.ledger.cp;const fr=a.inv.fr.r;a=applyAction(a,{seq:a.seq+1,action:'claim-order',order:'ops15'},t0);A.seal(a,t0);const entry=A.airdrop(a).out.at(-1);
 ok(a.ledger.cp-cp===1500&&a.inv.fr.r===fr+1&&entry?.mn?.ar===1,'the weekly pays 1,500 CP, a rare fragment and 1 Armalcolite to the wallet (outbox entry '+JSON.stringify(entry?.mn)+')');
 ok(!(entry.raw>0)&&JSON.stringify(A.airdrop(s).pend||null)===pts0,'War Orders never pay airdrop points');
 const g=structuredClone(s);g.base.tier=1;g.position=point(C.baseDefinition.x+3,C.baseDefinition.z);g.wo.list[0].claimed=0;const r=applyAction(g,{seq:g.seq+1,action:'claim-order',order:'kills15'},t0);ok(r.wo.list[0].claimed===1,'the Command Gate works too (with a town)');
 const m=structuredClone(s);m.mission='oxygen-line';assert.throws(()=>claimOrder(m,{seq:1,action:'claim-order',order:'kills15'},t0),/finish the operation/);ok(true,'never inside an operation');
 ok('wo' in publicState(s)&&!('lseed' in publicState(s)),'the phone sees its orders, never the seed');}
console.log('conquest contracts (War Orders): passed '+passed);
