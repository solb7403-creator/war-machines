import assert from 'node:assert/strict';
import '../../js/conquest/world.js';
const W=ConquestWorld;
for(const [x,z] of [[1351,1063],[1283,1104],[1163,1132]])for(let i=0;i<8;i++){
 const a=i*Math.PI/4,dx=Math.cos(a),dz=Math.sin(a),p={x,z,y:W.groundAt(x,z),surface:'ground'};
 // Expected travel scales by the terrain speed factor at each step (paved roads are 15% faster; RESOURCE_ECONOMY colony).
 for(const fps of [10,60]){let q=p,ex=0,ez=0;for(let j=0;j<fps;j++){const f=W.speedFactor(q);ex+=dx/fps*f;ez+=dz/fps*f;q=W.advance(q,dx/fps,dz/fps);}
 assert(Math.hypot(q.x-x-ex,q.z-z-ez)<.03,`reported position ${x}/${z}, direction ${i}, ${fps} FPS: ${q.x-x}/${q.z-z}`);assert.equal(q.y,W.groundAt(q.x,q.z));}
}
console.log('PASS all reported positions: eight actual attempted vectors at 10/60 FPS');
