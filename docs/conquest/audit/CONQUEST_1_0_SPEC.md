# Conquest 1.0 — target design

Fable · Extra, Nov 10 2026. The complete design Conquest is built toward from Session 6 on. It extends `docs/economy/RESOURCE_ECONOMY.md` (which stays the one economy document; numbers here that change it are listed in §16 and go into that file when the session that builds them ships). Where an item depends on an owner choice it says **(Decision n)** and gives the recommended default; everything else is decided. Sessions and briefs: [BUILD_PLAN.md](BUILD_PLAN.md).

## 0. Fixed ground

Standing owner decisions, applied everywhere below: airdrop points come only from verified active play, the Command Base multiplier (×1.05…×1.25) and the Daily Base Yield; no pure AFK points; one 50,000 cap shared across modes; higher leagues earn more; points cannot be bought; only Ferrite Regolith and Ilmenite are ever sold; rare and above are earn-only; existing gear, Moonbeam and Lunar Skin are never weakened; every chassis stays and plating sits on top; fairness comes from leagues and matchmaking; RECALL is a 15 s channel, 10 min cooldown (5 with the premium Lunar Pass); the barren Moon is the foundation with ~30–40% terraformed; nothing may feel overwhelming; payments stay disabled until Session 8 certifies them.

**Design rule for everything new:** one new thing at a time on screen, every reward verified by the Worker exactly once, every chance published, every chance backed by a deterministic route.

## 1. The player's fantasy and the loop

You are the last line between humanity's refuge and the Parasites. Your tank is yours (one tank across Arcade, PvP and Conquest), your town is yours (seven sites, your name on the gate), and the war is shared (the warfront, the Meteor clock, the boards).

**Core loop (every session, 10–20 minutes on a phone):**

1. **Open the hub** → see what changed while away: yield meter, what raided you (Session 7), contracts, the next Meteor, your NEXT goal.
2. **Deploy** → the HUD shows one NEXT chip: goal, reward, distance ("RAID · DUST SWITCHBACK · 900 pts · 380 m").
3. **Sortie** (2–4 min): a field mission, a raid, a strike, an invasion defense, a terraform mode, a hunter pack that finds you. Fights have sound, hits, kills, loot pops.
4. **Loot** → salvage caches, minerals, and the new drops (parts, fragments, trophies, consumables). Rare things glow and announce themselves.
5. **Bank** → Refuge or your gate (30 m zone). Carried minerals are at risk until then; the new drops are safe on pickup (Decision 5).
6. **Town** → collect production (×3, Decision 10), build or upgrade one thing, run or watch a defense, fabricate a plate, research (Session 6B).
7. **Stronger** → the POWER chip rises; the next zone, raid tier or Gambit opens.
8. **Repeat** or **leave**: the hub shows when the yield is full and when the next Meteor lands; the Telegram bot says when something happened.

Every step either pays or sets up the next one; nothing is a dead end. The "one more" pull inside a session is the **Sortie chain** (§5.7); the reason to come back is the **appointment set** (§6).

## 2. The first hour (Session 6)

Targets: first fight ≤ 60 s, first loot ≤ 90 s, first upgrade ≤ 5 min, first plate ≤ 6 min, first "mine" (claim your town) ≤ 22 min, first town tour by minute 25; nothing on screen the player has not been introduced to.

