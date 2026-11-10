# Conquest audit — decisions for the owner

Fourteen real choices. Everything else in [CONQUEST_1_0_SPEC.md](CONQUEST_1_0_SPEC.md) and [BUILD_PLAN.md](BUILD_PLAN.md) is decided and can be built as written. Your standing decisions (50,000 shared cap, points never bought, rare+ earn-only, never weaken gear, every chassis kept, RECALL as is, barren Moon with 30–40% terraformed, nothing overwhelming, payments off until Session 8) are not reopened here.

Reply with the numbers and letters, e.g. "1b 2a 3a …". Recommendations are marked ★.

---

### 1. When does a new player get their town?
Today: Command Center 1 costs 2,550 CP + 110 alloy + 65 biomass + 8 He-3 (`js/conquest/plot.js` `CC.claim`), modeled at minute 59 of ordinary play; minute 50 of play on day 2 for a casual.
- **a) ★ Split the claim.** CC1 "claim your plot" costs 600 CP + 30 alloy + 15 biomass + 2 He-3 (reachable at minute ~18–22 after the first three field missions) and keeps ×1.05 points. CC2 takes the remaining 1,950 CP + 80 alloy + 50 biomass + 6 He-3 so the cumulative cost to every later level, and every points multiplier, is unchanged. The first "this is mine" moment lands inside the first session; the economy stays identical from CC2 up.
- b) Keep 2,550 CP at CC1 and compensate with a stronger guided first hour only.
- c) Free plot at minute 5 (CC0, no production, no multiplier); CC1 keeps its price.
Why ★a: the brief asks for the first base moment inside the first 10–20 minutes; the first hour is where most Telegram games lose 60–70% of installs. (a) does it without touching the multiplier ladder or any later cost.

### 2. Daily Base Yield points: how much play unlocks them?
Today one verified operation or harvest (about 2 minutes) releases the day's whole points part (1,000–2,600 base × league), which is the cheapest airdrop farm for alt accounts.
- **a) ★ Steps.** Each verified operation that day unlocks 25% of the points part (4 operations = 100%; harvests count half). Materials part unchanged.
- b) Time gate: 15 minutes of simulated Conquest play that day.
- c) Keep as is and rely on cluster flags.
Why ★a: it costs an honest regular nothing (4 operations is 8–12 minutes), it quarters the alt yield, and it is visible ("YIELD POINTS 50% · 2 more operations").

### 3. Field-mission airdrop points on repeats
Today a replayed field mission pays the full 450 base points every 180 seconds (only CP tapers). It is the best points-per-minute in the game and the easiest to script.
- **a) ★ Taper like CP:** 100% for the first 3 completions of a mission each day, then 60%, then 40%. Raids unchanged.
- b) Flat 70% on every repeat.
- c) Keep 100%.
Why ★a: honest players rarely repeat one mission more than 3 times a day; bots do nothing else.

### 4. Meteor Strike schedule
Today: every 2 hours on the even UTC hour, same site for everyone. A player in one time zone can realistically catch 2–3 of the 12.
- **a) ★ Keep the shared clock and add a personal "Strike Beacon":** once a day the player can call down a strike at the current site within a 20-minute window (same waves, same rewards, same slot rules, counts toward Resonance). Shared talkable moments stay; nobody is locked out by time zone.
- b) Three fixed daily windows (06:00, 14:00, 22:00 UTC), bigger rewards.
- c) Keep as is.
Why ★a: the event is the only legendary-mineral source outside competitive rewards; (a) guarantees one per day for every active player and keeps the shared schedule for the community.

### 5. Can loot be lost in the field?
Minerals are cargo: on death you lose half of what you carry, rounded down, into a 10-minute wreck.
- **a) ★ Minerals stay cargo (unchanged); parts, trophies, blueprint fragments and consumables are account-bound the moment they are picked up.**
- b) Everything is cargo, including parts and trophies.
- c) Everything is safe on pickup.
Why ★a: the banking tension you already built stays for the heavy resource (minerals), while the exciting rare pops (a trophy, a Selenite part) never turn into a loss screen. Losing a one-of-a-kind drop to a respawn is the fastest way to make players quit.

### 6. First "real" raids on the town: PvE or player?
- **a) ★ PvE first (Session 7):** while you are away, Parasite raids hit your town on a schedule tied to your territory (one a day at CC1–3, up to three at CC8+), using the drill engine with persistent damage, the exposed-store loot share, a Telegram alert and the replay. Player raids with revenge and shields follow in the same session once PvE raids are stable.
- b) Player raids directly (needs matchmaking bands, shields, revenge and anti-abuse in one go).
Why ★a: defenses get consequences immediately for every player, including when there are few players online, and the raid engine, alerts and REPAIR flow are proven before real opponents enter.

