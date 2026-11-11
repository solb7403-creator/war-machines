// SUPER AIM regression (Session 5E-2a, owner report Nov 11 2026: "the super sometimes fires in a random direction").
// Runs the REAL shared sim (js/rules.js + js/game.js + worker/sim-api.js: the same code the phone's AI match and the live-match
// server run) and checks that a super always fires at the target it was aimed at, or along the direction the pilot dragged:
//  1. auto-aim tap at a still target and at a target driving across (lead, not a random swing)
//  2. auto-aim at a LIVE pilot whose position arrives in 100 ms reports (the server sees steps, not smooth motion)
//  3. a target that dashes during the charge
//  4. drag-aim: the dragged direction is kept exactly, whatever the target does
//  5. line of sight lost mid-charge: the aim holds, it never swings
//  6. target died mid-charge: the aim does not swing to another enemy
//  7. target switched mid-charge (tap a new target, or another enemy becomes nearest): the aim stays on the first target
//  8. chassis switch: a lock that points at a replaced tank object is dropped (aims at the real tank, not a ghost)
//  9. live PvP vs AI: an AI pilot's own super at a live pilot (same rules)
// usage: node dev/tests/super-aim.mjs   ([COMBAT_SRC=<another checkout>] to run it against other code, e.g. main before the fix)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), srcRoot = process.env.COMBAT_SRC || repo;
const rd = f => fs.readFileSync(path.join(srcRoot, f), 'utf8').replace(/^'use strict';[^\n]*\n/m, '');
let checks = 0; const fails = [];
const ok = (c, m) => { checks++; if (!c) { fails.push(m); console.log('FAIL', m); } };
const DT = 1 / 30;   // the live room's tick (worker/src/pvp.js TICK_MS)

// a fresh sim with internals the test needs (same scope as the game code)
function sim(seed = 7) {
  let s = seed;   // deterministic Math.random for the sim (bot names, events)
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const body = '"use strict";\nconst Math=Object.create(globalThis.Math);Math.random=RAND;\n' + rd('js/rules.js') + rd('js/game.js') +
    'const __api=(function(){' + rd('worker/sim-api.js') + '})();\n' +
    'return Object.assign(__api,{los:(a,b)=>los(a,b),nearestFoe:u=>nearestFoe(u),SUPS:SUP,bodyR:v=>bodyR(v),RAD:R,kill:u=>{u.hp=0;},setState:v=>{state=v;},walls:()=>walls,rocks:()=>rocks,simUnits:()=>units,setUnits:v=>{units=v;}});';
  return new Function('HOST', 'RAND', body)({ ev() {}, end() {}, round() {}, death() {} }, rand);
}
const L = (c = 'vanguard', w = 'pulse') => ({ w: { a: w, t: 0, q: 1, s: false }, c: { c, t: 0, q: 1, s: false }, up: { hull: 0, cannon: 0, engine: 0, target: 0, reactor: 0 }, cores: ['dmg', 'rof', 'arm'], gl: {}, skin: 'default', paint: 'stock' });
// m: '1v1' | '2v2'; seats: array of 'h' (live pilot) or null (AI pilot)
// open: cover removed (the motion cases need room to drive; cover cases add their own wall)
function match(m, seats, wpn = 'pulse', open = true, map = 'craters') {
  const S = sim();
  S.setup({ map, g: 'arena', m, seats: seats.map((x, i) => x ? { pid: 'p' + i, name: 'P' + i, L: L('vanguard', wpn) } : null), lg: 3 });
  S.start(); S.setState('play');
  if (open) { S.walls().length = 0; S.rocks().length = 0; }
  const U = S.units;
  for (const u of U) { u.sp = 0; u.cd = 99; u.shieldT = 0; }   // nobody shoots or supers on their own unless a test asks
  return { S, U };
}
// place a unit somewhere with no motion history (no velocity spike from the teleport)
const put = (u, x, y) => { u.x = x; u.y = y; u.px = x; u.py = y; u.ox = x; u.oy = y; u.claim = null; u.vx = 0; u.vy = 0; if ('avx' in u) { u.avx = 0; u.avy = 0; } };
const angTo = (a, x, y) => Math.atan2(y - a.y, x - a.x);
const dAng = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
// run the sim until r's super fires; each tick calls drive(tick). Returns {ang (the angle it fired along), at: target spot}
function charge(S, r, drive, maxT = 2) {
  let ang = null, ticks = 0;
  for (; ticks < maxT / DT; ticks++) {
    if (drive) drive(ticks);
    S.step(DT);
    for (const u of S.units) if (u.hp > 0 && u !== r) u.cd = 99;
    if (r.sup) ang = r.sup.ang; else if (ang !== null) break;
  }
  return ang;
}
// does a beam along ang from r cover unit e (the sim's own hit rule)?
const beamHits = (S, r, ang, e, kind = 'pulse') => {
  const B = S.SUPS[kind], ex = e.x - r.x, ey = e.y - r.y, along = ex * Math.cos(ang) + ey * Math.sin(ang), side = Math.abs(-ex * Math.sin(ang) + ey * Math.cos(ang));
  return along > 0 && along <= B.len && side < B.w + S.bodyR(e) - S.RAD;
};
// open ground: find a spot where a and b see each other from (x0,y0) towards +y
function openPair(S, a, b, dx, dy, from = [[4, 13], [4, 19], [10, 16], [8, 14], [12, 18]]) {
  for (const [x, y] of from) { put(a, x, y); put(b, x + dx, y + dy); if (S.los(a, b)) return true; }
  return false;
}

