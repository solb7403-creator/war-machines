// LUNAR: War Machines — Telegram Stars backend (Cloudflare Worker)
// Secrets (set by the GitHub Action): BOT_TOKEN, FIREBASE_DB_SECRET
const GAME_ORIGIN = "https://solb7403-creator.github.io";
const GAME_URL = "https://solb7403-creator.github.io/war-machines/";
const WIKI_URL = "https://solb7403-creator.github.io/war-machines/wiki.html";
const DB_URL = "https://warmachines-a6034-default-rtdb.firebaseio.com";
const STARS_PER_TON = 100;
const BOX_BASE = [1, 4, 15];
const PREMIUM = { moonbeam: 50, skin: 30 };

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}
// webhook secret derived from the bot token, so it never needs storing separately
export async function webhookSecret(env) { return hex(await hmac(env.BOT_TOKEN, "lunar-webhook")).slice(0, 48); }

function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", GAME_ORIGIN);
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
async function dbPut(env, path, value) {
  const r = await fetch(`${DB_URL}/${path}.json?auth=${env.FIREBASE_DB_SECRET}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  return r.ok;
}
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(env, initData, maxAgeSec = 86400) {
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
function itemLabel(k, tk, ri) {
  if (k === "box") return ["Common", "Rare", "Epic"][ri ?? 0] + " " + (tk === "weapon" ? "Weapon Cache" : tk === "chassis" ? "Chassis Crate" : "Gem Cache");
  return k === "moonbeam" ? "Moonbeam" : k === "skin" ? "Lunar Skin" : "Purchase";
}

async function starsInvoice(req, env) {
  let b;
  try { b = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const user = await verifyInitData(env, String(b.initData || ""));
  if (!user) return json({ error: "not verified" }, 401);
  const k = String(b.kind || ""), tk = String(b.tk || ""), ri = Number(b.ri ?? 0);
  let base = 0;
  if (k === "box") {
    if (!["gem", "weapon", "chassis"].includes(tk) || ![0, 1, 2].includes(ri)) return json({ error: "item" }, 400);
    base = BOX_BASE[ri];
  } else if (PREMIUM[k]) base = PREMIUM[k];
  else return json({ error: "item" }, 400);
  let price = Number(b.price || base);
  if (!(price >= base)) price = base;
  if (price > base * 10) price = base * 10;
  const stars = Math.max(1, Math.round(price * STARS_PER_TON));
  const nonce = Math.random().toString(36).slice(2, 8);
  const payload = JSON.stringify({ u: user.id, k, t: tk || undefined, r: k === "box" ? ri : undefined, g: price, n: nonce });
  const label = itemLabel(k, tk, ri);
  const r = await tg(env, "createInvoiceLink", { title: label, description: `LUNAR: War Machines · ${label}`, payload, currency: "XTR", prices: [{ label, amount: stars }] });
  if (!r.ok) return json({ error: r.description || "telegram" }, 502);
  return json({ link: r.result, stars, nonce });
}

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
    const charge = String(sp.telegram_payment_charge_id).replace(/[.#$\[\]\/]/g, "_");
    const item = itemLabel(p.k, p.t, p.r);
    await dbPut(env, `payments/LWM_${pid}_stars_${charge}`.slice(0, 120), { pid, name: (m.from.username || m.from.first_name || "").slice(0, 20), cur: "STARS", amt: sp.total_amount, gram: p.g || sp.total_amount / STARS_PER_TON, usd: Math.round(sp.total_amount * 1.3) / 100, item, memo: "STARS|" + charge, proof: charge, t: { ".sv": "timestamp" } });
    await dbPut(env, `starsPaid/${pid}/${charge}`, { k: p.k || null, t: p.t || null, r: p.r ?? null, g: p.g || 0, stars: sp.total_amount, n: p.n || "", ts: { ".sv": "timestamp" } });
    return new Response("ok");
  }
  if (m && m.text && /^\/start/.test(m.text)) {
    await tg(env, "sendMessage", {
      chat_id: m.chat.id,
      text: "☾ LUNAR: War Machines\n\nBattle robot tanks in real-time PvP arenas, upgrade your machine and climb the ranks. The top 1,000 players get a guaranteed $LUNAR allocation.",
      reply_markup: { inline_keyboard: [[{ text: "⚔ PLAY", web_app: { url: GAME_URL } }], [{ text: "📖 Wiki", url: WIKI_URL }]] },
    });
  }
  return new Response("ok");
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (path === "/api/stars-invoice") {
      if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (req.method !== "POST") return cors(new Response("method", { status: 405 }));
      return cors(await starsInvoice(req, env));
    }
    if (path === "/api/tg-webhook" && req.method === "POST") return webhook(req, env);
    if (path === "/") return new Response("LUNAR: War Machines API");
    return new Response("not found", { status: 404 });
  },
};
