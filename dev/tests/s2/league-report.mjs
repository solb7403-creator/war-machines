// League report + checks (item 4), from league-grid.mjs output and today's table (origin/main, ai-table.mjs).
// usage: node dev/tests/s2/league-report.mjs today.json grid-standard.json grid-casual-expert.json > LEAGUES-tables.md
import fs from 'node:fs';
const R = new Function(fs.readFileSync('js/rules.js', 'utf8') + ';return {LEAGUE,leagueIdx,leagueRating,powerOf,LG_AI,LG_TEAM_W:{1:1,2:1,3:1,solo:1},LG_BASE_PAY,LG_MULT};')();
const { GEAR } = await import('../combat-sim.mjs');
const today = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), G = {};
for (const f of process.argv.slice(3)) { const g = JSON.parse(fs.readFileSync(f, 'utf8')); for (const lg in g) for (const p in g[lg]) ((G[p] ||= {})[lg] = g[lg][p]); }
const kits = Object.keys(GEAR), pilots = Object.keys(G), lgs = [0, 1, 2, 3, 4, 5, 6], LN = (i) => R.LEAGUE[i].n;
const scs = Object.keys(today.standard), avg = (T, k, f = (s) => true) => { const xs = Object.keys(T).filter(f); return xs.reduce((a, s) => a + T[s][k].win, 0) / xs.length; };
const is3 = (s) => s.endsWith('3v3'), pct = (x) => (x * 100).toFixed(0) + '%';
const out = [], checks = [];
const check = (ok, msg) => { checks.push((ok ? 'PASS ' : 'MISS ') + msg); };
// settled league: form = the average result over the 11 setups at that league; iterate the real league rule from Rookie
function settle(p, k) { let lg = 0, seen = []; for (let it = 0; it < 30; it++) { const T = G[p][lg]; if (!T) break; const w = avg(T, k), n = R.leagueIdx(R.leagueRating(R.powerOf(GEAR[k]), w, 50), lg); seen.push(lg); if (n === lg) return { lg, w }; lg = n; } return { lg, w: avg(G[p][lg], k), osc: seen.slice(-4) }; }
const settled = {};
out.push('## Where each kit settles (league rating = power x (0.8 + 0.4 x form), form = average result over the 11 setups)\n');
out.push('| Kit | Power | ' + pilots.map((p) => p + ': league (form)').join(' | ') + ' |'); out.push('|---|---:|' + pilots.map(() => '---|').join(''));
for (const k of kits) { out.push('| ' + k + ' | ' + R.powerOf(GEAR[k]) + ' | ' + pilots.map((p) => { const s = settle(p, k); (settled[p] ||= {})[k] = s; return LN(s.lg) + ' (' + pct(s.w) + ')' + (s.osc ? ' *' : ''); }).join(' | ') + ' |'); }
out.push('\n## Win rate by league (average of the 11 setups), today vs new\n');
for (const p of pilots) { out.push('**' + p + ' pilot** (today = origin/main 8df6500, same harness and seeds)\n');
  out.push('| Kit | Today | ' + lgs.map(LN).join(' | ') + ' |'); out.push('|---|---:|' + lgs.map(() => '---:|').join(''));
  for (const k of kits) out.push('| ' + k + ' | ' + pct(avg(today[p], k)) + ' | ' + lgs.map((l) => (G[p][l] ? pct(avg(G[p][l], k)) : '-')).join(' | ') + ' |'); out.push(''); }
out.push('## Settled table: every mode x team size, in the league each kit settles in (today in brackets)\n');
for (const p of pilots) { out.push('**' + p + ' pilot**\n'); out.push('| Setup | ' + kits.map((k) => k + ' (' + LN(settled[p][k].lg) + ')').join(' | ') + ' |'); out.push('|---|' + kits.map(() => '---:|').join(''));
  for (const s of scs) out.push('| ' + s + ' | ' + kits.map((k) => { const c = G[p][settled[p][k].lg][s][k], t = today[p][s][k]; return pct(c.win) + (s.startsWith('royale') ? ' p' + c.place : '') + ' (' + pct(t.win) + ')'; }).join(' | ') + ' |'); out.push(''); }
// ---- checks ----
for (const k of kits) for (const l of [0, 1]) { const d = avg(G.standard[l], k) - avg(today.standard, k); if (settled.standard[k].lg === l || l === 0) check(Math.abs(d) <= 0.03 + 1e-9, 'Rookie/Pilot: ' + k + ' at ' + LN(l) + ' within 3 points of today (' + (d * 100).toFixed(1) + ')'); }
for (const k of kits) for (const l of lgs) { const d = avg(G.standard[l], k, is3) - avg(today.standard, k, is3); check(Math.abs(d) <= 0.04 + 1e-9, '3v3: ' + k + ' at ' + LN(l) + ' within 4 points of today (' + (d * 100).toFixed(1) + ', n=' + 3 * G.standard[l]['arena 3v3'][k].n + ')'); }
for (const k of kits) { const ws = lgs.map((l) => avg(G.standard[l], k)), steps = ws.slice(1).map((w, i) => ws[i] - w); check(ws[6] < ws[0] - 0.02, k + ': Lunar Legend measurably harder than Rookie (' + pct(ws[0]) + ' -> ' + pct(ws[6]) + '; steps ' + steps.map((x) => (x * 100).toFixed(1)).join(' ') + ')'); }
{ const T = G.standard[6], w = avg(T, 'legend'), w1 = T['arena 1v1'].legend.win; check(w >= 0.70 && w <= 0.75, 'Lunar Legend, full Legendary, standard: overall ' + pct(w) + ' (target 70-75%)'); check(w1 >= 0.70 && w1 <= 0.75, 'Lunar Legend, full Legendary, standard: 1v1 Arena ' + pct(w1) + ' (target 70-75%)'); }
if (G.expert) { const e = avg(G.expert[6], 'legend'), s = avg(G.standard[6], 'legend'); check(e - s >= 0.10, 'expert vs standard at Lunar Legend, full Legendary: ' + pct(e) + ' vs ' + pct(s) + ' (+10 needed)'); }
if (G.casual) { for (const k of kits) { const c = avg(G.casual[settled.casual[k].lg], k), s = avg(G.standard[settled.casual[k].lg], k); check(c <= s + 0.01, 'casual below standard: ' + k + ' ' + pct(c) + ' vs ' + pct(s)); }
  for (const k of kits) { const L = settled.casual[k].lg, T = G.casual[L]; for (const sc of scs) { const c = T[sc][k]; const ok = sc.startsWith('royale') ? c.place <= 3.5 : c.win >= 0.45;
      check(ok, 'floor: casual ' + k + ' in ' + LN(L) + ', ' + sc + ': ' + (sc.startsWith('royale') ? 'place ' + c.place : pct(c.win)) + (ok ? '' : ' (today ' + (sc.startsWith('royale') ? 'place ' + today.casual[sc][k].place : pct(today.casual[sc][k].win)) + ')')); } } }
out.push('## Checks\n'); out.push(...checks.map((c) => '- ' + c));
console.log(out.join('\n'));
console.error(checks.filter((c) => c.startsWith('MISS')).length + ' misses of ' + checks.length + ' checks');
