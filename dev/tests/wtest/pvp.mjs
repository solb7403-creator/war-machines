// Live PvP server tests: lobby, match rooms (seats, VS, fight, claims, supers, dashes, disconnects, reconnects,
// quits, rounds, Last Standing, results and points), loadout checks, and the worker routes end to end.
import { createHmac } from 'node:crypto';
import { buildSim } from '../../../worker/build-sim.mjs';
import { makeDB } from './fakedb.mjs';
import { makeNamespace, installWebSocketPair } from './fakedo.mjs';
buildSim();
installWebSocketPair();
const { RoomCore, LobbyCore, PVP, rules, checkLoadout, PvpRoom, PvpLobby, queueFits } = await import('../../../worker/src/pvp.js');
const R = rules();
let ok = 0, bad = 0;
const t = (c, m) => { if (c) ok++; else { bad++; console.log('FAIL', m); } };
const flush = () => new Promise((r) => setImmediate(r));

// ---- a room on a hand-cranked clock ----
function rig(opts) {
  let now = 1.8e12, seq = 0;
  const timers = [], recs = {};
  const io = {
    now: () => now, day: () => Math.floor(now / 864e5),
    setTimeout: (f, ms) => { const h = { id: ++seq, at: now + ms, f }; timers.push(h); return h; },
    clearTimeout: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
    setInterval: (f, ms) => { const h = { id: ++seq, at: now + ms, f, every: ms }; timers.push(h); return h; },
    clearInterval: (h) => io.clearTimeout(h),
    credits: [], lefts: [],
    credit: async (s, calc) => { const rec = recs[s.pid] || { pvs: 0 }; const c = calc(rec); recs[s.pid] = { ...rec, pvs: c.pvs }; io.credits.push({ pid: s.pid, ...c }); return { pts: c.pts, awarded: c.pts, capped: false, pvs: c.pvs, sb: c.sb }; },
    left: (pid) => io.lefts.push(pid),
  };
  const room = new RoomCore(io, opts);
  const run = async (ms) => {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const h = timers[0];
      if (!h || h.at > end) break;
      now = h.at;
      if (h.every) h.at += h.every; else timers.shift();
      h.f();
      if (!h.every || h.id % 30 === 0) await flush();
    }
    now = end; await flush(); await flush();
  };
  return { io, room, run, recs, get now() { return now; } };
}
const sock = (name) => { const s = { name, msgs: [], closed: null, send(x) { s.msgs.push(JSON.parse(x)); }, close(c, r) { s.closed = [c, r]; } }; return s; };
const last = (s, k) => [...s.msgs].reverse().find((m) => m.k === k);
const L0 = () => JSON.parse(JSON.stringify(R.STOCK_L));
const seat = (room, pid, q = { g: 'arena', m: '1v1' }, L = L0()) => room.seatPlayer({ pid, name: pid.toUpperCase(), q, L, power: R.powerOf(L), league: 0 });
const say = (room, pid, s, o) => room.onMessage(pid, s, JSON.stringify(o));

// ================= lobby =================
{
  let now = 0;
  const lb = new LobbyCore(() => now, 30000);
  const a = lb.assign({ q: 'arena.1v1', league: 0, pid: 'A', seats: 2 }), b = lb.assign({ q: 'arena.1v1', league: 0, pid: 'B', seats: 2 });
  t(a.room === b.room && b.n === 2, 'lobby: same queue + league share a room');
  const c = lb.assign({ q: 'arena.1v1', league: 0, pid: 'C', seats: 2 });
  t(c.room !== a.room, 'lobby: full room not reused');
  const z = lb.assign({ q: 'zone.1v1', league: 0, pid: 'Z', seats: 2 });
  t(z.room !== c.room, 'lobby: queues stay apart');
  const d = lb.assign({ q: 'arena.2v2', league: 3, pid: 'D', seats: 4 }), e = lb.assign({ q: 'arena.2v2', league: 1, pid: 'E', seats: 4 });
  t(d.room !== e.room, 'lobby: leagues apart at first');
  now = 21000;
  const f = lb.assign({ q: 'arena.2v2', league: 1, pid: 'F', seats: 4 });
  t(f.room === d.room || f.room === e.room, 'lobby: band widens after 20s');
  const g2 = lb.assign({ q: 'arena.2v2', league: 3, pid: 'D', seats: 4 });
  t(g2.room === d.room && lb.rooms.find((r) => r.id === d.room).pids.filter((p) => p === 'D').length === 1, 'lobby: a pilot already waiting keeps their room (no spam rooms)');
  lb.left({ room: c.room, pid: 'C' });
  t(lb.assign({ q: 'arena.1v1', league: 0, pid: 'G', seats: 2 }).room === c.room, 'lobby: a seat frees when a pilot leaves');
  now = 40000;
  t(lb.assign({ q: 'arena.1v1', league: 0, pid: 'H', seats: 2 }).room !== c.room, 'lobby: rooms past their wait close');
  t(lb.stats().open >= 1, 'lobby stats');
}

