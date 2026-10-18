// LUNAR: War Machines — game server (Cloudflare Worker)
// Every write to the database goes through here, tied to a verified Telegram login.
// Secrets (set by the GitHub Action): BOT_TOKEN, FIREBASE_DB_SECRET
const GAME_ORIGINS = ["https://solb7403-creator.github.io"];
const GAME_URL = "https://solb7403-creator.github.io/war-machines/";
const WIKI_URL = "https://solb7403-creator.github.io/war-machines/wiki.html";
const DB_URL = "https://warmachines-a6034-default-rtdb.firebaseio.com";
const ADMINS = ["lunarbattle"]; // Telegram usernames allowed to see the admin stats (lowercase)

// ---- prices (must match the game) ----
const BOX_TON = [4, 8, 23];
const BOX_STARS = [250, 500, 1500];
const PREMIUM_TON = { moonbeam: 50, skin: 30, starter: 6, pass: 8 };
const PREMIUM_STARS = { moonbeam: 3300, skin: 2000, starter: 399, pass: 499 };
// paints are looks only (no stats)
const PAINT_TON = { nebula: 2.4, ember: 2.4, arctic: 2.4, venom: 2.4, gold: 4.8, void: 4.8 };
const PAINT_STARS = { nebula: 150, ember: 150, arctic: 150, venom: 150, gold: 300, void: 300 };
const PAINT_NAMES = { nebula: "Nebula", ember: "Ember", arctic: "Arctic", venom: "Venom", gold: "Gold Plate", void: "Void" };
const TERMS_URL = "https://solb7403-creator.github.io/war-machines/terms.html";
const SUPPORT_TEXT = "Need help with a purchase?\n\nMessage @LunarBattle with your Player ID (in the game: Settings, top right) and roughly when you bought. We reply within 48 hours.\n\nTelegram support can't help with purchases made in this bot. Terms: " + TERMS_URL;

// ---- points rules (the server is the referee) ----
const DAILY_CAP = 20000;          // max points a player can bank per UTC day
const BUCKET_MAX = 12000;         // short-term burst allowance (big claims like squad milestones)
const BUCKET_RATE = 25;           // allowance refill per second
const DAY_MS = 86400000;
const dayOf = (ms) => Math.floor(ms / DAY_MS);
const weekOf = (ms) => Math.floor((ms - 4 * DAY_MS) / (7 * DAY_MS)); // weeks start Monday 00:00 UTC

