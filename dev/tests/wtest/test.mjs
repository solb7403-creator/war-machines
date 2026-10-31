// Server tests: login checks, the server-owned economy (every point from a named, checked source), AI match tickets,
// claims and their daily/weekly maximums, crates, server-verified gear and power, payments (Stars, TON), refunds,
// the one-time move of existing pilots, anomaly and alt flags, the leaderboard, admin, reminders and bot commands.
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { fakeRec } from './fakerec.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db = makeDB();
db.root.cfg = { proof: 'enforce' };   // the forged-result checks below run with the stricter setting (the default is flag only)
const tgCalls = [];
let tonTxs = [{ in_msg: { value: '8000000000', message: 'LWM|tg_111|abc' }, transaction_id: { hash: 'h1' } }];
globalThis.fetch = async (url, init) => {
  if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init);
  if (url.startsWith('https://api.telegram.org/')) { const body = JSON.parse(init.body); tgCalls.push([url.split('/').pop(), body]); if (url.endsWith('/getChatMember') && globalThis.tgMember) return new Response(JSON.stringify({ ok: true, result: { status: globalThis.tgMember } })); return new Response(JSON.stringify({ ok: true, result: 'https://t.me/$invoice' })); }
  if (url.startsWith('https://toncenter.com/')) return new Response(JSON.stringify({ result: tonTxs }));
  throw new Error('unexpected fetch ' + url);
};
const mod = await import('../../../worker/src/index.js');
const eco = await import('../../../worker/src/eco.js');
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const worker = mod.default;
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' };
function initData(user, age = 0, start = "") {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - age), query_id: 'q', user: JSON.stringify(user) });
  if (start) p.set('start_param', start);
  const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const call = async (path, body, ip) => { const h = { Origin: 'https://solb7403-creator.github.io', 'Content-Type': 'application/json' }; if (ip) h['CF-Connecting-IP'] = ip; const r = await worker.fetch(new Request('https://x' + path, { method: 'POST', headers: h, body: JSON.stringify(body) }), env); return [r.status, await r.json()]; };
const A = { id: 111, username: 'alice' }, B = { id: 222, first_name: 'Bob <script>' }, J = { id: 999, username: 'LunarBattle' }, C = { id: 333, username: 'carol' };
let ok = 0, bad = 0; const t = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const sec = await mod.webhookSecret(env);
const hook = (body) => worker.fetch(new Request('https://x/api/tg-webhook', { method: 'POST', headers: { 'x-telegram-bot-api-secret-token': sec }, body: JSON.stringify(body) }), env);
const E = (pid) => db.get('/eco/' + pid);
const act = (u, a, o) => call('/api/act', Object.assign({ initData: initData(u), a }, o || {}));
const day = Math.floor(Date.now() / 86400000);
const setEco = (pid, f) => { const S = db.root.eco[pid]; f(S); };

// ---- login checks ----
let [s, r] = await call('/api/sync', { initData: 'user=%7B%22id%22%3A1%7D&hash=bad' }); t(s === 401, 'reject bad initData');
[s, r] = await call('/api/sync', { initData: initData(A, 3 * 86400) }); t(s === 401, 'reject stale initData');

// ---- sync never credits points (forged earned is ignored) ----
[s, r] = await call('/api/sync', { initData: initData(A), earned: 1e9, boot: true, power: 9999, league: 'LEGEND', L: { w: { a: 'moon' }, skin: 'lunar' } });
t(s === 200 && r.rec.pts === 0 && r.E.pts === 0 && r.migOk === true && Array.isArray(r.stars), 'new pilot: no points from sync ' + JSON.stringify(r.rec));
t(r.league === 'ROOKIE' && db.get('/players/tg_111/league') === 'ROOKIE' && db.get('/players/tg_111/power') < 150, 'forged power/league ignored: power from owned gear ' + r.power);
t(db.get('/meta/n') === 1, 'player count');
[s, r] = await call('/api/sync', { initData: initData(A), earned: 5e8, mig: { pts: 1e9, earned: 1e9, up: { hull: 4, cannon: 4, engine: 4, target: 4, reactor: 4 } } });
t(r.rec.pts === 0 && r.E.pts === 0 && r.E.up.hull === 0, 'a brand-new pilot cannot "move" a forged save in');

// ---- login reward: once per UTC day ----
[s, r] = await act(A, 'login'); t(r.ok && r.out.pts === 125 && r.E.pts === 125 && r.E.earned === 125, 'login reward credited by the server ' + JSON.stringify(r.out));
[s, r] = await act(A, 'login'); t(r.out.err === 'claimed' && r.E.earned === 125, 'login reward twice in a day refused');
t(db.get('/players/tg_111/pts') === 125 && db.get('/players/tg_111/days') === 1 && db.get(`/dly/${day}/tg_111/s`) === 125, 'mirrored to the leaderboard record');
// two claims at the same moment: the conditional write lets only one through
setEco('tg_111', (S) => { S.login = { last: day - 1, n: 1 }; });
const c0 = db.conflicts;
const both = await Promise.all([act(A, 'login'), act(A, 'login')]);
t(both.filter(([, x]) => x.out && x.out.pts > 0).length === 1 && E('tg_111').earned === 125 + 175, 'double tap: one claim, one credit ' + JSON.stringify(both.map(x => x[1].out)) + ' conflicts ' + (db.conflicts - c0));

