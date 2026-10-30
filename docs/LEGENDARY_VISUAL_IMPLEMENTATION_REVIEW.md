# Final legendary visuals — owner review

Implemented through the actual shared renderer. **No merge, deployment, production account operation, purchase or activation.** Both final attachments were inspected directly: graphite/gold tracked Lunar Skin and the unified silver/gold blue-core cannon. The older mounted-weapon poster was not treated as a competing design.

## Source and dependency

Fresh GitHub state confirmed both predecessor PRs still open and draft:

- main: `385356ea4ffac207900d05be6fbdf1965081fa63`
- #14 `feature/defender-mobile-art`: `d237fc5055afa6596239e75afbc148bc93121615`
- #15 `feature/standard-equipment-visuals`: `aa558bc8b3fce35186d9f6bf2a2774ad80a517fd`
- New branch `feature/final-legendary-visuals`, based directly on #15's exact SHA. The implementation commit contains this report; its full SHA is in the draft PR head and completion response.

Stack: **main → #14 → #15 → this draft PR**. Neither predecessor was overwritten, rebased, marked ready or merged. Unrelated #5 was not included. Production workflows require main or explicit dispatch; this feature push does not deploy.

## Implemented assets

**Lunar Skin** retains `skin='lunar'`. All nine class/tier tracked architectures receive graphite/charcoal finish, dark exposed wheels/treads, warm metal bushings/inlays, framed side crescents, hood crest, stepped side hardware and layered wedge visor. Class proportions, tier geometry, turret/core sockets, fittings and team lights remain distinct. Pearl armor, hover/orbit decoration, giant fins and floating moon were removed from the active skin path. Pulse/Twin/Siege remain their own modular weapons when mounted on the skin, with matching finish.

**Moonbeam** retains `arch='moon'`. One shared model is used on every class/tier, with or without skin: dark rotary cradle; layered silver breech; gold conduits; continuous exposed blue longitudinal core and electrical highlights; open rails; three charged annular coil assemblies; attached gold crescent guards; large concentric blue-white emitter; two captive rotating collars. No display pedestal or perpetual firing beam is introduced. The single **visual** muzzle is `[2.35, .63, 0]`; projectile/firing/super code is untouched. The obsolete three-crystal/orbiting-moon identity is no longer selected.

The existing M3 factory signatures and lit/shine/glow batching remain intact. `lunarChassis`, `insetCrescent`, `energySleeve`, `unifiedMoonbeam` are in `js/models3d.js`; skin chassis reuse the standard builders. Fittings follow class/tier decks and avoid the exposed core. Cache keys distinguish these class-dependent fittings. Showroom legends use grounded lighting, larger inspection scale and computed framing; combat camera is unchanged. The simplified 2D path now conveys dark/gold armor and the single blue-core cannon.

Paint selection/ownership data are unchanged. As before, the equipped skin overrides paint appearance, while the stored choice remains intact. Team and core colors remain visible. The public visual sample never saves, grants or equips anything.

## Actual engine screenshots

No generated illustrations, edited images or concept-art screenshots are presented as implementation evidence. These are actual shared Three.js/application frames, captured with Chromium/SwiftShader and simulated viewports, **not a physical iPhone**.

| Evidence | Files |
|---|---|
| Skin front / side / rear / quarter | [front](../evidence/legendary-visuals/lunar-front.png), [side](../evidence/legendary-visuals/lunar-side.png), [rear](../evidence/legendary-visuals/lunar-rear.png), [quarter](../evidence/legendary-visuals/lunar-three-quarter.png) |
| Unified cannon | [side](../evidence/legendary-visuals/moonbeam-side.png), [quarter](../evidence/legendary-visuals/moonbeam-three-quarter.png), [emitter](../evidence/legendary-visuals/moonbeam-emitter.png) |
| Independent / combined | [skin + standard](../evidence/legendary-visuals/lunar-with-standard-weapon.png), [Moonbeam + stock](../evidence/legendary-visuals/moonbeam-on-standard-chassis.png), [both](../evidence/legendary-visuals/lunar-plus-moonbeam.png) |
| Nine skin chassis / Moonbeam mounts | [3×3 skin sheet](../evidence/legendary-visuals/lunar-9-chassis.png), [3×3 mount sheet](../evidence/legendary-visuals/moonbeam-9-mounts.png) |
| Actual Engineer | [320px](../evidence/legendary-visuals/engineer-lunar-moonbeam-320.png), [390px](../evidence/legendary-visuals/engineer-lunar-moonbeam-390.png), [430px](../evidence/legendary-visuals/engineer-lunar-moonbeam-430.png) |
| Actual Garage | [skin](../evidence/legendary-visuals/garage-lunar-390.png), [Moonbeam without skin](../evidence/legendary-visuals/garage-moonbeam-no-skin-390.png) |
| Existing premium cards | [Shop cards](../evidence/legendary-visuals/shop-premium-cards.png) |
| Practice combat | [mounted before contact](../evidence/legendary-visuals/practice-mounted-390.png), [first player Moonbeam projectile](../evidence/legendary-visuals/practice-first-moonbeam-shot-390.png), [Survival](../evidence/legendary-visuals/practice-moonbeam-boss-390.png) |
| Desktop / fallback | [1440px](../evidence/legendary-visuals/lunar-moonbeam-desktop.png), [2D art](../evidence/legendary-visuals/lunar-moonbeam-2d.png), [no-WebGL Garage](../evidence/legendary-visuals/garage-no-webgl-320.png) |
| Actual PR15 baseline | [old skin](../evidence/legendary-visuals/before-lunar-three-quarter.png), [old Moonbeam](../evidence/legendary-visuals/before-moonbeam-side.png) |

