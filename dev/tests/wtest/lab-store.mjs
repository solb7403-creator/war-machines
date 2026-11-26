// Session 6B Science Lab store (owner decision 8), OPEN since Session 8 (owner, Nov 26, 2026: LAB_STORE_OPEN true; Legendary set mods
// 1,500 Stars / 23 GRAM, one a UTC week; packs and instant finish unchanged), through the real Worker routes: every Lab item is a server
// quote (/api/order or /api/stars-invoice) checked on the server's record (on sale only after its track's set mod, one of each pack a
// week, an instant finish priced by the research job's real time left), paid through Telegram's pre-checkout and webhook or GRAM, and
// granted once; a payment naming a Lab item without a quote grants nothing; a phone can never sync the server-owned ownership
// (Legendary set mods, bonus parts, finish credits). The grants give no points and keep their sale rules inside the grant itself (review
// F5): with the switch turned off again (a test-only copy of the rules) a verified payment grants nothing. Lunar Pass premium tiers
// 10/20/30 add research parts (they start with the Lab store), never points.
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
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
t(R.LAB_STORE_OPEN === true, 'LAB_STORE_OPEN is true: the Lab store is open (Session 8, owner Nov 26)');
const X = { day: 20774, week: 2967 }, S0 = R.ecoNorm({});
const pk = R.RS_PACK_ORDER.map(k => [k, R.ecoPrice(S0, { kind: 'rspack', tk: k }, X)]);
t(pk.every(([k, p]) => p && p.stars === R.RS_PACKS[k].stars && p.ton === R.RS_PACKS[k].ton) && J(pk.map(([, p]) => [p.stars, p.ton])) === J([[99, 1.6], [249, 4], [599, 9.6]]), 'three part packs priced (unchanged): ' + pk.map(([k, p]) => R.RS_PACKS[k].n + ' ' + p.stars + ' Stars / ' + p.ton + ' GRAM').join(', '));
const legs = Object.values(R.RTREE.legendary);
t(legs.length === 4 && legs.every(id => R.ecoPrice(S0, { kind: 'rsleg', tk: id }, X)?.stars === 1500 && R.ecoPrice(S0, { kind: 'rsleg', tk: id }, X)?.ton === 23), 'four Legendary set mods priced 1,500 Stars / 23 GRAM each (the Epic crate\'s price)');
const fin = [20 * 60e3, 2 * 3600e3, 8 * 3600e3, 6 * 3600e3].map(ms => R.rsFinPrice(ms));
t(fin[0].stars === 8 && fin[1].stars === 31 && fin[2].stars === 100 && fin[3].stars < fin[2].stars, 'instant finish by time left: 20 min ' + fin[0].stars + ', 2 h ' + fin[1].stars + ', 8 h ' + fin[2].stars + ' Stars (6 h ' + fin[3].stars + ')');
t(fin[2].usd / 8 < fin[1].usd / 2 && fin[1].usd / 2 < fin[0].usd / (1 / 3) + 1e-9, 'the longer the skip, the cheaper each hour');
const ratios = [...pk.map(([, p]) => p), R.RS_LEG_PRICE, ...fin].map(p => p.stars / p.ton);
t(ratios.every(r => r > 55 && r < 70), 'Stars-to-GRAM within the shop\'s own range (Vault 62.5, Pass 61.5): ' + ratios.map(r => r.toFixed(1)).join(' '));
// ---- 2. open: Stars quotes on the server's record, the pre-checkout, the webhook ----
const { payKit } = await import('./pay.mjs');
const K = payKit({ call, hook, initData, tgCalls });
{ let [st, res] = await K.quote(P, 'STARS', { kind: 'rsleg', tk: 'starfall' });
  t(st === 409 && res.error === 'owned', 'Starfall is not on sale before its track\'s set mod (Rail) is researched (' + st + ' ' + res.error + ')');
  [st, res] = await K.quote(P, 'STARS', { kind: 'rsfin', job: 'j1' });
  t(st === 409 && res.error === 'none', 'an instant finish needs a running research job on the server (none: ' + res.error + ')'); }
