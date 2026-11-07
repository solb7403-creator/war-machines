# Conquest style lab (dev-only, Phase 1 visual options)

> Phase 1 picked option B (Neon Frontline) + C's map grid. The shipped art direction lives in `js/conquest/style.js`
> (`ConquestStyle`, wired into `js/conquest/view.js` and the region map in `js/conquest/app.js`); `options/b/` stays as
> the Phase 1 sample. See docs/conquest/IMPLEMENTATION_CHECKPOINT.md, Checkpoint 21.

`lab.html` renders one Conquest **subject** with one **style option** so options can be compared shot-for-shot.
It is never loaded by the game. Terrain heights, scenery placement, collision footprints, the player tank kit,
renderer settings (no MSAA, HIGH pixel ratio ≤ 1.5, LOW 1, ACES + sRGB from `Equipment3D.configure`) and camera
framing are fixed by the harness; an option only decides how things look.

```
node dev/conquest-style/capture.mjs <option>            # 6 subjects × 390x844 & 1280x800 × HIGH & LOW → docs/conquest-graphics/phase1/<option>/
node dev/conquest-style/capture.mjs <option> --subjects refuge,map --views 390 --q high   # quick iteration
python3 dev/conquest-style/contact-sheet.py --options current,a,b,c
```
Manual view: serve the repo root (`python3 -m http.server 8000`) and open
`http://127.0.0.1:8000/dev/conquest-style/lab.html?opt=<id>&subject=<refuge|raid|tank|enemy|props|map>&q=<high|low>`
(`&t=3.2` freezes animation time; `&cam=fx,fh,fz,tx,th,tz` overrides the camera while composing — captures never use it).
`opt=current` is a faithful port of today's live look (reference column).

## Subjects (fixed by the harness)

| subject | what is on screen | option hooks used |
|---|---|---|
| `refuge` | 9 habitats ("cabins"), Refuge supply terminal, 3 oxygen processors, solar field, real terrain + scenery | `environment`, `terrainMaterial`, `props`, `refuge` |
| `raid` | Western Dust Switchback battery raid: L-shaped raid cover, 2 Parasite plasma batteries (immobile enemy turrets), raider + command titan, Western Salvage Depot Parasite installation, Blender raid-art spot, player tank | + `raidSite`, `enemy`, `playerTank` |
| `tank` | stock player tank close-up on Refuge regolith | + `playerTank` |
| `enemy` | raider (scout hull, twin cannon) close-up | + `enemy` |
| `props` | the real per-chunk scenery of the southern terraformed field (trees + rocks), plus an optional lineup strip | + `props`, `propLineup` |
| `map` | the in-game FRONTLINE / REGION MAP dialog at the zoom LOCATE SELF opens (scale 64), mid-campaign state | `map`, `mapCss`, `mapLegend` |

## Option contract — `options/<id>/style.js`

```js
ConquestStyleLab.register({
  id:'a', name:'SHORT NAME', summary:'one sentence',
  async prepare(api){},             // optional: load textures/GLBs before anything is built
  environment(api){},               // sky, stars, Earth, sun/fill lights, fog, renderer exposure. Adds to api.scene.
  terrainMaterial(api){return mat}, // ONE material for every terrain chunk + the horizon mesh
  props(api,items,chunk){return obj},   // per fine chunk: items = W.scenery() list; return children positioned
                                        // relative to the chunk origin (chunk.cx*128, chunk.cz*128), like the game
  refuge(api,f){return group},      // f = api.footprints.refuge; build in WORLD coordinates (harness offsets by origin)
  raidSite(api,f){return group},    // f = api.footprints.raid; world coordinates
  playerTank(api,vehicle,L){return group}, // dress the canonical vehicle (see rules); return it or a wrapper
  enemy(api,e){return group},       // e = {kind,cls,arch,immobile?,drone?,commander?,pattern?}; +Z forward,
                                    // userData.gun = turret pivot (harness sets gun.rotation.y), world scale
  propLineup(api,at){return group}, // optional: one of every prop variant, world coordinates (see below)
  mapCss:'…', mapLegend:'…html…',   // optional: restyle the map dialog chrome / legend line
  map(ctx,m){},                     // paint the 720x840 region map canvas (logical 360x420 at 2x)
  update(api,dt,t){}                // optional per-frame animation (captures freeze t = 3.2 s)
});
```
Missing hooks fall back to the live look (`api.baseline.<hook>`), so build every hook.

