# Equipment Balance Validation and Release

Base: PR #3, merge `49074c4be443645aec7bf594c89b0d93acb691b9`; inspected main `f0b192e12a2a3f29a78e48c8c565818c95348f1c`. All prior Laboratory commits are preserved.

## Findings and retained balance

Rarity multipliers remain 1.00 / 1.14 / 1.34, with crate quality 1.05–1.10. Starter quality is 1.00; salvage is a separate, deliberately weaker acquisition path. Moonbeam remains fixed at 118 DPS, 0.16 seconds per shot, projectile speed 26, and 1.48 super scaling (Moonfall 400 -> 592, 2.0 wide). Session 2 adds its Precision trait: edge hits deal full damage instead of 75%. Lunar Skin: +8% health, +8% damage. Owner decision: these stats are fixed. See the Session 2 section at the end.

### All ten weapons

Ranges below are actual calculator outputs for crate quality endpoints, before upgrades, cores, class counters, armor, buffs and crits. Shot damage is base DPS × shot interval; super damage uses actual rarity × quality without ordinary fitting bonuses.

| Item | Rarity / level | DPS | Damage per shot | Interval / nominal shots/sec | Projectile speed | Single super damage |
|---|---|---:|---:|---:|---:|---:|
| Pulse Cannon | Common / 1 | 74–77 | 14.80–15.40 | 0.2 s / 5.00 | 22 | 367.50–385.00 |
| Arc Pulse | Rare / 2 | 84–88 | 16.80–17.60 | 0.2 s / 5.00 | 24 | 418.95–438.90 |
| Nova Pulse | Epic / 3 | 98–103 | 19.60–20.60 | 0.2 s / 5.00 | 26 | 492.45–515.90 |
| Twin Repeater | Common / 1 | 69–73 | 6.21–6.57 | 0.09 s / 11.11 | 22 | 367.50–385.00 |
| Storm Repeater | Rare / 2 | 79–83 | 7.11–7.47 | 0.09 s / 11.11 | 24 | 418.95–438.90 |
| Helix Repeater | Epic / 3 | 93–97 | 8.37–8.73 | 0.09 s / 11.11 | 26 | 492.45–515.90 |
| Siege Breaker | Common / 1 | 78–81 | 35.10–36.45 | 0.45 s / 2.22 | 22 | 393.75–412.50 |
| Rail Breaker | Rare / 2 | 89–93 | 40.05–41.85 | 0.45 s / 2.22 | 24 | 448.87–470.25 |
| Titanfall | Epic / 3 | 104–109 | 46.80–49.05 | 0.45 s / 2.22 | 26 | 527.63–552.75 |
| Moonbeam | Legendary / 4 | 118 | 18.88 (never grazes) | 0.16 s / 6.25 | 26 | 592.00 |

Moonfall exceeds the strongest unbuffed standard single super (perfect Epic Siege Blast: 552.75) by 7.10%; Moonbeam exceeds perfect Epic Siege DPS (109) by 8.26% and, with Precision, deals full damage on edge hits (every other weapon: 75%). Twin retains the fastest cadence and smallest individual hits; Siege the slowest and heaviest; Pulse stays between them. Nova is radial, Lance/Moonfall are penetrating beams, and Siege Blast is a traveling AoE shell. Area, wind-up, line of sight, movement and counterplay prevent DPS alone from determining outcomes.

### All nine chassis

HP shown for mode health scale 1 and no account upgrades/skin/fittings. Movement is a multiplier on 4.4 units/sec; turning is a multiplier on 3.4 radians/sec. Dash, collisions and class-counter rules are unchanged.

| Item | Rarity / level | HP range | Movement multiplier range | Turning multiplier |
|---|---|---:|---:|---:|
| Scout | Common / 1 | 1513–1598 | 1.26–1.29 | 1.18 |
| Strider | Rare / 2 | 1734–1819 | 1.35–1.39 | 1.23 |
| Phantom | Epic / 3 | 2040–2125 | 1.48–1.52 | 1.28 |
| Vanguard | Common / 1 | 1785–1870 | 1.02–1.05 | 1 |
| Sentinel | Rare / 2 | 2040–2125 | 1.1–1.13 | 1.05 |
| Paladin | Epic / 3 | 2397–2499 | 1.2–1.24 | 1.1 |
| Titan | Common / 1 | 2329–2431 | 0.9–0.92 | 0.9 |
| Bulwark | Rare / 2 | 2652–2771 | 0.97–0.99 | 0.95 |
| Colossus | Epic / 3 | 3111–3264 | 1.06–1.09 | 1 |

Scout retains speed/turning and lower HP; Titan durability and lower speed; Vanguard sits between them. Scout→Titan→Vanguard→Scout still grants +15% outgoing damage and the disadvantaged direction applies 0.90× damage; boss fights exclude this triangle. The triangle is an advantage, not a guaranteed duel result.

