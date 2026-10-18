// Local stand-in for the LUNAR server + database, for browser tests.
// Runs the real worker code (worker/src) against an in-memory database, with local Durable Objects and a small
// WebSocket server, so two browser pages can play a live match against each other.
import http from 'node:http';
import { createHmac, createHash } from 'node:crypto';
import { makeDB } from './wtest/fakedb.mjs';
import { makeNamespace, installWebSocketPair } from './wtest/fakedo.mjs';
import { buildSim } from '../../worker/build-sim.mjs';
buildSim();
installWebSocketPair();
const db = makeDB();
const tgCalls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init);
  if (String(url).startsWith('https://api.telegram.org/')) { const body = JSON.parse(init.body); tgCalls.push([String(url).split('/').pop(), body]); return new Response(JSON.stringify({ ok: true, result: 'https://t.me/$invoice' })); }
  if (String(url).startsWith('https://toncenter.com/')) return new Response(JSON.stringify({ result: [] }));
  return new Response('{}', { status: 404 });
};
const mod = await import('../../worker/src/index.js');
const pvp = await import('../../worker/src/pvp.js');
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' };
const resetPvp = (waitMs, all) => { if (waitMs) env.PVP_WAIT_MS = String(waitMs); else delete env.PVP_WAIT_MS; if (all) env.PVP_ALL = '1'; else delete env.PVP_ALL; env.ROOM = makeNamespace(pvp.PvpRoom, env); env.LOBBY = makeNamespace(pvp.PvpLobby, env); };
resetPvp(Number(process.env.PVP_WAIT_MS) || 0);
export function initData(user) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const rooms = () => [...env.ROOM.live.entries()].filter(([, r]) => r.core).map(([id, r]) => ({ id, core: r.core }));
const port = Number(process.argv[2] || 8787);
const server = http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  const u = new URL(req.url, 'http://x');
  const send = (code, obj, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
  try {
    if (u.pathname === '/__initdata') return send(200, { initData: initData(JSON.parse(u.searchParams.get('user'))) });
    if (u.pathname === '/__cron') { await mod.buildLeaderboard(env); return send(200, { ok: true }); }
    if (u.pathname === '/__dump') return send(200, db.root);
    if (u.pathname === '/__tg') return send(200, tgCalls);
    if (u.pathname === '/__set') { const { path, value } = JSON.parse(body); const r = await db.handle(`https://warmachines-a6034-default-rtdb.firebaseio.com/${path}.json?auth=SECRET`, { method: 'PUT', body: JSON.stringify(value) }); return send(200, { ok: r.ok }); }
    // live matches: reset with a different wait, look at rooms, or poke a room's sim (tests only)
    if (u.pathname === '/__pvpreset') { resetPvp(Number(u.searchParams.get('wait')) || 0, u.searchParams.get('all') === '1'); return send(200, { ok: true }); }
    if (u.pathname === '/__pvp') return send(200, rooms().map(({ id, core }) => ({ id, ...core.info(), units: core.sim ? core.sim.units.map((x) => ({ id: x.id, team: x.team, pid: x.pid || null, ctl: x.ctl, hp: Math.round(x.hp), x: +x.x.toFixed(2), y: +x.y.toFixed(2), sup: !!x.sup, dash: !!x.dash, cls: x.cls })) : [] })));
    if (u.pathname === '/__pvpeval') { const { code } = JSON.parse(body); const out = new Function('rooms', code)(rooms()); return send(200, { ok: true, out: out === undefined ? null : out }); }
    if (u.pathname.startsWith('/db/')) { const path = u.pathname.slice(4).replace(/\.json$/, ''); return send(200, JSON.stringify(db.get('/' + path))); }
    const r = await mod.default.fetch(new Request('https://lunar-api.solb7403.workers.dev' + u.pathname + u.search, { method: req.method, headers: { 'Content-Type': 'application/json', Origin: 'https://solb7403-creator.github.io' }, body: req.method === 'POST' ? body : undefined }), env);
    res.writeHead(r.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(await r.text());
  } catch (e) { send(500, { error: String(e) }); }
});
// ---- a minimal WebSocket server (RFC 6455): the browser's socket <-> the worker's WebSocketPair end ----
const frame = (op, payload) => {
  const n = payload.length; let head;
  if (n < 126) head = Buffer.from([0x80 | op, n]);
  else if (n < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([head, payload]);
};
server.on('upgrade', async (req, socket) => {
  try {
    const r = await mod.default.fetch(new Request('https://lunar-api.solb7403.workers.dev' + req.url, { headers: { Upgrade: 'websocket' } }), env);
    if (r.status !== 101 || !r.webSocket) { socket.end(`HTTP/1.1 ${r.status} No\r\nConnection: close\r\n\r\n`); return; }
    const ws = r.webSocket;
    ws.accept();
    const acc = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
    let open = true, buf = Buffer.alloc(0), parts = [];
    const shut = () => { if (!open) return; open = false; try { socket.end(frame(0x8, Buffer.from([0x03, 0xe8]))); } catch (e) {} };
    ws.addEventListener('message', (e) => { if (open) socket.write(frame(0x1, Buffer.from(String(e.data)))); });
    ws.addEventListener('close', shut);
    socket.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        if (buf.length < 2) break;
        const op = buf[0] & 0x0f, fin = buf[0] & 0x80, masked = buf[1] & 0x80;
        let len = buf[1] & 0x7f, p = 2;
        if (len === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); p = 4; }
        else if (len === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); p = 10; }
        const need = p + (masked ? 4 : 0) + len;
        if (buf.length < need) break;
        const pl = Buffer.from(buf.subarray(p + (masked ? 4 : 0), need));
        if (masked) { const m = buf.subarray(p, p + 4); for (let i = 0; i < pl.length; i++) pl[i] ^= m[i & 3]; }
        buf = buf.subarray(need);
        if (op === 0x8) { open = false; try { socket.end(frame(0x8, Buffer.from([0x03, 0xe8]))); } catch (e) {} try { ws.close(1000, 'bye'); } catch (e) {} return; }
        if (op === 0x9) { socket.write(frame(0xA, pl)); continue; }
        if (op === 0x1 || op === 0x0) { parts.push(pl); if (fin) { const text = Buffer.concat(parts).toString(); parts = []; try { ws.send(text); } catch (e) {} } }
      }
    });
    const gone = () => { if (open) { open = false; } try { ws.close(1006, 'gone'); } catch (e) {} };
    socket.on('close', gone); socket.on('error', gone);
  } catch (e) { try { socket.end('HTTP/1.1 500 Error\r\n\r\n'); } catch (_) {} }
});
server.listen(port, () => console.log('devserver on', port));
