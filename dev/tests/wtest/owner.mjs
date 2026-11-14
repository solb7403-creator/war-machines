// Owner-only Epic gem caches (worker/src/owner.js) through the real Worker routes: only ln_6392735208728, reached by the
// pinned Telegram admin linked to it or by a website session on it, can open them; each is a real ecoOpenBox roll in the
// normal eco transaction; nothing paid, spent or counted; everyone else gets 403 and the record is untouched.
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db = makeDB();
const realFetch = globalThis.fetch;
let beforePut = null;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) {
    if (beforePut && init && init.method === 'PUT' && u.includes('/eco/ln_6392735208728.json')) { const f = beforePut; beforePut = null; f(); }
    return db.handle(url, init);
  }
  if (u.startsWith('https://api.telegram.org/')) return new Response(JSON.stringify({ ok: true, result: true }));
  throw new Error('unexpected fetch ' + u);
};
const mod = await import('../../../worker/src/index.js');
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const { OWNER_PID } = await import('../../../worker/src/owner.js');
const { newSession } = await import('../../../worker/src/web-auth.js');
const { checkLoadout } = await import('../../../worker/src/pvp.js');
const worker = mod.default;
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET', WEB_ORIGIN: 'https://game.test', WEB_LOGIN_ENABLED: '1' };
const objects = new Map();
env.SESSIONS = { idFromName: (n) => n, get(n) { if (!objects.has(n)) {
  let q = Promise.resolve(); const vals = new Map();
  const state = { storage: { get: async (k) => structuredClone(vals.get(k)), put: async (k, v) => vals.set(k, structuredClone(v)), deleteAll: async () => vals.clear(), setAlarm: async () => {} }, blockConcurrencyWhile(fn) { const r = q.then(fn); q = r.catch(() => {}); return r; } };
  objects.set(n, new mod.WebSession(state)); } return { fetch: (url, opts) => objects.get(n).fetch(new Request(url, opts)) }; } };
