/* LUNAR Conquest world kit — PARASITE STRUCTURES (Session 5E-2d2, owner Nov 21). The hive, the hive mast, the raid cover
 * wall, the raid spire and the plasma battery. The Parasites are greedy humans, not aliens: everything here is HUMAN-BUILT,
 * stolen and over-armoured out of greed — gunmetal halls and masts taken from the colonies, plundered plating welded on in
 * mismatched patches (pale LDF ceramic, settler container sides with faded paint, hazard panels), loot crates, sacks and
 * containers stacked against the walls, other colonies' flags strung up as trophies, gaudy gold on whatever shows.
 * The infection is the ONLY organic part: a dark red growth swelling out of roofs, doors and breeches, and red veins
 * (ConquestWorldKit.PAR.red, pal.par.red) running down every seam into the ground. No chitin, horns, eyes or crystals.
 * This file loads after nature.js and owns the slots hive, hive-mast, cover-wall, raid-spire and par-battery.
 * Every model stays inside its slot box (js/conquest/slots.js). b.hi === false is LOW: silhouette and big colour blocks.
 * Glow rule (the solid shader): a vertex alpha in (0, 1] is a steady emission, (1, 2] a pulsing one. A face never blends a
 * pulsing vertex with anything else, and a surface-coded vertex (alpha < 0) never blends into a glow: use flatOf(). */
(function(root){
'use strict';
const WK=root.ConquestWorldKit,TAU=Math.PI*2,RED=WK.PAR.red;
const hz=(s,k)=>WK.hash((Math.imul((s|0)+11,2654435)+Math.imul((k|0)+3,40503))|0);   // deterministic 0..1
const flatOf=m=>({c:m.c,a:0,j:m.j||0});          // the same colour with no surface code (safe to blend into a steady glow)
const pt=(p,m)=>[p[0],p[1],p[2],m];              // a point that carries its own vertex material
const lerp3=(a,c,t)=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t,a[2]+(c[2]-a[2])*t];
const clamp=(v,a,c)=>v<a?a:v>c?c:v;

// ------------------------------------------------------------------ triangle tools --------------------------------------
// one flat triangle. m = material, or ny => material; a point's 4th element is its own vertex material. ins = a point the
// face looks away from.
function T3(b,p,q,r,m,ins){let nx=(q[1]-p[1])*(r[2]-p[2])-(q[2]-p[2])*(r[1]-p[1]),ny=(q[2]-p[2])*(r[0]-p[0])-(q[0]-p[0])*(r[2]-p[2]),nz=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
 const l=Math.hypot(nx,ny,nz);if(l<1e-9)return b;nx/=l;ny/=l;nz/=l;
 let f=false;if(ins)f=nx*((p[0]+q[0]+r[0])/3-ins[0])+ny*((p[1]+q[1]+r[1])/3-ins[1])+nz*((p[2]+q[2]+r[2])/3-ins[2])<0;if(f){nx=-nx;ny=-ny;nz=-nz;}
 const M=typeof m==='function'?m(ny,p,q,r):m;
 b.jit=1+(WK.hash((Math.round(nx*9)*73+Math.round(ny*9)*179+Math.round(nz*9)*283)|0)-.5)*2;   // one tone per facet plane
 const i0=b._v(p[0],p[1],p[2],nx,ny,nz,p[3]||M),i1=b._v(q[0],q[1],q[2],nx,ny,nz,q[3]||M),i2=b._v(r[0],r[1],r[2],nx,ny,nz,r[3]||M);
 if(f)b.cur.I.push(i0,i2,i1);else b.cur.I.push(i0,i1,i2);return b;}
const cen=R=>{let x=0,y=0,z=0;for(const p of R){x+=p[0];y+=p[1];z+=p[2];}return [x/R.length,y/R.length,z/R.length];};
// faceted skin over rings of [x,y,z] points (one vertex count): 2n triangles per band, n for an apex / nadir fan
function facets(b,R,m,o={}){const n=R[0].length,wrap=(A,vm)=>vm?A.map(p=>pt(p,vm)):A;
 for(let r=0;r<R.length-1;r++){const A=wrap(R[r],o.bandV&&o.bandV(r,0)),B=wrap(R[r+1],o.bandV&&o.bandV(r,1)),ca=cen(A),cb=cen(B),ins=[(ca[0]+cb[0])/2,(ca[1]+cb[1])/2,(ca[2]+cb[2])/2],bm=(o.bandM&&o.bandM(r))||m;
  for(let i=0;i<n;i++){const j=(i+1)%n;if(o.stag?(r&1):((i+r)&1)){T3(b,A[i],A[j],B[j],bm,ins);T3(b,A[i],B[j],B[i],bm,ins);}else{T3(b,A[i],A[j],B[i],bm,ins);T3(b,A[j],B[j],B[i],bm,ins);}}}
 if(o.apex){const A=wrap(R[R.length-1],o.apexRingM),c=cen(A),ins=o.apexIns||[c[0]-(o.apex[0]-c[0])*.3,c[1]-(o.apex[1]-c[1])*.3,c[2]-(o.apex[2]-c[2])*.3];for(let i=0;i<n;i++)T3(b,A[i],A[(i+1)%n],o.apex,o.apexM||m,ins);}
 if(o.nadir){const A=wrap(R[0],o.nadirRingM),c=cen(A),ins=o.nadirIns||[c[0]-(o.nadir[0]-c[0])*.3,c[1]-(o.nadir[1]-c[1])*.3,c[2]-(o.nadir[2]-c[2])*.3];for(let i=0;i<n;i++)T3(b,A[i],A[(i+1)%n],o.nadir,o.nadirM||m,ins);}
 return b;}
const shade=(m,top,low)=>ny=>ny>.42?top:ny<-.18?low:m;   // material by facet direction: lighter on top, darker underneath
// an irregular faceted lump inside the box (x ± rx, y .. y + ry, z ± rz): n sides, o.prof rings [height, radius]
function blob(b,x,y,z,rx,ry,rz,o){const n=o.n||6,P=o.prof||[[0,.9],[.28,1],[.72,.62]],sd=o.seed||1,jit=o.jit??.2,yaw=o.yaw||0,lx=o.lx||0,lz=o.lz||0,R=[];
 const put=(ux,t,uz,m)=>{const tt=Math.max(o.nadir?-1:0,t),q=[x+ux*rx+lx*tt,y+ry*tt,z+uz*rz+lz*tt];if(m)q[3]=m;return q;};
 P.forEach(([t,rr],k)=>{const ring=[];for(let i=0;i<n;i++){const a=yaw+(i+(k%2)*.5+(hz(sd,k*31+i)-.5)*.4)/n*TAU,f=rr*(1-jit*hz(sd,k*57+i+100))*(o.zig&&i%2?1-o.zig:1),tt=t+(k||o.nadir?(hz(sd,k*91+i+200)-.5)*(o.yj??.1):0);
   ring.push(put(Math.cos(a)*f,Math.min(tt,.97),Math.sin(a)*f,o.vm?o.vm(k,i):null));}R.push(ring);});
 return facets(b,R,o.m,{stag:true,apex:o.apex===false?null:put(o.ax||0,o.at??1,o.az||0,o.apexV),apexM:o.apexM,nadir:o.nadir?put(o.nx||0,o.nt??0,o.nz||0,o.nadirV):null,nadirM:o.nadirM});}
// a faceted tube through points: rad = number | array | (t, k) => radius; 2n triangles a segment (+ n with o.tip / o.butt)
function sweep(b,pts,rad,n,m,o={}){const R=[],L=pts.length;let ux=o.ref?o.ref[0]:1,uy=o.ref?o.ref[1]:0,uz=o.ref?o.ref[2]:0;
 for(let k=0;k<L;k++){const p=pts[k],a=o.closed?pts[(k+L-1)%L]:pts[Math.max(0,k-1)],c=o.closed?pts[(k+1)%L]:pts[Math.min(L-1,k+1)];let dx=c[0]-a[0],dy=c[1]-a[1],dz=c[2]-a[2];const l=Math.hypot(dx,dy,dz)||1;dx/=l;dy/=l;dz/=l;
  if(k===0&&!o.ref&&Math.abs(dx)>.85){ux=0;uy=0;uz=1;}
  const t=ux*dx+uy*dy+uz*dz;ux-=t*dx;uy-=t*dy;uz-=t*dz;const ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;const vx=dy*uz-dz*uy,vy=dz*ux-dx*uz,vz=dx*uy-dy*ux;
  const r=typeof rad==='function'?rad(L>1?k/(L-1):0,k):Array.isArray(rad)?rad[k]:rad,ring=[],tw=(o.twist||0)*k+(o.rot||0),sq=o.sq||1;
  for(let i=0;i<n;i++){const an=i/n*TAU+tw,cs=Math.cos(an)*r,sn=Math.sin(an)*r*sq,q=[p[0]+ux*cs+vx*sn,p[1]+uy*cs+vy*sn,p[2]+uz*cs+vz*sn];if(o.vm)q[3]=o.vm(k,i);ring.push(q);}R.push(ring);}
 if(o.closed)R.push(R[0]);
 return facets(b,R,m,{apex:o.tip,apexM:o.tipM,apexRingM:o.tipRingM,apexIns:o.tipIns,nadir:o.butt,nadirM:o.buttM,bandM:o.bandM,bandV:o.bandV});}
// an 8-triangle gem (two pyramids): lamps, rivet heads, hot cores
function gem8(b,x,y,z,rx,ry,rz,m,rot=0,n=4,mTop){const R=[];for(let i=0;i<n;i++){const a=i/n*TAU+rot;R.push([x+Math.cos(a)*rx,y,z+Math.sin(a)*rz]);}return facets(b,[R],m,{apex:[x,y+ry,z],apexM:mTop||m,nadir:[x,y-ry,z]});}
// a smooth-shaded skin over a grid of rings G[r][i] = [x,y,z(,material)] closed around i: shared vertices, normals from the
// grid, facing away from o.c. 2n triangles per band.
function skin(b,G,m,o={}){const R=G.length,n=G[0].length,mf=typeof m==='function'?m:()=>m,c=o.c||[0,0,0],ids=[],I=b.cur.I;
 for(let r=0;r<R;r++){ids.push([]);for(let i=0;i<n;i++){const p=G[r][i],a=G[r][(i+1)%n],e=G[r][(i+n-1)%n],u=G[Math.min(R-1,r+1)][i],d=G[Math.max(0,r-1)][i];
   const tx=a[0]-e[0],ty=a[1]-e[1],tz=a[2]-e[2],sx=u[0]-d[0],sy=u[1]-d[1],sz=u[2]-d[2];let nx=ty*sz-tz*sy,ny=tz*sx-tx*sz,nz=tx*sy-ty*sx;
   if(Math.hypot(nx,ny,nz)<1e-9){nx=p[0]-c[0];ny=p[1]-c[1];nz=p[2]-c[2];}if(nx*(p[0]-c[0])+ny*(p[1]-c[1])+nz*(p[2]-c[2])<0){nx=-nx;ny=-ny;nz=-nz;}
   ids[r].push(b._v(p[0],p[1],p[2],nx,ny,nz,p[3]||mf(r,i)));}}
 for(let r=0;r<R-1;r++)for(let i=0;i<n;i++){const j=(i+1)%n,A=G[r][i],B=G[r][j],C=G[r+1][j],gx=(B[1]-A[1])*(C[2]-A[2])-(B[2]-A[2])*(C[1]-A[1]),gy=(B[2]-A[2])*(C[0]-A[0])-(B[0]-A[0])*(C[2]-A[2]),gz=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);
   const a=ids[r][i],bq=ids[r][j],cq=ids[r+1][j],d=ids[r+1][i];if(gx*(A[0]-c[0])+gy*(A[1]-c[1])+gz*(A[2]-c[2])>=0)I.push(a,bq,cq,a,cq,d);else I.push(a,cq,bq,a,d,cq);}
 return b;}
