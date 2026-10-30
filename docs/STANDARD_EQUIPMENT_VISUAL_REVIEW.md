# Complete standard equipment collection — owner visual review

All **9 standard chassis + 9 standard weapons** are implemented in the existing shared Three.js model layer. All **81 standard pairings** pass geometry contracts. This is a procedural industrial collection, **not** a photographic material/texture pass. **No merge, deployment, release, real account mutation or legendary redesign was performed.**

## Source-control dependency

Production main was refreshed at `385356ea4ffac207900d05be6fbdf1965081fa63`. PR **#14** remained unmerged/draft at `d237fc5055afa6596239e75afbc148bc93121615`. New branch **`feature/standard-equipment-visuals`** starts from that exact head and preserves its improvements. The new PR targets **`feature/defender-mobile-art`**, not main; it is stacked on #14. #14 and unrelated PR #5 were not changed. Review/approve the dependency before any future integration; there is no automatic merge or deployment step in this task.

## Exact inventory and designs

`js/rules.js` remains unchanged: `scout`, `vanguard`, `titan`; `pulse`, `twin`, `siege`; tiers 0/1/2. Legacy -1 renders as T0 without modifying the equipment record. Quality rolls and salvage do not introduce extra visual IDs. Existing in-game item names, paints, team signals, three core sockets, fittings, owned inventory and two independent machines remain.

| Family | T0 | T1 | T2 |
|---|---|---|---|
| Scout | Compact low dart, narrow tracks, light optic | Split armor shoulders and rear stabilizer plates | Lightweight separated four-track outriggers, swept rails and cooling banks |
| Vanguard | PR14 Defender hull and modular Pulse anchor; shared track assembly, rear sockets clear of turret | Layered wedge, shoulder reinforcement and prow armor | Armored intake shoulders, cooling banks and stepped side protection |
| Titan | Broad reinforced keel and heavy tracks | Full-width inclined plow and reinforced shoulders | Four heavy track pods, armor bridges and raised rear engine deck |
| Pulse | PR14 segmented cannon and angular turret | External capacitor pods and energy collars | Accelerator rails, five-stage thermal hardware and rotating collar |
| Twin | Two slim barrels, light feeding blocks | Side feed drums and reinforced cooling | Larger feeding modules and rotating barrel braces; still two muzzles |
| Siege | Large single bore, breech and recoil pistons | Reinforced recoil rails and larger bore | Dual heavy artillery barrels, split brakes and larger rear breech; retains two visual muzzle anchors |

Class size/HP/speed/counter meanings, weapon fire/DPS/supers and all battle behavior are unchanged. T2 Scout's former standard hover geometry is now tracked presentation only; its original gameplay values remain. Lunar Skin's original hover/ornament paths are preserved.

## Reusable architecture

In `js/models3d.js`, **`CHASSIS_VISUALS`** and **`WEAPON_VISUALS`** explicitly define class/tier dimensions, deck/mount planes, track layout, barrel/muzzle dimensions and silhouettes. **`standardChassis`** / **`standardWeapon`** use shared **`trackAssembly`**, **`wheelAssembly`**, **`armorPart`**, **`ventBank`**, **`sensorBlock`**, **`mountSocket`**, **`turretHousing`** and **`barrelUnit`**. The authored Defender hull/turret from #14 remain the collection anchor rather than being replaced by a generic box. This is three class profiles and three family assemblies with small variant modules, not eighteen copied modeling functions.

Public **`M3.chassisKit(...)` / `M3.weaponKit(...)`** contracts remain. Lunar Skin and Moonbeam delegate to their exact previous implementations. Smooth machined normals remain opt-in. Three merged material buckets retain painted armor/rubber, machined metal and restrained emissive separation. No GLB loader, remote asset dependency, new product package, texture pipeline or renderer was added. The models file grows from 51,483 to 65,059 bytes; gzip from 17,726 to 21,922 bytes (+4,196 compressed bytes).

`M3.fittingKit` accepts optional visual attachment context; existing callers without it retain the original behavior. Standard body/mount fittings now follow class deck/track dimensions and weapon housings. Lunar Skin retains its old fitting path. Render caches use the attachment context to prevent mismatched cached parts. Standard weapons share caches across classes. The actor cache is bounded at **64** kits, fittings at **96**; evicted GPU geometry is disposed, and retained actors safely re-upload it when necessary.

