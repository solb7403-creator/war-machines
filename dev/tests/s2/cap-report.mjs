// Minutes to the daily cap (item 6), from measured AI-match results: base points a minute (league x1: the cap counts base
// points), by mode x team size x league, at the win rates each kit settles at. Match time = the measured fight + 20 s of
// VS and results screens. Streak bonus from the win rate (expected streak, capped at 5). No featured bonus, no quests.
// usage: node dev/tests/s2/cap-report.mjs grid.json [pilot]
import fs from 'node:fs';
const R = new Function(fs.readFileSync('js/rules.js', 'utf8') + ';return {MODES,teamX,isSolo,ROYALE_PTS,streakPts,DAILY_CAP,LEAGUE};')();
const G = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), pilot = process.argv[3] || 'standard';
const SETTLE = { 0: 'stock', 1: 'rare', 4: 'epic', 6: 'legend' };   // the kit that settles in each league (docs/launch/LEAGUES.md)
function perMin(sc, cell) {
  const [g, m] = sc.split(' '), p = cell.win, secs = cell.secs + 20;
  let pts;
  if (R.isSolo(g)) { const pl = Math.max(1, Math.min(6, cell.place || 3.5)), lo = Math.floor(pl), hi = Math.ceil(pl), f = pl - lo; pts = R.ROYALE_PTS[lo - 1] * (1 - f) + R.ROYALE_PTS[hi - 1] * f; }
  else { const M = R.MODES[m], x = R.teamX(g, m, g === 'arena' && m === '1v1');
    let es = 0, q = 1; for (let k = 1; k <= 5; k++) { q *= p; es += q * (k < 5 ? (1 - p) : 1) * R.streakPts(g, m, k); }   // expected streak bonus a win
    pts = p * M.win * x + (1 - p) * M.loss * x + p * (es / Math.max(1e-9, p)); }
  return { ppm: pts / (secs / 60), secs };
}
const rows = [];
for (const [lg, kit] of Object.entries(SETTLE)) { const T = G[lg] && G[lg][pilot]; if (!T) continue;
  for (const sc of Object.keys(T)) { const c = T[sc][kit], r = perMin(sc, c); rows.push({ lg: R.LEAGUE[lg].n, kit, sc, win: c.win, secs: Math.round(r.secs), ppm: Math.round(r.ppm), mins: Math.round(R.DAILY_CAP / r.ppm) }); } }
console.log('league        kit     mode          win   match s  base pts/min  minutes to cap');
for (const r of rows) console.log(r.lg.padEnd(13), r.kit.padEnd(7), r.sc.padEnd(13), r.win.toFixed(2), String(r.secs).padStart(7), String(r.ppm).padStart(12), String(r.mins).padStart(14));
const best = Math.max(...rows.map((r) => r.ppm)), avg = rows.reduce((a, r) => a + r.ppm, 0) / rows.length;
console.log('\nbest mode: ' + best + ' base pts/min (cap in ' + Math.round(R.DAILY_CAP / best) + ' min); mode average ' + Math.round(avg) + '/min (cap in ' + Math.round(R.DAILY_CAP / avg) + ' min)');
console.log('per week (base points, matches only): 24/7 bot', (R.DAILY_CAP * 7).toLocaleString('en-US'), '| 1 h/day', Math.round(Math.min(R.DAILY_CAP, avg * 60) * 7).toLocaleString('en-US'), '| 3 h/day', Math.round(Math.min(R.DAILY_CAP, avg * 180) * 7).toLocaleString('en-US'), '(mode-average pace)');
