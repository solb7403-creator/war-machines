// Actual engine exports and UV/PBR sample contracts; no accounts or network.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),ctx=createContext({console,URL,Float32Array,Uint8Array});
for(const p of ['js/vendor/three.lunar.min.js','js/rules.js','js/models3d.js'])runInContext(readFileSync(new URL(p,root),'utf8'),ctx);
assert.equal(typeof ctx.THREE.MeshStandardMaterial,'function','real PBR class must ship in the vendored runtime');
runInContext(readFileSync(new URL('js/equipment3d.js',root),'utf8'),ctx);runInContext('globalThis.H=Equipment3D;',ctx);
const H=ctx.H;assert.equal(H.enabled,false,'safe default: existing collection unchanged');
runInContext("globalThis.existing=[M3.chassisKit('vanguard',0,PAINTS.stock,'#4d9fff',['dmg','rof','arm'],false),M3.chassisKit('vanguard',0,PAINTS.stock,'#4d9fff',['dmg','rof','arm'],true),M3.weaponKit('moon',2,PAINTS.stock,'#4d9fff',false,'vanguard')];globalThis.oldBake=M3.bake;",ctx);
assert.deepEqual(Array.from(ctx.existing,r=>[r.k,...r.anims.map(a=>a.k)].reduce((sum,k)=>sum+Object.values(ctx.oldBake(k)).filter(Boolean).reduce((n,g)=>n+g.attributes.position.count,0),0)),[27300,29928,27684],'loading the optional library cannot replace existing default models (Lunar 29928: the overlay conduits)');
for(const quality of ['high','low'])for(const lunar of [false,true]){
 const h=H.chassisKit('vanguard',0,{hull:'#2c3a49',tur:'#3b4a5b',trim:'#d5dee7'},'#4d9fff',['dmg','rof','arm'],lunar,quality),w=H.weaponKit('moon',2,{},'#4d9fff',lunar,'vanguard',quality);
 for(const [kind,r] of [['hull',h],['weapon',w]]){
  let n=0;for(const k of [r.k,...r.anims.map(a=>a.k)])for(const g of Object.values(H.bake(k))){if(!g)continue;n+=g.attributes.position.count;for(const id of ['position','normal','uv','tangent'])assert.ok(g.attributes[id]?.array.every(Number.isFinite),quality+' '+kind+' '+id);assert.equal(g.attributes.uv.count,g.attributes.position.count);assert.equal(g.attributes.tangent.itemSize,4);g.dispose();}
  assert.ok(n>1000&&n<(quality==='high'?65000:23000),quality+' bounded sample '+kind+' '+n);
 }
 assert.equal(h.meta.ty,.777);assert.equal(h.meta.bob,0);assert.equal(w.meta.tips.length,1);assert.ok(Math.abs(w.meta.tips[0][0]-2.35)<.04);
}
const hi=H.chassisKit('vanguard',0,{},'#4d9fff',[],true,'high'),lo=H.chassisKit('vanguard',0,{},'#4d9fff',[],true,'low');
const count=r=>Object.values(H.bake(r.k)).filter(Boolean).reduce((n,g)=>n+g.attributes.position.count,0);assert.ok(count(lo)<count(hi)*.65,'LOW must actually reduce geometry');
console.log('PASS real PBR exports, UV/tangent/material batching, modular metadata, bounded HIGH/LOW sample, safe default');

// Shared mesh ownership: acquiring a hull must not evict its prebuilt but not-yet-attached weapon.
const owners=[];for(let i=0;i<8;i++){const r=H.chassisKit('vanguard',0,{hull:'#'+(0x253140+i*70).toString(16),tur:'#394551',trim:'#abcddf'},'#4d9fff',[],false,'high');const b=H.bake(r.k),g=new ctx.THREE.Group();H.retain(b,g);owners.push(g);}
const pending=H.weaponKit('moon',2,{},'#4d9fff',true,'vanguard','high'),pb=H.bake(pending.k),other=H.chassisKit('vanguard',0,{hull:'#8a6342'},'#4d9fff',[],false,'high'),ob=H.bake(other.k),og=new ctx.THREE.Group();H.retain(ob,og);owners.push(og);const wg=new ctx.THREE.Group();H.retain(pb,wg);assert.equal(typeof wg.userData.hfRelease,'function','pending modular weapon retains asset ownership');owners.push(wg);owners.forEach(o=>H.releaseTree(o));assert.equal(H.stats().geometry.refs,0);assert.ok(H.stats().geometry.bytes<14*1024*1024,'idle assets return below budget');
console.log('PASS weighted geometry LRU, active mesh leases, pending working pair, release/disposal');
const manifest=JSON.parse(readFileSync(new URL('js/assets/hf-v1/manifest.json',root)));assert.equal(manifest.version,H.VERSION);let bytes=0;
for(const entry of manifest.files){const file=readFileSync(new URL('js/assets/hf-v1/'+entry.file,root));assert.equal(file.length,entry.bytes);assert.equal(createHash('sha256').update(file).digest('hex'),entry.sha256);assert.equal(file.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(file.readUInt32BE(16),entry.file.includes('high')?512:128);assert.equal(file.readUInt32BE(20),file.readUInt32BE(16));bytes+=file.length;}
assert.ok(bytes<650*1024,'original local texture transfer budget');assert.equal(ctx.THREE.REVISION,'169');
console.log('PASS packaged atlas PNG dimensions/checksums/transfer cap and pinned Three r169',bytes);
