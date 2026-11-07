/* LUNAR Conquest style lab · option C · "IRON SIEGE · WAR-TORN FRONT" (dev-only Phase 1 sample; never loaded by the game).
 *
 * A tactical war diorama: the Moon as a scarred battlefield. Black sky, a hazy Earth low on the horizon, a low warm sun
 * and a thin ground dust haze; war-churned regolith (shell craters, scorch, tread tracks, rubble — all in the terrain
 * shader, world-space); HESCO-walled armoured habs with floodlights; infested Parasite structures with creep stains;
 * battle-worn player tank; a printed tactical paper map.
 *
 * Fixed material set, created once in prepare()/environment() (no programs after load):
 *   terrain   MeshLambert + onBeforeCompile (craters/scorch/tracks/creep/light pools; LOW = fewer taps)
 *   arch      MeshLambert + onBeforeCompile, per-vertex aFx = (glow, pattern id, grime) — every merged structure,
 *             enemy hull and (instanced) prop shares it: hazard stripes, gabion mesh, sandbags, corrugation, armour
 *             seams, solar cells, Parasite flesh veins and concrete are procedural patterns, not textures.
 *   glow      additive ShaderMaterial billboards/beams (halos, lamp flares, pustules)        decal  MeshBasic RGBA (contact AO)
 *   sky       gradient dome (black → dust band = fog colour) + sun      stars  Points      earth  lit sphere ShaderMaterial
 *   tank      onBeforeCompile on Conquest-only clones of the Equipment3D materials (dust/grime by height, top-face dust)
 * Terrain light pools / creep stains are small fixed uniform arrays the game would fill from the nearest sites.
 */
(function(root){
'use strict';
const LAB=root.ConquestStyleLab;if(!LAB)return;
try{if(document.fonts){document.fonts.load('700 12px "Chakra Petch"');document.fonts.load('600 11px "Chakra Petch"');}}catch(_){}
const T=root.THREE,W=root.ConquestWorld,C=root.ConquestCombat,TAU=Math.PI*2;
const S={};                       // shared state (built once per page)
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const lin=hex=>new T.Color(hex);  // sRGB hex → linear working colour
const P={};for(const [k,v] of Object.entries({
 olive:'#5a5e3e',oliveD:'#3f432f',oliveL:'#737752',khaki:'#8e8160',khakiD:'#6c6148',sand:'#a09070',concrete:'#7b7973',concreteD:'#5e5d59',
 steel:'#50565c',steelD:'#34383c',steelL:'#858b90',rust:'#7d4528',black:'#151413',yellow:'#e0a81c',white:'#d9d5c6',paint:'#cfc7a3',
 cont1:'#535e3c',cont2:'#7e4b2b',cont3:'#5a6772',cont4:'#8a7a50',lampW:'#ffe2b8',lampA:'#ffb054',red:'#ff2c1c',cyan:'#5cf2d8',glass:'#141f2e',
 flesh:'#43222a',fleshD:'#24131a',carapace:'#2e2729',carapaceL:'#4a3c3d',pus:'#ff7224',pusR:'#ff3c1c',bone:'#8a7868',
 char:'#211d1a',ash:'#4d4945',brass:'#b08a40',solar:'#132440',rubber:'#24231f',rock:'#77767a',rockD:'#5d5c60'}))P[k]=lin(v);

// ------------------------------------------------------------------ procedural textures (original, generated here)
function tileNoise(N,period,seed){const R=mulberry(seed),L=new Float32Array(period*period);for(let i=0;i<L.length;i++)L[i]=R();
 const out=new Float32Array(N*N),s=t=>t*t*(3-2*t);
 for(let y=0;y<N;y++){const fy=y/N*period,iy=Math.floor(fy),ty=s(fy-iy),y0=iy%period,y1=(iy+1)%period;
  for(let x=0;x<N;x++){const fx=x/N*period,ix=Math.floor(fx),tx=s(fx-ix),x0=ix%period,x1=(ix+1)%period;
   const a=L[y0*period+x0],b=L[y0*period+x1],c=L[y1*period+x0],d=L[y1*period+x1];out[y*N+x]=a+(b-a)*tx+(c-a)*ty+(a-b-c+d)*tx*ty;}}return out;}
function fbm(N,periods,seed){const out=new Float32Array(N*N);let amp=1;periods.forEach((p,i)=>{const n=tileNoise(N,p,seed+i*101);for(let k=0;k<out.length;k++)out[k]+=n[k]*amp;amp*=.5;});
 let mn=1e9,mx=-1e9;for(const v of out){mn=Math.min(mn,v);mx=Math.max(mx,v);}for(let k=0;k<out.length;k++)out[k]=(out[k]-mn)/(mx-mn);return out;}
function dataTex(data,N,aniso){const t=new T.DataTexture(data,N,N,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=aniso||1;t.needsUpdate=true;return t;}
// R: macro fbm · G: mid fbm · B: ridged (veins / meander) · A: per-pixel speckle
function noiseTexture(N){const r=fbm(N,[4,8,16],11),g=fbm(N,[8,16,32],23),b=fbm(N,[6,12,24],37),R=mulberry(5),d=new Uint8Array(N*N*4);
 for(let i=0;i<N*N;i++){d[i*4]=r[i]*255;d[i*4+1]=g[i]*255;d[i*4+2]=(1-Math.abs(b[i]*2-1))*255;d[i*4+3]=R()*255;}return dataTex(d,N,1);}
// Crater field: R albedo delta · G/B height gradient (x, z) · A scorch. Power-law sizes, rims, rays, blast scorch.
function craterTexture(N,seed,count,rMin,rMax,scorch){const H=new Float32Array(N*N),A=new Float32Array(N*N),Sc=new Float32Array(N*N),R=mulberry(seed),wrap=v=>((v%N)+N)%N;
 for(let k=0;k<count;k++){const r=rMin*Math.pow(rMax/rMin,Math.pow(R(),2.4)),cx=R()*N,cy=R()*N,depth=r*(.2+.12*R()),fresh=R(),rays=R()<.3,ext=Math.ceil(r*2.3),ph=R()*9;
  for(let dy=-ext;dy<=ext;dy++)for(let dx=-ext;dx<=ext;dx++){const d=Math.hypot(dx,dy)/r;if(d>2.3)continue;const idx=wrap(Math.floor(cy)+dy)*N+wrap(Math.floor(cx)+dx);let h=0,a=0;
   if(d<1){h=-depth*(1-d*d);a=-.07-.1*(1-d)*fresh;}
   const rim=Math.exp(-Math.pow((d-1)/.17,2));h+=depth*.45*rim;a+=.12*rim*(.35+.65*fresh);
   if(d>1){const ej=Math.max(0,1-(d-1)/1.3);const ray=rays?.5+.5*Math.pow(Math.abs(Math.sin(Math.atan2(dy,dx)*6+ph)),3):1;a+=.08*ej*ej*fresh*ray;h+=depth*.06*ej;}
   H[idx]+=h;A[idx]+=a;}}
 for(let k=0;k<scorch;k++){const r=N*(.025+.05*R()),cx=R()*N,cy=R()*N,ext=Math.ceil(r*2.8),ph=R()*7;
  for(let dy=-ext;dy<=ext;dy++)for(let dx=-ext;dx<=ext;dx++){const d=Math.hypot(dx,dy)/r;if(d>2.8)continue;const an=Math.atan2(dy,dx),streak=.55+.45*Math.sin(an*5+ph)*Math.cos(an*3-ph*.7);
   const v=Math.max(0,1-d/(1.05+1.5*streak*streak));const idx=wrap(Math.floor(cy)+dy)*N+wrap(Math.floor(cx)+dx);Sc[idx]=Math.max(Sc[idx],Math.min(1,v*1.7));}}
 const d=new Uint8Array(N*N*4),cl=v=>Math.max(0,Math.min(255,Math.round(v)));
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,gx=(H[y*N+wrap(x+1)]-H[y*N+wrap(x-1)])*.5,gz=(H[wrap(y+1)*N+x]-H[wrap(y-1)*N+x])*.5;
  d[i*4]=cl(128+A[i]*300);d[i*4+1]=cl(128+gx*150);d[i*4+2]=cl(128+gz*150);d[i*4+3]=cl(Sc[i]*255);}
 return dataTex(d,N,4);}
// Earth (equirectangular, original): oceans, continents, ice, cloud bands.
function earthTexture(w,h){const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx=cv.getContext('2d'),img=ctx.createImageData(w,h),N=128;
 const land=fbm(N,[4,8,16],71),cloud=fbm(N,[6,12,24],83),sample=(f,u,v)=>f[Math.floor(v*N)%N*N+Math.floor(u*N)%N];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h,lat=Math.abs(v-.5)*2,l=sample(land,u,v*.5+.25*(u>.5?1:0)),c=sample(cloud,(u*2)%1,v);
  let r=12,g=38,b=92;if(l>.56){const t=Math.min(1,(l-.56)*5);r=96+60*t;g=92+30*t;b=60+18*t;if(lat<.35&&l<.7){r=62;g=86;b=48;}}
  if(lat>.84){r=g=b=235;}const cc=Math.max(0,Math.min(1,(c-.5)*3.2))*(.6+.4*Math.abs(Math.sin(v*14)));r+=(240-r)*cc;g+=(244-g)*cc;b+=(250-b)*cc;
  const i=(y*w+x)*4;img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=255;}
 ctx.putImageData(img,0,0);const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;return t;}

// ------------------------------------------------------------------ geometry kits (merged, vertex-coloured, aFx per vertex)
const G={};function unitGeometry(){if(G.box)return;G.box=new T.BoxGeometry(1,1,1);G.cyl6=new T.CylinderGeometry(1,1,1,6);G.cyl8=new T.CylinderGeometry(1,1,1,8);G.cyl12=new T.CylinderGeometry(1,1,1,12);
 G.cyl16=new T.CylinderGeometry(1,1,1,16);G.cone6=new T.ConeGeometry(1,1,6);G.cone8=new T.ConeGeometry(1,1,8);G.ico0=new T.IcosahedronGeometry(1,0);G.ico1=new T.IcosahedronGeometry(1,1);
 G.dode=new T.DodecahedronGeometry(1,0);G.oct=new T.OctahedronGeometry(1,0);G.torus=new T.TorusGeometry(1,.18,6,14);G.tet=new T.TetrahedronGeometry(1,0);
 G.frustum8=new T.CylinderGeometry(.62,1,1,8);G.frustum6=new T.CylinderGeometry(.5,1,1,6);}
const _o=new T.Object3D(),_v=new T.Vector3(),_n=new T.Vector3(),_m=new T.Matrix4(),_nm=new T.Matrix4(),_q=new T.Quaternion(),_up=new T.Vector3(0,1,0),_d=new T.Vector3(),_c=new T.Color();
class Kit{
 constructor(ao){this.P=[];this.N=[];this.Cl=[];this.F=[];this.I=[];this.stack=[new T.Matrix4()];this.ao=ao!==false;this.aoTop=2.4;}
 get frame(){return this.stack[this.stack.length-1];}
 push(x,y,z,ry=0,s=1){_o.position.set(x,y,z);_o.rotation.set(0,ry,0);_o.scale.set(s,s,s);_o.updateMatrix();this.stack.push(new T.Matrix4().multiplyMatrices(this.frame,_o.matrix));return this;}
 pushMatrix(m){this.stack.push(new T.Matrix4().multiplyMatrices(this.frame,m));return this;}
 pop(){this.stack.pop();return this;}
 // Append geometry g transformed by part matrix m (inside the current frame). col: Color or null (use g's vertex colours, tinted by tint).
 add(g,m,col,fx,tint){const pos=g.attributes.position,nor=g.attributes.normal,vc=g.attributes.color,base=this.P.length/3;
  _m.multiplyMatrices(this.frame,m);_nm.copy(_m).invert().transpose();const glow=fx?fx[0]:0,pat=fx?fx[1]:0,gr=fx?fx[2]:0,ao=this.ao&&!glow;
  for(let i=0;i<pos.count;i++){_v.fromBufferAttribute(pos,i).applyMatrix4(m);const ly=_v.y;_v.applyMatrix4(this.frame);this.P.push(_v.x,_v.y,_v.z);
   _n.fromBufferAttribute(nor,i).transformDirection(_nm);this.N.push(_n.x,_n.y,_n.z);const k=ao?.4+.6*smooth(-.4,this.aoTop,ly):1;
   if(col)this.Cl.push(col.r*k,col.g*k,col.b*k);else{const t=tint||_c.setRGB(1,1,1);this.Cl.push(vc.getX(i)*t.r*k,vc.getY(i)*t.g*k,vc.getZ(i)*t.b*k);}this.F.push(glow,pat,gr,0);}
  if(g.index){const ix=g.index.array;for(let i=0;i<ix.length;i++)this.I.push(base+ix[i]);}else for(let i=0;i<pos.count;i++)this.I.push(base+i);return this;}
 part(g,x,y,z,sx,sy,sz,rx,ry,rz,col,fx){_o.position.set(x,y,z);_o.rotation.set(rx||0,ry||0,rz||0);_o.scale.set(sx,sy,sz);_o.updateMatrix();return this.add(g,_o.matrix,col,fx);}
 box(x,y,z,w,h,d,col,fx,ry,rx,rz){return this.part(G.box,x,y,z,w,h,d,rx,ry,rz,col,fx);}            // centre-anchored
 slab(x,y0,z,w,h,d,col,fx,ry){return this.part(G.box,x,y0+h/2,z,w,h,d,0,ry,0,col,fx);}               // bottom-anchored
 cyl(x,y0,z,r,h,col,fx,g){return this.part(g||G.cyl12,x,y0+h/2,z,r,h,r,0,0,0,col,fx);}
 beam(a,b,t,col,fx,g){_d.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const L=_d.length();if(L<1e-4)return this;_d.multiplyScalar(1/L);_q.setFromUnitVectors(_up,_d);
  _o.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);_o.quaternion.copy(_q);_o.scale.set(t,L,t.length?t:t);_o.scale.z=t;_o.updateMatrix();return this.add(g||G.box,_o.matrix,col,fx);}
 tendril(pts,r0,r1,col,fx){for(let i=0;i<pts.length-1;i++){const t=i/(pts.length-1);this.beam(pts[i],pts[i+1],r0+(r1-r0)*t,col,fx,G.cyl6);}return this;}
 mesh(mat){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.P,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.N,3));
  g.setAttribute('color',new T.Float32BufferAttribute(this.Cl,3));g.setAttribute('aFx',new T.Float32BufferAttribute(this.F,4));g.setIndex(this.I);g.computeBoundingSphere();return new T.Mesh(g,mat);}
 geometry(){return this.mesh(null).geometry;}
}
// Billboard halos (mode 0) and static additive beams (mode 1).
class Glow{
 constructor(){this.P=[];this.O=[];this.C=[];this.I=[];}
 dot(x,y,z,size,c,k=1){const b=this.P.length/3;for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){this.P.push(x,y,z);this.O.push(u,v,size,0);this.C.push(c.r*k,c.g*k,c.b*k);}this.I.push(b,b+1,b+2,b,b+2,b+3);return this;}
 beam(x,y,z,r,h,c,k=1){for(const a of [0,Math.PI/2,Math.PI/4,-Math.PI/4]){const b=this.P.length/3,dx=Math.cos(a)*r,dz=Math.sin(a)*r;for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){this.P.push(x+dx*u,y+(v+1)/2*h,z+dz*u);this.O.push(u,v,0,1);this.C.push(c.r*k,c.g*k,c.b*k);}this.I.push(b,b+1,b+2,b,b+2,b+3);}return this;}
 get empty(){return !this.P.length;}
 mesh(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.P,3));g.setAttribute('aOff',new T.Float32BufferAttribute(this.O,4));g.setAttribute('aCol',new T.Float32BufferAttribute(this.C,3));g.setIndex(this.I);g.computeBoundingSphere();
  if(g.boundingSphere)g.boundingSphere.radius+=8;const m=new T.Mesh(g,S.glowMat);m.renderOrder=5;return m;}
}
// Soft ground AO / contact blobs that follow the ground (sampled once at build time, never per chunk).
class Decal{
 constructor(ground){this.g=ground;this.P=[];this.C=[];this.I=[];}
 blob(x,z,rx,rz,alpha,ry=0,seg=18){const base=this.P.length/3,cr=Math.cos(ry),sr=Math.sin(ry),g=this.g;
  const put=(lx,lz,a)=>{const wx=x+lx*cr+lz*sr,wz=z-lx*sr+lz*cr;this.P.push(wx,g?g(wx,wz)+.06:.03,wz);this.C.push(0,0,0,a);};
  put(0,0,alpha);for(const [k,a] of [[.62,alpha*.8],[1,0]])for(let s=0;s<seg;s++){const an=s/seg*TAU;put(Math.cos(an)*rx*k,Math.sin(an)*rz*k,a);}
  for(let s=0;s<seg;s++){const s1=(s+1)%seg,a0=base+1+s,a1=base+1+s1,b0=base+1+seg+s,b1=base+1+seg+s1;this.I.push(base,a1,a0,a0,a1,b1,a0,b1,b0);}return this;}
 mesh(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.P,3));g.setAttribute('color',new T.Float32BufferAttribute(this.C,4));g.setIndex(this.I);g.computeBoundingSphere();const m=new T.Mesh(g,S.decalMat);m.renderOrder=1;return m;}
}