26 selected PNGs total ~4.9 MB. `evidence/` is outside the production asset allowlist. Full local logs/JSON and extra angles are in `/workspace/legendary-evidence/`, not committed. Contact sheets assert distinct pixel samples and geometry coverage and include all rows.

For account-free inspection, serve this branch locally and open `/web/equipment-preview.html`; select the two legends independently and use view/zoom controls. This page imports no account/economy code and performs no fetch, save, grant or equip operation. **It is not deployed.**

## Tests actually run

| Check | Status | Actual coverage |
|---|---|---|
| Standard 81 pairings | PASS | `node dev/tests/defender-visual.mjs`: 9+9 models, 81 pairings, 243 fitting sets, 72 paint/team/core sets, legacy stock parity |
| PR15 standard preservation | PASS | 432 byte-hash comparisons of positions, normals, colors, metadata and animations over all existing paints; snapshot captured from #15 before edits |
| Skin / legend mounts | PASS | `legendary-visual.mjs`: 9 grounded skin chassis, unchanged socket heights, 99 combinations (81 skin/standard + 9 combined + 9 plain/Moonbeam), finite/bounded meshes/normals, correct single emitter and two captive animations |
| Gameplay / buffs | PASS | Existing +8% HP/damage asserted. Protected rules/game/core/net/Worker source diff against #15 is empty |
| Balance characterization | PASS | `gear-balance.mjs`; `gear-combat.mjs`: 596 paired duels, 180 six-mode practice trials, 19 legal fitting sets, 3,420 client/server parity cases. No rebalance performed |
| Economy / ownership / purchases | PASS (isolated) | `wtest/test.mjs` 189/189; `pvp.mjs` 106/106; `farm.mjs` 49/49; `lab.mjs`, `lab-battle.mjs`, `lab-parity.mjs` passed |
| Range isolation / lifecycle | PASS | `wtest/range.mjs`: 12 completed seeded trials across six modes; `range-comparison.mjs` passed |
| Actual app integration | PASS (local) | `python dev/tests/legendary-app.py`: owned unsaved drafts; all 3 standard families with skin; Moonbeam alone/together; Shop canvases; six actual 10-second practice segments; no ranked/payment mutation; unchanged economy and two bays |
| Showroom / mobile / desktop | PASS | `python dev/tests/legendary-browser.py`: angles, contact sheets, 320/390/430/1440px, projected bounds, pointer rotation, no account calls |
| 2D / missing WebGL | PASS (local) | Actual game fallback captured; no page errors. Fidelity remains simplified |
| Caches / GL | PASS (software) | 45 showroom switches and 300 actor builds; bounded counts, GL error 0; measurements below |
| Workers runtime | PASS | From worker/: `npm_config_cache=/tmp/lunar-defender-npm WRANGLER_SEND_METRICS=false npx -y --package=wrangler@4 -c 'node smoke-runtime.mjs'`: real workerd/DO/SQLite/WebSockets, join/VS/fight/snapshots, session/replay/logout and account-read outage rejection |
| Other focused checks | PASS | Touched JS syntax, `lab-ui.mjs`, `web-login.mjs`, `worker/build-web.mjs`, Python compile, `git diff --check` |
| Physical iPhone / Safari / live Telegram | NOT RUN | No hardware or real account used. Shared Telegram renderer was verified locally; no live/device-FPS claim |
| Real payments / production release | NOT RUN | Explicitly forbidden; not attempted |

