Do not redo finished work. Your context was cleared, so this message is your brief.

FIRST, IN ONE SMALL COMMIT:
1. Run git status; test and push anything uncommitted.
2. Save this whole message, word for word, to docs/conquest/audit/SESSION_05E2D1_BRIEF.md.
3. Rewrite Checkpoint 44's "Resume here" to the real state below. Its first line must read: "If your context was cleared, read docs/conquest/audit/SESSION_05E2D1_BRIEF.md first; it governs everything." Keep "Resume here" current after every slice from now on.

REAL STATE (branch claude/conquest-world-rebuild-mu3ktv, pushed head 3ba537c):
- DONE: slice 1 ROADMAP notes (c7fa6ea); the world-kit core, viewer and capture tools; the see-through rule (world and town drive view); the town's fixed DRIVE joystick; the four desktop 5D leftovers; the code-built models of all 133 slots, HIGH and LOW; integration into js/conquest/style.js and js/conquest/townkit.js; the slot swap and its tests; critic round 1 and its fixes (aa280ca); the holographic signs fix (2254650); critic round 2 and its fixes (93da4b2, e2a48d0); the tank outline drawn only while something blocks it (f0461ff).
- UNFINISHED (3ba537c, wip): the colony's town core drawn by 80 m ground cell. Still owed: the triangle and draw-call counts before and after at the colony, HIGH and LOW; a look at the colony captures for seams between cells; a re-run of conquest-occluder.py and conquest-seethrough-town.py.
- NEXT, IN ORDER: (1) finish that step; (2) critic round 3, the last one (a 4th only for an item the reviewer marks clearly below its reference, never more than 4), with captures at all five sizes on HIGH and LOW (re-capture only what changed since round 2, plus any size or quality not yet captured); (3) the 5E-2a town-item recolour re-check against the Meshy originals (record whether rounds 1-2 already covered it); (4) the desktop pass at 1366x768 and 1920x1080; (5) the whole test list; (6) two reviewers; (7) release.

SESSION 5E-2d1 — CONQUEST WORLD REBUILD. Model: Fable 5.2 · Effort: High.

You are the lead and creative director for LUNAR: War Machines (repo solb7403-creator/war-machines). The owner is not monitoring: never stop to ask him anything. You may change visuals, motion, pacing, gameplay and design decisions when clearly better, recording each change with its reason and evidence in the checkpoint. Prices, economy, airdrop points and payments only as written here; a better number goes in the final report as a labeled PROPOSAL. Release is pre-approved: when every check passes, merge, deploy and verify without asking.

OWNER'S GOAL (his words; they govern every choice):
- Nov 16: "Always optimize everything to be as fun and addictive as possible, to generate significant revenue with 500,000+ players. Act like you're trying to make a game that generates as much revenue as possible while also retaining and keeping all the free players addicted. Don't ignore free players, but do NOT heavily prioritize free players over paid players (life isn't fair)."
- Nov 17: "The main goal is to generate revenue with a fun and addicting game. Never make it so a free or casual player can max things out quickly. Judge every pace, cap and target by whether it serves that goal, and if it doesn't, figure out a better one. Don't ruin the game."
- Nov 17: "The end product of this game, LUNAR: War Machines, needs to be equivalent to, or better than, Clash Royale."
- Nov 18: "Remember, the end result of lunar is to be as good as, or better than other similar games."
NO LIVE PLAYERS YET: no migration, grandfathering, legacy fallback or "existing saves" code.

