# Session 6B owner rules (Tank Lab, logic half)

The owner's Session 6B prompt (Nov 16, 2026), recorded rule by rule so reviewers can judge each one. Where this prompt and
`docs/conquest/audit/SESSION_06B_TANK_LAB_PROMPT.md` disagree, this prompt wins.

## Decisions

| # | Rule |
|---|---|
| R1 | Research costs research parts and time only. No CP, alloy, biomass or helium. |
| R2 | Research runs on the Worker clock: tier I 20 min, II 2 h, III 8 h. It is separate from the town builder. |
| R3 | One research job at a time. A second slot opens at Science Lab III. |
| R4 | The lab stays max level 3 and is built from CC3. |
| R5 | Only the part counts are tuned. The whole tree takes 6–10 weeks for a regular 60-min/day pilot using both slots. This is modeled in `dev/tools/economy-model.mjs`, which reports the weeks. |
| R6 | A ruined lab pauses research. |
| R7 | The Foundry's Reinforced Lattice research (`plot-research`) is unchanged. |
| R8 | There are four tracks: Thermal, Ballistics, Drive and Field. Each track has 3 mods + 1 set mod (16 in all). |
| R9 | Lab I opens Thermal and Ballistics. Lab II opens Drive and Field. Lab III opens the set mods. |
| R10 | A set mod needs the other three mods of its track. |
| R11 | A locked fifth track slot shows Role Cores (Lab IV comes in 6C). |
| R12 | Research adds NEW options in the existing hull, mobility and mount slots, one option per slot. The track→slot mapping is recorded with its reason. |
| R13 | A set mod is the strongest option in its slot. |
| R14 | On a top kit, the best research build is about +8% gear rating (`powerOf`) over the best build without research. |
| R15 | Mods work at full strength in every mode and count toward gear rating. |
| R16 | Existing FITS options, chassis, weapons, plates and legendaries are never weakened or changed. |
| R17 | PvP `checkLoadout` and `ecoLoadout` read ownership from the server record only. |
| R18 | No stat-only mods. Each mod has a name, a role and ONE distinct behavior with a felt trade-off. No mod may feel like a number change or a duplicate. |
| R19 | Triggers are deterministic: no random-chance damage. |
| R20 | Behaviors work identically in Arcade (`game.js` / Worker PvP sim) and Conquest (`combat.js` / Worker sim). Server and client agree. |
| R21 | Triggers show through existing effects, the HUD and sound cues. No new 3D models, particles or shaders (those go to 6B-V). |
| R22 | Every unlock is a moment: a research-complete sound, a reveal card in plain words, and the garage green/red compare. |
| R23 | A Science Lab screen in the town sheet (2D, existing style) shows the tree by track and level, running jobs with timers, parts held, and "what this does" in plain words with no dev jargon. The hub's "RESEARCH · COMING SOON" button goes live. |
| R24 | A POWER chip on the Conquest HUD and hub shows `powerOf(loadout)` including plating and mods, with a one-line delta on change ("POWER 92 → 94"). It is a generic rating chip that FORCE and DEFENSE can reuse. |
| R25 | Engineering bonuses show as one Conquest bonus line in Refuge Supply, with real values. |
| R26 | Zone bands appear on the region map and every briefing. They are computed from authored archetype tiers and are informational only. |
| R27 | Refuge Supply opens on BANK, REPAIR and the plating cards, with the ledger lines below. |
| R28 | Audio is code-made only (`fx.js` Web Audio): zone ambience (barren / terraformed / colony core); UI and reward sounds (bank, build complete, research complete, plate mounted, War Order claimed); stingers for raids, invasions, strikes and victories; a volume slider in Settings next to the sound toggle; one AudioContext that resumes on the first input and is silent when the page is hidden; no storm or rain sounds. |
| R29 | Revenue hooks are real store entries with checkout OFF in every currency: CRYPTO_PAY stays false and there is no Stars checkout. Prices are PROPOSALS priced like the shop: a TON price, SOL at the live rate and a Stars price. Stars show only in Telegram; the website sells TON/SOL. The entries show on the website and in Telegram. |
| R30 | The hooks: (a) instant finish priced by time left; (b) research part packs; (c) Lunar Pass premium perks (+1 slot, −25% research time, research parts on some premium tiers), where the premium track still never gives points and season dates are untouched; (d) four Legendary set mods, a step stronger than the earned set mod and counted in gear rating, with `powerOf` and win chances reported. |
| R31 | Ownership is server-verified. Free players still finish the earned tree in 6–10 weeks. |
| R32 | An owner-rules CI check: one node test that fails the build if any of these change: DAILY_CAP 50,000, CQ_PTS, DQ_PTS 3,500, DQ_ALL_BONUS 1,000, WQ_Q_PTS 12,500, WQ_PTS 5,000. It also requires the chassis kit model's first chassis within 77–97 days, conquest-ladder-check within ±10%, and guard-test limits never loosened. The limits live in one checked-in file that only an owner-decided prompt may change. |
| R33 | The wall-storage bug is fixed (`worker/src/conquest-plot.js` plot-wall: the `p.ws` deduction loop after a `//` comment), with a test. |

## Guards

| # | Rule |
|---|---|
| G1 | `conquest-ladder-check` passes unchanged. `conquest-base-progression` keeps its CC10 floor of 21 days. |
| G2 | No CP source or sink is added. |
| G3 | DAILY_CAP, CQ_PTS, quest rewards, LG_MULT and the Sortie chain (per 0, item .10) stay unchanged. |
| G4 | Research, mods and purchases give no airdrop points. |
| G5 | `fair-arcade.mjs` stays green. |
| G6 | No test is skipped, deleted, disabled or loosened. Tests whose expected behavior changes because of this prompt are updated to the new rule. |
| G7 | No migration or legacy code. |
| G8 | Render quality is never lowered. |
| G9 | Out of scope: plate visuals, weather, new 3D/particle/shader effects, Lab IV–V, season dates, payments checkout, quests, Arcade AI, leagues, the cap, plating HP, RECALL, Session 6 loot tables, War Orders, 7T, 7C. |

## Process gates

| # | Rule |
|---|---|
| P1 | Browser checks at 390x700, 390x844, 320x568, 1366x768 and 1920x1080 (desktop with a real keyboard and mouse). They cover Thermal I end to end, the lab screen and the hub button, the POWER delta, the Refuge Supply order, ambience switching, mute and volume, and the store entries with checkout off. Captures go in `docs/conquest/session6b/`. |
| P2 | All existing suites stay green. The new tests are: `conquest-research.mjs`, behavior tests in both engines with server/client agreement, the owner-rules check, the wall-storage test, a store test and an audio test. `garage-rules.mjs` and `lab-ui.mjs` are updated. The economy model and the chassis kit model are rerun. |
