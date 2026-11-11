// FAIR ARCADE regression (Session 5D, owner rule Nov 9 2026, 4th recurrence of "the AI matches my gear"). Runs in CI on the
// REAL game code: js/rules.js + js/game.js + js/match.js (the phone's AI match, combat-sim.mjs), the Worker's live-room sim
// (worker/sim-api.js: AI fill-ins), and Conquest (js/conquest/combat.js, plot.js). It fails if:
//  1. any enemy stat path follows the player's gear, power or tank (AI power must follow the LEAGUE, moved at most by the bounded
//     gear adjustment; a hard cap below the top player gear; no Moonbeam / Lunar Skin / reactor builds on AI pilots; live-room
//     fill-ins never copy a human's gear; the megatank and ghosts obey the same cap),
//  2. a gear step flattens or inverts in any league (seeded sims: win rate and damage taken/dealt must improve at every step),
//  3. an AI pilot fires a super, dash or shield faster than the player's own rules allow (full charge, cooldowns, telegraph),
//  4. Conquest enemies read the player's gear, or better gear stops making Conquest fights easier.
// usage: node dev/tests/fair-arcade.mjs   ([COMBAT_SRC=<another checkout>] to run it against other code, e.g. main before the fix)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorld, GEAR } from './combat-sim.mjs';
import { fairGrid, KITS } from './fair-arcade-grid.mjs';
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), srcRoot = process.env.COMBAT_SRC || repo;
const src = f => fs.readFileSync(path.join(srcRoot, f), 'utf8').replace(/^'use strict';[^\n]*\n/m, '');
const W = makeWorld(), J = JSON.stringify, LGN = ['Rookie', 'Pilot', 'Veteran', 'Ace', 'Elite', 'Master', 'Lunar Legend'];
let checks = 0, fails = [];
const ok = (c, m) => { checks++; if (!c) { fails.push(m); console.log('FAIL', m); } };
const pw = L => W.eval(`powerOf(${J(L)})`);
const has = name => W.eval(`typeof ${name}!=='undefined'`);

// ---- 1. the AI follows the league, not the pilot ----
const cap = has('AI_CAP') ? W.eval('AI_CAP') : null;
ok(cap !== null && cap < pw(GEAR.legend) * 0.75 && cap < 213, 'a hard AI power cap exists and sits well below the top player gear (cap ' + cap + ', top free kit 213, Legendary kit ' + pw(GEAR.legend) + ')');
const tiers = W.eval(`AI_TIERS.map((A,i)=>{const L=aiLoadout(i,'pulse','vanguard');return {p:A.p,real:powerOf(L),w:L.w.a,skin:L.skin,rc:L.up.reactor,mods:!!L.mods};})`);
for (const t of tiers) { ok(t.p === t.real, 'authored AI power is what powerOf says (' + t.p + ')'); ok(t.w !== 'moon' && t.skin !== 'lunar', 'no Moonbeam or Lunar Skin on an AI pilot'); ok(cap === null || t.p <= cap, 'no authored AI loadout above the cap (' + t.p + ')'); }
const band = has('AI_GEAR_HI') && has('AI_GEAR_LO') ? W.eval('AI_GEAR_HI/AI_GEAR_LO') : null;
ok(band !== null && band <= 1.3, 'the gear adjustment is slight and bounded (hi/lo ' + band + ')');
for (const n of [1, 2, 3, 'solo']) for (let lg = 0; lg < 7; lg++) {
  const ps = [], from = Math.max(100, has('LG_AI_PW') ? W.eval('LG_AI_PW[' + lg + ']') : 100), above = [];   // a pilot under the league's AI meets an AI at their own power (standing rule); above it the league decides
  for (let p = 68; p <= 300; p += 2) { const a = W.eval(`aiLevel(${p},undefined,${lg},${J(n)})`); ps.push(a.p); if (p >= from) above.push(a.p); ok(a.p <= p, LGN[lg] + ' ' + n + ': AI power ' + a.p + ' never above yours (' + p + ')'); ok(cap === null || a.p <= cap, LGN[lg] + ': AI power under the cap'); }
  const spread = Math.max(...above) / Math.min(...above);
  ok(spread <= 1.3 * 1.09, LGN[lg] + ' ' + n + ': the AI tank follows the league, not the pilot: AI power ' + Math.min(...above) + '..' + Math.max(...above) + ' across pilot power ' + from + '..300 (x' + spread.toFixed(2) + ', allowed: the bounded gear adjustment plus one tier step)');
  for (let i = 1; i < ps.length; i++) ok(ps[i] >= ps[i - 1], LGN[lg] + ': the gear adjustment never drops the AI as gear rises');
}
{ const ref = lg => W.eval(`aiLevel(${has('LG_AI_REF') ? W.eval('LG_AI_REF[' + lg + ']') : 150},undefined,${lg},1).p`); let last = 0; for (let lg = 0; lg < 7; lg++) { const p = ref(lg); ok(p >= last, 'each league fields a stronger AI than the last (' + LGN[lg] + ' ' + p + ')'); last = p; } ok(last > ref(0) * 1.5, 'the league is the main lever: Lunar Legend AI ' + last + ' vs Rookie ' + ref(0)); }
ok(W.eval('aiLevel(68,undefined,0,1).p') === 68, 'a starter tank in Rookie meets starter AI');

