# Fair Arcade (Session 5D, Nov 10 2026): the league sets the AI, never your gear

Owner report, plain words. Numbers: the real game code (`js/rules.js` + `js/game.js` + `js/match.js`) in the seeded simulator
(`dev/tests/fair-arcade-grid.mjs`, 6 maps x 4 seeds = 24 matches a cell, the game's own bot flying the player's tank: the same
auto-aiming turret a person gets). Before = `main` at `f193de1`, after = this branch. Full tables: `FAIR_ARCADE_TABLES.md`.

## What caused the gear parity, and why it came back four times

1. **The AI's power was a curve of your power.** `aiLevel` fielded the strongest authored loadout under
   `68 x (your power / 68)^0.7 x league step`. Every crate, core level and purchase raised the AI with you. At Lunar Legend the
   league step was x1.265 in 1v1, so the owner's kit (power 235) met a 181-power AI: a full 14-level Epic build, level-5 cores, a
   reactor (supers charge 40% faster) and the Sprint mod. 181 is 77% of 235, and the AI never misses.
2. **At top gear the fight is supers, and supers are an equaliser.** A super charges from damage dealt (x1) *and* damage taken
   (x0.7, the player rule, PvP too). In a Lunar Legend duel each side fired a super every 3-4 s, and super damage was most of all
   damage. The AI's Epic super (350 x 1.47) is nearly a Moonfall (400 x 1.48). So "AI at 77% of my power" played as "about even":
   the owner's Bounty 1v1 (16,385 dealt vs 16,160 taken) matches the simulator's old numbers (damage taken 0.82-0.90 of dealt).
3. **The previous fixes measured the wrong thing.** Oct 31 (curve 0.75), Nov 2 (curve 0.70, 33 tiers to 181, league steps) and the
   Nov 8 pass each proved "win rate rises with gear" in bot simulations (87% for the Legendary kit) and shipped. None measured the
   damage trade or the top-gear super loop, and the regression test (`combat-balance.mjs` part 4) pinned the AI tier, so it could
   not see the AI creeping up with the player's power through the league step. The git history before Nov 8 was squashed
   (`js/rules.js` history starts at `d1f5ad4`), so the exact commits cannot be blamed line by line; the three documents above are the
   record. Each later balance pass pushed the AI ceiling up for "challenge" and the rule "AI power = f(your power)" was never removed.
4. **Two more paths copied gear.** Live rooms that nobody else joins (30 s) fill the seats with AI pilots that *mirrored the middle
   human's weapon and chassis multipliers, cores and rarity aura*; with one human that is a mirror of you. And ghosts (offline
   pilots' real tanks) could take the one enemy seat of a 1v1 at up to 95% of your power.

## What changed (design, with the owner's freedom)

- **One authored AI power per league** (`LG_AI_PW`): Rookie 68, Pilot 72, Veteran 82, Ace 98, Elite 120, Master 134, Lunar Legend 146.
  These are the loadouts a pilot *living* in that league meets (a league is reached by power x form, so the Legendary kit lives in
  Master/Lunar Legend, the Epic kit in Ace-Master, the stock tank in Rookie).
- **A slight, bounded gear adjustment**: AI power x (your power / the league's reference pilot)^0.3, clamped to 0.88..1.12. It
  keeps the best kit from making its league trivial; it can never even the fight (the simulator proves every gear step still helps).
- **A hard cap**: no AI pilot above power 165, i.e. Epic items with 10 of 14 upgrade levels and level-4 cores. No reactor tiers,
  no mods, never Moonbeam or Lunar Skin. The top five old tiers (168-181) are gone. Top free kit is 213, the full Legendary kit 235.
- **Never above your own power** (standing rule, kept): a stock tank in Rookie meets exactly the old starter AI.
- **League skill**: higher leagues' AI pilots fire a ready super sooner (Rookie waits 1.0 s, Lunar Legend 0.5 s) and dodge supers
  more often (35% -> 50%). Every AI ability still runs through the player's own functions: full charge for a super, the 4 s dash
  and 25 s shield cooldowns, the telegraph. Nothing resets for free. The regression test logs every AI ability use and fails if
  one ever fires early.
- **Survival megatank**: tuned to the league AI's reference tank (it used to be tuned to your own power).
- **Ghosts**: never stronger than the match's AI x1.05, in AI matches (phone and Worker) and, since the release review, in live rooms too (the Worker's `startVs` applies the same cap at the room league; before, a room's ghosts came from a plain +/-25% band around the first pilot's power, so a lone pilot's 1v1 could meet a stronger ghost in its one enemy seat). Still clearly weaker than you and labeled.
- **Live rooms**: AI fill-ins fly the room league's authored loadout (the middle human's league). Humans against humans are untouched;
  the only change is that a bot no longer mirrors a human's gear. Reason: a room with no second human is an AI match in disguise.
  One consequence for the owner to know (reviewer finding): in a mixed room (say a 2v2 with three humans and one fill-in), the side
  carrying the bot is now weaker than before, because its bot is a league tank (145 power at Lunar Legend) instead of a mirror of a
  235-power human. If you prefer the old mixed-room balance, the one-line alternative is to anchor live fill-ins at
  `min(middle human power, AI_CAP)`; I kept the league loadout because the brief's rule is that no AI ever copies a player's gear.
- **Points, payouts, caps, PvP rules, gear stats**: unchanged. Moonbeam and Lunar Skin unchanged.

What the kits meet now (AI power, 1v1 / 3v3 / Last Standing):

