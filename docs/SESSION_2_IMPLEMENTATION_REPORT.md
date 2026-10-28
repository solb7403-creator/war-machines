# Session 2 — Two-Machine Garage Implementation Report

Date: 2026-10-28 UTC. Scope: Session 2 only. Working checkout: `/workspace/war-machines-session2`. Branch: `feature/two-machine-garage`. Implementation base: `d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec`. Session 2 implementation, tests, documentation and screenshots are preserved in a local feature-branch commit. The commit ID is available from `git log -1`; temporary test logs remain outside Git at `/workspace/lunar-session2-preserved-logs/`. No push, PR, merge, deployment, production flag/database change, real payment or live account operation occurred.

## Delivered behavior

- Exactly two free named configurations, `m_legacy` and `m_spare`, under server-owned `eco/<pid>/lab`. Both reference the same existing account inventory, quality, global upgrades, core levels and premium entitlements. No gear, points, paid/earned extra slots or new purchase SKUs are granted.
- Deterministic, lazy migration on capable-client sync after the existing `S.mig` economy reconciliation. Existing canonical selection is preferred; the special case of completed old reconciliation replaces an earlier temporary starter selection with the reconciled owned selection before cloning. The second machine begins as the same selectable configuration and edits independently.
- Owner-only `lab_read`, `lab_save`, `lab_rename`, `lab_activate` actions through authenticated `/api/act`. Names, legal owned gear/rarity/salvage, unique three core sockets and owned paints are checked. Server revision preconditions reject stale edits; clients cannot add slot IDs, forge stat multipliers or select another account's inventory.
- Mobile Garage shelf shows two cards, Active/Ready, basic HP/power, Equip and Engineer. Engineer edits a name, owned weapon/chassis, three core choices and paint, then saves. Existing Play/FIGHT, equipment pickers, global upgrades and all six modes remain accessible. There is no mandatory engineering tutorial.
- Authoritative account revisions prevent older asynchronous replies overwriting newer server state during a page session. CloudStorage/localStorage are caches, not ownership authorities. Sync restores the active configuration into legacy selection fields for existing UI. Save conflicts and offline failures retain the open form and show feedback.
- Existing acquired-gear behavior stays consistent: Moonbeam/paint/selected-family upgrades auto-equip through authoritative shared rules, rather than only changing legacy UI variables. Other slots retain independent selections. Global stat upgrades and quality references remain shared.
- AI tickets now retain canonical L, allowed owned chassis variants, rules identifier, power and existing scoring multiplier. The client adopts the server snapshot before starting from VS; changes to garage/upgrades afterward affect future fights. Existing pending tickets without frozen L retain a legacy fallback.
- PvP seats detach their equipment snapshot, retain it on repeated queued join, and use it for room simulation and permitted VS/round class swaps. The owner receives frozen chassis options for the UI. Existing disconnect/reconnect, live scoring and room timing behavior remain covered by the existing PvP suite.
- Lab AI proofs bind initial class/HP and per-phase movement allowance to frozen permitted variants. Mid-round class changes are rejected; round changes require elimination/clock evidence, bounded series rounds and owned classes. Proof recording retains end-of-round evidence. No baseline damage, movement, counter, mode reward or paid-gear stat formula was changed.

## Scope exclusions and approved design reconciliation

`/workspace/SESSION_1_APPROVED_AMENDMENTS.md` and its copy under `docs/` supersede conflicting research proposals in the Session 1 architecture. The architecture's status and superseding link were updated.

No slot price is approved or implemented. No paid/points extra-slot endpoint, entitlement, checkout, deduction or reward was added. Initial capacity is exactly two; the schema's policy version allows a later validated configurable capacity policy rather than treating six as a permanent product ceiling. Functional and visual parts remain separate future concepts; **modules, visual body kits/effects, history, free range, blueprints, public garage, referral links and monetization expansion were not implemented**. No public raw Telegram ID exposure was introduced. The $12K/month goal is not used as a prediction or pricing input.

The full approval/execution instructions pasted in the conversation were applied. No separate approval/task attachment files were visible in workspace storage; this report does not claim an unavailable attachment was read.

## File-by-file implementation summary

