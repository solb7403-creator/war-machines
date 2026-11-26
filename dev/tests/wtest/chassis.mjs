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
import { payKit } from './pay.mjs';
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
let K = null;   // Session 8: the quote flow (dev/tests/wtest/pay.mjs), set once the webhook helper exists
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
db.root.eco[pp].pts = 1500000;   // enough for one of each gem cache and one of each chosen core at the Checkpoint 38 prices
const P0 = E(pp).pts, buys0 = J(E(pp).buys || {});
t(J(R.GEM_PTS) === J([30000, 60000, 180000]) && R.GEM_PTS_STAR === 120, 'owner\'s gem cache prices (Checkpoint 38): 120 points a Star, 30,000 / 60,000 / 180,000 ' + J(R.GEM_PTS));
t(J([0, 1, 2].map(R.corePts)) === J([43750, 87500, 262500]) && R.CORE_PTS_STAR === 175 && [0, 1, 2].every((ri) => R.corePts(ri) === R.RSTARS[ri] * R.CORE_PTS_STAR), 'owner\'s chosen core prices (Checkpoint 38): 175 points a Star of the cache\'s price, 43,750 / 87,500 / 262,500 ' + J([0, 1, 2].map(R.corePts)));
t(J(R.RSTARS) === J([250, 500, 1500]) && J(R.RPRICE) === J([4, 8, 23]) && R.CORE_X === 1.5, 'money prices unchanged');
t(R.GEM_PTS.length === 3 && R.GEM_PTS.every((p, i) => p === R.RSTARS[i] * R.GEM_PTS_STAR) && R.GEM_PTS[2] > 0, 'one points-per-Star rate for every gem cache: ' + J(R.GEM_PTS));
let spent = 0;
for (const ri of [0, 1, 2]) { const before = E(pp).pts; [s, r] = await act(P, 'crate', { tk: 'gem', ri, c: 'titan' }); t(r.out.gem && r.out.c === 'titan' && before - E(pp).pts === R.GEM_PTS[ri], (['Common', 'Rare', 'Epic'][ri]) + ' gem cache for points: ' + R.GEM_PTS[ri] + ' points, shards for the Titan ' + J(r.out)); spent += R.GEM_PTS[ri]; }
t(J(E(pp).buys || {}) === buys0, 'gem caches bought with points don\'t raise the day\'s money price');
t(sum(E(pp).gsc.vanguard) === 0 && R.GORDER.every((k) => E(pp).glc.vanguard[k] === 1), 'the Vanguard\'s cores untouched by the Titan\'s caches');
[s, r] = await act(P, 'crate', { tk: 'gem', ri: 1, c: 'scout' }); t(r.out.err === 'chassis', 'no gem cache for a chassis you don\'t own');
const T0 = J(E(pp).glc.titan) + J(E(pp).gsc.titan);
for (const ri of [0, 1, 2]) { const before = E(pp).pts, sh = (E(pp).gsc.vanguard.lck | 0), lv = E(pp).glc.vanguard.lck; [s, r] = await act(P, 'core', { k: 'lck', ri, c: 'vanguard' });
  t(r.out.tk === 'core' && r.out.gem === 'lck' && r.out.n === R.CORE_N[ri] && r.out.c === 'vanguard' && before - E(pp).pts === R.corePts(ri), 'chosen core (' + ['Common', 'Rare', 'Epic'][ri] + '): ' + R.CORE_N[ri] + ' Luck shards for the Vanguard for ' + R.corePts(ri) + ' points ' + J(r.out)); }
t(J(E(pp).glc.titan) + J(E(pp).gsc.titan) === T0, 'chosen cores for the Vanguard leave the Titan alone');
db.root.eco[pp].glc.vanguard.dmg = 5; [s, r] = await act(P, 'core', { k: 'dmg', ri: 2, c: 'vanguard' }); t(r.out.err === 'max', 'a chosen core already at level 5 is refused (nothing wasted)');
[s, r] = await act(P, 'core', { k: 'dmg', ri: 2, c: 'scout' }); t(r.out.err === 'chassis', 'no chosen core for a chassis you don\'t own');
[s, r] = await act(P, 'core', { k: 'nope', ri: 2, c: 'vanguard' }); t(s === 400, 'an unknown core is refused');
db.root.eco[pp].pts = 10; [s, r] = await act(P, 'core', { k: 'arm', ri: 2, c: 'vanguard' }); t(r.out.err === 'pts', 'not enough points: refused, nothing taken');
db.root.eco[pp].pts = 400000;