// ---- TON / SOL verification ----
const TON_RECIPIENT = "UQAq3MBfPQ7Wqo5kL7631yEDKf2E9GOmZdhOfLUWhUiACfzu";
const SOL_RECIPIENT = "A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE";
const SOL_RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}
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
// ---- Firebase Realtime Database over REST, with the database secret (bypasses the locked rules) ----
function dbUrl(env, path, q) {
  const qs = Object.entries(q || {}).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `${DB_URL}/${path}.json?auth=${env.FIREBASE_DB_SECRET}${qs ? "&" + qs : ""}`;
}
async function dbGet(env, path, q) {
  const r = await fetch(dbUrl(env, path, q));
  if (!r.ok) throw new Error("db get " + path + " " + r.status);
  return r.json();
}
async function dbPut(env, path, value) {
  const r = await fetch(dbUrl(env, path), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  return r.ok;
}
async function dbPatch(env, path, value) {
  const r = await fetch(dbUrl(env, path), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  return r.ok;
}
async function dbDel(env, path) {
  const r = await fetch(dbUrl(env, path), { method: "DELETE" });
  return r.ok;
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
const cleanName = (u) => {
  let n = String((u && (u.username || [u.first_name, u.last_name].filter(Boolean).join(" "))) || "").trim();
  n = n.replace(/[^\w .\-]/g, "").slice(0, 16);
  return n || "Pilot-" + String((u && u.id) || "").slice(-4);
};
const num = (v, lo, hi, d = 0) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const safeKey = (s) => String(s).replace(/[.#$\[\]\/|]/g, "_").slice(0, 100);
async function readBody(req) { try { return await req.json(); } catch { return null; } }
async function auth(req, env) {
  const b = await readBody(req);
  if (!b) return { err: json({ error: "bad json" }, 400) };
  const user = await verifyInitData(env, String(b.initData || ""));
  if (!user || !user.id) return { err: json({ error: "not verified" }, 401) };
  return { b, user, pid: "tg_" + user.id };
}

function itemLabel(k, tk, ri) {
  if (k === "box") return ["Common", "Rare", "Epic"][ri ?? 0] + " " + (tk === "weapon" ? "Weapon Cache" : tk === "chassis" ? "Chassis Crate" : "Gem Cache");
  if (k === "paint") return "Paint: " + (PAINT_NAMES[tk] || "Paint");
  if (k === "pass") return "Lunar Pass" + (tk ? ", season " + tk : "");
  return k === "moonbeam" ? "Moonbeam" : k === "skin" ? "Lunar Skin" : k === "starter" ? "Starter Pack" : "Purchase";
}

// ================= /api/sync =================
// The game sends its lifetime points total; the server credits the difference within the rules
// (daily cap, burst allowance), counts active days, sets the referrer once, and returns the official record.
export async function sync(env, b, user, pid, now = Date.now()) {
  const rec = (await dbGet(env, `players/${pid}`)) || null;
  const d = dayOf(now), w = weekOf(now);
  const r = rec ? { ...rec } : { pts: 0, dailyPts: 0, weeklyPts: 0, d, w, days: 0, sk: 0, t: now, al: BUCKET_MAX, fd: d };
  const isNew = !rec;
  if (r.d !== d) { r.d = d; r.dailyPts = 0; }
  if (r.w !== w) { r.w = w; r.weeklyPts = 0; }
  // burst allowance refills over time
  const elapsed = Math.max(0, (now - (Number(r.t) || now)) / 1000);
  let al = Math.min(BUCKET_MAX, (Number.isFinite(r.al) ? r.al : BUCKET_MAX) + elapsed * BUCKET_RATE);
  const want = Math.max(0, Math.floor(num(b.earned, 0, 1e9)) - (r.pts || 0));
  const credit = Math.max(0, Math.min(want, Math.floor(al), DAILY_CAP - (r.dailyPts || 0)));
  al -= credit;
  r.pts = (r.pts || 0) + credit;
  r.dailyPts = (r.dailyPts || 0) + credit;
  r.weeklyPts = (r.weeklyPts || 0) + credit;
  // a day counts as active once the player banks points that day
  let newDay = false;
  if (credit > 0 && r.ld !== d) {
    r.sk = r.ld === d - 1 ? (r.sk || 0) + 1 : 1;
    r.days = (r.days || 0) + 1;
    r.ld = d;
    newDay = true;
  }
  // referrer: only for a brand-new pilot (first day), never yourself, never changed later
  const rb = String(b.refBy || "");
  if (!r.ref && /^tg_\d{3,15}$/.test(rb) && rb !== pid && (r.days || 0) <= 1) r.ref = rb;
  r.name = cleanName(user);
  r.power = num(b.power, 0, 100000, r.power || 0);
  r.league = String(b.league || r.league || "ROOKIE").slice(0, 10);
  r.wins = num(b.wins, 0, 1e7, r.wins || 0);
  r.losses = num(b.losses, 0, 1e7, r.losses || 0);
  r.mp = num(b.mp, 0, 1e7, r.mp || 0);
  r.t = now; r.al = Math.round(al); r.seen = now;
  delete r.bracket; delete r.tier; delete r.lastSeen;
  const up = { [`players/${pid}`]: r };
  if (credit > 0 || isNew) {
    up[`dly/${d}/${pid}`] = { s: r.dailyPts, n: r.name };
    up[`wly/${w}/${pid}`] = { s: r.weeklyPts, n: r.name };
  }
  if (isNew) up["meta/n"] = { ".sv": { increment: 1 } };
  // Stars receipts the game confirmed it delivered
  const acks = Array.isArray(b.starsAck) ? b.starsAck.slice(0, 20) : [];
  for (const n of acks) if (/^[a-z0-9]{4,12}$/.test(String(n))) up[`starsAck/${pid}/${n}`] = now;
  await dbPatch(env, "", up);
  const out = { ok: true, now, credited: credit, capped: want > credit && r.dailyPts >= DAILY_CAP, newDay,
    rec: { pts: r.pts, dailyPts: r.dailyPts, weeklyPts: r.weeklyPts, days: r.days || 0, sk: r.sk || 0, ld: r.ld ?? null, ref: r.ref || null, d, w } };
  // on launch the game asks for Stars purchases that were paid but never delivered (app closed during checkout)
  if (b.boot) out.stars = await undeliveredStars(env, pid, now);
  return out;
}
async function undeliveredStars(env, pid, now) {
  const [paid, acked] = await Promise.all([dbGet(env, `starsPaid/${pid}`).catch(() => null), dbGet(env, `starsAck/${pid}`).catch(() => null)]);
  const out = [];
  for (const [charge, p] of Object.entries(paid || {})) {
    if (!p || !p.n || (acked && acked[p.n])) continue;
    if (typeof p.ts === "number" && now - p.ts > 30 * DAY_MS) continue;
    out.push({ n: p.n, k: p.k || null, t: p.t || null, r: p.r ?? null, g: p.g || 0, stars: p.stars || 0 });
  }
  return out.slice(0, 10);
}

// ================= /api/squad =================
export async function squad(env, pid) {
  const rows = (await dbGet(env, "players", { orderBy: '"ref"', equalTo: `"${pid}"` })) || {};
  return Object.entries(rows).slice(0, 300).map(([id, v]) => ({ id, n: v.name || "Pilot", pts: v.pts || 0, days: v.days || 0, ld: v.ld ?? null }));
}

// ================= /api/pay-log =================
// TON and SOL purchases are logged here after the game sees them; the server re-checks the chain itself.
async function verifyTon(memo, amt, proof) {
  try {
    const r = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${TON_RECIPIENT}&limit=50`);
    const d = await r.json();
    for (const t of d.result || []) {
      const val = parseInt((t.in_msg || {}).value || "0", 10) / 1e9;
      const okMemo = memo && String((t.in_msg || {}).message || "") === memo;
      const okHash = proof && t.transaction_id && t.transaction_id.hash === proof;
      if ((okMemo || okHash) && val + 1e-9 >= amt * 0.999) return true;
    }
  } catch {}
  return false;
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
async function payLog(env, b, user, pid) {
  const cur = b.cur === "SOL" ? "SOL" : b.cur === "TON" ? "TON" : null;
  if (!cur) return { error: "cur" };
  const memo = String(b.memo || "").slice(0, 64);
  if (!memo.startsWith("LWM|" + pid + "|")) return { error: "memo" };
  const amt = num(b.amt, 0, 100000);
  const key = `payments/LWM_${safeKey(memo)}`;
  if (await dbGet(env, key)) return { ok: true, dup: true };
  const verified = cur === "TON" ? await verifyTon(memo, amt, String(b.proof || "")) : await verifySol(String(b.proof || ""), amt);
  await dbPut(env, key, { pid, name: cleanName(user), cur, amt, gram: num(b.gram, 0, 100000), usd: num(b.usd, 0, 1e6), item: String(b.item || "").slice(0, 40), memo, proof: String(b.proof || "").slice(0, 120), verified, t: { ".sv": "timestamp" } });
  return { ok: true, verified };
}

// ================= /api/stars-invoice =================
async function starsInvoice(env, b, user) {
  const k = String(b.kind || ""), tk = String(b.tk || ""), ri = Number(b.ri ?? 0);
  let base = 0, starBase = 0;
  if (k === "box") {
    if (!["gem", "weapon", "chassis"].includes(tk) || ![0, 1, 2].includes(ri)) return { status: 400, body: { error: "item" } };
    base = BOX_TON[ri]; starBase = BOX_STARS[ri];
  } else if (k === "paint") {
    if (!PAINT_TON[tk]) return { status: 400, body: { error: "item" } };
    base = PAINT_TON[tk]; starBase = PAINT_STARS[tk];
  } else if (PREMIUM_TON[k]) {
    if (k === "pass" && tk && !/^\d{1,3}$/.test(tk)) return { status: 400, body: { error: "item" } };
    base = PREMIUM_TON[k]; starBase = PREMIUM_STARS[k];
  }
  else return { status: 400, body: { error: "item" } };
  // only crates have repeat-buy pricing; everything else is a fixed price
  if (k !== "box") b.price = base;
  // the game sends its escalated TON price; never below base, never absurdly above it
  let price = Number(b.price || base);
  if (!(price >= base)) price = base;
  if (price > base * 10) price = base * 10;
  const stars = Math.max(1, Math.round(starBase * (price / base)));
  const nonce = Math.random().toString(36).slice(2, 10);
  const payload = JSON.stringify({ u: user.id, k, t: tk || undefined, r: k === "box" ? ri : undefined, g: price, n: nonce });
  const label = itemLabel(k, tk, ri);
  const r = await tg(env, "createInvoiceLink", { title: label, description: `LUNAR: War Machines · ${label}`, payload, currency: "XTR", prices: [{ label, amount: stars }] });
  if (!r.ok) return { status: 502, body: { error: r.description || "telegram" } };
  return { status: 200, body: { link: r.result, stars, nonce } };
}

// ================= /api/notify-optin =================
async function notifyOptin(env, pid, user, on) {
  await dbPatch(env, `ntf/${pid}`, { on: on ? 1 : 0, last: dayOf(Date.now()) - 1, chat: user.id });
  return { ok: true };
}

// ================= /api/admin (Jake only) =================
async function admin(env, user) {
  if (!ADMINS.includes(String(user.username || "").toLowerCase())) return { status: 403, body: { error: "not admin" } };
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
  const all = Object.values((await dbGet(env, "players", { orderBy: '"pts"', limitToLast: 1000 }).catch(() => ({}))) || {});
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
  return { status: 200, body: { ok: true, players: n || 0, activeToday: Object.keys(dly || {}).length, buyersStars: Object.keys(stars || {}).length, stats,
    revenue: { TON: +rev.TON.toFixed(3), SOL: +rev.SOL.toFixed(4), STARS: rev.STARS, USD: Math.round(rev.USD), count: rev.count, unverified: rev.unverified },
    recent: recent.slice(0, 15), top: Object.values(top || {}).sort((a, b) => (b.pts || 0) - (a.pts || 0)).map((p) => ({ name: p.name, pts: p.pts, days: p.days, power: p.power })) } };
}

// ================= leaderboard (cron, every 5 minutes) =================
// Phones download one small file instead of every player's record.
export async function buildLeaderboard(env, now = Date.now()) {
  const d = dayOf(now), w = weekOf(now);
  const [top, daily, weekly, n] = await Promise.all([
    dbGet(env, "players", { orderBy: '"pts"', limitToLast: 1000 }).catch(() => ({})),
    dbGet(env, `dly/${d}`, { orderBy: '"s"', limitToLast: 100 }).catch(() => ({})),
    dbGet(env, `wly/${w}`, { orderBy: '"s"', limitToLast: 100 }).catch(() => ({})),
    dbGet(env, "meta/n").catch(() => 0),
  ]);
  const all = Object.entries(top || {}).map(([id, v]) => [id, v.name || "Pilot", v.pts || 0, v.days || 0, v.league || ""]).sort((a, b) => b[2] - a[2]);
  const lb = {
    t: now, d, w, n: Math.max(Number(n) || 0, all.length),
    cut: all.length >= 1000 ? all[999][2] : 0,
    top: all.slice(0, 1000),
    daily: Object.entries(daily || {}).map(([id, v]) => [id, v.n || "Pilot", v.s || 0]).sort((a, b) => b[2] - a[2]).slice(0, 100),
    weekly: Object.entries(weekly || {}).map(([id, v]) => [id, v.n || "Pilot", v.s || 0]).sort((a, b) => b[2] - a[2]).slice(0, 100),
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
      ? `☾ Your ${streak}-day streak ends at midnight UTC. Your daily reward is waiting, pilot.`
      : "☾ Your daily reward is ready, pilot. The top 1,000 on the leaderboard get $LUNAR.";
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
    const sp = m.successful_payment;
    let p = {};
    try { p = JSON.parse(sp.invoice_payload); } catch {}
    const pid = "tg_" + m.from.id;
    const charge = safeKey(sp.telegram_payment_charge_id);
    const item = itemLabel(p.k, p.t, p.r);
    await dbPut(env, `payments/LWM_${pid}_stars_${charge}`.slice(0, 120), { pid, name: cleanName(m.from), cur: "STARS", amt: sp.total_amount, gram: p.g || 0, usd: Math.round(sp.total_amount * 1.3) / 100, item, memo: "STARS|" + (p.n || ""), proof: charge, verified: true, t: { ".sv": "timestamp" } });
    await dbPut(env, `starsPaid/${pid}/${charge}`, { k: p.k || null, t: p.t || null, r: p.r ?? null, g: p.g || 0, stars: sp.total_amount, n: p.n || "", ts: { ".sv": "timestamp" } });
    return new Response("ok");
  }
  if (m && m.text && /^\/start/.test(m.text)) {
    // anyone who starts the bot can get the daily reminder (they can /stop it)
    if (m.chat && m.chat.type === "private") await dbPatch(env, `ntf/tg_${m.from.id}`, { on: 1, chat: m.chat.id, last: dayOf(Date.now()) - 1 }).catch(() => {});
    await tg(env, "sendMessage", {
      chat_id: m.chat.id,
      text: "☾ LUNAR: War Machines\n\nFast robot-tank battles right here in Telegram. Win matches, climb the leaderboard, and build your squad. The top 1,000 pilots get a guaranteed $LUNAR allocation.",
      reply_markup: { inline_keyboard: [[{ text: "⚔ PLAY", web_app: { url: GAME_URL } }], [{ text: "📖 Wiki", url: WIKI_URL }]] },
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
  "/api/sync": async (env, a) => ({ status: 200, body: await sync(env, a.b, a.user, a.pid) }),
  "/api/squad": async (env, a) => ({ status: 200, body: { ok: true, squad: await squad(env, a.pid) } }),
  "/api/pay-log": async (env, a) => ({ status: 200, body: await payLog(env, a.b, a.user, a.pid) }),
  "/api/stars-invoice": async (env, a) => starsInvoice(env, a.b, a.user),
  "/api/notify-optin": async (env, a) => ({ status: 200, body: await notifyOptin(env, a.pid, a.user, a.b.on !== false) }),
  "/api/admin": async (env, a) => admin(env, a.user),
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
