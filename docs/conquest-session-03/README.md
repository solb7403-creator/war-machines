# Conquest Session 3 — Hold the Oxygen Line

Built from main `9226cc8` (merged Session 2.5). No merge or deployment is authorized. No economy, payment, purchase, Arcade combat or competitive reward rules are changed.

## What is playable

Drive to the oxygen approach at **1160 / 1048**, discover it physically and open the briefing. START MISSION freezes the legal equipped Garage loadout. Defend the first oxygen tower against **three waves, seven actual armored units**: interceptors pursue the player, saboteurs target oxygen, and a coordinator provides support. Enemy stats are fixed authored constants; they never match the player's build.

Primary Pulse, Twin, Siege and Moonbeam fire real swept projectiles using shared `tankOf`, damage, rate, armor, critical, graze, class and projectile-impact rules. Twin alternates muzzles, Siege has a slow heavy shell with local fragments, and Moonbeam has luminous precision traces. Permanent Garage equipment, legal modifications, cores and Lunar Skin remain represented. No super/ultimate ability is added.

Hull destruction, oxygen destruction and leaving the defense perimeter cause defeat. Retreat, retry, replay, victory and exploration exit are available. Replay never clears first completion and never grants rewards. The mission is intentionally forgiving: precise automated starter aim wins in about 27 simulated seconds; an unattended facility can be destroyed by real enemy fire within 130 seconds. These are automated pilots, not human difficulty measurements.

Mission completion is **provisional client-recorded personal progress**, stored under the account-specific save key with a local fallback and the existing cloud-save path. It is not server-authoritative and grants no points, resources, currencies or equipment. Discovered territory remains separate and monotonic. No global sector ownership is implemented.

## Terrain

Fine triangle interpolation, collision normals and vehicle orientation now agree. A bounded 16,384-corner terrain cache avoids recalculating procedural noise for every projectile and navigation sample. Movement evaluates geometric fall-line and directional grade rather than adding a step-size-dependent height allowance. Uphill directional grade is capped at .95, descent at 1.2; very steep faces above grade 1.7 allow only near-contour movement. Rejected travel can project along a safe contour, with every candidate still checked against barriers. These are authored lunar vehicle limits, not a claim about real tank capabilities.

The Moon's terrain generation, coordinates and **31,680 × 47,520** dimensions are unchanged. Exploration retains **2×** permanent Garage speed; active combat uses normal permanent chassis speed. Tracks follow accepted 3D displacement. Bridge deck, ground, rails and actual support columns remain separate. Tower collision includes vehicle clearance. Shots and the camera respect terrain, towers, habitats, deck and supports. Decorative scenery rocks are not newly designated physical obstacles in this session.

Validated bounded routes through production navigation:

- Starting ramp **898/1024 → 1160/1048**, over the bridge.
- Oxygen approach → refuge approach **1140/1128**.
- Oxygen approach → Refuge ridge **1210/1130**.
- Oxygen approach → reported hillside **1283/1104**, plus direct contour travel there.
- Existing lower bridge route **1024/995 → 1024/1055**.
- Sampled distant corridors at **14000/8000**, **28000/42000**, **15840/23760**.

Tests also cover an actual extreme cliff, tower barriers, deck edges, exact footing, 10/20/60 FPS and 4.4/8.8/16 unit movement. This is sampled connectivity, **not exhaustive proof of global traversability**. AI uses bounded local candidate paths at 0.3-second decision intervals; no global navigation mesh is claimed.

## Validation and limits

Run `bash dev/tests/conquest-regression.sh` for the existing regression suites plus new terrain, mission progress and combat tests. The new tests cover frozen shared equipment stats, all four primaries, fixed enemies across builds, significant gear advantage, exact direct damage, swept collision, hill/building occlusion, actual three-wave firing victory, unattended objective destruction, retreat, retry and bounded storage. Personal progress tests cover account isolation, readiness gating, reload, first-completion retention, and untouched discovery/economy fields.

`python dev/tests/conquest-session-03.py` runs actual 390×844 Chromium/SwiftShader gameplay, simultaneous driving/aiming/firing/camera touches, releasing DRIVE while FIRE remains held, real objective damage, seven projectile kills, three simultaneous enemies, completion map, defeat/re-entry/replay cleanup, page reload persistence and WebGL loss/recovery. Defeat UI is additionally triggered with an explicit test health override; the simulation suite independently proves actual enemy-fire defeat. Evidence relocation never reveals territory by itself; the mission approach uses accepted physical movement. Screenshots are actual rendered frames; accelerated production simulation is used to complete combat between captures.

