// Session 8 (owner brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md): payments certification through the real Worker routes, with
// every switch on. Every purchase path: Stars (Telegram), GRAM (Telegram with the owner's switch on and off; the website) and SOL (the
// website); every price and limit checked on the server; both gaps of Checkpoint 39 (Telegram's pre-checkout re-checks ownership and
// the current price; GRAM and SOL check ownership); SOL quotes fail closed when the price service is down; every payment credited
// exactly once (replays, two tabs, a slow chain, a refund); the Legendary research race of Checkpoint 41 item 6. Fixtures only: a fake
// database, fake Telegram, toncenter, CoinGecko and Solana RPC; no real money or chain.
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { payKit, fakeSol } from './pay.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db = makeDB(), tgCalls = [];
let tonTxs = [], ratesUp = true;
const SOLR = 'A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE', TONR = 'UQAq3MBfPQ7Wqo5kL7631yEDKf2E9GOmZdhOfLUWhUiACfzu', sol = fakeSol(SOLR);
const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey); jwk.kid = 'test-key'; jwk.alg = 'RS256'; jwk.use = 'sig';
let tonCalls = 0, solCalls = 0;
globalThis.fetch = async (url, init) => {
  url = String(url);
  if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init);
  if (url.startsWith('https://api.telegram.org/')) { const body = JSON.parse(init.body); tgCalls.push([url.split('/').pop(), body]); return new Response(JSON.stringify({ ok: true, result: url.endsWith('/createInvoiceLink') ? 'https://t.me/$inv' + tgCalls.length : true })); }
  if (url.startsWith('https://toncenter.com/')) { tonCalls++; return new Response(JSON.stringify({ ok: true, result: tonTxs })); }
  if (url.startsWith('https://api.coingecko.com/')) { if (!ratesUp) throw new Error('down'); return new Response(JSON.stringify({ 'the-open-network': { usd: 2 }, solana: { usd: 100 } })); }
  if (url.startsWith('https://solana-rpc.publicnode.com') || url.startsWith('https://api.mainnet-beta.solana.com')) { solCalls++; return new Response(JSON.stringify(sol.handle(init.body))); }
  if (url === 'https://oauth.telegram.org/.well-known/jwks.json') return Response.json({ keys: [jwk] });
  throw new Error('unexpected fetch ' + url);
};
const mod = await import('../../../worker/src/index.js'), worker = mod.default;
const shop = await import('../../../worker/src/shop.js');
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET', WEB_ORIGIN: 'https://game.test', WEB_LOGIN_ENABLED: '1' };
let ok = 0, bad = 0; const t = (c, m) => { if (c) { ok++; console.log('PASS ' + m); } else { bad++; console.log('FAIL ' + m); } };
const J = JSON.stringify;
function initData(user) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const call = async (path, body) => { const r = await worker.fetch(new Request('https://x' + path, { method: 'POST', headers: { Origin: 'https://solb7403-creator.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify({ gv: 7, ...body }) }), env); return [r.status, await r.json()]; };
const sec = await mod.webhookSecret(env);
const hook = (body) => worker.fetch(new Request('https://x/api/tg-webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': sec }, body: JSON.stringify(body) }), env);
const K = payKit({ call, hook, initData, tgCalls });
const E = (pid) => db.get('/eco/' + pid), setEco = (pid, f) => f(db.root.eco[pid]);
const A = { id: 111, username: 'alice' }, B = { id: 222, username: 'bob' }, ADM = { id: 999, username: 'LunarBattle' };
for (const u of [A, B, ADM]) await call('/api/sync', { initData: initData(u), boot: true });
setEco('tg_111', (S) => { S.pts = 5e6; });

// ======================= the website session (a Telegram login on the website: first-party cookie + CSRF) =======================
const objects = new Map(); env.SESSIONS = { idFromName: (n) => n, get(n) { if (!objects.has(n)) { let q = Promise.resolve(); const vals = new Map(); const state = { storage: { get: async (k) => structuredClone(vals.get(k)), put: async (k, v) => vals.set(k, structuredClone(v)), deleteAll: async () => vals.clear(), setAlarm: async () => {} }, blockConcurrencyWhile(fn) { const r = q.then(fn); q = r.catch(() => {}); return r; } }; objects.set(n, new mod.WebSession(state)); } return { fetch: (url, opts) => objects.get(n).fetch(new Request(url, opts)) }; } };
const wcall = async (path, body, cookies = '', csrf = '') => worker.fetch(new Request(env.WEB_ORIGIN + path, { method: body ? 'POST' : 'GET', headers: { Origin: env.WEB_ORIGIN, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookies ? { Cookie: cookies } : {}), ...(csrf ? { 'X-Lunar-CSRF': csrf } : {}) }, body: body ? JSON.stringify({ gv: 7, ...body }) : undefined }), env);
const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
async function token(nonce) { const now = Math.floor(Date.now() / 1000), s = b64({ alg: 'RS256', kid: 'test-key' }) + '.' + b64({ iss: 'https://oauth.telegram.org', aud: '123', sub: 'web-subject', id: 888001, given_name: 'Web Pilot', iat: now, exp: now + 300, nonce }); return s + '.' + Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(s))).toString('base64url'); }
const cookieFrom = (r, name) => r.headers.getSetCookie().find((c) => c.startsWith(name + '='))?.split(';')[0] || '';
const chal = await wcall('/auth/challenge', {}), chc = cookieFrom(chal, '__Host-lunar-login'), chn = (await chal.json()).nonce;
const logged = await wcall('/auth/login', { id_token: await token(chn) }, chc), sid = cookieFrom(logged, '__Host-lunar-session'), csrf = (await logged.json()).csrf;
const W = async (body) => { const r = await wcall('/api/order', body, sid, csrf); return [r.status, await r.json()]; };
const WP = 'tg_888001';
{ const r = await wcall('/api/sync', { lab: 1 }, sid, csrf), j = await r.json(); t(r.status === 200 && J(j.pay.rails) === J({ stars: false, gram: true, sol: true }), 'website rails: GRAM and SOL, never Stars ' + J(j.pay && j.pay.rails)); }

