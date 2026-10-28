# 06 — Social play and organic growth

Priority: P1. Build repeat participation based on friends and rivalry, not only airdrop farming.

Implementation: simple Telegram-shareable machine profiles, invite-to-challenge, private practice lobby with friends, squads/parties for supported 2v2 and 3v3, rival rematches, weekly skill challenges, rotating featured mode and social season recaps. Preserve Quick Match queue liquidity: do not create six fragmented live queues at launch. Give achievements and cosmetics rather than paid battle advantages or unlimited farm points for social spam. Rate-limit invites, blocked players, referral abuse and bot accounts; provide privacy and opt-out controls.

Acceptance: invite, accept, reconnect and leave flow tested; a friend can join the same party; no duplicated match rewards; invite links cannot spoof identity; retries idempotent; social engagement and player return measurable; gameplay continues when no friends online.

## Operations plan — Release 06
**Depends on:** 02 share-safe machine profiles and stable 01 queue mechanics. Web identity integration for cross-platform parties depends on 03.

- [ ] **06.1 Social MVP order:** (a) shareable machine profile/legacy card; (b) friend challenge invite for 1v1 practice; (c) rematch with consent; (d) private room spectator option; (e) parties for currently supported team modes. Ship separately rather than all at once.
- [ ] **06.2 Invite contract:** server-minted short-lived, single-use or bounded-use invite tokens; authenticated sender/acceptor; explicit public/private permissions; expiration; cancel and block controls. Never put player auth data in a share link.
- [ ] **06.3 Match room implementation:** reuse existing Durable Objects and combat authority; respect server-owned frozen machine builds. Distinguish **unranked private challenge** from legitimate rewarded ranked queue so friends cannot farm each other for token allocation.
- [ ] **06.4 Parties:** add friends-join-in-same-team flow using supported 2v2/3v3 only; keep Quick Match robust when few people online. Do not create a permanent queue per mode/machine bracket.
- [ ] **06.5 Meaningful community loops:** rivals, voluntary rematches, weekly skill events, season recaps and achievements that inspire sharing but do not award uncapped referral/quest points.
- [ ] **06.6 Moderation and accessibility:** invite throttles, block/report/mute where relevant, opt-out from public machine profile, acceptable Telegram chat/link behavior and touch-first accessibility.
- [ ] **06.7 Test:** cross-device accept/reject, reconnect, expired/duplicate invite, team alignment, queued user leaving, malicious room ID, private/reward separation, replay, friend-vs-friend anti-farming and no-owner account reads.
- [ ] **06.8 Evaluate:** compare shares → opens → first valid match → D1/D7; adoption and queue-wait telemetry. Expand parties only if real participation supports it.

**Definition of done:** a pilot can show off a machine, challenge a friend and return to play without sacrificing competitive fairness or matchmaking density.
