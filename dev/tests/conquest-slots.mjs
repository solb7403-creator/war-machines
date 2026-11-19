// Session 5E-2d1 world kit (js/conquest/slots.js, worldkit.js, kit/*.js): the one model list and its code-built models.
//  - every slot has the manifest fields, a code-built model on HIGH and on LOW, finite geometry inside its slot box, and a LOW
//    model that is lighter than HIGH but still a model (it keeps the silhouette: most of the HIGH box)
//  - a slot's "model" is null or an item of js/assets/meshy-v1/manifest.json; the six town buildings the owner already
//    supplied are listed that way
//  - the swap (owner, Nov 19): listing a Meshy item for a slot replaces the code-built model with instances fitted into the
//    slot's box (size, ground fit and collision come from the slot), and clearing it brings the code-built model back,
//    vertex for vertex. Here with a stand-in for the Meshy loader; dev/tests/conquest-slots-browser.py does it with a real
//    Meshy town model in the real game.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ctx2d=new Proxy({},{get:(o,k)=>k in o?o[k]:k==='createImageData'?(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}):k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:10}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const document={createElement:()=>({width:0,height:0,style:{},getContext:()=>ctx2d}),fonts:{check:()=>true}};
class ImageData{constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4);}}class Path2D{moveTo(){}lineTo(){}rect(){}}
const c=vm.createContext({console,document,performance:{now:()=>0},ImageData,Path2D});
const KIT=fs.readdirSync('js/conquest/kit').filter(f=>f.endsWith('.js')).sort().map(f=>'js/conquest/kit/'+f);
for(const f of ['js/vendor/three.lunar.min.js','js/rules.js','js/conquest/world.js','js/conquest/combat.js','js/conquest/slots.js','js/conquest/worldkit.js',...KIT,'js/conquest/style.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const {THREE:T,ConquestStyle:CS,ConquestSlots:SL,ConquestWorldKit:WK}=c,manifest=JSON.parse(fs.readFileSync('js/assets/meshy-v1/manifest.json','utf8')),ids=Object.keys(SL.items);
// ---- the list ----
assert.ok(SL.version===1&&ids.length>=100,'one model list with a slot per kind ('+ids.length+')');
const FACTIONS=new Set(['military','settler','nature','parasite','wreck','prop','town']);
for(const id of ids){const s=SL.items[id];assert.ok(/^[a-z0-9-]+$/.test(id),'stable id '+id);assert.ok(FACTIONS.has(s.faction)&&typeof s.label==='string'&&s.label.length>2,id+' has a family and a label');
 assert.ok(Array.isArray(s.size)&&s.size.length===3&&s.size.every(v=>Number.isFinite(v)&&v>0),id+' size box');assert.equal(s.fit,'contain',id+' fit');assert.ok(typeof s.solid==='string'&&s.solid.length,id+' names where its collision comes from');
 assert.ok(s.model===null||!!manifest.items[s.model],id+' model is null or a Meshy manifest item: '+s.model);assert.ok(WK.MODELS[id],id+' has a code-built model');}
for(const t of ['cc','refinery','storage','reactor','shield','lab'])assert.equal(SL.items['town-'+t].model,'town-'+t,'the owner\'s Meshy '+t+' fills its slot');
for(const id of Object.keys(WK.MODELS))assert.ok(SL.items[id],'model "'+id+'" is in the list');
assert.throws(()=>WK.swap('no-such-slot','town-cc'),/unknown slot/,'an unknown slot cannot be swapped');
// ---- every model, HIGH and LOW ----
const stats={};let total={high:0,low:0};
for(const low of [false,true]){const S=CS.create(T,{low}),K=WK.kit(S),q=low?'low':'high';assert.equal(K.hi,!low,q+' kit quality follows the style');
 for(const id of ids){const s=SL.items[id],b=K.build(id,{});const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];let n=0;
  for(const B of [b.buf.main,b.buf.det]){assert.equal(B.P.length,B.n*3);assert.equal(B.A.length,B.n*4);for(let i=0;i<B.n;i++){for(let k=0;k<3;k++){const v=B.P[i*3+k];assert.ok(Number.isFinite(v)&&Number.isFinite(B.N[i*3+k]),q+' '+id+' finite');if(v<lo[k])lo[k]=v;if(v>hi[k])hi[k]=v;}
    const a=B.A[i*4+3];assert.ok(a<=2&&a>=-1.3,q+' '+id+' vertex alpha in the emission / surface range: '+a);for(let k=0;k<3;k++)assert.ok(B.A[i*4+k]>=0&&B.A[i*4+k]<8,q+' '+id+' colour');}
   for(const ix of B.I)assert.ok(ix>=0&&ix<B.n,q+' '+id+' index');n+=B.I.length/3;}
  assert.ok(n>=2,q+' '+id+' draws something');
  // inside the slot box: the footprint with a small margin (eaves, cables, spike tips), never taller than the box (+ a mast tip)
  const [w,h,d]=s.size,mx=Math.max(.6,w*.08),mz=Math.max(.6,d*.08);assert.ok(lo[0]>=-w/2-mx&&hi[0]<=w/2+mx&&lo[2]>=-d/2-mz&&hi[2]<=d/2+mz,q+' '+id+' footprint inside its slot box: x '+lo[0].toFixed(2)+'..'+hi[0].toFixed(2)+' z '+lo[2].toFixed(2)+'..'+hi[2].toFixed(2)+' in '+w+' x '+d);
  assert.ok(hi[1]<=h*1.12+.4&&lo[1]>=-Math.max(6.5,h*.2),q+' '+id+' height inside its slot box: '+lo[1].toFixed(2)+'..'+hi[1].toFixed(2)+' in '+h);
  (stats[id]||(stats[id]={}))[q]={n,lo,hi};total[q]+=n;}
 S.dispose();}
for(const id of ids){const H=stats[id].high,L=stats[id].low;assert.ok(L.n<=H.n,id+' LOW is not heavier than HIGH: '+L.n+' vs '+H.n);if(H.n>=400)assert.ok(L.n<=H.n*.62,id+' LOW is clearly lighter: '+L.n+' vs '+H.n);
 // LOW keeps the silhouette: at least 70% of the HIGH model's width, depth and height
 for(let k=0;k<3;k++){const eh=H.hi[k]-H.lo[k],el=L.hi[k]-L.lo[k];if(eh>.5)assert.ok(el>=eh*.7,id+' LOW keeps the silhouette on axis '+k+': '+el.toFixed(2)+' of '+eh.toFixed(2));}}
// ---- the swap, with a stand-in loader ----
{const S=CS.create(T,{low:false}),K=WK.kit(S),id='settler-silo',M4=K.M(10,2,-4,.7),par={w:7,d:7,h:13};
 const run=()=>{const t={main:new S.Bld(),det:new S.Bld(),fx:new S.Fx(),swaps:new Map()};K.place(id,t,M4,par);K.place(id,t,K.M(30,0,5,0),par);return t;};
 const code=run();assert.ok(code.main.n>0&&code.swaps.size===0,'code-built by default');
 // 1. listed, but the model file is not in yet: the code-built model stands in and the slot is remembered as pending
 WK.swap(id,'town-storage');assert.equal(SL.items[id].model,'town-storage');const wait=run();assert.equal(wait.main.n,code.main.n,'code-built until the model has loaded');assert.ok(K.pendingSwap.has(id),'the slot waits for its model');
 // 2. loaded: a 6 x 4 x 9 model (pipeline space, +X front) fitted into each placement's 7 x 13 x 7 box
 const box={min:{x:-3,y:.5,z:-4.5},max:{x:3,y:4.5,z:4.5}};let asked=null;
 c.Meshy3D={enabled:true,slotAsset:i=>(asked=i,{id:i}),slotSet(i,count){const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial(),count),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-Math.PI/2),p=new T.Vector3(),s3=new T.Vector3();
   return {mesh,fit(out,w,h,d){const bw=box.max.z-box.min.z,bd=box.max.x-box.min.x,bh=box.max.y-box.min.y,sc=Math.min(w/bw,d/bd,h/bh);return out.compose(p.set(0,-box.min.y*sc,0),q,s3.set(sc,sc,sc));}};}};
 const sw=run();assert.equal(asked,'town-storage');assert.equal(sw.main.n,0,'the code-built model is not drawn while its slot is swapped');assert.equal(sw.det.n,0);assert.equal(sw.swaps.get(id).length,2,'both placements recorded');
 const meshes=K.swapMeshes(sw.swaps,false);assert.equal(meshes.length,1);const im=meshes[0];assert.ok(im.isInstancedMesh&&im.count===2&&im.userData.slot===id,'one instanced draw for the slot');
 const m=new T.Matrix4(),v=new T.Vector3();im.getMatrixAt(0,m);
 // the model's corners, through the fit and the placement, stay inside the placement's box and stand on its ground
 const inv=M4.clone().invert();let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){v.set(x,y,z).applyMatrix4(m).applyMatrix4(inv);[v.x,v.y,v.z].forEach((q,k)=>{lo[k]=Math.min(lo[k],q);hi[k]=Math.max(hi[k],q);});}
 assert.ok(lo[0]>=-3.501&&hi[0]<=3.501&&lo[2]>=-3.501&&hi[2]<=3.501&&Math.abs(lo[1])<1e-6&&hi[1]<=13.001,'the swapped model is fitted into the slot box and stands on its ground: '+JSON.stringify([lo,hi]));
 assert.ok(Math.max(hi[0]-lo[0],hi[2]-lo[2])>6.9,'...and fills it (uniform scale to the box)');
 // 3. cleared: the code-built model is back, vertex for vertex
 WK.swap(id,null);const back=run();assert.equal(back.swaps.size,0);assert.equal(back.main.n,code.main.n);assert.deepEqual(back.main.P,code.main.P,'swapping back restores the code-built model exactly');
 delete c.Meshy3D;S.dispose();}
const heavy=ids.map(id=>[id,stats[id].high.n,stats[id].low.n]).sort((a,b)=>b[1]-a[1]).slice(0,8).map(r=>r.join(':')).join(' ');
console.log('PASS conquest-slots: '+ids.length+' slots, every one code-built on HIGH and LOW inside its box ('+total.high+' / '+total.low+' triangles for one of each), swap to a model and back; heaviest '+heavy);