// ---- 2. no roster copies your tank (phone AI match, every mode), the megatank and ghosts included ----
const rosterOf = (L, g, m, lg, seed) => W.run({ g, m, map: 'classic', seed, mp: 50, L, lg, dt: 1 / 30, maxSteps: 1 }).roster.filter(u => u.ai && !u.boss);
const legendT = W.eval(`tankOf(${J(GEAR.legend)},1)`);
for (const [g, m] of [['arena', '1v1'], ['arena', '3v3'], ['bounty', '2v2'], ['royale', '1v1'], ['boss', '3v3']]) for (const lg of [0, 3, 6]) {
  const vg = k => ({ ...GEAR[k], c: { ...GEAR[k].c, c: 'vanguard' }, chs: undefined });   // your chassis class held fixed: the counter triangle is dealt against it on purpose
  const rs = Object.fromEntries(KITS.map(k => [k, rosterOf(vg(k), g, m, lg, 77)]));
  const anchorHi = has('LG_AI_PW') ? W.eval('LG_AI_PW[' + lg + ']*AI_GEAR_HI') : 0;
  for (const k of KITS) for (const u of rs[k]) { ok(!(u.w === 'moon') && u.aura < 3 && u.wmult !== 1.48, g + ' ' + m + ' ' + LGN[lg] + ': no Moonbeam or Legendary-class gear on an AI pilot'); ok(u.mhp > 0 && u.dps > 0, 'finite AI stats');
    ok(u.aiP !== null && u.aiP <= pw(vg(k)) && (cap === null || u.aiP <= cap) && u.aiP <= anchorHi + 1e-9, g + ' ' + m + ' ' + LGN[lg] + ' ' + k + ': every AI pilot flies an authored loadout at or under the league AI (' + u.aiP + ' vs league cap ' + anchorHi.toFixed(0) + ', yours ' + pw(vg(k)) + ')'); }
  const dps = k => Math.max(...rs[k].map(u => u.dps)), hp = k => Math.max(...rs[k].map(u => u.mhp));
  ok(dps('legend') <= dps('epic') * 1.2 && hp('legend') <= hp('epic') * 1.2, g + ' ' + m + ' ' + LGN[lg] + ': the enemy roster barely moves between the Epic and the Legendary kit (dps ' + dps('epic') + ' -> ' + dps('legend') + ', hp ' + hp('epic') + ' -> ' + hp('legend') + ')');
}
const bossOf = (L, lg) => W.eval(`(()=>{setMap('classic');matchG='boss';battleLoadout=${J(L)};battlePower=powerOf(battleLoadout);if(typeof battleLg!=='undefined')battleLg=${lg};MM={n:1,series:false,mp:50,cp:false};populatePreparedMatch();const b=units.find(u=>u.boss);return [b.mhp,b.wdps,b.bt.ref];})()`);
ok(has('aiBossLevel'), 'the megatank has its own league level (aiBossLevel)');
for (const lg of [0, 6]) { const e = bossOf(GEAR.epic, lg), b = bossOf(GEAR.legend, lg), refHp = has('aiBossLevel') ? W.eval(`tankOf(aiLoadout(aiBossLevel(${pw(GEAR.legend)},${lg},1).i,'pulse','vanguard'),BOSS_HP).mhp`) : -1;
  ok(b[0] <= e[0] * 1.2 && b[1] <= e[1] * 1.2 && b[2] <= e[2] * 1.2, LGN[lg] + ': the megatank is tuned to the league, not to your tank (Epic vs Legendary kit: hp ' + e[0] + ' -> ' + b[0] + ', gun ' + e[1] + ' -> ' + b[1] + ')');
  ok(b[2] === refHp, LGN[lg] + ': the megatank\'s stomps and shells are sized to the league AI\'s reference tank (' + b[2] + ' vs ' + refHp + ')'); }
