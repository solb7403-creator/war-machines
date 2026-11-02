// Points a minute by league x kit (items 4/6): base points (airdrop; x league base pay) and spendable points (x the
// multiplier on top), from measured AI-match results at every league (league-grid.mjs output), averaged over the 11 mode
// x team size setups. Checks the owner's targets: for the same kit and pilot, base points a minute rise >= 6% per league
// after the harder AI, and Lunar Legend lands +40-60% above Rookie. Minutes to the 20,000 base cap per league.
// usage: node dev/tests/s2/ppm.mjs grid.json [pilot] [BP JSON array to try]
import fs from 'node:fs';
const R = new Function(fs.readFileSync('js/rules.js', 'utf8') + ';return {MODES,teamX,isSolo,ROYALE_PTS,streakPts,DAILY_CAP,LEAGUE,LG_BASE_PAY,LG_MULT};')();
const G = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), pilot = process.argv[3] || 'standard', BP = process.argv[4] ? JSON.parse(process.argv[4]) : R.LG_BASE_PAY;
export function rawPpm(sc, cell) {   // a setup's points a minute at league x1 (mode pay, streak; no featured), match + 20 s of screens
  const [g, m] = sc.split(' '), p = cell.win, secs = cell.secs + 20;
  let pts;
  if (R.isSolo(g)) { const pl = Math.max(1, Math.min(6, cell.place || 3.5)), lo = Math.floor(pl), hi = Math.ceil(pl), f = pl - lo; pts = R.ROYALE_PTS[lo - 1] * (1 - f) + R.ROYALE_PTS[hi - 1] * f; }
  else { const M = R.MODES[m], x = R.teamX(g, m, g === 'arena' && m === '1v1'); let es = 0, q = 1; for (let k = 1; k <= 5; k++) { q *= p; es += q * (k < 5 ? 1 - p : 1) * R.streakPts(g, m, k); }
    pts = p * M.win * x + (1 - p) * M.loss * x + es; }
  return pts / (secs / 60);
}
const lgs = Object.keys(G).map(Number).sort((a, b) => a - b), kits = Object.keys(Object.values(Object.values(G)[0][pilot])[0]);
const T = {};
for (const k of kits) { T[k] = {}; for (const lg of lgs) { const S = G[lg][pilot], scs = Object.keys(S), raw = scs.reduce((a, sc) => a + rawPpm(sc, S[sc][k]), 0) / scs.length;
  T[k][lg] = { raw, base: raw * BP[lg], spend: raw * BP[lg] * R.LG_MULT[lg], win: scs.reduce((a, sc) => a + S[sc][k].win, 0) / scs.length }; } }
console.log('base points a minute (spendable in brackets), ' + pilot + ' pilot, mode average; base pay ' + JSON.stringify(BP));
console.log('kit     ' + lgs.map((l) => R.LEAGUE[l].n.padStart(15)).join(''));
let ok = true;
for (const k of kits) { const row = lgs.map((l) => (Math.round(T[k][l].base) + ' (' + Math.round(T[k][l].spend) + ')').padStart(15)).join('');
  const steps = lgs.slice(1).map((l, i) => T[k][l].base / T[k][lgs[i]].base - 1), top = T[k][lgs[lgs.length - 1]].base / T[k][lgs[0]].base - 1;
  const bad = steps.some((x) => x < 0.06) || top < 0.4 || top > 0.6; if (bad) ok = false;
  console.log(k.padEnd(8) + row + '   steps ' + steps.map((x) => (x * 100).toFixed(0) + '%').join(' ') + '  LL vs Rookie +' + (top * 100).toFixed(0) + '%' + (bad ? '  <-- misses' : '')); }
console.log('minutes to the 20,000 base cap: ' + kits.map((k) => k + ' ' + lgs.map((l) => Math.round(R.DAILY_CAP / T[k][l].base)).join('/')).join(' | '));
console.log(ok ? 'PASS points a minute: every kit +6% a league or more, Lunar Legend +40-60% over Rookie' : 'MISS points a minute (see rows)');
if (process.argv[5]) fs.writeFileSync(process.argv[5], JSON.stringify(T));
