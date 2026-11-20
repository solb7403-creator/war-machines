/* LUNAR Conquest world kit — NATURE, PARASITE structures and field props (Session 5E-2d1).
 * NATURE: a rugged frontier under a terraformed sky (hardy, wind-bent, olive / dry straw / dark green — never a lush park);
 * on the barren Moon grey regolith rock and glowing alien growths. Rocks are cut like jewels: big flat planes, lighter top
 * facets. PARASITE: dark violet chitin, bone ribs, magenta glow; hostile, organic, asymmetric — nothing human.
 * Most of these models are instanced hundreds of times, so every one is built triangle by triangle (T3 / facets / sweep
 * below make exactly the triangles they are asked for) and the per-slot caps in the comments are hard.
 * Unit shapes (rock, rock-moss, crystal-growth, fungus-growth) fit their stated unit envelope and are scaled per instance.
 * b.hi === false is LOW: the silhouette and the big colour blocks only. */
(function(root){
'use strict';
const WK=root.ConquestWorldKit,TAU=Math.PI*2;
const hz=(s,k)=>WK.hash((Math.imul((s|0)+11,2654435)+Math.imul((k|0)+3,40503))|0);   // deterministic 0..1
const flatOf=m=>({c:m.c,a:0,j:m.j||0});          // the same colour with no surface code (safe to blend into a glow)
const pt=(p,m)=>[p[0],p[1],p[2],m];              // a point that carries its own vertex material
const lerp3=(a,c,t)=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t,a[2]+(c[2]-a[2])*t];

// ------------------------------------------------------------------ triangle tools --------------------------------------
// (sweep with o.closed joins the last ring to the first: collars, ring veins; give o.ref = the loop plane's normal)
// one flat triangle (exactly one triangle in the buffer). m = material, or ny => material; a point's 4th element is its own
// vertex material (colour gradients along a crystal). ins = a point the face looks away from.
function T3(b,p,q,r,m,ins){let nx=(q[1]-p[1])*(r[2]-p[2])-(q[2]-p[2])*(r[1]-p[1]),ny=(q[2]-p[2])*(r[0]-p[0])-(q[0]-p[0])*(r[2]-p[2]),nz=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 const l=Math.hypot(nx,ny,nz);if(l<1e-9)return b;nx/=l;ny/=l;nz/=l;
 let f=false;if(ins)f=nx*((p[0]+q[0]+r[0])/3-ins[0])+ny*((p[1]+q[1]+r[1])/3-ins[1])+nz*((p[2]+q[2]+r[2])/3-ins[2])<0;if(f){nx=-nx;ny=-ny;nz=-nz;}
 const M=typeof m==='function'?m(ny,p,q,r):m;
 b.jit=1+(WK.hash((Math.round(nx*9)*73+Math.round(ny*9)*179+Math.round(nz*9)*283)|0)-.5)*2;   // one tone per facet plane
 const i0=b._v(p[0],p[1],p[2],nx,ny,nz,p[3]||M),i1=b._v(q[0],q[1],q[2],nx,ny,nz,q[3]||M),i2=b._v(r[0],r[1],r[2],nx,ny,nz,r[3]||M);
 if(f)b.cur.I.push(i0,i2,i1);else b.cur.I.push(i0,i1,i2);return b;}
const cen=R=>{let x=0,y=0,z=0;for(const p of R){x+=p[0];y+=p[1];z+=p[2];}return [x/R.length,y/R.length,z/R.length];};
// a two-sided flat triangle / quad (leaves, wings): 2 or 4 triangles
function leafTri(b,p,q,r,m,mu){const c=[(p[0]+q[0]+r[0])/3,(p[1]+q[1]+r[1])/3,(p[2]+q[2]+r[2])/3];T3(b,p,q,r,m,[c[0],c[1]-9,c[2]]);if(mu!==null)T3(b,p,q,r,mu||m,[c[0],c[1]+9,c[2]]);}
// faceted skin over rings of [x,y,z] points (one vertex count): 2n triangles per band, n for an apex / nadir fan.
// o.stag: the rings are staggered by half a step (jewel facets: every triangle near equilateral). o.bandM(r) = that band's
// material, o.bandV(r, 0 | 1) = a vertex material for the band's lower / upper ring (gradients), o.apexRingM likewise.
function facets(b,R,m,o={}){const n=R[0].length,wrap=(A,vm)=>vm?A.map(p=>pt(p,vm)):A;
 for(let r=0;r<R.length-1;r++){const A=wrap(R[r],o.bandV&&o.bandV(r,0)),B=wrap(R[r+1],o.bandV&&o.bandV(r,1)),ca=cen(A),cb=cen(B),ins=[(ca[0]+cb[0])/2,(ca[1]+cb[1])/2,(ca[2]+cb[2])/2],bm=(o.bandM&&o.bandM(r))||m;
  for(let i=0;i<n;i++){const j=(i+1)%n;if(o.stag?(r&1):((i+r)&1)){T3(b,A[i],A[j],B[j],bm,ins);T3(b,A[i],B[j],B[i],bm,ins);}else{T3(b,A[i],A[j],B[i],bm,ins);T3(b,A[j],B[j],B[i],bm,ins);}}}
 if(o.apex){const A=wrap(R[R.length-1],o.apexRingM),c=cen(A),ins=o.apexIns||[c[0]-(o.apex[0]-c[0])*.3,c[1]-(o.apex[1]-c[1])*.3,c[2]-(o.apex[2]-c[2])*.3];for(let i=0;i<n;i++)T3(b,A[i],A[(i+1)%n],o.apex,o.apexM||m,ins);}
 if(o.nadir){const A=wrap(R[0],o.nadirRingM),c=cen(A),ins=o.nadirIns||[c[0]-(o.nadir[0]-c[0])*.3,c[1]-(o.nadir[1]-c[1])*.3,c[2]-(o.nadir[2]-c[2])*.3];for(let i=0;i<n;i++)T3(b,A[i],A[(i+1)%n],o.nadir,o.nadirM||m,ins);}
 return b;}
// material by facet direction: lighter on top, darker underneath (the rule of every rock and leaf mass here)
const shade=(m,top,low)=>ny=>ny>.42?top:ny<-.18?low:m;
// Profiles [height fraction, radius fraction] of the lumps below (an apex closes the top at 1, a nadir the bottom at 0)
const ROCK4=[[0,.9],[.2,1],[.6,.82],[.86,.46]],ROCK3=[[0,.9],[.28,1],[.72,.62]],ROCK2=[[0,1],[.5,.74]],ROCK1=[[0,1]],
 CROWN3=[[.24,.72],[.56,1],[.84,.62]],CROWN2=[[.3,.9],[.72,.78]],CROWN1=[[.45,1]];
// an irregular faceted lump inside the ellipsoid box (x ± rx, y .. y + ry, z ± rz): n sides, o.prof rings, jewel cut planes.
// triangles = 2n(rings - 1) + n (apex) + n (nadir)
function blob(b,x,y,z,rx,ry,rz,o){const n=o.n||6,P=o.prof||ROCK3,sd=o.seed||1,jit=o.jit??.2,yaw=o.yaw||0,lx=o.lx||0,lz=o.lz||0,R=[];
 // cut planes in unit space: a vertex beyond a plane is pulled back onto it (flat jewel faces)
 const cuts=[];for(let c=0;c<(o.cuts||0);c++){const a=hz(sd,900+c)*TAU,e=.25+.85*hz(sd,930+c),d=.6+.2*hz(sd,960+c);cuts.push([Math.cos(a)*Math.cos(e),Math.sin(e),Math.sin(a)*Math.cos(e),d]);}
 const put=(ux,t,uz,m)=>{let uy=t-.35;for(const [cx,cy,cz,d] of cuts){const s=ux*cx+uy*cy+uz*cz-d;if(s>0){ux-=cx*s;uy-=cy*s;uz-=cz*s;}}const tt=Math.max(o.nadir?-1:0,uy+.35),q=[x+ux*rx+lx*tt,y+ry*tt,z+uz*rz+lz*tt];if(m)q[3]=m;return q;};
 P.forEach(([t,rr],k)=>{const ring=[];for(let i=0;i<n;i++){const a=yaw+(i+(k%2)*.5+(hz(sd,k*31+i)-.5)*.4)/n*TAU,f=rr*(1-jit*hz(sd,k*57+i+100))*(o.zig&&i%2?1-o.zig:1),tt=t+(k||o.nadir?(hz(sd,k*91+i+200)-.5)*(o.yj??.1):0);
   ring.push(put(Math.cos(a)*f,Math.min(tt,.97),Math.sin(a)*f,o.vm?o.vm(k,i):null));}R.push(ring);});
 return facets(b,R,o.m,{stag:true,apex:o.apex===false?null:put(o.ax||0,o.at??1,o.az||0,o.apexV),apexM:o.apexM,nadir:o.nadir?put(o.nx||0,o.nt??0,o.nz||0,o.nadirV):null,nadirM:o.nadirM});}
// a faceted tube through points (trunks, limbs, horns, roots): rad = number | array | t => radius; 2n triangles per
// segment (+ n with o.tip, + n with o.butt). o.twist radians per ring, o.sq flattens the section, o.vm(k,i) vertex material
function sweep(b,pts,rad,n,m,o={}){const R=[],L=pts.length;let ux=o.ref?o.ref[0]:1,uy=o.ref?o.ref[1]:0,uz=o.ref?o.ref[2]:0;
 for(let k=0;k<L;k++){const p=pts[k],a=o.closed?pts[(k+L-1)%L]:pts[Math.max(0,k-1)],c=o.closed?pts[(k+1)%L]:pts[Math.min(L-1,k+1)];let dx=c[0]-a[0],dy=c[1]-a[1],dz=c[2]-a[2];const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;
  if(k===0&&!o.ref&&Math.abs(dx)>.85){ux=0;uy=0;uz=1;}
  const t=ux*dx+uy*dy+uz*dz;ux-=t*dx;uy-=t*dy;uz-=t*dz;const ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;const vx=dy*uz-dz*uy,vy=dz*ux-dx*uz,vz=dx*uy-dy*ux;
  const r=typeof rad==='function'?rad(k/(L-1),k):Array.isArray(rad)?rad[k]:rad,ring=[],tw=(o.twist||0)*k+(o.rot||0),sq=o.sq||1;
  for(let i=0;i<n;i++){const an=i/n*TAU+tw,cs=Math.cos(an)*r,sn=Math.sin(an)*r*sq,q=[p[0]+ux*cs+vx*sn,p[1]+uy*cs+vy*sn,p[2]+uz*cs+vz*sn];if(o.vm)q[3]=o.vm(k,i);ring.push(q);}R.push(ring);}
 if(o.closed)R.push(R[0]);
 return facets(b,R,m,{apex:o.tip,apexM:o.tipM,apexRingM:o.tipRingM,apexIns:o.tipIns,nadir:o.butt,nadirM:o.buttM,bandM:o.bandM,bandV:o.bandV});}
// a crystal shard from base to tip: narrow foot, wide shoulder, a chisel point. M = [foot, dark body, shoulder glow, tip glow].
// HIGH: 5n triangles (a metal foot band, then the glow gradient); LOW or o.lite: 3n.
function crystal(b,base,tip,r,n,M,o={}){const p2=lerp3(base,tip,o.sh??.66),sq=o.sq??.72,f0=flatOf(M[1]);
 if(b.hi&&!o.lite)return sweep(b,[base,lerp3(base,tip,.26),p2],[r*.74,r*.9,r],n,M[0],{rot:o.rot,sq,bandV:(k,s)=>k?(s?M[2]:f0):null,tipRingM:M[2],tip:pt(tip,M[3])});
 return sweep(b,[base,p2],[r*.78,r],n,M[2],{rot:o.rot,sq,bandV:(k,s)=>s?M[2]:f0,tipRingM:M[2],tip:pt(tip,M[3])});}
// an 8-triangle gem (two pyramids) with its own tilt: flecks, glints, buds
function gem8(b,x,y,z,rx,ry,rz,m,rot=0,n=4,mTop){const R=[];for(let i=0;i<n;i++){const a=i/n*TAU+rot;R.push([x+Math.cos(a)*rx,y,z+Math.sin(a)*rz]);}return facets(b,[R],m,{apex:[x,y+ry,z],apexM:mTop||m,nadir:[x,y-ry,z]});}

// a smooth-shaded skin over a grid of rings G[r][i] = [x,y,z] closed around i (shells, domes): shared vertices, normals
// from the grid, facing away from o.c. m = material or (r,i) => material. 2n triangles per band.
function skin(b,G,m,o={}){const R=G.length,n=G[0].length,mf=typeof m==='function'?m:()=>m,c=o.c||[0,0,0],ids=[],I=b.cur.I;
 for(let r=0;r<R;r++){ids.push([]);for(let i=0;i<n;i++){const p=G[r][i],a=G[r][(i+1)%n],e=G[r][(i+n-1)%n],u=G[Math.min(R-1,r+1)][i],d=G[Math.max(0,r-1)][i];
   const tx=a[0]-e[0],ty=a[1]-e[1],tz=a[2]-e[2],sx=u[0]-d[0],sy=u[1]-d[1],sz=u[2]-d[2];let nx=ty*sz-tz*sy,ny=tz*sx-tx*sz,nz=tx*sy-ty*sx;
   if(Math.hypot(nx,ny,nz)<1e-9){nx=p[0]-c[0];ny=p[1]-c[1];nz=p[2]-c[2];}if(nx*(p[0]-c[0])+ny*(p[1]-c[1])+nz*(p[2]-c[2])<0){nx=-nx;ny=-ny;nz=-nz;}
   ids[r].push(b._v(p[0],p[1],p[2],nx,ny,nz,p[3]||mf(r,i)));}}
 for(let r=0;r<R-1;r++)for(let i=0;i<n;i++){const j=(i+1)%n,A=G[r][i],B=G[r][j],C=G[r+1][j],gx=(B[1]-A[1])*(C[2]-A[2])-(B[2]-A[2])*(C[1]-A[1]),gy=(B[2]-A[2])*(C[0]-A[0])-(B[0]-A[0])*(C[2]-A[2]),gz=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);
   const a=ids[r][i],bq=ids[r][j],cq=ids[r+1][j],d=ids[r+1][i];if(gx*(A[0]-c[0])+gy*(A[1]-c[1])+gz*(A[2]-c[2])>=0)I.push(a,bq,cq,a,cq,d);else I.push(a,cq,bq,a,d,cq);}
 return b;}
