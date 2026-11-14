// Per-chassis builds and cores (Session 5E-2b3, owner Nov 14 2026) through the real Worker routes: each chassis class has its
// own upgrade build (budget and reset per chassis) and its own seven cores; points buy every gem cache (Epic included) at one
// points-per-Star rate and a chosen core at 1.5x; paid gem caches and chosen cores name their chassis (Stars invoice -> webhook ->
// grant -> refund); old records move their one shared build to the chassis they fly, the owner's to all three; loadouts, match
// tickets, the Lab and power follow the fielded chassis.
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db = makeDB();
const tgCalls = [];
globalThis.fetch = async (url, init) => {
  if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init);
  if (url.startsWith('https://api.telegram.org/')) { const body = JSON.parse(init.body); tgCalls.push([url.split('/').pop(), body]); return new Response(JSON.stringify({ ok: true, result: url.endsWith('/createInvoiceLink') ? 'https://t.me/$inv' : true })); }
  throw new Error('unexpected fetch ' + url);
};
const mod = await import('../../../worker/src/index.js');
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const { OWNER_PID } = await import('../../../worker/src/owner.js');
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
const E = (pid) => db.get('/eco/' + pid), J = JSON.stringify;
let ok = 0, bad = 0; const t = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const sum = (o) => Object.values(o || {}).reduce((a, v) => a + (v | 0), 0);

// ---- 1. old records: the one shared build moves to the chassis flown; the owner's to all three ----
const legacy = (c) => ({ mig: 1, pts: 5000, earned: 90000, wOwn: { pulse: [0] }, cOwn: { vanguard: [0], titan: [1] }, roll: { 'titan:1': 1.07 }, paints: { stock: 1 },
  up: { hull: 3, cannon: 4, engine: 1, target: 0, reactor: 2 }, gemLvl: { dmg: 4, rof: 3, arm: 5, spd: 1, lck: 1, reg: 2, vel: 1 }, gemShards: { dmg: 7, rof: 2, arm: 9, spd: 0, lck: 1, reg: 0, vel: 0 },
  L: { w: { a: 'pulse', t: 0, q: 1, s: false }, c: { c, t: c === 'titan' ? 1 : 0, q: 1, s: false }, cores: ['dmg', 'rof', 'arm'] } });
db.root.eco = { tg_701: legacy('titan') };
const U1 = { id: 701, username: 'oldpilot' };
let [s, r] = await call('/api/sync', { initData: initData(U1), lab: 1 });
let S = E('tg_701');
t(s === 200 && S.upc && S.glc && S.gsc && S.up === undefined && S.gemLvl === undefined && S.gemShards === undefined, 'an old record moves to per-chassis tables; the shared fields are gone ' + s);
t(J(S.upc.titan) === J({ hull: 3, cannon: 4, engine: 1, target: 0, reactor: 2 }) && S.glc.titan.arm === 5 && S.gsc.titan.dmg === 7, 'its build and cores went to the chassis it flies (Titan) ' + J(S.upc.titan));
t(sum(S.upc.vanguard) === 0 && sum(S.upc.scout) === 0 && R.GORDER.every((k) => S.glc.vanguard[k] === 1 && S.gsc.vanguard[k] === 0), 'the other chassis start fresh: no levels, cores at level 1');
t(S.pts === 5000, 'no points made or lost by the move');
db.root.eco[OWNER_PID] = legacy('vanguard');
const owner = R.ecoNorm(JSON.parse(J(db.root.eco[OWNER_PID])), { allChassis: true });
t(R.CHORDER.every((c) => J(owner.upc[c]) === J({ hull: 3, cannon: 4, engine: 1, target: 0, reactor: 2 }) && owner.glc[c].arm === 5 && owner.gsc[c].dmg === 7), 'the owner\'s account: his build and cores copied to all three chassis');
{ const eco = await import('../../../worker/src/eco.js'); const Ow = await eco.readEco(env, OWNER_PID);
  t(R.CHORDER.every((c) => Ow.upc[c].cannon === 4 && Ow.glc[c].arm === 5), 'the server reads the owner\'s old record with all three chassis kitted'); }
// a second read of a moved record changes nothing (the move happens once)
{ const before = J(R.ecoNorm(JSON.parse(J(E('tg_701'))))); t(J(R.ecoNorm(JSON.parse(before))) === before, 'normalising a moved record twice is a no-op'); }

