# Airdrop pools (research boards — distribution OFF)

Owner decisions of Oct 31 2026. These boards are **tracking only**: no token transfers, no guaranteed allocation, no price or amount promised. Distribution stays disabled (`AIRDROP.dist=false`, `adb.dist=false`) until the owner signs off.

## Two pools, 1,250 pilots

| Pool | Who | Size | Share of player airdrop (default) |
|---|---|---|---|
| Points pool | top **1,000** by play score | 1,000 | **90%** |
| Referral pool | top **250** recruiters | 250 (500 only with the expansion rule) | **10%** |

One person can qualify for both. Average referral share ≈ half an average points share at scale (inviting helps, playing matters more).

## Scores

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
