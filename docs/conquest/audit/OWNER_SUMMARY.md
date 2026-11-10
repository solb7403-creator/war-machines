# Conquest fun, retention + economy audit — owner summary

Fable · Extra, Nov 10 2026. Read-only design audit of `main` at `36f9ba6` (build `20261110004649`, Session 5C live). Full evidence: [AUDIT_REPORT.md](AUDIT_REPORT.md). Your decisions: [DECISIONS.md](DECISIONS.md). Target design: [CONQUEST_1_0_SPEC.md](CONQUEST_1_0_SPEC.md). Sessions: [BUILD_PLAN.md](BUILD_PLAN.md).

**One line:** Conquest has an unusually complete skeleton (25 raids, a real town builder, server-authoritative economy, airdrop points) and almost no *feel*: a quiet opening, silent combat, nothing that happens to you while you are away, and no measurement. The fixes are mostly pacing, feedback and loop design, not new systems.

## Scores (1 = broken, 10 = best-in-class mobile)

| # | Area | Score | Why (short) |
|---|---|---|---|
| 1 | First 10 minutes | **4** | You spawn on an empty viaduct 274 m from anything, read 7 paragraphs, and your first enemies cannot hurt you (an interceptor needs 94 s to kill a stock tank). Your first town is ~60 min away. |
| 2 | Core loop | 6 | Every step exists and is server-verified. "Stronger tank" is the weak step: +1% hull per plate, hidden engineering percentages. |
| 3 | Session length / one more raid | 5 | 3–4 min raids suit phones. No in-session pull: repeat pay drops to 45%, no chain bonus, no timer worth chasing except the 2-hour Meteor. |
| 4 | Daily / weekly return | 4 | Daily Base Yield is a good appointment. No contracts board, no weekly goal, no streak, no Telegram alert when yield is full or your town was hit. |
| 5 | Pacing of ore / base / tank / points | 6 | Owner targets hold (regular: full Ferrite set 2 d, Ilmenite 8 d, Armalcolite 24 d, Tranquillityite 67 d; CC1 at 59 min, CC5 day 6, CC10 day 29; grinder ≈3–4× faster, never 10×). Two problems: Master+ players with a CC9 town hit the 50,000 cap in 37–55 min, and Moonheart takes 13 months. |
| 6 | Base building | 7 | Deep and personal (7 sites, 12 buildings, 11 turrets, blends, layouts, name, banner). Production is ~1/50th of fighting income, three buildings are shells, and nobody ever attacks the town. |
| 7 | Tank progression in Conquest | 5 | Engineering (57,200 CP) is invisible on the tank; plating is visible but tiny per step; mods/research missing. |
| 8 | Raids and defense | 6 | 25 raids, 5 commanders, doctrine, pity blueprint at 25: good. Defense is a replay you watch; no async raids, no revenge; VETERAN is the ceiling after week 3. |
| 9 | Variety | 5 | 6 fields + 25 raids + 8 strike sites + sector defenses. Open world is quiet (4 patrol routes). No bosses, no terraform modes yet. |
| 10 | Social pull | 3 | Visits, Base of the Week and a share card exist. No Conquest board, no squads, no alerts, nothing to brag about. |
| 11 | Visuals / wow | 5 | 5C made the town read as a town. The hub tank is a dark block, the world is one flat blue, the spawn sign reads mirrored, no kill or loot VFX. |
| 12 | Feel | 4 | One sound (`shot`) in all of Conquest; no hit marker, no damage numbers, no kill pop; haptics only when hit. |
| 13 | Spending players enjoy | 5 | The catalog is honest and earn-first. Nothing sellable yet; the levers players would love (town looks, plate finishes, second builder, Pass perks) are designed, not built. |
| 14 | Airdrop integrity | 6 | Strong server authority and exactly-once credit. One 2-minute mission unlocks the whole day's yield points (alt-farm), and field missions repay 100% every 3 minutes (bot-farm). |
| 15 | Measurement | 2 | Zero gameplay analytics. Only the signup funnel and anomaly flags exist. |

