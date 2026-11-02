// Gear score accuracy (item 3): powerOf's predicted win chance (powerWin, with the counter term) against measured duels.
// Data: docs/launch/s2data/power-holdout.json (120 kit pairs never used to fit, 480 real-sim duels each) and power-train.json
// (500 pairs, 240 duels each, used to fit POWER_W). usage: node dev/tests/s2/power-check.mjs [file]
import fs from 'node:fs';
const R = new Function(fs.readFileSync('js/rules.js', 'utf8') + ';return {powerOf,powerWin,COUNTER};')();
for (const f of process.argv[2] ? [process.argv[2]] : ['docs/launch/s2data/power-holdout.json', 'docs/launch/s2data/power-train.json']) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const err = d.map((p) => { const a = p.A.c.c, b = p.B.c.c, ctr = R.COUNTER[a] === b ? 1 : R.COUNTER[b] === a ? -1 : 0; return Math.abs(R.powerWin(R.powerOf(p.A), R.powerOf(p.B), ctr) - p.win) * 100; });
  const ok = err.filter((e) => e <= 7).length / err.length, same = d.map((p, i) => [p, err[i]]).filter(([p]) => p.A.c.c === p.B.c.c);
  console.log(f.split('/').pop().padEnd(20), d.length, 'pairs: within 7 points', (ok * 100).toFixed(1) + '%, mean error', (err.reduce((a, b) => a + b, 0) / err.length).toFixed(2),
    '| same-class pairs', same.length, (same.filter(([, e]) => e <= 7).length / same.length * 100).toFixed(1) + '%');
}
