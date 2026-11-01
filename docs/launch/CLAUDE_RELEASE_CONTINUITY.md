# Release continuity (pre-launch session, Nov 1 2026)

Resume here if a session ends. Owner works from iPhone only: no terminal steps for him.

## Phase 1 — Referrals + squads
- Branch `feat/referral-squads`. Rules: `docs/launch/REFERRAL_SQUADS.md`. Airdrop boards: `docs/launch/AIRDROP_POOLS.md`.
- Tests: `node dev/tests/wtest/referrals.mjs` (29), `referral-sim.mjs` (verdict: match bonus ON), `airdrop-sim.mjs`, `python3 dev/tests/squad-browser.py` (needs `pip install playwright` and `CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`).
- Release: merge to main auto-deploys the Worker (`deploy-worker.yml`) and DB rules (`deploy-rules.yml`, new indexes `rfs/s`, `ads/.value`). Rollback point: main before merge = `db57253`.
- Status: see the bottom of this file.

## Phase 2 — Pre-launch QA (branch `fix/prelaunch-qa`)
- Known pre-existing: `dev/tests/b2test.py` times out clicking `[data-act=vsstart]` (VS screen button re-rendered continuously) on unmodified main too.

## Phase 3 — Payments certification
- Only if network + `STAGING_*` secrets are ready. Never enable payments in production without the owner's approval.

## Status log
- Phase 1 SHIPPED: PR #25 merged as `3bd77d0` (rollback: revert it, back to `db57253`). Deploy run 41269136466 green; live `/pvp/health` = `{"ok":true}`; build `20261101031510`; Firebase rules (indexes `rfs`, `ads`) deployed.
- Phase 2 in progress on `fix/prelaunch-qa`: copy fixes, Stars-only checkout gate (`CRYPTO_PAY=false` in js/core.js), results squad-bonus line, VS no-op rebuild guard.
- Phase 3: this sandbox cannot reach api.telegram.org, testnet.toncenter.com, api.devnet.solana.com, api.cloudflare.com (proxy 403) -> not ready.
