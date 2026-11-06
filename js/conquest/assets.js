/* Original Blender-authored static architecture. Constrained GLB 2.0 reader,
 * deliberately not a general glTF loader: no remote buffers, textures, skins,
 * animation, sparse/interleaved attributes or extensions. Fail closed to the
 * established procedural art. Art never defines collision or simulation. */
(function(root){'use strict';
const cache=new Map(),status={state:'idle',error:null},metrics={};let pending;
const paths={command:'command',raid:'raid'},BASE=typeof document!=='undefined'&&document.currentScript?.src?new URL('../assets/conquest-v1/',document.currentScript.src).href:'js/assets/conquest-v1/';
function reject(reason){throw Error('LUNAR GLB: '+reason);}
function parse(T,buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<28||buffer.byteLength>250000)reject('invalid size');
 const v=new DataView(buffer),length=buffer.byteLength;
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==length)reject('invalid header');
 let cursor=12,json,bin;
 while(cursor<length){if(cursor+8>length)reject('chunk header');const size=v.getUint32(cursor,true),type=v.getUint32(cursor+4,true);cursor+=8;if(size%4||cursor+size>length)reject('truncated chunk');
  if(type===0x4e4f534a){if(json)reject('duplicate JSON');try{json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,cursor,size)));}catch(e){reject('invalid JSON');}}
  else if(type===0x004e4942){if(bin)reject('duplicate binary');bin={offset:cursor,length:size};}
  else reject('unknown chunk');cursor+=size;
 }
 if(!json||!bin||json.asset?.version!=='2.0'||json.extensionsRequired?.length||json.extensionsUsed?.length||json.animations?.length||json.skins?.length||json.images?.length||json.textures?.length||json.buffers?.length!==1||json.buffers[0].uri||json.buffers[0].byteLength>bin.length)reject('unsupported static format');
 if(!Array.isArray(json.nodes)||json.nodes.length>32||!Array.isArray(json.meshes)||json.meshes.length>3||json.materials&&!Array.isArray(json.materials)||(json.materials||[]).length>3)reject('scene budget');
 function accessor(index,type){
  const a=json.accessors?.[index],b=json.bufferViews?.[a?.bufferView],components=type==='VEC3'?3:1;
  if(!a||a.type!==type||a.sparse||a.normalized||!Number.isSafeInteger(a.count)||a.count<1||a.count>20000||!b||b.buffer!==0||b.byteStride||![5123,5125,5126].includes(a.componentType))reject('invalid accessor');
  if(type==='VEC3'&&a.componentType!==5126||type==='SCALAR'&&a.componentType===5126)reject('component type');
  const size=a.componentType===5123?2:4,local=(a.byteOffset||0),viewOffset=(b.byteOffset||0),bytes=a.count*components*size;
  if(!Number.isSafeInteger(local)||!Number.isSafeInteger(viewOffset)||local<0||viewOffset<0||local+bytes>b.byteLength||viewOffset+b.byteLength>json.buffers[0].byteLength)reject('accessor bounds');
  const offset=bin.offset+viewOffset+local;if(offset%size)reject('alignment');
  const C=a.componentType===5123?Uint16Array:a.componentType===5125?Uint32Array:Float32Array;
  const result=new C(buffer,offset,a.count*components);for(const x of result)if(!Number.isFinite(x))reject('nonfinite data');return result;
 }
 const materialDefinitions=(json.materials||[]).length?json.materials:[{}];
 const materials=materialDefinitions.map(m=>{const p=m.pbrMetallicRoughness||{},f=p.baseColorFactor||[1,1,1,1],e=m.emissiveFactor||[0,0,0];
  if(p.baseColorTexture||p.metallicRoughnessTexture||m.normalTexture||m.alphaMode&&m.alphaMode!=='OPAQUE'||f.length!==4||e.length!==3||![...f,...e,p.metallicFactor??1,p.roughnessFactor??1].every(x=>Number.isFinite(x)&&x>=0&&x<=1))reject('material');
  return new T.MeshStandardMaterial({color:new T.Color().setRGB(f[0],f[1],f[2]),metalness:p.metallicFactor??1,roughness:p.roughnessFactor??1,emissive:new T.Color().setRGB(e[0],e[1],e[2])});
 });
 let triangles=0,draws=0;
 const meshes=json.meshes.map(m=>{const group=new T.Group();if(!Array.isArray(m.primitives))reject('primitives');for(const p of m.primitives){if(p.mode!==undefined&&p.mode!==4||p.targets||p.extensions)reject('nontriangle mesh');
   const position=accessor(p.attributes?.POSITION,'VEC3'),normal=accessor(p.attributes?.NORMAL,'VEC3'),index=accessor(p.indices,'SCALAR');
   if(position.length!==normal.length||index.length%3||!materials[p.material??0])reject('mesh');for(const i of index)if(i>=position.length/3)reject('index bounds');
   triangles+=index.length/3;draws++;if(triangles>3000||draws>3)reject('geometry budget');
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(position,3));geo.setAttribute('normal',new T.BufferAttribute(normal,3));geo.setIndex(new T.BufferAttribute(index,1));geo.userData.hfShared=true;geo.userData.conquestAsset=true;geo.computeBoundingSphere();group.add(new T.Mesh(geo,materials[p.material??0]));
  }return group;});
 const seen=new Set();
 function node(i,depth=0){const n=json.nodes[i];if(!n||seen.has(i)||depth>8)reject('node hierarchy');seen.add(i);const g=new T.Group();g.name=n.name||'LUNAR architecture';
  if(n.matrix){if(n.matrix.length!==16||!n.matrix.every(Number.isFinite))reject('node matrix');g.matrix.fromArray(n.matrix);g.matrix.decompose(g.position,g.quaternion,g.scale);}
  else{for(const [key,size]of [['translation',3],['rotation',4],['scale',3]])if(n[key]&&(n[key].length!==size||!n[key].every(Number.isFinite)))reject('node transform');if(n.translation)g.position.fromArray(n.translation);if(n.rotation)g.quaternion.fromArray(n.rotation);if(n.scale)g.scale.fromArray(n.scale);}
  if(n.mesh!==undefined){if(!meshes[n.mesh])reject('mesh reference');g.add(meshes[n.mesh]);}for(const j of n.children||[])g.add(node(j,depth+1));return g;
 }
 const scene=json.scenes?.[json.scene||0];if(!scene||!Array.isArray(scene.nodes))reject('scene');const group=new T.Group();for(const i of scene.nodes)group.add(node(i));group.userData.assetMetrics={bytes:length,triangles,draws,textures:0};return group;
}
function load(T){if(pending)return pending;status.state='loading';pending=Promise.all(Object.keys(paths).flatMap(name=>['high','low'].map(async quality=>{const key=name+'-'+quality;try{
 const r=await fetch(BASE+key+'.glb');if(!r.ok)throw Error('HTTP '+r.status);const buffer=await r.arrayBuffer(),g=parse(T,buffer);if(quality==='low'&&g.userData.assetMetrics.triangles>1000)reject('low geometry budget');cache.set(key,g);metrics[key]=g.userData.assetMetrics;
 }catch(e){status.error=String(e.message||e);}}))).then(()=>{status.state=cache.size===4?'ready':cache.size?'partial':'fallback';return status;});return pending;}
function make(T,name,quality='high'){const source=cache.get(name+'-'+(quality==='low'?'low':'high'));if(!source)return null;const g=source.clone(true);g.userData.conquestAsset=name;return g;}
root.ConquestAssets=Object.freeze({parse,load,make,status,metrics});
})(typeof window!=='undefined'?window:globalThis);
