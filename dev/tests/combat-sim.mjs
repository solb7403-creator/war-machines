// Deterministic AI-match simulator built on the REAL phone code: js/rules.js + js/game.js + js/match.js
// (populatePreparedMatch, fairField, placeGhosts, mkBot, mkBoss, mkGhost, botAI, best of 3...), run in a vm realm whose
// Math.random and the sim's random() are one seeded stream. The player's tank is flown by the game's own botAI as a
// stand-in "decent pilot" (it keeps the human advantages the phone gives a person: always-aware turret, boss priority).
// Nothing here talks to a server, a database or a save.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const srcRoot = process.env.COMBAT_SRC || repo;   // COMBAT_SRC: another checkout (e.g. the code before a change) to compare
const src = f => fs.readFileSync(path.join(srcRoot, f), 'utf8');

const DRIVER = `
var __rng=null,__events=[],__ended=null,__round=0;
const HOST={random:()=>__rng(),ev:a=>{__events.push(a);},end:f=>{__ended=f||{};},round:()=>{__round++;},death(){}};
const inputVec=()=>[0,0];
var save={mp:50},IN_TG=false,SRV_ECO=false,lastQuick=false;
`;
const RUN = `
var __casual=false,__aiLevel;
{const bd=botDodge;botDodge=function(u){if(__casual&&u===me)return;return bd(u);};}   // a casual pilot never reflex-dodges a super
function __seed(s){__rng=rng32(s);Math.random=rng32((s*2654435761)>>>0);}
function __run(cfg){
 __seed(cfg.seed);__events=[];__ended=null;__round=0;
 setMap(cfg.map);matchG=cfg.g;
 battleLoadout=JSON.parse(JSON.stringify(cfg.L));battlePower=powerOf(battleLoadout);
 const mk=cfg.g==='royale'?'1v1':cfg.m;
 MM={n:MODES[mk].n,series:cfg.g==='arena'&&mk==='1v1'&&cfg.mp>0,mp:cfg.mp,cp:(battleLoadout.chs||[battleLoadout.c]).length>1};   // as prepareMatch sets it (older code ignores cp)
 save.mp=cfg.mp;
 if(typeof aiLevel==='function'){if(!__aiLevel)__aiLevel=aiLevel;   // exploration only: pin the AI (an authored level, or another AI_EXP for the bots)
  aiLevel=cfg.forceTier!==undefined?()=>({i:cfg.forceTier,p:AI_TIERS[cfg.forceTier].p}):cfg.aiExp!==undefined?(pw,e)=>__aiLevel(pw,e===undefined?cfg.aiExp:e):__aiLevel;}
 __casual=cfg.pilot==='casual';
 populatePreparedMatch();
 if(cfg.ghosts&&cfg.ghosts.length)placeGhosts(cfg.ghosts.map((L,i)=>({i,n:'G'+i,L})));
 me.ctl='pilot';me.hum=true;me.pid='me';me.brain=newBrain();me.strafe=1;me.strafeT=1.5;
 const roster=units.map(u=>({team:u.team,cls:u.cls,w:u.wtype,mhp:u.mhp,dps:Math.round(u.wdps*dmgMult(u)*rofMult(u)),gh:!!u.gh,boss:!!u.boss,ai:u!==me}));
 startMatch();
 const DT=cfg.dt||1/60,focusSamples=[0,0,0,0,0];let firstK=null;let steps=0,samples=0,meAlive=0;
 const enemyDmgOnMe=[0],enemyDmgTotal=[0],allyDmg=[0],meDmg=[0],enemyHpLost=[0];
 while(steps++<Math.ceil(30000/(60*DT))){
  if(state==='round'){   // between rounds a sensible pilot answers a counter with the chassis that beats it, if they own it
   const foe=units.find(u=>u.team!==me.team),fix=foe&&beatenBy(foe.cls);
   if(fix&&fix!==me.cls&&(battleLoadout.chs||[]).some(c=>c.c===fix)&&typeof switchChassis==='function'){switchChassis(fix);me.ctl='pilot';me.hum=true;me.pid='me';me.brain=newBrain();me.strafe=1;me.strafeT=1.5;}
   startRound();me=units[0];continue;}
  if(state!=='play'||(cfg.maxSteps&&steps>cfg.maxSteps))break;
  if(me.hp>0){if(__casual){me.brain.mode='press';me.brain.t=99;me.brain.hideCd=99;}   // casual: drives at the target, no peeking or cover play
   botAI(DT,me);
   const t=me.focus&&me.focus.hp>0?me.focus:nearestFoe(me);
   const brng=me.wtype==='twin'?SUP.twin.r+1.2:STAT.range+1.5;
   me.rdy=me.sp>=SUPER_MAX&&!me.sup?(me.rdy||0)+DT:0;
   if(me.rdy>0.5&&t&&los(me,t)&&Math.hypot(t.x-me.x,t.y-me.y)<=brng)useSuper(me);}
  update(DT);
  if(steps%15===0&&me.hp>0){   // every 0.25 s while you're alive: how many enemies are locked on you
   const foes=units.filter(u=>u.team!==me.team&&u.hp>0&&!u.boss);
   if(foes.length>=2){samples++;const n=foes.filter(u=>u.focus===me).length;focusSamples[Math.min(4,n)]++;}
   meAlive++;
  }
  for(const e of __events){
   if(e[0]==='h'){const tgt=units[e[1]],src=units[e[6]],amt=e[2];if(!src||!tgt)continue;
    if(src.team!==me.team&&tgt===me)enemyDmgOnMe[0]+=amt;
    if(src.team!==me.team&&tgt.team===me.team)enemyDmgTotal[0]+=amt;
    if(src.team===me.team&&src!==me&&tgt.team!==me.team)allyDmg[0]+=amt;
    if(src===me)meDmg[0]+=amt;
    if(src.team===me.team&&tgt.team!==me.team)enemyHpLost[0]+=amt;}
   if(e[0]==='k'&&firstK===null){const v=units[e[1]];firstK={t:+(steps*DT).toFixed(1),who:v===me?'me':v.team===me.team?'ally':'enemy'};}
  }
  __events.length=0;
 }
 if(cfg.maxSteps&&state==='play')return {roster};
 if(state==='play')throw new Error('softlock: '+JSON.stringify({g:cfg.g,m:cfg.m,map:cfg.map,seed:cfg.seed,t:timeLeft}));
 const o=outcome(me,__ended&&(__ended.series||__ended.won!==undefined)?__ended:undefined);
 const bad=units.filter(u=>!Number.isFinite(u.hp)||!Number.isFinite(u.mhp)||u.mhp<=0);
 if(bad.length)throw new Error('non-finite unit');
 return {out:o.won?'win':o.drawn?'draw':'loss',place:o.place,score:o.score,secs:+(steps*DT).toFixed(1),dmg:Math.round(meDmg[0]),taken:Math.round(me.st.taken),
  allyDmg:Math.round(allyDmg[0]),teamDmg:Math.round(enemyHpLost[0]),onMe:Math.round(enemyDmgOnMe[0]),enemyDmg:Math.round(enemyDmgTotal[0]),
  focus:focusSamples,focusN:samples,firstK,deaths:me.deaths||0,kills:me.st.kills,series:series?series.w.slice():null,roster,bossLeft:boss?Math.max(0,Math.round(boss.hp)):null};
}
`;
export function makeWorld() {
  const ctx = vm.createContext({ console, structuredClone });
  vm.runInContext(DRIVER, ctx, { filename: 'driver.js' });
  for (const f of ['js/rules.js', 'js/game.js', 'js/match.js']) vm.runInContext(src(f), ctx, { filename: f });
  vm.runInContext(RUN, ctx, { filename: 'run.js' });
  return { run: cfg => vm.runInContext('__run(' + JSON.stringify(cfg) + ')', ctx), eval: s => vm.runInContext(s, ctx) };
}