// ---- 4. paid: the gem cache and the chosen core name their chassis; Stars invoice -> webhook -> grant -> refund ----
// Session 8: every purchase is a server quote first: the invoice carries only the user and the quote id; the goods (kind, item, size,
// chassis) live in the server's quote (res.order.d), paid through Telegram's pre-checkout (the Worker re-checks it) and the webhook
K = payKit({ call, hook, initData, tgCalls });
const inv = async (body) => { tgCalls.length = 0; const [st, res] = await call('/api/stars-invoice', { initData: initData(P), ...body }); const c = tgCalls.find((x) => x[0] === 'createInvoiceLink'); return [st, res, res && res.order ? res.order.d : null, c ? c[1] : null]; };
const buyP = async (body, ch) => { const [st2, res2] = await call('/api/stars-invoice', { initData: initData(P), ...body }); if (st2 !== 200) return null; const p2 = await K.pre(P, res2.order); if (p2.ok) await K.paid(P, res2.order, ch); return { o: res2.order, pre: p2 }; };
let [st, res, pl, iv] = await inv({ kind: 'box', tk: 'gem', ri: 2, c: 'titan' });
t(st === 200 && pl && pl.c === 'titan' && pl.tk === 'gem' && pl.ri === 2, 'an Epic gem cache quote carries its chassis ' + J(pl));
const cachePrice = res.stars;
[st, res, pl, iv] = await inv({ kind: 'core', tk: 'arm', ri: 2, c: 'titan' });
t(st === 200 && pl.kind === 'core' && pl.tk === 'arm' && pl.ri === 2 && pl.c === 'titan' && /chosen core: Armor/.test(iv.title), 'a chosen-core quote: the core, the size and the chassis ' + J(pl) + ' ' + (iv && iv.title));
const oCore = res.order;
t(res.stars === Math.round(R.RSTARS[2] * R.ecoBoxMult(E(pp), 'gem', 2, { day: Math.floor(Date.now() / 864e5) }) * R.CORE_X) && res.stars > cachePrice, 'the chosen core costs 1.5x the gem cache\'s price right now, more than the random cache (' + res.stars + ' vs ' + cachePrice + ')');
[st, res] = await call('/api/stars-invoice', { initData: initData(P), kind: 'core', tk: 'arm', ri: 2 }); t(st === 400, 'a chosen core must name its chassis');
[st, res] = await call('/api/stars-invoice', { initData: initData(P), kind: 'core', tk: 'arm', ri: 2, c: 'scout' }); t(st === 409, 'no chosen core for a chassis you don\'t own (' + st + ')');
db.root.eco[pp].glc.titan.vel = 5; [st, res] = await call('/api/stars-invoice', { initData: initData(P), kind: 'core', tk: 'vel', ri: 1, c: 'titan' }); t(st === 409, 'no chosen core for a core at level 5 (' + st + ')');
const g0 = J(E(pp).gsc), lv0 = J(E(pp).glc);
{ const p0 = await K.pre(P, oCore); t(p0.ok, 'the chosen core\'s pre-checkout'); await K.paid(P, oCore, 'pc1'); }
S = E(pp);
t(S.gsc.titan.arm + (S.glc.titan.arm - JSON.parse(lv0).titan.arm) * 100 > JSON.parse(g0).titan.arm && J(S.gsc.vanguard) === J(JSON.parse(g0).vanguard), 'the paid chosen core landed on the Titan\'s Armor core only');
const paid = db.get('/starsPaid/tg_702/pc1'); t(paid && paid.c === 'titan' && paid.o && paid.o[0].c === 'titan' && paid.o[0].n === 14, 'the Stars record keeps the chassis and what it gave ' + J(paid && paid.o));
await K.paid(P, oCore, 'pc1'); t(J(E(pp).gsc) === J(S.gsc) && J(E(pp).glc) === J(S.glc), 'the same payment twice grants once');
await buyP({ kind: 'box', tk: 'gem', ri: 1, c: 'titan' }, 'pb1');
const pb = db.get('/starsPaid/tg_702/pb1'); t(pb && pb.o && pb.o[0].c === 'titan' && pb.o[0].gem, 'a paid gem cache\'s shards went to the chassis it named ' + J(pb && pb.o));
await K.refund(P, 'pc1', 2250);
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
// ---- 6. review round 1: forged names, unowned chassis, a maxed chosen core, the refund's loadout, the home chassis ----
for (const c of ['constructor', '__proto__', 'toString']) {
  [st, res, pl] = await inv({ kind: 'box', tk: 'gem', ri: 2, c });
  t(st === 200 && pl && !pl.c, 'a forged chassis name is dropped from a gem cache quote (' + c + ') ' + J(pl));
  await K.cancel(P, res.order.oid);
}
[st, res] = await call('/api/stars-invoice', { initData: initData(P), kind: 'core', tk: 'toString', ri: 2, c: 'titan' }); t(st === 400, 'a forged core name is refused (' + st + ')');
{ const hr = await buyP({ kind: 'box', tk: 'gem', ri: 2, c: 'constructor' }, 'pf1'), sp = db.get('/starsPaid/tg_702/pf1');
  t(hr && hr.pre.ok && sp && sp.o && sp.o[0] && R.CHORDER.includes(sp.o[0].c) && !sp.err, 'a purchase naming a forged chassis is quoted without it, granted to a real one and recorded ' + J(sp && sp.o)); }
{ const pts0 = E(pp).pts; [s, r] = await act(P, 'core', { k: 'toString', ri: 2, c: 'titan' });
  t(s < 500 && E(pp).pts === pts0 && R.CHORDER.every((c) => Object.keys(E(pp).gsc[c]).every((k) => R.GORDER.includes(k))), 'a forged core name takes no points and writes nothing (' + s + ')');
  [s, r] = await act(P, 'core', { k: 'dmg', ri: 0, c: 'constructor' }); t(s < 500 && E(pp).pts === pts0, 'a forged chassis on a chosen core is not a server error (' + s + ')'); }
{ const up0 = J(E(pp).upc); [s, r] = await act(P, 'respec', { c: 'scout' });
  t(r.out && r.out.err === 'chassis' && J(E(pp).upc) === up0, 'a reset named for a chassis you don\'t own is refused, no build is touched ' + J(r.out)); }