// ---- 1. auto-aim at a still target ----
{ const { S, U } = match('1v1', ['h', 'h']); const [r, e] = U; ok(openPair(S, r, e, 0, 6), 'setup: open ground for a 1v1');
  r.sp = 1000; ok(S.useSuper(r), 'auto-aim super starts'); const ang = charge(S, r);
  ok(ang !== null && dAng(ang, angTo(r, e.x, e.y)) < 0.03, '1a still target: fires straight at it (error ' + (ang === null ? 'none' : dAng(ang, angTo(r, e.x, e.y)).toFixed(3)) + ' rad)');
  ok(beamHits(S, r, ang, e), '1a still target: the beam covers it'); }
// ---- 1b/2. a target driving across: AI-match smooth motion, and a live pilot reporting every 100 ms ----
for (const live of [false, true]) {
  const { S, U } = match('1v1', ['h', 'h']); const [r, e] = U; ok(openPair(S, r, e, 0, 6), 'setup: open ground');
  const v = 3.6; let gx = e.x, gy = e.y;   // e drives along +x at 3.6 u/s (below its top speed)
  const drive = t => { gx += v * DT; if (live) { if (t % 3 === 0) S.netClaim(e, gx, gy, e.tp | 0); } else { e.x = gx; } };
  for (let t = 0; t < 30; t++) { drive(t); S.step(DT); }   // a second of motion history first
  r.sp = 1000; ok(S.useSuper(r), 'super at a moving target starts');
  const ang = charge(S, r, t => drive(t + 30));
  ok(ang !== null && beamHits(S, r, ang, e), (live ? '2 live pilot (100 ms reports)' : '1b AI-match motion') + ': the beam covers the target where it is when the super fires (error to it ' + dAng(ang, angTo(r, e.x, e.y)).toFixed(3) + ' rad)');
}
// a live pilot standing still between reports must not be led off by a stale step (the server sees a jump every 3rd tick)
{ const { S, U } = match('1v1', ['h', 'h']); const [r, e] = U; ok(openPair(S, r, e, 0, 6), 'setup: open ground');
  let gx = e.x; for (let t = 0; t < 30; t++) { if (t % 3 === 0) { gx += 0.36; S.netClaim(e, gx, e.y, e.tp | 0); } S.step(DT); }
  // the pilot stops and the last report lands on this very tick: the server moves it one whole report in one tick
  S.netClaim(e, gx + 0.36, e.y, e.tp | 0); S.step(DT);
  r.sp = 1000; S.useSuper(r); const start = r.sup && r.sup.ang;
  const lead = dAng(start, angTo(r, e.x, e.y));
  ok(start !== null && lead < 0.45, '2b live pilot: the opening aim is not thrown by one report step (lead ' + lead.toFixed(3) + ' rad, a step read as speed gives ~0.8)');
  const ang = charge(S, r); ok(ang !== null && beamHits(S, r, ang, e), '2b live pilot that stopped: the beam still covers it'); }
