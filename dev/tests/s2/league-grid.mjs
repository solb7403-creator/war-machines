// League calibration grid (item 4): AI-match win rates for every ladder kit at every league, real phone code, all maps.
// usage: PILOTS=standard SEEDS=4 [LGS=0,1,..] [KITS=..] node dev/tests/s2/league-grid.mjs out.json
import fs from 'node:fs';
import { aiTable } from './ai-table.mjs';
import { GEAR } from '../combat-sim.mjs';
const pilots = (process.env.PILOTS || 'standard').split(','), lgs = (process.env.LGS || '0,1,2,3,4,5,6').split(',').map(Number), kits = process.env.KITS ? process.env.KITS.split(',') : Object.keys(GEAR);
const out = {}, t0 = Date.now();
for (const lg of lgs) { out[lg] = await aiTable({ pilots, kits, seeds: +(process.env.SEEDS || 4), extra: { lg } });
  for (const p of pilots) { const T = out[lg][p], avg = (k) => (Object.values(T).reduce((a, r) => a + r[k].win, 0) / Object.keys(T).length).toFixed(3);
    console.log('league', lg, p.padEnd(8), kits.map((k) => k + ' ' + avg(k)).join('  '), ' ', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  fs.writeFileSync(process.argv[2], JSON.stringify(out)); }
