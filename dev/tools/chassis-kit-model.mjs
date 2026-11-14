// The chassis kit model. Session 5E-2b3 (Checkpoint 37) set it up for an 8-week target; owner, Nov 14 2026 (Checkpoint 38): the
// target is now about 12 weeks (84 days): "a free player who plays 20 minutes a day plus the daily quests fully kits one chassis
// (all seven cores at level 5 plus the full build) in about 12 weeks". The owner set the numbers (3,500 a daily quest, 12,500 a
// weekly quest, 120 points a Star for a random gem cache, 175 a Star for a chosen core); this tool REPORTS what they give, it
// does not pick a rate. It runs the game's own economy code (js/rules.js: ecoLogin, ecoMatchPts, ecoAfterMatch, ecoClaimDaily,
// ecoClaimWeekly, ecoChest, ecoClaimPass, ecoUp, ecoCratePts, ecoCorePts, ecoPlayAward, power and leagues) day by day for a free
// pilot, and spends every point on the chassis being kitted. A full kit = the 14-level build at its dearest (Hull, Cannon and
// Engine maxed, Targeting 2: 62,500 points) and all seven cores at level 5 (238 shards).
// Assumptions (each one printed in the output): the pilot plays M minutes of matches a day across every mode and team size, wins
// 55% (5% draws in modes that have them; 2nd on average in Last Standing), finishes the four daily quests every day, three of five
// weekly quests, opens the weekly chest, claims the daily reward and the free Lunar Pass track, and flies Rare gear (a Rare Pulse
// Cannon and a Rare chassis: what the pass and the first crates give a daily player). Match lengths are the measured round lengths
// (Checkpoint 36) plus 30 s of VS screen, results and menus. Free gem caches go to the chassis being kitted (the Shop's "Cores for").
// Points policy: the cheapest next upgrade level when it is affordable; then Epic gem caches with points while four or more cores
// are below level 5; then chosen cores (the smallest pick that still fits) to finish without waste.
// Conquest run (owner, Checkpoint 38; report only): the same pilot spends the M minutes in Conquest instead, at Conquest's points a
// minute for the Rare kit (docs/economy/economy-model.json conquestPpm, RESOURCE_ECONOMY.md 3.3: modeled from par minutes, not
// measured), times the Command Base multiplier (CQ_BASE_MULT) at a typical tier, plus that tier's Daily Base Yield points,
// credited as the server does (eco.js creditConquest: league base pay, then the league bonus, through ecoPlayAward). Conquest pays
// no match pass XP; the daily and weekly quests are still counted done (as in the Arcade run).
// usage: node dev/tools/chassis-kit-model.mjs [--rules js/rules.js] [--minutes 20] [--json docs/economy/chassis-kit-model.json]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
// rules: a rules.js to load (default: this checkout's; --rules takes e.g. main's, for the before column). rate / coreRate: points a
// Star for gem caches / chosen cores (sensitivity only; the shipped numbers are the owner's)
function world(rules, rate, coreRate) {
  const ctx = vm.createContext({ console, Math });
  let src = fs.readFileSync(rules, 'utf8').replace(/^'use strict';[^\n]*\n/m, '');
  if (rate !== undefined) src = src.replace(/const GEM_PTS_STAR=[\d.]+,/, 'const GEM_PTS_STAR=' + rate + ',');
  if (coreRate !== undefined) src = src.replace(/CORE_PTS_STAR=[\d.]+,/, 'CORE_PTS_STAR=' + coreRate + ',');
  vm.runInContext(src + '\n;globalThis.R={CORE_PTS_STAR:typeof CORE_PTS_STAR==="undefined"?undefined:CORE_PTS_STAR,CORE_X,ecoPlayAward,ecoPlayDay,ecoDailyRows,ecoWeeklyRows,CQ_BASE_MULT,CQ_YIELD,DQ_POOL,WQ_POOL,DQ_ALL_BONUS,WQ_PTS,ecoNorm,ecoLogin,ecoMatchPts,ecoAfterMatch,ecoClaimDaily,ecoClaimWeekly,ecoChest,ecoClaimPass,ecoPassState,ecoPassTier,ecoUp,ecoCratePts,ecoCorePts,ecoLoadout,powerOf,ecoLeague,leagueInfo,DQ_BY,WQ_BY,GORDER,UORDER,UPS,SHARD_NEED,GEM_PTS,CORE_N,corePts,GEM_PTS_STAR,RSTARS,MODES,GTYPES,GT_ORDER,isSolo,featuredOn,passTiers,PASS_XP,LEAGUE,BUILD_MAX,upLevels,chUp,chGl,chGs};', ctx);
  return ctx.R;
}
// measured round lengths (s), Checkpoint 36 "after" column; Arena 1v1 is a best of 3 (about 2.5 rounds)
const LEN = { arena: { '1v1': 60, '2v2': 50, '3v3': 91 }, zone: { '1v1': 106, '2v2': 139, '3v3': 173 }, crystal: { '1v1': 95, '2v2': 102, '3v3': 102 },
  bounty: { '1v1': 120, '2v2': 120, '3v3': 120 }, royale: { '1v1': 60 }, boss: { '1v1': 73, '2v2': 92, '3v3': 97 } };
