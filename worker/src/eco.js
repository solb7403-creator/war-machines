// The economy on the server. Every point and every piece of gear a pilot has lives in eco/<pid> and changes only here.
// The phone says what happened (a match ticket and its result, a claim, a crate to open); the server runs the shared
// rules (js/rules.js, bundled as RULES) on its own copy and sends its record back. Points are never taken from the phone.
// Writes are conditional (Firebase ETags): read, change, write only if nobody else wrote in between, else retry.
import { RULES as R, LIM } from "./sim.gen.js";
import { DAY_MS, dayOf, weekOf, hex, hmac, dbUrl, dbGet, dbPatch, cleanName } from "./db.js";
import { checkProof } from "./proof.js";

export const ECO = {
  TICKET_MS: 30 * 60000,   // a match ticket is good this long (the longest match is a 5-round best of 3)
  HOUR_CAP: 40,            // scored matches per UTC hour
  // fastest a result can come back, in seconds from the ticket (the VS screen adds ~4 s). Measured with a maxed tank
  // driven by the bot AI (dev/tests: fastest wins 18-36 s Arena, 47-63 s Moon Zone, 72 s Crystal Rush, 120 s Bounty,
  // 35 s Last Standing), then about 60% of that, so no real player is ever cut off
  MIN_WIN: { arena: { "1v1": 12, "2v2": 10, "3v3": 20 }, zone: { "1v1": 28, "2v2": 28, "3v3": 35 }, crystal: 60, bounty: 110, royale: 25, boss: 40 },   // Survival: fastest bot-driven kill ~70 s
  BOSS_DRAW: 170,          // Survival draw: the full 180 s clock
  GHOST_IDLE: 10 * 60000,  // a pilot counts as offline (their ghost can fight) after this long without playing
  GHOST_BAND: 0.25,        // ghosts come from pilots within 25% of your power
  GHOST_MAX: 2,            // at most this many ghosts in one match (up to half the AI seats)
  GHOST_MP: 3,             // a pilot's tank joins the ghost pool after this many matches
  MIN_TOP3: 18,            // Last Standing 2nd or 3rd
  MIN_ANY: 6,              // any other result
  // anomaly flags (outside human ranges): flagged pilots sit out the snapshot (and the public top 1,000) until Jake clears them.
  // PPM: a Legend winning featured Last Standing on a 5-win streak makes ~2,350 a match, ~1,560 a minute at 90 s a match
  WINRATE: 0.9, WINRATE_N: 50, HOURS: 20, MATCHES_DAY: 200, PPM: 1600, PPM_SECS: 1800, FAST: 5, REFUNDS: 2,
  // farm defense (bot-pattern flags). Every one only flags: the pilot sits out the airdrop list until Jake clears them
  PROOF_FAILS: 3,          // AI results that fail the proof-of-play check, in one UTC day
  NOINPUT: 3,              // matches in a day where the tank drove itself (moved with nobody on the controls)
  NOINPUT_SHARE: 0.6,      // ... share of moving moments with no input for a match to count
  REPEAT: 3,               // matches with the exact same controls, start to finish
  GAPS_N: 25, GAP_CV: 0.06, GAP_MAX: 120, MENU_MIN: 1.5,   // time between matches: never changes / always under 1.5 s
  LEN_N: 25, LEN_CV: 0.03, // match lengths that never change
  CLOCK_DAYS: 6, CLOCK_SPREAD: 5, CLOCK_MATCHES: 8, CLOCK_SPAN: 120,   // the same start and stop minute 6 days out of 7, 2+ hours a day
  TRADE: 8,                // live matches against the same pilot in one day (win trading between your own accounts)
  SESSION_GAP: 15 * 60000, // a break this long starts a new session
  // airdrop credit: brand-new Telegram accounts (not Premium) earn it at half rate on their first active day, rising to
  // full over AC_DAYS active days. Points and the leaderboard don't change. Telegram hands out ids in rising order, so
  // "brand new" = among the newest NEW_SHARE of the id range seen so far (the newest id any pilot has, tracked in cfg/maxid)
  NEW_SHARE: 0.03, AC_DAYS: 7,
  RL_MIN: 90,              // actions per pilot per minute (sync, claims, match tickets and results)
};
// a pilot's account age, from Telegram: new ids and no Premium
let NEWID = Infinity;   // from cfg/maxid (cfg() below); off until real Telegram ids have been seen
export const isNewTg = (user) => !!user && Number(user.id) >= NEWID && !user.is_premium;
const acW = (S) => (S.nw ? Math.min(1, 0.5 + (0.5 * Math.max(0, (S.days || 1) - 1)) / ECO.AC_DAYS) : 1);
// airdrop credit (ac) follows lifetime points, weighted for new accounts
function credit(S, e0) { if (typeof S.ac !== "number") S.ac = e0; const de = (S.earned || 0) - e0; if (de > 0) S.ac = Math.round(S.ac + de * acW(S)); S.ac = Math.min(S.ac, S.earned || 0); }
export function who(S, user) { S.nm = cleanName(user); S.nw = isNewTg(user) ? 1 : 0; }
// settings Jake changes from the admin sheet (proof of play: "enforce" or "flag"), read at most once a minute
let CFG = null, CFG_T = 0;
export async function cfg(env, now = Date.now()) {
  if (CFG && now - CFG_T < 60000) return CFG;
  CFG = (await dbGet(env, "cfg").catch(() => null)) || {}; CFG_T = now;
  const mx = Number(CFG.maxid) || 0;
  NEWID = mx >= 1e9 ? Math.floor(mx * (1 - ECO.NEW_SHARE)) : Infinity;
  return CFG;
}
export const resetCfg = () => { CFG = null; };
export const ipHash = async (env, ip) => (ip ? hex(await hmac(env.BOT_TOKEN, "ip|" + ip)).slice(0, 16) : "");
// two pilots linked as one person's accounts (shown as a cluster in the admin sheet; only one of them counts for the airdrop)
export async function link(env, a, b, why) {
  if (!a || !b || a === b || !/^tg_\d{3,15}$/.test(a) || !/^tg_\d{3,15}$/.test(b)) return;
  await dbPatch(env, "", { [`lk/${a}/${b}`]: why, [`lk/${b}/${a}`]: why });
}