// a confirmed payment naming a Lab item without a quote of ours (the old invoice payload) grants nothing
{ const r = await hook({ message: { from: { id: P.id, username: P.username }, chat: { id: P.id, type: 'private' }, successful_payment: { total_amount: 599, telegram_payment_charge_id: 'ch-lab-forged', invoice_payload: J({ u: P.id, k: 'rsleg', t: 'sunfire', g: 9.6 }) } } });
  t(r.status === 200 && snap() === before && db.get('/held/st_ch-lab-forged/err') === 'no quote', 'a confirmed Stars payment naming a Lab item without a quote grants nothing (held for the owner)'); }
{ const res = await K.stars(P, { kind: 'rspack', tk: 'kit' }, 'ch-kit');
  t(res.s === 200 && res.o.amt === 99 && res.pre.ok && R.CQ_PART_ORDER.every(k => E().bpt[k] === 1), 'Field kit: 99 Stars, +1 of every research part');
  const [st, r2] = await K.quote(P, 'STARS', { kind: 'rspack', tk: 'kit' });
  t(st === 409 && r2.error === 'owned', 'one Field kit a UTC week');
  const res2 = await K.stars(P, { kind: 'rsleg', tk: 'sunfire' }, 'ch-sun');
  t(res2.o.amt === 1500 && res2.pre.ok && E().lsm.sunfire === 1, 'Sunfire Core (Inferno researched): 1,500 Stars, owned');
  E().rm.rail = 1;
  const [st3, r3] = await K.quote(P, 'TON', { kind: 'rsleg', tk: 'starfall' });
  t(st3 === 409 && r3.error === 'limit', 'one Legendary set mod a UTC week in all (Starfall waits for next week)');
  t(E().pts === 5000, 'no Lab purchase gives points'); }
// an instant finish priced by the research job's real time left on the server (the Conquest record), never the phone's
{ const now = Date.now(); db.root.conquest = db.root.conquest || {}; db.root.conquest[pp] = { v: 1, plot: { b: { b1: { t: 'lab', i: 10, j: 10, r: 0, l: 2 } }, dmg: {} }, rs: { v: 1, jobs: [{ id: 'j1', mod: 'traction', part: 'servo', paid: { e: 2, b: 0 }, ms: 7200000, left: 7200000, at: now, st: now }] } };
  const [st, res] = await K.quote(P, 'STARS', { kind: 'rsfin', job: 'j1', left: 60000 });
  t(st === 200 && res.order.amt === R.rsFinPrice(7200000).stars, 'an instant finish quoted from the server\'s job: 2 h left = ' + res.order.amt + ' Stars (a forged time left is ignored)');
  t((await K.pre(P, res.order)).ok, 'its pre-checkout');
  await K.paid(P, res.order, 'ch-fin');
  t(E().rsx.j1 === 1, 'paid: a one-time finish credit for that job (the Conquest record finishes it at its next read)');
  const [st2, r2] = await K.quote(P, 'STARS', { kind: 'rsfin', job: 'j1' });
  t(st2 === 409 && r2.error === 'owned', 'the same job\'s finish is sold once'); }
// ---- 3. GRAM: the same quote and checks (SOL is website-only) ----
{ const [st, res] = await K.quote(P, 'TON', { kind: 'rspack', tk: 'cache' });
  t(st === 200 && res.order.amt === 9.6 && res.order.memo === 'LWM|' + pp + '|' + res.order.oid, 'a Research cache GRAM quote: 9.6 GRAM with its memo');
  await K.cancel(P, res.order.oid);
  const [st2, r2] = await K.quote(P, 'SOL', { kind: 'rspack', tk: 'cache' });
  t(st2 === 403 && r2.error === 'sol_web', 'SOL is paid on the website only'); }
// ---- 4. the phone can never write the ownership ----
const before4 = snap();
{ const [st] = await call('/api/sync', { initData: initData(P), s: { lsm: { sunfire: 1, starfall: 1 }, bpt: { thermal: 99, coil: 99, servo: 99, cap: 99 }, rsx: { j1: 1 }, pts: E().pts } });
  t(st === 200 && snap() === before4, 'a synced save cannot grant Legendary set mods, bonus parts or finish credits'); }
{ const S = R.ecoNorm(JSON.parse(J(E()))), spec = R.labSpec(R.ecoLoadout(S)), sf = R.rmodOf('starfall'), rl = R.rmodOf('rail'), v = R.labValidate(S, { ...spec, catalog: R.FIT_VERSION, mods: { [sf.slot]: 'starfall' } }), v2 = R.labValidate(S, { ...spec, catalog: R.FIT_VERSION, mods: { [rl.slot]: 'rail' } }), v3 = R.labValidate(S, { ...spec, catalog: R.FIT_VERSION, mods: { mount: 'sunfire' } });
  t(v === 'owned' && v2 !== 'owned' && v3 !== 'owned', 'the garage refuses the unowned Legendary Starfall (' + v + ') but takes the researched Rail (' + v2 + ') and the bought Sunfire (' + v3 + ')'); }
