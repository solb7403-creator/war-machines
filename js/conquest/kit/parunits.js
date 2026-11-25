/* LUNAR Conquest world kit — the PARASITE UNITS (Session 5E-2d2, owner Nov 21). The Parasites are greedy humans, not
 * aliens: every unit is a human-built machine, stolen and over-armoured out of greed. Dark scavenged steel under bolted-on
 * plundered plating that never matches (pale LDF ceramic, settler painted panels, hazard stripes), trophies of what they
 * took (other colonies' flags, loot crates, nets, sacks), gaudy gold trim. The infection is the only organic part: red
 * vein growth threading through seams, vents and cockpits (dead dark glass with a red glow behind it).
 *
 *   par-raider    "Scavenger"      stripped scout hull, an OVERSIZED engine, loot nets and cargo racks; low and long
 *   par-breacher  "Siphon"         stolen OXYGEN TANKS stacked on top, a long SIPHON LANCE out front; a siege mortar
 *   par-sentinel  "Hoard Fortress" a titan hull BURIED under plundered armour and loot, a big gaudy turret, a fat cannon
 *   par-command   "Warlord"        a RAISED COMMAND CUPOLA, an ANTENNA MAST, BANNERS of conquered colonies; a pulse projector
 *   par-swarm     "Grabber"        a little buggy: GRAB CLAWS in front, a LOOT SACK on the back (a pack animal, no turret)
 *   par-brute     "Wrecker"        a ram tank: a HUGE BATTERING RAM welded from wreckage fills the front third
 *   par-drone                      a stolen human quad-rotor with plundered parts and red growth (it flies: y 0 .. box height)
 *
 * Model space: metres, +y up, the ground at y = 0, the footprint centred on the origin, the FRONT FACING +z.
 * o.part  undefined = the whole unit (the gun at its pivot) | 'hull' = everything that does not turn | 'gun' = the turning
 *         gun in its OWN frame (pivot at the origin, the barrel toward +z). ConquestParUnits lists every pivot.
 * o.town  1 = the light town-raid model (one piece, big shapes, 2-3 glow accents): raider, sentinel, swarm, brute, drone.
 * o.cmd   'shield' | 'ambush' | 'artillery' | 'carrier' | 'plasma' = a GENERAL (raider, command, sentinel): a tall standard
 *         with a doctrine-colour banner and a 3D emblem, doctrine glow strips on both flanks, painted shoulder plates, more gold.
 * o.seed  small variation of trophies and plate colours (silhouettes never change).
 * b.hi === false is LOW: the same silhouette and colour blocks, the small parts dropped. One material, vertex colours. */
(function(root){
'use strict';
const WK=root.ConquestWorldKit,TAU=Math.PI*2,HP=Math.PI/2,PI=Math.PI;

// ------------------------------------------------------------------ shared parts ---------------------------------------
let K,P,tint,mix;   // the kit and the Parasite palette of the model being built
function use(b){K=b.k;P=K.pal.par;tint=K.tint;mix=K.mix;}
const hz=(s,k)=>WK.hash((s|0)*7919+(k|0)*104729+13),pick=(a,s)=>a[(((s|0)%a.length)+a.length)%a.length];
const lerp3=(a,c,t)=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t,a[2]+(c[2]-a[2])*t];
// cheap box: BASE y, four sides and a top (10 triangles); o.top = top material, o.bot adds the underside
function cb(b,x,y,z,w,h,d,m,o){const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2,y1=y+h,c=[x,y+h/2,z];
 b.quad([x0,y,z1],[x1,y,z1],[x1,y1,z1],[x0,y1,z1],m,c).quad([x0,y,z0],[x1,y,z0],[x1,y1,z0],[x0,y1,z0],m,c).quad([x0,y,z0],[x0,y,z1],[x0,y1,z1],[x0,y1,z0],m,c).quad([x1,y,z0],[x1,y,z1],[x1,y1,z1],[x1,y1,z0],m,c)
  .quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],(o&&o.top)||m,c);if(o&&o.bot)b.quad([x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1],m,c);return b;}
// armoured block: every edge bevelled on HIGH (the hero masses), a cheap box on LOW
const ab=(b,x,y,z,w,h,d,m,ch=.08)=>b.hi?b.bev(x,y,z,w,h,d,m,{ch}):cb(b,x,y,z,w,h,d,m);
// block with a chamfered top edge only (20 triangles): the edge highlight a camera above the unit sees
function blk(b,x,y,z,w,h,d,m,o={}){if(!b.hi)return cb(b,x,y,z,w,h,d,m,o);const ch=Math.min(o.ch??.06,w*.3,h*.45,d*.3),R=K.rect;
 return b.loft([{p:R(w,d,0,x,z),y},{p:R(w,d,0,x,z),y:y+h-ch},{p:R(w-2*ch,d-2*ch,0,x,z),y:y+h}],r=>r?(o.edge||tint(m,1.32,.014)):m,{topMat:o.top||tint(m,1.06),bot:!!o.bot});}
// faceted skin between 3D rings of one vertex count (c = a point inside), and a convex polygon fan
function skin(b,rings,m,c,o={}){const n=rings[0].length,mf=typeof m==='function'?m:()=>m,e=o.open?n-1:n;for(let r=0;r<rings.length-1;r++){const A=rings[r],B=rings[r+1];for(let i=0;i<e;i++){const j=(i+1)%n,mm=mf(r,i);if(mm)b.quad(A[i],A[j],B[j],B[i],mm,c);}}return b;}
function fan(b,R,m,c){let i=1;for(;i+2<R.length;i+=2)b.quad(R[0],R[i],R[i+1],R[i+2],m,c);if(i+1<R.length)b.tri(R[0],R[i],R[i+1],m,c);return b;}
// a convex side profile [[z,y]...] extruded along x; m = material or (edge index) => material (null skips the face)
function xpr(b,pf,x0,x1,m,o={}){const A=pf.map(p=>[x0,p[1],p[0]]),B=pf.map(p=>[x1,p[1],p[0]]);let cy=0,cz=0;for(const p of pf){cy+=p[1];cz+=p[0];}const c=[(x0+x1)/2,cy/pf.length,cz/pf.length],mf=typeof m==='function'?m:()=>m;
 skin(b,[A,B],(r,i)=>mf(i),c);if(o.capA!==false)fan(b,A,o.cap||mf(-1),c);if(o.capB!==false)fan(b,B,o.cap||mf(-1),c);return b;}
// a short cylinder along x (wheels, drums): faceted rim from x0 to x1, a face at x1, a hub on HIGH
function xwheel(b,x0,x1,y,z,r,n,m,hubM,o={}){const A=[],B=[],c=[x0-(x1-x0)*3,y,z],rot=o.rot||0;for(let i=0;i<n;i++){const a=i/n*TAU+rot,cs=Math.cos(a),sn=Math.sin(a);A.push([x0,y+cs*r,z+sn*r]);B.push([x1,y+cs*r,z+sn*r]);}
 if(!o.flat)skin(b,[A,B],tint(m,1.2,.01),c);fan(b,B,o.face||m,c);
 if(hubM&&b.hi){const H=[],xh=x1+(x1-x0)*.3,rh=r*(o.hub||.42);for(let i=0;i<6;i++){const a=i/6*TAU;H.push([xh,y+Math.cos(a)*rh,z+Math.sin(a)*rh]);}fan(b,H,hubM,c);}return b;}
// a caterpillar track at x = s * xc: an octagonal belt whose tread reads as alternating bars, a dark outer face, road wheels.
// wheels = [[z, y, r]...]; LOW keeps the belt and flat wheel discs.
function track(b,s,xc,w,z0,z1,H,o={}){const cf=o.cf??.5,hf=o.hf??.45,cr=o.cr??.4,hr=o.hr??.4,c=o.c??.1,xi=s*(xc-w/2),xo=s*(xc+w/2),ins=[s*xc,H/2,(z0+z1)/2],
  pf=[[z0+cr,0],[z1-cf,0],[z1,hf],[z1,H-c],[z1-c,H],[z0+c,H],[z0,H-c],[z0,hr]],tA=o.m||tint(P.ironD,.6),tB=tint(tA,1.55,.012),pitch=o.pitch||.32,lod=o.lod??(b.hi?2:1);
 for(let e=1;e<8;e++){const p=pf[e],q=pf[(e+1)%8],L=Math.hypot(q[0]-p[0],q[1]-p[1]),n=lod>1?Math.max(1,Math.round(L/pitch)):1;
  for(let k=0;k<n;k++){const t0=k/n,t1=(k+1)/n;b.quad([xi,p[1]+(q[1]-p[1])*t0,p[0]+(q[0]-p[0])*t0],[xo,p[1]+(q[1]-p[1])*t0,p[0]+(q[0]-p[0])*t0],[xo,p[1]+(q[1]-p[1])*t1,p[0]+(q[0]-p[0])*t1],[xi,p[1]+(q[1]-p[1])*t1,p[0]+(q[0]-p[0])*t1],lod>1?((k+e)%2?tA:tB):tint(tA,1.25),ins);}}
 fan(b,pf.map(p=>[xo,p[1],p[0]]),tint(tA,.75),ins);if(o.inner)fan(b,pf.map(p=>[xi,p[1],p[0]]),tint(tA,.75),ins);
 const wm=o.wheel||P.ironL,hub=o.hub||P.rust;(o.wheels||[]).forEach(([z,y,r],i)=>{if(lod<2&&(o.lowSkip||[]).includes(i))return;xwheel(b,xo,xo+s*(o.wt||.07),y,z,r,lod>1?8:6,i%2&&o.wheel2?o.wheel2:wm,hub,{flat:lod<2,rot:i*.4});});return b;}
// a bolted-on armour plate on the +z plane of the current frame: a raised face inside a lighter chamfer rim (10 triangles),
// corner bolts on HIGH. o.stripe = a painted band (a stolen marking), o.haz = hazard chevrons.
function plate(b,x,y,w,h,m,o={}){const t=o.t??.06,x0=x-w/2,x1=x+w/2,y1=y+h,ch=Math.min(o.ch??.05,w*.2,h*.2),e=o.edge||tint(m,1.34,.014),ins=[x,y+h/2,-1],
  A=[[x0,y,0],[x1,y,0],[x1,y1,0],[x0,y1,0]],B=[[x0+ch,y+ch,t],[x1-ch,y+ch,t],[x1-ch,y1-ch,t],[x0+ch,y1-ch,t]];
 b.quad(B[0],B[1],B[2],B[3],m,ins);for(let i=0;i<4;i++){const j=(i+1)%4;b.quad(A[i],A[j],B[j],B[i],i===0?tint(m,.62):e,ins);}
 const zf=t+.006;
 if(o.haz){const n=o.haz,hw=(w-2*ch)/n;for(let k=0;k<n;k+=2){const xa=x0+ch+k*hw,sl=Math.min(hw*.9,(h-2*ch)*.7);b.quad([xa,y+ch,zf],[xa+hw,y+ch,zf],[Math.min(x1-ch,xa+hw+sl),y1-ch,zf],[Math.min(x1-ch,xa+sl),y1-ch,zf],P.hazardD,ins);}}
 if(o.stripe)b.quad([x0+ch,y+h*(o.sy??.56),zf],[x1-ch,y+h*(o.sy??.56),zf],[x1-ch,y+h*((o.sy??.56)+(o.sh??.2)),zf],[x0+ch,y+h*((o.sy??.56)+(o.sh??.2)),zf],o.stripe,ins);
 if(b.hi&&o.bolts!==0){const bm=o.bolt||P.weld,r=.035,d=ch+.07;b.detail(q=>{for(const [bx,by] of [[x0+d,y+d],[x1-d,y+d],[x1-d,y1-d],[x0+d,y1-d]])q.quad([bx-r,by-r,zf+.012],[bx+r,by-r,zf+.012],[bx+r,by+r,zf+.012],[bx-r,by+r,zf+.012],bm,ins);});}
 return b;}
// a louvred vent on the +z plane of the current frame: the red glow of the infection behind dark slats, in a frame
function vent(b,x,y,w,h,n,o={}){const ins=[x,y+h/2,-1],g=o.glow||P.red,fm=o.frame||P.ironD,f=o.f??.05,x0=x-w/2,x1=x+w/2,y1=y+h;
 b.quad([x0,y,.012],[x1,y,.012],[x1,y1,.012],[x0,y1,.012],g,ins);
 if(b.hi||o.low){const sh=h/n;for(let k=0;k<n;k++)b.quad([x0,y+sh*(k+.5),.05],[x1,y+sh*(k+.5),.05],[x1,y+sh*(k+1),.02],[x0,y+sh*(k+1),.02],fm,ins);}
 if(b.hi&&f){b.quad([x0-f,y-f,0],[x1+f,y-f,0],[x1+f,y,.06],[x0-f,y,.06],fm,ins).quad([x0-f,y1,.06],[x1+f,y1,.06],[x1+f,y1+f,0],[x0-f,y1+f,0],tint(fm,1.4,.01),ins).quad([x0-f,y-f,0],[x0,y-f,.06],[x0,y1+f,.06],[x0-f,y1+f,0],fm,ins).quad([x1,y-f,.06],[x1+f,y-f,0],[x1+f,y1+f,0],[x1,y1+f,.06],fm,ins);}
 return b;}
// the infection: a glowing red vein creeping from a to c over a surface whose normal is nr; it meanders, thins out and
// throws short side shoots (HIGH). o.low keeps a straight vein on LOW.
function vein(b,a,c,nr,o={}){if(!b.hi&&!o.low)return b;const n=b.hi?(o.n||4):1,amp=o.amp??.1,r=o.r??.04,sd=o.seed||1,m=o.m||P.red,d=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 let px=d[1]*nr[2]-d[2]*nr[1],py=d[2]*nr[0]-d[0]*nr[2],pz=d[0]*nr[1]-d[1]*nr[0];const pl=Math.hypot(px,py,pz)||1;px/=pl;py/=pl;pz/=pl;let prev=a;
 for(let k=1;k<=n;k++){const t=k/n,off=k<n?(hz(sd,k)-.5)*2*amp:0,q=[a[0]+d[0]*t+px*off,a[1]+d[1]*t+py*off,a[2]+d[2]*t+pz*off],r0=r*(1-.7*(k-1)/n),r1=r*(1-.7*k/n);b.tube(prev,q,r0,m,{n:3,r2:r1});
  if(b.hi&&k<n&&o.shoots!==0&&hz(sd,k+40)>.3){const sg=hz(sd,k+80)>.5?1:-1,L=(.1+.16*hz(sd,k+60))*(o.shoot??1);b.tube(q,[q[0]+px*sg*L+d[0]*.07,q[1]+py*sg*L+d[1]*.07,q[2]+pz*sg*L+d[2]*.07],r1*.8,o.m2||P.redDim,{n:3,r2:.006});}prev=q;}return b;}
// a knot of infected tissue where the growth breaks out of a seam: two soft dark red lumps (never a shell, a spike or a crystal)
function knot(b,x,y,z,r,sd=1){if(!b.hi)return b;const a=hz(sd,1)*TAU;b.ball(x,y-r*.3,z,r*.85,mix(P.strap,P.flesh,1),true);b.ball(x+Math.cos(a)*r*.6,y-r*.2,z+Math.sin(a)*r*.6,r*.55,mix(P.strap,P.fleshL,1),true);return b;}
// a looted crate (stolen supply paint by seed), strapped down
function crate(b,x,y,z,w,h,d,ry=0,o={}){const m=o.m||P.crate;return b.at(x,y,z,ry,q=>{if(q.hi){cb(q,0,0,0,w,h*.8,d,m);cb(q,0,h*.8,0,w+.05,h*.2,d+.05,o.lid||P.crateD,{top:tint(o.lid||P.crateD,1.25)});if(o.strap!==0)cb(q,0,0,0,w*.16,h+.02,d+.08,o.strap||P.strap);if(o.mark)q.quad([-w*.3,h*.2,d/2+.01],[w*.3,h*.2,d/2+.01],[w*.3,h*.55,d/2+.01],[-w*.3,h*.55,d/2+.01],o.mark,[0,0,0]);}else cb(q,0,0,0,w,h,d,m,{top:o.lid||P.crateD});});}
// a loot sack: a slumped, tied bag
function sack(b,x,y,z,r,h,o={}){const m=o.m||P.sack,n=b.hi?6:4,C=K.circ,rot=o.rot||.3,lx=o.lx||0,lz=o.lz||0;
 b.loft([{p:C(r*.78,n,x,z,r*.78*(o.k||1),rot),y},{p:C(r,n,x+lx*.3,z+lz*.3,r*(o.k||1),rot),y:y+h*.3},{p:C(r*.8,n,x+lx*.7,z+lz*.7,r*.8*(o.k||1),rot),y:y+h*.68},{p:C(r*.28,n,x+lx,z+lz,r*.28,rot),y:y+h*.9}],(r2)=>r2===1?tint(m,1.12):m,{smooth:b.hi,topMat:tint(m,.8)});
 if(b.hi)b.loft([{p:C(r*.3,n,x+lx,z+lz,r*.3,rot),y:y+h*.9},{p:C(r*.42,n,x+lx,z+lz,r*.42,rot),y:y+h}],P.strap,{topMat:tint(m,.7)});return b;}
