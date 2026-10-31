// Calibration grid: every gear level against every AI difficulty level (fixed seeds), to pick AI_LAG from measurements.
// usage: PILOT=casual node dev/tests/combat-grid.mjs [seeds=8] [modes]
import { makeWorld, GEAR, MAPS4 } from './combat-sim.mjs';
const seeds = +(process.argv[2] || 8), modes = (process.argv[3] || 'arena 3v3,royale 1v1,zone 2v2,arena 1v1').split(','), pilot = process.env.PILOT || 'casual';
const W = makeWorld(), tiers = (process.env.TIERS || '0,1,2,3,4,5,6,7,8').split(',').map(Number);
for (const gm of modes) {
  const [g, m] = gm.split(' ');
  console.log('\n' + gm + '  (win rate; rows = your gear, columns = AI level ' + tiers.join(' ') + ')');
  for (const [gk, L] of Object.entries(GEAR)) {
    const cells = tiers.map(t => { let w = 0; for (let s = 1; s <= seeds; s++) { const r = W.run({ g, m, map: MAPS4[s % 4], seed: 1000 + s * 7919, mp: 50, L, pilot, forceTier: t }); w += r.out === 'win' ? 1 : r.out === 'draw' ? 0.5 : 0; } return (w / seeds).toFixed(2); });
    console.log(gk.padEnd(7), cells.join('  '));
  }
}