// ---- the gear ladder (what a pilot owns as they progress). Upgrades/cores grow with it; paint is looks only ----
const STOCK = { w: { a: 'pulse', t: 0, q: 1, s: false }, c: { c: 'vanguard', t: 0, q: 1, s: false }, up: { hull: 0, cannon: 0, engine: 0, target: 0, reactor: 0 }, cores: ['dmg', 'rof', 'arm'], gl: {}, skin: 'default', paint: 'stock' };
const gl = lv => ({ dmg: lv, rof: lv, arm: lv, spd: lv, lck: lv, reg: lv });
export const GEAR = {
  stock: STOCK,
  common: { ...STOCK, w: { a: 'pulse', t: 0, q: 1.08, s: false }, c: { c: 'vanguard', t: 0, q: 1.08, s: false }, up: { hull: 1, cannon: 1, engine: 0, target: 0, reactor: 0 }, gl: gl(1) },
  rare: { ...STOCK, w: { a: 'pulse', t: 1, q: 1.08, s: false }, c: { c: 'vanguard', t: 1, q: 1.08, s: false }, up: { hull: 2, cannon: 2, engine: 1, target: 1, reactor: 0 }, gl: gl(2) },
  epic: { ...STOCK, w: { a: 'pulse', t: 2, q: 1.08, s: false }, c: { c: 'titan', t: 2, q: 1.08, s: false }, up: { hull: 3, cannon: 3, engine: 2, target: 2, reactor: 1 }, gl: gl(3) },
  // the owner's kit: Lunar Skin + Moonbeam + Epic Titan (Colossus) + Gold Plate paint, a full 14-level build
  legend: { ...STOCK, w: { a: 'moon', t: 2, q: 1, s: false }, c: { c: 'titan', t: 2, q: 1.1, s: false }, up: { hull: 4, cannon: 4, engine: 2, target: 2, reactor: 2 }, gl: gl(4), skin: 'lunar', paint: 'gold',
    chs: [{ c: 'scout', t: 1, q: 1.08, s: false }, { c: 'vanguard', t: 2, q: 1.08, s: false }, { c: 'titan', t: 2, q: 1.1, s: false }] },   // owns all three classes: can counter-pick
};
// gear only, upgrades and cores held at the stock build: isolates what the items themselves do
export const GEAR_ONLY = {
  stock: STOCK,
  common: { ...STOCK, w: { a: 'pulse', t: 0, q: 1.08, s: false }, c: { c: 'vanguard', t: 0, q: 1.08, s: false } },
  rare: { ...STOCK, w: { a: 'pulse', t: 1, q: 1.08, s: false }, c: { c: 'vanguard', t: 1, q: 1.08, s: false } },
  epic: { ...STOCK, w: { a: 'pulse', t: 2, q: 1.08, s: false }, c: { c: 'titan', t: 2, q: 1.08, s: false } },
  legend: { ...STOCK, w: { a: 'moon', t: 2, q: 1, s: false }, c: { c: 'titan', t: 2, q: 1.1, s: false }, skin: 'lunar', paint: 'gold' },
};
export const SCENARIOS = [
  ['arena', '1v1'], ['arena', '2v2'], ['arena', '3v3'], ['zone', '2v2'], ['zone', '3v3'], ['crystal', '2v2'], ['bounty', '2v2'],
  ['royale', '1v1'], ['boss', '1v1'], ['boss', '2v2'], ['boss', '3v3'],
];
export const MAPS4 = ['classic', 'overpass', 'longshot', 'craters'];

