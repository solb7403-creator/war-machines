// Legendary balance (item 2): controlled equipment comparisons on the real server sim, standard bot pilot on both sides,
// identical builds except what is tested. Reference = fully maxed Epic: best Epic rolls (1.10), full 14-level build,
// Lv5 cores, the best mod set. All 6 maps, both spawn directions, SEEDS seeds each.
// usage: SEEDS=10 [TESTS=kit,moon,skin,...] node dev/tests/s2/legend.mjs [out.json]
import fs from 'node:fs';
import { runJobs } from './pool.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const { RULES: R } = await import('../../../worker/src/sim.gen.js?' + Date.now());
export const MAPS6 = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'];
export const seedList = (n) => [71, 419, 2027, 9803, 65537, ...Array.from({ length: Math.max(0, n - 5) }, (_, i) => 100003 + i * 7919)].slice(0, n);
export const B14 = { hull: 4, cannon: 4, engine: 2, target: 2, reactor: 2 };
export const BEST_MODS = JSON.parse(process.env.MODS || 'null') || { hull: 'stock', mobility: 'stable', mount: 'firing' };
const gl = (lv) => ({ dmg: lv, rof: lv, arm: lv, spd: lv, lck: lv, reg: lv });
export const kit = ({ w = 'siege', wq = 1.1, wt = 2, c = 'titan', ct = 2, cq = 1.1, skin = false, up = B14, lv = 5, mods = BEST_MODS, glv = null } = {}) =>
  ({ ...structuredClone(R.STOCK_L), w: { a: w, t: w === 'moon' ? 2 : wt, q: w === 'moon' ? 1 : wq, s: false }, c: { c, t: ct, q: cq, s: false }, up: { ...up }, cores: ['dmg', 'rof', 'arm'], gl: glv || gl(lv), skin: skin ? 'lunar' : 'default', mods });
export async function compare(pairs, seeds) {
  const jobs = [], meta = [];
  pairs.forEach(([A, B], k) => { for (const map of MAPS6) for (const seed of seedList(seeds)) for (const flip of [false, true]) { jobs.push({ A, B, seed, map, flip }); meta.push(k); } });
  const r = await runJobs(jobs), out = pairs.map(() => ({ n: 0, w: 0 }));
  r.forEach((x, i) => { out[meta[i]].n++; out[meta[i]].w += x.out; });
  return out.map((o) => ({ n: o.n, win: +(o.w / o.n).toFixed(3) }));
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const S = +(process.env.SEEDS || 10), tests = (process.env.TESTS || 'weapons,kit,moon,skin,buyers').split(','), W = process.env.EPICW || 'siege', res = {};
  const full = kit({ w: 'moon', skin: true });
  const show = (k, v) => { res[k] = v; console.log(k.padEnd(44), (v.win * 100).toFixed(1) + '%', 'n=' + v.n); };
  if (tests.includes('weapons')) { const r = await compare(R.WORDER.flatMap((a) => R.WORDER.filter((b) => b > a).map((b) => [kit({ w: a }), kit({ w: b })])), S);
    let i = 0; for (const a of R.WORDER) for (const b of R.WORDER.filter((b) => b > a)) show('epic ' + a + ' vs epic ' + b + ' (Titan)', r[i++]); }
  if (tests.includes('kit')) { const r = await compare(R.CHORDER.map((c) => [full, kit({ w: W, c })]), S);
    R.CHORDER.forEach((c, i) => show('full kit vs maxed Epic ' + c, r[i])); show('full kit vs maxed Epic, class average', { n: r.reduce((a, x) => a + x.n, 0), win: +(r.reduce((a, x) => a + x.win, 0) / 3).toFixed(3) }); }
  if (tests.includes('moon')) { const r = await compare([[kit({ w: 'moon' }), kit({ w: W })]], S * 3); show('Moonbeam alone vs best Epic weapon', r[0]); }
  if (tests.includes('skin')) { const r = await compare([[kit({ w: W, skin: true }), kit({ w: W })]], S * 3); show('Lunar Skin alone vs none', r[0]); }
  if (tests.includes('buyers')) {   // what most buyers face: an average-roll Epic (1.075) and a rare-geared pilot, same build and cores
    const r = await compare(R.CHORDER.flatMap((c) => [[full, kit({ w: W, c, wq: 1.075, cq: 1.075 })], [full, kit({ w: W, c, wt: 1, ct: 1, wq: 1.075, cq: 1.075 })]]), S);
    show('full kit vs average-roll Epic (class avg)', { n: r[0].n * 3, win: +((r[0].win + r[2].win + r[4].win) / 3).toFixed(3) });
    show('full kit vs rare-geared (class avg)', { n: r[1].n * 3, win: +((r[1].win + r[3].win + r[5].win) / 3).toFixed(3) }); }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
}
