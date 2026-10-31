// LUNAR: War Machines — game server (Cloudflare Worker)
// Every write to the database goes through here, tied to a verified Telegram login.
// Secrets (set by the GitHub Action): BOT_TOKEN, FIREBASE_DB_SECRET
import { DAY_MS, dayOf, weekOf, hex, hmac, dbUrl, dbGet, dbPut, dbPatch, dbDel, cleanName } from "./db.js";
import { PvpRoom, PvpLobby, pvpJoin, pvpSocket, pvpHealth } from "./pvp.js";
import { RULES } from "./sim.gen.js";
import { tx, pub, readEco, setLoadout, migrate, paidRecords, act, matchStart, matchEnd, claimOnce, addFlags, isFlagged, flagReasons, ctxOf, squadRows, channelReady, who, link, ipHash, cfg, resetCfg } from "./eco.js";
import {rankedSnapshot} from "./snapshot.js";
import { processStarts, buildClusters, clearCluster } from "./farm.js";
export { PvpRoom, PvpLobby };
import {webAuth,webIdentity,hasWebCookie,WebSession,approveBotWebsiteLogin} from "./web-auth.js";
import {lunarAuth,resolveTelegramAccount,approveTelegramLunarLink} from "./lunar-identity.js";
export {WebSession};
const GAME_ORIGINS = ["https://solb7403-creator.github.io"];
const GAME_URL = "https://solb7403-creator.github.io/war-machines/";
const ACCOUNT_URL = "https://lunar-api.solb7403.workers.dev/web/login.html";
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
  if (hasWebCookie(req)) {
    if (b.initData) return {err:json({error:"ambiguous identity"},401)};
    const a=await webIdentity(req,env);if(!a)return {err:json({error:"not verified"},401)};
    const path=new URL(req.url).pathname;
    if(["/api/pay-log","/api/stars-invoice","/api/admin","/api/notify-optin"].includes(path))return {err:json({error:"Use Telegram for this action"},403)};
    if(path==="/api/sync"){
      const S=await readEco(env,a.pid);if(S.mig===0)return {err:json({error:"Open Telegram once to finish account migration"},409)};
      delete b.mig;delete b.refBy;delete b.starsAck; b.boot=false;
    }
    return {b,user:a.user,pid:a.pid,ip:req.headers.get("CF-Connecting-IP")||"",sp:"",web:true};
  }
  const user = await verifyInitData(env, String(b.initData || ""));
  if (!user || !user.id) return { err: json({ error: "not verified" }, 401) };
  // start_param: the link that opened the game (part of the signed login, so it can't be made up)
  let sp = ""; try { sp = String(new URLSearchParams(String(b.initData || "")).get("start_param") || "").slice(0, 64); } catch (e) {}
  // A verified Telegram identity joins its first-party Lunar account only when voluntarily linked.
  // Otherwise the Telegram-only edition retains its legacy anonymous Telegram identity.
  const lunarPid=await resolveTelegramAccount(env,user.id);
  const pid=lunarPid||"tg_"+user.id;
  // Both website-first linked Telegram players and Telegram-first passkey upgrades have
  // a Lunar-controlled identity. The latter retain their original economy storage key.
  const lunarAccount=await dbGet(env,'lunarAccounts/'+pid);
  if(lunarAccount){
    if(lunarAccount.id!==pid||lunarAccount.type!=='passkey')return {err:json({error:'invalid account link'},409)};
    user.web_auth=true;user.lunar_account=true;user.lunar_name=lunarAccount.name;
  }
  return { b, user, pid, ip: req.headers.get("CF-Connecting-IP") || "", sp };
}

function itemLabel(k, tk, ri) {
  if (k === "box") return ["Common", "Rare", "Epic"][ri ?? 0] + " " + (tk === "weapon" ? "Weapon Cache" : tk === "chassis" ? "Chassis Crate" : "Gem Cache");
  if (k === "paint") return "Paint: " + (PAINT_NAMES[tk] || "Paint");
  if (k === "pass") return "Lunar Pass" + (tk ? ", season " + tk : "");
  if (k === "vault") return "Hyperspace Vault: " + ((RULES.VAULT[tk] || {}).n || "Gold");
  return k === "moonbeam" ? "Moonbeam" : k === "skin" ? "Lunar Skin" : k === "starter" ? "Starter Pack" : k === "founder" ? "Founder Pack" : k === "respec" ? "Build reset (keep all points)" : "Purchase";
}

