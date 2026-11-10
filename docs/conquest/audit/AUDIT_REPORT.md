# Conquest fun, retention + economy audit — full report

Fable · Extra, Nov 10 2026. Brief: [CONQUEST_FUN_AUDIT_BRIEF.md](../CONQUEST_FUN_AUDIT_BRIEF.md). Audited: `main` at `36f9ba6` (live build `20261110004649`, Session 5C released; Session 5D running in parallel on its own branch, not pushed at audit time). Read-only: no gameplay code was changed. Summary for the owner: [OWNER_SUMMARY.md](OWNER_SUMMARY.md).

## Method

1. **Played it.** The shipped client against the real Worker reducer on a disposable local DB (`dev/tests/conquest-server.mjs`), Chromium 390×844 with touch, software GL. A brand-new account was driven by real keyboard input along `ConquestWorld.route` paths (the HUD arrow's own rules): spawn → first mission → fight → after-action → Refuge → SCAN → vein → Command Gate. An advanced fixture (CC10 ridge town, veteran loadout, all field missions cleared) covered the hub, Home Sector, the five tabs, a drill and a raid site. Captures: `captures/` (listed per area; `captures/playtest-log.json` has the event log). Software-GL frame times are not phone times; durations below use simulated seconds and the route model.
2. **Measured the economy** with the live rules and the real Worker reward/plot functions: `model/audit-economy.mjs` → `model/audit-economy.json` (casual 2×15 min, regular 60 min, grinder 4 h) and `model/first-ten-minutes.mjs` → `model/first-ten-minutes.json` (route lengths, tank speed, time-to-kill per archetype). Same modeling method as `dev/tools/economy-model.mjs` and `dev/tests/conquest-base-progression.mjs`; not a human playtest.
3. **Read every Conquest system**: `js/conquest/*` (app, view, combat, world, controls, session, plot, plotview, townkit, hub, catalog, discovery, progress, sheet, style), `worker/src/conquest*.js`, `js/rules.js` constants, `worker/src/eco.js` credit and flags, the economy spec, the 5/5B/5C/5D briefs and Checkpoints 24–29.
4. **Benchmarked** against what keeps the best phone strategy/action games sticky (clear core loop, reward cadence under 90 s, appointment mechanics, visible power, social pressure, mastery ceilings) and kept only what fits LUNAR's fiction, phone sessions and standing decisions.

## Scores

| # | Area | Score |
|---|---|---|
| 1 | First 10 minutes | 3 |
| 2 | Core loop | 6 |
| 3 | Session length / "one more raid" | 5 |
| 4 | Daily and weekly reasons to return | 4 |
| 5 | Pacing: ore, minerals, base, tank, points | 6 |
| 6 | Base building | 7 |
| 7 | Tank progression inside Conquest | 5 |
| 8 | Raids and defense | 6 |
| 9 | Variety | 5 |
| 10 | Social pull | 3 |
| 11 | Visuals / wow | 5 |
| 12 | Feel | 4 |
| 13 | Spending players enjoy | 5 |
| 14 | Airdrop integrity | 6 |
| 15 | Measurement | 2 |

---

## 1. First 10 minutes — 3/10

**What happens (measured).**

| Moment | Where it is | Evidence |
|---|---|---|
| Spawn | Viaduct west ramp (898, 1024), facing a mirrored "CORRIDOR" sign | `captures/02-world-first-view.png` |
| First enemy you can see | None on screen. The nearest are a `refuge-scout` interceptor 96 m away and a coordinator at 140 m, off camera | `playtest-log.json` "spawn" |
| First mission (HOLD THE OXYGEN LINE) | 274 m by route = 62 s of driving at the stock 4.4 m/s | `model/first-ten-minutes.json` |
| Refuge terminal (bank, repair, plating) | 338 m from spawn = 77 s | same |
| Command Gate (MY BASE) | 230 m from spawn; the HUD shows it from second 0 | `02-world-first-view.png` |
| First fight | Three waves: 2 → 2 → 3 enemies (interceptor + saboteur + coordinator). Stock Pulse kills an interceptor in 1.3 s, the whole mission in ~11 s of firing. An interceptor needs 94 s to kill a stock tank (1,700 HP vs 18 DPS) | `js/conquest/combat.js` `archetypes`, `formations`; model |
| **First fight, as played** | Our scripted pilot drove the real route (87.8 simulated seconds from spawn), started the mission from the ACT button at the activation radius and then held FIRE while driving toward the HUD arrow. It **lost**: "DEFENSE LOST · 0 HOSTILES DESTROYED · 2:04 · HULL 98%". The attackers spawn at (1218–1240, 995), ~108 m north-east of the processor and ~150 m from the activation point, beyond the Pulse Cannon's 92 m range and behind colony buildings; the HUD arrow points at the processor, not at them; the processor's 1,800 HP falls in about two minutes. CI's living-war bot wins the same mission with an A* path to the attackers, so it is a guidance problem, not an impossibility: a pilot who does not know to drive past the objective to the north-east loses the first mission with no explanation and no payout | `captures/05-first-fight.png`, `06-after-action-first-mission.png`, `playtest-log.json` "mission-end" |
| First loot | 250 CP + 450 base points + ~3 Ferrite, shown as after-action tiles; salvage caches on the ground | `worker/src/conquest-economy.js` `missionReward`, `cacheMinerals` |
| First upgrade | Engineering rank 1 (100 CP + 4 alloy) at Refuge Supply: a +9% heat-capacity line in a menu | `combat.js` `costs`, `tracks` |
| First plate | 40 Ferrite + 300 points; needs the Starter Vein (35 Ferrite), which needs SCAN; modeled at minute 12 | `js/rules.js` `PLATE`, economy spec §7.3 |
| First building | CC1 = 2,550 CP + 110 alloy + 65 biomass + 8 He-3, modeled at minute 59 (casual: minute 50 of play on day 2) | `model/audit-economy.json` |
| First "wow" | The town tour on first Home Sector entry (5C). Only after CC1 | Checkpoint 29 |

**What is wrong.**
- Minute 0 is a wall of system text: three HUD lines (AIRDROP TODAY 0 / 50,000; BASE 0/2550 CP | 0/110 ALLOY …; METEOR STRIKE OPEN · RESERVOIR FLATS · 19:32 LEFT) before the player has moved (`02-world-first-view.png`). The Meteor Strike is 290 m away and HARD-tier; a stock pilot who follows it dies.
- The opening transmission is seven paragraphs behind a scroll region (`01-opening-transmission.png`, `app.js` `transmission()`); it is good fiction, delivered at the worst moment (before the first input).
- The first fight has no danger and no feedback (see §12). The enemies die in a second each; the objective processor never gets close to falling for a pilot who simply holds FIRE.
- The first "this is mine" moment (claim a site, name the town) is an hour away for a regular and two days for a casual. The hub tells a brand-new account "0 / 2,550 CP banked" (`00-hub-new-account.png`), which reads as a wall, not a goal.
- The guided resource step (SCAN · FIND ORE pulse, first-entry tip) exists and works, but the first plate is only +1% hull: nothing on the tank changes that a player notices at 390 px.
- Bug: the hub's pinned action row covers the YOUR BASE card text and the LIVE EVENTS title at 390×844 on first paint (`00-hub-new-account.png`). The page scrolls, but the first impression is clipped copy.
- The first mission can be started 150 m from the fight (`activationRadius:150`) and its arrow points at the objective, not the attackers; a failed first mission says "No payout for a failed operation" and nothing about what to do differently (`06-after-action-first-mission.png`).
- Refuge Supply opens on five lines of zeros and a paragraph before the two buttons a new pilot needs (`10-refuge-supply-engineering-plating.png`); the plating cards are the right idea, buried under the ledger.
- The spawn-to-mission drive took 87.8 simulated seconds along the route the HUD uses (the straight-line estimate is 62 s): a minute and a half of nothing before the first input that matters.

**Fixes (Session 6, decided unless marked).**
- Spawn at the Refuge gate with the oxygen towers under attack: two interceptors strafing within 20 s and one sentinel (7.9 s to kill, can hurt you) as the first real target, so the first 60 seconds contain a visible fight, a kill pop and a drop.
- During a defense mission the HUD arrow points at the nearest living attacker (the objective keeps its own bar); the first mission's activation radius drops to 60 m and the first wave spawns within line of sight of the activation point; a failed operation's after-action names the cause and the fix ("The attackers came from the north-east. Follow the red arrow next time").
- The transmission becomes a 15-second radio over gameplay with SKIP; the full text stays in HELP → REPLAY OPENING TRANSMISSION.
- HUD at minute 0: mission line only. AIRDROP, BASE and METEOR lines appear after the first bank (progressive disclosure).
- Starter Vein on the Refuge road within 40 m of the terminal; the coach walks SCAN → GATHER → BANK → FABRICATE in one chain, first plate by minute 5, with a visible hull change (plate slabs on the glacis are already modeled for HIGH).
- Decision 1 (★ split CC1 into a 600-CP claim at minute ~20 and the old cost at CC2).
- Fix the hub overlap and the mirrored sign (5D is already touching `hub.js`; the sign is `style.js`).

## 2. Core loop — 6/10

Explore → fight → loot → bank → build → stronger tank → harder zones: every link exists and is server-verified (kills `killLoot`, missions `missionReward`, bank `bank`, build `plotAction`, plates `/api/act plate`, raids HARD → VETERAN).

**Weak links.**
- *Stronger tank* is the weakest: a full Ferrite set is +4% hull; engineering is eight ±9–10% tracks (`combat.js` `tracks`) with no readout in the world. The economy spec's own table (§6.3) says a full Ferrite set moves gear rating +1.5%: real but not perceivable.
- *Next goal visible* only inside dialogs ("NEXT MEANINGFUL MILESTONE" in the collection dialog, `app.js:302`) and the coach inside the town. The world HUD shows distance to the current objective but not *why* (reward) or *what next* after it.
- *Harder zones* are labelled on operations (STANDARD/HARD/VETERAN) but the open world has one difficulty: the same four archetypes everywhere, no danger map, no zone tiers on the region map (`03-region-map-new.png` shows missions, ore, settlers; no threat shading).
- *Loot* is CP/materials/minerals; nothing drops that you did not already expect (see the loot design in the spec).

**Fixes.** A persistent "NEXT" chip on the HUD (one line: goal, reward, distance) driven by one rule (`guidance()` already computes the target); threat shading on the region map by sector tier; the POWER chip (§7); loot v1 (spec §Loot).

## 3. Session length and the "one more raid" pull — 5/10

- Raid cadence fits phones: 3.3 min (HARD) to 4 min (VETERAN) including travel; `missionRepeat` 180 s; RECALL 15 s channel / 10 min cooldown; fast travel between held sectors.
- The pull after a win is weak: repeat CP falls to 70% (daily) then 45% (`missionReward`), points stay 100% (§14), no chain, no multiplier, no "next raid is featured" prompt. Contracts (`conquest-campaign.js` `s.contracts`: two featured operations rotating every 30 min, +20 CP) are the only in-session timer and the +20 CP is invisible against a 180–320 CP raid.
- Banking trips are good tension (50% carried loss on death, 10-minute wreck) and cost 1–2 minutes a cycle (Refuge → nearest HARD raid 380 m = 86 s each way). A CC with a Storage Depot banks at the gate, which is 95 m from the Refuge, so the base does not shorten the loop much.
- Death is cheap in the field (interceptors cannot kill you) and expensive only when carrying; nothing in between.

**Fixes.** A visible **Sortie chain**: each consecutive operation win within 10 minutes adds +10% CP and loot quality (cap +30%, resets on death or RECALL), shown as a HUD meter; Conquest consumables from loot (Repair Kit, Shield Cell) that are only worth using *now*; the Strike Beacon (Decision 4) as the "one more" button; the featured contract shown on the HUD after every after-action.

## 4. Daily and weekly reasons to return — 4/10

**Exists:** Daily Base Yield (24 h fill, collect from 10%, points gated by one verified activity: `baseYield`, `base-claim`); contracts rotating every 30 min; "3 operations today → +100 CP" (`s.orders`); Meteor Strike every 2 h on the even UTC hour; base-defense alerts every 20 min (`defense.nextAt`, UI retired in 5C); sector defense alerts (`defenseAt` 20 min after capture); weekly league minerals (Arcade/PvP matches only, `MN_WEEKLY`); Base of the Week (largest weekly Town Score gain).

**Missing:** a contracts board the player can read in one glance; any weekly goal in Conquest; a return streak; a reason to open the game at a specific time of *their* day (the Meteor clock is UTC: a US-evening player sees 2–3 of 12); any push: `plot.alerts` is written with `sent:0` and the Telegram bot never sends (Session 7 hook); the yield meter is only visible in-game.

**Fixes.** CONTRACTS board (3 daily, 1 weekly; hub card + HUD chip; rewards: CP, consumables, one cosmetic fragment a week; never points beyond the normal activity points); soft return streak (Decision 8); Telegram bot messages for yield ≥ 90%, Meteor in 5 min at your last site, town raided (Session 7); Strike Beacon (Decision 4).

## 5. Pacing — 6/10

Measured with the live rules (`model/audit-economy.json`; same method as the spec's model):

| Pilot | CC1 | CC2 | CC5 | CC7 | CC9 (×1.25) | CC10 |
|---|---|---|---|---|---|---|
| Casual 2×15 min | day 1.8 (50 min played) | day 3.3 | day 10 | day 22 | day 43 | day 93 |
| Regular 60 min | 59 min | day 1.8 | day 6 | day 9 | day 17 | day 29 |
| Grinder 4 h | 59 min | 102 min | day 1.9 | day 3 | day 5.8 | day 8.8 |

| Pilot | Full Ferrite | Ilmenite | Armalcolite | Tranquillityite | Selenite | Moonheart |
|---|---|---|---|---|---|---|
| Casual | 4 d | 14 d | 37 d | 96 d | 177 d | 438 d |
| Regular | 2 d | 8 d | 24 d | 67 d | 148 d | 384 d |
| Grinder | 1 d | 2 d | 10 d | 36 d | 48 d | 113 d |

Airdrop points a day (Conquest only, modeled rates × league pay × Command Base, + yield):

| Pilot | Rookie, stock, no base | Pilot, common, CC3 | Veteran, rare, CC5 | Master, epic, CC9 | Lunar Legend, CC10 |
|---|---|---|---|---|---|
| Casual | 6,420 | 10,590 | 14,622 | 29,044 | 41,360 |
| Regular | 12,840 | 19,655 | 27,120 | **50,000 (capped at 55 min)** | **50,000 (capped at 37 min)** |
| Grinder | 50,000 (234 min) | 50,000 (160 min) | 50,000 (115 min) | 50,000 (55 min) | 50,000 (37 min) |

**Verdicts.**
- Owner targets hold for the regular (common 3–4 d → 2 d is slightly fast because the 60-minute regular is above the spec's 45; uncommon 1–2 weeks ✓; rare ~1 month ✓; very rare 2–3 months ✓). Grinder ≈ 3–4× casual at every tier, never 10×: fair, thanks to the vein caps.
- No instant max-out: CC10 is 9 days even for a grinder; the CP ladder is now huge (engineering 57,200 + CC 36,750 + every building maxed 334,787 + 42 turrets maxed ≈ 480,000 ≈ 909,000 CP), so CP keeps mattering for months. Good.
- **Wall 1:** the cap lands on Master/Legend regulars (37–55 min). The HUD shows "DAILY CAP REACHED" with no hint that loot, minerals and CP still flow (`app.js:262`). Decision 7.
- **Wall 2:** Moonheart at 13 months regular / 15 months casual. Only competitive top-10/top-3 rewards (not built) make it reachable. The world boss (Decision 14) and Resonance keep it "long-term" rather than "never".
- **Wall 3 (early):** the casual's first town on day 2 and CC5 on day 10. Decision 1 moves the first town into session 1 for everyone.
- Zig-zag: CC3 2,700 CP → CC4 1,700 CP (Decision 13).
- Base production is ~1/50th of fighting income (Refinery 0.8 alloy/h/level → ~25 alloy/day at CC5 vs 18–26 per 3-minute raid). Decision 10.

## 6. Base building — 7/10

**Depth that exists:** 7 sites with real terrain and lanes; CC1–10 town growth 45→77 cells; 12 buildings with levels and power budget; Foundry → composite; 19 wall blends from six ores with strength/durability/reflect; wall tools LINE/RECT/RING/COPY/PASTE; 11 turrets with distinct roles; vitals; defense rating; 3 layout slots; REPAIR; town name, banner, theme, decorations; Home Sector you drive in; diorama on the pad; HUD thumbnail; visits; Base of the Week; share card. This is a real builder.

**Shallow.**
- Production numbers are too small to notice (above). The COLLECT button is pressed out of habit, not desire.
- Science Lab, Trophy Hall and Hangar are shells ("coming soon", `plot.js` `BUILDINGS.lab/trophy/hangar` desc). The hub's RESEARCH button is disabled (`20-hub-cc10.png`).
- Homes are HP sponges in the drill; they have no function (no settlers' output, no contracts).
- Three achievements in all (`first-command`, `base-defender`, `field-veteran`).
- **Nothing ever attacks the town** except the drill you start yourself. Every CP spent on walls and turrets (up to ~480,000) buys a replay.

**Fixes.** Decision 10 (production ×3, visible on the hub); PvE raids while away (Decision 6) so defense has consequences; Trophy Hall fed by loot trophies; Science Lab fed by loot parts (Session 6B); Hangar garrison in Session 7; settler homes produce one Settler Contract a day each 10 homes (Session 7, "Settler contracts and reputation" from the roadmap).

## 7. Tank progression inside Conquest — 5/10

- Engineering: 8 tracks × 6 ranks, 100 → 3,200 CP a rank, 57,200 CP total; tuning ±3. All percentages (`tracks`); nothing shows on the hull or the HUD besides the heat bar's capacity.
- Hull Plating: 4 slots × 6 tiers, +1.0% → +4.0% hull per plate; set traits at tiers 5–6. Visible on HIGH (shine material and seams), static on LOW; the per-step change (+1% hull) is below the "felt" threshold.
- Mods and Science Lab research: not built (Session 6).
- There is no power number in Conquest. Arcade shows league and gear rating; Conquest shows HULL 1700/1700 and nothing about how strong you are relative to the zone.

**Fixes.** A **POWER chip** on the HUD and hub (the canonical `powerOf` incl. plating; engineering shown as a Conquest bonus line); zone recommended power on the map and briefings ("POWER 92 · zone 80–110"); plate visuals per tier on the hull (5E models should include the four plate slots per chassis); mods + research in Session 6B with loot parts as inputs; a visible "tank card" in the Hangar.

## 8. Raids and defense — 6/10

**Raids (strong):** 25 = 5 families × 5 layouts (`raidOperations`); 5 commander patterns with tells and enrage below 40% (`raidDoctrine`, `reinforceStep`); HARD one reinforcement wave, VETERAN two; receipts per attempt; 25-shard deterministic blueprint + 3.5% elite roll server-keyed; raids unlock after the six field missions. The after-action shows the shard bar and the roll result (`afterAction`).

**Weak.**
- Difficulty ceiling: VETERAN is the top; the briefing itself says Epic with maxed engineering won 15 of 15 (`app.js:99`). After week 3 there is nothing harder.
- Defense: the town drill is a watched replay; the legacy fortress defense UI is retired, so the 675-point "defense victory" exists only for sector invasions.
- No async raids (`base.pvpAvailable=false`), no revenge, no raid log worth reading (`plot.log` keeps 8 drill entries), no replays of *real* attacks because there are none.
- Raid loot is CP/materials; the only exciting rolls are the blueprint shard and the elite 3.5%.

**Fixes.** PvE raids while away (Decision 6) with alert, replay, REPAIR and the loot share from the exposed store (`loot()` already protects banked goods and 25–75% of the production store); then player raids in bands by defense rating with revenge and earned/free shields; a **VETERAN+ "Commander's Gambit"** modifier set (chosen by the pilot: no shield, double reinforcements, night) for +30–60% rewards and loot quality, so top kits have a ceiling to chase without touching gear; raid loot chests (spec).

## 9. Variety — 5/10

**Exists:** 6 field missions (defense, convoy, sabotage, recon, rescue, siege), 25 raids, 8 Meteor sites, 6 sector invasion defenses, veins to prospect, bio-flora, the town, visits. **Missing:** the five terraform-zone modes (roadmap Session 7), world bosses (`worldBossAvailable:false`), settler contracts, any time-limited event other than the Meteor Strike, roaming encounters (4 patrol routes: `patrols`; 14 spawn keys; one loot generation a day per spawn: `killLoot`).

**Fixes.** Living world density (12 patrol routes, hunter packs scaling with held sectors, vein ambushes, an incursion near the pilot every ~10 min, all authored, never gear-matched); Hive Titan (Decision 14); Colony Defense as the first terraform mode (reuse the town-raid engine on the frontier wall), then Bridge Assault and Convoy Run as content on the same engine; settler contracts.

## 10. Social pull — 3/10

**Exists:** visits (top 20 by Town Score, your squad = referrals, Base of the Week), share card (3D render, Telegram share), a shared warfront counter (`conquestWarfront/frontier-v1`, goal 1,000, monument) with honest "participants" count.

**Missing:** any Conquest leaderboard (Town Score, defense rating, raid times, weekly campaign); squads as a Conquest feature; co-op or any shared fight; alerts to friends; chat; a reason to visit a base (nothing to do there but drive and look); the warfront reads as "1 / 6 SECTORS HELD" per pilot and a stage counter nobody can influence visibly.

**Fixes.** Session 7B: Conquest boards on the hub (weekly Town Score gain, defense rating, raid time-attack per layout, Hive Titan damage); squad territory wars using the existing squad rows; "defend a friend's town" (watch a friend's raid replay and send 1 Repair Kit a day); Base of the Week with a visible plaque in the visited town; share card after every first clear and every drill held.

## 11. Visuals and "wow" — 5/10

From the captures: the hub hero tank is a dark low-poly block in front of a good Earth and skyline (`00-hub-new-account.png`); the world is readable but one flat blue tone with a mirrored sign at spawn (`02-world-first-view.png`); the region map is clean and legible (`03-region-map-new.png`); the town after 5C reads as a town (`22-home-sector-drive-cc10.png`, `20-hub-cc10.png`). No kill, hit or loot VFX; no weather; one sky.

**Priority order for Session 5E (models + arcade maps):**
1. Your tank, every chassis and weapon (on screen 100% of the time in hub, world and Home Sector), with the four plate slots as visible sockets so plating reads at each tier.
2. Parasite enemies: four archetypes with silhouettes you can tell apart at 390 px and a clear hostile (red) read against the blue world.
3. The first-ten-minutes stage: Refuge, oxygen towers, the viaduct (fix the mirrored sign), the Command Gate.
4. Moonbeam v9 and the 12 town items (already planned).
5. Loot and impact VFX hooks (a glow sprite per rarity, hit flash material, kill burst): no models, big payoff; implementable in 5E or 6.

**Priority order for Session 7.5 (graphics 2.0):** zone color grades (barren vs terraformed), dust storms and rain (Session 6B weather) with post-processing, shadows and AO on HIGH, Selenite sheen and Moonheart pulse animated, night cycle on the Moon surface (14-day lunar day is fiction-true; use a 60-minute cycle).

## 12. Feel — 4/10

- **Audio:** one call, `fx('shot', wtype)` (`view.js:162`). `js/fx.js` already synthesizes `hit`, `kill`, `boom`, `dash`, `shield`, `claim`, `meteor`, `warn`, `win`, `lose`; none is wired in Conquest. No ambience, no music stingers.
- **Hit feedback on enemies:** none (no flash, no damage numbers, no hit sound). Enemy health shows only on the selected hull.
- **Kill feedback:** the hull disappears and a cache appears. No pop, no kill text, no haptic.
- **Being hit:** good: edge flash, Telegram heavy haptic, UNDER FIRE arrow with distance (`threatHud`).
- **Loot pop:** after-action tiles animate in (good); world drops are plain caches.
- **Controls:** floating stick, FIRE, SUPER, DASH, SHIELD, SCAN, GATHER + top bar MAP, MY BASE, MORE: 10 touch targets. Readable at 390. The 5D desktop fix is pending.
- **Readability:** three HUD text lines at the top compete with the mission line; the big ENTER row on the hub overlaps content.

**Fixes (Session 6 "feel pass", low cost, highest perceived value):** wire the nine existing fx sounds + a mute toggle; enemy hit flash (material emissive 80 ms) and floating damage numbers (pooled, 3 at a time); kill pop (burst + "DESTROYED" ticker + haptic light); loot glow sprites by rarity; progressive HUD; RECALL/scan/gather sound cues; victory stinger on operation win.

## 13. Spending players enjoy — 5/10

**Rules in place:** points never bought; only Ferrite/Ilmenite sellable (`STORE.ores`); checkout off (`ConquestPlot.STORE.checkout`, `ConquestCatalog.checkout.enabled=false`); every price in one table (MONEY RULE); Lunar Pass halves RECALL (`premiumPass`).

**Would be bought gladly (within the rules):** town looks (lighting, wall skins, decorations, banner sets), tank plate finishes and trim, the second builder, Lunar Pass Conquest perks (RECALL, scanner range, layout slots, a daily Repair Kit), Ferrite/Ilmenite crates with daily limits, extra layout slot, name plaque styles. All are "I want my town/tank to look like me" or "I have less time than you".

**Would feel like a scam:** speed-ups as the only path past 5–8 h timers (acceptable only beside an earnable second builder and shown earn time); anything that drops in loot being also sold (the loot design forbids it); paid wall extension capacity if it ever became strength; "+10% capacity" sold before players understand capacity vs strength; raid shields before player raids exist (standing rule).

**Gaps:** the 20 earn-only cosmetics (`catalog.js`) carry `proposedUsd` fields that must never show; the store items have no previews on the hub; no Conquest season/battle-pass style earn track exists (the Lunar Pass is Arcade-rooted). Decision 12 picks the first wave; Session 8 builds checkout.

## 14. Airdrop integrity — 6/10

**Strong:** the Worker simulates every 50 ms step; simulated time cannot exceed wall time; outcomes pay through an immutable outbox credited exactly once (`conquest-airdrop.js`, `eco.js creditConquest`); the shared 50,000 cap in `ecoPlayAward`; 90 requests/min; 120 points-paying outcomes an hour (`CQ_PTS.hourMax`); `cqppm` (1,200 pts/min over 30 min) and `hours` (20 h) flags; device/IP/wallet link clusters; new-account weighting; owner dev mode never earns and is never ranked.

**Exploits and gaps.**
1. **Alt yield farm.** `activeToday` is set by one verified operation or harvest. One field mission (~2 min) releases 1,000–2,600 base points of yield × league pay. Ten alts with CC1 towns = 10 × (450 + 1,000) ≈ 14,500 base points for ~30 minutes of play a day, rising with CC. The cluster flags catch same-device/same-network alts only. Decision 2.
2. **Field-mission point repeats at 100%** every 180 s (points do not taper like CP). 450 pts per 2 min ≈ 13,500/h at Rookie before league pay: the best honest rate in the game and the easiest to script. Decision 3.
3. **Keyboard bots work today**: `dev/tests/conquest-living-war.py` drives, fights and banks headlessly. The Conquest command-fingerprint flags (identical sequences, zero steering variance, constant completion times) were deferred in Session 4 and are still missing. Build in Session 7 (input entropy per operation, completion-time variance, identical-path hash across operations).
4. **Points from the Daily Base Yield need no presence**: the collect happens at the base, but RECALL/fast travel make that a 20-second detour. Fine by the "no pure AFK" rule only because of the activity gate; Decision 2 strengthens it.
5. **Strike roll** is stored per slot (cannot re-roll) ✓; **drill** pays nothing ✓; **Home Sector** is local and earns nothing ✓.
6. **Minor:** `conquest/<pid>` records are per pilot, so vein clocks are per pilot: two accounts on one phone double the ore; covered by the device link.

**For Session 7 anti-cheat:** fingerprints above; a per-account "Conquest trust" shown on the live airdrop standing ("verified play: 94%"); alt detection through town-layout hashes (identical layouts across accounts) and identical daily activity windows; a weekly review sheet row per flagged cluster.

## 15. Measurement — 2/10

No gameplay analytics exist. Only `fn/<day>/<step>` (signup funnel, `accounts.js`) and anomaly flags. Nothing records where new players quit, whether they return, how long they play or which operations they finish.

**Minimal, privacy-respecting set (12 events, daily counters, no PII, pid never stored with the event):**

| Event | Counter | Answers |
|---|---|---|
| `enter` | per day, first-ever flag | installs → Conquest entries |
| `transmission_skip` / `transmission_read` | per day | is the opening read? |
| `mission_start` / `mission_end` (id, outcome) | per day per id | funnel, win rates, abandon |
| `death` (cause, carrying) | per day | where players die, how much they lose |
| `bank` | per day | loop completion |
| `claim_town` (play minutes to it) | histogram buckets | time to first base |
| `build` (type, level) | per day | what people build |
| `raid_start` / `raid_end` (id, outcome, seconds) | per day per id | raid balance |
| `gather` (mineral) | per day | is prospecting used? |
| `quit_point` (last screen, minutes in session) | per day per screen | where players leave |
| `session_minutes` | histogram | session length |
| `return` (D1, D7, D30 from first enter) | cohort counters by first day | retention |

Storage: Firebase `an/<day>/<event>[/<key>]` increments (as the signup funnel does) and `an/cohort/<firstDay>/{d1,d7,d30}`; one admin-sheet tab reads them. Decision 11.

---

## Loot from mobs and bosses (the owner's request)

Agreed, with two refinements and one pushback.
- **Agree:** random drops with disclosed rates from mobs, elites, commanders, bosses and raids; earn-only things only; pity counters; visible rarity; banking tension kept for minerals.
- **Refine 1:** parts, trophies, fragments and consumables are account-bound on pickup (Decision 5). Losing a trophy to a respawn is a quit moment, and the rounding rule already protects single minerals; the risk belongs to the bulk resource.
- **Refine 2:** commons from mobs are 1–2 units so the Ferrite/Ilmenite crates keep their value (a crate is 150); rare+ minerals drop only from commanders, bosses, VETERAN raids and strikes, never from mobs, so the mineral ladder's timelines (§5) move by at most ~10%.
- **Pushback:** no "loot box" presentation for paid items ever, and no drop that is also sold; the store sells looks and time, loot gives power and trophies. Both lists are explicit in the spec so a future session cannot blur them.

Full tables: [CONQUEST_1_0_SPEC.md](CONQUEST_1_0_SPEC.md) §4.

## What Session 5D will change

5D's brief: `aiLevel`/`aiPower`/`AI_TIERS` in `js/rules.js`, `mkBot`/`mkBoss`/`rebuildBot` in `js/game.js`, `pickGhosts` in `worker/src/eco.js` (Arcade AI strength), desktop keyboard focus in `js/conquest/view.js`, 5C leftovers in `js/conquest/plotview.js`, `townkit.js`, `hub.js`, `style.js`, and possibly enemy ability cooldowns in `js/conquest/combat.js` (its A2 check). No finding above depends on the current form of those paths; Conquest enemy stats are fixed archetypes (`enemyStats(a)` reads only the archetype). Session 6 should branch after 5D merges and re-run `conquest-regression.sh` first.

## Appendix: captures

`captures/00-hub-new-account.png`, `01-opening-transmission.png`, `02-world-first-view.png`, `03-region-map-new.png`, `04-first-mission-briefing.png`, `05-first-fight.png`, `06-after-action-first-mission.png`, `07-world-after-mission.png`, `08-refuge-terminal.png`, `09-more-menu.png`, `10-refuge-supply-engineering-plating.png`, `11-scan-ore.png`, `13-command-gate-no-base.png`, `14-claim-town-screen.png`, `20-hub-cc10.png`, `21-world-at-gate-cc10.png`, `22-home-sector-drive-cc10.png`, `23-home-tab.png` … `27-defend-tab.png`, `28-drill-replay.png`, `29-drill-report.png`, `30-region-map-advanced.png`, `31-raid-site-operations.png`; `captures/playtest-log.json`. Chromium software GL at 390×844 (captured at device scale 2, stored at 390 px wide); relative only.

Limits of the scripted playtest, stated plainly: the bot's SCAN keypress did not register (no vein was revealed, so there is no gather capture and `11-scan-ore.png` shows the pre-scan HUD), and its tap on START did not start the drill (`28`/`29` show the DEFEND tab, not a replay). Both features are covered by the existing CI journeys (`conquest-minerals-browser.py`, `conquest-base-builder.py`); neither is claimed as a bug here. The first-mission loss is real: the bot drove, fired and followed the arrow as a new player would.
