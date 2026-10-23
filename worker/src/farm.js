// Farm defense: accounts that belong to one person, found from what they share, grouped into clusters.
// Links (lk/<a>/<b> = why), written as they're found:
//   device    the same phone (a random id kept on the device, shared by every Telegram account on it)   (sync)
//   wallet    paid from the same TON or SOL wallet                                                     (pay-log)
//   replay    the exact same controls, move for move, in a match on each account                        (match/end)
//   trade     8+ live matches against each other in one day                                              (live rooms)
//   together  start playing in the same minute on the same network, 6+ times over 3+ days               (here)
// Every 5 minutes the clusters are rebuilt. In each cluster only the account with the most points counts for the
// airdrop; the others get a "cluster" flag (off the public board and the snapshot) until Jake clears the cluster.
import { dbGet, dbPatch, dbDel } from "./db.js";
import { link } from "./eco.js";

export const FARM = { TOGETHER: 6, TOGETHER_DAYS: 3, NET_MAX: 12, PAIR_READS: 8, CATCHUP_MIN: 240, STEP_MIN: 60 };
const weekOfDay = (d) => Math.floor((d - 4) / 7);   // the same week numbers as db.js weekOf (Monday start)
const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };

// who started a session in the same minute on the same network (ss/<day>/<minute>/<pid> = network.device.id)
export async function processStarts(env, now = Date.now()) {
  const cur = Math.floor(now / 60000) - 2;   // minutes that are complete
  let from = Number(await dbGet(env, "meta/ssc").catch(() => 0)) || 0;
  if (!from || cur - from > FARM.CATCHUP_MIN) from = cur - 10;
  if (cur <= from) return 0;
  const to = Math.min(cur, from + FARM.STEP_MIN), byDay = {};
  for (let a = from + 1; a <= to; a++) (byDay[Math.floor(a / 1440)] = byDay[Math.floor(a / 1440)] || []).push(a % 1440);
  const pairs = new Map();
  for (const [d, mins] of Object.entries(byDay)) {
    const pad = (n) => String(n).padStart(4, "0");
    const rows = (await dbGet(env, `ss/${d}`, { orderBy: '"$key"', startAt: `"${pad(Math.min(...mins))}"`, endAt: `"${pad(Math.max(...mins))}"` }).catch(() => null)) || {};
    for (const ent of Object.values(rows)) {
      const net = {};
      for (const [pid, v] of Object.entries(ent || {}).slice(0, 300)) { const ip = String(v).split(".")[0]; if (ip) (net[ip] = net[ip] || []).push(pid); }
      for (const g of Object.values(net)) {
        if (g.length < 2 || g.length > FARM.NET_MAX) continue;   // a big shared network (a carrier, an office) says nothing
        for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) pairs.set([g[i], g[j]].sort().join("__"), Number(d));
      }
    }
  }
  const up = { "meta/ssc": to };
  for (const [k, d] of pairs) up[`co/${weekOfDay(d)}/${k}/${d}`] = { ".sv": { increment: 1 } };   // by week: this week and last are read, older weeks dropped
  await dbPatch(env, "", up);
  let n = 0;
  for (const k of [...pairs.keys()].slice(0, FARM.PAIR_READS)) {
    const dd = pairs.get(k), wk = weekOfDay(dd), [c1, c0] = await Promise.all([dbGet(env, `co/${wk}/${k}`).catch(() => null), dbGet(env, `co/${wk - 1}/${k}`).catch(() => null)]);
    const c = Object.assign({}, c0 || {}, c1 || {});
    const days = Object.keys(c).length, tot = Object.values(c).reduce((a, b) => a + (Number(b) || 0), 0);
    if (tot >= FARM.TOGETHER && days >= FARM.TOGETHER_DAYS) { const [a, b] = k.split("__"); await link(env, a, b, "together"); n++; }
  }
  // housekeeping once an hour: session starts older than two days
  if (new Date(now).getUTCMinutes() < 5) {
    await dbDel(env, `ss/${Math.floor(now / 86400000) - 3}`).catch(() => {});
    const wk = weekOfDay(Math.floor(now / 86400000));
    await dbDel(env, `co/${wk - 2}`).catch(() => {}); await dbDel(env, `ih/${wk - 2}`).catch(() => {});   // fingerprints and co-starts older than last week
  }
  return n;
}

// clusters from the links. names: {pid: [name, points]} for the pilots on the board (all of them, flagged or not)
export async function buildClusters(env, names, fl, now = Date.now()) {
  const lk = (await dbGet(env, "lk").catch(() => null)) || {};
  if (!Object.keys(lk).length) return [];
  const par = {};
  const find = (x) => { if (par[x] === undefined) par[x] = x; while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (const [a, bs] of Object.entries(lk)) for (const b of Object.keys(bs || {})) { const ra = find(a), rb = find(b); if (ra !== rb) par[ra] = rb; }
  const groups = {};
  for (const x of Object.keys(par)) (groups[find(x)] = groups[find(x)] || []).push(x);
  const ok = (await dbGet(env, "lkok").catch(() => null)) || {};
  const nm = (id) => (names[id] ? names[id][0] : (fl[id] && fl[id].n) || id), pts = (id) => (names[id] ? names[id][1] : 0);
  const clu = [], up = {};
  for (const m of Object.values(groups)) {
    if (m.length < 2) continue;
    m.sort();
    const sig = fnv(m.join(",")), why = [...new Set(m.flatMap((a) => Object.values(lk[a] || {})))].sort();
    const keep = m.slice().sort((a, b) => pts(b) - pts(a) || (a < b ? -1 : 1))[0];
    clu.push({ sig, keep, why, ok: !!ok[sig], m: m.map((id) => [id, nm(id), pts(id)]) });
    if (ok[sig]) continue;   // Jake cleared this cluster: every account counts
    const text = "one of " + m.length + " linked accounts (" + why.join(", ") + "), only " + nm(keep) + " counts";
    for (const id of m) {
      const cur = fl[id] && fl[id].r && fl[id].r.cluster;
      if (id === keep) { if (cur && !(fl[id].ok && fl[id].ok.cluster >= (cur.t || 0))) up[`flags/${id}/ok/cluster`] = now; continue; }
      if (!cur || cur.v !== text) { up[`flags/${id}/r/cluster`] = { t: now, v: text }; up[`flags/${id}/n`] = nm(id); }
    }
  }
  clu.sort((a, b) => b.m.length - a.m.length || b.m[0][2] - a.m[0][2]);
  up.clu = clu.slice(0, 60);
  await dbPatch(env, "", up);
  return clu;
}
// Jake clears a cluster: all its accounts count again (until a new account joins it)
export async function clearCluster(env, sig, now = Date.now()) {
  const clu = (await dbGet(env, "clu").catch(() => null)) || [];
  const c = (Array.isArray(clu) ? clu : Object.values(clu)).find((x) => x && x.sig === sig);
  if (!c) return false;
  const up = { [`lkok/${sig}`]: now };
  for (const [id] of c.m) up[`flags/${id}/ok/cluster`] = now;
  await dbPatch(env, "", up);
  return true;
}
