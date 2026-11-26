SESSION 8 — PAYMENTS CERTIFICATION + THE STORE. Model: Opus 5.5 · Effort: Max.

I approve merging this session's PRs into main once all checks pass.

You are the lead for LUNAR: War Machines (repo solb7403-creator/war-machines). The owner is not monitoring: never stop to ask him anything. Every price, limit and payment rule below is the owner's decision (approved Nov 26, 2026): ship them exactly; a better number goes in the final report as a labeled PROPOSAL. You may change design and code choices when clearly better, recording each with its reason in the checkpoint. Follow the owner rules in CLAUDE.md, AGENTS.md and docs/owner-rules.json, including Nov 25: monetization must add value and never make play frustrating to push purchases; never adjust a guardrail threshold to match new results. NO LIVE PLAYERS YET: no migration, grandfathering or legacy-save code.

== START HERE ==
- New branch from current main. If Session 5E-2d2 (branch claude/conquest-models-addendum-yg3oj6; it also changes js/core.js, js/net.js and js/ui.js) is not merged yet, merge main again before release and keep both sides.
- FIRST SLICE (one small commit, then push): save this prompt word for word to docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md and open Checkpoint 52 in docs/conquest/IMPLEMENTATION_CHECKPOINT.md with a "Resume here" section whose first line reads: "If your context was cleared, read docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md first; it governs everything." Keep "Resume here" current after every slice.
- Read: CLAUDE.md, AGENTS.md, docs/ROADMAP.md (row 8, Standing owner decisions), docs/conquest/audit/DECISIONS.md 12, docs/conquest/audit/CONQUEST_1_0_SPEC.md §9-10, docs/economy/RESOURCE_ECONOMY.md §7.5 and §9, old open PR #21, Checkpoints 39 (the two payment gaps), 41 (open item 6) and 47-51 (the paying pilot's late fortress), and the code: js/net.js (pay, labPriceLabel), js/core.js (CRYPTO_PAY), js/rules.js (RSTARS, RPRICE, PASS_PRICE, the RS_* Lab store, LAB_STORE_OPEN, ecoGrant), js/conquest/catalog.js, js/conquest/plot.js (STORE, storeList), worker/src/index.js (descOf) and every Worker payment path (Stars invoices and webhook, TON Connect, SOL), pay.html, web/boot.js and the website shop.

== 1. WHERE EACH PAYMENT WORKS (owner) ==
- The website is the main way to play and the main store: GRAM and SOL. Remove the website block in js/net.js pay() ("Purchases are available in the Telegram edition only").
- Telegram: Stars and GRAM (owner, Nov 26: "Ton and stars on telegram. Not just stars."), with a server-side switch that turns GRAM on or off inside Telegram in one step, without a release (owner: "gram is in with a switch that flips it on and off"); default on. Record in the checkpoint that Telegram's Nov 17, 2026 developer notice says digital goods inside bots and Mini Apps must be paid in Stars; the switch is the owner's answer to that risk.
- TON was renamed GRAM on June 15, 2026 (same chain, wallets and TON Connect): show "GRAM" wherever a player sees the coin; internal ids may stay.
- Rates unchanged: 77 Stars and 1.25 GRAM a dollar (RS_STARS_USD, RS_TON_USD); SOL at the live GRAM rate.

== 2. WHAT GOES ON SALE (owner, Nov 26: everything built that passes his guardrails) ==
- Everything sold today (crates, packs, the Lunar Pass, paints, gear and gem caches, deals), in every currency above.
- The Conquest store at the proposed prices in the one table (js/conquest/plot.js STORE): wall extension pack $2.99, Gilded wall skin $4.99, Neon turret skins $4.99, Foundry speed-up $1.99, Second builder $9.99, Aurora town lighting $3.99, Extra layout slot $1.99; the base cosmetics in js/conquest/catalog.js at their proposedUsd. Build any missing grant (for example the paid second builder; an earnable one exists).
- Minerals (RESOURCE_ECONOMY §9.1): Ferrite Crate (150 Ferrite) $1.99, at most 2 a day; Ilmenite Crate (60 Ilmenite + 30 Ferrite) $4.99, at most 1 a day and 4 a week.
- Construction speed-ups: finish a running construction timer now, priced by the time left with the Lab's instant-finish curve (RS_FIN: $0.22 x hours^0.85, 5-minute steps, $0.10 minimum), the earn time shown beside it; construction timers only.
- The Lunar Pass Conquest perks (spec §9: RECALL 5 min, scanner +50 m, two extra layout slots, one Repair Kit a day; the plate finish waits for row 6B-V) inside the existing pass (799 Stars / 13 GRAM); build what is missing. Its research perks (passResearch) start with the Lab store.
- Rare-or-better ore for town walls only (owner, Nov 23): Armalcolite, Tranquillityite, Selenite Glass and Moonheart, each in its own wall-only crate, at most 1 of each a day: Armalcolite $4.99, Tranquillityite $7.99, Selenite $9.99, Moonheart $14.99. Bought ore is marked wall-only: it never goes into tank plates or anything else, is never traded or gifted, and never grants points. Size each crate's amount with dev/tools/fortress-model.mjs so ROADMAP row 8's requirement holds (a paying pilot at the 2-hour heavy play time is fully built within the year and noticeably stronger than a free pilot who plays as much) while a free pilot's pace is unchanged; record the measurement, labeled as simulated. This owner decision replaces "rare and above are earn-only" for town walls only: update RESOURCE_ECONOMY §9.1, the spec and the store copy (plot.js storeList).
- Not built yet, so not on sale: any item whose item or art does not exist (for example plate finishes, row 6B-V). List each in the final report.
- Convert every dollar price the way the Lab store does (rsFinPrice): Stars = ceil(USD x 77), GRAM = USD x 1.25 to 2 decimals, SOL at the live GRAM rate. One table holds every price and limit.

