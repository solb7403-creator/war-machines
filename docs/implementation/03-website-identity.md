# 03 — Main website as full persistent game

Priority: P0 architecture. Goal: same real game and server-backed progression across Telegram and the primary website; later reuse for Google Play and iOS. Do NOT redesign the game into multiple incompatible copies. Browser users currently have local-only account state; Telegram uses verified signed initData and server-owned account records.

Implementation: design a secure first-party web sign-in flow, account linking with Telegram by authenticated proof from both sides, stable global user identity, migration from local practice without fraudulent grants, a common backend actor and entitlements. Preserve shared js/rules.js simulation, purchases, inventory, Lab, match proofs, protections, leaderboards and referral rules. Keep local guest play sandboxed and unranked. Do not use client-chosen player IDs to retrieve other accounts. Maintain Telegram Stars in Telegram, route web payments through applicable platform-compliant providers. Future native apps require separate store-compliant payment flows.

Acceptance: website sign-in/save/reload works; Telegram-linked pilot sees same two machines; no account takeover through linking; simultaneous edits have revision safeguards; no duplicate migration/purchases; verified ranked matches and points from each platform; account recovery and unlink safety. Separate design/security review before enabling real money.

## Operations plan — Release 03
**Depends on:** stable Lab and Legacy schemas; requires a security design decision before coding credentials.

- [ ] **03.1 Architecture decision:** one canonical server account ID and entitlements across website, Telegram, eventual iOS/Android. Keep the primary website a *complete playable version with upgraded visuals*, not just a landing page. Reuse `js/rules.js` simulation and current Workers APIs.
- [ ] **03.2 Auth threat model:** select a supported, secure first-party website identity provider or audited identity protocol, with session expiration/revocation, CSRF protection, rate limits and credential recovery. Never trust a client-selected account ID, wallet address or a copied Telegram numeric ID as authentication.
- [ ] **03.3 Controlled account linking:** user proves possession of BOTH the existing Telegram session and web session before linking. Store one-way link states/nonce expiry and audit trail; implement unlink, recovery, collision resolution and denied-join tests. Do not merge purchases/airdrops from unrelated accounts automatically.
- [ ] **03.4 Web guest transition:** leave unverified browser mode as practice-only; explicitly display that points and equipment are not ranked or synced. Provide new account registration and explicit migration rules. Reject guest-forged currencies, rolls, quests, purchases and match results.
- [ ] **03.5 Server authorization:** refactor request auth into identity-independent trusted actor middleware, preserving Telegram HMAC verification. Route both platforms through identical economy, Lab, legacy, anticheat and PvP ownership checks.
- [ ] **03.6 Website main-game presentation:** upgrade garage/arena visuals and desktop responsiveness progressively, without forking physics, fairness or reward math. Verify keyboard/mouse/touch controls and performance on modest devices.
- [ ] **03.7 Payment boundary:** preserve Telegram's current Stars flows. Design compliant web purchase handling separately and later app-store payment adapters; do not activate new checkout until independent store/legal/reconciliation sign-off.
- [ ] **03.8 Security & launch:** staged testing of invalid tokens, cross-account linking, concurrency, old-state migration, phishing links, session theft, load, rollback, same-player two-device synchronization and dashboard/account privacy. Update service terms/privacy disclosures.

**Definition of done:** a verified web user and their linked Telegram identity see the *same* two owned machines, progress and legitimate gameplay, with no account takeover or double awards.
