# Session 6C — Battalion: the owner's complete brief (continuation prompt, Nov 19, 2026)

Stored verbatim from the owner's prompt so reviewers and later sessions do not depend on chat history. It is the complete brief
(the original 6C prompt, sections 1-8, plus the owner decisions of Nov 18, sections 9 and 10) and overrides the blueprint and every
older brief where they differ.

---

SESSION 6C — BATTALION (CONTINUATION). Model: Opus · Effort: Max.

Do not redo finished work. You are the lead and creative director for LUNAR: War Machines (repo solb7403-creator/war-machines). The owner is not monitoring: never stop to ask him anything. You may change visuals, motion, pacing, gameplay and design decisions when clearly better, recording each change with its reason and evidence in the checkpoint. Prices, economy, airdrop points and payments only as written here; a better number goes in the final report as a labeled PROPOSAL. Release is pre-approved: when every check passes, merge, deploy and verify without asking.

OWNER'S GOAL (his words; they govern every choice):
- Nov 16: "Always optimize everything to be as fun and addictive as possible, to generate significant revenue with 500,000+ players. Act like you're trying to make a game that generates as much revenue as possible while also retaining and keeping all the free players addicted. Don't ignore free players, but do NOT heavily prioritize free players over paid players (life isn't fair)."
- Nov 17: "The main goal is to generate revenue with a fun and addicting game. Never make it so a free or casual player can max things out quickly. Judge every pace, cap and target by whether it serves that goal, and if it doesn't, figure out a better one. Don't ruin the game."
- Nov 17: "The end product of this game, LUNAR: War Machines, needs to be equivalent to, or better than, Clash Royale."
- Nov 18: "Remember, the end result of lunar is to be as good as, or better than other similar games."
NO LIVE PLAYERS YET: no migration, grandfathering, legacy fallback or "existing saves" code.

== START HERE (state on Nov 19, 2026) ==
- The first 6C session ran out of context before release. Continue on its branch claude/battalion-allies-lab-iv-o8tguj (head 3d86193, from main 97e4c29; main is unchanged and nothing is released).
- Read Checkpoint 43 in docs/conquest/IMPLEMENTATION_CHECKPOINT.md first: its "Resume here" has the local setup, what is DONE and the NEXT steps in order.
- DONE (per Checkpoint 43): slice 1 roadmap notes; slice 2 the ally engine (dev/tests/conquest-allies.mjs, in CI); slice 3 Science Lab IV, Role Core jobs, the first Lab grant, the wingman rescue, ally-only kills pay nothing, pilot-only objectives, the battalion in the Worker replay, HANGAR actions, the new store kinds refused, the Shop section, battalionModel added (not yet run with --write); slice 5 the record split; slice 6 owner rules (47 checks, mutation-proven); slice 7 the server replay budget (Battalion 60 ms median / 110 ms p95); slice 8 the hub BATTALION card and the HANGAR screen; slice 9 the briefing strip (not yet checked in a browser).
- OPEN, in this order: (1) the HUD COMMAND button in the context slot + the wheel + keys V / hold V / 1-4; allies drawn in 3D (the existing Meshy kits; stock paint, livery, LDF livery; role badge; downed look; ally effects halved on LOW); the Lab's Role Cores track and the first-grant card in lab.js; after-action lines (ConquestHangar.aarLines); Refuge Supply REPAIR PILOTS; (2) call conquest-store sweep at session open; (3) guardrail tests 1, 2 and 4 together with the VETERAN fix in section 9; (4) the Worker test file for the Battalion rules over HTTP; (5) economy-model --write + the RESOURCE_ECONOMY section; (6) browser checks (WHOLE-SESSION REQUIREMENTS); (7) at most two UX critic rounds, two reviewers, release.
- Lesson recorded three times in the first session: an inserted trailing // comment on a long minified line swallows the rest of that line. Use /* */.
- This prompt is the complete brief: the original 6C prompt (sections 1-8) plus two owner decisions of Nov 18 (sections 9 and 10). It overrides the blueprint and every older brief where they differ. Keep Checkpoint 43 current with the resume point at the top after every slice, so another session can continue if this one runs out of context.

