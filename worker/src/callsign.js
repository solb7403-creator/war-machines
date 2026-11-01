// Call signs (the public player name) and passwords. Pure helpers: no database or network access here.
// Call sign: 3-16 plain keyboard characters, no spaces. Only exact duplicates clash, ignoring case ("Jake" = "jake");
// look-alikes ("j@ke", "J4ke") are different names. Shown exactly as typed.
export const CS_CHARS = "A-Za-z0-9@_\\-.!#$*+~^?=%:";
export const CS_RE = new RegExp("^[" + CS_CHARS + "]{3,16}$");
export const CS_HINT = "3 to 16 letters, numbers or symbols like @ _ - . ! # $ *. No spaces.";
// the index key: lowercase, hex-encoded (database keys can't hold . $ # [ ] /)
export const csKey = (cs) => [...String(cs).toLowerCase()].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");

// Names nobody may take (impersonation). The owner's handle is allowed only for the owner's own Telegram username.
export const OWNER_HANDLE = "lunarbattle";
// matched on a normalized copy (so "Adm1n" and "@dmin_" count) ...
const RESERVED = ["admin", "administrator", "lunar", "lunarwarmachines", "warmachines", "lunarwm", "support", "moderator", "staff",
  "official", "security", "lunarbot", "telegram", OWNER_HANDLE];
// ... and generic words reserved only exactly (so "Pilot7" or "Dev2" stay fine)
const RESERVED_EXACT = ["mod", "mods", "system", "root", "owner", "team", "help", "helpdesk", "dev", "developer", "bot", "pilot", "anonymous", "null", "undefined", "server"];
const RESERVED_PREFIX = ["admin", "moderator", "support", "official", "lunarofficial", "lunarteam", "lunarsupport", "lunaradmin", "lunarstaff", "lunarmod", OWNER_HANDLE];
// Slurs and strong profanity, checked on a normalized copy (lowercase, symbols dropped, common digit/symbol swaps undone).
// Substring words are unambiguous; the short list must match the whole name (avoids blocking "Scunthorpe"-style names).
const BAD_SUB = ["nigger", "nigga", "faggot", "fagot", "retard", "tranny", "wetback", "beaner", "fuck", "shit", "cunt", "bitch", "whore",
  "slut", "rapist", "paedo", "pedophile", "nazi", "hitler", "kkk", "porn", "pussy", "penis", "vagina", "asshole", "arsehole", "dildo", "jizz",
  "milf", "terrorist", "molest"];
const BAD_WHOLE = ["ass", "fag", "fags", "sex", "anus", "nig", "hoe", "hoes", "twat", "wank", "wanker", "prick", "bastard", "piss", "cum",
  "anal", "spic", "coon", "dick", "cock", "rape", "pedo", "kike", "gook", "chink", "boob", "boobs", "tits", "isis", "sexy"];
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", "$": "s", "!": "i", "+": "t" };
const norm = (s) => [...String(s).toLowerCase()].map((c) => LEET[c] || c).join("").replace(/[^a-z]/g, "");
const normPlain = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

// null when fine, otherwise a short reason code + friendly message
export function csProblem(cs, { ownerOk = false } = {}) {
  cs = String(cs ?? "");
  if (/\s/.test(cs)) return { code: "spaces", msg: "No spaces, please. Try " + (cs.replace(/\s+/g, "_").slice(0, 16) || "Pilot_1") + "." };
  if (/[^\x21-\x7e]/.test(cs)) return { code: "chars", msg: "Use plain keyboard letters, numbers and symbols only (no emoji or accents)." };
  if (cs.length < 3) return { code: "short", msg: "At least 3 characters." };
  if (cs.length > 16) return { code: "long", msg: "16 characters at most." };
  if (!CS_RE.test(cs)) return { code: "chars", msg: "Letters, numbers and @ _ - . ! # $ * + ~ ^ ? = % : only." };
  if (!/[A-Za-z0-9]/.test(cs)) return { code: "chars", msg: "Include at least one letter or number." };
  const n = norm(cs), p = normPlain(cs);
  if (BAD_SUB.some((w) => n.includes(w) || p.includes(w)) || BAD_WHOLE.includes(n) || BAD_WHOLE.includes(p)) return { code: "blocked", msg: "That name isn't allowed. Please pick another." };
  const owner = n === OWNER_HANDLE || p === OWNER_HANDLE;
  if (owner && ownerOk) return null;
  if (RESERVED.includes(n) || RESERVED.includes(p) || RESERVED_EXACT.includes(p) || RESERVED_PREFIX.some((w) => p.startsWith(w) || n.startsWith(w))) return { code: "reserved", msg: "That name is reserved. Please pick another." };
  return null;
}

