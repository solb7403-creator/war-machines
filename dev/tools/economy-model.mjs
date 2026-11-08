// LUNAR economy planning model (Phase 0 of the World, Resources & Airdrop Points session).
// Deterministic and read-only: reads js/rules.js, the measured Arcade league grid and the shared kit ladder; never talks to
// a server, a save, Firebase or game state. It produces every table in docs/economy/RESOURCE_ECONOMY.md.
// Every Conquest, mineral, plating and yield number below is a PROPOSAL awaiting owner approval, not live game data.
// usage: node dev/tools/economy-model.mjs            print the tables (markdown)
//        node dev/tools/economy-model.mjs --write    also write docs/economy/economy-model.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GEAR } from '../tests/combat-sim.mjs';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = f => fs.readFileSync(path.join(repo, f), 'utf8');
// The real shared rules. The tankOf shim adds a hull-HP multiplier (L.__hp) so plating is measured with the real power fit.
const R = new Function(read('js/rules.js') + `;
 const __tankOf = tankOf;
 tankOf = function (L, n) { const T = __tankOf(L, n); if (L.__hp) T.mhp = Math.round(T.mhp * L.__hp); return T; };
 return { LEAGUE, LG_BASE_PAY, LG_MULT, DAILY_CAP, MODES, teamX, isSolo, ROYALE_PTS, streakPts, powerOf, powerWin, STOCK_L, POWER_K_LIVE };`)();

