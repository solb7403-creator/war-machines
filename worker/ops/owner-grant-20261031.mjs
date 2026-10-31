// ONE-TIME owner-requested promotional grant (Oct 31 2026). Operator-only: run by a manually triggered CI job that already
// holds FIREBASE_DB_SECRET. Not imported by the worker, no endpoint, no effect on any other account or on new players.
// Grants exactly: Lunar Skin, Colossus (titan tier 2), Moonbeam, Gold Plate paint. No payment, no spendGram, no receipt.
// Writes with the same ETag/if-match CAS the worker uses (eco.js tx), so an overlapping game save is never overwritten.
// Defaults to a dry run; EXECUTE must be exactly "yes". Logs field names and booleans only, never the record.
export const TARGET = 'ln_6392735208728';
export const GRANT_ID = 'owner-four-gear-20261031';
export const ITEMS = ['skin:lunar', 'chassis:titan:2', 'weapon:moon', 'paint:gold'];
const EPIC_MIN_ROLL = 1.05;   // ROLL_MIN in js/rules.js: the lowest legitimate crate roll
const DB = 'https://warmachines-a6034-default-rtdb.firebaseio.com';

const tiers = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []).filter((x) => x !== null && x !== undefined).map(Number);

// Pure: what this grant would change on one raw stored record. Never touches anything but the listed fields.
export function planGrant(pid, raw, account, now) {
  if (pid !== TARGET) return { ok: false, reason: 'target' };
  if (!account || typeof account !== 'object' || account.id !== pid) return { ok: false, reason: 'identity' };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'missing' };
  if (raw.mig !== 1) return { ok: false, reason: 'migration' };   // mig 0 = phone move pending; don't grant into it
  if (raw.grants && raw.grants[GRANT_ID]) return { ok: true, done: true, changes: [] };   // one time only
  const S = JSON.parse(JSON.stringify(raw)), changes = [];
  if (S.skin !== 'lunar') { S.skin = 'lunar'; changes.push('skin'); }
  if (S.moonbeam !== true) { S.moonbeam = true; changes.push('moonbeam'); }
  if (!S.paints || typeof S.paints !== 'object' || Array.isArray(S.paints)) S.paints = {};
  if (!S.paints.gold) { S.paints.gold = 1; changes.push('paints.gold'); }
  if (!S.cOwn || typeof S.cOwn !== 'object' || Array.isArray(S.cOwn)) S.cOwn = {};
  const t = [...new Set(tiers(S.cOwn.titan))];
  if (!t.includes(2)) { t.push(2); t.sort((a, b) => a - b); changes.push('cOwn.titan'); }
  S.cOwn.titan = t;
  if (!S.roll || typeof S.roll !== 'object' || Array.isArray(S.roll)) S.roll = {};
  if (!(Number(S.roll['titan:2']) >= EPIC_MIN_ROLL)) { S.roll['titan:2'] = EPIC_MIN_ROLL; changes.push('roll.titan:2'); }
  S.grants = { ...(S.grants && typeof S.grants === 'object' ? S.grants : {}), [GRANT_ID]: { d: '2026-10-31', at: now, items: ITEMS, kind: 'owner_promo', paid: 0 } };
  changes.push('grants.' + GRANT_ID);
  S.rev = (Number(S.rev) || 0) + 1; S.t = now;   // as eco.js tx does, so the phone re-syncs
  return { ok: true, done: false, changes, next: S };
}

export async function runGrant({ pid, secret, execute = false, fetchImpl = fetch, now = Date.now(), base = DB } = {}) {
  if (pid !== TARGET) throw new Error('refused: target is not the one authorized account');
  if (!secret) throw new Error('refused: no database credential');
  const url = (p) => `${base}/${p}.json?auth=${encodeURIComponent(secret)}`;
  const get = async (p, tag) => {
    const r = await fetchImpl(url(p), tag ? { headers: { 'X-Firebase-ETag': 'true' } } : {});
    if (!r.ok) throw new Error('read failed ' + r.status);
    return { v: await r.json(), tag: tag ? r.headers.get('ETag') || '' : '' };
  };
  const putIf = async (p, v, tag) => {
    const r = await fetchImpl(url(p), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': tag }, body: JSON.stringify(v) });
    if (r.status === 412) return false;
    if (!r.ok) throw new Error('write failed ' + r.status);
    return true;
  };
  const account = (await get('lunarAccounts/' + pid)).v;
  const ops = `ops/grants/${GRANT_ID}/${pid}`;
  for (let i = 0; i < 8; i++) {
    const { v: raw, tag } = await get('eco/' + pid, true);
    const plan = planGrant(pid, raw, account, now);
    if (!plan.ok) return { status: 'stopped', reason: plan.reason };
    if (plan.done) return { status: 'already_granted', changes: [] };
    if (!execute) return { status: 'dry_run', changes: plan.changes, rev: raw.rev || 0 };
    // private rollback snapshot of this one record (deny-all path), kept from the first attempt only
    const b = await get(ops + '/backup', true);
    if (b.v === null && !(await putIf(ops + '/backup', { rev: raw.rev || 0, at: now, eco: raw }, b.tag))) continue;
    if (await putIf('eco/' + pid, plan.next, tag)) {
      const a = await get(ops + '/done', true);
      if (a.v === null) await putIf(ops + '/done', { at: now, rev: plan.next.rev, items: ITEMS, changes: plan.changes }, a.tag);
      return { status: 'granted', changes: plan.changes, rev: plan.next.rev };
    }
  }
  throw new Error('busy: record kept changing, nothing written');
}

// Read back the one record and check all four survive the game's own normalization (ecoNorm) and Garage validation.
export async function verify({ pid, secret, RULES, fetchImpl = fetch, base = DB }) {
  if (pid !== TARGET) throw new Error('refused');
  const r = await fetchImpl(`${base}/eco/${pid}.json?auth=${encodeURIComponent(secret)}`);
  const S = RULES.ecoNorm(JSON.parse(JSON.stringify(await r.json())));
  const spec = (S.lab && S.lab.machines && S.lab.machines[S.lab.active] || {}).spec;
  const tryFit = (patch) => !spec || RULES.labValidate(S, { ...spec, ...patch }) === null;
  return {
    skin: S.skin === 'lunar', moonbeam: S.moonbeam === true && tryFit({ w: { a: 'moon', t: 2, s: false } }),
    colossus: S.cOwn.titan.includes(2) && tryFit({ c: { c: 'titan', t: 2, s: false } }), gold: !!S.paints.gold && tryFit({ paint: 'gold' }),
    marker: !!(S.grants && S.grants[GRANT_ID]), bays: S.lab ? Object.keys(S.lab.slots || {}).length : 0, mig: S.mig,
  };
}

// CLI: node worker/ops/owner-grant-20261031.mjs  (env: FIREBASE_DB_SECRET, GRANT_PID, EXECUTE=yes for the real write)
if (import.meta.url === `file://${process.argv[1]}`) {
  const pid = String(process.env.GRANT_PID || '');
  const out = await runGrant({ pid, secret: (process.env.FIREBASE_DB_SECRET || '').trim(), execute: process.env.EXECUTE === 'yes' });
  console.log('RESULT ' + JSON.stringify(out));
  if (process.env.EXECUTE === 'yes' || out.status === 'already_granted') {
    const { RULES } = await import('../src/sim.gen.js');
    console.log('READBACK ' + JSON.stringify(await verify({ pid, secret: (process.env.FIREBASE_DB_SECRET || '').trim(), RULES })));
  }
  if (out.status === 'stopped') process.exit(2);
}
