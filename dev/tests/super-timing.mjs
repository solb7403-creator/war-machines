// SUPER regression (Sessions 5E-2b and 5E-2b2b, owner decisions Nov 10-14 2026). Runs the REAL shared code (js/rules.js +
// js/game.js + worker/sim-api.js: the phone's AI match and the live-match server; js/conquest/controls.js for Conquest) and holds:
//  1. the timing bar: three outcomes, the worst tap = 65% of a normal one (owner range 60-70%), the jackpot bonus capped,
//     the jackpot always inside the normal zone, no tap = MISS, the super never fires before the weapon's own telegraph;
//     5E-2b2b: the sweep is 1.5x faster (0.667 s), the jackpot never comes sooner than a person can read the bar
//  2. server authority: the sim draws the bar and its own clock judges the tap; a forged or mistimed "jackpot" claim is
//     ignored, a second tap changes nothing, the phone's time only counts inside the latency allowance
//  3. AI pilots use the same bar with a tap skill set by their league: worse than an average person in every league,
//     better in higher leagues, never perfect
//  4. per-weapon rule: a slow weapon's super hits harder per use than a fast one's; a higher tier hits harder; each super
//     does 20-25% less than before 5E-2b2b; no one-shots; honest records pass the server's proof-of-play check and a record
//     with more than 3 supers in a round does not
//  5. the charge rule (5E-2b2b): damage only (nothing passive), measured against the tank's OWN strength and OWN hull, never
//     the target's health; no charge from crates, the storm, meteors, overkill or a super's own damage; the Reactor's +10% a
//     level; soaking damage is capped at one hull a life; at most 3 supers a round, across respawns, cleared only by a new round
//  6. seeded rounds in every Arcade mode: about 3 supers per player per round (1v1 Arena about 2), never more than 3 for the
//     pilot or any AI pilot, the best kit within 1.2x of the lowest, supers a smaller share of damage than before
//  7. Conquest: its own bar (1.0 s), charge rule and super damage are exactly as they were
// usage: node dev/tests/super-timing.mjs   (SEEDS=2 for a slower, steadier part 6)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorld, GEAR } from './combat-sim.mjs';
import { superRounds, RR_LADDER } from './super-rounds.mjs';
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
    'return Object.assign(__api,{los:(a,b)=>los(a,b),SUPS:SUP,setState:v=>{state=v;},walls:()=>walls,rocks:()=>rocks,supMult:r=>supMult(r),K:{SUP_BAR_T,SUP_BAR_T_CQ,SUP_ZONE_W,SUP_JACK_W,SUP_REL,SUP_TAP_TOL,SUP_OC,SUP_TAP_HUMAN,LG_AI_TAP,SUP_KEYS,SUPER_MAX,SUP_GEAR,SUP_GEAR_AI,SUP_ROUND_CAP,SUP_FILL,SUP_HULL_CAP},supBar,supJudge,supKey,hit:(t,amt,src,why,kind)=>takeHit(t,amt,src,why,kind),supDps:u=>supDps(u),supF:()=>supF.slice(),crates:()=>crates,hitCrate:(c,d)=>hitCrate(c,d),respawnTick:dt=>respawnTick(dt),setEvt:v=>{evt=v;},tankOf:(L,n)=>tankOf(L,n),fireSuper:(r)=>fireSuper(r,SUP[r.sup.w]),superTick:dt=>superTick(dt),shells:()=>shells,startRound:()=>startRound(),endRoundNow:()=>{state="round";},seriesOn:()=>{series={w:[0,0],round:1};}});';
  return new Function('HOST', 'RAND', body)({ ev() {}, end() {}, round() {}, death() {}, random: rand }, rand);
}
const L = (w = 'pulse', t = 0) => ({ w: { a: w, t: w === 'moon' ? 2 : t, q: 1, s: false }, c: { c: 'vanguard', t: 0, q: 1, s: false }, up: { hull: 0, cannon: 0, engine: 0, target: 0, reactor: 0 }, cores: ['dmg', 'rof', 'arm'], gl: {}, skin: 'default', paint: 'stock' });
function match(wpn = 'pulse', tier = 0, seats = ['h', 'h'], lg = 3, g = 'arena', m = '1v1') {
  const S = sim();
  S.setup({ map: 'craters', g, m, seats: seats.map((x, i) => x ? { pid: 'p' + i, name: 'P' + i, L: L(wpn, tier) } : null), lg });
  S.start(); S.setState('play'); S.walls().length = 0; S.rocks().length = 0;
  const U = S.units; for (const u of U) { u.sp = 0; u.cd = 99; u.shieldT = 0; u.mhp = u.hp = 1e6; }
  const put = (u, x, y) => { u.x = x; u.y = y; u.px = x; u.py = y; u.ox = x; u.oy = y; u.claim = null; u.vx = u.vy = 0; u.avx = u.avy = 0; };
  put(U[0], 10, 20); put(U[1], 10, wpn === 'twin' ? 17 : 14);
  return { S, U, r: U[0], e: U[1] };
}
// fire r's super with a fixed bar (zone 40-76%, jackpot at 60%) and a tap at tapEl seconds (null: never); claim: what the phone
// reports (default: the exact moment, which a 1/30 s step reaches within the latency allowance). Returns {oc, firedAt, dmg}
const T = sim().K.SUP_BAR_T, JK = 0.6 * T, HIT = 0.45 * T, MISS = 0.2 * T, LATE = 0.9 * T;
function fire(M, tapEl, claim) {
  const { S, r, e } = M; r.sp = 1000; r.supN = 0; e.hp = e.mhp; for (const u of S.units) u.cd = 99;
  if (claim === undefined && tapEl !== null) claim = tapEl;
  if (!S.useSuper(r)) return null;
  r.sup.bar = { z0: 0.40, jc: 0.60 }; r.sup.tapAt = undefined;
  const hp0 = e.hp; let t = 0, oc, fired = null, tapped = false;
  for (let i = 0; i < 90; i++) {
    if (!tapped && tapEl !== null && r.sup && r.sup.el >= tapEl - 1e-9) { S.supTap(r, claim); tapped = true; }
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
  ok(minZ >= 0.44 && maxEnd <= 0.985, 'the zone starts 44% or more along the sweep and ends inside it (' + minZ.toFixed(2) + '..' + maxEnd.toFixed(2) + ')');
  const first = (minZ + 0.03 + K.SUP_JACK_W / 2) * K.SUP_BAR_T;
  ok(first >= 0.33, 'the earliest jackpot comes ' + Math.round(first * 1000) + ' ms after the press: time to read the bar (a tap reaction is about 280 ms)');
  ok(near(1 / K.SUP_BAR_T, 1.5, 0.02), 'the sweep is 1.5x faster than the 1.0 s bar of 5E-2b (owner: 25-50% faster; ' + K.SUP_BAR_T + ' s)');
  ok(K.SUP_JACK_W * K.SUP_BAR_T * 30 >= 1.5, 'the jackpot circle is on screen for at least 1.5 frames on a 30 fps phone (' + (K.SUP_JACK_W * K.SUP_BAR_T * 30).toFixed(1) + '; 2x faster would be 1.2)');
  ok(K.SUP_BAR_T_CQ === 1 && (() => { let lo = 1, hi = 0; for (let i = 0; i < 2000; i++) { const b = S.supBar(rnd, 1); lo = Math.min(lo, b.z0); hi = Math.max(hi, b.z0); } return lo >= 0.36 && hi <= 0.56 && lo < 0.38 && hi > 0.54; })(), 'Conquest keeps its own 1.0 s sweep and its zone at 36-56%');
  ok(K.SUP_KEYS.length === 10 && new Set(K.SUP_KEYS).size === 10, 'ten supers, one per weapon item'); }
for (const [w, t] of [['pulse', 0], ['twin', 1], ['siege', 2], ['moon', 2]]) {
  const M = match(w, t), S = M.S, C = S.SUPS[w], K = S.K;
  const miss = fire(M, MISS), hit = fire(M, HIT), jack = fire(M, JK), none = fire(M, null), late = fire(M, LATE);
  ok(miss.oc === 0 && hit.oc === 1 && jack.oc === 2 && none.oc === 0 && late.oc === 0, w + ': outcomes miss / hit / jackpot / no tap = miss / late tap = miss (' + [miss.oc, hit.oc, jack.oc, none.oc, late.oc] + ')');
  ok(hit.dmg > 0 && near(miss.dmg / hit.dmg, 0.65, 0.002) && near(jack.dmg / hit.dmg, K.SUP_OC[2], 0.002) && near(none.dmg / hit.dmg, 0.65, 0.002), w + ': damage 65% / 100% / ' + K.SUP_OC[2] * 100 + '% (' + [miss.dmg, hit.dmg, jack.dmg].map(Math.round) + ')');
  ok(miss.firedAt >= C.charge - 0.04, w + ': an early tap never fires before the weapon\'s own telegraph (' + miss.firedAt.toFixed(2) + ' s, telegraph ' + C.charge + ' s)');
  ok(near(jack.firedAt, Math.max(JK + K.SUP_REL, C.charge), 0.07) && near(none.firedAt, K.SUP_BAR_T + K.SUP_REL, 0.07), w + ': fires ' + K.SUP_REL + ' s after the stop (' + jack.firedAt.toFixed(2) + ' s), an untapped bar at the end of the sweep (' + none.firedAt.toFixed(2) + ' s)');
}

// ---- 2. server authority: the sim's clock judges; forged and mistimed claims are ignored ----
{ const M = match('pulse', 0), S = M.S, K = S.K;
  const forgedEarly = fire(M, 0.1, JK);   // sent 0.1 s after the press, claiming "I stopped at the jackpot"
  ok(forgedEarly.oc === 0, 'a jackpot claimed at the wrong moment is refused: judged on the server clock (outcome ' + forgedEarly.oc + ')');
  const forgedLate = fire(M, 0.95 * T, JK); ok(forgedLate.oc === 0, 'a jackpot claimed after the zone has passed is refused');
  const forgedHit = fire(M, 0.1, 0.5 * T); ok(forgedHit.oc === 0, 'a hit claimed from outside the zone is refused');
  const lagged = fire(M, JK + 0.033, JK);   // lands one tick late
  ok(lagged.oc === 2, 'an honest tap that arrives 33 ms late (inside the ' + K.SUP_TAP_TOL * 1000 + ' ms allowance) keeps its jackpot');
  ok(K.SUP_TAP_TOL <= 0.06 + 1e-9 && K.SUP_TAP_TOL >= 0.04, 'the latency allowance is small: jitter plus one server tick (' + K.SUP_TAP_TOL * 1000 + ' ms)');
  const edge = fire(M, JK - K.SUP_TAP_TOL - 0.05, JK); ok(edge.oc !== 2, 'a forged jackpot claim sent ' + ((K.SUP_TAP_TOL + 0.05) * 1000).toFixed(0) + ' ms early is refused (the known bound: only a claim within ' + K.SUP_TAP_TOL * 1000 + ' ms of the server clock is believed)');
  const tooLate = fire(M, JK + K.SUP_TAP_TOL + 0.08, JK); ok(tooLate.oc !== 2, 'beyond the allowance the server clock decides (outcome ' + tooLate.oc + ')');
  for (const bad of [NaN, Infinity, -5, '0.6', null, {}]) { const r = fire(M, 0.1, bad); ok(r.oc === 0, 'a malformed claim (' + String(bad) + ') falls back to the server clock'); }
  // a second tap changes nothing; a tap with no super does nothing
  const { r } = M; r.sp = 1000; r.supN = 0; S.useSuper(r); r.sup.bar = { z0: 0.4, jc: 0.6 }; r.sup.tapAt = undefined; for (let i = 0; i < 4; i++) S.step(DT);
  ok(S.supTap(r, r.sup.el) === true && r.sup.oc === 0, 'first tap (early) is a miss');
  for (let i = 0; i < 9; i++) { S.step(DT); if (r.sup) ok(S.supTap(r, JK) === false && r.sup.oc === 0, 'a second tap cannot change the outcome'); }
  for (let i = 0; i < 40; i++) S.step(DT);
  ok(!r.sup && S.supTap(r, JK) === false, 'a tap with no super charging does nothing');
  // the server draws the bar before the press and sends it in the snapshot; the phone never sends an outcome
  const snap = S.snap(), me = snap.u[0]; ok(Array.isArray(me[16]) && me[16].length === 2 && me[16][0] >= 0.3 && me[16][1] > me[16][0], 'the snapshot carries a live pilot\'s next bar (zone ' + me[16] + ')');
  ok(me[17] === 1, 'the snapshot carries the supers a pilot has used this round (' + me[17] + ')');
  r.sp = 1000; S.useSuper(r); const b1 = r.sup.bar; ok(near(b1.z0, me[16][0], 1e-9) && near(b1.jc, me[16][1], 1e-9), 'the super uses exactly the bar the server announced');
  const s2 = S.snap().u[0]; ok(Array.isArray(s2[14]) && s2[14].length === 7 && s2[14][5] === 0 && Array.isArray(s2[16]) && (s2[16][0] !== me[16][0] || s2[16][1] !== me[16][1]) && s2[17] === 2, 'while it sweeps the snapshot shows no outcome yet, a new bar is drawn for the next super, and the count went up');
  const pvp = rd('worker/src/pvp.js'); ok(/case "z": if \(live\) this\.sim\.supTap\(u, /.test(pvp) && !/m\.oc\b/.test(pvp), 'the live room passes the tap to the sim and never reads an outcome from the phone'); }

// ---- 3. AI pilots: the same bar, tap skill by league, never perfect ----
{ const S = sim(11), K = S.K, erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
  const pj = s => erf(K.SUP_JACK_W / 2 / (s * Math.SQRT2)), human = pj(K.SUP_TAP_HUMAN);
  ok(K.LG_AI_TAP.length === 7 && K.LG_AI_TAP.every((v, i) => v > K.SUP_TAP_HUMAN && (i === 0 || v <= K.LG_AI_TAP[i - 1])), 'every league\'s AI taps looser than an average person (' + K.SUP_TAP_HUMAN + ') and higher leagues tap tighter: ' + K.LG_AI_TAP);
  const rates = [];
  for (const lg of [0, 3, 6]) { const M = match('pulse', 0, ['h', null], lg), bot = M.e, cnt = [0, 0, 0];
    ok(!bot.hum, 'setup: an AI pilot in the second seat');
    for (let i = 0; i < 3000; i++) { bot.sp = 1000; bot.sup = null; bot.supN = 0; if (!M.S.useSuper(bot)) { ok(false, 'AI super did not start'); break; } const s = bot.sup; cnt[s.tapAt >= K.SUP_BAR_T ? 0 : M.S.supJudge(s.bar, s.tapAt)]++; bot.sup = null; }
    const j = cnt[2] / 3000, m = cnt[0] / 3000; rates.push([lg, j, m]);
    ok(j < human && j < 0.4, 'league ' + lg + ' AI: jackpots ' + (j * 100).toFixed(0) + '% of its supers, fewer than an average person (' + (human * 100).toFixed(0) + '%)');
    ok(m > 0.05 && j > 0.03, 'league ' + lg + ' AI is never perfect and never hopeless (misses ' + (m * 100).toFixed(0) + '%)'); }
  ok(rates[2][1] > rates[0][1] + 0.05 && rates[2][2] < rates[0][2], 'a Lunar Legend AI taps better than a Rookie AI (jackpots ' + (rates[0][1] * 100).toFixed(0) + '% -> ' + (rates[2][1] * 100).toFixed(0) + '%)');
  // an AI pilot's bar really ends by itself in a match (no stuck supers)
  const M = match('siege', 1, ['h', null], 2), bot = M.e; bot.sp = 1000; bot.sup = null; bot.supN = 0; ok(M.S.useSuper(bot), 'AI super starts'); let t = 0; while (bot.sup && t < 3) { M.S.step(DT); t += DT; for (const u of M.S.units) u.cd = 99; }
  ok(!bot.sup && t <= K.SUP_BAR_T + K.SUP_REL + 0.1, 'an AI super always resolves by the end of the sweep (' + t.toFixed(2) + ' s)'); }

// ---- 4. per-weapon and per-tier damage ----
{ const W = makeWorld(), per = (a, t) => W.eval(`(()=>{const u=tankOf(${JSON.stringify(L(a, t))},1);u.buffs=[];u.hum=true;return SUP[u.wtype].dmg*supMult(u);})()`);
  for (const t of [0, 1, 2]) ok(per('siege', t) > per('pulse', t) && per('pulse', t) > per('twin', t), 'tier ' + t + ': a slow weapon\'s super hits harder per use (Siege ' + Math.round(per('siege', t)) + ' > Pulse ' + Math.round(per('pulse', t)) + ' > Twin ' + Math.round(per('twin', t)) + ')');
  for (const a of ['pulse', 'twin', 'siege']) ok(per(a, 2) > per(a, 1) * 1.15 && per(a, 1) > per(a, 0) * 1.15, a + ': each tier\'s super hits clearly harder (' + [0, 1, 2].map(t => Math.round(per(a, t))) + ')');
  ok(per('moon', 2) > per('siege', 2), 'Moonfall stays the hardest-hitting super (' + Math.round(per('moon', 2)) + ' vs Epic Siege ' + Math.round(per('siege', 2)) + ')');
  const was = { pulse: 335, siege: 380, twin: 320, moon: 385 }, now = W.eval('({pulse:SUP.pulse.dmg,siege:SUP.siege.dmg,twin:SUP.twin.dmg,moon:SUP.moon.dmg})');
  for (const k in was) ok(now[k] / was[k] >= 0.75 && now[k] / was[k] <= 0.80, k + ': each super does 20-25% less than before 5E-2b2b (' + was[k] + ' -> ' + now[k] + ', ' + Math.round((1 - now[k] / was[k]) * 100) + '% less)');
  ok(W.eval('SUP_HULL_CAP') / 0.5 >= 0.75 && W.eval('SUP_HULL_CAP') / 0.5 <= 0.80, 'the most one super can take from a full hull dropped by the same 20-25% (0.5 -> ' + W.eval('SUP_HULL_CAP') + ')');
  ok(JSON.stringify(W.eval('SUP_CQ')) === JSON.stringify({ pulse: 350, siege: 375, twin: 350, moon: 400 }) && W.eval('[FILL_DEALT,FILL_TAKEN,FILL_CRIT].join()') === '1,0.7,60', 'Conquest super damage and charge constants are untouched');
  const ai = W.eval(`(()=>{const u=tankOf(${JSON.stringify(GEAR.epic)},1);u.buffs=[];u.hum=true;const h=supMult(u);u.hum=false;return supMult(u)/h;})()`);
  ok(ai < 1 && ai > 0.6, 'an AI pilot\'s super is never stronger than a person\'s with the same gear (x' + ai.toFixed(2) + ')'); }

// ---- 4b. no one-shots: one super never removes more than SUP_HULL_CAP of a full hull (x1.25 on a jackpot), in any mode ----
{ const W = makeWorld(), cap = W.eval('SUP_HULL_CAP'), jk = W.eval('SUP_OC[2]');
  ok(cap > 0.3 && cap <= 0.4, 'a normal super takes at most 39% of a full hull (' + cap + ')');
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
  // a record with more supers in one round than the cap was not made by the game: flag four extra presses in round 1 of an honest record
  { const r = W.run({ g: 'zone', m: '2v2', map: 'classic', seed: 71, mp: 50, L: GEAR.rare, pilot: 'standard', lg: 2, dt: 1 / 30 }), c = { g: 'zone', m: '2v2', map: 'classic', secs: r.secs + 5, won: r.won, drawn: r.drawn, place: r.place, series: false, min: minSecs('zone', '2v2', r.won, r.drawn, r.place), spdM: r.spdM, st: r.st };
    const honest = checkProof(r.pf, c), raw = atob(r.pf.s), nU = r.pf.n, sz = nU * 3 + 6, bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0)), k = bytes.length / sz;
    let had = 0; for (let i = 0; i < k; i++) if (bytes[i * sz + nU * 3 + 2] & 8) had++;
    for (let i = 4; i < k && i < 4 + 2 * 6; i += 2) bytes[i * sz + nU * 3 + 2] |= 8;   // six presses in the first 8 seconds
    const forged = checkProof({ ...r.pf, s: btoa(String.fromCharCode(...bytes)) }, c);
    ok(honest.ok && had <= 3 && r.st.sup <= 3, 'an honest Moon Zone record passes and holds at most 3 super presses (' + had + '; ' + (honest.why || 'ok') + ')');
    ok(!forged.ok && forged.why === 'supers', 'the server refuses a record with more than 3 supers in one round (' + (forged.ok ? 'accepted' : forged.why) + ')'); }
  ok(n === 45 && !bad.length, 'the server accepts the record of every honest Epic / Legendary match (' + (n - bad.length) + ' of ' + n + (bad.length ? '; refused: ' + bad.slice(0, 4).join(' | ') : '') + ')'); }