// ---- AI matches: ticket, scoring, replay, too fast, expired, hourly cap, stats limits ----
const L0 = { w: { a: 'twin', t: 2, q: 1.1 }, c: { c: 'titan', t: 2, q: 1.1 }, up: { hull: 4, cannon: 4, engine: 4, target: 4, reactor: 4 }, gl: { dmg: 5 }, skin: 'lunar' };
const start = async (u, o, now) => (await eco.matchStart(env, Object.assign({ g: 'arena', m: '2v2', map: 'classic', L: L0, pv: 1 }, o || {}), u, 'tg_' + u.id, now)).body;
// a result goes with a match record (proof of play). Unless the test brings its own, a believable one for this ticket:
// the fight lasts as long as the clock allows, with up to 3,000 damage (what the phone reports above that is a lie)
const recFor = (pid, res, now, extra) => {
  const T = (E(pid) || {}).mt; if (!T) return null;
  const wall = Math.max(4, ((now || Date.now()) - T.t0) / 1000), st = res.stats || {};
  return fakeRec(Object.assign({ g: T.g, m: T.m, won: !!res.won || (T.g === 'royale' && res.place === 1), drawn: !!res.drawn, place: res.place || 0, dur: Math.max(4, Math.min(wall - 1, 178)), dmg: Math.min(Number(st.dmg) || 0, 3000) }, extra || {}));
};
const end = async (u, tok, res, now) => {
  if (res && res.pf === undefined && !res.quit) res = Object.assign({}, res, { pf: recFor('tg_' + u.id, res, now) });
  return (await eco.matchEnd(env, { tok, r: res }, u, 'tg_' + u.id, now)).body;
};
const now0 = Date.now();
let st = await start(A, {}, now0);
t(st.ok && /^[0-9a-f]{16}\.[0-9a-f]{24}$/.test(st.tok) && st.league === 'ROOKIE' && st.mult === 1, 'ticket issued; league from server-owned gear (forged epic loadout = Rookie) ' + JSON.stringify(st).slice(0, 120));
let en = await end(A, st.tok, { won: true, stats: { dmg: 4000, kills: 2 } }, now0 + 4000);
t(!en.ok && en.error === 'fast' && E('tg_111').earned === 300, 'win reported after 4 s: too fast, nothing credited');
en = await end(A, st.tok, { won: true }, now0 + 60000); t(!en.ok && en.error === 'fast' && E('tg_111').earned === 300, 'ticket used once: sending it again gets the same answer');
st = await start(A, {}, now0 + 1000);
const e1 = E('tg_111').earned;
en = await end(A, st.tok, { won: true, stats: { dmg: 1e9, kills: 99 } }, now0 + 61000);
t(!en.ok && en.error === 'proof' && E('tg_111').earned === e1, 'forged damage the match record doesn\'t show: not scored ' + JSON.stringify(en));
st = await start(A, {}, now0 + 1000);
en = await end(A, st.tok, { won: true, pts: 99999, awarded: 99999, stats: { dmg: 2500, kills: 99, box: 3, sup: 4, low: 0.5 } }, now0 + 61000);
const want2 = Math.round(R.MODES['2v2'].win * R.teamX('arena', '2v2', false)) + R.streakPts('arena', '2v2', 1);
t(en.ok && en.res.pts === want2 && en.res.awarded === want2 && E('tg_111').earned === e1 + want2, 'server computes the points (2v2 win + streak); the phone\'s number is ignored ' + JSON.stringify(en.res));
t(E('tg_111').q.q_dmg && E('tg_111').q.q_dmg.p === 2500 && E('tg_111').wins === 1 && E('tg_111').mp === 1, 'damage from the record ' + JSON.stringify(E('tg_111').q.q_dmg));
const again = await end(A, st.tok, { won: true }, now0 + 62000);
t(again.ok && again.dup && again.res.awarded === want2 && E('tg_111').earned === e1 + want2, 'replaying a ticket returns the same answer, no double credit');
st = await start(A, {}, now0 + 70000); const old = st.tok;
st = await start(A, { g: 'bounty', m: '1v1' }, now0 + 71000);
en = await end(A, old, { won: true }, now0 + 200000); t(!en.ok && en.error === 'ticket', 'an older ticket dies when a new match starts');
en = await end(A, st.tok, { won: true, stats: { stars: 50 } }, now0 + 71000 + 100000); t(!en.ok && en.error === 'fast', 'Bounty win before 110 s: too fast');
st = await start(A, { g: 'bounty', m: '1v1' }, now0 + 400000);
en = await end(A, st.tok, { won: true }, now0 + 400000 + 31 * 60000); t(!en.ok && en.error === 'expired', 'expired ticket refused');
st = await start(A, { g: 'royale', m: '1v1' }, now0 + 3e6);
en = await end(A, st.tok, { place: 6 }, now0 + 3e6 + 8000); t(en.ok && en.res.base === R.ROYALE_PTS[5], 'Last Standing 6th after 8 s is fine (' + R.ROYALE_PTS[5] + ' points)');
st = await start(A, { g: 'royale', m: '1v1' }, now0 + 3.1e6);
en = await end(A, st.tok, { place: 1, won: false }, now0 + 3.1e6 + 15000); t(!en.ok && en.error === 'fast', 'Last Standing 1st after 15 s: too fast');
st = await start(A, { g: 'zone', m: '1v1' }, now0 + 3.2e6);
en = await end(A, st.tok, { won: false, drawn: false }, now0 + 3.2e6 + 9000); t(en.ok && en.res.base === 90 && E('tg_111').streak === 0, 'quick loss counts as a loss (streak reset)');
st = await start(A, {}, now0 + 3.3e6);
en = await end(A, st.tok, { quit: true }, now0 + 3.3e6 + 5000); t(en.ok && en.res.pts === 0 && en.res.quit, 'left mid-match: a loss, no points');
// hourly cap
{
  const h0 = Math.floor((now0 + 7.2e6) / 3600000) * 3600000 + 1000;
  let last = null, n = 0;
  setEco('tg_111', (S) => { S.mh = { h: Math.floor(h0 / 3600000), n: eco.ECO.HOUR_CAP - 1 }; });
  st = await start(A, { g: 'arena', m: '1v1' }, h0); en = await end(A, st.tok, { won: false }, h0 + 20000); if (en.ok) n++;
  st = await start(A, { g: 'arena', m: '1v1' }, h0 + 30000); last = await end(A, st.tok, { won: false }, h0 + 60000);
  t(n === 1 && !last.ok && last.error === 'hourly', 'matches per hour capped at ' + eco.ECO.HOUR_CAP + ' ' + JSON.stringify(last).slice(0, 80));
}
t(eco.minSecs('crystal', '1v1', true) === 60 && eco.minSecs('arena', '3v3', true) === 20 && eco.minSecs('zone', '2v2', false, false) === 6, 'minimum durations per mode');
// daily cap still applies to match points
setEco('tg_111', (S) => { S.dailyPts = R.DAILY_CAP - 50; S.dailyDay = day; delete S.mh; delete S.fx; });
st = await start(A, { g: 'arena', m: '2v2' }, Date.now());
en = await end(A, st.tok, { won: true }, Date.now() + 60000);
t(en.ok && en.res.awarded === 50 && E('tg_111').dailyPts === R.DAILY_CAP, 'daily cap: only 50 of ' + en.res.pts + ' credited');

// ---- daily quests: progress only from scored matches, max 4 + the all-4 bonus a day; weekly max 5 + chest ----
setEco('tg_111', (S) => { S.dailyPts = 0; S.dq = { v: 2, d: day, ids: ['play4', 'win2', 'kill10', 'win6'], p: {}, c: {}, all: false, sw: 0, was: [] }; });
[s, r] = await act(A, 'daily', { id: 'play4' }); t(r.out.err === 'no', 'unfinished daily refused');
[s, r] = await act(A, 'daily', { id: 'q_win1' }); t(r.out.err === 'no', 'a quest that is not one of today\'s refused');
setEco('tg_111', (S) => { S.dq.p = { play4: 4, win2: 2, kill10: 10, win6: 6 }; });
const before = E('tg_111').earned;
const got = [];
for (const id of ['play4', 'win2', 'kill10', 'win6', 'win6', 'play4']) { [s, r] = await act(A, 'daily', { id }); got.push(r.out.pts || r.out.err); }
t(got[4] === 'no' && got[5] === 'no' && got.slice(0, 4).every((x) => x > 0), 'each daily claims once ' + JSON.stringify(got));
const boost = R.ecoBoost(E('tg_111'), { day, week: Math.floor((Date.now() - 4 * 86400000) / (7 * 86400000)) });
t(E('tg_111').earned - before === [500, 500, 500, 500, 1000].reduce((a, x) => a + Math.round(x * (1 + boost)), 0) && E('tg_111').dq.all, 'dailies + all-4 bonus paid once ' + (E('tg_111').earned - before));
setEco('tg_111', (S) => { S.wk.p = Object.fromEntries(S.wk.ids.map((id) => [id, 999])); });
const wk = E('tg_111').wk.ids;
const wgot = [];
for (const id of wk.concat(wk[0])) { [s, r] = await act(A, 'weekly', { id }); wgot.push(r.out.pts || r.out.err); }
t(wgot.slice(0, 5).every((x) => x > 0) && wgot[5] === 'no', 'weekly quests: 5, each once ' + JSON.stringify(wgot));
[s, r] = await act(A, 'chest'); t(r.out.err === 'no', 'chest needs 20 dailies');
setEco('tg_111', (S) => { S.wq.n = 20; });
[s, r] = await act(A, 'chest'); t(r.out.pts > 0 && r.out.box && r.out.box.gem, 'chest at 20 dailies: points + rare gem cache');
[s, r] = await act(A, 'chest'); t(r.out.err === 'no', 'chest once a week');
// milestones and link quests
[s, r] = await act(A, 'ms', { id: 'q_win1' }); t(r.out.pts === 500, 'milestone claimed: ' + JSON.stringify(r.out));
[s, r] = await act(A, 'ms', { id: 'q_win1' }); t(r.out.err === 'no', 'milestone once');
[s, r] = await act(A, 'ms', { id: 'q_wiki' }); t(r.out.err === 'no', 'link quest needs the visit first');
[s, r] = await act(A, 'visit', { id: 'q_wiki' }); [s, r] = await act(A, 'ms', { id: 'q_wiki' }); t(r.out.err === 'no', 'wiki: tapping Open alone does not count');
{ const p = new URLSearchParams(initData(A)); p.delete('hash'); p.set('start_param', 'wikiread'); const dcs = [...p.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('\n');
  p.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest()).update(dcs).digest('hex'));
  [s, r] = await call('/api/act', { initData: p.toString(), a: 'visit', id: 'q_wiki' }); [s, r] = await act(A, 'ms', { id: 'q_wiki' }); t(r.out.pts === 2000, 'wiki: back through the end-of-page button, then claimed ' + JSON.stringify(r.out)); }
