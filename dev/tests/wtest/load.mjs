// Load test: a marketing-push spike against the real server code. New pilots arrive (sync, daily reward, matches with
// records, quest claims, squad), hundreds of matches end at the same moment, then the 5-minute cron (board, farm check)
// and reminders run at that size. The database is the in-memory stand-in with a network delay on every call.
// Reports what the hosting limits are measured in: requests, CPU per request, database calls and bytes downloaded.
// node dev/tests/wtest/load.mjs [players, default 3000] [at once, default 300]
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { fakeRec } from './fakerec.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const NP = Number(process.argv[2]) || 3000, CONC = Number(process.argv[3]) || 300, RTT = 25;
const db = makeDB();
let dbCalls = 0, dbDown = 0, tgSent = 0;
const byPath = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.fetch = async (url, init) => {
  if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) {
    dbCalls++; await sleep(RTT);
    const r = await db.handle(url, init), txt = await r.text(); dbDown += txt.length;
    const u = new URL(url), k = (init && init.method || 'GET') + ' ' + decodeURIComponent(u.pathname).replace(/\.json$/, '').split('/').slice(0, 2).join('/') + (u.searchParams.get('orderBy') ? '?' : '');
    const e = byPath[k] || (byPath[k] = [0, 0]); e[0]++; e[1] += txt.length;
    return new Response(r.status === 204 ? null : txt, { status: r.status, headers: r.headers });
  }
  if (url.startsWith('https://api.telegram.org/')) { tgSent++; await sleep(RTT); return new Response(JSON.stringify({ ok: true, result: { status: 'left' } })); }
  throw new Error('unexpected fetch ' + url);
};
const mod = await import('../../../worker/src/index.js');
const worker = mod.default;
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET', NTF_BATCH: '200' };
function initData(user) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const lat = [], errs = {};
let reqs = 0, cpuUs = 0;
async function call(path, body, ip) {
  const h = { Origin: 'https://solb7403-creator.github.io', 'Content-Type': 'application/json', 'CF-Connecting-IP': ip };
  const t0 = performance.now(), c0 = process.cpuUsage();
  const r = await worker.fetch(new Request('https://x' + path, { method: 'POST', headers: h, body: JSON.stringify(body) }), env);
  const out = await r.json().catch(() => null);
  const c1 = process.cpuUsage(c0); cpuUs += c1.user + c1.system;   // includes other requests running at once: an upper bound
  lat.push(performance.now() - t0); reqs++;
  if (r.status !== 200 || (out && out.ok === false && out.error && !['claimed', 'no'].includes(out.error))) errs[path + ' ' + r.status + ' ' + (out && out.error)] = (errs[path + ' ' + r.status + ' ' + (out && out.error)] || 0) + 1;
  return out;
}
// one new pilot's first session: open the game, daily reward, 3 AI matches with records, a quest claim, the squad tab
async function pilot(i) {
  const u = { id: 70000000 + i, username: 'p' + i }, ip = '10.' + (i >> 16 & 255) + '.' + (i >> 8 & 255) + '.' + (i & 255), id = initData(u);
  await call('/api/sync', { initData: id, boot: true, did: (i.toString(16) + '0000000000000000').slice(0, 16), dh: 'ab' }, ip);
  await call('/api/act', { initData: id, a: 'login' }, ip);
  for (let m = 0; m < 3; m++) {
    const st = await call('/api/match/start', { initData: id, g: 'arena', m: '2v2', map: 'classic', pv: 1 }, ip);
    if (!st || !st.tok) continue;
    // the match itself happens on the phone; the result comes back with its record (the test skips the wait: the
    // server checks the time against the ticket, so the ticket is backdated by the length of the match)
    const pid = 'tg_' + u.id, S = db.root.eco[pid]; S.mt.t0 -= 70000;
    const sig = createHmac('sha256', env.BOT_TOKEN).update('match|' + `${pid}|${S.mt.n}|${S.mt.t0}`).digest('hex').slice(0, 24);
    await call('/api/match/end', { initData: id, tok: S.mt.n + '.' + sig, r: { won: m !== 1, stats: { dmg: 2200, kills: 1 }, pf: fakeRec({ g: 'arena', m: '2v2', won: m !== 1, dur: 60, dmg: 2200, steer: i * 7 + m + 1 }) } }, ip);
  }
  await call('/api/act', { initData: id, a: 'daily', id: 'play4' }, ip);
  await call('/api/squad', { initData: id }, ip);
}
async function pool(n, conc, fn) { let next = 0; await Promise.all(Array.from({ length: conc }, async () => { while (next < n) await fn(next++); })); }
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return Math.round(b[Math.min(b.length - 1, Math.floor(b.length * p))]); };
console.log(`spike: ${NP} new pilots, ${CONC} at once, ${RTT} ms per database call`);
let t0 = performance.now();
await pool(NP, CONC, pilot);
const secs = (performance.now() - t0) / 1000;
const ecoSz = Object.values(db.root.eco || {}).map((S) => JSON.stringify(S).length);
console.log(`  ${reqs} requests in ${secs.toFixed(1)} s (${Math.round(reqs / secs)}/s), latency p50 ${q(lat, 0.5)} ms p95 ${q(lat, 0.95)} ms p99 ${q(lat, 0.99)} ms`);
console.log(`  errors: ${JSON.stringify(errs)}`);
console.log(`  CPU ${(cpuUs / 1000 / reqs).toFixed(2)} ms per request (upper bound), database ${(dbCalls / reqs).toFixed(1)} calls and ${(dbDown / reqs / 1024).toFixed(1)} KB down per request, write conflicts ${db.conflicts}`);
console.log('  database downloads by path (calls, KB): ' + Object.entries(byPath).sort((a, b) => b[1][1] - a[1][1]).slice(0, 10).map(([k, v]) => k + ' ' + v[0] + '/' + Math.round(v[1] / 1024)).join(', '));
console.log(`  per pilot: ${(reqs / NP).toFixed(0)} requests, ${(dbDown / NP / 1024).toFixed(0)} KB down; record size avg ${Math.round(ecoSz.reduce((a, b) => a + b, 0) / ecoSz.length / 1024 * 10) / 10} KB, max ${Math.round(Math.max(...ecoSz) / 1024 * 10) / 10} KB`);
// hundreds of matches ending at the same moment
{
  lat.length = 0; const c0 = dbCalls; let e0 = JSON.stringify(errs);
  const ids = Array.from({ length: CONC }, (_, i) => i);
  await Promise.all(ids.map(async (i) => {
    const u = { id: 70000000 + i, username: 'p' + i }, id = initData(u), ip = '10.0.' + (i >> 8) + '.' + (i & 255);
    await call('/api/match/start', { initData: id, g: 'arena', m: '2v2', map: 'classic', pv: 1 }, ip);
  }));
  t0 = performance.now();
  await Promise.all(ids.map(async (i) => {
    const u = { id: 70000000 + i, username: 'p' + i }, id = initData(u), ip = '10.0.' + (i >> 8) + '.' + (i & 255), pid = 'tg_' + u.id, S = db.root.eco[pid];
    S.mt.t0 -= 90000; const sig = createHmac('sha256', env.BOT_TOKEN).update('match|' + `${pid}|${S.mt.n}|${S.mt.t0}`).digest('hex').slice(0, 24);
    await call('/api/match/end', { initData: id, tok: S.mt.n + '.' + sig, r: { won: true, stats: { dmg: 2000 }, pf: fakeRec({ g: 'arena', m: '2v2', won: true, dur: 80, dmg: 2000, steer: 9000 + i }) } }, ip);
  }));
  console.log(`burst: ${CONC} results at the same moment in ${((performance.now() - t0) / 1000).toFixed(1)} s, p95 ${q(lat.slice(CONC), 0.95)} ms, errors ${JSON.stringify(errs) === e0 ? 'none new' : JSON.stringify(errs)}`);
}
// the 5-minute cron at this size, and reminders for everyone
{
  for (let i = 0; i < NP; i++) await db.handle(`https://warmachines-a6034-default-rtdb.firebaseio.com/ntf/tg_${70000000 + i}.json?auth=SECRET`, { method: 'PATCH', body: JSON.stringify({ on: 1, chat: 70000000 + i, nx: 1 }) });
  let c0 = dbCalls, d0 = dbDown; t0 = performance.now(); let cpu = process.cpuUsage();
  await mod.buildLeaderboard(env);
  cpu = process.cpuUsage(cpu);
  console.log(`cron board + farm check: ${((performance.now() - t0) / 1000).toFixed(1)} s, CPU ${((cpu.user + cpu.system) / 1000).toFixed(0)} ms, ${dbCalls - c0} database calls, ${((dbDown - d0) / 1024).toFixed(0)} KB down; lb.json ${(JSON.stringify(db.root.lb).length / 1024).toFixed(0)} KB`);
  const at = new Date(Date.now() + 86400000); at.setUTCHours(15, 1, 0, 0);   // tomorrow: everyone here played today
  let sent = 0, runs = 0; t0 = performance.now(); c0 = dbCalls;
  while (sent < NP && runs < 200) { const n = await mod.sendReminders(env, at.getTime() + runs * 60000, 200); runs++; sent += n; if (!n) break; }
  console.log(`reminders: ${sent} of ${NP} sent in ${runs} runs of 200 (${((performance.now() - t0) / 1000).toFixed(1)} s), ${((dbCalls - c0) / runs).toFixed(1)} database calls per run`);
}

// CPU per request, one at a time (the spike numbers above run 300 at once, so their CPU is shared)
{
  const k0 = reqs; let c = process.cpuUsage(); const t1 = performance.now();
  for (let i = 0; i < 100; i++) await pilot(NP + 1000 + i);
  c = process.cpuUsage(c);
  const n = reqs - k0, wall = performance.now() - t1;
  console.log(`one at a time: ${n} requests, CPU ${((c.user + c.system) / 1000 / n).toFixed(2)} ms per request (Node; includes the in-memory database and test code), ${(wall / n).toFixed(0)} ms each with ${RTT} ms database calls`);
}
