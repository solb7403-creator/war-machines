# 01 — Two-machine battle roster (IMPLEMENTED IN FEATURE BRANCH)

Priority: P0. Goal: two free, named, complete owned machine builds; choose the active machine before matchmaking. Active build must remain locked for each entire match, including Arena rounds. The server must ignore legacy mid-match chassis swap messages, while client UI must not offer them. Bot rounds must honor the same commitment. This preserves existing authoritative lab activation, inventory ownership, and proof tickets.

Files: js/battle-roster.js, css/battle-roster.css, js/ui.js, js/match.js, js/game.js, worker/src/pvp.js, index.html, version.json, dedicated regression + PvP test amendments.

Acceptance: A and B display independently on Play; selecting a bay calls the existing server-owned lab_activate; saved identity and stats stay distinct; a third owned chassis cannot appear mid-game; unowned/malicious swap requests are ignored; actual Workers, PvP, economy, Laboratory, frozen proof and all required release tests pass.

Future possible feature: pre-registered full-machine swap *between* best-of-three rounds only, with both builds frozen at match-start on the server, and proof-of-play explicitly recording allowed round transitions. Do not implement partial class-only swaps and do not weaken proof checks.
