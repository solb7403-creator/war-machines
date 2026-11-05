# LUNAR AI development toolkit and coordinated workflow

Status: repository-side **foundation**, not a claim that external cloud accounts, Graphify workspaces, GPU services or new AI model APIs are connected. This document is actionable from an iPhone using GitHub's web UI and hosted agent environments; no user-owned desktop/terminal is assumed.

## What is already in this repository
- Vanilla browser game and Telegram Mini App, server-authoritative Cloudflare Workers/Firebase backend, a Three.js renderer with fallback, procedural chassis/weapons and shared graphics assets.
- CI under `.github/workflows/` already exercises gameplay, Conquest, equipment, browsers and deploy-specific workflows. Do not duplicate/rewrite it merely to install more tooling.
- `js/assets/hf-v1/manifest.json` is an existing hashed PNG/PBR atlas. `dev/assets/README.md` explains deterministic asset rebuilding, mesh ownership, shader conventions and mobile limitations.
- `dev/tools/asset-audit.mjs` provides a dependency-free read-only inventory and integrity check; `.github/workflows/ai-tooling-check.yml` runs it on relevant PRs.

## Priority 1: reduce AI tokens and prevent conflicting changes
1. **GitHub is the canonical handoff**, not chat memory. One issue/brief -> one task branch -> one PR -> CI -> owner approval. Use `.github/ISSUE_TEMPLATE/agent-task.md` and `.github/pull_request_template.md`. Claude and Codex can work on separate branches, but they do **not** automatically synchronize or merge each other's work.
2. **Graphify** (https://graphify.com/) may be connected as a repository-indexing service. Add `solb7403-creator/war-machines` in your Graphify dashboard, wait for indexing, select its workspace in the app/agent integration, then check indexed SHA before interpreting the graph. As of this setup, the connected Graphify tool returned **zero accessible workspaces**. GitHub files cannot create that external workspace on your behalf. Graphify improves selective navigation; it is not automatic multi-agent orchestration.
3. **Serena** (https://github.com/oraios/serena) can provide precise symbol-level editing when supported by a hosted agent's MCP runtime. It overlaps with Graphify; install only if it measurably improves a task.
4. **Repomix** (https://github.com/yamadashy/repomix) is a fallback for narrow exports to an agent without repository tools. Include only relevant paths, not the entire repo by default. Do not upload secrets.
5. **REA / Reverse Engineer Anything** (https://github.com/morluto/rea) can be used on owned or explicitly authorized artifacts in an environment where its analysis engine is actually connected. The REA *companion skill alone* does not expose an executable reverse-engineering tool. Do not use it for third-party private endpoints or proprietary model extraction.
6. **GitHub Actions** is already present. Favor targeted automated tests and artifact evidence to reduce avoidable AI-debugging cycles. Existing workflows can consume GitHub runner minutes.

## Priority 2: actual game-ready visual assets
- **Blender** (https://www.blender.org/) — free/open-source 3D authoring, animation, rigging and programmatic mesh refinement; run in an authorized cloud build environment, not necessarily on the owner's phone.
- **glTF Transform** (https://gltf-transform.dev/) plus **glTF Validator** (https://github.khronos.org/glTF-Validator) — validate/compress candidate glTF/GLB models. A loader and tests must be integrated before runtime import is usable; this PR deliberately adds neither.
- **Poly Haven** (https://polyhaven.com/), **ambientCG** (https://ambientcg.com/) and **Kenney** (https://kenney.nl/assets) — consider properly licensed textures, HDRIs, prototypes and props. Record asset source and exact license in a proposed asset manifest. Original LUNAR visual identity takes priority.
- **Spector.js** (https://spector.babylonjs.com/) and **Postprocessing** (https://github.com/pmndrs/postprocessing) — optional development-time WebGL inspection and carefully benchmarked Three.js visual effects. Do not add a costly postprocessing chain to mobile by default.
- **AI image/video/3D models** can provide concept art, trailers and candidate geometry via approved, metered providers or free demos. Free-to-download models can still have expensive GPU inference. Do not claim that image/video footage is editable or playable 3D. Keep all production API keys server-side and require owner approval for any paid inference or hosted deployment.

### Required asset delivery contract
1. Make an original reference (or licensed reference) with front/side/rear views and explicit art direction.
2. Author an actual mesh and textures, with correct +X-forward orientation, stable part hierarchy and muzzle/socket alignment. Add export-ready animation pivots when necessary.
3. Validate geometry, normals, UVs, materials, texture color spaces and licensing. Optimize for HIGH and LOW mobile profiles; test memory/draw calls and context-loss/2D fallback.
4. Integrate through the existing Three.js/equipment renderer and preview scene; never modify canonical collision and gameplay balance as part of visual authoring.
5. Run applicable source tests, browser previews and screenshot comparisons at 360/390-pixel portrait widths and larger screens. Capture screenshots and performance measurements as PR artifacts, marking simulated browser measurements as simulated.
6. Await owner review before merging/deploying.

## Priority 3: quality and security (mostly already available)
- **Playwright**: browser/screenshots across Chrome/WebKit/Firefox; used by existing LUNAR tests. Add golden-image tests only with stable rendering tolerances and deliberate baseline approval.
- **Cloudflare Worker tests + Firebase emulators**: isolate account, progression, PvP and Conquest test cases; never run generated scenarios on production records.
- **k6**, **Lighthouse CI**, **Biome**, **ZAP**: optional targeted load testing, mobile performance, linting and web-security checks. A tool is not useful merely because it is installed; measure CI minutes, false positives and maintenance before adopting it.
- GitHub-hosted runners and free tiers have quotas that can change; use PR-path filters and stop expensive cloud jobs when unnecessary.

## Suggested sequence
1. Merge only the owner-approved tooling PR. It does not affect production runtime.
2. Separately configure a Graphify workspace and connect the repo in the external service. Validate graph coverage, cost and token savings on 2–3 representative Claude/Codex tasks.
3. Use a small scoped PR to add any needed model-import interface/asset registry, without changing existing gameplay. Test both old and imported assets, on HIGH/LOW/2D.
4. Build the separate LUNAR AI Creation Studio around approved image/video/3D APIs and an asset-review queue. Do not couple paid model inference to the live game.
5. Revisit additional integrations only after real bottlenecks are observed.

## Device and cost rules
- The owner works from an iPhone; all required owner steps must work in mobile browser/chat or via a hosted agent. Do not require local Blender, Node, Linux, npm, Python or a computer.
- Open-source **software** does not mean free hosting, GPU, generation credits or unlimited automation. Avoid surprise paid charges and don't ask the owner to buy hardware.
- Do not auto-merge or deploy. The owner approves shipping decisions.
