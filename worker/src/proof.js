// Proof of play: the check an AI match result has to pass before the server scores it.
// The phone records the match twice a second (js/proof.js): every tank's position and health, the pilot's controls and
// damage. A full replay can't work across phones (iPhone and Android round floating point differently, and a 3-minute
// fight drifts apart), so the server checks the record against the game's own limits instead: how fast each tank can
// move, where the walls are, how far a shot reaches, whether the damage landed on anyone, and whether the result
// (a win, a place, a draw) is what the record shows. A made-up result needs a made-up fight that passes all of it.
// Returns {ok, why, fix (stats held to what the record shows), sig (signals for the bot-pattern flags)}.
import { LIM } from "./sim.gen.js";
const lim = () => LIM;   // the game's fixed limits, worked out at build time (worker/build-sim.mjs)

export const PROOF = {
  DT: 0.5,           // seconds per sample (js/proof.js PROOF_DT)
  MAX: 1600,         // samples (a 5-round best of 3 is ~900 s)
  BUFF: 1.6,         // two speed boxes at once
  SLACK: 1.12,       // on top of the fastest a tank can go
  QUANT: 0.3,        // position rounding (x 0.1, y 0.13), both ends of a step
  MOVE_BAD: 3,       // your tank: steps faster than possible before the record fails
  OTHER_BAD: 0.03,   // the other tanks: share of steps faster than possible
  WALL_BAD: 3,       // samples inside a wall
  REACH: 3.5,        // past weapon range a shot can still land (bullet travel, splash, rounding)
  SUPER_REACH: 23,   // a super lands this far (Moonfall beam 20 + rounding)
  REACH_BAD: 0.15,   // share of damage dealt with nobody in reach
  HIT_X: 1.6, HIT_PLUS: 900,   // your damage vs health the enemies lost (shields soak some; allies add some)
  DMG_PLUS: 700, DMG_X: 0.03,  // reported damage vs the record (the last half second isn't sampled)
  IH_N: 60,         // the controls fingerprint: your first 30 seconds of input (a script replaying its moves gives the same one)
  LAST_HP: 30,      // in the last sample, a tank under this much health (%) can be the one that went down at the end
};
function decode(pf) {
  if (!pf || typeof pf !== "object" || pf.v !== 1 || typeof pf.s !== "string" || !Array.isArray(pf.h)) return null;
  const n = pf.n | 0;
  if (n < 2 || n > 6 || pf.h.length !== n) return null;
  let raw;
  try { raw = atob(pf.s); } catch (e) { return null; }
  const sz = n * 3 + 6, k = Math.floor(raw.length / sz);
  if (raw.length !== k * sz || k < 4 || k > PROOF.MAX) return null;
  const b = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) b[i] = raw.charCodeAt(i);
  return { n, sz, k, b, h: pf.h.map((u) => (Array.isArray(u) ? u.map((x) => Number(x) || 0) : [0, 0, 0, 0])), f: pf.f && typeof pf.f === "object" ? pf.f : {} };
}
const unitsFor = (L, g, m) => (g === "royale" ? 6 : g === "boss" ? (L.MODES[m] || L.MODES["1v1"]).n + 1 : 2 * (L.MODES[m] || L.MODES["1v1"]).n);
// c: {g, m, map, secs (ticket to result, wall clock), won, drawn, place, series, min (fastest believable win, s),
//     spdM (your chassis and engine), st: {dmg, kills, sup, box, low} as reported}
// how long the recorded fight lasted (match seconds) and whether fast forward ran (x3 while you're down), or null for no
// usable record. The server uses it to place a result in time when the ticket came late or never arrived (eco.matchEnd)
export function proofSpan(pf) {
  const D = decode(pf);
  if (!D) return null;
  let ffw = false;
  for (let s = 0; s < D.k; s++) if (D.b[s * D.sz + D.n * 3 + 2] & 128) { ffw = true; break; }
  return { simT: D.k * PROOF.DT, ffw };
}
export function checkProof(pf, c) {
  const L = lim(), D = decode(pf), fail = (why, extra) => ({ ok: false, why, fix: {}, sig: extra || {} });
  if (!D) return fail("norec");
  const { n, sz, k, b, h } = D;
  // the tanks in the record have to be the ones this mode puts on the field
  if (n !== unitsFor(L, c.g, c.m) || (h[0][3] & 4) !== 4 || h[0][0] !== 0) return fail("roster");
  const mine = h.map((u) => u[0] === 0), bossI = h.findIndex((u) => u[3] & 1);
  if (c.g === "boss" && (bossI < 1 || h[bossI][0] !== 1)) return fail("roster");
  if (c.g !== "royale" && mine.filter(Boolean).length !== (c.g === "boss" ? n - 1 : n / 2)) return fail("roster");
  // Lab tickets bind every permitted class to the equipment frozen at start.
  let variantAt = null;
  if (c.variants) {
    const initial = c.variants.find(v => v.ci === h[0][1] && v.mhp === h[0][2]);
    if (!initial) return fail("loadout");
    const changes = pf.cs || [];
    if (!Array.isArray(changes) || changes.length > 4 || (!c.series && changes.length)) return fail("chassis");
    let lastRound=0, rounds=1;
    for(let sample=1;sample<k;sample++)if(b[sample*sz+n*3+2]&64){
      if(!c.series||c.g!=='arena'||++rounds>5)return fail("chassis");
      const hp=i=>b[(sample-1)*sz+i*3+2];
      const down=team=>h.every((u,i)=>u[0]!==team||hp(i)<=PROOF.LAST_HP);
      if(!down(0)&&!down(1)&&(sample-lastRound)*PROOF.DT<L.ROUND_T-6)return fail("chassis");
      lastRound=sample;
    }
    const points = [[0, initial]]; let prev = 0;
    for (const x of changes) {
      if (!Array.isArray(x) || x.length !== 2 || !Number.isInteger(x[0]) || x[0] <= prev || x[0] >= k || !(b[x[0]*sz+n*3+2] & 64)) return fail("chassis");
      const v = c.variants.find(v => v.ci === x[1]); if (!v) return fail("chassis");
      points.push([x[0], v]); prev = x[0];
    }
    variantAt = sample => { let v=initial; for (const [at,next] of points) { if(at>sample)break; v=next; } return v; };
  }
  const mhp = h.map((u, i) => Math.max(1, Math.min(i === bossI ? 400000 : L.STAT.hp * 4, u[2] || 1)));
  const X = (k2, i) => b[k2 * sz + i * 3] / 10, Y = (k2, i) => b[k2 * sz + i * 3 + 1] / 7.5, HP = (k2, i) => b[k2 * sz + i * 3 + 2];
  const P = (k2) => k2 * sz + n * 3, FL = (k2) => b[P(k2) + 2], DM = (k2) => (b[P(k2) + 3] << 8) | b[P(k2) + 4];
  const IX = (k2) => (b[P(k2)] - 100) / 100, IY = (k2) => (b[P(k2) + 1] - 100) / 100;
  const simT = k * PROOF.DT;
  let ffw = false;
  for (let s = 0; s < k; s++) if (FL(s) & 128) { ffw = true; break; }
  // time: the fight can't be longer than the clock it took (fast forward runs x3 while you're down)
  if (simT > (ffw ? c.secs * 3 : c.secs) + 8) return fail("time");
  if (c.won && simT < c.min * 0.75) return fail("fast");
  // movement: no tank goes faster than the game allows (a dash, a respawn or a new round excused)
  const dash = L.STAT.speed * L.DASH_SPD * L.DASH_T * 1.15;
  const vMe = L.STAT.speed * Math.max(0.5, Math.min(2, c.spdM || 1)) * PROOF.BUFF * (1 + 0.08 * 2.25) * PROOF.SLACK * PROOF.DT + PROOF.QUANT;
  const vAny = L.STAT.speed * 1.25 * 1.24 * PROOF.BUFF * (1 + 0.08 * 2.25) * PROOF.SLACK * PROOF.DT + PROOF.QUANT;
  let badMe = 0, badOther = 0, stepsOther = 0, moving = 0, noIn = 0, touches = 0;
  for (let s = 1; s < k; s++) {
    const fl = FL(s), round = fl & 64;
    touches += b[P(s) + 5];
    for (let i = 0; i < n; i++) {
      if (HP(s - 1, i) === 0 || round) continue;   // respawned, or a new round
      const d = Math.hypot(X(s, i) - X(s - 1, i), Y(s, i) - Y(s - 1, i));
      if (i === 0) {
        const speedLimit = variantAt ? L.STAT.speed * Math.max(0.5, Math.min(2, variantAt(s).spdM)) * PROOF.BUFF * (1 + 0.08 * 2.25) * PROOF.SLACK * PROOF.DT + PROOF.QUANT : vMe;
        const lim0 = speedLimit + ((fl & 2) || (FL(s - 1) & 2) ? dash : 0);
        if (d > lim0) badMe++;
        if (d > 0.4 && !(fl & 2)) { moving++; if (Math.hypot(IX(s), IY(s)) < 0.05 && !(fl & 1)) noIn++; }
      } else { stepsOther++; if (d > vAny + dash) badOther++; }
    }
  }
  if (badMe > PROOF.MOVE_BAD) return fail("move");
  if (badOther > Math.max(3, stepsOther * PROOF.OTHER_BAD)) return fail("others");
  // walls: your tank never sits inside one (the Overpass deck is a level, not a wall)
  const M = L.MAPS[c.map] || {}, br = M.bridge, inR = (x, y, r, e) => x > r[0] + e && x < r[0] + r[2] - e && y > r[1] + e && y < r[1] + r[3] - e;
  let inWall = 0;
  for (let s = 0; s < k; s++) {
    if (HP(s, 0) === 0) continue;
    const x = X(s, 0), y = Y(s, 0);
    if (br && (inR(x, y, br.deck, -0.5) || br.ramps.some((r) => inR(x, y, r, -0.5)))) continue;
    if ((M.walls || []).some((w) => inR(x, y, w, 0.2)) || (M.rocks || []).some((r) => Math.hypot(x - r[0], y - r[1]) < r[2] * 0.55)) inWall++;
  }
  if (inWall > PROOF.WALL_BAD) return fail("walls");
  // damage: what you report matches the record, it was dealt with an enemy in reach, and the enemies lost that health
  const enemy = h.map((u, i) => i > 0 && (c.g === "royale" ? true : u[0] !== h[0][0]));
  let total = 0, bad = 0, lost = 0, kills = 0, sups = 0, boxes = 0, low = 1;
  for (let s = 0; s < k; s++) {
    const d = DM(s), fl = FL(s);
    if (fl & 8) sups++;
    if (fl & 16) boxes++;
    if (HP(s, 0) > 0 || s === 0) low = Math.min(low, HP(s, 0) / 100);
    else low = 0;
    if (d > 0) {
      total += d;
      let dmin = 1e9;
      for (let i = 1; i < n; i++) if (enemy[i] && (HP(s, i) > 0 || (s > 0 && HP(s - 1, i) > 0))) dmin = Math.min(dmin, Math.hypot(X(s, i) - X(s, 0), Y(s, i) - Y(s, 0)));
      let sup = false;
      for (let j = Math.max(0, s - 4); j <= s; j++) if (FL(j) & 8) sup = true;
      if (dmin > (sup ? PROOF.SUPER_REACH : L.STAT.range + PROOF.REACH)) bad += d;
    }
    if (s > 0) for (let i = 1; i < n; i++) {
      if (!enemy[i]) continue;
      const dh = HP(s - 1, i) - HP(s, i);
      if (dh > 0) lost += (dh * mhp[i]) / 100;
      if (HP(s - 1, i) > 0 && HP(s, i) === 0) { let mineHit = false; for (let j = Math.max(0, s - 4); j <= s; j++) if (DM(j) > 0) mineHit = true; if (mineHit) kills++; }
    }
  }
  const rep = Math.max(0, Number(c.st.dmg) || 0);
  if (rep > total + PROOF.DMG_PLUS + total * PROOF.DMG_X) return fail("dmg");
  if (total > 600 && bad > total * PROOF.REACH_BAD) return fail("reach");
  if (total > lost * PROOF.HIT_X + PROOF.HIT_PLUS) return fail("nohit");
  // the result: a win means the enemies are down at the end, a Last Standing place means that many were still alive
  // the last sample can come up to half a second before the final hit (older phones don't take a closing sample):
  // a tank that was nearly gone by then counts as down
  const last = k - 1, alive = (s, i) => HP(s, i) > (s === last ? PROOF.LAST_HP : 0);
  if ((c.g === "arena" || c.g === "boss") && c.won) {
    const left = c.g === "boss" ? [bossI].filter((i) => alive(last, i)) : h.map((u, i) => i).filter((i) => enemy[i] && alive(last, i));
    // Arena also ends on the clock: then the side with more tanks up (or, level, more health) wins
    let r0 = 0;
    for (let s = 0; s < k; s++) if (FL(s) & 64) r0 = s;
    const roundT = (k - 1 - r0) * PROOF.DT, clock = c.series ? L.ROUND_T : (L.GTYPES.arena || {}).t || 180;
    let timeWin = false;
    if (c.g === "arena" && left.length && roundT >= clock - 6) {
      const side = (mineSide) => h.map((u, i) => i).filter((i) => (mineSide ? !enemy[i] : enemy[i]));
      const up = (ids) => ids.filter((i) => HP(last, i) > 0).length, hpf = (ids) => ids.reduce((a, i) => a + (HP(last, i) * mhp[i]) / 100, 0) / Math.max(1, ids.reduce((a, i) => a + mhp[i], 0));
      const me = side(true), them = side(false);
      timeWin = up(me) > 0 && (up(me) > up(them) || (up(me) === up(them) && hpf(me) >= hpf(them) - 0.05));
    }
    if (left.length && !timeWin) return fail("result");
  }
  if ((c.g === "arena" || c.g === "boss") && c.drawn && !c.series && simT < ((L.GTYPES[c.g] || {}).t || 180) - 6) return fail("result");
  if (c.g === "royale") {
    let kd = -1;
    for (let s = 1; s < k; s++) if (alive(s - 1, 0) && !alive(s, 0)) { kd = s; break; }
    const others = (s) => h.map((u, i) => i).filter((i) => i > 0 && alive(s, i)).length;
    if (c.place === 1 && others(last) > 0) return fail("result");
    if (c.place > 1 && kd > 0 && c.place < others(kd)) return fail("result");
  }
  // the result passes. Stats held to what the record shows (quests read them)
  const st = c.st, fix = {};
  if ((st.kills || 0) > kills + 1) fix.kills = kills + 1;
  if ((st.sup || 0) > sups + 1) fix.sup = sups + 1;
  if ((st.box || 0) > boxes + 1) fix.box = boxes + 1;
  if (typeof st.low === "number" && st.low > low + 0.03) fix.low = Math.round(low * 1000) / 1000;
  // signals for the bot-pattern flags: did you move without touching the controls, and how your inputs look
  let withIn = 0, hsh = 2166136261 >>> 0;
  for (let s = 0; s < Math.min(k, PROOF.IH_N); s++) {
    const ix = IX(s), iy = IY(s), mg = Math.hypot(ix, iy);
    if (mg > 0.1) withIn++;
    const q = mg < 0.1 ? 0 : 1 + (((Math.round((Math.atan2(iy, ix) / (Math.PI * 2)) * 16) % 16) + 16) % 16) * 3 + (mg > 0.9 ? 2 : mg > 0.5 ? 1 : 0);
    hsh = Math.imul(hsh ^ q, 16777619) >>> 0;
  }
  return { ok: true, fix, sig: { simT, moving, ni: moving >= 12 ? noIn / moving : 0, touches, ih: k >= PROOF.IH_N && withIn >= PROOF.IH_N / 2 ? hsh.toString(16) : null, ratio: lost > 0 ? total / lost : 0, reachBad: total ? bad / total : 0 } };
}
