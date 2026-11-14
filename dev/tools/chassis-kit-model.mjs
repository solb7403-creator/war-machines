// The 8-week chassis kit model (Session 5E-2b3, owner Nov 14 2026): "a free player who plays daily fully kits one chassis (all its
// cores and upgrades) in about 8 weeks, so all three takes about 6 months". It runs the game's own economy code (js/rules.js:
// ecoLogin, ecoMatchPts, ecoAfterMatch, ecoClaimDaily, ecoClaimWeekly, ecoChest, ecoClaimPass, ecoUp, ecoCratePts, ecoCorePts,
// power and leagues) day by day for a free pilot, and spends every point on the chassis being kitted. A full kit = the 14-level
// build at its dearest (Hull, Cannon and Engine maxed, Targeting 2: 62,500 points) and all seven cores at level 5 (238 shards).
// Assumptions (each one printed in the output): the pilot plays M minutes of matches a day across every mode and team size, wins
// 55% (5% draws in modes that have them; 2nd on average in Last Standing), finishes the four daily quests every day, three of five
// weekly quests, opens the weekly chest, claims the daily reward and the free Lunar Pass track, and flies Rare gear (a Rare Pulse
// Cannon and a Rare chassis: what the pass and the first crates give a daily player). Match lengths are the measured round lengths
// (Checkpoint 36) plus 30 s of VS screen, results and menus. Free gem caches go to the chassis being kitted (the Shop's "Cores for").
// Points policy: the cheapest next upgrade level when it is affordable; then Epic gem caches with points while four or more cores
// are below level 5; then chosen cores (the smallest pick that still fits) to finish without waste.
// usage: node dev/tools/chassis-kit-model.mjs [--rate N] [--json docs/economy/chassis-kit-model.json]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
function world(rate) {
  const ctx = vm.createContext({ console, Math });
  let src = fs.readFileSync(path.join(repo, 'js', 'rules.js'), 'utf8').replace(/^'use strict';[^\n]*\n/m, '');
  if (rate !== undefined) src = src.replace(/const GEM_PTS_STAR=[\d.]+,/, 'const GEM_PTS_STAR=' + rate + ',');
  vm.runInContext(src + '\n;globalThis.R={ecoNorm,ecoLogin,ecoMatchPts,ecoAfterMatch,ecoClaimDaily,ecoClaimWeekly,ecoChest,ecoClaimPass,ecoPassState,ecoPassTier,ecoUp,ecoCratePts,ecoCorePts,ecoLoadout,powerOf,ecoLeague,leagueInfo,DQ_BY,WQ_BY,GORDER,UORDER,UPS,SHARD_NEED,GEM_PTS,CORE_N,corePts,GEM_PTS_STAR,RSTARS,MODES,GTYPES,GT_ORDER,isSolo,featuredOn,passTiers,PASS_XP,LEAGUE,BUILD_MAX,upLevels,chUp,chGl,chGs};', ctx);
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
const ORDER = ['titan', 'vanguard', 'scout'];
const main = () => {
  const fixed = arg('--rate'), M = +arg('--minutes', 20);   // the reference pilot: 20 minutes of matches a day, every day
  // calibrate: the rate (points per Star) at which the 20-minute daily pilot kits the first chassis closest to 56 days, on average over
  // five seeds (review: one seed swings it 49-56 days). The shipped rate stays while its average is within a week of 56 (7 to 9 weeks)
  const SEEDS = [1, 2, 3, 4, 5], avg = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), span = (xs) => [Math.min(...xs), Math.max(...xs)];
  const runs = (R, m, opt = {}) => SEEDS.map((seed) => simulate(R, m, ORDER, { ...opt, seed }));
  const sumUp = (rs) => { const f = rs.map((r) => (r.kits[0] ? r.kits[0].days : 800)), a = rs.map((r) => (r.kits.length === 3 ? r.totalDays : 800)); return { first: avg(f), firstRange: span(f), all: avg(a), allRange: span(a), perDay: avg(rs.map((r) => r.earnedPerDay)) }; };
  const cand = [];
  for (const rate of fixed ? [+fixed] : [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40]) { const R = world(rate), r = simulate(R, M, ORDER), m = sumUp(runs(R, M)); cand.push({ rate, first: m.first, all: m.all, firstRange: m.firstRange, allRange: m.allRange, seed7: [r.kits[0] && r.kits[0].days, r.totalDays], r }); }
  const near56 = cand.reduce((a, b) => (Math.abs((b.first || 1e9) - 56) < Math.abs((a.first || 1e9) - 56) ? b : a));
  const shipped = +((fs.readFileSync(path.join(repo, 'js', 'rules.js'), 'utf8').match(/const GEM_PTS_STAR=([\d.]+),/) || [])[1]);
  const best = cand.find((c) => c.rate === shipped && c.first >= 49 && c.first <= 63) || near56;
  const R = world(best.rate);
  const profiles = [10, 15, 20, 30, 45, 60].map((m) => { const r = simulate(R, m, ORDER), a = sumUp(runs(R, m)); return { minutes: m, firstKitDays: a.first, firstKitRange: a.firstRange, allThreeDays: a.all, allThreeRange: a.allRange, perDay: a.perDay, kits: r.kits, sources: r.src, spend: r.spend, shards: r.shards }; });
  // a light pilot like the owner's data point (about 5 minutes a day, half the dailies, one weekly): the 8-week target is not this pace
  const light = [5, 10].map((m) => ({ minutes: m, dailies: 2, weeklies: 1, ...sumUp(runs(R, m, { dq: 2, wk: 1 })) }));
  // the owner's data point: 83,000 points in two weeks of light play on his maxed account (league multiplier applies)
  const ownerCheck = [5, 10, 15, 20].map((m) => { const W = world(best.rate), S = W.ecoNorm({ mig: 1 }); S.mp = 300; S.lwr = 0.6; const rnd = rng(3); let pts = 0;
    for (let d = 0; d < 14; d++) { const X = { day: 21000 + d, week: Math.floor((21000 + d - 4) / 7), rnd, pk: 'owner' }; const p0 = S.pts; W.ecoLogin(S, X); let secs = m * 60;
      while (secs > 0) { const [g, mm] = MIX[Math.floor(rnd() * MIX.length)], len = LEN[g][mm] + OVERHEAD; if (secs < len * 0.5) break; secs -= len; const x = rnd(), solo = W.isSolo(g); const o = { won: solo ? x < 0.4 : x < 0.75, drawn: false, place: solo ? (x < 0.4 ? 1 : 2) : 0, top3: solo, g, m: solo ? '1v1' : mm, feat: g === W.featuredOn(X.day), series: g === 'arena' && mm === '1v1', st: {} }; W.ecoMatchPts(S, o, 6, X); W.ecoAfterMatch(S, o, X); }
      for (const id of S.dq.ids.slice(0, 2)) { const Q = W.DQ_BY[id]; if (Q) { S.dq.p[id] = Q.goal; W.ecoClaimDaily(S, id, X); } }   // light play: about half the dailies
      pts += S.pts - p0; }
    return { minutesPerDay: m, league: 'Lunar Legend', twoWeeks: Math.round(pts) }; });
  const res = { rateStarsToPoints: best.rate, gemCachePts: R.GEM_PTS, chosenCorePts: [0, 1, 2].map((ri) => R.corePts(ri)), coreShards: R.CORE_N, calibration: cand.map((c) => ({ rate: c.rate, firstKitDays: c.first, firstKitRange: c.firstRange, allThreeDays: c.all, allThreeRange: c.allRange })), seeds: SEEDS, near56: near56.rate,
    profiles, light, ownerCheck, assumptions: { matchSeconds: LEN, overheadSeconds: OVERHEAD, winRate: WIN, drawRate: DRAW, gear: 'Rare Pulse Cannon and a Rare chassis', fullBuild: FULL_UP, dailies: '4 a day', weeklies: '3 of 5', chest: 'every week', pass: 'free track', freeCachesTo: 'the chassis being kitted' } };
  const out = arg('--json'); if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log('wrote', out); }
  console.log('calibration (points per Star -> days to kit the first chassis / all three):', res.calibration.map((c) => c.rate + ':' + c.firstKitDays + '/' + c.allThreeDays).join('  '));
  console.log('chosen rate', res.rateStarsToPoints, 'gem caches', res.gemCachePts.join(' / '), 'chosen cores', res.chosenCorePts.join(' / '));
  for (const p of light) console.log('light pilot ' + p.minutes + ' min/day, 2 dailies: first kit ' + p.first + ' d ' + JSON.stringify(p.firstRange) + ', all three ' + p.all + ' d, ~' + p.perDay + ' pts/day');
  for (const p of profiles) console.log(p.minutes + ' min/day: first kit ' + p.firstKitDays + ' d ' + JSON.stringify(p.firstKitRange) + ', all three ' + p.allThreeDays + ' d ' + JSON.stringify(p.allThreeRange) + ', ~' + p.perDay + ' pts/day; seed 7 kits', JSON.stringify(p.kits.map((k) => [k.chassis, k.days, k.league])), 'sources', JSON.stringify(p.sources), 'shards', JSON.stringify(p.shards));
  console.log('owner check (two weeks at Lunar Legend):', JSON.stringify(ownerCheck));
};
main();