| Time | What happens | Systems |
|---|---|---|
| 0:00 | Radio over the Refuge gate (15 s, SKIP): "Parasite armor on the oxygen line. Your tank is fueled. Go." The full transmission moves to HELP. | `app.js transmission()` becomes a HUD radio; story kept |
| 0:10 | Spawn at the Refuge gate (new spawn point ~40 m from the terminal, facing the towers). Two interceptors strafe the nearest tower 60 m ahead; a coach line: "Tap a red hull to lock. Hold FIRE." | spawn moves from the viaduct ramp to the Refuge; the oxygen-line mission's first wave is pulled toward the Refuge |
| 0:30 | First kill: kill pop, sound, haptic, a glowing cache. "Drive over it." | feel pass §12 |
| 1:00 | A sentinel (1,100 HP, 72 DPS) advances on the tower: the first enemy that hurts. UNDER FIRE arrow, SHIELD prompt once. | existing threat HUD |
| 2:00 | Mission secured: after-action with AIRDROP PTS, CP, Ferrite; "BANK at the Refuge: 60 m." The HUD gains the AIRDROP line now, not before. | progressive disclosure |
| 2:45 | Bank. The terminal shows one card: "SCAN finds ore. Your first plate: 40 Ferrite." SCAN pulses. | coach |
| 3:15 | The Starter Vein (35 Ferrite) is 40 m up the Refuge road; GATHER 5 s; a patrol pair answers the noise (interceptors: safe but loud). | Starter Vein moved next to the Refuge road |
| 5:00 | Bank; fabricate FRONT Ferrite: the slab appears on the hull, POWER chip +1. | plate visuals per tier (5E/6B) |
| 5:30 | NEXT chip: "INTERCEPT THE CONVOY · 450 pts · 140 CP · 258 m." Three field missions in a row; between them a roadside Ferrite vein and a hunter pack. | living world §5.6 |
| 18–22 | NEXT chip: "CLAIM YOUR TOWN · 600 CP" (Decision 1a). Gate 95 m from the Refuge. Site picker: seven sites, one line each. Name it. | CC1 claim |
| 22–25 | Town tour (6 s), then the coach's first build chain: Refinery → Cannon → first wall ring → Reactor → drill. | existing 5C coach |
| 25–60 | Raids unlock after the six field missions (unchanged); HUD shows "RAIDS · 2 / 6 FIELD MISSIONS". Meteor and BASE lines appear once the town exists. | |

Casual pilots (2×15 min) reach the claim in their second session instead of day 2.

## 3. Progression

### 3.1 One tank
- **Hull Plating** (unchanged numbers: `PLATE`): 4 slots × 6 tiers; visible slabs per tier on every chassis (5E provides the sockets; 6B the finishes). The Ferrite set is still +4% hull; what changes is that each plate *shows*.
- **Engineering** (unchanged: 8 tracks × 6 ranks, 57,200 CP) gets a readout: the POWER chip includes engineering as a Conquest bonus line, and each rank-up plays a sound and a hull highlight.
- **Mods and research (Session 6B):** the Science Lab researches mod blueprints with research parts (§4.3) + CP + time (level I 20 min … level III 8 h). Researched mods go into the existing garage Mods system (`FITS`), count toward gear rating like plates, and work at full strength in every mode (one tank, one progression; the same rule as plating). The lab's three levels gate tracks: I thermal and ballistics, II mobility and shield, III the set mods. No mod is ever sold.
- **POWER chip:** `powerOf(loadout)` (gear rating including plating and mods) on the HUD and hub; briefings and the map show the zone's recommended band ("POWER 92 · zone 80–110"). The number is informational; enemies never read it.

### 3.2 The town
- CC1 claim 600 CP + 30 alloy + 15 biomass + 2 He-3; CC2 1,950 CP + 80 alloy + 50 biomass + 6 He-3 (Decision 1a; cumulative to CC2 and every level after is unchanged, so the points multiplier arrives on the same day).
- CC3 2,200 CP, CC4 2,200 CP (Decision 13a; cumulative to CC5 unchanged).
- Production ×3 (Decision 10a): Refinery 2.4 alloy, Biodome 1.8 biomass, Helium Extractor 0.45 He-3 an hour per level; Storage caps ×2 (alloy/biomass 60 + 80 × level, He-3 16 + 20 × level); the hub shows "+N alloy since you left".
- Shells filled: Science Lab (6B research), Trophy Hall (§4.4), Hangar (7: garrison; shows owned tanks), Uplink (also receives the Telegram alerts setting).
- Everything else as built in 5/5B/5C.

