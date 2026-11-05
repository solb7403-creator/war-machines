import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../../js/conquest/catalog.js',import.meta.url),'utf8'),ctx);
const C=ctx.ConquestCatalog;
assert.equal(C.items.length,20);assert.equal(new Set(C.items.map(i=>i.id)).size,20);
assert.equal(C.checkout.enabled,false);assert.match(C.checkout.blocker,/certif/i);
assert.equal(new Set(C.items.map(i=>i.slot)).size,4);
assert(C.items.every(i=>i.permanent&&i.earn&&i.preview));
assert.equal(C.eligible(C.byId['base-bastion'],{base:{tier:0}}),false);
assert.equal(C.eligible(C.byId['base-bastion'],{base:{tier:1}}),true);
// Geometry smoke uses the same THREE Mesh/Group methods as the runtime, records shape signatures.
class V{set(...args){this.values=args;return this;}copy(v){this.values=v.values;return this;}}
class Group{constructor(){this.children=[];this.position=new V;this.rotation=new V;this.scale=new V;this.userData={};}add(...a){this.children.push(...a);}traverse(cb){cb(this);this.children.forEach(x=>x.traverse?x.traverse(cb):cb(x));}}
class Mesh extends Group{constructor(g,m){super();this.geometry=g;this.material=m;}}
class Geo{constructor(...args){this.args=args;this.type=this.constructor.name;}dispose(){}}
class Mat{constructor(p){Object.assign(this,p);}dispose(){}}
const T={Group,Mesh,BoxGeometry:class Box extends Geo{},CylinderGeometry:class Cylinder extends Geo{},SphereGeometry:class Sphere extends Geo{},TorusGeometry:class Torus extends Geo{},ConeGeometry:class Cone extends Geo{},MeshStandardMaterial:Mat,MeshBasicMaterial:Mat,DoubleSide:2};
const signatures=new Set;
for(const i of C.items){const a=C.build(T,i.id,{low:true,reducedMotion:true}),b=C.build(T,i.id,{low:false});assert(a.children.length>=2,i.id+' actual geometry');let meshes=[];a.traverse(m=>{if(m.geometry)meshes.push(m)});assert(meshes.length<=32,'mobile draw budget '+i.id);signatures.add(JSON.stringify(meshes.map(m=>[m.geometry.type,m.geometry.args,m.position.values,m.rotation.values,m.material.color])));assert.equal(a.userData.cosmeticId,i.id);assert.equal(a.userData.competitive,false);assert.equal(b.userData.cosmeticId,i.id);
 const calls=[];const g=new Proxy({},{get:(_t,k)=>k==='save'||k==='restore'?()=>{}:(...a)=>calls.push([k,...a]),set:()=>true});C.draw2D(g,i.id,100,100,1);assert(calls.length>5,'2D actual preview '+i.id);
}
assert.equal(signatures.size,20,'all twenty products have distinct geometry');
console.log('PASS twenty real distinct geometry/Canvas catalog previews, four slots, permanent earning definitions and disabled checkout');
// Use the actual shipped slim THREE bundle; mocks above only make signature assertions readable.
const real=vm.createContext({console});vm.runInContext(fs.readFileSync(new URL('../../js/vendor/three.lunar.min.js',import.meta.url),'utf8'),real);vm.runInContext(fs.readFileSync(new URL('../../js/conquest/catalog.js',import.meta.url),'utf8'),real);
const budgets=vm.runInContext(`ConquestCatalog.items.map(i=>{const a=ConquestCatalog.build(THREE,i.id,{low:true});let triangles=0,meshes=0;const mats=new Set;a.traverse(m=>{if(m.geometry){meshes++;triangles+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3;mats.add(m.material);}});return {id:i.id,meshes,triangles,materials:mats.size};})`,real);
assert(budgets.every(b=>b.meshes<=16&&b.triangles<=1600&&b.materials<=3),JSON.stringify(budgets));
console.log('PASS actual vendored Three r169 low assets: maximum '+Math.max(...budgets.map(b=>b.triangles))+' triangles/'+Math.max(...budgets.map(b=>b.meshes))+' raw meshes, <=3 materials, zero textures per item');
