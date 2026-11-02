// Legendary balance (item 2): controlled equipment comparisons on the real server sim, standard bot pilot on both sides,
// identical builds except what is tested. Reference = fully maxed Epic: best Epic rolls (1.10), full 14-level build,
// Lv5 cores, the best mod set. All 6 maps, both spawn directions, SEEDS seeds each.
// usage: SEEDS=10 [TESTS=kit,moon,skin,...] node dev/tests/s2/legend.mjs [out.json]
import fs from 'node:fs';
import { runJobs } from './pool.mjs';
import { humanPatch } from './human.mjs';
export const PILOT = process.env.PILOT || 'human';   // human (default: the equipment comparisons) or standard (the old bot duels)
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const { RULES: R } = await import('../../../worker/src/sim.gen.js?' + Date.now());
export const MAPS6 = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'];
export const seedList = (n) => [71, 419, 2027, 9803, 65537, ...Array.from({ length: Math.max(0, n - 5) }, (_, i) => 100003 + i * 7919)].slice(0, n);
export const B14 = { hull: 4, cannon: 4, engine: 2, target: 2, reactor: 2 };
export const BEST_MODS = JSON.parse(process.env.MODS || 'null') || { hull: 'plates', mobility: 'sprint', mount: 'stock' };
const gl = (lv) => ({ dmg: lv, rof: lv, arm: lv, spd: lv, lck: lv, reg: lv });
export const kit = ({ w = 'siege', wq = 1.1, wt = 2, c = 'titan', ct = 2, cq = 1.1, skin = false, up = B14, lv = 5, mods = BEST_MODS, glv = null } = {}) =>
  ({ ...structuredClone(R.STOCK_L), w: { a: w, t: w === 'moon' ? 2 : wt, q: w === 'moon' ? 1 : wq, s: false }, c: { c, t: ct, q: cq, s: false }, up: { ...up }, cores: ['dmg', 'rof', 'arm'], gl: glv || gl(lv), skin: skin ? 'lunar' : 'default', mods });
export async function compare(pairs, seeds) {
  const jobs = [], meta = [];
  pairs.forEach(([A, B], k) => { for (const map of MAPS6) for (const seed of seedList(seeds)) for (const flip of [false, true]) { jobs.push({ A, B, seed, map, flip, pilot: PILOT }); meta.push(k); } });
  const r = await runJobs(jobs, { patch: (PILOT === 'human' ? humanPatch() : '') + (process.env.PATCH || '') }), out = pairs.map(() => ({ n: 0, w: 0 }));
  r.forEach((x, i) => { out[meta[i]].n++; out[meta[i]].w += x.out; });
  return out.map((o) => ({ n: o.n, win: +(o.w / o.n).toFixed(3) }));
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const S = +(process.env.SEEDS || 10), tests = (process.env.TESTS || 'weapons,kit,moon,skin,buyers').split(','), W = process.env.EPICW || 'pulse', res = {};
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
  if (tests.includes('spend')) {   // equal spend: the kit's Stars spent on gem caches instead (expected value, Monte Carlo over cache rolls)
    const budget = +(process.env.BUDGET || 6600), base = +(process.env.BASE_LV || 2), draws = 24, outs = [];
    const rng = R.rng32(4242), lvls = [];
    for (let d = 0; d < draws; d++) { const S = R.ecoNorm({}); for (const k of R.GORDER) S.gemLvl[k] = base; let left = budget, day = 30000, spent = 0;
      // one UTC day at a time, cheapest Stars per shard first: the 30%-off deal cache, then repeat buys at +25% each; stop when the next buy no longer fits
      while (left > 0) { const X = { day, week: Math.floor(day / 7), rnd: rng, pk: 'x' };
        const opts = [0, 1, 2].map((ri) => { const deal = R.ecoDealOf(S, 'gem', ri, X), p = R.ecoPrice(S, { kind: 'box', tk: 'gem', ri, deal }, X); return { ri, deal, stars: p.stars, per: p.stars / [1.5, 3.5, 12.5][ri] }; }).filter((o) => o.stars <= left).sort((a, b) => a.per - b.per);
        if (!opts.length) break; const o = opts[0];
        if (o.per > 120 && left >= 1050) { day++; continue; }   // better value tomorrow (the daily deal) while the budget still covers one
        R.ecoGrant(S, { kind: 'box', tk: 'gem', ri: o.ri, deal: o.deal, price: 0 }, X); left -= o.stars; spent += o.stars; }
      lvls.push(['dmg', 'rof', 'arm'].map((k) => S.gemLvl[k])); }
    const avg = [0, 1, 2].map((i) => +(lvls.reduce((a, l) => a + l[i], 0) / draws).toFixed(2));
    const pairs = lvls.map((l) => [kit({ w: 'moon', skin: true, lv: base }), kit({ w: W, glv: { dmg: l[0], rof: l[1], arm: l[2], spd: base, lck: base, reg: base } })]);
    const r = await compare(pairs, Math.max(2, Math.round(S / 4)));
    show('full kit vs equal spend on caches (Titan, base Lv' + base + ' -> avg ' + avg.join('/') + ')', { n: r.reduce((a, x) => a + x.n, 0), win: +(r.reduce((a, x) => a + x.win, 0) / r.length).toFixed(3) });
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
}
