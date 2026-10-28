# 02 — Machine Legacy and mastery

Priority: P0, next after battle roster. Goal: make each war machine personal. Add an immutable machine ID and server-owned per-machine lifetime records: matches, wins/losses, eliminations, damage, objectives, favorite weapon/mode, badges and earned cosmetic flair. Preserve personal machine history when weapon/chassis and name change. Do not accidentally award the same recorded game twice.

Implementation: use the actual stable Laboratory machine IDs and the existing authoritative account/match ticket pipeline (AI and live PvP). Freeze active machine ID in each match ticket or room seat; credit only on verified completion. Extend account schema and migration safely, rate-limit history writes, add Garage 'Machine Legacy' panel, achievements and Telegram-shareable readonly profile. Cosmetics and achievements must not increase PvP power or airdrop points by default. No buyer-only historical advantage.

Acceptance: independent records for both machines; client cannot spoof stats or ID; retries idempotent; leaving/forfeiting handled consistently; progress survives webview reload; private fields protected; all six modes and 1v1/2v2/3v3 tested. Roll out behind migration/version safeguards.

## Operations plan — Release 02
**Depends on:** Release 01 frozen active machine, match ticket/proof and PvP seat identity.

- [ ] **02.1 Define record:** use existing immutable machine keys (e.g. `m_legacy`, `m_spare`) and a versioned `legacy` dictionary keyed by machine ID. Keep ownership separate from cosmetic name; names can change, history cannot transfer or be duplicated.
- [ ] **02.2 Define verifiable events:** matches started/completed, win/loss/draw, eliminations, damage, objective score, mode, equipped archetypes and personal bests. Specify whether training/free tests contribute (**default: no reward-bearing history**) and how quits/AI fallbacks count.
- [ ] **02.3 Authoritative plumbing:** extend AI match ticket and live PvP seat with registered machine ID *before* first combat tick. On accepted outcome, update only that machine on the server using the existing idempotent match-result transaction; client-provided totals and machine IDs are never trusted.
- [ ] **02.4 Schema/migration:** support existing Telegram accounts with `lab.v===1`, old tickets and reconnects. Initialize missing histories at zero; do not invent historical wins from account totals or rename timestamps. Version the schema, retain backward reads.
- [ ] **02.5 Player presentation:** add machine-specific Legacy tab inside each bay: record, mastery progress, title, earned cosmetic distinction, and 'Share machine' preview. Make a share-safe public profile with no Telegram ID, payment/wallet or internal anti-farm signals.
- [ ] **02.6 Reward design:** small milestones for meaningful achievements (first win, 10 wins, 100 wins, mode specialist, clutch wins). Prioritize unique visual rewards; never add hidden weapon damage, unbounded points or premium-only rank advantages.
- [ ] **02.7 Test:** AI and live PvP in all modes, match ticket retry/duplicate, reconnect/rejoin, two machines alternating, rename, purchases, old-state migration, corrupted input, privacy, and 320/390/430px UI. Preserve all old economy/PvP/anti-farm tests.
- [ ] **02.8 Launch gate:** staged, reversible schema flag; verify no duplicate record on retry, genuine server stats and separate machine histories. Add measurement for Legacy opens, shares, and return sessions.

**Definition of done:** every machine has an honest, persistent, independent legacy that grows through legitimate play.
