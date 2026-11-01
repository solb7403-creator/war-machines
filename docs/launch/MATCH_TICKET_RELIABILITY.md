# Honest matches always count: match tickets and results (build 20261101-ticket1)

Reported Oct 31 2026 (after `91d7e53`): Telegram iPhone, Bounty 3v3 on Longshot, a real win, "Not counted: no connection at the start", +0.

## Root cause
- **The rule, not the server:** the phone gave the ticket request one 3.5 s try plus one more inside a 4-second window. If neither answered (slow server, Telegram backgrounded, a weak or briefly dead connection), the result was thrown away at the phone and never sent. One bad moment at the VS screen zeroed a real match. `dev/tests/wtest/ticket-reliability.mjs` reproduces it on `main`: 6 s with no answer gives "Not counted: no connection at the start", +0.
- **Server latency (measured, `dev/tests/wtest/ticket-latency.mjs`):** `/api/match/start` made 7–9 serial Firebase calls (auth, power, ghost range queries, record read/write, mirror, session log): ~1.1 s at 150 ms a call, ~3.4 s at 300 ms with one write conflict, at the 3.5 s cutoff. The ticket also waited behind any queued old results.
- **Why Bounty 3v3:** not slower on the server (every 3v3 is the same). Oct 31 was Bounty's featured *live* day, so that match went live queue (30 s) → `solo` → AI fallback, and its ticket request fired right as the WebSocket closed, on an app reloaded for the release, against freshly deployed Worker isolates.
- **Unverified:** the exact transport failure on the owner's phone. Cloudflare outcomes for 23:00–00:59 UTC (read-only `worker-health` workflow) show only successes and no client disconnects, so the request most likely never got an answer back to the phone. No per-request logs were available to this session (no Cloudflare credentials; `wrangler tail` not possible).

## What changed
- **Phone (`js/match.js`, `js/ui.js`):** each match gets an id (`cid`). The ticket is requested at the VS screen and retried in the background for the whole match (8 s per try, backoff to 10 s), never behind old results. The VS screen waits at most 2.5 s. At the end the result is queued (`save.mq`) with its match record, `cid`, mode/map/loadout and time since it ended, and sent; no connection, 5xx or 429 → it waits and goes again (online, return to the app, every 20 s). The results screen says "Saving…", "Saved: it will count when you're back online" or "Saved: the server is busy", never "Not counted" for a connection problem.
- **Server (`worker/src/eco.js`, `proof.js`):** ghosts never hold up the ticket (looked up in parallel, 1.2 s cap). Same `cid` → same ticket. A newer match no longer kills an older ticket. Tickets live 24 h. A result with a late ticket or none counts if its record verifies (whatever the proof mode), within 24 h, once only, at most 12 a day, using gear the pilot owns. No two matches' time spans may overlap (recent spans kept per pilot). The hourly cap holds a result (retry next hour) instead of refusing it. An unknown mode/map on a ticketless result (release window) is held. The daily cap is unchanged.
- **Live PvP (`worker/src/pvp.js`):** crediting a result retries on a database error (5 tries) instead of paying 0. A pilot who drops near the end but fought at least half the match keeps the real result. Gone for most of it, or an explicit leave, is still a loss.

## Reject reasons

| Reason | Honest-player risk before | Now |
|---|---|---|
| offline (no ticket at start) | **High**: any 4 s network gap at VS | Gone. Background retries all match, then sent with the record; queued offline |
| server (5xx at start) | Medium: DB hiccup | Retried; result queued and resent |
| rate (429) | Low–medium (burst, shared IP) | Ticket retried; result held and resent |
| expired (30 min) | Medium: offline > 30 min | 24 h window |
| ticket (old ticket replaced) | Medium: held result + next match | Older tickets kept; only refused if its fight ended after the next match began |
| hourly (40/h) | Low | Held, counts next hour |
| mode / map | Low (version skew in a release) | Ticket: play on, no ticket. Ticketless at the end: held during a release |
| update / garage_changed (at VS) | Low; blocks start only | Unchanged (no match lost; the VS screen says why) |
| fast | None for real play | Unchanged (late/ticketless: judged on the record's own length) |
| proof | Low (flag mode default) | Unchanged on time; late/ticketless must verify |
| overlap (new) | Only two devices at once on one account | Anti-cheat |
| late (new, >12 ticketless/day) | Very low | Anti-cheat cap |
| Live: credit DB error | Medium: 0 points | Retried 5x |
| Live: away 20 s at the end | Medium: weak signal = loss, 0 | Real result if present ≥ 50% of the fight |

## Tests
`ticket-reliability.mjs` (real phone code + real Worker, virtual clock): slow server 5/15/40 s, dropped first request, lost reply after server success, Telegram backgrounded on VS, ticket mid-match, offline whole match then online, deploy between start and end, the reported Bounty 3v3 case, held older result, hourly hold. Each credits exactly once. Cheats: forged record, impossible damage, replay, replay under a new id, ticket reused, made-up ticket, unowned loadout, late cap, >24 h, daily cap. All refused or bounded.
