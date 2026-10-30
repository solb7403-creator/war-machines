# Graphics Session 3 — environments / owner visual review

**Implemented and locally tested; owner visual approval pending.** Garage, Engineer, inspection, all four existing maps and all six mode contexts use one opt-in environment layer. These changes are **not live**. No merge, deployment, public HF activation or Session 4 work occurred.

## Verified stack and integration boundary

Started clean from PR #18 `f62bd623533683b10d3d3d73fea8cd34cdc45a21`; new branch **`feature/high-fidelity-environments`**, draft PR targets **`feature/high-fidelity-equipment`**. Verified open draft/unmerged predecessors: #14 `d237fc5055afa6596239e75afbc148bc93121615`, #15 `aa558bc8b3fce35186d9f6bf2a2774ad80a517fd`, #16 `a1363d37dc6d53104542bac496b2c21b6d3a11c4`, #17 `c237ea7a1fae81f9fff917606a702d7cd97067a5`, #18 as above. Main remains `385356ea4ffac207900d05be6fbdf1965081fa63`. No successor, conflicts or unrelated #5 commits were introduced. Exact new SHA is the draft PR head and completion message.

Future integration order, **only after separate owner approval**: main → #14 → #15 → #16 → #17 → #18 → this PR; retarget and revalidate each dependent PR as predecessors land. Feature pushes/PRs run checks; the existing deployment workflows require main or explicit manual dispatch. Neither was used.

## Completed presentation scope

| Surface | Actual implementation |
|---|---|
| Garage | Shared 3D graphite/steel maintenance floor, recessed guidance, gantry, wall panels, service cabinets, stencil markings and contact grounding; restrained cyan/gold shell. |
| Engineer | Same industrial setting with service arms/workbench context, readable draft/stat/selector controls; real Telegram art preview also selects Engineer rather than generic inspection. Existing save/equip/ownership workflow preserved. |
| Inspection | Same equipment factories, model-only bounds, front/quarter/side/rear shortcuts, touch rotation/zoom, balanced lighting and whole-weapon framing. Reuses the existing earned Vault ornament builder from loadout state. |
| Moonbase / `classic` | Command-module hardware, cargo reinforcement, habitat seams, regolith and utility strips. |
| Overpass / `overpass` | Steel deck/ramps, edge markings, tunnel contrast/supports; exact original bridge geometry and occlusion. Extra deck dressing hides when driving underneath. |
| Longshot / `longshot` | Stable varied canyon strata, industrial reinforcement and central-pylon dressing within existing obstacle footprints. |
| Crater Field / `craters` | Crater bowls/rims, dust tracks, boulders and damaged landing hardware; slowdown areas and routes remain visible. |
| Arena / Moon Zone | Team-end markings; existing capture pad/ring/state colors retained, opt-in zone column made less opaque. |
| Crystal Rush / Bounty | Mine base from actual match state; restrained crystal/industrial and bounty floor markings. Existing pickups, stars and HUD retained. |
| Last Standing / Survival | Readable perimeter/staging marks, reduced opt-in storm opacity; existing safe-zone geometry, boss and warning telegraphs remain authoritative. No new animated VFX system. |

## Shared architecture, resources and safety