// a straight n-sided spike from p to tip (n triangles): thorns, twigs, claws
function spike(b,p,tip,r,m,n=3,rot=0){let dx=tip[0]-p[0],dy=tip[1]-p[1],dz=tip[2]-p[2];const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;let ux=Math.abs(dy)>.9?1:0,uy=Math.abs(dy)>.9?0:1,uz=0;const t=ux*dx+uy*dy+uz*dz;ux-=t*dx;uy-=t*dy;uz-=t*dz;const ul=Math.hypot(ux,uy,uz);ux/=ul;uy/=ul;uz/=ul;
 const vx=dy*uz-dz*uy,vy=dz*ux-dx*uz,vz=dx*uy-dy*ux,R=[];for(let i=0;i<n;i++){const a=i/n*TAU+rot,c=Math.cos(a)*r,s=Math.sin(a)*r;R.push([p[0]+ux*c+vx*s,p[1]+uy*c+vy*s,p[2]+uz*c+vz*s]);}return facets(b,[R],m,{apex:tip});}
const profR=(P,t)=>{if(t<=P[0][0])return P[0][1];for(let k=1;k<P.length;k++)if(t<=P[k][0])return P[k-1][1]+(P[k][1]-P[k-1][1])*(t-P[k-1][0])/(P[k][0]-P[k-1][0]);const L=P[P.length-1];return L[1]*(1-t)/(1-L[0]);};
// a cut boulder in one stone colour: lighter top facets, dark underside
const stone=(b,x,y,z,rx,ry,rz,sd,m,o={})=>blob(b,x,y,z,rx,ry,rz,Object.assign({n:6,prof:ROCK3,seed:sd,m:shade(m,b.k.tint(m,1.38,.01),b.k.tint(m,.66)),cuts:3,jit:.16,yaw:sd*1.3},o));

// Leaf masses (every bush and canopy here): a squashed dome whose vertices run from a dark skirt through the body colour to
// a sunlit crown, so a plant reads light-on-top / dark-underneath at any size. M = [dark, body, light, crown]; P = rings
// [height fraction, radius fraction, index into M]. triangles = 2n(rings - 1) + n (crown) + n (o.nadir: a dark underside)
const LOBE3=[[.03,.72,0],[.36,1,1],[.74,.68,2]],LOBE2=[[.05,.84,0],[.58,.8,2]],MOUND3=[[0,.88,0],[.38,1,1],[.76,.56,2]],MOUND2=[[0,.9,0],[.55,.76,2]];
const LEAF={olive:[0x2c3a16,0x64782e,0x9ca848,0xbcc05c],green:[0x1b2d14,0x3d5c28,0x6c8c3a,0x8ea64a],straw:[0x443e1e,0x868040,0xb4ac5e,0xccc67a]};
const leafSet=(b,H,j=.07)=>H.map(h=>b.k.mat(h,'leaf',0,j));
function lobe(b,x,y,z,rx,ry,rz,n,M,o={}){const P=o.prof||LOBE3,sd=o.seed||1,jit=o.jit??.14,yaw=o.yaw||0,lx=o.lx||0,lz=o.lz||0,R=[];
 P.forEach(([t,rr,mi],k)=>{const ring=[];for(let i=0;i<n;i++){const a=yaw+(i+(k%2)*.5+(hz(sd,k*31+i)-.5)*.3)/n*TAU,f=rr*(1-jit*hz(sd,k*57+i+100))*(o.zig&&i%2?1-o.zig:1),tt=t+(k?(hz(sd,k*91+i+200)-.5)*.08:0);
   ring.push([x+Math.cos(a)*f*rx+lx*tt,y+ry*tt,z+Math.sin(a)*f*rz+lz*tt,M[mi]]);}R.push(ring);});
 return facets(b,R,M[1],{stag:true,apex:[x+lx,y+ry,z+lz,M[3]||M[2]],nadir:o.nadir?[x,y+ry*.16,z,M[0]]:null,nadirIns:[x,y+ry,z]});}

// ------------------------------------------------------------------ rocks (unit shape) ---------------------------------
// Envelope |x| <= 1, |z| <= 1, -0.45 <= y <= 1; widest near the bottom, flat base. A cut boulder with two smaller boulders
// fused to it and chips at its foot. HIGH 118 / LOW 57 triangles.
function rock(b,o,mossy){const {pal,tint,mix}=b.k,N=pal.nat,hi=b.hi,sd=(o.seed|0)*13+(mossy?5:0),m=mossy?N.rockMoss:N.rock;
 const top=mossy?mix(tint(m,1.12),N.moss,hi?.3:.6):tint(m,1.42,.012),low=tint(m,.66),sh=shade(m,top,low),sh2=shade(tint(m,.9),tint(top,.94),low);
 blob(b,-.14,-.45,.02,.85,1.45,.9,{n:hi?7:6,prof:hi?ROCK4:ROCK3,seed:sd+1,m:sh,cuts:5,lx:.2,lz:-.08,ax:.1,az:-.1,jit:.14});
 blob(b,.57,-.45,.38,.41,1.02,.4,{n:hi?6:5,prof:hi?ROCK3:ROCK2,seed:sd+2,m:sh2,cuts:2,yaw:.6,jit:.16,lx:.02});
 blob(b,-.5,-.45,-.56,.44,.9,.4,{n:hi?5:4,prof:ROCK2,seed:sd+3,m:sh2,cuts:2,yaw:1.1,jit:.16});
 if(hi){blob(b,.7,-.45,-.56,.26,.62,.24,{n:4,prof:ROCK2,seed:sd+4,m:sh2,yaw:.3});blob(b,-.76,-.45,.58,.22,.56,.22,{n:4,prof:ROCK2,seed:sd+5,m:sh,yaw:.9});}}
WK.model('rock',(b,o)=>rock(b,o,false),{aoH:1.1,aoMin:.6});
WK.model('rock-moss',(b,o)=>rock(b,o,true),{aoH:1.1,aoMin:.6});

// ------------------------------------------------------------------ the barren Moon's growths (unit shapes) -------------
// crystal-growth: |x|,|z| <= 1, 0 <= y <= 1. Shards of varied lean on a dark root, dark teal foot to a glowing cyan tip.
// HIGH 145 / LOW 60.
WK.model('crystal-growth',(b,o)=>{const {mat,glow}=b.k,hi=b.hi,sd=o.seed|0,M=[mat(0x1a5a66,'metal',.2),mat(0x15505c,'flat'),glow(0x2ad0e8,.5),glow(0x9ff6ff,1)];
 const S=[[0,0,1,.07,-.04,.3,4],[.36,.1,.76,.3,.05,.23,4],[-.36,.2,.68,-.32,.12,.21,4],[.1,-.4,.6,.1,-.34,.2,4],[-.26,-.32,.5,-.3,-.3,.17,4],[.46,-.3,.42,.34,-.26,.15,4],[.02,.46,.38,-.04,.38,.14,3]];
 if(hi)blob(b,0,0,0,.72,.2,.66,{n:5,prof:[[0,1],[.6,.7]],seed:sd+3,m:mat(0x1c2a30,'rock',0),apex:false,jit:.2});
 S.slice(0,hi?7:5).forEach(([x,z,h,tx,tz,r,n],k)=>crystal(b,[x,.03+r*.6*Math.hypot(tx,tz)/h,z],[x+tx,h,z+tz],r,n,M,{rot:k*.9+.3,sq:.7+.2*hz(sd,k),sh:.74}));
},{aoH:1,aoMin:.7});
// fungus-growth: |x|,|z| <= .9, 0 <= y <= 1. Bulbous pods on stalks: dark body, violet-glowing gills under the bulb and a
// glowing crown. LOW: three pods, their caps still round (five sides). HIGH 146 / LOW 59.
WK.model('fungus-growth',(b,o)=>{const {mat,glow,tint}=b.k,hi=b.hi,body=mat(0x4a3d5c,'dirt',0,.12),stalk=mat(0x5a5068,'dirt',0,.1),gill=glow(0xa07bff,.7),spot=glow(0xc3a6ff,.7),f0=flatOf(tint(body,.9));
 const P=[[0,0,1,.06,.03,5],[.48,.2,.72,.2,.06,5],[-.44,.3,.62,-.2,.1,4],[.15,-.5,.66,.05,-.2,4],[-.35,-.4,.44,-.16,-.14,4]];
 (hi?P:[P[0],P[1],P[3]]).forEach(([x,z,s,tx,tz,n],k)=>{const R=.34*s,top=[x+tx,s,z+tz],at=t=>[x+tx*t*t,s*t+.025*(1-t),z+tz*t*t];
  if(!hi){const ring=(t,rr)=>{const c=at(t),A=[];for(let i=0;i<5;i++){const a=i/5*TAU+k;A.push([c[0]+Math.cos(a)*rr,c[1],c[2]+Math.sin(a)*rr]);}return A;};
   spike(b,at(0),at(.7),.1*s,stalk,3,k);
   if(k<2)facets(b,[ring(.56,R*1.06),ring(.84,R*.84)],body,{apex:pt(top,spot),apexRingM:gill,nadir:at(.44),nadirM:gill});
   else facets(b,[ring(.58,R*1.06)],flatOf(body),{apex:pt(top,spot),nadir:at(.44),nadirM:gill});}
  else if(k<4)sweep(b,[at(0),at(.52),at(.6),at(.84)],[.11*s,.08*s,R,R*.86],n,body,{rot:k,bandM:r=>r===0?stalk:r===1?gill:body,tipRingM:f0,tip:pt(top,spot)});
  else sweep(b,[at(0),at(.56),at(.84)],[.1*s,R,R*.86],4,body,{rot:k,bandM:r=>r?body:stalk,tipRingM:f0,tip:pt(top,spot)});});
},{aoH:1,aoMin:.7});

// ------------------------------------------------------------------ trees ----------------------------------------------
// one drooping conifer tier: a zigzag skirt blown downwind (+x), a dark underside. 4n triangles
function tier(b,cx,y,cz,r,ht,droop,n,sd,top,rimM,under,wind){const rim=[],mid=[];
 for(let i=0;i<n;i++){const a=(i+.4*(hz(sd,i)-.5))/n*TAU+sd*1.7,ca=Math.cos(a),sa=Math.sin(a),st=1+wind*ca,rr=r*st*(i%2?1:.62)*(1-.1*hz(sd,i+40));
  rim.push([cx+ca*rr+r*wind*.3,y-droop*(i%2?1:.3)*st,cz+sa*rr*.92,rimM]);mid.push([cx+ca*rr*.44+r*wind*.12,y+ht*.46,cz+sa*rr*.42]);}
 return facets(b,[rim,mid],top,{apex:[cx,y+ht,cz],nadir:[cx+r*wind*.2,y+ht*.12,cz],nadirM:under,nadirRingM:under,nadirIns:[cx,y+ht,cz]});}