`web/scene.js` reuses these factories for whole machines, chassis-only and weapon-only inspection, including ordinary animated assemblies. The #14 lighting/framing/contact patch now covers all ordinary models; legendary lighting/geometry remains on its old branch. Reduced motion, drag/zoom and automatic 2D fallback remain. The game combat camera is untouched.

The public **`web/equipment-preview.html`** is an isolated visual catalogue: one WebGL renderer copies nine rendered cards into bounded canvases; no account/economy imports, network API calls, browser storage, saving, auto-equipping or gear grants. Garage/Engineer link to it and retain the stock-versus-Lunar comparison. The live machine caption explicitly labels an already-selected Lunar Skin instead of silently replacing it. The catalogue may show unowned visual samples, clearly labeled as samples. It never equips them.

`version.json` / Mini App query versions are prepared as **`20261029-standard1`** for a future approved release. Worker asset packaging already includes all `web/` and `js/` files; no backend edits are needed. Evidence/test files remain excluded from product asset packaging.

## Actual rendered evidence

All images below are screenshots of actual vendored Three.js output, not generated artwork or composited concepts. Common-angle sheets use the same model factory and showroom material/lighting path as the real website. Before sheets load PR14's actual models under that same inspection rig, so they compare geometry under controlled presentation rather than claiming to be old production screenshots.

- [9 chassis, labeled 3×3](../evidence/standard-equipment/chassis-3x3.png)
- [9 weapons, labeled 3×3](../evidence/standard-equipment/weapons-3x3.png)
- [9 representative complete pairings](../evidence/standard-equipment/pairs-3x3.png)
- [PR14 chassis before](../evidence/standard-equipment/before-chassis-3x3.png) / [PR14 weapons before](../evidence/standard-equipment/before-weapons-3x3.png)
- [Mobile Garage](../evidence/standard-equipment/garage-390.png)
- [Scout Engineer](../evidence/standard-equipment/engineer-scout-390.png), [Vanguard Engineer](../evidence/standard-equipment/engineer-vanguard-390.png), [Titan Engineer](../evidence/standard-equipment/engineer-titan-390.png)
- [Heavy side view](../evidence/standard-equipment/titan-2-siege-2-side-390.png), [Scout rear view](../evidence/standard-equipment/scout-2-twin-2-rear-390.png), [weapon close-up](../evidence/standard-equipment/weapon-closeup-8-390.png)
- [Actual 3D Arena practice](../evidence/standard-equipment/battle-arena-390.png), [actual 3D Survival practice](../evidence/standard-equipment/battle-boss-390.png)

Full captures (including nine mobile weapon close-ups, side/rear sample views, 320/390/430 widths and legend samples) and machine-readable measurements are retained in `/workspace/standard-equipment-evidence/`. Only selected review PNGs are committed; logs, generated Worker assets, baseline source copies and temporary output are not.

## Tests and objective budgets

| Check | Observed result |
|---|---|
| Actual-THREE geometry suite | 9 chassis, 9 weapons, all 81 pairings; all tiers have distinct position geometry |
| Mesh contracts | Finite/bounded vertices and normals; central mount clearance, weapon-above-socket and muzzle-end sanity, animation positions/axes, max 3 material buckets per static part |
| Appearance/legacy | 72 paint/team/core combinations; 243 fitting combinations; -1/T0 geometry parity; input equipment/stats not mutated |
| Legendary protection | All **42** Lunar Skin / Moonbeam geometry, normal, color and animation paths byte-identical to the existing frozen baseline |
| Browser catalogue | All 18 actual rendered cards; 320/390/430 widths, orientation, reduced motion, stock/paint/legend selection, missing-WebGL fallback; no browser exceptions or account requests |
| Touch/inspection | Native emulated touch drag and touch zoom pass; nine mobile weapon-only close-ups captured through reachable controls |
| Real game UI | Disposable local catalog exposes 9 owned choices in each Engineer selector; actual Garage, three Engineer builds and fittings render; existing two bay configurations/economy stay unchanged |
| Runtime lifecycle | 45 showroom changes: 12 GPU geometries before/after, peak 14. Actor cache churn: 360 builds, 64 cached kits / 40 fitting entries; GPU geometries **234 → 234**; retained evicted model draws again with GL error 0 |
| Economy | **189 passed, 0 failed** |
| Ranked PvP | **106 passed, 0 failed** |
| Farm | **49 passed, 0 failed** |
| Garage/frozen snapshots/parity | Pass; six-mode stock stats/rewards and snapshot-bound proof contracts |
| Practice | **12 completed seeded trials across all six modes**; real mechanics and isolation pass |
| Accounts | Existing web auth/OIDC/bot-proof and Lunar passkey/linking suites pass; no identity code changes |
| Lab UI / syntax / whitespace | Pass |