### 3.3 What a regular player's months look like (modeled, `model/audit-economy.json` + the changes above)
- **Hour 1:** town claimed, first plate, three field missions, raids in sight.
- **Days 1–3:** CC2–3, Ferrite set, first consumables, first contracts, first hunter packs; first Parasite raid on the town (Decision 6) lands on day 2–3 with a replay and a REPAIR.
- **Week 1–2:** CC5–7, Ilmenite set, first research part → first mod, first commander trophy, first Meteor secured via the Strike Beacon.
- **Month 1:** CC9 (×1.25), Armalcolite set, two mods, Gambit modifiers open, Veteran/Ace league, first player raid (if 7's phase 2 is live).
- **Months 2–3:** CC10, Tranquillityite set, first Selenite from a Hive Titan or Resonance, Trophy Hall level 2, boards.
- **Months 3–12:** Selenite set, Moonheart plates one at a time (Resonance + Titan + weekly Titan board), full research tree, town layouts for raid metas.

## 4. Loot (owner request)

Random drops that never compete with the store. Server-rolled at the moment of the verified kill or completion, keyed to the kill id / attempt (a reload cannot re-roll), paid through the existing outbox for anything that touches the account wallet. Every rate below is published in the wiki's Minerals & Hull Plating section (renamed "Loot, Minerals & Plating").

### 4.1 Sources and tables

| Source | Always | Chance drops (independent rolls) | Pity |
|---|---|---|---|
| **Normal mobs** (interceptor, saboteur), world and mission kills, same generation gating as salvage | salvage cache (as today) | 12% 1 Ferrite · 3% 1 Ilmenite · 4% consumable · 0.5% common fragment | — |
| **Elites** (sentinel, fire coordinator) | salvage cache | 25% 1 Ilmenite · 6% 1 Armalcolite · 8% consumable · 3% research part · 1% uncommon fragment | 20 elites without a part → part |
| **Raid commanders** (ambush, shield, artillery, carrier, plasma) | the raid's existing mineral cache (unchanged: HARD 2 Il + 0.4 Ar; VETERAN 1.5 Ar + 0.3 Tq) | 12% research part · 10% that commander's trophy · 5% rare fragment · VETERAN only: 8% 1 Tranquillityite | 10 commanders without a trophy → trophy (of the type fought most) |
| **Raid completion chest** (opens in the after-action) | receipt + 1 consumable | 8% rare fragment; the 25-shard blueprint and 3.5% elite roll stay | as today (25 shards) |
| **Meteor Strike** | unchanged §5.4 (2 Il + 2 Ar, 50% Tq, 15% Se, 2.5% Mh, Resonance 12/40) | 15% research part · 10% rare fragment | Resonance as today |
| **Hive Titan** (world boss, Decision 14; every 6th strike site) | 2 Tranquillityite + 25% research-part guaranteed roll | 20% Selenite · 2% Moonheart · 30% Titan trophy · 10% epic fragment | 5 Titans without Selenite → Selenite |
| **Invasion / town defense held live** | existing defense cache (2 Fe + 1 Il) | 6% consumable ×2 · 4% uncommon fragment | — |
| **Contracts** (§6.1) | CP + 1 consumable | the third daily → 1 fragment; the weekly → 1 Armalcolite + 1 rare fragment | — |

Mineral timelines (RESOURCE_ECONOMY §7.2) move by at most ~15% for Ilmenite/Armalcolite and less for the rest; the vein caps still bind grinders. The model is re-run in Session 6 and the spec table updated.

### 4.2 Rarity and the loot pop
Common (grey), Uncommon (green), Rare (cyan), Epic (violet), Legendary (gold), using the existing Arcade rarity colors so the whole game speaks one language. A drop is a glowing sprite on the ground with its rarity color and a one-word label; picking it up plays the rarity sound and a 0.8 s flyout to the HUD; rare and above also pause the ticker for a "RARE · THERMAL CORE" card and a Telegram haptic. The after-action lists drops under the tiles.

### 4.3 What drops (all earn-only, none ever in the store)
- **Minerals:** commons from mobs in 1–2 units; Armalcolite and up only from elites, commanders, bosses, VETERAN raids and strikes (store crates are 150 Ferrite / 60 Ilmenite, so mob commons never replace them).
- **Research parts** (Session 6B inputs): Thermal Core, Ballistic Coil, Drive Servo, Field Capacitor. Account-bound. Cap 50 each.
- **Blueprint fragments** for earn-only cosmetics, four pools: common (plate finishes: matte colors), uncommon (turret decals, banner emblems), rare (animated plate seams, trail colors), epic (town lighting variants, a Titan-bone gate ornament). 10 fragments of a pool = one cosmetic from that pool, server-picked without repeats until the pool is complete. These pools never overlap with store items.
- **Trophies** for the Trophy Hall: five commander trophies, the Titan trophy, the Strike Core (every 12th secured strike), legendary minerals on display. Trophies are cosmetic and add +15 Town Score each; a complete set gives a banner emblem.
- **Conquest-only consumables** (account-bound, cap 10 each, never usable in Arcade/PvP or the Home Sector, never sold): Repair Kit (+40% hull over 6 s, 60 s cooldown: the field has no hull regen, this is its answer), Shield Cell (instant shield recharge), Scanner Charge (one SCAN at +100 m that also reveals this sector's unscanned veins for 30 s), Decoy Beacon (pulls Parasites within 120 m to a point for 8 s so you can gather or extract).

### 4.4 Never drops
Anything in `ConquestPlot.STORE` or the mineral crates (wall skins, turret skins, town lighting, second builder, Foundry speed-up, layout slot, wall extension pack), speed-ups of any kind, airdrop points beyond the activity's own value, Ferrite/Ilmenite in crate-sized amounts, paid cosmetics, Lunar Pass tiers, Arcade gear. The two lists (store table, loot table) live in one data file each and a test asserts they are disjoint.

### 4.5 Risk (Decision 5a)
Minerals stay cargo (50% loss on death rounded down, 10-minute wreck; a single unit is never lost). Parts, fragments, trophies and consumables are account-bound on pickup: the pop never becomes a loss screen.

### 4.6 Ties
Parts → research → mods (power you can see). Fragments → cosmetics on tank and town (pride). Trophies → Trophy Hall and Town Score (pride, social). Consumables → the Sortie chain and the Strike Beacon (one more). Minerals → plating and walls (unchanged).

## 5. Modes, events and the living world

### 5.1 Field missions (6) — unchanged, with the first-hour re-stage (§2) and airdrop repeat taper (Decision 3a: 100% for the first three completions of a mission a day, then 60%, then 40%; CP taper unchanged).

### 5.2 Raids (25) — unchanged content. New: **Commander's Gambit** modifiers chosen by the pilot before a VETERAN raid, stackable up to three: No Shield (+15% rewards), Double Reinforcements (+20%), Enraged Commander from the start (+25%), Dust Storm (reduced visibility, +15%, needs 6B weather). Rewards multiply CP, salvage and loot quality (one rarity step on the chest at three modifiers); airdrop points use the VETERAN value times the modifier total, capped at +60% (1,300 → 2,080), inside the hourly outcome limit and the daily cap. Gambits are the ceiling for top kits without touching gear: a full legendary kit with Epic engineering wins 15 of 15 plain VETERAN raids today.

### 5.3 Meteor Strike — unchanged schedule plus the **Strike Beacon** (Decision 4a): once a UTC day a pilot may call a strike at the current site within a 20-minute window; same waves, rewards, slot rules and Resonance; it counts as that slot for the pilot. Shown on the hub ("STRIKE BEACON READY") and the HUD.

### 5.4 Hive Titan (Decision 14a) — every 6th strike site (slot % 6 === 0) spawns the Titan when the core is extracted: fixed authored 9,000 HP, three phases (charge, burrow + swarm, plasma rain with telegraphed rings), 4 minutes, per-pilot instance. Damage dealt posts to a weekly shared board (CAS document like the warfront); top 100 → 1 Selenite, top 10 → 1 Moonheart, 30-day top 3 → 2 Moonheart (the "top competitive rewards" the economy spec reserved). Loot per §4.1. Points 1,600 base (par 6 min × 225 × 1.2) once per slot.

### 5.5 Sector invasions — unchanged; the alert reaches the Telegram bot (§6.3).

### 5.6 Living world (Session 6)
- Patrol routes 4 → 12 (two per sector), authored, with the existing archetypes.
- **Hunter packs:** 1 + ⌊held sectors ÷ 2⌋ roaming groups (2 interceptors + 1 coordinator; a sentinel joins in HARD sectors) that hunt the pilot within 200 m; regenerate hourly (their kills pay world-kill points under the hourly limit).
- **Vein ambush:** in HARD/VETERAN sectors, 35% chance a sentinel pair arrives 20 s into a pull.
- **Incursion:** after 10 minutes of play without a fight, three raiders spawn 120 m from the pilot and attack (never within 60 m of the Refuge or inside the gate zone).
- All authored, never gear-matched (`enemyStats` stays archetype-only; the 5D regression test covers Conquest).

### 5.7 Sortie chain (Session 6)
Consecutive operation wins within 10 minutes: +10% CP and salvage per link, cap +30% at three, one rarity step on loot at three; resets on death, RECALL or leaving Conquest. A HUD meter shows it. Airdrop points are not multiplied by the chain (the cap and league factors stay the only points levers).

### 5.8 Terraform-zone modes (Session 7B, roadmap list; one engine each)
Colony Defense (town-raid engine on the frontier wall and farms; place colony turrets from a budget; 675 pts), Bridge Assault (hold three bridge points against waves, 900 pts), Convoy Run (escort along colony roads under ambush, 900 pts), Blight Purge (destroy five blight sources, the zone recovers visibly, 450 pts), Forest Hunt (three hunter packs in the forest, line-of-sight fights, 675 pts). Values follow the economy spec's par method (225 base a minute × danger). Each pays settler reputation.

### 5.9 Settler contracts and reputation (Session 7B)
Every 10 settler homes in your town post one contract a day (deliver 20 biomass, escort a harvest, defend farms, clear blight). Reputation unlocks settler vendors (consumable trades for biomass), settler decorations and the market square cosmetic. No points beyond the contract's activity.

## 6. Reasons to return

### 6.1 Contracts board (Session 6)
Three daily contracts drawn from a pool at the UTC day ("Win 2 raids", "Bank 60 alloy", "Mine 12 ore", "Hold a drill", "Secure a strike", "Destroy 15 Parasites", "Finish a field mission in 3 sectors") and one weekly ("Win 10 raids", "Hold 3 drills and 1 live defense", "Secure 3 strikes"). Rewards: CP 150–300 and one consumable per daily, a fragment on the third daily, 1,500 CP + 1 Armalcolite + 1 rare fragment for the weekly. Points come only from the activities themselves. One hub card and a HUD chip ("CONTRACTS 1/3").

### 6.2 Daily Base Yield (Decision 2a)
Materials part unchanged. The points part unlocks in 25% steps per verified operation that UTC day (harvests count half); the meter shows "YIELD POINTS 50% · 2 operations to go".

### 6.3 Alerts (Session 7)
The Telegram bot sends: yield ≥ 90%, Meteor in 5 minutes (only if the pilot played in the last 48 h), your town was raided (outcome, one-tap REPAIR link, replay), Strike Beacon ready. Max 3 a day, settings in the Uplink card.

### 6.4 Soft streak (Decision 8a)
Days with any verified Conquest activity: day 1 Repair Kit, day 3 Scanner Charge, day 7 banner emblem (earn-only), day 30 town decoration; two freeze days a week; never points or minerals.

### 6.5 Weekly rhythm
Weekly contract, Base of the Week plaque, Hive Titan board, weekly league minerals (Arcade), season boards (7B).

## 7. Raids on your town

### 7.1 PvE raids while away (Session 7, Decision 6a)
- Eligibility: CC ≥ 2 (new towns have a 3-day shield), the pilot offline ≥ 2 h, ≥ 8 h since the last raid, no active peace shield. Frequency 1 a day up to CC5, 2 a day from CC6.
- Threat T = CC (the drill's waves); seed = (pid, day, n). Runs on the Worker with the drill engine; `applyRaidDamage` writes persistent damage; outcome, kills per turret and breaches go to `plot.log` and `plot.alerts`.
- Loot share: Command Center destroyed → 10% of the exposed production store (Storage protects 25–75%) and 5% of composite stock; a breach without the CC → 5%; held → 0. Banked goods, wallet, CP, points, plates, cosmetics are never raidable.
- Held raids count toward the wall-extension milestones (3 and 10 wins) and the `base-defender` achievement; they pay CP and materials but **no airdrop points** (nobody was there).
- **Live defense:** if the alert arrives while the pilot is online, a 60-second window lets them enter the Home Sector and fight with the turrets; a live hold pays the 675 defense points.
- Peace shield 8 h after a lost raid (`plot.shieldUntil`); an earnable 24 h shield drops as a rare consumable.

### 7.2 Player raids (Session 7, phase 2)
- Opt-in by CC ≥ 4; both accounts ≥ 7 days old, not in a flagged cluster, not squadmates, not the same target twice in 24 h.
- Matchmaking by defense rating ±25% (the 5B `dr` snapshot).
- The attacker drives into a Home Sector copy of the target town with a 3-minute clock and two raider waves they call at will; victory = Command Center down; steal 5/10/15% of the exposed store by the attacker's declared band; a failed breach steals exactly zero (flagship rule). Attacker points: 900 base (HARD raid value) once per target per day; the defender's replay carries a REVENGE button (one revenge, same band, within 24 h).
- Shields: free 8 h after being raided; the earnable 24 h shield; a store raid shield only once this exists (standing rule).

### 7.3 Garrison (Session 7)
Hangar slots hold owned tanks as defenders (fixed authored AI, never copying the attacker's gear); they fight in live defenses and in the away simulation.

## 8. Social

- **Boards (7B), on the hub:** weekly Town Score gain, defense rating, raid time-attack per layout, Hive Titan damage, campaign score. Only the Titan board pays minerals (§5.4); the others pay CP and a fragment to the weekly top 100.
- **Squads:** squad territory wars (7B) sum members' sector captures per week; the winning squad's banner flies at the monument.
- **Friends:** visit a squadmate's town, watch their last raid replay, send one Repair Kit a day; a "HELP WANTED" ping when their town is damaged.
- **Pride:** the Base of the Week plaque on the visited town's gate; share cards after every first clear, held drill, trophy and Titan kill (the 5C renderer).
- **Live airdrop standing** (7B, roadmap): "You're #842, 1,200 pts to top 800" with the trust line (§10).

## 9. Spending players enjoy (Session 8 builds checkout)

Guardrails (owner wording): paid features never grant airdrop points or rare+ minerals directly; indirect gains through power or base level are allowed; raid shields only once player raids exist; every price and sellable flag in one table.

**Catalog**
- Lunar Pass Conquest perks: RECALL 5 min (exists), scanner +50 m, two extra layout slots, one Repair Kit a day, a Pass-only plate finish. Never points, never minerals.
- Second builder (an earnable second builder exists: Trophy Hall III).
- Town looks: lighting sets, wall skins, gate ornaments, banner sets, decorations.
- Tank plate finishes and trim (looks only; tier stays readable).
- Ferrite Crate (150, 2 a day) and Ilmenite Crate (60 + 30 Ferrite, 1 a day, 4 a week).
- Extra layout slot; wall extension pack (+10% capacity, never strength).
- Speed-ups for construction timers only, shown with the earn time beside them, not in the first wave.

**First wave:** Decision 12 (★ Pass perks, second builder, town looks bundle, plate finishes, Ferrite Crate).

**Never sold:** anything in the loot tables, points, rare+ minerals, mods, research, Gambits, consumables, trophies, boards.

## 10. Anti-cheat and airdrop integrity

Existing: server-stepped simulation; immutable outbox with exactly-once credit; 50,000 shared cap; 90 requests/min; 120 points outcomes/h; `cqppm` and `hours` flags; device/IP/wallet/replay clusters; new-account weighting; dev mode never earns.

New (Sessions 6–7):
- Yield steps (Decision 2a) and the field-mission points taper (Decision 3a).
- **Conquest command fingerprints** (deferred since Session 4): per operation, steering entropy, firing cadence variance, completion-time variance and a path hash; three near-identical operations in a day → `cqrepeat` flag; zero-variance steering → `cqnoinput`.
- **Alt signals:** identical town layout hashes across accounts with the same device or network; identical daily activity windows; same Strike Beacon minute.
- **Trust line** on the live standing ("verified play 94%") computed from flags and fingerprints; flagged pilots keep playing and sit out the snapshot until cleared (existing rule).
- Loot rolls keyed to kill ids and attempts; consumables capped; no client-sent amounts anywhere.
- A weekly admin-sheet row per flagged cluster with one-tap clear.

## 11. Analytics (Session 6, Decision 11a)

Twelve anonymous events as daily Firebase counters (`an/<day>/<event>[/<key>]`, increments like the signup funnel) plus cohort counters (`an/cohort/<firstDay>/{d1,d7,d30}`): enter, transmission skip/read, mission start/end by id and outcome, death by cause and carrying, bank, claim town (minutes-to-claim histogram), build by type, raid start/end by id/outcome/seconds, gather by mineral, quit point by last screen and session minute, session minutes histogram, return D1/D7/D30. No personal data; pid never stored with an event; one admin tab.

**Success targets after Session 6:** 70% of pilots who enter finish the first mission; 60% of those claim a town in session 1; D1 ≥ 35%, D7 ≥ 15%; median session 12 min; first-session quit point not "transmission".

## 12. HUD and UX principles (nothing overwhelming)

- One NEXT chip; one coach line; everything else behind MAP/MORE.
- Progressive disclosure: AIRDROP, BASE, METEOR, CONTRACTS lines appear when they first matter.
- Ten touch targets → eight: SCAN and GATHER become one context button ("SCAN" normally, "GATHER" near ore), MORE absorbs LOCATE.
- Every screen fits or scrolls (AGENTS rule); the hub's pinned action row never covers card text.
- Copy is plain and short; numbers appear only when they decide something.

## 13. Audio and weather (Session 6B)
Zone ambience (barren: near silence, suit hum, distant impacts; terraformed: wind, water, settlers, machinery), weapon/impact/explosion sounds shared with Arcade (`js/fx.js`), UI and reward sounds, stingers for raids, strikes, Titan and victories, mute toggle; dust storms on the barren Moon (visibility, a tactical event that favors Gambits), rain and fog in terraformed zones; telegraphed, capped budgets.

## 14. Visual priorities
Session 5E: your tank with plate sockets, the four Parasite archetypes with distinct silhouettes, the first-hour stage (Refuge, towers, viaduct sign), Moonbeam v9 and the town items, loot/impact VFX hooks. Session 7.5: zone color grades, weather post-processing, shadows and AO, animated Selenite/Moonheart, a 60-minute day cycle.

## 15. Session map
Session 6 Core Fun: §2, §4 (v1: tables, pop, consumables, fragments, pity; parts stored for 6B), §5.6, §5.7, §6.1, §6.2, §11, §12, Decisions 1/2/3/10/13. Session 6B Tank Lab: §3.1 mods and research, plate visuals, POWER chip, §13. Session 7 Living Town: §7.1–7.3, §6.3, §5.3 Strike Beacon, §6.4. Session 7B Competitive & Social: §5.2 Gambits, §5.4 Titan, §5.8, §5.9, §8, trust line, live standing. Session 7.5, 7.8, 8 (§9), 9, 10 as in the roadmap.

## 16. Changes to RESOURCE_ECONOMY.md when built
§3.2: field-mission repeat taper; yield points in steps; Titan 1,600 base points; Gambit cap +60%. §4: production ×3 and storage ×2; CC1/CC2 split; CC3/CC4 2,200. §5: loot tables (new §5.7), consumables, parts, fragments; Titan rewards and the weekly board as the top competitive rewards. §9: the loot/store disjointness rule, the first wave. §3.4: the new flags. Each session re-runs `dev/tools/economy-model.mjs` and the vein/base progression tests and updates the tables.
