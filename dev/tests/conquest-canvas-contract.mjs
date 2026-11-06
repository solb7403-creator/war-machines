// Execute the real Canvas renderer with the real Three projection and authored
// collision data; every new solid roof must appear at its exact projected bounds.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();const {CONQUEST:{World:W,Combat:C}}=await import('../../worker/src/sim.gen.js');
const realm=vm.createContext({});vm.runInContext(fs.readFileSync('js/vendor/three.lunar.min.js','utf8'),realm);const T=realm.THREE,polygons=[],labels=[];let path=[];
const ctx=new Proxy({beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},fill(){if(path.length>=3)polygons.push(path.map(p=>[...p]));},fillText(s){labels.push(s);}}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)}),canvas={style:{},getContext:()=>ctx};
const camera=new T.PerspectiveCamera(55,390/844,.2,3000);camera.position.set(915,75,1040);camera.lookAt(915,0,942);camera.updateMatrixWorld();
const p={x:915,y:W.groundAt(915,942),z:942},op=C.operations['raid-extraction-1'],B={enemies:[],projectiles:[],effects:[],turretYaw:0,operation:op,nodes:op.route,scans:0,objective:{x:op.x,y:W.groundAt(op.x,op.z),z:op.z}};
const view={T,camera,origin:{x:0,z:0},p,battle:B,authority:{state:{base:{tier:0},drops:[{id:'actual-cache',x:918,z:944,y:W.groundAt(918,944),expires:Date.now()+10000,amount:{cp:5,alloy:1,biomass:0,helium:0}}],wrecks:[]}},selectedId:null};
const source=fs.readFileSync('js/conquest/view.js','utf8'),renderSource=source.slice(source.indexOf('function canvasRenderer('),source.indexOf('class View'));
const renderer=vm.runInNewContext(renderSource+';canvasRenderer', {root:{ConquestCombat:C},W,document:{createElement:()=>canvas},Date})(view);renderer.setSize(390,844);renderer.render();
const project=(x,y,z)=>{const q=new T.Vector3(x,y,z).project(camera);return [(q.x+1)*390/2,(1-q.y)*844/2];};
for(const o of W.raidObstacles){const roof=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>project(o.x+x*o.width/2,W.groundAt(o.x,o.z)+o.height,o.z+z*o.depth/2));assert(polygons.some(poly=>roof.every(a=>poly.some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-4))),'Canvas must draw exact authoritative cover roof '+o.id);}
assert(labels.some(s=>/SCAN.*1\/3/.test(s)),'active physical collection node must be readable in Canvas');assert(labels.some(s=>/SALVAGE/.test(s)),'real server salvage cache must be visible in Canvas');console.log('PASS real Canvas projection of all9 authoritative cover volumes, active collection nodes and server salvage caches');