// ------------------------------------------------------------------ shared GLSL
const NOISE_GLSL=`uniform sampler2D uNoise;uniform float uTime;`;
function inject(src,anchor,code,after=true){if(!src.includes(anchor))throw Error('option c: shader anchor missing '+anchor);return src.replace(anchor,after?anchor+'\n'+code:code+'\n'+anchor);}

function makeTerrainMaterial(low){
 const mat=new T.MeshLambertMaterial({vertexColors:true});
 const U=S.terrainU={uNoise:{value:S.noise},uCrater:{value:S.crater},uTime:{value:0},
  uReg0:{value:lin('#55534f')},uReg1:{value:lin('#8f8c86')},uBasalt:{value:lin('#45464a')},uComp0:{value:lin('#4b4640')},uComp1:{value:lin('#6a635a')},
  uScorch:{value:lin('#15120f')},uTrack:{value:lin('#3b3834')},uCreepA:{value:lin('#2b1318')},uCreepB:{value:lin('#552530')},uVein:{value:lin('#ff5a18').multiplyScalar(2.6)},
  uPool:{value:Array.from({length:10},()=>new T.Vector4(0,0,1,0))},uPoolC:{value:Array.from({length:10},()=>new T.Color(0,0,0))},uCreep:{value:Array.from({length:6},()=>new T.Vector4(0,0,1,0))}};
 mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
  sh.vertexShader=inject(sh.vertexShader,'#include <common>','varying vec2 vCqW;varying vec3 vCqN;');
  sh.vertexShader=inject(sh.vertexShader,'#include <begin_vertex>','vCqW=uv*24.0;vCqN=normal;');
  sh.fragmentShader=inject(sh.fragmentShader,'#include <common>',`${NOISE_GLSL}
uniform sampler2D uCrater;uniform vec3 uReg0,uReg1,uBasalt,uComp0,uComp1,uScorch,uTrack,uCreepA,uCreepB,uVein;uniform vec4 uPool[10];uniform vec3 uPoolC[10];uniform vec4 uCreep[6];
varying vec2 vCqW;varying vec3 vCqN;
float cqLane(vec2 p,float ang,float period,float seed){vec2 d=vec2(cos(ang),sin(ang));vec2 q=vec2(dot(p,d),dot(p,vec2(-d.y,d.x)));
 q.y+=(texture2D(uNoise,p*0.0029+seed).g-0.5)*90.0;float id=floor(q.y/period);float h=fract(sin(id*127.1+seed*311.7)*43758.5);
 float lane=q.y-(id+0.5)*period+(h-0.5)*period*0.4;float band=1.0-smoothstep(0.28,0.5,abs(abs(lane)-1.32));
 float cleat=0.72+0.28*step(0.45,fract(q.x*1.7));float aa=1.0-smoothstep(0.35,0.8,fwidth(q.y));return band*step(0.42,h)*cleat*aa;}`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`
 vec2 cqW=vCqW;float cqDist=length(vViewPosition);
 vec4 nM=texture2D(uNoise,cqW*0.0019);vec4 nS=texture2D(uNoise,cqW*0.029+0.37);
 vec4 cA=texture2D(uCrater,cqW*(1.0/101.0));vec4 cB=texture2D(uCrater,mat2(0.8,-0.6,0.6,0.8)*cqW*(1.0/33.0)+0.21);
 float terra=smoothstep(0.035,0.085,vColor.g-max(vColor.r,vColor.b));float massif=smoothstep(0.0,0.06,vColor.b-vColor.r);
 float slope=1.0-clamp(vCqN.y,0.0,1.0);float war=smoothstep(0.3,0.7,nM.g);
 float craterK=(1.0-terra*0.72)*(1.0-smoothstep(0.3,0.65,slope));float shell=craterK*(0.5+0.7*war);
 vec3 base=mix(uReg0,uReg1,clamp(nM.r*0.75+nS.g*0.35-0.05,0.0,1.0));
 base=mix(base,uBasalt,max(massif,smoothstep(0.32,0.7,slope)));
 base=mix(base,mix(uComp0,uComp1,nS.r),terra);
 float alb=(cA.r-0.5)*1.5*craterK+(cB.r-0.5)*1.4*shell;
 vec2 cqGrad=(cA.gb-0.5)*1.5*craterK+(cB.gb-0.5)*1.5*shell;
#ifndef CQ_LOW
 vec4 cC=texture2D(uCrater,mat2(0.28,0.96,-0.96,0.28)*cqW*(1.0/11.0)+0.63);float near=1.0-smoothstep(70.0,190.0,cqDist);
 alb+=(cC.r-0.5)*1.1*shell*near;cqGrad+=(cC.gb-0.5)*1.0*shell*near;
#endif
 vec3 cqCol=base*(1.0+alb);
 float sc=clamp(max(cB.a*(0.25+0.95*war),cA.a*0.7*war)*(1.0-terra*0.35),0.0,1.0);cqCol=mix(cqCol,uScorch,sc*0.82);
 float tr=max(cqLane(cqW,0.37,26.0,1.3)*(0.3+0.7*terra),cqLane(cqW,1.93,34.0,7.7)*(0.22+0.6*terra));
#ifndef CQ_LOW
 tr=max(tr,cqLane(cqW,-0.78,19.0,3.1)*terra*0.8);
#endif
 cqCol=mix(cqCol,uTrack*(0.82+0.36*nS.b),tr*0.85);cqGrad*=1.0-tr*0.6;
 float sp=texture2D(uNoise,cqW*0.43).a;float spFade=(1.0-smoothstep(22.0,80.0,cqDist))*(1.0-terra*0.5);
 cqCol*=1.0+(step(0.94,sp)*0.45-step(sp,0.05)*0.35)*spFade;
 float creep=0.0;
 for(int i=0;i<6;i++){vec4 c=uCreep[i];if(c.w<=0.0)continue;float d=length(cqW-c.xy);float e=c.z*(0.7+0.6*nS.r);creep=max(creep,c.w*(1.0-smoothstep(e*0.45,e,d)));}
 float vein=smoothstep(0.84,0.975,texture2D(uNoise,cqW*0.083+0.5).b);
 cqCol=mix(cqCol,mix(uCreepA,uCreepB,nS.g)*(0.8+0.4*nS.a),creep*0.94);cqGrad+=(nS.rg-0.5)*1.4*creep;
 vec3 cqEmis=uVein*vein*creep*creep*(0.78+0.22*sin(uTime*2.1+cqW.x*0.21));
 vec3 cqPool=vec3(0.0);
 for(int i=0;i<10;i++){vec4 p=uPool[i];vec2 dd=cqW-p.xy;float f=max(0.0,1.0-dot(dd,dd)/(p.z*p.z));cqPool+=uPoolC[i]*(f*f*p.w);}
 diffuseColor.rgb=cqCol;`);
  sh.fragmentShader=inject(sh.fragmentShader,'#include <normal_fragment_begin>','{vec3 cqN=normalize(normalize(vCqN)+vec3(-cqGrad.x,0.0,-cqGrad.y));normal=normalize((viewMatrix*vec4(cqN,0.0)).xyz);}');
  sh.fragmentShader=inject(sh.fragmentShader,'#include <emissivemap_fragment>','totalEmissiveRadiance+=cqEmis;');
  sh.fragmentShader=inject(sh.fragmentShader,'#include <aomap_fragment>','reflectedLight.directDiffuse+=diffuseColor.rgb*cqPool;');};
 mat.customProgramCacheKey=()=>'cq-c-terrain-'+(low?'lo':'hi');if(low)mat.defines={CQ_LOW:''};return mat;}

