<!-- Owner-approved Nov 10, 2026 (decisions 1a 2a 3a 4b 5b 6a 7a 8a 9a 10b). Canonical Conquest blueprint. Detailed prompts are written one session at a time. Exported from the owner's Claude doc; the core-loop diagram is described in section 2. -->

# LUNAR: War Machines — Complete Conquest Blueprint

Nov 10, 2026 · @jake

## 1. Verdict and the decisions I need

The vision is buildable on what exists. Three systems are new now: allied tanks in combat, a territory war that runs by itself, and the tiered Citadel. Co-op is a fourth, later. Everything else is a rewire of systems already live on `main` (build 20261110004649).

**What I found in the code**

- **The map is inverted.** A new pilot holds 1 of 6 sectors today (17%). Your vision starts humanity at 75–85%. The territory start state must flip.
- **No allied unit exists.** Conquest combat has one player and a list of enemies. Battalions, human AI armies and co-op slots all need the same engine addition, so it is built once.
- **Co-op cannot reuse the PvP room as is.** PvP rooms run the Arcade simulation, not Conquest's. The lobby, loadout check and reconnect logic can be reused.
- **One planned rule breaks your no-scaling principle.** The Living Town brief sets town-raid strength from Command Center level. That punishes upgrading. I change it to Citadel tier cleared.
- **One cost risk.** While a pilot drives, the server reads and rewrites the pilot's whole Conquest record in Firebase about once a second. Details and fix in section 10.

**The unifying idea: the War Map is the menu.** Every activity starts from a territory and changes it. One campaign card always shows the next Citadel tier, what is missing, and where to get it.

**Honest pushback.** This adds three build sessions before one real player has touched Conquest, and nothing is measured yet. I recommend a closed beta right after the Living Town session. You chose to build Citadel Act I before the beta (10b), and the roadmap follows that.

**Decisions.** Approved by the owner on Nov 10, 2026: `1a 2a 3a 4b 5b 6a 7a 8a 9a 10b`.

| # | Decision | Approved Nov 10, 2026 |
| --- | --- | --- |
| 1 | Theater size | 1a: 20 territories. Humans start with 16 (80%). Parasite floor 3 (15%), ceiling 8 (40%). Heartland can be attacked, never captured |
| 2 | Allies in a fight | 2a: Wing (you + 2), Platoon (you + 4), Battalion (you + 9) by operation |
| 3 | Orders | 3a: four orders on one button: Follow, Attack, Hold, Fall back |
| 4 | Citadel content | 4b: all nine tiers are finished before public release. Building is phased by act |
| 5 | First-clear points and the cap | 5b: one-time, progressively larger bounties, exempt from the 50,000 daily cap. One-time progression milestones may also exceed the cap. Repeat clears pay loot, never first-clear points |
| 6 | Final tier and paid gear | 6a: clearable with the best earnable gear and near-perfect play |
| 7 | What drives attacks on your town | 7a: Citadel tier cleared |
| 8 | Async player raids | 8a: deferred until a live population exists |
| 9 | Battalion gear | 9a: spare owned weapons and chassis arm allies, one item per tank |
| 10 | Beta gate | 10b: Citadel Act I is built before the closed beta |

**Owner clarifications, Nov 10, 2026**

- There are zero live players. Conquest must work completely with AI.
- Co-op will support Find Party matchmaking with random pilots, friend invitations, and AI in every empty seat. It is built and tested with simulated clients before real players exist.
- All rewards are server-verified and nonrepeatable where that applies, and balanced against airdrop integrity. The final tier also awards the exclusive permanent skin.
- Existing territorial progress is preserved. The original six-sector Frontline is a separate measure from ownership of the whole Moon.
- No Firebase screenshot. The inefficiency gets fixed, and infrastructure cost is validated by simulated load testing before public launch.
- One coding session at a time. A detailed prompt is written only for the session that is next.

The audit's 14 open decisions (`docs/conquest/audit/DECISIONS.md`) still stand with their ★ defaults. Two are affected here: the player-raid phase from audit decision 6 moves later (decision 8 above), and the Living Town brief's threat rule changes (decision 7 above).

## 2. The one game

Conquest becomes one loop: read the war, fight for it, grow from it, escalate it. Every system has exactly one job in that loop.

Core loop, six steps in a cycle: 1 WAR REPORT (what changed while away, your one next order) → 2 SORTIE (you and your allies fight for a territory) → 3 SPOILS (loot, minerals, pilot XP, bank it) → 4 BUILD (town, tank and battalion get stronger) → 5 PUSH (the front moves, siege prep opens) → 6 CITADEL (break a tier: points, production, prestige) → back to 1, one level higher.

Each cleared Citadel tier restarts the loop one authored level higher. The enemy escalates only when the pilot chooses to break a tier.

**Five rules that make it one game**

1. **The War Map is the menu.** Missions, raids, defenses, mining and sieges are launched from a territory and change that territory.
2. **One campaign card.** It shows the next Citadel tier and three readiness lines: FRONT (approach territories held), FORCE (battalion rating), DEFENSE (town rating). A tap on any unmet line routes the pilot to the activity that fixes it.
3. **One order at a time.** The HUD's NEXT ORDER chip gives goal, reward and distance. This is Session 6's NEXT chip, fed by the war.
4. **Nothing is side content.** Every existing mode gets a job in the war (second table below).
5. **Ratings inform, never scale.** POWER (tank), FORCE (battalion) and DEFENSE (town) are shown beside each zone's recommended band. No enemy ever reads them.

**How the systems feed each other**

| System | Gives | Needs |
| --- | --- | --- |
| Gathering | Plates, walls, repairs, fortifications, training | Held territory. Richer veins sit nearer the Citadel |
| Town | Production, DEFENSE, Hangar slots, research | Resources. Must survive counterattacks |
| Your tank | The decisive hits and every objective | Loot parts, minerals |
| Battalion | Holds the line. Makes big operations possible | Hangar, recruits from missions, spare gear, alloy |
| Missions and raids | Loot, recruits, siege prep, weaker Parasite positions | The war creates them |
| Territory | Supply bonus, fast travel, vein access, the road to the Citadel | Battalion, fortifying, showing up to defend |
| Citadel | First-clear points, production, prestige, the next tier | Everything above |
| Shared war and co-op | Morale buff, big events | Optional, never required |

**The job of every existing or planned mode**