ok(bossOf(GEAR.legend, 6)[0] > bossOf(GEAR.legend, 0)[0], 'the Lunar Legend megatank is tougher than the Rookie one');
{ const gh = W.eval(`(()=>{setMap('classic');matchG='arena';battleLoadout=${J(GEAR.legend)};battlePower=powerOf(battleLoadout);if(typeof battleLg!=='undefined')battleLg=6;MM={n:1,series:false,mp:50,cp:false};populatePreparedMatch();
 const near=${J({ ...GEAR.legend, skin: 'default', paint: 'stock', chs: undefined })};placeGhosts([{i:0,n:'Strong',L:near}]);const g=units.filter(u=>u.gh);return {n:g.length,pw:powerOf(near),ai:units.find(u=>u.aiL)?units.find(u=>u.aiL).mhp:0};})()`);
  ok(gh.n === 0, 'a ghost near your own power (' + gh.pw + ') never takes a seat in a Lunar Legend AI match (it would be a hidden max-gear duel)'); }

// ---- 3. live rooms: AI fill-ins fly the room league's authored loadout, never a human's gear ----
{ const api = new Function('HOST', '"use strict";\n' + src('js/rules.js') + src('js/game.js') + src('worker/sim-api.js'));
  const fill = (L, lg, g = 'arena', m = '1v1') => { let rs = 5; const sim = api({ seed: 5, random: () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; }, ev() {}, end() {}, round() {}, death() {} }); /* seeded: pScale draws are the same every run */ sim.setup({ g, m, map: 'classic', series: false, seats: [{ pid: 'me', name: 'Me', L }, null], ghosts: [], lg }); const b = sim.units.find(u => !u.pid); return { wmult: b.wmult || 1, chm: b.chm || 1, aura: b.aura | 0, gems: b.gems, wtier: b.wtier | 0, mhp: b.mhp, dps: b.wdps, me: sim.units.find(u => u.pid) }; };
  for (const lg of [0, 6]) { const s = fill(GEAR.stock, lg), l = fill(GEAR.legend, lg);
    ok(l.wmult !== l.me.wmult && l.chm !== l.me.chm, LGN[lg] + ' live room: the fill-in does not copy the lone human\'s weapon/chassis multipliers (' + l.wmult + '/' + l.chm + ' vs yours ' + l.me.wmult + '/' + l.me.chm + ')');
    ok(l.aura < 3 && l.wmult < 1.48, LGN[lg] + ' live room: no Legendary-class fill-in');
    const e = fill(GEAR.epic, lg); ok(l.dps <= e.dps * 1.35 && l.mhp <= e.mhp * 1.35, LGN[lg] + ' live room: the fill-in barely moves between an Epic and a Legendary human (dps ' + e.dps + ' -> ' + l.dps + ', hp ' + e.mhp + ' -> ' + l.mhp + ')'); }
  ok(fill(GEAR.legend, 6).dps > fill(GEAR.legend, 0).dps, 'a Lunar Legend room fields a stronger fill-in than a Rookie room'); }

