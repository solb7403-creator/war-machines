// node worker/build-sim.mjs && node worker/ops/owner-grant-20261031.test.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { RULES } from '../src/sim.gen.js';
import { TARGET, GRANT_ID, planGrant, runGrant, verify } from './owner-grant-20261031.mjs';

// in-memory Firebase RTDB: GET (with ETag), conditional PUT (if-match -> 412 on mismatch)
function fakeDb(init, hook) {
  const db = JSON.parse(JSON.stringify(init)), writes = [];
  const at = (p) => p.split('/').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), db) ?? null;
  const set = (p, v) => { const ks = p.split('/'), last = ks.pop(); let o = db; for (const k of ks) o = o[k] ??= {}; o[last] = JSON.parse(JSON.stringify(v)); };
  const etag = (v) => createHash('md5').update(JSON.stringify(v)).digest('hex');
  const fetchImpl = async (u, o = {}) => {
    const url = new URL(u), p = decodeURIComponent(url.pathname.slice(1).replace(/\.json$/, ''));
    assert.equal(url.searchParams.get('auth'), 'S3CRET');
    if (!o.method) { const v = at(p); return { ok: true, status: 200, headers: { get: () => etag(v) }, json: async () => JSON.parse(JSON.stringify(v)) }; }
    if (hook) await hook(p, set);
    if (o.headers['if-match'] !== etag(at(p))) return { ok: false, status: 412 };
    writes.push(p); set(p, JSON.parse(o.body)); return { ok: true, status: 200 };
  };
  return { db, writes, fetchImpl, at };
}
const now = Date.UTC(2026, 9, 31, 12);
const owner = () => {
  const S = RULES.ecoNorm({ mig: 1, rev: 41, pts: 12345, earned: 99000, spendGram: 3.5, vg: 7, vgg: 7, ac: 88000, dailyPts: 500, weeklyPts: 2000 });
  S.cOwn.titan = [0, 1]; S.roll['titan:1'] = 1.08; S.paints.founder = 1; S.wOwn.rail = [1]; S.roll['rail:1'] = 1.06;
  RULES.labEnsure(S); S.lab.machines.m_spare.name = 'Second Bay'; return JSON.parse(JSON.stringify(S));
};
const other = () => JSON.parse(JSON.stringify({ ...RULES.ecoNorm({ mig: 1, rev: 9, pts: 50, earned: 50 }), nm: 'LUNAR' }));
const seed = () => ({ eco: { [TARGET]: owner(), ln_1111111111111: other(), tg_6392735208: other() },
  lunarAccounts: { [TARGET]: { id: TARGET, name: 'x' }, ln_1111111111111: { id: 'ln_1111111111111' } },
  starsPaid: { [TARGET]: { a: { k: 'skin' } } }, payments: { p1: { pid: TARGET, verified: true } }, players: { [TARGET]: { pts: 99000 } } });
const run = (D, o = {}) => runGrant({ pid: TARGET, secret: 'S3CRET', fetchImpl: D.fetchImpl, now, base: 'https://db.test', ...o });

// 1. dry run is the default and writes nothing
{ const D = fakeDb(seed()); const r = await run(D); assert.equal(r.status, 'dry_run'); assert.deepEqual(D.writes, []);
  assert.deepEqual(r.changes, ['skin', 'moonbeam', 'paints.gold', 'cOwn.titan', 'roll.titan:2', 'grants.' + GRANT_ID]); }

