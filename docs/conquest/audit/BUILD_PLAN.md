# Conquest build plan — from the audit to Conquest 1.0

Fable · Extra, Nov 10 2026. The [spec](CONQUEST_1_0_SPEC.md) split into the fewest high-quality sessions. Each session ships a deployable vertical slice, follows `AGENTS.md` (lead agent, two independent read-only reviewers before merge for economy/combat changes, zero-loss checkpoints) and re-runs the economy and progression models when it touches numbers. Ready-to-paste briefs are in this folder (`SESSION_XX_*_PROMPT.md`); every brief is complete except the items in [DECISIONS.md](DECISIONS.md), which the owner answers before that session starts.

## Principles behind the split

1. **Fun before systems.** The first hour, feel and loot (Session 6) come before mods and research (6B): research consumes loot parts, and mods are worthless if fights are numb.
2. **Consequence before competition.** Raids that happen to your town (7) come before boards and squad wars (7B): boards need something to rank and raids to replay.
3. **Nothing waits on payments.** Sessions 6–7B are earn-only; Session 8 opens checkout on a catalog that already exists and has previews.
4. **One lead, tight parallelism.** Visual options (2–3 agents), independent reviewers (2), verification fan-out; never parallel edits in `combat.js`, `plot.js`, `conquest-sim.js` or the economy reducers.
5. **Models before merge.** `dev/tools/economy-model.mjs`, `dev/tests/conquest-vein-economy.mjs`, `conquest-base-progression.mjs` and the audit's `docs/conquest/audit/model/*.mjs` re-run in every session that touches rewards, costs or timers; the spec tables are updated in the same PR.

## New session order

| # | Session | Scope (one line) | Depends on | Model · effort | Brief |
|---|---|---|---|---|---|
| 5D | Fair Arcade + desktop driving + 5C leftovers | running now on its own branch | — | Fable · High (owner) | `../SESSION_05D_FAIR_ARCADE_PROMPT.md` |
| 5E | Models + Arcade 3D maps | all Meshy chassis/weapons/Moonbeam v9/town items, arcade maps; **plus the audit's visual priority list** (tank plate sockets, Parasite silhouettes, first-hour stage, loot/impact VFX hooks) | 5D merged | Opus · Max (owner) | `../SESSION_05E…` (owner's) + [SESSION_05E_VISUAL_PRIORITIES_ADDENDUM.md](SESSION_05E_VISUAL_PRIORITIES_ADDENDUM.md) |
| 6 | **Conquest Core Fun** | new first hour, feel pass, loot v1, living world, Sortie chain, contracts board, yield steps, repeat taper, HUD cut, analytics, CC ladder fixes | 5E merged (models for the kill pop and plates; can start on 5D if 5E slips: the feel pass uses existing meshes) | Opus · Extra | [SESSION_06_CORE_FUN_PROMPT.md](SESSION_06_CORE_FUN_PROMPT.md) |
| 6B | **Tank Lab** | mods + Science Lab research from loot parts, plate visuals per tier, POWER chip, zone power bands, audio pass, weather | 6 merged | Opus · Extra | [SESSION_06B_TANK_LAB_PROMPT.md](SESSION_06B_TANK_LAB_PROMPT.md) |
| 7 | **Living Town** | PvE raids while away, live defense, REPAIR flow, Telegram alerts, Strike Beacon, soft streak, garrison, then player raids + revenge + shields | 6B merged (garrison tanks carry mods; alerts need the bot) | Opus · Extra | [SESSION_07_LIVING_TOWN_PROMPT.md](SESSION_07_LIVING_TOWN_PROMPT.md) |
| 7B | **Competitive & Social** | live airdrop standing + trust line, Conquest boards, raid time-attack, Commander's Gambit, Hive Titan, squad territory wars, Colony Defense + two more terraform modes, settler contracts, living terraform, command fingerprints | 7 merged | Opus · Extra | [SESSION_07B_COMPETITIVE_SOCIAL_PROMPT.md](SESSION_07B_COMPETITIVE_SOCIAL_PROMPT.md) |
| 7.5 | Graphics 2.0 | lighting, post-processing, PBR models, VFX upgrade, weather post, day cycle; quality tiers | 7B | Opus · Max | roadmap (unchanged) |
| 7.8 | Security | email scrub, secret scan, token rotation | any time after 6 | Opus · High | roadmap (unchanged) |
| 8 | Payments certification + store wave 1 | Stars/TON/SOL, website shop, Decision 12 wave, previews, limits | 7B | Opus · Extra | roadmap + spec §9 |
| 9 | Full game audit | | 8 | Fable · Extra | roadmap |
| 10 | Closed beta, promotion | | 9 | — | roadmap |

What moved: the old Session 6 (mods + lab + audio + weather) becomes 6 + 6B with the fun core first; the old Session 7 is split into 7 (your town is attacked, alerts, streak) and 7B (ladders, squad wars, terraform modes, Titan, Gambits, anti-cheat); the "see and drive your own town" item shipped in 5C; the audit's analytics and anti-farm fixes land in 6 so every later session can be measured. 7.5, 7.8, 8, 9, 10 keep their place; 7.8 can run any time after 6 since it touches no gameplay.

## Owner decisions per session

- Before 6: Decisions 1, 2, 3, 9, 10, 11, 13. (Defaults are the ★ options; a brief uses them if no answer arrives.)
- Before 7: Decisions 4, 5, 6, 8.
- Before 7B: Decision 14.
- Before 8: Decision 7 (cap messaging; the cap itself stays), Decision 12 (first wave) and prices.