// ---- 4. gear always matters, in every league and every mode (seeded sims, 6 maps) ----
const MODES = [['arena', '1v1'], ['arena', '3v3'], ['bounty', '1v1'], ['royale', '1v1']];
// 4 seeds x 6 maps x 4 modes = 96 matches a kit a league (2 seeds left a 48-match cell within sampling noise of the tolerances). Steps are judged on the aggregate win rate and damage trade; a step may
// never get materially worse on either and must improve at least one (two kits far under a league's AI meet an AI at their own
// power, so their results are close by design)
const T = (await fairGrid({ pilots: ['standard'], modes: MODES, seeds: 4 })).standard;
const agg = (lg, k, modes = MODES) => { let w = 0, n = 0, d = 0, t = 0, kl = 0, de = 0; for (const [g, m] of modes) { const c = T[lg][g + ' ' + m][k]; w += c.w; n += c.n; d += c.dmg * c.n; t += c.taken * c.n; kl += c.kills; de += c.deaths; } return { win: w / n, ratio: t / d, kd: kl / Math.max(1, de), n }; };
// Mirror cells (Session 5E-2b): a pilot whose power is under the league's AI meets an AI at their own power (the standing rule
// above), so two such kits fly near-mirror matches and their true step is a few points: smaller than the sampling noise of one
// 96-match cell (a win-rate difference has a standard error of ~0.07). Since 5E-2b a match has about 3 supers with a timing-bar
// outcome each (fewer, bigger, more varied moments), which widened that noise. So a step between two mirror kits is judged
// with the SAME three rules on the leagues where it is a mirror step pooled together (up to 4 x 96 matches a kit), plus a guard
// in every single league (never more than 8 points of wins or 0.04 of damage trade worse). Every other step is judged per
// league exactly as before.
const mirror = (lg, k) => { const p = pw(GEAR[k]); return W.eval(`aiLevel(${p},undefined,${lg},1).p`) >= p * 0.94; };
const pool = {};
console.log('league       ' + KITS.map(k => k.padStart(14)).join('') + '   (win rate / damage taken per damage dealt, ' + MODES.map(x => x.join(' ')).join(', ') + ')');
for (let lg = 0; lg < 7; lg++) {
  const rows = KITS.map(k => agg(lg, k));
  console.log(LGN[lg].padEnd(13) + rows.map(r => ((r.win * 100).toFixed(0) + '% / ' + r.ratio.toFixed(2)).padStart(14)).join(''));
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i], tag = LGN[lg] + ': ' + KITS[i] + ' vs ' + KITS[i - 1] + ' (wins ' + (a.win * 100).toFixed(0) + '% -> ' + (b.win * 100).toFixed(0) + '%, taken/dealt ' + a.ratio.toFixed(2) + ' -> ' + b.ratio.toFixed(2) + ', ' + a.n + ' matches a kit)';
    if (mirror(lg, KITS[i - 1]) && mirror(lg, KITS[i])) {
      ok(b.win >= a.win - 0.08 && b.ratio <= a.ratio + 0.04, tag + ': a mirror gear step is never materially worse in any league');
      const P = pool[i] ||= { a: { w: 0, n: 0, r: 0 }, b: { w: 0, n: 0, r: 0 }, lgs: [] }; P.lgs.push(LGN[lg]);
      P.a.w += a.win * a.n; P.a.n += a.n; P.a.r += a.ratio * a.n; P.b.w += b.win * b.n; P.b.n += b.n; P.b.r += b.ratio * b.n; continue;
    }
    ok(b.win >= a.win - 0.05, tag + ': a gear step never wins less');
    ok(b.ratio <= a.ratio + 0.04, tag + ': a gear step never trades damage worse');
    ok(b.win >= a.win + 0.03 || b.ratio <= a.ratio - 0.02 || (a.win >= 0.97 && b.win >= 0.97 && b.ratio <= a.ratio), tag + ': a gear step is felt (more wins or a better trade)');
  }
  const s = rows[0], l = rows[4]; ok(l.win >= s.win + 0.3 && l.ratio <= s.ratio - 0.3, LGN[lg] + ': stock -> Legendary is a big step (' + (s.win * 100).toFixed(0) + '% -> ' + (l.win * 100).toFixed(0) + '%, taken/dealt ' + s.ratio.toFixed(2) + ' -> ' + l.ratio.toFixed(2) + ')');
}
for (const i in pool) { const P = pool[i], a = { win: P.a.w / P.a.n, ratio: P.a.r / P.a.n }, b = { win: P.b.w / P.b.n, ratio: P.b.r / P.b.n };
  const tag = 'mirror leagues (' + P.lgs.join(', ') + '): ' + KITS[i] + ' vs ' + KITS[i - 1] + ' (wins ' + (a.win * 100).toFixed(1) + '% -> ' + (b.win * 100).toFixed(1) + '%, taken/dealt ' + a.ratio.toFixed(3) + ' -> ' + b.ratio.toFixed(3) + ', ' + P.a.n + ' matches a kit)';
  console.log(tag);
  ok(b.win >= a.win - 0.05, tag + ': a gear step never wins less');
  ok(b.ratio <= a.ratio + 0.04, tag + ': a gear step never trades damage worse');
  ok(b.win >= a.win + 0.03 || b.ratio <= a.ratio - 0.02, tag + ': a gear step is felt (more wins or a better trade)'); }
{ const s = agg(0, 'stock', [['arena', '1v1'], ['arena', '3v3'], ['bounty', '1v1']]); ok(s.win >= 0.35 && s.win <= 0.7, 'a stock tank in Rookie has a fight (' + (s.win * 100).toFixed(0) + '% wins in Arena and Bounty)'); }
{ const c = T[6]['arena 1v1'].legend; ok(c.ratio <= 0.72 && c.win >= 0.75, 'Lunar Legend arena 1v1: the Legendary kit takes at most ~65% of the damage it deals and wins most fights (' + c.ratio.toFixed(2) + ', ' + (c.win * 100).toFixed(0) + '%)'); }
{ const c = T[6]['bounty 1v1'].legend; ok(c.win >= 0.75 && c.kills >= c.deaths * 1.5, 'Lunar Legend bounty 1v1: the Legendary kit wins most fights and scores well over one kill a death (' + (c.win * 100).toFixed(0) + '%, ' + c.kills + ' kills / ' + c.deaths + ' deaths; in Bounty a heavier tank dies dearer, so kills, not damage, measure the trade)'); }
{ const c = agg(5, 'epic', [['arena', '1v1'], ['arena', '3v3'], ['bounty', '1v1']]); ok(c.win >= 0.6 && c.ratio <= 1.0, 'Master: a full Epic kit is clearly ahead of its league AI (' + (c.win * 100).toFixed(0) + '%, taken/dealt ' + c.ratio.toFixed(2) + ')'); }

