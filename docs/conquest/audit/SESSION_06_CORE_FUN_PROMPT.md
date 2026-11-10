LUNAR: War Machines — SESSION 6: CONQUEST CORE FUN (first hour, feel, loot v1, living world, daily loop, analytics)

Run at Opus · Extra effort. Read first: CLAUDE.md, AGENTS.md, docs/ROADMAP.md (Standing owner decisions), docs/economy/RESOURCE_ECONOMY.md, docs/conquest/IMPLEMENTATION_CHECKPOINT.md (newest checkpoint; 5D and 5E are released before this starts), docs/conquest/audit/OWNER_SUMMARY.md, docs/conquest/audit/AUDIT_REPORT.md (§1, §2, §3, §4, §9, §12, §14, §15), docs/conquest/audit/CONQUEST_1_0_SPEC.md (§1, §2, §4, §5.1, §5.6, §5.7, §6.1, §6.2, §11, §12, §16) and docs/conquest/audit/DECISIONS.md with the owner's answers. Work on a new branch from current main. Commit and push every tested slice; append a new checkpoint to IMPLEMENTATION_CHECKPOINT.md so another session can resume exactly where you stopped.

Release: ask the owner once at the start whether this release is PRE-APPROVED. If yes: when every acceptance gate passes, CI is green and two independent read-only reviewers have passed, merge, deploy (Worker + GitHub Pages), verify /pvp/health and version.json = repo, record it, update docs/ROADMAP.md. If not, stop at the PR with the full report. Payments stay disabled. Never end a turn waiting on CI without a scheduled wake-up.

Owner decisions this session uses (DECISIONS.md): 1 (first town), 2 (yield steps), 3 (repeat taper), 9 (scope: this session is the fun core; mods/research/audio/weather are 6B), 10 (production ×3), 11 (analytics in Firebase), 13 (CC price zig-zag). If an answer is missing, build the ★ default and say so in the report.

## Why (from the audit, Nov 10)
A scripted new pilot drove 88 simulated seconds to the first mission and LOST it with 0 kills (attackers 150 m away behind buildings; the arrow points at the processor). Minute 0 shows three economy lines and a Meteor the pilot cannot reach. Conquest plays one sound in total; there is no hit, kill or loot feedback. The first "mine" moment is an hour away. Nothing is measured. The world has 4 patrol routes. One 2-minute mission unlocks a day of yield points for alt accounts; field-mission points repeat at 100% every 3 minutes.

## Order of work: A (first hour) → B (feel) → C (loot v1) → D (living world + Sortie chain) → E (daily loop + anti-farm) → F (analytics) → models, reviews, release. A and B get the most care; C is the owner's explicit request.

## A. The first hour (spec §2) — decided
1. New spawn at the Refuge gate (~40 m from the terminal, facing the oxygen towers; pick a clear, server-authoritative spawn point in `createState` and the client; keep the old viaduct point as the fallback for existing saves that are mid-session).
2. The opening transmission becomes a 15-second HUD radio (two lines at a time, SKIP) over gameplay; the full text moves to HELP → REPLAY OPENING TRANSMISSION. Onboarding flag unchanged.
3. HOLD THE OXYGEN LINE is re-staged: wave 1 (two interceptors) spawns within line of sight of the new spawn and strafes the nearest tower; the sentinel is the wave-2 threat; activation radius 150 → 60 m for this mission. During any defense mission the HUD arrow points at the nearest living attacker; the objective keeps its own bar.
4. A failed operation's after-action names the cause and the fix (one line each; e.g. "The attackers came from the north-east. Follow the red arrow."), then RETURN.
5. Progressive HUD: at minute 0 only the mission line, HULL and HEAT. AIRDROP appears after the first credit, BASE after the first bank, METEOR after the town exists, CONTRACTS after the first contract. State in the save, not a timer.
6. Coach chain after the first mission: BANK → SCAN → GATHER the Starter Vein → BANK → FABRICATE the FRONT plate, one line at a time; the Starter Vein moves to the Refuge road within 40 m of the terminal (world data + `conquest-veins.js` migration of the once-ever flag).
7. Decision 1 default: CC1 claim = 600 CP + 30 alloy + 15 biomass + 2 He-3; CC2 = 1,950 CP + 80 alloy + 50 biomass + 6 He-3 (cumulative to CC2 and beyond unchanged). Decision 13 default: CC3 and CC4 = 2,200 CP each (cumulative to CC5 unchanged). Migrate nothing: no live players; a claimed town stays where it is.
8. The hub: fix the pinned action row covering card text at 390×844; the NO BASE card says "Claim your town: n / 600 CP".