// ===================================================================================================================
// PROPOSAL (owner decisions applied; everything else is the lead's proposal)
// ===================================================================================================================
export const P = {
  dailyCap: 50000,            // owner: 20,000 -> 50,000 base points a UTC day, one cap shared by Arcade, PvP and Conquest
  conquest: {
    refPpm: 225,              // Conquest pay per par minute at Rookie (Arcade stock kit at Rookie measures 223, standard pilot)
    danger: { STANDARD: 1, HARD: 1.2, VETERAN: 1.45 },
    // value: base points per verified outcome at Rookie, before the league factor and the Command Base multiplier.
    // par: ordinary-pace minutes including travel and banking (existing models: field 120 s, HARD raid 200 s).
    activities: {
      kill_light: { label: 'World kill: interceptor or saboteur', value: 35, par: 0.16 },
      kill_heavy: { label: 'World kill: heavy sentinel or fire coordinator', value: 90, par: 0.41 },
      field: { label: 'Field mission completed (any of the six)', value: 450, par: 2.0 },
      raid_hard: { label: 'Raid victory, HARD', value: 900, par: 3.33 },
      raid_veteran: { label: 'Raid victory, VETERAN', value: 1300, par: 4.0 },
      defense: { label: 'Defense victory (Command Base or sector)', value: 675, par: 2.5 },
      strike: { label: 'Meteor Strike secured', value: 1075, par: 4.0 },
      gather_fe: { label: 'Harvest a Ferrite Regolith deposit', value: 100, par: 0.6 },
      gather_il: { label: 'Harvest an Ilmenite deposit', value: 140, par: 0.85 },
      gather_ar: { label: 'Harvest an Armalcolite deposit (HARD zone)', value: 240, par: 1.2 },
      gather_tq: { label: 'Harvest a Tranquillityite deposit (VETERAN zone)', value: 390, par: 1.6 },
    },
    baseMult: [1, 1.05, 1.10, 1.15, 1.20, 1.25],   // no base, Command Base I..V (owner: about x1.25 at the top)
  },
  // Daily Base Yield: what one full 24 h fill holds, by Command Base tier (index 0 = no base). CP keeps today's
  // production formula (ConquestCombat.baseProduction); it fills continuously instead of a once-a-day claim.
  yield: {
    pts: [0, 1000, 1400, 1800, 2200, 2600],
    alloy: [0, 6, 9, 12, 15, 18], biomass: [0, 4, 6, 8, 10, 12], helium: [0, 1, 1, 2, 2, 3],
    fe: [0, 6, 8, 10, 12, 14], il: [0, 0, 1, 1, 2, 2],
  },
  minerals: [
    { id: 'fe', name: 'Ferrite Regolith', rarity: 'common' },
    { id: 'il', name: 'Ilmenite', rarity: 'uncommon' },
    { id: 'ar', name: 'Armalcolite', rarity: 'rare' },
    { id: 'tq', name: 'Tranquillityite', rarity: 'very rare' },
    { id: 'se', name: 'Selenite Glass', rarity: 'epic' },
    { id: 'mh', name: 'Moonheart', rarity: 'legendary' },
  ],
  deposits: {   // the populated war region (6 sectors). yield: average units a harvest; channel: seconds held in place
    fe: { nodes: 36, yield: 3, channel: 5, respawnMin: 20, where: 'open ground within 40 m of routes, every sector' },
    il: { nodes: 18, yield: 2, channel: 8, respawnMin: 45, where: 'basalt flows off the routes: Helium Basin, Western Salvage Reach, Ash approaches' },
    ar: { nodes: 10, yield: 1.5, channel: 12, respawnMin: 180, where: 'crater walls and Parasite territory: Ash Redoubt, Refuge Ridge, Oxygen Spear outer walls' },
    tq: { nodes: 5, yield: 1, channel: 16, respawnMin: 480, where: 'contested sites: raid-site perimeters and hive edges (VETERAN zones)', seVein: 0.03 },
  },
  starterVein: 35,              // one-time guided Ferrite deposit beside the Refuge (first-session hook)
  opMinerals: {                 // minerals in an operation's reward cache (victory only)
    field: { fe: 3, il: 0.5 }, raid_hard: { il: 2, ar: 0.4 }, raid_veteran: { ar: 1.5, tq: 0.3 }, defense: { fe: 2, il: 1 },
  },
  strike: { everyMin: 120, telegraphMin: 5, windowMin: 20, guaranteed: { il: 2, ar: 2, tq: 0.5 }, se: 0.15, mh: 0.025, resonance: { se: 12, mh: 40 } },
  arcade: {                     // per server-verified Arcade/PvP result (AI tickets and live rooms alike)
    win: { fe: 1.5, il: 0.2, ar: 0.015 }, draw: { fe: 1, il: 0.1 }, loss: { fe: 0.5 },
    matchMin: 1.75, winRate: 0.62, drawRate: 0.10,
    // weekly league reward for 20+ verified Arcade/PvP matches that week (the competitive session finalizes these)
    weekly: [{ fe: 20 }, { fe: 30, il: 5 }, { fe: 40, il: 10, ar: 1, tq: 0.25 }, { il: 12, ar: 3, tq: 0.25 }, { il: 15, ar: 5, tq: 0.5 }, { ar: 6, tq: 1 }, { ar: 8, tq: 2 }],
  },
  plating: {
    slots: ['FRONT', 'LEFT', 'RIGHT', 'TURRET'],
    hp: [0, 0.01, 0.0175, 0.025, 0.03, 0.035, 0.04],    // max hull HP per plate, by tier (index 0 = no plate)
    cost: [null, { fe: 40, pts: 300 }, { il: 40, fe: 20, pts: 1500 }, { ar: 30, il: 20, pts: 4000 },
      { tq: 20, ar: 15, pts: 8000 }, { se: 6, tq: 10, pts: 15000 }, { mh: 3, se: 4, pts: 25000 }],
    traits: { 5: { energy: 0.10 }, 6: { energy: 0.10, area: 0.10 } },   // full-set traits (all four plates at that tier or better)
    // share of incoming damage that is energy / area, used only to estimate the traits' power value (Moonbeam exempt)
    energyShare: 0.35, areaShare: 0.15,
  },
};
const TIER_NAMES = ['none', ...P.minerals.map(m => m.name)];
const MIN_IDS = P.minerals.map(m => m.id);

