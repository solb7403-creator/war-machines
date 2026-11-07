// Neon Frontline art direction (js/conquest/style.js): every builder runs at HIGH and LOW with real THREE, uses only the
// fixed material set (no runtime shader programs), produces finite geometry inside the mobile budgets, and keeps the
// art inside the canonical collision envelopes (habitats, processors, installations, raid cover, Command Base walls,
// rocks) while tree replacements stay low enough to read as passable. Presentation only — no simulation is touched.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST}=await import('../../worker/src/sim.gen.js'),K=CONQUEST.Control; // the server's own baseBlocked()
const ctx2d=new Proxy({},{get:(o,k)=>k in o?o[k]:k==='createImageData'?(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}):k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:10}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const document={createElement:()=>({width:0,height:0,style:{},getContext:()=>ctx2d}),fonts:{check:()=>true}};
const c=vm.createContext({console,document,performance:{now:()=>0}});
for(const f of ['js/vendor/three.lunar.min.js','js/rules.js','js/conquest/world.js','js/conquest/combat.js','js/conquest/style.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const {THREE:T,ConquestStyle:CS,ConquestWorld:W,ConquestCombat:C}=c;
const Box3=(()=>{const g=new T.BoxGeometry(1,1,1);g.computeBoundingBox();return g.boundingBox.constructor;})(); // not exported by the slim build
assert.ok(CS&&typeof CS.create==='function','style module loads without THREE at boot and exposes create()');
const tris=o=>{let n=0;o.traverse(m=>{if(m.isMesh)n+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);});return n;};
function verts(o,filter){const out=[],v=new T.Vector3();o.updateMatrixWorld(true);o.traverse(m=>{if(!m.isMesh||m.isInstancedMesh||(filter&&!filter(m)))return;const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);out.push([v.x,v.y,v.z]);}});return out;}
for(const low of [false,true]){
 const S=CS.create(T,{low}),q=low?'LOW':'HIGH',allowed=new Set(Object.values(S.MAT)),scene=new T.Scene();
 const env=S.environment(scene,null);assert.ok(env.sky&&env.lights.length===3,q+' sky + three lights');
 const base5={tier:5,modules:Object.fromEntries(Object.keys(C.baseDefinition.modules).map(k=>[k,3])),defense:{damage:60}};
 const parts={refuge:S.refuge(),viaduct:S.viaduct(),installs:S.installations(),cover:S.cover(),spire:S.raidSpire(),battery:S.battery(),drone:S.drone(),cache:S.cache(false),wreck:S.cache(true),flag:S.flag(false,false),marker:S.holoMarker(0xffd36b,{height:9}),
  base:[0,1,2,3,4,5].map(t=>S.commandBase(t===5?base5:{tier:t,modules:{}},{paint:'#2c3a49',veteran:t>0,citadel:t>=3}))};
 const items=[];for(let cx=7;cx<=10;cx++)for(let cz=6;cz<=9;cz++)items.push(...W.scenery(cx,cz).map(p=>({...p,cx,cz})));
 const chunks=[];for(let cx=7;cx<=10;cx++)for(let cz=6;cz<=9;cz++){const g=S.props(W.scenery(cx,cz),cx,cz);g.position.set(cx*128,0,cz*128);chunks.push(g);
  const inst=g.children.filter(m=>m.isInstancedMesh);assert.ok(inst.length<=(low?3:5),q+' instanced draws per fine chunk within budget: '+inst.length);}
 // Fixed material set + finite data everywhere.
 for(const g of [env.sky,...Object.values(parts).flat(),...chunks])g.traverse(m=>{if(!m.isMesh)return;assert.ok(allowed.has(m.material),q+' only style materials: '+(m.name||m.parent?.name));for(const a of Object.values(m.geometry.attributes))for(const x of a.array)assert.ok(Number.isFinite(x),q+' finite attribute data');});
 // Budgets (triangles per structure group; the whole Refuge is one solid + one fx draw).
 const budget={refuge:low?70000:90000,viaduct:16000,spire:2000,battery:6000,drone:3000};for(const [k,max] of Object.entries(budget))assert.ok(tris(parts[k])<=max,q+' '+k+' triangles '+tris(parts[k])+' <= '+max);
 for(const g of parts.installs)assert.ok(tris(g)<=12000,q+' installation triangles '+tris(g));for(const g of parts.base)assert.ok(tris(g)<=40000,q+' base triangles '+tris(g));
 assert.equal(parts.refuge.children.filter(m=>m.isMesh).length,2,q+' Refuge = 2 draws');
 const solid=m=>m.material===S.MAT.solid;
 // Habitats: solid art within 8.8 m of each centre (sim blocks tanks inside 7.8 m).
 const F=S.footprints,rv=verts(parts.refuge,solid);
 for(const h of F.habitats){const g=W.groundAt(h.x,h.z);let r=0;for(const [x,y,z] of rv){const d=Math.hypot(x-h.x,z-h.z);if(d<11&&y>g+.7&&y<g+9)r=Math.max(r,d);}assert.ok(r>7&&r<=8.8,q+' habitat envelope '+r.toFixed(2));}
 for(const p of F.processors){const g=W.groundAt(p.x,p.z);let r=0;for(const [x,y,z] of rv){const d=Math.hypot(x-p.x,z-p.z);if(d<14&&y>g+.7&&y<g+6)r=Math.max(r,d);}assert.ok(r>10&&r<=13,q+' processor envelope '+r.toFixed(2));}
 // Installations: hive inside the 22 x 16 tank box (+1.2 m for spike tips), mast within r 2 + 1.
 for(const [i,s] of F.installations.entries()){for(const [x,y,z] of verts(parts.installs[i],solid)){const inBox=Math.abs(x-s.solid.x)<=12.2&&Math.abs(z-s.solid.z)<=9.2,inMast=Math.hypot(x-s.mast.x,z-s.mast.z)<=3.2;assert.ok(inBox||inMast,q+' installation art outside its footprint at '+[x,z].map(n=>n.toFixed(1)));}}
 // Raid cover: walls exactly on the authoritative boxes (±0.2 m).
 const cv=parts.cover.flatMap(g=>verts(g,solid));for(const [x,,z] of cv)assert.ok(W.raidObstacles.some(o=>Math.abs(x-o.x)<=o.width/2+.2&&Math.abs(z-o.z)<=o.depth/2+.2),q+' cover art off its box at '+[x,z].map(n=>n.toFixed(1)));
 // Command Base: perimeter wall solids sit inside the shared baseBlocked() region.
 const B5=parts.base[5],D=C.baseDefinition,yb=W.groundAt(D.x,D.z);let wallChecked=0;
 for(const [x,y,z] of verts(B5,solid)){if(y<yb+1.5||y>yb+4.4)continue;const onWallLine=Math.abs(Math.abs(x)-17)<2.2&&Math.abs(z)<17||Math.abs(z-16)<2.2&&Math.abs(x)<14.5;if(!onWallLine)continue;wallChecked++;
  const blocked=[[0,0],[.9,0],[-.9,0],[0,.9],[0,-.9]].some(([dx,dz])=>K.baseBlocked({baseTier:5},{x:D.x+x+dx,z:D.z+z+dz}));assert.ok(blocked,q+' base wall art outside collision at '+[x,z].map(n=>n.toFixed(1)));}
 assert.ok(wallChecked>50,q+' base walls checked ('+wallChecked+')');
 // Tier V command tower stands on the solid back-wall line (never a drive-through column).
 assert.ok(K.baseBlocked({baseTier:5},{x:D.x,z:D.z+16}),'command tower position is solid in the sim');
 // Rocks keep the authoritative envelope; tree replacements stay <= 1.5 m (trees are not solid in the sim).
 const box=new Box3(),m4=new T.Matrix4();for(const g of chunks)for(const im of g.children.filter(m=>m.isInstancedMesh)){im.geometry.computeBoundingBox();for(let i=0;i<im.count;i++){im.getMatrixAt(i,m4);box.copy(im.geometry.boundingBox).applyMatrix4(m4);
   const isRock=im.geometry===S.P.rock,cx=m4.elements[12]+g.position.x,cz=m4.elements[14]+g.position.z,item=items.filter(p=>isRock?p.kind==='rock'&&p.variant>.45:p.kind==='tree').sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz))[0];if(!item||Math.hypot(item.x-cx,item.z-cz)>.01)continue;
   if(im.geometry===S.P.rock){const pa=im.geometry.attributes.position,vv=new T.Vector3();let top=-1e9,rx=0,rz=0;for(let j=0;j<pa.count;j++){vv.fromBufferAttribute(pa,j).applyMatrix4(m4);top=Math.max(top,vv.y);rx=Math.max(rx,Math.abs(vv.x+g.position.x-item.x));rz=Math.max(rz,Math.abs(vv.z+g.position.z-item.z));}
    assert.ok(top<=item.y+item.size*(.8+item.variant)+.12*item.size,q+' rock top inside envelope');assert.ok(rx<=item.size*1.6+1&&rz<=item.size+1,q+' rock footprint inside the solid ellipse box');}
   if(im.geometry===S.P.crystal||im.geometry===S.P.fungus)assert.ok(box.max.y-item.y<=1.5,q+' tree replacement stays passable-low: '+(box.max.y-item.y).toFixed(2));}}
 // Enemy hull dressing keeps the canonical silhouette (bbox within ±15 % of today's merged hull).
 const hullGeo=()=>{const g=new T.BoxGeometry(2.6,1,1.6);const n=g.attributes.position.count,col=new Float32Array(n*3).fill(.4);g.setAttribute('color',new T.BufferAttribute(col,3));return g;};
 const cached={body:hullGeo(),gun:hullGeo(),ty:.8,scale:1},hm=S.hullMeshes(cached,{kind:'raider',cls:'scout',arch:'twin'}),hb=new Box3().setFromObject(new T.Group().add(hm.body,hm.dress)),cb=new Box3().setFromObject(new T.Mesh(cached.body));
 for(const k of ['x','y','z'])assert.ok((hb.max[k]-hb.min[k])<=(cb.max[k]-cb.min[k])*1.15+.3,q+' hull dressing within silhouette on '+k);
 // Warm list covers every program variant (static + instanced solid/fx, shields).
 const warm=S.warmObjects();assert.ok(warm.some(o=>o.isInstancedMesh&&o.material===S.MAT.solid)&&warm.some(o=>o.isInstancedMesh&&o.material===S.MAT.fx)&&warm.some(o=>o.material===S.MAT.shield),q+' warm set covers instanced and shield programs');
 const sites=CS.allSites(F,{'west-depot':{owner:'humanity'}});assert.ok(sites.length>=13&&sites.some(s=>s[3]>0&&Math.abs(s[0]-994)<1),'captured installations switch to friendly glow');
 S.update(0,1,{p:{x:1100,z:1100},origin:{x:1024,z:1024},renderer:null});assert.ok(S.U.uSite.value.filter(v=>v.z>0).length===8,'nearest 8 sites selected');
 S.dispose();
 console.log('PASS',q,'refuge',tris(parts.refuge),'viaduct',tris(parts.viaduct),'hive',tris(parts.installs[0]),'base T5',tris(parts.base[5]),'battery',tris(parts.battery),'chunks',chunks.length);
}
// Software rasterizer path (CI, GPU-blocklisted browsers): same programs, LOW shading uniform, no ground decals/halos/dome.
{const H=CS.create(T,{low:false}),SW=CS.create(T,{software:true}),fxTris=g=>{let n=0;g.traverse(m=>{if(m.isMesh&&m.material===m.material&&m.material.transparent)n+=m.geometry.index?m.geometry.index.count/3:0;});return n;};
 assert.equal(SW.U.uHigh.value,0,'software takes the LOW shading path');assert.equal(H.U.uHigh.value,1,'HIGH shading path on GPUs');
 assert.equal(SW.MAT.terrain.fragmentShader,H.MAT.terrain.fragmentShader,'one terrain program for every quality (all branches compiled everywhere)');
 const hr=H.refuge(),sr=SW.refuge();assert.ok(fxTris(sr)<fxTris(hr)*.5,'software Refuge drops ground decals and halos: '+fxTris(sr)+' vs '+fxTris(hr));
 const hs=new T.Scene(),ss=new T.Scene();H.environment(hs,null);SW.environment(ss,null);const skyTris=sc=>sc.children.find(o=>o.name==='cq-style-sky').geometry.index.count/3;assert.ok(skyTris(ss)<skyTris(hs),'software sky skips the dome');
 assert.ok(SW.glow(0xffffff).geometry.index.count===6,'pooled shot glows still exist in software mode');H.dispose();SW.dispose();console.log('PASS software path: refuge fx',fxTris(sr),'vs',fxTris(hr));}
