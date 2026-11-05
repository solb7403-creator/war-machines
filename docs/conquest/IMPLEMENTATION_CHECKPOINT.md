# Session 1 implementation checkpoint

2026-11-05 · branch `feat/conquest-living-war-v1` · baseline GitHub main `a668e30`. Current checkpoint commit is the commit containing this file; resolve with `git log -1` / the PR head (a commit cannot contain its own SHA).

## Completed checkpoint 1 — combat thermal rescue

- Moonbeam no-core normal held fire: 29 real shots before first vent, 5s recovery; legal RoF core fixtures at levels 0/5/10: 25 shots. Thermal tradeoffs tested at -3/0/3, at 15/30/60 FPS: minimum 25. Canonical damage, .95s interval, independent projectile velocity/range retained. Other weapons now sustain longer differentiated bursts.
- Custom always-visible numeric thermal widget above FIRE, neutral/amber/red and VENTING, accessible meter semantics; no native meter. No free heat reset introduced.
- Entire unabridged two-session roadmap and smoothness contract archived together in CONQUEST_FLAGSHIP_V1.md.

## Evidence / limits

Executed PASS: `node dev/tests/conquest-living-war.mjs`, `node dev/tests/conquest-session-033.mjs`, `node dev/tests/conquest-authority.mjs`, `node dev/tests/conquest-controls.mjs`, `node dev/tests/conquest-session.mjs`, `node dev/tests/conquest-economy.mjs`. Full regression is running; browser Chromium verification is running. No gameplay/device smoothness claim yet. PHYSICAL_IPHONE_NOT_TESTED. Production unchanged; no merge/deployment. All data used by tests is isolated.

## Remaining mandatory scope

Session 1 A4–6 presentation/browser proof; B dense live region; C six distinct missions + persistent frontline; D physical tiered Command Base and modules/passive output/reputation; E progression, earned cosmetics and real affordability/3h model; F migration/concurrency; G full authenticated journey, performance and release gates. Exact requirements: SESSION_01_LIVING_WAR_FULL_CODEX_PROMPT.txt; Session 2 architecture contract retained in CONQUEST_FLAGSHIP_V1.md. Do not mark Session 1 complete or deploy partial work as the flagship.

## Resume next

1. Finish Chromium thermal/multitouch evidence and inspect thermal placement at both sizes; do not replace actual shot assertions with mocked state.
2. Extend deterministic world garrisons/opening patrols and six mission reducers in shared combat code; retain per-generation CAS rewards, physical proximity, active mission continuity.
3. Add central base/module definitions and server actions, physical base rendering and progression UI; calibrate actual earnings before release.

No schema changes at this checkpoint. No paid services, payments, account/Arcade/PvP or airdrop modifications. Open historical PRs #5 and #14–21 are unrelated; do not merge them. No preexisting living-war branch or active Conquest PR existed at start.

## Checkpoint 2 — live region, six operations and Command Base (in progress, not release-certified)

Checkpoint 1 was pushed and verified on GitHub as `4dcde44`; consolidated draft PR #53. This checkpoint's commit is identified by the branch/PR head. Owner-authorized merge/deployment remains withheld until acceptance is actually met.

Implemented: four installations and four patrol routes (14 persistent actors), three opening opportunities within 240m and a scout within 100m; staging guards patrol physically. Six shared mission families with server-proximity activation: oxygen defense; moving convoy; guarded relay destruction + 8s sabotage; three physical 3s recon scans; physical crawler escort with protected HP; gate breach + commander + 6s occupation. Server-confirmed victories and cleared garrisons persist ownership and physical banners. First clears/repeat payouts/reputation/three-operation daily order; generation-gated salvage continues beyond historical daily caps. No client rewards or time claims. Eight engineering tracks extend additively to six ranks. Legacy ranks/balances preserved.

Personal base: physical terminal at X1080 Z1160, additive campaign/base/modules schema on existing v1 record, CAS construction/tiers I–V, finite 3-stage modules with server-clock build times, once/24h capped CP claim enhanced by nonspendable reputation, Reactor/Uplink; Hangar repairs locally; Defense mitigation; Vault permits protected base banking. Five distinct procedural fortification silhouettes batched to one architecture draw; owned paint and free Field Veteran monument. Frontline navigation selects physical objectives; no teleport menu. Radar currently has no module-specific gameplay function (still mandatory). Base cost currently 1800 CP + 110 Alloy + 65 Biomass + 8 Helium; **affordability is NOT YET calibrated/proven**.

Executed PASS at this feature group: `conquest-frontline.mjs`, `conquest-base.mjs`, `conquest-operations.mjs` (all six actual simulations, real shots/traversal, rewards, reload settlement guard; legendary equipped fixture, no enemy HP manipulation), `conquest-living-war.mjs`, `conquest-economy.mjs`, `conquest-session-033.mjs`, `wtest/conquest.mjs`. Browser `conquest-living-war.py --engine chromium` passed at 320/390 with physical base construction/upgrade/module start, reconnect, active relay enemy fire, native multitouch and thermal/laser/context-loss checks; resource-rich base fixture is explicitly test-seeded and DOES NOT prove natural earning. Screenshots under docs/conquest-living-war. Changes after that run still need final-HEAD recheck.

Discovered/fixed through actual simulation: extraction route initially hit an impassable cliff (moved to traversable authored route); non-rescue operations inherited a false oxygen-destruction defeat (damage target now restricted to genuine protected objectives); stronger garrison changed occlusion and kill-before-fire timing, tests now exercise actual defense before return fire. Screenshot review found thermal/Dash overlap; thermal moved above action bank.

Performance: initial software-rendered relay browser run had median 57.6/69.6ms, p95 173.5/162.8ms, worst 917/657ms, ~120 draws and 81 chunks. This **FAILS**, not a smoothness success. Rendering changes now bound mobile detailed streaming to 25 chunks, one chunk/frame + 3ms admission budget, add bounded frame samples/adaptation hysteresis, reduce DOM churn, and add small visual-only reconciliation correction. Reprofile identical scenario at final HEAD. PHYSICAL_IPHONE_NOT_TESTED. No 30m/20m real-device soak claimed.

Remaining mandatory: complete six-mission browser/Worker kill-loot-bank journey, real normal-play 45–75min base calibration + 3h progression model; module-specific Radar function and stronger physical base functionality/entry proof; rotating contracts/usable convoy-route map; richer Moonfall/VFX and meaningful AI behaviors; first-contact beginner traces; final-HEAD shared regressions + WebKit + 2D + maximal-density performance/memory evidence. Exact A–H requirements remain binding. Do not deploy this as complete.

Next: 1. Rerun browser with reduced terrain draw workload and inspect actual base/thermal screenshots. 2. Add CAS race coverage for base/production + complete safe migration and six-rank compatibility checks. 3. Calibrate base economy with actual mission/collision timings, finish missing module/UX behaviors, then full release verification. Preserve this branch; do not repeat completed thermal work or replace existing authoritative architecture.
