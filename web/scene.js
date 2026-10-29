'use strict';
// One bounded showroom renderer. Reuses exactly the game's procedural parts; no physics, gear grants or economy.
window.LunarShowroom=class {
 constructor(container){
  this.el=container;this.yaw=-.65;this.tilt=.32;this.zoom=1;this.raf=0;this.last=0;this.visible=true;this.key='';this.model=null;this.drag=null;this.auto=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.resize=new ResizeObserver(()=>this.size());this.resize.observe(container);
  try{
   if(typeof THREE==='undefined')throw Error('3D unavailable');
   this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',stencil:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0,0);container.append(this.renderer.domElement);
   this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(29,1,.1,80);
   this.hemi=new THREE.HemisphereLight(0xc9e2ec,0x152131,2.1);this.scene.add(this.hemi);this.lights=[];
   for(const [c,i,p] of [[0xe7f1f1,3.0,[3,7,5]],[0xff9559,1.25,[-6,3,-2]],[0x70cce9,2.3,[0,4,-6]]]){const l=new THREE.DirectionalLight(c,i);l.position.set(...p);this.scene.add(l);this.lights.push(l);}
   this.mats={lit:new THREE.MeshPhongMaterial({vertexColors:true,shininess:65,specular:0x7e9dab}),shine:new THREE.MeshPhongMaterial({vertexColors:true,shininess:100,specular:0xc2d9e4}),glow:new THREE.MeshBasicMaterial({vertexColors:true})};
   const disc=new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.5,.13,64),new THREE.MeshPhongMaterial({color:0x182731,shininess:55,specular:0x3e6278}));disc.position.y=-.10;this.scene.add(disc);
   const gridKit=M3.kit();for(let i=-5;i<=5;i+=.5){M3.put(gridKit,M3.shapes.B(10,.004,.008),'#243b49',[0,-.18,i],null,null,'glow');M3.put(gridKit,M3.shapes.B(.008,.004,10),'#243b49',[i,-.18,0],null,null,'glow');}this.scene.add(M3.meshOf(M3.bake(gridKit),null,this.mats));
   for(const [r,c] of [[3.23,0x7396a4],[3.45,0xff8d52],[2.9,0x365b6b]]){const ring=new THREE.Mesh(new THREE.RingGeometry(r,r+.014,80),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.65,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.0;this.scene.add(ring);}
   // One bounded, procedural contact shadow; no shadow maps, downloads or per-frame textures.
   const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=128;
   const shadowCtx=shadowCanvas.getContext('2d'),gradient=shadowCtx.createRadialGradient(64,64,12,64,64,64);gradient.addColorStop(0,'#000000d0');gradient.addColorStop(1,'#00000000');shadowCtx.fillStyle=gradient;shadowCtx.fillRect(0,0,128,128);
   this.contactTexture=new THREE.CanvasTexture(shadowCanvas);this.contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(5.3,4.2),new THREE.MeshBasicMaterial({map:this.contactTexture,transparent:true,depthWrite:false}));this.contactShadow.rotation.x=-Math.PI/2;this.contactShadow.position.y=-.025;this.contactShadow.visible=false;this.scene.add(this.contactShadow);
   this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.fallback();});
  }catch{this.fallback();}
  container.addEventListener('pointerdown',e=>{if(e.button>0)return;this.drag={x:e.clientX,y:e.clientY,id:e.pointerId};this.auto=false;container.setPointerCapture(e.pointerId);});
  container.addEventListener('pointermove',e=>{if(!this.drag)return;this.yaw+=(e.clientX-this.drag.x)*.009;this.tilt=Math.max(.05,Math.min(.7,this.tilt+(e.clientY-this.drag.y)*.004));this.drag.x=e.clientX;this.drag.y=e.clientY;this.draw();});
  const end=()=>this.drag=null;container.addEventListener('pointerup',end);container.addEventListener('pointercancel',end);
  container.addEventListener('wheel',e=>{if(!e.ctrlKey&&Math.abs(e.deltaY)<80){e.preventDefault();this.setZoom(this.zoom-e.deltaY*.002);}},{passive:false});
  this.observer=new IntersectionObserver(es=>{this.visible=es[0].isIntersecting;this.run();});this.observer.observe(container);
  this.onVisibility=()=>this.run();document.addEventListener('visibilitychange',this.onVisibility);this.run();
 }
 size(){if(!this.renderer)return;const w=this.el.clientWidth,h=this.el.clientHeight;if(w&&h){this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.draw();}}
 kit(raw,parent){parent.add(M3.meshOf(M3.bake(raw.k),null,this.mats));for(const a of raw.anims||[]){const m=M3.meshOf(M3.bake(a.k),null,this.mats);m.position.set(...a.p);parent.add(m);}}
 setLoadout(L){
  const next=JSON.stringify([L.w,L.c,L.cores,L.paint,L.skin,L.mods,L.looks]);if(this.key===next)return;this.key=next;this.L=L;
  if(!this.renderer){this.fallback();return;}
  if(this.model){this.scene.remove(this.model);this.disposeGeometry(this.model);}
  // Keep the existing legendary/other-item rig exactly as before. Only the stock flagship
  // gets lower diffuse fill, restrained specular highlights and a grounded contact patch.
  this.defender=L.c.c==='vanguard'&&L.c.t===0&&L.skin!=='lunar'&&L.w.a!=='moon';
  this.hemi.intensity=this.defender ? .85 : 2.1;this.lights.forEach((l,i)=>l.intensity=(this.defender?[2.5,.65,2.0]:[3,1.25,2.3])[i]);
  this.mats.shine.shininess=this.defender?48:100;this.mats.shine.specular.setHex(this.defender?0x253746:0xc2d9e4);
  this.contactShadow.visible=this.defender;
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);const team='#88cbdc',P=PAINTS[L.paint]||PAINTS.stock;
  const H=M3.chassisKit(L.c.c,L.c.t,P,team,L.cores,L.skin==='lunar');this.kit(H,body);
  const turret=new THREE.Group();turret.position.y=H.meta.ty;body.add(turret);this.kit(M3.weaponKit(L.w.a,L.w.t,P,team,L.skin==='lunar',L.c.c),turret);
  const fits=fittingVisuals(L);body.add(M3.meshOf(M3.bake(M3.fittingKit(fits,team,'body').k),null,this.mats));turret.add(M3.meshOf(M3.bake(M3.fittingKit(fits,team,'mount').k),null,this.mats));
  root.scale.setScalar(L.w.a==='moon'?1.35:1.65);this.model=root;this.scene.add(root);
  this.bounds=null;
  if(this.defender){
   // Compute once per loadout; eight projected corners handle rotation/aspect at draw time.
   const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],v=new THREE.Vector3();root.updateMatrixWorld(true);
   root.traverse(o=>{const a=o.geometry?.attributes.position;if(!a)return;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);for(let j=0;j<3;j++){const n=[v.x,v.y,v.z][j];lo[j]=Math.min(lo[j],n);hi[j]=Math.max(hi[j],n);}}});
   this.bounds=[];for(const x of [lo[0],hi[0]])for(const y of [lo[1],hi[1]])for(const z of [lo[2],hi[2]])this.bounds.push([x,y,z]);this.center=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2];
  }
  root.rotation.y=this.yaw;this.size();
 }
 draw(){if(!this.renderer||!this.camera||!this.model)return;this.model.rotation.y=this.yaw;const narrow=Math.min(1,Math.max(.65,this.camera.aspect));const d=11.2/this.zoom/narrow;this.camera.position.set(5.5/this.zoom,3.5+this.tilt*5,d);this.camera.lookAt(0,.65,0);
  if(this.bounds){
   const co=Math.cos(this.yaw),si=Math.sin(this.yaw),c=this.center,focus=new THREE.Vector3(c[0]*co+c[2]*si,c[1],-c[0]*si+c[2]*co);
   this.camera.position.add(focus);this.camera.lookAt(focus);this.camera.updateMatrixWorld(true);
   const v=new THREE.Vector3();let fit=1;
   for(const b of this.bounds){v.set(b[0]*co+b[2]*si,b[1],-b[0]*si+b[2]*co).project(this.camera);fit=Math.max(fit,Math.abs(v.x)/.90,Math.abs(v.y)/.90);}
   if(fit>1)this.camera.position.sub(focus).multiplyScalar(fit).add(focus);
  }
  this.renderer.render(this.scene,this.camera);}
 run(){cancelAnimationFrame(this.raf);this.raf=0;if(document.hidden||!this.visible||this.disposed)return;const frame=t=>{this.raf=0;if(this.disposed||document.hidden||!this.visible)return;if(!document.body.classList.contains('battle')&&t-this.last>45){if(this.auto)this.yaw+=.0018;this.draw();this.last=t;}this.raf=requestAnimationFrame(frame);};this.raf=requestAnimationFrame(frame);}
 rotate(n){this.auto=false;this.yaw+=n*.32;this.draw();}
 setZoom(v){this.zoom=Math.max(.72,Math.min(1.6,v));this.draw();}
 fallback(){const panel=this.el.closest('.web-stage,.hero-machine');panel?.querySelectorAll('[data-stage-rotate],[data-stage-zoom],[data-rotate],[data-zoom]').forEach(b=>b.disabled=true);const note=panel?.querySelector('.scene-footnote');if(note)note.textContent='2D preview · 3D inspection is unavailable on this device.';if(this.renderer){this.renderer.dispose();this.renderer.domElement.remove();this.renderer=null;}if(this.L&&typeof drawMachinePreview==='function'){
  this.el.innerHTML='';const c=document.createElement('canvas'),w=this.el.clientWidth||320,h=this.el.clientHeight||260;c.width=w;c.height=h;this.el.append(c);drawMachinePreview(c.getContext('2d'),w,h,this.L);return;
 }const C=this.L?.c.c||'vanguard';this.el.innerHTML=`<div class="scene-fallback"><svg viewBox="0 0 600 390" role="img" aria-label="${C} machine, 2D inspection fallback"><defs><linearGradient id="wm-metal" x2=".7" y2="1"><stop stop-color="#8098a8"/><stop offset=".5" stop-color="#304a5d"/><stop offset="1" stop-color="#102333"/></linearGradient></defs><ellipse cx="300" cy="300" rx="235" ry="55" fill="#0c141c" stroke="#465f70"/><g transform="translate(300 190) rotate(-18)"><path d="M-165-35h330v125h-330z" fill="#101922" stroke="#5d849a" stroke-width="4"/><path d="M-135-100h270v55h-270zM-135 65h270v55h-270z" fill="#14212d" stroke="#467386" stroke-width="5"/><path d="M-100-80h140l90 65v85H-100L-140 30v-65z" fill="url(#wm-metal)" stroke="#7797a8" stroke-width="3"/><path d="M-25-40h72l38 50-38 45h-72l-25-45z" fill="#618092" stroke="#b3d8df" stroke-width="3"/><path d="M40-9h170v28H40z" fill="#263f51" stroke="#a2c2d0" stroke-width="3"/><path d="M-110-65h110M-110 50h100" stroke="#ff9459" stroke-width="4"/></g></svg></div>`;}
 disposeGeometry(root){const seen=new Set();root.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}});}
 dispose(){this.disposed=true;cancelAnimationFrame(this.raf);this.resize.disconnect();this.observer.disconnect();document.removeEventListener('visibilitychange',this.onVisibility);if(this.scene){this.disposeGeometry(this.scene);this.scene.traverse(o=>{for(const m of [].concat(o.material||[]))m.dispose();});}this.contactTexture?.dispose();this.renderer?.dispose();}
};
