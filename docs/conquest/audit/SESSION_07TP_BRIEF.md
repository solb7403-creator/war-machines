SESSION 7T-P — LIVING TOWN PROPOSALS. Model: Opus 5.5 · Effort: Extra.

You are the lead and creative director for LUNAR: War Machines (repo solb7403-creator/war-machines). The owner is not monitoring: never stop to ask him anything. You may change visuals, motion, pacing, gameplay and design decisions when clearly better, recording each change with its reason and evidence in the checkpoint. Prices, economy, airdrop points and payments only as written here; a better number goes in the final report as a labeled PROPOSAL. Release is pre-approved: when every check passes, merge, deploy and verify without asking.

OWNER'S GOAL (his words; they govern every choice):
- Nov 16: "Always optimize everything to be as fun and addictive as possible, to generate significant revenue with 500,000+ players. Act like you're trying to make a game that generates as much revenue as possible while also retaining and keeping all the free players addicted. Don't ignore free players, but do NOT heavily prioritize free players over paid players (life isn't fair)."
- Nov 17: "The main goal is to generate revenue with a fun and addicting game. Never make it so a free or casual player can max things out quickly. Judge every pace, cap and target by whether it serves that goal, and if it doesn't, figure out a better one. Don't ruin the game."
- Nov 17: "The end product of this game, LUNAR: War Machines, needs to be equivalent to, or better than, Clash Royale."
- Nov 18: "Remember, the end result of lunar is to be as good as, or better than other similar games."
- Nov 21: "Keep in mind the quality and standard we are going for with this game. And how it needs to be as good as, or better than similar games."
- Nov 21: "the overall goal of making the game fun, addicting, and having the potential for millions of players, with the immediate player goal 500,000"
- Nov 22: "What we DO NOT WANT is for a player to grind their ass off and feel all of it was for nothing. We still need to reward free players enough so they stay addicted and even manage to play for 1+ years as well."
NO LIVE PLAYERS YET: no migration, grandfathering, legacy fallback or "existing saves" code.

