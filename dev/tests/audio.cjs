// AUDIO (Session 6B, owner decision 7): code-made sound only (js/fx.js Web Audio). It fails if:
//  1. anything but js/fx.js makes an AudioContext, the page makes one before the first input, or later sounds make a second one,
//  2. the first input does not start (resume) the context, or a hidden page is not silent (suspended on visibilitychange and pagehide,
//     back on show),
//  3. the Settings volume is wrong: default = the mix as it shipped (master 0.5), a squared curve (50% -> 0.125), 0 = silent, kept in
//     the save and in the web preferences; the slider sits next to the Sound toggle; Sound off still mutes everything,
//  4. the Conquest zone beds are wrong: barren (near-silence, the suit's hum, far impacts) quieter than terraformed (wind in the grass,
//     water, settler life, machinery) quieter than the colony core (activity); each is audible and far under a weapon shot; the zone
//     under the tank picks the bed (ConquestWorld.soundZone) with a 2.5 s hold so an edge never flickers,
//  5. a reward sound or stinger is missing or unwired: bank, build complete, research complete, plate mounted, War Order claimed;
//     raid, invasion, strike and victory stingers,
//  6. any storm or rain sound exists (weather is roadmap row 6B-V).
// usage: node dev/tests/audio.cjs
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..', '..');
let checks = 0; const fails = [];
const ok = (c, m) => { checks++; if (!c) { fails.push(m); console.log('FAIL', m); } else console.log('PASS', m); };
const read = f => fs.readFileSync(path.join(repo, f), 'utf8');
const walk = d => fs.readdirSync(path.join(repo, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'vendor' || e.name === 'assets' ? [] : walk(d + '/' + e.name)) : /\.js$/.test(e.name) ? [d + '/' + e.name] : []);
(async () => {
  // ---- 1. one AudioContext, made only by js/fx.js ----
  const makers = [...walk('js'), ...walk('web')].filter(f => /new\s+(window\.)?(webkit)?AudioContext\b|new\s+C\(\)/.test(read(f)) && /AudioContext/.test(read(f)));
  ok(makers.length === 1 && makers[0] === 'js/fx.js', 'only js/fx.js makes an AudioContext (' + makers.join(', ') + ')');
  const exe = process.env.CHROMIUM_PATH;
  const b = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'], ...(exe ? { executablePath: exe } : {}) });
  const page = await b.newPage();
  page.on('pageerror', e => fails.push('page error: ' + e.message));
  await page.setContent('<!doctype html><html><body><script>window.save={sound:true,haptics:false};window.TG=null;window.__made=0;{const C=window.AudioContext;window.AudioContext=class extends C{constructor(...a){super(...a);window.__made++;}};}</script></body></html>');
  await page.addScriptTag({ content: read('js/fx.js') });
  const r1 = await page.evaluate(async () => {
    const before = window.__made, acBefore = AC === null;
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const after = window.__made, state = AC && AC.state;
    for (const k of ['bank', 'built', 'plate', 'order', 'rsDone', 'stRaid', 'stVictory']) sfx(k);
    ambience('cq-core'); ambience('cq-barren'); fx('sting', 'strike');
    await new Promise(r => setTimeout(r, 100));
    return { before, acBefore, after, state, made: window.__made };
  });
  ok(r1.before === 0 && r1.acBefore, 'no AudioContext before the first input');
  ok(r1.after === 1 && r1.state === 'running', 'the first input makes and starts the one context (' + r1.state + ')');
  ok(r1.made === 1, 'sounds, stingers and ambience beds all play through that one context (' + r1.made + ' made)');
  // ---- 2. a hidden page is silent ----
  const r2 = await page.evaluate(async () => {
    let hidden = true; Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 150)); const a = AC.state;
    hidden = false; document.dispatchEvent(new Event('visibilitychange')); await new Promise(r => setTimeout(r, 150)); const bk = AC.state;
    window.dispatchEvent(new Event('pagehide')); await new Promise(r => setTimeout(r, 150)); const c = AC.state;
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); await new Promise(r => setTimeout(r, 150));
    return { a, bk, c, d: AC.state };
  });
  ok(r2.a === 'suspended' && r2.bk === 'running', 'hidden page: suspended, shown again: running (' + r2.a + ' / ' + r2.bk + ')');
  ok(r2.c === 'suspended' && r2.d === 'running', 'pagehide suspends too; the next tap brings it back (' + r2.c + ' / ' + r2.d + ')');
  // ---- 3. volume ----
  const r3 = await page.evaluate(async () => {
    const g = () => Math.round(master.gain.value * 1000) / 1000, wait = () => new Promise(r => setTimeout(r, 400));
    const d0 = g(); setVolume(0.5); await wait(); const h = g(), sv = save.vol; setVolume(0); await wait(); const z = g(); setVolume(1); await wait(); const f = g();
    save.sound = false; const n0 = AC.createOscillator; let made = 0; AC.createOscillator = function () { made++; return n0.call(this); }; sfx('bank'); fx('sting', 'victory'); ambience('cq-core'); const amb = AMB;
    save.sound = true; AC.createOscillator = n0;
    return { d0, h, sv, z, f, made, amb: amb && amb.id };
  });
  ok(r3.d0 === 0.5 && r3.f === 0.5, 'default volume keeps the shipped mix (master 0.5)');
  ok(Math.abs(r3.h - 0.125) < 0.01 && r3.sv === 0.5, 'volume 50% = master 0.125 (squared curve), saved as save.vol 0.5');
  ok(r3.z < 0.002, 'volume 0 is silent');
  ok(r3.made === 0 && !r3.amb, 'Sound off still mutes every sound, stinger and bed');
  const ui = read('js/ui.js'), core = read('js/core.js'), i0 = ui.indexOf('data-act="sound"'), i1 = ui.indexOf('id="vol-r"'), i2 = ui.indexOf('data-act="haptics"');
  ok(i0 > 0 && i1 > i0 && i1 < i2 && /type="range"[^>]*min="0" max="100"/.test(ui), 'Settings: the volume slider is right after the Sound toggle');
  ok(/addEventListener\('input',e=>\{if\(e\.target&&e\.target\.id==='vol-r'\)\{setVolume/.test(ui) && /id==='vol-r'\)\{setVolume\(e\.target\.value\/100\);store\(\)/.test(ui), 'the slider sets the volume live and saves on release');
  ok(/\['gfx','sound','vol',/.test(core), 'the website keeps the volume with the other preferences');
  // ---- 4. the Conquest zone beds ----
  const beds = await page.evaluate(async () => {
    const SR = 48000, out = {};
    const meas = async (fn, secs) => {
      const ctx = new OfflineAudioContext(1, SR * secs, SR), m = ctx.createGain(); m.gain.value = 0.5; m.connect(ctx.destination);
      const AC0 = AC, M0 = master, A0 = AMB; AC = ctx; master = m; AMB = null; Object.defineProperty(ctx, 'state', { get: () => 'running' });
      try { fn(); } finally { const a = AMB; AC = AC0; master = M0; AMB = A0; if (a) for (const t of a.timers) clearTimeout(t); }
      const buf = await ctx.startRendering(), x = buf.getChannelData(0), n = x.length, from = Math.floor(SR * 2.2);
      const w = 2 * Math.PI * 250 / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * 0.7071), b0 = (1 + cs) / 2, b1 = -(1 + cs), b2 = b0, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0, e = 0, hp = 0, pk = 0, cnt = 0, acc = 0, best = 0; const win = Math.floor(SR * 0.05), ring = new Float64Array(win);
      for (let i = 0; i < n; i++) { const v = x[i], y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = v; y2 = y1; y1 = y; if (i >= from || secs < 2) { e += v * v; hp += y * y; cnt++; } pk = Math.max(pk, Math.abs(v)); acc += y * y - ring[i % win]; ring[i % win] = y * y; if (i >= win) best = Math.max(best, acc / win); }
      const db = v => Math.round(10 * Math.log10(Math.max(1e-14, v)) * 10) / 10;
      return { all: db(e / cnt), phone: db(hp / cnt), phoneLoud: db(best), peak: Math.round(pk * 10000) / 10000 };
    };
    for (const id of ['cq-barren', 'cq-terra', 'cq-core', 'classic', 'bunker', 'canyon']) out[id] = await meas(() => ambience(id), 5);
    out.shot = await meas(() => LW.render(AC, master, 'shot', 'pulse0', 1, { bus: 'shot' }), 1.2);
    out.events = {}; for (const k of Object.keys(AMB_EVENT)) out.events[k] = await meas(() => AMB_EVENT[k](), 1.2);
    out.parts = Object.fromEntries(['cq-barren', 'cq-terra', 'cq-core'].map(k => [k, Object.keys(AMB_SPEC[k]).sort().join(',')]));
    return out;
  });
  const B = beds['cq-barren'], T = beds['cq-terra'], C = beds['cq-core'];
  console.log('beds (dBFS, last 2.8 s, phone = through a 250 Hz high-pass):', JSON.stringify({ barren: B, terra: T, core: C, shot: beds.shot, classic: beds.classic, bunker: beds.bunker, canyon: beds.canyon }));
  ok(B.all > -90 && B.all < T.all && T.all < C.all, 'loudness rises barren < terraformed < colony core (' + B.all + ' / ' + T.all + ' / ' + C.all + ' dB)');
  ok(B.phone < T.phone && T.phone < C.phone, 'on a phone speaker too (' + B.phone + ' / ' + T.phone + ' / ' + C.phone + ' dB)');
  ok(B.phone < -50, 'barren is near-silence on a phone (' + B.phone + ' dB)');
  ok(C.phone < beds.shot.phoneLoud - 12, 'on a phone even the busiest bed sits 12+ dB under your own Pulse Cannon shot (' + C.phone + ' vs ' + beds.shot.phoneLoud + ' dB)');
  const arcadeMax = Math.max(beds.classic.all, beds.bunker.all, beds.canyon.all);
  ok(C.all <= arcadeMax + 1 && T.all <= arcadeMax && B.all < arcadeMax, 'no Conquest bed is louder than the Arcade map beds already shipped (core ' + C.all + ', Arcade up to ' + arcadeMax + ' dB)');
  ok(/suit/.test(beds.parts['cq-barren']) && /impact/.test(beds.parts['cq-barren']), 'barren: the suit\'s hum and far impacts (' + beds.parts['cq-barren'] + ')');
  ok(['air', 'water', 'life', 'hum'].every(k => beds.parts['cq-terra'].split(',').includes(k)), 'terraformed: wind in the grass, water, settler life, machinery (' + beds.parts['cq-terra'] + ')');
  ok(['murmur', 'clank', 'servo', 'hum', 'hum2'].every(k => beds.parts['cq-core'].split(',').includes(k)), 'colony core: voices and traffic, metal work, loaders, machinery (' + beds.parts['cq-core'] + ')');
  ok(Object.entries(beds.events).every(([k, v]) => v.peak > 0.0005 && v.peak < 0.05), 'bed events are audible and soft: ' + Object.entries(beds.events).map(([k, v]) => k + ' ' + v.peak).join(', '));
  // which bed the tank hears
  const { buildSim } = await import(path.join(repo, 'worker/build-sim.mjs')); buildSim();
  const { CONQUEST } = await import(path.join(repo, 'worker/src/sim.gen.js') + '?' + Date.now()), W = CONQUEST.World;
  ok(W.soundZone(1162, 1130) === 'core' && W.soundZone(960, 1158) === 'terra' && W.soundZone(842, 1318) === 'terra' && W.soundZone(920, 925) === 'barren' && W.soundZone(1398, 1074) === 'barren', 'the spawn hears the colony core, the pylon greens are terraformed, the Western Reach and the Eastern Rim are barren');
  ok(W.soundZone(1080, 1205, { x: 1080, z: 1160, r: 50 }) === 'core' && W.soundZone(1080, 1205) === 'terra' && W.soundZone(1150, 1224) === 'core' && W.soundZone(1150, 1228) !== 'core', 'the colony core ends at the colony\'s edge; your Command Base counts as core once it is built');
  const app = read('js/conquest/app.js'), main = read('js/main.js');
  ok(/'cq-'\+W\.soundZone\(/.test(app) && /now-AMBI\.since>=2500/.test(app) && /ambience:ambienceId/.test(app), 'Conquest picks the bed from soundZone with a 2.5 s hold');
  ok(/ambience\(cq\?\(Conquest\.ambience\?\.\(\)\|\|null\)/.test(main), 'the frame loop plays the Conquest bed in Conquest and the map bed in the Arcade');
  // ---- 5. reward sounds and stingers wired ----
  const fxs = read('js/fx.js');
  for (const [k, snd] of [['bank', 'bank'], ['built', 'built'], ['plate', 'plate'], ['order', 'order'], ['research', 'rsDone']]) ok(new RegExp("case '" + k + "':[^\\n]*sfx\\('" + snd + "'\\)").test(fxs) && new RegExp('\\b' + snd + ':\\(\\)=>').test(fxs), 'fx(' + k + ') plays its own sound (' + snd + ')');
  ok(/stRaid:\(\)=>/.test(fxs) && /stInvade:\(\)=>/.test(fxs) && /stStrike:\(\)=>/.test(fxs) && /stVictory:\(\)=>/.test(fxs) && /case 'sting':/.test(fxs), 'four stingers: raid, invasion, strike, victory');
  ok(/n\.kind==='banked'\)cue\('bank'\)/.test(app) && /cue\(action==='bank'\?'bank':'claim'\)/.test(app), 'bank: the Supply button and the Worker notice share one cue');
  ok(/n\.kind==='plot-built'\)cue\('built'\)/.test(app), 'build complete: the plot-built notice');
  ok(/fx\('research'\)/.test(app), 'research complete: the reveal card');
  ok(/fx\('plate'\);showToast\(PLATE\.slots/.test(core), 'plate mounted: every fabricated plate (garage and Refuge Supply)');
  ok(/cue\('order'\)/.test(app), 'War Order claimed');
  ok(/op\?\.raid\)cue\('sting','raid'\)/.test(app) && /\/defense\/\.test\(op\.family\|\|''\)\)cue\('sting','invade'\)/.test(app) && /n\.kind==='incursion'\)cue\('sting','invade'\)/.test(app), 'stingers: a raid launch, an invasion defense and an incursion alert');
  ok(/view\.strikeAlert=M\.slot;cue\('sting','strike'\)/.test(app) && /if\(victory\)cue\('sting','victory'\)/.test(app), 'stingers: the Meteor Strike warning and every operation secured');
  // ---- 6. no storm or rain ----
  const sndKeys = await page.evaluate(() => [...Object.keys(SND), ...Object.keys(AMB_SPEC), ...Object.keys(AMB_EVENT)]);
  ok(!sndKeys.some(k => /rain|storm|thunder|lightning|drizzle|weather/i.test(k)) && !/['"](rain|storm|thunder)/i.test(fxs), 'no storm or rain sounds (weather is row 6B-V)');
  await b.close();
  console.log(fails.length ? 'FAIL audio: ' + fails.length + ' of ' + checks : 'PASS audio (' + checks + ' checks)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
