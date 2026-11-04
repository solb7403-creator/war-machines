import assert from 'node:assert/strict';
import '../../js/conquest/world.js';
const C=globalThis.ConquestWorld;
assert.equal(C.SPEED,4.4);assert.equal(C.WIDTH,31680);assert.equal(C.LENGTH,47520);
assert.equal(C.WIDTH*10/44/3600,2);assert.equal(C.LENGTH*10/44/3600,3);
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
console.log('Conquest: dimensions 31680 × 47520; crossings 2h / 3h; area 1505433600 (2352240× arena). Determinism, seams, 500 streaming moves, far meshes, bridge upper/lower routes, ledges and map bounds PASS.');
