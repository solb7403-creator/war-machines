# LUNAR: War Machines — owner roadmap

Owner-approved blueprint (Nov 7, 2026). Every Claude Code / Codex session reads this with `AGENTS.md` and the latest `docs/conquest/IMPLEMENTATION_CHECKPOINT.md`. The owner's direct instructions override older docs and AI-written comments. **Update the status column when a session ships.**

## Goal

An exceptional sci-fi warfare game with a large, loyal, highly engaged community that enjoys spending money to expand their gameplay. Players always have something meaningful to progress toward: stronger gear, better bases, exploration, rewards, competition, long-term goals. The $LUNAR airdrop is the main focus until TGE; every mode feeds it and one shared progression, so LUNAR feels like one complete game.

## Session order

| # | Session | Status |
|---|---|---|
| 1 | Conquest Living War + Territory/Endgame (PR #53, #54) | Shipped Nov 6 |
| 2 | Conquest playtest fixes: driving, NAVIGATE, fast travel, harder raids, RECALL (PR #57) | Shipped Nov 7 |
| 3 | Graphics overhaul: Neon Frontline (PR #59) | Shipped Nov 7 |
| 4 | World, Resources & Airdrop Points: economy spec (`docs/economy/RESOURCE_ECONOMY.md`), Conquest airdrop points, 50k cap, terraform rework, minerals, hull armor plating (PR #69, merge `a3ee186`, build `20261108113127`) | Shipped Nov 8 |
| 5 | Base builder + Conquest Command hub page + full settler architecture (brief: `docs/conquest/SESSION_05_BASE_BUILDER_FULL_PROMPT.txt`; own plot + site choice, real timers short early, Nov 8 playtest fixes first; ore veins run dry) (PR #75, merge `7ebb2bc`, build `20261108210830`) | Shipped Nov 8 |
| 5B | Town Defense: the base becomes a town (grows with CC), vital buildings as raid objectives, whole-town raids, walls 600→2,000 cells + earned/bought extensions, wall composite + Foundry + ore blends (strength/durability/reflect), 11 turret types, 2-3 new terrain templates (brief: `docs/conquest/SESSION_05B_TOWN_DEFENSE_FULL_PROMPT.txt`) | Next |
| 6 | Tank modifications + Science Lab research + Conquest audio & weather pass (the Science Lab building already exists on the plot) | Next |
| 7 | Competitive: live airdrop standing on the hub ("You're #842, 1,200 pts to top 800") with visible anti-cheat, raid time-attack ladders, async base raids (brief 3.3/3.4), squad territory wars, daily warfront event, terraform-zone game modes | Planned |
| 7.5 | Graphics 2.0: lighting (shadows, ambient occlusion, per-zone color grade), post-processing (bloom, depth fog, heat haze), higher-detail Blender models and PBR textures, upgraded VFX; quality tiers (website top tier as main platform, tuned phone HIGH/LOW) | Planned |
| 7.8 | Security (owner's Nov 1 Session 3, restored Nov 8): scrub his email from git history, scan the repo for exposed secrets, rotate the Telegram bot token and the Firebase secret | Planned |
| 8 | Payments certification (Stars, TON, SOL; website shop) — required before beta | Planned |
| 9 | Full game audit (use Fable) | Planned |
| 10 | Closed beta, then promotion (incl. public Conquest showcase page on the website) | Planned |

## Fix queue (owner reports; schedule into the next session that fits)

- **ESSENTIAL — Arcade AI matches the best gear (owner, Nov 8; 4th recurrence after 4 separate fixes):** every arcade AI is about as strong as the best gear in the game, so gear is pointless; buyers of Epic/legendary gear (or players who earned Epic with points) will feel scammed and quit. Own session. Live evidence: Bounty 1v1 win with Moonbeam in Lunar Legend league, 16,385 damage dealt vs 16,160 taken. Start from the Oct 31 combat-repair brief (bot gear copying in `mkBot`, ghosts near player power, league-scaled bots) and find what reintroduced it; add a regression test that fails if starter→Epic→legendary gear stops winning materially more, so it cannot come back a 5th time.
- **Find My Base (owner, Nov 8): FIXED** in Checkpoint 25 (`claude/find-my-base`): drivable HUD route home, gold ⌂ MY BASE button, 30 m arrival zone that opens the base, one name everywhere. Owner dev mode (unlimited resources, owner account only) shipped with it.
- **Desktop keyboard driving (owner, Nov 8):** on a computer, players cannot move their tank with the keyboard, so Conquest is unplayable on desktop. The code reads WASD/arrows (`view.js` keys → `controlInput`), and the living-war CI bot drives by keyboard in headless Chromium, so the break is likely environment-specific: focus held by a button or dialog after ENTER CONQUEST, Telegram Desktop / website embedding, or the website boot path. Reproduce on the real website and Telegram Desktop first, fix, and add a desktop keyboard journey (website build, real focus flow) to CI. Also show on-screen desktop hints (WASD move, mouse aim, Space fire, Shift dash, F shield, G gather, C scan).

## Standing owner decisions

- **Airdrop:** Conquest earns airdrop points (active play + Command Base multiplier ~×1.25 + Daily Base Yield collected at the base). No pure AFK points. Daily cap 50,000, shared across all modes. Higher leagues earn more airdrop points.
- **Gear fairness:** never weaken existing gear, Moonbeam or Lunar Skin. Fairness comes from leagues and matchmaking, not nerfs. Mineral armor works at full strength in every mode and counts toward gear rating.
- **Chassis:** keep every existing chassis; armor plating is an added hull upgrade on top.
- **Minerals (6 tiers):** Ferrite Regolith (common), Ilmenite (uncommon), Armalcolite (rare), Tranquillityite (very rare), Selenite Glass (epic, reflective), Moonheart (legendary). Full common armor set ~3–4 days; each higher tier progressively harder; legendary from Meteor Strike events and top competitive rewards. Arcade/PvP wins also drop minerals.
- **Store:** points can't be bought. Only common + uncommon minerals are sellable; rare and above are earn-only. Planned levers: second builder, speed-ups, base cosmetics, raid shields, Lunar Pass perks. Checkout stays disabled until payments are certified.
- **RECALL:** 15-second channel that breaks on damage, 10-minute cooldown (5 minutes with premium Lunar Pass). Banking still happens physically at the base.
- **World:** barren Moon is the foundation; ~30–40% terraformed in logical zones (radiating from the Refuge/oxygen station, rivers from an ice crater, gradient to barren).

## Base builder vision (session 5)

The base is the engine of account power and must feel personal, very visual and involved in every section, without overwhelming (buildings unlock by Command Center level, guided first build).

- **Yours from day one:** pick a site (crater rim = minerals, river delta = biomass, ridge = defense sightlines, canyon = hard to raid); banner designer (shape, colors, emblem) shown on base and tank; base theme (lighting color, finish, decorations).
- **Building is a show:** build mode with top-down camera, pinch zoom, grid snapping; hologram blueprints, drones and scaffolding assemble buildings live; every upgrade level visibly changes the building.
- **Living buildings:** Command Center (gates tiers); Refinery (visible conveyor, minerals in, alloy out); Biodome (plants grow, biomass); Science Lab (holographic research tree for tank mods/upgrades, timers); Hangar (owned tanks on display); Trophy Hall (defeated commanders, legendary minerals, ladder trophies); crew and rovers moving around the base.
- **Defense you design and watch:** drag-to-draw walls with visibly different mineral tiers (regolith, titanium, Armalcolite, reflective Selenite glass, glowing Moonheart); turrets (cannon, laser, missile/anti-drone, mortar) with range rings while placing; shield generators; Defense Drill (simulated Parasite attack you watch); raid log with replays + revenge once async raids exist.
- **Social pride:** visit squadmates' and top players' bases; Share my base card with invite link; visible Command Power score; weekly Base of the week.
- **Loops:** production with storage caps and Daily Base Yield (daily return), research/build timers, long-term levels/wall tiers/trophies, defenses vs raids.
- **Revenue:** base themes, wall skins, banners, decorations, second builder, speed-ups (never direct points or rare+ minerals).
- **Performance:** instancing/LOD so a fully built base stays smooth on phones; HIGH/LOW/2D fallback.

## Settler architecture (session 5, shares the base builder's modular kit)

Terraformed colony towns and farms belong to civilian settlers, a group distinct from the military. Full identity, not a recolor: weathered prefab domes and habitat modules, patched/scrap-repaired walls, salvaged panels, timber/composite add-ons, rooftop gardens, water towers, greenhouses, workshops, a market square, a meeting hall, homes with porches, hand-painted signs and murals; painted, faded and rusted surfaces; warm amber lights, lanterns, string lights, chimney smoke; laundry lines, crates, carts, farm machinery, small vehicles, settlers and rovers moving about, livestock pens. The Refuge, Command Bases and frontier wall stay military (angular, armored, cyan Neon Frontline); the core town mixes both (military checkpoints and depots among settler streets). Modular instanced kit with LODs. Mission: settlements players remember and want to protect.

## Conquest Command hub (session 5, expanded in session 7)

Conquest gets its own dedicated page in the game, not just a mode button, and it must look spectacular: a cinematic live 3D hero (your tank and base on the Moon, Earth on the horizon, Neon Frontline style) with the warfront status, your base status and Daily Base Yield meter, active events (Meteor Strike timer, invasions), quick actions (deploy, fast travel, base, research) and, from session 7, ladders, squad wars and the daily warfront event. Same quality bar on phone and desktop, fast first paint.

## Terraform-zone game modes (session 7)

Terraformed zones get modes unique to them, distinct from the barren Moon's raids, mining and Meteor Strikes: Colony Defense (Parasite waves assault the frontier wall and farms; defend with colony turrets), Bridge Assault (capture and hold river bridges), Convoy Run (escort supply convoys along colony roads under ambush), Blight Purge (clear spreading blight; the zone visibly recovers), Forest Hunt (line-of-sight fights through forests). Feed the shared progression and airdrop points like other Conquest content.

## Terraform audit additions (Nov 8, 2026)

Gaps found auditing the terraformed zones against the goal, assigned to sessions:

- **Audio (session 6):** Conquest has no sound today. Add zone ambience (barren: near-silence, suit hum, distant impacts; terraformed: wind in grass, water, settler life, machinery; colony core: activity), weapon/impact/explosion sounds shared with Arcade, UI and reward sounds, music stingers for raids, invasions and victories. Mobile-friendly, mute toggle.
- **Weather (session 6):** dust storms on the barren Moon (reduced visibility, a real tactical event); rain and fog banks inside terraformed zones (they have air). Telegraphed, capped effect budgets.
- **Living terraform (session 7):** the green frontier moves with the shared warfront. Holding sectors activates new atmosphere pylons and grows zones; failed defenses let blight spread and grass die visibly. Players see their war change the Moon.
- **Settler contracts and reputation (session 7):** settlers post contracts in their towns (deliver biomass, escort harvests, defend farms, clear blight). Settler reputation unlocks settler vendors, cosmetics and base decorations.
- **Life (session 5, with settler architecture):** engineered livestock, birds and small fauna in terraformed zones; settlers and rovers with daily routines.
- **Region map (session 5):** terraformed zones, settlements, roads and the military/settler split drawn clearly on the region map.

## Working rules

Follow `AGENTS.md` (lead agent, agent rule, safety gates). Consolidate related work into as few high-quality sessions as practical, commit and push after each phase, no soak runs, run affected tests plus one short browser journey, approved release (green CI → merge → deploy → verify `/pvp/health` and `version.json` → revert if broken). Must run smoothly on all devices.
