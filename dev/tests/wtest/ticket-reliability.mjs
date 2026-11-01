// Honest matches always count; cheats still don't. The REAL phone code (js/match.js: ticket loop, result queue) runs in a
// sandbox on a virtual clock and talks to the REAL Worker (worker/src/index.js + eco.js, fake Firebase) through a fake
// network that can be slow, drop requests, lose replies (the server did the work) or be gone for a while.
// Every honest case must end with the points credited exactly once. Run from the repo root.
import fs from 'node:fs';
import vm from 'node:vm';
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { fakeRec } from './fakerec.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db = makeDB();
const realNow = Date.now.bind(Date);
let vnow = realNow();
Date.now = () => vnow;   // the server reads Date.now(): virtual time for both sides
globalThis.fetch = async (url, init) => { if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init); throw new Error('unexpected fetch ' + url); };
const { default: worker } = await import('../../../worker/src/index.js');
const eco = await import('../../../worker/src/eco.js');
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' };
let ok = 0, bad = 0; const t = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
function initData(user) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(vnow / 1000)), query_id: 'q', user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const E = (pid) => db.get('/eco/' + pid);
const realTick = () => new Promise((r) => setImmediate(r));
let inflight = 0;   // server work still running (its reply not yet scheduled on the phone's clock)
async function drain() { for (let i = 0; i < 30 || inflight > 0; i++) await realTick(); }