// a rope net thrown over a load: strands over a hump (w x h x d), both diagonals
function net(b,x,y,z,w,h,d,n=4,o={}){if(!b.hi)return b;const m=o.m||tint(P.sack,.82),r=o.r||.022,x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2;
 b.detail(q=>{for(let k=0;k<n;k++){const t=(k+.5)/n,t2=(k+1.2)/n;q.tube([x0,y,z0+d*t],[x+w*.05,y+h,z0+d*Math.min(1,t2-.2)],r,m,{n:3});q.tube([x+w*.05,y+h,z0+d*Math.min(1,t2-.2)],[x1,y,z0+d*Math.min(1,t2)],r,m,{n:3});
   q.tube([x0+w*t,y,z0],[x0+w*Math.max(0,t-.15),y+h,z+d*.05],r,m,{n:3});q.tube([x0+w*Math.max(0,t-.15),y+h,z+d*.05],[x0+w*Math.max(0,t-.3),y,z1],r,m,{n:3});}});return b;}
// a flag taken from a conquered colony, hanging on the +z plane of the current frame from its top edge (x, y = top centre):
// two-sided cloth with a sag, a marking band, a torn swallowtail. kind 0 = LDF (blue, pale band), else a settler colour.
function flag(b,x,y,w,h,kind,o={}){const m=kind===0?P.flagLDF:(o.m||pick(P.flagSet,kind)),m2=kind===0?P.flagLDF2:(o.m2||tint(P.sack,1.25)),sw=o.sway??.07,n=b.hi?3:1,tail=o.tail??.22,x0=x-w/2;
 const zAt=t=>Math.sin(t*PI*1.5+(o.ph||0))*sw*t,rows=[];for(let k=0;k<=n;k++){const t=k/n;rows.push([y-h*(1-tail)*t,zAt(t)]);}
 for(const side of [-1,1]){const ins=[x,y-h/2,-side*9];for(let k=0;k<n;k++){const [ya,za]=rows[k],[yb,zb]=rows[k+1];b.quad([x0,ya,za],[x0+w,ya,za],[x0+w,yb,zb],[x0,yb,zb],m,ins);}
  const [yl,zl]=rows[n],yt=y-h,zt=zAt(1.1);if(tail>0){b.tri([x0,yl,zl],[x0+w*.5,yl,zl],[x0+w*.12,yt,zt],m,ins);b.tri([x0+w*.5,yl,zl],[x0+w,yl,zl],[x0+w*.88,yt,zt],m,ins);}
  if(o.band!==0){const t0=o.b0??.22,t1=o.b1??.42,za=zAt(t0)+side*.012,zb=zAt(t1)+side*.012;b.quad([x0,y-h*(1-tail)*t0,za],[x0+w,y-h*(1-tail)*t0,za],[x0+w,y-h*(1-tail)*t1,zb],[x0,y-h*(1-tail)*t1,zb],m2,ins);}}
 return b;}
// an exhaust stack through points: a pipe with a flared lip and the red heat of the infection in its throat
function stack(b,pts,r,m,o={}){const n=b.hi?6:4;for(let i=1;i<pts.length;i++)b.tube(pts[i-1],pts[i],r,m,{n});const a=pts[pts.length-2],e=pts[pts.length-1],L=Math.hypot(e[0]-a[0],e[1]-a[1],e[2]-a[2])||1,d=[(e[0]-a[0])/L,(e[1]-a[1])/L,(e[2]-a[2])/L],at=k=>[e[0]+d[0]*k,e[1]+d[1]*k,e[2]+d[2]*k];
 if(b.hi)b.tube(at(-.12),at(.02),r*1.3,o.lip||tint(m,.6),{n});b.tube(at(-.01),at(.03),r*.92,o.glow||P.redHot,{n,caps:true});return b;}
// gold trim: a thin bar between two points (square section)
const trim=(b,a,c,r=.035,m)=>b.tube(a,c,r,m||P.gold,{n:4});
// a pole with a gold finial
function pole(b,a,c,r,m,fin=1){b.tube(a,c,r,m||P.ironD,{n:b.hi?5:3,r2:r*.75});if(fin&&b.hi)b.gem(c[0],c[1]+.06,c[2],.07,.11,.07,P.gold);return b;}

// frames: run fn on a flank (s = -1 left, +1 right; the plane's +z points outward), the stern, or lying on a deck
const side=(b,s,x,y,z,fn)=>b.at(s*x,y,z,s*HP,fn),stern=(b,x,y,z,fn)=>b.at(x,y,z,PI,fn),deck=(b,x,y,z,fn,ry=0)=>b.at(x,y,z,ry,fn,-HP);
// a disc facing along z (dir = +1 / -1): tank ends, bores, lenses
function zdisc(b,x,y,z,r,n,m,dir=1,rot=0){const R=[];for(let i=0;i<n;i++){const a=i/n*TAU+rot;R.push([x+Math.cos(a)*r,y+Math.sin(a)*r,z]);}return fan(b,R,m,[x,y,z-dir]);}
// a two-sided flat polygon (convex, [dx, dy] from x, y) in the x-y plane, or the z-y plane when across = 1
function poly2(b,pts,x,y,z,m,across){const R=pts.map(p=>across?[x,y+p[1],z+p[0]]:[x+p[0],y+p[1],z]);fan(b,R,m,across?[x-9,y,z]:[x,y,z-9]);fan(b,R,m,across?[x+9,y,z]:[x,y,z+9]);return b;}
// a stolen oxygen tank lying along z: white, two blue bands, domed ends, a gold valve on the front end
function otank(b,x,y,z0,z1,r,o={}){const n=b.hi?10:6,L=z1-z0,e=Math.min(r*.55,L*.18),w=o.m||P.tank,bd=o.band||P.tankBand,a=z0+e,c=z1-e,B=(c-a),T=(za,zb,ra,rb,m)=>b.tube([x,y,za],[x,y,zb],ra,m,{n,r2:rb});
 T(z0,a,r*.6,r,tint(w,.9));T(a,a+B*.14,r,r,w);T(a+B*.14,a+B*.3,r*1.02,r*1.02,bd);T(a+B*.3,a+B*.7,r,r,w);T(a+B*.7,a+B*.86,r*1.02,r*1.02,bd);T(a+B*.86,c,r,r,w);T(c,z1,r,r*.6,tint(w,.9));
 zdisc(b,x,y,z0,r*.6,n,tint(w,.75),-1);zdisc(b,x,y,z1,r*.6,n,tint(w,.75),1);
 if(b.hi&&o.valve!==0){b.tube([x,y,z1],[x,y,z1+.14],r*.2,P.gold,{n:6,caps:true});}return b;}
// a girder: a rusted I-beam between two points (square tube with lighter flanges)
function girder(b,a,c,r,m){b.tube(a,c,r,m||P.rust,{n:4});if(b.hi){const up=r*.86;b.tube([a[0],a[1]+up,a[2]],[c[0],c[1]+up,c[2]],r*.45,tint(m||P.rust,1.35,.01),{n:4});}return b;}
// the dead glass of a cockpit: dark panes on the +z plane of the current frame with the red of the infection glowing behind the sill
function deadGlass(b,x,y,w,h,o={}){const ins=[x,y+h/2,-1],x0=x-w/2,x1=x+w/2;b.quad([x0,y,.01],[x1,y,.01],[x1,y+h,.01],[x0,y+h,.01],P.glassDead,ins);const gh=Math.min(h*.3,o.gh||.05);b.quad([x0,y,.02],[x1,y,.02],[x1,y+gh,.02],[x0,y+gh,.02],o.glow||P.red,ins);
 if(b.hi&&o.cracks!==0){const sd=o.seed||1;for(let k=0;k<(o.cracks||2);k++){const xa=x0+w*(.2+.6*hz(sd,k));b.tube([xa,y+gh,.03],[xa+(hz(sd,k+9)-.5)*w*.3,y+h*(.55+.4*hz(sd,k+5)),.03],.012+.008*hz(sd,k+3),P.redDim,{n:3,r2:.004});}}return b;}

// ------------------------------------------------------------------ par-raider: the Scavenger ---------------------------
// 2.9 x 2.6 x 5.4. A scout hull stripped to its frame (bare roll cage, a fender torn off, exposed road wheels) under an engine
// far too big for it: a blower and a gold scoop over the block, six stacks, louvred vents glowing red on both sides and a
// grille across the stern. Loot under rope nets on rear panniers and a tail basket. Twin guns on a ring over the cab.
const RAIDER_PIVOT=[0,1.44,.4];
function raiderHull(b,o){const sd=o.seed|0,hi=b.hi,hull=P.ironL,dk=P.iron,st=pick(P.plateSet,sd),st2=pick(P.plateSet,sd+2);
 const W=[[-1.55,.37,.34],[-.62,.37,.34],[.32,.37,.34],[1.22,.37,.34],[1.72,.6,.2],[-1.98,.57,.22]];
 for(const s of [-1,1])track(b,s,1.1,.56,-2.3,2.05,.9,{cf:.55,hf:.5,cr:.45,hr:.42,wheels:W,wt:.05,hub:s>0?P.gold:P.rust,wheel2:P.scrap,lowSkip:[4,5]});
 // the tub and the long low hull: a shallow glacis running to a blunt nose
 cb(b,0,.26,-.1,1.66,.4,4.2,P.ironD);
 xpr(b,[[-2.25,.5],[2.3,.45],[2.62,.62],[2.55,.8],[1.35,1.02],[-2.25,1.02]],-.86,.86,i=>i===0?null:i===3?tint(hull,1.1):i===2?tint(hull,1.3,.01):i===4?dk:hull,{cap:tint(hull,.8)});
 // the glacis: a pale LDF plate bolted on, the colony's band still on it; a hazard ram bar across the nose
 b.at(0,.84,1.98,0,q=>plate(q,sd%2?.12:-.1,-.5,1.3,.98,P.plateMil,{stripe:P.flagLDF,sy:.6,sh:.16,t:.05}),-1.39);
 if(hi){b.at(0,.5,2.61,0,q=>plate(q,0,0,1.9,.24,P.hazard,{haz:8,t:.07,bolts:0}));for(const s of [-1,1])b.tube([s*.6,.62,2.5],[s*.6,.62,2.63],.05,P.ironD,{n:4});}else cb(b,0,.5,2.6,1.9,.24,.1,P.hazard);
 // fenders: the right one whole (a settler's painted panel), the left front torn off; a looted panel hung on the right flank
 blk(b,1.1,.9,-.1,.62,.06,4.3,st,{ch:.03});blk(b,-1.1,.9,-1.2,.62,.06,2.1,P.scrap,{ch:.03});
 side(b,1,1.385,.42,.95,q=>plate(q,0,0,1.25,.46,st2,{t:.04}));if(hi)side(b,-1,1.385,.84,.2,q=>q.quad([0,0,0],[.5,0,0],[.42,.1,.02],[0,.06,0],P.rust,[0,0,-1]));
 // the cab: a faceted pod, dead glass with the red glow behind it
 const R=K.rect;
 b.loft([{p:R(1.36,1.8,0,0,.5),y:1.02},{p:R(1.24,1.5,0,0,.42),y:1.3},{p:R(1.02,1.16,0,0,.38),y:1.44}],(r,i)=>r===1?tint(hull,1.25,.01):(i===1||i===3)?dk:hull,{topMat:P.ironD});
 b.at(0,1.045,1.385,0,q=>deadGlass(q,0,0,1.1,.24,{seed:sd+2,cracks:3}),-.26);
 if(hi){for(const s of [-1,1])b.at(s*.668,1.07,.5,s*HP,q=>deadGlass(q,0,0,1.0,.19,{seed:sd+s,cracks:1,gh:.035}),-.2*1);
  vein(b,[.3,1.06,1.42],[.72,.86,2.2],[0,1,.2],{seed:sd+3,r:.035,n:4});vein(b,[-.5,1.06,1.42],[-.84,.94,1.75],[0,1,.2],{seed:sd+5,r:.03,n:3});vein(b,[-.2,1.3,1.2],[.1,1.45,.95],[0,.6,1],{seed:sd+6,r:.025,n:3,amp:.06});}
 // the bare roll cage
 for(const s of [-1,1]){const n=hi?5:3;b.tube([s*.82,1.02,1.62],[s*.74,1.56,.98],.045,dk,{n});b.tube([s*.74,1.56,.98],[s*.74,1.56,-.3],.045,dk,{n});if(hi){b.tube([s*.74,1.56,-.3],[s*.8,1.02,-.5],.045,dk,{n});b.tube([s*.74,1.56,.3],[s*.8,1.02,.3],.035,dk,{n:4});}}
 // ---- the oversized engine ----
 ab(b,0,1.02,-1.45,1.52,.78,1.72,dk,.09);
 // side vents and the stern grille: where the infection lives
 for(const s of [-1,1])side(b,s,.765,1.16,-1.45,q=>vent(q,0,0,1.26,.46,4,{low:1,frame:P.ironD}));
 stern(b,0,1.14,-2.315,q=>vent(q,0,0,1.16,.52,5,{low:1,frame:P.ironD}));
 // the blower and its scoop (gold: the Scavenger is proud of this engine)
 blk(b,0,1.8,-1.5,.94,.3,1.24,o.cmd?P.goldD:hull,{ch:.07});
 if(hi){for(const z of [-1.92,-1.5,-1.08])cb(b,0,1.8,z,1,.33,.09,P.gold);for(const s of [-1,1])for(const z of [-1.92,-1.5,-1.08])b.tube([s*.47,1.9,z+.14],[s*.62,1.74,z+.14],.05,P.rust,{n:4});}
 xpr(b,[[-1.3,2.1],[-.66,2.1],[-.5,2.16],[-.5,2.48],[-.72,2.52],[-1.3,2.3]],-.4,.4,i=>i===2?P.redHot:i===3||i===4?P.gold:P.goldD,{cap:P.goldD});
 if(hi)for(const x of [-.14,.14])cb(b,x,2.16,-.49,.05,.32,.04,P.ironD);
 // six stacks, three a side, swept up and back
 const pipe=tint(P.rust,1.15,.01);
 for(const s of [-1,1])for(let k=0;k<3;k++){const z=-.96-k*.42,m=k===1?P.gold:pipe;if(!hi&&k===1)continue;stack(b,[[s*.7,1.72,z],[s*.98,1.98,z-.08],[s*1.06,2.44-k*.05,z-.34]],.085,m);}
 // red growth breaking out of the engine seams
 if(hi){knot(b,.5,1.8,-.72,.13,sd);knot(b,-.62,1.8,-2.2,.12,sd+1);vein(b,[.5,1.82,-.74],[.3,1.04,-.1],[0,1,0],{seed:sd+9,n:5,r:.045});vein(b,[-.62,1.82,-2.2],[-.2,2.1,-1.6],[0,1,0],{seed:sd+11,n:4,r:.04});vein(b,[.78,1.62,-.75],[.9,.98,.1],[1,.3,0],{seed:sd+13,n:4,r:.035});vein(b,[-.78,1.64,-.8],[-.95,.96,-.2],[-1,.3,0],{seed:sd+14,n:3,r:.035});}
 // ---- loot: panniers on both rear fenders, a tail basket, all under rope nets ----
 for(const s of [-1,1]){const x=s*1.13;
  if(hi){for(const z of [-2.12,-.72]){b.tube([x-.28,.96,z],[x-.28,1.5,z],.03,dk,{n:4});b.tube([x+.28,.96,z],[x+.28,1.42,z],.03,dk,{n:4});}b.tube([x+.28,1.42,-2.12],[x+.28,1.42,-.72],.03,dk,{n:4});b.tube([x+.28,1.2,-2.12],[x+.28,1.2,-.72],.025,dk,{n:4});}
  crate(b,x,.96,-1.75,.5,.4,.56,s*.12,{m:s>0?P.crate:pick(P.plateSet,sd+1),mark:s>0?P.hazard:P.flagLDF2});sack(b,x,.96,-1.08,.25,.52,{lx:s*.05,lz:.06,rot:s});
  if(hi){crate(b,x-.02,1.36,-1.78,.34,.24,.36,.5,{strap:0});net(b,x,.96,-1.42,.58,.74,1.36,4);}}
 if(hi){for(const s of [-1,1]){b.tube([s*.7,.62,-2.3],[s*.7,.62,-2.62],.035,dk,{n:4});b.tube([s*.7,.62,-2.62],[s*.7,1.06,-2.62],.035,dk,{n:4});}b.tube([-.7,1.06,-2.62],[.7,1.06,-2.62],.035,dk,{n:4});b.tube([-.7,.62,-2.62],[.7,.62,-2.62],.035,dk,{n:4});
  crate(b,-.28,.62,-2.45,.62,.36,.28,0,{mark:P.gold});sack(b,.36,.62,-2.45,.17,.44,{rot:1});stern(b,.02,1.07,-2.645,q=>flag(q,0,0,.9,.56,sd%2?2:0,{tail:.3,sway:.03}));}
 else{cb(b,-.28,.62,-2.46,.62,.4,.34,P.crate);cb(b,.36,.62,-2.46,.4,.36,.34,P.sack);}
 // a whip aerial with a stolen pennant
 pole(b,[-.66,1.8,-2.22],[-.72,2.56,-2.34],.022,dk,0);b.at(-.7,2.5,-2.33,PI+.4,q=>{const m=pick(P.flagSet,sd+1);for(const z of [-9,9])q.tri([0,0,0],[.42,-.1,0],[0,-.22,0],m,[0,0,z]);});
}
function raiderGun(b,o){const sd=o.seed|0,hi=b.hi,n=hi?10:6,D=doc(o);
 b.cyl(0,0,0,.44,.1,P.ironD,{n,topMat:P.iron});if(hi)b.cyl(0,.1,0,.36,.05,P.gold,{n});
 blk(b,0,.1,.02,.46,.3,.62,pick(P.plateSet,sd+3),{ch:.05});
 // the gun shield: two mismatched plates either side of the cradle
 for(const s of [-1,1])b.at(s*.4,.08,.36,s*.16,q=>D?plate(q,0,0,.42,.52,D.paint,{t:.05,edge:P.gold,stripe:P.gold,sy:.42,sh:.12,bolt:P.gold}):plate(q,0,0,.42,.52,s>0?P.plateMil:P.hazard,{haz:s>0?0:4,t:.05,stripe:s>0?P.flagLDF:null}));
 for(const s of [-1,1]){const x=s*.19,y=.3;b.tube([x,y,.2],[x,y,1.0],.085,P.ironD,{n:hi?7:4});b.tube([x,y,1.0],[x,y,1.66],.052,P.ironL,{n:hi?6:4});b.tube([x,y,1.56],[x,y,1.74],.085,P.ironD,{n:hi?6:4,caps:true});
  if(hi){b.tube([x,y,1.0],[x,y,1.04],.1,P.gold,{n:7});b.tube([x,y,.2],[x,y,.24],.1,P.gold,{n:7});zdisc(b,x,y,1.745,.05,6,P.redLow);}}
 // ammo drums, a red-lit sight
 if(hi){for(const s of [-1,1])xwheel(b,s*.24,s*.44,.22,-.08,.17,8,P.scrap,P.gold);cb(b,0,.4,.1,.12,.1,.26,P.ironD);b.quad([-.05,.42,.235],[.05,.42,.235],[.05,.48,.235],[-.05,.48,.235],P.red,[0,.45,0]);vein(b,[.08,.4,-.2],[.2,.12,.3],[1,.5,0],{seed:sd+2,n:3,r:.022,amp:.05});}
}
function raiderTown(b,o){const sd=o.seed|0;
 for(const s of [-1,1])track(b,s,1.1,.56,-2.3,2.05,.9,{cf:.55,hf:.5,cr:.45,hr:.42,lod:0});
 xpr(b,[[-2.25,.5],[2.3,.45],[2.62,.7],[1.35,1.02],[-2.25,1.02]],-.86,.86,i=>i===0?null:P.ironL,{cap:tint(P.ironL,.8)});
 b.quad([-.6,.72,2.56],[.6,.72,2.56],[.6,.99,1.5],[-.6,.99,1.5],P.plateMil,[0,-2,0]);
 b.loft([{p:K.rect(1.3,1.7,0,0,.5),y:1.02},{p:K.rect(1.02,1.16,0,0,.38),y:1.44}],(r,i)=>i===2?P.glassDead:P.ironL,{topMat:P.ironD});b.quad([-.6,1.03,1.365],[.6,1.03,1.365],[.56,1.2,1.21],[-.56,1.2,1.21],P.red,[0,1,0]);
 cb(b,0,1.02,-1.45,1.52,.78,1.72,P.iron);for(const s of [-1,1])b.quad([s*.77,1.18,-2.05],[s*.77,1.18,-.85],[s*.77,1.6,-.85],[s*.77,1.6,-2.05],P.red,[0,1.4,-1.45]);
 b.quad([-.58,1.16,-2.32],[.58,1.16,-2.32],[.58,1.64,-2.32],[-.58,1.64,-2.32],P.red,[0,1.4,-1.45]);
 cb(b,0,1.8,-1.4,.9,.62,1.2,P.goldD,{top:P.gold});
 for(const s of [-1,1]){b.tube([s*.72,1.7,-1.3],[s*1.05,2.44,-1.75],.11,P.rust,{n:3});cb(b,s*1.13,.94,-1.4,.56,.5,1.3,s>0?P.crate:P.sack);b.tube([s*.19,1.74,.5],[s*.19,1.74,2.1],.08,P.ironD,{n:3});}
 cb(b,0,1.44,.42,.7,.4,.6,pick(P.plateSet,sd+3));cb(b,0,.62,-2.5,1.3,.4,.34,P.crate);
}

