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
// glowing crown. HIGH 146 / LOW 60.
WK.model('fungus-growth',(b,o)=>{const {mat,glow,tint}=b.k,hi=b.hi,body=mat(0x4a3d5c,'dirt',0,.12),stalk=mat(0x5a5068,'dirt',0,.1),gill=glow(0xa07bff,.7),spot=glow(0xc3a6ff,.7),f0=flatOf(tint(body,.9));
 const P=[[0,0,1,.06,.03,5],[.48,.2,.72,.2,.06,5],[-.44,.3,.62,-.2,.1,4],[.15,-.5,.66,.05,-.2,4],[-.35,-.4,.44,-.16,-.14,4]];
 (hi?P:[P[0],P[1],P[3]]).forEach(([x,z,s,tx,tz,n],k)=>{const R=.34*s,top=[x+tx,s,z+tz],at=t=>[x+tx*t*t,s*t+.025*(1-t),z+tz*t*t];
  if(hi&&k<4)sweep(b,[at(0),at(.52),at(.6),at(.84)],[.11*s,.08*s,R,R*.86],n,body,{rot:k,bandM:r=>r===0?stalk:r===1?gill:body,tipRingM:f0,tip:pt(top,spot)});
  else sweep(b,[at(0),at(.56),at(.84)],[.1*s,R,R*.86],4,body,{rot:k,bandM:r=>r?body:stalk,tipRingM:hi?f0:gill,tip:pt(top,spot)});});
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
// tree-broadleaf (4.6 x 6.8 x 4.6): a gnarled broadleaf. A forked trunk, big faceted canopy masses in olive, dark green and
// ochre with darker undersides. HIGH <= 300 / LOW <= 120.
WK.model('tree-broadleaf',(b,o)=>{const {pal,tint}=b.k,N=pal.nat,hi=b.hi,sd=o.seed|0,s=Math.min(o.h/6.8,o.w/4.6,o.d/4.6),bark=shade(N.bark,tint(N.bark,1.25),tint(N.bark,.8));
 b.at(0,0,0,0,()=>{const F=[.12,2.35,0];
  sweep(b,[[0,-.1,0],[-.12,1.15,.05],F],[.36,.28,.24],hi?6:4,bark);
  const br=[[[.7,3.2,.25],[1.0,4.1,.42],.17,.1],[[-.55,3.3,-.25],[-.85,4.2,-.45],.16,.09],[[.2,3.3,-.6],[.25,3.9,-1.0],.12,.07],[[-.2,3.2,.55],[-.3,3.8,.95],.11,.07]];
  br.slice(0,hi?4:2).forEach(([p1,p2,r1,r2],k)=>hi&&k<2?sweep(b,[F,p1,p2],[.2,r1,r2],4,bark):sweep(b,[F,p2],[.17,r2],3,bark));
  if(hi)for(const a of [.9,3.0,5.0]){const cx=Math.cos(a),sz=Math.sin(a);T3(b,[cx*.2-sz*.12,.5,sz*.2+cx*.12],[cx*.2+sz*.12,.5,sz*.2-cx*.12],[cx*.75,-.08,sz*.75],N.bark,[0,-.5,0]);T3(b,[cx*.2-sz*.14,-.05,sz*.2+cx*.14],[cx*.2-sz*.12,.5,sz*.2+cx*.12],[cx*.75,-.08,sz*.75],N.bark,[cx*.3,0,sz*.3]);T3(b,[cx*.2+sz*.14,-.05,sz*.2-cx*.14],[cx*.2+sz*.12,.5,sz*.2-cx*.12],[cx*.75,-.08,sz*.75],N.bark,[cx*.3,0,sz*.3]);}
  const C=[[0,4.45,0,1.4,2.1,1.35],[1.0,3.5,.4,1.2,1.6,1.1],[-1.1,3.6,-.45,1.2,1.5,1.15],[.3,3.2,-1.3,1.1,1.4,1.0],[-.4,3.1,1.3,1.1,1.4,1.0],[.95,4.3,-.7,.9,1.3,.9],[-.9,4.2,.8,.95,1.3,.9]],BR=[N.broad[0],N.broad[1],N.broad[2],b.k.mix(N.broad[3],N.broad[1],.5),N.broad[1],N.broad[2],N.broad[0]];
  C.slice(0,hi?7:4).forEach(([x,y,z,rx,ry,rz],k)=>{const g=BR[(k+sd)%7],m=shade(g,tint(g,1.14),tint(g,.52));blob(b,x,y,z,rx,ry,rz,{n:hi?6:5,prof:[[.26,.84],[.66,.88]],seed:sd*9+k,m,nadir:true,nadirM:tint(g,.45),jit:.22,zig:.12,cuts:hi?2:0,lx:.15,yaw:k*1.3});});
 },0,0,s);
},{aoH:4.5,aoMin:.6});
// tree-dead (3.8 x 7.2 x 3.8): a dead, burnt tree. A charred trunk snapped at the top, bare broken limbs. HIGH <= 120 / LOW <= 60.
WK.model('tree-dead',(b,o)=>{const {pal,tint,mix,mat}=b.k,N=pal.nat,hi=b.hi,s=Math.min(o.h/7.2,o.w/3.8,o.d/3.8),ash=mix(N.burnt,mat(0x6a645c,'timber',.9),.6),char=shade(tint(N.burnt,1.6,.01),ash,tint(N.burnt,1.2));
 b.at(0,0,0,0,()=>{const T=[[0,-.1,0],[.1,1.6,.03],[-.06,3.4,-.04],[.14,5.0,.04],[.1,6.2,0]];
  if(hi)sweep(b,T,[.42,.33,.27,.2,.12],5,char,{tip:[.26,7.15,.06]});else sweep(b,[T[0],T[2],T[4]],[.42,.27,.12],4,char,{tip:[.26,7.15,.06]});
  const L=[[3.2,.4,1.7,1.0],[4.4,2.6,1.5,1.1],[5.3,4.4,1.2,.9],[2.4,5.5,1.4,.7],[5.9,1.3,.8,.7]];
  L.slice(0,hi?5:4).forEach(([y,a,l,up],k)=>{const p=along(T,y),ca=Math.cos(a),sa=Math.sin(a),mid=[p[0]+ca*l*.55,y+up*.25,p[2]+sa*l*.55],end=[p[0]+ca*l,y+up,p[2]+sa*l],m=k%2?char:tint(N.burnt,1.3);
   if(hi&&k<3)sweep(b,[p,mid,lerp3(mid,end,.8)],[.14,.1,.06],3,m,{tip:end});else sweep(b,[p,mid],[.13,.08],3,m,{tip:end});});
 },0,0,s);
},{aoH:4,aoMin:.7});
// tree-far (4.4 x 7.2 x 4.4): the distance stand-in for any tree: a trunk and two faceted canopy tiers. 56 triangles.
WK.model('tree-far',(b,o)=>{const {pal,tint,mix}=b.k,N=pal.nat,s=Math.min(o.h/7.2,o.w/4.4,o.d/4.4),g=N.leaf[1],g2=N.leaf[2];
 b.at(0,0,0,0,()=>{sweep(b,[[-.2,-.1,0],[.05,3.2,0]],[.3,.18],4,N.bark);
  tier(b,.05,2.0,0,1.75,3.0,.5,6,3,tint(g,1.1),mix(g,N.olive,.4),tint(g,.5),.2);tier(b,.3,4.2,0,1.3,2.95,.4,6,8,tint(g2,1.15),mix(g2,N.olive,.4),tint(g2,.5),.2);
 },0,0,s);
},{aoH:5,aoMin:.6});

// ------------------------------------------------------------------ frontier flora --------------------------------------
// a two-sided blade from a point: root, a bent middle, a tip (grass 6 triangles; a fern frond 8)
function blade(b,x,y,z,a,len,h,wd,m,o={}){const ca=Math.cos(a),sa=Math.sin(a),px=-sa*wd/2,pz=ca*wd/2,k=o.k??.5,kh=o.kh??.72,mu=o.under||m,tm=o.tipM||m,
  a0=[x-px,y,z-pz],a1=[x+px,y,z+pz],m0=[x+ca*len*k-px*.75,y+h*kh,z+sa*len*k-pz*.75],m1=[x+ca*len*k+px*.75,y+h*kh,z+sa*len*k+pz*.75],t=[x+ca*len,y+h*(o.th??1),z+sa*len,tm];
 leafTri(b,a0,a1,m1,m,mu);leafTri(b,a0,m1,m0,m,mu);leafTri(b,m0,m1,t,m,mu);}
function frond(b,x,y,z,a,len,h,wd,m,mu,tm){const ca=Math.cos(a),sa=Math.sin(a),px=-sa*wd/2,pz=ca*wd/2,at=(r,yy,w)=>[[x+ca*len*r-px*w,y+h*yy,z+sa*len*r-pz*w],[x+ca*len*r+px*w,y+h*yy,z+sa*len*r+pz*w]],
  p0=[x+ca*.05,y,z+sa*.05],[b0,b1]=at(.36,.72,1),[c0,c1]=at(.72,.98,.8),t=[x+ca*len,y+h*.42,z+sa*len,tm];
 leafTri(b,p0,b0,b1,m,mu);leafTri(b,b0,b1,c1,m,mu);leafTri(b,b0,c1,c0,m,mu);leafTri(b,c0,c1,t,m,mu);}
// scrub (1.7 x 1 x 1.7): hardy scrub. A low olive bush of three leaf masses leaning downwind with dry thorn twigs. HIGH <= 100 / LOW <= 60.
WK.model('scrub',(b,o)=>{const {pal,tint,mat,mix}=b.k,N=pal.nat,hi=b.hi,sd=o.seed|0,s=Math.min(o.w/1.7,o.h,o.d/1.7),stem=mat(0x4a3826,'timber',.4),ol=tint(N.olive,.8),G=[ol,N.moss,mix(ol,N.leaf[1],.5)];
 b.at(0,0,0,0,()=>{for(let k=0;k<3;k++){const a=k/3*TAU+.4,r=.3+.06*k,g=G[k],m=shade(g,tint(g,1.18),tint(g,.55));
   blob(b,Math.cos(a)*r+.04,-.03,Math.sin(a)*r*.9,.5,.62-.09*k,.46,{n:hi?5:4,prof:hi?[[0,.8],[.36,1],[.72,.56]]:[[0,.85],[.5,.9]],seed:sd*7+k,m,lx:.16,jit:.24,zig:.3,yaw:k});}
  const tw=hi?[[.2,.85,.92],[1.9,.8,.8],[3.6,.82,.96],[5.3,.7,.84]]:[[.2,.85,.92],[3.6,.82,.96]];
  for(const [a,l,h] of tw){const ca=Math.cos(a),sa=Math.sin(a);spike(b,[ca*.2,.25,sa*.2],[ca*l,h,sa*l],.04,stem);}
  if(hi){gem8(b,.58,.6,.1,.11,.09,.1,tint(ol,1.15),.3,3);gem8(b,-.42,.56,.36,.1,.08,.1,N.moss,1,3);}
 },0,0,s);
},{aoH:.9,aoMin:.6});
// flower-patch (.9 x .5 x .9): a low leaf mound with four small pale blooms (cream / straw, no glow). 50 triangles.
WK.model('flower-patch',(b,o)=>{const {pal,tint,mat}=b.k,N=pal.nat,sd=o.seed|0,s=Math.min(o.w/.9,o.h/.5,o.d/.9),g=N.moss,cream=mat(0xd9cfba,'flat',0,.08),straw=mat(0xcdb770,'flat',0,.08),eye=mat(0xb08a3a,'flat');
 b.at(0,0,0,0,()=>{blob(b,0,-.02,0,.44,.28,.42,{n:6,prof:[[0,1],[.55,.8]],zig:.2,seed:sd+2,m:shade(g,tint(g,1.2),tint(g,.6)),jit:.2});
  for(let k=0;k<4;k++){const a=k*1.6+.3,x=Math.cos(a)*.27,z=Math.sin(a)*.27,y=.2+.03*(k%2),R=[];for(let i=0;i<4;i++){const q=i/4*TAU+k;R.push([x+Math.cos(q)*.085,y+.17+.025*(i%2),z+Math.sin(q)*.085]);}
   facets(b,[R],k%2?straw:cream,{nadir:[x*.8,y,z*.8],apex:[x,y+.15,z,eye],apexIns:[x,y-1,z]});}
 },0,0,s);
},{aoH:.5,aoMin:.7});
// fern (2 x 1 x 2): arching fronds from one crown. HIGH 48 / LOW 32.
WK.model('fern',(b,o)=>{const {pal,tint,mat,mix}=b.k,N=pal.nat,hi=b.hi,sd=o.seed|0,s=Math.min(o.w/2,o.d/2),n=hi?6:4,G=[mat(0x4f7a30,'leaf',0,.2),mat(0x3f6a26,'leaf',0,.2)];
 for(let k=0;k<n;k++){const a=k/n*TAU+.3+.3*(hz(sd,k)-.5),g=G[k%2];frond(b,0,0,0,a,(.86+.14*hz(sd,k+9))*s,(.78+.2*hz(sd,k+20))*o.h,.38*s,g,tint(g,.6),mix(g,N.straw,.5));}
},{aoH:.9,aoMin:.62});
// crystal-sprout (.7 x 1.5 x .7): three thin teal crystal shards. 60 triangles.
WK.model('crystal-sprout',(b,o)=>{const {mat,glow}=b.k,sx=o.w/.7,sy=o.h/1.5,M=[mat(0x1c5c56,'metal',.2),mat(0x18544e,'flat'),glow(0x4fe0c8,.9),glow(0xb8fff0,.9)];
 for(let k=0;k<3;k++){const a=k*2.1+.4,h=(.9+.3*k)*sy,x=Math.cos(a)*.13*sx,z=Math.sin(a)*.13*sx;crystal(b,[x,.03,z],[x+Math.cos(a)*.05*sx*(3-k),h,z+Math.sin(a)*.05*sx*(3-k)],.1*sx,4,M,{rot:k,sh:.7,lite:!b.hi});}
},{aoH:1.5,aoMin:.75});
// moss-cushion (2 x .2 x 1.6): a low moss cushion with two smaller lumps. HIGH 40 / LOW 18.
WK.model('moss-cushion',(b,o)=>{const {pal,tint,mat,mix}=b.k,N=pal.nat,hi=b.hi,sd=o.seed|0,g=mat(0x3f5226,'leaf',0,.2),m=shade(g,tint(g,1.18),tint(g,.7)),w=o.w/2,d=o.d/1.6,h=o.h;
 blob(b,-.08*w,-.02,0,.9*w,h+.02,.76*d,{n:hi?8:6,prof:[[0,1],[.62,.66]],seed:sd+1,m,jit:.16,at:.98});
 if(hi){blob(b,.62*w,-.02,.38*d,.34*w,h*.8,.3*d,{n:4,prof:[[0,1],[.6,.6]],seed:sd+2,m:shade(mix(g,N.olive,.4),tint(g,1.25),g)});T3(b,[-.7*w,0,-.6*d],[-.42*w,0,-.74*d],[-.6*w,h*.55,-.56*d],m,[0,-1,0]);T3(b,[-.7*w,0,-.6*d],[-.6*w,h*.55,-.56*d],[-.5*w,0,-.4*d],m,[0,-1,0]);T3(b,[-.42*w,0,-.74*d],[-.6*w,h*.55,-.56*d],[-.5*w,0,-.4*d],m,[-.9*w,-1,-.9*d]);}
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
// grass-tuft (.7 x .8 x .7): a clump of blades of varied height in olive, straw and dark green. HIGH 48 / LOW 24.
WK.model('grass-tuft',(b,o)=>{const {pal,tint,mix}=b.k,N=pal.nat,hi=b.hi,sd=o.seed|0,r=Math.min(o.w,o.d)/.7,ol=tint(N.olive,.78),C=[ol,mix(N.straw,ol,.45),N.moss,N.leaf[2],ol,N.moss],n=hi?6:3;
 for(let k=0;k<n;k++){const a=k*TAU/n+.4+.5*(hz(sd,k)-.5),g=C[k],h=o.h*(.56+.11*((k*7)%5));blade(b,Math.cos(a)*.05*r,0,Math.sin(a)*.05*r,a,(.2+.035*(k%3))*r,h,.15*r,g,{under:tint(g,.7),tipM:mix(g,N.straw,.45),k:.42});
  const a2=a+TAU/n/2;leafTri(b,[Math.cos(a2-.5)*.07*r,0,Math.sin(a2-.5)*.07*r],[Math.cos(a2+.5)*.07*r,0,Math.sin(a2+.5)*.07*r],[Math.cos(a2)*.3*r,o.h*.34,Math.sin(a2)*.3*r,mix(g,N.straw,.4)],C[(k+2)%6]);}
},{aoH:.7,aoMin:.62});
// bio-node (1.4 x 1.2 x 1.4): the harvestable bio-flora plant, READY: a tough bush crowned with five glowing magenta-pink
// pods on stalks. bio-node-dim (1.2 x 1.1 x 1.2): the same bush regrowing: bare stalks, one dull bud. HIGH <= 200 / LOW <= 100.
function bioNode(b,o,hot){const {pal,tint,mat,glow,mix}=b.k,N=pal.nat,hi=b.hi,sd=o.seed|0,r=Math.min(o.w,o.d)/1.4,h=o.h/1.2,stem=mat(0x4a3826,'timber',.4),pod=glow(0xff5fd2,1.6),podHot=glow(0xffb4ec,1.6),husk=mat(0x6a5a44,'leaf',0,.1),G=[tint(N.olive,.8),N.moss];
 sweep(b,[[0,-.04,0],[.03*r,.6*h,0]],[.13*r,.08*r],hi?4:3,stem);
 for(let k=0;k<4;k++){const a=k*TAU/4+.4,g=G[k%2];blob(b,Math.cos(a)*.34*r,.34*h,Math.sin(a)*.34*r,.42*r,.5*h,.4*r,{n:hi?5:4,prof:CROWN2,seed:sd*5+k,m:shade(g,tint(g,1.2),tint(g,.55)),nadir:true,nadirM:tint(g,.5),jit:.2,yaw:k});}
 const P=[[.5,.8,.98],[1.76,.52,.86],[3.02,.5,1.0],[4.28,.5,.88],[5.4,.52,.96]];
 P.forEach(([a,rr,y],k)=>{const x=Math.cos(a)*rr*r,z=Math.sin(a)*rr*r*.92,rx=rr>.7?0:1;if(k===0){/* the crown pod stands on top */}
  const px=k?x:.04*r,pz=k?z:.02*r,py=(k?y:1.0)*h;
  if(hi)sweep(b,[[px*.45,.62*h,pz*.45],[px,py-.15*h,pz]],[.035*r,.028*r],3,stem);
  if(hot)gem8(b,px,py,pz,.135*r,(k?.17:.19)*h,.135*r,pod,k,hi?5:3,podHot);
  else if(k===0)gem8(b,px,py-.05*h,pz,.1*r,.12*h,.1*r,husk,k,hi?5:3);
  else if(hi){for(let i=0;i<3;i++){const q=i*TAU/3+k;T3(b,[px,py-.16*h,pz],[px+Math.cos(q)*.08*r,py-.04*h,pz+Math.sin(q)*.08*r],[px+Math.cos(q+1.2)*.08*r,py-.06*h,pz+Math.sin(q+1.2)*.08*r],husk,[px,py+1,pz]);}}});
}
WK.model('bio-node',(b,o)=>bioNode(b,o,true),{aoH:1,aoMin:.62});
WK.model('bio-node-dim',(b,o)=>bioNode(b,o,false),{aoH:1,aoMin:.62});

// ------------------------------------------------------------------ the ice mine ---------------------------------------
// ice-block (2.4 x 3 x 2.4): a cut block of the ice mine: a tall sawn prism with a slanted top, a broken slab leaning on it
// and a chip; pale glass-surfaced ice with one faintly glowing core facet. 57 triangles.
function prism(b,x,z,r,h,n,rot,slant,taper,m,o={}){const R=[];for(const t of o.mid?[0,.5,1]:[0,1]){const ring=[];for(let i=0;i<n;i++){const a=rot+(i+.3*(hz(o.seed||1,i)-.5))/n*TAU,rr=r*(1-taper*t)*(t===.5?1.04:1);
   ring.push([x+Math.cos(a)*rr+(o.lx||0)*t,t===1?h*(1-slant*(.5+.5*Math.cos(a-rot-(o.sa||0)))):h*t-(t?0:.08),z+Math.sin(a)*rr*(o.rz||1)+(o.lz||0)*t]);}R.push(ring);}
 const c=cen(R[R.length-1]);return facets(b,R,m,{apex:[c[0],c[1]+.02,c[2]],apexM:o.topM});}
WK.model('ice-block',(b,o)=>{const {pal,tint,glow}=b.k,N=pal.nat,sd=o.seed|0,sx=o.w/2.4,sz=o.d/2.4,h=o.h/3,ice=N.ice,core=glow(0xa8f8ff,.35),top=tint(ice,1.12,.02);let k=0;
 const m=ny=>(++k===3||k===4)?core:ny>.42?top:ny<-.2?tint(ice,.7):ice;
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

// hive-mast (4.2 x 20.4 x 4.2, all inside r 2.2): the hive's spire. A twisted, tapering chitin column whose six edges are
// three glowing veins and three bone ribs, three claw buttresses gripping its foot, the glowing orb at 18.8 m held by four
// claws. o.sink (default 1) = how far the foot runs below y = 0. HIGH <= 1500 / LOW <= 500.
WK.model('hive-mast',(b,o)=>{const {pal,tint}=b.k,P=pal.par,hi=b.hi,rs=Math.min(o.w,o.d)/4.2,H=o.h/20.4,sink=o.sink??1,NK=hi?10:5,top=17.6*H,dark=P.chitinD,darkF=flatOf(dark),bone=tint(P.bone,1.6,.02),boneM=shade(bone,tint(P.bone,2.1,.03),tint(P.bone,1.0)),boneF=flatOf(bone);
 const axis=t=>[.2*rs*Math.sin(t*5.2)*t,-sink+(top+sink)*t,.16*rs*Math.sin(t*4.1+1)*t],rad=t=>(1.6-1.06*Math.pow(t,.8))*rs*(1+.1*Math.max(0,Math.sin(t*9.4-.7))),tw=4.2/NK;
 const ring=(k,i,f=1,up=0)=>{const t=k/NK,c=axis(t),a=tw*k+i*TAU/6,r=rad(t)*f;return [c[0]+Math.cos(a)*r,c[1]+up,c[2]+Math.sin(a)*r];};
 const R=[];for(let k=0;k<=NK;k++){const g=[];for(let i=0;i<6;i++)g.push(ring(k,i));R.push(g);}
 const ch=b.k.mat(0x2f1836,'chitin',.1);facets(b,R,ch,{bandM:r=>r%2?ch:tint(ch,.8)});
 for(let j=0;j<3;j++){const pts=[];for(let k=0;k<=NK;k++)pts.push(ring(k,2*j,1.03));sweep(b,pts,t=>(.2-.08*t)*rs,3,P.mag,{});
  if(hi){const pb=[];for(let k=0;k<=NK;k++)pb.push(ring(k,2*j+1,1.02));sweep(b,pb,t=>(.24-.1*t)*rs,4,boneM,{sq:.7});}}
 // claw buttresses grip the foot
 [[.9,5.5],[2.9,4.2],[4.9,6.2]].forEach(([a,hh])=>{const c=Math.cos(a),sn=Math.sin(a);horn(b,[c*1.66*rs,-sink*.5,sn*1.66*rs],[c*2.06*rs,hh*H*.6,sn*2.06*rs],[c*1.3*rs,hh*H,sn*1.3*rs],.44*rs,4,boneM,{segs:hi?4:2,glow:P.magDim,ringM:boneF});});
 // the orb in its four claws
 const c1=axis(1);b.cyl(c1[0],top-.35*H,c1[2],.62*rs,.7*H,dark,{n:6,r2:.95*rs,top:true});b.ball(c1[0],18.8*H,c1[2],1.15*rs,P.magHot,!hi);
 for(let k=0;k<4;k++){const a=k*Math.PI/2+.4,c=Math.cos(a),sn=Math.sin(a);horn(b,[c1[0]+c*.7*rs,top-.1,c1[2]+sn*.7*rs],[c1[0]+c*2.25*rs,18.5*H,c1[2]+sn*2.25*rs],[c1[0]+c*.8*rs,Math.min(o.h-.04,20.34*H),c1[2]+sn*.8*rs],.3*rs,4,boneM,{segs:hi?4:2,glow:P.magDim,ringM:boneF});}
 if(hi){for(let k=2;k<NK;k+=2)for(const i of [1,3,5]){const p=ring(k,i,1.02),q=ring(k,i,1.28,.7*H);spike(b,p,q,.13*rs,dark,3);}
  b.halo(c1[0],18.8*H,c1[2],5*rs,0xff2bd6,.4);}
},{aoH:8,aoMin:.5});

// cover-wall (EXACT box o.w x o.h x o.d, default 18 x 5 x 3; art within the box +-.2): a Parasite-grown wall the player
// fights around. Chitin plates between dark seams every ~3 m, a lighter ridge of overlapping scutes on top, a magenta line
// under the top edge and one near the foot on both long faces. The long axis is x when w >= d, else z.
// o.sink (default 1.2) = how far the plates run below y = 0. HIGH <= 400 / LOW <= 100.
WK.model('cover-wall',(b,o)=>{const {pal,tint,glow}=b.k,P=pal.par,hi=b.hi,long=o.w>=o.d,L=long?o.w:o.d,T=long?o.d:o.w,h=o.h,sink=o.sink??1.2,n=Math.max(1,Math.floor(L/3)),seg=L/n,hw=T/2,rich=hi&&n<=9,
  wall=b.k.mat(0x2c2833,'chitin',0),wallL=tint(wall,1.25,.01),top=tint(P.wallTop,1.3,.01),dark=P.chitinD,bone=tint(P.bone,1.7,.02),line=P.mag,foot=glow(0xff2bd6,1.6),yk=h*.46,yt=h-.55,x0=-L/2,ins=[0,h/2,0];
 b.at(0,0,0,long?0:Math.PI/2,()=>{
  for(const s of [-1,1]){const zf=s*hw,zi=s*(hw-.1);
   if(rich)for(let k=0;k<n;k++){const a=x0+k*seg+.07,c=a+seg-.14,zb=zf+s*.07,m=k%2?wall:wallL;
     b.quad([a,-sink,zf],[c,-sink,zf],[c,yk,zb],[a,yk,zb],m,ins).quad([a,yk,zb],[c,yk,zb],[c,yt,zi],[a,yt,zi],tint(m,1.1),ins);
     for(const x of [a,c]){const xi=x===a?[a+.3,h/2,zf]:[c-.3,h/2,zf];b.quad([x,-sink,zf],[x,yk,zb],[x,yk,zi-s*.06],[x,-sink,zi-s*.06],dark,xi);T3(b,[x,yk,zb],[x,yt,zi],[x,yk,zi-s*.06],dark,xi);}}
   else{b.quad([x0,-sink,zf],[-x0,-sink,zf],[-x0,yt,zi],[x0,yt,zi],wall,ins);for(let k=1;k<n&&k<12;k++){const x=x0+k*seg;b.quad([x-.07,-sink,zf+s*.02],[x+.07,-sink,zf+s*.02],[x+.07,yt,zi+s*.02],[x-.07,yt,zi+s*.02],dark,ins);}}
   if(rich)b.quad([x0+.05,-sink,zi-s*.02],[-x0-.05,-sink,zi-s*.02],[-x0-.05,yt,zi-s*.02],[x0+.05,yt,zi-s*.02],dark,ins);
   // the two glowing lines
   b.quad([x0+.25,yt,zi+s*.03],[-x0-.25,yt,zi+s*.03],[-x0-.25,yt+.18,zi+s*.03],[x0+.25,yt+.18,zi+s*.03],line,ins);
   b.quad([x0+.25,.46,zf+s*.09],[-x0-.25,.46,zf+s*.09],[-x0-.25,.6,zf+s*.11],[x0+.25,.6,zf+s*.11],foot,ins);
   // a bone rib over every seam, ending in a nub above the ridge line
   if(rich)for(let k=1;k<n;k++){const x=x0+k*seg,zr=zf+s*.19;T3(b,[x-.16,-sink,zf+s*.05],[x,-sink,zr],[x,yt+.1,zi+s*.17],bone,ins);T3(b,[x-.16,-sink,zf+s*.05],[x-.13,yt,zi+s*.04],[x,yt+.1,zi+s*.17],bone,ins);
     T3(b,[x+.16,-sink,zf+s*.05],[x,-sink,zr],[x,yt+.1,zi+s*.17],tint(bone,.8),ins);T3(b,[x+.16,-sink,zf+s*.05],[x+.13,yt,zi+s*.04],[x,yt+.1,zi+s*.17],tint(bone,.8),ins);
     T3(b,[x-.13,yt,zi+s*.04],[x,yt+.1,zi+s*.17],[x,h+.15,zi-s*.1],bone,ins);T3(b,[x+.13,yt,zi+s*.04],[x,yt+.1,zi+s*.17],[x,h+.15,zi-s*.1],tint(bone,.8),ins);T3(b,[x-.13,yt,zi+s*.04],[x+.13,yt,zi+s*.04],[x,h+.15,zi-s*.1],tint(bone,.6),[x,yt,zf+s*2]);}}
  // the ends
  for(const s of [-1,1]){const x=s*L/2;b.quad([x,-sink,-hw],[x,-sink,hw],[x,yt,hw-.1],[x,yt,-hw+.1],tint(wall,.9),ins);b.quad([x,yt,-hw+.1],[x,yt,hw-.1],[x,yt+.18,hw-.1],[x,yt+.18,-hw+.1],dark,ins);}
  // the ridge: overlapping scutes, each rising toward +x
  const yb=yt+.18,ze=hw-.02;if(hi){for(let k=0;k<n;k++){const a=x0+k*seg+(k?-.12:0),c=x0+(k+1)*seg,r0=[a+seg*.22,yb+.16,0],r1=[c-.04,h,(k%2?.12:-.12)*hw],m=k%2?top:tint(top,1.14);
    b.quad([a,yb,ze],[c,yb,ze],r1,r0,m,ins).quad([a,yb,-ze],[c,yb,-ze],r1,r0,tint(m,.9),ins);T3(b,[c,yb,ze],[c,yb,-ze],r1,tint(m,.75),ins);T3(b,[a,yb,ze],[a,yb,-ze],r0,m,ins);}
   b.quad([x0,yb,ze],[-x0,yb,ze],[-x0,yb,-ze],[x0,yb,-ze],dark,[0,h*2,0]);}
  else{b.quad([x0,yb,ze],[-x0,yb,ze],[-x0,h,0],[x0,h,0],top,ins).quad([x0,yb,-ze],[-x0,yb,-ze],[-x0,h,0],[x0,h,0],tint(top,.9),ins);for(const s of [-1,1])T3(b,[s*L/2,yb,ze],[s*L/2,yb,-ze],[s*L/2,h,0],top,ins);}
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
// an amber-lit core showing between them. HIGH <= 400 / LOW <= 150.
WK.model('wreck-cache',(b,o)=>{const {pal,tint,glow}=b.k,Wk=pal.wreck,hi=b.hi,s=Math.min(o.w/3,o.h/1.6,o.d/2.2),amber=glow(0xffb347,1.2),hot=glow(0xffd9a0,1.2);
 b.at(0,0,0,0,q=>{
  q.at(-.15,-.12,-.1,.3,c=>c.bev(0,0,0,1.5,.72,1.1,Wk.hull,{ch:.1}),.08,-.1);                       // the chassis chunk, sunk and tilted
  gem8(q,.22,.74,.14,.26,.3,.26,amber,.4,hi?6:4,hot);q.at(-.2,.7,.05,.8,c=>{c.cyl(0,-.34,0,.2,.68,Wk.track,{n:6,bot:true});c.cyl(0,-.08,0,.225,.16,amber,{n:6,top:false});},0,1.25);                                               // the lit core
  const plates=[[.86,.12,.12,.5,1.2,.9,.12,-.95],[-.86,.1,.16,-.6,1.1,.8,-.2,.85],[.1,.16,.52,1.5,1.0,.7,-1.0,.1],[.3,.1,-.56,.2,1.4,.62,.95,.12],[-.5,.5,-.1,2.2,.9,.6,.3,.5]];
  plates.slice(0,hi?5:3).forEach(([x,y,z,ry,w,d,rx,rz],k)=>q.at(x,y,z,ry,c=>{c.box(0,0,0,w,.07,d,k%2?Wk.rust:Wk.hull);if(hi&&k<3)c.box(w*.18,.07,0,.09,.06,d*.9,Wk.track);},rx,rz));
  q.at(-1.02,.3,-.5,.5,c=>c.cyl(0,-.11,0,.34,.22,Wk.track,{n:hi?8:6,bev:.04,bot:true}),.25,1.2);                // a road wheel on its side
  if(hi){q.tube([.5,.1,.45],[1.15,.9,.62],.05,Wk.wire,{n:4});q.tube([-.3,.5,.3],[-.9,1.2,.45],.045,Wk.rust,{n:4});q.cable([.2,.8,.1],[1.1,.15,-.5],.2,.025,Wk.wire);
   stone(q,1.2,-.05,-.75,.2,.24,.18,7,Wk.track,{n:4,prof:ROCK2,cuts:0});stone(q,-.5,-.05,.9,.16,.2,.15,9,Wk.rust,{n:4,prof:ROCK2,cuts:0});
   q.halo(.2,1.0,.12,1.4,0xffb347,.22);q.pool(.1,.06,.1,2,1.6,0xffb347,.14);}
 },0,0,s);
},{aoH:1.4,aoMin:.6});
// sector-flag (2.6 x 8 x 1): the sector's flag mast: a footed mast, a crossbar, a hanging banner panel that glows in the
// owner's colour on both faces and a top light. o.owner: 'owned' (teal, default) | 'friendly' (cyan) | 'hostile' (magenta;
// its banner hangs torn in three fangs). The banner faces +z and -z. HIGH <= 300 / LOW <= 100.
WK.model('sector-flag',(b,o)=>{const {pal,glow,tint}=b.k,M=pal.mil,hi=b.hi,hostile=o.owner==='hostile',hex=hostile?0xff2bd6:o.owner==='friendly'?0x22e6ff:0x2dffc4,c=tint(glow(hex,.8),.24),cHot=glow(hex,1.2),h=o.h,bw=Math.min(o.w-.3,2.3),fr=Math.min(o.d,o.w)*.46;
 // the foot: a hex plinth with three fins
 b.cyl(0,-.1,0,fr,.4,M.hull2,{n:6,bev:.06,r2:fr*.86});if(hi)b.cyl(0,.3,0,fr*.5,.5,M.hull,{n:6,r2:fr*.3});
 if(hi)for(let k=0;k<3;k++){const a=k*TAU/3+Math.PI/2;b.at(Math.cos(a)*fr*.5,.3,Math.sin(a)*fr*.5,-a,q=>q.box(0,0,0,fr*.7,.42,.07,M.trim));}
 // the mast, its crossbar and the top light
 const yc=h-.95;b.tube([0,.7,0],[0,h-.45,0],.1,M.trim,{n:hi?6:4,r2:.07});b.tube([-bw/2-.08,yc,0],[bw/2+.08,yc,0],.07,M.hull2,{n:hi?5:4,caps:true});
 gem8(b,0,h-.24,0,.17,.22,.17,cHot,.3,hi?6:4);if(hi)b.cyl(0,h-.5,0,.13,.1,M.gold,{n:6});
 if(hi){b.box(0,yc-.1,0,.26,.2,.2,M.dark);b.halo(0,h-.2,0,1,hex,.4);}
 // the banner: a dark frame plate with a glowing field on both faces
 const bh=Math.min(3.1,h*.4),y1=yc-.12,y0=y1-bh,x=bw/2,P=hostile?[[-x,y1],[x,y1],[x,y0+.5],[x*.62,y0],[x*.3,y0+.62],[0,y0+.12],[-x*.3,y0+.62],[-x*.62,y0],[-x,y0+.5]]:[[-x,y1],[x,y1],[x,y0+.2],[0,y0+.75],[-x,y0+.2]];
 const fan=(z,k,m,ins)=>{const cc=[0,(y1+y0)/2+.3,z];for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];T3(b,[cc[0]+(p[0]-cc[0])*k,cc[1]+(p[1]-cc[1])*k,z],[cc[0]+(q[0]-cc[0])*k,cc[1]+(q[1]-cc[1])*k,z],cc,m,ins);}};
 fan(.035,1,M.dark,[0,y0,-9]);fan(-.035,1,M.dark,[0,y0,9]);fan(.06,.88,c,[0,y0,-9]);fan(-.06,.88,c,[0,y0,9]);
 if(hi){for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];b.quad([p[0],p[1],-.035],[q[0],q[1],-.035],[q[0],q[1],.035],[p[0],p[1],.035],M.trim,[0,(y1+y0)/2,0]);}
  for(const z of [.07,-.07])for(const [yy,ww,hh] of [[y1-.5,bw*.25,.1],[y1-.78,bw*.15,.08]])b.quad([-ww,yy,z],[ww,yy,z],[ww,yy+hh,z],[-ww,yy+hh,z],M.dark,[0,yy,0]);}
},{aoH:6,aoMin:.6});
})(typeof globalThis!=='undefined'?globalThis:window);
