# War Machine Laboratory — Session 1 Architecture

**Prepared:** 2026-10-28 UTC. **Status:** approved planning baseline with superseding 2026-10-28 amendments; only Session 2 authorized. **Scope:** Session 1 only. Repository: https://github.com/solb7403-creator/war-machines. Remote HEAD and fresh isolated checkout both resolve to **`d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec`**, unchanged from the gameplay handoff. Existing UI build `20261024082816`.

The supplied implementation brief in the conversation and `/workspace/LUNAR_GAMEPLAY_EXPERIENCE_AND_SYSTEMS.md` were used. A separately attached `LUNAR_WAR_MACHINE_LAB_CODEX_IMPLEMENTATION.txt` was not present among accessible workspace files; no claim is made to have read an unavailable attachment. The pasted brief supplies the Session 1 requirements.

## 1. Recommendation and approval boundary

Build an additive mobile Laboratory inside the existing Telegram Mini App. A machine is a **named configuration referencing account-owned gear**, not a second inventory, second wallet, extra combatant, or independently purchased copy of existing upgrades. Give every account two free slots. Keep ordinary Play and all six modes accessible without opening the Lab. Use the actual shared simulation for a free isolated range. Default exact builds to private; publish separate safe showcase projections only on explicit consent.

Do not change existing inventory, paid Moonbeam/Lunar skin, chassis counters, rewards, token allocations, referral payouts or LP percentages. New functional modules must be free and equally available, bounded sidegrades, with unchanged stock/empty-module behavior. Existing paid combat gear remains compatible; this expansion does not retroactively remove those entitlements or claim the current game is power-neutral.

This is a substantial multi-session project. The six sessions are delivery boundaries, **not an estimate that each fits one conversation or a fixed amount of engineering time**. Payment consistency, match snapshots/proof integration, and public privacy each deserve explicit gates. No code edits, commits, branch creation, pushes, purchases, database operations, merge or deployment were performed in Session 1. This document is outside the checkout at `/workspace/WAR_MACHINE_LAB_ARCHITECTURE.md`.

### Approaches considered

| Approach | Strength | Cost / tradeoff | Recommendation |
|---|---|---|---|
| Add machines to existing account and shared rules | Reuses identity, equipment validation, combat, payment rails, rendering and Telegram UX | Must untangle selected equipment from inventory and freeze battle state | **Recommended**; proposed, not yet user-approved |
| Separate desktop workshop with shared account APIs first | More visual room | Authentication/deep-link/sync work before mobile player value; likely duplicated UI | Defer desktop; same identity/economy if later built |
| Physics-based assembly / new combat engine | Maximum assembly freedom | Changes collisions, controls, balance, proof and AI, risking the proven game | Out of scope |

The smallest complete vertical slice is **two slots → preserve current loadout → rename/save/switch → validated, frozen loadout in ordinary battles → results still count normally**. Ship it before module stats, test-result charts, public discovery and new checkout. Existing purchase screens continue functioning; no placeholder payment button may imply a new slot can be bought before that grant path is safe.

## 2. Current implementation: source-backed inventory

References are pinned to inspected HEAD. Line anchors identify entry points; inspect the full functions before coding.