const along=(P,y)=>{for(let k=1;k<P.length;k++)if(y<=P[k][1]||k===P.length-1){const t=(y-P[k-1][1])/(P[k][1]-P[k-1][1]);return lerp3(P[k-1],P[k],t);}};
// tree-conifer (4.6 x 7.6 x 4.6): a wind-bent frontier conifer. A leaning trunk, drooping tiers thrown downwind (+x), the
// leader snapped off and hanging. HIGH <= 300 / LOW <= 120.
WK.model('tree-conifer',(b,o)=>{const {pal,tint,mix}=b.k,N=pal.nat,hi=b.hi,sd=o.seed|0,s=Math.min(o.h/7.6,o.w/4.6,o.d/4.6);
 b.at(0,0,0,0,()=>{const T=[[-.42,-.1,0],[-.3,1.5,.02],[-.04,3.3,.06],[.36,5.2,.02],[.66,6.5,0]],rad=[.3,.24,.19,.13,.08],bark=N.bark,barkL=tint(bark,1.25);
  if(hi)sweep(b,T,rad,5,shade(bark,barkL,tint(bark,.8)));else sweep(b,[T[0],T[2],T[4]],[.3,.19,.08],4,bark);
  const tiers=hi?[[1.75,1.85,1.75,.75,10],[3.15,1.55,1.65,.62,8],[4.5,1.2,1.5,.5,8],[5.7,.82,1.3,.36,6]]:[[2,1.8,2.3,.7,6],[3.9,1.4,2.0,.55,6],[5.5,.9,1.6,.36,6]];
  tiers.forEach(([y,r,ht,dr,n],k)=>{const c=along(T,y+ht*.3),g=N.leaf[(k+sd)%3],top=tint(g,1.1),rim=mix(g,N.olive,.3),un=tint(g,.5);tier(b,c[0],y,c[2],r,ht,dr,n,sd*5+k,top,rim,un,.25);});
  // the snapped leader: a splinter left standing, the top hanging downwind
  sweep(b,[T[4],[.74,7.1,.02]],[.08,.05],3,bark,{tip:[.8,7.56,.04]});
  if(hi){sweep(b,[[.76,7.05,.02],[1.12,7.0,.1]],[.05,.04],3,bark,{tip:[1.5,6.6,.16]});
   // dead lower limbs and root flares
   for(const [y,a,l] of [[1.15,2.6,1.0],[1.5,4.3,.85],[.95,.5,.7]]){const p=along(T,y);sweep(b,[p,[p[0]+Math.cos(a)*l*.6,y+.12,p[2]+Math.sin(a)*l*.6]],[.07,.045],3,tint(bark,.8),{tip:[p[0]+Math.cos(a)*l,y-.08,p[2]+Math.sin(a)*l]});}
   for(const a of [.4,2.5,4.5]){const c=[-.42+Math.cos(a)*.24,.42,Math.sin(a)*.24],e=[-.42+Math.cos(a)*.62,-.08,Math.sin(a)*.62];leafTri(b,[c[0]-Math.sin(a)*.1,.1,c[2]+Math.cos(a)*.1],[c[0]+Math.sin(a)*.1,.1,c[2]-Math.cos(a)*.1],e,bark,null);T3(b,c,[c[0]-Math.sin(a)*.1,.1,c[2]+Math.cos(a)*.1],e,bark,[-.42,0,0]);T3(b,c,[c[0]+Math.sin(a)*.1,.1,c[2]-Math.cos(a)*.1],e,bark,[-.42,0,0]);}}
 },0,0,s);
},{aoH:5,aoMin:.6});
// tree-broadleaf (4.6 x 6.8 x 4.6): a gnarled broadleaf. A stout forked trunk under a wide canopy of squashed leaf lobes
// (olive, dark green, one dry straw) that fills the box, every lobe sunlit on top and dark underneath. HIGH <= 300 / LOW <= 120.
WK.model('tree-broadleaf',(b,o)=>{const {pal,tint}=b.k,N=pal.nat,hi=b.hi,sd=o.seed|0,s=Math.min(o.h/6.8,o.w/4.6,o.d/4.6),bark=shade(N.bark,tint(N.bark,1.5,.012),tint(N.bark,.75)),LS=[leafSet(b,LEAF.olive),leafSet(b,LEAF.green),leafSet(b,LEAF.straw)];
 b.at(0,0,0,0,()=>{const F=[.1,2.55,0];
  sweep(b,[[0,-.1,0],[-.14,1.25,.05],F],[.48,.36,.3],hi?6:4,bark);
  const br=[[[.7,3.15,.35],[1.15,3.8,.7],.2,.13],[[-.6,3.25,.15],[-1.15,3.95,.3],.19,.12],[[.18,3.3,-.6],[.25,3.9,-1.15],.15,.1],[[-.2,3.1,.6],[-.35,3.5,1.15],.14,.09]];
  br.slice(0,hi?4:2).forEach(([p1,p2,r1,r2],k)=>hi&&k<2?sweep(b,[F,p1,p2],[.24,r1,r2],4,bark):sweep(b,[F,p2],[.2,r2],3,bark));
  if(hi)for(const a of [.9,3.0,5.0]){const cx=Math.cos(a),sz=Math.sin(a),e=[cx*.95,-.08,sz*.95];T3(b,[cx*.3-sz*.15,.62,sz*.3+cx*.15],[cx*.3+sz*.15,.62,sz*.3-cx*.15],e,N.bark,[0,-.5,0]);T3(b,[cx*.3-sz*.18,-.05,sz*.3+cx*.18],[cx*.3-sz*.15,.62,sz*.3+cx*.15],e,N.bark,[cx*.4,0,sz*.4]);T3(b,[cx*.3+sz*.18,-.05,sz*.3-cx*.18],[cx*.3+sz*.15,.62,sz*.3-cx*.15],e,N.bark,[cx*.4,0,sz*.4]);}
  // the canopy [x, y, z, rx, ry, rz, colour, sides]: a big crown lobe over five that reach the edges of the box
  const C=[[.1,4.7,0,1.7,1.95,1.6,0,7],[1.2,3.35,.7,1.05,1.5,1.05,1,6],[-1.2,3.45,.5,1.05,1.45,1.05,2,6],[.3,3.4,-1.2,1.2,1.5,1.0,1,6],[-.2,3.0,1.3,1.0,1.3,.9,0,6],[-1.1,3.9,-.9,.95,1.35,.95,0,5]];
  C.slice(0,hi?6:4).forEach(([x,y,z,rx,ry,rz,c,n],k)=>lobe(b,x,y,z,rx,ry,rz,hi?n:k?5:6,LS[c===2?2:(c+sd)%2],{prof:hi?LOBE3:LOBE2,seed:sd*9+k+1,nadir:true,lx:.12,yaw:k*1.3}));
 },0,0,s);
},{aoH:4.5,aoMin:.6});
// tree-dead (3.8 x 7.2 x 3.8): a dead tree. Charcoal-grey bark, ash-pale on its upper faces and up one flank, the top snapped
// off in a pale splintered break, bare limbs, one of them a broken stub showing pale wood. HIGH <= 120 / LOW <= 60.
WK.model('tree-dead',(b,o)=>{const {mat,mix}=b.k,hi=b.hi,s=Math.min(o.h/7.2,o.w/3.8,o.d/3.8),bark=mat(0x62605d,'timber',.25,.1),ash=mat(0xbdb7ab,'timber',.1,.08),dk=mat(0x33302e,'timber',.35,.08),wood=mat(0xdccba0,'flat',0,.05),woodD=mat(0xb09868,'flat',0,.05),char=shade(bark,ash,dk);
 b.at(0,0,0,0,()=>{const T=[[0,-.1,0],[.12,1.6,.03],[-.08,3.4,-.04],[.14,5.0,.04],[.1,6.2,0]],vm=(k,i)=>{const t=k/(hi?4:2);return i<2?mix(bark,ash,.5+.5*t):mix(dk,bark,.3+.7*t);};
  // the trunk: paler up one flank and toward the top; the snapped top is a cap of pale wood with one splinter left standing
  sweep(b,hi?T:[T[0],T[2],T[4]],hi?[.5,.4,.33,.25,.2]:[.5,.33,.2],hi?5:4,bark,{vm,tip:[.14,6.56,.02,wood],tipRingM:woodD});
  spike(b,[.02,6.0,.08],[.3,7.15,.06,ash],.1,bark);
  const Lm=[[3.2,.4,1.7,1.0],[4.4,2.6,1.5,1.1],[5.3,4.4,1.2,.9],[2.4,5.5,1.4,.7],[5.9,1.3,.8,.7]];
  Lm.slice(0,hi?5:4).forEach(([y,a,l,up],k)=>{const p=along(T,y),ca=Math.cos(a),sa=Math.sin(a),md=[p[0]+ca*l*.55,y+up*.25,p[2]+sa*l*.55],end=[p[0]+ca*l,y+up,p[2]+sa*l,ash];
   if(k===3)sweep(b,[p,md],[.2,.15],3,char,{tip:[md[0]+ca*.1,md[1]+.06,md[2]+sa*.1,wood],tipRingM:woodD});          // the broken stub
   else if(hi&&k<3)sweep(b,[p,md,lerp3(md,end,.8)],[.2,.14,.08],3,char,{tip:end});else sweep(b,[p,md],[.18,.11],3,char,{tip:end});});
  if(hi)for(const a of [.6,2.7,4.7]){const cx=Math.cos(a),sz=Math.sin(a),e=[cx*.95,-.08,sz*.95];T3(b,[cx*.32-sz*.15,.6,sz*.32+cx*.15],[cx*.32+sz*.15,.6,sz*.32-cx*.15],e,bark,[0,-.5,0]);T3(b,[cx*.32-sz*.18,-.05,sz*.32+cx*.18],[cx*.32-sz*.15,.6,sz*.32+cx*.15],e,dk,[cx*.4,0,sz*.4]);T3(b,[cx*.32+sz*.18,-.05,sz*.32-cx*.18],[cx*.32+sz*.15,.6,sz*.32-cx*.15],e,dk,[cx*.4,0,sz*.4]);}
 },0,0,s);
},{aoH:4,aoMin:.7});
// tree-far (4.4 x 7.2 x 4.4): the distance stand-in for any tree: a trunk and two faceted canopy tiers. 56 triangles.
WK.model('tree-far',(b,o)=>{const {pal,tint,mix}=b.k,N=pal.nat,s=Math.min(o.h/7.2,o.w/4.4,o.d/4.4),g=N.leaf[1],g2=N.leaf[2];
 b.at(0,0,0,0,()=>{sweep(b,[[-.2,-.1,0],[.05,3.2,0]],[.3,.18],4,N.bark);
  tier(b,.05,2.0,0,1.75,3.0,.5,6,3,tint(g,1.1),mix(g,N.olive,.4),tint(g,.5),.2);tier(b,.3,4.2,0,1.3,2.95,.4,6,8,tint(g2,1.15),mix(g2,N.olive,.4),tint(g2,.5),.2);
 },0,0,s);
},{aoH:5,aoMin:.6});

// ------------------------------------------------------------------ frontier flora --------------------------------------
// a two-sided grass blade with its own gradient, M = [dark root, body, sunlit tip]: 6 triangles (lite: 4)
function blade(b,x,y,z,a,len,h,wd,M,lite){const ca=Math.cos(a),sa=Math.sin(a),px=-sa*wd/2,pz=ca*wd/2,a0=[x-px,y,z-pz,M[0]],a1=[x+px,y,z+pz,M[0]],
  m0=[x+ca*len*.42-px*.8,y+h*.6,z+sa*len*.42-pz*.8,M[1]],m1=[x+ca*len*.42+px*.8,y+h*.6,z+sa*len*.42+pz*.8,M[1]],t=[x+ca*len,y+h,z+sa*len,M[2]];
 if(lite){leafTri(b,a0,a1,m1,M[1]);leafTri(b,a0,m1,t,M[1]);}else{leafTri(b,a0,a1,m1,M[1]);leafTri(b,a0,m1,m0,M[1]);leafTri(b,m0,m1,t,M[1]);}}
// an arching fern frond, M = [dark crown, body, light, sunlit tip]: 8 triangles
function frond(b,x,y,z,a,len,h,wd,M){const ca=Math.cos(a),sa=Math.sin(a),px=-sa*wd/2,pz=ca*wd/2,at=(r,yy,w,m)=>[[x+ca*len*r-px*w,y+h*yy,z+sa*len*r-pz*w,m],[x+ca*len*r+px*w,y+h*yy,z+sa*len*r+pz*w,m]],
  p0=[x+ca*.05,y,z+sa*.05,M[0]],[b0,b1]=at(.36,.72,1,M[1]),[c0,c1]=at(.7,.96,.7,M[2]),t=[x+ca*len,y+h*.6,z+sa*len,M[3]];
 leafTri(b,p0,b0,b1,M[1]);leafTri(b,b0,b1,c1,M[1]);leafTri(b,b0,c1,c0,M[1]);leafTri(b,c0,c1,t,M[1]);}
