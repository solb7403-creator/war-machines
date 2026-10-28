// Live PvP: one lobby that groups pilots into rooms, and one room per match (both Durable Objects).
// The room runs the game's own sim (js/game.js, bundled by build-sim.mjs) at 30 ticks a second, sends every
// player the world 15 times a second, and decides results and points itself. A pilot who drops gets an AI
// pilot until they're back; one who leaves (or stays away) loses and earns nothing.
import { createSim, RULES } from "./sim.gen.js";
import { dayOf, hex, hmac, cleanName } from "./db.js";
import { creditMatch, readEco, pickGhosts, ghostReport, ECO } from "./eco.js";

export const PVP = {
  WAIT_MS: 30000,      // a room looks for live pilots this long, then AI pilots fill the empty seats
  VS_MS: 5000,         // the VS screen before the fight
  ROUND_MS: 5500,      // between best-of-3 rounds
  TICK_MS: 1000 / 30,
  SNAP_EVERY: 2,       // a snapshot every 2 ticks: 15 a second
  DROP_MS: 20000,      // still offline this long when the match ends = left the match
  GONE_MS: 15000,      // every player offline this long: the match ends
  TOKEN_MS: 20 * 60000,
};
const W = 20, H = 32;
export const rules = () => RULES;   // the shared rules (js/rules.js), without a sim
const r2n = (v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v);
const rid = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
export const seatsFor = (g, m) => (g === "royale" ? 6 : rules().MODES[m].n * 2);

// ================= lobby =================
// Rooms open for pilots in the same queue (mode + team size) and league. The league band widens while a room
// waits: same league for 10 s, then one league either side, then two.
// Quick Match pilots ("quick.<size>") fit any live room of their team size, and a mode pilot fits a Quick Match room
// (which then becomes that mode), so everyone looking for a live match at one team size can meet.
export const queueFits = (rq, q) => {
  const [rg, rm] = rq.split("."), [g, m] = q.split(".");
  return rm === m && (rg === g || (rg === "quick" && g !== "royale") || (g === "quick" && rg !== "royale"));
};
export class LobbyCore {
  constructor(now = () => Date.now(), waitMs = PVP.WAIT_MS) { this.rooms = []; this.now = now; this.waitMs = waitMs; }
  assign({ q, league, pid, seats }) {
    const t = this.now();
    const openFor = this.waitMs > 5000 ? this.waitMs - 2500 : this.waitMs * 0.8;   // stop filling a room just before it starts
    this.rooms = this.rooms.filter((r) => !r.closed && t - r.t0 < openFor);
    const mine = this.rooms.find((r) => r.pids.includes(pid));
    if (mine) return { room: mine.id, n: mine.pids.length };   // already waiting somewhere (a double tap, or a retry): same room, same seat
    let best = null;
    for (const r of this.rooms) {
      if (!queueFits(r.q, q) || r.pids.length >= r.seats) continue;
      const age = t - r.t0, band = age < 10000 ? 0 : age < 20000 ? 1 : 2;
      if (Math.abs(r.league - league) > band) continue;
      if (!best || r.pids.length > best.pids.length || (r.pids.length === best.pids.length && r.t0 < best.t0)) best = r;
    }
    if (!best) { best = { id: rid(), q, league, seats, t0: t, pids: [] }; this.rooms.push(best); }
    if (best.q.startsWith("quick.") && !q.startsWith("quick.")) best.q = q;   // a Quick Match room takes the mode of the first pilot who picked one
    best.pids.push(pid);
    return { room: best.id, n: best.pids.length };
  }
  close(room) { const r = this.rooms.find((x) => x.id === room); if (r) r.closed = true; }
  left({ room, pid }) { const r = this.rooms.find((x) => x.id === room); if (r) r.pids = r.pids.filter((p) => p !== pid); }
  stats() {
    const t = this.now(), open = this.rooms.filter((r) => !r.closed && t - r.t0 < this.waitMs);
    return { open: open.length, waiting: open.reduce((a, r) => a + r.pids.length, 0), queues: [...new Set(open.map((r) => r.q))] };
  }
}

