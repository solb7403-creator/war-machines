// AI-match combat balance and integrity, on the REAL phone code (js/rules.js + js/game.js + js/match.js via combat-sim.mjs).
// Fast enough for CI. The full before/after measurement is `node dev/tests/combat-sim.mjs` (see docs/combat-balance-audit.md).
// Run from the repository root: node dev/tests/combat-balance.mjs
import assert from 'node:assert/strict';
import { makeWorld, GEAR, MAPS4 } from './combat-sim.mjs';
const W = makeWorld(), J = JSON.stringify;
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// 1. AI levels: authored powers are what powerOf says and rise; the AI power never tops yours and grows slower than yours
const tiers = W.eval(`AI_TIERS.map((A,i)=>({p:A.p,real:powerOf(aiLoadout(i,'pulse','vanguard'))}))`);
tiers.forEach((t, i) => { ok(t.p === t.real, 'AI level ' + i + ' power ' + t.p + ' vs powerOf ' + t.real); if (i) ok(t.p > tiers[i - 1].p, 'levels rise'); });
let lastEdge = 0;
for (let pw = 68; pw <= 400; pw += 2) {
  const a = W.eval(`aiLevel(${pw})`), b = W.eval(`aiLevel(${pw},AI_BOSS_EXP)`), edge = pw / a.p;
  ok(a.p <= pw && b.p <= pw && tiers[a.i].p === a.p, 'AI power ' + a.p + ' and boss ' + b.p + ' never above yours (' + pw + ')');
  ok(edge >= lastEdge - 0.02, 'your edge over the AI never shrinks as your power rises (' + pw + ': ' + edge.toFixed(3) + ')'); lastEdge = Math.max(lastEdge, edge);
}
ok(W.eval('aiLevel(68).p') === 68 && W.eval('aiLevel(68).i') === 0, 'a starter tank meets starter AI, as before');

// 2. AI pilots never copy your tank: same AI level + same seed = the very same AI roster, whatever gear you field (your chassis
// class held fixed: the counter triangle is dealt against your class on purpose, see fairField)
const roster = (L, g, m, seed) => W.run({ g, m, map: 'classic', seed, mp: 50, L, forceTier: 3, dt: 1 / 30, maxSteps: 1 }).roster.filter(u => u.ai);
for (const [g, m] of [['arena', '3v3'], ['royale', '1v1'], ['boss', '3v3'], ['zone', '2v2']]) {
  const base = J(roster(GEAR.stock, g, m, 77));
  for (const k of ['common', 'rare', 'epic', 'legend']) ok(J(roster({ ...GEAR[k], c: { ...GEAR[k].c, c: 'vanguard' }, chs: undefined }, g, m, 77)) === base, g + ' ' + m + ': AI roster independent of your gear (' + k + ')');
}
// the megatank: fixed by its level, not by your tank; stomps and shells sized to the level's reference tank
const boss = L => W.eval(`(()=>{MM={n:1,series:false,mp:50};matchG='boss';const me=Object.assign(tankOf(${J(L)},hpScale()),{});const b=mkBoss(me,1,aiLevel(120));return [b.mhp,b.wdps,b.bt.ref];})()`);
ok(J(boss(GEAR.stock)) === J(boss(GEAR.legend)), 'megatank independent of your tank');

// 3. Advertised gear is in the tank you field: Moonbeam DPS + Legendary super scale, Lunar Skin +8% HP and damage, chassis tiers; Gold Plate is looks only
const T = L => W.eval(`tankOf(${J(L)},1)`);
const moon = T(GEAR.legend), noSkin = T({ ...GEAR.legend, skin: 'default' }), noGold = T({ ...GEAR.legend, paint: 'stock' });
ok(moon.wtype === 'moon' && moon.wdps === 118 && moon.wmult === W.eval('LEGENDARY_MULT'), 'Moonbeam fields 118 DPS and the Legendary super multiplier');
ok(Math.abs(moon.mhp / noSkin.mhp - 1.08) < 0.002 && Math.abs(moon.dmgM / noSkin.dmgM - 1.08) < 1e-9, 'Lunar Skin: +8% health and damage');
ok(J({ ...moon, paint: 0 }) === J({ ...noGold, paint: 0 }) && W.eval(`powerOf(${J(GEAR.legend)})===powerOf(${J({ ...GEAR.legend, paint: 'stock' })})`), 'Gold Plate changes nothing but looks');
for (const c of ['scout', 'vanguard', 'titan']) { const hp = [0, 1, 2].map(t => T({ ...GEAR.stock, c: { c, t, q: 1, s: false } }).mhp); ok(hp[0] < hp[1] && hp[1] < hp[2], c + ' rarity raises health'); }

// the bay you activate is the tank you field (two machine bays; a premium kit in bay 2, starter kit in bay 1)
const bays = W.eval(`(()=>{const S=ecoNorm({});S.mig=1;S.moonbeam=true;S.skin='lunar';S.cOwn.titan=[2];S.roll={'titan:2':1.1};S.paints.gold=true;S.L=JSON.parse(JSON.stringify(STOCK_L));labEnsure(S);
 const spec={w:{a:'moon',t:2,s:false},c:{c:'titan',t:2,s:false},cores:['dmg','rof','arm'],paint:'gold',mods:{},catalog:FIT_VERSION};
 const a=labAction(S,'lab_save',{id:'m_spare',rev:S.lab.rev,name:'Lunar',spec}),b=labAction(S,'lab_activate',{id:'m_spare',rev:S.lab.rev});
 const L2=labLoadout(S),T2=tankOf(L2,1);labAction(S,'lab_activate',{id:'m_legacy',rev:S.lab.rev});const L1=labLoadout(S);
 return {a,b,w2:L2.w.a,c2:L2.c.c+L2.c.t+':'+L2.c.q,skin2:L2.skin,paint2:L2.paint,mhp2:T2.mhp,w1:L1.w.a,c1:L1.c.c+L1.c.t,skin1:L1.skin};})()`);