function initData(user) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest()).update(dcs).digest('hex'));
  return p.toString();
}
const tg = async (path, user, body = {}) => { const r = await worker.fetch(new Request('https://x' + path, { method: 'POST', headers: { Origin: 'https://solb7403-creator.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify({ gv:6, initData: initData(user), ...body }) }), env); return [r.status, await r.json()]; };
const web = async (path, sess, body = {}) => { const r = await worker.fetch(new Request(env.WEB_ORIGIN + path, { method: 'POST', headers: { Origin: env.WEB_ORIGIN, 'Content-Type': 'application/json', Cookie: sess.cookie.split(';')[0], 'X-Lunar-CSRF': sess.csrf }, body: JSON.stringify({gv:6,...body}) }), env); return [r.status, await r.json()]; };
let ok = 0, bad = 0; const t = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const E = () => JSON.parse(JSON.stringify(db.get('/eco/' + OWNER_PID)));
const OPEN = { a: 'owner_gem_epic' };

// the owner: Telegram 999 (@LunarBattle, pinned admin), linked both ways to ln_6392735208728
const J = { id: 999, username: 'LunarBattle' };
db.root.cfg = { admin: { lunarbattle: 999 } };
db.root.telegramLinks = { 999: OWNER_PID };
db.root.lunarAccounts = { [OWNER_PID]: { id: OWNER_PID, type: 'password', name: 'Lunar', telegramId: 999 } };
let [s, r] = await tg('/api/sync', J, { boot: true, lab: 1 });
{const before=JSON.stringify(E());const [st,result]=await tg('/api/owner',J,{a:'owner_gem_epic',gv:undefined});t(st===409&&result.error==='update','stale client rejected before unknown gem reward');t(JSON.stringify(E())===before,'stale client cannot mutate account');}
t(s === 200 && r.pid === OWNER_PID, 'owner Telegram identity resolves to the linked record ' + s + ' ' + r.pid);
// a real-looking owner record: some points, purchases, spend, a prior grant
{ const S = db.root.eco[OWNER_PID]; S.pts = 4321; S.earned = 9000; S.spendGram = 12.5; S.ptsSpent = 300; S.buys = { 'gem:2': 3, 'weapon:1': 1 }; S.starter = true; S.grants = { 'owner-four-gear-20261031': { kind: 'owner_promo', paid: 0 } }; }
db.root.payments = { p1: { pid: OWNER_PID, cur: 'STARS', amt: 100 } };
const payBefore = JSON.stringify(db.root.payments), starsBefore = JSON.stringify(db.get('/starsPaid'));

// replay the outs on the before-record with the shared rules' own shard table: must land exactly where the server did
function replay(S0, outs) {
  const gl = { ...S0.gemLvl }, gs = { ...S0.gemShards };
  for (const o of outs) { gs[o.gem] += o.n; while (gl[o.gem] < 5 && gs[o.gem] >= R.SHARD_NEED[gl[o.gem]]) { gs[o.gem] -= R.SHARD_NEED[gl[o.gem]]; gl[o.gem]++; } }
  return { gl, gs };
}
const SAME = ['pts', 'earned', 'spendGram', 'ptsSpent', 'buys', 'starter', 'founder', 'ac', 'dailyPts', 'weeklyPts', 'wOwn', 'cOwn', 'roll', 'up', 'paints', 'moonbeam', 'skin', 'pass', 'rsCr', 'vg', 'mp'];
async function openAndCheck(label, call, n) {
  const S0 = E();
  const randomBefore=Math.random; let st,res;
  try { Math.random=()=>0.999; [st,res]=await call(); } finally { Math.random=randomBefore; }
  const S1 = E();
  t(st === 200 && res.ok && res.out.outs.length === n, label + ': ' + n + ' caches opened ' + st + ' ' + JSON.stringify(res).slice(0, 200));
  if (st !== 200) return;
  const outs = res.out.outs;
  t(outs.every((o) => o.tk === 'gem' && o.ri === 2 && R.GORDER.includes(o.gem) && o.n >= 11 && o.n <= 14), label + ': every result an Epic gem cache roll (11-14 shards)');
  t(outs.every(o=>o.gem==='vel'),label+': owner caches support Velocity');
  const rp = replay(S0, outs);
  t(JSON.stringify(rp.gl) === JSON.stringify(S1.gemLvl) && JSON.stringify(rp.gs) === JSON.stringify(S1.gemShards), label + ': core levels and shards exactly as ecoOpenBox gives ' + JSON.stringify(S1.gemLvl));
  t(SAME.every((k) => JSON.stringify(S0[k]) === JSON.stringify(S1[k])), label + ': no points, payment, spend, buys or gear fields changed ' + SAME.filter((k) => JSON.stringify(S0[k]) !== JSON.stringify(S1[k])).join(','));
  t(S1.rev === S0.rev + 1, label + ': rev +1 (' + S0.rev + ' -> ' + S1.rev + ')');
  t(S1.grants.owner_gem.n === (S0.grants.owner_gem ? S0.grants.owner_gem.n : 0) + n && S1.grants.owner_gem.paid === 0 && S1.grants['owner-four-gear-20261031'], label + ': audit count on the record, earlier grant kept');
  t(res.E._rev === S1.rev && JSON.stringify(res.E.gemLvl) === JSON.stringify(S1.gemLvl), label + ': reply carries the saved record');
  { const N = R.ecoNorm(S1), spec = { ...N.lab.machines[N.lab.active].spec, cores: R.GORDER.slice(0, 3) }; const v = R.labValidate(N, spec); t(v === null, label + ': a build with three levelled cores passes labValidate ' + v); }
}
await openAndCheck('owner Telegram, 1', () => tg('/api/admin', J, OPEN), 1);
await openAndCheck('owner Telegram, 10', () => tg('/api/admin', J, { ...OPEN, n: 10 }), 10);
await openAndCheck('owner Telegram via /api/owner, n clamped to 10', () => tg('/api/owner', J, { ...OPEN, n: 99 }), 10);
// a concurrent game save lands between the read and the write: the CAS retries and keeps it
beforePut = () => { db.root.eco[OWNER_PID].cmark = 'concurrent'; db.root.eco[OWNER_PID].rev++; };
const c0 = db.conflicts || 0;
[s, r] = await tg('/api/admin', J, { ...OPEN, n: 5 });
t(s === 200 && r.out.outs.length === 5, 'concurrent save: still opened');
t((db.conflicts || 0) > c0, 'the stale write was refused (412) and retried');
t(E().cmark === 'concurrent', 'concurrent save not overwritten (record re-read, then written)');
{ const S = E(); t(S.grants.owner_gem.n === 26, 'audit total across opens ' + S.grants.owner_gem.n); }
// auditable ops log: one entry per call
const ops = Object.values(db.get('/ops/owner_gem') || {});
t(ops.length === 4 && ops.every((o) => o.pid === OWNER_PID && o.via === 'tg' && o.gems.length === o.n) && ops.map((o) => o.n).join() === '1,10,10,5', 'ops log per open ' + ops.map((o) => o.n).join());
t(JSON.stringify(db.root.payments) === payBefore && JSON.stringify(db.get('/starsPaid')) === starsBefore, 'no payment records written');
// match tickets still issue with the levelled cores (AI match loadout check), and no flags raised
{ const N = R.ecoNorm(E()), id = N.lab.active, M = N.lab.machines[id];
  [s, r] = await tg('/api/act', J, { a: 'lab_save', id, rev: N.lab.rev, name: M.name, spec: { ...M.spec, cores: R.GORDER.slice(0, 3), catalog: R.FIT_VERSION } });
  t(s === 200 && r.out && r.out.ok, 'garage saves a build with three owner-levelled cores ' + JSON.stringify(r.out)); }
{ const N = R.ecoNorm(E());
  [s, r] = await tg('/api/match/start', J, { g: 'arena', m: '1v1', map: 'classic', pv: 1, labRev: N.lab.rev, fv: R.FIT_VERSION });
  t(s === 200 && r.ok && r.tok, 'AI match ticket issued after owner caches ' + s + ' ' + JSON.stringify(r).slice(0, 160));
  t(r.L && JSON.stringify(r.L.gl) === JSON.stringify(N.gemLvl), 'the ticket loadout carries the server core levels ' + JSON.stringify(r.L && r.L.gl)); }
{ const L = await checkLoadout(env, R, {}, E()); t(JSON.stringify(L.gl) === JSON.stringify(E().gemLvl) && L.cores.length === 3, 'live PvP join loadout check: server core levels pass ' + JSON.stringify(L.cores)); }
t(!db.get('/flags/' + OWNER_PID), 'no spend or farm flag raised');

// ---- everyone else: 403, record untouched ----
const frozen = JSON.stringify(E());
const opsN = () => Object.keys(db.get('/ops/owner_gem') || {}).length, ops0 = opsN();
const A = { id: 111, username: 'alice' };
[s] = await tg('/api/admin', A, OPEN); t(s === 403, 'non-owner Telegram user: /api/admin 403');
[s] = await tg('/api/owner', A, OPEN); t(s === 403, 'non-owner Telegram user: /api/owner 403');
[s] = await tg('/api/owner', { id: 1000, username: 'LunarBattle' }, OPEN); t(s === 403, 'admin username on a different (unpinned) Telegram id: 403');
[s] = await tg('/api/owner', { id: 999, username: 'someoneelse' }, OPEN); t(s === 403, 'owner Telegram id without the admin username: 403');
// a different admin-pinned id (the pin moved to another Telegram account, not linked to the owner record)
db.root.cfg.admin.lunarbattle = 1001;
[s] = await tg('/api/admin', { id: 1001, username: 'LunarBattle' }, OPEN); t(s === 403, 'a different admin-pinned id: 403');
[s] = await tg('/api/admin', J, OPEN); t(s === 403, 'owner id no longer pinned: 403');
db.root.cfg.admin.lunarbattle = 999;
// a linked-but-wrong account: owner username + pin, but telegramLinks points elsewhere
db.root.telegramLinks[999] = 'ln_123456789012';
[s] = await tg('/api/owner', J, OPEN); t(s === 403, 'admin linked to another account: 403');
db.root.telegramLinks[999] = OWNER_PID;
// website sessions
const other = await newSession(env, { id: 5555, first_name: 'Other' }, 'ln_123456789012', { via: 'password' });
[s] = await web('/api/owner', other, OPEN); t(s === 403, 'website account other than the owner: 403');
const fake = await newSession(env, { id: 999, username: 'LunarBattle' }, 'ln_123456789012', { via: 'password' });
[s] = await web('/api/owner', fake, OPEN); t(s === 403, 'website session claiming the admin user on another account: 403');
// unauthenticated
let rr = await worker.fetch(new Request('https://x/api/owner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(OPEN) }), env);
t(rr.status === 401 || rr.status === 403, 'unauthenticated: refused (' + rr.status + ')');
rr = await worker.fetch(new Request('https://x/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...OPEN, initData: 'user=%7B%22id%22%3A999%2C%22username%22%3A%22LunarBattle%22%7D&hash=bad' }) }), env);
t(rr.status === 401 || rr.status === 403, 'forged Telegram login: refused (' + rr.status + ')');
t(JSON.stringify(E()) === frozen && opsN() === ops0, 'every refused call left the owner record and the ops log untouched');
t(!db.get('/eco/ln_123456789012') || !(db.get('/eco/ln_123456789012').grants || {}).owner_gem, 'the other account got nothing');
t(E().grants.owner_gem.n === 26, 'owner count unchanged by refused calls');

// the owner's own website session: allowed; and if the account's Telegram link is broken, refused
const mine = await newSession(env, { id: 999, first_name: 'Lunar' }, OWNER_PID, { via: 'password' });
await openAndCheck('owner website session, 5', () => web('/api/owner', mine, { ...OPEN, n: 5 }), 5);
[s] = await web('/api/admin', mine, OPEN); t(s === 403, 'website /api/admin stays Telegram-only (403)');
db.root.lunarAccounts[OWNER_PID].telegramId = 1234;
const f2 = JSON.stringify(E());
[s] = await web('/api/owner', mine, OPEN); t(s === 403, 'owner website session with a broken Telegram link: 403');
t(JSON.stringify(E()) === f2, 'record untouched');
db.root.lunarAccounts[OWNER_PID].telegramId = 999;
// an unknown action on /api/owner
[s] = await web('/api/owner', mine, { a: 'grant_everything' }); t(s === 400, 'unknown owner action: 400');

console.log(`passed ${ok}, failed ${bad}`);
if (bad) process.exitCode = 1;
