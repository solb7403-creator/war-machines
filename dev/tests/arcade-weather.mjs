// ARCADE WEATHER + MAP HAZARDS (Session 5E-2e, owner decisions Nov 17 2026). Runs on the REAL code: js/rules.js + js/game.js
// + js/match.js (the phone's AI match, through combat-sim.mjs), js/proof.js (the match record), the Worker bundle
// (worker/src/sim.gen.js: the live room's sim and RULES), worker/src/proof.js and worker/src/eco.js (tickets, results).
// It fails if any owner rule breaks:
//  1. the roll: ~25% clear / 35% vision only / 20% hazard only / 20% both; first three matches clear; no seed, no weather
//  2. each map has exactly one damaging hazard and one vision effect; the old meteor event is gone, the flare is weather
//  3. no luck, no desync: the plan is a pure function of the seed; phone build == Worker build, plan for plan and hit for hit
//  4. fair to both halves: every strike has its point-mirrored twin and the first half to be hit alternates
//  5. always dodgeable: every hit has its full warning first, and the slowest tank can drive out of every footprint in time
//  6. no one-shots: never more than WX_CAP of a full hull
//  7. hazards are a skill: the kill goes to the last enemy who hit the tank within 5 s (nobody recent: nobody), and it pays
//     exactly what a normal kill pays (no new points source)
//  8. the AI follows the same rules: it sees no further than a player in dust / glare, and gets hit by hazards itself
//  9. takedowns count only from server-verified results: a live room's own sim, or an AI match record the server checks
//     against the weather IT seeded; 25 on a map unlock that map's finish; the LIVE finishes cannot be bought
// usage: node dev/tests/arcade-weather.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWorld, GEAR } from './combat-sim.mjs';
import { makeDB } from './wtest/fakedb.mjs';
import { buildSim } from '../../worker/build-sim.mjs';
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = f => fs.readFileSync(path.join(repo, f), 'utf8').replace(/^'use strict';[^\n]*\n/m, '');
buildSim();
const db = makeDB();
globalThis.fetch = async (url, init) => { if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) return db.handle(url, init); throw new Error('unexpected fetch ' + url); };
const { createSim, RULES: SR } = await import('../../worker/src/sim.gen.js');
const { checkProof } = await import('../../worker/src/proof.js');
const eco = await import('../../worker/src/eco.js');
const W = makeWorld({ proof: true }), J = JSON.stringify;
let checks = 0; const fails = [];
const ok = (c, m) => { checks++; if (!c) { fails.push(m); console.log('FAIL', m); } };
const MAPS6 = ['classic', 'overpass', 'longshot', 'craters', 'canyon', 'bunker'];
const WX = W.eval('({MAP:WX_MAP,HZ:WX_HZ,VIS:WX_VIS,CAP:WX_CAP,CREDIT:WX_CREDIT,ODDS:WX_ODDS,FIRST:WX_FIRST_CLEAR,N:WX_FINISH_N,SAFE:WX_SPAWN_SAFE})');
const seedOf = k => { for (let s = 1; ; s++) if (W.eval(`wxRoll(${s}).k`) === k) return s; };
const seedsOf = (k, n) => { const a = []; for (let s = 1; a.length < n; s++) if (W.eval(`wxRoll(${s}).k`) === k) a.push(s); return a; };

// ---- 1. the roll ----
{ const N = 400000, r = W.eval(`(()=>{const n=[0,0,0,0];for(let i=0;i<${N};i++)n[wxRoll((Math.imul(i,2654435761)^0x1234567)|0).k]++;return n;})()`).map(x => x / N);
  ok(J(WX.ODDS) === J([0.25, 0.35, 0.20, 0.20]), 'the owner\'s odds: 25% clear, 35% vision only, 20% hazard only, 20% both');
  r.forEach((v, i) => ok(Math.abs(v - WX.ODDS[i]) < 0.004, 'measured roll ' + ['clear', 'vision only', 'hazard only', 'both'][i] + ' ' + (v * 100).toFixed(2) + '% vs ' + WX.ODDS[i] * 100 + '%'));
  console.log('measured over ' + N + ' seeds: clear ' + (r[0] * 100).toFixed(2) + '%, vision only ' + (r[1] * 100).toFixed(2) + '%, hazard only ' + (r[2] * 100).toFixed(2) + '%, both ' + (r[3] * 100).toFixed(2) + '%');
  ok(WX.FIRST === 3 && W.eval(`[1,2,3,4,5,6,7,8,9].every(s=>wxRoll(s,true).k===0)`), 'a clear match is clear whatever the seed (first three matches)');
  ok(W.eval(`wxRoll(null).k===0&&wxRoll(undefined).k===0&&wxRoll(1.5).k===0`), 'no seed: no weather');
  const r3 = W.run({ g: 'bounty', m: '1v1', map: 'longshot', seed: 9, mp: 2, L: GEAR.stock, lg: 0, dt: 1 / 30, wx: seedOf(3) });
  ok(r3.wx && r3.wx.k === 0 && r3.hz.hits === 0, 'a pilot in their first three matches plays a clear match (mp 2: roll ' + J(r3.wx) + ')');
  const none = W.run({ g: 'bounty', m: '1v1', map: 'longshot', seed: 9, mp: 50, L: GEAR.stock, lg: 0, dt: 1 / 30, wx: null });
  ok(none.wx === null && none.hz.hits === 0, 'a match without a weather seed has no weather');
}

