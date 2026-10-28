# LUNAR: WAR MACHINES — MASTER OPERATIONS PLAN
Version: planning-v1 — October 28, 2026
Execution order: **01 → 02 → 03 → 04 → 05 → 06 → 07 → 08** (some design work overlaps; production releases remain gated)
Source: the eight files in this directory, which contain the detailed per-release checklists.

> This is the cross-file execution contract, not authorization to merge untested code, spend money, launch a token, move funds, or weaken anti-abuse/payment controls. Reconcile current GitHub state at the start of every execution session.

## North star and constraints
- **One actual game**: primary WEBSITE is the centerpiece with enhanced graphics and a complete playable experience; Telegram remains a full-featured connected version. iOS/Android are future release targets when funding permits.
- **One authoritative economy and player progression**, shared combat rules, six game modes, machines, ownership and achievements; do not duplicate backend logic per platform.
- **Two free, personal war machines per player**. Each has a distinct, stable identity, independent equipment and personal history. Free selection before matchmaking. v1 locks the chosen **entire machine for the entire match**; a later best-of-three switch, if chosen, must switch only between **both pre-registered complete builds**, with server/proof versioning and no arbitrary inventory swaps.
- Enjoyable gameplay and genuine loyalty must stand independently of prospective $LUNAR rewards. Prioritize sustainable retention, social play, fair monetization and the user's **75% development/operations/marketing/compensation + 25% publicly tracked token-liquidity** allocation, subject to transparent real-money accounting and applicable requirements.
- Preserve the existing audited/released Lab, 19 equipment items, anti-farm safeguards, referral system, economy and Workers; improve incrementally. Keep Moonbeam the best legendary, **not unbeatable**.

## Dependency map and release waves
```text
01 Locked battle roster (currently PR #5)
     |
     +--> 02 Machine Legacy (stable machine IDs) ------> 06 Community/social sharing
     |          |                                       |
     |          +--> 03 Web identity / account linking -+--> cross-platform friends
     |                     |
     +--> 04 Measurement/event contract (design starts during 02; ship after 03)
                             |
                             +--> 05 Leagues + Moonbeam fairness
                                      |
                             +--------+--> 07 Cosmetic-first monetization
                             |                       |
                             +-----------------------+--> 08 Token/snapshot/treasury release gate
```
Release 08 legal/compliance/treasury research begins now, **before** features depend on it; actual token-related operations happen only after all applicable gates. Native store distribution is a **later separate wave**, not a ninth unscoped current release.

## Shared contracts — define once and reuse across all eight files
1. **Identity**: eventual canonical, opaque server-issued `player_id` maps to verified Telegram login and separately authenticated website login; never trust claimed IDs, wallet addresses or unsigned URL parameters. Plan reversible, audited linking and recovery. Existing `tg_<id>` records must migrate with no lost or duplicated rewards.
2. **Machines**: preserve stable Lab machine IDs and immutable owner relation across rename, chassis/weapon changes, login migration and account linking. Two slots remain free. Version the Lab/Legacy model and support existing accounts.
3. **Match record**: server-verified `match_id` or existing nonce, `player_id`, `machine_id`, frozen **complete loadout**, `rules_version`, mode, verification outcome and end event. Both AI ticket/proof and PvP seat use the *same logical contract*. Exactly-once result accounting despite retries, disconnects and rematches.
4. **Rewards/analytics**: reward changes use authoritative atomic transactions; analytics consumes verified events with event IDs (not fabricated client reward numbers). Source-of-truth for cohorts, payments and airdrop remains server records, not local practice or browser cache. Minimize identifiers and keep private anti-farm fields inaccessible.
5. **Commercial ledger**: only confirmed, reconciled payments count; separately track payment fees, refunds, recognized revenue, distributable amounts and public liquidity contributions. Do not infer liquidity transfers from shop UI totals. No token value or investment returns promises.
6. **Compatibility**: additive versioned schema migrations; feature flags and rollback; retain old live match proofs until completed or expired. A web/native client must not change game economy or rules merely because it uses a different presentation layer.
7. **Device constraints**: build/test through GitHub + Codex without requiring the user to operate a desktop. An automated browser simulation is not proof of physical iPhone/Telegram or human fairness.

## Release 01 — `01-battle-roster.md` — MATCH IDENTITY
**Status:** already coded in PR #5; do not start over.
- Inspect *latest* PR #5 SHA and conflicts with `main`. Confirm the three required CI workflows pass on that exact SHA; then merge and independently confirm Pages + Workers + webhook + build health.
- Verify independent full-loadout machine selection in Play, server `lab_activate`, pending-selection race prevention, and stale revision/network error handling.
- Freeze chosen machine in both AI match-proof ticket and PvP seat; reject legacy class switching and forged/extra equipment in a match. Verify replay, reconnect, between-round, and rejoin behavior.
- Test 320/390/430 px, both Garage cards, guest practice, six modes, Lab, economy, PvP, farm and isolated Workers smoke.
**Outputs:** deployed battle roster; recorded release SHA; stable machine-selection contract for Release 02. **Gate:** no merge until complete required tests pass.

