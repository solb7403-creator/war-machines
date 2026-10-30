# Graphics Session 2 — complete equipment collection / owner review

**Coverage implemented and locally verified; visual acceptance pending.** All 18 standard appearances, nine adaptive Lunar Skin hulls and one unified Moonbeam now have real authored HIGH/LOW geometry through the existing UV/PBR pipeline. This is a staged opt-in branch, **not the deployed game**. No merge, activation, deployment or Graphics Session 3 work occurred. The owner can review all linked images on an iPhone; no commands or asset uploads are required.

## Stack and scope

Started clean at verified PR #17 `c237ea7a1fae81f9fff917606a702d7cd97067a5`; new branch **`feature/high-fidelity-equipment`**, draft PR targets `feature/high-fidelity-foundation`. Main remains `385356ea4ffac207900d05be6fbdf1965081fa63`. #14 `d237fc5`, #15 `aa558bc`, #16 `a1363d3`, #17 `c237ea7` remained open draft/unmerged. No successor or conflicting work was found; no rebases/merges were needed. Unrelated #5 is excluded. The exact new commit is recorded in this PR's head and completion message.

Eventual integration, only with separate owner approval: main → #14 → #15 → #16 → #17 → this PR, retargeting/revalidating each after predecessors merge. This task grants no release approval.

## Per-item status and actual visual work

Every entry below has a genuine HIGH and reduced LOW implementation; no intended opted-in variant silently delegates to a legacy model. Existing stock/legacy `-1` encodings normalize only in the visual layer.

| Existing family | T0 | T1 | T2 |
|---|---|---|---|
| Scout | Complete: compact dart, exposed light tracks/sensors | Complete: split shoulder armor, strengthened fenders | Complete: four compact outriggers, protected sensor wings |
| Vanguard | Complete: Defender wedge, layered glacis, seven-wheel drive | Complete: swept side armor, six-wheel suspension | Complete: stepped citadel deck and cooling shoulders |
| Titan | Complete: broad heavy shoulders and tracks | Complete: ram glacis, reinforcement blocks | Complete: four heavy pods, deck bridges and rear cooling banks |
| Pulse Cannon | Complete: segmented single cannon, paired power cells | Complete: radial capacitor bank and power jackets | Complete: rail accelerator cage and captive coil |
| Twin Repeater | Complete: two separate barrels, linked feed receiver | Complete: twin drums, reinforced cooling hardware | Complete: armored feed cartridges, captive rotating barrel hardware |
| Siege Breaker | Complete: heavy bore, trunnions and breech | Complete: long recoil assemblies and armored braces | Complete: two canonical heavy muzzles, split brake/rear housing |
| Lunar Skin | All three T0 hulls complete | All three T1 hulls complete | All three T2 hulls complete |
| Moonbeam | **One shared existing legendary identity**, independent of chassis, tier and skin; silver/gold connected breech, conduits, exposed longitudinal blue core/charging winding, supported coils, bevelled attached crescents, deep concentric emitter. No permanent beam/pedestal/triple barrels. | — | — |

Lunar adapts class proportions in graphite/dark steel and gold: overlapping sloped armor, flush side/hood crescents, protected dark treads and gold mechanical inlays. It does not become a separate chassis or hover skin. Standard paints, team markers, three canonical core positions, fittings and the earned Vault ornament remain independent. Existing turret heights and every standard/legendary muzzle endpoint are preserved exactly.

## Architecture and assets