// ================= room =================
// io: {now, setTimeout, clearTimeout, setInterval, clearInterval, day(), credit(seat, calc) -> Promise, left(pid)}
// A socket is {send(text), close(code, reason)}.
export class RoomCore {
  constructor(io, opts) {
    this.io = io; this.o = { ...PVP, ...(opts || {}) }; this.R = rules();
    this.seats = []; this.phase = "new"; this.timers = new Set(); this.evq = []; this.pending = [];
    this.deaths = []; this.tick = 0; this.sim = null;
  }
  humans() { return this.seats.filter(Boolean); }
  later(ms, f) { const h = this.io.setTimeout(() => { this.timers.delete(h); f(); }, ms); this.timers.add(h); return h; }
  sendTo(s, o) { if (s && s.on && s.sock) try { s.sock.send(typeof o === "string" ? o : JSON.stringify(o)); } catch (e) {} }
  all(o) { const m = JSON.stringify(o); for (const s of this.humans()) this.sendTo(s, m); }
  info() { return { phase: this.phase, q: this.q, humans: this.humans().map((s) => ({ name: s.name, on: s.on, quit: s.quit, done: s.done })), tick: this.tick }; }

  // a seat for a pilot the lobby sent here (the worker has checked their login and loadout)
  seatPlayer({ pid, name, q, L, power, league }) {
    L = JSON.parse(JSON.stringify(L));
    // Never let a legacy client's owned-chassis list become a legal match swap list.
    L.chs = [{ ...L.c }];
    const now = this.io.now();
    if (this.phase === "new") {
      this.q = { g: q.g, m: q.m }; this.cap = seatsFor(q.g, q.m);
      const n = this.cap / 2;
      this.order = q.g === "royale" ? [0, 1, 2, 3, 4, 5] : [...Array(n).keys()].flatMap((i) => [i, n + i]);   // alternate teams, so live pilots face each other
      this.phase = "wait"; this.t0 = now;
      this.later(this.o.WAIT_MS, () => this.waitOver());
    }
    if (this.phase !== "wait") return { ok: false, err: "started" };
    if (!queueFits(this.q.g + "." + this.q.m, q.g + "." + q.m)) return { ok: false, err: "queue" };
    if (this.q.g === "quick" && q.g !== "quick") this.q.g = q.g;   // Quick Match room: the first pilot with a mode sets it
    const have = this.humans().find((s) => s.pid === pid);
    if (have) { Object.assign(have, { name }); return { ok: true, seat: have.idx, wait: this.t0 + this.o.WAIT_MS - now }; }
    const idx = this.order.find((i) => !this.seats[i]);
    if (idx === undefined) return { ok: false, err: "full" };
    this.seats[idx] = { rv: this.R.LAB_RULES_VERSION, pid, name, L, power, league, idx, sock: null, on: false, quit: false, offAt: null, done: false, flip: false, quick: q.g === "quick" };
    // offline pilots' tanks for the AI seats, looked up while the room waits (at the first pilot's power)
    if (!this.ghP && this.io.ghosts) this.ghP = Promise.resolve().then(() => this.io.ghosts(power, [pid])).then((g) => { this.gh = g || []; }).catch(() => { this.gh = []; });
    return { ok: true, seat: idx, wait: this.t0 + this.o.WAIT_MS - now };
  }
  connect(pid, sock) {
    const s = this.humans().find((x) => x.pid === pid);
    if (!s || (s.quit && this.phase !== "over")) { try { sock.send(JSON.stringify({ k: "x", m: "no seat" })); sock.close(4000, "no seat"); } catch (e) {} return false; }
    if (s.sock && s.sock !== sock) try { s.sock.close(4001, "replaced"); } catch (e) {}
    s.sock = sock; s.on = true; s.offAt = null;
    if (this.phase === "wait") { this.lobbyAll(); this.checkFull(); return true; }
    if (this.phase === "over") { if (s.res) this.sendTo(s, { k: "res", r: s.res }); this.sendTo(s, { k: "end" }); return true; }
    const u = this.sim.units[s.idx];
    if (!s.done && !s.quit && u.ctl === "bot" && this.phase !== "vs") { this.sim.setCtl(u, "net"); u.tp = (u.tp || 0) + 1; this.feed(s.idx, "back"); }
    if (!s.done && !s.quit && this.phase === "vs") this.sim.setCtl(u, "net");
    this.sendTo(s, this.goMsg(s));
    if (this.phase === "play" || this.phase === "round") this.sendTo(s, { k: "s", t: this.tick, s: this.sim.snap(), e: [] });
    if (this.phase === "round" && this.roundInfo) this.sendTo(s, this.roundMsg(s));
    if (s.res) this.sendTo(s, { k: "res", r: s.res });
    return true;
  }
  onClose(pid, sock) {
    const s = this.humans().find((x) => x.pid === pid);
    if (!s || s.sock !== sock) return;
    s.sock = null; s.on = false; s.offAt = this.io.now();
    if (this.phase === "wait") { this.seats[s.idx] = null; this.io.left(pid); this.lobbyAll(); return; }
    if (this.phase === "vs" || this.phase === "play" || this.phase === "round") {
      const u = this.sim.units[s.idx];
      if (!s.done && !s.quit && u.ctl !== "bot") { this.sim.setCtl(u, "bot"); this.feed(s.idx, "drop"); }
      this.checkGone();
    }
  }
  onMessage(pid, sock, raw) {
    const s = this.humans().find((x) => x.pid === pid);
    if (!s || s.sock !== sock || typeof raw !== "string" || raw.length > 400) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== "object") return;
    const u = this.sim && this.sim.units[s.idx], live = this.phase === "play" && u && u.ctl === "net" && !s.done;
    const fl = s.flip ? -1 : 1;
    switch (m.k) {
      case "m": if (live && u.hp > 0) this.sim.netClaim(u, s.flip ? W - m.x : m.x, s.flip ? H - m.y : m.y, m.tp | 0); break;   // where my tank is
      case "s": if (live) this.sim.useSuper(u, typeof m.a === "number" && Number.isFinite(m.a) ? m.a + (s.flip ? Math.PI : 0) : undefined); break;
      case "d": if (live) this.sim.netDash(u, fl * (+m.x || 0), fl * (+m.y || 0)); break;
      case "h": if (live) this.sim.netShield(u); break;
      case "t": if (live) this.sim.netTarget(u, m.v | 0); break;   // tap-to-target lock (unit id, -1 clears)
      // Legacy "c" messages are deliberately ignored: no arbitrary owned-inventory switches.
      // Full machine selection happens before joining from server-owned Laboratory state.
      case "q": this.quit(s); break;
      case "p": this.sendTo(s, { k: "P", i: m.i, t: this.tick }); break;
    }
  }
  feed(id, what) { if (this.sim && this.phase !== "wait") this.evq.push([this.tick, "J", id, what]); }   // a live pilot dropped, came back or left (each phone words it)

  // ---- waiting for pilots ----
  lobbyMsg(s) { return { k: "w", seat: s.idx, n: this.humans().filter((x) => x.on).length, cap: this.cap, left: Math.max(0, this.t0 + this.o.WAIT_MS - this.io.now()), q: this.q }; }
  lobbyAll() { for (const s of this.humans()) this.sendTo(s, this.lobbyMsg(s)); }
  checkFull() {
    if (this.phase !== "wait" || this.fullT) return;
    const hs = this.humans();
    if (hs.length === this.cap && hs.every((s) => s.on)) this.fullT = this.later(1200, () => { this.fullT = null; if (this.phase === "wait") this.startVs(); });
  }
  waitOver() {
    if (this.phase !== "wait") return;
    for (const s of this.humans()) if (!s.on) this.seats[s.idx] = null;   // never connected: an AI pilot takes the seat
    const on = this.humans();
    if (on.length >= 2) { this.startVs(); return; }
    // nobody else came: the phone plays this one against AI pilots itself
    this.phase = "over";
    for (const s of on) { this.sendTo(s, { k: "solo" }); this.later(400, () => { try { s.sock && s.sock.close(1000, "solo"); } catch (e) {} }); }
    this.later(1000, () => this.closeAll());
  }

  // ---- VS screen, fight, rounds ----
  host() {
    return {
      ev: (a) => this.evq.push([this.tick].concat(a.map(r2n))),
      end: (forced) => { this.endReq = forced || {}; },
      round: (w) => { this.roundReq = { w }; },
      death: (r) => { if (this.q.g === "royale" && r.pid) this.deaths.push(r); },
    };
  }
  startVs() {
    const R = this.R, now = this.io.now();
    this.phase = "vs";
    if (this.q.g === "quick") {   // only Quick Match pilots: a random live mode for this team size
      const gs = R.liveModes(this.io.day()).filter((g) => g !== "royale");
      this.q.g = gs[Math.floor(Math.random() * gs.length)];
    }
    this.series = this.q.g === "arena" && this.q.m === "1v1";
    this.sim = createSim(this.host());
    const maps = this.sim.R.MAP_REAL, map = this.o.MAP || maps[Math.floor(Math.random() * maps.length)];   // live matches pick the map (tests can fix it)
    const seats = Array.from({ length: this.cap }, (_, i) => (this.seats[i] ? { pid: this.seats[i].pid, name: this.seats[i].name, L: this.seats[i].L } : null));
    const empty = seats.filter((x) => !x).length, hp = this.humans().map((s) => s.pid);
    const ghosts = (this.gh || []).filter((x) => !hp.includes(x.id)).slice(0, Math.min(ECO.GHOST_MAX, Math.ceil(empty / 2)));
    this.sim.setup({ map, g: this.q.g, m: this.q.g === "royale" ? "1v1" : this.q.m, series: this.series, seats, ghosts });
    for (const s of this.humans()) { const u = this.sim.units[s.idx]; s.flip = this.q.g === "royale" ? u.y < 16 : u.team === 1; }
    this.vsAt = now + this.o.VS_MS;
    for (const s of this.humans()) this.sendTo(s, this.goMsg(s));
    this.later(this.o.VS_MS, () => this.startFight());
  }
  goMsg(s) {
    const u = this.sim.units[s.idx];
    return { k: "go", chs: [s.L.c.c], me: s.idx, team: u.team, flip: s.flip, map: this.sim.map, g: this.q.g, m: this.q.m, series: !!this.series, phase: this.phase,
      units: this.sim.roster(), vs: Math.max(0, (this.vsAt || 0) - this.io.now()), feat: this.q.g === this.R.featuredOn(this.io.day()), t: this.tick };
  }
  startFight() {
    if (this.phase !== "vs") return;
    for (const s of this.humans()) { const u = this.sim.units[s.idx]; if (s.quit) u.quit = true; if (!s.on || s.quit) this.sim.setCtl(u, "bot"); }
    this.sim.start();
    this.phase = "play"; this.tick = 0; this.acc = 0; this.lastT = this.io.now(); this.startedAt = this.io.now();
    this.all({ k: "f", units: this.sim.roster() });
    this.flush();
    this.iv = this.io.setInterval(() => this.tickFn(), this.o.TICK_MS);
    this.checkGone();
  }
  tickFn() {
    const now = this.io.now();
    this.acc = Math.min(250, this.acc + now - this.lastT); this.lastT = now;   // after a stall, catch up a quarter second at most
    while (this.acc >= this.o.TICK_MS && this.phase === "play") {
      this.acc -= this.o.TICK_MS; this.tick++;
      this.sim.step(1 / 30);
      this.afterStep();
      if (this.phase === "play" && this.tick % this.o.SNAP_EVERY === 0) this.flush();
    }
  }
  flush() { this.all({ k: "s", t: this.tick, s: this.sim.snap(), e: this.evq }); this.evq = []; }
  afterStep() {
    while (this.deaths.length) {   // Last Standing: a live pilot who goes down gets their place now
      const r = this.deaths.shift(), s = this.humans().find((x) => x.pid === r.pid);
      if (s && !s.done) this.finishSeat(s, { won: false, drawn: false, place: r.place || this.sim.placeOf(r), score: [0, 0] }, s.quit || this.away(s));
    }
    if (this.endReq) { const f = this.endReq; this.endReq = null; this.finishMatch(f); return; }
    if (this.roundReq) { const w = this.roundReq.w; this.roundReq = null; this.enterRound(w); }
  }
  roundMsg(s) {
    const t = this.sim.units[s.idx].team, se = this.sim.series, w = this.roundInfo.w;
    return { k: "r", w: t === 0 ? [se.w[0], se.w[1]] : [se.w[1], se.w[0]], round: se.round, res: w < 0 ? "draw" : w === t ? "won" : "lost", left: Math.max(0, this.roundAt - this.io.now()) };
  }
  enterRound(w) {
    this.phase = "round"; this.flush();
    this.roundInfo = { w }; this.roundAt = this.io.now() + this.o.ROUND_MS;
    for (const s of this.humans()) this.sendTo(s, this.roundMsg(s));
    this.later(this.o.ROUND_MS, () => {
      if (this.phase !== "round") return;
      this.sim.startRound();
      this.phase = "play"; this.acc = 0; this.lastT = this.io.now(); this.roundInfo = null;
      this.all({ k: "rs", units: this.sim.roster() });
      this.flush();
    });
  }
  away(s) { return !s.on && s.offAt !== null && this.io.now() - s.offAt > this.o.DROP_MS; }
  checkGone() {
    if (this.goneT || !(this.phase === "vs" || this.phase === "play" || this.phase === "round")) return;
    if (this.humans().some((s) => s.on)) return;
    this.goneT = this.later(this.o.GONE_MS, () => {
      this.goneT = null;
      if (this.humans().some((s) => s.on)) return;
      for (const s of this.humans()) s.quit = true;   // everyone left: nobody wins
      if (this.phase === "vs") { this.phase = "over"; this.closeAll(); return; }
      this.finishMatch(null);
    });
  }
  quit(s) {
    if (s.quit) return;
    s.quit = true;
    if (this.phase === "wait") { this.seats[s.idx] = null; this.io.left(s.pid); this.lobbyAll(); try { s.sock && s.sock.close(1000, "left"); } catch (e) {} return; }
    const u = this.sim && this.sim.units[s.idx];
    if (u) { u.quit = true; if (u.ctl !== "bot") this.sim.setCtl(u, "bot"); }
    if (this.phase === "vs") { s.done = true; this.feed(s.idx, "leftvs"); }   // before the fight: no penalty
    else if (!s.done && this.phase !== "over") { this.feed(s.idx, "left"); this.finishSeat(s, { won: false, drawn: false, place: 0, score: [0, 0] }, true); }
    const sock = s.sock;
    this.later(300, () => { try { sock && sock.close(1000, "left"); } catch (e) {} });
    this.checkGone();
  }

  // ---- results: the server's call, credited to the player's record before anyone sees them ----
  finishSeat(s, o, quit) {
    if (s.done) return;
    s.done = true;
    const R = this.R, g = this.q.g, m = this.q.m, u = this.sim.units[s.idx];
    const feat = g === R.featuredOn(this.io.day()), brk = R.powerBracket(R.powerOf(s.L)), M = R.MODES[m] || R.MODES["1v1"];
    const top3 = g === "royale" && !quit && o.place > 0 && o.place <= 3;
    const zx = R.teamX(g, m, !!this.series), fxm = feat ? R.FEATURED_X : 1;
    const won = !quit && o.won, drawn = !quit && o.drawn;
    const base = quit ? 0 : Math.round(g === "royale" ? R.ROYALE_PTS[o.place - 1] : (won ? M.win : drawn ? M.draw : M.loss) * zx);
    const st = u.st || {}, se = this.sim.series;
    const res = { live: true, quick: !!s.quick, won, drawn, quit, place: o.place, top3, score: o.score, g, m, base, modeX: zx, featured: feat, featX: fxm,
      league: { n: brk.n, key: brk.key, mult: brk.mult, c: brk.c, i: brk.i },
      stats: { dmg: Math.round(st.dmg || 0), kills: st.kills || 0, boxes: st.box || 0, sups: st.sup || 0, taken: Math.round(st.taken || 0), arm: Math.round(st.arm || 0), shd: Math.round(st.shd || 0), best: Math.round(st.best || 0), cry: st.cry || 0, stars: st.stars || 0, caps: st.caps || 0, low: Math.round((st.low ?? 1) * 1000) / 1000 },
      series: se ? { w: u.team === 0 ? [se.w[0], se.w[1]] : [se.w[1], se.w[0]] } : null, cls: u.cls };
    // the match as the server saw it: quests, pass XP and stats on the pilot's record come from this (eco.js creditMatch)
    const mt = quit ? { quit: true } : { won, drawn, top3, feat, quick: !!s.quick, g, m, map: this.sim.map, seriesW: res.series && res.series.w,
      secs: this.startedAt ? (this.io.now() - this.startedAt) / 1000 : 0,
      st: { dmg: res.stats.dmg, sup: res.stats.sups, box: res.stats.boxes, kills: res.stats.kills, caps: res.stats.caps, cry: res.stats.cry, stars: res.stats.stars, low: res.stats.low, taken: res.stats.taken, arm: res.stats.arm, shd: res.stats.shd, best: res.stats.best } };
    const opp = this.humans().filter((x) => x !== s && x.pid && this.sim.units[x.idx] && (g === "royale" || this.sim.units[x.idx].team !== u.team)).map((x) => x.pid);   // live opponents (win-trading check)
    const calc = (rec) => {
      const pvs = won ? (rec.pvs || 0) + 1 : quit || (!drawn && !top3) ? 0 : rec.pvs || 0;   // Last Standing: 2nd and 3rd keep the streak
      const sb = won ? R.streakPts(g, m, pvs) : 0;
      return { pts: quit ? 0 : Math.round(base * fxm * brk.mult) + sb, pvs, sb, won, drawn, m: mt, opp };
    };
    const p = Promise.resolve().then(() => this.io.credit(s, calc))
      .then((c) => Object.assign(res, { pts: c.pts, awarded: c.awarded, capped: c.capped, streak: c.pvs, streakBonus: c.sb }))
      .catch(() => Object.assign(res, { pts: 0, awarded: 0, capped: false, streak: 0, streakBonus: 0, err: true }))
      .then(() => { s.res = res; this.sendTo(s, { k: "res", r: res }); });
    this.pending.push(p);
    return p;
  }
  finishMatch(forced) {
    if (this.phase === "over") return;
    this.phase = "over";
    if (this.iv) { this.io.clearInterval(this.iv); this.iv = null; }
    this.flush();
    for (const s of this.humans()) if (!s.done) this.finishSeat(s, this.sim.outcome(this.sim.units[s.idx], forced), s.quit || !s.on && this.away(s));
    // the ghosts' owners get a report (no points)
    const gl = this.sim.units.filter((u) => u.gh && u.gid).map((u) => { const o = this.sim.outcome(u, forced); return [u.gid, { won: o.won, drawn: o.drawn, dmg: u.st ? u.st.dmg : 0, kills: u.st ? u.st.kills : 0 }]; });
    if (gl.length && this.io.ghostReport) this.pending.push(Promise.resolve().then(() => this.io.ghostReport(gl)).catch(() => {}));
    this.done = Promise.all(this.pending).then(() => { this.all({ k: "end" }); this.later(4000, () => this.closeAll()); });
  }
  closeAll() {
    if (this.iv) { this.io.clearInterval(this.iv); this.iv = null; }
    for (const h of this.timers) this.io.clearTimeout(h);
    this.timers.clear();
    for (const s of this.humans()) { try { s.sock && s.sock.close(1000, "over"); } catch (e) {} s.sock = null; s.on = false; }
    this.phase = "over"; this.closed = true;
  }
}

