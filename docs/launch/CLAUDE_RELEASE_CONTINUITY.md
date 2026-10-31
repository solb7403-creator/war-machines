# Claude release continuity — LUNAR: War Machines

Read this first on any resumed session, then `PAYMENT_COMPLETION.md`, then refresh GitHub heads.

## Current state (2026-10-31)
- Branch `feature/launch-commercial-readiness`, draft PR #21 → `release/graphics-rc1` (`5f4886d`). Main `385356e` untouched. Nothing deployed, merged or migrated.
- `GraphicsRelease.enabled=false`; website-to-Telegram linking off; all payment routes default-off in production.

## This session's changes (staging isolation — release-critical safety)
1. **Production database leak fixed.** The Firebase URL was hardcoded (`worker/src/db.js`), so any staging Worker would have written to live player data. `dbBase(env)` now: production always uses the production DB; `LUNAR_STAGE=staging` uses only `FIREBASE_DB_URL` with no fallback.
2. **Fail-closed staging guard** `stageProblem(env)`: staging answers 503 and runs no cron jobs unless it has its own Firebase DB and its own origin, and is testnet-only. Stars test mode is now staging-only.
3. **Page security policy** (`/web/*` CSP) derived from the configured origin/DB; production string byte-identical.
4. **Production deploy guard**: `deploy-worker.yml` job now refuses manual runs from non-main refs (a dispatch from this branch would previously have shipped unreviewed code + the PAYMENTS migration live).
5. **Staging Worker** `[env.staging]` in `worker/wrangler.toml` (name `lunar-api-staging`, own DOs, no crons) and manual workflow `.github/workflows/deploy-staging.yml` (refuses main, refuses production DB/secret/bot token, sets only the TEST-environment bot webhook).

## Evidence (this session, local)
| Check | Result |
|---|---|
| `staging-isolation.mjs` (new) | 11/0 |
| `payment-completion.mjs` | 80 groups / 0 fail |
| `commercial-payments.mjs` | 82/0 |
| `commercial-ton-orders.mjs`, `commercial-account-boundaries.mjs` | 0 fail |
| `test.mjs` economy | 189/0 |
| `pvp.mjs` | 106/0 |
| `web-auth.mjs`, `lunar-identity.mjs` | PASS |
| `wrangler deploy --dry-run` prod / `--env staging` | PASS, no upload; prod bindings/vars unchanged |

## Certification status by rail
| Rail | SOURCE IMPLEMENTED | FIXTURE PASS | SANDBOX REAL-PROVIDER PASS | PHYSICAL DEVICE PASS | PRODUCTION PASS |
|---|---|---|---|---|---|
| Stars | Yes | Yes | **No — blocked** | No | No |
| TON | Yes | Yes | **No — blocked** | No | No |
| SOL | Yes | Yes | **No — blocked** | No | No |

**Blocker:** this cloud session cannot reach Telegram, TON/Solana RPC or Cloudflare (allowlisted network), and cannot read/write Actions secrets or logs. Staging deploy and provider tests need the owner items below, then a session with provider network access (or the owner tapping "Run workflow").

## Owner setup ($0, iPhone Safari/apps only — secrets go into GitHub, never into chat)
1. **Staging database:** Safari → console.firebase.google.com → Add project `lunar-staging` (free Spark plan) → Build → Realtime Database → Create (locked mode). Copy its URL. Project settings → Service accounts → Database secrets → copy secret.
2. **Telegram test bot:** log Telegram into its *test* environment (Telegram's iOS debug menu: tap the Settings tab ~10 times → Accounts → Login to another account → Test), then `/newbot` with @BotFather there. Copy the token. Not the production bot.
3. **TON testnet wallet:** Tonkeeper → enable testnet (dev menu) → new wallet → copy address; request free test TON from Telegram's @testgiver_ton_bot.
4. **SOL devnet wallet:** Phantom → Settings → Developer Settings → Testnet mode → Solana Devnet → copy address; get free devnet SOL at faucet.solana.com (GitHub sign-in).
5. **Add secrets:** Safari → github.com/solb7403-creator/war-machines → Settings → Secrets and variables → Actions → New repository secret: `STAGING_FIREBASE_DB_URL`, `STAGING_FIREBASE_DB_SECRET`, `STAGING_TEST_BOT_TOKEN`, `STAGING_TON_TEST_RECIPIENT`, `STAGING_SOL_TEST_RECIPIENT`.
6. **Deploy staging:** Actions → "Deploy isolated certification staging" → Run workflow → branch `feature/launch-commercial-readiness`. The run log prints the staging URL.

## Next precise action
After step 6: run the three-rail lifecycle campaign (PAYMENT_COMPLETION.md gates) against the staging URL, record real order-bound transaction evidence here, then the owner's iPhone checklist. Owner decisions still open: final RP host/domain, lost-passkey recovery policy, disputed/refunded payment response, delayed-reward/streak policy, legacy TON pending cutover. Phase Two (one consolidated main release) only after all gates are green and explicit owner approval.
