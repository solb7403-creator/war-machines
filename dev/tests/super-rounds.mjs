// SUPER ROUNDS (Session 5E-2b2b): supers PER PLAYER PER ROUND, in every Arcade mode and team size, for the pilot and for every
// AI pilot, plus the supers' share of all damage and how long a round lasts. Measured on the REAL phone code (combat-sim.mjs:
// js/rules.js + js/game.js + js/match.js), seeded, all six maps. A round is one round of a best of 3 (Arena 1v1) or the whole
// match in every other mode. Works on any checkout (COMBAT_SRC=<path>), so the same tool measures before and after.
// usage: [COMBAT_SRC=<checkout>] [SEEDS=2] [PILOT=human|standard|casual|expert] [SET=ladder|weapons|chassis|reactor|owner|all]
//        node dev/tests/super-rounds.mjs [out.json]
import fs from 'node:fs';
import { GEAR } from './combat-sim.mjs';
import { runJobs } from './s2/pool.mjs';
export const RR_MODES = [['arena', '1v1'], ['arena', '2v2'], ['arena', '3v3'], ['zone', '1v1'], ['zone', '2v2'], ['zone', '3v3'], ['crystal', '1v1'], ['crystal', '2v2'], ['crystal', '3v3'],
  ['bounty', '1v1'], ['bounty', '2v2'], ['bounty', '3v3'], ['royale', '1v1'], ['boss', '1v1'], ['boss', '2v2'], ['boss', '3v3']];
export const RR_MAPS = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'];
export const RR_SEEDS = [71, 419, 2027, 9803, 65537, 1201, 3307, 7919];
const W = (a, t) => ({ a, t, q: a === 'moon' ? 1 : 1.05, s: false });
const C = (c, t, q) => ({ c, t, q: q || (t > 0 ? 1.08 : 1), s: false });
const R0 = L => ({ ...L, up: { ...L.up, reactor: 0 } });   // the gear-fairness check compares pilots at EQUAL Reactor levels (owner)
// [key, loadout, league]: the gear ladder at Reactor 0, each kit in the league a pilot with that kit plays in
export const RR_LADDER = [
  ['stock', R0(GEAR.stock), 0], ['common', R0(GEAR.common), 1], ['rare', R0(GEAR.rare), 2], ['epic', R0(GEAR.epic), 4], ['legend', R0(GEAR.legend), 6]];
export const RR_WEAPONS = [
  ['pulse0', R0({ ...GEAR.stock, w: W('pulse', 0) }), 0], ['twin0', R0({ ...GEAR.stock, w: W('twin', 0) }), 0], ['siege0', R0({ ...GEAR.stock, w: W('siege', 0) }), 0],
  ['pulse1', R0({ ...GEAR.rare, w: W('pulse', 1) }), 2], ['twin1', R0({ ...GEAR.rare, w: W('twin', 1) }), 2], ['siege1', R0({ ...GEAR.rare, w: W('siege', 1) }), 2],
  ['pulse2', R0({ ...GEAR.epic, w: W('pulse', 2) }), 4], ['twin2', R0({ ...GEAR.epic, w: W('twin', 2) }), 4], ['siege2', R0({ ...GEAR.epic, w: W('siege', 2) }), 4],
  ['moon', R0(GEAR.legend), 6]];
export const RR_CHASSIS = [
  ['stock scout', R0({ ...GEAR.stock, c: C('scout', 0) }), 0], ['stock vanguard', R0({ ...GEAR.stock, c: C('vanguard', 0) }), 0], ['stock titan', R0({ ...GEAR.stock, c: C('titan', 0) }), 0],
  ['epic scout', R0({ ...GEAR.epic, c: C('scout', 2) }), 4], ['epic vanguard', R0({ ...GEAR.epic, c: C('vanguard', 2) }), 4], ['epic titan', R0({ ...GEAR.epic, c: C('titan', 2) }), 4],
  ['legend scout', R0({ ...GEAR.legend, c: C('scout', 2, 1.1), chs: undefined }), 6], ['legend vanguard', R0({ ...GEAR.legend, c: C('vanguard', 2, 1.1), chs: undefined }), 6], ['legend titan', R0({ ...GEAR.legend, chs: undefined }), 6]];
// the Reactor keeps +10% charge a level: the same kit at Reactor 0 / 2 / 4
const RX = (L, n) => ({ ...L, up: { ...L.up, reactor: n, engine: 0 } });
export const RR_REACTOR = [['rare reactor 0', RX(GEAR.rare, 0), 2], ['rare reactor 2', RX(GEAR.rare, 2), 2], ['rare reactor 4', RX(GEAR.rare, 4), 2],
  ['legend reactor 0', RX(GEAR.legend, 0), 6], ['legend reactor 2', RX(GEAR.legend, 2), 6], ['legend reactor 4', RX(GEAR.legend, 4), 6]];