## Acceptance gates common to every session

- All node suites in the Conquest CI list + `bash dev/tests/conquest-regression.sh` green; the 5D gear-fairness regression test green (no enemy path reads the player's gear).
- Browser journeys at 390×700, 390×844 and 320×568 (Chromium; WebKit where the matrix runs) covering every new screen: fits or scrolls, primary action on screen.
- Economy guard: `economy-model.mjs --write`, `conquest-vein-economy.mjs`, `conquest-base-progression.mjs`, `docs/conquest/audit/model/audit-economy.mjs` re-run; owner targets still hold (regular common 3–4 d, uncommon 1–2 wk, rare ~1 mo, very rare 2–3 mo; grinder < 6× regular; no instant max-out).
- Integrity guard: exactly-once credit tests, cap-shared test, hourly limit, the loot/store disjointness test (from 6), the fingerprint flags (from 7B).
- Two independent read-only reviewers (security/economy + gameplay/performance) before merge; findings fixed and recorded in the checkpoint.
- Analytics events present for every new flow (from 6).
- Checkpoint appended to `docs/conquest/IMPLEMENTATION_CHECKPOINT.md`; `docs/ROADMAP.md` status column updated at release.

## Session summaries

### 5E addendum (visual priorities, with the owner's model list)
Tank first (hub, world, Home Sector; four plate sockets per chassis so plating reads at each tier); Parasite archetypes with distinct silhouettes and a clear hostile read; the first-hour stage (Refuge gate spawn point, oxygen towers, the viaduct sign fixed); Moonbeam v9 and the 12 town items; loot glow sprites, hit-flash material and kill burst as reusable VFX hooks for Session 6. Full list in the addendum.

### Session 6 — Conquest Core Fun (Opus · Extra, ~1 week)
Phases: (A) first hour: Refuge spawn, radio, staged first wave, attacker arrow, activation radius, coach chain, Starter Vein move, CC1/CC2 split, CC3/CC4 fix; (B) feel: nine fx sounds + mute, hit flash, damage numbers, kill pop, loot flyout, haptics, progressive HUD, 8 touch targets; (C) loot v1: drop tables, rarity sprites, consumables, fragments, pity, Trophy Hall fill, wiki odds, disjointness test; (D) living world: 12 patrols, hunter packs, vein ambush, incursion; Sortie chain; (E) daily: contracts board, yield steps, repeat taper; (F) analytics: 12 events + cohorts + admin tab; (G) models, reviews, release. Deliverable: a new account that laughs in minute 1, owns a town by minute 22, and whose first-session funnel is measurable.

### Session 6B — Tank Lab (Opus · Extra, ~4–5 days)
Science Lab research tree (4 tracks, 3 lab levels, parts + CP + timers) producing mod blueprints into the garage `FITS` system at full strength everywhere and counted in gear rating; plate visuals per tier on every chassis (with 5E's sockets); POWER chip on HUD/hub and zone bands on map/briefings; audio pass (zone ambience, weapon/impact, UI/reward, stingers); weather (dust storms barren, rain/fog terraformed, telegraphed, budgeted). Deliverable: a tank you can feel getting stronger, in a world that sounds and weathers.

### Session 7 — Living Town (Opus · Extra, ~1 week)
PvE raids while away (schedule, drill engine, persistent damage, exposed-store share, log, replay, REPAIR), live defense window (pays defense points), peace shields, garrison from the Hangar, Telegram alerts (yield, Meteor, raided, Beacon), Strike Beacon, soft return streak; then player raids (bands by defense rating, 3-minute attack in a Home Sector copy, 5/10/15% exposed steal, zero on failure, revenge, free/earnable shields; anti-abuse). Deliverable: a town that is worth defending because something attacks it, and a phone that tells you when it happened.

### Session 7B — Competitive & Social (Opus · Extra, ~1 week)
Live airdrop standing on the hub with the trust line; Conquest boards (weekly Town Score gain, defense rating, raid time-attack per layout, Titan damage, campaign score); Commander's Gambit; Hive Titan (per-pilot instance, shared board, top rewards); squad territory wars; Colony Defense, Bridge Assault and Convoy Run on existing engines (Blight Purge and Forest Hunt as content if time allows); settler contracts and reputation; living terraform (pylons/blight follow the warfront); Conquest command fingerprints and alt signals; share moments. Deliverable: a reason to be seen, a ceiling for top kits, and anti-cheat the airdrop can stand on.

### Sessions 7.5, 7.8, 8, 9, 10
Unchanged from the roadmap, with 7.5 taking the spec's graphics list (§14), 8 taking the catalog, first wave and guardrails (§9) and 9 re-running this audit's method end to end (play, model, read, benchmark) on the finished game.

## Risks and how the plan handles them

- **5E slips.** Session 6 can start on 5D's merge: the feel pass works on today's meshes; plate sockets are only needed by 6B.
- **Numbers drift.** Every session re-runs the models and updates `RESOURCE_ECONOMY.md` in the same PR; the vein test and the audit model are the guard rails.
- **Scope creep inside a session.** Each brief has a "Don't touch" list and a "Not this session" list; the owner's mid-session messages override (AGENTS rule), everything else waits.
- **Owner decisions late.** Each brief carries the ★ defaults; a session never stalls on a decision.

Model: Opus · Extra — for every build session in this plan; Fable · Extra for Session 9's audit.