// ======================= 1. Telegram Stars: the server quote, the pre-checkout re-check, the grant, exactly once =======================
{
  let [s, r] = await call('/api/sync', { initData: initData(A) });
  t(J(r.pay.rails) === J({ stars: true, gram: true, sol: false }), 'Telegram rails: Stars and GRAM (the switch is on by default), no SOL ' + J(r.pay.rails));
  [s, r] = await K.quote(A, 'STARS', { kind: 'box', tk: 'weapon', ri: 1, price: 0.01 });
  const o1 = r.order;
  t(s === 200 && o1.cur === 'STARS' && o1.amt === 500 && o1.price.stars === 500 && /^https:\/\/t\.me\//.test(o1.link), 'a Stars quote: the server prices it (a forged price is ignored): ' + o1.amt + ' Stars');
  const inv = tgCalls.filter((c) => c[0] === 'createInvoiceLink').at(-1)[1];
  t(J(JSON.parse(inv.payload)) === J({ u: 111, q: o1.oid }) && inv.title.length <= 32 && inv.prices[0].amount === 500, 'the invoice carries only the user and the quote id; the title fits Telegram\'s 32 characters');
  [s, r] = await K.quote(A, 'STARS', { kind: 'box', tk: 'weapon', ri: 1 });
  t(r.reused === true && r.order.oid === o1.oid && r.order.link === o1.link, 'two tabs: a second invoice for the same crate is the same invoice (one open quote per item)');
  let p = await K.pre(A, o1, 400);
  t(!p.ok && /price changed/i.test(p.why), 'pre-checkout refuses an invoice total that is not the quote\'s');
  p = await K.pre(A, o1);
  t(p.ok, 'pre-checkout accepts the open quote at the current price');
  const p2 = await K.pre(A, o1, o1.amt, 'other-tab');
  t(!p2.ok && /already being paid/i.test(p2.why), 'two tabs paying the one link at once: the second pre-checkout is refused');
  const w0 = J(E('tg_111').wOwn), b0 = J(E('tg_111').roll);
  await K.paid(A, o1, 'ch.1');
  t(J(E('tg_111').wOwn) !== w0 || J(E('tg_111').roll) !== b0, 'Telegram\'s payment: the server grants the crate');
  t(E('tg_111').buys.weapon1 === 1 && db.get('/orders/tg_111/' + o1.oid + '/st') === 'paid' && db.get('/starsPaid/tg_111/ch_1/o').length === 1, 'the quote is paid, the price step taken, the receipt kept with what it gave');
  await K.paid(A, o1, 'ch.1');
  t(E('tg_111').buys.weapon1 === 1, 'Telegram resending the same payment grants once');
  p = await K.pre(A, o1);
  t(!p.ok && /already bought/i.test(p.why), 'the paid invoice can\'t be paid again (pre-checkout says no)');
  await K.paid(A, o1, 'ch.1b');
  t(E('tg_111').buys.weapon1 === 1 && db.get('/orders/tg_111/' + o1.oid + '/st') === 'paid' && Object.values(db.get('/held') || {}).some((h) => h.oid === o1.oid && h.err === 'duplicate'), 'a second payment of the same quote (a race past the pre-checkout): nothing more granted, the quote stays paid, the payment kept for a refund');
  [s, r] = await call('/api/act', { initData: initData(A), a: 'paid', n: o1.oid });
  t(r.out.outs && r.out.outs.length === 1, 'the phone fetches what its Stars purchase gave');
  [s, r] = await K.status(A, o1.oid);
  t(r.order.st === 'paid' && r.order.out.length === 1 && r.order.tx, 'the order\'s status: paid, with what it gave and the charge');
  [s, r] = await K.quote(A, 'STARS', { kind: 'box', tk: 'weapon', ri: 1 });
  t(r.order.amt === 1000 && r.order.oid !== o1.oid, 'the next rare weapon cache is quoted at the next price step (x2: 1,000 Stars)');
  const o2 = r.order;
  // the price moves while an invoice is open (a purchase landed some other way): the pre-checkout re-checks and refuses
  setEco('tg_111', (S) => { S.buys.weapon1 = 2; });
  p = await K.pre(A, o2);
  t(!p.ok && /price changed/i.test(p.why), 'gap 1: an invoice opened before the price moved can never be paid at the old price');
  setEco('tg_111', (S) => { S.buys.weapon1 = 1; });
  // an item owned while its invoice is open: the pre-checkout refuses
  [s, r] = await K.quote(A, 'STARS', { kind: 'moonbeam' });
  const om = r.order;
  t(om.amt === 3300, 'Moonbeam quoted at 3,300 Stars');
  setEco('tg_111', (S) => { S.moonbeam = true; });
  p = await K.pre(A, om);
  t(!p.ok && /already have/i.test(p.why), 'gap 1: an invoice for an item owned since is refused at the pre-checkout');
  // a payment that lands anyway for an owned item: kept for a refund, nothing granted (never a duplicate)
  await K.paid(A, om, 'ch.mbx');
  t(db.get('/orders/tg_111/' + om.oid + '/st') === 'held' && db.get('/held/' + om.oid + '/err') === 'owned' && E('tg_111').moonbeam === true, 'a payment for an owned item lands held (nothing granted, listed for a refund)');
  setEco('tg_111', (S) => { S.moonbeam = false; delete S.ord; });
  let res = await K.stars(A, { kind: 'moonbeam' }, 'ch.mb');
  t(res.pre.ok && E('tg_111').moonbeam === true, 'Moonbeam bought: pre-checkout, payment, granted');
  [s, r] = await K.quote(A, 'STARS', { kind: 'moonbeam' });
  t(s === 409 && r.error === 'owned', 'a one-time item is never quoted twice');
  await K.refund(A, 'ch.mb', 3300);
  t(E('tg_111').moonbeam === false && db.get('/starsPaid/tg_111/ch_mb/rf') > 0 && db.get('/orders/tg_111/' + res.o.oid + '/st') === 'refunded', 'a Stars refund takes the Moonbeam back; the order shows refunded');
  await K.refund(A, 'ch.mb', 3300);
  t(E('tg_111').rfd.filter((x) => x === 'ch_mb').length === 1, 'the same refund twice: taken back once');
  const steps = E('tg_111').buys.weapon1;
  await K.refund(A, 'ch.1', 500);
  t(E('tg_111').buys.weapon1 === steps - 1, 'a refunded crate steps its price back (Checkpoint 39 finding 2)');
  t(db.get('/flags/tg_111/r/refunds'), 'two refunds flag the pilot');
  // the daily deal: one at most, even across two quotes of different caches
  setEco('tg_111', (S) => { delete S.ord; delete S.dealD; });
  [s, r] = await K.quote(A, 'STARS', { kind: 'box', tk: 'gem', ri: 1, deal: 'd', c: 'vanguard' });
  const od = r.order;
  t(od.price.deal === 'd' && od.amt === Math.round(500 * 0.7), 'the first rare gem cache of the day at 30% off');
  [s, r] = await K.quote(A, 'STARS', { kind: 'box', tk: 'gem', ri: 2, deal: 'd', c: 'vanguard' });
  t(s === 200 && r.order.oid !== od.oid && !r.order.price.deal && r.order.amt === 1500 && db.get('/orders/tg_111/' + od.oid + '/st') === 'open', 'the daily deal is held by the first open quote: a second cache is quoted without it (never two at 30% off)');
  // forged and wrong payloads: never granted
  const pts0 = E('tg_111').pts, earned0 = E('tg_111').earned;
  await K.paid(A, { oid: 'zzzzzzzzzz', amt: 1 }, 'ch.forged', 1, { u: 111, k: 'moonbeam', n: 'x' });
  t(E('tg_111').moonbeam === false && db.get('/held/st_ch_forged/err') === 'no quote', 'a payment with no quote of ours grants nothing (logged for the owner)');
  t(E('tg_111').pts === pts0 && E('tg_111').earned === earned0, 'purchases never give points');
}
// ======================= 2. GRAM in Telegram: memo + amount, each transaction once, the owner's switch =======================
{
  setEco('tg_111', (S) => { delete S.ord; });
  let [s, r] = await K.quote(A, 'TON', { kind: 'box', tk: 'weapon', ri: 0, price: 0.001 });
  const o = r.order;
  t(s === 200 && o.cur === 'TON' && o.amt === 4 && o.base === '4000000000' && o.memo === 'LWM|tg_111|' + o.oid && o.to === TONR, 'a GRAM quote: 4 GRAM to the owner\'s wallet, the exact nanoGRAM and its memo (a forged price is ignored)');
  [s, r] = await K.status(A, o.oid);
  t(r.pending === true && r.order.st === 'open', 'no payment on chain yet: pending, nothing granted');
  tonTxs = [K.tonTx(o, 'h0', { value: '3000000000' })];
  shop.resetTonCache(); await new Promise((z) => setTimeout(z, 4100));
  [s, r] = await K.status(A, o.oid);
  t(r.pending === true && r.short === '3000000000' && r.order.st === 'open', 'the memo found but 3 GRAM for a 4 GRAM quote: not granted');
  tonTxs.unshift(K.tonTx(o, 'h1'));
  shop.resetTonCache(); await new Promise((z) => setTimeout(z, 4100));
  const w0 = J([E('tg_111').wOwn, E('tg_111').roll]);
  const two = await Promise.all([K.status(A, o.oid), K.status(A, o.oid)]);
  r = two.find(([, x]) => x.order.st === 'paid')?.[1] || two[0][1];
  t(r.order.st === 'paid' && r.order.tx === 'h1' && J([E('tg_111').wOwn, E('tg_111').roll]) !== w0, 'GRAM verified on chain (memo + amount) and granted by the server');
  t(db.get('/tonTx/h1/oid') === o.oid, 'the transaction is claimed once, for this quote');
  const n1 = E('tg_111').buys.weapon0 | 0;
  shop.resetTonCache(); await new Promise((z) => setTimeout(z, 4100));
  [s, r] = await K.status(A, o.oid);
  t(r.order.st === 'paid' && n1 === 1 && (E('tg_111').buys.weapon0 | 0) === n1, 'status again (two tabs, a replay): nothing new granted (one crate)');
  [s, r] = await K.quote(A, 'TON', { kind: 'box', tk: 'weapon', ri: 0 });
  const o2 = r.order;
  tonTxs.unshift({ ...K.tonTx(o2, 'h1') });
  shop.resetTonCache(); await new Promise((z) => setTimeout(z, 4100));
  [s, r] = await K.status(A, o2.oid);
  t(s === 409 && r.error === 'reused', 'one transaction pays for one quote only');
  [s, r] = await K.status(B, o2.oid);
  t(s === 404, 'another pilot can\'t read or claim your quote');
  // the GRAM switch: the admin turns GRAM off in Telegram in one step (no release); the website keeps GRAM
  [s, r] = await call('/api/admin', { initData: initData(ADM), gramTg: 'off' });
  t(s === 200 && r.gramTg === false && db.get('/cfg/gramTg') === 0, 'the admin switch: GRAM in Telegram OFF');
  [s, r] = await K.quote(A, 'TON', { kind: 'box', tk: 'chassis', ri: 0 });
  t(s === 403 && r.error === 'gram_off', 'switch off: a Telegram GRAM quote is refused on the server');
  [s, r] = await W({ a: 'quote', cur: 'TON', desc: { kind: 'box', tk: 'chassis', ri: 0 } });
  t(s === 200 && r.order.cur === 'TON', 'switch off: the website still sells with GRAM');
  await W({ a: 'cancel', q: r.order.oid });
  [s, r] = await call('/api/sync', { initData: initData(A) });
  t(r.pay.rails.gram === false && r.pay.rails.stars === true, 'switch off: Telegram shows Stars only');
  await hook({ message: { from: { id: 222, username: 'bob' }, chat: { id: 222, type: 'private' }, text: '/gram on' } });
  t(db.get('/cfg/gramTg') === 0 && /owner/.test(tgCalls.at(-1)[1].text), 'a player can\'t flip the switch from the bot');
  await hook({ message: { from: { id: 999, username: 'LunarBattle' }, chat: { id: 999, type: 'private' }, text: '/gram on' } });
  t(db.get('/cfg/gramTg') === 1 && /ON/.test(tgCalls.at(-1)[1].text), 'the owner flips it back on from the bot: /gram on');
  [s, r] = await K.quote(A, 'TON', { kind: 'box', tk: 'chassis', ri: 0 });
  t(s === 200, 'switch on: Telegram GRAM quotes again');
  await K.cancel(A, r.order.oid);
  [s, r] = await K.quote(A, 'SOL', { kind: 'box', tk: 'chassis', ri: 0 });
  t(s === 403 && r.error === 'sol_web', 'SOL is website-only: a Telegram SOL quote is refused');
}
// ======================= 3. gap 2: GRAM and SOL check ownership; two tabs across rails; a slow chain; a late payment =======================
{
  setEco('tg_111', (S) => { delete S.ord; S.paints = { stock: 1, gold: 1 }; });
  let [s, r] = await K.quote(A, 'TON', { kind: 'paint', id: 'gold' });
  t(s === 409 && r.error === 'owned', 'gap 2: no GRAM quote for an item already owned');
  [s, r] = await K.quote(A, 'TON', { kind: 'paint', id: 'nebula' });
  const o = r.order;
  t(s === 200 && o.amt === R.PAINTS.nebula.ton, 'a GRAM quote for a paint not owned yet');
  [s, r] = await K.quote(A, 'TON', { kind: 'paint', id: 'nebula' });
  t(r.reused === true && r.order.oid === o.oid && r.order.memo === o.memo, 'two tabs: the second GRAM request returns the same quote (same memo and amount)');
  [s, r] = await K.quote(A, 'STARS', { kind: 'paint', id: 'nebula' });
  t(s === 409 && r.error === 'open_order' && r.order.oid === o.oid, 'a Stars invoice while a GRAM payment may be on its way: refused, with the open GRAM order to finish or cancel');
  [s, r] = await K.cancel(A, o.oid);
  t(r.order.st === 'cancelled' && !Object.keys(E('tg_111').ord || {}).length, 'cancel: the quote and its reservation go');
  const res = await K.stars(A, { kind: 'paint', id: 'nebula' }, 'ch.neb');
  t(res.pre.ok && E('tg_111').paints.nebula === 1, 'then paid with Stars');
  tonTxs.unshift(K.tonTx(o, 'hlate'));
  shop.resetTonCache(); await new Promise((z) => setTimeout(z, 4100));
  [s, r] = await K.status(A, o.oid);
  t(r.order.st === 'held' && r.order.err === 'owned' && db.get('/held/' + o.oid + '/err') === 'owned', 'gap 2: the cancelled GRAM quote paid late, after the Stars purchase: held for a refund, never a second copy');
  // a slow chain: pending until the payment shows, then granted; a payment after the quote's expiry still counts while nothing newer holds the item
  setEco('tg_111', (S) => { delete S.ord; });
  [s, r] = await K.quote(A, 'TON', { kind: 'paint', id: 'ember' });
  const oe = r.order;
  for (let i = 0; i < 2; i++) { shop.resetTonCache(); await new Promise((z) => setTimeout(z, 4100)); [s, r] = await K.status(A, oe.oid); }
  t(r.pending === true && r.order.st === 'open', 'a slow chain: still pending after two checks');
  db.root.orders.tg_111[oe.oid].e = Date.now() - 1000;   // the quote's 30 minutes are over
  setEco('tg_111', (S) => { for (const v of Object.values(S.ord || {})) v.e = Date.now() - 120000; });
  tonTxs.unshift(K.tonTx(oe, 'hslow'));
  shop.resetTonCache(); await new Promise((z) => setTimeout(z, 4100));
  [s, r] = await K.status(A, oe.oid);
  t(r.order.st === 'paid' && E('tg_111').paints.ember === 1, 'the slow payment lands after the expiry: granted (nothing newer holds the item, the price unchanged)');
}
// ======================= 4. SOL on the website: live rates or no quote (fail closed), the reference, exactly once =======================
{
  let [s, r] = await W({ a: 'quote', cur: 'STARS', desc: { kind: 'paint', id: 'arctic' } });
  t(s === 403 && r.error === 'stars_tg', 'the website never sells with Stars');
  t((await wcall('/api/stars-invoice', {}, sid, csrf)).status === 403, 'the website can\'t open a Stars invoice');
  ratesUp = false; shop.resetRates();
  [s, r] = await W({ a: 'quote', cur: 'SOL', desc: { kind: 'paint', id: 'arctic' } });
  t(s === 503 && r.error === 'pending', 'solValueOk fails closed: the price service is down, so no SOL quote (pending)');
  ratesUp = true; shop.resetRates();
  [s, r] = await W({ a: 'quote', cur: 'SOL', desc: { kind: 'paint', id: 'arctic' } });
  const o = r.order, lam = Number(o.base), want = R.PAINTS.arctic.ton * 2 / 100;
  t(s === 200 && o.cur === 'SOL' && o.to === SOLR && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(o.ref) && lam % 1000 === 0 && Math.abs(lam / 1e9 - want) < 0.0011 && db.get('/solAmt/' + lam + '/oid') === o.oid, 'a SOL quote at the live GRAM rate: ' + o.amt + ' SOL, its own reference and a unique exact amount');
  sol.add('sigOther', { lamports: lam + 5e6 });   // somebody else's payment to our wallet (the old verifySol let anyone claim it)
  await new Promise((z) => setTimeout(z, 4100));
  [s, r] = await W({ a: 'status', q: o.oid });
  t(r.pending === true && r.order.st === 'open', 'another payment to our wallet (no reference, not the exact amount) never pays this quote');
  sol.add('sigShort', { lamports: lam - 1e6, ref: o.ref });
  await new Promise((z) => setTimeout(z, 4100));
  [s, r] = await W({ a: 'status', q: o.oid });
  t(r.pending === true, 'an underpaid transfer carrying the reference: not granted');
  sol.add('sigGood', { lamports: lam, ref: o.ref });
  await new Promise((z) => setTimeout(z, 4100));
  [s, r] = await W({ a: 'status', q: o.oid });
  t(r.order.st === 'paid' && r.order.tx === 'sigGood' && E(WP).paints.arctic === 1 && db.get('/solTx/sigGood/oid') === o.oid, 'SOL found by the quote\'s reference (finalized, a System transfer of the exact amount) and granted once');
  [s, r] = await W({ a: 'quote', cur: 'SOL', desc: { kind: 'paint', id: 'arctic' } });
  t(s === 409 && r.error === 'owned', 'gap 2: no SOL quote for an item now owned');
  // a wallet that can't add the reference: the quote's unique exact amount finds it
  [s, r] = await W({ a: 'quote', cur: 'SOL', desc: { kind: 'paint', id: 'venom' } });
  const ov = r.order;
  sol.add('sigExact', { lamports: Number(ov.base) });
  await new Promise((z) => setTimeout(z, 4100));
  [s, r] = await W({ a: 'status', q: ov.oid });
  t(r.order.st === 'paid' && E(WP).paints.venom === 1, 'an exact-amount send without the reference pays its own quote');
  // GRAM on the website
  [s, r] = await W({ a: 'quote', cur: 'TON', desc: { kind: 'paint', id: 'void' } });
  const ow = r.order;
  tonTxs.unshift(K.tonTx(ow, 'hweb'));
  shop.resetTonCache(); await new Promise((z) => setTimeout(z, 4100));
  [s, r] = await W({ a: 'status', q: ow.oid });
  t(r.order.st === 'paid' && E(WP).paints.void === 1, 'GRAM on the website: the same quote, chain check and grant');
  [s, r] = await W({ a: 'list' });
  t(r.orders.length >= 3 && r.orders.every((x) => x.oid && x.item && x.st && x.cur), 'receipts: the website lists its orders (item, currency, status)');
}
// ======================= 5. the Science Lab store: one Legendary a week at 1,500 Stars / 23 GRAM; packs one of each a week =======================
{
  setEco('tg_111', (S) => { delete S.ord; S.rm = { inferno: 1 }; S.lsm = {}; S.rsj = {}; });
  let [s, r] = await K.quote(A, 'STARS', { kind: 'rsleg', tk: 'starfall' });
  t(s === 409 && r.error === 'owned', 'a Legendary set mod is not on sale before its track\'s set mod is researched');
  [s, r] = await K.quote(A, 'TON', { kind: 'rsleg', tk: 'sunfire' });
  t(s === 200 && r.order.amt === 23, 'the Legendary set mod: 23 GRAM');
  await K.cancel(A, r.order.oid);
  let res = await K.stars(A, { kind: 'rsleg', tk: 'sunfire' }, 'ch.leg1');
  t(res.o.amt === 1500 && res.pre.ok && E('tg_111').lsm.sunfire === 1, 'the Legendary set mod: 1,500 Stars, granted');
  setEco('tg_111', (S) => { S.rm.rail = 1; });
  [s, r] = await K.quote(A, 'STARS', { kind: 'rsleg', tk: 'starfall' });
  t(s === 409 && r.error === 'limit', 'one Legendary set mod a UTC week in all');
  // the research race (Checkpoint 41 item 6): a mod being researched is never sold, and a paid quote for it lands held
  setEco('tg_111', (S) => { S.buys = {}; S.rsj = { starfall: 1 }; });
  [s, r] = await K.quote(A, 'STARS', { kind: 'rsleg', tk: 'starfall' });
  t(s === 409 && r.error === 'owned', 'a Legendary being researched is not for sale');
  setEco('tg_111', (S) => { S.rsj = {}; delete S.ord; });
  [s, r] = await K.quote(A, 'STARS', { kind: 'rsleg', tk: 'starfall' });
  const ol = r.order;
  t(s === 200, 'a Legendary quote');
  setEco('tg_111', (S) => { S.rsj = { starfall: 1 }; });   // the research started (its account reservation landed first)
  const p = await K.pre(A, ol);
  t(!p.ok, 'the race: the research start reserved the mod first: the pre-checkout refuses');
  await K.paid(A, ol, 'ch.race');
  t(!E('tg_111').lsm.starfall && db.get('/orders/tg_111/' + ol.oid + '/st') === 'held', 'the race: a payment landing anyway is held (never both bought and researched)');
  // packs: one of each a week, the owner's prices unchanged
  setEco('tg_111', (S) => { delete S.ord; S.rsj = {}; });
  res = await K.stars(A, { kind: 'rspack', tk: 'kit' }, 'ch.kit');
  t(res.o.amt === 99 && E('tg_111').bpt.thermal === 1, 'Field kit 99 Stars: +1 of every part');
  [s, r] = await K.quote(A, 'STARS', { kind: 'rspack', tk: 'kit' });
  t(s === 409 && r.error === 'owned', 'one Field kit a UTC week');
  [s, r] = await K.quote(A, 'TON', { kind: 'rspack', tk: 'cache' });
  t(r.order.amt === 9.6, 'Research cache 9.6 GRAM');
  await K.cancel(A, r.order.oid);
}
// ======================= 6. the Conquest store: one-time items, limits, the wall-only ore, prices from the one table =======================
{
  setEco('tg_111', (S) => { delete S.ord; S.buys = {}; });
  let res = await K.stars(A, { kind: 'cq', tk: 'builder-2' }, 'ch.b2');
  t(res.o.amt === 770 && E('tg_111').cq.b2 === 1, 'Second builder: 770 Stars ($9.99), granted');
  let [s, r] = await K.quote(A, 'STARS', { kind: 'cq', tk: 'builder-2' });
  t(s === 409 && r.error === 'owned', 'the second builder is bought once');
  res = await K.stars(A, { kind: 'mncrate', tk: 'fe' }, 'ch.fe1');
  const fe1 = E('tg_111').mn.fe;
  res = await K.stars(A, { kind: 'mncrate', tk: 'fe' }, 'ch.fe2');
  t(res.o.amt === 154 && E('tg_111').mn.fe === fe1 + 150, 'Ferrite Crate: 154 Stars ($1.99), +150 Ferrite');
  [s, r] = await K.quote(A, 'STARS', { kind: 'mncrate', tk: 'fe' });
  t(s === 409 && r.error === 'limit', 'at most 2 Ferrite Crates a UTC day');
  res = await K.stars(A, { kind: 'mncrate', tk: 'il' }, 'ch.il1');
  [s, r] = await K.quote(A, 'TON', { kind: 'mncrate', tk: 'il' });
  t(s === 409 && r.error === 'limit', 'at most 1 Ilmenite Crate a UTC day');
  const w0 = J(E('tg_111').mn);
  res = await K.stars(A, { kind: 'orecrate', tk: 'mh' }, 'ch.mh');
  t(res.o.amt === 1155 && E('tg_111').wmn.mh === R.SHOP.ore.mh.q && J(E('tg_111').mn) === w0, 'Moonheart wall crate: 1,155 Stars ($14.99) into the wall-only store, never the mineral wallet');
  [s, r] = await K.quote(A, 'STARS', { kind: 'orecrate', tk: 'mh' });
  t(s === 409 && r.error === 'limit', 'at most 1 of each wall-only crate a UTC day');
  [s, r] = await K.quote(A, 'STARS', { kind: 'cq', tk: 'wall-ext-10' });
  t(s === 409 && r.error === 'town', 'a wall extension pack needs your town');
  [s, r] = await K.quote(A, 'STARS', { kind: 'cos', tk: 'base-bastion' });
  t(s === 200 && r.order.amt === 616, 'a collection piece at its price: Bastion Ramparts 616 Stars ($7.99)');
  await K.refund(A, 'ch.mh', 1155);
  t(E('tg_111').wmn.mh === 0, 'a refunded wall crate takes its ore back');
  t(E('tg_111').pts === 5e6 || E('tg_111').pts >= 0, 'no purchase touched points');
}
console.log((bad ? 'FAIL' : 'PASS') + ' wtest payments: ' + ok + ' passed, ' + bad + ' failed');
if (bad) process.exit(1);