// ------------------------------------------------------------------ par-breacher: the Siphon ----------------------------
// 4 x 4.3 x 6.2. A mid hull pushed to the back of its footprint by what it carries: three stolen OXYGEN TANKS (white, blue
// bands) stacked two-and-one under a gantry, and a long SIPHON LANCE on the nose (a hazard-striped ram housing, a hydraulic
// shaft, a pale hardened point) fed by a blue oxygen hose from the tanks. The turning part is a short siege mortar.
const BREACHER_PIVOT=[0,1.62,-.3];
function breacherHull(b,o){const sd=o.seed|0,hi=b.hi,hull=P.ironL,dk=P.iron;
 const W=[[-2.3,.4,.37],[-1.52,.4,.37],[-.74,.4,.37],[.04,.4,.37],[.46,.74,.22],[-2.72,.7,.24]];
 for(const s of [-1,1])track(b,s,1.52,.8,-3.0,.75,1.15,{cf:.55,hf:.6,cr:.5,hr:.52,wheels:W,wt:.05,lowSkip:[4,5],hub:s>0?P.rust:P.gold});
 cb(b,0,.3,-1.15,2.3,.5,3.5,P.ironD);
 xpr(b,[[-3.0,.62],[.5,.55],[.92,.85],[.86,1.18],[.3,1.62],[-3.0,1.62]],-1.18,1.18,i=>i===0?null:i===3?tint(hull,1.1):i===2?tint(hull,1.3,.01):i===4?tint(dk,1.25):hull,{cap:tint(hull,.8)});
 // sponsons over the tracks, and three looted skirt plates a side, none alike
 blk(b,1.52,1.15,-1.15,.84,.2,3.7,pick(P.plateSet,sd+1),{ch:.04});blk(b,-1.52,1.15,-1.15,.84,.2,3.7,P.plateMilD,{ch:.04});
 const SK=[[-2.3,1.3,.62],[-1.05,1.16,.5],[.1,1.06,.56]],MR=[[P.plateMil,{stripe:P.flagLDF}],[pick(P.plateSet,sd),{}],[P.hazard,{haz:6}]],ML=[[pick(P.plateSet,sd+3),{}],[P.hazard,{haz:6}],[P.plateMil,{stripe:P.flagLDF,sy:.3}]];
 for(const s of [-1,1])SK.forEach(([z,w,h],k)=>{const [m,po]=(s>0?MR:ML)[k];side(b,s,1.925,1.2-h,z,q=>plate(q,0,0,w,h,m,Object.assign({t:.05},po)));});
 // the driver's visor on the glacis: dead glass, the red behind it
 b.at(0,1.26,.78,0,q=>deadGlass(q,0,0,1.5,.26,{seed:sd+1,cracks:3}),-.905);
 if(hi){b.at(0,1.47,.52,0,q=>plate(q,0,0,1.7,.2,pick(P.plateSet,sd+2),{t:.07}),-.905);vein(b,[.5,1.34,.7],[1.0,1.2,.84],[0,.8,.6],{seed:sd+4,n:3,r:.03});vein(b,[-.3,1.36,.68],[-.9,1.64,.1],[0,1,0],{seed:sd+5,n:4,r:.035});}
 // the stern: a louvred engine vent glowing red, two stacks
 stern(b,0,.82,-3.01,q=>vent(q,0,0,1.9,.6,5,{low:1,frame:P.ironD}));
 for(const s of [-1,1])stack(b,[[s*.98,1.62,-2.8],[s*1.02,2.2,-2.84],[s*1.1,2.62,-2.92]],.1,s>0?P.gold:tint(P.rust,1.15,.01));
 // ---- the stolen oxygen: three tanks in a cradle under a gantry ----
 const TZ0=-2.85,TZ1=-1.1,TR=.56,TY=2.32,TY2=3.29;
 for(const z of [-2.45,-1.5])cb(b,0,1.62,z,2.56,.2,.26,P.ironD);
 for(const s of [-1,1])otank(b,s*.6,TY,TZ0,TZ1,TR,{valve:0});otank(b,0,TY2,TZ0,TZ1,TR);
 if(hi)for(const z of [-2.45,-1.5]){for(const s of [-1,1])b.tube([s*.6,TY,z-.06],[s*.6,TY,z+.06],TR*1.05,P.strap,{n:10});b.tube([0,TY2,z-.06],[0,TY2,z+.06],TR*1.05,P.strap,{n:10});}
 for(const z of [-2.45,-1.5]){const n=hi?5:3;for(const s of [-1,1]){b.tube([s*1.26,1.62,z],[s*1.26,2.95,z],.055,dk,{n});b.tube([s*1.26,2.95,z],[s*.42,3.98,z],.055,dk,{n});}b.tube([-.42,3.98,z],[.42,3.98,z],.055,dk,{n});}
 b.tube([0,3.98,-2.45],[0,3.98,-1.5],.06,dk,{n:4});
 blk(b,0,3.9,-1.98,.46,.2,.46,P.ironD,{ch:.05});if(hi){b.tube([0,4.1,-1.98],[0,4.2,-1.98],.035,P.ironL,{n:4});b.cyl(0,4.19,-1.98,.2,.045,P.gold,{n:6,bot:true});}
 // the blue oxygen hose: from the top tank's valve, down the right flank, to the lance
 const hose=tint(P.tankBand,1.15),HP_=[[0,TY2,-.96],[.25,3.2,-.82],[.98,2.3,-.74],[1.07,1.74,-.6],[1.07,1.72,.1],[.9,1.56,.62],[.42,1.62,1.2],[.22,1.5,1.72]];
 if(hi)b.pipe(HP_,.075,hose,{n:6,joint:P.gold});else for(let i=1;i<HP_.length;i++)b.tube(HP_[i-1],HP_[i],.08,hose,{n:3});
 if(hi)for(const s of [-1,1]){b.tube([s*.6,TY,TZ1],[s*.6,TY,TZ1+.12],.11,P.gold,{n:6,caps:true});b.tube([s*.6,TY,TZ1+.08],[s*.3,TY+.6,TZ1+.12],.045,hose,{n:4});b.tube([s*.3,TY+.6,TZ1+.12],[0,TY2-.1,TZ1+.12],.045,hose,{n:4});}
 // the infection has found the oxygen: red growth over the white tanks
 if(hi){knot(b,.1,3.87,-1.75,.13,sd+2);vein(b,[.12,3.86,-1.75],[.47,3.63,-2.7],[.4,.9,0],{seed:sd+7,n:5,r:.04});vein(b,[.1,3.86,-1.7],[-.4,3.7,-1.15],[-.3,.9,0],{seed:sd+8,n:4,r:.035});vein(b,[-.38,3.7,-1.2],[-.95,2.75,-1.3],[-.8,.5,0],{seed:sd+9,n:4,r:.035});vein(b,[1.0,2.76,-2.0],[1.14,2.2,-2.7],[1,.2,0],{seed:sd+10,n:3,r:.03});}
 else{vein(b,[.12,3.86,-1.75],[.47,3.63,-2.7],[.4,.9,0],{low:1,r:.05});vein(b,[-.2,3.82,-1.7],[-.95,2.75,-1.3],[-.8,.5,0],{low:1,r:.05});}
 // ---- the siphon lance: a ram housing on the nose, a hydraulic shaft, a pale hardened point ----
 const LY=1.08;ab(b,0,.62,1.16,1.3,.86,.84,dk,.09);
 for(const s of [-1,1])side(b,s,.655,.7,1.16,q=>plate(q,0,0,.72,.66,P.hazard,{haz:5,t:.04}));
 deck(b,0,1.485,1.16,q=>plate(q,0,-.34,.96,.68,P.plateMil,{t:.04,stripe:P.flagLDF,sy:.36,sh:.26}));
 const n=hi?8:5;b.tube([0,LY,1.56],[0,LY,1.96],.39,P.ironD,{n,caps:true});b.tube([0,LY,1.9],[0,LY,2.44],.25,hull,{n});b.tube([0,LY,2.36],[0,LY,2.54],.35,P.gold,{n,caps:true});
 b.tube([0,LY,2.54],[0,LY,2.72],.22,P.plateMil,{n:6});b.tube([0,LY,2.72],[0,LY,3.09],.22,tint(P.plateMil,1.2,.02),{n:6,r2:.02});
 b.tube([0,LY,2.545],[0,LY,2.565],.3,P.red,{n});
 if(hi){b.tube([0,LY,1.94],[0,LY,2.01],.41,P.gold,{n});b.tube([0,LY,2.08],[0,LY,2.22],.265,P.hazard,{n});b.tube([0,LY,2.62],[0,LY,2.66],.24,P.ironD,{n:6});
  for(const s of [-1,1]){b.tube([s*.78,1.0,.9],[s*.5,1.06,1.85],.07,dk,{n:5});b.tube([s*.5,1.06,1.85],[s*.3,LY,2.4],.045,P.gold,{n:5});}
  // the point is where it feeds: red in the coupling, growth creeping back along the shaft
  vein(b,[.1,LY+.25,2.44],[.24,LY+.4,1.62],[0,1,0],{seed:sd+12,n:4,r:.035,amp:.07});vein(b,[-.12,LY+.2,2.7],[-.03,LY+.04,3.04],[-.6,.8,0],{seed:sd+13,n:2,r:.025,amp:.03,shoots:0});}
 // ---- loot: stolen oxygen bottles on the left, a crate and a sack on the right, a settler flag on a pole ----
 for(let k=0;k<3;k++){const z=-2.5+k*.4;b.cyl(-1.56,1.35,z,.16,.62,P.tank,{n:hi?7:4,band:r=>P.tank,topMat:P.gold});if(hi)b.cyl(-1.56,1.6,z,.166,.12,P.tankBand,{n:7,top:false});}
 if(hi){b.tube([-1.9,1.35,-2.7],[-1.9,1.75,-2.7],.025,dk,{n:3});b.tube([-1.9,1.35,-1.5],[-1.9,1.75,-1.5],.025,dk,{n:3});b.tube([-1.9,1.75,-2.7],[-1.9,1.75,-1.5],.025,dk,{n:3});}
 crate(b,1.56,1.35,-2.3,.62,.44,.7,.1,{mark:P.flagLDF2,m:pick([P.crate,P.plateSet[1],P.plateSet[3]],sd)});sack(b,1.5,1.35,-1.6,.27,.5,{rot:.8,lz:-.05});
 pole(b,[-1.2,1.62,-2.92],[-1.2,4.1,-2.92],.035,dk);b.at(-1.2,4.02,-2.92,0,q=>flag(q,-.41,0,.76,.66,2+sd%3,{tail:.28}));
}
function breacherGun(b,o){const sd=o.seed|0,hi=b.hi,n=hi?10:6,dk=P.iron;
 b.cyl(0,0,0,.62,.14,P.ironD,{n,topMat:dk});b.cyl(0,.14,0,.52,.3,pick(P.plateSet,sd+4),{n,r2:.46,topMat:dk});if(hi)b.cyl(0,.12,0,.55,.07,P.gold,{n,top:false});
 for(const s of [-1,1])xpr(b,[[-.34,.44],[.36,.44],[.22,.84],[-.12,.84]],s*.3,s*.4,P.ironL);
 const e=[0,.87,.5],d=[0,.6,.8],at=k=>[0,e[1]+d[1]*k,e[2]+d[2]*k];
 b.tube([0,.42,-.1],e,.27,P.ironD,{n});b.tube(at(-.2),at(.02),.32,P.gold,{n,caps:true});b.tube(at(.01),at(.03),.23,P.weld,{n:hi?8:5,caps:true});
 blk(b,0,.44,-.32,.5,.3,.34,dk,{ch:.05});
 if(hi){b.tube(at(-.5),at(-.42),.3,P.hazard,{n});for(const x of [-.17,0,.17]){b.cyl(x,.74,-.34,.07,.15,P.hazard,{n:6,top:false});b.cyl(x,.89,-.34,.07,.09,P.gold,{n:6,r2:.035});}vein(b,[.2,.5,-.2],[.47,.2,.2],[1,.4,0],{seed:sd+3,n:3,r:.025,amp:.05});}
}