// a smooth curve through control points (Catmull-Rom), seg pieces a span
function curve(P,seg){const out=[],n=P.length;for(let i=0;i<n-1;i++){const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(n-1,i+2)];
  for(let s=0;s<seg;s++){const t=s/seg,t2=t*t,t3=t2*t,q=[0,0,0];for(let k=0;k<3;k++)q[k]=.5*(2*p1[k]+(p2[k]-p0[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(3*p1[k]-p0[k]-3*p2[k]+p3[k])*t3);out.push(q);}}
 out.push(P[n-1].slice(0,3));return out;}

// ------------------------------------------------------------------ the infection ---------------------------------------
// a red vein through control points, thinning to a point (o.open: it runs on into something), knotted along its length.
// Default: a glowing three-sided tube, 6 triangles a segment. o.up = the normal of the surface it lies on (a vector, or
// point => vector): a low ridge with no underside, 4 triangles a segment.
function vein(b,P,r0,r1,o={}){const pts=o.raw?P:curve(P,o.seg||(b.hi?3:1)),L=pts.length,m=o.m||b.k.pal.par.red,sw=o.swell??.2,ph=o.ph??P[0][0]*3+P[0][2]*5,
  rf=typeof r0==='function'?r0:(t=>(r0+(r1-r0)*t)*(1+sw*Math.sin(t*(L-1)*1.7+ph)));
 if(!o.up)return sweep(b,o.open?pts:pts.slice(0,L-1),rf,o.n||3,m,{rot:o.rot||.5,ref:o.ref,sq:o.sq,tip:o.open?null:pts[L-1]});
 let pl=null,pr=null,pa=null;const rise=o.rise??.75;
 for(let k=0;k<L;k++){const p=pts[k],a=pts[Math.max(0,k-1)],c=pts[Math.min(L-1,k+1)],u=typeof o.up==='function'?o.up(p):o.up;let dx=c[0]-a[0],dy=c[1]-a[1],dz=c[2]-a[2];const dl=Math.hypot(dx,dy,dz)||1;dx/=dl;dy/=dl;dz/=dl;
  let sx=dy*u[2]-dz*u[1],sy=dz*u[0]-dx*u[2],sz=dx*u[1]-dy*u[0];const sl=Math.hypot(sx,sy,sz)||1,r=k===L-1&&!o.open?0:rf(k/(L-1));sx*=r/sl;sy*=r/sl;sz*=r/sl;
  const l=[p[0]-sx,p[1]-sy,p[2]-sz],rr=[p[0]+sx,p[1]+sy,p[2]+sz],ap=[p[0]+u[0]*r*rise,p[1]+u[1]*r*rise,p[2]+u[2]*r*rise];
  if(k){const ins=[p[0]-u[0]*9,p[1]-u[1]*9,p[2]-u[2]*9];if(r>0){b.quad(pl,l,ap,pa,m,ins);b.quad(pa,ap,rr,pr,m,ins);}else{T3(b,pl,p,pa,m,ins);T3(b,pa,p,pr,m,ins);}}pl=l;pr=rr;pa=ap;}
 return b;}
// a vein crawling over flat ground from a to c: it wanders like a root, lies low and forks (o.lim(point) keeps forks inside)
function creep(b,a,c,r,sd,o={}){const dx=c[0]-a[0],dz=c[2]-a[2],L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L,nx=-uz,nz=ux,n=o.n||(b.hi?4:2),P=[],amp=(o.wob??.13)*L,f=1.3+hz(sd,1),p0=hz(sd,2)*TAU,up=[0,1,0];
 for(let k=0;k<=n;k++){const t=k/n,w=Math.sin(t*f*Math.PI+p0)*amp*Math.min(1,t*2.5);P.push([a[0]+dx*t+nx*w,a[1]+(c[1]-a[1])*t,a[2]+dz*t+nz*w]);}
 vein(b,P,r,r*.3,{seg:b.hi?(o.seg||3):1,up,m:o.m});
 if(b.hi&&o.fork!==false&&L>2){const k=1+((hz(sd,40)*(n-1))|0),s=hz(sd,41)<.5?-1:1,p=P[Math.min(k,n-1)],l=L*(.22+.16*hz(sd,42)),q=[p[0]+ux*l*.75+nx*s*l*.66,c[1],p[2]+uz*l*.75+nz*s*l*.66];
  if(!o.lim||o.lim(q))vein(b,[p,[p[0]+ux*l*.5+nx*s*l*.2,(p[1]+c[1])/2,p[2]+uz*l*.5+nz*s*l*.2],q],r*.6,r*.2,{seg:2,up,m:o.m});}
 return b;}
// the growth: a swollen, lumpy mass of dark red flesh (smooth skin), paler on its swellings, darkest in its folds.
// c = centre, r = radii. t0 .. t1 = the part of the body kept, from the underside (0) to the crown (1). o.lx / o.lz lean
// its crown. Returns surf(ph, t, k) = a point on it (k = how far proud): veins and bulbs ride on the surface.
function mass(b,c,r,sd,o={}){const P=b.k.pal.par,na=o.na||(b.hi?18:10),nr=o.nr||(b.hi?9:5),t0=o.t0??0,t1=o.t1??1,lob=o.lob??.16,lx=o.lx||0,lz=o.lz||0,M=o.M||[P.fleshD,P.flesh,P.fleshL];
 const f=(ph,th)=>1+lob*(Math.sin(ph*3+sd)*Math.sin(th*3+sd*.7)+.55*Math.sin(ph*5+sd*2.1+th*2)*Math.sin(th*4+1.3)+.3*Math.sin(ph*2-th*5+sd));
 const surf=(ph,t,k=1)=>{const th=(t0+(t1-t0)*t)*Math.PI,s=Math.sin(th),up=-Math.cos(th),q=f(ph,th)*k,h=(up+1)/2;return [c[0]+Math.cos(ph)*r[0]*s*q+lx*h*h,c[1]+up*r[1]*q,c[2]+Math.sin(ph)*r[2]*s*q+lz*h*h];};
 const G=[];for(let j=0;j<=nr;j++){const ring=[];for(let i=0;i<na;i++){const ph=i/na*TAU,th=(t0+(t1-t0)*j/nr)*Math.PI,v=f(ph,th),p=surf(ph,j/nr);p[3]=v<1-lob*.4?M[0]:v>1+lob*.45?M[2]:M[1];ring.push(p);}G.push(ring);}
 skin(b,G,M[1],{c:[c[0]+lx*.25,c[1],c[2]+lz*.25]});return surf;}
// a heaving bulb: a swelling of the growth, split at its crown by glowing fissures (the hot core showing through).
// (x, y, z) = the middle of its foot, r = its radius, o.sy its height in radii, o.lx / o.lz how far its crown leans.
function bulb(b,x,y,z,r,sd,o={}){const P=b.k.pal.par,sy=o.sy||1.5,lx=o.lx||0,lz=o.lz||0,hi=b.hi;
 const S=mass(b,[x,y+r*sy*.5,z],[r*(o.sx||1),r*sy*.5,r*(o.sz||1)],sd,{na:o.na||(hi?8:6),nr:o.nr||(hi?5:3),lob:o.lob??.2,lx,lz,t0:o.t0??.12});
 if(o.core!==false){const n=hi?3:2,a0=hz(sd,7)*TAU;for(let k=0;k<n;k++){const ph=a0+k*TAU/n+(hz(sd,k+9)-.5)*.6,pts=[];for(let j=0;j<=(hi?3:2);j++){const t=.985-.18*j*(hi?1:1.5);pts.push(S(ph+.28*Math.sin(j*2+k),t,1.05));}
   vein(b,pts,r*.13,r*.03,{raw:true,m:P.redHot,swell:0});}}
 return S;}

// ------------------------------------------------------------------ plunder ---------------------------------------------
// a cheap box: two triangles a face, only the faces not named in `skip` (t top, b bottom, f +z, k -z, r +x, l -x)
function qb(b,x,y,z,w,h,d,m,skip=''){const x0=x-w/2,x1=x+w/2,y1=y+h,z0=z-d/2,z1=z+d/2,c=[x,y+h/2,z],t=o=>(typeof m==='function'?m(o):m);
 if(!skip.includes('t'))b.quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],t('t'),c);if(!skip.includes('b'))b.quad([x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1],t('b'),c);
 if(!skip.includes('f'))b.quad([x0,y,z1],[x1,y,z1],[x1,y1,z1],[x0,y1,z1],t('f'),c);if(!skip.includes('k'))b.quad([x0,y,z0],[x1,y,z0],[x1,y1,z0],[x0,y1,z0],t('k'),c);
 if(!skip.includes('r'))b.quad([x1,y,z0],[x1,y,z1],[x1,y1,z1],[x1,y1,z0],t('r'),c);if(!skip.includes('l'))b.quad([x0,y,z0],[x0,y,z1],[x0,y1,z1],[x0,y1,z0],t('l'),c);return b;}
