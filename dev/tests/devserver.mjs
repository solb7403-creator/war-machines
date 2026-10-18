// Local stand-in for the LUNAR server + database, for browser tests.
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { makeDB } from './wtest/fakedb.mjs';
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
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' };
export function initData(user) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const port = Number(process.argv[2] || 8787);
http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  const u = new URL(req.url, 'http://x');
  const send = (code, obj, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
  try {
    if (u.pathname === '/__initdata') return send(200, { initData: initData(JSON.parse(u.searchParams.get('user'))) });
    if (u.pathname === '/__cron') { await mod.buildLeaderboard(env); return send(200, { ok: true }); }
    if (u.pathname === '/__dump') return send(200, db.root);
    if (u.pathname === '/__tg') return send(200, tgCalls);
    if (u.pathname === '/__set') { const { path, value } = JSON.parse(body); const r = await db.handle(`https://warmachines-a6034-default-rtdb.firebaseio.com/${path}.json?auth=SECRET`, { method: 'PUT', body: JSON.stringify(value) }); return send(200, { ok: r.ok }); }
    if (u.pathname.startsWith('/db/')) { const path = u.pathname.slice(4).replace(/\.json$/, ''); return send(200, JSON.stringify(db.get('/' + path))); }
    const r = await mod.default.fetch(new Request('https://lunar-api.solb7403.workers.dev' + u.pathname, { method: req.method, headers: { 'Content-Type': 'application/json', Origin: 'https://solb7403-creator.github.io' }, body: req.method === 'POST' ? body : undefined }), env);
    res.writeHead(r.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(await r.text());
  } catch (e) { send(500, { error: String(e) }); }
}).listen(port, () => console.log('devserver on', port));
