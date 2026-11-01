// LUNAR accounts: call sign + password (the main way in), plus account settings, recovery, Google sign-in, the
// signup anti-farm gate and the signup funnel. Passkeys and Telegram stay as alternatives (lunar-identity.js,
// web-auth.js). Nothing here trusts a name, id or balance from the browser.
//
// Database:
//   csk/<key>          {p: pid, n: call sign as typed, t, until?}   the uniqueness index (key = lowercase, hex). `until`: a
//                      released name, held for its old owner until then (rename, deleted account)
//   cs/<pid>           {n, k, t: first chosen, c: changes}          a pilot's call sign (every kind of account)
//   lunarAccounts/<pid> {..., type: 'password'|'passkey'|'google', pw: {v,it,s,h}, email: {a, v}, google: sub}
//   googleLinks/<sub>  pid
//   lf/<key>, lfi/<iphash>   failed-login counters (lockout), sgn/<day>/...  signups per network/device per day
//   fn/<day>/<step>    signup funnel counters (no personal data)
import { dbGet, dbPatch, dbPut, dbDel, cleanName, dayOf, hex } from "./db.js";
import { claimOnce, readTag, writeIf, addFlags, link, ipHash, readEco } from "./eco.js";
import { record, getCookie, sameOrigin, origin, json, cookie, random, webIdentity, newSession, endSessions, sessionCookie, ttlOf, WEB_LOGIN_COOKIE, ACCOUNT_TYPES } from "./web-auth.js";
import { CS_RE, csKey, csProblem, csFrom, csIdeas, pwProblem, pwHash, pwCheck, deriveLocal, b64, unb64, OWNER_HANDLE } from "./callsign.js";

const DAY = 86400000, HOLD = 30 * DAY, RENAME_WINDOW = 7 * DAY;
const PID_RE = /^(?:ln_[0-9]{12,15}|tg_[0-9]{3,15})$/;
const bad = (error, status = 400, extra = {}) => json({ error, ...extra }, status);
const newPilotID = () => { const raw = crypto.getRandomValues(new Uint8Array(7)); return "ln_" + (Number(BigInt("0x" + hex(raw)) % 8000000000000n) + 1000000000000); };
const ipOf = (req) => req.headers.get("CF-Connecting-IP") || "";
async function body(req) { const t = await req.text(); if (t.length > 8000) throw Error("big"); return t ? JSON.parse(t) : {}; }
// a small per-instance limiter for cheap public calls (typing checks, page counters)
const RL = new Map();
function soft(req, name, max) {
  const k = name + "|" + (ipOf(req) || "anon"), m = Math.floor(Date.now() / 60000);
  let v = RL.get(k); if (!v || v.m !== m) { v = { m, n: 0 }; RL.set(k, v); if (RL.size > 20000) RL.clear(); }
  return ++v.n > max;
}
// password work runs in a Durable Object (larger CPU budget than a request); falls back to running here
export const kdfOf = (env) => async (pw, salt, it, len) => {
  try {
    if (env.SESSIONS) {
      const r = await env.SESSIONS.get(env.SESSIONS.idFromName("kdf-" + Math.floor(Math.random() * 16))).fetch("https://session/kdf", { method: "POST", body: JSON.stringify({ pw, s: b64(salt), it, len }) });
      if (r.ok) { const j = await r.json(); if (typeof j.h === "string") return unb64(j.h); }
    }
  } catch {}
  return deriveLocal(pw, salt, it, len);
};
const userOf = (pid, cs, extra = {}) => ({ id: Number(pid.slice(3)), first_name: cs, username: cs, callsign: cs, web_auth: true, lunar_account: true, ...extra });

// ---- funnel: landing visits, signup views, accounts made, first match, day-2 return (per UTC day) ----
export const FUNNEL = ["land", "view", "made", "first", "ret2"];
export async function funnel(env, step, now = Date.now()) {
  if (!FUNNEL.includes(step)) return;
  await dbPatch(env, "", { [`fn/${dayOf(now)}/${step}`]: { ".sv": { increment: 1 } } }).catch(() => {});
}
export async function funnelDays(env, n = 7, now = Date.now()) {
  const d = dayOf(now), out = [];
  const rows = (await dbGet(env, "fn", { orderBy: '"$key"', startAt: JSON.stringify(String(d - n + 1)) }).catch(() => null)) || {};
  for (let i = 0; i < n; i++) { const r = rows[d - i] || {}; out.push({ day: d - i, ...Object.fromEntries(FUNNEL.map((k) => [k, r[k] || 0])) }); }
  return out;
}

