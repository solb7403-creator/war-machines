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
| 5 | **Pile-ons in Bounty.** The spread rule ("a foe costs more for every ally already on it") didn't apply in Bounty (bounty score only), so a big bounty drew the whole enemy team. Measured: 2+ AI locked on you 29% (starter) to 50% (Legendary) of the time. | `js/game.js` `botTarget` | 24d8bab |

Checked and **correct** (no change needed): the active lab bay is what `labLoadout`/`setLoadout` freeze into the match ticket and the phone fields (two bays tested); `tankOf` applies Moonbeam 118 DPS, the Legendary super multiplier, Lunar Skin +8% health and damage, chassis rarity; Gold Plate is paint only (identical stats and power); one hit radius for every tank; client/server tank and power formulas are identical (`gear-combat.mjs` parity, 6,000+ cases). PvP leagues (`worker/src/pvp.js`) match humans by power and are untouched. The graphics/gear release (#22) did not touch `game.js`, `rules.js` or `match.js`.

Every enemy-scaling input found: health and damage (gear copy + `pScale` 0.92–1.08, 0.80–0.96 in your first 3 matches), weapon/chassis class (random; never a counter in your first 10 matches; `fairField` deals counters fairly), rarity aura (copied), cores (copied), upgrades (not copied — the only reason some gear still helped), team size (`hpScale`: ×n health), enemy count (fixed per mode, also fixed by the server's proof roster check), boss (defect 2), ghosts (defect 3), round switch (defect 4), targeting (defect 5), dodge (bots dash/shield out of a seen super half the time — unchanged), line of sight (bots aim at your last-seen spot, humans always see — unchanged), spawn timing/respawns (unchanged).

## What changed

- **AI levels** (`js/rules.js` `AI_TIERS`, `aiPower`, `aiLevel`, `aiLoadout`): 25 authored AI loadouts (starter → Epic with upgrades and level-5 cores, power 68 → 200, steps ≤ 8%). The AI fields the strongest one at or under **AI power = 68 × (your power / 68)^0.75**. A starter tank meets starter AI exactly as before; above that the AI grows slower than you, so every upgrade widens your edge (your power ÷ AI power: common 1.03, rare 1.11, Epic 1.23, Legendary kit 1.32). AI pilots never copy your gear, upgrades or cores. `mkBot` builds them through the same `tankOf` stat math as every tank. Wingmen use the same level.
- **Visible:** the VS screen's existing "AI opponents" tag now reads "AI opponents · AI power 147, yours 204"; the wiki FAQ explains it. No new mode or screen.
- **Why 0.75** (measured, real matchmaking, 24 seeds × 11 mode/size setups, casual pilot): average win rate starter → common → rare → Epic → Legendary kit = 58 / 61 / 68 / 80 / 92%. Exponent 1.0 (AI = your power) cancels progression again (2v2: stock 56% → Epic 44%); 0.8 and 0.7 each left one mode where Epic trailed Rare by 17–21 points; 0.75 had none over 15. Fixed league tiers were rejected: all real gear sits in Rookie/Pilot (max legal power 240), so rare players would face starter AI and win ~100%.
- **Survival megatank** (`mkBoss(ref,n,ai)`): tuned to the reference tank (Vanguard + Pulse) of an AI level at or under your power (`AI_BOSS_EXP` 1.0), never to your tank. Stomps and shells hit for a share of that reference health, so hull/Titan/skin now protect you. A starter tank meets the exact same megatank as before.
- **Ghosts:** AI-match tickets only bring ghosts at 0.70–0.95× your power (`AI_GHOST_LO/HI`, server `pickGhosts` band), the phone re-checks the cap, and at most one ghost takes an enemy seat (the rest join your team). Live rooms keep their existing band. Ghosts stay labeled.
- **Counter-switch** only when you can answer it (`MM.cp`: you own 2+ chassis classes). Live matches unchanged.
- **Targeting:** the spread penalty now also applies in Bounty (half weight): 2+ AI on you 29% → 8% (starter), 50% → 16% (Legendary). Last Standing is unchanged: a free-for-all spread rule halved pile-ons there but measured worse places for starter-to-rare pilots (#4.2 → #5.0), so it was dropped.
- **Practice range** Survival uses the same fixed megatank for its opponent preset (`RANGE_ENGINE_VERSION` s4.3).
- Unchanged: live PvP (human seats, leagues, live AI fill-ins still mirror the middle human), enemy counts, rewards, prices, economy, controls, graphics, modes, Garage/Engineer, maps, everyone's gear.

## Measurements

All numbers: the real `js/rules.js` + `js/game.js` + `js/match.js`, seeded, 24 seeds per cell (maps rotate Moonbase / Overpass / Longshot / Crater Field), "casual" pilot, 30 Hz steps. **Before** = `main` @ 9752967, **after** = this branch; identical seeds, maps and opponents' random draws. Win rate counts a draw as half; Last Standing shows win rate and average place (of 6). 5,280 matches in the four ladder runs below, every one finished (no softlock, no non-finite health).

Average over the 11 setups (starter → common → rare → Epic → Legendary kit):

| Ladder | Before | After |
|---|---|---|
| Gear + upgrades + cores (a pilot who also levels up) | 55 / 59 / 74 / 87 / 90% | 59 / 61 / 69 / 79 / 92% |
| Gear only (items, starter upgrades — e.g. a buyer) | 55 / 55 / 59 / 71 / 83% | 59 / 64 / 68 / 79 / 87% |

Gear ladder: starter = stock Vanguard/Pulse; common = T0 ×1.08 rolls + hull/cannon 1; rare = T1 + 2/2/1/1, cores Lv2; Epic = Pulse T2 + Epic Titan + 3/3/2/2/1, Lv3; Legendary kit = Moonbeam + Lunar Skin + Epic Titan (Colossus) ×1.10 + Gold Plate + a full 14-level build, Lv4, owns all three chassis. Powers 68 / 77 / 105 / 154 / 204.

### Gear + upgrades + cores, by mode

| Mode | stock before → after | common before → after | rare before → after | epic before → after | legend before → after |
|---|---|---|---|---|---|
| arena 1v1 | 13% → 50% | 42% → 79% | 75% → 83% | 100% → 96% | 100% → 100% |
| arena 2v2 | 54% → 54% | 63% → 54% | 75% → 58% | 96% → 92% | 100% → 100% |
| arena 3v3 | 50% → 50% | 50% → 42% | 71% → 42% | 100% → 75% | 100% → 100% |
| zone 2v2 | 63% → 63% | 63% → 58% | 88% → 71% | 88% → 79% | 83% → 83% |
| zone 3v3 | 67% → 63% | 67% → 75% | 88% → 96% | 83% → 83% | 88% → 92% |
| crystal 2v2 | 50% → 50% | 46% → 42% | 67% → 58% | 79% → 79% | 75% → 75% |
| bounty 2v2 | 46% → 52% | 75% → 56% | 83% → 73% | 94% → 71% | 100% → 100% |
| royale 1v1 | 8% (#4.21) → 8% (#4.21) | 8% (#3.92) → 8% (#4.21) | 29% (#3.25) → 17% (#3.54) | 75% (#1.38) → 33% (#2.58) | 88% (#1.13) → 63% (#1.67) |
| boss 1v1 | 83% → 83% | 75% → 83% | 88% → 79% | 83% → 88% | 92% → 100% |
| boss 2v2 | 79% → 79% | 75% → 79% | 75% → 96% | 88% → 92% | 79% → 100% |
| boss 3v3 | 92% → 92% | 83% → 92% | 79% → 83% | 75% → 79% | 83% → 96% |

Focus fire (share of samples with 2+ enemies locked on you, while 2+ alive) and ally share of your team's damage, stock / legend:
| Mode | focus2+ before | focus2+ after | ally share before | ally share after | first death is you, before → after |
|---|---|---|---|---|---|
| arena 1v1 | - / - | - / - | 0 / 0 | 0 / 0 | 0.5→0.5 (stock), 0→0 (legend) |
| arena 2v2 | 0.016 / 0 | 0.016 / 0.002 | 0.531 / 0.265 | 0.531 / 0.33 | 0.458→0.458 (stock), 0→0 (legend) |
| arena 3v3 | 0.021 / 0 | 0.021 / 0.004 | 0.652 / 0.416 | 0.652 / 0.475 | 0.25→0.25 (stock), 0→0 (legend) |
| zone 2v2 | 0.067 / 0.055 | 0.067 / 0.053 | 0.504 / 0.266 | 0.504 / 0.345 | 0.227→0.227 (stock), 0→0 (legend) |
| zone 3v3 | 0.051 / 0.067 | 0.051 / 0.065 | 0.665 / 0.405 | 0.666 / 0.508 | 0.318→0.333 (stock), 0→0.048 (legend) |
| crystal 2v2 | 0.093 / 0.103 | 0.093 / 0.08 | 0.475 / 0.288 | 0.475 / 0.335 | 0.5→0.5 (stock), 0→0.063 (legend) |
| bounty 2v2 | 0.292 / 0.503 | 0.076 / 0.16 | 0.461 / 0.253 | 0.446 / 0.317 | 0.292→0.167 (stock), 0→0 (legend) |
| royale 1v1 | 0.231 / 0.159 | 0.231 / 0.2 | 0 / 0 | 0 / 0 | 0.125→0.125 (stock), 0→0 (legend) |
| boss 1v1 | - / - | - / - | 0 / 0 | 0 / 0 | 0.167→0.167 (stock), 0.083→0 (legend) |
| boss 2v2 | - / - | - / - | 0.377 / 0.222 | 0.377 / 0.25 | 0.583→0.583 (stock), 0.333→0 (legend) |
| boss 3v3 | - / - | - / - | 0.631 / 0.36 | 0.631 / 0.412 | 0.75→0.75 (stock), 0.458→0.042 (legend) |

Survival: megatank damage dealt (%) and fight length (s), before → after:
- boss 1v1: stock 96.3%/59s → 96.3%/59s, common 94%/60s → 96.7%/60s, rare 97.6%/54s → 96.4%/52s, epic 96.7%/47s → 98.4%/47s, legend 98.7%/39s → 100%/34s
- boss 2v2: stock 94.7%/80s → 94.7%/80s, common 95%/83s → 95.9%/80s, rare 98%/76s → 99.3%/72s, epic 96.4%/66s → 98.5%/62s, legend 98.3%/64s → 100%/47s
- boss 3v3: stock 99.6%/86s → 99.6%/86s, common 95.7%/87s → 98.4%/87s, rare 95.4%/85s → 97.7%/79s, epic 96.4%/79s → 95.9%/70s, legend 96.1%/75s → 100%/54s


### Gear only, by mode

| Mode | stock before → after | common before → after | rare before → after | epic before → after | legend before → after |
|---|---|---|---|---|---|
| arena 1v1 | 13% → 50% | 25% → 79% | 38% → 83% | 79% → 100% | 100% → 100% |
| arena 2v2 | 54% → 54% | 54% → 63% | 50% → 79% | 88% → 83% | 96% → 100% |
| arena 3v3 | 50% → 50% | 42% → 46% | 54% → 67% | 71% → 92% | 100% → 100% |
| zone 2v2 | 63% → 63% | 58% → 67% | 79% → 58% | 75% → 75% | 83% → 92% |
| zone 3v3 | 67% → 63% | 79% → 83% | 83% → 67% | 83% → 96% | 92% → 88% |
| crystal 2v2 | 50% → 50% | 46% → 54% | 50% → 54% | 54% → 63% | 75% → 71% |
| bounty 2v2 | 46% → 52% | 48% → 69% | 52% → 65% | 81% → 77% | 87% → 87% |
| royale 1v1 | 8% (#4.21) → 8% (#4.21) | 4% (#4.58) → 4% (#4) | 4% (#4.79) → 13% (#4.38) | 17% (#3.67) → 25% (#2.71) | 58% (#1.79) → 42% (#2.25) |
| boss 1v1 | 83% → 83% | 79% → 75% | 79% → 92% | 83% → 88% | 83% → 96% |
| boss 2v2 | 79% → 79% | 83% → 83% | 83% → 83% | 67% → 92% | 71% → 100% |
| boss 3v3 | 92% → 92% | 83% → 79% | 79% → 83% | 83% → 83% | 63% → 85% |

### Ghosts (Legendary kit, power 204, offered two power-240 max-gear ghosts; 12 seeds)

Before:
```
you 204 ghost 240
arena 1v1   no ghosts                  win 1.00 enemy ghosts/match 0.00 taken 2500 
arena 1v1   2 max-gear ghosts offered  win 0.08 enemy ghosts/match 1.00 taken 10432 
arena 3v3   no ghosts                  win 1.00 enemy ghosts/match 0.00 taken 6275 
arena 3v3   2 max-gear ghosts offered  win 0.00 enemy ghosts/match 2.00 taken 14264 
royale 1v1  no ghosts                  win 0.83 enemy ghosts/match 0.00 taken 6205 place 1.17
royale 1v1  2 max-gear ghosts offered  win 0.42 enemy ghosts/match 2.00 taken 8454 place 1.75
```
After (never seated: over 0.95x your power):
```
you 204 ghost 240
arena 1v1   no ghosts                  win 1.00 enemy ghosts/match 0.00 taken 4119 
arena 1v1   2 max-gear ghosts offered  win 1.00 enemy ghosts/match 0.00 taken 4119 
arena 3v3   no ghosts                  win 0.92 enemy ghosts/match 0.00 taken 9862 
arena 3v3   2 max-gear ghosts offered  win 0.92 enemy ghosts/match 0.00 taken 9862 
royale 1v1  no ghosts                  win 0.75 enemy ghosts/match 0.00 taken 7624 place 1.33
royale 1v1  2 max-gear ghosts offered  win 0.75 enemy ghosts/match 0.00 taken 7624 place 1.33
```

### Reading it honestly

- Starter → Legendary kit is a large gain in every mode after the fix (Arena 1v1 50 → 100%, 3v3 50 → 100%, Bounty 52 → 100%, Survival 83 → 100%, Last Standing 8% → 63%).
- Before, gear-only progress was cancelled (common/rare ≈ starter; Arena 1v1 13 / 25 / 38%), and two max-gear ghosts cut a Legendary pilot to 8% (1v1) and 0% (3v3).
- A pilot with Epic gear **and** a big upgrade build won more before in some modes (e.g. 3v3 Arena 100 → 75%, Last Standing 75 → 33%), because before the AI copied items but not upgrades. After, the AI follows total power on a slower curve, so that pilot still wins well above a starter's rate.
- Best of 3 for a one-chassis starter: 13% → 50% (the AI no longer counter-switches against a pilot who can't answer).
- Survival: a starter meets the identical megatank (83 / 79 / 92%, unchanged). Strong kits now beat it more often and faster (Legendary 1v1 34 s, 3v3 54 s; before 39 s / 75 s). It is a clear premium edge; it is shorter than before for top kits.
- Same encounter (fixed AI, same seeds; `combat-balance.mjs`): Arena 3v3 0 / 0 / 50 / 100 / 100%, Last Standing 0 / 0 / 0 / 100 / 100%, Survival 17 / 67 / 100 / 100 / 100%, Arena 2v2 0 / 0 / 50 / 100 / 100% — never down a gear step.


## Tests

`dev/tests/combat-balance.mjs` (new, in the Equipment Balance workflow): AI ladder powers, AI never above you, roster independent of your gear, megatank independent of your tank, Moonbeam/Lunar Skin/Gold Plate/chassis tiers, two-bay loadout, same-encounter monotonic win rates (4 encounters), all modes × sizes × maps finish (best of 3 resolves, Survival win = megatank down), ghost cap. Full measurement: `dev/tests/combat-sim.mjs`, `combat-grid.mjs`, `combat-ghosts.mjs`, `combat-report.mjs` (use `COMBAT_SRC=<checkout of main>` for "before").

The pilot in these sims is the game's own AI driving your tank with the human's always-aware turret ("casual": no reflex dodges, always presses in; "expert": full bot tactics). It is a stand-in, not a person. These are simulations, not iPhone tests.