Per-part non-indexed vertex counts (positions/normals/colors):

| Model family | T0 | T1 | T2 |
|---|---:|---:|---:|
| Scout | 14,304 | 14,964 | 24,840 |
| Vanguard | 27,300 | 17,580 | 18,924 |
| Titan | 17,688 | 18,168 | 25,980 |
| Pulse | 6,288 | 5,052 | 6,060 |
| Twin | 5,736 | 6,840 | 7,488 |
| Siege | 3,240 | 3,840 | 6,324 |

The existing **30,000-per-chassis** cap remains; weapons are checked under 16,000, with observed max 7,488. The authored Defender is down from PR14's 28,260 to 27,300 through shared assemblies. All other chassis stay below it. Model detail is generated on a loadout change and cached, not rebuilt per frame.

Observed full showroom: **15 draw calls / 12,918 triangles** including stage, with no accumulating geometry. Observed actual practice renderer: Arena **37 calls / 23,402 triangles**, Survival **46 / 24,598**, high quality. Showroom creation+draw averaged ~24 ms (max ~62 ms) over the switching sample in **headless Chromium/SwiftShader**; that is loadout construction/submission time, not ordinary frame cost or physical-phone FPS. No real iPhone/Safari/Telegram hardware or production Cloudflare account was used. Existing in-game quality reduction and 2D graphics selection remain.

Tests initially caught a real heavy-barrel socket intrusion; artillery barrel height was corrected. A test also mistakenly treated animation-local coordinates as assembled coordinates; it now includes the actual animation offset. The first browser assertion misidentified Three.js's own `data-engine` attribute as an extra renderer; it now correctly enforces one shared WebGL canvas. No geometry limits, security tests, original stats or mandatory CI protections were bypassed.

Reproduce the geometry checks with `node dev/tests/defender-visual.mjs` (includes the matrix and legendary checks). Run the local-only catalogue browser suite with `python dev/tests/standard-equipment-browser.py`; `--before` uses the saved PR14 geometry baseline. For the real UI fixture, build the existing assets, start `LUNAR_FIXTURE_PORT=8793 LUNAR_STANDARD_VISUAL_FIXTURE=1 node dev/tests/webserver.mjs`, then run `python dev/tests/standard-equipment-app.py`. The synthetic catalog is initial test data only, not a production grant or account migration.

## Review decisions and remaining phase boundaries

Owner review is required for class/tier readability (especially Scout's light split pods versus Titan's heavy pods), the ordinary Pulse/Twin/Siege silhouettes and tier progression, and the collection's common industrial finish/lighting. The contact sheets intentionally expose the whole collection for this decision.

Photographic PBR materials, wear/texture authoring and advanced environment lighting remain a subsequent phase; these are procedural game assets. Moonbeam and Lunar Skin remain the next *separate* design task and were not redesigned here. War Base, monetization, new gear/classes, balance, accounts, purchases and referral systems are outside this PR. No owner action or credential was needed to implement/test this branch. Approval is required only before future merge/deployment.

## Changed files relative to PR14

- Product geometry/rendering: `js/models3d.js`, `js/render3d.js`, `web/scene.js`.
- Preview/presentation: `web/equipment-preview.html`, `web/equipment-preview.css`, `web/equipment-preview.js`, `web/game.js`, `web/play.html`, `web/defender-preview.html`.
- Prepared cache version: `index.html`, `version.json`.
- Tests/fixture/CI: `dev/tests/standard-equipment.mjs`, `dev/tests/standard-equipment-browser.py`, `dev/tests/standard-equipment-app.py`, `dev/tests/defender-visual.mjs`, `dev/tests/defender-isolation.mjs`, `dev/tests/webserver.mjs`, `.github/workflows/website-check.yml`.
- Review: this document and the fourteen linked PNGs in `evidence/standard-equipment/`. The inherited PR14 changes remain in their own ancestor commit.