// ===================================================================================================================
// 1. Arcade points a minute, measured (same formula as dev/tests/s2/ppm.mjs: match + 20 s of screens, streak bonus)
// ===================================================================================================================
const GRID = JSON.parse(read('docs/launch/s2data/league-grid-standard.json'));
function rawPpm(sc, cell) {
  const [g, m] = sc.split(' '), p = cell.win, secs = cell.secs + 20;
  let pts;
  if (R.isSolo(g)) { const pl = Math.max(1, Math.min(6, cell.place || 3.5)), lo = Math.floor(pl), hi = Math.ceil(pl), f = pl - lo; pts = R.ROYALE_PTS[lo - 1] * (1 - f) + R.ROYALE_PTS[hi - 1] * f; }
  else { const M = R.MODES[m], x = R.teamX(g, m, g === 'arena' && m === '1v1'); let es = 0, q = 1; for (let k = 1; k <= 5; k++) { q *= p; es += q * (k < 5 ? 1 - p : 1) * R.streakPts(g, m, k); } pts = p * M.win * x + (1 - p) * M.loss * x + es; }
  return pts / (secs / 60);
}
const KITS = ['stock', 'common', 'rare', 'epic', 'legend'];
const LGS = R.LEAGUE.map((_, i) => i);
const arcadePpm = {};
for (const k of KITS) { arcadePpm[k] = LGS.map(lg => { const S = GRID[lg].standard, scs = Object.keys(S); return scs.reduce((a, sc) => a + rawPpm(sc, S[sc][k]), 0) / scs.length * R.LG_BASE_PAY[lg]; }); }
// the kit that settles in each league (docs/launch/LEAGUES.md "Where each kit settles"; Ace and Elite sit between)
const SETTLED = ['stock', 'common', 'rare', 'rare', 'epic', 'epic', 'legend'];

// ===================================================================================================================
// 2. Conquest points a minute, modeled. A kit clears par faster (speed) and takes harder content (mix of time shares).
//    speed: whole-cycle speed vs a stock kit. Weapon TTK alone (docs/conquest-living-war/weapon-ttk.json): Moonbeam kills
//    a sentinel 1.68x faster than a stock Pulse; ~45% of a cycle is travel/banking, so a Moonbeam-only cycle is ~1.29x;
//    the full legend kit also survives longer (fewer repair trips). Phase 1 replaces these with scripted-pilot timings.
// ===================================================================================================================
const KIT_MODEL = {
  stock: { speed: 1.00, mix: { field: .50, kill_light: .12, kill_heavy: .03, gather_fe: .17, gather_il: .08, defense: .05, strike: .05 } },
  common: { speed: 1.05, mix: { field: .35, raid_hard: .10, kill_light: .10, kill_heavy: .05, gather_fe: .15, gather_il: .10, defense: .10, strike: .05 } },
  rare: { speed: 1.12, mix: { field: .15, raid_hard: .30, kill_light: .08, kill_heavy: .07, gather_fe: .08, gather_il: .10, gather_ar: .07, defense: .10, strike: .05 } },
  epic: { speed: 1.25, mix: { field: .05, raid_hard: .20, raid_veteran: .20, kill_light: .05, kill_heavy: .10, gather_il: .05, gather_ar: .10, gather_tq: .05, defense: .10, strike: .10 } },
  legend: { speed: 1.40, mix: { raid_hard: .05, raid_veteran: .40, kill_light: .05, kill_heavy: .10, gather_ar: .08, gather_tq: .07, defense: .10, strike: .15 } },
};
const A = P.conquest.activities;
function conquestRaw(kit) {   // base points a minute at Rookie, no Command Base
  const K = KIT_MODEL[kit]; let sum = 0, share = 0;
  for (const [id, f] of Object.entries(K.mix)) { sum += f * A[id].value / A[id].par; share += f; }
  if (Math.abs(share - 1) > 1e-9) throw Error('mix for ' + kit + ' must sum to 1');
  return sum * K.speed;
}
const conquestPpm = {};
for (const k of KITS) conquestPpm[k] = LGS.map(lg => P.conquest.baseMult.map(b => conquestRaw(k) * R.LG_BASE_PAY[lg] * b));

