// Static GLB boundary + mobile budgets. Removing index/normal checks, accepting
// out-of-bounds views or changing material count makes these behavioral tests fail.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const c=vm.createContext({console,TextDecoder,ArrayBuffer,DataView,Uint8Array,Uint16Array,Uint32Array,Float32Array,Map,Promise});
vm.runInContext(fs.readFileSync('js/vendor/three.lunar.min.js','utf8'),c);
vm.runInContext(fs.readFileSync('js/conquest/assets.js','utf8'),c);
const A=c.ConquestAssets,T=c.THREE;
for(const name of ['command','raid']) for(const quality of ['high','low']){
 const p=`js/assets/conquest-v1/${name}-${quality}.glb`,buf=fs.readFileSync(p),ab=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
 const g=A.parse(T,ab), meshes=[];g.traverse(o=>{if(o.isMesh)meshes.push(o)});
 assert.ok(meshes.length>0&&meshes.length<=3,'three material/draw budget');
 const triangles=meshes.reduce((n,m)=>n+m.geometry.index.count/3,0);
 assert.ok(triangles<=(quality==='high'?3000:1000),`${p}: triangle budget ${triangles}`);
 assert.ok(buf.length<250000,'download budget');
 for(const m of meshes){assert.ok(m.geometry.userData.hfShared);assert.ok(m.geometry.attributes.normal);for(const n of m.geometry.attributes.position.array)assert.ok(Number.isFinite(n));m.geometry.computeBoundingBox();assert.ok(m.geometry.boundingBox.max.y>0);}
 assert.throws(()=>A.parse(T,ab.slice(0,28)),/GLB/,'truncation');
 console.log(`${p}: ${buf.length} bytes, ${triangles} triangles, ${meshes.length} draws`);
}
const malformed=new ArrayBuffer(32);assert.throws(()=>A.parse(T,malformed),/GLB/);
console.log('Conquest Blender GLB parser, budgets, geometry and corruption tests PASS');
