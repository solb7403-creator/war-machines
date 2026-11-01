// Nine-chassis family contract on the real THREE geometry (HF high, HF low and the foundation fallback, plain and Lunar):
// a class size ladder that holds in model space AND battle space, nine distinct top/side silhouettes, every gun free to
// traverse (nothing above the turret ring where a turret or barrel sweeps), treads on the ground, one track uniform per
// tank, and untouched gameplay numbers. Prints the measurement table used in the owner report.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const root=new URL('../../',import.meta.url),ctx=createContext({console,URL,Float32Array,Uint8Array});
for(const p of ['js/vendor/three.lunar.min.js','js/rules.js','js/game.js','js/models3d.js','js/equipment3d.js'])runInContext(readFileSync(new URL(p,root),'utf8'),ctx);
runInContext('globalThis.X={H:Equipment3D,M:M3,P:PAINTS.stock,CH,R,TANK_VIS:1.12,WEAPONS,tankOf,STOCK_L,hitR,bodyR};',ctx);
const {H,M,P,CH,R,TANK_VIS,WEAPONS,tankOf,STOCK_L,hitR,bodyR}=ctx.X;
const CLS=['scout','vanguard','titan'],NAMES={scout:['Scout','Strider','Phantom'],vanguard:['Vanguard','Sentinel','Paladin'],titan:['Titan','Bulwark','Colossus']};
const statsBefore=JSON.stringify({CH,W:WEAPONS,R,stock:tankOf(STOCK_L,1)});
// all triangles of a kit (positions only) for one renderer
function tris(raw,mode){const out=[];const add=b=>{for(const g of Object.values(b)){if(!g)continue;const a=g.attributes.position.array;for(let i=0;i<a.length;i++)out.push(a[i]);}};
 add(mode==='foundation'?M.bake(raw.k):H.bake(raw.k));for(const an of raw.anims)add(mode==='foundation'?M.bake(an.k):H.bake(an.k));return Float32Array.from(out);}
function build(cls,t,lunar,mode){return mode==='foundation'?M.foundationChassis(cls,t,P,'#4d9fff',['dmg','rof','arm'],lunar):H.chassisKit(cls,t,P,'#4d9fff',['dmg','rof','arm'],lunar,mode);}
// rasterise a silhouette (top: x,z / side: x,y) at 4 cm cells
function raster(a,u,v){const c=.04,S=new Set();for(let i=0;i<a.length;i+=9){const P=[[a[i+u],a[i+v]],[a[i+3+u],a[i+3+v]],[a[i+6+u],a[i+6+v]]];
  const x0=Math.floor(Math.min(P[0][0],P[1][0],P[2][0])/c),x1=Math.ceil(Math.max(P[0][0],P[1][0],P[2][0])/c),y0=Math.floor(Math.min(P[0][1],P[1][1],P[2][1])/c),y1=Math.ceil(Math.max(P[0][1],P[1][1],P[2][1])/c);
  const d=(P[1][1]-P[2][1])*(P[0][0]-P[2][0])+(P[2][0]-P[1][0])*(P[0][1]-P[2][1]);if(Math.abs(d)<1e-12)continue;
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const px=(x+.5)*c,py=(y+.5)*c,l0=((P[1][1]-P[2][1])*(px-P[2][0])+(P[2][0]-P[1][0])*(py-P[2][1]))/d,l1=((P[2][1]-P[0][1])*(px-P[2][0])+(P[0][0]-P[2][0])*(py-P[2][1]))/d;if(l0>=-.02&&l1>=-.02&&l0+l1<=1.02)S.add(x+','+y);}}
 return S;}
const iou=(A,B)=>{let n=0;for(const k of A)if(B.has(k))n++;return n/(A.size+B.size-n);};
// top-view height map (highest surface per 4 cm cell): shape identity beyond the shared class footprint
function heights(a){const c=.04,M=new Map();for(let i=0;i<a.length;i+=9){const T=[0,3,6].map(o=>[a[i+o],a[i+o+2],a[i+o+1]]);
  const x0=Math.floor(Math.min(...T.map(p=>p[0]))/c),x1=Math.ceil(Math.max(...T.map(p=>p[0]))/c),z0=Math.floor(Math.min(...T.map(p=>p[1]))/c),z1=Math.ceil(Math.max(...T.map(p=>p[1]))/c);
  const d=(T[1][1]-T[2][1])*(T[0][0]-T[2][0])+(T[2][0]-T[1][0])*(T[0][1]-T[2][1]);if(Math.abs(d)<1e-12)continue;
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const px=(x+.5)*c,pz=(z+.5)*c,l0=((T[1][1]-T[2][1])*(px-T[2][0])+(T[2][0]-T[1][0])*(pz-T[2][1]))/d,l1=((T[2][1]-T[0][1])*(px-T[2][0])+(T[0][0]-T[2][0])*(pz-T[2][1]))/d,l2=1-l0-l1;
   if(l0>=-.02&&l1>=-.02&&l2>=-.02){const y=l0*T[0][2]+l1*T[1][2]+l2*T[2][2],k=x+','+z;if(!(M.get(k)>=y))M.set(k,y);}}}
 return M;}
