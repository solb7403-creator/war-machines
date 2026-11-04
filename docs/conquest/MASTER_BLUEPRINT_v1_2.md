# LUNAR: WAR MACHINES — CONQUEST MASTER BLUEPRINT
Version 1.2 — November 4, 2026
STATUS: Long-range design reference. Session 1 complete and deployed; Session 2 assigned separately.
SCOPE RULE: This document is NOT authorization to implement everything. The numbered Session 2 brief is the ONLY current coding scope.

## 0. Vision
Conquest is LUNAR's flagship long-lived, shared lunar war. Earth has fallen to intelligent Parasite-infected humanity. The Moon is the last stronghold of a free, cooperative civilization. Humanity's commanders compete for strategic influence while fighting a common invasion. Fighting, exploring, upgrading, defending, and taking territory must matter beyond a single match.

Core loop: prepare War Machine → deploy → fight in a physical battlefield → gain verified resources/reputation/territory progress → develop a personal Command Base → join larger operations → return to new threats. Preserve all six existing Arcade modes and the existing owned equipment and progression. No account resets.

## 1. Canonical Moon world
- Physical, continuous, procedurally generated Moon world, initial width X = 31,680 units, length Z = 47,520 units, true elevation Y.
- Original *reference base* travel speed = 4.4 units/second, so ideal flat/unobstructed crossings are 2 hours X and 3 hours Z. These are arithmetic reference dimensions, NOT fixed traversal time for every geared chassis.
- In Conquest players use actual Arcade chassis and permanent equipment stats. Faster chassis, Speed Core, fitted mods, upgrade levels, etc. cause faster travel. Do not downscale the world or force everyone to the same speed.
- Session 1 implemented a distinct Three.js perspective renderer and streamed true elevation; a navigable bridge, with separate surface over a real underpass, demonstrates honest 3D vertical space.
- World must remain extensible beyond initial bounds to the Moon's future regions, orbital installations, asteroid debris, shattered lunar fragments, derelict stations, and other theaters. Add content without shifting existing stable coordinates.
- Visually identifiable regions: terraformed green refuges near oxygen generators, enormous habitable valleys, forests, settlements, industrial oxygen complexes, lunar highlands and ridges, crater fields, scarce-oxygen barren wastelands and broad open plains.
- Terrain should be physically elevated with actual slopes, cliffs, descents, broad vistas, bridges, tunnels, overlooks and high/low combat positions. Perspective camera, correct grounded War Machine scale, material variation and fog/LOD make it feel like a real landmass, not a flat 2.5D backdrop.
- World streaming and LOD must keep mobile WebGL bounded. Deterministic seeded terrain, stable IDs/locations, floating origin, limited chunk construction, memory cleanup, collision matching drawn surfaces.
- Early work is a reusable FOUNDATION, not a promise that every square unit will already contain handcrafted scenery.

## 2. Lore: Earth's fall and the lunar last stand
- Microscopic Parasites entered the bloodstream of a large fraction of Earth's population. The infected retained their FULL intelligence, technical ability and organizational power, but their genetic/neurological changes removed empathy and drastically amplified greed, ruthless self-interest and willingness to take anything from others.
- Do not portray the Parasites as stupid or uniformly mindless. They are intelligent strategists, industrialists, engineers, tacticians and commanders capable of weapon and machinery advancement.
- Earth was overwhelmed. Humanity's remaining free, cooperative civilization escaped to the Moon, partly terraformed it, built enormous oxygen generation and life-support networks, and prepared its last defenses.
- The infected civilization now threatens the Moon. The conflict is between ruthless take-everything intelligence and people defending mutual aid, freedom and a civilization worth preserving.
- Oxygen complexes explain forests and habitable settlements. Scarce-oxygen regions remain bleak and inhospitable. Different locations and commanders express this history through their architecture, ecology, scars and ongoing battles.
- Human commanders can fight each other for control/resources even as the Parasite invasion forces temporary cooperation. Greater narrative detail and named characters can be designed during their later sessions.

