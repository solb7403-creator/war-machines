// Renders the Session 5D before/after table (docs/launch/s5d/FAIR_ARCADE.md) from the grid JSONs written by fair-arcade-grid.mjs.
// usage: node dev/tests/fair-arcade-report.mjs docs/launch/s5d/before-standard.json docs/launch/s5d/after-standard.json > docs/launch/s5d/FAIR_ARCADE_TABLES.md
import fs from 'node:fs';
import { KITS, LGN, MODES5D } from './fair-arcade-grid.mjs';
const [bf, af] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')).standard);
const pc = v => (v * 100).toFixed(0) + '%';
const out = [];
out.push('## Win rate by league, mode and kit (standard pilot: the game\'s own bot flying the player\'s tank; before = main f193de1, after = this branch; same seeds, 6 maps x 4 seeds = 24 matches a cell)\n');
for (let lg = 0; lg < 7; lg++) {
  out.push(`### ${LGN[lg]}\n`);
  out.push('| Mode | ' + KITS.map(k => k + ' before → after').join(' | ') + ' |');
  out.push('|---|' + KITS.map(() => '---:').join('|') + '|');
  for (const [g, m] of MODES5D) { const s = g + ' ' + m, b = bf[lg][s], a = af[lg][s]; out.push(`| ${s} | ` + KITS.map(k => `${pc(b[k].win)} → **${pc(a[k].win)}**`).join(' | ') + ' |'); }
  out.push('');
  out.push('Damage taken per damage dealt (lower is better; Bounty respawns, so its ratio follows hull size more than skill — see kills a death):\n');
  out.push('| Mode | ' + KITS.map(k => k).join(' | ') + ' |');
  out.push('|---|' + KITS.map(() => '---:').join('|') + '|');
  for (const [g, m] of MODES5D) { const s = g + ' ' + m, b = bf[lg][s], a = af[lg][s]; out.push(`| ${s} | ` + KITS.map(k => `${b[k].ratio.toFixed(2)} → **${a[k].ratio.toFixed(2)}**`).join(' | ') + ' |'); }
  out.push('');
  const kd = (T, s, k) => (T[lg][s][k].kills / Math.max(1, T[lg][s][k].deaths)).toFixed(1);
  out.push('Bounty kills a death: 1v1 ' + KITS.map(k => `${k} ${kd(bf, 'bounty 1v1', k)} → **${kd(af, 'bounty 1v1', k)}**`).join(', ') + '; 2v2 ' + KITS.map(k => `${k} ${kd(bf, 'bounty 2v2', k)} → **${kd(af, 'bounty 2v2', k)}**`).join(', ') + '\n');
  out.push('AI supers a minute per enemy tank (pilot\'s own rate in brackets), after: ' + MODES5D.filter(([g]) => g !== 'boss').map(([g, m]) => `${g} ${m}: ` + KITS.map(k => `${af[lg][g + ' ' + m][k].aiSupPM} (${af[lg][g + ' ' + m][k].meSupPM})`).join(' / ')).join('; ') + '\n');
}
console.log(out.join('\n'));
