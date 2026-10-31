# Step 2B — bounded commercial hardening, NO-GO for paid public launch

Date: 2026-10-31. Continued `feature/launch-commercial-readiness` / draft PR #21 from `1ecf81b323c30fa4e9177c1523b86d0f36d147a2`. Source checkpoint `dfebbe7f162de38a5c629d8d093754e281b552c5`; final commit adds publication-ordering protection and this handoff. Base RC1 remains `5f4886d8acabee6f80ae625c1ac18d1d39460c51`. The earlier Step 2 report is historical evidence; this document supersedes its remaining-code status.

No deployment, merge, production DB/account change, real payment, provider charge, wallet broadcast, bot/webhook configuration, live index migration or owner credential use occurred. Main, RC1 and Step 1 branches are preserved. SOL and unsupported website payments remain off; new optional website-to-Telegram linking remains disabled. Graphics gate, game mechanics, balance, prices, goods and revenue policy are unchanged. Audio, cosmetics and redesigned referrals remain post-launch.

## Results

| Target | Local result | Practical boundary |
|---|---|---|
| Original top-1,000 regression | PASS | Highest weighted-credit profile beyond the old 2,000 raw-points candidates is included after explicit local index preparation. |
| Adversarial snapshot | PASS | >2,000 held/flagged exclusions, ties spanning pages, canonical independent accounts under existing computation, missing legacy credit fallback, cleared flags, missing-index rows, index read failure, scan budget and concurrent publication changes. |
| Economy/profile ordering | PASS | A delayed revision-1 publication cannot overwrite revision 2. First-account count/max-ID metadata is preserved; export rejects pending publication and the profile-write/metadata-write gap. |
| Stars eligibility/replay | PASS fixtures | Server quotes, exact buyer/payload/amount/currency/expiry, current goods/offer/ownership/season checks, checkout reservation, atomic quote use, held paid callbacks, existing replay/refund/ownership guards. |
| TON unsafe local grants | PASS fixtures | Concurrent stale offers revalidated inside account CAS; new product-less unpriced logs rejected; explicit aborted/bounced/failed-compute/action records and failed provider responses rejected. Positive finality is NOT established. |
| Payment retry loss | PASS fixtures | Versioned durable pending journal plus authenticated sync repair, two receipts per call and durable progress after each; >=10-item backlog and second-item failure drain safely. Maximum observed complete sync cost: 36 fetches after final publication guards, below the documented 50-request Free-plan limit in these cases. |
| Durable finished PvP result | PASS | Authoritative intent+alarm commit to room SQLite storage before economy writes; alarms retry through outage/restart; permanent account receipt prevents replay after 65 newer results; reconnect recovers completed/pending result using existing authenticated ticket. |
| Optional-link recovery | HELD, no new lifecycle feature | Existing fail-closed guards and six account-boundary tests pass; no cleanup/revoke endpoint or flag enablement added. |
| Physical/provider certification | UNVERIFIED | No actual iPhone authentication/checkout, live Stars/TON provider flow or production conditional-write/index state was certified. |

## Snapshot algorithm and safe source/config preparation

`worker/src/snapshot-rank.js` encodes existing effective credit in descending numeric order and canonical account ID ascending as a unique composite sort value. Positive finite IEEE-754 encoding preserves fractional legacy values without inventing rounding. Existing numeric credit is used; missing credit falls back to points, as before. Independent Lunar accounts remain included by the existing computation. This is research ranking, not a token allocation formula or a decision about final eligibility.

`players.snapshotRankV1` has a source `.indexOn` entry in `database.rules.json`; no numeric `ac` index is assumed. The composite value avoids undocumented REST score-plus-key cursors and makes arbitrary tie groups pageable. Reads use `limitToFirst=201`, inclusive cursor with duplicate-boundary removal, and at most 20 pages. It returns exactly the highest 1,000 eligible profiles from a stable, completely indexed projection, or fewer if that population is exhausted. A resource limit raises an explicit error; it never returns a silently truncated purported top 1,000. Populations requiring more than 4,000 inspected candidates need an approved offline/continued export strategy; increasing a hidden cap is not an exactness fix.

The explicit library `backfillSnapshotPage(env,{pageSize:200})` in `worker/src/snapshot.js` prepares at most 200 profiles per invocation using key pagination and per-profile ETag writes. Cursor/completeness state is checkpointed conditionally. It changes only rank projection fields/metadata, never rewards or credit. It is not called by public requests or cron and creates no privileged HTTP endpoint. Fixture code loops these bounded calls locally. **No production backfill ran.** A technical operator/agent must validate and run approved staging preparation; the iPhone owner is not being asked to execute terminal commands.

