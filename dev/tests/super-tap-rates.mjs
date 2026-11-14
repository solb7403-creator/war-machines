// TIMING-BAR HIT RATES (Session 5E-2b2b): jackpot / normal / miss rates of the super timing bar at the old sweep (1.0 s) and at
// faster ones, for people of three skill levels and for every league's AI, drawn on the REAL bar (js/rules.js supBar, supJudge).
// A person's timing error is modelled in SECONDS (it does not shrink with the bar): sd = sqrt(0.045^2 + (0.09 T)^2), a fixed
// part (finger and touch-screen jitter) plus a part that follows the marker's speed; T = 1.0 s gives the 0.10 of the sweep that
// Checkpoint 33's tables were measured with. Careful = 0.7x that spread, casual = 1.5x (dev/tests/combat-sim.mjs pilots).
// The AI's spread is a fraction of the sweep (rules.js LG_AI_TAP). Also prints what a frame is worth at each speed.
// usage: node dev/tests/super-tap-rates.mjs [out.json]
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(repo, 'js/rules.js'), 'utf8').replace(/^'use strict';[^\n]*\n/m, ''), cx);
const K = vm.runInContext('({SUP_BAR_T,SUP_ZONE_W,SUP_JACK_W,SUP_TAP_HUMAN,LG_AI_TAP,LEAGUE:LEAGUE.map(l=>l.n),supBar,supJudge})', cx);
export const humanSd = T => Math.sqrt(0.045 * 0.045 + (0.09 * T) * (0.09 * T));   // seconds
const OLD_AI = [0.24, 0.21, 0.18, 0.16, 0.14, 0.13, 0.12];   // LG_AI_TAP before this session (fraction of a 1.0 s sweep)
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
// N taps aimed at the jackpot centre with a normal error of sdFrac (fraction of the sweep). cq: the old bar (zone 36-56%)
export function rates(sdFrac, cq, N = 200000, seed = 12345) {
  const r = rng(seed), c = [0, 0, 0];
  for (let i = 0; i < N; i++) { const b = K.supBar(r, cq), z = Math.sqrt(-2 * Math.log(1 - r() * 0.999999)) * Math.cos(6.283185307 * r()), p = b.jc + sdFrac * z;
    c[p >= 1 || p < 0.05 ? 0 : K.supJudge(b, p, 1)]++; }   // no tap by the end of the sweep is a miss; a tap is never sooner than 5% in
  return c.map(v => +(v / N * 100).toFixed(1));
}
export function table() {
  const speeds = [['old 1.0 s (1x)', 1.0, 1], ['0.8 s (1.25x)', 0.8, 0], ['0.667 s (1.5x)', 0.667, 0], ['0.5 s (2x)', 0.5, 0]], out = { people: {}, ai: {}, frames: {} };
  for (const [name, T, cq] of speeds) {
    const sd = humanSd(T) / T;
    out.people[name] = { 'careful (0.7x)': rates(sd * 0.7, cq), average: rates(sd, cq), 'casual (1.5x)': rates(sd * 1.5, cq), sdMs: Math.round(humanSd(T) * 1000), sdFrac: +sd.toFixed(4) };
    out.frames[name] = { jackpotMs: Math.round(K.SUP_JACK_W * T * 1000), zoneMs: Math.round(K.SUP_ZONE_W * T * 1000), framesInJackpot60: +(K.SUP_JACK_W * T * 60).toFixed(1), framesInJackpot30: +(K.SUP_JACK_W * T * 30).toFixed(1),
      earliestJackpotMs: Math.round((cq ? 0.36 + 0.07 : 0.44 + 0.07) * T * 1000), latestJackpotMs: Math.round((cq ? 0.56 + 0.29 : 0.62 + 0.29) * T * 1000) };
  }
  out.ai.old = Object.fromEntries(K.LEAGUE.map((n, i) => [n, rates(OLD_AI[i], 1)]));
  out.ai.now = Object.fromEntries(K.LEAGUE.map((n, i) => [n, rates(K.LG_AI_TAP[i], 0)]));
  out.now = { SUP_BAR_T: K.SUP_BAR_T, SUP_TAP_HUMAN: K.SUP_TAP_HUMAN, LG_AI_TAP: K.LG_AI_TAP };
  return out;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const T = table(), f = a => a.map(v => (v.toFixed(1) + '%').padStart(7)).join(' ');
  console.log('PEOPLE: miss / normal / jackpot (model: timing error sd = sqrt(45ms^2 + (0.09 T)^2))');
  for (const s in T.people) { const p = T.people[s], fr = T.frames[s];
    console.log(s.padEnd(16), 'careful', f(p['careful (0.7x)']), ' average', f(p.average), ' casual', f(p['casual (1.5x)']), '  sd', p.sdMs + ' ms', ' jackpot window', fr.jackpotMs + ' ms =', fr.framesInJackpot60, 'frames at 60 fps,', fr.framesInJackpot30, 'at 30 fps; jackpot comes', fr.earliestJackpotMs + '-' + fr.latestJackpotMs, 'ms after the press'); }
  console.log('AI PILOTS by league: miss / normal / jackpot   (old bar and spread -> this build)');
  for (const n in T.ai.old) console.log(n.padEnd(14), f(T.ai.old[n]), ' ->', f(T.ai.now[n]));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(T, null, 1));
}
