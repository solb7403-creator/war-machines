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

### 5.2 Deposits in the populated war region

| Mineral | Nodes | Units per harvest | Gather channel | Respawn | Placement rule |
|---|---:|---:|---:|---:|---|
| Ferrite Regolith | 36 | 2–4 (avg 3) | 5 s | 20 min | open ground near routes; safe enough for a new pilot |
| Ilmenite | 18 | 1–3 (avg 2) | 8 s | 45 min | off-route basalt, often within patrol paths |
| Armalcolite | 10 | 1–2 (avg 1.5) | 12 s | 3 h | crater walls and Parasite territory, inside or next to garrison zones |
| Tranquillityite | 5 | 1 (+3% Selenite vein) | 16 s | 8 h | contested sites: raid-site perimeters, hive edges |
| Starter Vein | 1 (once) | 35 Ferrite | 5 s | never | beside the Refuge, revealed by the guided first scan |

Placement follows the Phase 2 zone map. Commons sit in open and terraformed ground near routes. Rarer minerals sit deeper in Parasite territory, crater walls and hard sectors. The top tiers sit only at contested sites. Every existing sector, raid, mission and route keeps working.

### 5.3 Gathering rules (Phase 3)

- **Scanner pulse:** a new HUD ability, free, with a 30 s cooldown.
  - It reveals deposits within 150 m (+50 m per Radar module level).
  - Discovered deposits stay on the MAP with their state: "ready", or "depleted · 12m" with the respawn time.
- **Gather:** stop within 6 m and hold GATHER for the channel time.
  - Damage interrupts the channel.
  - The channel makes noise: Parasites within 120 m move in to investigate. That is the exposure the owner asked for, so gathering creates fights.
- **Server-authoritative:**
  - the channel advances only in simulated time, while in range and alive;
  - the node's generation (like patrol spawns) prevents double harvests;
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
| **Regular, Conquest-focused** | **3 d** (1 d) | **9 d** (3 d) | **4.3 wk** (11 d) | **2.6 mo** (5.4 wk) | 6.0 mo (2.8 mo) | 15.5 mo (6.9 mo) |
| Regular, mixed | 3 d (1 d) | 12 d (4 d) | 5.0 wk (13 d) | 3.3 mo (6.3 wk) | 7.8 mo (3.6 mo) | 20 mo (9.1 mo) |
| **Regular, Arcade/PvP only** | **5 d** (2 d) | **5.3 wk** (11 d) | **3.1 mo** (6.0 wk) | 2.5+ yr (19 mo) | needs Conquest or top competitive rewards | needs Conquest or top competitive rewards |
| Dedicated, Conquest-focused | 1 d (1 d) | 3 d (1 d) | 12 d (6 d) | 6.1 wk (3.3 wk) | 2.4 mo (6.6 wk) | 6.0 mo (2.7 mo) |

The Arcade-only rare set takes about 3 months (owner target). Against the owner's targets, the regular Conquest-focused player hits every one: common 3–4 days, uncommon 1–2 weeks, rare about 1 month, very rare 2–3 months. Epic is about 6 months and legendary over a year (long-term). Dedicated players are 2–3× faster. The respawn timers and the strike schedule keep them from being 10× faster.

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
