import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx=vm.createContext({console});
for(const f of ['js/range-host.js','js/rules.js','js/game.js','js/conquest/world.js','js/conquest/combat.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
const R=vm.runInContext('({STOCK_L,tankOf,machineMetrics,gsum,dmgMult,rofMult,armor,projectileImpactMult})',ctx),C=ctx.ConquestCombat,W=ctx.ConquestWorld,clone=x=>JSON.parse(JSON.stringify(x));
const p={x:1160,z:1048,y:W.groundAt(1160,1048),surface:'ground'},stock=clone(R.STOCK_L),strong={...clone(stock),w:{a:'moon',t:2,q:1,s:false},c:{c:'titan',t:2,q:1.1,s:false},skin:'lunar',up:{hull:4,cannon:4,engine:4,target:2,reactor:0},gl:{dmg:5,rof:5,arm:5}};
const a=new C.Battle(stock,p),b=new C.Battle(strong,p);
assert.equal(a.playerMax,R.tankOf(stock,1).mhp);assert.equal(b.playerMax,R.tankOf(strong,1).mhp);assert.equal(a.combatSpeed,W.travelSpeed(stock)/2);
assert(Object.isFrozen(a.snapshot)&&Object.isFrozen(a.snapshot.w));stock.up.cannon=4;assert.equal(a.snapshot.up.cannon,0);
assert.deepEqual(clone(a.enemies.map(e=>[e.kind,e.hp,e.stats])),clone(b.enemies.map(e=>[e.kind,e.hp,e.stats])),'fixed authored enemy stats across gear');
a.id=5000;b.id=20;a.spawnWave();b.spawnWave();assert.deepEqual(a.enemies.slice(-2).map(e=>e.cd),b.enemies.slice(-2).map(e=>e.cd),'authored deployment timing independent of player shot count');
assert(!C.lineClear({x:1120,y:10,z:1080},{x:1180,y:10,z:1080}),'tower blocks firing');
assert(!C.lineClear({x:1270,y:W.groundAt(1270,1104)+1,z:1104},{x:1220,y:W.groundAt(1220,1104)+1,z:1104}),'hill blocks low firing ray');
assert(C.blocked(1150,W.groundAt(1150,1080)+30,1080),'tower solid');
// Exact direct-shot parity with shared permanent damage, Velocity, counter and armor rules.
const parity=new C.Battle(R.STOCK_L,p),victim=parity.enemies[0];parity.random=()=>1;const originalHp=victim.hp,q={x:victim.x,y:victim.y+2.2,z:victim.z,vx:1,vy:0,vz:0,stats:parity.playerStats,team:'player',kind:'pulse'};
assert(parity.hit(q,victim,2.7));const expected=parity.playerStats.wdps*parity.playerStats.wshot*R.dmgMult(parity.playerStats)*R.projectileImpactMult(parity.playerStats)*1.15*(1-R.armor(victim.stats));assert(Math.abs(originalHp-victim.hp-expected)<1e-9,'center hit uses shared damage rather than graze');
// Reproducible stationary target trial exercises actual firing, swept collision and shared stats.
function duel(L,fps){const battle=new C.Battle(L,p);const enemy=battle.enemies[0];Object.assign(enemy,{x:1175,z:1048,y:W.groundAt(1175,1048),hp:900,maxHp:900,decision:1000,cd:1000,vx:0,vz:0});battle.enemies=[enemy];let t=0;while(enemy.hp>0&&t<30){battle.tick(1/fps,p,{fire:true,aim:{x:enemy.x,y:enemy.y+2.2,z:enemy.z}});t+=1/fps;}assert(enemy.hp<=0,'real target destroyed');return {time:t,shots:battle.shots};}
const trials=[];for(const arch of ['pulse','twin','siege','moon']){const L=clone(R.STOCK_L);L.w.a=arch;if(arch==='moon')L.w.t=2;const low=duel(L,10),high=duel(L,60);assert(Math.abs(low.time-high.time)<.12);trials.push({arch,time:+high.time.toFixed(2),shots:high.shots});}
assert(duel(strong,60).time<duel(R.STOCK_L,60).time*.6,'permanent gear gives substantial advantage');
// Player and facility failure, authored phases, replay without economic effects.
const lose=new C.Battle(R.STOCK_L,p);lose.playerHp=0;lose.tick(.016,p,{});assert.equal(lose.state,'defeat');
const objective=new C.Battle(R.STOCK_L,p);objective.objectiveHp=0;objective.tick(.016,p,{});assert.equal(objective.state,'defeat');
const retreat=new C.Battle(R.STOCK_L,p);retreat.tick(.016,{...p,x:p.x+250},{});assert.equal(retreat.state,'defeat');assert.match(retreat.reason,/Retreated/);
const win=new C.Battle(R.STOCK_L,p);for(let wave=1;wave<=3;wave++){assert.equal(win.wave,wave);win.enemies.forEach(e=>e.hp=0);for(let i=0;i<190;i++)win.tick(1/60,p,{});}assert.equal(win.state,'victory');assert(win.objectiveHp>0);assert.equal(new C.Battle(R.STOCK_L,p).state,'active');
const inactive=new C.Battle(R.STOCK_L,p);let movement=0;const before=inactive.enemies.map(e=>[e.x,e.z]);for(let i=0;i<1200;i++)inactive.tick(1/60,p,{});inactive.enemies.forEach((e,i)=>movement+=Math.hypot(e.x-before[i][0],e.z-before[i][1]));assert(movement>1,'AI physically approaches firing positions');assert(inactive.objectiveHp<inactive.objectiveMax||inactive.playerHp<inactive.playerMax,'AI attacks physical targets');
// Complete the authored encounter by aiming and firing actual weapons; no direct health changes.
const encounter=new C.Battle(R.STOCK_L,p);let encounterTime=0;
while(encounter.state==='active'&&encounterTime<100){
 const targets=encounter.enemies.filter(e=>e.hp>0).map(e=>({e,aim:{x:e.x,y:e.y+2.2,z:e.z}})).filter(t=>C.lineClear({x:p.x,y:p.y+2.2,z:p.z},t.aim)).sort((a,b)=>Math.hypot(a.e.x-p.x,a.e.z-p.z)-Math.hypot(b.e.x-p.x,b.e.z-p.z));
 encounter.tick(1/30,p,targets[0]?{fire:true,aim:targets[0].aim}:{});encounterTime+=1/30;
}
assert.equal(encounter.state,'victory','starter equipment must complete all three actual attack waves');assert.equal(encounter.kills,7);assert(encounter.objectiveHp>0);console.log('Starter encounter:',JSON.stringify({seconds:+encounterTime.toFixed(2),shots:encounter.shots,playerHp:Math.round(encounter.playerHp),objectiveHp:Math.round(encounter.objectiveHp)}));
const undefended=new C.Battle(R.STOCK_L,p);for(let i=0;i<3900&&undefended.state==='active';i++)undefended.tick(1/30,p,{});assert.equal(undefended.state,'defeat');assert.equal(undefended.objectiveHp,0,'real enemy shots destroy the unprotected oxygen objective');
// Bounded simulation and projectile storage during sustained fire.
for(let i=0;i<100;i++)a.tick(.25,p,{fire:true,aim:{x:1160,y:p.y+2,z:1000}});assert(a.projectiles.length<=96);assert(a.effects.length<=32);a.dispose();assert.equal(a.enemies.length,0);assert.equal(a.projectiles.length,0);
console.log('PASS Conquest combat: shared stats, frozen loadout, fixed enemies, four primaries, low/high FPS swept hits, hill/tower occlusion, AI movement/fire, three waves, victory/defeat/retreat/retry, bounded cleanup. Trials:',JSON.stringify(trials));
