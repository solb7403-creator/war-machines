import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
const c=vm.createContext({console});for(const f of ['js/range-host.js','js/rules.js','js/game.js','js/conquest/world.js','js/conquest/combat.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const stock=vm.runInContext('STOCK_L',c),C=c.ConquestCombat,W=c.ConquestWorld;
const point=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),cleared={};
assert.equal(C.installations.length,2);assert(C.installations.some(b=>b.kind==='staging'));
const p=point(1240,875),a=new C.Encounter(stock,p,cleared);
assert.equal(a.enemies.length,4);for(const e of a.enemies){assert(!W.solidAt(e.x,e.z));assert(Number.isFinite(e.hp));}
const far=point(15000,8000),before=a.enemies.map(e=>[e.x,e.z,e.cd]);for(let i=0;i<10;i++)a.tick(.1,far,{});
assert.deepEqual(a.enemies.map(e=>[e.x,e.z,e.cd]),before,'remote units do not run AI');
const e=a.enemies[0];let fired=false;for(let i=0;i<1200&&e.hp>0;i++){
 a.tick(1/30,p,{fire:true,aim:{x:e.x,y:e.y+2.2,z:e.z}});if(a.projectiles.some(q=>q.team==='enemy'))fired=true;
 assert(a.enemies.every(e=>Math.hypot(e.x-e.home.x,e.z-e.home.z)<66),'bounded guard movement');
}
assert(fired,'guards actually defend');assert.equal(e.hp,0,'actual weapon destroys guard');assert(cleared[e.key]);
const b=new C.Encounter(stock,p,JSON.parse(JSON.stringify(cleared)));assert.equal(b.enemies[0].hp,0,'cleared guard survives reload');
const oldObjective=a.objectiveHp;assert(oldObjective>1e8);assert.equal(a.state,'active');
for(const [x,z] of [[1163,1132],[1160,1197],[1011,1048]]){const B=new C.Battle(stock,point(x,z));assert.equal(B.approachGrace,60);for(let i=0;i<30;i++)B.tick(.25,point(x,z),{});assert.equal(B.objectiveHp,B.objectiveMax,'far activation protects approach');}
for(const f of C.formations)for(const [,x,z] of f){assert(Math.hypot(x-1230,z-995)<25,'waves originate at staging');assert(!W.solidAt(x,z));}
console.log('PASS guards: authored placement, remote dormancy, bounded defense, real kill, coherent reload, safe mission approach and staging deployment');
for(const invalid of [true,'broken',4,[],null]){const normalized=new C.Encounter(stock,p,invalid);assert.equal(typeof normalized.cleared,'object','malformed local cleared data normalizes');assert(!Array.isArray(normalized.cleared));normalized.enemies[0].hp=0;normalized.tick(.016,p,{});assert(normalized.cleared[normalized.enemies[0].key]);}
console.log('PASS malformed local guard state normalization');