function makeArchMaterial(low){
 const mat=new T.MeshLambertMaterial({vertexColors:true});
 const U=S.archU={uNoise:{value:S.noise},uTime:{value:0},uDust:{value:lin('#8a8580')}};
 mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
  sh.vertexShader=inject(sh.vertexShader,'#include <common>','attribute vec4 aFx;varying vec4 vFx;varying vec3 vCqP;varying vec3 vCqN;');
  sh.vertexShader=inject(sh.vertexShader,'#include <begin_vertex>','vFx=aFx;vCqP=position;vCqN=normal;');
  sh.fragmentShader=inject(sh.fragmentShader,'#include <common>',`${NOISE_GLSL}uniform vec3 uDust;varying vec4 vFx;varying vec3 vCqP;varying vec3 vCqN;`);
  sh.fragmentShader=inject(sh.fragmentShader,'#include <color_fragment>',`
 vec3 cqE=vec3(0.0);
 {vec3 an=abs(vCqN);vec3 p=vCqP;bool top=an.y>an.x&&an.y>an.z;vec2 pc=top?p.xz:(an.x>an.z?p.zy:p.xy);float pat=vFx.y;vec3 c=diffuseColor.rgb;
  vec4 nz=texture2D(uNoise,(p.xz+p.y*0.61)*0.071);
  if(pat>0.5&&pat<1.5){float s=step(0.5,fract((pc.x+pc.y)*0.95));c=mix(vec3(0.012),vec3(0.66,0.4,0.018),s)*(0.8+0.3*nz.g);}
  else if(pat<2.5&&pat>1.5){vec2 f=fract(pc*vec2(0.93,0.93));vec2 e=min(f,1.0-f);float pil=smoothstep(0.0,0.2,min(e.x,e.y));vec2 wq=abs(fract(pc*6.0)-0.5);
   float wire=top?0.0:(1.0-smoothstep(0.03,0.09,min(wq.x,wq.y)));c*=(0.6+0.42*pil)*(1.0-0.42*wire)*(0.85+0.3*nz.r);if(top)c=mix(c,uDust*0.7,0.55);}
  else if(pat<3.5&&pat>2.5){float row=floor(pc.y/0.27);float x=pc.x/0.62+0.5*mod(row,2.0);vec2 f=vec2(fract(x),fract(pc.y/0.27));
   float bag=smoothstep(0.0,0.14,f.x)*smoothstep(1.0,0.86,f.x)*smoothstep(0.0,0.24,f.y)*smoothstep(1.0,0.76,f.y);c*=(0.52+0.5*bag)*(0.86+0.28*nz.g);if(top)c*=0.9;}
  else if(pat<4.5&&pat>3.5){if(!top){float rib=0.5+0.5*sin(pc.x*19.0);c*=0.74+0.34*rib;}c*=0.85+0.3*nz.r;}
  else if(pat<5.5&&pat>4.5){vec2 f=fract(pc/vec2(1.7,1.25));vec2 e=min(f,1.0-f)*vec2(1.7,1.25);float seam=smoothstep(0.02,0.06,min(e.x,e.y));
   vec2 rv=abs(fract(pc/vec2(0.425,0.3125))-0.5);float rivet=(1.0-smoothstep(0.08,0.14,length(rv)))*(1.0-seam)*0.0;c*=(0.7+0.3*seam)*(0.82+0.34*nz.g)+rivet;}
  else if(pat<6.5&&pat>5.5){vec2 f=abs(fract(pc/vec2(1.05,0.72))-0.5);float grid=1.0-smoothstep(0.44,0.48,max(f.x,f.y));c=mix(vec3(0.32,0.34,0.36),c,grid)*(0.9+0.2*nz.a);
   float glint=pow(max(0.0,nz.r),5.0);c+=vec3(0.02,0.04,0.07)*glint*grid;}
  else if(pat<7.5&&pat>6.5){vec4 v=texture2D(uNoise,p.xz*0.19+p.y*0.13);float vein=smoothstep(0.86,0.98,v.b);float pus=step(0.955,texture2D(uNoise,(p.xy+p.zx)*0.53).a);
   c*=0.75+0.5*v.g;cqE=vec3(1.0,0.32,0.06)*(vein*1.3+pus*2.2)*(0.8+0.2*sin(uTime*2.6+p.y));}
  else if(pat<8.5&&pat>7.5){c*=0.8+0.35*nz.g;float crack=smoothstep(0.93,0.99,texture2D(uNoise,pc*0.12).b);c*=1.0-0.45*crack;}
  float gr=vFx.z;if(gr>0.0){float sc=smoothstep(0.55,0.8,texture2D(uNoise,(p.xz+p.yy)*0.037).g);c*=1.0-gr*(0.55*sc+0.18*(1.0-nz.g));}
  if(top&&pat!=6.0)c=mix(c,uDust,0.18*smoothstep(0.3,0.8,nz.r));
  diffuseColor.rgb=c;}`);
  sh.fragmentShader=inject(sh.fragmentShader,'#include <emissivemap_fragment>','totalEmissiveRadiance+=diffuseColor.rgb*vFx.x*1.7+cqE;');};
 mat.customProgramCacheKey=()=>'cq-c-arch-'+(low?'lo':'hi');return mat;}

function makeGlowMaterial(){return new T.ShaderMaterial({
 uniforms:{fogColor:{value:new T.Color()},fogNear:{value:1},fogFar:{value:2000},fogDensity:{value:0},uGain:{value:1}},
 vertexShader:`attribute vec4 aOff;attribute vec3 aCol;varying vec3 vC;varying vec3 vU;varying float vD;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);if(aOff.w<0.5)mv.xy+=aOff.xy*aOff.z;vU=vec3(aOff.xy,aOff.w);vC=aCol;vD=-mv.z;gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;uniform float uGain;varying vec3 vC;varying vec3 vU;varying float vD;
void main(){float a;if(vU.z<0.5){float r=dot(vU.xy,vU.xy);a=max(0.0,1.0-r);a=a*a*(0.25+0.75*exp(-r*7.0));}else{float x=1.0-abs(vU.x);a=x*x*clamp(1.0-(vU.y*0.5+0.5),0.0,1.0);a*=a;}
 float f=1.0-0.92*smoothstep(fogNear,fogFar,vD);gl_FragColor=vec4(vC*a*f*uGain,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,fog:true});}

// ------------------------------------------------------------------ prepare: textures, materials, prop geometry (once)
function prepareShared(api){if(S.ready)return;const low=api.low;unitGeometry();
 S.noise=noiseTexture(256);S.crater=craterTexture(low?256:512,4242,low?240:520,low?1.6:2.6,low?26:46,low?5:9);
 S.terrainMat=makeTerrainMaterial(low);S.archMat=makeArchMaterial(low);S.glowMat=makeGlowMaterial();
 S.decalMat=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-6,side:T.DoubleSide});
 S.props=propGeometries(low);S.ready=true;}

// ------------------------------------------------------------------ environment: black sky, dust band, low sun, hazy Earth
const SUN_DIR=new T.Vector3(-.78,.33,.54).normalize();
const HAZE='#2c2824';
function environment(api){prepareShared(api);const low=api.low,scene=api.scene;
 const haze=lin(HAZE);scene.background=new T.Color(0x000000);scene.fog=new T.Fog(haze.getHex(T.LinearSRGBColorSpace)?HAZE:HAZE,170,2350);
 api.renderer.toneMappingExposure=1.05;
 const sun=new T.DirectionalLight(0xffd8ae,6.4);sun.position.copy(SUN_DIR).multiplyScalar(500);scene.add(sun);scene.add(sun.target);
 scene.add(new T.HemisphereLight(0x4f5d7c,0x6e6254,1.75));
 // sky dome follows the camera (engine hook: sky.position = camera.position)
 const sky=new T.Mesh(new T.SphereGeometry(2600,32,16),new T.ShaderMaterial({uniforms:{uSun:{value:SUN_DIR.clone()},uSunC:{value:lin('#ffcf9a')},uHaze:{value:scene.fog.color}},
  vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position.z=gl_Position.w*0.99999;}`,
  fragmentShader:`uniform vec3 uSun;uniform vec3 uSunC;uniform vec3 uHaze;varying vec3 vDir;
void main(){vec3 d=normalize(vDir);float h=d.y;float s=max(dot(d,uSun),0.0);
 vec3 c=uSunC*(pow(s,1400.0)*60.0+pow(s,90.0)*0.5+pow(s,9.0)*0.06);gl_FragColor=vec4(c,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 float band=h<0.0?1.0:exp(-h*30.0)*0.9+0.1*exp(-h*4.0);gl_FragColor.rgb=mix(gl_FragColor.rgb,uHaze,band*(1.0-pow(s,1400.0)));
}`,side:T.BackSide,depthWrite:false,depthTest:false,fog:false}));sky.renderOrder=-3;sky.frustumCulled=false;scene.add(sky);
 // stars
 const R=mulberry(99),n=low?380:800,sp=[],sc=[];for(let i=0;i<n;i++){const y=.03+Math.pow(R(),.8)*.97,a=R()*TAU,r=Math.sqrt(1-y*y);sp.push(Math.cos(a)*r*2400,y*2400,Math.sin(a)*r*2400);const b=.25+Math.pow(R(),3)*1.4,t=R();sc.push(b*(t<.2?.8:1),b*(t<.2?.9:.97),b*(t<.2?1.25:.92));}
 const sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(sp,3));sg.setAttribute('color',new T.Float32BufferAttribute(sc,3));
 const stars=new T.Points(sg,new T.PointsMaterial({size:low?1.3:1.5,sizeAttenuation:false,vertexColors:true,fog:false,depthWrite:false}));stars.renderOrder=-2;stars.frustumCulled=false;scene.add(stars);
 // Earth: lit sphere, atmosphere rim, horizon haze. In the game it hangs on a fixed bearing; the lab places it inside each frame.
 const earth=new T.Mesh(new T.SphereGeometry(1,low?32:48,low?16:24),new T.ShaderMaterial({uniforms:{uMap:{value:earthTexture(low?256:512,low?128:256)},uSun:{value:SUN_DIR.clone()},uHaze:{value:scene.fog.color},uHazeK:{value:.2}},
  vertexShader:`varying vec3 vN;varying vec2 vUv;varying vec3 vV;void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 wp=modelMatrix*vec4(position,1.0);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}`,
  fragmentShader:`uniform sampler2D uMap;uniform vec3 uSun;uniform vec3 uHaze;uniform float uHazeK;varying vec3 vN;varying vec2 vUv;varying vec3 vV;
void main(){vec3 n=normalize(vN);float l=dot(n,uSun);vec3 t=texture2D(uMap,vUv).rgb;vec3 c=t*(0.012+1.9*max(l,0.0));float mu=max(dot(n,normalize(vV)),0.0);
 float rim=pow(1.0-mu,2.6);c+=vec3(0.2,0.45,1.0)*rim*(0.05+1.3*smoothstep(-0.3,0.5,l));gl_FragColor=vec4(c,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 gl_FragColor.rgb=mix(gl_FragColor.rgb,uHaze,uHazeK);
}`,depthWrite:false,fog:false}));earth.renderOrder=-1;earth.frustumCulled=false;earth.rotation.set(.35,2.2,.41);scene.add(earth);
 S.sky=sky;S.stars=stars;S.earth=earth;S.earthPlaced=false;}

