# Combat release: AI scaling, Survival, ghosts (build 20261031-combat1)

- PR: #23 `fix/combat-progression-balance` → `main`, merged once (merge commit, no force-push).
- Code reviewed and tested at `bb50f1e`; this note was added afterwards (docs only).
- **Rollback point:** `main` @ `9752967` (Live nonpayment gear release, #22). To roll back, revert the #23 merge commit in a normal revert PR and merge it; the deploy workflow redeploys Worker + Pages. No data migration, so player gear, points, receipts and saves are untouched either way.
- Deploys: `.github/workflows/deploy-worker.yml` (Worker, Telegram webhook refresh) and GitHub Pages, both from `main`.

## What changed
AI pilots fly authored loadouts at AI power 68 × (your power / 68)^0.75, shown on the VS screen, and never copy your gear. The Survival megatank is tuned to an AI reference tank, not your tank. AI-match ghosts are 0.70–0.95× your power, at most one enemy seat. No counter-switch against one-chassis pilots. Bounty spread targeting. Details and every table: `docs/combat-balance-audit.md`.

## Numbers (real game code, 24 seeds × 11 mode/sizes, same seeds both sides)
Average win rate, starter → common → rare → Epic → Legendary kit (Moonbeam + Lunar Skin + Colossus + Gold Plate):
- Gear + upgrades: before 55 / 59 / 74 / 87 / 90% → after 59 / 61 / 69 / 79 / 92%
- Gear only: before 55 / 55 / 59 / 71 / 83% → after 59 / 64 / 68 / 79 / 87%
- Legendary pilot offered two max-gear ghosts: before 8% (1v1 Arena) / 0% (3v3) → after 100% / 92% (ghosts no longer seated)
- Survival: starter unchanged (83% solo); Legendary 92% → 100%, boss down in 34 s solo.

Simulations, not device tests. The physical iPhone check is the owner's.