| Kit (power) | Rookie | Pilot | Veteran | Ace | Elite | Master | Lunar Legend |
|---|---|---|---|---|---|---|---|
| stock (68) | 68 | 68 | 68 | 68 | 68 | 68 | 68 |
| common (80) | 68 | 68 | 73 | 79 | 79 | 79 | 79 |
| rare (106) | 73 | 73 | 79 | 88 | 102 | 102 | 102 |
| epic (164) | 73 | 79 | 88 | 102 | 119 | 126 / 126 / 107 | 128 / 128 / 107 |
| legend (235) | 73 | 79 | 88 | 107 | 132 / 132 / 115 | 137 / 137 / 119 | 145 / 145 / 119 |
| top free kit (213) | 73 | 79 | 88 | 107 | 128 | 132 | 137 |

Before, the Legendary kit met 159 in Rookie and 181 at Lunar Legend; the Epic kit met 125 in Rookie and 159 at Lunar Legend.

## Acceptance (standard pilot; every league x mode x kit is in FAIR_ARCADE_TABLES.md)

Owner targets and what the simulator shows for the kits in the leagues where they live:

| Target | Result (24 matches a cell) |
|---|---|
| Stock vs its own league AI: 45-60% | Rookie 51% over the 7 modes (Arena 1v1 79%, 3v3 38%, Bounty 1v1 62%, Survival 79%, Last Standing 1st place 17%; par 17%) |
| Each gear step at least +8 points | Rookie 51 / 82 / 93 / 100 / 100%; Veteran 55 / 71 / 89 / 100 / 100%; Master 48 / 59 / 63 / 93 / 99%. Kits far under a league's AI meet an AI at their own power, so stock-common-rare sit close in high leagues (the CI test requires every step to improve wins or the damage trade; it does) |
| Full Epic 70-85% | Elite 93% (Arena 1v1 96% / 0.65, Bounty 1v1 88% / 0.67), Master 93% (Arena 1v1 92% / 0.76, Bounty 1v1 90% / 0.73); before: 77% / 76% with taken/dealt 0.98 in Arena 1v1 |
| Full Legendary 78-92% | Master 99%, Lunar Legend 99% for the perfect-aim bot pilot (before 83%); see the note |
| Legendary damage taken at most ~65% of dealt | Lunar Legend: Arena 1v1 0.48 (before 0.74), 2v2 0.40, 3v3 0.36, Bounty 1v1 0.54 (before 0.72), Bounty 2v2 0.49 (before 0.84), Survival 0.12, Last Standing 0.33 (before 0.80) |
| Legendary kills a death in Bounty 1v1 at Lunar Legend | 2.8 before -> 6.3 after |
| AI supers and dashes a minute vs the player maximum | Lunar Legend Arena 1v1: AI 6.5 a minute per tank (the league's 6 s minimum spacing, held across the rounds of a series), the pilot 11.0 under the same rules; AI dashes 4.4 (pilot 3.0; rule maximum 15). Every AI super logged at full charge, the shortest AI super gap in any cell 6.0 s, no dash or shield on cooldown |

Notes, honestly:
- **The Legendary kit wins nearly every simulated fight at the top.** The simulator's pilot never misses and always dodges a
  telegraphed super; a person on a phone does neither. The old model also gave 87-92% here while the owner felt parity, so the
  simulator's win rate alone is not the owner's experience; the damage trade and the kills-a-death are. I calibrated on those and on
  "every step felt", and kept the win rate under 100% only where the mode allows it (Bounty 2v2, Last Standing). If the owner's
  live play now feels too easy at Lunar Legend, raise `LG_AI_PW[6]` (146 -> 152 gives the 149 tier) - one number.
- **Bounty's damage ratio is a hull-size artefact.** With respawns, a heavy Titan + Lunar Skin tank "pays" 2,327 HP per death while
  the AI pays 1,318; a 6-4 kill lead reads as even damage. Bounty is judged by kills a death in the tables (Legendary at Lunar
  Legend: 2.8 before -> 6.3 after in 1v1).
- **The "human" pilot profile from Session 2 was not used.** It models manual aiming (30% hits); this game auto-aims the turret, so
  that profile predicts a stock tank losing every Rookie fight 9:1 on damage, which no live player reports. The standard pilot's
  numbers match the owner's live evidence; that is the proxy.
- **3v3 and Last Standing** meet the league AI too (the old model gave 3v3 no league step). Last Standing dilutes the league step to
  70% so a place among six stays reachable; its first-place rates are reported, not banded.

## Regression test (CI)

`dev/tests/fair-arcade.mjs`, in the `Equipment Balance` workflow. On `main` (`COMBAT_SRC=<main checkout>`) it fails 93 checks:
no hard cap, AI power 68 -> 181 across pilot power at every league, enemy rosters doubling with the pilot's gear, the megatank
scaling with the pilot's tank, a ghost at 92% of your power seated at Lunar Legend, live fill-ins copying the human's multipliers,
and the gear ladder inverting (Epic wins less than Rare in Master and Lunar Legend). On this branch: 11,475 checks pass (4 seeds a cell, 96 matches a kit a league).
It also runs the Conquest case: wave, garrison and commander stats identical for a stock and a Legendary pilot, town raids take
no loadout, the Legendary kit kills a heavy sentinel in under 60% of the stock time and keeps more hull under the same fire.

## Conquest (A2)

Conquest enemies are authored constants (`enemyStats`, raid doctrine by danger), commanders keep authored pattern cadences, town
raids (`plot.js drill/raid`) read walls, turrets and waves only. Nothing reads the player's gear, power or league in a way that
cancels the gear advantage. Verified by the regression test; nothing to fix.