// ---- 2. upgrades and the reset, per chassis ----
const P = { id: 702, username: 'per' }, pp = 'tg_702';
await call('/api/sync', { initData: initData(P), lab: 1, boot: true });
db.root.eco[pp].pts = 400000; db.root.eco[pp].earned = 400000; db.root.eco[pp].cOwn.titan = [0]; db.root.eco[pp].roll = { 'titan:0': 1.06 };
[s, r] = await act(P, 'up', { k: 'hull', c: 'titan' }); t(r.out.lv === 1 && r.out.c === 'titan' && r.E.upc.titan.hull === 1 && r.E.upc.vanguard.hull === 0, 'an upgrade for the Titan lands on the Titan only ' + J(r.out));
[s, r] = await act(P, 'up', { k: 'hull', c: 'scout' }); t(r.out.err === 'chassis' && r.E.upc.scout.hull === 0, 'no upgrades for a chassis you don\'t own ' + J(r.out));
[s, r] = await act(P, 'up', { k: 'hull' }); t(r.out.c === 'vanguard' && r.E.upc.vanguard.hull === 1, 'no chassis named: the one you fly (Vanguard)');
for (const c of ['vanguard', 'titan']) { for (const k of ['hull', 'cannon', 'engine']) while ((E(pp).upc[c][k] | 0) < 4) await act(P, 'up', { k, c }); while (R.upLevels(E(pp).upc[c]) < 14) await act(P, 'up', { k: 'target', c }); }
t(R.upLevels(E(pp).upc.vanguard) === 14 && R.upLevels(E(pp).upc.titan) === 14, 'the 14-level budget is per chassis: both full');
[s, r] = await act(P, 'up', { k: 'reactor', c: 'titan' }); t(r.out.err === 'budget', 'a 15th level on one chassis is refused');
t(E(pp).pts === 400000 - 2 * 62500, 'each full build cost its own 62,500 points ' + E(pp).pts);
[s, r] = await act(P, 'respec', { c: 'titan' }); t(r.out.c === 'titan' && R.upLevels(r.E.upc.titan) === 0 && R.upLevels(r.E.upc.vanguard) === 14 && r.out.back === 31250, 'a reset clears one chassis\'s build only ' + J(r.out));

// ---- 3. gem caches with points (every rarity, Epic included) and the chosen core ----
const P0 = E(pp).pts, buys0 = J(E(pp).buys || {});
t(R.GEM_PTS.length === 3 && R.GEM_PTS.every((p, i) => p === R.RSTARS[i] * R.GEM_PTS_STAR) && R.GEM_PTS[2] > 0, 'one points-per-Star rate for every gem cache: ' + J(R.GEM_PTS));
let spent = 0;
for (const ri of [0, 1, 2]) { const before = E(pp).pts; [s, r] = await act(P, 'crate', { tk: 'gem', ri, c: 'titan' }); t(r.out.gem && r.out.c === 'titan' && before - E(pp).pts === R.GEM_PTS[ri], (['Common', 'Rare', 'Epic'][ri]) + ' gem cache for points: ' + R.GEM_PTS[ri] + ' points, shards for the Titan ' + J(r.out)); spent += R.GEM_PTS[ri]; }
t(J(E(pp).buys || {}) === buys0, 'gem caches bought with points don\'t raise the day\'s money price');
t(sum(E(pp).gsc.vanguard) === 0 && R.GORDER.every((k) => E(pp).glc.vanguard[k] === 1), 'the Vanguard\'s cores untouched by the Titan\'s caches');
[s, r] = await act(P, 'crate', { tk: 'gem', ri: 1, c: 'scout' }); t(r.out.err === 'chassis', 'no gem cache for a chassis you don\'t own');
const T0 = J(E(pp).glc.titan) + J(E(pp).gsc.titan);
for (const ri of [0, 1, 2]) { const before = E(pp).pts, sh = (E(pp).gsc.vanguard.lck | 0), lv = E(pp).glc.vanguard.lck; [s, r] = await act(P, 'core', { k: 'lck', ri, c: 'vanguard' });
  t(r.out.tk === 'core' && r.out.gem === 'lck' && r.out.n === R.CORE_N[ri] && r.out.c === 'vanguard' && before - E(pp).pts === Math.round(R.GEM_PTS[ri] * R.CORE_X), 'chosen core (' + ['Common', 'Rare', 'Epic'][ri] + '): ' + R.CORE_N[ri] + ' Luck shards for the Vanguard at 1.5x the cache ' + J(r.out)); }