// Earth bearing inside each lab frame (yaw offset from the camera's view, elevation above the horizon, angular radius).
const EARTH_SLOT={refuge:[.17,.085,.027],raid:[-.13,.06,.024],tank:[.16,.12,.024],enemy:[-.16,.1,.024],props:[.13,.09,.024]};
function placeEarth(api){const cam=api.camera,slot=EARTH_SLOT[api.subject]||[.15,.08,.024];const f=new T.Vector3();cam.getWorldDirection(f);
 const yaw=Math.atan2(f.x,f.z)+slot[0]*(cam.aspect<1?1:2.2),el=slot[1]+Math.max(0,Math.asin(Math.max(-1,Math.min(1,f.y))))*0+(cam.aspect<1?0:.0);
 // put Earth just above the visible horizon line: elevation relative to the camera pitch
 const pitch=Math.asin(Math.max(-1,Math.min(1,f.y))),vfov=cam.fov*Math.PI/180,top=pitch+vfov/2;const e=Math.min(top-.07,Math.max(slot[1],pitch+vfov*.18));
 const dir=new T.Vector3(Math.sin(yaw)*Math.cos(e),Math.sin(e),Math.cos(yaw)*Math.cos(e));const D=2300;
 S.earth.position.copy(cam.position).addScaledVector(dir,D);S.earth.scale.setScalar(D*Math.tan(slot[2]));S.earthPlaced=true;void el;}

// ------------------------------------------------------------------ terrain light pools & creep (fixed-size uniform arrays)
function setPools(list){const U=S.terrainU;for(let i=0;i<10;i++){const p=list[i];if(p){U.uPool.value[i].set(p[0],p[1],p[2],p[3]);U.uPoolC.value[i].copy(p[4]);}else U.uPool.value[i].set(0,0,1,0);}}
function setCreep(list){const U=S.terrainU;for(let i=0;i<6;i++){const c=list[i];if(c)U.uCreep.value[i].set(c[0],c[1],c[2],c[3]);else U.uCreep.value[i].set(0,0,1,0);}}