[s, r] = await act(A, 'visit', { id: 'q_tg' });
globalThis.tgMember = 'left'; [s, r] = await act(A, 'ms', { id: 'q_tg' }); t(r.out.err === 'join' && !r.E.q.q_tg.claimed, 'channel quest: not a member yet, no pay ' + JSON.stringify(r.out));
t(tgCalls.filter(c => c[0] === 'getChatMember').pop()[1].chat_id === '@LUNARmemecoin', 'channel quest asks Telegram about @LUNARmemecoin');
globalThis.tgMember = 'member'; [s, r] = await act(A, 'ms', { id: 'q_tg' }); t(r.out.pts === 1500, 'Telegram channel quest: joined, then claim');
// claimed rewards never hit the daily cap, and don't use up the room matches have
{ const S = R.ecoNorm({}), X = { day: 900, week: 128, rnd: Math.random }; S.dailyDay = 900; S.dailyPts = R.DAILY_CAP; S.q.q_win1 = { p: 1, done: true, claimed: false };
  const m = R.ecoMsClaim(S, 'q_win1', X); t(m.pts === 500 && S.dailyPts === R.DAILY_CAP + 500, 'a quest claimed at the cap still pays in full');
  S.dailyPts = 10000; S.fx = { d: 900, n: 5000 }; t(R.ecoAward(S, 20000, X) === 15000, 'matches keep their full 20,000 room after quest points ' + S.dailyPts); }
globalThis.tgMember = null;
// pass: free track points only up to the tier reached; premium never gives points
[s, r] = await act(A, 'pass', { t: 'f', i: 30 }); t(r.out.err === 'no', 'pass tier not reached refused');
const xp = E('tg_111').pass.xp;
[s, r] = await act(A, 'pass', { t: 'f', i: 1 }); t(xp >= 350 ? r.out.pts === 150 : r.out.err === 'no', 'pass tier 1 (xp ' + xp + ') ' + JSON.stringify(r.out));
[s, r] = await act(A, 'pass', { t: 'p', i: 1 }); t(r.out.err === 'no', 'premium track needs the pass');

// ---- spending points: crates, salvage, tune-up, upgrades ----
setEco('tg_111', (S) => { S.pts = 1000; });
[s, r] = await act(A, 'crate', { tk: 'weapon', ri: 0 }); t(r.out.err === 'pts' && r.out.need === 19000 && r.E.pts === 1000, 'not enough points for a crate');
[s, r] = await act(A, 'crate', { tk: 'weapon', ri: 2 }); t(r.out.err === 'paid', 'epic crates are paid only');
setEco('tg_111', (S) => { S.pts = 150000; });
[s, r] = await act(A, 'crate', { tk: 'weapon', ri: 1 }); const got1 = r.out;
t(got1.kind === 'new' && got1.tier === 1 && r.E.pts === 70000 && r.E.wOwn[got1.k].includes(1) && r.E.roll[got1.k + ':1'] >= 1.05, 'rare weapon cache opened on the server ' + JSON.stringify(got1));
setEco('tg_111', (S) => { S.roll[got1.k + ':1'] = 1.06; });   // the crate can roll 110%, which can't be tuned
[s, r] = await act(A, 'tune', { w: 1, k: got1.k, t: 1 }); t(r.ok && typeof r.out.better === 'boolean' && r.E.pts === 60000, 'tune-up on the server');
[s, r] = await act(A, 'tune', { w: 1, k: 'pulse', t: 0 }); t(r.out.err === 'crate', 'starter gear cannot be tuned');
[s, r] = await act(A, 'salvage', { tk: 'chassis', ri: 2 }); t(r.out.sal && r.E.pts === 40000, 'salvage on the server');
[s, r] = await act(A, 'up', { k: 'hull' }); t(r.out.lv === 1 && r.E.up.hull === 1 && r.E.pts === 39500, 'upgrade bought with server points');
[s, r] = await act(A, 'up', { k: 'nope' }); t(s === 400, 'unknown upgrade refused');
[s, r] = await act(A, 'hack', {}); t(s === 400, 'unknown action refused');
// power and league come from what you own
[s, r] = await call('/api/sync', { initData: initData(A), L: { w: { a: got1.k, t: 1, q: 1.1 }, c: { c: 'titan', t: 2, q: 1.1 }, skin: 'lunar' } });
const Lw = E('tg_111').L.w, Lc = E('tg_111').L.c;
const S1 = E('tg_111'), ownsC = Lc.s ? R.salvIn(S1, Lc.c, Lc.t) === Lc.q : R.hasC(S1, Lc.c, Lc.t) && R.rollIn(S1, Lc.c, Lc.t) === Lc.q;
t(Lw.a === got1.k && Lw.t === 1 && Lw.q === S1.roll[got1.k + ':1'] && ownsC && !(Lc.c === 'titan' && Lc.t === 2 && !Lc.s) && S1.L.skin === 'default', 'loadout: owned rare weapon with the server roll; the unowned crate epic chassis falls back to what they own; no skin ' + JSON.stringify(S1.L).slice(0, 160));

