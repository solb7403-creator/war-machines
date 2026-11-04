/* A single disposable renderer. The app's existing frame loop owns its updates. */
(function(root){
'use strict';
const W=root.ConquestWorld;
class View {
 constructor(host,onError){
 const T=root.THREE;this.T=T;this.host=host;this.onError=onError;this.chunks=new Map();this.keys={};this.stick={x:0,z:0};this.yaw=-Math.PI/2;this.pitch=.42;this.distance=23;this.frames=0;this.fps=0;this.elapsed=0;this.builds=0;this.disposed=false;
 this.p={x:898,z:1024,y:W.groundAt(898,1024),surface:'ground'};
 try{const p=JSON.parse(localStorage.getItem('lunar-conquest-position-v1'));if(p&&Number.isFinite(p.x)&&Number.isFinite(p.z)){this.jump(p.x,p.z);if(p.surface==='bridge'){const deck=W.deckAt(this.p.x,this.p.z);if(deck!==null){this.p.surface='bridge';this.p.y=deck;}}}}catch(_){}
 this.discovery=root.ConquestDiscovery?.create();
 if(this.p.x===898&&this.p.z===1024)this.discovery?.spawn(this.p);
 this.renderer=new T.WebGLRenderer({antialias:false,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));host.append(this.renderer.domElement);
 this.hfRelease=typeof Equipment3D!=='undefined'?Equipment3D.attach():null;if(typeof Equipment3D!=='undefined')Equipment3D.configure(this.renderer);
 this.scene=new T.Scene();this.scene.background=new T.Color(0x101b29);this.scene.fog=new T.Fog(0x101b29,1100,2560);
 this.camera=new T.PerspectiveCamera(55,1,.2,3000);this.scene.add(new T.HemisphereLight(0xc4ddff,0x353025,.85));const sun=new T.DirectionalLight(0xffe5ba,2.8);sun.position.set(-100,180,-70);this.scene.add(sun);
 const surface=document.createElement('canvas');surface.width=surface.height=128;const ctx=surface.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=82741;for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;const v=185+(seed>>>26);pixels.data.set([v,v,v,255],i);}ctx.putImageData(pixels,0,0);this.groundTexture=new T.CanvasTexture(surface);this.groundTexture.wrapS=this.groundTexture.wrapT=T.RepeatWrapping;this.groundTexture.repeat.set(1,1);this.material=new T.MeshLambertMaterial({vertexColors:true,map:this.groundTexture});this.archMaterial=new T.MeshLambertMaterial({vertexColors:true});this.shared=[];this.props=new T.Group();this.scene.add(this.props);
 this.box=new T.BoxGeometry(1,1,1);this.shared.push(this.box);this.cone=new T.ConeGeometry(1,1,7);this.sphere=new T.IcosahedronGeometry(1,1);this.rock=new T.IcosahedronGeometry(1,0);this.cylinder=new T.CylinderGeometry(1,1,1,10);this.shared.push(this.cone,this.sphere,this.rock,this.cylinder);this.materials={};
 this.vehicle=new T.Group();this.scene.add(this.vehicle);this.loadoutKey='';this.syncLoadout();
 this.origin={x:0,z:0};this.makeLandmarks();this.batchLandmarks();this.bind();this.resize();
 }
 syncLoadout(){
 const L=myLoadout(),key=JSON.stringify([L,typeof Equipment3D!=='undefined'?Equipment3D.generation:0]);this.speed=W.travelSpeed(L);this.loadout=L;
 if(key===this.loadoutKey)return;this.loadoutKey=key;
 this.motion?.dispose();if(typeof Equipment3D!=='undefined')Equipment3D.releaseTree(this.vehicle);
 this.vehicle.traverse(o=>{if(o.geometry&&!o.geometry.userData.hfShared)o.geometry.dispose();});this.vehicle.clear();
 const T=this.T,P=PAINTS[L.paint]||PAINTS.stock,team='#88cbdc';
 if(!this.modelMats)this.modelMats={lit:new T.MeshPhongMaterial({vertexColors:true,shininess:45}),shine:new T.MeshPhongMaterial({vertexColors:true,shininess:65}),glow:new T.MeshBasicMaterial({vertexColors:true})};
 const body=new T.Group();body.rotation.y=-Math.PI/2;this.vehicle.add(body);
 const add=(raw,parent)=>{parent.add(M3.meshOf(M3.bake(raw.k),null,this.modelMats));for(const a of raw.anims||[]){const m=M3.meshOf(M3.bake(a.k),null,this.modelMats);m.position.set(...a.p);parent.add(m);}};
 const H=M3.chassisKit(L.c.c,L.c.t,P,team,L.cores,L.skin==='lunar');const hullB=M3.bake(H.k);body.add(M3.meshOf(hullB,null,this.modelMats));for(const a of H.anims||[]){const m=M3.meshOf(M3.bake(a.k),null,this.modelMats);m.position.set(...a.p);body.add(m);}
 const gun=new T.Group();gun.position.y=H.meta.ty;body.add(gun);gun.scale.setScalar(M3.weaponScale(L.w.a,L.c.c));add(M3.weaponKit(L.w.a,L.w.t,P,team,L.skin==='lunar',L.c.c),gun);
 const fits=fittingVisuals(L),context={cls:L.c.c,ct:L.c.t,arch:L.w.a,wt:L.w.t,lunar:L.skin==='lunar'};add(M3.fittingKit(fits,team,'body',context),body);add(M3.fittingKit(fits,team,'mount',context),gun);
 if(L.vl>0&&typeof vaultParts==='function')vaultParts({body},{b:hullB},{vl:L.vl,vt:typeof vtOf==='function'?vtOf(L.vl):L.vl>=10?2:1},this.modelMats);
 this.vehicle.scale.setScalar(1.65);
 if(typeof GraphicsMotion!=='undefined')this.motion=GraphicsMotion.attach(this.vehicle,H.meta.track||[(2.61-.48)/2,.24,.25,0],{includeOwned:true});
 }
 mat(color){return this.materials[color]||(this.materials[color]=new this.T.MeshLambertMaterial({color}));}
 cube(group,x,y,z,w,h,d,color){const m=new this.T.Mesh(this.box,this.mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;}
 makeLandmarks(){
 // Bridge strip geometry shares the navigation provider, including sloping ramps.
 const T=this.T,a=[],ix=[];for(let x=900;x<=1140;x+=4){for(const z of [1015,1033])a.push(x,W.deckAt(x,z),z);if(x<1140){const i=(x-900)/4*2;ix.push(i,i+1,i+2,i+2,i+1,i+3);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));g.setIndex(ix);g.computeVertexNormals();this.shared.push(g);const deck=new T.Mesh(g,this.mat(0x667d8a));this.props.add(deck);
 // Opaque deck thickness and supports; upper and lower routes remain visibly separate.
 this.cube(this.props,1020,23.35,1024,120,1.2,18,0x445361);
 for(const x of [970,1070])for(const z of [1018,1030]){const y=W.groundAt(x,z);this.cube(this.props,x,(y+23)/2,z,3,23-y,3,0x697780);}
 for(let x=904;x<1140;x+=8)for(const z of [1015,1033])this.cube(this.props,x,W.deckAt(x,z)+.6,z,2,1.2,.6,0xd1b36e);
 // Continuous deck-edge rails and exposed truss depth follow the same ramp provider.
 for(let x=900;x<1140;x+=4)for(const z of [1015,1033]){const a=W.deckAt(x,z),b=W.deckAt(x+4,z),rail=this.cube(this.props,x+2,(a+b)/2+1.4,z,Math.hypot(4,b-a),.3,.35,0xd1b36e);rail.rotation.z=Math.atan2(b-a,4);}
 // Monumental oxygen processors, grounded on individual footings, with pressure collars and pipework.
 for(let i=0;i<3;i++){const x=1150+i*30,z=1080,y=W.groundAt(x,z),h=90+i%2*38;
 this.form(this.props,this.cylinder,x,y+h/2,z,9,h,9,0x657e88);
 this.form(this.props,this.cone,x,y+h+8,z,12,16,12,0xb3c9d0);
 for(let k=1;k<5;k++){this.form(this.props,this.cylinder,x,y+h*k/5,z,10.5,1.6,10.5,k===4?0x8ee5e9:0xb0b8b9);}
 for(const dx of [-13,13]){this.cube(this.props,x+dx,y+h*.25,z,2,h*.5,3,0x404e5a);this.cube(this.props,x+dx/2,y+8,z,14,2,3,0xa7b7b9);}
 this.cube(this.props,x+15,y+4,z+15,32,3,3,0x7c919c);
 }
 // Habitats follow the ground; repeated ribs, glazing, solar fields and antennae establish a refuge.
 for(let i=0;i<9;i++){const x=1110+i%3*22,z=1148+Math.floor(i/3)*25,y=W.groundAt(x,z);
 this.form(this.props,this.cylinder,x,y+3,z,7,6,7,0x8b9da5);
 this.form(this.props,this.sphere,x,y+6,z,7.5,3.5,7.5,0xc1cbd0);
 this.cube(this.props,x,y+3,z-7,8,1,.3,0x75d8ea);this.cube(this.props,x+9,y+.15,z,3,.3,17,0xb9a47c);
 this.cube(this.props,x+9,y+8,z+5,.25,16,.25,0x96bac4);this.cube(this.props,x+9,y+15,z+5,4,.2,.3,0xf3c780);
 }
 for(let i=0;i<5;i++){const x=1098+i*22,z=1225,y=W.groundAt(x,z);const panel=this.cube(this.props,x,y+2,z,14,.3,9,0x233e59);panel.rotation.x=.3;}
 }
 batchLandmarks(){
 // Merge static architecture into one colored draw instead of one call per collar, window and support.
 const positions=[],normals=[],colors=[],indices=[],v=new this.T.Vector3(),n=new this.T.Vector3();this.props.updateMatrixWorld(true);
 this.props.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld),a=g.attributes.position,b=g.attributes.normal,offset=positions.length/3,color=o.material.color;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i);n.fromBufferAttribute(b,i);positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);colors.push(color.r,color.g,color.b);}indices.push(...(g.index?Array.from(g.index.array):Array.from({length:a.count},(_,i)=>i)).map(i=>i+offset));g.dispose();});
 const g=new this.T.BufferGeometry();for(const [name,a] of [['position',positions],['normal',normals],['color',colors]])g.setAttribute(name,new this.T.Float32BufferAttribute(a,3));g.setIndex(indices);this.shared.push(g);this.props.clear();this.props.add(new this.T.Mesh(g,this.archMaterial));
 }
 form(group,geo,x,y,z,w,h,d,color){const m=new this.T.Mesh(geo,this.mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;}
 bind(){this.abort=new AbortController();const on=(el,t,f)=>el.addEventListener(t,f,{signal:this.abort.signal});
 on(window,'resize',()=>this.resize());on(window,'keydown',e=>{if(!/INPUT|TEXTAREA/.test(e.target.tagName)){this.keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();}});on(window,'keyup',e=>delete this.keys[e.code]);on(window,'blur',()=>this.reset());on(document,'visibilitychange',()=>{this.reset();this.discovery?.flush();});on(window,'pagehide',()=>this.discovery?.flush());
 const c=this.renderer.domElement;let drag=null;
 on(c,'pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};c.setPointerCapture(e.pointerId);});on(c,'pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;this.yaw-=(e.clientX-drag.x)*.008;this.pitch=Math.max(.08,Math.min(1.25,this.pitch+(e.clientY-drag.y)*.006));drag.x=e.clientX;drag.y=e.clientY;});on(c,'pointerup',()=>drag=null);on(c,'pointercancel',()=>drag=null);on(c,'wheel',e=>{e.preventDefault();this.zoom(e.deltaY*.03);});
 }
 reset(){this.resume=true;this.keys={};this.stick={x:0,z:0};}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.detailRadius=w<=600?1:2;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 zoom(v){this.distance=Math.max(16,Math.min(110,this.distance+v));}
 jump(x,z){x=Math.max(1,Math.min(W.WIDTH-1,Number(x)));z=Math.max(1,Math.min(W.LENGTH-1,Number(z)));if(!Number.isFinite(x)||!Number.isFinite(z))return false;this.p={x,z,y:W.groundAt(x,z),surface:'ground'};this.pending=Infinity;this.reset();return true;}
 stream(){const cell=Math.floor(this.p.x/128)+':'+Math.floor(this.p.z/128);
 if(cell!==this.horizonKey){this.horizonKey=cell;if(this.horizon){this.scene.remove(this.horizon);this.horizon.geometry.dispose();}const d=W.horizon(this.p.x,this.p.z),g=new this.T.BufferGeometry();for(const [name,values] of [['position',d.positions],['normal',d.normals],['color',d.colors]])g.setAttribute(name,new this.T.Float32BufferAttribute(values,3));g.setAttribute('uv',new this.T.Float32BufferAttribute(d.positions.flatMap((_,i)=>i%3===0?[d.positions[i]/24,d.positions[i+2]/24]:[]),2));g.setIndex(d.indices);this.horizon=new this.T.Mesh(g,this.material);this.scene.add(this.horizon);}
 const selectionKey=cell+':'+this.detailRadius;if(selectionKey===this.selectionKey&&this.pending===0)return;if(selectionKey!==this.selectionKey){this.selectionKey=selectionKey;this.wanted=W.chunkKeys(this.p.x,this.p.z,4,this.detailRadius);this.wanted.sort((a,b)=>Math.hypot(a.cx*128-this.p.x,a.cz*128-this.p.z)-Math.hypot(b.cx*128-this.p.x,b.cz*128-this.p.z));}
 const wanted=this.wanted;const keep=new Map(wanted.map(k=>[k.key,k]));for(const [key,o] of this.chunks){if(!keep.has(key)||keep.get(key).step!==o.step){this.scene.remove(o.group);o.group.traverse(m=>{if(m.geometry&&!this.shared.includes(m.geometry))m.geometry.dispose();if(m.isInstancedMesh)m.dispose();});this.chunks.delete(key);}}
 // Build nearest first, at most two per frame; no persistent CPU mesh cache.
 let budget=2;
 for(const k of wanted){if(this.chunks.has(k.key)||!budget)continue;budget--;const d=W.chunk(k.cx,k.cz,k.step),T=this.T,g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(d.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(d.normals,3));g.setAttribute('color',new T.Float32BufferAttribute(d.colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(d.positions.flatMap((_,i)=>i%3===0?[(d.positions[i]+k.cx*128)/24,(d.positions[i+2]+k.cz*128)/24]:[]),2));g.setIndex(d.indices);
 const group=new T.Group();group.add(new T.Mesh(g,this.material));
 // Skirts hide coarse/fine edge cracks without changing the canonical surface.
 const verts=[],idx=[];for(let side=0;side<4;side++)for(let t=0;t<=128;t+=k.step){let x=side===0?0:side===1?128:t,z=side===2?0:side===3?128:t,y=W.heightAt(k.cx*128+x,k.cz*128+z),n=verts.length/3;verts.push(x,y,z,x,y-14,z);if(t<128)idx.push(n,n+1,n+2,n+2,n+1,n+3);}
 const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(verts,3));skirt.setIndex(idx);skirt.computeVertexNormals();group.add(new T.Mesh(skirt,this.mat(0x68665f)));
 // Trees have separate trunks and varied layered crowns; all repetition is instanced and distance culled.
 if(k.step===4){const list=W.scenery(k.cx,k.cz),trees=list.filter(p=>p.kind==='tree'),pines=trees.filter(p=>p.variant>=.4),broad=trees.filter(p=>p.variant<.4),relays=list.filter(p=>p.kind==='relay'),rocks=list.filter(p=>p.kind==='rock'&&p.variant>.45);
 const batch=(items,geo,color,shape)=>{if(!items.length)return;const mesh=new T.InstancedMesh(geo,this.mat(color),items.length),o=new T.Object3D();items.forEach((p,i)=>{shape(o,p);o.position.x+=p.x-k.cx*128;o.position.z+=p.z-k.cz*128;o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});group.add(mesh);};
 batch(trees,this.cylinder,0x625345,(o,p)=>{o.position.set(0,p.y+p.size*1.6,0);o.scale.set(.22*p.size,3.2*p.size,.22*p.size);});
 for(let level=0;level<2;level++)batch(pines,this.cone,level?0x4e7964:0x304f45,(o,p)=>{o.position.set(0,p.y+p.size*(3.1+level*1.4),0);o.scale.set(p.size*(1.6-level*.4),p.size*3,p.size*(1.6-level*.4));});
 batch(broad,this.sphere,0x577761,(o,p)=>{o.position.set(0,p.y+p.size*3.8,0);o.scale.set(p.size*1.9,p.size*1.5,p.size*1.9);});
 batch(relays,this.cylinder,0x4b5664,(o,p)=>{o.position.set(0,p.y+6,0);o.scale.set(.35,12,.35);});batch(relays,this.sphere,0x9f947e,(o,p)=>{o.position.set(0,p.y+12,0);o.scale.set(3,.3,2);o.rotation.z=.6;});
 batch(rocks,this.rock,0x727781,(o,p)=>{o.position.set(0,p.y+p.size*.3,0);o.scale.set(p.size*1.6,p.size*(.5+p.variant),p.size);o.rotation.set(p.variant,0,p.variant*.4);});
 }
 this.scene.add(group);this.chunks.set(k.key,{group,step:k.step,cx:k.cx,cz:k.cz});this.builds++;}
 this.pending=wanted.length-this.chunks.size;
 }
 tick(dt){if(this.disposed||document.hidden)return;if(this.resume){dt=0;this.resume=false;}dt=Math.min(.25,Math.max(0,dt));this.loadoutElapsed=(this.loadoutElapsed||0)+dt;if(this.loadoutElapsed>=.5){this.syncLoadout();this.loadoutElapsed=0;}this.elapsed+=dt;this.frames++;if(this.elapsed>.5){this.fps=this.frames/this.elapsed;this.elapsed=0;this.frames=0;}
 let sx=this.stick.x+(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0),sz=this.stick.z+(this.keys.KeyW||this.keys.ArrowUp?1:0)-(this.keys.KeyS||this.keys.ArrowDown?1:0),n=Math.max(1,Math.hypot(sx,sz));sx/=n;sz/=n;
 const dx=(Math.cos(this.yaw)*sx-Math.sin(this.yaw)*sz)*this.speed*dt,dz=(-Math.sin(this.yaw)*sx-Math.cos(this.yaw)*sz)*this.speed*dt;
 const old=this.p;this.p=W.advance(this.p,dx,dz);this.blocked=(sx||sz)&&old===this.p;
 const mx=this.p.x-old.x,mz=this.p.z-old.z,moved=Math.hypot(mx,mz);
 if(moved)this.heading=Math.atan2(mx,mz);
 if(this.motion){const h=this.heading||0,pathScale=moved?Math.hypot(mx,this.p.y-old.y,mz)/moved:1;this.motion.step(dt,{dx:mx*pathScale/1.65,dz:mz*pathScale/1.65,heading:Math.PI/2-h,trackHalfWidth:M3.CHASSIS_VISUALS[this.loadout.c.c][M3.visualTier(this.loadout.c.t)].trackZ},false);}
 this.discovery?.accept(old,this.p,dt,this.speed);
 const up=new this.T.Vector3(...W.normalAt(this.p.x,this.p.z));if(this.p.surface==='bridge'){const a=W.deckAt(this.p.x-.1,this.p.z),b=W.deckAt(this.p.x+.1,this.p.z);up.set(a!==null&&b!==null?-(b-a)/.2:0,1,0).normalize();}const forward=new this.T.Vector3(Math.sin(this.heading||0),0,Math.cos(this.heading||0));forward.addScaledVector(up,-forward.dot(up)).normalize();const right=new this.T.Vector3().crossVectors(up,forward).normalize();this.vehicle.quaternion.setFromRotationMatrix(new this.T.Matrix4().makeBasis(right,up,forward));
 this.stream();this.origin.x=Math.floor(this.p.x/128)*128;this.origin.z=Math.floor(this.p.z/128)*128;const ox=this.origin.x,oz=this.origin.z;
 for(const c of this.chunks.values())c.group.position.set(c.cx*128-ox,0,c.cz*128-oz);this.props.position.set(-ox,0,-oz);this.horizon.position.set(-ox,0,-oz);this.vehicle.position.set(this.p.x-ox,this.p.y,this.p.z-oz);
 const tx=this.p.x-ox,tz=this.p.z-oz,d=this.distance,cy=this.p.y+3;let cx=this.p.x+Math.sin(this.yaw)*Math.cos(this.pitch)*d,cz=this.p.z+Math.cos(this.yaw)*Math.cos(this.pitch)*d,hy=cy+Math.sin(this.pitch)*d;
 // Sample the sight ray to lift the camera above intervening terrain and opaque bridge surfaces.
 for(let i=1;i<=16;i++){const t=i/16,x=this.p.x+(cx-this.p.x)*t,z=this.p.z+(cz-this.p.z)*t;const ground=W.groundAt(x,z)+3;hy=Math.max(hy,cy+(ground-cy)/t);const deck=W.deckAt(x,z);if(deck!==null&&this.p.surface==='bridge')hy=Math.max(hy,cy+(deck+3-cy)/t);}
 this.camera.position.set(cx-ox,hy,cz-oz);this.camera.lookAt(tx,cy,tz);this.renderer.render(this.scene,this.camera);
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.discovery?.flush();this.abort.abort();try{localStorage.setItem('lunar-conquest-position-v1',JSON.stringify({x:this.p.x,z:this.p.z,surface:this.p.surface}));}catch(_){}for(const c of this.chunks.values())c.group.traverse(m=>{if(m.geometry&&!this.shared.includes(m.geometry))m.geometry.dispose();if(m.isInstancedMesh)m.dispose();});this.chunks.clear();this.horizon?.geometry.dispose();this.motion?.dispose();if(typeof Equipment3D!=='undefined')Equipment3D.releaseTree(this.vehicle);this.vehicle.traverse(o=>{if(o.geometry&&!o.geometry.userData.hfShared)o.geometry.dispose();});Object.values(this.modelMats||{}).forEach(m=>m.dispose());this.shared.forEach(g=>g.dispose());this.material.dispose();this.archMaterial.dispose();this.groundTexture.dispose();Object.values(this.materials).forEach(m=>m.dispose());this.hfRelease?.();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
root.ConquestView=View;
})(globalThis);