t(J(E(pp).glc.titan) + J(E(pp).gsc.titan) === T0, 'chosen cores for the Vanguard leave the Titan alone');
db.root.eco[pp].glc.vanguard.dmg = 5; [s, r] = await act(P, 'core', { k: 'dmg', ri: 2, c: 'vanguard' }); t(r.out.err === 'max', 'a chosen core already at level 5 is refused (nothing wasted)');
[s, r] = await act(P, 'core', { k: 'dmg', ri: 2, c: 'scout' }); t(r.out.err === 'chassis', 'no chosen core for a chassis you don\'t own');
[s, r] = await act(P, 'core', { k: 'nope', ri: 2, c: 'vanguard' }); t(s === 400, 'an unknown core is refused');
db.root.eco[pp].pts = 10; [s, r] = await act(P, 'core', { k: 'arm', ri: 2, c: 'vanguard' }); t(r.out.err === 'pts', 'not enough points: refused, nothing taken');
db.root.eco[pp].pts = 400000;

// ---- 4. paid: the gem cache and the chosen core name their chassis; Stars invoice -> webhook -> grant -> refund ----
const inv = async (body) => { tgCalls.length = 0; const [st, res] = await call('/api/stars-invoice', { initData: initData(P), ...body }); const c = tgCalls.find((x) => x[0] === 'createInvoiceLink'); return [st, res, c ? JSON.parse(c[1].payload) : null, c ? c[1] : null]; };
let [st, res, pl, iv] = await inv({ kind: 'box', tk: 'gem', ri: 2, c: 'titan' });
t(st === 200 && pl && pl.c === 'titan' && pl.t === 'gem' && pl.r === 2, 'an Epic gem cache invoice carries its chassis ' + J(pl));
const cachePrice = res.stars;
[st, res, pl, iv] = await inv({ kind: 'core', tk: 'arm', ri: 2, c: 'titan' });
t(st === 200 && pl.k === 'core' && pl.t === 'arm' && pl.r === 2 && pl.c === 'titan' && /chosen core: Armor/.test(iv.title), 'a chosen-core invoice: the core, the size and the chassis ' + J(pl) + ' ' + (iv && iv.title));
t(res.stars === Math.round(R.RSTARS[2] * R.ecoBoxMult(E(pp), 'gem', 2, { day: Math.floor(Date.now() / 864e5) }) * R.CORE_X) && res.stars > cachePrice, 'the chosen core costs 1.5x the gem cache\'s price right now, more than the random cache (' + res.stars + ' vs ' + cachePrice + ')');
[st, res] = await call('/api/stars-invoice', { initData: initData(P), kind: 'core', tk: 'arm', ri: 2 }); t(st === 400, 'a chosen core must name its chassis');
[st, res] = await call('/api/stars-invoice', { initData: initData(P), kind: 'core', tk: 'arm', ri: 2, c: 'scout' }); t(st === 409, 'no chosen core for a chassis you don\'t own (' + st + ')');
db.root.eco[pp].glc.titan.vel = 5; [st, res] = await call('/api/stars-invoice', { initData: initData(P), kind: 'core', tk: 'vel', ri: 1, c: 'titan' }); t(st === 409, 'no chosen core for a core at level 5 (' + st + ')');
const pay = (ch, payload, amt) => hook({ message: { from: { id: 702, username: 'per' }, chat: { id: 702, type: 'private' }, successful_payment: { total_amount: amt, telegram_payment_charge_id: ch, invoice_payload: J(payload) } } });
const g0 = J(E(pp).gsc), lv0 = J(E(pp).glc);
await pay('pc1', { u: 702, k: 'core', t: 'arm', r: 2, c: 'titan', g: 34.5, n: 'n1' }, 2250);
S = E(pp);
t(S.gsc.titan.arm + (S.glc.titan.arm - JSON.parse(lv0).titan.arm) * 100 > JSON.parse(g0).titan.arm && J(S.gsc.vanguard) === J(JSON.parse(g0).vanguard), 'the paid chosen core landed on the Titan\'s Armor core only');
const paid = db.get('/starsPaid/tg_702/pc1'); t(paid && paid.c === 'titan' && paid.o && paid.o[0].c === 'titan' && paid.o[0].n === 14, 'the Stars record keeps the chassis and what it gave ' + J(paid && paid.o));
await pay('pc1', { u: 702, k: 'core', t: 'arm', r: 2, c: 'titan', g: 34.5, n: 'n1' }, 2250); t(J(E(pp).gsc) === J(S.gsc) && J(E(pp).glc) === J(S.glc), 'the same payment twice grants once');
await pay('pb1', { u: 702, k: 'box', t: 'gem', r: 1, c: 'titan', g: 8, n: 'n2' }, 500);
const pb = db.get('/starsPaid/tg_702/pb1'); t(pb && pb.o && pb.o[0].c === 'titan' && pb.o[0].gem, 'a paid gem cache\'s shards went to the chassis it named ' + J(pb && pb.o));
await hook({ message: { from: { id: 702 }, chat: { id: 702, type: 'private' }, refunded_payment: { total_amount: 2250, telegram_payment_charge_id: 'pc1', invoice_payload: '{}' } } });
t(J(E(pp).glc.vanguard) === J(S.glc.vanguard) && (E(pp).gsc.titan.arm + E(pp).glc.titan.arm * 100) < (S.gsc.titan.arm + S.glc.titan.arm * 100), 'a refund takes the chosen core\'s shards back off the Titan');

