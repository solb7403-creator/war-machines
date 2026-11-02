// Live matchmaking calibration (item 5): how a power gap turns into a win chance between PEOPLE. The held-out kit pairs
// (docs/launch/s2data/power-holdout.json) flown by the locked human profile on both sides; fits POWER_K_LIVE and
// COUNTER_EDGE_LIVE (powerWin(..., live)), which the lobby's 80% mismatch cap uses. powerOf itself is unchanged.
// usage: PAIRS=60 SEEDS=10 node dev/tests/s2/live-slope.mjs [out.json]
import fs from 'node:fs';
import { runJobs } from './pool.mjs';
import { humanPatch } from './human.mjs';
const R = new Function(fs.readFileSync('js/rules.js', 'utf8') + ';return {powerOf,COUNTER};')();
const d = JSON.parse(fs.readFileSync('docs/launch/s2data/power-holdout.json', 'utf8')).slice(0, +(process.env.PAIRS || 60));
const MAPS6 = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'], seeds = Array.from({ length: +(process.env.SEEDS || 10) }, (_, i) => 900001 + i * 7919);
const jobs = [], meta = [];
d.forEach((p, k) => { for (const map of MAPS6) for (const seed of seeds) for (const flip of [false, true]) { jobs.push({ A: p.A, B: p.B, seed, map, flip, pilot: 'human' }); meta.push(k); } });
const r = await runJobs(jobs, { patch: humanPatch() }), agg = d.map(() => [0, 0]);
r.forEach((x, i) => { agg[meta[i]][0] += x.out; agg[meta[i]][1]++; });
const rows = d.map((p, k) => ({ lr: Math.log(R.powerOf(p.A) / R.powerOf(p.B)), c: R.COUNTER[p.A.c.c] === p.B.c.c ? 1 : R.COUNTER[p.B.c.c] === p.A.c.c ? -1 : 0, y: agg[k][0] / agg[k][1], n: agg[k][1], bot: p.win }));
let best = null;
for (let K = 0.5; K <= 14; K += 0.05) for (let g = 0; g <= 2; g += 0.02) { let ll = 0; for (const x of rows) { const P = Math.min(1 - 1e-6, Math.max(1e-6, 1 / (1 + Math.exp(-(K * x.lr + g * x.c))))); ll += x.n * (x.y * Math.log(P) + (1 - x.y) * Math.log(1 - P)); } if (!best || ll > best.ll) best = { K, g, ll }; }
const err = rows.map((x) => Math.abs(1 / (1 + Math.exp(-(best.K * x.lr + best.g * x.c))) - x.y) * 100);
console.log('human-profile pairs', rows.length, 'x', rows[0].n, 'duels: POWER_K_LIVE', best.K.toFixed(2), 'COUNTER_EDGE_LIVE', best.g.toFixed(2), '| within 7 points', (err.filter((e) => e <= 7).length / err.length * 100).toFixed(1) + '%', 'mean error', (err.reduce((a, b) => a + b, 0) / err.length).toFixed(2));
console.log('mean |measured - 50%|: human', (rows.reduce((a, x) => a + Math.abs(x.y - 0.5), 0) / rows.length * 100).toFixed(1), 'vs bot', (rows.reduce((a, x) => a + Math.abs(x.bot - 0.5), 0) / rows.length * 100).toFixed(1), 'points');
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ K: best.K, g: best.g, rows }));
