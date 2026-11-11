// SUPER REPORT (Session 5E-2b): how often a pilot fires the super in a match and how much damage the supers do, measured on
// the REAL phone code (combat-sim.mjs: js/rules.js + js/game.js + js/match.js), seeded, all six maps. The pilot is the
// "human" stand-in (s2/human.mjs); from 5E-2b on it also stops the timing bar with an average human's tap spread.
// Used twice: on main before the retune (the baseline in dev/tests/fixtures/super-baseline.json) and on the branch after
// it (dev/tests/super-timing.mjs holds the result to about 3 supers a match and total super damage within 10% of the baseline).
// usage: [COMBAT_SRC=<another checkout>] [SEEDS=4] [PILOT=human] node dev/tests/super-report.mjs [out.json]
import fs from 'node:fs';
import { GEAR } from './combat-sim.mjs';
import { runJobs } from './s2/pool.mjs';
export const SR_MODES = [['arena', '1v1'], ['arena', '2v2'], ['arena', '3v3'], ['zone', '2v2'], ['crystal', '2v2'], ['bounty', '2v2'], ['royale', '1v1'], ['boss', '2v2']];
export const SR_MAPS = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'];
export const SR_SEEDS = [71, 419, 2027, 9803, 65537, 1201, 3307, 7919];
// the pilots measured: each weapon item at the gear level and league a pilot would fly it in
const W = (a, t) => ({ a, t, q: a === 'moon' ? 1 : 1.05, s: false });
export const SR_KITS = [
  ['pulse0', { ...GEAR.stock, w: W('pulse', 0) }, 0], ['twin0', { ...GEAR.stock, w: W('twin', 0) }, 0], ['siege0', { ...GEAR.stock, w: W('siege', 0) }, 0],
  ['pulse1', { ...GEAR.rare, w: W('pulse', 1) }, 2], ['twin1', { ...GEAR.rare, w: W('twin', 1) }, 2], ['siege1', { ...GEAR.rare, w: W('siege', 1) }, 2],
  ['pulse2', { ...GEAR.epic, w: W('pulse', 2) }, 4], ['twin2', { ...GEAR.epic, w: W('twin', 2) }, 4], ['siege2', { ...GEAR.epic, w: W('siege', 2) }, 4],
  ['moon', { ...GEAR.legend }, 6],
];
// counts the pilot's supers and the damage they did (raw: what the hit dealt, as the game's own damage stat counts it; eff:
// the health it really removed) and, where the code has outcomes, how each bar ended. Rides back in the ability ledger.
const PATCH = `
var __sr={n:0,raw:0,eff:0,oc:[0,0,0],hits:0};
{const th=takeHit;takeHit=function(r,amt,src,why,kind,c,d,b){const h0=r.hp,v=th(r,amt,src,why,kind,c,d,b);if(kind===1&&src===me){__sr.raw+=h0-r.hp;__sr.eff+=Math.max(0,h0)-Math.max(0,r.hp);__sr.hits++;}return v;};}
{const fs0=fireSuper;fireSuper=function(r,S){if(r===me){__sr.n++;if(r.sup&&typeof r.sup.oc==='number')__sr.oc[r.sup.oc]++;}return fs0(r,S);};}
{const r0=__run;__run=function(cfg){__sr={n:0,raw:0,eff:0,oc:[0,0,0],hits:0};const r=r0(cfg);if(r.ab)r.ab.sr=__sr;return r;};}
`;
export async function superReport({ seeds = 4, pilot = 'human', kits = SR_KITS, modes = SR_MODES, maps = SR_MAPS, patch = '' } = {}) {
  const jobs = [], keys = [];
  for (const [key, L, lg] of kits) for (const [g, m] of modes) for (const map of maps) for (const seed of SR_SEEDS.slice(0, seeds)) { jobs.push({ kind: 'ai', cfg: { g, m, map, seed, mp: 50, L, pilot, lg, dt: 1 / 30 } }); keys.push([key, g + ' ' + m]); }
  const res = await runJobs(jobs, { patch: patch + PATCH });
  const mk0 = () => ({ n: 0, sup: 0, raw: 0, eff: 0, dmg: 0, secs: 0, oc: [0, 0, 0], hits: 0 }), rows = {}, all = mk0(), byMode = {};
  res.forEach((r, i) => { const [key, mk] = keys[i], s = r.ab.sr, c = rows[key] ||= mk0(), mc = byMode[mk] ||= mk0();
    for (const t of [c, all, mc]) { t.n++; t.sup += s.n; t.raw += s.raw; t.eff += s.eff; t.secs += r.secs; t.dmg += r.dmg; t.hits += s.hits; for (let k = 0; k < 3; k++) t.oc[k] += s.oc[k]; } });
  const fin = c => ({ matches: c.n, supers: +(c.sup / c.n).toFixed(2), superDmg: Math.round(c.raw / c.n), superEff: Math.round(c.eff / c.n), perSuper: Math.round(c.raw / Math.max(1, c.sup)), dmg: Math.round(c.dmg / c.n), share: +(c.raw / Math.max(1, c.dmg)).toFixed(3), secs: Math.round(c.secs / c.n), oc: c.oc });
  const map2 = o => Object.fromEntries(Object.entries(o).map(([k, c]) => [k, fin(c)]));
  return { pilot, seeds, all: fin(all), kits: map2(rows), modes: map2(byMode) };
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const t0 = Date.now(), R = await superReport({ seeds: +(process.env.SEEDS || 4), pilot: process.env.PILOT || 'human' });
  const line = (k, c) => console.log(k.padEnd(12), String(c.supers).padStart(6), String(c.superDmg).padStart(9), String(c.superEff).padStart(8), String(c.perSuper).padStart(9), String(c.dmg).padStart(7), (c.share * 100).toFixed(1).padStart(6) + '%', String(c.secs).padStart(5), '  ' + c.oc.join('/'));
  console.log('kit          supers  superDmg  removed  perSuper  allDmg  share  secs  miss/normal/jackpot   (a match; ' + R.all.matches + ' matches, pilot ' + R.pilot + ')');
  for (const k in R.kits) line(k, R.kits[k]);
  line('ALL', R.all);
  console.log('by mode (all kits):'); for (const m in R.modes) line(m, R.modes[m]);
  console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(0), 's');
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(R, null, 1));
}