Test corrections: the initial new model test failed on the obsolete hover skin as intended. Zero-area primitive normals are tolerated consistently with the existing suite. The app comparison initially detected the existing Shop lazily creating an empty pass object; the test now calls the same existing `passState()` before its baseline, with no product change. The initial runtime command could not write npm's default cache; using the existing writable task cache fixed that infrastructure issue. No backend fix or weakened economy check was required.

## Measured rendering cost

Non-indexed vertices, including three equipped core gems:

| Class | Lunar T0 | Lunar T1 | Lunar T2 |
|---|---:|---:|---:|
| Scout | 16,866 | 17,526 | 27,402 |
| Vanguard | 29,856 | 20,136 | 21,480 |
| Titan | 20,244 | 20,724 | 28,536 |

Moonbeam: **27,684 vertices / 9,228 triangles**, seven draws including two animated collars. Skin static geometry: three draws, no orbit animation. Test caps remain <30,000 skin / <28,000 weapon vertices.

Combined Vanguard showroom: **19 total draws / 20,888 triangles**, including stage; prior PR15 legend scene: 22 / 5,212. Added detail has a real geometry cost even though animated draw count fell. 45 switches retained 16 GPU geometries (initial/end/peak 16). Two 150-build actor-cache rounds ended at **64 kits, 49 fitting entries, 345 GPU geometries** each; GL error 0.

Sampled practice frames (draws / triangles): Arena 42 / 31,684; Moon Zone 75 / 54,752; Crystal Rush 78 / 54,384; Bounty 88 / 58,056; Last Standing 89 / 77,408; Survival 53 / 32,680. These include map, other actors and effects, not worst-case device guarantees.

Final software construction+draw timing mean ~30.7 ms, peak ~70.9 ms, including rebuild/compilation. **Not steady-frame time or physical-device FPS.** Prior baseline mean ~25.3 ms used a different mixed switching sample, so no precise comparative percentage is claimed. `models3d.js` grew from 65,059 / 21,922 gzip bytes to ~70.8 KB / 23.8 KB gzip. No external assets, dependencies, licenses, telemetry or recurring costs were added.

## Changed files and purpose

- `js/models3d.js`: final shared legendary kits, palette, crescents, coil/emitter, fitting placement; reuse standard architecture.
- `js/render3d.js`: class-dependent fitting cache keys and actual team indicators through existing effect/preview paths.
- `js/render.js`: matching simplified 2D skin/cannon and skin-aware visual callers; no simulation edits.
- `js/ui.js`: pass existing skin identity to 2D premium-card fallback only; purchase logic/text untouched.
- `web/scene.js`: grounded legend lighting, framing/scale; combat camera untouched.
- `web/game.js`: accurate graphite/gold equipped-skin label.
- `web/{defender-preview,equipment-preview}.{html,js}`: accurate samples/cache version; no grants/saves.
- `index.html`, `version.json`: prepared `20261030-legends1` cache version, not live activation.
- `dev/tests/legendary-{visual.mjs,browser.py,app.py}`: geometry, renderer and disposable integration coverage.
- `dev/tests/defender-isolation.mjs`, `fixtures/standard-pr15-geometry.json`: protect PR15 standards instead of requiring the now-authorized legends to remain obsolete. Historical fixture retained.
- `dev/tests/webserver.mjs`: opt-in test-only initial pre-owned synthetic accounts, never packaged in Worker assets.
- `.github/workflows/website-check.yml`: new legend test/syntax/paths in existing PR validation; no deployment trigger changes.
- This report and `evidence/legendary-visuals/*.png`: owner review material.

## Acceptance and remaining limits

Implementation/integration and requested evidence categories are complete; **owner approval is pending**. Existing Moonbeam timing/Moonfall, skin +8%, stats, economy, prices, accounts, identity, ownership, two bays, progression and Worker authority remain unchanged. No War Base or later feature session was started.

These are procedural game assets, not a photorealistic reproduction. The references have denser small hardware/engraving, weathering, roughness variation, reflections, bloom and cinematic lighting absent from this vertex-color/Phong pass. Fine ornament and electrical filaments are simplified; battle camera distance intentionally loses inspection detail. Owner review must judge silhouette, graphite/gold balance, crescents, core and emitter before any merge. Physical iPhone/Safari review and production release validation remain unperformed.

AWAITING OWNER VISUAL APPROVAL — NO MERGE OR DEPLOYMENT.
