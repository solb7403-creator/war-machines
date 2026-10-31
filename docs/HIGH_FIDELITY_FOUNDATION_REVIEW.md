# Graphics Session 1 — high-fidelity foundation / owner review

A working, opt-in UV/PBR equipment pipeline and one representative quality-bar sample are implemented through the actual game and showroom. **Not a production release, not approval of the staged designs, not a completed rebuild of the collection. No merge or deployment.**

## Integration and approval boundary

GitHub was refreshed before editing. Verified unchanged ancestry:

| Ref | SHA | State at start |
|---|---|---|
| main | `385356ea4ffac207900d05be6fbdf1965081fa63` | production, untouched |
| #14 `feature/defender-mobile-art` | `d237fc5055afa6596239e75afbc148bc93121615` | open draft, unmerged |
| #15 `feature/standard-equipment-visuals` | `aa558bc8b3fce35186d9f6bf2a2774ad80a517fd` | open draft, based on #14 |
| #16 `feature/final-legendary-visuals` | `a1363d37dc6d53104542bac496b2c21b6d3a11c4` | open draft, based on #15 |
| This branch | `feature/high-fidelity-foundation` | created directly from #16; exact final SHA is in its draft PR head/completion response |

No Git merges/conflict resolution or rebases were needed. #5 was not included. Integration corrections are confined to rendering: optional asset dispatch, buffer/material ownership, fitting/core/ornament compatibility, and practice appearance reading the unsaved trial's chassis tier rather than the active bay's tier. Rules and battle snapshots are untouched.

**Eventual order, only after explicit owner approval:** approve/merge #14; retarget/review #15 against main, then approve/merge; retarget/review #16 against main, then approve/merge; retarget this foundation PR against main and rerun required gates. Do not discard branches, assume pending art acceptance, or activate the sample. The remaining graphics sessions and explicit release approval are separate gates. This report authorizes none of those actions.

## Architecture implemented, and why

The existing custom **Three r169** build had no exported `MeshStandardMaterial`; the legacy `M3.put` discards UVs. Merely swapping its Phong material would not work. This implementation keeps that fast, byte-preserved path and adds an optional **custom geometry + UV/PBR** kit alongside it. This is the practical choice for this repository's authored procedural parts, modular sockets and existing batching. No authored GLB was supplied, no GLTF loader is bundled, and **GLTF support is not claimed**. Adding a loader/import/skeleton format for one sample would create another asset path rather than improve the current shared one.

- `js/equipment3d.js`: `Equipment3D` owns versioned asset loading, five named surface types, builders, component primitives, geometry/material banks and leases.
- HIGH uses real `MeshStandardMaterial`, sRGB base maps, linear normal/ORM maps, metallic/roughness/AO response, explicit UV/UV1/tangent attributes, ACES tone mapping and a small original procedural HDR studio reflection environment. Energy remains restrained blue/white unlit geometry through existing effect hooks. Contact uses the existing bounded contact patch/ground decals; no new dynamic shadow maps.
- LOW has genuinely fewer tread shoes, wheel/bolt/coil details and animation draws, 128px maps and simpler Phong shading without HDR sampling. 2D remains the existing game fallback. The LOW shared asset set includes normal/ORM maps, but its simpler shaders sample only base color.
- `M3.chassisKit` / `weaponKit`, `bake`, `meshOf` remain the shared public contracts. Legacy kits keep three existing buckets; optional HF kits retain their UVs, normals, tangents and material identities through per-surface baking. Same geometry/materials reach website showroom, game menu art and actual practice battle renderer.
- The explicit builder registry initially contains only Vanguard T0, unified Moonbeam and a Pulse T0 material comparison. `trackedDrive` accepts dimensions/track offset/wheel count/radii; shared `plate`, `cylinder`, `crest` and material/UV helpers support subsequent assets. No second renderer or inventory format is introduced.
- Immutable baked buffers are cached by render configuration. `M3.meshOf` acquires a mesh lease; replacement/removal releases it. Active leases and the pending chassis/weapon working pair survive LRU pressure. HF buffers are not duplicated into the legacy KC cache. Two shared material/texture banks are bounded to HIGH and LOW; geometry uses a 14 MiB idle target and 12-entry target, with active/working-pair exceptions explicitly measured below.
- Loads verify manifest version, exact byte size, SHA-256 and image dimensions. Texture URLs include version and content hash. Missing/corrupt/wrong-version maps retain PR #16 geometry, with an explicit status and working retry. Missing WebGL requests no maps. Showroom context loss falls back and can recreate a context; the main game's existing 2D fallback policy remains in place.

