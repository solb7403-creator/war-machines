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
