LUNAR: War Machines — SESSION 7: LIVING TOWN (raids on your town while away, live defense, alerts, Strike Beacon, streak, then player raids)

Run at Opus · Extra effort. Read first: CLAUDE.md, AGENTS.md, docs/ROADMAP.md, docs/economy/RESOURCE_ECONOMY.md (§14, esp. §14.10 hooks: `applyRaidDamage`, `loot()`, `plot.gar`, `plot.shieldUntil`, `plot.alerts`), docs/conquest/SESSION_05B_TOWN_DEFENSE_FULL_PROMPT.txt (raid engine), docs/conquest/IMPLEMENTATION_CHECKPOINT.md (6B checkpoint), docs/conquest/audit/CONQUEST_1_0_SPEC.md (§5.3 Strike Beacon, §6.3, §6.4, §7), docs/conquest/audit/AUDIT_REPORT.md (§4, §6, §8, §14), DECISIONS.md answers for 4, 5, 6, 8, the Telegram bot code in `worker/` (reminders, `ntf/`), `worker/src/conquest-visit.js` (snapshots). New branch from current main. Commit and push every tested slice; append a checkpoint.

Release: ask the owner once whether PRE-APPROVED; if yes, merge/deploy/verify when all gates pass and two independent reviewers have passed; otherwise stop at the PR. Payments stay disabled; raid shields are never sold in this session.

## Why
Walls and 42 turrets cost up to ~480,000 CP and only ever face a drill the pilot starts. Nothing happens to the town while the pilot is away, and the phone never tells them anything (`plot.alerts` writes `sent:0`). The Meteor clock is UTC-only. There is no reason to come back tomorrow except the yield meter.

## Order: A (PvE raids while away + REPAIR + replay) → B (live defense + garrison) → C (alerts + Strike Beacon + streak) → D (player raids + revenge + shields) → reviews, release. A–C must be releasable on their own if D runs out of time; say so in the checkpoint.

## A. Parasite raids while away (Decision 6 default a) — decided
- Eligibility per pilot: CC ≥ 2; a 3-day shield for a new town from its claim; the pilot offline ≥ 2 h; ≥ 8 h since the last raid; no active peace shield. Frequency: 1 a day up to CC5, 2 a day from CC6. Scheduled on the Worker from the pilot's seed and day (deterministic, no cron needed: resolved lazily at the pilot's next session open or at the public-snapshot read, whichever is first, with the raid timestamped in the past).
- Threat T = CC; waves = the drill's `drillWaves(T)`; seed = hash(pid, day, n). Run with `ConquestPlot.raid` (the drill engine) on the Worker; apply `applyRaidDamage()`; write `plot.log` (outcome, kills per turret, breaches, fallen vitals) and a `plot.alerts` entry (`kind:'raid'`, `sent:0`).
- Loot share: Command Center destroyed → 10% of the exposed production store (`loot()`: Storage protects 25–75%) and 5% of composite stock; breach without the CC → 5% of the exposed store; held → nothing taken. Never banked goods, wallet, CP, points, plates, cosmetics, inventory. Taken goods vanish (PvE); no attacker receives them.
- Held raids: count toward the wall-extension milestones (3/10 wins) and `base-defender`; pay the existing defense CP/materials cache; pay **no airdrop points** (nobody played). Lost raids: nothing beyond the damage.
- The hub shows "RAIDED while away · HELD / BREACHED · REPLAY · REPAIR ALL"; the replay runs in the Home Sector from the stored seed; REPAIR is the 5B order.
- Peace shield: `plot.shieldUntil` = now + 8 h after a lost raid. An earnable 24 h shield consumable drops as rare loot (add the row to `LOOT`; never sold).