// ---- the phone: js/rules.js + js/match.js in their own realm, with a virtual clock and a scriptable network ----
function makePhone(user, net) {
  let timers = [], tid = 0;
  const P = {};
  const ctx = vm.createContext({ console, Date, AbortController, JSON, Math, Promise, structuredClone, URLSearchParams });
  ctx.setTimeout = (fn, ms) => { timers.push({ t: vnow + Math.max(0, ms || 0), fn, id: ++tid }); return tid; };
  ctx.clearTimeout = (id) => { timers = timers.filter((x) => x.id !== id); };
  vm.runInContext(fs.readFileSync('js/rules.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('js/match.js', 'utf8'), ctx);
  let n = 0;
  ctx.apiFetch = (path, body, signal) => new Promise((resolve, reject) => {
    if (path === '/api/match/end') P.lastEnd = JSON.parse(JSON.stringify(body));
    const k = n++, plan = net(path, k, vnow, body) || {};
    let done = false;
    const fail = (e) => { if (!done) { done = true; reject(e); } };
    if (signal) signal.addEventListener('abort', () => fail(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    if (plan.fail !== undefined) { ctx.setTimeout(() => fail(new TypeError('Load failed')), plan.fail); return; }   // never reached the server
    ctx.setTimeout(async () => {   // the server gets it and does the work, whether or not the reply makes it back
      inflight++;
      const res = await worker.fetch(new Request('https://x' + path, { method: 'POST', headers: { Origin: 'https://solb7403-creator.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ initData: initData(user) }, body)) }), env);
      const txt = await res.text(); if (process.env.DBG) console.log('  net', path, k, res.status, txt.slice(0, 160));
      inflight--;
      if (plan.lose) return;   // the reply is lost on the way back
      ctx.setTimeout(() => { if (!done) { done = true; resolve(new Response(txt, { status: res.status, headers: { 'Content-Type': 'application/json' } })); } }, plan.back || 0);
    }, plan.go || 0);
  });
  vm.runInContext(`var SRV_ECO=true,IN_WEB=false,IN_TG=true,lastQuick=false,state='menu',curMap='longshot',lastResult=null,save={mq:[],mode:'3v3',gtype:'bounty',mp:5};
   function store(){} function applyEco(){} function populatePreparedMatch(){} function placeGhosts(){} function findOv(){return null} function uiDirty(){}
   function deviceId(){return '0123456789abcdef'} function deviceHash(){return 'abcd1234'} function myLoadout(){return JSON.parse(JSON.stringify(STOCK_L))}
   function api(p,b){return apiFetch(p,b).then(r=>r.json().then(j=>{if(!r.ok)throw new Error(j.error||('http '+r.status));return j;}));}`, ctx);
  Object.assign(P, {
    ctx, ev: (s) => vm.runInContext(s, ctx),
    async advance(ms) {   // run the phone's timers up to now+ms, letting the server finish its work between them
      const end = vnow + ms;
      for (;;) {
        await drain();
        timers.sort((a, b) => a.t - b.t || a.id - b.id);
        const x = timers[0];
        if (!x || x.t > end) break;
        timers.shift(); vnow = Math.max(vnow, x.t); x.fn();
      }
      vnow = end; await drain();
    },
  });
  return P;
}
// one AI match on the phone: VS screen (up to the ticket wait), the fight, the end. Returns what the results screen says
async function playMatch(P, o) {
  const { g = 'bounty', m = '3v3', dur = 121, won = true } = o;
  P.ev(`matchG=${JSON.stringify(g)};save.gtype=${JSON.stringify(g)};save.mode=${JSON.stringify(m)};state='vs';battleLoadout=myLoadout();matchStart();`);
  const t0 = vnow;
  await P.advance(4000);   // the VS screen (the fight starts on time, ticket or not)
  P.ev(`state='play'`);
  await P.advance(dur * 1000 - (vnow - t0 - 4000));
  const pf = fakeRec({ g, m, won, dur: dur - 1, dmg: 2400, steer: Math.floor(Math.random() * 1e6) + 1 });
  P.ev(`state='over';lastResult={tok:null,note:null,awarded:-1};matchEnd(${JSON.stringify({ won, drawn: false, place: 0, gh: [], pf, seriesW: null, stats: { dmg: 2400, kills: 4, stars: 16 } })});`);
}
const queued = (P) => P.ev('save.mq.length');
const note = (P) => P.ev('lastResult&&lastResult.note');
let uid = 7000;
async function scenario(name, net, o = {}) {
  const user = { id: ++uid, username: 'p' + uid }, pid = 'tg_' + uid;
  db.root.eco = db.root.eco || {}; db.root.eco[pid] = { ...R.ecoNorm({}), mig: 1, mp: 5 };
  const P = makePhone(user, net);
  const e0 = E(pid).earned || 0;
  await playMatch(P, o);
  await P.advance(o.after || 5 * 60000);   // time for the queue to drain
  const S = E(pid), gained = (S.earned || 0) - e0, scored = Object.values(S.md || {}).filter((r) => r && r.pts > 0);
  const firstNote = note(P);
  // whatever the phone does next (a resend after a lost reply, a restart), the points don't come twice
  const b = P.lastEnd;   // exactly what the phone sent last
  if (b) P.ev(`save.mq.push({tok:${JSON.stringify(b.tok || null)},cid:${JSON.stringify(b.cid)},lt:'x',r:${JSON.stringify(b.r)},endAt:Date.now()-${Math.round((b.r.ago || 0) * 1000)}});flushMatches();`);
  await P.advance(60000);
  if (process.env.DBG && queued(P)) console.log('  left in queue:', P.ev('JSON.stringify(save.mq.map(x=>({tok:x.tok,cid:x.cid,hold:x.hold,lt:x.lt})))'));
  t(gained > 0 && E(pid).earned - e0 === gained && queued(P) === 0, name + ': points credited exactly once (+' + gained + ', note ' + JSON.stringify(firstNote) + ', queue ' + queued(P) + ')');
  t(firstNote === null, name + ': results screen shows the server\'s points, no "Not counted" (' + JSON.stringify(firstNote) + ')');
  return { P, pid, gained };
}
const ok200 = () => ({});
// 1. the baseline: a good connection
await scenario('good connection', ok200);
// 2. slow server: replies take 5 s, 15 s, 40 s (the phone gives up on each ticket try after 8 s and asks again)
for (const s of [5, 15, 40]) await scenario('slow server ' + s + ' s', () => ({ back: s * 1000 }));
// 3. the first request never arrives; the rest are fine
await scenario('dropped first request', (p, k) => (k === 0 ? { fail: 3000 } : {}));
// 4. the first ticket request reaches the server (ticket issued) but its reply is lost: the retry gets the same ticket
{
  let starts = 0;
  const r = await scenario('aborted request that succeeded server-side', (p) => (p === '/api/match/start' && starts++ === 0 ? { lose: true } : {}));
  const S = E(r.pid); t(!S.mt && Object.keys(S.mto || {}).length === 0, 'the lost-reply ticket and its retry were one ticket (nothing left open) ' + JSON.stringify(Object.keys(S.mto || {})));
}
// 5. Telegram in the background on the VS screen: nothing goes out for 30 s (the ticket comes mid-match)
{ const T0 = vnow; await scenario('Telegram backgrounded during VS', (p, k, now) => (now - T0 < 30000 ? { fail: 200 } : {})); }
// 6. the server is slow for the first 50 s (a database hiccup): the ticket arrives mid-match
{ const T0 = vnow; await scenario('ticket arriving mid-match', (p, k, now) => (now - T0 < 50000 ? { back: 60000 } : {})); }
// 7. no connection for the whole match and 10 minutes after: the result waits on the phone and counts when back online
{ const T0 = vnow; await scenario('offline the whole match, then online', (p, k, now) => (now - T0 < 130000 + 600000 ? { fail: 100 } : {}), { after: 15 * 60000 }); }
// 8. a deploy between start and end: the ticket was written by the previous server (no match id on it)
{
  let first = true, pidSeen = null;
  const r = await scenario('a deploy between start and end', (p, k, now, body) => {
    if (p === '/api/match/end' && first) { first = false; const pid = 'tg_' + uid, S = E(pid); if (S.mt) delete S.mt.cid; pidSeen = pid; }
    return {};
  });
  t(!!pidSeen, 'deploy case exercised the old-format ticket');
}
// 9. the bug as reported: Bounty 3v3 on Longshot, first match of a session right after a release, nothing comes back for 6 s
{ const T0 = vnow; await scenario('reported case: Bounty 3v3 Longshot, no answer for 6 s at the start', (p, k, now) => (now - T0 < 6000 ? { fail: 900 } : {})); }

// ---- held, not lost: an older result arrives after a newer match; the hourly limit ----
{
  const user = { id: ++uid, username: 'q' }, pid = 'tg_' + uid;
  db.root.eco[pid] = { ...R.ecoNorm({}), mig: 1, mp: 5 };
  const now0 = vnow;
  const a = (await eco.matchStart(env, { g: 'arena', m: '2v2', map: 'classic', pv: 1, cid: 'aaaaaaaaaaaaaaaa' }, user, pid, now0)).body;
  const b = (await eco.matchStart(env, { g: 'arena', m: '2v2', map: 'classic', pv: 1, cid: 'bbbbbbbbbbbbbbbb' }, user, pid, now0 + 70000)).body;
  const rb = (await eco.matchEnd(env, { tok: b.tok, r: { won: true, ago: 0, pf: fakeRec({ g: 'arena', m: '2v2', won: true, dur: 60, dmg: 2000 }), stats: { dmg: 2000 } } }, user, pid, now0 + 135000)).body;
  const ra = (await eco.matchEnd(env, { tok: a.tok, r: { won: true, ago: 135 - 62, pf: fakeRec({ g: 'arena', m: '2v2', won: true, dur: 58, dmg: 2000 }), stats: { dmg: 2000 } } }, user, pid, now0 + 135000)).body;
  t(rb.ok && ra.ok && ra.res.pts > 0, 'a result held on the phone still counts after a newer match started ' + JSON.stringify(ra).slice(0, 90));
  // the hourly limit holds a result instead of throwing it away
  const h = Math.floor((now0 + 4e6) / 3600000) * 3600000 + 1000;
  E(pid).mh = { h: Math.floor(h / 3600000), n: eco.ECO.HOUR_CAP };
  const c = (await eco.matchStart(env, { g: 'arena', m: '1v1', map: 'classic', pv: 1, cid: 'cccccccccccccccc' }, user, pid, h)).body;
  const r1 = { won: false, ago: 0, pf: fakeRec({ g: 'arena', m: '1v1', won: false, dur: 40, dmg: 900 }), stats: { dmg: 900 } };
  const held = (await eco.matchEnd(env, { tok: c.tok, r: r1 }, user, pid, h + 45000)).body;
  t(!held.ok && held.hold && held.error === 'hourly' && held.retry > 0, 'over the hourly limit: held with a retry time, not refused ' + JSON.stringify(held).slice(0, 90));
  const later = (await eco.matchEnd(env, { tok: c.tok, r: { ...r1, ago: 3600 } }, user, pid, h + 45000 + 3600000)).body;
  t(later.ok && later.res.pts > 0, 'the held result counts next hour');
}

// ---- cheats still get nothing ----
{
  db.root.cfg = {};   // proof mode "flag" (the default): the strict checks below hold anyway
  eco.resetCfg();
  const user = { id: ++uid, username: 'cheat' }, pid = 'tg_' + uid;
  db.root.eco[pid] = { ...R.ecoNorm({}), mig: 1, mp: 5 };
  const mut = (pf, fn) => { const b = Buffer.from(pf.s, 'base64'); fn(b, pf.n * 3 + 6); return Object.assign({}, pf, { s: b.toString('base64') }); };
  const T = vnow + 1e7;
  const end = (b, at) => eco.matchEnd(env, b, user, pid, at).then((r) => r.body);
  // a forged record with no ticket: refused, whatever the proof mode
  let r = await end({ cid: '1111111111111111', r: { g: 'arena', m: '2v2', map: 'classic', won: true, ago: 5, pf: mut(fakeRec({ g: 'arena', m: '2v2', won: true, dur: 60, dmg: 2000 }), (b, sz) => { for (let s = 0; s < b.length / sz; s++) b[s * sz] = s % 2 ? 20 : 180; }), stats: { dmg: 2000 } } }, T);
  t(!r.ok && r.error === 'proof' && (E(pid).earned || 0) === 0, 'forged record without a ticket: refused ' + JSON.stringify(r).slice(0, 80));
  // impossible stats with no ticket: the record decides (damage held to what it shows)
  r = await end({ cid: '2222222222222222', r: { g: 'arena', m: '2v2', map: 'classic', won: true, ago: 5, pf: fakeRec({ g: 'arena', m: '2v2', won: true, dur: 60, dmg: 1500 }), stats: { dmg: 9e6, kills: 99 } } }, T + 100000);
  t(!r.ok && r.error === 'proof', 'impossible damage without a ticket: refused ' + JSON.stringify(r).slice(0, 80));
  // a genuine ticketless result, then the same one replayed and the same match id sent again
  const good = { g: 'arena', m: '2v2', map: 'classic', won: true, ago: 5, pf: fakeRec({ g: 'arena', m: '2v2', won: true, dur: 60, dmg: 2000 }), stats: { dmg: 2000 }, L: { w: { a: 'moon', t: 2, q: 1 }, c: { c: 'titan', t: 2, q: 1.1 }, up: { hull: 4, cannon: 4 }, skin: 'lunar' } };
  r = await end({ cid: '3333333333333333', r: good }, T + 200000);
  const e1 = E(pid).earned;
  t(r.ok && r.res.pts > 0 && r.res.mult === 1, 'a ticketless result counts; a claimed Moonbeam/Colossus it doesn\'t own buys nothing (Rookie x1) ' + JSON.stringify(r).slice(0, 100));
  const again = await end({ cid: '3333333333333333', r: good }, T + 260000);
  t(again.ok && again.dup && E(pid).earned === e1, 'the same result sent again: the same answer, no double credit');
  // the same record under a new match id: it overlaps the match already scored
  r = await end({ cid: '4444444444444444', r: { ...good, ago: 30 } }, T + 230000);
  t(!r.ok && r.error === 'overlap' && E(pid).earned === e1, 'a replayed fight under a new id (overlapping time): refused ' + JSON.stringify(r).slice(0, 80));
  // the ticket used twice
  const st = (await eco.matchStart(env, { g: 'arena', m: '2v2', map: 'classic', pv: 1, cid: '5555555555555555' }, user, pid, T + 300000)).body;
  const g2 = { won: true, ago: 0, pf: fakeRec({ g: 'arena', m: '2v2', won: true, dur: 60, dmg: 2000 }), stats: { dmg: 2000 } };
  const r1 = await end({ tok: st.tok, r: g2 }, T + 365000), e2 = E(pid).earned;
  const r2 = await end({ tok: st.tok, r: g2 }, T + 366000);
  t(r1.ok && r2.ok && r2.dup && E(pid).earned === e2, 'a ticket used twice: one credit');
  // a made-up ticket
  r = await end({ tok: 'abcdefabcdefabcd.' + '0'.repeat(24), r: g2 }, T + 400000);
  t(!r.ok && r.error === 'ticket', 'a made-up ticket: refused');
  // late results are limited per day
  E(pid).lt = { d: Math.floor((T + 5e5) / 86400000), n: eco.ECO.LATE_DAY };
  r = await end({ cid: '6666666666666666', r: { ...good, ago: 5 } }, T + 5e5);
  t(!r.ok && r.error === 'late', 'over the daily allowance of ticketless results: refused');
  // older than a day
  r = await end({ cid: '7777777777777777', r: { ...good, ago: 25 * 3600 } }, T + 6e5);
  t(!r.ok && r.error === 'expired', 'a result more than a day old: refused');
  // the daily point cap still applies to held and ticketless results
  delete E(pid).lt; E(pid).dailyPts = R.DAILY_CAP - 40; E(pid).dailyDay = Math.floor((T + 8e5) / 86400000);
  r = await end({ cid: '8888888888888888', r: { ...good, ago: 5 } }, T + 8e5);
  t(r.ok && r.res.awarded === 40, 'daily cap: only what\'s left of ' + R.DAILY_CAP + ' is credited (' + (r.res && r.res.awarded) + ')');
}
Date.now = realNow;
console.log('ticket reliability: passed ' + ok + ', failed ' + bad);
if (bad) process.exit(1);
