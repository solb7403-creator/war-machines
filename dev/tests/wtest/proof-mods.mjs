// Proof of play with the Session 6B research mods (worker/src/proof.js): Traction Servo's +60% speed is allowed only in the
// samples right after a dash (its 2 s boost), never for a whole match, and Overdrive's two dash charges allow two dash lengths
// back to back. Synthetic 1v1 records, two tanks, a sample every 0.5 s; the movement check is the one judged here.
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
// 4. Overdrive: two dashes back to back (two dash lengths in one sample) need its second charge
{ const dd = () => [{ d: walk + dashLen * 1.8, dash: true }, { d: walk }, { d: walk }];
  const pf = record([{ d: walk }, ...dd(), ...dd(), ...dd(), ...dd()]);
  t(moved(pf, { dashN: 2 }) && !moved(pf, {}), 'double dashes pass with Overdrive\'s two charges and fail with one'); }
console.log((bad ? 'FAIL' : 'PASS') + ' wtest proof-mods: ' + ok + ' passed, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