## B. Live defense and the garrison — decided
- If a scheduled raid resolves while the pilot is online (session open or input within the last 2 minutes), it becomes a **live raid**: a 60-second alert ("RAID INCOMING · DEFEND?"); accepting enters the Home Sector in a defense state where the raid engine runs on the Worker in real time (the same 50 ms step as the world) and the pilot's tank fights alongside turrets (hits by the pilot are commands validated like world combat; raider HP is authored, never gear-matched). A live hold pays the 675 defense points (`CQ_PTS.defense`, inside the hourly limit and the cap) plus the cache; a loss applies the same damage and share as A.
- Garrison (`plot.gar`): one Hangar slot a level; the pilot assigns owned tanks (from the garage bays) as defenders with fixed authored AI (archetype stats by tier; never copies an attacker's gear); garrison tanks fight in live and away raids. A garrison tank "down" in a raid is repaired by the REPAIR order (no loss of the tank).

## C. Alerts, Strike Beacon, streak — decided
- Telegram bot (the existing reminder sender, `NTF_BATCH`, 4 at a time): messages for yield ≥ 90% (once a day), Meteor in 5 minutes at the pilot's last sector (only if played in the last 48 h), town raided (outcome + REPAIR deep link + "watch the replay"), Strike Beacon ready. Max 3 a day per pilot; settings in the Uplink card (per type on/off); respects the existing reminder opt-out. `plot.alerts[].sent` set when delivered.
- Strike Beacon (Decision 4 default a): once a UTC day a pilot may call a strike at the current slot's site within a 20-minute window of their choosing; identical waves, rewards, roll (keyed to the slot: the stored roll applies if the slot was already started), Resonance; counts as that slot. Hub card "STRIKE BEACON READY · site" and a HUD line.
- Soft return streak (Decision 8 default a): days with any verified Conquest activity; day 1 Repair Kit, day 3 Scanner Charge, day 7 earn-only banner emblem, day 30 town decoration; two freeze days a week so a missed day never resets; never points or minerals. One line on the hub; no modal.

## D. Player raids, revenge, shields (spec §7.2) — decided
- Opt-in by CC ≥ 4; both accounts ≥ 7 days old, not in a flagged cluster (`fh`), not squadmates/referral-linked, not the same target twice in 24 h, target not under a shield, target's town not damaged (repairable first).
- Matchmaking by defense rating (`dr` in the public snapshot) ±25%, random among 20 candidates read from a small index (`cqdr/<band>`), never by gear.
- The attacker drives into a Home Sector copy of the target town (read-only snapshot, as visits do) with a 3-minute clock and two raider waves (drill kinds at threat = target CC) they call at will; victory = Command Center down; steal 5/10/15% of the exposed store by a band the attacker declares before starting (the higher band spawns tougher defenders); a failed breach steals exactly zero (flagship rule). Attacker points 900 base once per target per day (inside the hourly limit and cap); defender receives the replay, damage, the share taken, a free 8 h shield and a REVENGE button (one revenge, same band, within 24 h; a revenge win returns the stolen share from the attacker's exposed store). Server settles both sides in one CAS each with idempotent raid ids; no client amounts; locked against concurrent settlement.
- Shields: free 8 h after being raided; the earnable 24 h consumable; the store raid shield exists only as a disabled tile until Session 8 (standing rule).
- Anti-abuse: raid ids + receipts, per-day caps (5 attacks, 3 revenges), band declared server-side, snapshots read at start and verified at settlement, both accounts' flags checked, self/squad excluded, two disposable accounts in the wtest suite.

## Tests and acceptance
- Node: all Conquest suites + `conquest-regression.sh`; new `conquest-away-raids.mjs` (eligibility, schedule determinism, damage, shares, never-raidable sets, shields, milestones, no points), `conquest-live-defense.mjs` (window, points once, garrison AI fixed stats), `conquest-alerts.mjs` (types, caps, opt-out, sent flags), `conquest-beacon.mjs` (one a day, slot roll reuse, Resonance), `conquest-streak.mjs` (freeze days, rewards never points), `wtest/conquest-player-raids.mjs` (two accounts, bands, steal/zero, revenge, concurrency, idempotency, flags), economy model + base progression (production shares do not change CC timelines by more than 5%).
- Browser (Chromium 390×700, 390×844, 320×568): a town is raided while away (clock advanced on the test server) → hub shows it → replay plays → REPAIR; a live raid accepted and fought; a Beacon strike; streak line; a player raid between two disposable accounts end to end with revenge; every new screen fits or scrolls.
- Captures to docs/conquest/session7/: raided hub card, replay, REPAIR, live-raid alert and fight, Beacon card, streak line, player raid start/result/revenge, 320/390 pairs.
- Two independent read-only reviewers (security/economy: settlement, shares, idempotency, alt/self exclusion, no mint; gameplay/performance: raid fairness by band, Worker step time in live raids, alerts volume).

## Don't touch
Arcade, leagues, payments, prices (the store raid-shield tile stays disabled), cap, plating/mod numbers, loot tables except the two new rows (24 h shield consumable; nothing else), RECALL, boards and Titan (7B).

## Final report
How often towns are raided by CC and what a lost raid costs; held/lost rates from the model across the seven sites at CC2/CC5/CC10; the alert types and caps; the Beacon and streak as shipped; player-raid rules and the two-account test result; live build or PR; open items; next session (7B Competitive & Social).

Model: Opus · Extra — server-authoritative raids with settlement, alerts and a second-phase PvP contest: high consequence, two reviewers mandatory.
