> Superseded for current engineering status by [PAYMENT_COMPLETION.md](PAYMENT_COMPLETION.md). This file preserves the earlier partial checkpoint.

# Step 2C — partial TON order foundation; all-provider launch remains NO-GO

2026-10-31. One serial agent; no delegation. Branch `feature/launch-commercial-readiness`, draft [PR #21](https://github.com/solb7403-creator/war-machines/pull/21). GitHub PR metadata and fresh clone both confirmed starting head `fc6165e9ecc74e159d4c6d1a646568f7a366ab21`; no newer commits were overwritten. Implementation checkpoint: `6f522d513f6b4591aa3e00a46e9723470b581289`; the following documentation commit records this handoff. RC1, main, practice preview and other PRs were not changed.

**This is a bounded partial checkpoint, not completion of Step 2C.** No provider is newly certified. Public launch requires all three rails plus account/device/operations gates and separate owner approval. Free/limited beta is NOT an authorized substitute. This owner decision supersedes earlier reports' conditional beta suggestions. Step 3 is not authorized.

## What changed

Only `worker/src/ton-orders.js`, `dev/tests/wtest/commercial-ton-orders.mjs` and this handoff were added. No existing game, price, inventory, reward, referral, account, revenue or graphics code changed.

The internal TON library uses the existing economy ETag/CAS contract:

- Generates a cryptographically random 128-bit order ID and unique `LWM2|TON|<id>` memo. Canonical buyer is a trusted function argument, not a body field. Exact recipient remains the configured owner address, and exact integer nanoTON amount comes from current server rules. Mainnet is recorded explicitly; this module is not a testnet adapter.
- Persists canonical goods, TON/Stars price snapshot, day/week/season, creation, ten-minute expiration and request idempotency key atomically with the account record. Client price/amount/recipient/memo/buyer overrides are ignored. Invalid/owned goods are refused.
- Serializes competing TON issuances per account; simultaneous retries return the same order. A request key cannot change goods or extend expiration. An active Stars precheckout blocks TON issuance. Failed database persistence throws instead of returning a payable candidate.
- Retains expired orders and allows a new reservation after expiration. Read-only inspection reports `pending`, `expired` or eligibility `review`, never paid/delivered. Changed ownership, used deals and changed relevant periods require review.
- Refuses issuance at 32 retained orders rather than deleting payment/replay evidence. A deliberate retention/archive contract is required before exposure. Firebase removes null child fields, so absent deal values are persisted as empty strings for stable retry equality.

**Not connected:** no HTTP route, authenticated caller, TON Connect message builder, wallet launch, chain lookup, proof verification, order consumption, item grant, receipt, accounting or support action uses this module. It is imported only by its tests. Existing `/api/pay-log`, Stars invoice/webhook code, `js/net.js` and `pay.html` were not edited. There is no new enable flag or production activation path. The library's trusted-pid contract must be enforced by a future authenticated independent-website handler; internal fixtures do not prove HTTP authentication.

**Reservation limit:** this is a TON-issuance reservation, not a completed cross-rail purchase reservation. Stars can still begin after a TON order because its existing precheckout does not consult this new internal field. Future integration must resolve that race and existing legacy payment paths, recheck eligibility inside grant CAS, and retain genuinely paid conflicts for support/refund review. No limited deal is debited by issuing this unconnected quote.

## Exact verification

All databases/providers in these tests are local fakes. No invoice or wallet transaction was sent.

| Command | Observed result |
|---|---|
| `node dev/tests/wtest/commercial-ton-orders.mjs` | **18 passed, 0 failed**. CAS conflict actually observed; competing and duplicate issuance, response-loss retry, exact authoritative fields, immutable expiration, account separation, ownership/deal/period changes, retained late-payment evidence, capacity and write outage covered. |
| `node dev/tests/wtest/commercial-payments.mjs` | **81 passed, 0 failed**; maximum sync fetches 36. Existing zero-credit/unrelated historical SOL exploit remains blocked by SOL disablement, not a new verifier. |
| `node --check worker/src/ton-orders.js` | PASS |
| `node --check dev/tests/wtest/commercial-ton-orders.mjs` | PASS |
| `git diff --cached --check` before implementation commit | PASS |

RED: before implementation, the direct TON fixture run reported 0/15, including the assertion that the missing issuer must exist. First implementation was 10/15: Firebase null removal broke persisted quote equality. Corrected stable serialization produced 15/15; three additional retention/period cases produced final 18/18.

Environment setup issues, resolved: initial unprivileged clone could not reach configured proxy; network-enabled sandbox clone succeeded. `node --test` produced a file-level failure without child diagnostics in this executor; running the same test file directly produced the individual assertion results above. Initial payment regression could not import `@simplewebauthn/server`; installing the existing declared dependencies resolved it. Initial npm default cache was unwritable; successful command was `npm install --prefix worker --cache /tmp/lunar-step2c-npm --no-audit --no-fund --package-lock=false`. No dependency or lockfile changes committed. Economy/PvP/auth/browser/runtime matrices were not rerun: no existing runtime code was modified or integrated.

## Provider and device status

| Surface | Code / fixture state | External evidence |
|---|---|---|
| Stars | Existing Step 2B behavior preserved; payment regression green. New operator/no-return reconciliation and provider lifecycle work NOT completed. | No test bot, invoice, precheckout, charge or refund exercised. No provider certification. |
| TON | Internal persisted issuance/inspection foundation fixture-ready. Entire rail NOT code-ready: authenticated pre-wallet endpoint, wallet integration, positive finality, settlement and recovery remain. Legacy pay-log verifier remains unchanged and uncertified. | No selected provider schema/finality contract inspected or transaction observed in this session. No TON provider certification. |
| SOL | Existing backend, client and direct-checkout pause preserved. Secure replacement order/verifier/wallet path NOT implemented. | No devnet or mainnet evidence. No provider certification. |
| Account / iPhone | Trusted internal canonical buyer and fixture isolation only. No new account feature. | No mobile browser wallet emulation, physical iPhone checkout, account/device certification or HTTPS staging service supplied. Prior Step 1 gameplay approval remains separate. |

Positive finality evidence for both chains: **NONE**. Existing TON rejection of explicit negative statuses does not establish finality. No provider response should grant new goods until an exact unconsumed order, successful transfer, recipient, amount, reference, network and appropriate confirmed final state are positively verified. The full adversarial proof suite (pending/missing/failed/bounced/unfinalized, forged/old reference, wrong buyer/destination/amount, age/slot, replay and provider outage) is still required. New issuance fixtures do not cover those unimplemented contracts.

## Remaining engineering, in order

1. Complete TON independently authenticated website order handler and TON Connect exact payload; settle cross-rail reservation races and reject legacy unbound checkout. Validate the actual selected TON provider schema and independently trustworthy finality/inclusion evidence. Unknown/missing status must fail closed. Implement idempotent order consumption + grant + receipt/pending accounting and late-paid eligibility holds. Add focused proof/reconciliation races and interruption tests before connecting wallets.
2. Replace SOL with server-priced fresh buyer/goods/recipient/amount-bound orders. Use finalized successful native-transfer transaction evidence, exact unique order binding, explicit age/slot and transaction reuse protection; never reuse the old balance-delta verifier. Integrate independent-web/direct wallet flows only behind a production-default-OFF gate after tests.
3. Complete minimal authenticated, least-privilege operator reconciliation with dry-run and audit trail for held receipts, post-grant accounting, no-return accounts and historical pre-journal failures. No mass repair or refund without explicit authorization. Existing account-return sync is not a scheduler. No support/refund policy or historical correction was implemented here.
4. Complete focused provider lifecycle, persistence, mobile UI and actual no-money external tests. Add a genuinely isolated HTTPS service only when available without production effects. Do not enable payments to obtain test evidence.

Telegram policy remains a hard boundary: digital purchases inside bots/Mini Apps use Stars exclusively ([official policy](https://core.telegram.org/bots/payments-stars)). TON/SOL must be restricted to the separately accessed independent website; never steer Telegram users to evade the policy. The existing legacy TON UI/API boundary was not changed or certified here. A future API cannot rely on a client-supplied "website" flag. Canonical Telegram-linked website entitlements and policy/account-grant boundaries must be reviewed before exposure.

## External setup and $0 requirements

The environment status reported **no configured secrets, runtime variables, outbound identities or extra capabilities**. GitHub read access and git clone worked; no payment credentials or provider accounts were used or searched for. Live secrets/data were not read. No existing isolated provider-backed test service was identified/provisioned; no hosting setup was attempted.

A technical operator, not the iPhone-only owner, must prepare a separately scoped staging account/database and stable HTTPS/RP host with no production bindings. Required no-cost evidence paths, conditional on actual provider availability:

- Stars: dedicated Telegram test-environment bot/token and supported free Stars test flow following the official test instructions. Verify the isolated bot identity/environment before any invoice; never use the production bot or buy Stars. Exercise cancel/pending/precheckout/success/reordered duplicate/refund/late-paid/held behavior. Availability and credentials were not verified here.
- TON: explicit testnet wallet, recipient and provider endpoints; free faucet funds only if available. The current library's mainnet recipient/network must NOT be used to broadcast a test. Validate actual testnet finality evidence and delayed-indexing/outage behavior. No faucet availability was verified.
- SOL: isolated devnet recipient/RPC and free faucet/airdrop only if available, with finalized transaction evidence and exact transfer/reference matching. No RPC/faucet setup was verified. Never request owner funding or mainnet transfers.

After the operator supplies one isolated iPhone link, the owner can check pending/cancel/review, close/reopen and wallet return on that phone. UI fixtures prove UI only; testnet proves that network only; neither certifies mainnet configuration. If a free supported provider route is unavailable, leave its gate OPEN.

Production boundaries preserved: no merge/deploy, live DB/index/account/bot/webhook modification, invoice, wallet broadcast or refund. `GraphicsRelease.enabled=false`, SOL unavailable, unsupported website purchases denied, and optional new website-to-Telegram linking default-off remain unchanged. Prices, 25% public LP share and approved game/art/audio remain unchanged.

**One next action:** finish the TON authenticated order-to-finality/settlement contract locally, including cross-rail and legacy-path guards, before provisioning any provider checkout or re-enabling either crypto rail. Continue on this branch; do not start Step 3.
