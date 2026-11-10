LUNAR: War Machines — SESSION 5D: FAIR ARCADE + DESKTOP DRIVING + 5C LEFTOVERS (owner-approved scope, Nov 9 2026)

Run at Fable · Extra effort. Read first: CLAUDE.md, AGENTS.md, docs/ROADMAP.md (Fix queue + Standing owner decisions), docs/conquest/IMPLEMENTATION_CHECKPOINT.md (Checkpoint 29 = Session 5C release), docs/launch/LEAGUES.md, and the dev/tests combat suites (combat-balance, combat-ghosts, combat-grid, combat-sim, gear-balance, gear-combat). Work on a new branch from current main (`7a81b35` or later). Commit and push every tested slice, and keep IMPLEMENTATION_CHECKPOINT.md updated (Checkpoint 30) so another session could resume exactly where you stopped.

Release: PRE-APPROVED by the owner. When every acceptance gate below passes, CI is green and two independent read-only reviewers have passed, merge, deploy (server + GitHub Pages), verify /pvp/health and that version.json matches the repo on both, record it in the release record, and update docs/ROADMAP.md. Retry a GitHub-side Pages failure; do not wait for the owner. Payments stay disabled.

Order of work: A (the main job) → B → C → release. A gets most of the effort.

## A. Arcade AI must never match the player's gear (ESSENTIAL, 4th recurrence)
Owner, Nov 8: every arcade AI is about as strong as the best gear in the game, so gear is pointless. Anyone who bought Epic or legendary gear, or earned Epic with points, will feel scammed and quit. It has come back after 4 separate fixes. Live evidence: a Bounty 1v1 win with Moonbeam in the Lunar Legend league, 16,385 damage dealt vs 16,160 taken: a near-even fight at top gear.

