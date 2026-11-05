import assert from 'node:assert/strict';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C,Control:K},RULES:R}=await import('../../worker/src/sim.gen.js');
const p={x:1500,z:1500,y:W.groundAt(1500,1500),surface:'ground'};
const bare=()=>{const b=new C.Encounter(R.STOCK_L,p);b.enemies=[];return b;};
assert.equal(K.CONFIG.dashTime,.4);assert.equal(K.CONFIG.dashSpeed,5.1);
for(const fps of [15,30,60]){let b=bare(),q=p;for(let i=0;i<fps*.4;i++)q=K.advance(b,q,{x:1,z:0,dash:i===0},1/fps,false);assert(Math.abs(q.x-p.x-b.combatSpeed*.4*5.1)<.01);}
for(const [weapon,interval] of Object.entries({twin:.22,pulse:.5,moon:.95,siege:1.2}))assert.equal(C.profiles[weapon].interval,interval);
let b=bare();assert.equal(b.playerStats.wshot,.5);K.advance(b,p,{x:0,z:0,tapFire:true},.05,true);assert.equal(b.shots,1);assert(b.heat>0);
b.heat=100;b.overheated=true;const shots=b.shots;K.advance(b,p,{x:0,z:0,fire:true},.25,true);assert.equal(b.shots,shots);
const derived=C.engineeringValues(b.playerStats,{ranks:{bulletRange:3,bulletVelocity:3},tuning:{ballistics:3}});assert(Math.abs(derived.range-92*1.42)<1e-8);assert(Math.abs(derived.velocity-b.playerStats.wpspd*3*1.195)<1e-8);
console.log('PASS Session 3.3 Dash/cadence/heat and independent ballistics');
const {createState,applyAction,hydrate}=await import('../../worker/src/conquest-sim.js');
const now=100000,terminal=s=>{s.position={x:1174,z:1168,y:W.groundAt(1174,1168),surface:'ground'};s.battle.enemies=[];return s;};
let state=terminal(createState(R.STOCK_L,now));state.hp=90;state.battle.heat=87;state.battle.dashCd=2;state.ledger.cp=10000;state.ledger.banked={alloy:1000,biomass:1000,helium:100};
for(const upgrade of Object.keys(C.tracks))for(let rank=1;rank<=3;rank++){const prev=structuredClone(state),price=C.costs[rank-1];state=applyAction(state,{seq:state.seq+1,action:'buy-upgrade',upgrade},now);assert.equal(state.engineering.ranks[upgrade],rank);assert.equal(state.ledger.cp,prev.ledger.cp-price.cp);assert.equal(state.battle.heat,87);assert.equal(state.hp,90);assert.equal(state.battle.dashCd,2);}
assert.throws(()=>applyAction(state,{seq:state.seq+1,action:'buy-upgrade',upgrade:'heatCapacity'},now),/maximum/);
for(const tuning of C.tuningKeys)for(const position of [-3,0,3]){state=applyAction(state,{seq:state.seq+1,action:'set-tuning',tuning,position},now);assert.equal(state.engineering.tuning[tuning],position);}
assert.throws(()=>applyAction(state,{seq:state.seq,action:'set-tuning',tuning:'thermal',position:0},now),/stale/);
assert.throws(()=>applyAction(state,{seq:state.seq+1,action:'set-tuning',tuning:'thermal',position:4},now),/invalid/);
assert.throws(()=>applyAction(state,{seq:state.seq+1,action:'bank',upgrade:'heatCooling'},now),/fields/);
state.position=p;assert.throws(()=>applyAction(state,{seq:state.seq+1,action:'set-tuning',tuning:'thermal',position:0},now),/terminal/);
let old=createState(R.STOCK_L,now);delete old.engineering;old.battle.playerStats.wshot=.2;assert.equal(hydrate(old).playerStats.wshot,.5);assert.equal(hydrate(old).engineering.ranks.heatCapacity,0);
console.log('PASS all eight ranks, four sliders, precise debits, state preservation, terminal/sequence/schema rejection and v1 migration');
const benchmarks=[];
for(const weapon of Object.keys(C.profiles)){
 const L=structuredClone(R.STOCK_L);L.w.a=weapon;L.cores=[];const base=new C.Encounter(L,p);base.enemies=[];
 assert.equal(base.playerStats.wshot,C.profiles[weapon].interval);assert.equal(base.playerStats.wdps,R.tankOf(L,1).wdps);
 let results=[];for(const fps of [15,30,60]){const B=new C.Encounter(L,p);B.enemies=[];let first=null;for(let i=0;i<fps*30;i++){K.advance(B,p,{x:0,z:0,fire:true},1/fps,false);if(first===null&&B.overheated)first={shots:B.shots,seconds:(i+1)/fps};}results.push(B.shots);if(fps===60)benchmarks.push({weapon,...first,shots30s:B.shots,unheatedDps:B.playerStats.wdps});}assert.equal(new Set(results).size,1,weapon+' cadence frame independent');
 const B=new C.Encounter(L,p);B.enemies=[];const start={x:1500,y:1000,z:1500},end={x:1700,y:1000,z:1500};
 B.shoot(start,end,B.playerStats,'player',weapon,0);let q=B.projectiles[0],v=Math.hypot(q.vx,q.vy,q.vz);assert(Math.abs(v*q.life-C.profiles[weapon].range)<.01);
 B.engineering=C.engineeringDefaults({ranks:{bulletVelocity:3}});B.shoot(start,end,B.playerStats,'player',weapon,0);let fast=B.projectiles.at(-1);assert(Math.abs(Math.hypot(fast.vx,fast.vy,fast.vz)*fast.life-C.profiles[weapon].range)<.01);assert(Math.abs(Math.hypot(fast.vx,fast.vy,fast.vz)/v-1.3)<.001);
 B.engineering=C.engineeringDefaults({ranks:{bulletRange:3}});B.shoot(start,end,B.playerStats,'player',weapon,0);let far=B.projectiles.at(-1);assert(Math.abs(Math.hypot(far.vx,far.vy,far.vz)/v-1)<.001);assert(Math.abs(v*far.life/C.profiles[weapon].range-1.27)<.001);
}
console.log(JSON.stringify(benchmarks,null,2));
// Hysteresis and heat debt survive every state handoff, including death and equipment.
for(const weapon of Object.keys(C.profiles)){const L=structuredClone(R.STOCK_L);L.w.a=weapon;L.cores=[];let B=new C.Encounter(L,p);B.enemies=[];let first=0;while(!B.overheated&&B.time<90){K.advance(B,p,{x:0,z:0,fire:true},.05,false);first=B.shots;}assert(first>0);const n=B.shots;while(B.heat>35){K.advance(B,p,{x:0,z:0},.05,false);assert.equal(B.shots,n);}assert.equal(B.overheated,false);const fresh=new C.Encounter(L,p);K.carry(B,fresh);assert.equal(fresh.heat,B.heat);assert.equal(fresh.cooldown,B.cooldown);}
console.log('PASS thermal hysteresis and carry for all four archetypes');
// A boosted burst cannot tunnel through a real enemy hull.
b=bare();let blocker=structuredClone(new C.Encounter(R.STOCK_L,p).enemies[0]);Object.assign(blocker,{x:p.x+7,z:p.z,y:p.y,decision:999,cd:999,vx:0,vz:0});b.enemies=[blocker];let stopped=K.advance(b,p,{x:1,z:0,dash:true},.25,false);assert(stopped.x<=blocker.x-3.7);assert(Math.hypot(stopped.x-blocker.x,stopped.z-blocker.z)>=3.8);
for(const [track,field] of Object.entries({heatCapacity:'capacity',heatCooling:'cooling',bulletVelocity:'velocity',bulletRange:'range',dashDistance:'dashSpeed',dashCooldown:'dashCooldown',shieldDuration:'shieldDuration',shieldCooldown:'shieldCooldown'})){const base=C.engineeringValues(b.playerStats),up=C.engineeringValues(b.playerStats,{ranks:{[track]:3}});for(const k of Object.keys(base))assert.equal(up[k]!==base[k],k===field,track+' affects only '+field);}
console.log('PASS collision-safe burst and isolated effects of eight upgrade tracks');
// Reducing capacity cannot discard heat or create a free vent through repeated tuning.
let hot=terminal(createState(R.STOCK_L,now));hot.battle.heat=99;
hot=applyAction(hot,{seq:1,action:'set-tuning',tuning:'thermal',position:-3},now);
assert(hot.battle.heat<=89.5);assert.equal(hot.battle.heat+(hot.battle.heatOverflow||0),99);
hot=applyAction(hot,{seq:2,action:'set-tuning',tuning:'thermal',position:3},now);
assert.equal(hot.battle.heat+(hot.battle.heatOverflow||0),99);assert(hot.battle.overheated);
for(const fps of [15,20,30,60]){let B=bare(),q=p;for(let i=0;i<fps;i++)q=K.advance(B,q,{x:1,z:0,dash:i===0},1/fps,false);assert(Math.abs(q.x-p.x-B.combatSpeed*(.4*5.1+.6))<1e-6,'Dash expiry exact at '+fps+'fps');}
