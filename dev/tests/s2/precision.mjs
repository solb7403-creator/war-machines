// Moonbeam Precision, measured (owner rule: Moonbeam DPS may drop at most 2% and only if Precision's gain covers it).
// Moonbeam Epic-Titan build vs the best Epic weapon, human pilots on both sides, with Precision (edge hits 100%) and
// without (edge hits 75% like every other weapon): Moonbeam's shot damage per shot fired (supers excluded).
// usage: SEEDS=20 [DPS=118] node dev/tests/s2/precision.mjs
import { runJobs } from './pool.mjs';
import { humanPatch } from './human.mjs';
import { kit, MAPS6, seedList } from './legend.mjs';
const S = +(process.env.SEEDS || 20), W = process.env.EPICW || 'siege', out = {};
for (const [name, patch] of [['with Precision', ''], ['without Precision', '{const wo=weaponOf;weaponOf=function(...a){const w=wo(...a);if(w.edge)w.edge=GRAZE;return w;};}']]) {
  const jobs = []; for (const map of MAPS6) for (const seed of seedList(S)) for (const flip of [false, true]) jobs.push({ A: kit({ w: 'moon' }), B: kit({ w: W }), seed, map, flip, pilot: 'human' });
  const r = await runJobs(jobs, { patch: humanPatch() + (process.env.DPS ? 'WEAPONS.moon.dps=' + (+process.env.DPS) + ';' : '') + patch });
  const shot = r.reduce((a, x) => a + (x.dmg - x.supDmg), 0), shots = r.reduce((a, x) => a + x.shots, 0), win = r.reduce((a, x) => a + x.out, 0) / r.length;
  out[name] = shot / shots; console.log(name.padEnd(18), 'shot damage per shot fired', (shot / shots).toFixed(2), ' win', (win * 100).toFixed(1) + '%', ' n=' + r.length);
}
console.log('Precision gain on shot damage: +' + ((out['with Precision'] / out['without Precision'] - 1) * 100).toFixed(1) + '%');