// ================= Cloudflare glue =================
const post = (o) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
const lobbyStub = (env) => env.LOBBY.get(env.LOBBY.idFromName("main"));
const roomStub = (env, id) => env.ROOM.get(env.ROOM.idFromName(id));
const optsOf = (env) => (env.PVP_WAIT_MS ? { WAIT_MS: Number(env.PVP_WAIT_MS) } : {});   // tests shorten the wait
// a WebSocket upgrade response; outside Cloudflare (local tests) Response can't carry status 101
const wsResponse = (client) => { try { return new Response(null, { status: 101, webSocket: client }); } catch (e) { return { status: 101, webSocket: client }; } };

export class PvpLobby {
  constructor(ctx, env) { this.core = new LobbyCore(() => Date.now(), optsOf(env).WAIT_MS || PVP.WAIT_MS); }
  async fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === "/assign") return Response.json(this.core.assign(await req.json()));
    if (p === "/close") { this.core.close((await req.json()).room); return Response.json({ ok: true }); }
    if (p === "/left") { this.core.left(await req.json()); return Response.json({ ok: true }); }
    if (p === "/stats") return Response.json(this.core.stats());
    return new Response("not found", { status: 404 });
  }
}
export class PvpRoom {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.core = null; this.id = null; }
  room() {
    if (!this.core) {
      const env = this.env;
      this.core = new RoomCore({
        now: () => Date.now(), day: () => dayOf(Date.now()),
        setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (h) => clearTimeout(h),
        setInterval: (f, ms) => setInterval(f, ms), clearInterval: (h) => clearInterval(h),
        credit: (s, calc) => creditMatch(env, s.pid, s.name, calc),
        ghosts: (pw, skip) => pickGhosts(env, null, pw, ECO.GHOST_MAX, Date.now(), skip),
        ghostReport: (list) => ghostReport(env, list),
        left: (pid) => lobbyStub(env).fetch("https://lobby/left", post({ room: this.id, pid })).catch(() => {}),
      }, optsOf(env));
    }
    return this.core;
  }
  async fetch(req) {
    const url = new URL(req.url), p = url.pathname;
    if (p === "/seat") { const b = await req.json(); this.id = this.id || b.room; return Response.json(this.room().seatPlayer(b)); }
    if (p === "/ws") {
      if ((req.headers.get("Upgrade") || "").toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
      const pid = url.searchParams.get("pid"), core = this.room();
      const [client, server] = Object.values(new WebSocketPair());
      server.accept();
      const sock = { send: (t) => server.send(t), close: (c, r) => server.close(c, r) };
      server.addEventListener("message", (e) => core.onMessage(pid, sock, typeof e.data === "string" ? e.data : ""));
      server.addEventListener("close", () => core.onClose(pid, sock));
      server.addEventListener("error", () => core.onClose(pid, sock));
      core.connect(pid, sock);
      return wsResponse(client);
    }
    if (p === "/info") return Response.json(this.core ? this.core.info() : { phase: "none" });
    return new Response("not found", { status: 404 });
  }
}

