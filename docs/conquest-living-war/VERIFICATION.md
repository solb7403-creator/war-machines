# Browser evidence and remaining release gates

All measurements below are browser/software-renderer evidence, not physical iPhone/Telegram verification. Build/source details and the exact remaining blockers are in ../conquest/IMPLEMENTATION_CHECKPOINT.md.

| Scenario | Median frame ms | p95 ms | Worst ms | Draws | Geometries | Living actors | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| chromium-results.json (checkpoint11) |34.5|80.0|98.1|40|45|15|Functional PASS;60FPS FAIL in software environment|
| webkit-results.json (checkpoint12) |16.0|20.0|28.0|39|46|15|Functional PASS; physical60FPS NOT CERTIFIED|
| chromium-fallback-results.json (checkpoint6) |35.6|75.8|100.5|0|0|17|Functional PASS; historical software sample|

Current15actors are all14world actors plus the Relay core; duplicate mission squads were removed so occupation requires the real world defenders. Profiling overlapped some CPU-heavy testing; final CI artifacts provide independent runs.

Base I–V fixtures remain explicitly resource-rich. Relay/Convoy victories and physical bank use actual inputs/outcomes. NEW: `earned-journey.json` records a continuous zero-resource starter shared-reducer journey: Base I at73.66 accelerated game minutes, paid Reactor complete80.78. Its exact save is then reopened through real Worker/auth and native keyboard physical base exit/entry and browser reload, retained in `chromium-earned-*.png`. No resource fixture is used for this earned continuation. This is not represented as a continuously rendered80-minute native-input/human playthrough. The updated separate settlement model yields56.25–67.5min.

Release: **BLOCKED**. PHYSICAL_IPHONE_NOT_TESTED. No long physical-device density memory soak or complete native-input first-hour human playthrough is claimed. Canonical accelerated earned progression plus rendered retention are proven separately. No production deployment.

Playable local preview and actual HTTP/no-production-network proof: see PLAYTEST.md and chromium-local[-earned]-preview.png. All Conquest CI at b989d725 passed; final head must be checked independently.

Matched local Node24 Worker replay CPU:31.105→14.772ms median per20-command/one-game-second batch (16 real enemies/1 active projectile),52.51% lower. Wall29.999→13.991ms. This is NOT rendered-frame or Cloudflare production CPU data. Exact scenario, before/after source hashes and93,024 collision checks with zero differences: replay-budget.json. Reproduce with conquest-replay-budget.mjs and conquest-world-equivalence.mjs as documented in the checkpoint.
