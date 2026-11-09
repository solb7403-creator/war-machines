# LUNAR: War Machines — Resource Economy (master spec)

**Status: APPROVED v1 (owner sign-off 2026-11-08; decisions in §0 and §12). Phases 1–3 are implemented on branch `claude/friendly-allen-7tcyca` (not yet released; §10 lists what was built and the few places it differs).** Payments and checkout stay disabled. Airdrop boards stay tracking-only (`AIRDROP.dist=false`): nothing here promises tokens.

This is the one economy document for:
- this session (airdrop points, terraform/biomass, minerals and hull plating);
- the later base-builder, tank and competitive sessions.

Later sessions extend this file. They do not start a new one.

**Where the numbers come from:**
- The model is `node dev/tools/economy-model.mjs` (deterministic, read-only). Its full output is in [`economy-model.json`](economy-model.json).
- It uses the real shared rules (`js/rules.js`: league pay, power fit) and the measured Arcade league grid (`docs/launch/s2data/league-grid-standard.json`).
- **Arcade numbers are measured** (bot pilots, from `docs/launch/LEAGUES.md`).
- **Conquest, mineral, plating and timeline numbers are modeled proposals.** None of them comes from a human playtest. Phases 1–3 replace the assumptions with scripted-pilot measurements.

---

## 0. Owner decisions already applied (2026-11-08)

- **Minerals:** six of them, in this order:
  1. Ferrite Regolith (common)
  2. Ilmenite (uncommon)
  3. Armalcolite (rare)
  4. Tranquillityite (very rare)
  5. Selenite Glass (epic, reflective: reduces energy damage)
  6. Moonheart (legendary, the densest)
- **Uses:** hull armor plating now; base armor and defenses in the base-builder session.
- **Alloy:** later it is refined from minerals at a base refinery (base-builder session). Today's alloy sources stay until then.
- **Mineral sources:**
  - Conquest deposits are the main source.
  - Arcade and PvP wins also drop minerals, mostly common and uncommon, in smaller amounts.
  - Rare and above come mainly from Conquest's dangerous zones.
  - Legendary comes mainly from Meteor Strike events and top competitive rewards.
- **Timeline targets for a regular player:**

  | Full set | Target |
  |---|---|
  | Common | about 3–4 days |
  | Uncommon | about 1–2 weeks |
  | Rare | about 1 month |
  | Very rare | about 2–3 months |
  | Epic and legendary | long-term |

- **Armor strength:** armor works at FULL strength in every mode (Conquest, Arcade, PvP). There is no PvP reduction or cap.
  - Fairness comes from leagues: armor counts toward gear rating, which sets league and matchmaking.
  - Existing gear, Moonbeam and Lunar Skin are never weakened.
- **Conquest airdrop points:** Conquest earns airdrop points from active play (missions, raids, defenses, gathering, events), at about Arcade's points a minute per league.
  - The Command Base level multiplies Conquest points, up to about ×1.25.
  - The Daily Base Yield (points + materials) fills over 24 h and must be collected at the base.
  - No pure AFK points.
- **Daily cap:** 20,000 → **50,000** base points a UTC day, one cap shared by every mode. The existing league airdrop factors are kept.
- **Store:**
  - Only common and uncommon minerals can be sold. Rare and above are earn-only.
  - Checkout stays disabled until payments are certified.

**Owner sign-off on the Phase 0 decisions (2026-11-08):**
1. The Daily Base Yield points count **inside** the 50,000 cap.
2. Moonbeam and Moonfall are **exempt** from Selenite's energy reduction.
3. Moonheart stays at about **+12% gear rating** on a top kit.
4. The mineral store is approved as proposed (§9.1). Checkout stays off.
5. Guardrail wording: **paid features never grant airdrop points or rare+ minerals directly.** Indirect gains through power or base level are allowed, the same as Moonbeam today. Examples: a faster base through speed-ups or a second builder, or gear that raises league. Raid shields only once PvP base raids exist.
6. A day with a verified Conquest operation **counts as an active day** for referral verification.
7. Arcade-only pace is raised so the **rare set takes about 3 months**. Very rare and above stay Conquest/competitive.
8. The lead's defaults are approved:
   - Conquest points are spendable too, with the same league bonus as Arcade.
   - Command Base multiplier ×1.05/1.10/1.15/1.20/1.25.
   - Meteor Strike every 2 hours.
   - Raid and first-base rewards unchanged.

---

## 1. Principles

1. **One game, one progression.** Arcade, PvP and Conquest all pay the same airdrop points, under the same daily cap and the same league factors. They also build the same tank, because hull plating applies everywhere. Every mode has a reason to visit the others:
   - Conquest is where minerals and bases come from.
   - Arcade and PvP are where leagues and competitive rewards come from.
2. **Airdrop points are the headline until TGE.** Every verified, meaningful activity pays them. Nothing pays them for being idle.
3. **Earned first.** The store only sells time on the two common tiers. Rare and above, base levels and points can only be earned.
4. **Server authority.** Points and minerals come only from server-simulated, verified outcomes, credited exactly once. The phone never claims a reward.
5. **Transparent chance, deterministic backstop.** Every random drop has published odds. Every chance item also has a guaranteed counter route. There are no loot boxes and nothing paid is random.
6. **Never weaken what players own.** Plating adds to every chassis (Scout, Vanguard, Titan, every rarity). It replaces nothing. Existing gear, Moonbeam and Lunar Skin keep their exact numbers.
7. **Always a next goal.** The ladders below are sized so a regular player has a meaningful upgrade every few days in month 1, and every few weeks for a year.

---

## 2. Resource map

| Resource | Lives in | Earned by | Spent on | On death | Store |
|---|---|---|---|---|---|
| **Points** (base = airdrop/leaderboard; spendable = base × league bonus) | `eco/<pid>` | Arcade/PvP results, quests, daily reward, pass, referrals; **new:** Conquest active play and the Daily Base Yield | crates, upgrades, tune-ups, salvage, respec; **new:** plate fabrication fees, Ferrite for points | safe | never sold |
| **CP** (Command Points) | `conquest/<pid>` ledger | Conquest kills, missions, raids, defenses, base production | engineering ranks, Command Base tiers, modules, repairs | safe | never sold |
| **Lunar Alloy** | Conquest cargo → banked | kills, missions, raids, defenses; **new:** Daily Base Yield; **later:** refinery (from Ferrite/Ilmenite) | engineering, base, modules, repair | 50% of carried | never sold |
| **Parasite Biomass** | Conquest cargo → banked | kills, missions, raids; **Phase 2:** flora nodes in terraformed zones become the main source | engineering, base, modules | 50% of carried | never sold |
| **Helium-3** | Conquest cargo → banked | missions, raids, heavy kills, defenses | base tiers, upper engineering ranks | 50% of carried | never sold |
| **Ferrite Regolith** (common) | Conquest cargo → account wallet `eco.mn` | Conquest deposits, op caches, Base Yield, Arcade/PvP results | plates (all tiers), later the refinery | 50% of carried | **sellable** |
| **Ilmenite** (uncommon) | same | deposits, raids, strikes, Base Yield, Arcade/PvP wins | Ilmenite and Armalcolite plates, later the refinery | 50% of carried | **sellable** |
| **Armalcolite** (rare) | same | HARD-zone deposits, raids, strikes, weekly league reward | Armalcolite and Tranquillityite plates | 50% of carried | earn-only |
| **Tranquillityite** (very rare) | same | VETERAN-zone deposits, VETERAN raids, strikes | Tranquillityite and Selenite plates | 50% of carried | earn-only |
| **Selenite Glass** (epic) | same | Meteor Strike core, Tranquillityite veins (3%), weekly top 100 | Selenite and Moonheart plates | 50% of carried | earn-only |
| **Moonheart** (legendary) | same | Meteor Strike core, top competitive rewards | Moonheart plates | 50% of carried | earn-only |

**Death rule.** Carried minerals follow the existing salvage rule exactly:
- You lose 50% of what you carry, rounded down.
- The lost half goes into the 600-second owner-only wreck.
- Because of the rounding, a single carried Selenite or Moonheart can never be lost.
- Banked minerals, CP, plates and gear are always safe.

---

## 3. Airdrop points

### 3.1 How points work today (facts from the code)

- **Base points** count for the airdrop board, the leaderboards and the daily cap.
- **Spendable points** = base × the league spendable bonus (`LG_MULT`, ×1.00 → ×2.00).
- **League airdrop factors** (`LG_BASE_PAY`):

  | Rookie | Pilot | Veteran | Ace | Elite | Master | Lunar Legend |
  |---|---|---|---|---|---|---|
  | ×1.00 | ×1.09 | ×1.18 | ×1.28 | ×1.39 | ×1.50 | ×1.60 |

  League = gear rating (power) × form.
- **Daily cap:** `DAILY_CAP=20000`, in `js/rules.js` and `worker/src/db.js`.
  - It applies to match points.
  - Fixed claimable rewards are outside it: quests, milestones, daily reward, pass, weekly chest.
- **Airdrop credit** `ac` follows lifetime base points. Brand-new accounts earn it at a reduced weight for their first days.
- **Anomaly flags** keep a pilot out of the airdrop snapshot until cleared. Examples: points a minute, hours a day, no-input driving, repeated identical controls, clock patterns, win trading.
- **Conquest today earns no points.** Its in-game copy says "CP is separate from Arcade and airdrop points."

### 3.2 What changes

**Daily cap: 50,000 base points a UTC day, one cap for Arcade, PvP and Conquest together.**
- It is enforced in one place, the shared `ecoAward`, so no mode can bypass it.
- Fixed claimable rewards stay outside the cap, as today.

**Conquest points formula:**

> base points = activity value × league factor (`LG_BASE_PAY`) × Command Base multiplier
>
> spendable points = base points × league spendable bonus (`LG_MULT`), exactly like Arcade

Conquest uses the pilot's current league. That league is gear rating × form, the same one the Arcade shows.

**How the values were set.** Each value = par minutes × 225 base points a minute × a danger factor:
- Par is the existing ordinary-pace estimate including travel and banking (field mission 120 s, HARD raid 200 s).
- 225 a minute matches Arcade's measured stock-kit Rookie rate of 223.
- Danger factors: STANDARD ×1.0, HARD ×1.2, VETERAN ×1.45.
- Harvests pay 75% of par, because minerals are their main reward.

