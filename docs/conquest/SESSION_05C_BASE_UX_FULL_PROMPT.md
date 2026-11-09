LUNAR: War Machines — SESSION 5C: BASE UX + "YOUR TOWN IN THE WORLD" (owner-approved brief, Nov 9 2026)

Run at Opus · Max effort. Read first: CLAUDE.md, AGENTS.md, docs/conquest/CONQUEST_FLAGSHIP_EXECUTION_HANDOFF.md, docs/conquest/IMPLEMENTATION_CHECKPOINT.md (Checkpoint 28), docs/conquest/SESSION_05B_TOWN_DEFENSE_FULL_PROMPT.txt. Branch from main: claude/conquest-session-5c-base-ux. Commit and push every tested slice; append Checkpoint 29 to IMPLEMENTATION_CHECKPOINT.md.

Release: PRE-APPROVED. When CI is green and two independent read-only reviewers have passed, merge, deploy, verify /pvp/health and version.json = repo, record it. Do not wait for the owner. Payments stay DISABLED. No economy changes (costs, caps, timers, rewards, points): this session is UX, rendering and structure only. The one economy observation below is reported, not changed.

## Why (owner playtest of build 20261109074525, Nov 9)
1. The base menu panel can't be pulled up or down; the ⤢ toggle is not enough. Owner: "pull the menu higher so people can see more of it, and lower."
2. Turrets are buried in BUILD under ECONOMY. Owner wants a WEAPONS section at the top.
3. The base section is too dense and not player-friendly. Simplify while keeping the features.
4. Players must see the town they built at all times in normal gameplay, not only on the base screen. Today the open world shows a generic Command Base model at (1080,1160) that looks the same at CC1 and CC10 (js/conquest/view.js campaignRender → style.commandBase). The owner said this before 5B shipped; it is the centerpiece of this session.
5. Audit findings below (Fable, Nov 9): default camera too far and too top-down (town reads as a dark slab with dots), blueprint grid covers the whole town, raider lanes look like pink brick walls, two "power" stats with one word, two level systems shown (Tier I–V and CC1–10), legacy fortress defense UI beside the new town drill, dev jargon in player text ("Session 7", "payments certified").

## A. Your town in the world (the centerpiece)
Design (decided):
- **Home Sector.** The Command Gate at (1080,1160) is a portal. Driving into its ring (or MY BASE → fast travel) loads the pilot's town as the live world around the tank: full scale (4 m cells), the site's terrain template (ridge/canyon/plateau/…: real heights, lakes, cliffs), every wall cell with its blend look, every turret with its head tracking, homes, crew, rovers, banner and theme. The pilot drives inside their own town. Leaving through the gate returns to the shared world at the pad. This is a private instance (every pilot's plot shares the same world coordinates, so it can't live in the shared scene). Use the same renderer/style programs; port the plotview kit (building, head, wallGeo, home, person, rover, banner, decor) into a shared module (js/conquest/townkit.js) used by both the Home Sector and the build view. Instanced walls/homes/turrets, distance LOD, same budgets as 5B (≤16 programs; measure draws/tris at CC1 and CC10 at 390 portrait and record them).
- **Build mode is a camera, not a separate screen.** Inside the Home Sector, BUILD opens the bottom sheet over the same world; the camera lifts to the overhead build view and returns to drive view on close. No reload, no second scene. Collision: the pilot's tank collides with walls/buildings in the Home Sector (walls block, gates open for the owner).
- **Shared-world pad shows the real town.** Replace the generic commandBase model at the pad with a faithful diorama of the pilot's actual town at 1/4 scale (walls, turrets, vitals, CC height by level, banner), updated when the plot changes. Other pilots' pads (visit flow) show theirs. Keep the beacon and yield orbs.
- **Always visible while away.** The ⌂ MY BASE HUD button carries a live mini-map thumbnail of the town (reuse plotview layer2d), with a red ring when damaged. The Conquest hub hero renders the pilot's actual town (CC level, walls, banner) instead of a generic scene.
- Drill replay runs inside the Home Sector (you watch from your tank or the overhead cam). Live defending during raids stays Session 7; leave hooks.
- Protect the 5B invariants: all changes are Worker actions validated by js/conquest/plot.js; no client authority over plot state.

