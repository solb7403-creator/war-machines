// One-time: points the bot's webhook at this site. Call /api/setup-webhook?key=<WEBHOOK_SECRET>
import type { Config, Context } from "@netlify/functions"
import { env, tg } from "../../lib/shared.mts"

export default async (req: Request, context: Context) => {
  const key = new URL(req.url).searchParams.get("key")
  if (!key || key !== env("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 })
  const url = `${context.site.url}/api/tg-webhook`
  const r = await tg("setWebhook", { url, secret_token: env("WEBHOOK_SECRET"), allowed_updates: ["message", "pre_checkout_query"], drop_pending_updates: false })
  const me = await tg("getMe", {})
  return Response.json({ webhook: r, bot: me.result?.username, url })
}

export const config: Config = { path: "/api/setup-webhook" }