## Actual combat evidence

The committed `dev/tests/gear-combat.mjs` executed 596 paired seeded duels with the actual Workers combat engine and 180 completed trials through the actual isolated browser combat adapter. It checked all weapon/chassis rarities, both spawn directions, all four maps for legendary comparisons, all 19 budget-legal fitting combinations, five maximum-investment builds and all six genuine mode objectives (including Survival boss/team setup). It also passed 3420 browser/Workers loadout formula comparisons covering gear, both roll endpoints and every legal fitting set.

Duels use equal AI control, 1/60-second steps and deterministic per-instance RNG; these are bot simulations, not human gameplay or measured player enjoyment. Main seed set: 71, 419, 2027, 9803, 65537; chassis/fitting/mode samples use the first three. Weapon comparisons use the same rarity reference; legendary comparisons use perfect Epic equipment and identical chassis/account investment.

| Moonbeam opponent | Wins / paired trials |
|---|---:|
| Perfect Epic pulse | 33 / 40 |
| Perfect Epic twin | 31 / 40 |
| Perfect Epic siege | 31 / 40 |

Combined Moonbeam result: 95/120 wins (79.2%), 25 losses. It is stronger, but demonstrably beatable in this AI setting. This is not proof of acceptable paid competitive advantage for human players. No numeric rebalance was justified from these limited observations.

In the ten classic-map Epic comparisons against Pulse, Twin won 1/10 and Siege 5/10. Twin generated 3.4 supers per fight versus Pulse mirror 3.0, with similar ordinary-shot accuracy, illustrating why raw DPS and charge frequency do not determine objective/duel strength. The small classic-map result is insufficient evidence to nerf/buff an entire family; cross-map legendary comparisons did not show Twin uniquely disadvantaged. Fitting results vary by seed and matchup; no universal free upgrade was demonstrated. Every fitting retains a cost/tradeoff and all over-budget choices remain illegal.

The upgraded Moonbeam candidates beat starter gear in all 40 initial paired duels; the exact maximum-power build is tested separately too. These are intentionally unequal progression comparisons. Equivalent upgraded Epic Siege opponents still won fights. Maximum cores, the existing Lunar skin and legal 14-level account budgets are included; no extra ownership or paid power has been created.

The enumerated maximum power is **240**, using Moonbeam, perfect Epic Colossus, hull/cannon/engine 4, two remaining levels, three level-5 cores, Lunar skin and reinforced plates. Its power is below Ace (250). All current legal configurations therefore occupy Rookie/Pilot under the existing formula; Ace/Elite/Legend are unreachable with current equipment. Matchmaking widens league bands after 10/20 seconds, so unequal progression encounters remain possible. This is an existing design limitation, not resolved by claiming the bracket system is finely balanced. Changing thresholds or reward multipliers is deliberately deferred rather than silently changing the economy.

PvE results include boss scaling: more raw damage raises boss HP, and higher player HP raises boss damage. Survival therefore need not become monotonically easier with stronger equipment. Six-mode practice counts are 30 per mode. Current live matchmaking availability remains Arena, Moon Zone and the daily featured queue; this release does not activate unsupported queues. Six-mode frozen equipment/proof contracts passed locally; no real authenticated ranked/PvP accounts were used for validation.

## Corrections

- Machine bar ceilings enumerate legal fitting combinations: DPS can reach +11%, movement +10%, not a single-slot +6%. Rounded chassis calculators and displayed telemetry rounding now set the reference scales.
- Inspection exposes equipped hit damage, fire cadence and super damage using the real account/core/fitting calculations. Unbuffed super damage retains fractional precision. The fixed pre-fire delay is labelled **Super wind-up**, rather than incorrectly implying meter fill duration.
- The inspection refresh listener also ran on practice option forms after leaving Engineer, reading removed selectors and throwing null-value errors. It now updates only the actual equipment form. The unchanged range browser regression exposed this defect.
- Bay cards show the exact chassis item name (for example Colossus), preserving Salvaged labels and independent configurations.
- Practice identity advances to `lunar-range-s4.2-equipment/fits-1` so stored pre-rebalance trial results are not marked comparable to the new combat rules. No simulation behavior is altered.
- The PvP frozen-counterpick test expected pre-PR-3 Scout HP 1360. It now asserts 1445 (1700 × 0.85) after the genuine server swap. Forged proof, frozen snapshots, reconnect and ownership rejection checks remain intact.
- Release CI now runs the committed actual-combat characterization and six-mode snapshot/range regressions alongside the existing mandatory economy/PvP/farm/real-Workers checks.

## Verification and scope

