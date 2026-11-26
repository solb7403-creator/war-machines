# LUNAR: War Machines — Conquest flagship execution handoff

**Status (2026-11-10, afternoon): Session 5D Fair Arcade + desktop driving + 5C leftovers RELEASED — PR #103 merge `e1a8ffa`, live build `20261110101106` (health ok, version = repo); read Checkpoint 30.** **Earlier (2026-11-10): Session 5C base UX + "your town in the world" RELEASED — PR #94 merge `7a81b35`, live build `20261110004649` (health ok, version = repo); read Checkpoint 29.** **Earlier (2026-11-09): Session 5B Town Defense RELEASED — PR #90 merge `c2dafb6`, live build `20261109074525` (health ok, version = repo); read Checkpoint 28.** **Earlier (2026-11-08, night): Session 5 RELEASED — PR #75 merge `7ebb2bc`, live build `20261108210830` (health ok, version = repo); read Checkpoint 24.** **Earlier (2026-11-07, evening): Conquest graphics overhaul RELEASED — PR #59 merge `b59ae99`, live build `20261107151435` (health ok, version = repo); read Checkpoint 21.** **Earlier (2026-11-07): owner playtest fixes RELEASED — PR #57 merge `7772d28`, live Worker build `20261106233738` (health ok, version = repo), Pages from `7772d28`; read Checkpoint 20. Earlier status (2026-11-06): RELEASED. Session 1 (PR #53, merge `f6305ab`) and Session 2 (PR #54, merge `185e316`) are on `main` and deployed: Worker build `20261106055908` (live `/pvp/health` ok, live version = repo), GitHub Pages client from `185e316`. Payments DISABLED. Physical iPhone/Telegram and owner hands-on acceptance happen now in production (owner playtest environment, no live players yet). Read Checkpoint 19 in IMPLEMENTATION_CHECKPOINT.md before continuing; new work starts on a fresh branch from `main`.**
**Last verified game release at preparation:** main `d592146dfca5ea389507ec8cd51b8cc28e1eb2f5`, Conquest 3.3 / version `20261105034106`. Always query GitHub for the NEW latest state first. Do not treat this snapshot as live status after development starts.

## Complete owner-approved specifications

These are the **complete unabridged implementation briefs**, preserved in GitHub so Codex, Claude Code or another authorized agent can resume without relying on a chat or attached file:

1. [Session 1 — Living War](SESSION_01_LIVING_WAR_FULL_CODEX_PROMPT.txt): playable dense first war region, functioning mission/encounter loops, Moonbeam and heat rescue, 45–75 minute first real Command Base, rewarded progression and server safety.
2. [Session 2 — Territory, raids, community, endgame and commerce](SESSION_02_TERRITORY_ENDGAME_COMMERCE_FULL_CODEX_PROMPT.txt): 25+ genuinely playable raids, evolving territory, base defense, long-term progression, social campaign, cosmetics/commerce with secure entitlements.

Owner explicitly authorized safe code changes, merges and deployments without redundant approvals, but **not** activating uncertified payments, changing token/airdrop contracts, incurring paid services or touching real player data for tests. The specifications, not a summary, govern content. Their session numbers are **logical workstreams**, not a promise that all code will fit a certain agent quota or runtime.

## Owner rules, Nov 25, 2026: gameplay quality first + guardrails (permanent, owner-approved)

Recorded word for word in Session 7R (brief `docs/conquest/audit/SESSION_07R_BRIEF.md`; also in `docs/owner-rules.json` `rules`). These are additional development rules: they add to every existing owner-approved rule, and no existing owner-approved rule is ever removed or weakened. They bind every session, every delegated agent and every review. `dev/tests/owner-rules.mjs` fails the build if this text is removed or changed in any governing file. Only the owner can change them or authorize an exception.

### Rule 1 (owner, Nov 25, 2026)

I just realized something fundamental, which absolutely infuriates me because it means you've been approaching gameplay development incorrectly this entire time. Your tests have been primarily establishing whether progression follows predetermined mathematical targets, not whether progressing is enjoyable.

How in the hell is that working toward making an addicting game?! What you've been doing is potentially achieving the opposite by making gameplay feel robotic, predictable, and stale.

Going forward, your primary objective when evaluating gameplay must be establishing whether playing and progressing through the game is genuinely enjoyable, alongside your existing mathematical and technical tests.

Automated simulations and mathematical targets are important validation tools, but they are NOT proof of enjoyable gameplay. Evaluate combat satisfaction, meaningful player decisions, progression satisfaction, encounter variety, strategic depth, pacing, player freedom, replayability, and the desire to continue playing. Clearly distinguish simulated results from actual playtesting. Never invent evidence of enjoyment or sacrifice enjoyable gameplay merely to satisfy a predetermined progression curve.

