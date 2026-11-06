// Compare a trusted historical World source against current source in isolated contexts.
// Usage: git show <baseline>:js/conquest/world.js > /tmp/world-before.js
//        node dev/tests/conquest-world-equivalence.mjs /tmp/world-before.js
import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import assert from 'node:assert/strict';
assert(process.argv[2],'provide the trusted historical world.js path');
function world(path){const ctx={machineSpeed:()=>4.4};runInNewContext(readFileSync(path,'utf8'),ctx);return ctx.ConquestWorld;}
const a=world(process.argv[2]),b=world(new URL('../../js/conquest/world.js',import.meta.url));let seed=593023,points=0;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function check(x,z){const ground=a.groundAt(x,z);assert(Object.is(ground,b.groundAt(x,z)),'height changed '+x+','+z);assert.equal(a.solidAt(x,z),b.solidAt(x,z));for(const y of [ground-1,ground+2.2,ground+8,ground+24,ground+150,NaN])assert.equal(a.blockedAt(x,y,z),b.blockedAt(x,y,z),JSON.stringify({x,y,z}));points++;}
for(let i=0;i<12000;i++)check(800+random()*600,800+random()*500);for(let i=0;i<1000;i++)check(random()*a.WIDTH,random()*a.LENGTH);
for(const [x,z] of [[-4,-4],[0,0],[a.WIDTH+4,a.LENGTH+4],[4,0],[0,190128],[31680,47520]])check(x,z);
for(const s of a.installations)for(const dx of [-11,-9,-8.999,0,8.999,9,11,14])for(const dz of [0,2,2.001,8,13.999,14,16])check(s.x+dx,s.z+dz);
for(let cx=6;cx<11;cx++)for(let cz=6;cz<10;cz++)for(const p of a.scenery(cx,cz).filter(p=>p.kind==='rock'&&p.variant>.45))for(const v of [.999999,1,1.000001]){check(p.x+(p.size*1.6+1)*v,p.z);check(p.x,p.z+(p.size+1)*v);}
console.log(JSON.stringify({scope:'deterministic old/new terrain and collision equivalence: war region, whole world, exact building/rock boundaries, out-of-region cache-key pairs',seed:593023,points,blockedChecks:points*6,differences:0},null,2));
