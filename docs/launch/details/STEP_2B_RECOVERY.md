# Step 2B recovery evidence — bounded local continuation

Workspace `/workspace/lunar-commercial`, branch `feature/launch-commercial-readiness`, starting HEAD `1ecf81b323c30fa4e9177c1523b86d0f36d147a2`. No commit, push, deployment, production credential/state inspection, provider call, account mutation or payment. Every Firebase request in tests is intercepted to an in-memory emulator; the workerd test runs local SQLite and rejects any unexpected destination. No auth implementation or Worker deployment variable was changed.

## Reproduced and fixed

1. A result whose write acknowledgement was lost could be awarded again after 65 newer matches evicted its receipt. New fixture failed **6700 !== 6600** before the fix. `creditMatch` now retains its receipt with the authoritative economy transaction indefinitely. Do not compact these receipts without an audited replay-safe protocol.
2. Three immediate credit failures left no durable room intent. New fixture failed **Authoritative result must be durable before credit**. A finished seat now serializes its server-calculated reward/match inputs and display metadata into existing room DO storage; intent and one-minute retry alarm commit in one DO transaction before the DB write. Failed credits stay pending. An alarm retries all pending results; it rearms before DB operations, including after repeated outage. The existing immediate retries remain. Only finished results are stored; no simulation refactor or running-engine persistence was added.
3. A successful economy write followed by lost acknowledgement or failed room completion persistence can now replay after restart without repeated points, match count or progression. Completed room results persist for reconnect using the existing authenticated, room-bound ticket. A restarted finished room refuses new seats. Result reconnect after alarms also reads persisted completion if a failed in-memory result still exists.

Room journal size is bounded by the room's human seats. Per-pilot economy receipts grow; room records remain retained. No new scheduled task, migration or deployment config is required: the existing SQLite-backed `PvpRoom` gains its `alarm()` handler.

## Changed files owned by this recovery pass

- `worker/src/pvp.js`: finished-seat data extraction, durable outbox/alarm, replay/result reconnect, terminal-room seat guard.
- `worker/src/eco.js`: **only creditMatch receipt retention**; no payment/economy policy changes.
- `dev/tests/wtest/commercial-pvp-recovery.mjs`: outage before commit; lost DB acknowledgement; outage immediately after DB commit; persistent room completion-write failure; repeated outage; restart; alarm replay; receipt beyond 64 newer results; reconnect; durable-intent write failure prevents any award.
- `dev/tests/wtest/fakedo.mjs`: existing fixture used `storage:null`; supply cloned in-memory DO storage/transactions/explicit alarms so the existing route-to-room PvP test continues to exercise actual settlement.
- `worker/smoke-pvp-recovery.mjs`: fixture-only wrapper around the real room, real workerd + SQLite, runtime disposed/recreated against the same isolated persistence directory, pending intent/alarm survive, actual scheduled alarm completes once. No fixture route is added to production code.

## Verification commands and results

From repository root:

- `node dev/tests/wtest/commercial-pvp-recovery.mjs` — PASS. Original red assertions described above.
- `node dev/tests/wtest/commercial-pvp-settlement.mjs` — PASS concurrent/pre-write/ambiguous-response transient settlement.
- `node dev/tests/wtest/pvp.mjs` — PASS **106, fail 0** after fixture storage adapter update. Initial attempt with the old `storage:null` fixture failed room credit; this was an adapter defect exposed by the required new storage dependency, not bypassed in production.
- `node --test dev/tests/wtest/commercial-account-boundaries.mjs` — PASS **6, fail 0**, including default-off link start, inert orphan rejection, reciprocal owner contention, session lifetime/logout bounds.
- `node dev/tests/wtest/lunar-identity.mjs` — PASS authentic registration/login/optional-link fixture/Telegram-first continuity.
- `node dev/tests/wtest/web-auth.mjs` — PASS OIDC/bot-proof/session/replay/expiry/CSRF/authoritative identity.
- JS syntax checks on the two implementation files and new test/runtime scripts; `git diff --check` — PASS.

From `worker/`:

- `npm exec --yes --cache /tmp/lunar-commercial-npm-cache --package=wrangler@4 --call='node smoke-pvp-recovery.mjs'` — PASS **real workerd/SQLite DO outage, runtime restart, persisted intent+alarm and scheduled replay without duplicate credit**. Bundler emits the pre-existing duplicate `GEM` warning in generated simulation code. An initial runtime fixture used obsolete `durableObjectsPersist`, which current Miniflare's adapter ignores; switched fixture to supported `resourcePersistencePath`, then persistence/restart passed. An earlier shell invocation targeted the wrong relative test path; corrected before running the final command.

## Optional linking: safe held boundary

`WEB_TELEGRAM_LINK_ENABLED` remains absent/off. Existing confirmed ownership and Telegram-first upgrade stay supported and their existing tests pass. No orphan cleanup, link revocation, lost-passkey recovery, RP migration policy, global logout or historical-session invalidation was invented. Inert forward claims still fail closed; the existing same-user fresh-proof same-target retry remains available in an opted-in fixture. Conflicting orphan claims remain blocked.

A blind forward-claim delete is unsafe to call a completed recovery mechanism: the reciprocal owner is a separate store and outstanding link challenges can race deletion/reapproval. Existing opaque sessions may remain valid within their current lifetime. Safely enabling optional linking still needs a deliberately authorized account recovery/ownership protocol covering pending challenge cancellation, reciprocal conditional mutation, concurrency with first Telegram gameplay, and session consequences. This pass prioritizes the explicitly requested durable PvP result settlement and leaves optional linking on HOLD.

## Remaining limits: commercial launch versus strictly free beta

- **Commercial launch remains NO-GO** from this domain until held optional linking/recovery policy and real isolated staging/provider evidence are resolved alongside the other audit gates. This pass provides local evidence for durable **finished-result** settlement; it does not certify deployed Cloudflare/Firebase operational behavior.
- A crash before the result intent commits, unavailable DO storage at that boundary, or loss of a still-running simulation is not recovered. Failed durable intent storage prevents a DB award and returns the existing error result. Running-match crash recovery is still absent.
- Retries use the economy's current processing time/current record, as immediate credit did. An award delayed over a day/quest/season boundary is processed against that current state; it is not historical-period reconstruction. Interleaving later matches can affect streak order. Cross-release rule compatibility and historical season reconciliation are not certified.
- Room reconnect uses the existing 20-minute token lifetime. Beyond that, credited economy is visible by ordinary authenticated sync; no long-lived historical match-result endpoint was added. Receipt persistence is required for safety; an audited size/retention/monitoring plan remains an operational concern.
- **Strictly free beta can keep optional linking disabled** and avoid the payment/provider surface. Whether still-running-match interruption and the existing unsupported lost-passkey lifecycle are acceptable for that beta is an explicit release-policy decision; these local tests alone do not authorize a beta rollout. Existing held-feature/provider limits must remain accurately disclosed. No Step 3 action was started.
