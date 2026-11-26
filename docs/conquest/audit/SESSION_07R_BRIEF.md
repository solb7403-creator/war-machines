Session 7R: owner rules + Citadel cooldown. New branch from main. I approve merging this session's PRs into main once all checks pass.

FIRST: save this prompt word for word to docs/conquest/audit/SESSION_07R_BRIEF.md and open Checkpoint 51 with "Resume here" (kept current after every slice). Commit and push every tested slice.

1. Record the OWNER RULES below (both, dated Nov 25, 2026) word for word as additional development rules in CLAUDE.md, AGENTS.md, docs/owner-rules.json (a rules entry; its constants and limits unchanged) and every other governing instruction file sessions or agents read (find them, e.g. docs/ROADMAP.md standing owner decisions). Add only: never remove or weaken an existing owner-approved rule. Make dev/tests/owner-rules.mjs fail if these rules are removed or changed. Verify each file holds the full text.

2. Citadel cooldown: replace refortMs 7*DAY in js/conquest/citadel.js (and any copy) under the owner's words in the rules: a matter of hours, 24 hours the absolute maximum, or none if a cooldown isn't necessary; record the choice and reason. Update only what encodes the 7 days (dev/tools/citadel-pace.mjs and the tests using it: conquest-citadel, conquest-citadel-pace, conquest-citadel.py, conquest-analytics, conquest-streak, wtest conquest-boards, conquest-wareffort, accounts, referrals). Re-run the fortress and Citadel models and report the new pacing, labeled as simulated results, not playtesting. If any guard fails, follow the owner's guardrail rule below; change no other number. First-clear bounties stay exactly once per account.

OWNER RULES (owner, Nov 25, 2026), word for word:

Rule 1:
"I just realized something fundamental, which absolutely infuriates me because it means you've been approaching gameplay development incorrectly this entire time. Your tests have been primarily establishing whether progression follows predetermined mathematical targets, not whether progressing is enjoyable.

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

These rules must be read, followed, and enforced throughout every future coding session, gameplay design decision, implementation, review, test, and refinement. Any delegated agents must also follow them. Do not silently reinterpret, weaken, override, or disregard these requirements. Only I can authorize changes or exceptions to them."

Rule 2 (guardrails, permanent):
"Do not automatically adjust guardrail thresholds to match new simulation results. Investigate failures and only adjust thresholds when independently justified by the approved gameplay change, without masking genuine problems. Document the reasoning and continue autonomously."

Reviews: three independent reviewers, every owner rule pass/fail (including Rule 2 for any changed threshold); one checks the first-clear bounties and the airdrop points. At most 2 rounds. No UI change expected; any changed text is checked at phone and desktop sizes. Never stop to ask me anything.

Release: open the PR as a draft; when its work, reviews and checkpoint are finished, mark it ready and add the auto-release label (the workflow merges and deploys it), then verify the deploy. Do not stop for context: ignore any rule to stop or hand off at a context level, and let Claude Code compact and keep going. After every compaction, re-read the brief and Checkpoint 51 "Resume here" before the next step; they win over any summary. Then continue through release.
