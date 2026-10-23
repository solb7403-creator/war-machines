// The economy on the server. Every point and every piece of gear a pilot has lives in eco/<pid> and changes only here.
// The phone says what happened (a match ticket and its result, a claim, a crate to open); the server runs the shared
// rules (js/rules.js, bundled as RULES) on its own copy and sends its record back. Points are never taken from the phone.
// Writes are conditional (Firebase ETags): read, change, write only if nobody else wrote in between, else retry.
import { RULES as R, createSim } from "./sim.gen.js";
import { dayOf, weekOf, hex, hmac, dbUrl, dbGet, dbPatch, cleanName } from "./db.js";

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
};
let MAPS = null;
const mapList = () => MAPS || (MAPS = createSim({ ev() {}, end() {}, round() {}, death() {} }).R.MAP_REAL);
export const ctxOf = (pid, now) => ({ day: dayOf(now), week: weekOf(now), rnd: Math.random, pk: pid });
const safeKey = (s) => String(s).replace(/[.#$\[\]\/|]/g, "_").slice(0, 100);

// ---- conditional reads and writes ----
async function readTag(env, path) {
  const r = await fetch(dbUrl(env, path), { headers: { "X-Firebase-ETag": "true" } });
  if (!r.ok) throw new Error("db get " + path + " " + r.status);
  return { v: await r.json(), tag: r.headers.get("ETag") || "" };
}
async function writeIf(env, path, value, tag) {
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
  const rec = await dbGet(env, `players/${pid}`).catch(() => null);
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
  const v = await dbGet(env, `eco/${pid}`).catch(() => null);
  const S = v ? R.ecoNorm(v) : await freshEco(env, pid);
  delete S._new;
  return S;
}
// run fn(S, X) on the pilot's record and save it, all or nothing. fn may run more than once (if another write lands
// first), so it must only change S. Return {abort: true} to save nothing.
export async function tx(env, pid, fn, now = Date.now()) {
  for (let i = 0; i < 8; i++) {
    const { v, tag } = await readTag(env, `eco/${pid}`);
    const S = v ? R.ecoNorm(v) : await freshEco(env, pid);
    const isNew = !!S._new; delete S._new;
    const X = ctxOf(pid, now);
    R.ecoRoll(S, X);
    const before = { d: S.dailyPts, w: S.weeklyPts };
    const out = (await fn(S, X)) || {};
    if (out.abort) return { ...out, S, X };
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
    wins: S.wins, losses: S.losses, mp: S.mp, power: S.pw, league: S.lg, name: S.nm, seen: now, pvm: S.pvm, pvw: S.pvw, pvd: S.pvd, pvl: S.pvl, pvs: S.pvs };
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null) up[`${P}/${k}`] = v;
  if (S.dailyPts !== before.d || isNew) up[`dly/${S.dailyDay}/${pid}`] = { s: S.dailyPts, n: S.nm || "Pilot" };
  if (S.weeklyPts !== before.w || isNew) up[`wly/${S.weeklyNum}/${pid}`] = { s: S.weeklyPts, n: S.nm || "Pilot" };
  if (isNew) up["meta/n"] = { ".sv": { increment: 1 } };
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
  const rows = (await dbGet(env, "gh", { orderBy: '"pw"', startAt: lo, endAt: hi, limitToFirst: 60 }).catch(() => null)) || {};
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
export function pub(S) { const E = {}; for (const k of R.ECO_KEYS) if (S[k] !== undefined) E[k] = S[k]; return E; }
// the loadout a pilot fields, from what they own; power and league from that
export function setLoadout(S, raw) { const L = R.ecoLoadout(S, raw); S.L = L; S.pw = R.powerOf(L); S.lg = R.powerBracket(S.pw).key; return L; }

// ---- flags ----
export const flagReasons = (f) => (f && f.r ? Object.keys(f.r).filter((k) => !(f.ok && f.ok[k] >= (f.r[k].t || 0))) : []);
export const isFlagged = (f) => flagReasons(f).length > 0;
export async function addFlags(env, pid, name, list, now = Date.now()) {
  if (!list || !list.length) return;
  const up = { [`flags/${pid}/n`]: name || "Pilot" };
  for (const [k, v] of list) up[`flags/${pid}/r/${safeKey(k)}`] = { t: now, v: v === undefined ? 1 : v };
  await dbPatch(env, "", up);
}
// flags raised inside a transaction: each reason once per pilot (clearing it stops it coming back)
function raise(S, list, k, v) { S.fl = S.fl || {}; if (S.fl[k]) return; S.fl[k] = 1; list.push([k, v]); }
const bits = (n) => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };
// per-pilot play stats for the anomaly flags: m = {ai, won, secs, pts, fast}
function watch(S, m, X, now) {
  const A = S.an && S.an.d === X.day ? S.an : { ...(S.an || {}), d: X.day, m: 0, h: 0 };
  if (m.fast) A.fast = (A.fast || 0) + 1;
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
  return out;
}

// ================= AI matches: a ticket at the start, the result with it at the end =================
const sign = async (env, s) => hex(await hmac(env.BOT_TOKEN, "match|" + s)).slice(0, 24);
export async function matchStart(env, b, user, pid, now = Date.now()) {
  const g = String(b.g || ""), m = String(b.m || ""), map = String(b.map || "");
  if (!R.GT_ORDER.includes(g)) return { status: 400, body: { error: "mode" } };
  if (g !== "royale" && !R.MODES[m]) return { status: 400, body: { error: "mode" } };
  if (!mapList().includes(map)) return { status: 400, body: { error: "map" } };
  const n = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, "0")).join("");
  const pw0 = await dbGet(env, `players/${pid}/power`).catch(() => null);
  const ghosts = await pickGhosts(env, pid, Number(pw0) || 0, Number(pw0) > 0 ? ghostSeats(g, m) : 0, now);
  const t = await tx(env, pid, (S, X) => {
    S.nm = cleanName(user);
    const L = setLoadout(S, b.L), brk = R.powerBracket(S.pw);
    // one open ticket per pilot: a new one replaces the last (that match can't be scored any more)
    S.mt = { n, g, m: g === "royale" ? "1v1" : m, map, t0: now, feat: g === R.featuredOn(X.day), quick: !!b.quick,
      series: g === "arena" && m === "1v1" && (S.mp || 0) > 0, mult: brk.mult, lg: brk.key, pw: S.pw, gh: ghosts.map((x) => x.id) };
    return { lg: brk.key, mult: brk.mult, power: S.pw, L };
  }, now);
  // ghosts go to the phone by seat number only (never the owner's id)
  return { status: 200, body: { ok: true, tok: n + "." + (await sign(env, `${pid}|${n}|${now}`)), league: t.lg, mult: t.mult, power: t.power, E: pub(t.S),
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
  let flags = [];
  const t = await tx(env, pid, async (S, X) => {
    S.nm = cleanName(user);
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
    flags = watch(S, { ai: true, won, secs, pts: p.pts }, X, now);
    return { ghr, res: keep({ pts: p.pts, awarded: p.awarded, streak: p.streak, streakBonus: p.streakBonus, base: p.base, modeX: p.modeX, featX: p.featX, mult: T.mult }) };
  }, now);
  if (flags.length) await addFlags(env, pid, t.S.nm, flags, now);
  if (t.ghr && t.ghr.length) await ghostReport(env, t.ghr, now).catch(() => {});
  const res = t.dup || t.res;
  if (t.err === "ticket" && !t.dup) return { status: 200, body: { ok: false, error: "ticket", E: pub(t.S) } };
  if (res && res.err) return { status: 200, body: { ok: false, error: res.err, E: pub(t.S) } };
  return { status: 200, body: { ok: true, res, dup: !!t.dup, E: pub(t.S) } };
}

// ================= live matches: the room credits the result itself =================
// calc(S) gets the record and returns {pts, pvs, sb, won, drawn, m: the match for quests and stats (or m.quit)}
export async function creditMatch(env, pid, name, calc, now = Date.now()) {
  let flags = [];
  const t = await tx(env, pid, (S, X) => {
    if (name) S.nm = name;
    const c = calc(S) || {};
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
    const daysIn = X.day - (R.PASS_START + (pass.s - 1) * R.PASS_LEN) + 1;
    Object.assign(pass, { xp: Math.max(0, Math.min(Number(C.pass.xp) || 0, daysIn * 4000)), prem: !!C.pass.prem, cf: C.pass.cf.slice(0, 30), cp: C.pass.cp.slice(0, 30) });
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
  for (const [list, tr] of [[pass.cf, R.PASS_FREE], [pass.cp, R.PASS_PREM]]) for (const i of list) { const r = tr[i]; if (r && r.k === "box") { if (r.tk === "gem") gemFree.n += r.ri ? 4 : 2; else free[r.tk][r.ri]++; } }
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
  const gemSrc = (P.box.gem0 || 0) * 2 + (P.box.gem1 || 0) * 4 + (P.box.gem2 || 0) * 9 + gemFree.n + (Math.floor((S.days || 0) / 7) + 1) * 2 + (S.wq && S.wq.claimed ? 4 : 0);
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
export async function act(env, b, user, pid, now = Date.now()) {
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
  switch (a) {
    case "login": F = (S, X) => R.ecoLogin(S, X) || { err: "claimed" }; break;
    case "daily": F = (S, X) => R.ecoClaimDaily(S, id, X) || { err: "no" }; break;
    case "weekly": F = (S, X) => R.ecoClaimWeekly(S, id, X) || { err: "no" }; break;
    case "chest": F = (S, X) => R.ecoChest(S, X) || { err: "no" }; break;
    case "swap": F = (S, X) => { const N = R.ecoSwap(S, id, X); return N ? { id: N.id } : { err: "none" }; }; break;
    case "ms": F = (S, X) => R.ecoMsClaim(S, id, X) || { err: "no" }; break;
    case "visit": F = (S) => (R.ecoVisit(S, id) ? { ok: 1 } : { err: "no" }); break;
    case "pass": F = (S, X) => R.ecoClaimPass(S, b.t === "p" ? "p" : "f", Number(b.i), X) || { err: "no" }; break;
    case "crate": if (!tk || ri === null) break; F = (S, X) => R.ecoCratePts(S, tk, ri, X); break;
    case "salvage": if (tk !== "weapon" && tk !== "chassis" || !(ri === 1 || ri === 2)) break; F = (S, X) => R.ecoSalvage(S, tk, ri, X); break;
    case "tune": { const isW = !!b.w, k = String(b.k || ""), t = riOf(b.t); if (t === null || !(isW ? R.WORDER : R.CHORDER).includes(k)) break; F = (S, X) => R.ecoTune(S, isW, k, t, X); break; }
    case "up": { const k = String(b.k || ""); if (!R.UPS[k]) break; F = (S) => R.ecoUp(S, k); break; }
    case "respec": F = (S) => R.ecoRespec(S); break;
    case "squad": {
      // recruits flagged for review (a shared device or network, or anything else) don't pay out until Jake clears them
      const [rows, fl, rec] = await Promise.all([squadRows(env, pid), dbGet(env, "flags").catch(() => null), dbGet(env, `players/${pid}`).catch(() => null)]);
      const held = rows.filter((r) => isFlagged(fl && fl[r.id])).map((r) => r.id);
      if (isFlagged(fl && fl[pid])) held.push("me");
      F = (S, X) => R.ecoSquad(S, rows, X, { ref: rec && rec.ref, days: S.days }, held);
      break;
    }
  }
  if (!F) return { status: 400, body: { error: "action" } };
  // power and league follow the build and gear right away (upgrades, a reset build, tune-ups, crates)
  const t = await tx(env, pid, (S, X) => { S.nm = name; const out = F(S, X); if (S.L) setLoadout(S, S.L); return { out }; }, now);
  return { status: 200, body: { ok: true, out: t.out, E: pub(t.S) } };
}