// scrub (1.7 x 1 x 1.7): hardy scrub. Three squashed leaf lobes (olive, dark green, dry straw) leaning downwind, dark at the
// ground and sunlit on top, with dry thorn twigs. HIGH <= 100 / LOW <= 60.
WK.model('scrub',(b,o)=>{const {mat}=b.k,hi=b.hi,sd=o.seed|0,s=Math.min(o.w/1.7,o.h,o.d/1.7),stem=mat(0x6a5236,'timber',.3),LS=[leafSet(b,LEAF.olive),leafSet(b,LEAF.green),leafSet(b,LEAF.straw)];
 b.at(0,0,0,0,()=>{[[-.16,-.2,.64,.7,.58,1],[.3,.14,.52,.54,.48,0],[-.24,.36,.48,.44,.42,2]].forEach(([x,z,rx,ry,rz,c],k)=>lobe(b,x,-.03,z,rx,ry,rz,hi?6:5,LS[c===2?2:(c+sd)%2],{prof:hi?MOUND3:MOUND2,seed:sd*7+k+1,lx:.12,yaw:k*1.1+.3,zig:.14}));
  for(const [a,l,h] of hi?[[.3,.8,.97],[2.4,.78,.86],[4.4,.74,.92]]:[[.3,.8,.97],[4.4,.74,.92]]){const ca=Math.cos(a),sa=Math.sin(a);spike(b,[ca*.25,.3,sa*.25],[ca*l,h,sa*l],.045,stem);}
 },0,0,s);
},{aoH:.9,aoMin:.6});
// flower-patch (.9 x .5 x .9): a dark leaf mound carrying three big bright blooms (cream and sun yellow, no glow) tilted
// outward, and one leaf. 50 triangles.
WK.model('flower-patch',(b,o)=>{const {mat}=b.k,sd=o.seed|0,s=Math.min(o.w/.9,o.h/.5,o.d/.9),G=leafSet(b,[0x16280f,0x35562a,0x5e8038,0x7a9a44]),PET=[mat(0xfff4d8,'flat',0,.03),mat(0xffd23c,'flat',0,.03),mat(0xfff4d8,'flat',0,.03)],EYE=[mat(0xe07a1c,'flat'),mat(0x9a4a14,'flat'),mat(0xe07a1c,'flat')];
 b.at(0,0,0,0,()=>{lobe(b,0,-.02,0,.43,.27,.41,6,G,{prof:[[0,1,0],[.52,.72,1]],zig:.18,seed:sd+2,jit:.16});
  for(let k=0;k<3;k++){const a=k*TAU/3+.5+sd,x=Math.cos(a)*.2,z=Math.sin(a)*.2,y=.3+.04*((k+sd)%3),R=[];for(let i=0;i<5;i++){const q=i/5*TAU+k;R.push([x+Math.cos(q)*.15,y+.03-.05*Math.cos(q-a),z+Math.sin(q)*.15,PET[k]]);}
   facets(b,[R],PET[k],{apex:[x+Math.cos(a)*.03,y+.085,z+Math.sin(a)*.03,EYE[k]],nadir:[x*.7,y-.13,z*.7,G[1]]});}
  leafTri(b,[-.3,.03,-.16,G[1]],[-.16,.03,-.32,G[1]],[-.42,.2,-.4,G[3]],G[2]);
 },0,0,s);
},{aoH:.5,aoMin:.7});
// fern (2 x 1 x 2): broad arching fronds from one dark crown, lighter and yellower toward the tips. HIGH 48 / LOW 32.
WK.model('fern',(b,o)=>{const hi=b.hi,sd=o.seed|0,s=Math.min(o.w/2,o.d/2),n=hi?6:4,G=[leafSet(b,[0x14240d,0x3f6a26,0x74a036,0xb2c058],.1),leafSet(b,[0x14240d,0x4b7830,0x86aa3e,0xc0c862],.1)];
 for(let k=0;k<n;k++){const a=k/n*TAU+.3+.3*(hz(sd,k)-.5);frond(b,0,0,0,a,(.86+.14*hz(sd,k+9))*s,(.78+.2*hz(sd,k+20))*o.h,.52*s,G[k%2]);}
},{aoH:.9,aoMin:.62});
// crystal-sprout (.7 x 1.5 x .7): three thin teal crystal shards. 60 triangles.
WK.model('crystal-sprout',(b,o)=>{const {mat,glow}=b.k,sx=o.w/.7,sy=o.h/1.5,M=[mat(0x1c5c56,'metal',.2),mat(0x18544e,'flat'),glow(0x4fe0c8,.9),glow(0xb8fff0,.9)];
 for(let k=0;k<3;k++){const a=k*2.1+.4,h=(.9+.3*k)*sy,x=Math.cos(a)*.13*sx,z=Math.sin(a)*.13*sx;crystal(b,[x,.03,z],[x+Math.cos(a)*.05*sx*(3-k),h,z+Math.sin(a)*.05*sx*(3-k)],.1*sx,4,M,{rot:k,sh:.7,lite:!b.hi});}
},{aoH:1.5,aoMin:.75});
// moss-cushion (2 x .2 x 1.6): a low moss cushion with two smaller lumps: a dark rim on the ground, a bright yellow-green
// top (it has to read on olive ground from above). HIGH 40 / LOW 18.
WK.model('moss-cushion',(b,o)=>{const hi=b.hi,sd=o.seed|0,w=o.w/2,d=o.d/1.6,h=o.h,M=leafSet(b,[0x16240e,0x4c6a26,0x86a03c,0xa8b650]),M2=leafSet(b,[0x16240e,0x567030,0x94a442,0xb6bc5a]),P=[[0,1,0],[.6,.66,2]];
 lobe(b,-.08*w,-.02,0,.9*w,h+.02,.76*d,hi?8:6,M,{prof:P,seed:sd+1});
 if(hi){lobe(b,.62*w,-.02,.38*d,.34*w,h*.85,.32*d,4,M2,{prof:P,seed:sd+2});lobe(b,-.62*w,-.02,-.54*d,.28*w,h*.62,.22*d,4,M2,{prof:[[0,1,0]],seed:sd+3});}
},{aoH:.25,aoMin:.75});
// burnt-stump (.6 x 1.2 x .6): a charred stump, its top split in two prongs, one magenta blight vein. HIGH <= 80 / LOW <= 40.
WK.model('burnt-stump',(b,o)=>{const {pal,tint,mix,mat,glow}=b.k,N=pal.nat,hi=b.hi,r=Math.min(o.w,o.d)/.6,h=o.h/1.2,ash=mix(N.burnt,mat(0x6a645c,'timber',.9),.6),char=shade(tint(N.burnt,1.7,.01),ash,tint(N.burnt,1.2)),vein=glow(0xff2bd6,.9),n=hi?6:4;
 sweep(b,[[0,-.05,0],[0,.2*h,0],[.02*r,.72*h,0]],[.29*r,.2*r,.17*r],n,char,{tip:[.02*r,.6*h,0],tipM:tint(N.burnt,.7),apexIns:[0,2,0]});
 sweep(b,[[.07*r,.66*h,.03*r],[.13*r,.95*h,.04*r]],[.09*r,.05*r],3,char,{tip:[.2*r,1.18*h,.05*r]});
 if(hi){sweep(b,[[-.08*r,.66*h,-.04*r],[-.12*r,.82*h,-.05*r]],[.08*r,.045*r],3,char,{tip:[-.1*r,.98*h,-.08*r]});
  for(const a of [.5,2.6,4.6]){const ca=Math.cos(a),sa=Math.sin(a);T3(b,[ca*.2*r-sa*.07*r,0,sa*.2*r+ca*.07*r],[ca*.2*r+sa*.07*r,0,sa*.2*r-ca*.07*r],[ca*.17*r,.26*h,sa*.17*r],char,[0,.1,0]);}
  // the blight vein: a raised glowing seam up the +z flank
  const V=[[.04*r,.02,.255*r],[0,.22*h,.2*r],[.05*r,.48*h,.185*r],[.03*r,.7*h,.17*r]],wv=[.05*r,.04*r,.035*r,.012*r];
  for(let k=0;k<3;k++){const p=V[k],q=V[k+1];for(const sg of [-1,1])T3(b,[p[0]+sg*wv[k],p[1],p[2]-.03*r],[q[0]+sg*wv[k+1],q[1],q[2]-.03*r],[q[0],q[1],q[2]+.035*r],vein,[0,p[1],0]),T3(b,[p[0]+sg*wv[k],p[1],p[2]-.03*r],[p[0],p[1],p[2]+.035*r],[q[0],q[1],q[2]+.035*r],vein,[0,p[1],0]);}}
 else T3(b,[-.04*r,.04,.25*r],[.05*r,.04,.25*r],[.03*r,.66*h,.2*r],vein,[0,.3,0]);
},{aoH:1.1,aoMin:.7});
// grass-tuft (.7 x .8 x .7): a clump of seven broad blades of varied height (six on LOW): a dark root, olive / green / dry
// straw bodies, tips lighter and yellower. HIGH 48 / LOW 24.
WK.model('grass-tuft',(b,o)=>{const {mat}=b.k,hi=b.hi,sd=o.seed|0,r=Math.min(o.w,o.d)/.7,root0=mat(0x14220c,'leaf',0,.06),n=hi?7:6,
  G=[[0x4e7228,0xa8b44c],[0x66782e,0xcbc664],[0x8a8438,0xdfd27c]].map(([g,t])=>[root0,mat(g,'leaf',0,.08),mat(t,'leaf',0,.06)]);
 for(let k=0;k<n;k++){const a=k*TAU/n+.4+.5*(hz(sd,k)-.5);blade(b,Math.cos(a)*.06*r,0,Math.sin(a)*.06*r,a,(.17+.04*(k%3))*r,o.h*(k?.52+.12*((k*7)%5):1),.2*r,G[k%3],!hi);}
 if(hi)for(let k=0;k<3;k++){const a=k*TAU/3+1.3,g=G[(k+1)%3];leafTri(b,[Math.cos(a-.5)*.08*r,0,Math.sin(a-.5)*.08*r,g[0]],[Math.cos(a+.5)*.08*r,0,Math.sin(a+.5)*.08*r,g[0]],[Math.cos(a)*.33*r,o.h*.3,Math.sin(a)*.33*r,g[2]],g[1]);}
},{aoH:.7,aoMin:.62});
// bio-node (1.4 x 1.2 x 1.4): the harvestable bio-flora plant, READY: a low dark bush of three leaf lobes carrying five big
// glowing magenta-pink pods on stalks (the pods are the first thing you see). bio-node-dim (1.2 x 1.1 x 1.2): the same bush
// regrowing: bare stalks with empty husks, one dull bud. HIGH <= 200 / LOW <= 100.
function bioNode(b,o,hot){const {mat,glow}=b.k,hi=b.hi,sd=o.seed|0,r=Math.min(o.w,o.d)/1.4,h=o.h/1.2,stem=mat(0x5a4630,'timber',.3),husk=mat(0x7a6650,'leaf',0,.1),
  G=[leafSet(b,[0x12220d,0x2d4a20,0x52722d,0x6c8a38]),leafSet(b,[0x18260f,0x3c5222,0x667a30,0x828e3e])],POD=[glow(0xc8169a,1.7),glow(0xff3ec6,1.7),glow(0xffb4ee,1.7)],BUD=[mat(0x4a3040,'flat'),mat(0x8a5a78,'flat'),mat(0xb48aa4,'flat')];
 // a pod: a fat bulb, deep magenta underneath, hot at the tip (two rings on HIGH)
 const bulb=(x,y,z,R,ph,n,two,M,rot)=>{const ring=(yy,rr)=>{const A=[];for(let i=0;i<n;i++){const q=i/n*TAU+rot;A.push([x+Math.cos(q)*rr,y+ph*yy,z+Math.sin(q)*rr,M[1]]);}return A;};
   facets(b,two?[ring(.3,R),ring(.64,R*.72)]:[ring(.36,R)],M[1],{apex:[x,y+ph,z,M[2]],nadir:[x,y,z,M[0]]});};
 for(let k=0;k<3;k++){const a=k*TAU/3+.5;lobe(b,Math.cos(a)*.3*r,-.03,Math.sin(a)*.3*r,.4*r,(.5-.05*k)*h,.38*r,hi?6:5,G[k%2],{prof:MOUND2,seed:sd*5+k+1,yaw:k});}
 [[0,0,.74],[.7,.47,.56],[2.2,.47,.66],[3.9,.47,.52],[5.2,.46,.7]].forEach(([a,rr,y],k)=>{const px=Math.cos(a)*rr*r+(k?0:.03*r),pz=Math.sin(a)*rr*r*.95,py=y*h,sc=k?.86:1,R=.2*r*sc,ph=.46*h*sc,foot=[px*.5,(k?.3:.2)*h,pz*.5];
  if(hi)sweep(b,[foot,[px,py+.05*h,pz]],[.045*r,.032*r],3,stem);else spike(b,foot,[px,py+.12*h,pz],.05*r,stem);
  if(hot)bulb(px,py,pz,R,ph,hi?(k?5:6):4,hi,POD,k);
  else if(k===0)bulb(px,py,pz,R*.62,ph*.6,hi?5:4,hi,BUD,k);
  else if(hi)for(let i=0;i<3;i++){const q=i*TAU/3+k;T3(b,[px,py-.02*h,pz],[px+Math.cos(q)*.09*r,py+.13*h,pz+Math.sin(q)*.09*r],[px+Math.cos(q+1.2)*.09*r,py+.11*h,pz+Math.sin(q+1.2)*.09*r],husk,[px,py+1,pz]);}});
}
WK.model('bio-node',(b,o)=>bioNode(b,o,true),{aoH:1,aoMin:.62});
WK.model('bio-node-dim',(b,o)=>bioNode(b,o,false),{aoH:1,aoMin:.62});

// ------------------------------------------------------------------ the ice mine ---------------------------------------
// ice-block (2.4 x 3 x 2.4): a cut block of the ice mine: a tall sawn prism with a slanted top, a broken slab leaning on it
// and a chip; pale glass-surfaced ice with one faintly glowing core facet. 57 triangles.
function prism(b,x,z,r,h,n,rot,slant,taper,m,o={}){const R=[];for(const t of o.mid?[0,.5,1]:[0,1]){const ring=[];for(let i=0;i<n;i++){const a=rot+(i+.3*(hz(o.seed||1,i)-.5))/n*TAU,rr=r*(1-taper*t)*(t===.5?1.04:1);
   ring.push([x+Math.cos(a)*rr+(o.lx||0)*t,t===1?h*(1-slant*(.5+.5*Math.cos(a-rot-(o.sa||0)))):h*t-(t?0:.08),z+Math.sin(a)*rr*(o.rz||1)+(o.lz||0)*t]);}R.push(ring);}
 const c=cen(R[R.length-1]);return facets(b,R,m,{apex:[c[0],c[1]+.02,c[2]],apexM:o.topM});}
WK.model('ice-block',(b,o)=>{const {pal,tint,glow}=b.k,N=pal.nat,sd=o.seed|0,sx=o.w/2.4,sz=o.d/2.4,h=o.h/3,ice=b.k.mat(0x4f9ac4,'glass',.45,.1),core=glow(0x7fe6ff,.55),top=tint(ice,1.5,.04);let k=0;
 const m=ny=>(++k===3||k===4)?core:ny>.42?top:ny<-.2?tint(ice,.55):(k%2?ice:tint(ice,.8));
 prism(b,-.22*sx,-.12*sz,.86*Math.min(sx,sz),2.96*h,5,.3,.34,.2,m,{mid:true,seed:sd+1,lx:.12*sx,rz:.9,topM:top});
 prism(b,.66*sx,.42*sz,.48*Math.min(sx,sz),1.75*h,5,1.1,.3,.2,shade(tint(ice,.94),top,tint(ice,.7)),{seed:sd+2,lx:-.22*sx,lz:-.12*sz,topM:top,sa:2});
 prism(b,-.7*sx,.78*sz,.3*Math.min(sx,sz),.62*h,4,.5,.4,.25,shade(ice,top,tint(ice,.7)),{seed:sd+3,topM:top});
},{aoH:3,aoMin:.7});