**Safe default:** optional HF rendering is disabled. Loading the new library does not replace any default model or request its texture maps. A development opt-in (`window.LUNAR_HF_SAMPLE=true` before local app boot) and the account-free preview exercise the sample. No saved preference, ownership or live flag is changed. Prepared cache version `20261030-hf1` exists only on this branch.

## Actual sample and visual scope

The representative is the existing **Vanguard T0** with ordinary paint or graphite/gold Lunar Skin, mounting the **same unified Moonbeam** independently, plus Pulse T0 to demonstrate modularity. Its improved geometry includes a sloping plated hull, bevelled overlapping fenders, separated tread shoes/rubber inserts, exposed seven-wheel assemblies, metallic hubs/fasteners/suspension, recessed cooling hardware and crescents. Moonbeam has connected silver/gold cladding, a long exposed blue core, coils, crescent guards and a concentric emitter. HIGH retains two captive animated collars; LOW removes their extra draws. No hover skin, orbiting moon or crystal triplet returns.

This is a real material/geometry improvement, **not photographic concept matching**. Engraved texture sets, detailed wear, dense hoses/fasteners, final exact design reconstruction, premium environments and final weapon VFX remain future work. The compatibility detail shot deliberately includes the existing earned Vault ornament; its shape was preserved, not redesigned. Owners must review the real images rather than infer acceptance from test passes.

## Actual visual evidence

All images come from actual Three.js/application output. No AI art, screenshot background, image-plane equipment or edited concept is evidence. Shader/material comparisons use the same camera, direct-light rig, exposure and contact setup. HDR reflection response is an actual feature of the new material path.

| Evidence | Links |
|---|---|
| Matched quarter | [PR16 baseline](../evidence/hf-foundation/baseline-quarter.png) / [upgraded](../evidence/hf-foundation/upgraded-quarter.png) |
| Front | [baseline](../evidence/hf-foundation/baseline-front.png) / [upgraded](../evidence/hf-foundation/upgraded-front.png) |
| Side | [baseline](../evidence/hf-foundation/baseline-side.png) / [upgraded](../evidence/hf-foundation/upgraded-side.png) |
| Rear | [baseline](../evidence/hf-foundation/baseline-rear.png) / [upgraded](../evidence/hf-foundation/upgraded-rear.png) |
| Actual game menu renderer, close detail and earned ornament/fittings | [before](../evidence/hf-foundation/baseline-renderer-detail.png) / [after](../evidence/hf-foundation/upgraded-renderer-detail.png) |
| Independent combinations | [stock/Pulse](../evidence/hf-foundation/default-pulse-390.png), [Lunar/Pulse](../evidence/hf-foundation/lunar-pulse-390.png), [stock/Moonbeam](../evidence/hf-foundation/default-moon-390.png), [Lunar/Moonbeam](../evidence/hf-foundation/lunar-moon-390.png) |
| Simulated mobile | [320px](../evidence/hf-foundation/high-320.png), [390px](../evidence/hf-foundation/high-390.png), [430px](../evidence/hf-foundation/high-430.png) |
| Desktop / actual Engineer | [desktop](../evidence/hf-foundation/initial-desktop.png), [Engineer 390px](../evidence/hf-foundation/upgraded-engineer-390.png) |
| LOW / 2D / unavailable WebGL | [LOW](../evidence/hf-foundation/low-390.png), [cold LOW](../evidence/hf-foundation/cold-low-390.png), [2D](../evidence/hf-foundation/fallback-390.png), [no WebGL](../evidence/hf-foundation/no-webgl-390.png), [recreated context](../evidence/hf-foundation/context-recovered-390.png) |
| Real practice renderer | [Arena HIGH](../evidence/hf-foundation/upgraded-battle-arena-390.png), [six-pilot HIGH](../evidence/hf-foundation/upgraded-battle-royale-390.png), [six-pilot LOW](../evidence/hf-foundation/low-busy-combat-390.png) |

The 27 selected PNGs total ~4.61 MB and are outside the production asset allowlist. [Structured measurements](../evidence/hf-foundation/measurements.json) include raw results and environment. Additional local logs/images remain in `/workspace/hf-foundation-evidence/`, not committed.

Busy combat images synchronously extract the real live 3D canvas plus its HUD canvas; HTML controls are shown in separate actual UI captures. This avoids an observed Chromium full-page compositor timeout on a storm frame, without changing game camera, rules, CSP or rendered pixels. The app test was resumed from its completed baseline, not restarted. Six seeded 10-second engine segments per material path were compared; these are not claims of human play or twelve completed matches.

## Validation actually completed