| Activity (verified outcome) | Base points at Rookie | Par minutes |
|---|---:|---:|
| World kill: interceptor or saboteur | 35 | 0.16 |
| World kill: heavy sentinel or fire coordinator | 90 | 0.41 |
| Field mission completed (any of the six) | 450 | 2.0 |
| Raid victory, HARD | 900 | 3.33 |
| Raid victory, VETERAN | 1,300 | 4.0 |
| Defense victory (Command Base or sector) | 675 | 2.5 |
| Meteor Strike secured | 1,075 | 4.0 |
| Harvest: Ferrite / Ilmenite / Armalcolite / Tranquillityite | 100 / 140 / 240 / 390 | 0.6 / 0.85 / 1.2 / 1.6 |
| Harvest: bio-flora node (Phase 2, Biomass) | 80 | 0.47 |

The bio-flora value was not in the signed-off table. It is set by the same approved method: a 4 s channel plus about 20 s of travel between nodes is 0.47 par minutes × 225 × 75% (harvest) ≈ 80. That is about 200 base points a minute while gathering, below the 225 Arcade-matched rate.

**Never pays points:**
- driving or exploring on its own;
- banking, building, fast travel, RECALL;
- idle time;
- re-killing a unit in the same spawn generation;
- raid reinforcement waves (they already carry no salvage);
- a failed or abandoned operation, except the verified world-tier kills inside it.

Repeats pay the same as the first time, like Arcade matches (CP keeps its own first/daily/repeat steps). Existing per-activity cooldowns bound repeats:
- 180 s per field mission;
- one receipt per raid attempt;
- patrol and garrison generations;
- deposit respawns;
- one claim per strike slot;
- one claim per defense alert.

**Command Base multiplier (Conquest active-play points only):**

| Base | none | I | II | III | IV | V |
|---|---|---|---|---|---|---|
| Multiplier | ×1.00 | ×1.05 | ×1.10 | ×1.15 | ×1.20 | ×1.25 |

If the base-builder session adds levels, the steps are re-spread so the top level stays at about ×1.25.

**Daily Base Yield** replaces today's once-a-day CP claim with a fill meter:

| Command Base | Points (base) | CP | Alloy | Biomass | Helium-3 | Ferrite | Ilmenite |
|---|---:|---|---:|---:|---:|---:|---:|
| I | 1,000 | today's production formula | 6 | 4 | 1 | 6 | 0 |
| II | 1,400 | ″ | 9 | 6 | 1 | 8 | 1 |
| III | 1,800 | ″ | 12 | 8 | 2 | 10 | 1 |
| IV | 2,200 | ″ | 15 | 10 | 2 | 12 | 2 |
| V | 2,600 | ″ | 18 | 12 | 3 | 14 | 2 |

How the yield works:
- **Fill:** it fills continuously from the last collection and is full after 24 h. It stops at full, so there is no stockpiling.
- **Collect:** at the physical Command Base terminal only (the MAP shows the meter but cannot collect). Any fill of 10% or more can be collected; you get that fraction.
- **Meter:** a visible fill meter on the base terminal, the MAP base card and a HUD chip near the base (e.g. "YIELD 64%").
- **No pure AFK points.** The points part needs one verified Conquest activity earlier that UTC day: a mission, raid, defense, strike or harvest. The materials part does not.
- **CP:** keeps today's formula and numbers (`baseProduction`: tier, Reactor, reputation, Uplink). Only the timing changes, from one claim a day to a continuous fill.
- **Where it goes:** materials are banked straight into the base vault. Minerals go to the account wallet.
- **Cap:** the points count inside the 50,000 cap (owner decision).

### 3.3 Points a minute: Arcade vs Conquest

Base points a minute (= airdrop points), standard pilot, for the kit that settles in each league:
- **Arcade:** measured (`docs/launch/LEAGUES.md`).
- **Conquest:** modeled. The kit speed and content-mix assumptions are in the Appendix.

| League | Kit settled there | Arcade (measured) | Conquest, no base | Conquest, Base III | Conquest, Base V |
|---|---|---:|---:|---:|---:|
| Rookie | stock | 223 | 214 | 246 | 267 |
| Pilot | common | 264 | 252 | 290 | 316 |
| Veteran | rare | 320 | 307 | 353 | 383 |
| Ace | rare | 343 | 333 | 382 | 416 |
| Elite | epic | 460 | 447 | 514 | 559 |
| Master | epic | 495 | 483 | 555 | 603 |
| Lunar Legend | legend | 702 | 620 | 713 | 775 |

- **Without a base,** Conquest pays within about 5% of Arcade. The exception is the top league, where the legend kit's near-certain short Arcade wins keep Arcade about 12% ahead.
- **A Command Base** puts Conquest about 10–20% ahead. That is the intended pull toward building one.
- **Minutes to fill the 50,000 cap** (Arcade / Conquest Base V):

  | League | Rookie | Pilot | Veteran | Ace | Elite | Master | Lunar Legend |
  |---|---:|---:|---:|---:|---:|---:|---:|
  | Arcade / Conquest Base V | 224 / 187 | 190 / 158 | 156 / 130 | 146 / 120 | 109 / 89 | 101 / 83 | 71 / 65 |

  A regular 45-minute player never reaches the cap. The cap only stops grinding and farming.
- **Anomaly flag:** the existing points-a-minute flag stays at 1,600 a minute over 30 minutes, now counted across all modes combined. That is still twice the best modeled honest rate.

### 3.4 Bot resistance and rate limits

- **Verified outcomes only.** Conquest is already server-simulated: the Worker steps every 50 ms from the player's commands, and simulated time can never exceed wall time. Points come from the same verified completions that already pay CP: mission receipt, raid receipt per attempt, kill loot generation, defense outcome. New sources (harvest, strike) follow the same pattern. The client never sends an amount.
- **Rate limits:**
  - the existing 90 Conquest requests a minute per pilot;
  - the existing per-activity cooldowns;
  - **new:** at most 120 points-paying Conquest outcomes per hour per pilot (above that, no points; the event is logged);
  - one Daily Base Yield points payout a day.
- **Anomaly flags.** These reuse the eco flags. A flagged pilot keeps playing but sits out the airdrop snapshot until cleared.
  - **built in Phase 1:** Conquest points a minute (`cqppm`: over 1,200 base points a minute across 30+ minutes of simulated Conquest play in a day, about 1.5× the best honest modeled rate);
  - **built in Phase 1:** more than 20 active hours a day, Arcade and Conquest combined (`hours`);
  - **built in Phase 1, replacing the planned yield-only flag:** the Daily Base Yield's points part simply does not pay without a verified operation that day, so a yield-only account earns no points at all;
  - **deferred** (needs per-activity command fingerprints, a later session): identical command sequences across activities, zero steering variance, near-constant completion times;
  - linked-account clusters (the existing `link()` by IP hash and device) apply unchanged.
- **The existing new-account airdrop weighting** applies to Conquest points automatically, because they flow through the same credit.

### 3.5 How Conquest points reach the account (exactly once)

Conquest has its own Firebase record and CAS boundary (`conquest/<pid>`), separate from the account record (`eco/<pid>`). Credit uses a transactional outbox:

1. **Conquest side.** Inside the Conquest transaction, each verified outcome adds raw points (value × the Command Base multiplier at that moment) to the request's accumulator. When the transaction ends, the accumulator becomes **one immutable outbox entry** with a monotonic id. Entries are never modified after they are written, so a credit racing a new request can never lose or double-count points. At most 64 entries wait; beyond that, new outcomes wait in a spill the account side never reads. Banked minerals will join the same entries in Phase 3.
2. **Account side.** After the Conquest write commits, the Worker runs one account (`eco/<pid>`) CAS transaction. For every entry above the watermark `eco.cqw`, it:
   - applies the league factor and spendable bonus;
   - credits through `ecoPlayAward`, which covers the cap, boards, airdrop credit and squad bonus exactly like an Arcade result;
   - adds the minerals to `eco.mn`;
   - raises the watermark.

   The credit and the watermark are written in the same atomic write, so a retry can never double-credit.
3. **Clean-up.** The Conquest record drops the entries at or below the watermark, using its own CAS loop that does not count against the pilot's request limit. If the account write fails (outage), the entries wait and are retried on the next request or session open. Nothing earned is lost.

   **When credit runs:** at once when an operation completes, otherwise when the oldest pending entry is 20 s old or 8 entries are pending, and always on session open. This batches world kills into fewer account writes.
4. **Late credit** counts on the day it is credited, like a late Arcade result.

---

## 4. Conquest materials: CP, Alloy, Biomass, Helium-3

Current values from the code: `worker/src/conquest-economy.js` and `js/conquest/combat.js`.

| Source | CP | Alloy | Biomass | Helium-3 |
|---|---:|---:|---:|---:|
| Patrol kill / garrison kill / heavy kill | 7 / 18 / 45 | 2 / 3 / 6 | 1 / 2 / 4 | 0 / 0 / 1 |
| Field mission, first clear | 100–250 | 24 | 16 | 6 |
| Field mission, daily replay / repeat (180 s apart) | 75 / 45 | 8 / 6 | 5 / 4 | 2 / 1 |
| Raid victory (25 raids; first, then ×0.7 daily, ×0.45 repeat CP) | 180–320 | 18–26 | 12–16 | 3–7 |
| Defense victory (base or sector) | 160 | 15 | 10 | 2 |
| Base production (now the Daily Base Yield) | min(800, 40·tier + 35·Reactor + 3·⌊√reputation⌋) × (1 + 0.1·Uplink) a day | see 3.2 | see 3.2 | see 3.2 |

| Sink | CP | Alloy | Biomass | Helium-3 |
|---|---:|---:|---:|---:|
| Engineering: 8 tracks × 6 ranks (each track 100 → 3,200 CP) | 57,200 | 2,248 | 1,368 | 200 |
| Command Base I–V | 27,750 | 1,450 | 900 | 122 |
| Modules: 6 × 3 levels | 8,580 | 522 | 324 | 60 |
| **Total ladder** | **93,530** | **4,220** | **2,592** | **382** |

**Changes in this session:**
- **Biomass (Phase 2, as built):** 24 bio-flora nodes in the terraformed zones (20 lush, 4 grassland) are now the main Biomass source. Kill and mission Biomass stay.
  - Stop within 6 m and hold GATHER for 4 s: +3 Biomass into cargo. It is banked like all cargo; on death, half of the carried cargo (rounded down) drops into the recoverable wreck, as before.
  - Each node regrows 15 min after a pilot harvests it (per pilot).
  - The channel alerts the nearest Parasite within 120 m every second. Moving, taking damage, releasing GATHER or starting an operation resets it.
  - Pace: about 2–2.5 harvests a minute of gathering (travel-bound), so 6–7.5 Biomass a minute against 2.5 a minute from a replayed field mission. The ladder total (2,592) is unchanged, and CP still binds the ladder, so Biomass does not shorten progression.
