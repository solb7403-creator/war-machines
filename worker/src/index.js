// LUNAR: War Machines — game server (Cloudflare Worker)
// Every write to the database goes through here, tied to a verified Telegram login.
// Secrets (set by the GitHub Action): BOT_TOKEN, FIREBASE_DB_SECRET
import { DAY_MS, dayOf, weekOf, hex, hmac, dbGet, dbPut, dbPatch, dbDel, cleanName } from "./db.js";
import { PvpRoom, PvpLobby, pvpJoin, pvpSocket, pvpHealth } from "./pvp.js";
import { RULES } from "./sim.gen.js";
import { tx, pub, readEco, setLoadout, migrate, paidRecords, act, matchStart, matchEnd, claimOnce, addFlags, isFlagged, flagReasons, ctxOf, squadRows, channelReady } from "./eco.js";
export { PvpRoom, PvpLobby };
const GAME_ORIGINS = ["https://solb7403-creator.github.io"];
const GAME_URL = "https://solb7403-creator.github.io/war-machines/";
const WIKI_URL = "https://solb7403-creator.github.io/war-machines/wiki.html";
const CHANNEL_URL = RULES.TG_URL || "https://t.me/LUNARmemecoin";
const ADMINS = ["lunarbattle"]; // Telegram usernames allowed to see the admin stats (lowercase)

// ---- prices: one table, js/rules.js (RPRICE, RSTARS, PREMIUM, PASS_PRICE, PAINTS); the server charges those ----
const PAINT_NAMES = { nebula: "Nebula", ember: "Ember", arctic: "Arctic", venom: "Venom", gold: "Gold Plate", void: "Void" };
const TERMS_URL = "https://solb7403-creator.github.io/war-machines/terms.html";
const SUPPORT_TEXT = "Need help with a purchase?\n\nMessage @LunarBattle with your Player ID (in the game: Settings, top right) and roughly when you bought. We reply within 48 hours.\n\nTelegram support can't help with purchases made in this bot. Terms: " + TERMS_URL;

// ---- TON / SOL verification ----
const TON_RECIPIENT = "UQAq3MBfPQ7Wqo5kL7631yEDKf2E9GOmZdhOfLUWhUiACfzu";
const SOL_RECIPIENT = "A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE";
const SOL_RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];

// webhook secret derived from the bot token, so it never needs storing separately
export async function webhookSecret(env) { return hex(await hmac(env.BOT_TOKEN, "lunar-webhook")).slice(0, 48); }

