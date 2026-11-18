// Proof of play: the check an AI match result has to pass before the server scores it.
// The phone records the match twice a second (js/proof.js): every tank's position and health, the pilot's controls and
// damage. A full replay can't work across phones (iPhone and Android round floating point differently, and a 3-minute
// fight drifts apart), so the server checks the record against the game's own limits instead: how fast each tank can
// move, where the walls are, how far a shot reaches, whether the damage landed on anyone, and whether the result
// (a win, a place, a draw) is what the record shows. A made-up result needs a made-up fight that passes all of it.
// Returns {ok, why, fix (stats held to what the record shows), sig (signals for the bot-pattern flags)}.
import { LIM, RULES } from "./sim.gen.js";
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
  HZ_PAD: 1.2,      // map hazards: how far outside a strike's footprint a sampled position may be (half a second of driving, rounding)
  HZ_MINE: 10,      // samples back in which your own damage must show (the 5 s credit window: a hit right on its edge is not counted, never the other way)
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
//     spdM (your chassis and engine), st: {dmg, kills, sup, box, low} as reported; research mods (Session 6B, from the server's
//     loadout): modSpd Traction's speed boost, dashN Overdrive's dash charges, burnT how long an Inferno burn keeps dealing damage}
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
  // weather (Session 5E-2e): each round's timetable as the server seeded it (none without the server's seed). r0: the sample
  // before the round's first one
  const wxOn = !!(c.wx && Number.isInteger(c.wx.seed) && RULES.WX_MAP[c.map]), rounds = [];
  if (wxOn) { const T = c.series ? L.ROUND_T : (L.GTYPES[c.g] || {}).t || 180; let rd = c.series ? 1 : 0;
    rounds.push({ r0: -1, P: RULES.wxPlan(c.wx.seed, c.map, rd, T, !!c.wx.clear) });
    for (let s = 1; s < k && rounds.length < 6; s++) if (b[s * sz + n * 3 + 2] & 64) rounds.push({ r0: s, P: RULES.wxPlan(c.wx.seed, c.map, ++rd, T, !!c.wx.clear) }); }
  const roundAt = (s) => { let r = rounds[0]; for (const x of rounds) if (x.r0 <= s) r = x; return r; };
  // the train throws a tank along the deck and a tornado spins it out: further than it can drive. Allowed while one is live
  const shoveAt = (s, i) => { if (!wxOn) return 0; const r = roundAt(s), Pl = r.P; if (Pl.haz !== "train" && Pl.haz !== "tornado") return 0;
    const t1 = (s - r.r0) * PROOF.DT, H = RULES.WX_HZ[Pl.haz], x0 = b[(s - 1) * sz + i * 3] / 10, y0 = b[(s - 1) * sz + i * 3 + 1] / 7.5;
    for (const z of Pl.hz) { if (z.w > t1 + 1.5) break; const end = RULES.wxEnd(z); if (t1 < z.t - 0.75 || t1 > end + 1.25) continue;
      for (let tau = t1 - 1; tau <= t1 + 0.76; tau += 0.25) if (RULES.wxIn(z, Math.max(z.t, Math.min(end, tau)), x0, y0, 1.5)) return (Pl.haz === "train" ? H.shove : H.push) * 1.15; }   // only for a tank that was at the strike
    return 0; };
  // movement: no tank goes faster than the game allows (a dash, a respawn or a new round excused)
  // research mods (Session 6B): Overdrive's dash charges back to back (c.dashN), and Traction Servo's boost (c.modSpd), allowed only
  // in the samples right after a dash: the dash itself plus the boost's 2 s (FITS.mobility.traction.x.t) and one sample of slack.
  // Dashes are CHARGES (Session 6B review, gameplay 4): the phone writes the dash flag, so the record may claim a dash only when the
  // dash cooldown has given one back (c.dashCdM: the server loadout's cooldown multiplier, 15% slack), up to c.dashN at once; one run
  // of flagged samples is one burst and may spend every charge left, and only a dash backed by a charge opens Traction's window
  const dash1 = L.STAT.speed * L.DASH_SPD * L.DASH_T * 1.15, dashN = Math.max(1, Math.min(3, c.dashN || 1)), dash = dash1 * dashN, msp = Math.max(1, Math.min(2, c.modSpd || 1));
  const dashCd = (L.DASH_CD || 4) * Math.max(0.3, Math.min(2, Number(c.dashCdM) || 1)), refill = PROOF.DT / dashCd * 1.15;
  let tok = dashN, burst = 0, burstN = 0, badEdge = 0, trac = 0, down0 = 0, badBack = 0;   // trac: Traction's boost distance left (each spent charge adds the boost's 2 s); down0: the pilot's samples at 0 hull
  const respawns = c.g === 'zone' || c.g === 'crystal' || c.g === 'bounty', tracN = Math.ceil(2 / PROOF.DT);   // modes with respawns (3 s at least: Bounty), FITS traction t 2 s
  const tracWin = Math.ceil((L.DASH_T + 2) / PROOF.DT) + 1;
  const vBase = L.STAT.speed * Math.max(0.5, Math.min(2, c.spdM || 1)) * PROOF.BUFF * (1 + 0.08 * 2.25) * PROOF.SLACK * PROOF.DT, vMe = vBase + PROOF.QUANT;
  let lastDash = -1e9;
  const vAny = L.STAT.speed * 1.25 * 1.24 * PROOF.BUFF * (1 + 0.08 * 2.25) * PROOF.SLACK * PROOF.DT + PROOF.QUANT;
  let badMe = 0, badOther = 0, stepsOther = 0, moving = 0, noIn = 0, touches = 0;
  for (let s = 1; s < k; s++) {
    const fl = FL(s), round = fl & 64;
    touches += b[P(s) + 5];
    // a comeback from 0 hull without a new-round mark is a respawn only in a mode that has them, after its time (reviewer 1: a made-up
    // 0-hull sample excused the next step, a teleport). One ambiguous reading is forgiven (a hull under 0.5% rounds to 0)
    const back = HP(s - 1, 0) === 0 && HP(s, 0) > 0 && !round;
    if (back && (!respawns || down0 < 5)) badBack++;
    down0 = HP(s, 0) === 0 && !round ? down0 + 1 : 0;
    tok = round || back ? dashN : Math.min(dashN, tok + refill);   // a new round or a respawn: every charge back
    for (let i = 0; i < n; i++) {
      if (HP(s - 1, i) === 0 || round) continue;   // respawned, or a new round
      const d = Math.hypot(X(s, i) - X(s - 1, i), Y(s, i) - Y(s - 1, i));
      if (i === 0) {
        const edge = (fl & 2) && !(FL(s - 1) & 2);
        const pace = variantAt ? L.STAT.speed * Math.max(0.5, Math.min(2, variantAt(s).spdM)) * PROOF.BUFF * (1 + 0.08 * 2.25) * PROOF.SLACK * PROOF.DT : vBase;
        if (edge) { if (tok >= 1 - 0.05) { tok = Math.max(0, tok - 1); burst = dash1; burstN = 1; lastDash = s; trac += (msp - 1) * pace * tracN; } else { burst = 0; burstN = dashN; badEdge++; } }   // a dash with no charge back yet: no allowance, no Traction boost
        else if (!(fl & 2) && !(FL(s - 1) & 2)) { burst = 0; burstN = 0; }
        // Traction Servo (reviewer 1): its boost is a distance budget each spent charge adds (the boost's 2 s at most), not a time
        // window: a window longer than the dash refill let a phone keep the boost all match
        if (s - lastDash > tracWin) trac = 0;   // the boost runs out with its 2 s (and one sample of slack), whatever is left of the budget
        const tb = msp > 1 ? Math.min(trac, (msp - 1) * pace) : 0;
        const speedLimit = pace + tb + PROOF.QUANT;
        const base = speedLimit + shoveAt(s, i);   // 5E-2e's shove at a train or tornado strike
        let lim0 = base;
        if ((fl & 2) || (FL(s - 1) & 2)) {   // in a burst: the excess over the pace is paid from the burst, which may draw the charges left
          let ex = Math.max(0, d - base);
          while (ex > burst && burstN < dashN && tok >= 1 - 0.05) { tok = Math.max(0, tok - 1); burst += dash1; burstN++; lastDash = s; trac += (msp - 1) * pace * tracN; }
          const use = Math.min(ex, burst); burst -= use; lim0 = base + use;
        }
        if (tb > 0) trac = Math.max(0, trac - Math.min(tb, Math.max(0, d - (pace + PROOF.QUANT + shoveAt(s, i)))));   // the boost used this step
        if (d > lim0) badMe++;
        if (d > 0.4 && !(fl & 2)) { moving++; if (Math.hypot(IX(s), IY(s)) < 0.05 && !(fl & 1)) noIn++; }
      } else { stepsOther++; if (d > vAny + dash + shoveAt(s, i)) badOther++; }
    }
  }
  if (badMe > PROOF.MOVE_BAD) return fail("move");
  if (badBack > 1) return fail("respawn");
  if (badOther > Math.max(3, stepsOther * PROOF.OTHER_BAD)) return fail("others");
  // new-round marks: they clear the per-round super count below, so they are held to the rules for EVERY ticket (review finding:
  // tickets without bound equipment skipped this, and a made-up mark before every third press reset the count). Only a best
  // of 3 Arena has rounds, at most 5, and a round only ends with a side down or on the clock
  if (!c.variants) { let lastRound = 0, rounds = 1;
    for (let sample = 1; sample < k; sample++) if (b[sample * sz + n * 3 + 2] & 64) {
      if (!c.series || c.g !== "arena" || ++rounds > 5) return fail("rounds");
      const hp = (i) => b[(sample - 1) * sz + i * 3 + 2], down = (team) => h.every((u, i) => u[0] !== team || hp(i) <= PROOF.LAST_HP);
      if (!down(0) && !down(1) && (sample - lastRound) * PROOF.DT < L.ROUND_T - 6) return fail("rounds");
      lastRound = sample; } }
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
  // Inferno Core / Sunfire Core (Session 6B): a burn keeps dealing your damage for c.burnT seconds after the hit that set it, so a
  // burning tank may have driven out of reach by its last tick. With a burn mod, "in reach" means in reach in any sample of
  // that window (the hit that set the burn was). The sim counts a burn tick as its source's hit (game.js modTick -> takeHit
  // kind 0: st.dmg, the 5 s hazard credit), and so does this check (ruling: Checkpoint 41 "Mods and hazards")
  const burnW = Math.ceil(Math.max(0, Math.min(3, Number(c.burnT) || 0)) / PROOF.DT);
  const distTo = (s, i) => { let d = 1e9; for (let j = Math.max(0, s - burnW); j <= s; j++) d = Math.min(d, Math.hypot(X(j, i) - X(j, 0), Y(j, i) - Y(j, 0))); return d; };
  let total = 0, bad = 0, lost = 0, kills = 0, sups = 0, boxes = 0, low = 1, roundSups = 0, mostSups = 0, roundsSeen = 1;
  for (let s = 0; s < k; s++) {
    const d = DM(s), fl = FL(s);
    if (fl & 64 && s > 0) { roundSups = 0; roundsSeen++; }   // a new round clears the count (rules.js SUP_ROUND_CAP); a respawn does not
    if (fl & 8) { sups++; mostSups = Math.max(mostSups, ++roundSups); }
    if (fl & 16) boxes++;
    if (HP(s, 0) > 0 || s === 0) low = Math.min(low, HP(s, 0) / 100);
    else low = 0;
    if (d > 0) {
      total += d;
      let dmin = 1e9;
      for (let i = 1; i < n; i++) if (enemy[i] && (HP(s, i) > 0 || (s > 0 && HP(s - 1, i) > 0))) dmin = Math.min(dmin, distTo(s, i));
      let sup = false;   // a super counts for 3 s after the press: the timing bar (up to 1.2 s, Session 5E-2b) plus a Siege shell's flight (up to 1.2 s)
      for (let j = Math.max(0, s - 6); j <= s; j++) if (FL(j) & 8) sup = true;
      if (dmin > (sup ? PROOF.SUPER_REACH : L.STAT.range + PROOF.REACH)) bad += d;
    }
    if (s > 0) for (let i = 1; i < n; i++) {
      if (!enemy[i]) continue;
      const dh = HP(s - 1, i) - HP(s, i);
      if (dh > 0) lost += (dh * mhp[i]) / 100;
      if (HP(s - 1, i) > 0 && HP(s, i) === 0) { let mineHit = false; for (let j = Math.max(0, s - 4); j <= s; j++) if (DM(j) > 0) mineHit = true; if (mineHit) kills++; }
    }
  }
  // Map hazard takedowns (Session 5E-2e). The phone's record lists each takedown it counted: [sample, the tank that took the
  // hazard] (js/proof.js). The server gave this match its weather seed with the ticket, so it works out the same timetable
  // (rules.js wxPlan) and accepts a claim only if the record itself shows all of it: (1) that tank lost at least half a hazard
  // hit's worth of hull in that sample beyond everything you dealt in it (or went down to more than your own damage), (2) it stood in a live strike's footprint at that strike's time, (3) in
  // the 5 s before, there is a sample in which you dealt damage, that same tank lost health and it was within your reach, and
  // (4) one claim per strike and tank (a tornado: one per 5 s). A phone that only raises its count, or adds claims, gains
  // nothing the record does not show; a match without the server's seed has no weather at all. c.hs: the mode's hull scale.
  let td = 0; const hzKill = [];
  if (wxOn && Array.isArray(pf.hz)) {
    const seen = {}, reach = (s) => { for (let j = Math.max(0, s - 6); j <= s; j++) if (FL(j) & 8) return PROOF.SUPER_REACH; return L.STAT.range + PROOF.REACH; };
    for (const cl of pf.hz.slice(0, 400)) {
      if (!Array.isArray(cl) || !Number.isInteger(cl[0]) || !Number.isInteger(cl[1])) continue;
      const s = cl[0], i = cl[1];
      if (!(s >= 1 && s < k) || !(i >= 1 && i < n) || !enemy[i] || i === bossI) continue;
      const r = roundAt(s), Pl = r.P; if (!Pl.haz) continue;
      // (1) the hull it lost in this sample, less ALL the damage you dealt in it (to anyone) and the rounding of a health
      // reading, is at least half a hazard hit; or it went down and your own damage in the sample could not have done that
      const drop = HP(s - 1, i) - HP(s, i), unit = mhp[i] / 100, notMine = drop * unit - DM(s) - unit, hitD = Math.min(RULES.WX_HZ[Pl.haz].dmg * (c.hs || 1), RULES.WX_CAP * mhp[i]);
      if (!(drop > 0)) continue;
      if (HP(s, i) > 0 ? notMine < hitD * 0.5 : HP(s - 1, i) * unit - DM(s) < unit) continue;
      let mineHit = false;
      for (let j = Math.max(1, s - PROOF.HZ_MINE); j <= s && !mineHit; j++) if (DM(j) > 0 && HP(j - 1, i) > HP(j, i) && distTo(j, i) <= reach(j)) mineHit = true;   // a burn tick of yours counts (distTo)
      if (!mineHit) continue;
      const t1 = (s - r.r0) * PROOF.DT, late = r.r0 < 0 ? 0.26 : 0.76; let hit = null;   // the round's clock at this sample (a later round's first sample can be half a second in)
      for (const z of Pl.hz) {
        if (z.w > t1 + 1.5) break;
        const end = RULES.wxEnd(z);
        if (z.soft || end < t1 - 1) continue;
        for (let tau = t1 - 0.75; tau <= t1 + late && !hit; tau += 0.25) {
          if (tau < z.t - 0.3 || tau > end + 0.3) continue;
          const tt = Math.max(z.t, Math.min(end, tau));
          if (RULES.wxIn(z, tt, X(s, i), Y(s, i), PROOF.HZ_PAD) || RULES.wxIn(z, tt, X(s - 1, i), Y(s - 1, i), PROOF.HZ_PAD)) hit = z;
        }
        if (hit) break;
      }
      if (!hit) continue;
      const key = r.r0 + ":" + hit.id + ":" + i, last = seen[key];
      if (last !== undefined && !(hit.k === "n" && s - last >= RULES.WX_CREDIT / PROOF.DT)) continue;
      seen[key] = s; td++;
      if (HP(s, i) === 0) { let near = false; for (let j = Math.max(0, s - 4); j <= s; j++) if (DM(j) > 0) near = true; if (!near) hzKill.push(key); }   // a hazard kill credited up to 5 s after your last hit: the kill count below only looks back 2 s
    }
  }
  kills += hzKill.length;
  // supers: never more than the cap in one round (Session 5E-2b2b). The phone's sim refuses the press past the cap, so an
  // honest record cannot hold more; a record that does was not made by the game's own rules
  if (mostSups > (L.SUP_ROUND_CAP || 3)) return fail("supers");
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
  // a draw before the clock: only Arena's "both last tanks down at once" (game.js outcome), which the record must show
  if ((c.g === "arena" || c.g === "boss") && c.drawn && !c.series && simT < ((L.GTYPES[c.g] || {}).t || 180) - 6 &&
    !(c.g === "arena" && h.every((u, i) => !alive(last, i)))) return fail("result");
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
  fix.td = Math.max(0, Math.min(Math.floor(Number(st.td) || 0), td));   // hazard takedowns: never more than the record shows (none without the server's weather seed)
  { const supTop = Math.min(sups + 1, (L.SUP_ROUND_CAP || 3) * roundsSeen); if ((st.sup || 0) > supTop) fix.sup = supTop; }   // never more than the record shows, nor than 3 a round
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
  return { ok: true, fix, sig: { simT, moving, ni: moving >= 12 ? noIn / moving : 0, touches, ih: k >= PROOF.IH_N && withIn >= PROOF.IH_N / 2 ? hsh.toString(16) : null, ratio: lost > 0 ? total / lost : 0, reachBad: total ? bad / total : 0, dashBad: badEdge } };   // dashBad: dash flags with no charge back (they bought nothing)
}
