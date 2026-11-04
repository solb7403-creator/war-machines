# LUNAR: WAR MACHINES — CODEX HIGH / CONQUEST SESSION 02
November 4, 2026
PRIORITY: Implement the actual second focused Conquest development session after Session 01 was merged/deployed and visually inspected in the real iPhone Telegram Mini App.

READ FIRST: docs/conquest/MASTER_BLUEPRINT_v1_2.md on the SAME branch.
AUTHORITY: This specific file controls what to code in Session 02. The Master Blueprint supplies context only. Do NOT implement the future systems described there.
WORKFLOW: One agent, Codex High. Minimize waste. Inspect the actual current main/PR state before touching code; use the latest integrated Conquest foundation. Work on a focused feature branch with a draft PR targeting main. DO NOT merge or deploy without owner authorization.

## A. Exact owner feedback from iPhone screenshots
1. Three-dimensional terrain depth is genuinely working: elevation, bridge from high above, drive-under route, hills. PRESERVE this architecture and make terrain depth and height increasingly convincing.
2. Graphics currently look exceptionally crude/low quality: placeholder green columns/trees, cuboid buildings, flat muddy materials, cuboid vehicle; improve visibly within mobile constraints. Do not claim AAA final art in one pass.
3. The dedicated Conquest opening screen is functional but visually underwhelming. Redesign into a genuinely impressive, dramatic, polished entry hub.
4. The tank visibly moves roughly 3–5 times slower than in Arcade. Conquest must drive with the SAME equipped chassis and permanent equipment bonuses as the actual Arcade build. Investigate and fix perceived/real delay including FPS and delta-time issues. Do not inflate speed by randomly multiplying the base constant.
5. Useful landscape visibility should be AT LEAST 2x current distance, ideally more where iPhone performance permits. Changing fog without rendering distant geometry is NOT sufficient.
6. Entire world must remain exact WIDTH 31,680 X units × LENGTH 47,520 Z units, with expandable boundaries. Do not shrink map, change 4.4 BASE reference speed, or artificially slow all player tanks to enforce 2h/3h crossings.
7. No live players currently; do not add unnecessary owner-only gates to view Conquest. Continue protecting sensitive/payment systems. Session 02 stays a reviewable draft PR, not a deployment.

## B. Required architecture review
Read these actual files before implementation:
- js/conquest/world.js, view.js, app.js, css/conquest.css
- js/main.js, js/ui.js, web/boot.js, web/play.html, index.html
- js/rules.js (canonical tankOf, ecoLoadout, machineMetrics, chassisOf, fittingStats and Speed Core arithmetic)
- js/core.js (myLoadout and active bay behavior), relevant Garage/Showroom/equipment rendering APIs and current 3D libraries.
- Current relevant tests, especially dev/tests/conquest.mjs and browser test plus six-mode and equipment/regression tests.
Do not modify the Arcade's W=20, H=32 battle geometry or shared PvP worker sim to make Conquest bigger. Keep Conquest renderer isolated, but share AUTHORITATIVE stats and loadout identity.

## C. Absolute requirement: Arcade-equivalent chassis/equipment
The current Session 01 viewer drives with a universal ConquestWorld.SPEED = 4.4 and shows a primitive placeholder vehicle. Change it to instantiate the player's ACTUAL ACTIVE equipped Garage bay.
- Query the existing authoritative active loadout using the same save/account and equipped bay selection as Arcade (the validated myLoadout / ecoLoadout / labLoadout path); do not read a random unowned chassis or stale legacy field.
- Reuse canonical tankOf and machineMetrics calculations. Movement speed must include chassis class/rarity quality, Engine upgrade, fitted mods, equipped Speed Core and level. Avoid independently recreating formulas that could diverge. Maintain the expected speed for a live Arcade unit outside temporary in-match buffs; temporary pickups/battle-only modifiers should not be fabricated as persistent Conquest travel bonuses.
- In rules.js the established machineMetrics(L).spd represents STAT.speed * tankOf(L,1).spdM * (1 + equipped Speed Core contribution). Use that as an authoritative reference, preserving its precision where possible for physical updates.
- Ensure faster chassis and upgrades are materially faster in Conquest and slower chassis appropriately slower, exactly as in Arcade.
- War Machine appearance: reuse the existing owned chassis, equipped weapon, paint, Lunar Skin overlay, Moonbeam and other valid 3D components where feasible; respect model size and orientation. Integrate the Garage/showroom renderer assets safely rather than making unrelated new gear designs. If full battle model reuse proves technically impractical in one pass, prioritize correct stat parity and report model integration limitations honestly; no fake claims.
- Reloading/re-entering Conquest, changing active bay, and changing equipped permanent speed upgrades must reflect the latest active legal build, not a cached stale build.
- Actual world/position authoritative Y surfaces continue to agree with rendered ground/deck and machine footing. Don't let high speed tunnel through bridge rails, terrain or chunk boundaries.
- Fix frame-rate-dependent slowdown. Existing js/main.js caps dt at .05s; check whether this starves movement time on slower iPhones. Use separate measured, bounded Conquest elapsed-time accounting and safe substep movement/collision as necessary. Avoid huge teleport after backgrounding; reset on return. Do NOT globally alter Arcade's dt or PvP simulation. Distinguish genuine speed parity from the separate camera-scale illusion; improve perceived speed with camera/vehicle framing as necessary, without faking stat changes.
- Test base VANGUARD, SCOUT, TITAN and differences from tier, Engine levels, Speed Core levels, legal mods. Verify their Conquest world units/second against the shared Garage/Arcade calculator within sensible floating-point tolerances. Label measured results and excluded terrain/obstacle effects.
- Once gear modifies speed, original 2h X / 3h Z benchmark REMAINS defined only for 4.4 reference speed. Do not demand 2h/3h for every equipped War Machine; that contradicts stat parity.