| Check | Result |
|---|---|
| PR14/15 visual collection | **PASS** `defender-visual.mjs`: 9+9 models, 81 standard pairings, 243 fitting sets, 72 paint/team/core cases, 432 byte-parity cases against PR15 |
| PR16 legendary compatibility | **PASS** `legendary-visual.mjs`: 99 combinations across nine class/tier variants; existing +8% HP/damage |
| New pipeline unit/contracts | **PASS** `hf-foundation.mjs`: real PBR runtime, preserved default model counts with library loaded, UV/normal/tangent/material data, HIGH/LOW geometry caps, pending-part ownership under cache pressure, idle release, atlas hash/dimension/transfer caps, pinned r169 |
| Account/economy / PvP / farm | **PASS** 189/189 / 106/106 / 49/49; all isolated services |
| Garage / frozen snapshots / all-mode parity | **PASS** `lab.mjs`, `lab-battle.mjs`, `lab-parity.mjs` |
| Actual shared range engine | **PASS** `range.mjs`: 12 completed seeded six-mode trials; `range-comparison.mjs` |
| Real Workers runtime | **PASS** real local workerd/DO/SQLite/WebSockets: join, VS, fight, ~14 snapshots/s, signed session/nonce/replay/logout, authenticated socket and rejected account-read outage; isolated Firebase only |
| Showroom / mobile quality paths | **PASS** `hf-browser.py`: actual PBR assets, all independent combinations, front/side/rear/quarter, 320/390/430/desktop, HIGH/LOW/2D, 50 switches, visible canvas after changes, cold LOW requests only small maps |
| Real app/practice integration | **PASS** `hf-app-browser.py --resume`: actual PBR Engineer, six modes, identical seeded outcomes to the preserved baseline, no account/owned-bay changes or ranked/payment mutations, 160 art builds, HIGH/LOW/2D |
| Assets/context/lifecycle failures | **PASS** `hf-failure-browser.py`: missing/corrupt/version fallback + retry; zero-map no-WebGL; lost-context fallback/fresh-context recreation; simulated persisted pagehide/pageshow |
| Earned ornament / core/fitting integration and LOW workload | **PASS** `hf-final-integration.py`: actual menu renderer with Vault anchor, core/fitting sample, LOW six-pilot practice and unchanged economy |
| UI / login / build | **PASS** existing `lab-ui.mjs`, `web-login.mjs`; JS syntax, Python compile, explicit Worker asset packaging and `git diff --check` |
| Physical iPhone/Safari/Telegram hardware and real purchases/live PvP | **NOT RUN** — no hardware, production accounts or payments used. Source/shared renderer and isolated runtime checks do not replace these checks |

Corrections were targeted: screenshot/CSP issues were in the browser harness; predicates use functions and engine-canvas extraction rather than weakening CSP. A mobile flex-height collapse was fixed and is asserted. Active pending parts cannot be evicted; mesh leases release correctly. The practice tier and Vault surface adapters are visual-only compatibility fixes. No failing test was disabled or broad audit restarted.

## Measured budgets and remaining performance limits

Environment: headless Chromium / ANGLE SwiftShader software rendering, simulated CSS viewports, local intercepted assets/fake services. Warm render timings fence GL with `finish()` and exclude model construction. They **are not physical iPhone FPS**, and faster timings in one sample are not a speedup claim.

| Matched inspection scene | Draws | Triangles | Warm mean / p95 / worst ms |
|---|---:|---:|---:|
| Baseline PR16 | 19 | 20,888 | 0.73 / 1.90 / 28.30 |
| HIGH UV/PBR | 21 | 26,598 | 0.40 / 2.50 / 4.80 |
| LOW | 19 | 9,742 | geometry/draw measurement; separate game timing below |

The sample's combined HIGH buffers contain 74,628 non-indexed vertices; LOW 24,060. Unit caps are <65,000 HIGH and <23,000 LOW vertices per part. Initial inspection review ceilings are 24 draws/30K triangles HIGH and 20 draws/12K LOW, based on the measured baseline plus separate material surfaces. These are sample guardrails, not global engine rewrites.

Actual game HIGH frame snapshots (draws / triangles): Arena **45 / 46,298**; Moon Zone **89 / 82,610**; Crystal Rush **104 / 83,810**; Bounty **78 / 81,726**; Last Standing **139 / 122,610**; Survival **58 / 47,622**. Six-pilot baseline was **117 / 85,060**. LOW six-pilot was **109 / 43,506**, ~65% fewer triangles than HIGH. Working workload review ceilings are 160 draws/130K triangles HIGH and 120/60K LOW; effects outside these measured scenes still require later optimization.

Six-pilot warmed render cost: baseline mean **1.68 ms**, worst **16.5 ms**; HIGH mean **2.84 ms**, p95/worst in structured data (worst **39.3 ms**); LOW mean **1.83 ms**, p95 **5.10 ms**, worst **5.60 ms** over 60 render frames. HIGH's extra detail has real geometry/material cost.

