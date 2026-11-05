# Conquest Session 3.3

Owner specification: Conquest Session 3.3, 2026-11-04 (session prompt).
Implementation on fresh branch from b5a01350dc2a41c7b84a1809050910a007dc2194.

## Implementation plan and ledger

Use existing vanilla JS, deterministic shared simulation, Three.js and authenticated ETag transaction. Keep combat profiles and engineering math together in combat.js to preserve existing explicit browser/server load order. Rendering remains independent.

- [ ] Controls: reproduce multi-pointer activation; pointer-down ability edges, pointer-specific joystick release; measure 0.40s × 5.1 Dash, collision and frame rates.
- [ ] Combat: canonical archetype cadence/damage, independent speed/range, persistent heat and lockout; migration and transition tests.
- [ ] Engineering: bounded saved ranks/tuning, safe terminal actions, atomic banked costs and UI previews; forgery/replay/concurrency tests.
- [ ] Visuals: reusable pooled bolt/beam/vent/Dash routines; compact heat meter, fallback verification and mobile screenshots.
- [ ] Validation/release: focused tests then existing gates at final SHA; PR review, merge only if scope and gates pass; verify Worker/Pages merge-SHA releases.

Review focus: active projectiles during upgrades; hot weapon swaps; short edges during network requests; terminal race with movement; previous v1 records without engineering.

Baseline: authority, controls, economy and balance scripts passed before editing. Existing affordability model reaches proposed future base at 56 minutes when saving. No daily rewards or base recipe changes planned.

## Exact combat and engineering constants

| Gun | Interval (s) | Range (m) | Heat/shot | Cooling/sec | First vent (no cores) | Shots / 30s held |
|---|---:|---:|---:|---:|---:|---:|
| Twin | .22 | 82 | 8 | 16 | 22 shots / 4.63s | 67 |
| Pulse | .50 | 92 | 17 | 13 | 9 shots / 4.00s | 27 |
| Moonbeam | .95 | 125 | 36 | 10 | 4 shots / 2.85s | 13 |
| Siege | 1.20 | 100 | 30 | 9 | 5 shots / 4.80s | 11 |

Capacity 100; vent latch releases at <=35% of current capacity. Cooling runs continuously during simulation. Paused mission/navigation time does not forgive heat debt. Absolute heat, vent latch, standard cooldown and ability cooldowns carry across mission/respawn/refit. Hot weapon swaps inherit heat, rather than providing another free reservoir. Cooling follows the active gun's profile. Existing v1 records default missing heat/engineering to stock without resetting account progression.

Unheated damage remains `canonical wdps × Conquest interval × existing damage/impact/armor/critical modifiers`; cadence is interval / existing RoF multiplier. Thus unheated stat-derived DPS is unchanged algebraically, across tiers and cores. The 30s benchmark uses common stock archetypes without cores, at 15/30/60 FPS (identical shot totals). The existing starter build includes RoF/damage/armor cores; its authority mission test changed from 34s baseline to 54s with heat. This is a focused automated scenario, not a player population TTK study.

Velocity uses canonical owned `wpspd × 3` (including Velocity core/fittings), independently multiplied by engineering; lifetime = independent range / speed. Pure engineering ballistics does not change damage or impact bonuses. Standard shot travel is substepped for collision and terminates at world boundaries. Supers retain original geometry and damage rules. Dash is .40s at 5.1× speed: 2.04 speed-seconds vs prior .68 (3×); cooldown 4s before owned fittings/engineering. Shield remains 3s / 25s / 65% mitigation before engineering. Dash collision substeps limit hull travel to .35m.

Ranks 0..3 are independent. Per-rank engineering bonuses: capacity/cooling/range +9%, velocity/Dash distance +10%, Dash/Shield cooldown -4%, Shield duration +8%. Add rank percentages to signed specialization percentages, then apply once to base values; owned cooldown fitting multipliers and owned projectile stats remain effective. Cooldown floors: Dash 1s, Shield 5s. Four specialization axes use the owner's exact -3..3 tradeoffs: favorable +5% per step and opposing -3.5%; positive Mobility/Shield adds +3.5% cooldown cost, negative reduces cooldown 5% and reduces distance/duration 3.5%.