// ---- 2. one hazard and one vision effect per map; the old events ----
{ const hz = MAPS6.map(m => WX.MAP[m].hz), vis = MAPS6.map(m => WX.MAP[m].vis);
  ok(J(hz) === J(['meteor', 'train', 'arc', 'vent', 'tornado', 'laser']), 'the six hazards: ' + hz.join(', '));
  ok(J(vis) === J(['haze', 'flare', 'flare', 'steam', 'dust', 'flicker']), 'the six vision effects: ' + vis.join(', '));
  ok(!vis.includes('rain') && !Object.keys(WX.VIS).includes('rain'), 'no rain in Arcade');
  for (const m of MAPS6) for (const s of seedsOf(3, 6)) { const P = W.eval(`wxPlan(${s},${J(m)},0,180)`);
    ok(P.haz === WX.MAP[m].hz && P.vis === WX.MAP[m].vis && P.hz.length > 0, m + ': both = its own hazard and its own vision effect');
    const kinds = new Set(P.hz.map(z => z.k)); ok(kinds.size === 1, m + ': exactly one kind of damaging hazard (' + [...kinds] + ')'); }
  for (const m of MAPS6) { const P = W.eval(`wxPlan(${seedOf(1)},${J(m)},0,180)`); ok(P.haz === null && P.hz.every(z => z.soft) && (P.win.length > 0 || P.clouds.length > 0), m + ': vision only has nothing that can hurt'); }
  for (const m of MAPS6) { const P = W.eval(`wxPlan(${seedOf(2)},${J(m)},0,180)`); ok(P.vis === null && P.win.length === 0 && P.clouds.length === 0 && P.hz.length > 0 && !P.hz.some(z => z.soft), m + ': hazard only has no vision effect'); }
  for (const m of MAPS6) { const P = W.eval(`wxPlan(${seedOf(0)},${J(m)},0,180)`); ok(P.k === 0 && !P.hz.length && !P.win.length && !P.clouds.length, m + ': clear is clear'); }
  ok(W.eval(`Object.keys(EVENTS).join()`) === 'drop,flare' && W.eval(`typeof METEOR_DMG==='undefined'&&typeof meteorWarn==='undefined'`), 'the meteor shower is out of the event pool (no red-circle meteors left in the sim)');
  ok(W.eval(`EVENTS.flare.txt`) === 'Solar flare: supers charge twice as fast', 'the flare keeps its effect and its line');
  ok(Math.abs(W.eval('EVT_DROP') - 1 / 3) < 1e-9, 'the supply drop keeps its one-in-three share');
}

// ---- 3 + 4. the plan: deterministic, the same in the Worker bundle, mirrored, warned ----
const mir = (x, y) => [20 - x, 32 - y], near = (a, b, e = 0.011) => Math.abs(a - b) <= e;
let nPlans = 0;
for (const m of MAPS6) for (const k of [1, 2, 3]) for (const s of seedsOf(k, 14)) for (const [round, T] of [[0, 180], [1, 90], [3, 90], [0, 120], [0, 150]]) {
  const a = W.eval(`JSON.stringify(wxPlan(${s},${J(m)},${round},${T}))`), b = J(SR.wxPlan(s, m, round, T)); nPlans++;
  if (a !== b) { ok(false, m + ' seed ' + s + ' round ' + round + ': the phone and the Worker bundle disagree on the plan'); continue; }
  const P = JSON.parse(a), H = WX.HZ[WX.MAP[m].hz], hz = P.hz;
  for (const z of hz) { if (!(z.t - z.w >= H.warn - 1e-9)) ok(false, m + ': a strike without its full warning ' + J(z)); if (z.w < 8 - 1e-9) ok(false, m + ': a strike inside the quiet opening ' + J(z)); }
  let prevW = -1; for (const z of hz) { if (z.w < prevW) ok(false, m + ': plan not sorted by warning time'); prevW = z.w; }
  // every strike has its point mirror (itself, for a strike on the centre line), at most 0.6 s apart
  const twin = z => hz.find(y => y !== z && y.k === z.k && Math.abs(y.w - z.w) <= 0.61 && (
    z.k === 'c' ? near(y.x, 20 - z.x) && near(y.y, 32 - z.y) && y.r === z.r :
    z.k === 'n' ? y.pts.length === z.pts.length && y.pts.every((p, i) => near(p[0], 20 - z.pts[i][0]) && near(p[1], 32 - z.pts[i][1])) && y.e === z.e :
    z.k === 'l' ? y.y === 32 - z.y && y.x0 === 20 - z.x0 && y.x1 === 20 - z.x1 : false));
  const selfMirror = z => (z.k === 'c' && near(z.x, 10) && near(z.y, 16)) || (z.k === 'a' && z.x === 10 && z.y === 16) || z.k === 't' || (z.k === 'l' && z.y === 16);
  for (const z of hz) if (!selfMirror(z) && !twin(z)) ok(false, m + ' seed ' + s + ': a strike without its mirrored twin ' + J(z));
  // alternating sides: strikes on the centre line alternate direction; twins alternate which half is hit first
  const dirs = hz.filter(z => z.k === 't' || (z.k === 'l' && z.y === 16)).map(z => z.k === 't' ? z.dir : Math.sign(z.x1 - z.x0));
  for (let i = 1; i < dirs.length; i++) if (dirs[i] === dirs[i - 1]) ok(false, m + ' seed ' + s + ': two centre-line passes in a row from the same side');
  if (dirs.length) ok(Math.abs(dirs.filter(d => d > 0).length - dirs.filter(d => d < 0).length) <= 1, m + ': centre-line passes split evenly between the two directions');
  if (m === 'classic' || m === 'craters') { const firsts = []; const seen = new Set();
    for (const z of hz) { if (seen.has(z) || selfMirror(z)) continue; const y = twin(z); if (!y) continue; seen.add(z); seen.add(y); if (z.w !== y.w) firsts.push((z.w < y.w ? z : y).y < 16 ? 'N' : 'S'); }
    // within a salvo the same half leads; salvo to salvo the lead alternates: the two halves lead (nearly) equally often
    const nN = firsts.filter(f => f === 'N').length, nS = firsts.length - nN; if (firsts.length) ok(Math.abs(nN - nS) <= 4, m + ' seed ' + s + ': which half is hit first is balanced (N ' + nN + ', S ' + nS + ')'); }
  // the same threat on both halves over the round: footprint-seconds north == south
  let thN = 0, thS = 0;
  for (const z of hz) { if (z.soft) continue;
    if (z.k === 'c') { if (z.y < 16) thN += z.r * z.r; else if (z.y > 16) thS += z.r * z.r; }
    if (z.k === 'l') { if (z.y < 16) thN++; else if (z.y > 16) thS++; }
    if (z.k === 'n') for (let tt = z.t; tt < z.e; tt += 0.5) { const p = SR.wxPos(z, tt); if (p[1] < 16) thN++; else if (p[1] > 16) thS++; } }
  ok(Math.abs(thN - thS) <= 1e-6 * (1 + thN), m + ' seed ' + s + ': both halves are threatened equally (' + thN.toFixed(1) + ' vs ' + thS.toFixed(1) + ')');
  for (const w of P.win) ok(w.t1 > w.t0 && w.t0 >= 8, m + ': a vision window after the quiet opening');
  if (P.vis === 'flare') ok(P.win.length === 1 && near(P.win[0].t1 - P.win[0].t0, 20), m + ': one 20-second flare a round');
  if (P.vis === 'haze') for (const c of P.clouds) ok(hz.some(z => near(z.x, c.x) && near(z.y, c.y) && near(z.t, c.t0)), 'regolith haze only where an impact kicked it up');
}
ok(nPlans > 1000, 'plans compared: ' + nPlans);
console.log('PASS plans: ' + nPlans + ' (6 maps x 3 weather kinds x 14 seeds x 5 round shapes) identical in the phone build and the Worker bundle, mirrored, warned');

