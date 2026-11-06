# Verification and remaining acceptance

Implementation **1b9a7dc75e26e95261206ac4a233022c2d801066**, branch build **20261105164144**: all eight CI checks passed. [Run42067106968](https://github.com/solb7403-creator/war-machines/actions/runs/42067106968); exact check links/times in ci-acceptance.json. Fresh local economy/payment 203/0, PvP 113/0 and accounts 18 passed. Fixtures are disposable.

## CI software profiles

Ubuntu 24.04 GitHub Actions, headless software Chromium/WebKit, 10-second Relay + persistent-world scenarios. Actual CPU model was not recorded. All profiles retain 15 living actors and 2 actual projectiles; these are state counts, not a claim that every world actor is inside the camera frustum. No profile had a >100ms hitch. Full values: ci-performance.json, extracted from successful run logs; artifact ZIP access returned Azure403 here.

| Environment/mode | Median / p95 ms | Worst ms | Below 50/40/30 FPS % | Draws / triangles | Geometry / textures / chunks | Status |
|---|---:|---:|---:|---:|---:|---|
| chromium 320x568 /3D | 16.7 / 18 | 28.9 | 1.17/0.17/0 | 39 / 46310 | 47 / 2 / 25 | Functional PASS; device acceptance NOT TESTED |
| chromium 390x844 /3D | 16.9 / 28.2 | 39.7 | 24.17/12.43/0.53 | 39 / 46310 | 46 / 2 / 25 | Functional PASS; device acceptance NOT TESTED |
| chromium 390x844 /Canvas | 16.7 / 16.8 | 19.2 | 0/0/0 | 0 / 0 | 0 / 0 / 0 | Functional PASS; device acceptance NOT TESTED |
| webkit 320x568 /3D | 16 / 17 | 22 | 0.5/0/0 | 39 / 46310 | 47 / 2 / 25 | Functional PASS; device acceptance NOT TESTED |
| webkit 390x844 /3D | 16 / 17 | 21 | 0.33/0/0 | 39 / 46310 | 47 / 2 / 25 | Functional PASS; device acceptance NOT TESTED |
| webkit 390x844 /Canvas | 16 / 17 | 21 | 0.17/0/0 | 0 / 0 | 0 / 0 / 0 | Functional PASS; device acceptance NOT TESTED |

Chromium 3D pixel ratio.75; WebKit 3D 1x. Available Chromium heap snapshots: ~41 MB 3D / ~23 MB Canvas. These are individual samples, **not a 50-minute memory trend**. Counters remain bounded in repeated cleanup tests; actual-device long memory behavior is NOT TESTED. The profiles cover the populated opening scenario, not the required long heaviest-density mobile soak or Session2 maximum raids.

Native Chromium three-touch DRIVE+FIRE+Dash/Shield passed; WebKit uses mouse DRIVE plus native touch abilities because of automation limits. Actual rendered-hull target clicks, mission outcomes, physical travel/banking, loss/respawn/wreck recovery, reconnect/reload and context-loss/Canvas paths passed. Input-to-photon time is not measured; these functional prediction checks are not physical touch certification.

## Local evidence and progression

Latest local WebKit software sample after cache changes: median16ms/p9520ms/worst28ms, zero>100ms, below50/40/30FPS4/.83/0%. The committed chromium-results.json is an earlier local pre-cache run:34.5/80/98.1ms; it is not silently relabeled as current final-head performance.

Matched local Node 24 Worker replay median CPU **31.105→14.772ms** per 20-command / one-game-second batch, **52.51% lower**; wall29.999→13.991ms,16 real enemies/1 active projectile. This is NOT rendered-frame time or Cloudflare production CPU. Exact source hashes/scenario: replay-budget.json;93,024 old/new collision checks found zero differences. Repro helpers are conquest-replay-budget.mjs and conquest-world-equivalence.mjs. CI also uploads replay-current.json; its ZIP was not accessible from this environment, so no CI CPU values are invented.

Base I–V captures use explicitly resource-rich fixtures. Relay/Convoy victories and bank captures use real inputs/outcomes and an equipped/site fixture. Separately, earned-journey.json records a continuous zero-resource starter shared-reducer journey: Base I 73.66 accelerated game minutes, paid Reactor complete 80.78. Its exact save passes actual Worker/auth browser reopening, native keyboard base exit/entry and reload (chromium-earned-*.png). No resource gift is used for that earned continuation. It is not an 80-minute continuously rendered native-input/human playthrough. Separate settlement model: 56.25–67.5 minutes.

## Release hold and playable preview

**NOT RELEASE-CERTIFIED. PHYSICAL_IPHONE_NOT_TESTED.** Actual capable-iPhone/Telegram performance, 30m travel/fighting + 20m dense mobile memory/stutter soak, and hands-on first-hour experience remain unverified. Software results cannot establish those claims.

[PLAYTEST.md](PLAYTEST.md) provides the actual HTTP disposable preview (`node dev/tests/conquest-server.mjs --preview`), phone Wi-Fi instructions, genuinely earned-save continuation and a short designer walkthrough. HTTP browser checks verify authenticated movement with no production requests and restricted static paths.

Production remains build 20261105034106 on Worker/Pages; anonymous Conquest guard 401. No merge/deployment, payments, live account writes or paid infrastructure changes. Exact continuation and the unabridged two-session contract remain in ../conquest/IMPLEMENTATION_CHECKPOINT.md and CONQUEST_FLAGSHIP_V1.md.