== 3. THE SCIENCE LAB STORE (owner, Nov 26) ==
- Open it (LAB_STORE_OPEN true).
- Legendary set mods: 1,500 Stars / 23 GRAM each (the Epic crate's price; was 599 / 9.6), at most one a UTC week, still on sale only after that track's earned set mod is researched.
- Unchanged: research packs (Field kit 99 Stars / 1.6, Lab crate 249 / 4, Research cache 599 / 9.6, one of each a UTC week) and instant finish (RS_FIN).
- Report the new pacing, labeled as simulated: days for a pilot who buys everything to finish the tree and all four Legendary set mods (about 8-9 before).

== 4. CERTIFICATION (ROADMAP row 8) ==
- Review old PR #21 first (gated Stars/TON/SOL orders, recovery and certification fixtures) and reuse what holds up.
- Fix the two gaps from Checkpoint 39 that crates, chosen cores and chosen gear share: (1) Telegram's pre-checkout check re-checks ownership and the current price, so two invoices opened at once can never both be paid at the old price; (2) GRAM and SOL purchases check whether the player already owns the item.
- solValueOk fails closed ('pending') when the price service is down.
- A purchase landing between a Legendary research start's account read and its outbox credit is certified atomically with the checkout (Checkpoint 41 open item 6).
- Every price, limit, deal and ownership rule is checked on the server in every currency (Stars, GRAM, SOL), never trusted from the phone; every payment is credited exactly once (replays, two tabs, a slow chain, a refund).
- Turn on CRYPTO_PAY, LAB_STORE_OPEN and the Conquest catalog checkout (catalog.js checkout.enabled) only once every check above passes.
- Guardrails (owner): paid items never grant airdrop points directly; never sold: anything in the loot tables, points, Gambits, consumables on their own, trophies, boards. Research, mods and wall-only rare ore are sold only as this brief says. DAILY_CAP 50,000 and CQ_PTS unchanged.

== WHOLE-SESSION REQUIREMENTS (with EVERY change in this session switched on) ==
- All pass: every node and browser test named in the CI workflows, plus new tests for every purchase path (Stars, GRAM and SOL; website and Telegram; the GRAM switch on and off; every limit; both gaps; fail closed; exactly-once credit). No test skipped, deleted or loosened; a failing guard follows the owner's Nov 25 guardrail rule.
- Phone and computer equal, website first: the store, checkout and receipts captured at 390x844, 390x700, 320x568 (touch) and 1366x768, 1920x1080 (real keyboard and mouse), on the website and in Telegram.
- Research how the best comparable games present their stores and checkout before changing the store screens (findings in Checkpoint 52).
- Three fresh, independent, read-only reviewers (1: payments and exactly-once credit; 2: every owner rule, guardrail and price against this brief; 3: payout and airdrop integrity), PASS/FAIL with evidence; at most 2 rounds (a 3rd only for something clearly broken). Fix every blocker.
- Commit and push every tested slice. While builders run, also push a wip snapshot of their work at least every 30 minutes, so a usage limit, a clear or a lost container never loses work. Keep Checkpoint 52 current. Never end a turn waiting on CI without a scheduled wake-up.

== RELEASE (pre-approved) ==
dev/bump.sh. Open the draft PR only when the work is ready for review, so wip snapshots don't set off PR failure alerts. When its work, reviews and checkpoint are finished, mark it ready and add the auto-release label (the workflow merges and deploys it). Verify the Worker deploy (/pvp/health ok, live version.json = repo) and GitHub Pages; ROADMAP row 8 -> RELEASED with PR, merge and build; release record in Checkpoint 52; a docs-only follow-up PR the same way if needed.
Final report: what changed, with captures; every price and limit as shipped; what is not on sale and why; and a short phone checklist for the owner: one small real purchase with each method (Stars and GRAM in Telegram, GRAM and SOL on the website), what he should see, and how to flip the GRAM switch.

Do not stop for context: ignore any rule to stop or hand off at a context level, and let Claude Code compact and keep going. After every compaction, re-read the brief and Checkpoint 52 "Resume here" before the next step; they win over any summary. Then continue through release.