// ---- 5. the charge rule: damage only, against the tank's OWN strength and hull; what never charges; the round cap ----
{ const M = match('pulse', 0, ['h', 'h'], 3, 'zone', '1v1'), S = M.S, K = S.K, [a, b] = M.U, F = S.supF();
  const reset = () => { for (const u of S.units) { u.sp = 0; u.supN = 0; u.tkn = 0; u.hp = u.mhp = 1e6; u.buffs = []; u.shieldT = 0; } };
  ok(F.length === 2 && F[0] === K.SUP_FILL.zone[1][0] && F[1] === K.SUP_FILL.zone[1][1], 'the match uses its mode\'s fill row (Moon Zone 1v1: ' + F + ')');
  // nothing passive: 30 s with nobody firing
  reset(); for (let i = 0; i < 900; i++) { for (const u of S.units) u.cd = 99; S.step(DT); }
  ok(a.sp === 0 && b.sp === 0, 'no passive charge: 30 s without damage leaves both bars empty (' + a.sp + ', ' + b.sp + ')');
  // a shot: the dealer gains by its OWN damage per second, the target by its OWN hull
  reset(); a.mhp = a.hp = 2000; b.mhp = b.hp = 3000; S.hit(b, 300, a, null, 0);
  ok(near(a.sp, 300 / S.supDps(a) / F[0] * 1000, 1e-6), 'damage dealt counts in seconds of the dealer\'s own clean fire (' + a.sp.toFixed(1) + ' points for 300 damage)');
  ok(near(b.sp, 300 / 3000 / F[1] * 1000, 1e-6), 'damage received counts as a share of the receiver\'s own hull (' + b.sp.toFixed(1) + ' points for 10% of the hull)');
  // the target's health does not matter to the dealer
  reset(); b.mhp = b.hp = 800; S.hit(b, 300, a, null, 0); const weak = a.sp; reset(); b.mhp = b.hp = 80000; S.hit(b, 300, a, null, 0);
  ok(near(a.sp, weak, 1e-9), 'the same damage charges the dealer the same whether the target is weak or strong (' + weak.toFixed(1) + ' = ' + a.sp.toFixed(1) + ')');
  // overkill does not count
  reset(); b.mhp = 2000; b.hp = 50; S.hit(b, 900, a, null, 0);
  ok(near(a.sp, 50 / S.supDps(a) / F[0] * 1000, 1e-6) && near(b.sp, 50 / 2000 / F[1] * 1000, 1e-6), 'damage past the target\'s remaining health charges nobody (50 of 900 counted)');
  // what never charges
  reset(); S.hit(b, 500, null, 'storm', 2); S.hit(b, 500, null, 'meteor', 3); S.hit(b, 500, b, null, 0); ok(b.sp === 0 && a.sp === 0, 'the storm ring, meteors and self damage charge nothing');
  reset(); const mate = Object.assign({}, a, { team: b.team, id: 99, sp: 0 }); S.hit(b, 500, mate, null, 0); ok(b.sp === 0 && mate.sp === 0, 'a team mate\'s hit charges nobody');
  reset(); const cr = S.crates()[0]; if (cr) { S.hitCrate(cr, 5000); ok(a.sp === 0 && b.sp === 0, 'breaking a crate charges nothing'); }
  reset(); S.hit(b, 400, a, null, 1); ok(a.sp === 0 && b.sp > 0, 'a super\'s own damage does not charge its owner; the tank it hits does charge (' + b.sp.toFixed(1) + ')');
  // equal seconds of own fire = equal charge, whatever the gear; Reactor +10% a level
  const kit = (Lk) => { const t = S.tankOf(Lk, 1); t.buffs = []; return t; }, own = t => { const d = { ...t, team: 0, id: 50, sp: 0, supN: 0, buffs: [] }; reset(); S.hit(b, S.supDps(t) * 5, d, null, 0); return d.sp; };
  const stock = kit(GEAR.stock), leg = kit({ ...GEAR.legend, up: { ...GEAR.legend.up, reactor: 0 } }), r2 = kit({ ...GEAR.stock, up: { ...GEAR.stock.up, reactor: 2 } }), r4 = kit({ ...GEAR.stock, up: { ...GEAR.stock.up, reactor: 4 } });
  ok(S.supDps(leg) > S.supDps(stock) * 2.2, 'setup: the Legendary kit\'s own damage per second is far above the stock tank\'s (' + Math.round(S.supDps(stock)) + ' vs ' + Math.round(S.supDps(leg)) + ')');
  ok(near(own(stock), own(leg), 1e-6) && near(own(stock), 5 / F[0] * 1000, 1e-6), 'five seconds of a tank\'s own clean fire fill the same share of the bar on a stock tank and on the Legendary kit (' + own(stock).toFixed(1) + ' points)');
  ok(near(own(r2) / own(stock), 1.2, 1e-6) && near(own(r4) / own(stock), 1.4, 1e-6), 'the Reactor still adds 10% charge a level (x' + (own(r2) / own(stock)).toFixed(2) + ' at 2, x' + (own(r4) / own(stock)).toFixed(2) + ' at 4)');
  { const tk = t => { reset(); const d = Object.assign(b, { fillM: t.fillM }); S.hit(d, 0.1 * d.mhp, a, null, 0); const v = d.sp; d.fillM = 1; return v; }; ok(near(tk(r2) / tk(stock), 1.2, 1e-6), 'the Reactor also lifts the charge from damage received (x' + (tk(r2) / tk(stock)).toFixed(2) + ')'); }
  // a mystery-box damage buff is not gear: it is not in the tank's own strength
  { const t = { ...stock, buffs: [] }, d0 = S.supDps(t); t.buffs = [{ k: 'dmg', taken: 0 }]; ok(S.supDps(t) === d0, 'a mystery-box buff does not change a tank\'s own strength'); }
  // soaking damage: at most one full hull per life counts, repairs do not refill it; a respawn does
  reset(); b.mhp = 2000; b.hp = 2000; let soak = 0; for (let i = 0; i < 8; i++) { b.hp = 2000; S.hit(b, 600, a, null, 1); soak = b.sp; if (b.sp >= 1000) b.sp = 0; }
  reset(); b.mhp = 2000; let got = 0; for (let i = 0; i < 8; i++) { b.hp = 2000; const s0 = b.sp; S.hit(b, 600, a, null, 1); got += b.sp - s0; b.sp = 0; }
  ok(near(got, 1 / F[1] * 1000, 1e-6), 'soaking damage and repairing: only one full hull per life counts (' + got.toFixed(0) + ' points from 4,800 damage on a 2,000 hull = ' + (1 / F[1]).toFixed(2) + ' bars)');
  b.hp = 0; b.dead = 0; for (let i = 0; i < 400 && b.hp <= 0; i++) S.respawnTick(DT); const s0 = b.sp; S.hit(b, 600, a, null, 1);
  ok(b.hp > 0 && b.sp > s0, 'after a respawn damage received counts again (a new life)');
  // solar flare event: still damage only (x2 while it lasts)
  reset(); S.hit(b, 300, a, null, 0); const plain = a.sp; reset(); S.setEvt({ k: 'flare', t: 5 }); S.hit(b, 300, a, null, 0); ok(near(a.sp, plain * 2, 1e-6), 'the solar flare doubles the charge from damage, and adds nothing by itself'); S.setEvt(null);
  // the megatank charges nothing for itself
  // ---- the round cap ----
  reset(); ok(K.SUP_ROUND_CAP === 3, 'the cap is 3 supers a round');
  let fired = 0; for (let i = 0; i < 6; i++) { a.sp = 1000; a.sup = null; if (S.useSuper(a)) fired++; a.sup = null; }
  ok(fired === 3 && a.supN === 3, 'the sim refuses the 4th super of a round even with a full bar (' + fired + ' fired of 6 presses)');
  a.sp = 0; S.hit(b, 5000, a, null, 0); S.hit(a, 5000, b, null, 0); ok(a.sp === 0, 'once the cap is reached the bar no longer charges');
  a.hp = 0; a.dead = 0; for (let i = 0; i < 400 && a.hp <= 0; i++) S.respawnTick(DT); a.sp = 1000;
  ok(a.hp > 0 && a.supN === 3 && S.useSuper(a) === false, 'a respawn does not give supers back (still ' + a.supN + ' used)');
  ok(S.snap().u[0][17] === 3, 'the snapshot shows 3 used');
  // a new round clears it (best of 3)
  { const M2 = match('pulse', 0, ['h', 'h'], 3), S2 = M2.S, u = M2.U[0]; S2.seriesOn(); let n = 0; for (let i = 0; i < 5; i++) { u.sp = 1000; u.sup = null; if (S2.useSuper(u)) n++; u.sup = null; }
    S2.endRoundNow(); S2.startRound(); let n2 = 0; for (let i = 0; i < 5; i++) { u.sp = 1000; u.sup = null; if (S2.useSuper(u, -Math.PI / 2)) n2++; u.sup = null; }   // aimed by hand: the tanks are back at their spawns, out of sight
    ok(n === 3 && n2 === 3 && S2.state === 'play', 'a new round gives all three back, and only a new round (' + n + ' then ' + n2 + ')'); }
  // the live room: the server's sim decides; a chassis swap between rounds cannot reset the count mid-round
  { const M3 = match('pulse', 0, ['h', 'h'], 3), S3 = M3.S, u = M3.U[0]; u.sp = 1000; S3.useSuper(u); u.sup = null; u.sp = 1000; S3.useSuper(u); u.sup = null; S3.setTank(u, L('siege', 1)); u.sp = 1000; const third = S3.useSuper(u); u.sup = null; u.sp = 1000;
    ok(third === true && S3.useSuper(u) === false && u.supN === 3, 'rebuilding a tank (chassis or weapon swap) keeps its count'); }
}