| Next rank | CP | Banked Alloy | Banked Biomass | Banked Helium-3 |
|---|---:|---:|---:|---:|
| 1 | 100 | 4 | 2 | 0 |
| 2 | 250 | 12 | 6 | 0 |
| 3 | 600 | 25 | 15 | 2 |

Full eight-track cost: 7,600 CP, 328 Alloy, 184 Biomass, 16 Helium-3. A first rank is affordable from the first mission clear after banking; choosing to save still follows the unchanged 56-minute proposed Command Base affordability model. No base is implemented. Future bases can invoke these same authenticated actions/UI against `conquest/<pid>.engineering`; no second progression economy or migration is necessary.

## Implementation and security

- `js/conquest/combat.js`: single Conquest profile/engineering registry and shared thermal reducer. Browser and server already load it before controls; no new script ordering.
- `js/conquest/controls.js`: directional Dash, stable collision, effective ability timing and state carry.
- `js/conquest/session.js`: edge buffering/serialization, authenticated engineering action payloads.
- `worker/src/conquest-sim.js`, `worker/src/conquest.js`: canonical reconstruction, v1 defaults, safe-terminal checks, whitelisted actions, ETag CAS costs and sequence/digest idempotency. No client prices, ranks, derived stats or account IDs accepted. Banked resources only.
- `js/conquest/app.js`, `css/conquest.css`: pointer-owned DRIVE/FIRE, pointer-down abilities with keyboard click fallback, compact heat, accessible four-card Supply UI.
- `js/conquest/view.js`: pooled `createLaserEffect`, `alignLaser`, `effectMaterial`, `moonCharge`, `gunVent`, `dashStreak`. Simulation never imports rendering. Shared materials/geometries are disposed with the view. Existing mute-aware `fx('shot', archetype)` is reused.

The moving-Dash input fault was click-dependent ability activation during another held touch; pointer-down edges bypass suppressed compatibility clicks. Pointer-specific joystick release also prevents unrelated endings from clearing movement. The Chromium test uses native three-touch CDP input, holds DRIVE/FIRE and taps Dash then Shield across server requests; canonical snapshots confirm the abilities. WebKit uses independent mouse DRIVE plus native touch abilities because its automation interface exposes single native touch. Neither is physical iPhone Telegram evidence.

## Validation record and limitations

Baseline: `conquest-authority`, `conquest-controls`, `conquest-economy`, `conquest-balance` passed before edits. `bash dev/tests/conquest-regression.sh` passed (includes shared Arcade/gear/Velocity/PvP rules and 772 combat balance checks). New deterministic tests cover all archetypes at 15/30/60 FPS, thermal hysteresis/carry, independent speed/range, v1 migration, all ranks/sliders, precise banked debits and state preservation. Authenticated Worker tests add competing-tab purchase CAS, replay, funds and forgery checks. CI retains existing checks and adds Session 3.3 deterministic/browser tests.

Screenshots/results in this directory: 320×568 and 390×844 Chromium/WebKit. Laser captures briefly pause the test-owned scene after a real simulated projectile/Super is emitted so geometry can be inspected; this is not a latency measurement. No physical-device verification or new frame-time benchmark is claimed. Local WebKit dependencies were extracted into a temporary browser runtime; host library preflight was skipped only after resolving actual linker dependencies. CI uses standard installed browser dependencies.

Conquest's existing renderer requires WebGL and returns a recovery screen on context loss; the preexisting Arcade HIGH/LOW/2D fallback remains untouched. Session 3.3 has not added a playable Conquest 2D renderer. This remains a scope/acceptance caveat requiring review before release; do not claim Conquest 2D validation.
