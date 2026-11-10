LUNAR: War Machines — SESSION 6B: TANK LAB (mods + Science Lab research, plate visuals, POWER chip, audio and weather)

Run at Opus · Extra effort. Read first: CLAUDE.md, AGENTS.md, docs/ROADMAP.md (Standing owner decisions: never weaken gear, every chassis kept, plating on top, fairness from leagues), docs/economy/RESOURCE_ECONOMY.md (§6 plating, §11 "Tank"), docs/conquest/IMPLEMENTATION_CHECKPOINT.md (Session 6 checkpoint), docs/conquest/audit/CONQUEST_1_0_SPEC.md (§3.1, §13, §14), docs/conquest/audit/AUDIT_REPORT.md (§7, §12), the garage Mods system (`js/rules.js` `FITS`, `js/ui.js` garage sections, `dev/tests/garage-rules.mjs`, `lab-ui.mjs`) and the 5E model notes (plate sockets per chassis). New branch from current main. Commit and push every tested slice; append a checkpoint.

Release: ask the owner once whether PRE-APPROVED; if yes, merge/deploy/verify when all gates pass and two independent reviewers have passed; otherwise stop at the PR. Payments stay disabled.

## Why
The audit scored "tank progression inside Conquest" 5/10: 57,200 CP of engineering is invisible on the tank, each plate is +1% hull with no visible change on LOW, mods and research do not exist, and Conquest shows no power number. Conquest has no ambience and no weather (roadmap Session 6 items). Session 6 shipped research parts as loot with nothing to spend them on.

## Order: A (research + mods) → B (plate visuals + POWER chip) → C (audio) → D (weather) → reviews, release.

## A. Science Lab research and mods — decided
- Four research tracks mapped to the four parts: Thermal (Thermal Core), Ballistics (Ballistic Coil), Drive (Drive Servo), Field (Field Capacitor). Lab level I opens Thermal and Ballistics, II Drive and Field, III the set mods (one per track, requires the other three of that track).
- A research job costs parts + CP + time on the Worker clock (I: 3 parts, 400 CP, 20 min; II: 6 parts, 1,200 CP, 2 h; III: 10 parts, 3,000 CP, 8 h), one job at a time, separate from the builder; a second lab slot is an earnable Trophy Hall II perk. A ruined Science Lab (raid damage) pauses research (5B hook).
- Research produces **mod blueprints** that unlock entries in the existing garage Mods system (`FITS`): the mods count toward gear rating via `powerOf`, work at full strength in every mode, and never weaken anything existing. Numbers: each mod is a bounded percentage in one stat with a cost in another (the existing FITS pattern), tuned so the full set of 12 mods adds about +8% gear rating on a top kit (between a Tranquillityite and a Selenite set) — report the real `powerOf` gains and live win chances the way RESOURCE_ECONOMY §6.3 does. PvP `checkLoadout` and `ecoLoadout` read ownership from the server record only.
- Science Lab UI in the town sheet: a holographic tree (three rings), timers, parts count, "what this does" in words; the hub RESEARCH button becomes live. Lab card desc updated; dev jargon forbidden (`conquest-copy.mjs`).
- Economy: re-run the model; add research parts to the loot model (already in Session 6's tables); the whole tree for a regular player should take 6–10 weeks (report it).

## B. Plate visuals per tier and the POWER chip — decided
- Mount the six plate looks on the 5E sockets of every chassis (HIGH: shine material + seams, Selenite fresnel sheen, Moonheart emissive pulse; LOW: single bucket + static glow; 2D: tier-colored outline). A plate change plays a sound and a hull highlight.
- POWER chip on the Conquest HUD and hub: `powerOf(loadout)` (gear rating incl. plating and mods) with a one-line delta on change ("POWER 92 → 94"); engineering shown as a Conquest bonus line in Refuge Supply ("ENGINEERING +18% heat, +9% range"). Zone bands on the region map and every briefing ("zone 80–110"), computed from the authored archetype tiers, informational only (enemies never read power; the 5D regression stays green).
- Refuge Supply opens on the two actions a pilot needs (BANK, REPAIR) and the plating cards; the ledger lines move below.

## C. Audio pass (roadmap "Audio (session 6)") — decided
Zone ambience loops (barren: near-silence, suit hum, distant impacts; terraformed: wind in grass, water, settler life, machinery; colony core: activity), weapon/impact/explosion sounds shared with Arcade (`js/fx.js` synthesis; add no large audio files without owner approval), UI and reward sounds (bank, build complete, research complete, plate mounted, contract claimed), stingers for raids, invasions, strikes and victories, the Session 6 mute toggle, volume in Settings. Mobile-friendly: one AudioContext, resumes on first touch, silent when hidden.

## D. Weather (roadmap "Weather (session 6)") — decided
Dust storms on the barren Moon (telegraphed by the HUD and sky 60 s ahead, 3–5 minutes, visibility 220 → 90 m, enemy sight the same, +15% salvage from kills during the storm; no points change), rain and fog banks inside terraformed zones (visual plus a soft fog of 160 m), all server-scheduled per sector from the UTC hour so every pilot in a sector shares the weather, capped effect budgets (particles ≤ 400 HIGH / 120 LOW, one extra program at most), reduced-motion and LOW variants. Weather is a modifier Gambits can use in 7B.

## Tests and acceptance
- Node: all Conquest suites; new `conquest-research.mjs` (jobs, costs, timers, lab levels, ruined lab pause, blueprint → FITS unlock, powerOf gains, PvP checkLoadout), `conquest-plates-visual.mjs` (sockets per chassis, LOW buckets, no new programs beyond budget), `conquest-weather.mjs` (schedule, visibility, budgets), updated `garage-rules.mjs`/`lab-ui.mjs`, the 5D gear-fairness regression (unchanged behavior), economy model.
- Browser: research a Thermal I mod end to end (parts → job → timer → blueprint → garage Mods equip → POWER chip rises); plates at every tier on three chassis at 390 HIGH/LOW/2D; a dust storm telegraph and arrival; ambience switches between barren and terraformed; mute works; every new screen fits or scrolls at 390×700, 390×844, 320×568.
- Captures to docs/conquest/session6b/: lab tree, six plate tiers on one chassis, POWER chip, storm before/after, 320/390 pairs. Perf: draws/tris/programs at the Refuge and in a storm, HIGH and LOW.
- Two independent read-only reviewers (security/economy: blueprint ownership, FITS gating, PvP loadout; gameplay/performance: feel, budgets, audio on iPhone WebKit).

## Don't touch
Arcade AI, leagues, payments, prices, cap, plating HP numbers (§6.1 fixed), RECALL, loot tables (Session 6), town raids (7), boards (7B). Never a mod that is sold or that drops from the store.

## Final report
What research produces and how long the tree takes for a regular player; the real power gains of the 12 mods and the set mods; plate looks per tier (captures); the POWER chip and zone bands; audio and weather as shipped with budgets; live build or PR; open items; next session (7 Living Town).

Model: Opus · Extra — a multi-system session (research economy, garage integration, rendering, audio, weather) with gear-rating consequences that need the real power fit.