## D. High-quality 3D environment: meaningful visual upgrade
Session 01 implemented real perspective WebGL, procedural elevation, 128-unit streaming chunks, near/far mesh LOD and one bridge with two legitimate navigable surfaces. Build on these, not around them.

Improve distinct regions:
1. Green terraformed refuge: coherent sheltered valleys, diverse recognizable trees with trunks/canopies, grouped vegetation/groundcover, terrain tint and ambient atmosphere appropriate to life-support areas, not green rectangular pillars.
2. Massive oxygen facilities: far-visible, monumental sci-fi generation towers and connected industrial structures, supports, pipe networks, atmospheric effects, illuminated details and spatial grounds that communicate the scale of civilization's survival. These are environmental placeholders with convincing visual silhouette, NOT production/economy systems yet.
3. Human refuge town/outpost: groups of varied habitat forms, roads/path indicators, antennas, lighting, perimeter detail. Spatially logical and navigable, not rows of floating identical cubes.
4. Low-oxygen barren Moon: dramatic regolith plains, rocky outcrops, fissures, craters, massifs, sparse dead infrastructure, dusty material variation, stark lighting; distinct from terraformed regions.
5. Highlands: real heightmapped mountain ranges, broad slopes, elevated ridges, valley floors, substantial crater rims/depth. Ground mesh, collision/surface samples and cameras agree; cannot see players through solid terrain merely because of lighting.
6. Bridges/vertical structures: emphasize railing, ramps, structural depth, proper supports, genuine upper/lower playable routes and strong look-down vantage points. Keep all movement and collision honest.

Terrain art must use deterministic world coordinates; no per-load random location changes. Variety should exist across the global Moon at different generated coordinates, not solely inside a tiny prebuilt showcase. Select a limited number of thoughtful, distinctive authored landmarks to prove extensibility. Integrate roads/transport corridor visual logic without promising fully functional vehicles or warp gates.

Implement performance-aware environment rendering: geometric LOD, instancing, merged repetitive detail, frustum/distance culling, material reuse, texture/geometry cleanup. Prefer aesthetically superior manageable procedural materials and forms over thousands of per-object draw calls. Avoid new external paid asset services and downloads. Keep current program architecture and stable world IDs.

## E. At least double useful far visibility, with proof
Current renderer has fog approximately near 220, far 530, perspective far plane ~700, chunk streaming radius 4*128 and limited coarse distant geometry. Merely setting fog far to 1200 produces holes if terrain isn't streamed.
- Target real useful landscape view >= roughly 1,060 game units where topography/visibility permits, with a corresponding camera far plane and low-detail terrain actually appearing at distance. Add sensible far impostors/large-scale terrain LOD/terrain horizon if required.
- Maintain crisp high-detail near ground, efficient mid LOD, very cheap longer-range silhouettes and smooth transitions. Avoid over-visible chunk boundaries and severe LOD popping.
- Increase visibility progressively/conditionally with mobile quality settings when performance requires it, but report the actual achieved numbers and what appears in view on iPhone-like mobile tests; do not silently miss 2x objective and claim success.
- Camera can orbit/pitch/zoom with clear third-person perspective; maintain awareness of high/low terrain and avoid cliffs/bridge structures obscuring the entire screen. Make exploration and tall-scale visibility feel epic while keeping vehicle readable.
- Measure draw cost, total live resources/chunks, build cadence, disposal and recovery, and compare before/after for a mobile viewport. Software WebGL estimates are not physical iPhone Safari measurements.

