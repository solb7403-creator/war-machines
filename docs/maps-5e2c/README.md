# Arcade 3D maps (Session 5E-2c): review sheets

Captured with `python3 dev/tests/arena-maps-capture.py` on the final branch build. The test browser draws WebGL on the CPU;
the tool tells the game it has a GPU so the sheets show what a phone (390x844 at 3x) and a desktop (1920x1080) draw.

| File | What it shows |
|---|---|
| `<map>-phone-390x844-3x.webp` | Owner's reference, the gameplay view on a phone, a wide three-quarter shot |
| `<map>-desktop-1920x1080.webp` | The same three panels on a desktop |
| `all-maps-phone-gameplay.webp`, `all-maps-desktop-gameplay.webp` | All six maps side by side at match start (HIGH) |
| `all-maps-phone-LOW.webp` | All six on the LOW graphics setting |
| `all-maps-phone-reduced-motion.webp` | All six with Reduce Motion on (nothing spins, drifts or pulses) |
| `battle-phone-moonbase-overpass-bunker.webp` | Mid-fight: tread prints, a tank seen through the Overpass grating |
| `perf-main.json`, `perf-branch.json` | Frame time, draw cost and map build time per map, main vs this branch (`dev/tests/arena-perf.py`) |
| `load-main.json`, `load-branch.json` | Download size and time to the first match frame (`dev/tests/arena-load.py`) |

Maps: `moonbase` (classic), `overpass`, `longshot`, `crater-field` (craters), `canyon`, `underground-bunker` (bunker).
Decisions, the critic loop, the environment-layer API and the numbers are in Checkpoint 34 of
`docs/conquest/IMPLEMENTATION_CHECKPOINT.md`.
