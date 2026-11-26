// Session 8 (owner brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md, Nov 26, 2026): the Conquest store's entitlements in the
// Conquest record. Every purchase is granted on the ACCOUNT (eco: S.cq the town items, S.cqc the bought collection pieces, S.wmn the
// wall-only ore, S.cfx paid construction finishes; js/rules.js cqGrant, in the account CAS, exactly once, refundable). The Conquest record
// reads them here at the session open and in the town actions that use them (the research rsx / lsm pattern), and keeps a mirror
// (s.shop, plot.b2 / own / lsl / fr / frs / ext.buy) the town's own rules read. A refund simply disappears from the account and the
// mirror follows at the next read. Nothing here gives points, CP, loot or anything a player could not also earn the slow way (except
// the looks and the second builder, which are store-only).
// The Lunar Pass's Conquest perks (spec §9, inside the existing pass) are applied here too, while the current season's premium pass is
// on the account: RECALL in 5 minutes (exists: conquest-sim.js), the scanner +50 m (conquest-sim.js scanStep reads s.shop.pe), two more
// layout slots (plot.lsl) and one Repair Kit a UTC day (up to the consumables' cap). Never points, never minerals.
import { RULES as R, CONQUEST } from './sim.gen.js';
import { inventory } from './conquest-loot.js';
const P = CONQUEST.Plot, C = CONQUEST.Catalog, DAY = 86400000;
const record = (v) => v && typeof v === 'object' && !Array.isArray(v);
export const PASS_SCAN_M = 50;   // the pass's scanner range bonus (metres)
// the premium pass's end on the account (0 when the current season's premium is not owned)
function passEnd(S, now) { const day = Math.floor(now / DAY), s = R.ecoSeason({ day }); return S && S.pass && S.pass.prem === true && S.pass.s === s ? R.passEnd(s) * DAY : 0; }
// what the Conquest record reads from the account (eco record S)
export function shopCtx(S, now) {
  const cq = record(S && S.cq) ? S.cq : {};
  return { cq: { b2: cq.b2 ? 1 : 0, lay: cq.lay ? 1 : 0, ext: Math.max(0, Math.min(5, cq.ext | 0)), fr: Number(cq.fr) || 0, frs: Number(cq.frs) || 0, gild: cq.gild ? 1 : 0, neon: cq.neon ? 1 : 0, aur: cq.aur ? 1 : 0 },
    cqc: Object.keys(record(S && S.cqc) ? S.cqc : {}).filter((k) => R.SHOP.cos[k]), wmn: R.mnOf(S && S.wmn), cfx: Object.keys(record(S && S.cfx) ? S.cfx : {}).filter((k) => R.cfxKey(k)), pe: passEnd(S, now), at: now };
}
// apply the account's entitlements to the Conquest record (inside the Conquest CAS). acct: shopCtx(S) read fresh for this request
export function shopAccount(s, acct, now) {
  if (!record(acct) || !record(acct.cq)) return null;
  const sh = record(s.shop) ? s.shop : (s.shop = {});
  sh.v = 1; sh.b2 = acct.cq.b2; sh.lay = acct.cq.lay; sh.ext = acct.cq.ext; sh.pe = Number(acct.pe) || 0; sh.at = now;
  sh.own = { gild: acct.cq.gild, neon: acct.cq.neon, aur: acct.cq.aur };
  sh.wmn = acct.wmn;
  const p = s.plot, notes = [];
  if (p) {
    p.b2 = acct.cq.b2 ? 1 : 0;
    // (a refunded second builder: a job already running on it still finishes; no new one starts: ConquestPlot.freeSlot reads p.b2)
    p.own = { ...sh.own };
    p.lsl = (acct.cq.lay ? 1 : 0) + (sh.pe > now ? 2 : 0);
    p.ext = record(p.ext) ? p.ext : {}; p.ext.buy = 10 * acct.cq.ext;   // capacity only (+10% a pack, up to the +50% cap with the earned ones)
    if (acct.cq.fr > 0) { p.fr = acct.cq.fr; p.frs = Math.min(acct.cq.frs || acct.cq.fr, acct.cq.fr); } else { delete p.fr; delete p.frs; }   // the Foundry speed-up's 4x window (ConquestPlot.accrue)
    // a look no longer owned (a refund) comes off; the town keeps every other choice
    if (p.theme) { if (p.theme.light === 'aurora' && !acct.cq.aur) p.theme.light = 'violet'; if (p.theme.ws && !acct.cq.gild) delete p.theme.ws; if (p.theme.ts && !acct.cq.neon) delete p.theme.ts; }
    // a paid construction finish: that running construction (never a repair) ends now, once
    p.cfxU = record(p.cfxU) ? p.cfxU : {};
    for (const k of P.JOB_SLOTS) { const j = p[k]; if (!j || j.t === 'repair' || !(j.ready > now)) continue; const key = R.cfxKey((j.t === 'cc' ? 'cc' : j.id) + '@' + j.l); if (key && acct.cfx.includes(key) && !p.cfxU[key]) { p.cfxU[key] = now; j.ready = now; notes.push({ kind: 'plot-finished', job: key }); } }
    const keys = Object.keys(p.cfxU); if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete p.cfxU[k];
  }
  // the collection: a bought piece is owned (source 'bought'); a refunded one comes off unless it was also earned
  const c = record(s.cosmetics) ? s.cosmetics : (s.cosmetics = { v: 1 }); c.owned = record(c.owned) ? c.owned : {}; c.equipped = record(c.equipped) ? c.equipped : {};
  for (const id of acct.cqc) if (C.byId[id] && !c.owned[id]) c.owned[id] = { at: now, source: 'bought' };
  for (const [id, o] of Object.entries(c.owned)) if (o && o.source === 'bought' && !acct.cqc.includes(id)) { if (C.eligible(id, s)) { c.owned[id] = { at: now, source: 'earned', milestone: C.byId[id].earnText }; continue; } delete c.owned[id]; for (const [slot, e] of Object.entries(c.equipped)) if (e === id) delete c.equipped[slot]; }   // earned by play meanwhile: it stays, as earned
  // the Lunar Pass: one Repair Kit a UTC day while the current season's premium is on (never points or minerals)
  if (sh.pe > now) { const day = Math.floor(now / DAY); if (sh.rk !== day) { const v = inventory(s), room = Math.max(0, R.CQ_ITEM_MAX - (v.it.repair | 0)); if (room) v.it.repair = (v.it.repair | 0) + 1; sh.rk = day; if (room) notes.push({ kind: 'pass-repair' }); } }
  if (notes.length && !s.notice) s.notice = notes[0];
  return sh;
}
// the pass's scanner range bonus for a scan pulse now
export const scanBonus = (s, now) => (s && s.shop && Number(s.shop.pe) > now ? PASS_SCAN_M : 0);
