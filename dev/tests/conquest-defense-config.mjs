import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();const {CONQUEST:{Combat:C,World:W},RULES:R}=await import('../../worker/src/sim.gen.js');const p={x:1060,z:1140,y:W.groundAt(1060,1140),surface:'ground'};
const test=kind=>{const b=new C.Operation(R.STOCK_L,p,'base-defense');b.defenseConfig=kind;b.baseTier=2;b.baseModules={defense:1};return b;};
const b=test('turret'),e=b.enemies[0],hp=e.hp;for(let i=0;i<60;i++)b.tick(1/60,p,{});assert(e.hp<hp,'deployed base turret causes actual enemy HP damage');
const d=test('drone');d.objectiveHp=1000;d.tick(.25,p,{});assert(d.objectiveHp>1000,'support drone repairs actual objective');
function impact(kind){const b=test(kind),p=b.objective;b.player={x:100,y:0,z:100};b.time=100;const q={x:p.x,y:p.y,z:p.z,vx:1,vy:0,vz:0,team:'enemy',kind:'pulse',stats:C.archetypes.command?{...b.enemies[0].stats}:null};b.hit(q,p,14);return 1800-b.objectiveHp;}
assert(impact('shield')<impact('turret'),'shield config protects reactor from actual incoming projectiles');console.log('PASS real turret damage, support drone healing and defense shield damage mitigation');