const mapList = () => LIM.MAP_REAL;   // no sim built just to list the maps
export const ctxOf = (pid, now) => ({ day: dayOf(now), week: weekOf(now), rnd: Math.random, pk: pid });
const safeKey = (s) => String(s).replace(/[.#$\[\]\/|]/g, "_").slice(0, 100);

// ---- conditional reads and writes ----
async function readTag(env, path) {
  const r = await fetch(dbUrl(env, path), { headers: { "X-Firebase-ETag": "true" } });
  if (!r.ok) throw new Error("db get " + path + " " + r.status);
  return { v: await r.json(), tag: r.headers.get("ETag") || "" };
}
async function writeIf(env, path, value, tag) {
  // never print=silent here: Firebase refuses it on a conditional (if-match) write with a 400, which made every record
  // save fail (Oct 23). The reply echoes the record, a few KB, the price of a write that can't silently overwrite another
  const r = await fetch(dbUrl(env, path), { method: "PUT", headers: { "Content-Type": "application/json", "if-match": tag }, body: JSON.stringify(value) });
  if (r.status === 412) return false;
  if (!r.ok) throw new Error("db put " + path + " " + r.status);
  return true;
}
// write path only if nothing is there yet; false if someone already did (a transaction hash used once, say)
export async function claimOnce(env, path, value) {
  for (let i = 0; i < 3; i++) {
    const { v, tag } = await readTag(env, path);
    if (v !== null) return { ok: false, v };
    if (await writeIf(env, path, value, tag)) return { ok: true };
  }
  return { ok: false, v: null };
}

// ---- the record ----
// A pilot the server has never seen gets a fresh record. One who played before this record existed keeps their lifetime
// points exactly; their gear and spendable points arrive once from their phone (migrate), checked against the server.
async function freshEco(env, pid) {
  const rec = await dbGet(env, `players/${pid}`);
  const S = R.ecoNorm({});
  if (rec) {
    S.earned = Math.max(0, Math.round(Number(rec.pts) || 0));
    S.pts = 0;
    for (const k of ["dailyPts", "weeklyPts", "days", "sk", "wins", "losses", "mp", "pvs", "pvm", "pvw", "pvd", "pvl"]) if (typeof rec[k] === "number") S[k] = rec[k];
    for (const k of ["ld", "fd"]) if (typeof rec[k] === "number") S[k] = rec[k];
    if (typeof rec.d === "number") S.dailyDay = rec.d;
    if (typeof rec.w === "number") S.weeklyNum = rec.w;
    if (rec.name) S.nm = rec.name;
    S.mig = 0;   // waiting for the phone's one-time move
  } else S.mig = 1;   // brand new: nothing to move
  S._new = !rec;
  return S;
}
export async function readEco(env, pid) {
  const v = await dbGet(env, `eco/${pid}`);
  const S = v ? R.ecoNorm(v) : await freshEco(env, pid);
  delete S._new;
  return S;
}
// run fn(S, X) on the pilot's record and save it, all or nothing. fn may run more than once (if another write lands
// first), so it must only change S. Return {abort: true} to save nothing.
export async function tx(env, pid, fn, now = Date.now(), opt = {}) {
  await cfg(env, now);   // settings, cached a minute (the new-account line, proof-of-play mode)
  for (let i = 0; i < 8; i++) {
    const { v, tag } = await readTag(env, `eco/${pid}`);
    const S = v ? R.ecoNorm(v) : await freshEco(env, pid);
    const isNew = !!S._new; delete S._new;
    const X = ctxOf(pid, now);
    R.ecoRoll(S, X);
    if (opt.rl) {   // actions per pilot per minute
      const mn = Math.floor(now / 60000);
      S.rq = S.rq && S.rq.m === mn ? S.rq : { m: mn, n: 0 };
      if (S.rq.n >= ECO.RL_MIN) return { abort: true, rate: true, S, X };
      S.rq.n++;
    }
    const before = { d: S.dailyPts, w: S.weeklyPts, e: S.earned || 0 };
    const out = (await fn(S, X)) || {};
    if (out.abort) return { ...out, S, X };
    credit(S, before.e);
    S.rev = (S.rev || 0) + 1; S.t = now;
    if (await writeIf(env, `eco/${pid}`, S, tag)) {
      await mirror(env, pid, S, isNew, before, now).catch(() => {});
      return { ...out, S, X };
    }
  }
  throw new Error("busy");
}
// the fields the leaderboard, squad lists, reminders and admin read stay on players/<pid> (a copy of the record)
async function mirror(env, pid, S, isNew, before, now) {
  const P = `players/${pid}`, up = {};
  const f = { pts: S.earned, dailyPts: S.dailyPts, weeklyPts: S.weeklyPts, d: S.dailyDay, w: S.weeklyNum, days: S.days, sk: S.sk, ld: S.ld, fd: S.fd,
    wins: S.wins, losses: S.losses, mp: S.mp, power: S.pw, league: S.lg, name: S.nm, seen: now, pvm: S.pvm, pvw: S.pvw, pvd: S.pvd, pvl: S.pvl, pvs: S.pvs, ac: S.ac, sg: Math.round((S.spendGram || 0) * 100) / 100, vg: S.vg || 0, gg: S.vgg || 0 };   // gg: Genesis Gold (deposited before $LUNAR launches)   // sg: verified spending (TON value of what was bought), for the snapshot
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null) up[`${P}/${k}`] = v;
  const vl = R.vaultLevel(S.vg), vx = vl ? { v: vl } : {};   // the Vault badge shows on the daily and weekly boards too
  if (S.dailyPts !== before.d || isNew) up[`dly/${S.dailyDay}/${pid}`] = { s: S.dailyPts, n: S.nm || "Pilot", ...vx };
  if (S.weeklyPts !== before.w || isNew) up[`wly/${S.weeklyNum}/${pid}`] = { s: S.weeklyPts, n: S.nm || "Pilot", ...vx };
  if (isNew) up["meta/n"] = { ".sv": { increment: 1 } };
  const idn = Number(String(pid).slice(3));
  if (isNew && idn > (Number((CFG || {}).maxid) || 0)) { up["cfg/maxid"] = idn; if (CFG) CFG.maxid = idn; if (idn >= 1e9) NEWID = Math.floor(idn * (1 - ECO.NEW_SHARE)); }   // the newest Telegram id seen so far
  // for the daily reminder: the day you last played and your streak, next to your reminder settings (one read finds who's due)
  if (S.ld !== undefined && S.ld !== null) { up[`ntf/${pid}/pl`] = S.ld; up[`ntf/${pid}/sk`] = S.sk || 0; up[`ntf/${pid}/gf`] = S.g2 ? 1 : 0; }
  // the ghost pool: your tank as it is now (server-owned loadout), and when you last played
  if (S.L && (S.mp || 0) >= ECO.GHOST_MP) up[`gh/${pid}`] = { n: S.nm || "Pilot", L: S.L, pw: S.pw || 0, t: now };
  await dbPatch(env, "", up);
}

// ================= ghosts: offline pilots' tanks, flown by the AI in other people's matches =================
// The pilot who meets a ghost earns exactly what a common AI tank would pay. The ghost's owner earns nothing;
// they get a report when they come back (ghr/<pid>: matches, wins, draws, losses, damage, kills).
export const ghostSeats = (g, m) => {
  const n = g === "royale" ? 1 : (R.MODES[m] || R.MODES["1v1"]).n;
  const bots = g === "royale" ? 5 : g === "boss" ? n - 1 : 2 * n - 1;
  return Math.min(ECO.GHOST_MAX, Math.ceil(bots / 2));
};
export async function pickGhosts(env, pid, pw, k, now = Date.now(), skip = []) {
  if (!(k > 0)) return [];
  const lo = Math.floor(pw * (1 - ECO.GHOST_BAND)), hi = Math.ceil(pw * (1 + ECO.GHOST_BAND));
  // a few rows from a random point in your power band (the band can hold thousands of pilots; a match needs two)
  const at = lo + Math.floor(Math.random() * Math.max(1, hi - lo) * 0.8);
  let rows = (await dbGet(env, "gh", { orderBy: '"pw"', startAt: at, endAt: hi, limitToFirst: 10 }).catch(() => null)) || {};
  if (Object.keys(rows).length < 10) rows = Object.assign((await dbGet(env, "gh", { orderBy: '"pw"', startAt: lo, endAt: hi, limitToFirst: 10 }).catch(() => null)) || {}, rows);
  const pool = Object.entries(rows).filter(([id, g]) => id !== pid && !skip.includes(id) && g && g.L && now - (g.t || 0) > ECO.GHOST_IDLE);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, k).map(([id, g]) => ({ id, n: String(g.n || "Pilot").slice(0, 24), L: g.L }));
}
// list: [[owner pid, {won, drawn, dmg, kills}]]
export async function ghostReport(env, list, now = Date.now()) {
  const up = {}, inc = (n) => ({ ".sv": { increment: n } });
  for (const [id, r] of list) {
    if (!/^tg_\d{3,15}$/.test(String(id))) continue;
    const P = `ghr/${id}`, k = r.won ? "w" : r.drawn ? "d" : "l";
    up[`${P}/m`] = inc(1); up[`${P}/${k}`] = inc(1);
    up[`${P}/dmg`] = inc(Math.max(0, Math.min(200000, Math.round(Number(r.dmg) || 0))));
    up[`${P}/kills`] = inc(Math.max(0, Math.min(20, Math.round(Number(r.kills) || 0))));
    up[`${P}/last`] = now;
  }
  if (Object.keys(up).length) await dbPatch(env, "", up);
}
// what the phone gets: the economy fields only (no anomaly stats, tickets or bookkeeping)
export function pub(S) { const E = {}; for (const k of R.ECO_KEYS) if (S[k] !== undefined) E[k] = S[k]; E._rev = S.rev || 0; return E; }
// the loadout a pilot fields, from what they own; power and league from that
export function setLoadout(S, raw) { const L = S.lab ? R.labLoadout(S) : R.ecoLoadout(S, raw); S.L = L; S.pw = R.powerOf(L); S.lg = R.powerBracket(S.pw).key; return L; }

