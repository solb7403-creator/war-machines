// ONE-TIME admin operation (owner-authorized, 2026-11-14): give the owner's own account every chassis and every weapon
// for testing: Scout / Vanguard / Titan and Pulse / Twin / Siege at every tier (0 common, 1 rare, 2 epic) plus Moonbeam.
// Only OWNER_PID is touched (hard-coded, not an input). Same pattern as the Nov 1 Epic-chassis grant: Firebase ETag
// conditional PUT (nothing else can be overwritten), an audit entry at grants/<pid>/<gid>, then a re-read that verifies
// every item is owned, selectable in the garage and valid in the lab, and that no other data changed. No payment records.
import { buildSim } from '../../worker/build-sim.mjs';
import { webcrypto } from 'node:crypto';
const { RULES: R } = await import(buildSim());
const PID = 'ln_6392735208728', SECRET = String(process.env.DB || '').trim();
if (!SECRET) throw Error('no db secret');
const B = 'https://warmachines-a6034-default-rtdb.firebaseio.com/', U = (p, q = '') => B + p + '.json?auth=' + SECRET + q;
const note = (t, o) => console.log('::notice title=' + t + '::' + JSON.stringify(o));
const fail = (m) => { console.log('::error::' + m); process.exit(1); };
async function getTag(p) { const r = await fetch(U(p), { headers: { 'X-Firebase-ETag': 'true' } }); if (!r.ok) fail('read ' + p + ' ' + r.status); return { v: await r.json(), tag: r.headers.get('ETag') }; }
async function get(p) { const r = await fetch(U(p)); if (!r.ok) fail('read ' + p + ' ' + r.status); return r.json(); }
const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));
const W = ['pulse', 'twin', 'siege'], C = ['scout', 'vanguard', 'titan'], T = [0, 1, 2];
const have = (S) => ({ w: Object.fromEntries(W.map((k) => [k, T.filter((t) => (S.wOwn?.[k] || []).map(Number).includes(t))])), c: Object.fromEntries(C.map((k) => [k, T.filter((t) => (S.cOwn?.[k] || []).map(Number).includes(t))])), moonbeam: !!S.moonbeam });

const [{ v: S0, tag }, acct] = await Promise.all([getTag('eco/' + PID), get('lunarAccounts/' + PID)]);
if (!S0 || typeof S0 !== 'object') fail('no eco record');
if (!acct || acct.id !== PID) fail('no Lunar account record');
note('before', { rev: S0.rev, mig: S0.mig, lab: !!S0.lab, owned: have(S0) });
if (S0.mig !== 1) fail('account has not finished its one-time migration (mig=' + S0.mig + '); not granting');

const S = JSON.parse(JSON.stringify(S0)), rnd = () => webcrypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32, granted = [];
S.wOwn = S.wOwn || {}; S.cOwn = S.cOwn || {}; S.roll = S.roll || {};
for (const [isW, keys] of [[true, W], [false, C]]) for (const k of keys) for (const t of T) {
  const own = isW ? S.wOwn : S.cOwn, list = (Array.isArray(own[k]) ? own[k] : []).map(Number);
  if (list.includes(t)) continue;
  own[k] = list.concat(t).sort((a, b) => a - b);
  // exactly what opening a crate does for a new item (rules.js ecoOpenBox, kind 'new'): a quality roll for that piece
  const roll = Math.round((R.ROLL_MIN + rnd() * (R.ROLL_MAX - R.ROLL_MIN)) * 100) / 100;
  if (!S.roll[k + ':' + t]) S.roll[k + ':' + t] = roll;
  granted.push({ tk: isW ? 'weapon' : 'chassis', k, t });
}
if (!S.moonbeam) { S.moonbeam = true; granted.push({ tk: 'weapon', k: 'moon', t: 2 }); }
if (!granted.length) { note('nothing to grant', have(S0)); process.exit(0); }
S.rev = (S.rev || 0) + 1; S.t = Date.now();   // like every server write: the phone takes the newer record
const w = await fetch(U('eco/' + PID), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': tag }, body: JSON.stringify(S) });
if (!w.ok) fail(w.status === 412 ? 'record changed meanwhile (412); nothing written. Re-run.' : 'conditional write refused (' + w.status + '); nothing written');
const gid = 'g' + S.t;
const ga = await fetch(U('grants/' + PID + '/' + gid, '&print=silent'), { method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ kind: 'admin', tk: 'all-gear', items: granted, by: 'owner', why: 'Owner-authorized: every chassis and weapon on the owner account for testing', at: S.t, rev: S.rev }) });
if (!ga.ok) fail('audit entry write failed ' + ga.status);

// verify: everything owned, selectable, lab-valid; nothing else changed
const S1 = await get('eco/' + PID), N = R.ecoNorm(JSON.parse(JSON.stringify(S1))), bad = [];
for (const k of W) for (const t of T) { if (!R.hasW(N, k, t)) bad.push('own ' + k + t); const L = R.ecoLoadout(N, { ...(N.L || {}), w: { a: k, t, s: false } }); if (L.w.a !== k || L.w.t !== t) bad.push('select ' + k + t); }
for (const k of C) for (const t of T) { if (!R.hasC(N, k, t)) bad.push('own ' + k + t); const L = R.ecoLoadout(N, { ...(N.L || {}), c: { c: k, t, s: false } }); if (L.c.c !== k || L.c.t !== t) bad.push('select ' + k + t); }
{ const L = R.ecoLoadout(N, { ...(N.L || {}), w: { a: 'moon', t: 2, s: false } }); if (L.w.a !== 'moon') bad.push('select moon'); }
if (N.lab) { const M = N.lab.machines[N.lab.active], sp = JSON.parse(JSON.stringify(M.spec));
  for (const [w2, c2] of [[{ a: 'siege', t: 2, s: false }, { c: 'titan', t: 0, s: false }], [{ a: 'twin', t: 1, s: false }, { c: 'scout', t: 2, s: false }], [{ a: 'moon', t: 2, s: false }, { c: 'vanguard', t: 1, s: false }]]) {
    const e = R.labValidate(N, { ...sp, w: w2, c: c2 }); if (e) bad.push('lab ' + w2.a + w2.t + '/' + c2.c + c2.t + ': ' + e); } }
const strip = (x) => { const c = JSON.parse(JSON.stringify(x)); delete c.rev; delete c.t; delete c.wOwn; delete c.cOwn; delete c.roll; delete c.moonbeam; return c; };
const unchanged = stable(strip(S1)) === stable(strip(S0)) && S1.rev === (S0.rev || 0) + 1;
const rollsKept = Object.keys(S0.roll || {}).every((k) => S1.roll[k] === S0.roll[k]);
const audit = await get('grants/' + PID + '/' + gid);
note('verify', { granted: granted.length, after: have(S1), otherDataUnchanged: unchanged, oldRollsKept: rollsKept, problems: bad, auditSaved: !!audit, rev: S1.rev });
if (bad.length || !unchanged || !rollsKept || !audit) fail('verification failed: see verify notice');
