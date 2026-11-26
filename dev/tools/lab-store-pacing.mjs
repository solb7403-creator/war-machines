// Session 8 (owner brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md section 3): the Science Lab store's pacing for a pilot who
// BUYS EVERYTHING, before and after the owner's Nov 26 rules. SIMULATED (the game's own research rules with a scripted buyer), not
// playtesting: it says how fast money can finish the Lab, nothing about whether that is enjoyable.
//
// The buyer (the same assumptions the Session 6B "about 8-9 days" count used, so the two numbers compare):
//  - the regular town ladder (docs/conquest/audit/model/audit-economy.json, as dev/tools/economy-model.mjs researchModel): Science Lab
//    I and II the day after CC3, Science Lab III the day after CC5 (a construction speed-up could open them sooner: not modelled);
//  - one earned research part every UTC day (CQ_PART_DAY; the four kinds in turn) and the first Science Lab grant (2 Thermal, once);
//  - the premium Lunar Pass every season (its research perks: +1 slot, jobs x0.75, 1 of each part on tiers 10 / 20 / 30, a tier a day);
//  - every research pack every UTC week (RS_PACKS: +1, +3 and +8 of every part), bought at the week's first session;
//  - an instant finish on every research job (RS_FIN by the job's full time), so slots never wait;
//  - a Legendary set mod researched for free (30 of its track's part) whenever the parts are there, else bought as soon as the rules
//    allow: its track's set mod researched, and (after, owner Nov 26) at most RS_LEG_WEEK a UTC week. Before: no weekly limit.
// UTC weeks start Monday; the pilot's first day can be any weekday, so every result is given for all seven starts.
// usage: node dev/tools/lab-store-pacing.mjs [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSim } from '../../worker/build-sim.mjs';
buildSim();
const { RULES: R } = await import('../../worker/src/sim.gen.js');
const LADDER = JSON.parse(readFileSync(new URL('../../docs/conquest/audit/model/audit-economy.json', import.meta.url), 'utf8')).profiles.regular.base.hit;
const LAB_I = Math.ceil(LADDER.CC3.day) + 1, LAB_III = Math.ceil(LADDER.CC5.day) + 1;   // as researchModel
const RULESETS = {
  before: { label: 'Session 6B gates (no weekly limit, 599 Stars each)', legWeek: Infinity, legStars: 599 },
  after: { label: 'Owner, Nov 26 (one a UTC week, ' + R.RS_LEG_PRICE.stars + ' Stars each)', legWeek: R.RS_LEG_WEEK, legStars: R.RS_LEG_PRICE.stars },
};
export function pace(rules, startWeekday, { days = 120 } = {}) {
  const pt = Object.fromEntries(R.CQ_PART_ORDER.map((k) => [k, 0])), rs = { done: {}, jobs: [] }, bought = {};
  const spend = { packs: 0, legendary: 0, finish: 0 }, log = [];
  let tree = null, all = null, legBoughtWeek = -1, legThisWeek = 0, packWeek = -1, granted = false;
  for (let d = 0; d < days && all === null; d++) {
    const week = Math.floor((d + startWeekday) / 7);
    pt[R.CQ_PART_ORDER[d % 4]] += R.CQ_PART_DAY;                                   // the day's earned part
    const tier = d % R.PASS_LEN + 1; if (R.PASS_PREM_PARTS[tier]) for (const k of R.CQ_PART_ORDER) pt[k] += R.PASS_PREM_PARTS[tier];
    if (week !== packWeek) { packWeek = week; for (const k of R.RS_PACK_ORDER) { const P = R.RS_PACKS[k]; for (const q of R.CQ_PART_ORDER) pt[q] += P.each; spend.packs += P.stars; } }
    if (week !== legBoughtWeek) { legBoughtWeek = week; legThisWeek = 0; }
    const lv = d >= LAB_III ? 3 : d >= LAB_I ? 2 : 0; if (!lv) continue;
    if (!granted) { granted = true; pt.thermal += 2; }                              // the first Science Lab grant (once)
    // research everything affordable, cheapest first, each finished at once (bought); Legendary set mods: free when the parts are there
    for (let guard = 0; guard < 64; guard++) {
      const q = R.RS_IDS.filter((id) => !rs.done[id] && !bought[id]).map((id) => ({ id, q: R.rsQuote(rs, id, lv, true, bought) })).filter((x) => !x.q.err && pt[x.q.part] >= x.q.n).sort((a, b) => a.q.n - b.q.n || a.q.ms - b.q.ms)[0];
      if (!q) break;
      pt[q.q.part] -= q.q.n; rs.done[q.id] = d + 1; spend.finish += R.rsFinPrice(q.q.ms).stars; log.push([d, q.id, q.q.leg ? 'researched (free)' : 'researched']);
    }
    // then buy the Legendary set mods the rules allow today
    for (const t of R.RTREE.order) {
      const id = R.RTREE.legendary[t], set = R.RTREE.mods[t][3];
      if (rs.done[id] || bought[id] || !rs.done[set] || legThisWeek >= rules.legWeek) continue;
      bought[id] = d + 1; legThisWeek++; spend.legendary += rules.legStars; log.push([d, id, 'bought']);
    }
    if (tree === null && R.RTREE_ALL.every((id) => rs.done[id])) tree = d + 1;
    if (R.RTREE_LEG.every((id) => rs.done[id] || bought[id])) all = d + 1;
  }
  const stars = spend.packs + spend.legendary + spend.finish;
  return { startWeekday, treeDay: tree, allDay: all, bought: Object.keys(bought).length, researchedLeg: R.RTREE_LEG.filter((id) => rs.done[id]).length, spend: { ...spend, stars, usd: Math.round(stars / R.RS_STARS_USD * 100) / 100 }, log };
}
export function report() {
  const out = { label: 'SIMULATED (the game\'s research rules with a scripted buy-everything pilot), not playtesting', labDays: { I: LAB_I, III: LAB_III } };
  for (const [k, rules] of Object.entries(RULESETS)) {
    const runs = [0, 1, 2, 3, 4, 5, 6].map((w) => pace(rules, w)), all = runs.map((r) => r.allDay).sort((a, b) => a - b), tree = runs.map((r) => r.treeDay).sort((a, b) => a - b);
    out[k] = { label: rules.label, treeDays: { min: tree[0], median: tree[3], max: tree[6] }, allFourDays: { min: all[0], median: all[3], max: all[6] },
      bought: runs.map((r) => r.bought), researchedFree: runs.map((r) => r.researchedLeg), stars: { min: Math.min(...runs.map((r) => r.spend.stars)), max: Math.max(...runs.map((r) => r.spend.stars)) }, runs: runs.map(({ log, ...r }) => r) };
  }
  return out;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const r = report();
  for (const k of Object.keys(RULESETS)) { const x = r[k]; console.log(k + ': ' + x.label + ': the earned tree on day ' + x.treeDays.median + ' (' + x.treeDays.min + '-' + x.treeDays.max + '), all four Legendary set mods on day ' + x.allFourDays.median + ' (' + x.allFourDays.min + '-' + x.allFourDays.max + ' by weekday), bought ' + x.bought.join('/') + ', researched free ' + x.researchedFree.join('/') + ', ' + x.stars.min + '-' + x.stars.max + ' Stars'); }
  const o = process.argv.indexOf('--json'); if (o > 0) writeFileSync(process.argv[o + 1], JSON.stringify(r, null, 1) + '\n');
}