// ---- flags ----
export const flagReasons = (f) => (f && f.r ? Object.keys(f.r).filter((k) => !(f.ok && f.ok[k] >= (f.r[k].t || 0))) : []);
export const isFlagged = (f) => flagReasons(f).length > 0;
export async function addFlags(env, pid, name, list, now = Date.now()) {
  if (!list || !list.length) return;
  const up = { [`flags/${pid}/n`]: name || "Pilot", [`fh/${pid}`]: 1 };   // fh: the small index of who's held right now (squad payouts read it)
  for (const [k, v] of list) up[`flags/${pid}/r/${safeKey(k)}`] = { t: now, v: v === undefined ? 1 : v };
  await dbPatch(env, "", up);
}
// flags raised inside a transaction: each reason once per pilot (clearing it stops it coming back)
function raise(S, list, k, v) { S.fl = S.fl || {}; if (S.fl[k]) return; S.fl[k] = 1; list.push([k, v]); }
const bits = (n) => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };
// per-pilot play stats for the anomaly flags: m = {ai, won, secs, pts, fast, pf (failed proof), ni (drove itself)}
function watch(S, m, X, now) {
  const A = S.an && S.an.d === X.day ? S.an : { ...(S.an || {}), d: X.day, m: 0, h: 0, pf: 0, ni: 0 };
  if (m.pf) A.pf = (A.pf || 0) + 1;
  else if (m.fast) A.fast = (A.fast || 0) + 1;
  else {
    A.m++; A.h |= 1 << new Date(now).getUTCHours();
    if (m.ai) { A.ai = (A.ai || 0) + 1; if (m.won) A.aw = (A.aw || 0) + 1; }
    A.s = (A.s || 0) + Math.max(0, m.secs || 0); A.p = (A.p || 0) + Math.max(0, m.pts || 0);
  }
  S.an = A;
  const out = [];
  if ((A.ai || 0) >= ECO.WINRATE_N && A.aw / A.ai > ECO.WINRATE) raise(S, out, "winrate", Math.round((A.aw / A.ai) * 100) + "% of " + A.ai + " AI matches");
  if (bits(A.h) >= ECO.HOURS) raise(S, out, "hours", bits(A.h) + " hours in one day");
  if (A.m > ECO.MATCHES_DAY) raise(S, out, "matches", A.m + " matches in one day");
  if ((A.s || 0) >= ECO.PPM_SECS && A.p / (A.s / 60) > ECO.PPM) raise(S, out, "ppm", Math.round(A.p / (A.s / 60)) + " points a minute");
  if ((A.fast || 0) >= ECO.FAST) raise(S, out, "fast", A.fast + " results faster than possible");
  if (m.ni) A.ni = (A.ni || 0) + 1;
  if ((A.pf || 0) >= ECO.PROOF_FAILS) raise(S, out, "proof", A.pf + " AI results failed the match-record check today (" + (m.why || S.pfw || "") + ")");
  if ((A.ni || 0) >= ECO.NOINPUT) raise(S, out, "noinput", A.ni + " matches today where the tank drove with nobody on the controls");
  return out;
}
// bot patterns across matches (S.bp): the same controls, steady gaps, no time in menus, steady lengths, a clockwork day
const cvOf = (a) => { const n = a.length, m = a.reduce((x, y) => x + y, 0) / n, v = a.reduce((x, y) => x + (y - m) * (y - m), 0) / n; return { m, cv: m > 0 ? Math.sqrt(v) / m : 0 }; };
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
export function bpFlags(S) {
  const bp = S.bp || {}, out = [];
  const ih = bp.ih || [], cnt = {};
  for (const x of ih) cnt[x] = (cnt[x] || 0) + 1;
  const top = Math.max(0, ...Object.values(cnt));
  if (top >= ECO.REPEAT) raise(S, out, "repeat", "the exact same controls in " + top + " matches");
  const g = bp.g || [];
  if (g.length >= ECO.GAPS_N) {
    const { m, cv } = cvOf(g);
    if (cv < ECO.GAP_CV && m < ECO.GAP_MAX) raise(S, out, "steady", "the next match starts " + m.toFixed(1) + " s after the last, every time (" + g.length + " in a row)");
    if (median(g) < ECO.MENU_MIN) raise(S, out, "nomenu", "starts the next match " + median(g).toFixed(1) + " s after a result, typically (" + g.length + " matches)");
  }
  const by = {};
  for (const [k, v] of bp.l || []) (by[k] = by[k] || []).push(v);
  for (const [k, a] of Object.entries(by)) if (a.length >= ECO.LEN_N && cvOf(a).cv < ECO.LEN_CV) raise(S, out, "steadylen", a.length + " " + k + " matches all lasting about " + Math.round(cvOf(a).m) + " s");
  const days = Object.entries(bp.dy || {}).map(([d, v]) => [Number(d), v]).sort((a, b) => b[0] - a[0]).slice(0, 7).filter(([, v]) => v[2] >= ECO.CLOCK_MATCHES);
  if (days.length >= ECO.CLOCK_DAYS && days.every(([, v]) => v[1] - v[0] >= ECO.CLOCK_SPAN)) {
    const sp = (i) => Math.max(...days.map(([, v]) => v[i])) - Math.min(...days.map(([, v]) => v[i]));
    if (sp(0) <= ECO.CLOCK_SPREAD && sp(1) <= ECO.CLOCK_SPREAD) raise(S, out, "clockwork", "starts and stops at the same minute " + days.length + " days in a row");
  }
  return out;
}

