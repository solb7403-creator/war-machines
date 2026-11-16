# Session 6 research: comparable games (first hour, feel, loot, daily loops)

One research agent, ~70 web searches (standard mode), Nov 16 2026. Page fetches were not used, so figures rest on search-result
summaries; "unconfirmed" marks community data or a single secondary source. Full source list: the agent's report (kept in the
session record); the main sources are listed per topic below.

## What the best games do, and what Session 6 takes from each

| Topic | Finding (source) | What LUNAR does |
|---|---|---|
| First hour | Strong FTUEs engage within the first minute, no heavy tutorial (Liquid & Grit, 26 top apps) | First shot within seconds of spawning; the opening is a 15 s radio over gameplay, not a text wall |
| First hour | Clash of Clans: you place a Cannon, goblins attack, your Cannon holds | Something is yours early: the first plate on your hull by minute ~6, your town by minute ~20 |
| First hour | Clash Royale: first three battles vs AI, effectively unlosable; a chest + upgrade between battle 1 and 2 | The first mission is staged so a pilot who follows the arrow and holds FIRE wins; first loot and first plate sit between mission 1 and mission 2 |
| First hour | One tap before the first shot (FTUE practice) | The very first DEFEND THE OXYGEN LINE starts on one tap (the radio already briefed it); later runs show the briefing |
| First hour | Progressive disclosure: Habby greys out features, Genshin gates by rank, Roblox docs: tutorial on first use | HUD at minute 0 = NEXT chip, HULL, HEAT; AIRDROP, BASE, METEOR, CONTRACTS lines appear on first use (state in the save) |
| Benchmarks | GameAnalytics 2026 (~16k games): D1 median ~22%, top 10% ~40%; D7 ~4% / ~12%; D30 ~0.7% / ~4% | Targets in the analytics tab: D1 35-40%, D7 12%, D30 4%; every first-hour step is a counted event |
| Feel | Overwatch: distinct hit, crit and elimination sounds | Separate hit (your weapon's own hit), kill, boom and loot sounds; never one sound for two events |
| Feel | Fortnite white / yellow crit numbers; Apex armour colours + colourblind fix; merge rapid hits (practitioners) | Damage numbers: white, gold for SUPER hits, merged per target, max 3, 0.7 s |
| Feel | Hit flash 2-6 frames (~33-100 ms), set in ms so 120 Hz phones keep it (practitioners, unconfirmed) | 80 ms hit flash by a uniform swap, timed in ms |
| Feel | Halo multi-kill window 4 s | Kill ticker stacks kills inside 4 s (DESTROYED · INTERCEPTOR ×2) |
| Feel | Rarity ladder Angband -> Diablo -> WoW; Diablo III legendary beam + clang; PoE filters per tier | One colour ladder (grey, green, cyan, violet, gold) for glow, label, flyout, card and sound |
| Feel | Apple HIG: haptics causal, sparing, never the only signal; Telegram HapticFeedback; iOS Safari ignores vibrate | Light haptic on a kill (owner's brief), success notification on a rare+ drop; every haptic also has sound + visual |
| Feel | Empires & Allies: reward text in the colour of the meter it feeds | Loot flies to the HUD in its rarity colour; minerals fly to the cargo line |
| Loot | Genshin hard pity 90; Destiny raid exotics bad-luck stacks (a 2021 bug under-counted them) | Server-side pity counters, shown in the collection screen and tested |
| Loot | Diablo Immortal backlash: pity cannot rescue power that is sold | Nothing that drops is ever sold (node test: loot ids disjoint from every store and catalog) |
| Loot | Brawl Stars Starr Drops: earned randomness with published odds (50/28/15/5/2%) | Every rate and pity counter in the wiki's Loot section |
| Loot | Apple 3.1.1, Google Play, China 2017, Korea 2024: odds disclosure | Drops are never sold (not loot boxes), and the full table is published anyway |
| Loot | Tarkov / Arena Breakout protect only a container; Bungie on Marathon: "death was the only step", now keeps inventory on death | Decision 5: parts, trophies, fragments and consumables are account-bound on pickup; only carried minerals are at risk |
| Daily | Hearthstone 2024: tripling weekly requirements made players play less; reverted | Every War Order fits one or two normal sorties |
| Daily | WoW "Rested 200%" liked vs "Fatigued 50%" disliked (same maths) | The repeat taper is framed as fresh runs: "100% for your first 3 runs today, then 60%, then 40%" |
| Daily | Clash of Clans collectors fill in 24 h then stop; Egg, Inc. shows the offline cap | Production x3 with storage x2 and "+N since you left" on the hub |
| Daily | GameAnalytics median session ~4.5-6 min, top quarter 8-9 min | A full sortie (mission + bank) fits 3-5 minutes |
| World | Left 4 Dead's AI Director: build-up, peak, relax | Incursions after 10 quiet minutes; hunter packs on patrol loops; vein ambushes in rings 3-4 |

Sources (main): liquidandgrit.com (FTUE), pocketgamer.biz (Clash Royale FTUE, Korea odds), mobilegamer.biz (Habby), create.roblox.com
onboarding docs, gamigion.com / gameindustrylibrary.com (GameAnalytics 2026), gdcvault.com (Overwatch), halopedia.org (Double Kill),
gameinformer.com (rarity colours), developer.apple.com HIG (haptics), docs.telegram-mini-apps.com (HapticFeedback), gamedeveloper.com
(Empires & Allies), library.keqingmains.com (Genshin), devtrackers.gg (Destiny 2), deconstructoroffun.com + supercell.com (Brawl Stars),
pcgamer.com (Hearthstone weekly quests), psychologyofgames.com (WoW rested), clashofclans.fandom.com, developer.valvesoftware.com (L4D Director).
