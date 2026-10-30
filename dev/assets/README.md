# LUNAR equipment graphics authoring — collection v2

This is the opted-in Graphics Session 2 collection, not a production rollout or visual approval of the draft stack. No rule/item IDs or accounts are defined here.

## Rebuild the original local assets

From repository root, with Node 22+, Python 3.12 and Pillow 12.3.0:

```sh
python -m pip install -r dev/assets/requirements.txt
python dev/assets/build-surfaces.py
npm_config_cache=/tmp/lunar-three-npm node dev/assets/build-three.mjs
node dev/tests/hf-foundation.mjs
node worker/build-web.mjs
```

`build-three.mjs` installs **build-only**, pinned `three@0.169.0` and `esbuild@0.24.2` in the OS temporary directory and bundles the exports listed in `three-exports.json`. It preserves the existing Three r169 runtime/API, adds real MeshStandardMaterial/environment/loader support, and copies Three's MIT license. Runtime needs no npm, network CDN or second Three instance. No glTF loader or glTF support is claimed.

`build-surfaces.py` is original project artwork, generated deterministically with seed 7403. Manifest version is `hf-v2.0`; the existing `hf-v1` folder is retained for path compatibility, with version/hash cache keys. Engraved sparse scratches, directional brushing, edge scuffs, rubber reinforcement and differentiated ORM are original source artwork. No purchased/downloaded art is used. It creates the checked-in `js/assets/hf-v1/` PNGs and SHA-256 manifest. Pillow is a build tool, not a game dependency. Using the pinned Pillow version avoids differences in PNG encoding across tool versions.

The atlas has four material tiles: graphite (top-left), gold (top-right), steel (bottom-left), rubber (bottom-right). `base` is sRGB; `normal` and `orm` are linear data. ORM channels are **R=AO, G=roughness, B=metalness**. HIGH is 512×512; LOW is 128×128. Three shared maps per profile are checksum/dimension/version validated before use. The LOW renderer uses only the base map with simpler Phong response; its normal/ORM files are reserved in the shared asset format and are not sampled by LOW shaders. No unnecessary new renderer/GLB format is introduced.

## Complete collection / subsequent authoring

The `builders` registry in `js/equipment3d.js` covers all nine class/tier hulls, nine standard archetype/tier weapons and one Moonbeam. All nine hulls adapt Lunar Skin independently. `profiles` holds class identity; existing `M3.CHASSIS_VISUALS` / `WEAPON_VISUALS` supply canonical dimensions, turret sockets and muzzle endpoints. The new HIGH and LOW bodies/receivers are authored geometry, not conversion of legacy triangles. Public defaults remain disabled; no maps load without explicit opt-in.

Reusable components include `trackedDrive` / `trackPod`, `plate` / `panel`, `bolt`, `pipe`, `vents`, `cylinder` and `crest`. Class-specific split/outrigger/ram/four-pod structures and weapon-specific power jackets/feed drums/recoil housings remain deliberate authored branches. Add registered visual profiles here; never duplicate the renderer or add inventory IDs. `slopedArmor` shapes actual hull/glacis geometry. Arc seam zero-area faces are removed before tangent baking; scalar Gram-Schmidt avoids per-vertex Vector3 allocations. LOW reduces track/bolt/coil details and un-bevels/simplifies crescents.

Track profiles accept length, height, depth, offset, wheel count and wheel radii; the current values are the Vanguard sample, not new class definitions. A builder returns the existing `{k, anims, meta}` model contract:

```js
const k = Equipment3D.kit('high');
Equipment3D.put(k, authoredGeometry, 'steel', '#cbd5df', [0,.2,0]);
return {k, anims:[], meta:{ty:.777, bob:0, halos:[], trail:[]}};
```

Use material IDs `paint`, `gold`, `steel`, `rubber`, `energy`. Unknown material names fail authoring validation. `put` preserves authored normals/UVs, transforms geometry, packs UVs into the chosen atlas tile, supplies UV1 for compatibility (the current shared ORM uses UV0 for all three channels), computes orthogonal tangent directions/handedness, and adds linear vertex tint. Geometry without UVs receives deterministic dominant-axis projection. Atlas UVs are per-part normalized 0–1; do not use UV tiling outside that range. All surfaces retain finite position/normal/UV/tangent attributes through baking. Mirror outlines rather than using negative geometry scales.

Prefer purpose-built beveled plates and restrained cylinder segments. Place real seams/bolts/vents where silhouettes justify their cost; textures supplement geometry. Maintain **+X forward, +Y up, +Z right**, local tank radius convention and unchanged physical collision. A chassis uses `meta.ty` as its rotating turret origin. Weapons sit above that plane and keep accurate `meta.tips` at visible muzzle ends; never encode damage/shot timing in visuals. Named moving parts retain `{k,p,axis,spd}` under `anims`; keep them mechanically attached and bounded. Moonbeam HIGH retains two captive charge collars; LOW omits these extra draw calls. Standard epic effects retain their existing axes/speeds and exact projectile tips.

