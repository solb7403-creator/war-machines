/* LUNAR: War Machines — Conquest style lab · Phase 1 option A · "TRANQUILITY · HARD-SCI REALISM".
 * Dev-only sample for dev/conquest-style/lab.html (never loaded by the game). Apollo surface photography + Artemis
 * base concepts, turned into a war zone. All art is original and procedural: textures are generated in JS at load
 * (no downloads), geometry is built from primitives and merged into a few vertex-coloured draws.
 *
 * Fixed material set (shared, created once per page, never cloned per object, no programs after load):
 *   terrain  MeshLambert + onBeforeCompile ('tq-terrain'): tileable crater/regolith detail texture sampled in world
 *            space (3 scales HIGH, 2 LOW) for normals + albedo, slope rock, darker sintered terraformed biome,
 *            partial lunar (Lommel-Seeliger) photometry. Receives the single shadow map on HIGH.
 *   arch     MeshPhong (HIGH) / MeshLambert (LOW), vertex colours + per-vertex attribute fx=(emissive, specular);
 *            fx.x in (1,2] pulses (Parasite fissures). Used by every structure, prop (instanced) and enemy.
 *   fx       MeshBasic + map + RGBA vertex colours (one program): light pools, beams, cracks, contact/long shadows, Earth.
 *   stars    PointsMaterial (fixed px) · halos PointsMaterial (world-sized additive glow billboards).
 * Earth: fixed in the sky (it does not move in the lunar sky); the lab places it per subject so it is in frame.
 */
(function(root){
'use strict';
const LAB=root.ConquestStyleLab,W=root.ConquestWorld,C=root.ConquestCombat;
let T=root.THREE;
const PI=Math.PI,TAU=PI*2,DEG=PI/180;
// ---------- light design: harsh low sun from the west-north-west ----------
const SUN_AZ=250*DEG,SUN_EL=17*DEG;  // azimuth from +Z toward +X; elevation above the horizon
const SUN=[Math.sin(SUN_AZ)*Math.cos(SUN_EL),Math.sin(SUN_EL),Math.cos(SUN_AZ)*Math.cos(SUN_EL)];
const SHD=(()=>{const l=Math.hypot(SUN[0],SUN[2]);return [-SUN[0]/l,-SUN[2]/l];})(),SHD_ANG=Math.atan2(SHD[0],SHD[1]),TAN_EL=Math.tan(SUN_EL);
const SHADOW_FRAME={refuge:{x:1190,z:1140,r:165,h:150},raid:{x:950,z:945,r:80,h:24},tank:{x:1104,z:1124,r:13,h:6},enemy:{x:1292,z:786,r:13,h:12},props:{x:1183,z:1014,r:52,h:16}};
const EARTH_AT={refuge:{az:9.5,k:.62},raid:{az:5,k:.5},tank:{az:-4,k:.55},enemy:{az:4,k:.55},props:{az:5,k:.55}};

// ---------- small helpers ----------
function rng(seed){let s=seed>>>0;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const clamp=(v,a,b)=>v<a?a:v>b?b:v,smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
const ground=(x,z)=>W.groundAt(x,z);
const CC=new Map();const col=h=>{let c=CC.get(h);if(!c)CC.set(h,c=new T.Color(h));return c;};
const tone=(c,k)=>new T.Color(c.r*k,c.g*k,c.b*k);
const BLACK=()=>col(0x000000);
const V1=new T.Vector3(),V2=new T.Vector3(),TMP=new T.Object3D(),QY=new T.Vector3(0,1,0),QQ=new T.Quaternion();
function mtx(x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,order='XYZ'){TMP.position.set(x,y,z);TMP.rotation.set(rx,ry,rz,order);TMP.scale.set(sx,sy,sz);TMP.updateMatrix();return TMP.matrix.clone();}
const G={};const geo=(k,f)=>G[k]||(G[k]=f());
const BOX=()=>geo('box',()=>new T.BoxGeometry(1,1,1));
const CYL=(n=12,t=1,b=1,open=false)=>geo('cyl'+n+'/'+t+'/'+b+open,()=>new T.CylinderGeometry(t,b,1,n,1,open));
const SPH=(w=12,h=8)=>geo('sph'+w+'x'+h,()=>new T.SphereGeometry(1,w,h));
const CONE=(n=8)=>geo('cone'+n,()=>new T.ConeGeometry(1,1,n));
const OCT=()=>geo('oct',()=>new T.OctahedronGeometry(1,0));
function nrm(a,b,c){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];}

// Kit: merges primitives into ONE vertex-coloured geometry with the fx attribute (emissive, specular).
class Kit{
 constructor(){this.p=[];this.n=[];this.c=[];this.f=[];this.i=[];this.frame=null;}
 add(g,m,c,e=0,s=0,fn=null){const pa=g.attributes.position,na=g.attributes.normal,ca=g.attributes.color,fa=g.attributes.fx,base=this.p.length/3,M=this.frame?new T.Matrix4().multiplyMatrices(this.frame,m):m,N=new T.Matrix4().copy(M).invert().transpose();
  for(let k=0;k<pa.count;k++){V1.fromBufferAttribute(pa,k).applyMatrix4(M);V2.fromBufferAttribute(na,k).transformDirection(N);this.p.push(V1.x,V1.y,V1.z);this.n.push(V2.x,V2.y,V2.z);
   if(c===null){this.c.push(ca.getX(k),ca.getY(k),ca.getZ(k));this.f.push(fa?fa.getX(k):0,fa?fa.getY(k):0);continue;}
   const r=fn?fn(V1,V2,k):null;if(r&&!r.isColor){const cc=r.c||c;this.c.push(cc.r,cc.g,cc.b);this.f.push(r.e!=null?r.e:e,r.s!=null?r.s:s);}else{const cc=r||c;this.c.push(cc.r,cc.g,cc.b);this.f.push(e,s);}}
  if(g.index){const ix=g.index.array;for(let k=0;k<ix.length;k++)this.i.push(base+ix[k]);}else for(let k=0;k<pa.count;k++)this.i.push(base+k);return this;}
 quad(a,b,c,d,na,nb,nc,nd,cl,e=0,s=0){const base=this.p.length/3;for(const [v,n] of [[a,na],[b,nb],[c,nc],[d,nd]]){this.p.push(v[0],v[1],v[2]);this.n.push(n[0],n[1],n[2]);this.c.push(cl.r,cl.g,cl.b);this.f.push(e,s);}this.i.push(base,base+1,base+2,base,base+2,base+3);}
 geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.n,3));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.setAttribute('fx',new T.Float32BufferAttribute(this.f,2));g.setIndex(this.i);g.computeBoundingSphere();return g;}
 mesh(mat){return new T.Mesh(this.geometry(),mat||M.arch);}
}
// hexahedron from 8 corners (bottom 0-3, top 4-7 above them), flat shaded, faces oriented outward automatically
function hexa(k,P,c,e=0,s=0){const F=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],ct=[0,0,0];for(const p of P){ct[0]+=p[0]/8;ct[1]+=p[1]/8;ct[2]+=p[2]/8;}
 for(const f of F){let q=f.map(i=>P[i]),n=nrm(q[0],q[1],q[2]);const fc=[(q[0][0]+q[2][0])/2-ct[0],(q[0][1]+q[2][1])/2-ct[1],(q[0][2]+q[2][2])/2-ct[2]];if(n[0]*fc[0]+n[1]*fc[1]+n[2]*fc[2]<0){q=[q[0],q[3],q[2],q[1]];n=[-n[0],-n[1],-n[2]];}k.quad(q[0],q[1],q[2],q[3],n,n,n,n,c,e,s);}}
// leaning tapered slab: base centre (cx,y0,cz), width w (local x), depth d (local z), height h, yaw ang, top shifted by lean along local z
function slab(k,cx,y0,cz,w,d,h,ang,lean,taper,c,e=0,s=0){const ca=Math.cos(ang),sa=Math.sin(ang),P=[];for(const [yy,ww,dd,off] of [[0,w,d,0],[h,w*taper,d*taper,lean]])for(const [ix,iz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const lx=ix*ww/2,lz=iz*dd/2+off;P.push([cx+lx*ca+lz*sa,y0+yy,cz-lx*sa+lz*ca]);}hexa(k,P,c,e,s);}
// tapered ground wedge from p0 (tall) to p1 (low)
function wedge(k,p0,p1,w0,w1,h0,h1,c,e=0,s=0,sink=.4){const dx=p1[0]-p0[0],dz=p1[2]-p0[2],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;
 hexa(k,[[p0[0]+nx*w0/2,p0[1]-sink,p0[2]+nz*w0/2],[p0[0]-nx*w0/2,p0[1]-sink,p0[2]-nz*w0/2],[p1[0]-nx*w1/2,p1[1]-sink,p1[2]-nz*w1/2],[p1[0]+nx*w1/2,p1[1]-sink,p1[2]+nz*w1/2],
  [p0[0]+nx*w0*.28,p0[1]+h0,p0[2]+nz*w0*.28],[p0[0]-nx*w0*.28,p0[1]+h0,p0[2]-nz*w0*.28],[p1[0]-nx*w1*.22,p1[1]+h1,p1[2]-nz*w1*.22],[p1[0]+nx*w1*.22,p1[1]+h1,p1[2]+nz*w1*.22]],c,e,s);}
function beam(k,a,b,t,c,e=0,s=0,g){const d=new T.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),L=d.length()||1e-3;QQ.setFromUnitVectors(QY,d.multiplyScalar(1/L));k.add(g||BOX(),new T.Matrix4().compose(new T.Vector3((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2),QQ,new T.Vector3(t,L,t)),c,e,s);}

// Fx: RGBA-vertex-coloured, uv-mapped quads for the fx program (pools, beams, cracks, shadows, Earth).
class Fx{
 constructor(){this.p=[];this.c=[];this.u=[];this.i=[];}
 grid(nu,nv,at,c){const b=this.p.length/3;for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const q=at(i/nu,j/nv);this.p.push(q[0],q[1],q[2]);this.u.push(q[3],q[4]);this.c.push(c.r,c.g,c.b,q[5]);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=b+j*(nu+1)+i,d=a+nu+1;this.i.push(a,d,a+1,a+1,d,d+1);}return this;}
 mesh(mat,order=2){if(!this.i.length)return null;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.u,2));g.setAttribute('color',new T.Float32BufferAttribute(this.c,4));g.setIndex(this.i);g.computeBoundingSphere();const m=new T.Mesh(g,mat);m.renderOrder=order;return m;}
}
// ground decal draped on the terrain. mode 'disc' (centred radial), 'shadow' (starts at centre, fades along), 'line' (thin, fades along)
function drape(fx,cx,cz,len,wid,ang,c,a,o={}){const nu=o.nu||6,nv=o.nv||6,lift=o.lift!=null?o.lift:.14,mode=o.mode||'disc',sa=Math.sin(ang),ca=Math.cos(ang),gy=o.flat!=null?()=>o.flat:ground;
 fx.grid(nu,nv,(u,v)=>{const al=mode==='disc'?(v-.5)*len:v*len,ac=(u-.5)*wid,x=cx+sa*al+ca*ac,z=cz+ca*al-sa*ac;return [x,gy(x,z)+lift,z,u,mode==='disc'?v:mode==='shadow'?.5+.5*v:.5,a*(mode==='line'?1-v*(o.fade!=null?o.fade:.9):1)];},c);}
class FxView{constructor(fx,off){this.fx=fx;this.off=off;}grid(nu,nv,at,c){return this.fx.grid(nu,nv,(u,v)=>{const q=at(u,v);q[3]=q[3]*.5+this.off;return q;},c);}}
class Halo{
 constructor(){this.s=new Map();}
 add(size,x,y,z,c,k=1){size=M.low?2.4:HSZ.reduce((a,b)=>Math.abs(b-size)<Math.abs(a-size)?b:a);let s=this.s.get(size);if(!s)this.s.set(size,s={p:[],c:[]});s.p.push(x,y,z);s.c.push(c.r*k,c.g*k,c.b*k);return this;}
 objects(){const out=[];for(const [size,s] of this.s){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(s.p,3));g.setAttribute('color',new T.Float32BufferAttribute(s.c,3));g.computeBoundingSphere();const p=new T.Points(g,haloMat(size));p.renderOrder=4;p.frustumCulled=false;out.push(p);}return out;}
}
const HM=new Map(),HSZ=[.8,1.7,3.2,6.8];
function haloMat(size){let m=HM.get(size);if(!m){m=new T.PointsMaterial({size:size*1.92,sizeAttenuation:true,map:TEX.glow,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false});HM.set(size,m);}return m;}
function addAll(g,list){for(const o of list)if(o)g.add(o);}