- `js/equipment3d.js` extends the shared builder registry, class profiles and reusable track pods, tread shoes, wheels/suspension, bevelled panels, sloping armor, vents, bolts, conduits, receivers, recoil housings, coils and emitters. Canonical `M3.CHASSIS_VISUALS` / `WEAPON_VISUALS` provide dimensions/sockets. Geometry varies by class/tier/archetype; it is not 18 copies of one tank or a recolor/conversion of old standard meshes.
- All models still use M3 → Equipment3D → existing showroom/menu/combat renderers, UV/UV1/tangents and shared PBR materials. No second engine, GLB claim, new renderer or runtime dependency. Scalar tangent construction avoids per-vertex Vector3 allocation. Zero-area extruded arc seam faces are removed before shading; valid unit normals/tangents are asserted.
- Original deterministic 512px HIGH / 128px LOW atlas v`hf-v2.0`: brushed gold/steel, graphite scuffing, sparse machining scratches, rubber reinforcement, base/normal/ORM. Six PNGs total **303,502 bytes**, versus PR17's 602,407. Same compatible directory, explicit manifest/hash/version keys. Source/provenance: `dev/assets/build-surfaces.py`; no purchased/external art.
- HIGH uses the existing PBR environment/normal/ORM path. LOW reduces shoes, wheels/bolts, coils/animations and crescent subdivisions/bevels, uses simpler shaders. Existing 2D remains deliberately simplified. No new shadow maps/bloom/VFX system. Mesh leases, shared banks, LRU and failure fallback remain in use.
- Public default remains disabled. Account-free full inspection: **`/web/equipment-preview.html?hf=1`**, optional `&quality=low`, `&sheet=chassis|weapons|lunar|pairs`. Representative independent equipment inspector: `/web/foundation-preview.html`. These are **local/review paths, not live URLs**. Instructions are for maintainers; the owner receives ready screenshots.

## Actual engine evidence

All images are actual shared Three.js/application renders. Contact sheets copy actual canvases from one renderer; no concepts or marketing artwork were used as evidence. Matched PR17 comparisons use its pinned source/maps with the same camera, exposure, lighting and scale. Final refreshed views include the canonical cores and optimized LOW crescents.

| Evidence | Links |
|---|---|
| Complete standardized collections | [9 chassis](../evidence/hf-collection/chassis-3x3.png) · [9 weapons](../evidence/hf-collection/weapons-3x3.png) · [9 Lunar adaptations](../evidence/hf-collection/lunar-3x3.png) · [representative pairings](../evidence/hf-collection/pairs-3x3.png) |
| Matched mobile hero | [PR17](../evidence/hf-collection/pr17-hero-quarter-390.png) / [collection](../evidence/hf-collection/collection-hero-quarter-390.png) |
| Matched ordinary equipment | [PR17 stock/Pulse](../evidence/hf-collection/pr17-default-pulse-390.png) / [new stock/Pulse](../evidence/hf-collection/collection-default-pulse-390.png) |
| Lunar angles | [front](../evidence/hf-collection/collection-hero-front-390.png) · [side](../evidence/hf-collection/collection-hero-side-390.png) · [rear](../evidence/hf-collection/collection-hero-rear-390.png) |
| One Moonbeam, close inspection | [side](../evidence/hf-collection/collection-moonbeam-side.png) · [quarter](../evidence/hf-collection/collection-moonbeam-quarter.png) · [emitter](../evidence/hf-collection/collection-moonbeam-emitter.png) |
| Independent combinations | [Lunar/Pulse](../evidence/hf-collection/collection-lunar-pulse-390.png) · [stock/Moonbeam](../evidence/hf-collection/collection-default-moon-390.png) · [both](../evidence/hf-collection/collection-lunar-moon-390.png) |
| Actual Engineer | [320px](../evidence/hf-collection/final-engineer-320.png) · [390px](../evidence/hf-collection/final-engineer-390.png) · [430px](../evidence/hf-collection/final-engineer-430.png) |
| Existing functional surfaces | [Garage](../evidence/hf-collection/final-garage-430.png) · [premium Shop cards](../evidence/hf-collection/shop-premium-cards.png) · [menu renderer, cores/fittings/Vault](../evidence/hf-collection/upgraded-renderer-detail.png) |
| Real practice / quality | [Arena](../evidence/hf-collection/upgraded-battle-arena-390.png) · [six-pilot HIGH](../evidence/hf-collection/final-high-busy-combat-390.png) · [six-pilot LOW](../evidence/hf-collection/final-low-busy-combat-390.png) · [LOW inspection](../evidence/hf-collection/collection-low-390.png) · [2D](../evidence/hf-collection/collection-2d-390.png) |

