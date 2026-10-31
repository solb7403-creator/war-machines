# Step 2 commercial launch readiness — NO-GO

Audit date: 2026-10-31. Source: `release/graphics-rc1` at `5f4886d8acabee6f80ae625c1ac18d1d39460c51`. Work: `feature/launch-commercial-readiness`, created directly from RC1. Initial inventory is preserved in commit `f933166`; contained fixes are in `75d4acb` and the final evidence commit. The Step 1 preview branch is not incorporated.

Verified reference heads at start: main `385356ea4ffac207900d05be6fbdf1965081fa63`; Step 1 `d78d8df4d041f8d3512a06d68aa730afc397f589`. No deployment, main merge, production DB/payment/bot/configuration change or real payment was performed. `js/graphics.js`, `js/rules.js`, prices/balance/revenue policy, Worker configuration, database rules and deployment workflows are unchanged. `GraphicsRelease.enabled=false` remains intact.

## Recommendation and status

**NO-GO for commercial production launch.** Local correctness improved and contained exploits are covered, but provider certification, held identity functionality and unresolved recovery/eligibility gates prevent a production recommendation. Passing fixtures are not evidence of live provider configuration or physical iPhone authentication/checkout.

| Area | Code status | Audit result and limits |
|---|---|---|
| Accounts / identity | IMPLEMENTED; optional linking PARTIAL | PASS local authentic passkey cryptography, virtual-passkey browser registration/return, session expiry/logout/CSRF/isolation and Telegram-first upgrade. New website-to-Telegram link initiation is default-off pending recovery work. Real Safari/Telegram provider handoff and deployed configuration UNVERIFIED. |
| Saves / two bays / Engineer | IMPLEMENTED | PASS migration, ownership, independent configurations, revisions/concurrent edits, reload, account continuity, forged-local-save rejection and backend-outage preservation. Production persistence and physical-device behavior UNVERIFIED. |
| Economy / progression | IMPLEMENTED | PASS existing authoritative economy, daily/quest/gift/crate/upgrade/refund/cap/proof tests; no balance, reward or price changes. End-to-end deployed-provider behavior UNVERIFIED. |
| Referrals / growth | IMPLEMENTED for signed Telegram entry | PASS signed canonical immutable binding, self-alias rejection, first-day eligibility, reconnect hydration, caps/carryover and farm fixtures. Independent website referral enrollment NOT IMPLEMENTED; no synthetic Telegram invite links are generated for those identities. |
| Purchases | Stars/TON IMPLEMENTED; SOL NOT READY | PASS local grant/refund/replay/ownership/accounting-retry fixtures. SOL is paused before wallet sending in game and direct checkout page and rejected by server. Stars/TON real-provider/finality/quote-eligibility certification UNVERIFIED. Website checkout is intentionally unsupported. |
| Online PvP | IMPLEMENTED | PASS 106 server assertions, transient settlement response-loss regression, actual local workerd + SQLite DO/WebSockets, two browser clients' networked movement/reconnect. No live matchmaking was used. Sustained outage/restart settlement recovery NOT IMPLEMENTED. |
| Website / Telegram access | IMPLEMENTED | PASS original website and Mini App fixture navigation at 320/390/430px, account/shop/quest/rank access, no-WebGL fallback and preserved graphics gate. SDK/provider/browser transports are isolated fixtures. Physical Safari passkeys/Telegram handoff/paid checkout UNVERIFIED. |
| Leaderboard / airdrop | PARTIAL | Existing ranking/weighted credit/snapshot export exist. FAIL exact snapshot candidate completeness. No audited token allocation amount, token claim endpoint or distribution implementation; existing guarantee copy is not certification. |

## Verified defects and changes

Severity follows the owner's policy: unauthorized account access/items or exploitable grant paths are P0 even where the detailed working notes originally called them P1.