## 3. Spatial hierarchy and strategic map
Theater → region → sector → objective/landmark → physical mission instance.
Future theater examples: main Moon, lunar orbit, debris belt, asteroid citadels, derelict network.
Sectors track stable IDs, discovered status, ownership/contest, threat tier, neighbors/supply, resources, fortifications, and raid/boss opportunities. All persistent authoritative state belongs server-side.
Strategic map should offer panoramic Moon overview, zoom and pan down to individual sectors, visually distinct biome boundaries, moving fronts and mission markers, discoverable locations, and later real deployment/warp gate access. Cluster markers at world zoom. The map must remain readable and responsive on iPhones.
Fast travel is unlocked by DISCOVERING a region that contains a warp gate; players should also unlock designated deployment points. Warp access and combat destinations are specified and server-verified later. Session 2 may improve map UX and provide metadata hooks, but must NOT create premature paid travel or live unlock economies.

## 4. War and territory, persistent consequence
- Named threat rosters and author-designed sector difficulty. Verified human victories shift control, unlock supply lanes, secure objectives, affect visual world state, and change regional opportunities.
- Threats include Parasite patrols, battalions, nests, fortified sites, escorted convoys, raiders, strategic commanders and unique bosses.
- Physical War Machine action is ALWAYS the center: a convoy interception is fought on terrain; a siege is fought through attack/defense stages; an orbital strike changes the actual battle environment.
- Examples of missions: repair relay, protect oxygen plant, escort convoy, assault Hive, take bridge, breach bunker, defend refuge, liberate resource sector.
- No fabricated huge army UI: physical encounters, meaningful visible consequences and later genuinely larger operations.
- Events and threats can return to occupied territory without wiping player progression. Multi-week campaigns accumulate meaningful victories and objectives, rather than pointless monthly resets.
- Begin concentrated and expand when player population and performance allow.

## 5. Personal Command Base and network
Each player has a permanent individual Command Base. A verified referred player can join a cooperative network with linked support and optional benefits, but remains the owner of their own account and gear; players without referrals can still progress through allies and active play.
Base facility categories to design later: HQ/command center, reactor, hangar, oxygen/life support, research, forge, resource extraction/refinery, storage vault, defenses, supply/warp links and cosmetic personalization.
Base upgrades should be VISUALLY DRAMATIC: from frontier outpost to fortified lunar citadel, with new visible architecture at milestones, not only an incrementing number. Owner and team decisions matter.
Upgrades should come from active Conquest participation or permitted premium acceleration where eligible, with no purchased unbeatable PvP stats or paywall on vital progression. Permanent base structures and gear cannot be stolen or deleted by enemy raids.

## 6. Resource/point economy
Three core Conquest resources: Lunar Alloy, Helium-3 and Parasite Biomass. These fund appropriate facilities, repairs, research, infrastructure, recipes and battle readiness; collection should be understandable and purposeful.
Separate Conquest Points (CP) for Conquest-specific buildings/systems from existing SPENDABLE Arcade points. Both must have clear earning/claim rules with authoritative backends. Do not mint points from client-side timers or unchecked clicks.
A Command Base may produce passive claimable existing points once every 24 hours, gated by explicit backend checks and carefully designed rates. This is not a limitless farm and must respect game economy safeguards.
Reputation reflects demonstrated service/campaign contributions, opening participation tiers and recognition without buying airdrop rankings.
Resource theft on successful PvP raids might later transfer ~5-15% of eligible unprotected stored resources, after balancing/approval. Defender victory means zero stolen; a Vault protects a meaningful fraction. Never take premium purchases, core gear, permanently built structures, or account currencies as raid loot. Exact rates remain unapproved.

## 7. Parasite balance law
NEVER dynamically scale Parasite combat stats to a player's upgraded tank, equipment, payment, crew power or observed performance. A named enemy type at a given authored difficulty has fixed published health, damage, speed and behavior; progression should visibly increase player advantage against earlier enemies.
Harder regions contain distinctly harder authored enemies, not the same enemy secretly growing to match the pilot. Strategy/intelligence, formations, environmental tactics and enemy variety should create difficulty.
PvP fairness requires meaningful choices, counterplay and fair target selection; no deceptive 1:1 parity matching that renders better equipment worthless.
AI/bot and player balance can later be iterated through reproducible simulations, ideally automated, but a paid bot service is optional, not a prerequisite.

