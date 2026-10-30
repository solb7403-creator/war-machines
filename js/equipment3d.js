'use strict';
// HF v1: opt-in render-only sample, same M3 kits and moving-part contract. No account storage.
const Equipment3D=(()=>{
 const VERSION='hf-v1.1',BANKS=new Map(),MAX_BANKS=2,MAX_MATERIALS=14;
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
  const p=g.attributes.position.array,n=g.attributes.normal.array,u=g.attributes.uv.array,t=new Float32Array(p.length/3*4);
  for(let i=0;i<p.length;i+=9){const v=i/3,j=v*2,dx1=p[i+3]-p[i],dx2=p[i+6]-p[i],dy1=p[i+4]-p[i+1],dy2=p[i+7]-p[i+1],dz1=p[i+5]-p[i+2],dz2=p[i+8]-p[i+2],s1=u[j+2]-u[j],s2=u[j+4]-u[j],t1=u[j+3]-u[j+1],t2=u[j+5]-u[j+1],d=s1*t2-s2*t1;
   const tx=Math.abs(d)>1e-9?(dx1*t2-dx2*t1)/d:1,ty=Math.abs(d)>1e-9?(dy1*t2-dy2*t1)/d:0,tz=Math.abs(d)>1e-9?(dz1*t2-dz2*t1)/d:0;
   for(let k=0;k<3;k++){const ni=i+k*3,a=new THREE.Vector3(tx,ty,tz),N=new THREE.Vector3(n[ni],n[ni+1],n[ni+2]);a.addScaledVector(N,-a.dot(N));if(a.lengthSq()<1e-10)a.set(Math.abs(N.x)<.8?1:0,0,Math.abs(N.x)<.8?0:1).cross(N);a.normalize();const o=(v+k)*4;t.set([a.x,a.y,a.z,d<0?-1:1],o);}
  }g.setAttribute('tangent',new THREE.BufferAttribute(t,4));
 }
 const TILE={paint:0,gold:1,steel:2,rubber:3,energy:0};
 function put(k,geo,material,c,p=[0,0,0],r=[0,0,0],scale=[1,1,1]){
  if(!Object.prototype.hasOwnProperty.call(TILE,material))throw Error('HF authoring: unknown material '+material);
  const g=geo.index?geo.toNonIndexed():geo;if(g!==geo)geo.dispose();if(!g.attributes.normal)g.computeVertexNormals();
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
  else if(q==='high')m=new THREE.MeshStandardMaterial({...common,metalness:1,roughness:1,metalnessMap:bank.maps.orm,roughnessMap:bank.maps.orm,normalMap:bank.maps.normal,normalScale:new THREE.Vector2(.30,.30),aoMap:bank.maps.orm,aoMapIntensity:.7,envMap:studioEnvironment(),envMapIntensity:1.75});
  else m=new THREE.MeshPhongMaterial({...common,shininess:{paint:25,gold:85,steel:65,rubber:3}[id],specular:id==='rubber'?0x111111:0x666666});
  m.userData.hfShared=true;bank.materials.set(id,m);if(bank.materials.size>MAX_MATERIALS)throw Error('HF material bank cap');return m;
 }
 function configure(renderer,scene){if(!enabled||!renderer)return;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.outputColorSpace=THREE.SRGBColorSpace;}
 function attach(){users++;let released=false;return()=>{if(!released){released=true;users=Math.max(0,users-1);}};}
 function dispose(){if(users||[...GEOMETRY.values()].some(e=>e.refs))return false;for(const e of GEOMETRY.values())for(const p of e.parts)for(const g of Object.values(p||{}))g.dispose();GEOMETRY.clear();for(const b of BANKS.values()){for(const m of b.materials.values())m.dispose();for(const t of b.textures){t.dispose();t.userData.hfImage?.close();}}BANKS.clear();environment?.dispose();environment=null;generation++;}
 // Authored component primitives. +X forward, +Y up; all dimensions are visual tank units.
 const cylinder=(r,h,n)=>new THREE.CylinderGeometry(r,r,h,n),box=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
 function plate(points,h,b=.015){const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(p[0],-p[1]):s.moveTo(p[0],-p[1]));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.005,h-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:1,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(0,b,0);return g;}
 function crest(r,d){const R=r,rr=.85*r,dx=.38*r,x=(R*R-rr*rr+dx*dx)/(2*dx),y=Math.sqrt(R*R-x*x),a=Math.atan2(y,x),b=Math.atan2(y,x-dx),s=new THREE.Shape();s.absarc(0,0,R,a,Math.PI*2-a,false);s.absarc(dx,0,rr,-b,b-Math.PI*2,true);s.closePath();return new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:8});}
 function trackedDrive(k,F,{q=k.quality,side=1,length=2.5,height=.46,depth=.34,offset=.91,wheels=7,roadRadius=.148,endRadius=.18}={}){
  const high=q==='high',n=high?20:10,s=side,r=height/2,radius=r,half=(length-height)/2,a=half,z=offset,beltY=r+.03;
   // Open dark steel belt with individually articulated raised tread shoes and rubber inserts.
   const shape=new THREE.Shape(),hole=new THREE.Shape(),loop=(sh,l,r)=>{sh.moveTo(-l,-r);sh.lineTo(l,-r);sh.absarc(l,0,r,-Math.PI/2,Math.PI/2);sh.lineTo(-l,r);sh.absarc(-l,0,r,Math.PI/2,Math.PI*1.5);};loop(shape,a,r);loop(hole,a,r-.05);shape.holes.push(hole);const belt=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:high?6:3});put(k,belt,'rubber',F.rubber,[0,beltY,s*z-depth/2]);
   const pad=(x,y,angle)=>{put(k,high?plate([[-.039,-.18],[.039,-.18],[.042,.15],[.029,.18],[-.039,.18]],.038,.006).scale(1,1,(depth+.02)/.36):box(.11,.042,depth+.02),'steel','#626c76',[x,y,s*z],[0,0,angle]);if(high)put(k,box(.066,.022,depth*.67647),'rubber','#171c20',[x,y+.022,s*z],[0,0,angle]);};
   const count=high?20:11;for(let i=0;i<count;i++)for(const side of [-1,1])pad(-a+i*2*a/(count-1),beltY+side*(r+.005),0);
   for(const end of [-1,1])for(let i=1;i<(high?9:5);i++){const a=i*Math.PI/(high?9:5);pad(end*(half+Math.sin(a)*(radius+.005)),beltY+Math.cos(a)*(radius+.005),-end*a);}
   for(let i=0;i<wheels;i++){const x=-half+i*2*half/(wheels-1),r=i===0||i===wheels-1?endRadius:roadRadius,z=s*(offset+depth/2+.02);
    put(k,cylinder(r,.072,n),'rubber',F.rubber,[x,beltY-.01,z],[Math.PI/2,0,0]);put(k,cylinder(r*.79,.078,n),'steel','#737d86',[x,beltY-.01,z+s*.007],[Math.PI/2,0,0]);put(k,cylinder(r*.57,.086,n),'paint',F.paint,[x,beltY-.01,z+s*.014],[Math.PI/2,0,0]);put(k,cylinder(r*.24,.096,high?12:6),'gold',F.gold,[x,beltY-.01,z+s*.025],[Math.PI/2,0,0]);
    if(high)for(let j=0;j<5;j++){const a=j*Math.PI*2/5;put(k,cylinder(.011,.010,6),'steel','#b4bdc5',[x+Math.cos(a)*r*.66,.25+Math.sin(a)*r*.66,z+s*.049],[Math.PI/2,0,0]);}
    if(high&&i<wheels-1){put(k,box(.22,.035,.025),'steel','#76818b',[x+.10,beltY+.13,s*(offset+depth/2+.02)],[0,0,.3]);for(let j=0;j<4;j++)put(k,new THREE.TorusGeometry(.026,.007,3,8),'gold',F.gold,[x+.05+j*.033,beltY+.14,s*(offset+depth/2+.01)],[0,Math.PI/2,0]);}
   }
 }
 function buildChassisKit(cls,tier,P,team,gems,lunar,q=quality){
  const high=q==='high',n=high?20:10,k=kit(q),A=[],F={paint:lunar?'#262a2f':P.hull||'#354553',plate:lunar?'#34383d':P.tur||'#465764',edge:lunar?'#c3a264':P.trim||'#8897a6',gold:'#bea063',steel:'#818c96',rubber:'#11151b',dark:'#161c22'};
  const armor=(pts,y,h,c=F.paint)=>put(k,plate(pts,h,high?.022:.012),'paint',c,[0,y,0]);
  const outline=[[-1.13,-.56],[.60,-.56],[1.20,-.32],[1.26,0],[1.20,.32],[.60,.56],[-1.13,.56]];
  put(k,M3.loft(outline,outline.map(p=>[p[0]*.91-.035,p[1]*.83]),.23,.53),'paint',F.paint);armor([[-1.06,-.46],[.40,-.46],[1.01,-.26],[1.12,0],[1.01,.26],[.40,.46],[-1.06,.46]],.50,.12,F.plate);
  for(const s of [-1,1]){
   trackedDrive(k,F,{q,side:s});
   for(let i=0;i<3;i++){const x=-1.08+i*.69;armor([[x,s*.60],[x+.52,s*.60],[x+.64,s*.88],[x+.48,s*1.10],[x,s*1.08]],.52,.095,i%2?F.paint:F.plate);put(k,box(.40,.012,.022),'gold',F.edge,[x+.25,.627,s*.99]);if(high)for(const d of [.06,.46])put(k,cylinder(.017,.017,6),'steel','#b1b8bf',[x+d,.63,s*.86]);}
   armor([[.48,s*.055],[1.16,s*.06],[1.20,s*.20],[.94,s*.42],[.49,s*.40]],.53,.11,F.plate);
   put(k,box(.32,.008,.014),'gold',F.edge,[.82,.654,s*.31],[0,s*.18,0]);
   put(k,box(.026,.070,.21),'rubber',F.dark,[1.16,.46,s*.80]);put(k,box(.028,.018,.12),'energy','#e5f4ff',[1.178,.471,s*.80]);put(k,box(.18,.013,.033),'energy',team,[.42,.645,s*.69]);
   armor([[-.62,s*.69],[-.18,s*.69],[-.10,s*1.11],[-.70,s*1.11]],.49,.12);
   if(lunar)put(k,crest(.145,.010),'gold',F.gold,[-.40,.47,s*1.132]);
   put(k,box(.45,.022,.35),'rubber',F.dark,[-.88,.636,s*.24]);
   for(let i=0;i<(high?9:4);i++)put(k,box(.35,.015,.020),'steel','#626e78',[-.88,.656,s*(.07+i*.035)]);
   put(k,box(.022,.027,.13),'energy','#d05839',[-1.18,.43,s*.80]);
  }
  put(k,cylinder(.46,.045,high?32:16),'rubber',F.dark,[0,.725,0]);put(k,cylinder(.42,.055,high?32:16),'steel','#69747e',[0,.749,0]);
  if(lunar){const g=crest(.18,.009);g.rotateX(-Math.PI/2);put(k,g,'gold',F.gold,[.80,.657,0]);}
  for(let i=0;i<3;i++){const z=(i-1)*.25;put(k,cylinder(.10,.03,8),'rubber','#0b1117',[-.91,.69,z]);if(gems?.[i]&&GEM[gems[i]])put(k,new THREE.OctahedronGeometry(.08),'energy',GEM[gems[i]].c,[-.91,.76,z]);}
  return {k,anims:A,meta:{ty:.777,bob:0,halos:[[1.18,.47,.80,'#e5f4ff',.12],[1.18,.47,-.80,'#e5f4ff',.12]],trail:[],tc:F.gold,hf:VERSION}};
 }
 function buildWeaponKit(arch,tier,P,team,lunar,cls,q=quality){
  if(arch!=='moon')return convert(M3.foundationWeapon(arch,tier,P,team,lunar,cls),q);
  const k=kit(q),A=[],high=q==='high',n=high?24:12,Y=.63,S='#d1d8dd',G='#c2a366',D='#1c2530';
  const cyl=(r,h,x,y=Y,z=0,c=S,mat='steel')=>put(k,cylinder(r,h,n),mat,c,[x,y,z],[0,0,Math.PI/2]);
  const ring=(x,r,t,c=G,mat='gold',to=k)=>put(to,new THREE.TorusGeometry(r,t,high?6:4,n),mat,c,[x,Y,0],[0,Math.PI/2,0]);
  put(k,cylinder(.43,.07,n),'rubber',D,[0,.035,0]);put(k,cylinder(.35,.025,n),'gold',G,[0,.082,0]);
  put(k,plate([[-.56,-.31],[.29,-.31],[.46,0],[.29,.31],[-.56,.31]],.13,.02),'paint',D,[0,.10,0]);
  for(const s of [-1,1]){put(k,box(.65,.09,.08),'steel','#7b8790',[-.10,.34,s*.29],[0,0,.31]);put(k,cylinder(.15,.055,n),'gold',G,[-.20,.48,s*.33],[Math.PI/2,0,0]);put(k,cylinder(.10,.065,n),'rubber',D,[-.20,.48,s*.34],[Math.PI/2,0,0]);put(k,box(.14,.022,.022),'energy',team,[-.15,.25,s*.39]);}
  cyl(.09,3.00,.79,Y,0,'#0878e8','energy');cyl(.031,2.99,.79,Y+.055,.05,'#9deaff','energy');
  for(const x of [-.64,-.24,.16]){
   // Four separated bevelled cladding leaves expose the breech charging chamber.
   for(const s of [-1,1]){put(k,plate([[x-.14,s*.08],[x+.12,s*.08],[x+.17,s*.25],[x-.14,s*.27]],.055,.012),'steel',S,[0,.81,0]);put(k,box(.30,.085,.055),'steel','#aebbc7',[x,Y,s*.22]);put(k,box(.24,.025,.026),'gold',G,[x,.872,s*.18]);}
   ring(x,.24,.035,S,'steel');ring(x+.065,.24,.015,'#44bbff','energy');
  }
  for(const a of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]){put(k,box(2.55,.047,.045),'steel',S,[1.02,Y+Math.sin(a)*.20,Math.cos(a)*.20],[a,0,0]);put(k,box(2.4,.018,.018),'gold',G,[1.02,Y+Math.sin(a)*.235,Math.cos(a)*.235]);}
  for(const x of [.42,1.02,1.64,2.21]){
   ring(x,x>2?.285:.242,.045,S,'steel');ring(x-.045,x>2?.315:.267,.022,G);ring(x+.05,x>2?.27:.242,.021,'#41b5ff','energy');
   if(high)for(let i=0;i<12;i++){const a=i*Math.PI/6;put(k,box(.07,.025,.025),'gold',G,[x,Y+Math.sin(a)*.292,Math.cos(a)*.292],[a,0,0]);}
  }
  for(const x of [-.18,.95,2.03])for(const s of [-1,1]){put(k,box(.15,.05,.22),'paint',D,[x,.38,s*.22]);put(k,crest(x>2?.39:.32,.028),'gold',G,[x,Y,s*.26]);if(high)put(k,cylinder(.023,.035,8),'steel',S,[x-.16,Y,s*.285],[Math.PI/2,0,0]);}
  cyl(.205,.02,2.315,Y,0,'#0478e8','energy');cyl(.15,.022,2.326,Y,0,'#53cfff','energy');cyl(.09,.02,2.34,Y,0,'#e4faff','energy');ring(2.30,.305,.017,G);
  if(high)for(const x of [.43,1.65]){const a=kit(q);put(a,new THREE.TorusGeometry(.29,.012,4,n,Math.PI*1.75),'gold',G,[0,0,0],[0,Math.PI/2,0]);A.push({k:a,p:[x,Y,0],axis:'x',spd:x<1?.65:-.65});}
  return {k,anims:A,meta:{tips:[[2.35,Y,0]],halos:[[2.35,Y,0,'#66cfff',.22]],hf:VERSION}};
 }
 const BUILDERS=Object.freeze({'chassis:vanguard:0':buildChassisKit,'weapon:moon':buildWeaponKit,'weapon:pulse:0':buildWeaponKit});
 function chassisKit(cls,tier,P,team,gems,lunar,q=quality){return cached(JSON.stringify(['chassis',q,cls,tier,P,team,gems,lunar]),()=>BUILDERS['chassis:'+cls+':'+tier](cls,tier,P,team,gems,lunar,q));}
 function weaponKit(arch,tier,P,team,lunar,cls,q=quality){return cached(JSON.stringify(['weapon',q,arch,tier,arch==='moon'?null:P,team,arch==='moon'?false:lunar]),()=>(BUILDERS['weapon:'+arch]||BUILDERS['weapon:'+arch+':'+tier])(arch,tier,P,team,lunar,cls,q));}
 function convert(raw,q){const out=kit(q),walk=(old,target)=>{for(const [bucket,gs] of Object.entries(old))for(const geo of gs){const a=geo.attributes.color.array,c=new THREE.Color().setRGB(a[0],a[1],a[2]),id=bucket==='glow'?'energy':c.r>c.b*1.8&&c.g>c.b*1.2?'gold':Math.max(c.r,c.g,c.b)<.04?'rubber':Math.max(c.r,c.g,c.b)<.18?'paint':'steel';put(target,geo,id,c);}};walk(raw.k,out);return {k:out,meta:raw.meta,anims:raw.anims.map(a=>{const k=kit(q);walk(a.k,k);return {...a,k};})};}
 return {VERSION,MAX_BANKS,get enabled(){return enabled},set enabled(v){enabled=!!v;generation++},get quality(){return quality},set quality(v){if(!['high','low'].includes(v))throw Error('Invalid quality');quality=v;generation++},get generation(){return generation},active,status,ensure,material,configure,attach,dispose,retain,releaseTree,kit,put,bake,chassisKit,weaponKit,convert,builders:BUILDERS,components:{plate,cylinder,crest,trackedDrive},canChassis:(cls,t)=>active()&&!!BUILDERS['chassis:'+cls+':'+(t|0)],canWeapon:(a,t)=>active()&&!!(BUILDERS['weapon:'+a]||BUILDERS['weapon:'+a+':'+(t|0)]),stats:()=>({users,geometry:{entries:GEOMETRY.size,bytes:geometryBytes(),peakBytes,active:[...GEOMETRY.values()].filter(e=>e.refs).length,refs:[...GEOMETRY.values()].reduce((n,e)=>n+e.refs,0),idleBudget:GEOMETRY_BYTES},banks:[...BANKS].map(([q,b])=>({quality:q,state:b.state,textures:b.textures.length,materials:b.materials.size,error:b.error}))})};
})();
