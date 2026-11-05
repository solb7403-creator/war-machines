import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';buildSim();
const db=makeDB({pruneEmptyUnder:['conquest','conquestWarfront']});
globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))return db.handle(url,init);throw Error('Unexpected external request');};
const {default:worker}=await import('../../../worker/src/index.js');
const {CONQUEST:{Combat:C}}=await import('../../../worker/src/sim.gen.js');
const env={BOT_TOKEN:'conquest-war-test',FIREBASE_DB_SECRET:'SECRET'};let now=Date.now();const original=Date.now;Date.now=()=>now;
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test/api/conquest/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:4,initData:id?auth(id):'',...body})}),env);return {status:r.status,...await r.json()};}
assert.equal((await call(null,'session')).status,401);
const pilot=9111;const first=await call(pilot,'session');assert.equal(first.status,200);assert.equal(first.state.warfront.participants,0);
let s=db.get('conquest/tg_'+pilot);s.position={x:C.baseDefinition.x,z:C.baseDefinition.z,y:0,surface:'ground'};s.base.tier=1;s.base.builtAt=now;s.base.defense.alertAt=now;s.battle.enemies=[];
const body={seq:s.seq+1,action:'start-defense'};const starts=await Promise.all([call(pilot,'action',body),call(pilot,'action',body)]);assert(starts.every(r=>r.status===200));assert.equal(starts.filter(r=>r.replayed).length,1);assert.equal(starts[0].state.mission,'base-defense');assert.equal(db.get('conquest/tg_'+pilot).attempt,1);
assert.equal((await call(pilot,'action',{seq:2,action:'start-defense',mission:'forged'})).status,400);
assert.equal((await call(pilot,'action',{seq:2,action:'defense-config',module:'drone',cost:0})).status,400);
assert.equal((await call(pilot,'action',{seq:2,action:'equip-cosmetic',item:'not-an-item',paid:true})).status,400);
const end=await call(pilot,'action',{seq:2,action:'return-exploration'});assert.equal(end.status,200);assert.equal(end.state.base.defense.report.stolen,0);assert(end.state.base.defense.damage>0);
s=db.get('conquest/tg_'+pilot);s.campaignScore=23;const projected=await Promise.all([call(pilot,'session'),call(pilot,'session')]);assert(projected.every(r=>r.state.warfront.score===23));assert.equal(db.get('conquestWarfront/frontier-v1').score,23);assert.equal(projected[0].state.warfront.participants,1);
s=db.get('conquest/tg_'+pilot);s.position={x:C.operations[C.raidIds[0]].x,z:C.operations[C.raidIds[0]].z,y:0,surface:'ground'};s.battle.enemies=[];const raid=await call(pilot,'action',{seq:3,action:'start-mission',mission:C.raidIds[0]});assert.equal(raid.status,200);assert(!('raidRoll' in raid.state));assert(!('raidReceipts' in raid.state));assert(Number.isInteger(db.get('conquest/tg_'+pilot).raidRoll.value));assert.equal((await call(pilot,'action',{seq:4,action:'bank',campaignScore:100000})).status,400);
assert.equal((await call(pilot,'action',{seq:4,action:'start-defense',pid:'tg_victim'})).status,400);
Date.now=original;
console.log('PASS authenticated defense CAS start race, strict forgery rejection, fair retreat, aggregate exactly once and hidden precommitted raid roll');
// A request rejected by the rate gate must not project its uncommitted reward.
Date.now=()=>now;const limited=db.get('conquest/tg_'+pilot);limited.battle.state='victory';limited.settlement=null;const priorScore=limited.campaignScore,globalScore=db.get('conquestWarfront/frontier-v1').score;now+=1000;limited.rate={m:Math.floor(now/60000),n:90};
const rejected=await call(pilot,'input',{seq:limited.seq+1,commands:[{x:0,z:0}]});assert.equal(rejected.status,429);assert.equal(db.get('conquest/tg_'+pilot).campaignScore,priorScore);assert.equal(db.get('conquestWarfront/frontier-v1').score,globalScore,'uncommitted settlement cannot affect humanity total');assert.equal(rejected.state.campaignScore,priorScore,'rate rejection only exposes committed state');Date.now=original;
console.log('PASS rate-rejected uncommitted settlement never reaches shared campaign or response balances');
Date.now=()=>now;const participant=db.get('conquest/tg_'+pilot);participant.rate={m:Math.floor(now/60000),n:0};participant.campaignScore=1023;
const milestone=await call(pilot,'session');assert.equal(milestone.state.warfront.stage,1);assert.equal(milestone.state.warfront.monument.unlocked,true);assert(milestone.state.campaignHistory['frontier-v1:1']);assert(db.get('conquest/tg_'+pilot).campaignHistory['frontier-v1:1'],'shared stage receipt persisted in pilot CAS');assert(db.get('conquest/tg_'+pilot).achievements['campaign-stage-1']);const at=db.get('conquest/tg_'+pilot).campaignHistory['frontier-v1:1'].at;now+=1000;await call(pilot,'session');assert.equal(db.get('conquest/tg_'+pilot).campaignHistory['frontier-v1:1'].at,at);Date.now=original;
console.log('PASS shared milestone persists immutable campaign history and achievement with real world monument unlock');