// ================= Quick Match: one pool per team size =================
{
  t(queueFits('quick.1v1', 'arena.1v1') && queueFits('zone.2v2', 'quick.2v2') && queueFits('quick.3v3', 'quick.3v3'), 'quick fits live modes of its size');
  t(!queueFits('quick.1v1', 'arena.2v2') && !queueFits('quick.1v1', 'royale.solo') && !queueFits('royale.solo', 'quick.solo') && !queueFits('arena.1v1', 'zone.1v1'), 'quick never crosses sizes, Last Standing or two set modes');
  let now = 0;
  const lb = new LobbyCore(() => now, 30000);
  const a = lb.assign({ q: 'quick.1v1', league: 0, pid: 'QA', seats: 2 }), b = lb.assign({ q: 'zone.1v1', league: 0, pid: 'QB', seats: 2 });
  t(a.room === b.room && lb.rooms.find((r) => r.id === a.room).q === 'zone.1v1', 'quick room takes the mode of a mode pilot');
  const c = lb.assign({ q: 'arena.2v2', league: 0, pid: 'QC', seats: 4 }), d = lb.assign({ q: 'quick.2v2', league: 0, pid: 'QD', seats: 4 });
  t(c.room === d.room && lb.rooms.find((r) => r.id === c.room).q === 'arena.2v2', 'quick pilot joins a waiting mode room');
  // rooms: quick + mode pilot = that mode; two quick pilots = a random live mode (never Last Standing)
  const r1 = rig(); seat(r1.room, 'qa', { g: 'quick', m: '1v1' }); seat(r1.room, 'qb', { g: 'zone', m: '1v1' });
  t(r1.room.q.g === 'zone' && !seat(r1.room, 'qc', { g: 'arena', m: '1v1' }).ok, 'room adopts the mode; other modes refused');
  const r2 = rig(), S2 = {};
  for (const p of ['qa', 'qb']) { seat(r2.room, p, { g: 'quick', m: '2v2' }); S2[p] = sock(p); r2.room.connect(p, S2[p]); }
  await r2.run(PVP.WAIT_MS + 50);
  const gq = last(S2.qa, 'go');
  t(gq && R.liveModes(Math.floor(r2.now / 864e5)).includes(gq.g) && gq.g !== 'royale' && gq.m === '2v2', 'two quick pilots: random live mode ' + (gq && gq.g));
  await r2.run(PVP.VS_MS + 100); say(r2.room, 'qa', S2.qa, { k: 'q' });
  await r2.run(100);
  const rq = last(S2.qa, 'res');
  t(rq && rq.r.quick === true && rq.r.g === gq.g, 'result marks Quick Match');
}

