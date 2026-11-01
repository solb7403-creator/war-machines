// Exhaustive actual THREE model contracts; no mocked geometry, accounts or production services.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),ctx=createContext({console});
for(const p of ['js/vendor/three.lunar.min.js','js/rules.js','js/models3d.js'])runInContext(readFileSync(new URL(p,root),'utf8'),ctx);
runInContext('globalThis.R={M:M3,CHORDER,WORDER,PAINTS,GORDER,FITS,FIT_ORDER,STOCK_L,tankOf,machineMetrics};',ctx);const {M,CHORDER,WORDER,PAINTS,GORDER,FITS,FIT_ORDER,STOCK_L}=ctx.R;
const metrics=[],hashes={c:[],w:[]};
function check(raw,label,budget){
 const all=[{k:raw.k,p:[0,0,0]},...raw.anims],lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];let n=0;const hash=createHash('sha256');
 for(const item of all){const baked=M.bake(item.k);assert.ok(Object.values(baked).filter(Boolean).length<=3,label+' batching');for(const g of Object.values(baked)){if(!g)continue;const p=g.attributes.position.array,N=g.attributes.normal.array;assert.equal(N.length,p.length);assert.ok(p.every(Number.isFinite)&&N.every(Number.isFinite),label+' finite positions/normals');for(let i=0;i<p.length;i++){lo[i%3]=Math.min(lo[i%3],p[i]+item.p[i%3]);hi[i%3]=Math.max(hi[i%3],p[i]+item.p[i%3]);}for(let i=0;i<N.length;i+=3){const d=Math.hypot(N[i],N[i+1],N[i+2]);assert.ok(d<.00001||Math.abs(d-1)<.003,label+' normal unit length');}hash.update(Buffer.from(p.buffer,p.byteOffset,p.byteLength));n+=p.length/3;g.dispose();}}
 assert.ok(n>100&&n<budget,label+' bounded vertices '+n);assert.ok(lo.every(v=>v> -2)&&hi.every(v=>v<3),label+' bounded local scale');
 for(const a of raw.anims){assert.ok(a.p.every(Number.isFinite));assert.ok(['x','y','z',undefined].includes(a.axis));assert.ok(Number.isFinite(a.spd));}
 return {n,lo,hi,hash:hash.digest('hex')};
}
for(const cls of CHORDER)for(let t=0;t<3;t++){
 const raw=M.chassisKit(cls,t,PAINTS.stock,'#4d9fff',GORDER.slice(0,3),false),meta=raw.meta;for(const g of Object.values(raw.k).flat()){const a=g.attributes.position.array;for(let i=0;i<a.length;i+=3)if(Math.hypot(a[i],a[i+2])<.43)assert.ok(a[i+1]<=meta.ty+.04,cls+t+' clear central mounting socket');}const c=check(raw,cls+t,30000);assert.equal(meta.bob,0,'all standard chassis tracked');assert.ok(meta.ty>.4&&meta.ty<1,'socket height inside the class ladder (Scout .45 to Colossus .96)');assert.ok(meta.ty>c.lo[1]);assert.ok(meta.halos.length>=2);metrics.push({kind:'chassis',id:cls,tier:t,vertices:c.n,mount:meta.ty,bounds:[c.lo,c.hi]});hashes.c.push(c.hash);
}
for(const arch of WORDER)for(let t=0;t<3;t++){
 const raw=M.weaponKit(arch,t,PAINTS.stock,'#4d9fff',false,'vanguard'),meta=raw.meta,w=check(raw,arch+t,16000);assert.equal(meta.tips.length,arch==='twin'||arch==='siege'&&t===2?2:1);assert.ok(w.lo[1]>=-.001,arch+t+' weapon sits above socket plane '+w.lo[1]);for(const tip of meta.tips){assert.ok(tip.every(Number.isFinite)&&tip[0]>1.3);assert.ok(Math.abs(tip[0]-w.hi[0])<.05,'tip tracks actual bore end');}metrics.push({kind:'weapon',id:arch,tier:t,vertices:w.n,tips:meta.tips,bounds:[w.lo,w.hi]});hashes.w.push(w.hash);
}
assert.equal(new Set(hashes.c).size,9,'nine geometrically distinct chassis');assert.equal(new Set(hashes.w).size,9,'nine geometrically distinct weapons');
let pairings=0;
for(const cls of CHORDER)for(let ct=0;ct<3;ct++)for(const arch of WORDER)for(let wt=0;wt<3;wt++){
 const h=M.chassisKit(cls,ct,PAINTS.stock,'#f85a75',[],false),w=M.weaponKit(arch,wt,PAINTS.stock,'#f85a75',false,cls);
 assert.ok(w.meta.tips[0][1]>.2&&h.meta.ty+w.meta.tips[0][1]>.6,'muzzle clears the hull (the low Scout sockets sit at .45-.49)');check(h,cls+ct+' '+arch+wt,30000);check(w,arch+wt,16000);pairings++;
}
let appearances=0;
for(const paint of Object.values(PAINTS))for(const cls of CHORDER)for(const team of ['#4d9fff','#ff536d']){
 const h=M.chassisKit(cls,2,paint,team,GORDER.slice(3),false);check(h,cls+' paint',30000);appearances++;
}
for(const cls of CHORDER){
 const a=check(M.chassisKit(cls,-1,PAINTS.stock,'#4d9fff',[],false),'legacy',30000),b=check(M.chassisKit(cls,0,PAINTS.stock,'#4d9fff',[],false),'T0',30000);assert.equal(a.hash,b.hash);
}
for(const arch of WORDER){assert.equal(check(M.weaponKit(arch,-1,PAINTS.stock,'#4d9fff',false,'vanguard'),'legacy w',16000).hash,check(M.weaponKit(arch,0,PAINTS.stock,'#4d9fff',false,'vanguard'),'T0 w',16000).hash);}
// Visual tier canonicalization never changes original rolled/salvaged equipment data or tank statistics.
const original=JSON.stringify(STOCK_L),before=JSON.stringify(ctx.R.tankOf(STOCK_L,1));check(M.chassisKit('vanguard',STOCK_L.c.t,PAINTS.stock,'#4d9fff',STOCK_L.cores,false),'stock',30000);assert.equal(JSON.stringify(STOCK_L),original);assert.equal(JSON.stringify(ctx.R.tankOf(STOCK_L,1)),before);

