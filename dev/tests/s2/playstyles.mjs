// Mod playstyles: how a machine fights with each mod set, from the real sim (not just its numbers). Each set fights the
// stock set of its own chassis and weapon (Epic builds, standard pilots, all maps, both directions) and we record what it
// does: engagement range, how far it drives a second, dashes and shields a minute, supers a minute, damage taken a second.
// usage: SEEDS=2 node dev/tests/s2/playstyles.mjs [out.json]
import fs from 'node:fs';
import { runJobs } from './pool.mjs';
import { build, legalSets } from './mods.mjs';
const MAPS6 = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'], SEEDS = [71, 419, 2027, 9803, 65537].slice(0, +(process.env.SEEDS || 2));
const sets = legalSets(), name = (m) => [m.hull, m.mobility, m.mount].join('/'), out = {};
for (const c of ['scout', 'vanguard', 'titan']) {
  const jobs = [], meta = [];
  for (let i = 0; i < sets.length; i++) for (const w of ['pulse', 'twin', 'siege']) for (const map of MAPS6) for (const seed of SEEDS) for (const flip of [false, true]) { jobs.push({ A: build(c, w, sets[i]), B: build(c, w, {}), seed, map, flip }); meta.push(i); }
  const r = await runJobs(jobs), agg = sets.map(() => ({ n: 0, win: 0, secs: 0, range: 0, moved: 0, dash: 0, shield: 0, sups: 0, taken: 0 }));
  r.forEach((x, k) => { const a = agg[meta[k]]; a.n++; a.win += x.out; a.secs += x.secs; a.range += x.range; a.moved += x.moved; a.dash += x.dash * 60 / x.secs; a.shield += x.shield * 60 / x.secs; a.sups += x.sups * 60 / x.secs; a.taken += x.taken / x.secs; });
  console.log('\n' + c + '  (vs stock, n=' + agg[0].n + ' each)   win  match-s  range  drive/s  dash/min  shield/min  supers/min  taken/s');
  out[c] = {};
  agg.forEach((a, i) => { const f = (k, d = 1) => +(a[k] / a.n).toFixed(d); out[c][name(sets[i])] = { win: f('win', 3), secs: f('secs'), range: f('range', 2), moved: f('moved', 2), dash: f('dash', 2), shield: f('shield', 2), sups: f('sups', 2), taken: f('taken', 0) };
    const o = out[c][name(sets[i])]; console.log('  ' + name(sets[i]).padEnd(26), String(o.win).padStart(6), String(o.secs).padStart(7), String(o.range).padStart(6), String(o.moved).padStart(8), String(o.dash).padStart(9), String(o.shield).padStart(11), String(o.sups).padStart(11), String(o.taken).padStart(8)); });
}
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