| Mode | Its job in the war |
| --- | --- |
| 6 field missions | First hour, recruits, siege prep objectives |
| 25 raids | Destroy Parasite footholds. Siege prep. Commander trophies |
| Meteor Strikes | The rare-mineral event. Unchanged |
| Hive Titan (planned, 7B) | Kill it, or it joins the next Grand Offensive |
| Sector invasion defense | The battle that decides who holds a territory |
| Town drill and raids | Parasite counterattacks on your town |
| Terraform modes (planned, 7B) | The battle types when a heartland territory is attacked |
| Contracts board (planned, 6) | Becomes War Orders: goals drawn from the live front |
| Squad territory wars (planned, 7B) | Folded into the shared war as squad contribution |

## 3. The player journey

A pilot goes from one tank holding a gate to a general breaking the Parasite throne, and each stage hands over exactly one new thing. Times are design targets for a regular pilot (60 minutes a day). The economy model re-checks them in every build session.

LDF below means Lunar Defense Force, my proposed name for humanity's AI army.

| Stage | When | What happens | New thing |
| --- | --- | --- | --- |
| First fight | Minute 0–5 | Refuge gate under attack. First kill, first loot, first plate. This is Session 6's first hour | Your tank |
| First ally | Minute \~12 | The rescue mission's stranded pilot joins as your wingman | Wing |
| First home | Minute \~20 | Claim your town | Town, production |
| First war report | Day 2 | "While you were away": the LDF held one territory, one assault is inbound in 5 hours. You defend it | The War Map |
| First offensive | Days 2–4 | The scripted First Offensive lands a Parasite foothold. You join the LDF counterattack and retake it | Counterattacks, Fortify |
| Platoon | Week 1 | Hangar grows. Four allies, first roles, first formation. HARD raids open | Roles, orders |
| First general | Week 1–2 | A 2-star general leads an assault on your frontier. Beat him for the first trophy | Generals |
| First town attack | Week 1–2 | Warned hours ahead. Defend live with your garrison, or read the replay and repair | DEFENSE matters |
| The road east | Week 2–3 | Retake Ash Redoubt. Hold both approach territories. Run siege prep | FRONT readiness |
| Citadel I | Week 2–3 | First 10-tank assault. First-clear bounty, production up, Retaliation I begins | The campaign |
| Act I done | Weeks 6–8 | Tiers II and III. Full battalion of 9. Command Center 9 | Battalion |
| Act II | Months 2–5 | Tiers IV–VI force real compositions. Co-op operations arrive | Co-op, optional |
| Act III | Months 5–12 | Tiers VII–IX. Twin generals, the Portal Heart, the Sovereign | Mastery |
| After the throne | Ongoing | Weekly Throne Run, Grand Offensives, shared war, co-op, boards | Replay |

**A normal day, 10 to 20 minutes**

1. War Report: what the LDF held or lost, what is inbound, your next order.
2. Two to four sorties from the map. Each moves a territory, a siege prep objective or a War Order.
3. Bank. Collect production. Queue one build, one training, one fortification.
4. Leave with a countdown on screen: "Assault on Oxygen Spear in 5 h 10 m."

**Reasons to open the game tomorrow**

- An inbound assault with a timer, sent to Telegram.
- The War Report: something always happened.
- Production full, training done, a build finished.
- The weekend Grand Offensive.
- Meteor Strike and the daily Strike Beacon (already planned).
- The soft streak (already planned, never points).

## 4. Battalions

You command up to nine allied tanks that fight on their own. You choose who goes, how they are armed and their formation. One button gives four optional orders.

**Design goals**

- **Your tank stays decisive.** Only the pilot captures, plants, extracts and breaks a general's shield core. Allies hold, protect and wear down.
- **Target split in a full assault:** allies deal about 60% of the damage, the pilot about 40% and 100% of objectives. Tuned through ally aim lag and reaction time, never through enemy stats.
- **Composition must matter.** A balanced battalion beats a one-role battalion of equal gear on the authored operations. A simulation test proves it.

**Six roles** (your six, sharpened; names are proposals)

| Role | Chassis | Signature | Answers |
| --- | --- | --- | --- |
| Guardian | Titan | Draws fire. Allies behind it take 20% less damage | Brutes, focus fire on you |
| Breacher | Vanguard | Bonus damage to structures and shield domes. Short charge | Shield Wardens, batteries, walls |
| Lancer | Titan or Vanguard | Out-ranges everything. Weak inside 20 m. Bonus against drones and dropships | Spore Mortars, turrets, airships |
| Mender | Scout or Vanguard | Heals nearby allies. Revives one downed ally per fight | Attrition, long sieges |
| Corroder | Vanguard | Stacking armor shred: the target takes more damage from everyone. Stops Parasite regeneration | Sentinels, generals, Leeches |
| Frostline | Scout | Cryo mines and slow fields. Freezes light units | Swarms, Burrowers, interceptor rushes |

The 20% and 20 m are starting values for the build session's simulations.

A role is a **Role Core** fitted to a normal tank. Ally stats come from the same `tankOf()` rules as your own tank, so chassis, weapons, tiers and rolls mean the same thing. There is no second rule set.

**Combos come from mechanics, not set bonuses**

- Corroder + Lancer: shredded targets take the Lancer's full burst.
- Frostline + Breacher: frozen targets take bonus close-range damage.
- Guardian + Mender: a healed tank that holds enemy fire.

Every briefing shows the enemy roster as icons with one hint line: "Swarms and a Shield Warden. Bring Frostline and a Breacher."

**Autonomy and orders (Decision 3)**

- By default allies follow in formation, pick targets by role, use cover and fall back to the Mender when low.
- One COMMAND button. Tap gives the smart order: attack my locked target, or regroup when nothing is locked. Hold opens a four-way wheel: **Follow, Attack, Hold here, Fall back.**
- "Defend a location" and "Hold position" merge into Hold here. "Focus on an objective" is Attack with the objective locked.
- COMMAND shares the context button Session 6 already plans (SCAN, or GATHER near ore, or COMMAND in a fight). The HUD stays at eight touch targets.
- Three formations chosen before the fight: Line, Wedge, Escort. Three saved presets.

**How big is the fight (Decision 2)**

| Scale | Allies | Used for |
| --- | --- | --- |
| Wing | 2 | Roaming, field missions, mining escorts |
| Platoon | 4 | Raids, territory defenses, town defense |
| Battalion | 9 | Citadel assaults, Grand Offensives, co-op operations |

A 10-tank brawl every two minutes is noise on a phone and costs the most server time. The full battalion is kept for the moments that deserve it. Seats you cannot fill yet are taken by LDF regulars in militia kit, so the first Citadel assault is a joint operation. Your own specialists replace them as the Hangar grows.

