// Conquest airdrop points through the real Worker (fake Firebase with ETags): verified outcomes credit the account exactly
// once by outbox id, through the shared ecoPlayAward (cap, league base pay, spendable bonus), survive a failed account write,
// never double on replays or concurrent tabs, and count as a verified play (referral) day. docs/economy/RESOURCE_ECONOMY.md
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({pruneEmptyUnder:['conquest']});
let failEcoWrites=0;
globalThis.fetch=async(url,init={})=>{const u=String(url);if(!u.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))throw Error('Unexpected external request');
 if(failEcoWrites>0&&(init.method||'GET').toUpperCase()==='PUT'&&/\/eco\/tg_\d+\.json/.test(u)){failEcoWrites--;return new Response('{"error":"unavailable"}',{status:503});}
 return db.handle(url,init);};
const {default:worker}=await import('../../../worker/src/index.js');
const {RULES:R,CONQUEST:{Combat:C}}=await import('../../../worker/src/sim.gen.js');
const {creditConquest}=await import('../../../worker/src/eco.js');
const env={BOT_TOKEN:'conquest-airdrop-test',FIREBASE_DB_SECRET:'SECRET'};
let now=Date.UTC(2026,10,9,10,0,0);const clock=Date.now;Date.now=()=>now;
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:4,initData:auth(id),...body})}),env);const text=await r.text();return {status:r.status,...(text.startsWith('{')?JSON.parse(text):{error:text})};}
const eco=id=>db.get('eco/tg_'+id),cq=id=>db.get('conquest/tg_'+id);
let passed=0;const ok=(cond,msg)=>{assert(cond,msg);passed++;console.log('PASS '+msg);};

// ---- a field mission victory credits 450 base points at Rookie, exactly once ----
const P=8201;await call(P,'/api/sync');let r=await call(P,'/api/conquest/session');assert.equal(r.status,200);
const e0=structuredClone(eco(P));
const op=C.operations.convoy;let s=cq(P);s.position={x:op.x,z:op.z,y:0,surface:'ground'};s.battle.enemies=[];now+=50;
r=await call(P,'/api/conquest/action',{seq:s.seq+1,action:'start-mission',mission:'convoy'});assert.equal(r.status,200,JSON.stringify(r.error));
// Disposable fixture: the authored convoy fight is forced to its verified victory state; the next replayed step settles it.
s=cq(P);s.battle.state='victory';now+=100;
const win={seq:s.seq+1,commands:[{x:0,z:0},{x:0,z:0}]};
const both=await Promise.all([call(P,'/api/conquest/input',win),call(P,'/api/conquest/input',win)]);
assert(both.every(x=>x.status===200),JSON.stringify(both.map(x=>x.error)));
const e1=eco(P),pay=R.LG_BASE_PAY[e1.lgi|0];
ok(e1.dailyPts-e0.dailyPts===Math.round(R.CQ_PTS.field*pay),'field mission victory credits '+Math.round(R.CQ_PTS.field*pay)+' base points (league '+(e1.lgi|0)+')');
ok(e1.earned-e0.earned===Math.round(R.CQ_PTS.field*pay)&&e1.pts-e0.pts===e1.earned-e0.earned,'Rookie: spendable equals base; lifetime (airdrop) points rise by the same amount');
ok(e1.cqw===1&&(cq(P).airdrop.out||[]).length===0&&cq(P).airdrop.ack===1,'watermark cqw=1; the Conquest outbox entry is acknowledged and dropped');
ok((e1.vd|0)===(e0.vd|0)+1&&e1.vdl===Math.floor(now/86400000),'a verified Conquest operation day counts as a verified play (referral) day');
ok(both.some(x=>x.replayed)&&both.every(x=>x.state.settlement?.ptsRaw===R.CQ_PTS.field),'two tabs racing the same victory: one commits, one replays, one settlement');

// ---- replay of a committed request never credits again ----
const before=structuredClone(eco(P));const again=await call(P,'/api/conquest/input',win);
ok(again.status===200&&again.replayed&&eco(P).dailyPts===before.dailyPts&&eco(P).cqw===before.cqw,'a resent request (lost reply) is replayed without a second credit');

// ---- a world kill pays at once into the outbox; the credit waits for a batch or 20 s; a failed account write loses nothing ----
s=cq(P);now+=50;const ret=await call(P,'/api/conquest/action',{seq:s.seq+1,action:'return-exploration'});assert.equal(ret.status,200);
s=cq(P);const victim=s.battle.enemies.find(e=>e.hp>0&&e.base?.kind==='patrol')||s.battle.enemies.find(e=>e.hp>0);assert(victim,'a world enemy exists');
victim.hp=0;victim.lootCreated=false;const heavy=victim.kind==='command'||victim.kind==='sentinel',killPts=R.CQ_PTS.kill[heavy?'heavy':'light'];
now+=100;r=await call(P,'/api/conquest/input',{seq:s.seq+1,commands:[{x:0,z:0},{x:0,z:0}]});assert.equal(r.status,200);
const held=cq(P).airdrop.out||[];
ok(held.length===1&&held[0].raw===killPts&&eco(P).cqw===1,'a world kill becomes one pending outbox entry ('+killPts+' raw), credited later in a batch');
failEcoWrites=8;now+=25000;s=cq(P);r=await call(P,'/api/conquest/input',{seq:s.seq+1,commands:[{x:0,z:0}]});assert.equal(r.status,200,'the Conquest request still succeeds while the account write fails');
ok((cq(P).airdrop.out||[]).length===1&&eco(P).cqw===1,'account write failure: the entry stays pending, nothing credited, nothing lost');
failEcoWrites=0;const d0=eco(P).dailyPts;now+=50;s=cq(P);r=await call(P,'/api/conquest/input',{seq:s.seq+1,commands:[{x:0,z:0}]});
ok(eco(P).dailyPts-d0===Math.round(killPts*pay)&&eco(P).cqw===2&&(cq(P).airdrop.out||[]).length===0,'after recovery the pending kill is credited exactly once ('+Math.round(killPts*pay)+')');
ok(r.state.airdrop?.view?.dailyPts===eco(P).dailyPts&&r.state.airdrop.view.cap===R.DAILY_CAP,'the response carries the account numbers the HUD shows (today / cap)');