// ---------- procedural textures ----------
const TEX={},M={},U={pulse:{value:1}},SKY={},FIELD={},LIVE={decals:[],fin:false};
// Tileable crater field in tile units (heights ~ self-similar, so slopes are scale-invariant): H height, A albedo, O cavity.
function craterField(N){
 if(FIELD[N])return FIELD[N];
 const H=new Float32Array(N*N),A=new Float32Array(N*N),O=new Float32Array(N*N);let seed=7;
 for(const [f,amp,aa] of [[6,.06,.05],[12,.05,.035],[24,.04,.03],[48,.03,.02],[96,.022,.012],[192,.016,0]]){const r=rng(seed++),g=new Float32Array(f*f),h=amp/f;for(let i=0;i<f*f;i++)g[i]=r()-.5;
  for(let y=0;y<N;y++){const fy=y*f/N,y0=fy|0,ty=fy-y0,sy=ty*ty*(3-2*ty),r0=(y0%f)*f,r1=((y0+1)%f)*f;for(let x=0;x<N;x++){const fx=x*f/N,x0=fx|0,tx=fx-x0,sx=tx*tx*(3-2*tx),c0=x0%f,c1=(x0+1)%f,a=g[r0+c0],b=g[r0+c1],c=g[r1+c0],d=g[r1+c1],v=a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy,i=y*N+x;H[i]+=v*h;A[i]+=v*aa;}}}
 const r=rng(1969),rmin=3/512,rmax=.115,q2=(rmin/rmax)**2;
 for(let k=0;k<640;k++){
  const rad=rmin/Math.sqrt(1-r()*(1-q2)),cx=r()*N,cz=r()*N,fresh=r()**1.6,blast=r()<.18,rays=6+(r()*9|0),ph=r()*TAU,wob=r()*TAU,rp=rad*N;if(rp<.9)continue;
  const depth=rad*(.17+.25*fresh),rim=depth*(.1+.22*fresh),reach=blast?3.4:2.4,R=Math.ceil(rp*reach)+1,ix0=Math.floor(cx),iz0=Math.floor(cz),ao=(.3+.4*fresh)*Math.min(1,rp/5);
  for(let dz=-R;dz<=R;dz++){const pz=iz0+dz,zz=(pz+.5-cz)/rp,iz=((pz%N)+N)%N;for(let dx=-R;dx<=R;dx++){const px=ix0+dx,xx=(px+.5-cx)/rp,q=Math.sqrt(xx*xx+zz*zz);if(q>reach)continue;const i=iz*N+((px%N)+N)%N;
   if(q<1){H[i]+=rim-depth*(1-q*q);O[i]-=(1-q*q)*ao;if(fresh>.6)A[i]+=.05;}else if(q<3)H[i]+=rim*(1/(q*q*q)-1/27)*1.0385;
   if(fresh>.72&&q>.85&&q<2.2)A[i]+=.17*(fresh-.72)/.28*(1-(q-.85)/1.35);
   if(blast){if(q>.8){const th=Math.atan2(zz,xx),ray=Math.max(0,Math.cos(rays*th+.7*Math.sin(3*th+wob)+ph));A[i]-=.36*ray*ray*ray*Math.max(0,1-(q-.8)/(reach-.8));}if(q<1.05)A[i]-=.13;}}}}
 const S=new Float32Array(N*N*2);for(let z=0;z<N;z++)for(let x=0;x<N;x++){const i=z*N+x;S[i*2]=(H[z*N+(x+1)%N]-H[z*N+(x-1+N)%N])*N/2;S[i*2+1]=(H[((z+1)%N)*N+x]-H[((z-1+N)%N)*N+x])*N/2;}
 return FIELD[N]={N,H,A,O,S};}
function fieldTexture(F,low){const N=F.N,d=new Uint8Array(N*N*4);for(let i=0;i<N*N;i++){d[i*4]=clamp(128+F.S[i*2]*89,0,255);d[i*4+1]=clamp(128+F.S[i*2+1]*89,0,255);d[i*4+2]=clamp(128+F.A[i]*255,0,255);d[i*4+3]=clamp((1+F.O[i])*255,0,255);}
 const t=new T.DataTexture(d,N,N,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=low?1:4;t.needsUpdate=true;return t;}
function decalAtlas(){const cv=document.createElement('canvas');cv.width=128;cv.height=64;const x=cv.getContext('2d');for(const [cx,stops] of [[32,[[0,1],[.6,.97],[.84,.55],[1,0]]],[96,[[0,1],[.18,.78],[.45,.26],[.75,.07],[1,0]]]]){const g=x.createRadialGradient(cx,32,0,cx,32,31);for(const [o,a] of stops)g.addColorStop(o,'rgba(255,255,255,'+a+')');x.fillStyle=g;x.fillRect(cx-32,0,64,64);}return new T.CanvasTexture(cv);}
function radialTex(stops){const S=64,cv=document.createElement('canvas');cv.width=cv.height=S;const x=cv.getContext('2d'),g=x.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);for(const [o,a] of stops)g.addColorStop(o,'rgba(255,255,255,'+a+')');x.fillStyle=g;x.fillRect(0,0,S,S);return new T.CanvasTexture(cv);}
function noise3(seed){const r=rng(seed),P=new Uint8Array(512),V=new Float32Array(256),p=[];for(let i=0;i<256;i++)p.push(i);for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1)),t=p[i];p[i]=p[j];p[j]=t;}for(let i=0;i<512;i++)P[i]=p[i&255];for(let i=0;i<256;i++)V[i]=r();
 const l=(t,a,b)=>a+(b-a)*t;
 return (x,y,z)=>{const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=x-X,fy=y-Y,fz=z-Z,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz),xi=X&255,yi=Y&255,zi=Z&255,xj=(xi+1)&255,yj=(yi+1)&255,zj=(zi+1)&255,a=P[xi],b=P[xj],aa=P[a+yi],ab=P[a+yj],ba=P[b+yi],bb=P[b+yj];
  return l(w,l(v,l(u,V[P[aa+zi]],V[P[ba+zi]]),l(u,V[P[ab+zi]],V[P[bb+zi]])),l(v,l(u,V[P[aa+zj]],V[P[ba+zj]]),l(u,V[P[ab+zj]],V[P[bb+zj]])));};}
// Pre-shaded Earth disc + atmosphere halo (physically motivated phase; lit limb toward the sun's side of the sky).
function earthTexture(S,L){const cv=document.createElement('canvas');cv.width=cv.height=S;const ctx=cv.getContext('2d'),img=ctx.createImageData(S,S),D=img.data,R=S/2/1.32,c0=S/2,nz3=noise3(77);
 const fbm=(x,y,z,o)=>{let a=0,f=1,w=.5,n=0;for(let i=0;i<o;i++){a+=w*nz3(x*f,y*f,z*f);n+=w;f*=2.03;w*=.5;}return a/n;};
 const tilt=.38,spin=2.4,ct=Math.cos(tilt),st=Math.sin(tilt),cs=Math.cos(spin),ss=Math.sin(spin),gm=v=>Math.round(255*Math.pow(clamp(v,0,1),1/2.2));
 for(let j=0;j<S;j++)for(let i=0;i<S;i++){const x=(i+.5-c0)/R,y=(c0-j-.5)/R,rr=x*x+y*y,o=(j*S+i)*4;if(rr>1.74){D[o+3]=0;continue;}
  const r=Math.sqrt(rr),cov=clamp((1-r)*R+.5,0,1),side=clamp(((x*L[0]+y*L[1])/(r||1))*.55+.42+L[2]*.45,0,1);
  const haloA=r>1?Math.exp(-(r-1)*12)*(.06+.94*side)*.95:0;let cr=0,cg=0,cb=0;
  if(cov>0){const nz=Math.sqrt(Math.max(0,1-rr)),ndl=x*L[0]+y*L[1]+nz*L[2];let px=x*ct-y*st,py=x*st+y*ct,pz=nz;const qx=px*cs+pz*ss,qz=-px*ss+pz*cs;px=qx;pz=qz;
   const lat=Math.abs(py),n1=fbm(px*1.55+3.1,py*1.55+1.7,pz*1.55+.4,5)*.78+fbm(px*4.3,py*4.3,pz*4.3,3)*.22,land=smooth(.5,.53,n1),ice=smooth(.8,.88,lat+.07*(nz3(px*6,py*6,pz*6)-.5));
   const dry=smooth(.12,.42,lat*(1-lat*.7))*smooth(.35,.65,nz3(px*3+9,py*3,pz*3));let sr=.07+.25*dry,sg=.1+.15*dry,sb=.04+.07*dry;
   const sh=smooth(.45,.5,n1);const or_=.006+.025*sh,og=.03+.06*sh,ob=.1+.08*sh;sr=or_+(sr-or_)*land;sg=og+(sg-og)*land;sb=ob+(sb-ob)*land;sr+=(.82-sr)*ice;sg+=(.86-sg)*ice;sb+=(.9-sb)*ice;
   const wx=nz3(px*1.4+5,py*1.4,pz*1.4)-.5,wy=nz3(px*1.4,py*1.4+7,pz*1.4)-.5,cn=fbm(px*2.3+wx*1.7,py*5+wy*1.3,pz*2.3+wx*1.7,5),band=.6+.4*Math.cos(py*PI*1.9),cloud=smooth(.5,.66,cn*(.8+.36*band));
   sr+=(.92-sr)*cloud;sg+=(.93-sg)*cloud;sb+=(.96-sb)*cloud;
   const day=smooth(-.05,.3,ndl),lit=Math.max(0,ndl),hz=L[2]+1,hl=Math.hypot(L[0],L[1],hz),spec=Math.pow(Math.max(0,(x*L[0]+y*L[1]+nz*hz)/hl),46)*(1-land)*(1-cloud)*(1-ice)*.8,rim=Math.pow(1-nz,2.2);
   const city=(1-day)*land*(1-ice)*smooth(.6,.78,nz3(px*24,py*24,pz*24))*smooth(.42,.66,nz3(px*5+2,py*5,pz*5)),tw=Math.exp(-((ndl/.1)**2))*.045*smooth(-.02,.06,ndl);
   cr=sr*(.03+1.08*lit)*day+spec+rim*.1*day+tw*.9+city*.5;cg=sg*(.03+1.08*lit)*day+spec+rim*.22*day+tw*.35+city*.28;cb=sb*(.03+1.08*lit)*day+spec*.95+rim*.45*day+tw*.18+city*.08;}
  const hr=.32,hg=.56,hb=1,a=cov+haloA*(1-cov);
  D[o]=gm((cr*cov+hr*haloA*(1-cov))/(a||1));D[o+1]=gm((cg*cov+hg*haloA*(1-cov))/(a||1));D[o+2]=gm((cb*cov+hb*haloA*(1-cov))/(a||1));D[o+3]=Math.round(255*clamp(a,0,1));}
 ctx.putImageData(img,0,0);const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;return t;}

// ---------- shaders ----------
const TERRAIN_COLOR=`
	vec3 tqTint = vColor.rgb;
	float tqTerra = smoothstep( 0.03, 0.09, tqTint.g - max( tqTint.r, tqTint.b ) );
	float tqMassif = smoothstep( 0.004, 0.05, tqTint.b - tqTint.r );
	vec2 tqW = vTqW;
	vec4 tqA = texture2D( tqDetail, tqW * 0.01031 );
	vec2 tqW2 = vec2( 0.8 * tqW.x - 0.6 * tqW.y, 0.6 * tqW.x + 0.8 * tqW.y );
	vec4 tqB = texture2D( tqDetail, tqW2 * 0.04348 + vec2( 0.31, 0.57 ) );
	float tqMacro = texture2D( tqDetail, tqW * 0.00069 + vec2( 0.5, 0.2 ) ).b;
	float tqMacro2 = texture2D( tqDetail, tqW2 * 0.0031 + vec2( 0.1, 0.8 ) ).b;
	#ifdef TQ_HIGH
	vec2 tqW3 = vec2( -0.6 * tqW.x - 0.8 * tqW.y, 0.8 * tqW.x - 0.6 * tqW.y );
	vec4 tqC = texture2D( tqDetail, tqW3 * 0.1887 + vec2( 0.13, 0.71 ) );
	#endif
	vec3 tqNg = normalize( vTqN );
	float tqRock = smoothstep( 0.27, 0.5, ( 1.0 - tqNg.y ) + ( tqB.a - 0.8 ) * 0.4 + ( tqMacro2 - 0.5 ) * 0.3 );
	float tqDet = mix( 1.0, 0.45, tqTerra );
	float tqAlb = 1.0 + ( ( tqA.b - 0.5 ) * 0.95 + ( tqB.b - 0.5 ) * 0.55 ) * tqDet + ( tqMacro - 0.5 ) * 0.85 + ( tqMacro2 - 0.5 ) * 0.55;
	#ifdef TQ_HIGH
	tqAlb += ( tqC.b - 0.5 ) * 0.45 * tqDet;
	#endif
	float tqAO = tqA.a * ( 0.5 + 0.5 * tqB.a );
	vec3 tqCol = vec3( 0.255, 0.252, 0.246 ) * tqAlb * ( 0.6 + 0.4 * tqAO );
	tqCol = mix( tqCol, vec3( 0.07, 0.068, 0.066 ) * ( 0.7 + 0.6 * tqB.b ), tqRock );
	tqCol *= mix( 1.0, 0.58, tqTerra );
	tqCol *= mix( 1.0, 1.1, tqMassif );
	diffuseColor.rgb *= tqCol;
`;
const TERRAIN_NORMAL=`
	vec2 tqS = ( tqA.rg - 0.5 ) * 2.857;
	vec2 tqSB = ( tqB.rg - 0.5 ) * 2.857;
	tqS += vec2( 0.8 * tqSB.x + 0.6 * tqSB.y, -0.6 * tqSB.x + 0.8 * tqSB.y ) * 0.75;
	#ifdef TQ_HIGH
	vec2 tqSC = ( tqC.rg - 0.5 ) * 2.857;
	tqS += vec2( -0.6 * tqSC.x + 0.8 * tqSC.y, -0.8 * tqSC.x - 0.6 * tqSC.y ) * 0.5 * smoothstep( 110.0, 25.0, length( vViewPosition ) );
	#endif
	float tqAmp = ( 1.0 - tqRock * 0.35 ) * mix( 1.0, 0.4, tqTerra );
	vec3 tqN = normalize( tqNg + vec3( -tqS.x, 0.0, -tqS.y ) * tqAmp );
	normal = normalize( ( viewMatrix * vec4( tqN, 0.0 ) ).xyz );
`;
// Lambert with a partial Lommel-Seeliger term (lunar regolith: flat, bright down-sun, no limb darkening).
const LAMBERT_LUNAR=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
	float lunar = mix( dotNL, 2.0 * dotNL / ( dotNL + dotNV + 0.08 ), 0.38 );
	reflectedLight.directDiffuse += lunar * directLight.color * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert
`;

function setup(api){
 if(M.ready)return;T=api.T||T;const low=!!api.low;M.low=low;
 TEX.glow=radialTex([[0,1],[.18,.78],[.45,.26],[.75,.07],[1,0]]);TEX.decal=decalAtlas();
 if(api.scene){TEX.detail=fieldTexture(craterField(low?256:512),low);}
 const arch=low?new T.MeshLambertMaterial({vertexColors:true}):new T.MeshPhongMaterial({vertexColors:true,specular:0x7a7a7a,shininess:42});
 arch.onBeforeCompile=sh=>{sh.uniforms.tqPulse=U.pulse;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 fx;\nvarying vec2 vTqFx;').replace('#include <begin_vertex>','#include <begin_vertex>\n\tvTqFx = fx;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vTqFx;\nuniform float tqPulse;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n\tfloat tqE = min( vTqFx.x, 1.0 ) * mix( 1.0, tqPulse, step( 1.001, vTqFx.x ) );\n\ttotalEmissiveRadiance += diffuseColor.rgb * tqE * 3.4;\n\tdiffuseColor.rgb *= 1.0 - min( vTqFx.x, 1.0 ) * 0.9;');
  if(!low)sh.fragmentShader=sh.fragmentShader.replace('#include <specularmap_fragment>','float specularStrength = vTqFx.y;');};
 arch.customProgramCacheKey=()=>'tq-arch'+(low?'L':'H');M.arch=arch;
 const ter=new T.MeshLambertMaterial({vertexColors:true});
 ter.onBeforeCompile=sh=>{sh.uniforms.tqDetail={value:TEX.detail};
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vTqW;\nvarying vec3 vTqN;').replace('#include <begin_vertex>','#include <begin_vertex>\n\tvTqW = uv * 24.0;\n\tvTqN = normal;');
  sh.fragmentShader=(low?'':'#define TQ_HIGH\n')+sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vTqW;\nvarying vec3 vTqN;\nuniform sampler2D tqDetail;').replace('#include <color_fragment>',TERRAIN_COLOR).replace('#include <normal_fragment_maps>',TERRAIN_NORMAL).replace('#include <lights_lambert_pars_fragment>',LAMBERT_LUNAR);};
 ter.customProgramCacheKey=()=>'tq-terrain'+(low?'L':'H');ter.tqDetail=TEX.detail;M.terrain=ter;
 const fxo={vertexColors:true,transparent:true,depthWrite:false,fog:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4};
 M.add=new T.MeshBasicMaterial({...fxo,map:TEX.glow,blending:T.AdditiveBlending});
 M.decal=new T.MeshBasicMaterial({...fxo,map:TEX.decal});
 M.ready=true;}
function finalize(api){if(!api.scene)return;api.scene.traverse(o=>{if(o.isMesh&&o.material===M.terrain)o.receiveShadow=!api.low;});}

// ---------- sky: black, dense stars, Earth low on the horizon ----------
function earthPlacement(api){const f=LAB.FRAMES[api.subject];let yaw=SUN_AZ+PI*.8,pitch=.2;
 if(f&&f.from){const base=ground(f.to[0],f.to[2]),cy=Math.max(base+f.from[1],ground(f.from[0],f.from[2])+2),ty=base+f.to[1],dx=f.to[0]-f.from[0],dz=f.to[2]-f.from[2];yaw=Math.atan2(dx,dz);pitch=Math.atan2(cy-ty,Math.hypot(dx,dz));}
 const P=EARTH_AT[api.subject]||{az:0,k:.5},sky=Math.max(5,27.5-pitch/DEG),el=clamp(sky*P.k,3.6,15)*DEG,az=yaw+P.az*DEG,dir=[Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)];
 const fw=new T.Vector3(Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)),rv=new T.Vector3().crossVectors(fw,QY).normalize(),uv=new T.Vector3().crossVectors(rv,fw);
 const s=new T.Vector3(...SUN),e=new T.Vector3(...dir),perp=s.clone().addScaledVector(e,-s.dot(e));let lx=perp.dot(rv),ly=perp.dot(uv);const l=Math.hypot(lx,ly)||1;lx/=l;ly/=l;
 const alpha=clamp(PI-Math.acos(clamp(s.dot(e),-1,1)),48*DEG,100*DEG);return {dir,L:[Math.sin(alpha)*lx,Math.sin(alpha)*ly,Math.cos(alpha)]};}
function buildSky(api,E){const g=new T.Group(),low=api.low,r=rng(4242),N=low?2000:4800,R=2650,dim={p:[],c:[]},bright={p:[],c:[]};
 const pole=new T.Vector3(.35,.62,.7).normalize(),e1=new T.Vector3(1,0,0).cross(pole).normalize(),e2=new T.Vector3().crossVectors(pole,e1);
 for(let k=0;k<N;k++){let x,y,z;if(r()<.42){const th=r()*TAU,gs=(r()+r()+r()-1.5)*.15;x=Math.cos(th)*e1.x+Math.sin(th)*e2.x+pole.x*gs;y=Math.cos(th)*e1.y+Math.sin(th)*e2.y+pole.y*gs;z=Math.cos(th)*e1.z+Math.sin(th)*e2.z+pole.z*gs;const l=Math.hypot(x,y,z);x/=l;y/=l;z/=l;}else{const zz=r()*2-1,th=r()*TAU,s=Math.sqrt(1-zz*zz);x=s*Math.cos(th);y=zz;z=s*Math.sin(th);}
  if(y<-.06)continue;const b=.14+.86*Math.pow(r(),6),t=r(),c=t<.18?[.72,.82,1]:t<.78?[1,1,1]:t<.94?[1,.9,.74]:[1,.74,.6],dst=b>.66?bright:dim;dst.p.push(x*R,y*R,z*R);dst.c.push(c[0]*b,c[1]*b,c[2]*b);}
 if(low){dim.p.push(...bright.p);dim.c.push(...bright.c);bright.p.length=0;}
 for(const [set,size] of [[dim,low?1.25:1.1],[bright,2.1]]){if(!set.p.length)continue;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(set.p,3));geo.setAttribute('color',new T.Float32BufferAttribute(set.c,3));const pts=new T.Points(geo,new T.PointsMaterial({size,sizeAttenuation:false,vertexColors:true,fog:false,depthWrite:false,transparent:true}));pts.frustumCulled=false;pts.renderOrder=-6;g.add(pts);}
 const fx=new Fx();fx.grid(1,1,(u,v)=>[u-.5,v-.5,0,u,v,1],col(0xffffff));
 const mat=new T.MeshBasicMaterial({map:earthTexture(low?128:256,E.L),vertexColors:true,transparent:true,depthWrite:false,fog:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4});
 const earth=fx.mesh(mat,-5);earth.frustumCulled=false;SKY.D=2560;earth.scale.setScalar(SKY.D*Math.tan(2.35*DEG)*2.64);earth.position.set(E.dir[0]*SKY.D,E.dir[1]*SKY.D,E.dir[2]*SKY.D);g.add(earth);SKY.earth=earth;SKY.dir=E.dir;return g;}

// ---------- props (per fine chunk): rocks + lunar replacements for trees ----------
const PG={};
function rockGeometry(low){const base=new T.IcosahedronGeometry(1,low?1:2),pa=base.attributes.position,nz=noise3(91),r=rng(5150),cuts=[];
 for(let i=0;i<8;i++){const zz=r()*1.6-.6,th=r()*TAU,s=Math.sqrt(1-Math.min(1,zz*zz));cuts.push([s*Math.cos(th),zz,s*Math.sin(th),.55+.3*r()]);}
 const v=new T.Vector3();for(let i=0;i<pa.count;i++){v.fromBufferAttribute(pa,i);const d=1+.2*(nz(v.x*1.7+5,v.y*1.7,v.z*1.7)-.5)+.09*(nz(v.x*4.1,v.y*4.1+3,v.z*4.1)-.5);v.multiplyScalar(d);
  for(const [cx,cy,cz,o] of cuts){const p=v.x*cx+v.y*cy+v.z*cz;if(p>o){v.x-=cx*(p-o);v.y-=cy*(p-o);v.z-=cz*(p-o);}}if(v.y<-.5)v.y=-.5+(v.y+.5)*.25;pa.setXYZ(i,v.x,v.y,v.z);}
 base.computeBoundingBox();const bb=base.boundingBox,sx=2/(bb.max.x-bb.min.x),sy=2/(bb.max.y-bb.min.y),sz=2/(bb.max.z-bb.min.z),ox=(bb.max.x+bb.min.x)/2,oy=(bb.max.y+bb.min.y)/2,oz=(bb.max.z+bb.min.z)/2;
 for(let i=0;i<pa.count;i++)pa.setXYZ(i,(pa.getX(i)-ox)*sx,(pa.getY(i)-oy)*sy,(pa.getZ(i)-oz)*sz);base.computeVertexNormals();
 const k=new Kit(),c0=col('#8a8882'),dust=col('#a8a69e'),low_=col('#5d5b56');
 k.add(base,mtx(0,0,0),c0,0,.08,(p,n,i)=>{const f=Math.floor(i/3),t=.86+.26*hash(f);return n.y>.62?tone(dust,t):p.y<-.25?tone(low_,t):tone(c0,t);});
 const peb=new T.IcosahedronGeometry(1,0);for(const [x,z,s] of [[1.02,.35,.14],[-.95,-.5,.11],[.2,-1.0,.1],[-.35,.98,.09]])k.add(peb,mtx(x,-.86,z,s,s*.8,s*1.1,s*7,s*3,0),tone(c0,.9),0,.05);
 return k.geometry();}
function PROPS(api){if(PG.rock)return PG;const low=api.low;PG.rock=rockGeometry(low);
 // pressurised greenhouse tube (1.3 m tall): frosted panels with soft grow-light glow, dark hoops, magenta ridge strip
 let k=new Kit();const skin=col('#f0c9ea'),frame=col('#3a3d42'),grow=col('#ff6fd6');
 k.add(geo('ghskin',()=>new T.CylinderGeometry(1,1,4,low?10:14,1,true,-PI/2,PI)),mtx(0,.12,0,1,1,1.12,-PI/2,0,-PI/2),skin,.36,.6);
 for(const s of [-1,1])k.add(geo('ghcap',()=>new T.CircleGeometry(1,low?8:12,0,PI)),mtx(s*2,.12,0,1,1.12,1,0,s*PI/2,0),skin,.32,.4);
 for(const x of (low?[-2,0,2]:[-2,-1,0,1,2]))k.add(geo('ghhoop'+low,()=>new T.TorusGeometry(1.03,.05,4,low?8:10,PI)),mtx(x,.12,0,1,1.12,1,0,PI/2,0),frame,0,.3);
 k.add(BOX(),mtx(0,1.27,0,4,.05,.14),grow,1);k.add(BOX(),mtx(0,.05,0,4.15,.18,2.15),col('#4b4c4e'));
 k.add(BOX(),mtx(2.35,.45,0,.7,.8,.9),col('#cfd1cc'),0,.4);k.add(BOX(),mtx(2.72,.72,0,.04,.12,.3),col('#60f0ff'),1);PG.green=k.geometry();
 // algae bioreactor raceway (0.45 m): three glowing green lanes in a low basin
 k=new Kit();k.add(BOX(),mtx(0,.15,0,3,.3,1.8),col('#6c6e70'),0,.1);for(const z of [-.58,0,.58])k.add(BOX(),mtx(0,.31,z,2.7,.05,.46),col('#33e88f'),.75,1);
 for(const z of [-.29,.29])k.add(BOX(),mtx(0,.34,z,2.8,.1,.06),col('#b9bdbf'),0,.4);k.add(CYL(8),mtx(1.25,.42,0,.2,1.75,.2,PI/2,0,0),col('#2c2f33'),0,.4);k.add(BOX(),mtx(-1.62,.3,0,.36,.55,.55),col('#d4d6d2'),0,.3);k.add(BOX(),mtx(-1.81,.45,0,.03,.1,.22),col('#60f0ff'),1);PG.algae=k.geometry();
 // sensor stake cluster (1.5 m, thin)
 k=new Kit();for(let q=0;q<3;q++){const a=q/3*TAU+.4,x=.9*Math.sin(a),z=.9*Math.cos(a);k.add(CYL(6),mtx(x,.73,z,.035,1.46,.035),col('#9aa0a6'),0,.5);k.add(BOX(),mtx(x,1.38,z,.13,.1,.13),col('#dfe1de'),0,.3);k.add(BOX(),mtx(x,1.47,z,.07,.07,.07),q?col('#5ff0ff'):col('#ff4b3e'),1);k.add(CYL(6),mtx(x,.02,z,.13,.04,.13),col('#55585c'));}
 k.add(BOX(),mtx(0,.12,0,.35,.24,.25),col('#cfd2cf'),0,.3);PG.stake=k.geometry();
 // relay: thin lattice comms mast with dish and red beacon (passable thin mast)
 k=new Kit();const st=col('#8d939a');for(let q=0;q<3;q++){const a=q/3*TAU;k.add(CYL(5),mtx(.32*Math.sin(a),6,.32*Math.cos(a),.05,12,.05),st,0,.5);}
 for(let y=1;y<12;y+=low?3:1.5)for(let q=0;q<3;q++){const a=q/3*TAU,b=(q+1)/3*TAU;beam(k,[.32*Math.sin(a),y,.32*Math.cos(a)],[.32*Math.sin(b),y+(low?0:.75),.32*Math.cos(b)],.03,st);}
 k.add(CONE(low?8:12),mtx(.55,10.8,0,1.1,.4,1.1,0,0,-PI/2.3),col('#d9dbd8'),0,.5);k.add(BOX(),mtx(0,12.15,0,.22,.22,.22),col('#ff3b30'),1);k.add(BOX(),mtx(0,.05,0,1.1,.1,1.1),col('#55585c'));PG.relay=k.geometry();
 return PG;}
const PLACE={
 rock:(o,p)=>{const s=p.size,v=p.variant;o.position.set(0,p.y+.3*s,0);o.rotation.set((v-.7)*.3,((v*997|0)%2)*PI+((v*37.1)%1-.5)*.3,(v-.6)*.25);o.scale.set(1.6*s,(.5+v)*s,s);},
 green:(o,p)=>{const s=p.size;o.position.set(0,p.y-.06,0);o.rotation.set(0,(p.variant*7.31)%PI,0);o.scale.set(.85+.5*s,1,.8+.22*s);},
 algae:(o,p)=>{const s=p.size;o.position.set(0,p.y-.03,0);o.rotation.set(0,(p.variant*5.17)%PI,0);o.scale.set(.8+.45*s,1,.8+.35*s);},
 stake:(o,p)=>{const s=p.size;o.position.set(0,p.y,0);o.rotation.set(0,p.variant*11.3,0);o.scale.set(.7+.3*s,1,.7+.3*s);},
 relay:(o,p)=>{o.position.set(0,p.y,0);o.rotation.set(0,p.variant*3,0);}};
function instanced(g,list,kind,ox,oz,cast){if(!list.length)return;const m=new T.InstancedMesh(PG[kind],M.arch,list.length);list.forEach((p,i)=>{TMP.position.set(0,0,0);TMP.rotation.set(0,0,0,'XYZ');TMP.scale.set(1,1,1);PLACE[kind](TMP,p);TMP.position.x+=p.x-ox;TMP.position.z+=p.z-oz;TMP.updateMatrix();m.setMatrixAt(i,TMP.matrix);});
 m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();m.castShadow=!!cast&&!M.low;m.receiveShadow=!M.low;g.add(m);}

// ---------- Refuge ----------
const PAL={white:'#d8dad5',gold:'#c18f33',bag:'#7c7972',berm:'#6a6965',steel:'#3a3f45',light:'#c3c6c8',amber:'#ffb35c',cyan:'#5fe9ff',red:'#ff3b30',ember:'#ff4d14',hot:'#ff8a3a'};
function sandbags(k,x,y0,z,low,idx){const rows=low?4:6,rh=low?.95:.63,segs=low?18:32,Hh=rows*rh,rb=7.75,inset=1.15,bulge=low?.27:.2,sub=low?2:3,base=col(PAL.bag);
 const P=(a,y,r)=>[x+r*Math.sin(a),y0+y,z+r*Math.cos(a)],N=(a,d)=>{const l=Math.hypot(1,d);return [Math.sin(a)/l,-d/l,Math.cos(a)/l];};
 const prof=(f,y)=>rb-inset*(y/Hh)+bulge*Math.sin(PI*f),dr=f=>-inset/Hh+bulge*PI/rh*Math.cos(PI*f);
 for(let row=0;row<rows;row++)for(let s=0;s<segs;s++){const bag=(s+(row%2))>>1,c=tone(base,.8+.32*hash(idx*911+row*97+bag)),a0=s/segs*TAU,a1=(s+1)/segs*TAU;
  for(let j=0;j<sub;j++){const f0=j/sub,f1=(j+1)/sub,ya=row*rh+f0*rh,yb=row*rh+f1*rh,ra=prof(f0,ya),rB=prof(f1,yb),na=dr(f0),nb=dr(f1),cc=j===0?tone(c,.78):c;k.quad(P(a0,ya,ra),P(a1,ya,ra),P(a1,yb,rB),P(a0,yb,rB),N(a0,na),N(a1,na),N(a1,nb),N(a0,nb),cc,0,.04);}}
 const rt=rb-inset,ri=6.25,up=[0,1,0];for(let s=0;s<segs;s++){const a0=s/segs*TAU,a1=(s+1)/segs*TAU;k.quad(P(a0,Hh+.06,rt),P(a0,Hh+.06,ri),P(a1,Hh+.06,ri),P(a1,Hh+.06,rt),up,up,up,up,tone(base,.92),0,.04);}}
function habLathe(seg){return geo('hab'+seg,()=>new T.LatheGeometry([[6.3,2.3],[6.3,6.15],[6.16,6.9],[5.62,7.7],[4.62,8.45],[3.0,8.95],[1.2,9.14],[.01,9.17]].map(([r,y])=>new T.Vector2(r,y)),seg));}
function habitat(api,k,glow,soft,shd,halo,h,idx){const x=h.x,z=h.z,y0=ground(x,z),low=api.low,seg=low?16:28,air=((idx%3)-1)*.3+(Math.floor(idx/3)%2?.1:-.1),ax=Math.sin(air),az=Math.cos(air);
 const white=col(PAL.white),gold=col(PAL.gold),amber=col(PAL.amber),cyan=col(PAL.cyan),red=col(PAL.red),dark=col('#2b2e31');
 k.add(geo('skirt'+seg,()=>new T.CylinderGeometry(7.7,8.8,1,seg,1,true)),mtx(x,y0-.7,z,1,2.6,1),col(PAL.berm),0,.02);
 sandbags(k,x,y0,z,low,idx);
 k.add(habLathe(seg),mtx(x,y0,z,1,1,1,0,air,0),white,0,.45,(v,n)=>{const y=v.y-y0,a=((Math.atan2(v.x-x,v.z-z)-air)%(PI/6)+PI/6)%(PI/6);if(y>5.7&&y<6.4)return {c:gold,s:1};if(y>8.85)return {c:col('#9da2a6'),s:.6};return a<.09?tone(white,.84):null;});
 for(let w=0;w<6;w++){const a=air+.62+w*(TAU-1.24)/5;k.add(BOX(),mtx(x+6.33*Math.sin(a),y0+4.95,z+6.33*Math.cos(a),1.35,.3,.16,0,a,0),amber,1);halo.add(1.7,x+6.95*Math.sin(a),y0+4.95,z+6.95*Math.cos(a),amber,.55);}
 // airlock tunnel through the bag shell
 k.add(CYL(low?10:14),mtx(x+ax*6.85,y0+1.45,z+az*6.85,1.3,3.3,1.3,PI/2,air,0,'YXZ'),col('#cfd2cd'),0,.4);
 for(const r of [7.55,8.25])k.add(CYL(low?10:14),mtx(x+ax*r,y0+1.45,z+az*r,1.4,.22,1.4,PI/2,air,0,'YXZ'),dark,0,.5);
 k.add(CYL(low?10:14),mtx(x+ax*8.52,y0+1.45,z+az*8.52,1.02,.12,1.02,PI/2,air,0,'YXZ'),col('#3b3f43'),0,.3);
 k.add(BOX(),mtx(x+ax*8.6,y0+1.72,z+az*8.6,.5,.3,.06,0,air,0),amber,1);k.add(BOX(),mtx(x+ax*8.45,y0+2.95,z+az*8.45,.32,.12,.12,0,air,0),cyan,1);
 halo.add(2.4,x+ax*8.95,y0+2.95,z+az*8.95,cyan,.75);halo.add(1.7,x+ax*8.95,y0+1.72,z+az*8.95,amber,.6);
 for(let q=0;q<4;q++){const a=air+PI/4+q*PI/2;k.add(BOX(),mtx(x+6.75*Math.sin(a),y0+3.95,z+6.75*Math.cos(a),.24,.18,.24),cyan,1);halo.add(1.5,x+6.95*Math.sin(a),y0+4.05,z+6.95*Math.cos(a),cyan,.6);}
 const mx=x-ax*3.1,mz=z-az*3.1;k.add(CYL(5),mtx(mx,y0+10.5,mz,.07,3.3,.07),col('#9aa0a6'),0,.5);k.add(CONE(low?8:10),mtx(mx+.3,y0+10.9,mz,.7,.3,.7,0,0,-1.2),col('#d9dbd8'),0,.5);k.add(BOX(),mtx(mx,y0+12.2,mz,.24,.24,.24),red,1);halo.add(2.2,mx,y0+12.25,mz,red,.85);
 k.add(BOX(),mtx(x+ax*.9,y0+9.2,z+az*.9,1.5,.08,.7,0,air+.4,0),col('#6f757b'),0,.6);
 drape(glow,x+ax*11.4,z+az*11.4,9,8,air,amber,.55,{nu:5,nv:5});drape(glow,x,z,24,24,0,col('#9cc8ff'),.13,{nu:6,nv:6});
 drape(soft,x,z,21,21,0,BLACK(),.5,{nu:8,nv:8});
 if(low)drape(shd,x,z,9.2/TAN_EL+4,15.5,SHD_ANG,BLACK(),.74,{mode:'shadow',nu:4,nv:10});}
function processor(api,k,glow,soft,shd,halo,p,i){const x=p.x,z=p.z,y0=ground(x,z),Hh=p.shotHeight-2,low=api.low,seg=low?12:20,top=Hh-14.5,steel=col(PAL.steel),light=col(PAL.light),cyan=col(PAL.cyan),white=col('#e2e4e1');
 k.add(geo('pad8',()=>new T.CylinderGeometry(12.4,13.1,1.6,8)),mtx(x,y0-.25,z,1,1,1,0,PI/8),col('#56575a'),0,.1);
 for(let s=0;s<16;s++){const a=s/16*TAU;k.add(BOX(),mtx(x+11.2*Math.sin(a),y0+.58,z+11.2*Math.cos(a),4.0,.07,.6,0,a+PI/2,0),col(s%2?'#d8b440':'#1d1e20'));}
 k.add(CYL(seg,5.1,5.6),mtx(x,y0+top/2+.4,z,1,top,1),light,0,.35,(v)=>{const a=Math.atan2(v.x-x,v.z-z);return ((Math.round((a+PI)/TAU*seg))%4===0)?tone(light,.72):null;});
 for(let y=8;y<top;y+=13)k.add(CYL(seg),mtx(x,y0+y,z,5.85,.9,5.85),steel,0,.6);
 for(const f of [.28,.52,.76]){k.add(CYL(seg),mtx(x,y0+top*f,z,5.93,.42,5.93),cyan,1);for(let q=0;q<4;q++){const a=q*PI/2+f*3;halo.add(3,x+6.6*Math.sin(a),y0+top*f,z+6.6*Math.cos(a),cyan,.45);}}
 const L=9.4,corner=(q,y)=>{const a=PI/4+q*PI/2;return [x+L*Math.sin(a),y0+y,z+L*Math.cos(a)];};
 for(let q=0;q<4;q++){const a=PI/4+q*PI/2;k.add(BOX(),mtx(x+L*Math.sin(a),y0+Hh*.45,z+L*Math.cos(a),.85,Hh*.9,.85,0,a,0),steel,0,.5);}
 const step=low?24:12;for(let y=6;y<Hh*.88;y+=step)for(let q=0;q<4;q++){beam(k,corner(q,y),corner(q+1,y),.32,steel,0,.4);if(!low&&y+step<Hh*.9){beam(k,corner(q,y),corner(q+1,y+step),.2,steel,0,.3);beam(k,corner(q+1,y),corner(q,y+step),.2,steel,0,.3);}}
 for(let q=0;q<4;q++){const a=q*PI/2,cx=x+8.35*Math.sin(a),cz=z+8.35*Math.cos(a);k.add(BOX(),mtx(cx,y0+Hh*.52,cz,.18,Hh*.36,5,0,a,0),white,0,.5);for(let s=0;s<(low?4:9);s++)k.add(BOX(),mtx(cx,y0+Hh*(.36+.32*(s+.5)/(low?4:9)),cz,.24,.32,5.02,0,a,0),col('#5b6066'),0,.3);}
 for(const a of [.4,2.5,4.6])k.add(CYL(8),mtx(x+6.5*Math.sin(a),y0+top*.48,z+6.5*Math.cos(a),.42,top*.92,.42),col('#8e9399'),0,.7);
 k.add(CYL(seg,6.3,5.2),mtx(x,y0+top+1.5,z,1,3,1),steel,0,.5);
 k.add(SPH(low?12:18,low?8:12),mtx(x,y0+Hh-5.4,z,4.6,4.6,4.6),white,0,.65);k.add(CYL(seg),mtx(x,y0+Hh-5.4,z,4.68,.5,4.68),col(PAL.gold),0,1);
 k.add(CYL(6),mtx(x,y0+Hh+3.8,z,.13,10,.13),col('#9aa0a6'),0,.5);k.add(BOX(),mtx(x,y0+Hh+9,z,.5,.5,.5),col(PAL.red),1);halo.add(6.5,x,y0+Hh+9,z,col(PAL.red),.95);
 for(const a of [1.2,3.9]){k.add(BOX(),mtx(x+7.4*Math.sin(a),y0+1.3,z+7.4*Math.cos(a),3,2.6,2.6,0,a,0),col('#b9bcbf'),0,.3);k.add(BOX(),mtx(x+8.75*Math.sin(a),y0+2.1,z+8.75*Math.cos(a),.5,.15,.08,0,a,0),cyan,1);}
 drape(glow,x,z,36,36,0,col('#9fdcff'),.3,{nu:6,nv:6});drape(soft,x,z,32,32,0,BLACK(),.42,{nu:8,nv:8});
 if(low)drape(shd,x,z,Hh/TAN_EL*.9,20,SHD_ANG,BLACK(),.7,{mode:'shadow',nu:4,nv:40});}
function terminal(api,k,glow,soft,halo,t){const x=t.x,z=t.z,y0=ground(x,z),cyan=col('#5ff0ff'),amber=col('#ffb04a'),steel=col(PAL.steel),gz=z-3.4,pale=col('#c9ccce');
 k.add(geo('pad6',()=>new T.CylinderGeometry(5,5.4,.5,6)),mtx(x,y0+.05,z,1,1,1,0,PI/6),col('#3d4146'),0,.2);
 k.add(geo('ring',()=>new T.RingGeometry(4.15,4.55,36)),mtx(x,y0+.32,z,1,1,1,-PI/2,0,0),cyan,1);
 for(let s=0;s<6;s++){const a=s/6*TAU;k.add(BOX(),mtx(x+4.8*Math.sin(a),y0+.31,z+4.8*Math.cos(a),.9,.04,.35,0,a+PI/2,0),col('#e0b23c'));}
 for(const dx of [-2.9,2.9])k.add(BOX(),mtx(x+dx,y0+2.7,gz,.38,5.4,.38),steel,0,.5);k.add(BOX(),mtx(x,y0+5.45,gz,6.4,.42,.5),steel,0,.5);
 beam(k,[x+1.2,y0+5.2,gz],[x+.6,y0+3.6,z-1.2],.22,pale,0,.5);beam(k,[x+.6,y0+3.6,z-1.2],[x+.1,y0+2.2,z-.4],.18,pale,0,.5);k.add(BOX(),mtx(x+.1,y0+2.05,z-.4,.28,.28,.28),cyan,1);
 for(const dx of [-2.2,2.2]){k.add(BOX(),mtx(x+dx,y0+5.1,gz+.35,.6,.25,.3),col('#eaf6ff'),1);halo.add(2.4,x+dx,y0+5.0,gz+.7,col('#cfefff'),.7);}
 const ka=-.55;k.add(BOX(),mtx(x+3.6,y0+.95,z-1.2,1.7,1.9,1,0,ka,0),col('#5b6168'),0,.3);k.add(BOX(),mtx(x+3.6+.53*Math.sin(ka),y0+1.45,z-1.2+.53*Math.cos(ka),1.3,.85,.06,-.35,ka,0,'YXZ'),cyan,1);
 k.add(BOX(),mtx(x+.1,y0+6.6,gz-.12,3.6,1.9,.1),col('#22272c'));k.add(BOX(),mtx(x-.8,y0+6.6,gz,1.5,.42,.14),cyan,1);k.add(BOX(),mtx(x-.8,y0+6.6,gz,.42,1.5,.14),cyan,1);k.add(BOX(),mtx(x+1.05,y0+6.6,gz,.85,.85,.14,0,0,PI/4),amber,1);
 halo.add(4.5,x-.8,y0+6.6,gz+.45,cyan,.6);halo.add(3.2,x+1.05,y0+6.6,gz+.45,amber,.55);halo.add(3,x+3.6+.7*Math.sin(ka),y0+1.5,z-1.2+.7*Math.cos(ka),cyan,.5);
 for(let q=0;q<3;q++){const a=q*PI/3,ca=Math.cos(a),sa=Math.sin(a);glow.grid(1,4,(u,v)=>[x+(u-.5)*2.6*ca,y0+7.6+v*42,gz+(u-.5)*2.6*sa,u,.5,.42*(1-v)*(1-v)],cyan);}
 drape(glow,x,z,14,14,0,col('#8fe9ff'),.7,{nu:6,nv:6});
 for(let s=0;s<32;s++){const a=s/32*TAU;drape(glow,x+12*Math.sin(a),z+12*Math.cos(a),1.9,.55,a+PI/2,cyan,.85,{nu:1,nv:2});}
 drape(soft,x,z,13,13,0,BLACK(),.35,{nu:4,nv:4});}
function solarPanel(api,k,shd,s){const x=s.x,z=s.z,y0=ground(x,z),fr=col('#5b5f64'),line=col('#8c96a2');
 for(const dx of [-4.5,4.5])k.add(BOX(),mtx(x+dx,y0+.9,z,.25,2.4,.25),fr,0,.4);k.add(BOX(),mtx(x,y0+1.95,z,10,.22,.3),fr,0,.4);
 k.frame=mtx(x,y0+2.15,z,1,1,1,s.tilt,0,0);k.add(BOX(),mtx(0,0,0,14,.16,9),col('#121b2b'),0,1);
 for(let q=-3;q<=3;q++)k.add(BOX(),mtx(q*2,.085,0,.05,.02,9),line,0,.6);for(let q=-1;q<=1;q++)k.add(BOX(),mtx(0,.085,q*3,14,.02,.05),line,0,.6);
 for(const zz of [-4.5,4.5])k.add(BOX(),mtx(0,0,zz,14.1,.2,.12),col('#b7bdc3'),0,.6);k.frame=null;
 if(api.low)drape(shd,x,z,3.6/TAN_EL+5,14,SHD_ANG,BLACK(),.6,{mode:'shadow',nu:4,nv:6});}

// ---------- raid site: Parasite obsidian monolith + human blast barriers ----------
function installation(api,k,glow,soft,shd,halo,b){const low=api.low,cx=b.solid.x,cz=b.solid.z,y0=ground(cx,cz),obs=col('#100e13'),chit=col('#1b151c'),ember=col(PAL.ember),hot=col(PAL.hot),r=rng(51);
 for(let q=0;q<14;q++){const a=q/14*TAU+r()*.2,sa=Math.sin(a),ca=Math.cos(a),tb=Math.min(11/Math.max(Math.abs(sa),1e-3),8/Math.max(Math.abs(ca),1e-3))*.97,p0=[cx+8.3*sa,0,cz+5.3*ca],p1=[cx+sa*tb,0,cz+ca*tb];
  p0[1]=ground(p0[0],p0[2]);p1[1]=ground(p1[0],p1[2]);const h0=1.2+r()*.6;wedge(k,p0,p1,1.7+r()*.5,.6,h0,.15,chit,0,.35);wedge(k,p0,p1,.3,.12,h0+.05,.2,ember,1.6,0,.2);
  drape(glow,p1[0],p1[2],5+r()*9,.55,a+(r()-.5)*.5,ember,.8,{mode:'line',nu:2,nv:5});}
 slab(k,cx,y0-.4,cz,16,10.4,11.2,0,0,.78,obs,0,.3);
 for(let q=0;q<8;q++){const a=q/8*TAU+.2,px=cx+8.05*Math.sin(a),pz=cz+5.0*Math.cos(a);slab(k,px,ground(px,pz)-.5,pz,4.2+r()*1.3,1.5,9.4+r()*3,a,-1.0,.84,q%2?obs:col('#151219'),0,.35);
  const fa=a+PI/8,fx=cx+8.0*Math.sin(fa),fz=cz+4.95*Math.cos(fa);k.add(BOX(),mtx(fx,y0+4.6,fz,.32,8.6,.32,0,fa,0),ember,1.6);for(const hy of [2.5,5.5,8.4])halo.add(2.3,fx+.4*Math.sin(fa),y0+hy,fz+.4*Math.cos(fa),ember,.55);}
 k.add(BOX(),mtx(cx-8.35,y0+6.4,cz,.5,.85,6.4),hot,1.7);for(const dz of [-2.4,0,2.4])halo.add(3.2,cx-8.9,y0+6.4,cz+dz,hot,.7);
 for(const [dx,dz] of [[-4,-2],[-1.5,2.2],[1.8,-1.4],[4.2,1.6],[0,0],[-5.2,1.2]])k.add(CONE(5),mtx(cx+dx,y0+11.3,cz+dz,.65,1.7,.65,(dz)*.05,0,-dx*.03),obs,0,.4);
 const m=b.mast,my=ground(m.x,m.z);for(let q=0;q<9;q++){const rr=1.9-q*.17,y=my+q*2.15+1,ox=-.035*q*q;k.add(CYL(7,rr*.82,rr),mtx(m.x+ox,y,m.z,1,2.05,1,0,q*.4,(q-4)*.02),chit,0,.4);if(q%2)k.add(CYL(7),mtx(m.x+ox-.035*(2*q+1)*.5,y+1.07,m.z,rr*.88,.22,rr*.88),ember,1.6);}
 k.add(SPH(10,8),mtx(m.x-2.8,my+20,m.z,.95,.95,.95),hot,1.7);k.add(CONE(6),mtx(m.x-2.9,my+21.5,m.z,.35,1.8,.35),chit,0,.4);halo.add(7,m.x-2.8,my+20,m.z,ember,.95);
 drape(soft,cx,cz-2,40,32,0,BLACK(),.55,{nu:8,nv:8});drape(glow,cx,cz,30,24,0,ember,.26,{nu:6,nv:6});
 if(low){drape(shd,cx,cz,12/TAN_EL+5,18,SHD_ANG,BLACK(),.72,{mode:'shadow',nu:4,nv:12});drape(shd,m.x,m.z,20/TAN_EL,3.5,SHD_ANG,BLACK(),.6,{mode:'shadow',nu:2,nv:16});}}
function barrier(api,k,glow,soft,shd,halo,o,idx){const y0=ground(o.x,o.z),alongX=o.width>=o.depth,Lg=alongX?o.width:o.depth,Wd=alongX?o.depth:o.width,n=Math.max(1,Math.round(Lg/3)),seg=Lg/n,base=col('#7f7b74'),capC=col('#8f8b83'),amber=col('#ffae3c'),r=rng(700+idx),h=o.height;
 for(let q=0;q<n;q++){const c=-Lg/2+seg*(q+.5),t=.88+.2*r(),cc=tone(base,t),bx=o.x+(alongX?c:0),bz=o.z+(alongX?0:c),by=ground(bx,bz),hb=h+(y0-by)+.6-.22;
  k.add(BOX(),mtx(bx,by-.6+hb/2,bz,alongX?seg-.09:Wd,hb,alongX?Wd:seg-.09),cc,0,.12,(v)=>v.y>y0+h-1?tone(cc,.62):null);
  k.add(BOX(),mtx(bx,y0+h-.11,bz,alongX?seg-.16:Wd-.3,.22,alongX?Wd-.3:seg-.16),tone(capC,t),0,.15);
  if(q===0||q===n-1){const e=q===0?-1:1;for(let s=0;s<4;s++){const off=c+e*(-seg/2+.35+s*.5)*-1;for(const side of [-1,1])k.add(BOX(),mtx(o.x+(alongX?off:side*(Wd/2+.01)),y0+h-.62,o.z+(alongX?side*(Wd/2+.01):off),alongX?.4:.03,.34,alongX?.03:.4),col(s%2?'#151515':'#e0b23c'));}
   const lx=o.x+(alongX?c+e*seg*.32:0),lz=o.z+(alongX?0:c+e*seg*.32);k.add(BOX(),mtx(lx,y0+h+.12,lz,.3,.22,.3),amber,1);halo.add(1.8,lx,y0+h+.25,lz,amber,.8);}
  if(api.low){const cr=alongX?Math.abs(SHD[1]):Math.abs(SHD[0]),dt=alongX?Math.abs(SHD[0]):Math.abs(SHD[1]);drape(shd,bx,bz,h/TAN_EL,seg*cr+Wd*dt+.6,SHD_ANG,BLACK(),.66,{mode:'shadow',nu:2,nv:6});}}
 drape(soft,o.x,o.z,(alongX?Lg:Wd)+3.5,(alongX?Wd:Lg)+3.5,PI/2,BLACK(),.5,{nu:6,nv:6});}
function hive(api,k,glow,soft,shd,halo,p){const x=p.x,z=p.z,y0=ground(x,z),ember=col(PAL.ember);
 for(let q=0;q<4;q++){const a=q/4*TAU+.5;slab(k,x+1.6*Math.sin(a),y0-.5,z+1.6*Math.cos(a),1.7,1.1,4.4+q*1.2,a+.3,-.9,.42,q%2?col('#0f0d12'):col('#17121a'),0,.35);}
 k.add(SPH(10,8),mtx(x,y0+1.3,z,1.05,.9,1.05),col(PAL.hot),1.7);halo.add(5.5,x,y0+1.5,z,ember,.95);drape(glow,x,z,15,15,0,ember,.42);drape(soft,x,z,13,13,0,BLACK(),.5);
 for(let q=0;q<6;q++){const a=q/6*TAU+.2;drape(glow,x+1.4*Math.sin(a),z+1.4*Math.cos(a),5+q,.5,a,ember,.8,{mode:'line',nu:2,nv:4});}
 if(api.low)drape(shd,x,z,8/TAN_EL,5,SHD_ANG,BLACK(),.62,{mode:'shadow',nu:2,nv:8});}

// ---------- enemies: Parasite-infested war machines ----------
function parasiteColor(bin,r,g,b){if(bin===0)return new T.Color(.012,.011,.012);if(bin===1){const L=.2126*r+.7152*g+.0722*b;return new T.Color(L*.78,L*.7,L*.66);}
 if(bin===2)return new T.Color(r*1.25+.02,g*1.1+.015,b*1.15+.018);if(bin===3)return new T.Color(.17,.05,.024);return b>r?new T.Color(1,.32,.06):new T.Color(Math.max(r,.65),g*.5+.12,.03);}
function absorb(k,grp){grp.updateMatrixWorld(true);const inv=new T.Matrix4().copy(grp.matrixWorld).invert(),list=[];grp.traverse(o=>{if(o.isMesh)list.push(o);});
 list.forEach((o,idx)=>{const glow=o.material&&o.material.type==='MeshBasicMaterial',bin=glow?4:Math.min(idx,3),ca=o.geometry.attributes.color;
  k.add(o.geometry,new T.Matrix4().multiplyMatrices(inv,o.matrixWorld),col(0xffffff),glow?1.6:0,[.1,.55,.4,.7,0][bin],(v,n,i)=>ca?parasiteColor(bin,ca.getX(i),ca.getY(i),ca.getZ(i)):null);});}
function hullBox(p){const b={x0:1e9,x1:-1e9,y0:1e9,y1:-1e9,z0:1e9,z1:-1e9};for(let i=0;i<p.length;i+=3){const x=-p[i+2],y=p[i+1],z=p[i];if(x<b.x0)b.x0=x;if(x>b.x1)b.x1=x;if(y<b.y0)b.y0=y;if(y>b.y1)b.y1=y;if(z<b.z0)b.z0=z;if(z>b.z1)b.z1=z;}return b;}
function worldDecal(api,parent,len,wid,alpha,local){const fx=new Fx();drape(new FxView(fx,0),0,0,len,wid,0,BLACK(),alpha,{mode:'shadow',nu:2,nv:6,flat:.04,lift:0});const m=fx.mesh(M.decal,1);parent.add(m);LIVE.decals.push({m,local});}
function enemyHull(api,e){const g=new T.Group(),body=new T.Group();body.rotation.y=-PI/2;g.add(body);const low=api.low,P={n:'Parasite',hull:'#1d181c',tur:'#272024',trim:'#4d2a22'};
 const Hk=M3.chassisKit(e.cls||'scout',0,P,'#ff5a1e',[],false),hk=new Kit();absorb(hk,M3.meshOf(M3.bake(Hk.k),null,api.modelMats));const bb=hullBox(hk.p);
 const gun=new T.Group();gun.position.y=Hk.meta.ty;gun.scale.setScalar(M3.weaponScale(e.arch,e.cls));const wk=new Kit();absorb(wk,M3.meshOf(M3.bake(M3.weaponKit(e.arch,0,P,'#ff5a1e',false,e.cls).k),null,api.modelMats));const wm=wk.mesh();wm.castShadow=!low;gun.add(wm);body.add(gun);
 const w=(bb.x1-bb.x0)/2,len=bb.z1-bb.z0,ht=bb.y1-bb.y0,cz=(bb.z0+bb.z1)/2,gk=hk,chit=col('#120f13'),ember=col(PAL.ember),halo=new Halo();gk.frame=new T.Matrix4().makeRotationY(PI/2);
 for(const s of [-1,1]){gk.add(SPH(low?8:12,low?5:8),mtx(s*w*.48,bb.y1-.03*ht,bb.z0+.3*len,w*.3,.09*ht+.03,.3*len),chit,0,.55);gk.add(BOX(),mtx(s*(bb.x1+.004),bb.y0+.55*ht,cz,.02,.035*ht+.012,.58*len),ember,1.6);halo.add(1.1,s*(bb.x1+.05),bb.y0+.55*ht,cz,ember,.55);}
 for(let q=0;q<4;q++)gk.add(CONE(5),mtx(0,bb.y1+.06*ht,bb.z0+(.14+.1*q)*len,.06,.24*ht+.05,.06,-.6,0,0),chit,0,.4);
 gk.add(BOX(),mtx(0,bb.y0+.42*ht,bb.z0-.003,.55*w,.05*ht+.01,.02),ember,1.6);halo.add(1.4,0,bb.y0+.45*ht,bb.z0-.1,ember,.6);
 gk.frame=null;const hm=hk.mesh();hm.castShadow=!low;hm.receiveShadow=!low;body.add(hm);if(!low)addAll(g,halo.objects());
 const mk=new Kit();mk.add(OCT(),mtx(0,5.0,0,.36,.55,.36),col(PAL.red),1);const marker=mk.mesh();g.add(marker);
 if(!low){const fx=new Fx();drape(new FxView(fx,.5),0,cz,len*1.3,w*2.7,0,BLACK(),.62,{flat:.02,lift:0,nu:3,nv:3});g.add(fx.mesh(M.decal,1));}
 if(low)worldDecal(api,g,(ht*1.65)/TAN_EL/1.65+len*.5,w*2.1,.62,true);
 g.userData.gun=gun;g.userData.marker=marker;g.scale.setScalar(1.65);return g;}
function battery(api,e){const g=new T.Group(),k=new Kit(),low=api.low,seg=low?10:16,chit=col('#1a141b'),chit2=col('#251b23'),ember=col(PAL.ember),core=col('#ff3a12'),halo=new Halo(),bh=new Halo();
 k.add(SPH(seg,low?6:10),mtx(0,.85,0,3.15,1.95,2.65),chit,0,.35);k.add(SPH(seg,low?6:8),mtx(0,2.3,-.2,2.0,1.25,1.7),chit2,0,.35);
 for(let q=0;q<7;q++){const a=q/7*TAU+.3,px=2.62*Math.sin(a),pz=2.2*Math.cos(a);k.add(SPH(6,4),mtx(px,1.3,pz,.24,.17,.24),ember,1.6);bh.add(1.3,px*1.06,1.35,pz*1.06,ember,.6);}
 for(let q=0;q<6;q++){const a=q/6*TAU+PI/6,s=Math.sin(a),c=Math.cos(a),lim=(v,m)=>clamp(v,-m,m);const p0=[s*2.3,1.6,c*2.0],p1=[lim(s*3.25,3.3),1.95,lim(c*3.25,2.75)],p2=[lim(s*3.42,3.42),-.3,lim(c*3.42,2.92)];beam(k,p0,p1,.42,chit2,0,.3);beam(k,p1,p2,.3,chit,0,.3);}
 k.add(CYL(low?8:10,.55,.95),mtx(0,4.9,0,1,5.2,1),chit,0,.35);for(const y of [3.4,4.9,6.4])k.add(CYL(low?8:10),mtx(0,y,0,1.08,.26,1.08),chit2,0,.3);
 const bm=k.mesh();bm.castShadow=!low;bm.receiveShadow=!low;g.add(bm);if(!low)addAll(g,bh.objects());
 const gun=new T.Group(),gk=new Kit();gk.add(SPH(low?10:14,low?8:10),mtx(0,8.25,0,1.25,1.25,1.25),col('#e2380e'),.62,.8);
 for(let q=0;q<5;q++){const a=q/5*TAU,s=Math.sin(a),c=Math.cos(a);beam(gk,[s*.8,7,c*.8],[s*1.75,8.2,c*1.75],.26,chit2,0,.4);beam(gk,[s*1.75,8.2,c*1.75],[s*1.0,9.6,c*1.0],.22,chit2,0,.4);beam(gk,[s*1.0,9.6,c*1.0],[s*.25,10.2,c*.25],.16,chit,0,.4);}
 gk.add(CONE(6),mtx(0,8.25,2.0,.34,2.3,.34,PI/2,0,0),chit,0,.5);gk.add(CONE(6),mtx(0,10.45,0,.3,1.1,.3),chit,0,.4);
 const gm=gk.mesh();gm.castShadow=!low;gun.add(gm);halo.add(7,0,8.25,0,core,.55);if(!low)addAll(gun,halo.objects());g.add(gun);
 const mk=new Kit();mk.add(OCT(),mtx(0,11.35,0,.42,.62,.42),col(PAL.red),1);const marker=mk.mesh();g.add(marker);

 g.userData.gun=gun;g.userData.marker=marker;return g;}

// ---------- map: orbital survey photo of explored ground ----------
const MAPC={tiles:new Map(),cell:0};
function mapField(){if(MAPC.field)return MAPC.field;const F=craterField(256),mips=[{n:F.N,s:F.S,a:F.A}];
 while(mips[mips.length-1].n>32){const p=mips[mips.length-1],n=p.n/2,s=new Float32Array(n*n*2),a=new Float32Array(n*n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let sx=0,sz=0,aa=0;for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]){const j=(2*y+dy)*p.n+2*x+dx;sx+=p.s[j*2];sz+=p.s[j*2+1];aa+=p.a[j];}const i=y*n+x;s[i*2]=sx/4;s[i*2+1]=sz/4;a[i]=aa/4;}mips.push({n,s,a});}
 return MAPC.field=mips;}
function fieldAt(Lv,u,v,o){const n=Lv.n,x=u*n-.5,y=v*n-.5,x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,X0=((x0%n)+n)%n,X1=(X0+1)%n,Y0=((y0%n)+n)%n,Y1=(Y0+1)%n,a=Y0*n+X0,b=Y0*n+X1,c=Y1*n+X0,d=Y1*n+X1,wa=(1-fx)*(1-fy),wb=fx*(1-fy),wc=(1-fx)*fy,wd=fx*fy,S=Lv.s,A=Lv.a;
 o[0]=S[a*2]*wa+S[b*2]*wb+S[c*2]*wc+S[d*2]*wd;o[1]=S[a*2+1]*wa+S[b*2+1]*wb+S[c*2+1]*wc+S[d*2+1]*wd;o[2]=A[a]*wa+A[b]*wb+A[c]*wc+A[d]*wd;return o;}
function mapTile(tx,tz,d,low){const cs=MAPC.cell,key=tx+','+tz,n0=Math.floor(tx*128/cs)-1,m0=Math.floor(tz*128/cs)-1,nc=Math.round(128/cs)+2,fl=new Uint8Array(nc*nc);let any=0,sig='';
 for(let j=0;j<nc;j++)for(let i=0;i<nc;i++){const v=d.has((n0+i+.5)*cs,(m0+j+.5)*cs)?1:0;fl[j*nc+i]=v;sig+=v;if(v&&i>0&&j>0&&i<nc-1&&j<nc-1)any=1;}
 const old=MAPC.tiles.get(key);if(old&&old.sig===sig)return old.cv;if(!any){MAPC.tiles.set(key,{sig,cv:null});return null;}
 const res=low?2:1,n=128/res,cv=document.createElement('canvas');cv.width=cv.height=n;const c2=cv.getContext('2d'),img=c2.createImageData(n,n),D=img.data,x0=tx*128,z0=tz*128,GS=4,gn=128/GS+3,hg=new Float32Array(gn*gn),gx=new Float32Array(gn*gn),gz=new Float32Array(gn*gn);
 for(let j=0;j<gn;j++)for(let i=0;i<gn;i++)hg[j*gn+i]=W.heightAt(x0+(i-1)*GS,z0+(j-1)*GS);
 for(let j=1;j<gn-1;j++)for(let i=1;i<gn-1;i++){const q=j*gn+i;gx[q]=(hg[q+1]-hg[q-1])/(2*GS);gz[q]=(hg[q+gn]-hg[q-gn])/(2*GS);}
 const F=mapField(),o3=[0,0,0],o4=[0,0,0],Lx=-.56,Ly=.62,Lz=.55;
 for(let j=0;j<n;j++){const z=z0+128-(j+.5)*res;for(let i=0;i<n;i++){const x=x0+(i+.5)*res,o=(j*n+i)*4,ci=Math.floor(x/cs)-n0,cj=Math.floor(z/cs)-m0;if(!fl[cj*nc+ci]){D[o+3]=0;continue;}
  const lx=x-(n0+ci)*cs,lz=z-(m0+cj)*cs,rx=cs-lx,rz=cs-lz;let dm=99;
  if(!fl[cj*nc+ci-1])dm=Math.min(dm,lx);if(!fl[cj*nc+ci+1])dm=Math.min(dm,rx);if(!fl[(cj-1)*nc+ci])dm=Math.min(dm,lz);if(!fl[(cj+1)*nc+ci])dm=Math.min(dm,rz);
  if(!fl[(cj-1)*nc+ci-1])dm=Math.min(dm,Math.hypot(lx,lz));if(!fl[(cj-1)*nc+ci+1])dm=Math.min(dm,Math.hypot(rx,lz));if(!fl[(cj+1)*nc+ci-1])dm=Math.min(dm,Math.hypot(lx,rz));if(!fl[(cj+1)*nc+ci+1])dm=Math.min(dm,Math.hypot(rx,rz));
  const fade=smooth(0,10,dm),gxp=(x-x0)/GS+1,gzp=(z-z0)/GS+1,ia=Math.floor(gxp),ja=Math.floor(gzp),fx=gxp-ia,fz=gzp-ja,q=ja*gn+ia,wa=(1-fx)*(1-fz),wb=fx*(1-fz),wc=(1-fx)*fz,wd=fx*fz;
  const h=hg[q]*wa+hg[q+1]*wb+hg[q+gn]*wc+hg[q+gn+1]*wd,sx=gx[q]*wa+gx[q+1]*wb+gx[q+gn]*wc+gx[q+gn+1]*wd,sz=gz[q]*wa+gz[q+1]*wb+gz[q+gn]*wc+gz[q+gn+1]*wd;
  fieldAt(F[1],x/97,z/97,o3);fieldAt(F[3],(.8*x-.6*z)/23+.31,(.6*x+.8*z)/23+.57,o4);
  const bio=W.biomeAt(x,z),terra=bio==='terraformed',amp=terra?.4:.9,tX=sx+(o3[0]+(.8*o4[0]+.6*o4[1])*.75)*amp,tZ=sz+(o3[1]+(-.6*o4[0]+.8*o4[1])*.75)*amp,nl=1/Math.sqrt(tX*tX+tZ*tZ+1),lit=Math.max(0,(-tX*Lx+Ly-tZ*Lz)*nl);
  let v=.62*(1+o3[2]*.9+o4[2]*.6)*(terra?.68:bio==='massif'?1.1:1)*(.14+1.02*lit);
  const g2=Math.sqrt(sx*sx+sz*sz)+1e-3,lev=h/10,ix=Math.round(lev)%5===0,dpx=Math.abs(lev-Math.round(lev))*10/g2/res,line=clamp(1-dpx/(ix?1:.75),0,1)*(ix?.5:.24);
  v=clamp(v+(.9-v)*line,0,1)*fade;const vv=Math.sqrt(v)*.55+v*.45;D[o]=vv*246;D[o+1]=vv*250;D[o+2]=vv*255;D[o+3]=255;}}
 c2.putImageData(img,0,0);
 for(const p of W.scenery(tx,tz)){if(!d.has(p.x,p.z))continue;const px=(p.x-x0)/res,py=(z0+128-p.z)/res;
  if(p.kind==='rock'&&p.variant>.45){const rx=1.6*p.size/res,rz=p.size/res;c2.fillStyle='rgba(0,0,0,.6)';c2.beginPath();c2.ellipse(px+rx*.5,py+rz*.5,rx,rz,0,0,TAU);c2.fill();c2.fillStyle='rgba(222,222,216,.85)';c2.beginPath();c2.ellipse(px,py,rx*.8,rz*.8,0,0,TAU);c2.fill();}
  else if(p.kind==='tree'){const s=p.size/res;c2.fillStyle='rgba(214,180,222,.55)';c2.fillRect(px-1.2*s,py-.55*s,2.4*s,1.1*s);}}
 MAPC.tiles.set(key,{sig,cv});return cv;}
function mapIcon(ctx,kind,x,y,c){ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.lineJoin='round';ctx.lineWidth=2.2;ctx.strokeStyle='#010203';ctx.fillStyle=c;ctx.beginPath();
 if(kind==='diamond'){ctx.moveTo(0,-5.5);ctx.lineTo(4.5,0);ctx.lineTo(0,5.5);ctx.lineTo(-4.5,0);ctx.closePath();}
 else if(kind==='star'){for(let i=0;i<8;i++){const r=i%2?2.1:6.4,a=i*PI/4;ctx.lineTo(Math.sin(a)*r,-Math.cos(a)*r);}ctx.closePath();}
 else if(kind==='tri'){ctx.moveTo(0,-5.6);ctx.lineTo(5.3,4.2);ctx.lineTo(-5.3,4.2);ctx.closePath();}
 else if(kind==='flag'){ctx.moveTo(-3.6,6);ctx.lineTo(-3.6,-6);ctx.lineTo(5,-3.4);ctx.lineTo(-2.2,-.6);ctx.lineTo(-2.2,6);ctx.closePath();}
 else if(kind==='house'){ctx.moveTo(0,-6);ctx.lineTo(5.6,-.8);ctx.lineTo(4,-.8);ctx.lineTo(4,5);ctx.lineTo(-4,5);ctx.lineTo(-4,-.8);ctx.lineTo(-5.6,-.8);ctx.closePath();}
 else if(kind==='dot'){ctx.arc(0,0,4.4,0,TAU);}
 else if(kind==='wreck'){ctx.moveTo(0,-5.5);ctx.lineTo(4.5,0);ctx.lineTo(0,5.5);ctx.lineTo(-4.5,0);ctx.closePath();ctx.stroke();ctx.strokeStyle=c;ctx.lineWidth=1.4;ctx.stroke();ctx.restore();return;}
 else if(kind==='check'){ctx.moveTo(-5,0);ctx.lineTo(-1.5,4);ctx.lineTo(5.5,-4.5);ctx.stroke();ctx.strokeStyle=c;ctx.lineWidth=1.8;ctx.stroke();ctx.restore();return;}
 else if(kind==='alert'){ctx.arc(0,0,6.2,0,TAU);ctx.fillStyle='rgba(60,8,8,.85)';ctx.fill();ctx.stroke();ctx.strokeStyle=c;ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle=c;ctx.fillRect(-1,-4,2,5);ctx.fillRect(-1,2.4,2,1.8);ctx.restore();return;}
 else if(kind==='land'){ctx.arc(0,0,2.4,0,TAU);}
 ctx.stroke();ctx.fill();if(kind==='dot'){ctx.strokeStyle='rgba(121,220,232,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,8,0,TAU);ctx.stroke();}ctx.restore();}
function paintMap(ctx,m){const {scale,px,py}=m,d=m.discovery,S=m.state||{},unit=280/W.WIDTH*scale,X=x=>40+px+x*unit,Y=z=>py+420*scale-z*unit,F=LAB.FOOTPRINTS.refuge;
 if(!MAPC.cell){const cells=d.cellsIn({x:m.player.x-96,z:m.player.z-96,width:192,height:192});MAPC.cell=cells.length&&cells[0].size?cells[0].size:32;}
 ctx.setTransform(2,0,0,2,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.setLineDash([]);ctx.fillStyle='#010203';ctx.fillRect(0,0,360,420);
 const xa=(-40-px)/unit,xb=(320-px)/unit,zt=(py+420*scale)/unit,zb=(py+420*scale-420)/unit;ctx.imageSmoothingEnabled=true;
 for(let tz=Math.floor(zb/128);tz<=Math.floor(zt/128);tz++)for(let tx=Math.floor(xa/128);tx<=Math.floor(xb/128);tx++){const cv=mapTile(tx,tz,d,m.low);if(cv)ctx.drawImage(cv,X(tx*128),Y((tz+1)*128),128*unit+.6,128*unit+.6);}
 // survey grid (100 m)
 ctx.lineWidth=.5;ctx.strokeStyle='rgba(150,190,212,.12)';ctx.beginPath();for(let x=Math.ceil(xa/100)*100;x<=xb;x+=100){const s=Math.round(X(x))+.25;ctx.moveTo(s,0);ctx.lineTo(s,420);}for(let z=Math.ceil(zb/100)*100;z<=zt;z+=100){const s=Math.round(Y(z))+.25;ctx.moveTo(0,s);ctx.lineTo(360,s);}ctx.stroke();
 // sector boundaries
 ctx.lineWidth=.8;ctx.setLineDash([4,3]);for(const s of C.sectors){const own=S.territory?.[s.id]?.owner==='humanity';ctx.strokeStyle=own?'rgba(121,220,232,.5)':'rgba(255,121,114,.48)';ctx.beginPath();ctx.arc(X(s.x),Y(s.z),s.radius*unit,0,TAU);ctx.stroke();}ctx.setLineDash([]);
 // base structures (explored only) with sun shadows, like an orbital photo
 const disc=(x,z,r,fill,ring)=>{if(!d.has(x,z))return;const sx=X(x),sy=Y(z),rr=Math.max(1.6,r*unit);ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.arc(sx+rr*.45,sy+rr*.45,rr,0,TAU);ctx.fill();ctx.fillStyle=fill;ctx.beginPath();ctx.arc(sx,sy,rr,0,TAU);ctx.fill();if(ring){ctx.strokeStyle=ring;ctx.lineWidth=1;ctx.beginPath();ctx.arc(sx,sy,rr+1.2,0,TAU);ctx.stroke();}};
 for(const h of F.habitats)disc(h.x,h.z,7.8,'#dcded9');for(const p of F.processors)disc(p.x,p.z,12,'#c7cfd4','rgba(95,233,255,.85)');disc(F.terminal.x,F.terminal.z,5,'#20363c','rgba(95,240,255,.95)');
 ctx.fillStyle='#24406a';for(const s of F.solar)if(d.has(s.x,s.z))ctx.fillRect(X(s.x-s.w/2),Y(s.z+s.d/2),s.w*unit,s.d*unit);
 const vd=F.viaduct;if(d.has((vd.x0+vd.x1)/2,(vd.zA+vd.zB)/2)){ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(X(vd.x0)+2,Y(vd.zB)+2,(vd.x1-vd.x0)*unit,(vd.zB-vd.zA)*unit);ctx.fillStyle='#9aa2a8';ctx.fillRect(X(vd.x0),Y(vd.zB),(vd.x1-vd.x0)*unit,(vd.zB-vd.zA)*unit);}
 const bd=F.base;ctx.strokeStyle='rgba(255,201,107,.8)';ctx.setLineDash([2,2]);ctx.lineWidth=1;ctx.strokeRect(X(bd.x-bd.pad[0]/2),Y(bd.z+bd.pad[1]/2),bd.pad[0]*unit,bd.pad[1]*unit);ctx.setLineDash([]);
 // route line
 const pl=m.player,pp={x:X(pl.x),y:Y(pl.z)},rt=m.routeTarget;if(rt){const q={x:X(rt.x),y:Y(rt.z)};ctx.save();ctx.setLineDash([5,4]);ctx.lineWidth=1.6;ctx.strokeStyle='#f4cf77';ctx.beginPath();ctx.moveTo(pp.x,pp.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(q.x,q.y,5.5,0,TAU);ctx.moveTo(q.x-8,q.y);ctx.lineTo(q.x-3,q.y);ctx.moveTo(q.x+3,q.y);ctx.lineTo(q.x+8,q.y);ctx.stroke();ctx.restore();}
 // markers (every game marker kept, same meaning) + prioritised labels that never pile up
 const mk=[],add=(x,z,kind,color,label,pri)=>mk.push({x:X(x),y:Y(z),kind,color,label,pri});
 for(const s of C.installations)if(d.has(s.x,s.z)){const own=S.territory?.[s.id]?.owner==='humanity';add(s.x,s.z,own?'flag':'tri',own?'#82e8ce':'#ff7972',s.name,5);}
 const ops=Object.values(C.operations);for(const o of ops){if(o.raid||o.defense||o.id==='base-defense'||o.id==='oxygen-line'||C.installations.some(s=>s.id===o.site))continue;const sec=S.territory?.[o.site]?.owner==='humanity';add(o.x,o.z,sec?'flag':'diamond',sec?'#82e8ce':'#f1cd7e',o.name,6);}
 const unlocked=C.raidsUnlocked(S.completed);for(const sector of C.sectors){const list=ops.filter(o=>o.raid&&o.sector===sector.id);if(list.length){const cleared=list.filter(o=>S.completed?.[o.id]).length,done=cleared===list.length;add(list.reduce((n,o)=>n+o.x,0)/list.length,list.reduce((n,o)=>n+o.z,0)/list.length,done?'check':'star',done?'#82e8ce':unlocked?'#ffb56b':'#8a8f96',sector.name+(unlocked?' RAIDS '+cleared+'/'+list.length:' RAIDS · LOCKED'),4);}
  if(C.sectorDefenseOpen(S.territory?.[sector.id],sector.id)){const o=ops.find(o=>o.defense&&o.sector===sector.id);if(o)add(o.x,o.z,'alert','#ff7972',(S.territory[sector.id].owner==='humanity'?'DEFEND ':'RETAKE ')+sector.name,3);}}
 add(C.baseDefinition.x,C.baseDefinition.z,'house','#ffc96b','COMMAND BASE '+(S.base?.tier?'T'+S.base.tier:'SITE'),2);
 for(const w of S.wrecks||[])if(d.has(w.x,w.z))add(w.x,w.z,'wreck','#8ee6ef','PERSONAL WRECK',7);
 add(C.refuge.x,C.refuge.z,'dot','#79dce8','REFUGE',1);
 for(const l of W.landmarks)if(d.has(l.x,l.z))add(l.x,l.z,'land','#b9c3c9',l.name.toUpperCase(),8);
 for(const o of mk)if(o.x>-10&&o.x<370&&o.y>-10&&o.y<430)mapIcon(ctx,o.kind,o.x,o.y,o.color);
 // YOU arrow + heading
 ctx.save();ctx.translate(pp.x,pp.y);ctx.fillStyle='rgba(105,215,255,.22)';ctx.beginPath();ctx.arc(0,0,11,0,TAU);ctx.fill();ctx.strokeStyle='#e7f9ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,11,0,TAU);ctx.stroke();ctx.rotate(pl.heading);ctx.fillStyle='#69d7ff';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();ctx.restore();
 const boxes=[{x:pp.x-13,y:pp.y-13,w:26,h:26},{x:0,y:0,w:150,h:15},{x:300,y:0,w:60,h:26},{x:0,y:392,w:132,h:28},{x:214,y:404,w:146,h:16}],hit=b=>b.x<1||b.y<1||b.x+b.w>359||b.y+b.h>419||boxes.some(o=>b.x<o.x+o.w&&b.x+b.w>o.x&&b.y<o.y+o.h&&b.y+b.h>o.y);
 for(const o of mk)boxes.push({x:o.x-6,y:o.y-6,w:12,h:12});
 const ls=typeof ctx.letterSpacing==='string',label=(x,y,text,color,font,cands)=>{ctx.font=font;if(ls)ctx.letterSpacing='.6px';const w=ctx.measureText(text).width,h=11;for(const [ox,oy,al] of cands){const lx=al==='c'?x-w/2+ox:al==='r'?x-w+ox:x+ox,b={x:lx-1,y:y+oy-h+2,w:w+2,h:h};if(hit(b))continue;boxes.push(b);ctx.lineWidth=3;ctx.lineJoin='round';ctx.strokeStyle='rgba(1,2,3,.92)';ctx.strokeText(text,lx,y+oy);ctx.fillStyle=color;ctx.fillText(text,lx,y+oy);if(ls)ctx.letterSpacing='0px';return true;}if(ls)ctx.letterSpacing='0px';return false;};
 const LF='600 10px "Chakra Petch", ui-sans-serif, system-ui, sans-serif',C8=[[9,4,'l'],[-9,4,'r'],[0,-9,'c'],[0,17,'c'],[9,-6,'l'],[9,14,'l'],[-9,-6,'r'],[-9,14,'r']];
 label(pp.x,pp.y,'YOU','#ffffff','700 11px "Chakra Petch", ui-sans-serif, system-ui, sans-serif',[[0,-15,'c'],[0,24,'c'],[15,4,'l']]);
 for(const o of mk.slice().sort((a,b)=>a.pri-b.pri))if(o.x>0&&o.x<360&&o.y>0&&o.y<420)label(o.x,o.y,o.label,o.pri===8?'#aeb8be':o.color,LF,C8);
 for(const s of C.sectors){const sx=X(s.x),sy=Y(s.z+s.radius);if(sx>0&&sx<360&&sy>0&&sy<420)label(sx,sy,s.name,S.territory?.[s.id]?.owner==='humanity'?'rgba(121,220,232,.8)':'rgba(255,140,130,.8)',LF,[[0,-3,'c'],[0,12,'c']]);}
 // furniture: header, north, scale bar, coordinates (monospace)
 const MF='10px ui-monospace, "SF Mono", Menlo, Consolas, monospace';ctx.font=MF;ctx.fillStyle='rgba(190,205,214,.85)';ctx.fillText('ORBITAL SURVEY · 10 m CONTOURS',6,11);
 ctx.save();ctx.translate(342,13);ctx.fillStyle='#e7f0f4';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(4,3);ctx.lineTo(0,1);ctx.lineTo(-4,3);ctx.closePath();ctx.fill();ctx.font='600 10px "Chakra Petch", sans-serif';ctx.textAlign='center';ctx.fillText('N',0,14);ctx.restore();ctx.textAlign='left';
 const bar=100*unit;ctx.fillStyle='rgba(1,2,3,.75)';ctx.fillRect(4,394,Math.max(124,bar+52),25);ctx.strokeStyle='#e4ecef';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(10.5,398);ctx.lineTo(10.5,403.5);ctx.lineTo(10.5+bar,403.5);ctx.lineTo(10.5+bar,398);ctx.moveTo(10.5+bar/2,400);ctx.lineTo(10.5+bar/2,403.5);ctx.stroke();
 ctx.fillStyle='#e4ecef';ctx.font=MF;ctx.fillText('100 m',15+bar,405);ctx.fillStyle='rgba(190,205,214,.8)';ctx.fillText(Math.round(W.WIDTH/scale)+' m FRAME',10,418);
 const hd=((pl.heading/DEG)%360+360)%360,txt='X'+String(Math.round(pl.x)).padStart(5,' ')+' Z'+String(Math.round(pl.z)).padStart(5,' ')+' HDG '+String(Math.round(hd)).padStart(3,'0');ctx.fillStyle='rgba(1,2,3,.75)';const tw=ctx.measureText(txt).width;ctx.fillRect(354-tw-4,405,tw+8,14);ctx.fillStyle='#bfe9f5';ctx.fillText(txt,354-tw,415);
 ctx.strokeStyle='rgba(120,140,150,.5)';ctx.lineWidth=1;ctx.strokeRect(40.5+px,py+.5,280*scale-1,420*scale-1);}

// ---------- register ----------
LAB.register({
 id:'a',name:'TRANQUILITY · HARD-SCI REALISM',
 summary:'Black sky, dense stars and a real Earth on the horizon; harsh low sun over grey cratered regolith; sandbag-shielded habs, ISRU towers, greenhouse tubes; obsidian Parasite monoliths with ember fissures; orbital-survey relief map.',
 async prepare(api){setup(api);PROPS(api);},
 environment(api){setup(api);const {scene,renderer}=api,low=api.low;scene.background=new T.Color(0x000000);scene.fog=new T.Fog(0x000000,1700,2700);renderer.toneMappingExposure=1.08;
  const f=SHADOW_FRAME[api.subject]||{x:api.origin.x+64,z:api.origin.z+64,r:60,h:20},tx=f.x-api.origin.x,tz=f.z-api.origin.z,ty=ground(f.x,f.z),sun=new T.DirectionalLight(0xfff0dc,low?4.4:4.6);
  sun.position.set(tx+SUN[0]*700,ty+SUN[1]*700,tz+SUN[2]*700);sun.target.position.set(tx,ty,tz);scene.add(sun,sun.target);
  if(!low){renderer.shadowMap.enabled=true;sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);const c=sun.shadow.camera,se=Math.sin(SUN_EL),ce=Math.cos(SUN_EL);c.left=-f.r;c.right=f.r;c.top=f.r*se+f.h*ce+4;c.bottom=-f.r*se-4;c.near=Math.max(1,700-f.r*1.3-60);c.far=700+f.r*1.3+60;c.updateProjectionMatrix();sun.shadow.bias=-.0006;sun.shadow.normalBias=f.r>100?.6:.12;}
  scene.add(new T.HemisphereLight(0x46597a,0x5a554c,low?1.4:1.25));
  const E=earthPlacement(api),ef=new T.DirectionalLight(0x8eaaff,.3);ef.position.set(E.dir[0]*100,E.dir[1]*100+15,E.dir[2]*100);scene.add(ef);
  SKY.group=buildSky(api,E);scene.add(SKY.group);},
 terrainMaterial(api){setup(api);return M.terrain;},
 props(api,items,chunk){setup(api);PROPS(api);const g=new T.Group(),ox=chunk.cx*128,oz=chunk.cz*128,low=api.low,L={rock:[],green:[],algae:[],stake:[],relay:[]};
  for(const p of items){if(p.kind==='rock'){if(p.variant>.45)L.rock.push(p);}else if(p.kind==='tree'){const v=p.variant;if(low)(v<.5?L.green:L.algae).push(p);else (v<.34?L.green:v<.67?L.algae:L.stake).push(p);}else if(p.kind==='relay')L.relay.push(p);}
  instanced(g,L.rock,'rock',ox,oz,true);instanced(g,L.green,'green',ox,oz,false);instanced(g,L.algae,'algae',ox,oz,false);instanced(g,L.stake,'stake',ox,oz,false);instanced(g,L.relay,'relay',ox,oz,true);return g;},
 refuge(api,f){setup(api);const g=new T.Group(),k=new Kit(),glow=new Fx(),dec=new Fx(),soft=new FxView(dec,.5),shd=new FxView(dec,0),halo=new Halo();
  f.habitats.forEach((h,i)=>habitat(api,k,glow,soft,shd,halo,h,i));f.processors.forEach((p,i)=>processor(api,k,glow,soft,shd,halo,p,i));terminal(api,k,glow,soft,halo,f.terminal);for(const s of f.solar)solarPanel(api,k,shd,s);
  const mesh=k.mesh();mesh.castShadow=!api.low;mesh.receiveShadow=!api.low;g.add(mesh);addAll(g,[dec.mesh(M.decal,1),glow.mesh(M.add,2),...halo.objects()]);finalize(api);return g;},
 raidSite(api,f){setup(api);const g=new T.Group(),k=new Kit(),glow=new Fx(),dec=new Fx(),soft=new FxView(dec,.5),shd=new FxView(dec,0),halo=new Halo();
  installation(api,k,glow,soft,shd,halo,f.installation);f.obstacles.forEach((o,i)=>barrier(api,k,glow,soft,shd,halo,o,i));hive(api,k,glow,soft,shd,halo,f.raidArt);
  for(const [x,z,r] of [[903,947,3.5],[934,931,4.5],[949,958,3],[927,921,5],[968,939,3.8],[889,957,2.6],[957,925,4.2]]){drape(soft,x,z,r*2,r*2,0,BLACK(),.5,{nu:4,nv:4});drape(soft,x,z,r*3.4,r*3.4,0,BLACK(),.18,{nu:4,nv:4});}
  for(const b of f.batteries){drape(glow,b.x,b.z,9.5,9.5,0,col(PAL.ember),.5,{nu:4,nv:4});drape(soft,b.x,b.z,10.5,9.5,0,BLACK(),.55,{nu:4,nv:4});if(api.low)drape(shd,b.x,b.z,10.5/TAN_EL,4.5,SHD_ANG,BLACK(),.62,{mode:'shadow',nu:2,nv:8});}
  const mesh=k.mesh();mesh.castShadow=!api.low;mesh.receiveShadow=!api.low;g.add(mesh);addAll(g,[dec.mesh(M.decal,1),glow.mesh(M.add,2),...halo.objects()]);finalize(api);return g;},
 playerTank(api,vehicle){setup(api);const low=api.low;vehicle.traverse(o=>{if(o.isMesh){o.castShadow=!low;o.receiveShadow=!low;}});
  vehicle.updateMatrixWorld(true);const inv=new T.Matrix4().copy(vehicle.matrixWorld).invert(),gun=vehicle.userData.gun,b={x0:1e9,x1:-1e9,y0:1e9,y1:-1e9,z0:1e9,z1:-1e9},v=new T.Vector3();
  vehicle.traverse(o=>{if(!o.isMesh)return;let p=o,inGun=false;while(p){if(p===gun){inGun=true;break;}p=p.parent;}if(inGun)return;const m=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld),pa=o.geometry.attributes.position;for(let i=0;i<pa.count;i+=3){v.fromBufferAttribute(pa,i).applyMatrix4(m);if(v.x<b.x0)b.x0=v.x;if(v.x>b.x1)b.x1=v.x;if(v.y<b.y0)b.y0=v.y;if(v.y>b.y1)b.y1=v.y;if(v.z<b.z0)b.z0=v.z;if(v.z>b.z1)b.z1=v.z;}});
  const s=vehicle.scale.x||1,cx=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2,lx=b.x1-b.x0,lz=b.z1-b.z0,ht=b.y1-b.y0,fx=new Fx(),wrap=new T.Group();
  if(!low){drape(new FxView(fx,.5),cx*s,cz*s,lz*s*1.28,lx*s*1.38,0,BLACK(),.66,{flat:b.y0*s+.03,lift:0,nu:4,nv:4});wrap.add(fx.mesh(M.decal,1));}
  const k=new Kit(),halo=new Halo(),cy=col('#62ecff'),ym=(b.y0+.5*ht)*s;
  for(const sd of [-1,1]){k.add(BOX(),mtx(sd*(b.x1*s+.012),ym,cz*s,.02,.035,lz*s*.42),cy,1);k.add(BOX(),mtx(sd*b.x1*s*.8,(b.y0+.58*ht)*s,b.z1*s+.012,.12,.05,.02),cy,1);halo.add(.9,sd*b.x1*s*.8,(b.y0+.58*ht)*s,b.z1*s+.1,cy,.38);halo.add(.6,sd*(b.x1*s+.05),ym,cz*s,cy,.4);k.add(BOX(),mtx(sd*b.x1*s*.8,(b.y0+.58*ht)*s,b.z0*s-.012,.12,.05,.02),col('#ff4b3e'),1);}
  wrap.add(k.mesh());if(!low)addAll(wrap,halo.objects());if(low)worldDecal(api,wrap,ht*s/TAN_EL+lz*s*.4,lx*s*1.05,.62,false);
  vehicle.position.set(0,0,0);wrap.add(vehicle);wrap.userData={...vehicle.userData};finalize(api);return wrap;},
 enemy(api,e){setup(api);finalize(api);return e.immobile?battery(api,e):enemyHull(api,e);},
 propLineup(api,at){setup(api);PROPS(api);const k=new Kit(),g=new T.Group(),dx=-.112,dz=-.994,px=-dz,pz=dx;
  for(const [kind,dist,lat,size,v] of [['stake',1.5,-1.4,1,.8],['algae',5,1.5,1.4,.5],['green',10.5,-1.8,1.7,.2],['rock',16,1.9,1.2,.6],['rock',21,-2.1,2.1,.8],['rock',28,2.4,3.3,.95],['relay',35,-2.8,1.4,.5],['green',41,2.6,3.2,.1]]){
   const x=at.x+dx*dist+px*lat,z=at.z+dz*dist+pz*lat;TMP.position.set(0,0,0);TMP.rotation.set(0,0,0,'XYZ');TMP.scale.set(1,1,1);PLACE[kind](TMP,{x,z,y:ground(x,z),size,variant:v,kind});TMP.position.x+=x;TMP.position.z+=z;TMP.updateMatrix();k.add(PG[kind],TMP.matrix.clone(),null);}
  const mesh=k.mesh();mesh.castShadow=!api.low;mesh.receiveShadow=!api.low;g.add(mesh);finalize(api);return g;},
 mapCss:'.cq-map canvas{background:#010203;border:1px solid #2c3338;border-radius:2px}.cq-map .cq-map-legend b{font-weight:700}',
 mapLegend:'Orbital survey relief of explored ground only (10 m contours). <b style="color:#f1cd7e">◆</b> Mission · <b style="color:#ffb56b">✦</b> Raid site (five families; grey locked, <b style="color:#82e8ce">✓</b> cleared) · <b style="color:#ff7972">!</b> Defense alert · <b style="color:#79dce8">●</b> Friendly facility · <b style="color:#ffc96b">⌂</b> Command Base · <b style="color:#ff7972">▲</b> Parasite installation / <b style="color:#82e8ce">⚑</b> captured · <b style="color:#8ee6ef">◇</b> Personal wreck. Drag to pan · pinch or + / − to zoom · north ↑.',
 map(ctx,m){paintMap(ctx,m);},
 update(api,dt,t){const cam=api.camera;if(SKY.group){SKY.group.position.copy(cam.position);if(SKY.earth)SKY.earth.quaternion.copy(cam.quaternion);}U.pulse.value=.82+.18*Math.sin(t*2.4);
  if(!LIVE.fin){finalize(api);LIVE.fin=true;}
  for(const d of LIVE.decals){const p=d.m.parent;if(!p)continue;p.updateMatrixWorld(true);p.matrixWorld.decompose(V1,QQ,V2);const q=QQ.clone().invert();d.m.quaternion.copy(q).multiply(new T.Quaternion().setFromAxisAngle(QY,SHD_ANG));d.m.position.set(0,0,0);}}
});
})(globalThis);
