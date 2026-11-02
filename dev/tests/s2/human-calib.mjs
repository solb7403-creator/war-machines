// Human profile calibration on EQUAL-GEAR matchups only (owner rule: lock it before any legendary measurement).
// Epic Pulse, 14-level build, Lv5 cores, same mods on both sides; only the chassis class differs (or nothing: mirror).
// usage: [H='{"react":0.3,...}'] SEEDS=10 node dev/tests/s2/human-calib.mjs
import { runJobs } from './pool.mjs';
import { HUMAN, humanPatch } from './human.mjs';
import { kit, MAPS6, seedList } from './legend.mjs';
const H = { ...HUMAN, ...JSON.parse(process.env.H || '{}') }, S = +(process.env.SEEDS || 10), pilot = process.env.CALIB_PILOT || 'human';
const pairs = [['titan vs vanguard', 'titan', 'vanguard'], ['scout vs titan', 'scout', 'titan'], ['vanguard vs scout', 'vanguard', 'scout'], ['titan mirror', 'titan', 'titan']];
const jobs = [], meta = [];
pairs.forEach(([, a, b], k) => { for (const map of MAPS6) for (const seed of seedList(S)) for (const flip of [false, true]) { jobs.push({ A: kit({ w: 'pulse', c: a }), B: kit({ w: 'pulse', c: b }), seed, map, flip, pilot }); meta.push(k); } });
const r = await runJobs(jobs, { patch: pilot === 'human' ? humanPatch(H) : '' }), out = pairs.map(() => [0, 0, 0, 0]);
r.forEach((x, i) => { const o = out[meta[i]]; o[0] += x.out; o[1]++; o[2] += x.secs; o[3] += x.shots ? x.hits / x.shots : 0; });
console.log(pilot, JSON.stringify(H));
pairs.forEach(([n], k) => console.log('  ' + n.padEnd(20), (out[k][0] / out[k][1] * 100).toFixed(1) + '%', 'n=' + out[k][1], 'secs', (out[k][2] / out[k][1]).toFixed(1), 'hit rate', (out[k][3] / out[k][1]).toFixed(2)));
