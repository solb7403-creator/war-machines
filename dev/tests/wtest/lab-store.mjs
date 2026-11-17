// Session 6B Science Lab store (owner decision 8) through the real Worker routes: the entries exist with their proposed prices, and
// CHECKOUT IS OFF in every currency: no Stars invoice, a Telegram-confirmed payment naming a Lab item grants nothing, a TON payment
// log grants nothing, and a phone can never sync the server-owned ownership (Legendary set mods, bonus parts, finish credits).
// The grants themselves (for the day the owner opens checkout) only ever run from ecoGrant, give no points, and a Legendary set mod
// is on sale only after its track's earned set mod. Lunar Pass premium tiers 10/20/30 add research parts, never points.
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db = makeDB();
const tgCalls = [];
globalThis.fetch = async (url, init) => {
  if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init);
  if (url.startsWith('https://api.telegram.org/')) { const body = JSON.parse(init.body); tgCalls.push([url.split('/').pop(), body]); return new Response(JSON.stringify({ ok: true, result: url.endsWith('/createInvoiceLink') ? 'https://t.me/$inv' : true })); }
  if (url.startsWith('https://toncenter.com/')) return new Response(JSON.stringify({ ok: true, result: [] }));
  if (url.startsWith('https://api.coingecko.com/')) return new Response(JSON.stringify({ 'the-open-network': { usd: 3 }, solana: { usd: 150 } }));
  throw new Error('unexpected fetch ' + url);
};
const mod = await import('../../../worker/src/index.js');
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const worker = mod.default, env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' };
function initData(user) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest()).update(dcs).digest('hex'));
  return p.toString();
}
const call = async (path, body) => { const r = await worker.fetch(new Request('https://x' + path, { method: 'POST', headers: { Origin: 'https://solb7403-creator.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify({ gv: R.PVP_V, ...body }) }), env); return [r.status, await r.json()]; };
const act = (u, a, o) => call('/api/act', { initData: initData(u), a, ...(o || {}) });
const sec = await mod.webhookSecret(env);
const hook = (body) => worker.fetch(new Request('https://x/api/tg-webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': sec }, body: JSON.stringify(body) }), env);
const J = JSON.stringify;
let ok = 0, bad = 0; const t = (c, m) => { if (c) { ok++; console.log('PASS', m); } else { bad++; console.log('FAIL', m); } };
const P = { id: 7711, first_name: 'Lab', username: 'labstore' }, pp = 'tg_' + P.id;
await call('/api/sync', { initData: initData(P), lab: 1 });
const E = () => db.root.eco[pp];
// a pilot who has researched Thermal's earned set mod (Inferno): the Legendary Sunfire would be on sale if checkout were open
E().rm = { vent: 1, overclock: 1, heatsink: 1, inferno: 1 }; E().pts = 5000;
const snap = () => J({ lsm: E().lsm || {}, bpt: E().bpt || {}, rsx: E().rsx || {}, pts: E().pts, earned: E().earned });
const before = snap();

// ---- 1. the entries exist, priced like the shop ----
t(R.LAB_STORE_OPEN === false, 'LAB_STORE_OPEN is false: checkout off');
const X = { day: 20774, week: 2967 }, S0 = R.ecoNorm({});
const pk = R.RS_PACK_ORDER.map(k => [k, R.ecoPrice(S0, { kind: 'rspack', tk: k }, X)]);
t(pk.every(([k, p]) => p && p.stars === R.RS_PACKS[k].stars && p.ton === R.RS_PACKS[k].ton), 'three part packs priced: ' + pk.map(([k, p]) => R.RS_PACKS[k].n + ' ' + p.stars + ' Stars / ' + p.ton + ' TON').join(', '));
const legs = Object.values(R.RTREE.legendary);
t(legs.length === 4 && legs.every(id => R.ecoPrice(S0, { kind: 'rsleg', tk: id }, X)?.stars === R.RS_LEG_PRICE.stars), 'four Legendary set mods priced ' + R.RS_LEG_PRICE.stars + ' Stars / ' + R.RS_LEG_PRICE.ton + ' TON each');
const fin = [20 * 60e3, 2 * 3600e3, 8 * 3600e3, 6 * 3600e3].map(ms => R.rsFinPrice(ms));
t(fin[0].stars === 8 && fin[1].stars === 31 && fin[2].stars === 100 && fin[3].stars < fin[2].stars, 'instant finish by time left: 20 min ' + fin[0].stars + ', 2 h ' + fin[1].stars + ', 8 h ' + fin[2].stars + ' Stars (6 h ' + fin[3].stars + ')');
t(fin[2].usd / 8 < fin[1].usd / 2 && fin[1].usd / 2 < fin[0].usd / (1 / 3) + 1e-9, 'the longer the skip, the cheaper each hour');
const ratios = [...pk.map(([, p]) => p), R.RS_LEG_PRICE, ...fin].map(p => p.stars / p.ton);
t(ratios.every(r => r > 55 && r < 70), 'Stars-to-TON within the shop\'s own range (Vault 62.5, Pass 61.5): ' + ratios.map(r => r.toFixed(1)).join(' '));
// ---- 2. checkout off: Stars ----
for (const body of [{ kind: 'rspack', tk: 'kit' }, { kind: 'rspack', tk: 'cache' }, { kind: 'rsleg', tk: 'sunfire' }, { kind: 'rsfin', tk: 'j1' }]) {
  tgCalls.length = 0; const [st, res] = await call('/api/stars-invoice', { initData: initData(P), ...body });
  t(st === 400 && res.error === 'item' && !tgCalls.some(c => c[0] === 'createInvoiceLink'), 'no Stars invoice for ' + body.kind + ':' + body.tk + ' (' + st + ' ' + res.error + ')');
}
// a payment Telegram confirmed (secret-signed webhook) that names a Lab item grants nothing
let n = 0;
for (const pl of [{ u: P.id, k: 'rsleg', t: 'sunfire', g: 9.6 }, { u: P.id, k: 'rspack', t: 'cache', g: 9.6 }, { u: P.id, k: 'rsfin', t: 'j1' }]) {
  const r = await hook({ message: { from: { id: P.id, username: P.username }, chat: { id: P.id, type: 'private' }, successful_payment: { total_amount: 599, telegram_payment_charge_id: 'ch-lab-' + (++n), invoice_payload: J(pl) } } });
  t(r.status === 200 && snap() === before, 'a confirmed Stars payment naming ' + pl.k + ' grants nothing');
}
// ---- 3. checkout off: TON / SOL ----
{ const [st, res] = await call('/api/pay-log', { initData: initData(P), cur: 'TON', amt: 9.6, memo: 'LWM|' + pp + '|lab1', item: 'Sunfire', desc: { kind: 'rsleg', tk: 'sunfire' } });
  t(st === 200 && !res.out && snap() === before, 'a TON payment log for a Lab item is only logged, never granted (' + J(res) + ')'); }
{ const [st, res] = await call('/api/pay-log', { initData: initData(P), cur: 'SOL', amt: 0.2, gram: 9.6, memo: 'LWM|' + pp + '|lab2', proof: 'x', item: 'Research cache', desc: { kind: 'rspack', tk: 'cache' } });
  t(st === 200 && !res.out && snap() === before, 'a SOL payment log for a Lab item is only logged, never granted'); }
// ---- 4. the phone can never write the ownership ----
{ const [st] = await call('/api/sync', { initData: initData(P), s: { lsm: { sunfire: 1, starfall: 1 }, bpt: { thermal: 99, coil: 99, servo: 99, cap: 99 }, rsx: { j1: 1 }, pts: E().pts } });
  t(st === 200 && snap() === before, 'a synced save cannot grant Legendary set mods, bonus parts or finish credits'); }
{ const S = R.ecoNorm(JSON.parse(J(E()))), spec = R.labSpec(R.ecoLoadout(S)), v = R.labValidate(S, { ...spec, catalog: R.FIT_VERSION, mods: { mount: 'sunfire' } }), v2 = R.labValidate(S, { ...spec, catalog: R.FIT_VERSION, mods: { mount: 'inferno' } });
  t(v === 'owned' && v2 !== 'owned', 'the garage refuses the unowned Legendary Sunfire (' + v + ') but takes the researched Inferno (' + v2 + ')'); }
// ---- 5. the grants (for the day checkout opens): server-only, no points ----
{ const S = R.ecoNorm(JSON.parse(J(E()))), pts0 = [S.pts, S.earned, S.dailyPts, S.weeklyPts].join();
  const o1 = R.ecoGrant(S, { kind: 'rspack', tk: 'crate', price: 4 }, X);
  t(o1[0]?.tk === 'rspack' && R.CQ_PART_ORDER.every(k => S.bpt[k] === 3), 'a Lab crate adds 3 of every research part to the account\'s bonus parts');
  t(R.ecoOwned(S, { kind: 'rspack', tk: 'crate' }, X) && !R.ecoOwned(S, { kind: 'rspack', tk: 'crate' }, { ...X, week: X.week + 1 }), 'one of each pack a UTC week');
  const S2 = R.ecoNorm({}); S2.rm = { vent: 1, overclock: 1, heatsink: 1 };
  t(R.ecoOwned(S2, { kind: 'rsleg', tk: 'sunfire' }, X), 'Sunfire is not on sale before its track\'s set mod (Inferno) is researched');
  R.ecoGrant(S, { kind: 'rsleg', tk: 'sunfire', price: 9.6 }, X);
  t(S.lsm.sunfire === 1 && R.ecoOwned(S, { kind: 'rsleg', tk: 'sunfire' }, X) && R.rmodOwned(S, 'mount', 'sunfire'), 'a granted Legendary is owned on the server record and fits in the garage');
  R.ecoGrant(S, { kind: 'rsfin', job: 'j3', price: 1.6 }, X);
  t(S.rsx.j3 === 1 && R.ecoOwned(S, { kind: 'rsfin', job: 'j3' }, X) && R.ecoOwned(S, { kind: 'rsfin', job: '../x' }, X), 'an instant finish is a one-time credit for that job id only');
  t([S.pts, S.earned, S.dailyPts, S.weeklyPts].join() === pts0, 'no Lab purchase gives points');
  R.ecoRefund(S, 'rsleg', [{ tk: 'rsleg', id: 'sunfire' }]); R.ecoRefund(S, 'rspack', o1);
  t(!S.lsm.sunfire && R.CQ_PART_ORDER.every(k => S.bpt[k] === 0), 'a refund takes back the Legendary and the parts'); }
// ---- 6. Lunar Pass premium tiers add research parts, never points (the real claim route) ----
{ const Xn = { day: Math.floor(Date.now() / 864e5) }, sn = R.ecoSeason ? R.ecoSeason(Xn) : null;
  E().pass = { s: sn, xp: R.PASS_XP * 12, prem: true, cf: [], cp: [] };
  const bp0 = { ...(E().bpt || {}) }, pts0 = E().pts;
  let [st, res] = await act(P, 'pass', { t: 'p', i: 10, c: 'vanguard' });
  const got = R.CQ_PART_ORDER.map(k => (E().bpt?.[k] | 0) - (bp0[k] | 0));
  t(st === 200 && got.every(v => v === (R.LAB_STORE_OPEN ? 1 : 0)) && E().pts === pts0, 'premium tier 10: its reward' + (R.LAB_STORE_OPEN ? ' plus 1 of each research part' : ' only while the Lab store is closed (the parts start with the store)') + ', no points (' + got.join(',') + ')');
  t(R.passPartsAt(10, true) === 1 && R.passPartsAt(20, true) === 1 && R.passPartsAt(5, true) === 0 && R.passPartsAt(10, false) === 0, 'when the Lab store opens: 1 of each part on premium tiers 10, 20, 30');
  [st, res] = await act(P, 'pass', { t: 'p', i: 5, c: 'vanguard' });
  t(st === 200 && R.CQ_PART_ORDER.every(k => (E().bpt?.[k] | 0) - (bp0[k] | 0) === (R.LAB_STORE_OPEN ? 1 : 0)), 'premium tier 5 gives its reward only');
  [st, res] = await act(P, 'pass', { t: 'f', i: 10, c: 'vanguard' });
  t(st === 200 && R.CQ_PART_ORDER.every(k => (E().bpt?.[k] | 0) - (bp0[k] | 0) === (R.LAB_STORE_OPEN ? 1 : 0)), 'the free track never gives research parts');
  t(J(Object.keys(R.PASS_PREM_PARTS).map(Number)) === J([10, 20, 30]) && R.RTREE.slots.pass === 1 && R.RTREE.passTime === 0.75, 'premium perks: research parts on tiers 10, 20, 30; +1 research slot; jobs 25% faster');
  t(R.PASS_PREM.every(r => !r || r.k !== 'pts'), 'the premium track still never gives points'); }
console.log((bad ? 'FAIL' : 'PASS') + ' wtest lab-store: ' + ok + ' passed, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
