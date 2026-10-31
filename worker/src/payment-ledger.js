import {dbUrl,dbPut} from "./db.js";
import {tx} from "./eco.js";
import {RULES} from "./sim.gen.js";
const PAINT_NAMES={ nebula: "Nebula", ember: "Ember", arctic: "Arctic", venom: "Venom", gold: "Gold Plate", void: "Void" };
export function itemLabel(k, tk, ri) {
  if (k === "box") return ["Common", "Rare", "Epic"][ri ?? 0] + " " + (tk === "weapon" ? "Weapon Cache" : tk === "chassis" ? "Chassis Crate" : "Gem Cache");
  if (k === "paint") return "Paint: " + (PAINT_NAMES[tk] || "Paint");
  if (k === "pass") return "Lunar Pass" + (tk ? ", season " + tk : "");
  if (k === "vault") return "Hyperspace Vault: " + ((RULES.VAULT[tk] || {}).n || "Gold");
  return k === "moonbeam" ? "Moonbeam" : k === "skin" ? "Lunar Skin" : k === "starter" ? "Starter Pack" : k === "founder" ? "Founder Pack" : k === "respec" ? "Build reset (keep all points)" : "Purchase";
}

// The total and its durable event marker commit together. Retries cannot count a sale/refund twice.
export async function revAdd(env, cents, event) {
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
export function paymentPending(S, type, id, name) {
  S.paymentPending = S.paymentPending || {};
  const key = type + "_" + id;
  S.paymentSeq = (S.paymentSeq || 0) + 1;
  S.paymentPending[key] = { type, id, name: name || "Pilot", v: S.paymentSeq };
}
export async function projectStars(env, pid, charge, receipt, name) {
  await paymentProjection(env, `payments/LWM_${pid}_stars_${charge}`.slice(0, 120), { pid, name, cur: "STARS", amt: receipt.stars || 0, gram: receipt.g || 0, usd: Math.round((receipt.stars || 0) * 1.3) / 100, item: itemLabel(receipt.k, receipt.t, receipt.r), memo: "STARS|" + (receipt.n || ""), proof: charge, verified: !receipt.rf && !receipt.held && !receipt.unmatched, ...(receipt.held ? { held: receipt.held } : {}), ...(receipt.rf ? { refunded: true } : {}), t: receipt.ts || receipt.rf });
  if (!receipt.unmatched) {
    if (receipt.journal) await revAdd(env, (receipt.stars || 0) * 1.3, "stars_sale_" + pid + "_" + charge);
    if (receipt.rf && (receipt.journal || receipt.refundJournal)) await revAdd(env, -(receipt.stars || 0) * 1.3, "stars_refund_" + pid + "_" + charge);
  }
  await paymentProjection(env, `starsPaid/${pid}/${charge}`, receipt);
}
export async function reconcilePayments(env, pid, S, now = Date.now()) {
  // Reserve room for authentication, sync, refund projections and cleanup inside
  // the Workers Free subrequest budget. Each completed receipt advances durably.
  for (const [key, pending] of Object.entries(S.paymentPending || {}).filter(([,p])=>p.type==='stars'?S.starReceipts?.[p.id]:S.chainReceipts?.[p.id]).slice(0, 2)) {
    const receipt = pending.type === "stars" ? S.starReceipts && S.starReceipts[pending.id] : S.chainReceipts && S.chainReceipts[pending.id];
    if (!receipt) continue;
    if (pending.type === "stars") await projectStars(env, pid, pending.id, receipt, pending.name);
    else {
      await paymentProjection(env, `payments/LWM_${pending.id}`, receipt);
      await revAdd(env, receipt.revc, receipt.revEvent);
      if(receipt.refunded)await revAdd(env,-receipt.revc,receipt.revEvent+"_refund");
    }
    await tx(env, pid, current => {
      if (current.paymentPending && current.paymentPending[key] && current.paymentPending[key].v === pending.v) delete current.paymentPending[key];
      return {};
    }, now);
  }
}
