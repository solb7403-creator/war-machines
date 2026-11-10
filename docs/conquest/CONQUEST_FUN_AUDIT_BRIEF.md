LUNAR: War Machines — CONQUEST FUN, RETENTION + ECONOMY AUDIT (owner-approved scope, Nov 9 2026)

Run at Fable · Extra effort. This is a design audit, not a build: no gameplay code changes. Deliverables are documents (plus small read-only measurement scripts if needed). It runs in parallel with Session 5D (fair Arcade), which may be changing combat code on its own branch, so read current main and note anything 5D will change.

Read first: CLAUDE.md, AGENTS.md, docs/ROADMAP.md (all of it, especially "Standing owner decisions", "Base builder vision", "Settler architecture", "Terraform-zone game modes", "Terraform audit additions"), docs/economy/RESOURCE_ECONOMY.md, docs/launch/LEAGUES.md, docs/conquest/CONQUEST_FLAGSHIP_EXECUTION_HANDOFF.md, docs/conquest/IMPLEMENTATION_CHECKPOINT.md (latest checkpoints), the 5/5B/5C/5D briefs in docs/conquest/, docs/art/references/README.md, then the Conquest code (js/conquest/*, worker/src Conquest routes) and the earning-model tests (dev/tests/conquest-earning-model*, conquest-balance*, conquest-town-balance*).

## The owner's goal
Make Conquest as addictive as possible and complete, in a fair way that fits the ultimate vision: an exceptional sci-fi warfare game with a large, loyal, highly engaged community that enjoys spending money, with meaningful progression, stronger gear, better bases, competitive accomplishments, exploration, rewards and long-term goals. The airdrop is the main focus until it happens. Nothing may feel overwhelming (owner, repeated). Players are on phones in Telegram, so sessions are short and frequent.

## How to audit
1. **Play it.** Run the real game in a phone-size browser (390×844) as a brand-new account and as an advanced dev account. Time the first 10 minutes: time to first fight, first loot, first upgrade, first building, first "wow". Screenshot the key moments.
2. **Measure the economy** with the real formulas and earning-model tests: minutes to each base level, armor tier and mineral tier, and airdrop points per hour, for a casual pilot (2×15 min/day), a regular (1 h/day) and a grinder (4 h/day).
3. **Read the code** for every Conquest system and list what exists, what's shallow, what's broken and what's missing.
4. **Benchmark** against what makes the best mobile strategy/action games sticky (core loop clarity, reward cadence, appointment mechanics, social pressure, mastery), and apply only what fits LUNAR.

## Cover every area (score each 1–10 with evidence, then fixes)
1. **First 10 minutes:** does a new player get hooked? Onboarding clarity, early wins, the first base moment, the first sense of power growth.
2. **Core loop:** explore → fight → loot → bank at base → build/upgrade → stronger tank → harder zones. Is every step rewarding, and is the next goal always visible?
3. **Session length and the "one more raid" pull.**
4. **Daily and weekly reasons to return:** contracts, Daily Base Yield, timers, streaks, events, the warfront.
5. **Pacing of ore, minerals, base, tank and airdrop points:** casual vs grinder fairness, the 50,000 daily cap, no walls of nothing-to-do, no instant max-out.
6. **Base building:** depth, feeling personal and visual, CC1→CC10 progression, town defense.
7. **Tank progression inside Conquest:** Hull Plating, minerals, mods (Session 6) and Science Lab research. Does the player feel their tank getting stronger?
8. **Raids and defense:** tension, fairness, async base raids, revenge, defense replays, the drill.
9. **Variety of things to do:** the six mission families, terraform-zone modes, world events, bosses. Is there enough? Propose what's missing.
10. **Social pull:** squads, visiting bases, Base of the week, leaderboards, sharing.
11. **Visuals and "wow":** what to fix first for the biggest impression, in priority order for Session 5E (models + arcade maps) and 7.5 (graphics).
12. **Feel:** controls, hit feedback, loot pop, audio (Session 6), readability on a phone.
13. **Spending players enjoy:** what players would gladly buy within the store rules, and what would feel like a scam.
14. **Airdrop integrity:** exploits, bots and multi-accounts that could farm points, and the anti-cheat Session 7 needs.
15. **Measurement:** what anonymous gameplay events the game needs to know if it's working (funnel, D1/D7 return, session length, where players quit). Propose a minimal, privacy-respecting set.

## Design the owner asked for: loot from mobs and bosses
The owner wants random loot drops from mobs and bosses that never interfere with the game's revenue. Design the full system:
- Drop sources (normal mobs, elites, commanders, world bosses, raids) and drop tables with disclosed rates.
- What can drop. Earn-only things: rare+ minerals, mod and research parts, blueprint fragments for earn-only cosmetics, trophies for the Trophy Hall, Conquest-only consumables.
- What must never drop: anything sold in the store, airdrop points beyond the existing rules, or anything that makes buying pointless.
- Visible rarity, a pity system, exciting loot pop and banking at the base (risk: loot carried in the field can be lost?).
- How loot ties into base and tank progression.
Agree, refine or push back with reasons.

## Fixed (owner's standing decisions; don't change)
Points can't be bought; only common and uncommon minerals are sellable; rare and above are earn-only. Never weaken existing gear, Moonbeam or Lunar Skin; fairness comes from leagues and matchmaking. Keep every chassis; armor plating is added on top. The daily cap is 50,000, shared across modes. No pure AFK points. RECALL stays as decided. The barren Moon is the foundation, with ~30–40% terraformed. Nothing overwhelming. Payments stay disabled until Session 8.

## Deliverables (all in docs/conquest/audit/, pushed to a branch, then merged; docs only)
1. **OWNER_SUMMARY.md, readable on a phone in 5 minutes:** the 10 biggest problems, the 10 highest-impact changes, the scores per area, and the loot design in short.
2. **DECISIONS.md:** every choice the owner must make, numbered, each with 2–3 options, your recommendation and why. At most 15, and only real decisions.
3. **AUDIT_REPORT.md:** full findings per area, with evidence (screenshots, numbers, file references).
4. **CONQUEST_1_0_SPEC.md:** the complete target design (loop, progression, loot, modes, events, social, monetization, anti-cheat, analytics), consistent with the standing decisions.
5. **BUILD_PLAN.md:** the spec split into the fewest high-quality build sessions, re-planning roadmap Sessions 6, 7 and 7.5 as needed and placing 5E's visual priorities. For each session: scope, dependencies, recommended model and effort, and a ready-to-paste full brief (`SESSION_XX_..._PROMPT.md`) written to the standard of the 5C/5D briefs, with everything decided except the items in DECISIONS.md.
6. Update docs/ROADMAP.md with the new session order.

Budget: aim for depth over breadth of prose. No filler, and no generic advice that isn't tied to LUNAR's code, numbers or screens. Commit and push the deliverables as they're finished (summary and decisions first) so nothing is lost if the session stops.
