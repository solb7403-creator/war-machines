# Gate 1 — Vanguard: original high-poly vs LIGHT vs FULL (Session 5E-1)

Auto-approved gate from the session brief: run Vanguard first, compare the owner's original Meshy mesh (gray shaded)
against the two game versions (gray shaded with the baked normal map), same camera, three sizes.

Rendered in the game's own Three.js build (`js/vendor/three.lunar.min.js`) through the game's new loader
(`js/meshy3d.js`), headless Chromium. Harness: `dev/assets/meshy/proof/gate.mjs` + `ssim.py`.

| | Triangles | File | Battle (phone) SSIM | Garage SSIM | Desktop 1920 SSIM |
|---|---|---|---|---|---|
| Original (Meshy) | 2,912,648 | 69.9 MB | reference | reference | reference |
| **LIGHT** | 17,986 | 578 KB (geometry 349 KB, maps 512 px) | **0.982 / 0.981** | 0.84 (not used at this size) | 0.83 (not used) |
| **FULL** | 119,960 | 3.75 MB (geometry 1.72 MB, maps 2048 px) | 0.996 / 0.996 | **0.983 / 0.983** | **0.975 / 0.975** |

Two numbers = two camera yaws (front 3/4 and rear 3/4). These are the gate figures for the plain gray bake; the shipped
files (with colour, masks and moving parts) are listed in `js/assets/meshy-v1/manifest.json`.

**Verdict: PASS.** LIGHT is at or above 0.98 at phone battle size with no visible silhouette or detail loss. FULL is
indistinguishable at Garage and desktop size on inspection (`vanguard_desktop_100pct_crop.webp`: top = original, bottom
= FULL, 1:1 pixels; rivets, cable, lamp cage, track lugs and wheel rings all match). The remaining 0.975 at 1920 is edge
softness of about one texel, not missing shape.

## Sizes
- **Battle (phone):** arena is 20 units across a 390 px phone at device-pixel-ratio 1.5 (`js/render3d.js`), a tank is drawn
  at R 0.7 x 1.12, so a Vanguard is about 60 device pixels long. `vanguard_battle_*.png` is shown x4 so it can be judged.
- **Garage:** 780 px wide (390 px phone at DPR 2), tank fills 86% of the width.
- **Desktop:** 1920 x 1080, tank fills 62% of the width.

## Method notes (so the numbers can be trusted)
- Every view is rendered supersampled (8x8 battle, 3x3 Garage, 2x2 desktop) and box-filtered down, for the original and the
  baked models alike. Without that the 2.9M-triangle original is sub-pixel triangle noise at 60 px and no comparison
  against it means anything (raw, the baked versions score only 0.85-0.89 against it for that reason alone).
- SSIM is computed on luminance over the model's bounding box only (background excluded).
- The normal map is baked in the exact tangent frame the game's renderer builds at runtime, so the baked shading is the
  original's shading, not an approximation of it.

## Settings approved by this gate (all in `dev/assets/meshy/config.json`)
- LIGHT chassis 18,000 triangles, 512 px maps. Six tanks in a match = about 150k triangles with weapons, against the
  110k the current HIGH models draw (`docs/GRAPHICS_RELEASE_READINESS.md`, 6-pilot match); LOW graphics uses a reduced
  index set of the same file.
- FULL chassis 120,000 triangles, 2048 px maps, only fetched when the Garage or a close-up shows it.
- What was tried and rejected: 12k LIGHT (0.972-0.979, fails), a voxel shrink-wrap remesh (cleaner mesh but 0.968, fails),
  150k FULL (+0.001 only), xatlas' own charts (30x slower, no gain over axis-projected charts).