ok(bays.a.ok && bays.b.ok, 'bay 2 saved and activated');
ok(bays.w2 === 'moon' && bays.c2 === 'titan2:1.1' && bays.paint2 === 'gold' && bays.skin2 === 'lunar' && bays.mhp2 === Math.round(1700 * 1.34 * 1.1 * 1.3 * 1.08), 'bay 2 fields Moonbeam + Epic Titan (Colossus) + Lunar Skin: ' + J(bays));
ok(bays.w1 === 'pulse' && bays.c1 === 'vanguard0' && bays.skin1 === 'lunar', 'bay 1 still fields its own (starter) kit; the account-wide skin applies to both');

// 4. Same encounter, same seeds: your result never gets worse as your gear improves, and starter -> Legendary is a big step
const SEEDS = +(process.env.SEEDS || 6), score = r => (r.out === 'win' ? 1 : r.out === 'draw' ? 0.5 : 0);
const ladder = ['stock', 'common', 'rare', 'epic', 'legend'], table = {};
for (const [g, m, tier] of [['arena', '3v3', 3], ['royale', '1v1', 3], ['boss', '1v1', 4], ['arena', '2v2', 5]]) {
  const rates = ladder.map(k => { let s = 0, dmg = 0; for (let i = 1; i <= SEEDS; i++) { const r = W.run({ g, m, map: MAPS4[i % 4], seed: 500 + i * 104729, mp: 50, L: GEAR[k], pilot: 'casual', forceTier: tier, dt: 1 / 30 }); s += score(r); dmg += r.dmg; } return { w: s / SEEDS, dmg: dmg / SEEDS }; });
  table[g + ' ' + m + ' @L' + (tier + 1)] = rates.map(r => r.w.toFixed(2)).join(' ');
  for (let i = 1; i < rates.length; i++) ok(rates[i].w >= rates[i - 1].w - 1 / SEEDS - 1e-9, g + ' ' + m + ': ' + ladder[i] + ' not worse than ' + ladder[i - 1] + ' (' + rates.map(r => r.w.toFixed(2)) + ')');
  ok(rates[4].w - rates[0].w >= 0.3, g + ' ' + m + ': starter -> Legendary is a material gain (' + rates[0].w + ' -> ' + rates[4].w + ')');
}

// 5. Every mode and team size finishes (no softlock, no immortal enemy, finite health), Arena 1v1 as a real best of 3
for (const [g, m] of [['arena', '1v1'], ['arena', '2v2'], ['arena', '3v3'], ['zone', '1v1'], ['zone', '3v3'], ['crystal', '2v2'], ['bounty', '3v3'], ['royale', '1v1'], ['boss', '1v1'], ['boss', '2v2'], ['boss', '3v3']])
  for (const k of ['stock', 'legend']) for (const map of MAPS4) {
    const r = W.run({ g, m, map, seed: 31337, mp: 50, L: GEAR[k], dt: 1 / 30 });
    ok(['win', 'draw', 'loss'].includes(r.out) && r.secs <= 182 * (r.series ? 5 : 1), g + ' ' + m + ' ' + map + ' ' + k + ' finishes');
    if (g === 'arena' && m === '1v1') ok(r.series && Math.max(...r.series) <= 3 && (r.series[0] >= 2 || r.series[1] >= 2 || r.series[0] + r.series[1] <= 5), 'best of 3 resolves');
    if (g === 'boss' && r.out === 'win') ok(r.bossLeft === 0, 'a Survival win means the megatank is down');
  }

// 6. Ghosts in AI matches: only tanks clearly weaker than yours, and at most one on the other side
const gh = W.eval(`(()=>{const out=[];for(const [g,m] of [['arena','1v1'],['arena','3v3'],['royale','1v1']]){
 setMap('classic');matchG=g;battleLoadout=${J(GEAR.epic)};battlePower=powerOf(battleLoadout);MM={n:MODES[m].n,series:false,mp:50,cp:false};populatePreparedMatch();
 const strong=${J(GEAR.legend)},weak=${J(GEAR.rare)};placeGhosts([{i:0,n:'A',L:strong},{i:1,n:'B',L:weak},{i:2,n:'C',L:weak}]);
 const g2=units.filter(u=>u.gh);out.push({g,m,n:g2.length,foes:g2.filter(u=>u.team!==me.team).length,strong:g2.some(u=>u.gid===0),cap:Math.max(0,...g2.map(u=>powerOf(${J(GEAR.rare)})/battlePower))});}return out;})()`);
for (const x of gh) { ok(!x.strong, x.g + ' ' + x.m + ': a stronger ghost is never placed'); ok(x.foes <= 1, x.g + ' ' + x.m + ': at most one enemy ghost'); }

console.log('same-encounter win rates (casual pilot, stock common rare epic legend):', table);
console.log('PASS combat balance:', checks, 'checks');
