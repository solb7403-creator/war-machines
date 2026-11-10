LUNAR: War Machines — SESSION 7B: COMPETITIVE & SOCIAL (live airdrop standing, boards, Commander's Gambit, Hive Titan, squad wars, terraform modes, settler contracts, anti-cheat)

Run at Opus · Extra effort. Read first: CLAUDE.md, AGENTS.md, docs/ROADMAP.md (Session 7 competitive items, Terraform-zone game modes, Terraform audit additions, Standing owner decisions), docs/economy/RESOURCE_ECONOMY.md (§3.4 flags, §5.4 strike, §5.5 top competitive rewards), docs/conquest/IMPLEMENTATION_CHECKPOINT.md (Session 7 checkpoint), docs/conquest/audit/CONQUEST_1_0_SPEC.md (§5.2, §5.4, §5.8, §5.9, §8, §10), docs/conquest/audit/AUDIT_REPORT.md (§8, §9, §10, §14), DECISIONS.md (14), `worker/src/conquest-warfront.js` (shared CAS document pattern), `worker/src/farm.js` and `eco.js` flags, `js/conquest/world.js` terraform data (`TERRA`, pylons, blight). New branch from current main. Commit and push every tested slice; append a checkpoint.

Release: ask the owner once whether PRE-APPROVED; if yes, merge/deploy/verify when all gates pass and two independent reviewers have passed; otherwise stop at the PR. Payments stay disabled.

## Why
Social pull scored 3/10 and variety 5/10: no Conquest boards, no squads, nothing to brag about, no bosses, no terraform modes, VETERAN is the ceiling after week 3. The airdrop standing is invisible in Conquest. The Conquest command-fingerprint flags deferred in Session 4 are still missing, and keyboard bots demonstrably work.

## Order: A (live standing + trust line + fingerprints) → B (boards + raid time-attack) → C (Commander's Gambit) → D (Hive Titan) → E (squad territory wars) → F (terraform modes + settler contracts + living terraform) → reviews, release. A is the airdrop's credibility and comes first.

## A. Live airdrop standing, trust line, fingerprints — decided
- Hub card: "AIRDROP · you're #842 · 1,200 pts to top 800 · today 12,840 / 50,000" from the existing snapshot rank (`ac`, `players/<pid>/ac`) and the daily number; refreshed on session open and every 60 s while on the hub; cached first paint. Copy never promises tokens (AIRDROP.dist stays tracking-only).
- Trust line: "verified play 94%" = share of the pilot's last 30 days without flags; a flagged pilot sees "under review" and the rule (existing: plays on, sits out the snapshot until cleared).
- Conquest command fingerprints (spec §10): per operation record steering entropy, firing cadence variance, completion-time variance and a coarse path hash (server-side from the commands already replayed; ≤ 200 bytes per operation, last 20 kept). Flags: `cqrepeat` (3 near-identical operations in a day), `cqnoinput` (zero steering variance in 3 operations). Alt signals: identical town layout hash across accounts sharing a device/network link, identical daily activity windows, same Strike Beacon minute → `cqalt` cluster hint for the admin sheet. Flags raise through `addFlags` like `cqppm`; nothing bans; one admin-sheet row per flagged cluster with clear.

## B. Boards and raid time-attack — decided
- Five weekly boards as small CAS documents (`cqboard/<kind>/<week>`, top 100 by score with name, league pill, Town Score): weekly Town Score gain, defense rating, raid time-attack (best verified completion time per raid layout, from receipts), Hive Titan damage (D), campaign score. Pilots under review are left off (as `cqtop`). Rewards at week end: Titan board top 100 → 1 Selenite, top 10 → 1 Moonheart, 30-day top 3 → 2 Moonheart (RESOURCE_ECONOMY §5.5 top competitive rewards, finalized here); every other board top 100 → 1,500 CP + 1 rare fragment. Hub card + a BOARDS screen; share card for a top-100 finish.
- Time-attack: the Worker stamps verified completion seconds in raid receipts; the briefing shows your best and the week's top; Gambits (C) count on a separate line.

## C. Commander's Gambit — decided
Before a VETERAN raid the pilot may stack up to three modifiers: No Shield (+15%), Double Reinforcements (+20%), Enraged from the start (+25%), Dust Storm (+15%, uses 6B weather). Rewards multiply CP, salvage and loot quality (one rarity step on the chest at three); points use the VETERAN value × (1 + modifier total) capped at +60% (1,300 → 2,080), inside the hourly limit and the cap. Server validates the chosen set at start and in the receipt; the regression sims prove each modifier lowers win rate for a full legendary kit without ever reading the player's gear.

## D. Hive Titan (Decision 14 default a) — decided
Every 6th Meteor Strike slot (slot % 6 === 0) spawns the Titan after the core extraction: authored 9,000 HP, three phases (charge + slam, burrow + swarm, plasma rain with telegraphed rings), 4-minute clock, per-pilot instance in the pilot's world, fixed stats. Damage dealt (server-simulated) posts to the weekly Titan board; the kill pays 1,600 base points once per slot plus loot (spec §4.1 Titan row: 2 Tranquillityite, 25% part, 20% Selenite, 2% Moonheart, 30% trophy, 10% epic fragment; pity 5 Titans → Selenite). Telegraph on the hub and HUD ("TITAN SLOT · 18:00 UTC"); the Strike Beacon can call a Titan slot only if it is the current slot.

## E. Squad territory wars — decided
Squads = the existing referral squads (`squadRows`). Weekly: members' verified sector captures and held defenses sum to a squad score; a squad board; the winning squad's banner flies at the warfront monument (1030,1120) and in every member's hub for the next week; members get a fragment. No new currency, no squad store, no mandatory grouping.

## F. Terraform-zone modes, settler contracts, living terraform — decided
- Colony Defense: the town-raid engine on the frontier wall and farms (authored layout per colony sector), the pilot places colony turrets from a budget before waves, fights live; 675 base points, defense cache, settler reputation.
- Bridge Assault: hold three bridge points on the creek against waves for 4 minutes; 900 base points (HARD par).
- Convoy Run: escort a settler convoy along colony roads under ambush (the rescue family's escort logic); 900 base points.
- Blight Purge and Forest Hunt as content if time allows (450 / 675 points), same engines; otherwise listed for the next content session.
- Settler contracts: every 10 settler homes in the pilot's town post one contract a day (deliver 20 biomass, escort a harvest, defend farms, clear blight); reputation unlocks settler vendors (consumables for biomass), decorations, the market square cosmetic. No points beyond the activity.
- Living terraform: held sectors activate pylons and grow the zone; lost defenses let blight spread (world data toggled by the shared warfront stage; visuals via the existing `TERRA`/blight functions; capped change per week so the Moon stays 30–40% terraformed).

## Tests and acceptance
- Node: all Conquest suites + regression; new `conquest-standing.mjs`, `conquest-fingerprints.mjs` (flags fire on the CI keyboard bot's recorded inputs and never on recorded human-variance fixtures), `conquest-boards.mjs` (CAS, held pilots excluded, week rollover, rewards once), `conquest-gambit.mjs` (validation, caps, win-rate monotonic drop with the 5D sim harness), `conquest-titan.mjs` (phases, per-slot once, board post, loot/pity), `conquest-squad-wars.mjs`, `conquest-terraform-modes.mjs` (each mode start/finish/fail/death/reconnect, rewards once), updated economy model (Titan and Gambit points inside the cap; the 1,600/2,080 values per the par method).
- Browser: hub standing card; boards screen; a Gambit raid; a Titan fight to the board; squad banner at the monument; Colony Defense and Bridge Assault journeys; every screen fits or scrolls at 390×700, 390×844, 320×568.
- Captures to docs/conquest/session7b/.
- Two independent read-only reviewers (security/economy: boards and rewards, fingerprints false positives, Gambit validation, Titan once-per-slot; gameplay/performance: Titan budget on LOW, mode fairness, flow).

## Don't touch
Arcade AI and leagues, payments and prices, the cap and league factors, plating/mod numbers, town raid settlement (7), loot tables except the Titan row, RECALL. Nothing here promises tokens or changes airdrop credit rules.

## Final report
The standing card and trust line; which flags fired on the bot fixtures and not on humans; the five boards and their rewards; Gambit win-rate table (stock → legendary) per modifier; Titan kill rates by kit; squad war rules; modes shipped and their points; live build or PR; open items; next (7.5 Graphics 2.0, 7.8 Security, 8 Payments).

Model: Opus · Extra — boards, a boss, modes and anti-cheat across client and Worker with airdrop-facing rewards; two reviewers mandatory.