// ================= 1v1 arena: the full life of a match =================
{
  const { room, run, io } = rig({ MAP: 'classic' });
  const A = sock('A'), B = sock('B');
  t(seat(room, 'a').ok && seat(room, 'b').seat === 1, 'seats: second pilot sits on the other team');
  t(!seat(room, 'c').ok, 'seats: room full');
  t(!room.seatPlayer({ pid: 'd', name: 'D', q: { g: 'zone', m: '1v1' }, L: L0(), power: 70, league: 0 }).ok, 'seats: wrong queue refused');
  room.connect('a', A);
  t(last(A, 'w') && last(A, 'w').n === 1 && last(A, 'w').cap === 2, 'waiting: lobby status');
  room.connect('b', B);
  await run(1300);
  const gA = last(A, 'go'), gB = last(B, 'go');
  t(gA && gB && room.phase === 'vs', 'both full: VS starts early');
  t(gA.flip === false && gB.flip === true && gA.team === 0 && gB.team === 1, 'team 1 sees the map turned');
  t(gA.units.length === 2 && gA.units.every((u) => !u.ai), 'roster: two live pilots');
  t(gA.series === true, '1v1 arena is best of 3');
  // chassis swap on the VS screen
  const Lb = L0(); Lb.chs = [{ c: 'vanguard', t: 0, q: 1, s: false }, { c: 'titan', t: 0, q: 1, s: false }];
  room.seats[1].L = Lb;
  say(room, 'b', B, { k: 'c', c: 'titan' });
  t(room.sim.units[1].cls === 'titan' && last(A, 'u'), 'VS chassis swap reaches everyone');
  say(room, 'b', B, { k: 'c', c: 'scout' });
  t(room.sim.units[1].cls === 'titan', 'chassis you do not own refused');
  await run(PVP.VS_MS);
  t(room.phase === 'play' && last(A, 'f') && last(B, 's'), 'fight starts with snapshots');
  const n0 = A.msgs.filter((m) => m.k === 's').length;
  await run(1000);
  const n1 = A.msgs.filter((m) => m.k === 's').length;
  t(n1 - n0 >= 13 && n1 - n0 <= 17, 'about 15 snapshots a second: ' + (n1 - n0));
  const s1 = last(A, 's');
  t(Array.isArray(s1.s.u) && s1.s.u.length === 2 && s1.s.u[0].length === 16 && typeof s1.s.tl === 'number', 'snapshot layout');
  // claims: B is at (10,4); in B's view that's (10,28). B drives "up" its screen to (10,26) = canonical (10,6)
  const ub = room.sim.units[1], ua = room.sim.units[0];
  for (let i = 0; i < 6; i++) { say(room, 'b', B, { k: 'm', x: 10, y: 28 - (i + 1) * 0.35, tp: 0 }); await run(100); }
  t(Math.abs(ub.y - (4 + 6 * 0.35)) < 0.15 && Math.abs(ub.x - 10) < 0.05, 'claims move the tank (turned frame) ' + ub.x.toFixed(2) + ',' + ub.y.toFixed(2));
  // speed limit: a claim 4 units to the side (open ground on every map) is followed at top speed plus the small bank, never faster
  await run(1000);
  const x0 = ub.x, yk = ub.y, v = 4.4 * ub.spdM * 1.02;
  say(room, 'b', B, { k: 'm', x: 20 - (x0 + 4), y: 32 - yk, tp: 0 });
  await run(200);
  const moved = ub.x - x0, cap = v * (0.2 + PVP_BANK());
  t(moved > v * 0.2 && moved <= cap + 0.05, 'speed limited: moved ' + moved.toFixed(2) + ' max ' + cap.toFixed(2));
  await run(1500);
  t(Math.abs(ub.x - (x0 + 4)) < 0.05 && !ub.tp, 'claim reached at real speed, no resync ' + ub.x.toFixed(2) + ' tp ' + ub.tp);
  // a claim far beyond what the tank could drive: not followed, the phone is told to resync
  const x1 = ub.x;
  say(room, 'b', B, { k: 'm', x: 20 - (x1 - 9), y: 32 - yk, tp: 0 });
  await run(300);
  t(ub.tp === 1 && Math.abs(ub.x - x1) < 0.01, 'impossible claim: resync, not a teleport (' + (ub.x - x1).toFixed(2) + ')');
  // a claim behind cover (the command module on Moonbase): the tank stops at the wall, then the phone is resynced
  ub.x = 10; ub.y = 13; ub.claim = null; ub.mb = 0;
  const tpw = ub.tp;
  say(room, 'b', B, { k: 'm', x: 10, y: 32 - 18.5, tp: tpw });
  await run(200);
  t(ub.y <= 13.85 && ub.tp === tpw, 'blocked by the wall, no resync yet (' + ub.y.toFixed(2) + ')');
  await run(400);
  t(ub.tp === tpw + 1, 'still blocked: phone told to resync');
  // stale claims (old teleport count) are ignored
  const tp = ub.tp || 0, yy = ub.y;
  say(room, 'b', B, { k: 'm', x: 10, y: 20, tp: tp + 5 });
  await run(300);
  t(Math.abs(ub.y - yy) < 0.01, 'claims from before a resync are ignored');
  // walls: claim through the command module (classic map) is blocked by the same collision code
  // super with an aim: B aims "up" its screen = canonical down (+pi/2)
  ub.sp = 1000; say(room, 'b', B, { k: 's', a: -Math.PI / 2 });
  t(ub.sup && Math.abs(ub.sup.ang - Math.PI / 2) < 0.01, 'aimed super turned into the server frame');
  ua.sp = 1000; say(room, 'a', A, { k: 's', a: -Math.PI / 2 });
  t(ua.sup && Math.abs(ua.sup.ang + Math.PI / 2) < 0.01, 'aimed super (no turn for team 0)');
  say(room, 'a', A, { k: 's' });
  t(ua.sup.fixed === true, 'second super ignored while charging');
  await run(1500);
  say(room, 'b', B, { k: 'd', x: 0, y: -1 });
  t(ub.dash && ub.dash.dy > 0.9 && ub.dashCd > 3.5, 'dash turned into the server frame');
  say(room, 'b', B, { k: 'd', x: 1, y: 0 });
  t(ub.dashCd > 3.5 && ub.dash && ub.dash.dy > 0.9, 'dash cooldown holds');
  const evs = A.msgs.filter((m) => m.k === 's').flatMap((m) => m.e);
  t(evs.some((e) => e[1] === 'u') && evs.every((e) => typeof e[0] === 'number'), 'events carry ticks: ' + JSON.stringify([...new Set(evs.map((e) => e[1]))]));
  // ping
  say(room, 'a', A, { k: 'p', i: 7 });
  t(last(A, 'P') && last(A, 'P').i === 7, 'ping answered');
  // junk is ignored
  room.onMessage('a', A, '{bad json'); room.onMessage('a', A, 'x'.repeat(500)); say(room, 'a', A, { k: 'zzz' });
  t(room.phase === 'play', 'junk messages ignored');
  // B drops: an AI pilot drives until B is back
  room.onClose('b', B);
  t(ub.ctl === 'bot' && !ub.hum, 'disconnect: AI takes the tank');
  await run(200);
  t(A.msgs.filter((m) => m.k === 's').flatMap((m) => m.e).some((e) => e[1] === 'J' && e[2] === 1 && e[3] === 'drop'), 'disconnect shows in the feed');
  const B2 = sock('B2'), tpb = ub.tp || 0;
  room.connect('b', B2);
  t(ub.ctl === 'net' && ub.hum && ub.tp === tpb + 1, 'reconnect: control back, position resync');
  t(last(B2, 'go') && last(B2, 's') && last(B2, 'go').flip === true, 'reconnect: full picture right away');
  room.onMessage('b', B, JSON.stringify({ k: 'q' }));
  t(!room.seats[1].quit, 'an old socket cannot act for the pilot');
  // A quits: loss, no points; AI keeps A's tank going
  say(room, 'a', A, { k: 'q' });
  await run(50);
  const rA = last(A, 'res');
  t(rA && rA.r.quit === true && rA.r.pts === 0 && rA.r.won === false && rA.r.live === true, 'quit: loss and zero points ' + JSON.stringify(rA && rA.r));
  t(ua.ctl === 'bot' && ua.quit === true, 'quit: AI takes the tank for good');
  t(io.credits.some((c) => c.pid === 'a' && c.pts === 0 && c.pvs === 0), 'quit credited as a loss (streak reset)');
  const A2 = sock('A2');
  t(room.connect('a', A2) === false && A2.closed, 'quitter cannot rejoin');
  // let the series play out: B's tank sits still while A's AI hunts it
  let rounds = 0;
  for (let i = 0; i < 240 && room.phase !== 'over'; i++) { await run(1000); if (room.phase === 'round') rounds++; }
  t(room.phase === 'over', 'series finished');
  t(B2.msgs.some((m) => m.k === 'r') && B2.msgs.some((m) => m.k === 'rs'), 'round messages between rounds');
  const rb = last(B2, 'r');
  t(rb && Array.isArray(rb.w) && ['won', 'lost', 'draw'].includes(rb.res), 'round info from your side');
  await run(100);
  const rB = last(B2, 'res');
  t(rB && rB.r.series && rB.r.quit === false && rB.r.g === 'arena', 'B gets the match result ' + JSON.stringify(rB && rB.r));
  const exp = rB.r.won ? Math.round(R.MODES['1v1'].win * R.SERIES_X * (rB.r.featured ? R.FEATURED_X : 1)) + 20 : rB.r.drawn ? Math.round(R.MODES['1v1'].draw * R.SERIES_X * (rB.r.featured ? R.FEATURED_X : 1)) : Math.round(R.MODES['1v1'].loss * R.SERIES_X * (rB.r.featured ? R.FEATURED_X : 1));
  t(rB.r.pts === exp, 'server points: ' + rB.r.pts + ' expected ' + exp);
  t(rB.r.series.w[0] === (rB.r.won ? 2 : rB.r.series.w[0]), 'series score from your side');
  t(typeof rB.r.stats.low === 'number' && rB.r.stats.low >= 0 && rB.r.stats.low <= 1 && (rB.r.stats.taken > 0 ? rB.r.stats.low < 1 : true), 'lowest health in the stats (quests) ' + JSON.stringify(rB.r.stats));
  await run(100);
  t(B2.msgs.some((m) => m.k === 'end'), 'end message after results');
  await run(5000);
  t(room.closed && B2.closed, 'room closes its sockets');
}
function PVP_BANK() { return 0.6; }

