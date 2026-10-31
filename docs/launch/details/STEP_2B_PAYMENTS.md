# Step 2B payment pass — local fixes complete, commercial NO-GO remains

Changed payment portions of `worker/src/index.js`, the payment-only `act('paid')` branch of `worker/src/eco.js`, payment handling in `js/net.js`, and `dev/tests/wtest/commercial-payments.mjs`. Parent authorized the contained quote state, sync recovery and held-status branch. No commits/pushes, production/provider/database/bot/configuration changes, secrets or real-money operations. Prices, grants, revenue valuation/shares, SOL pause and website purchase denial remain unchanged.

## Reproductions and fixes

- Stars precheckout previously accepted wrong amounts, consumed offers, changed ownership eligibility and stale-season payloads. New invoices persist immutable server quotes (buyer/economy owner, descriptor, exact payload, TON/Stars price, day/week/season, ten-minute expiry). Precheckout validates the quote and current rules, then reserves one outstanding checkout per account with the economy CAS. Quote consumption and grant commit together; replay/charge-owner/refund protections remain intact.
- Paid callbacks that fail new quote eligibility or attempt a second charge against one quote retain durable **held** receipts with zero goods. Accounting still records money actually received; an authenticated boot exposes review status, `act('paid')` returns review, and the client directs the buyer to support without acknowledging delivery. Old-season successes never grant the new season. Refunds of held receipts reverse accounting without removing another purchase's inventory or verified spending. Existing legacy callback/receipt behavior is preserved; old non-quoted invoices cannot pass new precheckout.
- Simultaneous TON settlements were reproduced using a provider-response barrier after both stale reads: both could consume one daily offer. Grant CAS now rechecks current price/deal/ownership; an ineligible paid loser receives a durable review receipt, zero goods and a support response.
- Missing TON product details could turn a client-supplied label and a tiny transaction into a verified migration-eligible sale. New unpriced logs fail closed; existing durable receipts are preserved.
- TON aborted, bounced and failed-compute provider records previously granted goods. Explicit negative statuses and failed HTTP/provider responses are rejected. This is **not positive finality verification**.
- Stars success/refund and TON inventory commits could lose accounting/projections forever when the provider never retried. A versioned pending journal commits with each new receipt mutation; authenticated sync reconciles up to two receipts, clearing only the exact completed versions. Tests cover no-provider retries, refund races and batches spanning multiple syncs.

## Verification

Before edits: existing 33 checks passed; added adversarial reproductions failed for stale/invalid precheckout and absent sync recovery. Further red runs reproduced TON concurrent offers, unpriced logging, invalid provider statuses, held-as-delivered UI and held-starter refund reversal.

Final fresh commands:

- `node dev/tests/wtest/commercial-payments.mjs`: **81 passed, 0 failed**, every outbound endpoint mocked or rejected.
- `node dev/tests/wtest/test.mjs`: **189 passed, 0 failed** after parent updated snapshot backfill fixture. An intermediate shared-tree run failed the admin/snapshot fixture during that work; final run is green.
- `node --check worker/src/index.js`, `node --check worker/src/eco.js`, `node --check js/net.js`, `git diff --check`: pass.

## Remaining launch/free-beta boundaries

Commercial release remains NO-GO. TON still lacks a persisted server quote before wallet sending, buyer/order-bound settlement lifecycle and positive finality proof; the bounded pass did not invent a new wallet/quote stack. Current client pending discovery still has two-hour/feed-window and 48-hour queue limits. New negative-status checks do not certify TON provider schema, finality or refunds.

Held paid receipts require an approved support/refund workflow; this pass does not issue refunds. New Stars reservations can block another checkout until their ten-minute expiry when a buyer abandons payment. Late callbacks can require review after price/ownership/season changes; provider cancellation, retry timing, precheckout deadline and expected product semantics need isolated certification.

Sync recovery requires the affected account to return; it is not a scheduler/global reconciliation service. Historical failures predating the new pending journal, historical unpriced receipts and aggregate corrections need audited investigation/backfill; nothing live was inspected or rewritten. Permanent receipts, acceptance/quote state and revenue journals need a retention/compaction design that keeps replay protection. An unpaid free-beta recommendation does not certify paid checkout and must not enable SOL or website purchases.

External evidence still required: isolated Stars invoice/precheckout/pending/cancel/success/refund/retry certification, TON quote/finality/outage/refund evidence and deployed database conditional-write behavior. On iPhone, use only prepared no-money fixtures/sandbox to verify pending/review messaging, app close/reopen recovery and no false delivered state; confirm SOL remains unavailable and website checkout remains unsupported. No physical iPhone or provider certification was performed here.

Final budget correction: reduced sync recovery from ten receipts to two and CAS-cleared each completed receipt immediately. Added >=10-receipt backlog, fifty-fetch per-sync budget, failure-on-second-receipt, durable first-receipt cleanup and eventual exact-once drain regressions. Red run: six new failures; green run: 81/0 payment checks, core189/0, index syntax and diff-check pass.