## F. Conquest hub redesign and world map polish
Use screenshot feedback: current hub has oversized plain text and gradients, mostly empty layout, tiny moon circle and basic controls.
- Redesign the separate Conquest home to feel visually powerful, polished and uniquely LUNAR: premium sci-fi lunar command briefing / last stand, coherent dark graphite+gold+icy energy accents, panoramic/moon/terrain-orbit artwork or tasteful actual in-engine preview as appropriate, clear title and hierarchy.
- Primary ENTER CONQUEST button must stand out. Secondary WORLD INTEL and RETURN TO ARCADE remain functional, possibly show a small current-location/region/readiness area based on actual available data. Do not fake active fronts, other players or earned resources.
- Maintain responsive iPhone Telegram safe-area layout. No tiny cramped buttons, clipping, overflow, stuck focus or broken touch movement.
- Polish the full Moon strategic map: distinguish terrain/biomes and regions at various scales, pan/zoom/locate reliably. Add sensible landmark icons or labels and coordinate/readable navigation aids, without pretending future warp-discovery has been implemented. Pinch zoom if feasible without destabilizing controls; button zoom must work.
- Existing Conquest open/close and return-to-Arcade must be seamless and cleanup WebGL resources safely.

## G. Strict boundaries
THIS SESSION IS NOT authorized to build: real Parasite enemies, combat firing/damage, PvP/live MMO battles, team raids, war resource production, base ownership/upgrades, reputation/CP economy, persistent territory ownership, server/backend migrations, purchased upgrades, paid warp gates, airdrop/token changes, future orbital plasma/missile/drone strike mechanics, or Lunar Forge.
Keep the six existing Arcade modes, gear balances, PvP server, account, payments, loot, points, onboarding and live data unchanged. The only shared-code modifications allowed are essential and carefully regression-tested helpers, loading paths or integration seams.
No need for extra speculative planning files or duplicate architectures; build working in-game improvements. If a requirement is genuinely infeasible without major risk, explain the precise blocker and prioritize working foundation rather than invent a false implementation.

## H. Acceptance tests / actual proof
1. ConquestWorld.WIDTH=31,680; LENGTH=47,520; reference SPEED=4.4. Existing deterministic terrain, seam, edge, two-surface bridge navigation and far-coordinate generation tests PASS.
2. Movement tests comparing Conquest velocity to machineMetrics/tankOf for representative real active Garage loadouts: Vanguard/Scout/Titan, multiple tier qualities, equipped/unequipped Speed Core and levels, Engine, legal Mods, switch active bays and re-entry. Verify no 3–5x unexplained slowdown and bounded FPS catch-up without moving through geometry.
3. Visual proof from real in-game screenshots, not concept art, of: improved hub, mountain/valley vista, terraformed forestry, monumental oxygen complex, human refuge/outpost, barren zone, full strategic map, and bridge top/underpass.
4. Verification that non-showcase remote coordinates produce appropriate seeded world terrain/landmarks and streaming never explodes unboundedly. Check near/mid/far terrain and no missing huge horizon holes.
5. Measure useful visibility after the changes (target >=2x Session 01's 530-unit far fog reference, with real scene geometry) and resource counts/frame estimates on mobile-sized browser viewport. Explicitly note if actual iPhone test unavailable.
6. Exercise 200+ long-range streamed moves/far jumps, deterministic re-entry, world map pan/zoom, touch drive/orbit/zoom, exit and Arcade recovery. Detect console errors and leaking GPU or event resources.
7. Re-run appropriate existing tests: environment, map-layout, map-nav, Garage rules, defender isolation, graphics motion, equipment, gear combat and any updated dependency/simulation tests. Don't silently claim tests never run.
8. Do not claim exhaustive traversability of the entire 1.5-billion-unit Moon based only on dimension math. Sample long-range corridors and surface passability explicitly; report what remains unverified.

## I. Deliverable and usage discipline
- Start from latest current main with Session 01 merged; maintain world compatibility and all existing real progress.
- Use Codex HIGH thinking and one agent. Avoid unnecessary refactors/research/redesign; execute complete approved scope efficiently.
- Output an implementation summary, file inventory, actual tests/results, screenshot references, before/after performance evidence, quality gaps, iPhone validation directions and PR URL. If iPhone Safari hardware wasn't tested, say so.
- DO NOT merge or deploy Session 02 until the user explicitly approves. Do not contact outside users, spend money, touch payments or add temporary owner-only access controls.
- If capacity is constrained, priority order: (1) preserve architecture and dimensions, (2) exact Arcade-equivalent movement and FPS fix, (3) 2x+ real far visibility, (4) substantial environmental upgrades, (5) impressive hub redesign, (6) map/navigation polish.

END OF SESSION 02 IMPLEMENTATION INSTRUCTIONS.
