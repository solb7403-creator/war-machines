# Developer notes

## Files

| File | What's in it |
|---|---|
| `index.html` | Page shell: auto-update check, Telegram SDK, versioned CSS/JS tags |
| `css/app.css` | Every menu style (design tokens at the top) |
| `js/rules.js` | Pure rules shared with the PvP server: combat numbers, gear and tank stat math, modes and their pay, leagues, featured mode, live queues |
| `js/core.js` | Telegram setup, save + cloud save, data tables, points, quests, login streak, squad, shop logic |
| `js/net.js` | Server sync (verified Telegram login), leaderboard file, squad, Stars/TON/SOL payments |
| `js/game.js` | The simulation, shared with the PvP server: maps, physics, combat, supers, dash, AI, events, best of 3, live-player movement checks |
| `js/match.js` | The phone's side of a battle: AI match setup and scoring, and drawing what the sim reports (text, explosions, feed, banners, sound) |
| `js/pvp.js` | Live matches on the phone: finding pilots, the WebSocket, snapshots, your own tank's prediction, rounds, results |
| `js/render.js` | Battle canvas, HUD, battle input, and the menu art (tanks, crates, map thumbnails) |
| `js/fx.js` | Haptics and synthesized sound |
| `js/ui.js` | Menus, sheets, start screen, results, between-round screen |
| `js/main.js` | Boot order and the frame loop |
| `worker/` | Cloudflare Worker: the referee for every database write, Stars invoices, webhook, reminders, leaderboard cron |
| `worker/src/pvp.js` | Live PvP: the lobby and match-room Durable Objects, join and WebSocket routes, loadout checks, server-side results and points |
| `worker/src/db.js` | Firebase helpers, HMAC, and the live-match points credit |
| `worker/build-sim.mjs` | Bundles `js/rules.js` + `js/game.js` + `worker/sim-api.js` into `worker/src/sim.gen.js` (not committed; CI and the tests build it) |
| `worker/smoke.mjs` | CI smoke test: two pilots meet in a live room inside `wrangler dev` |
| `database.rules.json` | Firebase rules (everything locked except the public leaderboard file) |
| `terms.html` | Terms of service and purchase (linked from the game, the wiki and the bot's /terms) |

Scripts are plain (not modules) and share one global scope, loaded in the order: rules, core, net, game, match, pvp, render, fx, ui, main.

## Before every push

1. `git pull` first. Only one session should push at a time.
2. `dev/bump.sh` stamps a new build id into `index.html` and `version.json`, so phones pick up the update on their next open.
3. Run the tests below.

## Tests

Needs Node, Python 3 and Playwright with Chromium.

```
node dev/tests/wtest/test.mjs          # server: auth, points rules, payments, leaderboard, reminders
node dev/tests/wtest/pvp.mjs           # live PvP server: lobby, rooms, claims, supers, drops, quits, rounds, results, credits, loadout checks
python3 dev/tests/b1test.py            # sync with the local server stand-in, referrals, Stars recovery
python3 dev/tests/b2test.py            # menus, first-time flow, start screen, results, sheets
python3 dev/tests/b3test.py            # map objects, crates, events, fast forward, best of 3
python3 dev/tests/b4test.py            # sound, drag-to-aim supers, dash, bot dodges, reminders
python3 dev/tests/b6test.py            # salvage ladder, tune-up, Lunar Pass, paints, terms, featured mode, the 3 new modes
python3 dev/tests/b7test.py            # Untouchable health floor, 4 dailies + swaps, weekly quests, streak quest bonus, weekly chest, daily deal
python3 dev/tests/regress.py 3         # every mode x team size x map: stuck tanks, errors, points per minute
python3 dev/tests/perf.py              # frame times at 4x CPU slowdown
python3 dev/tests/qa.py                # every screen at 5 sizes: overflow, clipped text, hidden buttons
python3 dev/tests/pvptest.py           # two browser pages play live: matching, VS labels, moves, supers, drops, rounds, quits, AI fill, results
```

The browser tests start `dev/tests/devserver.mjs`, a local stand-in for the server and database, and mock the Telegram SDK. It runs the real worker code with local Durable Objects (`wtest/fakedo.mjs`) and a small WebSocket server, so two pages can play each other. Live matches are off in the older tests (`LUNAR_NO_PVP`); `open_game(..., pvp=True)` turns them on. Screenshots go to `$SHOTS` (default `/tmp/lunar-shots`).

## Live PvP

- **Rooms.** `POST /api/pvp/join` checks the Telegram login and the loadout, asks the lobby Durable Object for a room (same queue: mode + team size; league band widens from 0 to 2 while a room waits), takes a seat, and returns a signed ticket. The phone opens `wss://…/pvp/ws?r=room&t=ticket` straight into the room Durable Object.
- **The room runs `js/game.js`** (bundled by `worker/build-sim.mjs`) at 30 ticks a second and sends everyone the same snapshot 15 times a second, plus events (shots, hits, kills, pops). Each phone turns it to its own side: your team is 0 at the bottom; team 1 sees the map rotated half a turn (maps are point-symmetric). The snapshot layout is in `worker/sim-api.js` (encoder) and `js/pvp.js` (decoder).
- **Movement.** Your phone drives your tank at once and reports where it is ~10 times a second. The server follows those claims at the tank's real top speed (+30% for jitter) through the same collision code, so claims can't teleport or cross walls. Far-off or blocked claims make the phone resync. Shots, damage, supers, pickups and results are all server-side.
- **Quick Match.** Queue `quick.<team size>` fits any live mode room of that size (`queueFits`); a Quick Match room takes the mode of the first pilot who picked one, or a random live mode (not Last Standing) at the start.
- **Seats.** Live pilots alternate teams so they face each other. After 30 seconds AI pilots fill empty seats; with only one pilot, the phone plays AI locally instead. A pilot who drops gets an AI pilot until they reconnect. Leaving, or staying offline over 20 seconds at the end, is a loss with no points.
- **Points.** The room scores with the same formula as AI matches (`rules.js`: mode pay, best of 3 ×2, featured ×1.25, league from the checked loadout, win streak kept per player as `pvs`) and credits the player's record itself (`creditMatch`, daily cap included) before sending the result. The phone then banks the same amount locally so the next sync has nothing left to claim.
- **Loadout checks.** Every value must be one the game can produce; upgrades must be affordable from the points on record; Moonbeam and the Lunar skin need a purchase on record. Gear ownership itself still lives in the phone's save.
- **Free plan capacity.** About 93 Durable Object requests per player per match (WebSocket messages count 20 to 1) and ~30 GB-s per match: roughly 400 live matches a day. Past that, joins fail and phones fall back to AI matches.
- **3D.** `render.js` is still the only file that draws a battle. A 3D renderer can replace `drawBattle()` without touching menus, the sim or the netcode.