- **P0 identity access — fixed/contained:** an expired link could leave an authorizing forward mapping; competing link approvals could overwrite reverse ownership. `worker/src/web-auth.js` and `lunar-identity.js` now require reciprocal confirmed ownership, atomically claim reverse owner, refuse fallback identity creation from invalid mappings and report confirmed status only. New `/auth/lunar/link/start` is held unless `WEB_TELEGRAM_LINK_ENABLED=1`; no deployment variable was enabled. Existing confirmed links and Telegram-first upgrades remain supported.
- **P0 item replay/refund integrity — fixed:** after 12 newer purchases, a delayed Stars callback could regrant goods; a success replay could erase a refund tombstone. `worker/src/index.js` now commits durable charge receipts with inventory, preserves terminal refunds, and pins each charge to its original economy/Telegram owner. Known-charge refunds work even if later identity mapping is broken. Legacy receipts are recognized without adding revenue again.
- **P0 SOL grant exploit — contained:** an unavailable price feed plus zero amount and an unrelated historical proof could grant paid goods. SOL is rejected before proof consumption; `js/net.js` and standalone `pay.html` stop before opening/sending from a wallet. SOL must not be re-enabled without server-issued buyer-bound orders and confirmation tests.
- **P0 referral reward abuse — fixed:** unsigned body inviter could override a signed invitation, old accounts could be captured and concurrent syncs could change inviter. The signed `start_param` is authoritative; canonical/self-alias checks and immutable first-day binding live in the economy CAS. `js/net.js` hydrates canonical inviter on fresh devices; `js/core.js` prevents invalid independent-site invite URLs.
- **P1 accounting/recovery — fixed within tested scope:** duplicate callbacks inflated revenue, and failures after inventory commit could lose accounting updates. Durable receipt projections and conditional per-event revenue accounting allow Stars/TON retries without duplicate grants or revenue. Revenue valuation and sharing rules are unchanged; journals are not a background reconciliation service.
- **P1 transient PvP settlement — fixed within tested scope:** room-generated result keys, transactional receipts and three immediate retries recover pre-write failure or an ambiguous post-write response without duplicated points/progression. `worker/src/pvp.js` / `eco.js` retain only a bounded 64-result immediate-retry window; this is not durable room/outage recovery.
- **P1 false logout success — fixed:** `web/game.js` previously redirected even if logout failed. It now retains the authenticated page, reports failure and allows retry; only successful invalidation ends the session. Browser reproduction failed before the fix and passes afterward.

Independent bounded review found a refund-owner lookup ordering issue; it was reproduced and fixed before final verification. No other concrete P0/P1 regression was identified in that review. See [accounts](details/ACCOUNTS.md), [payments](details/PAYMENTS.md) and [economy/referrals](details/ECONOMY_REFERRALS.md) for implementation boundaries and caveats.

## Targeted verification actually run

All Worker tests use dummy credentials and reject or mock external provider/database requests. Browser requests to the game API/database names are intercepted to loopback fixtures. WebSocket browser traffic goes only to the local test server. The workerd test substitutes only provider/database transport and uses real local SQLite DOs/WebSockets. There were **zero production writes and zero real-money operations**.

| Command (repository root unless noted) | Final result |
|---|---|
| `node dev/tests/wtest/test.mjs` | PASS 189, fail 0 |
| `node dev/tests/wtest/lab.mjs` | PASS migration/isolation/ownership/revisions/six-mode snapshots/PvP gear resolution |
| `node dev/tests/wtest/farm.mjs` | PASS 49, fail 0 |
| `node dev/tests/wtest/pvp.mjs` | PASS 106, fail 0 |
| `node dev/tests/wtest/commercial-payments.mjs` | PASS 33, fail 0; all outbound mocked |
| `node dev/tests/wtest/commercial-referrals.mjs` | PASS 14 |
| `node dev/tests/wtest/commercial-pvp-settlement.mjs` | PASS concurrent settlement, pre-write failure and lost-response retry |
| `node --test dev/tests/wtest/commercial-account-boundaries.mjs` | PASS 6, fail 0 |
| `node dev/tests/wtest/web-auth.mjs` | PASS OIDC/bot proof/session/replay/race/expiry/CSRF/authoritative identity |
| `node dev/tests/wtest/lunar-identity.mjs` | PASS registration/real WebAuthn fixture/login/link guards/Telegram-first upgrade |
| `node dev/tests/web-login.mjs` | PASS entry/routing contracts |
| `node dev/tests/wtest/lab-parity.mjs` | PASS stock stats/rewards and snapshot-bound proof in six modes |
| `node dev/tests/commercial-browser.cjs` | PASS virtual passkey -> actual Worker verification; tabs at 320/390/430; reward; two bays; reload; logout/return; failed logout/backend outage; no-WebGL; no uncaught errors/unexpected external requests |
| `python dev/tests/commercial-telegram.py` | PASS original Mini App fixture; same widths/tabs; signed referral; two-client online match/movement/reconnect; no uncaught errors |
| From `worker/`: `npm exec --yes --cache /tmp/lunar-commercial-npm-cache --package=wrangler@4 --call='node smoke-runtime.mjs'` | PASS real local workerd/SQLite sessions, account-read outage fail-closed, matching/fight/movement, 15 snapshots/s, authenticated website WS, replay/logout |
| `node dev/tests/wtest/commercial-snapshot-readiness.mjs` | **FAIL — retained P1 readiness gate**, highest-credit eligible pilot omitted |
| Syntax checks for edited JS and `git diff --check` | PASS |

The snapshot fixture seeds 2,000 profiles with points=201/credit=101 and one with points=200/credit=200. The current points-prefilter excludes that true highest-credit pilot before sorting by credit. This is a known failure, not a green test. No full graphics stress/release matrix was rerun. Runtime bundling emits the existing duplicate GEM-key warning in generated simulation output; the runtime checks pass and the duplicate export was not changed.

## Remaining P0/P1 and release gates

