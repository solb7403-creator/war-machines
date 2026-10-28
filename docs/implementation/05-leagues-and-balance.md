# 05 — Attainable leagues, fair Moonbeam and matchmaking

Priority: P1. Current max legal power is approximately 240 while Ace starts at 250, rendering upper leagues unreachable. Moonbeam is a strong legendary: 95/120 AI wins against perfect Epic counterparts in one controlled sample. Reconcile these before significant competitive growth.

Implementation: separate equipment-power bands from performance/skill rating; choose attainable and explainable thresholds with migrations, avoiding silent reward inflation. Retune Moonbeam with cross-map seeded battles and paid/free build matchups while keeping it best overall and distinctive. Include non-damage axes such as fire cadence, accuracy, burst, super coverage, movement and class-counter. Monitor human win rates and build pick rates after launch. Avoid pay-to-win matchmaking loops, especially when matching widens.

Acceptance: all advertised leagues reachable through legitimate rules or clearly labeled future content; new and veteran players matched fairly; strong Epic builds remain viable; no dominant universally winning legal build; all six modes, economy, season, power, frozen proof and Worker tests passing. Do not use arbitrary bot win-rate targets as proof of human fairness.

## Operations plan — Release 05
**Depends on:** 01 full-machine match commitment, 04 instrumentation baseline. Keep existing shop and economy stable until tests justify changes.

- [ ] **05.1 Inventory legal-state audit:** enumerate every owned legal weapon/chassis, upgrade allocation, cores, fittings, skins and strongest/weaker builds. Current documented maximum is 240 power, below Ace's 250; confirm again on latest rules.
- [ ] **05.2 League model decision:** publish difference between equipment power (match competitiveness), skill rating (performance), and farming/airdrop points (reward progression). Choose attainable upper ranks or clearly mark them future-only. Avoid quietly lifting rewards or devaluing earlier player progress.
- [ ] **05.3 Moonbeam experimental balance:** benchmark against perfect Epic builds across every chassis, all six modes, maps, counter triangle, low/high gear and account investment. Examine 79.2% AI win rate as an *alert*, not a human balance verdict. Adjust total advantage with clear caps on synergistic stats, preserving best-weapon identity and signature super.
- [ ] **05.4 Counterplay rules:** check movement/kiting, effective range, collision, accuracy, charge/burst, shields, dashes and map objectives rather than DPS alone. Validate short/long match and best-of-three behavior under the new one-machine lock.
- [ ] **05.5 Matchmaking:** assess sparse launch concurrency, existing 10/20-second widening, beginner protection, power mismatch, win-rate and queue times. Prefer viable Quick Match queue; no new fragmented ranked queues.
- [ ] **05.6 Formula/version migration:** shared browser/Worker calculations and frozen proof tests must use identical versioned gear/stat formulas; preserve existing purchases and owned rolls. Ensure no retroactive deduction of earned points.
- [ ] **05.7 Test:** deterministic matchup matrix (mirror + cross-class, AI versus AI, both spawns/maps), 3,420-equivalent or greater formula parity, economy/PvP/farm, six-mode snapshots, anti-farm, 320/390/430px stat UI, and real Workers smoke.
- [ ] **05.8 Human gate:** after release, track match results by class/gear/payment segment with minimum sample sizes. Only retune against reproducible evidence, not visual intuition; prepare rollback config/version.

**Definition of done:** every advertised league is obtainable or clearly labeled future-only; premium Moonbeam is desirable but not a dominant near-mandatory PvP purchase; rank/reward integrity preserved.
