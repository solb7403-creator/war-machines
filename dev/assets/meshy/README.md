# Meshy model pipeline (Session 5E-1)

Turns the owner's original Meshy GLBs into the two files per item the game loads (`js/assets/meshy-v1/<id>-light.glb`,
`<id>-full.glb`) plus `manifest.json`. **One script, one config.** The originals are never committed.

```sh
python -m pip install -r dev/assets/meshy/requirements.txt
python dev/assets/meshy/build.py --src <folder with the original GLBs>            # everything
python dev/assets/meshy/build.py --src <folder> --only chassis-vanguard-0,weapon-pulse-0
python dev/assets/meshy/build.py --src <folder> --quality light                    # one quality only
```

To raise quality, change numbers in `config.json` (`kinds.*.tris`, `kinds.*.texture`, `quality.*`) and rerun.
To use a **Meshy-retextured GLB** for an item: drop the file in the source folder, point the item's `src` at it and add
`"textured": true`. The bake then takes colour, roughness, metalness and surface normal detail from that file's own
textures; the cuts, masks and motion stay as configured. Nothing else changes.

## What a run does, per item
1. **Orient and size** (`yaw`, `fit`): +X forward, +Y up, ground at y = 0. Chassis: length = today's model length, origin =
   centre of the turret mount ring (found automatically). Weapons: origin = centre of the base ring, muzzle at today's tip
   distance. Town items: fitted inside their footprint in metres.
2. **Cut the moving parts** on the original mesh (`tracks`, `turret`, `parts`). Every cut is a surface of revolution about
   the part's own axis or a plane across its travel, so the seam stays closed in motion; openings are capped.
3. **Material regions** (`regions`, automatic thin-detail trim) per original triangle.
4. For LIGHT and FULL: decimate each part to its share of the triangle budget, unwrap (axis-projected charts packed by
   xatlas, hidden faces get a fraction of the texels), bake normal + AO + curvature from the original, synthesize
   base / ORM / mask maps (`lib/paint.py`), write a quantized meshopt GLB with embedded WebP maps.

## Tools
- `look.py <id> --src DIR --out DIR [--views side,top,front,rear,bottom,side-] [--parts|--regions] [--box x0,y0,z0,x1,y1,z1] [--ppu 400] [--clip x=0.5]`
  measured orthographic views in **game space** with a 0.1 grid (labels every 0.5). `--parts` / `--regions` colour the
  result of the current config. `--clip` starts the view at a plane (cross-section look). Fast: no baking.
- `proof/view.mjs <built-dir> <out-dir> '<json shots>'` renders built GLBs with the game's own materials and motion
  shader (headless Chromium). A shot: `{"name":"x","parts":[{"id":"weapon-twin-2","q":"light","ch":{"spin":0.6,"recoil0":1}}],"w":1100,"h":600,"cam":{"yaw":50,"pitch":20,"dist":5,"target":[0.5,0.3,0]}}`.
  `ch` sets motion channels (below) so a seam can be checked at the extremes of its travel.
- `proof/gate.mjs` + `proof/ssim.py`: original vs LIGHT vs FULL comparison (Gate 1).

## Config: an item
```jsonc
{"id": "weapon-twin-2",                 // file name stem; chassis-<class>-<tier>, weapon-<line>-<tier>, weapon-moon, town-<type>
 "src": "HELIX REPEATER",               // unique part of the original file name
 "kind": "weapon",                      // chassis | weapon | moon | town  (budgets come from kinds.<kind>)
 "game": {"arch": "twin", "tier": 2},
 "yaw": 180,                            // degrees about +Y applied to the source so the front / muzzle points +X
 "fit": {"mode": "weapon", "tip": 1.98},// chassis: {"length": 2.61}; town: {"mode":"footprint","w":12,"d":12,"fill":0.9}
 "look": "weapon-epic",                 // palette in looks.*; "lookOverride": {...} for per-item colours
 "tracks": "auto",                      // chassis running gear (see below)
 "turret": {...}, "parts": [...], "regions": [...], "sockets": {...}, "halos": [...], "tips": [...], "meta": {...}}
```

### `tracks` (chassis)
`"auto"` finds each track unit from its ground contact, the wheels by the vote of their cylindrical surfaces, the belt as
the band around the convex hull of the wheel circles, and rebuilds the belt from one clean link repeated around the path
(the original has no belt surface where it is fused to wheels and fenders). Overrides, all optional:
`{"top": 0.5, "rMin": 0.05, "rMax": 0.3, "tIn": 0.03, "tOut": 0.08, "zPad": 0.02, "tile": true, "periodicity": 0.45,
"pitchMin": 0.03, "pitchMax": 0.3 (link pitch search range), "core": 0.5 (fraction of tOut beyond which a surface facing the
belt, e.g. a fender underside, is not belt), "wheelShrink": 0,
"units": [{"x": [x0, x1], "z": [z0, z1], "wheels": [[x, y, r], ...]}]}`. Give `units` (with or without `wheels`) only when
the automatic result is wrong. Wheels become parts `wheel<unit>_<n>`, belts `belt<unit>`.
`"parents": {"0": "pod0", "1": "pod1"}` makes a unit's wheels and belt ride on a part you define in `parts` (a track pod
on an arm that flexes: the pod is a `parts` entry with its own `angle`, the running gear follows it).