**Cold work is separate:** LOW's first game frame took **1,942.5 ms** in the software driver. Standalone HIGH reached ready ~**1,936 ms** after navigation (asset validation/decode ~**362 ms**); a new cold LOW context took ~**10,898 ms** (asset subtask ~**1,590 ms**). LOW is demonstrably lighter per frame but is not promised faster cold startup. These slow cold/software-context results are a remaining rollout risk; shader warmup/device profiling belongs before activation, not a fabricated phone performance pass. Controls remain available while maps load; no sample is enabled in production.

Retention: 50 showroom switches ended at **52 geometries / 8 textures**, equal to start/peak. Two 80-build game-art rounds each ended at **103 GPU geometries / 6 textures**, **6 HF entries / 12,320,784 bytes**, with zero HF active mesh leases left. Observed transient HF typed-buffer peak **19,154,784 bytes** exceeded the **14 MiB idle target** while working assets were protected; idle returned below target. Two profiles are the material-bank limit. Counts/typed-buffer bytes are measured; total driver VRAM and system RAM are not exposed and are **not claimed measured**. Approximate texture storage from dimensions is additional to buffers, environment/PMREM and driver overhead.

Asset transfer: HIGH atlas **577,311 bytes**, LOW **25,096 bytes**, combined **602,407 bytes** (<650 KiB unit cap), maximum texture 512px. PNGs already compress; no unsupported GPU-compressed format is claimed. Vendor bundle: **538,248 → 537,039 raw bytes**, **139,484 → 136,342 gzip**. New shared pipeline ~**19.8 KB raw / 7.9 KB gzip**. The loader is optional and no maps are fetched by the ordinary default app. No runtime CDN, purchased assets, trackers or recurring cost.

## Reproduce and extend in Graphics Session 2

Serve the repository locally and open **http://localhost:8000/web/foundation-preview.html** (e.g. `python -m http.server 8000 --bind 127.0.0.1`). It requires no production login and performs no saving, gear grants or account requests. `?quality=low` starts with smaller maps; `?view=baseline` skips them. Use HTTPS or localhost for the browser integrity API.

[Authoring guide and exact build/test commands](../dev/assets/README.md) document component profiles, atlas UV conventions, moving parts/muzzle metadata, versioning, leases, fallback and how to extend the builder registry. `build-surfaces.py` is original deterministic project artwork (Pillow 12.3.0 build-only). `build-three.mjs` pins Three 0.169.0 and esbuild 0.24.2 build-only; Three's MIT license is checked in. No opaque purchased model or new asset service exists.

Next: owner review of the actual quality-bar images, then explicitly authorized Graphics Session 2 can author all nine standard chassis, nine weapons, Lunar Skin and Moonbeam using this path. Keep identities, independent equipment and legacy fallback. Garage/environment rebuilds and animation/performance/release work remain the later sessions; no War Base, referral or commercial features were started.

## Exact changed files

- Runtime: `js/equipment3d.js`, `js/models3d.js`, `js/render3d.js`, `js/vendor/three.lunar.min.js`, `js/vendor/THREE-LICENSE.txt`.
- Entry/cache/showroom: `index.html`, `version.json`, `web/boot.js`, `web/scene.js`.
- Safe sample: `web/foundation-preview.html`, `web/foundation-preview.css`, `web/foundation-preview.js`.
- Assets: `js/assets/hf-v1/manifest.json`, `base-high.png`, `normal-high.png`, `orm-high.png`, `base-low.png`, `normal-low.png`, `orm-low.png` in that directory.
- Authoring source: `dev/assets/README.md`, `requirements.txt`, `three-exports.json`, `build-three.mjs`, `build-surfaces.py`.
- Tests: `dev/tests/hf-foundation.mjs`, `hf-browser.py`, `hf-app-browser.py`, `hf-failure-browser.py`, `hf-final-integration.py` in that directory.
- CI: `.github/workflows/website-check.yml`; new tests/syntax/paths, no deployment trigger changes.
- Review: this report, `evidence/hf-foundation/measurements.json` and the 27 linked PNGs.

`js/rules.js`, `js/game.js`, `js/core.js`, `js/net.js`, `js/render.js`, `js/ui.js`, `web/game.js`, Worker/server/auth and economy sources are unchanged from #16. Existing Lunar Skin +8%, Moonbeam timing/Moonfall, paid entitlements/prices, saves, two bays, accounts, progression and matchmaking remain intact. No merge or deployment occurred. Owner visual approval and physical-device/release gates are still pending.