// ================= /api/sync =================
// No points come in here any more: every point comes from a named source the server checks (a scored match, a claim).
// Sync sets the name, the referrer (once), the loadout the pilot fields (power and league from what they own), the
// one-time move of an existing pilot's progress from their phone, and returns the server's record.
export async function sync(env, b, user, pid, now = Date.now(), ip = "", sp = "") {
  const name = cleanName(user), d = dayOf(now);
  const rec = (await dbGet(env, `players/${pid}`).catch(() => null)) || null;
  const paid = b.mig && typeof b.mig === "object" ? await paidRecords(env, pid) : null;
  // Only the invitation carried by verified Telegram initData may enroll a recruit.
  // Resolve a linked Telegram inviter to the same canonical account used by authentication.
  const invite = /^ref_\d{3,15}$/.test(sp) ? Number(sp.slice(4)) : 0;
  const inviter = invite > 0 ? (await resolveTelegramAccount(env, invite)) || "tg_" + invite : null;
  let why = null;
  let devCheck = false;
  const t = await tx(env, pid, (S, X) => {
    // The eligibility window and first binding live in the economy CAS, so concurrent
    // first syncs cannot choose different inviters. Existing accounts keep legacy bindings.
    if (!Number.isInteger(S.refDay)) S.refDay = !rec && !S.rev && !S.t ? X.day : -1;
    if (!S.referrer && rec && rec.ref) S.referrer = rec.ref;
    if (!S.referrer && inviter && inviter !== pid && S.refDay === X.day && (S.days || 0) <= 1) S.referrer = inviter;
    who(S, user);
    why = null;
    if (S.mig === 0 && paid) {
      why = migrate(S, b.mig, paid, X);
      S.L = RULES.ecoLoadout(S, b.L || S.L); // replace any pre-migration starter placeholder
    }
    if (b.lab === 1 && S.mig === 1) RULES.labEnsure(S, b.L);
    setLoadout(S, b.L || S.L);
    devCheck = S.dvd !== X.day; S.dvd = X.day;   // once a day: which other accounts use this phone
    return {};
  }, now, { rl: 1 });
  if (t.rate) return { ok: false, error: "rate" };
  const S = t.S, up = {};
  // Repair the public projection from the immutable binding after an interrupted sync.
  const ref = S.referrer || null;
  if (ref && (!rec || rec.ref !== ref)) up[`players/${pid}/ref`] = ref;
  if (rec && rec.bracket !== undefined) up[`players/${pid}/bracket`] = null;
  // Stars receipts the game confirmed it delivered
  const acks = Array.isArray(b.starsAck) ? b.starsAck.slice(0, 20) : [];
  for (const n of acks) if (/^[a-z0-9]{4,12}$/.test(String(n))) up[`starsAck/${pid}/${n}`] = now;
  // alts: a hashed network address per pilot. A recruit who shares one with their referrer flags both (squad payouts held)
  const flags = [];
  // farms: every Telegram account on one phone shares the device id (kept on the device, not in Telegram's cloud)
  const did = /^[0-9a-f]{16}$/.test(String(b.did || "")) ? String(b.did) : "";
  if (did) {
    up[`dev/${did}/${pid}`] = d;
    if (devCheck) { const others = (await dbGet(env, `dev/${did}`).catch(() => null)) || {}; for (const o of Object.keys(others).slice(0, 20)) if (o !== pid) await link(env, pid, o, "device").catch(() => {}); }
  }
  if (ip) {
    const h = await ipHash(env, ip);
    up[`iph/${pid}/${h}`] = d;
    if (ref) { const theirs = await dbGet(env, `iph/${ref}`).catch(() => null); if (theirs && theirs[h]) { flags.push([ref, [["alt", "shares a network with recruit " + pid]]]); flags.push([pid, [["alt", "shares a network with referrer " + ref]]]); } }
  }
  if (why && Object.keys(why).length) flags.push([pid, Object.entries(why).map(([k, v]) => ["mig_" + k, v])]);
  if (Object.keys(up).length) await dbPatch(env, "", up);
  for (const [id, list] of flags) await addFlags(env, id, id === pid ? name : null, list, now).catch(() => {});
  const out = { ok: true, pid, now, migOk: S.mig === 1, E: pub(S), power: S.pw, league: S.lg,
    rec: { ac: S.ac || 0, pts: S.earned, dailyPts: S.dailyPts, weeklyPts: S.weeklyPts, days: S.days || 0, sk: S.sk || 0, ld: S.ld ?? null, ref: ref || null, d, w: weekOf(now) } };
  await reconcilePayments(env, pid, S, now);
  // on launch the game asks for Stars purchases that were paid but never shown (app closed during checkout)
  if (b.boot) {
    out.stars = await undeliveredStars(env, pid, now);
    out.paymentReview = Object.values(S.starReceipts || {}).filter(p => p && p.held && !p.rf).length + Object.values(S.chainReceipts || {}).filter(p => p && p.held && !p.refunded).length;
  }
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
    if (p.rf || p.held) continue;
    out.push({ n: p.n, k: p.k || null, t: p.t || null, r: p.r ?? null, g: p.g || 0, x: p.x || null, stars: p.stars || 0, o: p.o || [] });
  }
  return out.slice(0, 10);
}

// ================= /api/squad =================
// recruits whose payouts are on hold (flagged for review) are marked, so the phone doesn't promise them
export async function squad(env, pid) {
  const [rows, fh] = await Promise.all([squadRows(env, pid), dbGet(env, "fh").catch(() => null)]);
  return rows.map((r) => (fh && fh[r.id] ? { ...r, held: true } : r));
}