**Progression: three levers per pilot, no more**

- **Rank 1–10** from operations fought. Ranks 3, 6 and 9 upgrade the role signature.
- **Role Core level 1–5** from research parts and Command Points. This is a fifth track in the Science Lab that Session 6B builds. Earn-only.
- **Gear (Decision 9):** AUTO-ARM assigns your best spare weapons and chassis, one item per tank. With no spare gear an ally uses a militia kit (Common, no cores).

No per-ally plating, engineering or mods. Those stay special to your own tank.

**Roster**

- Pilots are named recruits with a call sign and a kill count. They come from rescue missions, liberated territories and Hangar recruitment.
- Roster of 16, up to 9 in the field. Reserves have a job: station two in a threatened territory, or garrison the town.
- Fielded slots grow with Hangar level. Targets: Wing on day 1, Platoon in week 1, Battalion around weeks 4–5.
- Downed allies are never lost. They return at half hull until repaired with alloy at the Refuge or your town.

**Screens:** one HANGAR screen with roster cards (role, rank, gear, status), AUTO-ARM and formation presets. Before a fight, one strip shows the enemy icons and your picked force. Two taps from briefing to deploy.

**Build notes**

- Extends the existing `Battle` class in `js/conquest/combat.js` with a friendly unit list. Ally AI reuses the enemy steering and targeting code with the side flipped.
- Each friendly unit carries a controller field: `ai` today, a human pilot later. That is the co-op foundation, built once.
- LDF troops in joint battles are the same unit type in LDF livery, outside your command.
- Caps: 10 friendly, 20 active hostile, 6 drones, 160 projectiles (96 today). Effects halve on LOW graphics.
- Ally and general supers follow the player's charge rule plus a minimum spacing. Session 5D's branch adds that rule for Arcade; Conquest adopts it.

## 5. The living war

The war runs on its own clock in every pilot's world. Both AI armies attack, defend and take ground whether you are there or not, inside hard limits.

**The theater (Decision 1)**

| Ring | Territories | Start | What is there |
| --- | --- | --- | --- |
| 1 Heartland | 4 | Human, cannot be captured | Refuge Corridor, colony, Reservoir Flats, your town. First hour. Weak incursions |
| 2 Rear | 5 | Human | New barren reaches. Mining, convoys, LDF posts |
| 3 Frontier | 5 | Human | Western Salvage Reach, Helium Basin, Dust Crossroads, two new. HARD raids, invasions |
| 4 Warfront | 3 | 2 human, 1 Parasite | Ash Redoubt (Parasite), Oxygen Spear, Refuge Ridge. VETERAN raids, the portal, the approach |
| 5 Inner Ring | 3 | Parasite, permanent | Eastern Rim as outer bastion, a second bastion, the Citadel. Five-star generals |

- **Start:** humanity 16 of 20 (80%), Parasites 4 (20%). **Floor:** 3 (15%), enforced by the map itself because the Inner Ring cannot be captured. **Ceiling:** 8 (40%).
- **No raid changes difficulty.** Today's HARD sectors become Ring 3 and today's VETERAN sectors Ring 4. The Citadel sits east, where the VETERAN content already points.
- **Footholds.** Today's four Parasite installations become enemy camps inside a territory. Clearing one uses the capture rule that already exists. The original six sectors stay as the Frontline, with their own secured count (today's "1 / 6 sectors held") and every existing capture preserved. Ownership of the Moon is the new 20-territory measure. The HUD shows both and never mixes them.
- **New ground.** 11 of the 20 are zones that exist today. Seven are cheap (barren ground, an LDF post, veins, a patrol, a strike site). Only the Citadel and its second bastion are heavy new work.
- **The map** shows two colors and a front line, one highlighted NEXT ORDER, and detail only on tap. This answers your Nov 8 "too many sections" verdict.

**Difficulty is geography**

- Each ring has a fixed, authored enemy roster and a recommended POWER band on the map.
- New Parasite units arrive by ring and by Citadel tier (section 6), never by player strength.
- Veins get richer toward the Citadel. Risk buys reward.

**The war clock**

- The war advances in turns (proposal: every 6 hours). The server computes missed turns when you next connect, so nothing has to be online.
- Each turn the Parasites may schedule one assault and the LDF one counterattack. Both are announced at least one full turn ahead, with a countdown and a Telegram alert.
- **If you show up,** it is a real battle and your result decides it. A defense you win in person entrenches that territory for 24 hours.
- **If you don't,** it resolves by strength. The territory card shows the odds first: "DEFENSE 3 vs THREAT 2. Holds 70% if you're away."
- **DEFENSE** comes from the ring's LDF garrison, fortification you pay for (alloy, He-3, CP), reserves you station, neighbors held, and shared-war morale.
- **THREAT** comes from the general's stars, the portal, a living Titan and the Citadel tier you have cleared. Never from your gear, purchases, league or Command Center.
- Unattended battles pay no airdrop points.

**Limits (proposals)**

- At most one territory changes hands per turn.
- Away one day: at most 2 net territories lost. Away three days: the front freezes until you return.
- Heartland is never captured. Parasites never exceed 8 territories.
- Accomplishments are permanent. First-capture records, trophies and achievements never revert when land changes hands.

**Humanity's army (the LDF)**

- Garrisons every human territory with visible posts and patrols.
- Reinforces threatened territories and launches counterattacks.
- **Joint Operation:** join an LDF counterattack with your Platoon plus five LDF tanks.
- Fights beside you in defenses, and skirmishes with Parasite patrols in the open world. Skirmishes are simulated only near you.

**How the Parasites arrive**

1. **Airships.** Visible dropships fly a route and unload a wave at a marked landing zone. Lancers and anti-air turrets can shoot one down first, which removes its wave. Landings create footholds in Rings 2–4.
2. **The portal.** A physical gate in one Parasite territory. While open it adds THREAT to every assault. Raid it to suppress it for 48 hours. It cannot be destroyed, and it relocates after three suppressions.
3. **Grand Offensive.** Every weekend airships and a portal surge combine: several territories and your town, with a general in command. Announced 24 hours ahead. You start it inside a 48-hour window, when you are ready.

**Generals** are named, carry 1 to 5 stars, and each uses one of the five commander doctrines already built (ambush, shield, artillery, carrier, plasma). A beaten general retreats and returns later. Five-star generals never leave the Inner Ring.

