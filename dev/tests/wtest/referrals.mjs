// Referrals + squads (launch redesign): signed/immutable one-level attribution, website invite codes, linked aliases,
// verified match days, the forward-only launch phase pinned when earned, the 5% share cap and carryover, the match
// bonus (never multiplied by the phase), held clusters, claim replay/parallel, restart, and the airdrop research boards.
// Real Worker code, hermetic Firebase stand-in, no outside network.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db = makeDB();
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init);
  if (String(url).startsWith('https://api.telegram.org/')) return new Response(JSON.stringify({ ok: true, result: {} }));
  throw Error('External fetch forbidden: ' + url);
};
const mod = await import('../../../worker/src/index.js');
const eco = await import('../../../worker/src/eco.js');
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const worker = mod.default, env = { BOT_TOKEN: '777:REF', FIREBASE_DB_SECRET: 'SECRET' };
const DAY = 86400000, T0 = Date.now(), day0 = Math.floor(T0 / DAY);
function initData(id, sp, extra = {}) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: 'P' + id, ...extra }) });
  if (sp) p.set('start_param', sp);
  const d = [...p].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => k + '=' + v).join('\n');
  p.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));
  return p.toString();
}
const call = async (path, body, ip) => { const h = { 'Content-Type': 'application/json' }; if (ip) h['CF-Connecting-IP'] = ip; const r = await worker.fetch(new Request('https://x' + path, { method: 'POST', headers: h, body: JSON.stringify(body) }), env); return [r.status, await r.json()]; };
const tgSync = async (id, sp, body = {}, ip) => (await call('/api/sync', { initData: initData(id, sp), ...body }, ip))[1];
const webSync = (pid, body = {}, now = Date.now()) => mod.sync(env, body, { id: Number(pid.slice(3)), first_name: 'Web' + pid.slice(-3), web_auth: true, lunar_account: true }, pid, now);
const E = (pid) => db.get('/eco/' + pid);
// a server-settled live match on a given day (the room's credit path)
const play = (pid, now, pts = 1200) => eco.creditMatch(env, pid, null, () => ({ pts, won: true, pvs: 1, m: { won: true, g: 'arena', m: '1v1', map: 'crater', secs: 90, st: {} } }), now);
let failed = 0, passed = 0;
async function check(name, fn) { try { await fn(); passed++; console.log('PASS', name); } catch (e) { failed++; console.error('FAIL', name, e && e.message); } }