// ---- 5. always dodgeable: from anywhere a strike can catch a tank, the slowest tank drives out before it lands ----
{ const speed = W.eval('STAT.speed*Math.min(...CHORDER.map(c=>CH[c].spd))'), slow = W.eval('CRATER_SLOW'), body = W.eval('R*Math.max(...CHORDER.map(c=>CH[c].hb))*0.5'), REACT = 0.35, G = 0.25;
  // travel time over the map's free cells (8-connected, craters at their slow speed), from the safe cells inwards
  const field = (map, danger) => { const g = W.eval(`(()=>{setMap(${J(map)});const o=[];for(let j=0;j<${32 / G};j++){let r='';for(let i=0;i<${20 / G};i++){const x=(i+0.5)*${G},y=(j+0.5)*${G};r+=groundOk(x,y)?(slowAt({x,y,elev:0})<1?'s':'f'):'#';}o.push(r);}return o;})()`);
    const nx = 20 / G, ny = 32 / G, time = new Float64Array(nx * ny).fill(1e9), q = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (g[j][i] !== '#' && !danger((i + 0.5) * G, (j + 0.5) * G)) { time[j * nx + i] = 0; q.push(j * nx + i); }
    for (let h = 0; h < q.length; h++) { const c = q[h], ci = c % nx, cj = (c / nx) | 0;   // Dijkstra-lite (uniform steps; re-queue on improvement)
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= nx || j >= ny || g[j][i] === '#') continue;
        if (di && dj && (g[cj][i] === '#' || g[j][ci] === '#')) continue;
        const dt = Math.hypot(di, dj) * G / (speed * (g[j][i] === 's' ? slow : 1)), t = time[c] + dt; if (t < time[j * nx + i] - 1e-9) { time[j * nx + i] = t; q.push(j * nx + i); } } }
    let worst = 0, at = null, stuck = 0; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (g[j][i] !== '#' && danger((i + 0.5) * G, (j + 0.5) * G)) { const t = time[j * nx + i]; if (t >= 1e9) stuck++; else if (t > worst) { worst = t; at = [(i + 0.5) * G, (j + 0.5) * G]; } }
    return { worst, at, stuck }; };
  const report = [];
  const check = (map, name, warn, danger) => { const f = field(map, danger), budget = warn - REACT; report.push(name + ' ' + f.worst.toFixed(2) + ' s of ' + warn + ' s');
    ok(f.stuck === 0 && f.worst <= budget, map + ' ' + name + ': the slowest tank (Titan, no engine upgrades, no dash) drives out in ' + f.worst.toFixed(2) + ' s, warning ' + warn + ' s minus ' + REACT + ' s to react' + (f.stuck ? ' (' + f.stuck + ' cells with no way out)' : '') + ' worst spot ' + J(f.at)); };
  { const H = WX.HZ.meteor; let worst = null;   // every meteor of 40 hazard matches
    for (const s of seedsOf(2, 40)) for (const z of SR.wxPlan(s, 'classic', 0, 180).hz) { const f = field('classic', (x, y) => SR.wxIn(z, z.t, x, y, body)); if (!worst || f.worst > worst.worst || f.stuck) worst = f; if (f.stuck) break; }
    report.push('meteor ' + worst.worst.toFixed(2) + ' s of ' + H.warn + ' s'); ok(worst.stuck === 0 && worst.worst <= H.warn - REACT, 'Moonbase meteors: the slowest tank is clear of any landing spot in ' + worst.worst.toFixed(2) + ' s (warning ' + H.warn + ' s)'); }
  for (const z of SR.wxPlan(seedOf(2), 'craters', 0, 180).hz.slice(0, 6)) check('craters', 'vent(' + z.x + ',' + z.y + ')', WX.HZ.vent.warn, (x, y) => SR.wxIn(z, z.t, x, y, body));
  { const z = SR.wxPlan(seedOf(2), 'longshot', 0, 180).hz[0]; check('longshot', 'pylon arc', WX.HZ.arc.warn, (x, y) => SR.wxIn(z, z.t, x, y, body)); }
  for (const y0 of SR.WX_ROWS) { const z = { k: 'l', y: y0, r: WX.HZ.laser.r }; check('bunker', 'laser row ' + y0, WX.HZ.laser.warn, (x, y) => Math.abs(y - z.y) < z.r + body); }
  { const dk = W.eval('MAPS.overpass.bridge.deck'), R0 = W.eval('R'), H = WX.HZ.train, strip = dk[3] / 2 - R0 - (H.hw + body);
    ok(strip > 0.1, 'Overpass train: a tank at the railing is clear of it (' + strip.toFixed(2) + ' of room past the widest body), and the tunnels and ramps are never touched');
    ok((H.hw + body + 0.2) / speed <= H.warn - REACT, 'Overpass train: the railing is ' + ((H.hw + body + 0.2) / speed).toFixed(2) + ' s away from the middle of the rail (warning ' + H.warn + ' s)'); report.push('train ' + ((H.hw + body + 0.2) / speed).toFixed(2) + ' s of ' + H.warn + ' s'); }
  { const H = WX.HZ.tornado; ok(H.v < speed * slow * 0.8, 'Canyon tornadoes are slower (' + H.v + ') than the slowest tank in scree (' + (speed * slow).toFixed(2) + '): always outrun'); ok(H.warn >= 2.5, 'a tornado forms for ' + H.warn + ' s before it can touch anything'); report.push('tornado speed ' + H.v + ' vs slowest tank ' + (speed * slow).toFixed(2)); }
  console.log('PASS dodgeable (slowest tank, no dash, 0.35 s reaction): ' + report.join('; '));
}