// the owner's case: the top kit (as he flies it, Reactor 2) against the AI of his own league and of lower leagues (weaker bots)
export const RR_OWNER = [['legend @Lunar Legend', GEAR.legend, 6], ['legend @Elite', GEAR.legend, 4], ['legend @Veteran', GEAR.legend, 2], ['legend @Rookie', GEAR.legend, 0],
  ['stock @Rookie', GEAR.stock, 0]];
export const RR_SETS = { ladder: RR_LADDER, weapons: RR_WEAPONS, chassis: RR_CHASSIS, reactor: RR_REACTOR, owner: RR_OWNER };
// per round, per tank: supers fired, hull removed by its supers, hull removed by everything it did. Rides back in the ability ledger
const PATCH = `
var __rr=[],__rc=null;
function __rrNew(){__rc={secs:0,u:units.map(u=>({n:0,sd:0,d:0,tk:0,cd:0,ct:0,me:u===me,team:u.team,boss:!!u.boss}))};__rr.push(__rc);}
{const th=takeHit;takeHit=function(r,amt,src,why,kind,c,d,b){const h0=Math.max(0,r.hp),v=th(r,amt,src,why,kind,c,d,b),rem=h0-Math.max(0,r.hp);
 if(__rc&&src&&__rc.u[src.id]&&src.team!==r.team){const q=__rc.u[src.id];q.d+=rem;if(kind===1)q.sd+=rem;}if(__rc&&__rc.u[r.id])__rc.u[r.id].tk+=rem;return v;};}
{const fs0=fireSuper;fireSuper=function(r,S){if(__rc&&__rc.u[r.id])__rc.u[r.id].n++;return fs0(r,S);};}
if(typeof supAdd==='function'){const sa=supAdd;supAdd=function(u,pts,side){if(__rc&&__rc.u[u.id]&&pts>0&&!u.boss)__rc.u[u.id][side?'ct':'cd']+=pts;return sa(u,pts,side);};}   // charge offered (before the cap), by source
{const s0=simStart;simStart=function(){const v=s0();__rrNew();return v;};}
{const s1=simRound;simRound=function(){const v=s1();__rrNew();return v;};}
{const up=update;update=function(dt){const v=up(dt);if(__rc&&state==='play')__rc.secs=elapsed;return v;};}
{const r0=__run;__run=function(cfg){__rr=[];__rc=null;const r=r0(cfg);if(r.ab)r.ab.rr=__rr.map(x=>({secs:+x.secs.toFixed(1),u:x.u.map(q=>[q.me?1:0,q.team,q.boss?1:0,q.n,Math.round(q.sd),Math.round(q.d),Math.round(q.tk),Math.round(q.cd),Math.round(q.ct)])}));return r;};}
`;
const mk0 = () => ({ rounds: 0, sup: 0, sd: 0, d: 0, secs: 0, hist: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], max: 0, aiN: 0, aiSup: 0, aiMax: 0, aiSd: 0, aiD: 0, aiHist: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], cd: 0, ct: 0, aiCd: 0, aiCt: 0 });
const fin = c => ({ rounds: c.rounds, secs: Math.round(c.secs / Math.max(1, c.rounds)), supers: +(c.sup / Math.max(1, c.rounds)).toFixed(2), max: c.max, over3: +(c.hist.slice(4).reduce((a, b) => a + b, 0) / Math.max(1, c.rounds)).toFixed(3),
  hist: c.hist.slice(0, c.max + 1), share: +(c.sd / Math.max(1, c.d)).toFixed(3), perSuper: Math.round(c.sd / Math.max(1, c.sup)), perMin: +(c.sup / Math.max(1, c.secs) * 60).toFixed(2),
  ai: +(c.aiSup / Math.max(1, c.aiN)).toFixed(2), aiMax: c.aiMax, aiShare: +(c.aiSd / Math.max(1, c.aiD)).toFixed(3), aiOver3: +(c.aiHist.slice(4).reduce((a, b) => a + b, 0) / Math.max(1, c.aiN)).toFixed(3),
  barsDealt: +(c.cd / 1000 / Math.max(1, c.rounds)).toFixed(2), barsTaken: +(c.ct / 1000 / Math.max(1, c.rounds)).toFixed(2), aiBarsDealt: +(c.aiCd / 1000 / Math.max(1, c.aiN)).toFixed(2), aiBarsTaken: +(c.aiCt / 1000 / Math.max(1, c.aiN)).toFixed(2), aiHist: c.aiHist.slice(0, c.aiMax + 1) });