## Release 02 — `02-machine-legacy.md` — PERSONAL INVESTMENT
**Depends:** 01. Define fields with 03/04 compatibility in mind.
- Keep each machine's stable ID; introduce versioned, server-owned legacy records: matches, results, kills, damage, objectives, mode-specific bests and milestones.
- Freeze the selected machine ID on *each* AI proof ticket / PvP seat before battle. Update only from verified results using idempotent event IDs. Exclude unsanctioned tests from reward-bearing history.
- Migrate existing pilots without inventing historical per-machine wins; preserve names and gear. Handle refund/rollback, stale clients and reconnect.
- Add per-machine Legacy profile, progression, unlockable **cosmetic-only** achievements and share-safe rendering.
- Design analytics event names alongside this implementation; no dependency on later web login for Telegram rollout.
**Outputs:** `machine_id` + versioned legacy contract and UI reusable by 03, 04, 06 and 07. **Gate:** AI/live score parity; no spoofable records or duplicate awards.

## Release 03 — `03-website-identity.md` — ONE CROSS-PLATFORM PLAYER
**Depends:** stable 02 machine/legacy schema. Can design authentication before 02 finishes.
- Specify first-party authenticated web access and documented threat model; add securely minted sessions, revocation, abuse limits, recovery and server-mapped global player identity.
- Implement opt-in two-sided Telegram ↔ website account proof and conflict handling. **Never** credit unverified guest currency, old saves or copied Telegram IDs into a server account.
- Move the website from local-only ranked progression to authoritative server-backed saves, Laboratory, modes, referral account mapping and matchmaking; keep unauthenticated guest play explicitly unranked.
- Reuse common engine and core assets while adding higher-quality website-specific presentation incrementally. Preserve functional parity with Telegram; no forked game rules.
- Test independent browser/Telegram logins, linking/unlinking, concurrent edits, recovery, purchases, account takeover and duplicated grants.
**Outputs:** canonical identity + authentication interfaces for 04/06/07/08 and later native clients. **Gate:** security tests and migration tests before enabling paid/competitive web play.

## Release 04 — `04-product-analytics.md` — EVIDENCE BEFORE AD SPEND
**Depends:** 02 events and 03 canonical accounts (schema work starts alongside 02).
- Freeze a minimal versioned event taxonomy for acquisition, activation, match completion, customization, sessions, legitimate referrals, checkout, payment verification and refunds. Include platform, consented campaign and linked machine ID.
- Calculate true signup cohorts, mature D1/D7/D30 retention, return sessions, engagement, payer conversion, verified net revenue, player/payer revenue and acquisition costs from **consistent populations**.
- Replace sample-biased admin ratios; display cohort sizes, coverage periods, platform and campaign breakouts, refunds, and missing data instead of optimistic estimates.
- Test known synthetic cohorts, UTC boundaries, repeat events, cross-platform dedupe, event delay, fraud-exclusion policy and dashboard privacy.
**Outputs:** trusted optimization baselines for 05/06/07 and launch user-acquisition decisions. **Gate:** statistical definitions tested; no unverified promotional claims.

## Release 05 — `05-leagues-and-balance.md` — FAIR COMPETITION
**Depends:** 01 locked builds; 04 baseline measurement; 02 per-machine data enhances analysis.
- Re-enumerate legal equipment power states. Resolve documented max power ~240 vs Ace at 250 and unreachable upper leagues, separating skill rating from gear power and farming/airdrop points without silent reward inflation.
- Retest Moonbeam versus best Epic across the three chassis families, all modes/maps, different investments, counters, movement, super coverage and shot accuracy. It stays the strongest overall but must not feel mandatory.
- Run controlled seeded trials, live server/client parity and eventual real-player monitoring; do **not** treat bot win rate as proof of human fairness. Protect novice matchmaking and small-population queue health.
- Test level/reward migrations, all six modes, 19 equipment items, proof rules, PvP, current shop economics and snapshots.
**Outputs:** reachable rank system, documented equipment fairness, experiment metrics for later monetization. **Gate:** competitive/economy regressions and honest uncertainty log.

## Release 06 — `06-community-features.md` — ORGANIC GROWTH
**Depends:** 01 battle authority + 02 share-safe Legacy profiles; 03 for cross-platform identity; 04 for referral tracking.
- Ship in small increments: share a machine → friend 1v1 practice invite → mutual rematch → optional spectators/private rooms → parties for existing team modes → rotating weekly community challenges.
- Implement server-minted expiring invite links, authenticated participants, privacy and block/report options, idempotent join/reconnect flows.
- Keep friend farming from minting unlimited ranked/airdrop rewards. Reuse existing matchmaking and Quick Match to avoid fragmented low-concurrency queues.
- Measure invite-to-activated-player, friend retention, second-session lift and verified session value through 04.
**Outputs:** player-to-player community loops feeding 07 conversion and 08 real community eligibility. **Gate:** replay/abuse tests, explicit reward isolation, privacy and reconnection checks.

