// Airdrop research boards at 1k / 10k / 50k players (8 seeds): who qualifies for the Points pool (top 1,000 by play score)
// and the Referral pool (top 250 recruiters, 10+ verified active recruits, sqrt-dampened quality, 2% cap), top-10
// concentration in each, and the average share of the player airdrop (points pool 90%, referral pool 10%).
// Usage: node dev/tests/wtest/airdrop-sim.mjs
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const A = R.adCfg({}), SEEDS = 8, DAY = 50000;
const rng = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function world(N, seed) {
  const r = rng(seed * 104729 + N), P = [];
  for (let i = 0; i < N; i++) {
    const days = Math.max(1, Math.round(Math.exp(r() * 3.6)));           // 1..~36 active days, most pilots few
    const perDay = 1500 + r() * r() * 14000;                              // most casual, some grinders
    P.push({ id: i, days, play: Math.round(days * perDay), ref: [], rfe: 0, recBy: -1, farm: false });
  }
  // invites: most invite nobody, ~6% a few, ~0.5% are big inviters; ~0.2% run farms of 10-60 alts
  const recruitPool = P.map((p) => p.id).sort(() => r() - 0.5); let k = 0;
  for (const p of P) {
    const u = r(), n = u < 0.002 ? 0 : u < 0.007 ? 15 + Math.floor(r() * 60) : u < 0.067 ? 1 + Math.floor(r() * 6) : 0;
    for (let j = 0; j < n && k < recruitPool.length; j++) { const c = P[recruitPool[k++]]; if (c.recBy < 0 && c.id !== p.id) { c.recBy = p.id; p.ref.push(c); } }
    if (u < 0.002) { p.farm = true; const m = 10 + Math.floor(r() * 50); for (let j = 0; j < m; j++) p.ref.push({ id: -1, days: 5 + Math.floor(r() * 4), play: 4000, farm: true, held: r() < 0.7 }); }   // 70% of farm alts caught (device/IP/bot flags)
  }
  for (const p of P) { const share = p.ref.reduce((t, c) => t + (c.play || 0) * 0.05, 0); p.rfe = Math.round(Math.min(share + p.ref.length * 2500, p.days * 6000)); }
  return P;
}
const top10 = (sh) => sh.slice().sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0);
function measure(N, seed) {
  const P = world(N, seed);
  const pts = P.map((p) => ({ id: p.id, s: R.airdropScore(p.play + p.rfe, p.rfe, A.refW) })).sort((a, b) => b.s - a.s).slice(0, A.ptsTop);
  const pSh = R.poolShares(pts.map((x) => x.s), 1);
  const rr = P.map((p) => ({ p, sc: R.refPoolScore(p.ref.map((c) => ({ vd: Math.min(c.days, 40), vdl: c.days >= 5 ? DAY - 1 : DAY - 30, held: !!c.held })), DAY, A) }))
    .filter((x) => x.sc.ok).sort((a, b) => b.sc.s - a.sc.s).slice(0, A.refTop);
  const rSh = R.poolShares(rr.map((x) => x.sc.s), A.refCap);
  const both = rr.filter((x) => pts.some((y) => y.id === x.p.id)).length;
  return { ptsN: pts.length, refN: rr.length, both, farms: rr.filter((x) => x.p.farm).length, pTop10: top10(pSh), rTop10: top10(rSh),
    avgP: (1 - A.refShare) / Math.max(1, pts.length), avgR: rr.length ? (A.refShare * rSh.reduce((a, b) => a + b, 0)) / rr.length : 0, maxR: rSh.length ? A.refShare * Math.max(...rSh) : 0 };
}
const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
console.log('| players | Points pool qualifies | Referral pool qualifies | in both | farms in ref pool | top-10 of points pool | top-10 of ref pool | avg points share | avg referral share | largest referral share |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const N of [1000, 10000, 50000]) {
  const o = {}; for (let s = 1; s <= SEEDS; s++) { const m = measure(N, s); for (const [k, v] of Object.entries(m)) o[k] = (o[k] || 0) + v / SEEDS; }
  console.log(`| ${N.toLocaleString('en-US')} | ${Math.round(o.ptsN)} | ${o.refN.toFixed(1)} | ${o.both.toFixed(1)} | ${o.farms.toFixed(1)} | ${pct(o.pTop10)} | ${pct(o.rTop10)} | ${pct(o.avgP, 3)} | ${pct(o.avgR, 3)} | ${pct(o.maxR, 3)} |`);
}
console.log('\nShares are of the player airdrop. Referral pool = 10%, Points pool = 90%; nobody above 2% of the Referral pool (0.2% of the player airdrop).');