Average 4.9. Everything above 6 is server/economy plumbing; everything below 5 is what the player feels.

## The 10 biggest problems

1. **The opening does not hook.** Minute 0 shows three lines of economy text and a Meteor Strike 290 m away; the first fight is risk-free; the first "mine" moment (claim your town) is modeled at minute 59. Captures `02-world-first-view.png`, `05-first-fight.png`.
2. **Silent, numb combat.** `js/conquest/view.js` plays one sound; `js/fx.js` already has `hit`, `kill`, `boom`, `claim`, `meteor` that Arcade uses. No hit flash, numbers, kill pop or loot flyout.
3. **No reason to return tomorrow** except the yield meter. Contracts rotate every 30 min with a +20 CP tag nobody sees; no board, no weekly, no alerts (the alert hook writes `sent:0`, the bot never sends).
4. **Town defense has no consequence.** Walls and 42 turrets cost ~480,000 CP to max and only ever face the drill. Raiders never come while you are away.
5. **Quiet world.** 4 patrol routes, 14 spawn keys, one respawn generation a day. The brief promised a meaningful encounter every 1–3 minutes.
6. **Invisible power.** No Conquest power number; +1% hull per plate; engineering ranks are percentages in a menu. Players cannot feel their tank growing.
7. **Alt-account yield farm.** `activeToday` releases 1,000–2,600 base points of Daily Base Yield after one verified field mission (~2 min). Ten alts ≈ 20,000+ points a day for 30 minutes of play; new-account weighting halves only day 1.
8. **The cap lands on your best customers.** Master/Lunar Legend players with a CC9 town earn 50,000 in 37–55 minutes; the rest of their hour pays nothing (minerals and CP still flow, but the HUD does not say so).
9. **Shells and dead buttons.** Science Lab, Trophy Hall, Hangar "coming soon"; RESEARCH disabled on the hub; Refinery 0.8 alloy/h/level vs 18–26 alloy per 3-minute raid.
10. **Nothing is measured**, so none of the above can be proven fixed after a session ships.

Also found: the hub's pinned action row covers the YOUR BASE card text and the LIVE EVENTS title at 390×844 (`00-hub-new-account.png`); the viaduct "CORRIDOR" sign is mirrored at spawn; the CC ladder zig-zags (CC3 2,700 CP → CC4 1,700 CP).

## The 10 highest-impact changes

1. **New first hour.** Spawn at the Refuge under attack; a 60-second guided fight with one killable sentinel and a loot pop; 15-second radio instead of the 7-paragraph wall (full text stays in HELP); Starter Vein and first plate by minute 5; a cheap "claim your plot" (CC1) by minute ~20 with the old cost moved to CC2 (Decision 1).
2. **Feel pass with what exists.** Wire `fx.js` sounds, enemy hit flash, floating damage numbers, kill pop + loot flyout, haptics on kill, mute toggle. Cut HUD text at minute 0 to the mission line only.
3. **Loot v1** (your request): disclosed drop tables for mobs, elites, commanders, bosses and raids; rarity colors; pity counters; Trophy Hall fills; research parts feed Session 6B; nothing sold in the store ever drops (design below).
4. **Daily loop:** a CONTRACTS board (3 daily + 1 weekly) on the hub and HUD; soft return streak paying Conquest consumables and a cosmetic, never points; Telegram alerts: yield full, Meteor in 5 min, town raided.
5. **Living world:** 12 patrol routes, roaming hunter packs that grow as you hold sectors, ambushes at veins, an incursion near the player every ~10 minutes.
6. **Raids that come to you.** Session 7: PvE Parasite raids on your town while away (drill engine, persistent damage, exposed-store loot share, alert + replay + REPAIR), then player raids with revenge and shields.
7. **Power you can see.** A Conquest POWER chip (gear rating incl. plating + engineering), visibly different hull at each plate tier, mods + research in Session 6B.
8. **Close the farms.** Yield points unlock in 25% steps per verified operation; field-mission points taper like CP (100% → 60% → 40%); input-entropy flag for keyboard bots (the CI bot proves one works).
9. **Cap honesty.** Keep 50,000 (standing decision). When capped, the HUD says "CAP REACHED · loot, minerals and CP still drop" and loot tables stay live, so a capped hour is still worth playing.
10. **Twelve anonymous events** (session, world enter, mission start/end, death, bank, claim, build, raid start/end, gather, quit point) as daily counters plus D1/D7 cohorts, no personal data.

