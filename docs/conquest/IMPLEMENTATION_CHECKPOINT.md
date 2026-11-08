# Session 1 implementation checkpoint

**Current status (2026-11-05): playable implementation is pushed in draft PR #53. Last fully tested code: `1b9a7dc75e26e95261206ac4a233022c2d801066` / build `20261105164144`; all 8 CI checks passed. Checkpoint 13 below records final verification only. Earlier checkpoints are historical. Do not restart the completed systems. Release remains blocked by actual-device/soak/manual acceptance.**

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

## Checkpoint 5 — real browser outcomes and geometry/network continuity

Prior pushed checkpoint: **58e1342e5bca7402b29ebdde5de174fc87403495**. Its CI unit/security/geometry job passed; website/all signup engines/WebKit browser matrix passed. Chromium browser matrix exposed a second old exact-250 assertion in `conquest-session-032.py` during a legitimately featured 270-CP victory. That expectation now explicitly includes the latched +20. The successful native three-wave victory was genuine; the failed assertion was not a failed combat outcome. Recheck the next CI head.

Fixed additional physical issues with tests: moved all four installations into the shared World registry so new bunker art actually blocks driving and shots and scenery is excluded from its apron. Mobile horizon now starts immediately beyond the 25 detailed chunks, filling a previously uncovered LOD ring; terrain dimensions/topography are unchanged. Latest authoritative opening trace after true bunker occlusion: **visible 28.2s / hostile fire 36.65s / kill-salvage-bank 73.7s**. All six authoritative operation simulations still pass; new bunker/horizon assertions pass.

Network timing: reproduced over-large batches after delayed replies in `conquest-session.mjs` (19 commands sent with only 200ms acknowledged elapsed budget). Client now conservatively limits input submissions by acknowledged reserve + local elapsed time, retaining later prediction and short ability edges; action draining yields while waiting. Server elapsed-time/CAS authority is unchanged. Relevant session/authority/Worker CAS tests pass. Browser timing refusals on prior stress runs were retained in output rather than concealed; new client behavior is undergoing the full journey recheck.

**Actual Chromium 390 outcome journey PASS:** two distinct missions (Relay and moving Convoy), real projected rendered-hull clicks plus ordinary DRIVE/FIRE/Shield keyboard input, physical travel and clearing the surrounding world garrison, then actual travel around bunker/tower geometry to Refuge and verified banking. `chromium-390-relay-victory.png`, `chromium-390-convoy-victory.png`, `chromium-390-verified-two-missions-banked.png`, and chromium-results.json retain evidence. The initial epic equipped loadout and start location are disposable fixtures; no victory, enemy HP, reward or position claims were submitted. The earlier idle density profile is a separate fixture scenario, not a claim of one contiguous human playthrough. Automation was corrected to wait for phase transitions and use real ray-hit hull coordinates; its earlier defeats/travel failures were not counted as passes.

Physical base captures now include I, II, III, IV, V at 390 and a **real 60-second Reactor completion** with server-state module rank 1; the full rerun that includes these steps is still running. Resource-rich test fixture construction is explicitly not natural earning proof. The 60–72m earning model remains separate and disclosed. Field Veteran also adds a permanent small mech trim badge while preserving original paint/geometry ownership; no shared gear stats/entitlements change. Thermal layout now uses Telegram safe-area variables as well as iPhone env values; isolated Chromium layout checks passed at 320×420 and 390×844 with a 34px Telegram bottom inset.

Remaining release blockers: final-head browser/CI completion after these fixes, WebKit full two-mission outcome extension, sustained dense 3D performance certification/30m+20m memory soak, and a continuous naturally earned base journey (model + resource fixtures do not prove that complete flow). Software GPU profiling still misses 60 FPS despite simulation ~0.4–2.2ms and render submission ~0.8–1.8ms; e.g. latest dense 390 run had median ~65ms with ~50 draws/~55k triangles/49 geometries/2 textures/~45MB JS heap. This is a performance FAIL in this available environment, not a physical phone claim. **PHYSICAL_IPHONE_NOT_TESTED.** Do not merge/deploy or mark Session 1 fully accepted yet.

Resume on this same branch. Next actions: finish `python3 dev/tests/conquest-living-war.py --engine chromium --journey-only` (then WebKit), inspect latest PR CI logs, and address the explicit remaining performance/natural-earn gates. Preserve all passing state machines and checkpoint commits; do not restart implementation.

## Checkpoint 6 — final tested feature set; release remains blocked

Prior pushed feature head **04bb2817b3039cc3ec298aa1fb94f224a0d06d41**. Its unit/security, website, all three signup engines and WebKit browser matrix passed. Chromium completed its old journeys and both new mission victories but failed at the banking button: its harness stopped from predicted coordinates before the authoritative endpoint had reached the 12m terminal radius. The harness now requires BOTH predicted and verified arrival, stops keys, and waits for actual Supply availability before native tapping. This retains the real proximity requirement; it does not bypass banking. Local Chromium complete extended run passed after the fix. Final CI rerun still required.

New local PASS evidence: full `conquest-living-war.py --engine chromium --journey-only` and `--engine webkit --journey-only` include base tiers I–V, actual 60s Reactor completion, native controls, Relay + Convoy outcomes, clearing surrounding garrisons, physical travel/verified banking, reconnect, engineering, heat/laser/context-loss checks. Canvas functional run passed. Initial earned-loadout/site and resource-rich base fixtures remain explicitly marked; these runs do not prove one contiguous naturally earned base session.

Final performance/AI changes: adaptive Auto resolution steps down to 1x then .75x after two sustained slow 60-frame windows and recovers one step only after eighteen fast windows. It never removes opponents or changes physics/rewards. Added `conquest-adaptive.mjs` red→green coverage for adaptation, hysteresis and bounded samples. AI decision phases are now deterministically staggered across the existing actors; tests show at most two near-field decisions on the initial frame while all nearby AI continues acting. Genuine projectile/Super hits can radio existing nearby squads for 12s of response; no entities or rewards are manufactured. Wounded guards can retreat toward their own cover. Stats and drop generations remain fixed.

Executed PASS after final AI changes: `conquest-frontline`, `conquest-opening`, `conquest-operations` (all six victories), `conquest-authority`, `conquest-controls`, `conquest-garrisons`, `conquest-session`, `conquest-base`, `wtest/conquest`, `conquest-adaptive`; production view movement verification passed after adaptive changes. Latest opening trace: **28.2s visible / 36.8s hostile fire / 73.45s actual kill-salvage-bank**. No new paid API, production record or payment operation was used.

Latest software evidence: WebKit 390 (before the final adaptive/AI adjustment) median **18ms**, p95 **26ms**, worst **46ms**, zero >100ms hitches, 50 draws/~55k triangles/50 geometries/2 textures/25 chunks/17 living actors; time below 50/40/30 FPS **23.96/5.09/.57%**. Chromium 390 with .75x adaptive scale median **41.4ms**, p95 **78.9ms**, worst **114.8ms**, three >100ms hitches, 50 draws/~55k triangles/49 geometries/2 textures/~46MB heap/17 living actors. Simulation ~2.3ms and render submission ~.6ms in that sample. These remain **software-renderer measurements** and do not meet the required dense 60 FPS acceptance. Real mobile GPU/physical iPhone/Telegram and 30m+20m density memory soak are **NOT TESTED**.

**Exact remaining blockers (do not call complete / do not merge or deploy):**
1. Observe final-head CI, especially the complete Chromium banking leg; fix any new failure on this same branch.
2. Obtain/measure capable-phone or hardware-GPU dense 3D performance and complete the prescribed long memory/stutter soak. Existing software results fail the target. PHYSICAL_IPHONE_NOT_TESTED.
3. Verify a continuous naturally earned base progression journey. The canonical 60–72m / 3h settlement model plus resource-rich construction fixture are separately useful evidence, but do not prove that complete human/browser flow.

Resume: `Continue Session 1 on feat/conquest-living-war-v1 / PR #53 from the latest IMPLEMENTATION_CHECKPOINT.md; preserve the six completed mission systems, thermal rescue and base schema; finish the three explicit release blockers before Session 2 or deployment.` Do not start the original brief over or claim unpushed work. This branch and its committed screenshots/tests are the durable handoff. Production is unchanged.

## Checkpoint 7 — production-v1 compatibility and honest installation captures

Prior pushed head **ee9331ae0b107f78a7a1b496ba6cb1f750ab3b97**. Its unit/security, website and signup jobs passed; both transmission jobs failed. Chromium's hull-switch harness could click a nearer overlapping hull while ray-testing only the requested one. WebKit's direct-line travel hit a genuine seeded boulder. Harness fixes now test the closest hit among all visible hulls, and use collision-aware test-only A* to issue normal keyboard movement. No production teleport or forced lock was added. Ability evidence records genuine acknowledged cooldowns, avoiding a late assertion after a cooldown has expired. Fresh local full extended Chromium/WebKit runs passed before the installation integration below; recheck the final code/CI. Do not describe the previous red CI as passing.

**Existing production saves:** stable spawn keys now retain all six original IDs (10001–10006); eight additions use 10007–10014. The prior constructor-order allocation could collide with saved IDs. Snapshot/replay counters include all actor IDs, including resident mission namespaces. New `conquest-v1-migration.mjs` constructs the historical six-actor layout, verifies original HP/IDs/CP/banked resources/ranks, exact in-flight oxygen sortie preservation and safe return to the expanded region. A bounded one-time server construction-apron migration moves only pilots/checkpoints/salvage embedded in the two newly added bunker footprints (<=32m), retaining HP, thermal debt, quantities, wreck expiries and active missions. No client position action was introduced.

**Real captures:** Relay and Redoubt now reuse their actual persistent world garrisons instead of adding duplicate mission squads. Living installation defenders block sabotage/commander progression and victory. Convoy secures `convoy-lane`; it cannot claim Crossroads while its defenders survive. All operation sites receive verified physical ownership banners; friendly oxygen/extraction sites are labeled under threat. Practice missions also retain real resident damage when returning to exploration. Mission HUD now displays the carrier's HP/exit distance, scan/sabotage/occupation progress and extraction progress. Far residents (>240m) remain dormant during missions as well as exploration.

The integration test exposed a genuine firing defect at a thin bunker corner: sampled visibility accepted a ray that real projectiles hit. Exact installation slab intersections now run before terrain ray samples, so lock/AI cannot falsely see through that corner; the clear frontal approach still passes. The fix retains physical cover and led the automatic pilot around it.

Executed PASS: `conquest-v1-migration`, `conquest-frontline`, `conquest-session`, `conquest-authority`, `conquest-controls`, `conquest-economy`, `conquest-base`, `wtest/conquest`, `conquest-view-travel`; Python harness syntax and diff whitespace. All six real authoritative missions PASS after garrison/corner changes: Oxygen 26.7s, Convoy 6.55s, Relay 16.5s, Recon 26.5s, Rescue 40s, Redoubt 23.7s (explicit epic Moonbeam/titan fixture; ordinary commands and real damage, not a beginner-duration claim). Migration and capture regressions pass. Exact final browser/full regression/CI are still pending.

New artifacts: `moonbeam-thermal-trace.json` records genuine cold-calibration shots 1/5/10/15/20 (10.79/23.72/39.72/55.72/71.72%), first vent29 and5s recovery. `weapon-ttk.json` records authored moving/firing raider/coordinator/sentinel fights for stock Pulse versus legal equipped Moonbeam; these simulation measurements supplement rendered screenshots and do not establish human feel or physical input latency.

**Release remains BLOCKED:** rerun current-head CI/browser after these fixes; capable-iPhone/Telegram dense performance and30m+20m actual mobile memory soak remain untested; continuous naturally earned browser base progression remains unproven. PHYSICAL_IPHONE_NOT_TESTED. The resource-rich base fixture and60–72min settlement model are explicitly separate evidence. Production is unchanged, no merge/deploy or payment activation.

Resume from this checkpoint on the same branch/PR53: first run the two extended browser journeys and inspect final-head CI, then strengthen continuous earned-progression and sustained performance evidence. Do not redo completed systems or treat either browser software GPU as physical iPhone proof.

## Checkpoint 8 — measured earned base, retained client proof and browser outcomes

Prior pushed checkpoint **a279bbc**. Its full unit/security/graphics/gameplay job passed (5m50s), website/verification and all signup engines passed. Both transmission jobs reached the new Relay outcome, destroyed all defenders/core, then failed because the TEST controller kept routing back toward the front approach after no targets remained. The approach workaround now applies only while a living target exists. Local full extended WebKit and Chromium390 runs PASS after that fix, including real Relay/Convoy victory, physical verified banking, base I–V, actual60s Reactor and native controls. Final CI must still confirm all engines/sizes/fallbacks. The legacy032 fixture helper now pauses ordinary input sampling during its explicit fixture replacement; two previous elapsed-time refusals were fixture races, not granted movement. Server rejection remains enforced.

**Continuous earned progression:** added `conquest-earned-journey.mjs`. Begins at the canonical new-pilot spawn/equipment with zeroCP/materials; uses ONLY normalized control commands and real actions, accelerated trusted test clock and collision-aware automated routing/targeting. No position, HP, equipment, reward, completion or direct settlement overrides. First real starter kill/physical loot/bank at1.23min; completes real Oxygen/Relay/Recon contracts repeatedly, physically returns/banks/repairs, and drives into/constructs Base I. The original2700CP recipe measured79.42min (outside target), so recipe is now **2550CP +110banked Alloy +65Biomass +8Helium**. Rerun measured **73.66min** to the first base, then continued combat to pay for Reactor; actual60s construction finishes at**80.78min**,41 verified mission completions. Reload retains all three first clears/base/module/ledger. This is measured accelerated game time with an automatic pilot, not human game-feel evidence. No production records were accessed.

`conquest-earned-browser.py` continues that exact earned save through the real authenticated Worker/fakeDB, loads and renders the earned base, drives out and back through its actual gate with native keyboard input, opens the physical terminal showing Reactor1/3, reloads/re-enters and verifies retention. PASS. It uses no resource-rich fixture endpoint. The dev-only server optionally aligns its disposable clock/save to the earned report; production APIs/auth/time authority are untouched. `earned-journey.json` and `chromium-earned-{base-retained,base-exited,reactor-retained}.png` retain proof. The accelerated reducer segment is explicitly not a continuously rendered80-minute native-input browser recording.

Recalibrated separate four-contract earning model:75/90s assumed cycles ->base**56.25/67.5min**, **4470/3390CP** remaining at3h after purchase, excluding kill loot/featured/production. Same costs used by client/server. Fixed after-action reputation reporting to equal the actual delta including daily Field Veteran recognition; a new exact-delta regression passes. Existing reputation/economies are preserved.

Executed PASS after recipe/reputation changes: `conquest-earned-journey`, `conquest-earned-browser`, `conquest-earning-model`, `conquest-base`, `conquest-economy`, `wtest/conquest`, `conquest-operations` (all six), thermal/legitimate RoF matrix in `conquest-living-war`; both extended browser engines as described above (WebKit started before the2550recipe change, identical combat; final CI will refresh its price display). Final-head broader CI is still required.

Latest software density samples: Chromium390 median35ms/p9572.6ms/worst112.9ms/one>100ms hitch,40draws/46geometries/25chunks/15living actors; WebKit390 median18ms/p9542ms/worst61ms/zero>100ms,39draws/46geometries/25chunks/15actors. Some profiling overlapped the earned simulation, so these are diagnostic software measurements, not certified isolated hardware results. Previous17actor profiles remain historical evidence; the current15 reflects removing duplicate Relay troops while retaining all14 world actors plus the real signal core. No opponent was culled to inflate performance.

**Remaining release blockers:** observe/fix final-head CI; measure dense capable-phone/Telegram performance and required30m+20m mobile-class memory/stutter soak. Software rendering still misses60FPS, and a continuous native-input first-hour human/browser feel review is not claimed. **PHYSICAL_IPHONE_NOT_TESTED.** Do not merge/deploy or call all acceptance complete. Production remains main a668e30 / previously observed build20261105034106 (live deployment not changed or newly verified).

Resume on this branch/PR53, preserving all eight checkpoints: run final-head CI and inspect its actual browser results, then finish the explicit performance/device/manual-flow gates. Session2 first line remains: `Continue from docs/conquest/CONQUEST_FLAGSHIP_EXECUTION_HANDOFF.md and IMPLEMENTATION_CHECKPOINT.md; complete Session1 release blockers before beginning Session2.`

## Checkpoint 9 — independent review, Firebase persistence and objective guidance

