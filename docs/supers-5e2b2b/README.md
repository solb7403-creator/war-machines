# Session 5E-2b2b: supers and weapons

The record of the session, with every rule, decision and number, is Checkpoint 36 in
`docs/conquest/IMPLEMENTATION_CHECKPOINT.md`. This folder holds the pictures and the raw numbers behind it.

Every picture is drawn by the real game page in a test browser, frame by frame, on a phone (390x844 at 3x, the iPhone in
Telegram) and on a desktop (1920x1080), under the Arcade chase camera. The test browser draws on the CPU: the sheets show
the picture, not the frame rate of a phone.

## Supers: the final sheets (this build)

| Sheet | Phone | Desktop | What it shows |
|---|---|---|---|
| Moonfall | `moonfall-phone.webp` | `moonfall-desktop.webp` | Top row: miss / normal / jackpot. Bottom row: the jackpot charging, 0.2 s after it fires, and what it leaves behind. **The jackpot's red electricity sparks off the blue beam; nothing red goes round it.** |
| Rarity ladder | `ladder-phone.webp` | `ladder-desktop.webp` | Rows 1-3: common, rare, epic of each family at a NORMAL stop (and Moonfall). Rows 4-5: a PERFECT lower rarity beside a MISSED higher one: the perfect one may be larger, the higher rarity is still the more intricate. |
| Pulse family | `family-pulse-phone.webp` | `family-pulse-desktop.webp` | Pierce Lance / Arc Lance / Sunlance (rows) x miss / normal / jackpot (columns) |
| Twin family | `family-twin-phone.webp` | `family-twin-desktop.webp` | Static Nova / Storm Nova / Helix Nova, the same layout |
| Siege family | `family-siege-phone.webp` | `family-siege-desktop.webp` | Siege Blast / Rail Blast / Titanfall, the same layout (re-captured Nov 14 with the redrawn Titanfall) |
| Titanfall fix | `titanfall-fix-phone.webp` | `titanfall-fix-desktop.webp` | The Siege family before (the released build `c55d425`, left) and after (right) the owner's Titanfall fix, at every level: only Titanfall changes |
| Jackpot sequences | `sequence-phone.webp` | `sequence-desktop.webp` | Every super's jackpot: charge, bar stopped, blast, +0.2 s, +0.5 s, aftermath |
| LOW graphics | `all-supers-phone-low.webp` | | All ten supers x miss / normal / jackpot on the LOW setting (plain glows: no fire, wave-front or beam-flow shading) |
| Reduce Motion | `all-supers-phone-high-reduced.webp` | | The same with the system's Reduce Motion on (nothing spins or flickers) |

`before/` holds the same six sheets per device from main `1acff13` (the build before this session), for comparison.

**Titanfall was redrawn after the release (owner, Nov 14; Checkpoint 36, "Owner fix after the release"):** it is now a golden
seal (two rings and a bezel of ticks, a six-pointed star of straight lines, spires of light on its points, a lance ringed by
halos, molten fissures) with the fire as its small heart. Only the Siege family was re-captured: its family sheet, the Siege
row and the Rail Blast / Titanfall pair of the ladder, the Siege rows of the sequences, and Titanfall's row on the LOW and
Reduce Motion sheets. Every other tile is the one captured for the release.

How to read a row: **miss** is diffuse (the same energy spread wide and thin, the fewest effects), **normal** is focused,
**jackpot** is concentrated (a narrower white-hot core, the most effects). Size steps only a little between them
(x0.8 / x1 / x1.15). The mark on the ground under the firing tank is the rarity's sigil: common none, rare one broken
ring, epic a double ring with spokes, legendary the lunar sigil with the phases of the moon.

The red circle under an enemy tank and the health bars are the game's normal HUD, not part of a super.

## Weapons on every chassis

`fit-phone-<class>.webp`, `fit-desktop-<class>.webp` (class = scout, vanguard, titan): the ten weapons (columns) on the
three chassis of that class (rows), drawn by the game's own tank builder at the chase camera's angle.
`fit-side-<class>.webp`: the same from the side. `fit-measurements.json`: for each of the 90 pairs the weapon's scale,
its width and height against the hull, and how far the barrel passes the nose.
`before/fit-*.webp`: the same sheets on main `1acff13`.

## Numbers

- `rounds-before-*.json`, `rounds-after-*.json`: supers per player per round on main and on this build
  (`dev/tests/super-rounds.mjs`; tables in Checkpoint 36).
- `tap-rates.json`: timing-bar hit rates at each bar speed (`dev/tests/super-tap-rates.mjs`).
- `frame-time-main.json`, `frame-time-branch.json`: the cost of a frame with a jackpot on screen, main against this build,
  on the CPU renderer (`dev/tests/super-frame-time.py`; a relative check only).
- `frame-time-titanfall-fix.json`: the one relative check of the redrawn Titanfall's jackpot against main `1acff13`.