The menu detail intentionally retains the pre-existing gold Vault tooth; it is not a new Lunar ornament. Combat captures extract live 3D/HUD canvases to avoid software-compositor stalls; UI controls are also shown in separate app captures. [Structured results and measurements](../evidence/hf-collection/measurements.json) contain the selected evidence list and exact environment.

## Verification actually run

| Check | Result |
|---|---|
| New `hf-collection.mjs` | **PASS:** 9+9 HIGH/LOW, 9 skins, one shared Moonbeam; **81 standard + 99 legendary pairings per quality**; distinct geometry, finite/unit normals, orthogonal tangents, atlas UVs, exact tips/sockets, two physical headlight anchors, bounded mesh/leases, 72 paint/team/core and 243 fitting contexts, unchanged loadout/stats |
| Existing foundation / standard / legends | **PASS:** `hf-foundation.mjs`, `defender-visual.mjs`, `legendary-visual.mjs`: preserved default geometry, 432 legacy byte-parity cases, existing +8% skin behavior; no weakened tests |
| Economy / PvP / farm | **PASS:** **189/189 / 106/106 / 49/49**, isolated services; run once after integrated implementation |
| Garage / frozen snapshots / mode parity / range | **PASS:** `lab.mjs`, `lab-battle.mjs`, `lab-parity.mjs`, `range.mjs`, `range-comparison.mjs`; 12 completed seeded range simulations and all six stock reward/proof contracts |
| Real Worker runtime | **PASS:** local workerd/SQLite/DO/WebSockets, join/fight ~14 snapshots/s, signed fake identity, session replay/logout and fail-closed outage; no production fallback. Existing generated-sim duplicate `GEM` warning persists, no Worker change |
| Shared showroom/browser | **PASS:** actual 4×9 sheets, independent/combined legends, matched PR17 renders, desktop and 320/390/430px; 54 model switches, stable retained resources |
| Actual app | **PASS:** three-width Engineer, distinct class drafts, Garage/Shop/2D, 72 menu builds, all six real practice modes, unchanged two bays/economy and zero ranked/payment mutations. Six **10-second engine segments**, not claims of completed human matches; still-valid PR17 seeded baseline reused, equal outcomes |
| Final integration | **PASS:** refreshed Engineer/Garage, Vault/core/fitting menu, current HIGH/LOW six-pilot real simulation/rendering, no GL errors or mutations |
| Faults / lifecycle | **PASS:** missing/corrupt/version maps fall back and retry; no-WebGL requests zero maps; context-loss fallback/fresh context recreation and simulated persisted page lifecycle |
| UI feedback / build / scope | **PASS:** quality-label defect reproduced then fixed; Lunar sheet selection stays Lunar; JS syntax/Python compile, `lab-ui.mjs`, `web-login.mjs`, Worker asset packaging, protected-source diff and whitespace checks |
| Physical iPhone/Safari/Telegram hardware, actual driver VRAM, live accounts/purchases | **NOT RUN:** unavailable/not used. These are emulated/local tests, not device FPS or live production proof |

A focused independent code review found no blocking issue. Its quality-status finding was fixed and regression-tested. Deployment workflows are main-only/manual; this feature push/PR cannot deploy. CI runs are reported separately in the PR/checks after push, not inferred from local results.

## Measured cost and limits

Chromium/ANGLE SwiftShader software rendering, local assets, simulated viewports. Warm samples fence GL and exclude construction; cold work is separate. Counts are objective; small frame-time differences are not a phone speedup claim.