## B. Feel pass (spec §12) — decided
- Wire `js/fx.js` sounds in Conquest: shot (exists), hit (enemy hit), kill, boom (deaths, hazards), dash, shield, claim (bank, collect), meteor (strike telegraph), warn (UNDER FIRE, low hull), win/lose (operation result), ready (SUPER ready). Mute toggle in MORE and Settings; respects the app's sound setting and reduced motion.
- Enemy hit flash (80 ms emissive) using the 5E hook or a uniform swap (no new program); floating damage numbers pooled (max 3 visible, 0.7 s, crit color for SUPER hits); kill pop (burst + "DESTROYED · INTERCEPTOR" ticker + light haptic); loot flyout from the drop to the HUD on pickup; rarity sounds.
- Controls: SCAN and GATHER become one context button (GATHER within 8 m of ore/flora, SCAN otherwise); LOCATE SELF moves into MORE. Keep every existing key binding.
- Nothing here changes damage, speed, ranges or rewards (presentation only; the 5D gear-fairness regression must stay green).

## C. Loot v1 (spec §4) — decided
- Data: one table `js/rules.js` `LOOT` (sources → rolls, rates, pity) shared by the Worker; one table of consumables `CQ_ITEMS`; cosmetic fragment pools `CQ_FRAG`. A node test asserts `LOOT` never contains an id present in `ConquestPlot.STORE`, the mineral crates or the Arcade catalog, and that no roll pays points.
- Rolls happen in `killLoot`, `missionReward`, `strikeReward`, `defenseOutcome` on the Worker with a hash of (kill id or attempt, source, pilot seed), stored in the receipt; the client never sends a roll. Minerals ride the existing outbox; parts, fragments, trophies and consumables are account-bound on pickup (stored in `conquest/<pid>.inv`, capped, never raidable) — Decision 5 default.
- Tables and pity exactly as spec §4.1 for mobs, elites, commanders, raid chest, Meteor Strike, invasion/town defense, contracts. The Hive Titan rows are 7B; leave the ids reserved.
- Drops in the world: glow sprite by rarity + one-word label; rare+ pauses the ticker for a card and a haptic; after-action lists drops under the tiles.
- Consumables (Repair Kit, Shield Cell, Scanner Charge, Decoy Beacon): one HUD slot opened from MORE or a long-press on SHIELD; server-validated use (`/api/conquest/action` `use-item`), cooldowns in `js/rules.js`, never usable in Arcade/PvP or the Home Sector; never sold.
- Trophy Hall shows trophies (5 commander types, Strike Core); +15 Town Score each; set → banner emblem. Fragments: 10 of a pool → one cosmetic from that pool, server-picked without repeats; pools are earn-only and disjoint from the store (plate finishes common, turret decals/banner emblems uncommon, animated seams/trail colors rare, town lighting/epic ornament epic). Research parts drop and are stored for 6B (no use yet; say so in copy: "RESEARCH PARTS · the Science Lab uses these soon").
- Wiki: a "Loot" section with every rate and pity counter; the collection screen shows the pity counters.
- Re-run `dev/tools/economy-model.mjs` with the loot minerals added; the owner's mineral targets must still hold (regular common 3–4 d, uncommon 1–2 wk, rare ~1 mo, very rare 2–3 mo); update RESOURCE_ECONOMY.md §5 and §16 of the spec.

## D. Living world + Sortie chain (spec §5.6, §5.7) — decided
- Patrol routes 4 → 12 (two per sector, authored in `combat.js` `patrols`, with spawn ids), hunter packs 1 + ⌊held sectors ÷ 2⌋ (2 interceptors + 1 coordinator, +1 sentinel in HARD sectors; hourly generation; world-kill points under the hourly limit), vein ambush (35% a sentinel pair at 20 s into a pull in HARD/VETERAN sectors), incursion (after 10 min of play without a fight, 3 raiders spawn 120 m from the pilot; never within 60 m of the Refuge or the gate zone). All authored archetypes; `enemyStats` stays archetype-only.
- Sortie chain: consecutive operation wins within 10 minutes → +10% CP and salvage per link, cap +30% at three, one rarity step on the raid chest at three; resets on death, RECALL or leaving. HUD meter. Points are not multiplied (keep the points formula untouched).
- Budgets: nearby-AI cap unchanged (`visibleRadius`, enemy counts per chunk); measure Worker step time with 12 patrols + 3 packs on the regression soak.