// ---- Stars: invoice priced by the server, webhook grants, recovery, refunds ----
[s, r] = await call('/api/stars-invoice', { initData: initData(A), kind: 'box', tk: 'weapon', ri: 1, price: 0.01 }); t(s === 200 && r.stars === 1000 && r.nonce, 'stars invoice: the server sets the price (2nd rare weapon cache x2; a forged price is ignored) ' + JSON.stringify(r));
const nonce = r.nonce;
const payBody = (charge, payload, amount) => ({ message: { from: { id: 111, username: 'alice' }, chat: { id: 111, type: 'private' }, successful_payment: { total_amount: amount, telegram_payment_charge_id: charge, invoice_payload: JSON.stringify(payload) } } });
const w0 = JSON.stringify(E('tg_111').wOwn);
let wr = await hook(payBody('ch.1', { u: 111, k: 'box', t: 'weapon', r: 1, g: 8, n: nonce }, 500)); t(wr.status === 200, 'webhook');
t(JSON.stringify(E('tg_111').wOwn) !== w0 || E('tg_111').roll, 'webhook granted the crate on the server');
t(Array.isArray(db.get('/starsPaid/tg_111/ch_1/o')) && db.get('/starsPaid/tg_111/ch_1/o').length === 1, 'what it gave is stored with the payment');
await hook(payBody('ch.1', { u: 111, k: 'box', t: 'weapon', r: 1, g: 8, n: nonce }, 500));
t(E('tg_111').buys.weapon1 === 2, 'Telegram resending the same payment grants once (buys ' + E('tg_111').buys.weapon1 + ')');
[s, r] = await act(A, 'paid', { n: nonce }); t(r.ok && r.out.outs && r.out.outs.length === 1, 'the phone fetches what its Stars purchase gave');
[s, r] = await call('/api/sync', { initData: initData(A), boot: true }); t(r.stars.length === 1 && r.stars[0].n === nonce && r.stars[0].o.length === 1, 'undelivered stars listed with what they gave');
[s, r] = await call('/api/sync', { initData: initData(A), boot: true, starsAck: [nonce] }); t(r.stars.length === 0, 'acked stars hidden');
[s, r] = await call('/api/stars-invoice', { initData: initData(A), kind: 'box', tk: 'weapon', ri: 1 }); t(r.stars === 1500, 'repeat-buy price from the server record (3rd rare weapon cache x3) ' + r.stars);
// moonbeam: buy, field it, refund takes it back
[s, r] = await call('/api/stars-invoice', { initData: initData(A), kind: 'moonbeam' }); t(r.stars === 3300, 'moonbeam invoice');
await hook(payBody('ch.mb', { u: 111, k: 'moonbeam', n: 'mb1' }, 3300));
t(E('tg_111').moonbeam === true, 'moonbeam granted by the webhook');
[s, r] = await call('/api/stars-invoice', { initData: initData(A), kind: 'moonbeam' }); t(s === 409 && r.error === 'owned', 'one-time item not sold twice');
[s, r] = await call('/api/sync', { initData: initData(A), L: { w: { a: 'moon' }, c: { c: 'vanguard', t: 0 } } }); t(E('tg_111').L.w.a === 'moon', 'owned moonbeam fielded');
await hook({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, refunded_payment: { currency: 'XTR', total_amount: 3300, invoice_payload: '{}', telegram_payment_charge_id: 'ch.mb' } } });
t(E('tg_111').moonbeam === false && db.get('/starsPaid/tg_111/ch_mb/rf') > 0, 'Stars refund removes the moonbeam');
[s, r] = await call('/api/sync', { initData: initData(A), L: { w: { a: 'moon' }, c: { c: 'vanguard', t: 0 } } }); t(E('tg_111').L.w.a !== 'moon', 'refunded moonbeam can\'t be fielded');
const ownBefore = JSON.stringify([E('tg_111').wOwn, E('tg_111').roll]);
await hook({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, refunded_payment: { currency: 'XTR', total_amount: 500, invoice_payload: '{}', telegram_payment_charge_id: 'ch.1' } } });
t(JSON.stringify([E('tg_111').wOwn, E('tg_111').roll]) !== ownBefore, 'refunded crate: its item comes back out');
t(db.get('/flags/tg_111/r/refunds'), 'two refunds flag the pilot');

// ---- TON: memo AND amount, each transaction once, price from the server ----
const tonDesc = { kind: 'box', tk: 'weapon', ri: 0 };
[s, r] = await call('/api/pay-log', { initData: initData(A), cur: 'TON', amt: 3, gram: 3, item: 'Common Weapon Cache', memo: 'LWM|tg_111|abc', desc: tonDesc }); t(r.error === 'unavailable', 'TON amount below the price refused');
[s, r] = await call('/api/pay-log', { initData: initData(A), cur: 'TON', amt: 4, gram: 4, item: 'Common Weapon Cache', memo: 'LWM|tg_111|zzz', desc: tonDesc }); t(r.error === 'unavailable', 'no matching memo on chain: not granted');
tonTxs = [{ in_msg: { value: '2000000000', message: 'LWM|tg_111|low' }, transaction_id: { hash: 'h0' } }].concat(tonTxs);
[s, r] = await call('/api/pay-log', { initData: initData(A), cur: 'TON', amt: 4, gram: 4, item: 'Common Weapon Cache', memo: 'LWM|tg_111|low', desc: tonDesc }); t(r.error === 'unavailable', 'memo matches but the chain shows 2 TON for a 4 TON item: not granted');
[s, r] = await call('/api/pay-log', { initData: initData(A), cur: 'TON', amt: 4, gram: 4, item: 'Common Weapon Cache', memo: 'LWM|tg_111|abc', desc: tonDesc }); t(r.error === 'unavailable', 'orderless TON with matching memo cannot grant ' + JSON.stringify(r).slice(0, 160));
t(db.get('/tonTx/h1') === null, 'legacy proof never consumed');
[s, r] = await call('/api/pay-log', { initData: initData(A), cur: 'TON', amt: 4, memo: 'LWM|tg_111|abc', desc: tonDesc }); t(r.error === 'unavailable', 'same order again: nothing new');
tonTxs.push({ in_msg: { value: '9000000000', message: 'LWM|tg_111|re' }, transaction_id: { hash: 'h1' } });
[s, r] = await call('/api/pay-log', { initData: initData(A), cur: 'TON', amt: 4, memo: 'LWM|tg_111|re', desc: tonDesc }); t(r.error === 'unavailable', 'a transaction hash pays for one order only ' + JSON.stringify(r));
[s, r] = await call('/api/pay-log', { initData: initData(A), cur: 'TON', amt: 8, memo: 'LWM|tg_222|zzz' }); t(r.error === 'unavailable', 'memo must be own');

// ---- the one-time move for a pilot who played before ----
db.root.players.tg_444 = { pts: 60000, name: 'oldtimer', days: 9, ld: day - 1, d: day - 1, w: 1, dailyPts: 300 };
db.root.starsPaid = db.root.starsPaid || {}; db.root.starsPaid.tg_444 = { c1: { k: 'starter', n: 'aa', stars: 399 } };
const D = { id: 444, username: 'oldtimer' };
const save444 = { pts: 30000, earned: 999999, up: { hull: 2, cannon: 1, engine: 0, target: 0, reactor: 0 }, wOwn: { pulse: [0], twin: [1], siege: [2] }, cOwn: { scout: [], vanguard: [0], titan: [1] },
  roll: { 'twin:1': 1.08, 'siege:2': 1.5, 'titan:1': 1.07 }, salv: {}, gemLvl: { dmg: 2, rof: 1, arm: 1, spd: 1, lck: 1, reg: 1 }, gemShards: {}, starter: true, moonbeam: true, paints: { stock: 1 },
  login: { last: day - 1, n: 4 }, q: { q_win1: { p: 1, done: true, claimed: true } }, streak: 3, wins: 30, losses: 20, mp: 50 };