// ---- 3. target dashes during the charge, then stops ----
{ const { S, U } = match('1v1', ['h', 'h']); const [r, e] = U; ok(openPair(S, r, e, 0, 6), 'setup: open ground');
  r.sp = 1000; S.useSuper(r);
  let dashed = false; const ang = charge(S, r, t => { if (t === 2 && !dashed) { e.dashCd = 0; dashed = S.netDash(e, 1, 0); } if (e.dash) S.netClaim(e, e.x + 4.4 * 3.4 * DT, e.y, e.tp | 0); });
  ok(dashed, 'setup: target dashed'); ok(ang !== null && dAng(ang, angTo(r, e.x, e.y)) < 0.6, '3 dash: the aim follows the target and never flies off (error ' + dAng(ang, angTo(r, e.x, e.y)).toFixed(3) + ' rad)'); }
// ---- 4. drag-aim keeps the dragged direction ----
for (const a of [0, 1.1, -2.3, Math.PI]) {
  const { S, U } = match('1v1', ['h', 'h']); const [r, e] = U; ok(openPair(S, r, e, 0, 6), 'setup: open ground');
  r.sp = 1000; ok(S.useSuper(r, a), 'drag-aim super starts'); const ang = charge(S, r, t => S.netClaim(e, e.x + 0.12, e.y, e.tp | 0));
  ok(ang !== null && dAng(ang, a) < 1e-9, '4 drag-aim ' + a.toFixed(2) + ': fires exactly along the dragged direction');
}
// ---- 5. line of sight lost mid-charge: the aim holds ----
{ const { S, U } = match('1v1', ['h', 'h']); const [r, e] = U; ok(openPair(S, r, e, 0, 6), 'setup: open ground');
  r.sp = 1000; S.useSuper(r); const a0 = r.sup.ang;
  const walls = S.walls(); walls.push([Math.min(r.x, e.x) - 1, (r.y + e.y) / 2 - 0.2, 2 + Math.abs(e.x - r.x), 0.4]);   // a wall drops between them
  ok(!S.los(r, e), 'setup: sight is blocked');
  const ang = charge(S, r, t => S.netClaim(e, e.x + 0.3, e.y, e.tp | 0));   // and the target slips away behind it
  ok(ang !== null && dAng(ang, a0) < 1e-9, '5 sight lost: the super keeps the aim it had (no swing)'); walls.pop(); }
// ---- 6. target died mid-charge: no swing to another enemy ----
{ const { S, U } = match('2v2', ['h', 'h', 'h', 'h']); const [r, mate, e1, e2] = U;
  put(mate, 2, 30); let found = false;
  for (const [x, y] of [[10, 16], [8, 14], [12, 18], [10, 12], [10, 20]]) { put(r, x, y); put(e1, x, y + 5); put(e2, x + 4.5, y - 1.5); if (S.los(r, e1) && S.los(r, e2)) { found = true; break; } }
  ok(found, 'setup: two enemies in sight in different directions');
  r.focus = e1; r.sp = 1000; S.useSuper(r); const a0 = angTo(r, e1.x, e1.y);
  const ang = charge(S, r, t => { if (t === 3) S.kill(e1); });
  ok(ang !== null && dAng(ang, a0) < 0.05, '6 target died: fires where it was aimed (off by ' + dAng(ang, a0).toFixed(3) + ' rad), not at the other enemy (' + dAng(a0, angTo(r, e2.x, e2.y)).toFixed(2) + ' rad away)'); }
// ---- 7. target switched mid-charge ----
for (const how of ['tap', 'nearest']) {
  const { S, U } = match('2v2', ['h', 'h', 'h', 'h']); const [r, mate, e1, e2] = U;
  put(mate, 2, 30); let found = false;
  for (const [x, y] of [[10, 16], [8, 14], [12, 18], [10, 12], [10, 20]]) { put(r, x, y); put(e1, x, y + 4); put(e2, x + 5, y - 2); if (S.los(r, e1) && S.los(r, e2)) { found = true; break; } }
  ok(found, 'setup: two enemies in sight');
  r.sp = 1000; S.useSuper(r); const a0 = angTo(r, e1.x, e1.y);   // e1 is nearest
  const ang = charge(S, r, t => { if (t === 2) { if (how === 'tap') S.netTarget(r, e2.id); else { put(e2, r.x + 2.2, r.y - 1); } } });
  ok(ang !== null && dAng(ang, a0) < 0.05, '7 target switched (' + how + '): stays on the target it was fired at (off by ' + dAng(ang, a0).toFixed(3) + ' rad)'); }