// a call sign made from any name (Telegram name, old pilot name): strips what isn't allowed, never empty
export function csFrom(raw, fallbackId = "") {
  let s = String(raw || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(new RegExp("[^" + CS_CHARS + "]", "g"), "").slice(0, 16).replace(/[_.\-]+$/, "");
  if (s.length < 3 || csProblem(s)) s = "Pilot" + String(fallbackId || Math.floor(Math.random() * 1e4)).slice(-4);
  return s;
}
// three different alternatives for a taken name (the caller checks they're free)
export function csIdeas(cs, n = 8) {
  const base = String(cs).slice(0, 12).replace(/[^A-Za-z0-9_]+$/g, "") || "Pilot";
  const r = () => Math.floor(Math.random() * 90) + 10, out = new Set();
  const forms = [() => base + r(), () => base + "_" + r(), () => base.slice(0, 11) + "_" + ["moon", "mk2", "ace", "ops", "one", "x"][Math.floor(Math.random() * 6)], () => base + "." + r(), () => base + r() + r()];
  for (let i = 0; out.size < n && i < 40; i++) { const s = forms[i % forms.length]().slice(0, 16); if (s.toLowerCase() !== String(cs).toLowerCase() && !csProblem(s)) out.add(s); }
  return [...out];
}

// ---- passwords ----
// Minimum 8 characters and not one of the most common breached passwords. No other rules.
const COMMON = new Set(("123456 123456789 12345678 password qwerty123 qwerty 12345 1234567890 1234567 111111 123123 abc123 password1 1q2w3e4r " +
  "qwertyuiop 000000 iloveyou 1234 aa12345678 dragon sunshine princess letmein 654321 monkey 27653 1qaz2wsx 123321 qwerty12 121212 " +
  "football baseball welcome shadow superman michael master jennifer 666666 trustno1 jordan23 harley hunter2 starwars 11111111 " +
  "passw0rd password123 password12 admin123 administrator 87654321 88888888 12341234 qazwsxedc zaq12wsx 1qazxsw2 asdfghjkl asdfasdf " +
  "computer whatever freedom mustang batman soccer charlie loveme liverpool chelsea arsenal 123qwe 1q2w3e 7777777 55555555 " +
  "qwer1234 q1w2e3r4 q1w2e3r4t5 abcd1234 abcdefgh 1234qwer 11223344 112233 123654789 147258369 987654321 00000000 99999999 " +
  "iloveyou1 princess1 sunshine1 football1 baseball1 welcome1 letmein1 monkey123 dragon123 master123 qwerty1234 password! " +
  "p@ssw0rd p@ssword pa55word changeme default secret123 lunar123 lunarwar warmachines tanks123 gamer123 minecraft fortnite roblox " +
  "pokemon naruto blink182 internet samsung iphone google123 facebook").split(/\s+/));
export function pwProblem(pw, cs = "") {
  pw = String(pw ?? "");
  if (pw.length < 8) return { code: "short", msg: "Use at least 8 characters." };
  if (pw.length > 200) return { code: "long", msg: "That's too long (200 characters at most)." };
  const l = pw.toLowerCase();
  if (COMMON.has(l) || /^(.)\1+$/.test(pw) || "01234567890123456789".includes(pw) || "abcdefghijklmnopqrstuvwxyz".includes(l)) return { code: "common", msg: "That password is too common. Add a few words or numbers only you would think of." };
  if (cs && l === String(cs).toLowerCase()) return { code: "same", msg: "Don't use your call sign as the password." };
  return null;
}
// PBKDF2-SHA256, per-user salt, versioned so the cost can rise later (Workers WebCrypto caps PBKDF2 at 100,000 iterations)
export const PW_PARAMS = { 1: { it: 100000, len: 32 } }, PW_V = 1;
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function deriveLocal(pw, salt, it, len) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(pw).normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: it }, key, len * 8));
}
// kdf(pw, salt, iterations, bytes) may run the work elsewhere (a Durable Object has a larger CPU budget than a request)
export async function pwHash(pw, kdf = deriveLocal) {
  const p = PW_PARAMS[PW_V], salt = crypto.getRandomValues(new Uint8Array(16));
  return { v: PW_V, it: p.it, s: b64(salt), h: b64(await kdf(pw, salt, p.it, p.len)), t: Date.now() };
}
const DUMMY = { v: 1, it: 100000, s: "AAAAAAAAAAAAAAAAAAAAAA==", h: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" };
// constant-time compare; an account without a password still spends the same work (no timing hint that it exists)
export async function pwCheck(pw, rec, kdf = deriveLocal) {
  const r = rec && rec.s && rec.h && PW_PARAMS[rec.v] ? rec : DUMMY;
  const want = unb64(r.h), got = await kdf(pw, unb64(r.s), Number(r.it) || PW_PARAMS[r.v].it, want.length);
  let diff = got.length ^ want.length;
  for (let i = 0; i < want.length; i++) diff |= got[i] ^ want[i];
  return r !== DUMMY && diff === 0;
}
export const pwOutdated = (rec) => !rec || rec.v !== PW_V || Number(rec.it) < PW_PARAMS[PW_V].it;
export { b64, unb64 };