// ------------------------------------------------------------------ shared structure parts
const SEG7={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgedc',7:'abc',8:'abcdefg',9:'abcdfg'};
// Stencil digits from boxes. plane 'roof': flat, reads from +z; 'wall': on a face looking +z (normal +z).
function stencil(k,text,x,y,z,h,col,plane){const w=h*.55,lw=h*.13,gap=w*1.45;let cx=x-(text.length-1)*gap/2;
 for(const ch of text){const segs=SEG7[ch]||'';const S7={a:[0,h/2,w,lw],d:[0,-h/2,w,lw],g:[0,0,w,lw],b:[w/2,h/4,lw,h/2],c:[w/2,-h/4,lw,h/2],e:[-w/2,-h/4,lw,h/2],f:[-w/2,h/4,lw,h/2]};
  for(const s of segs){const [u,v,sw,sh]=S7[s];if(plane==='roof')k.box(cx+u,y,z-v,sw,.03,sh,col,[0,0,.25]);else k.box(cx+u,y+v,z,sw,sh,.03,col,[0,0,.25]);}cx+=gap;}}
function lampHead(k,gl,x,y,z,ry,n,col){k.box(x,y,z,n*.75+.3,.95,.35,P.steelD,null,ry);for(let i=0;i<n;i++){const o=(i-(n-1)/2)*.75,dx=Math.cos(ry)*o,dz=-Math.sin(ry)*o,fx=Math.sin(ry)*.2,fz=Math.cos(ry)*.2;
  k.box(x+dx+fx,y,z+dz+fz,.55,.6,.05,col,[2.2,0,0],ry);gl.dot(x+dx+fx*3,y,z+dz+fz*3,2.4,col,.55);}}
function latticeMast(k,x,y0,z,h,w0,w1,col,braces){const legs=[];for(let i=0;i<3;i++){const a=i/3*TAU+.5;legs.push([Math.cos(a),Math.sin(a)]);}
 for(const [cx,cz] of legs)k.beam([x+cx*w0,y0-.5,z+cz*w0],[x+cx*w1,y0+h,z+cz*w1],.11,col);
 if(braces)for(let y=y0+1.2;y<y0+h-1;y+=2.1){const t0=(y-y0)/h,t1=Math.min(1,(y+1.9-y0)/h),r0=w0+(w1-w0)*t0,r1=w0+(w1-w0)*t1;
  for(let i=0;i<3;i++){const a=legs[i],b=legs[(i+1)%3];k.beam([x+a[0]*r0,y,z+a[1]*r0],[x+b[0]*r1,y+1.9,z+b[1]*r1],.045,col);}}}
function floodTower(k,gl,x,y0,z,h,facing,hi){latticeMast(k,x,y0,z,h,.9,.35,P.steelL,hi);k.slab(x,y0-.3,z,1.6,.5,1.6,P.concreteD,[0,8,.4]);
 lampHead(k,gl,x+Math.sin(facing)*.4,y0+h+.3,z+Math.cos(facing)*.4,facing,3,P.lampW);k.box(x,y0+h+1.1,z,.18,.9,.18,P.steelD);k.part(G.ico0,x,y0+h+1.65,z,.18,.18,.18,0,0,0,P.red,[3,0,0]);gl.dot(x,y0+h+1.65,z,1.6,P.red,.8);}
function sandbagRow(k,x,y0,z,len,h,ry,col){k.part(G.box,x,y0+h/2,z,len,h,.62,0,ry,0,col||P.khaki,[0,3,.3]);k.part(G.box,x,y0+h+.12,z,len*.96,.24,.5,0,ry,0,col||P.khaki,[0,3,.3]);}
function crate(k,x,y0,z,w,h,d,ry,col,band){k.slab(x,y0,z,w,h,d,col,[0,4,.35],ry);if(band)k.slab(x,y0+h*.62,z,w+.02,h*.12,d+.02,P.yellow,[0,1,0],ry);}

// HESCO-walled armoured hab module (local frame, y=0 = ground at centre, entrance faces +z). Envelope: r ≤ 7.8, ~8.5 m tall.
function habitat(k,gl,dec,idx,hi,R){
 k.cyl(0,-1.3,0,8.35,1.52,P.concreteD,[0,8,.5],G.cyl16);
 const r=7.2,segs=18,gw=TAU*r/segs-.1;
 for(let s=0;s<segs;s++){const a=(s+.5)/segs*TAU;if(s===4)continue;const x=Math.cos(a)*r,z=Math.sin(a)*r,ry=Math.PI/2-a;
  for(let t=0;t<3;t++){const dmg=(s*7+idx*3)%11===0&&t===2;const hh=1.06+R()*.06,y=-.35+t*1.12;const tone=P.khaki.clone().multiplyScalar(.82+R()*.3);
   k.part(G.box,x,y+hh/2-(dmg?.25:0),z,gw-R()*.12,hh,1.08,dmg?.12:0,ry+(R()-.5)*.03,0,tone,[0,2,.35+(dmg?.4:0)]);}
  if(hi&&(s+idx)%3!==0)sandbagRow(k,x,3.0,z,gw*.9,.34,ry);}
 // entrance: hazard posts + low sandbag chicane
 for(const sgn of [-1,1]){const a=(4.5+sgn*.5)/segs*TAU;k.slab(Math.cos(a)*r,-.2,Math.sin(a)*r,.42,3.9,.42,P.yellow,[0,1,.2]);}
 sandbagRow(k,0,0,6.1,3.4,.7,0);
 // module: plinth, armoured block, chamfered roof edges, roof module, cupola
 k.slab(0,0,0,9.6,.55,6.8,P.concrete,[0,8,.5]);const tone=[P.olive,P.oliveD,P.oliveL][idx%3];
 k.slab(0,.5,0,9.0,4.0,6.2,tone,[0,5,.55]);
 for(const sz of [-1,1])k.part(G.box,0,4.38,sz*2.92,9.0,.55,.75,sz*.6,0,0,tone,[0,5,.5]);
 for(const sx of [-1,1])k.part(G.box,sx*4.33,4.38,0,.75,.55,5.6,0,0,-sx*.6,tone,[0,5,.5]);
 k.slab(0,4.5,-.5,5.4,2.5,3.9,P.oliveD,[0,5,.45]);
 stencil(k,String(idx+1).padStart(2,'0'),0,7.02,-.5,2.2,P.paint,'roof');
 // blast door + hazard frame, window slits (warm)
 k.slab(0,.55,3.12,2.2,2.7,.12,P.steelD,[0,5,.3]);k.slab(0,3.25,3.14,2.6,.3,.1,P.yellow,[0,1,0]);for(const sx of [-1,1])k.slab(sx*1.25,.55,3.14,.25,2.7,.1,P.yellow,[0,1,0]);
 const warm=P.lampA;for(const [x,z,ry] of [[-2.9,3.12,0],[2.9,3.12,0],[-2.9,-3.12,0],[2.9,-3.12,0],[4.52,-1.2,Math.PI/2],[4.52,1.4,Math.PI/2],[-4.52,-1.2,Math.PI/2],[-4.52,1.4,Math.PI/2]]){
  k.box(x,3.55,z,1.5,.2,.08,warm,[1.9,0,0],ry);if(hi||z>0)gl.dot(x+(ry?Math.sign(x)*.3:0),3.55,z+(ry?0:Math.sign(z)*.3),1.3,warm,.35);}
 k.box(0,6.0,1.47,3.6,.18,.08,warm,[1.9,0,0]);gl.dot(0,6.0,1.7,1.6,warm,.35);
 // roof hardware: AC unit, cupola with slit, comms mast + dish + red beacon
 k.slab(3.2,4.5,1.6,1.5,.85,1.4,P.steelL,[0,4,.3]);k.slab(-3.3,4.5,1.7,1.5,1.25,1.5,P.oliveD,[0,5,.4]);k.box(-3.3,5.4,2.47,1.1,.14,.05,warm,[1.8,0,0]);
 k.cyl(1.9,7.0,-1.6,.07,4.6,P.steelL,null,G.cyl6);k.part(G.cone8,1.3,7.9,-1.6,.75,.25,.75,0,0,1.2,P.white,[0,0,.3]);
 k.part(G.ico0,1.9,11.7,-1.6,.13,.13,.13,0,0,0,P.red,[3,0,0]);gl.dot(1.9,11.7,-1.6,1.3,P.red,.9);
 if(hi){sandbagRow(k,0,4.5,2.6,8.4,.3,0);k.slab(-1.2,7.0,-1.4,1.1,.4,.8,P.steel,[0,4,.3]);}
 // hab-side cargo container inside the ring (behind the module)
 k.slab(-.6,0,-5.0,6.06,2.6,1.6,[P.cont1,P.cont2,P.cont3,P.cont4][idx%4],[0,4,.45]);
}
function oxygenTower(k,gl,h,idx,hi){
 const segs=16,rr=11.25;for(let s=0;s<segs;s++){const a=(s+.5)/segs*TAU;const x=Math.cos(a)*rr,z=Math.sin(a)*rr,ry=Math.PI/2-a,w=TAU*rr/segs-.12;
  k.part(G.box,x,1.0,z,w,4.4,1.3,0,ry,0,P.concrete,[0,8,.6]);if(s===4){continue;}k.part(G.box,x,3.55,z,w*.98,.7,1.32,0,ry,0,P.yellow,[0,1,.3]);if(hi)sandbagRow(k,x,3.9,z,w*.85,.32,ry);}
 k.cyl(0,-.5,0,8.25,h+.5,P.steel,[0,5,.5],G.cyl16);
 for(let y=10;y<h-4;y+=11)k.cyl(0,y,0,8.7,1.0,P.steelD,[0,5,.3],G.cyl16);
 k.cyl(0,6,0,8.45,.9,P.yellow,[0,1,.2],G.cyl16);
 const lights=[h*.36,h*.68,h-6];lights.forEach((y,li)=>{k.cyl(0,y,0,8.62,.38,li===2?P.cyan:P.lampA,[li===2?2.2:1.6,0,0],G.cyl16);for(let a=0;a<8;a++){const an=a/8*TAU+idx;gl.dot(Math.cos(an)*8.9,y+.2,Math.sin(an)*8.9,li===2?2.2:1.6,li===2?P.cyan:P.lampA,.35);}});
 // scaffold: 8 columns, ring beams, X braces, decks
 const sh=h*.6,cr=10.3;const cols=[];for(let c=0;c<8;c++){const a=c/8*TAU+.2;cols.push([Math.cos(a)*cr,Math.sin(a)*cr]);k.box(cols[c][0],sh/2,cols[c][1],.3,sh,.3,P.steelL);}
 for(let y=6;y<sh;y+=6.5){for(let c=0;c<8;c++){const a=cols[c],b=cols[(c+1)%8];k.beam([a[0],y,a[1]],[b[0],y,b[1]],.18,P.steelL);if(hi&&(c+Math.round(y))%2===0)k.beam([a[0],y-6.3,a[1]],[b[0],y,b[1]],.09,P.steelL);}
  if(Math.round(y/6.5)%2===0)for(let c=0;c<8;c++){const a=(c+.5)/8*TAU+.2;k.part(G.box,Math.cos(a)*9.45,y-.1,Math.sin(a)*9.45,3.9,.14,1.8,0,Math.PI/2-a,0,P.steelD,[0,5,.3]);}}
 for(const a of [.5,2.6,4.4]){k.cyl(Math.cos(a)*9.35,0,Math.sin(a)*9.35,.55,h+2,P.steelL,[0,0,.2],G.cyl8);if(hi)for(let y=4;y<h;y+=9)k.cyl(Math.cos(a)*9.35,y,Math.sin(a)*9.35,.72,.35,P.steelD,null,G.cyl8);}
 // crown: wide ring, stacks, cap, aviation lights
 k.cyl(0,h,0,9.4,3.2,P.steelD,[0,5,.3],G.cyl16);k.part(G.frustum8,0,h+6.6,0,8.2,7,8.2,0,0,0,P.steel,[0,5,.25]);
 for(let s=0;s<4;s++){const a=s/4*TAU+.4,x=Math.cos(a)*5.6,z=Math.sin(a)*5.6;k.cyl(x,h+3,z,1.05,7.5,P.steelD,[0,0,.4],G.cyl8);k.part(G.ico0,x,h+10.7,z,.3,.3,.3,0,0,0,P.red,[3,0,0]);gl.dot(x,h+10.7,z,3.2,P.red,.9);}
 stencil(k,'0'+(idx+1),0,22,8.3,5.5,P.paint,'wall');}
// Fortified supply depot pad (THE place to bank / repair). Not solid: low clutter only at the edges, thin masts.
function supplyDepot(k,gl,dec,hi){
 k.slab(0,-.9,0,21,1.12,21,P.concrete,[0,8,.35]);
 for(const [x,z,w,d] of [[0,-10,21,1],[0,10,21,1],[-10,0,1,19],[10,0,1,19]])k.slab(x,.2,z,w,.05,d,P.yellow,[0,1,.25]);
 for(let s=0;s<24;s++){const a=s/24*TAU;k.part(G.box,Math.cos(a)*6.2,.24,Math.sin(a)*6.2,1.55,.04,.42,0,Math.PI/2-a,0,P.yellow,[0,0,.3]);}
 k.slab(0,.22,0,7.2,.05,1.4,P.white,[0,0,.3]);k.slab(0,.22,0,1.4,.05,7.2,P.white,[0,0,.3]);
 for(const [x,z,ry] of [[0,8,0],[0,-8,Math.PI],[8,0,Math.PI/2],[-8,0,-Math.PI/2]])for(const s of [-1,1])k.part(G.box,x+Math.cos(ry)*s*.7,.23,z-Math.sin(ry)*s*.7,1.8,.04,.38,0,ry+s*.7,0,P.white,[0,0,.3]);
 // terminal kiosk on the north edge with cyan screen + canopy + beacon beam
 k.slab(0,.22,-8.6,3.4,1.25,1.5,P.steelD,[0,5,.35]);k.part(G.box,0,1.62,-8.35,2.6,.06,.9,-.6,0,0,P.cyan,[2.4,0,0]);gl.dot(0,1.8,-8.0,2.6,P.cyan,.6);
 for(const s of [-1,1])k.slab(s*2.0,.2,-9.1,.16,3.4,.16,P.steelL);k.slab(0,3.6,-8.9,4.8,.16,2.6,P.oliveD,[0,4,.3]);k.part(G.ico0,1.7,3.95,-8.9,.22,.22,.22,0,0,0,P.lampA,[3,0,0]);gl.dot(1.7,3.95,-8.9,2.2,P.lampA,.9);
 gl.beam(0,3.8,-8.9,1.6,46,P.cyan,.32);
 // floodlight masts on the corners, facing in
 for(const [x,z] of [[-10.6,-10.6],[10.6,-10.6],[-10.6,10.6],[10.6,10.6]])floodTower(k,gl,x,0,z,10.5,Math.atan2(-x,-z),hi);
 // supply stock on the east / west edges (all low)
 const R=mulberry(77);for(const sx of [-1,1])for(let i=0;i<4;i++){const z=-6+i*3.6,x=sx*8.3;if(i%2)crate(k,x,.2,z,1.5,1.0,1.1,R()*.3,P.olive,true);else k.part(G.cyl12,x,.75,z,.55,1.1,.55,0,0,Math.PI/2,i===0?P.white:P.oliveD,[0,0,.3]);}
 k.part(G.cyl12,-8.2,.55,7.8,1.4,.7,1.0,0,0,0,P.rubber,[0,0,.4]);crate(k,8.1,.2,7.6,1.8,.8,1.2,.2,P.oliveD,false);}
function solarField(k,list,hi){list.forEach((s,i)=>{const gy=api0.ground(s.x,s.z);k.push(s.x,gy,s.z,0);const collapsed=i===3,cracked=i===1;
  for(const [x,z] of [[-6,-3.3],[6,-3.3],[-6,3.3],[6,3.3]])k.slab(x,-.3,z,.18,collapsed&&x>0?.9:(z<0?2.9:1.7),.18,P.steelL);
  if(collapsed){k.part(G.box,0,1.25,0,14,.16,9,.3+.35,0,.12,P.solar,[0,6,.6]);k.part(G.box,4,.25,5.4,3.6,.08,2.2,.08,.6,0,P.solar,[0,6,.8]);}
  else{k.part(G.box,0,2.15,0,14,.16,9,.3,0,0,P.solar,[0,6,.25]);k.part(G.box,0,2.15,0,14.3,.1,9.3,.3,0,0,P.steelL);
   if(cracked){k.part(G.box,-4.5,.12,6.2,2.4,.06,1.6,.05,.4,0,P.solar,[0,6,.7]);k.part(G.box,-5.2,.1,-6.5,1.6,.06,1.1,.02,-.3,0,P.solar,[0,6,.7]);}}
  k.pop();});}
let api0=null;

// ------------------------------------------------------------------ REFUGE
function refuge(api,f){api0=api;const hi=!api.low,k=new Kit(),gl=new Glow(),dec=new Decal(api.ground),R=mulberry(1201);
 f.habitats.forEach((h,i)=>{const gy=api.ground(h.x,h.z);k.push(h.x,gy,h.z,0);habitat(k,gl,dec,i,hi,R);k.pop();dec.blob(h.x,h.z,9.6,9.6,.5);});
 f.processors.forEach((p,i)=>{const gy=api.ground(p.x,p.z);k.push(p.x,gy,p.z,0);oxygenTower(k,gl,p.artHeight,i,hi);k.pop();dec.blob(p.x,p.z,15,15,.55);});
 {const t=f.terminal,gy=api.ground(t.x,t.z);k.push(t.x,gy,t.z,0);supplyDepot(k,gl,dec,hi);k.pop();}
 solarField(k,f.solar,hi);
 // compound floodlight towers between the hab rows + a tall comms mast
 const towers=[[1099,1135,.6],[1165,1136,-.6],[1099,1211,2.5],[1166,1211,-2.5]];for(const [x,z,fa] of towers)floodTower(k,gl,x,api.ground(x,z),z,13.5,fa,hi);
 {const x=1121,z=1124,gy=api.ground(x,z);latticeMast(k,x,gy,z,26,1.2,.3,P.steelL,hi);k.part(G.ico0,x,gy+26.6,z,.25,.25,.25,0,0,0,P.red,[3,0,0]);gl.dot(x,gy+26.6,z,2.6,P.red,.9);k.part(G.cone8,x+.8,gy+22,z,1.3,.4,1.3,0,0,1.3,P.white,[0,0,.3]);}
 const warm=P.lampW,amber=P.lampA,cyan=P.cyan;
 setPools([[1099,1135,26,1.1,warm],[1165,1136,26,1.1,warm],[1099,1211,26,1.0,warm],[1166,1211,26,1.0,warm],[1174,1168,17,1.9,warm],[1174,1162,8,1.4,cyan],
  [1150,1080,20,.7,amber],[1180,1080,20,.7,amber],[1210,1080,20,.7,amber],[1132,1173,30,.35,amber]]);setCreep([]);
 const g=new T.Group();g.add(k.mesh(S.archMat));if(!gl.empty)g.add(gl.mesh());g.add(dec.mesh());return g;}

// ------------------------------------------------------------------ Parasite growths (shared by raid site, batteries, enemies)
function spike(k,x,y,z,dx,dy,dz,len,r,col,fx){const L=Math.hypot(dx,dy,dz);dx/=L;dy/=L;dz/=L;const mid=[x+dx*len*.45,y+dy*len*.45,z+dz*len*.45];
 k.beam([x,y,z],mid,r,col||P.carapace,fx||[0,7,.2],G.frustum6);k.beam(mid,[x+dx*len+(dy*.15),y+dy*len,z+dz*len],r*.62,col||P.carapace,fx||[0,7,.2],G.cone6);}
function pustules(k,gl,x,y,z,n,s,R,lowGlow){for(let i=0;i<n;i++){const a=R()*TAU,r=R()*s,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r,py=y+R()*s*.4,ps=.18+R()*.32*s;
  k.part(G.ico1,px,py,pz,ps,ps*.8,ps,0,0,0,R()<.5?P.pus:P.pusR,[2.6,0,0]);if(gl&&(!lowGlow||i%2===0))gl.dot(px,py,pz,ps*4.2,P.pus,.42);}}
function fleshMound(k,x,y,z,sx,sy,sz,R,n){for(let i=0;i<n;i++){const ox=(R()-.5)*sx,oz=(R()-.5)*sz,s=.5+R()*.6;k.part(G.ico1,x+ox,y+sy*.2*s,z+oz,sx*.32*s,sy*s,sz*.32*s,R()*.4,R()*TAU,0,R()<.6?P.flesh:P.fleshD,[0,7,.2]);}}
function creepTendrils(k,x,y,z,n,len,R,r0){for(let i=0;i<n;i++){const a=R()*TAU,pts=[];let px=x,pz=z,py=y;const steps=6;for(let s=0;s<=steps;s++){pts.push([px,py,pz]);const an=a+(R()-.5)*.9;px+=Math.cos(an)*len/steps;pz+=Math.sin(an)*len/steps;py=Math.max(api0?0:0,py*.55);}
  for(const p of pts)p[1]=(api0&&api0.ground?api0.ground(p[0],p[2]):0)+.12;k.tendril(pts,r0||.32,.06,P.fleshD,[0,7,.2]);}}

// ------------------------------------------------------------------ RAID SITE (Western Dust Switchback battery raid + Western Salvage Depot)
function gabionWall(k,o,R,hi,api){const gy=api.ground(o.x,o.z),alongX=o.width>=o.depth,len=alongX?o.width:o.depth,dep=alongX?o.depth:o.width,n=Math.max(1,Math.round(len/1.5)),rows=Math.max(1,Math.round(dep/1.5)),tiers=4,th=(o.height-.22)/tiers;
 k.push(o.x,gy,o.z,alongX?0:Math.PI/2);k.slab(0,-1.2,0,len,1.2,dep,P.khakiD,[0,2,.6]);
 for(let i=0;i<n;i++)for(let r=0;r<rows;r++)for(let t=0;t<tiers;t++){const x=-len/2+(i+.5)*len/n,z=-dep/2+(r+.5)*dep/rows,dmg=t===tiers-1&&R()<.22,hh=th-.03-(dmg?.4:0);
  k.part(G.box,x+(R()-.5)*.06,t*th+hh/2,z,len/n-.06,hh,dep/rows-.05,dmg?(R()-.5)*.2:0,(R()-.5)*.04,dmg?(R()-.5)*.15:0,P.khaki.clone().multiplyScalar(.75+R()*.32),[0,2,.5+(dmg?.4:0)]);}
 k.part(G.box,0,o.height-.1,0,len-.2,.22,dep-.2,0,0,0,P.khakiD,[0,3,.5]);k.pop();}
function parasiteInstallation(k,gl,b,R,hi,api){const gy=api.ground(b.x,b.z+8);k.push(b.x,gy,b.z+8,0);
 // old salvage depot bunker (18 x 12 x 12 shot box) with carapace overgrowth
 k.slab(0,-1,0,17.4,9.6,11.6,P.concreteD,[0,8,.75]);k.slab(0,8.6,0,18,.6,12,P.steelD,[0,5,.6]);
 for(const sx of [-1,1])k.slab(sx*5.5,-1,6.0,4.5,7,.5,P.steelD,[0,5,.7]);k.slab(-8.9,1.0,0,.2,5,4.2,P.black,[0,0,0]);
 for(let i=0;i<14;i++){const side=i%4,t=R();const x=side<2?(side?8.8:-8.8):(t-.5)*16,z=side>=2?(side===2?5.9:-5.9):(t-.5)*10,ry=side<2?Math.PI/2:0;
  k.part(G.box,x,2+R()*6,z,2.4+R()*2.5,2+R()*3.5,.7,(R()-.5)*.5,ry+(R()-.5)*.4,(R()-.5)*.5,R()<.5?P.flesh:P.carapace,[0,7,.25]);}
 fleshMound(k,0,9.2,0,14,2.2,9,R,hi?9:6);
 for(let i=0;i<(hi?11:7);i++){const x=(R()-.5)*14,z=(R()-.5)*8;spike(k,x,9.4,z,x*.06+(R()-.5)*.3,1,z*.08+(R()-.5)*.3,2.6+R()*3,.55+R()*.4);}
 pustules(k,gl,-8.6,4.5,-2,7,2.2,R,!hi);pustules(k,gl,-8.4,7.4,3,5,1.6,R,!hi);pustules(k,gl,2,10.2,-1,6,4,R,!hi);
 k.part(G.ico1,-9.0,3.4,0,.3,1.7,1.7,0,0,0,P.pusR,[3,0,0]);gl.dot(-9.6,3.4,0,5.5,P.pus,.65);
 // root apron filling the 22 x 16 solid box
 for(let i=0;i<22;i++){const t=i/22*TAU,x=Math.cos(t)*10.2,z=Math.sin(t)*7.3;k.part(G.ico1,x,.15,z,1.4+R(),.9+R()*.9,1.3+R()*.6,0,R()*TAU,0,R()<.5?P.flesh:P.fleshD,[0,7,.3]);}
 // collapsed depot container in the solid corner
 k.part(G.box,8.6,1.1,-5.6,5.5,2.4,2.2,0,.3,.18,P.cont2,[0,4,.8]);k.pop();
 // Parasite spire on the mast (r 2, 20 m)
 const m=b.mast,my=api.ground(m.x,m.z);let r=2.0,y=my-.5,tw=0;for(let s=0;s<9;s++){const h=2.3;k.part(G.frustum8,m.x+Math.sin(s*.9)*.25,y+h/2,m.z+Math.cos(s*.9)*.25,r,h,r,0,tw,0,s%2?P.carapace:P.flesh,[0,7,.25]);
  if(s%2===0)k.part(G.torus,m.x,y+h*.9,m.z,r*.92,r*.92,r*.92,Math.PI/2,0,0,P.carapaceL,[0,7,.2]);y+=h-.1;r*=.86;tw+=.35;}
 k.part(G.ico1,m.x,my+19.3,m.z,.95,1.4,.95,0,0,0,P.pus,[3.2,0,0]);gl.dot(m.x,my+19.3,m.z,7.5,P.pus,.8);gl.dot(m.x,my+19.3,m.z,2.6,P.lampW,.6);
 for(let i=0;i<6;i++){const a=i/6*TAU;spike(k,m.x+Math.cos(a)*1.4,my+8+i*1.7,m.z+Math.sin(a)*1.4,Math.cos(a),.5,Math.sin(a),2.4,.35);}
 pustules(k,gl,m.x,my+12,m.z,5,1.4,R,!hi);}
function wreckedEmplacement(k,gl,x,z,R,hi,api){const gy=api.ground(x,z);k.push(x,gy,z,.6);
 for(let s=0;s<14;s++){if(s===3||s===4)continue;const a=s/14*TAU;sandbagRow(k,Math.cos(a)*6.2,0,Math.sin(a)*6.2,2.6,.75,Math.PI/2-a,P.khakiD);}
 k.part(G.box,0,.9,0,4.2,1.6,6,.08,0,.14,P.oliveD,[0,5,.9]);k.part(G.box,.2,2.0,-.6,2.8,1.1,2.6,0,.4,.1,P.oliveD,[0,5,.9]);
 k.beam([.2,2.3,-.6],[4.6,5.6,-5.2],.42,P.steelD,[0,0,.8],G.cyl8);k.beam([4.6,5.6,-5.2],[5.3,5.2,-6.6],.3,P.steelD,[0,0,.9],G.cyl8);
 for(let i=0;i<9;i++)k.part(G.cyl8,(R()-.5)*8,.15,(R()-.5)*8,.12,.62,.12,Math.PI/2,R()*TAU,0,P.brass,[0,0,.2]);
 k.pop();fleshMound(k,x+1,gy,z+1,8,1.4,7,R,hi?6:4);creepTendrils(k,x,gy,z,hi?6:4,9,R,.28);pustules(k,gl,x+1.5,gy+1.6,z-.5,6,2.2,R,!hi);
 gl.dot(x-1,gy+1.2,z+.5,3.5,P.lampA,.55);}
function raidSite(api,f){api0=api;const hi=!api.low,k=new Kit(),gl=new Glow(),dec=new Decal(api.ground),R=mulberry(3301);
 for(const o of f.obstacles){gabionWall(k,o,R,hi,api);dec.blob(o.x,o.z,o.width/2+2.2,o.depth/2+2.2,.42);}
 // tendrils crawling over the cover walls (Parasite reclaimed the old human line)
 {const o=f.obstacles[0],gy=api.ground(o.x,o.z);for(let i=0;i<(hi?4:2);i++){const x=o.x-6+i*4.2;k.tendril([[x,gy+.1,o.z-4],[x+.3,gy+.3,o.z-2],[x+.5,gy+3.2,o.z-1.6],[x+.6,gy+5.15,o.z-.6],[x+.4,gy+5.2,o.z+.8],[x+.2,gy+3,o.z+1.6]],.3,.1,P.fleshD,[0,7,.2]);}
  pustules(k,gl,o.x-3,gy+5.1,o.z,3,.8,R,!hi);}
 parasiteInstallation(k,gl,f.installation,R,hi,api);dec.blob(f.installation.x,f.installation.z+8,14,10.5,.55);
 wreckedEmplacement(k,gl,f.raidArt.x,f.raidArt.z,R,hi,api);
 // battle debris between the walls and the depot (low, passable)
 for(let i=0;i<(hi?26:12);i++){const x=930+R()*60,z=925+R()*40,gy=api.ground(x,z);if(i%3===0)k.part(G.box,x,gy+.12,z,1.4+R()*1.8,.12,.6+R(),R()*.3,R()*TAU,R()*.3,P.steelD,[0,5,.8]);else k.part(G.cyl8,x,gy+.12,z,.1,.6,.1,Math.PI/2,R()*TAU,0,P.brass,[0,0,.2]);}
 const B=f.batteries,I=f.installation;
 setCreep([[I.x,I.z+8,36,1],[B[0].x,B[0].z,15,.95],[B[1].x,B[1].z,15,.95],[f.raidArt.x,f.raidArt.z,13,.85],[I.mast.x,I.mast.z,12,1]]);
 const pus=P.pus;setPools([[I.x-11,I.z+8,16,.9,pus],[I.mast.x,I.mast.z,14,1.1,pus],[B[0].x,B[0].z,10,.9,pus],[B[1].x,B[1].z,10,.9,pus],[f.raidArt.x,f.raidArt.z,8,.8,P.lampA]]);
 const g=new T.Group();g.add(k.mesh(S.archMat));if(!gl.empty)g.add(gl.mesh());g.add(dec.mesh());return g;}

// ------------------------------------------------------------------ ENEMIES: infested war machines (M3 silhouettes, Parasite skin + growths)
const PARASITE_PAINT={n:'Parasite',hull:'#2c2427',tur:'#3a2c2f',trim:'#b5532a'};
function addKitTree(k,obj,modelMats,tint){obj.updateWorldMatrix(true,true);const inv=new T.Matrix4().copy(obj.matrixWorld).invert();
 obj.traverse(o=>{if(!o.isMesh)return;const glow=o.material===modelMats.glow||(o.material&&o.material.isMeshBasicMaterial);const m=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld);
  k.add(o.geometry,m,null,glow?[2.4,0,0]:[0,5,.4],glow?P.pus:tint);});}