await tgSync(9101); await tgSync(9102);
// ---------- attribution ----------
await check('honest Telegram recruit: signed start_param binds, body refBy is ignored', async () => {
  assert.equal((await tgSync(8101, '', { refBy: 'tg_9101' })).rec.ref, null);
  assert.equal((await tgSync(8102, 'ref_9101', { refBy: 'tg_9102' })).rec.ref, 'tg_9101');
  assert.equal(db.get('/players/tg_8102/ref'), 'tg_9101');
});
await check('binding is immutable: a later different link changes nothing', async () => {
  assert.equal((await tgSync(8102, 'ref_9102')).rec.ref, 'tg_9101');
});
await check('fake codes and malformed params fail', async () => {
  assert.equal((await tgSync(8103, 'ri_zzzzzzzz')).rec.ref, null);
  assert.equal((await tgSync(8104, 'ref_abc')).rec.ref, null);
  assert.equal((await webSync('ln_1000000008105', { inv: 'nope' })).rec.ref, null);
});
await check('self-referral fails, including a zero-padded alias', async () => {
  assert.equal((await tgSync(8106, 'ref_8106')).rec.ref, null);
  assert.equal((await tgSync(8107, 'ref_08107')).rec.ref, null);
});
await check('old pilot cannot be re-bound (existing record, or past their first day)', async () => {
  db.root.players.tg_8108 = { pts: 90000, days: 30, name: 'Vet' };
  assert.equal((await tgSync(8108, 'ref_9101')).rec.ref, null);
  await mod.sync(env, {}, { id: 8109 }, 'tg_8109', T0 - 2 * DAY);
  assert.equal((await tgSync(8109, 'ref_9101')).rec.ref, null);
});
await check('concurrent first bindings agree and stay put', async () => {
  const [a, b] = await Promise.all([mod.sync(env, {}, { id: 8110 }, 'tg_8110', Date.now(), '', 'ref_9101'), mod.sync(env, {}, { id: 8110 }, 'tg_8110', Date.now(), '', 'ref_9102')]);
  assert.equal(a.rec.ref, b.rec.ref); assert.ok(a.rec.ref);
  assert.equal(db.get('/players/tg_8110/ref'), a.rec.ref);
});
// website accounts
const WA = 'ln_1000000000001', WB = 'ln_1000000000002', WC = 'ln_1000000000003';
await webSync(WA);
const codeA = await mod.inviteCode(env, WA), codeT = await mod.inviteCode(env, 'tg_9101');
await check('website accounts get a server-issued invite code (stable, unique)', async () => {
  assert.match(codeA, /^[a-hjkmnp-z2-9]{8}$/); assert.equal(await mod.inviteCode(env, WA), codeA); assert.notEqual(codeA, codeT);
  assert.equal(db.get('/inv/' + codeA), WA);
});
await check('website -> website: the invite code binds on the first sync after sign-up', async () => {
  assert.equal((await webSync(WB, { inv: codeA.toUpperCase() })).rec.ref, WA);
});
await check('Telegram pilot -> website recruit (code), website pilot -> Telegram recruit (ri_ code)', async () => {
  assert.equal((await webSync(WC, { inv: codeT })).rec.ref, 'tg_9101');
  assert.equal((await tgSync(8111, 'ri_' + codeA)).rec.ref, WA);
});
await check('offline/delayed: the invite arrives on a later sync the same day and still binds; next day it does not', async () => {
  const P = 'ln_1000000000004';
  await webSync(P, {}, T0); assert.equal((await webSync(P, { inv: codeA }, T0 + 1000)).rec.ref, WA);
  const Q = 'ln_1000000000005'; await webSync(Q, {}, T0 - DAY); assert.equal((await webSync(Q, { inv: codeA })).rec.ref, null);
});
db.root.telegramLinks = { 8120: 'ln_1000000000020', 9103: 'ln_1000000000021' };
db.root.lunarAccounts = { ln_1000000000020: { id: 'ln_1000000000020', type: 'passkey', name: 'Linked', telegramId: 8120 }, ln_1000000000021: { id: 'ln_1000000000021', type: 'passkey', name: 'Inviter', telegramId: 9103 } };
await check('a linked Telegram + passkey account is one person: no self-alias, canonical inviter', async () => {
  const r = await tgSync(8120, 'ref_8120'); assert.equal(r.pid, 'ln_1000000000020'); assert.equal(r.rec.ref, null);
  const own = await mod.inviteCode(env, 'ln_1000000000020'); assert.equal((await tgSync(8120, 'ri_' + own)).rec.ref, null);
  assert.equal((await tgSync(8121, 'ref_9103')).rec.ref, 'ln_1000000000021');
});
await check('lost public copy of the binding is repaired without re-binding', async () => {
  delete db.root.players.tg_8102.ref; assert.equal((await tgSync(8102, 'ref_9102')).rec.ref, 'tg_9101'); assert.equal(db.get('/players/tg_8102/ref'), 'tg_9101');
});

// ---------- verified days, milestones, phase ----------
await check('one day counts once; only server settlement counts', async () => {
  await tgSync(8130, 'ref_9102');
  await play('tg_8130', T0); await play('tg_8130', T0 + 1000); await tgSync(8130);
  assert.equal(E('tg_8130').vd, 1);
  await play('tg_8130', T0 + DAY); assert.equal(E('tg_8130').vd, 2); assert.equal(E('tg_8130').vdl, day0 + 1);
});
await check('milestones stamp the launch phase when reached (3x), 5% base phase-weighted', async () => {
  const S = E('tg_8130'); assert.deepEqual(S.rms, [3]); assert.ok(S.rb >= 3 * 2400 - 1, 'rb ' + S.rb);
  const rows = await eco.squadRows(env, 'tg_9102'), r = rows.find((x) => x.id === 'tg_8130');
  assert.equal(R.ecoRefOwed(R.ecoNorm({}), r).ms, 1500);
});
await check('phase flips forward only and pins: earlier earnings keep 3x, new ones pay 2x', async () => {
  db.root.meta = Object.assign(db.root.meta || {}, { ap: 10000 }); await mod.airdropBoards(env, T0);
  assert.equal(db.get('/cfg/rph'), 1); eco.resetCfg();
  const rb0 = E('tg_8130').rb; await play('tg_8130', T0 + 2 * DAY, 1000); assert.equal(E('tg_8130').rb - rb0, 2000);
  db.root.meta.ap = 50; await mod.airdropBoards(env, T0); assert.equal(db.get('/cfg/rph'), 1, 'never moves back');
  for (const [n, want] of [[9999, 0], [10000, 1], [24999, 1], [25000, 2], [49999, 2], [50000, 3]]) assert.equal(R.refPhaseOf(n, 0), want);
  assert.deepEqual([0, 1, 2, 3].map(R.refPhaseX), [3, 2, 1.5, 1]);
});
await check('welcome bonus: +1,000 once on the recruit\'s 2nd verified day (never multiplied)', async () => {
  const [, r] = await call('/api/act', { initData: initData(8130), a: 'squad' });
  assert.equal(r.out.welcome, 1000); assert.equal(E('tg_8130').rfe >= 1000, true);
  const [, r2] = await call('/api/act', { initData: initData(8130), a: 'squad' }); assert.equal(r2.out.welcome, 0);
});
await check('one level only: a recruit\'s referral points never feed their referrer\'s 5%', async () => {
  const S = E('tg_8130'), play0 = S.earned - S.rfe; assert.ok(S.rb <= play0 * 3, 'rb counts play points only');
});