Mathematical targets should support enjoyable gameplay, not dictate it. That is fundamental to making an exceptionally fun and addictive game.

Every game mode, mission, raid, operation, and gameplay system must feel substantial, thoughtfully designed, and complete. Simply implementing functional mechanics is not enough. Nothing should feel half-assed, rushed, shallow, repetitive, or artificially shortened.

Mission design must consider travel distances, environmental variety, enemy variety, encounter progression, objective depth, unpredictability, challenge, tactical decisions, and overall enjoyment. Travel and mission duration should be meaningful, not excessively short or artificially prolonged with empty travel or repetitive filler.

There must be a vast variety of genuinely distinct missions, with varying travel distances, durations, difficulty levels, objectives, scale, and complexity. Some should be short and easy, others long and exceptionally challenging, with everything in between. Rewards must be appropriately proportional to the time, effort, difficulty, and risk involved in completing them. Different missions must offer genuinely different experiences, not simply variations of the same repetitive encounter.

Players must have meaningful freedom over what they pursue, how they fight, how they develop their capabilities, and how they progress. Avoid unnecessarily forcing every player through an identical gameplay experience.

Replayability must be a fundamental design priority. Repeated activities must offer sufficient variation, unpredictability, strategic depth, and opportunities for mastery to remain enjoyable even after numerous completions.

Every gameplay system must complement and meaningfully interact with other relevant systems. Conquest must feel like one immersive, interconnected, evolving war, not a collection of disconnected missions, menus, timers, and activities.

Do not confuse feature completeness with gameplay completeness. Every implemented system must ultimately justify its existence through the quality of the experience it provides and how effectively it contributes to the overall game.

The end goal is to make LUNAR at least as enjoyable as, and preferably more enjoyable than, the best competing games in its respective categories. Research successful comparable games, understand what makes their gameplay enjoyable, and strive to meet or exceed that standard while maintaining LUNAR's unique identity.

LUNAR is intended to generate significant, sustainable revenue by building a large, loyal, highly engaged player base that genuinely enjoys the game and actively wants to spend money to benefit, enhance, and expand their gameplay experience. Monetization must provide meaningful value and complement enjoyable gameplay rather than deliberately making gameplay frustrating to encourage purchases.

Fortunately, ChatGPT's preliminary inspection of the repository found no evidence that Conquest's foundation is irreparably bad. The underlying systems appear sufficiently developed to support substantial gameplay refinement without starting over.

Also, there should NOT be a seven-day waiting period between Parasite Citadel attacks. The cooldown should be a matter of hours, with 24 hours being the absolute maximum, if a cooldown is even necessary. Progression should primarily be limited by genuine difficulty, skill, preparation, and player strength, not arbitrary waiting periods.

Permanently record these instructions as additional development rules in CLAUDE.md, AGENTS.md, docs/owner-rules.json where applicable, and all other relevant governing instruction files within the repository. Preserve their full meaning and enforceability. Do not remove or weaken existing owner-approved rules. Commit these instruction updates to the repository and verify that they have been correctly recorded.

These are strict, mandatory requirements, not suggestions, optional recommendations, or temporary session-specific instructions.

These rules must be read, followed, and enforced throughout every future coding session, gameplay design decision, implementation, review, test, and refinement. Any delegated agents must also follow them. Do not silently reinterpret, weaken, override, or disregard these requirements. Only I can authorize changes or exceptions to them.

### Rule 2: guardrails, permanent (owner, Nov 25, 2026)

Do not automatically adjust guardrail thresholds to match new simulation results. Investigate failures and only adjust thresholds when independently justified by the approved gameplay change, without masking genuine problems. Document the reasoning and continue autonomously.

## Product acceptance is player-experience first

- Every 1–3 minutes in the populated opening region, a player should have an actual meaningful choice, encounter or world event. Enemies must be visible, hostile when appropriate, and credibly garrisoned/deployed from bases. No empty world disguised by task menus.
- Fight -> salvage -> safely bank -> build/upgrade -> capture/defend -> stronger threats. Progress must improve actual combat and visibly expand a physical Command Base; first base achievable after approximately 45–75 minutes of ordinary modeled gameplay.
- Moonbeam is a premium legendary weapon. Its normal shots must be *fun*: at least **20 actual consecutive shots** before first overheat with representative legal loadouts, visibly incremental heat/cooling bar, quality laser bolt and Moonfall Super. No 3–4-shot failure, instantly jumping meter or giant blue ball. The other weapons, Dash, Shield, projectile velocity/range and earned engineering require real play and tests.
- Persistent earned progress and protected ownership; no enemy power equalization against the player's loadout. No fake rewards, pretend PvP, fake availability, fabricated test results, fake payment processing or pressured monetization.
- Premium incentives should provide transparent permanent value, and purchases must have real provider verification or be visibly disabled. Gameplay is not held hostage to unsafe payments.
- Preserve canonical account/auth, Arcade/PvP/economy, existing Conquest progression, owned inventory, points/airdrop balances and 50% carried-material loss/600-second owner-only wreck behavior. New fields migrate safely; no per-player client reward claims.