**Attacks on your town** are one target type on the same clock, not a separate system.

- Always announced. Composition and direction vary; the warning never does.
- Strength follows the **Retaliation level**, which is the Citadel tier you have cleared (Decision 7). Each level has an authored wave table.
- Defend live with turrets, garrison and your Platoon, or let it run and watch the replay.
- Losses stay bounded exactly as the Living Town brief says: damage you repair, a capped share of the exposed store, an 8-hour shield after a loss. Wallet, banked goods, points, plates and cosmetics are never touched.

**What holding territory gives**

- Supply: a small production bonus at your town per held Ring 3–4 territory (proposal: +2% each, max +16%).
- A fast-travel node (exists today), plus that territory's veins and missions.
- FRONT readiness for the next Citadel tier.

## 6. The fortress campaign

The Citadel is nine authored fortresses in three acts. Breaking one pays the biggest rewards in Conquest and raises the war one level. Nothing you own resets.

**Opening a siege**

1. **FRONT:** hold both approach territories in Ring 4 when you launch.
2. **FORCE and DEFENSE** at the tier's recommended band is advice, never a lock.
3. **Siege prep:** three optional objectives, each valid for 48 hours. Each is a mission type that exists today and removes one authored piece of the fortress.
   - Knock out the anti-air batteries (battery raid): one LDF airstrike becomes available in the assault.
   - Cut the supply convoy (convoy intercept): one fewer reinforcement wave.
   - Suppress the portal: no portal reinforcements mid-fight.

Siege prep is how the existing raids and missions matter to the endgame.

**The assault** runs three phases in 6 to 8 minutes with the full Battalion.

1. **Breach:** outer guns, walls, the gate.
2. **Push:** garrison waves and the tier's hazard.
3. **The general:** an authored boss with clear tells. Only your tank breaks the shield core.

**The nine tiers (Decision 4)**

| Tier | New mechanic | New Parasite unit | Role it rewards |
| --- | --- | --- | --- |
| I · Breach Point | Destroy gate generators to drop the shield gate | Swarm | Frostline |
| II · Iron Rain | Marked bombardment zones. Take forward cover | Spore Mortar | Lancer |
| III · The Carrier Deck | Dropships land mid-fight unless shot down | Dropship | Lancer, siege prep |
| IV · Shield Wall | Domes: damage only counts from inside | Shield Warden | Breacher |
| V · The Undermine | Two lanes. One must hold without you | Burrower | Guardian, Hold order |
| VI · Leech Garden | The general heals until his Leeches are shredded | Leech | Corroder |
| VII · Twin Generals | Two five-star generals must fall within 20 seconds | None | A split force |
| VIII · The Portal Heart | Destroy three anchors in order under endless waves | Elite escorts | Every role |
| IX · The Sovereign | Four phases remixing every mechanic, with a hard enrage | None | Best gear, near-perfect play |

- **Acts:** I–III The Outer Works, IV–VI The Hive Wall, VII–IX The Throne. One fortress layout per act, re-fortified for each tier. All nine tiers are finished before public release. Act I is built before the closed beta, Acts II and III after it.
- **Fixed stats.** A higher tier means new units, layouts and tactics. It is never the last tier with bigger numbers.
- **Generals:** 3 stars in Act I, 4 in Act II, 5 in Act III. Tiers I–III reuse the ambush, artillery and carrier commanders that already exist.
- **Swarm and Brute already exist** in the town drill engine. They move into the field.

**When you win a tier for the first time**

| Tier | Airdrop bounty (base points, once) | Production bonus so far |
| --- | --- | --- |
| I | 5,000 | +5% |
| II | 7,500 | +10% |
| III | 10,000 | +15% |
| IV | 15,000 | +20% |
| V | 20,000 | +25% |
| VI | 30,000 | +30% |
| VII | 45,000 | +35% |
| VIII | 65,000 | +40% |
| IX | 100,000 | +45% |

- Approved: bounties grow with each tier, are exempt from the 50,000 daily cap, server-verified and paid exactly once per account. Repeat clears pay loot and other rewards, never first-clear points. The values shown total 297,500 and are confirmed in the Citadel session. One-time progression milestones (for example first town, first general beaten, full battalion, each act completed) may also pay outside the cap. Each is proposed for your approval in the session that builds it.
- The production bonus applies to materials and Command Points only. Daily Base Yield points do not change, so the airdrop inflow stays as designed.
- You also get the general's trophy. The Retaliation level rises by one. The next tier appears, already authored.
- Territory, town, battalion and every record stay exactly as they were.

**When you lose:** used siege prep is spent and downed allies need repair. Nothing else is taken.

**After the Sovereign**

- A rare achievement, the 100,000 bounty, an exclusive permanent skin that is never sold, and a final milestone on your hub and banner.
- The Parasites keep their 15%. The Citadel is beaten, not removed.
- **Throne Run:** replay any cleared tier weekly with rotating modifiers. This reuses the Commander's Gambit system planned for 7B. One full reward chest per tier per week, then reduced rewards. A clear-time board.
- There is no tier X and no automatic stat inflation.

**Pacing targets** (to validate with the economy model)

| Tier | Regular, 60 min a day | Grinder, 4 h a day |
| --- | --- | --- |
| I | Week 2–3 | Day 5–7 |
| III | Weeks 6–8 | Week 3 |
| VI | Months 4–5 | Month 2 |
| IX | Months 9–12 | Months 4–5 |

**Decision 6 in detail.** The Sovereign should fall to the best earnable kit: Epic gear, Moonheart plating, full engineering, mods and a maxed battalion. Moonbeam and Lunar Skin widen the margin. The audit's model puts full Moonheart plating at 384 days for a regular, so the final clear is a year-long goal. That fits "rare and prestigious".

## 7. Co-op and the shared war

Co-op is the same 10-slot battle with humans in the ally seats, and it is built and tested with simulated clients, so it does not wait for real players. The shared war is a weekly community goal that works with zero players and never touches personal progress.

**Co-op operations: 1 to 10 humans against AI**

