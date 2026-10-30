'use strict';
// HF collection: opt-in render-only assets, same M3 kits and moving-part contract. No account storage.
const Equipment3D=(()=>{
 const VERSION='hf-v2.0',BANKS=new Map(),MAX_BANKS=2,MAX_MATERIALS=14;
 const script=typeof document!=='undefined'?document.currentScript?.src:null;
 const BASE=script?new URL('assets/hf-v1/',script).href:'/js/assets/hf-v1/';
 const GEOMETRY=new Map(),GEOMETRY_BYTES=14*1024*1024;let peakBytes=0;
 let enabled=typeof globalThis!=='undefined'&&globalThis.LUNAR_HF_SAMPLE===true,quality='high',generation=0,environment=null,users=0;
 const status=q=>BANKS.get(q)?.state||'idle',active=()=>enabled&&status(quality)==='ready';
 const color=c=>new THREE.Color(c||'#ffffff');
 const kit=q=>({hf:true,quality:q||quality,surfaces:{}});
 function uvProject(g){
  if(g.attributes.uv)return;
  const p=g.attributes.position,N=g.attributes.normal,uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=Math.abs(N.getX(i)),ny=Math.abs(N.getY(i)),nz=Math.abs(N.getZ(i));const a=ny>=nx&&ny>=nz?[x,z]:nx>=nz?[z,y]:[x,y];uv[i*2]=a[0]*.3+.5;uv[i*2+1]=a[1]*.3+.5;}
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 }
 function tangents(g){
  // Scalar Gram-Schmidt avoids two temporary Vector3 allocations per vertex during cold builds.
  const p=g.attributes.position.array,n=g.attributes.normal.array,u=g.attributes.uv.array,t=new Float32Array(p.length/3*4);
  for(let i=0;i<p.length;i+=9){const v=i/3,j=v*2,dx1=p[i+3]-p[i],dx2=p[i+6]-p[i],dy1=p[i+4]-p[i+1],dy2=p[i+7]-p[i+1],dz1=p[i+5]-p[i+2],dz2=p[i+8]-p[i+2],s1=u[j+2]-u[j],s2=u[j+4]-u[j],t1=u[j+3]-u[j+1],t2=u[j+5]-u[j+1],d=s1*t2-s2*t1;
   const tx=Math.abs(d)>1e-9?(dx1*t2-dx2*t1)/d:1,ty=Math.abs(d)>1e-9?(dy1*t2-dy2*t1)/d:0,tz=Math.abs(d)>1e-9?(dz1*t2-dz2*t1)/d:0;
   for(let k=0;k<3;k++){const ni=i+k*3,nx=n[ni],ny=n[ni+1],nz=n[ni+2],dot=tx*nx+ty*ny+tz*nz;let x=tx-dot*nx,y=ty-dot*ny,z=tz-dot*nz,len=Math.hypot(x,y,z);
    if(len<1e-8){if(Math.abs(nx)<.8){x=0;y=-nz;z=ny;}else{x=-ny;y=nx;z=0;}len=Math.hypot(x,y,z);}t.set([x/len,y/len,z/len,d<0?-1:1],(v+k)*4);
   }
  }g.setAttribute('tangent',new THREE.BufferAttribute(t,4));
 }
 const TILE={paint:0,gold:1,steel:2,rubber:3,energy:0};
 function put(k,geo,material,c,p=[0,0,0],r=[0,0,0],scale=[1,1,1]){
  if(!Object.prototype.hasOwnProperty.call(TILE,material))throw Error('HF authoring: unknown material '+material);
  let g=geo.index?geo.toNonIndexed():geo;if(g!==geo)geo.dispose();
  // Extruded arc seams can emit zero-area triangles. Cull those faces before shading/baking.
  const pos=g.attributes.position.array,keep=[];for(let i=0;i<pos.length;i+=9){const ax=pos[i+3]-pos[i],ay=pos[i+4]-pos[i+1],az=pos[i+5]-pos[i+2],bx=pos[i+6]-pos[i],by=pos[i+7]-pos[i+1],bz=pos[i+8]-pos[i+2];if(Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)>1e-10)keep.push(i/3,i/3+1,i/3+2);}
  if(keep.length<g.attributes.position.count){const clean=new THREE.BufferGeometry();for(const [name,a] of Object.entries(g.attributes)){const data=new Float32Array(keep.length*a.itemSize);keep.forEach((v,i)=>data.set(a.array.subarray(v*a.itemSize,(v+1)*a.itemSize),i*a.itemSize));clean.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize));}g.dispose();g=clean;}
  if(!g.attributes.normal)g.computeVertexNormals();
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(...scale));g.applyMatrix4(matrix);
  if(matrix.determinant()<0)throw Error('HF authoring: mirror outlines, not negative scale');
  uvProject(g);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++){const tile=TILE[material];uv.setXY(i,(tile%2)*.5+.015+Math.max(0,Math.min(1,uv.getX(i)))*.47,Math.floor(tile/2)*.5+.015+Math.max(0,Math.min(1,uv.getY(i)))*.47);}
  g.setAttribute('uv1',uv.clone());tangents(g);const col=color(c),C=new Float32Array(g.attributes.position.count*3);for(let i=0;i<C.length;i+=3)C.set([col.r,col.g,col.b],i);g.setAttribute('color',new THREE.BufferAttribute(C,3));
  (k.surfaces[material]||=[]).push(g);return g;
 }
 function bake(k){
  const entry=GEOMETRY.get(k.cacheKey);if(entry?.parts[k.part])return entry.parts[k.part];
  const out={};for(const [id,list] of Object.entries(k.surfaces)){const n=list.reduce((n,g)=>n+g.attributes.position.count,0),g=new THREE.BufferGeometry();for(const [name,size] of Object.entries({position:3,normal:3,color:3,uv:2,uv1:2,tangent:4})){const a=new Float32Array(n*size);let o=0;for(const geo of list){a.set(geo.attributes[name].array,o);o+=geo.attributes[name].array.length;}g.setAttribute(name,new THREE.BufferAttribute(a,size));}g.computeBoundingSphere();if(entry){g.userData.hfShared=true;g.userData.hfAsset=k.cacheKey;}out['hf_'+k.quality+'_'+id]=g;list.forEach(g=>g.dispose());}if(entry){entry.parts[k.part]=out;k.surfaces={};peakBytes=Math.max(peakBytes,geometryBytes());}return out;
 }
 function geometryBytes(){let n=0;for(const e of GEOMETRY.values())for(const part of e.parts)for(const g of Object.values(part||{}))for(const a of Object.values(g.attributes))n+=a.array.byteLength;return n;}
 function evict(){const workingPair=new Set([...GEOMETRY.keys()].slice(-2));for(const [key,e] of GEOMETRY){if(geometryBytes()<=GEOMETRY_BYTES&&GEOMETRY.size<=12)break;if(e.refs||workingPair.has(key))continue;for(const p of e.parts)for(const g of Object.values(p||{}))g.dispose();GEOMETRY.delete(key);}}
 function cached(id,build){if(GEOMETRY.has(id)){const e=GEOMETRY.get(id);GEOMETRY.delete(id);GEOMETRY.set(id,e);return e.raw;}const raw=build(),e={raw,parts:[],refs:0};[raw.k,...raw.anims.map(a=>a.k)].forEach((k,i)=>{k.cacheKey=id;k.part=i;});GEOMETRY.set(id,e);return raw;}
 function retain(b,group){const key=Object.values(b).find(g=>g?.userData.hfAsset)?.userData.hfAsset,e=GEOMETRY.get(key);if(!e)return;e.refs++;group.userData.hfRelease=()=>{if(!group.userData.hfRelease)return;delete group.userData.hfRelease;e.refs=Math.max(0,e.refs-1);evict();};evict();}
 function releaseTree(root){root?.traverse(o=>o.userData.hfRelease?.());}
 function studioEnvironment(){
  if(environment)return environment;
  const w=256,h=128,a=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h,i=(y*w+x)*4;let c=[.16,.18,.21];if(v<.56)c=[.21,.25,.31];for(const [cx,cy,sx,sy,L,tint] of [[.21,.29,.045,.10,7,[1,.95,.83]],[.61,.40,.035,.20,4,[.65,.82,1]],[.89,.27,.10,.02,5,[1,1,1]],[.84,.68,.13,.13,4,[1,.92,.79]],[.45,.69,.12,.055,3,[.86,.94,1]]]){const d=Math.max(Math.abs(u-cx)/sx,Math.abs(v-cy)/sy),f=L*Math.max(0,1-d*.86);for(let z=0;z<3;z++)c[z]+=f*tint[z];}a.set([...c,1],i);}
  environment=new THREE.DataTexture(a,w,h,THREE.RGBAFormat,THREE.FloatType);environment.mapping=THREE.EquirectangularReflectionMapping;environment.colorSpace=THREE.LinearSRGBColorSpace;environment.needsUpdate=true;return environment;
 }
 async function ensure(q=quality,options={}){
  if(!['high','low'].includes(q))throw Error('Invalid visual quality');const current=BANKS.get(q);if(current?.state==='ready')return true;if(current?.promise)return current.promise;
  const bank={state:'loading',materials:new Map(),textures:[],error:null};BANKS.set(q,bank);
  bank.promise=(async()=>{try{
   const base=options.base||BASE,m=await fetch(base+'manifest.json?v='+VERSION,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Material manifest unavailable');return r.json();});if(m.version!==VERSION)throw Error('Material version mismatch');
   const maps={};for(const id of ['base','normal','orm']){
    const file=id+'-'+q+'.png',entry=m.files.find(x=>x.file===file);if(!entry)throw Error('Missing material map');const response=await fetch(base+file+'?v='+VERSION+'&h='+entry.sha256.slice(0,12));if(!response.ok)throw Error('Material image unavailable');const data=await response.arrayBuffer();if(data.byteLength!==entry.bytes)throw Error('Material size mismatch');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==entry.sha256)throw Error('Material checksum mismatch');
    const image=await createImageBitmap(new Blob([data]),{colorSpaceConversion:'none'});if(image.width!==(q==='high'?512:128)||image.height!==image.width){image.close();throw Error('Material dimensions mismatch');}
    const tex=new THREE.Texture(image);tex.flipY=false;tex.colorSpace=id==='base'?THREE.SRGBColorSpace:THREE.LinearSRGBColorSpace;tex.needsUpdate=true;tex.userData.hfImage=image;maps[id]=tex;bank.textures.push(tex);
   }
   bank.maps=maps;bank.state='ready';generation++;if(typeof dispatchEvent==='function')dispatchEvent(new Event('lunar-graphics-ready'));return true;
  }catch(e){bank.error=e.message;bank.state='error';for(const t of bank.textures){t.dispose();t.userData.hfImage?.close();}bank.textures=[];return false;}finally{bank.promise=null;}})();return bank.promise;
 }
 function material(key){
  const [,q,id]=key.split('_'),bank=BANKS.get(q);if(bank?.state!=='ready')return null;if(bank.materials.has(id))return bank.materials.get(id);
  const common={vertexColors:true,map:bank.maps.base};let m;
  if(id==='energy')m=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});
  else if(q==='high')m=new THREE.MeshStandardMaterial({...common,metalness:1,roughness:1,metalnessMap:bank.maps.orm,roughnessMap:bank.maps.orm,normalMap:bank.maps.normal,normalScale:new THREE.Vector2(.42,.42),aoMap:bank.maps.orm,aoMapIntensity:.7,envMap:studioEnvironment(),envMapIntensity:1.75});
  else m=new THREE.MeshPhongMaterial({...common,shininess:{paint:25,gold:85,steel:65,rubber:3}[id],specular:id==='rubber'?0x111111:0x666666});
  m.userData.hfShared=true;bank.materials.set(id,m);if(bank.materials.size>MAX_MATERIALS)throw Error('HF material bank cap');return m;
 }
 function configure(renderer,scene){if(!enabled||!renderer)return;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.outputColorSpace=THREE.SRGBColorSpace;}
 function attach(){users++;let released=false;return()=>{if(!released){released=true;users=Math.max(0,users-1);}};}
 function dispose(){if(users||[...GEOMETRY.values()].some(e=>e.refs))return false;for(const e of GEOMETRY.values())for(const p of e.parts)for(const g of Object.values(p||{}))g.dispose();GEOMETRY.clear();for(const b of BANKS.values()){for(const m of b.materials.values())m.dispose();for(const t of b.textures){t.dispose();t.userData.hfImage?.close();}}BANKS.clear();environment?.dispose();environment=null;generation++;}
 // Authored component primitives. +X forward, +Y up; all dimensions are visual tank units.
 const cylinder=(r,h,n)=>new THREE.CylinderGeometry(r,r,h,n),box=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
 function plate(points,h,b=.015){const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(p[0],-p[1]):s.moveTo(p[0],-p[1]));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.005,h-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:1,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(0,b,0);return g;}
 function crest(r,d,detail=true){
  // Explicit nonduplicated polygon avoids zero-area seam triangles at arc intersections.
  const rr=.85*r,dx=.38*r,x=(r*r-rr*rr+dx*dx)/(2*dx),y=Math.sqrt(r*r-x*x),a=Math.atan2(y,x),b=Math.atan2(y,x-dx),s=new THREE.Shape(),n=detail?16:8;
  for(let i=0;i<=n;i++){const t=a+i*(Math.PI*2-2*a)/n;const X=Math.cos(t)*r,Y=Math.sin(t)*r;i?s.lineTo(X,Y):s.moveTo(X,Y);}
  for(let i=1;i<n;i++){const t=-b-i*(Math.PI*2-2*b)/n;s.lineTo(dx+Math.cos(t)*rr,Math.sin(t)*rr);}s.closePath();
  return new THREE.ExtrudeGeometry(s,{depth:Math.max(.003,d-.004),bevelEnabled:detail,bevelThickness:.002,bevelSize:.003,bevelSegments:1,curveSegments:1});
 }
 function trackedDrive(k,F,{q=k.quality,side=1,length=2.5,height=.46,depth=.34,offset=.91,wheels=7,roadRadius=.148,endRadius=.18}={}){
  const high=q==='high',n=high?16:8,s=side,r=height/2,radius=r,half=(length-height)/2,a=half,z=offset,beltY=r+.03;
   // Open dark steel belt with individually articulated raised tread shoes and rubber inserts.
   const shape=new THREE.Shape(),hole=new THREE.Shape(),loop=(sh,l,r)=>{sh.moveTo(-l,-r);sh.lineTo(l,-r);sh.absarc(l,0,r,-Math.PI/2,Math.PI/2);sh.lineTo(-l,r);sh.absarc(-l,0,r,Math.PI/2,Math.PI*1.5);};loop(shape,a,r);loop(hole,a,r-.05);shape.holes.push(hole);const belt=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:high?6:3});put(k,belt,'rubber',F.rubber,[0,beltY,s*z-depth/2]);
   const pad=(x,y,angle)=>{put(k,box(high?.082:.11,.035,depth+.02),'steel','#626c76',[x,y,s*z],[0,0,angle]);if(high)put(k,box(.066,.022,depth*.67647),'rubber','#171c20',[x,y+.022,s*z],[0,0,angle]);};
   const count=high?17:9;for(let i=0;i<count;i++)for(const side of [-1,1])pad(-a+i*2*a/(count-1),beltY+side*(r+.005),0);
   for(const end of [-1,1])for(let i=1;i<(high?8:4);i++){const a=i*Math.PI/(high?8:4);pad(end*(half+Math.sin(a)*(radius+.005)),beltY+Math.cos(a)*(radius+.005),-end*a);}
   for(let i=0;i<wheels;i++){const x=-half+i*2*half/(wheels-1),r=i===0||i===wheels-1?endRadius:roadRadius,z=s*(offset+depth/2+.02);
    put(k,cylinder(r,.072,n),'rubber',F.rubber,[x,beltY-.01,z],[Math.PI/2,0,0]);put(k,cylinder(r*.79,.078,n),'steel','#4e5f70',[x,beltY-.01,z+s*.007],[Math.PI/2,0,0]);put(k,cylinder(r*.57,.086,n),'paint',F.paint,[x,beltY-.01,z+s*.014],[Math.PI/2,0,0]);put(k,cylinder(r*.24,.096,high?10:6),'gold',F.gold,[x,beltY-.01,z+s*.025],[Math.PI/2,0,0]);
    if(high)for(let j=0;j<5;j++){const a=j*Math.PI*2/5;put(k,cylinder(.011,.010,6),'steel','#b4bdc5',[x+Math.cos(a)*r*.66,beltY-.01+Math.sin(a)*r*.66,z+s*.049],[Math.PI/2,0,0]);}
    if(high&&i%2===0&&i<wheels-1){put(k,box(.22,.035,.025),'steel','#76818b',[x+.10,beltY+.13,s*(offset+depth/2+.02)],[0,0,.3]);for(let j=0;j<4;j++)put(k,new THREE.TorusGeometry(.026,.007,3,8),'gold',F.gold,[x+.05+j*.033,beltY+.14,s*(offset+depth/2+.01)],[0,Math.PI/2,0]);}
   }
 }
 // Collection authoring: all dimensions follow the canonical visual socket catalog, never rules.
 const CLASSES=Object.freeze({
  scout:{width:.37,prow:.34,rear:-.10,skirts:2,road:.125,role:'recon',gold:'#ba9a58'},
  vanguard:{width:.54,prow:.19,rear:0,skirts:3,road:.16,role:'assault',gold:'#c2a266'},
  titan:{width:.67,prow:.10,rear:.04,skirts:3,road:.19,role:'siege',gold:'#b99962'}
 });
 function finish(P,lunar){return {paint:lunar?'#171d27':P.hull||'#374959',plate:lunar?'#303946':P.tur||P.hull||'#536372',edge:lunar?'#c2a266':P.trim||'#a7b3bc',gold:'#c2a266',steel:'#a2acb8',rubber:'#192028',dark:'#121b25'};}
 function panel(k,x,y,z,l,w,h,mat,c,b=.012){
  const cut=Math.min(l,w)*.16,pts=[[-l/2+cut,-w/2],[l/2-cut,-w/2],[l/2,-w/2+cut],[l/2,w/2-cut],[l/2-cut,w/2],[-l/2+cut,w/2],[-l/2,w/2-cut],[-l/2,-w/2+cut]];
  return put(k,plate(pts,h,b),mat,c,[x,y,z]);
 }
 function bolt(k,x,y,z,axis='y',c='#b0bbc6',r=.014){put(k,cylinder(r,.013,6),'steel',c,[x,y,z],axis==='z'?[Math.PI/2,0,0]:axis==='x'?[0,0,Math.PI/2]:[0,0,0]);}
 function pipe(k,a,b,r,c,mat='steel'){
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A),g=cylinder(r,v.length(),k.quality==='high'?10:6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));put(k,g,mat,c,A.add(B).multiplyScalar(.5).toArray());
 }
 function vents(k,F,x,y,z,l=.34,w=.24,n=6){
  panel(k,x,y,z,l+.04,w+.04,.012,'rubber',F.dark,.004);
  for(let i=0;i<n;i++)put(k,box(l,.014,.015),'steel','#6f7e8c',[x,y+.017,z-w/2+(i+.5)*w/n],[.18,0,0]);
  if(k.quality==='high')for(const s of [-1,1])bolt(k,x+s*l*.43,y+.026,z+w*.42);
 }
 function collar(k,x,y,z,r,h,c,mat='steel',n=16){put(k,cylinder(r,h,n),mat,c,[x,y,z],[0,0,Math.PI/2]);}
 function tubeRing(k,x,y,z,r,t,c,mat='steel',arc=Math.PI*2){put(k,new THREE.TorusGeometry(r,t,k.quality==='high'?5:3,k.quality==='high'?20:10,arc),mat,c,[x,y,z],[0,Math.PI/2,0]);}
 function trackPod(k,F,o){
  const temp=kit(k.quality);trackedDrive(temp,F,o);
  for(const [id,list] of Object.entries(temp.surfaces)){for(const g of list)g.translate(o.center||0,0,0);(k.surfaces[id]||=[]).push(...list);}
 }
 function slopedArmor(g,start,end,drop,base=.19){
  const p=g.attributes.position;for(let i=0;i<p.count;i++){const f=Math.max(0,Math.min(1,(p.getX(i)-start)/(end-start)));if(p.getY(i)>base)p.setY(i,p.getY(i)-drop*f*Math.min(1,(p.getY(i)-base)/.28));}g.deleteAttribute('normal');return g;
 }
 function buildChassisKit(cls,tier,P,team,gems,lunar,q=quality){
  const o=M3.CHASSIS_VISUALS[cls][tier],v=CLASSES[cls],high=q==='high',scout=cls==='scout',titan=cls==='titan',k=kit(q),F=finish(P,lunar),A=[],half=o.len/2-.08,w=v.width,deck=o.deck;
  const bp=[[-half,-w*.91],[-half+.13,-w],[half-v.prow,-w],[half,-w*.50],[half+.035,0],[half,w*.50],[half-v.prow,w],[-half+.13,w],[-half,w*.91]],tp=bp.map(([x,z])=>[x*.91-.035,z*.84]);
  put(k,slopedArmor(M3.loft(bp,tp,.19,deck-.07),half*.25,half,.19),'paint',F.paint);
  // Dark channels are genuine panel recesses between individually bevelled armour leaves.
  panel(k,-.15,deck-.065,0,half*1.48,w*1.64,.045,'rubber',F.dark,.009);
  const roof=[[-half*.87,-w*.72],[half*.25,-w*.72],[half*.34,-w*.54],[half*.34,w*.54],[half*.25,w*.72],[-half*.87,w*.72]];put(k,plate(roof,.052,high?.016:.008),'paint',F.plate,[0,deck-.035,0]);
  for(const s of [-1,1]){
   // Canonical tier identities: split recon pods, reinforced assault, four-pod epic Titan.
   const split=(scout&&tier===2)||(titan&&tier===2),podLen=split?(o.len-.14)/2:o.len,centers=split?[-(o.len+.14)/4,(o.len+.14)/4]:[0];
   for(const center of centers)trackPod(k,F,{q,side:s,length:podLen,height:o.h,depth:o.trackW,offset:o.trackZ,wheels:split?3:o.wheels,roadRadius:Math.min(v.road,o.h*.34),endRadius:o.h*.39,center});
   const outer=o.trackZ+o.trackW/2+.025,inner=o.trackZ-o.trackW/2-.025,segments=v.skirts+(tier===2?1:0),step=(o.len-.16)/segments;
   for(let i=0;i<segments;i++){
    const x=-half+.11+(i+.5)*step,points=[[x-step*.44,s*inner],[x+step*.36,s*inner],[x+step*.48,s*(outer-.06)],[x+step*.32,s*outer],[x-step*.44,s*outer]];
    put(k,plate(points,.065+tier*.009,high?.014:.008),'paint',i%2?F.paint:F.plate,[0,o.h+.045,0]);
    put(k,box(step*.66,.013,.022),'steel',F.edge,[x,o.h+.123+tier*.009,s*(outer-.07)]);
    if(high)for(const d of [-.29,.29])bolt(k,x+d*step,o.h+.13+tier*.009,s*(inner+.045));
    if(tier||lunar){
     // Angled side escutcheon hangs below fender without occluding road wheels.
     const sideGeo=plate([[-step*.41,-.065],[step*.32,-.065],[step*.43,.04],[step*.22,.09],[-step*.41,.09]],.024,.008);sideGeo.rotateX(Math.PI/2);
     put(k,sideGeo,'paint',F.paint,[x,o.h-.015,s*(outer+.008)]);
     pipe(k,[x-step*.33,o.h+.015,s*(outer+.029)],[x+step*.29,o.h+.015,s*(outer+.029)],.009,F.edge,lunar?'gold':'steel');
    }
   }
   // Long layered glacis with inset lights; lower lip, tow eye and protective corner.
   const front=[[half*.29,s*.045],[half*.94,s*.045],[half,s*w*.38],[half*.69,s*w*.90],[half*.26,s*w*.90]];
   put(k,slopedArmor(M3.loft(front,front.map(([x,z])=>[x-.035,z*.96]),deck-.06,deck+.02),half*.25,half,.19),'paint',F.plate);
   pipe(k,[half*.43,deck-.022,s*w*.67],[half*.75,deck-.103,s*w*.55],.008,lunar?F.gold:F.edge,lunar?'gold':'steel');
   panel(k,half-.04,.27,s*(w*.91),.10,.14,.075,'steel',F.steel,.007);
   put(k,new THREE.TorusGeometry(.04,.013,4,high?12:8),'steel',F.edge,[half+.025,.22,s*(w*.81)],[0,Math.PI/2,0]);
   const lx=half-.06,lz=o.trackZ;panel(k,lx,o.h+.03,s*lz,.13,.18,.055,'rubber',F.dark,.005);put(k,box(.018,.022,.10),'energy','#c0eaff',[lx+.072,o.h+.062,s*lz]);
   put(k,box(.15,.018,.026),'energy',team,[.13,deck+.043,s*(w*.65)]);if(tier)put(k,box(.12,.011,.022),'steel',M3.TIERC[tier],[-.37,deck+.043,s*(w*.70)]);
   // Protected rear power unit, exhaust collars and actual recessed louvers.
   vents(k,F,-half*.65,deck+.018,s*w*.46,scout?.23:.32,scout?.15:.25,high?7+tier:3);
   pipe(k,[-half-.015,.34,s*w*.60],[-half-.015,deck-.03,s*w*.60],.047,F.steel);
   put(k,cylinder(.041,.022,high?12:8),'rubber',F.dark,[-half-.015,deck-.02,s*w*.60]);
   put(k,box(.018,.025,.12),'energy','#b94528',[-half-.026,.39,s*(o.trackZ)]);
   if(high){
    // Accessible bolt rows and restrained conduit runs at useful mobile-scale sizes.
    for(let i=0;i<4;i++)bolt(k,-half*.47+i*.19,deck+.031,s*w*.72);
    pipe(k,[-half*.72,deck+.06,s*w*.82],[-.35,deck+.06,s*w*.82],.018,lunar?F.gold:'#697988',lunar?'gold':'steel');
    panel(k,-.36,deck+.038,s*w*.51,.15,.18,.024,'steel',F.steel,.005);
   }
   if(lunar){
    // Flush, inlaid side crest; zero fins, hover hardware or orbiting components.
    const x=-half*.25,z=s*(outer+.037),cy=o.h-.015;
    put(k,crest(scout?.09:.125,.007,high),'gold',F.gold,[x,cy,z]);
    pipe(k,[x-.20,cy-.06,z],[x+.17,cy-.06,z],.006,F.gold,'gold');
    if(high){
     for(const d of [-1,1])pipe(k,[x+d*.19,cy+.025,z],[x+d*.11,cy+.075,z],.005,F.gold,'gold');
     for(const px of [-half*.63,half*.23])panel(k,px,o.h+.13,s*(outer-.09),.12,.07,.015,'gold',F.gold,.003);
    }

   }
  }
  if(scout){
   // Narrow sensor keel; T1 split pods; T2 paired protected outriggers and wing blades.
   panel(k,-.20,deck+.022,0,.48,.24,.045,'paint',F.plate,.01);
   panel(k,-.42,deck+.077,0,.17,.20,.045,'steel',F.edge,.006);put(k,box(.012,.027,.12),'energy',team,[-.328,deck+.099,0]);
   if(tier===2)for(const s of [-1,1]){
    put(k,plate([[-.62,s*.41],[.08,s*.46],[.33,s*.64],[-.57,s*.72]],.05,.012),'paint',F.plate,[0,deck+.02,0]);
    panel(k,-.64,deck+.081,s*.49,.20,.13,.075,'steel',F.steel,.007);put(k,box(.012,.026,.08),'energy','#6bcde5',[-.53,deck+.11,s*.49]);
   }
  }else if(titan){
   // Wider structural shoulders; ram/citadel construction is geometry, not rarity paint.
   for(const s of [-1,1]){
    panel(k,.04,deck-.035,s*.56,.76,.29,.11,'paint',F.paint,.015);
    if(tier)panel(k,.50,deck+.015,s*.49,.35,.28,.10,'steel',lunar?F.gold:F.edge,.012);
    if(high)for(const x of [-.23,.05,.32])panel(k,x,deck+.09,s*.59,.055,.20,.026,'steel',F.steel,.003);
   }
   if(tier===1)put(k,M3.loft([[half-.30,-.63],[half+.04,-.47],[half+.04,.47],[half-.30,.63]],[[half-.33,-.52],[half-.08,-.42],[half-.08,.42],[half-.33,.52]],.21,.58),'paint',F.plate);
   if(tier===2){panel(k,-.36,deck+.015,0,.68,.58,.07,'paint',F.plate,.015);for(const s of [-1,1])vents(k,F,-.64,deck+.10,s*.26,.27,.18,high?7:3);}
  }else{
   if(tier===1)for(const s of [-1,1])put(k,plate([[-.46,s*.41],[.34,s*.43],[.69,s*.68],[-.58,s*.66]],.075,.012),'paint',F.plate,[0,deck-.015,0]);
   if(tier===2)for(const s of [-1,1]){
    panel(k,-.32,deck+.025,s*.46,.50,.28,.105,'paint',F.plate,.014);
    panel(k,.43,deck+.045,s*.44,.27,.24,.08,'steel',lunar?F.gold:F.edge,.012);
    if(high)vents(k,F,-.36,deck+.139,s*.45,.32,.17,5);
   }
  }
  // Recessed central service spine and two stepped, sloping prow shields.
  for(const s of [-1,1]){
   const g=plate([[half*.39,s*.065],[half*.82,s*.07],[half*.91,s*w*.29],[half*.69,s*w*.57],[half*.37,s*w*.56]],.027,.008);g.translate(0,deck+.038,0);
   put(k,slopedArmor(g,half*.25,half,.19),'paint',lunar?'#343a44':F.paint);
   if(high)for(const d of [.46,.65,.80])bolt(k,half*d,deck+.048-.19*(d-.25)/.75,s*w*.38);
  }
  // Raised rear hatch and locking mechanism remain outside the rotating turret envelope.
  panel(k,-half*.76,deck+.039,0,.27,scout?.18:.28,.035,'paint',F.paint,.009);
  pipe(k,[-half*.85,deck+.085,-.05],[-half*.67,deck+.085,-.05],.015,F.steel);
  // Common mechanical hardpoint and account-owned cores retain exact canonical coordinates.
  const ringRadius=scout?.36:titan?.47:.43;
  put(k,cylinder(ringRadius+.035,.040,high?24:12),'rubber',F.dark,[0,o.ring-.055,0]);put(k,cylinder(ringRadius,.036,high?24:12),'steel',F.steel,[0,o.ring-.018,0]);
  if(high)for(let i=0;i<8;i++){const a=i*Math.PI/4;bolt(k,Math.cos(a)*ringRadius*.90,o.ring+.005,Math.sin(a)*ringRadius*.90);}
  const coreX=-.90,coreY=cls==='vanguard'&&tier===0?.715:deck+.05;for(let i=0;i<3;i++){const z=(i-1)*.25;put(k,cylinder(.10,.05,8),'rubber',F.dark,[coreX,coreY,z]);if(gems?.[i]&&GEM[gems[i]])put(k,new THREE.OctahedronGeometry(.085),'energy',GEM[gems[i]].c,[coreX,coreY+.08,z],[0,0,0],[1,1.3,1]);}
  if(lunar){const g=crest(scout?.11:.15,.006,high);g.rotateX(-Math.PI/2);g.translate(half*.66,deck+.067,0);put(k,slopedArmor(g,half*.25,half,.19),'gold',F.gold);}
  return {k,anims:A,meta:{ty:o.ring,bob:0,halos:[-1,1].map(s=>[half+.012,o.h+.062,s*o.trackZ,'#bdeaff',.10]),trail:[],tc:F.edge,hf:VERSION,legend:lunar?'lunar-black-gold':undefined,profile:cls+':'+tier}};
 }
 function turret(k,F,o,team,arch,tier){
  const high=k.quality==='high',back=arch==='siege'?-.66:-.54,w=o.width,Y=o.y;
  put(k,cylinder(.405,.045,high?24:12),'rubber',F.dark,[0,.023,0]);put(k,cylinder(.365,.026,high?24:12),'steel',F.steel,[0,.058,0]);
  const pts=[[back,-w*.85],[back+.10,-w],[.14,-w],[.48,-w*.59],[.56,0],[.48,w*.59],[.14,w],[back+.10,w],[back,w*.85]];
  put(k,M3.loft(pts,pts.map(([x,z])=>[x*.86-.045,z*.79]),.075,.285+tier*.012),'paint',F.paint);
  panel(k,-.14,.291+tier*.012,0,.54,w*1.1,.043,'paint',F.plate,.012);
  for(const s of [-1,1]){
   const cheek=[[back+.08,s*w*.74],[.11,s*w*.73],[.40,s*w*.40],[.30,s*(w+.08)],[back+.08,s*(w+.04)]];
   put(k,plate(cheek,.07,.012),'paint',F.plate,[0,.14,0]);
   pipe(k,[back+.12,.18,s*(w+.057)],[.12,.18,s*(w+.057)],.012,F.edge,'steel');
   // Independent angular cheek plates with a recessed break line, not a solid turret box.
   const cheekTop=[[back+.13,s*w*.61],[-.14,s*w*.61],[.20,s*w*.45],[.16,s*w*.77],[back+.14,s*w*.82]];
   put(k,plate(cheekTop,.055,.012),'paint',F.paint,[0,.269+tier*.012,0]);
   panel(k,-.43,.12,s*(w+.035),.12,.09,.10,'steel',F.steel,.006);

   put(k,box(.12,.018,.026),'energy',team,[-.08,.344+tier*.012,s*w*.58]);
   if(high){for(const x of [back+.16,-.12,.16])bolt(k,x,.29+tier*.012,s*w*.67);vents(k,F,-.30,.338+tier*.012,s*w*.50,.22,.13,4+tier);}
  }
  panel(k,-.19,.354+tier*.012,0,.23,.20,.027,'steel',F.steel,.006);
  put(k,box(.018,.027,.10),'energy','#83c6df',[-.064,.369+tier*.012,0]);
  if(tier===2)for(const s of [-1,1])panel(k,-.43,.30,s*w*.74,.28,.20,.10,'paint',F.plate,.012);
 }
 function barrel(k,F,o,z,arch,tier){
  const high=k.quality==='high',Y=o.y,tip=o.tip+(arch==='pulse'&&tier===0?0:.012),r=o.bore;
  const start=.48,len=tip-start,heavy=arch==='siege';
  // Continuous machined tube with separated jacket segments, recesses and visible bore.
  collar(k,(start+tip)/2,Y,z,r,len-.025,F.steel,'steel',high?20:10);
  const count=heavy?2:tier+2;
  for(let i=0;i<count;i++){
   const x=.64+i*(len-.40)/Math.max(1,count-1),rr=r*(heavy?1.42:1.30),l=heavy?.30:.18;
   collar(k,x,Y,z,rr,l,F.paint,'paint',high?12:8);
   tubeRing(k,x-l*.49,Y,z,rr,.009,F.edge);
   for(const s of [-1,1])put(k,box(l*.65,r*.45,.013),'rubber',F.dark,[x,Y,z+s*rr]);
   if(high)for(const s of [-1,1])bolt(k,x,Y+r*.65,z+s*rr,'z',F.steel,.010);
  }
  const muzzleR=r*(heavy?1.62:1.50),ml=heavy?.22:.12;
  collar(k,tip-ml/2-.008,Y,z,muzzleR,ml,F.plate,'paint',heavy?8:high?16:10);
  collar(k,tip-.010,Y,z,r*1.04,.018,F.steel,'steel',high?20:10);
  collar(k,tip+.001,Y,z,r*.80,.012,F.dark,'rubber',high?20:10);
  if(arch==='pulse')collar(k,tip+.008,Y,z,r*.45,.010,'#8ce0ff','energy',high?20:10);
  if(high){
   for(const s of [-1,1])pipe(k,[.56,Y+r*.85,z+s*r*.72],[tip-.21,Y+r*.85,z+s*r*.72],.009,F.edge,'steel');
   if(heavy)for(const s of [-1,1])put(k,box(.11,.085,.014),'rubber',F.dark,[tip-.11,Y,z+s*muzzleR]);
  }
 }
 function buildStandardWeapon(arch,tier,P,team,lunar,cls,q=quality){
  const o=M3.WEAPON_VISUALS[arch][tier],k=kit(q),F=finish(P,lunar),A=[],high=q==='high',tips=[];
  turret(k,F,o,team,arch,tier);
  if(arch==='pulse'){
   barrel(k,F,o,0,arch,tier);tips.push([o.tip+(tier===0?0:.012),o.y,0]);
   // Faceted separated power jackets leave a central sightline and visible cooling gaps.
   for(let i=0;i<2+tier;i++)for(const s of [-1,1]){
    const x=.63+i*(.86/(1+tier)),z=s*(o.bore+.045),pts=[[x-.10,z-s*.025],[x+.10,z-s*.025],[x+.14,z+s*.04],[x+.06,z+s*.07],[x-.10,z+s*.07]];
    put(k,plate(pts,.055,.008),'paint',F.plate,[0,o.y+.015,0]);
    if(high)bolt(k,x,o.y+.087,z+s*.02);
   }
   // T0 paired cells, T1 wider radial bank, T2 rail accelerator cage.
   for(const s of [-1,1]){
    const z=s*(tier===2?.30:.42);panel(k,-.30,.16,z,.35,.18,.16,'paint',F.plate,.01);
    collar(k,-.29,.245,z,.072,.23,F.steel,'steel',high?14:8);
    collar(k,-.16,.245,z,.048,.013,'#4faee1','energy',high?14:8);
    if(tier===1)for(let i=0;i<3;i++)tubeRing(k,.69+i*.25,o.y,0,o.bore*1.70,.022,'#4d8aa5','steel');
    if(tier===2){
     panel(k,1.09,o.y-.08,s*.24,1.04,.105,.13,'paint',F.plate,.01);
     pipe(k,[.57,o.y+.095,s*.23],[1.66,o.y+.095,s*.23],.023,F.steel);
     for(let i=0;i<4;i++)put(k,box(.11,.015,.03),'energy','#3a97c1',[.68+i*.25,o.y+.112,s*.24]);
    }
   }
   if(tier===2&&high){const a=kit(q);tubeRing(a,0,0,0,.18,.012,F.edge,'steel',Math.PI*1.5);A.push({k:a,p:[.72,o.y,0],axis:'x',spd:3});}
  }else if(arch==='twin'){
   const dz=tier===2?.25:.21;
   for(const s of [-1,1]){
    barrel(k,F,o,s*dz,arch,tier);tips.push([o.tip+.012,o.y,s*dz]);
    panel(k,-.24,.13,s*(tier?.55:.46),.39,.23,.20,'paint',F.plate,.015);
    // Twin feed link belt and tier-specific drum / angular feed cartridge.
    if(tier){
     put(k,cylinder(.165,.15,high?20:10),'steel',F.steel,[-.26,.235,s*.61],[Math.PI/2,0,0]);put(k,cylinder(.11,.16,high?16:8),'paint',F.paint,[-.26,.235,s*.63],[Math.PI/2,0,0]);
     if(high)for(let i=0;i<8;i++){const a=i*Math.PI/4;bolt(k,-.26+Math.cos(a)*.135,.235+Math.sin(a)*.135,s*.70,'z');}
    }
    for(let i=0;i<(high?5:3);i++){const x=-.37+i*.075;put(k,box(.045,.045,.055),'gold',F.edge,[x,.31,s*.46],[.18,0,0]);}
    pipe(k,[.16,.15,s*.39],[.65,.15,s*dz],.021,F.steel);
    // Receiver heat shields and a linked feed trough remain distinct from the two barrels.
    const g=plate([[.32,-.06],[.72,-.06],[.82,0],[.72,.06],[.32,.06]],.055,.008);put(k,g,'paint',F.plate,[0,o.y+.035,s*dz]);
    if(high)for(let j=0;j<4;j++)put(k,box(.033,.014,.055),'rubber',F.dark,[.40+j*.085,o.y+.101,s*dz]);

    if(tier===2){
     panel(k,-.45,.34,s*.48,.27,.21,.10,'paint',F.plate,.012);
     collar(k,1.08,o.y,s*dz,.10,.24,F.steel,'steel',high?16:8);
     if(high){const a=kit(q);for(const d of [-1,1])put(a,box(.40,.027,.025),'steel',F.steel,[0,d*.085,0]);tubeRing(a,.2,0,0,.11,.013,F.edge);A.push({k:a,p:[1.10,o.y,s*dz],axis:'x',spd:8*s});}
    }
   }
   panel(k,.30,.09,0,.43,.17,.04,'rubber',F.dark,.006);
  }else{
   const zs=tier===2?[-.235,.235]:[0];
   for(const z of zs){barrel(k,F,o,z,arch,tier);tips.push([o.tip+.012,o.y,z]);}
   panel(k,.32,.14,0,.44,.60,.28,'paint',F.plate,.018);
   for(const s of [-1,1]){
    const cheek=[[.05,s*.25],[.43,s*.22],[.57,s*.32],[.39,s*.43],[.05,s*.42]];
    put(k,plate(cheek,.13,.016),'paint',F.paint,[0,.19,0]);
    if(high)for(const x of [.14,.34])bolt(k,x,.344,s*.34,'y',F.steel,.021);
   }

   for(const s of [-1,1]){
    collar(k,.75,.39,s*.33,.053,.90,F.steel,'steel',high?16:8);collar(k,.43,.39,s*.33,.092,.30,F.paint,'paint',high?14:8);tubeRing(k,.57,.39,s*.33,.094,.013,F.edge);
    if(tier)put(k,plate([[.32,s*.22],[1.21,s*.23],[1.42,s*.33],[.43,s*.43]],.065,.012),'paint',F.plate,[0,.08,0]);
    if(high){pipe(k,[-.46,.35,s*.37],[.41,.35,s*.37],.019,F.edge,'steel');for(let i=0;i<4;i++)bolt(k,.25+i*.15,.30,s*.31);}
   }
   if(tier===2){panel(k,-.55,.22,0,.36,.57,.20,'paint',F.plate,.015);vents(k,F,-.55,.43,0,.22,.40,high?8:4);}
  }
  return {k,anims:A,meta:{tips,halos:tips.map(p=>[...p,'#88d8f1',arch==='siege'?.20:.13]),hf:VERSION,profile:arch+':'+tier}};
 }
 function buildMoonbeam(arch,tier,P,team,lunar,cls,q=quality){
  const k=kit(q),A=[],high=q==='high',Y=.63,S='#c4cdd8',G='#c7a466',D='#222c39',F=finish({},false),n=high?24:12;
  // One low dark cradle; mechanically connected trunnions, no showroom pedestal.
  put(k,cylinder(.42,.05,n),'rubber',D,[0,.025,0]);put(k,cylinder(.35,.03,n),'gold',G,[0,.065,0]);
  panel(k,-.10,.09,0,.82,.60,.13,'paint',D,.018);
  for(const s of [-1,1]){
   pipe(k,[-.42,.22,s*.24],[.07,.46,s*.24],.052,S);put(k,cylinder(.14,.055,n),'gold',G,[-.15,.45,s*.30],[Math.PI/2,0,0]);put(k,cylinder(.085,.066,n),'steel',D,[-.15,.45,s*.31],[Math.PI/2,0,0]);
   put(k,box(.14,.018,.026),'energy',team,[-.17,.25,s*.34]);
  }
  // Silver machined breech / gold power conduits, then a truly exposed longitudinal core.
  collar(k,-.33,Y,0,.215,.85,D,'paint',high?20:10);
  for(const s of [-1,1]){
   panel(k,-.39,Y+.16,s*.12,.72,.17,.07,'steel',S,.012);
   panel(k,-.52,Y-.16,s*.13,.40,.17,.05,'steel',S,.009);
   pipe(k,[-.70,Y+.25,s*.18],[-.20,Y+.25,s*.18],.025,G,'gold');
   pipe(k,[-.70,Y+.25,s*.18],[-.77,Y+.10,s*.18],.025,G,'gold');
   pipe(k,[-.77,Y+.10,s*.18],[-.77,Y-.13,s*.18],.023,G,'gold');
   pipe(k,[-.70,Y-.20,s*.18],[.37,Y-.20,s*.18],.028,G,'gold');
   panel(k,-.43,Y-.05,s*.255,.44,.06,.10,'steel',S,.009);
   if(high){for(let i=0;i<4;i++)bolt(k,-.67+i*.17,Y+.238,s*.14);for(let i=0;i<6;i++)put(k,box(.025,.075,.012),'rubber',D,[-.65+i*.075,Y-.01,s*.291]);}
  }
  collar(k,.77,Y,0,.087,3.00,'#045ec4','energy',n);collar(k,.80,Y+.028,.025,.029,2.94,'#9ee8ff','energy',n);
  // Four slim rails expose the blue tube instead of enclosing it in an opaque cylinder.
  for(const a of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]){
   const y=Y+Math.sin(a)*.195,z=Math.cos(a)*.195;
   put(k,box(2.52,.045,.042),'steel',S,[1.01,y,z],[a,0,0]);
   pipe(k,[-.19,Y+Math.sin(a)*.235,Math.cos(a)*.235],[2.20,Y+Math.sin(a)*.235,Math.cos(a)*.235],.013,G,'gold');
  }
  // Fine helical charging conductor is a connected physical winding around the ONE blue core.
  if(high){const count=44;for(let i=0;i<count;i++){const a=i*Math.PI*.42,b=(i+1)*Math.PI*.42,x=.12+i*1.91/count,nx=.12+(i+1)*1.91/count;pipe(k,[x,Y+Math.sin(a)*.108,Math.cos(a)*.108],[nx,Y+Math.sin(b)*.108,Math.cos(b)*.108],.006,'#58b5e9','energy');}}
  // Attached silver breech spine and cable junctions break up the rear housing.
  for(const s of [-1,1]){
   for(const x of [-.62,-.30,.02]){panel(k,x,Y+.19,s*.16,.13,.12,.045,'steel',S,.006);if(high)bolt(k,x,Y+.25,s*.16);}
   collar(k,-.68,Y-.16,s*.22,.045,.11,G,'gold',high?12:8);
  }
  for(const [x,r] of [[-.70,.24],[-.15,.245],[.43,.26],[1.05,.25],[1.66,.27],[2.19,.315]]){
   tubeRing(k,x,Y,0,r,.035,S);tubeRing(k,x-.039,Y,0,r+.018,.014,G,'gold');tubeRing(k,x+.041,Y,0,r-.012,.014,'#419add','energy');
   if(high)for(let i=0;i<8;i++){const a=i*Math.PI/4;put(k,box(.055,.026,.026),'steel',D,[x,Y+Math.sin(a)*(r+.024),Math.cos(a)*(r+.024)],[a,0,0]);bolt(k,x+.034,Y+Math.sin(a)*(r+.022),Math.cos(a)*(r+.022),'x',G,.010);}
  }
  for(const x of [-.16,.96,2.01])for(const s of [-1,1]){
   // Attached side crescents carry a physical foot and captive pivot fasteners.
   panel(k,x,Y-.23,s*.215,.13,.18,.05,'paint',D,.006);
   put(k,crest(x>2?.34:.285,.026,high),'gold',G,[x,Y,s*.26]);
   if(high){bolt(k,x-.15,Y+.05,s*.289,'z',S,.018);pipe(k,[x-.16,Y-.12,s*.27],[x-.17,Y-.22,s*.20],.022,G,'gold');}
  }
  // Deep concentric focusing aperture; muzzle coordinate remains exactly 2.35,.63,0.
  tubeRing(k,2.28,Y,0,.312,.024,G,'gold');tubeRing(k,2.31,Y,0,.255,.022,S);
  collar(k,2.318,Y,0,.219,.022,'#064d91','energy',n);tubeRing(k,2.338,Y,0,.185,.012,'#78ccff','energy');collar(k,2.34,Y,0,.145,.018,'#c4edff','energy',n);
  if(high)for(const x of [.43,1.66]){const a=kit(q);tubeRing(a,0,0,0,.30,.010,G,'gold',Math.PI*1.75);A.push({k:a,p:[x,Y,0],axis:'x',spd:x<1?.65:-.65});}
  return {k,anims:A,meta:{tips:[[2.35,Y,0]],halos:[[2.35,Y,0,'#66cfff',.22]],hf:VERSION,legend:'moonbeam-unified'}};
 }
 const BUILDERS=Object.freeze(Object.fromEntries([
  ...Object.keys(CLASSES).flatMap(c=>[0,1,2].map(t=>['chassis:'+c+':'+t,buildChassisKit])),
  ...['pulse','twin','siege'].flatMap(a=>[0,1,2].map(t=>['weapon:'+a+':'+t,buildStandardWeapon])),['weapon:moon',buildMoonbeam]
 ]));
 function chassisKit(cls,tier,P,team,gems,lunar,q=quality){tier=M3.visualTier(tier);const build=BUILDERS['chassis:'+cls+':'+tier];if(!build)throw Error('Unknown visual chassis');return cached(JSON.stringify(['chassis',q,cls,tier,P,team,gems,lunar]),()=>build(cls,tier,P,team,gems,lunar,q));}
 function weaponKit(arch,tier,P,team,lunar,cls,q=quality){tier=M3.visualTier(tier);const build=BUILDERS['weapon:'+arch]||BUILDERS['weapon:'+arch+':'+tier];if(!build)throw Error('Unknown visual weapon');return cached(JSON.stringify(['weapon',q,arch,tier,arch==='moon'?null:P,team,arch==='moon'?false:lunar]),()=>build(arch,tier,P,team,lunar,cls,q));}
 function convert(raw,q){const out=kit(q),walk=(old,target)=>{for(const [bucket,gs] of Object.entries(old))for(const geo of gs){const a=geo.attributes.color.array,c=new THREE.Color().setRGB(a[0],a[1],a[2]),id=bucket==='glow'?'energy':c.r>c.b*1.8&&c.g>c.b*1.2?'gold':Math.max(c.r,c.g,c.b)<.04?'rubber':Math.max(c.r,c.g,c.b)<.18?'paint':'steel';put(target,geo,id,c);}};walk(raw.k,out);return {k:out,meta:raw.meta,anims:raw.anims.map(a=>{const k=kit(q);walk(a.k,k);return {...a,k};})};}
 return {VERSION,MAX_BANKS,get enabled(){return enabled},set enabled(v){enabled=!!v;generation++},get quality(){return quality},set quality(v){if(!['high','low'].includes(v))throw Error('Invalid quality');quality=v;generation++},get generation(){return generation},active,status,ensure,material,configure,attach,dispose,retain,releaseTree,kit,put,bake,chassisKit,weaponKit,convert,builders:BUILDERS,components:{plate,cylinder,crest,trackedDrive,panel,bolt,pipe,vents,trackPod},profiles:CLASSES,canChassis:(cls,t)=>active()&&!!BUILDERS['chassis:'+cls+':'+M3.visualTier(t)],canWeapon:(a,t)=>active()&&!!(BUILDERS['weapon:'+a]||BUILDERS['weapon:'+a+':'+M3.visualTier(t)]),stats:()=>({users,geometry:{entries:GEOMETRY.size,bytes:geometryBytes(),peakBytes,active:[...GEOMETRY.values()].filter(e=>e.refs).length,refs:[...GEOMETRY.values()].reduce((n,e)=>n+e.refs,0),idleBudget:GEOMETRY_BYTES},banks:[...BANKS].map(([q,b])=>({quality:q,state:b.state,textures:b.textures.length,materials:b.materials.size,error:b.error}))})};
})();