Checkpoint8 **a38615589f51309014aff11fcd401552d691ef09** completed the entire CI matrix GREEN: unit/shared gameplay + earned progression/browser continuation6m10s; Chromium transmission10m9s; WebKit6m38s; website/verification/all signup engines passed. The nine-checkpoint final head still requires its own CI.

A single bounded read-only authority review identified a **Critical Firebase compatibility defect**: RTDB omits empty maps, so a persisted new `base` lost its empty `modules` field and the next request tried to read `undefined.radar`. Reproduced red with a recursively Firebase-shaped save. Campaign hydration now reconstructs modules even when base already exists. A separate red concurrency test exposed the cached-response path: duplicate requests return raw stored state without campaign hydration, so `publicState` also reconstructs that empty map without advancing time, resources or simulation. Both now pass. Original populated module ranks remain intact.

The disposable Firebase emulator now supports optional empty-node pruning, enabled **only for the Conquest namespace** in Worker/browser tests. Other economy/account fixtures retain their existing behavior. Full Conquest auth/CAS tests pass with real omission semantics, including second-session/next-input, lost-reply/concurrent duplicate response, separate account/forged prices, banking, construction and production. Migration, client reconciliation, economy and base tests pass. Independent review reproduced all six authoritative victories and73.66min earned base; no other confirmed Critical/Important finding in its bounded authority scope.

Guidance now describes the actual nearby/selected/active mission and physical base, uses each activation radius, and gives accurate completion/accessibility labels. The map shows secured recon/extraction/convoy sites and the actual Command Base as well as installations. It does not reveal unexplored terrain. Existing discovery/map tests and actual onboarding/portrait control hit-zone tests pass. Earned-save browser continuation passes with Firebase omission semantics, gate exit/entry, Reactor1/3, reload and retained frontline screenshots. The intentionally accelerated test clock is aligned in both the disposable server and its client; screenshots no longer display artificial multi-month contract cooldowns. No production clock action was added.

Fresh shared regressions: economy/payment **203passed/0failed**, PvP **113passed/0failed** after the persistence changes. `wtest/conquest`, `conquest-v1-migration`, `conquest-session`, `conquest-economy`, `conquest-base`, `conquest-discovery`, `conquest-onboarding.py`, `conquest-earned-browser.py` PASS. New artifact: `chromium-earned-frontline-terrain.png`.