// ================= nobody else comes: the phone plays it vs AI =================
{
  const { room, run, io } = rig();
  const A = sock('A');
  seat(room, 'a', { g: 'zone', m: '2v2' }); room.connect('a', A);
  seat(room, 'b', { g: 'zone', m: '2v2' });   // seated but never connects
  await run(PVP.WAIT_MS + 50);
  t(last(A, 'solo') && room.phase === 'over', 'one live pilot at the deadline: solo (AI on the phone)');
  await run(1500);
  t(room.closed, 'solo room closes');
  // leaving while waiting frees the seat
  const r2 = rig(), A3 = sock('A3');
  seat(r2.room, 'a', { g: 'arena', m: '3v3' }); r2.room.connect('a', A3);
  r2.room.onClose('a', A3);
  t(!r2.room.seats[0] && r2.io.lefts.includes('a'), 'leaving the queue frees the seat and tells the lobby');
}

// ================= 3v3 with AI fill, and everybody leaving =================
{
  const { room, run, io } = rig();
  const S = {};
  for (const p of ['a', 'b', 'c']) { seat(room, p, { g: 'arena', m: '3v3' }); S[p] = sock(p); room.connect(p, S[p]); }
  await run(PVP.WAIT_MS + 50);
  t(room.phase === 'vs', '3 of 6 at the deadline: start with AI fill');
  const g = last(S.a, 'go');
  t(g.units.filter((u) => u.ai).length === 3 && g.units.filter((u) => !u.ai).length === 3, 'roster: 3 live, 3 AI');
  t(room.sim.units[0].team === 0 && room.sim.units[3].team === 1 && room.sim.units[1].team === 0, 'live pilots spread over both teams');
  t(g.series === false, 'team arena is one round');
  await run(PVP.VS_MS + 100);
  t(room.phase === 'play', '3v3 fighting');
  for (const p of ['a', 'b', 'c']) room.onClose(p, S[p]);
  await run(PVP.GONE_MS + 500);
  t(room.phase === 'over', 'everyone offline: match ends');
  await run(100);
  t(io.credits.length === 3 && io.credits.every((c) => c.pts === 0), 'everyone who left gets a loss, no points');
}