// ---- call signs ----
export const csOf = async (env, pid) => { const v = await dbGet(env, `cs/${pid}`).catch(() => null); return v && typeof v.n === "string" && CS_RE.test(v.n) ? v : null; };
const heldFor = (v, pid, now) => v && v.p !== pid && !(v.until && v.until < now);
export async function csAvailable(env, cs, pid = "", now = Date.now()) { return !heldFor(await dbGet(env, `csk/${csKey(cs)}`).catch(() => null), pid, now); }
async function ideas(env, cs, now) {
  const out = [];
  for (const s of csIdeas(cs, 8)) { if (out.length >= 3) break; if (await csAvailable(env, s, "", now)) out.push(s); }
  return out;
}
// the owner may use their own handle (their verified Telegram username); everyone else gets "reserved"
const ownerOk = (user) => String(user?.tgUsername || (user && !user.lunar_account ? user.username : "") || "").toLowerCase() === OWNER_HANDLE;
async function csCheck(env, cs, pid, user, now) {
  const p = csProblem(cs, { ownerOk: ownerOk(user) });
  if (p) return { ok: true, available: false, reason: p.code, msg: p.msg, ideas: p.code === "reserved" || p.code === "blocked" ? await ideas(env, "Pilot", now) : [] };
  if (await csAvailable(env, cs, pid, now)) return { ok: true, available: true };
  return { ok: true, available: false, reason: "taken", msg: "That call sign is taken.", ideas: await ideas(env, cs, now) };
}
// claim a call sign for pid (atomic on the index). {ok} or {ok:false, error, msg, ideas}
export async function claimKey(env, cs, pid, now) {
  const path = `csk/${csKey(cs)}`;
  for (let i = 0; i < 4; i++) {
    const { v, tag } = await readTag(env, path);
    if (heldFor(v, pid, now)) return false;
    if (v && v.p === pid && v.n === cs && !v.until) return true;
    if (await writeIf(env, path, { p: pid, n: cs, t: now }, tag)) return true;
  }
  return false;
}
export async function csSet(env, pid, cs, user = null, now = Date.now(), { first = false } = {}) {
  const p = csProblem(cs, { ownerOk: ownerOk(user) });
  if (p) return { ok: false, error: p.code, msg: p.msg };
  const prev = first ? null : await csOf(env, pid);
  if (prev && prev.n === cs) return { ok: true, cs, same: true };
  const sameKey = prev && prev.k === csKey(cs);   // only the capitals changed: still the same name
  if (prev && !sameKey && ((prev.c | 0) >= 1 || now - (prev.t || 0) > RENAME_WINDOW))
    return { ok: false, error: "locked", msg: "Call signs can be changed once, in the first 7 days. Yours is locked now." };
  if (!(await claimKey(env, cs, pid, now))) return { ok: false, error: "taken", msg: "That call sign is taken.", ideas: await ideas(env, cs, now) };
  const up = { [`cs/${pid}`]: { n: cs, k: csKey(cs), t: prev ? prev.t || now : now, c: prev ? (prev.c | 0) + (sameKey ? 0 : 1) : 0 } };
  // the old name stays held for its owner for 30 days, so nobody can impersonate them right after a change
  if (prev && !sameKey) up[`csk/${prev.k}/until`] = now + HOLD;
  if (await dbGet(env, `lunarAccounts/${pid}/id`).catch(() => null)) up[`lunarAccounts/${pid}/name`] = cs;
  await dbPatch(env, "", up);
  return { ok: true, cs, changed: !!prev };
}
function csInfo(v, now = Date.now()) {
  if (!v) return { cs: null, canChange: true };
  const canChange = (v.c | 0) < 1 && now - (v.t || 0) <= RENAME_WINDOW;
  return { cs: v.n, canChange, changeUntil: canChange ? (v.t || now) + RENAME_WINDOW : null };
}

// ---- failed logins: back off per call sign and per network ----
const LOCK_AFTER = 5, IP_MAX = 40, IP_WIN = 15 * 60000;
const lockMs = (n) => Math.min(30 * 60000, 30000 * 2 ** Math.max(0, n - LOCK_AFTER));
async function lockState(env, key, iph, now) {
  const [a, b] = await Promise.all([dbGet(env, `lf/${key}`).catch(() => null), iph ? dbGet(env, `lfi/${iph}`).catch(() => null) : null]);
  if (a && a.until > now) return Math.ceil((a.until - now) / 60000);
  if (b && now - (b.w || 0) < IP_WIN && (b.n | 0) >= IP_MAX) return Math.ceil((b.w + IP_WIN - now) / 60000);
  return 0;
}
async function failLogin(env, key, iph, now) {
  const [a, b] = await Promise.all([dbGet(env, `lf/${key}`).catch(() => null), iph ? dbGet(env, `lfi/${iph}`).catch(() => null) : null]);
  const n = (a && now - (a.t || 0) < DAY ? a.n | 0 : 0) + 1, up = { [`lf/${key}`]: { n, t: now, until: n >= LOCK_AFTER ? now + lockMs(n) : 0 } };
  if (iph) up[`lfi/${iph}`] = b && now - (b.w || 0) < IP_WIN ? { n: (b.n | 0) + 1, w: b.w } : { n: 1, w: now };
  await dbPatch(env, "", up).catch(() => {});
  return n >= LOCK_AFTER ? Math.ceil(lockMs(n) / 60000) : 0;
}
const lockedMsg = (m) => "Too many tries. Please wait " + m + (m === 1 ? " minute" : " minutes") + " and try again.";
// find the account behind a call sign and check the password; null on any mismatch (always the same work)
async function passwordAccount(env, cs, pw) {
  const v = CS_RE.test(String(cs || "")) ? await dbGet(env, `csk/${csKey(cs)}`).catch(() => null) : null;
  const pid = v && !v.until && PID_RE.test(String(v.p || "")) ? v.p : null;
  const acc = pid ? await dbGet(env, `lunarAccounts/${pid}`).catch(() => null) : null;
  const ok = await pwCheck(String(pw || ""), acc && acc.id === pid ? acc.pw : null, kdfOf(env));
  return ok ? { pid, acc, cs: v.n } : null;
}

