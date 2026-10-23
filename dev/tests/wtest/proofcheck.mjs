// Runs the server's proof-of-play check over match records from real (browser) matches: node proofcheck.mjs recs.json
import { readFileSync } from 'node:fs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const { checkProof } = await import('../../../worker/src/proof.js');
const { minSecs } = await import('../../../worker/src/eco.js');
const recs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let bad = 0;const sig = [], why = {};
for (const r of recs) {
  const c = Object.assign({}, r.c, { min: minSecs(r.c.g, r.c.m, r.c.won, r.c.drawn, r.c.place) });
  const t0 = performance.now(), out = checkProof(r.pf, c), ms = performance.now() - t0;
  if (!out.ok) { bad++; why[out.why] = (why[out.why] || 0) + 1; console.log('FAIL', out.why, JSON.stringify(c).slice(0, 220)); }
  else sig.push(Object.assign({ g: c.g, m: c.m, map: c.map, ms: +ms.toFixed(2), bytes: (r.pf.s || '').length }, out.sig));
}
const q = (k) => { const a = sig.map((x) => x[k]).filter((x) => typeof x === 'number').sort((a, b) => a - b); return a.length ? [a[0], a[a.length >> 1], a[a.length - 1]].map((x) => +x.toFixed(3)) : null; };
console.log('records', recs.length, 'failed', bad, JSON.stringify(why));
for (const k of ['ni', 'ratio', 'reachBad', 'moving', 'touches', 'simT', 'ms', 'bytes']) console.log(k, 'min/median/max', JSON.stringify(q(k)));
console.log('no-input over 0.6:', sig.filter((x) => x.ni > 0.6).length, ' distinct input hashes:', new Set(sig.map((x) => x.ih).filter(Boolean)).size, 'of', sig.filter((x) => x.ih).length);
process.exit(bad ? 1 : 0);