// a square beam from p to q with a w x d section (legs, girders, poles): 8 triangles (+ 4 with o.caps)
function beam(b,p,q,w,d,m,o={}){let dx=q[0]-p[0],dy=q[1]-p[1],dz=q[2]-p[2];const L=Math.hypot(dx,dy,dz)||1;dx/=L;dy/=L;dz/=L;const u=o.up||(Math.abs(dy)>.92?[1,0,0]:[0,1,0]);
 let sx=dy*u[2]-dz*u[1],sy=dz*u[0]-dx*u[2],sz=dx*u[1]-dy*u[0];const sl=Math.hypot(sx,sy,sz)||1;sx/=sl;sy/=sl;sz/=sl;const tx=sy*dz-sz*dy,ty=sz*dx-sx*dz,tz=sx*dy-sy*dx,w2=o.w2??w,d2=o.d2??d;
 const C=(P,ww,dd)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,c])=>[P[0]+sx*a*ww/2+tx*c*dd/2,P[1]+sy*a*ww/2+ty*c*dd/2,P[2]+sz*a*ww/2+tz*c*dd/2]),A=C(p,w,d),B=C(q,w2,d2),mid=lerp3(p,q,.5);
 for(let i=0;i<4;i++){const j=(i+1)%4;b.quad(A[i],A[j],B[j],B[i],typeof m==='function'?m(i):m,mid);}
 if(o.caps){const cm=o.capM||(typeof m==='function'?m(0):m);b.quad(B[0],B[1],B[2],B[3],cm,mid);if(o.caps>1)b.quad(A[0],A[1],A[2],A[3],cm,mid);}return b;}
// an armour plate welded on a wall that faces +z of the current frame: x0 .. x1, from y0 up to yL (at x0) and yR (at x1),
// the wall at z, the plate proud of it by p. HIGH gives it its thickness (top and both ends).
function slab(b,x0,x1,y0,yL,yR,z,p,m,o={}){const zf=z+p,tk=b.k.tint;b.part();b.quad([x0,y0,zf],[x1,y0,zf],[x1,yR,zf],[x0,yL,zf],m,[(x0+x1)/2,y0,z-9]);
 if(b.hi&&!o.thin){const e=o.edge||tk(m,.6),mid=[(x0+x1)/2,(y0+Math.min(yL,yR))/2,z];b.quad([x0,yL,zf],[x1,yR,zf],[x1,yR,z],[x0,yL,z],o.top||tk(m,1.18,.01),mid);b.quad([x0,y0,zf],[x0,yL,zf],[x0,yL,z],[x0,y0,z],e,mid);b.quad([x1,y0,zf],[x1,yR,zf],[x1,yR,z],[x1,y0,z],e,mid);
  if(o.bot)b.quad([x0,y0,zf],[x1,y0,zf],[x1,y0,z],[x0,y0,z],e,mid);if(o.back)b.quad([x0,y0,z],[x1,y0,z],[x1,yR,z],[x0,yL,z],e,[mid[0],mid[1],z+9]);}return b;}
// n slanted warning bars over x0 .. x1, y0 .. y1 on a face looking along +z (the yellow goes under them)
function bars(b,x0,x1,y0,y1,z,n,m){const bw=(x1-x0)/(2*n);for(let k=0;k<n;k++){const a=x0+2*k*bw;b.quad([a,y0,z],[a+bw,y0,z],[a+2*bw,y1,z],[a+bw,y1,z],m,[a,y0,z-9]);}return b;}
// a bolt head / weld tack on a face looking along +z
const tack=(b,x,y,z,s,m)=>b.quad([x-s,y,z],[x,y-s,z],[x+s,y,z],[x,y+s,z],m,[x,y,z-9]);
// The plundered plate kinds: where each was taken from. [material, edge]
const KINDS=['mil','cont','haz','hull','rust','cont','mil','milD'];
function plateMat(b,kind,ci){const P=b.k.pal.par;return kind==='mil'?P.plateMil:kind==='milD'?P.plateMilD:kind==='cont'?P.plateSet[ci%P.plateSet.length]:kind==='haz'?P.hazard:kind==='hull'?P.ironL:P.rust;}
// what was painted or bolted on a plate before it was stolen (HIGH), on its front at z
function dress(b,kind,x0,x1,y0,y1,z,ci){const P=b.k.pal.par,w=x1-x0,h=y1-y0,tk=b.k.tint,ins=[(x0+x1)/2,y0,z-9],Q=(xa,xb,ya,yb,m)=>b.quad([xa,ya,z],[xb,ya,z],[xb,yb,z],[xa,yb,z],m,ins);
 if(kind==='haz')bars(b,x0+w*.04,x1-w*.04,y0+h*.05,y1-h*.05,z,Math.max(2,Math.round(w/1.1)),P.hazardD);
 else if(kind==='mil'){Q(x0+w*.08,x1-w*.08,y1-h*.24,y1-h*.14,P.tankBand);Q(x0+w*.08,x0+w*.3,y1-h*.4,y1-h*.3,P.plateMilD);}          // the LDF's blue band and unit block
 else if(kind==='milD'){Q(x0+w*.1,x1-w*.1,y0+h*.44,y0+h*.5,P.plateMil);}
 else if(kind==='cont'){const n=Math.max(2,Math.round(w/.9)),rm=tk(P.plateSet[ci%P.plateSet.length],.66);for(let k=1;k<n;k++){const x=x0+w*k/n;Q(x-.07,x+.07,y0+h*.04,y1-h*.04,rm);}Q(x1-w*.42,x1-w*.1,y1-h*.3,y1-h*.18,P.tank);}   // corrugation ribs and a faded stencil
 else if(kind==='hull'){Q(x0,x1,y0,y0+h*.2,P.rust);for(let k=0;k<3;k++)tack(b,x0+w*(.2+.3*k),y1-h*.12,z+.01,.07,P.weld);}
 return b;}