== 1. FIRST SLICE: ROADMAP NOTES (docs only) ==
In docs/ROADMAP.md add:
- Row 6C: "plus the one-time first Science Lab grant (owner, Nov 18)".
- Row 6B-V: "(a) rain in Conquest's terraformed zones (owner, Nov 18): terraformer atmosphere towers at the edge of the terraformed south vent vapor into a cloud deck over the grass and lush zones only; showers come and go on the world clock, the same for every player, only under that deck, and stop at the terraformed edge; rain joins the terraformed sound bed; looks only (no sight or damage effect); fewer drops on LOW; Arcade stays rain-free (no air); (b) the animated premium battalion liveries (6C builds the livery system and the plain liveries)".
- Row 8: "(c) Lab store prices: at the proposed prices a payer can own every research mod and all four Legendary set mods for about 4,924 Stars (about $98 at $0.02 a Star); settle the price ceiling when Session 8 is planned; (d) the premium Lunar Pass research perks turn on with the Lab store, not before (owner, Nov 18)".

== 2. ALLIES IN THE COMBAT ENGINE (blueprint §4 build notes) ==
- Battle in js/conquest/combat.js has a friendly unit list. Ally AI reuses the enemy steering and targeting with the side flipped; enemies target across friendlies. Each friendly unit carries a controller field: 'ai' now, a human pilot later (the co-op foundation). The LDF unit type (the same unit in LDF livery, outside your command) is built and tested here; Session 7 uses it.
- Allies live in the shared combat code that worker/build-sim.mjs packs into worker/src/sim.gen.js: seeded and deterministic; the Worker is the authority; phone and Worker agree.
- Your tank stays decisive: only the pilot captures, plants, extracts and breaks a general's shield core. In a full assault allies deal about 60% of the damage and the pilot about 40% and 100% of objectives, tuned through ally aim lag and reaction time, never through enemy stats. Measure the split per fight size and record it.
- Caps in any fight: 10 friendly units, 20 active hostile, 6 drones, 160 projectiles (main capped projectiles at 96). Effects halve on LOW graphics.
- Ally and general supers follow the player's charge rule plus a minimum spacing.
- Downed allies are never lost: they return at half hull until repaired with alloy at the Refuge or your town. The alloy per repair is your labeled proposal from the economy model (your own hull repair at the Refuge is free).
- Points (blueprint §8, kept): allies never multiply points. Operation points stay per operation; a world kill pays points only when your own tank dealt part of the damage; CQ_PTS.hourMax (120) stays. Planning pick: the same rule for a world kill's CP and loot.

== 3. ROLES, ORDERS, FORMATIONS, FIGHT SIZES (blueprint §4; names kept, owner Nov 18) ==
- The six roles exactly as in §4's table (Guardian, Breacher, Lancer, Mender, Corroder, Frostline: chassis, signature, answers); the 20% and 20 m are starting values for your simulations. A role is a Role Core fitted to a normal tank: ally stats come from tankOf(), no second rule set; no per-ally plating, engineering or mods. Combos come from mechanics (§4's three).
- Every briefing shows the enemy roster as icons with one hint line.
- COMMAND: a tap gives the smart order (attack my locked target, or regroup when nothing is locked); a hold opens the four-way wheel Follow / Attack / Hold here / Fall back. It shares the context button (SCAN, GATHER, COMMAND in a fight); the HUD stays at eight touch targets. The same orders on a computer's keyboard and mouse, equal to the phone (you pick the bindings).
- Formations Line, Wedge, Escort, chosen before the fight; three saved presets.
- Unlocks follow §3's journey, one new thing per stage (planning pick): the first wingman (section 4) follows and fights; roles, COMMAND orders and formations open with Hangar level 2 (the Platoon stage).
- Fight sizes: Wing 2 allies (roaming, field missions, mining escorts), Platoon 4 (raids, territory defenses, town defense), Battalion 9 (Citadel assaults, Grand Offensives, co-op: those arrive in Sessions 7 and 7B; build and test the Battalion size now).

