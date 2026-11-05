# Browser evidence and remaining release gates

All measurements below are browser/software-renderer evidence, not physical iPhone/Telegram verification. Build/source details and the exact remaining blockers are in ../conquest/IMPLEMENTATION_CHECKPOINT.md.

| Scenario | Median frame ms | p95 ms | Worst ms | Draws | Geometries | Living actors | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| chromium-results.json | 41.4 | 78.9 | 114.8 | 50 | 49 | 17 | Functional PASS; dense 60 FPS NOT CERTIFIED |
| webkit-results.json | 18.0 | 26.0 | 46.0 | 50 | 50 | 17 | Functional PASS; dense 60 FPS NOT CERTIFIED |
| chromium-fallback-results.json | 35.6 | 75.8 | 100.5 | 0 | 0 | 17 | Functional PASS; dense 60 FPS NOT CERTIFIED |

Base I–V and Reactor completion captures use explicitly resource-rich disposable fixtures. Relay/Convoy victory and bank captures use actual ordinary inputs and server outcomes; no HP/victory/loot/position claims. The initial loadout/site is a fixture. The separate 60–72-minute earnings model is not a recorded natural playthrough.

Release: **BLOCKED**. PHYSICAL_IPHONE_NOT_TESTED. No long physical-device density memory soak or continuous naturally earned full base journey is claimed. No production deployment.
