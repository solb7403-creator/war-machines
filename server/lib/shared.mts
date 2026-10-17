// shared helpers for the LUNAR Stars backend
import { createHmac } from "node:crypto"

export const GAME_ORIGIN = "https://solb7403-creator.github.io"
export const DB_URL = "https://warmachines-a6034-default-rtdb.firebaseio.com"
export const PLAY_URL = "https://t.me/LunarWarMachinesBot/play"

export const env = (k: string) => Netlify.env.get(k) || ""

export function cors(res: Response): Response {
  res.headers.set("Access-Control-Allow-Origin", GAME_ORIGIN)
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.headers.set("Access-Control-Allow-Headers", "Content-Type")
  res.headers.set("Vary", "Origin")
  return res
}

export async function tg(method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${env("BOT_TOKEN")}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return r.json() as Promise<{ ok: boolean; result?: any; description?: string }>
}

// Telegram Mini App initData check (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
export function verifyInitData(initData: string, maxAgeSec = 86400): { id: number; username?: string; first_name?: string } | null {
  if (!initData) return null
  const p = new URLSearchParams(initData)
  const hash = p.get("hash")
  if (!hash) return null
  p.delete("hash")
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join("\n")
  const secret = createHmac("sha256", "WebAppData").update(env("BOT_TOKEN")).digest()
  const calc = createHmac("sha256", secret).update(dcs).digest("hex")
  if (calc !== hash) return null
  const authDate = Number(p.get("auth_date") || 0)
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null
  try { return JSON.parse(p.get("user") || "null") } catch { return null }
}

export async function dbPut(path: string, value: unknown) {
  const r = await fetch(`${DB_URL}/${path}.json?auth=${env("FIREBASE_DB_SECRET")}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  })
  return r.ok
}

// Item catalog: base prices in TON. Stars price = TON price x STARS_PER_TON.
export const BOX_BASE = [1, 4, 15]
export const PREMIUM: Record<string, number> = { moonbeam: 50, skin: 30 }
export const starsPerTon = () => Number(env("STARS_PER_TON") || 100)

export function itemLabel(k: string, tk?: string, ri?: number) {
  if (k === "box") return ["Common", "Rare", "Epic"][ri ?? 0] + " " + (tk === "weapon" ? "Weapon Cache" : tk === "chassis" ? "Chassis Crate" : "Gem Cache")
  return k === "moonbeam" ? "Moonbeam" : k === "skin" ? "Lunar Skin" : "Purchase"
}