== 4. ROSTER, FIRST WINGMAN, HANGAR, RECRUITS, RANKS, AUTO-ARM (owner, Nov 18) ==
- A roster of 16 named recruits, each with a call sign and a kill count.
- No starter pilots. The first wingman comes in the first hour: right after the first plate (about minute 12), a short rescue near the Refuge (its own STANDARD mission; the HARD 'rescue' operation, BEACON EXTRACTION, stays as it is); the pilot you save joins as your wingman. It pays no airdrop points (planning pick: no new points source); its reward is the pilot.
- Allies you can field: 1 with no Hangar; Hangar levels 1-5 field 2 / 4 / 5 / 7 / 9. Hangar costs and gates unchanged (js/conquest/plot.js: 180 CP + 12 alloy, 432 + 29, 1,037 + 69, 2,488 + 166, 5,972 + 398; unlocks at CC2; level L needs CC 2L-1: II CC3, III CC5, IV CC7, V CC9).
- Recruits: 1 for your first win of the 'rescue' operation each UTC day; a Hangar RECRUIT job on the Worker clock, time only (no CP), 8 h, one at a time (planning picks); no recruit while the roster is full; instant finish on a RECRUIT job uses rsFinPrice (checkout off). Recruits from liberated territories come in Session 7.
- Rank 1-10 from operations fought; ranks 3, 6 and 9 upgrade the role signature. The rank pace stays as built (section 10).
- AUTO-ARM assigns your best spare owned weapons and chassis, one item per tank; with no spare gear an ally uses a militia kit (Common, no cores).
- One HANGAR screen: roster cards (role, rank, gear, status), AUTO-ARM, formation presets. Before a fight, one strip shows the enemy icons and your picked force. Two taps from briefing to deploy. Phone and computer.
- FORCE chip: js/conquest/rating.js with its own key (the battalion rating), on the hub and every briefing beside the band. Informational only: nothing reads it.
- NOT in this session: reserves' jobs (stationing: Session 7; town garrison: 7T), LDF regulars filling empty seats (Battalion fights: 7/7B), the Lunar Pass battalion perks and the Moonguard escort (blueprint §8: the owner decides later).

== 5. ROLE CORES, SCIENCE LAB IV, THE FIRST LAB GRANT (owner, Nov 18) ==
- Science Lab max level 4 (docs/owner-rules.json research.labMax 4). Level IV on the lab's existing curve: 4,424 CP, 249 alloy, 111 biomass, 41 helium (320 x 2.4^3 = 4,423.7; 18, 8 and 3 x 13.824 = 248.8, 110.6, 41.5). Build time 6 h (planning pick; the Trophy Hall stays on TIME3). Gate: the existing rule (level IV needs CC7). Level IV opens the Role Cores track (RTREE.role, formerly RTREE.locked).
- Role Cores: level 1 of each role comes free with the role. Levels 2-5 are Science Lab jobs costing 2 / 4 / 5 / 9 command chips (20 a role, 120 for all six), chips + time only, never CP. Each job 8 h, in the Lab's research slots shared with mod research (planning picks). A role's level applies to every pilot fitted with that Role Core. Server-verified like every research job; instant finish works like any job.
- Command chips: your first win each UTC day in a fight with at least one of your pilots fielded (an operation, field mission, raid or defense) gives 1 chip, guaranteed. 1 earned chip per account per UTC day, enforced by the Worker like CQ_PART_DAY; a chip found after the day's chip becomes 1 cosmetic fragment (the CQ_PART_SWAP pattern; this session has no other chip source, so build the rule for later ones). Earned chips are stored like earned research parts (max 50, planning pick matching CQ_PART_MAX); chips from the chip pack are a separate account total like eco S.bpt and ignore the daily limit. The hub shows "COMMAND CHIP 0/1 TODAY" (1/1 once taken) beside the research line, phone and computer.
- Chip pack in the Lab store: checkout off (LAB_STORE_OPEN=false in js/rules.js, CRYPTO_PAY=false in js/core.js); one a UTC week (planning pick, like the research packs); size and price are labeled proposals in Stars (Telegram only), TON and SOL at the live rate. No chips in the Lunar Pass this session.
- Never sold: pilots, ranks, Role Core levels. Chips, recruits, Role Cores and liveries never award airdrop points.
- First Science Lab grant: when your first Science Lab is built, you pick Thermal or Ballistics and get 2 of that part, once per account, not counted against the 1-a-day limit (planning pick for the mechanism), so the first mod (cost 2) can start that day.
- Your own tank's POWER and the research power rules (best research build about +8%, best Legendary about +7%) are unchanged.

