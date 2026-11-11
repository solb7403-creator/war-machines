# Meshy models in the game: proof (Session 5E-1)

Everything here is made by scripts in `dev/assets/meshy/proof/` and can be regenerated. Captures come from headless Chromium
with **software GL (SwiftShader)**: they prove what is drawn and compare before/after on the same machine. They are **not**
phone frame rates; nobody has checked a physical iPhone yet.

| Folder / file | What it shows | Made by |
|---|---|---|
| `gate1/` | Gate 1: Vanguard original high-poly vs LIGHT vs FULL at phone battle, Garage and 1920 desktop size, SSIM | `proof/gate.mjs` + `ssim.py` |
| `fit/<chassis>.webp`, `fit/scales.json` | Weapon proportions: every chassis with all ten weapons, before (one scale) and after (measured uniform fit) | `proof/app.mjs <dir> fit` |
| `colour_check_stock_vs_reference.webp` | 5E-1 only: the old `chosen/` (v1) images next to the 5E-1 stock look. Superseded: see `v2/colour_check_*_v2.webp` | lead's check |
| `app/garage_battle_high.webp`, `_low.webp` | Real app: Garage and Free Test battle, before (procedural) and after (Meshy), ten loadouts, HIGH and LOW graphics | `proof/app.mjs` + `sheets.py` |
| `app/paints_<chassis>.webp` | Every paint and Lunar Skin on every chassis, before and after, through the game's menu renderer | same |
| `app/app.json` | Per loadout: draw calls, triangles, shader programs, textures, frame times; every model load (bytes, ms); JS heap | same |
| `motion/*.webp` | Frame sequences: turret aim with the ring staying, per-barrel recoil, Helix spin, belt links and wheels, Colossus pod flex, charge pulses, Moonbeam crystals, town turret tracking + recoil, Command Center dish | `proof/motion.py` |
| `town/` | The town view with the Meshy Command Center and the turret line-up (existing `conquest-town-captures.py`, HIGH) | existing test |
| `MANIFEST.md` | Source file -> game item, triangles and size before/after | from `manifest.json` |
| `RETEXTURE.md` | The four models that gain most from a Meshy retexture, with prompts | lead |

## Numbers (real app, two tanks + map, arena; averages over the ten loadouts)
| | Draw calls | Triangles | Shader programs | Frame (median, software GL) |
|---|---|---|---|---|
| Before, HIGH | 47 | 40,400 | 17 | 1.0 ms |
| After, HIGH | 30 | 57,900 | 14 | 0.8 ms |
| Before, LOW | 47 | 16,700 | 18 | 0.7 ms |
| After, LOW | 27 | 36,400 | 15 | 0.6 ms |

- Fewer draw calls and programs: a Meshy chassis or weapon is one draw (moving parts are in the vertex shader).
- More triangles: 18k + 7k per tank on HIGH (the old HIGH tank was about 15-18k); LOW uses the reduced index set.
- Download: LIGHT 0.3-1.0 MB per item (16.4 MB for all 31), FULL 0.8-4.7 MB, fetched only when the Garage shows that item.
  A fresh match needs only the LIGHT files of the tanks in it (about 1.2 MB per distinct loadout); the procedural model is
  drawn until each arrives. Load time in this harness (fetch + decode + upload on a busy software-GL page): about 0.5-1 s
  per LIGHT item when idle, 3-4 s under the capture load; FULL 1-9 s. Real phones: unmeasured.
- Memory: JS heap 82 MB after cycling through all ten loadouts in both qualities with 21 models cached; the cache drops
  least-recently-used models that nothing is drawing (limit 22 LIGHT / 3 FULL, 10 LIGHT on devices reporting <= 4 GB).
- Town: programs stay within the 16 budget (gallery HIGH 15, CC10 towns 11), no page errors.

## Honest gaps
- No physical phone, no real GPU timing, no Telegram webview check.
- Town proof is the Command Center view and the line-up; not every one of the 12 town items has its own close-up capture here
  (they are all in `motion/` or the pipeline renders the helpers checked).
- Conquest enemy hulls, the town diorama and LOW-graphics town are still the procedural kit models.

## v2 (Session 5E-2a): after the visual fixes, at full phone resolution and desktop 1920 with anti-aliasing
Made by `dev/assets/meshy/proof/v2.mjs` (website build + fixture Worker: Garage and Free Test battle) and
`dev/assets/meshy/proof/v2_town.py` (shipped client + real Worker reducer: Conquest world and town). Both tell the page it runs
on a GPU (the WebGL renderer string), so it uses what a real device gets: phone 2.5x, desktop the full ratio, anti-aliasing on.
Captures are taken only after the Meshy files have loaded. Still software GL: this proves what is drawn, not phone frame rates.

| File | What it shows |
|---|---|
| `v2/colour_check_chassis_v2.webp`, `v2/colour_check_weapons_v2.webp` | Each chassis and weapon's v2 reference (`docs/art/references/tanks/v2/`, the owner's actual Meshy source images) next to its stock look in the real Garage (phone 3x, FULL); made by `proof/colour_sheet.py` |
| `v2/phone3x_garage_<loadout>.webp`, `v2/desktop1920_garage_<loadout>.webp` | Garage, FULL models, ten loadouts covering all 9 chassis and all 10 weapons |
| `v2/phone3x_battle_<loadout>.webp`, `v2/desktop1920_battle_<loadout>.webp` | Free Test arena: yours and the AI tank, LIGHT models |
| `v2/*_garage_vanguard1-twin1_lunar.webp` | Lunar Skin: the bright energy glow (stock lines are faint and still) |
| `v2/world_<profile>_*.webp` | Conquest world: the player's Meshy tank |
| `v2/town_turrets_*`, `v2/town_overview_*` | Town: turret gallery (all turret types) and a fully built CC10 town |
| `v2/sharpness-before.json`, `v2/sharpness-after.json` | Resolution, anti-aliasing, framebuffer memory, frame time and heap, main vs this branch (`proof/sharpness.mjs`) |
| `v2/verify.json`, `v2/town.json` | Per loadout / town: the Meshy id of every tank and town item on screen, anything still procedural, pixel ratio, AA, programs |

Result: every tank on screen in the Garage and in battle (yours and the AI's, both profiles, ten loadouts) is its Meshy chassis +
weapon; the Conquest world tank is Meshy; all 12 town items are Meshy in the town (gallery + full CC10 town) on both profiles;
no page errors; Conquest programs 12-15 (budget 16). Three places that still drew old geometry were fixed in 5E-2a: the
Tesla tower (no turning head, so the instanced-turret path refused it), big towns in the drive view and zoomed out (a 5C
performance LOD switched buildings to the kit; they now use the model's own reduced index set), and offline-pilot ghost tanks
in Arcade battles (now the Meshy model as a hologram). Kept procedural on purpose: Conquest enemy hulls (hostile faction
dress and crowd buckets) and the miniature town diorama in the world courtyard (see the checkpoint).