// ---- signup gate: limits per network and device per day; Cloudflare Turnstile only when signups look automated ----
const SIGNUP = { ipSoft: 3, devSoft: 2, ipHard: 12, devHard: 4, ipNoCheck: 6, flagAt: 4 };
const turnstileOn = (env) => !!(env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY);
async function turnstileOk(env, token, ip) {
  if (!token || String(token).length > 4096) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(token), remoteip: ip }), signal: AbortSignal.timeout(8000) });
    return !!(await r.json()).success;
  } catch { return false; }
}
export async function signupGate(env, req, b, now) {
  const day = dayOf(now), iph = await ipHash(env, ipOf(req)), did = /^[0-9a-f]{16}$/.test(String(b.did || "")) ? String(b.did) : "";
  const [ipC, devC, prev] = await Promise.all([iph ? dbGet(env, `sgn/${day}/i${iph}`).catch(() => 0) : 0, did ? dbGet(env, `sgn/${day}/d${did}`).catch(() => 0) : 0, iph ? dbGet(env, `sgn/${day}/p${iph}`).catch(() => null) : null]);
  const ipN = Number(ipC) | 0, devN = Number(devC) | 0;
  if (ipN >= SIGNUP.ipHard || devN >= SIGNUP.devHard) return { stop: bad("signup_limit", 429, { msg: "Too many new accounts from this network or device today. Please log in to your existing account, or try again tomorrow." }) };
  const suspicious = ipN >= SIGNUP.ipSoft || devN >= SIGNUP.devSoft;
  if (suspicious && turnstileOn(env)) {
    if (!(await turnstileOk(env, b.ts, ipOf(req)))) return { stop: bad("verify", 428, { siteKey: env.TURNSTILE_SITE_KEY, msg: "Quick check that you're not a robot." }) };
  } else if (suspicious && ipN >= SIGNUP.ipNoCheck) return { stop: bad("signup_limit", 429, { msg: "Too many new accounts from this network today. Please try again tomorrow." }) };
  return { iph, did, ipN, devN, day, prev: typeof prev === "string" ? prev : null };
}
export async function signupDone(env, g, pid, cs, now) {
  const up = {};
  if (g.iph) { up[`sgn/${g.day}/i${g.iph}`] = { ".sv": { increment: 1 } }; up[`sgn/${g.day}/p${g.iph}`] = pid; up[`iph/${pid}/${g.iph}`] = g.day; }
  if (g.did) { up[`sgn/${g.day}/d${g.did}`] = { ".sv": { increment: 1 } }; up[`dev/${g.did}/${pid}`] = g.day; }
  await dbPatch(env, "", up).catch(() => {});
  // silent scoring: a burst of new accounts from one network or device is linked for review (never banned)
  if (g.prev && PID_RE.test(g.prev) && g.prev !== pid && (g.ipN + 1 >= SIGNUP.flagAt || g.devN + 1 >= SIGNUP.devSoft)) {
    await link(env, pid, g.prev, g.devN ? "device" : "network").catch(() => {});
    await addFlags(env, pid, cs, [["signup", (g.ipN + 1) + " new accounts from one network today"]], now).catch(() => {});
  }
  await funnel(env, "made", now);
}

// ---- recovery email (Resend), on once RESEND_API_KEY is set ----
const emailOn = (env) => !!env.RESEND_API_KEY;
const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const maskEmail = (a) => { const [u, d] = String(a).split("@"); return (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***") + "@" + d; };
async function sendEmail(env, to, subject, text) {
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.RESEND_FROM || "LUNAR <onboarding@resend.dev>", to: [to], subject, text }), signal: AbortSignal.timeout(10000) }).catch(() => null);
  return !!(r && r.ok);
}