function bounds(k){let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<k.P.length;i+=3)for(let a=0;a<3;a++){mn[a]=Math.min(mn[a],k.P[i+a]);mx[a]=Math.max(mx[a],k.P[i+a]);}return {mn,mx};}
function enemy(api,e){if(!S.ready)prepareShared(api);if(e.immobile)return battery(api,e);const hi=!api.low,R=mulberry(e.cls==='titan'?71:53);
 const g=new T.Group(),body=new T.Group();body.rotation.y=-Math.PI/2;g.add(body);
 const H=M3.chassisKit(e.cls||'scout',0,PARASITE_PAINT,'#ff6a2a',[],false);const k=new Kit(false);addKitTree(k,M3.meshOf(M3.bake(H.k),null,api.modelMats),api.modelMats,lin('#c9b3b3'));
 const b=bounds(k),L=b.mx[0]-b.mn[0],Wd=b.mx[2]-b.mn[2],top=b.mx[1],gl=new Glow();
 // carapace plates over the hull, dorsal spikes raked back, pustule clusters on the flanks, tendrils over the track guards
 for(let i=0;i<5;i++){const x=b.mn[0]+L*(.2+i*.14),z=(R()-.5)*Wd*.4;k.part(G.ico1,x,top*.9,z,L*.09,top*.12,Wd*.18,0,R()*TAU,0,i%2?P.flesh:P.carapace,[0,7,.2]);}
 for(let i=0;i<(hi?5:3);i++){const x=b.mn[0]+L*(.1+i*.09),z=(i%2?-1:1)*Wd*(.12+.05*i);spike(k,x,top*.86,z,-1,.42,z*.25,L*.2,L*.035);}
 for(const sz of [-1,1]){pustules(k,gl,b.mn[0]+L*.35,top*.55,sz*Wd*.46,4,L*.07,R,!hi);
  k.tendril([[b.mn[0]+L*.15,top*.2,sz*Wd*.5],[b.mn[0]+L*.35,top*.7,sz*Wd*.47],[b.mn[0]+L*.6,top*.78,sz*Wd*.42],[b.mn[0]+L*.8,top*.45,sz*Wd*.5]],L*.03,L*.012,P.fleshD,[0,7,.2]);}
 k.box(b.mx[0]-L*.04,top*.62,0,L*.03,top*.07,Wd*.5,P.pusR,[3,0,0]);gl.dot(b.mx[0]+L*.02,top*.62,0,L*.22,P.pusR,.6);
 body.add(k.mesh(S.archMat));if(!gl.empty)body.add(gl.mesh());
 const gun=new T.Group();gun.position.y=H.meta.ty;gun.scale.setScalar(M3.weaponScale(e.arch,e.cls));const gk=new Kit(false);
 addKitTree(gk,M3.meshOf(M3.bake(M3.weaponKit(e.arch,0,PARASITE_PAINT,'#ff6a2a',false,e.cls).k),null,api.modelMats),api.modelMats,lin('#c9b3b3'));
 const gb=bounds(gk);for(let i=0;i<3;i++){const x=gb.mn[0]+(gb.mx[0]-gb.mn[0])*(.15+i*.1);spike(gk,x,gb.mx[1]*.9,(i-1)*.12,-.8,1,(i-1)*.3,.28,.05);}
 gk.part(G.ico1,gb.mn[0]+(gb.mx[0]-gb.mn[0])*.3,gb.mx[1]*.7,0,.16,.12,.16,0,0,0,P.pus,[2.6,0,0]);gun.add(gk.mesh(S.archMat));body.add(gun);
 // hostile marker (same height as today's red cone): Parasite eye diamond
 const mk=new Kit(false);mk.part(G.oct,0,5,0,.42,.7,.42,0,0,0,P.pusR,[2.6,0,0]);const marker=mk.mesh(S.archMat);g.add(marker);const mg=new Glow();mg.dot(0,5,0,1.4,P.pusR,.55);g.add(mg.mesh());
 g.userData.gun=gun;g.userData.marker=marker;g.scale.setScalar(1.65);return g;}
