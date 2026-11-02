// Gear score data (item 3): random kit pairs from stock to full Legendary (classes, rarities, rolls, upgrade spreads, core
// types and levels, mods, Lunar Skin), each measured on the real server sim (Arena 1v1 single round, standard bot pilots,
// all 6 maps, both spawn directions). Writes the kits, their features (from the rules tables) and measured win rates.
// usage: PAIRS=160 SEEDS=8 node dev/tests/s2/power-pairs.mjs out.json
import fs from 'node:fs';
import { runJobs } from './pool.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const { RULES: R, createSim } = await import('../../../worker/src/sim.gen.js?' + Date.now());
const SUP = createSim({ ev() {}, end() {}, round() {}, death() {} }).R.SUP;
const MAPS6 = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'];
const rng = R.rng32(+(process.env.SEED || 777)), pick = (a) => a[(rng() * a.length) | 0];
const sets = []; for (const hull of Object.keys(R.FITS.hull)) for (const mobility of Object.keys(R.FITS.mobility)) for (const mount of Object.keys(R.FITS.mount)) { const m = { hull, mobility, mount }, f = R.fittingStats(m); if (f.weight <= 3 && f.power <= 3) sets.push(m); }
export function randKit(stage) {   // stage 0..1: how far along a pilot is (gear, levels, cores grow with it, with noise)
  const s = Math.max(0, Math.min(1, stage + (rng() - 0.5) * 0.3));
  const tierOf = () => { const x = s * 3 + (rng() - 0.5) * 1.2; return x < 0.5 ? -1 : x < 1.4 ? 0 : x < 2.3 ? 1 : 2; };
  const wt = tierOf(), ct = tierOf(), q = () => +(1.05 + rng() * 0.05).toFixed(3);
  const moon = s > 0.75 && rng() < 0.35, skin = s > 0.7 && rng() < 0.35;
  const w = moon ? { a: 'moon', t: 2, q: 1, s: false } : { a: pick(R.WORDER), t: Math.max(0, wt), q: wt < 0 ? 1 : q(), s: false };
  const c = { c: pick(R.CHORDER), t: Math.max(0, ct), q: ct < 0 ? 1 : q(), s: false };
  const lv = Math.round(s * 14 * (0.7 + rng() * 0.3)), up = { hull: 0, cannon: 0, engine: 0, target: 0, reactor: 0 };
  for (let i = 0; i < lv; i++) { const ks = R.UORDER.filter((k) => up[k] < 4); if (!ks.length) break; const k = rng() < 0.5 ? pick(['hull', 'cannon'].filter((k) => up[k] < 4).concat(ks)) : pick(ks); up[k]++; }
  const types = R.GORDER.slice().sort(() => rng() - 0.5), cores = rng() < 0.5 ? ['dmg', 'rof', 'arm'] : types.slice(0, 3);
  const gl = {}; for (const k of R.GORDER) gl[k] = Math.max(1, Math.min(5, Math.round(1 + s * 4 * (0.6 + rng() * 0.5))));
  const mods = s < 0.15 && rng() < 0.6 ? {} : pick(sets);
  return { ...structuredClone(R.STOCK_L), w, c, up, cores, gl, skin: skin ? 'lunar' : 'default', mods };
}
export function features(L) {   // everything powerOf may use, from the shared stat block
  const t = R.tankOf(L, 1), g = (k) => (t.gems.includes(k) ? R.GEM[k].amt * t.gemM[k] : 0), F = R.fittingStats(L.mods);
  return { hp: t.mhp, arm: Math.min(0.7, g('arm')), dps: t.wdps * t.dmgM * (1 + g('dmg')) * (1 + g('rof')), crit: R.CRIT_BASE + t.critB + g('lck'), edge: t.wedge || R.GRAZE,
    sup: SUP[t.wtype].dmg * (t.wmult || R.TIER_MULT[Math.max(0, t.wtier)]) * t.dmgM * (1 + g('dmg')), fill: t.fillM, spd: t.spdM * (1 + g('spd')), reg: g('reg'), cls: t.cls, w: t.wtype,
    turn: t.turnM, supTk: t.supTk || 1, hitChg: t.hitChg || 1, pspd: t.wpspd, dashCd: t.dashCdM || 1, shieldCd: t.shieldCdM || 1, power: R.powerOf(L) };
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const N = +(process.env.PAIRS || 160), seeds = [71, 419, 2027, 9803, 65537, 1201, 3307, 7919, 104729, 5381, 7, 13, 17, 23, 29, 31, 37, 41, 43, 47].slice(0, +(process.env.SEEDS || 8)), pairs = [];
  while (pairs.length < N) { const s1 = rng(), A = randKit(s1), B = randKit(rng() < 0.7 ? s1 + (rng() - 0.5) * 0.3 : rng()), d = Math.abs(Math.log(R.powerOf(A) / R.powerOf(B)));
    if (d < 0.45 || rng() < 0.25) pairs.push([A, B]); }
  const jobs = [], meta = [];
  pairs.forEach(([A, B], k) => { for (const map of MAPS6) for (const seed of seeds) for (const flip of [false, true]) { jobs.push({ A, B, seed, map, flip }); meta.push(k); } });
  const t0 = Date.now(), r = await runJobs(jobs), agg = pairs.map(() => [0, 0]);
  r.forEach((x, i) => { agg[meta[i]][0] += x.out; agg[meta[i]][1]++; });
  const out = pairs.map(([A, B], k) => ({ A, B, fA: features(A), fB: features(B), n: agg[k][1], win: agg[k][0] / agg[k][1] }));
  fs.writeFileSync(process.argv[2], JSON.stringify(out));
  console.log(pairs.length, 'pairs,', jobs.length, 'duels in', ((Date.now() - t0) / 1000).toFixed(0), 's');
}
