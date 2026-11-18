// LIVE PvP: phone/server agreement with research mods (Session 6B review "gameplay 2", owner decision Nov 17 2026: every mod
// must pass this test; a mod that still fails after two fix attempts ships turned off in live rooms only).
// Runs the REAL code on both ends: the room is worker/src/pvp.js RoomCore driving the Worker's sim bundle (worker/src/sim.gen.js);
// the phone is js/rules.js + js/game.js + js/pvp.js in their own context (the browser-only parts stubbed). They talk through
// sockets with 60 ms of latency each way, on one hand-cranked clock: the room ticks at 30 Hz, the phone draws at 60 fps.
// One scripted run per mod (all 16 + 4, plus stock), the same script every time:
//   drive left, then flat out to the right (Momentum must build on the room for a live pilot: its smoothed speed),
//   stop and stand (Capacitor Bank), raise the shield, wait, try it again (only Capacitor makes it ready this soon),
//   the enemy fires a super at you (Reflex Skirts must raise your shield on the room AND on your phone),
//   drive up to the enemy, fight (every weapon mod triggers), dash into it (Ram Servo: the room rams, never the phone),
//   dash again the moment the dash ends on the phone (Overdrive / Hyperdrive: the room must take the second and third charge),
//   then go down while the charges refill (the room's respawn brings fresh ones: the phone must follow).
// What must agree, for every mod:
//   1. every dash and shield press the phone made locally is one the room accepted (none refused, none extra)
//   2. your own shield: up / down and ready on the phone within 350 ms of the room (Capacitor's recharge, Reflex's auto-raise)
//   3. your dash charges: the phone's count matches the room's within 350 ms (Overdrive, Hyperdrive)
//   4. the room never had to snap your tank back (no resync: your prediction never ran ahead, e.g. Traction's boost ends)
//   5. one source of mod cues: every cue the room raised for you plays once on the phone, none of the phone's own
//   6. no damage, kill or ram on the phone itself: every hit you see is the room's
// usage: node dev/tests/pvp-agree.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSim } from '../../worker/build-sim.mjs';
buildSim();
const { RoomCore } = await import('../../worker/src/pvp.js');
const { RULES: R } = await import('../../worker/src/sim.gen.js');
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = f => fs.readFileSync(path.join(repo, f), 'utf8');
let checks = 0; const fails = [];
const ok = (c, m) => { checks++; if (!c) { fails.push(m); console.log('FAIL', m); } };
const J = JSON.stringify, LAT = 60, FRAME = 1000 / 60;

// ---- the phone: the game's own files, the browser parts stubbed ----
const STUBS = `var window={},API='http://local',document={getElementById:()=>null},navigator={},localStorage={getItem:()=>null,setItem(){}};
var performance={now:()=>__clock()};
var findOv=()=>null,closeOverlay=()=>{},showVS=()=>{},closeFind=()=>{},onMatchStart=()=>{},startBanners=()=>{},fx=()=>{},fxTick=()=>{},uiDirty=()=>{},
 showToast=()=>{},inBattle=()=>true,exitBattle=()=>{},ownedChassisClasses=()=>[],roundBanner=()=>{},onRoundStart=()=>{},onRoundEnd=()=>{},afterMatch=()=>{},
 applyEcoSoon=()=>{},api=()=>Promise.reject(new Error('offline')),showFind=()=>{};
var save={mp:10},SRV_ECO=false,ACCOUNT_OK=true,vsTimer=null,keys={},joy={on:false},aim=null,__in=[0,0];
var inputVec=()=>__in,__log=[],__srv=0;
function onSimEv(a){__log.push([__srv,a]);}
`;
function makePhone(clock) {
  const ctx = vm.createContext({ console, __clock: clock, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, btoa, atob });
  vm.runInContext(STUBS, ctx);
  vm.runInContext(src('js/rules.js') + '\n' + src('js/game.js').replace(/^'use strict';/, '') + '\n' + src('js/pvp.js').replace(/^'use strict';/, '') +
    '\n;(function(){const pe=pvpEv;pvpEv=function(e){__srv=1;try{pe(e);}finally{__srv=0;}};})();', ctx);
  return ctx;
}

