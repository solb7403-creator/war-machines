// Ghosts in AI matches, before/after: a Legendary pilot's AI match when the ticket brings two offline pilots' tanks.
// Old band: within 25% either way of your power (a max-gear tank can be one of them); new: 0.70-0.95x yours, one enemy at most.
// usage: [COMBAT_SRC=<old checkout>] node dev/tests/combat-ghosts.mjs [seeds=12]
import { makeWorld, GEAR, MAPS4, summarize } from './combat-sim.mjs';
const seeds = +(process.argv[2] || 12), W = makeWorld(), gl = lv => ({ dmg: lv, rof: lv, arm: lv, spd: lv, lck: lv, reg: lv });
// the strongest legal tank (power 240): what the old band let into a 204-power pilot's match
const MAX = { w: { a: 'moon', t: 2, q: 1, s: false }, c: { c: 'titan', t: 2, q: 1.1, s: false }, up: { hull: 4, cannon: 4, engine: 4, target: 2, reactor: 0 }, cores: ['dmg', 'rof', 'arm'], gl: gl(5), skin: 'lunar', paint: 'gold', mods: { hull: 'plates', mobility: 'stable', mount: 'stock' } };
const pw = L => W.eval('powerOf(' + JSON.stringify(L) + ')');
console.log('you', pw(GEAR.legend), 'ghost', pw(MAX));
for (const [g, m] of [['arena', '1v1'], ['arena', '3v3'], ['royale', '1v1']]) for (const [label, ghosts] of [['no ghosts', []], ['2 max-gear ghosts offered', [MAX, MAX]]]) {
  const rows = [];
  for (let s = 1; s <= seeds; s++) rows.push(W.run({ g, m, map: MAPS4[s % 4], seed: 4000 + s * 7919, mp: 50, L: GEAR.legend, pilot: 'casual', ghosts, dt: 1 / 30 }));
  const S = summarize(rows), placed = rows.reduce((a, r) => a + r.roster.filter(u => u.gh && u.team !== 0).length, 0) / seeds;
  console.log((g + ' ' + m).padEnd(11), label.padEnd(26), 'win', S.win.toFixed(2), 'enemy ghosts/match', placed.toFixed(2), 'taken', S.taken, S.place !== undefined ? 'place ' + S.place : '');
}
