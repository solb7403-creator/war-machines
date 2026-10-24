# Developer notes

## Files

| File | What's in it |
|---|---|
| `index.html` | Page shell: auto-update check, Telegram SDK, versioned CSS/JS tags |
| `css/app.css` | Every menu style (design tokens at the top) |
| `js/rules.js` | Pure rules shared with the server: combat numbers, gear and tank stat math, modes and their pay, leagues, featured mode, live queues, and the whole economy (`eco*`: points, quests, login streak, pass, crates, upgrades, squad payouts, purchases, refunds, the loadout check) |
| `js/core.js` | Telegram setup, save + cloud save, the phone's side of the economy (`ecoRun`: a server call in Telegram, the rules.js function on the save elsewhere), reveal wording, squad, shop prices |
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
| `worker/src/db.js` | Firebase helpers, HMAC, names |
| `worker/src/eco.js` | The server-owned economy: `eco/<pid>` records changed only through `tx()` (conditional writes), AI match tickets, claims, the live-match credit, the one-time move for existing pilots, anomaly flags |
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
node dev/tests/wtest/test.mjs          # server: auth, every point source, match tickets, claim maximums, crates, gear and power, Stars/TON, refunds, the move, flags, leaderboard, reminders
node dev/tests/wtest/pvp.mjs           # live PvP server: lobby, rooms, claims, supers, drops, quits, rounds, results, credits, loadout checks
node dev/tests/wtest/farm.mjs          # farm defense: forged and scripted results, bot-pattern flags, linked-account clusters, new-account credit, rate limits, admin pin, reminders at scale; a heavy human trips nothing
node dev/tests/wtest/load.mjs 3000 300 # load: a spike of new pilots, a burst of results, the 5-minute cron and reminders at that size (requests, CPU, database calls and bytes)
python3 dev/tests/proofreal.py 3       # proof of play vs real matches: every mode x size x map, driven through the joystick; every record must pass
python3 dev/tests/b1test.py            # sync with the local server stand-in, referrals, Stars recovery
python3 dev/tests/b2test.py            # menus, first-time flow, start screen, results, sheets
python3 dev/tests/b3test.py            # map objects, crates, events, fast forward, best of 3
python3 dev/tests/b4test.py            # sound, drag-to-aim supers, dash, bot dodges, reminders
python3 dev/tests/b6test.py            # salvage ladder, tune-up, Lunar Pass, paints, terms, featured mode, the 3 new modes
python3 dev/tests/b7test.py            # Untouchable, dailies + swaps, weekly quests (multi-day), streak bonus, chest, daily/weekly deals, Founder pack
python3 dev/tests/b8test.py            # the server-owned economy in the browser: claims, forged saves, scored/too-fast/offline AI matches, Stars grants, the one-time move, admin flags
python3 dev/tests/b9test.py            # build budget + reset build (points or paid), ghosts (VS seat, report, owner's sheet), Survival (megatank), Last Standing pay
python3 dev/tests/b10test.py           # the 3D view: every mode x map, draw cost at 4x CPU slowdown, aim/tap on the tilted ground, Graphics setting, Auto step-down, 2D without WebGL or after a lost GPU context, 3D menu pictures
python3 dev/tests/b11test.py           # the Hyperspace Vault: Shop card, server-priced bundles, Stars deposits, levels and unlocks, the Vault board, badges, looks in 3D and 2D
python3 dev/tests/b12test.py           # the match ticket: dropped requests retried, a refusal shows its real reason, no answer still says no connection
python3 dev/tests/b13test.py           # link quests (news channel, X, wiki): right links, visits that survive Telegram switching away, claims
python3 dev/tests/regress.py 3         # every mode x team size x map: stuck tanks, errors, points per minute
python3 dev/tests/perf.py              # frame times at 4x CPU slowdown
python3 dev/tests/qa.py                # every screen at 5 sizes: overflow, clipped text, hidden buttons
python3 dev/tests/pvptest.py           # two browser pages play live: matching, VS labels, moves, supers, drops, rounds, quits, AI fill, results
```

Screenshots for eyeballing the 3D models (not pass/fail): `python3 dev/tests/sheet3d.py` (every weapon, chassis, paint and crate) and `python3 dev/tests/look3d.py` (a battle per map and mode, the menus). `python3 dev/gallery3d.py` re-renders the wiki's gear and map pictures (`img/wiki/`) after a model changes.

## The 3D view

`js/render3d.js` draws the battlefield with Three.js on `#c3`, under the 2D canvas `#c`, which keeps the HUD, health bars, labels, damage numbers, aim lines and buttons. It only reads game state (units, bullets, effects) and the sim events (`ev3D`, called from `onSimEv`); `js/game.js`, `js/rules.js` and the server don't know it exists. The camera is a tilted orthographic view (`TILT` 0.6 rad), so the ground maps to the screen with one vertical squash: `GK` (1 in 2D). `X()`/`Y()` include it, so every 2D overlay, the tap-to-target, the joystick and drag-to-aim line up with the 3D ground. `js/models3d.js` builds every model from simple shapes and merges each into lit, metallic and glowing meshes (a tank is a handful of draw calls); designs per tier live in `chassisKit`, `weaponKit`, `bossKit`, `crateKit`, maps in `buildMap`. Three.js is a slim custom build in `js/vendor/three.lunar.min.js` (r169, MIT), loaded after the game boots; until it's ready, without WebGL, after a lost GPU context, or with Graphics set to 2D, `render.js` draws everything in 2D as before. Graphics (Settings): Auto (default: High, steps down to Low under 40fps, then to 2D under 24fps), High, Low (pixel ratio 1, fewer particles), 2D. Menu pictures are 3D renders on a small second renderer, cached per size (`art3D`); the Play tab's hero tank renders live.

