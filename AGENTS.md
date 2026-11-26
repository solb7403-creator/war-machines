# LUNAR: War Machines — shared instructions for AI coding agents

This file is the common engineering contract for Codex, Claude Code and other authorized agents. Read it before editing. Claude Code also reads `CLAUDE.md`; that file points here. Read `docs/AI_TOOLCHAIN.md` for tool setup and handoffs.

## Project reality
- This is an existing production-oriented, phone-first web/Telegram game, **not** a greenfield React app. Preserve the current architecture.
- Browser/game: global-scope JavaScript in explicit load order (`index.html`, `web/boot.js`), canvas HUD, Three.js 3D with 2D fallback. Render code: `js/render3d.js`, `js/models3d.js`, `js/equipment3d.js`, `js/environment3d.js`, `js/graphics.js`, `js/showroom.js`; the Arcade maps and their chase camera: `js/arena3d.js`, `js/arenaprops.js`, `js/mapenv.js`, `js/arenacam.js` (loaded with the 3D engine by `load3D`, not in the page's script list). Current shared PBR atlas: `js/assets/hf-v1/manifest.json`.
- Rules and shared simulation: `js/rules.js`, `js/game.js`. Cloudflare Worker/Firebase server-authoritative economy and combat live in `worker/`. Conquest code spans `js/conquest/`, `worker/src/`, and corresponding tests.
- Begin with `dev/README.md`, existing workflows in `.github/workflows/`, and relevant `docs/` before assuming dependencies or designing replacements.

## Owner-control and safety gates
1. Work on a **new feature branch**, not `main`. Open a PR. **Never merge, deploy, publish, change live data, or activate payments without fresh explicit owner approval.** A passing CI run is not deployment approval.
2. Do not alter gameplay stats, inventory ownership, currency, purchases, server-authoritative economy, PvP integrity, Conquest progression, referrals, or existing gear entitlements as a side effect of visual/tooling work.
3. Keep existing player flows working on iPhone, Android, desktop browsers and Telegram Mini App. Preserve responsive HUD/input, accessibility, HIGH/LOW/2D fallback and context-loss behavior.
4. Never commit keys, tokens, private credentials, generated customer data or production database snapshots. Use local fixtures and isolated test endpoints.
5. Do not run destructive commands, install paid services, incur paid API/GPU charges, or invoke third-party reverse engineering outside owned/authorized targets without approval.
6. **Owner rules (owner, Nov 16 2026):** `docs/owner-rules.json` pins the owner-decided numbers (DAILY_CAP, CQ_PTS, quest rewards, LG_MULT, the Sortie chain, the research rules) and the guard-test limits. **Only an owner-decided prompt may change that file**; `dev/tests/owner-rules.mjs` (its own workflow, every pull request) fails the build when code or a guard test drifts from it, a CP source or sink is added, or code hides after a `//` comment.

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

## Efficient, accurate agent workflow
1. Identify the current branch and commit; inspect only the relevant entry points, function definitions, dependencies and nearby tests before editing.
2. **Use Graphify first when available for nontrivial coding tasks.** Verify that `solb7403-creator/war-machines` is ready and check its indexed commit against the current branch (`list_repositories` / `graph_stats`); then use targeted symbol search, file ranking, callers/impact and linked-test lookup to scope edits before reading large files. The ChatGPT Graphify plugin can also serve Codex; Claude Code has the shared remote MCP configuration in `.mcp.json` (individual OAuth authorization may still be required). If tools are unavailable, proceed using current GitHub source. A graph may be stale or incomplete and never replaces tests, authoritative source or owner approval; don't repeatedly query the same unchanged graph.
3. Use targeted file reads/patches; avoid dumping the whole repository into the model. Repomix and Serena are optional tools, not mandatory dependencies.
4. Each independent Claude/Codex task gets its **own branch**. Neither agent writes to the other's branch. A GitHub issue defines scope; PR description records changed files, test evidence, review concerns and a precise handoff. Only one actor pushes to a branch at a time.
5. Re-read the branch/PR head before continuing. Don't assume another agent's changes are present, that a branch is merged, or that another agent ran tests.
6. Run the smallest relevant checks first and existing broader CI when warranted. Report exact commands/results; never claim a test passed without executing it or observing its CI result.
7. Provide a short outcome: implemented, pending, tests, known limitations, changed branch/PR, and owner decisions required.

## Agent rule — quality first, usage justified (owner rule, Nov 5 2026)
Applies to Codex, Claude Code and every other agent, including how many subagents a session runs. The owner-control and safety gates above still apply.
1. One **LEAD** agent owns the branch. Only the lead edits shared code, commits, pushes, merges and deploys.
2. Use parallel agents **only** for these, because they measurably raise quality:
   - **Independent review:** before every merge, 1 read-only reviewer that is NOT given the lead's conclusions, only the branch, head SHA, briefs and checkpoint. For economy, payments, entitlements, rewards or combat balance changes, use 2 reviewers: one on security/economy, one on gameplay/performance.
   - **Visual options:** for any new look (3D models, UI screens, VFX, maps, HUD), 2–3 agents each build a distinct option in separate files. The lead compares screenshots at 320/390/430 portrait plus desktop and picks the best or combines the best parts. Unused options are deleted.
   - **Independent workstreams:** tasks with zero file overlap (e.g. Blender assets, test harnesses, docs/evidence) may run in parallel. Each agent is told exactly which files it owns and may not touch others.
   - **Verification fan-out:** Chromium/WebKit journeys, viewport matrices, long regression suites and soak runs may run in parallel.
3. **Never parallelize:** work in the same files or tightly coupled systems (combat sim, economy reducers, server authority, shared state), sequential steps (fix → test → merge → deploy), or any task one agent finishes in under ~15 minutes.
4. **Limits:** max 4 agents active at once. Give each a tight brief (goal, files, acceptance test, output format) so it doesn't re-explore the repo. Subagents report back; they never redo the lead's finished work.
5. At the end of every session, report: agents used, what each delivered, and whether it changed the result (e.g. "reviewer found 2 blockers", "option B chosen"). Agent types that don't change results get dropped next time.

## Owner messages mid-session (owner rule, Nov 8 2026)
1. Acknowledge every owner message sent during a session in your very next reply, in one or two lines: what you will change and when. Never continue silently past one.
2. Owner direction sent mid-session overrides the original prompt and the current plan. Fold it in before continuing; if it changes something already built, redo that part before release.
3. A status question from the owner gets a direct answer before any other work.
4. Never merge or deploy while an owner request in the session is unanswered or unimplemented.

## Every screen fits or scrolls (owner rule, Nov 8 2026)

Recurring owner report on iPhone/Telegram: pages and menus whose bottom could not be reached (base menu, Conquest page). Rule for all UI work:
- A page, menu, sheet or dialog either fits the visible screen, or scrolls. Prefer fitting when the content allows; keep the primary action (e.g. ENTER, CONFIRM) on screen without scrolling.
- Never size panels with `vh` (Telegram's webview `vh` is taller than the visible area). Use flex inside the JS-sized panel, `min-height:0` + `overflow-y:auto` on the scroller.
- The app-wide touch guard (`js/ui.js`) now lets any element that really overflows scroll, unless it or an ancestor is `touch-action:none` (maps, drive stick). Do not add per-screen whitelists; do not set `touch-action:none` on scroll containers.
- Test it: a browser test at ~390x700 (Telegram visible area) and 320x568 that checks the last item / primary action is reachable, with a real touch swipe (CDP `Input.dispatchTouchEvent`), as `dev/tests/conquest-plot-ui.py` does.

## Graphics contract
- Preferred 3D authoring integrates with existing Three.js/EQUIPMENT3D and material/asset ownership conventions; do not add a parallel engine.
- Model space: +X forward, +Y up, +Z right. Keep canonical hitboxes, chassis socket positions and weapon muzzle endpoints intact. Render and simulation must remain independent.
- Maintain distinct HIGH and LOW assets and a 2D fallback. Respect mobile draw-call, memory, shader and texture budgets; avoid desktop-only assumptions.
- New imported GLB/glTF support requires a deliberate loader/runtime change and compatibility tests; **the current vendored Three bundle does not imply GLB import is ready**.
- Image/video generation outputs are design references or cinematics until converted into validated, optimized and functioning 3D assets. Respect provenance/licenses; do not import third-party proprietary artwork.
- Check `dev/assets/README.md` and the existing graphics tests before modifying the asset pipeline.

## Useful existing checks (choose based on diff)
- `node dev/tests/graphics-motion.mjs`
- `node dev/tests/graphics-release.mjs`
- `node dev/tests/hf-collection.mjs`
- `node dev/tests/environment.mjs`
- `node dev/tests/velocity.mjs`
- `node dev/tests/conquest-authority.mjs` (also builds simulation)
- `bash dev/tests/conquest-regression.sh`
- `node dev/tools/asset-audit.mjs` (read-only asset inventory and atlas manifest integrity)
- Existing browser tests use Playwright and may require browsers/Worker dependencies; inspect the CI workflow first.

When a task is documentation/tooling-only, do not bump the deployed game version or alter live gameplay files.

## Conquest flagship-specific agent protocol

For Conquest flagship development, the durable cross-agent source of truth is `docs/conquest/CONQUEST_FLAGSHIP_EXECUTION_HANDOFF.md` plus both complete briefs in `docs/conquest/`. Read these before modifying Conquest; maintain `docs/conquest/IMPLEMENTATION_CHECKPOINT.md` on the coding branch and commit/push coherent progress after each vertical slice so Claude/Codex can take over without repeating work. In absence of the checkpoint, check the actual existing branch and PR history, never assume completed work or unpushed changes. These instructions do not grant access to uncertified payments or paid infrastructure.