// ------------------------------------------------------------------ par-sentinel: the Hoard Fortress --------------------
// 4.8 x 5.4 x 6. A titan hull that cannot be seen for what is bolted to it: two layers of looted skirt plates (LDF ceramic,
// settler panels, hazard sheet), plates stacked on the glacis, crates and sacks on every flat, stolen flags on poles at the
// stern. On top, wider than it should be, a gaudy turret: gold bands, a gold-framed mantlet, a fat siege cannon with a gold
// muzzle, a hoard of crates behind a gold rail on the roof. The infection glows in the turret ring, the vents and the cupola.
const SENTINEL_PIVOT=[0,2.0,-.25];
function sentinelHull(b,o){const sd=o.seed|0,hi=b.hi,hull=P.ironL,dk=tint(P.iron,1.25),S=P.plateSet;
 const W=[[-1.8,.47,.45],[-.75,.47,.45],[.3,.47,.45],[1.35,.47,.45],[2.18,.86,.3],[-2.38,.82,.3]];
 for(const s of [-1,1])track(b,s,1.82,1.0,-2.8,2.72,1.3,{cf:.7,hf:.72,cr:.55,hr:.62,wheels:W,wt:.05,lowSkip:[4,5],hub:s>0?P.gold:P.rust});
 cb(b,0,.34,-.05,2.7,.5,4.9,P.ironD);
 xpr(b,[[-2.8,.65],[2.3,.6],[2.82,1.0],[2.76,1.45],[1.95,2.0],[-2.8,2.0]],-1.34,1.34,i=>i===0?null:i===3?tint(hull,1.1):i===2?tint(hull,1.25,.01):i===4?dk:hull,{cap:tint(hull,.8)});
 blk(b,1.83,1.3,-.05,1.0,.45,5.45,pick(S,sd+1),{ch:.05});blk(b,-1.83,1.3,-.05,1.0,.45,5.45,P.plateMilD,{ch:.05});
 // ---- buried in plunder: a first layer of four skirt plates a side, a second layer bolted over the joints ----
 const SZ=[[-2.08,1.36],[-.7,1.3],[.6,1.22],[1.86,1.2]],SY=[.72,.64,.76,.7],ST=[1.74,1.8,1.7,1.76],
  MR=[[P.plateMil,{stripe:P.flagLDF}],[pick(S,sd),{}],[P.hazard,{haz:7}],[P.scrap,{}]],ML=[[pick(S,sd+2),{}],[P.plateMil,{stripe:P.flagLDF,sy:.2}],[pick(S,sd+4),{stripe:P.flagLDF2,sy:.62,sh:.12}],[P.hazard,{haz:6}]];
 for(const s of [-1,1]){SZ.forEach(([z,w],k)=>{const [m,po]=(s>0?MR:ML)[k];side(b,s,2.325,SY[k],z,q=>plate(q,0,0,w,ST[k]-SY[k],m,Object.assign({t:.035,bolt:P.gold},po)));});
  side(b,s,2.35,.98,-1.38,q=>plate(q,0,0,.74,.62,s>0?P.rust:P.plateMil,{t:.03}));side(b,s,2.35,1.06,1.24,q=>plate(q,0,0,.66,.56,s>0?pick(S,sd+3):P.rust,{t:.03}));}
 // the glacis under two more looted plates; spare track links and gold tow hooks on the nose
 b.at(0,1.46,2.75,0,q=>{plate(q,-.66,.06,1.22,.86,P.plateMil,{stripe:P.flagLDF,sy:.5,t:.07});plate(q,.64,.1,1.24,.8,pick(S,sd+2),{t:.06});},-.975);
 if(hi)b.at(0,1.02,2.83,0,q=>{for(let k=0;k<6;k++)cb(q,-.95+k*.38,.04,.05,.3,.34,.1,k%2?tint(P.ironD,.6):tint(P.ironD,.95));for(const s of [-1,1])cb(q,s*1.22,.1,.06,.12,.2,.14,P.gold);},-.13);
 // the driver's hood: dead glass, the red behind it
 blk(b,0,2.0,1.74,1.3,.24,.42,dk,{ch:.05});b.at(0,2.03,1.955,0,q=>deadGlass(q,0,0,1.1,.17,{seed:sd+1,gh:.04}));
 // ---- loot on every flat ----
 if(!o.cmd){crate(b,1.83,1.75,2.18,.72,.42,.62,.08,{mark:P.flagLDF2});sack(b,-1.8,1.75,2.25,.28,.5,{rot:.4,lz:-.05});}
 if(hi&&!o.cmd){sack(b,1.78,1.75,1.55,.24,.44,{rot:1.2});crate(b,-1.85,1.75,1.62,.5,.34,.5,-.2,{m:pick(S,sd+1),mark:P.hazard});}
 for(const s of [-1,1]){crate(b,s*1.84,1.75,-2.3,.8,.5,.8,s*.06,{m:s>0?pick(S,sd+3):P.crate,mark:P.gold});if(hi){crate(b,s*1.8,2.25,-2.34,.5,.32,.5,.4,{strap:0});net(b,s*1.84,1.75,-2.3,.86,.86,.86,3);}}
 // the stern: louvred vents glowing red (deck and stern face), stacks, a stolen flag draped over the plate
 for(const s of [-1,1])deck(b,s*.72,2.0,-2.4,q=>vent(q,0,-.3,.92,.6,4,{low:1,frame:P.ironD}));
 stern(b,0,.76,-2.81,q=>vent(q,0,0,2.0,.58,5,{low:1,frame:P.ironD}));stern(b,0,2.0,-2.83,q=>flag(q,0,0,1.7,.6,sd%2?3:0,{tail:.3,sway:.03}));
 for(const s of [-1,1])stack(b,[[s*1.24,2.0,-2.56],[s*1.28,2.5,-2.62],[s*1.36,2.9,-2.76]],.12,s>0?tint(P.rust,1.15,.01):P.gold);
 // stolen flags on tall poles at the stern corners
 for(const s of [-1,1]){pole(b,[s*2.06,1.75,-2.6],[s*2.06,5.22,-2.6],.04,P.ironD);b.tube([s*2.06,5.08,-2.6],[s*1.06,5.08,-2.6],.025,P.gold,{n:4});b.at(s*1.56,5.06,-2.6,0,q=>flag(q,0,0,.92,1.12,s>0?0:1+sd%4,{ph:s}));}
 // red growth out of the vents and the hood
 if(hi){knot(b,.2,2.0,-2.05,.14,sd);vein(b,[.2,2.02,-2.05],[1.3,2.02,-1.9],[0,1,0],{seed:sd+3,n:4,r:.04});vein(b,[-.2,2.02,-2.1],[-1.36,1.76,-1.5],[0,1,0],{seed:sd+4,n:4,r:.04});vein(b,[-.5,2.26,1.74],[-1.2,2.02,1.2],[0,1,0],{seed:sd+5,n:3,r:.035});
  vein(b,[2.35,1.7,-.1],[2.36,1.0,.3],[1,0,0],{seed:sd+6,n:4,r:.03});vein(b,[-2.35,1.76,-1.3],[-2.36,.9,-.9],[-1,0,0],{seed:sd+7,n:4,r:.03});}
}
function sentinelGun(b,o){const sd=o.seed|0,hi=b.hi,R=K.rect,S=P.plateSet,tm=tint(P.iron,1.6,.012),dk=tint(P.iron,1.2),n=hi?12:8,D=doc(o);
 b.cyl(0,0,0,1.4,.22,P.ironD,{n,top:false});
 // the infection glows in the turret ring
 b.loft([{p:K.circ(1.43,n),y:.05},{p:K.circ(1.43,n),y:.16}],P.red,{top:false,smooth:true});
 // the body: under-cut below, widest at the gold band, a sloped crown; looted panels welded over the corners
 const CM=D?[pick(S,sd+1),D.paint,D.paint,pick(S,sd+3)]:[pick(S,sd+1),P.hazard,P.plateMil,pick(S,sd+3)];   // a general's turret cheeks wear the doctrine colour, its crown is gold
 b.loft([{p:R(3.1,2.7,.5),y:.2},{p:R(4.0,3.3,.62),y:.68},{p:R(3.86,3.16,.6),y:1.72},{p:R(3.1,2.5,.5),y:2.1}],(r,i)=>r===0?P.ironD:r===2?(D?P.goldD:tint(tm,1.18,.01)):(i%2?CM[(i-1)/2]:tm),{topMat:dk});
 b.loft([{p:R(4.07,3.37,.64),y:.6},{p:R(4.07,3.37,.64),y:.76}],P.gold,{top:false});b.loft([{p:R(3.93,3.23,.62),y:1.66},{p:R(3.93,3.23,.62),y:1.77}],P.gold,{top:false});
 // looted plates on the flanks, a vent and a draped flag on the bustle
 side(b,1,1.99,.84,0,q=>{plate(q,.5,0,.96,.78,P.plateMil,{stripe:P.flagLDF,t:.05,bolt:P.gold});plate(q,-.5,.04,.9,.7,P.rust,{t:.05});});
 side(b,-1,1.99,.84,0,q=>{plate(q,.5,.02,.9,.74,P.hazard,{haz:5,t:.05});plate(q,-.5,0,.96,.78,pick(S,sd+2),{t:.05,bolt:P.gold,stripe:P.flagLDF2,sy:.2,sh:.12});});
 stern(b,0,.82,-1.66,q=>vent(q,0,0,1.5,.3,3,{low:1,frame:P.ironD}));stern(b,0,1.7,-1.63,q=>flag(q,0,0,1.5,.56,2+sd%3,{tail:.3,sway:.03}));
 // the mantlet in a gold frame, the fat siege cannon
 ab(b,0,.2,1.82,1.8,1.0,.5,P.ironD,.08);
 if(hi){cb(b,0,1.12,2.09,1.84,.09,.06,P.gold);cb(b,0,.19,2.09,1.84,.09,.06,P.gold);for(const s of [-1,1])cb(b,s*.87,.28,2.09,.09,.84,.06,P.gold);}
 const y=.68,nb=hi?10:6;b.tube([0,y,2.05],[0,y,2.62],.38,P.ironD,{n:nb});b.tube([0,y,2.56],[0,y,3.04],.31,tm,{n:nb});b.tube([0,y,2.98],[0,y,3.22],.44,P.gold,{n:nb,caps:true});zdisc(b,0,y,3.226,.27,nb,P.weld);
 if(hi){b.tube([0,y,2.56],[0,y,2.66],.42,P.gold,{n:nb,caps:true});b.tube([0,y,2.76],[0,y,2.86],.325,P.hazard,{n:nb});b.tube([.62,.92,2.05],[.62,.92,2.5],.06,P.ironL,{n:5,caps:true});}
 // the cupola: dead glass all round, red behind it
 b.cyl(-.8,2.1,-.3,.47,.12,P.ironD,{n:8,top:false});b.cyl(-.8,2.22,-.3,.43,.17,P.glassDead,{n:8,top:false,flat:true});b.cyl(-.8,2.21,-.3,.445,.045,P.red,{n:8,top:false});b.cyl(-.8,2.39,-.3,.5,.09,P.gold,{n:8,topMat:dk});
 // the hoard on the roof behind a gold rail
 const RL=R(2.76,2.2,.4);
 if(hi){RL.forEach((p,i)=>{const q=RL[(i+1)%8];b.tube([p[0],2.1,p[1]],[p[0],2.44,p[1]],.03,P.gold,{n:4});b.tube([p[0],2.44,p[1]],[q[0],2.44,q[1]],.03,P.gold,{n:4});});}
 else b.loft([{p:RL,y:2.1},{p:RL,y:2.24}],P.gold,{top:false});
 crate(b,.55,2.1,-.5,.95,.56,.74,.2,{mark:P.flagLDF2});crate(b,.6,2.66,-.55,.56,.34,.5,-.3,{lid:P.gold,strap:P.gold,m:P.crateD});sack(b,-.1,2.1,.5,.32,.58,{rot:.6});
 if(hi){sack(b,.9,2.1,.42,.26,.48,{rot:2,lx:.05});crate(b,-.55,2.1,-.98,.6,.36,.5,-.15,{m:pick(S,sd+4),mark:P.hazard});net(b,.55,2.1,-.5,1.05,.96,.84,4);for(const [x,z] of [[1.52,.9],[-1.52,.9],[1.52,-.9],[-1.52,-.9]])b.gem(x,2.2,z,.1,.2,.1,P.gold);}
 // red growth from the ring, the cupola and the mantlet
 if(hi){vein(b,[-.5,2.12,-.02],[.3,2.12,.95],[0,1,0],{seed:sd+2,n:4,r:.04});vein(b,[-1.2,2.1,-.1],[-1.9,1.5,.5],[-1,.5,0],{seed:sd+3,n:4,r:.04});vein(b,[1.0,.74,1.72],[1.5,1.6,1.5],[.4,0,1],{seed:sd+4,n:4,r:.04});vein(b,[-.95,.3,2.09],[-.6,1.16,2.1],[0,0,1],{seed:sd+5,n:3,r:.035});knot(b,-.36,2.1,-.02,.13,sd+1);}
}

