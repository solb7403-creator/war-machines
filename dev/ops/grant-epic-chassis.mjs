// ONE-TIME admin operation (owner-authorized, 2026-11-01): permanently unlock the Epic chassis a pilot is missing.
// Uses the game's own inventory (eco/<pid>.cOwn + its crate-style roll) and the shared rules for validation.
// MODE=inspect reads only. MODE=apply writes with a Firebase ETag conditional PUT (nothing else can be overwritten),
// records an audit entry at grants/<pid>/<gid>, then re-reads and verifies. No payment records are created or changed.
import { buildSim } from '../../worker/build-sim.mjs';
import { webcrypto } from 'node:crypto';
const out = buildSim();
const { RULES: R } = await import(out);
const PID = process.env.PID, MODE = process.env.MODE || 'inspect', SECRET = String(process.env.DB || '').trim();
const EPIC = 2, KEYS = ['scout', 'vanguard', 'titan'], NAMES = { scout: 'Phantom', vanguard: 'Paladin', titan: 'Colossus' };
if (!/^ln_[0-9]{12,15}$/.test(PID || '')) throw Error('bad pid');
if (!SECRET) throw Error('no db secret');
const B = 'https://warmachines-a6034-default-rtdb.firebaseio.com/', U = (p, q = '') => B + p + '.json?auth=' + SECRET + q;
const note = (t, o) => console.log('::notice title=' + t + '::' + JSON.stringify(o));
const fail = (m) => { console.log('::error::' + m); process.exit(1); };
async function getTag(p) { const r = await fetch(U(p), { headers: { 'X-Firebase-ETag': 'true' } }); if (!r.ok) fail('read ' + p + ' ' + r.status); return { v: await r.json(), tag: r.headers.get('ETag') }; }
async function get(p) { const r = await fetch(U(p)); if (!r.ok) fail('read ' + p + ' ' + r.status); return r.json(); }
const owned = (v) => Object.fromEntries(KEYS.map((k) => [NAMES[k], Array.isArray(v?.cOwn?.[k]) ? v.cOwn[k].map(Number).includes(EPIC) : false]));
const flagReasons = (f) => (f && f.r ? Object.keys(f.r).filter((k) => !(f.ok && f.ok[k] >= (f.r[k].t || 0))) : []);
const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));

const [{ v: S0, tag }, acct, fl, prior] = await Promise.all([getTag('eco/' + PID), get('lunarAccounts/' + PID), get('flags/' + PID), get('grants/' + PID)]);
if (!S0 || typeof S0 !== 'object') fail('no eco record for ' + PID);
if (!acct || acct.id !== PID) fail('no Lunar account record for ' + PID);
const before = owned(S0);
note('inspect', { pid: PID, mig: S0.mig, lab: !!S0.lab, rev: S0.rev, epicChassis: before, chassisTiers: S0.cOwn, epicRolls: Object.fromEntries(KEYS.map((k) => [k, S0.roll?.[k + ':2'] ?? null])), migWhy: S0.migWhy || null, openFlags: flagReasons(fl), priorGrants: prior ? Object.keys(prior).length : 0 });
if (MODE !== 'apply') process.exit(0);

// ---- apply ----
if (S0.mig !== 1) fail('account has not finished its one-time migration (mig=' + S0.mig + '): a later migrate() would replace cOwn; not granting');
const have = KEYS.filter((k) => before[NAMES[k]]), miss = KEYS.filter((k) => !before[NAMES[k]]);
if (have.length !== 1 || miss.length !== 2) fail('expected exactly 1 Epic chassis owned and 2 missing, found owned=' + have.join(','));
const S = JSON.parse(JSON.stringify(S0)), rnd = () => webcrypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
S.cOwn = S.cOwn || {}; S.roll = S.roll || {};
const gid = 'g' + Date.now(), granted = [];
for (const k of miss) {
  // exactly what opening an Epic chassis crate does for a new item (rules.js ecoOpenBox, kind 'new')
  const roll = Math.round((R.ROLL_MIN + rnd() * (R.ROLL_MAX - R.ROLL_MIN)) * 100) / 100;
  S.cOwn[k] = (Array.isArray(S.cOwn[k]) ? S.cOwn[k] : []).concat(EPIC);
  S.roll[k + ':' + EPIC] = roll;
  granted.push({ k, t: EPIC, name: NAMES[k], roll });
}
S.rev = (S.rev || 0) + 1; S.t = Date.now();   // like every server write (tx): the phone takes the newer record
const w = await fetch(U('eco/' + PID), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': tag }, body: JSON.stringify(S) });
if (!w.ok) fail(w.status === 412 ? 'record changed meanwhile (412); nothing written. Re-run.' : 'conditional write refused (' + w.status + '); nothing written');
// audit trail: an authorized administrative grant (not a payment), next to the record it explains
const ga = await fetch(U('grants/' + PID + '/' + gid, '&print=silent'), { method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ kind: 'admin', tk: 'chassis', items: granted.map(({ k, t }) => ({ k, t })), by: 'owner', why: 'Owner-authorized unlock of the missing Epic chassis', at: S.t, rev: S.rev }) });
if (!ga.ok) fail('audit entry write failed ' + ga.status);

// ---- verify ----
const S1 = await get('eco/' + PID), after = owned(S1);
const strip = (x) => { const c = JSON.parse(JSON.stringify(x)); delete c.rev; delete c.t; for (const k of miss) { delete c.roll[k + ':' + EPIC]; c.cOwn[k] = (c.cOwn[k] || []).filter((t) => Number(t) !== EPIC); if (!c.cOwn[k].length && !(S0.cOwn && k in S0.cOwn)) delete c.cOwn[k]; } if (c.roll && !Object.keys(c.roll).length && !S0.roll) delete c.roll; if (c.cOwn && !Object.keys(c.cOwn).length && !S0.cOwn) delete c.cOwn; return c; };
const base = JSON.parse(JSON.stringify(S0)); delete base.rev; delete base.t;
const unchanged = stable(strip(S1)) === stable(base) && S1.rev === (S0.rev || 0) + 1;
const N = R.ecoNorm(JSON.parse(JSON.stringify(S1))), sel = {};
for (const k of KEYS) {
  const L = R.ecoLoadout(N, { ...(N.L || {}), c: { c: k, t: EPIC, s: false } });
  let lab = 'no lab';
  if (N.lab) { const M = N.lab.machines[N.lab.active]; lab = R.labValidate(N, { ...JSON.parse(JSON.stringify(M.spec)), c: { c: k, t: EPIC, s: false } }) || 'ok'; }
  sel[NAMES[k]] = { owned: R.hasC(N, k, EPIC), garageLoadout: L.c.c === k && L.c.t === EPIC ? 'selects ' + k + ':2 roll ' + L.c.q : 'FAILED ' + JSON.stringify(L.c), labSave: lab };
}
const audit = await get('grants/' + PID + '/' + gid), fl1 = await get('flags/' + PID);
note('verify', { granted, epicChassis: after, otherDataUnchanged: unchanged, selectable: sel, auditSaved: !!audit, openFlags: flagReasons(fl1), rev: S1.rev });
const ok = unchanged && KEYS.every((k) => after[NAMES[k]] && sel[NAMES[k]].owned && sel[NAMES[k]].garageLoadout.startsWith('selects') && ['ok', 'no lab'].includes(sel[NAMES[k]].labSave)) && !!audit;
if (!ok) fail('verification failed: see verify notice');