## Economy at a glance (modeled with the live rules; `model/audit-economy.json`)

| Pilot | First town | CC5 | CC10 | Full Ferrite / Ilmenite / Armalcolite / Tranq. sets | Points a day (Rookie → Master CC9) |
|---|---|---|---|---|---|
| Casual 2×15 min | day 2 (50 min played) | day 10 | day 93 | 4 / 14 / 37 / 96 d | 6,400 → 29,000 |
| Regular 60 min | 59 min | day 6 | day 29 | 2 / 8 / 24 / 67 d | 12,800 → 50,000 (capped at 55 min) |
| Grinder 4 h | 59 min | day 2 | day 9 | 1 / 2 / 10 / 36 d | capped by minute 234 → 55 |

Grinder vs casual: 3–4× faster at every tier. Fair. Epic (Selenite) sets take 148 d regular / 48 d grinder; Moonheart 384 d / 113 d: the legendary tier needs the competitive top rewards to be reachable at all for a regular.

## Loot design in short (full version in the spec)

- **Sources → tiers.** Interceptors/saboteurs: common (salvage, 1–2 Ferrite, consumables). Sentinels/coordinators (elites): uncommon (Ilmenite, consumables, 3% research part). Raid commanders: rare (Armalcolite, parts, 10% trophy, cosmetic fragments). World boss (new Hive Titan at every 6th Meteor site, per-pilot instance): epic (Tranquillityite, Selenite roll, trophy). Raid completion: a visible chest with the receipt.
- **What drops:** rare+ minerals (earn-only, small units), research parts (Session 6B), blueprint fragments for earn-only cosmetics (plate finishes, turret decals, banner emblems), Trophy Hall trophies, Conquest-only consumables (Repair Kit, Shield Cell, Scanner Charge, Decoy Beacon). All rates published in the wiki.
- **Never drops:** anything in `ConquestPlot.STORE` or the mineral crates, speed-ups, builders, airdrop points, or commons in crate-sized amounts (mob commons are 1–2 units; a crate is 150).
- **Pity:** every 20 elite kills without a part → part; every 10 commanders without a trophy → trophy; every 5 bosses → Selenite. Server-rolled, keyed to the kill id, shown as a counter.
- **Risk:** minerals stay cargo (50% loss on death, one unit never lost, 10-minute wreck). Parts, trophies, fragments and consumables are account-bound the moment you pick them up (Decision 5), so the loot pop never turns into a loss screen.
- **Ties:** parts → Science Lab research (mods); trophies → Trophy Hall; fragments → cosmetics on tank and town; consumables → the "one more raid" pull.

## What Session 5D will change (running in parallel, not pushed yet)

5D rewrites Arcade AI strength (`aiLevel`/`aiPower` in `js/rules.js`, `mkBot`/`mkBoss` in `js/game.js`, ghosts in `worker/src/eco.js`), fixes desktop keyboard driving in `js/conquest/view.js`, and fixes 5C leftovers in `plotview.js`/`hub.js` (spawn facing, BUILD at PEEK, sprites, ground tones). Its A2 check may touch `js/conquest/combat.js` enemy cooldowns. Nothing in this audit depends on those files' current form; the Conquest enemies are fixed authored archetypes (confirmed: `enemyStats` never reads the player's gear).

## Where to start

Read [DECISIONS.md](DECISIONS.md) (14 items, 10 minutes), then run Session 6 from [BUILD_PLAN.md](BUILD_PLAN.md). Everything else in the plan is decided.

Model: Opus · Extra — for Session 6 (multi-phase: opening, feel, loot, analytics); this audit's own follow-ups are documented per session in the plan.