// ================= ghosts: offline pilots' tanks take AI seats in live rooms; owners get a report, no points =================
{
  const { room, run, io } = rig();
  const Lg = L0(); Lg.up.hull = 3; Lg.paint = 'ember';
  io.ghostAsks = 0; io.reports = [];
  io.ghosts = async (pw, skip) => { io.ghostAsks++; return [{ id: 'tg_9001', n: 'Sleepy', L: Lg }, { id: 'tg_9002', n: 'Dozer', L: Lg }, { id: 'a', n: 'A', L: Lg }]; };
  io.ghostReport = async (list) => { io.reports.push(...list); };
  const S = {};
  for (const p of ['a', 'b']) { seat(room, p, { g: 'arena', m: '2v2' }); S[p] = sock(p); room.connect(p, S[p]); }
  await flush(); await flush();   // the ghost lookup lands while the room waits
  await run(PVP.WAIT_MS + 50);
  const g = last(S.a, 'go');
  const gh = g.units.filter((u) => u.gh);
  t(io.ghostAsks === 1 && gh.length === 1 && gh[0].ai && /^Ghost of (Sleepy|Dozer)$/.test(gh[0].name), 'live room: 1 of 2 AI seats goes to an offline pilot, labeled ' + JSON.stringify(g.units.map((u) => u.name)));
  const gu = room.sim.units.find((u) => u.gh);
  t(gu && gu.team === 1 && gu.mhp === R.tankOf(Lg, 2).mhp && gu.paint === 'ember', 'the ghost fights with its owner\'s build and gear (enemy seat first)');
  t(!g.units.some((u) => u.gid) && !JSON.stringify(g).includes('tg_900'), 'owner ids never reach the phones');
  await run(PVP.VS_MS + 100);
  for (const u of room.sim.units) if (u.team === 1) room.sim.hit(u, 1e6, room.sim.units[0]);
  await run(800);
  t(room.phase === 'over' && io.reports.length === 1 && io.reports[0][0] === gu.gid && io.reports[0][1].won === false, 'ghost owner gets a report ' + JSON.stringify(io.reports));
  const ca = io.credits.find((c) => c.pid === 'a');
  t(ca && ca.won && ca.pts === Math.round(R.winBase('arena', '2v2')) + R.streakPts('arena', '2v2', 1), 'beating a ghost pays exactly the AI rate ' + JSON.stringify(ca));
  t(io.credits.every((c) => !/^tg_900/.test(c.pid)), 'ghost owners are never credited');
}

