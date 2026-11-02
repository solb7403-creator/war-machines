import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSim} from '../../worker/build-sim.mjs';
buildSim();
const {RULES:R}=await import('../../worker/src/sim.gen.js');
assert.equal(R.GORDER.length,7);
assert.equal(R.GEM.vel.name,'Velocity');
assert.equal(R.GEM.vel.impact,0.05);
for(const [i,v] of [0.05,0.06,0.0725,0.09,0.1125].entries())assert.ok(Math.abs(R.GEM.vel.impact*R.gemLvMult(i+1)-v)<1e-12);
for(const [i,v] of [0.15,0.18,0.2175,0.27,0.3375].entries())assert.ok(Math.abs(R.coreVal('vel',i+1)-v)<1e-12);
const old={cores:['dmg','rof','arm'],gemLvl:{dmg:4},gemShards:{dmg:9}};
R.ecoNorm(old);assert.equal(old.gemLvl.vel,1);assert.equal(old.gemShards.vel,0);assert.equal(old.gemLvl.dmg,4);assert.equal(old.gemShards.dmg,9);assert.deepEqual(old.cores,['dmg','rof','arm']);
for(let i=0;i<7;i++){const S=R.ecoNorm({});let n=0;const out=R.ecoOpenBox(S,'gem',0,{rnd:()=>n++===0?(i+.5)/7:0,day:1,week:1});assert.equal(out.gem,R.GORDER[i]);assert.equal(out.n,1);}
const L=structuredClone(R.STOCK_L);L.cores=[null,null,null];const base=R.tankOf(L,1);
L.cores=['vel',null,null];L.gl.vel=5;const fast=R.tankOf(L,1);
assert.ok(Math.abs(fast.wpspd/base.wpspd-1.3375)<1e-12);assert.equal(fast.wdps,base.wdps);assert.equal(fast.wshot,base.wshot);assert.equal(fast.spdM,base.spdM);assert.ok(R.powerZ(L)>R.powerZ({...L,cores:[]}));
L.mods={mobility:'stable'};const fit=R.tankOf(L,1);assert.ok(Math.abs(fit.wpspd-base.wpspd*1.3375*1.1)<1e-10);
const S=R.ecoNorm({});const clean=R.ecoLoadout(S,{...L,cores:['vel','dmg','rof','arm']});assert.equal(clean.cores.length,3);assert.equal(clean.cores[0],'vel');
console.log('PASS Velocity balance, seven-way caches, migration, three sockets, base weapon stats, fitting stacking');
// Exercise the real projectile functions in both browser and generated-server engines.
const rules=fs.readFileSync('js/rules.js','utf8'),game=fs.readFileSync('js/game.js','utf8');
const probe=`
 return function(L){
 setMap('classic');walls=[];baseWalls=[];crates=[];rocks=[];
 const a=Object.assign(tankOf(L,1),{id:0,x:2,y:16,ang:0,cd:0,hp:2000,team:0,hum:true,buffs:[],sp:0});
 const b=Object.assign(tankOf(STOCK_L,1),{id:1,x:7,y:16,ang:0,hp:2000,team:1,buffs:[],sp:0});
 units=[a,b];turret(a,1/60);const q=bullets[0];
 const shot={speed:Math.hypot(q.vx,q.vy),range:q.life*Math.hypot(q.vx,q.vy),damage:q.dps*q.shot*q.dm};
 b.hp=0;const x=q.x;moveBullets(2);shot.distance=q.x-x;
 a.sup={ang:0,w:'siege'};fireSuper(a,SUP.siege);const s=shells[0];
 const shell={speed:Math.hypot(s.vx,s.vy),range:s.life*Math.hypot(s.vx,s.vy),damage:s.dmg};
 a.sup=null;const sx=s.x;superTick(2);shell.distance=s.x-sx;
 // High velocity must not skip the enemy even with a large frame delta.
 b.hp=2000;a.cd=0;bullets=[];turret(a,1/60);moveBullets(.25);const hit=b.hp<2000;
 return {shot,shell,hit};
 };`;
