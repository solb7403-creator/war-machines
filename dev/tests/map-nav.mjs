// AI navigation on every map, headless (real rules.js + game.js + match.js through combat-sim's world):
// every mode x team size x map, N seeds. Per map: matches that finish, tanks found inside solids, "stuck" seconds
// (an AI tank with somewhere to go that barely moves for a whole second), share of tank time on high ground (bridge/mesa maps) and sim cost.
// usage: node dev/tests/map-nav.mjs [seeds=3] [map...]      Fails if a new map is clearly worse than the originals.
import assert from 'node:assert/strict';
import { makeWorld, GEAR } from './combat-sim.mjs';
const args = process.argv.slice(2), seeds = +(args.find(a => /^\d+$/.test(a)) || 3);
const W = makeWorld();
W.eval(`function __nav(cfg){
 __seed(cfg.seed);setMap(cfg.map);matchG=cfg.g;battleLoadout=JSON.parse(JSON.stringify(cfg.L));battlePower=powerOf(battleLoadout);
 const mk=cfg.g==='royale'?'1v1':cfg.m;MM={n:MODES[mk].n,series:false,mp:50,cp:false};save.mp=50;
 populatePreparedMatch();me.ctl='pilot';me.hum=true;me.pid='me';me.brain=newBrain();me.strafe=1;me.strafeT=1.5;startMatch();
 const DT=1/30,last=new Map();let t=0,stuck=0,inside=0,deck=0,unitT=0,samples=0;
 while(state==='play'&&t<200){
  if(me.hp>0)botAI(DT,me);update(DT);t+=DT;__events.length=0;
  for(const u of units){if(u.hp<=0||u.boss)continue;unitT+=DT;if(u.elev===1)deck+=DT;
   if((u.elev||0)===0&&walls.some(([x,y,w,h])=>u.x>x+0.05&&u.x<x+w-0.05&&u.y>y+0.05&&u.y<y+h-0.05))inside++;
   if((u.elev||0)===0&&rocks.some(([x,y,r])=>Math.hypot(u.x-x,u.y-y)<r-0.05))inside++;}
  if(Math.abs(t-Math.round(t))<DT/2){   // once a second
   for(const u of units){if(u.boss)continue;const p=last.get(u);last.set(u,{x:u.x,y:u.y,hp:u.hp});
    if(!p||u.hp<=0||p.hp<=0)continue;samples++;
    const f=u.focus&&u.focus.hp>0?u.focus:nearestFoe(u),b=u.brain||{};
    const waiting=b.spot&&!b.out&&Math.hypot(u.x-b.spot.x,u.y-b.spot.y)<0.9;
    const busy=f&&Math.hypot(f.x-u.x,f.y-u.y)<STAT.range+0.5&&los(u,f);   // in a firefight a tank may hold still
    const parked=(u.cry||0)>0||(gzones&&Math.hypot(u.x-gzones[0].x,u.y-gzones[0].y)<gzones[0].r);   // holding the zone or a crystal stash
    if(!waiting&&!busy&&!parked&&Math.hypot(u.x-p.x,u.y-p.y)<0.3)stuck++;}
  }
 }
 return {done:state!=='play',t,stuck,inside,deck,unitT,samples};
}`);
const MODES = [['arena', '1v1'], ['arena', '3v3'], ['zone', '2v2'], ['zone', '3v3'], ['crystal', '3v3'], ['bounty', '3v3'], ['royale', '1v1'], ['boss', '2v2']];
const maps = args.filter(a => !/^\d+$/.test(a)).length ? args.filter(a => !/^\d+$/.test(a)) : W.eval('MAP_REAL');
const rows = {};
for (const map of maps) {
  const r = { n: 0, done: 0, stuck: 0, inside: 0, samples: 0, deck: 0, unitT: 0, ms: 0, simT: 0 };
  for (const [g, m] of MODES) for (let s = 1; s <= seeds; s++) {
    const t0 = performance.now(), o = W.eval('__nav(' + JSON.stringify({ g, m, map, seed: 900 + s * 7919, L: GEAR.rare }) + ')');
    r.ms += performance.now() - t0; r.simT += o.t; r.n++; r.done += o.done ? 1 : 0; r.stuck += o.stuck; r.inside += o.inside; r.samples += o.samples;
    r.deck += o.deck; r.unitT += o.unitT;
  }
  rows[map] = { matches: r.n, finished: r.done, stuckPct: +(100 * r.stuck / Math.max(1, r.samples)).toFixed(2), insideSolid: r.inside, highGroundPct: +(100 * r.deck / Math.max(1, r.unitT)).toFixed(1), msPerSimSec: +(r.ms / r.simT).toFixed(2) };
  console.log(map.padEnd(9), JSON.stringify(rows[map]));
}
const base = ['classic', 'overpass', 'longshot', 'craters'].filter(m => rows[m]);
const worst = base.length ? Math.max(...base.map(m => rows[m].stuckPct)) : 3;
for (const m of Object.keys(rows)) {
  assert.equal(rows[m].insideSolid, 0, m + ': tanks inside solids');
  if (!base.includes(m)) assert.ok(rows[m].stuckPct <= Math.max(worst * 1.5, 1.5), m + ': AI stuck ' + rows[m].stuckPct + '% (originals up to ' + worst + '%)');
}
console.log('map navigation ok');