- Local: equipment formula suite; extended Laboratory UI regression (red before fixes, green after); authoritative Lab migration/ownership/revisions; frozen PvP/counterpick; stock rewards/proofs in all modes; 12 seeded repeatability trials and Survival comparison identity; actual combat characterization above.
- Local browser: all 19 exact item inspections; server-owned fixture inventory; distinct bays, save/activate/reload; 320/390/430 px; 2D, 3D/software renderer and no-WebGL fallback, without production account access. Screenshots/results are external artifacts, not committed generated files.
- Baseline PR #3 workflows passed economy, PvP, farm, Lab, actual Workers runtime smoke and both deployments. New PR/release workflow results and final deployed SHA are recorded in the external final deployment report after integration.
- Physical iPhone/Telegram authentication, human tactics, population matchmaking quality and long-term paid competitive fairness remain unmeasured. No new purchases or production account mutations were performed. There is no claim of mathematically optimal human tactics or exhaustive gameplay coverage.

Release integration must use passing checks and the existing Pages workflow. The backend combat code is unchanged from the already successful PR #3 deployment. The existing Worker workflow also watches the corrected PvP test fixture and will republish the unchanged backend on merge; no additional manual deployment is needed.


## Session 2 (Nov 2, 2026): legendary results

Shipped stats (owner decision, fixed): **Moonbeam 118 DPS, LEGENDARY_MULT 1.48, Moonfall 400 (592 after scaling, 2.0 wide),
Precision on (edge hits deal 100%)**; **Lunar Skin +8% health, +8% damage**. The 2% Moonbeam DPS exception was not used.

Method: `dev/tests/s2/legend.mjs`, server sim, Arena 1v1 single round, all 6 maps, both spawn directions, 20 seeds (human)
or 10 seeds (bot) per pairing. Reference = fully maxed Epic: perfect rolls (1.10), 14 levels (hull 4, cannon 4, engine 2,
targeting 2, reactor 2), Lv5 dmg/rof/arm cores, Reinforced plates + Sprint gearing on both sides. Both sides fly the same profile.

**Human pilot profile** (`dev/tests/s2/human.mjs`): reaction lag, aim wobble, missed super dodges, positioning drift, poor
target picks, and a per-match form draw. Calibrated only on equal-gear matchups and locked before any legendary run
(commit 3de29e4): Titan vs an equal-gear Vanguard **63.3%** (bot profile 97.9%), Scout vs Titan 52.5%, Vanguard vs Scout
60.0%, mirror 50.0%; humans hit ~30% of shots (bots ~96%). Best Epic weapon under this profile: Siege (Siege beats Pulse 53.7%, Twin 60.8%).

| Test | Target | Human profile | n | Bot profile (old measurement) | n |
|---|---|---:|---:|---:|---:|
| Full kit vs maxed Epic, class average | 72-75% (~74) | **74.6%** | 720 | 97.5% | 360 |
| ... vs Epic Scout | 60-66% | **65.8%** | 240 | 96.7% | 120 |
| ... vs Epic Vanguard | 76-84% | 87.1% | 240 | 100.0% | 120 |
| ... vs Epic Titan | 76-84% | 70.8% | 240 | 95.8% | 120 |
| Moonbeam alone vs best Epic weapon | 61-65% | **62.0%** | 720 | 83.1% | 360 |
| Lunar Skin alone vs none | 61-65% | 59.3% | 720 | 72.8% | 360 |
| Full kit vs equal spend on gem caches (6,600 Stars, from Lv2 cores) | 55-60% | 69.2% | 1,440 | 90.7% | 864 |
| ... same, from Lv3 cores (Pulse reference) | 55-60% | 66.0% | 1,440 | - | |
| Full kit vs average-roll Epic (1.075), class average | report | 78.2% | 720 | 97.9% | 360 |
| Full kit vs rare-geared (1.075), class average | report | 86.7% | 720 | 100.0% | 360 |

Precision, measured (`dev/tests/s2/precision.mjs`, human pilots, Moonbeam vs Epic Siege, 240 duels each): shot damage per
shot fired **11.35 with Precision vs 9.90 without: +14.6%**. 118 DPS was kept, since the targets didn't call for the 2% exception.

Gaps (not fixed; legendary stats are fixed): vs Titan is 5 points under its band and vs Vanguard 3 over, the counter triangle
(+15% damage, 10% less taken) still leans on the Titan pairings. Lunar Skin alone is 1.7 points under its band. Equal spend is
9-14 points above its band because 6,600 Stars of gem caches add only ~0.8 levels to each core. Options for the owner, not
implemented: soften the counter triangle (e.g. +10%/-5%), make gem caches better value per Star (more shards, or a
choose-your-core Epic cache), or a cheaper Epic cache. See docs/launch/PRICING_REVIEW.md.