// ---- Google sign-in (OpenID Connect, code flow + PKCE), on once its client id and secret are set ----
const googleOn = (env) => !!(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
const sha256b64u = async (s) => btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const redirect = (to, cookies = []) => { const r = new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }); for (const c of cookies) r.headers.append("Set-Cookie", c); return r; };
export async function googleAuth(req, env) {
  const url = new URL(req.url), path = url.pathname;
  if (!googleOn(env) || !env.SESSIONS) return redirect("/web/login.html?login=google_off");
  if (path === "/auth/google/start" && req.method === "GET") {
    const mode = url.searchParams.get("mode") === "link" ? "link" : "login";
    const me = mode === "link" ? await webIdentity(req, env, false) : null;
    if (mode === "link" && !me) return redirect("/web/login.html");
    const state = random(), nonce = random(), verifier = random() + random(), token = random(), now = Date.now();
    const ok = await record(env, token, "issue", { kind: "challenge", flow: "google", state, nonce, verifier, mode, pid: me ? me.pid : null, created: now, expires: now + 600000 });
    if (!ok.ok) return redirect("/web/login.html?login=unavailable");
    const g = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for (const [k, v] of Object.entries({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, redirect_uri: origin(env) + "/auth/google/callback", response_type: "code", scope: "openid", state, nonce, code_challenge: await sha256b64u(verifier), code_challenge_method: "S256", prompt: "select_account" })) g.searchParams.set(k, v);
    return redirect(g.toString(), [cookie(WEB_LOGIN_COOKIE, token, 600)]);
  }
  if (path === "/auth/google/callback" && req.method === "GET") {
    const back = mode => (mode === "link" ? "/web/account.html?google=" : "/web/login.html?login=");
    const token = getCookie(req, WEB_LOGIN_COOKIE); if (!token) return redirect("/web/login.html?login=expired");
    const used = await record(env, token, "consume"); if (!used.ok) return redirect("/web/login.html?login=expired");
    const ch = await used.json(), clear = cookie(WEB_LOGIN_COOKIE, "", 0);
    if (ch.flow !== "google" || url.searchParams.get("state") !== ch.state) return redirect(back(ch.mode) + "invalid", [clear]);
    const code = url.searchParams.get("code") || ""; if (!code || code.length > 4096) return redirect(back(ch.mode) + "cancelled", [clear]);
    let claims = null;
    try {
      const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10000),
        body: new URLSearchParams({ code, client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, redirect_uri: origin(env) + "/auth/google/callback", grant_type: "authorization_code", code_verifier: ch.verifier }) });
      const t = r.ok ? await r.json() : null;
      // the ID token came straight from Google's token endpoint over TLS (code + secret + PKCE), so its claims are Google's
      const part = String(t && t.id_token || "").split(".")[1];
      const c = part ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (x) => x.charCodeAt(0)))) : null;
      const sec = Date.now() / 1000;
      if (c && ["accounts.google.com", "https://accounts.google.com"].includes(c.iss) && c.aud === env.GOOGLE_OAUTH_CLIENT_ID && c.nonce === ch.nonce && c.exp > sec && /^[0-9]{5,30}$/.test(String(c.sub))) claims = c;
    } catch {}
    if (!claims) return redirect(back(ch.mode) + "identity", [clear]);
    const sub = String(claims.sub), linked = await dbGet(env, `googleLinks/${sub}`).catch(() => null), now = Date.now();
    if (ch.mode === "link") {
      if (!PID_RE.test(String(ch.pid || ""))) return redirect(back("link") + "invalid", [clear]);
      const acc = await dbGet(env, `lunarAccounts/${ch.pid}`).catch(() => null);
      if (!acc || acc.id !== ch.pid) return redirect(back("link") + "password_first", [clear]);
      if (linked && linked !== ch.pid) return redirect(back("link") + "taken", [clear]);
      const c = await claimOnce(env, `googleLinks/${sub}`, ch.pid);
      if (!c.ok && c.v !== ch.pid) return redirect(back("link") + "taken", [clear]);
      await dbPatch(env, `lunarAccounts/${ch.pid}`, { google: sub });
      return redirect(back("link") + "linked", [clear]);
    }
    let pid = typeof linked === "string" && PID_RE.test(linked) ? linked : null, acc = pid ? await dbGet(env, `lunarAccounts/${pid}`).catch(() => null) : null;
    if (!pid || !acc) {
      // a new account: it picks its call sign on the next screen
      pid = newPilotID();
      if (!(await claimOnce(env, `googleLinks/${sub}`, pid)).ok) return redirect("/web/login.html?login=retry", [clear]);
      acc = { id: pid, name: "Pilot" + pid.slice(-4), created: now, type: "google", google: sub, source: "google" };
      if (!(await claimOnce(env, `lunarAccounts/${pid}`, acc)).ok) return redirect("/web/login.html?login=retry", [clear]);
      await funnel(env, "made", now);
    }
    const cs = await csOf(env, pid);
    const ns = await newSession(env, userOf(pid, cs ? cs.n : acc.name, cs ? {} : { callsign: undefined }), pid, { via: "google" });
    if (!ns) return redirect("/web/login.html?login=unavailable", [clear]);
    return redirect("/web/play.html#play", [clear, ns.cookie]);
  }
  return bad("not_found", 404);
}

