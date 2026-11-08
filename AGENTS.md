# LUNAR: War Machines — shared instructions for AI coding agents

This file is the common engineering contract for Codex, Claude Code and other authorized agents. Read it before editing. Claude Code also reads `CLAUDE.md`; that file points here. Read `docs/AI_TOOLCHAIN.md` for tool setup and handoffs.

## Project reality
- This is an existing production-oriented, phone-first web/Telegram game, **not** a greenfield React app. Preserve the current architecture.
- Browser/game: global-scope JavaScript in explicit load order (`index.html`, `web/boot.js`), canvas HUD, Three.js 3D with 2D fallback. Render code: `js/render3d.js`, `js/models3d.js`, `js/equipment3d.js`, `js/environment3d.js`, `js/graphics.js`, `js/showroom.js`. Current shared PBR atlas: `js/assets/hf-v1/manifest.json`.
- Rules and shared simulation: `js/rules.js`, `js/game.js`. Cloudflare Worker/Firebase server-authoritative economy and combat live in `worker/`. Conquest code spans `js/conquest/`, `worker/src/`, and corresponding tests.
- Begin with `dev/README.md`, existing workflows in `.github/workflows/`, and relevant `docs/` before assuming dependencies or designing replacements.

## Owner-control and safety gates
1. Work on a **new feature branch**, not `main`. Open a PR. **Never merge, deploy, publish, change live data, or activate payments without fresh explicit owner approval.** A passing CI run is not deployment approval.
2. Do not alter gameplay stats, inventory ownership, currency, purchases, server-authoritative economy, PvP integrity, Conquest progression, referrals, or existing gear entitlements as a side effect of visual/tooling work.
3. Keep existing player flows working on iPhone, Android, desktop browsers and Telegram Mini App. Preserve responsive HUD/input, accessibility, HIGH/LOW/2D fallback and context-loss behavior.
4. Never commit keys, tokens, private credentials, generated customer data or production database snapshots. Use local fixtures and isolated test endpoints.
5. Do not run destructive commands, install paid services, incur paid API/GPU charges, or invoke third-party reverse engineering outside owned/authorized targets without approval.

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