// ---- 6. no one-shots (every chassis, every mode's hull scale) ----
{ const worst = W.eval(`(()=>{let w=0,at='';for(const c of CHORDER)for(const hs of [1,2,3,ROYALE_HP,BTY_HP,2*BTY_HP,3*BTY_HP,BOSS_HP])for(const k of Object.keys(WX_HZ)){const mhp=Math.round(STAT.hp*CH[c].hp*hs),d=Math.min(WX_HZ[k].dmg*hs,WX_CAP*mhp)/mhp;if(d>w){w=d;at=k+' '+c+' x'+hs;}}return [w,at];})()`);
  ok(WX.CAP <= 0.34 && worst[0] <= WX.CAP + 1e-9, 'a hazard hit takes at most ' + (worst[0] * 100).toFixed(1) + '% of a full stock hull (' + worst[1] + '), never above the ' + WX.CAP * 100 + '% cap'); }

// ---- 7. kill credit, takedowns, no new points (one scripted strike on each map) ----
const scene = (map, g, body) => W.eval(`(()=>{__seed(11);__events=[];setMap(${J(map)});matchG=${J(g)};battleLoadout=${J(GEAR.stock)};battlePower=powerOf(battleLoadout);battleLg=0;
 MM={n:1,series:false,mp:50,cp:false,wx:${seedOf(2)},wxc:false};populatePreparedMatch();startMatch();
 const me=units[0],foe=units[1],z=wx.P.hz[0],tau=z.t+(z.k==='c'||z.k==='a'?0.01:0.5),at=z.k==='c'?[z.x,z.y]:z.k==='a'?[10,13]:z.k==='t'?[10,16]:wxPos(z,tau);
 const place=u=>{u.x=at[0];u.y=at[1];u.elev=z.k==='t'?1:0;u.hzT=0;};
 const strike=()=>{elapsed=tau;simT=tau;weatherTick(0.05);};
 const evs=k=>__events.filter(e=>e[0]===k);
 me.x=1.2;me.y=30.8;me.hzT=0;
 ${body}})()`);
