import assert from 'node:assert/strict';
import {makeDB} from './wtest/fakedb.mjs';
import {syncWarfront} from '../../worker/src/conquest-warfront.js';
const db=makeDB({pruneEmptyUnder:['conquestWarfront']});
globalThis.fetch=async(url,init)=>{assert(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'));return db.handle(url,init);};
const env={FIREBASE_DB_SECRET:'SECRET'};
let v=await syncWarfront(env,'tg_test1',0,1000);assert.equal(v.participants,0);assert.equal(v.score,0);
const replies=await Promise.all(Array.from({length:8},(_,i)=>syncWarfront(env,'tg_test1',10,1001+i)));assert(replies.every(r=>r.score===10));assert.equal(db.get('conquestWarfront/frontier-v1').score,10);assert.equal(db.get('conquestWarfront/frontier-v1').participants,1);
await Promise.all(Array.from({length:8},(_,i)=>syncWarfront(env,'tg_other'+i,20,2000+i)));v=await syncWarfront(env,'tg_test1',10,3000);assert.equal(v.score,170);assert.equal(v.participants,9);
v=await syncWarfront(env,'tg_test1',1010,4000);assert.equal(v.score,1170);assert.equal(v.stage,1);assert.equal(v.participants,9);assert.equal(v.worldBossAvailable,false);
v=await syncWarfront(env,'tg_test1',10,5000);assert.equal(v.score,1170,'historical retry never subtracts');
await assert.rejects(syncWarfront(env,'tg_test1',-1,5000),/invalid/);assert(!('contributions' in v),'public view omits player identifiers');
console.log('PASS real Firebase-shaped shared CAS: eight-way same-pilot replay, eight distinct pilots, exact monotonic totals, truthful participants and private contribution ledger');
const {persistWarfront}=await import('../../worker/src/conquest-warfront.js');
await db.handle('https://warmachines-a6034-default-rtdb.firebaseio.com/conquest/tg_projection.json?auth=SECRET',{method:'PUT',body:JSON.stringify({v:1,seq:73,ledger:{cp:417,banked:{alloy:42}},achievements:{original:123}})});
const stage1={id:'frontier-v1',stage:1,score:1000},stage2={id:'frontier-v1',stage:2,score:2000};await Promise.all([persistWarfront(env,'tg_projection',stage2,6000),persistWarfront(env,'tg_projection',stage1,6001)]);let p=db.get('conquest/tg_projection');assert.equal(p.seq,73);assert.equal(p.ledger.cp,417);assert.equal(p.ledger.banked.alloy,42);assert.equal(p.achievements.original,123);assert.equal(p.warfront.stage,2,'late projection never lowers stored stage');assert(p.campaignHistory['frontier-v1:1']);assert(p.campaignHistory['frontier-v1:2']);const stamp=p.campaignHistory['frontier-v1:1'].at;await persistWarfront(env,'tg_projection',stage1,7000);p=db.get('conquest/tg_projection');assert.equal(p.campaignHistory['frontier-v1:1'].at,stamp);assert.equal(p.warfront.stage,2);
console.log('PASS shared milestone metadata CAS preserves latest sequence/balances/history during out-of-order concurrent projections');
// Bounded read load: a pilot with no new contribution is served this isolate's newest aggregate for up to 30s instead of a
// shared-document read on every request; any score increase, or an expired cache, reads and CASes again.
{const envB={FIREBASE_DB_SECRET:'SECRET'},inner=globalThis.fetch;let reads=0;globalThis.fetch=async(url,init)=>{if(!init?.method||init.method==='GET')reads++;return inner(url,init);};
 const t0=10000000;let w=await syncWarfront(envB,'tg_cache',5,t0);const base=reads;for(let i=1;i<=6;i++)w=await syncWarfront(envB,'tg_cache',5,t0+i*1000);assert.equal(reads,base,'unchanged score served from cache');
 w=await syncWarfront(envB,'tg_cache',9,t0+7000);assert(reads>base,'new contribution reads and writes');assert.equal(db.get('conquestWarfront/frontier-v1').contributions.tg_cache,9);
 const before=reads;await syncWarfront(envB,'tg_cache',9,t0+40000);assert(reads>before,'cache expires after 30s');globalThis.fetch=inner;}
console.log('PASS warfront projection reads are bounded per isolate without delaying real contributions');