[s, r] = await call('/api/sync', { initData: initData(D), mig: save444, L: { w: { a: 'siege', t: 2 }, c: { c: 'titan', t: 1 } } });
const S4 = E('tg_444');
t(r.migOk && S4.earned === 60000 && S4.mig === 1, 'lifetime points stay as the server had them (not the phone\'s 999,999)');
t(S4.wOwn.twin.includes(1) && S4.cOwn.titan.includes(1) && S4.roll['siege:2'] === 1.1, 'starter-pack gear moved over; rolls held to 105-110%');
t(S4.wOwn.siege.includes(2) && S4.moonbeam === true, 'unexplained gear is kept, not deleted');
const f4 = db.get('/flags/tg_444/r') || {};
t(f4.mig_epic && f4.mig_moonbeam && !f4.mig_starter, 'unpaid epic and moonbeam flagged; the paid starter pack is not ' + JSON.stringify(Object.keys(f4)));
t(S4.pts === 30000 && S4.q.q_win1.claimed && S4.login.n === 4, 'spendable points, claimed milestones and the login streak carried over');
[s, r] = await call('/api/sync', { initData: initData(D), mig: { ...save444, pts: 1e7, moonbeam: true, skin: 'lunar' } }); t(E('tg_444').skin === 'default' && E('tg_444').pts === 30000, 'the move happens once');
db.root.players.tg_445 = { pts: 1000, name: 'small' };
[s, r] = await call('/api/sync', { initData: initData({ id: 445 }), mig: { pts: 500000, up: { hull: 4, cannon: 4, engine: 4, target: 4, reactor: 4 } } });
t(E('tg_445').pts === 0 && db.get('/flags/tg_445/r/mig_spend'), 'upgrades worth 100K on 1K lifetime points: no spendable points, flagged');

// ---- referrals, squad, alts ----
[s, r] = await call('/api/sync', { initData: initData(B, 0, 'ref_111'), refBy: 'tg_111' }, '9.9.9.9'); t(r.rec.ref === 'tg_111', 'ref set');
t(db.get('/players/tg_222/name') === 'Bob script', 'name sanitized from telegram: ' + db.get('/players/tg_222/name'));
[s, r] = await call('/api/sync', { initData: initData(B, 0, 'ref_999'), refBy: 'tg_999' }); t(r.rec.ref === 'tg_111', 'ref fixed');
[s, r] = await call('/api/sync', { initData: initData(J, 0, 'ref_999'), refBy: 'tg_999' }); t(!r.rec.ref, 'no self ref');
setEco('tg_222', (S) => { S.earned = 6000; S.days = 5; }); db.root.players.tg_222.pts = 6000; db.root.players.tg_222.days = 5;
[s, r] = await call('/api/squad', { initData: initData(A) }); t(r.squad.length === 1 && r.squad[0].id === 'tg_222' && !r.squad[0].held, 'squad ' + JSON.stringify(r.squad));
setEco('tg_111', (S) => { S.dailyPts = 0; S.refC = {}; });
const sq0 = E('tg_111').earned;
[s, r] = await act(A, 'squad'); t(r.out.pts === 500 + 2000 + 300 && E('tg_111').earned === sq0 + 2800, 'squad payout computed by the server: milestones + 5% ' + JSON.stringify(r.out));
[s, r] = await act(A, 'squad'); t(r.out.pts === 0, 'squad payout once');
// an alt: the recruit plays from the referrer's network
[s, r] = await call('/api/sync', { initData: initData(A) }, '7.7.7.7');
[s, r] = await call('/api/sync', { initData: initData(C, 0, 'ref_111'), refBy: 'tg_111' }, '7.7.7.7');
t(db.get('/flags/tg_333/r/alt') && db.get('/flags/tg_111/r/alt'), 'recruit on the referrer\'s network: both flagged');
setEco('tg_333', (S) => { S.earned = 30000; S.days = 12; }); db.root.players.tg_333.pts = 30000; db.root.players.tg_333.days = 12;
[s, r] = await call('/api/squad', { initData: initData(A) }); t(r.squad.find((x) => x.id === 'tg_333').held, 'flagged recruit shows as held');
setEco('tg_111', (S) => { S.dailyPts = 0; });
[s, r] = await act(A, 'squad'); t(r.out.pts === 0, 'payouts from a flagged recruit are held ' + JSON.stringify(r.out));

// ---- anomaly flags ----
setEco('tg_222', (S) => { S.an = { d: day, m: 3, h: 0, ai: 55, aw: 54, s: 3000, p: 6000 }; });
st = await start(B, { g: 'arena', m: '1v1' }, Date.now()); en = await end(B, st.tok, { won: true }, Date.now() + 30000);
t(en.ok && db.get('/flags/tg_222/r/winrate'), 'AI win rate over 90% across 50+ matches flagged');
setEco('tg_222', (S) => { S.an.h = (1 << 22) - 1; S.an.d = day; S.mh = null; });
st = await start(B, { g: 'arena', m: '1v1' }, Date.now()); en = await end(B, st.tok, { won: false }, Date.now() + 30000);
t(db.get('/flags/tg_222/r/hours'), 'play spread over 20+ hours of one day flagged');
{
  const u = { id: 555 }; await call('/api/sync', { initData: initData(u) });
  for (let i = 0; i < 5; i++) { const s0 = await start(u, { g: 'arena', m: '3v3' }, Date.now() + i * 1000); await end(u, s0.tok, { won: true }, Date.now() + i * 1000 + 5000); }
  t(db.get('/flags/tg_555/r/fast'), 'five too-fast results flagged');
}

// ---- leaderboard and snapshot skip flagged pilots; admin sees and clears flags ----
db.root.players.tg_666 = { pts: 90000, name: 'clean', days: 4 };
let lb = await mod.buildLeaderboard(env);
t(lb.top.some((x) => x[0] === 'tg_666') && !lb.top.some((x) => x[0] === 'tg_444') && !lb.top.some((x) => x[0] === 'tg_111'), 'flagged pilots left off the public top ' + JSON.stringify(lb.top.map((x) => x[0])));
t(db.get('/lb/top').length === lb.top.length, 'lb stored');
[s, r] = await call('/api/admin', { initData: initData(A) }); t(s === 403, 'non-admin refused');
// New source index requires an explicit bounded migration; no automatic scan on export.
const {backfillSnapshotPage}=await import('../../../worker/src/snapshot.js');
while(!(await backfillSnapshotPage(env)).complete){}
[s, r] = await call('/api/admin', { initData: initData(J), snap: 1 });
t(s === 200 && r.flagged.some((f) => f.id === 'tg_444' && f.why.some((w) => /mig_epic/.test(w))), 'admin lists flagged pilots with reasons');
t(r.snapshot.some((x) => x[0] === 'tg_666' && x[3] === 4) && !r.snapshot.some((x) => x[0] === 'tg_444'), 'snapshot: points and days, flagged left out');
t(db.get('/players/tg_111/sg') > 0 && r.snapshot.every((x) => typeof x[5] === 'number'), 'verified spending (TON value) on the record and in the snapshot ' + db.get('/players/tg_111/sg'));
t(r.revenue.STARS >= 500 && r.revenue.TON === 0 && r.revenue.unverified >= 2, 'admin revenue (unverified orders counted apart) ' + JSON.stringify(r.revenue));
[s, r] = await call('/api/admin', { initData: initData(J), clear: 'tg_444', snap: 1 });
t(!r.flagged.some((f) => f.id === 'tg_444') && r.snapshot.some((x) => x[0] === 'tg_444'), 'cleared pilot counts again');
lb = await mod.buildLeaderboard(env); t(lb.top.some((x) => x[0] === 'tg_444'), 'cleared pilot back on the board');

