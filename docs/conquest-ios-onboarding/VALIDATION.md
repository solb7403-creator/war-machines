# Emergency iPhone onboarding fix

Base: main after PR43, merge5f75eae. Release20261104144959.

## Root cause and scope

The transmission used a single overflowing dialog with acknowledgement after the narrative. At320×568 the button began atY785.98 and ended atY841.98, outside the568-pixel viewport. The prior locator.click test silently scrolled it into view. Separately, the existing document touchmove guard prevented native scrolling in Conquest because its allowed scroll-region selectors did not include the transmission.

The narrative now occupies a shrinking, independently scrolling flex region. The acknowledgement occupies a separate nonshrinking footer. Only this dialog handles its touch/keyboard events locally; other modes retain their existing input guards. VisualViewport height/offset, Telegram viewport updates, dynamic viewport CSS fallback, and system/Telegram safe-area gaps bound the dialog. Viewport listeners are removed on acknowledgement, Escape or Conquest exit. All narrative strings, onboarding storage key, dismissal and replay behavior are retained. No combat, terrain, mission, equipment, account or economy code was changed. Version references are cache invalidation only.

## Automated proof

Both Chromium and WebKit passed all four portrait cases. Bounds are measured before any scrolling and each acknowledgement is tapped by raw touchscreen coordinates; the test does not use an auto-scrolling locator click.

| Viewport | Button top–bottom before scrolling | Tap hits visible button |
|---|---|---|
|320×568|481–537|yes|
|360×640|565–609|yes|
|390×844|767–811|yes|
|393×852|775–819|yes|

Every case verifies responsive exploration after tapping, persistent dismissal across reload, replay, independent story scrolling while the footer remains visible, enlarged narrative/button text, a420-pixel reduced viewport, simulated Telegram safe-area gaps24px top/34px bottom, Tab/ArrowDown/PageDown/Enter/Escape, and zero page errors. Reduced motion is enabled. Screenshots and per-engine JSON results are in this directory.

Commands:
- `python dev/tests/conquest-transmission.py` — PASS all four Chromium cases, native injected touch swipes.
- `python dev/tests/conquest-transmission.py --engine webkit` — PASS all four WebKit cases, native keyboard scrolling and uncancelled bubbling touchmove regression.
- `python dev/tests/conquest-onboarding.py` — PASS existing guidance/briefing/map/onboarding compatibility at390×844 and360×640.
- `node dev/tests/conquest-view-travel.mjs` — PASS existing production driving/recovery/model checks.
- `node --check js/conquest/app.js`, `node worker/build-web.mjs`, `git diff --check` — PASS.

Independent specialist review found no material issues and confirmed narrative preservation, local input isolation, safe-area/viewport handling and listener cleanup. Existing focus-after-dismiss behavior was preserved.

## Limits

These are automated Linux Chromium/WebKit results, not physical iPhone Telegram verification. Playwright does not inject swipes or wheel events into mobile WebKit; actual injected touch scrolling is covered in Chromium, while WebKit verifies native keyboard scrolling and that the app's document handler cannot cancel story touchmove. The reduced viewport and safe-area values are controlled simulations, not claims of an actual keyboard or notch. Local WebKit used workspace-extracted runtime dependencies; CI installs the supported engine dependencies normally.
