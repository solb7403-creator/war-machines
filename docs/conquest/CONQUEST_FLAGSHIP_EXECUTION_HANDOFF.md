# LUNAR: War Machines — Conquest flagship execution handoff

**Status (2026-11-06): RELEASED. Session 1 (PR #53, merge `f6305ab`) and Session 2 (PR #54, merge `185e316`) are on `main` and deployed: Worker build `20261106055908` (live `/pvp/health` ok, live version = repo), GitHub Pages client from `185e316`. Payments DISABLED. Physical iPhone/Telegram and owner hands-on acceptance happen now in production (owner playtest environment, no live players yet). Read Checkpoint 19 in IMPLEMENTATION_CHECKPOINT.md before continuing; new work starts on a fresh branch from `main`.**
**Last verified game release at preparation:** main `d592146dfca5ea389507ec8cd51b8cc28e1eb2f5`, Conquest 3.3 / version `20261105034106`. Always query GitHub for the NEW latest state first. Do not treat this snapshot as live status after development starts.

## Complete owner-approved specifications

These are the **complete unabridged implementation briefs**, preserved in GitHub so Codex, Claude Code or another authorized agent can resume without relying on a chat or attached file:

1. [Session 1 — Living War](SESSION_01_LIVING_WAR_FULL_CODEX_PROMPT.txt): playable dense first war region, functioning mission/encounter loops, Moonbeam and heat rescue, 45–75 minute first real Command Base, rewarded progression and server safety.
2. [Session 2 — Territory, raids, community, endgame and commerce](SESSION_02_TERRITORY_ENDGAME_COMMERCE_FULL_CODEX_PROMPT.txt): 25+ genuinely playable raids, evolving territory, base defense, long-term progression, social campaign, cosmetics/commerce with secure entitlements.

Owner explicitly authorized safe code changes, merges and deployments without redundant approvals, but **not** activating uncertified payments, changing token/airdrop contracts, incurring paid services or touching real player data for tests. The specifications, not a summary, govern content. Their session numbers are **logical workstreams**, not a promise that all code will fit a certain agent quota or runtime.

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
- [ ] Full flagship acceptance: release verification passed (CI, deploy health/version, Pages); physical iPhone/Telegram and owner hands-on acceptance still pending in production.

**Update this ledger with grounded GitHub links and test evidence as work progresses.** Never check an item solely because a model reports it without code, tests and real gameplay proof.

## Non-negotiable final gameplay smoothness

The owner requires **immensely smooth** Conquest gameplay. Read and satisfy [SMOOTHNESS_PERFORMANCE_ACCEPTANCE.md](SMOOTHNESS_PERFORMANCE_ACCEPTANCE.md) in both sessions. This adds real-time touch responsiveness, target 60-FPS smoothness on modern iPhones, dense raid stress tests, authoritative non-jarring prediction/reconciliation, mobile frame/memory profiling and honest physical-device verification. A 30-FPS stability fallback for older devices is not permission to ship stuttery experiences on capable phones. Do not defer all performance to an optional third polish session.
