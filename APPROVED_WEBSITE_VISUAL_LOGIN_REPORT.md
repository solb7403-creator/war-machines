# Approved website design and login repair

Branch: `feature/approved-website-login`, based on released main `867f258e5eed0ea84345e2bbfb815d1979d94474`.
Website: https://lunar-api.solb7403.workers.dev/web/

Implemented the owner's approved composition: full-bleed illustrated lunar colony, giant planet/moon and starships; chrome heading, cyan hardware panels/CTAs, orange/teal accents; four functional feature tiles, lower visual showcase, six illustrated mode cards, accurate progression strip and panoramic footer. Actual HTML controls, responsive phone composition, keyboard focus and reduced motion. No homepage tank, WebGL or game-engine download. Garage/Engineer retain their actual models and shared controls inside matching navy/cyan command surfaces.

Differences from the reference: original environment artwork rather than the identical illustration; six real mode cards instead of four fictional categories; Engineer/practice links replace a nonexistent trailer; no fictitious population/events/factions or promised token rewards. Optimized WebP artwork: 380,198-byte desktop scene, 114,764-byte mobile variant, 517,896-byte six-scene atlas. These are artwork assets, not page screenshots.

Login: current official Telegram SDK calls the callback without closing its popup; the old website navigated its opener while leaving the authorization tab foregrounded on phones. Call the SDK's documented `close()` and return focus on callback, then enter the game only after the existing server-verified exchange succeeds. Verification failures return to a visible notice. Nonce/JWT/RS256, origin, CSRF, first-party cookie and canonical account validation are unchanged. This fixes a confirmed lifecycle omission; only the owner can confirm it resolves the entire reported physical-iPhone symptom.

Evidence:
- `node dev/tests/web-login.mjs`: original implementation failed the popup-close assertion; repaired implementation passes success and rejection cases.
- `node dev/tests/wtest/web-auth.mjs`: passes signature/claims, replay/expiry/race, CSRF, sessions/logout, shared identity, authoritative inventory/points and independent bays.
- `node worker/build-web.mjs`, JS syntax and `git diff --check`: pass.
- `LUNAR_TEST_SDK=/tmp/lunar-current-login.js python dev/tests/web-visual-login.py`: actual unmodified official SDK + isolated signed fixture. Callback, popup closure, canonical identity, Crystal Rush entry, Garage/Engineer and no-overflow screenshots at 1440/390/320 passed. Initial final range navigation wait used same-document hash navigation incorrectly; corrected test navigation and selector. Only the affected destination checks were rerun with `/tmp/lunar-approved-deeplink.py`: actual SDK popup closure, authenticated range and Engineer links, navigation and logout pass, no browser exceptions. No real Telegram identity claimed.
- Screenshots inspected: `/workspace/lunar-approved-website-evidence/homepage-{1440,390,320}.png`, `garage-{1440,390}.png`, `engineer-{1440,390}.png`, `navigation-mobile.png`. Screenshots/test output are excluded from Git.
- Existing mandatory deployment workflow remains the release gate; adds the small handoff regression. Focused website PR CI validates syntax/assets, callback and authoritative-session contracts.

Changed files: `web/index.html`, `web/website.css`, `web/website.js`, `web/game.js`, three `web/assets/*.webp`; focused browser/login tests and fixture MIME support; website CI and one deployment-check step; this report. No combat/economy/account/Worker authentication logic changed. Telegram entry and its game build remain unchanged.

Release is performed through a reviewed feature PR and existing main deployment workflows, with live HTTP/asset/login-configuration/Worker health checks recorded in the final task response. A push alone is not evidence of deployment.

Required owner verification: on iPhone Safari open the live URL, tap Enter the Game, approve with the real Telegram account, confirm the authorization tab closes and the shared Garage opens. Then compare an existing machine and progression with Telegram. No new BotFather setting is requested by this change. Physical iPhone/real-account approval is not automated; visual acceptance remains the owner's decision.