## E. Daily loop + anti-farm (spec §6.1, §6.2; Decisions 2, 3) — decided
- Contracts board: 3 daily + 1 weekly drawn from the pools in spec §6.1 at the UTC day/week from the pilot's seed; progress and claims on the Worker; rewards CP, consumables, fragments (never points beyond the activities). Hub card + HUD chip "CONTRACTS 1/3"; claim at the Refuge or the gate.
- Daily Base Yield points unlock in 25% steps per verified operation that UTC day (harvests count half) — Decision 2 default; meter copy "YIELD POINTS 50% · 2 operations to go". Materials part unchanged.
- Field-mission points: 100% for the first three completions of a mission in a UTC day, then 60%, then 40% — Decision 3 default. Raids unchanged. Update the briefing copy and the wiki.
- Decision 10 default: production ×3 (Refinery 2.4, Biodome 1.8, Helium Extractor 0.45 an hour per level), Storage caps ×2; hub "+N since you left". Re-run `conquest-base-progression.mjs`: CC timelines must stay within ±10% of the audit's table (regular CC5 day 6, CC10 day 29).
- Capped copy: when the daily cap is reached the HUD says "DAILY CAP REACHED · loot, minerals and CP still drop" (Decision 7 default).

## F. Analytics (spec §11; Decision 11) — decided
Twelve anonymous events as Firebase daily counters `an/<day>/<event>[/<key>]` (increments, like `fn/<day>/<step>`) and cohorts `an/cohort/<firstDay>/{d1,d7,d30}`; no personal data, no pid stored with an event; an admin-sheet tab reads them. Events: enter, transmission_skip/read, mission_start/end (id, outcome), death (cause, carrying), bank, claim_town (minutes bucket), build (type), raid_start/end (id, outcome, seconds bucket), gather (mineral), quit_point (last screen, minute bucket), session_minutes (bucket), return (d1/d7/d30). Write them from the Worker where the outcome is verified and from the client only for screens (quit_point, transmission). Rate-limited, best effort, never fails a request.

## Tests and acceptance
- Node: all Conquest suites + `conquest-regression.sh`; new: `conquest-loot.mjs` (tables, pity, disjointness, roll keying, account-bound inventory caps), `conquest-contracts.mjs`, `conquest-yield-steps.mjs`, `conquest-first-hour.mjs` (spawn point, activation radius, attacker arrow target, radio state, coach chain), `conquest-analytics.mjs` (counters, no PII), updated `conquest-base-progression.mjs`, `conquest-vein-economy.mjs`, economy model.
- Browser (Chromium 390×700, 390×844, 320×568; WebKit where the matrix runs): a brand-new account by real keyboard driving: radio → first fight won by following the attacker arrow → kill pop and loot flyout visible → bank → SCAN → Starter Vein → first plate → three field missions → CLAIM YOUR TOWN at ≤ 22 simulated minutes of play; the HUD shows only the mission line at minute 0; a consumable used; a contract claimed; the hub overlap fixed at 390×844; every new screen fits or scrolls. Record simulated minutes to each first-hour moment in the checkpoint.
- Captures to docs/conquest/session6/: minute 0, first kill pop, loot card, after-action with drops, contracts card, yield steps, capped HUD, 320/390 pairs.
- Economy guard and integrity guard as in BUILD_PLAN.md. Two independent read-only reviewers (security/economy: rolls, inventory, contracts, yield steps, taper, analytics privacy; gameplay/performance: first hour, feel, world density, Worker step time).

## Don't touch
Arcade AI and leagues (5D), payments, prices, Stars/TON/SOL, referrals, token economics, earned gear, plating numbers, the cap, the league factors, RECALL, mods/research (6B), audio ambience/weather (6B), town raids (7), boards (7B). No new 3D models (5E owns them; use its hooks).

## Final report (plain words, for the owner on a phone)
Simulated minutes to first fight, first kill, first loot, first plate, first town for the scripted new account before and after; the loot tables as shipped with their rates; the contracts pool; what the models say about mineral and CC timelines after the changes; the analytics counters and how to read them; what is live (build number) or waiting for approval; anything still open; the next session (6B Tank Lab).

Model: Opus · Extra — multi-phase build touching the opening, presentation, loot data, world authoring, daily systems and analytics, with economy re-validation.