for (const map of MAPS6) {
  const hz = WX.MAP[map].hz;
  // lethal, with a recent attacker: a normal kill for the attacker, and their takedown
  const a = scene(map, 'bounty', `place(foe);simT=tau-2;takeHit(foe,10,me,null,0);foe.hp=20;const g0=gscore[0],b0=me.bty;strike();const k=evs('k')[0];
   return {dead:foe.hp<=0,src:k?k[2]:null,why:k?k[3]:null,kills:me.st.kills,td:me.st.td,stars:gscore[0]-g0,st:me.st.stars,bty:me.bty-b0,dmg:me.st.dmg,sp:me.sp,D:evs('D').length};`);
  const n = scene(map, 'bounty', `foe.hp=20;const g0=gscore[0],b0=me.bty;takeHit(foe,9999,me,null,0);const k=evs('k')[0];return {kills:me.st.kills,stars:gscore[0]-g0,st:me.st.stars,bty:me.bty-b0};`);
  ok(a.dead && a.src === 0 && a.why === hz && a.kills === 1 && a.td === 1 && a.D === 1, map + ' ' + hz + ': a hazard that finishes a tank you hit 2 s ago is your kill and your takedown ' + J(a));
  ok(a.stars === n.stars && a.st === n.st && a.bty === n.bty && a.kills === n.kills, map + ': a hazard kill pays exactly what a normal kill pays (stars ' + a.stars + '/' + n.stars + ', bounty +' + a.bty + '/+' + n.bty + ')');
  ok(a.dmg === 0, map + ': hazard damage is never counted as your damage (the proof-of-play check compares yours with the hull the enemies lost)');
  // lethal, last hit 6 s ago: nobody's kill
  const b = scene(map, 'bounty', `place(foe);simT=tau-${WX.CREDIT + 1};takeHit(foe,10,me,null,0);foe.hp=20;const g0=gscore[0];strike();const k=evs('k')[0];return {dead:foe.hp<=0,src:k?k[2]:null,kills:me.st.kills,td:me.st.td,stars:gscore[0]-g0};`);
  ok(b.dead && b.src === -1 && b.kills === 0 && b.td === 0 && b.stars === 0, map + ': hit more than ' + WX.CREDIT + ' s ago: the hazard kill is nobody\'s ' + J(b));
  // not lethal: an assist is a takedown, never a kill; never a one-shot; the super bar is not charged by it
  const c = scene(map, 'bounty', `place(foe);simT=tau-4.9;takeHit(foe,10,me,null,0);const sp0=me.sp,h0=foe.hp;strike();return {lost:(h0-foe.hp)/foe.mhp,kills:me.st.kills,td:me.st.td,sp:me.sp-sp0,alive:foe.hp>0};`);
  ok(c.alive && c.td === 1 && c.kills === 0 && c.lost > 0.02 && c.lost <= WX.CAP + 1e-9, map + ': an enemy you hit 4.9 s ago takes the hazard: a takedown, ' + (c.lost * 100).toFixed(1) + '% of its hull, no kill');
  ok(c.sp === 0, map + ': a credited hazard hit does not charge the super');
  // from a full hull it never kills; nobody recent: no takedown
  const d = scene(map, 'bounty', `place(foe);const h0=foe.hp;strike();return {full:h0===foe.mhp,alive:foe.hp>0,td:me.st.td,hit:foe.hp<h0};`);
  ok(d.full && d.alive && d.hit && d.td === 0, map + ': a full hull survives a hazard hit; nobody had hit it: no takedown');
  // the same strike never counts twice on one tank; a spawn-safe tank and the megatank are not touched
  const e = scene(map, 'bounty', `place(foe);simT=tau-1;takeHit(foe,10,me,null,0);strike();const td1=me.st.td;elapsed=tau+0.05;simT=tau+0.05;weatherTick(0.05);return {td1,td2:me.st.td};`);
  ok(e.td1 === 1 && e.td2 === 1, map + ': one strike, one takedown');
  const f = scene(map, 'bounty', `place(foe);foe.hzT=1;const h0=foe.hp;strike();return foe.hp===h0;`);
  ok(f === true, map + ': a tank that has just spawned is not touched (' + WX.SAFE + ' s)');
  const gB = scene(map, 'boss', `const b=units.find(u=>u.boss);place(b);const h0=b.hp;strike();return b.hp===h0;`);
  ok(gB === true, map + ': the megatank is not a hazard target (no takedown farming on it)');
  // your own team's hazard hit is nobody's takedown; you can be the victim
  const v = scene(map, 'bounty', `place(me);simT=tau-1;takeHit(me,10,foe,null,0);const h0=me.hp;strike();return {lost:h0-me.hp,foeKills:foe.st?foe.st.kills:0};`);
  ok(v.lost > 0, map + ': the hazard hits you exactly as it hits them');
}
// the train only on the deck; tunnels and ramps safe. Meteors, arcs, lasers do not reach under a deck
{ const t1 = scene('overpass', 'bounty', `const h0=foe.hp;foe.x=7;foe.y=16;foe.elev=0;foe.hzT=0;strike();const tun=foe.hp===h0;foe.x=4.25;foe.y=12;foe.elev=1;strike();return [tun,foe.hp===h0];`);
  ok(t1[0] && t1[1], 'Overpass: a tank in a tunnel or on a ramp is never hit by the train'); }
{ const t2 = scene('canyon', 'bounty', `const z2=wx.P.hz[0],p=wxPos(z2,tau),h0=foe.hp;foe.x=p[0];foe.y=p[1];foe.elev=1;foe.hzT=0;strike();return foe.hp===h0;`);
  ok(t2 === true, 'Canyon: a tornado does not reach a tank up on the mesa'); }
// points: the takedown count never changes a match's pay, the daily cap, quests or pass XP
{ const r = W.eval(`(()=>{const mk=()=>{const S={};ecoNorm(S);return S;},X={day:20000,week:2857,pk:'t',rnd:()=>0.5};const A=mk(),B=mk();const o={won:true,drawn:false,place:0,top3:false,g:'bounty',m:'1v1',feat:false,series:false,quick:false,map:'longshot'};
  const pa=ecoMatchPts(A,o,2,X),pb=ecoMatchPts(B,o,2,X);const st={dmg:900,sup:1,box:1,kills:3,caps:0,cry:0,stars:6,low:0.5};
  ecoAfterMatch(A,{...o,streak:A.streak,st:{...st,td:0}},X);ecoAfterMatch(B,{...o,streak:B.streak,st:{...st,td:7}},X);
  const hzB=B.hz;delete A.hz;delete B.hz;return {same:JSON.stringify(A)===JSON.stringify(B),pa:pa.pts,pb:pb.pts,hz:hzB,cap:DAILY_CAP};})()`);
  ok(r.same && r.pa === r.pb, 'no new points source: seven takedowns change nothing on the record but the takedown counter (pay ' + r.pa + ' = ' + r.pb + ')');
  ok(J(r.hz) === J({ longshot: 7 }) && r.cap === 50000, 'takedowns are counted per map; the daily cap is 50,000'); }
console.log('PASS kill credit, takedowns, level rules, no new points: scripted strikes on six maps');