// ===================================================================================================================
// 3. Hull Plating: power (gear rating) with the real power fit. Traits are valued as effective HP (estimate).
// ===================================================================================================================
const setHp = t => 4 * P.plating.hp[t];
function traitEhp(t) { const T = P.plating.traits[t]; if (!T) return 1; return 1 / (1 - (T.energy || 0) * P.plating.energyShare - (T.area || 0) * P.plating.areaShare); }
const platingPower = [1, 2, 3, 4, 5, 6].map(t => {
  const row = { tier: t, name: TIER_NAMES[t], setHp: setHp(t), traits: P.plating.traits[t] || null };
  for (const k of ['stock', 'legend']) { const L = GEAR[k], p0 = R.powerOf(L), p1 = R.powerOf({ ...L, __hp: (1 + setHp(t)) * traitEhp(t) }); row[k] = { p0, p1, gain: p1 / p0 - 1, liveWin: R.powerWin(p1, p0, 0, true) }; }
  return row;
});
const legendNoSkin = { ...GEAR.legend, skin: 'default' }, legendNoMoon = { ...GEAR.legend, w: { a: 'pulse', t: 2, q: 1.1, s: false } };
const reference = {
  lunarSkin: { gain: R.powerOf(GEAR.legend) / R.powerOf(legendNoSkin) - 1, liveWin: R.powerWin(R.powerOf(GEAR.legend), R.powerOf(legendNoSkin), 0, true) },
  moonbeam: { gain: R.powerOf(GEAR.legend) / R.powerOf(legendNoMoon) - 1, liveWin: R.powerWin(R.powerOf(GEAR.legend), R.powerOf(legendNoMoon), 0, true) },
};

