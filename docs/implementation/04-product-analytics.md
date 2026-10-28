# 04 — Reliable retention and revenue metrics

Priority: P0 before paid ad scaling. Goal: accurate D1/D7/D30 cohorts, activation, repeat play and unit economics. Existing admin sample is skewed toward the top 1,000 by lifetime points, while payer totals use a separate recent-transaction sample. Do not use it to optimize ad spend.

Implementation: authoritative event timestamps for acquired, account_verified, tutorial_started/completed, first_match, second_session, machine_edited, machine_selected, mode_started/completed, friend_invited/activated, checkout_started, payment_verified/refunded and churn/reactivation. Record source/campaign with consent, cohort by real first-seen UTC day, use all eligible signups instead of top scorers. Compute D1/D7/D30 with a defined observation window, survival and return definition, paid conversion, net revenue, payer ARPPU, ARPDAU, and acquisition cost by campaign. Exclude fake accounts, developers and refunded invoices from monetary numerators. Limit PII and retain only necessary identifiers.

Acceptance: sampled synthetic cohort tests with known expected ratios; timezones and late payments handled; source/campaign attribution reproducible; charts show sample size and missing data. Never invent metrics from unavailable data.
