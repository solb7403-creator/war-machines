# 02 — Machine Legacy and mastery

Priority: P0, next after battle roster. Goal: make each war machine personal. Add an immutable machine ID and server-owned per-machine lifetime records: matches, wins/losses, eliminations, damage, objectives, favorite weapon/mode, badges and earned cosmetic flair. Preserve personal machine history when weapon/chassis and name change. Do not accidentally award the same recorded game twice.

Implementation: use the actual stable Laboratory machine IDs and the existing authoritative account/match ticket pipeline (AI and live PvP). Freeze active machine ID in each match ticket or room seat; credit only on verified completion. Extend account schema and migration safely, rate-limit history writes, add Garage 'Machine Legacy' panel, achievements and Telegram-shareable readonly profile. Cosmetics and achievements must not increase PvP power or airdrop points by default. No buyer-only historical advantage.

Acceptance: independent records for both machines; client cannot spoof stats or ID; retries idempotent; leaving/forfeiting handled consistently; progress survives webview reload; private fields protected; all six modes and 1v1/2v2/3v3 tested. Roll out behind migration/version safeguards.