// ---------- cap, carryover, remainder ----------
await check('5% share: 2,000/day cap, carryover, exact remainder, claims replay safe', () => {
  const X = { day: 20000, week: 2857, rnd: () => 0.5, pk: 'tg_1' }, S = R.ecoNorm({}), rows = [{ id: 'tg_2', rb: 100000, rms: [1, 1, 1] }];
  assert.equal(R.ecoSquad(S, rows, X).pts, 7500 + 2000); assert.equal(S.refPD.a, 2000);
  assert.equal(R.ecoSquad(S, rows, X).pts, 0);
  assert.equal(R.ecoSquad(S, rows, { ...X, day: X.day + 1 }).pts, 2000);
  assert.equal(R.ecoSquad(S, rows, { ...X, day: X.day + 2 }).pts, 1000);
  const S2 = R.ecoNorm({}); assert.equal(R.ecoSquad(S2, [{ id: 'a', rb: 39, rms: [] }], X).pts, 1);
  assert.equal(R.ecoSquad(S2, [{ id: 'a', rb: 59, rms: [] }], { ...X, day: X.day + 1 }).pts, 1, '19 + 20 leftover pays on the next 20');
  const S3 = R.ecoNorm({}); R.ecoAward(S3, 20000, X); assert.equal(R.ecoSquad(S3, rows, X).pts, 0); assert.deepEqual(S3.refC, {});
});
await check('cap holds across a phase change (no bypass)', () => {
  const X = { day: 21000, week: 3000, rnd: () => 0.5, pk: 'tg_1' }, S = R.ecoNorm({});
  assert.equal(R.ecoSquad(S, [{ id: 'x', rb: 300000, rms: [] }], X).pts, 2000);
  assert.equal(R.ecoSquad(S, [{ id: 'x', rb: 900000, rms: [] }], X).pts, 0);
});
await check('parallel claims pay once', async () => {
  for (let i = 0; i < 2; i++) await play('tg_8140', T0 + i * DAY);
  db.root.eco.tg_9101.dailyPts = 0;
  db.root.players.tg_8102 = Object.assign(db.root.players.tg_8102, { rb: 40000, rms: [3, 3], vd: 6, vdl: day0 });
  const res = await Promise.all([1, 2, 3].map(() => call('/api/act', { initData: initData(9101), a: 'squad' })));
  const paid = res.map(([, r]) => r.out.pts).reduce((a, b) => a + b, 0);
  assert.equal(paid, 1500 + 6000 + 2000, 'paid ' + paid);
  eco.resetCfg();   // a restarted server instance: nothing pays twice
  assert.equal((await call('/api/act', { initData: initData(9101), a: 'squad' }))[1].out.pts, 0);
});

