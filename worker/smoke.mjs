// CI smoke test for live matches in the real Workers runtime (wrangler dev, Durable Objects and all):
// two pilots join a live 1v1 queue, meet in one room over real WebSockets, and the fight streams snapshots.
// CI: npm exec --yes --package=wrangler@4 --call='node smoke-runtime.mjs' (isolated Firebase).
import { createHmac } from 'node:crypto';
const BASE = process.env.SMOKE_URL || 'http://127.0.0.1:8787', TOKEN = process.env.SMOKE_BOT_TOKEN || 'smoke-token';
const fail = (m) => { console.error('SMOKE FAIL:', m); process.exit(1); };
const initData = (user) => {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(TOKEN).digest()).update(dcs).digest('hex'));
  return p.toString();
};
const L = { w: { a: 'pulse', t: 0, q: 1, s: false }, c: { c: 'vanguard', t: 0, q: 1, s: false }, up: { hull: 0, cannon: 0, engine: 0, target: 0, reactor: 0 }, cores: ['dmg', 'rof', 'arm'], gl: {}, skin: 'default', paint: 'stock', chs: [] };
const join = async (u) => {
  const r = await fetch(BASE + '/api/pvp/join', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://solb7403-creator.github.io' }, body: JSON.stringify({ initData: initData(u), v: 1, g: 'arena', m: '1v1', L }) });
  const j = await r.json().catch(() => ({}));
  if (r.status !== 200 || !j.ok) fail('join ' + r.status + ' ' + JSON.stringify(j));
  return j;
};
const health = await (await fetch(BASE + '/pvp/health')).json().catch(() => null);
if (!health || !health.ok) fail('health ' + JSON.stringify(health));
const a = await join({ id: 91001, username: 'smokea' }), b = await join({ id: 91002, username: 'smokeb' });
if (a.room !== b.room || a.seat === b.seat) fail('not matched together ' + JSON.stringify([a, b]));
const open = (j) => new Promise((res, rej) => {
  const ws = new WebSocket(BASE.replace(/^http/, 'ws') + '/pvp/ws?r=' + j.room + '&t=' + encodeURIComponent(j.tok));
  const msgs = [];
  ws.onmessage = (e) => msgs.push(JSON.parse(e.data));
  ws.onopen = () => res({ ws, msgs });
  ws.onerror = () => rej(new Error('socket error'));
});
const A = await open(a).catch((e) => fail(e.message)), B = await open(b).catch((e) => fail(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 100 && !A.msgs.some((m) => m.k === 'f'); i++) await wait(100);
const kinds = (s) => [...new Set(s.msgs.map((m) => m.k))].join(',');
if (!A.msgs.some((m) => m.k === 'go') || !B.msgs.some((m) => m.k === 'go' && m.flip)) fail('no VS roster: ' + kinds(A) + ' / ' + kinds(B));
if (!A.msgs.some((m) => m.k === 'f')) fail('fight never started: ' + kinds(A));
const n0 = A.msgs.filter((m) => m.k === 's').length;
A.ws.send(JSON.stringify({ k: 'm', x: 10, y: 27, tp: 0 }));
await wait(1000);
const snaps = A.msgs.filter((m) => m.k === 's'), n1 = snaps.length - n0;
if (n1 < 10) fail('too few snapshots in a second: ' + n1);
const me = snaps[snaps.length - 1].s.u[a.seat];
if (Math.abs(me[1] - 27) > 0.3) fail('server did not follow the move: ' + JSON.stringify(me));
B.ws.send(JSON.stringify({ k: 'q' }));
await wait(800);
if (!B.msgs.some((m) => m.k === 'res' && m.r.quit)) fail('quit result not received');
A.ws.close(); B.ws.close();
console.log('SMOKE OK: matched in one room, VS, fight,', n1, 'snapshots/s, moves followed');
process.exit(0);