## 8. Combat modes, assaults and orbital warfare
Preserve LUNAR's six Arcade modes, their loadouts, matches and rewards. Conquest reuses their capable equipment and combat elements without reducing this to an Arcade mode picker. Design special physical battles later:
- multi-phase assaults (outside defenses → breach → objective capture);
- convoy chases, supply line defense, high-ground and bridge wars;
- moving/special objectives with craters, cover and elevation;
- tactical deployment, meaningful team roles and time-sensitive attacks.
Orbital/aerial options envisioned: missile salvos, drone strikes, massive plasma bombs from orbiting command infrastructure, and other dramatic high-impact equipment. Make these hard-earned through later skill, coordination and commitment, not freely spammable paid win buttons. Their exact unlocking rules, damage and cooldowns are intentionally unapproved until that session.
Aim for battlefields that FEEL truly enormous; eventual goal of 25+ real human participants against bosses. Scale live infrastructure incrementally; never claim 25+ simultaneous live play works until tested.

## 9. Boss operations and drops
- Unique giant commanders/creatures/war machines have authored fixed strength and learnable attack patterns.
- Long-term goal: raids involving 25+ verified real human participants contributing meaningful damage/objective participation, not fake extra players.
- Rare premium-equipment jackpot probability per successfully defeated qualified top boss should be LESS than 5%; exactly ONE eligible winner when it occurs. Unsuccessful jackpot still awards one designated non-jackpot blueprint/item, with all qualified participants getting meaningful participation compensation.
- Publish odds, who is eligible, winner-selection algorithm, loot tables and anti-farm constraints. Do not invent odds or payouts before owner approval. Server settles results.
- These are actual battles involving War Machines, not passive timers or a loot spin with battle imagery.

## 10. Lunar Forge (advanced future design)
A possible premium, deeply personal long-term crafting/customization system: extensive combinations, permanently owned standout designs, dramatic cosmetics, and possibly LIMITED, balanced, craftable sidegrades.
Design later with strict counterplay and clear server verification. Do not implement now or assume exact stat gains, recurring paid seasons, resets, or ownership limits. This is a roadmap candidate, not an immediate license to add purchases.

## 11. Social systems and referral support
Players can cooperate across networks, help defend other bases, support massive operations, and compete in rankings/campaign accomplishments. Faction politics are OPTIONAL future depth, not required to ship first.
Referral networks should reward genuine play and contribution, NOT enforce recruitment or multilevel financial promises. All server data must be verifiable and abuse resistant.
A high player population goal is ambition, not proof of capacity. Load tests should target realistic milestones before 100,000-player assumptions.

## 12. Community memecoin, not mandatory utility
$LUNAR remains a COMMUNITY-DRIVEN MEMECOIN, NOT a mandatory gaming utility currency. The game is an entertainment and community-growth experience that may attract and retain community members independently of token speculation.
No mandatory token holding or purchasing to play Conquest. The airdrop may be a discovery/growth catalyst, not the sole long-term reason to participate.
Do not make promises of future token value, guaranteed income, asset profit, or investor returns. No newly invented tokenomics in Conquest sessions.

## 13. Monetization / player trust
Eligible paid base upgrade convenience/cosmetics may exist later; free paths to meaningful battle capabilities remain open. Permanent cosmetics, player recognition and attractive expressive options should not invalidate purchased or earned gear.
Maintain clear and honest drop probabilities and transparent purchasable product distinctions. No loot manipulation, fake server scarcity, misleading rank mechanics, or hidden pay-to-win equivalence.
Avoid unapproved "seasonal ascension" spending sinks, compulsory season passes, resets or faction prestige purchases.

## 14. UX and visual identity
Mobile-first. Dedicated dramatic Conquest hub beyond ordinary Arcade menu, with clear ENTER CONQUEST entry, World Intel/war overview, room for eventual deployment/briefings. No clutter of inactive paid features.
Game should feel epic, high-tech, sophisticated and anime-influenced where appropriate; use LUNAR's existing identity (dark graphite, gold, lunar-blue glow) and keep the user's approved gear appearances.
World graphics should evolve to meaningful depth, varied silhouettes, readable elevations, environmental scale, cinematic but usable camera, and gameplay-clear visuals rather than overloading small phone GPUs.
All meaningful battles and installations should be experienced in 3D world spaces, not flattened diagrams.

