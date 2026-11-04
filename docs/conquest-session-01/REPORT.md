# Conquest Session 01 handoff

Branch: `codex/conquest-foundation`. Starting main: `9d97458cabb3025d39e85ca69a6d7d066124fbc8`.
This is a world exploration foundation, with no combat, economy, rewards or account mutations. Production is unchanged. No deployment or release was performed.

## Files and boundaries

Added:
- `js/conquest/world.js`: immutable moon dimensions and seed, infinite-coordinate macro noise/craters, biome mask, exact fine-mesh ground interpolation, normals, sectors, landmark records, future warp-node collection, explicit bridge/ground surface queries and slope/ledge/pillar navigation, bounded chunk selection, map transform.
- `js/conquest/view.js`: perspective WebGL renderer, floating chunk origin, 128-unit chunks, detailed 4-unit near grid and 16-unit distant grid with skirts, global normals, at most 81 live chunks, two chunk builds per frame, instanced repeated vegetation, proxy vehicle, physical ramp/deck/supports, oxygen/outpost placeholders, camera controls, cleanup and local-only position restore.
- `js/conquest/app.js`: hub, entry/exit, help, thumbstick, map pan/zoom/locate, developer diagnostics, context-loss state. No second RAF: uses the app frame loop.
- `css/conquest.css`: isolated safe-area-aware UI and procedural hub art.
- `dev/tests/conquest.mjs`, `dev/tests/conquest-browser.py`: deterministic and browser tests.
- `docs/superpowers/plans/2026-11-04-conquest.md` and this report/evidence directory.

Modified:
- `js/ui.js`: one separate Play CTA and action.
- `js/main.js`: route frames to Conquest while its overlay is open.
- `index.html`: Conquest scripts/style.
- `web/boot.js`, `web/play.html`: authenticated web edition loads the same isolated subsystem/style.

No change to `js/game.js`, `js/rules.js`, arena renderer/environment/models, match definitions, worker simulation, auth, payments, progression or onboarding scaling.

## Dimension proof from executed tests

`node dev/tests/conquest.mjs` passes with:
- Width **31,680**, length **47,520**, reference speed **4.4 game units/second**.
- Exact decimal arithmetic: `31680 * 10 / 44 / 3600 = 2` hours; length equivalent = **3** hours. Integer-scaled calculation avoids IEEE binary rounding of 4.4.
- Area **1,505,433,600** game units squared; **2,352,240×** the 20×32 arena rectangle.
- Deterministic samples, identical shared border vertices/normals, finite corner/center/far meshes, 500 bounded stream selections.
- Continuous ascent/descent along the bridge, independently traversable lower route, blocked bridge side ledges and world edge padding, full-world map transforms.

All coordinates use game units, not physical meters or lunar kilometers. Theoretical crossings exclude slopes and obstacles.

## Preview and iPhone route

From a running test build: **Play → CONQUEST → ENTER CONQUEST**. Drag DRIVE to move relative to the camera, drag world to orbit/pitch, +/− zoom. OPEN MAP spans the whole moon; pan by dragging, zoom with buttons, locate self, or restore WHOLE WORLD. RETURN TO CONQUEST disposes the viewer; RETURN TO ARCADE restores the app.

The existing local test harness requires Chromium and Playwright:

```sh
node dev/tests/conquest.mjs
python dev/tests/conquest-browser.py
```

The browser test intercepts all requests, serves local repository files, uses a disposable local-economy fixture, and blocks external services. It needs no production account. Its preview/evidence is Chromium, not real iOS Safari. To interact manually with that fixture, run it headed (change `headless=True` to `False`) and pause before browser close. For a normal authenticated web/Telegram preview use the repository's existing preview host; this session did not deploy one. Simply serving root `index.html` without the local fixture redirects public users to the existing website by design.

Diagnostic testing is explicitly opt-in: append `?conquestDev=1` to the game URL. In the hub, Foundation diagnostics indicates the session setting; in-world DEV DIAGNOSTICS reveals the hidden HUD and clearly labeled DEV ONLY test jumps. No warp progression or paid travel exists.

