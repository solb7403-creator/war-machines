// Telegram webhook: approves Stars checkouts, logs completed payments, answers /start.
import type { Config } from "@netlify/functions"
import { PLAY_URL, dbPut, env, itemLabel, starsPerTon, tg } from "../../lib/shared.mts"

export default async (req: Request) => {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== env("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 })
  let u: any
  try { u = await req.json() } catch { return new Response("ok") }

  // 1) must answer within 10s or the payment is cancelled
  if (u.pre_checkout_query) {
    const q = u.pre_checkout_query
    let ok = q.currency === "XTR"
    try { const p = JSON.parse(q.invoice_payload); ok = ok && p.u === q.from.id } catch { ok = false }
    await tg("answerPreCheckoutQuery", ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: "This purchase couldn't be verified. Please try again from the game." })
    return new Response("ok")
  }

  const m = u.message
  // 2) successful payment: record it (this is the source of truth for Stars spend)
  if (m?.successful_payment) {
    const sp = m.successful_payment
    let p: any = {}
    try { p = JSON.parse(sp.invoice_payload) } catch {}
    const pid = "tg_" + m.from.id
    const charge = String(sp.telegram_payment_charge_id)
    const safe = charge.replace(/[.#$\[\]\/]/g, "_")
    const item = itemLabel(p.k, p.t, p.r)
    const rec = { pid, name: (m.from.username || m.from.first_name || "").slice(0, 20), cur: "STARS", amt: sp.total_amount, gram: p.g || sp.total_amount / starsPerTon(), usd: Math.round(sp.total_amount * 0.013 * 100) / 100, item, memo: "STARS|" + safe, proof: charge, t: { ".sv": "timestamp" } }
    await dbPut(`payments/LWM_${pid}_stars_${safe}`.slice(0, 120), rec)
    await dbPut(`starsPaid/${pid}/${safe}`, { k: p.k, t: p.t || null, r: p.r ?? null, g: p.g || 0, stars: sp.total_amount, n: p.n || "", granted: false, ts: { ".sv": "timestamp" } })
    return new Response("ok")
  }

  // 3) /start: send the Play button
  if (m?.text && /^\/start/.test(m.text)) {
    await tg("sendMessage", {
      chat_id: m.chat.id,
      text: "☾ LUNAR: War Machines\n\nBattle robot tanks in real-time PvP arenas, upgrade your machine and climb the ranks. The top 1,000 players get a guaranteed $LUNAR allocation.",
      reply_markup: { inline_keyboard: [[{ text: "⚔ PLAY", web_app: { url: "https://solb7403-creator.github.io/war-machines/" } }], [{ text: "📖 Wiki", url: "https://solb7403-creator.github.io/war-machines/wiki.html" }]] },
    })
  }
  return new Response("ok")
}

export const config: Config = { path: "/api/tg-webhook", method: "POST" }