// ------------------------------------------------------------------ mineral deposits ------------------------------------
const ORE={rust:[0x7a4a2c,'rock',0,.14],rustD:[0x5e3a26,'rock',0,.14],basalt:[0x25272f,'rock',0,.1],basaltL:[0x33363f,'rock',0,.1]};
const oreMat=(b,k)=>b.k.mat(...ORE[k]);
// flecks: n gems sitting half in the surface of a stone built with `stone(b,x,y,z,rx,ry,rz,...)` on profile P
function flecks(b,n,x,y,z,rx,ry,rz,P,m,sd,size,sides=4){for(let k=0;k<n;k++){const a=k*2.4+sd,t=.3+.42*hz(sd,k+70),f=profR(P,t)*.86;gem8(b,x+Math.cos(a)*rx*f,y+ry*t,z+Math.sin(a)*rz*f,size*(1+.4*hz(sd,k)),size*.8,size,m,a,sides);}}
// ore-fe (2.6 x 1.2 x 2.6): Ferrite Regolith, the common ore: rusty boulders with steel-grey flecks. HIGH <= 400.
WK.model('ore-fe',(b,o)=>{const {glow}=b.k,hi=b.hi,sd=o.seed|0,s=Math.min(o.w,o.d)/2.6,hy=o.h/1.2/s,rust=oreMat(b,'rust'),rustD=oreMat(b,'rustD'),steel=glow(0x9aa6b2,.3);
 b.at(0,0,0,0,()=>{stone(b,-.06,-.1,0,.9,1.28*hy,.86,sd+1,rust,{n:hi?8:6,prof:hi?ROCK4:ROCK3,lx:.1});flecks(b,hi?6:3,-.06,-.1,0,.9,1.28*hy,.86,hi?ROCK4:ROCK3,steel,sd+2,.14,hi?4:3);
  [[.72,.26,.52],[-.66,.46,.5],[.16,-.72,.46]].forEach(([x,z,r],k)=>{stone(b,x,-.08,z,r,r*1.3*hy,r*.92,sd+5+k,k%2?rust:rustD,{n:hi?6:5,prof:hi?ROCK3:ROCK2});if(hi)flecks(b,2,x,-.08,z,r,r*1.3*hy,r*.92,ROCK3,steel,sd+9+k,.1);});
  if(hi)[[-.56,-.78,.2],[.98,-.5,.18],[-.1,1.02,.2]].forEach(([x,z,r],k)=>stone(b,x,-.05,z,r,r*1.5,r,sd+20+k,rustD,{n:4,prof:ROCK2,cuts:0}));
 },0,0,s);
},{aoH:1.2,aoMin:.62});
// ore-il (2.4 x 1.9 x 2.4): Ilmenite: a black basalt base, dark faceted metal prisms with cut tops, small blue glints. HIGH <= 400.
WK.model('ore-il',(b,o)=>{const {mat,glow,tint}=b.k,hi=b.hi,sd=o.seed|0,s=Math.min(o.w,o.d)/2.4,hy=o.h/1.9/s,basalt=oreMat(b,'basalt'),pr=mat(0x2c2c36,'metal',.1),prTop=mat(0x555a6a,'metal',0),glint=glow(0x5f86b8,1.4);
 b.at(0,0,0,0,()=>{stone(b,0,-.1,0,1.12,.72,1.02,sd+1,basalt,{n:hi?8:6,prof:ROCK3});
  const n=hi?5:3;for(let k=0;k<n;k++){const a=k*TAU/n+.5,ca=Math.cos(a),sa=Math.sin(a),L=(1.2+.28*(k%2))*hy,le=.4,p=[ca*.42,.15,sa*.42],q=[ca*(.42+le*L),.15+L,sa*(.42+le*L)],r=.21-.02*(k%3);
   if(hi)sweep(b,[p,lerp3(p,q,.86),q],[r,r*.92,r*.6],6,shade(pr,prTop,tint(pr,.7)),{rot:k,tip:[q[0]+ca*.05,q[1]+.03,q[2]+sa*.05],tipM:prTop});else sweep(b,[p,q],[r,r*.8],4,pr,{rot:k,tip:[q[0],q[1]+.04,q[2]],tipM:prTop});
   gem8(b,q[0]+ca*.04,q[1]+.07,q[2]+sa*.04,.1,.12,.1,glint,k,hi?4:3);
   if(hi){const a2=a+.62,c2=Math.cos(a2),s2=Math.sin(a2),p2=[c2*.6,.1,s2*.6],q2=[c2*.86,.1+L*.46,s2*.86];sweep(b,[p2,q2],[.15,.12],5,shade(pr,prTop,tint(pr,.7)),{rot:k+1,tip:[q2[0],q2[1]+.03,q2[2]],tipM:prTop});}}
  if(hi)[[-.86,-.62,.26],[.9,.66,.24]].forEach(([x,z,r],k)=>stone(b,x,-.05,z,r,r*1.3,r,sd+20+k,oreMat(b,'basaltL'),{n:5,prof:ROCK2,cuts:0}));
 },0,0,s);
},{aoH:1.6,aoMin:.66});
// ore-ar (2.6 x 2.4 x 2.6): Armalcolite: bundles of grey-blue fibrous blades with cyan seams on a dark base. HIGH <= 500.
WK.model('ore-ar',(b,o)=>{const {mat,glow,tint}=b.k,hi=b.hi,sd=o.seed|0,s=Math.min(o.w,o.d)/2.6,hy=o.h/2.4/s,base=mat(0x343c4c,'rock',0,.1),fb=mat(0x5b6d84,'metal',.2,.12),fbL=mat(0x8296ae,'metal',.1,.1),seam=glow(0x22e6ff,1.3);
 b.at(0,0,0,0,()=>{stone(b,0,-.1,0,1.2,.86,1.1,sd+1,base,{n:hi?8:6,prof:ROCK3});
  const n=hi?6:4;for(let k=0;k<n;k++){const a=k*TAU/n+.3,ca=Math.cos(a),sa=Math.sin(a),L=(1.4+.36*(k%3))*hy,p=[ca*.5,.2,sa*.5],q=[ca*(.5+.3*L),.2+L,sa*(.5+.3*L)],m=shade(fb,fbL,tint(fb,.7));
   sweep(b,[p,lerp3(p,q,.72)],[.2,.17],4,m,{rot:a,sq:.5,tip:q,ref:[-sa,0,ca]});
   // the seam: a glowing sliver up the blade's outer face
   const o1=[ca*.16,0,sa*.16];sweep(b,[[p[0]+o1[0],p[1]+.2,p[2]+o1[2]],lerp3([p[0]+o1[0],p[1],p[2]+o1[2]],q,.74)],[.045,.03],3,seam,{tip:lerp3(p,q,.92)});
   if(hi)for(const [sg,f] of [[-1,.72],[1,.52]]){const off=[-sa*.2*sg,0,ca*.2*sg],p2=[p[0]+off[0],.15,p[2]+off[2]],q2=lerp3(p2,[q[0]+off[0]*1.6,q[1],q[2]+off[2]*1.6],f);sweep(b,[p2,lerp3(p2,q2,.7)],[.12,.1],3,m,{rot:k+sg,sq:.6,tip:q2,ref:[-sa,0,ca]});}}
  if(hi)[[-.9,-.7,.24],[.95,.62,.22],[.1,1.0,.2]].forEach(([x,z,r],k)=>stone(b,x,-.05,z,r,r*1.3,r,sd+20+k,base,{n:4,prof:ROCK2,cuts:0}));
 },0,0,s);
},{aoH:2,aoMin:.66});
// ore-tq (2.8 x 2.4 x 2.8): Tranquillityite: basalt with thin red-orange glowing needles. HIGH <= 500.
WK.model('ore-tq',(b,o)=>{const {glow}=b.k,hi=b.hi,sd=o.seed|0,s=Math.min(o.w,o.d)/2.8,hy=o.h/2.4/s,basalt=oreMat(b,'basalt'),nd=glow(0xff7a3d,1.5),ndD=glow(0xb8401a,1.5),ndT=glow(0xffb27a,1.5);
 b.at(0,0,0,0,()=>{stone(b,0,-.1,0,1.26,1.0,1.2,sd+1,basalt,{n:hi?8:6,prof:hi?ROCK4:ROCK3});
  if(hi)[[.86,.5,.48],[-.84,-.5,.46]].forEach(([x,z,r],k)=>stone(b,x,-.06,z,r,r*1.3,r*.9,sd+5+k,oreMat(b,k?'basaltL':'basalt'),{n:6,prof:ROCK3}));
  const n=hi?8:5;for(let k=0;k<n;k++){const a=k*TAU/n+.2,ca=Math.cos(a),sa=Math.sin(a),L=(1.45+.5*(k%2))*hy,le=.3+.1*(k%3),p=[ca*.36,.42,sa*.36],q=[ca*(.36+le*L),.42+L*.96,sa*(.36+le*L)];
   sweep(b,[p,lerp3(p,q,.62)],[.085,.075],hi?4:3,nd,{rot:k,bandV:(r,sd2)=>sd2?nd:ndD,tipRingM:nd,tip:pt(q,ndT)});
   if(hi){const a2=a+.4,p2=[Math.cos(a2)*.7,.28,Math.sin(a2)*.7];spike(b,p2,[Math.cos(a2)*1.0,.28+L*.42,Math.sin(a2)*1.0],.06,nd);}}
 },0,0,s);
},{aoH:1.4,aoMin:.66});
// ore-starter (4 x 4.8 x 4): the big starter vein: rusty boulders, a 4.2 m cyan marker rod, an amber gem on top. HIGH <= 500.
WK.model('ore-starter',(b,o)=>{const {pal,glow,mat}=b.k,hi=b.hi,sd=o.seed|0,s=Math.min(o.w,o.d)/4,hy=o.h/4.8,rust=oreMat(b,'rust'),rustD=oreMat(b,'rustD'),steel=glow(0x9aa6b2,.3),M=pal.mil;
 b.at(0,0,0,0,()=>{stone(b,0,-.12,0,1.3,1.6,1.24,sd+1,rust,{n:hi?8:6,prof:hi?ROCK4:ROCK3});flecks(b,hi?6:3,0,-.12,0,1.3,1.6,1.24,hi?ROCK4:ROCK3,steel,sd+2,.2,hi?4:3);
  [[1.04,.3,.86],[-1.0,.6,.82],[.3,-1.1,.72],[-.56,-.9,.62]].forEach(([x,z,r],k)=>{stone(b,x,-.08,z,r,r*1.2,r*.92,sd+5+k,k%2?rust:rustD,{n:hi?6:5,prof:hi?ROCK3:ROCK2});if(hi)flecks(b,2,x,-.08,z,r,r*1.2,r*.92,ROCK3,steel,sd+9+k,.13);});
 },0,0,s);
 // the survey marker: a clamped rod of cyan light and the amber gem that says "start here"
 b.cyl(0,1.0*s,0,.24*s,.5*s,M.hull2,{n:6,bev:.04});b.cyl(0,1.4*s,0,.1,4.2*hy-1.4*s,M.cyan,{n:6,top:false});
 if(hi){b.cyl(0,2.4*hy,0,.16,.14,M.trim,{n:6});b.cyl(0,3.3*hy,0,.16,.14,M.trim,{n:6});}
 b.cyl(0,4.2*hy-.1,0,.2,.14,M.gold,{n:6});gem8(b,0,4.42*hy,0,.34,.34*hy,.34,glow(0xf08a24,1.8),.4,hi?6:4,glow(0xffb866,1.8));
},{aoH:2.4,aoMin:.62});
// ore-spent (1.8 x .4 x 1.6): a low depleted rubble mound. <= 100.
WK.model('ore-spent',(b,o)=>{const {mat}=b.k,hi=b.hi,sd=o.seed|0,w=o.w/1.8,d=o.d/1.6,h=o.h/.4,dull=mat(0x33353d,'rock',0,.12),dullL=mat(0x40424a,'rock',0,.12);
 stone(b,-.05*w,-.06,0,.78*w,.4*h,.7*d,sd+1,dull,{n:hi?7:6,prof:ROCK2,cuts:2});
 [[.6,.4,.22],[-.62,-.42,.2],[.5,-.5,.18],[-.5,.52,.17],[.1,.66,.14]].slice(0,hi?5:3).forEach(([x,z,r],k)=>stone(b,x*w,-.04,z*d,r*w,Math.min(r*1.5,.38)*h,r*d,sd+3+k,k%2?dullL:dull,{n:4,prof:ROCK2,cuts:0}));
},{aoH:.5,aoMin:.7});
// meteor (10 x 18 x 3.4): a falling fireball. The glowing head at the origin (r 1.6), a flame and a trail of shrinking,
// cooling chunks rising toward (-8.4, +15.6, 0). <= 200.
WK.model('meteor',(b,o)=>{const {glow}=b.k,sd=o.seed|0,hot=glow(0xffe6b8,2),head=glow(0xffb070,2),mid=glow(0xff7a3d,1.8),dim=glow(0xd9481c,1.5),ux=-.4741,uy=.8805;
 blob(b,0,-1.6,0,1.6,3.2,1.6,{n:7,prof:CROWN3,seed:sd+1,m:ny=>ny<-.15?hot:ny>.5?mid:head,nadir:true,nadirM:hot,jit:.1,cuts:2});
 sweep(b,[[ux*.7,uy*.7,0],[ux*2.3,uy*2.3,0],[ux*3.8,uy*3.8,0]],[1.3,.95,.5],5,mid,{bandV:(r,s2)=>r+s2===0?mid:dim,tip:pt([ux*5.6,uy*5.6,0],dim)});
 for(let k=1;k<=6;k++){const r=1.2-.15*k,x=-1.4*k,y=2.6*k,c=glow(k<3?0xff8a48:k<5?0xff7a3d:0xd9481c,2-.2*k),z=(k%2?.25:-.3)*(k>1?1:0);
  if(k<=3)blob(b,x,y-r,z,r,2*r,r,{n:5,prof:CROWN2,seed:sd+k*3,m:c,nadir:true,jit:.2,yaw:k});else gem8(b,x,y,z,r,r,r,c,k,4);
  gem8(b,x+(k%2?1.15:.2),y-1.3+(k%3)*.5,(k%2?-.9:.95),.2,.26,.2,glow(0xffa860,1.6),k,3);}
},{aoH:1,aoMin:1});
// strike-crater (17.4 x 2.2 x 17.4): what a Meteor Strike leaves: a jagged molten ring (radius 7 at y .3), basalt rim rocks
// thrown out to radius 7.5 with their inner faces still glowing, a blue-white core gem in a cradle of shards. HIGH <= 1300 / LOW <= 900.
WK.model('strike-crater',(b,o)=>{const {glow,tint}=b.k,hi=b.hi,sd=o.seed|0,s=Math.min(o.w,o.d)/17.4,basalt=oreMat(b,'basalt'),basaltL=oreMat(b,'basaltL'),ring=glow(0xff7a3d,1.5),ringHot=glow(0xffb070,1.5),ringD=glow(0xc04a1a,1.5),ember=glow(0xa03a16,.45),core=glow(0xa8e4ff,2),coreHot=glow(0xe6f6ff,2);
 b.at(0,0,0,0,()=>{
  // the molten ring: a jagged ridge, hottest on its crest
  const N=hi?24:12,A=[],C=[],D=[];for(let i=0;i<N;i++){const a=i/N*TAU,ca=Math.cos(a),sa=Math.sin(a),j=hz(sd,i),j2=hz(sd,i+50);A.push([ca*(6.5-.2*j),.0,sa*(6.5-.2*j),ringD]);C.push([ca*(7+.25*(j2-.5)),.3+.16*(i%2?j:-j*.5),sa*(7+.25*(j2-.5)),ringHot]);D.push([ca*(7.45+.2*j),.0,sa*(7.45+.2*j),ringD]);}
  facets(b,[A.concat([]),C],ring,{});facets(b,[C,D],ring,{});
  // rim rocks thrown outward, the faces toward the strike still hot
  const n=hi?10:6;for(let k=0;k<n;k++){const a=k/n*TAU+.15,ca=Math.cos(a),sa=Math.sin(a),r=1.18-.26*hz(sd,k+5),x=ca*7.5,z=sa*7.5,m=k%3?basalt:basaltL,top=tint(m,1.4,.01),low=tint(m,.66);
   blob(b,x,-.3,z,r,r*(1.35+.5*hz(sd,k+9)),r*.86,{n:hi?8:6,prof:hi?ROCK4:ROCK3,seed:sd+30+k,cuts:3,jit:.16,yaw:a,lx:ca*.3,lz:sa*.3,m:(ny,p,q,t)=>{const fx=(p[0]+q[0]+t[0])/3-x,fz=(p[2]+q[2]+t[2])/3-z;return -(fx*ca+fz*sa)>r*.34&&ny<.5?ember:ny>.42?top:ny<-.18?low:m;}});
   if(hi){const a2=a+TAU/n/2,r2=.42+.2*hz(sd,k+70);stone(b,Math.cos(a2)*(7.9+.5*hz(sd,k+80)),-.1,Math.sin(a2)*(7.9+.5*hz(sd,k+80)),r2,r2*1.3,r2,sd+50+k,basaltL,{n:5,prof:ROCK2,cuts:0});}}
  // glowing cracks run from the core to the ring
  for(let k=0;k<(hi?8:5);k++){const a=k/(hi?8:5)*TAU+.4,ca=Math.cos(a),sa=Math.sin(a),a1=a+.12*(hz(sd,k+90)-.5),p=[ca*1.6,.02,sa*1.6],e=[Math.cos(a1)*6.2,.02,Math.sin(a1)*6.2],md=[Math.cos(a+.06)*3.8,.2,Math.sin(a+.06)*3.8,ring];
   T3(b,[p[0]-sa*.22,.02,p[2]+ca*.22],md,pt(e,ringD),ringD,[p[0],-2,p[2]]);T3(b,[p[0]+sa*.22,.02,p[2]-ca*.22],md,pt(e,ringD),ringD,[p[0],-2,p[2]]);}
  // the core: a blue-white gem in a cradle of thrown shards
  const R1=[],R2=[];for(let i=0;i<6;i++){const a=i/6*TAU;R1.push([Math.cos(a)*.7*(i%2?1:.86),1.05,Math.sin(a)*.7*(i%2?1:.86)]);R2.push([Math.cos(a+.5)*.42,1.6,Math.sin(a+.5)*.42,coreHot]);}
  if(hi)facets(b,[R1,R2],core,{apex:pt([.04,2.02,0],coreHot),nadir:[0,.22,0]});else facets(b,[R1],core,{apex:pt([.04,2.02,0],coreHot),nadir:[0,.22,0]});
  for(let k=0;k<(hi?5:3);k++){const a=k/(hi?5:3)*TAU+.3,ca=Math.cos(a),sa=Math.sin(a);sweep(b,[[ca*1.25,-.1,sa*1.25],[ca*1.0,.5,sa*1.0]],[.4,.26],4,shade(basaltL,tint(basaltL,1.4),basalt),{rot:k,tip:[ca*.95,1.0+.2*(k%2),sa*.95]});}
  if(hi)for(let k=0;k<6;k++){const a=k*1.05+.7,rr=3+2.2*hz(sd,k+110);stone(b,Math.cos(a)*rr,-.06,Math.sin(a)*rr,.3,.36,.28,sd+120+k,basalt,{n:4,prof:ROCK2,cuts:0,m:ny=>ny>.3?ember:basalt});}
 },0,0,s);
},{aoH:1.6,aoMin:.7});