### `turret` (weapons, town turrets)
`{"ringTop": 0.09, "barrels": [{"x": 0.8, "y": 0.38, "z": -0.22, "r": 0.195, "recoil": 0.05, "spin": 1.0}]}`
- `ringTop`: everything below this height is the base ring `ring`; it stays with the hull while the turret turns.
- each barrel: everything forward of plane `x` inside radius `r` of the axis through `(y, z)` becomes `barrel<n>`. The axis
  is centred automatically on the barrel's own surfaces (`"refine": false` to keep the numbers). `recoil` = travel back
  along the axis per shot (it slides into the turret, so no gap opens). `spin` = radians per radian of the spin channel
  (rotary clusters; use opposite signs on a pair). `xMax` limits the forward extent; `"tip": false` keeps a part from
  adding a muzzle point; `"channel": 0` lets two parts share one recoil channel.
- muzzle tips come from the barrels (front end, on the axis). `"tips": [[x,y,z],...]` on the item overrides them.

### `parts` (anything else that moves or pulses)
```jsonc
{"name": "antenna", "select": {"box": [[-1.0, 0.75, 0.2], [-0.9, 1.0, 0.3]]},
 "pivot": [-0.95, 0.75, 0.25], "axis": [0, 0, 1],
 "angle": {"ch": "sway", "k": 0.05},     // rotate about the axis through the pivot: radians = k * channel
 "slide": {"ch": "recoil0", "k": -0.1},  // translate along the axis: units = k * channel
 "glow": {"ch": "charge", "base": 0.6, "k": 1.5},   // emissive strength of this part's glow texels = base + k * channel
 "region": "trim", "decor": true, "selfAO": true}
```
A part without `angle` / `slide` is static but can carry its own `glow` (a crystal that pulses on its own channel).
`"parent": "<part name>"` makes a part ride on one other part's motion (one level).
Parts are tested in order after tracks and turret; the first match wins. `decor: true` = decorative motion that LOW
graphics and reduced motion hold still. `selfAO` for parts that spin continuously (their occlusion must travel with them).

**Channels** the game feeds: `driveL`, `driveR` (track travel in model units), `aim` (turret yaw), `recoil0..3` (1 at the
shot, decays), `spin` (radians, runs up while firing and spins down), `sway` (-1..1), `time` (seconds), `charge` (0..1),
`pulse` (slow 0.44..1 breathing), `fire` (1 at the shot, fast decay), `flex` (-1..1 suspension working while the tank
travels, 0 at rest), `one` (constant 1).

### Selectors (evaluated on triangle centroids, game space)
`{"box": [[x0,y0,z0],[x1,y1,z1]]}`, `{"cyl": {"p0": [...], "p1": [...], "r": R, "r0": inner}}`,
`{"plane": {"n": [nx,ny,nz], "d": k}}` (keeps n.p >= k), `{"sphere": {"c": [...], "r": R}}`, `{"all": true}`,
combined with `{"and": [...]}`, `{"or": [...]}`, `{"not": {...}}`. Add `"mirrorZ": true` to also select the mirror image.

### `regions` (colour), applied in order, later rules override earlier ones
`{"select": {...}, "region": "glow", "color": "#ff9d2e", "onlyParts": ["body"], "onlyRegion": ["armor"]}` or
`{"partShell": {"part": "barrel0", "r0": 0.128, "r1": 0.2, "t": [0.19, 1.07]}, "region": "glow", "color": "#ff9d2e"}`
(a radial shell around a part's refined axis; `t` = range along the axis from the pivot).

Regions: `armor` (paint tone A: the pilot's paint on a chassis), `armor2` (paint tone B), `trim` (bare/accent metal),
`steel`, `gold`, `dark` (recess, vents), `rubber`, `glass`, `track`, `wheel`, `hazard` (yellow/black stripes),
`glow` (emissive, colour = `color` or the look's `glow`), `lamp` (dim emissive), `keep` (textured sources: the source's
own colour). Defaults: everything is the look's `bodyRegion` (`armor`), belts `track`, wheels `wheel`, barrels and rings
the look's `barrelRegion` / `ringRegion`, caps `dark`, and thin stand-alone details (handles, rails, antennas) `trim`
(`autoTrim`).

### Seats for game-drawn add-ons (chassis)
`"sockets": {"cores": [[x, null, z] x3], "team": [[x, null, z] x2]}` (`null` y = drop onto the surface). Defaults are
computed; override only when a seat lands on a vent, box or slope.
`"halos": [[x, y, z, "#bdeaff", 0.10]]` adds soft glow sprites (headlights, cores).

## Output contract (read by `js/meshy3d.js`)
One primitive: POSITION (u16 normalized, node scale/offset), NORMAL (i8), TEXCOORD_0 (u16), `_MOT` (u16 x4: part index,
belt path length, belt offset, belt rest angle), indices; KHR_mesh_quantization + EXT_meshopt_compression +
EXT_texture_webp; maps base (sRGB factory look), normal, ORM, mask (R paint, G glow, B paint tone). `extras.lunar` =
`{id, kind, quality, parts: [...], meta: {...}, look: {...}}`.