- **Alloy:** sources are unchanged until the base refinery exists.
- **Helium-3:** unchanged.
- **CP numbers:** unchanged. Only the base claim timing changes (3.2).
- **Conquest daily caps:** the old ones (`POLICY.daily`) are still unenforced, as since Session 1. The 50,000 cap governs points only.

**Known gap for the base-builder session.** A regular player finishes the whole CP ladder (all engineering, Base V, every module) in roughly 5–6 weeks. This is an estimate: the existing settlement model's CP rate (Base V and every module in 20 modeled hours) minus the time now spent gathering. The base-builder session must add CP and mineral sinks so CP keeps mattering after that:
- base levels beyond V;
- base armor and defenses built from minerals;
- refinery operations;
- a second builder.

---

## 5. Minerals

### 5.1 The six minerals

| # | Mineral | Rarity | Look (Neon Frontline) | Found | Plate trait |
|---|---|---|---|---|---|
| 1 | **Ferrite Regolith** | common | rust-brown magnetic clods with steel flecks | open ground within 40 m of routes, every sector | hull HP |
| 2 | **Ilmenite** | uncommon | black metallic crystals, faint blue sheen | basalt flows off the routes: Helium Basin, Western Salvage Reach, Ash approaches | hull HP |
| 3 | **Armalcolite** | rare | grey-blue fibrous titanium crystal, cyan seams | crater walls and Parasite territory: Ash Redoubt, Refuge Ridge, Oxygen Spear outer walls (HARD zones) | hull HP |
| 4 | **Tranquillityite** | very rare | red-orange crystal needles in dark rock | contested sites only: raid-site perimeters and hive edges (VETERAN zones) | hull HP |
| 5 | **Selenite Glass** | epic | reflective silver-violet impact glass | Meteor Strike craters; 3% vein in Tranquillityite | full set: −10% energy damage |
| 6 | **Moonheart** | legendary | obsidian-dense core with a deep blue-white glow | Meteor Strike cores; top competitive rewards | full set: −10% area damage, keeps Selenite's trait |

### 5.2 Veins in the populated war region (owner ore fix, Nov 8 2026: veins run dry, new ones appear)

Session 5 replaced the respawning deposits (Ferrite 20 min ... Tranquillityite 8 h), which let a player circle the same few spots all day. Ore now comes in **veins**:

- Each (mineral, sector) **field** has authored candidate spots and keeps a fixed number of **live veins**.
- A vein holds a fixed amount and is mined in a few **pulls** (one HOLD GATHER channel each; the server rolls the units, capped by what the vein still holds).
- At zero it is **EXHAUSTED for that pilot**. It never refills at that spot in minutes or hours.
- After the regrow delay a **new vein** of that mineral surfaces at another spot of the same field. The spot is chosen by a hash of the pilot's server-only seed, the slot, its generation and the UTC day. It stays hidden until a SCAN reaches it, so prospecting with SCAN is how you find ore.
- Clocks and spots are per pilot (no griefing). Code: `worker/src/conquest-veins.js`; rules: `MN_VEIN` and `MN_GATHER` in `js/rules.js`.

| Mineral | Candidate spots | Live veins | Vein holds | Units a pull | Pulls a vein | Channel | New vein after | Placement rule |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Ferrite Regolith | 36 | 7 (2 in the Refuge Corridor, 1 in each other sector) | 12 | 2–4 | ~4 | 5 s | 6 h | open ground near routes; safe enough for a new pilot |
| Ilmenite | 19 | 4 (Helium Basin, Western Salvage Reach, Ash approaches, Oxygen Spear) | 6 | 1–3 | ~3 | 8 s | 12 h | off-route basalt, often within patrol paths |
| Armalcolite | 10 | 3 (Refuge Ridge, Oxygen Spear, Ash Redoubt) | 5 | 1–2 | ~3 | 12 s | 2 days | crater walls and Parasite territory, inside or next to garrison zones |
| Tranquillityite | 6 | 3 (Oxygen Spear, Refuge Ridge, Ash Redoubt) | 3 | 1 (+3% Selenite vein a pull) | 3 | 16 s | 5 days | contested sites: raid-site perimeters, hive edges |
| Starter Vein | 1 (once) | — | 35 Ferrite | 35 | 1 | 5 s | never | beside the Refuge, revealed by the guided first scan |

Two spots were added so every field has at least two (Ilmenite at (1277,1014) in the Oxygen Spear, Tranquillityite at (1310,1210) on Refuge Ridge). Every spot passes the placement checks (clear of solids, water, forests, decks and bio-flora; reachable from the spawn; `conquest-minerals`).

**Supply cap.** One play session can empty each vein once, so a day's gathering is capped at about live veins × holds × min(sessions, 24 h ÷ regrow). Regular players stay time-bound (they never empty every vein), so their timelines in 7.2 are unchanged. Grinders hit the cap: a 6 h-a-day player in 3 sessions gets at most 252 Ferrite a day from veins.

**Migration of existing saves.** The Starter Vein keeps its once-ever flag. Each pilot gets 17 fresh full veins. A spot the pilot had already found (and that was ready) becomes one of their live veins, already on the MAP. Old respawn clocks are dropped. Nothing is granted or taken: cargo, banked minerals and the wallet are unchanged (`conquest-minerals`, migration checks).

**MAP and HUD.** Scanned veins show what they still hold (e.g. "Ferrite · 9/12"). A mined-out vein shows **EXHAUSTED** for 10 minutes, then disappears. The ticker says when a new vein will surface in the sector ("SCAN TO FIND IT"). The post-SCAN HUD route goes to the nearest scanned vein with ore left and clears when that vein runs dry. The client only ever receives scanned veins: never the seed, an unscanned vein or the next spot.

### 5.3 Gathering rules (Phase 3)

- **Scanner pulse:** a new HUD ability, free, with a 30 s cooldown.
  - It reveals this pilot's live veins within 150 m (+50 m per Radar module level), and the Starter Vein.
  - Scanned veins stay on the MAP with what they hold; exhausted ones show EXHAUSTED for 10 minutes, then disappear (5.2).
- **Gather:** stop within 6 m and hold GATHER for the channel time.
  - Damage interrupts the channel.
  - The channel makes noise: Parasites within 120 m move in to investigate. That is the exposure the owner asked for, so gathering creates fights.
- **Server-authoritative:**
  - the channel advances only in simulated time, while in range and alive;
  - each pull is capped by what the vein still holds, and an exhausted vein cannot be pulled again;
  - harvests count toward the per-hour outcome limit;
  - the client never sends an amount.
- **Carry and bank:** minerals go to cargo and bank like salvage, at the Refuge terminal or the base vault. Banking sends them through the outbox (3.5) to the account wallet, where the garage can use them in every mode.

### 5.4 Meteor Strike (world event)