// ================= AI matches: a ticket at the start, the result with it at the end =================
const sign = async (env, s) => hex(await hmac(env.BOT_TOKEN, "match|" + s)).slice(0, 24);
export async function matchStart(env, b, user, pid, now = Date.now(), ip = "") {
  const g = String(b.g || ""), m = String(b.m || ""), map = String(b.map || "");
  if (!R.GT_ORDER.includes(g)) return { status: 400, body: { error: "mode" } };
  if (g !== "royale" && !R.MODES[m]) return { status: 400, body: { error: "mode" } };
  if (!mapList().includes(map)) return { status: 400, body: { error: "map" } };
  // a phone that doesn't send match records is out of date: it reloads to the new version (index.html checks on open)
  if (!b.pv) return { status: 200, body: { ok: false, error: "update" } };
  let sess = false;
  const n = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const pw0 = await dbGet(env, `players/${pid}/power`).catch(() => null);
  const ghosts = await pickGhosts(env, pid, Number(pw0) || 0, Number(pw0) > 0 ? ghostSeats(g, m) : 0, now);
  const t = await tx(env, pid, (S, X) => {
    who(S, user);
    if (S.lab && b.labRev === undefined) return {abort:true,error:"update"};
    if (S.lab && b.labRev !== undefined && b.labRev !== S.lab.rev) return {abort:true, error:"garage_changed"};
    const L = setLoadout(S, b.L), brk = R.powerBracket(S.pw);
    // one open ticket per pilot: a new one replaces the last (that match can't be scored any more)
    S.mt = { n, g, m: g === "royale" ? "1v1" : m, map, t0: now, feat: g === R.featuredOn(X.day), quick: !!b.quick, pv: 1,
      L: JSON.parse(JSON.stringify(L)), rv: S.lab ? R.LAB_RULES_VERSION : "legacy-v1", series: g === "arena" && m === "1v1" && (S.mp || 0) > 0, mult: brk.mult, lg: brk.key, pw: S.pw, gh: ghosts.map((x) => x.id) };
    // bot-pattern bookkeeping: time since your last result (menus, results screen), your day's first start
    const bp = (S.bp = S.bp || {}), gap = bp.le ? (now - bp.le) / 1000 : 1e9;
    if (gap < 600) bp.g = (bp.g || []).concat(Math.round(gap * 10) / 10).slice(-30);
    sess = !bp.ls || now - bp.ls > ECO.SESSION_GAP;
    bp.ls = now;
    const dm = Math.floor((now % DAY_MS) / 60000), dy = (bp.dy = bp.dy || {});
    if (!dy[X.day]) dy[X.day] = [dm, dm, 0];
    dy[X.day][2]++;
    for (const k of Object.keys(dy)) if (Number(k) < X.day - 9) delete dy[k];
    return { lg: brk.key, mult: brk.mult, power: S.pw, L };
  }, now, { rl: 1 });
  if (t.rate) return { status: 429, body: { error: "rate" } };
  if (t.error) return { status: 409, body: { error: t.error } };
  // a new session: who started playing this minute, on which network and device (accounts that always start together)
  if (sess) {
    const d = dayOf(now), mn = String(Math.floor((now % DAY_MS) / 60000)).padStart(4, "0");
    const dh = /^[0-9a-f]{1,8}$/.test(String(b.dh || "")) ? b.dh : "", did = /^[0-9a-f]{16}$/.test(String(b.did || "")) ? b.did : "";
    await dbPatch(env, `ss/${d}/${mn}`, { [pid]: (await ipHash(env, ip)).slice(0, 8) + "." + dh + "." + did.slice(0, 8) }).catch(() => {});
  }
  // ghosts go to the phone by seat number only (never the owner's id)
  return { status: 200, body: { ok: true, tok: n + "." + (await sign(env, `${pid}|${n}|${now}`)), league: t.lg, mult: t.mult, power: t.power, L: t.L, E: pub(t.S),
    gh: ghosts.map((x, i) => ({ i, n: x.n, L: x.L })) } };
}
const lim = (v, hi) => Math.max(0, Math.min(hi, Math.round(Number(v) || 0)));
export function minSecs(g, m, won, drawn, place) {
  if (g === "royale") return place === 1 ? ECO.MIN_WIN.royale : place > 0 && place <= 3 ? ECO.MIN_TOP3 : ECO.MIN_ANY;
  if (g === "boss" && drawn && !won) return ECO.BOSS_DRAW;   // Survival: a draw means you lasted the whole clock
  if (!won && !drawn) return ECO.MIN_ANY;
  const v = ECO.MIN_WIN[g];
  return typeof v === "number" ? v : (v && v[m]) || 10;
}
export async function matchEnd(env, b, user, pid, now = Date.now()) {
  const [n, sg] = String(b.tok || "").split(".");
  if (!/^[0-9a-f]{16}$/.test(n || "")) return { status: 400, body: { error: "ticket" } };
  const r0 = b.r && typeof b.r === "object" ? b.r : {};
  // flag (the default): every result scores, and 3 failed records in a day flag the pilot (held off the airdrop list until
  // Jake clears them), so a real player never loses a match to the check. enforce (admin sheet): a failed record scores nothing
  const mode = (await cfg(env, now)).proof === "enforce" ? "enforce" : "flag";
  let flags = [], ih = null;
  const t = await tx(env, pid, async (S, X) => {
    who(S, user);
    S.md = S.md || {};
    if (S.md[n]) return { abort: true, dup: S.md[n] };   // already scored (a retry after a lost reply): the same answer
    const T = S.mt;
    if (!T || T.n !== n || sg !== (await sign(env, `${pid}|${n}|${T.t0}`))) return { abort: true, err: "ticket" };
    delete S.mt;
    const secs = (now - T.t0) / 1000;
    const keep = (res) => { S.md[n] = res; const ks = Object.keys(S.md); if (ks.length > 6) for (const k of ks.slice(0, ks.length - 6)) delete S.md[k]; return res; };
    if (now - T.t0 > ECO.TICKET_MS) return { err: "expired", res: keep({ err: "expired" }) };
    if (r0.quit) { R.ecoQuit(S); return { res: keep({ pts: 0, awarded: 0, quit: true }) }; }
    // the result as the phone reports it, held to what's possible in that time
    const solo = T.g === "royale";
    let won = !!r0.won, drawn = !won && !!r0.drawn, place = solo ? Math.max(1, Math.min(6, Math.round(Number(r0.place) || 6))) : 0;
    if (solo) { won = place === 1; drawn = false; }
    const top3 = solo && place <= 3;
    if (secs < minSecs(T.g, T.m, won, drawn, place)) { flags = watch(S, { fast: true }, X, now); return { err: "fast", res: keep({ err: "fast" }) }; }
    const hr = Math.floor(now / 3600000);
    S.mh = S.mh && S.mh.h === hr ? S.mh : { h: hr, n: 0 };
    if (S.mh.n >= ECO.HOUR_CAP) return { err: "hourly", res: keep({ err: "hourly" }) };
    S.mh.n++;
    const s = r0.stats && typeof r0.stats === "object" ? r0.stats : {}, el = Math.max(1, secs);
    // proof of play: the match record has to show this fight happened the way the result says
    let pr = null;
    if (T.pv) {
      const proofL = T.L || S.L; // old pending tickets retain their legacy fallback
      const me0 = proofL ? R.tankOf(proofL, 1) : null;
      const scale = T.g === "royale" ? R.ROYALE_HP : T.g === "boss" ? 1.5 : R.MODES[T.m].n * (T.g === "bounty" ? R.BTY_HP : 1);
      const variants = T.rv === R.LAB_RULES_VERSION && proofL ? (proofL.chs || [proofL.c]).map(c => {const t=R.tankOf({...proofL,c},scale);return {ci:R.CHORDER.indexOf(c.c),mhp:t.mhp,spdM:t.spdM};}) : undefined;
      pr = checkProof(r0.pf, { variants, g: T.g, m: T.m, map: T.map, secs, won, drawn, place, series: T.series, min: minSecs(T.g, T.m, won, drawn, place), spdM: me0 ? me0.spdM : 1, st: s });
      if (!pr.ok) {
        S.pfw = pr.why;
        flags = watch(S, { pf: true, why: pr.why }, X, now);
        if (mode !== "flag") return { err: "proof", res: keep({ err: "proof", why: pr.why }) };
      } else for (const [k, v] of Object.entries(pr.fix)) s[k] = v;   // stats held to what the record shows
    }
    const kmax = T.g === "arena" ? (T.series ? 5 : R.MODES[T.m].n) : solo ? 5 : Math.ceil(el / 4) + 2;
    const st = { dmg: lim(s.dmg, el * 450), kills: lim(s.kills, kmax), box: lim(s.box, 30), sup: lim(s.sup, Math.ceil(el / 6) + 2), caps: T.g === "zone" ? lim(s.caps, Math.ceil(el / 5)) : 0,
      cry: T.g === "crystal" ? lim(s.cry, Math.ceil(el / 3)) : 0, stars: T.g === "bounty" ? lim(s.stars, Math.ceil(el / 2) + 7) : 0, low: Math.max(0, Math.min(1, Number(s.low) || 0)) };
    const sw = T.series && Array.isArray(r0.seriesW) ? [lim(r0.seriesW[0], 3), lim(r0.seriesW[1], 3)] : null;
    // how the ghosts in this match did (seat numbers from the ticket; anything else is ignored)
    const gIds = Array.isArray(T.gh) ? T.gh : [], gseen = new Set();
    const ghr = (Array.isArray(r0.gh) ? r0.gh.slice(0, 6) : []).map((x) => {
      const i = Math.round(Number(x && x.i)); if (!(i >= 0 && i < gIds.length) || gseen.has(i)) return null; gseen.add(i);
      return [gIds[i], { won: !!x.won, drawn: !x.won && !!x.drawn, dmg: lim(x.dmg, el * 450), kills: lim(x.kills, kmax) }];
    }).filter(Boolean);
    const o = { won, drawn, place, top3, g: T.g, m: T.m, feat: T.feat, series: T.series, quick: T.quick, map: T.map };
    const p = R.ecoMatchPts(S, o, T.mult, X);
    R.ecoAfterMatch(S, { ...o, streak: S.streak, seriesW: sw, st }, X);
    flags = flags.concat(watch(S, { ai: true, won, secs, pts: p.pts, ni: !!(pr && pr.ok && pr.sig.ni > ECO.NOINPUT_SHARE) }, X, now));
    const bp = (S.bp = S.bp || {});
    // when this match ended: the ticket plus the fight the record shows and the VS screen (a result that arrives late, on
    // a weak connection, doesn't look like a pilot who never stops in the menus)
    bp.le = Math.min(now, T.t0 + ((pr && pr.ok ? pr.sig.simT : secs) + 4) * 1000);
    bp.l = (bp.l || []).concat([[T.g + " " + T.m, Math.round(secs)]]).slice(-30);
    if (pr && pr.ok && pr.sig.ih) { bp.ih = (bp.ih || []).concat(pr.sig.ih).slice(-20); ih = pr.sig.ih; }
    const dy = bp.dy && bp.dy[X.day];
    if (dy) dy[1] = Math.floor((now % DAY_MS) / 60000);
    flags = flags.concat(bpFlags(S));
    return { ghr, res: keep({ pts: p.pts, awarded: p.awarded, streak: p.streak, streakBonus: p.streakBonus, base: p.base, modeX: p.modeX, featX: p.featX, mult: T.mult }) };
  }, now, { rl: 1 });
  if (flags.length) await addFlags(env, pid, t.S.nm, flags, now);
  if (t.ghr && t.ghr.length) await ghostReport(env, t.ghr, now).catch(() => {});
  // the same controls, move for move, on another account: one script playing for both
  if (ih) {
    // fingerprints are kept by week (this week and last are checked; older weeks are dropped by the cron)
    const wk = weekOf(now), [a, b2] = await Promise.all([dbGet(env, `ih/${wk}/${ih}`).catch(() => null), dbGet(env, `ih/${wk - 1}/${ih}`).catch(() => null)]);
    for (const o of Object.keys(Object.assign({}, b2 || {}, a || {})).slice(0, 10)) if (o !== pid) await link(env, pid, o, "replay").catch(() => {});
    await dbPatch(env, `ih/${wk}/${ih}`, { [pid]: dayOf(now) }).catch(() => {});
  }
  const res = t.dup || t.res;
  if (t.rate) return { status: 429, body: { error: "rate" } };
  if (t.err === "ticket" && !t.dup) return { status: 200, body: { ok: false, error: "ticket", E: pub(t.S) } };
  if (res && res.err) return { status: 200, body: { ok: false, error: res.err, E: pub(t.S) } };
  return { status: 200, body: { ok: true, res, dup: !!t.dup, E: pub(t.S) } };
}

