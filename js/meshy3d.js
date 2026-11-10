'use strict';
// =====================================================================
// meshy3d: the owner's Meshy models in the game (Session 5E-1). Visual only: nothing here touches rules, hitboxes,
// stats, saves or ownership. Each item ships as two GLBs made by dev/assets/meshy/build.py:
//   LIGHT (battle, town, world map) and FULL (Garage, previews, close-ups; fetched only when shown).
// Files are fetched one item at a time, cached, and the procedural model stays on screen until its GLB is ready.
// The reader is deliberately narrow: exactly the GLB layout the pipeline writes (one quantized, meshopt-compressed
// primitive, embedded WebP maps, an `extras.lunar` block describing the moving parts). Anything else fails closed.
// Needs THREE and MeshoptDecoder (js/vendor/meshopt_decoder.js).
// =====================================================================
const Meshy3D=(()=>{
 const VERSION='meshy-v1';
 const BASE=typeof document!=='undefined'&&document.currentScript&&document.currentScript.src?new URL('assets/'+VERSION+'/',document.currentScript.src).href:'js/assets/'+VERSION+'/';
 const CT={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 const NORM={5120:127,5121:255,5122:32767,5123:65535};
 const fail=m=>{throw Error('Meshy3D: '+m);};
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
    let opt={premultiplyAlpha:'none',colorSpaceConversion:'none'};
    let bmp=await createImageBitmap(blob,opt);
    if(maxSize&&bmp.width>maxSize){const b2=await createImageBitmap(bmp,{resizeWidth:maxSize,resizeHeight:Math.round(bmp.height*maxSize/bmp.width),resizeQuality:'high'});bmp.close&&bmp.close();bmp=b2;}
    return bmp;}catch(e){}}
  return await new Promise((ok,no)=>{const el=new Image(),url=URL.createObjectURL(blob);el.onload=()=>{URL.revokeObjectURL(url);ok(el);};el.onerror=()=>{URL.revokeObjectURL(url);no(Error('Meshy3D: image'));};el.src=url;});
 }
 // ---- one GLB -> {geometry, maps:{base,normal,orm,mask}, info, bytes} ----
 async function decode(buffer,{maxTexture=0}={}){
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
  return {geometry:geo,maps,info:(J.extras&&J.extras.lunar)||{},bytes:buffer.byteLength,triangles:geo.index?geo.index.count/3:P.length/9};
 }
 return {VERSION,BASE,decode,container};
})();
if(typeof module!=='undefined')module.exports=Meshy3D;
