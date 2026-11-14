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
// frame (effect recipes re-use cached colour arrays; nothing grows). LOW = fewer chunks and particles (in the Arcade no crack
// quads: its draw budget), reduced motion = no shake, no flicker, far fewer particles.
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
 twin0:{c:'#ffffff',a:'#ffd24a',b:'#c98a1a',x:'#fff7c2'},    // Twin Repeater (5a4bea6f.png: olive turret, two thin black barrels; no accent colour on the model): static in the weapon's own tracer yellow (rules.js WEAPONS.twin.c)
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
 //        slideMax (a perspective host: the furthest a sprite may be slid towards the camera to clear the ground; read every call),
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
 let qn=0,dn=0,time=0,frame=0,lastDt=0.016,QM=0,lowQ=false;   // lowQ: LOW quality this frame: every quad is drawn as soft glow (the looks cost several times more per pixel)   // QM: the look of the quads being written (0 soft glow, 1 turbulent, 2 shock front, 3 flowing beam: the host's glow shader, render3d.js FXG_FS)
 const CQO=host.mode==='conquest';   // Conquest keeps the 5E-2b supers and lightning (owner, Nov 13)
 const MODES=!!host.modes&&!host.uv;   // a host whose glow material does not know the looks (Conquest's style material) draws everything as soft glow
 const CQ=host.mode==='conquest'?.45:1,GLW=host.mode==='conquest'?1.5:2.8,GAIN=host.gain||1,MW=host.minW||.08,FW=host.fwd||null,uvT=[0,0],G=host.lin?2.2:1,cc=(v)=>G===1?v:Math.pow(v,G),tmp=[0,0,0];
 const low=()=>!!host.low(),quiet=()=>!!host.quiet();
 // quality: how much of everything (1 HIGH, ~0.4 LOW, ~0.2 reduced motion)
 const amt=()=>quiet()?.2:low()?.4:1;
 // one quad: four corners (x,y,z), their canonical uv (-1..1; (0,0) everywhere = a hard quad), colour and occlusion
 function quad(x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3,u0,v0,u1,v1,u2,v2,u3,v3,r,g,b,a,o){
  if(qn>=QMAX)return;const p=qn*12,c=qn*16,u=qn*8;qn++;
  qP[p]=x0;qP[p+1]=y0;qP[p+2]=z0;qP[p+3]=x1;qP[p+4]=y1;qP[p+5]=z1;qP[p+6]=x2;qP[p+7]=y2;qP[p+8]=z2;qP[p+9]=x3;qP[p+10]=y3;qP[p+11]=z3;
  r=cc(r)*a*GAIN;g=cc(g)*a*GAIN;b=cc(b)*a*GAIN;o=o||0;for(let i=0;i<16;i+=4){qC[c+i]=r;qC[c+i+1]=g;qC[c+i+2]=b;qC[c+i+3]=o;}
  if(host.uv){host.uv(u0,v0,uvT);qU[u]=uvT[0];qU[u+1]=uvT[1];host.uv(u1,v1,uvT);qU[u+2]=uvT[0];qU[u+3]=uvT[1];host.uv(u2,v2,uvT);qU[u+4]=uvT[0];qU[u+5]=uvT[1];host.uv(u3,v3,uvT);qU[u+6]=uvT[0];qU[u+7]=uvT[1];}
  else{const m=MODES&&!lowQ?QM*4:0;qU[u]=u0+m;qU[u+1]=v0;qU[u+2]=u1+m;qU[u+3]=v1;qU[u+4]=u2+m;qU[u+5]=v2;qU[u+6]=u3+m;qU[u+7]=v3;}
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
 // a soft half-round end for a ribbon at (x,y,z), pointing along (dx,dy,dz) (unit), half-width w: no ribbon ends on a hard edge
 function cap(x,y,z,dx,dy,dz,w,col,a,o){
  const s=sideOf(dx,dy,dz,x,y,z),sx=s[0]*w,sy=s[1]*w,sz=s[2]*w,ex=dx*w,ey=dy*w,ez=dz*w;
  quad(x-sx,y-sy,z-sz,x-sx+ex,y-sy+ey,z-sz+ez,x+sx+ex,y+sy+ey,z+sz+ez,x+sx,y+sy,z+sz,0,-1,1,-1,1,1,0,1,col[0],col[1],col[2],a,o);
 }
 // a ribbon with soft round ends (ends: 1 at a, 2 at b, 3 both)
 function segc(ax,ay,az,bx,by,bz,w0,w1,col,a,o,ends){
  seg(ax,ay,az,bx,by,bz,w0,w1,col,a,o);const dx=bx-ax,dy=by-ay,dz=bz-az,l=Math.hypot(dx,dy,dz)||1;ends=ends===undefined?3:ends;
  if(ends&1)cap(ax,ay,az,-dx/l,-dy/l,-dz/l,w0,col,a,o);if(ends&2)cap(bx,by,bz,dx/l,dy/l,dz/l,w1,col,a,o);
 }
 // a beam body from a to b: soft across, with streaks of energy racing along it (look 3; plain soft ribbon where the host has no looks).
 // s0: where along the whole beam this piece starts (world units), so the streaks run on through consecutive pieces
 function flow(ax,ay,az,bx,by,bz,w0,w1,col,a,s0){
  if(!MODES||lowQ){seg(ax,ay,az,bx,by,bz,w0,w1,col,a);return;}
  const s=sideOf(bx-ax,by-ay,bz-az,(ax+bx)/2,(ay+by)/2,(az+bz)/2),sx=s[0],sy=s[1],sz=s[2],u0=Math.min(.999,(s0||0)/24),u1=Math.min(.999,((s0||0)+Math.hypot(bx-ax,by-ay,bz-az))/24);
  QM=3;quad(ax-sx*w0,ay-sy*w0,az-sz*w0,bx-sx*w1,by-sy*w1,bz-sz*w1,bx+sx*w1,by+sy*w1,bz+sz*w1,ax+sx*w0,ay+sy*w0,az+sz*w0,u0,-1,u1,-1,u1,1,u0,1,col[0],col[1],col[2],a,0);QM=0;
 }
 // a soft round glow lying flat (ground light, scorch, shockwave core) or facing the camera (sprite)
 function disc(x,y,z,r,col,a,o){quad(x-r,y,z-r,x+r,y,z-r,x+r,y,z+r,x-r,y,z+r,-1,-1,1,-1,1,1,-1,1,col[0],col[1],col[2],a,o);}
 function sprite(x,y,z,r,col,a,o){
  if(qB){if(qn>=QMAX)return;const p=qn*12;quad(x,y,z,x,y,z,x,y,z,x,y,z,-1,-1,1,-1,1,1,-1,1,col[0],col[1],col[2],a,o);qB[p]=-r;qB[p+1]=-r;qB[p+2]=1;qB[p+3]=r;qB[p+4]=-r;qB[p+5]=1;qB[p+6]=r;qB[p+7]=r;qB[p+8]=1;qB[p+9]=-r;qB[p+10]=r;qB[p+11]=1;return;}
  const R=host.right,U=host.up;if(FW){const t=Math.min(host.slideMax||1e9,Math.max(0,(r*U[1]-y+.04)/Math.max(.05,FW[1])));x+=FW[0]*t;y+=FW[1]*t;z+=FW[2]*t;}   // slid towards the camera until its lower edge clears the ground: same place on screen, never cut off
  quad(x-(R[0]+U[0])*r,y-(R[1]+U[1])*r,z-(R[2]+U[2])*r,x+(R[0]-U[0])*r,y+(R[1]-U[1])*r,z+(R[2]-U[2])*r,x+(R[0]+U[0])*r,y+(R[1]+U[1])*r,z+(R[2]+U[2])*r,x-(R[0]-U[0])*r,y-(R[1]-U[1])*r,z-(R[2]-U[2])*r,-1,-1,1,-1,1,1,-1,1,col[0],col[1],col[2],a,o);
 }
 // a flat ring on the ground (radius r, half-width w), optionally jagged (electric) and partial (a0..a1: arcs, spiral arms)
 function ring(x,y,z,r,w,col,a,n,jag,seed,a0,a1,o){
  a0=a0||0;a1=a1===undefined?TAU:a1;n=Math.max(6,n|0);w=Math.max(w,MW*.7);let pr=0,pc=0,ps=0;
  for(let i=0;i<=n;i++){const t=a0+(a1-a0)*i/n,j=jag?1+(hsh(seed+i*7919)-.5)*jag:1,c=Math.cos(t),s=Math.sin(t),rr=r*j;
   if(i)quad(x+pc*(pr-w),y,z+ps*(pr-w),x+c*(rr-w),y,z+s*(rr-w),x+c*(rr+w),y,z+s*(rr+w),x+pc*(pr+w),y,z+ps*(pr+w),0,-1,0,-1,0,1,0,1,col[0],col[1],col[2],a,o);
   pr=rr;pc=c;ps=s;}
 }
 // turbulent looks: a billowing sprite (fire, smoke, an energy cloud) and a churning ground disc
 function puff(x,y,z,r,col,a,o){QM=1;sprite(x,y,z,r,col,a,o);QM=0;}
 const puffT=puff;
 function churn(x,y,z,r,col,a,o){QM=1;disc(x,y,z,r,col,a,o);QM=0;}
 // a shock wave on the ground: a hard bright front at radius r with a soft tail of width w behind it
 function shock(x,y,z,r,w,col,a,n,jag,seed){w=Math.min(w,r*.22);QM=2;ring(x,y,z,Math.max(.01,r-w),w,col,a,n||44,jag||0,seed||0);QM=0;}   // the tail is never deeper than 60% of the radius: a young front is a ring, not a filled disc
 // a jagged lightning bolt from a to b: n segments, sideways wander amp, core width w
 // The path is three octaves of wander (a slow bend, a kink every few segments, a fine jitter), zero at both ends, so it
 // reads as lightning and never as a ruler zig-zag; the stroke tapers to its far end; inside the coloured glow runs a
 // white-hot core; fork: the chance of a tapered side branch at each joint
 const BX=new Float32Array(40),BY=new Float32Array(40),BZ=new Float32Array(40),HOT=[0,0,0];
 function bolt(ax,ay,az,bx,by,bz,amp,n,w,col,a,seed,fork,thin,fmax){   // fmax: the longest a side branch may be (a strand that must stay inside a beam)
  const dx=bx-ax,dy=by-ay,dz=bz-az,L=Math.hypot(dx,dy,dz)||1,s=sideOf(dx,dy,dz,(ax+bx)/2,(ay+by)/2,(az+bz)/2),sx=s[0],sy=s[1],sz=s[2];
  n=Math.max(3,Math.min(38,Math.round(n*(thin?1:1.5))));const wc=Math.max(w,MW),o1=hsh(seed+11)*TAU,o2=hsh(seed+23)*TAU,f1=1.3+hsh(seed+5)*1.4,f2=4.5+hsh(seed+7)*3;
  for(let i=0;i<=n;i++){const t=i/n,env=Math.pow(Math.sin(t*Math.PI),.55),e=i===0||i===n?0:amp*env*(.62*Math.sin(t*f1*TAU+o1)+.36*Math.sin(t*f2*TAU+o2)+.5*(hsh(seed+i*131)-.5)),lift=i===0||i===n?0:(hsh(seed+i*977)-.5)*amp*.4*env;
   BX[i]=ax+dx*t+sx*e;BY[i]=ay+dy*t+sy*e+(host.eye?0:lift*.4);BZ[i]=az+dz*t+sz*e;}
  HOT[0]=col[0]+(1-col[0])*.55;HOT[1]=col[1]+(1-col[1])*.55;HOT[2]=col[2]+(1-col[2])*.55;
  for(let i=1;i<=n;i++){const t0=(i-1)/n,t1=i/n,w0=wc*(1.12-.62*t0),w1=wc*(1.12-.62*t1);
   if(thin!==2)seg(BX[i-1],BY[i-1],BZ[i-1],BX[i],BY[i],BZ[i],w0*3,w1*3,col,a*.3);seg(BX[i-1],BY[i-1],BZ[i-1],BX[i],BY[i],BZ[i],w0*1.15,w1*1.15,col,a*.9);   // thin 1: no hot core; thin 2: a hair (one pass)
   if(!thin)seg(BX[i-1],BY[i-1],BZ[i-1],BX[i],BY[i],BZ[i],w0*.5,w1*.5,HOT,a);}
  if(fork){const ux=dx/L,uz=dz/L;for(let i=2;i<n-1;i++){if(hsh(seed+i*31)>=fork)continue;
    const fl=Math.min(fmax||1e9,L*(.14+hsh(seed+i*57)*.2)),fa=(hsh(seed+i*91)<.5?-1:1)*(.45+hsh(seed+i*17)*.6),ca=Math.cos(fa),sa=Math.sin(fa),ex=BX[i]+(ux*ca-uz*sa)*fl,ez=BZ[i]+(ux*sa+uz*ca)*fl,mx=(BX[i]+ex)/2+(hsh(seed+i*3)-.5)*fl*.35,mz=(BZ[i]+ez)/2+(hsh(seed+i*9)-.5)*fl*.35,fw=wc*(1-.6*i/n);
    seg(BX[i],BY[i],BZ[i],mx,BY[i],mz,fw*2.2,fw*1.5,col,a*.28);seg(mx,BY[i],mz,ex,BY[i],ez,fw*1.5,fw*.3,col,a*.28);
    seg(BX[i],BY[i],BZ[i],mx,BY[i],mz,fw*.8,fw*.55,col,a*.85);seg(mx,BY[i],mz,ex,BY[i],ez,fw*.55,fw*.08,col,a*.85);}}
 }
 // an n-pointed star flare lying flat (muzzle stars, glints)
 function star(x,y,z,r,n,rot,col,a,w){w=Math.max(w||r*.12,MW*.9);for(let i=0;i<n;i++){const t=rot+i/n*Math.PI,c=Math.cos(t)*r,s=Math.sin(t)*r;seg(x,y,z,x+c,y,z+s,w*1.5,w*.08,col,a);seg(x,y,z,x-c,y,z-s,w*1.5,w*.08,col,a);}}   // wedges that taper to a point: never ruler lines
 // an upright sliver of light from (x,y0,z) up to y1: half-widths w0 at the foot, w1 at the tip, soft across; it faces the camera (the host's right axis)
 function spire(x,y0,z,y1,w0,w1,col,a){const r=host.right||XAX,rx=r[0],ry=r[1],rz=r[2];quad(x-rx*w0,y0-ry*w0,z-rz*w0,x-rx*w1,y1-ry*w1,z-rz*w1,x+rx*w1,y1+ry*w1,z+rz*w1,x+rx*w0,y0+ry*w0,z+rz*w0,0,-1,0,-1,0,1,0,1,col[0],col[1],col[2],a,0);}
 const XAX=[1,0,0];
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
 let pn=0;const PC=[0,0,0];   // scratch colour (no array per particle per frame)
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
   else if(pAdd[j]){PC[0]=pR[j];PC[1]=pG[j];PC[2]=pB[j];sprite(x,y,z,s*.5,PC,al,0);}else{PC[0]=pR[j]*.4;PC[1]=pG[j]*.4;PC[2]=pB[j]*.4;sprite(x,y,z,s*.5,PC,.25,al*.75);}
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
 let cn=0,steal=0,frameChunks=0;
 const dcap=()=>Math.min(DMAX,quiet()?12:low()?26:DMAX);
 function chunk(shape,x,y,z,vx,vy,vz,sx,sy,sz,col,em,life,floor){
  let i;if(cn<dcap())i=cn++;else i=(steal++)%cn;   // full: slots are handed over in turn, so many things breaking in one frame all leave pieces
  frameChunks++;
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
 const E=[];for(let i=0;i<EMAX;i++)E.push({on:0,fn:null,t:0,d:0,x:0,y:0,z:0,ang:0,a:0,b:0,u:1,k:'',oc:1,seed:0,f:0,dy:0,P:null});
 function spawn(fn,d,x,y,z,ang,a,b,u,k,oc){let e=null,old=null;for(const q of E){if(!q.on){e=q;break;}if(!old||q.t/q.d>old.t/old.d)old=q;}e=e||old;
  e.on=1;e.fn=fn;e.t=0;e.d=d;e.x=x;e.y=y;e.z=z;e.ang=ang||0;e.a=a||0;e.b=b||0;e.u=u||1;e.k=k||'';e.oc=oc===undefined?1:oc;e.seed=(rnd()*1e9)|0;e.f=0;e.dy=0;e.P=PAL[k]||(k?PAL.pulse0:null);if(k&&!PAL[k])e.k='pulse0';return e;}   // a super this build does not know (a newer server) plays as the plain lance
 // lingering ground marks, drawn every frame until they fade (a fixed pool). kind 0 scorch disc, 1 scorched line with a
 // glowing core (g), 2 radial cracks, 3 crawling arcs (along a line if len>0, else inside radius r), 4 glowing mist,
 // 5 a glowing line with rising motes
 const S=[];for(let i=0;i<SMAX;i++)S.push({on:0,kind:0,t:0,d:0,x:0,y:0,z:0,r:0,ang:0,len:0,seed:0,c:null,g:null,u:1});
 function mark(kind,d,x,y,z,r,ang,len,c,g,u){let s=null,old=null;for(const q of S){if(!q.on){s=q;break;}if(!old||q.t/q.d>old.t/old.d)old=q;}s=s||old;
  s.on=1;s.kind=kind;s.t=0;s.d=d*(low()?.6:1);s.x=x;s.y=y;s.z=z;s.r=r;s.ang=ang||0;s.len=len||0;s.seed=(rnd()*1e9)|0;s.c=c;s.g=g;s.u=u||1;}
 const BLK=[0,0,0];
 function marksDraw(dt){
  for(const s of S){if(!s.on)continue;s.t+=dt;if(s.t>=s.d){s.on=0;continue;}const k=s.t/s.d,f=k<.08?k/.08:1-Math.max(0,(k-.45)/.55),ca=Math.cos(s.ang),sa=Math.sin(s.ang);
   if(s.kind===0)disc(s.x,s.y,s.z,s.r,BLK,.02,.62*f);
   else if(s.kind===1||s.kind===5){const n=Math.max(3,Math.round(s.len/(1.3*Math.max(.5,s.r))));
    for(let i=0;i<n;i++){const t0=i/n,t1=(i+1)/n,ax=s.x+ca*s.len*t0,az=s.z+sa*s.len*t0,bx=s.x+ca*s.len*t1,bz=s.z+sa*s.len*t1,w=s.r*(.75+.5*hsh(s.seed+i)),sx=-sa*w,sz=ca*w;
     if(s.kind===1)quad(ax-sx,s.y,az-sz,bx-sx,s.y,bz-sz,bx+sx,s.y,bz+sz,ax+sx,s.y,az+sz,0,-1,0,-1,0,1,0,1,0,0,0,.02,.55*f);
     if(s.g&&k<.92){const h=1-k/.92;quad(ax-sx*.45,s.y+.01,az-sz*.45,bx-sx*.45,s.y+.01,bz-sz*.45,bx+sx*.45,s.y+.01,bz+sz*.45,ax+sx*.45,s.y+.01,az+sz*.45,0,-1,0,-1,0,1,0,1,s.g[0],s.g[1],s.g[2],.9*Math.sqrt(h),0);}}
    if(s.kind===5&&!quiet()&&rnd()<dt*34*amt()*(1-k)){const t=rnd();part(1,s.x+ca*s.len*t,s.y+.1,s.z+sa*s.len*t,0,(1.5+rnd()*2)*s.u,0,.7,.3*s.u,.04*s.u,s.g,.9,0,.4);}}
   else if(s.kind===2){const grow=Math.min(1,s.t/.18),h=s.g?Math.max(0,1-k/.75):0;
    for(let i=0;i<s.len;i++)crack(s.x,s.y,s.z,s.ang+i/s.len*TAU+(hsh(s.seed+i)-.5)*.5,s.r*grow*(.6+.5*hsh(s.seed+i*3)),s.seed+i*101,s.c,h>0?s.g:null,s.g?Math.max(f*.4,h):f,s.r*.045+.03);}
   else if(s.kind===3){const fs=quiet()?0:frame>>2,n=low()?4:9;   // short arcs that keep jumping about: static left behind
    for(let i=0;i<n;i++){if(hsh(fs*13+i*7+s.seed)>.82)continue;let px,pz;if(s.len>0){const t=hsh(fs*31+i+s.seed),o=(hsh(fs*17+i+s.seed)-.5)*2*s.r;px=s.x+ca*s.len*t-sa*o;pz=s.z+sa*s.len*t+ca*o;}else{const a=hsh(fs*31+i+s.seed)*TAU,d=Math.sqrt(hsh(fs*17+i+s.seed))*s.r;px=s.x+Math.cos(a)*d;pz=s.z+Math.sin(a)*d;}
     const a2=hsh(fs*5+i+s.seed)*TAU,l=(.7+hsh(fs*3+i)*1.1)*s.u;(CQO?boltO:bolt)(px,s.y+.05,pz,px+Math.cos(a2)*l,s.y+.05,pz+Math.sin(a2)*l,.3*s.u,4,.07*s.u,s.g,Math.min(1,f*1.2),fs*7+i+s.seed);}}
   else{disc(s.x,s.y+.02,s.z,s.r*(1+.25*k),s.g,.42*f);ring(s.x,s.y+.03,s.z,s.r*(.5+.4*k),.12*s.u,s.g,.5*f,30,.12,s.seed,s.t*1.2,s.t*1.2+4.2);}   // mist with a slow turning burn ring
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
  {const T=TIER[key]|0;sigil(x,y+.045,z,sigR(T,u)*(.7+.3*k),T,A,T===3?C:X,(.35+.65*k)*boost,q?0:time*(.6+1.2*k),u);}   // the rarity's sigil gathers under the tank (5E-2b2b)
  if(K==='nova'){   // a ring closes in on the tank again and again, faster as it fills
   const ph=(time*(1.4+2.2*k))%1,r=dim*(1-ph*.82);ring(x,y+.05,z,r,.1*u*boost,A,(.25+.55*k)*(1-ph*.3)*boost,40,key==='twin0'?.1:0,frame>>2);
   disc(x,y+.04,z,dim*.55*grow,B,.22*grow*boost);sprite(x,y+.7*u,z,(.5+.9*k)*u*boost*pulse,A,.8*CQ);sprite(x,y+.7*u,z,(.22+.4*k)*u*boost,C,CQ);
   if(key==='twin1'&&!q)for(let i=0;i<3;i++){const a=time*5+i*TAU/3;ring(x,y+.06,z,dim*(.2+.3*k),.07*u,X,.5*k,10,0,0,a,a+1.1);}
   if(key==='twin2')for(let i=0;i<2;i++)ring(x,y+.3*u+i*.5*u,z,(1.0-i*.25)*u*grow,.06*u,X,.6*k*boost,22,0,0);
  }else{
   disc(mx,y+.04,mz,(1.2+1.6*k)*u*boost,B,.3*grow*boost);sprite(mx,y+.55*u,mz,(.55+1.1*k)*u*boost*pulse,A,.85*CQ);sprite(mx,y+.55*u,mz,(.22+.45*k)*u*boost,C,CQ);
   if(key==='pulse1'||key==='siege1'||key==='moon'){const fq=q?frame>>5:frame>>1,a=hsh(fq)*TAU,r=(1+k)*u;bolt(mx+Math.cos(a)*r,y+.5*u,mz+Math.sin(a)*r,mx,y+.55*u,mz,.3*u,4,.045*u,key==='moon'?(oc===2?col('#ff5a4a'):col('#bfe6ff')):X,.9,fq);}   // reduced motion: the same arc held still, never a flash
   if(key==='pulse2'||key==='siege2')star(mx,y+.56*u,mz,(.8+1.5*k)*u*boost,4,time*1.5,X,.75*grow,.06*u);
   if(key==='moon'){const a0=ang+2.2,a1=ang+TAU-2.2;ring(mx,y+.06,mz,(1.5-.5*k)*u,.07*u,A,.8*grow,18,0,0,a0,a1);ring(mx,y+.06,mz,(2.1-.7*k)*u,.05*u,B,.6*grow,18,0,0,a0+.3,a1-.3);}
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
 function fxLock(e){const k=e.t/e.d,g=col('#ffcf4a'),w=col('#fff6cf');shock(e.x,e.y+.06,e.z,(.6+3.2*k)*e.u,(1.0-.6*k)*e.u,g,(1-k)*1.2,36);ring(e.x,e.y+.07,e.z,(.3+2.2*k)*e.u,.06*e.u,w,(1-k)*.9,30);
  star(e.x,e.y+.9*e.u,e.z,(1.4+1.2*k)*e.u,4,.4,w,(1-k),.07*e.u);disc(e.x,e.y+.05,e.z,3*e.u,g,.35*(1-k));}

 // ---- SUPER LEVEL (owner, Nov 13 2026): the timing bar's outcome is CONCENTRATION and richness, not mostly size.
 //   miss     diffuse: the same energy spread wide and thin: a soft, washed-out, sputtering core, a wide dim halo, the fewest effects
 //   hit      focused: a defined core and the super's own structures
 //   jackpot  concentrated: the halo pulls in, the core is narrower, white-hot and hard-edged, and it carries the most effects
 // Size steps only a little (OCA: x0.8 / x1 / x1.15; it was x0.62 / x1 / x1.38), so nothing grows until it looks ridiculous and
 // a drawn radius stays close to the radius that really hits. SPREAD: width of the soft parts; HOTW: width of the hot core;
 // HEAT: brightness of the hot parts.
 const OCA=[.8,1,1.15],SPREAD=[1.35,1,.82],HOTW=[1.5,1,.66],HEAT=[.5,1,1.3];
 // ---- RARITY (owner, Nov 13 2026): a higher rarity must LOOK stronger. Size belongs to the timing bar (a perfect common can be
 // larger than a missed rare); rarity is INTRICACY: how many distinct structures a super is built from.
 //   common (tier 0)  ONE structure and one accent: a rail and its diamonds, a wave front and its static, a fireball and its smoke
 //   rare (tier 1)    + a second structure wound into the first (a lightning coil, spiral arms, an implosion with crawling arcs),
 //                    a second colour, and a simple sigil on the ground
 //   epic (tier 2)    + a third layer of ornament (star, filaments and prominences; a dome of coils with ribs; a column, crown and
 //                    double fronts), and an ornate double sigil
 //   legendary        Moonfall: everything above in its own language: the lunar sigil with the phases of the moon, crescent fronts
 //                    riding the beam, an eclipse where it lands, moonlight rising from the lane; jackpot: red electricity sparking off the beam (arcsOff: never a ring round it)
 // The sigil is the one mark every family shares, so the ladder reads at a glance: none, single, double, lunar.
 const TIER={pulse0:0,twin0:0,siege0:0,pulse1:1,twin1:1,siege1:1,pulse2:2,twin2:2,siege2:2,moon:3};
 function sigil(x,y,z,r,T,A,X,a,sp,u){
  if(T<=0||a<=.01)return;const w=.045*u;
  if(T===1){   // rare: one broken ring and six ticks
   for(let i=0;i<3;i++){const a0=sp+i*TAU/3;ring(x,y,z,r,w,A,a,10,0,0,a0,a0+1.5);}
   for(let i=0;i<6;i++){const t=-sp*.6+i*TAU/6,c=Math.cos(t),sn=Math.sin(t);seg(x+c*r*1.08,y,z+sn*r*1.08,x+c*r*1.24,y,z+sn*r*1.24,w*.9,w*.3,X,a*.9);}
   return;}
  if(T===2){   // epic: two rings turning against each other, eight spokes, four diamonds
   for(let i=0;i<4;i++){const a0=sp+i*TAU/4;ring(x,y,z,r,w*1.2,A,a,9,0,0,a0,a0+1.2);}
   ring(x,y,z,r*.72,w*.7,X,a*.85,30,0,0);
   for(let i=0;i<8;i++){const t=-sp*.7+i*TAU/8,c=Math.cos(t),sn=Math.sin(t);seg(x+c*r*.76,y,z+sn*r*.76,x+c*r*.94,y,z+sn*r*.94,w,w*.3,X,a);}
   for(let i=0;i<4;i++){const t=sp+i*TAU/4+.6,c=Math.cos(t),sn=Math.sin(t),d=.11*u,cx=x+c*r,cz=z+sn*r;quad(cx-c*d*1.6,y+.005,cz-sn*d*1.6,cx-sn*d,y+.005,cz+c*d,cx+c*d*1.6,y+.005,cz+sn*d*1.6,cx+sn*d,y+.005,cz-c*d,0,0,0,0,0,0,0,0,X[0],X[1],X[2],a*.8);}
   disc(x,y-.005,z,r*.72,A,a*.12);return;}
  // legendary: the lunar sigil: three rings, twelve marks, six turning arcs, the eight phases of the moon, three orbiting motes
  ring(x,y,z,r,w,A,a,24,0,0);ring(x,y,z,r*1.12,w*.5,X,a*.7,24,0,0);
  for(let i=0;i<12;i++){const t=sp*.4+i*TAU/12,c=Math.cos(t),sn=Math.sin(t),l=i%3===0?.2:.1;seg(x+c*r*1.14,y,z+sn*r*1.14,x+c*r*(1.14+l),y,z+sn*r*(1.14+l),w*(i%3===0?1.2:.7),w*.25,X,a);}
  for(let i=0;i<6;i++){const a0=-sp+i*TAU/6;ring(x,y,z,r*.8,w*1.1,A,a*.9,6,0,0,a0,a0+.62);}
  ring(x,y,z,r*.5,w*.6,X,a*.8,18,0,0);
  for(let i=0;i<8;i++){const t=sp*.8+i*TAU/8,cx=x+Math.cos(t)*r*.65,cz=z+Math.sin(t)*r*.65;ring(cx,y+.005,cz,.13*u,.045*u,X,a,8,0,0,t,t+1.5+2.9*i/7);}   // crescent to gibbous (never a closed circle)
  for(let i=0;i<3;i++){const t=-sp*1.6+i*TAU/3;sprite(x+Math.cos(t)*r,y+.25*u,z+Math.sin(t)*r,.16*u,X,a*CQ);}
  disc(x,y-.005,z,r*.8,A,a*.12);
 }
 const sigR=(T,u)=>(T===1?1.55:T===2?1.95:2.45)*u;
 // ---- how a super is staged (Session 5E-2b2b; the designs, colours and outcomes are 5E-2b's) ----
 // ANTICIPATION (superCharge above), a 2-3 frame FLASH that is wider and whiter than what follows, the BODY: ONE primary
 // shape that carries the brightest, sharpest edge (a beam's core, a wave's front, a fireball) with dimmer and smaller
 // secondary energy around it, then a long DISSIPATION: the shape thins out, embers and smoke drift, a mark stays on the
 // ground (the marks below). No ribbon ends on a hard edge (segc / cap), no fire or smoke is a flat blob (puff / churn),
 // wave fronts are fronts and not hoops (shock), beams carry energy racing along them (flow), lightning is lightning (bolt).
 // ---- beams (Pulse x3, Moonbeam). a: length, b: hit half-width ----
 function superBeam(key,oc,x,y,z,ang,len,w,u,dy){
  const d=key==='pulse2'?(oc===2?.95:.6):key==='moon'?(oc===2?.95:.62):oc===2?.7:.48,e=spawn(fxBeam,d*(oc===0?.75:1),x,y,z,ang,len,w,u,key,oc),P=PAL[key]||PAL.pulse0;
  e.dy=dy||0;shake(oc===2?14:oc===1?8:4,oc===2?.5:.3);
  const sx=x+Math.cos(ang)*u,sz=z+Math.sin(ang)*u,L=len-u;
  // aftermath on the ground, each beam its own: a teal scorch line, crawling violet sparks, a molten trench, moonlit motes
  if(key==='pulse0'){if(oc>0)mark(1,oc===2?2.8:2.0,sx,y+.03,sz,w*(oc===2?.4:.3),ang,L,null,col('#00ffc8'));}
  else if(key==='pulse1'){if(oc>0){mark(1,oc===2?2.4:1.7,sx,y+.03,sz,w*.26,ang,L,null,col(P.a));mark(3,oc===2?2.8:2.0,sx,y+.03,sz,w*(oc===2?2.2:1.0),ang,L,null,col(P.x),u);}}
  else if(key==='pulse2')mark(1,oc===2?2.8:oc===1?1.9:1.0,sx,y+.03,sz,w*(oc===2?.8:.55),ang,L,null,col('#ff7a00'));
  else if(oc>0)mark(5,oc===2?2.4:1.6,sx,y+.03,sz,w*(oc===2?.42:.3),ang,L,null,oc===2?col('#ff2020'):col(P.a),u);
  return e;
 }
 function fxPillar(e){const k=e.t/e.d,u=e.u,f=1-k,h=(.4+2.6*Math.min(1,k*2.2))*u,o=col('#ff7a00'),y=col('#ffd24a'),w=col('#fff6d8');   // a column of flame standing up from the ground
  churn(e.x,e.y+.05,e.z,1.5*u,o,.5*f);puff(e.x,e.y+h*.25,e.z,1.05*u*(1-.3*k),o,.9*f);puff(e.x,e.y+h*.6,e.z,.8*u*(1-.3*k),y,.9*f);sprite(e.x,e.y+h,e.z,.36*u,w,f);}
 // the body every beam shares: its light on the ground, a soft outer glow, the flowing body, the hot core, a bloom at the
 // muzzle and where it ends. W: half-width now; gw / bw / cw: glow, body and core widths as shares of W
 function beamBody(e,W,A,B,C,env,fl,gw,bw,cw){
  const u=e.u,L=e.a,oc=e.oc,ca=Math.cos(e.ang),sa=Math.sin(e.ang),y=e.y+.55*u,ax=e.x+ca*1.1*u,az=e.z+sa*1.1*u,bx=e.x+ca*L,bz=e.z+sa*L,yb=y+(e.dy||0),gy=e.y+.04,sp=e.k==='moon'&&oc===0?1:SPREAD[oc],hw=HOTW[oc],ht=HEAT[oc];
  segc(ax,gy,az,bx,gy,bz,W*GLW*.5*sp,W*GLW*.5*sp,B,.11*env*(oc===0?.75:1),0,3);
  segc(ax,y,az,bx,yb,bz,W*gw*sp,W*gw*.86*sp,B,.42*env*(oc===0?.8:1),0,3);
  if(oc===0){   // a miss: unfocused. A washed body, and a soft core that sputters and loses its hold towards the far end
   const sf=quiet()?.8:.6+.4*hsh((frame>>1)*7+e.seed),mx=ax+(bx-ax)*.55,mz=az+(bz-az)*.55,my=y+(yb-y)*.55;
   segc(ax,y,az,bx,yb,bz,W*bw*1.15,W*bw,A,.4*env,0,2);
   seg(ax,y,az,mx,my,mz,W*cw*hw,W*cw*hw,C,.5*env*sf);segc(mx,my,mz,bx,yb,bz,W*cw*hw,W*cw*hw*.7,C,.26*env*sf,0,2);
   sprite(ax,y,az,W*bw*1.5,A,.4*env*CQ);return;}
  flow(ax,y,az,bx,yb,bz,W*bw,W*bw*.86,A,(oc===2?.74:.62)*env*fl,0);cap(bx,yb,bz,ca,0,sa,W*bw*.86,A,.4*env*fl);
  flow(ax,y,az,bx,yb,bz,W*cw*hw,W*cw*hw*.82,C,Math.min(1,.9*ht)*env,9);cap(bx,yb,bz,ca,0,sa,W*cw*hw*.82,C,.6*env);
  if(oc===2){   // a jackpot: concentrated. A white needle down the middle of a narrow, white-hot core (no hard lines along the edges: they read as ruled)
   const nd=Math.max(W*cw*.2,MW*.6);
   seg(ax,y+.01,az,bx,yb+.01,bz,nd,nd*.8,col('#ffffff'),env);}
  sprite(ax,y,az,W*bw*1.4,A,.55*env*CQ);sprite(ax,y,az,Math.max(W*cw*1.9,.28*u),C,.85*env*CQ);
  sprite(bx,yb,bz,W*bw*1.1,A,.4*env*CQ);
 }
 // a coil of electricity wound round a beam: it passes over the top of the beam (towards the camera: wide and bright) and
 // under it (thin and dim), so it reads as wrapped around it. rad: coil radius; pitch: length of one turn; spin: its phase
 const HOTR=[1,.86,.8],VIO=[.93,.86,1];
 function coil(e,y,rad,pitch,strands,wd,c1,c2,a,spin,fs,hot){hot=hot||HOTR;
  const u=e.u,L=e.a,ca=Math.cos(e.ang),sa=Math.sin(e.ang),ax=e.x+ca*1.1*u,az=e.z+sa*1.1*u,bx=e.x+ca*L,bz=e.z+sa*L,n=Math.max(12,Math.min(low()?34:64,Math.round((L-1.1*u)/pitch*14)));
  for(let s2=0;s2<strands;s2++){let px=0,py=0,pz=0,pf=0;const c=s2%2?c2:c1;
   for(let i=0;i<=n;i++){const f=i/n,ph=f*(L-1.1*u)/pitch*TAU+spin+s2*TAU/strands,tp=Math.min(1,f*7,(1-f)*7),h=Math.cos(ph),front=h*.5+.5,
     jx=(hsh(fs*31+i*7+s2*131+e.seed)-.5)*rad*.13,jy=(hsh(fs*17+i*13+s2*71+e.seed)-.5)*rad*.1,off=(Math.sin(ph)*rad+jx)*tp,
     fx=ax+(bx-ax)*f-sa*off,fz=az+(bz-az)*f+ca*off,fy=y+front*rad*.8*tp+jy*tp;
    if(i){const fr=(front+pf)/2,wk=wd*(.4+.8*fr),al=a*(.2+.8*fr);
     seg(px,py,pz,fx,fy,fz,wk*2.9,wk*2.9,c,al*.3);seg(px,py,pz,fx,fy,fz,wk*1.1,wk*1.1,c,al);if(fr>.45)seg(px,py,pz,fx,fy,fz,wk*.45,wk*.45,hot,al);}
    px=fx;py=fy;pz=fz;pf=front;}}
 }
 // electricity sparking OFF a beam (Moonfall's jackpot. Owner, Nov 13: "sparking off of the blue beam... I want it to look like
 // electricity", never a ring or circle round the beam): arcs leap from the beam's surface, most of them out and down to the
 // ground beside it, some over the surface back onto the beam further along; every arc is forked, holds its footing for a
 // tenth of a second while its shape writhes, then strikes somewhere else; short crackles hug the surface between them
 function arcsOff(e,y,W,n,c1,c2,a,fs){
  const u=e.u,L=e.a,ca=Math.cos(e.ang),sa=Math.sin(e.ang),ax=e.x+ca*1.1*u,az=e.z+sa*1.1*u,len=L-1.1*u;
  for(let i=0;i<n;i++){const sd0=(((fs+i*2)/3)|0)*131+i*977+e.seed;
   if(hsh(sd0+5)<.12)continue;
   const f=(i+hsh(sd0))/n,side=hsh(sd0+1)<.5?-1:1,px=ax+ca*len*f,pz=az+sa*len*f,sx=px-sa*W*.22*side,sz=pz+ca*W*.22*side,c=i%2?c2:c1,kind=hsh(sd0+2);   // every arc starts on the bright core
   if(kind<.3){const f2=Math.min(.98,f+.1+hsh(sd0+3)*.14),qx=ax+ca*len*f2-sa*W*.3*side,qz=az+sa*len*f2+ca*W*.3*side;   // over the surface, back onto the beam
    bolt(sx,y+.1*u,sz,qx,y+.1*u,qz,W*(.5+.5*hsh(sd0+6)),9,.13*u,c,a,sd0+fs,.4,1);}
   else{const reach=W*(.95+.75*hsh(sd0+3)),lean=(hsh(sd0+4)-.35)*W*1.1,gx=sx-sa*reach*side+ca*lean,gz=sz+ca*reach*side+sa*lean;   // out and down to the ground
    bolt(sx,y+.15*u,sz,gx,e.y+.06,gz,W*(.2+.3*hsh(sd0+6)),10,.15*u,c,a,sd0+fs,.5,1);disc(gx,e.y+.05,gz,.4*u,c1,.3*a);}
   sprite(sx,y+.1*u,sz,.12*u,HOTR,a*CQ);}   // a small spark where it leaves the beam (no glowing beads at the far ends)
  for(let i=0;i<n;i++){const sd0=fs*17+i*71+e.seed;if(hsh(sd0)<.5)continue;const f=hsh(sd0+1),side=hsh(sd0+2)<.5?-1:1,l=(.5+hsh(sd0+3))*u,px=ax+ca*len*f-sa*W*.2*side,pz=az+sa*len*f+ca*W*.2*side;
   bolt(px,y+.1*u,pz,px+ca*l-sa*W*.6*side,y+.1*u,pz+sa*l+ca*W*.6*side,.2*u,5,.07*u,i%2?c1:c2,a*.9,sd0,0,1);}   // short crackles, each rooted on the core too (none floats beside the beam)
 }
 function fxBeam(e,dt){
  const P=e.P,key=e.k,oc=e.oc,u=e.u,L=e.a,t=e.t,k=t/e.d,ca=Math.cos(e.ang),sa=Math.sin(e.ang),q=quiet();
  // flash (wider, whiter) -> body -> the beam narrows to a thread and goes out
  const env=t<.035?t/.035:Math.pow(Math.max(0,1-(t-.035)/(e.d-.035)),1.2),thin=k<.5?1:Math.max(.1,1-(k-.5)/.5*.9),punch=t<.08?1.3-.3*t/.08:1,fl=q?1:.9+.1*Math.sin(time*70+e.seed);
  const W=e.b*OCA[oc]*thin*punch,y=e.y+.55*u,ax=e.x+ca*1.1*u,az=e.z+sa*1.1*u,bx=e.x+ca*L,bz=e.z+sa*L,yb=y+(e.dy||0),A=col(P.a),B=col(P.b),C=col(P.c),X=col(P.x);
  const fs=frame>>(q?4:1);   // lightning re-draws every other frame (every 16th with reduced motion: no flicker)
  const flash=t<.09&&oc>0?1-t/.09:0,T=TIER[key]|0;
  sigil(e.x,e.y+.045,e.z,sigR(T,u),T,A,T===3?C:X,env*(oc===0?.4:1),q?0:t*2.2+e.seed,u);
  if(key==='pulse0'){   // PIERCE LANCE: a needle-straight teal rail shot, white-hot core, shock diamonds racing down it
   beamBody(e,W,A,B,C,env,fl,1.5,.62,.2);
   if(flash)star(ax,y+.02,az,(1.6+1.2*flash)*u,4,e.ang+.39,C,flash,.12*u);
   {const n=oc===2?7:oc===1?5:3,wt=col('#ffffff'),A2=col('#00ffc8'),da=oc===0?.5:1;for(let i=0;i<n;i++){const f=((i/n)+t*1.6)%1,cx=ax+(bx-ax)*f,cz=az+(bz-az)*f,r=Math.max(e.b*.5,W*.5)*(oc===2?1.3:1),r2=r*(oc===2?.95:1.15),ed=Math.min(1,f*6,(1-f)*6)*da;   // hard teal diamonds with a white heart: three dim ones on a miss, seven long sharp ones on a jackpot
     quad(cx-ca*r,y+.02,cz-sa*r,cx+sa*r2,y+.02,cz-ca*r2,cx+ca*r,y+.02,cz+sa*r,cx-sa*r2,y+.02,cz+ca*r2,0,0,0,0,0,0,0,0,A2[0],A2[1],A2[2],.5*env*ed);
     quad(cx-ca*r*.45,y+.03,cz-sa*r*.45,cx+sa*r2*.45,y+.03,cz-ca*r2*.45,cx+ca*r*.45,y+.03,cz+sa*r*.45,cx-sa*r2*.45,y+.03,cz+ca*r2*.45,0,0,0,0,0,0,0,0,wt[0],wt[1],wt[2],(oc===2?1:.8)*env*ed);}}
   if(oc===2){star(ax,y+.02,az,(1.5+.6*Math.sin(Math.min(1,k*1.6)*Math.PI))*u*thin,4,e.ang+.39,C,env,.1*u);star(bx,yb+.02,bz,1.3*u*thin,4,e.ang+.39,C,env*.8,.08*u);}   // jackpot: a hard four-point flare at the muzzle and at the far end (common: one accent, kept plain)
   if(!(e.f&1)){e.f|=1;const n=oc===0?4:12;for(let i=0;i<n*amt();i++){const f=rnd();part(1,ax+(bx-ax)*f,y,az+(bz-az)*f,-sa*(rnd()-.5)*5,1+rnd()*2,ca*(rnd()-.5)*5,.4,.34*u,.04*u,rnd()<.5?X:A,1,6,2,e.y);}}
  }else if(key==='pulse1'){   // ARC LANCE: a violet beam inside a double helix of lightning
   beamBody(e,W,A,B,C,env,fl,1.25,.42,.14);
   if(flash)star(ax,y+.02,az,(1.4+1.2*flash)*u,3,e.ang,X,flash,.1*u);
   coil(e,y-.1*u,W*(oc===2?1.2:oc===0?1.05:.95),3.4*u,2,(oc===2?.12:oc===0?.05:.09)*u,A,X,env*(oc===0?.55:1),q?0:-t*20,fs,VIO);
   if(oc===2){for(let i=0;i<6;i++){const f=(i+.5)/6,sx=ax+(bx-ax)*f,sz=az+(bz-az)*f,sd=(i%2?1:-1)*(1.4+hsh(e.seed+i)*.9)*u,gx=sx-sa*sd+ca*(hsh(e.seed+i*3)-.5)*1.4*u,gz=sz+ca*sd+sa*(hsh(e.seed+i*3)-.5)*1.4*u;   // jackpot: chain lightning forks to the ground on both sides
     if(hsh(fs*7+i)<.75){bolt(sx,y,sz,gx,e.y+.05,gz,.55*u,6,.085*u,A,env,fs*13+i,.3);disc(gx,e.y+.05,gz,.5*u,A,.3*env);}}
    if(!(e.f&2)&&t>.05){e.f|=2;for(let i=0;i<6;i++){const f=(i+.5)/6,sd=(i%2?1:-1)*(1.4+hsh(e.seed+i)*.9)*u,gx=ax+(bx-ax)*f-sa*sd,gz=az+(bz-az)*f+ca*sd;sparks(gx,e.y+.1,gz,5,3*u,X,.28*u,.4,1,e.y);}}}
  }else if(key==='pulse2'){   // SUNLANCE: a fat golden solar beam with a star at the muzzle and heat fronts rolling down it
   const pw=q?1:1+.08*Math.sin(time*38),G=col('#ffcf4a');
   beamBody(e,W*pw,A,B,C,env,1,2.0,1.1,.4);
   star(ax,y+.02,az,(oc===0?2.3:2.4+1.4*Math.sin(Math.min(1,k*1.4)*Math.PI))*u*(oc===2?1.3:1)*thin,4,.39+t*1.2,oc===0?C:G,env,(oc===0?.16:.22)*u);if(oc===0){sprite(ax,y,az,.7*u,C,.8*env*CQ);let px=ax,pz=az;for(let i=1;i<=12;i++){const f=i/12,off=Math.sin(f*17-t*8)*e.b*.25,x=ax+(bx-ax)*f-sa*off,z=az+(bz-az)*f+ca*off;seg(px,y+.03,pz,x,y+.03,z,.05*u,.05*u,C,.7*env);px=x;pz=z;}}   // a miss still carries the epic's star, and one bright filament down the beam
   if(oc>0){sprite(ax,y,az,1.2*u*env,C,.8*env*CQ);
    for(let i=0;i<(oc===2?4:3);i++){const n=oc===2?4:3,f=((i/n)+t*1.25)%1,cx=ax+(bx-ax)*f,cz=az+(bz-az)*f,ed=Math.min(1,f*5,(1-f)*5);   // heat fronts: short bright chevrons of light riding the beam, not hoops
     segc(cx-sa*W*1.25-ca*W*.5,y+.02,cz+ca*W*1.25-sa*W*.5,cx+ca*W*.35,y+.02,cz+sa*W*.35,.1*u,.26*u,G,.8*env*ed,0,3);segc(cx+sa*W*1.25-ca*W*.5,y+.02,cz-ca*W*1.25-sa*W*.5,cx+ca*W*.35,y+.02,cz+sa*W*.35,.1*u,.26*u,G,.8*env*ed,0,3);}}
   {const n=oc===2?12:oc===1?8:6;for(let i=0;i<n;i++){const sd=i%2?1:-1,f=((i+.5)/n+t*.35+hsh(e.seed+i)*.05)%1,ed=Math.min(1,f*7,(1-f)*7)*(oc===0?.75:1),rx=ax+(bx-ax)*f-sa*W*.95*sd,rz=az+(bz-az)*f+ca*W*.95*sd,ln=W*(1.1+.9*hsh(e.seed+i*3))*(.7+.3*Math.sin(t*9+i)),lean=.55+.3*hsh(e.seed+i*7);   // epic: solar flares, tongues of fire rooted on the beam's edge and swept forward
     segc(rx,y+.02,rz,rx+(ca*lean-sa*sd*(1-lean))*ln,y+.02,rz+(sa*lean+ca*sd*(1-lean))*ln,.2*u,.02*u,i%3?G:X,.85*env*ed,0,1);}}
   if(oc>0)for(let i=0;i<(oc===2?3:2);i++){const a0=e.ang+(oc===2?1.3+i*1.84:1.57+i*3.14)+t*1.6;ring(ax+Math.cos(a0)*1.3*u,y+.02,az+Math.sin(a0)*1.3*u,.7*u,.065*u,X,.8*env,10,0,0,a0-1.3,a0+1.3);}   // prominences: arcs of fire looping off the muzzle star
   if(oc===2){const n=6;for(let i=0;i<n;i++){const at=.08+i*.06;if(t>=at&&!(e.f&(4<<i))){e.f|=(4<<i);const f=(i+.8)/n,px=ax+(bx-ax)*f,pz=az+(bz-az)*f;   // jackpot: flame columns erupt along the line, one after another
      spawn(fxPillar,.55,px,e.y,pz,0,0,0,u,key,2);for(let j=0;j<8*amt();j++)part(1,px+(rnd()-.5)*e.b,e.y+.3,pz+(rnd()-.5)*e.b,(rnd()-.5)*2.5,3+rnd()*4,(rnd()-.5)*2.5,.6+rnd()*.3,.5*u,.08*u,j%3?A:X,1,7,.4,e.y);smoke(px,e.y+.6,pz,2,.4*u,col('#2a2622'),1.0*u,1.2,1.4);}}}
   else if(!(e.f&1)&&oc>0){e.f|=1;for(let i=0;i<10*amt();i++){const f=rnd();part(1,ax+(bx-ax)*f,e.y+.1,az+(bz-az)*f,(rnd()-.5)*2,2+rnd()*3,(rnd()-.5)*2,.6,.4*u,.06*u,A,1,3,.5,e.y);}}
  }else{   // MOONFALL (owner-fixed): miss = a thinner beam; normal = blue beam with thin blue electricity; jackpot = a thicker beam with RED electricity SPARKING OFF the blue beam (owner, Nov 13: real electricity leaping from it, no ring or circle round it)
   const wb=oc===0?.68:oc===2?1.25:1,Wm=e.b*wb*thin*punch,R1=col('#ff2020'),R2=col('#ff5a3a'),Wc=col('#dbeafe'),Bl=col('#7fc8ff');
   beamBody(e,Wm,col('#3f8cff'),B,Wc,env,fl,1.45,.8,oc===2?.3:.2);
   if(flash)star(ax,y+.02,az,(1.8+1.6*flash)*u,4,e.ang+.39,Wc,flash,.14*u);
   if(oc>0){const nf=oc===2?4:6;for(let i=0;i<nf;i++){const off=((i+.5)/nf-.5)*Wm*.85;bolt(ax-sa*off,y+.03,az+ca*off,bx-sa*off,yb+.03,bz+ca*off,Wm*.3,Math.round(L/u/.7),.04*u,i%2?col('#3fa0ff'):col('#62b8ff'),env,fs*17+i*101+e.seed,.22,2,Wm*.3);}   // hair-thin, saturated blue filaments hugging the beam (their forks are short: nothing blue leaves the beam's width)
    const ng=oc===2?7:5;for(let i=0;i<ng;i++){const f=((i/ng)+t*.9)%1,ed=Math.min(1,f*6,(1-f)*6),gx=ax+(bx-ax)*f,gz=az+(bz-az)*f,op=.6+1.6*i/(ng-1);ring(gx,y+.045,gz,.24*u,.06*u,Wc,.95*env*ed,8,0,0,e.ang+Math.PI/2-op,e.ang+Math.PI/2+op);}}   // the phases of the moon ride down the beam, new moon to full (inside it: nothing goes round it)
   if(oc>0){const n=oc===2?6:4;for(let i=0;i<n;i++){const f=(i+.5)/n,px=ax+(bx-ax)*f,pz=az+(bz-az)*f,h=(2.1+1.1*hsh(e.seed+i*5))*u*Math.min(1,t/.12)*thin;for(let j=1;j<4;j++)sprite(px,y+h*j/3,pz,(.4-.08*j)*u,j>1?A:Wc,.42*env*(1-.2*j)*CQ);}   // legendary: shafts of moonlight stand up out of the beam
    const m=oc===2?5:4;for(let i=0;i<m;i++){const f=(i+.7)/(m+.4),on=clamp((t-.03*i)/.08,0,1);if(on<=0)continue;for(let sd=-1;sd<=1;sd+=2){const gx=ax+(bx-ax)*f-sa*e.b*wb*1.85*sd,gz=az+(bz-az)*f+ca*e.b*wb*1.85*sd,a0=e.ang+(sd>0?Math.PI/2:-Math.PI/2),op=.5+1.7*i/(m-1);ring(gx,e.y+.05,gz,.28*u,.07*u,Wc,.8*env*on,8,0,0,a0-op,a0+op);}}}   // and the phases of the moon light up along both sides of the lane, new moon to full
   if(oc===2&&env>.08)arcsOff(e,y,e.b*wb*punch*(.6+.4*thin),low()?8:13,R1,R2,Math.min(1,env*1.3),fs);   // red electricity sparking off the beam
   if(oc>0){const n=oc===2?6:4;for(let i=0;i<n;i++){const f=((i/n)+t*1.7+hsh(e.seed+i)*.3)%1,ed=Math.min(1,f*6,(1-f)*6),off=(hsh(e.seed+i*7)-.5)*Wm*1.1,hx=ax+(bx-ax)*f-sa*off,hz=az+(bz-az)*f+ca*off,tl=1.7*u;   // legendary: falling stars race down inside the beam
     segc(hx-ca*tl,y+.04,hz-sa*tl,hx,y+.04,hz,.02*u,.11*u,C,.85*env*ed,0,2);sprite(hx,y+.04,hz,.2*u,C,env*ed*CQ);}}
   if(!(e.f&1)){e.f|=1;const n=(oc===2?26:oc===1?14:6)*amt();for(let i=0;i<n;i++){const f=rnd();part(1,ax+(bx-ax)*f-sa*(rnd()-.5)*Wm,y,az+(bz-az)*f+ca*(rnd()-.5)*Wm,(rnd()-.5)*1.5,2.5+rnd()*4,(rnd()-.5)*1.5,.5+rnd()*.4,.5*u,.05*u,oc===2&&i%2?R1:i%3?col('#ccefff'):C,1,1.5,.4,e.y);}}
  }
  // embers shed along the beam while it burns (the dissipation carries on after the light has gone)
  if(!q&&oc>0&&k<.8&&rnd()<lastDt*(low()?14:36)){const f=rnd(),sd=(rnd()-.5)*2*W;part(1,ax+(bx-ax)*f-sa*sd,y,az+(bz-az)*f+ca*sd,-sa*sd*1.5,1+rnd()*2.5,ca*sd*1.5,.45+rnd()*.3,.3*u,.04*u,key==='moon'&&oc===2&&rnd()<.5?col('#ff5a4a'):rnd()<.5?X:A,.95,3,1.2,e.y);}
 }
 // ---- novas (Twin x3). a: radius ----
 function superNova(key,oc,x,y,z,r,u){
  const d=oc===2?(key==='twin1'?1.1:.95):oc===1?.65:.45,e=spawn(fxNova,d,x,y,z,rnd()*TAU,r,0,u,key,oc),P=PAL[key]||PAL.pulse0;
  shake(oc===2?13:oc===1?7:3,oc===2?.5:.3);
  if(key==='twin0'){if(oc>0)mark(3,oc===2?2.8:2.0,x,y+.03,z,r*.95,0,0,null,col(P.a),u);}
  else if(key==='twin1'){mark(4,oc===2?3.0:oc===1?2.2:1.1,x,y+.03,z,r*(oc===0?.6:.9),0,0,null,col('#7c3aed'),u);if(oc===2)mark(3,2.2,x,y+.03,z,r*.9,0,0,null,col('#d8b4fe'),u);}
  else{mark(2,oc===2?2.8:1.5,x,y+.03,z,r*(oc===2?1.0:.7),rnd()*TAU,oc===2?9:oc===1?5:3,col('#120a04'),col('#ff3d00'),u);}
  if(oc>0)mark(0,oc===2?2.2:1.3,x,y+.025,z,r*.5,0,0);
  return e;
 }
 function fxNova(e){
  const P=e.P,key=e.k,oc=e.oc,u=e.u,R=e.a,t=e.t,k=t/e.d,q=quiet(),A=col(P.a),B=col(P.b),C=col(P.c),X=col(P.x),fs=frame>>(q?4:1),y=e.y+.08;
  const ex=1-Math.pow(1-Math.min(1,t/(oc===2?.15:oc===0?.26:.2)),2.4),fade=k<.35?1:Math.max(0,1-(k-.35)/.65),rr=R*(.12+.88*ex),flash=t<.08&&oc>0?1-t/.08:0,fw=(1.3-.75*ex)*u*(oc===0?.55:oc===2?1.3:1),fa=fade*(oc===0?.5:oc===2?1.15:1),T=TIER[key]|0;   // level: a miss is a thin faint ripple that rolls out slowly; a jackpot snaps out with a thick bright front   // the wave reaches its full radius in 0.2 s (the hit lands at once), then lingers and fades; its front starts thick and sharpens
  sigil(e.x,e.y+.045,e.z,Math.max(sigR(T,u),R*.42)*(.8+.2*ex),T,A,X,fade*(oc===0?.4:1),q?0:t*2.2+e.seed,u);
  if(key==='twin0'){   // STATIC NOVA: a jagged tracer-yellow wave front snaps outward with lightning spokes to the rim; nothing smooth
   const Y=col(P.a),I=col('#fffbe0'),ns=oc===0?0:oc===1?4:6;   // the Twin Repeater's own tracer yellow with a white-hot edge
   churn(e.x,e.y+.05,e.z,R*(.5+.6*ex),col('#b89b00'),(oc===2?.08:.11)*fade);if(flash&&oc>0)disc(e.x,e.y+.06,e.z,rr*(oc===2?1.2:1),oc===2?I:Y,(oc===2?.75:.45)*flash);   // a filled flash under the wave
   shock(e.x,y,e.z,rr,fw,Y,fa,48,.14,fs);ring(e.x,y+.02,e.z,rr,.07*u,I,fa,48,.2,fs);if(oc===2)ring(e.x,y+.03,e.z,Math.max(.1,rr-.34*u),.045*u,I,fade,48);   // the front, and static crawling along it
   if(oc===2){const f2=clamp((t-.1)/(e.d*.45),0,1);if(f2>0&&f2<1)shock(e.x,y+.05,e.z,R*(.3+1.0*f2),(1.2-.6*f2)*u,I,(1-f2)*(1-f2),48,.1,fs+7);}   // jackpot: a second, white front follows the first
   for(let i=0;i<ns;i++){if(hsh(fs*3+i)<.85){const a=e.ang+i/ns*TAU,rch=rr*(oc===2?1.15:.72);bolt(e.x+Math.cos(a)*.9*u,y+.3,e.z+Math.sin(a)*.9*u,e.x+Math.cos(a)*rch,y,e.z+Math.sin(a)*rch,.45*u,6,(oc===2?.1:.08)*u,i%2?Y:I,fade,fs*11+i,oc===2?.28:0);}}
   if(oc>0)sprite(e.x,e.y+.6*u,e.z,(.6+.8*flash)*u*(oc===2?.8:1),I,(.5+.5*flash)*fade*CQ);
   if(!(e.f&1)){e.f|=1;const n=(oc===0?10:oc===1?24:36)*amt();for(let i=0;i<n;i++){const a=i/n*TAU;part(1,e.x,y+.3,e.z,Math.cos(a)*R*2.4,.6+rnd(),Math.sin(a)*R*2.4,.42,.45*u,.07*u,i%2?I:Y,1,2,2.6,e.y);}}
  }else if(key==='twin1'){   // STORM NOVA: a violet storm cloud with thick spiral arms sweeping round; jackpot calls lightning down from the sky
   const V=col('#7c3aed'),Lv=col('#c084fc'),Rm=col('#a855f7'),arms=3,spin=e.ang+(q?0:t*(TAU*.75/.6));
   churn(e.x,e.y+.05,e.z,rr*1.12,V,(oc===2?.15:.19)*fade);
   for(let i=0;i<arms;i++){const a0=spin+i/arms*TAU,N=9;let px=0,pz=0,pw=0;for(let j=0;j<=N;j++){const f=j/N,a=a0+f*2.4,r2=rr*(.14+.86*f),x=e.x+Math.cos(a)*r2,z=e.z+Math.sin(a)*r2,w=(.44-.34*f)*u*(oc===0?.6:OCA[oc]);   // each arm tapers from the hub to the rim (a miss: thin, but drawn)
     if(j){segc(px,y+.03,pz,x,y+.03,z,pw*1.9,w*1.9,Lv,.5*Math.max(fa,.8*fade),0,j===N?2:0);seg(px,y+.04,pz,x,y+.04,z,pw*.6,w*.6,C,Math.max(fa,.85*fade));}px=x;pz=z;pw=w;}}
   shock(e.x,y,e.z,rr,fw*.8,Rm,fa,44,.04,fs);ring(e.x,y+.01,e.z,rr,.05*u,C,fa*.9,44,.05,fs);if(oc===2)ring(e.x,y+.03,e.z,Math.max(.1,rr-.34*u),.045*u,C,fade,44);
   sprite(e.x,e.y+.6*u,e.z,(.7+.6*flash)*u,C,(.45+.55*flash)*fade*CQ);
   if(oc>0)for(let i=0;i<3;i++){if(hsh(fs*7+i)<.7){const a=hsh(fs*13+i)*TAU,d=rr*(.3+.5*hsh(fs*3+i)),a2=a+1+hsh(fs*5+i);bolt(e.x+Math.cos(a)*d,y+.2,e.z+Math.sin(a)*d,e.x+Math.cos(a2)*d,y+.2,e.z+Math.sin(a2)*d,.3*u,4,.06*u,X,fade,fs*17+i,0,1);}}   // rare: lightning flickers inside the storm
   if(oc===2){for(let i=0;i<8;i++){const at=(i<2?0:.05+(i-2)*.09),lt=t-at;if(lt>=0&&lt<.3){const a=hsh(e.seed+i*5)*TAU,d=R*(.3+.6*hsh(e.seed+i*9)),sx=e.x+Math.cos(a)*d,sz=e.z+Math.sin(a)*d,al=1-lt/.3;
      bolt(sx+(hsh(e.seed+i)-.5)*1.5*u,e.y+7*u,sz-2*u,sx,e.y+.1,sz,.45*u,9,.1*u,i%2?Lv:col('#d8b4fe'),al,fs*5+i,.4);disc(sx,e.y+.06,sz,1.0*u,Lv,.3*al);sprite(sx,e.y+.4,sz,(.14+.2*al)*u,C,al*CQ);
      if(!(e.f&(2<<i))){e.f|=(2<<i);sparks(sx,e.y+.2,sz,7,4*u,X,.3*u,.4,1.2,e.y);mark(0,.9,sx,e.y+.025,sz,.9*u,0,0);shake(6,.15);}}}}
   if(!(e.f&1)){e.f|=1;const n=(oc===0?6:18)*amt();for(let i=0;i<n;i++){const a=rnd()*TAU;part(1,e.x,y+.4,e.z,Math.cos(a)*R*1.6-Math.sin(a)*3,1+rnd()*2,Math.sin(a)*R*1.6+Math.cos(a)*3,.5,.4*u,.06*u,i%3?Lv:X,1,2,2,e.y);}}
  }else{   // HELIX NOVA: an orange-to-red dome of stacked coil rings rises from a molten ground ring; jackpot rains fire inside it
   const O=col('#ff8a00'),Rd=col('#ff3d00'),layers=oc===0?4:5;
   churn(e.x,e.y+.05,e.z,R*(.55+.6*ex),Rd,(oc===2?.2:.26)*fade);if(flash&&oc>0)disc(e.x,e.y+.06,e.z,rr,col(P.x),.5*flash);
   shock(e.x,y,e.z,rr*1.02,fw,Rd,fa*.95,44,.04,fs>>2);ring(e.x,y+.01,e.z,rr*1.02,.07*u,col(P.x),fa,44);if(oc===2)ring(e.x,y+.03,e.z,Math.max(.1,rr-.34*u),.045*u,C,fade,44);
   for(let i=1;i<layers;i++){const h=i/layers,rad=rr*Math.cos(h*1.4),yy=e.y+.15+Math.sin(h*1.4)*R*.8*ex,w=(.26-.045*i)*u*(oc===0?.5:oc===2?1.15:1),c=i%2?O:col(P.x),al=fa*(oc===2?1.25-.08*i:1-.12*i);ring(e.x,yy,e.z,rad,w*1.2,c,al,18,0,0,.12,Math.PI-.12);ring(e.x,yy,e.z,rad,w*.45,c,al*.4,18,0,0,Math.PI+.12,TAU-.12);}   // a dome of coils: each thick and bright on the near side, thin and dim behind, so it reads as a dome and not as hoops
   puff(e.x,e.y+R*.8*ex,e.z,(oc===0?.5:.7)*u,O,fa*.8);
   if(oc>0)for(let i=0;i<(oc===2?8:6);i++){const a=e.ang*2+i/(oc===2?8:6)*TAU-(q?0:t*1.4);puff(e.x+Math.cos(a)*rr,e.y+.4*u,e.z+Math.sin(a)*rr,(.2+.08*hsh(e.seed+i))*u,i%2?O:Rd,.7*fade);}   // epic: tongues of flame stand on the front
   if(oc===2&&t>.03&&t<e.d*.85){const n=low()?10:22,Yc=col('#ffd66b');for(let i=0;i<n;i++){const ph=(t*2.4+hsh(e.seed+i*7))%1,a=hsh(e.seed+i*3+((t*2.4+hsh(e.seed+i*7))|0)*13)*TAU,d=Math.sqrt(hsh(e.seed+i*5))*R*.9,fx=e.x+Math.cos(a)*d,fz=e.z+Math.sin(a)*d,fy=e.y+(1-ph)*4.2*u;segc(fx+.2*u,fy+1.3*u,fz,fx,fy,fz,.03*u,.14*u,i%2?O:Yc,Math.min(1,(1-ph)*5),0,2);if(ph>.86){const sp2=(ph-.86)/.14;shock(fx,e.y+.06,fz,(.2+.5*sp2)*u,.2*u,Yc,(1-sp2),10);}}}   // jackpot: fire rain: falling streaks inside the ring, each with a small splash where it lands
   if(!(e.f&1)){e.f|=1;const n=(oc===0?8:20)*amt();for(let i=0;i<n;i++){const a=rnd()*TAU;part(1,e.x+Math.cos(a)*R*.3,y+.3,e.z+Math.sin(a)*R*.3,Math.cos(a)*R*1.3,3+rnd()*4,Math.sin(a)*R*1.3,.6,.45*u,.08*u,i%2?O:Rd,1,7,1,e.y);}}
  }
 }
 // ---- shells (Siege x3): the shot in flight (every frame) and where it lands ----
 function superShell(key,oc,x,y,z,u){
  const P=PAL[key]||PAL.siege0,A=col(P.a),C=col(P.c),B=col(P.b),X=col(P.x),s=OCA[oc],q=quiet(),puff=q?sprite:puffT;   // reduced motion: a shell in flight is a plain glow (the fire noise is fixed to the ground: a moving puff would crawl through it)
  if(key==='siege1'){sprite(x,y,z,1.0*u*s,A,.8);sprite(x,y,z,.42*u*s,C,1);{const fq=q?frame>>5:frame;for(let i=0;i<(oc===0?1:2);i++){const a=hsh(fq*3+i)*TAU;bolt(x,y,z,x+Math.cos(a)*1.3*u*s,y-.3*u,z+Math.sin(a)*1.3*u*s,.3*u,4,.06*u,X,.9,fq+i,0,1);}}
   if(rnd()<lastDt*50*amt())part(1,x,y,z,(rnd()-.5),0,(rnd()-.5),.3,.5*u*s,.05*u,A,.8,0,0);}
  else if(key==='siege2'){puff(x,y,z,1.6*u*s,B,.75);sprite(x,y,z,.95*u*s,A,.95);sprite(x,y,z,.42*u*s,C,1);star(x,y+.01,z,1.5*u*s,2,time*6,col('#fff3b0'),.7,.08*u);
   if(rnd()<lastDt*70*amt())part(1,x+(rnd()-.5)*.4*u,y,z+(rnd()-.5)*.4*u,(rnd()-.5)*1.5,-1-rnd()*2,(rnd()-.5)*1.5,.5,.55*u*s,.08*u,rnd()<.5?A:col('#fff3b0'),1,3,0);}
  else{puff(x,y,z,1.15*u*s,A,.8);sprite(x,y,z,.48*u*s,C,1);
   if(rnd()<lastDt*50*amt())part(1,x,y,z,(rnd()-.5),.2,(rnd()-.5),.3,.6*u*s,.08*u,A,.9,0,0);
   if(rnd()<lastDt*40*amt())part(0,x,y,z,0,.4,0,1.0,.55*u,1.5*u,col('#1a1a1a'),.6,0,.5);}
 }
 function superBlast(key,oc,x,y,z,r,u){
  const d=key==='siege2'?(oc===2?1.5:1.0):oc===2?1.1:.75,e=spawn(fxBlast,d*(oc===0?.7:1),x,y,z,rnd()*TAU,r,0,u,key,oc),P=PAL[key]||PAL.pulse0;
  shake(oc===2?(key==='siege2'?20:16):oc===1?11:5,oc===2?.65:.4);
  mark(0,oc===2?3.6:oc===1?2.8:1.6,x,y+.025,z,r*(oc===2?1.05:oc===1?.8:.5),0,0);
  if(key==='siege0'&&oc>0)mark(2,oc===2?3.0:2.2,x,y+.03,z,r*(oc===2?.95:.7),rnd()*TAU,oc===2?7:5,col('#0a0806'),col('#ff5a14'),u);
  if(key==='siege2')mark(2,oc===2?3.2:oc===1?2.2:1.4,x,y+.03,z,r*(oc===2?1.7:oc===1?1.4:1.0),rnd()*TAU,oc===2?9:oc===1?6:4,null,col(oc===2?'#ffd24a':'#ffb020'),u);   // glowing gold cracks (brightest and longest on a jackpot); no dark needles
  if(key==='siege1'){mark(3,oc===2?3.0:oc===1?2.2:1.2,x,y+.03,z,r*(oc===2?1.5:1.1),0,0,null,col(oc===2?'#67e8f9':P.a),u);mark(4,oc===2?2.6:1.8,x,y+.03,z,r*(oc===0?.5:.8),0,0,null,col(P.b),u);}
  return e;
 }
 function fxBlast(e){
  const P=e.P,key=e.k,oc=e.oc,u=e.u,R=e.a*OCA[oc],t=e.t,k=t/e.d,q=quiet(),A=col(P.a),B=col(P.b),C=col(P.c),X=col(P.x),fs=frame>>(q?4:1),y=e.y+.08,fade=Math.max(0,1-k);
  const ex=1-Math.pow(1-Math.min(1,t/(e.d*.4)),2.4),flash=t<.075&&oc>0?1-t/.075:0,T=TIER[key]|0,ht=oc===0?.55:1,hot=oc===2?Math.max(0,1-t/.2):0,W1=col('#ffffff');   // level: ht dims a miss's fire; hot: a jackpot's white-hot heart in its first 0.2 s
  sigil(e.x,e.y+.045,e.z,Math.max(sigR(T,u),e.a*.9)*(.75+.25*ex),T,A,X,fade*(oc===0?.4:1),q?0:t*2.2+e.seed,u);
  if(key==='siege0'){   // SIEGE BLAST: a rolling orange-red fireball under a growing pall of black smoke, a hard shock front, shrapnel
   const fb=Math.max(0,1-t/(e.d*.62)),K=col('#170b07'),F0=col('#c2260a'),F1=col('#ff4a10'),F2=col('#ff7412'),F3=col('#ffd2a0');
   disc(e.x,e.y+.045,e.z,R*1.25*(.5+.5*ex),BLK,.02,.55*Math.min(1,t/.05)*fade);   // the ground under the fire goes dark first, so the fire is saturated on it (light added to pale ground washed out to yellow-green)
   churn(e.x,e.y+.05,e.z,R*1.5*(.4+.6*ex),F0,.5*fade);
   if(flash){disc(e.x,e.y+.07,e.z,R*(1.1+.3*oc),F3,.6*flash);if(oc>0)star(e.x,e.y+R*.3,e.z,R*(1.2+.8*flash),5,e.ang,F3,flash,.12*u);}
   puff(e.x,e.y+R*.35*ex,e.z,R*(.5+.8*ex),F0,.9*fb*ht);puff(e.x,e.y+R*.4*ex,e.z,R*(.4+.62*ex),F1,.95*fb*ht);puff(e.x,e.y+R*.45*ex,e.z,R*(.26+.4*ex),F2,.9*fb*ht);
   {const nt=oc===2?12:oc===1?9:5;for(let i=0;i<nt;i++){const a=e.ang+(i+.6*hsh(e.seed+i*7))/nt*TAU,r0=R*(.25+.3*ex),r1=r0+R*(.45+.5*hsh(e.seed+i*3))*(.4+.6*ex)*fb;segc(e.x+Math.cos(a)*r0,e.y+.35*u,e.z+Math.sin(a)*r0,e.x+Math.cos(a)*r1,e.y+.25*u,e.z+Math.sin(a)*r1,(.2+.14*hsh(e.seed+i))*u,.02*u,i%3?F2:F1,.85*fb*ht,0,1);}}   // tongues of flame lick outward: sharp, uneven, tapered
   if(oc>0)sprite(e.x,e.y+R*.45*ex,e.z,R*(.13+.14*ex),F3,fb*fb*CQ);
   {const sn=oc===2?9:7,sg=Math.min(1,t/(e.d*.9));for(let i=0;i<sn;i++){const a=e.ang+i/sn*TAU+t*.5,d=R*(.95+.7*sg)*(.85+.3*hsh(e.seed+i));puff(e.x+Math.cos(a)*d,e.y+R*(.3+.8*sg),e.z+Math.sin(a)*d,R*(.36+.5*sg),K,.03,.5*Math.min(1,t/.08)*(1-Math.max(0,k-.4)/.5));}}   // black smoke rolls out round the fire's edge, drawn over it (gone by the time the fire is)
   if(hot)sprite(e.x,e.y+R*.42*ex,e.z,R*(.16+.1*hot),W1,hot*.9*CQ);   // jackpot: a white-hot heart
   shock(e.x,y,e.z,R*(.2+1.3*ex),(.8-.45*ex)*u*(oc===0?.6:1),F2,fade*fade*(oc===0?.5:oc===2?1:.8),44,.12,e.seed);   // a ragged orange front at every level (never a clean pale hoop)
   if(oc===2)for(let i=0;i<3;i++){const at=.05+i*.07,lt=t-at;if(lt>=0){const a=e.ang+i*2.3+.6,sz0=i===0?1:i===1?.72:.5,sx=e.x+Math.cos(a)*R*(.6+.12*i),sz=e.z+Math.sin(a)*R*(.6+.12*i),f=Math.max(0,1-lt/.45);   // jackpot: three secondary bursts of different sizes close in round it, each a clump of flame tongues
      for(let j=0;j<4;j++){const b2=a+j*1.57+hsh(e.seed+i*7+j),ln=R*sz0*(.3+.25*hsh(e.seed+i*3+j))*(.5+.5*f);segc(sx,e.y+.35*u,sz,sx+Math.cos(b2)*ln,e.y+.3*u+ln*.5,sz+Math.sin(b2)*ln,.2*u*sz0,.02*u,j%2?F2:F1,.9*f,0,1);}
      puff(sx,e.y+.5*u,sz,R*.22*sz0*(1.3-f*.4),F1,f);sprite(sx,e.y+.5*u,sz,R*.08*sz0,F3,f*f*CQ);if(!(e.f&(2<<i))){e.f|=(2<<i);sparks(sx,e.y+.3,sz,8,5*u,X,.3*u,.5,1.4,e.y);mark(0,1.6,sx,e.y+.025,sz,R*.3*sz0,0,0);shake(7,.18);}}}
   if(!(e.f&1)){e.f|=1;sparks(e.x,e.y+.4,e.z,oc===0?8:oc===1?22:34,(6+3*oc)*u,X,.34*u,.7,1.6,e.y);smoke(e.x,e.y+.5,e.z,oc===0?5:oc===1?12:18,R*.5,K,1.7*u,oc===2?2.4:1.8,1.5);
    for(let i=0;i<(oc===0?4:12)*amt();i++)part(1,e.x+(rnd()-.5)*R*.6,e.y+.3,e.z+(rnd()-.5)*R*.6,(rnd()-.5)*2,3+rnd()*5,(rnd()-.5)*2,.6+rnd()*.5,.7*u,.12*u,A,1,2,.6,e.y);}
  }else if(key==='siege1'){   // RAIL BLAST: the air folds inward to a point through a dark lens, then a violet sphere bursts and lightning crawls over the ground
   const T0=.14,imp=Math.min(1,t/T0),after=Math.max(0,t-T0),bx=1-Math.pow(1-Math.min(1,after/(e.d*.3)),2.2),bf=Math.max(0,1-after/(e.d-T0)),ns=oc===0?10:oc===1?16:24,E=col('#67e8f9');
   if(t<T0){const lr=R*(oc===0?1.3:oc===1?1.45:1.6)*(1-imp*.45);disc(e.x,e.y+.05,e.z,lr,BLK,.02,.85);shock(e.x,e.y+.06,e.z,lr*.8,.5*u,A,.95,40);   // the dark lens with a bright rim
    for(let i=0;i<ns;i++){const a=e.ang+(i+.7*hsh(e.seed+i))/ns*TAU,r0=R*1.7*(1-imp*.75)*(.7+.55*hsh(e.seed+i*3)),r1=r0*(.42+.2*hsh(e.seed+i*7)),a1=a+.32+.2*hsh(e.seed+i*5);segc(e.x+Math.cos(a)*r0,e.y+.3,e.z+Math.sin(a)*r0,e.x+Math.cos(a1)*r1,e.y+.3,e.z+Math.sin(a1)*r1,.03*u,(.08+.08*hsh(e.seed+i*9))*u,i%2?A:X,.95,0,3);}   // streaks rushing in: uneven, curling inward, thickening as they close
    if(oc>0)for(let i=0;i<(oc===2?4:3);i++){const a=hsh(fs*7+i)*TAU,b2=a+.7+.5*hsh(fs*3+i);bolt(e.x+Math.cos(a)*lr*.8,e.y+.15,e.z+Math.sin(a)*lr*.8,e.x+Math.cos(b2)*lr*.8,e.y+.15,e.z+Math.sin(b2)*lr*.8,.3*u,4,.055*u,X,.9,fs*11+i,0,1);}   // static already crawling along the rim
    sprite(e.x,e.y+.6*u,e.z,(.3+1.0*imp)*u,C,CQ);}
   else{const bfl=after<.07?1-after/.07:0;
    churn(e.x,e.y+.05,e.z,R*1.5*bx,B,.65*bf);if(bfl)disc(e.x,e.y+.07,e.z,R*1.5,C,.7*bfl);
    puff(e.x,e.y+R*.3,e.z,R*(.46+.66*bx),B,.9*bf);puff(e.x,e.y+R*.3,e.z,R*(.32+.46*bx),A,.95*bf*bf*ht);if(oc>0)sprite(e.x,e.y+R*.3,e.z,R*(.3-.12*bx)*(oc===2?.75:1),C,bf*bf*CQ);
    if(oc===2&&after<.2){const h2=1-after/.2;sprite(e.x,e.y+R*.3,e.z,R*(.18+.12*h2),W1,h2*CQ);}   // jackpot: a white-hot heart
    shock(e.x,y,e.z,R*(.15+1.2*bx),(.9-.5*bx)*u*(oc===0?.6:1),X,bf*(oc===0?.5:1),44,.04,fs);
    if(oc===2)for(let i=0;i<3;i++){const f=clamp((after-i*.1)/.5,0,1);if(f>0&&f<1)shock(e.x,y+.02+.02*i,e.z,R*(.3+2.0*f),(.9-.4*f)*u,E,(1-f)*(1-f)*1.2,48);}   // jackpot: three EMP fronts, one after another
    const nt=oc===0?3:oc===1?6:9,reach=R*(oc===2?1.75:1.3)*(.4+.6*bx);
    for(let i=0;i<nt;i++){if(hsh(fs*5+i)<.85){const a=e.ang+i/nt*TAU+(hsh(e.seed+i)-.5)*.3;bolt(e.x,e.y+.25,e.z,e.x+Math.cos(a)*reach,e.y+.06,e.z+Math.sin(a)*reach,.42*u,7,.085*u,i%2?X:C,bf,fs*9+i,.3);}}}
   if(!(e.f&1)&&t>=T0){e.f|=1;sparks(e.x,e.y+.4,e.z,oc===0?6:oc===1?16:26,(5+2*oc)*u,X,.3*u,.5,1.2,e.y);}
  }else{   // TITANFALL: a golden seal strikes the ground and breaks it. Engraved light, not a fireball: a bezel of two rings and ticks, a star of straight
   // lines turning inside it, spires of light standing on its points, a lance up the middle ringed by halos, molten fissures; the fire is only its heart.
   // Level: a miss is the whole seal drawn wide, thin and dim, with short spires, one halo and no heart; normal is brighter with taller spires, two halos
   // and a white-gold heart; a jackpot adds a white-hot heart, turning outer arcs, three halos, lit spire tips and fire rain. No smoke: pure light
   const fb=Math.max(0,1-t/(e.d*.7)),G=col('#ffc400'),Wg=col('#fff3b0'),Or=col('#ff6a14'),L=oc===2?Wg:G;
   const sp=e.ang+(q?0:t*.5),Rs=R*(.55+.6*ex),Rp=Rs*.84,la=Math.min(1,fade*1.6)*(oc===0?.8:1),lw=(oc===0?.04:oc===2?.06:.05)*u,yg=e.y+.06,rise=Math.min(1,t/.1);
   disc(e.x,e.y+.045,e.z,Rs*1.12,BLK,.02,(oc===0?.3:.45)*Math.min(1,t/.05)*fade);   // the ground under the seal darkens first, so gold lines read as gold (light added to pale ground washes out)
   if(flash)disc(e.x,e.y+.07,e.z,R*1.3,Wg,flash*.3);
   churn(e.x,e.y+.05,e.z,Rs*(oc===0?1.1:.9),B,(oc===0?.22:.3)*fade);
   // the heart: a small fire dome (an orange rim round a gold body), widest and faintest on a miss, tightest on a jackpot. Never a white-out
   {const fr=oc===0?1.25:oc===2?.85:1;puff(e.x,e.y+R*.3*ex,e.z,R*(.3+.4*ex)*fr,Or,.55*fb*ht);puff(e.x,e.y+R*.34*ex,e.z,R*(.17+.22*ex)*fr,col('#ffa51e'),.32*fb*ht);if(oc>0)sprite(e.x,e.y+R*.4*ex,e.z,R*(.08+.07*ex),Wg,.45*fb*CQ);}
   if(hot){sprite(e.x,e.y+R*.38*ex,e.z,R*(.14+.08*hot),W1,hot*.8*CQ);shock(e.x,y+.03,e.z,R*(.3+1.1*(1-hot)),.5*u,W1,hot*.9,44);}   // jackpot: a white-hot heart and a third, sharp front
   // the seal: two rings, a bezel of ticks between them (every fourth one long), and a figure of straight lines inscribed in the inner ring
   ring(e.x,yg,e.z,Rs,lw,G,la,40,0,0);ring(e.x,yg,e.z,Rp,lw*.75,Wg,la*.85,36,0,0);
   {const nT=oc===0?24:oc===1?32:40;for(let i=0;i<nT;i++){const a=-sp*.8+i/nT*TAU,c=Math.cos(a),s=Math.sin(a),r0=Rs*(i%4?.93:.885);seg(e.x+c*r0,yg,e.z+s*r0,e.x+c*Rs*.985,yg,e.z+s*Rs*.985,lw*.8,lw*.35,Wg,la*.9);}}
   for(let i=0;i<6;i++){const a0=sp+i*TAU/6,a1=a0+TAU/3;seg(e.x+Math.cos(a0)*Rp,yg,e.z+Math.sin(a0)*Rp,e.x+Math.cos(a1)*Rp,yg,e.z+Math.sin(a1)*Rp,lw,lw,L,la);}   // two triangles: a six-pointed star
   if(oc===2)for(let i=0;i<6;i++){const a0=-sp*1.6+i*TAU/6;ring(e.x,yg,e.z,Rs*1.13,lw*.8,Or,la*.9,6,0,0,a0,a0+.6);}   // jackpot: six arcs outside the seal, turning against it
   // molten fissures run out from the centre between the star's points (they stay put: the ground does not turn)
   {const nf=oc===0?6:oc===1?8:10,gr=Math.min(1,t/.14);for(let i=0;i<nf;i++)crack(e.x,yg-.01,e.z,e.ang+(i+.5)/nf*TAU+(hsh(e.seed+i)-.5)*.3,Rs*1.12*gr*(.8+.3*hsh(e.seed+i*3)),e.seed+i*101,null,i%2?G:Wg,la*fb*(oc===0?.7:1),(oc===2?.09:.07)*u);}
   // spires of light stand on the star's six points, each on a four-pointed glint (a miss: short ones; a jackpot: the tallest, with lit tips)
   {const hs=R*(oc===0?.45:oc===2?1.1:.8)*rise*(.6+.4*fade),sa=la*(oc===0?.8:1);
    for(let i=0;i<6;i++){const a=sp+i*TAU/6,px=e.x+Math.cos(a)*Rp,pz=e.z+Math.sin(a)*Rp;
     spire(px,yg,pz,yg+hs,.2*u,.03*u,G,sa*.4);spire(px,yg,pz,yg+hs,.07*u,.012*u,Wg,sa);star(px,yg+.01,pz,.34*u,2,a,Wg,sa*.9,.05*u);if(oc===2)sprite(px,yg+hs,pz,.08*u,Wg,sa*.8*CQ);}}
   // the lance: a needle of light up the middle, ringed by halos that widen as they fade
   {const ch=R*(oc===0?1.3:oc===2?3.0:2.2)*Math.min(1,t/(e.d*.35)),nh=oc+1,ca=la*(oc===0?.7:1),y0=e.y+R*.3;
    spire(e.x,y0,e.z,y0+ch,(oc===2?.16:.22)*u,.04*u,G,ca*.45);spire(e.x,y0,e.z,y0+ch,(oc===2?.06:.08)*u,.015*u,Wg,ca);
    for(let i=0;i<nh;i++){const f=(i+1)/(nh+1);ring(e.x,y0+ch*f,e.z,R*(.3-.16*f)*(1+.35*k),lw*.8,i%2?Wg:G,ca*.9,18,0,0);}
    if(oc>0)sprite(e.x,y0+ch,e.z,R*.07,Wg,ca*CQ);}
   // glints circle the seal, against its turn
   {const ng=oc===0?4:oc===1?6:10;for(let i=0;i<ng;i++){const a=-sp*2.2+i*TAU/ng,gx=e.x+Math.cos(a)*Rs*1.06,gz=e.z+Math.sin(a)*Rs*1.06;star(gx,yg+.02,gz,.22*u,2,a+.8,Wg,la,.04*u);}}
   shock(e.x,y,e.z,R*(.2+1.3*ex),(.8-.5*ex)*u*(oc===0?.6:1),G,fade*fade*(oc===0?.4:.75),48,.08,e.seed);if(oc===2){const f2=Math.min(1,t/(e.d*.7));shock(e.x,y+.02,e.z,R*(.1+1.9*f2),(.7-.4*f2)*u,Or,fade*.6,48,.08,e.seed+9);}
   if(oc===2&&t>.15&&t<e.d*.85){const n=Math.round(60*lastDt*10*amt());for(let i=0;i<n;i++){const a=rnd()*TAU,d=Math.sqrt(rnd())*R*1.4;part(1,e.x+Math.cos(a)*d+.5*u,e.y+4.5*u,e.z+Math.sin(a)*d-.4*u,-.9*u,-11*u,.7*u,.42,.5*u,.12*u,rnd()<.5?G:col(P.x),1,0,0,e.y);}}   // jackpot: fire rain, small embers
   if(!(e.f&1)){e.f|=1;sparks(e.x,e.y+.4,e.z,oc===0?10:oc===1?26:40,(7+3*oc)*u,G,.36*u,.8,1.7,e.y);
    for(let i=0;i<(oc===0?5:16)*amt();i++)part(1,e.x+(rnd()-.5)*R*.7,e.y+.3,e.z+(rnd()-.5)*R*.7,(rnd()-.5)*2,4+rnd()*6,(rnd()-.5)*2,.7+rnd()*.5,.8*u,.14*u,i%2?G:Wg,1,2,.5,e.y);}
  }
 }
 // ---- impact: where a super lands on a tank (hit 1) or a beam ends (hit 0). Small, in the super's own colours ----
 function superImpact(key,oc,x,y,z,hit,u){
  const P=PAL[key]||PAL.pulse0;spawn(fxImpact,hit?(oc===2?.5:.36):.26,x,y,z,rnd()*TAU,hit?1:.6,0,u,key,oc);
  const n=hit?(oc===2?20:oc===1?12:6):4;sparks(x,y+.5*u,z,n,(4+2*oc)*u,col(key==='moon'&&oc===2?'#ff5a4a':P.x),.3*u,.45,1.3,y);
  if(key==='moon'&&oc>0)for(let i=0;i<(oc===2?16:9)*amt();i++)part(1,x+(rnd()-.5)*.8*u,y+.3,z+(rnd()-.5)*.8*u,0,7+rnd()*5,0,.6+rnd()*.3,.8*u,.15*u,i%3?col('#bfe6ff'):col('#ffffff'),.95,0,.6);   // a pillar of moonlight
  if(hit&&oc>0)mark(0,oc===2?1.8:1.1,x,y+.025,z,(oc===2?1.5:1.0)*u,0,0);
 }
 function fxImpact(e){const P=e.P,k=e.t/e.d,u=e.u,s=e.a*OCA[e.oc],f=1-k,A=col(P.a),C=col(P.c),fl=e.t<.06?1-e.t/.06:0,moon=e.k==='moon';
  disc(e.x,e.y+.05,e.z,(moon?2.2:3.0)*u*s,col(P.b),(moon?.22:.36)*f);
  if(moon&&e.oc>0&&e.a>=1)disc(e.x,e.y+.052,e.z,1.25*u*s,BLK,.02,.7*f);   // legendary: the ground under the target goes dark for a moment (an eclipse); no rim, nothing round the target   // legendary: an eclipse where it lands (a dark moon with a bright rim), and no other ring round the target
  puff(e.x,e.y+.55*u,e.z,(1.0+1.4*k)*u*s,A,.9*f);sprite(e.x,e.y+.55*u,e.z,(.42+.4*k+.5*fl)*u*s,C,f*f*CQ);if(!moon)shock(e.x,e.y+.07,e.z,(.5+2.6*k)*u*s,(.5-.3*k)*u*s,A,f*.6,30,.08,e.seed);
  if(e.oc===2)star(e.x,e.y+.6*u,e.z,(1.6+1.6*k)*u,4,e.ang,C,f,.07*u);}

 // ======================= CONQUEST: the supers exactly as Session 5E-2b drew them =======================
 // Owner, Nov 13 2026: Conquest supers stay completely unchanged. Everything from here to DESTRUCTION is the 5E-2b code,
 // word for word (only the names carry an O): the Conquest host gets these, the Arcade gets the 5E-2b2b recipes above.
 // Do not edit: a change here changes Conquest.
  function boltO(ax,ay,az,bx,by,bz,amp,n,w,col,a,seed,fork){
  const dx=bx-ax,dy=by-ay,dz=bz-az,L=Math.hypot(dx,dy,dz)||1,s=sideOf(dx,dy,dz,(ax+bx)/2,(ay+by)/2,(az+bz)/2),sx=s[0],sy=s[1],sz=s[2];
  let px=ax,py=ay,pz=az;const wc=Math.max(w,MW);
  for(let i=1;i<=n;i++){const t=i/n,e=i===n?0:(hsh(seed+i*131)-.5)*2*amp*Math.sin(t*Math.PI*.9+.15),lift=i===n?0:(hsh(seed+i*977)-.5)*amp*.5;
   const x=ax+dx*t+sx*e,y=ay+dy*t+sy*e+(host.eye?0:lift*.4),z=az+dz*t+sz*e;
   seg(px,py,pz,x,y,z,wc*2.7,wc*2.7,col,a*.34);seg(px,py,pz,x,y,z,wc,wc,col,a);   // a glow around a solid core: reads at phone size
   if(fork&&i<n&&hsh(seed+i*31)<fork){const fl=L/n*(1.2+hsh(seed+i*57)*1.6),fa=(hsh(seed+i*91)-.5)*2.4,ca=Math.cos(fa),sa=Math.sin(fa),ux=dx/L,uz=dz/L;
    seg(x,y,z,x+(ux*ca-uz*sa)*fl,y,z+(ux*sa+uz*ca)*fl,wc*.8,wc*.2,col,a*.85);}
   px=x;py=y;pz=z;}
 }
 // charge-up (called every frame a tank is charging): light gathers at the muzzle, each family in its own way.
 // k 0..1 progress of the sweep, oc: undefined while the bar sweeps, then the outcome (jackpot flares gold, a miss sputters)
 function superChargeO(key,k,x,y,z,ang,oc,dim,u){
  const P=PAL[key]||PAL.pulse0,K=KIND[key],A=col(P.a),C=col(P.c),B=col(P.b),X=col(P.x),q=quiet(),pulse=q?1:.8+.2*Math.sin(time*26),grow=.35+.65*k,boost=oc===2?1.5:oc===0?.55:1;
  const mx=x+Math.cos(ang)*1.15*u,mz=z+Math.sin(ang)*1.15*u;
  if(K==='nova'){   // a ring closes in on the tank again and again, faster as it fills
   const ph=(time*(1.4+2.2*k))%1,r=dim*(1-ph*.82);ring(x,y+.05,z,r,.1*u*boost,A,(.25+.55*k)*(1-ph*.3)*boost,40,key==='twin0'?.1:0,frame>>2);
   disc(x,y+.04,z,dim*.55*grow,B,.22*grow*boost);sprite(x,y+.7*u,z,(.5+.9*k)*u*boost*pulse,A,.8*CQ);sprite(x,y+.7*u,z,(.22+.4*k)*u*boost,C,CQ);
   if(key==='twin1'&&!q)for(let i=0;i<3;i++){const a=time*5+i*TAU/3;ring(x,y+.06,z,dim*(.2+.3*k),.07*u,X,.5*k,10,0,0,a,a+1.1);}
   if(key==='twin2')for(let i=0;i<2;i++)ring(x,y+.3*u+i*.5*u,z,(1.0-i*.25)*u*grow,.06*u,X,.6*k*boost,22,0,0);
  }else{
   disc(mx,y+.04,mz,(1.2+1.6*k)*u*boost,B,.3*grow*boost);sprite(mx,y+.55*u,mz,(.55+1.1*k)*u*boost*pulse,A,.85*CQ);sprite(mx,y+.55*u,mz,(.22+.45*k)*u*boost,C,CQ);
   if(key==='pulse1'||key==='siege1'||key==='moon'){const fq=q?frame>>5:frame>>1,a=hsh(fq)*TAU,r=(1+k)*u;boltO(mx+Math.cos(a)*r,y+.5*u,mz+Math.sin(a)*r,mx,y+.55*u,mz,.3*u,4,.045*u,key==='moon'&&oc===2?col('#ff5a4a'):X,.9,fq);}   // reduced motion: the same arc held still, never a flash
   if(key==='pulse2'||key==='siege2')star(mx,y+.56*u,mz,(.8+1.5*k)*u*boost,4,time*1.5,X,.75*grow,.06*u);
   if(key==='moon'){const a0=ang+2.2,a1=ang+TAU-2.2;ring(mx,y+.06,mz,(1.5-.5*k)*u,.07*u,A,.8*grow,18,0,0,a0,a1);ring(mx,y+.06,mz,(2.1-.7*k)*u,.05*u,oc===2?col('#ff3b3b'):B,.6*grow,18,0,0,a0+.3,a1-.3);}
   if(key==='pulse0')for(let i=0;i<2;i++){const d=(1.6+i*1.1)*u,w=(.5-.12*i)*u*grow;seg(mx+Math.cos(ang)*d-Math.sin(ang)*w,y+.5*u,mz+Math.sin(ang)*d+Math.cos(ang)*w,mx+Math.cos(ang)*d+Math.sin(ang)*w,y+.5*u,mz+Math.sin(ang)*d-Math.cos(ang)*w,.05*u,.05*u,X,.7*k);}
  }
  // motes drawn in towards the muzzle
  if(!q&&rnd()<lastDt*(low()?10:26)*(.4+k)){const a=rnd()*TAU,r=(1.2+rnd()*1.4)*u,cx=K==='nova'?x:mx,cz=K==='nova'?z:mz;part(1,cx+Math.cos(a)*r,y+.3*u+rnd()*.8*u,cz+Math.sin(a)*r,-Math.cos(a)*r*3.2,0,-Math.sin(a)*r*3.2,.3,.34*u,.06*u,rnd()<.4?C:A,.95,0,0);}
 }
 // the moment the bar is stopped: a jackpot rings gold, a miss sputters grey
 function superLockO(key,oc,x,y,z,u){
  if(oc===2){spawn(fxLockO,.38,x,y,z,0,0,0,u,key,2);sparks(x,y+.7*u,z,18,7*u,col('#ffcf4a'),.34*u,.5,1.2,y);}
  else if(oc===0)smoke(x,y+.7*u,z,4,.3*u,col('#5a5f68'),.6*u,.6);
 }
 function fxLockO(e){const k=e.t/e.d,g=col('#ffcf4a'),w=col('#fff6cf');ring(e.x,e.y+.06,e.z,(.6+3.2*k)*e.u,.16*e.u*(1-k),g,1-k,36);ring(e.x,e.y+.07,e.z,(.3+2.2*k)*e.u,.08*e.u,w,(1-k)*.9,30);
  star(e.x,e.y+.9*e.u,e.z,(1.4+1.2*k)*e.u,4,.4,w,(1-k),.07*e.u);disc(e.x,e.y+.05,e.z,3*e.u,g,.35*(1-k));}

 // ---- beams (Pulse x3, Moonbeam). a: length, b: hit half-width ----
 function superBeamO(key,oc,x,y,z,ang,len,w,u,dy){
  const d=key==='pulse2'?(oc===2?.95:.6):key==='moon'?(oc===2?.9:.62):oc===2?.7:.48,e=spawn(fxBeamO,d*(oc===0?.75:1),x,y,z,ang,len,w,u,key,oc),P=PAL[key]||PAL.pulse0;
  e.dy=dy||0;shake(oc===2?14:oc===1?8:4,oc===2?.5:.3);
  const sx=x+Math.cos(ang)*u,sz=z+Math.sin(ang)*u,L=len-u;
  // aftermath on the ground, each beam its own: a teal scorch line, crawling violet sparks, a molten trench, moonlit motes
  if(key==='pulse0'){if(oc>0)mark(1,oc===2?2.8:2.0,sx,y+.03,sz,w*(oc===2?.4:.3),ang,L,null,col('#00ffc8'));}
  else if(key==='pulse1'){if(oc>0){mark(1,oc===2?2.4:1.7,sx,y+.03,sz,w*.26,ang,L,null,col(P.a));mark(3,oc===2?2.8:2.0,sx,y+.03,sz,w*(oc===2?2.2:1.0),ang,L,null,col(P.x),u);}}
  else if(key==='pulse2')mark(1,oc===2?2.8:oc===1?1.9:1.0,sx,y+.03,sz,w*(oc===2?.8:.55),ang,L,null,col('#ff7a00'));
  else if(oc>0)mark(5,oc===2?2.4:1.6,sx,y+.03,sz,w*(oc===2?.42:.3),ang,L,null,oc===2?col('#ff2020'):col(P.a),u);
  return e;
 }
 function fxPillarO(e){const k=e.t/e.d,u=e.u,f=1-k,h=(.4+2.6*Math.min(1,k*2.2))*u,o=col('#ff7a00'),y=col('#ffd24a'),w=col('#fff6d8');   // a column of flame standing up from the ground
  disc(e.x,e.y+.05,e.z,1.5*u,o,.5*f);sprite(e.x,e.y+h*.25,e.z,.95*u*(1-.3*k),o,.9*f);sprite(e.x,e.y+h*.6,e.z,.7*u*(1-.3*k),y,.9*f);sprite(e.x,e.y+h,e.z,.42*u,w,f);}
 function fxBeamO(e,dt){
  const P=e.P,key=e.k,oc=e.oc,u=e.u,L=e.a,W=e.b*OCW[oc],t=e.t,k=t/e.d,ca=Math.cos(e.ang),sa=Math.sin(e.ang),q=quiet();
  const env=t<.04?t/.04:Math.pow(Math.max(0,1-(t-.04)/(e.d-.04)),1.4),fl=q?1:.86+.14*Math.sin(time*70+e.seed),hot=t<.1?1:.62;   // after the first flash the core thins so the target shows through
  const y=e.y+.55*u,ax=e.x+ca*1.1*u,az=e.z+sa*1.1*u,bx=e.x+ca*L,bz=e.z+sa*L,yb=y+(e.dy||0),A=col(P.a),B=col(P.b),C=col(P.c),X=col(P.x);
  const fs=frame>>(q?4:1);   // lightning re-draws every other frame (every 16th with reduced motion: no flicker)
  {const mx=ax+(bx-ax)*.12,mz=az+(bz-az)*.12,nx=ax+(bx-ax)*.88,nz=az+(bz-az)*.88,gy=e.y+.04;seg(ax,gy,az,mx,gy,mz,W*.2,W*GLW*.6,B,.13*env);seg(mx,gy,mz,nx,gy,nz,W*GLW*.6,W*GLW*.6,B,.13*env);seg(nx,gy,nz,bx,gy,bz,W*GLW*.6,W*.1,B,.13*env);}   // its light on the ground, tapered at both ends
  if(key==='pulse0'){   // PIERCE LANCE: a needle-straight teal rail shot, white-hot core, shock diamonds racing down it
   seg(ax,y,az,bx,yb,bz,W*1.5,W*1.1,B,.5*env);seg(ax,y,az,bx,yb,bz,W*.62,W*.5,A,.95*env*fl);seg(ax,y,az,bx,yb,bz,W*.2*hot,W*.16*hot,C,env);
   if(oc>0){const n=oc===2?6:5,wt=col('#ffffff'),A=col('#00ffc8');for(let i=0;i<n;i++){const f=((i/n)+t*1.6)%1,cx=ax+(bx-ax)*f,cz=az+(bz-az)*f,r=W*(oc===2?.62:.5),r2=r*1.15;   // short, wide diamonds spaced well apart on a rigid rail   // hard teal diamonds with a white heart, a little wider than the beam
     quad(cx-ca*r,y+.02,cz-sa*r,cx+sa*r2,y+.02,cz-ca*r2,cx+ca*r,y+.02,cz+sa*r,cx-sa*r2,y+.02,cz+ca*r2,0,0,0,0,0,0,0,0,A[0],A[1],A[2],.55*env);
     quad(cx-ca*r*.45,y+.03,cz-sa*r*.45,cx+sa*r2*.45,y+.03,cz-ca*r2*.45,cx+ca*r*.45,y+.03,cz+sa*r*.45,cx-sa*r2*.45,y+.03,cz+ca*r2*.45,0,0,0,0,0,0,0,0,wt[0],wt[1],wt[2],.8*env);}}
   if(oc===2)for(let i=0;i<4;i++){const f=clamp(t*2.6-i*.2,0,1);if(f>0&&f<1){const cx=ax+(bx-ax)*(.15+.22*i),cz=az+(bz-az)*(.15+.22*i);ring(cx,e.y+.06,cz,(.5+2.8*f)*u,.2*u,col('#7dfcff'),(1-f),28);ring(cx,e.y+.07,cz,(.3+2.0*f)*u,.09*u,C,(1-f),24);}}   // jackpot: thick sonic rings burst open down the line
   if(!(e.f&1)){e.f|=1;const n=oc===0?4:12;for(let i=0;i<n*amt();i++){const f=rnd();part(1,ax+(bx-ax)*f,y,az+(bz-az)*f,-sa*(rnd()-.5)*5,1+rnd()*2,ca*(rnd()-.5)*5,.4,.34*u,.04*u,rnd()<.5?X:A,1,6,2,e.y);}}
  }else if(key==='pulse1'){   // ARC LANCE: a violet beam inside a double helix of lightning
   seg(ax,y,az,bx,yb,bz,W*1.25,W*1.0,B,.55*env);seg(ax,y,az,bx,yb,bz,W*.36,W*.32,A,.9*env*fl);seg(ax,y,az,bx,yb,bz,W*.12,W*.1,C,env);
   const strands=oc===0?1:2,n=Math.round((oc===2?26:20)*(low()?.6:1)),amp=W*(oc===2?1.3:1.0),tw=L/(u*3.2),sw=Math.max(.1*u,MW);
   for(let s2=0;s2<strands;s2++){let px=ax,pz=az;const sc=s2?X:C;for(let i=1;i<=n;i++){const f=i/n,ph=f*tw*TAU+(q?0:t*22)+s2*Math.PI,off=Math.sin(ph)*amp*(.4+.6*Math.sin(f*Math.PI))+(hsh(fs*31+i+s2*99)-.5)*amp*.3,x=ax+(bx-ax)*f-sa*off,z=az+(bz-az)*f+ca*off;
     seg(px,y,pz,x,y,z,sw*2.6,sw*2.6,A,env*.4);seg(px,y,pz,x,y,z,sw,sw,sc,env);px=x;pz=z;}}
   if(oc===2){for(let i=0;i<7;i++){const f=(i+.5)/7,sx=ax+(bx-ax)*f,sz=az+(bz-az)*f,sd=(i%2?1:-1)*(2.4+hsh(e.seed+i)*2.2)*u,gx=sx-sa*sd+ca*(hsh(e.seed+i*3)-.5)*2*u,gz=sz+ca*sd+sa*(hsh(e.seed+i*3)-.5)*2*u;   // jackpot: chain lightning forks to the ground on both sides
     if(hsh(fs*7+i)<.8){boltO(sx,y,sz,gx,e.y+.05,gz,.5*u,6,.09*u,X,env,fs*13+i,.3);disc(gx,e.y+.05,gz,1.1*u,A,.6*env);}}
    if(!(e.f&2)&&t>.05){e.f|=2;for(let i=0;i<7;i++){const f=(i+.5)/7,sd=(i%2?1:-1)*(2.4+hsh(e.seed+i)*2.2)*u,gx=ax+(bx-ax)*f-sa*sd,gz=az+(bz-az)*f+ca*sd;sparks(gx,e.y+.1,gz,5,3*u,X,.28*u,.4,1,e.y);}}}
  }else if(key==='pulse2'){   // SUNLANCE: a fat golden solar beam with a star at the muzzle and heat rings rolling down it
   const pw=q?1:1+.12*Math.sin(time*38);
   seg(ax,y,az,bx,yb,bz,W*2.1*pw,W*1.7*pw,B,.5*env);seg(ax,y,az,bx,yb,bz,W*1.15*pw,W*.95,A,.95*env);seg(ax,y,az,bx,yb,bz,W*.42*hot,W*.34*hot,C,env);
   if(oc>0){star(ax,y+.02,az,(2.6+1.4*Math.sin(k*Math.PI))*u*(oc===2?1.35:1),4,.39+t*1.2,col('#ffcf4a'),env,.24*u);sprite(ax,y,az,1.5*u*env,C,env);
    for(let i=0;i<(oc===2?5:3);i++){const f=((i/(oc===2?5:3))+t*1.3)%1,cx=ax+(bx-ax)*f,cz=az+(bz-az)*f,r=W*(1.5+.5*f);ring(cx,y+.02,cz,r*.9,.16*u,col('#ffcf4a'),.8*env*(1-f*.5),20);}}   // heat rings rolling down the beam
   if(oc===2){const n=6;for(let i=0;i<n;i++){const at=.08+i*.06;if(t>=at&&!(e.f&(4<<i))){e.f|=(4<<i);const f=(i+.8)/n,px=ax+(bx-ax)*f,pz=az+(bz-az)*f;   // jackpot: flame columns erupt along the line, one after another
      spawn(fxPillarO,.5,px,e.y,pz,0,0,0,u,key,2);for(let j=0;j<8*amt();j++)part(1,px+(rnd()-.5)*W,e.y+.3,pz+(rnd()-.5)*W,(rnd()-.5)*2.5,3+rnd()*4,(rnd()-.5)*2.5,.6+rnd()*.3,.5*u,.08*u,j%3?A:X,1,7,.4,e.y);smoke(px,e.y+.6,pz,2,.4*u,col('#2a2622'),1.0*u,1.2,1.4);}}}
   else if(!(e.f&1)&&oc>0){e.f|=1;for(let i=0;i<10*amt();i++){const f=rnd();part(1,ax+(bx-ax)*f,e.y+.1,az+(bz-az)*f,(rnd()-.5)*2,2+rnd()*3,(rnd()-.5)*2,.6,.4*u,.06*u,A,1,3,.5,e.y);}}
  }else{   // MOONFALL (owner-fixed): miss = a slightly thinner beam; normal = blue beam with thin blue electricity; jackpot = thicker beam, RED electricity
   const wb=oc===0?.82:oc===2?1.3:1,Wm=e.b*wb,R1=col('#ff2020'),R2=col('#ff5a3a');
   seg(ax,y,az,bx,yb,bz,Wm*1.45,Wm*1.25,B,.55*env);seg(ax,y,az,bx,yb,bz,Wm*.85,Wm*.72,A,.8*env*fl);seg(ax,y,az,bx,yb,bz,Wm*.3*hot,Wm*.24*hot,col('#dbeafe'),env);
   if(oc===1)for(let i=0;i<3;i++)boltO(ax,y+.02,az,bx,yb+.02,bz,Wm*.85,Math.round(L/u/1.1),.06*u,i%2?C:col('#bfe6ff'),env,fs*17+i*101+e.seed,0);
   if(oc===2)for(let i=0;i<4;i++){const sd=(i%2?1:-1)*Wm*(1.25+.25*(i>>1));   // red arcs ride OUTSIDE the blue beam, so they stay red
     boltO(ax-sa*sd,y+.02,az+ca*sd,bx-sa*sd,yb+.02,bz+ca*sd,Wm*.5,Math.round(L/u/1.0),.12*u,i%2?R2:R1,env,fs*17+i*101+e.seed,.3);}
   if(oc>0){const a0=e.ang+1.9,a1=e.ang+TAU-1.9,kk=Math.min(1,t/.12);ring(ax,e.y+.06,az,(1.2+1.8*kk)*u,.12*u,oc===2?R1:A,env,22,0,0,a0,a1);if(oc===2)ring(ax,e.y+.06,az,(1.8+2.6*kk)*u,.09*u,R2,env*.8,22,0,0,a0+.25,a1-.25);}
   if(!(e.f&1)){e.f|=1;const n=(oc===2?26:oc===1?14:6)*amt();for(let i=0;i<n;i++){const f=rnd();part(1,ax+(bx-ax)*f-sa*(rnd()-.5)*Wm,y,az+(bz-az)*f+ca*(rnd()-.5)*Wm,(rnd()-.5)*1.5,2.5+rnd()*4,(rnd()-.5)*1.5,.5+rnd()*.4,.5*u,.05*u,oc===2&&i%2?R1:i%3?col('#ccefff'):C,1,1.5,.4,e.y);}}
  }
 }
 // ---- novas (Twin x3). a: radius ----
 function superNovaO(key,oc,x,y,z,r,u){
  const d=oc===2?(key==='twin1'?1.1:.95):oc===1?.65:.45,e=spawn(fxNovaO,d,x,y,z,rnd()*TAU,r,0,u,key,oc),P=PAL[key]||PAL.pulse0;
  shake(oc===2?13:oc===1?7:3,oc===2?.5:.3);
  if(key==='twin0'){if(oc>0)mark(3,oc===2?2.8:2.0,x,y+.03,z,r*.95,0,0,null,col(P.a),u);}
  else if(key==='twin1'){mark(4,oc===2?3.0:oc===1?2.2:1.1,x,y+.03,z,r*(oc===0?.6:.9),0,0,null,col('#7c3aed'),u);if(oc===2)mark(3,2.2,x,y+.03,z,r*.9,0,0,null,col('#d8b4fe'),u);}
  else{mark(2,oc===2?2.8:1.5,x,y+.03,z,r*(oc===2?1.0:.7),rnd()*TAU,oc===2?9:oc===1?5:3,col('#120a04'),col('#ff3d00'),u);}
  if(oc>0)mark(0,oc===2?2.2:1.3,x,y+.025,z,r*.5,0,0);
  return e;
 }
 function fxNovaO(e){
  const P=e.P,key=e.k,oc=e.oc,u=e.u,R=e.a,t=e.t,k=t/e.d,q=quiet(),A=col(P.a),B=col(P.b),C=col(P.c),X=col(P.x),fs=frame>>(q?4:1),y=e.y+.08;
  const ex=1-Math.pow(1-Math.min(1,t/.2),2.4),fade=k<.35?1:Math.max(0,1-(k-.35)/.65),rr=R*(.12+.88*ex);   // the wave reaches its full radius in 0.2 s (the hit lands at once), then lingers and fades
  if(key==='twin0'){   // STATIC NOVA: jagged tracer-yellow rings snap outward with lightning spokes to the rim; nothing smooth
   const Y=col(P.a),I=col('#fffbe0'),ns=oc===0?0:oc===1?6:10;   // the Twin Repeater's own tracer yellow with a white-hot edge
   disc(e.x,e.y+.05,e.z,R*(.5+.6*ex),col('#b89b00'),.36*fade);if(oc>0)disc(e.x,e.y+.06,e.z,rr*(oc===2?1.15:.95),oc===2?I:Y,(oc===2?.75:.4)*Math.max(0,1-t/.22));   // a filled flash under the rings
   ring(e.x,y,e.z,rr,.2*u*OCW[oc],Y,fade,48,.2,fs);ring(e.x,y+.02,e.z,rr,.08*u,I,fade,48,.2,fs);
   if(oc>0){ring(e.x,y+.1,e.z,rr*.72,.15*u,Y,fade*.9,40,.3,fs+50);ring(e.x,y+.2,e.z,rr*.45,.12*u,col(P.b),fade*.85,30,.36,fs+90);}
   if(oc===2)ring(e.x,y+.05,e.z,R*Math.min(1.25,t/(e.d*.3)),.3*u,I,Math.max(0,1-t/(e.d*.5)),48,.16,fs+7);
   for(let i=0;i<ns;i++){if(hsh(fs*3+i)<.85){const a=e.ang+i/ns*TAU;const rch=rr*(oc===2?1.28:1);boltO(e.x+Math.cos(a)*.9*u,y+.3,e.z+Math.sin(a)*.9*u,e.x+Math.cos(a)*rch,y,e.z+Math.sin(a)*rch,.5*u,7,(oc===2?.15:.075)*u,i%2?Y:I,fade,fs*11+i,oc===2?.3:0);}}
   if(!(e.f&1)){e.f|=1;const n=(oc===0?10:oc===1?26:40)*amt();for(let i=0;i<n;i++){const a=i/n*TAU;part(1,e.x,y+.3,e.z,Math.cos(a)*R*2.4,.6+rnd(),Math.sin(a)*R*2.4,.42,.45*u,.07*u,i%2?I:Y,1,2,2.6,e.y);}}
  }else if(key==='twin1'){   // STORM NOVA: a violet storm disc with thick spiral arms sweeping round; jackpot calls lightning down from the sky
   const V=col('#7c3aed'),Lv=col('#c084fc'),Rm=col('#a855f7'),arms=oc===0?2:3,spin=e.ang+(q?0:t*(TAU*.75/.6));
   disc(e.x,e.y+.05,e.z,rr*1.08,V,.5*fade);
   for(let i=0;i<arms;i++){const a0=spin+i/arms*TAU,N=9;let px=0,pz=0,pw=0;for(let j=0;j<=N;j++){const f=j/N,a=a0+f*2.4,r2=rr*(.14+.86*f),x=e.x+Math.cos(a)*r2,z=e.z+Math.sin(a)*r2,w=(.42-.3*f)*u*OCW[oc];   // each arm tapers from the hub to the rim
     if(j){seg(px,y+.03,pz,x,y+.03,z,pw*1.9,w*1.9,Lv,.55*fade);seg(px,y+.04,pz,x,y+.04,z,pw*.7,w*.7,C,fade);}px=x;pz=z;pw=w;}}
   ring(e.x,y,e.z,rr,.17*u*OCW[oc],Rm,fade,44,.05,fs);ring(e.x,y+.01,e.z,rr,.06*u,C,fade*.9,44,.05,fs);
   if(oc===2){for(let i=0;i<9;i++){const at=(i<3?0:.05+(i-3)*.085),lt=t-at;if(lt>=0&&lt<.3){const a=hsh(e.seed+i*5)*TAU,d=R*(.3+.6*hsh(e.seed+i*9)),sx=e.x+Math.cos(a)*d,sz=e.z+Math.sin(a)*d,al=1-lt/.3;
      boltO(sx+(hsh(e.seed+i)-.5)*1.5*u,e.y+7*u,sz-2*u,sx,e.y+.1,sz,.5*u,8,.2*u,i%2?C:col('#d8b4fe'),al,fs*5+i,.3);disc(sx,e.y+.06,sz,2.4*u,Lv,.9*al);sprite(sx,e.y+.5,sz,1.4*u*al,C,al);
      if(!(e.f&(2<<i))){e.f|=(2<<i);sparks(sx,e.y+.2,sz,7,4*u,X,.3*u,.4,1.2,e.y);mark(0,.9,sx,e.y+.025,sz,.9*u,0,0);shake(6,.15);}}}}
   if(!(e.f&1)){e.f|=1;const n=(oc===0?6:18)*amt();for(let i=0;i<n;i++){const a=rnd()*TAU;part(1,e.x,y+.4,e.z,Math.cos(a)*R*1.6-Math.sin(a)*3,1+rnd()*2,Math.sin(a)*R*1.6+Math.cos(a)*3,.5,.4*u,.06*u,i%3?Lv:X,1,2,2,e.y);}}
  }else{   // HELIX NOVA: an orange-to-red dome of stacked coil rings rises from a molten ground ring; jackpot rains fire inside it
   const O=col('#ff8a00'),Rd=col('#ff3d00'),layers=oc===0?2:oc===1?5:7;
   disc(e.x,e.y+.05,e.z,R*(.5+.6*ex),Rd,.34*fade);
   ring(e.x,y,e.z,rr*1.02,.34*u*OCW[oc],Rd,fade*.95,44,.05,fs>>2);ring(e.x,y+.01,e.z,rr*1.02,.1*u,col(P.x),fade,44);
   for(let i=1;i<layers;i++){const h=i/layers,rad=rr*Math.cos(h*1.4),yy=e.y+.15+Math.sin(h*1.4)*R*.8*ex;ring(e.x,yy,e.z,rad,(.2-.018*i)*u*OCW[oc],i%2?O:col(P.x),fade*(1-.08*i),36,0,0,e.ang+i,e.ang+i+TAU);}   // stacked upward and shrinking: a dome
   if(oc>0){sprite(e.x,e.y+R*.8*ex,e.z,.9*u,C,fade);if(!q)for(let i=0;i<3;i++){const a=e.ang+t*9+i*TAU/3;seg(e.x+Math.cos(a)*rr*.25,e.y+R*.75*ex,e.z+Math.sin(a)*rr*.25,e.x+Math.cos(a+1)*rr,e.y+.2,e.z+Math.sin(a+1)*rr,.1*u,.1*u,col(P.x),fade);}}
   if(oc===2&&t>.03&&t<e.d*.8){const n=Math.round(60*lastDt*22*amt());for(let i=0;i<n;i++){const a=rnd()*TAU,d=Math.sqrt(rnd())*R*.92;part(1,e.x+Math.cos(a)*d+.5*u,e.y+4.5*u,e.z+Math.sin(a)*d-.4*u,-.9*u,-11*u,.7*u,.42,.95*u,.3*u,rnd()<.5?O:col('#ffd66b'),1,0,0,e.y);}}   // fire rain, falling inside the ring
   if(!(e.f&1)){e.f|=1;const n=(oc===0?8:22)*amt();for(let i=0;i<n;i++){const a=rnd()*TAU;part(1,e.x+Math.cos(a)*R*.3,y+.3,e.z+Math.sin(a)*R*.3,Math.cos(a)*R*1.3,3+rnd()*4,Math.sin(a)*R*1.3,.6,.45*u,.08*u,i%2?O:Rd,1,7,1,e.y);}}
  }
 }
 // ---- shells (Siege x3): the shot in flight (every frame) and where it lands ----
 function superShellO(key,oc,x,y,z,u){
  const P=PAL[key]||PAL.siege0,A=col(P.a),C=col(P.c),B=col(P.b),X=col(P.x),s=OCW[oc],q=quiet();
  if(key==='siege1'){sprite(x,y,z,1.0*u*s,A,.8);sprite(x,y,z,.42*u*s,C,1);{const fq=q?frame>>5:frame;for(let i=0;i<(oc===0?1:2);i++){const a=hsh(fq*3+i)*TAU;boltO(x,y,z,x+Math.cos(a)*1.3*u*s,y-.3*u,z+Math.sin(a)*1.3*u*s,.3*u,4,.06*u,X,.9,fq+i);}}
   if(rnd()<lastDt*50*amt())part(1,x,y,z,(rnd()-.5),0,(rnd()-.5),.3,.5*u*s,.05*u,A,.8,0,0);}
  else if(key==='siege2'){sprite(x,y,z,1.6*u*s,B,.75);sprite(x,y,z,.95*u*s,A,.95);sprite(x,y,z,.42*u*s,C,1);star(x,y+.01,z,1.5*u*s,2,time*6,col('#fff3b0'),.7,.08*u);
   if(rnd()<lastDt*70*amt())part(1,x+(rnd()-.5)*.4*u,y,z+(rnd()-.5)*.4*u,(rnd()-.5)*1.5,-1-rnd()*2,(rnd()-.5)*1.5,.5,.55*u*s,.08*u,rnd()<.5?A:col('#fff3b0'),1,3,0);}
  else{sprite(x,y,z,1.15*u*s,A,.8);sprite(x,y,z,.48*u*s,C,1);
   if(rnd()<lastDt*50*amt())part(1,x,y,z,(rnd()-.5),.2,(rnd()-.5),.3,.6*u*s,.08*u,A,.9,0,0);
   if(rnd()<lastDt*40*amt())part(0,x,y,z,0,.4,0,1.0,.55*u,1.5*u,col('#1a1a1a'),.6,0,.5);}
 }
 function superBlastO(key,oc,x,y,z,r,u){
  const d=key==='siege2'?(oc===2?1.5:1.0):oc===2?1.1:.75,e=spawn(fxBlastO,d*(oc===0?.7:1),x,y,z,rnd()*TAU,r,0,u,key,oc),P=PAL[key]||PAL.pulse0;
  shake(oc===2?(key==='siege2'?20:16):oc===1?11:5,oc===2?.65:.4);
  mark(0,oc===2?3.6:oc===1?2.8:1.6,x,y+.025,z,r*(oc===2?1.05:oc===1?.8:.5),0,0);
  if(key==='siege0'&&oc>0)mark(2,oc===2?3.0:2.2,x,y+.03,z,r*(oc===2?.95:.7),rnd()*TAU,oc===2?7:5,col('#0a0806'),col('#ff5a14'),u);
  if(key==='siege2'&&oc>0)mark(2,oc===2?3.2:2.0,x,y+.03,z,r*(oc===2?1.5:1.0),rnd()*TAU,oc===2?11:6,col('#0c0806'),col(P.x),u);
  if(key==='siege1'){mark(3,oc===2?3.0:oc===1?2.2:1.2,x,y+.03,z,r*(oc===2?1.5:1.1),0,0,null,col(oc===2?'#67e8f9':P.a),u);mark(4,oc===2?2.6:1.8,x,y+.03,z,r*(oc===0?.5:.8),0,0,null,col(P.b),u);}
  return e;
 }
 function fxBlastO(e){
  const P=e.P,key=e.k,oc=e.oc,u=e.u,R=e.a*OCW[oc],t=e.t,k=t/e.d,q=quiet(),A=col(P.a),B=col(P.b),C=col(P.c),X=col(P.x),fs=frame>>(q?4:1),y=e.y+.08,fade=Math.max(0,1-k);
  const ex=1-Math.pow(1-Math.min(1,t/(e.d*.4)),2.4);
  if(key==='siege0'){   // SIEGE BLAST: a rolling orange-red fireball under a growing pall of black smoke, hard shock ring, shrapnel
   const fb=Math.max(0,1-t/(e.d*.6)),K=col('#1a1a1a');
   disc(e.x,e.y+.05,e.z,R*1.5*(.4+.6*ex),B,.5*fade);
   if(oc>0){const sn=oc===2?9:7,sg=Math.min(1,t/(e.d*.9));for(let i=0;i<sn;i++){const a=e.ang+i/sn*TAU+t*.5,d=R*(.75+.75*sg)*(.8+.3*hsh(e.seed+i));sprite(e.x+Math.cos(a)*d,e.y+R*(.3+.8*sg),e.z+Math.sin(a)*d,R*(.34+.5*sg),K,.03,.78*Math.min(1,t/.08)*(1-Math.max(0,k-.55)/.45));}}   // black smoke rolls out around the fire and swells to 1.5x its size
   sprite(e.x,e.y+R*.35*ex,e.z,R*(.4+.75*ex),col('#ff5a14'),.9*fb);sprite(e.x,e.y+R*.4*ex,e.z,R*(.32+.6*ex),col('#ffa620'),fb);sprite(e.x,e.y+R*.45*ex,e.z,R*(.2+.36*ex),col('#fff3b0'),fb);
   ring(e.x,y,e.z,R*(.2+1.25*ex),.2*u,C,fade*fade,44);
   if(oc===2)for(let i=0;i<8;i++){const at=i*.028,lt=t-at;if(lt>=0){const a=e.ang+i/8*TAU,sx=e.x+Math.cos(a)*R*1.0,sz=e.z+Math.sin(a)*R*1.0,f=Math.max(0,1-lt/.4);   // jackpot: a ring of secondary explosions
      sprite(sx,e.y+.5*u,sz,R*.5*(1.3-f*.5),col('#ffb020'),f);sprite(sx,e.y+.5*u,sz,R*.3,col('#fff6c0'),f);if(!(e.f&(2<<i))){e.f|=(2<<i);sparks(sx,e.y+.3,sz,8,5*u,X,.3*u,.5,1.4,e.y);mark(0,1.6,sx,e.y+.025,sz,R*.3,0,0);shake(7,.18);}}}
   if(!(e.f&1)){e.f|=1;sparks(e.x,e.y+.4,e.z,oc===0?8:oc===1?22:34,(6+3*oc)*u,X,.34*u,.7,1.6,e.y);smoke(e.x,e.y+.5,e.z,oc===0?5:oc===1?12:18,R*.5,K,1.7*u,oc===2?2.4:1.8,1.5);
    for(let i=0;i<(oc===0?4:12)*amt();i++)part(1,e.x+(rnd()-.5)*R*.6,e.y+.3,e.z+(rnd()-.5)*R*.6,(rnd()-.5)*2,3+rnd()*5,(rnd()-.5)*2,.6+rnd()*.5,.7*u,.12*u,A,1,2,.6,e.y);}
  }else if(key==='siege1'){   // RAIL BLAST: the air folds inward to a point through a dark lens, then a violet sphere bursts and lightning crawls over the ground
   const T0=.14,imp=Math.min(1,t/T0),after=Math.max(0,t-T0),bx=1-Math.pow(1-Math.min(1,after/(e.d*.3)),2.2),bf=Math.max(0,1-after/(e.d-T0)),ns=oc===0?12:oc===1?20:32,E=col('#67e8f9');
   if(t<T0){const lr=R*(oc===0?1.2:oc===1?1.5:1.8)*(1-imp*.45);disc(e.x,e.y+.05,e.z,lr,BLK,.02,.85);ring(e.x,e.y+.06,e.z,lr*.78,.14*u,A,.95,40);   // the dark lens with a bright rim
    for(let i=0;i<ns;i++){const a=e.ang+i/ns*TAU,r0=R*1.7*(1-imp*.75),r1=r0*.55;seg(e.x+Math.cos(a)*r0,e.y+.3,e.z+Math.sin(a)*r0,e.x+Math.cos(a)*r1,e.y+.3,e.z+Math.sin(a)*r1,.05*u,.12*u,i%2?A:X,.95);}   // streaks rushing in
    sprite(e.x,e.y+.6*u,e.z,(.3+1.0*imp)*u,C,1);}
   else{disc(e.x,e.y+.05,e.z,R*1.5*bx,B,.6*bf);sprite(e.x,e.y+R*.3,e.z,R*(.4+.6*bx),B,.85*bf);sprite(e.x,e.y+R*.3,e.z,R*(.28+.42*bx),A,.95*bf*bf);sprite(e.x,e.y+R*.3,e.z,R*(.3-.12*bx),C,bf*bf);
    ring(e.x,y,e.z,R*(.15+1.2*bx),.16*u,X,bf,44,.05,fs);
    if(oc===2)for(let i=0;i<3;i++){const f=clamp((after-i*.09)/.45,0,1);if(f>0&&f<1)ring(e.x,y+.02+.02*i,e.z,R*(.3+2.0*f),.17*u,E,1-f,48);}   // jackpot: three EMP rings, one after another
    const nt=oc===0?4:oc===1?8:12,reach=R*(oc===2?1.75:1.3)*(.4+.6*bx);
    for(let i=0;i<nt;i++){if(hsh(fs*5+i)<.85){const a=e.ang+i/nt*TAU+(hsh(e.seed+i)-.5)*.3;boltO(e.x,e.y+.25,e.z,e.x+Math.cos(a)*reach,e.y+.06,e.z+Math.sin(a)*reach,.42*u,8,.085*u,i%2?X:C,bf,fs*9+i,.3);}}}
   if(!(e.f&1)&&t>=T0){e.f|=1;sparks(e.x,e.y+.4,e.z,oc===0?6:oc===1?16:26,(5+2*oc)*u,X,.3*u,.5,1.2,e.y);}
  }else{   // TITANFALL: a white-gold flash and fire dome, a rising column, shock rings, the ground splits (jackpot: and it rains fire). No smoke: pure light
   const fb=Math.max(0,1-t/(e.d*.7)),fl=Math.max(0,1-t/.09),G=col('#ffc400'),Wg=col('#fff3b0');
   if(fl>0)disc(e.x,e.y+.07,e.z,R*2.2,Wg,fl*.85);
   disc(e.x,e.y+.05,e.z,R*1.7*(.4+.6*ex),B,.5*fade);
   {const wh=t<.12?1:.38;sprite(e.x,e.y+R*.4*ex,e.z,R*(.5+.8*ex),G,.8*fb*(t<.12?1:.6));sprite(e.x,e.y+R*.45*ex,e.z,R*(.36+.6*ex),Wg,.95*fb*wh);sprite(e.x,e.y+R*.5*ex,e.z,R*(.16+.32*ex),C,fb*wh);}   // white-hot for 0.12 s, then a see-through dome: the target and its team ring stay readable
   if(oc>0){const rise=Math.min(1,t/(e.d*.7)),cy=e.y+R*(.7+1.9*rise);for(let i=0;i<4;i++){const f=i/3;sprite(e.x,e.y+R*.5+(cy-e.y-R*.5)*f,e.z,R*(.34-.1*f)*(1+.4*k),i%2?G:Wg,.75*fade);}sprite(e.x,cy+R*.2,e.z,R*.62*(1+k*.5),G,.8*fade);sprite(e.x,cy+R*.2,e.z,R*.34,C,fade);}   // the column and its cap
   ring(e.x,y,e.z,R*(.2+1.4*ex),.26*u,Wg,fade*fade,48);if(oc>0)ring(e.x,y+.02,e.z,R*(.1+2.0*Math.min(1,t/(e.d*.7))),.18*u,G,fade*.8,48);
   if(oc===2){star(e.x,e.y+R*.5,e.z,R*(1.2+1.6*ex),4,.39,G,fb,.26*u);
    if(t>.15&&t<e.d*.85){const n=Math.round(60*lastDt*18*amt());for(let i=0;i<n;i++){const a=rnd()*TAU,d=Math.sqrt(rnd())*R*1.4;part(1,e.x+Math.cos(a)*d+.5*u,e.y+4.5*u,e.z+Math.sin(a)*d-.4*u,-.9*u,-11*u,.7*u,.42,1.0*u,.3*u,rnd()<.5?G:col(P.x),1,0,0,e.y);}}}   // fire rain
   if(!(e.f&1)){e.f|=1;sparks(e.x,e.y+.4,e.z,oc===0?10:oc===1?26:40,(7+3*oc)*u,G,.36*u,.8,1.7,e.y);
    for(let i=0;i<(oc===0?5:16)*amt();i++)part(1,e.x+(rnd()-.5)*R*.7,e.y+.3,e.z+(rnd()-.5)*R*.7,(rnd()-.5)*2,4+rnd()*6,(rnd()-.5)*2,.7+rnd()*.5,.8*u,.14*u,i%2?G:Wg,1,2,.5,e.y);}
  }
 }
 // ---- impact: where a super lands on a tank (hit 1) or a beam ends (hit 0). Small, in the super's own colours ----
 function superImpactO(key,oc,x,y,z,hit,u){
  const P=PAL[key]||PAL.pulse0;spawn(fxImpactO,hit?(oc===2?.5:.36):.26,x,y,z,rnd()*TAU,hit?1:.6,0,u,key,oc);
  const n=hit?(oc===2?20:oc===1?12:6):4;sparks(x,y+.5*u,z,n,(4+2*oc)*u,col(key==='moon'&&oc===2?'#ff5a4a':P.x),.3*u,.45,1.3,y);
  if(key==='moon'&&oc>0)for(let i=0;i<(oc===2?16:9)*amt();i++)part(1,x+(rnd()-.5)*.8*u,y+.3,z+(rnd()-.5)*.8*u,0,7+rnd()*5,0,.6+rnd()*.3,.8*u,.15*u,i%3?col('#bfe6ff'):col('#ffffff'),.95,0,.6);   // a pillar of moonlight
  if(hit&&oc>0)mark(0,oc===2?1.8:1.1,x,y+.025,z,(oc===2?1.5:1.0)*u,0,0);
 }
 function fxImpactO(e){const P=e.P,k=e.t/e.d,u=e.u,s=e.a*OCW[e.oc],f=1-k,A=col(e.k==='moon'&&e.oc===2?'#ff3b3b':P.a),C=col(P.c);
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
  const M=MATS[mat]||MATS.metal,n=Math.min(Math.max(3,Math.round(M.n*amt()*clamp(.6+size*.45,.6,1.9))),Math.max(2,Math.floor((dcap()-frameChunks)/4))),many=frameChunks>dcap()*.6,sc=clamp(size*.5,.14,1.5),pl=Math.hypot(dx||0,dz||0)||1,px=(dx||0)/pl*M.v*.45,pz=(dz||0)/pl*M.v*.45,life=(M.crumble?2.6:3.2)*(low()?.7:1);
  h=h||size;
  for(let i=0;i<n;i++){const a=rnd()*TAU,rr=Math.sqrt(rnd())*size*.7,sp=M.v*(.35+rnd()*.75)*(M.crumble?.7:1),shp=M.sh[(rnd()*M.sh.length)|0],c=tint&&i%3===0?tint:col(M.c[(rnd()*M.c.length)|0]),s=sc*(.55+rnd()*.9);
   chunk(shp,x+Math.cos(a)*rr,y+rnd()*h*.8+.1,z+Math.sin(a)*rr,Math.cos(a)*sp+px,(M.crumble?1.5:3)+rnd()*M.v*(M.glass?1.3:.9),Math.sin(a)*sp+pz,s*(M.bend&&shp===3?1.6:1),s*(shp===1?.9:1),s,c,M.em||0,life*(.75+rnd()*.5),y);}
  if(M.rivet&&!many){const rc=col(M.rivet);for(let i=0;i<Math.round(8*amt());i++){const a=rnd()*TAU,sp=M.v*(1.2+rnd());chunk(0,x+Math.cos(a)*size*.5,y+h*.5,z+Math.sin(a)*size*.5,Math.cos(a)*sp,4+rnd()*4,Math.sin(a)*sp,.11*sc+.05,.11*sc+.05,.11*sc+.05,rc,0,1.6,y);}}   // rivets pop off like shot
  if(M.sp&&!many)sparks(x,y+h*.5,z,8+size*5,M.v*1.5,col(M.sp),.2+.08*Math.min(3,size),M.glass?.9:.6,1.5,y);
  smoke(x,y+h*.3,z,many?2:(M.crumble?8:4)+size*2,size*.6,col(M.dust),.5+.4*Math.min(3,size),M.crumble?2:1.3,M.crumble?.5:1);
  if(M.g){spawn(fxGlowBurst,M.burst?.7:.45,x,y+h*.4,z,rnd()*TAU,size*(M.burst?2.2:1.4),M.burst?1:0,1,'',1).P={a:M.g};if(M.vein||M.burst)mark(2,2.2,x,y+.03,z,size*(M.burst?1.6:1.2),rnd()*TAU,M.burst?7:5,M.vein?col('#1a140a'):null,col(M.g));}
  if(M.glass&&!many)for(let i=0;i<Math.round(14*amt());i++){const a=rnd()*TAU,sp=3+rnd()*5;part(1,x,y+h*.5,z,Math.cos(a)*sp,2+rnd()*5,Math.sin(a)*sp,.9,.22,.03,col('#ffffff'),1,9,.6,y);}   // glints
  if(!many)shake(Math.min(10,2+size*2.5),.22);
 }
 function fxGlowBurst(e){const k=e.t/e.d,f=1-k,c=col(e.P.a),w=col('#ffffff');disc(e.x,e.y-.3,e.z,e.a*(1+k),c,.6*f);sprite(e.x,e.y,e.z,e.a*(.4+.7*k),c,.9*f*f);ring(e.x,e.y-.3,e.z,e.a*(.3+1.6*k),.1,w,f,30);if(e.b)star(e.x,e.y,e.z,e.a*(.8+k),4,e.ang,w,f,.06);}
 // damage stages on a box-shaped object (called every frame it is damaged; frac = health left 0..1).
 // <70%: surface cracks and chipped edges; <45%: scorch and the odd spark; <22%: heavy cracks, smoke and sparks.
 // (cx,cy,cz) = centre of the box, hw/hh/hd half sizes, rot its heading, seed stable per object (same cracks every frame)
 function wear(mat,cx,cy,cz,hw,hh,hd,rot,frac,seed){
  if(frac>=.7||frac<=0)return;const M=MATS[mat]||MATS.metal,st=frac<.22?3:frac<.45?2:1,dark=col(M.crack),glow=M.g?col(M.g):null,ca=Math.cos(rot||0),sa=Math.sin(rot||0),n=st===1?2:st===2?4:6,w=Math.max(.025,Math.min(hw,hd)*.07);
  // crack quads: not on LOW in the Arcade (its draw budget: sparks and smoke ride the particle batches), and never more than
  // 45% of the batch for wear (in a town raid many structures are damaged at once: the break-ups keep their share)
  if(!(low()&&host.mode==='arcade')&&qn<QMAX*.45){
   // cracks on the top face (what the Arcade's top-down camera sees), kept inside the footprint
   for(let i=0;i<n;i++){const ox=(hsh(seed+i*13)-.5)*1.1*hw,oz=(hsh(seed+i*17)-.5)*1.1*hd,a=hsh(seed+i*23)*TAU,len=(.35+hsh(seed+i*29)*.4)*Math.min(hw,hd)*(st===3?1.25:1),wx=cx+ox*ca-oz*sa,wz=cz+ox*sa+oz*ca;
    crack(wx,cy+hh+.02,wz,a+rot,len,seed+i*41,glow&&!M.vein?null:dark,glow&&(M.vein||st>=2)?glow:null,M.vein?.95:.9,w);}
   // and on the sides that face the camera (Conquest's chase camera)
   if(host.mode==='conquest'){const y0=cy-hh,H=2*hh,nn=Math.ceil(n/2);host.eye(cx,cy,cz,tmp);const ex=tmp[0],ez=tmp[2];
    for(let f=0;f<2;f++){const nx=f?ca:-sa,nz=f?sa:ca,ext=f?hw:hd,wid=f?hd:hw,tx=f?-sa:ca,tz=f?ca:sa,sgn=nx*ex+nz*ez>=0?1:-1,bx=cx+nx*(ext+.04)*sgn,bz=cz+nz*(ext+.04)*sgn;
     for(let i=0;i<nn;i++){let pu=(hsh(seed+f*71+i*19+sgn)-.5)*1.6*wid,pv=y0+H*(.25+.6*hsh(seed+i*37+f)),dir=hsh(seed+i*5+f*3)*TAU;
      for(let q2=0;q2<4;q2++){dir+=(hsh(seed+q2*11+i)-.5)*1.1;const l=H*.16,nu=clamp(pu+Math.cos(dir)*l,-wid,wid),nv=clamp(pv+Math.sin(dir)*l,y0+.05,y0+H);
       seg(bx+tx*pu,pv,bz+tz*pu,bx+tx*nu,nv,bz+tz*nu,w*(1-q2*.2),w*(.8-q2*.2),glow&&M.vein?glow:dark,glow&&M.vein?.9:.04,glow&&M.vein?0:.85);pu=nu;pv=nv;}}}}
   if(st>=2&&M.crack)disc(cx+(hsh(seed+3)-.5)*hw*.6,cy+hh+.015,cz+(hsh(seed+4)-.5)*hd*.6,Math.min(hw,hd)*(st===3?.9:.6),BLK,.02,st===3?.5:.34);   // scorch
  }
  if(quiet())return;
  const rate=lastDt*(st===3?(low()?4:9):st===2?(low()?1:2.5):0);
  if(rate&&rnd()<rate){const px=cx+(rnd()-.5)*hw*1.4,pz=cz+(rnd()-.5)*hd*1.4;
   if(M.sp&&rnd()<.6)part(1,px,cy+hh,pz,(rnd()-.5)*3,1.5+rnd()*2.5,(rnd()-.5)*3,.35,.16+.05*Math.min(3,hw),.03,col(M.sp),1,9,1,cy-hh);
   if(st===3)part(0,px,cy+hh,pz,(rnd()-.5)*.4,.9+rnd()*.6,(rnd()-.5)*.4,1.2+rnd()*.6,.3+.15*Math.min(3,hw),.9+.4*Math.min(3,hw),col(M.glass||M.burst?M.dust:'#1d1f24'),.5,0,.5);
   if(st===3&&M.g&&rnd()<.5)part(1,px,cy+hh,pz,0,1.2,0,.5,.3,.05,glow,.9,0,0);}
 }
 // the world origin moved under the camera (Conquest rebases it): everything alive moves with it instead of popping out
 function shift(dx,dz){for(const e of E)if(e.on){e.x+=dx;e.z+=dz;}for(const m of S)if(m.on){m.x+=dx;m.z+=dz;}for(let i=0;i<pn;i++){pX[i]+=dx;pZ[i]+=dz;}for(let i=0;i<cn;i++){cX[i]+=dx;cZ[i]+=dz;}}
 // ---------- frame ----------
 function begin(dt,t){lastDt=Math.min(.05,dt||.016);time=t===undefined?time+lastDt:t;frame++;qn=0;dn=0;frameChunks=0;lowQ=low();}
 function end(){
  marksDraw(lastDt);
  for(const e of E){if(!e.on)continue;if(e.t>=e.d){e.on=0;continue;}try{e.fn(e,lastDt);}catch(err){e.on=0;}e.t+=lastDt;}   // an effect that fails is dropped: it never takes the frame down
  partStep(lastDt);debrisStep(lastDt);
  qg.setDrawRange(0,qn*6);dg.setDrawRange(0,dn);qMesh.visible=qn>0;dMesh.visible=dn>0;
  if(qn){for(const k in qAttr){const a=qAttr[k];a.clearUpdateRanges();a.addUpdateRange(0,qn*4*a.itemSize);a.needsUpdate=true;}}
  if(dn){for(const k in dAttr){const a=dAttr[k];a.clearUpdateRanges();a.addUpdateRange(0,dn*a.itemSize);a.needsUpdate=true;}}
 }
 function clear(){for(const e of E)e.on=0;for(const s of S)s.on=0;pn=0;cn=0;qn=0;dn=0;qg.setDrawRange(0,0);dg.setDrawRange(0,0);qMesh.visible=false;dMesh.visible=false;}
 function dispose(){host.scene.remove(qMesh);host.scene.remove(dMesh);qg.dispose();dg.dispose();}
 const stats=()=>({quads:qn,debrisVerts:dn,particles:pn,chunks:cn,effects:E.filter(e=>e.on).length,marks:S.filter(s=>s.on).length,caps:{quads:QMAX,verts:VMAX,particles:pcap(),chunks:dcap()}});
 const SUP_API=CQO?{superCharge:superChargeO,superLock:superLockO,superBeam:superBeamO,superNova:superNovaO,superShell:superShellO,superBlast:superBlastO,superImpact:superImpactO}:{superCharge,superLock,superBeam,superNova,superShell,superBlast,superImpact};
 return {begin,end,clear,dispose,stats,shift,...SUP_API,blast,shatter,wear,
  quad,seg,segc,cap,flow,disc,sprite,puff,churn,shock,ring,bolt:CQO?boltO:bolt,star,crack,part,sparks,smoke,chunk,mark,glow:qMesh,debris:dMesh};
}
root.FX3D={create,PAL,KIND,MATS};
})(typeof globalThis!=='undefined'?globalThis:this);