// ------------------------------------------------------------------ wildlife --------------------------------------------
// bird (2.2 x .4 x .6): a small dark bird gliding toward +z, wings along +-x in two segments. 28 triangles.
WK.model('bird',(b,o)=>{const {mat,tint}=b.k,w=o.w/2.2,d=o.d/.6,body=mat(0x2a2a30,'flat'),wing=mat(0x3a3a44,'flat'),tipM=mat(0x1c1c22,'flat'),R=[];
 for(let i=0;i<4;i++){const a=i/4*TAU+Math.PI/4;R.push([Math.cos(a)*.12*w,Math.sin(a)*.085,.04*d]);}
 facets(b,[R],body,{apex:[0,.03,.2*d],nadir:[0,.0,-.14*d]});gem8(b,0,.05,.22*d,.06*w,.055,.07*d,tint(body,1.3),.4,3);
 leafTri(b,[0,.02,-.1*d],[-.11*w,.03,-.3*d],[.11*w,.03,-.3*d],body);
 for(const sg of [-1,1]){const rf=[sg*.08*w,.04,.13*d],rb=[sg*.08*w,.04,-.08*d],ef=[sg*.56*w,.19,.1*d],eb=[sg*.56*w,.19,-.13*d],tp=[sg*1.1*w,.07,-.2*d,tipM];leafTri(b,rf,rb,eb,wing);leafTri(b,rf,eb,ef,wing);leafTri(b,ef,eb,tp,wing);}
},{aoH:.01,aoMin:1});
// hopper (.6 x .7 x .7): a small hopping creature facing +z, its tail light held up behind (-z). <= 60.
WK.model('hopper',(b,o)=>{const {mat,tint,glow}=b.k,sd=o.seed|0,w=o.w/.6,h=o.h/.7,d=o.d/.7,fur=mat(0x8a7a5a,'flat',0,.1),furD=tint(fur,.7),lamp=glow(0x7dff8a,.9);
 blob(b,0,.1*h,-.02*d,.2*w,.34*h,.25*d,{n:5,prof:CROWN2,seed:sd+1,m:shade(fur,tint(fur,1.2),furD),nadir:true,jit:.12});
 gem8(b,0,.42*h,.2*d,.1*w,.09*h,.11*d,tint(fur,1.1),.4,4);
 for(const sg of [-1,1]){spike(b,[sg*.05*w,.47*h,.17*d],[sg*.1*w,.68*h,.08*d],.035*w,furD);spike(b,[sg*.15*w,.26*h,-.06*d],[sg*.19*w,0,.12*d],.07*w,furD);}
 spike(b,[0,.3*h,-.2*d],[0,.6*h,-.28*d],.04*w,furD);gem8(b,0,.61*h,-.28*d,.06*w,.07*h,.06*d,lamp,.3,4);
},{aoH:.6,aoMin:.7});

// ------------------------------------------------------------------ PARASITE --------------------------------------------
// a curved horn / claw / root along base -> control -> tip; o.glow lights the tip (o.ringM = the flat colour it fades from)
function horn(b,p0,p1,p2,r,n,m,o={}){const segs=Math.max(2,o.segs||(b.hi?3:2)),pts=[],rad=[];for(let k=0;k<segs;k++){const t=k/segs,u=1-t;pts.push([u*u*p0[0]+2*u*t*p1[0]+t*t*p2[0],u*u*p0[1]+2*u*t*p1[1]+t*t*p2[1],u*u*p0[2]+2*u*t*p1[2]+t*t*p2[2]]);rad.push(r*(1-t*(o.taper??.7)));}
 return sweep(b,pts,rad,n,m,{rot:o.rot,sq:o.sq,ref:o.ref,tip:o.glow?pt(p2,o.glow):p2,tipRingM:o.glow?o.ringM:null});}
const sgnPow=(v,e)=>Math.sign(v)*Math.pow(Math.abs(v),e);
// hive (22 x 13.6 x 16; all art inside |x| <= 11, |z| <= 8): the Parasite hive on a captured installation. A swollen chitin
// dome of eight lobes on a spreading root mat; a glowing vein in every groove from foot to crown, two ring veins, bone ribs
// on the lobes ending in horns, the pulsing eye low on the -x end inside a collar of fangs, a horned maw on the crown,
// egg-sacs and vents, root spikes at the box corners. o.sink (default .6) = how far the root mat runs below y = 0.
// HIGH <= 7000 / LOW <= 2500.
WK.model('hive',(b,o)=>{const {pal,tint,glow}=b.k,P=pal.par,hi=b.hi,sd=o.seed|0,W=o.w/22,D=o.d/16,H=o.h/13.6,U=Math.min(W,D,H),ax=9*W,az=6*D,ay=12.4*H,sink=o.sink??.6,
  NA=hi?48:24,NR=hi?12:6,per=NA/8,PH0=Math.PI/8,Q=Math.PI/4,chit=b.k.mat(0x2f1836,'chitin',.1),dark=b.k.mat(0x170b1c,'chitin',.05),bone=tint(P.bone,1.6,.02),boneM=shade(bone,tint(P.bone,2.1,.03),tint(P.bone,1.0)),boneF=flatOf(bone),darkF=flatOf(dark),vein=P.mag,ringV=glow(0xff2bd6,1.5);
 const swell=k=>1+.11*(hz(sd,((k%8)+8)%8+300)-.5)*2;
 // a point of the lobed shell: ph = azimuth, t = 0 foot .. 1 crown, k = how far proud of the shell
 const shell=(ph,t,k=1)=>{const th=t*Math.PI/2*.965,q=(ph-PH0)/Q,li=Math.floor(q),u=q-li,dd=Math.min(u,1-u)*2,sA=swell(li),sB=swell(u<.5?li-1:li+1),s=sA+(sB-sA)*.5*(1-dd),
   f=(1-.11*(1-Math.pow(dd,.55))*(1-t*t*t)+.025*dd)*s,rad=Math.pow(Math.cos(th),.8)*(1-.1*Math.pow(1-t,5))*f*k;return [Math.cos(ph)*ax*rad+.5*W*t*t,ay*Math.sin(th),Math.sin(ph)*az*rad];};
 const out=p=>{const x=p[0]/(ax*ax),y=p[1]/(ay*ay)*.6,z=p[2]/(az*az),l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];},add=(p,n,k,up=0)=>[p[0]+n[0]*k,p[1]+n[1]*k+up,p[2]+n[2]*k];
 // ---- the root mat: a lobed skirt that fills the footprint, lapping up the shell ----
 {const A=[],B=[],C=[];for(let i=0;i<NA;i++){const a=PH0+i/NA*TAU,ca=Math.cos(a),sa=Math.sin(a),lobe=1-.1*(.5+.5*Math.cos(i/NA*TAU*12+1)),ex=sgnPow(ca,.5),ez=sgnPow(sa,.5);
   A.push([ex*10.75*W*lobe,-sink,ez*7.75*D*lobe]);B.push([ex*9.9*W*(lobe*.5+.5)*(.95+.05*hz(sd,i)),.3*H+.3*hz(sd,i+60),ez*7.0*D*(lobe*.5+.5)*(.95+.05*hz(sd,i))]);C.push(shell(a,.06,1.05));}
  facets(b,[A,B,C],shade(dark,tint(chit,.9),dark));}
 // ---- the shell ----
 const G=[];for(let r=0;r<=NR;r++){const ring=[];for(let i=0;i<NA;i++)ring.push(shell(PH0+i/NA*TAU,r/NR));G.push(ring);}
 skin(b,G,(r,i)=>i%per===0?dark:(i%per===per/2&&hi?tint(chit,1.22):chit),{c:[0,ay*.3,0]});
 // ---- a glowing vein in every groove, foot to crown; two ring veins ----
 for(let k=0;k<8;k++){const ph=PH0+k*Q,n=hi?11:6,pts=[];for(let j=0;j<n;j++)pts.push(shell(ph,.03+.92*j/(n-1),1.012));sweep(b,pts,t=>(.21-.09*t)*U,3,vein,{ref:[-Math.sin(ph),0,Math.cos(ph)],rot:Math.PI/2});}
 for(const f of [.25,.55]){const t=Math.asin(f)/(Math.PI/2*.965),pts=[];for(let i=0;i<NA;i++)pts.push(shell(PH0+i/NA*TAU,t,1.014));sweep(b,pts,.115*U,3,ringV,{closed:true,ref:[0,1,0],rot:Math.PI/6});}
 // ---- bone ribs up the lobes, each ending in a horn (the eye's lobe has none) ----
 [.78,.6,.7,.52,0,.56,.72,.62].forEach((te,k)=>{if(!te)return;const ph=k*Q,n=hi?7:3,pts=[];for(let j=0;j<n;j++)pts.push(shell(ph,.02+(te-.02)*j/(n-1),1.03));const e=shell(ph,te+.05,1.1);pts.push(e);
  const nrm=out(e),tip=add(shell(ph,te+.1,1.2),nrm,(1.5+.5*(k%3))*U,(1.1+.3*(k%2))*U);tip[1]=Math.min(tip[1],o.h-.1);sweep(b,pts,t=>(.5-.2*t)*U,4,boneM,{ref:[-Math.sin(ph),0,Math.cos(ph)],sq:.62,tip:pt(tip,P.magDim),tipRingM:boneF});});
 // ---- the eye: a pulsing core low on the -x end, a slit pupil, a lumpy collar and a ring of fangs ----
 {const ex=-8.1*W,ey=4.4*H,re=2.1*U,cx=ex+.4*W,rc=2.65*U;b.ball(ex,ey,0,re,P.magHot,!hi);gem8(b,ex-re*.86,ey,0,.5*U,1.6*U,.44*U,darkF,0,4);
  const N=hi?14:8,pts=[];for(let k=0;k<N;k++){const q=k/N*TAU;pts.push([cx+.75*W*Math.sin(q)*Math.sin(q),ey+Math.cos(q)*rc,Math.sin(q)*rc]);}
  sweep(b,pts,(t,k)=>(.52+.14*(k%2))*U,hi?5:4,boneM,{closed:true,ref:[1,0,0]});
  const nf=hi?9:5;for(let k=0;k<nf;k++){const q=k/nf*TAU+.35,c=Math.cos(q),sn=Math.sin(q),bx=cx+.75*W*sn*sn;horn(b,[bx-.2,ey+c*rc,sn*rc],[bx-1.9*U,ey+c*rc*1.22,sn*rc*1.22],[bx-2.55*U,ey+c*rc*.62,sn*rc*.62],.44*U,4,k%3?dark:boneM,{segs:hi?3:2,glow:P.magDim,ringM:k%3?darkF:boneF});}
  if(hi){b.halo(ex-1.2,ey,0,6*U,0xff2bd6,.28);b.pool(ex-2.6,.15,0,3.5,3.5,0xff2bd6,.09);}}
 // ---- the crown: a glowing maw ringed by lips and horns ----
 {const top=G[NR],tc=cen(top),lip=[],pit=[];for(let i=0;i<12;i++){const p=top[Math.round(i*NA/12)%NA];lip.push([tc[0]+(p[0]-tc[0])*1.45,tc[1]+.12*H,tc[2]+(p[2]-tc[2])*1.75]);pit.push([tc[0]+(p[0]-tc[0])*1.2,tc[1]+.2*H,tc[2]+(p[2]-tc[2])*1.4]);}
  sweep(b,lip,.34*U,hi?4:3,boneM,{closed:true,ref:[0,1,0]});facets(b,[pit],vein,{apex:pt([tc[0],tc[1]-.35*H,tc[2]],P.magHot),apexIns:[tc[0],tc[1]+9,tc[2]]});
  for(let k=0;k<5;k++){const a=k*TAU/5+.5,p0=shell(a,.86,1),nrm=out(p0),p1=add(p0,nrm,1.7*U,.1*H),tip=[tc[0]+Math.cos(a)*1.1*W,Math.min(o.h-.08,ay+(1.0+.12*(k%2))*H),tc[2]+Math.sin(a)*.9*D];
   horn(b,p0,p1,tip,.4*U,4,boneM,{segs:hi?4:2,glow:P.magDim,ringM:boneF});}
  if(hi)b.halo(tc[0],tc[1]+.4,tc[2],3*U,0xff2bd6,.2);}
 // ---- roots run from the shell to the footprint's edge and turn up into spikes ----
 [[-9.7,-6.5,2.2],[9.5,-6.6,2.6],[-9.6,6.5,2.4],[9.7,6.3,2],[.3,-7.3,1.6],[-3.4,7.3,1.8],[4.4,7.25,1.5],[-10.2,3.1,1.7],[-10.2,-3.0,1.5],[10.3,-.6,1.9],[-5.6,-7.2,1.3],[6.6,-7.1,1.2]].slice(0,hi?12:10).forEach(([sx,sz,hh],k)=>{
  const X=sx*W,Z=sz*D,a=Math.atan2(sz/az,sx/ax),f=shell(a,.13,1.0),g=[X*.9,-.15,Z*.9];
  horn(b,f,[(f[0]+g[0])/2,.95*H,(f[2]+g[2])/2],g,.56*U,4,shade(dark,tint(chit,.95),dark),{segs:hi?4:2,taper:.5});
  horn(b,[X*.88,-.25,Z*.88],[X*1.02,hh*H*.45,Z*1.02],[X*.97,hh*H,Z*.97],.46*U,hi?4:3,dark,{segs:hi?3:2,glow:P.magDim,ringM:darkF});});
 // ---- egg-sacs between the roots, vents on the upper shell (HIGH) ----
 if(hi){const eg=[glow(0x8a2a86,.35),glow(0xff5fd2,.55),glow(0xffa0ee,.6)];
  [[8.3,2.9],[2.2,-6.5],[-6.8,5.6]].forEach(([cx,cz],c)=>{for(let k=0;k<4;k++){const a=k*1.7+c,r=k?.85:0,s=(k?.62:.85)*U;blob(b,cx*W+Math.cos(a)*r,-.1,cz*D+Math.sin(a)*r,s*.72,s*1.7,s*.72,{n:6,prof:[[.12,.8],[.55,.95]],seed:sd+c*9+k,m:eg[1],vm:r2=>eg[r2],apexV:eg[2],jit:.08,lx:Math.cos(a)*.15,lz:Math.sin(a)*.15});}
   spike(b,[cx*W+1.1,-.1,cz*D+.4],[cx*W+1.5,1.5*H,cz*D+.7],.2*U,dark,3);spike(b,[cx*W-.9,-.1,cz*D-.8],[cx*W-1.3,1.2*H,cz*D-1.2],.18*U,dark,3);});
  // swellings on the upper shell, each with a glowing vent
  [[.62,.52,2.5],[-.85,.66,1.8],[2.25,.74,1.5],[-2.1,.4,1.9]].forEach(([ph,t,r],k)=>{const p=shell(ph,t,1),nrm=out(p),c=add(p,nrm,-r*.42*U),e=add(c,nrm,r*1.22*U,.1*U);b.ball(c[0],c[1],c[2],r*U,k%2?chit:tint(chit,1.15));
   sweep(b,[add(c,nrm,r*.82*U),e],[r*.42*U,r*.3*U],6,shade(dark,tint(chit,1.2),dark),{rot:k,tip:pt(add(c,nrm,r*.9*U),vein),tipRingM:P.magDim,tipIns:add(p,nrm,9)});});}
},{aoH:8,aoMin:.5});

