// SUPER TIMING regression (Session 5E-2b, owner decisions Nov 10-11 2026). Runs the REAL shared code (js/rules.js + js/game.js
// + worker/sim-api.js: the phone's AI match and the live-match server; js/conquest/controls.js for Conquest) and holds:
//  1. the timing bar: three outcomes, the worst tap = 65% of a normal one (owner range 60-70%), the jackpot bonus capped,
//     the jackpot always inside the normal zone, no tap = MISS, the super never fires before the weapon's own telegraph
//  2. server authority: the sim draws the bar and its own clock judges the tap; a forged or mistimed "jackpot" claim is
//     ignored, a second tap changes nothing, the phone's time only counts inside the latency allowance
//  3. AI pilots use the same bar with a tap skill set by their league: worse than an average person in every league,
//     better in higher leagues, never perfect
//  4. per-weapon rule: a slow weapon's super hits harder per use than a fast one's; a higher tier hits harder
//  5. about 3 supers a match and total super damage per match within 10% of main before the change (seeded matches,
//     dev/tests/fixtures/super-baseline.json measured on main by dev/tests/super-report.mjs)
//  6. Conquest: the same bar through the command stream the Worker replays (deterministic, second press judged)
// usage: node dev/tests/super-timing.mjs   (SEEDS=1 for a faster, noisier part 5)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorld, GEAR } from './combat-sim.mjs';
import { superReport } from './super-report.mjs';
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rd = f => fs.readFileSync(path.join(repo, f), 'utf8').replace(/^'use strict';[^\n]*\n/m, '');
let checks = 0; const fails = [];
const ok = (c, m) => { checks++; if (!c) { fails.push(m); console.log('FAIL', m); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const DT = 1 / 30;
function sim(seed = 7) {
  let s = seed; const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const body = '"use strict";\nconst Math=Object.create(globalThis.Math);Math.random=RAND;\n' + rd('js/rules.js') + rd('js/game.js') +
    'const __api=(function(){' + rd('worker/sim-api.js') + '})();\n' +
    'return Object.assign(__api,{los:(a,b)=>los(a,b),SUPS:SUP,setState:v=>{state=v;},walls:()=>walls,rocks:()=>rocks,supMult:r=>supMult(r),K:{SUP_BAR_T,SUP_ZONE_W,SUP_JACK_W,SUP_REL,SUP_TAP_TOL,SUP_OC,SUP_TAP_HUMAN,LG_AI_TAP,SUP_KEYS,SUPER_MAX,SUP_GEAR,SUP_GEAR_AI},supBar,supJudge,supKey});';
  return new Function('HOST', 'RAND', body)({ ev() {}, end() {}, round() {}, death() {}, random: rand }, rand);
}
const L = (w = 'pulse', t = 0) => ({ w: { a: w, t: w === 'moon' ? 2 : t, q: 1, s: false }, c: { c: 'vanguard', t: 0, q: 1, s: false }, up: { hull: 0, cannon: 0, engine: 0, target: 0, reactor: 0 }, cores: ['dmg', 'rof', 'arm'], gl: {}, skin: 'default', paint: 'stock' });
function match(wpn = 'pulse', tier = 0, seats = ['h', 'h'], lg = 3) {
  const S = sim();
  S.setup({ map: 'craters', g: 'arena', m: '1v1', seats: seats.map((x, i) => x ? { pid: 'p' + i, name: 'P' + i, L: L(wpn, tier) } : null), lg });
  S.start(); S.setState('play'); S.walls().length = 0; S.rocks().length = 0;
  const U = S.units; for (const u of U) { u.sp = 0; u.cd = 99; u.shieldT = 0; u.mhp = u.hp = 1e6; }
  const put = (u, x, y) => { u.x = x; u.y = y; u.px = x; u.py = y; u.ox = x; u.oy = y; u.claim = null; u.vx = u.vy = 0; u.avx = u.avy = 0; };
  put(U[0], 10, 20); put(U[1], 10, wpn === 'twin' ? 17 : 14);
  return { S, U, r: U[0], e: U[1] };
}
// fire r's super with a fixed bar and a tap at tapEl (null: never); returns {oc, firedAt, dmg}
function fire(M, tapEl, claim) {
  const { S, r, e } = M; r.sp = 1000; e.hp = e.mhp; for (const u of S.units) u.cd = 99;
  if (!S.useSuper(r)) return null;
  r.sup.bar = { z0: 0.40, jc: 0.60 }; r.sup.tapAt = undefined;
  const hp0 = e.hp; let t = 0, oc, fired = null, tapped = false;
  for (let i = 0; i < 90; i++) {
    if (!tapped && tapEl !== null && r.sup && r.sup.el >= tapEl - 1e-9) { S.supTap(r, claim === undefined ? r.sup.el : claim); tapped = true; }
    if (r.sup && r.sup.oc !== undefined) oc = r.sup.oc;
    S.step(DT); t += DT; for (const u of S.units) u.cd = 99;
    if (!r.sup && fired === null) fired = t;
    if (fired !== null && t > fired + 1.6) break;   // a shell needs time to land
  }
  return { oc, firedAt: fired, dmg: hp0 - e.hp };
}

// ---- 1. the bar and its three outcomes ----
{ const S = sim(), K = S.K;
  ok(K.SUP_OC.length === 3 && K.SUP_OC[1] === 1, 'a NORMAL stop is the full super (x1)');
  ok(K.SUP_OC[0] >= 0.6 && K.SUP_OC[0] <= 0.7 && K.SUP_OC[0] === 0.65, 'the worst possible tap does 65% of the normal damage (owner range 60-70%): ' + K.SUP_OC[0]);
  ok(K.SUP_OC[2] > 1.1 && K.SUP_OC[2] <= 1.3, 'the jackpot bonus is felt and capped (x' + K.SUP_OC[2] + ', at most x1.3)');
  let s = 99; const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  let inside = true, spread = new Set(), minZ = 1, maxEnd = 0;
  for (let i = 0; i < 4000; i++) { const b = S.supBar(rnd); spread.add(Math.round(b.jc * 50)); minZ = Math.min(minZ, b.z0); maxEnd = Math.max(maxEnd, b.z0 + K.SUP_ZONE_W);
    if (!(b.jc - K.SUP_JACK_W / 2 >= b.z0 && b.jc + K.SUP_JACK_W / 2 <= b.z0 + K.SUP_ZONE_W)) inside = false;
    if (S.supJudge(b, b.jc * K.SUP_BAR_T) !== 2 || S.supJudge(b, (b.z0 + 0.005) * K.SUP_BAR_T) < 1 || S.supJudge(b, (b.z0 - 0.02) * K.SUP_BAR_T) !== 0 || S.supJudge(b, (b.z0 + K.SUP_ZONE_W + 0.02) * K.SUP_BAR_T) !== 0 || S.supJudge(b, 0) !== 0) inside = false; }
  ok(inside, 'every bar: the jackpot circle lies inside the normal zone; outside the zone is a MISS, inside a HIT, the circle a JACKPOT');
  ok(spread.size >= 12, 'the jackpot is placed at random (' + spread.size + ' distinct positions seen)');
  ok(minZ >= 0.3 && maxEnd <= 0.95, 'the zone never starts in the first 30% of the sweep (time to read the bar) and ends inside it (' + minZ.toFixed(2) + '..' + maxEnd.toFixed(2) + ')');
  ok(K.SUP_BAR_T >= 0.8 && K.SUP_BAR_T <= 1.5, 'the sweep is short (' + K.SUP_BAR_T + ' s)');
  ok(K.SUP_KEYS.length === 10 && new Set(K.SUP_KEYS).size === 10, 'ten supers, one per weapon item'); }
for (const [w, t] of [['pulse', 0], ['twin', 1], ['siege', 2], ['moon', 2]]) {
  const M = match(w, t), S = M.S, C = S.SUPS[w], K = S.K;
  const miss = fire(M, 0.2), hit = fire(M, 0.46), jack = fire(M, 0.6), none = fire(M, null), late = fire(M, 0.9);
  ok(miss.oc === 0 && hit.oc === 1 && jack.oc === 2 && none.oc === 0 && late.oc === 0, w + ': outcomes miss / hit / jackpot / no tap = miss / late tap = miss (' + [miss.oc, hit.oc, jack.oc, none.oc, late.oc] + ')');
  ok(hit.dmg > 0 && near(miss.dmg / hit.dmg, 0.65, 0.002) && near(jack.dmg / hit.dmg, K.SUP_OC[2], 0.002) && near(none.dmg / hit.dmg, 0.65, 0.002), w + ': damage 65% / 100% / ' + K.SUP_OC[2] * 100 + '% (' + [miss.dmg, hit.dmg, jack.dmg].map(Math.round) + ')');
  ok(miss.firedAt >= C.charge - 0.04, w + ': an early tap never fires before the weapon\'s own telegraph (' + miss.firedAt.toFixed(2) + ' s, telegraph ' + C.charge + ' s)');
  ok(near(jack.firedAt, 0.6 + K.SUP_REL, 0.07) && near(none.firedAt, K.SUP_BAR_T + K.SUP_REL, 0.07), w + ': fires ' + K.SUP_REL + ' s after the stop (' + jack.firedAt.toFixed(2) + ' s), an untapped bar at the end of the sweep (' + none.firedAt.toFixed(2) + ' s)');
}

// ---- 2. server authority: the sim's clock judges; forged and mistimed claims are ignored ----
{ const M = match('pulse', 0), S = M.S, K = S.K;
  const forgedEarly = fire(M, 0.1, 0.6);   // sent 0.1 s after the press, claiming "I stopped at the jackpot"
  ok(forgedEarly.oc === 0, 'a jackpot claimed at the wrong moment is refused: judged on the server clock (outcome ' + forgedEarly.oc + ')');
  const forgedLate = fire(M, 0.95, 0.6); ok(forgedLate.oc === 0, 'a jackpot claimed after the zone has passed is refused');
  const forgedHit = fire(M, 0.15, 0.5); ok(forgedHit.oc === 0, 'a hit claimed from outside the zone is refused');
  const lagged = fire(M, 0.63, 0.6);   // lands on the tick at 0.633 s
  ok(lagged.oc === 2, 'an honest tap that arrives 33 ms late (inside the ' + K.SUP_TAP_TOL * 1000 + ' ms allowance) keeps its jackpot');
  ok(K.SUP_TAP_TOL <= 0.06 + 1e-9 && K.SUP_TAP_TOL >= 0.04, 'the latency allowance is small: jitter plus one server tick (' + K.SUP_TAP_TOL * 1000 + ' ms)');
  const edge = fire(M, 0.6 - K.SUP_TAP_TOL - 0.05, 0.6); ok(edge.oc !== 2, 'a forged jackpot claim sent ' + ((K.SUP_TAP_TOL + 0.05) * 1000).toFixed(0) + ' ms early is refused (the known bound: only a claim within ' + K.SUP_TAP_TOL * 1000 + ' ms of the server clock is believed)');
  const tooLate = fire(M, 0.6 + K.SUP_TAP_TOL + 0.08, 0.6); ok(tooLate.oc !== 2, 'beyond the allowance the server clock decides (outcome ' + tooLate.oc + ')');
  for (const bad of [NaN, Infinity, -5, '0.6', null, {}]) { const r = fire(M, 0.1, bad); ok(r.oc === 0, 'a malformed claim (' + String(bad) + ') falls back to the server clock'); }
  // a second tap changes nothing; a tap with no super does nothing
  const { r } = M; r.sp = 1000; S.useSuper(r); r.sup.bar = { z0: 0.4, jc: 0.6 }; r.sup.tapAt = undefined; for (let i = 0; i < 6; i++) S.step(DT);
  ok(S.supTap(r, r.sup.el) === true && r.sup.oc === 0, 'first tap (early) is a miss');
  for (let i = 0; i < 9; i++) { S.step(DT); if (r.sup) ok(S.supTap(r, 0.6) === false && r.sup.oc === 0, 'a second tap cannot change the outcome'); }
  for (let i = 0; i < 40; i++) S.step(DT);
  ok(!r.sup && S.supTap(r, 0.6) === false, 'a tap with no super charging does nothing');
  // the server draws the bar before the press and sends it in the snapshot; the phone never sends an outcome
  const snap = S.snap(), me = snap.u[0]; ok(Array.isArray(me[16]) && me[16].length === 2 && me[16][0] >= 0.3 && me[16][1] > me[16][0], 'the snapshot carries a live pilot\'s next bar (zone ' + me[16] + ')');
  r.sp = 1000; S.useSuper(r); const b1 = r.sup.bar; ok(near(b1.z0, me[16][0], 1e-9) && near(b1.jc, me[16][1], 1e-9), 'the super uses exactly the bar the server announced');
  const s2 = S.snap().u[0]; ok(Array.isArray(s2[14]) && s2[14].length === 7 && s2[14][5] === 0 && Array.isArray(s2[16]) && (s2[16][0] !== me[16][0] || s2[16][1] !== me[16][1]), 'while it sweeps the snapshot shows no outcome yet, and a new bar is drawn for the next super');
  const pvp = rd('worker/src/pvp.js'); ok(/case "z": if \(live\) this\.sim\.supTap\(u, /.test(pvp) && !/m\.oc\b/.test(pvp), 'the live room passes the tap to the sim and never reads an outcome from the phone'); }

// ---- 3. AI pilots: the same bar, tap skill by league, never perfect ----
{ const S = sim(11), K = S.K, erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const pj = s => erf(K.SUP_JACK_W / 2 / (s * Math.SQRT2)), human = pj(K.SUP_TAP_HUMAN);
  ok(K.LG_AI_TAP.length === 7 && K.LG_AI_TAP.every((v, i) => v > K.SUP_TAP_HUMAN && (i === 0 || v <= K.LG_AI_TAP[i - 1])), 'every league\'s AI taps looser than an average person (' + K.SUP_TAP_HUMAN + ') and higher leagues tap tighter: ' + K.LG_AI_TAP);
  const rates = [];
  for (const lg of [0, 3, 6]) { const M = match('pulse', 0, ['h', null], lg), bot = M.e, cnt = [0, 0, 0];
    ok(!bot.hum, 'setup: an AI pilot in the second seat');
    for (let i = 0; i < 3000; i++) { bot.sp = 1000; bot.sup = null; if (!M.S.useSuper(bot)) { ok(false, 'AI super did not start'); break; } const s = bot.sup; cnt[s.tapAt >= K.SUP_BAR_T ? 0 : M.S.supJudge(s.bar, s.tapAt)]++; bot.sup = null; }
    const j = cnt[2] / 3000, m = cnt[0] / 3000; rates.push([lg, j, m]);
    ok(j < human && j < 0.4, 'league ' + lg + ' AI: jackpots ' + (j * 100).toFixed(0) + '% of its supers, fewer than an average person (' + (human * 100).toFixed(0) + '%)');
    ok(m > 0.05 && j > 0.03, 'league ' + lg + ' AI is never perfect and never hopeless (misses ' + (m * 100).toFixed(0) + '%)'); }
  ok(rates[2][1] > rates[0][1] + 0.05 && rates[2][2] < rates[0][2], 'a Lunar Legend AI taps better than a Rookie AI (jackpots ' + (rates[0][1] * 100).toFixed(0) + '% -> ' + (rates[2][1] * 100).toFixed(0) + '%)');
  // an AI pilot's bar really ends by itself in a match (no stuck supers)
  const M = match('siege', 1, ['h', null], 2), bot = M.e; bot.sp = 1000; bot.sup = null; ok(M.S.useSuper(bot), 'AI super starts'); let t = 0; while (bot.sup && t < 3) { M.S.step(DT); t += DT; for (const u of M.S.units) u.cd = 99; }
  ok(!bot.sup && t <= K.SUP_BAR_T + K.SUP_REL + 0.1, 'an AI super always resolves by the end of the sweep (' + t.toFixed(2) + ' s)'); }

// ---- 4. per-weapon and per-tier damage ----
{ const W = makeWorld(), per = (a, t) => W.eval(`(()=>{const u=tankOf(${JSON.stringify(L(a, t))},1);u.buffs=[];u.hum=true;return SUP[u.wtype].dmg*supMult(u);})()`);
  for (const t of [0, 1, 2]) ok(per('siege', t) > per('pulse', t) && per('pulse', t) > per('twin', t), 'tier ' + t + ': a slow weapon\'s super hits harder per use (Siege ' + Math.round(per('siege', t)) + ' > Pulse ' + Math.round(per('pulse', t)) + ' > Twin ' + Math.round(per('twin', t)) + ')');
  for (const a of ['pulse', 'twin', 'siege']) ok(per(a, 2) > per(a, 1) * 1.15 && per(a, 1) > per(a, 0) * 1.15, a + ': each tier\'s super hits clearly harder (' + [0, 1, 2].map(t => Math.round(per(a, t))) + ')');
  ok(per('moon', 2) > per('siege', 2), 'Moonfall stays the hardest-hitting super (' + Math.round(per('moon', 2)) + ' vs Epic Siege ' + Math.round(per('siege', 2)) + ')');
  const ai = W.eval(`(()=>{const u=tankOf(${JSON.stringify(GEAR.epic)},1);u.buffs=[];u.hum=true;const h=supMult(u);u.hum=false;return supMult(u)/h;})()`);
  ok(ai < 1 && ai > 0.6, 'an AI pilot\'s super is never stronger than a person\'s with the same gear (x' + ai.toFixed(2) + ')'); }

// ---- 4b. no one-shots: one super never removes more than SUP_HULL_CAP of a full hull (x1.25 on a jackpot), in any mode ----
{ const W = makeWorld(), cap = W.eval('SUP_HULL_CAP'), jk = W.eval('SUP_OC[2]');
  ok(cap > 0.3 && cap <= 0.5, 'a normal super takes at most half of a full hull (' + cap + ')');
  // the worst cases the review found: equal gear in Bounty 1v1 (hulls halved), a jackpot, the hardest-hitting kits; and Legendary vs stock
  const shot = (A, B, g, oc, buff) => W.eval(`(()=>{setMap('craters');matchG=${JSON.stringify(g)};MM={n:1,series:false,mp:50};const hs=hpScale(),mk=(L,t)=>Object.assign(tankOf(L,hs),{x:10,y:t?14:20,ang:0,flash:0,cd:9,lk:null,buffs:[],sp:0,sup:null,team:t,hum:true,ctl:'net',id:t,st:{dmg:0,taken:0,best:0,arm:0,shd:0,low:1,sup:0}});
   const a=mk(${JSON.stringify(A)},0),b=mk(${JSON.stringify(B)},1);a.hp=a.mhp;b.hp=b.mhp;units=[a,b];me=null;state='play';walls.length=0;rocks.length=0;crates=[];bullets=[];shells=[];
   if(${buff ? 1 : 0})a.buffs.push({k:'dmg',taken:0});
   a.sup={t:0,el:1,ang:Math.atan2(b.y-a.y,b.x-a.x),w:a.wtype,k:supKey(a.wtype,a.wtier),bar:{z0:.4,jc:.6},oc:${oc}};fireSuper(a,SUP[a.wtype]);a.sup=null;
   for(let i=0;i<60&&shells.length;i++)superTick(1/30);
   return {share:(b.mhp-b.hp)/b.mhp,dmgStat:a.st.dmg,removed:b.mhp-Math.max(0,b.hp),mhp:b.mhp};})()`);
  const kits = { stock: GEAR.stock, rare: GEAR.rare, epic: GEAR.epic, legend: GEAR.legend };
  let worst = 0, worstTag = '';
  for (const g of ['arena', 'bounty', 'royale']) for (const k in kits) for (const a of ['pulse', 'twin', 'siege', 'moon']) {
    if ((a === 'moon') !== (k === 'legend')) continue;
    const Lk = { ...kits[k], w: { ...kits[k].w, a } }, r = shot(Lk, Lk, g, 2, true);
    if (r.share > worst) { worst = r.share; worstTag = g + ' ' + k + ' ' + a; }
    ok(r.share <= cap * jk + 1e-6, g + ' 1v1 ' + k + ' ' + a + ' mirror: a jackpot with a damage box takes ' + (r.share * 100).toFixed(0) + '% of a full hull (limit ' + (cap * jk * 100).toFixed(1) + '%)');
    ok(r.dmgStat <= r.removed + 1e-6, g + ' ' + k + ' ' + a + ': the damage stat counts hull removed, no overkill (' + Math.round(r.dmgStat) + ' <= ' + Math.round(r.removed) + ')');
  }
  const mis = shot(GEAR.legend, GEAR.stock, 'bounty', 2, true);
  ok(mis.share <= cap * jk + 1e-6 && mis.share > 0.4, 'Legendary jackpot on a stock tank in Bounty 1v1: big, never a one-shot from full health (' + (mis.share * 100).toFixed(0) + '%)');
  console.log('largest single super vs an equal kit: ' + (worst * 100).toFixed(0) + '% of a full hull (' + worstTag + ')'); }

// ---- 4c. proof of play: honest matches with big supers pass the server's record check (real records, real checkProof) ----
{ const { buildSim } = await import('../../worker/build-sim.mjs'); buildSim();
  const { checkProof } = await import('../../worker/src/proof.js'), { minSecs } = await import('../../worker/src/eco.js');
  const W = makeWorld({ proof: true }); let n = 0, bad = [];
  for (const [k, lg] of [['epic', 0], ['epic', 4], ['legend', 0], ['legend', 3], ['legend', 6]]) for (const [g, m] of [['arena', '1v1'], ['bounty', '1v1'], ['arena', '3v3']]) for (const seed of [71, 419, 2027]) {
    const map = ['classic', 'craters', 'canyon'][n % 3], r = W.run({ g, m, map, seed, mp: 50, L: GEAR[k], pilot: 'human', lg, dt: 1 / 30 }); n++;
    const c = { g, m, map, secs: r.secs + 5, won: r.won, drawn: r.drawn, place: r.place, series: g === 'arena' && m === '1v1', min: minSecs(g, m, r.won, r.drawn, r.place), spdM: r.spdM, st: r.st };
    const out = checkProof(r.pf, c); if (!out.ok) bad.push(k + ' lg' + lg + ' ' + g + ' ' + m + ' seed ' + seed + ': ' + out.why);
  }
  ok(n === 45 && !bad.length, 'the server accepts the record of every honest Epic / Legendary match (' + (n - bad.length) + ' of ' + n + (bad.length ? '; refused: ' + bad.slice(0, 4).join(' | ') : '') + ')'); }

// ---- 5. about 3 supers a match, total super damage within 10% of main ----
{ const base = JSON.parse(fs.readFileSync(path.join(repo, 'dev/tests/fixtures/super-baseline.json'), 'utf8'));
  const R = await superReport({ seeds: +(process.env.SEEDS || 2), pilot: 'human' });
  console.log('supers a match ' + base.all.supers + ' -> ' + R.all.supers + ', super damage a match ' + base.all.superDmg + ' -> ' + R.all.superDmg + ' (' + R.all.matches + ' seeded matches; miss/hit/jackpot ' + R.all.oc.join('/') + ')');
  for (const k in R.kits) console.log(' ' + k.padEnd(7), 'supers', base.kits[k].supers, '->', R.kits[k].supers, ' super damage', base.kits[k].superDmg, '->', R.kits[k].superDmg, '(' + ((R.kits[k].superDmg / base.kits[k].superDmg - 1) * 100).toFixed(0) + '%)');
  ok(R.all.supers >= 2.6 && R.all.supers <= 3.5, 'a pilot fires about 3 supers a match (' + R.all.supers + '; main: ' + base.all.supers + ')');
  ok(Math.abs(R.all.superDmg / base.all.superDmg - 1) <= 0.10, 'total super damage a match within 10% of main (' + base.all.superDmg + ' -> ' + R.all.superDmg + ')');
  ok(Math.abs(R.all.superEff / base.all.superEff - 1) <= 0.12, 'hull really removed by supers a match (no overkill) stays near main (' + base.all.superEff + ' -> ' + R.all.superEff + ')');
  for (const k in R.kits) { ok(R.kits[k].supers >= 2.2 && R.kits[k].supers <= 4.3, k + ': about 3 supers a match whatever the gear (' + R.kits[k].supers + '; main ' + base.kits[k].supers + ')');
    ok(Math.abs(R.kits[k].superDmg / base.kits[k].superDmg - 1) <= 0.3, k + ': its super damage a match stays near main (' + base.kits[k].superDmg + ' -> ' + R.kits[k].superDmg + ')'); }
  const n = R.all.oc[0] + R.all.oc[1] + R.all.oc[2], j = R.all.oc[2] / n, m = R.all.oc[0] / n;
  ok(j > 0.2 && j < 0.42 && m > 0.07 && m < 0.25, 'an average person\'s taps: jackpot ' + (j * 100).toFixed(0) + '%, miss ' + (m * 100).toFixed(0) + '% (the three outcomes average near x1)'); }

// ---- 6. Conquest: the same bar through the replayed command stream ----
{ const cx = vm.createContext({ console }); for (const f of ['js/range-host.js', 'js/rules.js', 'js/game.js', 'js/conquest/world.js', 'js/conquest/combat.js', 'js/conquest/controls.js']) vm.runInContext(rd(f), cx, { filename: f });
  const C = cx.ConquestCombat, Ctl = cx.ConquestControl, Wd = cx.ConquestWorld, K = vm.runInContext('({SUP_BAR_T,SUP_REL,SUP_OC,SUPER_MAX})', cx);
  const run = (tapStep) => { const p0 = { x: 1160, z: 1048, y: Wd.groundAt(1160, 1048), surface: 'ground' }, B = new C.Battle(L('twin', 1), p0); let p = p0;
    const e = B.enemies[0]; Object.assign(e, { x: 1160, z: 1056, y: Wd.groundAt(1160, 1056), hp: 1e6, maxHp: 1e6, decision: 1e9, cd: 1e9, vx: 0, vz: 0 }); B.enemies = [e]; B.charge = K.SUPER_MAX;
    let oc, fired = null; const log = [];
    for (let i = 0; i < 40; i++) { const cmd = Ctl.validated(Ctl.command({ x: 0, z: 0, aimYaw: 0, aimPitch: 0, super: i === 0 || i === tapStep })); p = Ctl.advance(B, p, cmd, Ctl.STEP, false);
      if (B.superAttack && B.superAttack.oc !== undefined) oc = B.superAttack.oc; if (!B.superAttack && fired === null) fired = (i + 1) * Ctl.STEP; log.push(B.superAttack ? [B.superAttack.el, B.superAttack.oc] : null); }
    return { oc, fired, dmg: 1e6 - e.hp, bar: log.find(Boolean) && null, B, sig: JSON.stringify(log) }; };
  const probe = (() => { const p0 = { x: 1160, z: 1048, y: Wd.groundAt(1160, 1048), surface: 'ground' }, B = new C.Battle(L('twin', 1), p0); B.charge = K.SUPER_MAX; Ctl.advance(B, p0, Ctl.validated(Ctl.command({ x: 0, z: 0, aimYaw: 0, super: true })), Ctl.STEP, false); return B.superAttack; })();
  ok(probe && probe.bar && probe.oc === undefined && probe.el > 0, 'Conquest: the first SUPER press starts the sweep (bar zone ' + (probe && probe.bar.z0) + ', jackpot ' + (probe && probe.bar.jc) + ')');
  const jStep = Math.round(probe.bar.jc * K.SUP_BAR_T / Ctl.STEP), jack = run(jStep), again = run(jStep), miss = run(2), none = run(-1), hitStep = Math.round((probe.bar.z0 + 0.02) * K.SUP_BAR_T / Ctl.STEP), hit = run(hitStep);
  ok(jack.oc === 2 && miss.oc === 0 && none.oc === 0, 'Conquest: a second press on the jackpot = JACKPOT, an early one = MISS, none = MISS (' + [jack.oc, miss.oc, none.oc] + ')');
  ok(jack.sig === again.sig && jack.dmg === again.dmg, 'Conquest: the same commands replay to the same outcome and damage (the Worker\'s replay is the judge)');
  ok(none.dmg > 0 && near(jack.dmg / none.dmg, K.SUP_OC[2] / K.SUP_OC[0], 0.01), 'Conquest: jackpot / miss damage = ' + (K.SUP_OC[2] / K.SUP_OC[0]).toFixed(2) + ' (' + Math.round(jack.dmg) + ' / ' + Math.round(none.dmg) + ')');
  ok(hit.oc >= 1 && near(none.fired, K.SUP_BAR_T + K.SUP_REL, 0.11), 'Conquest: a press inside the zone is at least a HIT; an untapped bar fires at the end of the sweep (' + none.fired.toFixed(2) + ' s)'); }

if (fails.length) { console.log('\nFAIL super timing: ' + fails.length + ' of ' + checks + ' checks failed'); process.exit(1); }
console.log('PASS super timing:', checks, 'checks');