// ---- 5. the grants: server-only, no points, and the sale rules hold inside the grant itself (Session 6B review F5) ----
// the switch works both ways: a test-only copy of js/rules.js with LAB_STORE_OPEN false (the store closed again) grants nothing
const C = (() => { const ctx = vm.createContext({ console }), src = fs.readFileSync(new URL('../../../js/rules.js', import.meta.url), 'utf8');
  if (!src.includes('const LAB_STORE_OPEN=true;')) throw new Error('LAB_STORE_OPEN flag not found');
  vm.runInContext(src.replace('const LAB_STORE_OPEN=true;', 'const LAB_STORE_OPEN=false;') + '\n;globalThis.__R={ecoNorm,ecoGrant,LAB_STORE_OPEN,LAB_KINDS};', ctx); return ctx.__R; })();
{ const S = C.ecoNorm(JSON.parse(J(E()))), b0 = J(S);
  t(C.LAB_STORE_OPEN === false, 'a closed-store copy of the rules');
  for (const d of [{ kind: 'rspack', tk: 'crate', price: 4 }, { kind: 'rsleg', tk: 'starfall', price: 23 }, { kind: 'rsfin', job: 'j3', price: 1.6 }])
    t(C.ecoGrant(S, d, X).length === 0, 'Lab store closed: a verified ' + d.kind + ' payment grants nothing (ecoGrant checks it itself)');
  t(J(S) === b0 && J(C.LAB_KINDS) === J(['rspack', 'rsleg', 'rsfin']), '... and changes nothing on the record'); }
{ const O = R, S = O.ecoNorm({}), pts0 = [S.pts, S.earned, S.dailyPts, S.weeklyPts].join();
  S.rm = { inferno: 1 };
  const o1 = O.ecoGrant(S, { kind: 'rspack', tk: 'crate', price: 4 }, X);
  t(o1[0]?.tk === 'rspack' && O.CQ_PART_ORDER.every(k => S.bpt[k] === 3), 'a Lab crate adds 3 of every research part to the account\'s bonus parts');
  t(O.ecoOwned(S, { kind: 'rspack', tk: 'crate' }, X) && !O.ecoOwned(S, { kind: 'rspack', tk: 'crate' }, { ...X, week: X.week + 1 }), 'one of each pack a UTC week');
  t(O.ecoGrant(S, { kind: 'rspack', tk: 'crate', price: 4 }, X).length === 0 && O.CQ_PART_ORDER.every(k => S.bpt[k] === 3), 'a second Lab crate paid the same week grants nothing (the grant checks the weekly rule itself)');
  const S2 = O.ecoNorm({}); S2.rm = { vent: 1, overclock: 1, heatsink: 1 };
  t(O.ecoOwned(S2, { kind: 'rsleg', tk: 'sunfire' }, X) && O.ecoGrant(S2, { kind: 'rsleg', tk: 'sunfire', price: 23 }, X).length === 0 && !(S2.lsm && S2.lsm.sunfire), 'Sunfire is not on sale before its track\'s set mod (Inferno) is researched, and a paid order grants nothing');
  O.ecoGrant(S, { kind: 'rsleg', tk: 'sunfire', price: 23 }, X);
  t(S.lsm.sunfire === 1 && O.ecoOwned(S, { kind: 'rsleg', tk: 'sunfire' }, X) && O.rmodOwned(S, 'mount', 'sunfire'), 'a granted Legendary is owned on the server record and fits in the garage');
  t(O.ecoGrant(S, { kind: 'rsleg', tk: 'sunfire', price: 23 }, X).length === 0, 'a second paid order for an owned Legendary grants nothing');
  S.rm.rail = 1;
  t(O.ecoGrant(S, { kind: 'rsleg', tk: 'starfall', price: 23 }, X).length === 0 && O.ecoGrant(S, { kind: 'rsleg', tk: 'starfall', price: 23 }, { ...X, week: X.week + 1 }).length === 1, 'the grant itself holds the one-a-week rule (Starfall waits for the next UTC week)');
  O.ecoGrant(S, { kind: 'rsfin', job: 'j3', price: 1.6 }, X);
  t(S.rsx.j3 === 1 && O.ecoOwned(S, { kind: 'rsfin', job: 'j3' }, X) && O.ecoOwned(S, { kind: 'rsfin', job: '../x' }, X), 'an instant finish is a one-time credit for that job id only');
  t(O.ecoGrant(S, { kind: 'rsfin', job: 'j3', price: 1.6 }, X).length === 0 && O.ecoGrant(S, { kind: 'rsfin', job: '../x', price: 1.6 }, X).length === 0, 'the same finish paid twice, or a forged job id: nothing granted');
  t([S.pts, S.earned, S.dailyPts, S.weeklyPts].join() === pts0, 'no Lab purchase gives points');
  O.ecoRefund(S, 'rsleg', [{ tk: 'rsleg', id: 'sunfire' }]); O.ecoRefund(S, 'rspack', o1);
  t(!S.lsm.sunfire && O.CQ_PART_ORDER.every(k => S.bpt[k] === 0), 'a refund takes back the Legendary and the parts'); }
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
