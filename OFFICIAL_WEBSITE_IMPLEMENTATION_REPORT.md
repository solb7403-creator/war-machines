# Official Website Implementation Report

Status: implemented and tested in isolation; ready for BotFather configuration. **Not deployed, not live-authenticated.** Production Telegram remains on `cce1c29cfc99548259c1f993d261decb34dea8b7`, build `20261028191644`.

Branch: `feature/official-lunar-website`, based on current main. All Sessions 2–4 and equipment-balance commits are preserved. The delivered commit and remote branch verification are recorded in the final handoff copy of this report.

## Website and visual experience

Intended address after activation: **https://lunar-api.solb7403.workers.dev/web/**. This is an intended address, not a claim that the new site is currently live.

- New cinematic landing page with lunar art direction, an interactive actual-geometry War Machine, three chassis previews, six combat-mode presentations, engineering/progression sections, clear login/play/garage/rankings/wiki links and social metadata.
- Distinct desktop cockpit: mission navigation, a large illuminated machine showroom and the existing game panels. Mobile layouts retain touch navigation and safe areas.
- Garage/Engineer use the original procedural chassis, weapons and fitting geometry. Drag/rotate/zoom controls, bounded lighting, visible fitted changes and actual owned-machine statistics. Two independent bays still use one inventory.
- Reuses the real six-mode game, shared rules, PvP, Garage, engineering and isolated free practice; no new combat engine or frontend framework. The 2D fallback uses the existing game drawing code. Unsupported 3D inspection controls are disabled and labelled.
- One additional bounded showroom renderer, maximum device pixel ratio 1.5, reduced-motion support, visibility/battle suspension and geometry/resource disposal. No large new image/model downloads; the new website source is about 68 KB before compression and uses existing fonts/Three.js/models.
- Desktop/mobile landing, Garage, Engineer, battle navigation and fallback screenshots captured and visually inspected in `/workspace/lunar-website-evidence/`. Corrected an unsupported helper in the lightweight Three.js build, phone control sizing, header wrapping and inspection-panel overlap.

## Secure shared identity and progression

Uses the **official Telegram Login library** and server-side OIDC ID-token verification, following https://core.telegram.org/bots/telegram-login. The verified profile `id`, not OIDC `sub` or a client-supplied ID, maps to the original `tg_<id>` account. RS256 algorithm/signature/JWKS, exact issuer/audience, expiry/issued-at and server-issued nonce are checked. Challenge consumption is atomic, one-use and browser-cookie-bound.

Website/API/socket hosting is first-party on the existing Worker origin. Secure `__Host-` HttpOnly SameSite=Lax session cookies avoid reliance on third-party workers.dev cookies from GitHub Pages. Mutations require exact origin and a session CSRF token; web socket tickets additionally require the matching session and origin. Sessions expire after 8 hours, renew only within a 24-hour absolute lifetime, and can be revoked on logout. SQLite Durable Objects store bounded challenge/session records with cleanup alarms. No bot token, private key or client secret is exposed to browser code.

The existing signed Mini App initData path stays supported. Browser cache provides preferences and signed pending-result queues only; the boot equipment/balances come from the server. Web migration payloads, referrers, Stars acknowledgments and paid/admin operations are rejected or stripped. Accounts awaiting their original legacy migration must finish it once in Telegram. Existing account-age/airdrop weighting is preserved when the OIDC profile lacks Premium metadata.

Web battles use the same server match tickets, proof checks, points, quests, ranks and anti-farm limits. Website result previews do not award local points or quest progress while waiting for scoring. Practice remains an independent simulation with no reward submissions. New public browser visits to the old game entry are routed to the verified website; Mini App boot and explicit local test harnesses retain their existing path.

Website checkout and local purchase grants are disabled; existing purchased items remain usable. Telegram payments/recovery and the 25% LP / 75% project allocation are unchanged. No new web referral attribution is credited: acquisition context may be carried through login, while existing server referral relationships stay authoritative. No token launch/claim/NFT, Session 5 or Session 6 work was introduced.

## Tests actually completed