| File | Change |
|---|---|
| `js/rules.js` | Private Lab v1 selection schema, deterministic migration, strict action validation, active-loadout resolver, acquisition selection adapter; three indexed core sockets normalized after Firebase serialization. Existing stat/economy formulas preserved |
| `worker/src/index.js` | Capable-client sync migration after old reconciliation; placeholder-selection correction; refresh canonical Lab loadout after existing paid grants. No invoice/verification/LP calculation changes |
| `worker/src/eco.js` | Failed reads propagate, authoritative response revision, Lab action dispatch, canonical active loadout, frozen AI ticket equipment and proof inputs |
| `worker/src/proof.js` | Snapshot variant/initial HP validation, owned class changes at valid bounded round boundaries, movement limits per selected frozen class |
| `worker/src/pvp.js` | Detached seat L, queued retries retain equipment, rules label, owner-only frozen class choices, Lab-aware canonical join resolution |
| `js/core.js` | Active selection adapter, stale-response guard, save/activation API and error handling, core/legacy picker integration, canonical acquisition UI |
| `js/net.js` | Announces Lab capability during normal account sync |
| `js/match.js` | Captured client battle equipment/power, canonical ticket adoption and rebuilt prepared teams, transient frozen VS counterpicks |
| `js/proof.js` | Class-change samples and end-of-round evidence for snapshot-aware proof |
| `js/pvp.js` | Reads owner-specific frozen permitted classes from room go/reconnect message |
| `js/ui.js` | Two-card Garage, owned-selection Engineer form, save/equip actions and feedback, existing picker integration; waits for AI ticket before starting |
| `css/app.css` | Narrow-screen machine cards and accessible-size form controls |
| `dev/tests/harness.py` | Serves repository bytes through an intercepted loopback URL and launches configurable installed Chromium; preserves mock APIs and blocks external fallback. Supports this environment's file-navigation restriction |
| `dev/tests/wtest/lab.mjs` | Real Worker/rules with fake DB: new/old/pending migration, repeated/concurrent sync, asset preservation, owner/shape/revision rejection, failed reads, snapshots, sparse cores, acquisition |
| `dev/tests/wtest/lab-battle.mjs` | Frozen proof variants/phase rejection, detached/repeated PvP joins, valid class swap and owner-specific options |
| `dev/tests/wtest/lab-parity.mjs` | Literal baseline stock stats/reward fixtures and snapshot-bound proof contracts for six modes |
| `dev/tests/lab-browser.py` | Real browser/isolated server: edit/equip/reload, stale response, other-device upgrade, six-mode captured equipment, round-end evidence, 320/390 mobile and graphics states |
| `dev/tests/lab-proofreal.py` | Actual browser combat simulations with Lab snapshots and real Arena intermission class swaps; verifies results with server proof checker |
| `docs/SESSION_1_APPROVED_AMENDMENTS.md`, `docs/SESSION_2_PLAN.md` | Binding amendment record and continuation/test/review ledger |
| `evidence/session2/` | Reviewed mobile screenshots only. Temporary test logs preserved outside Git at `/workspace/lunar-session2-preserved-logs/` |

## Test evidence

All API/backend tests use fake Firebase/Telegram/payment responses and throw on unexpected external destinations. Browser routes serve the local checkout and direct API requests only to `dev/tests/devserver.mjs`, which executes actual Worker code with an in-memory database and fake Durable Objects. Nonlocal unmocked browser requests are aborted. No production fallback is enabled. Generated `worker/src/sim.gen.js` is ignored build output in the isolated checkout. These tests are not human gameplay, actual Telegram clients, real Cloudflare deployment or payment settlement tests.

| Command | Observed result |
|---|---|
| `node dev/tests/wtest/test.mjs` | **189 passed, 0 failed** before and after implementation/fix pass |
| `node dev/tests/wtest/pvp.mjs` | **106 passed, 0 failed** before and after implementation/fix pass |
| `node dev/tests/wtest/lab.mjs` | PASS: account/migration/ownership/revisions/read errors/snapshots/sparse cores/acquisition |
| `node dev/tests/wtest/lab-battle.mjs` | PASS: snapshot proof validation, forged phase rejection, frozen PvP retry and legitimate swap |
| `node dev/tests/wtest/lab-parity.mjs` | PASS: stock stats, mode reward bases and snapshot proof contracts across all six modes |
| `python dev/tests/lab-browser.py` | PASS for two slots/save/activate/reload/stale response/canonical start snapshot/mobile graphics; including the final round-evidence regression |
| `python dev/tests/lab-proofreal.py` | PASS: **7 completed simulated Lab matches**, including Arena round counterpicks; server proof records verified |
| `python dev/tests/proofreal.py 1` | **64 completed simulated matches, 64 proof records, 0 failed, page errors []** across modes/team sizes/maps. This is the existing local-rule harness, distinct from the Lab-specific snapshot tests |
| `python dev/tests/qa.py` | PASS: **0 layout issues** at 320×500, 375×667, 390×740, 430×860, 768×1000 under its checks |
| `python dev/tests/b8test.py` | PASS (initial and final rerun): server-backed economy, migration/claims/forged state/admin cases; `fails: []` |
| `python dev/tests/b9test.py` | PASS: reset, ghost/report, Survival/Last Standing contracts; `fails: []` |
| `python dev/tests/b12test.py` | PASS (initial and final rerun): ticket retries/refusal/offline, 0 page errors |
| `python dev/tests/b13test.py` | PASS: link quests/claims, 0 page errors |
| `node dev/tests/wtest/farm.mjs` | **46 passed, 1 failed on untouched base and implementation**: “all 40 opted-in players reached once, in batches of 15; a blocked chat is switched off”, observed 0/0. Kept visible; not fixed by unrelated Lab changes |
| `node --check` on changed JS files; `git diff --check` | PASS |

