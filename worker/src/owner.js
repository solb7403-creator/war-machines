// Owner-only test tool: free Epic gem caches on the owner's own record, so he can build and test his tank.
// Exactly one account can ever use it: OWNER_PID, reached either through the pinned Telegram admin (whose Telegram id is
// linked to OWNER_PID) or through a website session on OWNER_PID whose account carries that same pinned Telegram id.
// Each cache is a real roll (RULES.ecoOpenBox: same odds, shards, level-ups, labGain) inside the normal eco.js transaction
// (ETag/if-match, so a concurrent save is never overwritten). Free: no payment, no spendGram, no buys, no deals, no points.
// Every open is logged on the record (S.grants.owner_gem) and in ops/owner_gem (private, deny-all path).
import { RULES as R } from "./sim.gen.js";
import { dbGet, dbPatch } from "./db.js";
import { tx, pub, who, setLoadout } from "./eco.js";

export const OWNER_PID = "ln_6392735208728";
export const OWNER_ADMIN = "lunarbattle";   // the Telegram admin username (ADMINS in index.js), pinned in cfg/admin
export const OWNER_GEM_MAX = 10;
const deny = () => ({ status: 403, body: { error: "not owner" } });

// true only when every check holds. Never pins anything: the admin pin must already exist (set by /api/admin).
export async function isOwner(env, a, admins) {
  if (!a || !a.user || a.pid !== OWNER_PID) return false;
  if (!Array.isArray(admins) || !admins.includes(OWNER_ADMIN)) return false;
  const pin = await dbGet(env, `cfg/admin/${OWNER_ADMIN}`).catch(() => null);
  if (pin === null || pin === undefined || !/^\d{1,15}$/.test(String(pin))) return false;
  const [link, acc] = await Promise.all([
    dbGet(env, `telegramLinks/${pin}`).catch(() => null),
    dbGet(env, `lunarAccounts/${OWNER_PID}`).catch(() => null),
  ]);
  // the pinned Telegram admin and OWNER_PID must be one linked account (same eco record), both directions
  if (link !== OWNER_PID || !acc || acc.id !== OWNER_PID || String(acc.telegramId) !== String(pin)) return false;
  if (a.web) return true;   // website session: its account is OWNER_PID, which is linked to the pinned admin id
  // Telegram: the admin username and the pinned Telegram id, exactly as /api/admin checks them
  const un = String(a.user.username || "").toLowerCase();
  return admins.includes(un) && un === OWNER_ADMIN && String(a.user.id) === String(pin);
}

export async function ownerGemEpic(env, a, admins, now = Date.now()) {
  if (!(await isOwner(env, a, admins))) return deny();
  const n = Math.max(1, Math.min(OWNER_GEM_MAX, Math.floor(Number(a.b && a.b.n) || 1)));
  const t = await tx(env, OWNER_PID, (S, X) => {
    who(S, a.user);
    const outs = [];
    for (let i = 0; i < n; i++) outs.push(R.ecoOpenBox(S, "gem", 2, X));   // each one its own real roll
    const g = S.grants && typeof S.grants === "object" && !Array.isArray(S.grants) ? S.grants : {};
    const prev = g.owner_gem && typeof g.owner_gem === "object" ? g.owner_gem : {};
    S.grants = { ...g, owner_gem: { n: (Number(prev.n) || 0) + n, last: now, paid: 0 } };
    if (S.L) setLoadout(S, S.L);   // power and league follow the new core levels
    return { outs };
  }, now, { rl: 1 });
  if (t.rate) return { status: 429, body: { error: "rate" } };
  const key = now + "_" + Math.random().toString(36).slice(2, 8);
  await dbPatch(env, "", { [`ops/owner_gem/${key}`]: { pid: OWNER_PID, n, rev: t.S.rev, via: a.web ? "web" : "tg", gems: t.outs.map((o) => o.gem + "+" + o.n) } }).catch(() => {});
  return { status: 200, body: { ok: true, out: { outs: t.outs }, total: t.S.grants.owner_gem.n, E: pub(t.S) } };
}