// ================= Last Standing: a live pilot who goes down gets their place at once =================
{
  const { room, run, io } = rig();
  const S = {};
  for (const p of ['a', 'b', 'c']) { seat(room, p, { g: 'royale', m: 'solo' }); S[p] = sock(p); room.connect(p, S[p]); }
  await run(PVP.WAIT_MS + PVP.VS_MS + 200);
  t(room.phase === 'play' && room.sim.units.length === 6, 'Last Standing: 6 tanks');
  const ua = room.sim.units[0];
  room.sim.hit(ua, 1e6, room.sim.units[3]);   // knock A out
  await run(500);
  const ra = last(S.a, 'res');
  t(ra && ra.r.place >= 2 && ra.r.place <= 6 && room.phase === 'play', 'downed live pilot gets a place, match goes on: ' + JSON.stringify(ra && ra.r.place));
  if (ra) t(ra.r.pts === Math.round(R.ROYALE_PTS[ra.r.place - 1] * (ra.r.featured ? R.FEATURED_X : 1)) + 0, 'Last Standing points by place');
}

// ================= loadouts: only what the pilot owns on the server's record =================
{
  const good = L0(); good.up.hull = 2; good.w = { a: 'twin', t: 1, q: 1.07, s: false };
  const own = { up: { hull: 2 }, wOwn: { pulse: [0], twin: [1] }, roll: { 'twin:1': 1.07 } };
  let L = await checkLoadout(null, R, good, own);
  t(L.up.hull === 2 && L.w.a === 'twin' && L.w.q === 1.07, 'owned loadout kept');
  L = await checkLoadout(null, R, { ...good, w: { a: 'twin', t: 1, q: 1.1 }, up: { hull: 4, cannon: 4, engine: 4, target: 4, reactor: 4 }, gl: { dmg: 5 } }, own);
  t(L.w.q === 1.07 && L.up.hull === 2 && L.up.cannon === 0 && L.gl.dmg === 1, 'roll, upgrades and core levels come from the record, not the phone ' + JSON.stringify(L.up));
  L = await checkLoadout(null, R, { w: { a: 'siege', t: 2, q: 5, s: false }, c: { c: 'mech', t: 2, q: 9, s: true }, cores: ['dmg', 'dmg', 'xx'], gl: { dmg: 99 }, paint: 'gold', skin: 'lunar' }, own);
  t(L.w.a === 'pulse' && L.w.t === 0 && L.c.c === 'vanguard' && L.c.t === 0 && L.cores[1] === null && L.cores[2] === null && L.paint === 'stock' && L.skin === 'default', 'unowned gear, paint and skin fall back ' + JSON.stringify(L));
  L = await checkLoadout(null, R, { ...good, w: { a: 'moon', t: 2, q: 1, s: false } }, own);
  t(L.w.a === 'pulse' && L.w.t === 0, 'Moonbeam without owning it falls back to starter gear');
  L = await checkLoadout(null, R, { ...good, w: { a: 'moon', t: 0, q: 1, s: false }, skin: 'lunar' }, { ...own, moonbeam: true, skin: 'lunar' });
  t(L.w.a === 'moon' && L.w.t === 2 && L.skin === 'lunar', 'owned Moonbeam and skin allowed');
  L = await checkLoadout(null, R, { ...good, chs: [{ c: 'titan', t: 1, q: 1.06, s: false }, { c: 'titan', t: 2, q: 1.1 }, { c: 'zz' }] }, { ...own, cOwn: { vanguard: [0], titan: [1] }, roll: { 'titan:1': 1.06 } });
  t(L.chs.length === 2 && L.chs[0].c === 'vanguard' && L.chs[1].c === 'titan' && L.chs[1].t === 1, 'owned chassis list from the record');
  L = await checkLoadout(null, R, { ...good, c: { c: 'titan', t: 2, q: 1.1, s: true } }, { salv: { 'titan:2': 1.04 } });
  t(L.c.c === 'titan' && L.c.s && L.c.q === 1.04, 'salvaged gear with its recorded value');
}

