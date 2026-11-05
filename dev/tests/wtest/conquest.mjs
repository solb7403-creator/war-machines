import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({pruneEmptyUnder:['conquest']});
globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))return db.handle(url,init);throw Error('Unexpected external request');};
const {default:worker}=await import('../../../worker/src/index.js');
const env={BOT_TOKEN:'conquest-test',FIREBASE_DB_SECRET:'SECRET'};
let now=Date.now();const clock=Date.now;Date.now=()=>now;
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:4,initData:id?auth(id):'',...body})}),env);const text=await r.text();return {status:r.status,...(text.startsWith('{')?JSON.parse(text):{error:text})};}
assert.equal((await call(null,'/api/conquest/session')).status,401);
await call(8101,'/api/sync');await call(8102,'/api/sync');
let r=await call(8101,'/api/conquest/session');assert.equal(r.status,200);assert(r.state,'authenticated server state created');
assert.equal(db.get('conquest/tg_8101').base.modules,undefined,'Firebase omits the empty module map');assert.equal((await call(8101,'/api/conquest/session')).status,200,'next authenticated request hydrates the persisted Firebase shape');
const start=structuredClone(r.state),protectedBefore=structuredClone(db.get('eco/tg_8101'));
assert.equal((await call(8101,'/api/conquest/input',{seq:1,commands:[{x:102,z:0}]})).status,400);
assert.equal((await call(8101,'/api/conquest/input',{seq:1,commands:[{x:1,z:0}]})).status,409,'no elapsed budget');
now+=100;
const body={seq:1,commands:[{x:1,z:0}]};const both=await Promise.all([call(8101,'/api/conquest/input',body),call(8101,'/api/conquest/input',body)]);
assert(both.every(x=>x.status===200));assert.equal(both[0].state.seq,1);assert.equal(both[1].state.position.x,both[0].state.position.x,'lost reply/concurrent retry never repeats movement');
assert(both.every(x=>x.state.base.modules&&typeof x.state.base.modules==='object'),'a cached Firebase replay must restore the public empty module map too');
r=await call(8101,'/api/conquest/input',{seq:1,commands:[{x:-1,z:0}]});assert.equal(r.status,409,'same sequence changed payload rejected');
assert.equal((await call(8101,'/api/conquest/input',{seq:2,commands:[{x:0,z:0}],hp:999999})).status,400);
assert.equal((await call(8101,'/api/conquest/input',{...body,pid:'tg_8102'})).status,400);
assert.equal(db.get('conquest/tg_8102'),null,'cannot mutate another account');
const stored=db.get('conquest/tg_8101');stored.hp=87;stored.battle.playerHp=87;
r=await call(8101,'/api/conquest/session');assert.equal(r.state.hp,87,'re-entering does not reset HP');
assert.equal(r.state.position.x,stored.position.x);assert.equal(r.state.seq,1);
for(const key of ['pts','earned','up','buys','wOwn','cOwn','gemLvl','gemShards'])assert.deepEqual(db.get('eco/tg_8101')[key],protectedBefore[key],key+' unchanged');
assert.equal((await call(null,'/api/conquest/action',{seq:1,action:'start-mission'})).status,401);
assert.equal((await call(8101,'/api/conquest/action',{seq:2,action:'start-mission'})).status,409,'server position controls activation');
const near=db.get('conquest/tg_8101');near.position={x:1163,z:1132,y:0,surface:'ground'};
r=await call(8101,'/api/conquest/action',{seq:2,action:'start-mission'});assert.equal(r.status,200);assert.equal(r.state.hp,87);assert.equal(r.state.battle.playerHp,87);
assert.equal((await call(8101,'/api/conquest/action',{seq:3,action:'return-exploration',victory:true})).status,400);
const active=db.get('conquest/tg_8101');active.hp=11;active.battle.playerHp=11;
r=await call(8101,'/api/conquest/action',{seq:3,action:'return-exploration'});assert.equal(r.status,200);assert.equal(r.state.hp,11);assert.equal(r.state.battle.playerHp,11);assert(!r.state.completed?.['oxygen-line']);
const again=await call(8101,'/api/conquest/action',{seq:3,action:'return-exploration'});assert.equal(again.status,200);assert(again.replayed);assert.equal(again.state.hp,11);
console.log('PASS authenticated Conquest state, finite movement, wall budget, concurrent idempotency, HP reload, identity isolation and economy preservation');
// Only test-owned Firebase fixtures are seeded; production requests never accept these values.
const vault=db.get('conquest/tg_8101');vault.position={x:1174,z:1168,y:0,surface:'ground'};vault.drops=[{id:'test-corpse',...vault.position,amount:{cp:18,alloy:11,biomass:7,helium:3},expires:now+300000}];now+=100;
const pickup={seq:4,commands:[{x:0,z:0}]};const pickups=await Promise.all([call(8101,'/api/conquest/input',pickup),call(8101,'/api/conquest/input',pickup)]);assert(pickups.every(x=>x.status===200));assert.equal(pickups[0].state.ledger.cp,18);assert.equal(pickups[1].state.ledger.cargo.alloy,11);
const banked=await Promise.all([call(8101,'/api/conquest/action',{seq:5,action:'bank'}),call(8101,'/api/conquest/action',{seq:5,action:'bank'})]);assert(banked.every(x=>x.status===200));assert.equal(banked[0].state.ledger.banked.alloy,11);assert.equal(banked[1].state.ledger.cargo.alloy,0);assert.equal(db.get('conquest/tg_8101').ledger.cp,18);
const other=await call(8102,'/api/conquest/session');assert.equal(other.state.ledger.cp,0);assert.equal(other.state.ledger.banked.alloy,0);assert.equal((await call(8102,'/api/conquest/action',{seq:1,action:'bank',position:vault.position})).status,400);
assert.deepEqual(db.get('eco/tg_8101'),protectedBefore,'all legacy economy/paid/account fields unchanged');
// Trusted server legacy state migration is supported, never localStorage wins.
await call(8103,'/api/sync');db.get('eco/tg_8103').cqState={...structuredClone(start),hp:77,battle:{...structuredClone(start.battle),playerHp:77}};const migrated=await call(8103,'/api/conquest/session');assert.equal(migrated.state.hp,77);
console.log('PASS atomic concurrent pickup/banking, canonical account ownership, complete legacy economy isolation and trusted-state migration');