== START HERE (state on Nov 23, 2026) ==
- main = 7041291: Session 7T Living Town released (PR #150, docs PR #151, build 20261123061357). Session 5E-2d2 (Fable) is paused on branch claude/parasite-units-dropships-8y7kby and owns Checkpoint 45.
- FIRST SLICE (one small commit, then push): save this whole brief word for word to docs/conquest/audit/SESSION_07TP_BRIEF.md, and append Checkpoint 48 with a "Resume here" section whose first line reads: "If your context was cleared, read docs/conquest/audit/SESSION_07TP_BRIEF.md first; it governs everything." Keep "Resume here" current after every slice.
- Do not stop for context: ignore any rule to stop or hand off at a context level, and let Claude Code compact and keep going. After every compaction, re-read this brief and Checkpoint 48 "Resume here" before the next step; they win over any summary.
- Read: CLAUDE.md, AGENTS.md, Checkpoint 47 (its "Open items and PROPOSALs"), docs/economy/RESOURCE_ECONOMY.md, js/rules.js (STRIKE.resonance), js/conquest/townwar.js (STREAK, the town clock), js/conquest/plot.js (repairPlan), the onboarding coach (the steps dev/tests/conquest-onboarding.py checks), dev/tools/fortress-model.mjs, dev/tools/economy-model.mjs and dev/tests/conquest-fortress.mjs.
- New branch from main. 5E-2d2 edits js/core.js, js/main.js, js/net.js, web/boot.js, js/meshy3d.js, js/showroom.js, js/fx3d.js, js/conquest/slots.js, worldkit.js, kit/, view.js, style.js, townkit.js, plot.js, plotview.js, hub.js and .github/workflows/conquest-check.yml: keep your edits there small and additive.

== OWNER DECISIONS (Nov 23: the owner adopted these Session 7T proposals) ==
1. Keep as shipped: the THREAT -> raid level table (cap 9) and the 60% chance at each eligible tick. Record both as owner-adopted in Checkpoint 48 and docs/economy/RESOURCE_ECONOMY.md.
2. Selenite for the late fortress (7T: the grinder holds 81% late in the year; the target is about 9 of 10). Measure both candidates with the fortress and economy models: Strike Resonance for Selenite every 8 strikes instead of 12 (STRIKE.resonance.se), or a Selenite drop on a town defense held in person (amount set by the models). Ship the one that brings the grinder closest to about 9 of 10 late in the year while the regular profile's hold rates stay within 5 points of today's and the town-ladder guard holds; if neither does, ship neither and report the numbers as a PROPOSAL. Selenite stays earn-only in this session.
3. A coach step that has the pilot close a first wall ring before Command Center level 4 (7T: an undefended builder pays about 111,000 CP of REPAIR on the way to CC10, which then takes twice as long). Re-measure with the fortress model after it; if repairs are still heavy, report a PROPOSAL with an exact repair price for town-raid damage. Change no prices here.
4. Welcome-back kits: re-grant the streak's day-1 Repair Kit and day-3 Scanner Charge once after 14 or more days away; never points or minerals.
5. Not here: the alert cron's scaling (the pre-launch load test), the paid fortress and the store (Session 8).

== WHOLE-SESSION REQUIREMENTS (with EVERY change in this session switched on) ==
- All pass: every node and browser test named in the CI workflows (the fortress job included), plus new tests for decisions 2–4. No test skipped, deleted or loosened; change a test only where a decision here changed its rule, and record it.
- The Worker stays authoritative; the shared sim builds into worker/src/sim.gen.js (worker/build-sim.mjs).
- Economy: no price, point, cap or payment changes beyond decision 2; payments stay off (LAB_STORE_OPEN, CRYPTO_PAY false).
- Phone and computer equal, on the website (the main way to play) and in Telegram: the coach step and the welcome-back kits at 390x844, 390x700, 320x568 (touch) and 1366x768, 1920x1080 (keyboard and mouse).
- Non-visual session: at most 2 review rounds (a 3rd only for something clearly broken). Two fresh, independent, read-only reviewers (1: fun and reward for free and paying players against the goal rules; 2: the measurements, the economy guards, regressions) check every decision PASS/FAIL with evidence. Fix every blocker, then re-review.
- Commit and push every tested slice. Keep Checkpoint 48 current. Never end a turn waiting on CI without a scheduled wake-up.

== RELEASE (pre-approved) ==
Merge the latest main into your branch first and resolve any conflict keeping every session's work, all tests green. Then dev/bump.sh; PR (body from the checkpoint); CI green; merge; verify the Worker deploy (/pvp/health ok, live version.json = repo) and GitHub Pages; add ROADMAP row 7T-P after 7T as RELEASED with PR, merge and build; release record in Checkpoint 48.
Final report: both Selenite candidates' numbers and the choice; repairs after the coach step; every PROPOSAL; every open item.

Continue through release.

ADDENDUM (owner, Nov 23)

Do not redo finished work. Append this whole message word for word to docs/conquest/audit/SESSION_07TP_BRIEF.md under "ADDENDUM (owner, Nov 23)". Owner: "No players are going to be playing for more than 4 hours per day. I'd be shocked if players played for more than 2. But that's the goal. To have players play as much as possible, and spend as much as possible." Decision 2 now targets a 2-hour heavy player instead of the grinder: set ConquestTown.TOWN.se.n from 4 to 8. Measured in the owner's planning chat on fe683d4 with the selenite-candidates method (8 raids a site and day, both seed sets; the grinder's 4-Selenite numbers reproduced exactly): late in the year the heavy player holds 81.3% at 4, 88.1% at 8 and 87.8% at 12, and at 8 the regular profile's hold rates stay within 3.6 points of today's. Add that "heavy" profile to dev/tools/fortress-model.mjs (sessions [[10,60],[19,60]], the town ladder from ladderOf(120) in dev/tools/economy-model.mjs, citadel [[0,0],[10,1],[32,3],[90,6],[208,9]], gear [[0,0],[17,1],[95,2]], otherwise as the grinder) and to dev/tools/selenite-candidates.mjs, then re-run it. Ship 8 only if the regular profile's hold rates stay within 5 points of today's and the town-ladder guard holds; if not, keep 4 and report the numbers as a PROPOSAL. Update the tests that pin 4 (conquest-town-selenite, conquest-fortress (e)) and never loosen (e)'s 5-point guard. Report the grinder's numbers too. Record in the final report that Session 8's paid-fortress target should use the same 2-hour play time. Do not stop for context: ignore any rule to stop or hand off at a context level, and let Claude Code compact and keep going. After every compaction, re-read the brief and Checkpoint 48 "Resume here" before the next step; they win over any summary. Then continue through release.
