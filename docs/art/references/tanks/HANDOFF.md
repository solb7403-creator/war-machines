# Meshy tank art handoff (from-scratch chassis + weapons), Nov 9 2026

New chat: read this file first, then continue at **NEXT**. Do not ask the owner to re-explain anything below.

## How the owner works with this
- He uses Meshy **Pro** (1,000 credits/month; paid-plan assets are his, as long as they're not published to the Meshy Community). Text to Image (image reference + text) = 9 credits. Image to 3D = 20 credits.
- His Meshy Text to Image screen has only **a reference image + a text box**: no aspect ratio, no reference-strength slider.
- **Always send each prompt paired with its guide image, one pair per message, numbered, saying exactly what changes on a re-roll.** Unclear pairing frustrated him.
- He wants every result to be **exceptional**, and honest critique, not overselling (a Scout that was really a jeep was wrongly called exceptional).
- The game's paint system shows the **team color on the tracks**, so every chassis must have tracks.

## Game items (js/core.js CNAMES / WNAMES, js/rules.js)
Each line has one item per rarity: common, rare, epic. The look for each rarity:
- Common: worn steel and olive.
- Rare: silver-grey with violet glow.
- Epic: dark metal with gold and amber glow.

| Line | Common | Rare | Epic |
|---|---|---|---|
| Chassis: Scout (fast) | Scout | Strider | Phantom |
| Chassis: Vanguard (balanced) | Vanguard | Sentinel | Paladin |
| Chassis: Titan (tanky) | Titan | Bulwark | Colossus |
| Weapon: Pulse (balanced) | Pulse Cannon | Arc Pulse | Nova Pulse |
| Weapon: Twin (fast) | Twin Repeater | Storm Repeater | Helix Repeater |
| Weapon: Siege (heavy) | Siege Breaker | Rail Breaker | Titanfall |

Moonbeam (premium weapon) and Lunar Skin come after these.

## Status
- **All 9 chassis images: LOCKED.** They're in `chosen/`. The guide images are in `guides/`, drawn by `c.cjs` (chassis) and `w.cjs` (weapons) using Playwright SVG.
  - Scout took 3 tries; the final one has a sealed hull, a thick roll cage, a bull bar and hazard stripes.
  - Vanguard took 3 tries; the final one has a wedge front, side skirts, stowage and camo.
  - Sentinel took 2 tries.
- **No 3D conversions yet.** Convert **Scout first**, as the riskiest (thin cage tubes). Check its GLB for triangle count, textures, scale and how it looks in game before converting the other 8.
- **Weapons (v2, Nov 9 2026, supersedes the flat `guides/weapon-*` images):** 3D-rendered 3/4-view references in `weapon-refs-v2/` (three.js scene `scene.html?w=1..9`, Playwright 1600px then auto-cropped to 1024). Updated prompts sent to the owner: same bodies as below, revised to match the renders, with the v2 weapon ending below. He is generating them and has **not sent results yet**.
- Credits used so far on tanks: about 13 images (about 117). Remaining plan: 9 weapon images (81), 18 conversions to 3D (360), plus re-rolls.

## NEXT
1. Review the 9 weapon images the owner sends. Be honest about each, and re-roll only what isn't exceptional, sent as prompt + guide pairs.
2. Review the Scout GLB, then approve converting the rest.
3. Later: Moonbeam and Lunar Skin references. Integrate the models into the game (models3d.js / equipment3d.js) in a Max-effort visual session; never weaken existing gear, Moonbeam or Lunar Skin.

## Shared prompt endings
Chassis:
`single tank alone on a plain dark grey background, 3/4 view, no weapon on the hull, a flat round turret mount on top, game-ready hard-surface sci-fi vehicle, lunar military, realistic worn metal and panel lines, PBR materials, soft studio lighting, high detail`

Weapons:
`single tank turret weapon alone on a plain dark grey background, 3/4 side view, barrel pointing right, round turret base ring at the bottom, no tank hull, no text or markings, game-ready hard-surface sci-fi weapon, lunar military, realistic worn metal and panel lines, PBR materials, soft studio lighting, high detail`

Weapons v2 ending (use this one):
`single tank turret weapon alone on a plain dark grey background, 3/4 view, barrel pointing right, exactly one round turret base ring at the bottom, no tank hull, no tracks, no text, no lettering, no markings, thick sturdy parts, game-ready hard-surface sci-fi weapon, lunar military, realistic worn metal and panel lines, PBR materials, soft studio lighting, high detail`

## Weapon prompt bodies (v1; v2 bodies add the detail visible in each weapon-refs-v2 render)
Add the weapon ending after each one.
1. PULSE CANNON tank turret, a compact boxy turret with one medium straight energy cannon barrel and a simple muzzle, worn bare steel with scuffed olive-grey paint
2. ARC PULSE tank turret, a sleek angled turret with one energy cannon barrel wrapped in four raised coil rings, silver-grey armor with thin glowing violet energy lines along the turret and barrel
3. NOVA PULSE tank turret, an aggressive faceted turret with a glowing amber star-core reactor on its side feeding a thick energy cannon barrel with a large gold muzzle, dark metal armor with gold accents and glowing amber energy seams
4. TWIN REPEATER tank turret, a small simple turret with two long thin rapid-fire barrels side by side, worn bare steel with scuffed olive-grey paint
5. STORM REPEATER tank turret, a sleek turret with two rapid-fire barrels held by cooling fin clamps and a round ammo drum on the side, silver-grey armor with glowing violet lines along both barrels
6. HELIX REPEATER tank turret, a heavy faceted turret with two spinning multi-barrel gatling clusters wrapped in a glowing amber helix coil, gold muzzle plate, dark metal armor with gold accents and glowing amber energy seams
7. SIEGE BREAKER tank turret, a big heavy blocky turret with one short very thick cannon barrel and a large slotted muzzle brake, worn bare steel with scuffed olive-grey paint
8. RAIL BREAKER tank turret, a heavy angular turret with a long railgun made of two parallel rail prongs held by three clamps, a glowing violet energy beam running between the rails, silver-grey armor
9. TITANFALL tank turret, a massive imposing artillery turret with layered armor plates and one huge thick cannon barrel ending in an enormous gold muzzle, dark metal armor with gold trim and glowing amber energy seams

## Lessons for re-rolls
- Add "no text, no lettering, no markings": Meshy painted "VANGUARD" on the hull.
- Add "exactly one flat round turret mount": it tends to add extra hatches or discs.
- Add "clearly visible tracks and road wheels": Sentinel hid them.
- Add "sealed armored hull, no windows, no windshield": Scout turned into a jeep.
- Thin parts (tubes, antennas, lights) are a risk in 3D; ask for "thick" versions.