- New **`js/environment3d.js`** (`env-v1`) reuses Equipment3D UV/PBR materials, geometry baking and component primitives. One stage builder serves website and native art previews; one map builder reads the existing four `MAPS` layouts. No new engine, network service, shadow maps, runtime CDN or purchased assets.
- Original deterministic procedural terrain textures: HIGH base 320×512 + normal 160×256; LOW base 160×256, no normal. Original small stencil canvases; no external artwork/license dependency. **Environment texture HTTP transfer: zero.** Shared equipment atlases are unchanged.
- Decorations use private deterministic seeds, not gameplay RNG. Mode context reads existing state; collision/bridge/spawn/map IDs and camera projection are unchanged. Eight PR18 legacy map/profile position/normal/color hashes remain byte-identical when opt-in is off; exact bridge solid/tunnel position arrays also match.
- HIGH adds selective bolts, seams, wall/canyon detail and textured material response. LOW genuinely reduces geometry and shaders. Terrain cache protects active leases and keeps at most two idle entries; map thumbnails cap at four. Owned geometry, ground/sign textures and materials are disposed independently; shared equipment banks are never disposed by the environment.
- Showroom removes its event listeners on disposal; fallback cancels idle RAF. Choosing 2D now also stops website showroom WebGL; returning to 3D recreates it. A short-desktop canvas sizing/overflow defect found during review was corrected and measured at 1280×720, 1366×768 and 1440×768.
- Public HF default remains disabled. Existing account-free review route **`/web/equipment-preview.html?hf=1`** (or `&quality=low`) loads the shared environment/equipment. This is a **branch/local route, not a published preview URL**. Actual app evidence uses disposable local signed identities and fake storage, with all requests intercepted; no production accounts or writes.
- Protected files are unchanged: `js/rules.js`, `js/game.js`, `js/equipment3d.js`, `js/core.js`, `js/net.js`, `js/match.js`, `js/pvp.js`, `js/range.js`, `js/render.js`, Worker source/config. Equipment identities, geometry, sockets, Lunar +8% HP/damage, Moonbeam/Moonfall, two bays, accounts, ownership, purchases and economy remain unchanged. `js/ui.js` only adjusts opt-in preview height.

## Real engine evidence

All linked PNGs are actual shared Three.js/app renders, with existing 2D fallback where explicitly labeled. Simulated Chromium viewports, **not physical iPhone certification**. Before images use unchanged PR18 with equivalent equipment, camera and seeded trials. Some combat images combine the actual WebGL canvas and its real HUD canvas to preserve framebuffer output; no artwork or fabricated scene is substituted.

| Evidence | Links |
|---|---|
| Garage 390px | [Before](../evidence/hf-environments/before-garage-390.png) · [After](../evidence/hf-environments/after-garage-390.png) |
| Engineer 390px | [Before](../evidence/hf-environments/before-engineer-390.png) · [After](../evidence/hf-environments/after-engineer-390.png) |
| All four maps, before → after | [Moonbase before](../evidence/hf-environments/before-classic-arena-390.png) / [Arena after](../evidence/hf-environments/after-classic-arena-390.png) · [Overpass before](../evidence/hf-environments/before-overpass-zone-390.png) / [Moon Zone after](../evidence/hf-environments/after-overpass-zone-390.png) · [Longshot before](../evidence/hf-environments/before-longshot-crystal-390.png) / [Crystal Rush after](../evidence/hf-environments/after-longshot-crystal-390.png) · [Crater Field before](../evidence/hf-environments/before-craters-bounty-390.png) / [Bounty after](../evidence/hf-environments/after-craters-bounty-390.png) |
| Remaining real modes | [Last Standing](../evidence/hf-environments/after-classic-royale-390.png) · [Survival warning/boss](../evidence/hf-environments/after-craters-boss-390.png) |
| Full Moonbeam inspection | [Front](../evidence/hf-environments/inspection-front-390.png) · [Quarter](../evidence/hf-environments/inspection-quarter-390.png) · [Side](../evidence/hf-environments/inspection-side-390.png) · [Rear](../evidence/hf-environments/inspection-rear-390.png) |
| Mobile and desktop | [320px Engineer](../evidence/hf-environments/final-engineer-320.png) · [430px Engineer](../evidence/hf-environments/final-engineer-430.png) · [Desktop Garage](../evidence/hf-environments/garage-desktop.png) · [Desktop Engineer](../evidence/hf-environments/engineer-desktop.png) · [1280×720 fixed layout](../evidence/hf-environments/garage-short-desktop.png) |
| Quality/fallback | [LOW Engineer](../evidence/hf-environments/engineer-low-390.png) · [2D](../evidence/hf-environments/after-2d-390.png) · [No WebGL](../evidence/hf-environments/no-webgl-engineer-390.png) · [Busy HIGH](../evidence/hf-environments/busy-high-390.png) / [LOW](../evidence/hf-environments/busy-low-390.png) |
| Native Mini App and ornament | [Telegram Garage](../evidence/hf-environments/telegram-garage-390.png) · [Telegram Engineer](../evidence/hf-environments/telegram-engineer-390.png) · [Vault render-only copy](../evidence/hf-environments/inspection-vault-render-fixture.png) — no entitlement granted |