== START HERE ==
- Continue on this branch (it started from main 0e681aa). If main has moved, merge it into the branch before release; never restart from main.
- Read: CLAUDE.md, AGENTS.md, docs/ROADMAP.md (row 5E-2d1, Standing owner decisions), docs/conquest/IMPLEMENTATION_CHECKPOINT.md (Checkpoint 44 first; the 5E-2a checkpoint for the town-item recolour), js/conquest/slots.js, js/conquest/worldkit.js, js/conquest/kit/, js/conquest/style.js, js/conquest/townkit.js, js/assets/meshy-v1/manifest.json (the owner's quality bar: his Meshy chassis, weapons and town items), css/conquest.css.

== 1. ROADMAP NOTES ==
Done in slice 1 (c7fa6ea).

== 2. THE WORLD REBUILD (owner, Nov 11 and Nov 19) ==
- Owner, Nov 11: every code-drawn building and prop in the Conquest world must be rebuilt to Meshy-level detail; his Meshy town items are the quality bar. Owner, Nov 19: Fable builds all of it in code now; his own Meshy models replace chosen pieces later.
- Checkpoint 44's inventory (133 slots) is the list, including the town buildings and turrets that have no Meshy model.
- Owner, Nov 8: colony settlers are a different group from the military, so their buildings and outposts look different; done fully, not half-done. Terraformed areas: rugged, not a picnic field or park; brighter and less gloomy than the barren Moon; civilized and thoroughly constructed, with a fair amount of open, wild nature.
- Swappable slots (built): every kind has a stable slot id in one model list; a Meshy GLB listed for a slot replaces the code-built model at load with no other code change. conquest-slots.mjs and conquest-slots-browser.py prove the swap.
- Every kind has a HIGH and a LOW version; LOW keeps the silhouette and reads clearly on a phone.
- Footprints, collision and placement stay as they are: this is a looks session (conquest-world-equivalence.mjs passes unchanged).
- Re-check 5E-2a's town-item recolour (5E-2a ran on Opus) against the Meshy originals and fix anything that reads worse.

== 3. TOWN VIEW CONTROLS (built; reviewers check it) ==
- The town view uses the same fixed DRIVE joystick as the world (.cq-stick in js/conquest/app.js), not a floating stick; WASD and the arrow keys keep working on a computer. BUILD's camera and the drag or tap on the handle keep working.

== 4. NO SEE-THROUGH BUILDINGS (built; reviewers check it) ==
- Owner: buildings are never see-through unless the tank is pressed directly against a building or object.
- When a building or object blocks the camera's view of your tank, it stays solid and your tank shows through it as a clean outline; your allies' tanks too; enemies never (cover stays real).
- Only the building or object your tank is pressed directly against goes see-through, and only while it is.
- The camera does not move to avoid buildings (owner).
- The same in the world and in the town drive view; dev/tests/conquest-occluder.py and conquest-seethrough-town.py follow this rule; the world keeps its 16-shader-program budget.

== 5. DESKTOP PASS OF CONQUEST (phone and desktop equal) ==
- A full desktop pass of Conquest: looks, controls, layout and performance at 1366x768 and 1920x1080 with a real keyboard and mouse, equal to the phone.
- The four desktop 5D leftovers are done; reviewers check them.

== 6. PERFORMANCE AND QUALITY ==
- Never lower visual quality or render resolution; keep the current phone resolution (owner).
- Budgets hold: the world 16 shader programs; the town drive and build views 16 programs and 140 draw calls (conquest-session5c.py); the hub 12 programs (conquest-hub-browser.py). Reach them with instancing, shared materials and culling, never lower quality. Software-renderer frame numbers are relative only; no optimization loop.
- Report the bytes this session adds to the page load.

== WHOLE-SESSION REQUIREMENTS (with EVERY change in this session switched on) ==
- All pass: every node test named in the CI workflows (including conquest-style.mjs, conquest-townkit.mjs, conquest-world-equivalence.mjs, conquest-slots.mjs, conquest-allies.mjs and owner-rules.mjs); the browser tests conquest-slots-browser.py, conquest-occluder.py, conquest-seethrough-town.py, conquest-session5c.py, conquest-session5d.py, conquest-session6b.py, conquest-session6c.py, conquest-onboarding.py, conquest-hub-browser.py, conquest-flagship-browser.py, conquest-assets-browser.py, conquest-plot-ui.py, weather-browser.py, perf.py and weather-perf.py. No test skipped, deleted or loosened; change a test only where a decision in this brief changed its rule, and record it.
- Phone and computer equal, website and Telegram: captures with conquest-world-kinds-captures.py, conquest-flagship-captures.py and conquest-town-captures.py at 390x844, 390x700, 320x568 (touch) and 1366x768, 1920x1080 (real keyboard and mouse), on HIGH and LOW.
- Process: captures -> a hard critique against the owner's Meshy town items, his Meshy tanks and the comparable games in Checkpoint 44 -> improve. Visual session: 3 critic rounds (rounds 1 and 2 are done); a 4th only for an item the reviewer marks clearly below its reference (never more than 4); phone and desktop judged in the same round; later rounds re-capture only what changed. The bar: exceptional, professional, stands out.
- No economy, airdrop-points or payment changes: DAILY_CAP 50,000 and the points table (CQ_PTS) unchanged.
- Two fresh, independent, read-only reviewers (1: looks against the Meshy bar, settler vs military, the see-through rule, phone and desktop; 2: performance and budgets, controls, regressions) check every owner rule in this brief and every design choice recorded in the checkpoint against the goal rules, PASS/FAIL with evidence. Fix every blocker, then re-review.
- Commit and push every tested slice. Keep Checkpoint 44 current with the resume point at the top. Never end a turn waiting on CI without a scheduled wake-up.

== RELEASE (pre-approved) ==
dev/bump.sh; PR (body from the checkpoint); CI green; merge; verify the Worker deploy (/pvp/health ok, live version.json = repo) and GitHub Pages from the deploy jobs; ROADMAP row 5E-2d1 -> RELEASED with PR, merge and build; mark the four desktop 5D leftovers done; release record in Checkpoint 44; a docs-only follow-up PR if needed.
Final report: what changed, with before/after captures of every rebuilt kind; the slot list, ranked by which pieces would gain the most from a Meshy model (so the owner knows where to spend his next Meshy credits); every open item.

Continue through release.