// a loot crate (10 triangles; HIGH adds a strap and a lid line)
function crate(b,x,y,z,w,h,d,ry,m,o={}){return b.at(x,y,z,ry,q=>{q.part();qb(q,0,0,0,w,h,d,m,'b');
  if(q.hi&&!o.plain){const s=o.strap||q.k.pal.par.strap;qb(q,w*.22,0,0,w*.12,h+.025,d+.05,s,'blr');q.quad([-w/2,h*.74,d/2+.012],[w/2,h*.74,d/2+.012],[w/2,h*.8,d/2+.012],[-w/2,h*.8,d/2+.012],q.k.tint(m,.5),[0,0,0]);}},o.rx||0,o.rz||0);}
// a loot sack: a slumped lump of cloth (15 triangles)
const sack=(b,x,y,z,r,sd,m)=>blob(b,x,y,z,r,r*1.15,r*.9,{n:5,prof:[[0,1],[.55,.8]],seed:sd,m:shade(m||b.k.pal.par.sack,b.k.tint(m||b.k.pal.par.sack,1.25),b.k.tint(m||b.k.pal.par.sack,.6)),jit:.14,yaw:sd});
// a looted flag hanging from its top edge a -> c (world points), drop h: cloth seen from both sides, a band of a second
// colour, a torn hem. o.sway pushes the hem out of plumb.
function flag(b,a,c,h,m,m2,o={}){const dx=c[0]-a[0],dz=c[2]-a[2],L=Math.hypot(dx,dz)||1,nx=-dz/L,nz=dx/L,sw=o.sway||0,hem=o.hem??.74,
  P=(u,v,k)=>[a[0]+dx*u+nx*(sw*v*v+k),a[1]+(c[1]-a[1])*u-h*v,a[2]+dz*u+nz*(sw*v*v+k)];
 for(const s of [1,-1]){const e=.014*s,ins=[a[0]+dx*.5-nx*s*9,a[1]-h*.5,a[2]+dz*.5-nz*s*9];b.quad(P(0,0,e),P(1,0,e),P(1,hem,e),P(0,hem,e),m,ins);
  if(b.hi){T3(b,P(0,hem,e),P(.5,hem,e),P(.16,1,e),m,ins);T3(b,P(.5,hem,e),P(1,hem,e),P(.86,.96,e),m,ins);if(m2)b.quad(P(0,.2,e*2.4),P(1,.2,e*2.4),P(1,.42,e*2.4),P(0,.42,e*2.4),m2,ins);}
  else if(m2)b.quad(P(0,.2,e*2.4),P(1,.2,e*2.4),P(1,.42,e*2.4),P(0,.42,e*2.4),m2,ins);}
 return b;}
// run fn in a frame scaled to the placement's own size (the models are drawn at their slot size)
function fit(b,sx,sy,sz,fn){const T=b.k.T;b.st.push(new T.Matrix4().multiplyMatrices(b.M,new T.Matrix4().makeScale(sx,sy,sz)));try{fn();}finally{b.st.pop();}}
// ------------------------------------------------------------------ cover-wall ------------------------------------------
// cover-wall (EXACT box o.w x o.h x o.d, default 18 x 5 x 3; all art inside the box in plan): a barricade welded from
// plundered armour, the collision box of a raid obstacle, so it FILLS its box: a dark steel bulkhead between four corner
// posts, every face plated with big mismatched plates (LDF ceramic with its blue band, settler container sides with faded
// paint, hazard panels, tank hull sections, rust sheet) of unequal width and height, strongback girders on the long faces,
// loot crates and a sack lashed on its flat top, a looted flag draped over one face, and a thin red vein glowing in the
// seams between the plates (the only glow: the wall reads as steel). Plates, loot and flag change with o.seed and the size.
// The long axis is x when w >= d, else z. o.sink (default 1.2) = how far it runs below y = 0.
// HIGH <= 400 / LOW <= 100.
WK.model('cover-wall',(b,o)=>{const {pal,tint}=b.k,P=pal.par,hi=b.hi,long=o.w>=o.d,L=long?o.w:o.d,T=long?o.d:o.w,h=o.h,sink=o.sink??1.2,sd=(o.seed|0)*7+Math.round(L*3+T*5);
 const PW=clamp(T*.2,.5,.8),REC=.32,area=2*(L+T),rich=area<=44;   // corner post width; how far the bulkhead stands behind the box planes
 b.at(0,0,0,long?0:Math.PI/2,()=>{
  // the bulkhead and the four corner posts (they stand a little proud of the top)
  qb(b,0,-sink,0,L-2*REC,h+sink,T-2*REC,o2=>o2==='t'?P.iron:P.weld,'b');
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sz],k)=>{const ph=h+.12+.26*hz(sd,k+70);b.part();qb(b,sx*(L-PW)/2,-sink,sz*(T-PW)/2,PW,ph+sink,PW,P.ironD,hi?'b':'b'+(sx>0?'l':'r')+(sz>0?'k':'f'));});
  // the four faces: bays of plates between the posts
  let pi=0,last=-1;
  for(let f=0;f<4;f++){const Lf=f%2?T:L,half=(f%2?L:T)/2,zc=half-REC,x0=-Lf/2+PW,x1=Lf/2-PW,span=x1-x0;if(span<.6)continue;
   b.at(0,0,0,f*Math.PI/2,q=>{const np=Math.max(1,Math.round(span/(hi?3.1:3.6))),wt=[],X=[x0];let sum=0;for(let k=0;k<np;k++){wt.push(1+.5*(hz(sd,f*20+k)-.5));sum+=wt[k];}for(let k=0;k<np;k++)X.push(k===np-1?x1:X[k]+span*wt[k]/sum);
    const g=hi?.07:.08,tops=[];
    for(let k=0;k<np;k++){let ki=(hz(sd,f*31+k*7+5)*KINDS.length)|0;if(ki===last)ki=(ki+1)%KINDS.length;last=ki;const kind=KINDS[ki],ci=(hz(sd,f*13+k*3)*5)|0,m=plateMat(q,kind,ci),p=.09+.17*hz(sd,f*17+k+90);
     const xa=X[k]+(k?g:.03),xb=X[k+1]-(k<np-1?g:.03),drop=.1+.75*hz(sd,f*11+k+33),tl=h-drop*(hi?1:.5),tr=hi?clamp(tl+(hz(sd,f*19+k+7)-.5)*.5,h-.95,h-.06):tl;tops.push(Math.min(tl,tr));
     slab(q,xa,xb,-sink,tl,tr,zc,p,m);
     if(hi){dress(q,kind,xa,xb,.12,Math.min(tl,tr)-.08,zc+p+.03,ci);
      // a smaller patch welded over a big plate, tack welds on the others
      if(pi%3===1&&xb-xa>2.2){const pk=KINDS[(ki+3)%KINDS.length],px=xa+(xb-xa)*(.18+.2*hz(sd,pi+50)),pw=(xb-xa)*.46,py=h*(.16+.2*hz(sd,pi+60)),ph=h*.3;q.at(px+pw/2,py+ph/2,zc+p,0,r=>slab(r,-pw/2,pw/2,-ph/2,ph/2,ph/2,0,.07,plateMat(r,pk,ci+2),{bot:true}),0,(hz(sd,pi+80)-.5)*.3);}
      else if(rich||pi%2===0)q.detail(()=>{for(const [u,v] of [[.1,.9],[.9,.9]])tack(q,xa+(xb-xa)*u,-.1+(Math.min(tl,tr)+.1)*v,zc+p+.03,.09,P.weld);});}
     pi++;}
    // the infection in the seams: a thin vein between two plates, kinked like a root
    for(let k=1;k<np;k++){const x=X[k],y1=Math.min(tops[k-1],tops[k])-.15,z=zc+.04,w=hi?.055:.075,K=hi?[[0,-.2],[.04,.33],[-.035,.68],[.02,1]]:[[0,-.2],[0,1]];
     for(let j=1;j<K.length;j++){const a=K[j-1],c=K[j],ya=-.2+(y1+.2)*Math.max(0,a[1]),yb=-.2+(y1+.2)*c[1];q.quad([x+a[0]-w,j===1?-sink*.3:ya,z],[x+a[0]+w,j===1?-sink*.3:ya,z],[x+c[0]+w,yb,z],[x+c[0]-w,yb,z],P.red,[x,ya,z-9]);}}
    // strongback girders on the long faces (HIGH): a rusty I-beam welded upright across the plates, short of the top
    if(hi&&Lf>=11){const ng=Lf>=20?2:1;for(let k=0;k<ng;k++){const x=x0+span*(ng===1?.5+.16*(hz(sd,f+44)-.5):(.3+.4*k)),gh=h-.5-.5*hz(sd,f*3+k);q.part();qb(q,x,-sink,half-.17,.3,gh+sink,.34,k%2?P.rust:P.iron,'bk');}}
   });}
  // the loot on the flat top and the flag over one face
  {const nl=hi?(rich?3:2):1,along=L-2*PW-1.2;for(let k=0;k<nl;k++){const x=-along/2+along*(nl===1?.3:(k+.15+.7*hz(sd,k+120))/nl),z=(T-2*REC-1.1)*(hz(sd,k+130)-.5)*.8,s=clamp(T*.26,.62,1.05)*(.85+.3*hz(sd,k+140));
    if(k===1&&hi){sack(b,x,h,z,s*.52,sd+k);sack(b,x+s*.8,h,z+.1,s*.42,sd+k+3,tint(P.sack,.8));}else crate(b,x,h,z,s*1.25,s*.72,s*.9,(hz(sd,k+150)-.5)*.9,k%2?P.crateD:P.crate,{plain:!hi});}
   const fx=(L/2-PW-1.5)*(hz(sd,160)<.5?-1:1)*(.3+.5*hz(sd,161)),fz=T/2-.02,fm=hz(sd,162)<.5?P.flagLDF:P.flagSet[(hz(sd,163)*5)|0],fw=Math.min(1.9,L*.14);
   b.quad([fx-fw/2,h+.02,fz-REC-.5],[fx+fw/2,h+.02,fz-REC-.5],[fx+fw/2,h+.02,fz],[fx-fw/2,h+.02,fz],fm,[fx,h-9,fz]);
   b.quad([fx-fw/2,h+.02,fz],[fx+fw/2,h+.02,fz],[fx+fw/2,h-h*.42,fz],[fx-fw/2,h-h*.36,fz],fm,[fx,h,fz-9]);
   if(hi)b.quad([fx-fw/2,h-h*.12,fz+.012],[fx+fw/2,h-h*.12,fz+.012],[fx+fw/2,h-h*.22,fz+.012],[fx-fw/2,h-h*.2,fz+.012],fm===P.flagLDF?P.flagLDF2:P.strap,[fx,h,fz-9]);}
 });
},{aoH:4,aoMin:.55});
// a frame at angle a (from +x toward +z) and radius r whose +z looks outward; rx < 0 leans its top inward
const rad=(b,a,r,y,fn,rx=0,rz=0)=>b.at(Math.cos(a)*r,y,Math.sin(a)*r,-a+Math.PI/2,fn,rx,rz);
// a stolen gas tank standing upright: pale shell, the colony's blue band, a domed head
function tank(b,x,y,z,r,h,o={}){const P=b.k.pal.par,n=b.hi?8:6,C=(rr,yy)=>({p:b.k.circ(rr,n,x,z,rr,o.rot||0),y:yy}),m=o.m||P.tank;b.part();
 b.loft(b.hi?[C(r,y),C(r,y+h*.5),C(r,y+h*.64),C(r,y+h*.86)]:[C(r,y),C(r,y+h*.86)],k=>k===1?(o.band||P.tankBand):m,{smooth:true,top:false});b.dome(x,y+h*.86,z,r,h*.14,r,m,{n,rings:2});return b;}