// ------------------------------------------------------------------ par-command: the Warlord ----------------------------
// 4.7 x 6.6 x 5.8. A titan hull turned into a parade float: a conning tower amidships carrying a RAISED COMMAND CUPOLA (an
// overhanging bridge, dead glass all round with the red glow behind it), an ANTENNA MAST with a looted dish and a yard of
// banners, and on both flanks tall SHOW PANELS (stolen armour boards in a gold frame) hung with the banners of conquered
// colonies. The turning part is a pulse projector on the fore deck.
const COMMAND_PIVOT=[0,1.9,1.3];
function commandHull(b,o){const sd=o.seed|0,hi=b.hi,hull=P.ironL,dk=tint(P.iron,1.25),S=P.plateSet,R=K.rect,TZ=-.85;
 const W=[[-1.8,.45,.43],[-.8,.45,.43],[.2,.45,.43],[1.2,.45,.43],[2.1,.82,.28],[-2.4,.8,.28]];
 for(const s of [-1,1])track(b,s,1.78,1.0,-2.8,2.65,1.25,{cf:.7,hf:.7,cr:.55,hr:.6,wheels:W,wt:.05,lowSkip:[4,5],hub:P.gold});
 cb(b,0,.32,-.1,2.6,.5,4.8,P.ironD);
 xpr(b,[[-2.8,.65],[2.2,.6],[2.72,.95],[2.66,1.4],[1.95,1.9],[-2.8,1.9]],-1.3,1.3,i=>i===0?null:i===3?tint(hull,1.1):i===2?tint(hull,1.25,.01):i===4?dk:hull,{cap:tint(hull,.8)});
 blk(b,1.78,1.25,-.08,1.0,.4,5.3,P.plateMilD,{ch:.05});blk(b,-1.78,1.25,-.08,1.0,.4,5.3,pick(S,sd+2),{ch:.05});
 // the glacis: a looted plate, the driver's dead glass above it
 b.at(0,1.42,2.64,0,q=>{plate(q,0,.04,2.1,.5,pick(S,sd),{t:.06,stripe:P.flagLDF2,sy:.4,sh:.2});deadGlass(q,0,.6,1.5,.2,{seed:sd+1,gh:.04});},-.956);
 // track skirts forward of the show panels
 for(const s of [-1,1])side(b,s,2.285,.72,1.6,q=>plate(q,0,0,1.5,.92,s>0?P.hazard:P.plateMil,{t:.04,haz:s>0?7:0,stripe:s>0?null:P.flagLDF}));
 // ---- the conning tower and the raised cupola ----
 const TM=[P.plateMil,pick(S,sd+1),P.hazard,pick(S,sd+3)];
 b.loft([{p:R(2.5,2.6,.4,0,TZ),y:1.9},{p:R(2.1,2.2,.35,0,TZ),y:3.25}],(r,i)=>i%2?TM[(i-1)/2]:(i===0||i===4?hull:tint(hull,.9)),{top:false});
 b.loft([{p:R(2.1,2.2,.35,0,TZ),y:3.25},{p:R(3.0,3.0,.85,0,TZ),y:3.46},{p:R(3.0,3.0,.85,0,TZ),y:3.62}],(r,i)=>r===0?P.ironD:tint(hull,1.15,.01),{top:true,topMat:P.ironD});
 b.loft([{p:R(2.9,2.9,.82,0,TZ),y:3.62},{p:R(2.9,2.9,.82,0,TZ),y:4.02}],P.glassDead,{top:false});
 b.loft([{p:R(2.93,2.93,.83,0,TZ),y:3.62},{p:R(2.93,2.93,.83,0,TZ),y:3.69}],P.red,{top:false});
 b.loft([{p:R(3.12,3.12,.9,0,TZ),y:4.0},{p:R(3.12,3.12,.9,0,TZ),y:4.14},{p:R(2.2,2.2,.6,0,TZ),y:4.38}],(r)=>r===0?P.gold:o.cmd?P.goldD:hull,{bot:true,topMat:dk});
 if(hi){R(2.94,2.94,.83,0,TZ).forEach(p=>b.tube([p[0],3.62,p[1]],[p[0],4.02,p[1]],.04,P.gold,{n:4}));
  // a hatch, a ladder up the stern face, a looted plate and a door on the tower
  b.cyl(.6,4.3,TZ+.3,.3,.1,P.ironD,{n:8,topMat:P.gold});b.ladder([0,1.92,TZ-1.33],[0,3.3,TZ-1.13],P.ironD,{w:.4});
  side(b,1,1.2,2.05,TZ,q=>plate(q,0,.1,1.2,.9,pick(S,sd+4),{t:.05,stripe:P.gold,sy:.74,sh:.08}),);b.at(0,2.0,TZ+1.27,0,q=>plate(q,0,.1,.9,1.0,P.plateMil,{t:.05,stripe:P.flagLDF}),-.15);}
 // ---- the antenna mast: a lattice, a looted dish, a yard of banners, a red lamp ----
 const MZ=TZ-.3,MY=4.36;
 if(hi)b.truss(0,MY,MZ,.56,.2,1.76,dk,{step:.6,r:.03});else b.tube([0,MY,MZ],[0,MY+1.76,MZ],.16,dk,{n:4,r2:.07});
 b.tube([0,MY+1.76,MZ],[0,6.58,MZ],.022,P.ironL,{n:3});b.cyl(0,MY+1.78,MZ,.07,.15,P.red,{n:5});
 b.tube([-1.3,5.56,MZ],[1.3,5.56,MZ],.035,P.gold,{n:4});for(const s of [-1,1]){b.at(s*.84,5.54,MZ,0,q=>flag(q,0,0,.72,1.0,s>0?0:1+sd%4,{ph:s*2}));if(hi)b.gem(s*1.32,5.56,MZ,.06,.09,.06,P.gold);}
 b.tube([0,4.86,MZ+.3],[0,4.98,MZ+.56],.08,P.plateMil,{n:hi?8:5,r2:.44});zdisc(b,0,4.975,MZ+.55,.43,hi?8:5,P.plateMilD);b.tube([0,4.975,MZ+.55],[0,5.05,MZ+.74],.03,P.gold,{n:3});b.tube([0,4.8,MZ],[0,4.88,MZ+.32],.05,dk,{n:4});
 if(hi){b.tube([-.5,6.0,MZ],[.5,6.0,MZ],.02,P.ironL,{n:3});for(const x of [-.5,-.25,.25,.5])b.tube([x,5.88,MZ],[x,6.12,MZ],.014,P.ironL,{n:3});
  for(const s of [-1,1]){b.cable([0,MY+1.7,MZ],[s*1.28,1.92,-2.72],.5,.014,P.ironD,{n:3});b.cable([0,MY+1.5,MZ],[s*2.2,3.2,.3],.3,.014,P.ironD,{n:3});}}
 // ---- the show panels: stolen armour boards in a gold frame, the banners of conquered colonies hung on them ----
 for(const s of [-1,1])side(b,s,2.2,1.5,-1.1,q=>{cb(q,0,0,-.05,3.1,1.74,.1,P.ironD);
  plate(q,-s*.78,.04,1.48,1.66,s>0?P.plateMil:pick(S,sd+1),{t:.06,bolt:P.gold,stripe:s>0?P.flagLDF:P.flagLDF2,sy:.08,sh:.1});plate(q,s*.76,.04,1.5,1.5,s>0?pick(S,sd+2):P.plateMil,{t:.06,bolt:P.gold});
  cb(q,0,1.72,-.02,3.2,.1,.2,P.gold);if(hi)for(const x of [-1.56,0,1.56])cb(q,x,-.1,.0,.12,1.86,.12,P.gold);
  q.at(0,0,.075,0,f=>{flag(f,-s*.78,1.62,.92,1.26,s>0?1+sd%4:0,{sway:.04,ph:s});flag(f,s*.76,1.5,.8,1.0,s>0?3+sd%2:2,{sway:.04,ph:1+s,tail:.3});});});
 if(hi)for(const s of [-1,1])for(const z of [-2.3,.1]){b.tube([s*2.2,3.1,z],[s*(z<-1?1.1:1.3),2.9,z<-1?-1.9:-.1],.04,dk,{n:4});}
 // ---- the stern: stacks, vents, loot ----
 stern(b,0,.76,-2.81,q=>vent(q,0,0,1.9,.56,5,{low:1,frame:P.ironD}));
 for(const s of [-1,1])stack(b,[[s*.85,1.9,-2.5],[s*.9,2.5,-2.56],[s*1.0,3.0,-2.7]],.11,s>0?P.gold:tint(P.rust,1.15,.01));
 deck(b,0,1.9,-2.45,q=>vent(q,0,-.18,1.1,.36,3,{low:1,frame:P.ironD}));
 crate(b,1.8,1.65,1.55,.74,.44,.66,.1,{mark:P.gold});sack(b,-1.8,1.65,1.45,.28,.5,{rot:.7});
 if(hi){if(!o.cmd){crate(b,-1.78,1.65,2.1,.5,.34,.5,-.2,{m:pick(S,sd+3),mark:P.flagLDF2});sack(b,1.82,1.65,2.2,.22,.42,{rot:2});}crate(b,1.72,2.09,1.52,.42,.28,.4,.5,{lid:P.gold,strap:P.gold,m:P.crateD});}
 // red growth: out of the cupola's glass and down the tower, out of the stern vents
 if(hi){knot(b,.9,3.62,TZ+1.46,.13,sd);vein(b,[.9,3.6,TZ+1.48],[.5,2.3,TZ+1.3],[0,.15,1],{seed:sd+2,n:5,r:.045});vein(b,[-1.47,3.6,TZ+.2],[-1.2,2.2,TZ-.4],[-1,.15,0],{seed:sd+3,n:5,r:.04});vein(b,[.3,3.64,TZ-1.46],[.8,2.2,TZ-1.3],[0,.15,-1],{seed:sd+4,n:4,r:.04});
  vein(b,[.4,1.92,-2.3],[1.2,1.92,-2.0],[0,1,0],{seed:sd+5,n:3,r:.035});vein(b,[-.6,1.44,2.66],[-1.2,1.0,2.74],[0,.3,1],{seed:sd+6,n:3,r:.035});}
}
function commandGun(b,o){const sd=o.seed|0,hi=b.hi,n=hi?10:6,nb=hi?8:5,dk=tint(P.iron,1.25),y=.55,D=doc(o);
 b.cyl(0,0,0,.58,.14,P.ironD,{n,topMat:dk});if(hi)b.cyl(0,.1,0,.6,.06,P.gold,{n,top:false});
 for(const s of [-1,1])xpr(b,[[-.32,.14],[.32,.14],[.16,.68],[-.16,.68]],s*.34,s*.47,P.ironL);
 blk(b,0,.26,-.36,.6,.54,.5,D?D.paint:pick(P.plateSet,sd+2),{ch:.05,edge:D?P.gold:null});
 // the projector: a core in three gold coils, a looted horn, three emitter rods
 b.tube([0,y,-.12],[0,y,.92],.15,P.ironD,{n:nb});for(const z of [.1,.36,.62])b.tube([0,y,z],[0,y,z+.11],.27,P.gold,{n:nb,caps:true});
 b.tube([0,y,.84],[0,y,1.16],.2,P.plateMil,{n:nb,r2:.46});zdisc(b,0,y,1.1,.41,nb,P.ironD);
 for(let k=0;k<3;k++){const a=k/3*TAU+HP,c=Math.cos(a),s=Math.sin(a);b.quad([c*.08-s*.035,y+s*.08+c*.035,1.106],[c*.08+s*.035,y+s*.08-c*.035,1.106],[c*.36+s*.035,y+s*.36-c*.035,1.106],[c*.36-s*.035,y+s*.36+c*.035,1.106],P.red,[0,y,0]);
  b.tube([c*.43,y+s*.43,1.12],[c*.2,y+s*.2,1.46],.03,P.gold,{n:4});b.tube([c*.2,y+s*.2,1.44],[c*.17,y+s*.17,1.5],.035,P.redHot,{n:4,caps:true});}
 if(hi){b.tube([.2,.5,-.3],[.3,y+.1,.14],.035,tint(P.tankBand,1.15),{n:4});vein(b,[-.3,.8,-.36],[-.2,.72,.5],[0,1,0],{seed:sd+2,n:3,r:.025,amp:.05});}
}

// ------------------------------------------------------------------ par-swarm: the Grabber ------------------------------
// 1.7 x 1.4 x 2.4. A scavenger buggy, one of a pack: four fat tyres under a bare tub with a pod cab, and the two things it
// lives for: a pair of GRAB CLAWS a third of its length (stolen loader arms, still in their yellow, with steel pincers) and a
// LOOT SACK bigger than its cab roped on the back. No turret: the "gun" is a pintle stub on the cab roof.
const SWARM_PIVOT=[0,1.0,-.1];
// a flat steel bar between two points [x, z] (claw fingers, booms): w0 -> w1 wide, t thick, its underside at y (12 triangles)
function bar(b,a,c,w0,w1,y,t,m,o={}){const dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz)||1,nx=-dz/L*.5,nz=dx/L*.5,p=[[a[0]+nx*w0,a[1]+nz*w0],[c[0]+nx*w1,c[1]+nz*w1],[c[0]-nx*w1,c[1]-nz*w1],[a[0]-nx*w0,a[1]-nz*w0]],ins=[(a[0]+c[0])/2,y+t/2,(a[1]+c[1])/2],V=(i,yy)=>[p[i][0],yy,p[i][1]];
 for(let i=0;i<4;i++){const j=(i+1)%4;b.quad(V(i,y),V(j,y),V(j,y+t),V(i,y+t),m,ins);}
 b.quad(V(0,y+t),V(1,y+t),V(2,y+t),V(3,y+t),o.top||tint(m,1.3,.012),ins);if(o.bot!==0)b.quad(V(0,y),V(1,y),V(2,y),V(3,y),tint(m,.7),ins);return b;}
// one grab claw on the nose corner (s = side): a shoulder, a boom worked by a hydraulic ram, a gold knuckle, a pincer
function claw(b,s){const hi=b.hi,y=.45,t=.17,jaw=tint(P.iron,1.55,.012),tip=P.plateMil;
 cb(b,s*.29,.4,.42,.2,.3,.24,P.ironD);
 bar(b,[s*.29,.44],[s*.5,.82],.16,.14,y+.02,t-.02,P.hazard,{top:tint(P.hazard,1.2,.01)});
 if(hi){b.tube([s*.15,.6,.36],[s*.26,.63,.52],.045,P.ironD,{n:5});b.tube([s*.26,.63,.52],[s*.42,.64,.74],.026,P.ironL,{n:5});
  for(const k of [.3,.62])bar(b,[s*(.29+.21*k),.44+.38*k],[s*(.29+.21*(k+.12)),.44+.38*(k+.12)],.165,.165,y+.025,t-.02,P.hazardD,{bot:0});}
 b.cyl(s*.5,y-.03,.82,.115,t+.08,P.gold,{n:hi?7:5,bot:true});
 bar(b,[s*.5,.8],[s*.75,.99],.19,.16,y,t,jaw);bar(b,[s*.75,.94],[s*.6,1.18],.16,.05,y,t,tip);
 bar(b,[s*.47,.8],[s*.27,1.0],.17,.14,y,t,jaw);bar(b,[s*.27,.95],[s*.44,1.18],.14,.05,y,t,tip);
}
function swarmHull(b,o){const sd=o.seed|0,hi=b.hi,hull=P.ironL,dk=P.iron,pm=pick(P.plateSet,sd),pm2=pick(P.plateSet,sd+2),R=K.rect,wr=.3,nW=hi?9:6,WZ=[.2,-.72];
 // four fat tyres, hub caps that never matched
 for(const s of [-1,1])WZ.forEach((z,k)=>xwheel(b,s*.48,s*.76,wr,z,wr,nW,P.tyre,(k?s>0:s<0)?P.gold:P.rust,{hub:.56,face:hi?tint(P.tyre,1.9,.02):(k?s>0:s<0)?P.goldD:P.rust,rot:z}));
 for(const z of WZ)b.tube([-.5,wr,z],[.5,wr,z],.05,P.ironD,{n:4});
 // the tub: a stolen painted panel for a hood, a red-lit lamp in the nose
 xpr(b,[[-1.14,.34],[.38,.34],[.56,.46],[.54,.62],[.22,.76],[-1.14,.76]],-.4,.4,i=>i===0?P.ironD:i===3?pm:i===2?tint(hull,1.25,.01):i===5?dk:hull,{cap:tint(hull,.82)});
 b.quad([-.11,.5,.566],[.11,.5,.566],[.11,.585,.556],[-.11,.585,.556],P.red,[0,.5,0]);
 if(hi){cb(b,0,.47,.5,.3,.15,.08,P.ironD);trim(b,[-.4,.77,.2],[-.4,.77,-1.12],.022);trim(b,[.4,.77,.2],[.4,.77,-1.12],.022);}
 // fenders: hazard sheet over the right front wheel, the left one torn off; loot shelves over the rear wheels
 blk(b,.63,.62,.2,.3,.045,.7,P.hazard,{ch:.02});blk(b,.63,.62,-.72,.3,.045,.7,pm2,{ch:.02});blk(b,-.63,.62,-.72,.3,.045,.7,P.scrap,{ch:.02});
 // the pod cab: dead glass, the red glow behind it; a bare roll hoop over it
 b.loft([{p:R(.74,.62,0,0,-.1),y:.76},{p:R(.6,.5,0,0,-.1),y:1.0}],(r,i)=>i===1||i===3?dk:hull,{topMat:P.ironD});
 b.at(0,.775,.215,0,q=>deadGlass(q,0,0,.6,.19,{seed:sd+1,cracks:2,gh:.04}),-.245);
 for(const s of [-1,1]){const n=hi?4:3;b.tube([s*.4,.76,.24],[s*.36,1.1,-.02],.03,dk,{n});b.tube([s*.36,1.1,-.02],[s*.36,1.1,-.3],.03,dk,{n});if(hi)b.tube([s*.36,1.1,-.3],[s*.4,.76,-.42],.03,dk,{n});}
 if(hi)b.tube([-.36,1.1,-.02],[.36,1.1,-.02],.03,dk,{n:4});
 vein(b,[.12,.78,.2],[.3,.6,.53],[0,1,.4],{seed:sd+3,n:3,r:.022,amp:.05,low:1});if(hi)vein(b,[-.2,.8,.2],[-.36,.72,.34],[0,1,.4],{seed:sd+4,n:2,r:.018,amp:.03});
 // the claws
 for(const s of [-1,1])claw(b,s);
 // the loot sack: bigger than the cab, roped down in a rack; more loot on the shelves
 sack(b,0,.76,-.74,.43,.63,{rot:.4+sd,lz:.05,lx:sd%2?.04:-.04});
 if(hi){net(b,0,.76,-.74,.92,.56,.84,3);for(const s of [-1,1]){b.tube([s*.4,.76,-1.12],[s*.4,1.04,-1.14],.022,dk,{n:3});b.tube([s*.4,.76,-.38],[s*.4,1.0,-.36],.022,dk,{n:3});b.tube([s*.4,1.0,-.36],[s*.4,1.04,-1.14],.02,dk,{n:3});}b.tube([-.4,1.04,-1.14],[.4,1.04,-1.14],.022,dk,{n:3});}
 crate(b,-.63,.665,-.74,.26,.22,.34,.1,{m:sd%2?P.crate:pick(P.plateSet,sd+1),mark:P.flagLDF2,strap:0});
 if(hi)sack(b,.64,.665,-.76,.13,.26,{rot:1});
 // the engine under the sack: a stern grille glowing red, one stack
 stern(b,0,.42,-1.135,q=>vent(q,0,0,.62,.26,3,{low:1,frame:P.ironD,f:.03}));
 stack(b,[[.33,.76,-.34],[.44,1.02,-.38],[.48,1.3,-.44]],.05,tint(P.rust,1.15,.01));
}
function swarmGun(b,o){const hi=b.hi;b.cyl(0,0,0,.13,.05,P.ironD,{n:hi?8:5,topMat:P.gold});cb(b,0,.05,.02,.17,.1,.2,pick(P.plateSet,(o.seed|0)+3));
 for(const s of [-1,1]){b.tube([s*.045,.1,.08],[s*.045,.1,.4],.024,P.ironD,{n:hi?5:3});if(hi)b.tube([s*.045,.1,.36],[s*.045,.1,.42],.034,P.gold,{n:5,caps:true});}
 if(hi)b.quad([-.03,.156,-.04],[.03,.156,-.04],[.03,.156,.06],[-.03,.156,.06],P.red,[0,0,0]);
}
function swarmTown(b,o){const sd=o.seed|0,R=K.rect,jaw=tint(P.iron,1.55,.012),up=[0,-9,0];
 for(const s of [-1,1])for(const z of [.2,-.72])xwheel(b,s*.48,s*.77,.3,z,.3,4,P.tyre,null,{face:s>0===(z>0)?P.rust:P.goldD,rot:PI/4});
 xpr(b,[[-1.14,.34],[.4,.34],[.56,.6],[.22,.76],[-1.14,.76]],-.4,.4,i=>i===0?null:i===2?pick(P.plateSet,sd):P.ironL,{cap:tint(P.ironL,.82)});
 b.loft([{p:R(.74,.62,0,0,-.1),y:.76},{p:R(.58,.4,0,0,-.14),y:1.0}],(r,i)=>i===2?P.glassDead:P.ironL,{topMat:P.ironD});b.quad([-.35,.77,.225],[.35,.77,.225],[.32,.87,.165],[-.32,.87,.165],P.red,[0,.8,-1]);
 b.loft([{p:K.circ(.36,4,0,-.74,.36,.4),y:.76},{p:K.circ(.45,4,0,-.74,.45,.4),y:.98},{p:K.circ(.16,4,0,-.7,.16,.4),y:1.4}],r=>r?P.sack:tint(P.sack,1.12),{topMat:P.strap});
 b.quad([-.31,.42,-1.15],[.31,.42,-1.15],[.31,.7,-1.15],[-.31,.7,-1.15],P.red,[0,.5,0]);
 for(const s of [-1,1]){const Q=(a,c,w0,w1,m)=>{const dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L*.62,nz=dx/L*.62,A=[a[0],.66,a[1]],C=[c[0],.66,c[1]],ins=[(a[0]+c[0])/2,0,(a[1]+c[1])/2];
   b.quad([a[0]+nx*w0,.46,a[1]+nz*w0],[c[0]+nx*w1,.46,c[1]+nz*w1],C,A,m,ins).quad([a[0]-nx*w0,.46,a[1]-nz*w0],[c[0]-nx*w1,.46,c[1]-nz*w1],C,A,tint(m,.8),ins);};
  Q([s*.29,.4],[s*.5,.82],.2,.18,P.hazard);Q([s*.5,.78],[s*.76,.99],.18,.15,jaw);Q([s*.76,.95],[s*.6,1.2],.15,.05,P.plateMil);Q([s*.47,.78],[s*.28,1.0],.16,.13,jaw);Q([s*.28,.96],[s*.45,1.2],.13,.05,P.plateMil);}
}

