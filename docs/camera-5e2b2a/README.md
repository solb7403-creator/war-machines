# Session 5E-2b2a: the Arcade chase camera and the raised bridges

What Arcade looks like from the new camera, on a phone (390x844 at 3x) and a desktop (1920x1080), in real play.
Written by `python3 dev/tests/arena-cam-capture.py` (bots drive every tank, yours included). The record of the session,
with every decision and number, is Checkpoint 35 in `docs/conquest/IMPLEMENTATION_CHECKPOINT.md`.

## The sheets

One sheet per map and device. On each sheet, left to right (desktop: row by row):

1. the same map in the fixed view it had before (5E-2c, from `docs/maps-5e2c/`),
2. the opening crane shot (the first third of a second of a match),
3. driving, 4. a 1v1, 5. a 2v2, 6. your super charging (the timing bar is up), 7. your super firing,
8. on Overpass and Canyon: on the deck, 9. in a tunnel (the camera goes down to you), 10. an enemy in a tunnel (its bar
   hangs at the tunnel's mouth, the lamps turn red).

| Map | Phone | Desktop |
|---|---|---|
| Moonbase | `moonbase-phone-390x844-3x.webp` | `moonbase-desktop-1920x1080.webp` |
| Overpass | `overpass-phone-390x844-3x.webp` | `overpass-desktop-1920x1080.webp` |
| Longshot | `longshot-phone-390x844-3x.webp` | `longshot-desktop-1920x1080.webp` |
| Crater Field | `crater-field-phone-390x844-3x.webp` | `crater-field-desktop-1920x1080.webp` |
| Canyon | `canyon-phone-390x844-3x.webp` | `canyon-desktop-1920x1080.webp` |
| Underground Bunker | `underground-bunker-phone-390x844-3x.webp` | `underground-bunker-desktop-1920x1080.webp` |

Also here:
- `*-low.webp`: the LOW graphics setting (lighter props, no ground grain, 1x resolution).
- `*-reduced.webp`: with the system's Reduce Motion on (no crane shot, the camera cuts instead of swinging, nothing spins).
- `perf-main.json`, `perf-branch.json`, `load-main.json`, `load-branch.json`: the raw numbers behind the tables in Checkpoint 35.

## How to read them

- A red tint round the screen is the game's low-health warning; floating numbers are damage text. Neither is new.
- The small map top left shows the whole arena: grey = solids, light blue = the bridge, red and blue dots = tanks, the white
  outline = what your screen shows.
- Markers on the screen's edge point at things outside the frame: red wedge = enemy (with its health), blue dot = team mate,
  diamond = objective, a flashing "!" = a super that will reach you.
- These frames come from a test browser that draws on the CPU; they show the picture, not the frame rate of a phone.