// ---- 6. seeded rounds in every Arcade mode: about 3 a round, never more than 3, gear within 1.2x, a smaller share of damage ----
{ const before = JSON.parse(fs.readFileSync(path.join(repo, 'docs/supers-5e2b2b/rounds-before-standard.json'), 'utf8')).ladder;
  const R = await superRounds({ seeds: +(process.env.SEEDS || 1), pilot: 'standard', kits: RR_LADDER });
  console.log('supers a round, pilot (auto-turret stand-in): ' + before.all.supers + ' -> ' + R.all.supers + ' | AI pilots ' + before.all.ai + ' -> ' + R.all.ai + ' | most in one round ' + Math.max(before.all.max, before.all.aiMax) + ' -> ' + Math.max(R.all.max, R.all.aiMax) + ' | supers\' share of the pilot\'s damage ' + Math.round(before.all.share * 100) + '% -> ' + Math.round(R.all.share * 100) + '% (' + R.matches + ' seeded matches)');
  ok(R.all.max <= 3 && R.all.aiMax <= 3 && R.all.over3 === 0 && R.all.aiOver3 === 0, 'nobody fires more than 3 supers in a round: pilot ' + R.all.max + ', AI pilots ' + R.all.aiMax + ' (before: ' + before.all.max + ' and ' + before.all.aiMax + ')');
  for (const m in R.modes) { const c = R.modes[m], one = m === 'arena 1v1';
    console.log(' ' + m.padEnd(12), 'round ' + String(c.secs).padStart(3) + ' s  supers', String(before.modes[m].supers).padStart(5), '->', c.supers.toFixed(2), ' AI', String(before.modes[m].ai).padStart(5), '->', c.ai.toFixed(2), ' share', Math.round(before.modes[m].share * 100) + '% ->', Math.round(c.share * 100) + '%', ' by kit', Object.keys(R.kits).map(k => R.cells[k + '|' + m].supers.toFixed(1)).join(' '));
    ok(c.max <= 3 && c.aiMax <= 3, m + ': never more than 3 (pilot ' + c.max + ', AI ' + c.aiMax + ')');
    if (one) ok(c.supers >= 1.5 && c.supers <= 2.5, m + ': about 2 supers a round (a round lasts ' + c.secs + ' s): ' + c.supers);
    else ok(c.supers >= 2.3 && c.supers <= 3, m + ': about 3 supers a round: ' + c.supers);
    if (m !== 'boss 1v1') ok(c.ai >= (one ? 1.2 : 2.0) && c.ai <= 3, m + ': the AI pilots too (' + c.ai + ')'); }   // Survival 1v1 has no AI pilot (the megatank has its own attacks)
  const ks = Object.keys(R.kits).map(k => R.kits[k].supers), lo = Math.min(...ks), hi = Math.max(...ks);
  ok(R.kits.legend.supers <= R.kits.stock.supers * 1.2 && hi <= lo * 1.2, 'the best kit fires within 1.2x of the lowest kit\'s count at equal Reactor levels (stock ' + R.kits.stock.supers + ', Legendary ' + R.kits.legend.supers + '; highest ' + hi + ' / lowest ' + lo + ' = x' + (hi / lo).toFixed(2) + ')');
  for (const m in R.modes) { const s = Object.keys(R.kits).map(k => R.cells[k + '|' + m].supers); ok(R.cells['legend|' + m].supers <= Math.min(...s) * 1.3 + 0.35, m + ': the Legendary kit is not ahead of the lowest kit (' + s.map(v => v.toFixed(1)).join(' ') + ')'); }
  ok(R.all.share < before.all.share && R.kits.legend.share < before.kits.legend.share, 'supers are a smaller share of a pilot\'s damage than before (' + Math.round(before.all.share * 100) + '% -> ' + Math.round(R.all.share * 100) + '%; Legendary kit ' + Math.round(before.kits.legend.share * 100) + '% -> ' + Math.round(R.kits.legend.share * 100) + '%)');
  const dealt = R.all.barsDealt / (R.all.barsDealt + R.all.barsTaken);
  ok(dealt >= 0.6 && dealt <= 0.8, 'about 70% of a pilot\'s charge comes from damage dealt, 30% from damage received (' + Math.round(dealt * 100) + ' / ' + Math.round((1 - dealt) * 100) + ')'); }