Read-only live verification on2026-11-05: BOTH GitHub Pages and Worker `/version.json` return **20261105034106**; anonymous Worker POST `/api/conquest/session` returns **401 not verified** with a browser User-Agent. Default Python UA encounters Cloudflare1010; that edge rejection is not reported as auth proof. Latest successful Worker deployment is [run41966681332](https://github.com/solb7403-creator/war-machines/actions/runs/41966681332), SHA **d592146dfca5ea389507ec8cd51b8cc28e1eb2f5**. Current main remains **a668e30f166d483d549f5a41ac7c18dc3ffb9760** (later repository/doc commits). Feature code has NOT been deployed, merged or written to any live account.

**Still BLOCKED:** final-head CI; capable-iPhone/Telegram dense60FPS and30mtravel/fighting+20mdense memory/stutter acceptance, plus human/manual first-hour feel review. PHYSICAL_IPHONE_NOT_TESTED. Software-renderer results are not hardware certification. Once a safe preview of this branch exists on actual hardware: enter Conquest, take the east viaduct to first contact, hold DRIVE+FIRE with Dash/Shield, complete Relay/Convoy and bank, visit/enter the earned base, and record `Conquest.view.performanceReport()` during the prescribed travel/density durations. Do not imply current production contains this branch.

Continue on **feat/conquest-living-war-v1 / draft PR53** from this checkpoint, first observing final-head CI. Keep the tested persistence fix and earned progression. Do not restart implementation or begin Session2 before the remaining acceptance is resolved.

## Checkpoint 10 — functional fortress field and regional beacon

Prior pushed checkpoint **baee36f** includes the Firebase hydration/cached-response fix. Its unit/shared/earned-browser job passed4m43s, WebKit matrix6m23s, website/signup/verification passed; Chromium is still being observed. No prior red job is called a pass.

Finished tier-specific fortress function: central shared `baseBenefits` grants Tier IV a genuine10% protective field within24m, Tier V15% within30m plus a real regional beacon (320m). Earned Defense module mitigation/radius stacks locally, capped50%; Radar stages extend Tier V beacon range to520m. Tier II/III already unlock module stagesII/III, and all tiers retain production improvements. The field mesh now matches the actual protection radius. No effect follows the pilot outside the physical base, and no weapon/enemy stats or global player boosts change. Terminal copy explains the actual effects. Pending module completion is applied before intel calculation so a finished Radar works on that same authoritative refresh.

PASS: `conquest-base` now checks real incoming projectile damage (Tier IV90% of baseline, Tier V+DefenseII65%), unchanged damage outside the field, genuine existing-actor beacon contacts and finite radar ranges. Migration/Firebase omission, Worker auth/CAS, controls, production view movement, authority and all six operations pass after these changes. Full local extended WebKit390 PASS: tiersI–V, actual60s Reactor, Relay/Convoy victories, actual verified travel/bank, engineering/laser/context loss. CI additionally asserts the visible IV/V field radius matches shared gameplay values.

Latest isolated local WebKit software sample:597frames, median16ms/p9522ms/worst45ms, zero>100ms, below50/40/30FPS6.70/1.68/.34%,39draws/46,310triangles/47geometries/2textures/25chunks/15living actors. This is stronger browser evidence but **not physical-iPhone certification or the required50-minute mobile-class soak**. Current Chromium sample remains slower. The same genuine opponents/outcomes remain; no visual-quality setting changes stats, target reach or rewards.

**Unchanged release state:** draft PR53; no merge/deploy; PHYSICAL_IPHONE_NOT_TESTED. Final-head CI must pass, and dense capable-device/Telegram frame-time plus30mtravel/fighting+20mdense memory/stutter and manual first-hour experience still need actual acceptance. Production verified unchanged at20261105034106. Continue this branch from this file; do not start over or begin Session2 first.

## Checkpoint 11 — playable disposable preview and navigation continuity

Checkpoint 9 (`baee36f`) and checkpoint 10 **b989d7251897b17b552fa8d77545622e1ad69095** both completed the entire CI matrix GREEN. Checkpoint 10 Conquest run: [41998105845](https://github.com/solb7403-creator/war-machines/actions/runs/41998105845), including all six authoritative outcomes, measured earned base/client continuation, Firebase-shaped auth/CAS, native Chromium/WebKit and Canvas matrices. Website, verification and all signup engines also passed. Final checkpoint head is being rechecked.

Added **immediately playable local preview**: `node dev/tests/conquest-server.mjs --preview` serves this branch's real client and actual authenticated Worker against the disposable in-memory Firebase emulator, with zero initial CP/materials and canonical starter gear. It rewrites only test browser API fetches to the local server; no production calls, accounts, payments or database changes. CSP blocks external connections. Static serving is restricted to game assets; `.git` and Worker source paths return404. Default bind is localhost; explicit `CQ_PREVIEW_HOST=0.0.0.0` permits a physical phone on the owner's trusted Wi-Fi. No new service or paid infrastructure is needed. Optional earned-save continuation aligns the test browser/server clock. STOP discards server test progression.

`conquest-preview.py` PASS using actual HTTP, NO Playwright request routing: real authenticated movement, zero initial resources, no production network requests and restricted paths. Earned-save HTTP preview also PASS, preserving naturally earned Base I/Reactor. Screenshots `chromium-local-preview.png`, `chromium-local-earned-preview.png`. See **docs/conquest-living-war/PLAYTEST.md** for exact launch commands, a short designer walkthrough, and remaining physical-device measurement path. This preview is not a production release or Telegram WebView certification.

Navigation continuity: an active Oxygen mission now overrides any previously selected route (a stale Relay waypoint could otherwise keep the wrong mission title/arrow). Exploration's physical beacon follows the same nearby/selected objective as guidance. Added a genuine native UI scenario: select Relay navigation via the actual map, start Oxygen at its physical site, verify the correct active objective, then complete the real combat/loot/bank/death/wreck journey. Chromium390 combat-only variant PASS. Scope metadata remains explicit; no claim that this variant repeats the complete opening/terrain segment. Production view travel, discovery/map integrity and Worker auth/CAS regressions pass.

Final local Chromium extended run PASS after fortress effects/Firebase fix: actual I–V/base/module, Relay/Convoy outcomes and physical verified banking, engineering, laser/heat/context loss. Latest isolated Chromium software profile: median34.5ms/p9580ms/worst98.1ms, zero>100ms hitches,40draws/46,390triangles/45geometries/2textures/25chunks/15living actors. WebKit previous isolated run median16ms/p9522ms/worst45ms/zero>100ms remains valid diagnostic evidence. Neither is physical-iPhone/Telegram performance proof.

**Remaining acceptance:** final-head CI; capable-iPhone/Telegram dense60FPS and30minute travel/fighting+20minute dense memory/stutter soak, plus actual manual first-hour feel review. PHYSICAL_IPHONE_NOT_TESTED. No exposed hardware GPU/device is available here (`/dev/dri` absent; no DRM devices). The local preview now makes the device review concrete without risking live accounts. No merge/deploy; live Worker/Pages remain20261105034106, Worker latest successful deploy SHA d592146dfca5ea389507ec8cd51b8cc28e1eb2f5.

Exact continuation: `Continue Session1 on feat/conquest-living-war-v1 / PR53 from docs/conquest/IMPLEMENTATION_CHECKPOINT.md; preserve all tested systems, finish the explicit device/performance/manual acceptance gates, and begin Session2 only after Session1 is accepted.` Do not restart completed work.

## Checkpoint 12 — lower replay CPU with equivalent terrain and collision

Previous implementation **b9258b43ae9e2c20a6cf5b92413078d725d61715** completed ALL CI checks GREEN, including the actual HTTP preview tests and native navigation/mission regression. Conquest run: [42000739230](https://github.com/solb7403-creator/war-machines/actions/runs/42000739230). The next head includes the measured performance optimization below and requires its own CI.

A local Node CPU profile of dense command replay identified `blockedAt`, terrain-key allocation, rock-query arrays and garbage collection as hot paths. Optimized shared World queries without changing game rules: collision-free numeric keys for padded in-world grid samples (string fallback for out-of-region queries), one cache lookup per hit, cached rock dimensions/top heights, no temporary combined rock arrays, and exact broad-phase rejection around existing oxygen/habitat shot volumes. Caches retain their existing 16,384-height/128-rock-chunk bounds. World dimensions, terrain equations, colliders, actors, AI, cadence, rewards and input/network timing are unchanged.

**Matched replay proof:** `conquest-replay-budget.mjs` uses the same genuine active Oxygen+world state after12s:16 living enemies/1 active projectile;20 canonical commands represent one game second. Separate before/after module snapshots,40 warm measured requests on local Node24: median CPU **31.105 →14.772ms** (**52.51% reduction**); median wall **29.999 →13.991ms**; CPU p95 **42.678 →29.886ms**, wall p95 **37.484 →20.368ms**. This is local replay cost, NOT per-rendered-frame time, actual Cloudflare production CPU, or phone telemetry. The earlier~57ms diagnostic used a different3s state and is not used as the matched baseline. `replay-budget.json` records exact source hashes, scenario and limits. CI now uploads `replay-current.json`; there is no flaky hardware-time threshold.

**Behavior preservation:** `conquest-world-equivalence.mjs` compared historical b925 World with current code in independent VM contexts:15,504points /93,024 shot-blocking checks, zero differences in heights/solids/occlusion. Includes first region, whole Moon, exact bunker/rock boundaries, NaN heights and out-of-region cache-key pairs. A permanent terrain-cache canary guards cross-region aliasing. The single read-only reviewer independently checked another1,362points/13,620checks, found no Critical/Important issue and verified key injectivity and predicate equivalence.

Reproduce after checking out this branch:

```sh
git show b9258b43ae9e2c20a6cf5b92413078d725d61715:js/conquest/world.js > /tmp/world-before.js
node dev/tests/conquest-world-equivalence.mjs /tmp/world-before.js
node worker/build-sim.mjs
node dev/tests/conquest-replay-budget.mjs
```

PASS after optimization: terrain/routes/cliffs, opening (unchanged28.2s visible /36.75s hostile fire /73.2s real kill-loot-bank), frontline, base/local field fairness, authority, all six actual operation victories, historical-v1/Firebase omission migration, Worker auth/CAS, production view travel, engineering/Dash/Shield/Supers, legal Moonbeam thermal matrix and actual HTTP preview. Full local extended WebKit390 PASS: physical tiersI–V, real60s Reactor, Relay/Convoy outcomes and physical verified banking, engineering/heat/laser/context loss. Latest isolated software sample:600frames, median16ms/p9520ms/worst28ms, zero>100ms; below50/40/30FPS4/.83/0%,39draws/46,310triangles/46geometries/2textures/25chunks/15living actors. No opponents were hidden or removed for these optimizations.

**Release still BLOCKED:** observe final-head CI; certify dense capable-iPhone/Telegram60FPS and30mtravel/fighting+20mdense memory/stutter on actual mobile-class hardware, plus manual first-hour feel review. PHYSICAL_IPHONE_NOT_TESTED. The old Chromium software sample is not silently relabeled as improved. No merge/deploy or production account/payment/infra changes. Main remains a668e30; live build20261105034106. Use the local preview from PLAYTEST.md for safe review; resume this branch and these exact gates without redoing finished systems.

## Checkpoint 13 — final verified implementation and precise release hold

**Tested implementation SHA: 1b9a7dc75e26e95261206ac4a233022c2d801066. Branch build: 20261105164144. This checkpoint changes only documentation/evidence; the game, Worker, tests and workflows remain identical to that tested code.**

All eight GitHub checks PASSED: Conquest unit/shared gameplay/earned progression/portrait/actual HTTP preview; full Chromium and WebKit transmission, native controls and fallback matrices; website, verification and all three signup engines. [Conquest run 42067106968](https://github.com/solb7403-creator/war-machines/actions/runs/42067106968). Exact check URLs/completion times: `docs/conquest-living-war/ci-acceptance.json`. Fresh local checks at the same implementation SHA: economy/payments **203 passed / 0 failed**, PvP **113 passed / 0 failed**, accounts **18 passed**; all use disposable fixtures. No production player data was tested or changed.

Implemented and practically verified: sustained differentiated combat (Moonbeam 29 baseline / at least 25 tested legal-RoF shots); readable persistent thermal state and pooled laser/Supers; native drive/fire/abilities; 14 persistent authored world actors with bounded nearby AI; six distinct real authoritative missions and genuine garrison capture; physical salvage/banking/death/wreck loop; rotating contracts, persistent territory/reputation/free achievement trim; six-rank engineering; physical personal base I–V and six finite modules, genuine fortress fields/beacon/repair/banking/production/intel; safe historical/Firebase migration and replay/CAS protections; bounded/adaptive rendering/streaming and substantially lower equivalent replay CPU. Prior source-level Critical Firebase omission bug is fixed and tested, including cached responses.

Continuous canonical zero-resource starter simulation reaches Base I at **73.66 accelerated game minutes**, paid Reactor completion at **80.78**; exact earned save then passes real authenticated browser reload and native keyboard base gate exit/entry. This is not claimed as an 80-minute continuously rendered native-input or human playthrough. Native browser outcomes independently complete Relay and Convoy with real rendered-hull clicks, actual travel and verified banking. Resource-rich I–V visual fixtures remain separately labeled.

**Latest CI software measurements, from successful run logs (not phones):** WebKit 3D320/390 median16ms, p9517ms, worst22/21ms; Chromium320 3D median16.7ms/p9518ms/worst28.9ms, Chromium390 3D median16.9ms/p9528.2ms/worst39.7ms; Canvas390 Chromium16.7/16.8/19.2ms. All six samples had zero >100ms hitches and retained15 living actors/2 real projectiles. WebKit ratios1x, Chromium3D.75x; 3D39draws/~46.3ktriangles/25chunks. See `ci-performance.json` and VERIFICATION.md for full percentages, counters and scope. These are 10-second scenario profiles, not the prescribed long device soak or maximal Session2 raid certification. Artifact ZIP retrieval returned Azure403 in this execution environment; successful GitHub run logs supplied the committed metrics, and full artifacts remain linked from the run. No unavailable artifact data was fabricated.

**Production rechecked read-only after completion:** Worker and Pages `/version.json` both200/build **20261105034106**; anonymous Conquest session401/`not verified` with a browser UA. Latest successful Worker deployment remains [41966681332](https://github.com/solb7403-creator/war-machines/actions/runs/41966681332), SHA **d592146dfca5ea389507ec8cd51b8cc28e1eb2f5**. Main remains **a668e30f166d483d549f5a41ac7c18dc3ffb9760**. This branch was NOT merged/deployed. No payments, live accounts, economies or paid infrastructure were changed.

**Exact remaining acceptance (Session1 is NOT release-certified):**
1. Actual capable-iPhone Safari and Telegram dense combat/frame-time/input acceptance, including the prescribed 30-minute travel/fighting +20-minute dense mobile-class memory/stutter soak. No physical phone, Telegram session or hardware GPU is exposed here: **PHYSICAL_IPHONE_NOT_TESTED**. Software near60FPS results cannot certify those devices.
2. Hands-on first-hour player/game-feel acceptance. Recorded automatic input journeys, screenshots, TTK/thermal traces and earning simulations are useful evidence; they do not replace this observation.

No known failing functional/CI test remains at the tested implementation SHA. Use **docs/conquest-living-war/PLAYTEST.md**: `node dev/tests/conquest-server.mjs --preview` is immediately playable against a disposable local database; optional Wi-Fi binding supports actual Safari review without production accounts or a deployment. Earned-save continuation is provided. The owner has already authorized validated merge/deployment; this hold is missing acceptance evidence, not missing permission. After obtaining that evidence, fix any actual defects on this branch, revalidate changed code and use the existing merge/deploy workflows without asking for redundant approval. Do not enable uncertified payments.

**Exact continuation line:** `Continue Session1 from docs/conquest/IMPLEMENTATION_CHECKPOINT.md on feat/conquest-living-war-v1 / PR53; preserve tested implementation 1b9a7dc, finish the two remaining acceptance gates, then begin Session2 from the full committed brief.` Do not redo completed work or treat Session1 as already released.


## Checkpoint 14 — Session2 integrated gameplay and cloud art (November5 owner refinement)

Active branch: `feat/conquest-territory-endgame-v1`, continuing Session1 `1ce9135`. Session1 PR53 was freshly checked open/draft at1ce9135; main a668e30. No Session1 merge/deployment is presumed. The owner explicitly superseded physical-device/60FPS blockers for implementation; historical measurements and holds are preserved. Read the new acceptance addendum. Existing optional hardware follow-up is not a third gameplay session.

Committed slices: fc11bac authority/rewards/defenses/shared campaign;2eb6e24 all25physical raids/five commanders/ninecover boxes;16ee92a real territorial invasions and durable shared milestones;ac689ad actual invasion victory proof;57d7ef3 public roll privacy; aeb5f6d reachable drone loot;3d2963e genuine airborne drone simulation and all25 rerun. Parent integration adds actual map/briefing/base-defense/catalog/equip UI, pooled warning circles/countdown, distinct airborne/commander art, original Blender command/raid HIGH/LOW assets, constrained GLB loader and runtime integration.20 products have real3D/Canvas art and server-earned entitlement/equip; live checkout disabled.

Fresh evidence: all25 authoritative victories; base and sector incoming defenses; six legacy mission victories; existing broad Conquest/shared graphics/equipment/Arcade regression; economy/payments203/0, PvP113/0, accounts18passed. Continuous canonical starter still earns BaseI73.66accelerated game minutes. Actual Chromium/WebKit native journeys and new raid-family captures are in progress/results under docs/conquest-session-2. See feature-matrix.json, VERIFICATION.md and CRITIC.md; failed browser controller attempts stay explicit. Cloud Blender4.3.2 exported the1732B12triangle smoke GLB and real Three imported/rendered it. Source.blend/script and4optimized GLBs retained.

Release is not certified. PHYSICAL_IPHONE_UNVERIFIED; actualTelegram, long physical/mobile-class30+20minute memory/thermal soak, first-hour human feel and owner artistic acceptance remain unverified. Paid Conquest SKU end-to-end certification absent; checkout disabled. Async PvP base raids and coordinatedhuman world bosses unavailable. No production accounts/payments/token/airdrop/referral changes. No merge/deploy.

Next: finish the currently running native raid/base/catalog/reconnect journeys and fix genuine failures; capture final isolated per-viewport profiles and preserve exact limitations; run final-head regression/CI, update proof matrix and checkpoint, push/open one reviewable integrated PR. Resume this same branch/code; do not redo completed mechanics. The lead continues alone after the latest user steering. All unpushed parent integration must be committed/pushed before another handoff.


## Checkpoint15 — complete native raid families, exact earned continuity and Canvas correction

Integrated PR: https://github.com/solb7403-creator/war-machines/pull/54, branch feat/conquest-territory-endgame-v1. Pushedc38cad7 after metadata-only GH007 privacy correction; mapofoldlocalcheckpoints in docs/conquest-session-2/commit-map.json. All Session1 ancestry/content preserved. User restored the normal parallel workflow after lead-only continuity, so finalbrowser/soak, CI and finalfreshreview run independently with nonoverlapping files.

Actual native results now PASS: Chromium390 Interception/Sabotage/Battery +base defense, earned cosmetic equip and exactCP/shards/ownership retention; WebKit320 Siege and WebKit430 Extraction with earned equip/reload.25authoritative raids freshly rerunafterrealairborneflight:all25PASS. BaseI-V andactualBlenderGLB integration/earnedMonolith equip/reload captured320/390/430/1280; all20catalog actual3D previews pass. Exactzero-resource starter save continuedintoactualsix-killbase defense10.25game sec,1533.4HP,160CP andearnedcommanderstandard. Native390Canvas realHTTP then drives toRefuge,banksactualdefensecargo,equipsstandard,racestwoidenticalauthenticatedactionsandreloadswithnoCP/bank/history/entitlementduplication. No newresource,gear,health,positionoroutcomefixturesinthatcontinuation; earliercombatremains explicitlyshared-reducerproof.

Finalreviewcaught invisiblephysicalraidcover inCanvasfallback. Fixedbydrawingallninecovervolumesfromtheexactauthoritativefootprints/heights plusactivecollectionnodes/beacons andserver salvage/wreckcues. Newblack-boxrealCanvas+realThree projectiontest firstfailed dust-longroof; nowallnineprojectedroofs/nodes/cachesPASS. Nochange tocolliders,AI,damageorcounts. New2Dnativevictory andfreshvisualrecheckpendingatthetimeofthischeckpoint.

InitialPR54CI:mainConquestunit/portraitjobpassed,website/lab/assetworkflows passed; bothtransmissionjobsfailedoldjourneyassumptions. Chromium032mustnativelyopentheoperationsboardbeforeselectingrelay. WebKit033strictviewportheightcheckneedssettledresizeproof; exactinitialboundsoverflowmustbediagnosedbeforeclaimingpass. CIagentownsfocusedtests,notproductlayout. FreshheadCIstillrequired.

PaymentsDISABLED,asynchronousplayerbaseraids/worldbossunavailable,PHYSICAL_IPHONE_UNVERIFIED. No merge/deployorproductionaccount/payment/tokenchanges. Finalbrowseragentperformingboundedcloudmemory/stuttersoakwithactualdurationandfixture scope recorded; neverclaimphysicalcertification. Next:finishCanvasnative/resizeCIchecks,matchedlabel-blindedruntimecomparisonandsoak,recordfinalproofandteststatus,pushandobservefinal-headCI. Preserveallcompletedcode; donotrestart.


## Checkpoint 16 — Claude Code continuation: CI relay fix, playable raid flow and authored raid doctrine (in progress)

Branch `feat/conquest-territory-endgame-v1` / PR #54, continuing verified Codex head `e75efbf`. Build `20261106005808`. All Session 1/2 systems preserved; no economy, payment, token, airdrop or account change.

- **CI defect (transmission chromium, `conquest-session-032.py:72`) — real cause was UX, not only the test.** Session 2 moved all 31 operations, including the six opening field missions, into one collapsed `<details>` with no visible disclosure state, and buried the region canvas ~1.4 screens down. Fixed in `js/conquest/app.js` `map/frontline/operationRow`: map canvas + controls first; FIELD MISSIONS (6) always visible with NAVIGATE/BRIEF; RAID OPERATIONS collapsed with ▸/▾ affordance, grouped by the five physical sectors with per-sector cleared counts. Canvas draws one legible marker per raid site (five families) and sector-defense markers only during a real alert (previously 25 overlapping labels and permanent defense diamonds). Local `python dev/tests/conquest-session-032.py --engine chromium`: PASS 320/360/390/393, exit 0.
- **Raid site chooser.** All five families at a site are in range together, but the HUD offered only the nearest. `#cq-mission-access` now reads `CHOOSE OPERATION · N READY HERE` and opens `siteOperations()` with first-clear/repeat CP and records; nearest *ready* contract is preferred over a cooling one. `conquest-flagship-browser.py` now uses this natural arrival path.
- **After-action report.** Victory was a text block in a fixed 480px dialog and froze on `PENDING VERIFICATION` if the settlement arrived a frame later. `afterAction()` renders the authoritative settlement as reward tiles (CP/materials/reputation/shard), settlement kind, shard bar, elite-roll outcome, cargo-banking warning and nearby salvage caches; re-renders when the settlement lands. Browser test asserts the CP tile equals `state.settlement.cp`.
- **Authored raid doctrine (shared authoritative sim, `js/conquest/combat.js`).** HARD sites call one telegraphed reinforcement wave (2 raiders), VETERAN sites up to two (second: raider + breacher, only if the objective is still open 25s after the first landing). Waves land at two validated authored drop zones per raid once the site is clear and the objective hold begins (sieges: after the general falls), shown 4s ahead as a red landing zone that damages occupants (Shield mitigates, leaving avoids). VETERAN commanders below 40% hull shorten their telegraphed cadence ×0.65. **Reinforcement kills create no salvage** (`worker/src/conquest-economy.js` `noLoot`); authored payouts unchanged and asserted. New `dev/tests/conquest-raid-doctrine.mjs` (added to CI).
- Evidence: `conquest-raids.mjs` all 25 authoritative victories; median 38.95s (was ~28s), median 6 kills (was 4), minimum remaining hull 884/2958 (was 1382); refreshed `docs/conquest-session-2/raid-evidence.json`. Replay controller gained a progress watchdog after a slope local-minimum stall at battery-4 (node proven reachable to 0.6m; not a level defect). Calibration: browser bot on VETERAN Ash Sabotage won 2/3 on original code and 1/2 on final doctrine before a worker restart — the hardest raid is meant to demand Shield/Dash play; HARD raids remain comfortable.
- Tests this checkpoint: full Node Conquest list 37/37 PASS (pre-final-tuning run) and focused doctrine/authority/drones/loot/sector/defense/economy/canvas/UI/earned-journey/wtest PASS on final code. Pending before push of next checkpoint: full regression rerun, flagship Chromium 390 + WebKit 320 siege browser journeys on final code, observe PR CI.

PHYSICAL_IPHONE_UNVERIFIED. Checkout DISABLED. No merge/deploy at this checkpoint.


## Checkpoint 17 — CI follow-ups, spawn hitch removal, hull readiness and software soak

Commits after Checkpoint 16: `ec12b86` and the commit containing this entry. Build stamped by `dev/bump.sh` in that commit.

- PR CI on `f497008`: `conquest`, `transmission (webkit)` and all other checks green; `transmission (chromium)` passed 032/033 and then failed `conquest-living-war.py:186` — the new site chooser grouped the Convoy with the Oxygen Line's 150m activation radius. Fixed: the chooser only groups ready operations within 20m of the nearest (the co-located raid families). Local `conquest-living-war.py --engine chromium`: PASS.
- PR CI on `ec12b86`: all green except `transmission (chromium)` at `conquest-flagship-browser.py` raid 3 (battery-1): hull carries over between operations and the bot chained three raids without repairing, entering at 40% and dying when the wave landed. Real fix on both sides: players now see `HULL n%` readiness with a repair warning below 60% in the site chooser and every briefing; the bot takes the genuine Refuge route and REPAIR HULL when below 60% (no HP fixture). Local flagship Chromium 390: PASS, 4 native victories, one real Refuge repair before battery-1 (1670/2958).
- Enemy hull/weapon geometry cached per silhouette (view-owned, disposed at teardown; Canvas fallback skips) and the four raid archetypes prewarmed in exploration: repeat spawn build 9–62ms → ~0ms. Base-cost overlay hidden during operations.
- Software soaks (Chromium SwiftShader 390, one long-lived page): 21 raids/18.3 min and 13 raids/10.7 min, all victories, zero page errors, bounded heap/geometry/texture/DOM. Hitches attributed to the test bot's in-page A* plus the briefing-to-battle transition; zero over-100ms combat frames without bot input. Evidence: `docs/conquest-session-2/hitch-attribution.json`, `soak-raid-chromium390-*.json`, VERIFICATION.md addendum.
- Re-verified locally: full Conquest Node list, doctrine test, 25/25 authoritative raids, economy/payments 203/0, PvP 113/0, accounts 18; Chromium 032 / living-war / flagship journeys. WebKit unavailable in this container (download blocked) — covered by PR CI.

**Release decision recorded:** not merged or deployed. The owner authorized validated release subject to the repository's gates; the documented gates (Checkpoint 13, feature-matrix 8.x/9.x `BLOCKED_RELEASE`, SMOOTHNESS addendum) still require physical capable-iPhone Safari + Telegram dense-combat acceptance and owner hands-on first-hour feel, which cannot be exercised from this cloud container. PHYSICAL_IPHONE_UNVERIFIED. Checkout DISABLED. Production remains on its existing build.

**Exact next steps:** (1) owner plays the preview (`node dev/tests/conquest-server.mjs --preview`, Safari on the same Wi-Fi via `CQ_PREVIEW_HOST=0.0.0.0`; see docs/conquest-living-war/PLAYTEST.md) or a staging build on a physical iPhone/Telegram, sampling `Conquest.view.performanceReport()` during a VETERAN raid; (2) fix any device defects on this branch; (3) with acceptance recorded, merge PR #54 with the existing workflows and verify `/pvp/health`, `version.json` and the Worker deployment. Do not enable uncertified payments.


## Checkpoint 18 — raid hitch root causes fixed; owner-approved release path

Owner (2026-11-06): release approved now; there are no live players yet, production is the owner's playtest environment, and the physical iPhone/Telegram and hands-on gates move to after deploy. Exactly one independent read-only reviewer for this PR (owner instruction; AGENTS.md's two-reviewer variant for balance changes is superseded by that explicit limit). Payments stay disabled.

**Profiled causes of 100–230ms raid frames (CDP CPU profile + Chromium trace, Chromium 390):**
1. Adaptive LOD (`autoLow`) flips during raids rebuilt the player vehicle and raid art; disposing their Equipment3D materials destroyed the shader programs, so the next frame recompiled them (measured 193ms first frame after rebuild).
2. First use of raid-only programs/pipeline states mid-raid (Blender raid art MeshStandardMaterial, effect/telegraph/target materials): three's first-use link/info-log step forced a synchronous wait.
3. Harness-only: the browser bot's in-page A*, mid-raid screenshots and the co-located local Worker emulator competing for the same 4 CPUs as software GL.

**Fixes (`js/conquest/view.js`, presentation only — no gameplay, timing or reward change):** `keepPrograms()` keeps one compiled clone per program for the view's lifetime (bounded by distinct programs, disposed at teardown) and runs before every vehicle/raid-art rebuild and periodically; `warmItem()/warmDraw()` pre-compile AND draw once (1×1 scissored corner, isolated camera layer with scene lights so keys match) raid art HIGH/LOW, effects, hazards, target/shield wireframes, objective/drone/commander hulls during calm exploration; `flushWarm()` completes the rest whenever any modal opens (`dialog()` in app.js), so no raid can start unwarmed. Results: zero shader programs created during a full raid (was 9 creations); vehicle LOD rebuild first frame 193ms → 1.2ms; raid-art first frame after warm 1.4ms.

**Soak (`dev/tests/conquest-raid-soak.py`, new reproducible harness; bot A* in a Web Worker, no mid-raid screenshots, local emulator at low priority):** Chromium 390, one page, 14 HARD+VETERAN raids / 13.1 min: 24,609 combat frames, 5 over 100ms (0.02%; worst 152.8ms, first raid of the session), heap 36–40MB, geometries 53–61, programs 10–10, zero page errors. The rig's own idle floor is ~1 frame ≥100ms per minute (software GL). Result is software evidence only. 7 soak raids ended as bot failures after minute 6; targeted same-session reproductions (death → respawn → next raid, VETERAN then HARD) all won, so this is recorded as an unexplained harness/bot outcome, not a reproduced game defect. 320 soak not run (owner: no further soaks).

**Independent pre-merge review (single read-only reviewer, head 9c60717) and fixes:**
- BLOCKER fixed — Refuge home sector could be lost permanently (no raid recaptures it; sector defense required humanity ownership). `ConquestCombat.sectorDefenseOpen` (shared authoritative rule) now also opens the same physical defense as a RETAKE for sectors with no raid objective after a lost invasion; server gate, warfront button, HUD action and map marker use it. Test `conquest-frontier-recovery.mjs` (in CI): abandoned defense → real loss → physical retake → secured, one authored reward, no reconnect duplication.
- SHOULD-FIX fixed — captured sectors suppressed patrol respawns, emptying the world (1/14 actors). Patrols keep their Session 1 20-minute refresh; garrisons in captured sectors stay down (test: 4 live patrols, 10 suppressed garrisons).
- SHOULD-FIX fixed — every Conquest request read the shared warfront document. Bounded per-isolate cache (30s, 5,000 pilots, keyed by env): unchanged scores reuse the newest aggregate; any new contribution still CASes immediately (test asserts read reduction).
- SHOULD-FIX (docs) fixed — feature-matrix 3.5 relabelled NOT_IMPLEMENTED_SAFE; 1.3 now has a RECOMMENDED STRENGTH briefing line backed by tested evidence.
- SHOULD-FIX recorded as OWNER DECISION — raids from minute 0 likely allow Base I in ~15–25 min (reward-table estimate) vs the 45–75 min target (4.3/7.4 → OWNER_DECISION_PENDING). Economy/progression retuning is not changed without owner approval.
- Notes retained: Session 1 removal of Conquest daily caps; soak bot defeats; minor per-frame allocations; two evidence-writing Node tests.
Affected suites rerun locally (all PASS): frontier-recovery, warfront, wtest/conquest-war, sector-authority, sector-victory, war-authority, garrisons, living-war, frontline, opening, authority, v1-migration, flagship-ui, raid-doctrine, wtest/conquest.
- CI on fa8cf07: `conquest` green; `transmission (webkit)` failed at the third raid's site chooser. Cause (real, client): `RETURN TO EXPLORATION` removed the result dialog only on an acknowledged action; a transient failure followed by a resync that had already returned the pilot left a stale result dialog, which made every later briefing/chooser silently refuse to open (`dialog()` callers return while a dialog exists). Fix: return closes the dialog when the server state shows no mission, shows the error otherwise, and a per-frame guard removes stale victory/defeat dialogs (no mission, no battle) and stale death dialogs (respawned). The flagship journey now asserts the dialog closes and re-taps like a player. Local Chromium 390 flagship: PASS (4 native victories).


## Checkpoint 19 — RELEASED to production (owner-approved, 2026-11-06)

- PR #53 (Session 1) merged as `f6305ab`; Worker deploy run 42174755836 SUCCESS; live `/pvp/health` `{"ok":true,"v":4}`, live `version.json` `20261105164144` = repo; Pages build 42174754987 SUCCESS.
- PR #54 (Session 2 + this continuation) merged as `185e316` at CI-green head `80698a3` (all 9 checks green; signup-browsers (webkit) re-run once after a runner hang in its Install step, then passed in 2.5 min). Worker deploy run 42175258409 SUCCESS (server tests, Workers-runtime live-match smoke test, deploy); live `/pvp/health` `{"ok":true,"v":4,"open":0,"waiting":0,"queues":[]}`; live `version.json` **`20261106055908`** = repo. GitHub Pages build 42175257429 SUCCESS for `185e316`. No revert required.
- Production is the owner's playtest environment (no live players yet). Payments/checkout remain DISABLED. No production accounts, payments, token, airdrop or referral data were changed.

**Still unverified after release:** PHYSICAL_IPHONE_UNVERIFIED (Safari + Telegram dense combat, input latency, thermal), the 30-minute exploration + 20-minute dense physical soak (only software soaks exist), the 320-width software soak (not run per owner), owner hands-on first-hour feel. **Owner decision pending:** raids from minute 0 may allow Command Base I in ~15–25 min versus the 45–75 min target (feature matrix 4.3/7.4). Known notes: Conquest daily caps removed in Session 1; 7 unexplained soak-bot failures; minor per-frame allocations in `view.js`.

**Agents used this session (AGENTS.md rule 5):** one independent read-only pre-merge reviewer on `9c60717` — delivered 1 blocker + 4 should-fix + notes; changed the result (Refuge permanent-loss blocker, patrol respawn, warfront read load and matrix corrections were fixed before merge; first-base timing escalated to the owner). Two earlier reviewers were started before the owner's one-reviewer instruction and were stopped without delivering results.

**Next:** owner plays on iPhone Safari and Telegram (raids, site chooser, after-action report, reinforcement waves, Refuge defense/retake, Command Base, collection with checkout disabled) and reports defects; fix on a new branch from `main`; decide the first-base timing question.


## Checkpoint 20 — owner iPhone/Telegram playtest fixes (build 20261106233738, branch `feat/conquest-playtest-fixes-v1`)

Owner playtest of live build 20261106055908 reported five problems; all five are implemented on this branch (commits `6482135`, `a8dafab`, `2c51adf`, `5fa95eb` + this checkpoint). Payments stay DISABLED. Map/world graphics untouched (separate later session).

1. **Driving (choppy, Dash snapping back, freezes) — root causes measured, fixed.**
   - Resync snaps/freezes: the client sent ~1 req/s but underestimated server credit by the RTT while the Worker discarded credit above 1.25 s; the queue crossed the 40-command limit every ~8 s at 400 ms RTT, cleared prediction, froze the view (dt=0) and snapped the hull back 9–14 m (Dash-sized). Worker now keeps a 4 s real-time reserve (`MAX_CREDIT_MS`) and accepts 40 steps/request (simulated time still never exceeds wall time); client pumps when due or backlogged, pauses (never discards) only past a 6 s backlog.
   - Prediction drift: the client stepped by variable frame dt vs the Worker's fixed 50 ms steps. The client now predicts in the same fixed steps with exactly the Worker-validated command (`ConquestControl.command/validated`), so reconciliation reproduces prediction bit-for-bit. Render shows the hull a partial step ahead (`ConquestControl.preview`), other actors interpolated, shots led along velocity.
   - Actions no longer freeze driving (flush only earlier commands; server-rejected actions no longer resync). Camera height/obstruction easing, smoothed hull heading/attitude. Terrain chunk/horizon generation time-sliced (3 ms/frame, identical output; World equivalence vs main: 93,024 checks, 0 differences). HUD per-frame DOM writes memoized.
   - Evidence: new `dev/tests/conquest-netcode.mjs` — at 120/400/800 ms RTT + jitter, 7 Dashes, 0 reconnects, 0 frozen frames, max correction 0 m; 2.5 s stall absorbed; rejected action mid-drive causes no freeze. Baseline on main with the same harness: 4–5 resyncs/30 s, 11–14 m snaps, up to 355 frozen frames. Streaming worst frame 26 → 7.8 ms, frames >8 ms 19 → 0 per 90 s (desktop Node, not a phone).
2. **Finding home.** NAVIGATE · REFUGE / NAVIGATE · COMMAND BASE on MAP and MORE (HUD arrow + distance), long-range cyan/gold light columns over the Refuge terminal and Command Base (also in 2D fallback), bold YOU marker with heading, labels and a dashed route line on the map.
3. **Travel.** Worker-authoritative `fast-travel` between Refuge, Command Base and every held sector; departs only from a network node with no hostile within 60 m, no damage for 10 s (Worker `lastHitAt`), not in an operation; arrival picks a clear candidate. Position only (cargo unbanked). Map size unchanged. Measured drivable routes: beyond the home perimeter every main route already passes within 70 m of a hostile/operation; `road-intercept` (which doubled up on the Crossroads camp) moved to the home south exit: Helium/Ash routes' longest empty stretch 111/104 m → 72 m (the protected home perimeter). Existing saves re-home that patrol only while calm and out of view. Test `conquest-fast-travel.mjs`.
4. **Raids.** Unlock only after verified clears of all six field missions (Worker-enforced; UI shows LOCKED n/6). Enemy-only doctrine by danger (`ConquestCombat.raidDoctrine`): hull/damage multipliers, extra garrison behind the objective, HARD 2 / VETERAN 3 telegraphed waves (VETERAN may land mid-fight), faster strikes, earlier enrage; sentinels take half the hull bonus and no damage bonus; waves never add a sentinel where one is fielded. Forces are identical against starter and top-tier gear (asserted); added units carry no salvage; payouts unchanged (asserted). Scripted-pilot calibration (authoritative replay, no Dash): starter HARD 10/10 → **7/10** wins (10–54 % hull left), starter VETERAN 10/15 → **1/15**, Epic Moonbeam+Titan VETERAN 15/15 → **12/15**, Epic + maxed engineering **15/15**; every raid proven completable with legal upgrades (`conquest-raids.mjs`, `docs/conquest-session-2/raid-difficulty.json`).
   - **First Command Base (modeled, `conquest-first-base.mjs`, `docs/conquest-session-2/first-base-model.json`): brisk pace 24.5 → 33 min; ordinary pace 32.7 → 44 min (old rule → owner rule).** Still below the 45–75 min target with raid rewards unchanged; closing the rest needs an economy decision (owner).
5. **Base access.** Tier upgrades and module construction can be queued from the MAP anywhere outside an operation (banked resources only); MAP shows tier, exact daily production (shared `baseProduction`), next batch, construction, banked totals. Banking, collecting production, first build, repair and defense deployment still need the physical base. **RECALL**: Worker-verified 15 s channel of simulated play; damage, death or starting an operation breaks it; wall time alone never completes it; cooldown 10 min, 5 min for current-season premium Lunar Pass owners (read server-side from the eco record via `passPremium`); cargo stays unbanked. Test `conquest-recall.mjs`.

**Tests run (local):** new netcode, fast-travel, recall, first-base; updated authority (4 s reserve/40-step bounds), view-travel (eased heading), raid doctrine, raids (25 completable + bands), base (remote upgrade). Also PASS: adaptive, combat, controls, threat, living-war, opening, frontline, garrisons, operations, flagship-ui, canvas-contract, economy, session, session-033, replay-budget, world-equivalence (vs main), v1-migration, frontier-recovery, sector/war authority, earned journey/defense, earning model, long progression, defense config/victory, sector victory, cosmetics authority, drones, airborne loot, raid layouts, wtest conquest + conquest-war. **Browser:** one Chromium 390×844 journey (SwiftShader) on a disposable local DB: drive + 3 Dashes with 8 reconciliations and 0 m max correction, MAP routes/fast travel/remote base/raid lock, fast travel base→Refuge, HUD NAVIGATE to base (88 m), remote tier upgrade from 88 m, RECALL → base with 600 s cooldown, no page errors, no horizontal overflow. Browser test fixtures that start raids now set `fieldMissions:true`. WebKit and the CI browser matrices run in PR CI. No soaks (owner).

**Still unverified:** PHYSICAL_IPHONE_UNVERIFIED (the driving fix is proven against the Worker with simulated phone latency, not on a phone), owner hands-on feel of the new raid difficulty, first-base 45–75 min gap (owner decision).

**Independent pre-merge review (AGENTS.md: 2 read-only reviewers for a combat-balance change, given only branch/SHA/briefs/checkpoint, head a9527c1):**
- Gameplay/performance reviewer — BLOCKER fixed: a network stall over ~6 s left `stalled` set forever (it was only recomputed in `enqueue`, which a frozen view never calls), freezing driving while showing SECURED. `unstall()` now runs in `pump` and after every flush; netcode test adds 6.5 s and 8 s stalls (pause 75/161 frames, then resume, 0 reconnects, 0 m correction). SHOULD-FIX fixed: HUD wave counter now uses the doctrine wave count; camera pull-in is instant again (only easing back out is smoothed); treads/heading follow real travel, not the correction easing back. NOTES fixed: Dash no longer trips the teleport snap; taps latched during a freeze are dropped; presentation `aim()` no longer mutates predicted `turretYaw`/`lockId`. Accepted notes: enemies drawn interpolated one step behind the hull (visual only); calibration is one deterministic scripted run per raid without Dash; western-layout HARD raids lost by starter gear while helium-layout ones won (layout geometry); the gold beacon marks the base site before a base exists (intended as a build-site guide).
- Security/economy reviewer — no blockers. SHOULD-FIX fixed: fast travel's 10 s quiet window was wall-clock, so a client could satisfy it by pausing; quiet time is now simulated play since the last hit (`quietMs`, reset by damage), tested including the pause exploit. SHOULD-FIX fixed: Worker test now asserts raids are refused at 0..5/6 field missions and start at 6/6. NOTE fixed: premium Lunar Pass reads are cached per isolate (60 s, bounded, errors not cached) so recall spam costs no extra account reads. Recorded notes: damage detection is a net HP drop per 50 ms step (in-step regen can mask a tiny hit on tanky builds); the Refuge stays in the travel network even if its sector were lost (consistent with `atTerminal`); inherited eco migration can copy `pass.prem` from an old device save (flagged in eco.js, pre-existing).
- **First-base model caveat (reviewer):** `conquest-first-base.mjs` keeps per-cycle driving time and does not credit fast travel, RECALL or remote base command, so real play may reach Base I faster than the modeled 33/44 min.

**RELEASED (owner-approved green CI → merge → deploy → verify, 2026-11-07):** PR #57 merged as `7772d28` at CI-green head `1535661` (all 8 checks green: conquest, transmission chromium + webkit, signup-browsers chromium/webkit/firefox, website, verify). Worker deploy run 42339335756 SUCCESS (server tests, Workers-runtime live-match smoke test, deploy); live `/pvp/health` `{"ok":true,"v":4,"open":0,"waiting":0,"queues":[]}`; live `version.json` **`20261106233738`** = repo. GitHub Pages run 42339335410 SUCCESS for `7772d28`. No revert required. Payments/checkout remain DISABLED; no production accounts, payments, token, airdrop or referral data changed.

**Agents used (AGENTS.md rule 5):** two independent read-only pre-merge reviewers on `a9527c1`, given only branch/SHA/briefs/checkpoint. Gameplay/performance reviewer: 1 blocker (permanent freeze after a >6 s stall) + 3 should-fix + notes — changed the result (all fixed before merge). Security/economy reviewer: 0 blockers, 3 should-fix (wall-clock fast-travel quiet window exploitable by pausing; missing raid-gate refusal test; first-base model caveat) + notes — changed the result (fixed or recorded). No other subagents.

**Next:** owner plays the live build on iPhone Safari + Telegram: driving/Dash feel at real latency, NAVIGATE + beacons, fast travel, RECALL, remote base command, raid lock after the six field missions and the new HARD/VETERAN difficulty. Owner decision still pending: first Command Base modeled at 33–44 min vs the 45–75 min target with raid rewards unchanged. Fix device defects on a new branch from `main`. Map/world graphics remain a separate later session.


## Checkpoint 21 — Conquest graphics overhaul (branch `claude/lunar-conquest-graphics-431xgv`, from main `20ecbe1`) — Phase 1 decision

Owner brief (2026-11-07): significantly better graphics everywhere in Conquest (terrain, sky/lighting, props, Refuge, Command Base I–V, enemy bases/turrets, player tanks, enemies, VFX, region MAP) with a true LUNAR identity — grey regolith, craters, black sky with Earth on the horizon, neon base lighting, glowing Parasite structures; trees, cabins and the map rebuilt or replaced. No gameplay, economy or hitbox changes. Payments stay disabled.

**Phase 1 (visual options, AGENTS.md 2b).** Dev-only harness `dev/conquest-style/` (lab.html/lab.js, capture.mjs, contact-sheet.py, README contract): every option renders the same canonical subjects — real `ConquestWorld` terrain and scenery placement, collision footprints, the stock HF tank kit, fixed cameras and the in-game map dialog — at 390×844 and 1280×800, HIGH and LOW (Chromium SwiftShader, relative cost only). `current` is a 1:1 port of the live look. Three agents each built one option in its own folder: A "Tranquility · hard-sci realism", B "Neon Frontline · stylized sci-fi", C "Iron Siege · war-torn front". All three agents hit the account's 5-hour usage limit once and were resumed from their saved state; each finished with 24/24 captures and no page errors.

Contact sheet (live build vs A vs B vs C, every subject, 390 HIGH large + 390 LOW + desktop HIGH/LOW): [`docs/conquest-graphics/phase1/contact-sheet.jpg`](../conquest-graphics/phase1/contact-sheet.jpg).

| option | HIGH draws 390 / 1280 | HIGH tris | HIGH tex | HIGH programs | LOW draws 390 / 1280 | LOW tris | LOW tex | LOW programs | map first paint / repaint |
|---|---|---|---|---|---|---|---|---|---|
| live build | 43 / 94 | 92k | 4.6 MB | 9 | 43 / 94 | 68k | 0.2 MB | 7 | 54–61 / 9.8 ms |
| A Tranquility | 65 / 108 | 170k | 6.2 MB | 13 | 52 / 93 | 118k | 0.6 MB | 9 | 141–423 / 1.4 ms |
| **B Neon Frontline** | **48 / 94** | **132k** | **5.6 MB** | **10** | **47 / 86** | **100k** | **0.4 MB** | **7** | **83–179 / 0.7 ms** |
| C Iron Siege | 51 / 92 | 164k | 6.8 MB | 12 | 49 / 88 | 140k | 0.9 MB | 10 | 99–134 / 0.9 ms |

(4.5 MB of every HIGH texture figure is the existing HF tank atlas/environment the live build already loads.)

**Owner change:** the lead picks the winner itself (theme fit, phone combat readability, wow factor, mobile performance), records it here, deletes the unused options and continues straight to Phase 2.

**Decision: B "Neon Frontline" is the base style, plus C's lettered map grid.** Reasons:
1. *Theme fit* — B reads literally as the owner's identity line: black sky with a large Earth and atmosphere halo on the horizon, cratered grey-charcoal regolith, neon cyan human bases (hex pods with edge strips, ringed oxygen towers, glowing supply pad), glowing magenta Parasite hives/batteries. A is the most physically faithful Moon but its neon/glow is restrained and the Parasites read as dark slabs; C is the best "war zone" but its Earth is a small dot and the base lighting is warm floodlight rather than neon.
2. *Phone combat readability* — B's colour coding is unambiguous at 390 px: player hull on a cyan underglow ring, hostiles magenta-veined with magenta underglow, objectives as bright plasma orbs, all on a calm dark ground. C's dense crater/scorch ground and A's low-key lighting both make small hulls harder to pick out mid-fight.
3. *Wow factor* — B's establishing shots (ringed towers over neon pods, glowing hive beyond the cover wall, Earth over the horizon band) are the most striking; A has the most cinematic shadows, C the grittiest texture.
4. *Mobile performance* — B has the lowest worst-case triangles, programs and LOW texture memory of the three (LOW 7 programs, 0.36 MB) and the cheapest map repaint; A needs a HIGH shadow map over a 330 m frustum and the slowest map first paint; C's terrain shader loops over 10 light pools and 6 creep stains per pixel and is at the LOW program limit.
5. *Combination* — B's map lacks an orientation reference, so Phase 2 adds C's adaptive grid with lettered columns / numbered rows and a scale bar, drawn in B's hologram palette. Kept from B's risk list for Phase 2: per-pixel terrain cost (simplify on LOW), additive halo overdraw, map relief cache built incrementally.

Unused options A and C (code + raw captures) are deleted from the branch per AGENTS.md; their images remain in the contact sheet and in git history (`f3fafee`, `eacc199`). The B sample stays in `dev/conquest-style/options/b/` as the Phase 2 source and regression reference.

**Agents used so far (AGENTS.md rule 5):** three visual-option agents (one per style, separate folders, no commits) — delivered A, B, C; changed the result (B chosen, C's map grid merged). Next: one independent read-only gameplay/performance reviewer before merge.

**Phase 2 next:** port B into the game as `js/conquest/style.js` (`ConquestStyle`), wire it into `view.js` (environment, terrain material, chunk props, landmarks, Command Base I–V, installations/raid cover/raid art, enemies incl. batteries/drones/commanders, tank dressing, VFX, beacons/flags/loot/hazards, Canvas fallback palette, shader warm-up) and `app.js` (map painter), with Blender-authored GLB architecture through the constrained loader, HIGH/LOW/2D and context-loss intact; rerun affected tests + one short browser journey at 390; reviewer; release.

### Checkpoint 21 — Phase 2: Neon Frontline applied across Conquest (build `20261107151435`)

Owner note: an "art direction update" asking for a 70–80 % Iron Siege mix arrived together with "Disregard last message and continue the original design"; the lead read it as retracted and continued Neon Frontline + C's map grid (Iron Siege code remains in git history at `eacc199` if the owner wants it back).

**What changed (presentation only — no simulation, collision, hitbox, economy, payment or progression file touched):**
- New `js/conquest/style.js` (`ConquestStyle.create(THREE,{low})`, loaded before `view.js` in `index.html` and `web/boot.js`; THREE is only touched inside `create()`). Fixed material set compiled before play: sky, terrain, solid (+instanced), fx (+instanced), shield, base field — all in the `style` warm item.
- `view.js` uses it everywhere, each hook falling back to the original code when the module is absent: black sky with teal/violet horizon band, stars and a fixed Earth; terrain shader (tileable 256² / LOW 128² crater + noise detail texture, slope strata, lichen glow on terraformed ground, friendly hex grid/scan rings and Parasite creep around the nearest 8 sites, evaluated per vertex); per-chunk instanced props (crystal clusters and fungus pods replace trees — ≤1.45 m, trees are not solid; rocks inside the solid ellipse; relay masts); Refuge (9 hex habitat pods inside r7.8, 3 ringed oxygen towers inside r12 with overhead pipe bridges, glowing supply pad, solar field, light pylons); viaduct (deck exactly on `W.deckAt`, lit curbs, hex piers on the sim pier positions, light posts); 4 Parasite hives inside the 22×16 installation boxes + r2 masts; 9 raid cover walls on the exact boxes; Command Base I–V on the shared `baseBlocked()` footprints (thick walls, hangar 1..17, reactor plinth r8 with the tier II drum or the Blender citadel at III+, corner gun towers, radar, tier V tower moved onto the solid back-wall line, modules on the wall face, damage scorch); Parasite hulls (today's silhouettes painted chitin + magenta veins, spikes, eyes, underglow; compact commander crest per pattern), plasma batteries and drones; player tank dressing (cyan fender strips, contact shadow, ring underglow, headlight pool — canonical geometry untouched); holo objective/mission markers, loot/wreck caches, ownership banners, shot halos (cyan friendly / magenta hostile), explosion flares, fresnel Shield and base field; 2D fallback palette.
- `app.js` + `css/conquest.css`: holographic region map — relief cached per power-of-two zoom level (pan/pinch reuse it), contours, sector rings, glowing markers with non-overlapping leader-line labels, explored ground only, plus C's lettered/numbered grid and scale bar. Same markers and semantics; legend keeps "Parasite installation".
- Blender pipeline: `dev/assets/conquest/build.py` (cloud Blender 4.0.2 + `python3-numpy`) re-authors the two existing GLB slots — Command citadel (468/284 tris) and Parasite plasma spire (276/160 tris), 3 draws, POSITION/NORMAL only, no extensions, 13–27 KB — through the unchanged constrained loader; `style.adopt()` maps their PBR factors into the style shader.

**Measured (Chromium SwiftShader in this container — relative only, never iPhone FPS):** exploration at 390 HIGH 33–70 draw calls, 60–99k triangles, 13 programs, 4 textures (new: 512² atlas, 256² Earth, 256² detail; LOW 256/128/128). Frame median 61–76 ms vs the live look's ~39 ms on the same rig after optimisation (was ~120 ms: per-pixel crater/noise hashing → detail texture, per-pixel site loop → per-vertex, sky drawn after opaque geometry, per-frame view-space light uniforms). Map pan repaint 0.6–0.8 ms (desktop CPU).

**Tests (local, this checkpoint):** new `dev/tests/conquest-style.mjs` (HIGH+LOW: fixed material set, finite data, triangle budgets, habitat/processor/installation/cover/base-wall/rock envelopes against the shared rules incl. the server's `baseBlocked`, tree replacements ≤1.5 m, hull dressing within the silhouette, warm set) PASS and added to CI; `conquest-adaptive`, `conquest-assets`, `conquest-canvas-contract`, `conquest-discovery`, `conquest-flagship-ui`, `conquest-view-travel`, `conquest-netcode`, `graphics-release`, `lab-ui` PASS; browser journey `conquest-onboarding.py` (390×844 + 360×640, map fog, story, controls) PASS. In-game captures (preview server): Refuge, raid in progress, Command Base I–V, map, LOW, desktop, 2D fallback — no page or shader errors.

**Still unverified:** PHYSICAL_IPHONE_UNVERIFIED for the new shaders (GPU cost on real Metal/WebGL, thermal), WebKit shader compile is covered only by PR CI, owner hands-on look. Payments remain DISABLED.

### Checkpoint 21 — PR CI root cause, independent review and fixes (before merge)

**`transmission (chromium)` was red on `59180e9` (run 42385510773) and `cd29867` (run 42387661829):** the flagship browser bot lost `raid-battery-1`. Root cause: on `main` the journey passes by a 0.2 % hull margin. After `raid-sabotage-1` the bot sits at 60.2 % hull, just above its 60 % repair threshold, so it starts the battery raid in place from the safe west side. This branch's heavier software-GL frames (CI raid median ~85–97 ms vs 22–27 ms on `main`; the bot reacts per frame) left it just below 60 %. It drove to the Refuge, came back from the east, and the test started the raid as soon as it was inside the activation radius: 10 m from battery B, inside the far-side defenses. It lost. Fixes:
- `cd29867`: quality is a uniform (`uHigh`, one program per material for HIGH and LOW, so CI compiles every branch phones run). Cheaper LOW shading. SwiftShader/llvmpipe are detected via `WEBGL_debug_renderer_info` and take the LOW path without ground decals, halo billboards or the sky dome. Texture fetches and derivatives moved out of per-pixel branches (undefined in GLSL ES).
- `f323751`: the bot drives to each raid's authored `entry` (25 m from the centre, inside the 45 m activation radius) before starting it. Software rasterizers drop hull dressing, shot glows and flares, and render at the game's lowest adaptive scale (0.75).

Local reproduction at 390 (`conquest-flagship-browser.py --engine chromium --width 390`): the bot took the repair detour (1331 hull after sabotage), re-entered from the west entry with 2456 hull and won. PASS, 4 actual victories. Real GPUs never take the software path; no simulation file changed.

**Independent read-only reviewer on `f323751` (AGENTS.md rule 2):** 1 BLOCKER, 5 SHOULD-FIX, 5 NIT. Verdict "do not merge yet". Every finding was verified against the code before fixing, and each new regression assertion was confirmed to fail on `f323751` and pass after the fix.
- **BLOCKER, tap-to-lock area grew (pick steers the authoritative turret lock):** the style path put the hull underglow decal and a marker *Group* into the enemy group. `pick()` only excluded the marker object itself, so a tap on bare ground 2.3 m beside or 3.4 m behind a hull, or on the floating marker, locked it. Fix: every additive fx mesh (one `fxMesh()` helper) and both marker octahedra carry `userData.noPick`. `view.pick()` and the three browser bots that copy its filter (flagship, living-war, session-032) skip them. `conquest-style.mjs` raycasts the view's exact enemy assembly: the hull locks, ground beside/behind and the marker do not. In-browser probe through the real `view.pick()` (relay mission at forced HIGH, 7 camera angles): on `f323751`, ground taps 0.9 m outside two hulls locked them (side; side + behind). After the fix every hull ground tap is clear and hull taps still lock.
- **Command Base V had no tower:** a mid-line `//` comment swallowed the 26 m shaft and its rings (only the crown floated at 26–33 m). Fixed. The test now counts the tower's vertices (5 before, ~1150 after).
- **No CI journey ran the HIGH art phones use** (software GL → LOW path). The non-fallback `conquest-living-war.py` journey (Command Base I–V, relay fight with resident garrisons and enemy fire, relay and convoy victories) now runs with `--quality high` in Chromium and WebKit. Its relay fight must stay inside the HIGH budget (≤ 80 peak draw calls, ≤ 16 programs). Measured locally: peak 54 draws, 15 programs with 15 enemies at 320 and 390. Dense `raid-battery-1` at forced HIGH: 20 enemies, peak 72 draws, 109k triangles, 15 material programs (+2 three.js PMREM helper programs for the HF tank environment, which `materialPrograms` in `performanceReport()` leaves out).
- **Adaptive quality never reached the style:** `uHigh` now follows `autoLow` and the LOW setting every frame (same programs, no recompile). The dev override `LUNAR_STYLE_QUALITY` pins it.
- **Mid-game shader compile:** the style path no longer builds landmark architecture at startup. The Lambert program used by cosmetics and the war monument is now in the `style` warm item.
- **Draw calls:** billboard fx geometry gets a bounding sphere that includes its view-space expansion, so pooled shot glows are frustum-culled again (40 off-screen glows used to cost 40 draws). Hull dressing is merged into the hull draw: a HIGH enemy is 4 draws (hull, turret, underglow, marker) instead of 5.
- **NITs fixed:**
  - Map relief cache is keyed on the discovery object (another session could repeat a version number) and on the footprint layer (scales 28.3–32 share a relief level with ≥ 32). Replaced relief canvases are released at once (iOS canvas-memory cap). `ConquestProgress.create()` runs once per map open instead of per repaint.
  - Generated textures are built once per session and cloned per view (~185 ms of HIGH `create()` on re-entry).
  - Base field shell draws front faces only, like the live build (half the additive fill).
  - After context loss the style no longer updates an invisible scene.
  - Refuge light pylons moved onto habitat plinths inside the solid r7.8 (tanks no longer drive through 7 m masts; lamp arm and light pool face the lane; tested with `W.solidAt`).
- **Verified visually at forced HIGH, 390:** the Base V tower stands (ringed shaft + beacon behind the citadel). All 10 Refuge pylons are on solid ground at 7.14 m (6 on LOW). No page or shader errors.
- **Not changed:** frame time is reported but not asserted in CI (software GL timing is machine-dependent; draw calls and programs are deterministic). The map's one-off relief builds (software canvas: open ~0.27 s vs 0.12 s on `main`, zoom-level crossing ~0.1 s; pan 5–6 ms vs 27–50 ms on `main`). They are bounded, cached per level, and the canvases are now released.

**Owner wrap-up (2026-11-07, weekly usage nearly spent):**
- The reviewer's re-check of the fix commits was stopped before it reported; the owner's phone playtest replaces it (presentation-only change).
- The flagship test's local `--quality` option was discarded (never run). The forced-HIGH living-war CI step and its budget were kept: finished, and passing locally at 320 + 390.
- No further measurement work.

**Still unverified at release:**
- **PHYSICAL_IPHONE_UNVERIFIED:** GPU cost, thermal and input feel of the new shaders on Metal-backed WebGL (Safari/Telegram); owner hands-on look.
- **Frame time is higher than the old look on every rig we measured** (all numbers are software rasterizers, relative only, never iPhone FPS):
  - Chromium SwiftShader exploration at HIGH: median 61–76 ms vs ~39 ms for the live look (≈1.6–1.9×). Forced HIGH ≈2.5× the live look.
  - The software/LOW path that CI and GPU-blocklisted browsers take: ≈1.5×.
  - CI flagship raids: ~85–97 ms on `59180e9`/`cd29867` vs 22–27 ms on `main`. `f323751` trimmed the software path further, but no same-rig `main` comparison was re-measured.
  - Local `f323751` flagship journey: median 38–48 ms, p95 70–98 ms at pixel ratio 0.75. Forced-HIGH relay fight: median 36 ms (320) / 49 ms (390).
  - Adaptive quality now also drops shading to LOW under sustained slow frames. How that behaves on a phone is unmeasured.
- **WebKit HIGH path:** covered only by PR CI (the forced-HIGH living-war journey); never run locally.
- **Known visual issue (not fixed, presentation only):** `FX_VS` multiplies `position` by `(1 − aBill.z)`. Every billboard inside a merged fx geometry is therefore drawn at that mesh's origin, not at its authored position. Affected: pylon lamps, habitat mast lights, base and tower beacons, battery orb glows, cache and drone eye glows. Pooled shot/explosion glows and instanced halos sit at the origin and are unaffected. The issue has existed since the first style commit `04219ed` (and in the Phase 1 sample). Likely fix: use `position` as the billboard centre, then re-check captures; not done at the owner's wrap-up request.
- **Map:** relief rebuild on open (~0.27 s vs 0.12 s on `main`) and per zoom-level crossing (~0.1 s), measured in software canvas; iOS canvas memory not measured.
- **Agents used (AGENTS.md rule 5):**
  - Three visual-option agents (A, B, C). They changed the result: B chosen, plus C's map grid.
  - One independent read-only reviewer on `f323751`. It delivered 1 blocker, 5 should-fix and 5 nits, and changed the result: all were fixed before merge. Its re-check was stopped at the owner's request.

**RELEASED (owner-approved: green CI → merge → deploy → verify, 2026-11-07):**
- PR #59 merged as `b59ae99` at CI-green head `2a258fa`. All 9 checks green: conquest, transmission chromium + webkit (the forced-HIGH living-war journey included), signup-browsers chromium/webkit/firefox, website, verify, asset-integrity.
- Worker deploy run 42412566891 SUCCESS: server tests, Workers-runtime live-match smoke test, deploy.
- Live `/pvp/health` `{"ok":true,"v":4,"open":0,"waiting":0,"queues":[]}`; live `version.json` **`20261107151435`** = repo. Both were checked by the deploy job itself: this cloud container's network policy blocks the live hosts.
- GitHub Pages run 42412565867 SUCCESS for `b59ae99`.
- No revert required. Payments/checkout remain DISABLED; no production accounts, payments, token, airdrop or referral data changed.

**Next:** the owner's phone playtest of the new look (Safari + Telegram, HIGH and LOW). Fix on a new branch from `main`; the FX_VS billboard-origin fix and real-device frame-time sampling are the first candidates.


## Checkpoint 22 — World, Resources & Airdrop Points: Phase 0 economy spec (branch `claude/friendly-allen-7tcyca`, from main `ad68b19`) — AWAITING OWNER APPROVAL

Owner brief (2026-11-08), four phases:
- **Phase 0:** economy spec. STOP for owner approval.
- **Phase 1:** Conquest airdrop points, the Command Base multiplier, the Daily Base Yield and the 50,000 shared cap.
- **Phase 2:** terraform rework (zones, rivers, flora, biomass).
- **Phase 3:** minerals, deposits, Meteor Strike and Hull Plating.

Owner instructions override older docs and code comments. Payments stay disabled.

**Phase 0 delivered (docs/tooling only; no gameplay, economy, server or version change):**
- `docs/economy/RESOURCE_ECONOMY.md`: the master economy spec for this and the later base-builder, tank and competitive sessions. It covers:
  - every resource (points, CP, Alloy, Biomass, Helium-3 and the 6 minerals), with sources per mode, rarity, gather and drop rates, sinks and store rules;
  - the long-term ladder;
  - points a minute, Arcade vs Conquest per league;
  - time-to-armor-tier tables (Conquest-focused, mixed, Arcade-only, dedicated);
  - the first-hour timeline;
  - revenue levers with fairness flags;
  - the implementation contract (records, exactly-once outbox crediting, tests, copy);
  - the owner decision list.
- `dev/tools/economy-model.mjs`: a deterministic, read-only model on the real `js/rules.js` (league pay, `powerOf`/`powerWin`) and the measured Arcade grid. It writes `docs/economy/economy-model.json`.
  - Arcade points a minute are measured. They reproduce `docs/launch/LEAGUES.md`: 223/264/320/343/460/495/702.
  - Every Conquest, mineral, plating and timeline number is a modeled proposal, not a playtest.

**Key modeled results (regular Conquest-focused player, 45 min a day):**
- Ferrite set in 3 days, Ilmenite 9 days, Armalcolite 4.3 weeks, Tranquillityite 2.6 months, Selenite 6 months, Moonheart 15.5 months.
- First plate at minute 12 of the first session.
- Command Base I at about minute 59 (inside the 45–75 target; raid rewards unchanged).
- Conquest points a minute within about 5% of Arcade without a base (top league −12%), and +10–20% with a Command Base.

**Facts found in code (relevant for Phase 1):**
- The cap is `DAILY_CAP=20000` in both `js/rules.js` and `worker/src/db.js`.
- Conquest (`conquest/<pid>`) and the account (`eco/<pid>`) are separate CAS records. Conquest points need a transactional outbox with a watermark (`eco.cqw`), credited through `ecoPlayAward`.
- The only "CP is separate from Arcade and airdrop points" copy is in `js/conquest/app.js` `briefing()`. The wiki and terms have no Conquest text.
- The wiki states the 20,000 cap twice (Leagues paragraph and the Economy note).
- The old Conquest `POLICY.daily` caps are still unenforced.
- PvP `checkLoadout` already rebuilds loadouts from `ecoLoadout(owned)`, so plates in `eco.ap` reach gear rating and league automatically.
- A known gap: the whole CP ladder (93,530 CP) is finished in about 5–6 weeks by a regular player. The base-builder session must add sinks.

**Tests and checks run:**
- `node dev/tools/economy-model.mjs --write`: PASS. It writes the JSON and asserts that each content mix sums to 1 and that the first hour never spends more than it has.
- `node --check dev/tools/economy-model.mjs`, `node --test dev/tools/asset-audit.test.mjs` (4/4) and `node dev/tools/asset-audit.mjs` (exit 0): PASS. These are the steps of the `ai-tooling-check` CI workflow, which triggers on `dev/tools/**`.
- No game tests were run: no game file changed.

**Tooling state:** the Graphify MCP failed to connect in this session (proxy refused the tunnel, 403). Current source was read directly.

**Owner decisions pending** (`RESOURCE_ECONOMY.md` §12):
1. Yield points inside or outside the 50,000 cap.
2. Whether Selenite's energy reduction applies to Moonbeam (recommended: exempt).
3. Top armor strength vs Lunar Skin.
4. The mineral store and the points-for-Ferrite shop.
5. Guardrails for future paid levers.
6. Whether a verified Conquest day counts as an active day for referral verification.
7. The Arcade-only pace for rare+.

**Next (only after owner sign-off):** Phase 1 on this branch.
1. Move the approved constants into `js/rules.js`. Raise `DAILY_CAP` to 50,000 in rules + `db.js`.
2. Add the Conquest points outbox to `conquest-economy`/`conquest.js` and the eco credit, with the base multiplier, the per-hour outcome limit and the flags.
3. Daily Base Yield: fill and partial collect at the physical base, meter on the base terminal, MAP and HUD.
4. Update the wiki and in-game copy.

Then the tests in §10, then commit and push. Phase 2 (terraform) and Phase 3 (minerals and plating) follow, each committed and pushed.

**Agents used so far:** none. Phase 0 was done by the lead alone.

### Checkpoint 22 — Phase 0 sign-off and Phase 1: Conquest airdrop points, Command Base multiplier, Daily Base Yield, 50,000 shared cap

**Owner sign-off on Phase 0 (2026-11-08):**
1. Yield points count inside the cap.
2. Moonbeam is exempt from Selenite.
3. Moonheart stays at about +12%.
4. The mineral store is approved; checkout stays off.
5. Guardrail: no direct airdrop points or rare+ minerals from paid features. Indirect gains through power or base level are allowed.
6. A Conquest operation day counts as a referral active day.
7. The Arcade-only rare set takes about 3 months. The model now gives 3.1 months: Arcade wins drop Armalcolite 6%; weekly Veteran/Ace rewards are 2/4.

The defaults are approved too. `docs/economy/RESOURCE_ECONOMY.md` records all of this (commit `2ebad69`).

**Phase 1 delivered (server-authoritative):**
- **Shared cap.**
  - `DAILY_CAP` is 50,000 in `js/rules.js` and `worker/src/db.js`, one cap for Arcade, PvP and Conquest.
  - Every Conquest point flows through the same `ecoPlayAward`: cap, daily/weekly boards, airdrop credit `ac`, squad bonus, league spendable bonus.
- **Conquest points.** `CQ_PTS` per verified outcome × `CQ_BASE_MULT` (Base I..V ×1.05..×1.25), then × the account's `LG_BASE_PAY` at credit.
  - World kills pay at once. They are gated by spawn generation like their salvage.
  - Kills inside an operation are held. A win pays the completion instead; a fail, retreat, respawn or new attempt pays the held kills.
  - Missions and raids pay by authored danger. Base and sector defenses pay 675.
  - Cooldown receipts, replayed raid receipts and raid reinforcement waves pay nothing.
- **Exactly once.** Each Conquest request seals its outcomes into one immutable outbox entry (monotonic id; 64 max plus a spill).
  - `creditConquest()` credits entries above `eco.cqw` and writes the watermark in the same account CAS.
  - The Conquest record is then pruned with its own CAS loop, outside the pilot's request rate limit.
  - Credit runs at once for operations, after 20 s or 8 entries for kills, and on session open.
- **Bot resistance.**
  - At most 120 paying outcomes per hour.
  - The `cqppm` flag: over 1,200 base points a minute across 30+ simulated minutes.
  - Combined `hours` flag.
  - Yield points need a verified operation that day.
  - Deferred to a later session: command-sequence fingerprints.
- **Referral days.** A credited operation runs `ecoPlayDay`, so it counts as a verified play day (owner decision 6).
- **Daily Base Yield.**
  - `base-claim` (same action name) is now two 24 h clocks: `claimedAt` for CP + materials, `pointsAt` for points. `ConquestCombat.baseYield()` holds the shared math.
  - Collect at the physical terminal from 10%. Each clock stops at full.
  - Materials are banked straight into the base.
  - The points part is held, and keeps filling, until the day's first operation.
  - Existing bases migrate with `pointsAt = claimedAt`.
- **UI.**
  - HUD status line: "AIRDROP TODAY n / 50,000 · +n PENDING". The numbers come from the account on session open and after every credit.
  - "+n AIRDROP POINTS SECURED" ticker; AIRDROP PTS after-action tile.
  - Base terminal yield panel with a fill bar and exact amounts; MAP base card meter; HUD base line "YIELD n%".
  - In-world ring of ten orbs over the base (shared sphere, cached basic materials, no new shader program); 2D fallback label.
- **Copy.**
  - Conquest briefing: "CP is separate from Arcade and airdrop points" is removed; operations now state their airdrop points.
  - Base terminal and MAP text.
  - `js/ui.js`: leagues help, Earning help, squad help, the capped-result line.
  - Wiki: the 50,000 cap and a new Conquest points + Daily Base Yield card; referral days now include Conquest operations.
  - Terms: one sentence on Conquest points and the shared cap; date set to November 8, 2026.

**Tests (local, all PASS):**
- New:
  - `dev/tests/conquest-airdrop.mjs`: 30 checks.
  - `dev/tests/wtest/conquest-airdrop.mjs`: 20 checks, through the real Worker and the ETag fake DB. They cover two tabs racing a victory, a resent request, an account write failure then recovery, a stale watermark, the shared cap, league pay, referral days, the flags and the session-open HUD numbers.
  - `dev/tests/conquest-airdrop-browser.py`: Chromium 390×844. A real Moonbeam kill of the Refuge scout patrol (camera turned and hull tapped like a player) shows "+35 PENDING", then "AIRDROP TODAY 35 / 50,000". A base at 50% shows 5/10 lit orbs, the terminal bar at 0.5 and HUD "YIELD 50%". Collecting banks 40 CP and holds the points part; the meter resets once the dialog closes. No page errors, no horizontal overflow.
- Updated for the 50,000 cap (they used `R.DAILY_CAP` or hard-coded 20,000): `wtest/test.mjs` (203/0), `wtest/referrals.mjs` (29/0), `wtest/pvp.mjs` (113/0).
- Also PASS:
  - all 41 Conquest CI suites, plus `conquest-regression.sh` and `conquest-replay-budget`;
  - `wtest/conquest`, `conquest-war`, `farm` (55/0), `web-auth`, `lunar-identity`, `accounts` (18), `lab`, `lab-battle`, `ticket-reliability` (37/0), `owner` (68/0).
- **CI:** the new tests are added to `conquest-check.yml` (Conquest triggers now include `worker/src/eco.js`, `js/rules.js` and `dev/tests/wtest/conquest*`) and to the server tests in `deploy-worker.yml`.

**Found while testing:** the committed `docs/conquest-session-2/earned-defense.json` was already stale on `main`. A clean `main` worktree regenerates the same numbers as this branch; the only addition is the new `ptsRaw` field. The tracked file is left unchanged.

**Still unverified:**
- Points a minute against Arcade is modeled (§3.3), not measured with the scripted pilot.
- PHYSICAL_IPHONE_UNVERIFIED for the new HUD line and orb ring.
- No WebKit run of the new journey; CI runs it in Chromium only.

**Next:** Phase 2 (terraform rework), then Phase 3 (minerals and plating), each committed and pushed. Then two independent reviewers (economy/security + gameplay/performance) before merge. The build stamp (`index.html` BUILD and `?v=` cache keys, `version.json`) is bumped once at release, after Phase 3.

### Checkpoint 22 — Phase 2: terraform rework (zones, water, forests, bio-flora Biomass)

**Zone map (authored, deterministic; `js/conquest/world.js`).** The old noise patches (`biomeAt` terraformed blobs anywhere on the map) are gone. Terraforming now comes from the human atmosphere network and is eaten back by the Parasite blight:
- **Sustain:** each atmosphere pylon gives `1 − d·√d` (d = distance / radius). The world takes the strongest pylon.

  | Pylon | Position | Radius | Shell |
  |---|---|---:|---|
  | oxygen | 1196, 1112 | 185 | dome |
  | refuge | 1194, 1214 | 160 | |
  | base | 1072, 1216 | 175 | dome |
  | corridor | 1004, 1122 | 132 | |
  | crater | 960, 1158 | 158 | |
  | valley | 898, 1238 | 152 | |
  | reservoir | 842, 1318 | 158 | dome |
- **Blight:** each Parasite installation (r 165) and two hive-front sources, (1290, 1200, r 140) and (1080, 835, r 150), subtract `0.95 · (1 − d)`.
- **Zones:** lichen ≥ 0.14, grass ≥ 0.33, lush ≥ 0.55; anything else is barren. Outside x 640–1500 / z 900–1520 (the far frontier) everything stays barren.
- **Result (8 m grid over the populated war region x 800–1400, z 715–1305):**
  - 30.2% terraformed (owner target 30–40%): 1,203 lush, 272 grass and 223 lichen cells.
  - Lush at the Refuge terminal, the Command Base, the ice-mining crater and the reservoir.
  - The oxygen complex is terraformed but blight-pressed (grass and lichen edge facing the hives).
  - Every Parasite installation and the far frontier stay barren. Blight stumps mark the war edge.

**Why this shape.** Air is made by the Refuge, the oxygen station and their pylons, so green radiates from them and thins along the gradient lush → grass → lichen → barren. The hives sit north (z < 1000) and east, so the green edge is visibly bitten there. The south-west valley is the only place with a natural water path.

**Water (hydrology).** The plateau has no closed basins, so water exists only where it is authored, and terrain carving is confined to the box x 750–960, z 1160–1372:
- An **ice-mining crater** at (930, 1180) with a meltwater pool (r 8, deep) and a drilling rig.
- A **creek** with 8 points down the real south-west valley (steepest descent). It runs in a carved channel 1.7 m deep: the core is deep and blocks hulls; the banks are shallow and slow hulls to ×0.55.
- **Crossings (authored chokepoints):**
  - two half-depth **fords**: `ford-upper` (920, 1231) and `ford-reservoir` (866, 1309), each r 7;
  - the **creek bridge** on the crater-outflow span (936.5, 1197.4): an arched deck with railings.
- The **Refuge Reservoir** (800, 1326; 36 × 40 m, deep) is held by a solid **dam** at z 1364 (x 768–834). Downstream of it is dry.
- The water surface sits 0.4 m under the uncarved centreline. Deep water (> 1 m) stops a hull at the bank; a hull already in deep water can drive out.

**Forests (cover).** Five stands with 288 trees, placed off routes:

| Stand | Centre | Radius | Trees |
|---|---|---:|---:|
| crater | 972, 1216 | 21 | 69 |
| valley | 878, 1222 | 17 | 45 |
| falls | 836, 1279 | 16 | 40 |
| base-south | 1048, 1236 | 22 | 75 |
| refuge-south | 1132, 1246 | 20 | 59 |

The canopy core blocks line of sight, shots and movement below 7.5 m (`blockedAt`, `FOREST_CANOPY`). A hull at the edge can see and be seen.

**Bio-flora (Biomass).**
- **Nodes:** 24, 20 in lush and 4 in grass, all reachable from the spawn within harvest range.
- **Harvest:** server-replayed GATHER (`harvestStep` in the 50 ms loop). Hold for 4 s, stopped within 6 m, for +3 Biomass. The node regrows 15 min per pilot.
- **Exposure:** the channel alerts the nearest Parasite within 120 m every second.
- **Resets:** moving, taking damage, releasing GATHER, being in an operation or a non-active battle.
- **Points:** 80 airdrop points × the Command Base multiplier, through the Phase 1 outbox and hourly limit. It counts as the day's verified activity for the yield points; it is not a referral day.
- **UI:**
  - a GATHER hold button with the channel percentage (shown only on a ready node);
  - a harvest ticker;
  - bright, haloed ready nodes and dim, folded regrowing nodes in 3D;
  - labels in the 2D fallback.
- **Value:** 80 is derived by the approved §3.2 method (par 0.47 min × 225 × 75%). It is not a number the owner signed off line by line; it is flagged in RESOURCE_ECONOMY.md.

**Every sector, raid, mission and route keeps working:**
- `conquest-terraform.mjs` flood-fills real `move()` from the spawn and reaches all 49 authored operations, travel nodes and bases.
- **World equivalence against `main`** (`world.js` at `origin/main`, the same 15,498 deterministic samples as `conquest-world-equivalence.mjs`). Every difference is intended and classified, with nothing unexplained:
  - ground height differs at 165 points, all inside the water carve box;
  - solid differs at 1 point (a pylon mast);
  - blocked differs at 151 forest-canopy points, 36 carve points and 1 pylon point.

  (The tool itself asserts zero differences against a baseline, so it is expected to report these intended ones.)
- One scoping fix: the old viaduct-edge rule in `move()` matched any bridge surface in x 901–1139. It is now limited to the viaduct's z band, so hulls can leave the new creek bridge.

**Visuals (Neon Frontline, `js/conquest/style.js`; presentation only, nothing here is collision):**
- **Per fine chunk:** instanced plants (lush and grass), lichen cushions, blight stumps and ground-cover tufts.
- **Forests:** every stand has a detailed and a far draw (same silhouette; trunk plus two canopy cones). The view switches them by camera distance: 80 m HIGH / 55 m LOW beyond the stand edge. The vendored Three build has no `THREE.LOD`, so this is a two-mesh switch.
- **Ground flora** hides beyond 180 m (HIGH) / 150 m (LOW) from the hull per chunk; tufts hide sooner.
- **Water:** one merged mesh and one draw, with its own cheap shader: flow bands along the creek, foam banks, sky fresnel, and sparkle on HIGH.
- **Structures:** pylons with emitter rings and dome shells, the dam, the bridge, the crater rig with ice blocks, and ford stones.
- **Terrain shader:** the lichen/grass/lush ramp is decoded from the vertex colour.
- **Pre-existing bug fixed:** on `main`, the FX billboard shader multiplied a merged billboard's stored centre by `1 − aBill.z` (= 0). All 23 merged `X.bill()` glows (Refuge, viaduct, base and installation halos, HIGH only) therefore drew at their group origin. They now draw where they were authored. Reviewers: this changes those halos' look on HIGH.
- **Visual-option agents: not used.** An approved single art direction (Neon Frontline) already exists, and the style internals are large and tightly coupled. Two option agents would have cost more than they could change. The owner made this optional.

**Mobile budget, measured** (Chromium SwiftShader at 390×844, the same five spots on this branch and on `main`; relative numbers only, not iPhone performance):

| Quality | This branch | `main` |
|---|---|---|
| HIGH | 105–186k triangles, 43–56 draws, 16 programs | 40–91k triangles, 26–53 draws, 15 programs |
| LOW | 75–107k triangles, 37–51 draws | 38–76k triangles |

- **First build was over budget:** 1.8–2.1M triangles. The flora used `G.ico` (a 320-triangle sphere) for every bud.
- **Fixes:** 8–20-triangle gems, the forest LOD, flora distance culling, lighter pylon rings and a 50-triangle LOW plant.
- **Locked by `conquest-style.mjs`, HIGH / LOW:**
  - tree ≤ 520 / 260;
  - far tree ≤ 60;
  - plant ≤ 170 / 60;
  - densest flora chunk ≤ 30k / 12k;
  - terraformed world at the worst camera position over the south ≤ 100k / 50k.
- **Extra program:** the water shader. It is compiled in the warm-up set.

**Tests (local, all PASS):**
- **New:**
  - `dev/tests/conquest-terraform.mjs` (32 checks): zones, water, the bank stop, both fords crossed bank to bank, the bridge, ×0.55 slowdown, forest LOS/shots/canopy height, reachability, and the server harvest: 4 s exact, payment, regrow, move/release/damage/mission resets, out of range.
  - Flora budget and LOD assertions in `conquest-style.mjs`.
  - `dev/tests/conquest-terraform-captures.py` (390×844; HIGH, LOW and 2D):
    - five scenes;
    - a real GATHER hold through the shipped button: "GATHERING · 50%" mid-channel, then +3 Biomass, 80 raw points in the outbox, a 15 min regrow and the button hidden;
    - no page errors.

    Evidence is in `docs/economy/phase2/`.
- **Re-run and PASS:**
  - every Conquest CI suite, `conquest-regression.sh`, `wtest/conquest`, `conquest-war`, `farm`, `pvp`, `test`, `referrals`, `owner`, `accounts`, `web-auth`, `lunar-identity`, `lab`, `lab-battle`, `ticket-reliability`;
  - the Phase 1 airdrop tests (sim 30, worker 20, browser journey);
  - `conquest-onboarding.py` (390×844 and 360×640).
- **CI:** `conquest-terraform.mjs` and the HIGH capture with the GATHER journey are added to `conquest-check.yml`; `docs/economy/phase2` is uploaded as an artifact.

**Still unverified:**
- PHYSICAL_IPHONE_UNVERIFIED: frame time and thermals of the new south (triangle counts are measured; frame rate on a phone is not).
- No WebKit run.
- Biomass pace (2–2.5 harvests a minute) is modeled from node spacing and is not measured with a scripted pilot.
- The forest-LOD switch distance is set by eye on SwiftShader captures.

**Next:** Phase 3 (minerals, deposits and scanner, Meteor Strike, Arcade/PvP drops, Hull Plating, first-plate hook).

### Checkpoint 22 — Phase 3: minerals, deposits, Meteor Strike, Arcade/PvP drops, Hull Plating

**Account side** (shared `js/rules.js` + Worker):
- **Minerals and plates:** six minerals in the account wallet (`eco.mn`), and Hull Plating in four slots (`eco.ap`, tiers 1–6) inside the canonical loadout.
- **Strength:** plates feed `tankOf` (HP and trait flags) and then `powerOf`, where traits count as effective HP. The approved full-set gear-rating gains are reproduced exactly. League and matchmaking follow through `setLoadout` → `ecoLeague` on every fabrication.
- **PvP:** `checkLoadout` rebuilds plates from the owned record, so a claimed set is ignored.
- **Traits:** applied by damage type in the shared Arcade/PvP `takeHit` and in Conquest (pulse fire, plasma and orbital strikes). Moonbeam and Moonfall are exempt.
- **Fabrication:** `/api/act plate`, from the garage's Hull Plating section (wallet, per-slot compare card, fabricate) or from Refuge Supply in Conquest. Exact mineral and points costs; upgrade only; no refund.
- **Drops:** Arcade/PvP mineral drops on verified results (AI tickets and live rooms; quits get none), shown on the results screen. The weekly league minerals arrive automatically at the 20th verified match of the UTC week.

**Conquest** (server-authoritative):
- **Deposits:** 70 authored deposits generated offline by the approved placement rules, then frozen as literal coordinates:

  | Mineral | Nodes | Where |
  |---|---:|---|
  | Ferrite | 36 | every sector, near routes |
  | Ilmenite | 18 | off-route basalt |
  | Armalcolite | 10 | HARD walls |
  | Tranquillityite | 5 | VETERAN perimeters and hive edges |
  | Starter Vein | 1 | 15 m from the Refuge terminal |

  All are reachable from the spawn and clear of structures, water, forests and flora.
- **Scanner pulse:** 30 s cooldown, 150 m (+50 m per Radar level). Discoveries stay on the MAP with "ready" or "depleted · Nm".
- **Gathering:**
  - server-rolled amounts (deterministic per node and moment; the client never sends an amount);
  - exact channels (5 / 8 / 12 / 16 s) and per-pilot respawns (20 min / 45 min / 3 h / 8 h);
  - the 3% Selenite vein;
  - the one-time Starter Vein (35 Ferrite);
  - noise that alerts Parasites within 120 m.
- **Mineral cargo:** half (rounded down) drops into the recoverable death wreck. Banking at the Refuge or base vault sends minerals through the Phase 1 outbox to the wallet, exactly once.
- **Operation caches** on victory, per the approved model: field 3 Ferrite + 50% Ilmenite; HARD 2 Ilmenite + 40% Armalcolite; VETERAN 1.5 Armalcolite + 30% Tranquillityite; defense 2 Ferrite + 1 Ilmenite.
- **Meteor Strike:** every 2 h on the even UTC hour at 8 rotating authored craters (one per sector plus Reservoir Flats and the Eastern Rim).
  - **Telegraph:** 5 min. HUD countdown line, MAP pin, a falling meteor in the sky, and a toast plus haptic alert once per slot.
  - **Window:** 20 min open. Two fixed HARD waves (three interceptors, then a heavy sentinel, a fire coordinator and an interceptor), then a 16 s core channel that damage resets.
  - **Rewards:** 1,075 points, 120 CP, carried minerals, and the core roll (15% Selenite, 2.5% Moonheart). The roll is stored at the first start in the slot. One claim per pilot per slot. Strike Resonance guarantees a Selenite every 12th and a Moonheart every 40th secured strike.
  - A strike never captures territory or counts toward raid unlocks.

**Visuals** (Neon Frontline; budgets in `conquest-style.mjs`):
- **Mineral formations:** one instanced draw per look (rust Ferrite clods with steel flecks, black Ilmenite shards with blue tips, grey-blue Armalcolite with cyan seams, dark rock with red-orange Tranquillityite needles, the Starter Vein beacon). Depleted deposits show a dim stub. With every deposit discovered: at most 6 draws and 40k triangles (HIGH).
- **Strike:** a meteor with a trail during the telegraph; a glowing crater ring and core while open.
- **Plates:** shown on the Arcade hull (`render3d` `plateB`) and the Conquest hull (`syncLoadout`). HIGH uses the shine material with mineral-coloured seams; LOW uses one bucket per part. The 2D fallback shows tier-coloured outlines and a set ring.

**Copy:**
- Wiki: a new "Minerals & Hull Plating" section with every table and the published odds, plus mineral and strike rows in the Conquest points table.
- Arcade-first pilots get "Your first armor plate is minutes away in Conquest" (or "fabricate it in the Garage" once they have 40 Ferrite) after matches 3, 6 and 9.
- Conquest shows the guided "TAP SCAN: A STARTER VEIN LIES BESIDE THE REFUGE" hint and the first-plate prompt at Refuge Supply.

**First-plate hook:**
- **Verified in the browser at 390** (`conquest-minerals-browser.py`, real Worker account): SCAN → the Starter Vein revealed → hold GATHER (35 Ferrite carried) → BANK (wallet 40 Ferrite) → FRONT Ferrite plate at Refuge Supply → the session refits. Hull goes 1700 → 1717, the Conquest vehicle gains the plate geometry, and the strike telegraph shows on the HUD.
- **Not measured:** the time to the first plate. It is modeled at minute 12 (target: about 20).

**Tests (local):**
- `wtest/hull-plating.mjs` (24);
- `conquest-minerals.mjs` (41);
- the `conquest-style.mjs` budgets;
- the 390 journey;
- every CI suite re-run (results in the final report below).

**Still unverified:**
- PHYSICAL_IPHONE_UNVERIFIED: the new HUD lines, deposit formations, strike visuals and plate meshes.
- No WebKit run.
- Meteor Strike difficulty against a starter tank is not measured. The waves use fixed authored archetypes; the HARD tier is not tuned by a scripted pilot.
- Daily mineral income by player type (§5.6) is modeled, not measured.
- The Selenite sheen and Moonheart pulse are static.

### Checkpoint 22 — Terraformed zones: owner art direction (rugged war-torn frontier colony) — AWAITING OWNER LOOK APPROVAL

**Owner direction (Nov 8, final override):**
- A rugged, war-torn frontier the colonists clawed out of the Moon: gritty military sci-fi, not a park.
- About 30% of the zones built (core town, farm ring, frontier wall, roads); about 70% wild.
- A dusty amber/steel sky inside the zones; the black lunar sky outside.
- Nothing merges or deploys until the owner approves the look.

**Built (presentation in `js/conquest/style.js` / `view.js`; collision and road speed in the shared `js/conquest/world.js`):**
- **Atmosphere:**
  - a per-vertex zone map: inside, a low warm sun (about 15°) with cool steel shade; outside, the unchanged Moon light;
  - a dusty sky: hazy amber horizon to dusky steel blue overhead, broken clouds with dark bellies and sunlit rims, distant dust haze;
  - dust fog;
  - a shimmering atmosphere veil along the zone contour.
- **Ground:**
  - organic grass patches in olive / dry straw / dark green, with a fine grain (the LOW grass texture);
  - bare dirt and gravel, and grey regolith with its craters showing through only in bare patches;
  - rock faces with strata and moss on steep ground;
  - shell craters with scorched centres and mud rings, and tank-track ruts;
  - grit grows with distance from the core; no hex lines on zone ground.
- **Flora:**
  - instanced grass clumps (mixed colours, varied height);
  - scrub and thornbushes, ferns by the creek, rare crystal sprouts, small flower patches only near the core;
  - wind-bent conifers, muted broadleaf and dead/burnt trees (forest stands keep their LOS canopy);
  - mossy boulders inside the zones (same collision).
- **Water:** dark slate blue (#3C5568) reflecting the dusty sky, muddy banks, wet rocks in the stream.
- **Colony** (authored by `dev/tools/colony-gen.mjs`, frozen in `ConquestWorld.COLONY`; all 57 operations, travel nodes and bases, 24 flora nodes, 70 deposits and 8 strike cores still reachable):
  - **Buildings:** a core town of 41 Neon Frontline buildings (hex habitat pods, blocks, shopfronts, a hangar, ringed oxygen towers) around the existing Refuge, plus a landing pad.
  - **Streets:** lit paved streets with neon edges and lane marks.
  - **Movement:** rovers on the streets, crew at the plaza, a monorail with a moving train.
  - **Farm ring:** 6 crop fields on the west plains with fences, a greenhouse and silos, and canals fed by the creek.
  - **Frontier wall:** 6 wall runs and 6 watchtowers on the hive-facing edge, with open lanes and gates.
  - **Roads and power:** rutted dirt tracks toward the frontier; a power line.
- **Frontier dressing:** half-overgrown tank wrecks, burnt stumps, sandbag lines and trenches behind the wall, barbed wire beyond it, a rusted pipeline from the ice-mining crater, and abandoned machinery.
- **Gameplay (shared sim):**
  - colony buildings, wall runs, watchtowers, gates and monorail pylons collide and block sight up to their height;
  - colony ground is cleared of loose rocks;
  - paved roads are 15% faster (`ConquestWorld.advance`); dirt tracks are not.

**Shots** (390 portrait, HIGH; `docs/economy/colony/`): core town, farm ring, frontier wall, river/bridge, wild meadow, boundary crossing. Contact sheet: `docs/economy/colony/contact-sheet-390-high.jpg`.

**Measured** (Chromium SwiftShader at 390, the six spots; relative numbers only): HIGH 57–80 draws, 151k–217k triangles, 17 programs (the veil adds one). LOW numbers are in `stats-low.json`.

**Second pass (owner gave full creative freedom):**
- **Baked long shadows for the low sun:** colony buildings, walls, towers, Refuge pods, hives and forest trees are swept along the sun direction once into a ground shadow texture (no per-frame shadow pass). Terrain darkens under it, and hulls and buildings dim as they pass through. Casters never shadow their own footprint.
- **Veil:** it was a grey curtain across the sky from inside. It is now faint from inside and stronger from the barren side, and lower (60 m).
- **Small fixes:** organic grass patches replace a regular dot pattern; power poles are dark weathered wood; the plaza crew now read as small figures in work suits.
- **Six shots reframed** to show more sky and horizon (`docs/economy/colony/`).
- **Test harness:** `conquest-earned-journey.mjs` failed because its route planner assumed `advance()` moves exactly the requested 4 m (paved roads now move 15% farther) and ignored hull width against the base walls (the cleared colony ground opened a tighter shortcut). The planner now probes with the road factor and ±1.6 m clearance. Gameplay is unchanged.
- **Journey timing:** the pilot earns Command Base I at 74.9 min against main's recorded 73.66 (target 45–75).
- **Re-run and PASS:** `conquest-terraform`, `conquest-minerals`, `conquest-style`, `conquest-travel`, `conquest-session`, `conquest-netcode`, `conquest-canvas-contract`, `conquest-opening`, `conquest-operations`, `conquest-authority`, `conquest-controls`, `conquest-earned-journey`, `conquest-first-base`, `conquest-fast-travel`, `conquest-base`, `conquest-raids`, `conquest-view-travel`, `conquest-flagship-ui`, `wtest/conquest`.
- **LOW at the same spots:** 47–68 draws, 110k–144k triangles.

**Not done yet (for owner review):**
- Static shadows are baked; moving units (tanks, rovers) cast none.
- "Colony walls/gates are the safe zone edge" and "Parasite invasions hit the frontier wall first" are not yet wired into AI and invasion targeting. The walls are physical only.
- Tank wrecks and the pipeline are decorative (no collision).
- PHYSICAL_IPHONE_UNVERIFIED.

## Checkpoint 22 handoff (superseded by Checkpoint 23 below; World, Resources & Airdrop Points; branch `claude/friendly-allen-7tcyca`)

**State at handoff:** all work is committed and pushed on `claude/friendly-allen-7tcyca`, with no PR open and nothing merged or deployed. The build stamp is already set to `20261108075526` (`index.html` `window.BUILD` + 32 `?v=` keys, `version.json`). `main` (through `c01529d`, #67) was merged into the branch.

### Owner direction in force (overrides older docs; see AGENTS.md "Owner messages mid-session")
1. **Terraform art override (final; replaces every earlier terraform look note):** a rugged, war-torn frontier the colonists clawed out of the Moon. Gritty military sci-fi, not a park, lawn or meadow.
   - **Ground:**
     - grass about 45%, never uniform, in clumps of olive #6B7A3A, dry straw #A89A5B and dark green #3E5A2E;
     - bare ground about 25%: dirt #6E5A43, gravel, grey regolith #8A8780;
     - rock about 20%: outcrops, mossy boulders, cliff faces;
     - scars about 10%: shell craters with scorched earth, mud, tank ruts.
     - Uneven terrain; no flat lawn; no hex lines on open ground (bases only).
   - **Flora:** hardy scrub, thornbushes, wind-bent and dead/burnt trees, ferns in gullies; crystal sprouts only as rare accents; flowers only in a few small patches near the colony core.
   - **Sky and light inside zones:** a thin, dusty atmosphere; hazy amber horizon #C9A27A to dusky steel blue #4F6377; broken dramatic clouds; low sun; long hard shadows; warm light against cool shade; distant dust haze. Outside the zones, the black lunar sky is unchanged.
   - **Frontier detail:** half-overgrown tank wrecks, burnt stumps, sandbags, trenches and barbed wire toward the frontier, rutted dirt roads, rusted pipelines, fences, abandoned machinery.
   - **Colony core:** the same rugged base but cleaner: paved roads, lit buildings, neon edge strips, irrigated fields. Grit increases with distance from the core.
   - **Water:** dark slate blue #3C5568 with sky reflection, muddy banks, rocks in the stream.
   - **Creative freedom (owner):** treat the spec as guidance, not a checklist; change, drop or add anything that makes it better. The mission: a rugged frontier that looks great on a phone and makes players excited to explore, fight over and return to these zones.
2. **Settlers:** colony towns and farms belong to civilian settlers. They get warm amber lights and weathered, painted, patched materials, distinct from the military's cyan armoured Neon Frontline (Refuge, Command Bases, frontier wall). Full settler architecture is session 5 (docs/ROADMAP.md); do not build it now.
3. **Kept from the earlier colony message:** about 30% built / 70% wild; the core town, farm ring and frontier wall layout; tanks 15% faster on paved roads (server-authoritative, shared sim).
4. **Release:** do NOT wait for owner approval. Once the terraform captures pass a self-check against the rugged-frontier override, go straight through: rerun affected tests, two independent reviewers, fix valid findings, green CI, merge, deploy, verify `/pvp/health` and `version.json`, revert if broken. Put the final captures and a short summary here for the owner's morning review. Look adjustments happen in a later session.
5. **Scope:** build nothing else new this session. Later items are queued in docs/ROADMAP.md, including "Colony Defense" (walls as the safe-zone edge, invasions hitting the frontier wall) and settler life.

### Finished (committed, tested locally)
- **Phase 0** (`14ca3a0`, `2ebad69`): RESOURCE_ECONOMY.md, signed off.
- **Phase 1** (`fd00978`): Conquest airdrop points, Command Base multiplier, Daily Base Yield, 50,000 shared cap.
- **Phase 2** (`6e26d9e`): authored terraform zones, creek/fords/bridge/reservoir/dam, forest cover, bio-flora Biomass.
- **Phase 3** (`31d9bc5`, `d1f5ad4`): minerals and wallet, deposits and scanner, gathering, caches, death wreck exposure, banking through the outbox, Meteor Strike, Arcade/PvP drops and weekly league minerals, Hull Plating (garage + Refuge Supply, power/league/PvP), plate visuals (3D/2D), first-plate hook, wiki.
- **Art pass** (`8c2f57c`, `a22b7c5`, `28cb5b1`):
  - **Colony data and world:**
    - the colony is authored by `dev/tools/colony-gen.mjs` into `ConquestWorld.COLONY`;
    - colony collision and sight blocking; cleared colony ground; +15% speed on paved roads only (dirt tracks are not faster);
    - `conquest-earned-journey` planner fix (test harness only).
  - **Looks:**
    - dusty sky and low-sun light with the per-vertex zone map;
    - rugged ground and flora;
    - baked long shadows;
    - slate water;
    - the colony town, farm ring, wall, monorail, rovers and crew, and frontier dressing;
    - the atmosphere veil;
    - settler amber and weathered materials.
- **Build stamp** (`cf4055a`).
- **Local results, last full runs:**
  - all Conquest suites, wtest suites and browser journeys passed at the Phase 3 commit, except `conquest-earned-journey` (since fixed);
  - after the art pass, the affected subset passed (terraform, minerals, style, travel, session, netcode, canvas-contract, opening, operations, authority, controls, earned-journey, first-base, fast-travel, base, raids, view-travel, flagship-ui, wtest/conquest);
  - the earned journey reaches Base I at 74.9 min (main recorded 73.66; target 45–75).

### Latest captures (390 portrait, Chromium SwiftShader; relative performance only)
- **Colony art:** `docs/economy/colony/{core-town,farm-ring,frontier-wall,river-bridge,wild-meadow,boundary-crossing}-390-high.png`, `docs/economy/colony/contact-sheet-390-high.jpg`, `docs/economy/colony/stats-high.json` and `stats-low.json`.
  - Script: `python3 dev/tests/conquest-colony-captures.py --quality high|low|2d` (`ONLY=name,...` for single shots).
  - Last measured: HIGH 55–79 draws, 146k–210k triangles, 17 programs; LOW 47–68 draws, 110k–144k triangles.
- **Earlier evidence:** `docs/economy/phase1`, `phase2` (Phase-2 look, superseded by the art pass), `phase3` (minerals journey).

### Half-done or open, file by file
- **`js/conquest/style.js`:** the art pass is complete enough for release. Polish candidates for a later look session:
  - crop rows read weakly at distance;
  - the sky is only partly visible in the aerial captures;
  - moving units cast no shadows;
  - the veil strength is tuned by eye;
  - the grass-clump density is capped by the per-chunk budget in `conquest-style.mjs` (HIGH ≤ 30k, LOW ≤ 12k).
- **`js/conquest/world.js`:**
  - **COLONY data:** regenerate only with `node dev/tools/colony-gen.mjs --write`, then re-run `conquest-terraform.mjs` and `conquest-minerals.mjs` (reachability).
  - **Wall gameplay:** the wall is physical only. Safe-zone semantics and invasions targeting the wall are queued in the roadmap ("Colony Defense"), not done.
  - **Decoration only:** tank wrecks and the pipeline have no collision.
- **`dev/tests/conquest-colony-captures.py`:** not yet in CI. Optional: add it to `conquest-check.yml` and upload `docs/economy/colony` as an artifact.
- **Reviews:** two independent read-only reviewers (economy/security; gameplay/performance) were launched on `git diff origin/main...HEAD` at `cf4055a`. Their results were NOT collected before handoff. Re-run them.
- **Local CI-equivalent run:** launched at `cf4055a`; results NOT collected. Re-run it.
- **Evidence file:** tests regenerate `docs/conquest-session-2/earned-defense.json` (already stale on main). Restore it with `git checkout`; never commit it.
- **`docs/ROADMAP.md`:** update the status column after release.
- **Network:** this cloud environment's proxy blocks `lunar-api.solb7403.workers.dev`. Verify production through the `deploy-worker.yml` run annotations (its last steps poll `/pvp/health` for `"ok":true` and print the live `version.json`), or add that host to an environment.

### Exact remaining steps through release
1. `git checkout claude/friendly-allen-7tcyca && git pull`, then `npm install --prefix worker --no-audit --no-fund --package-lock=false`.
2. Run every `node dev/tests/...` listed in `.github/workflows/conquest-check.yml` and `deploy-worker.yml`, `bash dev/tests/conquest-regression.sh`, and the browser journeys (`conquest-onboarding.py`, `conquest-airdrop-browser.py`, `conquest-terraform-captures.py --quality high`, `conquest-minerals-browser.py`). Restore regenerated evidence files. Fix any failure.
3. Two independent read-only reviewers (economy/security, gameplay/performance) on `git diff origin/main...HEAD`. Fix valid findings, re-run the affected tests, push.
4. Merge the latest `origin/main`. Keep the build stamp consistent; re-stamp `index.html` and `version.json` together if anything changes after it; `lab-ui.mjs` checks they match.
5. Open the PR (template `.github/pull_request_template.md`) and wait for green CI (conquest-check, equipment-balance, lab-ui-check, website-check, ai-tooling-check as triggered).
6. Merge (the owner pre-approved the release; AGENTS.md rule 4: no owner request may be unanswered or unimplemented).
7. `deploy-worker.yml` runs on the push to main. Confirm the pvp health annotation shows `ok:true` and the live `version.json` equals the stamp; also check the Pages `version.json`.
8. If broken, revert the merge commit on main (`git revert -m 1 <merge>`), push, and confirm the redeploy.
9. Final report here: what shipped, the agents used and whether they changed the result, and what is unverified (PHYSICAL_IPHONE_UNVERIFIED; no WebKit run; the strike difficulty and mineral income are modeled). Update the ROADMAP status.

## Checkpoint 23 — RELEASE: World, Resources & Airdrop Points (PR #69, branch `claude/friendly-allen-7tcyca`) — owner morning review

**Status:** released under the owner's pre-approval (Nov 8: "run unattended; don't wait for my approval"). The deploy verification is recorded in "Deploy verification" at the end of this section.

### What shipped (session 4 of docs/ROADMAP.md)
- **Economy:** Conquest airdrop points, Command Base multiplier, Daily Base Yield, and the 50,000 daily cap shared by every mode.
- **Minerals and armour:** 6-tier minerals with deposits, scanner, gathering, caches and banking, plus Meteor Strike, Arcade/PvP and league mineral drops, and Hull Plating.
- **Terraform rework:** creek, reservoir, forests and bio-flora.
- **The colony:** core town, farm ring, frontier wall, roads (+15% on paved), monorail and crew, drawn in the owner's rugged war-torn frontier art direction (settlers in amber, military in cyan).

### Terraform art self-check (owner override, Checkpoint 22 item 1)
Every element of the override is in the build and visible in the captures:
- clumped olive/straw/dark-green grass with dirt, gravel and regolith showing through
- rock and strata on steep ground
- shell craters and tank ruts
- scrub, thornbushes, ferns by water, and dead/burnt trees; flowers only near the core
- hazy amber-to-steel sky, low sun and baked long shadows
- slate water with muddy banks
- wrecks, sandbags, wire and the pipeline; a cleaner, lit colony core
- no hex lines on open ground

Nothing was half-done. Polish candidates stay for the later look session: crop rows at distance, more visible sky, unit shadows, veil tuning.

### Final captures (390 portrait, Chromium SwiftShader; relative only, not phone FPS)
- `docs/economy/colony/contact-sheet-390-high.jpg` and `contact-sheet-390-low.jpg`
- the six shots at HIGH, LOW and 2D: `docs/economy/colony/*-390-{high,low,2d}.png`
- stats: `stats-high.json`, `stats-low.json`, `stats-2d.json`

| Quality | Draws | Triangles | Programs | Page errors |
|---|---|---|---|---|
| HIGH | 50–78 | 119k–205k | 16 (budget ≤ 16) | 0 |
| LOW | 47–68 | 104k–142k | — | 0 |

- Journey evidence regenerated on the final code: `docs/economy/phase1`, `phase2`, `phase3`.

### Regressions found this session and fixed (all reproduced first, then shown passing)
1. **`conquest-combat` (starter battle).** A new frontier-wall run 18–27 m from the oxygen objective blocked every attacker shot, so the starter battle could no longer be lost. `main` passes this test; the branch failed it.
   - Fix: `colony-gen.mjs` keeps walls and watchtowers 60 m clear of the starter objective.
   - The colony was regenerated. Only those 2 walls and 2 watchtowers were removed; nothing else in COLONY changed.
   - Every other defense battle plays out the same as on `main`, undefended (checked on both).
2. **`conquest-corrections`.** Exact-travel probes did not allow for the paved-road +15%.
   - Fix: a shared `World.speedFactor`, used by `advance()` and by every footing probe (server footing, client safe footing, travel arrivals).
3. **HIGH program budget (CI `transmission`, Chromium and WebKit).** The Phase 2 water and the art-pass veil had pushed HIGH to 17 material programs, over the README contract of ≤ 16.
   - Fix: the veil now draws through the existing FX program, with an early raw-additive return, so it looks exactly as before.
   - The relay fight now measures 16 programs and 73 draws.
4. **`conquest-frontier-recovery`.** The test bot drove over a normal 18 CP kill-salvage drop mid-fight.
   - The test now separates verified mid-fight kill salvage from the settlement, and asserts the settlement equals the authored reward.

### Independent reviews (2 read-only agents, given only the branch, head SHA, briefs and this checkpoint)
Neither reviewer found a blocker or any way to mint or duplicate points or minerals. Both changed the result: every valid finding below was fixed and tested.

**Economy/security reviewer:**
- a won Meteor Strike left its sector "contested" forever (major); strikes no longer contest territory
- the strike core roll was visible to the client; now hidden
- Daily Base Yield points could be lost under the hourly limit; now held
- PvP weekly minerals used the account league; now the room league
- a live-room credit retry could pay twice; now keyed per seat and match, with a test
- plates were missing from the non-lab loadout

**Gameplay/performance reviewer:**
- the same strike bug
- SCAN taps were dropped at 60 fps; now latched
- Hull Plating was missing from the client loadout
- footing probes failed on roads; plus a new regionRevision-2 migration that moves pilots saved inside new colony solids, the dam, pylons or deep water (with a test)
- LOW terrain went from 1 to 6 texture fetches; now 3, and LOW sky uses one cloud octave
- flora placement ran synchronously on chunk load; now a resumable job under the streaming budget
- per-frame allocations in the colony animation
- GATHER covered ACT
- featured contracts could pick strikes

### Tests actually run (local, final code)
- **Node:** all 81 node suites from conquest-check, deploy-worker, equipment-balance, lab-ui-check and website-check, including `bash dev/tests/conquest-regression.sh` (all 27 tests). All passed.
  - The earned journey still reaches the first base inside the 45–75 min target.
- **Browser (Chromium):** onboarding, earned-browser, earned end-to-end, preview x2, airdrop, terraform captures (high), minerals, and flagship 390 all passed. Colony captures at HIGH, LOW and 2D passed with no page errors.
- **CI:** PR #69 runs the whole CI matrix, including WebKit and Firefox, against the final head.

### Agents used
2 reviewers (above). No other agents.

### Unverified
- PHYSICAL_IPHONE_UNVERIFIED: no physical phone frame timing.
- WebKit only through CI.
- Strike difficulty and mineral income are modeled, not measured with players.
- The colony wall stays physical only. Colony Defense is queued for session 7.

