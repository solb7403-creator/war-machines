# Pricing review (report only), Nov 2, 2026

Scope: every price in the game, after the Session 2 balance changes. No prices change here except Lunar Skin (below).
USD uses **~$0.02 per Star** (the Session 2 brief's rate). TON prices imply about **$1.25-1.32 per TON** at that rate
(4 TON = 250 Stars, 50 TON = 3,300 Stars). No external price comparisons are used in this review.
Nothing here is a promise about $LUNAR amounts, prices or returns.

## Lunar Skin price: 2,000 -> 3,000 Stars, 30 -> 45 TON (owner decision, Nov 2, 2026)

Measured with the human pilot profile (720 duels each, fully maxed Epic Titan build, stats as shipped): **Lunar Skin alone
59.3%, Moonbeam alone 62.0%** (bot duels: 72.8% vs 83.1%). The owner set the skin just under Moonbeam's price:
`SKIN_PRICE = 45` TON, 3,000 Stars (`PREMIUM.skin`); `spendGram` follows `SKIN_PRICE`. Stats unchanged (+8% health, +8% damage).

## Every price

| Item | Stars | USD | TON | Points | Notes |
|---|---:|---:|---:|---:|---|
| Common crate / gem cache | 250 | $5 | 4 | 20,000 | weapon/chassis: x1-x3 same day; gem cache: +25% each buy that day |
| Rare crate / gem cache | 500 | $10 | 8 | 80,000 | first rare or Epic gem cache a day 30% off |
| Epic crate / gem cache | 1,500 | $30 | 23 | - | one Epic crate a week 25% off |
| Starter pack (once) | 399 | $8 | 6 | - | Rare weapon + Rare chassis + Rare gem cache |
| Founder pack (until launch) | 1,199 | $24 | 19 | - | Epic weapon + Founder paint + 2 Rare gem caches |
| Moonbeam (Legendary weapon) | 3,300 | $66 | 50 | - | 118 DPS, Precision, Moonfall 592 |
| Lunar Skin (Legendary) | 3,000 | $60 | 45 | - | +8% health, +8% damage (was 2,000 / 30) |
| Lunar Pass premium | 799 | $16 | 13 | - | premium track never gives points |
| Paint (shop) | 150 / 300 | $3 / $6 | 2.4 / 4.8 | - | looks only |
| Hyperspace Vault | 250 / 1,000 / 5,000 / 25,000 | $5-$500 | 4-400 | - | Gold, looks only |
| Paid build reset | 77 per $1, $1-$5 | $1-$5 | 1.25 per $1 | - | keeps every point (note: 77 Stars per $1 is ~$0.013 a Star) |

## Value per Star

- **Points vs Stars:** a common cache is 250 Stars or 20,000 points (80 points a Star); a rare one 500 Stars or 80,000
  points (160 points a Star). The paid reset prices points at 6,250 per $1 (125 points a Star at $0.02).
- **Shards per Star** (gem caches): common 1.5 shards / 250 = 0.006; rare 3.5 / 500 = 0.007 (0.010 on the daily deal); Epic
  12.5 / 1,500 = 0.008 (0.012 on the deal). Shards land on a random core type of six, so levelling three chosen cores
  from Lv1 to Lv5 (102 shards there) takes about 200 shards in all: ~16 daily-deal Epic caches, ~16,800 Stars (~$336) over 16 days.
- **Legendaries vs cores, equal spend** (6,600 Stars, Moonbeam + Lunar Skin at Moonbeam's price, as the brief specified):
  with human pilots the full kit beats an Epic pilot who spent the same on caches **69.2%** (66.0% from Lv3 cores; target 55-60%). 6,600 Stars of caches add only ~0.8 levels to each of dmg/rof/arm.
  So legendaries are clearly the better buy per Star for combat, and **gem caches look overpriced for what they do in a
  fight**. Options for the owner (not done): more shards per cache (e.g. Epic 11-14 -> 16-20), a "choose the core" Epic
  cache, or a lower Epic cache price.
- **What a buyer gets** (human pilot profile): Moonbeam alone 62.0%, Lunar Skin alone 59.3% against the same build
  without it; both together 74.6% against a fully maxed Epic (class average); 78.2% against an average-roll Epic; 86.7%
  against a rare-geared pilot. Per Star the two are now close (skin 3,000, Moonbeam 3,300).

## Weekly earn: free players vs payers

From the measured AI-match results (dev/tests/s2/cap-report.mjs, standard pilot, kits at the leagues they settle in):
the mode average is ~300 base points a minute (fastest: Survival 3v3 and Last Standing at ~500-650/min); the 20,000 daily
cap takes ~31-180 minutes depending on the mode, ~67 min at the average.

| Pilot | Base points a week (matches) | Plus quests and claims | Spendable on top (league bonus) |
|---|---:|---:|---:|
| 1 hour a day | ~126,000 | ~+45,000 (dailies 3,000 a day, weeklies, chest, login) | +15% (Pilot) to +100% (Lunar Legend) of match points |
| 3 hours a day | 140,000 (capped daily) | ~+45,000 | same |
| 24/7 bot | 140,000 (capped daily) | ~+45,000 | same |

Payers earn the same points (purchases never give points); what they buy is gear. A payer's edge shows up as win rate,
which nudges points a minute up a little (a win pays about 4x a loss) and the league multiplier up (spendable only).

## Pacing with 7 leagues and the base-point cap

- The league bonus (x1.00 to x2.00) only adds spendable points. A Lunar Legend pilot at the cap banks 20,000 base + up to
  20,000 bonus a day: a rare crate (80,000 points) in ~2 days instead of ~4, a full 14-level build (62,500 points) in
  ~1.5 days. Epic gear can't be bought with points, so the bonus speeds up rare rolls, tune-ups and resets, not top gear.
- The airdrop and the boards are untouched by the bonus, so higher leagues are a convenience, not a ranking advantage.

## Clearly under- or overpriced

- **Gem caches (Epic especially): overpriced for their combat value** (equal-spend result above).
- **Starter pack: deliberately cheap** (a rare cache alone is 500 Stars; the pack is 399 with two rare items too). Fine for onboarding.
- **Founder pack: very cheap for an Epic weapon** (an Epic crate is 1,500 alone). Time-limited until launch; keep as the early-supporter reward.
- **Lunar Skin at 3,000** (owner-set): just under Moonbeam for an edge a little below Moonbeam's (59.3% vs 62.0%).
- Not a price, but it moves value: **Survival pays the most points a minute** (won ~92-100% at every kit and league) and
  Last Standing pays well per minute when you place high. Worth watching in beta.

## Later price moves (as players grow and TGE nears)

- Recheck the Lunar Skin vs Moonbeam edges with real beta win rates; if the skin's edge reaches Moonbeam's, move it to 3,300.
- If the core economy stays weak per Star, raise shards per cache before cutting legendary prices.
- Close the Founder pack at launch (FOUNDER_OPEN), as planned.
- Set the daily cap from beta data (docs/launch/LEAGUES.md, minutes-to-cap section): ~ the daily play of the top ~10% of pilots.