// ---- tokens: the WebSocket can't carry the Telegram login, so /api/pvp/join hands out a short-lived signed ticket ----
async function sign(env, s) { return hex(await hmac(env.BOT_TOKEN, "pvp|" + s)).slice(0, 32); }
async function makeToken(env, pid, room, now = Date.now()) { const exp = now + PVP.TOKEN_MS, s = `${pid}.${room}.${exp}`; return s + "." + (await sign(env, s)); }
async function readToken(env, tok, room, now = Date.now()) {
  const p = String(tok || "").split(".");
  if (p.length !== 4 || p[1] !== room || !(Number(p[2]) > now)) return null;
  return (await sign(env, p.slice(0, 3).join("."))) === p[3] ? p[0] : null;
}

// ---- the loadout a pilot brings: only gear they own on the server's record (eco/<pid>), with the server's rolls, upgrade
// and core levels. Anything else falls back to the best they own of that line (rules.js ecoLoadout). ----
export async function checkLoadout(env, R, raw, S) {
  const owned = S && typeof S === "object" ? R.ecoNorm(JSON.parse(JSON.stringify(S))) : R.ecoNorm({});
  return owned.lab ? R.labLoadout(owned) : R.ecoLoadout(owned, raw);
}

// ---- routes (called from index.js) ----
// POST /api/pvp/join {v, g, m, L}: verified login -> a seat in a room and a ticket for its WebSocket
export async function pvpJoin(env, a) {
  if (!env.ROOM || !env.LOBBY) return { status: 503, body: { error: "pvp off" } };
  const R = rules(), b = a.b, now = Date.now();
  if (Number(b.v) !== R.PVP_V) return { status: 409, body: { error: "update" } };
  const g = String(b.g || ""), m = String(b.m || "");
  if (g !== "quick" && !R.liveModes(dayOf(now)).includes(g) && !(env.PVP_ALL && R.GT_ORDER.includes(g))) return { status: 400, body: { error: "not live" } };   // quick: any live mode, picked when the room starts   // PVP_ALL: local tests of every mode
  if (g === "royale" ? m !== "solo" : !R.MODES[m]) return { status: 400, body: { error: "mode" } };
  const S = await readEco(env, a.pid);
  if (S.lab && (b.labRev === undefined || (R.FIT_ORDER.some(k => R.labLoadout(S).mods[k] !== "stock") && b.fv !== R.FIT_VERSION))) return { status: 409, body: {error:"update"} };
  if (S.lab && b.labRev !== S.lab.rev) return { status: 409, body: {error:"garage_changed"} };
  const L = await checkLoadout(env, R, b.L, S);
  const power = R.powerOf(L), league = R.powerBracket(power).i, name = cleanName(a.user), q = g + "." + m, lobby = lobbyStub(env);
  for (let i = 0; i < 3; i++) {
    const asg = await (await lobby.fetch("https://lobby/assign", post({ q, league, pid: a.pid, seats: seatsFor(g, m) }))).json();
    const r = await (await roomStub(env, asg.room).fetch("https://room/seat", post({ room: asg.room, pid: a.pid, name, q: { g, m }, L, power, league }))).json();
    if (r.ok) return { status: 200, body: { ok: true, room: asg.room, tok: await makeToken(env, a.pid, asg.room, now), seat: r.seat, wait: r.wait, power, league: R.LEAGUES[league] } };
    await lobby.fetch("https://lobby/close", post({ room: asg.room }));
  }
  return { status: 503, body: { error: "busy" } };
}
// GET /pvp/ws?r=<room>&t=<ticket> (WebSocket): straight into the room
export async function pvpSocket(req, env) {
  if (!env.ROOM) return new Response("pvp off", { status: 503 });
  if ((req.headers.get("Upgrade") || "").toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
  const url = new URL(req.url), room = url.searchParams.get("r") || "";
  const pid = /^[0-9a-f]{16}$/.test(room) ? await readToken(env, url.searchParams.get("t"), room) : null;
  if (!pid) return new Response("bad ticket", { status: 403 });
  const to = new URL("https://room/ws");
  to.searchParams.set("pid", pid);
  return roomStub(env, room).fetch(new Request(to.toString(), req));
}
// GET /pvp/health: is the lobby up, and how many pilots are waiting (no personal data)
export async function pvpHealth(env) {
  if (!env.LOBBY) return Response.json({ ok: false, error: "pvp off" }, { status: 503 });
  const st = await (await lobbyStub(env).fetch("https://lobby/stats")).json();
  return Response.json({ ok: true, v: rules().PVP_V, ...st });
}
