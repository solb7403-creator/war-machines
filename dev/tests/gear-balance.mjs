// Every owned roll, rarity and class runs through production combat formulas.
// node dev/tests/gear-balance.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const rules=readFileSync('js/rules.js','utf8'),game=readFileSync('js/game.js','utf8');
const sup=game.match(/const SUP=\{[\s\S]*?\};/);
assert.ok(sup,'Find the production Super definitions');
const info=new Function(rules+'\n'+sup[0]+'\nreturn {CH,CHORDER,WEAPONS,WORDER,SUP,TIER_MULT,LEGENDARY_MULT,ROLL_MIN,ROLL_MAX,SALV_MIN,SALV_MAX,weaponOf,chassisOf,STAT,STOCK_L,powerOf};')();
const {CH,CHORDER,WEAPONS,WORDER,SUP,TIER_MULT,LEGENDARY_MULT,ROLL_MIN,ROLL_MAX,SALV_MIN,SALV_MAX,weaponOf,chassisOf,STAT,powerOf,STOCK_L}=info;
assert.deepEqual(WORDER,['pulse','twin','siege']);
assert.deepEqual(CHORDER,['scout','vanguard','titan']);
assert.equal(TIER_MULT.length,3);
const report={weapons:[],chassis:[]};
const eps=0.0001;
const normal=[];
for(const k of WORDER){
 const tiers=[];
 for(let t=0;t<3;t++){
  const lo=weaponOf(k,t,ROLL_MIN),hi=weaponOf(k,t,ROLL_MAX);
  assert.ok(lo.dps>0&&hi.dps>=lo.dps&&hi.shot>0&&hi.pspd>0);
  assert.equal(lo.arch,k);
  assert.ok(hi.dps/lo.dps<=1.07,'RNG should not cause extreme power swings');
  if(t>0)assert.ok(lo.dps>tiers[t-1].max,'Higher weapon tier must beat every prior-tier roll: '+k);
  assert.equal(hi.shot,WEAPONS[k].shot,'Fire cadence must be class-defined');
  tiers.push({level:t+1,min:lo.dps,max:hi.dps,shot:hi.shot,projectileSpeed:hi.pspd});
  normal.push(hi);
 }
 report.weapons.push({class:k,tiers});
}
for(const k of CHORDER){
 const tiers=[];
 for(let t=0;t<3;t++){
  const lo=chassisOf(k,t,ROLL_MIN),hi=chassisOf(k,t,ROLL_MAX);
  assert.ok(lo.hp>0&&lo.spd>0&&lo.turn>0&&hi.hp>=lo.hp&&hi.spd>=lo.spd);
  if(t>0){
    assert.ok(lo.hp>tiers[t-1].maxHP,'Higher chassis tier must improve HP even after prior max roll: '+k);
    assert.ok(lo.spd>tiers[t-1].maxSpeed,'Higher chassis tier must improve speed even after prior max roll: '+k);
    assert.ok(lo.turn>tiers[t-1].turn,'Higher chassis tier must improve turn rate: '+k);
  }
  const level={level:t+1,minHP:lo.hp,maxHP:hi.hp,minSpeed:lo.spd,maxSpeed:hi.spd,turn:hi.turn};
  tiers.push(level);
  assert.ok(hi.hp/lo.hp<1.08&&hi.spd/lo.spd<1.06,'Rolls must not be dominant');
 }
 report.chassis.push({class:k,tiers});
}
assert.equal(report.weapons.length*3,9);
assert.equal(report.chassis.length*3,9);
// Crate gear beats all salvaged items; salvage remains a meaningful budget alternative to starter stock.
for(const k of WORDER)for(let t=1;t<=2;t++){
 const salv=weaponOf(k,t,SALV_MAX[t],true),crate=weaponOf(k,0,ROLL_MIN,false);
 assert.ok(salv.mult<crate.mult&&salv.dps<=crate.dps,'Salvage must never outrank Common: '+k+' '+t);
}
for(const k of CHORDER)for(let t=1;t<=2;t++){
 const salv=chassisOf(k,t,SALV_MAX[t],true),crate=chassisOf(k,0,ROLL_MIN,false);
 assert.ok(salv.mult<crate.mult&&salv.hp<=crate.hp,'Salvage must never outrank Common: '+k+' '+t);
}
const moon=weaponOf('moon');
const bestEpic=Math.max(...normal.map(w=>w.dps));
assert.equal(moon.premium,true);
assert.equal(moon.dps,WEAPONS.moon.dps);
assert.ok(moon.dps>bestEpic,'Legendary must beat even highest Epic roll in sustained DPS');
assert.ok(moon.dps/bestEpic<1.15,'Legendary must stay within 15% of the strongest Epic weapon');
assert.ok(moon.mult>TIER_MULT[2]*ROLL_MAX,'Legendary multiplier must exceed a perfect Epic roll');
const bestEpicSuper=Math.max(...WORDER.map(k=>SUP[k].dmg*TIER_MULT[2]*ROLL_MAX));
const legendarySuper=SUP.moon.dmg*moon.mult;
assert.ok(legendarySuper>bestEpicSuper,'Moonfall must be the strongest unbuffed single super');
assert.ok(legendarySuper/bestEpicSuper<1.15,'Moonfall must not be a runaway burst advantage');
assert.ok(moon.shot>WEAPONS.twin.shot,'Moonbeam must not outpace rapid-fire class in shot cadence');
assert.ok(1/moon.shot<1/WEAPONS.twin.shot);
assert.ok(WEAPONS.twin.dps<WEAPONS.pulse.dps&&WEAPONS.pulse.dps<WEAPONS.siege.dps,
 'Rapid-fire should trade raw DPS for critical hit and super opportunities');
assert.ok(WEAPONS.twin.shot<WEAPONS.pulse.shot&&WEAPONS.pulse.shot<WEAPONS.siege.shot);
assert.ok(CH.scout.hp<CH.vanguard.hp&&CH.vanguard.hp<CH.titan.hp);
assert.ok(CH.scout.spd>CH.vanguard.spd&&CH.vanguard.spd>CH.titan.spd);
assert.ok(CH.scout.turn>CH.vanguard.turn&&CH.vanguard.turn>CH.titan.turn);
assert.ok(CH.titan.hp/CH.scout.hp<1.6,'Titan must not be an extreme HP outlier');
const all=report.weapons.flatMap(w=>w.tiers.map(t=>t.max));
assert.ok(all.every(Number.isFinite));
const base=powerOf(STOCK_L);
const legendaryPower=powerOf({...STOCK_L,w:{a:'moon',t:2,q:1,s:false}});
assert.ok(legendaryPower>base&&legendaryPower<base*1.3,'Legendary should improve matchmaking power without huge jumps');
report.moonbeam={dps:moon.dps,shot:moon.shot,mult:moon.mult,superDamage:legendarySuper,epicMaxDPS:bestEpic,epicMaxSuper:bestEpicSuper,starterPower:base,legendaryPower};
console.log('Equipment balance: PASS — 9 weapons, 9 chassis, Moonbeam, salvage, supers and class roles');
console.log(JSON.stringify(report,null,2));
