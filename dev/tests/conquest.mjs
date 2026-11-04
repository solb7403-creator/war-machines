import assert from 'node:assert/strict';
import '../../js/conquest/world.js';
const C=globalThis.ConquestWorld;
assert.equal(C.SPEED,4.4);assert.equal(C.WIDTH,31680);assert.equal(C.LENGTH,47520);
assert(Math.abs(C.WIDTH/(C.SPEED*2)/60-60)<1e-10);assert(Math.abs(C.LENGTH/(C.SPEED*2)/60-90)<1e-10);
assert.equal(C.WIDTH*C.LENGTH,1505433600);assert.equal(C.WIDTH*C.LENGTH/640,2352240);
const samples=[[0,0],[15840,23760],[31679.9,47519.9],[28000,42000],[1024,1024]];
const first=samples.map(([x,z])=>C.heightAt(x,z));
for(const [x,z] of samples){const c=C.chunk(Math.floor(x/128),Math.floor(z/128));assert(c.positions.every(Number.isFinite));}
assert.deepEqual(first,samples.map(([x,z])=>C.heightAt(x,z)));
for(let k=0;k<8;k++){let a=C.chunk(k,2),b=C.chunk(k+1,2);for(let j=0;j<=32;j++){assert.equal(a.positions[(j*33+32)*3+1],b.positions[j*33*3+1]);for(let d=0;d<3;d++)assert.equal(a.normals[(j*33+32)*3+d],b.normals[j*33*3+d]);}}
for(let i=0;i<500;i++)assert(C.chunkKeys(i*191%31680,i*379%47520).length<=81);
assert(first.some(y=>y>0));assert(C.heightAt(1024,1024)<0);
let p={x:900,z:1024,y:C.groundAt(900,1024),surface:'ground'};
for(let i=0;i<600;i++)p=C.move(p,.2,0);
assert.equal(p.surface,'bridge');assert.equal(p.y,24);
for(let i=0;i<600;i++)p=C.move(p,.2,0);
assert(p.x>1139);assert(Math.abs(p.y-C.groundAt(1140,1024))<.1);
p={x:1024,z:995,y:C.groundAt(1024,995),surface:'ground'};
for(let i=0;i<300;i++)p=C.move(p,0,.2);
assert(p.z>1054);assert.equal(p.surface,'ground');
const surfaces=C.surfacesAt(1024,1024);assert(surfaces[1].y-surfaces[0].y>25);
let side={x:1024,z:1015,y:24,surface:'bridge'};assert.equal(C.move(side,0,-1).z,1015);
assert.deepEqual(C.mapPoint(31680,47520),{u:1,v:0});assert.deepEqual(C.mapPoint(0,0),{u:0,v:1});
assert(C.move({x:1,z:1,y:C.groundAt(1,1),surface:'ground'},-10,-10).x>=1);
console.log('Conquest: dimensions 31680 × 47520; reference exploration crossings 60 / 90 minutes; area 1505433600 (2352240× arena). Determinism, seams, 500 streaming moves, far meshes, bridge upper/lower routes, ledges and map bounds PASS.');
// The far ring is actual geometry, at least twice the old 530-unit visibility.
const horizon=C.horizon(15840,23760);assert(horizon.positions.length>0);assert(horizon.positions.every(Number.isFinite));assert(horizon.radius>=2560);assert(horizon.positions.length/3<20000);assert.deepEqual(horizon,C.horizon(15840,23760));
assert.deepEqual(C.scenery(220,330),C.scenery(220,330));assert(C.scenery(220,330).length<=64);
console.log('PASS deterministic bounded horizon geometry and remote seeded scenery');
let tower={x:1138,z:1080,y:C.groundAt(1138,1080),surface:'ground'};tower=C.advance(tower,30,0);assert(tower.x<1141,'oxygen tower footprint is solid even at high speed');
// Sample long wilderness corridors: check footing and bounds, report blocks rather than claiming global traversability.
const corridors=[];for(const [x,z,dx,dz] of [[14000,8000,.2,0],[28000,42000,0,.2],[15840,23760,.2,.1],[1024,995,0,.2]]){let p={x,z,y:C.groundAt(x,z),surface:'ground'},blocked=0;for(let i=0;i<2000;i++){const q=C.advance(p,dx,dz);if(q===p)blocked++;p=q;assert(Number.isFinite(p.y));assert(Math.abs(p.y-(p.surface==='bridge'?C.deckAt(p.x,p.z):C.groundAt(p.x,p.z)))<1e-8);}corridors.push({start:[x,z],end:[+p.x.toFixed(1),+p.z.toFixed(1)],blocked});}console.log('Sampled corridors (not global passability):',JSON.stringify(corridors));
assert.equal(C.chunkKeys(15840,23760,4,1).filter(c=>c.step===4).length,9,'phone near ring keeps fine collision-matching terrain around vehicle');