// ================= live matches: the room credits the result itself =================
// calc(S) gets the record and returns {pts, pvs, sb, won, drawn, m: the match for quests and stats (or m.quit)}
export async function creditMatch(env, pid, name, calc, now = Date.now()) {
  let flags = [];
  const trade = [];
  const t = await tx(env, pid, (S, X) => {
    if (name) S.nm = name;
    trade.length = 0;
    const c = calc(S) || {};
    // the same opponent over and over in one day: accounts trading wins
    if (Array.isArray(c.opp) && c.opp.length) {
      S.op = S.op && S.op.d === X.day ? S.op : { d: X.day, m: {} };
      for (const o of c.opp.slice(0, 5)) { if (!/^tg_\d{3,15}$/.test(String(o))) continue; S.op.m[o] = (S.op.m[o] || 0) + 1; if (S.op.m[o] === ECO.TRADE) trade.push(o); }
    }
    const pts = Math.max(0, Math.round(c.pts || 0)), awarded = R.ecoAward(S, pts, X);
    S.pvs = c.pvs || 0; S.pvm = (S.pvm || 0) + 1;
    const k = c.won ? "pvw" : c.drawn ? "pvd" : "pvl"; S[k] = (S[k] || 0) + 1;
    if (c.m) {
      if (c.m.quit) R.ecoQuit(S);
      else { R.ecoAfterMatch(S, { ...c.m, streak: S.pvs }, X); flags = watch(S, { ai: false, secs: c.m.secs || 0, pts }, X, now); }
    }
    return { pts, awarded, capped: awarded < pts, pvs: S.pvs, sb: c.sb || 0 };
  }, now);
  if (flags.length) await addFlags(env, pid, t.S.nm, flags, now).catch(() => {});
  for (const o of trade) await link(env, pid, o, "trade").catch(() => {});
  return { pts: t.pts, awarded: t.awarded, capped: t.capped, pvs: t.pvs, sb: t.sb };
}