- **Separate instances.** One battle room per operation. Persistent worlds are never synchronized.
- **Ten friendly slots.** The party leader picks the operation. Humans take slots and the leader's battalion fills the rest with AI: 1 human + 9 AI, up to 10 humans + 0 AI. The lobby shows each human's role, and the AI seats cover the roles nobody brought.
- **First operations:** Citadel assaults, Grand Offensive defense, Hive Titan hunt, Joint counterattack.
- **Own gear only.** Each human brings their server-verified tank. The PvP loadout check and frozen loadouts are reused. Nothing is duplicated.
- **Disconnects.** AI drives your tank within seconds, and you have 60 seconds to rejoin. This is the PvP pattern, reused.
- **Rewards.** Each human gets their own loot roll and points through their own exactly-once ledger. A first-clear bounty needs that tier to be your current tier, plus a minimum contribution. Helping below your tier pays assist rewards, three full ones a day.
- **Solo stays complete.** Every operation must be clearable by one human at the recommended ratings. A test enforces it.

**Scaling by human count, never by gear**

| Humans | What changes |
| --- | --- |
| 1 | Baseline composition |
| 2–3 | One extra flank reinforcement wave |
| 4–6 | Two extra waves and a second simultaneous objective |
| 7–10 | Three extra waves, a third objective, elite escorts beside the general |

- Enemy unit stats are identical at every size. A test asserts it.
- Balance target: win rates within 10 points of each other at 1, 3, 5 and 10 humans at recommended ratings, measured with bot simulations.
- One AI ally is tuned to about 60% of a competent human, so a full human squad is stronger and faces more waves, not tougher units.

**Technology**

- **New:** a Conquest operation room, a Durable Object like the PvP room, that runs Conquest's `Operation` simulation for several input streams.
- **Reused:** the lobby core, WebSocket transport, loadout check, reconnect and AI takeover, client snapshot interpolation, the reward ledger.
- **Not reusable:** the PvP room's simulation. It runs Arcade's `js/game.js`, a different engine.
- The same room also removes the Firebase cost risk for solo operations (section 10).

**Rollout:** 1 to 3 humans first, then 5, then 10 after a load test and a phone performance test. Matchmaking offers Find Party with random pilots and friend invitations, and AI fills every empty seat. Simulated clients test all of it before real players exist. Arcade and PvP are untouched.

**The shared war**

- **A weekly War Effort bar** on the hub. Every verified operation adds to it. It reuses the shared warfront document and campaign score that exist today.
- **Population-normalized goal:** active pilots that week × a fixed personal quota × 0.6. It is always winnable if 60% of pilots play an ordinary week. With zero pilots the bar idles and nothing breaks.
- **Win:** High Morale for everyone next week. Proposal: +1 DEFENSE on every territory in every personal world and +10% CP and salvage. Cosmetic reward tiers. The monument and the terraformed frontier grow, which is the living-terraform item already planned for 7B.
- **Lose:** nothing is taken.
- **Squads** compete on summed contribution. This replaces separate squad territory wars.

| Weekly active pilots | Shared events unlocked |
| --- | --- |
| 25+ | One weekly World Operation, playable solo or co-op |
| 250+ | Two a week |
| 2,500+ | A monthly Theater Offensive |

Hard cap: three shared events a week, at any population.

**Fair rewards at any population.** Board rewards use percent bands with a minimum field instead of "top 100". With 40 players, the planned "top 100 get a Selenite" hands a rare mineral to everyone.

## 8. Economy, airdrop and monetization

No standing economy rule changes. The new systems add sinks for resources players already earn, three bounded rewards, and a reason for the existing store to matter nine times over.

**Kept exactly:** the 50,000 shared daily cap, points never bought, rare and above earn-only, existing gear never weakened, nothing that drops is ever sold, payments off until certified.

**New sinks and sources (all values are proposals)**

| New | Costs | Gives |
| --- | --- | --- |
| Recruit, train and repair pilots | CP, alloy | FORCE |
| Role Core levels | Research parts, CP | Stronger role signatures |
| Fortify a territory | Alloy, He-3, CP | DEFENSE in battles fought while away |
| Siege prep | Play time only | A weaker fortress for 48 hours |
| Supply bonus | Holding territory | Up to +16% materials |
| Tier production bonus | Clearing tiers | Up to +45% materials and CP |
| First-clear bounties | Clearing tiers | 297,500 points in total, once |

The audit counts about 909,000 CP of existing upgrade ladder, so CP keeps its value for months. Battalions and fortification add more sinks than the bonuses add sources. The economy model re-runs before every merge, as the build plan already requires.

**Airdrop integrity**

- Points come only from verified active play, as today. Battles resolved while you are away pay zero.
- **Allies must not multiply points.** Operation points stay per operation. A world kill pays points only when your own tank dealt part of the damage. The hourly outcome limit stays.
- First-clear bounties are exactly-once per account per tier.
- Co-op assist rewards are capped per day, and a minimum contribution blocks idle carries.
- The audit's cap message stays: "CAP REACHED. Loot, minerals and CP still drop."

**Decision 5 in plain numbers.** The audit shows a Master pilot with a Command Center 9 town hitting 50,000 in about 55 minutes. Inside the cap, that pilot's bounty only shortens the day. Outside the cap it adds 297,500 points over the whole campaign, about six capped days, one time. Approved Nov 10: outside the cap.

**Monetization**

What already sells gets stronger:

- **Spare gear arms allies.** Nine ally tanks need weapons and chassis, so every crate item gets a use. Today a second Epic weapon mostly sits in the garage.
- **Purchases never lose value.** No enemy scales, so Moonbeam and Lunar Skin keep their full edge against every fortress, forever.

New things players would pay for gladly. Prices are yours, and checkout stays off until the payments session.

| Item | What it sells |
| --- | --- |
| Battalion colors and insignia: your paint and banner on every ally | Looks |
| Elite pilot contract: a named pilot with a unique look who starts at Rank 5, same rank cap as everyone | Time |
| Second training queue | Time |
| Extra roster slots and formation presets | Convenience |
| Lunar Pass battalion perks: faster pilot XP, one free field repair a day | Convenience |
| Moonguard escort: legendary-grade kits for two allies | Power, your call |
| Fortress trophies as town decorations after each act | Looks |

**Never sold:** bounties, points, the Sovereign skin, Role Cores, research, rare and higher minerals, retries of a failed assault, anything in a loot table.

**No paywalls.** Every tier is clearable without paying (Decision 6). Spending buys speed, margin and looks.

**Revenue arithmetic, not a forecast.** $10,000 a month is about $333 a day. At $0.10 per daily player that needs 3,300 daily players. At $0.30 it needs about 1,100. Session 6's analytics produce the first real number.

## 9. What exists today: reuse, modify, build

Most of Conquest's foundation is reused unchanged. Eight areas need modification. Six things are new.

Inspected: `main` at `d99d7d4`, live build 20261110004649 (Session 5C). Session 5D's branch is pushed with three commits (fair Arcade AI, desktop keyboard fixes, AI super spacing) and is not merged yet.