// rocks is not needed by the classic map; test environments share the same collision data.
const source=rules+'\n'+game+probe.replace('rocks=[];','');
const browser=new Function(source)();
const server=new Function('HOST',source)({random:()=>.99,ev(){},end(){}});
const normal={...structuredClone(R.STOCK_L),cores:[],gl:{}};
const velocity={...structuredClone(normal),cores:['vel'],gl:{vel:5}};
for(const engine of [browser,server]){
 const a=engine(normal),b=engine(velocity);
 for(const key of ['shot','shell']){
  assert.ok(Math.abs(b[key].speed/a[key].speed-1.3375)<1e-10,key+' speed');
  assert.ok(Math.abs(b[key].range-a[key].range)<1e-10,key+' range');
  assert.ok(Math.abs(b[key].distance-a[key].distance)<1e-9,key+' actual travel');
  assert.ok(Math.abs(b[key].damage/a[key].damage-1.1125)<1e-10,key+' impact damage exactly once');
 }
 assert.ok(b.hit,'fast shots collide across frame substeps');
}
// Actual PvP adapter, AI ghost constructor and practice engine all use the same stat block.
const {createSim}=await import('../../worker/src/sim.gen.js');
const sim=createSim({seed:1,ev(){},end(){},round(){},death(){}});
sim.setup({g:'arena',m:'1v1',map:'classic',series:false,seats:[{pid:'a',name:'A',L:velocity},{pid:'b',name:'B',L:normal}]});
assert.equal(sim.units[0].wpspd,R.tankOf(velocity,1).wpspd);
const ghost=new Function(rules+'\n'+game+';return L=>mkGhost(0,10,28,{L,n:"Ghost"});')()(velocity);
assert.equal(ghost.wpspd,sim.units[0].wpspd);
const practice=new Function(fs.readFileSync('js/range-host.js','utf8')+rules+game+fs.readFileSync('js/range-engine.js','utf8')+';return {setup:rangeSetup,tank:()=>me};')();
practice.setup({g:'arena',map:'classic',seed:1,preset:'equipped',control:'player',L:velocity});
assert.equal(practice.tank().wpspd,sim.units[0].wpspd);
const refund=R.ecoNorm({});const out=R.ecoOpenBox(refund,'gem',2,{rnd:()=>.999,day:1,week:1});assert.equal(out.gem,'vel');R.ecoRefund(refund,'box',[out]);assert.equal(refund.gemLvl.vel,1);assert.equal(refund.gemShards.vel,0);
console.log('PASS actual shot/Siege speeds, range, collision, impact damage, AI/PvP/practice parity and refund');

const instant=new Function('HOST',rules+'\n'+game+`;
return function(L,w){setMap('classic');walls=[];baseWalls=[];crates=[];
const a=Object.assign(tankOf(L,1),{id:0,x:5,y:16,ang:0,hp:2000,team:0,buffs:[],sp:0,sup:{w,ang:0}});
const b=Object.assign(tankOf(STOCK_L,1),{id:1,x:7,y:16,ang:0,hp:2000,team:1,buffs:[],sp:0});units=[a,b];fireSuper(a,SUP[w]);return 2000-b.hp;};`)({random:()=>.99,ev(){},end(){}});
for(const w of ['pulse','twin','moon'])assert.equal(instant(normal,w),instant(velocity,w),w+' instant super damage unchanged');
assert.equal(R.machineMetrics({...velocity,gl:{vel:1}}).dps,Math.round(base.wdps*base.dmgM*1.05));
const impact=R.GEM.vel.impact;R.GEM.vel.impact=0;
assert.equal(R.machineMetrics(velocity).dps,R.machineMetrics(normal).dps,'velocity alone adds no DPS');
assert.ok(Math.abs(R.powerZ(velocity)-R.powerZ(normal)-R.POWER_W.ps*Math.log(1.3375))<1e-10,'velocity scored once through wpspd');R.GEM.vel.impact=impact;
console.log('PASS impact levels, unchanged beams/Nova, actual impact DPS and no artificial velocity DPS');
