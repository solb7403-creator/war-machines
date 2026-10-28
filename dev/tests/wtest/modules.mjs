import assert from 'node:assert/strict';
import vm from 'node:vm';import {execFileSync} from 'node:child_process';
import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const {RULES:R,createSim}=await import('../../../worker/src/sim.gen.js');
const base=vm.runInNewContext(execFileSync('git',['show','6871efacf2d13f57e5f4ba0d5d04f90568c7d450:js/rules.js'],{encoding:'utf8'})+';({tankOf,powerOf,STOCK_L})');
const L=structuredClone(R.STOCK_L);
assert.equal(typeof R.fittingStats,'function','shared fitting catalog exists');
for(const n of [0.5,1,1.5,2,3])assert.deepEqual(JSON.parse(JSON.stringify(R.tankOf(L,n))),JSON.parse(JSON.stringify(base.tankOf(L,n))));
assert.equal(R.powerOf(L),base.powerOf(L));
// Compare actual Stock simulation snapshots to the Session 2 engine under identical RNG streams.
const oldRules=execFileSync('git',['show','6871efacf2d13f57e5f4ba0d5d04f90568c7d450:js/rules.js'],{encoding:'utf8'});
const oldGame=execFileSync('git',['show','6871efacf2d13f57e5f4ba0d5d04f90568c7d450:js/game.js'],{encoding:'utf8'});
const oldApi=execFileSync('git',['show','6871efacf2d13f57e5f4ba0d5d04f90568c7d450:worker/sim-api.js'],{encoding:'utf8'});
for(const g of R.GT_ORDER){
 const host={seed:123,ev(){},end(){},round(){},death(){}},math=Object.create(Math);math.random=R.rng32(123);
 const before=vm.runInNewContext('(function(){'+oldRules+oldGame+oldApi+'})()',{HOST:host,Math:math}),after=createSim(host);
 const cfg={g,m:'1v1',map:'craters',series:false,seats:Array.from({length:g==='royale'?6:2},(_,i)=>i?null:{pid:'one',name:'One',L})};
 for(const sim of [before,after]){sim.setup(cfg);sim.start();sim.setCtl(sim.units[0],'bot');for(let i=0;i<600&&sim.state==='play';i++)sim.step(1/30);}
 assert.equal(JSON.stringify(after.snap()),JSON.stringify(before.snap()),g+' Stock trajectory matches Session 2');
}
const S=R.ecoNorm({});S.mig=1;R.labEnsure(S);const stock=R.labSpec(R.ecoLoadout(S,L));
let valid=0;
for(const hull of ['stock','plates','light'])for(const mobility of ['stock','sprint','stable'])for(const mount of ['stock','hardened','firing']){
 const mods={hull,mobility,mount},f=R.fittingStats(mods),spec={...stock,mods};
 if(f.weight<=3&&f.power<=3){valid++;assert.equal(R.labValidate(S,spec),null);const t=R.tankOf({...L,mods},1);assert.ok(t.mhp>0&&t.wdps>0&&t.spdM>0);}
 else assert.equal(R.labValidate(S,spec),'budget');
}
assert.ok(valid>10);
assert.equal(R.labValidate(S,{...stock,mods:{hull:'god'}}),'modules');
assert.equal(R.labValidate(S,{...stock,mods:{hull:'plates',hp:999}}),'modules');
const p=R.tankOf({...L,mods:{hull:'plates'}},1);assert.equal(p.mhp,1802);assert.equal(p.spdM,0.96);assert.equal(p.dmgM,1);assert.equal(p.wshot,0.2);
const a={...stock,mods:{hull:'plates',mobility:'stable',mount:'stock'}};
assert.ok(!R.labAction(S,'lab_save',{id:'m_spare',rev:S.lab.rev,name:'Heavy',spec:a}).err);
assert.equal(R.labLoadout(S).mhp,undefined);assert.equal(S.lab.machines.m_legacy.spec.mods.hull,'stock');
R.labAction(S,'lab_activate',{id:'m_spare',rev:S.lab.rev});assert.equal(R.labLoadout(S).mods.hull,'plates');
assert.equal(R.labAction(S,'lab_activate',{id:'m_legacy',rev:1}).err,'conflict');
const visual=R.tankOf({...L,looks:{hull:'plates',mobility:'sprint',mount:'firing'}},1);assert.equal(visual.mhp,1700);assert.equal(visual.wdps,70);
function trial(seed,mods,g='arena'){
 const sim=createSim({seed,ev(){},end(){},round(){},death(){}});sim.setup({g,m:'1v1',map:'craters',series:false,seats:[{pid:'one',name:'One',L:{...L,mods}},null]});sim.start();sim.setCtl(sim.units[0],'bot');
 for(let i=0;i<5400&&sim.state==='play';i++)sim.step(1/30);
 return {state:sim.state,time:sim.snap().el,hp:sim.units.map(u=>Math.round(u.hp)),out:sim.outcome(sim.units[0])};
}
assert.deepEqual(trial(77,a.mods),trial(77,a.mods),'seeded actual combat repeats');
console.log('PASS modules, budgets, stock parity, separate visuals, independent configs, seeded sim; legal combinations',valid);