## 15. Technical architecture, reliability and mobile
Use existing web/Telegram/phone infrastructure and current Three.js tooling where sensible. Keep Conquest's independent world renderer separate from six-mode Arcade camera and simulation, but reuse shared validated loadout, gear and combat calculations.
Authoritative backend for economy/PvP/raid rewards/bases; future reliable server event scheduling and anti-abuse. Deterministic terrain IDs and geography; bounded chunk LOD, efficient instancing, batched and disposable resources, floating origin, safe account load/resume and performance degradation options.
Do not treat software Chromium browser checks as proof of physical iPhone Safari frame rate. Run tests + owner iPhone field validation.
Protect existing payments, account logic and data migrations against scope creep.

## 16. Focused phased Codex roadmap
Session 01: [COMPLETED, MERGED] Permanent 31,680x47,520 perspective 3D world foundation, deterministic streamed heightmaps, upper/lower real bridge, Conquest hub, movement, map and tests. Owner inspected it on an iPhone. Known limitations: primitive trees/town/vehicle, low-detail scene, relatively short fog draw, and movement feels ~3-5x slower.
Session 02: [NOW] Fix actual Arcade-equivalent equipped movement and mobile real-time motion; double useful visible distance safely; dramatically improve environmental coherence, vistas, forests, oxygen megastructures, settlements, highlands/craters; bridge/readability; substantially redesign Conquest hub and improve map/navigation presentation. Exactly preserve world dimensions and Arcade modes. See separate Session 02 brief, authoritative on exact work.
Session 03: First meaningful playable Conquest encounter/physical sector objective, initial persistent world/sector control contract and one verified loop. Specific scope to be designed and approved then.
Session 04: Command Base foundation, meaningful upgrades, visible growth, limited initial resource flows and claims, anti-farm verification.
Session 05: Fixed authored Parasite faction/sector threats and war progression; travel/deployment discovery and warp gates; world fronts and population-safe events.
Session 06: Richer Conquest-specific battles with multi-phase battles, raids, earned tactical support, missiles/drones/orbital plasma.
Session 07: Referrals/alliance assistance, base defense and resource raids, protected vault, balanced resource transfers.
Session 08: Large boss/raid orchestration, 25+ participation goal, audited rewards, rare jackpot.
Session 09: Optional Lunar Forge/advanced endgame/customization, eligible premium facilities and advanced world scaling.
The sequence is planning guidance, not binding implementation of unapproved specifications. Some features may split or consolidate after actual complexity/performance testing. Design the concrete next scope before each coding session.

## 17. Session 01 acceptance achieved vs remaining
Achievements: world extent, procedural generation across full rectangle, bridge levels, touch controls, tested chunk streaming, independent Conquest entrance, no Arcade regressions.
Outstanding: iPhone frame rate verification, long-distance route connectivity across wilderness, polished asset quality and regional density, fog/LOD pop, limited map gesture support, accurate active-loadout speed modifiers, visual scale and camera readability. Session 02 addresses the relevant foundation polish and usability.

## 18. Testing and future release discipline
- Test world dimension, procedural determinism, chunk seams, stable landmark IDs/placement, positive far-edge world generation, no stage reset, correct upper/lower geometry and collision, persistence and cleanup.
- Tests must distinguish physical traversal proof from reference crossing math; real obstacle-free path across 47,520 units isn't yet validated.
- Test mobile touch/controls and responsiveness; validate equipment parity against the existing Garage and Arcade calculator, including different chassis, speed core levels, engine upgrades and fitted mods.
- Re-run relevant existing six-mode regressions and shared economy tests if code changed. Capture actual in-game screenshots (not concept art).
- Work in a separate coding PR; no merge or production deployment of Session 02 without explicit owner approval.

## 19. Decision register
ALREADY FIXED: last-stand-on-Moon lore; intelligent infected Parasite humans originating on Earth; true 3D traversable terrain; giant expandable full-size Moon; no Parasite scaling; first six Arcade modes remain; $LUNAR memecoin independent from mandatory game utility; owner approves next detailed subsystem as encountered.
NOT YET FIXED: exact economics, territory claim formulas, resource production, upgrades, travel/warp schedules, specific giant-raid combat implementation, satellite/off-world spaces, large-scale live PvP architecture and all further monetization specifics.

END OF CONQUEST MASTER BLUEPRINT v1.2.