- `node dev/tests/wtest/web-auth.mjs`: real Worker routes with disposable JWT/JWKS/database/session fixtures. Signature/issuer/audience/nonce/expiry rejection, atomic concurrent replay refusal, CSRF/origin/mixed-identity checks, logout/renewal, same Telegram identity, owned independent machine saves, forged points/migration/referrer refusal and paid endpoint refusal.
- The auth integration issued a genuine server match ticket, submitted an isolated valid proof fixture, checked server-calculated credit and single-use results, then read the identical earned balance through Mini App authentication. Web PvP join/ticket session binding and wrong-origin/missing-session socket rejection passed. This is fixture evidence, not a real Telegram user login or human match.
- Focused existing suites: economy **189/189**, PvP **106/106**, farm **49/49**, Lab migration/ownership/revisions, frozen PvP snapshots/counterpicks, stock rewards/proofs across six modes, and **12 completed seeded range trials** passed. No equipment rebalance or 60-match study was repeated.
- Real workerd/SQLite Durable Objects/WebSocket smoke passed: account-read outages fail closed; ordinary Mini App clients match/fight at 14 snapshots/sec; actual SQLite web sessions verify RS256, reject nonce replay, share the authoritative account, accept an authenticated web socket and reject the session after logout. Firebase and Telegram identity provider are test fixtures with no production fallback.
- `python dev/tests/web-browser.py`: browser HTTPS/SOP/CSP and actual Secure/HttpOnly/SameSite cookies, mocked official IDP callback with actual server signature verification, independent save/activate/reload, forged local balances discarded, all **six actual practice modes** completed with **zero range-originated API mutations**, logout, 1440 px desktop and 390/320 px mobile, 3D/software-rendered and no-WebGL paths. Expected signed-out session requests return 401; no page errors.
- Targeted browser checks verified rotate/zoom, held all earned/ownership/match/quest counters unchanged before a scored response, and checked the labelled fallback controls. Empty daily/weekly quest catalog initialization is not an award.
- `python dev/tests/lab-browser.py`: the existing Mini App two-bay/save/reload/stale-reply/six-mode-frozen-counterpick and 320/390 px 2D/3D regression passed.
- Source syntax, generated simulation/asset builds and Git whitespace checks passed. Runtime packaging retains an existing duplicate `GEM` key build warning; no new failure was concealed.

Limits: no physical iPhone Safari, no real Telegram OIDC authorization and no live shared-account/cookie/socket/farming end-to-end claim. The browser identity provider and DNS/HTTPS transport were isolated fixtures; this is not proof of a live cross-origin Telegram session. A live provider login and final production verification must follow the setup below. The existing public Telegram build and Worker health were checked without changing production accounts.

## Single external setup blocker and release path

**The existing bot's BotFather website-login authorization has not been available or verified.** Configure the existing LUNAR bot in **BotFather → Login Widget → Allowed URLs**, adding **`https://lunar-api.solb7403.workers.dev`**, with the default **RS256** algorithm. The official library flow has no app redirect URI or new secret to paste into chat. The public client ID defaults to the existing server bot ID, as documented by Telegram; a deployment-only override is supported if needed.

After that external authorization is confirmed, the tested branch can be integrated through the existing GitHub deployment workflow. It packages a strict public asset allowlist, deploys the backward-compatible Worker/session binding and hosts the website. Login can be disabled via the `WEB_LOGIN_ENABLED=0` deployment variable without disabling Mini App auth. Session-only Durable Object migration `v2-web-sessions` has **not** been run in production. No main merge, production feature activation, domain change or live purchase was performed in this task.

Once activated: open the intended `/web/` address, choose **Enter the game**, authorize Telegram, and play/engineer using the original account. Live authorization and one real authenticated continuity check remain mandatory before calling the website complete or publicly advertising it.

## Changed files

- `web/index.html`, `website.css`, `scene.js`, `website.js`, `play.html`, `boot.js`, `game.js`: finished website presentation/login/game adapter.
- `worker/src/web-auth.js`: official JWT verification, first-party sessions and expiring SQLite storage.
- `worker/src/index.js`, `pvp.js`, `eco.js`: common verified identity, restricted web actions, bound web sockets and preserved existing age weighting.
- `js/core.js`, `net.js`, `match.js`, `pvp.js`, `main.js`: canonical web account boot, CSRF requests, unchanged Mini App path, server-only web reward handling and safe purchase guards.
- `worker/build-web.mjs`, `wrangler.toml`, `.github/workflows/deploy-worker.yml`, `.gitignore`: allowlisted assets, session binding/migration, focused deployment gates and generated-output exclusion.
- `dev/tests/wtest/web-auth.mjs`, `dev/tests/web-fixture.mjs`, `webserver.mjs`, `web-browser.py`, `worker/smoke-runtime.mjs`: isolated actual-path auth/browser/Workers integration checks.
- `index.html`, `version.json`: normal client cache stamp for this pending release. No game-engine/rules/economy tuning changed.
