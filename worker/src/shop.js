// Session 8 (owner brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md, Nov 26, 2026): the certified checkout, every currency.
// Stars (Telegram), GRAM (the TON coin, renamed June 15, 2026: the website, and Telegram while the owner's switch is on) and SOL (the
// website). Every price, limit, deal and ownership rule is checked here on the server's own records (js/rules.js SHOP, ecoSaleErr,
// ecoPrice), never trusted from the phone, and every payment is credited exactly once.
//  - A purchase starts with a QUOTE (an order: orders/<pid>/<oid>): the buyer, the goods, the price frozen, the exact amount (nanoGRAM,
//    lamports, Stars), the memo or the SOL reference, an expiry. The account holds one open quote per item across every rail (S.ord
//    reservation keys: the one-time item, the price step or the limit it moves), so two tabs or two invoices can never both be paid at
//    the old price: a second request for the same item gets the open quote back.
//  - Stars: the invoice is a quote; the pre-checkout re-reads the account (open quote, not owned, limits, the current price equals the
//    invoice's total) and answers no on any mismatch; the webhook grants it. GRAM and SOL: the phone polls the quote's status; the
//    Worker finds the payment on chain itself (GRAM: our wallet's incoming message with the quote's exact memo and at least its amount;
//    SOL: a finalized System transfer to our wallet of at least the quote's lamports, found by the quote's own reference key, or by
//    the quote's exact unique amount), claims the transaction once for good (tonTx/, solTx/) and grants it.
//  - The grant runs in the account CAS: the payment id and the quote id are recorded with it (S.go, kept 35 days), so a replay, a
//    retried webhook, a second tab or a crash between the grant and the receipt never grants twice. A payment that lands when the item
//    is owned, over a limit, superseded or priced higher now is kept with nothing granted (st 'held', for a refund): never re-rolled.
//  - SOL quotes need the live GRAM and SOL rates: when the price service is down, no quote ('pending', fail closed); a paid SOL quote
//    is judged against its own frozen lamports, so no live rate is needed (or trusted) when it lands.
import { dayOf, hex, hmac, dbGet, dbPut, dbPatch, cleanName } from "./db.js";
import { RULES as R, CONQUEST } from "./sim.gen.js";
import { tx, pub, readEco, readTag, writeIf, claimOnce, setLoadout, link, cfg, ctxOf } from "./eco.js";
import { readState } from "./conquest-store.js";
import { research, lab } from "./conquest-research.js";
export const TON_RECIPIENT = "UQAq3MBfPQ7Wqo5kL7631yEDKf2E9GOmZdhOfLUWhUiACfzu";   // the owner's wallet: receives every GRAM payment
export const SOL_RECIPIENT = "A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE";   // the owner's War Machines SOL wallet
const SOL_RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
export const QUOTE_MS = 30 * 60000;   // a GRAM / SOL / Stars quote holds its price for 30 minutes
const GO_DAYS = 35;   // payment and quote ids kept on the account (exactly once) this many days
const own = (o, k) => typeof k === "string" && !!o && Object.prototype.hasOwnProperty.call(o, k);
const safeKey = (s) => String(s).replace(/[.#$\[\]\/|]/g, "_").slice(0, 100);
const num = (v, lo, hi, d = 0) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
// ---------------------------------------------------------------- the goods ----------------------------------------------------------
// The phone names the goods; this is the only shape the server accepts (names checked against the rules' own tables)
export function descOf(d) {
  d = d && typeof d === "object" ? d : {};
  const kind = String(d.kind || ""), c = R.isCh(d.c) ? d.c : null, ri = Number(d.ri);
  if (kind === "box") return ["gem", "weapon", "chassis"].includes(d.tk) && [0, 1, 2].includes(ri) ? { kind, tk: d.tk, ri, deal: d.deal === "d" || d.deal === "w" ? d.deal : null, c } : null;
  if (kind === "core") return R.isGem(d.tk) && [0, 1, 2].includes(ri) && c ? { kind, tk: d.tk, ri, c } : null;
  if (kind === "gear") return R.gearTk(d.tk) && [0, 1, 2].includes(ri) ? { kind, tk: d.tk, ri } : null;   // a chosen weapon or chassis (Checkpoint 39)
  if (kind === "paint") return own(R.PAINTS, d.id) && R.PAINTS[d.id].stars ? { kind, id: d.id } : null;
  if (kind === "vault") return own(R.VAULT, d.tk) ? { kind, tk: d.tk } : null;   // a Hyperspace Vault bundle (Gold, looks only)
  // the Science Lab store (Session 8: open; LAB_STORE_OPEN): part packs, Legendary set mods, the instant finish of a research job
  if (kind === "rspack") return own(R.RS_PACKS, d.tk) ? { kind, tk: d.tk } : null;
  if (kind === "rsleg") return typeof d.tk === "string" && R.rsLegSet(d.tk) ? { kind, tk: d.tk } : null;
  if (kind === "rsfin") return /^j\d{1,6}$/.test(String(d.job || "")) ? { kind, job: String(d.job) } : null;
  // the Battalion store stays off (not in the owner's Nov 26 sale list; BAT_STORE_OPEN false): refused in every currency
  if (R.BAT_KINDS.includes(kind)) return null;
  // the Conquest store (Session 8; CQ_STORE_OPEN): town items, the collection, mineral and wall-only ore crates, construction speed-ups
  if (kind === "cq") return own(R.SHOP.cq, d.tk) ? { kind, tk: d.tk } : null;
  if (kind === "cos") return own(R.SHOP.cos, d.tk) ? { kind, tk: d.tk } : null;
  if (kind === "mncrate") return own(R.SHOP.mn, d.tk) ? { kind, tk: d.tk } : null;
  if (kind === "orecrate") return own(R.SHOP.ore, d.tk) ? { kind, tk: d.tk } : null;
  if (kind === "cfin") { const j = R.cfxKey(d.job); return j ? { kind, job: j } : null; }
  return ["starter", "founder", "moonbeam", "skin", "pass", "respec"].includes(kind) ? { kind, c } : null;
}
// what the server adds from the Conquest record (never the phone's numbers): the wall extensions earned, a standing Foundry, a piece
// already earned, the time left on the construction or research job a finish is for
export async function serverDesc(env, pid, d, now) {
  if (!["cq", "cos", "cfin", "rsfin"].includes(d.kind)) return d;
  if (d.kind === "cq" && !["wall-ext-10", "foundry-rush"].includes(d.tk)) return d;
  const s = await readState(env, pid).catch(() => null), p = s && s.plot, P = CONQUEST.Plot;
  if (d.kind === "cq" && d.tk === "wall-ext-10") { if (!p) return { ...d, extEarned: -1 }; const e = P.extParts(p); return { ...d, extEarned: e.research + e.drill + e.defense }; }
  if (d.kind === "cq" && d.tk === "foundry-rush") return { ...d, foundry: !!(p && Object.values(p.b || {}).some((b) => b && b.t === "foundry" && (b.l | 0) > 0)) };
  if (d.kind === "cos") { const C = CONQUEST.Catalog, it = C.byId[d.tk], o = s && s.cosmetics && s.cosmetics.owned && s.cosmetics.owned[d.tk]; return { ...d, earned: !!(o && o.source !== "bought") || !!(it && s && C.eligible(it, s)) }; }
  if (d.kind === "cfin") { let left = 0; for (const j of jobsOf(p)) if (cfxOf(j) === d.job) left = Math.max(0, (Number(j.ready) || 0) - now); return { ...d, left }; }
  if (d.kind === "rsfin") { let left = 0; if (s && s.rs) { const r = research(s), L = lab(s), run = L.any && !L.ruined; for (const j of r.jobs) if (j.id === d.job) left = Math.max(0, (Number(j.left) || 0) - (run ? Math.max(0, now - (Number(j.at) || now)) : 0)); } return { ...d, left }; }
  return d;
}
export const jobsOf = (p) => [p && p.job, p && p.job2].filter((j) => j && typeof j === "object" && j.t !== "repair");
export const cfxOf = (j) => R.cfxKey((j.t === "cc" ? "cc" : j.id) + "@" + j.l);
// the reservation keys: one open quote per key across Stars, GRAM and SOL. A one-time item is its own key; a repeatable one the
// price step or the limit it moves (crate price steps, the day's deal, a week's pack, a day's crate count); a fixed-price unlimited
// one (a common crate, a Vault deposit) none
export function rksOf(d, X, price) {
  const k = [];
  if (d.kind === "box") { if (d.ri > 0) k.push("b:" + R.ecoBuyKey(d.tk, d.ri, X)); }
  else if (d.kind === "core") { k.push("core:" + d.c + ":" + d.tk); if (d.ri > 0) k.push("b:" + R.ecoBuyKey("gem", d.ri, X)); }
  else if (d.kind === "gear") { k.push("gear:" + d.tk + ":" + d.ri); if (d.ri > 0) k.push("b:" + R.ecoBuyKey(R.gearTk(d.tk), d.ri, X)); }
  else if (d.kind === "paint") k.push("paint:" + d.id);
  else if (d.kind === "pass") k.push("pass:" + R.ecoSeason(X));
  else if (["starter", "founder", "moonbeam", "skin", "respec"].includes(d.kind)) k.push(d.kind);
  else if (d.kind === "rspack") k.push("rsp:" + d.tk);
  else if (d.kind === "rsleg") k.push("rsleg:" + d.tk, "rslw");
  else if (d.kind === "rsfin" || d.kind === "cfin") k.push(d.kind + ":" + d.job);
  else if (["cq", "cos", "mncrate", "orecrate"].includes(d.kind)) k.push(d.kind + ":" + d.tk);
  if (price && price.deal) k.push("deal:" + price.deal);
  return k.map(safeKey);
}
const labelOf = (d) => {
  if (d.kind === "box") return ["Common", "Rare", "Epic"][d.ri] + " " + (d.tk === "weapon" ? "Weapon Cache" : d.tk === "chassis" ? "Chassis Crate" : "Gem Cache");
  if (d.kind === "core") return ["Common", "Rare", "Epic"][d.ri] + " chosen core: " + R.GEM[d.tk].name;
  if (d.kind === "gear") { const g = R.gearTk(d.tk); return ["Common", "Rare", "Epic"][d.ri] + " chosen " + (g === "weapon" ? "weapon: " + R.WNAMES[d.tk][d.ri] : "chassis: " + R.CNAMES[d.tk][d.ri]); }
  if (d.kind === "paint") return "Paint: " + R.PAINTS[d.id].n;
  if (d.kind === "vault") return "Hyperspace Vault: " + R.VAULT[d.tk].n;
  if (d.kind === "rspack") return "Science Lab: " + R.RS_PACKS[d.tk].n;
  if (d.kind === "rsleg") return "Legendary set mod: " + R.rmodOf(d.tk).F.n;
  if (d.kind === "rsfin") return "Science Lab: instant finish";
  if (d.kind === "cq") return R.SHOP.cq[d.tk].n;
  if (d.kind === "cos") { const it = CONQUEST.Catalog.byId[d.tk]; return "Collection: " + (it ? it.name : d.tk); }
  if (d.kind === "mncrate") return R.SHOP.mn[d.tk].n;
  if (d.kind === "orecrate") return R.SHOP.ore[d.tk].n;
  if (d.kind === "cfin") return "Construction: finish now";
  return { starter: "Starter Pack", founder: "Founder Pack", moonbeam: "Moonbeam", skin: "Lunar Skin", pass: "Lunar Pass", respec: "Build reset (keep all points)" }[d.kind] || "Purchase";
};
export const itemLabelOf = labelOf;
// ---------------------------------------------------------------- live rates (SOL at the live GRAM rate) ---------------------------
// The website's price labels and every SOL quote read these. Cached five minutes per isolate; a failed lookup is remembered for a
// minute and one lookup is shared by every request in flight (no upstream fan-out). CoinGecko's id for GRAM is still the-open-network.
let RATES = { ton: 0, sol: 0, t: 0, fail: 0 }, RATES_P = null;
export async function liveRates(now = Date.now()) {
  if (RATES.t && now - RATES.t < 300000) return RATES;
  if (RATES.fail && now - RATES.fail < 60000) return RATES;
  if (RATES_P) return RATES_P;
  RATES_P = (async () => {
    try { const d = await (await fetch("https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana&vs_currencies=usd")).json(); const t = Number(d["the-open-network"].usd), so = Number(d.solana.usd); if (t > 0 && so > 0) { RATES = { ton: t, sol: so, t: Date.now(), fail: 0 }; return RATES; } } catch {}
    RATES = { ...RATES, fail: Date.now() }; return RATES;
  })().finally(() => { RATES_P = null; });
  return RATES_P;
}
export const resetRates = () => { RATES = { ton: 0, sol: 0, t: 0, fail: 0 }; RATES_P = null; };
// a SOL amount for a GRAM price at the live rates, or null when the price service is down or its numbers are stale (fail closed:
// this replaces the old solValueOk, which let a SOL payment through when the rates could not be read). Rates older than 15 minutes
// are not used for a new quote.
export async function solValueOk(gram, now = Date.now()) {
  const r = await liveRates(now);
  if (!(r.ton > 0 && r.sol > 0) || !r.t || now - r.t > 900000) return null;
  const sol = gram * r.ton / r.sol;
  return sol > 0 && Number.isFinite(sol) ? { sol, ton: r.ton, solUsd: r.sol, usd: Math.round(gram * r.ton * 100) / 100 } : null;
}
// the launch liquidity fund (LP_SHARE of every verified sale, counted in US cents as the server prices it; refunds come off)
export const revAdd = (env, cents) => (cents ? dbPatch(env, "meta", { revc: { ".sv": { increment: Math.round(cents) } } }).catch(() => {}) : null);
// ---------------------------------------------------------------- the GRAM switch -------------------------------------------------
// Owner decision (Nov 26, 2026): GRAM is sold inside Telegram as well as Stars, behind a server-side switch (cfg/gramTg; absent = on)
// that the owner flips in one step with no release (the Admin screen, or /gram on | off in the bot). Telegram's Nov 17, 2026
// developer notice says digital goods inside bots and Mini Apps must be paid in Stars: the switch is the owner's answer to that risk.
export async function gramInTelegram(env, fresh = false) {
  const v = fresh ? await dbGet(env, "cfg/gramTg").catch(() => null) : (await cfg(env)).gramTg;
  return v !== 0 && v !== false && v !== "off";
}
// which rails a request may pay with: the website GRAM and SOL; Telegram Stars, and GRAM while the switch is on
export async function railsFor(env, web, fresh = false) {
  if (web) return { stars: false, gram: !!R.CRYPTO_OPEN, sol: !!R.CRYPTO_OPEN };
  return { stars: true, gram: !!R.CRYPTO_OPEN && (await gramInTelegram(env, fresh)), sol: false };
}
// ---------------------------------------------------------------- reservations and the exactly-once record ------------------------
const ordOf = (S) => { if (!S.ord || typeof S.ord !== "object" || Array.isArray(S.ord)) S.ord = {}; return S.ord; };
function sweepOrd(S, now) { const o = ordOf(S); for (const [k, v] of Object.entries(o)) if (!v || !(Number(v.e) > now - 60000)) delete o[k]; return o; }   // a minute's grace after the expiry
const goOf = (S) => { if (!S.go || typeof S.go !== "object" || Array.isArray(S.go)) S.go = {}; return S.go; };
function sweepGo(S, X) { const g = goOf(S); for (const [k, v] of Object.entries(g)) if (!(Number(v) >= X.day - GO_DAYS)) delete g[k]; return g; }
export const payId = (cur, id) => "p" + cur[0] + "_" + safeKey(String(id)).replace(/_/g, "").slice(-24);   // a payment's short permanent id
const needsLoadout = (k) => ["respec", "vault", "core", "gear", "box", "starter", "founder", "moonbeam", "skin", "paint", "rsleg"].includes(k);
// ---------------------------------------------------------------- quote --------------------------------------------------------------
const newOid = () => { const b = crypto.getRandomValues(new Uint8Array(8)); return [...b].map((x) => "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]).join("") + Date.now().toString(36).slice(-2); };
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes) { let d = [0]; for (const by of bytes) { let c = by; for (let i = 0; i < d.length; i++) { c += d[i] << 8; d[i] = c % 58; c = (c / 58) | 0; } while (c) { d.push(c % 58); c = (c / 58) | 0; } } let out = ""; for (const by of bytes) { if (by === 0) out += "1"; else break; } for (let i = d.length - 1; i >= 0; i--) out += B58[d[i]]; return out; }
const orderPath = (pid, oid) => `orders/${pid}/${oid}`;
// what the phone sees of an order (never the server's internal fields)
export function publicOrder(o, now = Date.now()) {
  if (!o) return null;
  const out = { oid: o.oid, cur: o.cur, item: o.item, d: o.dp || null, st: o.st, amt: o.amt, base: o.base || null, t: o.t, e: o.e, open: o.st === "open" && o.e > now, price: o.price };
  if (o.cur === "TON") { out.to = TON_RECIPIENT; out.memo = o.memo; out.usd = o.usd || null; }
  if (o.cur === "SOL") { out.to = SOL_RECIPIENT; out.ref = o.ref; out.usd = o.usd || null; }
  if (o.cur === "STARS") out.link = o.link || null;
  if (o.tx) out.tx = o.tx;
  if (o.out) out.out = o.out;
  if (o.err) out.err = o.err;
  if (o.gt) out.gt = o.gt;
  return out;
}
const dpOf = (d) => { const o = { kind: d.kind }; for (const k of ["tk", "ri", "id", "c", "deal", "job"]) if (d[k] !== undefined && d[k] !== null) o[k] = d[k]; return o; };   // the goods as the phone named them
// a quote: every sale rule on the server's records, the price frozen, one open quote per item. cur: 'STARS' | 'TON' | 'SOL'
export async function quote(env, a, cur, raw, now = Date.now()) {
  const web = !!a.web, pid = a.pid;
  if (!["STARS", "TON", "SOL"].includes(cur)) return { status: 400, body: { error: "cur" } };
  const rails = await railsFor(env, web, cur === "TON");
  if (cur === "STARS" && !rails.stars) return { status: 403, body: { error: "stars_tg", msg: "Stars are paid in Telegram." } };
  if (cur === "TON" && !rails.gram) return { status: 403, body: { error: web || !R.CRYPTO_OPEN ? "closed" : "gram_off", msg: web || !R.CRYPTO_OPEN ? "GRAM checkout is not open." : "GRAM is not available in Telegram right now. Pay with Stars, or with GRAM on the website." } };
  if (cur === "SOL" && !rails.sol) return { status: 403, body: { error: web ? "closed" : "sol_web", msg: "SOL is paid on the website." } };
  let d = descOf(raw);
  if (!d) return { status: 400, body: { error: "item" } };
  if (d.kind === "pass" && raw && raw.tk && !/^\d{1,3}$/.test(String(raw.tk))) return { status: 400, body: { error: "item" } };
  d = await serverDesc(env, pid, d, now);
  let rate = null;
  if (cur === "SOL") { rate = await solValueOk(1, now); if (!rate) return { status: 503, body: { error: "pending", msg: "SOL prices are loading. Try again in a minute." } }; }   // fail closed: no live rates, no SOL quote
  const oid = newOid();
  let reuse = null, err = null, price = null, rk = null, superseded = [];
  const t = await tx(env, pid, (S, X) => {
    reuse = null; err = null; superseded = [];
    const o = sweepOrd(S, now), why = R.ecoSaleErr(S, d, X);
    if (why) { err = why; return { abort: true }; }
    price = R.ecoPrice(S, d, X);
    if (!price) { err = "item"; return { abort: true }; }
    if (d.deal && price.deal !== d.deal) { err = "deal_used"; return { abort: true }; }
    if (price.deal) { const dv = o[safeKey("deal:" + price.deal)]; if (dv && !rksOf(d, X, null).every((k) => o[k] && o[k].q === dv.q)) price = R.ecoPrice(S, { ...d, deal: null }, X); }   // the deal is held by another open quote: this one is priced without it
    rk = rksOf(d, X, price);
    const held = [...new Set(rk.map((k) => o[k]).filter(Boolean).map((v) => v.q))];
    if (held.length === 1 && rk.every((k) => o[k] && o[k].q === held[0]) && o[rk[0]].c === cur[0]) { reuse = held[0]; return { abort: true }; }   // the same item, same rail, still open: that quote again
    for (const q of held) { const v = Object.values(o).find((x) => x.q === q); if (v && v.c !== "S") { err = "open_order"; reuse = q; return { abort: true }; } }   // a GRAM or SOL payment may be on its way: finish or cancel it first
    for (const q of held) { superseded.push(q); for (const [k, v] of Object.entries(o)) if (v.q === q) delete o[k]; }   // an unpaid Stars invoice: replaced (its pre-checkout now refuses it)
    for (const k of rk) o[k] = { q: oid, c: cur[0], e: now + QUOTE_MS };
    return {};
  }, now);
  if (err === "open_order") { const open = await dbGet(env, orderPath(pid, reuse)).catch(() => null); return { status: 409, body: { error: "open_order", order: publicOrder(open, now), msg: "You have an open " + (open && open.cur === "SOL" ? "SOL" : "GRAM") + " payment for this item. Finish it, or cancel it first." } }; }
  if (err) return { status: err === "item" ? 400 : 409, body: { error: err } };
  if (reuse) { const o = await dbGet(env, orderPath(pid, reuse)).catch(() => null); if (o && o.st === "open") return { status: 200, body: { ok: true, reused: true, order: publicOrder(o, now) } }; }
  for (const q of superseded) await dbPatch(env, orderPath(pid, q), { st: "cancelled", cx: now }).catch(() => {});
  const S = t.S, item = labelOf(d), rec = { v: 1, oid, pid, cur, sf: web ? "web" : "tg", d, dp: dpOf(d), rk, price, item, t: now, e: now + QUOTE_MS, st: "open", name: cleanName(a.user || {}) };
  if (cur === "TON") { rec.amt = price.ton; rec.base = String(Math.round(price.ton * 1e9)); rec.memo = "LWM|" + pid + "|" + oid; const r0 = await liveRates(now); if (r0.ton > 0) { rec.rate = { ton: r0.ton }; rec.usd = Math.round(price.ton * r0.ton * 100) / 100; } }   // the dollar figure at the live GRAM rate, shown beside the amount (as for SOL)
  if (cur === "SOL") {
    const sol = { sol: price.ton * rate.sol, ton: rate.ton, solUsd: rate.solUsd, usd: Math.round(price.ton * rate.ton * 100) / 100 }, lam0 = Math.floor((sol.sol * 1e9) / 1e6) * 1e6;
    let lam = 0;
    for (let i = 0; i < 6 && !lam; i++) { const cand = lam0 + (1 + Math.floor(Math.random() * 999)) * 1e3; if ((await claimOnce(env, "solAmt/" + cand, { pid, oid, t: now })).ok) lam = cand; }   // a unique exact amount: an exact-amount send without the reference still finds its own quote
    if (!lam) { await release(env, pid, oid, now); return { status: 503, body: { error: "busy" } }; }
    rec.base = String(lam); rec.amt = Number((lam / 1e9).toFixed(6)); rec.ref = b58(crypto.getRandomValues(new Uint8Array(32))); rec.usd = sol.usd; rec.rate = { ton: sol.ton, sol: sol.solUsd };
  }
  if (cur === "STARS") {
    rec.amt = price.stars;
    const title = item.slice(0, 32), r = await tg(env, "createInvoiceLink", { title, description: ("LUNAR: War Machines · " + item).slice(0, 255), payload: JSON.stringify({ u: Number(a.user && a.user.id) || 0, q: oid }), currency: "XTR", prices: [{ label: title, amount: price.stars }] }).catch(() => null);
    if (!r || !r.ok) { await release(env, pid, oid, now); return { status: 502, body: { error: (r && r.description) || "telegram" } }; }
    rec.link = r.result;
  }
  await dbPut(env, orderPath(pid, oid), rec);
  return { status: 200, body: { ok: true, order: publicOrder(rec, now), E: pub(S) } };
}
async function release(env, pid, oid, now) { await tx(env, pid, (S) => { const o = ordOf(S); let n = 0; for (const [k, v] of Object.entries(o)) if (v && v.q === oid) { delete o[k]; n++; } return n ? {} : { abort: true }; }, now).catch(() => {}); }
// the player cancels an unpaid quote (a wallet closed, another currency picked). A payment that still lands later is judged as a late
// one: granted only if the item is still for sale to this account at that price and nothing newer holds it; otherwise kept for a refund
export async function cancelOrder(env, a, oid, now = Date.now()) {
  if (!/^[a-z0-9]{8,14}$/.test(String(oid || ""))) return { status: 400, body: { error: "order" } };
  const o = await dbGet(env, orderPath(a.pid, oid)).catch(() => null);
  if (!o || o.pid !== a.pid) return { status: 404, body: { error: "order" } };
  if (o.st !== "open") return { status: 200, body: { ok: true, order: publicOrder(o, now) } };
  await release(env, a.pid, oid, now);
  await dbPatch(env, orderPath(a.pid, oid), { st: "cancelled", cx: now });
  return { status: 200, body: { ok: true, order: publicOrder({ ...o, st: "cancelled" }, now) } };
}
// ---------------------------------------------------------------- the grant ------------------------------------------------------
// One payment for one quote, in the account CAS: exactly once by the payment's id and the quote's id (S.go). Every sale rule is asked
// again with the server's fresh numbers; nothing is granted on a stale quote (owned by now, over a limit, superseded, a higher price)
export async function grantOrder(env, pid, o, pay, now = Date.now()) {
  const d = await serverDesc(env, pid, o.d, now), pk = payId(pay.cur, pay.id), ok0 = "o_" + o.oid;
  let res = null;
  const t = await tx(env, pid, (S, X) => {
    res = null;
    const go = sweepGo(S, X), ord = sweepOrd(S, now);
    S.gout = S.gout && typeof S.gout === "object" ? S.gout : {};
    if (go[pk]) { res = { dup: true, outs: S.gout[o.oid] || [], held: o.err || null }; return { abort: true }; }   // this very payment again (a replay, a retried webhook, a second tab)
    let held = null;
    if (go[ok0]) held = "duplicate";   // the quote was already paid by another payment: this one is a second payment, kept for a refund
    const mine = (o.rk || []).every((k) => !ord[k] || ord[k].q === o.oid);
    const why = held ? null : R.ecoSaleErr(S, d, X), cur = why || held ? null : R.ecoPrice(S, d, X);
    if (!held && why) held = why;
    else if (!held && !mine) held = "superseded";
    else if (!held && (cur ? cur.ton > o.price.ton + 1e-9 || (o.cur === "STARS" && cur.stars > o.price.stars) : d.kind !== "respec")) held = "price";   // a paid build reset with nothing left to clear by now is still granted: it waits for the next reset (S.rsCr)
    let outs;
    if (held) outs = [{ none: 1, err: held }];
    else {
      const S0 = JSON.parse(JSON.stringify(S));
      try { outs = R.ecoGrant(S, { ...d, deal: o.price.deal || null, price: o.price.ton }, X); }
      catch (e) { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, S0); outs = []; held = "grant: " + String((e && e.message) || e).slice(0, 60); }   // a grant that throws never loses the paid record
      if (!outs.length) { held = held || "nothing"; outs = [{ none: 1, err: held }]; }
      if (!held && needsLoadout(d.kind) && S.L) setLoadout(S, S.L);   // the build changed: power and league follow
    }
    for (const [k, v] of Object.entries(ord)) if (v && v.q === o.oid) delete ord[k];   // the quote's reservation is spent either way
    go[pk] = X.day; if (!held) go[ok0] = X.day;
    S.gout[o.oid] = outs; const ks = Object.keys(S.gout); if (ks.length > 12) for (const k of ks.slice(0, ks.length - 12)) delete S.gout[k];
    res = { outs, held };
    return {};
  }, now);
  const outs = (res.outs || []).filter((x) => x && !x.none), held = res.held || null;
  if (!res.dup) {
    const st = held ? "held" : "paid";
    if (held === "duplicate") await dbPatch(env, orderPath(pid, o.oid) + "/dup", { [pk]: { tx: String(pay.id).slice(0, 120), t: now } });   // the quote stays paid; the second payment is listed with it (and under held/ for a refund)
    else await dbPatch(env, orderPath(pid, o.oid), { st, gt: now, tx: String(pay.id).slice(0, 120), out: outs, ...(held ? { err: held } : {}), ...(pay.src ? { src: String(pay.src).slice(0, 80) } : {}), ...(pay.amt !== undefined ? { paid: pay.amt } : {}) });
    // the admin's sales record (revenue, and every held payment for a refund)
    const usdC = o.cur === "STARS" ? (Number(pay.amt) || o.price.stars) * 1.3 : o.cur === "SOL" ? (o.usd || 0) * 100 : o.price.ton * ((o.rate && o.rate.ton) || (await liveRates(now)).ton || 0) * 100;   // cents: Stars at ~1.3 cents, GRAM at its quote-time rate
    await dbPut(env, `payments/LWM_${safeKey(pid)}_${o.oid}${held === "duplicate" ? "_" + pk : ""}`.slice(0, 160), { pid, name: o.name || "", cur: o.cur, amt: o.amt, gram: o.price.ton, usd: Math.round(usdC) / 100, item: o.item, memo: o.memo || "STARS|" + o.oid, proof: String(pay.id).slice(0, 120), verified: true, granted: !held, ...(held ? { err: held } : {}), o: outs, oid: o.oid, t: { ".sv": "timestamp" } }).catch(() => {});
    if (held) await dbPut(env, `held/${held === "duplicate" ? o.oid + "_" + pk : o.oid}`.slice(0, 120), { pid, oid: o.oid, cur: o.cur, amt: o.amt, item: o.item, err: held, tx: String(pay.id).slice(0, 120), t: now }).catch(() => {});
    else await revAdd(env, usdC);
    if (pay.src && pay.src !== "payer" && o.cur !== "STARS") {   // farms: accounts paying from one wallet are one person's
      const wh = hex(await hmac(env.BOT_TOKEN, "w|" + pay.src)).slice(0, 16), others = (await dbGet(env, `wal/${wh}`).catch(() => null)) || {};
      for (const x of Object.keys(others).slice(0, 20)) if (x !== pid) await link(env, pid, x, "wallet").catch(() => {});
      await dbPatch(env, `wal/${wh}`, { [pid]: dayOf(now) }).catch(() => {});
    }
  }
  return { st: held ? "held" : "paid", outs, held, dup: !!res.dup, E: t && t.S ? pub(t.S) : null };
}
// ---------------------------------------------------------------- GRAM and SOL on chain -------------------------------------------
// GRAM: toncenter's history of our wallet (cached 4 s per isolate, so many quotes share one lookup), paged back to the quote's time
let TONC = { t: 0, list: [] };
async function tonHistory(env, since, now) {
  if (TONC.t && now - TONC.t < 4000 && TONC.since <= since) return TONC.list;
  const key = env.TONCENTER_KEY ? { "X-API-Key": env.TONCENTER_KEY } : {}, list = [];
  let lt = "", hash = "";
  for (let page = 0; page < 3; page++) {
    const url = `https://toncenter.com/api/v2/getTransactions?address=${TON_RECIPIENT}&limit=50` + (lt ? `&lt=${lt}&hash=${encodeURIComponent(hash)}` : "");
    const d = await (await fetch(url, { headers: key })).json();
    const rows = Array.isArray(d.result) ? d.result : [];
    list.push(...rows);
    const last = rows[rows.length - 1];
    if (rows.length < 50 || !last || !last.transaction_id || (Number(last.utime) || 0) * 1000 < since - 120000) break;
    lt = last.transaction_id.lt; hash = last.transaction_id.hash;
  }
  TONC = { t: now, since, list };
  return list;
}
export async function findTon(env, o, now = Date.now()) {
  try {
    const need = BigInt(o.base);
    let short = null;
    for (const t of await tonHistory(env, o.t, now)) {
      const m = t && t.in_msg;
      if (!m || !m.source || String(m.message || "") !== o.memo) continue;   // only an incoming payment carrying this quote's memo
      let v = 0n; try { v = BigInt(String(m.value || "0")); } catch { continue; }
      if (v < need) { short = short || { short: true, got: String(v) }; continue; }   // underpaid: never granted (the wallet shows the exact amount)
      if (t.transaction_id && t.transaction_id.hash) return { id: t.transaction_id.hash, src: String(m.source), amt: Number(v) / 1e9 };
    }
    if (short) return short;
  } catch {}
  return null;
}
export const resetTonCache = () => { TONC = { t: 0, list: [] }; };
export const resetLookups = () => { TONC = { t: 0, list: [] }; LOOK.clear(); };   // tests: forget the 4 s lookup throttles
async function solRpc(method, params) {
  for (const url of SOL_RPCS) {
    try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }); const d = await r.json(); if (d && !d.error) return d.result; } catch {}
  }
  throw new Error("sol rpc");
}
// a finalized, successful transaction with a System transfer of at least the quote's lamports to our wallet
function solTransfer(tx, o, exact) {
  if (!tx || !tx.meta || tx.meta.err !== null && tx.meta.err !== undefined) return null;
  const need = Number(o.base), ins = [...((tx.transaction && tx.transaction.message && tx.transaction.message.instructions) || []), ...((tx.meta.innerInstructions || []).flatMap((x) => x.instructions || []))];
  for (const i of ins) {
    const p = i && i.parsed;
    if (!p || i.program !== "system" || p.type !== "transfer" || !p.info || p.info.destination !== SOL_RECIPIENT) continue;
    const lam = Number(p.info.lamports);
    if (exact ? lam === need : lam >= need) return { src: String(p.info.source || "payer"), amt: lam / 1e9 };
  }
  return null;
}
export async function findSol(env, o, now = Date.now()) {
  try {
    const cfgT = { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "finalized" };
    // 1) the quote's own reference key (Solana Pay; our pay page adds it to the transfer)
    const sigs = (await solRpc("getSignaturesForAddress", [o.ref, { limit: 5, commitment: "finalized" }])) || [];
    for (const sg of sigs.slice(0, 3)) { if (sg.err) continue; const t = await solRpc("getTransaction", [sg.signature, cfgT]); const hit = solTransfer(t, o, false); if (hit) return { id: sg.signature, ...hit }; }
    // 2) an exact-amount send without the reference (a wallet that can't add it): the quote's unique lamports, sent after the quote
    const recent = ((await solRpc("getSignaturesForAddress", [SOL_RECIPIENT, { limit: 25, commitment: "finalized" }])) || []).filter((sg) => !sg.err && (!sg.blockTime || sg.blockTime * 1000 >= o.t - 60000));
    for (const sg of recent.slice(0, 8)) { const t = await solRpc("getTransaction", [sg.signature, cfgT]); const hit = solTransfer(t, o, true); if (hit) return { id: sg.signature, ...hit }; }
  } catch {}
  return null;
}
// ---------------------------------------------------------------- status -------------------------------------------------------------
const LOOK = new Map();   // per isolate: a quote's chain lookup at most every 4 s
export async function orderStatus(env, a, oid, now = Date.now()) {
  if (!/^[a-z0-9]{8,14}$/.test(String(oid || ""))) return { status: 400, body: { error: "order" } };
  const o = await dbGet(env, orderPath(a.pid, oid)).catch(() => null);
  if (!o || o.pid !== a.pid) return { status: 404, body: { error: "order" } };
  if (o.st === "paid" || o.st === "held" || o.cur === "STARS") return { status: 200, body: { ok: true, order: publicOrder(o, now) } };   // Stars: the webhook grants it
  if (now - o.t > 7 * 86400000) return { status: 200, body: { ok: true, order: publicOrder(o, now) } };   // a week old and never paid: no more lookups
  const last = LOOK.get(o.oid) || 0;
  if (now - last < 4000) return { status: 200, body: { ok: true, order: publicOrder(o, now), pending: true } };
  LOOK.set(o.oid, now); if (LOOK.size > 20000) LOOK.clear();
  const hit = o.cur === "TON" ? await findTon(env, o, now) : await findSol(env, o, now);
  if (!hit) return { status: 200, body: { ok: true, order: publicOrder(o, now), pending: true } };
  if (hit.short) return { status: 200, body: { ok: true, order: publicOrder(o, now), pending: true, short: hit.got } };
  // each on-chain transaction pays for one quote, for good
  const once = await claimOnce(env, `${o.cur === "TON" ? "tonTx" : "solTx"}/${safeKey(hit.id)}`, { pid: a.pid, oid: o.oid, t: now });
  if (!once.ok && !(once.v && once.v.oid === o.oid)) return { status: 409, body: { error: "reused" } };
  const g = await grantOrder(env, a.pid, o, { cur: o.cur, id: hit.id, src: hit.src, amt: hit.amt }, now);
  const fresh = (await dbGet(env, orderPath(a.pid, oid)).catch(() => null)) || o;
  return { status: 200, body: { ok: true, order: publicOrder(fresh, now), outs: g.outs, held: g.held, ...(g.E ? { E: g.E } : {}) } };
}
// the account's orders: the open ones (resume a payment) and the recent receipts
export async function orderList(env, a, now = Date.now()) {
  const all = (await dbGet(env, `orders/${a.pid}`, { orderBy: '"t"', limitToLast: 30 }).catch(() => null)) || {};
  const list = Object.values(all).filter((o) => o && o.oid).sort((x, y) => (y.t || 0) - (x.t || 0)).map((o) => publicOrder(o, now));
  return { status: 200, body: { ok: true, orders: list } };
}
export async function orderApi(env, a, now = Date.now()) {
  const b = a.b || {}, act = String(b.a || "");
  if (act === "quote") return quote(env, a, String(b.cur || ""), b.desc, now);
  if (act === "status") return orderStatus(env, a, String(b.q || ""), now);
  if (act === "cancel") return cancelOrder(env, a, String(b.q || ""), now);
  if (act === "list") return orderList(env, a, now);
  if (act === "rails") return { status: 200, body: { ok: true, rails: await railsFor(env, !!a.web) } };
  return { status: 400, body: { error: "action" } };
}
// ---------------------------------------------------------------- Telegram Stars --------------------------------------------------
// pre-checkout (answered within Telegram's 10 seconds): the invoice's quote must be the open one for its item, the item still for sale
// to this account (not owned, inside every limit, the store open), and the invoice's total the CURRENT price (Checkpoint 39 gap 1: an
// invoice opened before another purchase moved the price, or a second one for an item now owned, can never be paid). One payment at a
// time per quote: a second pre-checkout for the same quote inside 60 s is refused (two tabs paying the one link at once)
export async function preCheckout(env, q, pid, now = Date.now()) {
  let p = {};
  try { p = JSON.parse(q.invoice_payload); } catch { return "This purchase couldn't be verified. Please try again from the game."; }
  if (q.currency !== "XTR" || Number(p.u) !== Number(q.from && q.from.id) || !/^[a-z0-9]{8,14}$/.test(String(p.q || ""))) return "This purchase couldn't be verified. Please try again from the game.";
  const path = orderPath(pid, p.q), { v: o, tag } = await readTag(env, path);
  if (!o || o.pid !== pid || o.cur !== "STARS") return "This purchase couldn't be verified. Please try again from the game.";
  if (o.st !== "open") return o.st === "paid" ? "You already bought this." : "This purchase was replaced or cancelled. Open it again from the game.";
  if (o.e < now) return "This price expired. Open the purchase again from the game.";
  if (Number(q.total_amount) !== Number(o.price.stars)) return "The price changed. Open the purchase again from the game.";
  if (o.pc && o.pc.q !== q.id && now - o.pc.t < 60000) return "This purchase is already being paid.";
  const S = await readEco(env, pid), X = ctxOf(pid, now), d = await serverDesc(env, pid, o.d, now);
  const why = R.ecoSaleErr(S, d, X);
  if (why) return why === "owned" ? "You already have this." : why === "limit" ? "You reached this item's limit for now." : why === "cap" ? "Your wall extensions are at the +50% cap." : why === "none" ? "That timer already finished." : "This item is not for sale right now.";
  const cur = R.ecoPrice(S, d, X), timed = d.kind === "cfin" || d.kind === "rsfin";   // a finish's price falls as its timer runs: the quote holds it (never more than quoted)
  if (!cur || (timed ? cur.stars > Number(o.price.stars) : cur.stars !== Number(o.price.stars))) return "The price changed. Open the purchase again from the game.";
  const ord = S.ord && typeof S.ord === "object" ? S.ord : {};
  if (!(o.rk || []).every((k) => ord[k] && ord[k].q === o.oid)) return "This purchase was replaced. Open it again from the game.";
  if (!(await writeIf(env, path, { ...o, pc: { q: String(q.id).slice(0, 64), t: now } }, tag))) return "This purchase is already being paid.";
  return null;
}
// a paid Stars invoice (Telegram's successful_payment): granted once; the receipt also kept under starsPaid/ for refunds
export async function starsPaid(env, m, pid, now = Date.now()) {
  const sp = m.successful_payment, charge = safeKey(sp.telegram_payment_charge_id);
  let p = {};
  try { p = JSON.parse(sp.invoice_payload); } catch {}
  const o = /^[a-z0-9]{8,14}$/.test(String(p.q || "")) ? await dbGet(env, orderPath(pid, p.q)).catch(() => null) : null;
  if (!o || o.pid !== pid || o.cur !== "STARS") {   // no quote of ours (should not happen): logged for the owner with nothing granted
    await dbPut(env, `held/st_${charge}`.slice(0, 120), { pid, cur: "STARS", amt: sp.total_amount, item: "unknown", err: "no quote", tx: charge, t: now }).catch(() => {});
    return { outs: [], held: "no quote" };
  }
  const g = await grantOrder(env, pid, o, { cur: "STARS", id: charge, amt: sp.total_amount }, now);
  if (!g.dup) await dbPut(env, `starsPaid/${pid}/${charge}`, { k: o.d.kind, t: o.d.tk || o.d.id || null, r: o.d.ri ?? null, g: o.price.ton, x: o.price.deal || null, c: o.d.c || null, q: o.oid, stars: sp.total_amount, n: o.oid, o: g.outs, ...(g.held ? { err: g.held } : {}), ts: { ".sv": "timestamp" } });
  return g;
}
// a Stars refund: take back exactly what that purchase gave (once)
export async function starsRefund(env, m, pid, now = Date.now()) {
  const rp = m.refunded_payment, charge = safeKey(rp.telegram_payment_charge_id);
  const sp = await dbGet(env, `starsPaid/${pid}/${charge}`).catch(() => null);
  if (!sp || sp.rf) return 0;
  let n = 0;
  await tx(env, pid, (S) => {
    S.rfd = Array.isArray(S.rfd) ? S.rfd : [];
    if (S.rfd.includes(charge)) return { abort: true };
    S.rfd = S.rfd.concat(charge).slice(-40);
    if (!sp.err) R.ecoRefund(S, sp.k, sp.o || []);   // a held payment granted nothing: nothing to take back
    if (needsLoadout(sp.k) && S.L) setLoadout(S, S.L);
    S.spendGram = Math.max(0, (S.spendGram || 0) - (sp.err ? 0 : Number(sp.g) || 0));
    n = S.rfd.length;
    return {};
  }, now);
  // a granted payment refunded: its order shows refunded; a held one (nothing was granted, e.g. a second payment of a paid quote) is
  // marked on its own records only, never on the order another payment paid
  const pk = payId("STARS", charge), own = sp.q && !sp.err ? { [`orders/${pid}/${sp.q}/st`]: "refunded", [`orders/${pid}/${sp.q}/rf`]: now, [`payments/LWM_${safeKey(pid)}_${sp.q}/refunded`]: true } : sp.q ? { [`payments/LWM_${safeKey(pid)}_${sp.q}${sp.err === "duplicate" ? "_" + pk : ""}`.slice(0, 160) + "/refunded"]: true } : {};
  await dbPatch(env, "", { [`starsPaid/${pid}/${charge}/rf`]: now, ...own });
  if (!sp.err) await revAdd(env, -(Number(sp.stars) || 0) * 1.3);
  return n;
}