// ---- the room, on the same hand-cranked clock ----
function rig(opts) {
  let now = 1.8e12, seq = 0; const timers = [];
  const io = {
    now: () => now, day: () => Math.floor(now / 864e5),
    setTimeout: (f, ms) => { const h = { id: ++seq, at: now + ms, f }; timers.push(h); return h; },
    clearTimeout: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
    setInterval: (f, ms) => { const h = { id: ++seq, at: now + ms, f, every: ms }; timers.push(h); return h; },
    clearInterval: (h) => io.clearTimeout(h),
    credit: async (s, calc) => { const c = calc({ pvs: 0 }); return { pts: c.pts, awarded: c.pts, capped: false, pvs: c.pvs, sb: c.sb }; },
    left() {},
  };
  const room = new RoomCore(io, opts);
  const advance = (ms) => { const end = now + ms; for (;;) { timers.sort((a, b) => a.at - b.at || a.id - b.id); const h = timers[0]; if (!h || h.at > end) break; now = h.at; if (h.every) h.at += h.every; else timers.shift(); h.f(); } now = end; };
  return { io, room, advance, get now() { return now; } };
}

const L0 = () => JSON.parse(J(R.STOCK_L));
const kit = mods => ({ ...L0(), mods });
const MODS = Object.entries(R.FITS).flatMap(([slot, o]) => Object.keys(o).filter(id => R.isRmod(slot, id)).map(id => ({ slot, id })));