// ---- 9a. finishes: 25 takedowns on a map unlock that map's finish; the LIVE versions cannot be bought ----
{ const r = W.eval(`(()=>{const S={};ecoNorm(S);const X={day:20000,week:2857,pk:'t',rnd:()=>0.5},o={won:false,drawn:false,place:0,top3:false,g:'arena',m:'2v2',feat:false,series:false,quick:false};const log=[];
  for(const m of MAP_REAL){for(let i=0;i<24;i++)ecoHazard(S,m,1);log.push([m,S.hz[m],!!S.paints[WX_MAP[m].fin]]);ecoHazard(S,m,1);log.push([m,S.hz[m],!!S.paints[WX_MAP[m].fin]]);}
  const fins=MAP_REAL.map(m=>WX_MAP[m].fin),live=Object.keys(PAINTS).filter(k=>PAINTS[k].only==='soon');
  ecoHazard(S,'nomap',5);ecoHazard(S,'classic',-3);ecoHazard(S,'classic','x');
  return {log,fins,names:fins.map(f=>PAINTS[f].n),hz:fins.map(f=>PAINTS[f].hz),live,liveOf:live.map(k=>PAINTS[k].live),
   price:live.map(k=>ecoPrice(S,{kind:'paint',id:k},X)),priceF:fins.map(k=>ecoPrice(S,{kind:'paint',id:k},X)),
   buy:live.map(k=>{const T=JSON.parse(JSON.stringify(S));try{ecoGrant(T,{kind:'paint',id:k},X);}catch(e){}return !!T.paints[k];}),
   soon:live.map(k=>PAINTS[k].soon),sale:live.concat(fins).filter(k=>PAINTS[k].stars!==undefined||PAINTS[k].ton!==undefined),c24:S.hz.classic,N:WX_FINISH_N,bots:BOT_PAINTS.filter(p=>PAINTS[p].only)};})()`);
  ok(r.N === 25, 'the finish needs 25 takedowns (owner: fixed)');
  for (let i = 0; i < r.log.length; i += 2) ok(r.log[i][1] === 24 && r.log[i][2] === false && r.log[i + 1][1] === 25 && r.log[i + 1][2] === true, r.log[i][0] + ': 24 takedowns do not unlock the finish, the 25th does');
  ok(new Set(r.fins).size === 6 && J(r.hz) === J(MAPS6), 'six finishes, one per map: ' + r.names.join(', '));
  ok(r.c24 === 25, 'a made-up map or a negative count changes nothing');
  ok(r.live.length === 6 && J(r.liveOf.slice().sort()) === J(r.fins.slice().sort()), 'six LIVE (animated) store entries, one per finish');
  ok(r.price.every(p => p === null) && r.priceF.every(p => p === null) && r.buy.every(b => b === false) && r.sale.length === 0, 'neither the finishes nor their LIVE versions have a price the shop or the server can charge: checkout is off in every currency');
  ok(r.soon.every(p => p && p.ton > 0 && p.stars > 0), 'every LIVE entry carries its PROPOSED price for the owner (TON and Stars): ' + J(r.soon[0]));
  ok(r.bots.length === 0, 'AI pilots never wear an earned or unreleased finish');
}

// ---- 3b + 8. seeded matches: the Worker bundle and the phone build agree hit for hit; the AI obeys the same rules ----
const phoneApi = (() => { const ctx = vm.createContext({ console }); vm.runInContext('globalThis.mk=function(HOST){"use strict";\n' + src('js/rules.js') + src('js/game.js') + src('worker/sim-api.js') + '}', ctx); return ctx.mk; })();
const STOCK_L = SR.STOCK_L;
function room(make, cfg) {   // one live room's match, both pilots flown by the sim (the AI takes a dropped pilot's tank)
  const log = []; let done = null, rounds = 0, tick = 0;
  const sim = make({ seed: cfg.seed, ev: a => { if ('hkDew'.includes(a[0])) log.push([tick].concat(a.map(v => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))); }, end: f => { done = f || {}; }, round: () => { rounds++; }, death() {} });
  sim.setup({ map: cfg.map, g: cfg.g, m: cfg.m, series: !!cfg.series, seats: Array.from({ length: cfg.seats }, (_, i) => ({ pid: 'p' + i, name: 'P' + i, L: STOCK_L })), ghosts: [], lg: 2, wx: cfg.wx, wxc: !!cfg.wxc });
  for (const u of sim.units) sim.setCtl(u, 'bot');
  sim.start();
  for (; tick < 30 * 400 && !done; tick++) { if (sim.state === 'round') { sim.startRound(); for (const u of sim.units) sim.setCtl(u, 'bot'); } sim.step(1 / 30); }
  return { log, done: !!done, rounds, wx: sim.wx ? { k: sim.wx.P.k, haz: sim.wx.P.haz, vis: sim.wx.P.vis } : null,
    units: sim.units.map(u => [Math.round(u.hp), u.st ? u.st.kills : 0, u.st ? u.st.td : 0, u.deaths || 0, Math.round(u.x * 100), Math.round(u.y * 100)]), out: sim.units.map(u => sim.outcome(u, done && (done.series || done.won !== undefined) ? done : undefined)) };
}
{ let n = 0, hits = 0, kills = 0, tds = 0, flares = 0, drops = 0, team = 0; const perMap = {};
  const hzSeeds = seedsOf(3, 3).concat(seedsOf(2, 2)).concat(seedsOf(1, 1));
  for (const map of MAPS6) for (const [g, m, seats, series] of [['arena', '1v1', 2, true], ['zone', '2v2', 4, false], ['bounty', '1v1', 2, false]]) for (const [i, wxs] of hzSeeds.entries()) {
    const cfg = { seed: 900 + i * 13, map, g, m, seats, series, wx: wxs };
    const A = room(createSim, cfg), B = room(phoneApi, cfg); n++;
    if (J(A) !== J(B)) { ok(false, map + ' ' + g + ' ' + m + ' wx ' + wxs + ': the Worker bundle and the phone build disagree (' + A.log.length + ' vs ' + B.log.length + ' hazard/kill events)'); continue; }
    ok(A.done, map + ' ' + g + ': the seeded room match ends');
    const P = SR.wxPlan(wxs, map, 0, 180), isFlare = A.log.filter(e => e[1] === 'e' && e[2] === 'flare').length;
    ok(!A.log.some(e => e[1] === 'e' && e[2] === 'meteor'), 'no meteor event in any match'); flares += isFlare;
    ok(isFlare === 0 || ['overpass', 'longshot'].includes(map), map + ': a solar flare only on Overpass and Longshot');
    if (!series) { team++; drops += A.log.filter(e => e[1] === 'e' && e[2] === 'drop').length; }
    const h3 = A.log.filter(e => e[1] === 'h' && e[4] === 3); hits += h3.length; kills += A.log.filter(e => e[1] === 'k' && WX.HZ[e[4]]).length; tds += A.log.filter(e => e[1] === 'D').length;
    perMap[map] = (perMap[map] || 0) + h3.length;
    if (!P.haz) ok(h3.length === 0, map + ': no hazard damage in a match whose roll has no hazard (' + J(A.wx) + ')');
    // every hazard hit sits on a strike of the plan, after that strike's warning (rounds restart the plan: check single-round modes)
    if (!series && P.haz) for (const e of h3) { const t = e[0] / 30; if (!P.hz.some(z => !z.soft && t >= z.t - 0.05 && t <= SR.wxEnd(z) + 0.1)) ok(false, map + ': a hazard hit at ' + t.toFixed(2) + ' s with no strike of the plan live'); }
  }
  ok(n === 108, 'seeded room matches through both builds: ' + n);
  ok(hits > 150 && kills > 0 && tds > 20, 'hazards land, finish tanks and are credited in live rooms (' + hits + ' hits, ' + kills + ' hazard kills, ' + tds + ' takedowns)');
  for (const m of MAPS6) ok(perMap[m] > 0, m + ': its hazard hit a tank in the seeded rooms (' + perMap[m] + ' hits)');
  ok(flares > 0, 'the solar flare happens (as weather) on Overpass / Longshot: ' + flares);
  ok(drops > 0 && drops < team, 'the supply drop still happens in some team matches, not all (' + drops + ' of ' + team + ')');
  console.log('PASS PvP sync: ' + n + ' seeded live-room matches, Worker bundle == phone build event for event (' + hits + ' hazard hits, ' + kills + ' hazard kills, ' + tds + ' takedowns); hits per map ' + J(perMap));
}
// the flare: supers charge twice as fast only while it is on; sight is cut for everyone the same
{ const s1 = seedOf(1), r = W.eval(`(()=>{__seed(3);setMap('longshot');matchG='bounty';battleLoadout=${J(GEAR.stock)};battlePower=powerOf(battleLoadout);battleLg=0;MM={n:1,series:false,mp:50,cp:false,wx:${s1},wxc:false};populatePreparedMatch();startMatch();
  const w=wx.P.win[0],me=units[0],foe=units[1];const out={};elapsed=w.t0-1;out.before=flareMult();elapsed=w.t0+1;out.during=flareMult();elapsed=w.t1+0.1;out.after=flareMult();
  elapsed=w.t0+1;me.x=10;me.y=26;foe.x=10;foe.y=26-${WX.VIS.flare.r}-0.3;foe.elev=0;me.elev=0;out.far=[wxSees(me,foe),wxSees(foe,me)];foe.y=26-${WX.VIS.flare.r}+0.3;out.near=[wxSees(me,foe),wxSees(foe,me)];
  elapsed=w.t1+0.1;foe.y=26-5.5;out.clear=[wxSees(me,foe),wxSees(foe,me)];return out;})()`);
  ok(r.before === 1 && r.during === 2 && r.after === 1, 'solar flare: supers charge twice as fast while it is on, and only then');
  ok(J(r.far) === J([false, false]) && J(r.near) === J([true, true]) && J(r.clear) === J([true, true]), 'glare cuts sight to ' + WX.VIS.flare.r + ' for the pilot and the AI alike'); }
{ const s1 = seedOf(1), r = W.eval(`(()=>{__seed(3);setMap('craters');matchG='bounty';battleLoadout=${J(GEAR.stock)};battlePower=powerOf(battleLoadout);battleLg=0;MM={n:1,series:false,mp:50,cp:false,wx:${s1},wxc:false};populatePreparedMatch();startMatch();
  const me=units[0],foe=units[1];elapsed=20;me.x=10;me.y=22;foe.x=10;foe.y=17;const inCloud=[wxSees(me,foe),wxSees(foe,me)];foe.x=4;foe.y=26;me.x=8;me.y=26;const open=[wxSees(me,foe),wxSees(foe,me)];
  // an AI turret obeys it: a foe hidden in the steam is not locked on or fired at
  me.x=10;me.y=22;foe.x=10;foe.y=17;foe.lk=null;foe.cd=0;foe.ang=Math.PI/2;const b0=bullets.length;turret(foe,0.05);const fired=bullets.length-b0,lk=foe.lk;return {inCloud,open,fired,lk};})()`);
  ok(J(r.inCloud) === J([false, false]) && J(r.open) === J([true, true]), 'vent steam hides a tank from 5 away and blinds it the same; open ground is unaffected');
  ok(r.fired === 0 && r.lk === null, 'an AI turret cannot lock on or fire at a tank it cannot see through the steam'); }
