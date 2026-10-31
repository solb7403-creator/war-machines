# Step 2 commercial readiness — working audit

Baseline verified remotely: release/graphics-rc1 `5f4886d8acabee6f80ae625c1ac18d1d39460c51`; main `385356ea4ffac207900d05be6fbdf1965081fa63`; Step 1 `d78d8df4d041f8d3512a06d68aa730afc397f589`. Work branch: feature/launch-commercial-readiness, from RC1 only. No deployment or main-bound merge is authorized.

## Initial code-grounded risk inventory

| Area | Initial status | Code and risk to verify |
|---|---|---|
| Website accounts/passkeys | IMPLEMENTED / provider UNVERIFIED | worker/src/lunar-identity.js and web-auth.js; registration/login/challenges, session DO, linking conflicts and atomicity; browser WebAuthn and cross-device credential availability need evidence. |
| Telegram identity/session | IMPLEMENTED / live configuration UNVERIFIED | index.js auth and web-auth.js; signed initData, bot exchange/OIDC and canonical account resolution. |
| Saves/two bays/Engineer | IMPLEMENTED | eco.js transactions and rules.js Lab revisions; test migration, stale/concurrent writes, owned-only gear and reload continuity. |
| Economy/progression | IMPLEMENTED | server eco.js + rules.js: daily/quest/gift/crate/match settlement; verify caps and replays using existing worker fixtures. |
| Referrals/squad | IMPLEMENTED, trust/atomicity UNVERIFIED | core.js captureRef/refBy, index.js sync/squad, eco.js claims/farm.js; verify signed entry versus client claims, first binding and old-account eligibility; independently created website accounts may lack equivalent flow. |
| Stars/TON/SOL | IMPLEMENTED code / provider UNVERIFIED | index.js invoice/webhook/on-chain checks, eco.js fulfillment; inspect quote binding, retries, receipts, refunds and idempotence. Only mock providers allowed here. |
| Online PvP | IMPLEMENTED / actual Worker runtime UNVERIFIED | pvp.js lobby/room DOs + WebSocket tokens, authoritative sim/settlement, frozen inventory; test local transport fixtures, not production matchmaking. |
| Leaderboard/airdrop | PARTIALLY IMPLEMENTED | board/tier/eligibility copy exists; token distribution or enforceable allocation not established by this code. No allocation promised by this audit. |
| Mobile access/release gate | IMPLEMENTED / device auth UNVERIFIED | web boot/login/account/shop and Telegram index; browser fixture checks required; graphics.js enabled=false stays unchanged. |

Plan: audit independent auth, payment and economy/referral domains; run existing focused commercial/identity/Lab/PvP fixtures; reproduce important gaps before contained fixes; verify mobile essential navigation with isolated Worker fixtures; commit/push evidence and issue a precise GO/NO-GO. Do not repeat graphics stress matrix.

## Preserved sequence

Step 1 COMPLETE: owner personally played all six modes on iPhone and approved graphics. Preview proves neither commercial providers nor ranked online service readiness.
Step 2 THIS TASK: commercial/account/progression/referral/payment/PvP audit and critical fixes only.
Step 3 DEFERRED: after owner approval and real release gates, one consolidated main-bound PR/merge, deliberate graphics activation, one deployment, website/Telegram/Worker smoke, monitoring and rollback.
Post-launch P2: preview audio follow-up and equipment/cosmetic differentiation. No audio/art/balance/pricing/revenue redesign here.
