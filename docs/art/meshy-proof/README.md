# Meshy models in the game: proof (Session 5E-1)

Everything here is made by scripts in `dev/assets/meshy/proof/` and can be regenerated. Captures come from headless Chromium
with **software GL (SwiftShader)**: they prove what is drawn and compare before/after on the same machine. They are **not**
phone frame rates; nobody has checked a physical iPhone yet.

| Folder / file | What it shows | Made by |
|---|---|---|
| `gate1/` | Gate 1: Vanguard original high-poly vs LIGHT vs FULL at phone battle, Garage and 1920 desktop size, SSIM | `proof/gate.mjs` + `ssim.py` |
| `fit/<chassis>.webp`, `fit/scales.json` | Weapon proportions: every chassis with all ten weapons, before (one scale) and after (measured uniform fit) | `proof/app.mjs <dir> fit` |
| `colour_check_stock_vs_reference.webp` | The nine chosen reference images next to the in-game stock look | lead's check |
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