## Release 07 — `07-sustainable-monetization.md` — BUY IDENTITY, NOT VICTORY
**Depends:** 02 machine identity, 04 honest metrics, 05 fair competition; 03 for new cross-platform checkout.
- Audit existing Stars/TON/SOL purchases, Moonbeam, packs, pass and Vault; distinguish power-bearing inventory from cosmetics and disclose relevant odds, values and limitations.
- Prioritize machine-owned visual upgrades: bay themes, trails, decals, finishing effects, banners, collectible visual identity and seasonal collections. Previews apply to either machine; none change hitboxes/proof stats.
- Add server-owned entitlement grants, refunds/chargebacks, duplicate purchase rejection and clear cosmetic inventory. Preserve 75/25 ledger *after defined fees/refunds*, reconcile any treasury movement.
- Use measured conversion/retention and payer satisfaction, not assumed revenue gains. Review applicable Telegram, website, and future app-store payment policies before new checkout paths.
**Outputs:** sustainable optional revenue features plus verified ledger for 08. **Gate:** payment integrity, price disclosure, no deceptive scarcity or compulsory competitive purchases.

## Release 08 — `08-token-and-trust.md` — LAUNCH READINESS, NOT AUTOMATIC TOKEN DEPLOYMENT
**Depends:** 03 stable identity, 04 measurement, 05 fair rewards, 07 reconciled purchases; 06 helps grow community. **Legal/compliance and treasury diligence starts immediately in parallel.**
- Reconcile canonical wiki/tokenomics/supply, vesting, public LP wallet, top-1,000 cutoff, reward weighting, referral allocation (~250 distinct participants proposed), and verified 75/25 accounting; **do not invent a token percentage for the referral pool**.
- Define versioned eligibility/snapshot cutoff, player appeal, sybil/cluster treatment, transparent claim rules and reproducible read-only snapshot with checksums and independent review.
- Implement audited treasury/contract and claim proof work only with proper legal/security review, permission boundaries and explicit approval for any real fund transfers or chain deployment.
- Validate top-1000 ties, linked accounts, merchant refunds, duplicate claims, ledger reconciliation, unavailable DB/recovery and cross-platform consistency.
**Outputs:** transparent public launch checklist and tested reproducible records; no promise that token must launch by a date. **Gate:** technical, legal and security acceptance plus explicit user authorization for irreversible actions.

## Release discipline applied to every file
1. **Read** the master and the numbered brief, inspect current main/PRs and latest tested deployment. Continue existing work; never re-audit all files by default.
2. **Define contract** and create a *single focused feature branch / PR* for that release. Avoid bundling later changes, rewrites or currency changes into unrelated PRs.
3. **Implement in checkpoints:** schema and server authority → client flow → migrations and compatibility → focused regression tests → visual/interface checks → observability.
4. **Validate on latest PR head**: relevant syntax/unit/economy/PvP/farm/false-proof, all six modes, 320/390/430px touch screens, client/server parity, and actual isolated Workers runtime; payment/security/identity tests when relevant. Do not bypass checks to deploy.
5. **Deploy safely** through existing approved GitHub Workflows only when mandatory tests are green. Record PR, commit, backend/frontend versions, health checks and what remains untested (e.g. real authenticated iPhone, human competitive balance). Roll back on verified regressions.
6. **Handoff**: record completed files, changed schema, API contracts, test evidence, deployment status, open risks and the precise next release. Treat all numbered files as the next executor's source of truth.
7. **Budget/time**: prioritize existing infrastructure; minimize new providers, ad spend, manual user tasks and repeated tests. Do not silently incur cloud/billing liabilities.

## Next execution session — exact starting checklist
- Read `docs/implementation/00-master-operations-plan.md` and `01-battle-roster.md`; inspect PR #5 (not an older branch snapshot) and current `main` first.
- At the time this plan was drafted, PR #5 was **open and mergeable** with Battle Roster and Laboratory checks passing and the longer Equipment Balance workflow still in progress. **Recheck** all CI on the current head; no claim that production is deployed.
- Finish Release 01 without rebuilding it. Fix only failures discovered, use the current branch, merge after required checks pass, and confirm production asset/build, Workers health, and Telegram webhook.
- Only then open a **separate** Release 02 Machine Legacy branch; incorporate shared event/identity contract definitions so Release 03 and 04 can consume them without reworking machine history.
- Proceed one verified release at a time: 03 → 04 → 05 → 06 → 07 → 08. Share one concise status/handoff per release.