== 6. STORE: LIVERIES AND RECRUIT FINISH (owner, Nov 18) ==
- Battalion liveries (blueprint §8: "Battalion colors and insignia: your paint and your banner on every ally"): store entries that put your paint and your banner/insignia on every ally, plus plain livery sets. Allies wear their stock paint by default; the LDF livery is only for LDF troops. Cosmetic only, never power or points. Checkout off until Session 8 (gated like the Lab store); prices are labeled proposals. Their ids never overlap a loot id (dev/tests/conquest-loot.mjs disjointness passes unchanged).
- The animated premium livery sets are not built here: they go to row 6B-V (Fable).
- Every new store kind (chip pack, liveries, RECRUIT finish) is refused by worker/src/index.js descOf like the Lab kinds and enforced inside ecoGrant: no invoice, no Telegram-confirmed payment, no TON or SOL log can grant one.

== 7. THE RECORD SPLIT (blueprint §10, fix step 1) ==
- Split the Conquest record so the per-second path carries battle data only, and send less often when no enemy is near. The Worker stays the authority; credits stay exactly-once; no gameplay change. Measure with the real server code before and after and report bytes per pilot-hour, idle and in a fight (Checkpoint 43 has the measurements; the sweep at session open is still open).

== 8. GUARDRAILS, PERFORMANCE, MODEL, OWNER RULES ==
- Guardrail tests (blueprint §12), wired into CI:
  1. No scaling to the player: extend conquest-combat.mjs (fixed authored enemy stats across gear) and conquest-power-chip.mjs (combat.js never reads powerOf): enemy stats identical with 0 and 9 allies, stock and legendary gear, any FORCE; no enemy code path reads gear, power, FORCE, league, purchases or Command Center level.
  2. Better gear always helps: Starter, Epic and Legendary win rates rise in that order on every authored encounter and town-raid level.
  3. Fair AI supers: no ally or general fires supers faster than a player could charge them, or inside the minimum spacing.
  4. Composition matters: a balanced battalion beats a one-role battalion of equal gear on most authored operations (simulation).
- Performance: the caps above; a full Battalion fight on LOW graphics holds the frame-time bar in docs/conquest/SMOOTHNESS_PERFORMANCE_ACCEPTANCE.md on phone and computer; the server replay budget for 10 friendly units stays as set in docs/conquest-living-war/replay-budget.json.
- New Worker tests, in CI, that fail if a rule breaks: a second earned chip the same UTC day becomes a fragment and the count resets at 00:00 UTC; pack chips are never limited; a Role Core level cannot start before Science Lab IV or without its chips; a role's level reaches every pilot of that role; the RECRUIT job's timing and the roster cap of 16; the fielded cap per Hangar level (1 with none, then 2/4/5/7/9); a kill by allies alone pays no points; the first Science Lab grant pays once; chips, recruits and liveries never pay points; every new store kind is refused while checkout is off.
- dev/tools/economy-model.mjs battalionModel: run --write; update docs/economy/RESOURCE_ECONOMY.md. Report (report numbers, never pinned targets) at 30, 60 and 120 min a day: the day of the first wingman, Wing, Platoon and Battalion; the first role maxed and all six; the rank paces.
- docs/owner-rules.json + dev/tests/owner-rules.mjs keep every pin set in slice 6 and must fail if any drifts. If the owner-rules CI label check asks, add the 'owner-rules-change' label to the PR yourself: this prompt is the owner's decision.

