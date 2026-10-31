// Static activation must work on both canonical entries without touching account/save state.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8'),index=read('index.html'),boot=read('web/boot.js');
assert.ok(index.indexOf('js/graphics.js')<index.indexOf('js/equipment3d.js'));assert.ok(boot.indexOf("'graphics'")<boot.indexOf("'equipment3d'"));
assert.match(read('js/graphics.js'),/GraphicsRelease=Object\.freeze\(\{version:'graphics-r1',enabled:true\}\)/,'live nonpayment gear release ships HF enabled');
for(const release of [false,true]){const c=createContext({console});runInContext(read('js/graphics.js').replace(/enabled:(true|false)/,'enabled:'+release),c);runInContext(read('js/equipment3d.js'),c);runInContext('globalThis.activeRelease=Equipment3D.enabled',c);assert.equal(c.activeRelease,release,'one static gate activates/rolls back actual equipment pipeline');}
const m=read('js/render3d.js'),c=createContext({console,performance:{now:()=>0},document:{addEventListener(){}},window:{},navigator:{},Math});
for(const p of ['js/vendor/three.lunar.min.js','js/graphics.js'])runInContext(read(p),c);runInContext(m,c);runInContext('globalThis.R=R3;globalThis.mk=mkPS;globalThis.E=emit;globalThis.F=once;globalThis.step=psStep;globalThis.P=poolGet;globalThis.B=B3;RS=new THREE.Scene()',c);
for(const q of ['high','low']){c.R.q=q;const ps=c.mk(true);for(let i=0;i<20000;i++){c.E(ps,{x:0,y:0,z:0,life:.1,s0:.1,c:'#fff000'});c.F(ps,0,0,0,.1,'#ffffff',1);}assert.ok(ps.live.length<=1200&&ps.n<=1200);if(q==='low')assert.ok(ps.live.length<=420&&ps.n<=420);c.step(ps,2);assert.equal(ps.live.length,0);ps.g.dispose();ps.pts.material.dispose();}
for(let i=0;i<1000;i++)c.P('beam',()=>new c.THREE.Mesh(new c.THREE.BoxGeometry(),new c.THREE.MeshBasicMaterial()));assert.equal(c.B.pool.beam.items.length,16);
console.log('PASS static activation/rollback on both entries; actual renderer particle and effect pool bounds');
