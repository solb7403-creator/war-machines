// WEAPON SOUNDS (Session 5E-2b3, owner Nov 14 2026): every weapon shot and every Arcade super (charge, verdict, fire, impact at
// miss / hit / jackpot) is rendered offline in Chromium through the real js/fx.js (LW.render) and measured. It fails if:
//  1. a sound is silent, clips (peak over 0.98 after the master gain) or runs on past its budget,
//  2. the rarity ladder breaks: within a weapon line, rare must have more layers than common and epic more than rare, and the
//     same order must hold for every super at every outcome; Moonbeam must be the richest shot and Moonfall's jackpot the
//     biggest sound of all (most layers, most energy, longest),
//  3. the outcome ladder breaks: for every super a miss is thinner than a hit and a hit thinner than a jackpot (layers and energy),
//  4. rapid fire turns into noise: twelve Twin Repeater rounds at its real cadence stay under the Siege Breaker's single-shot level
//     and leave gaps between rounds (the signal drops at least 12 dB between shots),
//  5. the mix is unbalanced: every shot sits within 9 dB of the Pulse Cannon (phone-speaker loudness), heavy guns louder than
//     light ones, and no shot is louder than a super.
// usage: node dev/tests/weapon-sounds.cjs [--json docs/sounds-5e2b3/levels.json]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..');
const out = (() => { const i = process.argv.indexOf('--json'); return i > 0 ? process.argv[i + 1] : null; })();
let checks = 0; const fails = [];
const ok = (c, m) => { checks++; if (!c) { fails.push(m); console.log('FAIL', m); } };
(async () => {
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium-1243/chrome-linux64/chrome') ? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' : undefined);
  const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const page = await b.newPage();
  page.on('pageerror', e => fails.push('page error: ' + e.message));
  await page.setContent('<!doctype html><html><body><script>window.save={sound:true,haptics:false};window.TG=null;window.SUP_BAR_T=0.667;window.SUP_REL=0.2;</script></body></html>');
  await page.addScriptTag({ content: fs.readFileSync(path.join(repo, 'js', 'fx.js'), 'utf8') });
  const R = await page.evaluate(async () => {
    const SR = 48000;
    // a phone speaker plays little under ~250 Hz: loudness is measured through a 250 Hz high-pass (second order), plus the full band
    async function measure(build, secs) {
      const ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR), m = ctx.createGain(); m.gain.value = 0.5; m.connect(ctx.destination);   // the live master gain
      const info = build(ctx, m) || {};
      const buf = await ctx.startRendering(), L = buf.getChannelData(0), Rr = buf.getChannelData(1), n = L.length;
      let pk = 0, e = 0; const mono = new Float32Array(n);
      for (let i = 0; i < n; i++) { const v = (L[i] + Rr[i]) / 2; mono[i] = v; pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i])); e += L[i] * L[i] + Rr[i] * Rr[i]; }
      // high-pass at 250 Hz (biquad, Q 0.707)
      const w = 2 * Math.PI * 250 / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * 0.7071), b0 = (1 + cs) / 2, b1 = -(1 + cs), b2 = b0, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, hpE = 0, best = 0; const win = Math.floor(SR * 0.05), ring = new Float64Array(n);
      for (let i = 0; i < n; i++) { const x = mono[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; ring[i] = y * y; hpE += y * y; }
      let acc = 0; for (let i = 0; i < n; i++) { acc += ring[i]; if (i >= win) acc -= ring[i - win]; best = Math.max(best, acc / win); }   // the loudest 50 ms through the phone filter
      let last = 0; const thr = pk * 0.01; for (let i = n - 1; i >= 0; i--) if (Math.abs(mono[i]) > thr) { last = i; break; }
      // the envelope in 10 ms blocks (rapid fire gaps)
      const blk = Math.floor(SR * 0.01), env = []; for (let i = 0; i + blk <= n; i += blk) { let s = 0; for (let j = 0; j < blk; j++) s += mono[i + j] * mono[i + j]; env.push(Math.sqrt(s / blk)); }
      const db = v => Math.round(10 * Math.log10(Math.max(1e-12, v)) * 10) / 10;
      // energy in four bands (bass 60-250 Hz, body 250-2,000, bite 2,000-6,000, air 6,000+), second-order filters in series
      const bq = (type, f, x) => { const w = 2 * Math.PI * f / SR, c = Math.cos(w), al = Math.sin(w) / (2 * 0.7071); let b0, b1, b2; if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
        const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al, y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
      const bandE = (lo, hi) => { let y = lo ? bq('hp', lo, mono) : mono; if (hi) y = bq('lp', hi, y); let e2 = 0; for (let i = 0; i < y.length; i++) e2 += y[i] * y[i]; return db(e2 / n * secs); };
      const bands = { bass: bandE(60, 250), body: bandE(250, 2000), bite: bandE(2000, 6000), air: bandE(6000, 0) };
      return { peak: Math.round(pk * 1000) / 1000, energy: db(e / n * secs), phone: db(best), phoneE: db(hpE / n * secs), dur: Math.round(last / SR * 1000) / 1000, layers: info.n || 0, bands, env: info.env ? env : undefined };
    }
    const out = { shots: {}, supers: {}, burst: {} };
    for (const k of LW.KEYS) out.shots[k] = await measure((c, m) => LW.render(c, m, 'shot', k, 1, { bus: 'shot' }), 1.2);
    for (const k of LW.KEYS) {
      out.supers[k] = {};
      for (const oc of [0, 1, 2]) {
        const T = LW.timeline(k, oc), st = {};
        for (const stage of ['charge', 'lock', 'fire', 'impact']) st[stage] = await measure((c, m) => {
          const V = LW.render(c, m, stage, k, oc, { hits: stage === 'impact' ? 1 : 0 }); if (stage === 'charge') LW.play; return V; }, stage === 'charge' ? 1.6 : 2.6);
        // the whole super as the Arcade plays it (the charge cut at the fire)
        st.seq = await measure((c, m) => {
          const ch = LW.render(c, m, 'charge', k, oc, { t0: 0 }), lk = LW.render(c, m, 'lock', k, oc, { t0: T.lock }), fi = LW.render(c, m, 'fire', k, oc, { t0: T.fire }), im = LW.render(c, m, 'impact', k, oc, { t0: T.impact, hits: 1 });
          // the cut: the same 40 ms fade LW uses live
          const p = ch.in.gain; p.setValueAtTime(1, T.fire + 0.01); p.linearRampToValueAtTime(0, T.fire + 0.05); for (const s of ch.srcs) try { s.stop(T.fire + 0.07); } catch (e) {}
          return { n: ch.n + lk.n + fi.n + im.n };
        }, T.impact + 2.4);
        out.supers[k][oc] = st;
      }
    }
    // rapid fire: 12 rounds at each weapon's real cadence (shot interval, rules.js WEAPONS)
    const gap = { pulse0: 0.2, twin0: 0.09, twin2: 0.09, siege0: 0.45, moon: 0.16 };
    for (const [k, dt] of Object.entries(gap)) out.burst[k] = await measure((c, m) => { let n = 0, alt = false; for (let i = 0; i < 12; i++) { alt = !alt; n += LW.render(c, m, 'shot', k, 1, { bus: 'shot', t0: 0.02 + i * dt, alt, jit: 0.96 + (i % 5) * 0.02 }).n; } return { n, env: 1 }; }, 0.02 + 12 * dt + 0.8);
    // the game's other sounds (hits, kills, the old Conquest super), for the balance checks: the legacy synth plays through the
    // page's AC / master, pointed at an offline context for the render
    out.legacy = {};
    for (const n of ['hit', 'crit', 'hurt', 'kill', 'boom', 'die', 'ready', 'super', 'impact', 'jackpot']) out.legacy[n] = await measure((c, m) => { AC = c; master = m; noiseBuf = null; SND[n](); return {}; }, 1.6);
    for (const k of ['pulse0', 'twin0', 'siege0', 'moon']) out.legacy['hit_' + k] = await measure((c, m) => LW.render(c, m, 'hit', k, 1, { bus: 'shot' }), 0.6);
    AC = null; master = null; noiseBuf = null;
    return out;
  });
  await b.close();
  const S = R.shots, U = R.supers, OCN = ['miss', 'hit', 'jackpot'];
  // 1. audible, unclipped, within budget
  for (const [k, m] of Object.entries(S)) { ok(m.peak > 0.02, k + ' shot is audible (peak ' + m.peak + ')'); ok(m.peak < 0.98, k + ' shot does not clip (peak ' + m.peak + ')'); ok(m.dur <= (k.startsWith('twin') ? 0.16 : 0.9), k + ' shot is short enough (' + m.dur + ' s)'); }
  for (const k of Object.keys(U)) for (const oc of [0, 1, 2]) { const s = U[k][oc]; for (const st of ['charge', 'lock', 'fire', 'impact', 'seq']) { ok(s[st].peak > 0.01, k + ' ' + OCN[oc] + ' ' + st + ' is audible'); ok(s[st].peak < 0.98, k + ' ' + OCN[oc] + ' ' + st + ' does not clip (peak ' + s[st].peak + ')'); } ok(s.seq.dur < 4.5, k + ' ' + OCN[oc] + ': the whole super ends within 4.5 s (' + s.seq.dur + ')'); }
  // 2. the rarity ladder
  for (const line of ['pulse', 'twin', 'siege']) for (const [a, z] of [[0, 1], [1, 2]]) {
    ok(S[line + z].layers > S[line + a].layers, line + ': shot ' + z + ' has more layers than ' + a + ' (' + S[line + a].layers + ' -> ' + S[line + z].layers + ')');
    for (const oc of [0, 1, 2]) ok(U[line + z][oc].seq.layers > U[line + a][oc].seq.layers, line + ' super ' + OCN[oc] + ': rarity ' + z + ' has more layers than ' + a + ' (' + U[line + a][oc].seq.layers + ' -> ' + U[line + z][oc].seq.layers + ')');
  }
  // a higher rarity must be heard, not just counted: each step raises at least one band by 1.5 dB and loses no band by more than 1 dB
  const step = (a, z) => { const d = Object.keys(a.bands).map(b => z.bands[b] - a.bands[b]); return { up: Math.max(...d), down: Math.min(...d) }; };
  for (const line of ['pulse', 'twin', 'siege']) for (const [a, z] of [[0, 1], [1, 2]]) {
    const d = step(S[line + a], S[line + z]); ok(d.up >= 1.5 && d.down >= -1, line + ' shot ' + a + ' -> ' + z + ': the added layers are audible (best band +' + d.up.toFixed(1) + ' dB, worst ' + d.down.toFixed(1) + ')');
    for (const oc of [0, 1, 2]) { const e = step(U[line + a][oc].seq, U[line + z][oc].seq); ok(e.up >= 1.5 && e.down >= -1, line + ' super ' + OCN[oc] + ' ' + a + ' -> ' + z + ': the added layers are audible (+' + e.up.toFixed(1) + ' / ' + e.down.toFixed(1) + ' dB)'); }
  }
  ok(Object.keys(S).every(k => k === 'moon' || S.moon.layers >= S[k].layers), 'the Moonbeam is the richest shot (' + S.moon.layers + ' layers)');
  const mj = U.moon[2].seq, all = []; for (const k of Object.keys(U)) for (const oc of [0, 1, 2]) if (!(k === 'moon' && oc === 2)) all.push([k, oc, U[k][oc].seq]);
  ok(all.every(([, , s]) => mj.layers > s.layers), 'Moonfall\'s jackpot has the most layers of any sound (' + mj.layers + ')');
  ok(all.every(([, , s]) => mj.energy >= s.energy - 0.01), 'Moonfall\'s jackpot carries the most energy (' + mj.energy + ' dB; next ' + Math.max(...all.map(x => x[2].energy)) + ')');
  ok(all.every(([, , s]) => mj.dur >= s.dur - 0.05), 'Moonfall\'s jackpot rings the longest (' + mj.dur + ' s)');
  for (const oc of [0, 1, 2]) ok(['pulse2', 'twin2', 'siege2'].every(k => U.moon[oc].seq.layers > U[k][oc].seq.layers), 'Moonfall ' + OCN[oc] + ' has more layers than every epic super at the same outcome');
  // 3. the outcome ladder
  for (const k of Object.keys(U)) for (const [a, z] of [[0, 1], [1, 2]]) {
    ok(U[k][z].seq.layers > U[k][a].seq.layers, k + ': ' + OCN[z] + ' has more layers than ' + OCN[a] + ' (' + U[k][a].seq.layers + ' -> ' + U[k][z].seq.layers + ')');
    ok(U[k][z].fire.energy > U[k][a].fire.energy, k + ': ' + OCN[z] + '\'s fire carries more energy than ' + OCN[a] + '\'s (' + U[k][a].fire.energy + ' -> ' + U[k][z].fire.energy + ' dB)');
  }
  // 4. rapid fire
  const tb = R.burst.twin0, tb2 = R.burst.twin2;
  for (const [nm, B] of [['Twin Repeater', tb], ['Helix Repeater', R.burst.twin2]]) {
    ok(B.peak < 0.98, nm + ': 12 rounds at full cadence do not clip (peak ' + B.peak + ')');
    ok(B.phone <= S.siege0.phone + 0.5, nm + ': a burst stays under a single Siege Breaker shot on a phone speaker (' + B.phone + ' vs ' + S.siege0.phone + ' dB)');
    // between rounds the level falls back: in each 90 ms period the quietest 10 ms block is at least 12 dB under the loudest
    const env = B.env, per = 9; let worst = 99;
    for (let i = 2; i < 11; i++) { const seg = env.slice(2 + i * per, 2 + (i + 1) * per); if (seg.length < per) break; const hi = Math.max(...seg), lo = Math.min(...seg); worst = Math.min(worst, 20 * Math.log10(hi / Math.max(1e-9, lo))); }
    ok(worst >= 12, nm + ': every round stands apart (the level drops ' + worst.toFixed(1) + ' dB between rounds, 12 needed)');
  }
  // 5. the mix
  for (const k of Object.keys(S)) ok(Math.abs(S[k].phone - S.pulse0.phone) <= 9, k + ' sits within 9 dB of the Pulse Cannon on a phone speaker (' + S[k].phone + ' vs ' + S.pulse0.phone + ')');
  ok(S.siege0.phone > S.pulse0.phone && S.siege0.phone > S.twin0.phone, 'the heavy gun (Siege Breaker) is louder than the light ones');
  const minSup = Math.min(...Object.values(U).map(u => u[1].fire.phone));
  ok(Object.values(S).every(m => m.phone < minSup), 'no shot is louder than any super\'s fire (loudest shot ' + Math.max(...Object.values(S).map(m => m.phone)) + ', quietest super fire ' + minSup + ' dB)');
  // the damage cue and the big moments over your own fire
  const L = R.legacy, light = Math.max(S.pulse0.phone, S.twin0.phone, S.moon.phone);
  ok(L.hurt.phone >= S.pulse0.phone - 6, 'taking damage stays audible over your own Pulse fire (hurt ' + L.hurt.phone + ' vs shot ' + S.pulse0.phone + ' dB)');
  ok(L.kill.phone > light && L.die.phone > light, 'a kill and your own destruction are louder than any light shot');
  for (const k of ['pulse0', 'twin0', 'siege0', 'moon']) ok(L['hit_' + k].phone > -54 && L['hit_' + k].phone < S[k].phone, k + ': your hit is audible and quieter than the shot (' + L['hit_' + k].phone + ' dB)');
  if (out) { const strip = o => JSON.parse(JSON.stringify(o, (k, v) => k === 'env' ? undefined : v)); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(strip(R), null, 1)); console.log('wrote', out); }
  // a readable table
  console.log('shot      layers  peak   phone dB  energy dB  dur s');
  for (const [k, m] of Object.entries(S)) console.log(k.padEnd(9), String(m.layers).padStart(6), String(m.peak).padStart(6), String(m.phone).padStart(9), String(m.energy).padStart(10), String(m.dur).padStart(6));
  console.log('super     outcome  layers  seq peak  fire phone dB  seq energy dB  dur s');
  for (const k of Object.keys(U)) for (const oc of [0, 1, 2]) { const s = U[k][oc]; console.log(k.padEnd(9), OCN[oc].padEnd(8), String(s.seq.layers).padStart(6), String(s.seq.peak).padStart(9), String(s.fire.phone).padStart(14), String(s.seq.energy).padStart(14), String(s.seq.dur).padStart(6)); }
  console.log('other sounds (phone dB / peak)', JSON.stringify(Object.fromEntries(Object.entries(R.legacy).map(([k, v]) => [k, v.phone + ' / ' + v.peak]))));
  console.log('burst', JSON.stringify(Object.fromEntries(Object.entries(R.burst).map(([k, v]) => [k, { peak: v.peak, phone: v.phone }]))));
  console.log(fails.length ? 'RESULT FAIL (' + fails.length + ' of ' + checks + ')' : 'RESULT PASS (' + checks + ' checks)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
