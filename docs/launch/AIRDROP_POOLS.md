# Airdrop pools (research boards — distribution OFF)

Owner decisions of Oct 31 2026. These boards are **tracking only**: no token transfers, no guaranteed allocation, no price or amount promised. Distribution stays disabled (`AIRDROP.dist=false`, `adb.dist=false`) until the owner signs off.

## Two pools, 1,250 pilots

| Pool | Who | Size | Share of player airdrop (default) |
|---|---|---|---|
| Points pool | top **1,000** by play score | 1,000 | **90%** |
| Referral pool | top **250** recruiters | 250 (500 only with the expansion rule) | **10%** |

One person can qualify for both. Average referral share ≈ half an average points share at scale (inviting helps, playing matters more).

## Scores

- **Base points only (Session 2):** airdrop credit (`ac`) follows lifetime **base** points: every match's points at league ×1 (featured and streak included). The league bonus (×1.15 to ×2.00 by league) is paid on top to spendable points only and tracked as `lgb`; it never enters `ac`, the play score, the public leaderboard (`players/pts` = earned − lgb) or the daily/weekly boards. The 20,000 daily cap counts base points too, so climbing leagues never shrinks daily airdrop progress. Same rule for AI tickets and live rooms (`R.ecoPlayAward`); tested in `dev/tests/wtest/test.mjs` (Rookie vs Lunar Legend with identical base results: identical `ac`, board points and cap).
- **Play score** (Points pool) = `max(0, airdrop credit − referral points) + 7.5% × referral points`. Referral points (`rfe`) = welcome bonus + squad payouts + match bonus, tracked apart from play points. Weight is config `cfg/ad/refW`, clamped to 5–10%.
- **Referral score** = `sqrt( Σ min(30, recruit's verified days) )` over **verified active** recruits only (verified matches on 5+ distinct days, latest within 7 days, not held). Held or fraud-flagged recruits count 0. Needs **10+** verified active recruits. Square root = diminishing returns for mass inviting.
- **Concentration cap:** nobody gets more than **2%** of the Referral pool; the excess goes to the others in proportion. If fewer than 50 recruiters qualify the cap leaves part of the pool unallocated (owner decision: hold it, or move it to the Points pool).
- **Expansion rule** (`cfg/ad/expand.on`, default **off**): Referral pool may grow to 500 once active pilots reach 50,000. Never automatic without owner sign-off.
- **Wallet cap (policy note only, not built):** a future 2.5%-of-supply cap per wallet.

## Where it lives

| What | Path |
|---|---|
| Rules + defaults | `js/rules.js`: `AIRDROP`, `adCfg`, `airdropScore`, `refPoolScore`, `poolShares` |
| Owner config (optional overrides) | Firebase `cfg/ad` (refShare, refW, refMin, qCap, refCap, expand) |
| Inputs | `ads/<pid>` (play score, written with each record change), `rfs/<pid>` (referral score, refreshed daily when the recruiter opens the game or the Squad screen; rows older than 8 days sit out) |
| Board (auditable, every 5 min) | `adb`: time, config used, active pilots, phase, every row with its inputs and share |
| Public (Squad screen) | `lb.ref`: top 25 recruiters, labelled "research ranking, not a guarantee" |

Flagged pilots sit out both boards (same flags as the leaderboard).

## Simulation (8 seeds, `node dev/tests/wtest/airdrop-sim.mjs`)

Model: most pilots play a few days, some grind; ~6% invite 1–6 friends, ~0.5% are big inviters (15–75), ~0.2% run farms of 10–60 alts (70% caught by device/network/bot flags).

| players | Points pool qualifies | Referral pool qualifies | in both | farms in ref pool | top-10 of points pool | top-10 of ref pool | avg points share | avg referral share | largest referral share |
|---|---|---|---|---|---|---|---|---|---|
| 1,000 | 1000 | 5.0 | 5.0 | 0.6 | 7.4% | 10.0% | 0.090% | 0.175% | 0.175% |
| 10,000 | 1000 | 56.9 | 5.8 | 9.6 | 2.3% | 19.8% | 0.090% | 0.177% | 0.200% |
| 50,000 | 1000 | 250.0 | 5.6 | 13.6 | 1.6% | 5.6% | 0.090% | 0.040% | 0.060% |

Shares are of the player airdrop. Referral pool = 10%, Points pool = 90%; nobody above 2% of the Referral pool (0.2% of the player airdrop).

Read-out: at 50k players the Referral pool fills (250) and the average referral share (0.040%) is ≈0.44× the average points share (0.090%) — as intended. At 1k–10k only 5–57 recruiters qualify, so the 2% cap binds and most of the Referral pool is unallocated. Farms that slip through stay under 6% of qualifiers and under the 2% cap.

## Session 2: league base pay, the daily cap and minutes to cap

Base points per match = mode pay (featured, streak) x league base pay (`LG_BASE_PAY` x1.00 Rookie ... x1.60 Lunar Legend). They
count for the airdrop credit, the play score and every board. The spendable multiplier (x1.00 ... x2.00) is on top, for
spendable points only. `DAILY_CAP` stays 20,000 base points in every league, so higher leagues reach it sooner and nobody banks more a day.

Minutes to the cap (standard pilot, mode average, measured; docs/launch/LEAGUES.md has every kit x pilot):
Rookie (Starter) 90 min, Pilot (Common) 76, Veteran (Rare) 63, Master (Epic) 40, Lunar Legend (full Legendary) 28.
The fastest single setups (Survival, Last Standing when placing high) cap in ~20-35 minutes.

Per week, matches only: a 24/7 bot caps every day: 140,000 base. A 1-hour-a-day pilot banks ~94,000 (Rookie, Starter) to
140,000 (Master and up: capped inside the hour). A 3-hour pilot caps daily in every league: 140,000.

**Recommended cap (to set from beta data):** the daily match play of the top ~10% of real pilots. With today's pay a 1-hour
pilot in Master or above already caps, so if the top 10% play 2-3 hours a day the cap should be ~40,000-60,000 base points
to keep their extra hours counting. Keep 20,000 until beta shows the real distribution.
