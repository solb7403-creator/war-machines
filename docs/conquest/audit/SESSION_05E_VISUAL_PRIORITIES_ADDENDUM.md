# Session 5E addendum — Conquest visual priorities from the fun audit (Nov 10 2026)

Paste this under the owner's Session 5E brief (Models + Arcade 3D maps, Opus · Max). It adds no new models beyond the owner's list; it orders the Conquest work by what the player looks at most and adds five cheap hooks Session 6 needs.

## Order of work inside the Conquest part of 5E

1. **The player's tank** (every chassis, every weapon, Moonbeam v9): it is on screen 100% of the time in the hub hero, the world and the Home Sector. Each chassis gets the **four Hull Plating sockets** (FRONT glacis, LEFT and RIGHT skirts, TURRET cheeks) as named anchor points so Session 6B can mount visibly different slabs per tier without touching hitboxes, sockets or muzzles. Keep the +X-forward, +Y-up convention and the canonical hitboxes (AGENTS graphics contract).
2. **The four Parasite archetypes** (interceptor `raider`, saboteur `breacher`, heavy sentinel, fire coordinator `command`): distinct silhouettes readable at 390 px from the chase camera, a hostile red read against the blue world, one dying pose/burst each. Today they share the player chassis kits with a tint.
3. **The first-hour stage**: the Refuge gate area (the new spawn point of Session 6, ~40 m from the terminal, facing the oxygen towers), the oxygen processor and towers, the Command Gate courtyard, and the viaduct signage (the "CORRIDOR" sign reads mirrored from the spawn side: `captures/02-world-first-view.png`).
4. **The 12 town items and the eleven turrets** (owner's list; the 5B/5C captures and `docs/art/references/07-turrets-eleven.png`, `08-wall-blends.png` are the target).
5. **Arcade maps** as the owner's brief orders them.

## Five hooks for Session 6 (no new models; reusable materials and sprites)

- A **loot glow sprite** per rarity (grey, green, cyan, violet, gold) with a soft pulse: one billboard material, color by rarity.
- A **hit-flash material** state for enemy hulls (80 ms emissive white), applied without a new program (uniform or vertex color swap).
- A **kill burst**: one pooled particle burst (≤ 24 quads) in the Parasite accent color plus a short light flash.
- A **plate slab** mesh per socket in six tier looks (matte rust, black faceted, grey-blue fibrous, red-orange inlaid, reflective silver-violet, obsidian with a blue-white core), LOW variants as single buckets.
- **Drop sprites for consumables** (Repair Kit, Shield Cell, Scanner Charge, Decoy Beacon): four 64 px icons rendered from simple meshes, the way 5C renders card sprites.

## Acceptance for the Conquest part

Captures at 320/390/430 portrait and desktop of: hub hero with each chassis; the four archetypes side by side at chase distance; the Refuge spawn view; the courtyard; one tank with all six plate tiers mounted (static preview). Draw calls, triangles and programs recorded for the world at the Refuge and the Home Sector CC10 (budgets from 5C: programs ≤ 16; CC10 Home Sector ≤ 65 draws HIGH). No change to `enemyStats`, hitboxes, sockets or muzzle endpoints (the equipment runtime tests and the 5D gear-fairness regression stay green).

Model: Opus · Max — owner's choice for the visual session; run the critic loop from `docs/art/references/README.md`.