// hive-mast (4.2 x 20.4 x 4.2, all inside r 2.2): the hive's spire. A twisted chitin column of thin shanks between four
// swollen knuckles (each ringed with thorns), its six edges three glowing veins and three thick bone ribs, three claw
// buttresses gripping its foot, and the glowing orb at 18.8 m in a flared cup, caged by five big claws of unequal height.
// o.sink (default 1) = how far the foot runs below y = 0. HIGH <= 1500 / LOW <= 500.
WK.model('hive-mast',(b,o)=>{const {pal,tint,mat}=b.k,P=pal.par,hi=b.hi,rs=Math.min(o.w,o.d)/4.2,H=o.h/20.4,sink=o.sink??1,top=17.5*H,dark=P.chitinD,bone=tint(P.bone,2.0,.03),boneM=shade(bone,tint(P.bone,2.7,.04),tint(P.bone,1.2)),boneF=flatOf(bone),
  ch=mat(0x2f1836,'chitin',.1),chL=mat(0x54305f,'chitin',.1),chD=tint(ch,.7);
 // the column's stations [t, radius, 1 = a knuckle's swollen edge]: a root flare, then shanks and knuckles, thinner upward
 const ST=hi?[[0,1.7],[.07,1.42],[.15,1.05],[.2,1.5,1],[.26,1.55,1],[.31,1.0],[.39,.95],[.435,1.38,1],[.485,1.42,1],[.525,.9],[.6,.84],[.64,1.26,1],[.68,1.28,1],[.715,.8],[.79,.74],[.825,1.12,1],[.865,1.14,1],[.895,.7],[1,.72]]
  :[[0,1.7],[.12,1.05],[.23,1.52,1],[.32,.98],[.46,1.4,1],[.54,.88],[.66,1.27,1],[.73,.78],[.845,1.13,1],[.9,.7],[1,.72]],NS=ST.length;
 const axis=t=>{const e=Math.sin(Math.PI*t);return [.14*rs*Math.sin(t*5.2)*e,-sink+(top+sink)*t,.12*rs*Math.sin(t*4.1+1)*e];};
 const E=(k,i,f=1,up=0)=>{const t=ST[k][0],c=axis(t),a=4.2*t+i*TAU/6,r=ST[k][1]*rs*f;return [c[0]+Math.cos(a)*r,c[1]+up,c[2]+Math.sin(a)*r];};
 const R=[];for(let k=0;k<NS;k++){const g=[];for(let i=0;i<6;i++)g.push(E(k,i));R.push(g);}
 facets(b,R,ch,{bandM:r=>ST[r][2]?(hi&&!ST[r+1][2]?ch:chL):chD});
 for(let j=0;j<3;j++){const pts=[],pb=[];for(let k=0;k<NS;k++){pts.push(E(k,2*j,1.03));pb.push(E(k,2*j+1,1.02));}
  sweep(b,pts,t=>(.22-.07*t)*rs,3,P.mag,{});
  // the bone ribs: thick tubes on HIGH, raised straps on LOW
  if(hi)sweep(b,pb,t=>(.34-.14*t)*rs,4,boneM,{sq:.7});
  else for(let k=0;k<NS-1;k++){const a0=E(k,2*j+.76,1.07),a1=E(k,2*j+1.24,1.07),b0=E(k+1,2*j+.76,1.07),b1=E(k+1,2*j+1.24,1.07),ins=axis((ST[k][0]+ST[k+1][0])/2);T3(b,a0,a1,b1,boneM,ins);T3(b,a0,b1,b0,boneM,ins);}}
 // claw buttresses grip the foot
 [[.9,5.5],[2.9,4.2],[4.9,6.2]].forEach(([a,hh])=>{const c=Math.cos(a),sn=Math.sin(a);horn(b,[c*1.6*rs,-sink*.5,sn*1.6*rs],[c*1.94*rs,hh*H*.6,sn*1.94*rs],[c*1.2*rs,hh*H,sn*1.2*rs],.5*rs,4,boneM,{segs:hi?4:2,glow:P.magDim,ringM:boneF});});
 // thorns ring the top of every knuckle (HIGH)
 if(hi)for(let k=1;k<NS-1;k++)if(ST[k][2]&&!ST[k+1][2])for(const i of [1,3,5])spike(b,E(k,i,.92,-.25*H),E(k,i,Math.min(1.3,1.85/ST[k][1]),.85*H),.16*rs,dark,3);
 // the orb in its cup, caged by five claws
 const c1=axis(1);b.cyl(c1[0],top-.45*H,c1[2],.72*rs,1.15*H,dark,{n:6,r2:1.25*rs,top:true});b.ball(c1[0],18.8*H,c1[2],1.25*rs,P.magHot,!hi);
 for(let k=0;k<5;k++){const a=k*TAU/5+.4,c=Math.cos(a),sn=Math.sin(a),sh=k%2;
  horn(b,[c1[0]+c*1.0*rs,top+.2*H,c1[2]+sn*1.0*rs],[c1[0]+c*(sh?2.6:2.75)*rs,(sh?18.6:19.0)*H,c1[2]+sn*(sh?2.6:2.75)*rs],[c1[0]+c*(sh?1.05:.7)*rs,Math.min(o.h-.04,(sh?19.75:20.34)*H),c1[2]+sn*(sh?1.05:.7)*rs],.42*rs,4,boneM,{segs:hi?4:2,glow:P.magDim,ringM:boneF});
  if(hi){const a2=a+TAU/10;spike(b,[c1[0]+Math.cos(a2)*1.0*rs,top+.45*H,c1[2]+Math.sin(a2)*1.0*rs],[c1[0]+Math.cos(a2)*1.8*rs,top+1.1*H,c1[2]+Math.sin(a2)*1.8*rs],.16*rs,dark,3);}}
 if(hi)b.halo(c1[0],18.8*H,c1[2],5*rs,0xff2bd6,.4);
},{aoH:8,aoMin:.5});

// cover-wall (EXACT box o.w x o.h x o.d, default 18 x 5 x 3; art inside the box in plan): a Parasite-grown wall the player
// fights around. Three or four bulging chitin humps of unequal length along the long axis, dark at the foot and paler toward
// the crest (the tallest reaches o.h), a ridge of bone spikes on top (to o.h + .55) and a glowing magenta vein in every
// groove between the humps. HIGH cuts the grooves as glowing clefts with bone fangs beside them; LOW keeps the humps, the
// spike ridge and a vein wedge in each groove. The long axis is x when w >= d, else z.
// o.sink (default 1.2) = how far the humps run below y = 0. HIGH <= 400 / LOW <= 100.
WK.model('cover-wall',(b,o)=>{const {pal,tint,glow,mat}=b.k,P=pal.par,hi=b.hi,long=o.w>=o.d,L=long?o.w:o.d,T=long?o.d:o.w,h=o.h,sink=o.sink??1.2,hw=T/2,n=L>=14?4:3,sd=(o.seed|0)*7+Math.round(L*3+T*5),mid=hi?3:2,
  C4=[mat(0x120816,'flat',0,.06),mat(0x341a3e,'flat',0,.1),mat(0x5a3769,'flat',0,.1),mat(0x80608f,'flat',0,.08)],vHot=glow(0xff4fe0,1.85),vDim=glow(0x9a1880,1.85),bone=mat(0x9484a2,'flat',0,.06),boneT=P.magDim;
 b.at(0,0,0,long?0:Math.PI/2,()=>{
  // hump k runs X[k] .. X[k+1]: lengths, crest heights and crest lines all differ
  const wt=[],X=[-L/2];let sum=0;for(let k=0;k<n;k++){wt.push(1+.36*(hz(sd,k)-.5));sum+=wt[k];}for(let k=0;k<n;k++)X.push(k===n-1?L/2:X[k]+L*wt[k]/sum);
  const tall=sd%n,gw=hi?Math.min(.36,L/n*.09):0,EDGE=[.8,h*.78,.78],END=[.66,h*.6,.72],sc=Math.min(1.5,Math.max(1,T/3.2));
  // one cross-section (an open line foot .. crest .. foot): half-width factor, crest height, foot factor, crest offset
  const sec=(x,fw,yc,ff,zc,M)=>hi?[[x,-sink,-hw*ff,M[0]],[x,h*.3,-hw*fw,M[1]],[x,yc*.8,-hw*fw*.62+zc*.5,M[2]],[x,yc,zc,M[3]],[x,yc*.8,hw*fw*.62+zc*.5,M[2]],[x,h*.3,hw*fw,M[1]],[x,-sink,hw*ff,M[0]]]
   :[[x,-sink,-hw*ff,M[0]],[x,yc*.66,-hw*fw*.84,M[2]],[x,yc,zc,M[3]],[x,yc*.66,hw*fw*.84,M[2]],[x,-sink,hw*ff,M[0]]];
  const HS=[],S=[],FL=[];
  for(let k=0;k<n;k++){const a=X[k]+(k?gw:0),c=X[k+1]-(k<n-1?gw:0),hk=k===tall?h:h*(.86+.12*hz(sd,k+10)),zc=hw*.3*(hz(sd,k+20)-.5),pk=.38+.24*hz(sd,k+30),f=k%2?1:.84,M=[C4[0],tint(C4[1],f),tint(C4[2],f),tint(C4[3],f)],e0=k?EDGE:END,e1=k<n-1?EDGE:END,
    U=hi?[[0,...e0,0],[pk*.45,.95,e0[1]+(hk-e0[1])*.82,.84,zc*.7],[pk,1,hk,.86,zc],[pk+(1-pk)*.55,.95,e1[1]+(hk-e1[1])*.82,.84,zc*.7],[1,...e1,0]]:[[0,...e0,0],[pk,1,hk,.86,zc],[1,...e1,0]];
   HS.push(U.map(([u,fw,yc,ff,z])=>({u,p:sec(a+(c-a)*u,fw,yc,ff,z,M)})));HS[k].forEach((q,i)=>{if(hi||!k||i)S.push(q);});
   if(hi&&k<n-1){FL[k+1]=sec(X[k+1],.7,h*.68,.74,0,M);S.push({v:1,p:FL[k+1]});}}
  // the skin; a groove's two walls glow, hottest along its floor
  const glw=(Q,m)=>Q.map((p,i)=>[p[0],p[1],p[2],i&&i<Q.length-1?m:vDim]);
  for(let i=1;i<S.length;i++){const g=S[i-1].v||S[i].v,A=g?glw(S[i-1].p,S[i-1].v?vHot:vDim):S[i-1].p,B=g?glw(S[i].p,S[i].v?vHot:vDim):S[i].p,ins=[(A[0][0]+B[0][0])/2,h*.2,0];
   for(let j=0;j<A.length-1;j++){if((i+j)&1){T3(b,A[j],A[j+1],B[j+1],C4[1],ins);T3(b,A[j],B[j+1],B[j],C4[1],ins);}else{T3(b,A[j],A[j+1],B[j],C4[1],ins);T3(b,A[j+1],B[j+1],B[j],C4[1],ins);}}}
  for(const Q of [S[0].p,S[S.length-1].p]){const c=[Q[0][0],Q[mid][1]*.45,0,Q[1][3]];for(let j=0;j<Q.length-1;j++)T3(b,Q[j],Q[j+1],c,C4[1],[0,h*.3,0]);}
  // the ridge of spikes: dark at the root, bone-pale at the point, leaning one way
  const crest=(k,u)=>{const Q=HS[k];let i=1;while(i<Q.length-1&&u>Q[i].u)i++;return lerp3(Q[i-1].p[mid],Q[i].p[mid],(u-Q[i-1].u)/(Q[i].u-Q[i-1].u));};
  for(let k=0;k<n;k++){const pk=HS[k][hi?2:1].u,us=hi?[[pk*.5,.66],[pk,1],[pk+(1-pk)*.5,.74]]:k===n-1&&n>3?[[pk,1]]:[[pk*.8,.85],[pk+(1-pk)*.55,.6]];
   us.forEach(([u,f],j)=>{const p=crest(k,u),len=(.95+.5*hz(sd,k*5+j+40))*f*sc,r=Math.min((hi?.36:.4)*sc*(.7+.3*f),hw*.34),x=Math.max(-L/2+r,Math.min(L/2-r,p[0]));
    spike(b,[x,p[1]-.18,p[2]],[Math.min(L/2-.05,x+len*.28),Math.min(h+.55,p[1]+len),p[2]+hw*.16*(hz(sd,k*5+j+60)-.5),boneT],r,bone,hi?4:3,k+j);});}
  for(let k=1;k<n;k++){
   if(hi)for(const sg of [-1,1])for(const e of [-1,1])spike(b,[X[k]+e*(gw+.35),h*.42,sg*hw*.62],[X[k]+e*gw*.2,h*(.82+.06*((k+e)&1)),sg*(hw-.04),boneT],.22*sc,bone,3,k+e);   // fangs either side of the cleft
   else{const G=HS[k][0].p,A=HS[k-1][1].p,C=HS[k][1].p;   // the vein wedge in the groove, on both faces
    for(const [f,sh,sg] of [[0,1,-1],[4,3,1]]){const on=(Q,t)=>{const r=lerp3(lerp3(G[f],G[sh],.42),lerp3(Q[f],Q[sh],.42),t);return [r[0],r[1],r[2]+sg*.07,vDim];};
     T3(b,on(A,.5/(G[0][0]-A[0][0])),on(C,.5/(C[0][0]-G[0][0])),[G[sh][0],G[sh][1]+.1,G[sh][2]+sg*.1,vHot],vHot,[G[0][0],h*.2,0]);}}}
 });
},{aoH:4,aoMin:.55});

