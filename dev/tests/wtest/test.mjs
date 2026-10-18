import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
const db = makeDB();
const tgCalls = [];
globalThis.fetch = async (url, init) => {
  if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init);
  if (url.startsWith('https://api.telegram.org/')) { const body = JSON.parse(init.body); tgCalls.push([url.split('/').pop(), body]); return new Response(JSON.stringify({ ok: true, result: 'https://t.me/$invoice' })); }
  if (url.startsWith('https://toncenter.com/')) return new Response(JSON.stringify({ result: [{ in_msg: { value: '8000000000', message: 'LWM|tg_111|abc' }, transaction_id: { hash: 'h1' } }] }));
  throw new Error('unexpected fetch ' + url);
};
const worker = (await import('../../../worker/src/index.js')).default;
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' };
function initData(user, age = 0) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - age), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const call = async (path, body) => { const r = await worker.fetch(new Request('https://x' + path, { method: 'POST', headers: { Origin: 'https://solb7403-creator.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env); return [r.status, await r.json()]; };
const A = { id: 111, username: 'alice' }, B = { id: 222, first_name: 'Bob <script>' }, J = { id: 999, username: 'LunarBattle' };
let ok = 0, bad = 0; const t = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
// unverified
let [s, r] = await call('/api/sync', { initData: 'user=%7B%22id%22%3A1%7D&hash=bad', earned: 500 }); t(s === 401, 'reject bad initData');
[s, r] = await call('/api/sync', { initData: initData(A, 3 * 86400), earned: 500 }); t(s === 401, 'reject stale initData');
// new player
[s, r] = await call('/api/sync', { initData: initData(A), earned: 500, boot: true, power: 72, league: 'ROOKIE' });
t(s === 200 && r.rec.pts === 500 && r.rec.days === 1 && r.credited === 500 && Array.isArray(r.stars), 'new player credited ' + JSON.stringify(r));
t(db.get('/meta/n') === 1, 'player count');
// earned below server: no change
[s, r] = await call('/api/sync', { initData: initData(A), earned: 100 }); t(r.rec.pts === 500 && r.credited === 0, 'no negative');
// big jump limited by burst bucket then daily cap
[s, r] = await call('/api/sync', { initData: initData(A), earned: 1e9 }); t(r.rec.pts <= 500 + 12000 && r.credited > 0, 'bucket limit ' + r.credited);
const p1 = r.rec.pts;
// simulate time passing 10 minutes: bucket refills, daily cap 20k applies
db.root.players.tg_111.t -= 600000;
[s, r] = await call('/api/sync', { initData: initData(A), earned: 1e9 }); t(r.rec.dailyPts === 20000 && r.capped === true, 'daily cap ' + JSON.stringify(r.rec));
// referral: B new with refBy A
[s, r] = await call('/api/sync', { initData: initData(B), earned: 100, refBy: 'tg_111' }); t(r.rec.ref === 'tg_111', 'ref set');
t(db.get('/players/tg_222/name') === 'Bob script', 'name sanitized from telegram: ' + db.get('/players/tg_222/name'));
// cannot change referrer later / self-ref
[s, r] = await call('/api/sync', { initData: initData(B), earned: 150, refBy: 'tg_999' }); t(r.rec.ref === 'tg_111', 'ref fixed');
[s, r] = await call('/api/sync', { initData: initData(J), earned: 10, refBy: 'tg_999' }); t(!r.rec.ref, 'no self ref');
// squad
[s, r] = await call('/api/squad', { initData: initData(A) }); t(r.squad.length === 1 && r.squad[0].id === 'tg_222' && r.squad[0].pts === 150, 'squad ' + JSON.stringify(r));
// days: move B's last day back one day and sync with credit
db.root.players.tg_222.ld -= 1; db.root.players.tg_222.d -= 1; db.root.players.tg_222.t -= 86400000;
[s, r] = await call('/api/sync', { initData: initData(B), earned: 300 }); t(r.rec.days === 2 && r.rec.sk === 2 && r.newDay, 'day 2 streak ' + JSON.stringify(r.rec));
// opening the app without earning does not count a day
db.root.players.tg_222.ld -= 1; db.root.players.tg_222.d -= 1;
[s, r] = await call('/api/sync', { initData: initData(B), earned: 300 }); t(r.rec.days === 2, 'no day without points');
// stars invoice + webhook + recovery + ack
[s, r] = await call('/api/stars-invoice', { initData: initData(A), kind: 'box', tk: 'weapon', ri: 1, price: 16 }); t(s === 200 && r.stars === 1000 && r.nonce, 'stars invoice x2 ' + JSON.stringify(r));
const nonce = r.nonce;
const sec = await (await import('../../../worker/src/index.js')).webhookSecret(env);
const pay = { message: { from: { id: 111, username: 'alice' }, chat: { id: 111, type: 'private' }, successful_payment: { total_amount: 1000, telegram_payment_charge_id: 'ch.1', invoice_payload: JSON.stringify({ u: 111, k: 'box', t: 'weapon', r: 1, g: 16, n: nonce }) } } };
let wr = await worker.fetch(new Request('https://x/api/tg-webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': sec }, body: JSON.stringify(pay) }), env); t(wr.status === 200, 'webhook');
[s, r] = await call('/api/sync', { initData: initData(A), earned: 0, boot: true }); t(r.stars.length === 1 && r.stars[0].n === nonce && r.stars[0].t === 'weapon', 'undelivered stars listed');
[s, r] = await call('/api/sync', { initData: initData(A), earned: 0, boot: true, starsAck: [nonce] }); t(r.stars.length === 0, 'acked stars hidden');
// pay log TON verified via memo
[s, r] = await call('/api/pay-log', { initData: initData(A), cur: 'TON', amt: 8, gram: 8, item: 'Rare Weapon Cache', memo: 'LWM|tg_111|abc', proof: '' }); t(r.ok && r.verified === true, 'ton verified ' + JSON.stringify(r));
[s, r] = await call('/api/pay-log', { initData: initData(A), cur: 'TON', amt: 8, memo: 'LWM|tg_111|abc' }); t(r.dup === true, 'dup ignored');
[s, r] = await call('/api/pay-log', { initData: initData(A), cur: 'TON', amt: 8, memo: 'LWM|tg_222|zzz' }); t(r.error === 'memo', 'memo must be own');
// leaderboard
const lb = await (await import('../../../worker/src/index.js')).buildLeaderboard(env);
t(lb.top[0][0] === 'tg_111' && lb.top.length === 3 && lb.daily.length >= 1, 'lb ' + JSON.stringify(lb).slice(0, 300));
t(db.get('/lb/top').length === 3, 'lb stored');
// admin
[s, r] = await call('/api/admin', { initData: initData(A) }); t(s === 403, 'non-admin refused');
[s, r] = await call('/api/admin', { initData: initData(J) }); t(s === 200 && r.players === 3 && r.revenue.TON === 8 && r.revenue.STARS === 1000, 'admin ' + JSON.stringify(r).slice(0, 300));
// webhook /start registers reminders; reminders send in notify hour
wr = await worker.fetch(new Request('https://x/api/tg-webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': sec }, body: JSON.stringify({ message: { from: { id: 222 }, chat: { id: 222, type: 'private' }, text: '/start' } }) }), env);
t(db.get('/ntf/tg_222/on') === 1, 'start registers ntf');
console.log('tg calls:', tgCalls.map(c => c[0]).join(','));
console.log(`passed ${ok}, failed ${bad}`);
// reminders: at 16:00 UTC, B (opted in via /start, has not played today) gets one message; second run sends nothing
const mod = await import('../../../worker/src/index.js');
const d0 = new Date(); d0.setUTCHours(16, 1, 0, 0);
db.root.players.tg_222.ld = Math.floor(d0.getTime() / 86400000) - 1; db.root.players.tg_222.sk = 3;
const before = tgCalls.length;
const n1 = await mod.sendReminders(env, d0.getTime());
const n2 = await mod.sendReminders(env, d0.getTime() + 300000);
t(n1 === 1 && n2 === 0, 'reminders once ' + n1 + ' ' + n2);
t(/3-day streak/.test(tgCalls[tgCalls.length - 1][1].text), 'streak text: ' + tgCalls[tgCalls.length - 1][1].text);
const d1 = new Date(); d1.setUTCHours(3, 0, 0, 0);
t((await mod.sendReminders(env, d1.getTime())) === 0, 'no reminders off-hours');
// batch 6: paints, the pass, Common crates flat, support + terms commands, admin stats
[s, r] = await call('/api/stars-invoice', { initData: initData(A), kind: 'paint', tk: 'gold', price: 1 }); t(s === 200 && r.stars === 300, 'paint invoice fixed price ' + JSON.stringify(r));
[s, r] = await call('/api/stars-invoice', { initData: initData(A), kind: 'paint', tk: 'stock' }); t(s === 400, 'free paint not sold');
[s, r] = await call('/api/stars-invoice', { initData: initData(A), kind: 'pass', tk: '1', price: 99 }); t(s === 200 && r.stars === 799, 'pass invoice ' + JSON.stringify(r));
[s, r] = await call('/api/stars-invoice', { initData: initData(A), kind: 'box', tk: 'gem', ri: 0, price: 4 }); t(s === 200 && r.stars === 250, 'common crate 250');
const lastInv = tgCalls.filter(c => c[0] === 'createInvoiceLink').pop(); t(/Common Gem Cache/.test(lastInv[1].title), 'invoice title');
const cmd = async (text) => { const n0 = tgCalls.length; await worker.fetch(new Request('https://x/api/tg-webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': sec }, body: JSON.stringify({ message: { from: { id: 333 }, chat: { id: 333, type: 'private' }, text } }) }), env); return tgCalls.slice(n0); };
let out = await cmd('/paysupport'); t(out.length === 1 && /@LunarBattle/.test(out[0][1].text) && /Telegram support can't help/.test(out[0][1].text), 'paysupport reply');
out = await cmd('/terms'); t(out.length === 1 && /terms\.html/.test(out[0][1].text), 'terms reply');
[s, r] = await call('/api/admin', { initData: initData(J) }); t(s === 200 && r.stats && typeof r.stats.conv === 'number' && r.stats.payers >= 1, 'admin stats ' + JSON.stringify(r.stats));
t(db.get('/players/tg_111/fd') !== undefined, 'first day stored');
console.log(`after reminders: passed ${ok}, failed ${bad}`);
