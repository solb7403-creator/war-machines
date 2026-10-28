# 07 — Revenue through expression rather than mandatory power

Priority: P1. Existing shop includes crates, Moonbeam, cosmetics, pass and Vault. The next revenue opportunity should improve the two-machine ownership experience without making paid spending a requirement for winning or earning fair progression.

Implementation: machine-specific cosmetics, rare visual finishes, projectile skins without altered hitboxes, kill effects, Garage hologram bay themes, expressive banners, earned-vs-paid decals, seasonal collections, and profile cosmetics. Maintain clarity around consumables, loot odds, pack contents, prices and refund pathways. Evaluate conversion and payer retention with real cohort metrics before large ad spend. Preserve current 75% operations/development/marketing and 25% public liquidity reporting; accounting must derive only verified settled transactions, less refunds and fees as defined, not client claims.

Acceptance: every cosmetic has no combat/math impact; verified payments grant entitlements exactly once; refunds remove or reconcile them per policy; web/Telegram/native purchases respect each platform's requirements; purchase price parity and taxation reviewed; transparent spend totals; zero misleading reward/return guarantees.

## Operations plan — Release 07
**Depends on:** 02 identity/legacy, 04 actual funnel metrics, 05 premium fairness. Any new checkout path also depends on 03 platform authentication and compliance.

- [ ] **07.1 Audit store:** enumerate existing crates, Moonbeam, Lunar Pass, paint, skins, Starter/Founder, Vault, Stars/TON/SOL prices and owned entitlements. Separate cosmetic-only from power-bearing products; disclose pack contents/odds clearly.
- [ ] **07.2 Customer value thesis:** prioritize two-machine expression: Garage bay themes, personalized engine trails, projectile *visuals* (same hitboxes), personalized banners, signature kill effects, earned-and-premium decals, seasonal finishing sets. No compulsory spending for normal progression.
- [ ] **07.3 Product rules:** define item catalog IDs, restrictions, rarity/availability, gifting policy if any, one-time vs consumable, cosmetic equip slots and clear previews in both machine bays. Cosmetic purchase must never alter official damage/hitboxes/proof.
- [ ] **07.4 Server entitlements:** verified invoice/payment → single grant; durable ownership on linked account, receipt history, duplicate prevention, timeout retry, cancellation, chargeback/refund reconciliation and accurate cross-platform displays.
- [ ] **07.5 Platform paths:** Telegram Stars only where permitted under Telegram terms; web checkout subject to web payment rules; native Android/iOS digital items subject to current applicable app-store policies. Do not assume one wallet payment integration can legally cover all three.
- [ ] **07.6 Financial policy:** 75% for operations/development/advertising/compensation and 25% for public LP *as stated*. Establish gross vs net definitions, payment fees, refunds, treasury transaction log and reconciliation; never present a transfer as executed until chain-confirmed.
- [ ] **07.7 Experiments:** after analytics is reliable, test different presentation and cosmetic collections with transparent opt-in controlled exposures; measure payer conversion, refunded transactions, D7 retention and net revenue per acquired player. Avoid high-pressure dark patterns.
- [ ] **07.8 Quality/release:** run existing payment replay/idempotency suites, wallet tests using isolated fixtures, entitlement sync across Telegram/web, invoice error handling, proof/account defenses, accessibility and refund support; obtain explicit approval for financial changes.

**Definition of done:** additional attractive purchases improve machine identity without making combat or airdrop fairness dependent on paying, and every paid grant/LP record reconciles.