// 2. execute: exact owner gets all four; everything else on the record is unchanged; others byte-identical
const D = fakeDb(seed()), before = JSON.parse(JSON.stringify(D.db));
{ const r = await run(D, { execute: true }); assert.equal(r.status, 'granted'); assert.equal(r.rev, 42);
  const A = D.at('eco/' + TARGET), B = before.eco[TARGET];
  assert.equal(A.skin, 'lunar'); assert.equal(A.moonbeam, true); assert.equal(A.paints.gold, 1); assert.deepEqual(A.cOwn.titan, [0, 1, 2]);
  assert.equal(A.roll['titan:2'], 1.05); assert.equal(A.roll['titan:1'], 1.08); assert.equal(A.paints.founder, 1);
  assert.deepEqual(A.grants[GRANT_ID].items, ['skin:lunar', 'chassis:titan:2', 'weapon:moon', 'paint:gold']); assert.equal(A.grants[GRANT_ID].paid, 0);
  for (const k of ['pts', 'earned', 'spendGram', 'vg', 'vgg', 'ac', 'dailyPts', 'weeklyPts', 'ptsSpent', 'q', 'pass', 'wOwn', 'up', 'gemLvl', 'lab', 'mig'])
    assert.deepEqual(A[k], B[k], k + ' unchanged');
  const changed = Object.keys({ ...A, ...B }).filter((k) => JSON.stringify(A[k]) !== JSON.stringify(B[k])).sort();
  assert.deepEqual(changed, ['cOwn', 'grants', 'moonbeam', 'paints', 'rev', 'roll', 'skin', 't']);
  assert.equal(Object.keys(A.lab.slots).length, 2); assert.equal(A.lab.machines.m_spare.name, 'Second Bay');
  for (const p of ['eco/ln_1111111111111', 'eco/tg_6392735208', 'starsPaid', 'payments', 'players', 'lunarAccounts'])
    assert.equal(JSON.stringify(D.at(p)), JSON.stringify(p.split('/').reduce((o, k) => o[k], before)), p + ' untouched');
  assert.deepEqual(D.writes, [`ops/grants/${GRANT_ID}/${TARGET}/backup`, 'eco/' + TARGET, `ops/grants/${GRANT_ID}/${TARGET}/done`]);
  assert.deepEqual(D.at(`ops/grants/${GRANT_ID}/${TARGET}/backup`).eco, B);   // rollback snapshot = the original
  // re-sync: the game's own normalization + Garage validation see all four as owned and fittable, both bays kept
  const v = await verify({ pid: TARGET, secret: 'S3CRET', RULES, fetchImpl: D.fetchImpl, base: 'https://db.test' });
  assert.deepEqual(v, { skin: true, moonbeam: true, colossus: true, gold: true, marker: true, bays: 2, mig: 1 });
  const S = RULES.ecoNorm(JSON.parse(JSON.stringify(A)));
  const L = RULES.ecoLoadout(S, { w: { a: 'moon', t: 2 }, c: { c: 'titan', t: 2 }, paint: 'gold' });
  assert.equal(L.w.a, 'moon'); assert.equal(L.c.c, 'titan'); assert.equal(L.c.t, 2); assert.equal(L.paint, 'gold'); assert.equal(L.skin, 'lunar');
  // ownership only: the active bay's saved spec is not auto-changed
  assert.deepEqual(A.lab.machines[A.lab.active].spec, B.lab.machines[B.lab.active].spec); }

// 3. retry is idempotent: no second write, no second audit, rev unchanged
{ const n = D.writes.length, rev = D.at('eco/' + TARGET).rev; const r = await run(D, { execute: true });
  assert.equal(r.status, 'already_granted'); assert.equal(D.writes.length, n); assert.equal(D.at('eco/' + TARGET).rev, rev); }

// 4. wrong / unauthorized targets fail closed
await assert.rejects(runGrant({ pid: 'ln_1111111111111', secret: 'S3CRET', execute: true, fetchImpl: D.fetchImpl }), /refused/);
await assert.rejects(runGrant({ pid: 'LUNAR', secret: 'S3CRET', execute: true, fetchImpl: D.fetchImpl }), /refused/);
await assert.rejects(runGrant({ pid: TARGET, secret: '', execute: true, fetchImpl: D.fetchImpl }), /credential/);
assert.equal(planGrant('tg_6392735208', other(), { id: 'tg_6392735208' }, now).reason, 'target');
assert.equal(planGrant(TARGET + '0', owner(), { id: TARGET + '0' }, now).reason, 'target');

// 5. missing record / identity / pending migration: stop, create nothing
{ const s = seed(); delete s.eco[TARGET]; const M = fakeDb(s); assert.equal((await run(M, { execute: true })).reason, 'missing'); assert.deepEqual(M.writes, []); }
{ const s = seed(); delete s.lunarAccounts[TARGET]; const M = fakeDb(s); assert.equal((await run(M, { execute: true })).reason, 'identity'); assert.deepEqual(M.writes, []); }
{ const s = seed(); s.eco[TARGET].mig = 0; const M = fakeDb(s); assert.equal((await run(M, { execute: true })).reason, 'migration'); assert.deepEqual(M.writes, []); }

// 6. concurrency: a match result lands between our read and our write -> 412, re-read, the game's progress survives
{ let fired = false;
  const C = fakeDb(seed(), async (p, set) => { if (p === 'eco/' + TARGET && !fired) { fired = true; const S = C.at(p); S.pts += 777; S.earned += 777; S.rev++; set(p, S); } });
  const r = await run(C, { execute: true }); assert.equal(r.status, 'granted');
  const A = C.at('eco/' + TARGET); assert.equal(A.pts, 12345 + 777); assert.equal(A.earned, 99777); assert.equal(A.rev, 43); assert.equal(A.skin, 'lunar'); }

// 7. never downgrades an existing better roll or drops other titan tiers; Firebase object-shaped arrays handled
{ const S = owner(); S.cOwn.titan = { 0: 0, 1: 2 }; S.roll['titan:2'] = 1.09; const p = planGrant(TARGET, S, { id: TARGET }, now);
  assert.deepEqual(p.next.cOwn.titan, [0, 2]); assert.equal(p.next.roll['titan:2'], 1.09); assert.ok(!p.changes.includes('cOwn.titan')); }

// 8. new players and stock templates get none of it (rules untouched)
{ const N = RULES.ecoNorm({}); assert.equal(N.skin, 'default'); assert.equal(N.moonbeam, false); assert.ok(!N.paints.gold); assert.ok(!N.cOwn.titan.includes(2)); }

// 9. payment-provenance audit (migrate) never re-runs on this record: mig stays 1
assert.equal(D.at('eco/' + TARGET).mig, 1);
console.log('owner-grant tests: all passed');
