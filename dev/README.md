# Developer notes

## Files

| File | What's in it |
|---|---|
| `index.html` | Page shell: auto-update check, Telegram SDK, versioned CSS/JS tags |
| `css/app.css` | Every menu style (design tokens at the top) |
| `js/core.js` | Telegram setup, save + cloud save, data tables, points, quests, login streak, squad, shop logic |
| `js/net.js` | Server sync (verified Telegram login), leaderboard file, squad, Stars/TON/SOL payments |
| `js/game.js` | The simulation: maps (data only), physics, combat, supers, dash, AI, Moon Zone, events, best of 3 |
| `js/render.js` | Battle canvas, HUD, battle input, and the menu art (tanks, crates, map thumbnails) |
| `js/fx.js` | Haptics and synthesized sound |
| `js/ui.js` | Menus, sheets, start screen, results, between-round screen |
| `js/main.js` | Boot order and the frame loop |
| `worker/` | Cloudflare Worker: the referee for every database write, Stars invoices, webhook, reminders, leaderboard cron |
| `database.rules.json` | Firebase rules (everything locked except the public leaderboard file) |

Scripts are plain (not modules) and share one global scope, loaded in the order above.

## Before every push

1. `git pull` first. Only one session should push at a time.
2. `dev/bump.sh` stamps a new build id into `index.html` and `version.json`, so phones pick up the update on their next open.
3. Run the tests below.

## Tests

Needs Node, Python 3 and Playwright with Chromium.

```
node dev/tests/wtest/test.mjs          # server: auth, points rules, payments, leaderboard, reminders
python3 dev/tests/b1test.py            # sync with the local server stand-in, referrals, Stars recovery
python3 dev/tests/b2test.py            # menus, first-time flow, start screen, results, sheets
python3 dev/tests/b3test.py            # map objects, crates, events, fast forward, best of 3
python3 dev/tests/b4test.py            # sound, drag-to-aim supers, dash, bot dodges, reminders
python3 dev/tests/regress.py 3         # every mode x map: stuck tanks, errors, points per minute
python3 dev/tests/perf.py              # frame times at 4x CPU slowdown
python3 dev/tests/qa.py                # every screen at 5 sizes: overflow, clipped text, hidden buttons
```

The browser tests start `dev/tests/devserver.mjs`, a local stand-in for the server and database, and mock the Telegram SDK. Screenshots go to `$SHOTS` (default `/tmp/lunar-shots`).

## Ready for PvP and 3D

- Maps are plain data (`MAPS` in `game.js`): boxes with a style, round solids, crates, craters. A server or a 3D renderer can load the same layouts.
- Player input reaches the sim through three calls: `inputVec()` for driving, `useSuper(unit, angle)` and `useDash(unit, dx, dy)`.
- `render.js` is the only file that draws a battle. A 3D renderer can replace `drawBattle()` without touching menus or the sim.
- Random events and bot choices use `Math.random()`. A PvP match needs a shared seed or a server that runs the sim.