function cors(res, req) {
  const o = req && req.headers.get("Origin");
  res.headers.set("Access-Control-Allow-Origin", o && GAME_ORIGINS.includes(o) ? o : GAME_ORIGINS[0]);
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Vary", "Origin");
  return res;
}
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(env, initData, maxAgeSec = 172800) {
  if (!initData) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get("hash");
  if (!hash) return null;
  p.delete("hash");
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = await hmac("WebAppData", env.BOT_TOKEN);
  if (hex(await hmac(secret, dcs)) !== hash) return null;
  const authDate = Number(p.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try { return JSON.parse(p.get("user") || "null"); } catch { return null; }
}
const num = (v, lo, hi, d = 0) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const safeKey = (s) => String(s).replace(/[.#$\[\]\/|]/g, "_").slice(0, 100);
async function readBody(req) { try { return await req.json(); } catch { return null; } }
async function auth(req, env) {
  const b = await readBody(req);
  if (!b) return { err: json({ error: "bad json" }, 400) };
  const user = await verifyInitData(env, String(b.initData || ""));
  if (!user || !user.id) return { err: json({ error: "not verified" }, 401) };
  return { b, user, pid: "tg_" + user.id, ip: req.headers.get("CF-Connecting-IP") || "" };
}

function itemLabel(k, tk, ri) {
  if (k === "box") return ["Common", "Rare", "Epic"][ri ?? 0] + " " + (tk === "weapon" ? "Weapon Cache" : tk === "chassis" ? "Chassis Crate" : "Gem Cache");
  if (k === "paint") return "Paint: " + (PAINT_NAMES[tk] || "Paint");
  if (k === "pass") return "Lunar Pass" + (tk ? ", season " + tk : "");
  return k === "moonbeam" ? "Moonbeam" : k === "skin" ? "Lunar Skin" : k === "starter" ? "Starter Pack" : k === "founder" ? "Founder Pack" : k === "respec" ? "Build reset (keep all points)" : "Purchase";
}

// ================= /api/sync =================
// No points come in here any more: every point comes from a named source the server checks (a scored match, a claim).
// Sync sets the name, the referrer (once), the loadout the pilot fields (power and league from what they own), the
// one-time move of an existing pilot's progress from their phone, and returns the server's record.
export async function sync(env, b, user, pid, now = Date.now(), ip = "") {
  const name = cleanName(user), d = dayOf(now);
  const rec = (await dbGet(env, `players/${pid}`).catch(() => null)) || null;
  const paid = b.mig && typeof b.mig === "object" ? await paidRecords(env, pid) : null;
  let why = null;
  const t = await tx(env, pid, (S, X) => {
    S.nm = name;
    why = null;
    if (S.mig === 0 && paid) why = migrate(S, b.mig, paid, X);
    setLoadout(S, b.L || S.L);
    return {};
  }, now);
  const S = t.S, up = {};
  // referrer: only for a brand-new pilot (first day), never yourself, never changed later
  const rb = String(b.refBy || "");
  let ref = rec && rec.ref;
  if (!ref && /^tg_\d{3,15}$/.test(rb) && rb !== pid && (S.days || 0) <= 1) { ref = rb; up[`players/${pid}/ref`] = rb; }
  if (rec && rec.bracket !== undefined) up[`players/${pid}/bracket`] = null;
  // Stars receipts the game confirmed it delivered
  const acks = Array.isArray(b.starsAck) ? b.starsAck.slice(0, 20) : [];
  for (const n of acks) if (/^[a-z0-9]{4,12}$/.test(String(n))) up[`starsAck/${pid}/${n}`] = now;
  // alts: a hashed network address per pilot. A recruit who shares one with their referrer flags both (squad payouts held)
  const flags = [];
  if (ip) {
    const h = hex(await hmac(env.BOT_TOKEN, "ip|" + ip)).slice(0, 16);
    up[`iph/${pid}/${h}`] = d;
    if (ref) { const theirs = await dbGet(env, `iph/${ref}`).catch(() => null); if (theirs && theirs[h]) { flags.push([ref, [["alt", "shares a network with recruit " + pid]]]); flags.push([pid, [["alt", "shares a network with referrer " + ref]]]); } }
  }
  if (why && Object.keys(why).length) flags.push([pid, Object.entries(why).map(([k, v]) => ["mig_" + k, v])]);
  if (Object.keys(up).length) await dbPatch(env, "", up);
  for (const [id, list] of flags) await addFlags(env, id, id === pid ? name : null, list, now).catch(() => {});
  const out = { ok: true, now, migOk: S.mig === 1, E: pub(S), power: S.pw, league: S.lg,
    rec: { pts: S.earned, dailyPts: S.dailyPts, weeklyPts: S.weeklyPts, days: S.days || 0, sk: S.sk || 0, ld: S.ld ?? null, ref: ref || null, d, w: weekOf(now) } };
  // on launch the game asks for Stars purchases that were paid but never shown (app closed during checkout)
  if (b.boot) out.stars = await undeliveredStars(env, pid, now);
  // the ghost report: what your tank did in other pilots' matches while you were away. Cleared once the phone has shown it
  const gr = b.boot || b.ghAck ? await dbGet(env, `ghr/${pid}`).catch(() => null) : null;
  if (gr && b.ghAck && Number(b.ghAck) >= (gr.last || 0)) await dbDel(env, `ghr/${pid}`).catch(() => {});
  else if (gr && gr.m && b.boot) out.ghost = { m: gr.m || 0, w: gr.w || 0, d: gr.d || 0, l: gr.l || 0, dmg: gr.dmg || 0, kills: gr.kills || 0, last: gr.last || 0 };
  return out;
}
async function undeliveredStars(env, pid, now) {
  const [paid, acked] = await Promise.all([dbGet(env, `starsPaid/${pid}`).catch(() => null), dbGet(env, `starsAck/${pid}`).catch(() => null)]);
  const out = [];
  for (const [charge, p] of Object.entries(paid || {})) {
    if (!p || !p.n || (acked && acked[p.n])) continue;
    if (typeof p.ts === "number" && now - p.ts > 30 * DAY_MS) continue;
    if (p.rf) continue;
    out.push({ n: p.n, k: p.k || null, t: p.t || null, r: p.r ?? null, g: p.g || 0, x: p.x || null, stars: p.stars || 0, o: p.o || [] });
  }
  return out.slice(0, 10);
}

// ================= /api/squad =================
// recruits whose payouts are on hold (flagged for review) are marked, so the phone doesn't promise them
export async function squad(env, pid) {
  const [rows, fl] = await Promise.all([squadRows(env, pid), dbGet(env, "flags").catch(() => null)]);
  return rows.map((r) => (isFlagged(fl && fl[r.id]) ? { ...r, held: true } : r));
}

// ================= /api/pay-log =================
// TON and SOL purchases: the phone reports the order, the server finds the payment on-chain itself (TON: the order note
// and the amount; SOL: the signature and the amount), records each transaction once, checks the price against its own
// record, and only then grants the item. Nothing is granted on the phone's word.
async function verifyTon(memo, amt) {
  try {
    const r = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${TON_RECIPIENT}&limit=50`);
    const d = await r.json();
    for (const t of d.result || []) {
      const val = parseInt((t.in_msg || {}).value || "0", 10) / 1e9;
      if (memo && String((t.in_msg || {}).message || "") === memo && val + 1e-9 >= amt * 0.999) return (t.transaction_id && t.transaction_id.hash) || null;
    }
  } catch {}
  return null;
}
async function verifySol(sig, amt) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(String(sig || ""))) return false;
  for (const url of SOL_RPCS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }] }) });
      const d = await r.json();
      const tx = d.result;
      if (!tx || !tx.meta || tx.meta.err) continue;
      const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey || k), i = keys.indexOf(SOL_RECIPIENT);
      if (i < 0) return false;
      return (tx.meta.postBalances[i] - tx.meta.preBalances[i]) / 1e9 + 1e-9 >= amt * 0.999;
    } catch {}
  }
  return false;
}
// SOL is priced off the TON price at live rates; the server checks it's in the right range (skipped if prices are unavailable)
async function solValueOk(sol, ton) {
  try {
    const d = await (await fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana&vs_currencies=usd")).json();
    const t = d["the-open-network"].usd, s = d.solana.usd;
    if (t > 0 && s > 0) return sol * s >= ton * t * 0.85;
  } catch {}
  return true;
}
const descOf = (d) => {
  d = d && typeof d === "object" ? d : {};
  const kind = String(d.kind || "");
  if (kind === "box") return ["gem", "weapon", "chassis"].includes(d.tk) && [0, 1, 2].includes(Number(d.ri)) ? { kind, tk: d.tk, ri: Number(d.ri), deal: d.deal === "d" || d.deal === "w" ? d.deal : null } : null;
  if (kind === "paint") return RULES.PAINTS[d.id] && RULES.PAINTS[d.id].stars ? { kind, id: d.id } : null;
  return ["starter", "founder", "moonbeam", "skin", "pass", "respec"].includes(kind) ? { kind } : null;
};
async function payLog(env, b, user, pid, now = Date.now()) {
  const cur = b.cur === "SOL" ? "SOL" : b.cur === "TON" ? "TON" : null;
  if (!cur) return { error: "cur" };
  const memo = String(b.memo || "").slice(0, 64);
  if (!memo.startsWith("LWM|" + pid + "|")) return { error: "memo" };
  const amt = num(b.amt, 0, 100000), key = `payments/LWM_${safeKey(memo)}`;
  const have = await dbGet(env, key).catch(() => null);
  const desc = descOf(b.desc);
  if (have && (have.granted || !desc)) { const S = await readEco(env, pid); return { ok: true, dup: true, verified: have.verified === true, out: have.o || [], E: pub(S) }; }
  const rec = { pid, name: cleanName(user), cur, amt, gram: num(b.gram, 0, 100000), usd: num(b.usd, 0, 1e6), item: String(b.item || "").slice(0, 40), memo, proof: String(b.proof || "").slice(0, 120), t: { ".sv": "timestamp" } };
  if (!desc) {   // an old phone without the order details: logged and checked, not granted here
    rec.verified = cur === "TON" ? !!(await verifyTon(memo, amt)) : await verifySol(rec.proof, amt);
    await dbPut(env, key, rec);
    return { ok: true, verified: rec.verified };
  }
  const S0 = await readEco(env, pid), X0 = ctxOf(pid, now), price = RULES.ecoPrice(S0, desc, X0);
  if (!price) return { error: "item" };
  const need = cur === "TON" ? Math.max(amt, price.ton) : amt;
  if (cur === "TON" && amt + 1e-9 < price.ton * 0.999) return { error: "amount" };
  if (cur === "SOL" && (rec.gram + 1e-9 < price.ton * 0.999 || !(await solValueOk(amt, price.ton)))) return { error: "amount" };
  let txid = null;
  if (cur === "TON") txid = await verifyTon(memo, need);
  else if (await verifySol(rec.proof, amt)) txid = rec.proof;
  if (!txid) { if (!have) await dbPut(env, key, { ...rec, verified: false }); return { ok: true, verified: false, error: "pending" }; }
  // each on-chain transaction pays for one order
  const once = await claimOnce(env, `${cur === "TON" ? "tonTx" : "solTx"}/${safeKey(txid)}`, { pid, memo, t: now });
  if (!once.ok && !(once.v && once.v.memo === memo)) return { error: "reused" };
  const t = await tx(env, pid, (S, X) => {
    S.gout = S.gout || {};
    const gk = safeKey(memo);
    if (S.gout[gk]) return { outs: S.gout[gk], dup: true };
    const outs = RULES.ecoGrant(S, { ...desc, deal: price.deal, price: price.ton }, X);
    if (desc.kind === "respec" && S.L) setLoadout(S, S.L);   // the build changed: power and league follow
    S.gout[gk] = outs.length ? outs : [{ none: 1 }];
    const ks = Object.keys(S.gout); if (ks.length > 12) for (const k of ks.slice(0, ks.length - 12)) delete S.gout[k];
    return { outs };
  }, now);
  const outs = (t.outs || []).filter((o) => o && !o.none);
  await dbPut(env, key, { ...rec, verified: true, granted: true, tx: txid, o: outs });
  return { ok: true, verified: true, out: outs, E: pub(t.S) };
}

// ================= /api/stars-invoice =================
// the price comes from the server's own record: repeat-buy pricing, and a deal only if it's still unused this period
async function starsInvoice(env, b, user, pid, now = Date.now()) {
  const k = String(b.kind || ""), tk = String(b.tk || ""), ri = Number(b.ri ?? 0);
  if (k === "pass" && tk && !/^\d{1,3}$/.test(tk)) return { status: 400, body: { error: "item" } };
  const desc = descOf({ kind: k, tk, ri, id: tk, deal: b.deal });
  if (!desc) return { status: 400, body: { error: "item" } };
  if (k === "founder" && !RULES.FOUNDER_OPEN) return { status: 400, body: { error: "closed" } };   // sold only until $LUNAR launches
  const S = await readEco(env, pid), X = ctxOf(pid, now);
  if (RULES.ecoOwned(S, desc, X)) return { status: 409, body: { error: "owned" } };
  const pr = RULES.ecoPrice(S, desc, X);
  if (!pr) return { status: 400, body: { error: "item" } };
  if (desc.deal && pr.deal !== desc.deal) return { status: 409, body: { error: "deal_used" } };
  const nonce = Math.random().toString(36).slice(2, 10);
  const payload = JSON.stringify({ u: user.id, k, t: k === "paint" ? tk : k === "box" ? tk : k === "pass" ? String(RULES.ecoSeason(X)) : undefined, r: k === "box" ? ri : undefined, g: pr.ton, n: nonce, x: pr.deal || undefined });
  const label = itemLabel(k, k === "pass" ? String(RULES.ecoSeason(X)) : tk, ri);
  const r = await tg(env, "createInvoiceLink", { title: label, description: `LUNAR: War Machines · ${label}`, payload, currency: "XTR", prices: [{ label, amount: pr.stars }] });
  if (!r.ok) return { status: 502, body: { error: r.description || "telegram" } };
  return { status: 200, body: { link: r.result, stars: pr.stars, nonce } };
}

// ================= /api/notify-optin =================
async function notifyOptin(env, pid, user, on) {
  await dbPatch(env, `ntf/${pid}`, { on: on ? 1 : 0, last: dayOf(Date.now()) - 1, chat: user.id });
  return { ok: true };
}

// ================= /api/admin (Jake only) =================
async function admin(env, user, b = {}) {
  if (!ADMINS.includes(String(user.username || "").toLowerCase())) return { status: 403, body: { error: "not admin" } };
  // clear a flagged pilot (every current reason): they count for the snapshot again
  if (b.clear && /^tg_\d{3,15}$/.test(String(b.clear))) {
    const f = await dbGet(env, `flags/${b.clear}`).catch(() => null), up = {};
    for (const k of flagReasons(f)) up[`flags/${b.clear}/ok/${k}`] = Date.now();
    if (Object.keys(up).length) await dbPatch(env, "", up);
  }
  const today = dayOf(Date.now());
  const [n, top, dly, pays, stars] = await Promise.all([
    dbGet(env, "meta/n").catch(() => 0),
    dbGet(env, "players", { orderBy: '"pts"', limitToLast: 10 }).catch(() => ({})),
    dbGet(env, `dly/${today}`, { shallow: "true" }).catch(() => ({})),
    dbGet(env, "payments", { orderBy: '"$key"', limitToLast: 300 }).catch(() => ({})),
    dbGet(env, "starsPaid", { shallow: "true" }).catch(() => ({})),
  ]);
  const rev = { TON: 0, SOL: 0, STARS: 0, USD: 0, count: 0, unverified: 0 };
  const recent = [];
  for (const p of Object.values(pays || {})) {
    if (!p) continue;
    rev.count++;
    if (p.cur in rev) rev[p.cur] += Number(p.amt) || 0;
    rev.USD += Number(p.usd) || 0;
    if (p.verified === false) rev.unverified++;
    recent.push({ name: p.name, cur: p.cur, amt: p.amt, item: p.item, t: p.t, v: p.verified !== false });
  }
  recent.sort((a, b) => (b.t || 0) - (a.t || 0));
  // retention + conversion from up to 1,000 player records
  const allRec = (await dbGet(env, "players", { orderBy: '"pts"', limitToLast: 1000 }).catch(() => ({}))) || {}, all = Object.values(allRec);
  const payers = new Set(Object.values(pays || {}).filter(Boolean).map((p) => p.pid));
  const old1 = all.filter((p) => (p.fd ?? p.ld ?? today) <= today - 1), old7 = all.filter((p) => (p.fd ?? p.ld ?? today) <= today - 7);
  const stats = {
    newToday: all.filter((p) => p.fd === today).length,
    back2: old1.length ? Math.round((old1.filter((p) => (p.days || 0) >= 2).length / old1.length) * 100) : null,
    back5of7: old7.length ? Math.round((old7.filter((p) => (p.days || 0) >= 5).length / old7.length) * 100) : null,
    avgMatches: all.length ? Math.round(all.reduce((a, p) => a + (p.mp || 0), 0) / all.length) : 0,
    payers: payers.size, conv: all.length ? Math.round((payers.size / all.length) * 1000) / 10 : 0,
    arppu: payers.size ? Math.round(rev.USD / payers.size) : 0,
  };
  // flagged pilots (anomalies, the one-time move, shared networks): they sit out the snapshot until cleared
  const fl = (await dbGet(env, "flags").catch(() => null)) || {};
  const flagged = Object.entries(fl).filter(([, f]) => isFlagged(f)).map(([id, f]) => ({ id, n: f.n || id, why: flagReasons(f).map((k) => k + (f.r[k].v && f.r[k].v !== 1 ? ": " + f.r[k].v : "")) })).slice(0, 60);
  const body0 = { flagged, channel: await channelReady(env) };
  // the airdrop snapshot: the top 1,000 by lifetime points with days active, flagged pilots left out
  if (b.snap) body0.snapshot = await snapshot(env, fl);
  return { status: 200, body: { ok: true, ...body0, players: n || 0, activeToday: Object.keys(dly || {}).length, buyersStars: Object.keys(stars || {}).length, stats,
    revenue: { TON: +rev.TON.toFixed(3), SOL: +rev.SOL.toFixed(4), STARS: rev.STARS, USD: Math.round(rev.USD), count: rev.count, unverified: rev.unverified },
    recent: recent.slice(0, 15), top: Object.values(top || {}).sort((a, b) => (b.pts || 0) - (a.pts || 0)).map((p) => ({ name: p.name, pts: p.pts, days: p.days, power: p.power })) } };
}

export async function snapshot(env, fl) {
  fl = fl || (await dbGet(env, "flags").catch(() => null)) || {};
  const top = (await dbGet(env, "players", { orderBy: '"pts"', limitToLast: 2000 }).catch(() => ({}))) || {};
  return Object.entries(top).filter(([id, v]) => v && v.pts > 0 && !isFlagged(fl[id])).map(([id, v]) => [id, v.name || "Pilot", v.pts || 0, v.days || 0]).sort((a, b) => b[2] - a[2]).slice(0, 1000);
}

// ================= leaderboard (cron, every 5 minutes) =================
// Phones download one small file instead of every player's record.
export async function buildLeaderboard(env, now = Date.now()) {
  const d = dayOf(now), w = weekOf(now);
  const [top, daily, weekly, n, fl] = await Promise.all([
    dbGet(env, "players", { orderBy: '"pts"', limitToLast: 1100 }).catch(() => ({})),
    dbGet(env, `dly/${d}`, { orderBy: '"s"', limitToLast: 100 }).catch(() => ({})),
    dbGet(env, `wly/${w}`, { orderBy: '"s"', limitToLast: 100 }).catch(() => ({})),
    dbGet(env, "meta/n").catch(() => 0),
    dbGet(env, "flags").catch(() => null),
  ]);
  // pilots flagged for review sit out the board (and the snapshot) until Jake clears them
  const ok = ([id]) => !isFlagged(fl && fl[id]);
  const all = Object.entries(top || {}).filter(ok).map(([id, v]) => [id, v.name || "Pilot", v.pts || 0, v.days || 0, v.league || ""]).sort((a, b) => b[2] - a[2]);
  const lb = {
    t: now, d, w, n: Math.max(Number(n) || 0, all.length),
    cut: all.length >= 1000 ? all[999][2] : 0,
    top: all.slice(0, 1000),
    daily: Object.entries(daily || {}).filter(ok).map(([id, v]) => [id, v.n || "Pilot", v.s || 0]).sort((a, b) => b[2] - a[2]).slice(0, 100),
    weekly: Object.entries(weekly || {}).filter(ok).map(([id, v]) => [id, v.n || "Pilot", v.s || 0]).sort((a, b) => b[2] - a[2]).slice(0, 100),
  };
  await dbPut(env, "lb", lb);
  // housekeeping once an hour: drop daily/weekly score tables older than a few days/weeks
  if (new Date(now).getUTCMinutes() < 5) { await dbDel(env, `dly/${d - 3}`); await dbDel(env, `wly/${w - 3}`); }
  return lb;
}

// ================= daily reminders (cron) =================
const NOTIFY_HOURS = [15, 16, 17, 18]; // UTC: ~10am-1pm US Central
export async function sendReminders(env, now = Date.now()) {
  if (!NOTIFY_HOURS.includes(new Date(now).getUTCHours())) return 0;
  const d = dayOf(now);
  const due = (await dbGet(env, "ntf", { orderBy: '"last"', endAt: d - 1, limitToFirst: 20 }).catch(() => null)) || {};
  let sent = 0;
  for (const [pid, v] of Object.entries(due)) {
    if (!v || !v.on || !v.chat) { await dbPatch(env, `ntf/${pid}`, { last: d }); continue; }
    const p = await dbGet(env, `players/${pid}`).catch(() => null);
    if (p && p.ld === d) { await dbPatch(env, `ntf/${pid}`, { last: d }); continue; } // already played today
    const streak = p && p.ld === d - 1 ? p.sk || 0 : 0;
    const text = streak >= 2
      ? `☾ Your ${streak}-day streak ends at midnight UTC. Keep it going: every streak day adds +5% to your quest points, up to +30%.`
      : "☾ Your daily reward and 4 new quests are ready, pilot. The top 1,000 on the leaderboard get $LUNAR.";
    const r = await tg(env, "sendMessage", { chat_id: v.chat, text, reply_markup: { inline_keyboard: [[{ text: "⚔ PLAY", web_app: { url: GAME_URL } }]] } }).catch(() => null);
    // blocked or deleted chats switch reminders off
    await dbPatch(env, `ntf/${pid}`, r && r.ok ? { last: d } : { last: d, on: 0 });
    if (r && r.ok) sent++;
  }
  return sent;
}

// ================= Telegram webhook =================
async function webhook(req, env) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== (await webhookSecret(env))) return new Response("forbidden", { status: 403 });
  let u;
  try { u = await req.json(); } catch { return new Response("ok"); }
  if (u.pre_checkout_query) {
    const q = u.pre_checkout_query;
    let ok = q.currency === "XTR";
    try { ok = ok && JSON.parse(q.invoice_payload).u === q.from.id; } catch { ok = false; }
    await tg(env, "answerPreCheckoutQuery", ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: "This purchase couldn't be verified. Please try again from the game." });
    return new Response("ok");
  }
  const m = u.message;
  if (m && m.successful_payment) {
    // Telegram confirmed a Stars payment: the server grants the item now (the phone just shows it)
    const sp = m.successful_payment;
    let p = {};
    try { p = JSON.parse(sp.invoice_payload); } catch {}
    const pid = "tg_" + m.from.id, now = Date.now();
    const charge = safeKey(sp.telegram_payment_charge_id);
    const item = itemLabel(p.k, p.t, p.r);
    const desc = descOf({ kind: p.k, tk: p.t, ri: p.r, id: p.t, deal: p.x });
    const t = desc ? await tx(env, pid, (S, X) => {
      S.gout = S.gout || {};
      if (S.gout[charge]) return { outs: S.gout[charge] };   // Telegram sent this one twice
      const outs = RULES.ecoGrant(S, { ...desc, price: p.g }, X);
      if (desc.kind === "respec" && S.L) setLoadout(S, S.L);
      S.gout[charge] = outs.length ? outs : [{ none: 1 }];
      const ks = Object.keys(S.gout); if (ks.length > 12) for (const k of ks.slice(0, ks.length - 12)) delete S.gout[k];
      return { outs };
    }, now) : { outs: [] };
    const outs = (t.outs || []).filter((o) => o && !o.none);
    await dbPut(env, `payments/LWM_${pid}_stars_${charge}`.slice(0, 120), { pid, name: cleanName(m.from), cur: "STARS", amt: sp.total_amount, gram: p.g || 0, usd: Math.round(sp.total_amount * 1.3) / 100, item, memo: "STARS|" + (p.n || ""), proof: charge, verified: true, t: { ".sv": "timestamp" } });
    await dbPut(env, `starsPaid/${pid}/${charge}`, { k: p.k || null, t: p.t || null, r: p.r ?? null, g: p.g || 0, x: p.x || null, stars: sp.total_amount, n: p.n || "", o: outs, ts: { ".sv": "timestamp" } });
    return new Response("ok");
  }
  if (m && m.refunded_payment) {
    // a Stars refund: the server takes back exactly what that purchase gave
    const rp = m.refunded_payment, pid = "tg_" + m.from.id, charge = safeKey(rp.telegram_payment_charge_id), now = Date.now();
    const sp = await dbGet(env, `starsPaid/${pid}/${charge}`).catch(() => null);
    if (sp && !sp.rf) {
      let n = 0;
      const t = await tx(env, pid, (S) => {
        S.rfd = S.rfd || [];
        if (S.rfd.includes(charge)) return { abort: true };
        S.rfd = S.rfd.concat(charge).slice(-40);
        RULES.ecoRefund(S, sp.k, sp.o || []);
        n = S.rfd.length;
        return {};
      }, now);
      const pk = `payments/LWM_${pid}_stars_${charge}`.slice(0, 120);
      await dbPatch(env, "", { [`starsPaid/${pid}/${charge}/rf`]: now, [`${pk}/refunded`]: true, [`${pk}/verified`]: false });
      if (n >= 2) await addFlags(env, pid, t.S && t.S.nm, [["refunds", n + " Stars refunds"]], now).catch(() => {});
    }
    return new Response("ok");
  }
  if (m && m.text && /^\/start/.test(m.text)) {
    // anyone who starts the bot can get the daily reminder (they can /stop it)
    if (m.chat && m.chat.type === "private") await dbPatch(env, `ntf/tg_${m.from.id}`, { on: 1, chat: m.chat.id, last: dayOf(Date.now()) - 1 }).catch(() => {});
    await tg(env, "sendMessage", {
      chat_id: m.chat.id,
      text: "☾ LUNAR: War Machines\n\nFast robot-tank battles right here in Telegram. Win matches, climb the leaderboard, and build your squad. The top 1,000 pilots get a guaranteed $LUNAR allocation.",
      reply_markup: { inline_keyboard: [[{ text: "⚔ PLAY", web_app: { url: GAME_URL } }], [{ text: "📣 Channel", url: CHANNEL_URL }, { text: "📖 Wiki", url: WIKI_URL }]] },
    });
  } else if (m && m.text && /^\/(paysupport|support)/.test(m.text)) {
    await tg(env, "sendMessage", { chat_id: m.chat.id, text: SUPPORT_TEXT });
  } else if (m && m.text && /^\/terms/.test(m.text)) {
    await tg(env, "sendMessage", { chat_id: m.chat.id, text: "Terms of service and purchase: " + TERMS_URL, reply_markup: { inline_keyboard: [[{ text: "📄 Read the terms", url: TERMS_URL }]] } });
  } else if (m && m.text && /^\/stop/.test(m.text)) {
    await dbPatch(env, `ntf/tg_${m.from.id}`, { on: 0 }).catch(() => {});
    await tg(env, "sendMessage", { chat_id: m.chat.id, text: "Daily reminders are off. Send /start to turn them back on." });
  }
  return new Response("ok");
}

// ================= router =================
const ROUTES = {
  "/api/sync": async (env, a) => ({ status: 200, body: await sync(env, a.b, a.user, a.pid, Date.now(), a.ip) }),
  "/api/act": async (env, a) => act(env, a.b, a.user, a.pid),
  "/api/match/start": async (env, a) => matchStart(env, a.b, a.user, a.pid),
  "/api/match/end": async (env, a) => matchEnd(env, a.b, a.user, a.pid),
  "/api/squad": async (env, a) => ({ status: 200, body: { ok: true, squad: await squad(env, a.pid) } }),
  "/api/pay-log": async (env, a) => ({ status: 200, body: await payLog(env, a.b, a.user, a.pid) }),
  "/api/stars-invoice": async (env, a) => starsInvoice(env, a.b, a.user, a.pid),
  "/api/notify-optin": async (env, a) => ({ status: 200, body: await notifyOptin(env, a.pid, a.user, a.b.on !== false) }),
  "/api/admin": async (env, a) => admin(env, a.user, a.b),
  "/api/pvp/join": async (env, a) => pvpJoin(env, a),
};

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (ROUTES[path]) {
      if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }), req);
      if (req.method !== "POST") return cors(new Response("method", { status: 405 }), req);
      const a = await auth(req, env);
      if (a.err) return cors(a.err, req);
      try {
        const r = await ROUTES[path](env, a);
        return cors(json(r.body, r.status), req);
      } catch (e) {
        return cors(json({ error: "server", detail: String(e && e.message || e).slice(0, 200) }, 500), req);
      }
    }
    if (path === "/api/tg-webhook" && req.method === "POST") return webhook(req, env);
    if (path === "/pvp/ws") return pvpSocket(req, env);   // live matches (WebSocket into the match room)
    if (path === "/pvp/health") return cors(await pvpHealth(env).catch((e) => json({ ok: false, error: String(e && e.message || e).slice(0, 200) }, 500)), req);
    if (path === "/") return new Response("LUNAR: War Machines API");
    return new Response("not found", { status: 404 });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await buildLeaderboard(env).catch((e) => console.log("lb", e && e.message));
      await sendReminders(env).catch((e) => console.log("ntf", e && e.message));
    })());
  },
};
