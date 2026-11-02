# Session 2 (v2) progress: leagues, legendary balance, matchmaking, economy

Branch: `session2-leagues-economy` (from `main` 8df6500). One PR at the end. Resume from the first unchecked item.

- [x] 1. Mods rework
- [x] 2. Legendary balance
- [x] 3. Gear score accuracy
- [ ] 4. Leagues + AI
- [ ] 5. PvP matchmaking
- [ ] 6. Airdrop + daily cap on base points
- [ ] 7. Reminder cap
- [ ] 8. Pricing
- [ ] Release

## Tools
- `dev/tests/s2/pool.mjs`: runs real-sim duels / AI matches on all cores (worker threads).
- Baseline ("today") = `origin/main` 8df6500, checked out as a worktree and run with `COMBAT_SRC=<path>`.

## Notes per item

### 1. Mods (done)
- FITS (js/rules.js), FIT_VERSION 2: plates hp+5% spd-16% shield cd-40%; light hp-5% spd+15% dash cd-40%; sprint spd+11% dps-9% turret turn+30%;
  stable spd-15% dps+7% shot speed+10%; hardened hp+6% dps-14% super charge from hits+20%; firing hp-8% dps+12% super charge+8%. Budget unchanged (3/3), 19 legal sets.
- Health moves less than the others because the bot brain hides when it has less health than its target (health is worth ~1.8x a damage point in the sim).
- Field round robin (Epic builds, 6 maps, both directions, 5 seeds = n 1,080 per set, 92,340 duels): 170/171 sets in 42-58%; the one at 58.1%
  (Scout/Twin light+sprint) fixed by sprint speed .12 -> .11, Scout re-run: 43.2-57.9%. Vanguard/Titan measured at .12 (sprint was neutral there).
- Today's baseline AI table (origin/main, 24 runs per cell): docs/launch/s2data/ai-today.json. Standard pilot average: stock .580 common .659 rare .689 epic .864 legend .919.
- Expert pilot profile added to combat-sim (leads moving targets, always reacts to telegraphed supers). Before this, PILOT=expert was the standard brain.
- Build tag: super-charge mods count toward Overcharger; flip rate 21.5% (today 21.4%).

### 2. Legendary (done)
- Moonbeam 110 DPS, MOON_EDGE 1.0 (Precision), Moonfall SUP.moon dmg 375 hw 1.2 (w 2.0 drawn), LEGENDARY_MULT 1.48. Lunar Skin SKIN_HP 1.04, SKIN_DMG 1.03.
- Results in docs/EQUIPMENT_BALANCE_VALIDATION.md (Session 2 section) and docs/launch/s2data/legendary-final.txt.
- Owner decisions: counter triangle makes "vs Vanguard 76-84%" unreachable (Titan beats Vanguard 99% at equal gear); equal spend 66-68% (caches weak per Star).
- Garage: machineView gains `super` and `edge` (G_MORE), so the Moonbeam edge line shows Precision.

### 3. Gear score (done, target missed: 86.7% vs 90%)
- powerOf refit (POWER_W, POWER_WPN, POWER_K 13.75, COUNTER_EDGE 1.72; powerWin(pA,pB,ctr) gives the gear-predicted win chance).
  Fit: 500 random kit pairs x 240 duels (docs/launch/s2data/power-train.json); held out: 120 pairs x 480 duels (power-holdout.json).
  `node dev/tests/s2/power-check.mjs`: holdout 86.7% within 7 points (mean error 3.5); old powerOf at its best scaling 52.5%.
  Repeat measurements agree within 7 for 95.8% of pairs, so the gap is the bot brain's thresholds, not noise.
- Scale kept: stock 68, common 80, rare 106, Epic 164, full Legendary 204 (old 68/77/105/154/194).
- AI: AI_TIERS powers recomputed (26 tiers, 68..171; one duplicate removed, two steps added so no step > 8%); AI_EXP 0.75 -> 0.70 so each
  ladder kit meets the same AI tier (+/-1). Standard-pilot averages vs post-item-2: stock .580/.580 common .659/.659 rare .689/.687
  epic .864/.860 legend .867/.898 (n=264 each). Data: s2data/ai-post2.json, ai-item3.json.

### 4-7 in progress (code in, item 4 calibration running)
- Leagues (rules.js LEAGUE, LG_*, leagueRating/leagueIdx/ecoLeague/ecoForm, aiLevel(pw,e,lg,n), aiStep). Form on every record path:
  ecoAfterMatch/ecoQuit (rules), eco.js matchEnd/creditMatch call R.ecoLeague after the result; ECO_KEYS lwr/lgi/lg/lgb.
- Item 5: LobbyCore power windows (MM_WIN 8/15/25%, MM_STEP 10 s, MM_CAP 80%, roomOdds). dev/tests/s2/queue-sim.mjs: 0 above cap.
- Item 6: ecoPlayAward/ecoBase; credit() on base; players/pts = base; tests in wtest/test.mjs (198 pass).
- Item 7: NTF_BATCH 200 + farm.mjs timing/429 test (55 pass).
- Calibration grid: dev/tests/s2/league-grid.mjs (standard pilot) -> scratch grid-std.json.