// ---- what the settings screen and the prompts need to know ----
async function accountView(env, me, now = Date.now()) {
  const [acc, cs, S] = await Promise.all([dbGet(env, `lunarAccounts/${me.pid}`).catch(() => null), csOf(env, me.pid), dbGet(env, `eco/${me.pid}`).catch(() => null)]);
  const tgId = acc && acc.telegramId ? acc.telegramId : /^tg_/.test(me.pid) ? Number(me.pid.slice(3)) : null;
  const keys = acc && Array.isArray(acc.credentialIDs) ? acc.credentialIDs.length : 0;
  const email = acc && acc.email && acc.email.a ? { a: maskEmail(acc.email.a), v: !!acc.email.v } : null;
  const recovery = keys > 0 || !!tgId || !!(acc && acc.google) || !!(email && email.v);
  return { ok: true, pid: me.pid, kind: me.user && me.user.lunar_account ? "lunar" : "telegram", ...csInfo(cs, now), hasPassword: !!(acc && acc.pw), passkeys: keys,
    telegram: !!tgId, google: !!(acc && acc.google), email, recovery, via: me.session.via || "telegram", keep: me.session.keep !== false,
    canSetPassword: !!cs && !(S && S.mig === 0),
    features: { google: googleOn(env), email: emailOn(env), turnstile: turnstileOn(env) ? env.TURNSTILE_SITE_KEY : null } };
}

