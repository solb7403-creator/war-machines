'use strict';
// =====================================================================
// meshy3d: the owner's Meshy models in the game (Session 5E-1). Visual only: nothing here touches rules, hitboxes,
// stats, saves or ownership. Each item ships as two GLBs made by dev/assets/meshy/build.py:
//   LIGHT (battle, town, world map) and FULL (Garage, previews, close-ups; fetched only when shown).
// Files are fetched one item at a time, cached, and the procedural model stays on screen until its GLB is ready;
// nothing here ever blocks a battle from starting.
// The reader is deliberately narrow: exactly the GLB layout the pipeline writes (one quantized, meshopt-compressed
// primitive, embedded WebP maps, an `extras.lunar` block describing the moving parts). Anything else fails closed and
// the procedural model stays.
// Moving parts are data, not code: every vertex carries its part index, the part table (pivot, axis, belt path, which
// motion channel drives it) rides in a tiny float texture shared by every tank using the model, and a tank only
// uploads its own channel values (track travel, recoil per barrel, spin, charge...). No CPU work per vertex or per part.
// Needs THREE and MeshoptDecoder (js/vendor/meshopt_decoder.js).
// =====================================================================
const Meshy3D=(()=>{
 const VERSION='meshy-v1';
 const BASE=typeof document!=='undefined'&&document.currentScript&&document.currentScript.src?new URL('assets/'+VERSION+'/',document.currentScript.src).href:'js/assets/'+VERSION+'/';
 const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 const NORM={5120:127,5121:255,5122:32767,5123:65535};
 const fail=m=>{throw Error('Meshy3D: '+m);};
 // motion channels a tank feeds every frame (index = slot in the uCh uniform array)
 const CH={none:0,one:1,driveL:2,driveR:3,aim:4,recoil0:5,recoil1:6,recoil2:7,recoil3:8,spin:9,sway:10,time:11,charge:12,pulse:13,fire:14,flex:15},NCH=16,ROW=5;
 let enabled=typeof globalThis!=='undefined'&&globalThis.LUNAR_MESHY!==false,generation=0,detail='light',manifest=null,manifestPromise=null,baseUrl=BASE;
 const store=new Map(),stats={requests:0,bytes:0,ready:0,failed:0,log:[]};
 // ---- GLB container ----
 function container(buffer){
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<28)fail('size');
  const v=new DataView(buffer),len=buffer.byteLength;if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)>len)fail('header');
  let at=12,json=null,bin=null;
  while(at+8<=len){const n=v.getUint32(at,true),t=v.getUint32(at+4,true);at+=8;if(at+n>len)fail('chunk');
   if(t===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,at,n)));else if(t===0x004e4942)bin=new Uint8Array(buffer,at,n);at+=n;}
  if(!json||!bin||json.asset?.version!=='2.0')fail('content');return {json,bin};
 }
 // one bufferView as bytes (meshopt-decoded when compressed)
 function viewBytes(G,i,memo){
  if(memo[i])return memo[i];const b=G.json.bufferViews[i],x=b.extensions&&b.extensions.EXT_meshopt_compression;let out;
  if(x){if(typeof MeshoptDecoder==='undefined'||!MeshoptDecoder.supported)fail('meshopt decoder missing');
   out=new Uint8Array(x.count*x.byteStride);MeshoptDecoder.decodeGltfBuffer(out,x.count,x.byteStride,G.bin.subarray(x.byteOffset||0,(x.byteOffset||0)+x.byteLength),x.mode,x.filter||'NONE');}
  else out=G.bin.subarray(b.byteOffset||0,(b.byteOffset||0)+b.byteLength);
  return memo[i]=out;
 }
 // an accessor as a typed array of its own component type (tightly packed copy)
 function accessor(G,i,memo){
  const a=G.json.accessors[i],b=G.json.bufferViews[a.bufferView],C=CT[a.componentType],n=NC[a.type];if(!a||!C||!n||a.sparse)fail('accessor');
  const bytes=viewBytes(G,a.bufferView,memo),size=C.BYTES_PER_ELEMENT,stride=b.byteStride||(b.extensions&&b.extensions.EXT_meshopt_compression&&b.extensions.EXT_meshopt_compression.byteStride)||size*n,off=a.byteOffset||0;
  const out=new C(a.count*n),dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const get=C===Float32Array?(p)=>dv.getFloat32(p,true):C===Uint32Array?(p)=>dv.getUint32(p,true):C===Uint16Array?(p)=>dv.getUint16(p,true):C===Int16Array?(p)=>dv.getInt16(p,true):C===Int8Array?(p)=>dv.getInt8(p):(p)=>dv.getUint8(p);
  for(let k=0;k<a.count;k++)for(let j=0;j<n;j++)out[k*n+j]=get(off+k*stride+j*size);
  return {array:out,n,count:a.count,normalized:!!a.normalized,type:a.componentType};
 }
 const floats=acc=>{if(acc.type===5126)return acc.array;const out=new Float32Array(acc.array.length),k=acc.normalized?1/NORM[acc.type]:1;for(let i=0;i<out.length;i++)out[i]=Math.max(-1,acc.array[i]*k);return out;};
 async function image(G,i,memo,maxSize){
  const im=G.json.images[i],bytes=viewBytes(G,im.bufferView,memo),blob=new Blob([bytes],{type:im.mimeType||'image/webp'});
  if(typeof createImageBitmap==='function'){try{
    let bmp=await createImageBitmap(blob,{premultiplyAlpha:'none',colorSpaceConversion:'none'});
    if(maxSize&&bmp.width>maxSize){const b2=await createImageBitmap(bmp,{resizeWidth:maxSize,resizeHeight:Math.round(bmp.height*maxSize/bmp.width),resizeQuality:'high'});bmp.close&&bmp.close();bmp=b2;}
    return bmp;}catch(e){}}
  return await new Promise((ok,no)=>{const el=new Image(),url=URL.createObjectURL(blob);el.onload=()=>{URL.revokeObjectURL(url);ok(el);};el.onerror=()=>{URL.revokeObjectURL(url);no(Error('Meshy3D: image'));};el.src=url;});
 }
 // the part table as one float texture row: ROW texels per part, then 2 per belt-path element
 //  0: pivot.xyz (belt: path length, n min, n max), kind   1: axis.xyz, glow base   2: angle channel, k, slide channel, k
 //  3: glow channel, k, path start, path count            4: parent part + 1 (0 = none): a part can ride on one other part
 function partTexture(parts){
  const rows=[],paths=[];let at=parts.length*ROW;const index=new Map(parts.map((p,i)=>[p.name,i]));
  for(const p of parts){
   const kind=p.kind==='track'?2:p.kind==='screw'?1:0,pv=p.pivot||[0,0,0],ax=p.axis||[0,0,1],al=Math.hypot(ax[0],ax[1],ax[2])||1,A=p.angle||{},Sl=p.slide||{},Gl=p.glow||{};
   let ps=0,pc=0,t0=[pv[0],pv[1],pv[2],kind];
   if(kind===2){const P=p.path;ps=at;pc=P.elems.length;at+=pc*2;t0=[P.length,P.n[0],P.n[1],kind];for(const e of P.elems)paths.push(e[0],e[1],e[2],0,e[3],e[4],e[5],e[6]);}
   const drive=kind===2?(p.travel||{}):A;
   rows.push(...t0,ax[0]/al,ax[1]/al,ax[2]/al,Gl.base===undefined?1:Gl.base,CH[drive.ch]||0,drive.k||0,CH[Sl.ch]||0,Sl.k||0,CH[Gl.ch]||0,Gl.k||0,ps,pc,p.parent!==undefined&&index.has(p.parent)?index.get(p.parent)+1:0,0,0,0);
  }
  const data=new Float32Array([...rows,...paths]),tex=new THREE.DataTexture(data,data.length/4,1,THREE.RGBAFormat,THREE.FloatType);
  tex.minFilter=tex.magFilter=THREE.NearestFilter;tex.generateMipmaps=false;tex.needsUpdate=true;return tex;
 }
 // ---- one GLB -> {geometry, maps:{base,normal,orm,mask}, info, bytes} ----
 async function decode(buffer,{maxTexture=0}={}){
  if(typeof MeshoptDecoder==='undefined')await decoder();
  if(typeof MeshoptDecoder!=='undefined'&&MeshoptDecoder.ready)await MeshoptDecoder.ready;
  const G=container(buffer),J=G.json,memo=[];
  if(!J.meshes||J.meshes.length!==1||J.meshes[0].primitives.length!==1)fail('one primitive expected');
  const prim=J.meshes[0].primitives[0],node=(J.nodes||[]).find(n=>n.mesh===0)||{},S=node.scale||[1,1,1],Tn=node.translation||[0,0,0];
  const pos=accessor(G,prim.attributes.POSITION,memo),P=floats(pos);
  for(let i=0;i<P.length;i+=3){P[i]=P[i]*S[0]+Tn[0];P[i+1]=P[i+1]*S[1]+Tn[1];P[i+2]=P[i+2]*S[2]+Tn[2];}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));
  if(prim.attributes.NORMAL!==undefined){const N=floats(accessor(G,prim.attributes.NORMAL,memo));for(let i=0;i<N.length;i+=3){const l=Math.hypot(N[i],N[i+1],N[i+2])||1;N[i]/=l;N[i+1]/=l;N[i+2]/=l;}geo.setAttribute('normal',new THREE.BufferAttribute(N,3));}else geo.computeVertexNormals();
  if(prim.attributes.TEXCOORD_0!==undefined)geo.setAttribute('uv',new THREE.BufferAttribute(floats(accessor(G,prim.attributes.TEXCOORD_0,memo)),2));
  if(prim.attributes._MOT!==undefined){const m=accessor(G,prim.attributes._MOT,memo);geo.setAttribute('mot',new THREE.BufferAttribute(new Float32Array(m.array),4));}
  if(prim.indices!==undefined){const ix=accessor(G,prim.indices,memo);geo.setIndex(new THREE.BufferAttribute(ix.array,1));}
  geo.computeBoundingBox();geo.computeBoundingSphere();geo.userData.hfShared=true;geo.userData.meshy=true;
  const maps={},mat=(J.materials||[])[prim.material||0]||{},pbr=mat.pbrMetallicRoughness||{};
  const slot={base:pbr.baseColorTexture&&pbr.baseColorTexture.index,normal:mat.normalTexture&&mat.normalTexture.index,orm:pbr.metallicRoughnessTexture&&pbr.metallicRoughnessTexture.index,mask:mat.extras&&mat.extras.lunarMask};
  await Promise.all(Object.entries(slot).map(async([key,ti])=>{if(ti===undefined||ti===null)return;const t=J.textures[ti],src=t.extensions&&t.extensions.EXT_texture_webp?t.extensions.EXT_texture_webp.source:t.source;
   const img=await image(G,src,memo,maxTexture),tex=new THREE.Texture(img);tex.flipY=false;tex.colorSpace=key==='base'?THREE.SRGBColorSpace:'';tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.magFilter=THREE.LinearFilter;tex.generateMipmaps=true;tex.anisotropy=key==='mask'?1:4;tex.needsUpdate=true;tex.userData={meshy:true};maps[key]=tex;}));
  const info=(J.extras&&J.extras.lunar)||{};
  const a={geometry:geo,maps,info,bytes:buffer.byteLength,triangles:geo.index?geo.index.count/3:P.length/9};
  if(info.parts&&info.parts.length&&geo.attributes.mot)a.partTex=partTexture(info.parts);
  if(info.lowIndex&&prim.extras&&prim.extras.lowIndex!==undefined)a.lowIndex=new THREE.BufferAttribute(accessor(G,prim.extras.lowIndex,memo).array,1);
  return a;
 }

 // the meshopt decoder (33 KB) is fetched with the first model, not with the page
 let decoderPromise=null;
 function decoder(){
  if(typeof MeshoptDecoder!=='undefined')return Promise.resolve();
  if(decoderPromise)return decoderPromise;
  decoderPromise=new Promise((ok,no)=>{if(typeof document==='undefined')return no(Error('Meshy3D: no decoder'));const el=document.createElement('script');el.src=new URL('../../vendor/meshopt_decoder.js',BASE).href+(typeof window!=='undefined'&&window.BUILD?'?v='+window.BUILD:'');el.async=true;el.onload=()=>ok();el.onerror=()=>{decoderPromise=null;no(Error('Meshy3D: decoder load'));};document.head.appendChild(el);});
  return decoderPromise;
 }
 // ---- lazy per-item store ----
 const emit=()=>{generation++;if(typeof dispatchEvent==='function'&&typeof Event==='function')try{dispatchEvent(new Event('lunar-meshy-ready'));}catch(e){}};
 function loadManifest(){
  if(manifestPromise)return manifestPromise;
  manifestPromise=fetch(baseUrl+'manifest.json',{cache:'no-cache'}).then(r=>{if(!r.ok)fail('manifest '+r.status);return r.json();}).then(m=>{if(m.version!==VERSION)fail('manifest version');manifest=m;emit();return m;}).catch(e=>{manifest={version:VERSION,items:{},error:String(e.message||e)};return manifest;});
  return manifestPromise;
 }
 // phones keep FULL maps at 1024 (a 2048 set is ~90 MB of GPU memory); desktops get the whole thing
 const coarse=()=>typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
 const maxTextureFor=q=>q==='full'&&coarse()?1024:0;
 function request(id,q='light'){
  if(!enabled||typeof THREE==='undefined'||typeof fetch!=='function')return null;
  const key=id+'|'+q;let e=store.get(key);
  if(e)return e.state==='ready'?e.asset:null;
  if(manifest&&(!manifest.items[id]||!manifest.items[id][q])){store.set(key,{state:'missing'});return null;}
  e={state:'loading',t0:typeof performance!=='undefined'?performance.now():0};store.set(key,e);stats.requests++;
  e.promise=loadManifest().then(async m=>{
   const rec=m.items[id];if(!rec||!rec[q]){e.state='missing';return null;}
   const [r]=await Promise.all([fetch(baseUrl+id+'-'+q+'.glb?h='+(rec[q].hash||m.build||'')),decoder()]);if(!r.ok)fail('fetch '+r.status);
   const buf=await r.arrayBuffer(),asset=await decode(buf,{maxTexture:maxTextureFor(q)});
   asset.id=id;asset.quality=q;asset.record=rec;asset.refs=0;e.asset=asset;e.state='ready';e.used=++clock;evict();e.ms=(typeof performance!=='undefined'?performance.now():0)-e.t0;e.bytes=buf.byteLength;
   stats.bytes+=buf.byteLength;stats.ready++;stats.log.push({id,q,bytes:buf.byteLength,ms:Math.round(e.ms)});emit();return asset;
  }).catch(err=>{e.state='error';e.error=String(err&&err.message||err);stats.failed++;return null;});
  return null;
 }
 const peek=(id,q)=>{const e=store.get(id+'|'+q);if(e&&e.state==='ready'){e.used=++clock;return e.asset;}return null;};
 // memory: models nobody is drawing are dropped least-recently-used first once the cache is over its size
 // (a later request reloads from the browser's HTTP cache). Sizes are GPU texture bytes + geometry, estimated.
 let clock=0;const LIMIT={light:(typeof navigator!=='undefined'&&navigator.deviceMemory&&navigator.deviceMemory<=4?10:22),full:3};
 function evict(){
  for(const q of ['light','full']){const idle=[...store].filter(([k,e])=>e.state==='ready'&&k.endsWith('|'+q)&&!e.asset.refs);let over=idle.length-LIMIT[q];if(over<=0)continue;   // models in use never count and are never dropped
   for(const [k,e] of idle.sort((a,b)=>(a[1].used||0)-(b[1].used||0))){if(over--<=0)break;free(e.asset);store.delete(k);}}
 }
 function free(a){a.geometry.dispose();a.lowGeometry&&a.lowGeometry.dispose();a.partTex&&a.partTex.dispose();for(const g of Object.values(a.split||{}))g.dispose();for(const t of Object.values(a.maps)){t.dispose();t.image&&t.image.close&&t.image.close();}}
 // best asset for the current detail scope: FULL when a close-up asked for it and it has arrived, LIGHT meanwhile
 function best(id){
  if(detail==='none')return null;
  if(detail==='full'){const f=request(id,'full');if(f)return f;}
  return request(id,'light');
 }
 // readiness of one loadout's two models as a short key: consumers rebuild a tank when this changes
 function stamp(cls,ct,arch,wt,d){
  if(!enabled)return '';const t=x=>Math.max(0,Math.min(2,x|0)),c=itemId.chassis(cls,t(ct)),w=itemId.weapon(arch,t(wt)),lv=id=>(d||detail)==='full'&&peek(id,'full')?2:peek(id,'light')?1:0;
  return 'my'+lv(c)+lv(w);
 }
 // true while this loadout's Meshy files are on their way (both known, neither failed): a caller with a tight shader
 // budget (Conquest) draws its cheapest stand-in meanwhile instead of compiling the high-fidelity procedural set first
 function pending(cls,ct,arch,wt){
  if(!enabled||detail==='none')return false;const t=x=>Math.max(0,Math.min(2,x|0)),ids=[itemId.chassis(cls,t(ct)),itemId.weapon(arch,t(wt))];
  for(const id of ids)request(id,'light');
  const st=ids.map(id=>(store.get(id+'|light')||{}).state);return st.every(x=>x==='loading'||x==='ready')&&st.includes('loading');
 }
 function withDetail(d,fn){const old=detail;detail=d;try{return fn();}finally{detail=old;}}
 const itemId={chassis:(cls,tier)=>'chassis-'+cls+'-'+tier,weapon:(arch,tier)=>arch==='moon'?'weapon-moon':'weapon-'+arch+'-'+tier};

 // ---- materials ----
 let ownEnv=null;
 function environment(){
  if(typeof Equipment3D!=='undefined'){try{const m=Equipment3D.material('hf_high_paint');if(m&&m.envMap)return m.envMap;}catch(e){}}
  if(ownEnv)return ownEnv;
  const w=256,h=128,a=new Float32Array(w*h*4);   // the same studio the HF collection is lit by (js/equipment3d.js)
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h,i=(y*w+x)*4;let c=[.16,.18,.21];if(v<.56)c=[.21,.25,.31];for(const [cx,cy,sx,sy,L,tint] of [[.21,.29,.045,.10,7,[1,.95,.83]],[.61,.40,.035,.20,4,[.65,.82,1]],[.89,.27,.10,.02,5,[1,1,1]],[.84,.68,.13,.13,4,[1,.92,.79]],[.45,.69,.12,.055,3,[.86,.94,1]]]){const d=Math.max(Math.abs(u-cx)/sx,Math.abs(v-cy)/sy),f=L*Math.max(0,1-d*.86);for(let z=0;z<3;z++)c[z]+=f*tint[z];}a.set([...c,1],i);}
  ownEnv=new THREE.DataTexture(a,w,h,THREE.RGBAFormat,THREE.FloatType);ownEnv.mapping=THREE.EquirectangularReflectionMapping;ownEnv.colorSpace=THREE.LinearSRGBColorSpace;ownEnv.needsUpdate=true;return ownEnv;
 }
 const VS_HEAD=`attribute vec4 mot;uniform highp sampler2D uParts;uniform float uCh[${NCH}];uniform vec2 uGlowAnim;varying float vMeshyGlow;
 vec4 mPart(int i){return texelFetch(uParts,ivec2(i,0),0);}
 void meshyScrew(int b,inout vec3 pos,inout vec3 nrm){vec4 A=mPart(b);if(A.w<.5||A.w>1.5)return;vec4 B=mPart(b+1),C=mPart(b+2);
  float ang=C.y*uCh[int(C.x+.5)],sl=C.w*uCh[int(C.z+.5)],cs=cos(ang),sn=sin(ang);vec3 ax=B.xyz,r=pos-A.xyz;
  r=r*cs+cross(ax,r)*sn+ax*dot(ax,r)*(1.-cs);nrm=nrm*cs+cross(ax,nrm)*sn+ax*dot(ax,nrm)*(1.-cs);pos=A.xyz+r+ax*sl;}
 void meshyPose(inout vec3 pos,inout vec3 nrm){
  int b=int(mot.x+.5)*${ROW};vec4 A=mPart(b),B=mPart(b+1),D=mPart(b+3);
  vMeshyGlow=(B.w+D.y*uCh[int(D.x+.5)]*uGlowAnim.x)*(1.+uGlowAnim.y*(uCh[${CH.pulse}]-.72));
  if(A.w>1.5){vec4 C=mPart(b+2);
   float L=A.x,s=mot.y/65535.*L+C.y*uCh[int(C.x+.5)],n=A.y+(A.z-A.y)*mot.z/65535.,a0=mot.w/65535.*6.2831853,ang=a0;s=mod(mod(s,L)+L,L);
   int ps=int(D.z+.5),pc=int(D.w+.5);vec2 p=pos.xy;
   for(int i=0;i<pc;i++){vec4 e=mPart(ps+i*2);if((s>=e.y&&s<e.y+e.z)||i==pc-1){vec4 f=mPart(ps+i*2+1);float t=clamp(s-e.y,0.,e.z);
     if(e.x<.5){p=f.xy+f.zw*t+vec2(-f.w,f.z)*n;ang=atan(f.w,f.z);}else{float aa=f.w-t/f.z;p=f.xy+(f.z+n)*vec2(cos(aa),sin(aa));ang=aa-1.5707963;}
     break;}}
   float da=ang-a0,cs=cos(da),sn=sin(da);pos.xy=p;nrm.xy=vec2(nrm.x*cs-nrm.y*sn,nrm.x*sn+nrm.y*cs);
  }else meshyScrew(b,pos,nrm);
  int par=int(mPart(b+4).x+.5);if(par>0)meshyScrew((par-1)*${ROW},pos,nrm);
 }
 `;
 const FS_HEAD=`uniform sampler2D uMask;uniform vec3 uPaintA;uniform vec3 uPaintB;uniform vec4 uPaintP;uniform vec4 uTrim;uniform vec4 uGlowTint;uniform float uGlowGain;uniform float uFlash;uniform vec3 uGhost;varying float vMeshyGlow;
 `;
 // A renderer with a tight shader-program budget registers as the host (Conquest: the world and the town share one renderer
 // and 16 programs). Its studio map is prefiltered once by a generator that is disposed straight away, so three never builds
 // its own equirect -> PMREM helper there (two programs that would live as long as the renderer). Meshy meshes pick the
 // prefiltered map up when the host draws them (envHook); every other renderer is untouched.
 let host=null;const hostEnv=new WeakMap();
 function hostRenderer(r){
  if(host&&host!==r){const t=hostEnv.get(host);if(t)t.dispose();hostEnv.delete(host);}
  host=r&&r.capabilities&&!r.isConquestCanvas&&typeof THREE!=='undefined'&&typeof THREE.PMREMGenerator==='function'?r:null;
 }
 function releaseHost(r){if(host===r)hostRenderer(null);}
 function hostPrefilter(){
  if(!host||hostEnv.has(host))return;
  try{const pg=new THREE.PMREMGenerator(host),rt=pg.fromEquirectangular(environment());pg.dispose();hostEnv.set(host,rt);}catch(e){hostEnv.set(host,null);}
 }
 function envHook(r,sc,cam,geo,mat){
  if(r!==host||!mat||!mat.envMap||mat.envMap.mapping!==THREE.EquirectangularReflectionMapping)return;
  const t=hostEnv.get(r);if(t)mat.envMap=t.texture;
 }
 function weaponHook(r,sc,cam,geo,mat){envHook(r,sc,cam,geo,mat);aimHook.call(this);}
 // pg: shared program per (kind, moving, flags); uniforms are per mesh
 function makeMaterial(asset,q,U){
  const moving=!!asset.partTex,high=q==='high',maps=asset.maps;if(high)hostPrefilter();
  const m=high?new THREE.MeshStandardMaterial({map:maps.base||null,normalMap:maps.normal||null,normalScale:new THREE.Vector2(1,-1),roughnessMap:maps.orm||null,metalnessMap:maps.orm||null,aoMap:maps.orm||null,aoMapIntensity:.85,metalness:1,roughness:1,envMap:environment(),envMapIntensity:1.0})
   :new THREE.MeshLambertMaterial({map:maps.base||null});
  m.userData={meshy:true,meshyOwned:true,motionSkip:true,uniforms:U};
  m.customProgramCacheKey=()=>'meshy-v1|'+(high?'h':'l')+'|'+(moving?'m':'s')+'|'+(maps.mask?'k':'-');
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,U);
   if(moving)shader.vertexShader=VS_HEAD+shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvec3 meshyPos=position;meshyPose(meshyPos,objectNormal);').replace('#include <begin_vertex>','vec3 transformed=meshyPos;');
   else shader.vertexShader='varying float vMeshyGlow;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMeshyGlow=1.;');
   let f=FS_HEAD+shader.fragmentShader;
   if(maps.mask){
    // paint: the base map is the factory look; armour texels are re-tinted by (pilot paint / factory paint), chips, trim and tracks keep their own colour
    f=f.replace('#include <map_fragment>','#include <map_fragment>\nvec3 meshyK=texture2D(uMask,vMapUv).rgb;vec3 meshyBase=diffuseColor.rgb;diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*mix(uPaintA,uPaintB,meshyK.b),meshyK.r);');
    if(high)f=f.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,max(metalnessFactor,uPaintP.y),meshyK.r);roughnessFactor=mix(roughnessFactor,clamp(roughnessFactor*uPaintP.z,.08,1.),meshyK.r);float meshyT=uTrim.a*(1.-meshyK.r)*(1.-meshyK.g)*smoothstep(.86,.97,metalnessFactor);diffuseColor.rgb=mix(diffuseColor.rgb,uTrim.rgb*(.35+1.3*dot(meshyBase,vec3(.3333))),meshyT);');
    f=f.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=mix(meshyBase,uGlowTint.rgb*(.4+.9*dot(meshyBase,vec3(.3333))),uGlowTint.a)*meshyK.g*min(vMeshyGlow,1.7)*uGlowGain+vec3(uFlash)+uGhost;');
   }
   shader.fragmentShader=f;
  };
  return m;
 }
 const lin=hex=>new THREE.Color(hex);   // THREE.Color converts sRGB hex to linear working space
 const ratio=(to,from)=>new THREE.Vector3(Math.min(40,to.r/Math.max(from.r,.004)),Math.min(40,to.g/Math.max(from.g,.004)),Math.min(40,to.b/Math.max(from.b,.004)));
 const GLOW={stock:.42,lunar:1.6,breath:.55};
 function paintUniforms(asset,P,lunar){
  const L=asset.info.look||{},stock=!P||!P.hull||P.hull==='#2c3a49',fa=lin(L.paintA||'#808890'),fb=lin(L.paintB||L.paintA||'#808890');
  const U={uParts:{value:asset.partTex||null},uCh:{value:new Float32Array(NCH)},uMask:{value:asset.maps.mask||null},uPaintA:{value:new THREE.Vector3(1,1,1)},uPaintB:{value:new THREE.Vector3(1,1,1)},
   uPaintP:{value:new THREE.Vector4(1,0,1,0)},uTrim:{value:new THREE.Vector4(0,0,0,0)},uGlowTint:{value:new THREE.Vector4(0,0,0,0)},uGlowGain:{value:1.25},uGlowAnim:{value:new THREE.Vector2(1,0)},uFlash:{value:0},uGhost:{value:new THREE.Vector3(0,0,0)}};
  U.uCh.value[CH.one]=1;U.uCh.value[CH.pulse]=.75;
  if(asset.info.kind==='chassis'){
   // stock look and paints (owner, Nov 11): energy lines only faintly lit in the reference colour, held still. The full bright,
   // breathing energy glow is Lunar Skin's alone (set below).
   U.uGlowGain.value=lunar?GLOW.lunar:GLOW.stock;U.uGlowAnim.value.set(lunar?1:0,lunar?GLOW.breath:0);
   // paints: the same palette the procedural models use (js/models3d.js palette), as a ratio against the factory colours
   if(!stock&&typeof M3!=='undefined'){const C=M3.palette(P,null,null,false);U.uPaintA.value=ratio(lin(C.hull),fa);U.uPaintB.value=ratio(lin(C.tur),fb);if(P.shine)U.uPaintP.value.set(1,.9,.62,0);}
   if(lunar&&typeof M3!=='undefined'){const K=M3.LUNAR;if(stock){U.uPaintA.value=ratio(lin(K.body),fa);U.uPaintB.value=ratio(lin(K.plate),fb);U.uPaintP.value.set(1,.55,.75,0);}
    const g=lin(K.gold);U.uTrim.value.set(g.r,g.g,g.b,1);const e=lin(K.energy);U.uGlowTint.value.set(e.r,e.g,e.b,1);}
  }
  return U;
 }
 // a kit "bake" result is just this descriptor; M3.meshOf turns it into a mesh
 function mesh(d){
  const asset=d.asset,q=typeof Equipment3D!=='undefined'&&Equipment3D.quality==='low'||d.low?'low':'high';
  const U=paintUniforms(asset,d.paint,d.lunar),mat=makeMaterial(asset,q,U);
  // an offline pilot's ghost tank (Arcade): the same Meshy model, see-through with a cool hologram light (was the old procedural tank)
  if(d.ghost){mat.transparent=true;mat.opacity=.58;mat.depthWrite=false;const c=lin('#3a5a9a');U.uGhost.value.set(c.r,c.g,c.b);}
  let geo=asset.geometry;
  if(q==='low'&&asset.lowIndex){if(!asset.lowGeometry){const g=new THREE.BufferGeometry();for(const [k,a] of Object.entries(asset.geometry.attributes))g.setAttribute(k,a);g.setIndex(asset.lowIndex);g.boundingBox=asset.geometry.boundingBox;g.boundingSphere=asset.geometry.boundingSphere;g.userData.hfShared=true;g.userData.meshy=true;asset.lowGeometry=g;}geo=asset.lowGeometry;}
  const m=new THREE.Mesh(geo,mat),g=new THREE.Group();m.castShadow=true;m.receiveShadow=true;m.userData.meshy={asset,U,kind:asset.info.kind};asset.refs=(asset.refs||0)+1;
  m.onBeforeRender=(asset.info.kind==='weapon'||asset.info.kind==='moon')&&asset.partTex?weaponHook:envHook;
  g.add(m);g.userData.meshyGroup=true;return g;
 }
 // the base ring stays with the hull: the weapon mesh turns with the turret, so ring vertices are turned back by the
 // turret's yaw relative to the hull (the first ancestor that has other mesh-bearing children besides this branch)
 let _mi=null,_mr=null;
 function aimHook(){
  const d=this.userData.meshy;if(d.hullRef===undefined){let o=this,ref=null;for(let i=0;i<8&&o.parent;i++){const p=o.parent;if(p.children.some(c=>c!==o&&(c.isMesh||c.children.some(x=>x.isMesh||x.userData.meshyGroup)||c.userData.meshyGroup))){ref=p;break;}o=p;}d.hullRef=ref;}
  if(!d.hullRef)return;if(!_mi){_mi=new THREE.Matrix4();_mr=new THREE.Matrix4();}
  _mr.multiplyMatrices(_mi.copy(d.hullRef.matrixWorld).invert(),this.matrixWorld);const e=_mr.elements;
  d.U.uCh.value[CH.aim]=Math.atan2(-e[2],e[0]);
 }
 // deck height under (x, z) on the indexed LIGHT/FULL geometry (vault tooth, add-on seats)
 function deckY(asset,x,z){
  const g=asset.geometry,p=g.attributes.position.array,ix=g.index.array;let best=-1;
  for(let i=0;i<ix.length;i+=3){const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3,x0=p[a],z0=p[a+2],x1=p[b],z1=p[b+2],x2=p[c],z2=p[c+2];
   if((x0<x&&x1<x&&x2<x)||(x0>x&&x1>x&&x2>x)||(z0<z&&z1<z&&z2<z)||(z0>z&&z1>z&&z2>z))continue;
   const dn=(z1-z2)*(x0-x2)+(x2-x1)*(z0-z2);if(Math.abs(dn)<1e-12)continue;
   const l0=((z1-z2)*(x-x2)+(x2-x1)*(z-z2))/dn,l1=((z2-z0)*(x-x2)+(x0-x2)*(z-z2))/dn,l2=1-l0-l1;if(l0<-1e-6||l1<-1e-6||l2<-1e-6)continue;
   const y=l0*p[a+1]+l1*p[b+1]+l2*p[c+1];if(y>best)best=y;}
  return best;
 }
 // ---- kits (the {k, anims, meta} contract of js/models3d.js) ----
 function addons(asset,team,gems){
  // game-drawn pieces that are not part of the Meshy mesh: the team light bars and the three core sockets
  if(typeof M3==='undefined')return [];
  const S=asset.info.sockets||{},k=M3.kit(),sh=M3.shapes;
  for(const p of S.team||[])M3.put(k,sh.B(.16,.02,.03),team||'#4d9fff',[p[0],p[1]+.012,p[2]],null,null,'glow');
  (S.cores||[]).forEach((p,i)=>{M3.put(k,sh.CY(.085,.095,.035,10),'#262f3b',[p[0],p[1]+.016,p[2]]);const gk=gems&&gems[i];if(gk&&typeof GEM!=='undefined'&&GEM[gk]){M3.put(k,sh.OC(.06),GEM[gk].c,[p[0],p[1]+.07,p[2]],null,[1,1.25,1],'glow');}});
  return k.lit.length||k.shine.length||k.glow.length?[{k,p:[0,0,0]}]:[];
 }
 function chassisKit(cls,tier,P,team,gems,lunar){
  const asset=best(itemId.chassis(cls,tier));if(!asset)return null;
  const I=asset.info,M=I.meta||{};
  return {k:{meshy:{asset,paint:P,lunar:!!lunar,team}},anims:addons(asset,team,gems),
   meta:Object.assign({ty:M.ty||0,bob:0,halos:(M.halos||[]).map(h=>h.slice()),trail:[],tc:(I.look&&I.look.paintA)||'#8a97ab',track:M.track||[1,.22,.25,0],meshy:asset.id,profile:cls+':'+tier,lunar:lunar&&M.lunar?M.lunar:undefined,legend:lunar?'lunar-black-gold':undefined},M.extra||{})};
 }
 // Weapon fit (owner direction, Nov 11): a weapon is scaled only uniformly, as a whole, to the hull it sits on, from
 // measured numbers: turret body width = k(tier) of the hull width (Common .58, Rare .65, Epic .72, so an upgrade sits
 // visibly larger), turret about as tall as the hull (h(tier) 1.0 / 1.08 / 1.16, never above 1.35), its rear inside the hull deck, and the
 // whole weapon never wider than the hull. Applied once on the weapon group; muzzle points are weapon-local, so flashes,
 // halos and recoil stay on the visible muzzles. Visual only: the simulation never reads any of this.
 const FIT_K=[.58,.65,.72],FIT_H=[1,1.08,1.16],FIT_FLOOR=[.5,.54,.58],FIT_TOP=1.35,FIT_MAX=[.98,1.04,1.1];let fitOn=true;
 function bodyHeight(asset){
  if(asset.fitH)return asset.fitH;const p=asset.geometry.attributes.position.array,tip=(asset.info.meta.visual&&asset.info.meta.visual.tip)||asset.geometry.boundingBox.max.x,ys=[];
  for(let i=0;i<p.length;i+=3)if(p[i]<tip*.4)ys.push(p[i+1]);ys.sort((a,b)=>a-b);return asset.fitH=ys.length?ys[Math.floor(ys.length*.97)]:asset.geometry.boundingBox.max.y;   // antennas and periscopes do not count
 }
 function weaponFit(asset,arch,wt,cls,ct){
  if(!fitOn)return 1;const t=Math.max(0,Math.min(2,wt|0)),tc=Math.max(0,Math.min(2,ct===undefined?1:ct|0)),hull=peek(itemId.chassis(cls,tc),'light');
  let hv=hull&&hull.info.meta&&hull.info.meta.visual;
  if(!hv&&typeof M3!=='undefined'&&M3.CHASSIS_VISUALS[cls]){const o=M3.CHASSIS_VISUALS[cls][tc];hv={trackZ:o.trackZ,trackW:o.trackW,ring:o.ring,x0:-o.len/2};}   // procedural hull still on screen
  if(!hv)return 1;
  const bb=asset.geometry.boundingBox,wv=asset.info.meta.visual||{},hullW=2*(hv.trackZ+hv.trackW/2),moon=arch==='moon',k=moon?.75:FIT_K[t],h=moon?1.05:FIT_H[t];
  // width target, held down by the height guide; but never undersized: the body keeps at least FLOOR of the hull width as
  // long as it stays under FIT_TOP hull heights (tall Meshy turrets on the low Scout hulls). Hard caps last.
  const bw=2*(wv.width||.5),bh=bodyHeight(asset),floor=Math.min((moon?.5:FIT_FLOOR[t])*hullW/bw,FIT_TOP*hv.ring/bh);
  let sc=Math.min(Math.min(k*hullW/bw,Math.max(h*hv.ring/bh,floor)),.98*hullW/(bb.max.z-bb.min.z),.96*-hv.x0/Math.max(.1,-bb.min.x));
  if(moon&&typeof M3!=='undefined')sc=Math.min(sc,M3.weaponScale('moon',cls,tc));
  return Math.max(.35,Math.min(moon?1:FIT_MAX[t],sc));   // upper cap per tier: wide four-pod hulls must not get an oversized gun
 }
 function weaponKit(arch,tier,P,team,lunar,cls,ct){
  const asset=best(itemId.weapon(arch,tier));if(!asset)return null;
  const I=asset.info,M=I.meta||{};
  return {k:{meshy:{asset,paint:P,lunar:!!lunar,team}},anims:[],meta:{tips:(M.tips||[[1.9,.25,0]]).map(t=>t.slice()),halos:(M.halos||[]).map(h=>h.slice()),meshy:asset.id,barrels:M.barrels||0,scale:weaponFit(asset,arch,tier,cls,ct),profile:arch+':'+tier,legend:arch==='moon'?'moonbeam-unified':undefined}};
 }
 // measured dimensions of the active Meshy model in the CHASSIS_VISUALS / WEAPON_VISUALS shape (fittings and plates seat on these)
 const visual=(kind,a,t)=>{const as=peek(kind==='chassis'?itemId.chassis(a,t):itemId.weapon(a,t),'light');return as&&as.info.meta&&as.info.meta.visual||null;};

 // ---- motion: one controller per tank, fed by GraphicsMotion (track travel, kick, charge) ----
 const reducedMotion=()=>typeof GraphicsMotion!=='undefined'&&GraphicsMotion.reduced();
 function motion(root){
  const list=[];root.traverse(o=>{if(o.isMesh&&o.userData.meshy&&o.userData.meshy.asset.partTex)list.push(o.userData.meshy);});
  if(!list.length)return null;
  const barrels=Math.max(0,...list.map(d=>d.kind==='weapon'||d.kind==='moon'?(d.asset.info.meta&&d.asset.info.meta.barrels)||0:0));
  const st={shots:0,recoil:[0,0,0,0],spin:0,spinV:0,t:0,fire:0,trav:0,act:0,flex:0};
  return {list,state:st,barrels,
   // s = GraphicsMotion state (left/right travel, kick, charge, phase); decor=false drops the decorative channels
   step(s,dt,quiet){
    const low=typeof Equipment3D!=='undefined'&&Equipment3D.quality==='low',decor=!quiet&&!low;
    if((s.shots|0)!==st.shots){const n=Math.max(1,this.barrels||1),b=(Math.max(0,(s.shots|0)-1))%n;st.shots=s.shots|0;st.recoil[b]=1;st.fire=1;st.spinV=Math.max(st.spinV,26);}
    const damp=Math.exp(-(s.profile==='siege'?9:s.profile==='twin'?20:14)*dt);for(let i=0;i<4;i++)st.recoil[i]*=damp;
    st.fire*=Math.exp(-10*dt);st.spinV*=Math.exp(-1.6*dt);st.spin+=st.spinV*dt;st.t+=dt;
    // suspension flex: the running gear works while the tank travels and settles when it stops
    const trav=((s.left||0)+(s.right||0))*.5,sp=dt>0?Math.min(1,Math.abs(trav-st.trav)/dt/2.5):0;st.trav=trav;st.act+=(sp-st.act)*Math.min(1,dt*4);st.flex=st.act*Math.sin(trav*5.2);
    for(const d of list){const c=d.U.uCh.value;
     c[CH.driveL]=s.left||0;c[CH.driveR]=s.right||0;
     for(let i=0;i<4;i++)c[CH.recoil0+i]=st.recoil[i];
     c[CH.spin]=decor||st.spinV>1?st.spin:0;c[CH.fire]=st.fire;c[CH.charge]=s.charge||0;
     c[CH.time]=decor?st.t:0;c[CH.sway]=decor?Math.sin(st.t*2.3)*.6+Math.sin(st.t*5.1+1.3)*.4:0;c[CH.pulse]=decor?.72+.28*Math.sin(st.t*2.6):.8;
     c[CH.flex]=decor?st.flex:0;
    }
   },dispose(){list.length=0;}};
 }
 // ---- Conquest town: buildings are one mesh, turrets an instanced fixed base plus an instanced head ----
 // Pipeline space faces +X; the town kit faces +Z, so town models are turned a quarter once here.
 const TOWN_YAW=-Math.PI/2,townLive=new Set();
 const townScale=(type,l)=>type==='cc'?.78+.0245*(Math.max(1,l)-1):.82+.045*(Math.min(5,Math.max(1,l))-1);
 const townAsset=type=>enabled&&detail!=='none'?request('town-'+type,'light'):null;
 const townStamp=types=>enabled?types.map(t=>peek('town-'+t,'light')?1:0).join(''):'';
 const THEME_FINISH={sand:'#8f7c62',graphite:'#353d49'},THEME_LIGHT={cyan:'#22e6ff',amber:'#ffb347',violet:'#b78bff',green:'#3fe0c0',red:'#ff5a4a'};
 // one material per model and theme, shared by every instance (town motion is clock-driven, so nothing is per instance)
 function townMaterial(asset,theme,low){
  const key=(low?'l':'h')+'|'+(theme&&theme.finish||'')+'|'+(theme&&theme.light||'');asset.townMats=asset.townMats||new Map();let m=asset.townMats.get(key);if(m)return m;
  const U=paintUniforms(asset,null,false),L=asset.info.look||{};
  if(theme&&THEME_FINISH[theme.finish]){const c=lin(THEME_FINISH[theme.finish]);U.uPaintA.value=ratio(c,lin(L.paintA||'#808890'));U.uPaintB.value=ratio(c.clone().multiplyScalar(.8),lin(L.paintB||L.paintA||'#808890'));}
  if(theme&&THEME_LIGHT[theme.light]){const c=lin(THEME_LIGHT[theme.light]);U.uGlowTint.value.set(c.r,c.g,c.b,1);}
  m=makeMaterial(asset,low?'low':'high',U);m.userData.meshyOwned=false;m.userData.town=true;asset.townMats.set(key,m);townLive.add(U);return m;
 }
 // index subsets of one geometry: the fixed base (part "ring") and the head (everything else)
 function townSplit(asset){
  if(asset.split!==undefined)return asset.split;const parts=asset.info.parts||[],ri=parts.findIndex(p=>p.name==='ring'),g=asset.geometry;
  if(ri<0||!g.attributes.mot){asset.split=null;return null;}
  const ix=g.index.array,mot=g.attributes.mot.array,A=[],B=[];for(let i=0;i<ix.length;i+=3)(mot[ix[i]*4]===ri?A:B).push(ix[i],ix[i+1],ix[i+2]);
  const mk=list=>{const n=new THREE.BufferGeometry();for(const [k,a] of Object.entries(g.attributes))n.setAttribute(k,a);n.setIndex(new THREE.BufferAttribute(new (ix.constructor)(list),1));n.boundingBox=g.boundingBox;n.boundingSphere=g.boundingSphere;n.userData.hfShared=true;n.userData.meshy=true;return n;};
  asset.split={base:mk(A),head:mk(B)};return asset.split;
 }
 const townPivot=asset=>(asset.info.meta&&asset.info.meta.pivot)||[0,0];
 // a building (or a turret drawn alone: under construction, cards) as a group at the footprint centre, facing +Z
 // lod: a big town seen from the drive view or zoomed out draws the model's reduced index set (the LOW one) with the same
 // HIGH material (no new program), instead of the old kit model
 function lowGeo(asset){if(!asset.lowIndex)return asset.geometry;if(!asset.lowGeometry){const g=new THREE.BufferGeometry();for(const [k,a] of Object.entries(asset.geometry.attributes))g.setAttribute(k,a);g.setIndex(asset.lowIndex);g.boundingBox=asset.geometry.boundingBox;g.boundingSphere=asset.geometry.boundingSphere;g.userData.hfShared=true;g.userData.meshy=true;asset.lowGeometry=g;}return asset.lowGeometry;}
 function townBuilding(type,lvl,theme,low,lod){
  const asset=townAsset(type);if(!asset)return null;
  const g=new THREE.Group(),sc=townScale(type,lvl),mat=townMaterial(asset,theme,low),sp=lod?null:townSplit(asset),pv=townPivot(asset);g.scale.setScalar(sc);
  const place=geo=>{const m=new THREE.Mesh(geo,mat);m.onBeforeRender=envHook;m.rotation.y=TOWN_YAW;m.position.set(-(pv[0]*Math.cos(TOWN_YAW)+pv[1]*Math.sin(TOWN_YAW)),0,-(-pv[0]*Math.sin(TOWN_YAW)+pv[1]*Math.cos(TOWN_YAW)));m.userData.meshyTown=asset;return m;};
  if(sp){g.add(place(sp.base));const head=new THREE.Group();head.add(place(sp.head));g.add(head);g.userData.meshyHead=head;}else g.add(place(lod?lowGeo(asset):asset.geometry));
  g.userData.meshyTown=asset.id;asset.refs=(asset.refs||0)+1;g.userData.meshyTownRelease=()=>{asset.refs=Math.max(0,asset.refs-1);};return g;
 }
 // instanced turret set: {base, hd, matrix(out, x, y, z, aim, kick, dead)} with the pedestal centred on the cell
 let noHead=null;
 function townTurret(type,count,lvl,theme,low){
  const asset=townAsset(type);if(!asset)return null;
  // a tower with no turning head (Tesla coil: body + emitter, no ring part) is one fixed instanced piece; its head set is empty
  let sp=townSplit(asset);if(!sp){if(!noHead){noHead=new THREE.BufferGeometry();noHead.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3));noHead.setIndex([]);noHead.userData.hfShared=true;noHead.userData.meshy=true;}sp={base:asset.geometry,head:noHead,fixed:true};}
  const mat=townMaterial(asset,theme,low),n=Math.max(1,count),base=new THREE.InstancedMesh(sp.base,mat,n),hd=new THREE.InstancedMesh(sp.head,mat,n),pv=townPivot(asset),sc=.9+.025*(Math.max(1,lvl)-1);
  base.count=hd.count=count;base.frustumCulled=hd.frustumCulled=false;base.onBeforeRender=hd.onBeforeRender=envHook;
  const q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),v=new THREE.Vector3(),s3=new THREE.Vector3(),off=new THREE.Vector3();
  // model point p -> world: T(x,y,z) * R(yaw) * S * T(-pivot); kick slides the head back along its aim
  const matrix=(out,x,y,z,aim,kick,dead)=>{if(sp.fixed){aim=0;kick=0;}const yaw=aim+TOWN_YAW;q.setFromAxisAngle(up,yaw);const k=dead?0:sc;off.set(-pv[0]*k,0,-pv[1]*k).applyQuaternion(q);
   v.set(x+off.x-Math.sin(aim)*(kick||0),y,z+off.z-Math.cos(aim)*(kick||0));return out.compose(v,q,s3.set(k,k,k));};
  asset.refs=(asset.refs||0)+2;return {base,hd,matrix,asset,meshy:true,recoil:(asset.info.meta&&asset.info.meta.recoil)||.22};
 }
 // clock-driven channels of every live town material (spinning dishes, blinking lights, pulsing cores)
 function townStep(t,quiet){for(const U of townLive){const c=U.uCh.value;c[CH.time]=quiet?0:t;c[CH.pulse]=quiet?.8:.72+.28*Math.sin(t*2.6);c[CH.sway]=quiet?0:Math.sin(t*2.3)*.6;c[CH.charge]=quiet?.3:.5+.5*Math.sin(t*1.7);}}
 // free the per-mesh materials of a removed tree (geometry and maps are shared and stay cached)
 function release(root){if(!root||!root.traverse)return;root.traverse(o=>{if(o.userData.meshyTownRelease){o.userData.meshyTownRelease();delete o.userData.meshyTownRelease;}if(o.isMesh&&o.material&&o.material.userData&&o.material.userData.meshyOwned&&!o.userData.meshyReleased){o.userData.meshyReleased=true;o.material.dispose();o.onBeforeRender=()=>{};const a=o.userData.meshy&&o.userData.meshy.asset;if(a)a.refs=Math.max(0,(a.refs||0)-1);}});}
 // warm the cache for a loadout (LIGHT only): called when a loadout is known before it is drawn
 function prefetch(L){if(!L)return;try{if(L.c)request(itemId.chassis(L.c.c,Math.max(0,Math.min(2,L.c.t|0))),'light');if(L.w)request(itemId.weapon(L.w.a,Math.max(0,Math.min(2,L.w.t|0))),'light');}catch(e){}}
 function dispose(){for(const e of store.values())if(e.asset)free(e.asset);store.clear();generation++;}
 return {VERSION,CH,get enabled(){return enabled;},set enabled(v){if(enabled!==!!v){enabled=!!v;generation++;}},get generation(){return generation;},get fit(){return fitOn;},set fit(v){if(fitOn!==!!v){fitOn=!!v;generation++;}},weaponFit,get base(){return baseUrl;},set base(v){baseUrl=v;manifest=null;manifestPromise=null;},
  decode,container,request,peek,best,withDetail,pending,stamp,itemId,loadManifest,GLOW,get manifest(){return manifest;},chassisKit,weaponKit,mesh,motion,release,prefetch,deckY,visual,townBuilding,townTurret,townStep,townStamp,townAsset,TOWN_YAW,hostRenderer,releaseHost,makeMaterial,paintUniforms,partTexture,dispose,stats,store};
})();
if(typeof module!=='undefined')module.exports=Meshy3D;