| Area | Current contract | Concrete source |
|---|---|---|
| Browser structure | Plain scripts share global scope; order rules/core/net/game/match/pvp/render/fx/ui/main. No framework or second service needed | [dev notes](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/dev/README.md), `index.html` |
| Persistence | localStorage per Telegram ID or local profile; chunked Telegram CloudStorage; boot merges cached state, then server sync | [core.js](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/js/core.js#L128), `main.js:boot` |
| Identity | Signed Telegram initData validated by Worker; `pid = tg_<id>`; API authenticates before actions. Signed start_param is parsed separately | [index.js:44](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/worker/src/index.js#L44) |
| Authoritative account | `eco/<pid>`; ETag conditional write retry `tx`, revision counter, pure transaction callback; post-commit mirrors | [eco.js:97](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/worker/src/eco.js#L97) |
| Inventory/stat math | `wOwn/cOwn`, recorded rolls/salvage, account upgrades, core levels/shards, paint/skin/Moonbeam; `ecoLoadout` resolves ownership and ignores client stats | [rules.js:314](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/js/rules.js#L314) |
| Stat derivation | `weaponOf`, `chassisOf`, `powerOf`, `tankOf`; client `myLoadout` and `buildStats` also assemble/display values | [rules.js:136](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/js/rules.js#L136), `core.js:128` |
| Selection | client `weapon/chassis`, per-family tier/salvage selection, `cores`, `paint`; `S.L` is canonical server loadout, `pw/lg` derived | `core.js:getW/getC/fixEquip/myLoadout`; `eco.js:199–201`; `ui.js:161,576,589` |
| Sync/claims | sync chooses canonical loadout; client `applyEco` copies allowlisted `ECO_KEYS`; `/api/act` applies rules under `tx` | [net.js:23](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/js/net.js#L23), `core.js:180`, `eco.js:559` |
| Existing migration | `S.mig` is the older phone-to-server economy migration with payment reconciliation; unrelated to new machines | [eco.js:459](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/worker/src/eco.js#L459) |
| AI battles | client `prepareMatch/buildMe`, shared `simStart/update`, localEnd reward preview, server ticket/proof and final scoring | [match.js:12](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/js/match.js#L12), [eco.js:265](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/worker/src/eco.js#L265) |
| Live PvP | join canonicalizes raw L, assigns league/seat, room runs same sim; room holds L and allows owned `chs` swaps in VS/round | [pvp.js:389](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/worker/src/pvp.js#L389), `pvp.js:139`; `worker/sim-api.js:liveSetup/liveTank` |
| Sim build | rules.js + game.js + sim-api generate uncommitted sim.gen.js and proof LIM | [build-sim.mjs](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/worker/build-sim.mjs) |
| Rendering | 2D input/HUD retained above optional 3D; merged chassis/weapon geometry, menu art cache, graphics fallbacks | `render.js`, `render3d.js`, `models3d.js:92,228`, dev notes |
| Persistence visibility | Firebase denies direct reads/writes except public `lb`; players mirrors, ghost pool and ranks are separate from account | [database.rules.json](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/database.rules.json), `eco.js:148` |
| Payment contract | descOf whitelist → server price → Stars invoice/webhook or TON/SOL verification → tx + ecoGrant → records/spending/revenue; Stars ecoRefund | [index.js:155](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/worker/src/index.js#L155), [index.js:438](https://github.com/solb7403-creator/war-machines/blob/d1ca584aa2c7fdae5fecd3728ee9af78d48a2eec/worker/src/index.js#L438), `rules.js:475,491`; `net.js` |
| Deployment coupling | main pushes to worker/rules/game trigger Worker deployment; rules and scheduled workflows exist too | `.github/workflows/deploy-worker.yml`, `deploy-rules.yml`, `pilot-check.yml`, `sol-check.yml` |

### Existing state that must survive

Account state includes spendable/lifetime/daily/weekly points, caps, streaks, days/credit, five paid upgrade investments, inventory/rolls/salvage, core levels/shards, skins/paints, pass season/claims, daily/weekly/milestone claims, referral claims, crate counts/deals, paid receipts/recovery/refunds, Vault/Genesis Gold, matches and flags. Preserve these **by leaving them account-owned**, not by copying them into new machines. Preserve local settings, queued match submissions, pending wallet payments and Stars recovery acknowledgements as well.

`ECO_KEYS` currently does not include server `S.L`, power/revision metadata, or client selected core/weapon fields. Simply adding a machine field to localStorage will not make it authoritative. Client mirror application and server response projections must be explicitly revised. `ecoNorm` has economy repair behavior (including historical over-budget refund); new migration should not reuse normalization as a general way to mint/refund points.

### Battle contracts that constrain the design

There are two distinct verification paths: AI combat is run on the client and checked by server tickets/proof; live combat runs in Durable Objects. Neither can be replaced with a mock arena for ranked matches. Preserve `GTYPES`: Arena, Moon Zone, Crystal Rush, Bounty, Last Standing, Survival, their team/solo/respawn rules, map movement/bridge physics and current first-match exception.

Current `matchStart` stores ticket mode/map/time/power/multiplier but not an immutable full L. AI `matchEnd` derives proof speed from current `S.L` (`eco.js:345`), which sync can change. Multiple named loadouts make that coupling much more exposed. **Freeze a validated loadout and allowed chassis variants per match**, and use them for proof and result reconciliation rather than the latest garage. Live rooms already hold a canonical L; extend that snapshot contract and keep it independent of later editing, refunds and upgrades.

VS chassis changes are real existing functionality. Preserve swaps among owned classes using the ticket/room's allowed chassis set, same weapon/cores/global upgrade values and compatible module profile. Do not introduce arbitrary slot/weapon swaps during a battle. Track pre-round chassis choice with bounded phase-valid records; proof must validate against allowed snapshots rather than widening all movement limits. Matchmaking/reward league policy for counterpicks stays as currently implemented unless explicitly approved; modules must not silently add a higher-reward counterpick exploit.

## 3. Proposed contracts and schema

All examples below are **proposed**, not existing fields or running APIs. Canonical data remains in one account transaction initially to avoid cross-record ownership races. Use server-issued IDs, bounded objects, revision preconditions and strict key validation. No arbitrary JSON configs, HTML, remote mesh URLs or executable blueprint scripts.

### Account extension (logical schema)

```json
{
  "lab": {
    "v": 1,
    "rev": 1,
    "active": "m_legacy",
    "slots": {
      "base_1": {"machine": "m_legacy", "source": "free"},
      "base_2": {"machine": "m_spare", "source": "free"}
    },
    "machines": {
      "m_legacy": {
        "name": "War Machine MK-I",
        "rev": 1,
        "current": {
          "w": {"a": "pulse", "t": 0, "s": false},
          "c": {"c": "vanguard", "t": 0, "s": false},
          "cores": ["dmg", "rof", "arm"],
          "mods": {"hull": "stock", "mobility": "stock", "mount": "stock"},
          "looks": {"paint": "stock", "bodyKit": "stock", "effect": "stock"}
        },
        "saved": [],
        "visibility": "private"
      }
    },
    "migration": {"v": 1, "source": "server-L", "at": 0}
  }
}
```

No client-supplied `q`, `up`, `gl`, skin bonus, Vault level, power, slot count or price is authoritative. Selected gear IDs/rarity/salvage reference existing inventory; resolve quality/levels on every validation. Reuse premium `skin` as an account entitlement. Do not create per-slot copies of gem shards or paid gear. Inventory is reusable across slots, since only one machine enters combat. Selecting the same Moonbeam in two slots does not grant two weapons.

Proposal: two free slots, **maximum six usable slots for first release** to bound UI/storage. Keep entries for archived/refunded slots rather than delete machines. Bound total machine records to six fixed slot positions, including archives: a later entitlement reactivates an archived position and its existing machine/history instead of creating another record. Archive/reactivation is visible before checkout; canonical payment history remains separately durable and is not stored as unbounded embedded machine history. Extra slots have independent entitlement provenance: earned purchase ID or verified payment ID. Never infer ownership from array length. The cap is a review choice, not an established product requirement.

Initial upgrades `S.up` and `gemLvl` remain account-wide. Machine cards label “Account upgrades apply to every machine.” Machine-specific core choices are free configurations, not duplicate cores. A machine-specific upgrade allocation would allow free slot switching to bypass paid/half-refund respec; **defer it unless a new upgrade economics contract is approved**. History stores selected configuration and a recorded effective-stat summary, not new entitlement balances.

### Shared rule boundaries

- `normalizeMachineSpec(raw)`: shape only, finite enums, limits, Unicode/text handling; no grants.
- `validateMachine(S, spec, catalogVersion, mode)`: ownership, unique cores, module budgets/mount compatibility, allowed looks; return explicit field errors.
- `resolveMachine(S, spec, rulesVersion)`: authoritative canonical L with account stats and recorded gear quality, then immutable stat snapshot. Build through existing `ecoLoadout` and `tankOf` rather than duplicate formulas.
- `projectShowcase(record)`: explicit allowlist for publishable appearance and coarse creator-approved information. Not `pub(S)` or serialized L.
- `applyLabAction(S, action, expectedRev)`: pure idempotent mutation under existing `tx`; request conflicts return current revision, never last-writer-wins over a second device.

Legacy `ecoLoadout` intentionally falls back from invalid gear to owned gear. **Lab Save/Import should instead show actionable validation errors**, while combat resolution retains defensive canonicalization. Restore/import previews identify missing parts and changed rolls; silently replacing them would misrepresent “reproducible.” Show differences before saving.

### Proposed endpoint behavior

Reuse authenticated Worker routes; no public Firebase subtree reads.

| Proposed operation | Contract |
|---|---|
| `lab/read` | Owner-only bounded lab envelope and revision; browser cache not authority |
| `lab/save`, `rename`, `activate`, `snapshot`, `restore` | authenticated owner, expected lab/machine revision, op ID; validate owned slot; no point grants |
| `lab/slot/earn` | quoted catalog version/price, op ID; debit points and add entitlement in same `tx`; no lifetime gain |
| `lab/publish`, `unpublish` | owner chooses showcase or full blueprint and confirms exposed fields; replace/tombstone projection with monotonic publication revision |
| `showcase/get`, `list` | bounded public projection only, pagination and cursor; no private L/private account ID leakage in responses |
| `blueprint/import` | public blueprint version → local preview → owner validation/save; never inventory grant |
| `showcase/report` | authenticated, rate-limited moderation queue; no economy reward |

Implementation may multiplex lab commands through `/api/act`, but keep lab-specific pure functions and response schemas separate; do not let publishing actions call economy-award helpers. Same-origin authenticated mutation rules apply to future desktop integration. Do not expose Telegram initData in links or trust a URL's owner ID.

## 4. Migration, compatibility and rollback

### Deterministic lazy migration

1. New code reads old fields without modifying points/gear. Introduce `lab.v`, **not reuse or reset `S.mig`**. If old phone-to-server migration is pending, finish that existing reconciliation first. Do not import arbitrary client lab entitlements through `b.mig`.
2. In an owner transaction, if `lab.v` is absent, construct `base_1/m_legacy` from canonical `S.L` and current owned inventory; use fixed IDs, not fresh random IDs on retries. Copy selected w/c/cores/paint, not balances or stored multipliers. Set module/kit defaults to stock. Construct `base_2/m_spare` as a copy of the same selectable configuration, free and independently editable. No new gear granted. Record migration source/version once.
3. A failed/timed-out authoritative read is an error/retry, never evidence of a new account; do not initialize lab state from null synthesized by an I/O failure. If there is no valid `S.L`, return a reconciliation state rather than invent a historical selection. Use owned stock defaults for a new account. For an established account with only device selection, accept a one-time bounded selection hint after server economy reconciliation; canonicalize against inventory. Label it a fallback; never claim the unknown prior selection was preserved exactly.
4. Preserve legacy selected fields on the client as an adapter to the active machine during the mixed-version window. Persist the **owner's machine state on server**, add explicit lab response copying, and make server revisions override CloudStorage timestamps. Legacy cached lab objects cannot overwrite newer canonical machine revisions.
5. Backfill is not required for launch. Lazy migration performs no leaderboard reset, no inventory deductions, no grants, no new match, no quest/active-day update and no purchase action. Profile reads must not increase retention metrics.
6. Concurrency: ETag retry reconstructs the same free IDs exactly once. Save/activate/earned-slot operations carry operation IDs and expected revisions. Test simultaneous migration/sync/upgrade/payment and device restores.

Mixed clients: capability negotiation. Once a pilot uses the Lab, an old client may read compatible active L but must not overwrite machine records with every raw `b.L`. Require an update before ranked module use. Default stock lab pilots can remain on the legacy protocol during a short transition. Version AI proofs/tickets and PvP wire format; drain old rooms naturally, never load a new catalog into an existing fight. Keep catalog/proof support through the maximum ticket/room expiry plus pending result queue window. Current AI ticket TTL is 30 minutes (`eco.js:ECO.TICKET_MS`) and live socket ticket TTL is 20 minutes (`pvp.js:PVP.TOKEN_MS`); room and queued-result retention must also be confirmed when implementing, rather than treating token expiry as room lifetime.

### Battle snapshot contract

Proposed ticket fields: `rulesVersion`, `catalogVersion`, `machineId`, `machineRev`, canonical starting L, immutable allowed chassis variants, derived stats/hash, existing mode/map/series/league/multiplier. Server derives all values. Avoid sending private modules to other clients beyond combat-needed visual/stat projection. AI proof records need phase-valid counterpick markers tied to the variants; live rooms use the same stat resolver. Garage changes affect the **next** battle. Current match result must not read newly active slot or latest upgrade balance.

Refund during a fight doesn't mutate its frozen tank mid-round. Revocation applies to future starts/restores/imports; settle the in-progress ticket under a consistent stated policy. Migration must preserve queued old results until accepted/expired; new lab saves cannot replace a pending match ticket merely to synchronize a profile.

Rollback: feature flags separately gate read/write/module use/range/sharing/paid slots. Turn off new starts while existing rooms finish on pinned rules. Preserve all lab fields/entitlements/history; read-only recovery view if needed. Roll back to a **compatible** server that still honors verified grants, not an arbitrary old commit that forgets new purchases. Never subtract paid slots or discard drafts as a deployment rollback. Production backfill, flags, activation and rollback execution all require separate approval.

## 5. Functional modules: initial proposal for balance review

Use three existing foundation classes and **three functional fitting slots**: hull, mobility, mount. Visual bodywork, track/engine fittings and barrel/mount geometry communicate those choices. Separate cosmetic kits never alter hitbox or derived stats. Do not add cooling/heat, ammunition or a new targeting model in the first catalog: they do not currently exist and would change proven combat.

Proposed initial free catalog (all players, no point unlock or paid rarity). Values below are **candidate tuning**, not approved balance:

| Slot / option | Benefit | Cost | Weight / power |
|---|---|---|---:|
| Stock, any slot | none | none | 0 / 0 |
| Hull: reinforced plates | +6% HP | −4% ordinary movement speed | 2 / 0 |
| Hull: light frame | +4% speed | −6% HP | 0 / 1 |
| Mobility: sprint gearing | +6% speed | −6% ordinary weapon DPS | 0 / 2 |
| Mobility: stable gearing | +5% ordinary DPS | −5% speed | 1 / 1 |
| Mount: hardened mount | +5% HP | −5% ordinary DPS | 2 / 0 |
| Mount: firing mount | +6% ordinary DPS | −6% HP | 1 / 2 |

First budget proposal: weight ≤3, power ≤3; one option per slot. Bonuses sum **within each stat**, then multiply existing derived HP/speed/ordinary DPS once. No bonus-to-bonus compounding. Legal-domain bounds must be enumerated from the catalog, not silently clamped after validation (a clamp can remove costs). Reject unknown/incompatible IDs and over-budget builds. Each nonstock choice has a cost, but that alone does not prove equal practical power; release requires simulation and human trials.

Formula proposal, preserving old formula exactly when empty:

```text
B = existing tankOf(canonicalLegacyL, modeHealthScale)
H = sum(module.hpDelta); V = sum(module.speedDelta); D = sum(module.normalDpsDelta)
HP = round(B.mhp * (1 + H))
ordinaryWeaponDps = B.wdps * (1 + D)
movementStat = B.spdM * (1 + V)
all other B fields unchanged
```

Source-specific caveats: dash currently uses a fixed speed path rather than ordinary spdM; leave it unchanged and label movement bonuses “driving speed, not dash.” Supers currently use separate weapon/upgrade multipliers; do not accidentally modify super damage by changing a shared damage multiplier. Survival boss HP references player ordinary DPS and cannon damage; preserve its current scaling with the resolved modified baseline and test effect. Mode health/team scaling remains unchanged, so percentage-HP survival/ring mechanics must be evaluated. Do not change class IDs, counter multipliers, turn speed, range, hit radius, crit, core math, aiming, cooldowns, shield or spawn behavior in catalog v1.

No paid-only functional module, enhanced paid roll or extra simultaneous fitting socket. Premium geometry may restyle a legal fitting without concealing class/team/weapon readability. Functional catalog is portable across classes; every class variant is validated so VS counterpick doesn't strand a machine. If later class-exclusive mounts are desired, define explicit per-class legal variants before approval.

**Power/league:** keep current power formula for stock. For modules, propose evaluating existing power math with effective HP/ordinary DPS/movement and retaining existing core factor/rounding; derive, never accept a client power override. This is approximate strength, not a balance proof. Re-evaluate league boundary/counterpick effects and AI scaling; module catalog must remain gated from ranked play until those checks pass. Higher league pay is an existing policy; changing it is outside this proposal.

Visual implementation: add enum-driven fittings to existing `models3d` builders and 2D tank drawing. Include chassis/weapon/mods/skin/paint/bodykit/effect/catalog/size in art cache keys; release old GPU resources when evicted. Keep existing mesh batching, low-quality and no-WebGL paths. No free-form geometry upload, arbitrary shaders, collision mesh changes or image upload in v1. Do not add large downloads for two default slots.

## 6. Engineering UI and isolated test range

Keep five main tabs. Garage becomes the machine shelf with two cards, an active badge, quick equip and “Engineer.” Ordinary Play shows active machine name and the existing setup/FIGHT; it does not force an engineering detour. Equip is distinct from editing an unsaved draft. Surface saving/offline/conflict states, ownership failures, empty slot and restored-but-incompatible versions.

Illustrative text wireframes (proposals, not screenshots or implemented UI):

```text
GARAGE                         ENGINEER: MK-II
[MK-I • Active] [MK-II]         [large tank / rotate]
Foundation / weapon            Hull | Mobility | Mount | Looks
Power • league                 [Stock] [Reinforced plates]
[Equip] [Engineer]             +6% HP    -4% driving speed
[+ Slot: earn or buy]          Weight 2/3  Power 0/3
Account upgrade summary        HP 1700 → 1802; speed 4.4 → 4.2
                               [Save version] [Free test]

TEST RANGE • NO REWARDS         MACHINE HISTORY
Seed / map / mode / AI          MK-I • saved date • rules v
[Use same trial] [Reset]        baseline vs selected
No points, quests or rank      [Compare] [Restore preview]
Damage • survival • outcome     Gear changed? explain before Save
[Retry] [Compare] [Back]        [Visibility: Private]
```

Touch targets ≥44 CSS pixels, safe-area bottom controls, readable numbers without color-only deltas, explicit cost labels, no hover requirement. A selected section highlights on the model and opens a bottom sheet; do not cram four editing panels onto a phone. Screen-reader labels, reduced motion, keyboard access and focus restoration for sheets. One primary action at each step. Returning players can use current gear without relearning combat. Onboarding: name machine → choose optional sidegrade → inspect cost → free test → ordinary battle; dismissal persists locally without quest requirements.

### Hard isolation boundary

Do **not** invoke `newMatch`, `prepareMatch`, `startMatch` and `localEnd` as a normal ranked flow with a boolean that merely hides reward UI. They transitively submit tickets, advance quests, store balances, queue matches, update activity/farm signals and mirror ghosts. Reuse actual `rules.js/game.js` through an isolated sim instance with its own HOST and lifecycle, following the existing createSim pattern. Factor a supported browser simulation adapter/build artifact if necessary; do not duplicate combat into a second implementation. Route input/render events to that instance without mutating ranked globals or sharing live timers.

Proposed range lifecycle: capture draft → resolve legal owned loadout → create independent simulation with mode/map/seed/opponent policy → start/drive/retry → collect local-only summary → dispose instance. No range-originated production endpoint for range start/end, no range proof submission, no `ecoMatchPts`, `ecoAfterMatch`, `ecoProgress`, `syncPlayer`, `store` economy path, ghost report, referral credit, pass XP or active-day event. Before entry, flush or safely park pre-existing ranked submissions and payment recovery; never discard them. Separately owned recovery may continue with explicit origin tagging, but must not consume or observe range outcomes. Range telemetry is optional operational telemetry, never an economy signal. If online catalog/ownership sync is unavailable, use last validated local snapshot with “offline experiment” label and require revalidation before battle/save server-side.

“Same trial” requires **all simulation randomness**, including bot selection/plans/events/spawns, to use an instance RNG. Current combat uses Math.random; introduce an optional per-instance RNG with existing default behavior retained for normal combat. Introduce this RNG/test seam in Session 3, before paired balance tests; Session 4 adds the range UI and fully isolated lifecycle. Seed/map/mode/team size, canonical tank/opponent loadouts, historical AI difficulty, rules/catalog version and controller policy form the trial identity. Use real `botAI`, events and bullets; no scripted fake hit/damage approximations. A future test driver may exercise AI, but display whether the player drove or automation drove. Repeatability within the same engine/version is feasible; don't promise bit-identical cross-browser floating-point replays.

Modes: default short Arena practice; selectors can exercise all six actual goals. Boss/ring/respawn trials remain their genuine mechanics. Allow one repeatable stock opponent preset and one comparable equipped preset first. Reset returns to exact initial state. No debug-only invulnerability or free paid gear leaks into ordinary matches. Optional unowned-part preview, if later approved, is explicitly range-only and never saves as a legal owned build.

Results: damage dealt/taken, kills/deaths, duration, outcome/placement and mode objective stats; stat baseline before/after. Label “one trial” / sample count, seed and version. Keep at most **20 local summaries per machine** and aggregate pairs from the same trial identity. Do not advertise win-rate superiority from one run or compare unlike AI seeds as causal evidence. Range summary loss is acceptable when clearing device cache; server storage is for named configuration/history, not frame traces.

## 7. History, blueprints and social surfaces

### Bounded evolution

Proposal: current config plus **five explicit saved snapshots per machine**, not per slider movement; bounded record size and name (24 Unicode code points, escaped as text). Rename doesn't duplicate snapshots. Save records timestamp, config, original stat summary and catalog version. On sixth snapshot ask which older one to replace, preserving current machine. Restore is validate → preview effective changes/missing parts → save as new current revision; it never restores points, gear entitlements, old quality rolls, quests or paid status. Paid/refunded/rebalanced parts make historical configurations potentially unavailable. Preserve old snapshot as evidence; do not silently rewrite it into a stronger/cheaper current item.

### Three separate disclosure levels

- **Private (default):** owner-only exact specs, drafts, names unless explicitly shared, history and test summaries. No implicit publication by entering a battle.
- **Showcase:** explicit sanitized appearance/class/weapon-family projection, creator-chosen display name and optional coarse performance descriptors. No module IDs, roll values, cores, upgrade allocation, exact private stats, seed traces or match timestamps. Avatar/creator credit uses a server-issued public handle, not raw Telegram ID.
- **Published blueprint:** creator explicitly agrees to release exact selected gear/module/core configuration, rules version and attribution. Publish portable part references, not account-owned quality, receipt info, inventory or full S.L. Consumers reproduce selections **with their own** owned quality/upgrade/core levels; show resulting stat differences. Byte-identical performance is not promised across account progression.

Publishing exposes a deliberate immutable revision; editing private drafts doesn't mutate it. Showcase and blueprint visibility require separate confirmation. Unpublishing removes it from discovery and owner-controlled public endpoints; prior downloads, screenshots and valid copies cannot be recalled. Tell creators this before publication. Copies keep original creator and parent blueprint ID; edits add an editor credit without replacing original attribution. A clone grants configuration only, never paid or earned parts. Missing parts require a legal substitute preview or save as draft only; no ranked use until valid.

**Privacy limit:** combat necessarily reveals visible equipment and some effective stats; enemies can infer strengths. Current live roster includes gems/gemM/HP/speed and AI ghost records transmit L. Marketing must say “configuration not published,” not “impossible to reverse engineer.” Before adding secret mods, make ghost and live rosters explicit combat projections and exclude new full private machine/history/owner IDs. If enough stats are needed to render/predict combat, do not call those values secret. A public showcase page must not reuse the full live roster endpoint as its data source.

### Public storage and consistency

Keep private machine state under owner transaction. Add separate **server-only** `labPublic/<publicId>` projections and a paginated recent/featured index. Never make `eco` or `players` newly readable. Owner publication revision/visibility is authoritative. Mark a bounded pending-publication event in the owner transaction; a retryable projector writes only the current approved revision. Public reads verify active publication state/revision, so a stale cached projection cannot resurface after unpublish. Explicitly design cache invalidation and in-flight publish→unpublish races; no fail-open privacy on a metadata lookup failure. Public result bodies contain only projection allowlists and immutable public blueprint fields.

Initial discovery: recent and manually featured, opt-in profiles, bounded pagination; no paid boosts, purchasable votes, popularity-linked point grants or weekly “most tests” prizes. Lightweight creator credit and a featured badge provide recognition without point inflation. Authenticated reporting, name filtering/escaping, moderation hide/tombstone, rate limits and abuse queue before public launch. Do not infer suitability from a high vote count. Server writes public projections only after explicit owner authorization; requests specifying someone else's machine ID must fail.

Defer searchable free-text index, automated engineering contests, voting economies, transferable blueprints, trading/marketplace, user-uploaded art, public match-trace analytics, contest prizes and cross-app workshop until usage/cost/moderation needs are measured. Publishing must not grant squad/referral points or generate a paid vote opportunity.

## 8. Pricing proposal and payments

### Economy anchors and proposed price review

Current anchors: first upgrade level 500; second 2K; full one-stat investment 20K; salvage 10K/20K; common/rare point crates 20K/80K; capped match/squad stream 20K/day. Rookie base wins range 250 Arena duel to 900 first-place solo; actual earning speed depends on wins, modes, quests and cap. First-day login is 125 at Bronze, plus milestones/dailies. Existing paid paints are 150–300 Stars / 2.4–4.8 TON; common crates 250/4; Starter 399/6; pass 799/13.

**Recommendation to review, not final prices:** extra slot candidate **10,000 points OR 150 Stars OR 2.4 TON equivalent SOL**, same price for each slot up to proposed six-slot cap. Reason: comparable to an earnable salvage purchase, half the daily capped stream, and a lower-priced cosmetic purchase; avoids escalating scarcity for a convenience feature. Consider sensitivity cases of 5K and 20K points, and 100–250 Stars, before selecting. Do not implement these numbers until approved. Two free slots already satisfy core build comparison; extra slots must never add in-match team size, modules or reward rate.

At 10K points, illustrative pre-bonus **all-win** requirements are about 40 duel wins, 21 2v2 objective wins, or 12 first-place solos; these are arithmetic scenarios, not measured time-to-purchase. Quests reduce matches required, losses increase it. Exact prices require cohort/time-to-first-upgrade data and conversion sensitivity; no telemetry was fetched. Measure slot use and point opportunity cost without conditioning ordinary feature access on purchases. New functional options free; paid body kits, paint/effects/themes exclusively cosmetic, with free defaults/seasonal earned alternatives. No extra history storage sold in first release.

### Verified purchase extension

Slots need an explicit SKU/catalog version and granted entitlement ID, not a client-set `slotCount++`. Existing `descOf`, `ecoPrice`, `ecoOwned`, `ecoGrant`, `ecoRefund`, labels, invoice payload, recovery UI, paidRecords/migration audit and admin/support must recognize it consistently across all three rails. Preserve `spendGram`, existing receipts, LP 25% / project 75%, refund deductions and payment support. New purchases cannot grant leaderboard points. No token revenue assumption or allocation change.

Earned slot: authoritative price quote, client revision/op ID, points debit and entitlement creation in one account tx. Concurrent requests for the last allowed slot must not both spend; stale quotes/cap conflicts return a conflict before checkout. Server uses one entitlement ordering across earn/buy paths. If paid confirmation arrives after cap is reached, grant recoverable account credit/support refund entitlement under a defined policy, never silently charge and drop the benefit. Recommended: reserve pending slot capacity with expiry for paid checkout and still handle late settlement explicitly.

### Status of earlier concerns: current source review only

| Finding checked at HEAD | Observed code | Consequence for Lab / gate |
|---|---|---|
| SOL validation | `verifySol` checks successful tx and recipient net balance increase against request `amt`; `payLog` takes SOL amt/gram from body; `solValueOk` returns true when rate fetch fails | Valuation is fail-open in current source; verification is not bound to a server-created SKU/amount/payer/order before payment. Do not broaden SOL sale surface until server quote/order-bound verification, expiry/reconciliation and isolated negative tests pass. No live exploit tested |
| Referral attribution | auth parses signed `sp`, but `sync` assigns from `b.refBy` if valid shape/self/day checks pass; assignment happens outside account ETag tx using earlier players mirror | Source confirms request-body trust and a concurrent write risk; validate signed referral source/first eligible entry and atomic immutability before new sharing/deep links. Preserve established referrals; don't retroactively reattribute |
| Purchase idempotency / LP | per-account `gout` retains only last 12 grants; chain signature claim exists; Stars webhook always rewrites payment/receipt and calls revAdd after tx, even if tx returns prior grant; chain payLog post-grant logging/revenue is outside account CAS | Current paths do not visibly make revenue increments exactly-once across duplicate delivery/concurrent checks/crash windows. Needs local reproduction tests and durable settlement design before new SKUs; not a claim that production balances are wrong |

New public blueprint deep links need a separate prefix, never masquerade as a referral. A creator link without a verified referral cannot grant referral attribution. Do not call all shared-network users fraudulent; retain existing manual-review policy.

Proposed payment solution: server-created immutable order (`pid`, SKU/version, amount/currency, quote expiry, nonce), verified evidence tied to that order, durable evidence uniqueness and account-grant marker retained beyond retry horizon. Account tx grants once and marks settlement; post-commit receipt/revenue/LP work uses durable per-order ledger/outbox, reconciled after failures. **Do not merely add another `if (!dup)` around revAdd**: that still loses/counts twice across crash windows and separate Firebase writes. Choose an atomic ledger boundary or replay-safe aggregation from settled orders; quantify cron/request costs before implementation. Refunds are signed verified events with durable reversal IDs, reverse grant/spending/accounting once, and cannot delete user data.

Refunded slot: remove that entitlement from usable capacity; archive its assigned machine (retaining it and history), make a remaining free/earned machine active if needed, allow export/transfer into an available slot. Do not claw back unrelated gear/points. Do not confiscate an earned slot merely because a paid one was earlier in the UI. Prevent laundering refunded paid looks via saved snapshots/import. The existing bounded refund marker (`rfd`) must be considered in durable settlement design too.

For Session 2, **defer new slot checkout** if this shared payment gate cannot be completed safely; expose clearly unavailable purchase UI or omit it while earned slot implementation is ready after price approval. Session 6 integrates all rails with sandbox verification. Existing payment fixes that change shared behavior need separate reviewed scope, even if required before release.

## 9. Implementation sequence and cost/risk

Future work on a feature branch; draft PR if authorized/supported. No pushes to main: workflows can deploy. The following plans are conditional on architecture approval and each session's authorization.

| Session | Concrete sequence / affected surfaces | Exit evidence | Relative cost |
|---|---|---|---|
| 2: multi-machine | shared spec validators → account lazy migration/owner actions/revision → applyEco/sync adapters → canonical active L → frozen AI/PvP snapshots and VS variants → two-slot UI → approved earned-slot debit. Checkout may stay deferred | old/new/malformed records; no balance/inventory loss; multi-device/CAS conflict; ownership; all modes and counterpick preserved | High: persistence + combat integration, not merely UI |
| 3: modules | per-instance deterministic RNG/test seam → catalog and enum/legal budgets → shared resolution → power/proof/AI limits → roster/prediction → 2D/3D visuals/cache → before/after metrics → seeded balance matrix | stock equivalence; no paid module gate; legal combos; six-mode balance; known limits of win-rate study | High: balance/proof/AI coupling |
| 4: lab/range | independent sim adapter and RNG → range route/lifecycle → input/render isolation → presets/seed/retry → local comparison summaries → responsive/accessibility | no production calls/writes/awards; actual mechanics; repeatability; clean disposal; no ranked-state bleed | Medium–high: current global scripts need a real instance boundary |
| 5: sharing/history | bounded version save/restore → public projection and publish/unpublish state machine → import ownership → public list/featured → moderation/report → attribution | unauthorized private access blocked; cache/race tests; no imported entitlements; bounded storage | High if privacy/cache contracts are included; postpone complex search |
| 6: commerce/polish | approved prices → payment order/idempotent settlement/refund gate → slot/cosmetic SKUs and recovery → onboarding/wiki → optional analytics → support/reconciliation | three-rail verification, duplicates/crash recovery/refunds/LP, no score effects, mobile QA | High: shared payment work may exceed one session |
| Final review | integration/balance/migration/security/cost review → staged-release plan and rollback rehearsal | explicit approval before merge, production migration or deployment | Separate launch gate |

Keep deployment activation separate from code readiness. Module-enabled accounts must not be exposed to an old live server/proof catalog. Price, public visibility, earned-slot grant and payment changes need consistent client/server versioning. Session 2 can complete a useful two-slot product without waiting for public blueprints or commerce.

Initial storage/cost budgets (proposed limits to validate): six machines × current + five snapshots, ≤1 KiB config per snapshot, private lab record **≤48 KiB** including metadata; enforce both count and byte limits. Account tx writes/retries the full economy record, so avoid storing per-trial traces there. Owner read returns selected summaries and on-demand history if needed; CloudStorage chunks must not become an ever-growing cloud mirror. Public page size ≤20 items, projection ≤1 KiB/item, immutable blueprint ≤2 KiB; paginate, cache public immutable views but enforce revocation. Names/metadata and idempotency journals also need byte limits. Payment evidence must be durable rather than evicted to meet a tiny UI cache cap. Benchmark concurrent tx/download bytes and quota using existing load harness before choosing final limits. No production cost measurement was performed.

## 10. Test and release plan

Session 1 did **source inspection only** and read the prior 60-match handoff; it did not rerun gameplay, payment or backend tests. Existing test assertions and developer claims are not treated as passing results for current work. Test scripts may generate `worker/src/sim.gen.js`, so they were not run in this strict no-code-write session. Future tests run in disposable copies with fake database, Telegram and payment/RPC responses, no production API fallback or secrets.

### Required invariants / tests

1. **Migration fixtures:** brand new, old local-only, pending `mig`, server account with/without L, old salvage fraction, missing/null Firebase collections, maximum inventory, bought skin/Moonbeam/Founder/pass/Vault, pending ticket/payments, over-budget historical upgrades, concurrent first sync. Assert preservation against the legacy-normalized baseline for all account balances/claims/receipts; existing ecoNorm can already refund historical over-budget upgrades, so distinguish that pre-existing reconciliation from zero Lab-caused economic changes. Migration itself does not claim activity or mint rank. Run migration twice and concurrent eight-retry paths.
2. **Ownership and races:** forge slot ID/owner/module/gear/q/gl/up/paint; unowned import; NaN/Infinity/oversize/name injection; stale revisions; two devices activate/edit; duplicate earn request; insufficient points; earn+paid at cap; receipt replay after >12 other purchases; no negative balance or double grant. Unknown fields rejected/ignored per explicit schema, not spread into S.
3. **Combat parity:** empty module and two-slot adapter must produce identical `tankOf`/`powerOf`, collision/input/counters and mode rewards to legacy fixtures. Every mode × team size (solo appropriate) × four maps, first match/protected AI/mature AI, stock/salvage/crate/premium/max legal builds. First-match 1v1 exception preserved. Proof, client prediction and live server resolve the same stats. VS/round swap, reconnect, ghost and refunds/saves/upgrades during battles cannot mutate frozen snapshots.
4. **Module balance:** enumerate every legal combination on each class/weapon/core profile/low and high account progression; verify budget, monotonic costs and no clamp-erased penalties. Paired seeded trials, reciprocal player sides, varied controllers and human trials across all modes. Include carrier survival, zone capture, bounty trades, ring HP damage, boss scaling, bridge navigation, dash (unchanged), shield/super timing. Report distributions, sample sizes and controller limitations. Flag apparent dominant configurations for review; do not declare balance from a few bot wins.
5. **Range isolation:** spy/fail on any range-originated match-start/end, act/claim/sync/ghost/notification/payment route; independently tagged recovery of pre-existing ranked results/payments must remain correct; hash account and ranked state before/after; local summaries only. Zero reward/cap/quest/pass/day/referral/airdrop/anti-farm changes after 100 retries or background resume. Escape/back, renderer failure, exception, queued ranked results and page reload all preserve isolation. Same version/seed/config repeats within tolerance; changing one factor tracked explicitly.
6. **Privacy:** owner/private/showcase/full-blueprint response allowlists; guessed IDs and direct URLs; publisher identity spoof; draft edits; public cache after unpublish; failed projector/retry/racing older revision; logs/telemetry/ghost payload no private config leak. No publication by test/battle. Explain unavoidable combat inference.
7. **History/import:** revision bounds, restore missing/refunded/rebalanced items, name moderation, clone attribution retained, no inventory or paid looks granted; old rules summaries clearly historical. Imported draft requires validation before ranked use.
8. **Payments:** Stars precheckout/settlement/refund/replay; TON recipient/memo/amount/late confirm; SOL recipient, failed tx, real transfer evidence, quote amount/order ownership, FX outage/expiry, duplicate signature, wrong currency; retries/concurrency/crashes between verify/grant/receipt/LP; support recovery after app closes; cumulative revenue exactly once minus verified refunds. No live charge for tests.
9. **Referral and sharing:** signed referral vs forged body; first attribution atomic/immutable, self/existing users, multiple launch links; showcase link cannot assign referrer; privacy publication doesn't count as play. Keep manual anti-farm review and existing reward thresholds/caps.
10. **UI/performance:** widths 320/360/390/430 and desktop, Telegram safe areas/back, keyboard/screen reader, scroll and sheets, no-WebGL/2D/Auto, model cache memory after many edits, constrained CPU, no network/offline draft, reconnect/conflict and pending checkout feedback. Ordinary FIGHT still easy to reach.

### Existing harnesses to extend (future execution)

`node dev/tests/wtest/test.mjs` (auth/economy/payments/migration); `pvp.mjs` (room/swap/reconnect); `farm.mjs` (proof/farming); `load.mjs` (request/byte costs). `proofreal.py`, `regress.py` and `pvptest.py` execute actual game behavior. `b8test.py` uses server economy; older browser tests can use `LUNAR_LOCAL_ECO` and must not substitute for authoritative tests. `b9test.py` covers reset/ghost/boss, `b10test.py` graphics, `b11test.py` Vault, `b12test.py` ticket retry, `b13test.py` link quests. `qa.py` and `perf.py` support mobile/layout/performance. `worker/smoke.mjs` under isolated wrangler validates real Durable Object runtime. No generic package lint/build script was identified in the inspected file inventory; use repository's documented sim build and test workflow and check available tooling again before coding.

### Staged launch gate (plan only)

After approval and implementation: backup/restore rehearsal against nonproduction copy → migration fixtures and stock parity → staging with new flags off → internal two-slot cohort → opt-in slot cohort → seeded range/modules only → owned public showcase cohort → commerce only after settlement review. Rules/code deploys must finish compatibly before enabling modules. Keep existing six-mode play available if lab/sharing disabled. No automatic production migrations/backfill, deployment or flag changes in these sessions.

KPIs are hypotheses, not promised outcomes: Lab open→named save→first change→test→normal battle→7-day return; slots used, repeat experiments, build diversity by mode/class, ordinary play completion, validation failures and save conflicts, public opt-in/import success/report rate, range CPU/memory/cost, optional purchase conversion and refund rate. Do not log hidden module specs into public analytics, raw Telegram auth, wallet keys or full input traces. No reward for event spam. Existing earned points/airdrop credit remain driven only by existing qualified sources.

## 11. Decisions requested before Session 2

The detailed choices below are recommendations to approve/change, not assumptions already agreed:

| Priority | Decision | Recommended answer / consequence |
|---|---|---|
| P0 | What does a slot own? | Configuration only; shared inventory/core levels/upgrade investment. Avoids duplicate gear and respec bypass |
| P0 | Upgrade allocation per machine? | **No** in initial release; changing this requires a separate economics design |
| P0 | First vertical slice | Two slots, migration, named save/equip and immutable ranked snapshots; no new checkout until verified |
| P0 | Functional module access / ranked activation | Free universal sidegrades; proposed catalog experimental until six-mode balance/proof gate; no paid modules |
| P0 | Extra-slot price | Review 10K points / 150 Stars / 2.4 TON proposal and sensitivity; confirm later, **do not ship assumed prices** |
| P0 | Shared payment/referral hardening scope | Approve separately before exposing new paid SKUs/social attribution; source concerns documented, no production exploit test |
| P1 | Initial limits | Six usable slots, five saved snapshots/machine, 20 local trials/machine; limits reviewed after load test |
| P1 | Public disclosure | Private default; explicit showcase/full blueprint; accept combat inference and irrevocable downloaded copies |
| P1 | Refund/cap policy | Archive machine, revoke only relevant capacity; defined late payment resolution and support before charging |
| P1 | Recognition | Manual/recent showcase and attribution; no vote/contest economy or points for sharing/testing |
| P1 | Existing paid advantages | Preserve existing entitlements; expansion promises no new paid functional power, not retroactive equalization |

**Review outcome needed:** approve or revise this architecture, with attention to the P0 choices. Session 2 must not begin until you approve. No claim of balance, implementation completion, security remediation, test passing, production readiness or financial outcome is made here.

### Session 1 review and verification record

A fresh read-only builder review identified four planning gaps; this version resolves them: deterministic RNG support precedes Session 3 balance tests; migration preservation uses the legacy-normalized baseline; range isolation distinguishes unrelated pending recovery traffic; six total slot positions include archives, preventing refund cycles from creating unlimited history storage. These are design corrections only. The review did not execute implementation tests. Final verification checks document references and a clean isolated checkout; it does not establish runtime test passing.

## Approved baseline — superseding amendments (2026-10-28)

Architecture approved subject to [SESSION_1_APPROVED_AMENDMENTS.md](SESSION_1_APPROVED_AMENDMENTS.md). That record supersedes the earlier pricing/extra-slot implementation proposals: Session 2 grants exactly two free slots and implements no purchase, earned-slot debit or new entitlement flow. Six-slot policy is future configurable/versioned, not a fixed product ceiling. Future meaningful visual customization and separate cosmetic/functional entitlements are preserved as extension boundaries. Optional public sharing remains Session 5, private by default. Session 2 alone is authorized.

## Session 3 implementation addendum (2026-10-28)

The user subsequently authorized Session 3 only, including a local commit and verified bundle. [SESSION_3_IMPLEMENTATION_REPORT.md](SESSION_3_IMPLEMENTATION_REPORT.md) records the implemented free catalog, separate visual styles, stat formulas, protocol compatibility, RNG seam and observed tests. Candidate values were retained. Session 4 range UI and later monetization/sharing remain unimplemented; no production activation or push is authorized.

## Session 4 implementation addendum (2026-10-28)

Session 4 is implemented locally as described in [SESSION_4_IMPLEMENTATION_REPORT.md](SESSION_4_IMPLEMENTATION_REPORT.md). A restricted independent browser realm loads the existing combat sources; the parent reuses controls/rendering through a synchronous restored view, without ranked/economy hooks. Owned draft validation, explicit offline cache labeling, six genuine mode arrangements, seeded retries, local bounded comparisons and disposal form the completed slice. No server migration or new economy/social feature is introduced. This supersedes earlier statements that the range remains unimplemented. Session 5 and deployment remain outside this authorization.
