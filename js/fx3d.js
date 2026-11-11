'use strict';
// =====================================================================
// FX3D (Session 5E-2b): ONE shared, pooled effects and destruction system for the whole game.
//  - the ten supers (one per weapon item) x three timing-bar outcomes (miss / normal / jackpot): charge-up, core blast,
//    secondary energy, impact, lingering aftermath
//  - destruction: damage stages (cracks, scorch, sparks, smoke) on anything with health, and breaking apart when it is
//    destroyed, each material in its own way (armour, concrete, the six wall blends, crates, rock), with debris that
//    bounces, settles and fades
// Used by the Arcade renderer (js/render3d.js) and the Conquest view (js/conquest/view.js). Session 5E-2c's map props and
// 5E-2d's rebuilt buildings plug into the same three calls: FX.wear(...) every frame an object is damaged, FX.shatter(...)
// when it is destroyed, FX.blast(...) for an explosion sized to it.
// Budget rules: everything is drawn through TWO fixed dynamic batches (glow quads, lit debris) that the host renders with
// materials it already has, so no shader program and at most two draw calls are added; particles go to the host's own
// particle batch. All state lives in typed arrays and a fixed pool of effect records: nothing is allocated per hit or per
// frame. LOW = fewer chunks and particles, reduced motion = no shake, no flicker, far fewer particles.
// Visual only: nothing here reads or changes the simulation.
// =====================================================================
(function(root){
const TAU=Math.PI*2,clamp=(v,a,b)=>v<a?a:v>b?b:v;
// integer hash -> 0..1 (stable "random" for jagged shapes: the same seed gives the same bolt until the caller changes it)
function hsh(n){n=Math.imul((n|0)^((n|0)>>>15),0x2c1b3c6d);n=Math.imul(n^(n>>>12),0x297a2d39);return ((n^(n>>>15))>>>0)/4294967296;}
const HEX=new Map();
function rgbOf(h){let v=HEX.get(h);if(!v){const n=parseInt(String(h).slice(1),16);v=[(n>>16)/255,((n>>8)&255)/255,(n&255)/255];HEX.set(h,v);}return v;}
// ---- the ten supers: colours follow each weapon's Meshy look (docs/art/references/tanks/v2/weapons/) ----
// c: white-hot core, a: main colour, b: its darker second shade (distinct, so layered forms stay readable), x: accent
const PAL={
 pulse0:{c:'#eaffff',a:'#3fe0d4',b:'#157f96',x:'#b9fff6'},   // Pulse Cannon (olive, plain barrel): teal rail lance
 pulse1:{c:'#ffffff',a:'#b56bff',b:'#5326d9',x:'#ead4ff'},   // Arc Pulse (silver, violet coils): violet helix lightning
 pulse2:{c:'#fff6d8',a:'#ffb52e',b:'#ff5a14',x:'#ffe9a0'},   // Nova Pulse (dark, amber star core, gold bell): solar lance
 twin0:{c:'#ffffff',a:'#ffe14a',b:'#ff9a1f',x:'#fff7c2'},    // Twin Repeater (olive, hazard strip): yellow static ring
 twin1:{c:'#f4eaff',a:'#9d5cff',b:'#3f24c4',x:'#8fdcff'},    // Storm Repeater (silver, violet lines): violet storm vortex
 twin2:{c:'#fff1c4',a:'#ffae2b',b:'#f04a12',x:'#ffd66b'},    // Helix Repeater (amber spiral coils): amber helix dome
 siege0:{c:'#fff3c9',a:'#ff8a2a',b:'#c9300f',x:'#ffd24a'},   // Siege Breaker (olive, box brake): high-explosive fireball
 siege1:{c:'#ffffff',a:'#c07bff',b:'#35208f',x:'#9fe8ff'},   // Rail Breaker (silver rails, violet arc): violet implosion
 siege2:{c:'#fffbe6',a:'#ffcf4a',b:'#ff6a14',x:'#ff2e00'},   // Titanfall (dark, gold bands): golden cataclysm
 moon:{c:'#ffffff',a:'#6ec8ff',b:'#2a62ff',x:'#ff3b3b'}};    // Moonbeam (black, gold, red core crystal, blue charge crystals)
const KIND={pulse0:'beam',pulse1:'beam',pulse2:'beam',moon:'beam',twin0:'nova',twin1:'nova',twin2:'nova',siege0:'shell',siege1:'shell',siege2:'shell'};
// ---- how each material breaks (owner rule: everything breaks, each material its own way; 08-wall-blends.png) ----
// n: chunks on HIGH; sh: chunk shapes used (0 block, 1 plate, 2 shard, 3 sliver); c: chunk colours; v: launch speed;
// sp: spark colour (null none); dust: dust colour; g: glow colour of fresh breaks (crystal, molten edges); em: chunk glow 0..1
const MATS={
 armor:{n:14,sh:[1,1,0,3],c:['#3b4048','#565c66','#22252a','#7d838b'],v:5.2,sp:'#ffb35a',dust:'#2a2b30',crack:'#0a0b0d'},        // tears and splits into plates and chunks
 metal:{n:12,sh:[1,0,3],c:['#4c525a','#7d838b','#2a2e34'],v:5,sp:'#ffd27a',dust:'#33363c',crack:'#0a0b0d'},
 concrete:{n:16,sh:[0,0,0,2],c:['#8b8f94','#6f7378','#a3a6aa','#54575b'],v:3.4,sp:null,dust:'#8e9196',crack:'#1b1c1e',crumble:1},     // cracks and crumbles
 ferrite:{n:13,sh:[1,3,3,0],c:['#6b4a36','#8a4f2c','#4a3a30','#a6602f'],v:3.6,sp:'#ff9a45',dust:'#6a4631',crack:'#1a0f08',bend:1},    // bends and rusts apart (rebar slivers)
 ilmenite:{n:13,sh:[1,1,1,0],c:['#4a5360','#687383','#39414c'],v:4.6,sp:'#ffe9b0',dust:'#3b4048',crack:'#0c0e11',rivet:'#c9d2dc'},   // plates pop their rivets
 armalcolite:{n:15,sh:[3,3,2,3],c:['#1f2a44','#2e3d63','#141b2e','#48609a'],v:5.6,sp:'#8fb4ff',dust:'#1c2233',crack:'#05070d'},       // splinters
 tranq:{n:13,sh:[0,2,1],c:['#3d3a36','#57524a','#2b2925'],v:4,sp:'#ffd24a',dust:'#4a443a',crack:'#ffc94a',g:'#ffcf4a',em:.0,vein:1}, // cracks along its gold veins
 selenite:{n:20,sh:[2,2,3,2],c:['#bfe8ff','#e6f7ff','#8fd0f2','#ffffff'],v:6.2,sp:'#ffffff',dust:'#cfeeff',crack:'#ffffff',g:'#bfe8ff',em:.35,glass:1},   // shatters like glass
 moonheart:{n:18,sh:[2,2,0,3],c:['#ff2e4a','#b3122e','#ff6a7e','#7a0a1e'],v:5.4,sp:'#ff8a9a',dust:'#5a0e1c',crack:'#ff5a70',g:'#ff2e4a',em:.8,burst:1},  // cracks and bursts with crimson glow
 crate:{n:9,sh:[1,1,3],c:['#8a6a3a','#6b4f2a','#a8844a'],v:3.8,sp:null,dust:'#7a6444',crack:'#1a120a'},
 rock:{n:10,sh:[0,0,2],c:['#6f6a66','#56514e','#8a8580'],v:3.2,sp:null,dust:'#77726e',crack:'#161413'},
 chitin:{n:13,sh:[2,1,3,0],c:['#2b1531','#4a2352','#150a19','#7a2b86'],v:5,sp:'#ff7ae8',dust:'#2a1230',crack:'#ff2bd6',g:'#ff2bd6',em:.3}};   // Parasite hulls: split carapace, magenta ichor glow
// chunk templates (unit size, a few triangles each): block, plate, shard, sliver. Built once as flat position/normal arrays.
const TPL=(()=>{
 const out=[],tri=(P,N,a,b,c)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;for(const p of [a,b,c]){P.push(p[0],p[1],p[2]);N.push(nx,ny,nz);}};
 const hull=(pts,faces)=>{const P=[],N=[];for(const f of faces)for(let i=1;i<f.length-1;i++)tri(P,N,pts[f[0]],pts[f[i]],pts[f[i+1]]);return {P:new Float32Array(P),N:new Float32Array(N),n:P.length/3};};
 const box=(w,h,d,sk)=>{const x=w/2,y=h/2,z=d/2,s=sk||0;return hull([[-x,-y,-z],[x,-y,-z+s],[x,-y,z],[-x+s,-y,z],[-x+s,y,-z],[x-s,y,-z+s],[x,y,z-s],[-x,y,z]],[[0,1,2,3],[7,6,5,4],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]);};
 out.push(box(1,.8,.9,.16));                      // 0 block: an irregular lump
 out.push(box(1.25,.16,.85,.2));                  // 1 plate: a torn armour plate
 out.push(hull([[-.5,-.12,-.3],[.5,-.12,-.2],[0,-.12,.45],[.05,.85,0]],[[0,2,1],[0,1,3],[1,2,3],[2,0,3]]));   // 2 shard: a pointed splinter
 out.push(box(1.5,.1,.14,.03));                   // 3 sliver: rebar, a long splinter, a rivet strip
 return out;})();

function create(T,host){
 // host: {mode:'arcade'|'conquest', scene, low():bool, quiet():bool, glowMat, solidMat, glowAttr:'rgba'|'aCol', bill:bool,
 //        uv(u,v,out) (canonical -1..1 -> the host material's uv), lin:bool (convert sRGB to linear), solidAttr:'color'|'aCol',
 //        dot(add,x,y,z,size,r,g,b,a) (one particle sprite this frame; absent: drawn as billboards in the glow batch),
 //        right:[x,y,z], up:[x,y,z] (camera axes, refreshed by the host before begin()), eye(x,y,z,out) (unit vector point -> camera),
 //        shake(m,seconds), order:{glow,solid}}
 const QMAX=host.maxQuads||2600,VMAX=host.maxVerts||6000,PMAX=host.maxParticles||1500,DMAX=host.maxDebris||96,EMAX=40,SMAX=28;
 // ---------- glow batch: quads (position, colour rgb + occlusion a, soft-edge uv, optional billboard corner) ----------
 const qg=new T.BufferGeometry(),qP=new Float32Array(QMAX*12),qC=new Float32Array(QMAX*16),qU=new Float32Array(QMAX*8),qB=host.bill?new Float32Array(QMAX*12):null;
 {const I=new Uint16Array(QMAX*6);for(let q=0;q<QMAX;q++){const v=q*4,i=q*6;I[i]=v;I[i+1]=v+1;I[i+2]=v+2;I[i+3]=v;I[i+4]=v+2;I[i+5]=v+3;}qg.setIndex(new T.BufferAttribute(I,1));}
 const qAttr={position:new T.BufferAttribute(qP,3),col:new T.BufferAttribute(qC,4),uv:new T.BufferAttribute(qU,2)};
 qg.setAttribute('position',qAttr.position);qg.setAttribute(host.glowAttr||'rgba',qAttr.col);qg.setAttribute('uv',qAttr.uv);
 if(qB){qAttr.bill=new T.BufferAttribute(qB,3);qg.setAttribute('aBill',qAttr.bill);}
 for(const k in qAttr)qAttr[k].setUsage(35048);
 const qMesh=new T.Mesh(qg,host.glowMat);qMesh.frustumCulled=false;qMesh.renderOrder=host.order?host.order.glow:18;qMesh.userData.noPick=true;qMesh.name='fx3d-glow';host.scene.add(qMesh);
 // ---------- debris batch: lit triangles (position, normal, colour) ----------
 const dg=new T.BufferGeometry(),dP=new Float32Array(VMAX*3),dN=new Float32Array(VMAX*3),dCn=host.solidAttr==='aCol'?4:3,dC=new Float32Array(VMAX*dCn);
 const dAttr={position:new T.BufferAttribute(dP,3),normal:new T.BufferAttribute(dN,3),col:new T.BufferAttribute(dC,dCn)};
 dg.setAttribute('position',dAttr.position);dg.setAttribute('normal',dAttr.normal);dg.setAttribute(host.solidAttr||'color',dAttr.col);
 for(const k in dAttr)dAttr[k].setUsage(35048);
 const dMesh=new T.Mesh(dg,host.solidMat);dMesh.frustumCulled=false;dMesh.userData.noPick=true;dMesh.name='fx3d-debris';if(host.order)dMesh.renderOrder=host.order.solid;host.scene.add(dMesh);
 let qn=0,dn=0,time=0,frame=0,lastDt=0.016;
 const uvT=[0,0],G=host.lin?2.2:1,cc=(v)=>G===1?v:Math.pow(v,G),tmp=[0,0,0];
 const low=()=>!!host.low(),quiet=()=>!!host.quiet();
 // quality: how much of everything (1 HIGH, ~0.4 LOW, ~0.2 reduced motion)
 const amt=()=>quiet()?.2:low()?.4:1;
 // one quad: four corners (x,y,z), their canonical uv (-1..1; (0,0) everywhere = a hard quad), colour and occlusion
 function quad(x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3,u0,v0,u1,v1,u2,v2,u3,v3,r,g,b,a,o){
  if(qn>=QMAX)return;const p=qn*12,c=qn*16,u=qn*8;qn++;
  qP[p]=x0;qP[p+1]=y0;qP[p+2]=z0;qP[p+3]=x1;qP[p+4]=y1;qP[p+5]=z1;qP[p+6]=x2;qP[p+7]=y2;qP[p+8]=z2;qP[p+9]=x3;qP[p+10]=y3;qP[p+11]=z3;
  r=cc(r)*a;g=cc(g)*a;b=cc(b)*a;o=o||0;for(let i=0;i<16;i+=4){qC[c+i]=r;qC[c+i+1]=g;qC[c+i+2]=b;qC[c+i+3]=o;}
  if(host.uv){host.uv(u0,v0,uvT);qU[u]=uvT[0];qU[u+1]=uvT[1];host.uv(u1,v1,uvT);qU[u+2]=uvT[0];qU[u+3]=uvT[1];host.uv(u2,v2,uvT);qU[u+4]=uvT[0];qU[u+5]=uvT[1];host.uv(u3,v3,uvT);qU[u+6]=uvT[0];qU[u+7]=uvT[1];}
  else{qU[u]=u0;qU[u+1]=v0;qU[u+2]=u1;qU[u+3]=v1;qU[u+4]=u2;qU[u+5]=v2;qU[u+6]=u3;qU[u+7]=v3;}
  if(qB){for(let i=0;i<12;i++)qB[p+i]=0;}
 }
 // side vector for a ribbon from a to b (unit, perpendicular to it): flat on the ground in the Arcade's top-down view,
 // turned to the camera in Conquest
 function sideOf(dx,dy,dz,x,y,z){
  if(host.eye){host.eye(x,y,z,tmp);const ex=tmp[0],ey=tmp[1],ez=tmp[2];let sx=dy*ez-dz*ey,sy=dz*ex-dx*ez,sz=dx*ey-dy*ex;const l=Math.hypot(sx,sy,sz)||1;tmp[0]=sx/l;tmp[1]=sy/l;tmp[2]=sz/l;}
  else{const l=Math.hypot(dx,dz)||1;tmp[0]=-dz/l;tmp[1]=0;tmp[2]=dx/l;}
  return tmp;
 }
 // a soft ribbon from a to b: half-widths w0 at a, w1 at b; bright along the middle, fading to the edges
 function seg(ax,ay,az,bx,by,bz,w0,w1,col,a,o){
  const s=sideOf(bx-ax,by-ay,bz-az,(ax+bx)/2,(ay+by)/2,(az+bz)/2),sx=s[0],sy=s[1],sz=s[2];
  quad(ax-sx*w0,ay-sy*w0,az-sz*w0,bx-sx*w1,by-sy*w1,bz-sz*w1,bx+sx*w1,by+sy*w1,bz+sz*w1,ax+sx*w0,ay+sy*w0,az+sz*w0,0,-1,0,-1,0,1,0,1,col[0],col[1],col[2],a,o);
 }
 // a soft round glow lying flat (ground light, scorch, shockwave core) or facing the camera (sprite)
 function disc(x,y,z,r,col,a,o){quad(x-r,y,z-r,x+r,y,z-r,x+r,y,z+r,x-r,y,z+r,-1,-1,1,-1,1,1,-1,1,col[0],col[1],col[2],a,o);}
 function sprite(x,y,z,r,col,a,o){
  if(qB){if(qn>=QMAX)return;const p=qn*12;quad(x,y,z,x,y,z,x,y,z,x,y,z,-1,-1,1,-1,1,1,-1,1,col[0],col[1],col[2],a,o);qB[p]=-r;qB[p+1]=-r;qB[p+2]=1;qB[p+3]=r;qB[p+4]=-r;qB[p+5]=1;qB[p+6]=r;qB[p+7]=r;qB[p+8]=1;qB[p+9]=-r;qB[p+10]=r;qB[p+11]=1;return;}
  const R=host.right,U=host.up;quad(x-(R[0]+U[0])*r,y-(R[1]+U[1])*r,z-(R[2]+U[2])*r,x+(R[0]-U[0])*r,y+(R[1]-U[1])*r,z+(R[2]-U[2])*r,x+(R[0]+U[0])*r,y+(R[1]+U[1])*r,z+(R[2]+U[2])*r,x-(R[0]-U[0])*r,y-(R[1]-U[1])*r,z-(R[2]-U[2])*r,-1,-1,1,-1,1,1,-1,1,col[0],col[1],col[2],a,o);
 }
 // a flat ring on the ground (radius r, half-width w), optionally jagged (electric) and partial (a0..a1: arcs, spiral arms)
 function ring(x,y,z,r,w,col,a,n,jag,seed,a0,a1,o){
  a0=a0||0;a1=a1===undefined?TAU:a1;n=Math.max(6,n|0);let pr=0,pc=0,ps=0;
  for(let i=0;i<=n;i++){const t=a0+(a1-a0)*i/n,j=jag?1+(hsh(seed+i*7919)-.5)*jag:1,c=Math.cos(t),s=Math.sin(t),rr=r*j;
   if(i)quad(x+pc*(pr-w),y,z+ps*(pr-w),x+c*(rr-w),y,z+s*(rr-w),x+c*(rr+w),y,z+s*(rr+w),x+pc*(pr+w),y,z+ps*(pr+w),0,-1,0,-1,0,1,0,1,col[0],col[1],col[2],a,o);
   pr=rr;pc=c;ps=s;}
 }
 // a jagged lightning bolt from a to b: n segments, sideways wander amp, core width w
 function bolt(ax,ay,az,bx,by,bz,amp,n,w,col,a,seed,fork){
  const dx=bx-ax,dy=by-ay,dz=bz-az,L=Math.hypot(dx,dy,dz)||1,s=sideOf(dx,dy,dz,(ax+bx)/2,(ay+by)/2,(az+bz)/2),sx=s[0],sy=s[1],sz=s[2];
  let px=ax,py=ay,pz=az;
  for(let i=1;i<=n;i++){const t=i/n,e=i===n?0:(hsh(seed+i*131)-.5)*2*amp*Math.sin(t*Math.PI*.9+.15),lift=i===n?0:(hsh(seed+i*977)-.5)*amp*.5;
   const x=ax+dx*t+sx*e,y=ay+dy*t+sy*e+(host.eye?0:lift*.4),z=az+dz*t+sz*e;
   seg(px,py,pz,x,y,z,w,w,col,a);
   if(fork&&i<n&&hsh(seed+i*31)<fork){const fl=L/n*(1.2+hsh(seed+i*57)*1.6),fa=(hsh(seed+i*91)-.5)*2.4,ca=Math.cos(fa),sa=Math.sin(fa),ux=dx/L,uz=dz/L;
    seg(x,y,z,x+(ux*ca-uz*sa)*fl,y,z+(ux*sa+uz*ca)*fl,w*.7,w*.15,col,a*.8);}
   px=x;py=y;pz=z;}
 }
 // an n-pointed star flare lying flat (muzzle stars, glints)
 function star(x,y,z,r,n,rot,col,a,w){for(let i=0;i<n;i++){const t=rot+i/n*Math.PI,c=Math.cos(t)*r,s=Math.sin(t)*r;seg(x-c,y,z-s,x+c,y,z+s,w||r*.12,w||r*.12,col,a);}}
 // a ground crack: a dark jagged line with an optional glowing core (molten, veins, crystal), growing from the centre
 function crack(x,y,z,ang,len,seed,dark,glow,a,w){
  const n=6;let px=x,pz=z,dir=ang;
  for(let i=1;i<=n;i++){dir+=(hsh(seed+i*17)-.5)*.9;const l=len/n*(.7+hsh(seed+i*29)*.6),nx=px+Math.cos(dir)*l,nz=pz+Math.sin(dir)*l,ww=w*(1-i/(n+1));
   const sxx=-(nz-pz),szz=nx-px,sl=Math.hypot(sxx,szz)||1,ox=sxx/sl*ww,oz=szz/sl*ww;
   if(dark)quad(px-ox,y,pz-oz,nx-ox*.7,y,nz-oz*.7,nx+ox*.7,y,nz+oz*.7,px+ox,y,pz+oz,0,0,0,0,0,0,0,0,dark[0],dark[1],dark[2],.05,a*.85);
   if(glow)quad(px-ox*.55,y+.01,pz-oz*.55,nx-ox*.4,y+.01,nz-oz*.4,nx+ox*.4,y+.01,nz+oz*.4,px+ox*.55,y+.01,pz+oz*.55,0,-1,0,-1,0,1,0,1,glow[0],glow[1],glow[2],a,0);
   if(i===3&&hsh(seed+77)<.6){const bd=dir+(hsh(seed+5)<.5?1:-1)*(.6+hsh(seed+9)*.5),bl=len*.28,ex=nx+Math.cos(bd)*bl,ez=nz+Math.sin(bd)*bl;
    if(dark)quad(nx-ox*.5,y,nz-oz*.5,ex,y,ez,ex,y,ez,nx+ox*.5,y,nz+oz*.5,0,0,0,0,0,0,0,0,dark[0],dark[1],dark[2],.05,a*.8);
    if(glow)quad(nx-ox*.3,y+.01,nz-oz*.3,ex,y+.01,ez,ex,y+.01,ez,nx+ox*.3,y+.01,nz+oz*.3,0,-1,0,-1,0,1,0,1,glow[0],glow[1],glow[2],a*.8,0);}
   px=nx;pz=nz;}
 }
 // ---------- pooled particles (struct of arrays). add: 1 glow, 0 smoke/dust ----------
 const pX=new Float32Array(PMAX),pY=new Float32Array(PMAX),pZ=new Float32Array(PMAX),pVx=new Float32Array(PMAX),pVy=new Float32Array(PMAX),pVz=new Float32Array(PMAX),
  pT=new Float32Array(PMAX),pL=new Float32Array(PMAX),pS0=new Float32Array(PMAX),pS1=new Float32Array(PMAX),pR=new Float32Array(PMAX),pG=new Float32Array(PMAX),pB=new Float32Array(PMAX),
  pA=new Float32Array(PMAX),pGr=new Float32Array(PMAX),pDr=new Float32Array(PMAX),pFl=new Float32Array(PMAX),pAdd=new Uint8Array(PMAX);
 let pn=0;
 const pcap=()=>Math.min(PMAX,quiet()?140:low()?420:PMAX);
 function part(add,x,y,z,vx,vy,vz,life,s0,s1,col,a,grav,drag,floor){
  if(pn>=pcap())return;const i=pn++;pX[i]=x;pY[i]=y;pZ[i]=z;pVx[i]=vx;pVy[i]=vy;pVz[i]=vz;pT[i]=0;pL[i]=life;pS0[i]=s0;pS1[i]=s1;pR[i]=col[0];pG[i]=col[1];pB[i]=col[2];pA[i]=a;pGr[i]=grav||0;pDr[i]=drag||0;pFl[i]=floor===undefined?-1e9:floor;pAdd[i]=add?1:0;
 }
 function partStep(dt){
  let j=0;
  for(let i=0;i<pn;i++){const t=pT[i]+dt;if(t>=pL[i])continue;
   const dr=Math.max(0,1-pDr[i]*dt);let vx=pVx[i]*dr,vy=pVy[i]*dr-pGr[i]*dt,vz=pVz[i]*dr,x=pX[i]+vx*dt,y=pY[i]+vy*dt,z=pZ[i]+vz*dt;
   if(y<pFl[i]){y=pFl[i];vy*=-.35;vx*=.6;vz*=.6;}
   if(j!==i){pL[j]=pL[i];pS0[j]=pS0[i];pS1[j]=pS1[i];pR[j]=pR[i];pG[j]=pG[i];pB[j]=pB[i];pA[j]=pA[i];pGr[j]=pGr[i];pDr[j]=pDr[i];pFl[j]=pFl[i];pAdd[j]=pAdd[i];}
   pX[j]=x;pY[j]=y;pZ[j]=z;pVx[j]=vx;pVy[j]=vy;pVz[j]=vz;pT[j]=t;
   const k=t/pL[j],s=pS0[j]+(pS1[j]-pS0[j])*k,al=pA[j]*(1-k*k);
   if(host.dot)host.dot(pAdd[j],x,y,z,s,pR[j],pG[j],pB[j],al);
   else if(pAdd[j])sprite(x,y,z,s*.5,[pR[j],pG[j],pB[j]],al,0);else sprite(x,y,z,s*.5,[pR[j]*.4,pG[j]*.4,pB[j]*.4],.25,al*.75);
   j++;}
  pn=j;
 }
 const rnd=Math.random;
 // a round burst of sparks; a column of smoke; embers that rise; rain that falls
 function sparks(x,y,z,n,spd,col,size,life,up,floor){n=Math.round(n*amt());for(let i=0;i<n;i++){const a=rnd()*TAU,s=spd*(.35+rnd()*.65);part(1,x,y,z,Math.cos(a)*s,(up||1)*(.5+rnd()*2.5),Math.sin(a)*s,life*(.6+rnd()*.6),size,size*.15,col,1,9,1.2,floor);}}
 function smoke(x,y,z,n,r,col,size,life,rise){n=Math.round(n*amt());for(let i=0;i<n;i++){const a=rnd()*TAU,d=rnd()*r;part(0,x+Math.cos(a)*d,y+rnd()*.4,z+Math.sin(a)*d,Math.cos(a)*d*.5,(rise||1)*(.6+rnd()),Math.sin(a)*d*.5,life*(.7+rnd()*.6),size*.6,size*1.9,col,.55,0,.8);}}
 // ---------- pooled debris chunks ----------
 const cX=new Float32Array(DMAX),cY=new Float32Array(DMAX),cZ=new Float32Array(DMAX),cVx=new Float32Array(DMAX),cVy=new Float32Array(DMAX),cVz=new Float32Array(DMAX),
  cRx=new Float32Array(DMAX),cRy=new Float32Array(DMAX),cWx=new Float32Array(DMAX),cWy=new Float32Array(DMAX),cSx=new Float32Array(DMAX),cSy=new Float32Array(DMAX),cSz=new Float32Array(DMAX),
  cT=new Float32Array(DMAX),cL=new Float32Array(DMAX),cFl=new Float32Array(DMAX),cCr=new Float32Array(DMAX),cCg=new Float32Array(DMAX),cCb=new Float32Array(DMAX),cEm=new Float32Array(DMAX),cSh=new Uint8Array(DMAX),cRest=new Uint8Array(DMAX);
 let cn=0;
 const dcap=()=>Math.min(DMAX,quiet()?12:low()?26:DMAX);
 function chunk(shape,x,y,z,vx,vy,vz,sx,sy,sz,col,em,life,floor){
  let i;if(cn<dcap())i=cn++;else{i=0;let old=-1;for(let k=0;k<cn;k++)if(cT[k]/cL[k]>old){old=cT[k]/cL[k];i=k;}}   // full: the oldest chunk gives up its slot
  cX[i]=x;cY[i]=y;cZ[i]=z;cVx[i]=vx;cVy[i]=vy;cVz[i]=vz;cRx[i]=rnd()*TAU;cRy[i]=rnd()*TAU;cWx[i]=(rnd()-.5)*14;cWy[i]=(rnd()-.5)*14;cSx[i]=sx;cSy[i]=sy;cSz[i]=sz;
  cT[i]=0;cL[i]=life;cFl[i]=floor;cCr[i]=col[0];cCg[i]=col[1];cCb[i]=col[2];cEm[i]=em||0;cSh[i]=shape;cRest[i]=0;
 }
 function debrisStep(dt){
  let j=0;
  for(let i=0;i<cn;i++){const t=cT[i]+dt;if(t>=cL[i])continue;
   let x=cX[i],y=cY[i],z=cZ[i],vx=cVx[i],vy=cVy[i],vz=cVz[i],rx=cRx[i],ry=cRy[i],wx=cWx[i],wy=cWy[i],rest=cRest[i];
   if(!rest){vy-=22*dt;x+=vx*dt;y+=vy*dt;z+=vz*dt;rx+=wx*dt;ry+=wy*dt;
    const fl=cFl[i]+cSy[i]*.35;
    if(y<fl){y=fl;if(Math.abs(vy)<1.6){rest=1;vx=vy=vz=0;rx=Math.round(rx/Math.PI)*Math.PI;}else{vy*=-.38;vx*=.62;vz*=.62;wx*=.55;wy*=.55;}}}   // bounce, lose energy, then settle flat
   if(j!==i){cSx[j]=cSx[i];cSy[j]=cSy[i];cSz[j]=cSz[i];cL[j]=cL[i];cFl[j]=cFl[i];cCr[j]=cCr[i];cCg[j]=cCg[i];cCb[j]=cCb[i];cEm[j]=cEm[i];cSh[j]=cSh[i];}
   cX[j]=x;cY[j]=y;cZ[j]=z;cVx[j]=vx;cVy[j]=vy;cVz[j]=vz;cRx[j]=rx;cRy[j]=ry;cWx[j]=wx;cWy[j]=wy;cT[j]=t;cRest[j]=rest;
   // fade: the last 30% of its life it sinks into the ground and shrinks (the debris material is opaque: no alpha needed)
   const k=t/cL[j],f=k>.7?1-(k-.7)/.3:1,tp=TPL[cSh[j]];
   if(dn+tp.n<=VMAX){const sx=cSx[j]*f,sy=cSy[j]*f,sz=cSz[j]*f,ca=Math.cos(ry),sa=Math.sin(ry),cb=Math.cos(rx),sb=Math.sin(rx),yy=y-(1-f)*cSy[j]*.5,P=tp.P,N=tp.N,em=cEm[j]*(1-k);
    const r=cc(cCr[j]),g=cc(cCg[j]),b=cc(cCb[j]);
    for(let v=0;v<tp.n;v++){const o=v*3,lx=P[o]*sx,ly=P[o+1]*sy,lz=P[o+2]*sz,nx=N[o],ny=N[o+1],nz=N[o+2];
     // rotate about X (tumble) then Y (spin)
     const y1=ly*cb-lz*sb,z1=ly*sb+lz*cb,x2=lx*ca+z1*sa,z2=-lx*sa+z1*ca,ny1=ny*cb-nz*sb,nz1=ny*sb+nz*cb,nx2=nx*ca+nz1*sa,nz2=-nx*sa+nz1*ca,d=(dn+v)*3;
     dP[d]=x+x2;dP[d+1]=yy+y1;dP[d+2]=z+z2;dN[d]=nx2;dN[d+1]=ny1;dN[d+2]=nz2;
     const q=(dn+v)*dCn;if(dCn===4){dC[q]=r;dC[q+1]=g;dC[q+2]=b;dC[q+3]=em;}else{dC[q]=r+em*.6;dC[q+1]=g+em*.25;dC[q+2]=b+em*.2;}}
    dn+=tp.n;}
   j++;}
  cn=j;
 }
 // ---------- timed effects: a fixed pool of records, each drawn by its recipe every frame ----------
 const E=[];for(let i=0;i<EMAX;i++)E.push({on:0,fn:null,t:0,d:0,x:0,y:0,z:0,ang:0,a:0,b:0,u:1,k:'',oc:1,seed:0,f:0,P:null});
 function spawn(fn,d,x,y,z,ang,a,b,u,k,oc){let e=null,old=null;for(const q of E){if(!q.on){e=q;break;}if(!old||q.t/q.d>old.t/old.d)old=q;}e=e||old;
  e.on=1;e.fn=fn;e.t=0;e.d=d;e.x=x;e.y=y;e.z=z;e.ang=ang||0;e.a=a||0;e.b=b||0;e.u=u||1;e.k=k||'';e.oc=oc===undefined?1:oc;e.seed=(rnd()*1e9)|0;e.f=0;e.P=PAL[k]||null;return e;}
 // lingering ground marks (scorch, molten lines, cracks): fixed pool, drawn every frame until they fade
 const S=[];for(let i=0;i<SMAX;i++)S.push({on:0,kind:0,t:0,d:0,x:0,y:0,z:0,r:0,ang:0,len:0,seed:0,c:null,g:null});
 function mark(kind,d,x,y,z,r,ang,len,c,g){let s=null,old=null;for(const q of S){if(!q.on){s=q;break;}if(!old||q.t/q.d>old.t/old.d)old=q;}s=s||old;
  s.on=1;s.kind=kind;s.t=0;s.d=d*(low()?.6:1);s.x=x;s.y=y;s.z=z;s.r=r;s.ang=ang||0;s.len=len||0;s.seed=(rnd()*1e9)|0;s.c=c;s.g=g;}
 const BLK=[0,0,0];
 function marksDraw(dt){
  for(const s of S){if(!s.on)continue;s.t+=dt;if(s.t>=s.d){s.on=0;continue;}const k=s.t/s.d,f=k<.08?k/.08:1-Math.max(0,(k-.45)/.55);
   if(s.kind===0)disc(s.x,s.y,s.z,s.r,BLK,.02,.62*f);                                   // scorch
   else if(s.kind===1){const n=Math.max(3,Math.round(s.len/(1.3*Math.max(.5,s.r))));   // a scorched / molten line along a beam
    for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n,ax=s.x+Math.cos(s.ang)*s.len*t0,az=s.z+Math.sin(s.ang)*s.len*t0,bx=s.x+Math.cos(s.ang)*s.len*t1,bz=s.z+Math.sin(s.ang)*s.len*t1,w=s.r*(.75+.5*hsh(s.seed+i));
     const sx=-Math.sin(s.ang)*w,sz=Math.cos(s.ang)*w;quad(ax-sx,s.y,az-sz,bx-sx,s.y,bz-sz,bx+sx,s.y,bz+sz,ax+sx,s.y,az+sz,0,-1,0,-1,0,1,0,1,0,0,0,.02,.55*f);
     if(s.g&&k<.7){const h=(1-k/.7);quad(ax-sx*.35,s.y+.01,az-sz*.35,bx-sx*.35,s.y+.01,bz-sz*.35,bx+sx*.35,s.y+.01,bz+sz*.35,ax+sx*.35,s.y+.01,az+sz*.35,0,-1,0,-1,0,1,0,1,s.g[0],s.g[1],s.g[2],.9*h*h,0);}}}
   else{const grow=Math.min(1,s.t/.18),h=s.g?Math.max(0,1-k/.75):0;                     // radial cracks
    for(let i=0;i<s.len;i++)crack(s.x,s.y,s.z,s.ang+i/s.len*TAU+(hsh(s.seed+i)-.5)*.5,s.r*grow*(.6+.5*hsh(s.seed+i*3)),s.seed+i*101,s.c,h>0?s.g:null,s.g?Math.max(f*.4,h):f,s.r*.045+.03);}
  }
 }
 const shake=(m,t)=>{if(host.shake&&!quiet())host.shake(m,t);};
 const OCW=[.62,1,1.38];   // beam / blast size by outcome: miss thinner, jackpot thicker
 const col=h=>rgbOf(h);

 // ======================= SUPERS =======================
 // charge-up (called every frame a tank is charging): light gathers at the muzzle, each family in its own way.
 // k 0..1 progress of the sweep, oc: undefined while the bar sweeps, then the outcome (jackpot flares gold, a miss sputters)
 function superCharge(key,k,x,y,z,ang,oc,dim,u){
  const P=PAL[key]||PAL.pulse0,K=KIND[key],A=col(P.a),C=col(P.c),B=col(P.b),X=col(P.x),q=quiet(),pulse=q?1:.8+.2*Math.sin(time*26),grow=.35+.65*k,boost=oc===2?1.5:oc===0?.55:1;
  const mx=x+Math.cos(ang)*1.15*u,mz=z+Math.sin(ang)*1.15*u;
  if(K==='nova'){   // a ring closes in on the tank again and again, faster as it fills
   const ph=(time*(1.4+2.2*k))%1,r=dim*(1-ph*.82);ring(x,y+.05,z,r,.1*u*boost,A,(.25+.55*k)*(1-ph*.3)*boost,40,key==='twin0'?.1:0,frame>>2);
   disc(x,y+.04,z,dim*.55*grow,B,.22*grow*boost);sprite(x,y+.7*u,z,(.5+.9*k)*u*boost*pulse,A,.8);sprite(x,y+.7*u,z,(.22+.4*k)*u*boost,C,1);
   if(key==='twin1'&&!q)for(let i=0;i<3;i++){const a=time*5+i*TAU/3;ring(x,y+.06,z,dim*(.2+.3*k),.07*u,X,.5*k,10,0,0,a,a+1.1);}
   if(key==='twin2')for(let i=0;i<2;i++)ring(x,y+.3*u+i*.5*u,z,(1.0-i*.25)*u*grow,.06*u,X,.6*k*boost,22,0,0);
  }else{
   disc(mx,y+.04,mz,(1.2+1.6*k)*u*boost,B,.3*grow*boost);sprite(mx,y+.55*u,mz,(.55+1.1*k)*u*boost*pulse,A,.85);sprite(mx,y+.55*u,mz,(.22+.45*k)*u*boost,C,1);
   if(key==='pulse1'||key==='siege1'||key==='moon'){if(!q||frame%6===0){const a=hsh(frame>>1)*TAU,r=(1+k)*u;bolt(mx+Math.cos(a)*r,y+.5*u,mz+Math.sin(a)*r,mx,y+.55*u,mz,.3*u,4,.045*u,key==='moon'&&oc===2?col('#ff5a4a'):X,.9,frame>>1);}}
   if(key==='pulse2'||key==='siege2')star(mx,y+.56*u,mz,(.8+1.5*k)*u*boost,4,time*1.5,X,.75*grow,.06*u);
   if(key==='moon'){const a0=ang+2.2,a1=ang+TAU-2.2;ring(mx,y+.06,mz,(1.5-.5*k)*u,.07*u,A,.8*grow,18,0,0,a0,a1);ring(mx,y+.06,mz,(2.1-.7*k)*u,.05*u,oc===2?col('#ff3b3b'):B,.6*grow,18,0,0,a0+.3,a1-.3);}
   if(key==='pulse0')for(let i=0;i<2;i++){const d=(1.6+i*1.1)*u,w=(.5-.12*i)*u*grow;seg(mx+Math.cos(ang)*d-Math.sin(ang)*w,y+.5*u,mz+Math.sin(ang)*d+Math.cos(ang)*w,mx+Math.cos(ang)*d+Math.sin(ang)*w,y+.5*u,mz+Math.sin(ang)*d-Math.cos(ang)*w,.05*u,.05*u,X,.7*k);}
  }
  // motes drawn in towards the muzzle
  if(!q&&rnd()<lastDt*(low()?10:26)*(.4+k)){const a=rnd()*TAU,r=(1.2+rnd()*1.4)*u,cx=K==='nova'?x:mx,cz=K==='nova'?z:mz;part(1,cx+Math.cos(a)*r,y+.3*u+rnd()*.8*u,cz+Math.sin(a)*r,-Math.cos(a)*r*3.2,0,-Math.sin(a)*r*3.2,.3,.34*u,.06*u,rnd()<.4?C:A,.95,0,0);}
 }
 // the moment the bar is stopped: a jackpot rings gold, a miss sputters grey
 function superLock(key,oc,x,y,z,u){
  if(oc===2){spawn(fxLock,.38,x,y,z,0,0,0,u,key,2);sparks(x,y+.7*u,z,18,7*u,col('#ffcf4a'),.34*u,.5,1.2,y);}
  else if(oc===0)smoke(x,y+.7*u,z,4,.3*u,col('#5a5f68'),.6*u,.6);
 }
 function fxLock(e){const k=e.t/e.d,g=col('#ffcf4a'),w=col('#fff6cf');ring(e.x,e.y+.06,e.z,(.6+3.2*k)*e.u,.16*e.u*(1-k),g,1-k,36);ring(e.x,e.y+.07,e.z,(.3+2.2*k)*e.u,.08*e.u,w,(1-k)*.9,30);
  star(e.x,e.y+.9*e.u,e.z,(1.4+1.2*k)*e.u,4,.4,w,(1-k),.07*e.u);disc(e.x,e.y+.05,e.z,3*e.u,g,.35*(1-k));}

 // ---- beams (Pulse x3, Moonbeam). a: length, b: hit half-width ----
 function superBeam(key,oc,x,y,z,ang,len,w,u){
  const d=key==='pulse2'?(oc===2?.95:.6):key==='moon'?(oc===2?.9:.62):oc===2?.7:.48,e=spawn(fxBeam,d*(oc===0?.75:1),x,y,z,ang,len,w,u,key,oc),P=PAL[key];
  shake(oc===2?14:oc===1?8:4,oc===2?.5:.3);
  const ex=x+Math.cos(ang)*len,ez=z+Math.sin(ang)*len;
  // aftermath on the ground
  if(key==='pulse2')mark(1,oc===2?2.6:oc===1?1.7:.9,x+Math.cos(ang)*u,y+.03,z+Math.sin(ang)*u,w*(oc===2?.75:.5),ang,len-u,null,col(P.b));
  else if(oc>0&&(key==='moon'||key==='pulse1'))mark(1,oc===2?1.8:1.1,x+Math.cos(ang)*u,y+.03,z+Math.sin(ang)*u,w*.3,ang,len-u,null,key==='moon'&&oc===2?col('#ff3b3b'):col(P.b));
  else if(oc===2)mark(1,1.4,x+Math.cos(ang)*u,y+.03,z+Math.sin(ang)*u,w*.28,ang,len-u,null,col(P.a));
  return e;
 }
 function fxBeam(e,dt){
  const P=e.P,key=e.k,oc=e.oc,u=e.u,L=e.a,W=e.b*OCW[oc],t=e.t,k=t/e.d,ca=Math.cos(e.ang),sa=Math.sin(e.ang),q=quiet();
  const env=t<.04?t/.04:Math.pow(Math.max(0,1-(t-.04)/(e.d-.04)),1.4),fl=q?1:.86+.14*Math.sin(time*70+e.seed);
  const y=e.y+.55*u,ax=e.x+ca*1.1*u,az=e.z+sa*1.1*u,bx=e.x+ca*L,bz=e.z+sa*L,A=col(P.a),B=col(P.b),C=col(P.c),X=col(P.x);
  const fs=frame>>(q?4:1);   // lightning re-draws every other frame (every 16th with reduced motion: no flicker)
  if(key==='pulse0'){   // PIERCE LANCE: a needle-straight teal rail shot, white-hot core, shock diamonds racing down it
   seg(ax,y,az,bx,y,bz,W*1.5,W*1.1,B,.45*env);seg(ax,y,az,bx,y,bz,W*.62,W*.5,A,.95*env*fl);seg(ax,y,az,bx,y,bz,W*.2,W*.16,C,env);
   if(oc>0){const n=oc===2?9:6;for(let i=0;i<n;i++){const f=((i/n)+t*2.4)%1,cx=ax+(bx-ax)*f,cz=az+(bz-az)*f,r=W*(oc===2?1.25:.95)*(1-.3*f);   // diamonds
     quad(cx-ca*r,y,cz-sa*r,cx+sa*r*.55,y,cz-ca*r*.55,cx+ca*r,y,cz+sa*r,cx-sa*r*.55,y,cz+ca*r*.55,0,-1,-1,0,0,1,1,0,X[0],X[1],X[2],.9*env);}}
   if(oc===2)for(let i=0;i<3;i++){const f=clamp(t*3.2-i*.22,0,1);if(f>0&&f<1){const cx=ax+(bx-ax)*f,cz=az+(bz-az)*f;ring(cx,e.y+.06,cz,(.6+2.4*f)*W*1.6,.09*u,X,(1-f)*.95,26);}}   // jackpot: sonic rings
   if(!(e.f&1)){e.f|=1;const n=oc===0?4:10;for(let i=0;i<n*amt();i++){const f=rnd();part(1,ax+(bx-ax)*f,y,az+(bz-az)*f,-sa*(rnd()-.5)*5,1+rnd()*2,ca*(rnd()-.5)*5,.35,.3*u,.04*u,rnd()<.5?X:A,1,6,2,e.y);}}
  }else if(key==='pulse1'){   // ARC LANCE: a violet beam inside a double helix of lightning
   seg(ax,y,az,bx,y,bz,W*1.25,W*1.0,B,.5*env);seg(ax,y,az,bx,y,bz,W*.34,W*.3,A,.9*env*fl);seg(ax,y,az,bx,y,bz,W*.12,W*.1,C,env);
   const strands=oc===0?1:2,n=Math.round((oc===2?30:22)*(low()?.6:1)),amp=W*(oc===2?1.25:.95),tw=L/(u*2.6);
   for(let s=0;s<strands;s++){let px=ax,pz=az;for(let i=1;i<=n;i++){const f=i/n,ph=f*tw*TAU+(q?0:t*24)+s*Math.PI,off=Math.sin(ph)*amp*(.4+.6*Math.sin(f*Math.PI))+(hsh(fs*31+i+s*99)-.5)*amp*.35,x=ax+(bx-ax)*f-sa*off,z=az+(bz-az)*f+ca*off;
     seg(px,y,pz,x,y,z,.075*u,.075*u,s?X:C,env*(.95));px=x;pz=z;}}
   if(oc===2){for(let i=0;i<7;i++){const f=(i+.5)/7,sx=ax+(bx-ax)*f,sz=az+(bz-az)*f,sd=(i%2?1:-1)*(2.2+hsh(e.seed+i)*2.2)*u;   // jackpot: chain lightning forks to the ground on both sides
     if(hsh(fs*7+i)<.75)bolt(sx,y,sz,sx-sa*sd+ca*(hsh(e.seed+i*3)-.5)*2*u,e.y+.05,sz+ca*sd+sa*(hsh(e.seed+i*3)-.5)*2*u,.5*u,6,.06*u,X,env,fs*13+i,.3);}
    if(!(e.f&2)&&t>.05){e.f|=2;for(let i=0;i<7;i++){const f=(i+.5)/7,sd=(i%2?1:-1)*(2.2+hsh(e.seed+i)*2.2)*u,gx=ax+(bx-ax)*f-sa*sd,gz=az+(bz-az)*f+ca*sd;sparks(gx,e.y+.1,gz,5,3*u,X,.26*u,.4,1,e.y);}}}
  }else if(key==='pulse2'){   // SUNLANCE: a fat golden solar beam with a star at the muzzle and heat rings rolling down it
   const pw=q?1:1+.12*Math.sin(time*38);
   seg(ax,y,az,bx,y,bz,W*2.1*pw,W*1.7*pw,B,.5*env);seg(ax,y,az,bx,y,bz,W*1.15*pw,W*.95,A,.95*env);seg(ax,y,az,bx,y,bz,W*.42,W*.34,C,env);
   if(oc>0){star(ax,y+.02,az,(2.4+1.4*Math.sin(k*Math.PI))*u*(oc===2?1.35:1),4,.39+t*1.2,X,env,.11*u);sprite(ax,y,az,1.5*u*env,C,env);
    for(let i=0;i<(oc===2?5:3);i++){const f=((i/(oc===2?5:3))+t*1.3)%1,cx=ax+(bx-ax)*f,cz=az+(bz-az)*f,r=W*(1.5+.5*f);seg(cx-sa*r,y,cz+ca*r,cx+sa*r,y,cz-ca*r,.2*u,.2*u,X,.75*env*(1-f*.5));}}
   disc((ax+bx)/2,e.y+.04,(az+bz)/2,L*.42,B,.14*env);
   if(oc===2){const n=7;for(let i=0;i<n;i++){const at=.1+i*.07;if(t>=at&&!(e.f&(4<<i))){e.f|=(4<<i);const f=(i+.7)/n,px=ax+(bx-ax)*f,pz=az+(bz-az)*f;   // jackpot: fire erupts along the line, one pillar after another
      for(let j=0;j<12*amt();j++)part(1,px+(rnd()-.5)*W,e.y+.1,pz+(rnd()-.5)*W,(rnd()-.5)*1.2,6+rnd()*7,(rnd()-.5)*1.2,.5+rnd()*.3,.85*u,.15*u,j%3?A:X,1,5,.4,e.y);smoke(px,e.y+.5,pz,2,.4*u,col('#2a2622'),.9*u,1.2,1.4);}}}
   else if(!(e.f&1)&&oc>0){e.f|=1;for(let i=0;i<10*amt();i++){const f=rnd();part(1,ax+(bx-ax)*f,e.y+.1,az+(bz-az)*f,(rnd()-.5)*2,2+rnd()*3,(rnd()-.5)*2,.6,.4*u,.06*u,A,1,3,.5,e.y);}}
  }else{   // MOONFALL (owner-fixed): miss = a slightly thinner beam; normal = blue beam with thin blue electricity; jackpot = thicker beam, RED electricity
   const wb=oc===0?.82:oc===2?1.3:1,Wm=e.b*wb,R1=col('#ff3b3b'),R2=col('#ff9d7a');
   if(oc===2)seg(ax,y,az,bx,y,bz,Wm*2.1,Wm*1.9,R1,.42*env);   // jackpot: a red corona around the blue beam (the red core crystal overloads)
   seg(ax,y,az,bx,y,bz,Wm*1.45,Wm*1.25,B,.5*env);seg(ax,y,az,bx,y,bz,Wm*.85,Wm*.72,A,.9*env*fl);seg(ax,y,az,bx,y,bz,Wm*.32,Wm*.26,C,env);
   if(oc>0){const nb=oc===2?4:2;for(let i=0;i<nb;i++)bolt(ax,y,az,bx,y,bz,Wm*(oc===2?1.9:.8),Math.round(L/u/1.1),(oc===2?.11:.05)*u,oc===2?(i%2?R2:R1):(i%2?C:col('#bfe6ff')),env,fs*17+i*101+e.seed,oc===2?.3:0);}
   if(oc>0){const a0=e.ang+1.9,a1=e.ang+TAU-1.9,kk=Math.min(1,t/.12);ring(ax,e.y+.06,az,(1.2+1.8*kk)*u,.1*u,oc===2?R1:A,env,22,0,0,a0,a1);if(oc===2)ring(ax,e.y+.06,az,(1.8+2.6*kk)*u,.07*u,R2,env*.8,22,0,0,a0+.25,a1-.25);}
   disc((ax+bx)/2,e.y+.04,(az+bz)/2,L*.42,oc===2?col('#7a2038'):B,.13*env);
   if(!(e.f&1)){e.f|=1;const n=(oc===2?26:oc===1?14:6)*amt();for(let i=0;i<n;i++){const f=rnd();part(1,ax+(bx-ax)*f-sa*(rnd()-.5)*Wm,y,az+(bz-az)*f+ca*(rnd()-.5)*Wm,(rnd()-.5)*1.5,2.5+rnd()*4,(rnd()-.5)*1.5,.5+rnd()*.4,.5*u,.05*u,oc===2&&i%2?R1:i%3?col('#ccefff'):C,1,1.5,.4,e.y);}}
  }
 }
 // ---- novas (Twin x3). a: radius ----
 function superNova(key,oc,x,y,z,r,u){
  const d=oc===2?(key==='twin1'?1.05:.9):oc===1?.6:.42,e=spawn(fxNova,d,x,y,z,rnd()*TAU,r,0,u,key,oc),P=PAL[key];
  shake(oc===2?13:oc===1?7:3,oc===2?.5:.3);
  if(key==='twin2')mark(2,oc===2?2.8:1.4,x,y+.03,z,r*(oc===2?1.0:.7),rnd()*TAU,oc===2?9:oc===1?5:0,col('#120a04'),col(P.b));
  if(oc>0)mark(0,oc===2?2.2:1.3,x,y+.025,z,r*.5,0,0);
  return e;
 }
 function fxNova(e){
  const P=e.P,key=e.k,oc=e.oc,u=e.u,R=e.a,t=e.t,k=t/e.d,q=quiet(),A=col(P.a),B=col(P.b),C=col(P.c),X=col(P.x),fs=frame>>(q?4:1),y=e.y+.08;
  const ex=1-Math.pow(1-Math.min(1,t/.2),2.4),fade=k<.35?1:Math.max(0,1-(k-.35)/.65),rr=R*(.12+.88*ex);   // the wave reaches its full radius in 0.2 s (the hit lands at once), then lingers and fades
  disc(e.x,e.y+.05,e.z,R*(.5+.7*ex),B,.3*fade);
  if(key==='twin0'){   // STATIC NOVA: jagged yellow rings snap outward, sparks ride the front
   ring(e.x,y,e.z,rr,.2*u*OCW[oc],C,fade,48,.14,fs);
   if(oc>0){ring(e.x,y+.1,e.z,rr*.8,.14*u,A,fade*.9,44,.2,fs+50);ring(e.x,y+.2,e.z,rr*.58,.1*u,col(P.b),fade*.8,36,.26,fs+90);}
   if(oc===2){ring(e.x,y+.05,e.z,R*Math.min(1,t/(e.d*.3)),.26*u,X,Math.max(0,1-t/(e.d*.45)),48,.1,fs+7);
    for(let i=0;i<10;i++){if(hsh(fs*3+i)<.8){const a=e.ang+i/10*TAU;bolt(e.x+Math.cos(a)*.8*u,y+.3,e.z+Math.sin(a)*.8*u,e.x+Math.cos(a)*rr,y,e.z+Math.sin(a)*rr,.45*u,7,.07*u,i%2?A:C,fade,fs*11+i,.25);}}}   // jackpot: lightning spokes
   if(!(e.f&1)){e.f|=1;const n=(oc===0?10:oc===1?26:40)*amt();for(let i=0;i<n;i++){const a=i/n*TAU;part(1,e.x,y+.3,e.z,Math.cos(a)*R*2.4,.6+rnd(),Math.sin(a)*R*2.4,.42,.45*u,.07*u,i%2?X:A,1,2,2.6,e.y);}}
  }else if(key==='twin1'){   // STORM NOVA: a violet vortex, spiral arms sweeping out; jackpot calls lightning down from the sky
   const arms=oc===0?2:oc===1?4:5,spin=e.ang+(q?0:t*7);
   for(let i=0;i<arms;i++){const a0=spin+i/arms*TAU;for(let j=0;j<5;j++){const f0=j/5,f1=(j+1)/5;ring(e.x,y+.02*j,e.z,rr*(.25+.75*f1),(.19-.025*j)*u*OCW[oc],j<2?C:j<4?A:B,fade*(1-.12*j),7,.1,fs+i*9+j,a0+f0*1.5,a0+f1*1.5+.05);}}
   ring(e.x,y,e.z,rr,.11*u,X,fade*.9,44,.06,fs);
   if(oc===2){for(let i=0;i<8;i++){const at=.08+i*.085,lt=t-at;if(lt>0&&lt<.22){const a=hsh(e.seed+i*5)*TAU,d=R*(.3+.65*hsh(e.seed+i*9)),sx=e.x+Math.cos(a)*d,sz=e.z+Math.sin(a)*d,al=1-lt/.22;
      bolt(sx+(hsh(e.seed+i)-.5)*2*u,e.y+11*u,sz-3*u,sx,e.y+.1,sz,.55*u,9,.1*u,i%2?C:X,al,fs*5+i,.3);disc(sx,e.y+.06,sz,1.5*u,A,.7*al);sprite(sx,e.y+.4,sz,.9*u*al,C,al);
      if(!(e.f&(2<<i))){e.f|=(2<<i);sparks(sx,e.y+.2,sz,7,4*u,X,.3*u,.4,1.2,e.y);shake(6,.15);}}}}
   if(!(e.f&1)){e.f|=1;const n=(oc===0?6:18)*amt();for(let i=0;i<n;i++){const a=rnd()*TAU;part(1,e.x,y+.4,e.z,Math.cos(a)*R*1.6-Math.sin(a)*3,1+rnd()*2,Math.sin(a)*R*1.6+Math.cos(a)*3,.5,.4*u,.06*u,i%3?A:X,1,2,2,e.y);}}
  }else{   // HELIX NOVA: an amber dome of stacked coil rings rises from a molten ground ring; jackpot rains fire
   const layers=oc===0?1:oc===1?4:6;
   for(let i=0;i<layers;i++){const h=i/Math.max(1,layers),rad=rr*Math.cos(h*1.35),yy=e.y+.15+Math.sin(h*1.35)*R*.62*ex;ring(e.x,yy,e.z,rad,(.2-.02*i)*u*OCW[oc],i===0?C:i%2?A:X,fade*(1-.1*i),40,0,0,e.ang+i,e.ang+i+TAU);}
   ring(e.x,y,e.z,rr*1.02,.3*u,B,fade*.9,44,.05,fs>>2);
   if(oc>0&&!q)for(let i=0;i<3;i++){const a=e.ang+t*9+i*TAU/3;seg(e.x+Math.cos(a)*rr*.3,e.y+R*.55*ex,e.z+Math.sin(a)*rr*.3,e.x+Math.cos(a+.9)*rr,e.y+.2,e.z+Math.sin(a+.9)*rr,.07*u,.07*u,X,fade);}   // coil strands down the dome
   if(oc===2&&t>.12){const n=Math.round(60*lastDt*14*amt());for(let i=0;i<n;i++){const a=rnd()*TAU,d=Math.sqrt(rnd())*R;part(1,e.x+Math.cos(a)*d+2*u,e.y+9*u,e.z+Math.sin(a)*d-1.5*u,-2.2*u,-13*u,1.6*u,.75,.5*u,.2*u,rnd()<.5?A:col('#ff7a2a'),1,0,0,e.y);}}   // fire rain
   if(!(e.f&1)){e.f|=1;const n=(oc===0?8:22)*amt();for(let i=0;i<n;i++){const a=rnd()*TAU;part(1,e.x+Math.cos(a)*R*.3,y+.3,e.z+Math.sin(a)*R*.3,Math.cos(a)*R*1.3,3+rnd()*4,Math.sin(a)*R*1.3,.6,.45*u,.08*u,i%2?A:X,1,7,1,e.y);}}
  }
 }
 // ---- shells (Siege x3): the shot in flight (every frame) and where it lands ----
 function superShell(key,oc,x,y,z,u){
  const P=PAL[key]||PAL.siege0,A=col(P.a),C=col(P.c),B=col(P.b),X=col(P.x),s=OCW[oc],q=quiet();
  if(key==='siege1'){sprite(x,y,z,1.0*u*s,A,.8);sprite(x,y,z,.42*u*s,C,1);if(!q||frame%4===0)for(let i=0;i<(oc===0?1:2);i++){const a=hsh(frame*3+i)*TAU;bolt(x,y,z,x+Math.cos(a)*1.3*u*s,y-.3*u,z+Math.sin(a)*1.3*u*s,.3*u,4,.045*u,X,.9,frame+i);}
   if(rnd()<lastDt*50*amt())part(1,x,y,z,(rnd()-.5),0,(rnd()-.5),.3,.5*u*s,.05*u,A,.8,0,0);}
  else if(key==='siege2'){sprite(x,y,z,1.6*u*s,B,.75);sprite(x,y,z,.95*u*s,A,.95);sprite(x,y,z,.42*u*s,C,1);star(x,y+.01,z,1.5*u*s,2,time*6,X,.6,.06*u);
   if(rnd()<lastDt*70*amt())part(1,x+(rnd()-.5)*.4*u,y,z+(rnd()-.5)*.4*u,(rnd()-.5)*1.5,-1-rnd()*2,(rnd()-.5)*1.5,.5,.55*u*s,.08*u,rnd()<.5?A:X,1,3,0);
   if(rnd()<lastDt*24*amt())part(0,x,y,z,0,.4,0,.9,.5*u,1.4*u,col('#2a2622'),.45,0,.5);}
  else{sprite(x,y,z,1.15*u*s,A,.8);sprite(x,y,z,.48*u*s,C,1);
   if(rnd()<lastDt*50*amt())part(1,x,y,z,(rnd()-.5),.2,(rnd()-.5),.3,.6*u*s,.08*u,A,.9,0,0);
   if(rnd()<lastDt*30*amt())part(0,x,y,z,0,.4,0,.9,.45*u,1.3*u,col('#33302e'),.5,0,.5);}
 }
 function superBlast(key,oc,x,y,z,r,u){
  const d=key==='siege2'?(oc===2?1.5:1.0):oc===2?1.1:.75,e=spawn(fxBlast,d*(oc===0?.7:1),x,y,z,rnd()*TAU,r,0,u,key,oc),P=PAL[key];
  shake(oc===2?(key==='siege2'?20:16):oc===1?11:5,oc===2?.65:.4);
  mark(0,oc===2?3.2:oc===1?2.2:1.2,x,y+.025,z,r*(oc===2?1.05:oc===1?.8:.5),0,0);
  if(key==='siege2'&&oc>0)mark(2,oc===2?3.2:2.0,x,y+.03,z,r*(oc===2?1.5:1.0),rnd()*TAU,oc===2?11:6,col('#0c0806'),col(P.x));
  if(key==='siege1'&&oc===2)mark(2,1.6,x,y+.03,z,r*1.1,rnd()*TAU,8,null,col(P.x));
  return e;
 }
 function fxBlast(e){
  const P=e.P,key=e.k,oc=e.oc,u=e.u,R=e.a*OCW[oc],t=e.t,k=t/e.d,q=quiet(),A=col(P.a),B=col(P.b),C=col(P.c),X=col(P.x),fs=frame>>(q?4:1),y=e.y+.08,fade=Math.max(0,1-k);
  const ex=1-Math.pow(1-Math.min(1,t/(e.d*.4)),2.4);
  if(key==='siege0'){   // SIEGE BLAST: a rolling high-explosive fireball, hard shock ring, black smoke column, shrapnel
   const fb=Math.max(0,1-t/(e.d*.6));
   disc(e.x,e.y+.05,e.z,R*1.5*(.4+.6*ex),B,.5*fade);sprite(e.x,e.y+R*.35*ex,e.z,R*(.35+.75*ex),B,.85*fb);sprite(e.x,e.y+R*.4*ex,e.z,R*(.25+.55*ex),A,.95*fb);sprite(e.x,e.y+R*.45*ex,e.z,R*(.12+.3*ex),C,fb);
   ring(e.x,y,e.z,R*(.2+1.25*ex),.2*u,C,fade*fade,44);
   if(oc===2)for(let i=0;i<6;i++){const at=.12+i*.045,lt=t-at;if(lt>0){const a=e.ang+i/6*TAU,sx=e.x+Math.cos(a)*R*.95,sz=e.z+Math.sin(a)*R*.95,f=Math.max(0,1-lt/.4);   // jackpot: a ring of secondary explosions
      sprite(sx,e.y+.5*u,sz,R*.42*(1.3-f*.5),A,f);sprite(sx,e.y+.5*u,sz,R*.2,C,f);if(!(e.f&(2<<i))){e.f|=(2<<i);sparks(sx,e.y+.3,sz,8,5*u,X,.3*u,.5,1.4,e.y);smoke(sx,e.y+.4,sz,2,.3*u,col('#26221f'),1.1*u,1.3,1.2);shake(7,.18);}}}
   if(!(e.f&1)){e.f|=1;sparks(e.x,e.y+.4,e.z,oc===0?8:oc===1?22:34,(6+3*oc)*u,X,.34*u,.7,1.6,e.y);smoke(e.x,e.y+.5,e.z,oc===0?4:oc===1?10:16,R*.5,col('#221f1c'),1.5*u,oc===2?2.2:1.6,1.5);
    for(let i=0;i<(oc===0?4:12)*amt();i++)part(1,e.x+(rnd()-.5)*R*.6,e.y+.3,e.z+(rnd()-.5)*R*.6,(rnd()-.5)*2,3+rnd()*5,(rnd()-.5)*2,.6+rnd()*.5,.7*u,.12*u,A,1,2,.6,e.y);}
  }else if(key==='siege1'){   // RAIL BLAST: the air folds inward to a white point, then a violet sphere bursts and lightning crawls over the ground
   const imp=Math.min(1,t/.11),after=Math.max(0,t-.11),bx=1-Math.pow(1-Math.min(1,after/(e.d*.35)),2.2),bf=Math.max(0,1-after/(e.d-.11));
   if(t<.11){ring(e.x,y,e.z,R*1.5*(1-imp*.9),.16*u,X,.9,40);ring(e.x,y+.01,e.z,R*1.0*(1-imp*.9),.1*u,C,.9,34);sprite(e.x,e.y+.6*u,e.z,(.3+1.0*imp)*u,C,1);}
   else{disc(e.x,e.y+.05,e.z,R*1.5*bx,B,.55*bf);sprite(e.x,e.y+R*.3,e.z,R*(.3+.6*bx),B,.8*bf);sprite(e.x,e.y+R*.3,e.z,R*(.2+.4*bx),A,.9*bf*bf);sprite(e.x,e.y+R*.3,e.z,R*.22*(1-bx*.5),C,bf*bf);
    ring(e.x,y,e.z,R*(.15+1.2*bx),.14*u,X,bf,44,.05,fs);if(oc===2)ring(e.x,y+.02,e.z,R*(.1+1.75*bx),.2*u,A,bf*.9,48,.08,fs+9);
    const nt=oc===0?3:oc===1?7:12,reach=R*(oc===2?1.75:1.25)*(.35+.65*bx);
    for(let i=0;i<nt;i++){if(hsh(fs*5+i)<.82){const a=e.ang+i/nt*TAU+(hsh(e.seed+i)-.5)*.3;bolt(e.x,e.y+.25,e.z,e.x+Math.cos(a)*reach,e.y+.06,e.z+Math.sin(a)*reach,.42*u,8,.065*u,i%2?X:C,bf,fs*9+i,.3);}}}
   if(!(e.f&1)&&t>=.11){e.f|=1;sparks(e.x,e.y+.4,e.z,oc===0?6:oc===1?16:26,(5+2*oc)*u,X,.3*u,.5,1.2,e.y);for(let i=0;i<(oc===0?3:10)*amt();i++){const a=rnd()*TAU;part(1,e.x+Math.cos(a)*R,e.y+.3+rnd(),e.z+Math.sin(a)*R,-Math.cos(a)*R*2.5,0,-Math.sin(a)*R*2.5,.35,.4*u,.05*u,A,1,0,0);}}
  }else{   // TITANFALL: white flash, a golden fire dome, a rising column, shock rings, the ground splits (jackpot: and it rains fire)
   const fb=Math.max(0,1-t/(e.d*.7)),fl=Math.max(0,1-t/.09);
   if(fl>0)disc(e.x,e.y+.07,e.z,R*2.2,C,fl*.85);
   disc(e.x,e.y+.05,e.z,R*1.7*(.4+.6*ex),B,.55*fade);
   sprite(e.x,e.y+R*.4*ex,e.z,R*(.5+.8*ex),B,.85*fb);sprite(e.x,e.y+R*.45*ex,e.z,R*(.36+.6*ex),A,.95*fb);sprite(e.x,e.y+R*.5*ex,e.z,R*(.16+.32*ex),C,fb);
   if(oc>0){const cy=e.y+R*(.6+1.5*Math.min(1,t/(e.d*.8)));sprite(e.x,cy,e.z,R*.55*(1+k*.4),A,.8*fade);sprite(e.x,cy+R*.25,e.z,R*.75*(1+k*.5),B,.6*fade);seg(e.x,e.y+.3,e.z,e.x,cy,e.z,R*.2,R*.3,A,.6*fade);}   // the column and its cap
   ring(e.x,y,e.z,R*(.2+1.4*ex),.24*u,C,fade*fade,48);if(oc>0)ring(e.x,y+.02,e.z,R*(.1+2.0*Math.min(1,t/(e.d*.7))),.16*u,X,fade*.8,48);
   if(oc===2){star(e.x,e.y+R*.5,e.z,R*(1.2+1.6*ex),4,.39,C,fb,.1*u);
    if(t>.15){const n=Math.round(60*lastDt*16*amt());for(let i=0;i<n;i++){const a=rnd()*TAU,d=Math.sqrt(rnd())*R*1.5;part(1,e.x+Math.cos(a)*d+2.4*u,e.y+10*u,e.z+Math.sin(a)*d-1.8*u,-2.4*u,-14*u,1.8*u,.75,.55*u,.22*u,rnd()<.5?A:X,1,0,0,e.y);}}}   // fire rain
   if(!(e.f&1)){e.f|=1;sparks(e.x,e.y+.4,e.z,oc===0?10:oc===1?26:40,(7+3*oc)*u,col(P.a),.36*u,.8,1.7,e.y);smoke(e.x,e.y+.6,e.z,oc===0?4:oc===1?10:18,R*.5,col('#2a211a'),1.7*u,oc===2?2.6:1.8,1.8);
    for(let i=0;i<(oc===0?5:16)*amt();i++)part(1,e.x+(rnd()-.5)*R*.7,e.y+.3,e.z+(rnd()-.5)*R*.7,(rnd()-.5)*2,4+rnd()*6,(rnd()-.5)*2,.7+rnd()*.5,.8*u,.14*u,i%2?A:X,1,2,.5,e.y);}
  }
 }
 // ---- impact: where a super lands on a tank (hit 1) or a beam ends (hit 0). Small, in the super's own colours ----
 function superImpact(key,oc,x,y,z,hit,u){
  const P=PAL[key]||PAL.pulse0;spawn(fxImpact,hit?(oc===2?.5:.36):.26,x,y,z,rnd()*TAU,hit?1:.6,0,u,key,oc);
  const n=hit?(oc===2?20:oc===1?12:6):4;sparks(x,y+.5*u,z,n,(4+2*oc)*u,col(key==='moon'&&oc===2?'#ff5a4a':P.x),.3*u,.45,1.3,y);
  if(key==='moon'&&oc>0)for(let i=0;i<(oc===2?16:9)*amt();i++)part(1,x+(rnd()-.5)*.8*u,y+.3,z+(rnd()-.5)*.8*u,0,7+rnd()*5,0,.6+rnd()*.3,.8*u,.15*u,i%3?col('#bfe6ff'):col('#ffffff'),.95,0,.6);   // a pillar of moonlight
  if(hit&&oc>0)mark(0,oc===2?1.8:1.1,x,y+.025,z,(oc===2?1.5:1.0)*u,0,0);
 }
 function fxImpact(e){const P=e.P,k=e.t/e.d,u=e.u,s=e.a*OCW[e.oc],f=1-k,A=col(e.k==='moon'&&e.oc===2?'#ff3b3b':P.a),C=col(P.c);
  disc(e.x,e.y+.05,e.z,3.2*u*s,col(P.b),.4*f);sprite(e.x,e.y+.55*u,e.z,(1.0+1.4*k)*u*s,A,.9*f);sprite(e.x,e.y+.55*u,e.z,(.5+.5*k)*u*s,C,f*f);ring(e.x,e.y+.07,e.z,(.5+2.6*k)*u*s,.13*u,C,f,30);
  if(e.oc===2)star(e.x,e.y+.6*u,e.z,(1.6+1.6*k)*u,4,e.ang,C,f,.07*u);}

 // ======================= DESTRUCTION =======================
 // a generic explosion sized to the object (r = its rough radius)
 function blast(x,y,z,r,hot){spawn(fxBoom,.5+.12*Math.min(4,r),x,y,z,0,r,hot===0?0:1,1,'',1);const c=col('#ffb35a');sparks(x,y+r*.3,z,6+r*5,3+r*2.2,c,.2+.1*Math.min(3,r),.6,1.4,y);smoke(x,y+r*.3,z,3+r*2,r*.5,col('#26221f'),.6+.5*Math.min(3,r),1.2+.2*Math.min(3,r),1.2);shake(Math.min(14,3+r*3),.3);mark(0,1.6+.3*Math.min(4,r),x,y+.025,z,r*1.2,0,0);}
 function fxBoom(e){const k=e.t/e.d,R=e.a,f=1-k,ex=1-Math.pow(1-Math.min(1,k*2.2),2),o=col('#ff8a2a'),w=col('#fff1c4'),d=col('#c9300f');
  if(e.b){disc(e.x,e.y+.05,e.z,R*2.2*(.4+.6*ex),d,.45*f);sprite(e.x,e.y+R*.4,e.z,R*(.5+.9*ex),d,.8*f*f);sprite(e.x,e.y+R*.45,e.z,R*(.36+.6*ex),o,.95*f*f);sprite(e.x,e.y+R*.5,e.z,R*(.16+.3*ex),w,f*f);}
  ring(e.x,e.y+.07,e.z,R*(.3+1.9*ex),.08+.05*R,w,f*f,36);}
 // break an object apart. mat: a MATS key; size: its rough radius; h: its height; (dx,dz): which way the killing blow pushed
 function shatter(mat,x,y,z,size,h,dx,dz,tint){
  const M=MATS[mat]||MATS.metal,n=Math.max(3,Math.round(M.n*amt()*clamp(.6+size*.45,.6,1.9))),sc=clamp(size*.5,.14,1.5),pl=Math.hypot(dx||0,dz||0)||1,px=(dx||0)/pl*M.v*.45,pz=(dz||0)/pl*M.v*.45,life=(M.crumble?2.6:3.2)*(low()?.7:1);
  h=h||size;
  for(let i=0;i<n;i++){const a=rnd()*TAU,rr=Math.sqrt(rnd())*size*.7,sp=M.v*(.35+rnd()*.75)*(M.crumble?.7:1),shp=M.sh[(rnd()*M.sh.length)|0],c=tint&&i%3===0?tint:col(M.c[(rnd()*M.c.length)|0]),s=sc*(.55+rnd()*.9);
   chunk(shp,x+Math.cos(a)*rr,y+rnd()*h*.8+.1,z+Math.sin(a)*rr,Math.cos(a)*sp+px,(M.crumble?1.5:3)+rnd()*M.v*(M.glass?1.3:.9),Math.sin(a)*sp+pz,s*(M.bend&&shp===3?1.6:1),s*(shp===1?.9:1),s,c,M.em||0,life*(.75+rnd()*.5),y);}
  if(M.rivet){const rc=col(M.rivet);for(let i=0;i<Math.round(8*amt());i++){const a=rnd()*TAU,sp=M.v*(1.2+rnd());chunk(0,x+Math.cos(a)*size*.5,y+h*.5,z+Math.sin(a)*size*.5,Math.cos(a)*sp,4+rnd()*4,Math.sin(a)*sp,.11*sc+.05,.11*sc+.05,.11*sc+.05,rc,0,1.6,y);}}   // rivets pop off like shot
  if(M.sp)sparks(x,y+h*.5,z,8+size*5,M.v*1.5,col(M.sp),.2+.08*Math.min(3,size),M.glass?.9:.6,1.5,y);
  smoke(x,y+h*.3,z,(M.crumble?8:4)+size*2,size*.6,col(M.dust),.5+.4*Math.min(3,size),M.crumble?2:1.3,M.crumble?.5:1);
  if(M.g){spawn(fxGlowBurst,M.burst?.7:.45,x,y+h*.4,z,rnd()*TAU,size*(M.burst?2.2:1.4),M.burst?1:0,1,'',1).P={a:M.g};if(M.vein||M.burst)mark(2,2.2,x,y+.03,z,size*(M.burst?1.6:1.2),rnd()*TAU,M.burst?7:5,M.vein?col('#1a140a'):null,col(M.g));}
  if(M.glass)for(let i=0;i<Math.round(14*amt());i++){const a=rnd()*TAU,sp=3+rnd()*5;part(1,x,y+h*.5,z,Math.cos(a)*sp,2+rnd()*5,Math.sin(a)*sp,.9,.22,.03,col('#ffffff'),1,9,.6,y);}   // glints
  shake(Math.min(10,2+size*2.5),.22);
 }
 function fxGlowBurst(e){const k=e.t/e.d,f=1-k,c=col(e.P.a),w=col('#ffffff');disc(e.x,e.y-.3,e.z,e.a*(1+k),c,.6*f);sprite(e.x,e.y,e.z,e.a*(.4+.7*k),c,.9*f*f);ring(e.x,e.y-.3,e.z,e.a*(.3+1.6*k),.1,w,f,30);if(e.b)star(e.x,e.y,e.z,e.a*(.8+k),4,e.ang,w,f,.06);}
 // damage stages on a box-shaped object (called every frame it is damaged; frac = health left 0..1).
 // <70%: surface cracks and chipped edges; <45%: scorch and the odd spark; <22%: heavy cracks, smoke and sparks.
 // (cx,cy,cz) = centre of the box, hw/hh/hd half sizes, rot its heading, seed stable per object (same cracks every frame)
 function wear(mat,cx,cy,cz,hw,hh,hd,rot,frac,seed){
  if(frac>=.7||frac<=0)return;const M=MATS[mat]||MATS.metal,st=frac<.22?3:frac<.45?2:1,dark=col(M.crack),glow=M.g?col(M.g):null,ca=Math.cos(rot||0),sa=Math.sin(rot||0),n=st===1?2:st===2?4:6,w=Math.max(.025,Math.min(hw,hd)*.07);
  // cracks on the top face (what the Arcade's top-down camera sees) and on the two sides facing the Conquest camera
  for(let i=0;i<n;i++){const ox=(hsh(seed+i*13)-.5)*1.5*hw,oz=(hsh(seed+i*17)-.5)*1.5*hd,a=hsh(seed+i*23)*TAU,len=(.5+hsh(seed+i*29)*.7)*Math.min(hw,hd)*(st===3?1.5:1.1),wx=cx+ox*ca-oz*sa,wz=cz+ox*sa+oz*ca;
   crack(wx,cy+hh+.02,wz,a+rot,len,seed+i*41,glow&&!M.vein?null:dark,glow&&(M.vein||st>=2)?glow:null,M.vein?.95:.9,w);}
  if(host.mode==='conquest'){const y0=cy-hh,H=2*hh;for(let f=0;f<2;f++){const nx=f?ca:-sa,nz=f?sa:ca,ext=f?hw:hd,wid=f?hd:hw,tx=f?-sa:ca,tz=f?ca:sa;
    for(const sgn of [-1,1])for(let i=0;i<Math.ceil(n/2);i++){let pu=(hsh(seed+f*71+i*19+sgn)-.5)*1.6*wid,pv=y0+H*(.25+.6*hsh(seed+i*37+f)),dir=hsh(seed+i*5+f*3)*TAU;const bx=cx+nx*(ext+.04)*sgn,bz=cz+nz*(ext+.04)*sgn;
     for(let s=0;s<4;s++){dir+=(hsh(seed+s*11+i)-.5)*1.1;const l=H*.16,nu=clamp(pu+Math.cos(dir)*l,-wid,wid),nv=clamp(pv+Math.sin(dir)*l,y0+.05,y0+H);
      seg(bx+tx*pu,pv,bz+tz*pu,bx+tx*nu,nv,bz+tz*nu,w*(1-s*.2),w*(.8-s*.2),glow&&M.vein?glow:dark,glow&&M.vein?.9:.04,glow&&M.vein?0:.85);pu=nu;pv=nv;}}}}
  if(st>=2&&M.crack){disc(cx+(hsh(seed+3)-.5)*hw,cy+hh+.015,cz+(hsh(seed+4)-.5)*hd,Math.min(hw,hd)*(st===3?.95:.6),BLK,.02,st===3?.5:.34);}   // scorch
  if(quiet())return;
  const rate=lastDt*(st===3?(low()?4:9):st===2?(low()?1:2.5):0);
  if(rate&&rnd()<rate){const px=cx+(rnd()-.5)*hw*1.4,pz=cz+(rnd()-.5)*hd*1.4;
   if(M.sp&&rnd()<.6)part(1,px,cy+hh,pz,(rnd()-.5)*3,1.5+rnd()*2.5,(rnd()-.5)*3,.35,.16+.05*Math.min(3,hw),.03,col(M.sp),1,9,1,cy-hh);
   if(st===3)part(0,px,cy+hh,pz,(rnd()-.5)*.4,.9+rnd()*.6,(rnd()-.5)*.4,1.2+rnd()*.6,.3+.15*Math.min(3,hw),.9+.4*Math.min(3,hw),col(M.glass||M.burst?M.dust:'#1d1f24'),.5,0,.5);
   if(st===3&&M.g&&rnd()<.5)part(1,px,cy+hh,pz,0,1.2,0,.5,.3,.05,glow,.9,0,0);}
 }
 // ---------- frame ----------
 function begin(dt,t){lastDt=Math.min(.05,dt||.016);time=t===undefined?time+lastDt:t;frame++;qn=0;dn=0;}
 function end(){
  marksDraw(lastDt);
  for(const e of E){if(!e.on)continue;if(e.t>=e.d){e.on=0;continue;}e.fn(e,lastDt);e.t+=lastDt;}
  partStep(lastDt);debrisStep(lastDt);
  qg.setDrawRange(0,qn*6);dg.setDrawRange(0,dn);qMesh.visible=qn>0;dMesh.visible=dn>0;
  if(qn){for(const k in qAttr){const a=qAttr[k];a.clearUpdateRanges();a.addUpdateRange(0,qn*4*a.itemSize);a.needsUpdate=true;}}
  if(dn){for(const k in dAttr){const a=dAttr[k];a.clearUpdateRanges();a.addUpdateRange(0,dn*a.itemSize);a.needsUpdate=true;}}
 }
 function clear(){for(const e of E)e.on=0;for(const s of S)s.on=0;pn=0;cn=0;qn=0;dn=0;qg.setDrawRange(0,0);dg.setDrawRange(0,0);qMesh.visible=false;dMesh.visible=false;}
 function dispose(){host.scene.remove(qMesh);host.scene.remove(dMesh);qg.dispose();dg.dispose();}
 const stats=()=>({quads:qn,debrisVerts:dn,particles:pn,chunks:cn,effects:E.filter(e=>e.on).length,marks:S.filter(s=>s.on).length,caps:{quads:QMAX,verts:VMAX,particles:pcap(),chunks:dcap()}});
 return {begin,end,clear,dispose,stats,superCharge,superLock,superBeam,superNova,superShell,superBlast,superImpact,blast,shatter,wear,
  quad,seg,disc,sprite,ring,bolt,star,crack,part,sparks,smoke,chunk,mark,glow:qMesh,debris:dMesh};
}
root.FX3D={create,PAL,KIND,MATS};
})(typeof globalThis!=='undefined'?globalThis:this);
