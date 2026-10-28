# Session 4 — Interactive Laboratory / Isolated Test Range

Implemented locally on `feature/two-machine-garage`, based on Session 3 `35f71fc418c72465dbc55dc99d7406c0591bc457`, preserving Session 2 ancestor `6871efacf2d13f57e5f4ba0d5d04f90568c7d450`. The conversation's Session 4 instructions are the task input. No separate attachment was available. No push, deployment, live migration, production account/payment operation or Session 5 implementation occurred.

## Player experience

Both Garage cards offer **Free Test**. Engineer offers **Free Test draft** for valid owned equipment; testing neither saves nor activates that draft. The loop is Engineer → Test → Results → Adjust → Retest, with the draft/name/original save revision preserved on return. Existing Play/FIGHT navigation remains unchanged.

Practice is clearly marked **No rewards**. Default is player-driven, single-round Arena 1v1 on Moonbase. Moon Zone, Crystal Rush and Bounty use 2v2; Last Standing has six separate teams; Survival uses you plus a Stock AI wingman against the genuine scaled megatank. Mode descriptions explain these arrangements. All four existing maps and an integer seed are available under trial conditions. Players can drive or watch the actual AI drive their build.

Standard opponents are Stock Vanguard/Pulse. Equipped opponents use Rare Vanguard/Pulse at quality 1.05 and one Hull/Cannon/Engine upgrade each; these are isolated AI fixtures, never account grants. AI wingmen stay Standard. Survival retains its existing build-dependent boss scaling and disables the opponent selector rather than inventing another boss balance.

The existing joystick, targeting, super, dash, shield, camera, fitted appearance, 3D, 2D and no-WebGL fallback are reused. A top practice strip leaves the driving buttons clear. Stop/exit, background pause, resume, retry, Garage return, slow-load cancellation and local engine-error disposal have focused coverage. Trial errors retain the draft and never fabricate a match outcome.

## Isolation and repeatability

`range-engine.html` loads only the existing `rules.js` / `game.js`, a seed/event host and a small instance adapter. It has no Telegram/account/network/scoring scripts; CSP disallows outgoing connections. Each trial creates a separate browser realm and disposes it on exit. There is no ranked pipeline with rewards hidden, no copied combat engine and no generated simulator committed.

The parent supplies a detached loadout resolved from a previously server-validated owned snapshot, using existing `labValidate` / `ecoLoadout`. A whitelisted private device cache contains gear, quality, upgrades and visual entitlements, not points, payment receipts or auth data. Cached/offline experiments are labeled; uncached ownership requires connecting first. Saves and ranked starts continue through existing server authority. An offline browser still needs the practice scripts available in its HTTP cache; uncached asset failure asks the player to reconnect.

Practice simulation does not call match start/end, proof recording/submission, PvP, ghost reports, account store/sync or reward/progression functions. Existing ranked queues and wallet recovery retain their independent normal lifecycles. Tests distinguish an explicitly recovered existing ranked ticket from practice-origin traffic; practice does not suppress or discard recovery.

A synchronous view adapter binds practice objects only while existing input/render code uses them, restoring ranked globals in `finally`. Simulation itself remains in the isolated realm. Normal combat source, balance and default Math.random behavior are unchanged. Practice uses Session 3's per-instance RNG and a fixed 60 Hz step. Repeat freezes the loadout, map, mode, opponent, control policy and seed. Identity `lunar-range-s4.1/fits-1` must be bumped when combat/setup/controller rules change. Identical cross-browser replays are not promised, and player inputs can differ.

## Local results and comparison

Results contain outcome/stopped status, duration, damage dealt/taken, kills/deaths and genuine objective figures: zone scores/captures, crystals/collections, bounty scores/stars, placement or boss damage percentage. Controller, map, seed, preset, engine version and baseline engineering stats are shown.

At most **20 local summaries per machine** are retained separately from account/CloudStorage data, with clear/reset and storage-failure feedback. There are no frame traces or server analytics. Trial identities include the initial opponent/wingman stats; Survival's derived boss baseline is included. Boss enrage during combat does not change that recorded starting identity. Comparisons flag changed conditions and stopped trials and warn that one run does not prove a stronger build. Device cache clearing loses this history by design.

## Files

| File | Purpose |
|---|---|
| `range-engine.html`, `js/range-host.js`, `js/range-engine.js` | Restricted independent realm, instance RNG/hooks, real mode/factory setup, controls, summaries and disposal |
| `js/range.js` | Practice entry/settings/results, validated owned cache, local bounded history/comparison, draft return, lifecycle and scoped view adapter |
| `js/ui.js` | Garage/Engineer entry points, restored unsaved editor state/revision, invalid-draft blocking |
| `js/core.js` | Remember whitelisted gear only after an accepted authoritative account reply |
| `js/main.js`, `js/render.js` | Separate practice frame path and input/action routing; ordinary ranked paths retained |
| `js/render3d.js` | Release per-trial scene objects/materials and transient pad geometry; reuse existing renderer and shared models |
| `css/app.css`, `index.html` | Touch-sized controls, safe-area practice strip/canvas alignment, script inclusion |
| `dev/tests/wtest/range.mjs`, `range-comparison.mjs` | Real-engine seed/mode/control/lifecycle and initial-condition comparison regressions |
| `dev/tests/range-browser.py`, `range-recovery.py` | Isolated browser experience, network/account isolation, recovery/lifecycle and ordinary proof regression |
| `docs/WAR_MACHINE_LAB_ARCHITECTURE.md` | Links this implemented Session 4 boundary |

