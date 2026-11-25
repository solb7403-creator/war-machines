/* LUNAR Conquest world kit (Session 5E-2d1, owner Nov 11 + Nov 19): every code-drawn building and prop of the Conquest world
 * and town, rebuilt to the detail of the owner's Meshy town items, behind SWAPPABLE SLOTS.
 *
 * - ConquestSlots.items (js/conquest/slots.js) is the one model list (the pattern of js/assets/meshy-v1/manifest.json): a
 *   stable id per kind with its size box, ground fit and, when the owner supplies one, the Meshy item that replaces the
 *   code-built model ("model": "<id in js/assets/meshy-v1/manifest.json>"). Placement, footprint and collision never come
 *   from a model: they come from ConquestWorld / ConquestPlot and the slot, so a swap changes looks only.
 * - ConquestWorldKit.model(id, build) registers the code-built model of a slot (js/conquest/kit/*.js). build(b, o) draws in
 *   model space (metres, +y up, the footprint centred on the origin, the front facing +z, the ground at y = 0) with the
 *   toolkit below; o carries the placement's own size (w, d, h), a seed and the level. b.hi is false on LOW: a LOW model
 *   keeps the silhouette and drops the small parts.
 * - ConquestWorldKit.kit(S) binds the toolkit to one ConquestStyle instance: place() appends a model to a merged batch,
 *   geometry() returns it for an instanced draw, swap bookkeeping hands replaced slots to Meshy3D.
 * Presentation only. THREE is touched only through the style instance (the game loads three.js after boot). */
