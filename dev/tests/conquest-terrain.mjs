import assert from 'node:assert/strict';
import '../../js/conquest/world.js';
const W=ConquestWorld,point=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
// A padded in-world tile and a distant query must never alias in the bounded cache.
const cacheCanary=W.groundAt(4,0),outside=W.groundAt(0,4*(W.LENGTH+12));assert.notEqual(cacheCanary,outside);assert.equal(W.groundAt(4,0),cacheCanary,'out-of-region queries preserve in-world terrain');
// Actual triangle normal must match finite differences of the collision surface.
for(const [x,z] of [[1283,1104],[1201.2,1042.1],[14001.1,8002.2]]){
 const n=W.surfaceNormal(x,z),dx=(W.groundAt(x+.001,z)-W.groundAt(x-.001,z))/.002;
 assert(Math.abs(-n[0]/n[1]-dx)<1e-6);
}
let p=point(1283,1104),q=W.advance(p,0,12);assert(q.z>1115,'reported hillside must permit contour travel');assert.equal(q.y,W.groundAt(q.x,q.z));
for(const fps of [10,20,60])for(const speed of [4.4,8.8,16]){let p=point(1160,1035);for(let i=0;i<fps*2;i++)p=W.advance(p,speed/fps,0);assert(Math.abs(p.x-1160-2*speed)<1e-7);assert.equal(p.y,W.groundAt(p.x,p.z));}
let tower=W.advance(point(1138,1080),30,0);assert(tower.x<1141);
let rail={x:1024,z:1015,y:24,surface:'bridge'};assert.equal(W.advance(rail,0,-10),rail);
// No flattening or vertical jumps; sampled distant routes retain exact footing.
for(const [x,z] of [[14000,8000],[28000,42000],[15840,23760]]){let p=point(x,z);for(let i=0;i<1000;i++){const q=W.advance(p,.2,.1);assert(Math.abs(q.y-p.y)<.5);assert.equal(q.y,W.groundAt(q.x,q.z));p=q;}console.log('remote corridor',x,z,'end',p.x,p.z);}
console.log('PASS geometric normals, reported contour, slopes at 10/20/60 FPS and three speeds, towers, rails, footing');
// Bounded local BFS follows the production movement provider, including bridge state.
function route(start,goal){const queue=[{...start}],seen=new Set(),step=4;let found=null;for(let i=0;i<queue.length&&i<50000;i++){const p=queue[i];if(Math.hypot(p.x-goal[0],p.z-goal[1])<6){found=p;break;}for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){const q=W.advance(p,dx,dz);if(Math.hypot(q.x-p.x-dx,q.z-p.z-dz)>.01)continue;if(q.x<860||q.x>1390||q.z<960||q.z>1260)continue;const key=Math.round(q.x/step)+':'+Math.round(q.z/step)+':'+q.surface;if(seen.has(key))continue;seen.add(key);queue.push(q);}}assert(found,`route ${start.x},${start.z} → ${goal}`);console.log('route PASS',start.x,start.z,'→',goal,'visited',seen.size);}
route(point(898,1024),[1160,1048]);route(point(1160,1048),[1140,1128]);route(point(1160,1048),[1210,1130]);route(point(1160,1048),[1283,1104]);
// Find an actual extreme face and verify attempted fall-line ascent is rejected, with no vertical snapping.
let cliff=false;for(let x=1250;x<1400&&!cliff;x+=4)for(let z=1080;z<1250&&!cliff;z+=4){const n=W.surfaceNormal(x+.2,z+.3),grade=Math.hypot(n[0],n[2])/n[1];if(grade>1.8){const p=point(x+.2,z+.3),q=W.move(p,-n[0]*.2,-n[2]*.2);assert.equal(q,p);cliff=true;}}assert(cliff);console.log('PASS sampled extreme cliff remains impassable');