// ---- routes: /auth/acct/* (website, same-origin, first-party cookies) ----
export async function accountAuth(req, env) {
  const path = new URL(req.url).pathname, now = Date.now();
  if (!env.SESSIONS || !env.FIREBASE_DB_SECRET) return bad("account_service_unavailable", 503);
  if (path === "/auth/acct/config" && req.method === "GET")
    return json({ ok: true, google: googleOn(env), email: emailOn(env), turnstile: turnstileOn(env) ? env.TURNSTILE_SITE_KEY : null, telegram: env.WEB_LOGIN_ENABLED === "1" });
  if (req.method !== "POST" || !sameOrigin(req, env)) return bad("origin", 403);
  let b; try { b = await body(req); } catch { return bad("bad_json"); }

  // page counters (no personal data): landing visit, signup screen shown
  if (path === "/auth/acct/ping") { if (!soft(req, "ping", 12) && ["land", "view"].includes(b.e)) await funnel(env, b.e, now); return json({ ok: true }); }
  // live "available / taken" while typing (debounced in the page)
  if (path === "/auth/acct/check") {
    if (soft(req, "check", 90)) return bad("rate", 429, { msg: "Slow down a little." });
    const me = await webIdentity(req, env, false);
    return json(await csCheck(env, String(b.cs || ""), me ? me.pid : "", me ? me.user : null, now));
  }
  // "You were invited by <call sign>" on the signup screen
  if (path === "/auth/acct/invite") {
    if (soft(req, "invite", 20) || !/^[a-hjkmnp-z2-9]{8}$/.test(String(b.c || ""))) return json({ ok: true, name: null });
    const owner = await dbGet(env, `inv/${b.c}`).catch(() => null);
    if (!PID_RE.test(String(owner || ""))) return json({ ok: true, name: null });
    const cs = await csOf(env, owner), rec = cs ? null : await dbGet(env, `players/${owner}/name`).catch(() => null);
    return json({ ok: true, name: cs ? cs.n : typeof rec === "string" ? rec.slice(0, 16) : null });
  }

  if (path === "/auth/acct/signup") {
    if (soft(req, "signup", 10)) return bad("rate", 429, { msg: "Too many tries. Please wait a minute." });
    if (await webIdentity(req, env, false)) return bad("already_signed_in", 409, { msg: "You're already logged in." });
    const cs = String(b.cs || ""), pw = String(b.pw || "");
    const p = csProblem(cs); if (p) return bad("callsign", 400, { field: "cs", reason: p.code, msg: p.msg });
    const q = pwProblem(pw, cs); if (q) return bad("password", 400, { field: "pw", reason: q.code, msg: q.msg });
    if (!(await csAvailable(env, cs, "", now))) return bad("taken", 409, { field: "cs", msg: "That call sign is taken.", ideas: await ideas(env, cs, now) });
    const gate = await signupGate(env, req, b, now); if (gate.stop) return gate.stop;
    const pid = newPilotID();
    if (!(await claimKey(env, cs, pid, now))) return bad("taken", 409, { field: "cs", msg: "That call sign was just taken.", ideas: await ideas(env, cs, now) });
    const acc = { id: pid, name: cs, created: now, type: "password", source: "web", pw: await pwHash(pw, kdfOf(env)) };
    if (!(await claimOnce(env, `lunarAccounts/${pid}`, acc)).ok) return bad("retry", 503, { msg: "Please try again." });
    await dbPut(env, `cs/${pid}`, { n: cs, k: csKey(cs), t: now, c: 0 });
    await signupDone(env, gate, pid, cs, now);
    const inv = /^[a-hjkmnp-z2-9]{8}$/.test(String(b.inv || "")) ? String(b.inv) : undefined;   // bound on the first sync, moments later
    const ns = await newSession(env, userOf(pid, cs, inv ? { inv } : {}), pid, { keep: b.keep !== false, via: "password" });
    if (!ns) return bad("session_store", 503);
    return json({ ok: true, pid, cs, csrf: ns.csrf }, 200, ns.cookie);
  }

  if (path === "/auth/acct/login") {
    if (soft(req, "login", 20)) return bad("rate", 429, { msg: "Too many tries. Please wait a minute." });
    const cs = String(b.cs || "").trim(), key = CS_RE.test(cs) ? csKey(cs) : "x", iph = await ipHash(env, ipOf(req));
    const wait = await lockState(env, key, iph, now);
    if (wait) return bad("locked", 429, { msg: lockedMsg(wait) });
    const found = await passwordAccount(env, cs, b.pw);
    if (!found) { const m = await failLogin(env, key, iph, now); return bad("wrong", 401, { msg: m ? lockedMsg(m) : "Wrong call sign or password." }); }
    await dbPatch(env, "", { [`lf/${key}`]: null }).catch(() => {});
    if (pwOutdatedSafe(found.acc.pw)) await dbPatch(env, `lunarAccounts/${found.pid}`, { pw: await pwHash(String(b.pw), kdfOf(env)) }).catch(() => {});
    const extra = found.acc.telegramId ? { tgId: found.acc.telegramId } : {};
    const ns = await newSession(env, userOf(found.pid, found.cs, extra), found.pid, { keep: b.keep !== false, via: "password" });
    if (!ns) return bad("session_store", 503);
    return json({ ok: true, pid: found.pid, cs: found.cs, csrf: ns.csrf }, 200, ns.cookie);
  }

  // forgot password: a reset link to the recovery email, if one is on file. Same answer either way (no enumeration)
  if (path === "/auth/acct/reset/request") {
    if (soft(req, "reset", 5)) return bad("rate", 429, { msg: "Please wait a minute." });
    if (!emailOn(env)) return json({ ok: true, email: false });
    const v = CS_RE.test(String(b.cs || "")) ? await dbGet(env, `csk/${csKey(b.cs)}`).catch(() => null) : null;
    const acc = v && !v.until && PID_RE.test(String(v.p)) ? await dbGet(env, `lunarAccounts/${v.p}`).catch(() => null) : null;
    if (acc && acc.email && acc.email.v && acc.pw !== undefined) {
      const t = random(); await record(env, t, "issue", { kind: "challenge", flow: "reset", pid: v.p, created: now, expires: now + 3600000 });
      await sendEmail(env, acc.email.a, "Reset your LUNAR password", "Someone asked to reset the password for LUNAR call sign " + v.n + ".\n\nSet a new password (link works for 1 hour, once):\n" + origin(env) + "/web/login.html#reset=" + t + "\n\nIf this wasn't you, ignore this email. Your password stays the same.");
    }
    return json({ ok: true, email: true });
  }
  if (path === "/auth/acct/reset/finish") {
    if (!/^[a-f0-9]{64}$/.test(String(b.t || ""))) return bad("expired", 401, { msg: "That reset link has expired. Ask for a new one." });
    const r = await record(env, b.t, "consume"); if (!r.ok) return bad("expired", 401, { msg: "That reset link has expired. Ask for a new one." });
    const ch = await r.json(); if (ch.flow !== "reset" || !PID_RE.test(String(ch.pid))) return bad("expired", 401);
    const [acc, cs] = await Promise.all([dbGet(env, `lunarAccounts/${ch.pid}`), csOf(env, ch.pid)]);
    const q = pwProblem(b.pw, cs && cs.n); if (q) { return bad("password", 400, { field: "pw", msg: q.msg + " Ask for a new link and try again." }); }
    await dbPatch(env, `lunarAccounts/${ch.pid}`, { pw: await pwHash(String(b.pw), kdfOf(env)) });
    await endSessions(env, ch.pid);
    const ns = await newSession(env, userOf(ch.pid, cs ? cs.n : acc.name, acc.telegramId ? { tgId: acc.telegramId } : {}), ch.pid, { via: "email" });
    return json({ ok: true }, 200, ns ? ns.cookie : null);
  }
  if (path === "/auth/acct/email/verify") {
    if (!/^[a-f0-9]{64}$/.test(String(b.t || ""))) return bad("expired", 401);
    const r = await record(env, b.t, "consume"); if (!r.ok) return bad("expired", 401, { msg: "That link has expired. Add the email again in Settings." });
    const ch = await r.json(); if (ch.flow !== "email" || !PID_RE.test(String(ch.pid))) return bad("expired", 401);
    const acc = await dbGet(env, `lunarAccounts/${ch.pid}`);
    if (!acc || !acc.email || acc.email.a !== ch.a) return bad("expired", 401);
    await dbPatch(env, `lunarAccounts/${ch.pid}/email`, { v: true, vt: now });
    return json({ ok: true });
  }

  // ---- everything below needs a signed-in session (CSRF checked) ----
  const me = await webIdentity(req, env);
  if (!me) return bad("signed_out", 401, { msg: "Please log in again." });
  if (path === "/auth/acct/me") return json(await accountView(env, me, now));
  if (path === "/auth/acct/callsign") {
    const r = await csSet(env, me.pid, String(b.cs || ""), me.user, now);
    return r.ok ? json(r) : bad(r.error, r.error === "taken" ? 409 : 400, r);
  }
  if (path === "/auth/acct/password") {
    const pw = String(b.pw || ""), cs = await csOf(env, me.pid);
    if (!cs) return bad("callsign_first", 409, { msg: "Pick your call sign first." });
    const q = pwProblem(pw, cs.n); if (q) return bad("password", 400, { field: "pw", msg: q.msg });
    let acc = await dbGet(env, `lunarAccounts/${me.pid}`);
    if (acc && acc.pw && me.session.via === "password") {
      // changing a password you logged in with needs the current one; signing in another way (passkey, Telegram,
      // Google, email link) already proved it's you, so that's how a forgotten password is replaced
      if (!(await pwCheck(String(b.cur || ""), acc.pw, kdfOf(env)))) return bad("wrong", 401, { field: "cur", msg: "Your current password isn't right." });
    }
    const hash = await pwHash(pw, kdfOf(env));
    let user = me.user;
    if (!acc) {
      // a Telegram pilot adds a password: same pilot, same record (tg_<id>), now also reachable by call sign
      if (!/^tg_[0-9]{3,15}$/.test(me.pid) || me.pid !== "tg_" + me.user.id) return bad("account", 403);
      const S = await dbGet(env, `eco/${me.pid}`).catch(() => null);
      if (S && S.mig === 0) return bad("complete_telegram_setup_first", 409, { msg: "Open the game in Telegram once first, then come back." });
      const reserved = await claimOnce(env, `telegramLinks/${me.user.id}`, me.pid);
      if (!reserved.ok && reserved.v !== me.pid) return bad("already_linked", 409);
      acc = { id: me.pid, name: cs.n, created: now, type: "password", source: "telegram", telegramId: me.user.id, pw: hash };
      if (!(await claimOnce(env, `lunarAccounts/${me.pid}`, acc)).ok) return bad("retry", 409, { msg: "Please try again." });
      user = { ...me.user, lunar_account: true, lunar_name: cs.n, callsign: cs.n, tgUsername: me.user.username };
    } else await dbPatch(env, `lunarAccounts/${me.pid}`, { pw: hash });
    // a new password signs out every other session; this one carries on (re-issued)
    await endSessions(env, me.pid, me.token);
    await record(env, me.token, "revoke").catch(() => {});
    const ns = await newSession(env, user, me.pid, { keep: me.session.keep !== false, via: "password" });
    if (!ns) return bad("session_store", 503);
    return json({ ok: true, csrf: ns.csrf }, 200, ns.cookie);
  }
  if (path === "/auth/acct/logout-all") {
    await endSessions(env, me.pid);
    await record(env, me.token, "revoke").catch(() => {});
    return json({ ok: true }, 200, sessionCookie("", 0));
  }
  if (path === "/auth/acct/email") {
    if (!emailOn(env)) return bad("coming_soon", 503, { msg: "Recovery email is coming soon." });
    const a = String(b.email || "").trim();
    if (!EMAIL_RE.test(a)) return bad("email", 400, { msg: "That doesn't look like an email address." });
    if (soft(req, "email", 3)) return bad("rate", 429, { msg: "Please wait a minute." });
    const acc = await dbGet(env, `lunarAccounts/${me.pid}`);
    if (!acc) return bad("password_first", 409, { msg: "Set a password first, then add a recovery email." });
    await dbPatch(env, `lunarAccounts/${me.pid}`, { email: { a, v: false, t: now } });
    const t = random(); await record(env, t, "issue", { kind: "challenge", flow: "email", pid: me.pid, a, created: now, expires: now + DAY });
    const sent = await sendEmail(env, a, "Confirm your LUNAR recovery email", "Tap to confirm this as the recovery email for your LUNAR account:\n" + origin(env) + "/web/account.html#verify=" + t + "\n\nIt's used only to reset your password. If this wasn't you, ignore this email.");
    return json({ ok: true, sent });
  }
  if (path === "/auth/acct/delete") {
    const cs = await csOf(env, me.pid);
    if (!cs || String(b.confirm || "") !== cs.n) return bad("confirm", 400, { msg: "Type your call sign exactly to confirm." });
    await deleteAccount(env, me.pid, cs, now);
    await endSessions(env, me.pid);
    await record(env, me.token, "revoke").catch(() => {});
    return json({ ok: true }, 200, sessionCookie("", 0));
  }
  return bad("not_found", 404);
}
const pwOutdatedSafe = (rec) => { try { return !rec || rec.v !== 1 || Number(rec.it) < 100000; } catch { return false; } };