// ---------- verified active, match bonus ----------
await check('verified active: 5+ verified days, latest within 7 days, not held', () => {
  const d = 30000;
  assert.equal(R.refVerified({ vd: 5, vdl: d }, d), true); assert.equal(R.refVerified({ vd: 4, vdl: d }, d), false);
  assert.equal(R.refVerified({ vd: 9, vdl: d - 6 }, d), true); assert.equal(R.refVerified({ vd: 9, vdl: d - 7 }, d), false);
  assert.equal(R.refVerified({ vd: 9, vdl: d, held: true }, d), false);
});
await check('match bonus tiers, squad bonus, +100% cap', () => {
  const b = (n) => R.refBonusOf(n);
  assert.equal(b(0), 0); assert.equal(b(1), 0.03); assert.equal(b(5), 0.16); assert.equal(b(10), 0.32);
  assert.equal(b(50), 0.8); assert.equal(b(100), 1); assert.equal(b(500), 1);
});
await check('match bonus is referral points, never phase-multiplied, inside the 20,000 cap', async () => {
  const X = { day: 22000, week: 3143, rnd: () => 0.5, pk: 'tg_1', rx: 3 }, S = R.ecoNorm({ mbx: 0.5 });
  const e0 = S.earned, f0 = S.rfe; const r = R.ecoBonusAward(S, 1000, X); R.ecoRefTrack(S, X, e0, f0);
  assert.equal(r.awarded, 1500); assert.equal(S.rfe, 500); assert.equal(S.rb, 3000, 'only the 1,000 play points, at 3x');
  S.dailyPts = 19800; assert.equal(R.ecoBonusAward(S, 1000, X).awarded, 200, 'cap stays');
});
await check('server sets the match bonus from verified recruits; held recruits count 0', async () => {
  const REC = 'tg_9200'; await tgSync(9200);
  for (let i = 0; i < 6; i++) { const id = 9300 + i; await tgSync(id, 'ref_9200'); for (let k = 0; k < 5; k++) await play('tg_' + id, T0 - (4 - k) * DAY); }
  db.root.fh = Object.assign(db.root.fh || {}, { tg_9305: 1 }); db.root.flags = Object.assign(db.root.flags || {}, { tg_9305: { n: 'x', r: { alt: { t: 1, v: 'shares a device with referrer' } } } });
  const [, r] = await call('/api/squad', { initData: initData(9200) });
  assert.equal(r.me.n, 5); assert.equal(E(REC).mbx, R.refBonusOf(5)); assert.equal(E(REC).vac, 5);
  assert.match(r.squad.find((x) => x.id === 'tg_9305').why, /device or network/);
  assert.match(r.code, /^[a-hjkmnp-z2-9]{8}$/); assert.equal(r.phase.x, 2);
  const e0 = E(REC).earned; const c = await play(REC, T0, 1000); assert.equal(c.awarded, 1000 + Math.round(1000 * R.refBonusOf(5)));
  assert.equal(E(REC).earned - e0, c.awarded);
});
await check('recruit on the referrer\'s device is held with a reason (both), raised once', async () => {
  await call('/api/sync', { initData: initData(9400), did: 'aaaaaaaaaaaaaaaa' });
  await call('/api/sync', { initData: initData(9401, 'ref_9400'), did: 'aaaaaaaaaaaaaaaa' });
  assert.ok(db.get('/flags/tg_9401/r/alt')); assert.ok(db.get('/flags/tg_9400/r/alt')); assert.ok(db.get('/rfx/tg_9401'));
});
await check('nobody can clear their own hold (admin only)', async () => {
  const [s] = await call('/api/admin', { initData: initData(9401), clear: 'tg_9401' }); assert.equal(s, 403);
});

// ---------- airdrop research boards ----------
await check('referral pool: 10+ verified recruits to qualify, sqrt quality, 2% cap, flagged out; distribution off', async () => {
  db.root.rfs = {};
  for (let i = 0; i < 60; i++) db.root.rfs['tg_' + (50000 + i)] = { s: Math.sqrt(30 * (10 + i)), n: 10 + i, q: 30 * (10 + i), t: day0, nm: 'R' + i };
  db.root.rfs.tg_59999 = { s: 999, n: 400, q: 12000, t: day0, nm: 'Whale' };
  db.root.rfs.tg_59998 = { s: 50, n: 9, q: 900, t: day0, nm: 'Short' };
  db.root.rfs.tg_59997 = { s: 60, n: 30, q: 900, t: day0 - 20, nm: 'Stale' };
  db.root.ads = { tg_1: 5000, tg_2: 9000 };
  const { adb, pub } = await mod.airdropBoards(env, T0);
  assert.equal(adb.dist, false); const ids = adb.ref.map((r) => r[0]);
  assert.ok(!ids.includes('tg_59998') && !ids.includes('tg_59997'));
  assert.equal(ids[0], 'tg_59999'); assert.ok(Math.abs(adb.ref[0][5] - 0.02) < 1e-6, 'capped at 2%');
  assert.ok(Math.abs(adb.ref.reduce((a, r) => a + r[5], 0) - 1) < 1e-4, 'leftover redistributed');
  assert.equal(adb.pts[0][0], 'tg_2'); assert.equal(pub.top.length, 25);
  const sh = R.poolShares([1, 1, 1], 0.02); assert.ok(sh.every((x) => x === 0.02), 'too few to fill: cap still holds');
});
await check('points-pool score: referral points at 7.5% (config range 5-10%)', () => {
  assert.equal(R.airdropScore(10000, 4000), 6000 + 300);
  assert.equal(R.adCfg({ refW: 0.5 }).refW, 0.1); assert.equal(R.adCfg({ refW: 0.01 }).refW, 0.05);
});
console.log(`referrals: passed ${passed}, failed ${failed}`);
if (failed) process.exitCode = 1;