**Reuse unchanged**

| Area | What is there |
| --- | --- |
| World | Terrain, terraformed south, colony, roads, routing, RECALL, fast travel (`js/conquest/world.js`) |
| Operations | 6 field missions, 25 raids (5 families × 5 layouts), 5 commander doctrines, drones, hazards, 8 Meteor Strike sites (`combat.js`) |
| Town | 7 sites, 12 buildings, 11 turret types, walls from 600 to 2,000 cells, 19 wall blends, layouts, drill engine, raid damage and repair, defense rating (`plot.js`, `plotview.js`, `townkit.js`) |
| Tank growth | 6 mineral tiers, Hull Plating, engineering (8 tracks × 6 ranks), veins, scanning |
| Gear rules | 3 chassis classes, weapon lines, cores, mods, `tankOf()`, server-side machines. These stat the allies too |
| Server authority | Fixed-step replay of every input, exactly-once point ledger, the 50,000 cap, rate limits, anomaly flags |
| Social | Hub page, share cards, visits, Base of the Week, 20 earn-only cosmetics |
| Quality net | 95 Conquest test files, the regression script, the CI workflow |
| Other modes | Arcade and PvP, untouched |

**Modify**

| Area | Today | Change |
| --- | --- | --- |
| Territory (`conquest-campaign.js`) | 6 sectors. A new pilot holds 1. A fixed 20-minute defense alert after each capture | 20 territories in rings. Start flipped to 80% human. The war clock replaces the fixed timer |
| Combat engine (`Battle` in `combat.js`) | One player against a list of enemies. 4 enemy types. 96-projectile cap | Add a friendly unit list, enemy targeting across friendlies, new unit types, higher caps |
| Town raid strength | `drillWaves()` keyed by Command Center level | An authored table keyed by Retaliation level |
| Hangar, Science Lab, Trophy Hall | Shells marked "coming soon" | Roster and garrison. Research including Role Cores. General trophies |
| Region map and hub | Map with missions, ore, settlers. Hub with base and events | War Map, campaign card, War Report |
| Shared warfront (`conquest-warfront.js`) | One lifetime counter, goal 1,000, a monument | Weekly periods and a population-normalized goal |
| Session plumbing (`session.js`, `conquest.js`) | Whole record read and rewritten about once a second | Split hot and cold data now. Operation room later |
| Story copy | Hub already says "EARTH HAS FALLEN. WE HOLD THE MOON." | Wiki story updated to the Moon-as-refuge version |

**Build new**

- Allied units and the six role behaviors.
- The war clock: assaults, counterattacks, strength resolution, limits, War Report.
- The LDF (posts, patrols, joint operations), airships, the portal, named generals.
- The Citadel: framework, three layouts, nine tiers, siege prep, bounties.
- Parasite units: Spore Mortar, Dropship, Shield Warden, Burrower, Leech. Swarm and Brute are ported from the town drill.
- The co-op operation room, its lobby, and shared-war events.

**Designed in the audit but not built yet:** loot, contracts, analytics and the feel pass (Session 6). Mods, research, POWER chip, audio and weather (6B). Away raids, live defense, garrison, alerts, Strike Beacon and streak (7). Standing, boards, Gambit, Titan and terraform modes (7B). Section 11 folds the new work into these.

**Existing player data.** No live players exist, so only test records need migrating. Migration rule: nothing you hold flips, new territories start human, and first-capture records and achievements are kept. The versioned migration pattern already exists (`dev/tests/conquest-v1-migration.mjs`).

## 10. Critical evaluation

The design is strong on long-term goals and depends on the areas where the live game is weakest: the first hour, combat feel and proof. The three biggest risks are scope before validation, 10-tank readability on phones, and one infrastructure cost.

**Scorecard for this blueprint**

| Area | Verdict | Biggest risk | Answer |
| --- | --- | --- | --- |
| Enjoyment | Strong if combat feel lands | Allies win while you watch | Pilot-only objectives. 60/40 damage target. Small scales for most fights |
| Balance | Sound: fixed enemies, measured gear steps | A Platoon trivializes today's raids | Raids re-measured with a Platoon in the Battalion session |
| Difficulty | Clear: rings and tiers | The final tier waits on Moonheart | Decision 6. Throne Runs and boards pay legendary minerals |
| Retention | Strong: countdowns, War Report, weekend offensive | Losses while away feel like punishment | Always announced, bounded, frozen after 3 days, wallet never touched |
| Monetization | Better than today: the store gains a use | "Pay for power" backlash | Every tier clearable free. Paid power is a fixed edge, never required |
| Economy | Sustainable on paper | Bonuses stack: +45% tiers, +16% supply, and Session 6's planned ×3 production | Model run before merge. Bonuses hit materials and CP, never points |
| Feasibility | High for solo, medium for co-op | The ally engine touches the core that 95 test files protect | Its own session. Friendly units are added beside the player, not replacing it |
| Scalability | Medium | Firebase traffic per pilot (below) | Split the record now. Operation room with co-op |

**Contradictions found, and where each is resolved**

1. The map is inverted in code versus the vision. Decision 1.
2. The Living Town brief scales town raids by Command Center level. The vision forbids scaling to upgrades. Decision 7.
3. First-clear airdrop points mean nothing inside the cap for pilots who already cap. Decision 5.
4. "Requires the best equipment" versus "no paywalls". Decision 6.
5. "Ten tanks" versus phone readability and server cost. Decision 2.
6. Solo-first with zero players versus async player raids, squad territory wars and "top 100" rewards. Deferred, folded into the shared war, and replaced by percent bands.
7. "Unpredictable attacks" versus "not arbitrary punishment". What and where varies. The warning is guaranteed.
8. The audit's Hive Titan is a per-pilot instance. The vision wants co-op bosses. Solo instance first, then the Titan becomes the first co-op boss hunt.
9. The wiki story (pilots left past the Moon) versus the new story (the Moon is the refuge).
10. The vision's scope versus your Nov 1 decision to stop adding features and validate with real players. Decision 10.

**Complexity I cut or deferred**

- Six orders become four.
- No per-ally plating, engineering or mods.
- Squad territory wars fold into the shared war.
- Terraform modes stop being a separate menu. Blight Purge and Forest Hunt wait.
- Settler reputation vendors wait until after beta.
- Async player raids wait for a population.
- Acts II and III are authored when players approach them.
- A seventh anti-air role folds into the Lancer.

