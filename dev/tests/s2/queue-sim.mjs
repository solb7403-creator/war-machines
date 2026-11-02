// Live matchmaking simulation (item 5): the real lobby (worker/src/pvp.js LobbyCore) on a fake clock with a mixed
// population (starter to full Legendary, varied form). Rooms start when full, else at the 30 s wait with AI pilots in the
// empty seats (one human alone plays the AI). Reports the gear-predicted win chance of formed live matches, waits and AI fill.
// usage: node dev/tests/s2/queue-sim.mjs
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const { LobbyCore, roomOdds, MM_CAP } = await import('../../../worker/src/pvp.js');
const { RULES: R } = await import('../../../worker/src/sim.gen.js');
const rng = R.rng32(2027);
// power mix (new powerOf): 30% starter-common, 30% rare, 20% Epic, 12% maxed free-to-play, 8% Legendary kits
const BANDS = [[0.30, 68, 82], [0.30, 95, 125], [0.20, 135, 175], [0.12, 175, 213], [0.08, 195, 222]];
const draw = () => { let x = rng(); for (const [p, lo, hi] of BANDS) { if (x < p) return lo + rng() * (hi - lo); x -= p; } return 100; };
function run(q, seats, perMin, minutes = 240) {
  let now = 0; const lb = new LobbyCore(() => now, 30000), born = new Map(), done = new Set(), odds = [], waits = [], fill = [0, 0];
  const solo = q.startsWith('royale'); let nextArr = 0, k = 0;
  const close = (r) => { if (done.has(r.id)) return; done.add(r.id); lb.close(r.id);
    for (const pid of r.pids) waits.push((now - born.get(pid)) / 1000);
    fill[0] += r.seats - r.pids.length; fill[1] += r.seats;
    if (r.pids.length >= 2) odds.push(roomOdds(R, r.pw.slice(0, -1), r.seats, solo, r.pw[r.pw.length - 1])); };
  for (now = 0; now < minutes * 60000; now += 250) {
    while (nextArr <= now) { const pid = 'p' + k++; born.set(pid, now); lb.assign({ q, league: 0, power: draw(), pid, seats }); nextArr += -Math.log(1 - rng()) * 60000 / perMin; }
    for (const r of lb.rooms) if (!done.has(r.id) && (r.pids.length === r.seats || now - r.t0 >= 30000)) close(r);
    lb.rooms = lb.rooms.filter((r) => !done.has(r.id));
  }
  odds.sort((a, b) => a - b); waits.sort((a, b) => a - b);
  const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null;
  return { q, perMin, live: odds.length, over: odds.filter((x) => x > MM_CAP + 1e-9).length, p50: pct(odds, 0.5), p90: pct(odds, 0.9), max: odds[odds.length - 1] || null,
    under60: odds.filter((x) => x <= 0.6).length / Math.max(1, odds.length), waitMed: pct(waits, 0.5), wait90: pct(waits, 0.9), aiFill: fill[0] / Math.max(1, fill[1]) };
}
const rows = [];
for (const [q, seats] of [['arena.1v1', 2], ['arena.2v2', 4], ['arena.3v3', 6], ['royale.solo', 6]]) for (const perMin of [2, 10, 60]) rows.push(run(q, seats, perMin));
console.log('queue        arrivals/min  live matches  >80%  median  p90   max   <=60%   wait median  wait p90  AI-filled seats');
for (const r of rows) console.log(r.q.padEnd(12), String(r.perMin).padStart(6), String(r.live).padStart(13), String(r.over).padStart(5), (r.p50 ? (r.p50 * 100).toFixed(0) + '%' : '-').padStart(7), (r.p90 ? (r.p90 * 100).toFixed(0) + '%' : '-').padStart(5), (r.max ? (r.max * 100).toFixed(0) + '%' : '-').padStart(5), ((r.under60 * 100).toFixed(0) + '%').padStart(7), (r.waitMed.toFixed(1) + ' s').padStart(12), (r.wait90.toFixed(1) + ' s').padStart(9), ((r.aiFill * 100).toFixed(0) + '%').padStart(10));
if (rows.some((r) => r.over)) { console.log('FAIL: a formed live match above the mismatch cap'); process.exitCode = 1; } else console.log('PASS: no formed live match above', MM_CAP * 100 + '%');
