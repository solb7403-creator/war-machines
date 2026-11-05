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
