// Mods viability: every legal mod set against the field of all legal sets on the same chassis and weapon (round robin),
// equal Epic builds on both sides, standard bot pilots, all 6 maps, both spawn directions. Real server sim.
// usage: SEEDS=1 [CLS=titan] [WPN=pulse] node dev/tests/s2/mods.mjs [out.json]
import fs from 'node:fs';
import { runJobs } from './pool.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const { RULES: R } = await import('../../../worker/src/sim.gen.js?' + Date.now());
const MAPS6 = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'], SEEDS = [71, 419, 2027, 9803, 65537];
export const legalSets = () => { const o = []; for (const hull of Object.keys(R.FITS.hull)) for (const mobility of Object.keys(R.FITS.mobility)) for (const mount of Object.keys(R.FITS.mount)) {
  const m = { hull, mobility, mount }, f = R.fittingStats(m); if (f.weight <= R.FIT_BUDGET.weight && f.power <= R.FIT_BUDGET.power) o.push(m); } return o; };
export const build = (c, w, mods) => ({ ...structuredClone(R.STOCK_L), w: { a: w, t: 2, q: w === 'moon' ? 1 : 1.1, s: false }, c: { c, t: 2, q: 1.1, s: false },
  up: { hull: 3, cannon: 3, engine: 3, target: 2, reactor: 3 }, cores: ['dmg', 'rof', 'arm'], gl: { dmg: 3, rof: 3, arm: 3, spd: 3, lck: 3, reg: 3 }, mods });
const name = (m) => [m.hull, m.mobility, m.mount].join('/');
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const sets = legalSets(), seeds = SEEDS.slice(0, +(process.env.SEEDS || 1));
  const classes = process.env.CLS ? process.env.CLS.split(',') : R.CHORDER, weapons = process.env.WPN ? process.env.WPN.split(',') : R.WORDER;
  const jobs = [], meta = [];
  for (const c of classes) for (const w of weapons) for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++)
    for (const map of MAPS6) for (const seed of seeds) for (const flip of [false, true]) { jobs.push({ A: build(c, w, sets[i]), B: build(c, w, sets[j]), seed, map, flip }); meta.push([c + '/' + w, i, j]); }
  const t0 = Date.now(), res = await runJobs(jobs), agg = {};
  res.forEach((r, k) => { const [cw, i, j] = meta[k], A = (agg[cw] ||= sets.map(() => ({ n: 0, w: 0, secs: 0, taken: 0, sups: 0, hits: 0, shots: 0, dmg: 0 })));
    const add = (x, win, mine) => { x.n++; x.w += win; x.secs += r.secs; if (mine) { x.taken += r.taken; x.sups += r.sups; x.hits += r.hits; x.shots += r.shots; x.dmg += r.dmg; } };
    add(A[i], r.out, true); add(A[j], 1 - r.out, false); });
  const out = {}; let worst = [1, 0];
  for (const cw in agg) { out[cw] = {}; console.log('\n' + cw + '  (field win rate per set, n=' + agg[cw][0].n + ' duels each)');
    agg[cw].forEach((x, i) => { const wr = x.w / x.n; worst = [Math.min(worst[0], wr), Math.max(worst[1], wr)]; out[cw][name(sets[i])] = { win: +wr.toFixed(3), n: x.n, secs: +(x.secs / x.n).toFixed(1) };
      console.log('  ' + name(sets[i]).padEnd(28), (wr * 100).toFixed(1).padStart(5) + '%', 'secs', (x.secs / x.n).toFixed(0)); }); }
  console.log('\nrange', (worst[0] * 100).toFixed(1), '-', (worst[1] * 100).toFixed(1), '%;', jobs.length, 'duels in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ sets: sets.map(name), out }, null, 1));
}
