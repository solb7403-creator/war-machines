// Time /api/match/start through the real Worker (auth + route + eco.matchStart) against the fake Firebase with a fixed
// latency per database call (Cloudflare -> Firebase is ~80-300 ms a call), a populated ghost pool, and optionally one
// write conflict (another write lands between read and write, as when two requests race). Reports wall time and the
// database calls made, per mode x team size. usage: node dev/tests/wtest/ticket-latency.mjs [msPerCall=150] [conflict=0|1]
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const LAT = +(process.argv[2] || 150), CONFLICT = process.argv[3] === '1';
const db = makeDB();
let calls = 0, conflictNext = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
globalThis.fetch = async (url, init = {}) => {
  if (!url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) throw new Error('unexpected fetch ' + url);
  calls++; await sleep(LAT);
  if (conflictNext && init.method === 'PUT' && /\/eco\//.test(url)) { conflictNext = false; return new Response('{}', { status: 412 }); }
  return db.handle(url, init);
};
const { default: worker } = await import('../../../worker/src/index.js');
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' };
function initData(user) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const call = async (body) => { const r = await worker.fetch(new Request('https://x/api/match/start', { method: 'POST', headers: { Origin: 'https://solb7403-creator.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env); return r.json(); };
// a pilot with a record and power, and 40 offline pilots in the ghost pool around that power
const U = { id: 4242, username: 'tester' }, pid = 'tg_4242', L = structuredClone(R.STOCK_L), pw = R.powerOf(L);
db.root.players = { [pid]: { power: pw, pts: 100 } };
db.root.gh = {}; for (let i = 0; i < 40; i++) db.root.gh['tg_' + (9000 + i)] = { n: 'G' + i, L, pw: pw - 10 + (i % 15), t: Date.now() - 3600000 };
db.root.eco = { [pid]: { ...R.ecoNorm({}), mig: 1, mp: 20 } };
const rows = [];
for (const g of R.GT_ORDER) for (const m of g === 'royale' ? ['1v1'] : ['1v1', '2v2', '3v3']) {
  calls = 0; conflictNext = CONFLICT;
  const t0 = Date.now(), r = await call({ initData: initData(U), g, m, map: 'longshot', L, pv: 1, fv: R.FIT_VERSION, cid: Math.random().toString(16).slice(2, 18).padEnd(16, '0') });
  rows.push({ mode: g + ' ' + m, ms: Date.now() - t0, dbCalls: calls, ok: !!(r && r.tok), ghosts: (r && r.gh || []).length });
}
console.table(rows);
console.log('per-call latency', LAT, 'ms', CONFLICT ? '+ one write conflict' : '', '| max', Math.max(...rows.map((r) => r.ms)), 'ms');
