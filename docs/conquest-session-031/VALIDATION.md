# Conquest 3.1 validation

Release candidate: 20261104143000. Base: deployed Session 3, d15a0d1.

## Corrected behavior

Movement rejection was reproducible: requested east/west motion at 1351/1063 and1283/1104 was diverted into contour sliding. The microstep rise/run veto used asymmetric uphill/downhill limits and a point triangle test. Movement now evaluates support across the six-unit track footprint with symmetric ascent/descent, retaining a separate sharp-face limit and collision microsteps. Terrain heights, dimensions and rendering geometry were not flattened or rescaled. Existing cliff, tower, rail, bridge and route cases pass. Deterministic rendered boulders and authored enemy bunkers block driving/shots.

The oxygen interaction is explicit within150 units, including1163/1132; entering the area does not start combat. A distant start protects facility health for60 seconds while the player approaches. The three waves deploy from the red staging installation near1230/995. Ash Redoubt is a separate defended installation at1240/920. Guards use the same damage/projectile/steering framework, authored stats, bounded home ranges and nearby activation. Defeated guards are local client state, not server-authoritative territorial ownership. No encounter rewards exist.

Recovery requires rejected driving or a disabled vehicle, a verified breadcrumb6–80 units away, and a30-second cooldown. It does not pass displacement to discovery, reset mission health, complete missions or mutate equipment/economy.

## Executed checks

- `bash dev/tests/conquest-regression.sh`: exit0. Includes terrain, legal Garage builds and premiums, tread motion, discovery, mission progress/combat, all six Arcade map layouts/navigation and shared balance/UI suites.
- `node dev/tests/conquest-corrections.mjs`: all three reported positions, eight vectors,10/60 simulated FPS. Regression failed before the movement change.
- `node dev/tests/conquest-garrisons.mjs`: authored units, remote dormancy, bounded guard response, real weapon kill, local cleared reload, distant activation protection and staging origins.
- `python dev/tests/conquest-onboarding.py`: PASS390×844 and360×640; introduction/dismiss/replay/persistence, camera-relative arrow, assigned-map fog preservation, owner-coordinate interaction, explicit mission start, non-overlapping control hit zones. No page errors.
- `python dev/tests/conquest-session-031.py`: PASS390×844. Default spawn→actual directional driving over bridge→oxygen approach; all three reported positions with W/S/A/D plus actual mobile DRIVE contact; explicit mission start at1163/1132→physical west detour around towers→combat; victory7 kills/3 waves, hull1541/1700, oxygen1800/1800; outpost guard destroyed by real shared weapon damage; actual rejected tower driving→recovery7.96 units with discovery version30 unchanged; account points/purchases/upgrades unchanged; three far/near cycles with remote enemy meshes removed and65 geometries on each return. No page errors.
- `node worker/build-web.mjs` and `git diff --check`: pass.

## Browser coverage and performance limits

Chromium uses SwiftShader in a managed Linux environment, not a physical iPhone or Telegram WebView. Diagnostic placements set up each reported-coordinate and outpost fixture; they do not reveal terrain. The default bridge/mission route uses actual key inputs. Mission completion and the outpost kill combine real held FIRE with accelerated production combat ticks and automated aiming; this is not a claim of an unassisted human playthrough. Outpost combat uses1240/893: terrain can occlude shots from1240/875, and a visible rock blocks its direct driving line. No claim of continuous browser driving from the mission to the outpost is made.

Final local sample:1340 frames, approximately62 MiB JS heap at the sampled endpoint. Median/p95 frame intervals76/184 ms; tick CPU1.5/18.1 ms; combat simulation0.1/7.0 ms; draw calls61/91 (maximum139). Samples include loading, diagnostic streaming/rebuilds and concurrent UI-browser contention. Geometry counts stabilize over the measured three-cycle test; this does not establish long-duration memory behavior or hardware frame rates. See raw gameplay-results.json for exact samples and per-input displacement.

Screenshots cover story, objective guidance, interaction, all reported slopes, bridge travel, deployment, combat, victory, garrison, installation and recovery.