// Plasma battery = infested anti-air artillery with a glowing maw. ~7 x 6 m base, ~10 m tall, marker at 11 m.
function battery(api,e){const hi=!api.low,R=mulberry(911),g=new T.Group(),k=new Kit(false),gl=new Glow();
 k.part(G.ico1,0,1.25,0,3.0,1.75,2.6,0,0,0,P.carapace,[0,7,.3]);k.part(G.ico1,0,.5,0,3.4,.9,2.9,0,.4,0,P.fleshD,[0,7,.4]);
 for(let i=0;i<6;i++){const a=i/6*TAU+.5,sx=Math.cos(a),sz=Math.sin(a),kx=sx*2.6,kz=sz*2.3;k.beam([sx*1.8,1.6,sz*1.5],[kx*1.05,2.8,kz*1.05],.36,P.carapaceL,[0,7,.2],G.cyl6);k.beam([kx*1.05,2.8,kz*1.05],[sx*3.35,0,sz*2.9],.28,P.carapace,[0,7,.2],G.cone6);}
 for(let i=0;i<(hi?7:4);i++){const a=R()*TAU;spike(k,Math.cos(a)*1.6,2.2,Math.sin(a)*1.3,Math.cos(a)*.6,1,Math.sin(a)*.6,1.6+R()*1.3,.3);}
 pustules(k,gl,1.2,2.2,1.0,4,.9,R,!hi);pustules(k,gl,-1.4,2.0,-.8,4,.9,R,!hi);
 k.part(G.oct,0,11,0,.45,.75,.45,0,0,0,P.pusR,[2.6,0,0]);gl.dot(0,11,0,1.6,P.pusR,.55);
 g.add(k.mesh(S.archMat));if(!gl.empty)g.add(gl.mesh());
 // turret head + ribbed AA barrel (elevated ~60°), maw at the tip
 const gun=new T.Group();gun.position.y=3.1;const gk=new Kit(false),gg=new Glow();gk.part(G.ico1,0,.3,0,1.7,1.35,1.9,0,0,0,P.carapaceL,[0,7,.3]);gk.part(G.ico1,0,.9,-.7,1.2,.9,1.3,-.3,0,0,P.flesh,[0,7,.3]);
 const el=1.05,dir=[0,Math.sin(el),Math.cos(el)],len=6.4;for(let s=0;s<8;s++){const t0=s/8,t1=(s+1)/8,r=.62-.2*t0;gk.beam([0,.6+dir[1]*len*t0,dir[2]*len*t0],[0,.6+dir[1]*len*t1,dir[2]*len*t1],r,s%2?P.carapace:P.carapaceL,[0,7,.2],G.cyl8);}
 const tip=[0,.6+dir[1]*len,dir[2]*len];gk.part(G.torus,tip[0],tip[1],tip[2],.62,.62,.62,-el,0,0,P.pus,[2.8,0,0]);gk.part(G.cyl8,tip[0],tip[1]-.05,tip[2]-.03,.42,.12,.42,el-Math.PI/2,0,0,P.lampA,[3.2,0,0]);
 gg.dot(tip[0],tip[1]+.25,tip[2]+.15,3.4,P.pus,.85);gg.dot(tip[0],tip[1]+.25,tip[2]+.15,1.2,P.lampW,.8);
 for(let i=0;i<3;i++)spike(gk,(i-1)*.7,1.2,-1.1,(i-1)*.3,.6,-1,1.5,.22);
 gun.add(gk.mesh(S.archMat));if(!api.low)gun.add(gg.mesh());g.add(gun);g.userData.gun=gun;g.userData.marker=g.children[0];return g;}

// ------------------------------------------------------------------ PLAYER TANK: grime/dust response, contact shadow, headlights
function grimeMaterial(src){if(!S.grime)S.grime=new Map();if(S.grime.has(src.uuid))return S.grime.get(src.uuid);if(src.isMeshBasicMaterial){S.grime.set(src.uuid,src);return src;}
 const m=src.clone();if('envMapIntensity' in m)m.envMapIntensity=(src.envMapIntensity??1)*.45;
 m.onBeforeCompile=sh=>{sh.uniforms.uNoise={value:S.noise};sh.uniforms.uTankBase=S.tankU.base;sh.uniforms.uTankUp=S.tankU.up;sh.uniforms.uDust={value:lin('#8b847b')};
  sh.vertexShader=inject(sh.vertexShader,'#include <common>','varying vec3 vCqWP;varying vec3 vCqWN;');
  sh.vertexShader=inject(sh.vertexShader,'#include <project_vertex>','vCqWP=(modelMatrix*vec4(transformed,1.0)).xyz;vCqWN=normalize(mat3(modelMatrix)*objectNormal);');
  sh.fragmentShader=inject(sh.fragmentShader,'#include <common>','uniform sampler2D uNoise;uniform vec3 uTankBase;uniform vec3 uTankUp;uniform vec3 uDust;varying vec3 vCqWP;varying vec3 vCqWN;');
  sh.fragmentShader=inject(sh.fragmentShader,'#include <color_fragment>',`{float hh=dot(vCqWP-uTankBase,uTankUp);vec4 nz=texture2D(uNoise,(vCqWP.xz+vCqWP.y)*0.9);vec4 nb=texture2D(uNoise,(vCqWP.xz-vCqWP.yy)*0.21);
 float low=1.0-smoothstep(0.35,1.25+0.3*nb.g,hh);diffuseColor.rgb*=mix(1.0,0.58,low*0.8);diffuseColor.rgb=mix(diffuseColor.rgb,uDust*0.55,low*smoothstep(0.35,0.75,nz.g)*0.75);
 float topd=smoothstep(0.55,0.95,vCqWN.y)*smoothstep(0.35,0.8,nb.r);diffuseColor.rgb=mix(diffuseColor.rgb,uDust,topd*0.32);
 float scorch=smoothstep(0.62,0.8,nb.g)*0.35;diffuseColor.rgb*=1.0-scorch;}`);
  if(sh.fragmentShader.includes('#include <roughnessmap_fragment>'))sh.fragmentShader=inject(sh.fragmentShader,'#include <roughnessmap_fragment>','roughnessFactor=min(1.0,roughnessFactor+0.25);');};
 m.customProgramCacheKey=()=>'cq-c-grime-'+src.type;S.grime.set(src.uuid,m);return m;}