## B. Bottom sheet that pulls up and down
- Replace the ⤢ toggle with a draggable sheet: grab handle, three snap points (PEEK ≈ 18% of the stage height, HALF ≈ 50%, FULL ≈ 88%), inertia, real finger drag through the app's touch guard (iPhone), also mouse. The stage (map) resizes with it via one CSS variable; the renderer viewport/scissor and cellAt() follow (no tap offset). Remember the last snap per tab. Default: HOME → HALF, BUILD → HALF, WEAPONS → HALF, WALLS → PEEK, DEFEND → HALF; placing a blueprint or drawing walls drops to PEEK automatically and restores after.
- Keep the floating CONFIRM/UNDO (cq-plot-fab) on the map while drawing; keep "primary action on screen" everywhere.
- Tests: the sheet reaches all three snaps by touch at 390×700, 390×844 and 320×568; taps land on the exact cell at every snap (extend conquest-plot-ui.py placement test); no page scroll bleed.

## C. Tabs: HOME · BUILD · WEAPONS · WALLS · DEFEND (left to right, 5 equal tabs, icon + short label, fits 320 px)
- **HOME**: one status card (CC, site, ⚡ power used/supply as a bar, defense rating, production with COLLECT, builder progress, damage + REPAIR ALL), then the coach step, then closed sections: TOWN LOOK (banner, lights, finish, decorations, SHARE), VISIT (top 20, squad, base of the week), STORE (hidden until payments are enabled). Daily Base Yield, BANK SALVAGE and REPAIR HULL become three buttons on the status card (from the old BASE TERMINAL fold). Remove the fold.
- **BUILD**: economy + support buildings only (Refinery, Storage, Reactor, Foundry, Biodome, Hangar, Helium, Radar, Lab, Uplink, Trophy Hall). Same card design.
- **WEAPONS**: all 11 turret types + Gate + Shield. Cards sorted by unlock, locked ones shown dimmed at the end with the CC that unlocks them. Each card shows the turret's actual model as a sprite (see D), role tag, range, DPS-class words (no hidden numbers), cost/time, and "N/cap placed". A placed-turret summary row at the top (counts by type, cap).
- **WALLS**: blend picker first (big swatches with the ore's full name on two lines, not FERR/ILME), then tools LINE · RECT · RING · ERASE in one row; COPY/PASTE under MORE. Foundry (composite, load alloy, research, extensions) and TOWN LAYOUTS move here as closed sections: they are wall tooling. Live stats keep the three meters.
- **DEFEND**: START DEFENSE DRILL with the drill report, breach tips, BASE LOG, RAID PROTECTION (shield, garrison, alerts).
- The coach (guideStep) points at the new tab names; add a "step k of n" chip. Rewrite coach text in plain words (no "plot regolith", no "vital" without a one-time definition: "VITAL: raiders hunt these; lose the Command Center and the raid wins").

## D. Readability and look (Max visual pass)
- **Default camera**: 3/4 view framed on the Command Center, distance ≈ 55% of today's (CC1 ≈ 95, CC10 ≈ 120), tilt ≈ 0.78; a FRAME TOWN button (⌖) resets it. Pinch limits unchanged.
- **Town ground**: not a black slab. A lit paved plaza around the CC, dust roads from the CC toward each lane, subtle cell texture, site terrain visible (terrace shading, lake, cliffs) at the default framing. Brighter hemisphere light inside the town edge.
- **Walls**: read as fortifications at all distances: darker body, lit cap line in the blend's accent, a corner post every 6 cells on straight runs (visual only), LOW geometry keeps the cap and post. Ruined cells show rubble, not a hole.
- **Raider lanes**: red hazard chevrons pointing inward and a faint ground glow, never brick-like strips. Town edge: thin cyan line only.
- **Blueprint grid**: shown only within a 13×13 patch around the blueprint or the drawing finger, fading out; the whole-town grid is gone.
- **Card sprites**: render each building, turret head and wall blend once to a 72 px sprite (offscreen, same style programs) and cache per session; use them on BUILD/WEAPONS/WALLS cards and the HOME status card instead of unicode glyphs.
- **Header**: "RIDGE TOWN · CC1" on the left; two chips on the right: ⚡ 1/15 (red when short) and 🛡 DEF 50. Rename Command Power to TOWN SCORE everywhere a player sees it (and keep `power` internally); only one thing is called POWER.
- **One level system in the UI**: CC1–10 only. The legacy Tier I–V and "Base I" wording disappear from player text (tier stays internal for the points multiplier; show "points ×1.05" next to CC where it applies).
- **Dev jargon**: remove "Session 7", "Session 8", "payments certified" and any roadmap wording from player-facing strings (plotview.js raidFold, visitUi, storeList; app.js plotTerminal; hub.js). Replace with plain future-tense copy ("Player raids are coming") or nothing.
- **Legacy fortress defense**: retire the old PARASITE DEFENSE UI (start-defense, defense-config turret/shield/drone, REPAIR FORTRESS) and the world HUD START DEFENSE button; the town drill is the one defense system. Keep the server fields and actions for compatibility; don't delete data.
- Reduced motion and LOW graphics keep every screen readable.

## E. Extras (owner asked for anything that makes the base better; build these, they're small)
1. **Town tour on first entry**: when a pilot drives into their Home Sector the first time, a 6-second cinematic orbit of the town, then control. Skippable.
2. **Damage you can see**: damaged walls smoke, ruined turrets spark, inside the Home Sector and on the diorama.
3. **Name your town**: a town name (≤ 16 chars, Worker-validated, profanity list) on the HOME card, the diorama plaque and the share card.
4. **Share card** shows the diorama render (not the 2D pixel map), town name, CC, defense rating, banner.
5. **Visit polish**: visiting a town loads it as a read-only Home Sector you can drive through (no edits); RETURN button.
6. Store tiles stay disabled; make sure every cosmetic in ConquestPlot.STORE has a real preview sprite ready so the store looks finished the day payments open.

## F. Out of scope (do not do)
Economy numbers, wall caps, raid balance, live PvP raids, Session 6 (tank mods/Science Lab), Session 7 ladders/squad wars, payments. Note for the owner (report only): the CC ladder costs 1,800 → 2,700 → 1,700 CP for CC2 → CC3 → CC4 in js/conquest/plot.js (CC4 cheaper than CC3); decide separately.

## G. Tests and acceptance
- Node: all Conquest suites in the CI list stay green; add conquest-sheet.mjs (snap math) and townkit parity (build view and Home Sector produce identical instance counts for the same plot).
- Browser (Chromium 390×700, 390×844, 320×568; WebKit where the matrix runs): sheet snaps by touch; tap accuracy at every snap and CC1/CC5/CC10 on ridge/canyon/plateau; every tab fits or scrolls; WEAPONS lists 11 turrets + gate + shield with sprites; Home Sector loads from the gate and returns; diorama updates after a wall order; HUD thumbnail present; no dev jargon strings (grep test on player-facing text); no page errors.
- Captures to docs/conquest/session5c/: each tab at HALF and PEEK, default camera CC1 and CC10 on three sites, Home Sector drive view CC1/CC10, pad diorama CC1 vs CC10 side by side, HUD thumbnail, hub hero. Before/after pairs for the owner.
- Performance: record draws/tris/programs for the Home Sector at CC10 (HIGH and LOW) and the shared world with the diorama; stay within the 5B budgets.
- Two independent read-only reviewers before merge (one UX/accessibility + one rendering/performance/security). Fix what they find; record it.
- PHYSICAL_IPHONE_UNVERIFIED stays in the checkpoint until the owner's playtest.
