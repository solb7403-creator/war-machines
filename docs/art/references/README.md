# Visual references (owner, Nov 9 2026)

Owner-made with Meshy from the prompts in the Nov 9 chat. They are the **visual target** for the arcade 3D maps session and
Graphics 2.0 (7.5): match their materials, lighting, detail and mood. Use a critic loop: render, compare screenshots against
these, have a separate critic score the gap, iterate (capped at 3-4 rounds). Run visual sessions at **Max** effort.

**Layout source of truth is the game data** (`MAPS` in `js/game.js`), not these images. `blockout-*.png` are the real layouts
rendered from that data (1 square = 1 arena unit); where a reference drifts (extra craters, rotated containers), follow the
blockout.

| File | Use for | Notes |
|---|---|---|
| 01-arcade-moonbase.png | Moonbase; overall look of all outdoor maps | Materials/lighting are the target; layout drifted |
| 02-arcade-overpass.png | Overpass; bridges, ramps, tunnels (also the Canyon mesa) | Layout matches closely |
| 03a-arcade-canyon-rockwalls.png | Canyon rock-wall detail; Longshot cliffs | Brown variant |
| 03b-arcade-canyon-grey.png | Canyon on grey regolith (preferred colour) | |
| 04-arcade-underground-bunker.png | Underground Bunker (only interior map) | Strongest reference |
| 05-props-outdoor.png | Close-up detail: command module, container, dome, lander, pylon, crate, boulder, spire, rock fin | Crater Field + Longshot props |
| 06-ground-closeup.png | Surface quality: regolith, tracks, crater rim, scree, beacon glow | What makes maps read as truly 3D |
| 07-turrets-eleven.png | The 11 Town Defense turrets (Session 5B and later) | Ignore the caption strip |
| 08-wall-blends.png | Wall blends, left to right: composite concrete, Ferrite (rebar, rust), Ilmenite (riveted plate), Armalcolite (blue-black armor), Tranquillityite (gold-veined), Selenite (reflective glass), Moonheart (glowing crimson crystal) | Realistic; match materials, sheen and glow |

Not used: the "town under attack" image (medieval stone walls, rainbow lasers: off-style). A terraformed-colony reference can
be added later for Graphics 2.0 (owner art direction: bright, rugged, real grass, civilized but with open wild land).
