// Referral economy simulator: runs the real rules (js/rules.js) day by day for one referrer and N recruits.
// Scenarios: 0/1/10/25/50/100/200 recruits x launch phase (active pilots 9,999 ... 50,000) x normal vs farming.
// Reports the referrer's average points per day (days 15-44: after recruits can be verified), split into own play,
// match bonus, 5% share and milestones, plus the points-pool score per day (referral points at 7.5%).
// 8 seeds. Usage: node dev/tests/wtest/referral-sim.mjs [--md]
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const MD = process.argv.includes('--md'), SEEDS = 8, DAYS = 45, FROM = 15;
const rng = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// player profiles: matches a day, points a match, chance to play on a given day
const OWN = { m: 10, p: 450 };                          // the referrer: a solid player, ~4,500 match points a day
const HONEST = { m: 6, p: 400, play: 0.6, stay: 0.55 };   // real friends: 55% stick around, those play 60% of days
const FARM = { m: 3, p: 350, play: 5 / 7, stay: 1 };      // scripted alts: the minimum to look active, every one stays
let BONUS = true;
function run(n, ap, kind, seed) {
  const r = rng(seed * 7919 + n * 31 + (kind === 'farm' ? 1 : 0)), ph = R.refPhaseOf(ap, 0), rx = R.refPhaseX(ph);
  const P = kind === 'farm' ? FARM : HONEST, me = R.ecoNorm({}), recs = [];
  for (let i = 0; i < n; i++) recs.push({ id: 'r' + i, S: R.ecoNorm({}), stays: r() < P.stay });
  const tot = { own: 0, bonus: 0, share: 0, ms: 0, score: 0, cap: 0 };
  for (let d = 0; d < DAYS; d++) {
    const X = { day: 40000 + d, week: Math.floor((40000 + d) / 7), rnd: r, pk: 'me', rx };
    for (const c of recs) {   // recruits play (server settlement: award, verified day, phase-pinned tracking)
      if (!(d < 2 || c.stays) || r() > P.play) continue;
      const e0 = c.S.earned, f0 = c.S.rfe;
      for (let k = 0; k < P.m; k++) R.ecoAward(c.S, P.p, X);
      R.ecoPlayDay(c.S, X); R.ecoRefTrack(c.S, X, e0, f0);
    }
    const rows = recs.map((c) => ({ id: c.id, rb: c.S.rb, rms: c.S.rms, vd: c.S.vd, vdl: c.S.vdl }));
    me.mbx = BONUS ? R.refBonusOf(rows.filter((x) => R.refVerified(x, X.day)).length) : 0;
    const e0 = me.earned, f0 = me.rfe; let own = 0, bon = 0;
    for (let k = 0; k < OWN.m; k++) { const b = R.ecoBonusAward(me, OWN.p, X); own += b.awarded - b.bonus; bon += b.bonus; }
    R.ecoPlayDay(me, X);
    const sq = R.ecoSquad(me, rows, X, null, []);
    R.ecoRefTrack(me, X, e0, f0);
    if (d >= FROM) {
      const pd = me.refPD && me.refPD.d === X.day ? me.refPD.a : 0;
      tot.own += own; tot.bonus += bon; tot.share += pd; tot.ms += sq.pts - pd; tot.cap += me.dailyPts >= R.DAILY_CAP ? 1 : 0;
      tot.score += own + Math.round((bon + sq.pts) * R.AIRDROP.refW);
    }
  }
  const k = DAYS - FROM;
  return { own: tot.own / k, bonus: tot.bonus / k, share: tot.share / k, ms: tot.ms / k, total: (tot.own + tot.bonus + tot.share + tot.ms) / k, score: tot.score / k, capDays: tot.cap / k, mbx: me.mbx, verified: recs.filter((c) => (c.S.vd | 0) >= 5).length };
}
const avg = (n, ap, kind) => { const o = {}; for (let s = 1; s <= SEEDS; s++) { const r = run(n, ap, kind, s); for (const [k, v] of Object.entries(r)) o[k] = (o[k] || 0) + v / SEEDS; } return o; };
const NS = [0, 1, 10, 25, 50, 100, 200], APS = [9999, 10000, 24999, 25000, 49999, 50000];
const f = (x) => Math.round(x).toLocaleString('en-US');
const rows = [];
for (const kind of ['honest', 'farm']) for (const ap of APS) for (const n of NS) { const r = avg(n, ap, kind); rows.push({ kind, ap, n, ...r }); }
const head = ['type', 'active pilots', 'phase', 'recruits', 'own play/day', 'match bonus/day', '5% share/day', 'milestones/day', 'total/day', 'pool score/day', 'days at 20k cap'];
const line = (r) => [r.kind, f(r.ap), '×' + R.refPhaseX(R.refPhaseOf(r.ap, 0)), r.n, f(r.own), f(r.bonus), f(r.share), f(r.ms), f(r.total), f(r.score), Math.round(r.capDays * 100) + '%'];
if (MD) { console.log('| ' + head.join(' | ') + ' |\n|' + head.map(() => '---').join('|') + '|'); for (const r of rows) console.log('| ' + line(r).join(' | ') + ' |'); }
else { console.log(head.join('\t')); for (const r of rows) console.log(line(r).join('\t')); }
// verdict on the match bonus itself: run every scenario again with it off. Exploitable or dominant if, anywhere, the bonus
// adds more than 10% to a pilot's points-pool score (the airdrop ranking), or anything tops the 20,000 cap
BONUS = false;
const off = {}; for (const kind of ['honest', 'farm']) for (const ap of APS) for (const n of NS) off[kind + ap + '|' + n] = avg(n, ap, kind);
const base = rows.find((r) => r.kind === 'honest' && r.n === 0 && r.ap === 9999).score;
const marg = rows.map((r) => ({ r, d: (r.score - off[r.kind + r.ap + '|' + r.n].score) / base, dt: r.total - off[r.kind + r.ap + '|' + r.n].total }));
const worst = marg.reduce((m, x) => (x.d > m.d ? x : m), marg[0]), best = rows.reduce((m, r) => (r.score > m.score ? r : m), rows[0]);
const capBreak = rows.some((r) => r.total > R.DAILY_CAP + 1);
console.log(`\nbaseline pool score/day (no recruits): ${f(base)}; highest with referrals: ${f(best.score)} (${best.kind}, ${best.n} recruits) = ${(best.score / base).toFixed(2)}x, bounded by the 20,000 cap`);
console.log(`match bonus, largest marginal effect: +${(worst.d * 100).toFixed(1)}% pool score, +${f(worst.dt)} points/day (${worst.r.kind}, ${worst.r.n} recruits, ×${R.refPhaseX(R.refPhaseOf(worst.r.ap, 0))}); any day over the cap: ${capBreak}`);
console.log(worst.d > 0.10 || capBreak ? 'VERDICT: exploitable or dominant -> keep the match bonus OFF' : 'VERDICT: bounded -> match bonus ON');