[st] = await inv({ kind: 'box', tk: 'gem', ri: 1, c: 'scout' }); t(st === 409, 'no paid gem cache for a chassis you don\'t own (' + st + ')');
{ // Session 8 (Checkpoint 39 gap 1): a chosen core that reached level 5 while its invoice was open is refused at the pre-checkout; a
  // payment that lands anyway is held for a refund (nothing granted: what was bought was that core, not shards for another)
  db.root.eco[pp].glc.titan.dmg = 4; const [st4, r4] = await call('/api/stars-invoice', { initData: initData(P), kind: 'core', tk: 'dmg', ri: 1, c: 'titan' });
  db.root.eco[pp].glc.titan.dmg = 5; const gl0 = J(E(pp).glc.titan), gs0 = J(E(pp).gsc.titan);
  const p4 = await K.pre(P, r4.order); t(st4 === 200 && !p4.ok && /already have/.test(p4.why), 'a chosen core maxed since its invoice opened: the pre-checkout refuses it');
  await K.paid(P, r4.order, 'pm1');
  t(db.get('/orders/tg_702/' + r4.order.oid + '/st') === 'held' && J(E(pp).glc.titan) === gl0 && J(E(pp).gsc.titan) === gs0, 'a payment landing anyway for the maxed core: held for a refund, nothing granted'); }
{ // the refund puts the stored loadout and power back too
  await buyP({ kind: 'core', tk: 'rof', ri: 2, c: 'titan' }, 'pr1');
  const Lg = E(pp).L; t(Lg.c.c === 'titan' && J(Lg.gl) === J(E(pp).glc.titan), 'a paid chosen core updates the deployed loadout\'s cores');
  await K.refund(P, 'pr1', 2250);
  const L2 = E(pp).L; t(J(L2.gl) === J(E(pp).glc.titan) && E(pp).pw === R.powerOf(L2), 'after its refund the stored loadout and power match the cores again ' + J(L2.gl)); }
{ // a chassis no longer owned is not home
  const S2 = R.ecoNorm({}); S2.L = { c: { c: 'titan', t: 0 } }; t(R.homeChassis(S2) === 'vanguard', 'an unowned chassis in the record is not the home chassis');
  S2.cOwn.titan = [0]; t(R.homeChassis(S2) === 'titan', 'an owned one is'); }
{ // a mutual kill before the clock is an honest Arena draw (proof of play): the record shows every tank down
  const { checkProof } = await import('../../../worker/src/proof.js'), fs = await import('node:fs');
  const rec = JSON.parse(fs.readFileSync(new URL('./fixtures/proof-mutual-kill.json', import.meta.url), 'utf8'));
  t(checkProof(rec.pf, rec.c).ok, 'a mutual-kill Arena draw before the clock passes the proof check');
  const raw = atob(rec.pf.s), b = Uint8Array.from(raw, (ch) => ch.charCodeAt(0)), n = rec.pf.n, sz = n * 3 + 6, k = b.length / sz;
  b[(k - 1) * sz + 1 * 3 + 2] = 60; b[(k - 2) * sz + 1 * 3 + 2] = 60;   // the enemy still up at the end: a draw claim before the clock fails
  { const o = checkProof({ ...rec.pf, s: btoa(String.fromCharCode(...b)) }, rec.c); t(!o.ok && o.why === 'result', 'an early draw with a tank still up fails (' + o.why + ')'); } }

