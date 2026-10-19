// Shared server helpers: Firebase Realtime Database over REST (with the database secret, which bypasses the
// locked rules), HMAC and names.
export const DB_URL = "https://warmachines-a6034-default-rtdb.firebaseio.com";
export const DAILY_CAP = 20000;          // max points a player can bank per UTC day
export const DAY_MS = 86400000;
export const dayOf = (ms) => Math.floor(ms / DAY_MS);
export const weekOf = (ms) => Math.floor((ms - 4 * DAY_MS) / (7 * DAY_MS)); // weeks start Monday 00:00 UTC

export const enc = new TextEncoder();
export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", typeof key === "string" ? enc.encode(key) : key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}

export function dbUrl(env, path, q) {
  const qs = Object.entries(q || {}).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `${DB_URL}/${path}.json?auth=${env.FIREBASE_DB_SECRET}${qs ? "&" + qs : ""}`;
}
export async function dbGet(env, path, q) {
  const r = await fetch(dbUrl(env, path, q));
  if (!r.ok) throw new Error("db get " + path + " " + r.status);
  return r.json();
}
export async function dbPut(env, path, value) {
  const r = await fetch(dbUrl(env, path), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  return r.ok;
}
export async function dbPatch(env, path, value) {
  const r = await fetch(dbUrl(env, path), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
  return r.ok;
}
export async function dbDel(env, path) {
  const r = await fetch(dbUrl(env, path), { method: "DELETE" });
  return r.ok;
}
export const cleanName = (u) => {
  let n = String((u && (u.username || [u.first_name, u.last_name].filter(Boolean).join(" "))) || "").trim();
  n = n.replace(/[^\w .\-]/g, "").slice(0, 16);
  return n || "Pilot-" + String((u && u.id) || "").slice(-4);
};
// live-match results and every other point: eco.js (creditMatch, tx)
