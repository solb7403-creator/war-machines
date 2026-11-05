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

## Checkpoint 3 — integration, fairness and rendering hardening

Checkpoint 2 pushed as `5e2415d` to PR #53. Additional working changes: server UTC featured contracts rotate every 30m (+20 CP latched at mission start); Radar returns bounded real nearby contacts; active convoy route drawn on map. Five base tiers + painted apron + free earned Field Veteran monument and module defense field. Moonfall now has pooled violet edge and expanding rings. Phase transitions discard old hostile visual types instead of retaining a relay mesh for a later armored commander.

Rendering: terrain+skirts combined into one draw per chunk; hostile hull/gun subparts merged without changing hitboxes, canonical stats or independent turret movement. Mobile near-field chunks bounded at 25; Canvas fallback no longer builds unused terrain and hostile 3D meshes. Trees omitted from base apron; camera opens overhead on base entry and restores on exit. Custom thermal bar is above the full action bank. Bounded geometry disposal and small visual-only reconciliation remain.

New evidence: base build/production concurrent CAS requests, forged price and other-account rejections pass `node dev/tests/wtest/conquest.mjs`. `conquest-session`, `conquest-view-travel`, `conquest-discovery`, `conquest-base`, thermal matrix pass. Shared economy/payment regression: `node dev/tests/wtest/test.mjs` **203 passed / 0 failed**. PvP: `node dev/tests/wtest/pvp.mjs` **113 passed / 0 failed**. Browser Chromium and Canvas journeys passed on earlier checkpoint-3 working code; exact final recheck still pending. Full regression is running after fixes for VM instrumentation/discovery-test dependency extraction.

First-base recipe calibrated to **2700 CP + 110 banked Alloy + 65 Biomass + 8 Helium** (2700 replaces the too-fast 1800 checkpoint-2 value). `node dev/tests/conquest-earning-model.mjs` passes: four standard contracts at explicit estimated 75–90s cycles (combat/manual targeting/salvage/travel/banking) -> first base **60/72 minutes**, with **4320/3240 CP remaining after 3h after buying the base**; no dailies cap halts progression. Model uses real settlement/debit functions and excludes bonus kill loot, featured bonuses and production. These are transparent pacing assumptions, NOT a fully observed 75-minute human/browser journey. Faster play/additional loot can earn sooner; spending on engineering can delay the base. Recipe is centrally shared; preserved CP and gear are not reset.

Known environment evidence: downloaded WebKit into /tmp; host libraries absent. Extracted Debian runtime libraries locally (no system install); browser launch now works after loader-path diagnosis. WebKit journey is running, not yet reported passed. Software-rendering performance numbers from mixed-load runs are not physical hardware evidence and did not meet 60 FPS. New browser profiling resets counters after scene streaming stabilizes and records an isolated 10s active mission interval. Need final performance run without simultaneous CPU-heavy regression jobs.

Still unfulfilled release gates: authenticated end-to-end naturally earned complete kill/loot/bank + two completed distinct missions + base construction/module completion in one browser journey; full first-contact ≤75s traversal evidence, physical base I–V screenshots; measured 30m/20m density memory soak; mobile/WebKit/physical telemetry. PHYSICAL_IPHONE_NOT_TESTED. Do not merge/deploy while these remain unverified. No payment activation or production state mutation occurred.

## Checkpoint 4 — opening proof, instance collision, final compatibility fixes

Checkpoint 3 was pushed as **4a9135e259a5fb9ed2087751706212174fa85d25**. This checkpoint includes newly verified WebKit artifacts and the final isolated Chromium/Canvas profiles. Full shared regression passed locally; CI at 4a9135e passed all website/signup/browser jobs but found an obsolete hardcoded 250-CP assertion in `conquest-authority.mjs` when the UTC featured operation paid 270. Fixed the assertion to compare terminal balance against the actual pre-terminal balance; added an independent exact +20/duplicate settlement test. Next CI must confirm this fix; prior red run is NOT a pass.

Added `conquest-opening.mjs`: authoritative stock input route from actual spawn, safe initial 5s, first visible hostile **25.5s**, hostile projectile **36.65s**, actual starter kill/loot and physical Refuge banking **73.7s** (18 CP, 3 Alloy, 2 Biomass). No position/victory/loot claims or enemy HP manipulation. `conquest-base.mjs` now proves personal walls block canonical movement and unbuilt instances have no phantom walls. Construction rejects positions that new geometry would enclose. Mission deployment selects safe authored pad offsets rather than overlapping the pilot; regression reproduced the relay overlap before fixing it. Contract reward cooldown is now checked before start and visibly labeled, avoiding completed zero-pay sorties.

Automated browser evidence at 4a9135e:
- Chromium 320: median **48.4ms**, p95 **83.8ms**, worst **172ms**, 61 draws, 58 geometries, 25 chunks, 17 living actors, 5 projectiles.
- Chromium 390: median **62.8ms**, p95 **85.1ms**, worst **124.7ms**, 57 draws, 54 geometries, 25 chunks, 17 living actors, 5 projectiles.
- WebKit 320: median **21ms**, p95 **48ms**, worst **191ms**, 61 draws, 53 geometries, 25 chunks, 17 living actors.
- WebKit 390: median **30ms**, p95 **62ms**, worst **181ms**, 58 draws, 50 geometries, 25 chunks, 17 living actors.
- Chromium Canvas 390: median **16.6ms**, p95 **44.1ms**, worst **100.4ms**, zero 3D draws/geometries/chunks, 17 living actors, 6 projectiles.
All are software/browser measurements, **not physical phone telemetry**; none certifies the required 60 FPS dense 3D experience. Frame profiling resets after streaming settles and records 10s of active relay defense. Full 30m/20m memory soak remains NOT TESTED. Functional journeys passed both sizes/engines and Canvas; errors arrays empty. Native Chromium three-touch; WebKit automation uses independent mouse DRIVE + native ability touches, so no physical three-touch Safari claim.

Remaining release gates are preserved at the end of CONQUEST_FLAGSHIP_V1.md, which now includes exact implemented mission/base/module/schema/cost/thermal contracts. No merge/deploy. Next concrete tasks: (1) await next CI and fix any actual failures; (2) complete a single full authenticated browser outcome journey, not just isolated starts/module fixtures; (3) profile real hardware or a hardware GPU environment and fix/verify dense 3D frame time and long memory soak. Do not interpret modelled 60–72m earnings as recorded human play. Do not regenerate finished systems.
