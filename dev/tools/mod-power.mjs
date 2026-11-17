// Session 6B: research mods measured on the real server sim (worker/src/sim.gen.js = js/rules.js + js/game.js). Each mod against the
// same tank with Stock in that slot, both sides flown by the same pilot profile, 6 maps x seeds x both spawn sides; the measured win
// rate next to the one the gear rating (powerOf) predicts. Bots fit POWER_K (13.75), the Session 2 human profile fits POWER_K_LIVE
// (3.10: live win chances). Read-only: it writes docs/conquest/session6b/mod-power.json with --write.
// usage: SEEDS=25 PILOT=human,bot KITS=epic,legend node dev/tools/mod-power.mjs [--write]
import fs from 'node:fs';
import { runJobs } from '../tests/s2/pool.mjs';
import { humanPatch } from '../tests/s2/human.mjs';
import { GEAR } from '../tests/combat-sim.mjs';
import { buildSim } from '../../worker/build-sim.mjs';
buildSim();
const { RULES: R } = await import('../../worker/src/sim.gen.js?' + Date.now());
const MAPS6 = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'];
const SEEDS = +(process.env.SEEDS || 25), PILOTS = (process.env.PILOT || 'human,bot').split(','), KITS = (process.env.KITS || 'epic,legend').split(',');
const ONLY = process.env.MODS ? process.env.MODS.split(',') : null;
const KIT = {
  epic: { ...structuredClone(R.STOCK_L), w: { a: 'pulse', t: 2, q: 1.1, s: false }, c: { c: 'vanguard', t: 2, q: 1.1, s: false }, up: { hull: 3, cannon: 3, engine: 3, target: 2, reactor: 3 }, cores: ['dmg', 'rof', 'arm'], gl: { dmg: 3, rof: 3, arm: 3, spd: 3, lck: 3, reg: 3 } },
  legend: structuredClone(GEAR.legend),
};
const mods = Object.keys(R.FITS).flatMap(slot => Object.keys(R.FITS[slot]).filter(id => R.FITS[slot][id].rs && (!ONLY || ONLY.includes(id))).map(id => ({ slot, id, F: R.FITS[slot][id] })));
const logit = p => Math.log(Math.max(1e-4, p) / Math.max(1e-4, 1 - p));
const out = { generatedBy: 'dev/tools/mod-power.mjs', seeds: SEEDS, maps: MAPS6, rows: [] };
for (const pilot of PILOTS) for (const kit of KITS) {
  const jobs = [], meta = [];
  for (const m of mods) for (const map of MAPS6) for (let s = 0; s < SEEDS; s++) for (const flip of [false, true]) {
    jobs.push({ A: { ...KIT[kit], mods: { [m.slot]: m.id } }, B: { ...KIT[kit], mods: {} }, seed: 9000 + s * 7 + MAPS6.indexOf(map), map, flip, pilot: pilot === 'human' ? 'human' : undefined });
    meta.push(m.id);
  }
  const t0 = Date.now(), res = await runJobs(jobs, pilot === 'human' ? { patch: humanPatch() } : {});
  const agg = {};
  res.forEach((r, i) => { const a = (agg[meta[i]] ||= { n: 0, w: 0, secs: 0, hits: 0, shots: 0, dash: 0, shield: 0 }); a.n++; a.w += r.out; a.secs += r.secs; a.hits += r.hits; a.shots += r.shots; a.dash += r.dash; a.shield += r.shield; });
  console.log(`\n${pilot} pilots, ${kit} kit (${jobs.length} duels, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log('mod'.padEnd(18), 'measured', ' predicted', ' power gain', ' n');
  for (const m of mods) {
    const a = agg[m.id], w = a.w / a.n, p0 = R.powerOf({ ...KIT[kit], mods: {} }), z0 = R.powerZ({ ...KIT[kit], mods: {} }), z1 = R.powerZ({ ...KIT[kit], mods: { [m.slot]: m.id } });
    const ratio = Math.exp((z1 - z0) / R.POWER_K), pred = R.powerWin(ratio * p0, p0, 0, pilot === 'human');
    const se = Math.sqrt(w * (1 - w) / a.n), implied = Math.exp(logit(w) / (pilot === 'human' ? R.POWER_K_LIVE : R.POWER_K)) - 1;
    out.rows.push({ pilot, kit, mod: m.id, name: m.F.n, slot: m.slot, set: !!m.F.set, leg: !!m.F.leg, n: a.n, win: +w.toFixed(4), se: +se.toFixed(4), predicted: +pred.toFixed(4), powerGain: +(ratio - 1).toFixed(4), impliedGain: +implied.toFixed(4), secs: +(a.secs / a.n).toFixed(1), hitRate: +(a.hits / Math.max(1, a.shots)).toFixed(3) });
    console.log((m.F.n).padEnd(18), ((w * 100).toFixed(1) + '% ±' + (se * 196).toFixed(1)).padEnd(13), ((pred * 100).toFixed(1) + '%').padEnd(9), ('+' + ((ratio - 1) * 100).toFixed(1) + '%').padEnd(9), ' implied ' + (implied * 100).toFixed(1) + '%');
  }
}
if (process.argv.includes('--write')) { fs.mkdirSync('docs/conquest/session6b', { recursive: true }); fs.writeFileSync('docs/conquest/session6b/mod-power.json', JSON.stringify(out, null, 1) + '\n'); console.log('\nwrote docs/conquest/session6b/mod-power.json'); }