// ================= /api/pay-log =================
// TON and SOL purchases: the phone reports the order, the server finds the payment on-chain itself (TON: the order note
// and the amount; SOL: the signature and the amount), records each transaction once, checks the price against its own
// record, and only then grants the item. Nothing is granted on the phone's word.
async function verifyTon(memo, amt) {
  try {
    const r = await fetch(`https://toncenter.com/api/v2/getTransactions?address=${TON_RECIPIENT}&limit=50`);
    if (!r.ok) return null;
    const d = await r.json();
    if (d.ok === false) return null;
    for (const t of d.result || []) {
      // Negative provider status is never delivery evidence. Absence of these fields
      // is not positive finality certification; that remains a provider release gate.
      const status = t.description || {};
      if (t.aborted === true || status.aborted === true || (t.in_msg || {}).bounced === true || (status.compute_ph || {}).success === false || (status.action || {}).success === false) continue;
      const val = parseInt((t.in_msg || {}).value || "0", 10) / 1e9;
      if (memo && String((t.in_msg || {}).message || "") === memo && val + 1e-9 >= amt * 0.999) return t.transaction_id && t.transaction_id.hash ? { hash: t.transaction_id.hash, src: String((t.in_msg || {}).source || "") } : null;
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
      return (tx.meta.postBalances[i] - tx.meta.preBalances[i]) / 1e9 + 1e-9 >= amt * 0.999 ? String(keys[0] || "payer") : false;   // the payer's wallet
    } catch {}
  }
  return false;
}
// the launch liquidity fund: LP_SHARE of every verified shop sale goes into the $LUNAR liquidity pool at launch. Sales are
// counted in US cents (meta/revc) as the server prices them (Stars at Telegram's ~1.3 cents, TON and SOL at the live TON
// price), never the phone's number; refunds come off. The board file shows the fund (lb.lpf), the Ranks tab and Shop too
const LP_SHARE = 0.25;   // not exported: the Workers runtime only accepts handlers and classes as exports of the main module
let TONUSD = { v: 0, t: 0 };
async function tonUsd() {
  if (TONUSD.v && Date.now() - TONUSD.t < 300000) return TONUSD.v;
  try { const d = await (await fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd")).json(); const v = Number(d["the-open-network"].usd); if (v > 0) TONUSD = { v, t: Date.now() }; } catch {}
  return TONUSD.v;
}
// The total and its durable event marker commit together. Retries cannot count a sale/refund twice.
async function revAdd(env, cents, event) {
  if (!cents) return;
  for (let i = 0; i < 12; i++) {
    const r = await fetch(dbUrl(env, "meta"), { headers: { "X-Firebase-ETag": "true" } });
    if (!r.ok) throw new Error("payment revenue read");
    const meta = (await r.json()) || {};
    meta.paymentEvents = meta.paymentEvents || {};
    if (meta.paymentEvents[event]) return;
    meta.paymentEvents[event] = 1;
    meta.revc = (Number(meta.revc) || 0) + Math.round(cents);
    const w = await fetch(dbUrl(env, "meta"), { method: "PUT", headers: { "Content-Type": "application/json", "if-match": r.headers.get("ETag") || "" }, body: JSON.stringify(meta) });
    if (w.status === 412) continue;
    if (!w.ok) throw new Error("payment revenue write");
    return;
  }
  throw new Error("payment revenue busy");
}
// Refund markers are terminal even when an older success callback finishes later.
async function paymentProjection(env, path, value) {
  for (let i = 0; i < 12; i++) {
    const r = await fetch(dbUrl(env, path), { headers: { "X-Firebase-ETag": "true" } });
    if (!r.ok) throw new Error("payment receipt read");
    const old = (await r.json()) || {}, next = { ...old, ...value };
    if (old.rf || value.rf) next.rf = old.rf || value.rf;
    if (old.refunded || value.refunded) { next.refunded = true; next.verified = false; }
    const w = await fetch(dbUrl(env, path), { method: "PUT", headers: { "Content-Type": "application/json", "if-match": r.headers.get("ETag") || "" }, body: JSON.stringify(next) });
    if (w.status === 412) continue;
    if (!w.ok) throw new Error("payment receipt write");
    return;
  }
  throw new Error("payment receipt busy");
}
// A bounded authenticated retry path survives a lost provider retry after the inventory CAS.
// The pending version commits with the receipt; clearing it cannot erase a concurrent refund.
function paymentPending(S, type, id, name) {
  S.paymentPending = S.paymentPending || {};
  const key = type + "_" + id;
  S.paymentSeq = (S.paymentSeq || 0) + 1;
  S.paymentPending[key] = { type, id, name: name || "Pilot", v: S.paymentSeq };
}
async function projectStars(env, pid, charge, receipt, name) {
  await paymentProjection(env, `payments/LWM_${pid}_stars_${charge}`.slice(0, 120), { pid, name, cur: "STARS", amt: receipt.stars || 0, gram: receipt.g || 0, usd: Math.round((receipt.stars || 0) * 1.3) / 100, item: itemLabel(receipt.k, receipt.t, receipt.r), memo: "STARS|" + (receipt.n || ""), proof: charge, verified: !receipt.rf && !receipt.held && !receipt.unmatched, ...(receipt.held ? { held: receipt.held } : {}), ...(receipt.rf ? { refunded: true } : {}), t: receipt.ts || receipt.rf });
  if (!receipt.unmatched) {
    if (receipt.journal) await revAdd(env, (receipt.stars || 0) * 1.3, "stars_sale_" + pid + "_" + charge);
    if (receipt.rf && (receipt.journal || receipt.refundJournal)) await revAdd(env, -(receipt.stars || 0) * 1.3, "stars_refund_" + pid + "_" + charge);
  }
  await paymentProjection(env, `starsPaid/${pid}/${charge}`, receipt);
}
async function reconcilePayments(env, pid, S, now = Date.now()) {
  // Reserve room for authentication, sync, refund projections and cleanup inside
  // the Workers Free subrequest budget. Each completed receipt advances durably.
  for (const [key, pending] of Object.entries(S.paymentPending || {}).slice(0, 2)) {
    const receipt = pending.type === "stars" ? S.starReceipts && S.starReceipts[pending.id] : S.chainReceipts && S.chainReceipts[pending.id];
    if (!receipt) continue;
    if (pending.type === "stars") await projectStars(env, pid, pending.id, receipt, pending.name);
    else {
      if (!(await dbPut(env, `payments/LWM_${pending.id}`, receipt))) throw new Error("payment receipt write");
      await revAdd(env, receipt.revc, receipt.revEvent);
    }
    await tx(env, pid, current => {
      if (current.paymentPending && current.paymentPending[key] && current.paymentPending[key].v === pending.v) delete current.paymentPending[key];
      return {};
    }, now);
  }
}
// Provider payloads are compared byte-for-byte with immutable server-issued quotes.
const STAR_QUOTE_MS = 10 * 60000;
function starQuoteEligible(S, quote, X) {
  const price = RULES.ecoPrice(S, quote.desc, X);
  if (RULES.ecoOwned(S, quote.desc, X) || !price || price.stars !== quote.price.stars || price.ton !== quote.price.ton || (price.deal || null) !== (quote.price.deal || null)) return false;
  if (quote.desc.kind === "pass" && quote.season !== RULES.ecoSeason(X)) return false;
  if (quote.desc.kind === "box" && (quote.day !== X.day || quote.week !== X.week)) return false;
  return true;
}
async function starQuote(env, payload, telegramId, amount, currency) {
  let p; try { p = JSON.parse(payload); } catch { return null; }
  if (currency !== "XTR" || p.u !== telegramId || !/^[a-f0-9]{12}$/.test(p.n || "")) return null;
  const quote = await dbGet(env, `starQuotes/${p.n}`);
  return quote && quote.payload === payload && quote.telegramId === telegramId && quote.price.stars === amount ? quote : null;
}

// A future bound SOL order must also have a verified live conversion; price outages fail closed.
async function solValueOk(sol, ton) {
  try {
    const d = await (await fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana&vs_currencies=usd")).json();
    const t = d["the-open-network"].usd, s = d.solana.usd;
    if (t > 0 && s > 0) return sol * s >= ton * t * 0.85;
  } catch {}
  return false;
}
const descOf = (d) => {
  d = d && typeof d === "object" ? d : {};
  const kind = String(d.kind || "");
  if (kind === "box") return ["gem", "weapon", "chassis"].includes(d.tk) && [0, 1, 2].includes(Number(d.ri)) ? { kind, tk: d.tk, ri: Number(d.ri), deal: d.deal === "d" || d.deal === "w" ? d.deal : null } : null;
  if (kind === "paint") return RULES.PAINTS[d.id] && RULES.PAINTS[d.id].stars ? { kind, id: d.id } : null;
  if (kind === "vault") return RULES.VAULT[d.tk] ? { kind, tk: d.tk } : null;   // a Hyperspace Vault bundle (Gold, looks only)
  return ["starter", "founder", "moonbeam", "skin", "pass", "respec"].includes(kind) ? { kind } : null;
};
async function payLog(env, b, user, pid, now = Date.now()) {
  const cur = b.cur === "SOL" ? "SOL" : b.cur === "TON" ? "TON" : null;
  if (!cur) return { error: "cur" };
  // SOL is paused until a server-issued order binds its reference to the authenticated buyer.
  if (cur === "SOL") return { error: "unavailable" };
  const memo = String(b.memo || "").slice(0, 64);
  if (!memo.startsWith("LWM|" + pid + "|")) return { error: "memo" };
  const amt = num(b.amt, 0, 100000), key = `payments/LWM_${safeKey(memo)}`;
  const have = await dbGet(env, key).catch(() => null);
  const desc = descOf(b.desc);
  if (have && (have.granted || !desc)) {
    if (have.revEvent) await revAdd(env, have.revc, have.revEvent);
    const S = await readEco(env, pid);
    return { ok: true, dup: true, verified: have.verified === true, ...(have.held ? { error: "review" } : {}), out: have.o || [], E: pub(S) };
  }
  const S0 = await readEco(env, pid), gk = safeKey(memo);
  const previous = S0.chainReceipts && S0.chainReceipts[gk];
  if (previous) {
    if (!(await dbPut(env, key, previous))) throw new Error("payment receipt write");
    await revAdd(env, previous.revc, previous.revEvent);
    return { ok: true, dup: true, verified: previous.verified === true, ...(previous.held ? { error: "review" } : {}), out: previous.o || [], E: pub(S0) };
  }
  const rec = { pid, name: cleanName(user), cur, amt, gram: num(b.gram, 0, 100000), usd: num(b.usd, 0, 1e6), item: String(b.item || "").slice(0, 40), memo, proof: String(b.proof || "").slice(0, 120), t: { ".sv": "timestamp" } };
  // A client label is not a priced product. Never make a migration-eligible sale from it.
  if (!desc) return { error: "item" };
  const X0 = ctxOf(pid, now), price = RULES.ecoPrice(S0, desc, X0);
  if (!price) return { error: "item" };
  const need = cur === "TON" ? Math.max(amt, price.ton) : amt;
  if (cur === "TON" && amt + 1e-9 < price.ton * 0.999) return { error: "amount" };
  if (cur === "SOL" && (rec.gram + 1e-9 < price.ton * 0.999 || !(await solValueOk(amt, price.ton)))) return { error: "amount" };
  let txid = null, src = "";
  if (cur === "TON") { const tv = await verifyTon(memo, need); if (tv) { txid = tv.hash; src = tv.src; } }
  else { const payer = await verifySol(rec.proof, amt); if (payer) { txid = rec.proof; src = payer; } }
  if (!txid) { if (!have) await dbPut(env, key, { ...rec, verified: false }); return { ok: true, verified: false, error: "pending" }; }
  // each on-chain transaction pays for one order
  const once = await claimOnce(env, `${cur === "TON" ? "tonTx" : "solTx"}/${safeKey(txid)}`, { pid, memo, t: now });
  if (!once.ok && !(once.v && once.v.memo === memo)) return { error: "reused" };
  const tu = await tonUsd(), usd = tu ? price.ton * tu : Math.min(rec.usd || 0, price.ton * 10);
  const t = await tx(env, pid, (S, X) => {
    S.chainReceipts = S.chainReceipts || {};
    if (S.chainReceipts[gk]) return { payment: S.chainReceipts[gk], dup: true };
    S.gout = S.gout || {};
    const currentPrice = RULES.ecoPrice(S, desc, X);
    const held = RULES.ecoOwned(S, desc, X) || !currentPrice || currentPrice.ton !== price.ton || currentPrice.stars !== price.stars || (currentPrice.deal || null) !== (price.deal || null) || X.day !== X0.day ? "eligibility_changed" : null;
    const outs = held ? [] : S.gout[gk] || RULES.ecoGrant(S, { ...desc, deal: price.deal, price: price.ton }, X);
    if ((S.lab || desc.kind === "respec" || desc.kind === "vault") && S.L) setLoadout(S, S.L);
    const payment = { ...rec, verified: !held, granted: true, ...(held ? { held } : {}), tx: txid, o: outs.filter(o => o && !o.none), revc: Math.round(usd * 100), revEvent: "chain_" + gk };
    S.chainReceipts[gk] = payment;
    paymentPending(S, "chain", gk, rec.name);
    return { payment };
  }, now);
  const payment = t.payment, outs = payment.o;
  if (!(await dbPut(env, key, payment))) throw new Error("payment receipt write");
  await revAdd(env, payment.revc, payment.revEvent);   // the liquidity fund
  // farms: accounts paying from the same wallet are one person's (only a wallet that really paid counts)
  if (src && src !== "payer") {
    const wh = hex(await hmac(env.BOT_TOKEN, "w|" + src)).slice(0, 16);
    const others = (await dbGet(env, `wal/${wh}`).catch(() => null)) || {};
    for (const o of Object.keys(others).slice(0, 20)) if (o !== pid) await link(env, pid, o, "wallet").catch(() => {});
    await dbPatch(env, `wal/${wh}`, { [pid]: dayOf(now) }).catch(() => {});
  }
  return { ok: true, verified: payment.verified, ...(payment.held ? { error: "review" } : {}), out: outs, E: pub(t.S) };
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
  const nonce = hex(crypto.getRandomValues(new Uint8Array(6)));
  const payload = JSON.stringify({ q: 1, u: user.id, k, t: k === "paint" || k === "box" || k === "vault" ? tk : k === "pass" ? String(RULES.ecoSeason(X)) : undefined, r: k === "box" ? ri : undefined, g: pr.ton, n: nonce, x: pr.deal || undefined });
  const quote = { pid, telegramId: user.id, desc, price: pr, payload, day: X.day, week: X.week, season: RULES.ecoSeason(X), ts: now, expires: now + STAR_QUOTE_MS };
  const issued = await claimOnce(env, `starQuotes/${nonce}`, quote);
  if (!issued.ok) throw new Error("payment quote collision");
  const label = itemLabel(k, k === "pass" ? String(RULES.ecoSeason(X)) : tk, ri);
  const r = await tg(env, "createInvoiceLink", { title: label, description: `LUNAR: War Machines · ${label}`, payload, currency: "XTR", prices: [{ label, amount: pr.stars }] });
  if (!r.ok) return { status: 502, body: { error: r.description || "telegram" } };
  return { status: 200, body: { link: r.result, stars: pr.stars, nonce } };
}

// ================= /api/notify-optin =================
async function notifyOptin(env, pid, user, on) {
  await dbPatch(env, `ntf/${pid}`, on ? { on: 1, chat: user.id, nx: dayOf(Date.now()) } : { on: 0, nx: null });
  return { ok: true };
}

// ================= /api/admin (Jake only) =================
async function admin(env, user, b = {}) {
  const un = String(user.username || "").toLowerCase();
  if (!ADMINS.includes(un)) return { status: 403, body: { error: "not admin" } };
  // the admin username is pinned to the Telegram account that first used it (a username can change hands)
  const pin = await dbGet(env, `cfg/admin/${un}`).catch(() => null);
  if (pin && String(pin) !== String(user.id)) return { status: 403, body: { error: "not admin" } };
  if (!pin) await dbPatch(env, "cfg/admin", { [un]: user.id });
  if (b.proof === "enforce" || b.proof === "flag") { await dbPatch(env, "cfg", { proof: b.proof }); resetCfg(); }
  if (b.clearCl && /^[0-9a-f]{1,8}$/.test(String(b.clearCl))) await clearCluster(env, String(b.clearCl));
  // clear a flagged pilot (every current reason): they count for the snapshot again
  if (b.clear && /^tg_\d{3,15}$/.test(String(b.clear))) {
    const f = await dbGet(env, `flags/${b.clear}`).catch(() => null), up = {};
    for (const k of flagReasons(f)) up[`flags/${b.clear}/ok/${k}`] = Date.now();
    up[`fh/${b.clear}`] = null; // Clearing all reasons also releases the held eligibility projection.
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
  const [clu, conf, lkok] = await Promise.all([dbGet(env, "clu").catch(() => null), dbGet(env, "cfg/proof").catch(() => null), dbGet(env, "lkok").catch(() => null)]);
  const clusters = (Array.isArray(clu) ? clu : Object.values(clu || {})).filter(Boolean).slice(0, 40).map((c) => Object.assign({}, c, { ok: !!(lkok && lkok[c.sig]) }));   // a cluster cleared a moment ago shows as cleared
  const body0 = { flagged, channel: await channelReady(env), proof: conf === "enforce" ? "enforce" : "flag", clusters };
  // Research snapshot: existing weighted-credit ranking, not token allocation or distribution.
  if (b.snap) body0.snapshot = await snapshot(env, fl);
  return { status: 200, body: { ok: true, ...body0, players: n || 0, activeToday: Object.keys(dly || {}).length, buyersStars: Object.keys(stars || {}).length, stats,
    revenue: { TON: +rev.TON.toFixed(3), SOL: +rev.SOL.toFixed(4), STARS: rev.STARS, USD: Math.round(rev.USD), count: rev.count, unverified: rev.unverified },
    recent: recent.slice(0, 15), top: Object.values(top || {}).sort((a, b) => (b.pts || 0) - (a.pts || 0)).map((p) => ({ name: p.name, pts: p.pts, days: p.days, power: p.power })) } };
}

export const snapshot = (env, fl, options) => rankedSnapshot(env, fl, options);

// ================= leaderboard (cron, every 5 minutes) =================
// Phones download one small file instead of every player's record.
export async function buildLeaderboard(env, now = Date.now()) {
  const d = dayOf(now), w = weekOf(now);
  const [top, daily, weekly, n, fl, revc, vlt] = await Promise.all([
    dbGet(env, "players", { orderBy: '"pts"', limitToLast: 1100 }).catch(() => ({})),
    dbGet(env, `dly/${d}`, { orderBy: '"s"', limitToLast: 100 }).catch(() => ({})),
    dbGet(env, `wly/${w}`, { orderBy: '"s"', limitToLast: 100 }).catch(() => ({})),
    dbGet(env, "meta/n").catch(() => 0),
    dbGet(env, "flags").catch(() => null),
    dbGet(env, "meta/revc").catch(() => 0),
    dbGet(env, "players", { orderBy: '"vg"', startAt: RULES.VLV[0], limitToLast: 100 }).catch(() => ({})),   // the Vault board: the top 100 by lifetime Gold
  ]);
  // pilots flagged for review sit out the board (and the snapshot) until Jake clears them
  const ok = ([id]) => !isFlagged(fl && fl[id]);
  const vlOf = (v) => RULES.vaultLevel(v && v.vg);
  const vrow = (r, lv) => (lv > 0 ? r.concat(lv) : r);   // the Vault level rides along as an extra column (only when there is one)
  const all = Object.entries(top || {}).filter(ok).map(([id, v]) => vrow([id, v.name || "Pilot", v.pts || 0, v.days || 0, v.league || ""], vlOf(v))).sort((a, b) => b[2] - a[2]);
  const lb = {
    t: now, d, w, n: Math.max(Number(n) || 0, all.length), lpf: Math.max(0, Math.round(((Number(revc) || 0) / 100) * LP_SHARE)), lps: LP_SHARE,
    cut: all.length >= 1000 ? all[999][2] : 0,
    top: all.slice(0, 1000),
    daily: Object.entries(daily || {}).filter(ok).map(([id, v]) => vrow([id, v.n || "Pilot", v.s || 0], v.v | 0)).sort((a, b) => b[2] - a[2]).slice(0, 100),
    weekly: Object.entries(weekly || {}).filter(ok).map(([id, v]) => vrow([id, v.n || "Pilot", v.s || 0], v.v | 0)).sort((a, b) => b[2] - a[2]).slice(0, 100),
    vault: Object.entries(vlt || {}).filter(ok).filter(([, v]) => vlOf(v) > 0).map(([id, v]) => [id, v.name || "Pilot", Math.floor(v.vg || 0), vlOf(v)]).sort((a, b) => b[2] - a[2]).slice(0, 100),
  };
  await dbPut(env, "lb", lb);
  // fh: who's held right now, kept exact here (a new flag also sets it at once); squad payouts read this small index
  const fh = (await dbGet(env, "fh").catch(() => null)) || {}, fup = {};
  for (const [id, f] of Object.entries(fl || {})) { const h = isFlagged(f); if (h && !fh[id]) fup[`fh/${id}`] = 1; if (!h && fh[id]) fup[`fh/${id}`] = null; }
  for (const id of Object.keys(fh)) if (!(fl || {})[id]) fup[`fh/${id}`] = null;
  if (Object.keys(fup).length) await dbPatch(env, "", fup);
  // farm defense: who starts together, then the clusters (their extra accounts sit out the next board)
  const names = {};
  for (const [id, v] of Object.entries(top || {})) if (v) names[id] = [v.name || "Pilot", v.pts || 0];
  await processStarts(env, now).catch((e) => console.log("starts", e && e.message));
  await buildClusters(env, names, fl || {}, now).catch((e) => console.log("clusters", e && e.message));
  // housekeeping once an hour: drop daily/weekly score tables older than a few days/weeks
  if (new Date(now).getUTCMinutes() < 5) { await dbDel(env, `dly/${d - 3}`); await dbDel(env, `wly/${w - 3}`); }
  return lb;
}

// ================= daily reminders (cron) =================
// Who's due: ntf/<pid> has nx (the next day to remind), pl (the day they last played) and sk (streak), so one query finds
// a batch and nothing else is read. Sent 4 at a time (Telegram allows ~30 messages a second). The batch size is
// env.NTF_BATCH (wrangler.toml): the Workers Free plan allows 50 outside requests per run, the Paid plan many more.
const NOTIFY_HOURS = [15, 16, 17, 18]; // UTC: ~10am-1pm US Central
let NTF2 = false;
async function ntfMigrate(env, d) {   // once: reminders set up before nx existed
  if (NTF2) return;
  if (await dbGet(env, "meta/ntf2").catch(() => null)) { NTF2 = true; return; }
  const all = (await dbGet(env, "ntf").catch(() => null)) || {}, up = { "meta/ntf2": 1 };
  for (const [pid, x] of Object.entries(all)) if (x && x.on && x.chat && !x.nx) up[`ntf/${pid}/nx`] = Math.max(d, (Number(x.last) || 0) + 1);
  await dbPatch(env, "", up);
  NTF2 = true;
}
export async function sendReminders(env, now = Date.now(), batch = 0) {
  if (!NOTIFY_HOURS.includes(new Date(now).getUTCHours())) return 0;
  const d = dayOf(now);
  await ntfMigrate(env, d);
  const n = batch || Math.max(1, Math.min(1000, Number(env.NTF_BATCH) || 40));
  const due = (await dbGet(env, "ntf", { orderBy: '"nx"', startAt: 1, endAt: d, limitToFirst: n }).catch(() => null)) || {};
  const list = Object.entries(due), up = {};
  let sent = 0, slow = false;
  for (let i = 0; i < list.length && !slow; i += 4) {
    await Promise.all(list.slice(i, i + 4).map(async ([pid, v]) => {
      if (!v || !v.on || !v.chat) { up[`ntf/${pid}/nx`] = null; return; }
      if (v.pl === d) { up[`ntf/${pid}/nx`] = d + 1; return; }   // already played today
      const streak = v.pl === d - 1 ? v.sk || 0 : 0;
      const text = v.gf === 0 && streak < 2   // first day back: the welcome-back gift is waiting
        ? "☾ Your welcome-back gift is ready, pilot: a free Rare gem cache. Claim it with today's daily reward in Quests."
        : streak >= 2
        ? `☾ Your ${streak}-day streak ends at midnight UTC. Keep it going: every streak day adds +5% to your quest points, up to +30%.`
        : "☾ Your daily reward and 4 new quests are ready, pilot. Points rankings do not guarantee tokens.";
      const r = await tg(env, "sendMessage", { chat_id: v.chat, text, reply_markup: { inline_keyboard: [[{ text: "⚔ PLAY", web_app: { url: GAME_URL } }]] } }).catch(() => null);
      if (r && r.ok) { up[`ntf/${pid}/nx`] = d + 1; up[`ntf/${pid}/last`] = d; sent++; }
      else if (r && r.error_code === 429) slow = true;   // Telegram says slow down: the rest wait for the next run
      else if (r && (r.error_code === 403 || r.error_code === 400)) { up[`ntf/${pid}/on`] = 0; up[`ntf/${pid}/nx`] = null; }   // blocked or deleted chats switch reminders off
    }));
  }
  if (Object.keys(up).length) await dbPatch(env, "", up);
  return sent;
}

// A charge keeps its original economy owner when Telegram later links to a Lunar account.
async function starsOwner(env, telegramId, charge, quotedPid = null) {
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) throw new Error("payment owner unavailable");
  const path = `starsChargeOwner/${charge}`;
  const checked = owner => {
    if (!owner || typeof owner.pid !== "string" || !/^(?:tg|ln)_\d{3,15}$/.test(owner.pid) || owner.telegramId !== telegramId) throw new Error("payment owner unavailable");
    return owner.pid;
  };
  // Existing receipts must remain refundable even if a later account link is incomplete.
  const pinned = await dbGet(env, path);
  if (pinned !== null) return checked(pinned);
  const legacy = "tg_" + telegramId;
  const pid = await dbGet(env, `starsPaid/${legacy}/${charge}`) ? legacy : quotedPid || (await resolveTelegramAccount(env, telegramId)) || legacy;
  const owner = { pid, telegramId }, claim = await claimOnce(env, path, owner);
  return checked(claim.ok ? owner : claim.v);
}

// ================= Telegram webhook =================
async function webhook(req, env) {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== (await webhookSecret(env))) return new Response("forbidden", { status: 403 });
  let u;
  try { u = await req.json(); } catch { return new Response("ok"); }
  if (u.pre_checkout_query) {
    const q = u.pre_checkout_query;
    const now = Date.now(), quote = await starQuote(env, q.invoice_payload, q.from.id, q.total_amount, q.currency);
    let ok = false;
    if (quote && now < quote.expires) {
      const n = JSON.parse(quote.payload).n;
      const accepted = await tx(env, quote.pid, (S, X) => {
        const active = S.starCheckout;
        if (!starQuoteEligible(S, quote, X) || S.starQuoteUse && S.starQuoteUse[n]) return { abort: true };
        if (active && active.until > now && (active.n !== n || active.q !== q.id)) return { abort: true };
        S.starAccepted = S.starAccepted || {};
        if (S.starAccepted[n] && S.starAccepted[n] !== q.id) return { abort: true };
        S.starAccepted[n] = q.id;
        S.starCheckout = { n, q: q.id, until: quote.expires };
        return { accepted: true };
      }, now);
      ok = !!accepted.accepted;
    }
    await tg(env, "answerPreCheckoutQuery", ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: "This purchase couldn't be verified. Please try again from the game." });
    return new Response("ok");
  }
  const m = u.message;
  if (m && m.successful_payment) {
    const sp = m.successful_payment;
    let p = {};
    try { p = JSON.parse(sp.invoice_payload); } catch {}
    const charge = safeKey(sp.telegram_payment_charge_id);
    const quote = p.q === 1 ? await starQuote(env, sp.invoice_payload, m.from.id, sp.total_amount, sp.currency) : null;
    const pid = await starsOwner(env, m.from.id, charge, quote && quote.pid), now = Date.now();
    const desc = descOf({ kind: p.k, tk: p.t, ri: p.r, id: p.t, deal: p.x });
    const prior = await dbGet(env, `starsPaid/${pid}/${charge}`);
    const t = await tx(env, pid, (S, X) => {
      S.starReceipts = S.starReceipts || {};
      const old = S.starReceipts[charge] || prior;
      if (old && !old.unmatched) { S.starReceipts[charge] = old; return { receipt: old, dup: true }; }
      S.gout = S.gout || {};
      let held = null;
      if (p.q === 1) {
        if (!quote || !S.starAccepted || !S.starAccepted[p.n] || !starQuoteEligible(S, quote, X)) held = "quote_ineligible";
        S.starQuoteUse = S.starQuoteUse || {};
        if (S.starQuoteUse[p.n] && S.starQuoteUse[p.n] !== charge) held = "quote_used";
        if (!held) S.starQuoteUse[p.n] = charge;
        if (S.starCheckout && S.starCheckout.n === p.n) delete S.starCheckout;
      }
      const outs = old && old.rf || held ? [] : S.gout[charge] || (desc ? RULES.ecoGrant(S, { ...desc, price: p.g }, X) : []);
      if (desc && (S.lab || desc.kind === "respec" || desc.kind === "vault") && S.L) setLoadout(S, S.L);
      const receipt = { k: p.k || null, t: p.t || null, r: p.r ?? null, g: p.g || 0, x: p.x || null, stars: sp.total_amount, n: p.n || "", o: outs.filter(o => o && !o.none), ts: now, journal: 1, ...(held ? { held } : {}), ...(old && old.rf ? { rf: old.rf } : {}) };
      S.starReceipts[charge] = receipt;
      paymentPending(S, "stars", charge, cleanName(m.from));
      return { receipt };
    }, now);
    const receipt = t.receipt;
    await projectStars(env, pid, charge, receipt, cleanName(m.from));
    return new Response("ok");
  }
  if (m && m.refunded_payment) {
    const rp = m.refunded_payment, charge = safeKey(rp.telegram_payment_charge_id), now = Date.now();
    const pid = await starsOwner(env, m.from.id, charge);
    const prior = await dbGet(env, `starsPaid/${pid}/${charge}`);
    const t = await tx(env, pid, (S) => {
      S.starReceipts = S.starReceipts || {};
      const receipt = S.starReceipts[charge] || prior;
      if (!receipt) { S.starReceipts[charge] = { rf: now, unmatched: true }; paymentPending(S, "stars", charge, cleanName(m.from)); return { receipt: S.starReceipts[charge] }; }
      if (receipt.rf) return { abort: true, receipt, settledLegacy: !receipt.journal && !receipt.refundJournal };
      S.rfd = S.rfd || [];
      if (!S.rfd.includes(charge)) {
        if (!receipt.held) {
          RULES.ecoRefund(S, receipt.k, receipt.o || []);
          S.spendGram = Math.max(0, (S.spendGram || 0) - (Number(receipt.g) || 0));
        }
        S.rfd = S.rfd.concat(charge).slice(-40);
        if (S.L) setLoadout(S, S.L);
      }
      S.starReceipts[charge] = { ...receipt, rf: now, refundJournal: 1 };
      paymentPending(S, "stars", charge, cleanName(m.from));
      return { receipt: S.starReceipts[charge], refunds: S.rfd.length };
    }, now);
    const receipt = t.receipt;
    await projectStars(env, pid, charge, receipt, cleanName(m.from));
    if (t.refunds >= 2) await addFlags(env, pid, t.S && t.S.nm, [["refunds", t.refunds + " Stars refunds"]], now).catch(() => {});
    return new Response("ok");
  }
  // Website login: only a genuine private-chat message delivered by Telegram's signed webhook
  // can approve a fresh browser challenge. Never enable reminders for login-only messages.
  const lunarLinkCode=typeof m?.text==='string'?m.text.match(/^\/(?:start(?:@LunarWarMachinesBot)?\s+link_|link(?:@LunarWarMachinesBot)?\s+)([a-f0-9]{48})$/i):null;
  if(lunarLinkCode&&m.chat?.type==='private'&&Number.isSafeInteger(m.from?.id)&&m.from.id>0&&m.chat.id===m.from.id){
    const result=await approveTelegramLunarLink(env,lunarLinkCode[1].toLowerCase(),m.from);
    await tg(env,'sendMessage',{chat_id:m.chat.id,text:result.ok?'Your Telegram account is now linked to your LUNAR website account. Both platforms use the same machines, inventory, and progress.':'Account linking failed or expired. Return to your Lunar website account to request a new link.'});
    return new Response('ok');
  }
  const webLoginCode=typeof m?.text==='string'?m.text.match(/^\/(?:start(?:@LunarWarMachinesBot)?\s+web_|login(?:@LunarWarMachinesBot)?\s+)([a-f0-9]{48})$/i):null;
  if(webLoginCode&&m.chat?.type==='private'&&Number.isSafeInteger(m.from?.id)&&m.from.id>0&&m.chat.id===m.from.id){
    const success=await approveBotWebsiteLogin(env,webLoginCode[1].toLowerCase(),m.from);
    await tg(env,'sendMessage',{chat_id:m.chat.id,text:success?'LUNAR website sign-in verified. Return to your original Safari/browser tab; the game will open automatically. Only approve sign-in requests you initiated.':'This website sign-in code has expired or was already used. Return to the website and request a new code.'});
    return new Response('ok');
  }
  if (m && m.text && /^\/start/.test(m.text)) {
    // anyone who starts the bot can get the daily reminder (they can /stop it)
    if (m.chat && m.chat.type === "private") await dbPatch(env, `ntf/${(await resolveTelegramAccount(env,m.from.id))||"tg_"+m.from.id}`, { on: 1, chat: m.chat.id, nx: dayOf(Date.now()) }).catch(() => {});
    await tg(env, "sendMessage", {
      chat_id: m.chat.id,
      text: "☾ LUNAR: War Machines\n\nFast robot-tank battles right here in Telegram. Win matches, climb the leaderboard, and build your squad. Token allocation, claims and distribution are not implemented. Rankings do not guarantee tokens.",
      reply_markup: { inline_keyboard: [[{ text: "⚔ PLAY", web_app: { url: GAME_URL } }], [{ text: "🌐 LUNAR WEBSITE / ACCOUNT", url: ACCOUNT_URL }], [{ text: "📣 Channel", url: CHANNEL_URL }, { text: "📖 Wiki", url: WIKI_URL }]] },
    });
  } else if (m && m.text && /^\/account(?:\s|$)/.test(m.text)) {
    await tg(env, "sendMessage", {chat_id:m.chat.id,
      text:"Keep your LUNAR machines, points, purchases and progression when you move to the official website. Open the website, use optional Telegram sign-in once, and in Account Settings add a permanent Lunar passkey. You can then sign in without Telegram.",
      reply_markup:{inline_keyboard:[[{text:"🌐 OPEN LUNAR ACCOUNT",url:ACCOUNT_URL}]]}});
  } else if (m && m.text && /^\/(paysupport|support)/.test(m.text)) {
    await tg(env, "sendMessage", { chat_id: m.chat.id, text: SUPPORT_TEXT });
  } else if (m && m.text && /^\/terms/.test(m.text)) {
    await tg(env, "sendMessage", { chat_id: m.chat.id, text: "Terms of service and purchase: " + TERMS_URL, reply_markup: { inline_keyboard: [[{ text: "📄 Read the terms", url: TERMS_URL }]] } });
  } else if (m && m.text && /^\/stop/.test(m.text)) {
    await dbPatch(env, `ntf/${(await resolveTelegramAccount(env,m.from.id))||"tg_"+m.from.id}`, { on: 0, nx: null }).catch(() => {});
    await tg(env, "sendMessage", { chat_id: m.chat.id, text: "Daily reminders are off. Send /start to turn them back on." });
  }
  return new Response("ok");
}

// ================= router =================
const ROUTES = {
  "/api/sync": async (env, a) => { const r = await sync(env, a.b, a.user, a.pid, Date.now(), a.ip, a.sp); return { status: r.error === "rate" ? 429 : 200, body: r }; },
  "/api/act": async (env, a) => act(env, a.b, a.user, a.pid, Date.now(), a.sp),
  "/api/match/start": async (env, a) => matchStart(env, a.b, a.user, a.pid, Date.now(), a.ip),
  "/api/match/end": async (env, a) => matchEnd(env, a.b, a.user, a.pid),
  "/api/squad": async (env, a) => ({ status: 200, body: { ok: true, squad: await squad(env, a.pid) } }),
  "/api/pay-log": async (env, a) => ({ status: 200, body: await payLog(env, a.b, a.user, a.pid) }),
  "/api/stars-invoice": async (env, a) => starsInvoice(env, a.b, a.user, a.pid),
  "/api/notify-optin": async (env, a) => ({ status: 200, body: await notifyOptin(env, a.pid, a.user, a.b.on !== false) }),
  "/api/admin": async (env, a) => admin(env, a.user, a.b),
  "/api/pvp/join": async (env, a) => pvpJoin(env, a),
};

// requests per network address per minute, before any database work (a soft cap per server instance; with a Cloudflare
// rate-limit binding named RL in wrangler.toml it's a hard one). Players behind one carrier address share it, so it's high
const NET_RL = 1200, NET = new Map();
async function netLimited(req, env) {
  const ip = req.headers.get("CF-Connecting-IP") || "";
  if (!ip) return false;
  if (env.RL && env.RL.limit) { try { const r = await env.RL.limit({ key: ip }); if (!r.success) return true; } catch (e) {} }
  const m = Math.floor(Date.now() / 60000);
  let e = NET.get(ip);
  if (!e || e.m !== m) { e = { m, n: 0 }; NET.set(ip, e); if (NET.size > 20000) NET.clear(); }
  return ++e.n > NET_RL;
}
// the public leaderboard file, through Cloudflare's cache: each data center reads it from the database at most once a
// minute however many players open the Ranks tab (straight from Firebase, every open was a 40+ KB download)
async function lbFile(req, env) {
  const cache = typeof caches !== "undefined" && caches.default ? caches.default : null, key = new Request("https://lunar-api.cache/lb.json");
  if (cache) { const hit = await cache.match(key).catch(() => null); if (hit) return cors(new Response(hit.body, hit), req); }
  const lb = await dbGet(env, "lb").catch(() => null);
  const res = new Response(JSON.stringify(lb), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
  if (cache && lb) await cache.put(key, res.clone()).catch(() => {});
  return cors(res, req);
}
// per pilot, for the endpoints that reach outside services (Telegram invoices, TON and Solana lookups) or read a lot:
// a soft cap per server instance, far above what playing ever needs
const PID_RL = { "/api/stars-invoice": 20, "/api/pay-log": 30, "/api/squad": 30, "/api/pvp/join": 40, "/api/notify-optin": 10, "/api/admin": 60 }, PIDS = new Map();
function pidLimited(path, pid) {
  const lim = PID_RL[path];
  if (!lim) return false;   // sync, actions and match tickets are limited inside the pilot's record (90 a minute)
  const m = Math.floor(Date.now() / 60000), k = path + "|" + pid;
  let e = PIDS.get(k);
  if (!e || e.m !== m) { e = { m, n: 0 }; PIDS.set(k, e); if (PIDS.size > 50000) PIDS.clear(); }
  return ++e.n > lim;
}
export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if(path.startsWith("/auth/lunar/")){
      try{return await lunarAuth(req,env);}catch{return json({error:"account service unavailable"},503);}
    }
    if(path.startsWith("/auth/")){
      try{return await webAuth(req,env);}catch{return json({error:"authentication unavailable"},503);}
    }
    if (path === "/lb.json" && req.method === "GET") return lbFile(req, env);
    if (ROUTES[path]) {
      if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }), req);
      if (req.method !== "POST") return cors(new Response("method", { status: 405 }), req);
      if (await netLimited(req, env)) return cors(json({ error: "rate" }, 429), req);
      let a;try{a=await auth(req,env);}catch{return cors(json({error:"authentication unavailable"},503),req);}
      if (a.err) return cors(a.err, req);
      if (pidLimited(path, a.pid)) return cors(json({ error: "rate" }, 429), req);
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
    if(env.ASSETS&&["GET","HEAD"].includes(req.method)&&(/^\/(web|js|css|fonts)\//.test(path)||["/range-engine.html","/version.json","/icon.png","/favicon-32.png","/icon-180.png"].includes(path))){
      const res=await env.ASSETS.fetch(req);const out=new Response(res.body,res);out.headers.set("X-Content-Type-Options","nosniff");
      if(path.startsWith("/web/")){out.headers.set("Referrer-Policy","same-origin");out.headers.set("Cross-Origin-Opener-Policy","same-origin-allow-popups");out.headers.set("Content-Security-Policy","default-src 'self'; script-src 'self' https://oauth.telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://oauth.telegram.org wss://lunar-api.solb7403.workers.dev https://warmachines-a6034-default-rtdb.firebaseio.com; frame-src 'self' https://oauth.telegram.org; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");out.headers.set("Cache-Control","no-cache");}
      return out;
    }
    if (path === "/") return new Response("LUNAR: War Machines API");
    return new Response("not found", { status: 404 });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      // two schedules, each its own run with its own budget of outside calls (50 on the Workers Free plan):
      // every minute 15:00-18:59 UTC, reminders only; every 5 minutes, the board and the farm check
      if (event && event.cron === "* 15-18 * * *") { await sendReminders(env).catch((e) => console.log("ntf", e && e.message)); return; }
      await buildLeaderboard(env).catch((e) => console.log("lb", e && e.message));
    })());
  },
};
