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
| 4 | World, Resources & Airdrop Points: economy spec (`docs/economy/RESOURCE_ECONOMY.md`), Conquest airdrop points, 50k cap, terraform rework, minerals, hull armor plating | In progress |
| 5 | Base builder + Conquest Command hub page + full settler architecture | Next |
| 6 | Tank modifications + Science Lab research | Planned |
| 7 | Competitive: raid time-attack ladders, async base raids (brief 3.3/3.4), squad territory wars, daily warfront event, terraform-zone game modes | Planned |
| 8 | Payments certification (Stars, TON, SOL; website shop) — required before beta | Planned |
| 9 | Full game audit (use Fable) | Planned |
| 10 | Closed beta, then promotion (incl. public Conquest showcase page on the website) | Planned |

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

## Working rules

Follow `AGENTS.md` (lead agent, agent rule, safety gates). Consolidate related work into as few high-quality sessions as practical, commit and push after each phase, no soak runs, run affected tests plus one short browser journey, approved release (green CI → merge → deploy → verify `/pvp/health` and `version.json` → revert if broken). Must run smoothly on all devices.
