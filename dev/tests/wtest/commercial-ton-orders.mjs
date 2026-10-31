// Local CAS fixtures only: no provider calls, wallets, invoices or live database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDB } from './fakedb.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const mod = await import('../../../worker/src/ton-orders.js');
const env = { FIREBASE_DB_SECRET: 'SECRET' };
const now = Date.UTC(2026, 9, 31, 12);
const pid = 'ln_1000000000001';
const request = (n = 'a', desc = {kind:'vault', tk:'chest'}) => ({requestId:n.repeat(32), desc});
let db, outage;
function reset() {
  db=makeDB(); outage=false;
  globalThis.fetch=async (url, init={}) => {
    assert.ok(url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'), 'all external providers forbidden');
    if(outage && init.method==='PUT') return new Response('{}',{status:503});
    return db.handle(url,init);
  };
}
test('server order issuer exists', () => assert.equal(typeof mod.issueTonOrder,'function'));
// Each case runs serially against a fresh conditional-write fixture.
test('immutable order uses server price, recipient, buyer, memo and expiration', async () => {
  reset();
  const input={...request(),amt:0,recipient:'attacker',memo:'old',pid:'tg_999',price:{ton:0}};
  const {order}=await mod.issueTonOrder(env,pid,input,now);
  assert.match(order.id,/^[a-f0-9]{32}$/);
  assert.equal(order.buyer,pid); assert.equal(order.currency,'TON');
  assert.equal(order.recipient,'UQAq3MBfPQ7Wqo5kL7631yEDKf2E9GOmZdhOfLUWhUiACfzu');
  assert.equal(order.amountNano,'16000000000');
  assert.equal(order.memo,'LWM2|TON|'+order.id);
  assert.equal(order.expires,now+600000);
  assert.deepEqual(db.get(`/eco/${pid}/tonOrders/${order.id}`),order);
  assert.equal(db.get(`/eco/${pid}/vg`)||0,0);
  assert.equal(db.get('/meta/revc'),null);
});
test('retry after lost response returns the exact same persisted order', async () => {
  reset(); const a=await mod.issueTonOrder(env,pid,request(),now);
  const b=await mod.issueTonOrder(env,pid,request(),now+1000);
  assert.deepEqual(b.order,a.order); assert.equal(b.duplicate,true);
});
test('idempotency key cannot change the goods', async () => {
  reset(); await mod.issueTonOrder(env,pid,request(),now);
  assert.equal((await mod.issueTonOrder(env,pid,request('a',{kind:'skin'}),now)).error,'request_conflict');
});
test('two competing orders reserve only one account checkout via CAS', async () => {
  reset(); const result=await Promise.all([
    mod.issueTonOrder(env,pid,request('a'),now),mod.issueTonOrder(env,pid,request('b'),now)
  ]);
  assert.equal(result.filter(r=>r.order).length,1);
  assert.equal(result.filter(r=>r.error==='pending').length,1);
  assert.equal(Object.keys(db.get(`/eco/${pid}/tonOrders`)).length,1);
  assert.ok(db.conflicts>0);
});
test('concurrent retries create only one immutable order', async () => {
  reset(); const [a,b]=await Promise.all([mod.issueTonOrder(env,pid,request(),now),mod.issueTonOrder(env,pid,request(),now)]);
  assert.equal(a.order.id,b.order.id);
  assert.equal(Object.keys(db.get(`/eco/${pid}/tonOrders`)).length,1);
});
test('expiration releases reservation but preserves old order for late-paid review', async () => {
  reset(); const a=await mod.issueTonOrder(env,pid,request(),now);
  const b=await mod.issueTonOrder(env,pid,request('b'),now+600000);
  assert.notEqual(b.order.id,a.order.id);
  assert.deepEqual(db.get(`/eco/${pid}/tonOrders/${a.order.id}`),a.order);
  assert.equal((await mod.inspectTonOrder(env,pid,a.order.id,now+600000)).status,'expired');
});
test('request replay never extends expiration or replaces expired order', async () => {
  reset(); const a=await mod.issueTonOrder(env,pid,request(),now);
  const b=await mod.issueTonOrder(env,pid,request(),now+700000);
  assert.deepEqual(b.order,a.order);
});
test('different account cannot inspect or reuse another account order', async () => {
  reset(); const a=await mod.issueTonOrder(env,pid,request(),now);
  assert.equal((await mod.inspectTonOrder(env,'ln_1000000000002',a.order.id,now)).error,'not_found');
});
test('owned and malformed goods are refused before reservation', async () => {
  reset(); db.root.eco={[pid]:{moonbeam:true}};
  assert.equal((await mod.issueTonOrder(env,pid,request('a',{kind:'moonbeam'}),now)).error,'ineligible');
  for(const desc of [{kind:'box',tk:'gem',ri:99},{kind:'paint',id:'invalid'},{kind:'vault',tk:'bad'},{kind:'free'}])
    assert.equal((await mod.issueTonOrder(env,pid,request('a',desc),now)).error,'descriptor');
  assert.equal(db.get(`/eco/${pid}/tonOrders`),null);
});
test('changed ownership retains quote and reports review without delivery', async () => {
  reset(); const {order}=await mod.issueTonOrder(env,pid,request('a',{kind:'moonbeam'}),now);
  db.root.eco[pid].moonbeam=true;
  assert.equal((await mod.inspectTonOrder(env,pid,order.id,now)).status,'review');
  assert.deepEqual(db.get(`/eco/${pid}/tonOrders/${order.id}`),order);
});
test('daily deal use and period changes require review', async () => {
  reset(); const {order}=await mod.issueTonOrder(env,pid,request('a',{kind:'box',tk:'gem',ri:1,deal:'d'}),now);
  db.root.eco[pid].dealD=order.day;
  assert.equal((await mod.inspectTonOrder(env,pid,order.id,now)).status,'review');
  delete db.root.eco[pid].dealD;
  assert.equal((await mod.inspectTonOrder(env,pid,order.id,now+86400000)).status,'review');
});
test('existing Stars precheckout reservation blocks issuance', async () => {
  reset(); db.root.eco={[pid]:{starCheckout:{n:'old',until:now+600000}}};
  assert.equal((await mod.issueTonOrder(env,pid,request(),now)).error,'pending');
});
test('failed persistence never returns a payable order', async () => {
  reset(); outage=true;
  await assert.rejects(mod.issueTonOrder(env,pid,request(),now),/db put/);
  assert.equal(db.get(`/eco/${pid}/tonOrders`),null);
});
test('invalid account or request key cannot address arbitrary database paths', async () => {
  reset();
  assert.equal((await mod.issueTonOrder(env,'../other',request(),now)).error,'buyer');
  assert.equal((await mod.issueTonOrder(env,pid,{...request(),requestId:'../bad'},now)).error,'request');
});

test('capacity refuses issuance without deleting historical orders', async () => {
  reset();
  const {order}=await mod.issueTonOrder(env,pid,request(),now);
  const orders=db.root.eco[pid].tonOrders;
  for(let i=1;i<32;i++) {
    const id=i.toString(16).padStart(32,'0');
    orders[id]={...order,id,requestId:id};
  }
  const before=JSON.stringify(orders);
  assert.equal((await mod.issueTonOrder(env,pid,request('f'),now+600000)).error,'capacity');
  assert.equal(JSON.stringify(db.root.eco[pid].tonOrders),before);
});
test('expired Stars reservation does not block an otherwise eligible order', async () => {
  reset(); db.root.eco={[pid]:{starCheckout:{n:'old',until:now}}};
  assert.ok((await mod.issueTonOrder(env,pid,request(),now)).order);
});
test('period-bound pass inspection never presents a new season as the purchased season', async () => {
  reset(); const {order}=await mod.issueTonOrder(env,pid,request('a',{kind:'pass'}),now);
  assert.equal((await mod.inspectTonOrder(env,pid,order.id,now+365*86400000)).status,'review');
  assert.deepEqual(db.get(`/eco/${pid}/tonOrders/${order.id}`),order);
});