// one live match: pilot A on the phone (this harness), pilot B a live seat that stands still at its spawn and fires
function runMatch(L, label, jitter = 0) {
  const g = rig({ MAP: 'classic' }), room = g.room;
  const phone = makePhone(() => g.now - 1.8e12 + 5000);
  const toPhone = [], toRoom = [];
  let rs = 7, lastP = 0, lastR = 0; const jit = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return jitter * rs / 0x7fffffff; };   // seeded network jitter; a socket never reorders (TCP)
  const sockA = { send: x => toPhone.push({ at: (lastP = Math.max(lastP, g.now + LAT + jit())), m: JSON.parse(x) }), close() {} }, sockB = { send() {}, close() {} };
  for (const [pid, LL] of [['a', L], ['b', L0()]]) room.seatPlayer({ pid, name: pid.toUpperCase(), q: { g: 'bounty', m: '1v1' }, L: LL, power: R.powerOf(LL), league: 2, mp: 0 });   // mp 0: a clear-weather room (hazards: arcade-weather.mjs 3c)
  const phoneSock = { readyState: 1, send: x => toRoom.push({ at: (lastR = Math.max(lastR, g.now + LAT + jit())), raw: x }), close() {} };
  phone.pvp = { phase: 'find', live: false, q: { g: 'bounty', m: '1v1' }, quick: false, t0: 0, n: 1, cap: 2, left: 30000, snaps: [], evq: [], off: null, jit: 0, delay: 110, tp: 0, sent: null, lastSnapAt: 0, retry: 0, id: 1, room: 'r', tok: 't', sock: phoneSock };
  vm.runInContext('pvp=globalThis.pvp;', phone);
  room.connect('a', sockA); room.connect('b', sockB);
  // what the room did with this pilot's presses (wrapped on the room's own sim)
  const sim = () => room.sim, srv = { dash: 0, dashRefused: 0, shield: 0, shieldRefused: 0, cues: 0, ram: 0 };
  let wrapped = false;
  const wrap = () => { if (wrapped || !room.sim) return; wrapped = true; const S = room.sim, nd = S.netDash, ns = S.netShield;
    S.netDash = (u, x, y) => { const r = nd(u, x, y); if (u.id === 0) { if (r) srv.dash++; else srv.dashRefused++; } return r; };
    S.netShield = (u) => { const r = ns(u); if (u.id === 0) { if (r) srv.shield++; else srv.shieldRefused++; } return r; }; };
  let fightAt = null, t = 0;
  const step = () => {
    g.advance(FRAME); wrap();
    while (toRoom.length && toRoom[0].at <= g.now) room.onMessage('a', sockA, toRoom.shift().raw);
    while (toPhone.length && toPhone[0].at <= g.now) { const m = toPhone.shift().m; if (m.k === 's') for (const e of m.e || []) if (e[1] === 'Q' && e[2] === 0) srv.cues++; vm.runInContext('pvpMsg(' + J(m) + ')', phone); }
    vm.runInContext('pvpFrame(' + 1 / 60 + ')', phone);
  };
  // the VS screen, then the fight
  for (let i = 0; i < 60 * 12 && room.phase !== 'play'; i++) step();
  ok(room.phase === 'play', label + ': the live match starts');
  for (let i = 0; i < 20 && phone.pvp.phase !== 'play'; i++) step();
  fightAt = g.now;
  const P = (e) => vm.runInContext(e, phone);
  const ua = () => sim().units[0], ub = () => sim().units[1];
  const tp0 = P('pvp.tp'); let resyncs = 0, lastTp = tp0, deaths0 = 0;
  const rec = [];   // per frame: [t, room shield up, phone shield up, room cd, phone cd, room dq, phone dq]
  let phoneDash = 0, phoneShield = 0, momRoom = 0, momPhone = 0, reflexRoom = 0, trAfter = null, dashAt = [], ramHit = 0;
  const go = (x, y) => { const me = P('[me.x,me.y]'), dx = x - me[0], dy = y - me[1], d = Math.hypot(dx, dy); P('__in=' + J(d < 0.15 ? [0, 0] : [dx / d, dy / d])); return d; };
  const press = (k, a) => { const r = k === 'd' ? P('pvpDash(' + a[0] + ',' + a[1] + ')') : P('pvpShield()'); if (r) { if (k === 'd') { phoneDash++; dashAt.push(t); } else phoneShield++; } return r; };
  let stage = 0, superDone = false, burstN = 0;
  const charges = L.mods && L.mods.mobility === 'hyperdrive' ? 3 : L.mods && L.mods.mobility === 'overdrive' ? 2 : 1, hasOD = charges > 1;
  let killed = false;
  for (let f = 0; f < 60 * 32; f++) {
    t = (g.now - fightAt) / 1000;
    // the script (classic: you start at (10,28), the enemy stands at (10,4))
    if (t < 1.7) P('__in=[-1,0]');                       // left...
    else if (t < 5.2) P('__in=[1,0]');                   // ...then flat out to the right for 3.5 s (Momentum)
    else if (stage === 0) { if (go(18, 12) < 0.3) stage = 1; }   // up the right side
    else if (stage === 1) { if (go(15, 5) < 0.2) { stage = 2; P('__in=[0,0]'); } }   // a clear spot 5 from the enemy, in its sight: the turrets fire from here
    if (stage === 2 && !superDone && t >= 11) { superDone = true; const B = ub(), A = ua(); B.sp = 1e6; B.supN = 0; sim().useSuper(B, Math.atan2(A.y - B.y, A.x - B.x)); }   // the enemy's super at you (Reflex Skirts, your shield unused so far)
    if (stage === 2 && t >= 12.5) { press('h'); stage = 3; }   // your shield (with Reflex it was raised for the super: the phone knows, and refuses)
    if (stage === 3 && t >= 18) { press('h'); stage = 4; }     // standing still since about 10 s: only Capacitor Bank has it ready again this soon
    if (stage === 4 && t >= 18.3) { if (go(12.5, 4.3) < 0.3) { stage = 5; P('__in=[0,0]'); } }
    if (stage === 5) { const B = P('[units[1].x,units[1].y,me.x,me.y]'), dx = B[0] - B[2], dy = B[1] - B[3], d = Math.hypot(dx, dy); press('d', [dx / d, dy / d]); stage = 6; burstN = 1; }   // dash into it (Ram Servo)
    else if (stage === 6 && burstN < charges && !P('me.dash')) { if (press('d', [0.3, 1])) burstN++; else stage = 7; }   // the next charge the moment this dash ends on the phone (Overdrive / Hyperdrive)
    else if (stage === 6 && burstN >= charges) stage = 7;
    if (stage === 7) P('__in=[0,0]');
    if (stage === 7 && !killed && t >= 22.5) { killed = true; const A = ua(); sim().hit(A, A.hp + 1, ub(), null, 0); }   // you go down while your charges refill: the room's respawn brings them back full, and the phone must follow
    step();
    const A = ua(), me = P('({st:me.shieldT||0,cd:me.shieldCd||0,dq:me.mf&&me.mf.dq!==undefined?me.mf.dq:-1,mom:me.mfv&&me.mfv.mom?1:0,tr:me.mf?me.mf.tr||0:0})');
    rec.push([t, (A.shieldT || 0) > 0 ? 1 : 0, me.st > 0 ? 1 : 0, A.shieldCd || 0, me.cd, A.mf && A.mf.dq !== undefined ? A.mf.dq : -1, me.dq]);
    if (A.mf && A.mf.mom) momRoom = 1; if (me.mom) momPhone = 1;
    if (process.env.PVP_AGREE_DEBUG && f % (+process.env.PVP_AGREE_EVERY || 6) === 0) console.log(label, t.toFixed(2), 'room', J({x: +A.x.toFixed(2), avx: +(A.avx || 0).toFixed(2), fast: A.mf ? +A.mf.fast.toFixed(2) : null, slow: A.mf ? +A.mf.slow.toFixed(2) : null, mid: A.mf ? (A.mf.__id || (A.mf.__id = Math.random().toString(36).slice(2, 6))) : null, vx: +(A.vx || 0).toFixed(2), ctl: A.ctl, mom: A.mf ? A.mf.mom : null, dq: A.mf ? A.mf.dq : null, dr: A.mf ? +(A.mf.dr || 0).toFixed(2) : null, dash: !!A.dash, dq2: !!A.dq2 }), 'phone', J(me));
    if (stage >= 6 && trAfter === null && dashAt.length && t > dashAt[dashAt.length - 1] + 2.6) trAfter = me.tr;
    const tpNow = P('pvp.tp'); if (tpNow !== lastTp) { if ((A.deaths || 0) === deaths0) resyncs++; lastTp = tpNow; deaths0 = A.deaths || 0; }   // a respawn is a teleport, not a resync
  }
  const log = P('__log'), local = log.filter(e => !e[0]), Q = log.filter(e => e[0] && e[1][0] === 'Q' && e[1][1] === 0);
  // the room's own ram cue and reflex cue for pilot A
  const roomQ = Q.map(e => e[1][2]);
  // disagreement stretches (ms) between the room and the phone
  const stretch = (fn) => { let worst = 0, run = 0; for (let i = 1; i < rec.length; i++) { if (fn(rec[i])) { run += FRAME; worst = Math.max(worst, run); } else run = 0; } return worst; };
  const shieldGap = stretch(r => r[1] !== r[2]), readyGap = stretch(r => (r[3] <= 0) !== (r[4] <= 0)), dqGap = stretch(r => r[5] !== r[6]);
  return { label, srv, phoneDash, phoneShield, resyncs, local: local.map(e => e[1][0]), localQ: local.filter(e => e[1][0] === 'Q').length, roomQ, phoneQ: Q.length,
    shieldGap, readyGap, dqGap, momRoom, momPhone, trAfter, hasOD, charges, burstN, reflexRoom: roomQ.filter(k => k === 'reflex').length, ram: roomQ.filter(k => k === 'ram').length,
    secondShield: rec.some(r => r[0] > 18 && r[0] < 18.4 && r[1]), stage };
}

