# Session 3 — Modular engineering and visible customization

Implemented on `feature/two-machine-garage`, based on Session 2 commit `6871efacf2d13f57e5f4ba0d5d04f90568c7d450`. Session 3 was authorized in the same conversation as one end-to-end implementation task. No remote push/permission investigation, deployment, production migration, purchase, flag activation or Session 4 interface occurred. The pasted Session 3 instructions were the available task input; no separate attachment was available in workspace storage.

## Delivered

Three free categories, each with Stock and two sidegrades, use the approved initial numbers unchanged:

| Fitting | HP | Driving speed | Ordinary DPS | Weight / power |
|---|---:|---:|---:|---:|
| Hull: reinforced plates | +6% | −4% | — | 2 / 0 |
| Hull: light frame | −6% | +4% | — | 0 / 1 |
| Mobility: sprint gearing | — | +6% | −6% | 0 / 2 |
| Mobility: stable gearing | — | −5% | +5% | 1 / 1 |
| Mount: hardened | +5% | — | −5% | 2 / 0 |
| Mount: firing | −6% | — | +6% | 1 / 2 |

Stock costs nothing and changes nothing. Budgets: weight ≤3 and power ≤3, one fitting/category. Nineteen of 27 combinations are legal. Deltas add per stat then multiply the existing derived baseline once, with HP rounded after mode scaling. `dmgM`, weapon interval, super damage parameters, dash path/speed/cooldown, shield, counters, core formulas and collision shapes are unchanged. More ordinary damage can naturally charge a super faster through the existing damage-based mechanic. Boss health still scales with the resolved ordinary DPS under existing Survival rules.

`mods` selects mechanics. Separate `looks` chooses free enum-based visual styles or follows the fitting; appearance never enters stat/power math. Garage cards and Engineer show the actual appearance. Engineer adds live before/after HP/DPS/driving speed, category gains/costs and weight/power totals; illegal combinations disable Save and are independently rejected server-side. Appearance controls remain touch-friendly and standard form controls. Existing Play remains direct.

2D draws armor strips/light-frame bracing, sprint extensions/stability wheels and hardened/finned mounts. Existing 3D uses merged bounded geometric additions on the hull and turret groups with a finite fitting cache. Cache identities include fittings. Team colors, foundation/weapon silhouettes, stock geometry and hitboxes remain intact. The same visual metadata is sent in the PvP roster and retained through client updates. No new renderer, uploads, dynamic collision mesh, purchase entitlement or part economy.

## Authority, snapshots and compatibility

Shared catalog version `FIT_VERSION=1`; new AI ticket rules label `lab-fittings-v1`. Old `lab-loadout-v1` pending tickets remain recognized and resolve their absent fittings to Stock. The shared legal-build validator rejects unknown IDs, malformed/extra properties, incorrect catalog versions, unowned existing equipment, stale revisions and over-budget combinations. Functional selections belong to the saved machine; global inventory/upgrade investment is reused. Legacy raw loadout submissions without Lab state cannot acquire functional fittings through the raw L path.

Fitted new battle starts require fitting-capability version 1. Stock older clients remain usable; they are filtered from receiving fitted AI ghosts that their old stat resolver would mis-simulate. Existing old clients cannot silently save over a nonstock fitted configuration without catalog support. Frozen AI tickets and PvP seats retain canonical mods/looks, stats and owned chassis variants; mid-match edits do not modify those snapshots. Class swaps keep the same portable fitting profile. Snapshot-bound proof uses derived effective HP/speed per class.

A confirmed interaction was fixed narrowly: ghost AI counterpicks formerly reset speed to bare class speed, losing module penalties while retaining damage benefits. Ghosts now retain their fitting speed delta when rebuilt; legacy non-fitted behavior is unchanged. A second regression covers fitted-ghost filtering for old Stock clients. Payments/referrals/LP accounting were not audited or changed.

The optional per-instance RNG seam accepts `HOST.seed` (integer) or `HOST.random` when constructing the actual shared simulation. Without either, ordinary combat uses Math.random as before. `game.js` and simulation setup use that instance source; instances do not alter global Math.random or each other's streams. This is a test seam only: no test range UI, point-free game flow or new public seed API was added.

## Changes by file

