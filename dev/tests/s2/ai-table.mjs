// AI-match win rates: kit x mode/team size x pilot, real phone code (combat-sim.mjs), all maps, fixed seeds.
// usage: [COMBAT_SRC=<checkout>] [PILOTS=standard,casual,expert] [KITS=stock,...] [SEEDS=4] [ONLY=arena 1v1,...] [LG=i] node dev/tests/s2/ai-table.mjs [out.json]
// LG (after item 4): the league the AI is set for (cfg.lg); omitted = the league the kit settles in.
import fs from 'node:fs';
import { runJobs } from './pool.mjs';
import { GEAR, SCENARIOS } from '../combat-sim.mjs';
export const SEEDS = [71, 419, 2027, 9803, 65537, 1201, 3307, 7919];
export const MAPS6 = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'];
export async function aiTable({ pilots = ['standard'], kits = Object.keys(GEAR), seeds = 4, only = null, extra = {}, patch = '', L = GEAR } = {}) {
  const jobs = [], keys = [];
  for (const [g, m] of SCENARIOS.filter(([g, m]) => !only || only.includes(g + ' ' + m))) for (const k of kits) for (const p of pilots)
    for (const map of MAPS6) for (const seed of SEEDS.slice(0, seeds)) { jobs.push({ kind: 'ai', cfg: { g, m, map, seed, mp: 50, L: L[k], pilot: p, ...extra } }); keys.push([g + ' ' + m, k, p]); }
  const res = await runJobs(jobs, { patch }), T = {};
  res.forEach((r, i) => { const [s, k, p] = keys[i], c = ((T[p] ||= {})[s] ||= {})[k] ||= { n: 0, w: 0, place: 0, secs: 0 }; c.n++; c.w += r.out; c.place += r.place || 0; c.secs += r.secs; });
  for (const p in T) for (const s in T[p]) for (const k in T[p][s]) { const c = T[p][s][k]; c.win = +(c.w / c.n).toFixed(3); c.place = +(c.place / c.n).toFixed(2); c.secs = Math.round(c.secs / c.n); }
  return T;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const pilots = (process.env.PILOTS || 'standard').split(','), kits = process.env.KITS ? process.env.KITS.split(',') : Object.keys(GEAR);
  const t0 = Date.now(), T = await aiTable({ pilots, kits, seeds: +(process.env.SEEDS || 4), only: process.env.ONLY ? process.env.ONLY.split(',') : null, extra: process.env.LG !== undefined ? { lg: +process.env.LG } : {} });
  for (const p in T) { console.log('pilot', p, ' (win rate; Last Standing win = 1st place; n per cell', Object.values(Object.values(T[p])[0])[0].n + ')');
    console.log(''.padEnd(13), kits.map(k => k.padStart(7)).join(''));
    for (const s in T[p]) console.log(s.padEnd(13), kits.map(k => String(T[p][s][k].win.toFixed(2)).padStart(7)).join(''), s.startsWith('royale') ? ' place ' + kits.map(k => T[p][s][k].place).join(' ') : '');
    const avg = k => (Object.values(T[p]).reduce((a, r) => a + r[k].win, 0) / Object.keys(T[p]).length).toFixed(3);
    console.log('average'.padEnd(13), kits.map(k => avg(k).padStart(7)).join('')); }
  console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(0), 's');
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(T, null, 1));
}
