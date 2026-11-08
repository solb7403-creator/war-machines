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
| 5 | Base builder | Next |
| 6 | Tank modifications + Science Lab research | Planned |
| 7 | Competitive: raid time-attack ladders, async base raids (brief 3.3/3.4), squad territory wars, daily warfront event | Planned |
| 8 | Payments certification (Stars, TON, SOL; website shop) — required before beta | Planned |
| 9 | Full game audit (use Fable) | Planned |
| 10 | Closed beta, then promotion | Planned |

## Standing owner decisions

- **Airdrop:** Conquest earns airdrop points (active play + Command Base multiplier ~×1.25 + Daily Base Yield collected at the base). No pure AFK points. Daily cap 50,000, shared across all modes. Higher leagues earn more airdrop points.
- **Gear fairness:** never weaken existing gear, Moonbeam or Lunar Skin. Fairness comes from leagues and matchmaking, not nerfs. Mineral armor works at full strength in every mode and counts toward gear rating.
- **Chassis:** keep every existing chassis; armor plating is an added hull upgrade on top.
- **Minerals (6 tiers):** Ferrite Regolith (common), Ilmenite (uncommon), Armalcolite (rare), Tranquillityite (very rare), Selenite Glass (epic, reflective), Moonheart (legendary). Full common armor set ~3–4 days; each higher tier progressively harder; legendary from Meteor Strike events and top competitive rewards. Arcade/PvP wins also drop minerals.
- **Store:** points can't be bought. Only common + uncommon minerals are sellable; rare and above are earn-only. Planned levers: second builder, speed-ups, base cosmetics, raid shields, Lunar Pass perks. Checkout stays disabled until payments are certified.
- **RECALL:** 15-second channel that breaks on damage, 10-minute cooldown (5 minutes with premium Lunar Pass). Banking still happens physically at the base.
- **World:** barren Moon is the foundation; ~30–40% terraformed in logical zones (radiating from the Refuge/oxygen station, rivers from an ice crater, gradient to barren).

## Base builder vision (session 5)

The base is the engine of account power: production with storage caps (daily return), Science Lab (tank research), refinery (alloy from minerals), defenses (turrets, wall materials by mineral tier, shield generators) that protect production from async raids, a visible Command Power score, and visual construction with real customization. Deep enough to be entertaining for months, gated by Command Center level so it never overwhelms.

## Working rules

Follow `AGENTS.md` (lead agent, agent rule, safety gates). Consolidate related work into as few high-quality sessions as practical, commit and push after each phase, no soak runs, run affected tests plus one short browser journey, approved release (green CI → merge → deploy → verify `/pvp/health` and `version.json` → revert if broken). Must run smoothly on all devices.