1. **Provider gates / NO-GO:** no live or sandbox-provider invoice/confirmation/refund was submitted. Certify Stars and TON on a safely isolated provider setup, including outstanding/stale quotes, limited offers, season boundaries, price changes, finality, pending/cancelled/failed payments and reconciliation. Current precheckout does not persist/consume server quotes or recheck all offer eligibility. TON feed confirmation does not explicitly establish finality. SOL remains NOT READY/paused; website purchases are unsupported.
2. **Optional-link P1 HOLD:** keep `WEB_TELEGRAM_LINK_ENABLED` absent/off. Expired/losing claims can remain inert; the same user can retry fresh proof for the same unlinked target, but conflicting orphan claims require an audited recovery process. Link-versus-first-gameplay concurrency remains unverified. If historical bad mappings existed, opaque sessions already issued through them can survive their existing 8h idle/24h absolute lifetime; the audit did not inspect live identities. Address revocation in release planning without silently moving/orphaning progress.
3. **PvP recovery P1 gate:** three immediate retries cover transient transport loss, not prolonged database outage, process restart, or durable replay/reconciliation of unfinished settlements. No claim of durable match recovery. Deployed DO behavior and outage settlement need separate evidence before a commercial reliability sign-off.
4. **Airdrop P1 gate:** fix candidate completeness using an audited credit index/legacy migration/pagination strategy before any real eligibility snapshot. Current `database.rules.json` has no `ac` index. Align public top-1,000/weighted-credit/independent-account policy with actual implementation; allocation/claim/distribution are not implemented and must not be promised as completed.
5. **Account lifecycle evidence:** passkey recovery/additional credential/revocation/global logout are absent; lost credentials can strand website access and the login page warns about this. Registration/upgrade partial-write recovery and cross-tab duplicate-credential failures lack full coverage. Confirm supported recovery policy and final RP hostname; changing hostname can strand existing passkeys. No actual Safari/Telegram auth/checkout certification was performed.
6. **Operations:** paid receipts and revenue event journals grow permanently to prevent replay; retain replay protection in any future compaction. Retryable receipts are not scheduled reconciliation, and historical aggregate revenue was not recomputed. Live Firebase rules/indexes/ETags, bot configuration, provider retries, cron/leaderboard projection and production service state remain UNVERIFIED.

## iPhone-only owner checks (after isolated commercial staging is configured)

- In Safari on the final RP hostname, create a dedicated test account with Face ID/passkey; cancel one prompt, retry, sign out and return. Use Safari Private Browsing as a separate session check on the same phone. Real cross-device credential sync remains unverified; no second device is required for this checklist.
- Rename/configure both bays, activate one, reload/background/resume and verify the same identity, inventory and earned balance. Claim daily reward twice and confirm one award. Check Garage, Engineer, Shop, Quests and Ranks.
- With prepared staging Telegram test identities, check bot -> Mini App and bot -> Safari sign-in, then Telegram-first passkey upgrade without changing progress. New website-to-Telegram linking should show unavailable while held. Do not enable the flag for owner experimentation.
- Exercise a signed staging referral using test inviter/invitee accounts and confirm canonical squad membership and single claims; independent website enrollment should be described as unsupported.
- Check Stars/TON only in an explicitly prepared no-money provider sandbox/mock. Do not approve a real wallet send or real Stars purchase. SOL should show unavailable even from an old direct checkout URL. Physical checkout/provider evidence is still a release gate.

## Resume instructions and preserved sequence

Continue from this branch only. Install the pinned Worker dependency with `npm install --prefix worker --no-audit --no-fund --package-lock=false --cache /tmp/lunar-commercial-npm-cache`. For website browser checks run `node worker/build-web.mjs`, then `LUNAR_FIXTURE_PORT=8798 node dev/tests/webserver.mjs` in a retained process before the browser command. Browser tests require Playwright and Chromium; Telegram uses the existing hermetic harness/devserver. Its `LocalNetworkAccessChecks` launch flag is solely for Chromium's routed-origin-to-loopback fixture transport, not production settings. Website uses a virtual authenticator, not owner credentials.

Machine-readable browser summaries are in `docs/launch/evidence/`; detailed audit notes are in `details/`. Generated `worker/site-assets`, `worker/src/sim.gen.js` and installed `worker/node_modules` are not part of the change. Do not run production diagnostics merely because a workflow calls itself read-only: the existing pilot-check workflow contains database writes and bot calls.

**Single recommended next action:** keep Step 3 blocked and clear the documented provider, identity-recovery and settlement/eligibility gates in an isolated commercial certification follow-up on this branch. No production rollout is recommended.

STEP 1 COMPLETE — owner personally played all six modes on iPhone and approved gameplay/graphics.
STEP 2 COMPLETE — this audit, contained fixes, targeted evidence and accurate NO-GO handoff.
STEP 3 NOT STARTED — only after owner approval and real gates: one consolidated main-bound PR/merge, deliberate graphics activation, deploy once, verify website/Telegram/Worker services, monitor and follow rollback.
Post-launch P2: audio follow-up and cosmetic/attachment differentiation remain deferred. No sound/art/engine redesign was done.