const OVERHEAD = 30, WIN = 0.55, DRAW = 0.05;
const MIX = Object.entries(LEN).flatMap(([g, ms]) => Object.keys(ms).map((m) => [g, m]));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FULL_UP = { hull: 4, cannon: 4, engine: 4, target: 2, reactor: 0 };   // the dearest 14-level build: 62,500 points
// one pilot, from day d0, kitting the chassis in `order` one after another; M minutes of matches a day
function simulate(R, M, order, opt = {}) {
  const rnd = rng(opt.seed || 7), d0 = 20900;
  const S = R.ecoNorm({ mig: 1, wOwn: { pulse: [0, 1] }, cOwn: { scout: [0, 1], vanguard: [0, 1], titan: [0, 1] }, roll: { 'pulse:1': 1.07, 'scout:1': 1.07, 'vanguard:1': 1.07, 'titan:1': 1.07 } });
  S.mp = 40; S.lwr = 0.55; S.fd = d0 - 30;   // past the first days (no newcomer gift in the model)
  const out = [], spend = { up: 0, cache: 0, core: 0 }, src = { match: 0, quests: 0, login: 0, chest: 0, pass: 0 }, shards = { free: 0, cache: 0, core: 0, wasted: 0 };
  let k = 0, day = 0, kitStart = 0, flyC = order[0];
  const done = (c) => R.UORDER.every((u) => (R.chUp(S, c)[u] | 0) >= FULL_UP[u]) && R.GORDER.every((g) => (R.chGl(S, c)[g] | 0) >= 5);
  const need = (c, g) => { const lv = R.chGl(S, c)[g] | 0, sh = R.chGs(S, c)[g] | 0; let n = -sh; for (let l = lv; l < 5; l++) n += R.SHARD_NEED[l]; return Math.max(0, n); };
  const kitL = () => R.ecoLoadout(S, { w: { a: 'pulse', t: 1 }, c: { c: flyC, t: 1 }, cores: ['dmg', 'rof', 'arm'] });
  const track = (f, key) => { const p0 = S.pts; f(); if (key) src[key] += S.pts - p0; };
  while (k < order.length && day < 800) {
    const X = { day: d0 + day, week: Math.floor((d0 + day - 4) / 7), rnd, pk: 'model' }, c = order[k];
    // the league follows the chassis flown: the kitted one once there is one (a pilot flies their best), else the one being kitted
    const pw = R.powerOf(kitL()), lg = R.ecoLeague(S, pw).i;
    const shardsOn = () => R.GORDER.reduce((a, g) => { const lv = R.chGl(S, c)[g] | 0; let n = R.chGs(S, c)[g] | 0; for (let l = 1; l < lv; l++) n += R.SHARD_NEED[l]; return a + n; }, 0), sh0 = shardsOn();
    track(() => R.ecoLogin(S, X, c), 'login');
    let secs = M * 60, plays = 0;
    if (opt.conquest) {   // the M minutes in Conquest: points a minute x Command Base multiplier, plus the Daily Base Yield (flat), as eco.js creditConquest credits them
      const C = opt.conquest, raw = C.ppm * M * R.CQ_BASE_MULT[C.tier] + (R.CQ_YIELD.pts[C.tier] || 0), L = R.leagueInfo(lg), b = Math.round(raw * L.pay);
      track(() => { R.ecoPlayAward(S, b, Math.round(b * L.mult), X); R.ecoPlayDay(S, X); }, 'match'); R.ecoDailyRows(S, X); R.ecoWeeklyRows(S, X); secs = 0;
    }
    while (secs > 0) {
      const [g, m] = MIX[Math.floor(rnd() * MIX.length)], len = LEN[g][m] + OVERHEAD; if (secs < len * 0.5) break; secs -= len; plays++;
      const solo = R.isSolo(g), x = rnd(), hasDraw = ['zone', 'crystal', 'boss'].includes(g);
      const won = solo ? x < 0.30 : x < WIN, drawn = !solo && hasDraw && !won && x < WIN + DRAW, place = solo ? (won ? 1 : x < 0.7 ? 2 + Math.floor(rnd() * 2) : 4 + Math.floor(rnd() * 3)) : 0;
      const o = { won, drawn, place, top3: solo && place <= 3, g, m: solo ? '1v1' : m, feat: g === R.featuredOn(X.day), series: g === 'arena' && m === '1v1', quick: false, st: { dmg: 3000, sup: 2, box: 1, kills: 1 } };
      track(() => { R.ecoMatchPts(S, o, lg, X); R.ecoAfterMatch(S, o, X); }, 'match');
    }
    // the four daily quests, every day (opt.dq: fewer, for a light pilot)
    track(() => { for (const id of S.dq.ids.slice(0, opt.dq ?? 4)) { const Q = R.DQ_BY[id]; if (!Q) continue; S.dq.p[id] = Q.goal; R.ecoClaimDaily(S, id, X); } }, 'quests');
    // three weekly quests by the week's last day; the chest as soon as it opens
    if ((d0 + day - 4) % 7 === 6) track(() => { for (const id of S.wk.ids.slice(0, opt.wk ?? 3)) { const Q = R.WQ_BY[id]; if (!Q) continue; S.wk.p[id] = Q.goal; R.ecoClaimWeekly(S, id, X); } }, 'quests');
    track(() => R.ecoChest(S, X, c), 'chest');
    track(() => { const P = R.ecoPassState(S, X), tier = R.ecoPassTier(S, X); for (let i = 1; i <= tier; i++) if (!P.cf.includes(i)) R.ecoClaimPass(S, 'f', i, X, c); }, 'pass');
    shards.free += shardsOn() - sh0;
    // spend everything on chassis c
    for (let guard = 0; guard < 400; guard++) {
      const U = R.chUp(S, c), nx = R.UORDER.filter((u) => (U[u] | 0) < FULL_UP[u]).map((u) => [u, R.UPS[u].costs[U[u] | 0]]).sort((a, b) => a[1] - b[1])[0];
      if (nx) { if (S.pts >= nx[1]) { R.ecoUp(S, nx[0], c); spend.up += nx[1]; continue; } break; }   // the build first (cheap power), then the cores
      const below = R.GORDER.filter((g) => need(c, g) > 0);
      if (!below.length) break;
      if (below.length >= 4) { if (S.pts < R.GEM_PTS[2]) break; const before = R.GORDER.map((g) => need(c, g)); const r = R.ecoCratePts(S, 'gem', 2, X, c); spend.cache += R.GEM_PTS[2]; shards.cache += r.n; shards.wasted += Math.max(0, r.n - before[R.GORDER.indexOf(r.gem)]); continue; }
      const g = below.sort((a, b) => need(c, a) - need(c, b))[0], n = need(c, g), ri = n >= R.CORE_N[2] * 0.75 ? 2 : n > R.CORE_N[1] ? 1 : n > R.CORE_N[0] ? 1 : 0, p = R.corePts(ri);
      if (S.pts < p) break; R.ecoCorePts(S, g, ri, c, X); spend.core += p; shards.core += R.CORE_N[ri]; shards.wasted += Math.max(0, R.CORE_N[ri] - n);
    }
    day++;
    if (done(c)) { out.push({ chassis: c, days: day - kitStart, weeks: Math.round((day - kitStart) / 7 * 10) / 10, endDay: day, league: R.LEAGUE[lg].n, power: pw }); kitStart = day; flyC = c; k++; }
  }
  return { kits: out, totalDays: day, spend, src, shards, pts: Math.round(S.pts), earnedPerDay: Math.round((S.earned || 0) / Math.max(1, day)) };
}
const ORDER = ['titan', 'vanguard', 'scout'], TARGET = 84;   // owner, Nov 14 2026: about 12 weeks for the first chassis
const main = () => {
  const rules = path.resolve(arg('--rules', path.join(repo, 'js', 'rules.js'))), M = +arg('--minutes', 20);   // the reference pilot: 20 minutes of matches a day, every day
  // every figure: the average of five seeds (Checkpoint 37 review: one seed swings it about a week), with the range
  const SEEDS = [1, 2, 3, 4, 5], avg = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), span = (xs) => [Math.min(...xs), Math.max(...xs)];
  const runs = (R, m, opt = {}) => SEEDS.map((seed) => simulate(R, m, ORDER, { ...opt, seed }));
  const sumUp = (rs) => { const f = rs.map((r) => (r.kits[0] ? r.kits[0].days : 800)), a = rs.map((r) => (r.kits.length === 3 ? r.totalDays : 800)); return { first: avg(f), firstRange: span(f), all: avg(a), allRange: span(a), perDay: avg(rs.map((r) => r.earnedPerDay)) }; };
  const R = world(rules), GSTAR = R.GEM_PTS_STAR, CSTAR = R.CORE_PTS_STAR || R.GEM_PTS_STAR * R.CORE_X;
  const prices = { gemPtsStar: GSTAR, corePtsStar: CSTAR, gemCachePts: R.GEM_PTS, chosenCorePts: [0, 1, 2].map((ri) => R.corePts(ri)), coreShards: R.CORE_N,
    dailyQuestPts: [...new Set(R.DQ_POOL.map((q) => q.pts))], weeklyQuestPts: [...new Set(R.WQ_POOL.map((q) => q.pts))], allFourBonus: R.DQ_ALL_BONUS, weeklyChest: R.WQ_PTS };
  const profiles = [10, 15, 20, 30, 45, 60].map((m) => { const r = simulate(R, m, ORDER), a = sumUp(runs(R, m)); return { minutes: m, firstKitDays: a.first, firstKitRange: a.firstRange, allThreeDays: a.all, allThreeRange: a.allRange, perDay: a.perDay, kits: r.kits, sources: r.src, spend: r.spend, shards: r.shards }; });
  const ref = profiles.find((p) => p.minutes === M) || profiles[2];
  // sensitivity (report only, not applied): the gem cache rate with the chosen core rate kept at the owner's ratio
  const sens = [80, 100, 120, 140, 160].map((g) => { const W = world(rules, g, Math.round(g * CSTAR / GSTAR * 100) / 100), a = sumUp(runs(W, M)); return { gemPtsStar: g, corePtsStar: Math.round(g * CSTAR / GSTAR * 100) / 100, firstKitDays: a.first, firstKitRange: a.firstRange, allThreeDays: a.all }; });
  // a light pilot like the owner's data point (about 5 minutes a day, half the dailies, one weekly): the 12-week target is not this pace
  const light = [5, 10].map((m) => ({ minutes: m, dailies: 2, weeklies: 1, ...sumUp(runs(R, m, { dq: 2, wk: 1 })) }));
  // Conquest instead of Arcade (report only): the Rare kit's Conquest points a minute at Rookie with no base (league pay is applied
  // per day by the pilot's league, as creditConquest does), Command Base tiers none / III (typical: CC5-6) / V
  const eco = JSON.parse(fs.readFileSync(path.join(repo, 'docs', 'economy', 'economy-model.json'), 'utf8')), ppm = eco.conquestPpm.rare[0][0];
  const conquest = [0, 3, 5].map((tier) => ({ tier, tierName: ['none', 'I', 'II', 'III', 'IV', 'V'][tier], ppm, mult: R.CQ_BASE_MULT[tier], yieldPts: R.CQ_YIELD.pts[tier], minutes: M, ...sumUp(runs(R, M, { conquest: { ppm, tier } })) }));
  const res = { generatedBy: 'node dev/tools/chassis-kit-model.mjs', rules: path.relative(repo, rules), targetDays: TARGET, ...prices, seeds: SEEDS,
    reference: { minutes: M, firstKitDays: ref.firstKitDays, firstKitRange: ref.firstKitRange, allThreeDays: ref.allThreeDays, allThreeRange: ref.allThreeRange, perDay: ref.perDay, vsTarget: ref.firstKitDays - TARGET },
    profiles, light, conquest, sensitivity: sens,
    assumptions: { matchSeconds: LEN, overheadSeconds: OVERHEAD, winRate: WIN, drawRate: DRAW, gear: 'Rare Pulse Cannon and a Rare chassis', fullBuild: FULL_UP, dailies: '4 a day', weeklies: '3 of 5', chest: 'every week', pass: 'free track', freeCachesTo: 'the chassis being kitted',
      conquest: 'Rare kit at ' + ppm + ' base points a minute at Rookie (economy-model.json conquestPpm, modeled), x CQ_BASE_MULT, + the Daily Base Yield points, x league base pay and the league bonus; no match pass XP; quests counted done' } };
  const out = arg('--json'); if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log('wrote', out); }
  console.log('rules', res.rules, '| gem caches', R.GEM_PTS.join(' / '), '(' + GSTAR + ' a Star) | chosen cores', res.chosenCorePts.join(' / '), '(' + CSTAR + ' a Star) | dailies', res.dailyQuestPts.join(','), 'weeklies', res.weeklyQuestPts.join(','));
  console.log('reference pilot (' + M + ' min/day + dailies): first kit ' + ref.firstKitDays + ' d ' + JSON.stringify(ref.firstKitRange) + ' vs the ' + TARGET + '-day target (' + (ref.firstKitDays - TARGET >= 0 ? '+' : '') + (ref.firstKitDays - TARGET) + '), all three ' + ref.allThreeDays + ' d');
  for (const p of profiles) console.log(p.minutes + ' min/day: first kit ' + p.firstKitDays + ' d ' + JSON.stringify(p.firstKitRange) + ', all three ' + p.allThreeDays + ' d ' + JSON.stringify(p.allThreeRange) + ', ~' + p.perDay + ' pts/day; seed 7 kits', JSON.stringify(p.kits.map((k) => [k.chassis, k.days, k.league])), 'sources', JSON.stringify(p.sources), 'spend', JSON.stringify(p.spend), 'shards', JSON.stringify(p.shards));
  for (const p of light) console.log('light pilot ' + p.minutes + ' min/day, 2 dailies, 1 weekly: first kit ' + p.first + ' d ' + JSON.stringify(p.firstRange) + ', all three ' + p.all + ' d, ~' + p.perDay + ' pts/day');
  for (const c of conquest) console.log('Conquest ' + M + ' min/day, Command Base ' + c.tierName + ' (x' + c.mult + ', yield ' + c.yieldPts + '): first kit ' + c.first + ' d ' + JSON.stringify(c.firstRange) + ', all three ' + c.all + ' d ' + JSON.stringify(c.allRange) + ', ~' + c.perDay + ' pts/day');
  console.log('sensitivity (not applied):', sens.map((x) => x.gemPtsStar + '/' + x.corePtsStar + ': ' + x.firstKitDays + ' d ' + JSON.stringify(x.firstKitRange)).join('  '));
};
main();
