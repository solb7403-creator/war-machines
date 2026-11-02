# Session 2 (v2) progress: leagues, legendary balance, matchmaking, economy

Branch: `session2-leagues-economy` (from `main` 8df6500). One PR at the end. Resume from the first unchecked item.

- [x] 1. Mods rework
- [ ] 2. Legendary balance
- [ ] 3. Gear score accuracy
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