Demonstration coordinates:
- Initial approach **(898, 1024)**. Drive east, entering ramp at X900, deck at X960. Deck Y=**24** until X1080; descend to ground by X1140.
- Upper center **(1024, 1024)** and lower center share X/Z; ground is approximately **−13**, providing about **36 game units** below the solid deck underside. Ground route: drive north from **(1024, 995)** to **(1024, 1055)**. Supports are away from that route.
- Oxygen complex placeholder **(1160, 1080)**, terraformed trees in surrounding region; outpost placeholder **(1140, 1160)**; local ridge **(1210, 1130)**.
- Barren terrain west of showcase, for example **(600, 1024)**. Procedural craters and massifs throughout the theater.
- Test jumps: center **(15840, 23760)**, southwest **(1,1)**, far northeast **(31679,47519)** generate genuine terrain chunks.

## Executed validation

PASS:
- `node dev/tests/conquest.mjs`
- `python dev/tests/conquest-browser.py`: 390×844 mobile viewport, software WebGL; actual touch events move proxy; perspective camera; rendered upper and lower traversal; map; far jump; **200 rendered streaming moves**; bounded chunks; disposal; no builds after exit; re-entry; normal FIGHT; Garage and Shop visibility; six mode definitions; zero page errors.
- Last browser stream endpoint: **25 chunks**, **8 renderer-tracked geometries** (visible uploaded resources, not a total memory benchmark). The viewer's chunk collection becomes **0** after exit.
- `node dev/tests/environment.mjs`
- `node dev/tests/map-layout.mjs`
- `node dev/tests/map-nav.mjs`: 24 matches per canonical map; all finished, none inside solids.
- `node dev/tests/garage-rules.mjs`
- `node dev/tests/defender-isolation.mjs`
- `node dev/tests/graphics-motion.mjs`
- `node dev/tests/standard-equipment.mjs`
- `node dev/tests/gear-combat.mjs`: 656 paired duels, 180 six-mode practice trials, 3420 client/server parity cases.
- JavaScript syntax checks for new app/view modules; `git diff --check`.

Initial checks caught missing module, decimal float equality, an endpoint surface assertion, and a lifecycle test snapshot taken before exit. These were corrected and the final runs pass. Browser launch initially needed the installed `/usr/bin/chromium` and runtime network permission to satisfy the execution sandbox.

Screenshots in this directory are actual test captures: hub, world spawn, bridge top, whole map.

## Known limitations / incomplete acceptance checks

- **No physical iPhone or Safari testing, FPS benchmark, JS heap/GPU byte measurements, context-loss recovery automation or background/resume device stress test.** Diagnostic FPS is an estimate, not a published performance result. No assertion that a normal iPhone performance target is met.
- Terrain mesh and selected samples are tested; no exhaustive path-connectivity proof over the entire 1.5-billion-unit rectangle. All valid coordinates generate terrain. Steep slopes block traversal rather than implement climbing/physics. Navigation is a kinematic exploration foundation.
- Distant LOD uses skirts; its transition can pop. There is no predictive worker-based mesh generation. Very distant geography is fogged rather than world-wide rendering.
- Trees are instanced primitive columns; towers, village, proxy and bridge are foundation placeholders. No detailed tree/rock art, road network, city or finished installations. Dramatic regional art remains limited.
- Landmarks and bridge surfaces are stable ID contracts; dynamic object/modification persistence and navigation graph APIs remain future work. Future theater IDs can use independent providers; only moon is implemented.
- Strategic map is a compressed sampled biome/elevation image with coordinate bounds and player/landmark dots. Landmarks cluster tightly at whole-world scale; help gives their coordinates. No gesture pinch zoom (buttons work).
- Browser regression covered local root app flow, not the authenticated website end-to-end or real live PvP/network/auth/payment flows. Those systems were not changed.
- No single root test command/package exists. The named focused/regression suites above ran; the entire historical browser test collection did not.