// ---- reminders ----
await hook({ message: { from: { id: 222 }, chat: { id: 222, type: 'private' }, text: '/start' } });
t(db.get('/ntf/tg_222/on') === 1, 'start registers ntf');
const d0 = new Date(); d0.setUTCHours(16, 1, 0, 0);
db.root.ntf.tg_222.pl = Math.floor(d0.getTime() / 86400000) - 1; db.root.ntf.tg_222.sk = 3;   // last played and streak sit next to the reminder settings (mirrored on every save)
const n1 = await mod.sendReminders(env, d0.getTime());
const n2 = await mod.sendReminders(env, d0.getTime() + 300000);
t(n1 === 1 && n2 === 0, 'reminders once ' + n1 + ' ' + n2);
t(/3-day streak/.test(tgCalls[tgCalls.length - 1][1].text), 'streak text: ' + tgCalls[tgCalls.length - 1][1].text);
db.root.ntf.tg_222.sk = 1; db.root.ntf.tg_222.gf = 0; db.root.ntf.tg_222.nx = Math.floor(d0.getTime() / 86400000);
await mod.sendReminders(env, d0.getTime() + 600000);
t(/welcome-back gift/.test(tgCalls[tgCalls.length - 1][1].text), 'gift reminder text: ' + tgCalls[tgCalls.length - 1][1].text);
const d1 = new Date(); d1.setUTCHours(3, 0, 0, 0);
t((await mod.sendReminders(env, d1.getTime())) === 0, 'no reminders off-hours');