// ------------------------------------------------------------------ par-brute: the Wrecker ------------------------------
// 5.4 x 4.6 x 8. A long, low siege hull behind the thing it is named for: a HUGE BATTERING RAM welded from wreckage that
// fills the front third and is wider than the tank. A rust beam as thick as a doorway runs out of the glacis to a hammer
// head in hazard paint; either side of it a swept wing of three wreck slabs (looted LDF ceramic, a settler's panel, hazard
// sheet, rust: none the same height) over a cutting edge, held by girders. Seen from behind and above it is an arrowhead.
// The turning part is a squat demolition mortar on the casemate.
const BRUTE_PIVOT=[0,2.6,-2.15];
function bruteHull(b,o){const sd=o.seed|0,hi=b.hi,hull=P.ironL,dk=tint(P.iron,1.25),S=P.plateSet,R=K.rect,CZ=-2.15;
 const W=[[-3.0,.5,.47],[-2.0,.5,.47],[-1.0,.5,.47],[0,.5,.47],[.74,.94,.3],[-3.45,.9,.3]];
 for(const s of [-1,1])track(b,s,1.78,.96,-3.9,1.3,1.4,{cf:.7,hf:.78,cr:.55,hr:.66,wheels:W,wt:.05,lowSkip:[4,5],hub:s>0?P.rust:P.gold});
 cb(b,0,.36,-1.35,2.7,.55,4.9,P.ironD);
 xpr(b,[[-3.88,.7],[.8,.65],[1.32,1.0],[1.28,1.5],[.7,2.05],[-3.88,2.05]],-1.32,1.32,i=>i===0?null:i===3?tint(hull,1.1):i===2?tint(hull,1.25,.01):i===4?dk:hull,{cap:tint(hull,.8)});
 blk(b,1.78,1.42,-1.33,.98,.42,5.1,P.plateMilD,{ch:.05});blk(b,-1.78,1.42,-1.33,.98,.42,5.1,pick(S,sd+1),{ch:.05});
 // three looted skirt plates a side, none alike
 const SK=[[-3.1,1.44,.8],[-1.62,1.4,.7],[-.1,1.5,.86]],MR=[[P.rust,{}],[P.plateMil,{stripe:P.flagLDF}],[P.hazard,{haz:7}]],ML=[[P.hazard,{haz:7}],[pick(S,sd+3),{stripe:P.flagLDF2,sy:.66,sh:.12}],[P.plateMil,{stripe:P.flagLDF,sy:.25}]];
 for(const s of [-1,1])SK.forEach(([z,w,y0],k)=>{const [m,po]=(s>0?MR:ML)[k];side(b,s,2.265,y0,z,q=>plate(q,0,0,w,1.8-y0,m,Object.assign({t:.05},po)));});
 // the casemate: looted panels welded over its corners, the driver's dead glass, vents glowing red on both flanks
 const CM=[pick(S,sd+2),P.plateMil,pick(S,sd+4),P.hazard];
 b.loft([{p:R(2.5,2.9,.42,0,CZ),y:2.05},{p:R(2.2,2.5,.36,0,CZ),y:2.6}],(r,i)=>i%2?CM[(i-1)/2]:(i===0||i===4?hull:tint(hull,.9)),{topMat:dk});
 b.at(0,2.2,CZ+1.4,0,q=>deadGlass(q,0,0,1.2,.28,{seed:sd+1,cracks:3}),-.35);
 for(const s of [-1,1])b.at(s*1.23,2.14,CZ,s*HP,q=>vent(q,0,0,1.5,.36,3,{low:1,frame:P.ironD}),-.266);
 if(hi){b.loft([{p:R(2.56,2.96,.44,0,CZ),y:2.03},{p:R(2.56,2.96,.44,0,CZ),y:2.11}],P.gold,{top:false});vein(b,[.3,2.3,CZ+1.4],[.9,2.07,-.3],[0,1,.3],{seed:sd+2,n:4,r:.04});vein(b,[-.5,2.3,CZ+1.4],[-1.1,2.07,-.5],[0,1,.3],{seed:sd+3,n:3,r:.035});}
 // the stern: a louvred grille glowing red, two fat stacks, a stolen flag draped over the plate
 stern(b,0,.8,-3.89,q=>vent(q,0,0,2.0,.6,5,{low:1,frame:P.ironD}));stern(b,0,2.04,-3.9,q=>flag(q,0,0,1.7,.6,sd%2?0:3,{tail:.3,sway:.03}));
 for(const s of [-1,1])stack(b,[[s*1.02,2.05,-3.46],[s*1.06,3.3,-3.52],[s*1.14,4.0,-3.66]],.15,s>0?P.gold:tint(P.rust,1.15,.01));
 // loot on the sponsons: crates under a net at the stern, fuel drums, sacks
 for(const s of [-1,1]){crate(b,s*1.78,1.84,-3.3,.82,.5,.9,s*.06,{m:s>0?P.crate:pick(S,sd+3),mark:s>0?P.gold:P.flagLDF2});if(hi){crate(b,s*1.74,2.34,-3.32,.5,.32,.52,.4,{strap:0});net(b,s*1.78,1.84,-3.3,.88,.84,.96,3);}}
 for(let k=0;k<2;k++){b.cyl(1.78,1.84,-2.2+k*.52,.23,.62,k?P.hazard:P.rust,{n:hi?8:5,topMat:P.ironD});if(hi)b.cyl(1.78,2.1,-2.2+k*.52,.24,.08,P.ironD,{n:8,top:false});}
 sack(b,-1.76,1.84,-2.1,.3,.52,{rot:.5,lz:-.05});if(hi){sack(b,-1.8,1.84,-1.5,.24,.44,{rot:2});crate(b,1.78,1.84,-1.0,.6,.36,.56,-.15,{m:pick(S,sd),mark:P.hazard});}
 // ---- THE RAM ----
 // the beam out of the glacis (gold collars, a hazard band), the hydraulic rams that brace it
 ab(b,0,.85,2.05,1.04,1.0,2.7,P.rust,.1);
 for(const z of [1.5,2.9])cb(b,0,.81,z,1.14,1.08,.2,P.gold);cb(b,0,.83,2.2,1.1,1.04,.56,P.hazard);
 if(hi)for(const s of [-1,1])for(let k=0;k<3;k++){const z=1.97+k*.2;b.quad([s*.556,.86,z],[s*.556,.86,z+.1],[s*.556,1.84,z+.22],[s*.556,1.84,z+.12],P.hazardD,[0,1.3,z]);}
 for(const s of [-1,1]){b.tube([s*.62,2.25,CZ+1.42],[s*.5,2.0,1.0],.11,P.ironD,{n:hi?6:4});b.tube([s*.5,2.0,1.0],[s*.42,1.86,2.3],.06,P.gold,{n:hi?6:4});if(hi)b.tube([s*.5,2.0,.9],[s*.5,2.0,1.06],.14,P.ironL,{n:6,caps:true});}
 // the hammer head in hazard paint, a red seam where the infection has got into the weld
 xpr(b,[[3.36,.35],[3.74,.35],[3.94,.8],[3.94,2.05],[3.74,2.5],[3.36,2.5]],-1.0,1.0,i=>i===2?P.ironD:i===1||i===3?tint(P.iron,1.7,.014):i===4?tint(dk,1.15):i===0?P.ironD:dk,{cap:P.iron});
 b.at(0,.84,3.94,0,q=>plate(q,0,0,1.84,1.18,P.hazard,{haz:7,t:.05,bolts:0}));
 cb(b,0,.78,3.31,1.16,1.14,.07,P.red);
 if(hi){for(const s of [-1,1])for(const y of [.56,2.2])b.at(s*.76,y,3.82,0,q=>cb(q,0,0,0,.16,.16,.1,P.gold));vein(b,[.2,2.51,3.5],[.56,1.86,2.6],[0,1,0],{seed:sd+5,n:4,r:.04});vein(b,[-.3,2.51,3.6],[-1.02,1.5,3.5],[-1,.4,0],{seed:sd+6,n:3,r:.035});knot(b,.1,2.5,3.46,.13,sd);}
 // the wings: three wreck slabs a side over a cutting edge, girders across the back, posts above the plates
 for(const s of [-1,1])b.at(s*.66,0,3.3,s*.55,q=>{const X=t=>s*t,PA=s>0?[P.plateMil,P.hazard,pick(S,sd)]:[pick(S,sd+3),P.rust,P.plateMil];
  ab(q,X(.42),.34,-.14,.9,3.46,.28,PA[0],.07);ab(q,X(1.1),.34,-.02,.86,2.56,.24,PA[1],.06);ab(q,X(1.8),.34,-.14,.96,2.96,.28,PA[2],.07);
  plate(q,X(.42),1.0,.72,2.6,PA[0],{t:.04,bolt:P.gold,stripe:s>0?P.flagLDF:P.flagLDF2,sy:s>0?.62:.2,sh:.12});
  q.at(0,0,.1,0,f=>plate(f,X(1.1),.8,.7,1.9,PA[1],{t:.04,haz:s>0?5:0}));
  plate(q,X(1.8),.9,.78,2.2,PA[2],{t:.04,stripe:s>0?null:P.flagLDF,sy:.5,sh:.16});
  cb(q,X(1.05),.14,.13,2.1,.34,.3,P.ironD);q.at(0,0,.28,0,f=>plate(f,X(1.05),.16,2.04,.28,P.hazard,{haz:9,t:.03,bolts:0}));
  girder(q,[X(-.1),1.75,-.4],[X(2.1),1.75,-.4],.12);
  const pn=hi?4:3;q.tube([X(.5),.4,-.42],[X(.5),4.4,-.42],.085,P.rust,{n:pn});q.tube([X(1.56),.4,-.42],[X(1.56),3.7,-.42],.085,P.ironD,{n:pn});
  if(hi){girder(q,[X(.1),2.9,-.4],[X(1.9),2.9,-.4],.1,P.ironD);q.tube([X(.5),4.4,-.42],[X(.5),4.46,-.42],.12,P.gold,{n:4,caps:true});
   q.at(X(.42),3.7,-.3,PI,f=>flag(f,0,0,.72,1.0,s>0?1+sd%4:0,{sway:.04,ph:s}));
   vein(q,[X(.14),3.3,.05],[X(.6),1.3,.05],[0,0,1],{seed:sd+8+s,n:5,r:.04});vein(q,[X(1.6),3.0,.05],[X(2.0),1.6,.05],[0,0,1],{seed:sd+11+s,n:4,r:.035});}
  else vein(q,[X(.2),3.3,.02],[X(.6),1.3,.02],[0,0,1],{low:1,r:.05});});
 // the push frame: girders from the hull to the back of the wings
 for(const s of [-1,1]){girder(b,[s*1.05,1.95,.5],[s*1.5,2.6,2.5],.13);girder(b,[s*1.5,1.0,1.25],[s*2.0,.9,2.2],.12,P.ironD);}
}
function bruteGun(b,o){const sd=o.seed|0,hi=b.hi,R=K.rect,S=P.plateSet,tm=tint(P.iron,1.6,.012),dk=tint(P.iron,1.2),n=hi?10:6,nb=hi?10:6,y=.46;
 b.cyl(0,0,0,.95,.16,P.ironD,{n,top:false});b.loft([{p:K.circ(.98,n),y:.04},{p:K.circ(.98,n),y:.12}],P.red,{top:false,smooth:true});
 const CM=[pick(S,sd+2),P.plateMil,P.hazard,pick(S,sd)];
 b.loft([{p:R(1.84,1.94,.4),y:.16},{p:R(2.06,2.16,.44),y:.46},{p:R(1.6,1.7,.36),y:.76}],(r,i)=>r===1?(i%2?tint(tm,1.2,.01):tm):(i%2?CM[(i-1)/2]:tm),{topMat:dk});
 b.loft([{p:R(2.1,2.2,.45),y:.4},{p:R(2.1,2.2,.45),y:.51}],P.gold,{top:false});
 // the demolition mortar: a short fat barrel in a gold-framed mantlet
 ab(b,0,.18,.98,1.14,.56,.32,P.ironD,.06);
 b.tube([0,y,1.1],[0,y,1.72],.33,P.ironD,{n:nb});b.tube([0,y,1.66],[0,y,1.94],.42,P.gold,{n:nb,caps:true});zdisc(b,0,y,1.946,.27,nb,P.weld);
 if(hi){b.tube([0,y,1.2],[0,y,1.3],.36,P.gold,{n:nb,caps:true});b.tube([0,y,1.42],[0,y,1.54],.345,P.hazard,{n:nb});cb(b,0,.74,1.11,1.18,.07,.06,P.gold);cb(b,0,.14,1.11,1.18,.07,.06,P.gold);}
 // a hatch with a dead periscope, loot on the roof
 b.cyl(-.38,.76,-.2,.3,.1,P.ironD,{n:hi?8:5,topMat:P.gold});cb(b,-.38,.86,.0,.2,.12,.12,P.ironD);b.quad([-.46,.89,.062],[-.3,.89,.062],[-.3,.96,.062],[-.46,.96,.062],P.red,[-.38,.9,0]);
 crate(b,.36,.76,-.3,.6,.26,.56,.2,{mark:P.flagLDF2});if(hi){sack(b,.3,.76,.34,.2,.32,{rot:1});vein(b,[-.1,.78,.5],[-.7,.56,.84],[0,1,.4],{seed:sd+2,n:3,r:.03});vein(b,[.5,.3,1.0],[.8,.6,.94],[0,0,1],{seed:sd+3,n:3,r:.03});}
}
function bruteTown(b,o){const sd=o.seed|0,S=P.plateSet,R=K.rect,CZ=-2.15,tm=tint(P.iron,1.6,.012);
 for(const s of [-1,1])track(b,s,1.78,.96,-3.9,1.3,1.4,{cf:.7,hf:.78,cr:.55,hr:.66,lod:0});
 xpr(b,[[-3.88,.7],[.8,.65],[1.32,1.0],[.7,2.05],[-3.88,2.05]],-1.32,1.32,i=>i===0?null:P.ironL,{cap:tint(P.ironL,.8)});
 cb(b,1.78,1.42,-1.33,.98,.42,5.1,P.plateMilD);cb(b,-1.78,1.42,-1.33,.98,.42,5.1,pick(S,sd+1));
 b.loft([{p:R(2.5,2.9,0,0,CZ),y:2.05},{p:R(2.2,2.5,0,0,CZ),y:2.6}],(r,i)=>i===1?P.hazard:i===3?pick(S,sd+2):P.ironL,{topMat:P.iron});
 b.quad([-1.0,.8,-3.9],[1.0,.8,-3.9],[1.0,1.4,-3.9],[-1.0,1.4,-3.9],P.red,[0,1,0]);
 b.at(0,2.6,CZ,0,q=>{q.loft([{p:R(2.06,2.16,.44),y:.2},{p:R(1.6,1.7,.36),y:.76}],(r,i)=>i%2?(i===3?P.plateMil:i===5?P.hazard:pick(S,sd)):tm,{topMat:P.iron});
  q.loft([{p:R(2.12,2.22,.45),y:.02},{p:R(2.12,2.22,.45),y:.2}],P.red,{top:false});
  q.tube([0,.46,1.0],[0,.46,1.72],.33,P.ironD,{n:5});q.tube([0,.46,1.66],[0,.46,1.94],.44,P.gold,{n:5,caps:true});});
 cb(b,0,.85,2.05,1.04,1.0,2.7,P.rust);cb(b,0,.83,2.2,1.1,1.04,.56,P.hazard);cb(b,0,.35,3.66,2.0,2.15,.56,P.ironD);
 b.quad([-.92,.6,3.95],[.92,.6,3.95],[.92,2.25,3.95],[-.92,2.25,3.95],P.hazard,[0,1,0]);cb(b,0,.78,3.31,1.2,1.16,.08,P.red);
 for(const s of [-1,1]){b.at(s*.66,0,3.3,s*.55,q=>{const X=t=>s*t,PA=s>0?[P.plateMil,P.hazard,pick(S,sd)]:[pick(S,sd+3),P.rust,P.plateMil];
   cb(q,X(.42),.2,-.14,.9,3.6,.28,PA[0]);cb(q,X(1.1),.2,-.02,.86,2.7,.24,PA[1]);cb(q,X(1.8),.2,-.14,.96,3.1,.28,PA[2]);
   q.quad([X(.08),2.4,.01],[X(.76),2.4,.01],[X(.76),2.84,.01],[X(.08),2.84,.01],s>0?P.flagLDF:P.flagLDF2,[0,2,-1]);});
  b.tube([s*1.05,1.95,.5],[s*1.5,2.6,2.5],.14,P.rust,{n:3});b.tube([s*1.02,2.05,-3.46],[s*1.12,4.0,-3.62],.17,s>0?P.gold:P.rust,{n:3});
  cb(b,s*1.78,1.84,-3.3,.82,.6,.9,s>0?P.crate:pick(S,sd+3));}
}