// ---- 5. loadouts, tickets, the Lab and power follow the fielded chassis ----
S = R.ecoNorm(JSON.parse(J(E(pp))));
const Lv = R.ecoLoadout(S, { c: { c: 'vanguard', t: 0 } }), Lt = R.ecoLoadout(S, { c: { c: 'titan', t: 0 } });
t(J(Lv.up) === J(S.upc.vanguard) && J(Lt.up) === J(S.upc.titan) && J(Lv.gl) === J(S.glc.vanguard) && J(Lt.gl) === J(S.glc.titan), 'a loadout carries its own chassis\'s build and core levels');
t(Lv.chs.every((x) => J(x.up) === J(S.upc[x.c]) && J(x.gl) === J(S.glc[x.c])), 'every chassis it can swap to carries its own build and cores');
const sw = R.loadoutFor(Lv, Lv.chs.find((x) => x.c === 'titan')); t(sw.c.c === 'titan' && J(sw.up) === J(S.upc.titan) && J(sw.gl) === J(S.glc.titan) && sw.c.up === undefined, 'a swap (loadoutFor) moves the build and cores with the chassis');
t(R.powerOf(Lv) !== R.powerOf({ ...Lv, up: S.upc.titan }), 'power reads the fielded chassis\'s own build');
// the Lab: two bays, two chassis
{ const id = S.lab.active, other = Object.keys(S.lab.machines).find((k) => k !== id), M = S.lab.machines[other];
  [s, r] = await act(P, 'lab_save', { id: other, rev: S.lab.rev, name: M.name, spec: { ...M.spec, c: { c: 'titan', t: 0, s: false }, catalog: R.FIT_VERSION } }); t(r.out && r.out.ok, 'bay B fields the Titan ' + J(r.out));
  const pwV = db.get('/players/tg_702/power');
  [s, r] = await act(P, 'lab_activate', { id: other, rev: E(pp).lab.rev });
  const L = E(pp).L; t(L.c.c === 'titan' && J(L.up) === J(E(pp).upc.titan) && J(L.gl) === J(E(pp).glc.titan), 'the deployed bay\'s loadout carries the Titan\'s own build and cores');
  t(db.get('/players/tg_702/power') !== pwV, 'power and league follow the bay you deploy (' + pwV + ' -> ' + db.get('/players/tg_702/power') + ')');
  [s, r] = await call('/api/match/start', { initData: initData(P), g: 'arena', m: '1v1', map: 'classic', pv: 1, labRev: E(pp).lab.rev, fv: R.FIT_VERSION });
  t(s === 200 && r.ok && r.L.c.c === 'titan' && J(r.L.up) === J(E(pp).upc.titan), 'the match ticket fields the Titan with its own build ' + s); }
// free gem caches (login day 7, the gift, the chest, the pass) go to the chassis you fly
{ const day = Math.floor(Date.now() / 864e5); db.root.eco[pp].login = { last: day - 1, n: 6 }; const g1 = J(E(pp).gsc.vanguard);
  [s, r] = await act(P, 'login'); t(r.out.box && r.out.box.c === 'titan' && J(E(pp).gsc.vanguard) === g1, 'the day-7 gem cache went to the Titan, the chassis flown ' + J(r.out.box)); }
console.log(`chassis: passed ${ok}, failed ${bad}`);
if (bad) process.exitCode = 1;