## Tests actually run

| Check | Result |
|---|---|
| `node dev/tests/environment.mjs` | PASS: 4 maps × HIGH/LOW, 3 stage kinds, valid UV/finite geometry, six mode contexts, authoritative RNG trap, exact layouts/bridge, eight default map hashes, idempotent disposal and LOW reductions. |
| Existing `hf-foundation.mjs`, `hf-collection.mjs`, `defender-visual.mjs`, `legendary-visual.mjs` | PASS once: 81 standard + 99 legendary pairings per quality, nine adaptive skins/one Moonbeam, sockets/tips, 72 paint/team/core and 243 fitting cases, 432 legacy kit byte-parity cases, atlas checksums/leases. |
| `lab-ui.mjs`, `web-login.mjs` | PASS. |
| `wtest/test.mjs`, `pvp.mjs`, `farm.mjs` | PASS **189/189**, **106/106**, **49/49**. |
| `wtest/lab.mjs`, `lab-battle.mjs`, `lab-parity.mjs`, `range.mjs`, `range-comparison.mjs` | PASS migration/ownership/revision/frozen-proof/counterpick contracts; six-mode stock parity; **12 completed seeded range simulations**. |
| Real local `worker/smoke-runtime.mjs` via Wrangler 4 | PASS actual workerd/SQLite/DO/WebSockets: match/VS/movement, 15 snapshots/s, signed identity, replay/logout/shared account and fail-closed storage outage. Fake Firebase only. Existing generated-sim duplicate `GEM` warning remains; no Worker change. |
| `environment-browser.py` before/after | PASS actual Garage/Engineer, all four maps and six seeded mode segments; exact equal results, objective positions/radii/ownership and warnings; unchanged bays/economy, zero ranked/payment mutation requests or page errors. These are 10-second segments (Survival stops on first warning), **not six completed human matches**. |
| `environment-integration.py` | PASS **36 framing assertions** (3 representative large/small builds × 4 angles × 320/390/430); desktop, Vault anchor, 24 context switches, 16 map/profile renders, HIGH/LOW parity, HUD projection, quality/context recovery and no-WebGL. Successful framing cases reused rather than repeated after test-clock correction. Final desktop-only check supersedes the earlier intermediate `shortDesktop` field in raw integration JSON. |
| `environment-telegram.py` | PASS actual `index.html`, signed synthetic Mini App identity at intercepted intended Pages origin, shared Engineer workbench (19 draws / 29,810 triangles), no GL error/overflow or bay/economy mutations. No physical Telegram account used. |
| Existing `hf-failure-browser.py` | PASS missing/corrupt/version assets fall back and retry; context-loss fallback/fresh-context recovery, persisted lifecycle; no-WebGL requests zero HF atlas maps. |

Browser commands: `python dev/tests/environment-browser.py` (baseline additionally `--baseline` on PR18), `python dev/tests/environment-integration.py` (final correction resume `--resume-combat`, desktop-only `--desktop-only`), `python dev/tests/environment-telegram.py`. Local fake fixture: `LUNAR_STANDARD_VISUAL_FIXTURE=1 LUNAR_LEGEND_VISUAL_FIXTURE=1 LUNAR_FIXTURE_PORT=8797 node dev/tests/webserver.mjs`, after `node worker/build-web.mjs`. Playwright, `/usr/bin/chromium` and Pillow are test prerequisites only. Routes assert isolation; no production fallback.

## Objective costs and retention

Chromium **154.0.8037.57**, Linux/headless SwiftShader, simulated viewports. Warm samples are 40 explicit renders with `gl.finish()`, not live physical-device FPS. Cold includes construction/upload/driver work; software first-use costs remain substantial.

