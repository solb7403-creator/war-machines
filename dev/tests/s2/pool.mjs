// Parallel runner for the Session 2 measurements: fans jobs out over worker threads, each running the REAL sim.
// kind 'duel': the server sim (worker/src/sim.gen.js = js/rules.js + js/game.js), two bot pilots, any team size.
// kind 'ai': the phone's AI match (combat-sim.mjs makeWorld: rules.js + game.js + match.js), the player flown by botAI.
// opt.patch (optional JS run after rules.js/game.js in every world) lets a calibration sweep try constants without editing files.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const self = fileURLToPath(import.meta.url);
export async function runJobs(jobs, opt = {}) {
  const n = Math.min(opt.threads || os.cpus().length, Math.max(1, jobs.length));
  const out = new Array(jobs.length); let next = 0, done = 0;
  await new Promise((resolve, reject) => {
    if (!jobs.length) return resolve();
    for (let w = 0; w < n; w++) {
      const wk = new Worker(self, { workerData: { patch: opt.patch || '' } });
      const feed = () => { if (next < jobs.length) { const i = next++; wk.postMessage({ i, job: jobs[i] }); } else wk.terminate(); };
      wk.on('message', (m) => { if (m.err) { reject(new Error(m.err)); return; } out[m.i] = m.r; done++; if (done === jobs.length) resolve(); feed(); });
      wk.on('error', reject);
      feed();
    }
  });
  return out;
}
if (!isMainThread) {
  const { buildSim } = await import('../../../worker/build-sim.mjs');
  const fs = await import('node:fs'), path = await import('node:path'), vm = await import('node:vm');
  const patch = workerData.patch || '';
  // duel world: rebuild a private sim module with the patch inside createSim
  const tmp = path.join(os.tmpdir(), 's2sim-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.mjs');
  buildSim(tmp);
  if (patch) { let s = fs.readFileSync(tmp, 'utf8'); s = s.replace('// ===== worker/sim-api.js =====', patch + '\n// ===== worker/sim-api.js ====='); fs.writeFileSync(tmp, s); }
  const { createSim } = await import(tmp); fs.unlinkSync(tmp);
  let aiW = null;
  const getAI = async () => { if (!aiW) { const { makeWorld } = await import('../combat-sim.mjs'); aiW = makeWorld(); if (patch) aiW.eval(patch); } return aiW; };
  function duel(j) {
    const evs = []; const sim = createSim({ seed: j.seed, ev: (a) => evs.push(a), end() {}, round() {}, death() {} });
    j.m = j.m || '1v1'; const n = j.m === '1v1' ? 1 : j.m === '2v2' ? 2 : 3;
    const A = Array.isArray(j.A) ? j.A : [j.A], B = Array.isArray(j.B) ? j.B : [j.B];
    let seats = []; for (let i = 0; i < n; i++) seats.push({ pid: 'a' + i, name: 'A' + i, L: A[i % A.length] });
    for (let i = 0; i < n; i++) seats.push({ pid: 'b' + i, name: 'B' + i, L: B[i % B.length] });
    if (j.flip) seats = seats.slice(n).concat(seats.slice(0, n));
    sim.setup({ g: j.g || 'arena', m: j.m || '1v1', map: j.map || 'classic', series: false, seats });
    sim.start(); sim.units.forEach((u) => sim.setCtl(u, 'bot'));
    let steps = 0; const DT = 1 / 60, st = { shots: 0, hits: 0, sups: 0, supDmg: 0, dash: 0, shield: 0, range: 0, moved: 0, alive: 0 };
    const myIdx = j.flip ? n : 0;
    let wasD = false, wasS = false, px = null, py = null;
    while (sim.state === 'play' && steps++ < 12000) {
      sim.step(DT);
      { const u = sim.units[myIdx]; if (u.hp > 0) { const isD = !!u.dash, isS = (u.shieldT || 0) > 0; if (isD && !wasD) st.dash++; if (isS && !wasS) st.shield++; wasD = isD; wasS = isS;
        let bd = 1e9; for (const v of sim.units) if (v.team !== u.team && v.hp > 0) bd = Math.min(bd, Math.hypot(v.x - u.x, v.y - u.y)); if (bd < 1e9) { st.range += bd; st.alive++; }
        if (px !== null) st.moved += Math.hypot(u.x - px, u.y - py); px = u.x; py = u.y; } }
      for (const e of evs) { if (e[0] === 'b' && e[2] === myIdx) st.shots++; if (e[0] === 'h' && e[6] === myIdx) { if (e[3] === 0) st.hits++; else st.supDmg += e[2]; } if (e[0] === 'u' && e[1] === myIdx) st.sups++; }
      evs.length = 0;
    }
    const u = sim.units[myIdx], o = sim.outcome(u), s = u.st || {};
    st.range = st.alive ? +(st.range / st.alive).toFixed(2) : 0; st.moved = +(st.moved / Math.max(1, steps * DT)).toFixed(2);
    return { out: o.won ? 1 : o.drawn ? 0.5 : 0, secs: +(steps * DT).toFixed(1), dmg: Math.round(s.dmg || 0), taken: Math.round(s.taken || 0), hp: Math.max(0, Math.round(u.hp)) / u.mhp, ...st };
  }
  parentPort.on('message', async ({ i, job }) => {
    try {
      let r;
      if (job.kind === 'ai') { const W = await getAI(); const x = W.run(job.cfg); r = { out: x.out === 'win' ? 1 : x.out === 'draw' ? 0.5 : 0, place: x.place, secs: x.secs, dmg: x.dmg, taken: x.taken, allyDmg: x.allyDmg, teamDmg: x.teamDmg }; }
      else r = duel(job);
      parentPort.postMessage({ i, r });
    } catch (e) { parentPort.postMessage({ i, err: String(e && e.stack || e) }); }
  });
}