(function(root){
'use strict';
const TAU=Math.PI*2,clamp01=v=>v<0?0:v>1?1:v;
// The one Parasite red (owner, Nov 21): every Parasite glow, vein, marker, shot and burst reads from here.
const PAR={red:0xff2030,hot:0xff7a5c,deep:0xa01018};
const MODELS={},MY3D=()=>typeof Meshy3D!=='undefined'?Meshy3D:root.Meshy3D;   // the Meshy loader is a top-level const in the page (not a window property)
function model(id,build,o){MODELS[id]={build,o:o||{}};}
// Surface codes ride in the vertex alpha below zero (0..2 stays "emission", as before): the solid shader paints the
// material's detail on HIGH (panel seams, rust, planks, pores, corrugation...) with no texture from an artist and no new
// shader program. alpha = -(code + 0.9 * wear) / 10.
const SURF={flat:0,metal:1,paint:2,timber:3,concrete:4,glass:5,scrap:6,cloth:7,chitin:8,leaf:9,rock:10,dirt:11,solar:12,bark:13,ice:14};
const surfA=(code,wear=0)=>code?-(code+.9*clamp01(wear))/10:0;
function hash(n){let h=Math.imul(n|0,374761393)^0x5bd1e995;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function rng(seed){let s=(seed|0)||7403;return ()=>(s=(Math.imul(s,1664525)+1013904223)|0,(s>>>0)/4294967296);}

function kit(S){if(S.worldKit)return S.worldKit;
 const T=S.T,hi=!S.low,_m=new T.Matrix4(),_m2=new T.Matrix4(),_nm=new T.Matrix4(),_v=new T.Vector3(),_n=new T.Vector3(),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3(),_a=new T.Vector3(),_b=new T.Vector3(),_c=new T.Vector3();
 const col=h=>{const c=h&&h.isColor?h:new T.Color(h);return [c.r,c.g,c.b];};
 // a material = linear colour + vertex alpha (emission 0..2, or a surface code below zero) + optional per-part jitter
 const mat=(hex,surf=0,wear=0,j=.05)=>({c:col(hex),a:typeof surf==='string'?surfA(SURF[surf],wear):surf,j});
 const glow=(hex,k=1)=>({c:col(hex),a:Math.min(2,k),j:0});
 const tint=(m,k,add=0)=>({c:[m.c[0]*k+add,m.c[1]*k+add,m.c[2]*k+add],a:m.a,j:m.j});
 const mix=(m,n,t)=>({c:[m.c[0]+(n.c[0]-m.c[0])*t,m.c[1]+(n.c[1]-m.c[1])*t,m.c[2]+(n.c[2]-m.c[2])*t],a:m.a,j:m.j});
 const rect=(w,d,ch=0,cx=0,cz=0)=>{const x=w/2,z=d/2;if(!(ch>0))return [[cx-x,cz-z],[cx+x,cz-z],[cx+x,cz+z],[cx-x,cz+z]];const c=Math.min(ch,x*.98,z*.98);
  return [[cx-x+c,cz-z],[cx+x-c,cz-z],[cx+x,cz-z+c],[cx+x,cz+z-c],[cx+x-c,cz+z],[cx-x+c,cz+z],[cx-x,cz+z-c],[cx-x,cz-z+c]];};
 const circ=(r,n=12,cx=0,cz=0,rz=r,rot=0)=>Array.from({length:n},(_,i)=>{const a=i/n*TAU+rot;return [cx+Math.cos(a)*r,cz+Math.sin(a)*rz];});
 const unit={torus:new T.TorusGeometry(1,.09,5,hi?20:12),torusThin:new T.TorusGeometry(1,.045,4,hi?20:12),ico:new T.IcosahedronGeometry(1,hi?1:0),ico0:new T.IcosahedronGeometry(1,0),octa:new T.OctahedronGeometry(1,0)};
 for(const g of Object.values(unit)){g.userData.hfShared=true;S.shared.push(g);}

 // ------------------------------------------------------------------ the builder ---------------------------------------
 class KB{
  constructor(o={}){this.hi=hi&&!o.lod;this.o=o;this.buf={main:{P:[],N:[],A:[],I:[],n:0},det:{P:[],N:[],A:[],I:[],n:0}};this.cur=this.buf.main;this.fx=[];this.st=[new T.Matrix4()];this.aoH=o.aoH??2.2;this.aoMin=o.aoMin??.62;this.rnd=rng(o.seed||1);this.jit=1;}
  get M(){return this.st[this.st.length-1];}
  // run fn with a local frame (translate, yaw, then pitch/roll, uniform scale)
  at(x,y,z,ry,fn,rx=0,rz=0,s=1){_e.set(rx,ry,rz,'YXZ');_q.setFromEuler(_e);const m=new T.Matrix4().compose(_p.set(x,y,z),_q,_s.set(s,s,s));this.st.push(new T.Matrix4().multiplyMatrices(this.M,m));try{fn(this);}finally{this.st.pop();}return this;}
  // small parts go to the detail batch (it drops out with distance); HIGH-only parts are skipped on LOW
  detail(fn){const c=this.cur;this.cur=this.buf.det;try{fn(this);}finally{this.cur=c;}return this;}
  high(fn){if(this.hi)fn(this);return this;}
  part(){this.jit=1+((this.rnd()-.5)*2);return this;}   // a new jitter value for the next primitive(s)
  _v(x,y,z,nx,ny,nz,m){const B=this.cur,e=this.M.elements,px=e[0]*x+e[4]*y+e[8]*z+e[12],py=e[1]*x+e[5]*y+e[9]*z+e[13],pz=e[2]*x+e[6]*y+e[10]*z+e[14];
   let ax=e[0]*nx+e[4]*ny+e[8]*nz,ay=e[1]*nx+e[5]*ny+e[9]*nz,az=e[2]*nx+e[6]*ny+e[10]*nz;const l=Math.hypot(ax,ay,az)||1;ax/=l;ay/=l;az/=l;
   let k=1;if(!(m.a>0)){const t=clamp01(py/this.aoH);k=this.aoMin+(1-this.aoMin)*t*(2-t);if(ay>.6)k*=1.07;else if(ay<-.5)k*=.72;k*=1+(m.j||0)*(this.jit-1);}
   B.P.push(px,py,pz);B.N.push(ax,ay,az);B.A.push(m.c[0]*k,m.c[1]*k,m.c[2]*k,m.a);return B.n++;}
  // flat quad a,b,c,d (any winding): the normal is turned toward `out` (a point the face looks away from is its inside)
  quad(a,b,c,d,m,inside){const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz);if(l<1e-9)return this;nx/=l;ny/=l;nz/=l;
   let flip=false;if(inside){const cx=(a[0]+b[0]+c[0]+d[0])/4-inside[0],cy=(a[1]+b[1]+c[1]+d[1])/4-inside[1],cz=(a[2]+b[2]+c[2]+d[2])/4-inside[2];flip=nx*cx+ny*cy+nz*cz<0;}if(flip){nx=-nx;ny=-ny;nz=-nz;}
   const i0=this._v(a[0],a[1],a[2],nx,ny,nz,m),i1=this._v(b[0],b[1],b[2],nx,ny,nz,m),i2=this._v(c[0],c[1],c[2],nx,ny,nz,m),i3=this._v(d[0],d[1],d[2],nx,ny,nz,m),I=this.cur.I;if(flip)I.push(i0,i2,i1,i0,i3,i2);else I.push(i0,i1,i2,i0,i2,i3);return this;}
  tri(a,b,c,m,inside){return this.quad(a,b,c,c,m,inside);}
  // convex polygon in a horizontal plane (ring of [x,z]) at height y; up=true faces +y
  cap(ring,y,m,up=true){const n=ring.length;let cx=0,cz=0;for(const p of ring){cx+=p[0];cz+=p[1];}cx/=n;cz/=n;const ny=up?1:-1,i0=this._v(cx,y,cz,0,ny,0,m),I=this.cur.I,ids=ring.map(p=>this._v(p[0],y,p[1],0,ny,0,m));
   // ring order may be either way: orient by the signed area
   let ar=0;for(let i=0;i<n;i++){const p=ring[i],q=ring[(i+1)%n];ar+=p[0]*q[1]-q[0]*p[1];}const ccw=ar>0;   // (x,z) ccw = clockwise seen from +y
   for(let i=0;i<n;i++){const j=(i+1)%n;if(ccw===up)I.push(i0,ids[j],ids[i]);else I.push(i0,ids[i],ids[j]);}return this;}
  // loft: rings [{p:[[x,z]...], y}] with one vertex count; m = material, or (band, side) => material. o.smooth: radial normals
  loft(rings,m,o={}){const n=rings[0].p.length,mf=typeof m==='function'?m:()=>m;
   for(let r=0;r<rings.length-1;r++){const A=rings[r],B=rings[r+1];let cx=0,cz=0;for(const p of A.p){cx+=p[0];cz+=p[1];}for(const p of B.p){cx+=p[0];cz+=p[1];}cx/=2*n;cz/=2*n;const cy=(A.y+B.y)/2;
    if(o.smooth){const I=this.cur.I,ids=[],dy=B.y-A.y;for(const R of [A,B])for(let i=0;i<n;i++){const p=R.p[i],ra=Math.hypot(A.p[i][0]-cx,A.p[i][1]-cz),rb=Math.hypot(B.p[i][0]-cx,B.p[i][1]-cz);let nx=p[0]-cx,nz=p[1]-cz;const rl=Math.hypot(nx,nz)||1;nx/=rl;nz/=rl;
      const ny=Math.abs(dy)>1e-6?-(rb-ra)/dy:(rb<ra?50:-50),l=Math.hypot(1,ny);ids.push(this._v(p[0],R.y,p[1],nx/l,ny/l,nz/l,mf(r,i)));}
     let ar=0;for(let i=0;i<n;i++){const p=A.p[i],q=A.p[(i+1)%n];ar+=p[0]*q[1]-q[0]*p[1];}const ccw=ar>0,up=B.y>=A.y;
     for(let i=0;i<n;i++){const j=(i+1)%n,a=ids[i],b=ids[j],c=ids[n+j],d=ids[n+i];if(ccw===up)I.push(a,c,b,a,d,c);else I.push(a,b,c,a,c,d);}}
    else for(let i=0;i<n;i++){const j=(i+1)%n,a=A.p[i],b=A.p[j],c=B.p[j],d=B.p[i];this.quad([a[0],A.y,a[1]],[b[0],A.y,b[1]],[c[0],B.y,c[1]],[d[0],B.y,d[1]],mf(r,i),[cx,cy,cz]);}}
   if(o.top!==false)this.cap(rings[rings.length-1].p,rings[rings.length-1].y,o.topMat||mf(rings.length-2,-1),true);if(o.bot)this.cap(rings[0].p,rings[0].y,mf(0,-1),false);return this;}
  // plain box: centre x/z, BASE y (everything in the kit stands on its base)
  box(x,y,z,w,h,d,m,ry=0){if(ry)return this.at(x,y,z,ry,b=>b.box(0,0,0,w,h,d,m));return this.loft([{p:rect(w,d,0,x,z),y},{p:rect(w,d,0,x,z),y:y+h}],m,{bot:true});}
  // bevelled box: chamfered edges catch the light (the "edge highlight" every premium hard-surface model has). LOW: a box.
  bev(x,y,z,w,h,d,m,o={}){if(o.ry)return this.at(x,y,z,o.ry,b=>b.bev(0,0,0,w,h,d,m,Object.assign({},o,{ry:0})));if(!this.hi)return this.box(x,y,z,w,h,d,m);
   const ch=Math.min(o.ch??.1,w*.3,h*.3,d*.3),e=o.edge||tint(m,o.e??1.28,.012),top=o.top||tint(m,1.06);
   return this.loft([{p:rect(w-2*ch,d-2*ch,ch,x,z),y},{p:rect(w,d,ch,x,z),y:y+ch},{p:rect(w,d,ch,x,z),y:y+h-ch},{p:rect(w-2*ch,d-2*ch,ch,x,z),y:y+h}],(r,i)=>r!==1||i%2===0?(r===1?m:e):e,{bot:!!o.bot,topMat:top});}
  // upright cylinder / frustum (r2 = top radius); o.n sides, o.bev rim chamfer, o.rz elliptical depth
  cyl(x,y,z,r,h,m,o={}){const n=o.n||(this.hi?14:8),r2=o.r2??r,k=o.rz?o.rz/r:1,bv=this.hi?Math.min(o.bev||0,h*.3,r*.5):0,R=[];
   if(bv)R.push({p:circ(r-bv,n,x,z,(r-bv)*k),y});R.push({p:circ(r,n,x,z,r*k),y:y+bv});R.push({p:circ(r2,n,x,z,r2*k),y:y+h-bv});if(bv)R.push({p:circ(r2-bv,n,x,z,(r2-bv)*k),y:y+h});
   return this.loft(R,o.band||m,{smooth:o.flat?false:true,bot:!!o.bot,top:o.top!==false,topMat:o.topMat||tint(m,1.06)});}
  // tube between two points (pipes, struts, barrels); n sides, r2 = end radius
  tube(a,b,r,m,o={}){const n=o.n||(this.hi?7:4),r2=o.r2??r;_a.set(a[0],a[1],a[2]);_b.set(b[0],b[1],b[2]);const d=_c.subVectors(_b,_a),L=d.length();if(L<1e-6)return this;d.multiplyScalar(1/L);
   const ux=Math.abs(d.y)>.99?1:0,uy=Math.abs(d.y)>.99?0:1;let sx=d.y*0-d.z*uy,sy=d.z*ux-d.x*0,sz=d.x*uy-d.y*ux;const sl=Math.hypot(sx,sy,sz);sx/=sl;sy/=sl;sz/=sl;const tx=d.y*sz-d.z*sy,ty=d.z*sx-d.x*sz,tz=d.x*sy-d.y*sx,I=this.cur.I,ids=[];
   for(const [P,rr] of [[a,r],[b,r2]])for(let i=0;i<n;i++){const an=i/n*TAU,c=Math.cos(an),s=Math.sin(an),nx=sx*c+tx*s,ny=sy*c+ty*s,nz=sz*c+tz*s;ids.push(this._v(P[0]+nx*rr,P[1]+ny*rr,P[2]+nz*rr,nx,ny,nz,m));}
   for(let i=0;i<n;i++){const j=(i+1)%n;I.push(ids[i],ids[j],ids[n+j],ids[i],ids[n+j],ids[n+i]);}
   if(o.caps){for(const [P,rr,sg,off] of [[a,r,-1,0],[b,r2,1,n]]){const c0=this._v(P[0],P[1],P[2],d.x*sg,d.y*sg,d.z*sg,m),cs=[];for(let i=0;i<n;i++){const an=i/n*TAU,c=Math.cos(an),s=Math.sin(an);cs.push(this._v(P[0]+(sx*c+tx*s)*rr,P[1]+(sy*c+ty*s)*rr,P[2]+(sz*c+tz*s)*rr,d.x*sg,d.y*sg,d.z*sg,m));}for(let i=0;i<n;i++){const j=(i+1)%n;if(sg>0)I.push(c0,cs[i],cs[j]);else I.push(c0,cs[j],cs[i]);}}}
   return this;}
  // a pipe run through points with a collar at each joint
  pipe(pts,r,m,o={}){for(let i=1;i<pts.length;i++)this.tube(pts[i-1],pts[i],r,m,{n:o.n,caps:i===1||i===pts.length-1});if(this.hi)for(let i=1;i<pts.length-1;i++)this.ball(pts[i][0],pts[i][1],pts[i][2],r*1.25,o.joint||m,true);return this;}
  // any unit geometry with a matrix (torus rings, gems): material colour + AO like the rest
  geo(g,m4,m){const P=g.attributes.position,N=g.attributes.normal,ix=g.index,B=this.cur,base=B.n;_nm.copy(m4).invert().transpose();for(let i=0;i<P.count;i++){_v.fromBufferAttribute(P,i).applyMatrix4(m4);_n.fromBufferAttribute(N,i).transformDirection(_nm);this._v(_v.x,_v.y,_v.z,_n.x,_n.y,_n.z,m);}
   if(ix)for(let k=0;k<ix.count;k++)B.I.push(base+ix.getX(k));else for(let k=0;k<P.count;k++)B.I.push(base+k);return this;}
  ball(x,y,z,r,m,low){return this.geo(low?unit.ico0:unit.ico,_m.compose(_p.set(x,y,z),_q.identity(),_s.set(r,r,r)).clone(),m);}
  gem(x,y,z,rx,ry,rz,m,yaw=0){_e.set(0,yaw,0);_q.setFromEuler(_e);return this.geo(unit.octa,_m.compose(_p.set(x,y,z),_q,_s.set(rx,ry,rz)).clone(),m);}
  // horizontal ring (a collar, a light band): R radius, t thickness scale
  ring(x,y,z,R,m,o={}){_e.set(Math.PI/2+(o.rx||0),0,o.rz||0);_q.setFromEuler(_e);return this.geo(o.thin?unit.torusThin:unit.torus,_m.compose(_p.set(x,y,z),_q,_s.set(R,o.rz2?o.rz2:R,R*(o.t||1))).clone(),m);}
  // hemisphere dome on a base ring (rx, rz radii, h height); o.rings latitude bands, o.n sides, o.cut = fraction kept
  dome(x,y,z,rx,h,rz,m,o={}){const n=o.n||(this.hi?14:8),L=o.rings||(this.hi?5:3),R=[];for(let i=0;i<=L;i++){const t=i/L*(Math.PI/2)*(o.cut??1),c=Math.cos(t),s=Math.sin(t);R.push({p:circ(Math.max(.001,rx*c),n,x,z,Math.max(.001,rz*c)),y:y+h*s});}
   return this.loft(R,m,{smooth:!o.flat,top:(o.cut??1)<1,topMat:o.topMat});}
  // gable roof over a w x d rectangle, ridge along x; over = eave overhang
  gable(x,y,z,w,h,d,m,o={}){const ov=o.over??.25,hw=w/2+ov,hd=d/2+ov,th=o.th??.12,ins=[x,y-1,z];
   this.quad([x-hw,y,z+hd],[x+hw,y,z+hd],[x+hw,y+h,z],[x-hw,y+h,z],m,ins).quad([x-hw,y,z-hd],[x+hw,y,z-hd],[x+hw,y+h,z],[x-hw,y+h,z],m,ins);
   const g=o.gable||m;for(const s of [-1,1])this.tri([x+s*(w/2),y,z-d/2],[x+s*(w/2),y,z+d/2],[x+s*(w/2),y+h*(d/2)/(hd),z],g,[x,y,z]);
   if(this.hi&&th){const e=o.edge||tint(m,.7);for(const s of [-1,1])this.quad([x-hw,y-th,z+s*hd],[x+hw,y-th,z+s*hd],[x+hw,y,z+s*hd],[x-hw,y,z+s*hd],e,ins);this.tube([x-hw,y+h+.03,z],[x+hw,y+h+.03,z],.07,e,{n:4});}return this;}
  // barrel vault (half cylinder) along x: hangars, greenhouses; o.ribs adds hoops, o.ends closes the gables
  vault(x,y,z,len,r,m,o={}){const n=o.n||(this.hi?10:6),h=o.h??r,I=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI;I.push([Math.cos(a)*r,Math.sin(a)*h]);}const x0=x-len/2,x1=x+len/2,ins=[x,y,z];
   for(let i=0;i<n;i++){const [z0,y0]=I[i],[z1,y1]=I[i+1];this.quad([x0,y+y0,z+z0],[x1,y+y0,z+z0],[x1,y+y1,z+z1],[x0,y+y1,z+z1],typeof m==='function'?m(i):m,ins);}
   if(o.ends)for(const xe of [x0,x1])for(let i=0;i<n;i++){const [z0,y0]=I[i],[z1,y1]=I[i+1];this.tri([xe,y,z],[xe,y+y0,z+z0],[xe,y+y1,z+z1],o.ends,[x,y+h*.4,z]);}
   if(this.hi&&o.ribs){const k=o.ribs,rm=o.ribMat||tint(typeof m==='function'?m(0):m,.6);for(let j=0;j<=k;j++){const xr=x0+len*j/k;for(let i=0;i<n;i++){const [z0,y0]=I[i],[z1,y1]=I[i+1];this.tube([xr,y+y0*1.02,z+z0*1.02],[xr,y+y1*1.02,z+z1*1.02],o.ribR||.07,rm,{n:4});}}}return this;}
  // lattice mast between two heights: four legs, cross braces every `step`
  truss(x,y,z,w0,w1,h,m,o={}){const st=o.step||2.2,r=o.r||.07,n=Math.max(1,Math.round(h/st)),leg=(t,sx,sz)=>{const w=(w0+(w1-w0)*t)/2;return [x+sx*w,y+h*t,z+sz*w];};
   for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])this.tube(leg(0,sx,sz),leg(1,sx,sz),r*1.3,m,{n:4});
   for(let k=0;k<n;k++){const t0=k/n,t1=(k+1)/n,C=[[-1,-1],[1,-1],[1,1],[-1,1]];for(let i=0;i<4;i++){const a=C[i],b=C[(i+1)%4];this.tube(leg(t1,a[0],a[1]),leg(t1,b[0],b[1]),r,m,{n:3});if(this.hi||i%2===0)this.tube(leg(t0,a[0],a[1]),leg(t1,b[0],b[1]),r*.8,m,{n:3});}}return this;}
  // window on a wall whose outward normal is +z of the current frame: frame, glass (lit or dark) and a sill
  window(x,y,z,w,h,o={}){const f=o.frame||mat(0x20242a,'metal'),g=o.lit===false?mat(0x0c1218,'glass',.1):(o.glass||glow(o.color||0xffc47a,o.k??.8));this.box(x,y,z+.03,w,h,.04,g);
   if(this.hi){const t=o.t||.07;this.box(x,y-t,z+.05,w+2*t,t,.09,f).box(x,y+h,z+.05,w+2*t,t,.07,f).box(x-w/2-t/2,y,z+.05,t,h,.07,f).box(x+w/2+t/2,y,z+.05,t,h,.07,f);if(o.bars)for(let k=1;k<=o.bars;k++)this.box(x-w/2+w*k/(o.bars+1),y,z+.055,t*.6,h,.04,f);if(o.mid)this.box(x,y+h/2-t*.3,z+.055,w,t*.6,.04,f);}return this;}
  door(x,y,z,w,h,o={}){const f=o.frame||mat(0x20242a,'metal'),d=o.mat||mat(0x3a2a1e,'timber');this.box(x,y,z+.02,w,h,.06,d);if(this.hi){this.box(x,y+h,z+.04,w+.24,.12,.12,f).box(x-w/2-.06,y,z+.04,.12,h,.1,f).box(x+w/2+.06,y,z+.04,.12,h,.1,f);this.box(x+w*.3,y+h*.45,z+.06,.07,.16,.05,o.handle||glow(0xffc47a,.5));if(o.step!==false)this.box(x,y-.12,z+.3,w+.5,.12,.6,o.stepMat||mat(0x5a5a58,'concrete'));}return this;}
  // rails: posts every `step` along a polyline at height h with one or two bars
  rail(pts,h,m,o={}){const st=o.step||1.4,r=o.r||.035;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],L=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),n=Math.max(1,Math.round(L/st));this.tube([a[0],a[1]+h,a[2]],[b[0],b[1]+h,b[2]],r,m,{n:4});if(this.hi&&o.mid!==false)this.tube([a[0],a[1]+h*.5,a[2]],[b[0],b[1]+h*.5,b[2]],r*.8,m,{n:3});
    for(let k=0;k<=n;k++){if(k===0&&i>1)continue;const t=k/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;this.tube([x,y,z],[x,y+h,z],r*1.2,m,{n:4});}}return this;}
  ladder(a,b,m,o={}){const w=o.w||.42,L=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),n=Math.max(2,Math.round(L/.42)),dx=o.dx??1,dz=o.dz??0;for(const s of [-1,1])this.tube([a[0]+dx*s*w/2,a[1],a[2]+dz*s*w/2],[b[0]+dx*s*w/2,b[1],b[2]+dz*s*w/2],.03,m,{n:4});
   if(this.hi)for(let k=1;k<n;k++){const t=k/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;this.tube([x-dx*w/2,y,z-dz*w/2],[x+dx*w/2,y,z+dz*w/2],.022,m,{n:3});}return this;}
  // sagging cable / string between two points
  cable(a,b,sag,r,m,o={}){const n=o.n||(this.hi?6:3);let p=a;for(let k=1;k<=n;k++){const t=k/n,q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-sag*4*t*(1-t),a[2]+(b[2]-a[2])*t];this.tube(p,q,r,m,{n:3});p=q;}return this;}
  // vertical ribs / buttresses around an upright cylinder (the Meshy reactor read)
  ribs(x,y,z,r,h,n,m,o={}){const w=o.w||.22,dp=o.dp||.18;for(let i=0;i<n;i++){const a=i/n*TAU+(o.rot||0);this.at(x+Math.cos(a)*(r+dp/2-.02),y,z+Math.sin(a)*(r+dp/2-.02),-a+Math.PI/2,b=>this.hi&&o.bev!==false?b.bev(0,0,0,w,h,dp,m,{ch:Math.min(.05,w*.3)}):b.box(0,0,0,w,h,dp,m));}return this;}
  // glow billboard / ground glow (collected for the fx batch); colour is linear rgb * k
  halo(x,y,z,s,hex,k=1,o=0){const c=col(hex);_v.set(x,y,z).applyMatrix4(this.M);this.fx.push({t:'bill',x:_v.x,y:_v.y,z:_v.z,s,c:[c[0]*k,c[1]*k,c[2]*k],o});return this;}
  pool(x,y,z,hw,hd,hex,k=1,o=0){const c=col(hex);_v.set(x,y,z).applyMatrix4(this.M);this.fx.push({t:'flat',x:_v.x,y:_v.y,z:_v.z,hw,hd,c:[c[0]*k,c[1]*k,c[2]*k],o});return this;}
  tris(which){const B=which?this.buf[which]:null;return B?B.I.length/3:(this.buf.main.I.length+this.buf.det.I.length)/3;}
 }

 // ------------------------------------------------------------------ models, placement, instancing ----------------------
 const cache=new Map();
 // build (or reuse) a slot's code model for these parameters; o must be JSON-plain
 function build(id,o={}){const k=id+'|'+JSON.stringify(o);let b=cache.get(k);if(b)return b;const def=MODELS[id];if(!def)throw new Error('ConquestWorldKit: no model for slot "'+id+'"');
  b=new KB(Object.assign({},def.o,o));b.k=K;def.build(b,Object.assign({w:0,d:0,h:0,seed:1,level:1},slotBox(id),o));cache.set(k,b);return b;}
 function slotBox(id){const s=root.ConquestSlots&&root.ConquestSlots.items[id];return s?{w:s.size[0],h:s.h??s.size[1],d:s.size[2]}:{};}
 const slotOver=id=>{const s=root.ConquestSlots&&root.ConquestSlots.items[id];return s&&s.h?s.size[1]-s.h:0;};   // what stands above the placement height
 const swapped=id=>{const s=root.ConquestSlots&&root.ConquestSlots.items[id];return s&&s.model?s.model:null;};
 // append one buffer of a built model to a style Bld (merged batch) through a placement matrix
 function append(B,src,m4){if(!src.n)return;_nm.copy(m4).invert().transpose();const P=src.P,N=src.N,A=src.A,base=B.n,e=m4.elements,ne=_nm.elements;
  for(let i=0,j=0;i<src.n;i++,j+=3){const x=P[j],y=P[j+1],z=P[j+2],nx=N[j],ny=N[j+1],nz=N[j+2];B.P.push(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]);
   let ax=ne[0]*nx+ne[4]*ny+ne[8]*nz,ay=ne[1]*nx+ne[5]*ny+ne[9]*nz,az=ne[2]*nx+ne[6]*ny+ne[10]*nz;const l=Math.hypot(ax,ay,az)||1;B.N.push(ax/l,ay/l,az/l);B.A.push(A[i*4],A[i*4+1],A[i*4+2],A[i*4+3]);}
  for(let k=0;k<src.I.length;k++)B.I.push(src.I[k]+base);B.n+=src.n;}
 // target = {main: Bld, det: Bld (optional), fx: Fx (optional), swaps: Map (optional)}; m4 = model -> batch space
 function place(id,target,m4,o){const sw=swapped(id);
  if(sw&&target.swaps&&meshyReady(sw)){let L=target.swaps.get(id);if(!L)target.swaps.set(id,L=[]);const sb=slotBox(id);L.push({m:m4.clone(),w:o?.w||sb.w,h:(o?.h||sb.h)+slotOver(id),d:o?.d||sb.d});return null;}
  if(sw&&target.swaps)pendingSwap.add(id);
  const b=build(id,o);append(target.main,b.buf.main,m4);append(target.det||target.main,b.buf.det,m4);
  if(target.fx&&b.fx.length&&!S.software)for(const f of b.fx){_v.set(f.x,f.y,f.z).applyMatrix4(m4);if(f.t==='bill')target.fx.bill(_v.x,_v.y,_v.z,f.s,S.AT.BLOB,f.c,f.o);else target.fx.flat(_v.x,_v.y,_v.z,f.hw,f.hd,S.AT.BLOB,f.c,f.o);}return b;}
 // an ad-hoc part built with the toolkit (a pipe run, a wire, a plinth): b = new K.KB(), draw, then emit it into a batch
 function emit(target,b,m4){append(target.main,b.buf.main,m4);append(target.det||target.main,b.buf.det,m4);return b;}
 const part=(o)=>{const b=new KB(o||{});b.k=K;return b;};
 // one BufferGeometry of a model (main + detail merged) for an InstancedMesh; kept by the style instance
 const geos=new Map();
 function geometry(id,o={}){const k=id+'|'+JSON.stringify(o);let g=geos.get(k);if(g)return g;const b=build(id,o),B=new S.Bld();const I=new T.Matrix4();append(B,b.buf.main,I);append(B,b.buf.det,I);g=B.geometry();g.userData.hfShared=true;S.shared.push(g);geos.set(k,g);return g;}
 const tris=(id,o)=>build(id,o).tris();
 // one instanced draw of a slot (trees, rocks, deposits, animals, moving things): the code-built geometry on the style's solid
 // material, or the slot's Meshy model when the list names one and it has loaded (setAt then fits each instance into the box)
 function instanced(id,count,o){const sw=swapped(id),My=MY3D();
  if(sw&&meshyReady(sw)){const set=My.slotSet(sw,Math.max(1,count),!hi);if(set){const sb=Object.assign(slotBox(id),o||{});set.mesh.count=count;set.mesh.userData.slot=id;set.mesh.userData.slotFit=set.fit(new T.Matrix4(),sb.w,sb.h+slotOver(id),sb.d);return set.mesh;}}
  if(sw)pendingSwap.add(id);const im=new T.InstancedMesh(geometry(id,o),S.MAT.solid,Math.max(1,count));im.count=count;im.userData.slot=id;return im;}
 const setAt=(im,i,m4)=>im.setMatrixAt(i,im.userData.slotFit?_m2.multiplyMatrices(m4,im.userData.slotFit):m4);
 // ---- Meshy replacement of a slot (owner, Nov 19): the listed item is fitted into the slot's box, standing on its ground ----
 const pendingSwap=new Set();
 function meshyReady(item){const My=MY3D();if(!My||!My.enabled||!My.slotAsset)return false;return !!My.slotAsset(item);}
 // instanced draws for every placement recorded in target.swaps (call once per batch group, add the result to the group)
 function swapMeshes(swaps,low){const My=MY3D(),out=[];if(!My||!swaps)return out;for(const [id,L] of swaps){const item=swapped(id),set=item&&My.slotSet&&My.slotSet(item,L.length,low);if(!set)continue;
    L.forEach((pl,i)=>set.mesh.setMatrixAt(i,_m2.multiplyMatrices(pl.m,set.fit(_m,pl.w,pl.h,pl.d))));
    set.mesh.count=L.length;set.mesh.instanceMatrix.needsUpdate=true;set.mesh.userData.slot=id;set.mesh.userData.noPick=true;out.push(set.mesh);}return out;}
 // The two families (owner, Nov 8): the MILITARY is cool gunmetal armour with pale ceramic plates, gold trim and cyan / white
 // lights (the owner's Meshy town items are the reference); SETTLERS are warm, painted, patched and hand-built with amber light.
 const parGlow=(hex,k,a)=>{const c=col(hex);return {c:[c[0]*k,c[1]*k,c[2]*k],a,j:0};};   // an emissive colour pre-scaled for the shader's 2.3x glow gain
 const pal={
  mil:{hull:mat(0x4a5562,'metal',.25),hull2:mat(0x353d49,'metal',.35),dark:mat(0x22262d,'metal',.2),plate:mat(0xaab4bd,'metal',.3),plate2:mat(0x8996a2,'metal',.4),trim:mat(0x66707d,'metal',.1),bare:mat(0x8a919a,'metal',.15),gold:mat(0xb8913f,'metal',0),
   conc:mat(0x5a5f66,'concrete',.3),glass:mat(0x0d1a24,'glass',.5),glassDark:mat(0x0a1016,'glass',0),cyan:glow(0x22e6ff,1),ice:glow(0xa8f8ff,1),white:glow(0xe8f6ff,1),red:glow(0xff3048,1),amber:glow(0xffb347,1),navy:mat(0x0d1729,'solar',0),hazard:mat(0xd9a521,'paint',.5),hazardD:mat(0x15171a,'paint',.3)},
  set:{paint:[0xb39a66,0x8f4f36,0x5f8a86,0xc9c2b0,0x7a6a52,0x9a5a3a,0x6f7f5a,0xb8a27a].map(h=>mat(h,'paint',.55,.1)),fresh:[0xc8563a,0x3f8f93,0xd9a441,0x5b8f4e,0x8a5a8a].map(h=>mat(h,'paint',.2,.08)),
   roof:mat(0x4a3e34,'scrap',.45),roofRust:mat(0x7a4326,'scrap',.8),scrap:mat(0x6d6a62,'scrap',.6),timber:mat(0x7a5634,'timber',.3,.12),timberD:mat(0x4f3622,'timber',.5,.12),comp:mat(0x8a8676,'paint',.4),conc:mat(0x7b776c,'concrete',.5),stone:mat(0x6a6456,'concrete',.7),
   canvas:[0xd8c8a0,0x8a4a5a,0x4a6a8a,0xc9a04a,0xb8553a].map(h=>mat(h,'cloth',0,.06)),rust:mat(0x7a3e24,'scrap',.9),iron:mat(0x34302c,'metal',.6),glass:mat(0x1a2a30,'glass',.2),warm:glow(0xffc47a,.8),amber:glow(0xffa84a,1.1),lamp:glow(0xffd59a,1.5),
   leaf:mat(0x4c7a34,'leaf',0,.2),leafD:mat(0x35582a,'leaf',0,.2),soil:mat(0x4a3a28,'dirt',0),water:mat(0x2a6a8a,'glass',.4),tank:mat(0x5f8a86,'paint',.6),white:mat(0xd5d0c2,'paint',.5),tyre:mat(0x15181c,'flat',0)},
  nat:{rock:mat(0x4a4d55,'rock',0,.1),rockD:mat(0x2e3036,'rock',0,.1),rockMoss:mat(0x6a6458,'rock',.8,.1),bark:mat(0x3e3024,'bark',.6,.1),burnt:mat(0x1c1814,'bark',.9),leaf:[0x2a4220,0x33502a,0x3d5a2c].map(h=>mat(h,'leaf',0,.25)),broad:[0x4b5a2c,0x3a4a24,0x5e6630,0x6b5a2a].map(h=>mat(h,'leaf',0,.25)),
   straw:mat(0xa89a5b,'leaf',0,.2),olive:mat(0x6b7a3a,'leaf',0,.2),ice:mat(0xa8dcf0,'glass',.25),soil:mat(0x4a3a28,'dirt',0),moss:mat(0x3e5a2e,'leaf',0,.2)},
  // The Parasites (owner, Nov 21): greedy humans, not aliens. Their machines and structures are human-built, stolen and over-armoured:
  // dark scavenged steel under bolted-on plundered plating (LDF ceramic, settler panels, hazard stripes), gaudy gold trim, loot
  // crates, nets and sacks strapped on, trophies of other colonies (flags, markings). The infection is the only organic part:
  // red vein growth in seams, vents and cockpits, one shared Parasite red (PAR.red) against the blue human world.
  // Seen in the game on the barren Moon (Nov 25): neutral grey steel and pale blue plates read as BLUE under the night's
  // blue light and the units looked like human machines. So the steel is warm (umber, never grey-blue), the plundered plates
  // are bone, brick, oxide, tan and khaki, and the glows are scaled so the tone mapper keeps them a deep red, not coral
  // (the solid shader shows emission at 2.3x: a full-strength red burns out to pink).
  par:{iron:mat(0x40332e,'metal',.55),ironD:mat(0x241c1a,'metal',.4),ironL:mat(0x5e4c42,'metal',.5),rust:mat(0x7a3a1e,'scrap',.9),scrap:mat(0x5c5046,'scrap',.7),weld:mat(0x17161a,'metal',.8),
   plateMil:mat(0xa69c8e,'metal',.5),plateMilD:mat(0x574a41,'metal',.5),plateSet:[0x8f4f36,0x7a2f24,0xb39a66,0xc4b8a0,0x6f6a45].map(h=>mat(h,'paint',.7,.1)),hazard:mat(0xc9981f,'paint',.7),hazardD:mat(0x15171a,'paint',.4),
   gold:mat(0xc9a23f,'metal',0),goldD:mat(0x8a6a22,'metal',.2),crate:mat(0x7a5634,'timber',.4,.12),crateD:mat(0x4f3622,'timber',.5,.12),strap:mat(0x1c1a18,'flat',0),net:mat(0x2a2620,'cloth',0),sack:mat(0x8f8064,'cloth',0,.12),
   tank:mat(0xd5d0c2,'paint',.5),tankBand:mat(0x8a3324,'paint',.4),flagLDF:mat(0x27465c,'cloth',0),flagLDF2:mat(0x9d968a,'cloth',0),flagSet:[0x8a4a5a,0xc9a04a,0x7a4a2a,0xb8553a,0x5b8f4e].map(h=>mat(h,'cloth',0,.06)),
   glassDead:mat(0x0c1014,'glass',.1),tyre:mat(0x15181c,'flat',0),
   flesh:mat(0x4a1016,'chitin',.3),fleshD:mat(0x2a080c,'chitin',.2),fleshL:mat(0x7a1c22,'chitin',.15),
   red:parGlow(PAR.red,.52,1.85),redHot:parGlow(PAR.hot,.62,1.95),redDim:parGlow(PAR.red,.34,1),redLow:parGlow(PAR.deep,.5,.6)},
  wreck:{hull:mat(0x3a3530,'scrap',.7),rust:mat(0x6a3f26,'scrap',.95),track:mat(0x1e1c1a,'metal',.8),moss:mat(0x3e5a2e,'leaf',0,.2),bag:mat(0x8f8064,'dirt',0,.15),wire:mat(0x2a2a2a,'metal',.9),post:mat(0x4a4038,'timber',.8),mud:mat(0x2a2018,'dirt',0)}};
 const K={S,T,hi,KB,pal,emit,part,mat,glow,tint,mix,rect,circ,col,SURF,surfA,hash,rng,build,place,geometry,instanced,setAt,tris,swapMeshes,swapped,pendingSwap,unit,M:(x,y,z,ry=0,s=1)=>{_e.set(0,ry,0);_q.setFromEuler(_e);return new T.Matrix4().compose(_p.set(x,y,z),_q,_s.set(s,s,s));},clear(){cache.clear();geos.clear();}};
 S.worldKit=K;return K;}

// Slot swaps at runtime (tests, a later owner tool): model = a Meshy item id, or null for the code-built model. Views that
// drew the slot rebuild their batches when the generation changes.
let generation=0;
function swap(id,item){const s=root.ConquestSlots&&root.ConquestSlots.items[id];if(!s)throw new Error('ConquestWorldKit: unknown slot "'+id+'"');s.model=item||null;generation++;return s;}
root.ConquestWorldKit={kit,model,MODELS,PAR,SURF,surfA,hash,rng,swap,get generation(){return generation;},bump(){generation++;}};
})(typeof globalThis!=='undefined'?globalThis:window);