### 7. The 50,000 cap for Master and Lunar Legend players
A regular hour at Master with a CC9 town earns 50,000 in 55 minutes; at Lunar Legend with CC10 in 37 minutes. Your standing decision is 50,000 shared.
- **a) ★ Keep 50,000 and make capped time valuable:** the HUD says "DAILY CAP REACHED · loot, minerals and CP still drop"; loot tables and Resonance keep running; the capped hour feeds the Trophy Hall and research.
- b) Raise the cap to 60,000 for Master and Lunar Legend only.
Why ★a: changing the cap changes the airdrop promise; (a) keeps the promise and gives the top players a reason to keep playing that is not points.

### 8. Return streak
The original flagship brief ruled out "mandatory 7-day streaks". The retention data of every top mobile strategy game says a soft streak is the single strongest D7 lever.
- **a) ★ Soft streak:** 7 days of any verified Conquest activity → 1 Repair Kit a day, a Scanner Charge at day 3, an earn-only banner emblem at day 7, a town decoration at day 30. Two freeze days a week so a missed day never resets. Never points, never minerals.
- b) No streak.
Why ★a: it is a gift for showing up, not a punishment for leaving; rewards are cosmetic and consumable so the airdrop stays untouched.

### 9. Session 6 scope and order
- **a) ★ Session 6 = Conquest Core Fun** (first hour, feel pass, loot v1, living world, HUD cut, analytics, anti-farm fixes), then **Session 6B = Tank Lab** (mods, Science Lab research fed by loot parts, plate visuals per tier, POWER chip, audio and weather). Two Opus · Extra sessions.
- b) One combined Session 6 (fun + mods + research + audio + weather) at Max.
Why ★a: mods and research are useless without the parts that loot drops and the feel that makes fights worth fighting; a combined session is 2× the size of 5B and would ship nothing for a week.

### 10. Base production
Refinery 0.8 alloy an hour per level: a CC5 town makes about 25 alloy a day; one 3-minute raid pays 18–26.
- **a) ★ Raise production ×3** (Refinery 2.4, Biodome 1.8, Helium 0.45 an hour per level), raise Storage caps ×2, show "+N since you left" on the hub. CP still binds every Command Center level, so progression speed is unchanged; the base simply stops feeling pointless.
- b) Keep production and make the base about yield points and defense only.
Why ★a: a town that makes nothing you notice is a menu, not a home.

### 11. Where analytics live
- **a) ★ Firebase daily counters** (`an/<day>/<event>` and D1/D7 cohort counters by first-day), no third party, no personal data, readable from the admin sheet.
- b) A hosted analytics service (new vendor, new privacy text, monthly cost).
Why ★a: twelve counters cost nothing and answer the five questions that matter (funnel, D1/D7, session length, quit points, raid win rates).

### 12. First five things for sale in Session 8
Prices are yours (MONEY RULE). Pick the first wave; the spec lists the full catalog.
- **a) ★** Lunar Pass Conquest perks (RECALL 5 min, scanner +50 m, 2 layout slots, daily Repair Kit), Second builder, Town looks bundle (3 lightings + 2 wall skins), Plate finishes (tank), Ferrite Crate (150, max 2 a day).
- b) Same without the Ferrite Crate (purely cosmetic + convenience launch).
- c) Add Ilmenite Crate and the speed-up to the first wave.
Why ★a: convenience and looks players already ask for in every base game, one mineral crate to test demand, no speed-up at launch (speed-ups on 8-hour timers feel like a toll until the second builder exists).

### 13. Fix the Command Center price zig-zag
CC2 1,800 → CC3 2,700 → CC4 1,700 → CC5 2,500 CP (reported in 5C).
- **a) ★ Monotonic:** CC3 2,200, CC4 2,200 (cumulative to CC5 unchanged, so the ×1.15 arrives on the same day).
- b) Leave it (odd levels carry the old tier prices on purpose).

### 14. World boss
No co-op exists and the warfront says "coordinated multiplayer not certified".
- **a) ★ Hive Titan, per-pilot instance with a shared board:** every 6th Meteor Strike site spawns a boss after the core is extracted; each pilot fights their own copy (fixed authored HP, phases, tells), damage dealt posts to a shared weekly board, top 100 get a Selenite, everyone who finishes gets the epic loot roll. No fake co-op, no fake players.
- b) Wait for real co-op (Session 9+).
Why ★a: it gives the "world boss" fantasy and a weekly social moment with the server authority you already have.

---

Not asked (already decided by you or by the data): the cap and league factors, mineral sellability, chassis, RECALL, the 5E visual order (see BUILD_PLAN), the loot "never drops" list, the anti-bot flags, the analytics event list.

Model: Opus · Medium — this is a 10-minute read; reply with numbers and letters.