// ===================================================================================================================
// 4. Minerals by player profile, day by day, with greedy fabrication (lowest slot first). Assumptions are explicit.
// ===================================================================================================================
const PROFILES = {
  conquest: { label: 'Regular, Conquest-focused', cq: 45, ar: 0, base: [2, 4, 7, 12, 20] },
  mixed: { label: 'Regular, mixed (30 Conquest + 15 Arcade)', cq: 30, ar: 15, base: [3, 6, 10, 17, 28] },
  arcade: { label: 'Regular, Arcade/PvP only', cq: 0, ar: 45, base: null },
  dedicated: { label: 'Dedicated, Conquest-focused', cq: 150, ar: 0, base: [1, 1.5, 2.5, 4, 6] },
};
const ramp = (d, from, full) => d < from ? 0 : d >= full ? 1 : 0.5;   // access to harder zones as gear improves
const baseTier = (pr, d) => pr.base ? pr.base.filter(x => d >= x).length : 0;
const arcadeLeague = d => d < 7 ? 0 : d < 21 ? 1 : d < 56 ? 2 : 3;   // a regular Arcade pilot's league over time (estimate)
function dayIncome(pr, d) {
  const inc = Object.fromEntries(MIN_IDS.map(k => [k, 0])), add = (o, x = 1) => { for (const [k, v] of Object.entries(o)) inc[k] += v * x; };
  const m = pr.cq;
  if (m > 0) {
    const aAr = ramp(d, 3, 8), aTq = ramp(d, 14, 30), aVet = ramp(d, 30, 45);
    // gathering: a quarter of Conquest time, shared across the tiers the player can reach
    const g = 0.25 * m, sh = { fe: 0.45, il: 0.30, ar: 0.17 * aAr, tq: 0.08 * aTq }, tot = Object.values(sh).reduce((a, b) => a + b, 0);
    for (const k of ['fe', 'il', 'ar', 'tq']) {
      const D = P.deposits[k], gid = 'gather_' + k, minutes = g * sh[k] / tot;
      const harvests = Math.min(minutes / A[gid].par, D.nodes * Math.max(1, m / D.respawnMin));
      inc[k] += harvests * D.yield; if (k === 'tq') inc.se += harvests * D.seVein;
    }
    // operations: 45% of Conquest time
    const ops = 0.45 * m, mix = d < 1 ? { field: 1 } : d < 7 ? { field: .5, raid_hard: .5 } : d < 30 ? { field: .2, raid_hard: .6, defense: .2 } : { raid_hard: .4 * (1 - aVet) + .1, raid_veteran: .4 * aVet + .1 * (1 - aVet), defense: .2, field: .3 * (1 - aVet) + .0 };
    const mixTot = Object.values(mix).reduce((a, b) => a + b, 0);
    for (const [id, f] of Object.entries(mix)) {
      const n = ops * (f / mixTot) / A[id].par, win = id === 'raid_hard' ? (d < 7 ? 0.7 : 0.9) : id === 'raid_veteran' ? 0.8 : 1;
      add(P.opMinerals[id], n * win);
    }
    // Meteor Strikes: one every everyMin, contestable for windowMin after impact
    const strikes = Math.min(1440 / P.strike.everyMin, (m + P.strike.windowMin) / P.strike.everyMin), ok = d < 7 ? 0.6 : d < 21 ? 0.85 : 0.95, s = strikes * ok;
    add(P.strike.guaranteed, s); inc.se += s * (P.strike.se + 1 / P.strike.resonance.se); inc.mh += s * (P.strike.mh + 1 / P.strike.resonance.mh);
    // Daily Base Yield (collected once a day at the base)
    const bt = baseTier(pr, d); inc.fe += P.yield.fe[bt]; inc.il += P.yield.il[bt];
  }
  if (pr.ar > 0) {
    const n = pr.ar / P.arcade.matchMin, w = n * P.arcade.winRate, dr = n * P.arcade.drawRate, l = n - w - dr;
    add(P.arcade.win, w); add(P.arcade.draw, dr); add(P.arcade.loss, l);
    if (n * 7 >= 20) add(P.arcade.weekly[arcadeLeague(d)], 1 / 7);   // 20+ verified matches a week
  }
  if (d === 0 && m > 0) inc.fe += P.starterVein;
  return inc;
}
function simulate(pr, days = 900) {
  const bag = Object.fromEntries(MIN_IDS.map(k => [k, 0])), slots = [0, 0, 0, 0], first = {}, full = {}; let fees = 0;
  for (let d = 0; d < days; d++) {
    const inc = dayIncome(pr, d); for (const k of MIN_IDS) bag[k] += inc[k];
    for (let guard = 0; guard < 24; guard++) {
      const lo = Math.min(...slots); if (lo >= 6) break; const i = slots.indexOf(lo), C = P.plating.cost[lo + 1];
      if (!Object.entries(C).every(([k, v]) => k === 'pts' || bag[k] >= v)) break;
      for (const [k, v] of Object.entries(C)) { if (k === 'pts') fees += v; else bag[k] -= v; }
      slots[i] = lo + 1; const t = lo + 1; if (first[t] === undefined) first[t] = d + 1; if (slots.every(s => s >= t)) full[t] = d + 1;
    }
  }
  return { first, full, fees, after: Object.fromEntries(MIN_IDS.map(k => [k, Math.round(bag[k] * 10) / 10])) };
}
const timelines = Object.fromEntries(Object.entries(PROFILES).map(([k, pr]) => [k, { label: pr.label, ...simulate(pr) }]));
const dailyIncome = Object.fromEntries(Object.entries(PROFILES).map(([k, pr]) => [k, Object.fromEntries([1, 10, 45].map(d => [d, Object.fromEntries(Object.entries(dayIncome(pr, d)).map(([m, v]) => [m, Math.round(v * 100) / 100]))]))]));

