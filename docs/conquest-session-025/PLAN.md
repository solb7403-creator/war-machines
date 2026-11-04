# Session 2.5 implementation plan

Goal: preserve Session 2 graphics and equipment while improving exploration only.
Architecture: Conquest-only 2× multiplier after machineSpeed; accepted displacement drives existing GPU tread deformation; compact visited-cell discovery gates deterministic map detail; bounded coarse distant terrain retains close geometry.

The owner's detailed Session 2.5 specification is the scope and execution authorization. No merge or deployment. One independent map implementer; primary integrates and verifies.

- [x] Movement: update exact parity tests to 2×, run red, implement multiplier, verify chassis/equipment/FPS/rails.
- [x] Tracks: verify actual tread drive tags in fallback and HF models; reuse shader and dispose leases; measure displacement and stop/turn cases.
- [x] Visibility: retain 1280 ring, add coarse 2560 outer ring, cache streaming selection and loadout polling; measure software browser before/after.
- [x] Discovery: accepted movement only; compact account persistence and local fallback; deterministic detail hidden outside visited cells; test zoom/jumps/rendering isolation.
- [x] Integration: Node regressions, mobile browser lifecycle/touch/screenshots/performance, review, commit and draft PR.

Review focus: context recovery, stale controls, bridge rail tunneling, account changes, teleport path interpolation, fallback materials and animation leases.
