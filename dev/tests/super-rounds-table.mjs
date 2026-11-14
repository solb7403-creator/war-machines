// Markdown tables for Checkpoint 36 from two super-rounds.mjs result files (before / after).
// usage: node dev/tests/super-rounds-table.mjs before.json after.json [set ...]
import fs from 'node:fs';
const [bf, af, ...sets] = process.argv.slice(2), B = JSON.parse(fs.readFileSync(bf, 'utf8')), A = JSON.parse(fs.readFileSync(af, 'utf8'));
const pc = v => Math.round(v * 100) + '%';
for (const s of sets.length ? sets : Object.keys(A)) {
  const b = B[s], a = A[s]; if (!b || !a) continue;
  const kits = Object.keys(a.kits), modes = Object.keys(a.modes);
  console.log(`\n**${s}** (pilot: ${a.pilot}; ${b.matches} matches before, ${a.matches} after). Cell: supers per round before -> after (most in one round before -> after).\n`);
  console.log('| Mode (round, s) | ' + kits.join(' | ') + ' | AI pilots | highest / lowest kit after |');
  console.log('|---|' + kits.map(() => '---').join('|') + '|---|---|');
  for (const m of modes) {
    const v = kits.map(k => a.cells[k + '|' + m].supers), lo = Math.min(...v), hi = Math.max(...v);
    console.log(`| ${m} (${b.modes[m].secs} -> ${a.modes[m].secs}) | ` + kits.map(k => { const x = b.cells[k + '|' + m], y = a.cells[k + '|' + m]; return `${x.supers.toFixed(2)} -> ${y.supers.toFixed(2)} (${x.max} -> ${y.max})`; }).join(' | ') + ` | ${b.modes[m].ai.toFixed(2)} -> ${a.modes[m].ai.toFixed(2)} (${b.modes[m].aiMax} -> ${a.modes[m].aiMax}) | ${(hi / Math.max(0.01, lo)).toFixed(2)} |`);
  }
  const v = kits.map(k => a.kits[k].supers);
  console.log('| **all modes** | ' + kits.map(k => `**${b.kits[k].supers.toFixed(2)} -> ${a.kits[k].supers.toFixed(2)}** (${b.kits[k].max} -> ${a.kits[k].max})`).join(' | ') + ` | **${b.all.ai.toFixed(2)} -> ${a.all.ai.toFixed(2)}** (${b.all.aiMax} -> ${a.all.aiMax}) | **${(Math.max(...v) / Math.min(...v)).toFixed(2)}** |`);
  console.log('| supers\' share of the damage the pilot dealt | ' + kits.map(k => `${pc(b.kits[k].share)} -> ${pc(a.kits[k].share)}`).join(' | ') + ` | ${pc(b.all.aiShare)} -> ${pc(a.all.aiShare)} | |`);
  console.log('| hull removed per super | ' + kits.map(k => `${b.kits[k].perSuper} -> ${a.kits[k].perSuper}`).join(' | ') + ' | | |');
  if (a.all.barsDealt + a.all.barsTaken > 0) console.log('| charge offered before the cap, bars a round (from dealt + received) | ' + kits.map(k => `${a.kits[k].barsDealt.toFixed(1)} + ${a.kits[k].barsTaken.toFixed(1)}`).join(' | ') + ` | ${a.all.aiBarsDealt.toFixed(1)} + ${a.all.aiBarsTaken.toFixed(1)} | dealt ${pc(a.all.barsDealt / (a.all.barsDealt + a.all.barsTaken))} |`);
}