// ================= the worker end to end: join, ticket, WebSocket, match, credit =================
{
  const db = makeDB();
  globalThis.fetch = async (url, init) => { if (String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init); return new Response('{}', { status: 404 }); };
  const worker = (await import('../../../worker/src/index.js')).default;
  const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET', PVP_WAIT_MS: '1500' };
  env.ROOM = makeNamespace(PvpRoom, env); env.LOBBY = makeNamespace(PvpLobby, env);
  const initData = (user) => {
    const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'q', user: JSON.stringify(user) });
    const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(env.BOT_TOKEN).digest();
    p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
    return p.toString();
  };
  const call = async (path, body) => { const r = await worker.fetch(new Request('https://x' + path, { method: 'POST', headers: { Origin: 'https://solb7403-creator.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), env); return [r.status, await r.json()]; };
  const U1 = { id: 501, username: 'livea' }, U2 = { id: 502, username: 'liveb' };
  db.root.players = { tg_501: { pts: 900, dailyPts: 100, weeklyPts: 100, d: Math.floor(Date.now() / 864e5), w: Math.floor((Date.now() - 4 * 864e5) / (7 * 864e5)), days: 1, ld: Math.floor(Date.now() / 864e5), sk: 1, name: 'livea' } };
  let [s, r] = await call('/api/pvp/join', { initData: 'bad', v: 1, g: 'arena', m: '1v1', L: L0() });
  t(s === 401, 'join needs a verified login');
  [s, r] = await call('/api/pvp/join', { initData: initData(U1), v: 99, g: 'arena', m: '1v1', L: L0() });
  t(s === 409 && r.error === 'update', 'old game version refused');
  [s, r] = await call('/api/pvp/join', { initData: initData(U1), v: 1, g: 'arena', m: '9v9', L: L0() });
  t(s === 400, 'unknown team size refused');
  const offMode = ['crystal', 'bounty', 'royale'].find((g) => !R.liveModes(Math.floor(Date.now() / 864e5)).includes(g));
  [s, r] = await call('/api/pvp/join', { initData: initData(U1), v: 1, g: offMode, m: offMode === 'royale' ? 'solo' : '1v1', L: L0() });
  t(s === 400 && r.error === 'not live', 'modes without a live queue today refused (' + offMode + ')');
  [s, r] = await call('/api/pvp/join', { initData: initData(U1), v: 1, g: 'arena', m: '1v1', L: L0() });
  const [s2, r2] = await call('/api/pvp/join', { initData: initData(U2), v: 1, g: 'arena', m: '1v1', L: L0() });
  t(s === 200 && s2 === 200 && r.room === r2.room && r.seat === 0 && r2.seat === 1 && r.tok && r.league === 'ROOKIE', 'two pilots matched into one room ' + JSON.stringify(r) + ' ' + s2 + JSON.stringify(r2));
  const ws = async (room, tok) => worker.fetch(new Request('https://x/pvp/ws?r=' + room + '&t=' + encodeURIComponent(tok), { headers: { Upgrade: 'websocket' } }), env);
  let bad = await ws(r.room, r.tok.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')));
  t(bad.status === 403, 'forged ticket refused');
  bad = await ws('0123456789abcdef', r.tok);
  t(bad.status === 403, 'ticket for another room refused');
  const noUp = await worker.fetch(new Request('https://x/pvp/ws?r=' + r.room + '&t=' + r.tok), env);
  t(noUp.status === 426, 'plain GET is not a WebSocket');
  const open = async (rr) => { const res = await ws(rr.room, rr.tok); const c = res.webSocket; c.accept(); const msgs = []; c.addEventListener('message', (e) => msgs.push(JSON.parse(e.data))); return { c, msgs, status: res.status }; };
  const c1 = await open(r), c2 = await open(r2);
  t(c1.status === 101 && c2.status === 101, 'WebSocket upgrade through the worker to the room');
  await new Promise((res) => setTimeout(res, 1600));
  t(c1.msgs.some((m) => m.k === 'go') && c2.msgs.some((m) => m.k === 'go' && m.flip), 'both get the VS roster');
  await new Promise((res) => setTimeout(res, PVP.VS_MS + 400));
  t(c1.msgs.some((m) => m.k === 'f') && c1.msgs.filter((m) => m.k === 's').length > 3, 'live snapshots over the socket');
  // finish fast: knock out B's tank three rounds running
  const core = [...env.ROOM.live.values()][0].core;
  for (let k = 0; k < 3 && core.phase !== 'over'; k++) {
    for (let i = 0; i < 40 && core.phase !== 'play'; i++) await new Promise((res) => setTimeout(res, 250));
    if (core.phase !== 'play') break;
    core.sim.units[1].hp = -1;
    await new Promise((res) => setTimeout(res, 400));
  }
  for (let i = 0; i < 40 && !c1.msgs.some((m) => m.k === 'end'); i++) await new Promise((res) => setTimeout(res, 250));
  const res1 = c1.msgs.find((m) => m.k === 'res'), res2 = c2.msgs.find((m) => m.k === 'res');
  t(res1 && res1.r.won && res2 && !res2.r.won, 'results decided by the server ' + JSON.stringify(res1 && res1.r).slice(0, 200));
  const p1 = db.get('/players/tg_501'), p2 = db.get('/players/tg_502');
  t(p1 && p1.pts === 900 + res1.r.awarded && p1.pvw === 1 && p1.pvm === 1 && p1.pvs === 1 && p1.dailyPts === 100 + res1.r.awarded, 'win credited on the server record ' + JSON.stringify(p1));
  t(p2 && p2.pts === res2.r.awarded && p2.pvl === 1 && p2.days === 1 && db.get('/meta/n') === 1, 'new pilot record created with the loss ' + JSON.stringify(p2));
  const day = Math.floor(Date.now() / 864e5);
  t(db.get('/dly/' + day + '/tg_501').s === p1.dailyPts, 'daily board updated');
  // daily cap
  const e1 = db.get('/eco/tg_501');
  t(e1 && e1.wins === 1 && e1.mp === 1 && e1.pass && e1.pass.xp >= 40 && e1.dq && Object.keys(e1.dq.p || {}).length >= 0, 'live result also counts for quests, pass XP and stats on the record ' + JSON.stringify({ w: e1 && e1.wins, xp: e1 && e1.pass && e1.pass.xp }));
  db.root.eco.tg_501.dailyPts = 19990;
  const { creditMatch } = await import('../../../worker/src/eco.js');
  const c = await creditMatch(env, 'tg_501', 'livea', () => ({ pts: 500, pvs: 2, won: true, drawn: false }));
  t(c.awarded === 10 && c.capped && db.get('/players/tg_501').dailyPts === 20000, 'live points respect the daily cap');
  const h = await worker.fetch(new Request('https://x/pvp/health'), env);
  t(h.status === 200 && (await h.json()).ok, 'health check');
}

console.log(`pvp: passed ${ok}, failed ${bad}`);
process.exit(bad ? 1 : 0);