## Zero-loss checkpoint protocol — mandatory from first code change

Codex and Claude cannot directly read each other's private/ephemeral working state. The **GitHub branch and committed files are the only durable handoff**. To avoid losing work to time, quota, context or app interruptions:

1. Verify current `main` SHA and inspect open Conquest PRs/branches before coding. **Never overwrite another agent's active branch.** First agent creates `feat/conquest-living-war-v1`; finalization work uses `feat/conquest-flagship-final-v1` only after Session 1 is integrated. If these branches already exist, inspect and resume their actual HEAD instead of starting over.
2. **After each complete, testable vertical slice** (combat/thermal, live garrisons, meaningful mission/reward, physical base, economy, raids, payment-disabled catalog), commit and push changes to the SAME working branch. Ideally a push after each 1–2 meaningful feature groups, not after 40 files at the end. Each commit should compile and have its targeted tests run when possible. Do not create a new coding session/branch for every defect.
3. Create/update `docs/conquest/IMPLEMENTATION_CHECKPOINT.md` on the active task branch at EVERY checkpoint, with:
   - date and exact branch/commit SHA (from GitHub, not assumed)
   - completed player-visible behavior and actual proof
   - remaining MUST-HAVES copied/linked to exact numbered requirements in the full briefs
   - tests run and failures, deployment state, safety/commerce blockers
   - active file paths, schema changes/migrations, pending merge conflicts
   - exact next 1–3 coding tasks and how to resume without repeating finished work
4. Treat session interruption as normal. If Codex stops, Claude reads this file plus latest GitHub PR/commit history and continues from that point. It must NOT regenerate the game from the original brief, redo completed systems, dismiss uncommitted work as complete, or merge conflicting work blindly.
5. **Never assume uncommitted/unpushed changes are accessible to Claude.** If the first agent did not push, its private edits cannot be recovered from GitHub; tell the owner accurately. Owner can ask the paused coding agent to commit/push its workspace before changing agents, when available.
6. Keep one consolidated PR per logical workstream; deploy validated user-visible vertical slices only when they are independently coherent and safe. Preserve the remaining scope in checkpoint; do not call a partial release the finished Conquest flagship.
7. Use Graphify only when connected, with indexed-commit freshness checked; read actual current branch source and focused tests. Graphify does NOT share unpushed workspace state or execute code.
8. Before declaring success, run **actual authenticated browser-to-Worker game journeys** and compare screenshots/interaction at iPhone portrait sizes + fallback. Merged/CI-passing code with empty gameplay is not a success.

## Agent takeover instructions (pasteable)

```text
Continue LUNAR: War Machines Conquest from GitHub, not chat memory. Repository solb7403-creator/war-machines. Read docs/conquest/CONQUEST_FLAGSHIP_EXECUTION_HANDOFF.md, BOTH complete source briefs under docs/conquest/, AGENTS.md, CLAUDE.md and the newest docs/conquest/IMPLEMENTATION_CHECKPOINT.md if present. Inspect latest main, Conquest PRs, branch HEAD and CI/deploy state. Resume the exact next unfinished requirement on the existing active branch or a new branch from its properly merged baseline; do not redo completed work. Follow the zero-loss checkpoint protocol: commit/push coherent progress frequently and update IMPLEMENTATION_CHECKPOINT.md with tests, remaining tasks and next action. Prioritize actually playable, rewarding, living Conquest over prose/boilerplate. Never enable uncertified real payments, falsify tests or break player ownership. Owner has approved safe tested implementation, merges and deployment. Start implementing immediately.
```

## Progress ledger