Export fails closed unless index version/completeness is valid. It checks flagged and held roots, validates every observed rank field and rejects active publication markers. Profile publication now uses `ecoRev`+ETag to prevent older overwrite. A publication marker precedes profile PUT and is cleared atomically with the publication epoch; final marker state is read before the final epoch to close the completion-between-reads race. Concurrent/unfinished changes invalidate export rather than omit/duplicate moving profiles. A clear-all-flags action also clears the held projection.

**Remaining projection/operations gate:** the economy CAS and profile mirror are still separate operations. A failure before the marker is successfully written can leave authoritative progress without an observable publication marker; historical missing/stale profiles likewise cannot be certified from the new rank index alone. Failed/incomplete publications may leave markers that deliberately block export. There is no audited automatic historical reconciliation/marker cleanup service. Before any authoritative token-eligibility export, require controlled/quiescent reconciliation of economy/profile data, index preparation and marker review, with a reference comparison. Do not blindly delete markers or claim research ranking certifies complete authoritative eligibility. This remains a P1 code/operations limitation, not provider certification.

The public board still ranks raw lifetime points and is separate from weighted-credit research ranking. Source UI/wiki/share/bot text no longer guarantees tokens or says only Telegram accounts can appear. Allocation amounts, token claims and distribution are NOT implemented. The source changes do not decide a final allocation/independent-account policy or rewrite rewards.

## Payment and recovery changes

New Stars invoices persist immutable server quotes with ten-minute expiry and exact buyer/owner, descriptor, amount/currency/payload, day/week/season and offer conditions. Precheckout uses current server rules and CAS-reserves one outstanding account checkout; grant consumes the quote with its receipt. Old unquoted invoices cannot pass new precheckout; existing already-paid receipt/replay compatibility is preserved. A paid callback that is no longer eligible is retained as held for support/refund review rather than underpriced/current-season grants. Held goods are not acknowledged as delivered; boot/paid polling exposes review. Held refunds reverse accounting without removing unrelated existing entitlements. No automatic refund issuance or new refund policy was invented.

TON has no new pre-wallet server quote endpoint. This pass rejects concrete unsafe callbacks/records and rechecks settlement eligibility inside the CAS. **It does not close the complete TON quote/order/finality lifecycle.** Negative status rejection is not proof that an unmarked transaction is positively final.

Stars/TON receipt mutations commit versioned paymentPending records. A returning authenticated account reconciles at most two records per sync, with durable per-record cleanup. Providers never retrying no longer strands those new journaled receipts forever when the account returns. This is not a scheduler: accounts that never return, historical pre-journal failures, held payments requiring refunds and long feed/queue time limits remain operational gates. Permanent receipts/quotes/revenue journals need replay-safe retention planning.

Finished-seat PvP intents persist calculated inputs/display metadata plus the one-minute retry alarm in one room storage transaction. After prolonged DB outage or runtime restart, the alarm replays against the permanent transactional account receipt and stores completion. Running simulations are not persisted. A crash before durable intent commit, unavailable intent storage, day/season boundaries, streak order after delayed delivery and cross-release compatibility remain limits. Delayed delivery uses the existing current-processing-time economy behavior, not historical-period reconstruction. The owner must explicitly accept or define that policy before competitive reward sign-off.

See [payment evidence](details/STEP_2B_PAYMENTS.md) and [recovery evidence](details/STEP_2B_RECOVERY.md). Their max-fetch figure before the final mirror guard was 27; the integrated final fixture observed 36.

## Targeted verification

Final source checks, all with dummy identities and mocked/rejected provider/database transport unless explicitly local workerd:

- `node dev/tests/wtest/commercial-snapshot-readiness.mjs` — PASS. Original red assertion and additional publication-completion race were reproduced before correction.
- `node dev/tests/wtest/commercial-projection-readiness.mjs` — PASS. Original red result was profile100 versus authoritative300 after reordered writes. Also covers publication gap and preserved first-account max-ID metadata.
- `node dev/tests/wtest/commercial-payments.mjs` — 81 PASS, 0 FAIL; maximum complete sync fetch count36, all outbound mocked. Original33 safety checks retained; added quote/offer/season/finality-negative/review/reconciliation/budget regressions.
- `node dev/tests/wtest/commercial-pvp-recovery.mjs` — PASS outage/restart, response/completion loss, repeated alarms, durable-intent failure, reconnect and receipts beyond64 newer results.
- `node dev/tests/wtest/commercial-pvp-settlement.mjs` — PASS existing immediate retry/concurrency regression.
- `node dev/tests/wtest/pvp.mjs` — 106 PASS, 0 FAIL.
- `node dev/tests/wtest/test.mjs` — 189 PASS, 0 FAIL; its snapshot fixture now performs explicit local bounded index preparation, not an automatic production scan.
- `node --test dev/tests/wtest/commercial-account-boundaries.mjs` — 6 PASS, 0 FAIL; new-link default-off/session/isolation guards preserved. Existing web-auth/lunar-identity suites also passed during recovery work; no auth implementation changed.
- From `worker/`: `npm exec --yes --cache /tmp/lunar-commercial-npm-cache --package=wrangler@4 --call='node smoke-pvp-recovery.mjs'` — PASS real local workerd+SQLite, runtime disposal/recreation, persisted intent/alarm and actual scheduled replay without duplicate awards. Existing generated duplicate GEM-key warning remains, not a test failure.
- `node dev/tests/commercial-browser.cjs` against the disposable localhost8798 Worker fixture — PASS virtual passkey registration/return/logout, bays/reload/claim/client-forgery/outage, tabs320/390/430, no-WebGL and graphics gate. No uncaught errors or unexpected external requests. This is Chromium emulation, not new physical-iPhone evidence.
- Edited JS syntax and `git diff --check` — PASS. No graphics/practice stress matrix rerun.

