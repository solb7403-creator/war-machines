// Markdown tables from combat-sim.mjs outputs: node dev/tests/combat-report.mjs before.json after.json
import fs from 'node:fs';
const [b, a] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const gears = ['stock', 'common', 'rare', 'epic', 'legend'], scen = [...new Set(Object.keys(a).map(k => k.split(' ').slice(0, 2).join(' ')))];
const cell = (t, s, g) => { const r = t[s + ' ' + g]; return r ? (r.place !== undefined ? Math.round(r.win * 100) + '% (#' + r.place + ')' : Math.round((r.win + r.draw / 2) * 100) + '%') : '-'; };
console.log('| Mode | ' + gears.map(g => g + ' before → after').join(' | ') + ' |');
console.log('|---|' + gears.map(() => '---').join('|') + '|');
for (const s of scen) console.log('| ' + s + ' | ' + gears.map(g => cell(b, s, g) + ' → ' + cell(a, s, g)).join(' | ') + ' |');
console.log('\nFocus fire (share of samples with 2+ enemies locked on you, while 2+ alive) and ally share of your team\'s damage, stock / legend:');
console.log('| Mode | focus2+ before | focus2+ after | ally share before | ally share after | first death is you, before → after |');
console.log('|---|---|---|---|---|---|');
for (const s of scen) { const f = (t, g, k) => (t[s + ' ' + g] && t[s + ' ' + g][k] !== null && t[s + ' ' + g][k] !== undefined ? t[s + ' ' + g][k] : '-');
  console.log('| ' + s + ' | ' + f(b, 'stock', 'focus2plus') + ' / ' + f(b, 'legend', 'focus2plus') + ' | ' + f(a, 'stock', 'focus2plus') + ' / ' + f(a, 'legend', 'focus2plus') + ' | ' + f(b, 'stock', 'allyShare') + ' / ' + f(b, 'legend', 'allyShare') + ' | ' + f(a, 'stock', 'allyShare') + ' / ' + f(a, 'legend', 'allyShare') + ' | ' + f(b, 'stock', 'firstDeathMe') + '→' + f(a, 'stock', 'firstDeathMe') + ' (stock), ' + f(b, 'legend', 'firstDeathMe') + '→' + f(a, 'legend', 'firstDeathMe') + ' (legend) |'); }
console.log('\nSurvival: megatank damage dealt (%) and fight length (s), before → after:');
for (const s of scen.filter(s => s.startsWith('boss'))) console.log('- ' + s + ': ' + gears.map(g => g + ' ' + b[s + ' ' + g].bossDown + '%/' + b[s + ' ' + g].secs + 's → ' + a[s + ' ' + g].bossDown + '%/' + a[s + ' ' + g].secs + 's').join(', '));
