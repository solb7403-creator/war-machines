# Pre-launch QA sweep (Nov 1 2026)

Website (iPhone Safari size, 390px) and Telegram Mini App paths, with the repo's browser tooling (local server stand-in running the real Worker code). No balance or price changes.

## Coverage
| Area | How | Result |
|---|---|---|
| Every screen at 320/375/390/430/768px | `qa.py` | 0 overflow / clipped / hidden-button issues |
| First-time flow, menus, results, sheets | `b2test.py` | pass after test fix (see below) |
| Six modes × 1v1/2v2/3v3 × 4 maps (52 runs) | `regress.py 1` | 0 stuck tanks, 0 errors, every run scored |
| Best of 3, map objects, crates, events | `b3test.py` | pass after test fix |
| Survival, Last Standing pay, build reset, ghosts | `b9test.py` | pass after test fix |
| Daily login, quests + swaps, weekly chest, streaks, deals, Founder | `b7test.py` | pass |
| Salvage, tune-up, pass, paints, terms, featured | `b6test.py` | pass |
| Server economy in the browser (claims, forged saves, Stars) | `b8test.py` | pass |
| Vault (Stars deposits, levels, board) | `b11test.py` | pass |
| Match ticket reliability | `b12test.py` | pass |
| Link quests (channel, X, wiki) | `b13test.py` | pass |
| Sync, signed referral, Stars recovery | `b1test.py` | pass |
| Squad/invites (website redirect + reopen, Telegram 390px) | `squad-browser.py` | pass |
| Frame time, 3v3 at 4× CPU slowdown, 390px | `perf.py` | worst draw p95 30.5 ms (Arena 3v3 Overpass), update p95 ≤ 7.4 ms |
| Server suites | `wtest/*` | all pass (test 189, referrals 29, pvp 106, farm 50, tickets 37, auth, identity, lab) |

## Issues
| Issue | Severity | Status |
|---|---|---|
| TON/SOL checkout live in the Telegram shop before certification (real mainnet wallets) | High | Fixed: Stars only (`CRYPTO_PAY=false`); in-flight crypto payments still verified by the server |
| "Guaranteed $LUNAR allocation" in the bot /start text and invite text | High | Fixed (Phase 1) |
| Wiki/in-game/reminder copy saying the top 1,000 "get/earn" $LUNAR | Medium | Fixed: "planned", "nothing is guaranteed" |
| Wiki said only Telegram accounts make the board | Medium | Fixed: website and Telegram count the same |
| Wiki squad rules outdated (days, launch bonus, match bonus, holds) | Medium | Fixed |
| Wiki/terms/website shop note promised TON/SOL checkout | Medium | Fixed |
| Website pilots had no invite link and no "Share win" | Medium | Fixed (Phase 1 links; Share win now shown wherever an invite link exists; link preloaded at boot) |
| Squad match bonus not shown on the results screen | Low | Fixed: "Squad match bonus +N" line |
| VS and between-round screens rebuilt their HTML on every UI refresh even when unchanged | Low | Fixed: rebuild only when content changes |
| b2/b3 timeouts: the VS/round screens auto-start after 4 s while the animated button never reads "stable" to the test tool | Test only | Fixed in tests (forced click when still on that screen) |
| b9 ghost checks: since #23 an AI-match ghost must be 70-95% of your power, and no stock ghost (68-71) fits under a stock pilot (68) | Test only | Fixed in test (upgraded visitor) |

## First 10 minutes and first purchase (as a new player)
What works: the first match is instant and coached; the first win gets confetti, a points line breakdown and a tip; the daily reward calendar and the one-time Rare gem cache give a reason to come back tomorrow.

Ranked ideas not built (expected impact on retention / revenue):
1. **Referral payouts on their own daily cap** (e.g. 10,000) instead of sharing the 20,000 match cap. Today heavy inviters' play points get crowded out by referral points that only count 7.5% in the ranking (see REFERRAL_SQUADS.md).
2. **A "first purchase" moment**: after the 3rd win, a one-time Starter Pack card on the results screen (it exists in the Shop, but nothing points at it at the moment a player is happiest).
3. **Day-2 hook on the results screen of day 1**: show tomorrow's login reward plus the squad welcome bonus for invited pilots ("play on 2 days").
4. **Website purchases**: website pilots (the main platform) cannot buy anything yet; Stars only work inside Telegram. A web checkout (after Phase 3) is the biggest revenue gap.
5. **Live-opponent density at launch**: queues fall back to AI quickly; with few players, schedule "live hours" announced in the channel.
6. **Squad prompt after a recruit verifies**: a push/reminder to the referrer ("Nova is now verified: +3% match bonus").

## Payments
TON/SOL are disabled in the client until Phase 3 certification. Stars checkout unchanged. Website: purchase buttons disabled with a note pointing to Telegram Stars.
