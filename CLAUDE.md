# Claude Code — LUNAR: War Machines

Read and follow [AGENTS.md](AGENTS.md) as the **canonical shared engineering instructions** for Claude Code and Codex. Consult [docs/AI_TOOLCHAIN.md](docs/AI_TOOLCHAIN.md) for tools, ownership boundaries, branch/PR handoff, and the graphics asset pipeline.

Use the existing repository and current branch as the source of truth. Do not infer that Graphify or REA is configured unless their tools respond successfully. Do not merge/deploy, change game economy, or modify another agent's working branch without explicit owner approval. Prefer narrow source reads and focused validation to save tokens; do not silently replace project architecture.

## Hosted Graphify MCP (project-scoped)

The repository's `.mcp.json` declares the hosted Graphify MCP endpoint (`https://api.graphify.com/mcp`). On first use, authorize Graphify via the Claude Code OAuth prompt if requested; configuration does **not** bypass user sign-in. Check `list_repositories`/`graph_stats` to confirm `solb7403-creator/war-machines` is indexed and to compare the indexed commit with your working branch. For substantial code changes, use the graph to identify relevant files, callers, dependencies and linked tests before expensive whole-file reads. Fall back to current source if Graphify tools are unavailable; treat static graph relationships as guidance, not runtime verification. Never commit tokens or OAuth credentials.

## Conquest flagship continuation (Codex ↔ Claude)

When working on Conquest flagship completion, open [docs/conquest/CONQUEST_FLAGSHIP_EXECUTION_HANDOFF.md](docs/conquest/CONQUEST_FLAGSHIP_EXECUTION_HANDOFF.md) **before** coding. Both complete owner-approved briefs are stored under `docs/conquest/`; don't rely on attachment URLs or previous chats. Read and update `docs/conquest/IMPLEMENTATION_CHECKPOINT.md` when present, commit and push each tested vertical slice, and never claim to recover another agent's unpushed work. Do not shorten scope due to a prior agent running out of quota. Never enable unverified payments.

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