- `js/rules.js`: catalog, budgets, selectors, validation, visual projection, effective tank/power/metric resolution and spec version fields.
- `js/game.js`, `worker/sim-api.js`: instance random source, simulation setup randomness, visual roster metadata, ghost fitting-speed preservation. Combat goals/maps/counters remain intact.
- `worker/src/eco.js`, `worker/src/pvp.js`: capability checks, old-ticket compatibility, fitted ghost filtering; reuse canonical snapshot resolution.
- `js/match.js`, `js/pvp.js`: advertise fitting support; retain roster fitting visuals alongside effective speed/HP.
- `js/models3d.js`, `js/render3d.js`, `js/render.js`: procedural fitting shapes, fitting cache/spec identity, 2D/high/fallback previews and combat drawing.
- `js/ui.js`, `js/core.js`, `css/app.css`: editor fitting/style controls, live stats/preview and budget feedback; Garage/build stats reflect effective fitted stats.
- `dev/tests/wtest/modules.mjs`, `modules-battle.mjs`: catalog enumeration, baseline comparisons, deterministic trials and fitted PvP/proof/ghost regression paths.
- `dev/tests/modules-browser.py`, `modules-proofreal.py`: isolated actual browser save/reload/preview/graphics/fallback and fitted combat proof tests.
- `dev/tests/wtest/lab.mjs`: rules-version expectation and new authoritative fitted snapshot/legacy-client/ghost compatibility regressions.

## Tests actually run

All backend tests use existing isolated fake services; browser requests are intercepted to local source and an in-memory Worker stand-in. No production fallback. Logs and detailed trial JSON remain outside Git (`/tmp/lunar-session3-logs/`, `/tmp/lunar-session3-balance.json`). Screenshots are local test artifacts, not large committed output.

| Check | Observed result |
|---|---|
| `node dev/tests/wtest/modules.mjs` | PASS: all 27 combinations considered, 19 legal; invalid IDs/extra fields, budgets, stale revisions, two configs, separate cosmetic stats, optional seed repeatability; exact Stock `tankOf` baseline comparison against Session 2 across five health scales and same power; identical 600-step Stock simulation snapshots against Session 2 in all six modes under identical RNG streams |
| `node dev/tests/wtest/modules-battle.mjs` | PASS: fitted PvP room stats, legitimate class swap, detached snapshots and snapshot-bound proof contracts in all six modes; ghost counterpick cost regression |
| Paired seeded comparisons in that test | 36 completed representative matches: 3 seeds × 3 builds × Arena/Pulse/Scout, Zone/Twin/Vanguard, Survival/Siege/Titan, Last Standing/Pulse/Titan. Same-seed replay assertion passed |
| `python dev/tests/modules-browser.py` | PASS: real 320px editor preview, over-budget Save blocked, independent server saved configurations, equip/reload, stale responses, canonical start after another-device upgrade, six-mode captured equipment, 390px 2D/high views; separate fresh context with WebGL deliberately unavailable verified fallback and no page errors |
| `python dev/tests/modules-proofreal.py` | PASS: 7 completed actual-logic fitted browser simulations, including Arena between-round chassis changes; all seven proof records accepted, no page errors |
| `node dev/tests/wtest/test.mjs` | 189 passed, 0 failed |
| `node dev/tests/wtest/pvp.mjs` | 106 passed, 0 failed |
| `node dev/tests/wtest/lab.mjs` | PASS after updating the expected new rules label and adding fitted-authority/compatibility regressions |
| `node dev/tests/wtest/lab-battle.mjs` | PASS |
| `node dev/tests/wtest/lab-parity.mjs` | PASS: stock stats/rewards and six-mode proof contracts |
| JS syntax and `git diff --check` | PASS |

The economy/PvP/Lab suites ran after implementation; after the two confirmed ghost fixes, the relevant Lab and fitted battle regressions ran again. This was not a repeated general audit. The Session 2 farm reminder-batch failure is pre-existing, remains documented, and was not rerun or investigated because these changes do not touch reminders. Real Telegram/iPhone hardware, production Cloudflare rooms, payments and performance stress/load sweeps were not tested here. Browser high graphics uses this environment's software-capable Chromium, not phone GPU performance evidence.

### What the paired runs show

| Build | Runs | Wins | Mean simulated seconds |
|---|---:|---:|---:|
| Stock | 12 | 2 | 55.7 |
| Plates + stable mobility | 12 | 7 | 58.8 |
| Light hull + firing mount | 12 | 4 | 58.1 |

These small, AI-driven, seed-paired trials catch broken/reproducibility failures; they do **not** prove balance, enjoyment, retention or revenue. The heavy build's higher wins are a concrete follow-up signal. Its −9% driving speed remains real and shown, but may be undervalued by these controllers/maps. No single optimal build or equal win rate is claimed. Numbers remain the approved candidate catalog; broader human testing/balance decisions belong to later authorized work. No rewards/economy grants result from these tests.

## Preservation and next boundary

Session 3 is committed on the existing branch, with Session 2 as its parent. The final response provides the commit hash and the single verified standalone Git bundle containing both sessions. The bundle is verified and restored in an isolated clone; no push attempt is made. Temporary logs, simulator build output and secrets are excluded.

Session 4 remains unstarted: there is no free isolated range interface, trial history, blueprint/share surface, new purchases, extra slots or token/reward change. The seed seam and separated selectors are foundations for later authorized work. The functional/visual catalog, effective resolution and protocol notes in this report amend the Session 1 planning baseline for the implemented Session 3 scope only.