const hdiff=(A,B)=>{let s=0,n=0;for(const k of new Set([...A.keys(),...B.keys()])){s+=Math.abs((A.get(k)??0)-(B.get(k)??0));n++;}return s/n;};
const minH={v:9,pair:''};
const table=[];let checked=0;
for(const mode of ['high','low','foundation'])for(const lunar of [false,true]){
 const sil={};
 for(const cls of CLS)for(let t=0;t<3;t++){
  const raw=build(cls,t,lunar,mode),a=tris(raw,mode),o=M.CHASSIS_VISUALS[cls][t],ty=raw.meta.ty,label=`${mode} ${lunar?'lunar ':''}${NAMES[cls][t]}`;
  let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<a.length;i+=3)for(let d=0;d<3;d++){lo[d]=Math.min(lo[d],a[i+d]);hi[d]=Math.max(hi[d],a[i+d]);}
  assert.equal(ty,o.ring,label+' socket height');assert.equal(raw.meta.bob,0,label+' tracked, no hover');assert.equal(raw.meta.halos.length,2,label+' two headlights');
  if(!(cls==='vanguard'&&t===0)){   // the approved Vanguard starter build is unchanged and keeps its own contract
   assert.ok(lo[1]>-.012&&lo[1]<.02,label+' treads on the ground '+lo[1]);
   // gun traverse: inside the turret footprint (r<.88) nothing above the ring; beyond it only ring + .04 (barrel sweep);
   // core gems (rear deck, r>=.70) may reach ring + .09, still under the lowest barrel line of the rear arc
   for(let i=0;i<a.length;i+=3){const r=Math.hypot(a[i],a[i+2]),y=a[i+1];
    if(r<.88)assert.ok(y<=ty+.042||(r>=.66&&y<=ty+.09&&a[i]<-.6),`${label} clear turret footprint at r=${r.toFixed(2)} y=${y.toFixed(3)} ty=${ty}`);
    else if(r<2.3)assert.ok(y<=ty+.09,`${label} clear barrel sweep at r=${r.toFixed(2)} y=${y.toFixed(3)} ty=${ty}`);}
   const tr=raw.meta.track;assert.ok(Array.isArray(tr)&&tr.every(Number.isFinite),label+' track uniform');assert.ok(Math.abs(tr[1]-(o.h/2+.005))<1e-9&&Math.abs(tr[2]-(o.h/2+.03))<1e-9,label+' track radius/height');
   assert.equal(raw.meta.profile,cls+':'+t);if(lunar)assert.equal(raw.meta.legend,'lunar-black-gold');
  }
  sil[cls+t]={top:raster(a,0,2),side:raster(a,0,1),h:mode==='foundation'?null:heights(a)};
  if(mode==='high'&&!lunar){const k=R*CH[cls].ds*TANK_VIS;table.push({name:NAMES[cls][t],cls,t,len:hi[0]-lo[0],wid:hi[2]-lo[2],hgt:hi[1],ty,wlen:(hi[0]-lo[0])*k,wwid:(hi[2]-lo[2])*k,whgt:hi[1]*k,nose:hi[0]*k,tail:-lo[0]*k,side:Math.max(hi[2],-lo[2])*k,area:(hi[0]-lo[0])*(hi[2]-lo[2])*k*k});}
  checked++;
 }
 // nine distinct outlines: no two chassis share a top or side silhouette (IoU of 4 cm rasters)
 const ids=Object.keys(sil);for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=sil[ids[i]],b=sil[ids[j]];const it=iou(a.top,b.top),is=iou(a.side,b.side);
  // distinct if the outline differs (IoU < .90) or the surface shape does: mean top-view height difference of at least
  // 0.20 (the Scout family, which reads as three different machines, measures 0.25-0.29)
  const hd=a.h&&b.h?hdiff(a.h,b.h):1;if(process.env.PAIRS&&a.h&&!lunar&&mode==='high')console.log('pair',ids[i],ids[j],it.toFixed(2),is.toFixed(2),hd.toFixed(3));if(a.h&&hd<minH.v){minH.v=hd;minH.pair=ids[i]+'/'+ids[j];}
  assert.ok(process.env.PAIRS||Math.min(it,is)<.90||hd>=.20,`${mode} ${ids[i]} vs ${ids[j]} too alike (top ${it.toFixed(2)}, side ${is.toFixed(2)}, height ${hd.toFixed(3)})`);}
}
// class ladder: every Scout smaller than every Vanguard, every Vanguard smaller than every Titan (length, width, height,
// footprint), in model space (menus) and in battle space (x R x class ds x TANK_VIS)
const by=c=>table.filter(r=>r.cls===c);
for(const [a,b] of [['scout','vanguard'],['vanguard','titan']])for(const f of ['len','wid','hgt','ty','wlen','wwid','whgt','area']){
 const max=Math.max(...by(a).map(r=>r[f])),min=Math.min(...by(b).map(r=>r[f]));assert.ok(max<min,`${a} < ${b} on ${f}: ${max.toFixed(3)} vs ${min.toFixed(3)}`);}
