import assert from 'node:assert/strict';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C},RULES:R}=await import('../../worker/src/sim.gen.js');
const p={x:898,z:1024,y:W.groundAt(898,1024),surface:'ground'};
const b=new C.Encounter(R.STOCK_L,p),near=b.enemies.filter(e=>Math.hypot(e.x-p.x,e.z-p.z)<240);
assert(new Set(near.map(e=>e.base.id)).size>=3,'three opening encounters');
assert(near.some(e=>Math.hypot(e.x-p.x,e.z-p.z)<100),'first contact within normal travel');
assert(near.every(e=>Math.hypot(e.x-p.x,e.z-p.z)>50),'safe opening spawn');
assert(C.operations&&Object.keys(C.operations).length===6,'six authored mission families');
console.log('PASS dense opening and six operation definitions');
for(const id of ['relay','convoy','redoubt']){const o=C.operations[id],q={x:o.x,z:o.z,y:W.groundAt(o.x,o.z),surface:'ground'},operation=new C.Operation(R.STOCK_L,q,id);assert(operation.enemies.every(e=>Math.hypot(e.x-q.x,e.z-q.z)>=6),'activation must not trap pilot inside new hull: '+id);}
console.log('PASS mission activation never spawns an overlapping hostile hull');
for(const id of ['west-depot','crossroads']){const site=C.installations.find(s=>s.id===id);assert(W.solidAt(site.x,site.z+8),'new bunker shares real movement collision');assert(W.blockedAt(site.x,W.groundAt(site.x,site.z)+4,site.z+8),'new bunker blocks real fire');}
const far=W.horizon(994,944,2);assert(far.positions.some((v,i)=>i%3===0&&v===1280&&far.positions[i+2]===896),'mobile horizon fills the gap beyond detailed terrain');
console.log('PASS added installation collision and continuous mobile horizon');
let decisions=0;class Staggered extends C.Encounter{choose(e){decisions++;return super.choose(e);}}
const theater=new Staggered(R.STOCK_L,{x:994,z:980,y:W.groundAt(994,980),surface:'ground'});theater.tick(1/60,{x:994,z:980,y:W.groundAt(994,980),surface:'ground'},{});
assert(decisions<=2,'nearby AI decisions must not all spike on the same frame');
for(let i=0;i<30;i++)theater.tick(1/60,{x:994,z:980,y:W.groundAt(994,980),surface:'ground'},{});assert(decisions>=6,'staggering retains real AI activity');
console.log('PASS staggered real AI decisions without disabling nearby encounters');
const radio=new C.Encounter(R.STOCK_L,{x:994,z:1010,y:W.groundAt(994,1010),surface:'ground'}),guard=radio.enemies.find(e=>e.key==='west-depot:0'),ally=radio.enemies.find(e=>e.key==='west-depot:1'),count=radio.enemies.length;
radio.hit({x:guard.x,y:guard.y+2.2,z:guard.z,vx:0,vy:0,vz:1,team:'player',kind:'pulse',stats:radio.playerStats},guard,2.7);
assert(ally.radioUntil>radio.time,'a genuine hit calls an already deployed reinforcement squad');assert.equal(radio.enemies.length,count,'radio never fabricates reward-bearing actors');
radio.tick(.25,{x:994,z:1010,y:W.groundAt(994,1010),surface:'ground'},{});assert.equal(ally.target,radio.player,'radio responder acquires the actual pilot');console.log('PASS physical squad radio reinforcement with fixed existing actors');