**Weaknesses that remain**

- **Three more build sessions before real-player data.** The beta gate softens this. It does not remove it.
- **Ally AI quality is the highest craft risk.** It decides whether a battalion feels alive or dumb, and it needs tuning time with bot simulations.
- **The war clock is only as good as its visibility.** Without visible battles and a moving front it reads as timers.
- **Content cost is real.** Nine tiers, seven enemy units and a cast of generals, even staged.
- **Co-op needs a population to test.** Simulated clients cover function and load. Live balance still needs real players.

**The Firebase cost risk**

- **Measured today with the real server code:** a brand-new pilot's Conquest record is 12,970 bytes. It grows with town walls, logs and, in this design, battalion data.
- While a pilot drives, the client sends a request about once a second (`PUMP_MS = 1000` in `js/conquest/session.js`). Each request reads the whole record and writes it back, and the write's reply echoes the record (`readTag` and `writeIf` in `worker/src/eco.js`).
- That is up to about 93 MB of database download per pilot-hour (12,970 bytes × 2 × 3,600). I have not verified how much Firebase compresses replies to the Worker. With strong compression it could be a quarter of that.
- The free plan includes 10 GB of downloads a month ([Firebase pricing](https://firebase.google.com/pricing)). That is roughly 100 to 450 pilot-hours of Conquest a month for the whole game. A 30-person beta could use it up in days. I don't know which plan the project is on today.
- On the paid plan, downloads cost $1 per GB after the free amount ([Firebase pricing](https://firebase.google.com/pricing)), and protocol overhead is billed too ([billing docs](https://firebase.google.com/docs/database/usage/billing)). 1,000 daily players for an hour each would cost roughly $700 to $2,800 a month at new-pilot record size, and more as towns grow.
- **Fix, step 1 (Battalion session):** split the record so the per-second path carries battle data only, and send less often when no enemy is near.
- **Fix, step 2 (co-op foundation):** operations run in a room that keeps state in memory and saves at checkpoints.
- **Your one check today:** none. Owner decision Nov 10: no screenshot. Step 1 ships in the Battalion session, and a simulated load test validates infrastructure cost before public launch.

## 11. Implementation roadmap

Three new build sessions carry the new systems: Battalion, Living Front and Citadel Act I. Everything else folds into sessions that are already planned. The rest of the Citadel and co-op follow the beta.

**Order**

| # | Session | Type | Scope | Model · effort |
| --- | --- | --- | --- | --- |
| 1 | 5D Fair Arcade | Planned, code pushed, release not done | PR, CI, merge, deploy, verify | Fable · High |
| 2 | 5E Models and Arcade maps | Planned + small addendum | Meshy chassis, weapons, town items, arcade maps, audit visual priorities. Adds dropship, portal gate, LDF post, field Swarm and Brute | Opus · Max |
| 3 | 6 Core Fun | Planned + 4 adjustments | First hour, feel, loot, living world, War Orders board, analytics | Opus · Extra |
| 4 | 6B Tank Lab | Planned + 2 adjustments | Mods, research, rating chips, audio, weather | Opus · Extra |
| 5 | 6C Battalion | **New** | Ally engine, six roles, orders, Hangar roster, recruits, ranks, AUTO-ARM, fight scales, wingman in the first hour, record split | Opus · Extra |
| 6 | 7 Living Front | **New** | 20 territories, rings, Frontline kept separate, war clock, LDF, airships, portal, generals, War Map, campaign card, War Report, Fortify | Opus · Extra |
| 7 | 7T Living Town | Planned Session 7, reshaped | Town attacks on the war clock, live defense with garrison, repair, Telegram alerts, Strike Beacon, streak | Opus · Extra |
| 8 | 7B Citadel Act I | **New**, takes the old 7B slot | Fortress framework, tiers I–III, siege prep, cap-exempt bounties, Retaliation table, Throne Run, three new Parasite units | Opus · Max |
| 9 | 7C Integrity and Boards | Planned 7B, reshaped | Live airdrop standing, trust line, command fingerprints, boards with percent bands, Hive Titan, War Effort bar | Opus · Extra |
| 10 | 7.5 Graphics 2.0 | Planned | Lighting, post-processing, VFX | Opus · Max |
| 11 | 7.8 Security | Planned | Email scrub, secret scan, key rotation | Opus · Medium |
| 12 | 8 Payments | Planned | Certification and first store wave | Opus · Extra |
| 13 | 9 Full audit | Planned + load test | Whole-game audit and a simulated load test of infrastructure cost | Fable · High |
| 14 | 10 Closed beta | Gate | 20–50 pilots, about a week | None |
| 15 | Citadel Acts II–III | **New** content | Tiers IV–IX on the Act I framework, a checkpoint per act. Required before public release | Opus · Max |
| 16 | Co-op 1 | **New** | Operation room, 1–3 humans, Find Party, friend invites, AI fill, simulated clients | Fable · High |
| 17 | Co-op 2 | **New** | 5 then 10 humans, World Operations, load test | Opus · Extra |
| 18 | Public release | Gate | Promotion starts | None |

Session 7C must ship before public promotion, because it carries the airdrop's anti-cheat.

**Why this order**

- **Battalion before the front.** Allies are needed by LDF armies, the town garrison, Citadel assaults and co-op seats. Built once, used four times.
- **Front before town.** Town attacks are one target type on the war clock, so the clock comes first.
- **Citadel Act I before beta.** Approved as 10b: Act I is built before the beta, so testers see the real long-term goal. Acts II and III follow, and all nine tiers ship before public release.
- **Co-op after the campaign.** It is built and tested with simulated clients and does not block the campaign.

**Changes to sessions already planned, so nothing is built twice**

- **5E:** ally and LDF tanks use the existing chassis models with a livery. No new tank models.
- **6 Core Fun:**
  - Store the contracts board as War Orders with a source field, so the war can feed it later.
  - Hunter packs, incursions and vein ambushes read a per-zone ring table from day one.
  - Key loot tables by ring.
  - Build the NEXT chip as the single guidance channel.
- **6B Tank Lab:** build the POWER chip as a generic rating chip, so FORCE and DEFENSE reuse it. Leave a fifth research track slot for Role Cores.
- **7T Living Town:** threat comes from Retaliation level, not Command Center level. The garrison uses battalion pilots. The player-raid phase is removed (Decision 8).
- **Old 7B splits:** Gambit modifiers go to the Throne Run. Terraform modes become heartland battle types in Living Front, Colony Defense first. Squad wars become War Effort contribution. Settler contracts wait.

**Rules for every session** (kept from the build plan)

- One complete prompt, decisions settled first, no mid-session redirects.
- A pushed checkpoint after each phase.
- Economy model re-run before merge. Two independent reviewers for combat and economy changes.
- Each session adds the guardrail tests for the system it introduces (section 12).

**Where usage is saved**

- All nine Citadel tiers share one framework and three layouts.
- Allies reuse existing tank models, gear rules and enemy AI code.
- Town attacks reuse the drill engine. Generals reuse the five commander doctrines.
- One engine change (friendly units) serves battalions, LDF armies, garrison and co-op.

**Your steps**

1. Decisions answered Nov 10, 2026.
2. Run one coding session at a time and say "next" after reviewing it.
3. Approved Nov 10. Next: commit this blueprint to `docs/conquest/` as the canonical brief, update `docs/ROADMAP.md`, and write one session prompt at a time.

## 12. Guardrails and regression tests

Twelve automated tests protect the vision's principles. Each lands in the session that introduces its system and then runs in CI on every later change.

| # | Principle | The test fails if | Lands in |
| --- | --- | --- | --- |
| 1 | No scaling to the player | Any enemy stat differs between a stock loadout and a full legendary loadout, or any enemy code path reads gear, power, league, purchases or Command Center level | 5D starts it, 6C extends it |
| 2 | Better gear always helps | Starter, Epic and legendary win rates do not rise in that order on any authored encounter, town-raid level or Citadel tier | 6C, 7T, Citadel |
| 3 | Fair AI supers | A general or an ally fires supers faster than a player could charge them, or inside the minimum spacing | 6C |
| 4 | Composition matters | A balanced battalion does not beat a one-role battalion of equal gear on most authored operations | 6C |
| 5 | Territory limits | Across 10,000 simulated war turns the Parasite share leaves 15–40%, heartland is captured, or more than one territory flips in a turn | 7 |
| 6 | Bounded absence | A pilot away one day loses more than 2 net territories, or the front moves after 3 days away | 7 |
| 7 | The war needs no one | The personal or shared war throws an error or stalls with zero requests | 7, 7C |
| 8 | Bounded town losses | A town raid touches wallet, banked goods, points, plates or cosmetics, or arrives unannounced | 7T |
| 9 | Tier-up keeps everything | Clearing a tier changes territory ownership, town state, battalion or any record | Citadel |
| 10 | Bounties are exactly-once | A first-clear bounty can be credited twice, or the approved cap rule is broken | Citadel |
| 11 | Solo is complete | Any operation or tier cannot be cleared by one human at recommended ratings in bot simulation | Citadel, Co-op 1 |
| 12 | Co-op scales by count only | Any enemy unit's stats differ between 1 and 10 humans | Co-op 1 |

Already planned and kept: the loot and store disjointness test, the exactly-once credit tests, the shared-cap test, and the economy model runs.

**Performance budgets, tested on LOW graphics and in the server replay**

- At most 10 friendly units, 20 active hostile units, 6 drones and 160 projectiles in any fight.
- A full Battalion assault holds the frame-time bar set in `docs/conquest/SMOOTHNESS_PERFORMANCE_ACCEPTANCE.md`.
- Server replay of one game-second stays within a fixed CPU budget. Today's measured figure is about 15 ms with 16 enemies on local Node (`docs/conquest-living-war/replay-budget.json`). The 6C session sets the new budget for 10 friendly units.

## 13. Vision traceability

All 16 sections of your vision are preserved. Five carry a change that needs your approval, and each maps to a decision in section 1.

| Vision section | Status | Where it lands |
| --- | --- | --- |
| 1. Story and the Moon | Kept | Section 5. The wiki story gets the update |
| 2. Territorial ownership | Kept: 80/20 start, 15% floor enforced by the map, not by scaling. **Added:** 40% ceiling, heartland cannot be captured (Decision 1) | Section 5 |
| 3. Living territorial warfare | Kept | Section 5: war clock, LDF, generals |
| 4. Invasion mechanisms | Kept: airships, portal, combined offensives, defensible town attacks | Section 5 |
| 5. Geographic difficulty | Kept: rings, fixed rosters, limited AI supers, regression tests | Section 5, tests 1–3 |
| 6. Four pillars | Kept | Section 2 |
| 7. Battalions | Kept. **Changed:** fight scales below 10 for small operations (Decision 2), four orders (Decision 3), gear from spare items (Decision 9) | Section 4 |
| 8. Solo-first | Kept | Sections 5 and 7, tests 7 and 11 |
| 9. Co-op, 1–10 humans | Kept: separate instances, own gear, small groups first | Section 7 |
| 10. Co-op scaling | Kept: counts, waves and objectives only | Section 7, test 12 |
| 11. Shared war | Kept: normalized to population, capped, zero-player safe | Section 7 |
| 12. Progressive headquarters | Kept with 9 tiers. **Changed:** authored in three stages (Decision 4), bounty versus cap (Decision 5) | Section 6 |
| 13. Base strength matters | Kept. Corrects the Living Town brief (Decision 7) | Section 5 |
| 14. Progression, retention, monetization | Kept: paid power allowed, no paywalls (Decision 6) | Section 8 |
| 15. Preserve the implementation | Kept | Section 9 |
| 16. Your seven questions | Answered | Sections 1, 9, 10, 11 |

**Every change to your vision or standing decisions, in one list**

1. A 40% ceiling on Parasite territory and a heartland that cannot be captured.
2. Fewer than 10 tanks in small operations.
3. Four orders instead of six.
4. Nine Citadel tiers, built in phases and all finished before public release.
5. First-clear bounties and one-time milestones outside the daily cap (approved).
6. Async player raids deferred. The feature stays; its timing moves.
7. Squad territory wars folded into the shared war.
8. Limits on what the war can take while you are away.
9. The Hive Titan joins the next Grand Offensive if left alive.
10. Every number marked "proposal" in sections 4 to 8.

Nothing else in the vision is altered.

**Sources**

- Repository: `docs/ROADMAP.md`, `docs/conquest/audit/` (owner summary, decisions, spec, build plan, session briefs), `js/conquest/`, `worker/src/conquest*.js`, `worker/src/pvp.js`, `js/rules.js` on `main` at `d99d7d4`.
- [Firebase pricing](https://firebase.google.com/pricing) and [Realtime Database billing](https://firebase.google.com/docs/database/usage/billing), opened Nov 10, 2026.
