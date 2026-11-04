# Session 3 implementation

Scope: the supplied Session 3 brief; no future blueprint features, economy rewards, merge or deployment.

1. Reproduce the reported terrain stop; test triangle normals, moderate slopes, contour travel near (1283,1104), cliffs, barriers, bridge levels, frame-rate independent travel and sampled route connectivity. Replace per-microstep height tolerance with geometric directional slope handling. Keep terrain unchanged.
2. Build a localized, bounded combat simulation using a frozen Garage snapshot and shared weapon/equipment rules. Fixed authored enemy roles and waves defend the oxygen line; swept collision, victory, defeat, retreat and retry.
3. Integrate existing chassis/weapon rendering, independent drive/aim/fire/camera controls, world beacon, explicit briefing/start, compact health HUD and discovered mission map status. Persist only provisional personal accomplishment, account keyed, without rewards.
4. Run regression and new simulation/persistence/browser tests, capture real rendered gameplay and software WebGL performance, review integration, commit and open draft PR against main. Report gaps and physical iPhone testing limits.

Implementation choices: retain vanilla JS/Three.js, use the existing account readiness gate, reuse local-storage fallback as discovery does, and dispose all combat rendering with the world. A second worker owns only the pure simulation and its tests.