The older browser tests (b1-b7, regress, perf, qa, pvptest) run the economy on the phone (`LUNAR_LOCAL_ECO`), so they test the shared rules and the screens; `open_game(..., eco='server')` runs it the way Telegram players get it (b8test). The browser tests start `dev/tests/devserver.mjs`, a local stand-in for the server and database, and mock the Telegram SDK. It runs the real worker code with local Durable Objects (`wtest/fakedo.mjs`) and a small WebSocket server, so two pages can play each other. Live matches are off in the older tests (`LUNAR_NO_PVP`); `open_game(..., pvp=True)` turns them on. Screenshots go to `$SHOTS` (default `/tmp/lunar-shots`).

## Farm defense

The threat: one person running many Telegram accounts, each scripted to play AI matches under every limit. Nothing here bans anyone: it scores nothing (a result the record doesn't back up) or flags, and flagged pilots sit out the board, the snapshot and squad payouts until Jake clears them in the admin sheet.

- **Proof of play** (`js/proof.js` on the phone, `worker/src/proof.js` on the server). Every AI result carries a record of the match: twice a second, every tank's position and health, your controls and your damage (about 1-11 KB). A full replay can't work across phones (floating point differs and a 3-minute fight drifts), so the server checks the record against the game's own limits: the roster for the mode, the time the ticket allows, no tank faster than possible, your tank never inside a wall, damage dealt with an enemy in reach and matching the health they lost, and the result (a win means the enemies are down, or the clock ran out with your side ahead; a Last Standing place matches who was alive). Stats that feed quests are held to what the record shows. Limits come from `LIM` in `sim.gen.js`, worked out at build time. The default (`flag`) scores every result and counts failed records (3 in a day flag the pilot, held off the airdrop list until cleared), so a real player never loses a match to the check; `cfg/proof` = `enforce` (admin sheet) makes a failed record score nothing. A phone without records (an old version) is told to update. Validated with 192 real bot-driven matches (`proofreal.py`).
- **Bot-pattern flags** (`ECO`, `bpFlags`): `proof` (3 failed records in a day), `noinput` (the tank drove with nobody on the controls in 3 matches), `repeat` (the same first 30 s of controls in 3 matches), `steady` (25 gaps between matches that never vary), `nomenu` (typically under 1.5 s between a match ending and the next starting, measured from when the match really ended, so a late result on a weak connection doesn't count), `steadylen` (25 matches of one mode with lengths that never vary), `clockwork` (the same start and stop minute 6 days of 7, 2+ hours a day).
- **Linked accounts** (`worker/src/farm.js`, links in `lk/`): `device` (the same phone: a random id kept on the device), `wallet` (paid from the same TON or SOL wallet), `replay` (the same controls fingerprint on two accounts), `trade` (8+ live matches against the same account in a day), `together` (starting a session in the same minute on the same network 6+ times over 3+ days; networks with more than 12 starts in a minute are ignored). Every 5 minutes the links become clusters (`clu`); in each, only the account with the most points counts and the others get a `cluster` flag. Jake clears a cluster from the admin sheet (`lkok/`).
- **New-account credit**: airdrop credit (`ac`, mirrored to `players/<pid>/ac`, the snapshot ranks by it) follows lifetime points, at half rate on a brand-new non-Premium Telegram account's first active day, full after 7. "Brand new" = among the newest 3% of the Telegram id range seen (`cfg/maxid`). Points and the board don't change.
- **Rate limits**: 1,200 requests a minute per network address (before any database work), 90 actions a minute per pilot (inside the record), and per-pilot caps on Stars invoices, payment checks, squad, live joins.
- **Admin pin**: the admin username is pinned to the Telegram account that first used it (`cfg/admin`).

## Scale

`load.mjs` with 3,000 new pilots, 300 at once: no errors, no write conflicts, about 10 requests and 23 KB of database downloads per pilot's first session. Writes ask Firebase for no reply body (`print=silent`), ghost picks read 10 rows from a random point in the power band, squad payouts read the small `fh/` index (who's held right now; exact after each 5-minute cron, set at once when a flag is raised), and the public leaderboard file goes through the worker's edge cache (`/lb.json`, 60 s). Reminders: one indexed query finds who's due (`ntf/<pid>/nx`, with last played `pl` and streak `sk` mirrored there), sent 4 at a time; the per-minute cron (15:00-18:59 UTC) sends `NTF_BATCH` (40 on Workers Free, 50 outside calls per run; raise to 200 on Paid), the 5-minute cron does the board and the farm check.

Hosting limits are what break first, not the code: Workers Free is 100,000 requests a day (a new pilot makes ~10 in a first session, a regular ~30-60 a day), and Firebase Spark allows 10 GB of downloads a month. Before a marketing push: Workers Paid ($5/month) and Firebase Blaze (pay as you go), then set `NTF_BATCH = "200"`.

## The economy (server-owned)

Every point and every piece of gear a Telegram pilot has lives in `eco/<pid>` and changes only on the server. The phone says what happened; the server runs the same function from `js/rules.js` on its own copy and sends its record back (`E`), which the phone copies over its save (`applyEco`). Outside Telegram the phone runs those functions on its own save (local play, no leaderboard).

- **Every point has a named source.** AI match (`/api/match/start` gives a signed ticket: mode, team size, map, start time, featured, league from the server's view of your gear; `/api/match/end` scores it), live match (the room credits it), and `/api/act` claims: `login`, `daily`, `weekly`, `chest`, `ms` (milestones), `visit`, `pass`, `squad`, plus spending: `crate`, `salvage`, `tune`, `up`, `respec`, and `paid` (show a Stars purchase). `ms` for `q_tg` asks Telegram (`getChatMember`) whether the pilot joined the channel first; that needs the bot to be a channel admin (the admin sheet says whether it is), and until then the quest pays as before. `/api/sync` credits nothing.
- **Match results.** The server computes the points (mode pay, best of 3, featured, league, AI win streak). It refuses results faster than `ECO.MIN_WIN` (seconds per mode, ~60% of the fastest bot-driven maxed tank), expired tickets (30 min), reused tickets (one open ticket per pilot; a retry gets the stored answer) and more than 40 scored matches per UTC hour. Reported stats are held to what fits in the time. Results that can't reach the server wait in `save.mq` and go in order.
- **Gear and power.** Inventory, rolls, salvage, upgrades, core levels, paints, Moonbeam, the skin and the pass are on the record. `ecoLoadout` turns what the phone has equipped into what the pilot owns (anything else falls back to their best of that line), and power and league come from that: for AI tickets, live joins and sync.
- **Payments.** Stars invoices are priced from the record (repeat buys, deals); the webhook grants the item and stores what it gave with the payment; `refunded_payment` takes exactly that back. TON is matched by order note and amount, SOL by signature and amount, each transaction hash used once (`tonTx/`, `solTx/`), price checked against the record, then granted.
- **Writes.** `tx()` reads `eco/<pid>` with its ETag, changes it, and writes only if nothing else wrote in between (else it retries), so double taps and parallel requests can't double-claim. `players/<pid>` keeps a copy of the fields the leaderboard, squad lists, reminders and admin read.
- **The one-time move.** A pilot who played before this release keeps their lifetime points exactly; the first sync from the new game sends their save once (`mig`). Gear, upgrades and cores are checked against payments on record and what their points could have bought. Anything unexplained is kept and flagged (`flags/<pid>`, reasons `mig_*`).
- **Flags.** AI win rate over 90% across 50+ matches, play in 20+ different hours of one UTC day, 200+ matches a day, over 1,600 points a minute across 30+ minutes, 5 too-fast results, 2 Stars refunds, the one-time move, and `alt` (a recruit on the same hashed network address as their referrer: `iph/`). Flagged pilots are left off the public board and the snapshot until cleared in the admin sheet; their squad payouts wait.

- **Build budget.** `up` levels cost what they always did, but a pilot holds at most `BUILD_MAX` (14) levels across the five stats. `respec` sets every level to 0 and pays back `RESPEC_BACK` (half) of what they cost; the rest is a points sink. Records over 14 (bought before the budget) are trimmed in `ecoNorm`, top levels first, refunded in full. Power and league are recomputed after every `/api/act`.
- **Ghosts.** Every record save writes `gh/<pid>` (name, server loadout, power, last seen) once a pilot has 3+ matches. `/api/match/start` picks up to `ECO.GHOST_MAX` pilots offline 10+ minutes within 25% of your power (`gh` indexed on `pw`) and sends them by seat number only (the ticket keeps the ids); the phone puts them in AI seats (enemies first) as "Ghost of <name>". Live rooms do the same at the first pilot's power. They pay and score like any AI pilot. The ghost's result goes to `ghr/<owner>` (matches, W/D/L, damage, kills); the owner's next launch shows it and the following sync clears it. Owners never get points from ghosts.
- **Survival.** Game type `boss` (AI only): you and AI wingmen against one megatank (`mkBoss`, `bossAI` in game.js), scaled to your tank and team size. Win = destroy it, draw = alive at the horn (`ECO.BOSS_DRAW` 170 s minimum), loss = your side wiped. Pays like Moon Zone.

## Live PvP

- **Rooms.** `POST /api/pvp/join` checks the Telegram login and the loadout, asks the lobby Durable Object for a room (same queue: mode + team size; league band widens from 0 to 2 while a room waits), takes a seat, and returns a signed ticket. The phone opens `wss://…/pvp/ws?r=room&t=ticket` straight into the room Durable Object.
- **The room runs `js/game.js`** (bundled by `worker/build-sim.mjs`) at 30 ticks a second and sends everyone the same snapshot 15 times a second, plus events (shots, hits, kills, pops). Each phone turns it to its own side: your team is 0 at the bottom; team 1 sees the map rotated half a turn (maps are point-symmetric). The snapshot layout is in `worker/sim-api.js` (encoder) and `js/pvp.js` (decoder).
- **Movement.** Your phone drives your tank at once and reports where it is ~10 times a second. The server follows those claims at the tank's real top speed (+30% for jitter) through the same collision code, so claims can't teleport or cross walls. Far-off or blocked claims make the phone resync. Shots, damage, supers, pickups and results are all server-side.
- **Quick Match.** Queue `quick.<team size>` fits any live mode room of that size (`queueFits`); a Quick Match room takes the mode of the first pilot who picked one, or a random live mode (not Last Standing) at the start.
- **Seats.** Live pilots alternate teams so they face each other. After 30 seconds AI pilots fill empty seats; with only one pilot, the phone plays AI locally instead. A pilot who drops gets an AI pilot until they reconnect. Leaving, or staying offline over 20 seconds at the end, is a loss with no points.
- **Points.** The room scores with the same formula as AI matches (`rules.js`: mode pay, best of 3 ×2, featured ×1.25, league from the checked loadout, win streak kept per player as `pvs`) and credits the player's record itself (`eco.js creditMatch`: daily cap, quests, pass XP and stats included) before sending the result. The phone shows it and then copies the server's record.
- **Loadout checks.** Only gear the pilot owns on the server's record, with its recorded roll, upgrade and core levels (`ecoLoadout`).
- **Free plan capacity.** About 93 Durable Object requests per player per match (WebSocket messages count 20 to 1) and ~30 GB-s per match: roughly 400 live matches a day. Past that, joins fail and phones fall back to AI matches.
- **3D.** `render.js` is still the only file that draws a battle. A 3D renderer can replace `drawBattle()` without touching menus, the sim or the netcode.

## Designs on hold

`dev/designs/legendary-weapons.js` keeps three legendary weapon designs for later updates (Lunar Railgun, Eclipse Cannon, and the Eclipse + Railgun + Tide combination), built with the game's model kit, with their super impacts and sound ideas. Renders are in `dev/designs/img/`. The Tide Engine design shipped as the Moonbeam.

## Trailers (dev/trailer)
Promo videos rendered from the real game, never shipped.
- `capture.py RAW [shot ...]` boots the game headless with a virtual clock (`director.js`: scripted camera, staged
  matchups, forced supers, HUD and damage numbers hideable) and saves every frame of each shot in `shots.py` to `RAW/<shot>/`.
  Battles render at 540x960 @2x (the 3D view's native 1080x1920), menus at 360x640 @3x. Super shots run at 1/90 s per frame for 3x slow motion.
- `edit.py RAW OUT [main|short|previews|thumb]` cuts them (`timeline.py`) into 1080x1920 H.264/AAC: titles in Chakra Petch,
  speed ramps, punch-ins, shake, flashes, letterbox, phone-framed menus, and an original soundtrack synthesized in `music.py`.
- `sheet.py RAW shot [step]` makes a numbered contact sheet; use it to retune `HIT` (the frame each super lands) after a recapture.
