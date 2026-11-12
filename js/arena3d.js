'use strict';
// =====================================================================
// Arena3D: the Arcade maps in 3D (Session 5E-2c). Presentation only: it reads MAPS (js/game.js) and never changes it, never
// calls the sim's random(), the save or the network. Every solid keeps the footprint the rules use; raised art stands on a
// collision footprint or outside the arena; floor art is flat.
//
// How a map is drawn (docs: Checkpoint 34):
//  1. Props are merged into at most three lit meshes (rock / paint / metal) plus one glow mesh, with box-projected UVs and
//     small tiling detail textures that are generated on the GPU once (no downloads).
//  2. The ground is BAKED once per map into one texture by a shader: regolith or deck plates, craters, tracks, pebbles,
//     contact shading round every solid, and the hard sun shadows of every prop (the props are flattened onto the ground
//     along the sun and drawn into a mask). The texture keeps albedo in rgb and the sun term in alpha, so the environment
//     layer (js/mapenv.js) can re-light it every frame for free: colour = albedo * (ambient + sun * term).
//  3. Drawing it each frame costs one texture read per ground pixel and a handful of draw calls.
// LOW: fewer triangles, Lambert props without normal maps, a smaller bake. Reduced motion: nothing spins or drifts.
// =====================================================================
const Arena3D=(()=>{
 const VERSION='arena-1',AW=20,AH=32;
 let T=null;
 const LIN=new Map(),lin=h=>{let v=LIN.get(h);if(!v){const n=parseInt(String(h).slice(1),16),f=x=>{x/=255;return x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4);};v=[f(n>>16),f((n>>8)&255),f(n&255)];LIN.set(h,v);}return v;};
 const hs=(a,b)=>{const v=Math.sin(a*127.1+b*311.7+1.3)*43758.5453;return v-Math.floor(v);};
 const hs3=(x,y,z)=>{const v=Math.sin(x*12.9898+y*78.233+z*37.719)*43758.5453;return v-Math.floor(v);};
 function vn3(x,y,z){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let fx=x-ix,fy=y-iy,fz=z-iz;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
  const L=(a,b,f)=>a+(b-a)*f;return L(L(L(hs3(ix,iy,iz),hs3(ix+1,iy,iz),fx),L(hs3(ix,iy+1,iz),hs3(ix+1,iy+1,iz),fx),fy),L(L(hs3(ix,iy,iz+1),hs3(ix+1,iy,iz+1),fx),L(hs3(ix,iy+1,iz+1),hs3(ix+1,iy+1,iz+1),fx),fy),fz);}
 const mixc=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f];
 const mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
 const col=c=>typeof c==='string'?lin(c):c;
 // everything beyond the arena edge is pushed back in value so the playfield reads first (same curve in the ground bake)
 const sst=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);},outDim=d=>(1-0.48*sst(0.25,1.1,d))*(1-0.6*sst(1.1,17,d));

 // ---------- the kit: props are pushed into four buckets and merged ----------
 const CLS=['rock','paint','metal','glow'];
 function mkKit(q,theme){
  const k={q,high:q!=='low',theme,ground:[],gtop:[],halos:[],spin:[],anims:[],yb:0,dust:theme.dust?lin(theme.dust):null,anchors:{vents:[],lasers:[],drops:[],walls:[],sparks:[],rail:null}};
  for(const c of CLS)k[c]={P:[],N:[],C:[],Y:[]};return k;
 }
 let TMP=null;const GC=new Map();
 const tmp=()=>TMP||(TMP={m:new T.Matrix4(),q:new T.Quaternion(),e:new T.Euler(),p:new T.Vector3(),s:new T.Vector3(),n:new Float64Array(9),v:new T.Vector3(),w:new T.Vector3()});
 const cached=(key,fn)=>{let g=GC.get(key);if(!g){g=fn();GC.set(key,g);}return g;};
 const boxG=()=>cached('box',()=>new T.BoxGeometry(1,1,1));
 const cylG=(seg,open)=>cached('cyl'+seg+(open?'o':''),()=>new T.CylinderGeometry(1,1,1,seg,1,!!open));
 const coneG=(seg,rt)=>cached('cone'+seg+'|'+rt,()=>new T.CylinderGeometry(rt,1,1,seg,1,false));
 const sphG=(seg,half)=>cached('sph'+seg+(half?'h':''),()=>new T.SphereGeometry(1,seg,Math.max(3,Math.round(seg*(half?0.3:0.6))),0,Math.PI*2,0,half?Math.PI/2:Math.PI));
 const torG=(r,seg,ts)=>cached('tor'+r+'|'+seg+'|'+ts,()=>new T.TorusGeometry(1,r,ts||5,seg));
 // push a geometry into a bucket: transformed, coloured, with a soft contact shade towards its base and dust on what faces up
 function add(k,cls,geo,c,M,o){
  o=o||{};const b=k[cls],P=geo.attributes.position,N=geo.attributes.normal,I=geo.index,n=I?I.count:P.count,t=tmp(),cc=col(c),glow=cls==='glow';
  {const e=M.elements,a=e[0],b2=e[1],c2=e[2],d=e[4],f=e[5],g=e[6],h=e[8],i2=e[9],j=e[10],A=f*j-g*i2,Bq=g*h-d*j,Cq=d*i2-f*h,det=a*A+b2*Bq+c2*Cq||1,N9=t.n;   // inverse transpose of the upper 3x3 (the custom three build has no Matrix3)
   N9[0]=A/det;N9[1]=Bq/det;N9[2]=Cq/det;N9[3]=(c2*i2-b2*j)/det;N9[4]=(a*j-c2*h)/det;N9[5]=(b2*h-a*i2)/det;N9[6]=(b2*g-c2*f)/det;N9[7]=(c2*d-a*g)/det;N9[8]=(a*f-b2*d)/det;}
  const yb=o.yb===undefined?k.yb:o.yb,ao=glow?0:o.ao===undefined?0.34:o.ao,aoH=o.aoH||0.5,dust=glow||!k.dust?0:o.dust===undefined?0.2:o.dust,c2=o.top?col(o.top):null;
  const SL=k.sun,punch=glow||!SL?0:o.punch===undefined?(cls==='rock'?0.5:0.16):o.punch;
  for(let i=0;i<n;i++){const vi=I?I.getX(i):i;
   t.v.fromBufferAttribute(P,vi).applyMatrix4(M);t.w.fromBufferAttribute(N,vi);{const N9=t.n,nx=t.w.x,ny=t.w.y,nz=t.w.z;t.w.set(N9[0]*nx+N9[1]*ny+N9[2]*nz,N9[3]*nx+N9[4]*ny+N9[5]*nz,N9[6]*nx+N9[7]*ny+N9[8]*nz).normalize();}
   let r=cc[0],g=cc[1],bl=cc[2];
   if(c2&&t.w.y>0.6){r=c2[0];g=c2[1];bl=c2[2];}
   if(dust&&t.w.y>0.55){const f=dust*(t.w.y-0.55)/0.45;r+=(k.dust[0]-r)*f;g+=(k.dust[1]-g)*f;bl+=(k.dust[2]-bl)*f;}
   if(ao){const h=Math.max(0,Math.min(1,(t.v.y-yb)/aoH)),f=1-ao*(1-h*h*(3-2*h));r*=f;g*=f;bl*=f;}
   if(punch){const f=1+punch*(Math.max(-0.4,t.w.x*SL[0]+t.w.y*SL[1]+t.w.z*SL[2])-0.35)*1.5;r*=f;g*=f;bl*=f;}
   if(o.grad){const f=1+(o.grad[0]-1)*Math.max(0,Math.min(1,(t.v.y-yb)/o.grad[1]));r*=f;g*=f;bl*=f;}   // a value ramp with height (far ridges fade upward)
   {const dx=Math.max(0,-t.v.x,t.v.x-AW),dz=Math.max(0,-t.v.z,t.v.z-AH),dd=Math.hypot(dx,dz);if(dd>0.3&&!o.lit){const f=outDim(dd)*(o.dim||1),ds=0.55*sst(0.3,2.5,dd),l=0.3*r+0.55*g+0.15*bl;r=(r+(l-r)*ds)*f;g=(g+(l-g)*ds)*f;bl=(bl+(l-bl)*ds)*f;}else if(o.dim){r*=o.dim;g*=o.dim;bl*=o.dim;}}
   b.P.push(t.v.x,t.v.y,t.v.z);b.N.push(t.w.x,t.w.y,t.w.z);b.C.push(r,g,bl);b.Y.push(o.noShadow?-1:yb);}
 }
 const mat=(px,py,pz,rx,ry,rz,sx,sy,sz)=>{const t=tmp();t.e.set(rx||0,ry||0,rz||0);t.q.setFromEuler(t.e);t.p.set(px,py,pz);t.s.set(sx===undefined?1:sx,sy===undefined?1:sy,sz===undefined?1:sz);return t.m.compose(t.p,t.q,t.s);};
 // rocks: a displaced icosphere with softened normals; a few shapes are built once and reused at any size
 function rockG(seed,detail){
  return cached('rock'+seed+'|'+detail,()=>{
   const g=new T.IcosahedronGeometry(1,detail),p=g.attributes.position,n=p.count,N=new Float32Array(n*3),acc=new Map();
   for(let i=0;i<n;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);const f=0.66+0.5*vn3(x*1.3+seed*7.1,y*1.3+3.3,z*1.3-seed*2.7)+0.12*vn3(x*4.1+seed,y*4.1,z*4.1+9);x*=f;y*=f;z*=f;if(y<-0.42)y=-0.42-(y+0.42)*0.05;p.setXYZ(i,x,y+0.42,z);}
   for(let i=0;i<n;i+=3){const ax=p.getX(i),ay=p.getY(i),az=p.getZ(i),ux=p.getX(i+1)-ax,uy=p.getY(i+1)-ay,uz=p.getZ(i+1)-az,vx=p.getX(i+2)-ax,vy=p.getY(i+2)-ay,vz=p.getZ(i+2)-az;
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
    for(let j=0;j<3;j++){const key=Math.round(p.getX(i+j)*400)+','+Math.round(p.getY(i+j)*400)+','+Math.round(p.getZ(i+j)*400);let a=acc.get(key);if(!a){a=[0,0,0];acc.set(key,a);}a[0]+=nx;a[1]+=ny;a[2]+=nz;N[(i+j)*3]=nx;N[(i+j)*3+1]=ny;N[(i+j)*3+2]=nz;}}
   for(let i=0;i<n;i++){const key=Math.round(p.getX(i)*400)+','+Math.round(p.getY(i)*400)+','+Math.round(p.getZ(i)*400),a=acc.get(key),l=Math.hypot(a[0],a[1],a[2])||1;   // mostly faceted: cracked planes with a crisp terminator
    let nx=N[i*3]*0.82+a[0]/l*0.18,ny=N[i*3+1]*0.82+a[1]/l*0.18,nz=N[i*3+2]*0.82+a[2]/l*0.18;const m=Math.hypot(nx,ny,nz)||1;N[i*3]=nx/m;N[i*3+1]=ny/m;N[i*3+2]=nz/m;}
   g.setAttribute('normal',new T.BufferAttribute(N,3));return g;});
 }
 // a spire: a tapering faceted column with a leaning tip
 function spireG(seed,sides){
  return cached('spire'+seed+'|'+sides,()=>{const rings=6,P=[],ring=[];
   for(let j=0;j<=rings;j++){const f=j/rings,r=(1-Math.pow(f,0.8))*(0.86+0.28*hs(seed,j))+0.02,row=[];for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2+hs(seed+j,i)*0.5,rr=r*(0.72+0.5*hs(i+seed*3,j*1.7));row.push([Math.cos(a)*rr+f*f*0.22*(hs(seed,9)-0.5),f,Math.sin(a)*rr+f*f*0.22*(hs(seed,5)-0.5)]);}ring.push(row);}
   for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const a=ring[j][i],b=ring[j][(i+1)%sides],c=ring[j+1][(i+1)%sides],d=ring[j+1][i];P.push(...a,...d,...b,...b,...d,...c);}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(P),3));g.computeVertexNormals();return g;});
 }
 // the builder: short calls that the prop library (js/arenaprops.js) uses
 function builder(k){
  const B={k,high:k.high,
   yb(v){k.yb=v;return B;},
   box(cls,c,x,y,z,sx,sy,sz,ry,o){add(k,cls,boxG(),c,mat(x,y,z,o&&o.rx||0,ry||0,o&&o.rz||0,sx,sy,sz),o);return B;},
   cyl(cls,c,x,y,z,r,h,seg,o){o=o||{};add(k,cls,o.rt!==undefined?coneG(seg||12,o.rt):cylG(seg||12,o.open),c,mat(x,y,z,o.rx||0,o.ry||0,o.rz||0,r,h,o.rz2||r),o);return B;},
   sph(cls,c,x,y,z,r,sy,seg,half,o){add(k,cls,sphG(seg||12,half),c,mat(x,y,z,0,o&&o.ry||0,0,r,sy===undefined?r:sy,o&&o.sz||r),o);return B;},
   tor(cls,c,x,y,z,R,r,seg,o){o=o||{};add(k,cls,torG(+(r/R).toFixed(3),seg||16,o.ts),c,mat(x,y,z,o.rx===undefined?Math.PI/2:o.rx,o.ry||0,o.rz||0,R,R*(o.sy||1),R),o);return B;},
   skyline(c,x0,x1,y,z,depth,prof,o){const pts=[new T.Vector2(x0,0)];for(const p of prof)pts.push(new T.Vector2(p[0],p[1]));pts.push(new T.Vector2(x1,0));const g=new T.ExtrudeGeometry(new T.Shape(pts),{depth,bevelEnabled:false,steps:1,curveSegments:1});add(k,o&&o.cls||'rock',g,c,mat(0,y,z-depth),o);g.dispose();return B;},
   // an upright prism from a footprint polygon [[x,z]..] (local to x,z), h tall, with a small bevel
   prism(cls,c,x,y,z,pts,h,o){o=o||{};const bv=Math.min(o.bevel===undefined?0.03:o.bevel,h*0.45),sh=new T.Shape(pts.map(p=>new T.Vector2(p[0],-p[1]))),g=new T.ExtrudeGeometry(sh,{depth:h-2*bv,bevelEnabled:bv>0,bevelThickness:bv,bevelSize:bv,bevelOffset:-bv,bevelSegments:1,steps:1,curveSegments:1});
    g.rotateX(-Math.PI/2);add(k,cls,g,c,mat(x,y+bv,z,0,o.ry||0,0),o);g.dispose();return B;},
   geo(cls,c,g,x,y,z,rx,ry,rz,sx,sy,sz,o){add(k,cls,g,c,mat(x,y,z,rx,ry,rz,sx,sy,sz),o);return B;},
   rock(c,x,y,z,r,h,seed,o){o=o||{};add(k,o.cls||'rock',rockG(((seed|0)%5+5)%5,o.smooth&&k.high?2:1),c,mat(x,y,z,0,o.ry===undefined?hs(seed,x)*6.28:o.ry,0,r*(o.sx||1),h/1.42,r*(o.sz||1)),Object.assign({ao:0.42,aoH:Math.max(0.25,h*0.6)},o));return B;},
   spire(c,x,y,z,r,h,seed,o){o=o||{};add(k,o.cls||'rock',spireG(((seed|0)%4+4)%4,k.high?7:5),c,mat(x,y,z,0,o.ry===undefined?hs(seed,z)*6.28:o.ry,0,r,h,r*(o.sz||1)),Object.assign({ao:0.45,aoH:h*0.5},o));return B;},
   glow(c,x,y,z,sx,sy,sz,ry,o){add(k,'glow',boxG(),c,mat(x,y,z,o&&o.rx||0,ry||0,o&&o.rz||0,sx,sy,sz),o);return B;},
   halo(x,y,z,size,c,a,pulse){k.halos.push([x,y,z,size,c,a===undefined?0.5:a,pulse||0]);return B;},
   // a horizontal quad that takes the baked ground (plateau tops, ramps): corners clockwise seen from above
   top(pts){for(let i=1;i<pts.length-1;i++)k.gtop.push(pts[0],pts[i],pts[i+1]);return B;},
   topRect(x0,z0,x1,z1,y){return B.top([[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]]);}
  };
  // layered rock: stacked, jittered, bevelled slabs inside the rect [x,z,w,d]. open: which sides look into the arena (they
  // get the ragged ledges; the others are straight so neighbouring masses meet). The top can be handed to the baked ground.
  B.strata=(rect,Hh,o)=>{
   o=o||{};const [x,z,w,d]=rect,sd=o.seed===undefined?x*3.1+z*1.7:o.seed,layers=o.layers||Math.max(2,Math.round(Hh/(k.high?0.3:0.5))),step=o.step||(k.high?0.85:1.4),open=o.open||{W:1,E:1,N:1,S:1},cols=o.cols||k.theme.strata,y0=o.y0||0,ins=o.inset===undefined?0.2:o.inset;
   for(let j=0;j<layers;j++){
    const hh=Hh/layers,yy=y0+j*hh,last=j===layers-1,grow=j/layers*(o.lean===undefined?0.16:o.lean),pts=[];
    const side=(ax,az,bx,bz,nx,nz,isOpen)=>{const L=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.round(L/step));for(let i=0;i<n;i++){const f=i/n,px=ax+(bx-ax)*f,pz=az+(bz-az)*f,r1=hs(px*1.7+sd+j*5.3,pz*1.3-j*2.1),r2=hs(pz*2.3-sd,px*0.7+j*9.1);
      const edge=Math.min(f,1-f)*L<0.01?0.5:1,inA=isOpen?(0.03+grow+ins*(r1>0.55?1:r1*0.5)*(0.5+0.5*r2))*edge+(i===0?0.06:0):0,tj=isOpen?(r2-0.5)*step*0.6:0;   // big, uneven bites: fractured rock, not rolls
      pts.push([Math.min(x+w,Math.max(x,px+nx*inA+(bx-ax)/L*tj)),Math.min(z+d,Math.max(z,pz+nz*inA+(bz-az)/L*tj))]);}};   // never outside its footprint
    side(x,z,x+w,z,0,1,open.N);side(x+w,z,x+w,z+d,-1,0,open.E);side(x+w,z+d,x,z+d,0,-1,open.S);side(x,z+d,x,z,1,0,open.W);
    const sh=new T.Shape(pts.map(p=>new T.Vector2(p[0],-p[1]))),bv=Math.min(0.022,hh*0.1);
    const g=new T.ExtrudeGeometry(sh,{depth:hh-2*bv,bevelEnabled:true,bevelThickness:bv,bevelSize:bv,bevelOffset:-bv,bevelSegments:1,steps:1,curveSegments:1});g.rotateX(-Math.PI/2);
    const c0=col(cols[(j+Math.floor(hs(sd,3)*4))%cols.length]),c=mul(c0,0.78),ct=mul(c0,1.18),M=mat(0,yy+bv,0);
    if(last&&o.cap!==false){   // the top face goes to the baked ground, the rest to the rock bucket
     const P=g.attributes.position,N=g.attributes.normal,keep=[],kn=[];
     for(let i=0;i<P.count;i+=3){if(N.getY(i)>0.9&&N.getY(i+1)>0.9&&N.getY(i+2)>0.9&&P.getY(i)>hh-2*bv){for(let q=0;q<3;q++)k.gtop.push([P.getX(i+q),yy+hh,P.getZ(i+q)]);}
      else for(let q=0;q<3;q++){keep.push(P.getX(i+q),P.getY(i+q),P.getZ(i+q));kn.push(N.getX(i+q),N.getY(i+q),N.getZ(i+q));}}
     const g2=new T.BufferGeometry();g2.setAttribute('position',new T.BufferAttribute(new Float32Array(keep),3));g2.setAttribute('normal',new T.BufferAttribute(new Float32Array(kn),3));
     add(k,'rock',g2,c,M,{ao:o.ao===undefined?0.3:o.ao,aoH:Hh*0.8,yb:o.yb===undefined?y0:o.yb,dust:0.15,dim:o.dim,top:ct});g2.dispose();
    }else add(k,'rock',g,c,M,{ao:o.ao===undefined?0.3:o.ao,aoH:Hh*0.8,yb:o.yb===undefined?y0:o.yb,dust:0.15,dim:o.dim,top:ct});
    g.dispose();
   }
   return B;
  };
  return B;
 }

 // ---------- per-renderer resources: detail tiles, the Earth, materials ----------
 const RES=new WeakMap();
 const FS_VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
 const NOISE=`
float h21(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 h22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+17.3;a*=.5;}return s;}
`;
 // tiling detail textures: kind 0 grit colour, 1 grit normal, 2 paint colour, 3 paint normal
 const TILE_FS=`precision highp float;varying vec2 vUv;uniform float uKind;uniform float uRes;`+NOISE+`
float hp(vec2 i,float per){return h21(mod(i,per)+3.7);}
float vnp(vec2 p,float per){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hp(i,per),hp(i+vec2(1.,0.),per),f.x),mix(hp(i+vec2(0.,1.),per),hp(i+vec2(1.,1.),per),f.x),f.y);}
float fbmp(vec2 p,float per){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnp(p,per);p*=2.;per*=2.;a*=.5;}return s;}
float gritH(vec2 u){float h=fbmp(u*5.,5.)*.55+fbmp(u*19.,19.)*.3;float pit=smoothstep(.72,.9,vnp(u*27.,27.));return h-pit*.22+vnp(u*90.,90.)*.07;}
float scr(vec2 u,float a,float f,float per){vec2 r=vec2(u.x*cos(a)+u.y*sin(a),-u.x*sin(a)+u.y*cos(a));return smoothstep(.80,.92,vnp(vec2(r.x*f,r.y*f*.045)+7.,per))*smoothstep(.35,.6,vnp(r*3.+2.,3.));}
float paintH(vec2 u){float d=fbmp(u*3.,3.)*.5;float s=max(scr(u,0.,96.,96.),scr(u.yx,0.,128.,128.));float chip=smoothstep(.70,.78,fbmp(u*14.+5.,14.));return d-s*.10-chip*.16+vnp(u*64.,64.)*.03;}
void main(){vec2 u=vUv;float e=1./uRes;
 if(uKind<.5){float v=.80+.26*fbmp(u*6.,6.);v*=1.-.16*smoothstep(.70,.9,vnp(u*27.,27.));v*=.93+.14*vnp(u*70.,70.);vec3 c=vec3(v)*mix(vec3(1.,.985,.96),vec3(.95,.98,1.),vnp(u*3.+9.,3.));gl_FragColor=vec4(min(c,1.),1.);}
 else if(uKind<1.5){float h0=gritH(u),hx=gritH(u+vec2(e,0.)),hy=gritH(u+vec2(0.,e));vec3 n=normalize(vec3((h0-hx)*uRes*.055,(h0-hy)*uRes*.055,1.));gl_FragColor=vec4(n*.5+.5,1.);}
 else if(uKind<2.5){float v=.90+.10*fbmp(u*3.,3.);float s=max(scr(u,0.,96.,96.),scr(u.yx,0.,128.,128.));float chip=smoothstep(.70,.78,fbmp(u*14.+5.,14.));float streak=pow(vnp(vec2(u.x*40.,u.y*2.)+3.,2.),3.);
  vec3 c=vec3(v)*(1.-.22*streak);c=mix(c,vec3(1.),s*.5);c=mix(c,vec3(.50,.36,.27),chip*.8);c*=.95+.08*vnp(u*80.,80.);gl_FragColor=vec4(min(c,1.),1.);}
 else{float h0=paintH(u),hx=paintH(u+vec2(e,0.)),hy=paintH(u+vec2(0.,e));vec3 n=normalize(vec3((h0-hx)*uRes*.03,(h0-hy)*uRes*.03,1.));gl_FragColor=vec4(n*.5+.5,1.);}
}`;
 function quadPass(renderer,material,rt){
  const R=res(renderer);if(!R.fsq){R.fsq=new T.Mesh(new T.PlaneGeometry(2,2),material);R.fsq.frustumCulled=false;R.fss=new T.Scene();R.fss.add(R.fsq);R.fsc=new T.OrthographicCamera(-1,1,1,-1,0,1);}
  R.fsq.material=material;const old=renderer.getRenderTarget(),ac=renderer.autoClear;renderer.autoClear=true;renderer.setRenderTarget(rt);renderer.render(R.fss,R.fsc);renderer.setRenderTarget(old);renderer.autoClear=ac;
 }
 function mkRT(w,h,srgb,mip,repeat){
  const rt=new T.WebGLRenderTarget(w,h,{depthBuffer:false,stencilBuffer:false,generateMipmaps:!!mip,minFilter:mip?T.LinearMipmapLinearFilter:T.LinearFilter,magFilter:T.LinearFilter});
  rt.texture.colorSpace=srgb?T.SRGBColorSpace:T.LinearSRGBColorSpace;if(repeat){rt.texture.wrapS=rt.texture.wrapT=T.RepeatWrapping;}return rt;
 }
 function res(renderer){
  let R=RES.get(renderer);if(!R){R={tiles:{},mats:{},refs:0};RES.set(renderer,R);}return R;
 }
 function tiles(renderer,q){
  const R=res(renderer),key=q;if(R.tiles[key])return R.tiles[key];
  const high=q!=='low',size=high?256:128,m=new T.ShaderMaterial({vertexShader:FS_VS,fragmentShader:TILE_FS,uniforms:{uKind:{value:0},uRes:{value:size}},depthTest:false,depthWrite:false,toneMapped:false});
  const out={},an=high?Math.min(4,renderer.capabilities.getMaxAnisotropy()):1;
  for(const [name,kind,srgb] of [['gritC',0,true],['gritN',1,false],['paintC',2,true],['paintN',3,false]]){if(!high&&!srgb)continue;const rt=mkRT(size,size,srgb,true,true);rt.texture.anisotropy=an;m.uniforms.uKind.value=kind;quadPass(renderer,m,rt);out[name]=rt;}
  m.dispose();R.tiles[key]=out;return out;
 }
 // the Earth, painted once by a small shader: oceans, land, swirling cloud, a lit limb, night on the far side, thin air
 const EARTH_FS=`precision highp float;varying vec2 vUv;`+NOISE+`
float f3(vec3 p){return fbm(p.xy*1.0+p.z*vec2(.7,-.4))*.6+fbm(p.zy*1.3+p.x*vec2(-.5,.6)+7.)*.4;}
void main(){vec2 u=vUv*2.16-1.08;float r2=dot(u,u);vec3 L=normalize(vec3(-.72,.3,.52));
 if(r2>1.){float g=max(0.,1.-(r2-1.)/.16);vec3 n=normalize(vec3(u,0.));float day=clamp(dot(n,L)*2.+.5,0.05,1.);gl_FragColor=vec4(.2,.45,.9,g*g*.45*day);return;}
 float z=sqrt(1.-r2);vec3 p=vec3(u,z);float land=f3(p*1.9+vec3(4.,1.,0.));float arid=fbm(p.xy*3.+p.z*2.+2.);vec2 w=vec2(fbm(p.xy*2.+p.z+7.),fbm(p.yx*2.-p.z+3.))-.5;float cl=fbm(vec2(p.x*2.4+p.z*1.2,p.y*4.4)+w*1.7+9.);
 float ndl=dot(p,L);float day=clamp(ndl*3.2+.12,0.,1.);
 vec3 c=land>.5?(arid>.52?vec3(.40,.33,.2):vec3(.13,.26,.11)):vec3(.012,.07+.05*land,.21+.1*land);if(abs(u.y)>.9-.06*arid)c=vec3(.85,.9,.95);
 float cm=clamp((cl-.47)*5.,0.,1.);c=mix(c,vec3(.93,.95,.98),cm);
 float spec=land>.5?0.:pow(max(ndl,0.),24.)*.3*(1.-cm);float rim=pow(1.-z,3.);
 vec3 o=(c*.9+spec)*day+vec3(.1,.3,.75)*rim*day+vec3(0.,0.,.004);float l=dot(o,vec3(.3,.55,.15));o=mix(o,vec3(l),.25);
 gl_FragColor=vec4(o,1.);}`;
 function earthTex(renderer,q){
  const R=res(renderer);if(R.earth)return R.earth.texture;
  const n=q==='low'?128:256,rt=mkRT(n,n,true,true,false),m=new T.ShaderMaterial({vertexShader:FS_VS,fragmentShader:EARTH_FS,depthTest:false,depthWrite:false,toneMapped:false});
  quadPass(renderer,m,rt);m.dispose();R.earth=rt;return rt.texture;
 }
 const GROUND_VS='uniform vec4 uRect;varying vec2 vUv;varying float vZ;void main(){vUv=(position.xz-uRect.xy)/uRect.zw;vZ=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
 const GROUND_FS='uniform sampler2D tMap;uniform vec3 uAmb;uniform vec3 uSun;uniform vec3 uFogC;uniform vec3 uFog;varying vec2 vUv;varying float vZ;void main(){vec4 t=texture2D(tMap,vUv);vec3 c=t.rgb*(uAmb+uSun*t.a);c=mix(c,uFogC,uFog.x*smoothstep(uFog.y,uFog.z,vZ));gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}';
 function materials(renderer,q,envMap){
  const R=res(renderer),key=q+'|'+(envMap?envMap.uuid:'');if(R.mats[key])return R.mats[key];
  const tl=tiles(renderer,q),high=q!=='low';let M;
  if(high){
   M={rock:new T.MeshStandardMaterial({vertexColors:true,map:tl.gritC.texture,normalMap:tl.gritN.texture,normalScale:new T.Vector2(0.85,0.85),roughness:0.96,metalness:0}),
    paint:new T.MeshStandardMaterial({vertexColors:true,map:tl.paintC.texture,normalMap:tl.paintN.texture,normalScale:new T.Vector2(0.5,0.5),roughness:0.6,metalness:0.1}),
    metal:new T.MeshStandardMaterial({vertexColors:true,map:tl.paintC.texture,normalMap:tl.paintN.texture,normalScale:new T.Vector2(0.4,0.4),roughness:0.42,metalness:envMap?0.8:0.25,envMap:envMap||null,envMapIntensity:0.85})};
  }else{const lam=new T.MeshLambertMaterial({vertexColors:true,map:tl.paintC.texture});M={rock:new T.MeshLambertMaterial({vertexColors:true,map:tl.gritC.texture}),paint:lam,metal:lam};}
  M.glow=new T.MeshBasicMaterial({vertexColors:true});
  R.mats[key]=M;return M;
 }
 const UVS={rock:1/2.3,paint:1/1.7,metal:1/1.7,glow:1};
 function meshOf(b,cls,material){
  const n=b.P.length/3;if(!n)return null;
  const g=new T.BufferGeometry(),P=new Float32Array(b.P),U=new Float32Array(n*2),s=UVS[cls];
  for(let i=0;i<n;i+=3){const a=i*3,ux=P[a+3]-P[a],uy=P[a+4]-P[a+1],uz=P[a+5]-P[a+2],vx=P[a+6]-P[a],vy=P[a+7]-P[a+1],vz=P[a+8]-P[a+2],nx=Math.abs(uy*vz-uz*vy),ny=Math.abs(uz*vx-ux*vz),nz=Math.abs(ux*vy-uy*vx);
   for(let j=0;j<3;j++){const o=(i+j)*3,x=P[o],y=P[o+1],z=P[o+2];if(ny>=nx&&ny>=nz){U[(i+j)*2]=x*s;U[(i+j)*2+1]=z*s;}else if(nx>=nz){U[(i+j)*2]=z*s;U[(i+j)*2+1]=y*s;}else{U[(i+j)*2]=x*s;U[(i+j)*2+1]=y*s;}}}
  g.setAttribute('position',new T.BufferAttribute(P,3));g.setAttribute('normal',new T.BufferAttribute(new Float32Array(b.N),3));g.setAttribute('color',new T.BufferAttribute(new Float32Array(b.C),3));
  if(cls!=='glow')g.setAttribute('uv',new T.BufferAttribute(U,2));
  const m=new T.Mesh(g,material);m.matrixAutoUpdate=false;m.frustumCulled=false;return m;
 }

 // ---------- the ground bake ----------
 const NCR=24,NBX=72,NCI=28;
 const MASK_VS='uniform vec4 uRect;attribute vec3 color;varying vec3 vC;void main(){vC=color;vec2 p=(position.xz-uRect.xy)/uRect.zw*2.0-1.0;gl_Position=vec4(p,0.0,1.0);}';
 const MASK_FS='varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.0);}';
 const BAKE_FS=`precision highp float;varying vec2 vUv;
uniform vec4 uRect,uPaintRect,uArena;uniform vec2 uTexel;uniform vec3 uL,uBase,uTopBase,uAmbRef;uniform float uSeed,uRelief,uPeb,uOutDim,uTopLit,uTopKind,uMottle,uWallPeb,uTrackK;
uniform sampler2D tShadow,tTop,tPaint,tDecal,tGlow;uniform int uNc,uNb,uNi;uniform vec4 uCr[`+NCR+`];uniform vec4 uBox[`+NBX+`];uniform vec3 uCir[`+NCI+`];
`+NOISE+`
float sdBox(vec2 p,vec2 c,vec2 h){vec2 d=abs(p-c)-h;return length(max(d,0.))+min(max(d.x,d.y),0.);}
float arenaD(vec2 P){return sdBox(P,uArena.xy+uArena.zw*.5,uArena.zw*.5);}
// the craters the rules know (slow zones): a deep bowl, a raised rim
float macro(vec2 P){float h=0.;for(int i=0;i<`+NCR+`;i++){if(i>=uNc)break;vec4 c=uCr[i];if(c.w>1.5)continue;float d=length(P-c.xy)/c.z;if(d>1.7)continue;
 h+=(d<1.?-.46*c.z*(1.-d*d)*(1.-.25*d*d):0.)+.13*c.z*exp(-pow((d-1.04)/.13,2.));}return h;}
float cellCr(vec2 P,float cs,float dens,float rmax,float keepOut){vec2 ip=floor(P/cs);float h=0.;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 c=ip+vec2(float(i),float(j));if(h21(c+uSeed)>dens)continue;
  vec2 ctr=(c+.15+.7*h22(c+uSeed*1.7))*cs;float rq=h21(c*1.3+7.+uSeed);float r=cs*rmax*(rq<.5?.3:rq<.85?.58:1.);
  if(keepOut>0.&&arenaD(ctr)<r*1.35+keepOut)continue;
  float d=length(P-ctr)/r;if(d>1.6)continue;h+=(d<1.?-.34*r*(1.-d*d)*(1.-.4*d*d):0.)+.018*r*exp(-pow((d-1.08)/.24,2.));}
 return h;}
float pebDens(vec2 P){float k=.012+.20*smoothstep(.56,.82,fbm(P*.21+31.+uSeed));for(int i=0;i<`+NCR+`;i++){if(i>=uNc)break;vec4 c=uCr[i];float d=length(P-c.xy)/c.z;
 if(c.w>1.5&&c.w<2.5)k=max(k,.95*smoothstep(1.05,.55,d));else if(c.w<1.5)k=max(k,.75*smoothstep(1.55,1.08,d)*smoothstep(.96,1.08,d));}
 for(int i=0;i<`+NCI+`;i++){if(i>=uNi)break;vec3 c=uCir[i];k=max(k,.6*smoothstep(c.z+.75,c.z+.1,length(P-c.xy)));}
 if(uWallPeb>0.)for(int i=0;i<`+NBX+`;i++){if(i>=uNb)break;vec4 b=uBox[i];k=max(k,uWallPeb*smoothstep(.9,.08,sdBox(P,b.xy+b.zw*.5,b.zw*.5)));}return k*uPeb;}
float pebbles(vec2 P,float cs,float dens){vec2 ip=floor(P/cs);float h=0.;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 c=ip+vec2(float(i),float(j));if(h21(c*1.9+uSeed+3.)>dens)continue;
  vec2 ctr=(c+h22(c+uSeed))*cs;float r=cs*(.14+.32*h21(c+11.));float d=length((P-ctr)*vec2(1.,1.+.6*h21(c+5.)));h=max(h,sqrt(max(0.,r*r-d*d))*.9);}
 return h;}
// rock tops (cliffs, mesas): cracked slabs at slightly different levels, no craters
vec3 vor(vec2 p){vec2 ip=floor(p),fp=fract(p);float d1=8.,d2=8.;vec2 id=vec2(0.);for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j));float d=length(g+h22(ip+g+uSeed)-fp);if(d<d1){d2=d1;d1=d;id=ip+g;}else if(d<d2)d2=d;}return vec3(d2-d1,id);}
float slabM(vec2 P){return smoothstep(.42,.62,fbm(P*.33+uSeed*2.));}
float slabH(vec2 P){vec3 v=vor(P*.52+vec2(fbm(P*.7)*.5));vec3 w=vor(P*1.7+7.);float m=slabM(P);return .018*h21(v.yz)-.03*m*smoothstep(.05,0.,v.x)-.01*(1.-m*.5)*smoothstep(.035,0.,w.x)*step(.5,h21(w.yz))+(fbm(P*1.4+uSeed)-.5)*.07+(vn(P*9.)-.5)*.012+(vn(P*27.)-.5)*.004;}
vec2 puv(vec2 P){return (P-uPaintRect.xy)/uPaintRect.zw;}
float inPaint(vec2 u){return step(0.,u.x)*step(u.x,1.)*step(0.,u.y)*step(u.y,1.);}
#ifdef PLATES
float plateH(vec2 P){vec2 pf=fract(P/4.);vec2 pd=min(pf,1.-pf)*4.;float seam=min(pd.x,pd.y);float h=-.03*smoothstep(.045,.0,seam);
 float rx=length(vec2(pd.x-.17,(fract(P.y/.5)-.5)*.5)),rz=length(vec2(pd.y-.17,(fract(P.x/.5)-.5)*.5));h+=.012*(smoothstep(.05,.02,rx)+smoothstep(.05,.02,rz));
 return h+(vn(P*9.)-.5)*.004+(fbm(P*1.3)-.5)*.012;}
vec3 plateA(vec2 P){vec2 ip=floor(P/4.);vec2 pf=fract(P/4.);vec2 pd=min(pf,1.-pf)*4.;float seam=min(pd.x,pd.y);
 float v=.86+.22*h21(ip+uSeed);float grime=fbm(P*.7+uSeed);v*=mix(.66,1.08,smoothstep(.3,.7,grime));v*=.93+.14*vn(P*6.);v*=1.-.3*smoothstep(.62,.8,fbm(P*2.3+7.));
 float scuff=pow(vn(vec2(P.x*1.2,P.y*14.)+3.),4.)+pow(vn(vec2(P.x*14.,P.y*1.2)+8.),4.);v+=.10*scuff;
 v*=1.-.55*smoothstep(.035,.0,seam);v+=.10*smoothstep(.12,.05,seam)*smoothstep(.035,.06,seam);
 return uBase*v*mix(vec3(1.02,1.,.97),vec3(.95,1.,1.05),vn(P*.4+2.));}
#endif
float gPeb=0.;
float height(vec2 P,float top){
#ifdef PLATES
 if(top<.5)return plateH(P)-texture2D(tPaint,puv(P)).r*inPaint(puv(P))*.02;
#endif
 if(top>.5&&uTopKind>.5)return slabH(P);
 float h=0.;if(top<.5)h+=macro(P);
 h+=cellCr(P,4.2,.4,.33,.5)+cellCr(P,11.,.5,.3,1.5);
 h+=(fbm(P*.42+uSeed)-.5)*.12+(fbm(P*2.1+9.)-.5)*.026;
#ifndef LITE
 h+=cellCr(P,1.1,.2,.3,0.)+cellCr(P+31.7,2.1,.13,.21,0.)+cellCr(P-17.3,.55,.1,.3,0.)+(vn(P*13.)-.5)*.007+(vn(P*39.)-.5)*.0035+pebbles(P,.2,gPeb);
#endif
 if(top<.5){vec2 u=puv(P);h-=texture2D(tPaint,u).r*inPaint(u)*.022;}
 return h;}
void main(){
 vec2 P=uRect.xy+vUv*uRect.zw;vec4 tm=texture2D(tTop,vUv);float top=step(.5,tm.r);
 gPeb=pebDens(P);float e=max(uTexel.x,.012);float h0=height(P,top),hx=height(P+vec2(e,0.),top),hz=height(P+vec2(0.,e),top);
 float rl=uRelief*mix(1.,.5,smoothstep(.3,2.5,arenaD(P)));   // beyond the arena the relief is flattened: background, lower contrast
 vec3 n=normalize(vec3(-(hx-h0)/e*rl,1.,-(hz-h0)/e*rl));
 float a=clamp(.78*max(dot(n,uL),0.)/uL.y,0.,1.);
 // the sun's shadow from props (drawn flat into tShadow) and from crater walls (marched through the height field)
 vec2 t=1./vec2(textureSize(tShadow,0));vec2 s4=texture2D(tShadow,vUv).rg*.4+(texture2D(tShadow,vUv+vec2(t.x,0.)).rg+texture2D(tShadow,vUv-vec2(t.x,0.)).rg+texture2D(tShadow,vUv+vec2(0.,t.y)).rg+texture2D(tShadow,vUv-vec2(0.,t.y)).rg)*.15;
 float sh=top>.5?s4.g:max(s4.r,s4.g);
 if(top<.5){vec2 dir=normalize(uL.xz);float tanE=uL.y/length(uL.xz),m0=macro(P),hs=0.,jit=.5+h21(P*37.3);for(int i=1;i<=16;i++){float tt=.05*(float(i)-1.+jit)*(1.+.16*float(i));hs=max(hs,smoothstep(0.,.09,macro(P+dir*tt)-m0-tt*tanE*.55));}sh=max(sh,hs*.8);}
 a*=1.-sh;
 // albedo
 vec3 alb;float ao=1.;vec2 u=puv(P);float ip=inPaint(u);
#ifdef PLATES
 if(top<.5)alb=plateA(P);else
#endif
 if(top>.5&&uTopKind>.5){vec3 v3=vor(P*.52+vec2(fbm(P*.7)*.5));vec3 w3=vor(P*1.7+7.);float m=slabM(P);float v=(.93+.14*h21(v3.yz+3.))*(.72+.56*fbm(P*.16+uSeed))*(.9+.2*fbm(P*.6+uSeed*3.))*(.94+.12*vn(P*7.))*(.97+.06*vn(P*31.));v*=1.-.42*m*smoothstep(.045,0.,v3.x);v*=1.-.2*(1.-m*.5)*smoothstep(.03,0.,w3.x)*step(.5,h21(w3.yz));alb=uTopBase*v*mix(1.22,1.,step(.3,tm.g));}else
 {vec3 base=top>.5?uTopBase:uBase;float m=fbm(P*.3+uSeed);float v=1.+uMottle*(m-.5)*2.;v*=.94+.12*vn(P*2.6+3.);v*=.965+.07*vn(P*21.);
  alb=base*v*mix(vec3(1.03,1.,.96),vec3(.96,.99,1.04),vn(P*.5+50.));
#ifndef LITE
  alb*=1.+.9*pebbles(P,.2,gPeb);
#endif
  if(top<.5)for(int i=0;i<`+NCR+`;i++){if(i>=uNc)break;vec4 c=uCr[i];vec2 dv=P-c.xy;float d=length(dv)/c.z;
   if(c.w<1.5){float ray=pow(vn(vec2(atan(dv.y,dv.x)*4.5,c.x*3.)),2.5)*smoothstep(2.5,1.05,d)*step(1.,d);alb*=1.+.26*ray+.2*exp(-pow((d-1.03)/.11,2.))+.10*smoothstep(1.45,1.05,d)*step(1.,d);alb*=1.-.24*smoothstep(1.,.25,d);}
   else if(c.w<2.5)alb*=1.-.16*smoothstep(1.1,.6,d);}
 }
 if(top<.5){
  vec4 pt=texture2D(tPaint,u)*ip;alb*=1.-uTrackK*pt.r;alb*=1.-.75*pt.b;
  vec4 dc=texture2D(tDecal,u)*ip;float wear=.55+.45*smoothstep(.25,.6,fbm(P*3.1+4.));alb=mix(alb,dc.rgb*(.8+.3*vn(P*17.)),dc.a*wear);
  float oc=0.;for(int i=0;i<`+NBX+`;i++){if(i>=uNb)break;vec4 b=uBox[i];float d=sdBox(P,b.xy+b.zw*.5,b.zw*.5);oc+=.7*exp(-max(d,0.)/.11)+.45*exp(-max(d,0.)/.42);}
  for(int i=0;i<`+NCI+`;i++){if(i>=uNi)break;vec3 c=uCir[i];oc+=.7*exp(-max(length(P-c.xy)-c.z,0.)/.11)+.45*exp(-max(length(P-c.xy)-c.z,0.)/.42);}
  ao=1.-.58*min(oc,1.05);
 }else a=mix(a,max(a,.5),uTopLit);
 float od=arenaD(P);float dim=(1.-.48*smoothstep(.25,1.1,od))*(1.-.6*smoothstep(1.1,17.,od))*mix(1.,uOutDim,step(.3,od));
 dim*=1.-.3*smoothstep(-.4,-3.,P.y);   // the strip the HUD sits over (north of the arena) is darker still
 {float osat=.5*smoothstep(.3,2.5,od);float lum=dot(alb,vec3(.3,.55,.15));alb=mix(alb,vec3(lum)*vec3(.96,.99,1.05),osat);}
 if(top>.5&&tm.g>.3)dim=.62*(1.-.6*smoothstep(0.,15.,od))*(1.-.3*smoothstep(-.4,-3.,P.y));   // wall tops are not playfield: one even, darker value, fading far out
 vec3 gl=texture2D(tGlow,u).rgb*ip;
 vec3 o=alb*ao*dim*(1.+gl*2.2/max(uAmbRef,vec3(.02)));
 gl_FragColor=vec4(clamp(o,0.,1.),a);
}`;
 // one canvas helper per map bake: three layers the themes paint with the 2D canvas API, in world units
 function paintLayers(rect,ppu){
  const w=Math.max(8,Math.round(rect[2]*ppu)),h=Math.max(8,Math.round(rect[3]*ppu)),mk=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.setTransform(w/rect[2],0,0,h/rect[3],-rect[0]*w/rect[2],-rect[1]*h/rect[3]);return x;};
  const paint=mk(),decal=mk(),glow=mk();paint.fillStyle='#000';paint.fillRect(rect[0],rect[1],rect[2],rect[3]);glow.fillStyle='#000';glow.fillRect(rect[0],rect[1],rect[2],rect[3]);glow.globalCompositeOperation='lighter';
  return {paint,decal,glow,rect,ppu};
 }
 const canvTex=(x,srgb)=>{const t=new T.CanvasTexture(x.canvas);t.colorSpace=srgb?T.SRGBColorSpace:T.LinearSRGBColorSpace;t.flipY=false;t.generateMipmaps=false;t.minFilter=T.LinearFilter;t.magFilter=T.LinearFilter;return t;};
 function bake(renderer,M){
  const k=M.kit,th=M.theme,view=M.view,L=M.sun,rect=[view.x0,view.z0,view.x1-view.x0,view.z1-view.z0],w=M.bakeW,h=M.bakeH;
  const rectU=new T.Vector4(rect[0],rect[1],rect[2],rect[3]);
  // masks: where the tops are (r) and where the sun is blocked (r: things standing on the floor, g: things standing on a top)
  const top=mkRT(w,h,false,false),shadow=mkRT(w,h,false,false),mm=new T.ShaderMaterial({vertexShader:MASK_VS,fragmentShader:MASK_FS,uniforms:{uRect:{value:rectU}},side:T.DoubleSide,depthTest:false,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending,transparent:true});
  const draw=(P,C,rt)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(P,3));g.setAttribute('color',new T.BufferAttribute(C,3));const m=new T.Mesh(g,mm);m.frustumCulled=false;const s=new T.Scene();s.add(m);
   const old=renderer.getRenderTarget(),ac=renderer.autoClear,cc=new T.Color();renderer.getClearColor(cc);const ca=renderer.getClearAlpha();renderer.setClearColor(0x000000,0);renderer.autoClear=true;renderer.setRenderTarget(rt);renderer.render(s,M.cam0);renderer.setRenderTarget(old);renderer.autoClear=ac;renderer.setClearColor(cc,ca);g.dispose();};
  {const n=k.gtop.length,P=new Float32Array(n*3),C=new Float32Array(n*3);for(let i=0;i<n;i++){const p=k.gtop[i];P[i*3]=p[0];P[i*3+1]=0;P[i*3+2]=p[2];C[i*3]=1;C[i*3+1]=p[1]/4;}draw(P,C,top);}
  {let n=0;for(const c of ['rock','paint','metal'])n+=k[c].Y.length;const P=new Float32Array(n*3),C=new Float32Array(n*3),kx=L[0]/L[1],kz=L[2]/L[1];let o=0;
   for(const c of ['rock','paint','metal']){const b=k[c];for(let i=0;i<b.Y.length;i++){const yb=b.Y[i];if(yb<0){P[o*3]=1e6;o++;continue;}const dy=Math.max(0,b.P[i*3+1]-yb);P[o*3]=b.P[i*3]-kx*dy;P[o*3+2]=b.P[i*3+2]-kz*dy;if(yb>0.01)C[o*3+1]=1;else C[o*3]=1;o++;}}
   for(const e of M.extraShadow||[]){/* reserved */}
   draw(P,C,shadow);}
  mm.dispose();
  // the three painted layers
  const pr=th.paintRect||[-1,-1,AW+2,AH+2],lay=paintLayers(pr,M.soft?16:k.high?40:24);if(th.paint)th.paint(lay,M);
  const tP=canvTex(lay.paint,false),tD=canvTex(lay.decal,true),tG=canvTex(lay.glow,true);
  const cr=[],bx=[],ci=[];
  for(const c of M.craters)cr.push(new T.Vector4(c[0],c[1],c[2],c[3]));while(cr.length<NCR)cr.push(new T.Vector4(0,0,0,0));
  for(const b of M.aoBoxes)bx.push(new T.Vector4(b[0],b[1],b[2],b[3]));while(bx.length<NBX)bx.push(new T.Vector4(0,0,0,0));
  for(const c of M.aoCircles)ci.push(new T.Vector3(c[0],c[1],c[2]));while(ci.length<NCI)ci.push(new T.Vector3(0,0,0));
  const amb=M.env?M.env.uniforms.uAmb.value:new T.Vector3(0.11,0.135,0.16);
  const bm=new T.ShaderMaterial({vertexShader:FS_VS,fragmentShader:BAKE_FS,defines:Object.assign(th.plates?{PLATES:1}:{},M.soft?{LITE:1}:{}),depthTest:false,depthWrite:false,toneMapped:false,uniforms:{
   uRect:{value:rectU},uPaintRect:{value:new T.Vector4(pr[0],pr[1],pr[2],pr[3])},uArena:{value:new T.Vector4(0,0,AW,AH)},uTexel:{value:new T.Vector2(rect[2]/w,rect[3]/h)},uL:{value:new T.Vector3(L[0],L[1],L[2])},
   uBase:{value:new T.Vector3(...lin(th.ground))},uTopBase:{value:new T.Vector3(...lin(th.topGround||th.ground))},uAmbRef:{value:amb.clone()},uSeed:{value:th.seed||1},uRelief:{value:th.relief||1.5},uPeb:{value:th.pebbles===undefined?1:th.pebbles},uOutDim:{value:th.outDim===undefined?1:th.outDim},uTopLit:{value:th.topLit||0},uTopKind:{value:th.topKind||0},uMottle:{value:th.mottle===undefined?0.2:th.mottle},uWallPeb:{value:th.wallPeb||0},uTrackK:{value:th.trackK||0.24},
   uNc:{value:Math.min(NCR,M.craters.length)},uNb:{value:Math.min(NBX,M.aoBoxes.length)},uNi:{value:Math.min(NCI,M.aoCircles.length)},tShadow:{value:shadow.texture},tTop:{value:top.texture},tPaint:{value:tP},tDecal:{value:tD},tGlow:{value:tG},uCr:{value:cr.slice(0,NCR)},uBox:{value:bx.slice(0,NBX)},uCir:{value:ci.slice(0,NCI)}}});
  quadPass(renderer,bm,M.rt);
  bm.dispose();top.dispose();shadow.dispose();tP.dispose();tD.dispose();tG.dispose();
 }

 // ---------- build ----------
 // o: {renderer, q:'high'|'low', view:{x0,x1,z0,z1} ground rect to cover, env (MapEnv instance or null), soft (CPU rasteriser: small bake), density (ground px per unit wanted), envMap}
 // everything that needs no renderer: the theme, the kit with every prop pushed in, the lists the bake reads
 function prep(id,o){
  T=THREE;if(typeof ArenaProps==='undefined')throw Error('ArenaProps missing');
  const MP=MAPS[id]&&!MAPS[id].isRandom?MAPS[id]:MAPS.classic;if(MP===MAPS.classic&&id!=='classic')id='classic';
  const q=o.q==='low'?'low':'high',th=ArenaProps.theme(id),k=mkKit(q,th),B=builder(k);
  const view=Object.assign({x0:-2,x1:AW+2,z0:-2,z1:AH+2},o.view||{});view.x0=Math.max(-46,Math.min(-1.5,view.x0));view.x1=Math.min(AW+46,Math.max(AW+1.5,view.x1));view.z0=Math.max(-16,Math.min(-1.5,view.z0));view.z1=Math.min(AH+14,Math.max(AH+1.5,view.z1));
  const env=o.env||null;if(env)env.use(id,k.anchors);   // the map's preset first: the sun the bake uses is the layer's sun
  const sun=env?env.sunDir():(()=>{const d=(MapEnv.PRESETS[id]||MapEnv.PRESETS.classic).sunDir,l=Math.hypot(d[0],d[1],d[2]);return [d[0]/l,d[1]/l,d[2]/l];})();
  k.sun=sun;
  const M={id,q,theme:th,kit:k,view,sun,env,soft:!!o.soft,craters:[],aoBoxes:[],aoCircles:[],cam0:new T.OrthographicCamera(-1,1,1,-1,0,1),map:MP,thumb:!!o.thumb};
  // what the rules know: solids give contact shading, craters their bowls
  for(const w of MP.walls||[])M.aoBoxes.push([w[0],w[1],w[2],w[3]]);
  for(const r of MP.rocks||[])M.aoCircles.push([r[0],r[1],r[2]*0.92]);
  for(const c of MP.craters||[])M.craters.push([c[0],c[1],c[2],c[3]==='scree'?2:c[3]==='coolant'?3:1]);
  ArenaProps.build(id,B,M);
  for(const s of k.spin){s.kit=mkKit(q,th);s.kit.sun=null;s.build(builder(s.kit));}   // moving parts are small kits of their own
  if(env)env.use(id,k.anchors);   // again: the props published their anchors (vents, lasers, rail)
  return M;
 }
 // o: {renderer, q:'high'|'low', view:{x0,x1,z0,z1} ground rect to cover, env (MapEnv instance or null), soft (CPU rasteriser: small bake), density (ground px per unit wanted), envMap}
 function build(id,o){
  const M=prep(id,o),k=M.kit,th=M.theme,q=M.q,high=q==='high',view=M.view,env=M.env,renderer=o.renderer;id=M.id;
  // meshes
  const G=new T.Group();G.name='arena:'+id;const mats=materials(renderer,q,o.envMap||null);
  const meshes={};for(const c of CLS){const m=meshOf(k[c],c,mats[c]);if(m){meshes[c]=m;G.add(m);}}
  if(!high&&meshes.metal&&meshes.paint){/* LOW shares one Lambert material between paint and metal: two draws, one program */}
  // the baked ground: one big floor quad + every top
  const dens=Math.max(8,Math.min(o.soft?14:high?64:32,o.density||48)),area=(view.x1-view.x0)*(view.z1-view.z0);
  let ppu=dens;const cap=o.soft?0.9e6:high?(o.phone?5.2e6:7e6):1.6e6;if(area*ppu*ppu>cap)ppu=Math.sqrt(cap/area);
  const maxT=Math.min(4096,renderer.capabilities.maxTextureSize||4096);ppu=Math.min(ppu,maxT/(view.x1-view.x0),maxT/(view.z1-view.z0));
  M.bakeW=Math.max(64,Math.round((view.x1-view.x0)*ppu));M.bakeH=Math.max(64,Math.round((view.z1-view.z0)*ppu));
  M.rt=mkRT(M.bakeW,M.bakeH,true,true,false);M.rt.texture.anisotropy=high?Math.min(4,renderer.capabilities.getMaxAnisotropy()):1;
  const gm=new T.ShaderMaterial({side:T.DoubleSide,vertexShader:GROUND_VS,fragmentShader:GROUND_FS,uniforms:{tMap:{value:M.rt.texture},uRect:{value:new T.Vector4(view.x0,view.z0,view.x1-view.x0,view.z1-view.z0)},
   uAmb:env?env.uniforms.uAmb:{value:new T.Vector3(0.11,0.135,0.16)},uSun:env?env.uniforms.uSun:{value:new T.Vector3(0.7,0.66,0.6)},uFogC:env?env.uniforms.uFogC:{value:new T.Vector3()},uFog:env?env.uniforms.uFog:{value:new T.Vector3(0,0,1)}}});
  {const tri=[[view.x0,0,view.z0],[view.x1,0,view.z0],[view.x1,0,view.z1],[view.x0,0,view.z0],[view.x1,0,view.z1],[view.x0,0,view.z1]].concat(k.gtop),P=new Float32Array(tri.length*3);for(let i=0;i<tri.length;i++){P[i*3]=tri[i][0];P[i*3+1]=tri[i][1];P[i*3+2]=tri[i][2];}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(P,3));const m=new T.Mesh(g,gm);m.frustumCulled=false;m.matrixAutoUpdate=false;m.renderOrder=-2;meshes.ground=m;G.add(m);}
  bake(renderer,M);
  // sky: stars and the Earth sit far below the ground plane along the view, so they only show where no terrain covers them
  const sky=!M.thumb&&ArenaProps.sky?ArenaProps.sky(T,M,earthTex(renderer,q)):null;if(sky)G.add(sky.group);
  if(M.thumb){const K=crate(renderer,q,th.crate);for(const c of M.map.crates||[]){const m=new T.Mesh(K.geo,K.mat);m.scale.set(c[2],0.85,c[3]);m.position.set(c[0]+c[2]/2,0,c[1]+c[3]/2);G.add(m);}}   // a menu picture shows the crates too
  // moving parts
  for(const s of k.spin){const mk=s.kit,g=new T.Group();for(const c of CLS){const m=meshOf(mk[c],c,mats[c]);if(m){m.matrixAutoUpdate=true;g.add(m);}}g.position.set(s.p[0],s.p[1],s.p[2]);if(s.rot)g.rotation.set(s.rot[0],s.rot[1],s.rot[2]);G.add(g);s.o=g;}
  M.ms=0;
  const out={group:G,id,q,env:true,arena:true,spin:k.spin.map(s=>({o:s.o,axis:s.axis,spd:s.spd})),halos:k.halos,anims:k.anims,anchors:k.anchors,deck:null,theme:th,view,rt:M.rt,sky,disposed:false,sun:M.sun,
   stats:{verts:CLS.reduce((n,c)=>n+k[c].P.length/3,0),bake:[M.bakeW,M.bakeH],ppu},
   rebake(dir){M.sun=dir;out.sun=dir;bake(renderer,M);},
   dispose(){if(out.disposed)return;out.disposed=true;const keep=M.thumb?crate(renderer,q,th.crate).geo:null;G.traverse(x=>{if(x.geometry&&x.geometry!==keep)x.geometry.dispose();});gm.dispose();M.rt.dispose();if(sky)sky.dispose();}};
  // the kit's source arrays are only needed again if the sun moves (rebake); keep positions and base heights, drop the rest
  for(const c of CLS){k[c].N=null;k[c].C=null;}
  return out;
 }
 // a breakable crate: one merged mesh at unit size (the renderer scales it to the crate's footprint and clones the material)
 function crate(renderer,q,style){
  T=THREE;const R=res(renderer),key='crate|'+q+'|'+style;if(R[key])return R[key];
  const k=mkKit(q,{dust:null,strata:['#777']});ArenaProps.crate(builder(k),style);const all={P:[],N:[],C:[],Y:[]};for(const c of ['rock','paint','metal'])for(const f of ['P','N','C'])for(const v of k[c][f])all[f].push(v);
  const m=meshOf(all,'paint',materials(renderer,q,null).paint);R[key]={geo:m.geometry,mat:m.material};return R[key];
 }
 // a soft rounded-rectangle alpha texture for the ground shadows of tanks and crates
 function shadowTex(renderer){
  T=THREE;const R=res(renderer);if(R.shTex)return R.shTex;const n=64,d=new Uint8Array(n*n*4);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=Math.abs((i+0.5)/n*2-1),y=Math.abs((j+0.5)/n*2-1),qx=Math.max(0,x-0.42),qy=Math.max(0,y-0.42),dd=Math.hypot(qx,qy)/0.58,a=Math.max(0,1-dd),v=a*a*(3-2*a)*255,o=(j*n+i)*4;d[o]=d[o+1]=d[o+2]=v;d[o+3]=255;}
  const t=new T.DataTexture(d,n,n,T.RGBAFormat);t.magFilter=T.LinearFilter;t.minFilter=T.LinearFilter;t.needsUpdate=true;R.shTex=t;return t;
 }
 // ---------- ground marks: tread prints behind tanks and scorch where things blow up. One pooled mesh, one draw call ----------
 // Quads live in a ring buffer; age and fade are worked out in the shader from each quad's birth time, so nothing is
 // re-uploaded unless a mark is added. tread(id,x,z,y,width,strength) is called as a tank moves; lift(id) breaks its trail.
 const MARK_VS='attribute vec3 mk;uniform float uT;uniform vec2 uLife;varying vec2 vU;varying vec3 vK;void main(){vU=uv;vK=mk;float life=mk.y<0.5?uLife.x:uLife.y;gl_Position=uT-mk.x>life?vec4(2.0,2.0,2.0,1.0):projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
 const MARK_FS='uniform float uT;uniform vec2 uLife;varying vec2 vU;varying vec3 vK;void main(){float life=vK.y<0.5?uLife.x:uLife.y;float f=1.0-smoothstep(life*0.55,life,uT-vK.x);float a;'+
  'if(vK.y<0.5){float x=abs(vU.x-0.5)*2.0;float band=smoothstep(0.52,0.60,x)*smoothstep(1.0,0.92,x);float v=fract(vU.y*2.6);a=band*(0.42+0.58*smoothstep(0.18,0.32,v)*smoothstep(0.86,0.72,v));}'+
  'else{float r=length(vU-0.5)*2.0;float n=fract(sin(dot(floor(vU*11.0),vec2(12.9898,78.233)))*43758.5453);a=smoothstep(1.0,0.2,r)*(0.72+0.28*n);}'+
  'gl_FragColor=vec4(0.03,0.03,0.035,a*f*vK.z);}';
 function marks(max){
  T=THREE;const n=max||900,P=new Float32Array(n*12),U=new Float32Array(n*8),K=new Float32Array(n*12).fill(-1e6),I=new Uint16Array(n*6);
  for(let i=0;i<n;i++){I.set([i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3],i*6);}
  const g=new T.BufferGeometry(),aP=new T.BufferAttribute(P,3),aU=new T.BufferAttribute(U,2),aK=new T.BufferAttribute(K,3);for(const a of [aP,aU,aK])a.setUsage(35048);
  g.setAttribute('position',aP);g.setAttribute('uv',aU);g.setAttribute('mk',aK);g.setIndex(new T.BufferAttribute(I,1));
  const m=new T.ShaderMaterial({vertexShader:MARK_VS,fragmentShader:MARK_FS,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,uniforms:{uT:{value:0},uLife:{value:new T.Vector2(14,26)}}});
  const mesh=new T.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=-1;mesh.matrixAutoUpdate=false;
  let head=0,time=0,cap=n;const trails=new Map();
  const quad=(ax,az,bx,bz,cx,cz,dx,dz,y,v0,v1,kind,str)=>{const q=head;head=(head+1)%cap;const o=q*12;P.set([ax,y,az,bx,y,bz,cx,y,cz,dx,y,dz],o);U.set([0,v0,1,v0,1,v1,0,v1],q*8);for(let i=0;i<4;i++)K.set([time,kind,str],o+i*3);
   for(const a of [aP,aK]){a.addUpdateRange(o,12);a.needsUpdate=true;}aU.addUpdateRange(q*8,8);aU.needsUpdate=true;};
  return {mesh,
   limit(c){cap=Math.max(8,Math.min(n,c|0));if(head>=cap)head=0;},
   life(tread,scorch){m.uniforms.uLife.value.set(tread,scorch);},
   tread(id,x,z,y,w,str){let t=trails.get(id);if(!t){trails.set(id,{x,z,l:null,d:0});return;}const dx=x-t.x,dz=z-t.z,d=Math.hypot(dx,dz);if(d<0.3)return;if(d>1.6){t.x=x;t.z=z;t.l=null;return;}   // a jump (dash, respawn) starts a new trail
    const nx=-dz/d*w/2,nz=dx/d*w/2,l=t.l||[t.x-nx,t.z-nz,t.x+nx,t.z+nz];quad(l[0],l[1],l[2],l[3],x+nx,z+nz,x-nx,z-nz,y,t.d*3.4,(t.d+d)*3.4,0,str);t.l=[x-nx,z-nz,x+nx,z+nz];t.d+=d;t.x=x;t.z=z;},
   lift(id){trails.delete(id);},
   scorch(x,z,r,y,str){quad(x-r,z-r,x+r,z-r,x+r,z+r,x-r,z+r,y===undefined?0.012:y,0,1,1,str===undefined?0.6:str);},
   update(t){time=t;m.uniforms.uT.value=t;},
   clear(){K.fill(-1e6);for(const a of [aP,aU,aK])a.clearUpdateRanges();aK.needsUpdate=true;trails.clear();head=0;},
   dispose(){g.dispose();m.dispose();}};
 }
 // free what one renderer holds (context lost, renderer disposed)
 function release(renderer){const R=RES.get(renderer);if(!R)return;for(const q in R.tiles)for(const n in R.tiles[q])R.tiles[q][n].dispose();for(const key in R.mats)for(const n in R.mats[key])R.mats[key][n].dispose();
  for(const key in R)if(key.startsWith('crate|'))R[key].geo.dispose();if(R.earth)R.earth.dispose();if(R.shTex)R.shTex.dispose();if(R.fsq)R.fsq.geometry.dispose();RES.delete(renderer);}
 return {VERSION,build,prep,crate,shadowTex,marks,release,CLS,lin,hs,vn3,mixc,mul,res,AW,AH};
})();