let fittings=0;
for(const cls of CHORDER)for(let ct=0;ct<3;ct++)for(const hull of Object.keys(FITS.hull))for(const mobility of Object.keys(FITS.mobility))for(const mount of Object.keys(FITS.mount)){
 const f={hull,mobility,mount};for(const part of ['body','mount']){const r=M.fittingKit(f,'#4d9fff',part,{cls,ct,arch:'siege',wt:2,lunar:false}),b=M.bake(r.k);for(const g of Object.values(b)){if(!g)continue;assert.ok(g.attributes.position.array.every(Number.isFinite));assert.ok(g.attributes.position.count<5000);g.dispose();}}fittings++;
}

const results={pairings,appearances,fittings,models:metrics,maxChassis:Math.max(...metrics.filter(x=>x.kind==='chassis').map(x=>x.vertices)),maxWeapon:Math.max(...metrics.filter(x=>x.kind==='weapon').map(x=>x.vertices))};
if(process.env.VISUAL_METRICS)writeFileSync(process.env.VISUAL_METRICS,JSON.stringify(results,null,2));
console.log('PASS 9 chassis, 9 weapons,',pairings,'pairings,',fittings,'fitting combinations,',appearances,'paint/team/core combinations, distinct tiers, bounded meshes/normals/mounts/muzzle tips/animations and legacy stock parity',JSON.stringify({maxChassis:results.maxChassis,maxWeapon:results.maxWeapon}));
await import('./defender-isolation.mjs');
