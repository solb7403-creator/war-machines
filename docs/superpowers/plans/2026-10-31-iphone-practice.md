# iPhone practice preview implementation plan

Goal: account-free play using the RC1 simulation, renderer and existing touch controls on the existing isolated static host.
Architecture: a preview-only entry loads rules/game, match visual events, renderers, and the sandboxed range engine. No core/net/pvp/ui/main account boot. Small memory-only compatibility adapter supplies display preferences and preview menus. Existing rangeTick runs combat. CSP and an asset-only fetch boundary prohibit services; storage is unused.

- [ ] Add focused browser checks for account-free match, real movement/combat, six modes, profiles/fallback, mobile layout, lifecycle and network isolation. Observe missing page failure.
- [ ] Add web/practice-preview.html, preview CSS and bootstrap adapter. Keep all release files and GraphicsRelease.enabled=false unchanged. Offer three fixture loadouts and six existing modes; no progression or results persistence.
- [ ] Commit/push early to feature/iphone-practice-preview, before long browser tests. Never merge.
- [ ] Run focused browser checks and correct reproducible integration blockers. Stage only static dependencies alongside the existing equipment preview. Publish to the existing preview Site; verify HTTPS in browser, record cold/warm loading and emulated frame pacing.
- [ ] Push final code and verification handoff. Preserve launch steps 2 (commercial audit) and 3 (approved consolidated production release) for later; do neither here.

Review focus: hidden-tab input reset; no-WebGL/material fallback; phone safe area and narrow width; result/exit cannot reach economy; all requests limited to static assets with no production writes.