Prime suspect (verify, don't assume): AI strength is derived from the player's own power.
- `js/rules.js` `aiLevel(pw,e,lg,n)` sets the AI tier from `aiPower(pw,e)*aiStep(lg,n)`, so it rises with the pilot's power (pw), and the league itself comes from power × form. The result: better gear → higher power and league → stronger AI gear → parity.
- `js/game.js` `mkBot` still copies `ref.wmult` / `ref.chm` (the player's weapon and chassis multipliers) on the non-`ai` path, plus `pScale` 0.92–1.08.
- Also check `mkBoss` (boss HP from player DPS, DPS from player HP), `rebuildBot`/`endRound` (counter-chassis switching), `worker/src/eco.js` `pickGhosts` (`GHOST_BAND` 0.25 on live rooms; AI matches use `AI_GHOST_LO`/`HI` 0.7–0.95), and any other path where enemy stats read the player's loadout, power, league or tier.
- First find which commit(s) reintroduced the parity after the Oct 31 combat-repair fix (`git log -S`/`git blame` on those lines), and say plainly why the previous 4 fixes didn't hold.

Also broken (owner, Nov 9): the AI fires its super weapon every 0.5–1 s, as if the super charges instantly, and it seems to dash just as often. Super + dash spam together is a broken combo. AI must charge and cool down its super, dash and every ability under exactly the same rules and timers as the player (same charge sources, same cooldowns, no free resets). Find why it doesn't today (separate AI code path, missing cooldown, charge from the wrong source, per-frame triggering) and cover it in the regression test.

Owner direction: the league should be the main difficulty lever, with only a slight adjustment for overall gear level (never a copy of the player's gear). **You have design freedom.** The goals and guardrails below are fixed. How you get there (AI loadouts per league, skill and tactics tuning, enemy counts, ability usage, matchmaking tweaks, the exact gear adjustment curve) is yours to design, as long as you explain your choices and prove them with the sims. If you find a better approach than anything suggested here, use it and say why.

Goals and guardrails (from the owner's standing rules):
- Enemy AI never copies the player's gear. Difficulty comes mainly from the league, plus authored, visible things: mode, number of enemies, AI skill (accuracy, tactics, focus-fire limits). A slight, bounded adjustment for the player's overall gear level is allowed, but it must never erase or invert the gear advantage (the acceptance sims prove this). Owner, Nov 9: higher gear must make every league noticeably easier. Within the same league, each gear step must be felt as an easier fight, or gear becomes pointless again. The adjustment exists only to keep top gear from making a league trivial, never to even it out. Enemy AI gear comes from fixed authored loadouts per league with a hard cap below the top player gear (no Lunar Skin, no Moonbeam-class weapon on ordinary AI).
- Gear always matters, at every league, including Lunar Legend. Never weaken existing gear, Moonbeam or Lunar Skin; fairness comes from leagues and matchmaking, not nerfs. Ghosts in AI matches stay clearly weaker than the pilot and are labeled.
- Top leagues stay challenging through skill and numbers, not stat copying.
- Real PvP balance doesn't change except for proven bugs.
- Points: keep the payout rules and caps (daily 50,000 shared cap, league point rates) unchanged. If the league points-per-minute measurement in LEAGUES.md shifts, report the new numbers; don't retune payouts.

Acceptance (seeded, deterministic sims with the real game code, enough matches per cell for stable rates; report every cell):
- For each league (Rookie → Lunar Legend) and each arcade mode, including 1v1, 2v2, 3v3, Bounty, Survival boss and Last Standing, run pilots at stock, full common, full rare, full Epic, and full legendary (Lunar Skin + Moonbeam + Epic Colossus) against that league's AI.
- Win rate and damage ratio must rise at every gear step in every league (no flat or inverted steps). Owner-approved targets (calibrate toward these; if a mode genuinely needs a different band, justify it with data):
  - Stock vs its own league AI: 45–60% wins.
  - Each gear step: at least +8 points of win rate.
  - Full Epic: 70–85%.
  - Full legendary: 78–92%, so it's never a guaranteed win.
  - Legendary damage taken: at most ~65% of damage dealt.
- AI super and dash usage rates match what a player can achieve under the same rules (report AI supers and dashes per minute vs the player maximum).
- A permanent regression test in CI (node suite) that fails if any of these monotonic gear steps flattens or inverts, if any enemy stat path copies the player's gear, or if AI abilities fire faster than the player rules allow. It should fail on the current main before your fix, so the bug can't come back a 5th time. Show it failing on main first.
- Before/after table plus a plain-language summary for the owner. No softlocks in any mode; client/server parity; PvP frozen loadouts untouched; Worker dry-run clean.

## B. Desktop keyboard driving (Conquest unplayable on a computer)
From the Fix queue: the code reads WASD/arrows (`view.js` keys → `controlInput`), and the living-war CI bot drives by keyboard in headless Chromium, so the break is likely environment-specific. Suspects: focus held by a button or dialog after ENTER CONQUEST, Telegram Desktop / website embedding, or the website boot path.
- Reproduce on the real website build and a Telegram Desktop-like embedding first, then fix it.
- Add a desktop keyboard journey to CI that uses the website build and the real focus flow.
- Show on-screen desktop hints only on keyboard devices: WASD move, mouse aim, Space fire, Shift dash, F shield, G gather, C scan.
- Touch/phone controls must not change.

## C. Session 5C leftovers (from the 5C release report)
1. The CC10 Home Sector spawn faces the reactors; spawn facing the open plaza/gate at every CC.
2. When a session starts on the gate centre, the tank parks on the diorama's Command Center. It must spawn on clear ground.
3. Remove the old 5B kiosk that stands inside the diorama.
4. Hub hero towns at CC1 and CC5 read as plain blocks; make them read as towns (same kit, CC10 already passes).
5. BUILD tab at PEEK shows no card; the resource line wraps at 390 px. Fix both.
6. The Cannon card sprite is dark.
7. Ridge ground is one flat tone outside the plaza/roads; add the site's terrain variation.
8. Storage tank tops and settler-home pads are too dark.
9. Diorama rebuild after a town change takes 65–106 ms on iPhone in one go; spread it across frames if cheap.
10. Get a fresh judge pass on the pad diorama at CC1 and CC10 (the late ground fix was never re-judged).
Keep 5C's draw/triangle/program budgets (programs ≤ 16).

## Don't touch
Accounts, saves and save schema, payments, prices, Stars/TON/SOL, referrals, token economics, earned gear, and the economy rules in ROADMAP "Standing owner decisions". New tank/weapon/town 3D models are the next session (Models); don't start them here.

## Final report (plain words, for the owner on a phone)
What caused the gear parity and why it came back, the before/after table, what's live (build number), the regression test name, B and C results with screenshots, anything still open, and the next session (Models: all Meshy tanks, weapons, Moonbeam v9 and the 12 town items).