// ---- 5. AI abilities obey the player's rules: full charge for a super, the dash and shield cooldowns, the telegraph ----
{ const [DASH_CD, SHIELD_CD, SUPER_MAX] = W.eval('[DASH_CD,SHIELD_CD,SUPER_MAX]'), minSup = W.eval('Math.min(...Object.values(SUP).map(s=>s.charge))');
  let aiSup = 0, aiMin = 0, meSup = 0, meMin = 0, aiDash = 0, meDash = 0;
  for (let lg = 0; lg < 7; lg++) for (const k of KITS) for (const [g, m] of MODES) { const c = T[lg][g + ' ' + m][k];
    ok(c.aiSupLowSp >= SUPER_MAX, LGN[lg] + ' ' + g + ' ' + m + ' ' + k + ': every AI super had a full charge (lowest seen ' + c.aiSupLowSp + ')');
    ok(c.aiDashCd <= 1e-9 && c.aiShieldCd <= 1e-9, LGN[lg] + ' ' + g + ' ' + m + ' ' + k + ': no AI dash or shield while on cooldown (leftover dash ' + c.aiDashCd + ' s, shield ' + c.aiShieldCd + ' s)');
    // gaps: a respawn or a new best-of-3 round resets everyone's cooldowns (players too), so only the telegraph bounds the gap between supers
    ok(c.aiSupGap >= minSup - 0.04, LGN[lg] + ' ' + g + ' ' + m + ' ' + k + ': two AI supers are never closer than the telegraph (' + c.aiSupGap.toFixed(2) + ' s)');
    // owner, Nov 10: an AI pilot's supers keep the league's minimum spacing and never come faster than the pilot's own under the same rules
    const gapRule = has('LG_AI_SUP_GAP') ? W.eval('LG_AI_SUP_GAP[' + lg + ']') : 99;
    ok(c.aiSupGap >= gapRule - 0.1, LGN[lg] + ' ' + g + ' ' + m + ' ' + k + ': an AI pilot keeps at least ' + gapRule + ' s between its supers (shortest seen ' + c.aiSupGap.toFixed(2) + ' s)');
    ok(c.aiSupPM <= c.meSupPM * 1.05 + 0.3 || c.aiSup <= 1, LGN[lg] + ' ' + g + ' ' + m + ' ' + k + ': an AI pilot never out-supers the pilot under the same rules (AI ' + c.aiSupPM + ' vs pilot ' + c.meSupPM + ' a minute per tank)');
    aiSup += c.aiSup; aiMin += c.foeMin; meSup += c.meSup; meMin += c.meMin; aiDash += c.aiDash; meDash += c.meDash; }
  const aiPM = aiSup / aiMin, mePM = meSup / meMin;
  console.log('abilities a minute of one tank: AI supers ' + aiPM.toFixed(2) + ' (pilot ' + mePM.toFixed(2) + '), AI dashes ' + (aiDash / aiMin).toFixed(2) + ' (pilot ' + (meDash / meMin).toFixed(2) + ', rule maximum ' + (60 / DASH_CD).toFixed(0) + ')');
  ok(aiPM <= mePM * 1.15, 'AI pilots do not fire supers faster than the pilot under the same rules (AI ' + aiPM.toFixed(2) + ' vs pilot ' + mePM.toFixed(2) + ' a minute)');
  ok(aiDash / aiMin <= 60 / DASH_CD, 'AI dashes a minute within the dash cooldown'); }