// ================= payments on record (for the one-time move and the loadout) =================
const LABELS = (() => {
  const m = {};
  for (const [ri, rn] of ["Common", "Rare", "Epic"].entries()) {
    m[rn + " Weapon Cache"] = { k: "box", t: "weapon", r: ri }; m[rn + " Chassis Crate"] = { k: "box", t: "chassis", r: ri }; m[rn + " Gem Cache"] = { k: "box", t: "gem", r: ri };
  }
  Object.assign(m, { Moonbeam: { k: "moonbeam" }, "Lunar Skin": { k: "skin" }, "Starter Pack": { k: "starter" }, "Founder Pack": { k: "founder" } });
  return m;
})();
export async function paidRecords(env, pid) {
  const pre = (p) => ({ orderBy: '"$key"', startAt: `"${p}"`, endAt: `"${p}"` });
  const [stars, chain] = await Promise.all([
    dbGet(env, `starsPaid/${pid}`).catch(() => null),
    dbGet(env, "payments", pre(`LWM_LWM_${pid}_`)).catch(() => null),
  ]);
  const P = { box: {}, starter: 0, founder: 0, moonbeam: 0, skin: 0, pass: 0, paint: {} };
  const add = (k, t, r) => {
    if (k === "box") P.box[t + r] = (P.box[t + r] || 0) + 1;
    else if (k === "paint") P.paint[t] = 1;
    else if (k in P) P[k]++;
  };
  for (const v of Object.values(stars || {})) if (v && !v.rf) add(v.k, v.t, v.r);
  for (const v of Object.values(chain || {})) {
    if (!v || v.verified !== true || v.refunded || v.cur === "STARS" || v.pid !== pid) continue;
    const it = String(v.item || "");
    if (LABELS[it]) { const L = LABELS[it]; add(L.k, L.t, L.r); }
    else if (/^Lunar Pass/.test(it)) add("pass");
    else if (/^Paint: /.test(it)) { const id = Object.keys(R.PAINTS).find((k) => R.PAINTS[k].n.toLowerCase() === it.slice(7).toLowerCase()); if (id) add("paint", id); }
  }
  return P;
}