// ---- 7. weapon caches and chassis crates priced like gem caches, and chosen gear (owner, Nov 14 2026, Checkpoint 39) ----
{ const X = () => ({ day: Math.floor(Date.now() / 864e5), week: Math.floor((Date.now() - 4 * 864e5) / (7 * 864e5)), rnd: Math.random });
  t(J(R.RPTS) === J([30000, 60000, 180000]) && R.RPTS.every((p, i) => p === R.RSTARS[i] * R.GEM_PTS_STAR), 'owner: weapon caches and chassis crates at 120 points a Star, 30,000 / 60,000 / 180,000 (Epic buyable) ' + J(R.RPTS));
  t(J([0, 1, 2].map(R.gearPts)) === J([43750, 87500, 262500]) && [0, 1, 2].every((ri) => R.gearPts(ri) === R.RSTARS[ri] * R.CORE_PTS_STAR), 'owner: chosen weapons and chassis at 175 points a Star, 43,750 / 87,500 / 262,500 ' + J([0, 1, 2].map(R.gearPts)));
  t(R.gearTk('twin') === 'weapon' && R.gearTk('titan') === 'chassis' && R.gearTk('moon') === null && R.gearTk('toString') === null && R.gearTk('gem') === null, 'only the six crate lines can be chosen (no Moonbeam, no prototype names)');
  const G = { id: 703, username: 'gear' }, gp = 'tg_703';
  await call('/api/sync', { initData: initData(G), lab: 1, boot: true });
  db.root.eco[gp].pts = 2000000; db.root.eco[gp].earned = 2000000;
  // crates for points: every rarity, Epic included; a points buy never raises the money price step
  const b0 = J(E(gp).buys || {});
  for (const tk of ['weapon', 'chassis']) for (const ri of [0, 1, 2]) { const before = E(gp).pts; [s, r] = await act(G, 'crate', { tk, ri });
    t(r.out.k && r.out.tier === ri && before - E(gp).pts === R.RPTS[ri], ['Common', 'Rare', 'Epic'][ri] + ' ' + tk + ' crate for points: ' + R.RPTS[ri] + ' ' + J(r.out)); }
  t(J(E(gp).buys || {}) === b0, 'crates bought with points don\'t raise their money price (x1 / x2 / x3 counts money buys only) ' + J(E(gp).buys));
  // the chosen item: exactly the one picked, rolled 105-110% like a crate's
  const pick = (k, ri) => (R.gearTk(k) === 'weapon' ? E(gp).wOwn : E(gp).cOwn)[k] || [];
  for (const [k, ri] of [['twin', 2], ['siege', 1], ['titan', 2], ['scout', 0]]) {
    if (pick(k, ri).includes(ri)) { const tk = R.gearTk(k); db.root.eco[gp][tk === 'weapon' ? 'wOwn' : 'cOwn'][k] = pick(k, ri).filter((x) => x !== ri); delete db.root.eco[gp].roll[k + ':' + ri]; }
    const before = E(gp).pts, buys = J(E(gp).buys || {}); [s, r] = await act(G, 'gear', { k, ri }); const roll = E(gp).roll[k + ':' + ri];
    t(s === 200 && r.out.kind === 'new' && r.out.k === k && r.out.tier === ri && pick(k, ri).includes(ri) && before - E(gp).pts === R.gearPts(ri) && roll >= R.ROLL_MIN && roll <= R.ROLL_MAX && roll === r.out.roll && J(E(gp).buys || {}) === buys,
      'chosen ' + k + ' (' + ['Common', 'Rare', 'Epic'][ri] + ') for ' + R.gearPts(ri) + ' points: that exact item, roll ' + roll + ', no money price step ' + J(r.out)); }
  { const before = E(gp).pts; [s, r] = await act(G, 'gear', { k: 'twin', ri: 2 }); t(r.out.err === 'owned' && E(gp).pts === before, 'a chosen item you own is refused, nothing taken'); }
  { const before = E(gp).pts; [s, r] = await act(G, 'gear', { k: 'pulse', ri: 0 }); t(r.out.err === 'owned' && E(gp).pts === before, 'the starter Pulse Cannon counts as owned'); }
  for (const k of ['moon', 'toString', 'constructor', '__proto__', 'gem']) { const before = E(gp).pts; [s, r] = await act(G, 'gear', { k, ri: 2 }); t(s === 400 && E(gp).pts === before, 'a forged or premium item name is refused (' + k + ', ' + s + ')'); }
  { db.root.eco[gp].pts = 10; delete db.root.eco[gp].cOwn.vanguard; db.root.eco[gp].cOwn.vanguard = [0];
    [s, r] = await act(G, 'gear', { k: 'vanguard', ri: 2 }); t(r.out.err === 'pts' && !E(gp).cOwn.vanguard.includes(2), 'not enough points: refused, nothing given'); db.root.eco[gp].pts = 2000000; }
  // Stars: 1.5x the crate's price right now; an owned item has no invoice; webhook grants the exact item; a refund takes it back
  const ginv = async (body) => { tgCalls.length = 0; const [st, res] = await call('/api/stars-invoice', { initData: initData(G), ...body }); const c = tgCalls.find((x) => x[0] === 'createInvoiceLink'); return [st, res, res && res.order ? res.order.d : null, c && c[1]]; };
  let [st, res, pl, iv] = await ginv({ kind: 'box', tk: 'chassis', ri: 2 }); const crateStars = res.stars; if (st === 200) await K.cancel(G, res.order.oid);
  [st, res, pl, iv] = await ginv({ kind: 'gear', tk: 'vanguard', ri: 2 });
  t(st === 200 && pl.kind === 'gear' && pl.tk === 'vanguard' && pl.ri === 2 && iv.title === 'Epic chosen chassis: Paladin' && res.stars === Math.round(crateStars * R.CORE_X) && res.stars === 2250, 'a chosen-chassis quote: the item, 1.5x the crate (' + crateStars + ' -> ' + res.stars + ' Stars) ' + J(pl) + ' ' + (iv && iv.title));
  const oGear = res.order;
  [st] = await ginv({ kind: 'gear', tk: 'titan', ri: 2 }); t(st === 409, 'no invoice for a chosen item you own (' + st + ')');
  [st] = await ginv({ kind: 'gear', tk: 'moon', ri: 2 }); t(st === 400, 'Moonbeam is not chosen gear (' + st + ')');
  [st] = await ginv({ kind: 'gear', tk: 'toString', ri: 1 }); t(st === 400, 'a forged item name has no invoice (' + st + ')');
  const pr = R.ecoPrice(E(gp), { kind: 'gear', tk: 'storm', ri: 1 }, X()); t(pr === null, 'no price for an unknown item');
  const m0 = R.ecoBoxMult(R.ecoNorm(JSON.parse(J(E(gp)))), 'chassis', 2, X());
  t((await K.pre(G, oGear)).ok, 'the chosen chassis\'s pre-checkout'); await K.paid(G, oGear, 'pg1');
  { const S3 = E(gp), o = (db.get('/starsPaid/tg_703/pg1') || {}).o || [], roll = S3.roll['vanguard:2'];
    t(S3.cOwn.vanguard.includes(2) && o[0] && o[0].kind === 'new' && o[0].k === 'vanguard' && o[0].tier === 2 && roll >= R.ROLL_MIN && roll <= R.ROLL_MAX, 'the paid chosen chassis: exactly the Paladin, rolled ' + roll + ' ' + J(o[0]));
    t(R.ecoBoxMult(R.ecoNorm(JSON.parse(J(S3))), 'chassis', 2, X()) === Math.min(3, m0 + 1), 'a paid chosen item counts as a buy of its crate (x' + m0 + ' -> x' + R.ecoBoxMult(R.ecoNorm(JSON.parse(J(S3))), 'chassis', 2, X()) + '), as a chosen core does for its cache');
    t(S3.L && S3.pw === R.powerOf(S3.L), 'the stored loadout and power follow the paid item'); }
  { const S3 = J(E(gp)); await K.paid(G, oGear, 'pg1'); const S4 = E(gp); t(J(S4.cOwn) === J(JSON.parse(S3).cOwn) && J(S4.roll) === J(JSON.parse(S3).roll), 'the same payment twice grants once'); }
  { // Session 8 (Checkpoint 39 gaps 1 and 2): a second invoice for an item owned since can't pass the pre-checkout, and a second payment
    // that lands anyway is held for a refund: never a duplicate and never re-rolled (what was bought was that item, not a crate roll)
    const r0 = E(gp).roll['vanguard:2'], pts0 = E(gp).pts;
    const [stq, rq] = await call('/api/stars-invoice', { initData: initData(G), kind: 'gear', tk: 'vanguard', ri: 2 }); t(stq === 409 && rq.error === 'owned', 'no new quote for the chosen item now owned');
    t(!(await K.pre(G, oGear)).ok, 'the paid invoice can\'t be paid again (pre-checkout)');
    await K.paid(G, oGear, 'pg2');
    t(E(gp).roll['vanguard:2'] === r0 && E(gp).pts === pts0 && E(gp).cOwn.vanguard.filter((x) => x === 2).length === 1 && Object.values(db.get('/held') || {}).some((h) => h.oid === oGear.oid && h.err === 'duplicate'), 'an item already owned when a second payment lands: held for a refund, never duplicated or re-rolled'); }
  await K.refund(G, 'pg1', 2250);
  t(!E(gp).cOwn.vanguard.includes(2) && E(gp).roll['vanguard:2'] === undefined && E(gp).cOwn.vanguard.includes(0), 'a refund takes the chosen chassis back (the starter Vanguard stays)');
  { const L = E(gp).L; t(!L || L.c.c !== 'vanguard' || L.c.t !== 2, 'and the deployed loadout no longer fields it ' + J(L && L.c)); }
  // GRAM / SOL: the same quote and price (the full GRAM and SOL paths: dev/tests/wtest/payments.mjs)
  { const { RULES } = await import('../../../worker/src/sim.gen.js'); const S5 = R.ecoNorm(JSON.parse(J(E(gp)))), p5 = RULES.ecoPrice(S5, { kind: 'gear', tk: 'twin', ri: 1 }, X()), c5 = RULES.ecoPrice(S5, { kind: 'box', tk: 'weapon', ri: 1 }, X());
    t(p5 && Math.abs(p5.ton - Math.round(c5.ton * 1.5 * 100) / 100) < 0.011 && p5.stars === Math.round(c5.stars * 1.5), 'GRAM / SOL price: 1.5x the crate\'s GRAM price (' + c5.ton + ' -> ' + p5.ton + ')');
    const G0 = R.ecoNorm({}); t(R.ecoOwned(G0, { kind: 'gear', tk: 'pulse', ri: 0 }) && !R.ecoOwned(G0, { kind: 'gear', tk: 'pulse', ri: 1 }) && R.ecoOwned(G0, { kind: 'gear', tk: 'moon', ri: 2 }), 'ecoOwned: the starter item is owned, a new one is not, an unknown one is never sold'); }
  // the migration check of old phone records keeps the old crate prices (it audits records kept under them)
  { const eco = await import('../../../worker/src/eco.js'); t(typeof eco.migrate === 'function', 'the migration check is still there'); }
}
console.log(`chassis: passed ${ok}, failed ${bad}`);
if (bad) process.exitCode = 1;
