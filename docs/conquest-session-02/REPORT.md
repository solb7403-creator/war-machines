# Conquest Session 2 — implementation and validation

Built from current integrated `main` (`b1218ca`, Session 1 PR #39), on `codex/conquest-session-02`. Read both supplied documents completely from `conquest-session-02-materials`; Session 02 controls scope. Two agents total after the owner's updated allocation: coordinator implemented/integrated; second agent reviewed equipment/movement and supplied production-view tests. No merge, deployment, production account writes, payments, backend migrations, or combat/economy systems.

## What changed

- Current validated `myLoadout()` → active Garage bay supplies both the actual shared chassis/weapon/paint/Lunar Skin/fitting kits and permanent travel stats. `machineSpeed` extracts the unrounded calculation already used by `machineMetrics`; Garage display rounding remains unchanged. No temporary battle bonuses. Appearance also refreshes when the shared graphics generation changes.
- Conquest receives measured frame timestamps independently of Arcade's unchanged 50 ms cap. Intervals through 250 ms are consumed; longer gaps are dropped, and blur/visibility/modal transitions reset input. Travel uses at most 0.2-unit collision steps. Closer default camera, correct +X kit orientation, terrain/ramp tilt, and canonical Y footing improve readability without changing stats.
- World remains **31,680 X × 47,520 Z**, reference speed **4.4**. Seed, coordinates, IDs and bridge surface provider remain. Broad relief/highland uplift increases outside the blended original refuge; saved X/Z is preserved and Y is resampled. This changes remote elevation, not world dimensions. Towers/habitats now have solid footprints.
- Detailed 4-unit near terrain, 16-unit middle terrain, and a merged 64-unit outer terrain ring extend actual geometry to the **1,280-unit fog cutoff**, with a **1,600-unit camera far plane**. The outer footprint guarantees coverage beyond 1,060 units, including camera offset, except at real theater boundaries. This is 2.42× the old 530 cutoff; topography still legitimately occludes terrain. Near chunks remain capped at 81, construction at two/frame; phones use nine fine chunks rather than 25. One far mesh rebuilds on crossing a 128-unit cell. No unbounded mesh cache.
- Seeded pines and broadleaf crowns/trunks, angular rock clusters and sparse derelict relays populate remote coordinates as well as the refuge. Terrain has a deterministic repeating microtexture. Monumental oxygen towers/collars/supports/pipework, habitat domes, glazing, antennas, solar panels, path strips and continuous viaduct rails replace the original cubes/columns. Static architecture is batched into one colored draw; repeated ecology is instanced. Shared geometries, materials, textures, instance buffers and graphics leases are released on exit.
- New graphite/gold/ice command hub uses a local authored SVG panorama and real active-build readiness/speed. World map has distinct biome colors, stable landmark markers, zoomed labels, bounded pan, centered button/pinch zoom, locate/reset, modal Escape/focus behavior and phone layouts.

## File inventory

| Files | Responsibility |
|---|---|
| `js/conquest/world.js` | Deterministic world, uplift, horizon/scenery, travel timing/substeps, landmark footprints |
| `js/conquest/view.js` | Equipped Garage kits, movement/camera, instancing/LOD/batching, procedural texture, resource lifecycle |
| `js/conquest/app.js`, `css/conquest.css` | Hub, measured Conquest clock, map/input/UI and diagnostics |
| `js/assets/conquest/command-horizon.svg` | Locally authored hub artwork; no external asset service |
| `js/rules.js` | Extract existing unrounded permanent speed into shared helper |
| `js/main.js` | Pass frame timestamp to Conquest only; Arcade/PvP dt unchanged |
| `dev/tests/conquest.mjs` | Terrain, horizon, dimensions, seams, collisions and sampled corridors |
| `dev/tests/conquest-travel.mjs` | 216 build combinations and 10/15/20/60 FPS displacement |
| `dev/tests/conquest-view-travel.mjs` | Production View/core loadout integration with real THREE and Garage geometry |
| `dev/tests/conquest-session-02.py` | Reproducible mobile before/after measurements and in-game screenshots |
| This directory | Screenshots, raw performance JSON and this report |

## Actual checks and results

All following completed with exit 0:

- `node dev/tests/conquest.mjs`: original dimensions/reference crossings, deterministic near/far terrain, fine seams, 500 streaming key moves, bridge upper/lower navigation and ledges; bounded far geometry, seeded remote scenery, solid towers, mobile LOD. Four 400–447-unit corridor samples: first three completed; northbound underpass continuation stopped at Z≈1,252 on a steep slope (715 of 2,000 attempted steps blocked). The bridge underpass itself remains passable. **No claim of exhaustive global connectivity.**
- `node dev/tests/conquest-travel.mjs`: 216 chassis/tier/Engine/Speed Core/core-level/legal-mod combinations; exact canonical velocity, Garage rounding tolerance ≤0.051, 10/15/20/60 FPS displacement, resume bound, rail stop, active owned bays and rejected unowned chassis.
- `node dev/tests/conquest-view-travel.mjs`: actual `View.tick`, `syncLoadout` and core `myLoadout`, with real THREE; physical displacement, normalized keyboard/joystick, reset, seam traversal, ramp/ground orientation and Y. Actual position/normal/color buffers equal shared Garage kit output for owned Moonbeam, paint, Lunar Skin, mods/visual overrides; mounting, scale, ownership rejection and re-entry checked. Only GPU drawing/streaming are stubbed here; browser tests cover those.
- `python dev/tests/conquest-browser.py`: 390×844 touch drive, keyboard, perspective camera, both bridge levels, map, far edge, **200 rendered streamed jumps**, exit/disposal/re-entry and Arcade fight/Garage/Shop recovery; six modes present; **zero page errors**. Final far-edge scene: 25 chunks, 19 GPU geometries. After exit: zero chunks and no further builds (515 builds before/after disposal).
- `python dev/tests/conquest-session-02.py`: isolated local account fixture, 320/390/430 layouts, all screenshot subjects, real active-bay/Engine change, map controls and touch pinch, orbit/zoom, re-entry, native context-loss recovery and exit; zero page errors. All resources served locally; no external fallback.
- Existing Node suites: `environment`, `map-layout`, `map-nav`, `garage-rules`, `defender-isolation`, `graphics-motion`, `standard-equipment`, `gear-combat`, `gear-balance`, `combat-ghosts`, `hf-foundation`, `hf-collection`, `legendary-visual`, `gem-ui`, `lab-ui`, `web-login`, `web-fixture` (each under `dev/tests/*.mjs`). Garage rules and gear combat were rerun after the shared helper extraction. Gear combat: **656 paired duels, 180 six-mode practice trials, 19 legal fitting sets, 3,420 client/server parity cases**.
- `node dev/tests/velocity.mjs`, `node worker/build-sim.mjs`, JS syntax checks and `git diff --check`: pass. Generated worker sim is ignored; no worker source/physics changes.

An optional full `combat-grid.mjs` calibration sweep was started and deliberately stopped before completion; it is not counted as passing. It is a long balance calibration, not the regression assertion suite. Initial browser attempts caught an unavailable `THREE.Matrix3` export in this project's reduced vendor build; batching now uses the supported geometry transform path, and final browser checks pass. There is no root `npm test` script; commands above are the selected relevant regression suite, not a claim that every repository test ran.

Representative obstacle-free physical velocities (world units/second; rounded Garage display in parentheses):

| Chassis | Stock, Engine 0, no Speed Core | Epic roll 1.10, Engine 4, Speed Core 5, legal Light + Sprint |
|---|---:|---:|
| Vanguard | 4.400 (4.4) | 10.058856192 (10.1) |
| Scout | 5.412 (5.4) | 12.330210816 (12.3) |
| Titan | 3.872 (3.9) | 8.842059072 (8.8) |

Terrain/obstacle blocking is excluded from velocity parity. The two-/three-hour crossing benchmark applies only to the 4.4 reference build.

## Rendering evidence

See [performance.json](performance.json) for the raw before/after capture at the same location and 390×844 viewport. Baseline source is pinned to `b1218ca`. CPU time instruments production ticks; FPS uses real requestAnimationFrame timestamps, not synthetic dt. Software SwiftShader on a shared host is variable and **not physical iPhone Safari performance**. The richer scene increases rendering cost; do not interpret correct travel speed as a claim of improved GPU frame rate.

| Measurement | Session 1 | Session 2 |
|---|---:|---:|
| Fog cutoff | 530 | 1280 |
| Camera far plane | 700 | 1600 |
| Near/mid chunks | 81 | 81 |
| GPU geometries | 42 | 53 |
| Textures | 0 | 2 |
| Rendered draw calls | 38 | 53 |
| Rendered triangles | 20280 | 33802 |
| CPU tick ms | 4.11 | 2.04 |
| Observed software rAF FPS | 33.91 | 19.67 |

Actual game screenshots using an explicitly local legal test Garage fixture (not concept art or production-account data):

[Hub](hub.png) · [Highlands/valley](vista.png) · [Forestry at remote coordinates](forestry.png) · [Oxygen complex](oxygen.png) · [Refuge outpost](outpost.png) · [Barren zone](barren.png) · [Whole strategic map](map.png) · [Viaduct upper route](bridge-top.png) · [Underpass](underpass.png).

## Quality gaps and owner iPhone validation

- No physical iPhone Safari or real Telegram hardware test was available. Software frame rate is lower than Session 1; hardware thermal/FPS validation remains a release gate for the owner. Geometry/instancing/phone LOD reduce cost, but this is not a performance certification.
- Art is still stylized procedural placeholder geometry, not final assets. Atmospheric volumes, detailed settlement interiors, fully animated vehicle treads and refined contact shadows are not delivered. Avoiding extra passes/volumes is deliberate given measured render cost. Chunk/skirt transitions and foliage/camera occlusion can still need polish. Only a few major installations are authored; remote ecology/geology/relays are seeded, not a populated MMO.
- Coarse distant geometry is for silhouettes; physical contact uses the fine provider. Diagnostic jumps now invalidate the previous ready status immediately (regression tested); initial entry/far diagnostic jumps fill near chunks over multiple frames; live travel keeps bounded streaming. Some wilderness slopes block travel; only the named corridor samples and bridge routes were validated. No warp discovery, territory, rewards, ownership or resource production is simulated.

After explicit release authorization, test the reviewed build on the actual iPhone Telegram Mini App: switch active Garage bays and permanent upgrades, enter/re-enter and compare diagnostic speed; drive for ten seconds on the viaduct; orbit/zoom and pinch/pan/locate the map; inspect towers/refuge and a remote highland/barren sector; cross upper and lower bridge routes; background/resume and verify no teleport/stuck drive; return to Arcade and exercise existing modes/Garage. Record sustained FPS, thermal behavior and scenery/camera issues over several minutes, including repeated entry/exit. Do not infer full-Moon traversability or physical frame rate from this report.

PR remains draft against `main`. Merge, deployment and production version stamping require the owner's separate authorization.
