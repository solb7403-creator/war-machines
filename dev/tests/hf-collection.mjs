// Complete opted-in visual collection: actual shared THREE/M3, no service or account calls.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),ctx=createContext({console,URL,Float32Array,Uint8Array});
for(const p of ['js/vendor/three.lunar.min.js','js/rules.js','js/models3d.js','js/equipment3d.js'])runInContext(readFileSync(new URL(p,root),'utf8'),ctx);
runInContext('globalThis.H=Equipment3D;globalThis.M=M3;globalThis.P=PAINTS.stock;',ctx);
const {H,M,P}=ctx,classes=['scout','vanguard','titan'],arches=['pulse','twin','siege'],results=[],hashes=new Set();
assert.equal(H.enabled,false,'public default must stay legacy');
for(const cls of classes)for(let t=0;t<3;t++)assert.equal(typeof H.builders[`chassis:${cls}:${t}`],'function',`missing real HIGH/LOW chassis ${cls} T${t}`);
for(const arch of arches)for(let t=0;t<3;t++)assert.equal(typeof H.builders[`weapon:${arch}:${t}`],'function',`missing real HIGH/LOW weapon ${arch} T${t}`);
function inspect(r,label,quality){
 assert.equal(r.k.hf,true,'no silent legacy fallback: '+label);let n=0,hash=createHash('sha256'),bound={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(const [k,offset] of [[r.k,[0,0,0]],...r.anims.map(a=>[a.k,a.p])])for(const g of Object.values(H.bake(k))){
  for(const name of ['position','normal','uv','uv1','tangent','color']){const a=g.attributes[name];assert.ok(a?.array.every(Number.isFinite),label+' finite '+name);assert.equal(a.count,g.attributes.position.count);}
  for(const v of g.attributes.uv.array)assert.ok(v>=0&&v<=1,label+' atlas UV');
  for(let j=0;j<g.attributes.position.array.length;j++){const d=j%3,v=g.attributes.position.array[j]+offset[d];bound.min[d]=Math.min(bound.min[d],v);bound.max[d]=Math.max(bound.max[d],v);}n+=g.attributes.position.count;hash.update(new Uint8Array(g.attributes.position.array.buffer));
  const ts=g.attributes.tangent.array;for(let i=0;i<g.attributes.normal.count;i++){const a=g.attributes.normal.array,j=i*3,k=i*4;assert.ok(Math.abs(a[j]*ts[k]+a[j+1]*ts[k+1]+a[j+2]*ts[k+2])<.01,label+' orthogonal tangents');}
  const ns=g.attributes.normal.array;for(let i=0;i<ns.length;i+=3)assert.ok(Math.abs(Math.hypot(ns[i],ns[i+1],ns[i+2])-1)<.02,label+' unit normals');
 }
 assert.ok(n>1000&&n<(quality==='high'?65000:23000),`${label} geometry budget ${n}`);
 assert.ok(bound.min[0]> -1.8&&bound.max[0]<2.6&&bound.min[2]> -1.5&&bound.max[2]<1.5&&bound.min[1]> -.15&&bound.max[1]<1.2,label+' bounded mount/frame '+JSON.stringify(bound));
 return {label,quality,vertices:n,hash:hash.digest('hex'),bounds:{min:bound.min,max:bound.max}};
}
let standard=0,legendary=0;
for(const q of ['high','low']){
 const hulls=[],guns=[];
 for(const cls of classes)for(let t=0;t<3;t++)for(const lunar of [false,true]){
  const r=H.chassisKit(cls,t,P,'#67c7e9',['dmg','rof','arm'],lunar,q),x=inspect(r,`${cls}:${t}:${lunar}`,q);
  assert.equal(r.meta.halos.length,2,'both physical headlights keep effect anchors');assert.equal(r.meta.ty,M.CHASSIS_VISUALS[cls][t].ring);assert.equal(r.meta.bob,0);assert.ok(!hashes.has(x.hash),'distinct class/tier silhouettes '+x.label);hashes.add(x.hash);results.push(x);hulls.push({cls,t,lunar,r});
 }
 for(const arch of [...arches,'moon'])for(const t of arch==='moon'?[2]:[0,1,2]){
  const r=H.weaponKit(arch,t,P,'#67c7e9',false,'vanguard',q),x=inspect(r,`${arch}:${t}`,q),legacy=M.foundationWeapon(arch,t,P,'#67c7e9',false,'vanguard');
  assert.equal(JSON.stringify(r.meta.tips),JSON.stringify(legacy.meta.tips),'unchanged actual muzzle origins '+arch+t);
  assert.ok(!hashes.has(x.hash),'geometrically distinct weapon '+x.label);hashes.add(x.hash);results.push(x);guns.push({arch,t,r});
 }
 for(const h of hulls)for(const w of guns){
  assert.ok(w.r.meta.tips.every(p=>p[1]+h.r.meta.ty>h.r.meta.ty+.1),'barrel above deck');
  if(!h.lunar&&w.arch!=='moon')standard++;else legendary++;
 }
 const moon=H.weaponKit('moon',2,P,'#67c7e9',false,'scout',q);
 assert.strictEqual(moon,H.weaponKit('moon',2,{},'#67c7e9',true,'titan',q),'ONE independent Moonbeam family across class/skin');
}
assert.equal(standard,162);assert.equal(legendary,198);
for(const hi of results.filter(x=>x.quality==='high')){const lo=results.find(x=>x.quality==='low'&&x.label===hi.label);assert.ok(lo.vertices<hi.vertices*.65,hi.label+' genuinely cheaper LOW');}
// Existing material/ownership lease contract is used, even at full-catalog cache pressure.
const leases=[];for(const cls of classes)for(let t=0;t<3;t++){const r=H.chassisKit(cls,t,P,'#45aaff',[],true,'high'),b=H.bake(r.k),g=new ctx.THREE.Group();H.retain(b,g);leases.push(g);}
assert.ok(H.stats().geometry.active>=9);assert.equal(H.dispose(),false,'never dispose actors in use');leases.forEach(x=>H.releaseTree(x));assert.equal(H.stats().geometry.refs,0);assert.ok(H.stats().geometry.bytes<14*1024*1024,'bounded idle LRU');
for(const cls of classes){const a=H.chassisKit(cls,-1,P,'#45aaff',[],false,'high'),b=H.chassisKit(cls,0,P,'#45aaff',[],false,'high');assert.strictEqual(a,b,'legacy stock normalized');}
assert.throws(()=>H.chassisKit('forged',0,P,'#45aaff',[],false,'high'));
// Representative owned appearance data remains untouched; fitting kits use canonical context.
runInContext('globalThis.A={PAINTS,FITS,GORDER,STOCK_L,tankOf};',ctx);
const untouched=JSON.stringify(ctx.A.STOCK_L),stats=JSON.stringify(ctx.A.tankOf(ctx.A.STOCK_L,1));let appearances=0,fittings=0;
for(const paint of Object.values(ctx.A.PAINTS))for(const cls of classes)for(const team of ['#45aaff','#ff5577']){
 const r=H.chassisKit(cls,2,paint,team,ctx.A.GORDER.slice(0,3),false,'low');assert.equal(r.k.hf,true);for(const g of Object.values(H.bake(r.k)))assert.ok(g.attributes.color.array.every(Number.isFinite));appearances++;
}
for(const cls of classes)for(let ct=0;ct<3;ct++)for(const hull of Object.keys(ctx.A.FITS.hull))for(const mobility of Object.keys(ctx.A.FITS.mobility))for(const mount of Object.keys(ctx.A.FITS.mount)){
 for(const part of ['body','mount'])for(const g of Object.values(M.bake(M.fittingKit({hull,mobility,mount},'#45aaff',part,{cls,ct,arch:'siege',wt:2,lunar:true}).k)))if(g)assert.ok(g.attributes.position.array.every(Number.isFinite));fittings++;
}
assert.equal(JSON.stringify(ctx.A.STOCK_L),untouched);assert.equal(JSON.stringify(ctx.A.tankOf(ctx.A.STOCK_L,1)),stats);assert.equal(appearances,72);assert.equal(fittings,243);

if(process.env.LUNAR_HF_RESULTS)writeFileSync(process.env.LUNAR_HF_RESULTS,JSON.stringify({standardPairingsPerQuality:81,legendaryPairingsPerQuality:99,models:results,appearances,fittings,cache:H.stats()},null,2));
console.log('PASS 9+9 HIGH/LOW, nine adaptive skins, one Moonbeam, 81+99 pairings per quality, exact sockets/tips, 72 paint/team/core and 243 fittings, UV/normals/tangents, distinct geometry, LOW budgets, leases, legacy stock');