// ================= the one-time move from the phone =================
// Lifetime points stay exactly as the server had them. Gear, upgrades, cores and today's quests come from the phone's
// save, checked against what the pilot paid for and what their lifetime points could have bought. Anything that can't
// be explained is kept, not deleted, and flagged for Jake to review (flagged pilots sit out the snapshot until cleared).
const sumUp = (up) => R.UORDER.reduce((a, k) => a + R.UPS[k].costs.slice(0, up[k] || 0).reduce((x, y) => x + y, 0), 0);
export function migrate(S, m, P, X) {
  const C = R.ecoNorm(JSON.parse(JSON.stringify(m && typeof m === "object" ? m : {})));
  const why = {};
  for (const k of ["up", "gemLvl", "gemShards", "wOwn", "cOwn", "paints"]) S[k] = C[k];
  S.roll = {}; S.salv = {};
  for (const [k, v] of Object.entries(C.roll)) { const n = Number(v); if (Number.isFinite(n)) S.roll[safeKey(k)] = Math.max(R.ROLL_MIN, Math.min(R.ROLL_MAX, n)); }
  for (const [k, v] of Object.entries(C.salv)) { const t = Number(String(k).split(":")[1]), n = Number(v); if ((t === 1 || t === 2) && Number.isFinite(n)) S.salv[safeKey(k)] = n < 1 ? n : Math.max(R.SALV_MIN[t], Math.min(R.SALV_MAX[t], n)); }
  S.skin = C.skin; S.moonbeam = C.moonbeam; S.starter = C.starter; S.founder = C.founder;
  // streaks, today's and this week's quests, claimed milestones and squad payouts: so nothing already claimed pays twice
  if (C.login && typeof C.login === "object" && C.login.last <= X.day) S.login = { last: Number(C.login.last) || -9, n: Math.max(0, Math.min(400, Number(C.login.n) || 0)) };
  S.q = {};
  for (const [id, e] of Object.entries(C.q)) if (R.MS_BY[id] && e && typeof e === "object") S.q[id] = { p: Math.max(0, Number(e.p) || 0), done: !!e.done, claimed: !!e.claimed };
  R.ecoQuests(S, X);
  if (C.dq && C.dq.d === X.day && C.dq.v === 2) for (const k of ["p", "c", "all", "sw", "was", "ids"]) if (C.dq[k] !== undefined) S.dq[k] = C.dq[k];
  if (C.wk && C.wk.w === X.week) for (const k of ["p", "u", "c", "ids"]) if (C.wk[k] !== undefined) S.wk[k] = C.wk[k];
  if (C.wq && C.wq.w === X.week) S.wq = { w: X.week, n: Math.max(0, Math.min(200, Number(C.wq.n) || 0)), claimed: !!C.wq.claimed };
  const pass = R.ecoPassState(S, X);
  if (C.pass && C.pass.s === pass.s) {
    const daysIn = X.day - R.passStart(pass.s) + 1, nt = R.passTiers(pass.s);
    Object.assign(pass, { xp: Math.max(0, Math.min(Number(C.pass.xp) || 0, daysIn * 4000)), prem: !!C.pass.prem, cf: C.pass.cf.slice(0, nt), cp: C.pass.cp.slice(0, nt) });
  }
  S.streak = Math.max(0, Math.min(50, C.streak | 0));
  for (const k of ["refC", "buys"]) S[k] = C[k];
  if (C.refPD && C.refPD.d === X.day) S.refPD = C.refPD;
  S.refWelcome = !!C.refWelcome;
  if (C.dealD === X.day) S.dealD = X.day;
  if (C.dealW === X.week) S.dealW = X.week;
  for (const k of ["wins", "losses", "mp"]) S[k] = Math.max(S[k] || 0, Math.max(0, C[k] | 0));
  S.ptsSpent = C.ptsSpent; S.spendGram = C.spendGram;
  // paid-only things need a payment on record
  if (S.moonbeam && !P.moonbeam) why.moonbeam = "Moonbeam without a payment";
  if (S.skin === "lunar" && !P.skin) why.skin = "Lunar skin without a payment";
  if (S.starter && !P.starter) why.starter = "Starter pack without a payment";
  if (S.founder && !P.founder) why.founder = "Founder pack without a payment";
  if (pass.prem && !P.pass) why.pass = "Premium pass without a payment";
  const unpaidPaint = Object.keys(S.paints).filter((k) => R.PAINTS[k] && R.PAINTS[k].stars && !P.paint[k]);
  if (unpaidPaint.length) why.paint = "Paints without a payment: " + unpaidPaint.join(", ");
  // gear: every crate item needs a source. Paid crates, packs and the pass first; the rest priced as points crates
  // (common 20,000, rare 80,000). Epic gear can't be bought with points
  const free = { weapon: [0, 0, 0], chassis: [0, 0, 0] }, gemFree = { n: 0 };
  if (P.starter) { free.weapon[1]++; free.chassis[1]++; gemFree.n += 4; }
  if (P.founder) { free.weapon[2]++; gemFree.n += 8; }
  for (const [list, tr] of [[pass.cf, R.PASS_FREE], [pass.cp, R.PASS_PREM]]) for (const i of list) { const r = tr[i]; if (r && r.k === "box") { if (r.tk === "gem") gemFree.n += r.ri === 2 ? 14 : r.ri ? 4 : 2; else free[r.tk][r.ri]++; } }
  let spend = 0, epic = 0;
  for (const [tk, own] of [["weapon", S.wOwn], ["chassis", S.cOwn]]) for (let t = 0; t <= 2; t++) {
    const n = Object.entries(own).filter(([k, ts]) => ts.includes(t) && !(t === 0 && (k === "pulse" || k === "vanguard"))).length;
    const extra = n - (P.box[tk + t] || 0) - free[tk][t];
    if (extra > 0) { if (t === 2) epic += extra; else spend += extra * R.RPTS[t]; }
  }
  if (epic) why.epic = epic + " epic item(s) without a payment";
  for (const k of Object.keys(S.salv)) spend += R.SALV_PTS[Number(k.split(":")[1])] || 0;
  spend += sumUp(S.up);
  // cores: shards above what gem caches on record could give are priced as common gem caches bought with points (max 2 shards each)
  let shards = 0;
  for (const k of R.GORDER) { for (let l = 1; l < S.gemLvl[k]; l++) shards += R.SHARD_NEED[l]; shards += S.gemShards[k]; }
  const gemSrc = (P.box.gem0 || 0) * 2 + (P.box.gem1 || 0) * 4 + (P.box.gem2 || 0) * 14 + (S.g2 ? 4 : 0) + gemFree.n + (Math.floor((S.days || 0) / 7) + 1) * 2 + (S.wq && S.wq.claimed ? 4 : 0);
  if (shards > gemSrc) spend += Math.ceil((shards - gemSrc) / 2) * R.RPTS[0];
  if (spend > S.earned + 15000) why.spend = "Gear worth about " + spend.toLocaleString("en-US") + " points, " + S.earned.toLocaleString("en-US") + " earned";
  // spendable points: what the phone had, never more than lifetime points minus what that gear cost
  S.pts = Math.max(0, Math.min(Math.round(Number(C.pts) || 0), S.earned - Math.min(spend, S.earned)));
  S.mig = 1; S.migAt = X.day;
  if (Object.keys(why).length) S.migWhy = why;
  return why;
}

