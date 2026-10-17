// Creates a Telegram Stars invoice link for a verified player and item.
import type { Config } from "@netlify/functions"
import { BOX_BASE, PREMIUM, cors, itemLabel, starsPerTon, tg, verifyInitData } from "../../lib/shared.mts"

export default async (req: Request) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }))
  if (req.method !== "POST") return cors(new Response("method", { status: 405 }))
  let b: any
  try { b = await req.json() } catch { return cors(Response.json({ error: "bad json" }, { status: 400 })) }

  const user = verifyInitData(String(b.initData || ""))
  if (!user) return cors(Response.json({ error: "not verified" }, { status: 401 }))

  const k = String(b.kind || "")
  const tk = String(b.tk || "")
  const ri = Number(b.ri ?? 0)
  let base = 0
  if (k === "box") {
    if (!["gem", "weapon", "chassis"].includes(tk) || ![0, 1, 2].includes(ri)) return cors(Response.json({ error: "item" }, { status: 400 }))
    base = BOX_BASE[ri]
  } else if (PREMIUM[k]) base = PREMIUM[k]
  else return cors(Response.json({ error: "item" }, { status: 400 }))

  // client sends its escalated price; never accept below base or absurdly above it
  let price = Number(b.price || base)
  if (!(price >= base)) price = base
  if (price > base * 10) price = base * 10
  const stars = Math.max(1, Math.round(price * starsPerTon()))

  const nonce = Math.random().toString(36).slice(2, 8)
  // payload max 128 bytes
  const payload = JSON.stringify({ u: user.id, k, t: tk || undefined, r: k === "box" ? ri : undefined, g: price, n: nonce })
  const label = itemLabel(k, tk, ri)
  const r = await tg("createInvoiceLink", {
    title: label,
    description: `LUNAR: War Machines · ${label}`,
    payload,
    currency: "XTR",
    prices: [{ label, amount: stars }],
  })
  if (!r.ok) return cors(Response.json({ error: r.description || "telegram" }, { status: 502 }))
  return cors(Response.json({ link: r.result, stars, nonce }))
}

export const config: Config = { path: "/api/stars-invoice", method: ["POST", "OPTIONS"] }
