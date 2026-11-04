# Conquest Session 2.5

Branch: `conquest-session-025-exploration`, based on merged Session 2 (`3815dfd`). Draft review only: no merge, production deployment, release stamp or economy/combat systems.

## Movement and equipment

`travelSpeed(loadout) = machineSpeed(loadout) * 2`. The underlying shared permanent equipment function is unchanged. World dimensions remain 31,680×47,520, reference 4.4 becomes 8.8 units/s, ideal reference crossings 60/90 minutes. Equipment-specific crossing times vary. No combat multiplier is introduced.

216 combinations cover three classes, three rarities, Engine 0/4, equipped/removed Speed Core, levels 1/5 and three fitting sets. Actual unobstructed production displacement is checked at 10/15/20/60 FPS, with diagonal normalization and resume reset. Collision still subdivides travel into at most 0.2-unit steps. Bridge upper/lower routes, ramps, edges, solid facilities, world boundaries and deterministic ground footing remain covered.

## Actual tread animation

Conquest attaches the existing GraphicsMotion vertex shader to the existing baked shoes and wheel geometry. Foundation models retain drive attributes through merging; the starter uses a Conquest-local belt-path adapter. No extra meshes or draw calls. Movement uses accepted 3D displacement (including ramp elevation), divided by rendered model scale 1.65. Differential turning uses the equipped chassis's track spacing. Blocked and stationary machines stop their tread phase; tests cover 8.8/17.6/26.4 units/s and turns.

The existing camera-relative drive system turns the machine to face its movement direction; it does not offer a separate reverse gear. The shared drive algorithm's signed reverse motion is tested, but Session 2.5 does not change these driving controls. Standard geometry, paint, normals, color, animation and metadata hashes remain identical across 432 standard kits.

## Visibility and resource strategy

Useful fog range extends 1280→2560 with a 3000-unit camera plane. Actual coarse terrain extends at least 2816 units from a chunk edge in the interior, beyond the fog boundary. Existing close terrain/props are unchanged. A 64-unit distant mesh transitions to 128-unit terrain; broad mountains and craters retain deterministic physical heights. One merged horizon draw remains; only LOD boundaries need skirts. Shared vertex samples are cached within each rebuild, distant lighting uses inexpensive up normals, and distant vegetation is omitted. Near fine-radius selection remains mobile-aware (one chunk on narrow viewports, two on desktop).

Streaming selection/sorting runs on cell changes, completed streaming returns early, equipment is refreshed at 0.5-second intervals instead of cloning/serializing loadouts every frame. Horizon geometry is disposed on replacement; close chunks retain a two-build-per-frame budget. No unstable fog adaptation or quality switching is introduced.

Full interior horizon:11,040 vertices,7,088 triangles,528,288 bytes of typed position/normal/color/UV/index buffers, independent of travel duration. This is buffer accounting, not a claim to measure driver GPU allocation.

## Discovery

The initial genuine spawn reveals only an 80-unit radius. Subsequent discoveries originate only in `View.tick`, immediately after accepted physical `World.advance` movement. A 32-unit cell ledger stores 128-byte bitsets per 1024-unit region (172 base 64 characters plus regional keys). Only occupied regions are stored; data is versioned and uses stable absolute coordinates. The map uses deterministic terrain/biomes, relief, seeded vegetation/rocks/relays and actual authored bridge, oxygen facility, outpost and solar geometry. All detail is clipped to explored cells with an inward feather. No invented roads/settlements are added.

Map opening/panning/zooming/locate, far rendering and diagnostics do not write discovery. Jumps do not interpolate exploration along skipped coordinates; legitimate movement after a jump reveals only its new local traveled area. Stationary/blocked, nonfinite and oversized movement is rejected. Saves union local/account state, use the existing account-linked save/cloud mechanism and an account-scoped local fallback, and flush on background/pagehide/dispose. Late cloud snapshots cannot erase accumulated discoveries.

These are client architectural guards, not cryptographic or server-authoritative verification. Actual Telegram multi-device cloud transport has not been physically tested. The API remains compatible with future accepted server movement events.

## Verification and limitations

See `performance.json` for fresh measurements and `tests.txt` for commands/results. Browser tests use Chromium SwiftShader at 390×844 with touch enabled, plus 320/430-width layout checks. They exercise production map controls, accepted driving, unseen diagnostics destinations, persistent discovery on re-entry, equipped models, touch pinch/orbit, repeated streaming, stale input reset, actual WebGL context loss and return/re-entry. Screenshots are real browser renders of this source.

No physical iPhone has been tested. Software GPU frame rates do not establish hardware performance or a 60/30 FPS guarantee. Long-duration thermal behavior, Safari/WebKit rendering, actual Telegram close/reopen and device context recovery remain owner checks before merge/deployment.

## iPhone acceptance route

1. Open an approved preview of this branch in Telegram on the same iPhone used for Session 2. Enter Conquest; inspect tracks at close zoom while driving and stopping against a bridge rail. Switch chassis/upgrades in Garage and re-enter; faster builds must travel and cycle treads faster.
2. Drive east from 898,1024 across the bridge, then inspect the map. Pan/zoom into unknown land: it stays dark. Close/reopen Telegram and confirm visited areas persist; another account must have its own atlas.
3. Test high ground near 13920,8048 via diagnostics for visibility only; opening the map there must not reveal it. Drive locally to reveal only that neighborhood, with no revealed corridor from spawn.
4. Travel continuously for 15–30 minutes, crossing streaming seams and bridge surfaces; reopen the map repeatedly. Background/resume, leave/re-enter and rotate the phone. Check touch response, terrain seams, frame pacing, heat and memory reloads. Compare with Session 2 on the same device/settings.
5. Do not approve deployment if extended distance harms responsiveness. Hardware measurements may justify reducing distance; this software-browser evidence cannot settle that choice.

Exploration cloud reconciliation also unions discovery independently of the existing economy snapshot winner; simultaneous writes still rely on the existing Telegram save transport. Long-travel map coarse sampling was reduced from 7,219 samples / 1,093ms to 726 samples / 149ms in a Node no-op canvas characterization (46km explored strip). These are CPU characterization numbers, not measured browser draw or iPhone times.

## Final software-browser measurements

Same Session 2 camera/location at 390×844; 80-frame samples; Chromium SwiftShader, software GPU, no physical iPhone. Host timing varies; these samples establish resource costs, not device FPS guarantees.

| Metric | Session 2 | Session 2.5 |
|---|---:|---:|
| Useful terrain fog range (units) | 1280 | 2560 |
| Draw calls | 53 | 53 |
| Rendered triangles | 33802 | 29830 |
| Horizon vertices | 13899 | 5955 |
| Horizon triangles | 8136 | 4164 |
| Horizon buffer bytes | 660372 | 287004 |
| Renderer geometry count | 53 | 53 |
| Renderer texture count | 2 | 2 |
| Mean CPU tick (ms) | 1.86 | 1.65 |
| CPU tick p95 (ms) | 4.80 | 4.90 |
| Frame interval p95 (ms) | 100.10 | 100.10 |
| Observed rAF FPS | 16.18 | 17.96 |

The practical 30 FPS minimum was not reached on software rendering; it is not established for iPhone. The final sample improves software FPS while doubling distance and retaining near quality. Deeper all-edge skirts were rejected during investigation because they increased overdraw; final skirts occur only on the actual LOD interfaces.

Independent review found and fixed cloud snapshot union, early-save timestamps, ramp tread distance, and long-route atlas CPU costs. No merge/deployment has occurred. A standard geometry hash failure during development was resolved by keeping the starter track-path adapter in Conquest rather than changing shared model metadata.