// ---- invoices: paints, the pass, deals, Founder pack ----
[s, r] = await call('/api/stars-invoice', { initData: initData(J), kind: 'paint', tk: 'gold', price: 1 }); t(s === 200 && r.stars === 300, 'paint invoice fixed price ' + JSON.stringify(r));
[s, r] = await call('/api/stars-invoice', { initData: initData(J), kind: 'paint', tk: 'stock' }); t(s === 400, 'free paint not sold');
[s, r] = await call('/api/stars-invoice', { initData: initData(J), kind: 'pass', tk: '1', price: 99 }); t(s === 200 && r.stars === 799, 'pass invoice ' + JSON.stringify(r));
[s, r] = await call('/api/stars-invoice', { initData: initData(J), kind: 'box', tk: 'gem', ri: 0, price: 4 }); t(s === 200 && r.stars === 250, 'common crate 250');
const lastInv = tgCalls.filter(c => c[0] === 'createInvoiceLink').pop(); t(/Common Gem Cache/.test(lastInv[1].title), 'invoice title');
{ // deals: d = first rare/epic gem cache of the day 30% off, w = one epic crate a week 25% off; once paid, that period's deal is used
  const inv = (o) => call('/api/stars-invoice', Object.assign({ initData: initData(J), kind: 'box' }, o));
  const lastPayload = () => JSON.parse(tgCalls.filter(c => c[0] === 'createInvoiceLink').pop()[1].payload);
  [s, r] = await inv({ tk: 'gem', ri: 1, deal: 'd' }); t(s === 200 && r.stars === 350 && lastPayload().x === 'd', 'daily gem deal 30% off ' + JSON.stringify(r));
  [s, r] = await inv({ tk: 'gem', ri: 2, deal: 'd' }); t(s === 200 && r.stars === 1050, 'daily deal on an epic gem cache ' + JSON.stringify(r));
  [s, r] = await inv({ tk: 'weapon', ri: 1, deal: 'd' }); t(s === 409, 'daily deal is gems only');
  [s, r] = await inv({ tk: 'gem', ri: 0, deal: 'd' }); t(s === 409, 'no deal on common caches');
  [s, r] = await inv({ tk: 'chassis', ri: 2, deal: 'w' }); t(s === 200 && r.stars === 1125 && lastPayload().x === 'w', 'weekly epic deal 25% off ' + JSON.stringify(r));
  [s, r] = await inv({ tk: 'chassis', ri: 1, deal: 'w' }); t(s === 409, 'weekly deal is epic only');
  [s, r] = await inv({ tk: 'gem', ri: 1 }); t(s === 200 && r.stars === 500 && !lastPayload().x, 'no deal asked: full price ' + JSON.stringify(r));
  const paid = async (x, ch, k, tk, ri) => hook({ message: { from: { id: 999, username: 'LunarBattle' }, chat: { id: 999, type: 'private' }, successful_payment: { total_amount: 1125, telegram_payment_charge_id: ch, invoice_payload: JSON.stringify({ u: 999, k: 'box', t: tk, r: ri, g: 17.25, n: 'dw' + ch.slice(-1), x }) } } });
  await paid('w', 'ch.w1', 'box', 'chassis', 2);
  [s, r] = await inv({ tk: 'weapon', ri: 2, deal: 'w' }); t(s === 409 && r.error === 'deal_used', 'weekly deal used after paying ' + s + ' ' + JSON.stringify(r));
  [s, r] = await inv({ tk: 'gem', ri: 1, deal: 'd' }); t(s === 200 && r.stars === 350, 'daily deal still open');
  await paid('d', 'ch.d1', 'box', 'gem', 1);
  [s, r] = await inv({ tk: 'gem', ri: 2, deal: 'd' }); t(s === 409, 'daily deal used after paying');
  t(E('tg_999').cOwn.chassis === undefined && Object.values(E('tg_999').cOwn).some((ts) => ts.includes(2)), 'epic chassis crate granted');
  const rec = (await call('/api/sync', { initData: initData(J), boot: true }))[1];
  const lost = (rec.stars || []).find((x) => x.n === 'dw1'); t(lost && lost.x === 'w', 'undelivered deal purchase keeps its deal tag ' + JSON.stringify(rec.stars).slice(0, 200));
  [s, r] = await call('/api/stars-invoice', { initData: initData(J), kind: 'founder', price: 1 }); t(s === 200 && r.stars === 1199 && /Founder Pack/.test(tgCalls.filter(c => c[0] === 'createInvoiceLink').pop()[1].title), 'founder pack invoice ' + JSON.stringify(r));
}
const cmd = async (text) => { const n0 = tgCalls.length; await hook({ message: { from: { id: 333 }, chat: { id: 333, type: 'private' }, text } }); return tgCalls.slice(n0); };
let out = await cmd('/paysupport'); t(out.length === 1 && /@LunarBattle/.test(out[0][1].text) && /Telegram support can't help/.test(out[0][1].text), 'paysupport reply');
out = await cmd('/terms'); t(out.length === 1 && /terms\.html/.test(out[0][1].text), 'terms reply');
[s, r] = await call('/api/admin', { initData: initData(J) }); t(s === 200 && r.stats && typeof r.stats.conv === 'number' && r.stats.payers >= 1, 'admin stats ' + JSON.stringify(r.stats));
t(db.get('/players/tg_111/fd') !== undefined, 'first day stored');
t(!JSON.stringify(db.root.lb).includes('iph') && !db.get('/players/tg_111/iph'), 'network hashes never reach the public file');

// ---- build budget (14 levels across 5 stats) and reset build (half the points back) ----
{
  const D = { id: 4444, username: 'dana' }, pd = 'tg_4444';
  await call('/api/sync', { initData: initData(D), boot: true });
  setEco(pd, (S) => { S.pts = 100000; S.earned = 100000; });
  let n = 0;
  for (const k of ['hull', 'cannon', 'engine']) for (let i = 0; i < 4; i++) { [s, r] = await act(D, 'up', { k }); if (r.out && r.out.lv) n++; }
  for (let i = 0; i < 2; i++) { [s, r] = await act(D, 'up', { k: 'target' }); if (r.out && r.out.lv) n++; }
  t(n === 14 && R.upLevels(E(pd).up) === 14, 'build: 14 levels bought ' + JSON.stringify(E(pd).up));
  [s, r] = await act(D, 'up', { k: 'reactor' }); t(r.out.err === 'budget' && E(pd).up.reactor === 0 && E(pd).pts === 100000 - 62500, 'build budget full: a 15th level is refused, nothing charged ' + JSON.stringify(r.out));
  const pw14 = db.get('/players/tg_4444/power');
  [s, r] = await act(D, 'respec'); t(r.out.back === 31250 && r.out.lost === 31250 && R.upLevels(r.E.up) === 0 && r.E.pts === 100000 - 62500 + 31250, 'reset build: every level to 0, half the points back ' + JSON.stringify(r.out));
  t(db.get('/players/tg_4444/power') < pw14 && r.E.earned === 100000, 'power drops with the build; lifetime points (rank) untouched');
  [s, r] = await act(D, 'respec'); t(r.out.err === 'empty', 'nothing to reset');
  // a pilot who bought more than 14 levels before the budget: the top levels come off, paid back in full
  setEco(pd, (S) => { S.up = { hull: 4, cannon: 4, engine: 4, target: 4, reactor: 4 }; S.pts = 0; });
  [s, r] = await act(D, 'login'); t(R.upLevels(r.E.up) === 14 && r.E.pts - (r.out.pts || 0) === 67500 && r.E.up.hull === 3 && r.E.up.reactor === 2, 'over the budget: trimmed to 14, refunded in full ' + JSON.stringify(r.E.up) + ' ' + r.E.pts);
  // paid reset: the points fee (half the build) priced at 6,250 points per $1 in $0.50 tiers, $1 to $5; every point comes back
  t(R.respecTier(16500) === 1.5 && R.respecTier(62500) === 5 && R.respecTier(9375) === 1 && R.respecTier(6250) === 0, 'paid reset tiers: 16,500 → $1.50, full → $5, small builds points only');
  setEco(pd, (S) => { S.up = { hull: 4, cannon: 4, engine: 4, target: 2, reactor: 0 }; S.pts = 0; S.ptsSpent = 62500; });
  [s, r] = await call('/api/stars-invoice', { initData: initData(D), kind: 'respec', price: 0.01 }); t(s === 200 && r.stars === 385 && /Build reset/.test(tgCalls.filter(c => c[0] === 'createInvoiceLink').pop()[1].title), 'paid reset invoice: full build is $5 = 385 Stars ' + JSON.stringify(r));
  const rpay = (ch, g) => hook({ message: { from: { id: 4444, username: 'dana' }, chat: { id: 4444, type: 'private' }, successful_payment: { total_amount: 385, telegram_payment_charge_id: ch, invoice_payload: JSON.stringify({ u: 4444, k: 'respec', g, n: 'rs' + ch }) } } });
  const pw0 = db.get('/players/tg_4444/power');
  await rpay('rs1', 6.25);
  t(R.upLevels(E(pd).up) === 0 && E(pd).pts === 62500 && E(pd).ptsSpent === 0 && db.get('/players/tg_4444/power') < pw0, 'paid reset: levels to 0, all 62,500 points back, power follows ' + E(pd).pts);
  await rpay('rs1', 6.25); t(E(pd).pts === 62500, 'paid reset granted once');
  [s, r] = await call('/api/stars-invoice', { initData: initData(D), kind: 'respec' }); t(s === 400, 'nothing to reset: no invoice');
  await hook({ message: { from: { id: 4444 }, chat: { id: 4444, type: 'private' }, refunded_payment: { total_amount: 385, telegram_payment_charge_id: 'rs1', invoice_payload: '{}' } } });
  t(E(pd).pts === 31250 && R.upLevels(E(pd).up) === 0, 'refunded paid reset: the extra half goes back, like a points reset ' + E(pd).pts);
  // paid with nothing left to clear (reset with points in between): it waits for the next reset
  await rpay('rs2', 1.25); t(E(pd).rsCr === 1, 'paid reset with an empty build is saved for later');
  [s, r] = await call('/api/stars-invoice', { initData: initData(D), kind: 'respec' }); t(s >= 400, 'a saved paid reset is not sold twice');
  setEco(pd, (S) => { S.up = { hull: 4, cannon: 0, engine: 0, target: 0, reactor: 0 }; S.pts = 0; });
  [s, r] = await act(D, 'respec'); t(r.out.back === 10000 + 7813 && r.E.rsCr === 0, 'next reset uses it: half back plus $1 of fee covered ' + JSON.stringify(r.out));
}

// ---- Survival (megatank): accepted as an AI mode; a draw means lasting the whole clock ----
t(R.GT_ORDER.includes('boss') && !R.liveModes(day).includes('boss'), 'Survival is an AI mode');
t(eco.minSecs('boss', '1v1', false, true, 0) === 170 && eco.minSecs('boss', '2v2', true, false, 0) === 40, 'Survival minimum times');
t(R.winBase('royale', '1v1') > Math.max(...R.GT_ORDER.filter((g) => g !== 'royale').flatMap((g) => Object.keys(R.MODES).map((m) => R.winBase(g, m)))), 'Last Standing pays the most for a win');

// ---- ghosts: offline pilots' tanks in AI seats; their owners get a report, never points ----
{
  const G = { id: 601, username: 'ghosty' }, P = { id: 602, username: 'pia' }, nowG = Date.now();
  await call('/api/sync', { initData: initData(P), boot: true });
  const pwP = db.get('/players/tg_602/power');
  const Lg = JSON.parse(JSON.stringify(R.STOCK_L)); Lg.up.hull = 2;
  db.root.gh = db.root.gh || {};
  Object.assign(db.root.gh, {
    tg_601: { n: 'Ghosty', L: Lg, pw: pwP, t: nowG - 20 * 60000 },        // offline, same power: eligible
    tg_603: { n: 'Online', L: Lg, pw: pwP, t: nowG - 60000 },              // played a minute ago: still online
    tg_604: { n: 'Far', L: Lg, pw: pwP * 3, t: nowG - 20 * 60000 },        // much stronger: out of the band
  });
  const eG = Object.keys(db.root.eco).length;
  const stG = await start(P, { g: 'arena', m: '2v2', L: R.STOCK_L }, nowG);
  t(stG.ok && Array.isArray(stG.gh) && stG.gh.length === 1 && stG.gh[0].n === 'Ghosty' && stG.gh[0].i === 0 && !JSON.stringify(stG.gh).includes('tg_'), 'ticket comes with offline ghosts in your power band, by seat number only ' + JSON.stringify(stG.gh).slice(0, 120));
  const before = E('tg_602').earned;
  const enG = await end(P, stG.tok, { won: true, gh: [{ i: 0, won: 0, dmg: 2345, kills: 2 }, { i: 7, won: 1, dmg: 1 }] }, nowG + 70000);
  const want = Math.round(R.MODES['2v2'].win * R.teamX('arena', '2v2', false)) + R.streakPts('arena', '2v2', 1);
  t(enG.ok && enG.res.pts === want, 'facing a ghost pays exactly what an AI tank pays ' + JSON.stringify(enG.res));
  const gr = db.get('/ghr/tg_601');
  t(gr && gr.m === 1 && gr.l === 1 && !gr.w && gr.dmg === 2345 && gr.kills === 2, 'ghost owner gets a report (unknown seats ignored) ' + JSON.stringify(gr));
  t(!db.root.eco.tg_601 && Object.keys(db.root.eco).length === eG, 'ghost owner earns nothing (no record touched)');
  [s, r] = await call('/api/sync', { initData: initData(G), boot: true });
  t(r.ghost && r.ghost.m === 1 && r.ghost.l === 1 && r.E.earned === 0, 'offline report on return ' + JSON.stringify(r.ghost));
  [s, r] = await call('/api/sync', { initData: initData(G), ghAck: r.ghost.last });
  t(!db.get('/ghr/tg_601'), 'report cleared once shown');
  // your own tank joins the pool once you've played a few matches
  setEco('tg_602', (S) => { S.mp = 5; });
  await act(P, 'login');
  const mine = db.get('/gh/tg_602');
  t(mine && mine.L && mine.pw === db.get('/players/tg_602/power') && mine.n === 'pia', 'your tank in the ghost pool (server loadout) ' + JSON.stringify(mine).slice(0, 80));
  const stS = await start(P, { g: 'boss', m: '1v1', L: R.STOCK_L }, nowG + 200000);
  t(stS.ok && (stS.gh || []).length === 0, 'Survival 1v1 has no AI seats for ghosts');
  t(eco.ghostSeats('royale', '1v1') === 2 && eco.ghostSeats('arena', '1v1') === 1 && eco.ghostSeats('boss', '3v3') === 1, 'ghost seats per mode');
}

// ---- Hyperspace Vault: endless Gold deposits for looks only (badge, tooth, paint...), priced and granted by the server ----
{
  const V = { id: 5555, username: 'vic' }, pv = 'tg_5555';
  t(R.vaultLevel(249) === 0 && R.vaultLevel(250) === 1 && R.vaultLevel(1500) === 3 && R.vaultLevel(10000) === 7 && R.vaultLevel(14999) === 7 && R.vaultLevel(15000) === 8 && R.vaultLevel(100000) === 25, 'Vault levels: 250, 750, 1,500 ... 10,000, then +5,000 a level');
  t(R.vaultTier(4).n === 'Bronze' && R.vaultTier(5).n === 'Silver' && R.vaultTier(20).n === 'Hyperspace' && R.vaultTitle(15) === 'Vault Keeper' && R.vaultTitle(25) === 'Gold Tooth Legend', 'badge colors every 5 levels, titles at 15 and 25');
  await call('/api/sync', { initData: initData(V), boot: true });
  await act(V, 'login');
  const pts0 = E(pv).pts, earned0 = E(pv).earned;
  [s, r] = await call('/api/stars-invoice', { initData: initData(V), kind: 'vault', tk: 'chest' });
  t(s === 200 && r.stars === 1000 && /Hyperspace Vault: Chest/.test(tgCalls.filter(c => c[0] === 'createInvoiceLink').pop()[1].title), 'Vault invoice: the server prices the Chest at 1,000 Stars ' + JSON.stringify(r));
  [s, r] = await call('/api/stars-invoice', { initData: initData(V), kind: 'vault', tk: 'mega' }); t(s === 400, 'unknown Vault bundle: no invoice');
  const vpay = (ch, tk, g, stars) => hook({ message: { from: { id: 5555, username: 'vic' }, chat: { id: 5555, type: 'private' }, successful_payment: { total_amount: stars, telegram_payment_charge_id: ch, invoice_payload: JSON.stringify({ u: 5555, k: 'vault', t: tk, g, n: 'v' + ch }) } } });
  const rev0 = db.get('/meta/revc') || 0;
  await vpay('vc1', 'chest', 16, 1000);
  t(E(pv).vg === 1050 && Math.abs(E(pv).spendGram - 16) < 1e-9 && db.get('/players/tg_5555/vg') === 1050, 'Chest: 1,050 Gold (5% bonus), counted as verified spending ' + E(pv).vg);
  t((db.get('/meta/revc') || 0) - rev0 === 1300, 'a Vault deposit feeds the liquidity fund like any sale');
  await vpay('vc1', 'chest', 16, 1000); t(E(pv).vg === 1050, 'the same payment is granted once');
  [s, r] = await call('/api/stars-invoice', { initData: initData(V), kind: 'vault', tk: 'chest' }); t(s === 200, 'the Vault never fills: the same bundle can be bought again');
  await vpay('vh1', 'hyper', 400, 25000);
  const S1 = E(pv);
  t(S1.vg === 29800 && R.vaultLevel(S1.vg) === 10 && S1.paints.hyper === 1 && S1.L && S1.L.vl === 10, 'Hyperspace: 28,750 Gold, level 10, Hyperspace paint unlocked, the loadout carries the level ' + S1.vg + ' ' + JSON.stringify(S1.L && S1.L.vl));
  t(S1.vgg === 29800 && db.get('/players/tg_5555/gg') === 29800, 'before launch, every deposit is also Genesis Gold ' + S1.vgg);
  t(R.ecoNorm({ vg: 5000 }).vgg === 5000 && R.ecoNorm({ vg: 5000, vgg: 1000 }).vgg === 1000 && R.ecoNorm({}).vgg === 0, 'Gold deposited before tracking counts as Genesis');
  t(S1.pts === pts0 && S1.earned === earned0 && R.powerOf(S1.L) === R.powerOf({ ...S1.L, vl: 0 }), 'looks only: no points, no power');
  const tk = R.tankOf(S1.L, 1); t(tk.vl === 10 && R.tankOf({ ...S1.L, vl: 'x' }, 1).vl === 0, 'the battle tank carries the Vault level (looks)');
  t(R.ecoLoadout(R.ecoNorm({}), { paint: 'hyper' }).paint === 'stock' && R.ecoLoadout(S1, { paint: 'hyper' }).paint === 'hyper', 'the Hyperspace paint only for Vault level 7+');
  await hook({ message: { from: { id: 5555 }, chat: { id: 5555, type: 'private' }, refunded_payment: { total_amount: 25000, telegram_payment_charge_id: 'vh1', invoice_payload: '{}' } } });
  t(E(pv).vg === 1050 && E(pv).vgg === 1050 && !E(pv).paints.hyper && Math.abs(E(pv).spendGram - 16) < 1e-9, 'refunded deposit: its Gold, the paint and the spending come off ' + E(pv).vg);
  // TON: the price comes from the server, the Gold from the verified payment
  tonTxs.push({ in_msg: { value: '4000000000', message: 'LWM|tg_5555|vt1' }, transaction_id: { hash: 'hv1' } });
  [s, r] = await call('/api/pay-log', { initData: initData(V), cur: 'TON', amt: 3, memo: 'LWM|tg_5555|vt0', desc: { kind: 'vault', tk: 'pouch' } }); t(r.error === 'unavailable', 'Vault in TON: under the price is refused');
  [s, r] = await call('/api/pay-log', { initData: initData(V), cur: 'TON', amt: 4, memo: 'LWM|tg_5555|vt1', desc: { kind: 'vault', tk: 'pouch' } });
  t(r.error === 'unavailable' && E(pv).vg === 1050, 'orderless TON cannot add Vault Gold ' + JSON.stringify(r.out));
  for (const [g, m, mp] of [['royale', '1v1', 'longshot'], ['arena', '2v2', 'classic']]) {
    [s, r] = await call('/api/match/start', { initData: initData(V), g, m, map: mp, pv: 1, L: { paint: 'hyper' } });
    t(s === 200 && r.tok, 'a Vault pilot gets a match ticket: ' + g + ' ' + s + ' ' + JSON.stringify(r).slice(0, 120));
  }
  const lbv = await mod.buildLeaderboard(env);
  const vr = (lbv.vault || []).find((x) => x[0] === pv);
  t(vr && vr[2] === 1050 && vr[3] === 2, 'the Vault board ranks by lifetime Gold, with the level ' + JSON.stringify(vr));
  const tr = lbv.top.find((x) => x[0] === pv); t(!tr || tr[5] === 2, 'the points board carries the Vault level for badges');
  t((lbv.vault || []).every((x) => x[2] >= 250), 'only Vault pilots on the Vault board');
}
console.log(`passed ${ok}, failed ${bad}`);
if (bad) process.exitCode = 1;
