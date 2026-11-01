// Farm defense tests: proof of play (forged and scripted results), bot-pattern flags, linked-account clusters, the
// new-account airdrop weight, rate limits, the admin pin and reminders at scale. A heavy but human player trips nothing.
// node dev/tests/wtest/farm.mjs
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { fakeRec } from './fakerec.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db = makeDB();
db.root.cfg = { proof: 'enforce' };   // the forged-result checks below run with the stricter setting (the default is flag only)
const tgCalls = [], tgFail = {};
let tonTxs = [];
globalThis.fetch = async (url, init) => {
  if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init);
  if (url.startsWith('https://api.telegram.org/')) {
    const body = JSON.parse(init.body); tgCalls.push([url.split('/').pop(), body]);
    const f = tgFail[body.chat_id];
    if (f) return new Response(JSON.stringify({ ok: false, error_code: f, description: 'x' }));
    return new Response(JSON.stringify({ ok: true, result: url.endsWith('/getChatMember') ? { status: 'left' } : { message_id: 1 } }));
  }
  if (url.startsWith('https://toncenter.com/')) return new Response(JSON.stringify({ result: tonTxs }));
  throw new Error('unexpected fetch ' + url);
};
const mod = await import('../../../worker/src/index.js');
const eco = await import('../../../worker/src/eco.js');
const farm = await import('../../../worker/src/farm.js');
const worker = mod.default;
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' };
function initData(user, age = 0) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - age), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const call = async (path, body, ip) => { const h = { Origin: 'https://solb7403-creator.github.io', 'Content-Type': 'application/json' }; if (ip) h['CF-Connecting-IP'] = ip; const r = await worker.fetch(new Request('https://x' + path, { method: 'POST', headers: h, body: JSON.stringify(body) }), env); return [r.status, await r.json().catch(() => null)]; };
let ok = 0, bad = 0; const t = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const E = (pid) => db.get('/eco/' + pid);
const setEco = (pid, f) => f(db.root.eco[pid]);
const reasons = (pid) => Object.keys((db.get('/flags/' + pid) || {}).r || {});
const linked = (a, b) => db.get(`/lk/${a}/${b}`);
const J = { id: 999, username: 'LunarBattle' };
const T0 = Date.UTC(2026, 9, 26, 9, 0, 0);   // a Monday, 09:00 UTC
const MIN = 60000, H = 3600000, DAY = 86400000;
let seq = 1;
const rnd = (() => { let s = 12345; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
// one AI match: ticket at `at`, result `dur` seconds later with a believable record (or the record `rec` gives)
async function play(u, at, o = {}) {
  const pid = 'tg_' + u.id, dur = o.dur || 60;
  const st = (await eco.matchStart(env, { g: 'arena', m: '2v2', map: 'classic', L: o.L, pv: o.pv === undefined ? 1 : o.pv, did: o.did, dh: o.dh }, u, pid, at, o.ip || '')).body;
  if (!st.tok) return { st };
  const won = o.won === undefined ? rnd() < 0.7 : o.won;
  const pf = o.pf !== undefined ? o.pf : fakeRec({ g: 'arena', m: '2v2', won, dur: Math.max(4, dur - 4), dmg: o.dmg === undefined ? 2000 : o.dmg, bot: o.bot, steer: o.steer || seq++ });
  const en = (await eco.matchEnd(env, { tok: st.tok, r: { won, drawn: false, stats: { dmg: o.repDmg === undefined ? (o.dmg === undefined ? 2000 : o.dmg) : o.repDmg, kills: 1 }, pf } }, u, pid, at + dur * 1000)).body;
  return { st, en, end: at + dur * 1000 };
}
// a session of matches: n matches, gaps and lengths from the given functions
async function session(u, at, n, o = {}) {
  let tm = at, last = null;
  for (let i = 0; i < n; i++) {
    const dur = o.dur ? o.dur(i) : 45 + rnd() * 75;
    const r = await play(u, tm, Object.assign({}, o, { dur }));
    last = r; tm = r.end + (o.gap ? o.gap(i) : (8 + rnd() * 50)) * 1000;
  }
  return { end: tm, last };
}
const mutate = (pf, fn) => { const b = Buffer.from(pf.s, 'base64'); fn(b, pf.n * 3 + 6); return Object.assign({}, pf, { s: b.toString('base64') }); };

// ======== proof of play ========
{
  const U = { id: 5001, username: 'forger' }, pid = 'tg_5001';
  let r = await play(U, T0, { pv: 0 });
  t(r.st.ok === false && r.st.error === 'update', 'a phone that sends no match records is told to update ' + JSON.stringify(r.st));
  r = await play(U, T0, { pf: null });
  t(r.en.ok === false && r.en.error === 'proof' && (E(pid).earned || 0) === 0, 'a result with no match record scores nothing ' + JSON.stringify(r.en));
  r = await play(U, T0 + 2 * MIN, { dmg: 1000, repDmg: 9000 });
  t(r.en.error === 'proof' && E(pid).pfw === 'dmg', 'damage the record doesn\'t show: refused (' + E(pid).pfw + ')');
  r = await play(U, T0 + 4 * MIN, { pf: mutate(fakeRec({ g: 'arena', m: '2v2', won: true, dur: 50, dmg: 2000 }), (b, sz) => { for (let s = 0; s < b.length / sz; s++) b[s * sz] = s % 2 ? 20 : 180; }), won: true });
  t(r.en.error === 'proof' && E(pid).pfw === 'move', 'a tank that teleports across the map: refused (' + E(pid).pfw + ')');
  t(reasons(pid).includes('proof'), '3 failed records in a day: flagged "proof" ' + JSON.stringify(db.get('/flags/' + pid)));
  r = await play(U, T0 + 6 * MIN, { pf: mutate(fakeRec({ g: 'arena', m: '2v2', won: true, dur: 50, dmg: 2000 }), (b, sz) => { for (let s = 0; s < b.length / sz; s++) { b[s * sz] = 100; b[s * sz + 1] = Math.round(16 * 7.5); } }), won: true });
  t(r.en.error === 'proof' && E(pid).pfw === 'walls', 'parked inside the command module: refused (' + E(pid).pfw + ')');
  r = await play(U, T0 + 8 * MIN, { pf: fakeRec({ g: 'arena', m: '2v2', won: false, dur: 50, dmg: 2000 }), won: true });
  t(r.en.error === 'proof' && E(pid).pfw === 'result', 'a win the record shows as a loss: refused (' + E(pid).pfw + ')');
  r = await play(U, T0 + 12 * MIN, { pf: fakeRec({ g: 'arena', m: '1v1', won: true, dur: 50, dmg: 2000 }), won: true });
  t(r.en.error === 'proof' && E(pid).pfw === 'roster', 'a 1v1 record for a 2v2 ticket: refused (' + E(pid).pfw + ')');
  t((E(pid).earned || 0) === 0, 'none of the forged results scored');
  // a fight longer than its ticket's clock is what an honest match whose ticket arrived late looks like: it counts only as a
  // late result (record verified, LATE_DAY a day, after the last scored match), never as an on-time one
  setEco(pid, (S) => { S.lt = { d: Math.floor((T0 + 10 * MIN) / 86400000), n: eco.ECO.LATE_DAY }; });
  r = await play(U, T0 + 10 * MIN, { pf: fakeRec({ g: 'arena', m: '2v2', won: true, dur: 170, dmg: 2000 }), won: true, dur: 60 });
  t(r.en.error === 'late' && (E(pid).earned || 0) === 0, 'a 170 s fight sent 60 s after the ticket, late allowance used up: refused (' + r.en.error + ')');
  setEco(pid, (S) => { S.lt.n = 0; });
  r = await play(U, T0 + 10.5 * MIN, { pf: mutate(fakeRec({ g: 'arena', m: '2v2', won: true, dur: 170, dmg: 2000 }), (b, sz) => { for (let s = 0; s < b.length / sz; s++) b[s * sz] = s % 2 ? 20 : 180; }), won: true, dur: 60 });
  t(r.en.error === 'proof' && (E(pid).earned || 0) === 0, 'a late result with a forged record: refused even in flag mode (' + E(pid).pfw + ')');
  setEco(pid, (S) => { delete S.lt; delete S.iv; });
  r = await play(U, T0 + 14 * MIN, { dmg: 2500 });
  t(r.en.ok && r.en.res.pts > 0, 'a believable record scores ' + JSON.stringify(r.en).slice(0, 120));
  // Jake can switch the check to flag-only from the admin sheet (if it ever stopped a real player)
  let [s, a] = await call('/api/admin', { initData: initData(J), proof: 'flag' });
  t(s === 200 && a.proof === 'flag', 'admin: proof of play set to flag only');
  eco.resetCfg();
  const e0 = E(pid).earned;
  r = await play(U, T0 + 16 * MIN, { pf: null });
  t(r.en.ok && E(pid).earned > e0, 'flag-only: a result without a record scores (and still counts as a failed record)');
  delete db.root.cfg.proof; eco.resetCfg();
  const e1 = E(pid).earned;
  r = await play(U, T0 + 18 * MIN, { pf: null });
  t(r.en.ok && E(pid).earned > e1, 'with no setting, the default is flag only: a real player never loses a match to the check');
  [s, a] = await call('/api/admin', { initData: initData(J), proof: 'enforce' }); eco.resetCfg();
  t(a.proof === 'enforce', 'admin: back to enforce');
  // the admin username is pinned to the account that first used it
  [s, a] = await call('/api/admin', { initData: initData({ id: 4242, username: 'LunarBattle' }) });
  t(s === 403, 'someone who later takes the admin username is refused');
}

// ======== a heavy, human player: a week of long sessions, trips nothing ========
{
  const U = { id: 5100, username: 'grinder' }, pid = 'tg_5100';
  let tm = T0;
  for (let d = 0; d < 7; d++) {
    const dayStart = T0 + d * DAY + (rnd() * 6 - 3) * H;   // starts at a different time every day
    await session(U, dayStart, 28 + Math.floor(rnd() * 10));
    await session(U, dayStart + 6 * H + rnd() * 3 * H, 15 + Math.floor(rnd() * 8));
    tm = dayStart;
  }
  const S = E(pid);
  t(S.mp >= 250 && reasons(pid).length === 0, 'a heavy human player (' + S.mp + ' matches in a week, 2 sessions a day) trips no flag ' + JSON.stringify(db.get('/flags/' + pid)));
}

// ======== bot patterns ========
{
  const B1 = { id: 5201, username: 'bot1' };
  await session(B1, T0, 4, { bot: true });
  t(reasons('tg_5201').includes('noinput'), 'a tank that drives with nobody on the controls: flagged "noinput" ' + JSON.stringify(reasons('tg_5201')));
  const B2 = { id: 5202, username: 'bot2' }, B3 = { id: 5203, username: 'bot3' };
  await session(B2, T0, 3, { steer: 77 });
  t(reasons('tg_5202').includes('repeat'), 'the exact same controls in 3 matches: flagged "repeat" ' + JSON.stringify(reasons('tg_5202')));
  await session(B3, T0 + H, 1, { steer: 77 });
  t(linked('tg_5203', 'tg_5202') === 'replay', 'the same controls on a second account: linked as one person ("replay")');
  const B4 = { id: 5204, username: 'bot4' };
  await session(B4, T0, 27, { gap: () => 20 });
  t(reasons('tg_5204').includes('steady'), 'the next match starts exactly 20 s after the last, 26 times: flagged "steady" ' + JSON.stringify(reasons('tg_5204')));
  const B5 = { id: 5205, username: 'bot5' };
  await session(B5, T0, 27, { gap: () => 0.3 + rnd() * 0.7 });
  t(reasons('tg_5205').includes('nomenu'), 'never stops in the menus (under 1.5 s between matches): flagged "nomenu" ' + JSON.stringify(reasons('tg_5205')));
  const B6 = { id: 5206, username: 'bot6' };
  await session(B6, T0, 27, { dur: () => 60 });
  t(reasons('tg_5206').includes('steadylen'), 'every match lasts exactly 60 s: flagged "steadylen" ' + JSON.stringify(reasons('tg_5206')));
  const B7 = { id: 5207, username: 'bot7' };
  for (let d = 0; d < 7; d++) { const s0 = T0 + d * DAY - 3 * H + rnd() * 2 * MIN; await session(B7, s0, 48, { dur: () => 160 + rnd() * 4, gap: () => 20 + rnd() * 2 }); }
  t(reasons('tg_5207').includes('clockwork'), 'starts and stops at the same minute 6 days in a row, hours a day: flagged "clockwork" ' + JSON.stringify(reasons('tg_5207')) + JSON.stringify((E('tg_5207').bp||{}).dy) + ' mp ' + E('tg_5207').mp + ' ' + JSON.stringify(E('tg_5207').mh));
  // a late result on a weak connection (sent right before the next match) doesn't look like "no time in menus"
  const W = { id: 5208, username: 'weaknet' };
  let tm = T0;
  for (let i = 0; i < 27; i++) {
    const st = (await eco.matchStart(env, { g: 'arena', m: '2v2', map: 'classic', pv: 1 }, W, 'tg_5208', tm)).body;
    const dur = 50 + rnd() * 60, back = tm + dur * 1000 + (10 + rnd() * 30) * 1000;   // the result only gets through when the next match starts
    await eco.matchEnd(env, { tok: st.tok, r: { won: true, stats: { dmg: 2000 }, pf: fakeRec({ g: 'arena', m: '2v2', won: true, dur: dur - 4, dmg: 2000, steer: seq++ }) } }, W, 'tg_5208', back);
    tm = back + 200;
  }
  t(!reasons('tg_5208').includes('nomenu') && !reasons('tg_5208').includes('steady'), 'results that arrive late on a weak connection don\'t trip "nomenu" ' + JSON.stringify(reasons('tg_5208')));
}

// ======== farms: linked accounts, clusters, one account counts ========
{
  const dev = 'ab12cd34ef56ab78', F = [6001, 6002, 6003, 6004].map((id) => ({ id, username: 'farm' + id }));
  for (const u of F) await call('/api/sync', { initData: initData(u), boot: true, did: dev, dh: '1a2b' });
  t(linked('tg_6004', 'tg_6001') === 'device' && linked('tg_6002', 'tg_6003') === 'device', 'four Telegram accounts on one phone: linked ("device")');
  F.forEach((u, i) => { const p = db.root.players['tg_' + u.id]; p.pts = 5000 + i * 1000; p.days = 3; p.ac = p.pts; });
  // a shared wallet
  const W1 = { id: 6101, username: 'payer1' }, W2 = { id: 6102, username: 'payer2' };
  tonTxs = [{ in_msg: { value: '4000000000', message: 'LWM|tg_6101|w1', source: 'EQwallet1' }, transaction_id: { hash: 'hw1' } }, { in_msg: { value: '4000000000', message: 'LWM|tg_6102|w2', source: 'EQwallet1' }, transaction_id: { hash: 'hw2' } }];
  const desc = { kind: 'box', tk: 'weapon', ri: 0 };
  await call('/api/pay-log', { initData: initData(W1), cur: 'TON', amt: 4, gram: 4, item: 'x', memo: 'LWM|tg_6101|w1', desc });
  const [, pr] = await call('/api/pay-log', { initData: initData(W2), cur: 'TON', amt: 4, gram: 4, item: 'x', memo: 'LWM|tg_6102|w2', desc });
  t(pr.verified && linked('tg_6102', 'tg_6101') === 'wallet', 'two accounts paying from the same TON wallet: linked ("wallet")');
  // starting together, again and again, on one network
  const G = [6201, 6202, 6203].map((id) => ({ id, username: 'grp' + id }));
  for (let d = 0; d < 3; d++) for (const hr of [10, 16]) {
    const at = T0 + d * DAY + (hr - 9) * H + 17 * 1000;
    for (const u of G) await eco.matchStart(env, { g: 'arena', m: '2v2', map: 'classic', pv: 1, did: 'ff' + u.id + '000000000', dh: '99' }, u, 'tg_' + u.id, at, '10.1.2.3');
    await farm.processStarts(env, at + 3 * MIN);
  }
  t(linked('tg_6201', 'tg_6203') === 'together' && linked('tg_6202', 'tg_6201') === 'together', 'three accounts that keep starting in the same minute on one network: linked ("together")');
  const P2 = [6301, 6302].map((id) => ({ id, username: 'pal' + id }));
  for (let d = 0; d < 2; d++) { const at = T0 + d * DAY + 2 * H; for (const u of P2) await eco.matchStart(env, { g: 'arena', m: '2v2', map: 'classic', pv: 1 }, u, 'tg_' + u.id, at, '10.9.9.9'); await farm.processStarts(env, at + 3 * MIN); }
  t(!linked('tg_6301', 'tg_6302'), 'two friends who start together twice on the same Wi-Fi: not linked');
  // live matches against each other over and over: win trading
  for (let i = 0; i < 8; i++) await eco.creditMatch(env, 'tg_6401', 'trader1', () => ({ pts: 10, won: i % 2 === 0, m: { quit: true }, opp: ['tg_6402'] }), T0 + i * MIN);
  t(linked('tg_6401', 'tg_6402') === 'trade', '8 live matches against the same account in a day: linked ("trade")');
  // the board: in each cluster only the account with the most points counts
  const lb = await mod.buildLeaderboard(env);
  const [, a] = await call('/api/admin', { initData: initData(J), snap: 1 });
  const cl = a.clusters.find((c) => c.m.some((x) => x[0] === 'tg_6001'));
  t(cl && cl.m.length === 4 && cl.keep === 'tg_6004' && cl.why.includes('device'), 'admin sheet shows the 4-account cluster, keeping the one with the most points ' + JSON.stringify(cl));
  t(['tg_6001', 'tg_6002', 'tg_6003'].every((id) => reasons(id).includes('cluster')) && !reasons('tg_6004').includes('cluster'), 'the extra accounts are flagged "cluster"; the main one isn\'t');
  const lb2 = await mod.buildLeaderboard(env);
  const [, a2] = await call('/api/admin', { initData: initData(J), snap: 1 });
  t(!lb2.top.some((x) => x[0] === 'tg_6001') && lb2.top.some((x) => x[0] === 'tg_6004') && !a2.snapshot.some((x) => x[0] === 'tg_6002') && a2.snapshot.some((x) => x[0] === 'tg_6004'), 'extra accounts sit out the board and the airdrop snapshot');
  const [, a3] = await call('/api/admin', { initData: initData(J), clearCl: cl.sig, snap: 1 });
  t(a3.snapshot.some((x) => x[0] === 'tg_6001') && a3.clusters.find((c) => c.sig === cl.sig).ok, 'Jake clears the cluster: every account counts again ' + JSON.stringify(db.get('/flags/tg_6001')) + ' ' + JSON.stringify(a3.clusters.find((c) => c.sig === cl.sig)) + ' ' + JSON.stringify(a3.snapshot.slice(0,8)));
}

// ======== new Telegram accounts earn airdrop credit at a reduced rate for their first week ========
{
  const N = { id: 8123456789, username: 'fresh' }, Pm = { id: 8123456790, username: 'freshprem', is_premium: true }, O = { id: 412345678, username: 'veteran' };
  for (const u of [N, Pm, O]) { await call('/api/sync', { initData: initData(u), boot: true }); await call('/api/act', { initData: initData(u), a: 'login' }); }
  const ac = (u) => db.get('/players/tg_' + u.id + '/ac'), pts = (u) => db.get('/players/tg_' + u.id + '/pts');
  t(pts(N) === 125 && ac(N) === 63 && ac(Pm) === 125 && ac(O) === 125, 'first day: a new non-Premium account gets half credit; Premium and older accounts full; points unchanged ' + [pts(N), ac(N), ac(Pm), ac(O)]);
  const [, a] = await call('/api/admin', { initData: initData(J), snap: 1 });
  const ix = (u) => a.snapshot.findIndex((x) => x[0] === 'tg_' + u.id);
  t(ix(N) > ix(O) && a.snapshot[ix(N)][4] === 63, 'the snapshot ranks by airdrop credit');
}

// ======== rate limits ========
{
  const U = { id: 7001, username: 'spammer' };
  let last = 0;
  for (let i = 0; i < 95; i++) { const [s] = await call('/api/act', { initData: initData(U), a: 'login' }); last = s; }
  t(last === 429, 'more than 90 actions a minute from one pilot: refused (429)');
  const V = { id: 7002, username: 'invspam' };
  let inv = 0;
  for (let i = 0; i < 22; i++) { const [s] = await call('/api/stars-invoice', { initData: initData(V), kind: 'box', tk: 'gem', ri: 0 }); inv = s; }
  t(inv === 429, 'more than 20 Stars invoices a minute from one pilot: refused (no flood of Telegram calls)');
  let st = 0;
  for (let i = 0; i < 1205; i++) { const [s] = await call('/api/sync', { initData: 'bad' }, '203.0.113.9'); st = s; if (s === 429) break; }
  t(st === 429, 'more than 1,200 requests a minute from one network address: refused before any database work');
}

// ======== reminders reach every opted-in player, in batches, within Telegram's limits ========
{
  const ids = Array.from({ length: 40 }, (_, i) => 9100 + i);
  const d0 = Date.UTC(2026, 9, 27, 15, 2, 0), realNow = Date.now;
  // /start schedules nx from Date.now(): register on the same controlled day as delivery,
  // not the real CI date (which eventually moves beyond this fixture's reminder date).
  try {
    Date.now = () => d0;
    for (const id of ids) await worker.fetch(new Request('https://x/api/tg-webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': await mod.webhookSecret(env) }, body: JSON.stringify({ message: { from: { id }, chat: { id, type: 'private' }, text: '/start' } }) }), env);
  } finally { Date.now = realNow; }
  t(ids.every(id => db.get('/ntf/tg_' + id + '/nx') === Math.floor(d0 / DAY)), 'real /start registrations are due on the controlled reminder day');
  tgFail[9105] = 403;   // blocked the bot
  const before = tgCalls.length;
  const early = await mod.sendReminders(env, d0 - 3 * MIN, 15);   // 14:59 UTC
  t(early === 0 && tgCalls.length === before, 'due reminders wait until the allowed notification window');
  let sent = 0;
  for (let i = 0; i < 4; i++) sent += await mod.sendReminders(env, d0 + i * MIN, 15);
  const to = tgCalls.slice(before).filter(([m]) => m === 'sendMessage').map(([, b]) => b.chat_id).filter((c) => ids.includes(c));
  t(sent === 39 && new Set(to).size === 40 && to.length === 40 && db.get('/ntf/tg_9105/on') === 0, 'all 40 opted-in players reached once, in batches of 15; a blocked chat is switched off ' + sent + ' ' + to.length);
  const more = await mod.sendReminders(env, d0 + 30 * MIN, 15);
  t(more === 0, 'nobody gets a second reminder the same day');
  tgFail[9110] = 429;
  const n2 = await mod.sendReminders(env, d0 + DAY, 40);
  t(n2 < 39, 'Telegram says slow down (429): the run stops and the rest wait for the next one (' + n2 + ')');
  delete tgFail[9110];
  let n3 = 0; for (let i = 1; i < 4; i++) n3 += await mod.sendReminders(env, d0 + DAY + i * MIN, 40);
  t(n2 + n3 === 39, 'the next runs finish the day ' + (n2 + n3));
}
// ======== the public leaderboard file comes through the server (edge-cached), not straight from the database ========
{
  await mod.buildLeaderboard(env);
  const r = await worker.fetch(new Request('https://x/lb.json?t=1', { headers: { Origin: 'https://solb7403-creator.github.io' } }), env);
  const lb = await r.json();
  t(r.status === 200 && lb && Array.isArray(lb.top) && /max-age=60/.test(r.headers.get('Cache-Control') || '') && r.headers.get('Access-Control-Allow-Origin') === 'https://solb7403-creator.github.io', 'leaderboard file served by the server with a 60 s edge cache');
}
// ======== the launch liquidity fund: 25% of verified sales, priced by the server, refunds off ========
{
  const c0 = Number(db.get('/meta/revc')) || 0;
  const sec = await mod.webhookSecret(env), hk = (body) => worker.fetch(new Request('https://x/api/tg-webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': sec }, body: JSON.stringify(body) }), env);
  await hk({ message: { from: { id: 7301 }, chat: { id: 7301, type: 'private' }, successful_payment: { total_amount: 1000, telegram_payment_charge_id: 'lpf1', invoice_payload: JSON.stringify({ u: 7301, k: 'box', t: 'gem', r: 1, g: 8, n: 'lp1' }) } } });
  t((Number(db.get('/meta/revc')) || 0) - c0 === 1300, 'a 1,000 Stars sale adds $13 of sales');
  const lb = await mod.buildLeaderboard(env);
  t(lb.lpf === Math.round((Number(db.get('/meta/revc')) / 100) * 0.25) && lb.lps === 0.25, 'the board file shows the fund: 25% of verified sales ($' + lb.lpf + ')');
  await hk({ message: { from: { id: 7301 }, chat: { id: 7301, type: 'private' }, refunded_payment: { total_amount: 1000, telegram_payment_charge_id: 'lpf1', invoice_payload: '{}' } } });
  t((Number(db.get('/meta/revc')) || 0) === c0, 'a refunded sale comes off the fund');
}
console.log('farm: passed', ok, 'failed', bad);
process.exit(bad ? 1 : 0);
