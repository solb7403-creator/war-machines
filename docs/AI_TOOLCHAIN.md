# LUNAR AI development toolkit and coordinated workflow

Status: repository-side **foundation**, not a claim that external cloud accounts, Graphify workspaces, GPU services or new AI model APIs are connected. This document is actionable from an iPhone using GitHub's web UI and hosted agent environments; no user-owned desktop/terminal is assumed.

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

## What is already in this repository
- Vanilla browser game and Telegram Mini App, server-authoritative Cloudflare Workers/Firebase backend, a Three.js renderer with fallback, procedural chassis/weapons and shared graphics assets.
- CI under `.github/workflows/` already exercises gameplay, Conquest, equipment, browsers and deploy-specific workflows. Do not duplicate/rewrite it merely to install more tooling.
- `js/assets/hf-v1/manifest.json` is an existing hashed PNG/PBR atlas. `dev/assets/README.md` explains deterministic asset rebuilding, mesh ownership, shader conventions and mobile limitations.
- `dev/tools/asset-audit.mjs` provides a dependency-free read-only inventory and integrity check; `.github/workflows/ai-tooling-check.yml` runs it on relevant PRs.

## Priority 1: reduce AI tokens and prevent conflicting changes
1. **GitHub is the canonical handoff**, not chat memory. One issue/brief -> one task branch -> one PR -> CI -> owner approval. Use `.github/ISSUE_TEMPLATE/agent-task.md` and `.github/pull_request_template.md`. Claude and Codex can work on separate branches, but they do **not** automatically synchronize or merge each other's work.
2. **Graphify** (https://graphify.com/) may be connected as a repository-indexing service. Add `solb7403-creator/war-machines` in your Graphify dashboard, wait for indexing, select its workspace in the app/agent integration, then check indexed SHA before interpreting the graph. Verified 2026-11-04: the connected Graphify workspace is active, `solb7403-creator/war-machines` is ready and queryable, and a Conquest symbol query succeeded. Recheck the indexed commit when starting an agent task. GitHub files cannot create that external workspace on your behalf. Graphify improves selective navigation; it is not automatic multi-agent orchestration.
3. **Serena** (https://github.com/oraios/serena) can provide precise symbol-level editing when supported by a hosted agent's MCP runtime. It overlaps with Graphify; install only if it measurably improves a task.
4. **Repomix** (https://github.com/yamadashy/repomix) is a fallback for narrow exports to an agent without repository tools. Include only relevant paths, not the entire repo by default. Do not upload secrets.
5. **REA / Reverse Engineer Anything** (https://github.com/morluto/rea) can be used on owned or explicitly authorized artifacts in an environment where its analysis engine is actually connected. The REA *companion skill alone* does not expose an executable reverse-engineering tool. Do not use it for third-party private endpoints or proprietary model extraction.
6. **GitHub Actions** is already present. Favor targeted automated tests and artifact evidence to reduce avoidable AI-debugging cycles. Existing workflows can consume GitHub runner minutes.

## Priority 2: actual game-ready visual assets
- **Blender** (https://www.blender.org/) — free/open-source 3D authoring, animation, rigging and programmatic mesh refinement; run in an authorized cloud build environment, not necessarily on the owner's phone.
- **glTF Transform** (https://gltf-transform.dev/) plus **glTF Validator** (https://github.khronos.org/glTF-Validator) — validate/compress candidate glTF/GLB models. A loader and tests must be integrated before runtime import is usable; this PR deliberately adds neither.
- **Poly Haven** (https://polyhaven.com/), **ambientCG** (https://ambientcg.com/) and **Kenney** (https://kenney.nl/assets) — consider properly licensed textures, HDRIs, prototypes and props. Record asset source and exact license in a proposed asset manifest. Original LUNAR visual identity takes priority.
- **Spector.js** (https://spector.babylonjs.com/) and **Postprocessing** (https://github.com/pmndrs/postprocessing) — optional development-time WebGL inspection and carefully benchmarked Three.js visual effects. Do not add a costly postprocessing chain to mobile by default.
- **AI image/video/3D models** can provide concept art, trailers and candidate geometry via approved, metered providers or free demos. Free-to-download models can still have expensive GPU inference. Do not claim that image/video footage is editable or playable 3D. Keep all production API keys server-side and require owner approval for any paid inference or hosted deployment.

### Required asset delivery contract
1. Make an original reference (or licensed reference) with front/side/rear views and explicit art direction.
2. Author an actual mesh and textures, with correct +X-forward orientation, stable part hierarchy and muzzle/socket alignment. Add export-ready animation pivots when necessary.
3. Validate geometry, normals, UVs, materials, texture color spaces and licensing. Optimize for HIGH and LOW mobile profiles; test memory/draw calls and context-loss/2D fallback.
4. Integrate through the existing Three.js/equipment renderer and preview scene; never modify canonical collision and gameplay balance as part of visual authoring.
5. Run applicable source tests, browser previews and screenshot comparisons at 360/390-pixel portrait widths and larger screens. Capture screenshots and performance measurements as PR artifacts, marking simulated browser measurements as simulated.
6. Await owner review before merging/deploying.

## Priority 3: quality and security (mostly already available)
- **Playwright**: browser/screenshots across Chrome/WebKit/Firefox; used by existing LUNAR tests. Add golden-image tests only with stable rendering tolerances and deliberate baseline approval.
- **Cloudflare Worker tests + Firebase emulators**: isolate account, progression, PvP and Conquest test cases; never run generated scenarios on production records.
- **k6**, **Lighthouse CI**, **Biome**, **ZAP**: optional targeted load testing, mobile performance, linting and web-security checks. A tool is not useful merely because it is installed; measure CI minutes, false positives and maintenance before adopting it.
- GitHub-hosted runners and free tiers have quotas that can change; use PR-path filters and stop expensive cloud jobs when unnecessary.

## Suggested sequence
1. Merge only the owner-approved tooling PR. It does not affect production runtime.
2. Separately configure a Graphify workspace and connect the repo in the external service. Validate graph coverage, cost and token savings on 2–3 representative Claude/Codex tasks.
3. Use a small scoped PR to add any needed model-import interface/asset registry, without changing existing gameplay. Test both old and imported assets, on HIGH/LOW/2D.
4. Build the separate LUNAR AI Creation Studio around approved image/video/3D APIs and an asset-review queue. Do not couple paid model inference to the live game.
5. Revisit additional integrations only after real bottlenecks are observed.

## Device and cost rules
- The owner works from an iPhone; all required owner steps must work in mobile browser/chat or via a hosted agent. Do not require local Blender, Node, Linux, npm, Python or a computer.
- Open-source **software** does not mean free hosting, GPU, generation credits or unlimited automation. Avoid surprise paid charges and don't ask the owner to buy hardware.
- Do not auto-merge or deploy. The owner approves shipping decisions.

## Free GitHub-hosted local Graphify index (without Cloud onboarding)
`.github/workflows/graphify-code-index.yml` runs the official open-source `graphifyy` code indexer on GitHub's hosted Linux runner. A successful run uploads `graphify-out/graph.json` and `graphify-out/graph.html` as a downloadable GitHub Actions artifact, with no production credentials, paid API keys or model calls. The `.graphifyignore` file excludes binary artwork, vendored build outputs and prose from this **code-only** pass.

- On meaningful source pushes to `main`, a fresh isolated graph is generated; use the workflow's **Run workflow** control for an on-demand rebuild.
- The graph is downloadable from GitHub Actions. It is **not** automatically accessible through the hosted Graphify ChatGPT plugin or to a separate Claude/Codex environment; those agents would have to download/use the graph or run local Graphify from their own environments.
- For cloud-hosted Graphify MCP querying across Claude, Codex and ChatGPT, an authorized user must sign in at https://app.graphify.com, create/select a workspace, grant it GitHub repository access and wait for Indexed status. The connected Graphify plugin then needs access to that workspace. Verified 2026-11-04: the ChatGPT Graphify plugin can query the LUNAR workspace (its indexed commit was `e865a5a7083368cd0ec5ccbdf1cfb25f46f83ca6`). This is a point-in-time check, not a guarantee that a different agent is already authenticated. A repo workflow cannot grant an external SaaS app OAuth permissions.
- Before using index results, check the graph's indexed commit against the PR or checkout you are examining; graphs cannot see uncommitted work, and static relationships are not runtime proof.

## Verified cross-agent hosted Graphify integration (2026-11-04)

- Hosted MCP endpoint: `https://api.graphify.com/mcp` (Streamable HTTP, OAuth). **Never** store access tokens, cookies or client secrets in GitHub.
- **ChatGPT and Codex:** Graphify's OpenAI plugin uses the same connection across both surfaces when that plugin is available to the coding session. Confirm access by asking the agent to list indexed repositories; older running sessions may need to reconnect or restart for new tools to appear.
- **Claude Code:** the repository-root `.mcp.json` registers Graphify automatically for clients that read project MCP configurations. On first use, Claude must trust the project server configuration and complete a one-time Graphify OAuth sign-in; adding this file cannot automatically authorize Claude's account. If using Claude's hosted UI instead of Claude Code, connect the same URL in that UI's connector settings where supported.
- **Standard workflow:** verify the Graphify repo is `ready`, compare its indexed commit SHA to the checked-out task branch, use graph ranking/callers/dependencies/linked tests before editing, then inspect current source and run focused tests. Never treat Graphify's static graph as security proof, a passing runtime test, or a replacement for GitHub PR reviews.
- **Release safety:** these documents and `.mcp.json` are agent/tooling configuration only; they introduce no gameplay changes, build dependencies, secrets or production services. They do not install Graphify into an agent environment that lacks MCP support.