Use class/tier and paint/skin identities from existing rules. Keep functional fitting and core selection independent, retain team markers, and keep Moonbeam and Lunar Skin independent. Retain `skin='lunar'` and its existing +8% behavior in the **unchanged rules**, not in graphics code. All intended class/tier builders now exist; later art work must retain these IDs and contracts.

## Ownership, caching and fallback

`M3.bake` and `M3.meshOf` dispatch HF kits to the same shared path used by game, menu art and showroom. Material banks are shared per HIGH/LOW profile. The geometry cache uses immutable baked buffers, mesh leases and a weighted LRU: **14 MiB idle target**, 12-entry target; active leases and the latest pending chassis/weapon working pair are protected. These are soft idle targets, not permission to dispose live GPU resources. The measured active/transient peak is reported separately.

`M3.meshOf` retains the asset for its returned group. Consumers must call `Equipment3D.releaseTree(group)` when replacing/removing it, and skip direct disposal of `geometry.userData.hfShared` buffers. Do not also retain HF entries in the legacy KC cache. Menu one-shot art releases its tree after copying pixels; persistent hero/showroom/actors release on replacement/removal. This prevents double-uploads, premature disposal between hull/weapon assembly and unbounded model switching. Renderer/client leases are attached once, not once per frame. `dispose()` will refuse while users/mesh leases are active.

Failed, missing, checksum-invalid or wrong-version assets select the existing PR #16 model; there is no blank placeholder or account grant. Retry is supported. Version plus content hash is in texture URLs. On missing WebGL, no atlas is requested and 2D remains available. Showroom context loss falls back; its quality button can create a fresh context. The main game's established context-loss policy remains 2D fallback, not an untested new automatic recovery system. LOW has fewer tread/wheel/bolt/coil vertices, simpler materials and no HDR environment sampling; 2D uses the existing renderer.

## Reproducible inspection

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open **http://localhost:8000/web/equipment-preview.html?hf=1** for the complete interactive collection. `&sheet=chassis`, `weapons`, `lunar` and `pairs` produce actual shared-renderer contact sheets using one WebGL context; `&quality=low` cold-starts LOW. Nothing is equipped or saved. The owner receives in-repository mobile screenshots and does not need to run commands.

**http://localhost:8000/web/foundation-preview.html** retains the representative comparison/independent-legend inspector. This page has no auth, storage, saves, gear grants or economy imports. Compare baseline/upgraded at the same angle/lighting/exposure, inspect separate components, select stock paint/Lunar Skin and Pulse/Moonbeam independently, and select HIGH/LOW/2D; `?quality=low` starts directly with the smaller maps and `?view=baseline` skips the optional maps. Use HTTPS or localhost: asset integrity uses the browser's secure-context crypto API. Nothing here publishes the branch.

For actual app/practice integration use the disposable test fixture, never production:

```sh
LUNAR_STANDARD_VISUAL_FIXTURE=1 LUNAR_LEGEND_VISUAL_FIXTURE=1 LUNAR_FIXTURE_PORT=8797 node dev/tests/webserver.mjs
python dev/tests/hf-app-browser.py
python dev/tests/hf-final-integration.py
```

The test initializes `window.LUNAR_HF_SAMPLE=true` before local app boot. That is a render-only opt-in, not a saved preference or ownership override. The fixture's pre-owned synthetic catalog and signed fake identity are development-only and excluded from Worker assets. Do not turn this flag on in production before owner approval and later rollout checks.

`hf-browser.py` captures shared showroom/mobile quality comparisons; `hf-failure-browser.py` checks asset faults, zero-map no-WebGL and context fallback/recreation. `hf-foundation.mjs` validates UVs/tangents, geometry/quality budgets, pending-part ownership, atlas hashes/sizes and pinned runtime. Browser tests require Playwright and Chromium; reported measurements are software/emulation results, never physical iPhone FPS.

## Session 2 focused verification

`node dev/tests/hf-collection.mjs` checks HIGH/LOW coverage, all 81+99 mounts per quality, distinct geometry, UV/tangent/normal integrity, exact canonical tips/sockets and LRU leases. `hf-collection-browser.py` captures matched PR17 comparisons, four runtime sheets and churn; `--resume` preserves completed baseline measurements. `hf-collection-final-views.py` refreshes final core/LOW captures and checks gallery quality/skin feedback. `hf-collection-app.py --resume` reuses the completed and still-valid seeded simulation baseline, runs the actual app/six modes and tests unsaved bays/economy isolation. `hf-collection-integration.py` checks final core/Vault/fitting integration and HIGH/LOW six-pilot cost. Reuse `hf-failure-browser.py` for asset/context/no-WebGL failures. These are local software-browser results, never physical-iPhone FPS or owner visual acceptance.