function playerTank(api,vehicle){if(!S.ready)prepareShared(api);S.tankU=S.tankU||{base:{value:new T.Vector3()},up:{value:new T.Vector3(0,1,0)}};
 vehicle.traverse(o=>{if(o.isMesh&&o.material){o.material=Array.isArray(o.material)?o.material.map(grimeMaterial):grimeMaterial(o.material);}});
 const dec=new Decal(null);dec.blob(0,.15,1.55,2.15,.62);const shadow=dec.mesh();shadow.position.y=.0;vehicle.add(shadow);
 const meta=vehicle.userData.chassis||{},body=vehicle.userData.body,gl=new Glow();
 for(const h of meta.halos||[]){gl.dot(h[0]+.08,h[1],h[2],.55,P.lampW,1.2);gl.dot(h[0]+.12,h[1],h[2],1.5,P.lampW,.35);}
 const tr=meta.track||[1.06,.25,.27];gl.dot(-1.3,.62,.78,.28,P.red,.9);gl.dot(-1.3,.62,-.78,.28,P.red,.9);void tr;
 if(body&&!gl.empty)body.add(gl.mesh());S.tankVehicle=vehicle;return vehicle;}

// ------------------------------------------------------------------ PROPS: war debris replaces trees, shattered boulders, battered masts
function propGeometries(low){const out={};
 {const k=new Kit(false);k.cyl(0,-.1,0,.95,.06,P.ash,[0,0,.6],G.cyl12);k.part(G.cone6,0,.15,0,.26,.35,.26,0,0,0,P.char,[0,0,.7]);
  k.beam([0,0,0],[.12,1.35,.05],.15,P.char,[0,0,.8],G.frustum6);k.beam([.05,.7,0],[.42,1.05,.15],.05,P.char,[0,0,.8],G.cyl6);k.beam([.08,1.0,0],[-.3,1.3,-.1],.04,P.char,[0,0,.8],G.cyl6);
  k.beam([.1,1.2,.03],[.25,1.48,-.2],.035,P.char,[0,0,.8],G.cyl6);k.beam([.4,.05,.5],[1.1,.12,.75],.08,P.char,[0,0,.8],G.cyl6);k.part(G.ico0,-.5,.06,.4,.18,.1,.16,0,0,0,P.char);k.part(G.ico0,.6,.05,-.45,.14,.08,.12,0,0,0,P.ash);
  if(!low){k.beam([-.1,.02,-.3],[-.9,.1,-.7],.06,P.char,[0,0,.8],G.cyl6);k.beam([.02,.5,0],[-.35,.62,.25],.04,P.char,[0,0,.8],G.cyl6);}
  out.sapling=k.geometry();}
 {const k=new Kit(false);k.part(G.box,0,.18,0,2.0,.08,1.25,.12,.3,.05,P.solar,[0,6,.5]);k.part(G.box,0,.16,0,2.1,.05,1.35,.12,.3,.05,P.steelL);
  k.part(G.box,-.9,.2,.6,1.1,.06,.7,.4,1.1,.3,P.steelD,[0,5,.7]);k.part(G.box,.8,.28,-.5,.9,.05,.6,-.5,.4,.2,P.rust,[0,0,.6]);
  for(let i=0;i<5;i++)k.part(G.cyl8,-.6+i*.3,.07,.95+(i%2)*.2,.075,.5,.075,Math.PI/2,.3+i*.6,0,P.brass,[0,0,.15]);
  k.slab(.9,0,.7,.7,.38,.45,P.olive,[0,4,.4],.4);k.beam([-.3,0,-.7],[.2,.7,-.9],.04,P.rust,null,G.cyl6);
  if(low){k.part(G.cone6,1.3,.15,-.9,.2,.3,.2,0,0,0,P.char);k.beam([1.3,0,-.9],[1.4,1.1,-.85],.1,P.char,[0,0,.8],G.frustum6);}
  out.scrap=k.geometry();}
 {const k=new Kit(false);latticeMast(k,0,0,0,11.5,.55,.18,P.steelL,!low);k.part(G.cone8,.55,9.4,0,1.3,.35,1.3,0,0,1.25,P.white,[0,0,.4]);k.part(G.box,-.5,8.2,.3,.9,.6,.08,0,.5,.2,P.steelD);
  k.part(G.ico0,0,11.85,0,.14,.14,.14,0,0,0,P.red,[3,0,0]);for(const a of [0,2.1,4.2])k.slab(Math.cos(a)*3.5,-.2,Math.sin(a)*3.5,.35,.4,.35,P.concreteD);out.relay=k.geometry();}
 {const k=new Kit(false);k.aoTop=1.2;k.part(G.dode,0,.42,0,1.18,.95,.78,.2,.3,.1,P.rock,[0,0,.35]);k.part(G.ico0,.95,.32,.35,.52,.6,.5,.4,1.2,.2,P.rockD,[0,0,.3]);
  k.part(G.ico0,-1.05,.25,-.25,.55,.5,.45,1,.2,.6,P.rock,[0,0,.3]);k.part(G.tet,.35,.95,-.1,.38,.28,.32,.4,.9,.2,P.rockD);
  for(const [x,z,s] of [[1.6,-.4,.18],[-1.7,.5,.16],[.4,.95,.2],[-.6,-.8,.14],[2.0,.5,.12]])k.part(G.ico0,x,s*.5,z,s,s*.8,s,x,z,0,P.rockD);out.rock=k.geometry();}
 return out;}
function props(api,items,chunk){if(!S.ready)prepareShared(api);const low=api.low,group=new T.Group(),ox=chunk.cx*128,oz=chunk.cz*128;
 const trees=items.filter(p=>p.kind==='tree'),relays=items.filter(p=>p.kind==='relay'),rocks=items.filter(p=>p.kind==='rock'&&p.variant>.45);
 const sets=low?[[trees,S.props.scrap,'tree'],[relays,S.props.relay,'relay'],[rocks,S.props.rock,'rock']]
  :[[trees.filter(p=>p.variant>=.4),S.props.sapling,'tree'],[trees.filter(p=>p.variant<.4),S.props.scrap,'tree'],[relays,S.props.relay,'relay'],[rocks,S.props.rock,'rock']];
 for(const [list,geo,kind] of sets){if(!list.length)continue;const mesh=new T.InstancedMesh(geo,S.archMat,list.length);
  list.forEach((p,i)=>{_o.position.set(p.x-ox,p.y,p.z-oz);_o.rotation.set(0,0,0);let tone=1;
   if(kind==='tree'){const s=.75+p.size*.22;_o.scale.set(s,Math.min(1.08,.8+p.size*.08),s);_o.rotation.y=p.variant*37;tone=.85+(p.variant*7%1)*.3;}
   else if(kind==='relay'){_o.scale.set(1,1,1);_o.rotation.set((p.variant-.5)*.08,p.variant*20,(p.variant-.45)*.12);}
   else{const s=p.size;_o.scale.set(s,s*(.8+p.variant)/1.3,s);_o.rotation.y=p.variant>.7?Math.PI:0;_o.position.y=p.y-.05*s;tone=.8+(p.size*3.7%1)*.35;}
   _o.updateMatrix();mesh.setMatrixAt(i,_o.matrix);mesh.setColorAt(i,_c.setRGB(tone,tone,tone*.98));});
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);}
 return group;}
function propLineup(api,L){api0=api;if(!S.ready)prepareShared(api);const g=new T.Group(),dir=[Math.sin(L.heading),Math.cos(L.heading)],side=[dir[1],-dir[0]];
 const items=[['sapling',{size:2.2,variant:.6}],['scrap',{size:2.4,variant:.2}],['rock',{size:1.3,variant:.62}],['sapling',{size:3.2,variant:.9}],['relay',{size:1.3,variant:.5}],['rock',{size:2.6,variant:.95}],['scrap',{size:3.4,variant:.1}]];
 items.forEach(([kind,p],i)=>{const d=2+i*5.2,s=(i%2?1:-1)*1.6,x=L.x+dir[0]*d+side[0]*s,z=L.z+dir[1]*d+side[1]*s,y=api.ground(x,z);
  const mesh=new T.Mesh(S.props[kind],S.archMat);mesh.position.set(x,y,z);
  if(kind==='rock'){mesh.scale.set(p.size,p.size*(.8+p.variant)/1.3,p.size);}else if(kind==='relay'){mesh.rotation.z=.05;}else{const sc=.75+p.size*.22;mesh.scale.set(sc,Math.min(1.08,.8+p.size*.08),sc);mesh.rotation.y=i;}
  g.add(mesh);});
 const k=new Kit(false);for(let i=0;i<7;i++){const d=2+i*5.2,s=(i%2?1:-1)*1.6;void d;void s;}void k;
 return api.merge?mergeLineup(g):g;}
function mergeLineup(g){return g;}

// ------------------------------------------------------------------ per-frame
function update(api,dt,t){if(S.sky){S.sky.position.copy(api.camera.position);S.stars.position.copy(api.camera.position);if(!S.earthPlaced)placeEarth(api);}
 if(S.terrainU)S.terrainU.uTime.value=t;if(S.archU)S.archU.uTime.value=t;
 if(S.tankVehicle&&S.tankU){const v=S.tankVehicle;v.updateWorldMatrix(true,false);const e=v.matrixWorld.elements;S.tankU.base.value.set(e[12],e[13],e[14]);S.tankU.up.value.set(e[4],e[5],e[6]).normalize();
  if(S.terrainU&&!S.tankPool){const fwd=new T.Vector3(e[8],e[9],e[10]).normalize(),wx=e[12]+fwd.x*7+api.origin.x,wz=e[14]+fwd.z*7+api.origin.z;const U=S.terrainU;for(let i=9;i>=0;i--)if(U.uPool.value[i].w===0){U.uPool.value[i].set(wx,wz,7.5,1.5);U.uPoolC.value[i].copy(P.lampW);break;}S.tankPool=true;}}}

// ------------------------------------------------------------------ MAP (filled below)
let mapImpl=null;
LAB.register({id:'c',name:'IRON SIEGE · WAR-TORN FRONT',summary:'Lunar war diorama: black sky with hazy Earth, low warm sun, shell-cratered scorched regolith, HESCO-walled armoured habs under floodlights, war-debris clutter, Parasite creep and pustule spires, military tactical paper map.',
 async prepare(api){prepareShared(api);},
 environment,terrainMaterial:api=>{prepareShared(api);return S.terrainMat;},props,refuge,raidSite,playerTank,enemy,propLineup,update,
 get mapCss(){return MAP_CSS;},get mapLegend(){return MAP_LEGEND;},
 map(ctx,m){return mapImpl(ctx,m);}});
let MAP_CSS='',MAP_LEGEND='';
mapImpl=function(ctx,m){ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle='#c9c0a0';ctx.fillRect(0,0,360,420);};
})(globalThis);