export async function superRounds({ seeds = 2, pilot = 'human', kits = RR_LADDER, modes = RR_MODES, maps = RR_MAPS, patch = '', dt = 1 / 30 } = {}) {
  const jobs = [], keys = [];
  for (const [key, L, lg] of kits) for (const [g, m] of modes) for (const map of maps) for (const seed of RR_SEEDS.slice(0, seeds)) { jobs.push({ kind: 'ai', cfg: { g, m, map, seed, mp: 50, L: JSON.parse(JSON.stringify(L)), pilot, lg, dt } }); keys.push([key, g + ' ' + m]); }
  const res = await runJobs(jobs, { patch: patch + PATCH });
  const cell = {}, byKit = {}, byMode = {}, all = mk0();
  res.forEach((r, i) => { const [key, mk] = keys[i];
    for (const rd of r.ab.rr) for (const t of [cell[key + '|' + mk] ||= mk0(), byKit[key] ||= mk0(), byMode[mk] ||= mk0(), all]) {
      t.rounds++; t.secs += rd.secs;
      for (const [isMe, , isBoss, n, sd, d, , cd = 0, ct = 0] of rd.u) { if (isBoss) continue;
        if (isMe) { t.cd += cd; t.ct += ct; t.sup += n; t.sd += sd; t.d += d; t.hist[Math.min(10, n)]++; t.max = Math.max(t.max, n); }
        else { t.aiCd += cd; t.aiCt += ct; t.aiN++; t.aiSup += n; t.aiSd += sd; t.aiD += d; t.aiMax = Math.max(t.aiMax, n); t.aiHist[Math.min(10, n)]++; } } } });
  const map2 = o => Object.fromEntries(Object.entries(o).map(([k, c]) => [k, fin(c)]));
  return { pilot, seeds, matches: jobs.length, all: fin(all), kits: map2(byKit), modes: map2(byMode), cells: map2(cell) };
}
export function printRounds(R, title) {
  const kits = Object.keys(R.kits), modes = Object.keys(R.modes);
  console.log('\n== ' + title + ': supers per player per round (pilot ' + R.pilot + ', ' + R.matches + ' matches) ==');
  console.log('mode'.padEnd(13) + 'secs'.padStart(5) + kits.map(k => k.slice(0, 17).padStart(18)).join('') + '   AI avg/max  ratio(hi/lo)');
  for (const m of modes) { const v = kits.map(k => R.cells[k + '|' + m]); const s = v.map(c => c.supers), lo = Math.min(...s), hi = Math.max(...s);
    console.log(m.padEnd(13) + String(R.modes[m].secs).padStart(5) + v.map(c => (c.supers.toFixed(2) + ' (' + c.max + ', ' + (c.share * 100).toFixed(0) + '%)').padStart(18)).join('') + '   ' + R.modes[m].ai.toFixed(2) + '/' + R.modes[m].aiMax + '   ' + (hi / Math.max(0.01, lo)).toFixed(2)); }
  console.log('ALL'.padEnd(18) + kits.map(k => (R.kits[k].supers.toFixed(2) + ' (' + R.kits[k].max + ', ' + (R.kits[k].share * 100).toFixed(0) + '%)').padStart(18)).join('') + '   ' + R.all.ai.toFixed(2) + '/' + R.all.aiMax);
  console.log('cell: supers a round (most in one round, supers share of the damage the pilot dealt)');
  if (R.all.barsDealt + R.all.barsTaken > 0) { console.log('charge offered before the cap, bars a round: pilot dealt+received (share from dealt) | AI pilots dealt+received');
    for (const m of modes) { const c = R.modes[m]; console.log(m.padEnd(13) + (c.barsDealt.toFixed(2) + '+' + c.barsTaken.toFixed(2) + ' = ' + (c.barsDealt + c.barsTaken).toFixed(2) + ' (' + Math.round(c.barsDealt / Math.max(0.01, c.barsDealt + c.barsTaken) * 100) + '%)').padStart(26) + ' | ' + (c.aiBarsDealt.toFixed(2) + '+' + c.aiBarsTaken.toFixed(2) + ' = ' + (c.aiBarsDealt + c.aiBarsTaken).toFixed(2)).padStart(20) + '   by kit: ' + kits.map(k => { const q = R.cells[k + '|' + m]; return (q.barsDealt + q.barsTaken).toFixed(1); }).join(' ')); } }
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const t0 = Date.now(), set = process.env.SET || 'ladder', out = {};
  for (const s of set === 'all' ? Object.keys(RR_SETS) : set.split(',')) {
    const R = await superRounds({ seeds: +(process.env.SEEDS || 2), pilot: process.env.PILOT || 'human', kits: RR_SETS[s], modes: process.env.MODES ? RR_MODES.filter(([g, m]) => process.env.MODES.split(',').includes(g + ' ' + m) || process.env.MODES.split(',').includes(g)) : RR_MODES });
    printRounds(R, s); out[s] = R; }
  console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(0), 's');
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
}
