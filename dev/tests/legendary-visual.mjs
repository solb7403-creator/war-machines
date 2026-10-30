// Final approved legends: actual shared THREE geometry and unchanged PR15 standards.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const ctx=createContext({console}),root=new URL('../../',import.meta.url);
for(const f of ['js/vendor/three.lunar.min.js','js/rules.js','js/models3d.js'])runInContext(readFileSync(new URL(f,root),'utf8'),ctx);
runInContext('globalThis.R={M:M3,PAINTS,CHORDER,WORDER,STOCK_L,tankOf};',ctx);
const {M,PAINTS,CHORDER,WORDER,STOCK_L,tankOf}=ctx.R,measure=[];
function check(raw,label,budget){
 let vertices=0,calls=0;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const item of [{k:raw.k,p:[0,0,0]},...raw.anims])for(const g of Object.values(M.bake(item.k))){if(!g)continue;calls++;const p=g.attributes.position.array,N=g.attributes.normal.array;assert.ok(p.every(Number.isFinite)&&N.every(Number.isFinite),label+' finite');vertices+=p.length/3;for(let i=0;i<p.length;i++){lo[i%3]=Math.min(lo[i%3],p[i]+item.p[i%3]);hi[i%3]=Math.max(hi[i%3],p[i]+item.p[i%3]);}for(let i=0;i<N.length;i+=3)assert.ok((Math.hypot(...N.slice(i,i+3))<.00001||Math.abs(Math.hypot(...N.slice(i,i+3))-1)<.003),label+' normals');g.dispose();}
 assert.ok(vertices>1000&&vertices<budget,label+' bounded '+vertices);assert.ok(lo.every(v=>v>=-1.7)&&hi.every(v=>v<3.1),label+' scale');return {label,vertices,calls,lo,hi};
}
let mounts=0;
for(const cls of CHORDER)for(let t=0;t<3;t++){
 const h=M.chassisKit(cls,t,PAINTS.stock,'#4d9fff',['dmg','rof','arm'],true),stock=M.chassisKit(cls,t,PAINTS.stock,'#4d9fff',[],false);
 assert.equal(h.meta.bob,0,'Lunar is grounded and tracked, no hover');assert.equal(h.meta.ty,stock.meta.ty,'same class/tier socket');assert.ok(h.anims.every(a=>!a.orb),'no orbit ornaments');
 assert.equal(h.meta.legend,'lunar-black-gold','approved skin path');measure.push(check(h,cls+t,30000));
 for(const arch of [...WORDER,'moon'])for(const wt of (arch==='moon'?[2]:[0,1,2])){const w=M.weaponKit(arch,wt,PAINTS.stock,'#4d9fff',true,cls);const m=check(w,arch,28000);assert.ok(h.meta.ty+m.lo[1]>=h.meta.ty-.002);mounts++;}
 const plain=M.chassisKit(cls,t,PAINTS.stock,'#4d9fff',[],false),moon=M.weaponKit('moon',2,PAINTS.stock,'#4d9fff',false,cls);assert.ok(plain.meta.ty+moon.meta.tips[0][1]>plain.meta.ty);check(moon,cls+t+' independent Moonbeam',28000);mounts++;
}
for(const lunar of [false,true]){
 const w=M.weaponKit('moon',2,PAINTS.stock,'#ff536d',lunar,'scout');assert.equal(w.meta.legend,'moonbeam-unified');assert.equal(w.meta.tips.length,1,'one coherent emitter, no crystal triplet');assert.equal(w.anims.length,2,'two bounded captive charge collars');const m=check(w,'moonbeam-'+lunar,28000);assert.ok(m.hi[0]>2&&m.hi[0]<2.7);assert.ok(Math.abs(w.meta.tips[0][0]-m.hi[0])<.03,'actual emitter tip');assert.ok(w.meta.tips[0][1]>.45);measure.push(m);
}
const L=JSON.parse(JSON.stringify(STOCK_L)),a=tankOf(L,1);L.skin='lunar';const b=tankOf(L,1);assert.equal(b.mhp,Math.round(a.mhp*1.08),'existing +8% health');assert.equal(b.dmgM,a.dmgM*1.08,'existing +8% damage');
if(process.env.LEGEND_METRICS)writeFileSync(process.env.LEGEND_METRICS,JSON.stringify({mounts,measure},null,2));
console.log('PASS final legendary geometry, 9 chassis,',mounts,'legend/standard mounts, single emitter, normals/bounds/batching and unchanged skin bonuses');