// Delete: personal data and gameplay go; the call sign stays held 30 days (no re-farming the name), payment receipts
// stay (required records), and the anti-farm device/network history stays so a re-made account is still linked.
export async function deleteAccount(env, pid, cs, now = Date.now()) {
  const acc = await dbGet(env, `lunarAccounts/${pid}`).catch(() => null), up = {};
  for (const k of ["eco", "players", "cs", "ntf", "gh", "ghr", "ads", "rfs", "starsAck"]) up[`${k}/${pid}`] = null;
  up[`lunarAccounts/${pid}`] = null;
  if (cs) up[`csk/${cs.k}`] = { p: pid, n: cs.n, t: cs.t || now, until: now + HOLD, del: 1 };
  if (acc && acc.telegramId) up[`telegramLinks/${acc.telegramId}`] = null;
  if (acc && acc.google) up[`googleLinks/${acc.google}`] = null;
  if (acc && Array.isArray(acc.credentialIDs)) for (const id of acc.credentialIDs) {
    const h = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id))); up[`passkeys/${h}`] = null;
  }
  up[`del/${pid}`] = now;   // a tombstone (no personal data): this id never comes back as a fresh account
  await dbPatch(env, "", up);
}

// ---- the same call sign rules for the Telegram Mini App (and the website), through the game API's own login ----
export async function apiCallsign(env, a, now = Date.now()) {
  const b = a.b || {};
  if (b.op === "check") return { status: 200, body: await csCheck(env, String(b.cs || ""), a.pid, a.user, now) };
  if (b.op === "set") { const r = await csSet(env, a.pid, String(b.cs || ""), a.user, now); return { status: r.ok ? 200 : r.error === "taken" ? 409 : 400, body: r }; }
  const cur = await csOf(env, a.pid);
  const suggest = cur ? null : csFrom(a.user && (a.user.username || [a.user.first_name, a.user.last_name].filter(Boolean).join(" ")), a.pid.slice(-4));
  const free = suggest ? await csAvailable(env, suggest, a.pid, now) : true;
  return { status: 200, body: { ok: true, ...csInfo(cur, now), suggest: free ? suggest : null, ideas: !free && suggest ? await ideas(env, suggest, now) : [] } };
}
// "Log in with your call sign" inside Telegram: a pilot who signed up on the website links this Telegram account to it.
// Only when this Telegram account has no progress of its own (never merge two accounts with progress).
async function hasProgress(env, pid) {
  const [S, paid] = await Promise.all([dbGet(env, `eco/${pid}`).catch(() => null), dbGet(env, `starsPaid/${pid}`, { shallow: "true" }).catch(() => null)]);
  return !!(paid || (S && ((S.mp | 0) > 0 || (S.earned | 0) > 0 || (S.mig === 0) || (S.spendGram || 0) > 0 || (S.vg | 0) > 0)));
}
export async function apiTelegramLink(env, a, ip = "", now = Date.now()) {
  const b = a.b || {}, tgId = a.user && a.user.id;
  if (a.web || !Number.isSafeInteger(tgId) || tgId <= 0) return { status: 403, body: { error: "telegram_only" } };
  const legacy = "tg_" + tgId;
  if (a.pid !== legacy || (await dbGet(env, `telegramLinks/${tgId}`).catch(() => null))) return { status: 409, body: { error: "already_linked", msg: "This Telegram account is already connected to a LUNAR account." } };
  if (await dbGet(env, `lunarAccounts/${legacy}`).catch(() => null)) return { status: 409, body: { error: "already_linked", msg: "This Telegram account already has its own LUNAR login." } };
  if (await hasProgress(env, legacy)) return { status: 409, body: { error: "telegram_progress_exists", msg: "This Telegram account already has progress, so it can't be joined to another account. Contact /support to merge them." } };
  const cs = String(b.cs || "").trim(), key = CS_RE.test(cs) ? csKey(cs) : "x", iph = await ipHash(env, ip);
  const wait = await lockState(env, key, iph, now); if (wait) return { status: 429, body: { error: "locked", msg: lockedMsg(wait) } };
  const found = await passwordAccount(env, cs, b.pw);
  if (!found) { const m = await failLogin(env, key, iph, now); return { status: 401, body: { error: "wrong", msg: m ? lockedMsg(m) : "Wrong call sign or password." } }; }
  if (!/^ln_/.test(found.pid) || found.acc.telegramId) return { status: 409, body: { error: "account_has_telegram", msg: "That account is already connected to a Telegram account." } };
  const c = await claimOnce(env, `telegramLinks/${tgId}`, found.pid);
  if (!c.ok && c.v !== found.pid) return { status: 409, body: { error: "already_linked" } };
  await dbPatch(env, `lunarAccounts/${found.pid}`, { telegramId: tgId });
  // the empty Telegram-only record (made when the game first opened) goes; its call sign, if any, is freed
  const own = await csOf(env, legacy), up = { [`eco/${legacy}`]: null, [`players/${legacy}`]: null, [`cs/${legacy}`]: null, [`lf/${key}`]: null };
  if (own) up[`csk/${own.k}`] = null;
  await dbPatch(env, "", up).catch(() => {});
  return { status: 200, body: { ok: true, pid: found.pid, cs: found.cs } };
}
export { cleanName };
