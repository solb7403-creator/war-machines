# 04 — Reliable retention and revenue metrics

Priority: P0 before paid ad scaling. Goal: accurate D1/D7/D30 cohorts, activation, repeat play and unit economics. Existing admin sample is skewed toward the top 1,000 by lifetime points, while payer totals use a separate recent-transaction sample. Do not use it to optimize ad spend.

Implementation: authoritative event timestamps for acquired, account_verified, tutorial_started/completed, first_match, second_session, machine_edited, machine_selected, mode_started/completed, friend_invited/activated, checkout_started, payment_verified/refunded and churn/reactivation. Record source/campaign with consent, cohort by real first-seen UTC day, use all eligible signups instead of top scorers. Compute D1/D7/D30 with a defined observation window, survival and return definition, paid conversion, net revenue, payer ARPPU, ARPDAU, and acquisition cost by campaign. Exclude fake accounts, developers and refunded invoices from monetary numerators. Limit PII and retain only necessary identifiers.

Acceptance: sampled synthetic cohort tests with known expected ratios; timezones and late payments handled; source/campaign attribution reproducible; charts show sample size and missing data. Never invent metrics from unavailable data.

## Operations plan — Release 04
**Timing:** define event schema in parallel with Wave 02; implement before paid acquisition or large monetization claims.

- [ ] **04.1 Metric glossary:** UTC signup cohort = first verified account creation, D1/D7/D30 return = any legitimate session in the specified calendar-day window; retention denominator includes *all* eligible cohort signups, not only the top scorers. Report mature cohort sizes and missing data. Distinguish a 7-day visit measure from '5 of 7 days' frequency.
- [ ] **04.2 Server event schema:** stable anonymized player key, timestamp, event type, platform, campaign/source (when consented), session/match ID, mode, machine ID, purchase verification/refund and amount/currency. Separate server-certified events from low-trust client clicks.
- [ ] **04.3 Instrument funnel:** landing → signup → first launched match → first finished match → second session → first Garage edit → another match → verified referral → checkout → settled purchase. Record crashes, disconnections, matchmaking wait and tutorial dropoffs.
- [ ] **04.4 Revenue ledger:** report payer conversion from *the same cohort* as denominator, ARPDAU/ARPPU, verified gross/net revenue, refund/fee distinction, liquidity accounting and attribution. Do not derive real dollar totals from client estimates or a sample of the latest 300 payments.
- [ ] **04.5 Privacy and cost:** document minimal collection, data retention, consent, aggregates, access control and API/storage costs; avoid copying IP, chat logs or precise device fingerprints into analytics dashboards.
- [ ] **04.6 Dashboard:** admin-only daily cohorts, source campaigns, match start/finish ratio, legacy adoption, conversion and spending; clear sample-size labels, UTC window definitions, charts and export. Preserve existing anticheat review view.
- [ ] **04.7 Automated QA:** deterministic synthetic cohorts across midnight, late first events, duplicated webhook receipts, refunds, flagged/bot/dev accounts, 7/30-day not-yet-mature cohorts and campaign attribution.
- [ ] **04.8 Decision gate:** establish real baseline before choosing spend. Use controlled A/B or staged releases, then evaluate effect on D1/D7, matches/user, conversion and net revenue; no unmeasured success claims.

**Definition of done:** trustworthy acquisition/retention/revenue totals that can guide advertising and feature priorities.