- [x] Both complete flagship briefs archived in GitHub.
- [x] Cross-agent continuation and checkpoint protocol added.
- [x] Session 1 code implemented, tested and deployed (PR #53, merge `f6305ab`, live build `20261105164144` at merge time; superseded by `20261106055908`).
- [x] Session 1 documented in `IMPLEMENTATION_CHECKPOINT.md` and merged/deployed.
- [x] Session 2 code implemented, tested and deployed (PR #54, merge `185e316`, live build `20261106055908`, deploy run 42175258409; Pages run 42175257429).
- [x] Owner iPhone/Telegram playtest fixes (driving netcode/camera/streaming, NAVIGATE + beacons + YOU marker, fast travel, raid unlock + enemy-only raid difficulty, remote base command + RECALL) implemented, reviewed by two independent reviewers and deployed (PR #57, merge `7772d28`, live build `20261106233738`, deploy run 42339335756, Pages run 42339335410). See Checkpoint 20.
- [x] Conquest graphics overhaul (Neon Frontline art direction, presentation only) implemented, independently reviewed and deployed (PR #59, merge `b59ae99`, live build `20261107151435`, deploy run 42412566891, Pages run 42412565867). See Checkpoint 21; physical iPhone look/performance pending (owner playtest).
- [ ] World, Resources & Airdrop Points session (branch `claude/friendly-allen-7tcyca`): Phase 0 economy spec signed off (`docs/economy/RESOURCE_ECONOMY.md`, model `dev/tools/economy-model.mjs`). Phase 1 (Conquest airdrop points, base multiplier, Daily Base Yield, 50,000 shared cap) and Phase 2 (authored terraform zones, creek/fords/bridge/reservoir, forest cover, bio-flora Biomass) pushed; Phase 3 (minerals, deposits, Meteor Strike, Arcade/PvP drops, Hull Plating) pushed; next: two independent reviews and release. See Checkpoint 22.
- [x] World, Resources & Airdrop Points (session 4: economy, airdrop points, minerals, Hull Plating, terraform rework, frontier colony) merged and deployed (PR #69, merge `a3ee186`, live build `20261108113127`, deploy run 42509975811, Pages run 42509974707). See Checkpoint 23.
- [x] Session 5: base builder (own plot + site choice, real timers, walls/turrets, Defense Drill), banners/visits/Base of the Week, Conquest Command hub, settler architecture + terraform life + region map, ore veins run dry, Nov 8 playtest fixes. Independently reviewed and deployed (PR #75, merge `7ebb2bc`, live build `20261108210830`, deploy run 42525835067, Pages run 42525834076). See Checkpoint 24.
- [x] Session 5B Town Defense: growing town (CC1 45×45 → CC10 77×77), 7 sites, vitals, settler homes, composite + Foundry + ore-blend walls (600→2,000 + earned extensions), wall tools, 11 turrets, whole-town raid engine + replay, balance model, owner addendum (persistent damage + repair, defense rating, layouts, refunds, Session 7 hooks). Two independent reviews; deployed (PR #90, merge `c2dafb6`, build `20261109074525`, deploy run 42584500684, Pages run 42584500218). See Checkpoint 28.
- [x] Session 5D Fair Arcade + desktop keyboard driving + 5C leftovers: the league sets the arcade AI (authored power per league, hard cap 165, never above the pilot, bounded gear adjustment), AI supers under the player's rules plus a league spacing, ghosts and live-room fill-ins never copy a human; desktop keys (focus, prompts, right Shift, taps, key hint) and the frame-clock fix for slow computers; Home Sector spawn, sliced hub towns, BUILD at PEEK, lit card sprites. Merged and deployed (PR #103, merge `e1a8ffa`, live build `20261110101106`, deploy run 42851674319, Pages run 42851667175). CI 9/9; two reviews + a delta review. See Checkpoint 30; physical iPhone and Telegram Desktop playtest pending.
- [x] Session 5C base UX + your town in the world: Home Sector (drive your tank inside your own town from the Command Gate portal; build mode is a camera), pad diorama of the real town in the gate courtyard, HUD thumbnail, hub hero town, draggable bottom sheet (PEEK/HALF/FULL), tabs HOME · BUILD · WEAPONS · WALLS · DEFEND with model sprites, town names, 3D share card; owner-gate Max visual pass of Section D (2 fix rounds, per-capture verdicts) and two fresh independent reviews (rendering/perf/security + Section D, UX/accessibility) all fixed. Merged and deployed (PR #94, merge `7a81b35`, live build `20261110004649`, deploy run 42735209687, Pages run 42735207022). Local: node 60/60, browser 7/7; CI 9/9. See Checkpoint 29; physical iPhone playtest pending.
- [ ] Full flagship acceptance: release verification passed (CI, deploy health/version, Pages); physical iPhone/Telegram and owner hands-on acceptance still pending in production.

**Update this ledger with grounded GitHub links and test evidence as work progresses.** Never check an item solely because a model reports it without code, tests and real gameplay proof.

## Non-negotiable final gameplay smoothness

The owner requires **immensely smooth** Conquest gameplay. Read and satisfy [SMOOTHNESS_PERFORMANCE_ACCEPTANCE.md](SMOOTHNESS_PERFORMANCE_ACCEPTANCE.md) in both sessions. This adds real-time touch responsiveness, target 60-FPS smoothness on modern iPhones, dense raid stress tests, authoritative non-jarring prediction/reconciliation, mobile frame/memory profiling and honest physical-device verification. A 30-FPS stability fallback for older devices is not permission to ship stuttery experiences on capable phones. Do not defer all performance to an optional third polish session.