## Gates: monetized launch versus possible strictly free beta

| Remaining item | Classification | A: full paid public launch | B: strictly free limited beta |
|---|---|---|---|
| Stars provider invoice/precheckout/pending/cancel/paid/refund/retry certification | EXTERNAL CERTIFICATION | BLOCKS | Can be excluded only if paid paths are server-enforced off, not merely hidden |
| TON persisted pre-wallet quote/order lifecycle, positive finality/refunds | CODE + EXTERNAL CERTIFICATION | BLOCKS offered TON purchases | Must exclude all paid paths; SOL/website payments already off |
| Held-sale support/refund service and no-return/historical reconciliation | CODE/OPERATIONS + OWNER POLICY | BLOCKS unconditional monetized sign-off | No new paid activity; historical paid-account handling must still be safe |
| Authoritative profile reconciliation, orphan publication repair, staged index/backfill | CODE/OPERATIONS | BLOCKS authoritative eligibility exports; cannot promise tokens | Can defer token eligibility entirely with accurate research-rank disclosure |
| Running-match crash recovery, delayed reward period/streak semantics | CODE LIMIT + OWNER DECISION | Needs competitive reward acceptance/evidence | Owner may accept disclosed interruption limits; tests alone do not authorize beta |
| Optional-link orphan cleanup/revoke/recovery | HELD FEATURE + OWNER DECISION | No need to enable optional feature; keep disabled | Keep disabled; no blind ownership cleanup |
| Final RP hostname, credential-loss/revocation policy, historical session handling | OWNER DECISION + DEVICE CHECK | Must explicitly settle supported account policy | Also required for an account-based beta; do not migrate identities silently |
| Actual Safari/Telegram passkey/handoff/reconnect/review UI | PHYSICAL IPHONE CHECK | Required | Required for account-based beta; Step1 gameplay approval is separate evidence |
| Token allocation/claim/distribution and final allocation policy | NOT IMPLEMENTED + OWNER DECISION | No token program may be promised as implemented | Exclude token promises and claims |

**A — NO-GO.** Fixes are reviewable source changes, not deployed/certified commercial services.
**B — conditional candidate only, not a GO or a deployment authorization.** This task did not add or enable a server-wide no-payments beta configuration. A free-beta decision requires explicitly disabling every paid entry server-side, confirming account/RP disclosures and phone flows, and excluding token/optional-link promises. The already approved account-free Step1 practice preview remains separate; it does not certify accounts or paid services.

Smallest next technical action: prepare an isolated, stable-host commercial certification environment with approved projection/index preparation and no-money provider routes; close TON quote/finality and held-sale/reconciliation policy before any full paid release. No request for secrets in chat or owner desktop use is appropriate. If a provider has no verified no-charge test path, keep certification open instead of requesting a real payment.

## iPhone route and reserved Step3 plan

A technical operator should provide one staging HTTPS link on the intended RP host after separately approved setup. Owner checks on the same iPhone: Face ID create/cancel/return/logout and Private Browsing session isolation; both bays/reload/background; bot-to-Safari/Telegram-first continuity; mocked/sandbox pending/review/refund messages and close/reopen recovery; SOL unavailable. Use a verified provider test bot/network only if it is genuinely no-charge. A phone mock proves UI, not provider settlement. A second device/passkey synchronization remains explicitly unverified; it is not demanded from this iPhone-only owner.

Step3 remains RESERVED FOR SEPARATE APPROVAL: finish remaining required code/operations/provider/device/policy gates; review one consolidated main-bound PR; stage/test index and persistence preparation with a safe rollback plan; deliberately choose graphics activation only in that approved release; merge/deploy once; smoke website+Telegram+Worker services; monitor rewards/payments/alarms/held work and rollback on agreed thresholds. No merge, deployment, flag activation or live migration was performed here. Rollback must retain receipts/outboxes and must not strand passkeys or use an old snapshot path as certified eligibility.