// Two tabs compete on the same CAS sequence, retry commits once.
const eng=db.get('conquest/tg_8101');eng.mission=null;eng.battle.enemies=[];eng.position={x:1174,z:1168,y:0,surface:'ground'};eng.ledger.cp=100;eng.ledger.banked={alloy:4,biomass:2,helium:0};eng.battle.heat=80;eng.battle.dashCd=2;
const seq=eng.seq+1,buy={seq,action:'buy-upgrade',upgrade:'heatCapacity'};
const race=await Promise.all([call(8101,'/api/conquest/action',buy),call(8101,'/api/conquest/action',{...buy,upgrade:'heatCooling'})]);
assert.equal(race.filter(x=>x.status===200).length,1);assert.equal(race.filter(x=>x.status===409).length,1);
const won=race.find(x=>x.status===200).state;assert.equal(won.ledger.cp,0);assert.equal(won.ledger.banked.alloy,0);assert.equal(won.battle.heat,80);assert.equal(won.battle.dashCd,2);
const winner=won.engineering.ranks.heatCapacity?'heatCapacity':'heatCooling';const retry=await call(8101,'/api/conquest/action',{...buy,upgrade:winner});assert(retry.replayed);assert.equal(retry.state.ledger.cp,0);
assert.equal((await call(8101,'/api/conquest/action',{seq:seq+1,action:'buy-upgrade',upgrade:'heatCapacity',price:0})).status,400);
assert.equal((await call(8101,'/api/conquest/action',{seq:seq+1,action:'buy-upgrade',upgrade:'bulletRange'})).status,409);
assert.deepEqual(db.get('eco/tg_8101'),protectedBefore);console.log('PASS engineering CAS race, duplicate response, insufficient banked funds and price forgery');

Date.now=clock;

Date.now=()=>now;
// Personal base construction, competing tabs and production claims share the same account CAS.
const {CONQUEST:{Combat:C}}=await import('../../../worker/src/sim.gen.js');
const bs=db.get('conquest/tg_8101'),D=C.baseDefinition;bs.mission=null;bs.battle.enemies=[];bs.position={x:D.x,z:D.z,y:0,surface:'ground'};bs.ledger.cp=100000;bs.ledger.banked={alloy:10000,biomass:10000,helium:10000};
const priorCP=bs.ledger.cp,baseSeq=bs.seq+1,build={seq:baseSeq,action:'build-base'};
const builds=await Promise.all([call(8101,'/api/conquest/action',build),call(8101,'/api/conquest/action',build)]);
assert(builds.every(r=>r.status===200),JSON.stringify(builds.map(r=>({status:r.status,error:r.error}))));assert.equal(db.get('conquest/tg_8101').ledger.cp,priorCP-D.recipe.cp);assert.equal(db.get('conquest/tg_8101').base.tier,1);
assert.equal((await call(8101,'/api/conquest/action',{seq:baseSeq+1,action:'upgrade-base',price:0})).status,400);
assert.equal((await call(8102,'/api/conquest/action',{seq:other.state.seq+1,action:'base-claim'})).status,409);
// Advance only the disposable fixture's production clock; no public API permits this.
const built=db.get('conquest/tg_8101');built.base.claimedAt=now-86400001;const beforeClaim=built.ledger.cp,claim={seq:built.seq+1,action:'base-claim'};
const claims=await Promise.all([call(8101,'/api/conquest/action',claim),call(8101,'/api/conquest/action',claim)]);assert(claims.every(r=>r.status===200));assert.equal(claims.filter(r=>r.replayed).length,1);assert.equal(claims[0].state.ledger.cp,claims[1].state.ledger.cp);assert(claims[0].state.ledger.cp>beforeClaim);
assert.equal((await call(8101,'/api/conquest/action',{seq:claim.seq+1,action:'base-claim'})).status,409);assert.deepEqual(db.get('eco/tg_8101'),protectedBefore);
console.log('PASS base construction/production CAS duplicate requests, physical ownership, forged prices and unchanged legacy economy');

Date.now=clock;