| Representative workload | PR17 | This collection |
|---|---:|---:|
| HIGH inspection, triangles / draws | 26,598 / 21 | **28,758 / 21** (~8% triangles increase) |
| LOW inspection, triangles / draws | 9,742 / 19 | **10,162 / 19** (~4% increase after simplifying LOW crescents) |
| Six-pilot active-effects HIGH, triangles / draws | 122,610 / 139 | **111,150 / 134** |
| Final six-pilot steady HIGH / LOW | prior LOW 43,506 / 109 | **106,542 / 106** HIGH; **41,346 / 104** LOW |

Active-effects and final steady frames differ in transient effects and are labeled separately. Final HIGH warm mean/p95/worst **1.93 / 4.60 / 14.60 ms**, LOW **1.81 / 8.40 / 22.00 ms** (60 samples each). LOW has fewer triangles; timing outliers do not establish universally faster frames. **Cold first HIGH game draw ~2.70 s; LOW transition ~180 ms** in software. Physical-device profiling/loading warmup remains necessary before activation; this is not a rollout-readiness claim.

Largest authored HIGH hull **50,196 vertices**, LOW **17,940**; max HIGH weapon **40,116**, LOW **11,256**. Per-asset caps remain 65K/23K. Atlas RGBA storage estimate ~3 MiB HIGH + 192 KiB LOW before mipmaps/environment/driver overhead; actual driver VRAM is not exposed. Typed-buffer bytes are measured. Geometry idle target remains 14 MiB with active/pending-pair protection. Gallery churn ended **47 GPU geometries / 7 textures / 13,592,112 cached bytes**, identical in both rounds; observed transient peak ~17.3 MB. App art churn ended **78 geometries / 6 textures / 13,680,240 bytes** in both rounds; peak ~20.1 MB. These peaks include protected working assets, not an unlimited cache.

Pipeline JS grows **19,811 → 37,792 raw bytes**, **7,901 → 14,074 gzip**; the vendored Three build is unchanged. Maps transfer halves; no CDN/new service/asset download subscription. Broader geometry detail was kept bounded instead of multiplying maximum-detail copies for every item.

## Exact changes / remaining owner review

Runtime: `js/equipment3d.js`; original atlases/manifest in `js/assets/hf-v1/`; deterministic source/authoring guide in `dev/assets/`. Preview: `web/equipment-preview.{html,js}`, `web/foundation-preview.html`. Branch-only cache: `index.html`, `version.json` (`20261030-hf2`). Tests: new `dev/tests/hf-collection.mjs`, `hf-collection-{browser,app,integration,final-views}.py`; existing app assertion now reads the actual catalog version. CI adds the new coverage contract to `.github/workflows/website-check.yml`. This report and 28 selected engine PNGs/measurements are excluded from product packaging.

**Unchanged from #17:** `js/rules.js`, simulation/game/core/network/UI/account code, `js/render.js`, `web/game.js`, all Worker source/configuration, IDs, prices/paid entitlements, ownership, bays, rewards, +8% Lunar bonuses, Moonbeam timing/Moonfall, referrals and economy. Original M3 public interfaces/renderers stay intact; no inventory grants or saved settings were needed for evidence.

**Honest visual limits:** this is a complete procedural real-time collection, not photographic reconstruction. Broad armor faces and machined surface wear remain stylized; tiny detail is deliberately limited, LOW/2D simplify further, and the current showroom/environment was not rebuilt. Original PNGs were not re-uploaded in this brief; textual approved identity plus PR16/17 evidence guided the work, not a claim of pixel matching. Owner review must judge the actual silhouette/tier differences and whether the material/detail improvement meets the desired quality. Physical-device performance/loading is also unverified. No item is missing, but visual acceptance is not presumed from tests. No extra owner setup or development is required; review the PR images on iPhone. **NO MERGE / NO DEPLOY / NO PUBLIC HF DEFAULT / NO SESSION 3.**