// a dish aerial: rim centre c, facing the unit direction d, radius r (2n triangles)
function dish(b,c,d,r,m,m2){const n=b.hi?8:6,u=Math.abs(d[1])>.9?[1,0,0]:[0,1,0];let sx=d[1]*u[2]-d[2]*u[1],sy=d[2]*u[0]-d[0]*u[2],sz=d[0]*u[1]-d[1]*u[0];const l=Math.hypot(sx,sy,sz);sx/=l;sy/=l;sz/=l;const tx=sy*d[2]-sz*d[1],ty=sz*d[0]-sx*d[2],tz=sx*d[1]-sy*d[0],R=[];
 for(let i=0;i<n;i++){const a=i/n*TAU,cs=Math.cos(a)*r,sn=Math.sin(a)*r;R.push([c[0]+sx*cs+tx*sn,c[1]+sy*cs+ty*sn,c[2]+sz*cs+tz*sn]);}
 const ap=[c[0]-d[0]*r*.36,c[1]-d[1]*r*.36,c[2]-d[2]*r*.36],bk=[c[0]-d[0]*r*.5,c[1]-d[1]*r*.5,c[2]-d[2]*r*.5],f=[c[0]+d[0]*9,c[1]+d[1]*9,c[2]+d[2]*9];
 for(let i=0;i<n;i++){const j=(i+1)%n;T3(b,R[i],R[j],ap,m,[2*ap[0]-f[0],2*ap[1]-f[1],2*ap[2]-f[2]]);T3(b,R[i],R[j],bk,m2,f);}return b;}