// ------------------------------------------------------------------ par-drone: the stolen drone --------------------------
// 2.8 x 1.2 x 3 (it flies: y 0 .. 1.2). A human quad-rotor that used to belong to somebody else: a pale LDF ceramic fuselage
// with the colony's blue band still on it, patched with a settler's panel and hazard sheet, a dead sensor canopy with the red
// of the infection along its sill, four rotors whose guards never matched (one gaudy gold, one hazard, one pale, one torn
// off), a looted crate slung under the belly in a net. The turning part is a twin gun under the chin.
const DRONE_PIVOT=[0,.42,.66];
const ring8=(w,h,ch,yc,z)=>{const x=w/2,y=h/2,c=Math.min(ch,x*.9,y*.9);return [[-x+c,yc-y,z],[x-c,yc-y,z],[x,yc-y+c,z],[x,yc+y-c,z],[x-c,yc+y,z],[-x+c,yc+y,z],[-x,yc+y-c,z],[-x,yc-y+c,z]];};
// a rotor guard: a short open duct (outside, inside and both rims), n sides
function duct(b,x,y,z,r,h,m,o={}){const n=o.n||(b.hi?10:6),ri=r-(o.w||.05),mi=tint(m,.55),rim=tint(m,1.3,.012);for(let i=0;i<n;i++){const a0=i/n*TAU,a1=(i+1)/n*TAU,c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1),mx=x+(c0+c1)*r,mz=z+(s0+s1)*r,
   A=[x+c0*r,y,z+s0*r],B=[x+c1*r,y,z+s1*r],C=[x+c1*r,y+h,z+s1*r],D=[x+c0*r,y+h,z+s0*r],E=[x+c0*ri,y,z+s0*ri],F=[x+c1*ri,y,z+s1*ri],G=[x+c1*ri,y+h,z+s1*ri],H=[x+c0*ri,y+h,z+s0*ri];
  b.quad(A,B,C,D,m,[x,y+h/2,z]).quad(E,F,G,H,mi,[mx,y+h/2,mz]).quad(D,C,G,H,rim,[x,y-9,z]);if(b.hi)b.quad(A,B,F,E,mi,[x,y+9,z]);}return b;}
// rotor blades: flat bars through the hub at height y (drawn on both faces)
function rotor(b,x,y,z,r,a,m,n=2){for(let k=0;k<n;k++){const an=a+k*PI/n,c=Math.cos(an),s=Math.sin(an),w=.045,V=(t,u)=>[x+c*t-s*u,y,z+s*t+c*u],Q=[V(-r,-w),V(r,-w*.6),V(r,w*.6),V(-r,w)];b.quad(Q[0],Q[1],Q[2],Q[3],m,[x,y-9,z]).quad(Q[0],Q[1],Q[2],Q[3],tint(m,.7),[x,y+9,z]);}return b;}
function droneHull(b,o){const sd=o.seed|0,hi=b.hi,pale=P.plateMil,dk=P.iron,pm=pick(P.plateSet,sd),pm2=pick(P.plateSet,sd+2);
 // the fuselage: looted ceramic over a dark belly, a settler's panel for a left flank, the nose a dead sensor canopy
 const RG=[ring8(.36,.2,.06,.66,-.96),ring8(.66,.42,.1,.65,-.7),ring8(.74,.46,.11,.63,.32),ring8(.6,.36,.1,.6,.68),ring8(.58,.34,.1,.6,.74),ring8(.3,.16,.05,.54,1.0)];
 skin(b,RG,(r,i)=>{if(i===0||i===1||i===7)return r===4?tint(P.ironD,1.3):P.ironD;if(r===0)return i===4?tint(dk,1.2):dk;if(r===3)return i>=3&&i<=5?P.red:P.ironD;if(r===4)return P.glassDead;
   if(r===1)return i===4?pale:i===3||i===5?tint(pale,1.25,.012):i===2?pale:pm;return i===4?P.hazard:i===3||i===5?tint(pale,1.2,.01):i===2?pm2:pale;},[0,.63,0]);
 fan(b,RG[0],P.ironD,[0,.66,0]);fan(b,RG[5],P.ironD,[0,.54,0]);
 stern(b,0,.595,-.965,q=>vent(q,0,0,.24,.13,2,{low:1,f:0}));
 side(b,1,.372,.5,-.16,q=>plate(q,0,0,.62,.28,pale,{stripe:P.flagLDF,sy:.3,sh:.4,t:.025,bolts:0}));
 if(hi){side(b,-1,.372,.5,-.3,q=>plate(q,0,0,.36,.26,P.rust,{t:.025}));deck(b,0,.862,-.2,q=>plate(q,.13,-.22,.3,.44,P.rust,{t:.025}));
  for(const s of [-1,1])trim(b,[s*.235,.865,-.68],[s*.265,.865,.3],.018);
  for(let k=0;k<3;k++)b.quad([-.2,.866,.02+k*.09],[.02,.866,.02+k*.09],[.06,.866,.06+k*.09],[-.16,.866,.06+k*.09],P.hazardD,[0,0,0]);}
 // four arms (one replaced with a rust girder), motors, rotors, the guards that never matched
 const RT=[[1,1,P.gold],[-1,1,pm],[1,-1,null],[-1,-1,tint(pale,1.2,.02)]];
 for(const [sx,sz,gm] of RT){const hx=sx*.94,hz2=sz*.98,ax=sx*.3,az=sz>0?.24:-.52;
  if(!gm)girder(b,[ax,.68,az],[hx,.68,hz2],.055,P.rust);else b.tube([ax,.68,az],[hx,.68,hz2],.055,dk,{n:hi?5:3});
  b.cyl(hx,.54,hz2,.1,.34,P.ironD,{n:hi?7:5,bot:true,topMat:P.gold});
  rotor(b,hx,.865,hz2,.39,.5+sx+sz*.3,P.ironL,hi?2:1);
  if(gm)duct(b,hx,.73,hz2,.44,.17,gm);else if(hi){b.tube([hx,.7,hz2],[hx+.3,.72,hz2-.26],.025,P.rust,{n:3});b.tube([hx+.3,.72,hz2-.26],[hx+.36,.86,hz2-.2],.025,P.rust,{n:3});b.tube([hx,.7,hz2],[hx-.1,.72,hz2-.4],.025,P.rust,{n:3});}}
 // the loot: a crate slung under the belly in a net, a sack at the tail
 crate(b,0,.09,-.12,.52,.31,.46,.2,{mark:P.flagLDF2,m:sd%2?pick(P.plateSet,sd+1):P.crate});
 if(hi){net(b,0,.09,-.12,.62,.36,.56,3);for(const [x,z] of [[-.3,.14],[.3,.14],[-.3,-.38],[.3,-.38]])b.tube([x*.8,.38,z],[x,.5,z],.016,P.strap,{n:3});sack(b,.04,.14,-.62,.14,.3,{rot:1});}
 // a whip aerial with a stolen pennant; the infection along the canopy sill and down the flanks
 pole(b,[-.16,.86,-.56],[-.22,1.18,-.72],.014,dk,0);b.at(-.21,1.14,-.7,PI+.3,q=>{const m=pick(P.flagSet,sd+1);for(const z of [-9,9])q.tri([0,0,0],[.3,-.06,0],[0,-.15,0],m,[0,0,z]);});
 if(hi){knot(b,.06,.845,.6,.07,sd);vein(b,[.08,.87,.64],[-.1,.87,-.14],[0,1,0],{seed:sd+2,n:4,r:.02,amp:.06,shoot:.6});vein(b,[.22,.86,.62],[.385,.66,.16],[1,.7,0],{seed:sd+3,n:3,r:.018,amp:.04,shoot:.5});vein(b,[-.2,.86,-.5],[-.345,.66,-.74],[-1,.7,0],{seed:sd+4,n:3,r:.018,amp:.04,shoot:.5});}
 else vein(b,[.08,.87,.64],[-.1,.87,-.14],[0,1,0],{low:1,r:.026});
}
function droneGun(b,o){const hi=b.hi;b.cyl(0,-.1,0,.1,.1,P.ironD,{n:hi?7:5,bot:true,top:false});cb(b,0,-.18,.04,.17,.09,.22,pick(P.plateSet,(o.seed|0)+1),{bot:1});
 for(const s of [-1,1]){b.tube([s*.05,-.12,.1],[s*.05,-.12,.46],.022,P.ironD,{n:hi?5:3});if(hi)b.tube([s*.05,-.12,.42],[s*.05,-.12,.475],.032,P.gold,{n:5,caps:true});}
 if(hi)b.quad([-.03,-.13,.152],[.03,-.13,.152],[.03,-.17,.152],[-.03,-.17,.152],P.red,[0,-.15,0]);
}
function droneTown(b,o){const sd=o.seed|0,pale=P.plateMil,pf=[[-.96,.5],[.74,.42],[1.0,.52],[.72,.84],[-.7,.86],[-.96,.72]];
 xpr(b,pf,-.37,.37,i=>i===0?P.ironD:i===1?P.iron:i===2?P.glassDead:i===3?pale:i===4?P.iron:P.red,{capA:false,capB:false});
 fan(b,pf.map(p=>[-.37,p[1],p[0]]),pick(P.plateSet,sd),[0,.64,0]);fan(b,pf.map(p=>[.37,p[1],p[0]]),pale,[0,.64,0]);
 b.quad([-.3,.846,.5],[.3,.846,.5],[.3,.846,.68],[-.3,.846,.68],P.red,[0,0,0]);b.quad([-.3,.868,-.5],[.3,.868,-.5],[.3,.865,-.2],[-.3,.865,-.2],P.hazard,[0,0,0]);
 const H=(x,y,z,r,rot)=>Array.from({length:6},(_,i)=>{const a=i/6*TAU+rot;return [x+Math.cos(a)*r,y,z+Math.sin(a)*r];});
 for(const [sx,sz,gm] of [[1,1,P.gold],[-1,1,pick(P.plateSet,sd)],[1,-1,P.rust],[-1,-1,tint(pale,1.2,.02)]]){const hx=sx*.94,hz2=sz*.98;b.tube([sx*.3,.66,sz>0?.24:-.52],[hx,.7,hz2],.07,P.iron,{n:3});
  fan(b,H(hx,.86,hz2,.46,.3),gm,[hx,-9,hz2]);fan(b,H(hx,.875,hz2,.35,.3),tint(P.ironD,1.5,.01),[hx,-9,hz2]);fan(b,H(hx,.8,hz2,.46,.3),P.ironD,[hx,9,hz2]);
  const a=.5+sx+sz*.3,c=Math.cos(a)*.33,s=Math.sin(a)*.33,u=.05;b.quad([hx-c+s*u,.89,hz2-s-c*u],[hx+c+s*u,.89,hz2+s-c*u],[hx+c-s*u,.89,hz2+s+c*u],[hx-c-s*u,.89,hz2-s+c*u],P.plateMil,[hx,-9,hz2]);}
 cb(b,0,.09,-.12,.52,.33,.46,P.crate,{bot:1});
}