const rows = [];
const ONLY = (process.env.PVP_AGREE_ONLY || '').split(',').filter(Boolean);   // debugging: PVP_AGREE_ONLY=momentum,overdrive
for (const jitter of [0, 100]) for (const m of [{ slot: null, id: 'stock' }].concat(MODS).filter(m => !ONLY.length || ONLY.includes(m.id))) {
  const L = m.slot ? kit({ [m.slot]: m.id }) : L0();
  const r = runMatch(L, m.id, jitter);
  const tag = m.id + (jitter ? ' (0-' + jitter + ' ms jitter)' : '') + ': ';   // reviewer 1: also under network jitter
  ok(r.srv.dashRefused === 0 && r.srv.shieldRefused === 0 && r.srv.dash === r.phoneDash && r.srv.shield === r.phoneShield, tag + 'every dash and shield the phone made is one the room took (phone ' + r.phoneDash + ' dashes / ' + r.phoneShield + ' shields, room ' + J(r.srv) + ')');
  ok(r.shieldGap <= 350, tag + 'your shield is up or down on the phone as on the room (longest disagreement ' + Math.round(r.shieldGap) + ' ms)');
  ok(r.readyGap <= 350, tag + 'your shield is ready on the phone when it is ready on the room (longest disagreement ' + Math.round(r.readyGap) + ' ms)');
  ok(r.dqGap <= 350, tag + 'your dash charges agree (longest disagreement ' + Math.round(r.dqGap) + ' ms)');
  ok(r.resyncs === 0, tag + 'the room never had to snap your tank back (' + r.resyncs + ' resyncs)');
  ok(r.localQ === 0 && r.phoneQ === r.srv.cues, tag + 'one source of mod cues: the room raised ' + r.srv.cues + ' for you, the phone played ' + r.phoneQ + ' of them and ' + r.localQ + ' of its own');
  ok(!r.local.some(k => 'hkB'.includes(k)), tag + 'no damage, kill or ram on the phone itself (local events: ' + J([...new Set(r.local)]) + ')');
  if (m.id === 'momentum') ok(r.momRoom && r.momPhone, tag + 'Momentum builds on the room for a live pilot driving flat out, and the phone shows it');
  ok(r.stage === 7, tag + 'the script ran to its end (stage ' + r.stage + ')');
  if (m.id === 'capacitor') ok(r.secondShield && r.phoneShield === 2, tag + 'Capacitor Bank: standing still, the shield is ready again 5.5 s later on the room and the phone, and the second press is taken');
  else if (m.id === 'reflex') ok(r.phoneShield === 0, tag + 'with the shield raised by Reflex on the room, both your presses are refused on the phone (it knows the cooldown) as on the room');
  else ok(r.phoneShield === 1, tag + 'without Capacitor the second press 5.5 s later is refused on the phone and the room alike');
  if (m.id === 'reflex') ok(r.reflexRoom >= 1, tag + 'Reflex Skirts raised your shield on the room for the enemy super, and the phone showed it');
  if (m.id === 'ram') ok(r.ram >= 1, tag + 'Ram Servo: the room rammed the enemy (and the phone did not: check 6)');
  if (r.hasOD) ok(r.burstN === r.charges && r.srv.dash >= r.charges, tag + 'all ' + r.charges + ' dash charges in one burst are taken by the room (the next pressed the moment the dash ends on the phone)');
  if (m.id === 'traction') ok(r.trAfter === 0, tag + 'Traction Servo\'s boost runs out on the phone as on the room (left: ' + r.trAfter + ')');
  rows.push(m.id + ' dashes ' + r.phoneDash + '/' + r.srv.dash + ' shields ' + r.phoneShield + '/' + r.srv.shield + ' cues ' + r.phoneQ + '/' + r.srv.cues + ' gaps ' + [r.shieldGap, r.readyGap, r.dqGap].map(Math.round).join('/') + ' ms resyncs ' + r.resyncs);
}
console.log(rows.join('\n'));
if (fails.length) { console.log('FAIL pvp-agree: ' + fails.length + ' of ' + checks + ' checks'); process.exit(1); }
console.log('PASS pvp-agree: ' + checks + ' checks, ' + 2 * (MODS.length + 1) + ' live matches (stock + every research and Legendary mod, steady and with 0-100 ms jitter), phone == room');
