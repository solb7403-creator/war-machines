# Referrals + squads (launch rules)

## Rules as built
1. **One level.** Only direct recruits pay; their recruits never do. Referral points (`rfe`) never feed anyone's 5%.
2. **Attribution** is server-side, at the pilot's first server day, inside the record's conditional write (concurrent first syncs agree), then immutable. Sources: signed Telegram `start_param` (`ref_<telegram id>` or `ri_<invite code>`) or a server-issued website invite code (`?i=<code>`, kept 14 days in the browser so it survives Safari redirects and closing). A pilot id in the request body is ignored. Linked Telegram + passkey = one canonical pilot (no self-alias). Old pilots, self-referral and unknown codes fail.
3. **Verified match days** (`vd`): a day counts once, only when the server settles a real match (scored AI ticket or live room).
4. **Milestones** (recruit verified days + play points): 2 d + 1,500 → +500; 5 d + 5,000 → +2,000; 10 d + 20,000 → +5,000. Recruit gets +1,000 once at 2 verified days. **5% share** of the recruit's play points, max 2,000/day, rest carries over. Milestones that don't fit today's room pay in parts (no recruit can block another).
5. **Launch multiplier** (milestones + 5% only): ×3 until 10,000 active pilots, ×2 until 25,000, ×1.5 until 50,000, then ×1. Active pilot = 2+ verified days, counted once in `meta/ap` (no scans). The cron moves `cfg/rph` forward only. The multiplier is pinned on the recruit's record when each point (`rb`) or milestone (`rms`) is earned. Caps unchanged.
6. **Verified active recruit:** 5+ verified days, latest within 7 days, not held.
7. **Match bonus** per verified active recruit: #1–10 +3%, #11–50 +1%, #51–100 +0.5%, plus +1% per 5 (max +15%), total max +100%. Server config `cfg/refb` (default ON per the simulator). Never phase-multiplied; counts as referral points; the 20,000/day cap stays.
8. **Anti-farm:** recruit on the referrer's device or network → both **held** with a reason (raised once per pair, `rfx/<pid>`), not banned. Held rows show the reason in the Squad screen; only the admin can clear (existing flags). Payer clusters: not built (no live payment rails yet).

## Simulator (`node dev/tests/wtest/referral-sim.mjs`, 8 seeds, days 15–44)
Referrer plays ~4,500 match points/day. Honest recruits: 55% stay, play 60% of days, ~2,400/day. Farm alts: all stay, minimum play 5 days/week.

| type | active pilots | phase | recruits | own play/day | match bonus/day | 5% share/day | milestones/day | total/day | pool score/day | days at 20k cap |
|---|---|---|---|---|---|---|---|---|---|---|
| honest | 9,999 | ×3 | 0 | 4,500 | 0 | 0 | 0 | 4,500 | 4,500 | 0% |
| honest | 9,999 | ×3 | 1 | 4,500 | 88 | 132 | 125 | 4,845 | 4,526 | 1% |
| honest | 9,999 | ×3 | 10 | 4,500 | 757 | 1,163 | 1,666 | 8,086 | 4,769 | 11% |
| honest | 9,999 | ×3 | 25 | 4,500 | 1,648 | 1,826 | 6,104 | 14,078 | 5,219 | 48% |
| honest | 9,999 | ×3 | 50 | 4,500 | 2,342 | 1,858 | 11,300 | 20,000 | 5,663 | 100% |
| honest | 9,999 | ×3 | 100 | 4,500 | 3,725 | 1,794 | 9,981 | 20,000 | 5,663 | 100% |
| honest | 9,999 | ×3 | 200 | 4,500 | 4,500 | 1,823 | 9,177 | 20,000 | 5,663 | 100% |
| honest | 50,000 | ×1 | 0 | 4,500 | 0 | 0 | 0 | 4,500 | 4,500 | 0% |
| honest | 50,000 | ×1 | 1 | 4,500 | 88 | 44 | 42 | 4,673 | 4,513 | 0% |
| honest | 50,000 | ×1 | 10 | 4,500 | 757 | 371 | 479 | 6,107 | 4,621 | 0% |
| honest | 50,000 | ×1 | 25 | 4,500 | 1,648 | 1,027 | 1,504 | 8,679 | 4,814 | 5% |
| honest | 50,000 | ×1 | 50 | 4,500 | 2,342 | 1,847 | 3,210 | 11,899 | 5,055 | 24% |
| honest | 50,000 | ×1 | 100 | 4,500 | 3,725 | 1,882 | 8,889 | 18,995 | 5,588 | 88% |
| honest | 50,000 | ×1 | 200 | 4,500 | 4,500 | 1,872 | 9,128 | 20,000 | 5,663 | 100% |
| farm | 9,999 | ×3 | 0 | 4,500 | 0 | 0 | 0 | 4,500 | 4,500 | 0% |
| farm | 9,999 | ×3 | 1 | 4,500 | 140 | 108 | 500 | 5,248 | 4,556 | 0% |
| farm | 9,999 | ×3 | 10 | 4,500 | 1,440 | 1,121 | 5,000 | 12,061 | 5,067 | 35% |
| farm | 9,999 | ×3 | 25 | 4,500 | 2,250 | 1,573 | 9,875 | 18,198 | 5,528 | 82% |
| farm | 9,999 | ×3 | 50 | 4,500 | 3,599 | 1,541 | 10,360 | 20,000 | 5,663 | 100% |
| farm | 9,999 | ×3 | 100 | 4,500 | 4,500 | 1,496 | 9,504 | 20,000 | 5,663 | 100% |
| farm | 9,999 | ×3 | 200 | 4,500 | 4,500 | 1,488 | 9,512 | 20,000 | 5,663 | 100% |
| farm | 50,000 | ×1 | 0 | 4,500 | 0 | 0 | 0 | 4,500 | 4,500 | 0% |
| farm | 50,000 | ×1 | 1 | 4,500 | 140 | 36 | 167 | 4,843 | 4,526 | 0% |
| farm | 50,000 | ×1 | 10 | 4,500 | 1,440 | 374 | 1,667 | 7,980 | 4,761 | 2% |
| farm | 50,000 | ×1 | 25 | 4,500 | 2,250 | 943 | 4,167 | 11,859 | 5,052 | 23% |
| farm | 50,000 | ×1 | 50 | 4,500 | 3,599 | 1,593 | 8,042 | 17,733 | 5,493 | 75% |
| farm | 50,000 | ×1 | 100 | 4,500 | 4,500 | 1,552 | 9,448 | 20,000 | 5,663 | 100% |
| farm | 50,000 | ×1 | 200 | 4,500 | 4,500 | 1,534 | 9,466 | 20,000 | 5,663 | 100% |

**Verdict: match bonus ON.** Its largest marginal effect is +7.5% on the points-pool score (honest, 100 recruits); nothing ever exceeds the 20,000 cap. The highest pool score from referrals is 1.26× a non-inviter's, because referral points count at 7.5%.

**One recommended change:** squad payouts share the 20,000 daily cap with matches, so inviters with 50+ recruits reach the cap every day from referral points (counted at 7.5%), crowding out their own play points (counted 100%), and get ~4.4× a normal player's spendable points. Give referral payouts their own cap (suggest 10,000/day) instead of sharing the match cap.