// raid-spire (8.8 x 7.4 x 7.6): a crystal spire cluster on a chitin root: five leaning magenta-violet shards, dark at the
// foot, hot at the tip, the tallest 7.2 m, in a nest of roots, claws and crystal buds. HIGH <= 2000 / LOW <= 700.
WK.model('raid-spire',(b,o)=>{const {pal,tint,mat,glow}=b.k,P=pal.par,hi=b.hi,sd=o.seed|0,W=o.w/8.8,D=o.d/7.6,H=o.h/7.4,U=Math.min(W,D),dark=P.chitinD,darkF=flatOf(dark),
  M=[mat(0x3a1450,'metal',.2),mat(0x2a0e3c,'flat'),glow(0x8a1eb0,.4),glow(0xff7ae8,1.95)],M2=[M[0],M[1],glow(0x6a1890,.3),glow(0xe04ad0,.9)];
 const m=shade(dark,tint(P.chitin,1.1),dark);
 blob(b,0,-.5,0,4.3*W,2.0,3.7*D,{n:hi?14:8,prof:hi?[[0,1],[.4,.8],[.74,.5]]:[[0,1],[.55,.62]],seed:sd+1,m,zig:.22,jit:.1,at:.96});
 const S=[[0,0,7.2,0,0,1],[1.6,.8,5,.35,.2,.8],[-1.4,1.1,4.3,-.3,.3,.75],[.6,-1.6,3.8,.15,-.4,.7],[-1,-1.2,3.2,-.25,-.3,.6]];
 S.forEach(([dx,dz,hh,tx,tz,r],k)=>{const x=dx*W,z=dz*D,L=hh*H,p=[x,.3,z],tip=[x+Math.sin(tx)*L*.95,L,z+Math.sin(tz)*L*.95],rr=r*.5*U;
  crystal(b,p,tip,rr,hi?6:4,M,{rot:k*.7,sq:.78,sh:.8});
  if(hi){for(let j=0;j<2;j++){const a=k*1.3+j*2.6+.4,c=Math.cos(a),sn=Math.sin(a),q=[x+c*rr*1.5,.5,z+sn*rr*1.5];crystal(b,q,[q[0]+c*L*.14+Math.sin(tx)*L*.2,.5+L*(.2+.07*j),q[2]+sn*L*.14+Math.sin(tz)*L*.2],rr*.42,4,M2,{rot:a,lite:true,sh:.6});
    horn(b,[x+Math.cos(a+1)*rr*2.3,.4,z+Math.sin(a+1)*rr*2.3],[x+Math.cos(a+1)*rr*2.6,.4+L*.14,z+Math.sin(a+1)*rr*2.6],[x+Math.cos(a+1)*rr*1.25,.4+L*.22,z+Math.sin(a+1)*rr*1.25],.2*U,3,dark,{segs:2});}}});
 // roots crawl out to the edge of the box and end in claws
 const nr=hi?9:5;for(let k=0;k<nr;k++){const a=k/nr*TAU+.3,c=Math.cos(a),sn=Math.sin(a),f=[c*1.9*W,1.15,sn*1.6*D],g=[c*4.15*W,-.15,sn*3.55*D];
  horn(b,f,[c*3.2*W,1.0,sn*2.7*D],g,.4*U,hi?4:3,m,{segs:hi?4:2,taper:.55});
  if(hi)horn(b,[c*3.9*W,-.1,sn*3.3*D],[c*4.3*W,.6,sn*3.7*D],[c*4.1*W,1.25+.3*(k%2),sn*3.5*D],.22*U,3,dark,{segs:2,glow:P.magDim,ringM:darkF});}
 if(hi){b.halo(0,5.4*H,0,4.5*U,0xff2bd6,.22);b.pool(0,.12,0,6*W,6*D,0xff2bd6,.1);}
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ field props ------------------------------------------
const RARITY={'-1':0xffb347,0:0xb8c0c8,1:0x4dff88,2:0x22e6ff,3:0xa07bff,4:0xffd36b};
// loot-cache (2.4 x 1.6 x 1.8): a supply crate dropped on the ground, a little tilted: armoured body, corner posts, two
// straps, a lit lid seam and a lid emblem in the rarity colour. o.rarity -1 (plain supply, amber) .. 4 (gold).
// HIGH <= 400 / LOW <= 150.
WK.model('loot-cache',(b,o)=>{const {pal,tint,glow}=b.k,M=pal.mil,hi=b.hi,r=Math.max(-1,Math.min(4,o.rarity===undefined?-1:o.rarity|0)),hex=RARITY[r],lit=tint(glow(hex,1),.5),litS=tint(glow(hex,.85),.6),s=Math.min(o.w/2.4,o.h/1.6,o.d/1.8);
 b.at(0,.02,0,.15,q=>{const w=1.9,d=1.34,hb=.78,hl=.34;
  q.bev(0,-.12,0,w,hb+.12,d,M.hull2,{ch:.08});q.box(0,hb,0,w-.1,.09,d-.1,lit);q.bev(0,hb+.09,0,w+.06,hl,d+.06,M.hull,{ch:.1});
  // corner posts and straps
  if(hi)for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])q.box(sx*(w/2-.04),-.1,sz*(d/2-.04),.2,hb+.1,.2,M.dark);
  for(const sx of [-1,1]){q.box(sx*.52,hb+.09+hl,0,.2,.05,d+.12,M.plate2);if(hi){q.box(sx*.52,-.1,d/2+.035,.2,hb+hl+.2,.05,M.plate2);q.box(sx*.52,-.1,-d/2-.035,.2,hb+hl+.2,.05,M.plate2);}}
  // the lid emblem (the camera looks down on it) and the latch
  gem8(q,0,hb+.09+hl+.03,0,.3,.09,.3,lit,Math.PI/4,4);q.box(0,hb-.3,d/2+.04,.34,.3,.06,M.gold);q.box(0,hb-.22,d/2+.08,.16,.1,.03,litS);
  if(hi){for(const sx of [-1,1]){q.tube([sx*(w/2+.02),hb*.55,-.3],[sx*(w/2+.14),hb*.55,-.3],.035,M.bare,{n:4});q.tube([sx*(w/2+.02),hb*.55,.3],[sx*(w/2+.14),hb*.55,.3],.035,M.bare,{n:4});q.tube([sx*(w/2+.14),hb*.55,-.3],[sx*(w/2+.14),hb*.55,.3],.04,M.bare,{n:4});}
   q.box(-.62,hb*.25,d/2+.03,.5,.28,.03,M.hazard);q.halo(0,hb+hl+.5,0,1.4,hex,.25);q.pool(0,.06,0,2,1.8,hex,.16);}
 },0,-.07,s);
},{aoH:1.4,aoMin:.6});
// wreck-cache (3 x 1.6 x 2.2): salvage from a destroyed machine: twisted hull plates leaning on a chassis chunk, a road wheel,
// an amber-lit core showing between them. LOW keeps the two big plates (in paler rust and hull tones that read without the
// surface shader), the core and its light on the chassis. HIGH <= 400 / LOW <= 150.
WK.model('wreck-cache',(b,o)=>{const {pal,tint,glow}=b.k,Wk=pal.wreck,hi=b.hi,s=Math.min(o.w/3,o.h/1.6,o.d/2.2),amber=glow(0xffb347,1.2),hot=glow(0xffd9a0,1.2),hull=hi?Wk.hull:tint(Wk.hull,1.9,.012),lit=(m,k)=>({c:m.c,a:k,j:0}),PL=hi?[Wk.hull,Wk.rust]:[lit(tint(Wk.hull,2.4,.01),.35),lit(tint(Wk.rust,1.5),.4)];   // LOW: the plates carry the core's light themselves
 b.at(0,0,0,0,q=>{
  q.at(-.15,-.12,-.1,.3,c=>{c.bev(0,0,0,1.5,.72,1.1,hi?hull:tint(hull,.62),{ch:.1});if(!hi)c.quad([-.62,.725,-.42],[.62,.725,-.42],[.62,.725,.42],[-.62,.725,.42],tint(glow(0xffb347,.6),.45),[0,0,0]);},.08,-.1);   // the chassis chunk, sunk and tilted (LOW: the core's light on its deck)
  gem8(q,.22,hi?.74:.8,.14,hi?.26:.33,hi?.3:.38,hi?.26:.33,amber,.4,hi?6:4,hot);q.at(-.2,.7,.05,.8,c=>{c.cyl(0,-.34,0,.2,.68,Wk.track,{n:6,bot:true});c.cyl(0,-.08,0,.225,.16,amber,{n:6,top:false});},0,1.25);                                               // the lit core
  const plates=[[.86,.12,.12,.5,1.2,.9,.12,-.95],[-.86,.1,.16,-.6,1.1,.8,-.2,.85],[.1,.16,.52,1.5,1.0,.7,-1.0,.1],[.3,.1,-.56,.2,1.4,.62,.95,.12],[-.5,.5,-.1,2.2,.9,.6,.3,.5]];
  plates.slice(0,hi?5:3).forEach(([x,y,z,ry,w,d,rx,rz],k)=>q.at(x,y,z,ry,c=>{c.box(0,0,0,w,hi?.07:.1,d,PL[k%2]);if(hi&&k<3)c.box(w*.18,.07,0,.09,.06,d*.9,Wk.track);},rx,rz));
  q.at(-1.02,.3,-.5,.5,c=>c.cyl(0,-.11,0,.34,.22,Wk.track,{n:hi?8:6,bev:.04,bot:true}),.25,1.2);                // a road wheel on its side
  if(hi){q.tube([.5,.1,.45],[1.15,.9,.62],.05,Wk.wire,{n:4});q.tube([-.3,.5,.3],[-.9,1.2,.45],.045,Wk.rust,{n:4});q.cable([.2,.8,.1],[1.1,.15,-.5],.2,.025,Wk.wire);
   stone(q,1.2,-.05,-.75,.2,.24,.18,7,Wk.track,{n:4,prof:ROCK2,cuts:0});stone(q,-.5,-.05,.9,.16,.2,.15,9,Wk.rust,{n:4,prof:ROCK2,cuts:0});
   q.halo(.2,1.0,.12,1.4,0xffb347,.22);q.pool(.1,.06,.1,2,1.6,0xffb347,.14);}
 },0,0,s);
},{aoH:1.4,aoMin:.6});
// sector-flag (2.6 x 8 x 1): the sector's flag mast: a heavy stepped foot (long under the banner) with four braces, a stout
// mast, a crossbar with gold knobs, a horned gold finial holding the top light, and a broad banner that glows in the owner's
// colour on both faces inside a bright rim. o.owner: 'owned' (teal, default) | 'friendly' (cyan) | 'hostile' (magenta; its
// banner hangs torn in three fangs). The banner faces +z and -z; its centre is where the game draws the sector's sign.
// HIGH <= 300 / LOW <= 100.
WK.model('sector-flag',(b,o)=>{const {pal,glow,tint}=b.k,M=pal.mil,hi=b.hi,hostile=o.owner==='hostile',hex=hostile?0xff2bd6:o.owner==='friendly'?0x22e6ff:0x2dffc4,c=tint(glow(hex,.8),.26),cRim=tint(glow(hex,.8),.8),cHot=glow(hex,1.2),h=o.h,bw=Math.min(o.w-.24,3.2),fx=Math.min(o.w*.32,1.1),fz=o.d*.47;
 // the foot: a long stepped plinth, a socket, four braces up to the mast
 b.cyl(0,-.1,0,fx,.44,M.hull2,{n:6,bev:.07,rz:fz,r2:fx*.9});b.cyl(0,.34,0,fx*.6,.46,M.hull,{n:6,bev:.05,rz:fz*.68,r2:fx*.44});
 if(hi){b.cyl(0,.8,0,.24,.5,M.dark,{n:6,r2:.18});
  for(const [sx,sz] of [[1,0],[-1,0],[0,1],[0,-1]])b.tube([sx*fx*.78,.3,sz*fz*.74],[sx*.1,sx?1.9:1.5,sz*.1],.07,M.trim,{n:4});}
 // the mast, its crossbar and the finial
 const yc=h-.75;b.tube([0,.7,0],[0,h-.62,0],.13,M.trim,{n:hi?6:4,r2:.09});b.tube([-bw/2-.02,yc,0],[bw/2+.02,yc,0],.08,M.hull2,{n:hi?5:4,caps:hi});
 gem8(b,0,h-.31,0,.2,.3,.2,cHot,.3,hi?6:4);
 if(hi){b.cyl(0,h-.68,0,.16,.1,M.gold,{n:6});for(const sx of [-1,1]){spike(b,[sx*.13,h-.62,0],[sx*.34,h-.2,0],.06,M.gold);if(!hostile)gem8(b,sx*bw/2,yc,0,.09,.12,.09,M.gold,.3,4);}
  b.box(0,yc-.12,0,.3,.24,.22,M.dark);b.halo(0,h-.3,0,1.1,hex,.4);}
 // the banner: a dark plate, a bright rim and the glowing field on both faces
 const bh=Math.min(3.5,h*.4+.3),y1=yc-.12,y0=y1-bh,x=bw/2,P=hostile?[[-x,y1],[x,y1],[x,y0+.5],[x*.62,y0],[x*.3,y0+.62],[0,y0+.12],[-x*.3,y0+.62],[-x*.62,y0],[-x,y0+.5]]:[[-x,y1],[x,y1],[x,y0+.2],[0,y0+.8],[-x,y0+.2]];
 const fan=(z,k,m,ins)=>{const cc=[0,(y1+y0)/2+.3,z];for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];T3(b,[cc[0]+(p[0]-cc[0])*k,cc[1]+(p[1]-cc[1])*k,z],[cc[0]+(q[0]-cc[0])*k,cc[1]+(q[1]-cc[1])*k,z],cc,m,ins);}};
 for(const sg of [1,-1]){const ins=[0,y0,-9*sg];fan(.035*sg,1,M.dark,ins);if(hi||!hostile)fan(.05*sg,.96,cRim,ins);fan(.065*sg,.86,c,ins);}
 if(hi){for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];b.quad([p[0],p[1],-.035],[q[0],q[1],-.035],[q[0],q[1],.035],[p[0],p[1],.035],M.trim,[0,(y1+y0)/2,0]);}
  for(const z of [.075,-.075]){for(const [yy,ww,hh] of [[y1-.5,bw*.25,.1],[y1-.78,bw*.15,.08]])b.quad([-ww,yy,z],[ww,yy,z],[ww,yy+hh,z],[-ww,yy+hh,z],M.dark,[0,yy,0]);
   if(!hostile)for(const sx of [-1,1])b.quad([sx*x*.74,y0+.52,z],[0,y0+1.12,z],[0,y0+1.34,z],[sx*x*.74,y0+.74,z],cRim,[0,y0,-z*99]);}}
},{aoH:6,aoMin:.6});
})(typeof globalThis!=='undefined'?globalThis:window);