// ---- 6. Conquest: enemies, commanders, garrisons and town raids never read the player's gear; better gear makes them easier ----
{ const cx = vm.createContext({ console }); for (const f of ['js/range-host.js', 'js/rules.js', 'js/game.js', 'js/conquest/world.js', 'js/conquest/combat.js', 'js/conquest/plot.js']) vm.runInContext(src(f), cx, { filename: f });
  const C = cx.ConquestCombat, Wd = cx.ConquestWorld, P = cx.ConquestPlot, clone = x => JSON.parse(JSON.stringify(x)), stock = clone(GEAR.stock), legend = clone(GEAR.legend);
  const p = { x: 1160, z: 1048, y: Wd.groundAt(1160, 1048), surface: 'ground' };
  const statsOf = B => clone(B.enemies.map(e => [e.kind, e.hp, e.stats, e.cd]));
  ok(J(statsOf(new C.Battle(stock, p))) === J(statsOf(new C.Battle(legend, p))), 'Conquest waves: fixed authored enemy stats, whatever you field');
  const rid = C.raidIds[0], ro = C.operations[rid], opP = { x: ro.entry[0], z: ro.entry[1], y: Wd.groundAt(ro.entry[0], ro.entry[1]), surface: 'ground' };   // a HARD raid: doctrine garrison + commander deploy at the start
  const opA = new C.Operation(stock, opP, rid), opB = new C.Operation(legend, opP, rid);
  ok(J(statsOf(opA)) === J(statsOf(opB)) && opA.enemies.some(e => e.commander) && J(opA.enemies.filter(e => e.commander).map(e => [e.pattern, e.hp])) === J(opB.enemies.filter(e => e.commander).map(e => [e.pattern, e.hp])), 'Conquest garrison + commander: fixed authored stats and patterns, whatever you field');
  ok(!/loadout|playerStats|snapshot|tankOf|powerOf/.test(String(P.drill)) && !/loadout|playerStats|snapshot|tankOf|powerOf/.test(String(P.drillGen)), 'town raids (plot.js drill/raid) take no loadout: walls, turrets and raider waves only');
  // a fixed stationary heavy sentinel (the garrison's toughest unit) under fire: the Legendary kit must kill it far faster
  const kill = L => { const B = new C.Battle(L, p), e = B.enemies.find(x => x.kind === 'sentinel') || B.enemies[0]; Object.assign(e, { x: 1175, z: 1048, y: Wd.groundAt(1175, 1048), hp: 1100, maxHp: 1100, decision: 1e9, cd: 1e9, vx: 0, vz: 0 }); B.enemies = [e]; let t = 0; while (e.hp > 0 && t < 60) { B.tick(1 / 30, p, { fire: true, aim: { x: e.x, y: e.y + 2.2, z: e.z } }); t += 1 / 30; } return t; };
  const ks = kill(stock), kl = kill(legend); ok(kl < ks * 0.6, 'Conquest: the Legendary kit kills a heavy sentinel far faster than stock (' + kl.toFixed(1) + ' s vs ' + ks.toFixed(1) + ' s)');
  // a redoubt commander's patterns keep their authored cadence (doctrine), never the player's
  ok(Object.isFrozen(C.raidDoctrine.VETERAN) && C.raidDoctrine.VETERAN.hull === 1.55 && C.raidDoctrine.VETERAN.damage === 1.5 && J(C.raidDoctrine.VETERAN.garrison) === J(['raider', 'command']), 'raid doctrine is authored and frozen (VETERAN hull 1.55, damage 1.5, garrison raider + command)');
  // the same enemy fire, taken: the Legendary kit survives longer under a sentinel's gun
  const left = L => { const B = new C.Battle(L, p), e = B.enemies.find(x => x.kind === 'sentinel') || B.enemies[0]; Object.assign(e, { x: 1175, z: 1048, y: Wd.groundAt(1175, 1048), hp: 1e9, maxHp: 1e9, vx: 0, vz: 0 }); B.enemies = [e]; let t = 0; while (B.playerHp > 0 && t < 60) { B.tick(1 / 30, p, {}); t += 1 / 30; } return B.playerHp / B.playerMax; };
  const hs = left(stock), hl = left(legend); ok(hl > hs + 0.1, 'Conquest: after a minute under the same enemy fire the Legendary kit keeps more of its hull than stock (' + (hl * 100).toFixed(0) + '% vs ' + (hs * 100).toFixed(0) + '%)'); }

if (fails.length) { console.log('\nFAIL fair arcade: ' + fails.length + ' of ' + checks + ' checks failed'); process.exit(1); }
console.log('PASS fair arcade:', checks, 'checks');