// ---- 7. Conquest: its own bar through the replayed command stream, exactly as before ----
{ const cx = vm.createContext({ console }); for (const f of ['js/range-host.js', 'js/rules.js', 'js/game.js', 'js/conquest/world.js', 'js/conquest/combat.js', 'js/conquest/controls.js']) vm.runInContext(rd(f), cx, { filename: f });
  const C = cx.ConquestCombat, Ctl = cx.ConquestControl, Wd = cx.ConquestWorld, K = vm.runInContext('({SUP_BAR_T:SUP_BAR_T_CQ,SUP_REL,SUP_OC,SUPER_MAX})', cx);
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

// ---- 8. Conquest's super LOOKS are the 5E-2b code, word for word (owner, Nov 13: Conquest supers stay completely unchanged) ----
// The Conquest host of js/fx3d.js is handed the block between the two markers below; its fingerprint was taken when the block
// was verified byte-identical to main (1acff13) after the renames. A deliberate change to Conquest's supers must update it.
{ const fx = fs.readFileSync(path.join(repo, 'js/fx3d.js'), 'utf8'), a = fx.indexOf(' // ======================= CONQUEST: the supers exactly as Session 5E-2b drew them'), b = fx.indexOf(' // ======================= DESTRUCTION =======================');
  const { createHash } = await import('node:crypto'), h = a > 0 && b > a ? createHash('sha256').update(fx.slice(a, b)).digest('hex').slice(0, 16) : 'missing';
  ok(h === '46c83f6294da75c2', 'the Conquest supers block in js/fx3d.js is unchanged (fingerprint ' + h + ')');
  ok(/const SUP_API=CQO\?\{superCharge:superChargeO,superLock:superLockO,superBeam:superBeamO,superNova:superNovaO,superShell:superShellO,superBlast:superBlastO,superImpact:superImpactO\}/.test(fx) && /const CQO=host\.mode==='conquest';/.test(fx) && /bolt:CQO\?boltO:bolt/.test(fx), 'the Conquest host is handed the 5E-2b supers and lightning, the Arcade the new ones');
  ok(/const MODES=!!host\.modes&&!host\.uv;/.test(fx), 'the new shader looks are off for a host that does not declare them (Conquest)'); }

if (fails.length) { console.log('\nFAIL supers: ' + fails.length + ' of ' + checks + ' checks failed'); process.exit(1); }
console.log('PASS supers:', checks, 'checks');