`api`: `T` — the game's slim THREE r169 build, exactly these 77 exports (`dev/assets/three-exports.json`): no Sprite,
no MeshPhysical/Toon/ShadowMaterial, no EffectComposer, no TubeGeometry/Line2/Decal; ShaderMaterial, `onBeforeCompile`,
InstancedMesh, Points/PointsMaterial, CanvasTexture/DataTexture, PMREMGenerator, Lathe/Extrude/Capsule/Torus geometries,
AdditiveBlending and WebGLRenderTarget exist. Do not edit the vendored build. — `W`
(ConquestWorld), `C` (ConquestCombat), `M3`, `Equipment3D`, `quality` / `low`, `scene`, `camera`, `renderer`,
`origin` (scene = world − origin, like the game), `ground(x,z)`, `normal(x,z)`, `time()`, `footprints`,
`merge(group[,material])` (bake child meshes into one vertex-coloured draw, as the game does), `orient(obj,x,z,heading)`,
`loadGLB(url)` (the game's constrained parser), `makeVehicle()`, `onUpdate(fn)`, `baseline`.
Terrain geometry attributes: `position` (chunk-local x/z, world y), `normal`, `color` (biome tint: green =
terraformed, blue-grey = massif, tan = wasteland), `uv` = world xz / 24 (stable across chunks). Mesh world position =
local + chunk position, so world-space shader detail needs the origin: `api.origin` (constant per shot).

## Hard rules (Phase 2 must be able to ship this look unchanged)

**Gameplay is untouchable.** Nothing here may change simulation, collision, hitboxes or economy:
- Habitats are solid to tanks within radius 7.8 m and block shots below ground + 9 m within 8 m. Processors: solid
  radius 12 m, shots blocked below ground + 108 / 146 / 108 m. Installations: tanks blocked in a 22 × 16 m box at
  (x, z + 8), shots blocked by an 18 × 12 × 12 m bunker, mast radius 2 m at (x + 14, z + 10). Raid cover boxes are
  exact. **Art must match these envelopes** (±1 m): bigger looks like clipping, smaller looks like invisible walls.
- Rocks: only `variant > .45` are drawn and they are solid inside the ellipse rx = 1.6·size + 1, rz = size + 1, top =
  y + size·(.8 + variant). Keep each rock inside that envelope (current art: ellipsoid 1.6s × (.5+v)s × s at y + .3s).
- **Trees and relays are NOT solid** — tanks drive straight through them. Whatever replaces trees must read as
  passable: low ground cover / growths ≲ 1.5 m over their footprint, or thin masts. Tall solid-looking things a tank
  drives through are a defect. You may also drop trees entirely in favour of lunar equivalents.
- Player tank: never change the canonical hull/turret/weapon geometry, sockets, muzzles or size (shared with the
  whole game). Improve it in Conquest with materials/lighting response, emissive accent strips, lights, a ground
  contact shadow/decal, dust — dressing only. `vehicle.userData` has `gun`, `body`, `chassis` meta.
- Enemies are Conquest-only and may be fully re-authored (Parasite war machines), but keep the bounding box within
  ±15 % of today's (compare with `api.baseline.enemy(api,e)`), +Z forward, `userData.gun` pivot at the hull's turret
  height, ×1.65 world scale is already baked into today's model. `e.immobile` = plasma battery / relay turret
  (objective target, ~7 × 6 m base, ~11 m tall today).

**Mobile budgets** (whole frame, worst subject, read from `stats.json`):

| | draw calls | triangles | option textures (GPU, incl. mips) | shader programs | other |
|---|---|---|---|---|---|
| HIGH | ≤ 90 at 390 · ≤ 160 at 1280 | ≤ 400k | ≤ 12 MB | ≤ 16 | ≤ 5 InstancedMesh per fine chunk; one 1024² directional shadow map allowed, tight frustum |
| LOW | ≤ 60 at 390 · ≤ 110 at 1280 | ≤ 150k | ≤ 3 MB | ≤ 10 | ≤ 3 InstancedMesh per fine chunk; no shadow map, no envMap/PMREM, no MeshStandardMaterial |

Today's live look measures 35–40 draws at 390 and up to 94 at 1280 (81 terrain chunks + props), 92k triangles, 9 programs.

- No post-processing passes (no EffectComposer / render targets per frame). Glow = emissive/additive geometry,
  billboards or vertex-coloured halos.
- A small fixed set of materials/programs: never clone materials per object with different defines, never create
  programs at runtime after load. Custom shaders (ShaderMaterial or `onBeforeCompile` with a stable
  `customProgramCacheKey`) are fine. Scene fog must still work (the far terrain edge is ~2.5 km away).
- Terrain: no extra per-vertex JavaScript work in chunk building (streaming hitches were just fixed). Put regolith,
  crater and slope detail in the terrain shader (world-space via `uv`), not in CPU geometry.
- Textures: original only (procedural canvas/data textures generated in `prepare`, or small committed PNG/JPG made
  by your own script). HIGH ≤ 512² per map, LOW ≤ 256², power of two, colour maps sRGB. No downloads, no third-party art.
- HIGH and LOW must both look on-style; LOW is cheaper (simpler materials, fewer props/details, no shadows).
- Blender 4.0.2 is installed (`blender --background --python <script>`). Optional; any GLB you load must pass the
  game's constrained parser (`js/conquest/assets.js`: static, ≤ 3 meshes/materials/draws, ≤ 3000 triangles HIGH,
  ≤ 1000 LOW, no textures, POSITION/NORMAL only, ≤ 250 KB). Keep the `.py` source next to the GLB. If your look needs a
  loader extension (vertex colours, UVs, more budget), say so in your report instead of editing shared files.

**Map**: keep every marker and its meaning (◆ field mission, ✦ raid site with cleared/locked state, ! defense alert,
● Refuge, ⌂ Command Base + tier, ▲/⚑ Parasite / captured installation, ◇ personal wreck, YOU arrow + heading, dashed
route line), the exploration fog (draw terrain ONLY inside `m.discovery` cells — never reveal unexplored ground) and
the pan/zoom contract (`m.scale`, `m.px`, `m.py`, `m.toScreen(x,z)`; the game repaints on every pointermove, so
cache heavy work — e.g. an offscreen relief image — and keep `mapRepaintMs` ≲ 4 ms here). Labels must not overlap
into unreadable clusters at 390 px; text stays legible (≥ 10 px logical). Note: today's map clips with thousands of
cell rectangles, which is slow to rasterize; a cached offscreen layer is preferred.

## Identity (owner brief)
A true LUNAR sci-fi war zone: grey regolith, craters, black sky with Earth on the horizon, neon base lighting,
glowing Parasite structures. Owner verdict on today's look: trees, cabins and the map look bad — rebuild them
dramatically better or replace them with lunar equivalents, whichever the style does best.