== 9. FIX: ALLIES MUST NOT LET A STOCK PILOT SKIP VETERAN (owner, Nov 18) ==
- The problem (Checkpoint 43): a Platoon lets a stock pilot clear VETERAN raids, which that pilot alone clears 0 of 15 times. The town-ladder check models fixed 90-second sorties, so it cannot see this.
- First find the cause in the simulation (kills, damage share, hull, aggro) and record it.
- Fix it by tuning only the militia-kit allies (mil:1 in js/conquest/battalion.js) through their aim and reaction time (ALLY decide / react / reactLock in js/conquest/combat.js), never through enemy stats. Allies armed from real spare gear keep their current tuning. If the cause turns out to be elsewhere (for example militia allies soaking the fire that would kill the pilot), you may change another militia-only setting as a creative-director decision, recorded with evidence; never enemy stats.
- The rule, in a CI test (extend dev/tests/conquest-allies.mjs), with every change in this session switched on, over the VETERAN-danger raids on at least the same 15 seeds: (a) a stock pilot with a militia Platoon clears VETERAN at most 3 of 15 (planning pick); (b) the same stock pilot with an Epic-armed Platoon clears at least 8 of 15 (planning pick); (c) a militia Platoon still helps on HARD raids: it clears at least as often as the pilot alone; (d) the first wingman stays useful: its rescue still ends in victory and it still lands kills. Record the numbers before and after.
- The Wing (26.3%) and Platoon (53.9%) shares in docs/conquest/session6c/ally-split.json were measured with militia allies, so they will drop: re-measure and record them. The full-assault target stays about 60/40 with equal Epic gear (61.8% today).
- If aim and reaction cannot meet (a) without breaking (c) or (d), record why and the best result as an open item. Never loosen a test.

== 10. RANK PACE: KEEP AS BUILT (owner, Nov 18) ==
- Keep the rank pace as built (60 min a day: one pilot rank 10 at day 25, the roster at rank 10 at day 109; the first Role Core maxed at day 19.3, all six at 119.3). Report the paces as built.

== WHOLE-SESSION REQUIREMENTS (with EVERY change in this session switched on) ==
- All pass: every node test named in the CI workflows (119 at Checkpoint 43, plus the ones this session adds), including owner-rules.mjs, conquest-allies.mjs (with section 9's rule), conquest-combat, conquest-authority, conquest-session, conquest-economy, conquest-ladder-check (its ±10% band and CC10 >= day 7 unchanged), conquest-first-hour, conquest-research, conquest-power-chip, conquest-loot, conquest-raids, conquest-replay-budget, super-timing, mod-behaviors, fair-arcade, arcade-weather and pvp-agree; the wtest suites conquest, conquest-research, research-economy, lab, lab-store, proof-mods, pvp, test, chassis, hull-plating, web-auth, conquest-airdrop, farm, load; plus every new test above. No test skipped, deleted or loosened; change a test only where a decision in this prompt changed its rule, and record it.
- Phone and computer equal, website and Telegram: conquest-session6b.py, conquest-onboarding.py, conquest-hub-browser.py and a new dev/tests/conquest-session6c.py (Hangar, COMMAND wheel, briefing strip, FORCE chip, the first wingman, a Wing and a Platoon fight, allies drawn in 3D) at 390x844, 390x700, 320x568 (touch) and 1366x768, 1920x1080 (real keyboard and mouse); extend a script where it lacks a size; perf.py.
- No new airdrop-points source; DAILY_CAP 50,000, the points table (CQ_PTS), quests and leagues unchanged.
- Never lower visual quality or resolution. No new 3D models: allies use the existing Meshy tanks, roles shown with insignia, HUD and existing effects; allies look as good as every other tank. Software-renderer frame numbers are relative only; no optimization loop.
- Comparable-game research is recorded in Checkpoint 43; add to it only if a new question needs it.
- Non-visual session: at most 2 UX critic rounds (a 3rd only for something clearly broken); phone and computer judged in the same round, against Clash Royale and the comparable games. The bar: exceptional, professional, stands out.
- Two fresh, independent, read-only reviewers (1: server authority, phone/Worker agreement of allies, fairness, security, record cost; 2: gameplay, economy, UX, section 9's rule) check every owner rule in this prompt and every design choice recorded in the checkpoint against the goal rules, PASS/FAIL with evidence. Fix every blocker, then re-review.
- Commit and push every tested slice. Keep Checkpoint 43 current with the resume point at the top. Never end a turn waiting on CI without a scheduled wake-up.

== RELEASE (pre-approved) ==
dev/bump.sh; PR (body from the checkpoint); CI green; merge; verify the Worker deploy (/pvp/health ok, live version.json = repo) and GitHub Pages from the deploy jobs; ROADMAP row 6C -> RELEASED with PR, merge and build; release record in Checkpoint 43; a docs-only follow-up PR if needed.
Final report: what changed; every labeled proposal (repair 6 alloy a pilot, chip pack 5 chips 299 Stars / 4.8 TON, liveries 399 / 199 Stars, and any new one); the VETERAN numbers before and after; every open item; the model's paces.