export function summarize(rows) {
  const n = rows.length, c = k => rows.filter(r => r.out === k).length, avg = f => rows.reduce((s, r) => s + f(r), 0) / Math.max(1, n);
  const fs2 = rows.reduce((a, r) => (r.focus.forEach((v, i) => (a[i] += v)), a), [0, 0, 0, 0, 0]), fN = fs2.reduce((a, b) => a + b, 0);
  const first = rows.filter(r => r.firstK);
  return {
    n, win: +(c('win') / n).toFixed(3), draw: +(c('draw') / n).toFixed(3), loss: +(c('loss') / n).toFixed(3),
    secs: Math.round(avg(r => r.secs)), dmg: Math.round(avg(r => r.dmg)), taken: Math.round(avg(r => r.taken)),
    allyShare: +(rows.reduce((s, r) => s + r.allyDmg, 0) / Math.max(1, rows.reduce((s, r) => s + r.teamDmg, 0))).toFixed(3),
    onMeShare: +(rows.reduce((s, r) => s + r.onMe, 0) / Math.max(1, rows.reduce((s, r) => s + r.enemyDmg, 0))).toFixed(3),
    focus2plus: fN ? +((fs2[2] + fs2[3] + fs2[4]) / fN).toFixed(3) : null,
    firstDeathMe: first.length ? +(first.filter(r => r.firstK.who === 'me').length / first.length).toFixed(3) : null,
    firstKillT: first.length ? Math.round(first.reduce((s, r) => s + r.firstK.t, 0) / first.length) : null,
    place: rows[0] && rows[0].place ? +avg(r => r.place).toFixed(2) : undefined,
    bossDown: rows[0] && rows[0].bossLeft !== null ? +avg(r => r.score[0]).toFixed(1) : undefined,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // usage: [PILOT=casual|expert] [ONLY=modes] [TIER=n] node dev/tests/combat-sim.mjs [seeds=12] [ladder=GEAR|GEAR_ONLY] [out.json]
  const pilot = process.env.PILOT || 'expert', ft = process.env.TIER !== undefined ? +process.env.TIER : undefined, aiExp = process.env.AI_EXP ? +process.env.AI_EXP : undefined, dt = process.env.DT ? 1 / +process.env.DT : undefined;
  const seeds = +(process.argv[2] || 12), ladder = process.argv[3] === 'GEAR_ONLY' ? GEAR_ONLY : GEAR, out = process.argv[4];
  const W = makeWorld(), table = {}, t0 = Date.now();
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const [g, m] of SCENARIOS.filter(([g, m]) => !only || only.includes(g) || only.includes(g + ' ' + m))) for (const [gk, L] of Object.entries(ladder)) {
    const rows = [];
    for (let s = 1; s <= seeds; s++) rows.push(W.run({ g, m, map: MAPS4[s % 4], seed: 1000 + s * 7919, mp: 50, L, pilot, forceTier: ft, aiExp, dt }));
    table[g + ' ' + m + ' ' + gk] = summarize(rows);
    const S = table[g + ' ' + m + ' ' + gk];
    console.log((g + ' ' + m).padEnd(13), gk.padEnd(7), 'win', S.win.toFixed(2), 'draw', S.draw.toFixed(2), 'secs', String(S.secs).padStart(3), 'dmg', String(S.dmg).padStart(6), 'taken', String(S.taken).padStart(6),
      'ally', S.allyShare, 'onMe', S.onMeShare, 'focus2+', S.focus2plus, 'firstDeathMe', S.firstDeathMe, S.place !== undefined ? 'place ' + S.place : '', S.bossDown !== undefined ? 'boss% ' + S.bossDown : '');
  }
  console.log('elapsed', ((Date.now() - t0) / 1000).toFixed(1), 's');
  if (out) fs.writeFileSync(out, JSON.stringify(table, null, 1));
}