// ------------------------------------------------------------------ the town models -------------------------------------
// One piece, big shapes, two or three glow accents, the same on HIGH and LOW: the town raid draws them instanced (up to 80
// raiders, 48 sentinels, 40 drones, 160 Grabbers and 16 Wreckers at once). Each is drawn at its world proportions and then
// fitted to the footprint the town raid has always used (TOWN: width, height, length in metres; the drone is centred on
// y = 0 because the town view lifts it), so it does NOT have to fit the world slot box.
const TOWN={raider:[3.4,2.9,4.4],sentinel:[5.2,4.6,6.8],swarm:[1.6,1.1,2.2],brute:[6.8,5.4,7.6],drone:[3.4,1,2.6]};
function fit(b,size,centred){const [w,h,d]=size,lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const B of [b.buf.main,b.buf.det])for(let i=0;i<B.P.length;i+=3)for(let k=0;k<3;k++){const v=B.P[i+k];if(v<lo[k])lo[k]=v;if(v>hi[k])hi[k]=v;}
 const sx=w/2/Math.max(-lo[0],hi[0]),sy=h/(hi[1]-lo[1]),sz=d/2/Math.max(-lo[2],hi[2]),y0=centred?-h/2:0;
 for(const B of [b.buf.main,b.buf.det])for(let i=0;i<B.P.length;i+=3){B.P[i]*=sx;B.P[i+1]=(B.P[i+1]-lo[1])*sy+y0;B.P[i+2]*=sz;const nx=B.N[i]/sx,ny=B.N[i+1]/sy,nz=B.N[i+2]/sz,l=Math.hypot(nx,ny,nz)||1;B.N[i]=nx/l;B.N[i+1]=ny/l;B.N[i+2]=nz/l;}}
function sentinelTown(b,o){const sd=o.seed|0,S=P.plateSet,R=K.rect,tm=tint(P.iron,1.6,.012),dk=tint(P.iron,1.2);
 for(const s of [-1,1])track(b,s,1.82,1.0,-2.8,2.72,1.3,{cf:.7,hf:.72,cr:.55,hr:.62,lod:0});
 xpr(b,[[-2.8,.65],[2.3,.6],[2.82,1.0],[1.95,2.0],[-2.8,2.0]],-1.34,1.34,i=>i===0?null:P.ironL,{cap:tint(P.ironL,.8)});
 cb(b,1.83,1.3,-.05,1.0,.45,5.45,pick(S,sd+1));cb(b,-1.83,1.3,-.05,1.0,.45,5.45,P.plateMilD);
 const SM=[P.plateMil,P.hazard,pick(S,sd),P.rust,pick(S,sd+2)];
 for(const s of [-1,1])for(let k=0;k<3;k++){const z0=-2.62+k*1.78;b.quad([s*2.34,.72-k%2*.1,z0],[s*2.34,.72-k%2*.1,z0+1.66],[s*2.34,1.72,z0+1.66],[s*2.34,1.72,z0],SM[(k+(s>0?0:2))%5],[0,1,0]);}
 b.quad([-1.2,1.13,2.74],[1.2,1.13,2.74],[1.2,1.93,2.045],[-1.2,1.93,2.045],P.plateMil,[0,-2,0]);
 b.quad([-1.0,.76,-2.81],[1.0,.76,-2.81],[1.0,1.34,-2.81],[-1.0,1.34,-2.81],P.red,[0,1,0]);
 b.at(0,2.0,-.25,0,q=>{const CM=[pick(S,sd+1),P.hazard,P.plateMil,pick(S,sd+3)];
  q.loft([{p:R(3.3,2.8,.5),y:.2},{p:R(4.0,3.3,.62),y:.68},{p:R(3.86,3.16,.6),y:1.72},{p:R(3.1,2.5,.5),y:2.1}],(r,i)=>r===0?P.red:r===2?P.gold:(i%2?CM[(i-1)/2]:tm),{topMat:dk});
  cb(q,0,.3,1.86,1.7,.9,.4,P.ironD);q.tube([0,.72,2.05],[0,.72,3.02],.34,P.ironD,{n:5});q.tube([0,.72,2.96],[0,.72,3.22],.46,P.gold,{n:5,caps:true});
  cb(q,.55,2.1,-.5,.95,.56,.74,P.crate);cb(q,-.5,2.1,.3,.7,.46,.7,P.sack);});
 for(const s of [-1,1]){b.tube([s*2.0,1.75,-2.6],[s*2.0,4.7,-2.6],.06,P.ironD,{n:3});const m=s>0?P.flagLDF:pick(P.flagSet,sd);for(const z of [-9,9])b.quad([s*2.0,4.66,-2.6],[s*1.0,4.66,-2.6],[s*1.0,3.6,-2.6],[s*2.0,3.6,-2.6],m,[0,4,-2.6+z]);}
}

// ------------------------------------------------------------------ the generals -----------------------------------------
// A general (o.cmd) is the same unit made unmistakable: a tall STANDARD above everything else on it (a gold-collared pole, a
// yard, a banner in the doctrine colour, and on top a glowing 3D emblem whose SHAPE is the doctrine's own), doctrine-colour
// light rails along both flanks, shoulder plates painted in the doctrine colour, and more gold. Never the Parasite red.
const DOCTRINE={shield:0x48d8ff,ambush:0xffb347,artillery:0xf2f4ff,carrier:0x8dff3a,plasma:0xb07bff};
// (the solid shader shows colour x 2.3 at full emission: these keep the doctrine's own hue instead of burning out to white)
const doc=o=>{const hex=DOCTRINE[o.cmd];if(hex==null)return null;const c=K.col(hex),M=(k,a)=>({c:[c[0]*k,c[1]*k,c[2]*k],a,j:0});return {glow:M(.52,1),soft:M(.34,1),cloth:M(.4,1),paint:M(.4,.86)};};
// the emblems: about 1.1 across, centred on the origin, readable from every side
const EMBLEM={
 // shield: a hex shield (two crossed, so it never turns edge-on): a gold rim, a glowing field, a gold boss
 shield(q,D){const hx=(r,z)=>Array.from({length:6},(_,i)=>{const a=i/6*TAU+HP;return [Math.cos(a)*r,Math.sin(a)*r*1.1,z];});
  for(const ry of [0,HP])q.at(0,0,0,ry,f=>{const A=hx(.58,-.06),B=hx(.58,.06);skin(f,[A,B],P.gold,[0,0,0]);fan(f,B,P.goldD,[0,0,-1]);fan(f,A,P.goldD,[0,0,1]);
   for(const s of [-1,1]){fan(f,hx(.47,s*.075),D.glow,[0,0,-s]);fan(f,hx(.15,s*.1),P.gold,[0,0,-s]);}});},
 // ambush: crossed blades (two pairs at right angles): glowing blades, gold guards
 ambush(q,D){for(const ry of [0,HP])q.at(0,0,0,ry,f=>{for(const s of [-1,1])f.at(0,-.04,s*.014,0,g=>{poly2(g,[[-.085,-.26],[.085,-.26],[.07,.44],[0,.64],[-.07,.44]],0,0,0,D.glow);poly2(g,[[-.22,-.33],[.22,-.33],[.22,-.25],[-.22,-.25]],0,0,s*.004,P.gold);
     poly2(g,[[-.04,-.56],[.04,-.56],[.04,-.33],[-.04,-.33]],0,0,0,P.ironD);poly2(g,[[-.07,-.64],[.07,-.64],[.07,-.55],[-.07,-.55]],0,0,s*.004,P.gold);},0,s*.72);});},
 // artillery: a trio of shells standing nose up: gold cases, glowing warheads
 artillery(q,D){const n=q.hi?7:5;for(const [x,z,y] of [[0,-.2,.12],[-.27,.14,-.04],[.27,.14,-.04]]){q.cyl(x,y-.58,z,.17,.07,P.goldD,{n,bot:true,top:false});q.cyl(x,y-.52,z,.15,.36,P.gold,{n,top:false});q.cyl(x,y-.16,z,.15,.3,D.glow,{n,top:false});q.cyl(x,y+.14,z,.15,.34,D.glow,{n,r2:.035,topMat:P.gold});}},
 // carrier: a winged drone: a gold body, two raised glowing wings, a glowing tail fin
 carrier(q,D){q.gem(0,0,.06,.13,.14,.56,P.gold);q.tube([0,-.64,0],[0,-.08,0],.05,P.gold,{n:4});for(const s of [-1,1]){const A=[s*.08,0,.34],B=[s*.74,.4,.02],C=[s*.7,.36,-.3],E=[s*.08,-.02,-.18];for(const y of [-9,9])q.quad(A,B,C,E,D.glow,[0,y,0]);
   if(q.hi)q.tube(A,B,.03,P.gold,{n:3});}
  poly2(q,[[-.5,.0],[-.12,.0],[-.44,.42],[-.56,.42]],0,.04,0,D.glow,1);for(const s of [-1,1])for(const y of [-9,9])q.quad([s*.04,.02,-.3],[s*.3,.1,-.42],[s*.3,.1,-.54],[s*.04,.02,-.5],D.soft,[0,y,0]);},
 // plasma: an orb in a cage: a glowing ball between gold caps, gold bars around it
 plasma(q,D){const n=q.hi?6:4;q.ball(0,0,0,.34,D.glow,!q.hi);q.cyl(0,-.62,0,.24,.1,P.gold,{n:n+2,bot:true});q.cyl(0,.52,0,.24,.1,P.gold,{n:n+2,bot:true});
  for(let i=0;i<n;i++){const a=i/n*TAU+.4,c=Math.cos(a)*.48,s=Math.sin(a)*.48;q.tube([c*.46,-.54,s*.46],[c,-.2,s],.03,P.gold,{n:3});q.tube([c,-.2,s],[c,.2,s],.03,P.gold,{n:3});q.tube([c,.2,s],[c*.46,.54,s*.46],.03,P.gold,{n:3});}}};
// g = {pole:[x, y, z] the foot of the standard, top: the emblem's centre height, s: its scale, rails:[[x, y, z0, z1]...],
// pads:[[x, y, z, w, d]...] (both mirrored), gold: more trim}
function general(b,o,g){const D=doc(o);if(!D)return;const hi=b.hi,s=g.s,[px,py,pz]=g.pole,top=g.top,yy=top-.74*s,n=hi?6:4;
 // the standard
 b.cyl(px,py,pz,.17*s,.16*s,P.gold,{n:hi?8:5});b.tube([px,py,pz],[px,top-.6*s,pz],.06*s,P.ironD,{n,r2:.05*s});
 b.cyl(px,top-.7*s,pz,.13*s,.12*s,P.gold,{n:hi?8:5,bot:true});
 if(hi)for(let y=py+.7;y<yy-1.5*s;y+=.7)b.cyl(px,y,pz,.085*s,.07,P.gold,{n:6,bot:true});
 b.tube([px-.66*s,yy,pz],[px+.66*s,yy,pz],.04*s,P.gold,{n:4});if(hi)for(const e of [-1,1])b.gem(px+e*.7*s,yy,pz,.07*s,.1*s,.07*s,P.gold);
 b.at(px,yy-.02*s,pz,0,q=>flag(q,0,0,1.1*s,1.42*s,1,{m:D.cloth,m2:P.gold,b0:.1,b1:.18,tail:.2,sway:.05*s}));
 b.tube([px,yy-.1*s,pz-.42*s],[px,yy-.1*s,pz+.42*s],.035*s,P.gold,{n:4});b.at(px,yy-.12*s,pz,HP,q=>flag(q,0,0,.7*s,1.0*s,1,{m:D.soft,m2:P.gold,b0:.12,b1:.22,tail:.3,sway:.04*s,ph:2}));
 b.at(px,top,pz,0,q=>EMBLEM[o.cmd](q,D),0,0,s);
 // the light rails and the painted shoulder plates
 for(const [x,y,z0,z1] of g.rails)for(const e of [-1,1])cb(b,e*x,y,(z0+z1)/2,.08,.11,z1-z0,D.glow);
 for(const [x,y,z,w,d] of g.pads)for(const e of [-1,1]){blk(b,e*x,y,z,w,.12,d,D.paint,{ch:.05,edge:P.gold,top:D.paint});
  if(hi)for(const k of [-1,0,1])b.quad([e*x-w*.3,y+.124,z+k*d*.26-.05],[e*x,y+.124,z+k*d*.26+.07],[e*x,y+.124,z+k*d*.26+.15],[e*x-w*.3,y+.124,z+k*d*.26+.03],P.gold,[0,0,0]).quad([e*x+w*.3,y+.124,z+k*d*.26-.05],[e*x,y+.124,z+k*d*.26+.07],[e*x,y+.124,z+k*d*.26+.15],[e*x+w*.3,y+.124,z+k*d*.26+.03],P.gold,[0,0,0]);}
 if(g.gold)g.gold(b,hi,D);
}
const RAIDER_CMD={pole:[0,1.8,-2.16],top:4.52,s:1,rails:[[1.4,.9,-2.2,1.95]],pads:[[1.1,.93,1.4,.62,1.1]],
  gold(b,hi){for(const s of [-1,1])trim(b,[s*.84,1.03,-.55],[s*.84,1.03,1.55],.035);if(hi)b.loft([{p:K.rect(1.6,1.8,.1,0,-1.45),y:1.74},{p:K.rect(1.6,1.8,.1,0,-1.45),y:1.82}],P.gold,{top:false});}},
 SENTINEL_CMD={pole:[0,2.0,-2.7],top:7.05,s:1.4,rails:[[2.27,1.75,-2.72,2.62]],pads:[[1.83,1.75,2.12,.96,1.05]],
  gold(b,hi){for(const s of [-1,1])trim(b,[s*1.36,2.02,-2.3],[s*1.36,2.02,1.9],.045);if(hi)for(const s of [-1,1])b.gem(s*2.06,1.86,2.68,.09,.16,.09,P.gold);}},
 COMMAND_CMD={pole:[0,6.0,-1.15],top:8.34,s:1.3,rails:[[2.18,3.32,-2.66,.46],[2.26,1.65,.5,2.5]],pads:[[1.78,1.65,2.24,.96,.72]],
  gold(b,hi){for(const s of [-1,1])trim(b,[s*1.32,1.92,-2.7],[s*1.32,1.92,1.9],.045);}};

// ------------------------------------------------------------------ registration ----------------------------------------
// one slot = hull + gun: o.part picks a half (the gun in its own frame); with no o.part the gun stands at its pivot
function unit(hull,gun,pivot,town,cmd,size){return (b,o)=>{use(b);if(o.town&&town){const h=b.hi;b.hi=false;try{town(b,o);}finally{b.hi=h;}return fit(b,size,size===TOWN.drone);}const part=o.part;
  if(part!=='gun'){hull(b,o);if(o.cmd&&cmd)general(b,o,cmd);}
  if(part!=='hull'&&gun){const ao=b.aoMin;b.aoMin=1;if(part==='gun')gun(b,o);else b.at(pivot[0],pivot[1],pivot[2],0,q=>gun(q,o));b.aoMin=ao;}};}
WK.model('par-raider',unit(raiderHull,raiderGun,RAIDER_PIVOT,raiderTown,RAIDER_CMD,TOWN.raider),{aoH:1.6,aoMin:.56});
WK.model('par-breacher',unit(breacherHull,breacherGun,BREACHER_PIVOT,null,null),{aoH:2.2,aoMin:.56});
WK.model('par-sentinel',unit(sentinelHull,sentinelGun,SENTINEL_PIVOT,sentinelTown,SENTINEL_CMD,TOWN.sentinel),{aoH:2.4,aoMin:.56});
WK.model('par-command',unit(commandHull,commandGun,COMMAND_PIVOT,null,COMMAND_CMD),{aoH:2.4,aoMin:.56});
WK.model('par-swarm',unit(swarmHull,swarmGun,SWARM_PIVOT,swarmTown,null,TOWN.swarm),{aoH:.9,aoMin:.56});
WK.model('par-brute',unit(bruteHull,bruteGun,BRUTE_PIVOT,bruteTown,null,TOWN.brute),{aoH:2.4,aoMin:.56});
WK.model('par-drone',unit(droneHull,droneGun,DRONE_PIVOT,droneTown,null,TOWN.drone),{aoH:.01,aoMin:.82});
// What the game needs to know about each unit: its slot, where the gun group sits (model space), whether it has a town
// model and whether it can be a general; the doctrine colours; the size of each town model (width, height, length; the
// drone's is centred on y = 0); how high a general's standard reaches.
const U=(slot,pivot,town,cmd)=>({slot,pivot,town,cmd});
root.ConquestParUnits={raider:U('par-raider',RAIDER_PIVOT,true,true),breacher:U('par-breacher',BREACHER_PIVOT,false,false),sentinel:U('par-sentinel',SENTINEL_PIVOT,true,true),command:U('par-command',COMMAND_PIVOT,false,true),
 swarm:U('par-swarm',SWARM_PIVOT,true,false),brute:U('par-brute',BRUTE_PIVOT,true,false),drone:U('par-drone',DRONE_PIVOT,true,false),
 doctrines:DOCTRINE,townSize:TOWN,standardTop:{raider:RAIDER_CMD.top+.66*RAIDER_CMD.s,sentinel:SENTINEL_CMD.top+.66*SENTINEL_CMD.s,command:COMMAND_CMD.top+.66*COMMAND_CMD.s}};
})(typeof globalThis!=='undefined'?globalThis:window);
