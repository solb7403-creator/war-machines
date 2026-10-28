# LUNAR: War Machines — Operations Plan
**Baseline:** 2026-10-28 | **Status:** Planned execution; feature 01 coded in PR #5, not merged.  
**Canonical game vision:** primary website = enhanced full game; Telegram = fully featured connected game; iOS/Android = future distribution when financially practical. All use shared authoritative accounts, combat rules, economy, two personal machines, six game modes, farming/quests, PvP and eventual $LUNAR ecosystem. No separate incompatible games.

## Mission and guardrails
Create a game worth playing without financial incentives, with personal machine identity, fair repeatable competition, organic community growth and sustainable revenue. The token launch is a planned outcome of a loyal, real player community—not a substitute for product-market fit. Preserve the publicly described 75% operations/development/marketing / 25% liquidity allocation, subject to transparent net accounting and legal review. No unauthorized financial transfers, token issuance, store purchases, deletions, production credential changes, or airdrop launches.

## Source of truth
- Implementation briefs and operation checklists: files 01–08 in this directory. Do **not** create unrelated new systems if an existing rule can be reused.
- Live game: https://solb7403-creator.github.io/war-machines/
- Authoritative game: `js/rules.js`, `js/game.js`, Workers `worker/src/eco.js`, `worker/src/pvp.js`, `worker/src/index.js`.
- Laboratory: `js/battle-roster.js`, `js/ui.js`, `js/core.js` and server-owned Lab state.
- Tests: `dev/tests/battle-roster.mjs`, `dev/tests/lab-ui.mjs`, `dev/tests/gear-balance.mjs`, `dev/tests/gear-combat.mjs`, `dev/tests/wtest/`, and actual Workers smoke.
- PR #5: https://github.com/solb7403-creator/war-machines/pull/5

## How to execute EVERY file (mandatory)
1. **Baseline:** read current main, relevant file, related current data and prior release status. Confirm no duplicate implementation; list dependencies, current behavior and only the actual gap.
2. **Contract:** document precise player-facing behavior; backend authority; backward-compatible state/schema; ownership, role, power and reward implications; affected payment/platform rules. Name known unknowns. Avoid scope creep.
3. **One task / one branch:** feature branch from current `main`, focused commits; new or updated tests included in same PR. Don't mix unfinished systems or expose half-implemented buttons.
4. **Build vertical slice:** schema + authoritative server logic first where needed; front end, accessibility and 320/390/430px layouts second; support Telegram and web without forking simulation.
5. **Verify:** targeted regression; required economy (189), PvP (106), farm (49), Lab/frozen proof, all six modes; Workers simulator and runtime smoke for backend changes; no test weakening, no phantom account/payment state.
6. **Threat and fairness review:** client cannot award itself points, tokens, achievements, inventory, referrals or purchases. Check malformed input, retries, replay, concurrency, migration, false positives and privacy.
7. **Release gate:** review exact diff, check CI green, merge only when permitted, let established Pages/Workers workflows publish, verify live frontend version and /pvp/health, avoid writes to real player records during smoke tests.
8. **Measure and decide:** monitor new errors, active users, retention, game balance and purchases. Keep rollback commit/path and stop introducing features when stability regresses. Log actual deployed SHA and unresolved limitations.

## Execution order and dependencies
| Wave | File | Primary deliverable | Prerequisites / gate |
| --- | --- | --- | --- |
| 1 | 01-battle-roster | Two registered complete machines, one frozen build per match | PR #5: all checks green, production verification |
| 2 | 02-machine-legacy | Per-machine trusted history, mastery and showcase | 01 stable; server match ID and machine identity frozen |
| 3 | 03-website-identity | First-party web accounts; one shared progression | 01 and 02 data versioning; account-security design review |
| 3 (parallel) | 04-product-analytics | Accurate all-player retention/payment cohorts | Event schema first; baseline before paid ads or big feature claims |
| 4 | 05-leagues-and-balance | Reachable divisions; legendary fair; matchmaking quality | 01 launch data and 04 tracking; economic reward review |
| 5 | 06-community-features | Private challenges, teams, machine sharing | 02 machine profiles, 03 identities when web enabled, 04 metrics |
| 6 | 07-sustainable-monetization | Cosmetics, seasonal expression, audited sales | 02/04/05, payment-platform review, instrumented experiment |
| 7 | 08-token-and-trust | Snapshot/claim integrity and treasury audit | 03/04/05/07, anti-sybil and independent legal/security sign-off |

**Parallel work:** Event-schema planning for 04 starts immediately even if 03 ships first. Token governance/legal review for 08 starts early; do not wait for launch week. The roadmap uses gates, not assumed calendar deadlines.

## Release gates by risk class
- **Combat/economy:** full engine parity, PvP authority, all six modes, AI proof, rewards/leaderboards unchanged unless explicitly approved.
- **Authentication/identities:** security design review, staging only first, positive+negative auth/link/unlink/migration tests, account recovery.
- **Payments/airdrops:** verified server ledger, idempotency, refunds, external platform/legal review, explicit owner go/no-go. Never auto-transfer liquidity or tokens.
- **Growth:** reliable D1/D7 cohorts and source attribution before increasing ad spend.

## Practical follow-up protocol
For each step, give Codex the exact path of the corresponding file and ask it to implement **only the next unchecked phase** against latest `main`. Require a final report with changed paths, test counts, risks, PR, deployment SHA and next gate. The owner reviews player-facing decisions and financial/legal launches. Completed tasks must update this file and their phase checklists.
