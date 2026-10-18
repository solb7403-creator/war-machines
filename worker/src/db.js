// Shared server helpers: Firebase Realtime Database over REST (with the database secret, which bypasses the
// locked rules), HMAC, names, and the points rules every credit follows.
export const DB_URL = "https://warmachines-a6034-default-rtdb.firebaseio.com";
export const DAILY_CAP = 20000;          // max points a player can bank per UTC day
export const BUCKET_MAX = 12000;         // short-term burst allowance (big claims like squad milestones)
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

// ---- live-match results: the server credits these itself (the phone never claims them) ----
// calc(rec) gets the player's record and returns {pts, pvs, won, drawn}; the credit respects the daily cap.
// Only the fields this changes are written, so a sync running at the same time keeps its own changes.
export async function creditMatch(env, pid, name, calc, now = Date.now()) {
  const rec = (await dbGet(env, `players/${pid}`)) || null;
  const d = dayOf(now), w = weekOf(now);
  const r = rec ? { ...rec } : { pts: 0, dailyPts: 0, weeklyPts: 0, d, w, days: 0, sk: 0, t: now, al: BUCKET_MAX, fd: d };
  if (r.d !== d) { r.d = d; r.dailyPts = 0; }
  if (r.w !== w) { r.w = w; r.weeklyPts = 0; }
  const c = calc(r);
  const pts = Math.max(0, Math.round(c.pts || 0));
  const credit = Math.max(0, Math.min(pts, DAILY_CAP - (r.dailyPts || 0)));
  r.pts = (r.pts || 0) + credit;
  r.dailyPts = (r.dailyPts || 0) + credit;
  r.weeklyPts = (r.weeklyPts || 0) + credit;
  if (credit > 0 && r.ld !== d) { r.sk = r.ld === d - 1 ? (r.sk || 0) + 1 : 1; r.days = (r.days || 0) + 1; r.ld = d; }
  r.name = name || r.name || "Pilot";
  const P = `players/${pid}`;
  const up = {};
  if (!rec) { up[P] = { ...r, pvm: 1, pvw: c.won ? 1 : 0, pvd: c.drawn ? 1 : 0, pvl: !c.won && !c.drawn ? 1 : 0, pvs: c.pvs, seen: now }; up["meta/n"] = { ".sv": { increment: 1 } }; }
  else {
    for (const k of ["pts", "dailyPts", "weeklyPts", "d", "w", "days", "sk", "ld", "name"]) if (r[k] !== undefined) up[`${P}/${k}`] = r[k];
    up[`${P}/pvm`] = (rec.pvm || 0) + 1;
    up[`${P}/${c.won ? "pvw" : c.drawn ? "pvd" : "pvl"}`] = (rec[c.won ? "pvw" : c.drawn ? "pvd" : "pvl"] || 0) + 1;
    up[`${P}/pvs`] = c.pvs;
    up[`${P}/seen`] = now;
  }
  if (credit > 0) {
    up[`dly/${d}/${pid}`] = { s: r.dailyPts, n: r.name };
    up[`wly/${w}/${pid}`] = { s: r.weeklyPts, n: r.name };
  }
  const ok = await dbPatch(env, "", up);
  if (!ok) throw new Error("credit write failed");
  return { pts, awarded: credit, capped: credit < pts, pvs: c.pvs, sb: c.sb || 0 };
}