The farm failure prevents a claim that the entire repository suite is green. Its root cause is not established here; reminder timing/data batching remains a pre-existing verification risk. No production behavior was changed to make that test pass. Existing load/performance stress scripts, all older browser suites, real Telegram CloudStorage across phones, actual Workers runtime smoke and live payment/refund verification were not run in this session. No deployment or launch readiness is claimed.

An initial added Lab simulation driver failed because the bot test controller lost its `brain` when a human-controlled tank was rebuilt during a chassis swap. The test driver now initializes its controller per replacement tank; production human control did not need bot state. The rerun passed. A repeated browser test also exposed residue from its reused fake account; the fixture now uses a unique fake account per run and passed again. A deterministic Arena regression then observed a refilled enemy at the proof boundary; capturing evidence before AI rebuilding fixed it and the browser regression passed. Failed-run history is preserved rather than represented as a passing run.

## Independent review and fixes

A fresh read-only review found five Important issues and no established Critical defect. Regression work addressed canonical server snapshot adoption before battle, three-slot Firebase normalization, authoritative purchase/reward auto-equip, phase-valid counterpicks, and old pending-migration placeholder selection. A further regression ensures PvP UI options come from the frozen seat, not new inventory acquired during the room. No second implementation scope was started. The 64-match general proof run and five-size QA ran before the final round-recording/capability adjustments; the final Lab browser, seven Lab simulations and backend regressions cover those targeted adjustments. No claim is made that every older suite was rerun after every edit.

The lightweight proof checker still validates plausibility rather than doing a deterministic authoritative replay of AI fights; that was existing architecture and remains a limitation. Do not describe it as cryptographic proof of every shot. Existing SOL valuation, referral attribution and payment-accounting concerns recorded in Session 1 were not remediated here. No new sale surface or blueprint/referral link was exposed. The only purchase-adjacent changes keep canonical machine selection in sync with already-authorized existing gear grants.

## Migration, compatibility and rollback

Migration creates no additional inventory, lifetime points, quests, referral/airdrop credit or payment record. Preservation tests compare the legacy-normalized baseline, since historical `ecoNorm` reconciliation can already refund old over-budget upgrades. Lab has its own version/revision and never resets `S.mig`. Account reads fail closed rather than treating outages as absent users. Client caches cannot grant ownership or overwrite server machine records through sync. Pending match queues and wallet/Stars recovery paths remain in place.

Mixed-version clients cannot overwrite Lab configuration via raw `b.L` after migration. An old client that does not understand Lab may still render cached selection; new AI/PvP starts for migrated accounts now require Lab revision capability and return `update` when absent, preventing mismatched new tickets/false proof flags. Coordinated client/Worker rollout and update prompt validation remain required before release. New AI tickets freeze L; pending pre-Lab tickets without L retain their old fallback. No ticket TTL, room lifetime, ranking formula, anti-farm threshold or LP split was changed. Lab edits during a fight do not change its captured equipment. Historical machines may resolve to owned fallback gear after an entitlement is revoked; saving a replacement still requires owned selections.

Rollback must preserve `lab` data and valid paid receipts. Do not reset accounts or drop new fields. Reverting to an old server that allows arbitrary raw selection overwrites is not a safe completed rollback strategy; use a compatible disabled-Lab build and let existing rooms/tickets settle. Deployment/flag activation, production backfill and rollback execution require separate approval. This session performed none.

## Remaining work and decisions

Session 2's implemented vertical slice is available in the working checkout for review; it is locally committed and not deployed. Any incomplete/unverified items above remain release gates rather than hidden successes. No external push was made or is needed to inspect this checkout; a draft PR would require a separately authorized push.

Session 3 remains **unstarted**. Before it begins, separately authorize the free-sidegrade module catalog/tuning and ranked/proof compatibility work. Functional modules, meaningful visual bodywork/fittings, deterministic Lab range, version history, showcase privacy surfaces, optional published blueprints, cosmetics/extra-slot ownership and monetization belong to their later sessions. Extra-slot prices remain unapproved. No new pricing decision is needed to use these two free slots.