- **Schedule:** every 2 hours on the even UTC hour. The schedule and site are the same for every pilot, so players can talk about it ("Meteor at 18:00 UTC, Helium Basin"). Each pilot fights in their own world, as all of Conquest does today.
- **Telegraph:** 5 minutes before impact: a sky streak, a HUD and MAP countdown and an alert. The impact lands at one of 8 authored crater sites, chosen deterministically from the time slot and rotating through the sectors, the dangerous ones included.
- **Contest:**
  - the site stays open for 20 minutes after impact;
  - Parasites converge in two waves: interceptors, then a heavy group (fixed authored HARD tier, never matched to the player's gear);
  - you secure the site by beating both waves and extracting the strike core (16 s channel).
- **Rewards** (carried, so you have to bring them home):

  | Reward | Amount |
  |---|---|
  | Points | 1,075 base × league × base multiplier |
  | CP | 120 |
  | Guaranteed minerals | 2 Ilmenite + 2 Armalcolite |
  | Chance | 50%: 1 Tranquillityite |
  | Core roll | **15%: 1 Selenite Glass**, **2.5%: 1 Moonheart** |

- **Odds and guarantees:**
  - the core odds are published in the wiki;
  - the roll is made by the server, once per pilot per slot, so reloading cannot re-roll;
  - **Strike Resonance** guarantees: every 12 secured strikes give 1 Selenite, and every 40 give 1 Moonheart, whatever the rolls.

### 5.5 Arcade and PvP drops

These apply to server-verified results only: AI-match tickets (`matchEnd`) and live rooms (`creditMatch`). Minerals go straight to the account wallet. Nothing is carried, so nothing can be lost.

| Result | Ferrite | Ilmenite | Armalcolite |
|---|---|---|---|
| Win | 1–2 (avg 1.5) | 20% for 1 | 6% for 1 |
| Draw, or Last Standing top 3 | 1 | 10% for 1 | — |
| Loss | 50% for 1 | — | — |
| Quit | — | — | — |

**Weekly league reward,** for 20+ verified Arcade or PvP matches that week. The competitive session finalizes these:

| League | Reward |
|---|---|
| Rookie | 20 Ferrite |
| Pilot | 30 Ferrite + 5 Ilmenite |
| Veteran | 40 Ferrite + 10 Ilmenite + 2 Armalcolite + 25% Tranquillityite |
| Ace | 12 Ilmenite + 4 Armalcolite + 25% Tranquillityite |
| Elite | 15 Ilmenite + 5 Armalcolite + 50% Tranquillityite |
| Master | 6 Armalcolite + 1 Tranquillityite |
| Lunar Legend | 8 Armalcolite + 2 Tranquillityite |

**Top competitive rewards (proposal for the competitive session):**
- weekly board top 100: 1 Selenite Glass;
- weekly top 10: 1 Moonheart;
- 30-day season top 3: 2 Moonheart.

### 5.6 Daily mineral income by player type (model)

Day 1 / day 10 / day 45. The rare zones open as gear improves (Appendix).

| Profile | Ferrite | Ilmenite | Armalcolite | Tranquillityite | Selenite | Moonheart |
|---|---:|---:|---:|---:|---:|---:|
| Regular, Conquest-focused (45 min/day) | 49 / 47 / 44 | 18 / 20 / 15 | 1.5 / 4.8 / 7.2 | 0.16 / 0.23 / 1.5 | 0.08 / 0.11 / 0.14 | 0.02 / 0.02 / 0.03 |
| Regular, mixed (30 Conquest + 15 Arcade) | 46 / 49 / 50 | 13 / 15 / 13 | 1.4 / 3.6 / 5.5 | 0.13 / 0.18 / 1.1 | 0.06 / 0.08 / 0.10 | 0.01 / 0.02 / 0.02 |
| Regular, Arcade/PvP only (45 min/day) | 33 / 34 / 36 | 3.5 / 4.2 / 4.9 | 0.96 / 0.96 / 1.2 | 0 / 0 / 0.04 | 0 | 0 |
| Dedicated, Conquest-focused (150 min/day) | 169 / 137 / 114 | 60 / 64 / 44 | 4.5 / 15 / 23 | 0.43 / 0.60 / 4.9 | 0.20 / 0.28 / 0.37 | 0.04 / 0.06 / 0.07 |

---

## 6. Hull Plating (armor)

### 6.1 Slots, tiers and strength

There are four plate slots on every hull: **FRONT** (glacis), **LEFT** and **RIGHT** (side skirts) and **TURRET** (turret cheeks).
- Each slot holds one plate of any tier.
- Plate HP adds up across slots.
- A **set trait** needs all four plates at that tier or better.
- Plates sit on top of whichever chassis the pilot drives (Scout, Vanguard, Titan, every rarity). Chassis stats, silhouettes, hitboxes, sockets and muzzles stay exactly as they are.

| Tier | Mineral | Max hull HP per plate | Full set | Set trait | Look on the hull |
|---|---|---:|---:|---|---|
| 1 | Ferrite Regolith | +1.0% | +4% | — | matte rust-brown bolted slabs |
| 2 | Ilmenite | +1.75% | +7% | — | black faceted plates, faint blue sheen |
| 3 | Armalcolite | +2.5% | +10% | — | grey-blue fibrous panels, cyan seam lights |
| 4 | Tranquillityite | +3.0% | +12% | — | dark plates with red-orange crystal inlays |
| 5 | Selenite Glass | +3.5% | +14% | −10% energy damage taken | reflective silver-violet glass with a moving sheen |
| 6 | Moonheart | +4.0% | +16% | −10% energy and −10% area damage | obsidian plates with a pulsing blue-white core |

**Visuals:**
- On HIGH, Selenite uses a cheap fresnel/matcap sheen and Moonheart an emissive pulse.
- LOW uses a static highlight and a static glow.
- The 2D fallback shows a tier-colored plate outline and a glow ring.
- Plate meshes stay inside the hull silhouette budget and are added to the existing instanced/merged hull draws (no new draw calls per plate on LOW).

**Damage types for the set traits:**
- **Energy:**
  - Pulse Cannon shots and Pierce Lance;
  - Static Nova;
  - Conquest's Parasite fire coordinator, plasma batteries and plasma bombardment;
  - **Not** Moonbeam or Moonfall: they are exempt (owner decision). The lore: Moonbeam's lunar laser passes clean through Selenite.
- **Area:**
  - Static Nova and Siege Blast;
  - meteors;
  - Survival boss stomps and shells;
  - Conquest artillery, orbital strikes and plasma splash.

### 6.2 Fabrication

Plates are fabricated in the **garage**. The same server action is also reachable from Refuge Supply in Conquest. Fabrication is instant and uses the account wallet. Upgrading a slot absorbs the plate already in it (no refund). Plates are permanent: they are never lost on death and cannot be traded.

| Plate | Minerals | Points fee | Whole set (4 plates) |
|---|---|---:|---|
| Ferrite Regolith | 40 Ferrite | 300 | 160 Ferrite, 1,200 pts |
| Ilmenite | 40 Ilmenite + 20 Ferrite | 1,500 | 160 Ilmenite + 80 Ferrite, 6,000 pts |
| Armalcolite | 30 Armalcolite + 20 Ilmenite | 4,000 | 120 Armalcolite + 80 Ilmenite, 16,000 pts |
| Tranquillityite | 20 Tranquillityite + 15 Armalcolite | 8,000 | 80 Tranquillityite + 60 Armalcolite, 32,000 pts |
| Selenite Glass | 6 Selenite + 10 Tranquillityite | 15,000 | 24 Selenite + 40 Tranquillityite, 60,000 pts |
| Moonheart | 3 Moonheart + 4 Selenite | 25,000 | 12 Moonheart + 16 Selenite, 100,000 pts |

The lower-tier mineral in each recipe keeps commons useful for the whole ladder. The points fee is a modest points sink: about 215,000 points over the full ladder.

### 6.3 Strength compared with existing gear

Measured with the real power fit (`powerOf`). The traits are valued as effective HP, an estimate. Live win chance uses the human-pilot fit (`POWER_K_LIVE`).

| Full set | Max HP | Gear rating gain, stock kit | Gear rating gain, top kit | Win chance vs the same tank without it |
|---|---:|---:|---:|---:|
| Ferrite Regolith | +4% | +1.5% | +2.1% | 51.6% |
| Ilmenite | +7% | +2.9% | +3.8% | 52.9% |
| Armalcolite | +10% | +4.4% | +5.5% | 54.2% |
| Tranquillityite | +12% | +5.9% | +6.8% | 55.1% |
| Selenite Glass | +14%, −10% energy | +8.8% | +10.2% | 57.5% |
| Moonheart | +16%, −10% energy and area | +10.3% | +12.3% | 58.9% |
| *Reference: Lunar Skin* | +8% HP and damage | | +8.3% | 56.1% |
| *Reference: Moonbeam vs Epic Pulse* | | | +14.6% | 60.4% |

The armor ladder runs from a small first step to a long-term goal. At the top it sits between Lunar Skin and Moonbeam; the owner kept this strength.

### 6.4 Rules

- **Full strength everywhere.** Plates add max hull HP (and the traits) in Conquest, Arcade and PvP alike, with no mode-specific scaling.
- **Gear rating and league:**
  - plates are part of the canonical loadout (`ecoLoadout`/`labLoadout` → `tankOf` → `powerOf`);
  - fitting a plate updates gear rating, then league (`setLoadout` → `ecoLeague`);
  - matchmaking and the league AI step follow, as for any other gear.
- **PvP loadout checks:** the PvP server already rebuilds every loadout from the owned server record (`checkLoadout` → `ecoLoadout`). Plates come only from `eco.ap`; a client cannot claim them.
- **AI pilots** never get plating. AI never copies a player's gear, and its strength curve already follows your power.
- **Conquest** reads the same canonical loadout. It applies the HP and the traits through the existing loadout refit.

---

## 7. Timelines

### 7.1 Player profiles used

| Profile | Daily play | Notes |
|---|---|---|
| Regular, Conquest-focused | 45 min Conquest | Command Base I/II/III/IV/V on days 2/4/7/12/20 |
| Regular, mixed | 30 min Conquest + 15 min Arcade | slower base |
| Regular, Arcade/PvP only | 45 min Arcade/PvP | about 26 matches a day, 62% wins; league over time Rookie → Pilot (wk 2) → Veteran (wk 4) → Ace (wk 9) |
| Dedicated, Conquest-focused | 150 min Conquest | Command Base V by day 6 |

### 7.2 Time to each full armor set (first plate of that tier in brackets)

| Profile | Ferrite | Ilmenite | Armalcolite | Tranquillityite | Selenite Glass | Moonheart |
|---|---:|---:|---:|---:|---:|---:|
| **Regular, Conquest-focused** | **3 d** (1 d) | **10 d** (3 d) | **4.3 wk** (11 d) | **2.6 mo** (5.4 wk) | 6.0 mo (2.8 mo) | 15.5 mo (6.9 mo) |
| Regular, mixed | 3 d (1 d) | 12 d (4 d) | 5.0 wk (2.0 wk) | 3.3 mo (6.3 wk) | 7.8 mo (3.6 mo) | 20 mo (9.1 mo) |
| **Regular, Arcade/PvP only** | **5 d** (2 d) | **5.3 wk** (11 d) | **3.1 mo** (6.0 wk) | 2.5+ yr (19 mo) | needs Conquest or top competitive rewards | needs Conquest or top competitive rewards |
| Dedicated, Conquest-focused (2 sessions) | 1 d (1 d) | 3 d (1 d) | 13 d (6 d) | 6.3 wk (3.3 wk) | 2.4 mo (6.6 wk) | 6.0 mo (2.7 mo) |
| Grinder, 6 h a day in 3 sessions (vein cap check, Session 5) | 1 d (1 d) | 2 d (1 d) | 8 d (4 d) | 4.7 wk (2.3 wk) | 5.6 wk (4.9 wk) | 2.8 mo (6.0 wk) |

Session 5 note: the table is regenerated with the vein rules (5.2) and without Base Yield minerals, which the Session 4 model had assumed but were never approved or built. That moves the regular Ilmenite set from 9 to 10 days; every owner target still holds (`dev/tests/conquest-vein-economy.mjs`).

The Arcade-only rare set takes about 3 months (owner target). Against the owner's targets, the regular Conquest-focused player hits every one: common 3–4 days, uncommon 1–2 weeks, rare about 1 month, very rare 2–3 months. Epic is about 6 months and legendary over a year (long-term). Dedicated players are 2–3× faster. The veins (5.2) and the strike schedule keep them from being 10× faster: even a 6 h-a-day grinder stays under 6× the regular pace on every tier (`dev/tests/conquest-vein-economy.mjs`, Session 5).

### 7.3 First hour (new pilot, stock kit, Rookie, ordinary pace)

| Minute | What happens | Points | CP | Ferrite | Plates |
|---:|---|---:|---:|---:|---:|
| 2 | Arrive at the Refuge. The war is visible; first patrol skirmish (2 interceptors) | 70 | 14 | 0 | 0 |
| 4 | Hold the Oxygen Line (first field mission) | 520 | 264 | 3 | 0 |
| 5 | Bank salvage at the Refuge terminal | 520 | 264 | 3 | 0 |
| 9 | Guided: scanner pulse, the Starter Vein and a roadside deposit; a patrol answers the noise | 755 | 264 | 41 | 0 |
| 11 | Intercept the Parasite Convoy | 1,205 | 404 | 44 | 0 |
| **12** | **Bank, then fabricate the FRONT Ferrite plate (40 Ferrite + 300 points). It appears on the hull; gear rating rises** | 905 | 404 | 4 | **1** |
| 14–21 | Sabotage the Relay, Signal Recovery, Rescue, Break the Redoubt (six field missions: raids unlock) | 2,895 | 1,004 | 19 | 1 |
| 23 | Engineering rank 1 ×2 at Refuge Supply | 2,895 | 804 | 19 | 1 |
| 37 | Four HARD raids (3 won, 1 lost) + world kills between them | 5,985 | 1,524 | 19 | 1 |
| 42 | Two Ferrite deposits and an Ilmenite deposit; bank | 6,325 | 1,524 | 25 | 1 |
| 50 | Two more HARD raids (both won) + replays of two field missions | 9,025 | 2,114 | 31 | 1 |
| 53 | Back at the build site: the Command Base I goal shows the exact remaining cost | 9,025 | 2,114 | 31 | 1 |

- **First plate at minute 12** (target: within about 20).
- **Command Base I at about minute 59** (modeled; CP binds). That is now inside the brief's 45–75 minute target, because gathering and the first plate take part of the first hour. Raid rewards are unchanged.
- **Arcade-first pilots** see "Your first armor plate is minutes away in Conquest" after their early matches. Their own Arcade drops reach the first plate on day 2.

### 7.4 Long-term ladder (regular Conquest-focused player)

| When | Tank | Command Base | Also | Next goal on screen |
|---|---|---|---|---|
| Hour 1 | first plate; engineering ranks | Base I (~min 59) | six field missions; raids unlock | "Base I: x/2,550 CP" |
| Day 1–3 | Ferrite set complete (+4% HP) | Base I → II | daily strikes; first raid blueprint shards | first Ilmenite plate |
| Week 1–2 | Ilmenite set (+7%) | Base III–IV (×1.15–1.20) | Pilot league; sector captures | first Armalcolite plate |
| Month 1 | Armalcolite set (+10%) | Base V (×1.25); modules | Veteran/Ace league; VETERAN raids open up | first Tranquillityite plate |
| Months 2–3 | Tranquillityite set (+12%) | base-builder content: levels beyond V, base armor from minerals, refinery | 25-raid blueprint | first Selenite plate (~2.8 mo) |
| Months 3–6 | Selenite plates one by one | base defenses (Selenite domes etc., base-builder) | strike resonance | Selenite set: energy trait |
| Months 6–15 | Moonheart plates (~every 2–3 months) | top base levels | competitive top rewards | Moonheart set |

Every column keeps moving. In month 1 there is a new milestone every 1–3 days. After month 3 there is a new plate every 3–6 weeks, plus the base-builder and competitive ladders.

---

## 8. Sinks and balance health

- **Points sinks:**
  - existing crates, upgrades, tune-ups and respecs;
  - **new:** plate fees (about 215,000 over the full ladder);
  - **new:** Ferrite for points (9.1).
- **Mineral sinks:**
  - plates, with the lower-tier input keeping commons useful;
  - later, the refinery (Ferrite/Ilmenite → Alloy) and base armor and defenses (base-builder).
- **CP sinks:** see the known gap in section 4. Extending them is the base-builder session's first job.
- **Inflation guards:**
  - the one shared 50,000 cap;
  - Conquest points use the same league factors as Arcade;
  - the per-hour Conquest outcome limit;
  - the yield stops at 24 h.
- **What Phase 1 reviews:** combined points a minute per league against the table in 3.3, using scripted-pilot timings. Mineral income gets the same check in Phase 3.

---

## 9. Store rules and revenue levers

Checkout stays **DISABLED** for every item below until payments are certified (`ConquestCatalog.checkout.enabled=false`; PR #21 is not certified).

### 9.1 Minerals in the store (owner-approved; illustrative prices only; checkout off)

- **Sellable:** Ferrite Regolith and Ilmenite only, in **fixed bundles** with nothing random:
  - Ferrite Crate: 150 Ferrite, about $1.99;
  - Ilmenite Crate: 60 Ilmenite + 30 Ferrite, about $4.99.

  These prices are illustrative and are not live pricing.
- **Limits:** at most 2 Ferrite Crates a day, and at most 1 Ilmenite Crate a day (4 a week). The earn path always stays the main path.
- **Points shop:** 10 Ferrite for 1,500 earned points, up to 30 Ferrite a day. This is a points sink, and it is earned.
- **Earn-only:** Armalcolite, Tranquillityite, Selenite Glass and Moonheart are never sold. They never appear in paid bundles or in the premium Lunar Pass track, and they cannot be traded or gifted.

### 9.2 Other planned revenue levers

**Guardrail (owner wording, 2026-11-08):** paid features never grant airdrop points or rare+ minerals directly. Indirect gains through power or base level are allowed, the same as Moonbeam today. Examples: a faster base through speed-ups or a second builder, or gear that raises league. Raid shields only once PvP base raids exist.

| Lever | Where it fits | What it does | Indirect effect (allowed) | Guardrail |
|---|---|---|---|---|
| Mineral crates (§9.1) | garage store | saves time on plating tiers 1–2 (at most +7% HP) | plating raises gear rating, then league and the league airdrop factor | only Ferrite and Ilmenite; daily and weekly limits; the stronger league also meets a harder AI |
| Second builder | base-builder session | two base constructions at once | a faster base reaches the Conquest points multiplier and the yield sooner | never grants points or rare+ minerals itself; an earnable second builder exists too |
| Speed-ups | base-builder session | finish a running construction timer now, at a fixed shown price, with the earn time beside it | same as the second builder | construction timers only: never deposit respawns, strike timers or anything that pays points itself |
| Base cosmetics | exists (`js/conquest/catalog.js`: 5 architecture collections, $7.99–$29.99 proposals, preview only) | looks only | none | must keep hitboxes and readability |
| Plate finishes (cosmetic) | tank session | premium looks for plates (trim, glow colors) | none | looks only; the tier stays readable |
| Raid shields | competitive / PvP base-raid session | protection from player raids for a while | protection in a steal system | only once PvP base raids exist (`base.pvpAvailable=false` today); free shields after being raided; earnable shields; never against PvE alerts |
| Lunar Pass perks | existing pass (13 TON / 799 Stars) | already halves RECALL; could add scanner range and plate finishes | none | the existing rule holds: the premium track never gives points; never rare+ minerals |

---

## 10. Implementation contract (Phases 1–3)

**Constants.** All of them live in `js/rules.js`, shared by the phone and the Worker build. Values come from this document: the cap, the Conquest values, danger factors, base multipliers, yield, mineral ids, deposits, strike, Arcade drops and plating. `dev/tools/economy-model.mjs` then reads them from there instead of its own copy.

**Phase 1 as built (branch `claude/friendly-allen-7tcyca`):**
- Constants live in `js/rules.js`: `DAILY_CAP` (50,000), `CQ_PTS`, `CQ_BASE_MULT`, `CQ_YIELD`. `worker/src/db.js` mirrors the cap.
- `worker/src/conquest-airdrop.js` is the Conquest side: `earn`, held operation kills (`opKill` / `settleOpKills` / `discardOpKills`), `seal`, `due`, `acknowledge`, `played`.
- Hooks: world kills and mission/raid wins in `conquest-economy.js`; defenses and the Daily Base Yield in `conquest-campaign.js`; failure paths and play time in `conquest-sim.js`.
- `worker/src/conquest.js` seals each request, credits, prunes, and fills the HUD numbers from the account on session open.
- `worker/src/eco.js` `creditConquest()` is the account side; `watchConquest()` raises the flags.
- The Daily Base Yield keeps the action name `base-claim`, so clients mid-update keep working. The shared fill math is `ConquestCombat.baseYield()`.
- UI:
  - the HUD status line shows "AIRDROP TODAY n / 50,000 · +n PENDING";
  - a ticker on each credit;
  - an AIRDROP PTS tile in the after-action report;
  - the yield meter on the base terminal, the MAP base card, the HUD base line, an in-world ring of ten orbs over the base, and a 2D fallback label.
- Tests:
  - `dev/tests/conquest-airdrop.mjs` (sim, 30 checks);
  - `dev/tests/wtest/conquest-airdrop.mjs` (Worker + fake Firebase, 20 checks);
  - `dev/tests/conquest-airdrop-browser.py` (Chromium 390 journey).

  All three run in CI.

**Phase 2 as built (terraform rework; same branch):**
- `js/conquest/world.js`: authored terraform zones (`terraformAt`, `terraZone`, `blightAt`, `TERRA`), atmosphere `pylons`, `blightSources`, the water system (`water`, `waterAt`, `waterTopAt`, `creekBridge`), `forests` / `forestAt` / `FOREST_CANOPY`, `floraNodes` and `HARVEST`. The zone map and its reasoning are in `docs/conquest/IMPLEMENTATION_CHECKPOINT.md` (Checkpoint 22, Phase 2).
- `CQ_PTS.gather.flora` (80) in `js/rules.js`; `harvestStep` in `worker/src/conquest-sim.js` (server-replayed, in the 50 ms step loop). A harvest is `earn('gather', 80, {act:true})`: it counts toward the day's verified activity for the Daily Base Yield points part, not as a referral play day (only operations do that).
- The bio-flora points go through the Phase 1 outbox and the 120-outcomes-an-hour limit like every other outcome.
- Tests: `dev/tests/conquest-terraform.mjs` (32 checks: zones, water, crossings, forests, reachability, harvest) and the flora budgets in `dev/tests/conquest-style.mjs`; `dev/tests/conquest-terraform-captures.py` runs a real 390 GATHER journey in the browser. All run in CI.
- Record: `conquest/<pid>`: `harvest` {nodeId: regrowsAt} and `channel` {node, ms} (additive; Phase 2).

**Phase 3 as built (minerals, deposits, Meteor Strike, Hull Plating; same branch):**
- **Shared constants** (`js/rules.js`): `MINERALS`, `MN_ORDER`, `PLATE` (HP per plate, costs, traits, the shares used to value traits), `MN_DROP`, `MN_WEEKLY`, `MN_GATHER`, `MN_SCAN`, `MN_CACHE`, `STRIKE`.
  - Helpers: `plateStats`, `ecoPlate`, `ecoMinerals`, `ecoMatchMinerals`.
  - The authored deposit and strike-site coordinates are world data, in `js/conquest/world.js` (`deposits`) and `js/conquest/combat.js` (`strikeSites`, `meteorStrike()`).
- **Plates in the loadout:** `ecoLoadout` adds `ap` from the owned record only. `tankOf` applies the HP and the trait flags. `powerZ` values the traits as effective HP, which reproduces the §6.3 stock column exactly (+1.5 / 2.9 / 4.4 / 5.9 / 8.8 / 10.3%).
- **Trait hooks:**
  - shared Arcade/PvP `takeHit` (`plateCut`);
  - Conquest projectile and hazard damage (`plateTaken`).
- **Account actions:**
  - fabrication is `/api/act {a:'plate', k: slot, t: tier}`;
  - drops run in `ecoMatchPts` (AI tickets) and `creditMatch` (live rooms);
  - banked Conquest minerals ride the Phase 1 outbox (`entry.mn`) and are credited by `creditConquest` with the same watermark.
- **Conquest:**
  - `scanStep`, a generalized `harvestStep` (flora and discovered deposits) and `cacheMinerals` (operation victories, per the model's `opMinerals`);
  - the `strike` operation family with `strikeReward`;
  - deposits, cargo, the scanner and the strike on the HUD, MAP, 3D and 2D fallback;
  - Hull Plating at Refuge Supply.
- **Where the build differs from, or decides beyond, the written spec (all within the approved numbers):**
  - **Death exposure:** "50% of carried" works as it does for materials. Half of each carried mineral, rounded down, drops into the personal wreck, which can be recovered for 10 minutes; otherwise it is lost.
  - **Weekly league minerals:** granted automatically at the 20th verified Arcade/PvP match of the UTC week, at that match's league; no claim screen. The competitive session may still finalize the table.
  - **Base Yield minerals** (listed as a source in §2) are not built: no amounts were approved.
  - **Strike core roll:** made with the server's crypto random at the pilot's first start in that slot and stored, so retries and reloads cannot re-roll it. A strike never captures territory and never counts toward field-mission progress.
  - **Plate looks:** HIGH uses the shine material and glowing seams; LOW uses a single bucket with no seams. The animated Selenite sheen and Moonheart pulse are static for now.
  - **Mineral store (§9.1):** not built. Checkout stays off.
- **Records:**
  - `eco/<pid>`: `mn`, `ap`, and `mnw` {w, n, p} (weekly league minerals).
  - `conquest/<pid>`:
    - `ledger.mn` (carried minerals), `found` (discovered deposits), `deposits` (respawn clocks; the Starter Vein is 1 once gathered), `scanAt`;
    - `strikes` {slot: {roll, claimed}}, `strikeSlot`, `resonance`.
- **Tests (all in CI):**
  - `dev/tests/wtest/hull-plating.mjs` (24 checks);
  - `dev/tests/conquest-minerals.mjs` (41);
  - mineral and plate budgets in `conquest-style.mjs`;
  - the 390 browser journey `dev/tests/conquest-minerals-browser.py`: scan, Starter Vein, gather, bank, first plate on the hull, strike telegraph.

**Records (additive; old records get defaults; nothing is reset):**
- `eco/<pid>`:
  - `cqw`: Conquest credit watermark (Phase 1);
  - `cqd` {d, b, ms, n}: today's credited Conquest base points, simulated play ms and entries (Phase 1; flags);
  - `mn` {fe, il, ar, tq, se, mh}: mineral wallet (Phase 3);
  - `ap` [FRONT, LEFT, RIGHT, TURRET]: plate tiers 0–6 (Phase 3).
- `conquest/<pid>`:
  - `airdrop` {seq, ack, out: [{id, at, raw, n, op, ms}], hr, ms, act, opk, spill, view, limited}: the outbox and its bookkeeping (Phase 1);
  - `base.pointsAt`: the yield's points clock, next to the existing `base.claimedAt` (Phase 1);
  - `minerals` cargo, `deposits` {id: generation}, `strikes` {slot: claimed}, `resonance` (Phase 3).

**Credit:** the outbox in 3.5; every point goes through `ecoPlayAward`. A day with a credited verified Conquest operation also counts as a verified play day (`ecoPlayDay`: `vd`/`vdl`), so it counts as an active day for referral verification (owner decision 6). Referral bonuses themselves are unchanged.

**Tests:**
- exactly-once credit under retry, concurrent tabs and account-write failure;
- the cap shared across modes;
- yield fill, partial collect, the 24 h stop, and the activity requirement for points;
- the per-hour outcome limit;
- the anomaly flags;
- migration of v1 fixtures;
- plating in `powerOf`, league and PvP `checkLoadout`;
- traits by damage type;
- 50% rounded-down mineral loss on death;
- the strike roll is keyed to its slot (a reload cannot re-roll).

**Copy updates:**
- **Wiki:** Economy (50,000 cap; Conquest earns airdrop points; Command Base multiplier; Daily Base Yield), Leagues ("The daily cap is 50,000 base points in every league"), new Minerals and Hull Plating sections with published odds.
- **In-game Conquest briefing:** replace "CP is separate from Arcade and airdrop points." with: "CP builds your Command Base and engineering. Every verified operation also earns airdrop points (× your league and your Command Base)."
- **Results and after-action screens** show "+N airdrop points".
- **Terms:** they have no Conquest or cap wording today; check them and update if needed.

---

## 11. What later sessions own

- **Base-builder:**
  - the refinery (Ferrite/Ilmenite → Alloy; then retire the extra Alloy sources);
  - base armor and defenses from minerals (walls, turrets, Selenite domes, Moonheart core);
  - base levels beyond V, with the multiplier re-spread so the top stays at about ×1.25;
  - the second builder and speed-ups, under the 9.2 guardrails;
  - new CP sinks (the gap in section 4).
- **Tank:** plate finishes (cosmetic) and chassis-specific plate meshes. The HP table in 6.1 is fixed unless the owner re-approves it.
- **Competitive:** final weekly and season league rewards (5.5) including the Selenite and Moonheart top rewards; async player raids and raid shields; any change to league lines.

---

## 12. Owner decisions (signed off 2026-11-08)

| # | Question | Owner decision |
|---|---|---|
| 1 | Daily Base Yield points inside or outside the cap | **inside** the 50,000 cap |
| 2 | Selenite's energy reduction vs Moonbeam | **Moonbeam and Moonfall exempt** |
| 3 | Top armor strength | **keep** Moonheart at about +12% gear rating |
| 4 | Mineral store | **approved** as proposed (§9.1); checkout stays off |
| 5 | Guardrails for paid features | **no direct** airdrop points or rare+ minerals; indirect gains through power or base level are allowed (§9.2); raid shields only once PvP base raids exist |
| 6 | Conquest operation day as a referral active day | **yes** |
| 7 | Arcade-only pace | rare set in about **3 months**; very rare and above stay Conquest/competitive |
| — | The lead's defaults | **approved**: Conquest points spendable with the league bonus; base multiplier ×1.05…×1.25; Meteor Strike every 2 h; raid and first-base rewards unchanged |

---

## 13. Command Base plot (Session 5, owner-approved scope)

Code: shared rules `js/conquest/plot.js` (ConquestPlot), Worker actions `worker/src/conquest-plot.js`, phone view `js/conquest/plotview.js`. Every build, upgrade, move, wall, collect, site change and drill is a Worker action validated on the Worker clock; the phone never grants anything. Tests: `conquest-plot.mjs`, `conquest-base-progression.mjs`, `conquest-base-builder.py`.

**Airdrop rules are unchanged:** Command Base multiplier ×1.05…×1.25 by tier, the Daily Base Yield, the 50,000 shared daily cap, points never purchasable, rare+ minerals never sold. The plot's tier (I…V) comes from the Command Center level, and the cumulative cost to CC3/5/7/9 equals the old Base II/III/IV/V costs, so the multiplier arrives exactly as before (modeled: tier V on day 20.75 for the regular player; Session 4 had day 20).

### 13.1 The plot and sites
- A private 180 × 180 m plot (a 45 × 45 grid of 4 m cells) entered from the Command Gate at (1080, 1160), or by RECALL / fast travel to the base. The world waits while you are inside. Banking, repair and collection work there.
- Four sites, picked at first build. Migrated bases start on RIDGE. The first site change is free; later changes cost 150 alloy with a 24 h cooldown (buildings are re-seated; walls on newly blocked ground are removed and their minerals return to the base stores).

| Site | Effect | Approach lanes |
|---|---|---|
| CRATER RIM | +15% Refinery alloy; two rim deposits give 3 Ferrite a day (to the wallet, collected at the base) | 4 wide |
| RIVER DELTA | +15% Biodome biomass; water and lush ground | 4 wide |
| RIDGE | +10% turret range | 3 wide |
| CANYON | hard to raid | 2 narrow |

### 13.2 Command Center and buildings
One builder: one construction at a time. A second builder and speed-ups are store items, shown as unavailable until payments are certified. Building levels unlock with the Command Center (level ≤ ⌈CC ÷ 2⌉). Each level costs the previous × 2.4.

| Building | Unlocks | Footprint (cells) | Levels | Power draw | Level I cost | Level V (or III) cost | Timers I…max |
|---|---|---|---:|---:|---|---|---|
| Refinery | CC1 | 3×4 | 5 | 2 a level | 60 CP + 4 alloy + 2 biomass | 1991 CP + 133 alloy + 66 biomass | 15 s / 3 min / 20 min / 2 h / 6 h |
| Storage Depot | CC1 | 3×3 | 5 | 1 a level | 90 CP + 8 alloy | 2986 CP + 265 alloy | 15 s / 3 min / 20 min / 2 h / 6 h |
| Reactor | CC1 | 3×3 | 5 | 0 a level | 140 CP + 8 alloy + 1 He-3 | 4645 CP + 265 alloy + 33 He-3 | 15 s / 3 min / 20 min / 2 h / 6 h |
| Biodome | CC2 | 3×3 | 5 | 2 a level | 150 CP + 8 alloy + 8 biomass | 4977 CP + 265 alloy + 265 biomass | 15 s / 3 min / 20 min / 2 h / 6 h |
| Hangar | CC2 | 4×3 | 5 | 1 a level | 180 CP + 12 alloy | 5972 CP + 398 alloy | 15 s / 3 min / 20 min / 2 h / 6 h |
| Helium Extractor | CC3 | 2×2 | 5 | 2 a level | 200 CP + 10 alloy + 5 biomass | 6636 CP + 332 alloy + 166 biomass | 15 s / 3 min / 20 min / 2 h / 6 h |
| Radar | CC3 | 2×2 | 5 | 2 a level | 200 CP + 10 alloy + 2 He-3 | 6636 CP + 332 alloy + 66 He-3 | 15 s / 3 min / 20 min / 2 h / 6 h |
| Shield Generator | CC3 | 2×2 | 5 | 3 a level | 240 CP + 14 alloy + 2 He-3 | 7963 CP + 464 alloy + 66 He-3 | 15 s / 3 min / 20 min / 2 h / 6 h |
| Science Lab | CC3 | 3×3 | 3 | 2 a level | 320 CP + 18 alloy + 8 biomass + 3 He-3 | 1843 CP + 104 alloy + 46 biomass + 17 He-3 | 30 s / 10 min / 1 h |
| Uplink | CC4 | 2×2 | 5 | 2 a level | 260 CP + 14 alloy + 3 He-3 | 8626 CP + 464 alloy + 100 He-3 | 15 s / 3 min / 20 min / 2 h / 6 h |
| Trophy Hall | CC5 | 3×3 | 3 | 1 a level | 300 CP + 16 alloy | 1728 CP + 92 alloy | 30 s / 10 min / 1 h |
| Cannon Turret | CC1 | 1×1 | 5 | 1 a level | 70 CP + 5 alloy | 2322 CP + 166 alloy | 15 s / 3 min / 20 min / 2 h / 6 h |
| Laser Turret | CC2 | 1×1 | 5 | 1 a level | 110 CP + 6 alloy + 1 He-3 | 3650 CP + 199 alloy + 33 He-3 | 15 s / 3 min / 20 min / 2 h / 6 h |
| Missile Turret | CC4 | 1×1 | 5 | 1 a level | 160 CP + 8 alloy + 2 He-3 | 5308 CP + 265 alloy + 66 He-3 | 15 s / 3 min / 20 min / 2 h / 6 h |
| Mortar | CC5 | 1×1 | 5 | 1 a level | 190 CP + 10 alloy + 2 He-3 | 6304 CP + 332 alloy + 66 He-3 | 15 s / 3 min / 20 min / 2 h / 6 h |
| Gate | CC4 | 1×1 | 1 | 0 a level | 60 CP + 4 alloy | 60 CP + 4 alloy | 10 s |

| Command Center | Cost | Timer | Tier (points multiplier) |
|---|---|---|---|
| CC1 (claim the plot) | 2550 CP + 110 alloy + 65 biomass + 8 He-3 | instant | I (×1.05) |
| CC2 | 1800 CP + 50 alloy + 30 biomass + 4 He-3 | 30 s | I (×1.05) |
| CC3 | 2700 CP + 110 alloy + 65 biomass + 8 He-3 | 3 min | II (×1.10) |
| CC4 | 1700 CP + 100 alloy + 60 biomass + 8 He-3 | 10 min | II (×1.10) |
| CC5 | 2500 CP + 150 alloy + 90 biomass + 12 He-3 | 30 min | III (×1.15) |
| CC6 | 2600 CP + 150 alloy + 95 biomass + 12 He-3 | 1 h | III (×1.15) |
| CC7 | 3900 CP + 230 alloy + 145 biomass + 20 He-3 | 2 h | IV (×1.20) |
| CC8 | 4000 CP + 220 alloy + 140 biomass + 20 He-3 | 3 h | IV (×1.20) |
| CC9 | 6000 CP + 330 alloy + 210 biomass + 30 He-3 | 5 h | V (×1.25) |
| CC10 | 9000 CP + 500 alloy + 320 biomass + 45 He-3 + 30 Ilmenite + 6 Armalcolite | 8 h | V (×1.25) |

### 13.3 Production, storage, power
- Production per level an hour: Refinery 0.8 alloy, Biodome 0.6 biomass, Helium Extractor 0.15 He-3 (site bonuses on top). It accrues on the Worker clock into the plot store and stops at the Storage Depot cap: alloy and biomass 30 + 40 × Depot level, He-3 8 + 10 × Depot level (Ferrite rim deposits 30). Collect inside the plot: whole units go to banked materials (Ferrite to the wallet through the outbox).
- Power: supply 12 + 3 × CC + 14 a Reactor level. Draw per level: Refinery, Biodome, Helium Extractor, Radar, Uplink, Science Lab 2; Storage Depot, Hangar, Trophy Hall, turrets 1; Shield Generator 3. A build over the budget is refused. A full CC10 base cannot max every building and turret at once (a real trade-off).
- Old modules map onto buildings (Reactor, Hangar, Shield Generator = defense, Storage Depot = vault, Radar, Uplink), capped at III for the old formulas, so CP production, field repair, the protective field, base banking, scan range and radar contacts work exactly as before.

### 13.4 Walls, turrets and the Defense Drill

> **Superseded by §14 (Session 5B Town Defense):** the five wall tiers, the 24 + 16 × CC wall cap, the four turrets and the lane-only drill below are replaced by wall composite + ore blends, 600–2,000 cells + extensions, eleven turrets and the whole-town raid. Kept here as history.

- Walls: drag-to-draw straight sections (up to 40 per drag; 24 + 16 × CC sections in all). Tiers: Regolith (CC1, 400 HP, 5 CP + 2 Ferrite), Titanium (CC2, 900 HP, 2 alloy + 1 Ilmenite), Armalcolite (CC5, 1,600 HP, 3 alloy + 1 Armalcolite), Selenite glass (CC7, 2,400 HP, 4 alloy + 1 Selenite), Moonheart (CC9, 3,500 HP, 5 alloy + 1 Moonheart). Gates: 2 at CC4, 4 at CC8.
- **Base stores:** wall and CC10 minerals come from the base stores. "Move to base stores" moves minerals from the account wallet, one way and permanent (eco action `bstore`; the eco total `bmn` only grows and the plot counts what it has spent, so a stale read can refuse a build but never overspend). This is the mineral sink the Session 4 spec asked for.
- Turrets (limit 2/4/5/6/8/9/10/12/14/16 by CC): Cannon (CC1, 28 m, 34 dmg every 1.1 s), Laser (CC2, 24 m, 9 dmg every 0.25 s), Missile (CC4, 36 m, 55 dmg + 3 m splash every 2 s, hits drones first), Mortar (CC5, 10–44 m, 46 dmg + 6 m splash every 3 s). +25% damage and +4% range a level.
- **Defense Drill:** a deterministic simulated Parasite attack (three waves scaled by CC: raiders, sentinels, drones) entering by the site's lanes, following a flow field to the Command Center and breaching walls in the way; Shield Generators soften damage near them. The Worker runs it to write the base log (8 entries, one drill a minute); the phone replays the same seed. **It never grants anything** (tested: CP, materials, minerals, points, reputation, score and achievements unchanged).

### 13.5 Command Power
100 × CC level + 20 × level × (1 + 0.15 × (level − 1)) per building (30 for turrets, 10 for gates) + wall sections by tier (1/2/4/7/10). Shown in the plot; used for visits (top 20) and Base of the Week (Phase 2).

### 13.6 Progression model (`dev/tests/conquest-base-progression.mjs`)
Real reward, bank, claim and plot functions on the Worker clock; scripted 90 s sorties; after the first base, half of all CP goes to engineering and other sinks. Modeled, not a human playtest.

| Profile | CC1 (first base) | CC2 | CC5 | CC9 (tier V) | CC10 |
|---|---|---|---|---|---|
| Regular, 45 min a day | 51 min of play | day 3 (96 min of play) | day 7 | day 21 | day 31 |
| Dedicated, 150 min a day | day 1 | day 1 | day 3 | — | day 10.5 (2.9× faster) |

Not instant (CC5 takes a week, CC10 a month) and not a wall (a new step every few sessions, first builds take 15 s).

### 13.7 Migration (every existing base)
Tier I…V becomes CC 1/3/5/7/9 with the same points multiplier, Daily Base Yield clocks, travel node and defense record; each module becomes its building at the same level with an auto layout; a module under construction continues as the builder's job with the same finish time; banked goods are untouched. Tested over all 13,081 old tier/module combinations.

## 14. Town Defense (Session 5B, owner-approved Nov 8 2026)

Brief: `docs/conquest/SESSION_05B_TOWN_DEFENSE_FULL_PROMPT.txt`. Code: `js/conquest/plot.js` (rules + raid simulation), `worker/src/conquest-plot.js` (Worker actions), `js/conquest/plotview.js` (phone). Tests: `dev/tests/conquest-town.mjs`, `dev/tests/conquest-town-balance.mjs`, `dev/tests/conquest-plot.mjs`, `dev/tests/wtest/conquest-dev.mjs`, `dev/tests/conquest-plot-ui.py`, `dev/tests/conquest-base-builder.py`. **Airdrop rules are unchanged** (multiplier by tier from the CC level, Daily Base Yield, 50,000 cap, points never purchasable). The drill never pays CP, materials, minerals or points.

**MONEY RULE (owner, Nov 8):** what is sold and the limits on it are the owner's business decisions. Every price and every "sellable" flag lives in one data table, `ConquestPlot.STORE` (store tiles) and `STORE.ores` (which ores may ever be sold). The values below are recommendations.

### 14.1 The town grows with the Command Center
A fixed 79 × 79 grid of 4 m cells. The town is the centred square of side 45, 49, 53, 57, 61, 65, 69, 73, 75, 77 cells at CC1…CC10 (CC10 is 2.93× the CC1 area, about 308 m across). Everything must be built inside the current town; raiders gather in the one-cell ring just outside it. No live players existed, so Session 5 plots (v1) became a fresh town claim on the same site at the same CC level (tier and points multiplier unchanged; banner and theme kept); accounts, wallets, points and minerals were not touched.

**Settler homes** (settler kit look: domes, habitat blocks, water towers, greenhouses, market stalls) fill a fixed lot lattice per site; a lot is lived in from the first CC whose town keeps it 3 cells inside the edge, unless the pilot builds over it (homes never block the pilot). Ridge: 13 homes at CC1 rising to about 80 at CC10. Homes are real raid structures (260 HP).

### 14.2 Sites (seven)
| Site | Bonus | Lanes | Defensive character |
|---|---|---|---|
| CRATER RIM | +15% Refinery alloy, rim deposits (3 Ferrite a day) | 4 | the crater rim is an inner wall with four passes; outer districts spill over it |
| RIVER DELTA | +15% Biodome biomass | 4 | river channels split the town into islands joined by fords |
| RIDGE | +10% turret range | 3 | cliffs guard the lower west and south terraces (ramps) |
| CANYON | hard to raid | 2 narrow | end walls with 3-cell passes; side ravines climb to the plateau |
| HIGHLAND PLATEAU (new) | +12% wall strength | 3 | a summit ring and an escarpment ring, each with three ramps |
| ICE BASIN (new) | +15% Helium-3 | 4 | frozen lakes: not buildable, raiders cross at half speed (kill zones); crevasses |
| ASH FIELD (new) | +20% Reactor power | 5 | basalt ridges channel raiders, vents; the most open site |

### 14.3 Vitals
The Command Center is the primary objective: destroyed = the raid wins. Reactor, Storage Depot and Science Lab are secondary vitals (gold corner marks, ◆ VITAL in the menu); placed anywhere in the town. In a raid a fallen Reactor cuts power (turrets fire slower, shields weaken, down to 35%); a fallen Storage Depot exposes the production store (raids from Session 7 take a share); a fallen Science Lab pauses research (Session 6). The drill only reports these; nothing persists.

### 14.4 Buildings rebalanced for the larger town
Refinery 1 → 2 at CC5 → 3 at CC9; Reactor 1/2/3/4/5 at CC1/3/5/7/9 (14 power a level); Biodome 1/2/3 at CC2/6/10; Helium Extractor 1/2/3 at CC3/7/10; Shield Generator 1/2/3 at CC3/6/9; Gates 2/4/6/8 at CC3/5/8/10; new **Foundry** (CC2, 3×3, levels I–V, 2 power a level, 120 CP + 10 alloy at level I, ×2.4 a level; a second one at CC7). Turret cap 3, 5, 7, 10, 13, 17, 22, 27, 34, 42 by CC. Power stays a real trade-off: a fully built CC10 town cannot max every building and turret.

### 14.5 Walls: composite and ore blends
Every wall cell costs **1 wall composite**. Every town starts with **200** (the CC1 perimeter is 176 cells). The **Foundry** turns alloy the pilot loads (hopper 30 alloy a level) plus plot regolith into composite: 4 composite per alloy, 5 composite an hour per Foundry level, into the composite stock up to 400 + 300 per Foundry level (it stops when full and keeps the loaded alloy). Removing walls gives their composite back (not the ore).

Each section may carry an **ore blend** (ore + light/medium/heavy). Ore comes from the base stores (minerals moved from the wallet). With q = tier weight (Ferrite .12, Ilmenite .25, Armalcolite .42, Tranquillityite .6, Selenite .8, Moonheart 1) × blend weight (light .4, medium .7, heavy 1): **strength** = 600 × (1 + 4q) HP, **durability** = 40q % less damage, **reflectiveness** = 35q % of each incoming hit bounced back at the attacker (the wall takes the rest × (1 − durability) × (1 − shield)). Ore totals round up once per order. Highland Plateau walls get +12% HP.

| Blend | Unlock | Strength (HP) | Durability | Reflect | Ore per cell |
|---|---|---:|---:|---:|---|
| Composite | CC1 | 600 | 0% | 0% | none |
| Ferrite light / medium / heavy | CC1 | 715 / 802 / 888 | 2 / 3 / 5% | 2 / 3 / 4% | 1 / 2 / 4 Ferrite |
| Ilmenite light / medium / heavy | CC2 | 840 / 1,020 / 1,200 | 4 / 7 / 10% | 4 / 6 / 9% | 1 per 2 cells / 1 / 2 |
| Armalcolite light / medium / heavy | CC4 | 1,003 / 1,306 / 1,608 | 7 / 12 / 17% | 6 / 10 / 15% | 1 per 4 cells / 1 per 2 / 1 |
| Tranquillityite light / medium / heavy | CC5 | 1,176 / 1,608 / 2,040 | 10 / 17 / 24% | 8 / 15 / 21% | 1 per 10 cells / 1 per 5 / 2 per 5 |
| Selenite light / medium / heavy | CC7 | 1,368 / 1,944 / 2,520 | 13 / 22 / 32% | 11 / 20 / 28% | 1 per 20 cells / 1 per 10 / 1 per 5 |
| Moonheart light / medium / heavy | CC9 | 1,560 / 2,280 / 3,000 | 16 / 28 / 40% | 14 / 25 / 35% | 1 per 40 cells / 1 per 20 / 1 per 10 |

Rare-or-better ores (Armalcolite and up) stay earn-only by default (`STORE.ores`). Looks: composite concrete; Ferrite rust with steel flecks; Ilmenite black with a blue sheen; Armalcolite grey-blue with cyan seams; Tranquillityite red-orange needles; Selenite pale glass with a white glint; Moonheart obsidian with a deep blue-white glow. Heavier blends stand taller with more veins.

### 14.6 Wall caps and extensions
Base cap **600, 756, 911, 1,067, 1,222, 1,378, 1,533, 1,689, 1,844, 2,000** cells at CC1…CC10. **Extensions** add up to **+50%** of the level's base cap (CC10: 3,000), capacity only:
- **Foundry research** (REINFORCED LATTICE I–V, ore from the base stores, needs that Foundry level): 30 Ilmenite, 12 Armalcolite, 25 Armalcolite, 6 Tranquillityite, 2 Selenite; +6% each (30%).
- **Defense Drill milestones**: the first drill held (Command Center ≥ 50%) at CC1, CC3, CC5, CC7 and CC9 or higher: +4% each (20%). Capacity only; the drill still pays nothing.
- **Real base defenses won**: 3 and 10 wins: +5% each.
- **Store**: wall extension pack +10% (capacity only), checkout DISABLED until payments are certified.
Fast wall tools: LINE (solid, 4-connected), RECT, RING, COPY/PASTE, ERASE and UNDO on a draft; the Worker expands shapes itself (up to 12 sections and 1,200 cells an order); live "WALLS n / cap (+EXT)" and composite/ore cost before CONFIRM.

### 14.7 Eleven turrets
| Turret | Unlock | Role | Range | Damage | Every | Special | Power/level | Level I cost |
|---|---|---|---:|---:|---:|---|---:|---|
| Cannon Turret | CC1 | all-round | 28 m | 34 | 1.1 s | | 1 | 70 CP + 5 alloy |
| Twin-Barrel MG | CC1 | vs swarms | 22 m | 7 | 0.14 s | ×1.45 vs light | 1 | 80 CP + 5 alloy |
| Laser Turret | CC2 | fast beam | 24 m | 9 | 0.25 s | ×1.2 vs light | 1 | 110 CP + 6 alloy + 1 He-3 |
| Rocket Pod | CC3 | salvo · area | 30 m | 18 ×4 | 3.4 s | 4-rocket salvo, 3.5 m splash, ground only | 1 | 140 CP + 8 alloy + 1 He-3 |
| Missile Turret | CC4 | anti-air | 36 m | 55 | 2 s | 3 m splash, flyers first | 1 | 160 CP + 8 alloy + 2 He-3 |
| Mortar | CC5 | long splash | 44 m | 46 | 3 s | 6 m splash, min 10 m, ground only | 1 | 190 CP + 10 alloy + 2 He-3 |
| Flame Projector | CC5 | short cone · burns | 13 m | 5 | 0.2 s | cone, burns 6/s for 3 s, ×1.3 vs light | 1 | 170 CP + 9 alloy + 4 biomass |
| Heavy Siege Cannon | CC6 | vs armor | 34 m | 240 | 4.6 s | armor piercing, toughest target first, ground only | 2 | 260 CP + 16 alloy + 3 He-3 |
| Tesla Arc Coil | CC7 | chains | 18 m | 30 | 1.1 s | jumps to 4 more within 7 m (×0.8 each) | 2 | 300 CP + 16 alloy + 4 He-3 |
| Laser Cannon | CC8 | charged burst | 34 m | 210 | 3.6 s | half armor piercing | 2 | 340 CP + 18 alloy + 5 He-3 |
| Railgun | CC9 | pierces a line | 50 m | 190 | 5 s | everything in a 1.4 m line, armor piercing | 2 | 420 CP + 22 alloy + 6 He-3 |
Levels I–V as before (+25% damage, +4% range a level; cost ×2.4 a level).

### 14.8 The whole-town raid (Defense Drill now, async raids in Session 7)
Waves gather at the lanes just outside the town and path to the Command Center over a Dijkstra flow field whose cell cost is 1 (2 on ice) + the effective HP of any structure there ÷ 40 + the threat of the turrets covering it (dps × 0.008), so they break through the weakest wall and avoid kill zones when a detour is cheap. On the way they attack whatever blocks them; raiders, swarmlings and sentinels also attack structures in reach (sentinels prefer turrets); brutes break walls (×1.8). Kinds: raider 110 HP, swarmling 34, sentinel 420 (30% armor), brute 1,500 (45% armor), drone 70 (flies straight at turrets, then vitals). Waves by threat T (= CC): three waves (four from T6) of raiders 3+T…, swarmlings 2T–4T, sentinels, drones and, from T5, brutes; HP ×1.19^(T−1) (×4.8 at T10), damage ×1.11^(T−1) (×2.6), up to 130 + 5(T−1) s. Deterministic from (layout, seed, threat); the Worker runs it without frames for the log (the result shown is the log's); the phone replays the same seed, simulated in 8 ms slices so it never freezes. Bounded: a full CC10 town (2,000–2,600 walls, 42 turrets, ~60 homes, 211 raiders) median 56–129 ms on the Worker path in node (numbers in `docs/conquest/session5b/town-rules.json`).

### 14.9 Balance model (`dev/tests/conquest-town-balance.mjs`, numbers in `docs/conquest/session5b/balance-model.json`)
- CC1 starter town (2 Cannons + 1 Twin-Barrel MG at level I, a 53-cell composite + Ferrite-light ring: 53 composite, 53 Ferrite) holds the threat-1 drill on all seven sites × 5 seeds; an undefended CC1 town always falls.
- CC10 town (legal power: 5 Reactors, production, 3 Shield Generators, 42 turrets of all eleven types) with 2,000 cells of heavy rare blends holds threat 10 on all seven sites × 2 seeds.
- The same town with 3,000 composite-only cells (+50% extensions, no ore) loses its Command Center in 12 of 14 drills (the other two end at 9% and 22%); with no walls it falls in 12 of 14. Spending power without materials does not hold.
Modeled with scenario layouts, not a human playtest.

## Appendix: model assumptions (`dev/tools/economy-model.mjs`)

- **Arcade points a minute:** same formula as `dev/tests/s2/ppm.mjs` (measured win rate and match length, +20 s of screens, streak bonus, no featured bonus) on `league-grid-standard.json`. It reproduces `docs/launch/LEAGUES.md`: 223 / 264 / 320 / 343 / 460 / 495 / 702.
- **Conquest kit speed** (whole-cycle speed vs stock): common 1.05, rare 1.12, epic 1.25, legend 1.40. The basis:
  - Moonbeam kills a sentinel 1.68× faster than a stock Pulse (`docs/conquest-living-war/weapon-ttk.json`);
  - about 45% of a cycle is travel and banking;
  - top kits make fewer repair trips.

  Phase 1 replaces these with scripted-pilot timings.
- **Conquest content mix by kit** (time shares):
  - stock: mostly field missions and commons;
  - rare: HARD raids;
  - epic: HARD and VETERAN;
  - legend: VETERAN raids, VETERAN deposits and strikes.

  The exact shares are in `kitModel` in the JSON.
- **Minerals:**
  - **Time split:** gathering is 25% of Conquest time and operations 45%.
  - **Ramps:** the rare zones open from day 3 (half) and day 8 (full). The very rare zones open from day 14 / day 30. VETERAN raids open from day 30 / day 45.
  - **Raid wins:** HARD raids win 70% in week 1 and 90% after. VETERAN raids win 80%.
  - **Strikes caught a day** = (session + 20 min window) ÷ 120 min. Success is 60% in week 1, 85% in weeks 2–3 and 95% after.
  - **Fabrication** is greedy, lowest slot first.
- **First hour:** durations from the existing Conquest models (field 2 min, HARD raid 3.3 min, starter wins about 7 of 10 HARD raids) plus the new gathering and fabrication steps.
- **Plating strength:**
  - the real `powerOf` with hull HP scaled;
  - traits as effective HP (energy 35% and area 15% of incoming damage; Moonbeam exempt);
  - the live win chance from `powerWin(..., live)`.
- **Not modeled:** featured bonuses, quests, referral income, purchases, human variance.
