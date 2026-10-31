# LUNAR — Nonpayment live gear release (2026-10-31)

Future sessions: read this first, then check true GitHub `main` + the "Deploy Stars server (Cloudflare)" workflow state. Do not restart planning.

## Status

| Item | Value |
|---|---|
| Release branch | `release/nonpayment-live-gear` |
| Base main | `385356ea4ffac207900d05be6fbdf1965081fa63` (v `20261029-defender1`) |
| New build version | `20261031-gear1` |
| Merged to main | see PR / bottom of this file (updated after merge) |
| Deployed | see bottom of this file (updated after deploy) |

## Source manifest — IN

- `release/graphics-rc1` @ `5f4886d8acabee6f80ae625c1ac18d1d39460c51` (one commit on main; same tree as graphics PRs #14–20). Not merged PR-by-PR.
- `feature/iphone-practice-preview` @ `d78d8df4d041f8d3512a06d68aa730afc397f589` (5 additive commits on RC1: `web/practice-preview*.{html,js,css}`, `dev/tests/practice-preview.cjs`, plan doc). Account-free, CSP + fetch-blocked, no storage, labeled "TEST / PRACTICE ONLY".
- From PR #5 (`1b5f90df…`): **presentation only** — Play-screen "Your battle machines" two-bay roster (`battleRosterHtml` in `js/ui.js`, CSS appended to `css/app.css`). Selecting uses the existing server `lab_activate` request (same as Garage "Equip").
- Release changes in this branch: `GraphicsRelease={version:'graphics-r1',enabled:true}` in `js/graphics.js`; version bump to `20261031-gear1` (`version.json`, `index.html`, equipment/foundation previews); stale "disabled by default" copy on foundation preview; tests updated for live gate (`graphics-motion.mjs`, `graphics-release.mjs`, `practice-preview.cjs`); new `dev/tests/live-gear-release.cjs`.

## Source manifest — OUT (deliberately)

- PR #21 / `feature/launch-commercial-readiness` (`84f69f69…`): **nothing** taken. No Stars/TON/SOL changes, no DO migrations.
- PR #5 rule changes NOT taken: removal of between-round counterpick (`js/game.js`, `js/match.js`), single-chassis ticket freeze (`worker/src/eco.js`), PvP `c` message ignore (`worker/src/pvp.js`), backlog docs. Reason: they change live gameplay/server rules and were not required for the gear/graphics release; current main already freezes the authoritative loadout at match start (`lab-battle.mjs` PASS). Candidate for a later, separate rules update.
- PR #5 history/backlog docs, PR #14–20 individual merges.

Diff vs main touches **no** `worker/**`, `js/rules.js`, `js/game.js`, `js/match.js`, `js/pvp.js`, `js/net.js`, `js/core.js`. No economy, entitlement, price, referral, payment, auth or DB change.

## What goes live

- 9 standard chassis (Scout/Vanguard/Titan × T0–T2) and 9 standard weapons (Pulse/Twin/Siege × T0–T2) in HF UV/PBR HIGH + LOW, plus 2D fallback, in Garage, Engineer, showroom and battle.
- Legendary Lunar Skin (graphite/gold, adaptive to all 9 chassis) and unified Moonbeam (with Moonfall super effects); independent and combined. Ownership gates unchanged — nothing granted.
- Four upgraded maps (classic, overpass, longshot, craters) across six modes (Arena, Moon Zone, Crystal Rush, Bounty, Last Standing, Survival).
- Track/wheel shader motion, recoil, effects, quality Auto/High/Low/2D (Settings), conservative Auto=LOW on coarse-pointer/limited-memory phones, context-loss fallback.
- Play-screen two-bay roster; account-free practice at `/web/practice-preview.html`.

## Checks run on this branch (Linux Chromium/SwiftShader; NOT physical iPhone)

Owner's earlier physical-iPhone sign-off was on the RC1 preview Site, not this build.

- Node: graphics-motion, graphics-release, hf-foundation, hf-collection, environment, legendary-visual, defender-visual, standard-equipment, defender-isolation, web-login, lab-ui, gear-balance — PASS.
- Server (deploy workflow set): wtest/test 189/189, pvp 106/106, farm 49/49, web-auth, lunar-identity, lab, lab-battle, lab-parity, range, range-comparison — PASS.
- Real workerd runtime smoke (`worker/smoke-runtime.mjs`) — PASS (15 snapshots/s).
- Browser: `dev/tests/live-gear-release.cjs` (real shipped gate, no intercept; roster 2 bays, bay switch via lab_activate with unchanged pts/inventory/skin/moonbeam; quality cycle; 320/390/430/1280 no h-scroll) — PASS. `dev/tests/graphics-browser.py` (full real app) — PASS: six modes completed to result on four maps (Arena/classic won, Moon Zone/overpass lost, Crystal Rush/longshot won, Bounty/craters won, Last Standing/classic lost, Survival/craters won), 18 HIGH/LOW hull shader renders with GL error 0, quality cycle, BFCache, context loss/recovery, unchanged bays/economy, zero ranked/payment mutation requests. `--lifecycle-only` — PASS (live reduced-motion; unknown-memory mobile Auto → LOW, DPR 1). `graphics-fallback.py` — PASS (missing/corrupt/version/timeout recover; no-WebGL; context loss). `graphics-telegram.py` — PASS (Telegram Mini App entry, Engineer HIGH 19 draws/29,810 tris). `practice-preview.cjs` — PASS (six modes, touch, no storage, zero external/write requests).

## Rollback

1. **HF-only (fast):** in `js/graphics.js` set the `enabled` boolean to false, bump `version.json` + every `?v=` in `index.html` (and preview pages), push one commit to main. Legacy models/maps return; nothing else changes.
2. **Full:** `git revert <release merge commit>` on main, push once. Restores main `385356e` tree.
3. Never reset accounts, purchases, DB, secrets or Durable Objects. No data migration is involved in this release.

## Next single action

(updated at end of session)