// ---- 8. chassis switch: a lock on a replaced tank object ----
{ const { S, U } = match('1v1', ['h', 'h']); const [r, e] = U; ok(openPair(S, r, e, 0, 6), 'setup: open ground');
  const ghost = Object.assign({}, e, { x: e.x - 6, y: e.y - 8 });   // the old object of a tank that was rebuilt (match.js switchChassis), left behind in a lock
  r.focus = ghost; r.sp = 1000; S.useSuper(r); const ang = charge(S, r);
  ok(ang !== null && beamHits(S, r, ang, e), '8 chassis switch: fires at the real tank, not at the replaced object'); }
// ---- 9. live PvP vs AI: an AI pilot's super at a live pilot who keeps driving ----
{ const { S, U } = match('1v1', ['h', null]); const [h, ai] = U; ok(openPair(S, ai, h, 0, -6), 'setup: open ground');
  let gx = h.x; const drive = t => { gx += 3.6 * DT; if (t % 3 === 0) S.netClaim(h, gx, h.y, h.tp | 0); };
  for (let t = 0; t < 30; t++) { drive(t); ai.cd = 99; ai.sp = 0; S.step(DT); }
  put(ai, ai.x, ai.y); ai.sp = 1000; ok(S.useSuper(ai), 'AI super starts'); const ang = charge(S, ai, t => drive(t + 30));
  ok(ang !== null && beamHits(S, ai, ang, h), '9 AI vs live pilot: the AI super covers the pilot where it is when it fires (error ' + dAng(ang, angTo(ai, h.x, h.y)).toFixed(3) + ' rad)'); }
// ---- shells and novas use the same aim ----
{ const { S, U } = match('1v1', ['h', 'h'], 'siege'); const [r, e] = U; ok(openPair(S, r, e, 0, 5), 'setup: open ground');
  r.sp = 1000; S.useSuper(r); const ang = charge(S, r, t => { if (t === 3) S.kill(e); });
  ok(ang !== null && dAng(ang, angTo(r, e.x, e.y)) < 0.05, 'siege shell: target died mid-charge, the shell still goes where it was aimed'); }

// ---- siege shell in a 2v2: target died mid-charge with another enemy in sight -> the shell keeps its aim ----
{ const { S, U } = match('2v2', ['h', 'h', 'h', 'h'], 'siege'); const [r, mate, e1, e2] = U; put(mate, 2, 30); put(r, 10, 16); put(e1, 10, 21); put(e2, 14.5, 14.5);
  r.focus = e1; r.sp = 1000; S.useSuper(r); const a0 = angTo(r, e1.x, e1.y);
  const ang = charge(S, r, t => { if (t === 3) S.kill(e1); });
  ok(ang !== null && dAng(ang, a0) < 0.05, 'siege 2v2: target died mid-charge, the shell does not swing to the other enemy (off by ' + dAng(ang, a0).toFixed(3) + ' rad, the other enemy is ' + dAng(a0, angTo(r, e2.x, e2.y)).toFixed(2) + ' rad away)'); }
// ---- live seat on the flipped side: the client sends its screen angle, the room adds pi (worker/src/pvp.js 's') ----
{ const room = fs.readFileSync(path.join(srcRoot, 'worker/src/pvp.js'), 'utf8');
  ok(/useSuper\(u, typeof m\.a === "number" && Number\.isFinite\(m\.a\) \? m\.a \+ \(s\.flip \? Math\.PI : 0\) : undefined\)/.test(room), 'live room: a flipped seat\'s dragged angle is turned by pi into world space, an auto super stays the server\'s own aim');
  const { S, U } = match('1v1', ['h', 'h']); const [r, e] = U; ok(openPair(S, r, e, 0, 6), 'setup: open ground');
  const world = 0.7, sent = Math.round((world + Math.PI) * 1000) / 1000;   // what a flipped phone sends for that world direction (pvp.js rounds to 1/1000)
  r.sp = 1000; S.useSuper(r, sent + Math.PI); const ang = charge(S, r);
  ok(ang !== null && dAng(ang, world) < 0.002, 'flipped seat: the super fires along the dragged world direction'); }
console.log(fails.length ? `super-aim: ${fails.length} of ${checks} checks FAILED` : `super-aim: PASS (${checks} checks)`);
process.exit(fails.length ? 1 : 0);
