# Combat audit + repair: AI scaling, Survival, ghosts, focus fire

Branch `fix/combat-progression-balance`, based on `main` @ `9752967`. **Not deployed.**

## What was wrong (all in the code before this change)

| # | Defect | Where (before) | Since |
|---|---|---|---|
| 1 | **AI pilots copy your gear.** Every AI tank (enemies *and* wingmen) took your weapon multiplier (`ref.wmult`), chassis multiplier (`ref.chm`), cores and core levels, ±8%. Each crate, salvage roll or core level you earned made every bot stronger by the same factor. | `js/game.js` `mkBot` (`bwm=ref.wmult…`, `gems:ref.gems.slice()`); called with `me` from `js/match.js` `populatePreparedMatch` | first commit in history (24d8bab, 2026-10-23) |
| 1b | **Buying Moonbeam made every bot's gun Legendary.** Since Moonbeam's multiplier became `LEGENDARY_MULT` 1.48, the copy gave every AI pilot ×1.48 gun damage — more than any Epic roll (max 1.474). | `js/rules.js` `weaponOf` (moon `mult:LEGENDARY_MULT`) + defect 1 | b2e53e2 (2026-10-28) |
| 2 | **Survival megatank scales 1:1 with you.** Health = your cannon DPS × 110 s; its gun kills *your* max health in 100 s; stomps and shells hit for 18% / 8% of *your* max health. Hull upgrades, Titan and Lunar Skin gave zero protection against stomps/shells, and more damage only made the boss bigger. | `js/game.js` `mkBoss(ref,n)`, `bossHit` | 24d8bab |
| 3 | **Ghosts turn PvE into hidden max-gear PvP.** The match ticket brings offline pilots' real tanks from ±25% of your power and puts them in *enemy* seats first (up to 2). A strong player's AI match could hold two near-max human builds on the other side. | `worker/src/eco.js` `pickGhosts` (`GHOST_BAND`), `js/match.js` `placeGhosts` | 24d8bab |
| 4 | **Best-of-3 counter-switch against pilots who can't answer.** After each round every AI pilot may switch to the chassis that counters yours (50%), even if you own only one chassis class and can't switch back. A stock pilot won 19% of 1v1 Arena series (16 seeds, AI-grade pilot) against an *identical* tank. | `js/game.js` `endRound` | 24d8bab |
| 5 | **Pile-ons in Bounty and Last Standing.** The spread rule ("a foe costs more for every ally already on it") didn't apply in Bounty (bounty score only) or in free-for-all (no allies). Measured: 2+ AI locked on you 27–50% of the time in Bounty, 38% in Last Standing. | `js/game.js` `botTarget` | 24d8bab |

Checked and **correct** (no change needed): the active lab bay is what `labLoadout`/`setLoadout` freeze into the match ticket and the phone fields (two bays tested); `tankOf` applies Moonbeam 118 DPS, the Legendary super multiplier, Lunar Skin +8% health and damage, chassis rarity; Gold Plate is paint only (identical stats and power); one hit radius for every tank; client/server tank and power formulas are identical (`gear-combat.mjs` parity, 6,000+ cases). PvP leagues (`worker/src/pvp.js`) match humans by power and are untouched. The graphics/gear release (#22) did not touch `game.js`, `rules.js` or `match.js`.

Every enemy-scaling input found: health and damage (gear copy + `pScale` 0.92–1.08, 0.80–0.96 in your first 3 matches), weapon/chassis class (random; never a counter in your first 10 matches; `fairField` deals counters fairly), rarity aura (copied), cores (copied), upgrades (not copied — the only reason some gear still helped), team size (`hpScale`: ×n health), enemy count (fixed per mode, also fixed by the server's proof roster check), boss (defect 2), ghosts (defect 3), round switch (defect 4), targeting (defect 5), dodge (bots dash/shield out of a seen super half the time — unchanged), line of sight (bots aim at your last-seen spot, humans always see — unchanged), spawn timing/respawns (unchanged).

## What changed

- **AI levels** (`js/rules.js` `AI_TIERS`, `aiPower`, `aiLevel`, `aiLoadout`): 25 authored AI loadouts (starter → Epic with upgrades and level-5 cores, power 68 → 200, steps ≤ 8%). The AI fields the strongest one at or under **AI power = 68 × (your power / 68)^0.75**. A starter tank meets starter AI exactly as before; above that the AI grows slower than you, so every upgrade widens your edge (your power ÷ AI power: common 1.03, rare 1.11, Epic 1.23, Legendary kit 1.32). AI pilots never copy your gear, upgrades or cores. `mkBot` builds them through the same `tankOf` stat math as every tank. Wingmen use the same level.
- **Visible:** the VS screen's existing "AI opponents" tag now reads "AI opponents · AI power 147, yours 204"; the wiki FAQ explains it. No new mode or screen.
- **Why 0.75** (measured, real matchmaking, 24 seeds × 11 mode/size setups, casual pilot): average win rate starter → common → rare → Epic → Legendary kit = 58 / 61 / 68 / 80 / 92%. Exponent 1.0 (AI = your power) cancels progression again (2v2: stock 56% → Epic 44%); 0.8 and 0.7 each left one mode where Epic trailed Rare by 17–21 points; 0.75 had none over 15. Fixed league tiers were rejected: all real gear sits in Rookie/Pilot (max legal power 240), so rare players would face starter AI and win ~100%.
- **Survival megatank** (`mkBoss(ref,n,ai)`): tuned to the reference tank (Vanguard + Pulse) of an AI level at or under your power (`AI_BOSS_EXP` 1.0), never to your tank. Stomps and shells hit for a share of that reference health, so hull/Titan/skin now protect you. A starter tank meets the exact same megatank as before.
- **Ghosts:** AI-match tickets only bring ghosts at 0.70–0.95× your power (`AI_GHOST_LO/HI`, server `pickGhosts` band), the phone re-checks the cap, and at most one ghost takes an enemy seat (the rest join your team). Live rooms keep their existing band. Ghosts stay labeled.
- **Counter-switch** only when you can answer it (`MM.cp`: you own 2+ chassis classes). Live matches unchanged.
- **Targeting:** the spread penalty now also applies in Last Standing (+4 per other tank already on that target) and Bounty (half weight). Bots still pick nearer/weaker/retaliation targets.
- **Practice range** Survival uses the same fixed megatank for its opponent preset (`RANGE_ENGINE_VERSION` s4.3).
- Unchanged: live PvP (human seats, leagues, live AI fill-ins still mirror the middle human), enemy counts, rewards, prices, economy, controls, graphics, modes, Garage/Engineer, maps, everyone's gear.

## Measurements

RESULTS_PLACEHOLDER

## Tests

`dev/tests/combat-balance.mjs` (new, in the Equipment Balance workflow): AI ladder powers, AI never above you, roster independent of your gear, megatank independent of your tank, Moonbeam/Lunar Skin/Gold Plate/chassis tiers, two-bay loadout, same-encounter monotonic win rates (4 encounters), all modes × sizes × maps finish (best of 3 resolves, Survival win = megatank down), ghost cap. Full measurement: `dev/tests/combat-sim.mjs`, `combat-grid.mjs`, `combat-ghosts.mjs`, `combat-report.mjs` (use `COMBAT_SRC=<checkout of main>` for "before").

The pilot in these sims is the game's own AI driving your tank with the human's always-aware turret ("casual": no reflex dodges, always presses in; "expert": full bot tactics). It is a stand-in, not a person. These are simulations, not iPhone tests.
