// Session 5D acceptance grid: every league x every arcade mode x the gear ladder, on the REAL phone code (combat-sim.mjs),
// seeded, all six maps. Reports win rate, damage dealt / taken, and AI vs pilot ability use (supers, dashes, shields a minute).
// usage: [PILOTS=standard,casual,expert,human] [SEEDS=2] [LGS=0,..,6] [MODES="arena 1v1,..."] [COMBAT_SRC=<checkout>] node dev/tests/fair-arcade-grid.mjs out.json
import fs from 'node:fs';
import { runJobs } from './s2/pool.mjs';
import { GEAR } from './combat-sim.mjs';
export const MODES5D = [['arena', '1v1'], ['arena', '2v2'], ['arena', '3v3'], ['bounty', '1v1'], ['bounty', '2v2'], ['boss', '1v1'], ['royale', '1v1']];
export const SEEDS = [71, 419, 2027, 9803, 65537, 1201, 3307, 7919];
export const MAPS6 = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'];
export const KITS = ['stock', 'common', 'rare', 'epic', 'legend'];
export async function fairGrid({ pilots = ['standard'], lgs = [0, 1, 2, 3, 4, 5, 6], modes = MODES5D, kits = KITS, seeds = 2, patch = '' } = {}) {
  const jobs = [], keys = [];
  for (const lg of lgs) for (const [g, m] of modes) for (const k of kits) for (const p of pilots) for (const map of MAPS6) for (const seed of SEEDS.slice(0, seeds)) {
    jobs.push({ kind: 'ai', cfg: { g, m, map, seed, mp: 50, L: GEAR[k], pilot: p, lg, dt: 1 / 30 } }); keys.push([p, lg, g + ' ' + m, k]);
  }
  const res = await runJobs(jobs, { patch }), T = {};
  res.forEach((r, i) => {
    const [p, lg, s, k] = keys[i], c = (((T[p] ||= {})[lg] ||= {})[s] ||= {})[k] ||= { n: 0, w: 0, dmg: 0, taken: 0, secs: 0, place: 0, meSup: 0, meDash: 0, aiSup: 0, aiDash: 0, aiShield: 0, foeMin: 0, meMin: 0, aiSupGap: 1e9, aiDashGap: 1e9, aiShieldGap: 1e9, aiSupLowSp: 1e9, aiDashCd: 0, aiShieldCd: 0 };
    c.n++; c.w += r.out; c.dmg += r.dmg; c.taken += r.taken; c.secs += r.secs; c.place += r.place || 0; c.kills = (c.kills || 0) + (r.kills || 0); c.deaths = (c.deaths || 0) + (r.deaths || 0);
    const a = r.ab; c.meSup += a.meSup; c.meDash += a.meDash; c.aiSup += a.aiSup; c.aiDash += a.aiDash; c.aiShield += a.aiShield; c.foeMin += a.foeMin; c.meMin += a.meMin;
    c.aiSupGap = Math.min(c.aiSupGap, a.aiSupGap); c.aiDashGap = Math.min(c.aiDashGap, a.aiDashGap); c.aiShieldGap = Math.min(c.aiShieldGap, a.aiShieldGap); c.aiSupLowSp = Math.min(c.aiSupLowSp, a.aiSupLowSp); c.aiDashCd = Math.max(c.aiDashCd, a.aiDashCd); c.aiShieldCd = Math.max(c.aiShieldCd, a.aiShieldCd);
  });
  for (const p in T) for (const lg in T[p]) for (const s in T[p][lg]) for (const k in T[p][lg][s]) {
    const c = T[p][lg][s][k];
    Object.assign(c, { win: +(c.w / c.n).toFixed(3), ratio: +(c.taken / Math.max(1, c.dmg)).toFixed(3), dmg: Math.round(c.dmg / c.n), taken: Math.round(c.taken / c.n), secs: Math.round(c.secs / c.n), place: +(c.place / c.n).toFixed(2),
      // a minute of one tank's life: the pilot's own rate, and the enemy AI pilots' rate per tank
      meSupPM: +(c.meSup / Math.max(0.01, c.meMin)).toFixed(2), meDashPM: +(c.meDash / Math.max(0.01, c.meMin)).toFixed(2), aiSupPM: +(c.aiSup / Math.max(0.01, c.foeMin)).toFixed(2), aiDashPM: +(c.aiDash / Math.max(0.01, c.foeMin)).toFixed(2), aiShieldPM: +(c.aiShield / Math.max(0.01, c.foeMin)).toFixed(2) });
  }
  return T;
}
export const LGN = ['Rookie', 'Pilot', 'Veteran', 'Ace', 'Elite', 'Master', 'Lunar Legend'];
export function printGrid(T) {
  for (const p in T) { console.log('pilot', p);
    for (const lg in T[p]) { console.log(' league', LGN[lg]);
      for (const s in T[p][lg]) { const row = T[p][lg][s]; console.log('  ' + s.padEnd(11), KITS.map(k => row[k] ? (row[k].win * 100).toFixed(0).padStart(4) + '%' : '    -').join(''), ' taken/dealt', KITS.map(k => row[k] ? row[k].ratio.toFixed(2) : '-').join(' '), ' AI sup/min', KITS.map(k => row[k] ? row[k].aiSupPM : '-').join(' '), ' me', KITS.map(k => row[k] ? row[k].meSupPM : '-').join(' ')); } } }
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const t0 = Date.now();
  const T = await fairGrid({ pilots: (process.env.PILOTS || 'standard').split(','), seeds: +(process.env.SEEDS || 2), lgs: process.env.LGS ? process.env.LGS.split(',').map(Number) : undefined, modes: process.env.MODES ? process.env.MODES.split(',').map(x => x.trim().split(' ')) : undefined });
  printGrid(T);
  console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(0), 's');
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(T));
}