// the AI and the hazards: it is hit like anyone (it reads the warning only LG_AI_HZ of the time), and never perfectly safe
{ const lg = W.eval('LG_AI_HZ'); ok(lg.length === 7 && lg.every((v, i) => v > 0 && v < 1 && (i === 0 || v >= lg[i - 1])), 'the AI reads a hazard warning by league, never always (' + lg.join(', ') + ')');
  ok(W.eval('HZ_REACT') >= 0.3, 'the AI needs a reaction time before it moves'); }

// ---- 9b. AI matches end to end: the server seeds the weather, the phone plays it, the server counts from the record ----
const env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' }, U = { id: 4242, first_name: 'Wx' }, pid = 'tg_4242', E = () => db.get('/eco/' + pid);
let now = Date.now();
const startT = async (o) => (await eco.matchStart(env, Object.assign({ g: 'bounty', m: '1v1', map: 'longshot', L: STOCK_L, pv: 1 }, o), U, pid, now)).body;
{ // the first three matches are clear, whatever the phone would like
  const t0 = await startT({ cid: 'a'.repeat(16) });
  ok(t0.ok && Array.isArray(t0.wx) && Number.isInteger(t0.wx[0]) && t0.wx[1] === 1, 'a new pilot\'s ticket carries a weather seed and the clear flag ' + J(t0.wx));
  const again = await startT({ cid: 'a'.repeat(16) });
  ok(again.same && J(again.wx) === J(t0.wx), 'asking again for the same match gets the same weather (no re-rolling a ticket)');
  db.root.eco[pid].mp = 40;   // a pilot past their first matches
}
let simTd = 0, srvTd = 0, played = 0, hzMatches = 0, forged = 0;
for (let i = 0; i < 40 && hzMatches < 6; i++) {
  now += 400000;
  const cid = (i + 1).toString(16).padStart(16, '0'), T = await startT({ cid });
  ok(T.ok && T.wx[1] === 0, 'ticket ' + i + ' with weather');
  const roll = SR.wxRoll(T.wx[0]); if (!roll.haz) { await eco.matchEnd(env, { tok: T.tok, r: { quit: true } }, U, pid, now + 5000); continue; }
  const r = W.run({ g: 'bounty', m: '1v1', map: 'longshot', seed: 50 + i, mp: 40, L: T.L, lg: 0, dt: 1 / 30, wx: T.wx[0] });
  const res = { won: r.won, drawn: r.drawn, place: 0, pf: r.pf, wxs: T.wx[0], stats: { dmg: r.st.dmg, kills: r.st.kills, box: r.st.box, sup: r.st.sup, low: r.st.low, td: r.td } };
  const before = (E().hz || {}).longshot || 0;
  // the same record, three lies first (each on its own copy of the ticket is not possible: check the proof layer directly)
  const cBase = { g: 'bounty', m: '1v1', map: 'longshot', secs: r.secs + 6, won: r.won, drawn: r.drawn, place: 0, series: false, min: 10, spdM: r.spdM, hs: SR.BTY_HP, st: { ...res.stats, td: 50 } };
  const good = checkProof(r.pf, { ...cBase, wx: { seed: T.wx[0], clear: false } }), noSeed = checkProof(r.pf, { ...cBase, wx: null }), clear = checkProof(r.pf, { ...cBase, wx: { seed: T.wx[0], clear: true } });
  ok(good.ok && noSeed.ok && noSeed.fix.td === 0 && clear.fix.td === 0, 'a record without the server\'s seed, or from a clear match, shows no takedowns (claimed 50)');
  ok(good.fix.td <= r.td + 1, 'claiming 50 takedowns gets only what the record shows (' + good.fix.td + ', the sim counted ' + r.td + ')'); if (good.fix.td > r.td) forged += good.fix.td - r.td;
  const out = (await eco.matchEnd(env, { tok: T.tok, r: res }, U, pid, now + (r.secs + 6) * 1000)).body;
  ok(out.ok, 'the weather match is scored ' + J(out).slice(0, 90));
  const got = ((E().hz || {}).longshot || 0) - before; played++; hzMatches++; simTd += r.td; srvTd += got;
  ok(got <= r.td, 'the server never counts more takedowns than the phone\'s sim saw (' + got + ' of ' + r.td + ')');
}
ok(hzMatches === 6 && simTd >= 3, 'six hazard matches played through tickets (sim takedowns ' + simTd + ')');
ok(srvTd >= simTd * 0.6, 'the record check finds most real takedowns (' + srvTd + ' of ' + simTd + ' counted on the server)');
ok(forged <= 1, 'a forged claim of 50 a match gains at most ' + forged + ' takedown over six matches');
{ // a result that says it played another seed, or carries no record, counts nothing; the points are the usual ones
  now += 400000; const T = await startT({ cid: 'f'.repeat(16) }), before = (E().hz || {}).longshot || 0;
  const r = W.run({ g: 'bounty', m: '1v1', map: 'longshot', seed: 7, mp: 40, L: T.L, lg: 0, dt: 1 / 30, wx: seedOf(3) });
  const out = (await eco.matchEnd(env, { tok: T.tok, r: { won: r.won, drawn: r.drawn, place: 0, pf: r.pf, wxs: seedOf(3), stats: { dmg: r.st.dmg, kills: r.st.kills, box: r.st.box, sup: r.st.sup, low: r.st.low, td: 40 } } }, U, pid, now + (r.secs + 6) * 1000)).body;
  ok(out.ok && ((E().hz || {}).longshot || 0) === before, 'a match played on a weather seed the server did not give counts no takedowns (claimed 40)');
  ok(!('hz' in out.res) && out.res.pts > 0, 'takedowns are not part of a match\'s pay');
}
{ // the phone gets its counters with every reply; 25 unlock the finish on the server's record
  const S = E(); ok(S.hz && typeof S.hz.longshot === 'number', 'the server record holds the per-map takedown counters ' + J(S.hz));
  db.root.eco[pid].hz = { longshot: 24 }; now += 400000;
  let unlocked = false;
  for (let i = 0; i < 60 && !unlocked; i++) { now += 400000; const T = await startT({ cid: (0x900 + i).toString(16).padStart(16, '0') });
    if (!SR.wxRoll(T.wx[0]).haz) { await eco.matchEnd(env, { tok: T.tok, r: { quit: true } }, U, pid, now + 5000); continue; }
    const r = W.run({ g: 'bounty', m: '1v1', map: 'longshot', seed: 300 + i, mp: 40, L: T.L, lg: 0, dt: 1 / 30, wx: T.wx[0] });
    const out = (await eco.matchEnd(env, { tok: T.tok, r: { won: r.won, drawn: r.drawn, place: 0, pf: r.pf, wxs: T.wx[0], stats: { dmg: r.st.dmg, kills: r.st.kills, box: r.st.box, sup: r.st.sup, low: r.st.low, td: r.td } } }, U, pid, now + (r.secs + 6) * 1000)).body;
    if (out.E && out.E.hz && out.E.hz.longshot >= 25) { unlocked = true; ok(out.E.paints && out.E.paints.arc === 1, 'the 25th verified takedown on Longshot unlocks Arc Charge, and the reply tells the phone ' + J(out.E.hz)); } }
  ok(unlocked, 'the finish unlocks from server-verified AI matches'); }
console.log('PASS server-verified takedowns: ' + played + ' ticketed AI matches, the server counted ' + srvTd + ' of the sim\'s ' + simTd + ' takedowns, a claim of 50 a match gained ' + forged + ' in all');

console.log(fails.length ? 'FAILED ' + fails.length + ' of ' + checks : 'PASS arcade weather: ' + checks + ' checks');
process.exit(fails.length ? 1 : 0);
