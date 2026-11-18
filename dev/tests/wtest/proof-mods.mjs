// Proof of play with the Session 6B research mods (worker/src/proof.js): Traction Servo's +60% speed is allowed only in the
// samples right after a dash (its 2 s boost), never for a whole match, and Overdrive's two dash charges allow two dash lengths
// back to back. Dashes are charges the dash cooldown gives back (Session 6B review): a dash flag with no charge buys nothing. Synthetic 1v1 records, two tanks, a sample every 0.5 s; the movement check is the one judged here.
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const { checkProof, PROOF } = await import('../../../worker/src/proof.js');
const { LIM } = await import('../../../worker/src/sim.gen.js');
let ok = 0, bad = 0; const t = (c, m) => { if (c) { ok++; console.log('PASS', m); } else { bad++; console.log('FAIL', m); } };
const n = 2, sz = n * 3 + 6;
// moves: per-sample distance of the pilot (map units) and whether that sample is flagged as dashing. The record stores x/10 in a
// byte (0..25.5 units), so the tank runs back and forth along x
function record(moves) {
  const k = moves.length + 1, b = new Uint8Array(k * sz); let x = 2;
  for (let s = 0; s < k; s++) {
    if (s > 0) { const d = moves[s - 1].d; x = x + d <= 24.5 ? x + d : x - d; }
    const o = s * sz, P = n * 3;
    b[o] = Math.round(x * 10); b[o + 1] = 120; b[o + 2] = 100;          // the pilot (x/10, y/7.5, hp%)
    b[o + 3] = 60; b[o + 4] = 120; b[o + 5] = 100;                      // the enemy stands still
    b[o + P] = 160; b[o + P + 1] = 100; b[o + P + 2] = s > 0 && moves[s - 1].dash ? 2 : 0; b[o + P + 3] = 0; b[o + P + 4] = 0; b[o + P + 5] = 1;
  }
  return { v: 1, n, s: btoa(String.fromCharCode(...b)), h: [[0, 0, 100, 4], [1, 0, 100, 0]], f: {} };
}
const base = { g: 'arena', m: '1v1', map: 'classic', secs: 90, won: false, drawn: false, place: 0, series: false, min: 20, spdM: 1, st: { dmg: 0, kills: 0, sup: 0, box: 0, low: 1 } };
const cap = LIM.STAT.speed * PROOF.BUFF * (1 + 0.08 * 2.25) * PROOF.SLACK * PROOF.DT, dashLen = LIM.STAT.speed * LIM.DASH_SPD * LIM.DASH_T;
const moved = (pf, c) => { const r = checkProof(pf, { ...base, ...c }); return r.why !== 'move'; };
const fast = cap * 1.5, walk = cap * 0.9;   // 1.5x the normal per-sample cap: over it without Traction, under it with the boost
// 1. a constant 1.5x pace, never dashing: refused with or without Traction on the ticket
{ const pf = record(Array.from({ length: 12 }, () => ({ d: fast })));
  t(!moved(pf, {}) && !moved(pf, { modSpd: 1.6 }), 'a constant 1.5x pace with no dash fails the movement check, Traction or not'); }
// the check forgives up to PROOF.MOVE_BAD (3) fast samples a record, and the sample right after a dash also gets the dash's
// allowance: each case below repeats its pattern so a wrong allowance shows as 4+ fast samples
const burst = () => [{ d: walk + dashLen * 0.9, dash: true }, ...Array.from({ length: 4 }, () => ({ d: fast })), { d: walk }, { d: walk }];
// 2. real Traction bursts: a dash, then the boost (1.5x) for 2 s, then normal pace; twice in the match
{ const pf = record([{ d: walk }, ...burst(), ...burst()]);
  t(moved(pf, { modSpd: 1.6 }), 'two bursts of dash + 2 s at 1.5x pass with Traction Servo fitted (PROOF.MOVE_BAD ' + PROOF.MOVE_BAD + ')');
  t(!moved(pf, {}), 'the same record fails without Traction (the boost is real speed)'); }
// 3. the boost window ends: a 1.5x pace long after the last dash is refused even with Traction
{ const pf = record([{ d: walk + dashLen * 0.9, dash: true }, ...Array.from({ length: 10 }, () => ({ d: walk })), ...Array.from({ length: 5 }, () => ({ d: fast }))]);
  t(!moved(pf, { modSpd: 1.6 }), 'a 1.5x pace from 5 s after the last dash fails, Traction or not'); }
// 4. Overdrive: two dashes back to back (two dash lengths in one sample) need its second charge. Both charges come back one at a time
// (4 s each), so honest double dashes are about 8 s apart (Session 6B review: the record's dash flag spends charges; the old version
// of this check let four double dashes 1.5 s apart through, now the cheat case below)
{ const dd = (gap) => [{ d: walk + dashLen * 1.8, dash: true }, ...Array.from({ length: gap }, () => ({ d: walk }))];
  const pf = record([{ d: walk }, ...dd(17), ...dd(17), ...dd(17), ...dd(17)]);
  t(moved(pf, { dashN: 2 }) && !moved(pf, {}), 'double dashes 8.5 s apart pass with Overdrive\'s two charges and fail with one');
  const fast2 = record([{ d: walk }, ...dd(2), ...dd(2), ...dd(2), ...dd(2), ...dd(2), ...dd(2)]);
  t(!moved(fast2, { dashN: 2 }), 'six double dashes 1.5 s apart fail even with Overdrive (its charges need 4 s each to come back)'); }
// ---- dash charges (Session 6B review, gameplay 4): the phone writes the dash flag; the record may only claim the dashes a cooldown allows ----
// 5. a phone that sets the dash flag on every sample to move at dash pace all match: refused, with one charge or with Hyperdrive's three
{ const pf = record(Array.from({ length: 16 }, () => ({ d: walk + dashLen * 0.9, dash: true })));
  t(!moved(pf, {}) && !moved(pf, { dashN: 2 }) && !moved(pf, { dashN: 3 }), 'the dash flag on every sample buys at most the charges the record starts with: dash pace all match fails (1, 2 or 3 charges)'); }
// 6. ...and it opens no Traction window: a flag on every sample with Traction's 1.5x pace and no real dash fails
{ const pf = record(Array.from({ length: 16 }, () => ({ d: fast, dash: true })));
  t(!moved(pf, { modSpd: 1.6 }), 'a dash flag with no charge back opens no Traction window (a 1.5x pace on flags alone fails)'); }
// 7. one honest dash every 4 s all match passes; a dash every 2 s (twice the cooldown allows) fails
{ const every = (gap, n) => [{ d: walk }].concat(...Array.from({ length: n }, () => [{ d: walk + dashLen * 0.9, dash: true }, ...Array.from({ length: gap }, () => ({ d: walk }))]));
  t(moved(record(every(7, 10)), {}), 'a dash every 4 s (the cooldown) for 40 s passes');
  t(!moved(record(every(3, 12)), {}), 'a dash every 2 s for 24 s fails (the cooldown gives one back every 4 s)');
  // 8. a shorter cooldown (Light frame: dash cooldown -40%) is the server loadout's own: a dash every 2.5 s passes with it, fails without
  t(moved(record(every(4, 10)), { dashCdM: 0.6 }) && !moved(record(every(4, 10)), {}), 'a dash every 2.5 s passes with the Light frame\'s 2.4 s cooldown (from the server loadout) and fails with the stock 4 s'); }
console.log((bad ? 'FAIL' : 'PASS') + ' wtest proof-mods: ' + ok + ' passed, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