// ===================================================================================================================
// 5. First hour of a new Conquest pilot (stock kit, Rookie, ordinary pace). Durations follow the existing Conquest
//    models (field 2 min, HARD raid 3.3 min, starter wins 7 of 10 HARD raids) plus the new gathering and fabrication.
// ===================================================================================================================
const CP_FIRST = { field: { 'oxygen-line': 250, convoy: 140, relay: 130, recon: 100, rescue: 150, redoubt: 220 } };
const FIRST_HOUR = [
  [2, 'Arrive at the Refuge. War visible; first patrol skirmish (2 interceptors)', { pts: 70, cp: 14 }],
  [2, 'Hold the Oxygen Line (first field mission)', { pts: 450, cp: 250, fe: 3, mission: 1 }],
  [1, 'Bank salvage at the Refuge terminal', {}],
  [4, 'Guided: scanner pulse, the Starter Vein and a roadside deposit; a patrol answers the noise', { pts: 100 + 100 + 35, fe: P.starterVein + 3 }],
  [2, 'Intercept the Parasite Convoy', { pts: 450, cp: 140, fe: 3, il: 1 }],
  [1, 'Bank at the Refuge; fabricate the FRONT Ferrite plate (40 Ferrite + 300 points) - visible on the hull', { fePlate: 1, pts: -300 }],
  [2, 'Sabotage the Relay', { pts: 450, cp: 130, fe: 3 }],
  [2, 'Signal Recovery (recon) + a roadside deposit on the way', { pts: 450 + 100, cp: 100, fe: 3 + 3, il: 1 }],
  [2, 'Rescue / Extraction', { pts: 450, cp: 150, fe: 3 }],
  [3, 'Break the Redoubt (sixth field mission): raids unlock', { pts: 450 + 90, cp: 220, fe: 3, il: 1 }],
  [2, 'Engineering rank 1 x2 at Refuge Supply (100 CP + 4 alloy each)', { cp: -200 }],
  [14, 'Four HARD raids (3 won, 1 lost) + world kills between them', { pts: 3 * 900 + 6 * 35 + 2 * 90, cp: 3 * 200 + 120, il: 6, ar: 1 }],
  [5, 'Two Ferrite deposits and an Ilmenite deposit; bank', { pts: 340, fe: 6, il: 2 }],
  [8, 'Two more HARD raids (both won) + replays of two field missions', { pts: 2 * 900 + 2 * 450, cp: 2 * 220 + 2 * 75, il: 4 + 1, ar: 1, fe: 6 }],
  [3, 'Return to the build site; the Command Base I goal shows the exact remaining cost', {}],
];
function firstHour() {
  let t = 0, pts = 0, cp = 0, fe = 0, il = 0, ar = 0, plates = 0; const rows = [];
  for (const [mins, what, g] of FIRST_HOUR) {
    t += mins; pts += g.pts || 0; cp += g.cp || 0; fe += g.fe || 0; il += g.il || 0; ar += g.ar || 0;
    if (g.fePlate) { fe -= P.plating.cost[1].fe; plates++; }
    if (fe < 0 || pts < 0 || cp < 0) throw Error('first hour spends more than it has at minute ' + t);
    rows.push({ minute: t, what, pts, cp, fe, il, ar, plates });
  }
  return rows;
}
const hour = firstHour();
// Command Base I (2,550 CP + materials; CP binds in every existing model): extend the last segment's CP rate
const [h2, h1] = [hour.at(-2), hour.at(-3)], cpRate = (h2.cp - h1.cp) / (h2.minute - h1.minute);
const firstBaseMinute = Math.round(hour.at(-1).minute + Math.max(0, 2550 - hour.at(-1).cp) / cpRate);