// ---- the watermark ignores entries already credited (a stale Conquest copy re-sent) ----
const w0=structuredClone(eco(P));const stale=await creditConquest(env,'tg_'+P,[{id:1,raw:450,n:{field:1},op:1,ms:0},{id:2,raw:35,n:{kill:1},op:0,ms:0}],now);
ok(stale.base===0&&eco(P).dailyPts===w0.dailyPts&&eco(P).rev===w0.rev,'re-sent entries at or below the watermark change nothing (no account write)');

// ---- one daily cap shared with Arcade: Conquest points stop at 50,000 base a day ----
db.root.eco['tg_'+P].dailyPts=R.DAILY_CAP-100;
const capped=await creditConquest(env,'tg_'+P,[{id:3,raw:450,n:{field:1},op:1,ms:120000}],now);
ok(capped.base===100&&capped.capped&&eco(P).dailyPts===R.DAILY_CAP,'shared cap: 450 earned, 100 room left, 100 credited, the rest does not bank ('+R.DAILY_CAP+')');
const atCap=await creditConquest(env,'tg_'+P,[{id:4,raw:900,n:{raid:1},op:1,ms:120000}],now);
ok(atCap.base===0&&eco(P).dailyPts===R.DAILY_CAP&&eco(P).cqw===4,'at the cap: nothing more banks today, the entry is still consumed once');

// ---- league base pay and the spendable bonus, as Arcade ----
const Q=8202;await call(Q,'/api/sync');await call(Q,'/api/conquest/session');db.root.eco['tg_'+Q].lgi=6;db.root.eco['tg_'+Q].lg='LUNAR';
const q0=structuredClone(eco(Q));const lg=await creditConquest(env,'tg_'+Q,[{id:1,raw:1000,n:{raid:1},op:1,ms:240000}],now);
ok(lg.base===Math.round(1000*R.LG_BASE_PAY[6])&&eco(Q).earned-q0.earned===Math.round(1000*R.LG_BASE_PAY[6])*R.LG_MULT[6],'Lunar Legend: base = raw x '+R.LG_BASE_PAY[6]+'; spendable x '+R.LG_MULT[6]+' on top; league bonus kept out of airdrop base');
ok(R.ecoBase(eco(Q))-R.ecoBase(q0)===Math.round(1000*R.LG_BASE_PAY[6]),'airdrop base counts the base points only (league bonus excluded)');

// ---- a kills-only day is not a referral play day ----
const K=8203;await call(K,'/api/sync');await call(K,'/api/conquest/session');const k0=eco(K).vd|0;
await creditConquest(env,'tg_'+K,[{id:1,raw:35,n:{kill:1},op:0,ms:60000}],now);
ok((eco(K).vd|0)===k0,'world kills alone do not mark a verified play day; an operation does');

// ---- the HUD numbers come from the account on session open (points earned in Arcade today included) ----
const V=8206;await call(V,'/api/sync');db.root.eco['tg_'+V].dailyPts=1234;db.root.eco['tg_'+V].dailyDay=Math.floor(now/86400000);
const vs=await call(V,'/api/conquest/session');ok(vs.state.airdrop.view.dailyPts===1234&&vs.state.airdrop.view.cap===R.DAILY_CAP&&vs.state.airdrop.view.pay===R.LG_BASE_PAY[eco(V).lgi|0],'session open shows today\'s account points from every mode (1,234 / '+R.DAILY_CAP+') and the league pay');
db.root.eco['tg_'+V].dailyDay=Math.floor(now/86400000)-1;ok((await call(V,'/api/conquest/session')).state.airdrop.view.dailyPts===0,'yesterday\'s total is never shown as today\'s');

// ---- the Conquest points-a-minute flag (flag only) ----
const F=8204;await call(F,'/api/sync');await call(F,'/api/conquest/session');
await creditConquest(env,'tg_'+F,[{id:1,raw:2500*30,n:{raid:30},op:1,ms:30*60000}],now);
ok(!!db.get('flags/tg_'+F)?.r?.cqppm,'2,500 base points a minute over 30 simulated minutes raises the cqppm review flag');
const G=8205;await call(G,'/api/sync');await call(G,'/api/conquest/session');
await creditConquest(env,'tg_'+G,[{id:1,raw:700*30,n:{raid:30},op:1,ms:30*60000}],now);
ok(!db.get('flags/tg_'+G),'700 a minute (an honest top rate) raises no flag');

Date.now=clock;
console.log(`conquest airdrop (worker): passed ${passed}`);