The existing `conquest-browser.py` passed rendered bridge/underpass and touch driving, 200 streaming jumps, renderer disposal/re-entry, Arcade battle entry, Garage, Shop and the six-mode registry. Syntax and `git diff --check` pass. Initial Chromium launch failed under restricted socket sandboxing; enabling sandboxed network permission resolved it. An early screenshot run timed out under concurrent CPU-heavy tests. An added touch test initially released the wrong CDP contacts; pointer-event tracing identified and corrected the harness. Final reruns supersede these attempts.

Final measured software WebGL sample: 46 active render samples, 97–103 draw calls; mean wall frame 64.44 ms (median 70.80 ms), 15.52 FPS. Mean combat simulation 1.322 ms/update, maximum 9.200 ms; mean complete View CPU work 3.904 ms. Final three-wave rendered result: 134 draw calls / 73638 triangles. Five additional entry/exit cycles ended at 60 exploration draw calls, 79 geometries, with empty enemy/projectile/effect collections. Hardware rendering cost is not represented by this CPU-only measurement. See [browser-results.json](browser-results.json) for raw samples. No physical iPhone FPS, thermal, battery, Safari or Telegram hardware result is claimed. Human aiming feel and difficulty, real mobile performance, and cross-device cloud synchronization still need owner validation. The local account fallback survives page reload and world re-entry; no server-verified outcome infrastructure is added.

## iPhone validation

1. Use the draft branch in a locally hosted/staging build you authorize; this PR does not deploy it. Open Safari or Telegram portrait. Enter Conquest with starter equipment.
2. Drive east across the bridge, then to **1160/1048**. Verify exploration speed, tracks, ground contact, briefing discovery, and explicit START MISSION.
3. DRIVE with the left thumb. Drag AIM with the right and hold FIRE; keep FIRE held while releasing DRIVE. Drag open terrain for camera orbit and use +/− to zoom. Inspect hills/structures blocking shots.
4. Defend oxygen through all three waves. Check hull/oxygen health, enemy wrecks, victory, secured map status, normal exploration speed and clean controls afterward.
5. Replay, retreat, lose, retry away from the beacon, close/reopen Telegram, and verify first completion plus atlas remain. Compare stronger gear against the same enemies. Check Garage, purchases and all Arcade modes remain intact.
6. At **1283/1104**, try both hill contours and steep fall lines. Test the bridge above and below; drive around tower bases and refuge habitats. Record device model, FPS, heat and any blocked route for follow-up.

## Gameplay evidence

1. [Traversable reported hillside](01-hillside.png)
2. [Mission briefing in the world](02-briefing.png)
3. [Primary fire](03-firing.png)
4. [Three simultaneous enemies](04-armored-assault.png)
5. [Oxygen under attack](05-oxygen-defense.png)
6. [Victory](06-result.png)
7. [Discovered map: secured objective](07-secured-map.png)
8. [Exploration after completion](08-exploration.png)

## Changed files

- `js/conquest/world.js`
- `js/conquest/combat.js`
- `js/conquest/progress.js`
- `js/conquest/view.js`
- `js/conquest/app.js`
- `js/main.js`
- `css/conquest.css`
- `index.html`
- `web/boot.js`
- `version.json`
- `dev/tests/conquest-terrain.mjs`
- `dev/tests/conquest-combat.mjs`
- `dev/tests/conquest-progress.mjs`
- `dev/tests/conquest-session-03.py`
- `dev/tests/conquest-view-travel.mjs`
- `dev/tests/conquest-regression.sh`
- `docs/conquest-session-03/`: this report, implementation plan, measured browser results, and eight gameplay PNGs.

Final full regression: **25 Node suites, exit 0**. Suites: `conquest`, `conquest-travel`, `conquest-view-travel`, `conquest-discovery`, `conquest-terrain`, `conquest-progress`, `conquest-combat`, `graphics-motion`, `garage-rules`, `gear-balance`, `gear-combat`, `standard-equipment`, `hf-foundation`, `hf-collection`, `chassis-family`, `defender-isolation`, `defender-visual`, `legendary-visual`, `graphics-release`, `map-layout`, `map-nav`, `combat-balance`, `gem-ui`, `lab-ui`, `velocity`. Focused Conquest suites rerun after final collision changes; no unresolved test failures.

Website packaging (`node worker/build-web.mjs`) and login contracts (`node dev/tests/web-login.mjs`) also passed.