// ------------------------------------------------------------------ par-battery -----------------------------------------
// par-battery (6.7 x 11.6 x 5.8): the Parasite plasma battery, an immobile objective turret: a STOLEN anti-air gun mount.
// The base: a welded scrap deck on four outriggers, the colony's own gunmetal pedestal with a gold collar under the turret
// ring, five plundered plates leaned and welded around it (a hazard panel, LDF ceramic, container sides, rust sheet), loot
// crates, sacks and a gas tank, a looted flag on a pole, red veins climbing from the ground to the ring. The head: a twin
// gun between two trunnion cheeks with gold caps and gold muzzle brakes, over-armoured with a mismatched plate on each
// flank and a visor plate, an ammunition bustle with strapped loot, a whip aerial with a pennant, and the infection
// swelling out of the breech between the guns: a growth split by glowing fissures, veins running out along both barrels,
// red light in the cheek vents.
// o.part: undefined = the whole battery; 'base' = everything that does not turn (nothing above y = 5.3: the head's place
// is free); 'gun' = the turning head alone in its own frame, the pivot at the origin, the barrels toward +z (muzzles at
// z = 2.85; the head keeps inside r 2.6 of the pivot apart from the barrels). In the whole model the pivot is at y = 6.6.
// HIGH <= 3000 whole / LOW <= 1000.
WK.model('par-battery',(b,o)=>{const {pal,tint,circ,rect}=b.k,P=pal.par,hi=b.hi,part=o.part,sd=o.seed|0,oct=(r,y)=>({p:circ(r,8,0,0,r,Math.PI/8),y}),H2=Math.PI/2;
 const base=()=>{
  // the scrap deck and its outriggers
  b.loft([{p:rect(6.4,5.5,1.35),y:-.6},{p:rect(6.4,5.5,1.35),y:.26},{p:rect(6,5.1,1.25),y:.45}],(r,i)=>r?(i===4||i===0?P.hazard:P.iron):P.ironD,{topMat:P.iron});
  for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const fx=sx*2.86,fz=sz*2.4;b.part();beam(b,[sx*1.3,1.15,sz*1.1],[fx,.52,fz],.4,.34,i=>i%2?P.ironL:P.iron,{w2:.3,d2:.26});qb(b,fx,-.6,fz,.84,.76,.84,P.ironD,'b');
   if(hi){b.tube([fx,.16,fz],[fx,.72,fz],.1,P.ironL,{n:5});qb(b,fx,.16,fz,.56,.06,.56,P.hazard,'b');}}
  // the pedestal: drum, column (a pale ceramic band left on it), the gold collar, the turret ring
  b.loft([oct(1.85,.45),oct(1.85,1.3),oct(1.62,1.56),oct(1.3,1.74),oct(1.22,3.05),oct(1.22,3.4),oct(1.2,4.66),oct(1.5,4.8),oct(1.5,5),oct(1.64,5.04),oct(1.64,5.3)],r=>[P.iron,P.iron,P.ironD,P.plateMilD,P.plateMil,P.plateMilD,P.ironD,P.gold,P.ironD,P.ironD][r],{topMat:P.ironD});
  if(hi)for(let k=0;k<8;k++)rad(b,k*TAU/8,1.71,.62,q=>tack(q,0,.3,.02,.11,P.weld));
  // the plundered plates leaned around it
  [[H2,2.1,2.6,2.9,'haz',0,.2,2.26],[H2+1.3,1.8,3.7,3.3,'mil',0,.23,2.2],[H2+2.55,1.7,3.0,3.25,'cont',1,.2,2.16],[H2+3.75,2.0,3.9,3.5,'rust',0,.24,2.2],[H2+5.0,1.7,2.45,2.3,'cont',2,.16,2.16]].forEach(([a,w,hL,hR,kind,ci,lean,rr],k)=>{
   if(!hi&&k===4)return;rad(b,a,rr,.4,q=>{slab(q,-w/2,w/2,0,hL,hR,0,.15,plateMat(q,kind,ci),{back:true});
    if(hi){dress(q,kind,-w/2,w/2,.12,Math.min(hL,hR)-.1,.18,ci);q.detail(()=>{for(const sx of [-1,1])tack(q,sx*w*.4,Math.min(hL,hR)-.3,.19,.08,P.gold);});q.tube([0,Math.min(hL,hR)-.5,0],[0,Math.min(hL,hR)-.2,-.7],.05,P.ironL,{n:3});}},-lean,(hz(sd,k+5)-.5)*.14);});
  // loot, a stolen gas tank, a looted flag on a pole
  crate(b,-2.3,.45,1.78,.95,.66,.8,.5,P.crate,{plain:!hi});crate(b,2.1,.45,-1.95,.9,.6,.8,-.4,P.crateD,{plain:!hi});
  if(hi){crate(b,-2.32,1.11,1.76,.62,.5,.56,-.2,P.crateD);sack(b,2.36,.45,1.78,.42,sd+3);sack(b,1.8,.45,2.1,.34,sd+4,tint(P.sack,.8));sack(b,2.66,.45,-1.2,.36,sd+5);
   b.tube([-2.66,.8,-.7],[-2.0,.8,-2.0],.33,P.tank,{n:8,caps:true});b.tube([-2.5,.8,-1.02],[-2.33,.8,-1.35],.345,P.tankBand,{n:8});}
  b.tube([2.6,.4,-1.76],[2.6,5.1,-1.76],.055,P.ironL,{n:4});b.tube([2.65,4.92,-1.72],[1.5,4.92,-2.36],.035,P.ironL,{n:3});flag(b,[2.55,4.9,-1.78],[1.55,4.9,-2.34],1.9,P.flagLDF,P.flagLDF2,{sway:.12});
  // the infection: veins from the ground up between the plates to the turret ring, swollen where they grip the column
  [H2+.66,H2+1.92,H2+3.12,H2+4.4,H2+5.66].forEach((a,k)=>{if(!hi&&k%2)return;const tw=k%2?-.7:.75,C=(t,r,y)=>{const q=a+tw*t+.16*Math.sin(t*9+k*2);return [Math.cos(q)*r,y,Math.sin(q)*r];},c=Math.cos(a),s=Math.sin(a);
   vein(b,[[c*3.02,-.3,s*2.6],[c*2.8,.36,s*2.4],C(-.12,2.3,.5),C(.06,1.92,.62),C(-.05,1.9,1.3),C(.1,1.36,1.74),C(.3,1.3,2.5),C(.55,1.29,3.3),C(.8,1.28,4.1),C(1,1.27,4.72)],.16,.05,{seg:hi?2:1});
   if(hi&&k%2===0){const p=C(.42,1.12,2.75+.3*k);bulb(b,p[0],p[1],p[2],.34,sd+k,{lx:p[0]*.2,lz:p[2]*.2,sy:1.5,na:6,nr:4});}});
  if(hi)b.pool(0,.1,0,3.4,3,RED,.1);
 };
 const gun=()=>{
  // the turntable and the two trunnion cheeks (red light in their vents)
  b.loft([oct(1.52,-1.3),oct(1.52,-1.06),oct(1.36,-1)],P.ironD,{topMat:P.iron});
  for(const sx of [-1,1]){b.part();qb(b,sx*1.3,-1,.1,.42,1.72,2.1,P.iron,'b');qb(b,sx*1.3,.72,.1,.42,.24,1.5,P.ironD,'b');b.tube([sx*1.5,.16,.1],[sx*1.66,.16,.1],.44,P.gold,{n:hi?8:6,caps:true});
   if(hi)for(let k=0;k<3;k++)b.quad([sx*1.515,-.8+k*.19,-.82],[sx*1.515,-.8+k*.19,-.5],[sx*1.515,-.7+k*.19,-.5],[sx*1.515,-.7+k*.19,-.82],P.redDim,[0,0,0]);}
  // the twin guns: housing, collar, sleeve, barrel, a gold muzzle brake with a lit bore
  for(const sx of [-1,1]){const x=sx*.7,y=.16;b.part();qb(b,x,-.5,0,.68,1.28,2.5,i=>i==='t'?P.ironL:P.iron,'b');
   b.tube([x,y,1.25],[x,y,1.62],.37,P.ironD,{n:hi?8:6,caps:true});b.tube([x,y,1.62],[x,y,2.2],.25,P.ironL,{n:hi?8:5});b.tube([x,y,2.2],[x,y,2.6],.15,P.ironD,{n:hi?6:4});b.tube([x,y,2.52],[x,y,2.85],.25,P.gold,{n:hi?8:5,caps:true});
   if(hi){b.tube([x,y,2.852],[x,y,2.86],.14,P.redHot,{n:6,caps:true});for(const z of [1.74,1.9,2.06])b.tube([x,y,z],[x,y,z+.06],.3,P.ironD,{n:8,caps:true});qb(b,x,.78,.5,.5,.05,1.4,P.gold,'b');}}
  qb(b,0,-1,0,.8,.5,2.4,P.ironD,'b');
  // over-armour: a mismatched plate welded outside each cheek, a visor plate over the guns
  b.at(-1.52,0,0,-H2,q=>{slab(q,-1.35,1.6,-1.08,1.15,1.45,0,.16,P.plateMil,{bot:true});if(hi){dress(q,'mil',-1.35,1.6,-.95,1.1,.19,0);q.detail(()=>{for(const [u,v] of [[-1.15,.9],[1.4,1.0],[-1.15,-.85],[1.4,-.85]])tack(q,u,v,.195,.09,P.gold);});}},0,.06);
  b.at(1.52,0,0,H2,q=>{slab(q,-1.55,1.25,-1.02,1.36,1.0,0,.16,P.hazard,{bot:true});if(hi){bars(q,-1.5,1.2,-.96,.96,.19,3,P.hazardD);q.detail(()=>{for(const [u,v] of [[-1.35,.75],[1.05,.62]])tack(q,u,v,.195,.09,P.weld);});}},0,-.09);
  b.at(0,.84,1.28,0,q=>{slab(q,-1.25,1.25,0,.92,.74,0,.11,P.plateSet[1],{back:true,bot:true});if(hi)dress(q,'cont',-1.25,1.25,.05,.7,.14,1);},-.95);
  // the bustle: an ammunition bin with loot strapped on top
  b.part();qb(b,0,-.72,-1.77,2.0,1.2,1.04,P.rust,'b');crate(b,-.45,.48,-1.76,.84,.56,.7,.2,P.crate,{plain:!hi});
  if(hi){crate(b,.5,.48,-1.82,.64,.44,.56,-.3,P.crateD);sack(b,.1,.48,-1.4,.28,sd+9);b.at(0,-.6,-2.3,Math.PI,q=>{slab(q,-.9,.94,0,.95,1.1,-.01,.1,P.plateSet[0],{bot:true});dress(q,'cont',-.9,.94,.05,.9,.12,0);},-.1);}
  // the infection swelling out of the breech
  bulb(b,0,-.5,-.22,.6,sd+2,{sy:3.3,sx:.95,sz:1.7,na:hi?10:6,nr:hi?6:3,lob:.17});
  if(hi){bulb(b,-.66,.7,-.62,.34,sd+4,{sy:1.3,lx:-.1,core:false,na:6,nr:4});bulb(b,.7,.7,.1,.3,sd+6,{sy:1.2,lx:.1,core:false,na:6,nr:4});
   for(const sx of [-1,1]){vein(b,[[sx*.3,.86,.2],[sx*.62,.86,.7],[sx*.7,.84,1.2],[sx*1.0,.3,1.58],[sx*.74,-.12,1.95],[sx*.5,.2,2.3],[sx*.7,.34,2.56]],.09,.03,{seg:2});
    vein(b,[[sx*.3,.8,-.8],[sx*.7,.84,-1.2],[sx*.96,.5,-1.75],[sx*1.03,-.3,-2.2]],.075,.03,{seg:2});vein(b,[[sx*.4,.84,-.3],[sx*1.0,.84,-.2],[sx*1.3,.98,-.3],[sx*1.7,.5,-.6]],.065,.025,{seg:2});}
   b.tube([-.9,.76,-1.0],[-1.1,3.9,-1.2],.03,P.ironL,{n:3,r2:.015});for(const sg of [1,-1])T3(b,[-1.09,3.8,-1.2],[-1.06,3.25,-1.18],[-1.06,3.55,-1.95],P.flagSet[3],[9*sg,3.5,-1.5]);
   b.halo(0,1,-.2,2.2,RED,.14);}
 };
 fit(b,o.w/6.7,o.h/11.6,o.d/5.8,()=>{if(part==='gun'){b.aoMin=1;gun();return;}base();if(part!=='base')b.at(0,6.6,0,0,gun);});
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ raid-spire ------------------------------------------
// raid-spire (8.8 x 7.4 x 7.6): the growth node the raiders plant on a sector. A scavenged drill tripod staked into the
// ground: three girder legs on staked foot plates, braced, a winch head with a caged red beacon lamp, the drill string
// driven into a rusty collar; the growth sac swelling around the drill string inside the legs, split by glowing fissures,
// a root mound where it enters the ground, veins running down the legs and out across the ground to the edge of the box;
// a looted crate pile, a stolen LDF flag hung from a brace and the raiders' own black flag at the top (7.3 m).
// HIGH <= 2000 / LOW <= 700.
WK.model('raid-spire',(b,o)=>{const {pal,tint}=b.k,P=pal.par,hi=b.hi,sd=o.seed|0;
 fit(b,o.w/8.8,o.h/7.4,o.d/7.6,()=>{const FEET=[[0,3.1],[-2.78,-1.72],[2.78,-1.72]],TOPY=5.35,leg=(k,t)=>[FEET[k][0]*(1-.9*t),.14+(TOPY-.14)*t,FEET[k][1]*(1-.9*t)];
  // the tripod: foot plates staked down, girder legs, braces
  FEET.forEach(([fx,fz],k)=>{const a=Math.atan2(fz,fx);b.part();b.at(fx,0,fz,-a+Math.PI/2,q=>{qb(q,0,-.5,0,1.0,.64,1.0,P.ironD,'b');
    if(hi){qb(q,0,.14,.38,1.0,.05,.2,P.hazard,'b');for(const sx of [-1,1])q.tube([sx*.36,.5,.3],[sx*.3,-.3,.36],.045,P.ironL,{n:3});q.loft([{p:b.k.rect(.5,.5,0,0,-.05),y:.14},{p:b.k.rect(.34,.3,0,0,-.2),y:.62}],P.iron,{top:false});}});
   beam(b,leg(k,0),leg(k,1),.36,.3,i=>i%2?P.ironL:P.iron,{w2:.26,d2:.22});
   const n=(k+1)%3;b.tube(leg(k,.3),leg(n,.3),.075,P.ironL,{n:hi?4:3});if(hi){b.tube(leg(k,.3),leg(n,.66),.05,P.rust,{n:3});b.tube(leg(k,.66),leg(n,.66),.06,P.ironL,{n:3});}});
  // the winch head and the beacon lamp in its cage
  b.cyl(0,TOPY-.2,0,.52,.6,P.ironD,{n:6,bev:.06});b.tube([-.55,TOPY+.62,0],[.55,TOPY+.62,0],.27,P.rust,{n:hi?8:5,caps:true});
  if(hi){for(const sx of [-1,1])qb(b,sx*.6,TOPY+.3,0,.08,.66,.5,P.iron,'b');b.cyl(0,TOPY+.9,0,.2,.12,P.gold,{n:6});b.cyl(0,TOPY+1.4,0,.2,.07,P.ironD,{n:6});
   for(let k=0;k<3;k++){const a=k*TAU/3+.4;b.tube([Math.cos(a)*.2,TOPY+1.0,Math.sin(a)*.2],[Math.cos(a)*.2,TOPY+1.42,Math.sin(a)*.2],.02,P.ironL,{n:3});}}
  b.cyl(0,TOPY+1.02,0,.13,.36,P.red,{n:hi?6:4,top:!hi});b.halo(0,TOPY+1.2,0,.9,RED,.4);
  // the drill string and its collar in the ground
  b.tube([0,TOPY-.2,0],[0,-.7,0],.15,P.ironL,{n:hi?6:4});b.cyl(0,-.3,0,.72,.52,P.rust,{n:hi?8:6,r2:.62});
  // the raiders' black flag at the top, a stolen LDF flag on a brace
  b.tube([-.3,TOPY+.3,-.2],[-.72,7.34,-.32],.04,P.ironL,{n:3});b.tube([-.7,7.2,-.32],[-1.95,7.2,-.5],.028,P.ironL,{n:3});flag(b,[-.72,7.18,-.32],[-1.93,7.18,-.5],1.5,P.strap,P.redLow,{sway:.1});
  {const a=leg(0,.66),c=leg(2,.66);flag(b,lerp3(a,c,.2),lerp3(a,c,.72),1.45,P.flagLDF,P.flagLDF2,{sway:-.08});}
  // the growth: the sac round the drill string (fissures on its flanks), a root mound at the collar
  const SC=[0,2.9,0],S=mass(b,SC,[1.36,1.66,1.3],sd+3,{na:hi?14:8,nr:hi?8:4,lob:.2});mass(b,[0,-.1,0],[1.55,.95,1.45],sd+5,{na:hi?12:8,nr:hi?4:2,t0:.5,lob:.22});
  const up=p=>{const x=p[0]-SC[0],y=(p[1]-SC[1])*.7,z=p[2]-SC[2],l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
  [[.5,.66,.52],[2.7,.5,.6],[4.5,.72,.46]].forEach(([ph,t,r],k)=>{if(!hi&&k)return;const p=S(ph,t,.66);bulb(b,p[0],p[1]-r*.5,p[2],r,sd+k*7,{lx:Math.cos(ph)*r*.8,lz:Math.sin(ph)*r*.8,sy:1.5});});
  for(let k=0;k<(hi?4:2);k++){const ph=k*TAU/(hi?4:2)+1.5,n=hi?4:2,pts=[];for(let j=0;j<=n;j++)pts.push(S(ph+.5*Math.sin(j*1.9+k*2),.9-.84*j/n,1.05));vein(b,pts,.085,.05,{seg:hi?2:1,open:true,up});}
  // veins down the legs and out over the ground to the edge of the box
  FEET.forEach(([fx,fz],k)=>{const pts=[S(Math.atan2(fz,fx),.6,1)],n=hi?6:3;for(let j=0;j<=n;j++){const t=.5-.5*j/n,p=leg(k,t),a=j*1.25+k*2;pts.push([p[0]+Math.cos(a)*.22,p[1]+.05,p[2]+Math.sin(a)*.22]);}vein(b,pts,.11,.06,{seg:hi?2:1,open:true});
   const a=Math.atan2(fz,fx)+(k?.5:-.6);if(hi)creep(b,[fx,.1,fz],[fx+Math.cos(a)*1.1,.03,fz+Math.sin(a)*.6],.07,sd+k+30,{n:2,fork:false});});
  const lim=q=>Math.abs(q[0])<4.2&&Math.abs(q[2])<3.6,NG=hi?7:4;for(let k=0;k<NG;k++){const a=k*TAU/NG+.5+.35*hz(sd,k),c=Math.cos(a),s=Math.sin(a),f=.8+.2*hz(sd,k+20);creep(b,[c*1.25,.42,s*1.2],[c*4.2*f,.03,s*3.6*f],.12,sd+k*3,{lim,seg:2});}
  // the loot they brought
  crate(b,2.55,0,1.25,1.2,.8,.95,.35,P.crate,{plain:!hi});crate(b,-2.5,0,1.5,.9,.7,.8,-.5,P.crateD,{plain:!hi});
  if(hi){crate(b,2.5,.8,1.3,.8,.6,.7,-.25,P.crateD);crate(b,3.3,0,.3,.7,.6,.7,1.1,P.crateD,{plain:true});sack(b,1.75,0,2.1,.42,sd+1);sack(b,2.35,0,2.25,.34,sd+2,tint(P.sack,.8));sack(b,-3.2,0,.9,.4,sd+6);
   b.tube([-1.7,.32,-2.9],[-.5,.32,-3.3],.3,P.tank,{n:7,caps:true});b.tube([-1.3,.32,-3.03],[-1.0,.32,-3.13],.315,P.tankBand,{n:7});
   b.halo(0,3,0,3.4,RED,.1);b.pool(0,.1,0,4.2,3.6,RED,.1);}
 });
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ hive-mast -------------------------------------------
// hive-mast (4.2 x 20.4 x 4.2, all inside r 2.2): the hive's mast, a STOLEN relay mast. A lattice tower on a steel foot
// block, a work platform with a hazard skirt half way up, two dish aerials (one hanging broken), a yard with looted flags
// and a loot crate slung under the platform; at the top the mast's own guard cage (gold hoop) holds the pulsing growth sac
// (18.8 m). A thick red vine winds up the tower from the ground to the sac, swollen where it grips the lattice, with roots
// spreading from its foot. o.sink (default 1) = how far the foot runs below y = 0. HIGH <= 1500 / LOW <= 500.
WK.model('hive-mast',(b,o)=>{const {pal,tint}=b.k,P=pal.par,hi=b.hi,sd=o.seed|0,rs=Math.min(o.w,o.d)/4.2,H=o.h/20.4,sink=(o.sink??1)/H;
 fit(b,rs,H,rs,()=>{const Y0=.6,Y1=16.9,NB=hi?6:4,hw=y=>.95-.5*clamp((y-Y0)/(Y1-Y0),0,1),C4=[[-1,-1],[1,-1],[1,1],[-1,1]],L=(k,y)=>[C4[k][0]*hw(y),y,C4[k][1]*hw(y)];
  // the foot block
  if(hi)b.loft([{p:b.k.rect(2.5,2.5,.3),y:-sink},{p:b.k.rect(2.5,2.5,.3),y:.42},{p:b.k.rect(2.1,2.1,.22),y:Y0}],r=>r?P.iron:P.ironD,{topMat:P.iron});else qb(b,0,-sink,0,2.4,sink+Y0,2.4,P.ironD,'b');
  // the lattice
  for(let k=0;k<4;k++)b.tube(L(k,Y0),L(k,Y1),.09,P.ironL,{n:hi?4:3,r2:.065});
  for(let j=0;j<NB;j++){const ya=Y0+(Y1-Y0)*j/NB,yb=Y0+(Y1-Y0)*(j+1)/NB;for(let k=0;k<4;k++){const n=(k+1)%4;b.tube(L(k,yb),L(n,yb),.055,P.iron,{n:3});if(hi||k%2===0)b.tube((j+k)%2?L(k,ya):L(n,ya),(j+k)%2?L(n,yb):L(k,yb),.045,(j+k)%3?P.iron:P.rust,{n:3});}}
  // the work platform, the yard and its looted flags, a loot crate slung under it
  const PY=Y0+(Y1-Y0)*(hi?3:2)/NB;qb(b,0,PY,0,2.3,.09,2.3,P.ironD,'');
  if(hi){for(const [sx,sz] of C4)b.tube([sx*1.1,PY,sz*1.1],[sx*1.1,PY+.95,sz*1.1],.03,P.ironL,{n:3});for(let k=0;k<4;k++){const a=C4[k],c=C4[(k+1)%4];b.tube([a[0]*1.1,PY+.95,a[1]*1.1],[c[0]*1.1,PY+.95,c[1]*1.1],.03,P.ironL,{n:3});}
   qb(b,0,PY+.09,1.12,2.3,.5,.04,P.hazard,'btlr');bars(b,-1.1,1.1,PY+.12,PY+.56,1.145,4,P.hazardD);}
  b.tube([0,PY-1.3,.2],[1.95,PY-1.3,.62],.05,P.ironL,{n:3});flag(b,[.72,PY-1.34,.36],[1.93,PY-1.34,.62],2.4,P.flagLDF,P.flagLDF2,{sway:.1});
  if(hi){b.tube([0,PY-1.3,-.2],[-1.7,PY-1.3,-.9],.045,P.ironL,{n:3});flag(b,[-.7,PY-1.34,-.5],[-1.68,PY-1.34,-.9],1.8,P.flagSet[3],P.flagSet[1],{sway:-.1});
   b.tube([-1.05,PY,1.0],[-1.25,PY-2.0,1.2],.018,P.strap,{n:3});crate(b,-1.25,PY-2.72,1.2,.7,.72,.7,.5,P.crate);}
  // the dish aerials
  {const y=Y0+(Y1-Y0)*(hi?4.4:3)/NB,d=[.76,.18,.62],c=[1.1,y,.9];b.tube([hw(y)*.6,y-.1,hw(y)*.5],c,.05,P.ironL,{n:3});dish(b,[c[0]+d[0]*.3,c[1]+d[1]*.3,c[2]+d[2]*.3],d,.8,P.tank,P.plateMilD);}
  if(hi){const y=Y0+(Y1-Y0)*5.25/NB,d=[-.62,-.62,-.48],c=[-.85,y,-.7];b.tube([-hw(y)*.6,y+.3,-hw(y)*.5],c,.045,P.ironL,{n:3});dish(b,[c[0]+d[0]*.25,c[1]+d[1]*.25,c[2]+d[2]*.25],d,.66,P.plateMil,P.rust);}
  // the head: the mast's own guard cage round the growth sac
  b.cyl(0,Y1-.08,0,1.36,.2,P.ironD,{n:hi?8:6});
  {const RB=hi?[[1.34,Y1+.1],[1.86,17.95],[1.93,18.85],[1.6,19.75],[.2,20.28]]:[[1.34,Y1+.1],[1.93,18.6],[.2,20.28]],nr=hi?5:4;
   for(let k=0;k<nr;k++){const a=k*TAU/nr+.26,c=Math.cos(a),s=Math.sin(a);for(let j=1;j<RB.length;j++)b.tube([c*RB[j-1][0],RB[j-1][1],s*RB[j-1][0]],[c*RB[j][0],RB[j][1],s*RB[j][0]],.065,k%2?P.ironL:P.iron,{n:3});}
   if(hi){const pts=[];for(let i=0;i<10;i++){const a=i/10*TAU+.26;pts.push([Math.cos(a)*1.95,18.85,Math.sin(a)*1.95]);}sweep(b,pts,.06,3,P.gold,{closed:true,ref:[0,1,0]});b.tube([0,20.2,0],[0,20.38,0],.04,P.gold,{n:3});}}
  const SC=[0,18.72,0],S=mass(b,SC,[1.42,1.28,1.42],sd+2,{na:hi?12:7,nr:hi?7:4,lob:.15}),up=p=>{const x=p[0],y=p[1]-SC[1],z=p[2],l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
  for(let k=0;k<(hi?3:2);k++){const ph=k*TAU/(hi?3:2)+.5,n=hi?3:2,pts=[];for(let j=0;j<=n;j++)pts.push(S(ph+.5*Math.sin(j*1.9+k),.9-.78*j/n,1.05));vein(b,pts,.1,.055,{seg:2,open:true,up});}
  if(hi)for(let k=0;k<3;k++){const ph=k*TAU/3+1.6,pts=[];for(let j=0;j<=3;j++)pts.push(S(ph+.3*Math.sin(j*2+k),.62-.1*j+(j===3?-.02:0),1.06));vein(b,pts,.12,.03,{raw:true,m:P.redHot,swell:0});}
  b.halo(0,18.8,0,3.6,RED,.16);
  // the vine: it hugs the lattice all the way up, swollen where it grips; roots at its foot
  {const turns=3.25,N=hi?36:16,pts=[],at=t=>{const y=-.2+(17.5+.2)*t,a=1+t*turns*TAU,c=Math.cos(a),s=Math.sin(a),w=y<Y0?1.2:hw(y),r=y>Y1?1.1+.3*(y-Y1):w/Math.max(Math.abs(c),Math.abs(s))+.13;return [c*r,y,s*r];};
   for(let i=0;i<=N;i++)pts.push(at(i/N));sweep(b,pts,(t,k)=>(.2-.09*t)*(1+.18*Math.sin(k*1.3)),3,P.red,{ref:[0,1,0]});
   if(hi)for(const t of [.2,.5,.8]){const p=at(t),r=.4-.1*t;bulb(b,p[0]*.92,p[1]-r*.75,p[2]*.92,r,sd+t*50,{sy:1.5,na:6,nr:3,core:false});}
   for(let k=0;k<(hi?3:2);k++){const a=1.3+k*TAU/(hi?3:2);creep(b,[Math.cos(a)*1.3,Y0+.02,Math.sin(a)*1.3],[Math.cos(a)*2.1,.04,Math.sin(a)*2.1],.11,sd+k,{n:2,fork:false,seg:2});}}
  if(hi){crate(b,.55,Y0,-.6,.7,.5,.6,.4,P.crateD);sack(b,-.6,Y0,.55,.3,sd+8);}
 });
},{aoH:8,aoMin:.55});
})(typeof globalThis!=='undefined'?globalThis:window);