// ===================================================================================================================
// Output
// ===================================================================================================================
const r0 = x => Math.round(x), pct = x => (x * 100).toFixed(1) + '%', daysTxt = d => d === undefined ? '2.5+ yr' : d < 14 ? d + ' d' : d < 60 ? (d / 7).toFixed(1) + ' wk' : (d / 30.4).toFixed(1) + ' mo';
const out = [];
out.push('## Points a minute (base points = airdrop points), standard pilot\n');
out.push('| League | Kit settled there | Arcade (measured) | Conquest, no base | Conquest, Base III | Conquest, Base V |');
out.push('|---|---|---:|---:|---:|---:|');
for (const lg of LGS) { const k = SETTLED[lg]; out.push(`| ${R.LEAGUE[lg].n} | ${k} | ${r0(arcadePpm[k][lg])} | ${r0(conquestPpm[k][lg][0])} | ${r0(conquestPpm[k][lg][3])} | ${r0(conquestPpm[k][lg][5])} |`); }
out.push('\nMinutes to the 50,000 cap at those rates: ' + LGS.map(lg => R.LEAGUE[lg].n + ' ' + r0(P.dailyCap / arcadePpm[SETTLED[lg]][lg]) + ' / ' + r0(P.dailyCap / conquestPpm[SETTLED[lg]][lg][5])).join(' · ') + ' (Arcade / Conquest Base V)');
out.push('\n## Conquest point values (base points at Rookie, before league x Command Base)\n');
out.push('| Activity | Base points | Par min | Per par minute |'); out.push('|---|---:|---:|---:|');
for (const a of Object.values(A)) out.push(`| ${a.label} | ${a.value} | ${a.par} | ${r0(a.value / a.par)} |`);
out.push('\n## Hull Plating set strength (real power fit)\n');
out.push('| Full set | Max HP | Trait | Power gain, stock kit | Power gain, legend kit | Live win vs same tank without it |'); out.push('|---|---:|---|---:|---:|---:|');
for (const p of platingPower) out.push(`| ${p.name} | +${pct(p.setHp)} | ${p.traits ? Object.entries(p.traits).map(([k, v]) => '-' + v * 100 + '% ' + k).join(', ') : '-'} | +${pct(p.stock.gain)} | +${pct(p.legend.gain)} | ${pct(p.legend.liveWin)} |`);
out.push(`| (reference) Lunar Skin | | | | +${pct(reference.lunarSkin.gain)} | ${pct(reference.lunarSkin.liveWin)} |`);
out.push(`| (reference) Moonbeam vs Epic Pulse | | | | +${pct(reference.moonbeam.gain)} | ${pct(reference.moonbeam.liveWin)} |`);
out.push('\n## Time to each full armor set (first plate in brackets)\n');
out.push('| Profile | ' + [1, 2, 3, 4, 5, 6].map(t => TIER_NAMES[t]).join(' | ') + ' |'); out.push('|---|' + '---:|'.repeat(6));
for (const T of Object.values(timelines)) out.push(`| ${T.label} | ` + [1, 2, 3, 4, 5, 6].map(t => `${daysTxt(T.full[t])} (${daysTxt(T.first[t])})`).join(' | ') + ' |');
out.push('\n## Daily mineral income (day 1 / day 10 / day 45)\n');
out.push('| Profile | ' + P.minerals.map(m => m.name).join(' | ') + ' |'); out.push('|---|' + '---:|'.repeat(6));
for (const [k, D] of Object.entries(dailyIncome)) out.push(`| ${PROFILES[k].label} | ` + MIN_IDS.map(m => [1, 10, 45].map(d => D[d][m]).join(' / ')).join(' | ') + ' |');
out.push('\n## First hour (new pilot, stock kit, Rookie)\n');
out.push('| Minute | What happens | Points | CP | Ferrite | Ilmenite | Armalcolite | Plates |'); out.push('|---:|---|---:|---:|---:|---:|---:|---:|');
for (const h of hour) out.push(`| ${h.minute} | ${h.what} | ${h.pts} | ${h.cp} | ${h.fe} | ${h.il} | ${h.ar} | ${h.plates} |`);
out.push(`\nCommand Base I (2,550 CP binds): about minute ${firstBaseMinute} at the last segment's CP rate (modeled).`);
console.log(out.join('\n'));

if (process.argv.includes('--write')) {
  const model = {
    generatedBy: 'dev/tools/economy-model.mjs', status: 'PROPOSAL for owner approval (Phase 0); modeled, not playtested',
    proposal: P, kitModel: KIT_MODEL, arcadePpm, conquestPpm, settled: SETTLED, platingPower, reference, timelines, dailyIncome, firstHour: hour, firstBaseMinute,
  };
  fs.mkdirSync(path.join(repo, 'docs/economy'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/economy/economy-model.json'), JSON.stringify(model, (k, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v, 1) + '\n');
  console.log('\nwrote docs/economy/economy-model.json');
}