// ================= /api/act: claims, crates, upgrades =================
const TKS = ["gem", "weapon", "chassis"];
const riOf = (v) => ([0, 1, 2].includes(Number(v)) ? Number(v) : null);
export async function squadRows(env, pid) {
  const rows = (await dbGet(env, "players", { orderBy: '"ref"', equalTo: `"${pid}"` })) || {};
  return Object.entries(rows).slice(0, 300).map(([id, v]) => ({ id, n: v.name || "Pilot", pts: v.pts || 0, days: v.days || 0, ld: v.ld ?? null }));
}
// ---- "Join the channel": Telegram confirms the pilot is a member before the quest pays ----
// getChatMember on a channel needs the bot to be one of its admins. Until it is, Telegram answers with an error and
// the quest pays as before (true = member, false = not a member, null = can't tell)
export async function channelMember(env, user) {
  const ch = "@" + String(R.TG_URL || "").split("/").pop();
  if (!user || !user.id || ch === "@") return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ch, user_id: Number(user.id) }) });
    const j = await r.json();
    const st = j && j.ok && j.result && j.result.status;
    if (!st) return null;
    if (st === "left" || st === "kicked") return false;
    if (st === "restricted") return !!j.result.is_member;
    return true;
  } catch (e) { return null; }
}
// is the bot an admin of the channel (so the check above works)? Shown on Jake's admin sheet
export async function channelReady(env) {
  const ch = "@" + String(R.TG_URL || "").split("/").pop(), bot = String(env.BOT_TOKEN || "").split(":")[0];
  if (!bot) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ch, user_id: Number(bot) }) });
    const j = await r.json();
    return !!(j && j.ok && j.result && (j.result.status === "administrator" || j.result.status === "creator"));
  } catch (e) { return false; }
}
export async function act(env, b, user, pid, now = Date.now(), sp = "") {
  const a = String(b.a || ""), name = cleanName(user), id = String(b.id || "").slice(0, 20);
  if (a === "ms" && id === "q_tg" && (await channelMember(env, user)) === false) {
    const S = await readEco(env, pid);
    return { status: 200, body: { ok: true, out: { err: "join" }, E: pub(S) } };
  }
  if (a === "paid") {   // a Stars purchase: granted by the webhook when Telegram confirms it
    const n = String(b.n || "");
    const paid = (await dbGet(env, `starsPaid/${pid}`).catch(() => null)) || {};
    const hit = Object.values(paid).find((p) => p && p.n === n && !p.rf);
    const S = await readEco(env, pid);
    return { status: 200, body: { ok: true, out: hit && hit.o !== undefined ? { outs: hit.o || [] } : { pending: true }, E: pub(S) } };
  }
  const tk = TKS.includes(b.tk) ? b.tk : null, ri = riOf(b.ri);
  let F = null;
  if (["lab_read", "lab_save", "lab_rename", "lab_activate"].includes(a)) F = (S) => R.labAction(S, a, b);
  switch (a) {
    case "login": F = (S, X) => R.ecoLogin(S, X) || { err: "claimed" }; break;
    case "daily": F = (S, X) => R.ecoClaimDaily(S, id, X) || { err: "no" }; break;
    case "weekly": F = (S, X) => R.ecoClaimWeekly(S, id, X) || { err: "no" }; break;
    case "chest": F = (S, X) => R.ecoChest(S, X) || { err: "no" }; break;
    case "swap": F = (S, X) => { const N = R.ecoSwap(S, id, X); return N ? { id: N.id } : { err: "none" }; }; break;
    case "ms": F = (S, X) => R.ecoMsClaim(S, id, X) || { err: "no" }; break;
    case "visit": F = (S) => (R.ecoVisit(S, id, sp === "wikiread") ? { ok: 1 } : { err: "no" }); break;   // the wiki counts only from its end-of-page button
    case "pass": F = (S, X) => R.ecoClaimPass(S, b.t === "p" ? "p" : "f", Number(b.i), X) || { err: "no" }; break;
    case "crate": if (!tk || ri === null) break; F = (S, X) => R.ecoCratePts(S, tk, ri, X); break;
    case "salvage": if (tk !== "weapon" && tk !== "chassis" || !(ri === 1 || ri === 2)) break; F = (S, X) => R.ecoSalvage(S, tk, ri, X); break;
    case "tune": { const isW = !!b.w, k = String(b.k || ""), t = riOf(b.t); if (t === null || !(isW ? R.WORDER : R.CHORDER).includes(k)) break; F = (S, X) => R.ecoTune(S, isW, k, t, X); break; }
    case "up": { const k = String(b.k || ""); if (!R.UPS[k]) break; F = (S) => R.ecoUp(S, k); break; }
    case "respec": F = (S) => R.ecoRespec(S); break;
    case "squad": {
      // recruits flagged for review (a shared device or network, or anything else) don't pay out until Jake clears them
      const [rows, fh, rec] = await Promise.all([squadRows(env, pid), dbGet(env, "fh").catch(() => null), dbGet(env, `players/${pid}`).catch(() => null)]);
      const held = rows.filter((r) => fh && fh[r.id]).map((r) => r.id);
      if (fh && fh[pid]) held.push("me");
      F = (S, X) => R.ecoSquad(S, rows, X, { ref: rec && rec.ref, days: S.days }, held);
      break;
    }
  }
  if (!F) return { status: 400, body: { error: "action" } };
  // power and league follow the build and gear right away (upgrades, a reset build, tune-ups, crates)
  const t = await tx(env, pid, (S, X) => { who(S, user); const out = F(S, X); if (S.L) setLoadout(S, S.L); return { out }; }, now, { rl: 1 });
  if (t.rate) return { status: 429, body: { error: "rate" } };
  return { status: 200, body: { ok: true, out: t.out, E: pub(t.S) } };
}