| Equivalent HIGH scene | PR18 triangles / draws | Session 3 triangles / draws |
|---|---:|---:|
| Vanguard + Moonbeam showroom | 28,758 / 21 | 29,812 / 19 |
| Arena / Moonbase | 45,734 / 44 | 49,192 / 47 |
| Moon Zone / Overpass | 75,518 / 86 | 77,656 / 93 |
| Crystal Rush / Longshot | 76,826 / 87 | 83,076 / 90 |
| Bounty / Crater Field | 74,902 / 76 | 75,968 / 81 |
| Last Standing / Moonbase | 106,542 / 106 | 110,024 / 109 |
| Survival / Crater Field | 46,362 / 59 | 47,404 / 63 |

- Showroom warm mean/worst: PR18 **0.528/2.40ms**, new **0.495/2.90ms**. Six map/mode captures: before cold **1,769–2,292ms**, after **881–1,794ms**; warm mean before **1.06–3.25ms**, after **1.02–4.24ms**, worst after **37.7ms**. Timing varies with software renderer/caches; no universal speedup claim.
- Separate fixed busy six-pilot trial: HIGH **110,024 triangles / 109 draws**, cold **1,742.5ms**, warm mean/worst **2.82/35.0ms**; LOW **41,480 / 107**, cold **661.9ms**, warm **2.17/29.3ms**. HIGH and LOW produced identical 10-second damage/objective results. Camera/HUD projection error ≤ **5.69e−13 CSS px**. Fewer triangles/shader work, not a claim of dramatically fewer actor draws.
- Environment-only baked map vertices HIGH → LOW: Moonbase **18,840→9,084**, Overpass **6,924→4,404**, Longshot **28,968→9,048**, Crater Field **7,932→3,432**. Garage/inspection **7,092→4,212**; Engineer **8,316→5,052**. Largest environment map position/normal/color/UV/UV1/tangent buffers are roughly **1.97MB** (17 float components/vertex), separate from equipment.
- Two rounds of stage switches both retained **25 GPU geometries / 8 textures**; equipment cache **12,390,960 bytes**, transient peak **19,020,960**. Two rounds of map/profile switching both retained **113 / 11**, four thumbnails; after clearing thumbnails, two idle LOW terrain entries, **zero refs**, **327,680 image-source bytes**. **Zero shared equipment material disposals.** These are renderer counts/typed-buffer or image-source bytes, not measured total VRAM.
- Terrain source image footprint per active map/profile: HIGH **819,200 bytes**, LOW **163,840** (GPU mipmaps/driver overhead excluded). New JS+CSS **25,793 raw / 9,979 gzip bytes**. No added binary model/texture download; 31 committed evidence PNGs are review-only and outside the public asset allowlist.

Raw measurements: [before](../evidence/hf-environments/measurements/before.json), [after](../evidence/hf-environments/measurements/after.json), [geometry](../evidence/hf-environments/measurements/geometry.json), [resource/quality checks](../evidence/hf-environments/measurements/integration.json), [final desktop correction](../evidence/hf-environments/measurements/desktop-clip.json), [Telegram](../evidence/hf-environments/measurements/telegram.json), [asset faults](../evidence/hf-environments/measurements/asset-failure.json), [source sizes](../evidence/hf-environments/measurements/source-size.json).

## Changed files and remaining limits

Runtime: new `js/environment3d.js`, `css/environment.css`; scoped integration in `js/models3d.js`, `js/render3d.js`, `js/ui.js`, `web/scene.js`, `web/game.js`; load/style/version references in `index.html`, `web/play.html`, `web/boot.js`, `web/equipment-preview.html`, `web/foundation-preview.html`, `version.json`. Tests: four new `dev/tests/environment*` harnesses, PR18 map hash fixture; website CI adds syntax/unit coverage. This review and `evidence/hf-environments/` contain evidence, not runtime assets.

**Unverified:** physical iPhone/Android, real Safari/Telegram hardware power/FPS, live multiplayer service and production account flows. Local workerd and signed synthetic web/Mini App tests passed; that is not live certification. 2D retains its existing simpler art. These remain stylized procedural materials/geometry, not photographic environments. Cold software-renderer startup spikes merit real-device profiling before any activation; no Session 4 VFX/optimization expansion was attempted.

Owner review is required for industrial stage composition, map clarity, lighting and phone-scale presentation. There is no external credential blocker. **Awaiting owner visual approval — no merge, deployment or public activation.**
