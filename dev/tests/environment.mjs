// Real vendored THREE/shared kit; deterministic visuals must not read authoritative RNG or mutate layout data.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createContext,runInContext} from 'node:vm';
const metrics={maps:[],stages:[]};
const root=new URL('../../',import.meta.url),ctx=createContext({console,URL,Float32Array,Uint8Array,HOST:{random(){throw Error('authoritative RNG consumed by visuals');}}});
for(const f of ['js/vendor/three.lunar.min.js','js/rules.js','js/game.js','js/models3d.js','js/equipment3d.js','js/environment3d.js'])runInContext(readFileSync(new URL(f,root),'utf8'),ctx);
runInContext('globalThis.E=Environment3D;globalThis.M=M3;globalThis.maps=MAPS;globalThis.snap=JSON.stringify(MAPS);',ctx);
assert.equal(ctx.E.active(),false,'safe legacy public default');
for(const q of ['high','low'])for(const id of ['classic','overpass','longshot','craters','canyon','bunker']){
 const raw=ctx.E.mapKit(id,q);assert.equal(raw.id,id);assert.equal(raw.quality,q);let n=0;
 for(const k of [raw.k,raw.glow])for(const g of Object.values(ctx.E.bake(k))){n+=g.attributes.position.count;for(const name of ['position','normal','uv','tangent'])assert.ok(g.attributes[name].array.every(Number.isFinite),id+' finite '+name);}
 assert.ok(n>400&&n<(q==='high'?50000:20000),id+' bounded map '+n);metrics.maps.push({id,quality:q,vertices:n});
 if(id==='overpass')assert.deepEqual(JSON.parse(JSON.stringify(raw.bridge)),JSON.parse(JSON.stringify(ctx.maps.overpass.bridge)),'exact official bridge/ramp/tunnel data');
 assert.ok(raw.obstacles.every(x=>ctx.maps[id].walls.some(w=>JSON.stringify(w)===JSON.stringify(x))),'no added collidable obstacles');
}
for(const q of ['high','low'])for(const kind of ['garage','engineer','inspection']){const r=ctx.E.stageKit(kind,q);let n=0;for(const g of Object.values(ctx.E.bake(r.k)))n+=g.attributes.position.count;assert.ok(n>400&&n<25000);metrics.stages.push({kind,quality:q,vertices:n});}
assert.equal(runInContext('JSON.stringify(MAPS)',ctx),ctx.snap);
console.log('PASS environment real kit, six canonical maps, HIGH/LOW, finite UV/material geometry, three stages, exact bridge data, no authoritative RNG/layout mutation');

for(const h of metrics.maps.filter(x=>x.quality==='high'))assert.ok(metrics.maps.find(x=>x.id===h.id&&x.quality==='low').vertices<h.vertices*.8,h.id+' real LOW workload');
for(const h of metrics.stages.filter(x=>x.quality==='high'))assert.ok(metrics.stages.find(x=>x.kind===h.kind&&x.quality==='low').vertices<h.vertices,h.kind+' real LOW stage');
for(const g of ['arena','zone','crystal','bounty','royale','boss'])assert.equal(ctx.E.modeKit(g,'classic','high').mode,g,'mode is not a physical map');
// A canvas shim is used only for texture creation; all measured geometry is real Three.
ctx.document={createElement(){const cv={width:0,height:0},C=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});cv.getContext=()=>C;return cv;}};
const T=ctx.THREE,mats={lit:new T.MeshLambertMaterial(),shine:new T.MeshPhongMaterial(),glow:new T.MeshBasicMaterial(),pulse:new T.MeshBasicMaterial(),deck:new T.MeshLambertMaterial(),tun:new T.MeshLambertMaterial()};
const golden=JSON.parse(readFileSync(new URL('dev/tests/fixtures/environment-pr18-map-hashes.json',root),'utf8'));
for(const [key,want] of Object.entries(golden)){const [id,q]=key.split('|'),r=ctx.M.buildMap(id,mats,q),hash=createHash('sha256');let n=0;r.group.traverse(o=>{if(!o.geometry)return;n+=o.geometry.attributes.position.count;for(const name of ['position','normal','color']){const a=o.geometry.attributes[name];if(a)hash.update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));}});assert.deepEqual({hash:hash.digest('hex'),vertices:n},want,'unchanged default legacy map '+key);}
const a=ctx.M.bridgeVisual(ctx.maps.overpass.bridge,mats),b=ctx.E.buildMap('overpass',mats,'low');
for(const part of ['solid','tun'])assert.deepEqual(Array.from(b.deck[part].geometry.attributes.position.array),Array.from(a.deck[part].geometry.attributes.position.array),'unchanged bridge deck/tunnel topology');
ctx.E.updateMap(b,true);assert.equal(b.top.visible,false);ctx.E.updateMap(b,false);assert.equal(b.top.visible,true);b.dispose();b.dispose();
if(process.env.LUNAR_ENV_METRICS)writeFileSync(process.env.LUNAR_ENV_METRICS,JSON.stringify(metrics,null,2)+'\n');
console.log('PASS HIGH/LOW reductions, six independent mode contexts, eight PR18 byte-identical default maps and exact bridge geometry/fade/disposal');
