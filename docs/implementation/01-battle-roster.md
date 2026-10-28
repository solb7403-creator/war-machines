# 01 — Two-machine battle roster (IMPLEMENTED IN FEATURE BRANCH)

Priority: P0. Goal: two free, named, complete owned machine builds; choose the active machine before matchmaking. Active build must remain locked for each entire match, including Arena rounds. The server must ignore legacy mid-match chassis swap messages, while client UI must not offer them. Bot rounds must honor the same commitment. This preserves existing authoritative lab activation, inventory ownership, and proof tickets.

Files: js/battle-roster.js, css/battle-roster.css, js/ui.js, js/match.js, js/game.js, worker/src/pvp.js, index.html, version.json, dedicated regression + PvP test amendments.

Acceptance: A and B display independently on Play; selecting a bay calls the existing server-owned lab_activate; saved identity and stats stay distinct; a third owned chassis cannot appear mid-game; unowned/malicious swap requests are ignored; actual Workers, PvP, economy, Laboratory, frozen proof and all required release tests pass.

Future possible feature: pre-registered full-machine swap *between* best-of-three rounds only, with both builds frozen at match-start on the server, and proof-of-play explicitly recording allowed round transitions. Do not implement partial class-only swaps and do not weaken proof checks.

## Operations plan — Release 01
**State:** Implemented on PR #5; verify and deploy, don't rebuild. **Dependencies:** authoritative Laboratory and Workers releases already on main.

- [ ] **01.1 Pre-merge review:** check PR #5 diff against `main`; confirm no changes to prices, points, wallets, rewards or token distribution. Check the three CI suites on the *final* head SHA, not an earlier commit. Document last good main SHA.
- [ ] **01.2 Player flow:** on Play, both named machines appear side-by-side with exact equipped weapon/chassis/Power; 'Deploy this machine' invokes `lab_activate` (not a client-only switch). Test rapid selection/fight and rejection on stale revision, unsaved changes, network failure; disable Fight/Quick while activation is pending.
- [ ] **01.3 Server contract:** `js/match.js` snapshots the selected full build, `worker/src/eco.js` freezes one legal machine in AI proof ticket, `worker/src/pvp.js` freezes one legal PvP seat, and old arbitrary chassis-switch messages are ignored. Verify no third chassis, core, fitting or appearance can be injected during matchmaking, disconnect/rejoin or round transition.
- [ ] **01.4 Competitive and player UX:** verify match selection is understandable, 320/390/430px touch targets, fallback without Telegram remains non-authoritative, practice modes and both Garage cards behave. Document rule: **v1 locks one entire machine for the entire match, even Arena rounds.** A future two-*registered*-machine between-round swap needs an independent server/proof design and product decision.
- [ ] **01.5 Automated release:** run `node dev/tests/battle-roster.mjs`, `node dev/tests/lab-ui.mjs`, `node dev/tests/wtest/lab.mjs`, `node dev/tests/wtest/lab-battle.mjs`, `node dev/tests/wtest/pvp.mjs`, `node dev/tests/wtest/test.mjs`, `node dev/tests/wtest/farm.mjs`; run Workers smoke and existing equipment CI. No CI bypass or weakening anti-farm tests.
- [ ] **01.6 Deploy:** once all checks are green and owner approves integration, merge PR #5, verify Pages and Cloudflare Workers Actions, client build cache update, /pvp/health and actual isolated browser flow. Roll back both frontend/server together if contract mismatch.
- [ ] **01.7 Exit gate:** two configurations persist, chosen machine truly fights, invalid swaps fail, rewards/proofs intact, production health verified. Record merge SHA/version here, then open Wave 02.

**Definition of done:** authoritative two-machine selection works in deployed Telegram Mini App, and guests cannot gain ranked rewards without verified identity. **Known limit:** no verified real-human iPhone/Telegram match until explicitly tested.