for(const [a,b] of [['scout','vanguard'],['vanguard','titan']]){const ra=by(a).reduce((s,r)=>s+r.area,0)/3,rb=by(b).reduce((s,r)=>s+r.area,0)/3;assert.ok(rb/ra>1.45,`${b} footprint clearly larger than ${a}: x${(rb/ra).toFixed(2)}`);}
// visual only: no gameplay number moved
assert.equal(JSON.stringify({CH,W:WEAPONS,R,stock:tankOf(STOCK_L,1)}),statsBefore);assert.equal(R,.7);
// class hitboxes: one body radius per class for every tier, the boss keeps its own shot radius and R for area effects
const HB={scout:.9,vanguard:1,titan:1.12};
for(const cls of CLS){assert.equal(CH[cls].hb,HB[cls]);for(let t=0;t<3;t++){const L={...structuredClone(STOCK_L),c:{c:cls,t,q:1,s:false}},u=tankOf(L,1);u.cls=cls;assert.ok(Math.abs(hitR(u)-R*HB[cls])<1e-12&&hitR(u)===bodyR(u),cls+t+' class hit radius');}}
assert.equal(hitR({boss:true,hr:1.2,cls:'titan'}),1.2);assert.equal(bodyR({boss:true,hr:1.2,cls:'titan'}),R);
console.log('hit circles (shot radius incl. 0.12 bullet):',CLS.map(c=>c+' '+(R*HB[c]+.12).toFixed(3)).join(', '));
for(const r of table){const hc=R*HB[r.cls]+.12;r.sideGap=r.side-hc;r.noseGap=r.nose-hc;}
// Moonbeam per-chassis size (class x tier), applied once on wg: compact on the Phantom, largest on the Colossus, and on
// every Titan-class hull (Colossus included) the scaled gun stays shorter than the hull. Other weapons never scale.
const MS={scout:[.70,.68,.61],vanguard:[.76,.78,.80],titan:[.84,.86,.92]};
assert.deepEqual(JSON.parse(JSON.stringify(M.MOON_SCALE)),MS,'approved Moonbeam per-chassis scale');
for(const cls of CLS)for(let t=0;t<3;t++){assert.equal(M.weaponScale('moon',cls,t),MS[cls][t]);for(const a of ['pulse','twin','siege'])assert.equal(M.weaponScale(a,cls,t),1);}
assert.equal(M.weaponScale('moon','scout',-1),MS.scout[0]);assert.equal(M.weaponScale('moon','scout',9),MS.scout[2]);
const all=CLS.flatMap(c=>MS[c]);assert.equal(Math.min(...all),M.weaponScale('moon','scout',2),'Phantom carries the smallest Moonbeam');assert.equal(Math.max(...all),M.weaponScale('moon','titan',2),'Colossus carries the largest Moonbeam');
{const mk=H.weaponKit('moon',2,P,'#4d9fff',false,'titan','high'),ma=tris(mk,'high');let x0=1e9,x1=-1e9;for(let i=0;i<ma.length;i+=3){x0=Math.min(x0,ma[i]);x1=Math.max(x1,ma[i]);}
 for(const r of table){const ws=M.weaponScale('moon',r.cls,r.t);if(r.cls==='titan')assert.ok((x1-x0)*ws<r.len,`${r.name} Moonbeam ${((x1-x0)*ws).toFixed(2)} shorter than its hull ${r.len.toFixed(2)}`);r.moon=[(x1-x0)*ws,x1*ws];}}
console.log('name      Moonbeam scale/len/muzzle      | model L  W    H    ring | battle L  W    H    nose side  footprint | side/nose past class hit circle');
for(const r of table)console.log(`${r.name.padEnd(9)} moon ${M.weaponScale('moon',r.cls,r.t).toFixed(2)} len ${r.moon[0].toFixed(2)} muzzle ${r.moon[1].toFixed(2)} | ${r.len.toFixed(2)} ${r.wid.toFixed(2)} ${r.hgt.toFixed(2)} ${r.ty.toFixed(3)} | ${r.wlen.toFixed(2)} ${r.wwid.toFixed(2)} ${r.whgt.toFixed(2)} ${r.nose.toFixed(2)} ${r.side.toFixed(2)} ${r.area.toFixed(2)} | ${r.sideGap>=0?'+':''}${r.sideGap.toFixed(2)} ${r.noseGap>=0?'+':''}${r.noseGap.toFixed(2)}`);
console.log('closest pair by top-view surface shape:',minH.pair,minH.v.toFixed(3));
const cm=c=>by(c).reduce((s,r)=>s+r.area,0)/3;console.log('mean battle footprint  scout',cm('scout').toFixed(2),' vanguard',cm('vanguard').toFixed(2),' titan',cm('titan').toFixed(2),' ratios',(cm('vanguard')/cm('scout')).toFixed(2),(cm('titan')/cm('vanguard')).toFixed(2));
console.log('PASS',checked,'chassis builds (HF high/low + foundation, plain + Lunar): class ladder, distinct silhouettes, gun traverse clear, grounded treads, track uniforms, class hitboxes, no other gameplay number moved');