No server schema, economy, payments, referrals, LP/token allocations, rewards, anti-farm thresholds, combat stats, match ticket/room lifetimes or six-mode rules changed.

## Tests actually run

Browser tests serve local repository bytes and route APIs to the existing fake Worker/in-memory database. Every unmocked external destination is aborted; no production fallback. Logs are in `/tmp/lunar-session4-logs/`, screenshots in `/tmp/lunar-session4-shots/`; neither is committed. Existing Session 2/3 reports/results were preserved rather than rerun.

| Command/check | Observed outcome |
|---|---|
| `node dev/tests/wtest/range.mjs` | PASS: **12 completed AI-controlled actual-engine trials**, two repeatable runs in each of six modes; fitted stats/appearance, detached config, invalid conditions/fittings, actual manual movement/super/shield/dash and disposal |
| `python dev/tests/range-browser.py` | PASS: **7 completed actual-engine browser trials** (Arena twice with exact same-environment repeat assertion, other five modes once); valid unsaved owned draft and independent saved slots; real touch/actions; paused controls; account/ranked globals unchanged; fail-fast ranked/account/network spies; bounded history/clear; pending fields preserved; 320/430px 3D/2D and fresh no-WebGL fallback; cached offline label |
| `python dev/tests/range-recovery.py` | PASS: actual valid fake-server queued ranked quit accepted during practice; pending wallet/outbox fields unchanged; no practice summary for that recovery; **30 retry/exit cycles** without orphan frames or extra account writes; persisted summary/reload, slow-load cancel, injected engine-failure cleanup; **1 completed ordinary Arena simulation after range exit, proof accepted (1 record, 0 failures; no-input flags 0)** |
| `node dev/tests/wtest/range-comparison.mjs` | PASS: actual Survival enrage changes boss speed while comparison retains its starting baseline |
| `node dev/tests/wtest/pvp.mjs` | **106 passed, 0 failed** |
| `node dev/tests/wtest/lab.mjs` | PASS: migration/ownership/revisions, six-mode frozen equipment and PvP resolution |
| `node dev/tests/wtest/lab-battle.mjs` | PASS: frozen proof variants, queued/rejoined PvP seat and permitted counterpick |
| `node dev/tests/wtest/lab-parity.mjs` | PASS: unchanged Stock stats/rewards and six-mode snapshot proof contracts |
| Changed/new JavaScript syntax; `git diff --check` | PASS |

Confirmed defects corrected through failing regressions: paused keyboard actions, cancellation of an outstanding engine load, repeated engine failures escaping to the main frame loop, and comparison identity using the boss's final enrage speed. Browser fixture corrections handled collapsed advanced controls and closing-overlay animation timing; these were not represented as production defects. The interrupted command was checked before resuming, and its unapplied cleanup fix was then completed.

The successful full browser range test preceded the later failure-cleanup and initial-boss-baseline corrections; the recovery and comparison tests verify those touched paths. Backend suites were run once because no server/combat formulas changed. No broad gameplay sweep or unrelated farm/payment/referral audit was repeated. The known Session 2 farm reminder-batch failure remains a prior finding, untested here.

## Limits, rollback and preservation

No required Session 4 feature or essential test remains knowingly incomplete. This is automated browser/simulation evidence, **not first-hand human play**, enjoyment/balance proof or revenue evidence. Real iPhone/Telegram hardware, production Cloudflare, actual payments/refunds, long-duration GPU memory profiling and cross-browser deterministic playback were not tested. Browser graphics used this environment's Chromium; object/frame cleanup coverage is not a measured phone performance claim. Existing payment/referral findings remain out of scope.

No production migration is needed. New data is disposable private device cache/history; machine ownership, authoritative save revisions and pending ranked/payment formats are unchanged. A compatible Session 3 client can ignore these local keys. Remove/hide practice UI with a compatible client rollback; do not reset accounts or delete pending work. Future combat changes must version practice identities and coordinate cached assets before release.

All intended source/tests/docs are to be locally committed on the existing branch; the final response and exported report provide the exact commit ID. One Session 4 Git bundle contains the full branch including Sessions 2/3, and preservation is verified by bundle verification, isolated restore, ancestor checks and Git object checks. No push is attempted. Temporary logs, screenshots, generated sim output and secrets are excluded.

Session 5 remains unstarted: bounded machine version history, opt-in showcase/private projection, optional separately consented full blueprints, owned-part import, attribution/discovery and moderation. No new prices, slots, purchases or social publication are authorized by Session 4. Deployment requires separate approval.
