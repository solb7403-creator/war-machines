// Hazard takedown pace (Session 5E-2e): how long the 25 takedowns of a map's finish take a pilot who picks that map and
// plays 20 minutes a day. Not pass/fail: it prints the table the checkpoint and the owner report quote.
// Real code (js/rules.js + js/game.js + js/match.js through combat-sim.mjs). The pilot's stand-in is the game's own AI
// with a person's timing, so it dodges and fights but does NOT play for takedowns (it never holds an enemy in a hazard on
// purpose): a pilot chasing the finish will be faster. Every match rolls its weather from its own seed, as live.
//   node dev/tests/weather-pace.mjs [matches per cell, default 40] [league, default 2]
import { makeWorld, GEAR } from './combat-sim.mjs';
const W = makeWorld(), N = +process.argv[2] || 40, LG = process.argv[3] === undefined ? 2 : +process.argv[3];
const MAPS = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'], NAME = { classic: 'Moonbase', overpass: 'Overpass', longshot: 'Longshot', craters: 'Crater Field', canyon: 'Canyon', bunker: 'Bunker' };
// what a pilot plays: the mode mix of a normal session (Arena 1v1 best of 3 is the default mode; team and objective modes the rest)
const MIX = [['arena', '1v1', 0.3], ['arena', '2v2', 0.15], ['zone', '2v2', 0.15], ['bounty', '1v1', 0.15], ['crystal', '2v2', 0.1], ['royale', '1v1', 0.15]];
const BETWEEN = 35;   // seconds between matches: results, menu, the VS screen
const rows = [];
for (const map of MAPS) {
  let td = 0, secs = 0, n = 0, hzN = 0, tdHz = 0, kinds = [0, 0, 0, 0]; const byMode = {};
  for (const [g, m, share] of MIX) { const k = Math.max(4, Math.round(N * share * MIX.length / 1)); let t = 0, s = 0, c = 0;
    for (let i = 0; i < k; i++) { const seed = 7000 + i * 31 + MAPS.indexOf(map) * 977 + g.length * 13 + m.charCodeAt(0);
      const r = W.run({ g, m, map, seed, mp: 50, L: GEAR.rare, lg: LG, dt: 1 / 30, pilot: 'standard' });
      t += r.td; s += r.secs; c++; kinds[r.wx ? r.wx.k : 0]++; if (r.wx && r.wx.haz) { hzN++; tdHz += r.td; } }
    byMode[g + ' ' + m] = { td: t / c, secs: s / c, share }; td += (t / c) * share; secs += (s / c) * share; n += c; }
  const perMatch = td, len = secs + BETWEEN, perDay = (20 * 60 / len) * perMatch, days = 25 / perDay;
  rows.push({ map, perMatch, len: secs, perDay, days, hzShare: hzN / n, tdHz: hzN ? tdHz / hzN : 0, byMode, kinds: kinds.map(x => x / n) });
}
console.log('Takedown pace, ' + N + ' matches a mode cell, league ' + LG + ', rare kit, stand-in pilot (does not play for takedowns), ' + BETWEEN + ' s between matches');
console.log('map           | takedowns/match | in a hazard match | match length | matches in 20 min | takedowns/day | days to 25');
for (const r of rows) console.log(NAME[r.map].padEnd(13), '|', r.perMatch.toFixed(2).padStart(15), '|', r.tdHz.toFixed(2).padStart(17), '|', (r.len.toFixed(0) + ' s').padStart(12), '|', (1200 / (r.len + BETWEEN)).toFixed(1).padStart(17), '|', r.perDay.toFixed(1).padStart(13), '|', r.days.toFixed(1).padStart(10));
console.log('weather roll in these matches (clear / vision / hazard / both):', rows.map(r => r.kinds.map(x => (x * 100).toFixed(0) + '%').join(' ')).join(' | '));
for (const r of rows) console.log(NAME[r.map] + ' by mode: ' + Object.entries(r.byMode).map(([k, v]) => k + ' ' + v.td.toFixed(2)).join(', '));
