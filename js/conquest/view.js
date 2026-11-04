/* A single disposable renderer. The app's existing frame loop owns its updates. */
(function(root){
'use strict';
const W=root.ConquestWorld;
class View {
 constructor(host,onError){
 const T=root.THREE;this.T=T;this.host=host;this.onError=onError;this.chunks=new Map();this.keys={};this.stick={x:0,z:0};this.yaw=-Math.PI/2;this.pitch=.42;this.distance=62;this.frames=0;this.fps=0;this.elapsed=0;this.builds=0;this.disposed=false;
 this.p={x:898,z:1024,y:W.groundAt(898,1024),surface:'ground'};
 try{const p=JSON.parse(localStorage.getItem('lunar-conquest-position-v1'));if(p&&Number.isFinite(p.x)&&Number.isFinite(p.z)){this.jump(p.x,p.z);if(p.surface==='bridge'){const deck=W.deckAt(this.p.x,this.p.z);if(deck!==null){this.p.surface='bridge';this.p.y=deck;}}}}catch(_){}
 this.renderer=new T.WebGLRenderer({antialias:false,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));host.append(this.renderer.domElement);
 this.scene=new T.Scene();this.scene.background=new T.Color(0x101b29);this.scene.fog=new T.Fog(0x101b29,220,530);
 this.camera=new T.PerspectiveCamera(55,1,.2,700);this.scene.add(new T.HemisphereLight(0xc4ddff,0x353025,2));const sun=new T.DirectionalLight(0xffe5ba,2.3);sun.position.set(-100,180,-70);this.scene.add(sun);
 this.material=new T.MeshLambertMaterial({vertexColors:true});this.shared=[];this.props=new T.Group();this.scene.add(this.props);
 this.box=new T.BoxGeometry(1,1,1);this.shared.push(this.box);this.materials={};
 this.vehicle=new T.Group();this.scene.add(this.vehicle);this.cube(this.vehicle,0,1,0,3,1.6,4,0xc4ad74);this.cube(this.vehicle,-1.8,.7,0,.8,1.3,4.6,0x20272b);this.cube(this.vehicle,1.8,.7,0,.8,1.3,4.6,0x20272b);this.cube(this.vehicle,0,2.2,0,1.8,.9,2,0x81c9ee);
 this.origin={x:0,z:0};this.makeLandmarks();this.bind();this.resize();
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
 for(let i=0;i<4;i++){const x=1150+i*8,z=1080,y=W.groundAt(x,z);this.cube(this.props,x,y+10,z,5,20,5,0x7eabb9);this.cube(this.props,x,y+21,z,6,2,6,0xa8dbe3);}
 for(let i=0;i<6;i++){const x=1120+i%3*13,z=1150+Math.floor(i/3)*16,y=W.groundAt(x,z);this.cube(this.props,x,y+3,z,9,6,10,0x7b8f9b);this.cube(this.props,x,y+4,z-5.1,5,1,0.2,0x55b9ec);}
 }
 bind(){this.abort=new AbortController();const on=(el,t,f)=>el.addEventListener(t,f,{signal:this.abort.signal});
 on(window,'resize',()=>this.resize());on(window,'keydown',e=>{if(!/INPUT|TEXTAREA/.test(e.target.tagName)){this.keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();}});on(window,'keyup',e=>delete this.keys[e.code]);on(window,'blur',()=>this.reset());on(document,'visibilitychange',()=>this.reset());
 const c=this.renderer.domElement;let drag=null;
 on(c,'pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};c.setPointerCapture(e.pointerId);});on(c,'pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;this.yaw-=(e.clientX-drag.x)*.008;this.pitch=Math.max(.22,Math.min(1.25,this.pitch+(e.clientY-drag.y)*.006));drag.x=e.clientX;drag.y=e.clientY;});on(c,'pointerup',()=>drag=null);on(c,'pointercancel',()=>drag=null);on(c,'wheel',e=>{e.preventDefault();this.zoom(e.deltaY*.03);});
 }
 reset(){this.keys={};this.stick={x:0,z:0};}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 zoom(v){this.distance=Math.max(16,Math.min(110,this.distance+v));}
 jump(x,z){x=Math.max(1,Math.min(W.WIDTH-1,Number(x)));z=Math.max(1,Math.min(W.LENGTH-1,Number(z)));if(!Number.isFinite(x)||!Number.isFinite(z))return false;this.p={x,z,y:W.groundAt(x,z),surface:'ground'};this.reset();return true;}
 stream(){const wanted=W.chunkKeys(this.p.x,this.p.z);const keep=new Map(wanted.map(k=>[k.key,k]));for(const [key,o] of this.chunks){if(!keep.has(key)||keep.get(key).step!==o.step){this.scene.remove(o.group);o.group.traverse(m=>{if(m.geometry&&m.geometry!==this.box)m.geometry.dispose();if(m.isInstancedMesh)m.dispose();});this.chunks.delete(key);}}
 // Build nearest first, at most two per frame; no persistent CPU mesh cache.
 let budget=2;wanted.sort((a,b)=>Math.hypot(a.cx*128-this.p.x,a.cz*128-this.p.z)-Math.hypot(b.cx*128-this.p.x,b.cz*128-this.p.z));
 for(const k of wanted){if(this.chunks.has(k.key)||!budget)continue;budget--;const d=W.chunk(k.cx,k.cz,k.step),T=this.T,g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(d.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(d.normals,3));g.setAttribute('color',new T.Float32BufferAttribute(d.colors,3));g.setIndex(d.indices);
 const group=new T.Group();group.add(new T.Mesh(g,this.material));
 // Skirts hide coarse/fine edge cracks without changing the canonical surface.
 const verts=[],idx=[];for(let side=0;side<4;side++)for(let t=0;t<=128;t+=k.step){let x=side===0?0:side===1?128:t,z=side===2?0:side===3?128:t,y=W.heightAt(k.cx*128+x,k.cz*128+z),n=verts.length/3;verts.push(x,y,z,x,y-14,z);if(t<128)idx.push(n,n+1,n+2,n+2,n+1,n+3);}
 const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(verts,3));skirt.setIndex(idx);skirt.computeVertexNormals();group.add(new T.Mesh(skirt,this.mat(0x68665f)));
 // Repeated vegetation/rocks use one instanced draw per chunk, shared geometry.
 const transforms=[];for(let i=0;i<16;i++){const x=k.cx*128+8+(i%4)*30,z=k.cz*128+8+Math.floor(i/4)*30;if(W.biomeAt(x,z)==='terraformed'&&Math.abs(x-1024)>120)transforms.push([x-k.cx*128,W.groundAt(x,z)+3,z-k.cz*128]);}
 if(transforms.length){const m=new T.InstancedMesh(this.box,this.mat(0x355a43),transforms.length),o=new T.Object3D();transforms.forEach((p,i)=>{o.position.set(...p);o.scale.set(3,6,3);o.updateMatrix();m.setMatrixAt(i,o.matrix);});group.add(m);}
 this.scene.add(group);this.chunks.set(k.key,{group,step:k.step,cx:k.cx,cz:k.cz});this.builds++;}
 this.pending=wanted.length-this.chunks.size;
 }
 tick(dt){if(this.disposed||document.hidden)return;this.elapsed+=dt;this.frames++;if(this.elapsed>.5){this.fps=this.frames/this.elapsed;this.elapsed=0;this.frames=0;}
 let sx=this.stick.x+(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0),sz=this.stick.z+(this.keys.KeyW||this.keys.ArrowUp?1:0)-(this.keys.KeyS||this.keys.ArrowDown?1:0),n=Math.max(1,Math.hypot(sx,sz));sx/=n;sz/=n;
 const dx=(Math.cos(this.yaw)*sx-Math.sin(this.yaw)*sz)*W.SPEED*dt,dz=(-Math.sin(this.yaw)*sx-Math.cos(this.yaw)*sz)*W.SPEED*dt;
 const old=this.p;this.p=W.move(this.p,dx,dz);this.blocked=(sx||sz)&&old===this.p;if(dx||dz)this.vehicle.rotation.y=Math.atan2(dx,dz);
 this.stream();this.origin.x=Math.floor(this.p.x/128)*128;this.origin.z=Math.floor(this.p.z/128)*128;const ox=this.origin.x,oz=this.origin.z;
 for(const c of this.chunks.values())c.group.position.set(c.cx*128-ox,0,c.cz*128-oz);this.props.position.set(-ox,0,-oz);this.vehicle.position.set(this.p.x-ox,this.p.y,this.p.z-oz);
 const tx=this.p.x-ox,tz=this.p.z-oz,d=this.distance,cy=this.p.y+3;let cx=this.p.x+Math.sin(this.yaw)*Math.cos(this.pitch)*d,cz=this.p.z+Math.cos(this.yaw)*Math.cos(this.pitch)*d,hy=cy+Math.sin(this.pitch)*d;
 // Sample the sight ray to lift the camera above intervening terrain and opaque bridge surfaces.
 for(let i=1;i<=16;i++){const t=i/16,x=this.p.x+(cx-this.p.x)*t,z=this.p.z+(cz-this.p.z)*t;const ground=W.groundAt(x,z)+3;hy=Math.max(hy,cy+(ground-cy)/t);const deck=W.deckAt(x,z);if(deck!==null&&this.p.surface==='bridge')hy=Math.max(hy,cy+(deck+3-cy)/t);}
 this.camera.position.set(cx-ox,hy,cz-oz);this.camera.lookAt(tx,cy,tz);this.renderer.render(this.scene,this.camera);
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.abort.abort();try{localStorage.setItem('lunar-conquest-position-v1',JSON.stringify({x:this.p.x,z:this.p.z,surface:this.p.surface}));}catch(_){}for(const c of this.chunks.values())c.group.traverse(m=>{if(m.geometry&&m.geometry!==this.box)m.geometry.dispose();if(m.isInstancedMesh)m.dispose();});this.chunks.clear();this.shared.forEach(g=>g.dispose());this.material.dispose();Object.values(this.materials).forEach(m=>m.dispose());this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
root.ConquestView=View;
})(globalThis);
