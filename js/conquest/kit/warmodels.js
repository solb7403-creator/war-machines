/* LUNAR Conquest world kit — WAR models (Session 5E-2d2; owner, Nov 21). Four slots, each its own design:
 *   par-shuttle  the Parasites' light scavenger shuttle: it hovers and drops raiders / swarm buggies from an open belly frame
 *   par-hauler   the heavy hauler: a flying landing barge that lands and drops a bow ramp (o.part: hull | ramp)
 *   portal-gate  the Parasites' portal (o.state: dormant | open | suppressed)
 *   ldf-post     a Lunar Defense Force field post (o.seed picks one of the layouts)
 * The Parasites are greedy humans, not aliens: every Parasite machine here is human-built, stolen and over-armoured (bolted-on
 * plundered plates, loot lashed on, other colonies' flags as trophies, gaudy gold). The infection is the only organic part:
 * red veins through seams, vents and cockpits. o.seed patches each raid's ships differently; o.wreck = the shot-down hulk.
 * Model space: metres, +y up, the footprint centred on the origin, the bow toward +z, landing skids on y = 0.
 * ConquestWarModels (end of file) gives the game the numbers it animates with (the ramp hinge and angles, the hover height). */
(function(root){
'use strict';
const WK=root.ConquestWorldKit,TAU=Math.PI*2,HP=Math.PI/2;
const hz=(s,k)=>WK.hash(Math.imul(s|0,7919)+Math.imul(k|0,104729)+17);
const L3=(a,c,t)=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t,a[2]+(c[2]-a[2])*t];

// ------------------------------------------------------------------ geometry helpers ------------------------------------
// one flat polygon (convex, any winding); m = one material or one per corner (glow gradients); the normal turns away from `ins`
function face(b,P,m,ins){const n=P.length;let nx=0,ny=0,nz=0,cx=0,cy=0,cz=0;
 for(let i=0;i<n;i++){const u=P[i],v=P[(i+1)%n];nx+=(u[1]-v[1])*(u[2]+v[2]);ny+=(u[2]-v[2])*(u[0]+v[0]);nz+=(u[0]-v[0])*(u[1]+v[1]);cx+=u[0];cy+=u[1];cz+=u[2];}
 const l=Math.hypot(nx,ny,nz);if(l<1e-9)return b;nx/=l;ny/=l;nz/=l;cx/=n;cy/=n;cz/=n;
 const flip=ins?nx*(cx-ins[0])+ny*(cy-ins[1])+nz*(cz-ins[2])<0:false;if(flip){nx=-nx;ny=-ny;nz=-nz;}
 const A=Array.isArray(m),id=P.map((p,i)=>b._v(p[0],p[1],p[2],nx,ny,nz,A?m[i]:m)),I=b.cur.I;
 for(let i=1;i<n-1;i++){const u=P[0],v=P[i],w=P[i+1],ax=v[0]-u[0],ay=v[1]-u[1],az=v[2]-u[2],bx=w[0]-u[0],by=w[1]-u[1],bz=w[2]-u[2];
  if(Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)<1e-9)continue;if(flip)I.push(id[0],id[i+1],id[i]);else I.push(id[0],id[i],id[i+1]);}
 return b;}
const dface=(b,P,m)=>{face(b,P,m);return face(b,P.slice().reverse(),Array.isArray(m)?m.slice().reverse():m);};   // both sides (cloth)
// a body through rings of 3D points (one count, convex rings): flat faces; m = material or (band, side) => material | null
function skin(b,R,m,o={}){const n=R[0].length,mf=typeof m==='function'?m:()=>m,cen=r=>{const c=[0,0,0];for(const p of r){c[0]+=p[0]/n;c[1]+=p[1]/n;c[2]+=p[2]/n;}return c;};
 for(let r=0;r<R.length-1;r++){const A=R[r],B=R[r+1],ins=L3(cen(A),cen(B),.5);for(let i=0;i<n;i++){const j=(i+1)%n,mm=mf(r,i);if(mm)face(b,[A[i],A[j],B[j],B[i]],mm,ins);}}
 const e=R.length-1;if(o.a)face(b,R[0],o.a,cen(R[1]));if(o.z)face(b,R[e],o.z,cen(R[e-1]));return b;}
// the same along z (sections {z, p: [[x, y]...]}; m gets (z at the band's middle, side)) and along y (rings {y, p: [[x, z]...]})
const zloft=(b,S,m,o)=>skin(b,S.map(s=>s.p.map(p=>[p[0],p[1],s.z])),typeof m==='function'?(r,i)=>m((S[r].z+S[r+1].z)/2,i,r):m,o);
const yloft=(b,S,m,o)=>skin(b,S.map(s=>s.p.map(p=>[p[0],s.y,p[1]])),m,o);
// a surface of revolution about the local y axis: prof = [[r, y]...]; walking the profile, the surface faces its right-hand side
// (up the outside, over the lip, down the inside). m = material or (segment, side) => material | [4 corner materials] | null
function rev(b,x,y,z,prof,n,m,o={}){const mf=typeof m==='function'?m:()=>m,rot=o.rot||0,I=b.cur.I;
 for(let s=0;s<prof.length-1;s++){const r0=prof[s][0],y0=prof[s][1],r1=prof[s+1][0],y1=prof[s+1][1],dr=r1-r0,dy=y1-y0,l=Math.hypot(dr,dy);if(l<1e-6)continue;const nr=dy/l,ny=-dr/l;
  for(let i=0;i<n;i++){const mm=mf(s,i);if(!mm)continue;const A=Array.isArray(mm),a0=i/n*TAU+rot,a1=(i+1)/n*TAU+rot,am=(a0+a1)/2,
    V=(a,r,yy,k)=>{const an=o.smooth?a:am;return b._v(x+Math.cos(a)*r,y+yy,z+Math.sin(a)*r,Math.cos(an)*nr,ny,Math.sin(an)*nr,A?mm[k]:mm);};
   const i0=V(a0,r0,y0,0),i1=V(a1,r0,y0,1),i2=V(a1,r1,y1,2),i3=V(a0,r1,y1,3);if(r0>1e-6)I.push(i0,i3,i1);if(r1>1e-6)I.push(i1,i3,i2);}}
 return b;}
// a cheap box: centre x / z, base y; only the faces not named in `skip` (t top, b bottom, f +z, k -z, r +x, l -x)
function qb(b,x,y,z,w,h,d,m,skip=''){const x0=x-w/2,x1=x+w/2,y1=y+h,z0=z-d/2,z1=z+d/2,c=[x,y+h/2,z];
 if(!skip.includes('t'))face(b,[[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],m,c);if(!skip.includes('b'))face(b,[[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]],m,c);
 if(!skip.includes('f'))face(b,[[x0,y,z1],[x1,y,z1],[x1,y1,z1],[x0,y1,z1]],m,c);if(!skip.includes('k'))face(b,[[x0,y,z0],[x1,y,z0],[x1,y1,z0],[x0,y1,z0]],m,c);
 if(!skip.includes('r'))face(b,[[x1,y,z0],[x1,y,z1],[x1,y1,z1],[x1,y1,z0]],m,c);if(!skip.includes('l'))face(b,[[x0,y,z0],[x0,y,z1],[x0,y1,z1],[x0,y1,z0]],m,c);return b;}
// a squashed boulder shape (sacks, growth nodules): 20 triangles
function blob(b,x,y,z,rx,ry,rz,m,yaw=0){const T=b.k.T;return b.geo(b.k.unit.ico0,new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(0,yaw,.3)),new T.Vector3(rx,ry,rz)),m);}
// a vein: a thin tapering run of glow through points; crawl() = a wandering path from a to c (jitter along `up` and `side`)
function vein(b,pts,r,m,n=3){const k=pts.length-1;for(let i=1;i<=k;i++)b.tube(pts[i-1],pts[i],r*(1-.6*(i-1)/k),m,{n,r2:r*(1-.6*i/k)});return b;}
function crawl(a,c,n,amp,sd,up=[0,1,0],side=[0,0,0]){const P=[a];for(let k=1;k<n;k++){const p=L3(a,c,k/n),u=(hz(sd,k)-.5)*2*amp,v=(hz(sd,k+40)-.5)*2*amp;P.push([p[0]+up[0]*u+side[0]*v,p[1]+up[1]*u+side[1]*v,p[2]+up[2]*u+side[2]*v]);}P.push(c);return P;}
// a flag on a pole: the pole stands at the frame's origin (height h), the cloth (w x fh) flies along local +x from the top;
// o.m2 = a stripe, o.torn = a trophy with its fly end ripped
function flag(b,h,w,fh,m,o={}){const n=b.hi?3:2,pm=o.pole,wv=k=>k?Math.sin(k*2.1+(o.ph||0))*w*.07:0,sg=o.sag??.12;if(pm)b.tube([0,0,0],[0,h+.08,0],o.r||.05,pm,{n:4});
 for(let k=0;k<n;k++){const x0=w*k/n,x1=w*(k+1)/n,d0=sg*x0,d1=sg*x1,cut=o.torn&&k===n-1?fh*.45:0,T0=[x0,h-d0,wv(k)],T1=[x1,h-d1,wv(k+1)],B0=[x0,h-fh-d0,wv(k)*1.4],B1=[x1,h-fh-d1+cut,wv(k+1)*1.4];
  if(o.m2){const a=.36,c=.64,M=(P,Q,t)=>L3(P,Q,t);dface(b,[T0,T1,M(T1,B1,a),M(T0,B0,a)],m);dface(b,[M(T0,B0,a),M(T1,B1,a),M(T1,B1,c),M(T0,B0,c)],o.m2);dface(b,[M(T0,B0,c),M(T1,B1,c),B1,B0],m);}else dface(b,[T0,T1,B1,B0],m);}
 return b;}

// ------------------------------------------------------------------ the Parasite look -----------------------------------
// the shared Parasite palette plus this file's paints; a wreck gets every surface sooted and every glow dead (fires stay)
function parPal(b,wreck){const K=b.k,P=Object.assign({},K.pal.par,{blue:K.mat(0x1f5f8a,'paint',.6),white:K.mat(0xc9c2b0,'paint',.6),deck:K.mat(0x4d4c52,'metal',.75),tread:K.mat(0x5c5a5e,'metal',.8),
   growth:K.mat(0x5a141a,'flat',0,.1),growthD:K.mat(0x30090d,'flat',0,.1),glassTop:{c:K.col(0x1c0508),a:1.5,j:0},lamp:K.glow(WK.PAR.red,1)});
 if(wreck){const soot=m=>m.a>0?{c:[.006,.005,.005],a:K.surfA(K.SURF.metal,.9),j:0}:{c:[m.c[0]*.3+.007,m.c[1]*.3+.006,m.c[2]*.3+.005],a:m.a,j:m.j};for(const k in P)P[k]=Array.isArray(P[k])?P[k].map(soot):soot(P[k]);P.glassDead={c:[.012,.011,.011],a:K.surfA(K.SURF.metal,.9),j:0};}
 P.fire=K.glow(0xff5a1c,1.9);P.ember=K.glow(0xff3410,1);P.wreck=!!wreck;return P;}
// what one raid stole: the seed picks the paint of the plundered plates, the stripe, the trophies and the loot
function livery(P,sd,tint){const L=((sd%6)+6)%6,S=P.plateSet,main=[P.plateMil,S[0],S[1],P.hazard,S[2],S[4]][L],second=[P.plateMilD,S[3],S[2],P.ironL,S[0],S[3]][L],stripe=[P.blue,P.white,P.hazard,P.rust,S[0],P.gold][L],
  F=P.flagSet,flags=[[P.flagLDF,F[1]],[F[3],F[2]],[F[1],P.flagLDF],[F[0],F[4]],[F[2],F[3]],[F[4],F[0]]][L];
 return {L,main,second,stripe,flags,hull:main,hullD:tint(main,.8),hullIn:tint(main,.42),cowl:tint(second,.82),art:['teeth','tally','bars','teeth','bars','tally'][L],pick:k=>{const h=hz(sd,k);return h<.5?main:h<.7?second:h<.8?P.ironL:h<.89?P.rust:S[(h*977|0)%5];},
  patch:k=>{const h=hz(sd,k);return h<.4?second:h<.54?P.ironL:h<.66?P.rust:h<.74?P.iron:S[(h*977|0)%5];},has:(k,p=.85)=>hz(sd,k+500)<p,r:k=>hz(sd,k+900)};}
// a bolted-on plate on a surface whose outward normal is +z of the frame: centred on x, base y. A hazard plate is striped.
function plate(q,P,x,y,w,h,m,o={}){const t=o.t||.12,z0=o.z||0,hzd=m===P.hazard;
 q.at(x,y+h/2,z0,0,p=>{if(!p.hi){face(p,[[-w/2,-h/2,t],[w/2,-h/2,t],[w/2,h/2,t],[-w/2,h/2,t]],m,[0,0,-9]);return;}
  qb(p,0,-h/2,t/2,w,h,t,hzd?P.hazardD:m,'k');
  if(hzd){const n=Math.max(2,Math.round(w/.8)),pw=w/(2*n);for(let k=0;k<n;k++){const x0=-w/2+k*2*pw;face(p,[[x0,-h/2,t+.012],[x0+pw,-h/2,t+.012],[x0+2*pw,h/2,t+.012],[x0+pw,h/2,t+.012]],P.hazard,[0,0,-9]);}}
  if(o.bolts!==0&&!P.wreck)p.detail(()=>{for(const sx of [-1,1])for(const sy of [-1,1]){const bx=sx*(w/2-.14),by=sy*(h/2-.14);face(p,[[bx-.05,by-.05,t+.02],[bx+.05,by-.05,t+.02],[bx+.05,by+.05,t+.02],[bx-.05,by+.05,t+.02]],P.weld,[0,0,-9]);}});
 },o.rx||0,o.rz||0);}
// loot: a strapped crate / container, a pressure tank, a heap of sacks, a cargo net thrown over a heap
function crate(q,P,x,y,z,w,h,d,m,ry=0){q.at(x,y,z,ry,p=>{qb(p,0,0,0,w,h,d,m,'b');if(p.hi)for(const sx of w>1.6?[-.3,.3]:[0])qb(p,sx*w,0,0,.1,h+.03,d+.06,P.strap,'b');});}
function tank(q,P,x,y,z,r,h){const n=q.hi?8:6;rev(q,x,y,z,[[r,0],[r,h*.36],[r*1.03,h*.36],[r*1.03,h*.5],[r,h*.5],[r,h*.82],[r*.5,h],[0,h]],n,s=>s===2?P.tankBand:s===1||s===3?(q.hi?P.tankBand:null):P.tank,{smooth:true});}
function sacks(q,P,x,y,z,n,sd,sp=.5){for(let k=0;k<n;k++){const a=k*2.4+sd,rr=k?sp*(.5+.5*hz(sd,k)):0,lay=k>=4?1:0;blob(q,x+Math.cos(a)*rr,y+.2+lay*.3,z+Math.sin(a)*rr*.7,.42,.24,.3,k%3===1?b_t(q,P.sack,.8):P.sack,a);}}
const b_t=(q,m,k)=>q.k.tint(m,k);
function net(q,P,x0,x1,z0,z1,y0,yt,nx=4,nz=3){const m=P.net,r=.035,arc=(a,c)=>{const mid=L3(a,c,.5);mid[1]=yt;q.tube(a,L3(a,mid,.55).map((v,i)=>i===1?y0+(yt-y0)*.8:v),r,m,{n:3});q.tube(L3(a,mid,.55).map((v,i)=>i===1?y0+(yt-y0)*.8:v),L3(mid,c,.45).map((v,i)=>i===1?y0+(yt-y0)*.8:v),r,m,{n:3});q.tube(L3(mid,c,.45).map((v,i)=>i===1?y0+(yt-y0)*.8:v),c,r,m,{n:3});};
 for(let k=0;k<nx;k++){const x=x0+(x1-x0)*(k+.5)/nx;arc([x,y0,z0],[x,y0,z1]);}for(let k=0;k<nz;k++){const z=z0+(z1-z0)*(k+.5)/nz;arc([x0,y0,z],[x1,y0,z]);}}
// the infection: a growth nodule with a lit core; a fire on a wreck
function nodule(q,P,x,y,z,r){blob(q,x,y,z,r,r*.7,r*.85,P.growth,x*3);q.gem(x,y+r*.5,z,r*.45,r*.4,r*.45,P.red);}
function fire(q,P,x,y,z,s=1){q.gem(x,y+.45*s,z,.26*s,.6*s,.26*s,P.fire);q.gem(x+.3*s,y+.3*s,z+.1*s,.18*s,.4*s,.18*s,P.ember);if(q.hi)q.gem(x-.22*s,y+.26*s,z-.16*s,.15*s,.34*s,.15*s,P.fire,.6);q.halo(x,y+.5*s,z,2.2*s,0xff5a1c,.9);}

// a wreck is drawn in two halves (frames from F): a body lofted along z is cut at the break, its torn ends closed dark
function splitter(wreck,ZB,F,P){const cutS=(S,z0,z1)=>{const at=z=>{for(let i=0;i<S.length-1;i++){const A=S[i],B=S[i+1];if(z>=A.z&&z<=B.z){const t=(z-A.z)/(B.z-A.z||1);return {z,p:A.p.map((p,k)=>[p[0]+(B.p[k][0]-p[0])*t,p[1]+(B.p[k][1]-p[1])*t])};}}},out=[];
  if(S[0].z<z0)out.push(at(z0));for(const s of S)if(s.z>=z0&&s.z<=z1)out.push(s);if(S[S.length-1].z>z1)out.push(at(z1));return out;};
 return (S,m,o2={})=>{const e=S.length-1;if(!wreck||S[e].z<=ZB||S[0].z>=ZB)return F(S[0].z+.01,q=>zloft(q,S,m,o2));F(ZB-1,q=>zloft(q,cutS(S,-99,ZB),m,{a:o2.a,z:P.weld}));F(ZB+1,q=>zloft(q,cutS(S,ZB,99),m,{a:P.weld,z:o2.z}));};}

// ------------------------------------------------------------------ par-hauler ------------------------------------------
// The heavy hauler: a flying landing barge. An armoured tub with an open cargo well between tall flanks (clear 7.2 m wide,
// open above), a raked bow closed by the ramp, the stern castle with the bridge on top, four lift engines in corner pods,
// two stern thrusters, twin landing skids. Flanks carry plundered plates and lashed loot; flags fly from the bridge.
const HAUL={size:[16.2,10.3,26],deckY:1.3,zH:10.2,rampLen:5.6,rampW:7.9,closed:-1.33,open:Math.asin(1.3/5.6),rake:Math.cos(1.33)/Math.sin(1.33)};
function haulRamp(q,P,LV,sd){const hi=q.hi,L=HAUL.rampLen,hw=HAUL.rampW/2,wreck=P.wreck;
 zloft(q,[[0,-.4],[4.6,-.4],[L,-.1]].map(([z,yb])=>({z,p:[[-hw,yb],[hw,yb],[hw,0],[-hw,0]]})),(z,i)=>i===2?P.tread:i===0?P.iron:P.ironD,{a:P.ironD,z:P.hazard});
 for(const s of [-1,1])qb(q,s*(hw-.17),0,L/2+.15,.34,.28,L-.5,P.iron,'b');
 if(hi){for(let k=1;k<=7;k++)qb(q,0,0,k*.68,HAUL.rampW-.8,.05,.14,P.ironD,'b');for(const [x0,x1] of [[-3.7,-1.5],[-1.1,1.1],[1.5,3.7]])q.tube([x0,-.2,-.02],[x1,-.2,-.02],.3,P.ironD,{n:6,caps:true});}
 else qb(q,0,-.42,-.02,7.4,.46,.5,P.ironD,'t');
 for(let k=0;k<8;k++){const x0=-hw+.4+k*(HAUL.rampW-.8)/8;face(q,[[x0,.014,L-.55],[x0+(HAUL.rampW-.8)/8,.014,L-.55],[x0+(HAUL.rampW-.8)/8,.014,L-.12],[x0,.014,L-.12]],k%2?P.hazardD:P.hazard,[0,-9,0]);}
 // the outer face (the ship's bow when the ramp is raised): frame ribs, mismatched plates, a gold lip, nose art, the infection in the seams
 q.at(0,-.4,0,0,f=>{for(const s of [-1,1])qb(f,s*(hw-.14),.1,.1,.28,L-.9,.2,P.ironL,'k');
  const cols=[[-2.48,2.3],[0,2.3],[2.48,2.3]],rows=[[.55,2.0],[2.75,1.9]];let k=0;
  for(const [cx,w] of cols)for(const [y0,h] of rows){k++;if(!LV.has(k+60,.9))continue;const big=k===3;plate(f,P,cx+(LV.r(k)-.5)*.14,y0,w,h,big?LV.main:LV.pick(k+60),{t:.1+.08*LV.r(k+7),rz:(LV.r(k+3)-.5)*(wreck?.3:.07),rx:wreck&&k%2?-.25:0});}
  qb(f,0,L-.75,.14,HAUL.rampW-.5,.3,.28,P.gold,'k');qb(f,0,.12,.12,HAUL.rampW-.6,.26,.24,P.ironL,'k');
  if(LV.art==='teeth'){const n=hi?9:5;for(let i=0;i<n;i++){const x0=-3.3+i*6.6/n,w=6.6/n;face(f,[[x0+.04,.42,.2],[x0+w-.04,.42,.2],[x0+w/2,.42+(i%2?.62:.8),.2]],P.white,[0,0,-9]);}}
  else if(LV.art==='bars'){for(const s of [-1,1])face(f,[[s*3.3,.5,.21],[s*2.2,.5,.21],[s*.5,2.5,.21],[s*1.6,2.5,.21]],LV.stripe,[0,0,-9]);}
  else if(hi)for(let i=0;i<7;i++){const x0=-3.2+i*.28+(i>=5?.25:0);face(f,[[x0,.6,.21],[x0+.1,.6,.21],[x0+.1,1.3,.21],[x0,1.3,.21]],P.white,[0,0,-9]);}
  if(!wreck){vein(f,crawl([-1.24,.5,.2],[-1.2,4.7,.2],hi?5:2,.1,sd+1,[1,0,0]),.085,P.red);vein(f,crawl([1.24,.4,.2],[1.3,3.4,.2],hi?4:2,.1,sd+2,[1,0,0]),.085,P.red);
   if(hi){vein(f,crawl([-3.5,2.66,.2],[1.2,2.7,.2],5,.09,sd+3),.07,P.red);nodule(f,P,-1.22,2.68,.24,.3);vein(f,crawl([1.24,2.6,.2],[3.3,3.6,.2],3,.1,sd+4),.06,P.redDim);}
   for(const s of [-1,1])qb(f,s*3.2,L-.38,.3,.5,.22,.12,P.lamp,'k');}
 },HP);}
function hauler(b,o){const K=b.k,{tint}=K,hi=b.hi,wreck=!!o.wreck,fine=hi&&!wreck,sd=(o.seed|0)||1,part=wreck?null:o.part,P=parPal(b,wreck),LV=livery(P,sd,tint),H=HAUL,dY=H.deckY,zH=H.zH,ZB=-1.2;
 if(part==='ramp'){haulRamp(b,P,LV,sd);return;}
 // a wreck is broken-backed: the stern half settles level, the bow half slews and digs its nose in
 const F=(z,fn)=>!wreck?fn(b):z<ZB?b.at(-.25,-.68,0,.05,fn,-.03,.07):b.at(.5,-.6,ZB,-.2,q=>q.at(0,0,-ZB,0,fn),.065,-.13);
 const body=splitter(wreck,ZB,F,P);
 const flank=(s,z,x,fn)=>F(z,q=>q.at(s*x,0,z,s*HP,fn));   // a frame on a flank: +z outward, +x along the hull (toward the stern on the right side)
 // ---- the tub and the cargo deck ----
 body([[-11.6,1.12,2.7,4.3],[-9.8,.7,3.5,4.6],[7.8,.7,3.5,4.6],[zH,1.02,3.3,4.6]].map(([z,yb,hb,ht])=>({z,p:[[-hb,yb],[hb,yb],[ht,1.06],[ht,dY],[-ht,dY],[-ht,1.06]]})),(z,i)=>i===3?P.deck:i===0?P.weld:P.iron,{a:P.ironD,z:P.ironD});
 // ---- the flanks: tall armoured walls, lower amidships, raked cheeks framing the bow ----
 for(const s of [-1,1]){
  body([[-8.3,6.2],[-3.6,6.2],[-3.1,5.5],[3.9,5.5],[4.4,6.5],[8.5,6.5]].map(([z,t])=>({z,p:[[s*3.6,dY],[s*4.6,dY],[s*4.95,1.95],[s*4.95,t-.3],[s*4.67,t],[s*3.6,t]]})),(z,i)=>i===0?null:i===4?LV.stripe:i===5?LV.hullIn:i===3?P.ironL:i===2?LV.hull:P.iron);
  const ck=y=>({y,p:[[s*3.6,8.5],[s*5.25,8.5],[s*5.25,zH+(y-dY)*H.rake],[s*3.6,zH+(y-dY)*H.rake]]});
  F(9,q=>{yloft(q,[ck(dY-.24),ck(6.55),{y:6.85,p:[[s*3.75,8.7],[s*5.1,8.7],[s*5.1,zH+5.3*H.rake-.15],[s*3.75,zH+5.3*H.rake-.15]]}],(r,i)=>r?P.gold:i===3?P.ironD:i===1?LV.hull:P.iron,{z:P.ironL});
   if(!wreck)qb(q,s*4.42,6.85,10.6,.5,.26,.5,P.red,'b');q.halo(s*4.42,7.2,10.6,1.6,WK.PAR.red,wreck?0:.8);});}
 // ---- the stern castle and the bridge ----
 F(-10,q=>{const SB=[[-4.95,dY],[4.95,dY],[4.95,4.9],[4.45,6.2],[-4.45,6.2],[-4.95,4.9]];
  zloft(q,[{z:-11.6,p:[[-4.4,1.75],[4.4,1.75],[4.4,4.7],[4,5.9],[-4,5.9],[-4.4,4.7]]},{z:-11.05,p:SB},{z:-8.2,p:SB}],(z,i)=>i===0?P.weld:i===3?P.ironL:i===1||i===5?LV.hull:P.iron,{a:P.iron,z:P.ironD});
  const R=(w,d,y,cz,ch=.5)=>({y,p:K.rect(w,d,hi?ch:.3,0,cz)}),gl=wreck?P.glassDead:[P.red,P.red,P.glassTop,P.glassTop];
  yloft(q,[R(6.6,3,6.2,-9.9),R(6.9,3.4,6.95,-9.8,.55),R(6.5,3,7.85,-9.9),R(7.2,3.8,8,-9.72,.55),R(7.2,3.8,8.16,-9.72,.55),R(5.8,2.6,8.42,-9.95)],(r,i)=>r===1?(i>=2&&i<=6?gl:P.ironD):r===3?P.gold:r===2?P.ironD:r===4?(wreck?P.iron:LV.second):P.iron,{z:wreck?P.ironL:LV.cowl});
  if(hi){const A=R(6.9,3.4,6.95,-9.8,.55).p,B=R(6.5,3,7.85,-9.9).p;for(const k of [2,3,4,5,6,7])q.tube([A[k][0],6.95,A[k][1]],[B[k][0],7.85,B[k][1]],.075,P.weld,{n:3});for(const x of [-1,1])q.tube([x,6.95,-8.08],[x*.94,7.85,-8.38],.06,P.weld,{n:3});}
  // the back wall of the well: a shutter door in a hazard frame, vents the growth has taken
  qb(q,0,dY,-8.16,4.6,3.5,.1,P.weld,'kb');qb(q,0,dY+3.5,-8.14,5,.3,.14,P.hazard,'kb');
  if(hi){for(let k=0;k<5;k++)qb(q,0,dY+.3+k*.62,-8.1,4.3,.1,.06,P.iron,'kb');for(const s of [-1,1]){qb(q,s*2.45,dY,-8.14,.3,3.5,.14,P.hazardD,'kb');qb(q,s*3.7,3.6,-8.14,1.1,1.3,.1,P.weld,'kb');for(let k=0;k<3;k++)qb(q,s*3.7,3.75+k*.38,-8.1,.9,.12,.06,P.lamp,'kb');}}
  if(!wreck){qb(q,0,dY+3.9,-8.12,3.2,.14,.08,P.red,'kb');q.halo(0,5.2,-7.8,2.6,WK.PAR.red,.5);}
  // roof kit: the mast, a stolen dish, a gold crest on the brow, trophy flags at the stern corners
  q.tube([2.2,8.4,-10.6],[2.2,9.6,-10.6],.07,P.ironL,{n:4});if(!wreck)q.gem(2.2,9.56,-10.6,.12,.14,.12,P.red);
  {const tro=LV.L%3;   // the roof trophy: a stolen dish / a captured gun turret / stolen tanks
   if(tro===0){if(hi)q.at(-1.9,8.42,-9.4,.5,d=>{d.tube([0,0,0],[0,.5,0],.07,P.ironD,{n:4});d.at(0,.55,0,0,e=>{rev(e,0,0,0,[[.08,0],[.75,.3],[.72,.34],[.06,.06]],8,s=>s===0?P.plateMilD:P.plateMil);e.tube([0,.05,0],[0,.5,0],.03,P.ironD,{n:3});},-.75);});}
   else if(tro===1)q.at(-1.5,8.42,-9.6,.35,d=>{d.cyl(0,0,0,.8,.16,P.ironD,{n:hi?8:6});yloft(d,[{y:.16,p:K.rect(1.6,1.8,hi?.3:0)},{y:.8,p:K.rect(1.2,1.3,hi?.25:0,0,-.12)}],P.plateMil,{z:P.plateMilD});
     for(const s of [-1,1]){d.tube([s*.26,.5,.5],[s*.26,.72,2],.1,P.ironD,{n:hi?5:4});if(hi)d.tube([s*.26,.7,1.86],[s*.26,.74,2.14],.15,P.weld,{n:5,caps:true});}if(hi)qb(d,0,.42,.82,1.3,.12,.06,P.gold,'k');});
   else q.at(-1.6,8.42,-9.75,.12,d=>{for(const z of [-.5,.5]){d.tube([-1.2,.47,z],[1.2,.47,z],.45,P.tank,{n:hi?8:6,caps:true});if(hi)for(const x of [-.6,.6])d.tube([x-.07,.47,z],[x+.07,.47,z],.47,P.tankBand,{n:8});}qb(d,0,0,0,1.2,.1,1.9,P.strap,'b');if(hi)qb(d,0,.9,0,.12,.05,2,P.strap,'');});
   if(hi){q.tube([1.7,9.1,-10.6],[2.7,9.1,-10.6],.035,P.ironL,{n:3});q.gem(0,7.6,-7.82,.42,.5,.1,P.gold);for(const s of [-1,1])q.gem(s*.8,7.6,-7.86,.2,.3,.08,P.goldD);}}
  for(const s of [-1,1])q.at(s*2.5,8.3,-11.1,HP+s*.12,f=>flag(f,1.9-(s>0?.3:0),1.7,1,LV.flags[s>0?0:1],{pole:P.ironL,m2:LV.flags[s>0?0:1]===P.flagLDF?P.flagLDF2:null,torn:true,ph:s,sag:.18}),0,-.12);
  // stern: two thrusters, a pair of stacks on the port quarter
  for(const s of [-1,1])q.at(s*2.3,3.5,-11.5,0,t=>rev(t,0,0,0,[[1,0],[1.22,.5],[1.12,.72],[.96,.72],[.82,.18],[0,.18]],hi?10:6,sg=>sg===4?(wreck?P.weld:[P.redHot,P.redHot,P.red,P.red]):sg===3?(wreck?P.weld:P.lamp):sg===2?P.ironL:P.ironD,{smooth:hi}),-HP);
  for(const z of [-10.6,-9.7]){q.tube([-4.2,6.1,z],[-4.2,8.7,z],.26,P.ironD,{n:hi?6:4});if(!wreck)q.tube([-4.2,8.7,z],[-4.2,8.86,z],.2,P.redHot,{n:hi?6:4,caps:true});}
  if(wreck){fire(q,P,-1.5,6.2,-8.6,1.4);fire(q,P,2.6,8.3,-10,1);}
 });
 // ---- the four lift engines ----
 const pod=(q,k,s)=>{const n=hi?12:8,out=s>0?0:Math.PI,dead=wreck;
  rev(q,0,0,0,[[0,1.08],[.8,1.3],[1,1.3],[1.06,1.46],[1.25,2.15],[1.45,2.4],[1.45,4.3],[1.32,4.52],[1.08,4.52],[1,4.2],[.76,4.2],[.3,4.2],[0,4.45]],n,
   sg=>sg===0?(dead?P.weld:[P.redHot,P.redHot,P.red,P.red]):sg===1||sg===2?(dead?P.weld:P.redHot):sg===3?P.ironD:sg===4?P.iron:sg===5?LV.cowl:sg===6?P.ironL:sg===7?P.ironL:sg===8?P.weld:sg===9?(dead?P.weld:P.red):sg===10?P.weld:P.ironL,{smooth:hi});
  if(hi)rev(q,0,0,0,[[1.47,2.42],[1.47,2.62]],n,P.gold,{smooth:true});
  [-1.15,-.38,.38,1.15].forEach((da,j)=>{if(!LV.has(k*10+j,.8))return;const a=out+da,h=1+.6*LV.r(k*10+j),y0=2.75+.5*LV.r(k*10+j+5);q.at(Math.cos(a)*1.44,0,Math.sin(a)*1.44,-a+HP,p=>plate(p,P,0,y0,.98,Math.min(h,4.25-y0),LV.pick(k*10+j),{t:.1,bolts:0,rx:wreck&&j%2?-.3:0}));});
  if(!dead){if(hi){for(let j=0;j<2;j++){const a0=out+Math.PI*(.62+.5*j),pts=[];for(let i=0;i<=4;i++){const a=a0+i*.33*(j?-1:1);pts.push([Math.cos(a)*1.5,2.3+i*.52+.2*hz(sd,k*9+i),Math.sin(a)*1.5]);}vein(q,pts,.075,P.red);}}
   q.halo(0,1.1,0,3.4,WK.PAR.red,.75);q.pool(0,.05,0,2.4,2.4,WK.PAR.red,.45);}};
 [[1,6.4],[-1,6.4],[1,-7.3],[-1,-7.3]].forEach(([s,z],k)=>{
  F(z,q=>{qb(q,s*5.3,2.5,z,1.3,1.7,2,P.ironD,'');});
  if(wreck&&k===0){b.at(9.3,1.42,7.6,.5,q=>q.at(0,-2.9,0,0,r=>pod(r,k,s)),0,HP*1.03);fire(b,P,6.2,.1,6.9,1.2);return;}
  F(z,q=>q.at(s*6.45,0,z,0,r=>pod(r,k,s)));});
 // ---- landing skids ----
 if(!wreck)for(const s of [-1,1]){qb(b,s*2.9,0,-.4,.6,.24,15.4,P.ironD,'');for(const e of [-1,1])face(b,[[s*2.9-.3,.24,-.4+e*7.7],[s*2.9+.3,.24,-.4+e*7.7],[s*2.9+.3,.62,-.4+e*8.5],[s*2.9-.3,.62,-.4+e*8.5]],P.ironD,[s*2.9,2,-.4]);
  for(const z of [-6.6,-.4,5.8]){qb(b,s*2.9,.24,z,.42,.5,1,P.iron,'tb');if(hi){b.tube([s*2.9,.3,z+.5],[s*2.9,.74,z+1.5],.09,P.ironL,{n:4});b.tube([s*2.9,.3,z-.5],[s*2.9,.74,z-1.5],.09,P.ironL,{n:4});}}}
 // ---- the well: hazard lane edges, deck patches, ribs and work lamps on the inner walls ----
 for(const s of [-1,1])for(let k=0;k<(hi?14:7);k++){const n=hi?14:7,z0=-8+k*17.6/n,z1=z0+17.6/n;F((z0+z1)/2,q=>face(q,[[s*3.55,dY+.015,z0],[s*3.05,dY+.015,z0],[s*3.05,dY+.015,z1],[s*3.55,dY+.015,z1]],k%2?P.hazardD:P.hazard,[0,-9,0]));}
 for(let k=0;k<3;k++){const z=-4.6+k*5;F(z,q=>{for(const s of [-1,1])face(q,[[0,dY+.015,z+1.1],[s*1.5,dY+.015,z-.1],[s*1.5,dY+.015,z-.7],[0,dY+.015,z+.5]],wreck?P.iron:tint(LV.stripe===P.blue?P.white:LV.stripe,.7),[0,-9,0]);});}
 if(hi){for(const [x,z,w,d,m] of [[-1.6,-6.2,2.6,2,P.scrap],[1.4,2.3,3,2.4,P.ironD],[-.9,7.6,2.2,1.6,P.rust]])F(z,q=>face(q,[[x-w/2,dY+.012,z-d/2],[x+w/2,dY+.012,z-d/2],[x+w/2,dY+.012,z+d/2],[x-w/2,dY+.012,z+d/2]],m,[0,-9,0]));
  for(const s of [-1,1])for(const z of [-6.4,-3.35,-.3,2.75,5.8])F(z,q=>{const top=z>-3.4&&z<4?5.5:6.2;qb(q,s*3.5,dY,z,.2,top-dY-.1,.26,P.iron,'tb'+(s>0?'r':'l'));if(!wreck)qb(q,s*3.42,top-.75,z,.1,.3,.34,P.lamp,'tb');});}
 // ---- plundered plates on the flanks ----
 [[-9.85,2.2,2.3,2.7],[-9.9,5,2.2,1],[-7.3,4.75,2.3,1.3],[-4.5,3.9,1.9,2.1],[-1.95,3.55,2.1,1.75],[.4,3.6,2.2,1.7],[2.75,3.5,2,1.8],[5.35,4.8,1.6,1.5],[7.2,4.7,1.8,1.6],[9.25,2.2,1.45,2.3],[9.3,4.7,1.4,1.55]].forEach(([z,y,w,h],j)=>{for(const s of [-1,1]){const k=j*2+(s>0?1:0)+200;if(!LV.has(k,.86))continue;
   flank(s,z+(LV.r(k)-.5)*.2,z>8.4?5.25:4.95,p=>plate(p,P,0,y+(LV.r(k+1)-.5)*.16,w,h,LV.patch(k),{t:.1+.1*LV.r(k+2),rz:(LV.r(k+3)-.5)*(wreck?.5:.09),rx:wreck&&LV.r(k+4)<.45?-.35:0}));}});
 // the stripe a crew painted (or a stolen banner draped) along one flank, kill marks by the bridge
 {const s=LV.L%2?1:-1;flank(s,.4,5.09,p=>face(p,[[-3.3,5.02,0],[3.3,5.02,0],[3.3,5.3,0],[-3.3,5.3,0]],LV.stripe,[0,0,-9]));
  flank(-s,-6.9,5.07,p=>{dface(p,[[-.9,6.15,.02],[.9,6.15,.02],[.9,4.6,.1],[-.9,4.6,.1]],LV.flags[0]);dface(p,[[-.9,4.6,.1],[.9,4.6,.1],[.9,3.3,.06],[-.9,3.6,.06]],LV.flags[0]);if(LV.flags[0]===P.flagLDF||hi)face(p,[[-.9,5.2,.12],[.9,5.2,.12],[.9,4.75,.14],[-.9,4.75,.14]],LV.flags[0]===P.flagLDF?P.flagLDF2:P.white,[0,0,-9]);});}
 // ---- loot lashed along both flanks on a bracket shelf ----
 for(const s of [-1,1]){body([{z:-5.6,p:[[s*4.9,1.9],[s*6,2.02],[s*6,2.16],[s*4.9,2.16]]},{z:4.75,p:[[s*4.9,1.9],[s*6,2.02],[s*6,2.16],[s*4.9,2.16]]}],(z,i)=>i===3?null:P.ironD,{a:P.ironD,z:P.ironD});
  [-4.25,-.95,2.6].forEach((z,j)=>{const k=300+j*2+(s>0?1:0),kind=(LV.r(k)*4)|0,c=LV.pick(k+20);flank(s,z,4.95,p=>{
   if(wreck&&LV.r(k+9)<.5)return;
   if(kind===0){crate(p,P,0,2.16,.52,2.7,1.2,.95,c===P.hazard?P.plateSet[1]:c);if(hi)qb(p,.2,3.36,.5,1.2,.7,.8,P.crate,'b');}
   else if(kind===1){crate(p,P,-.75,2.16,.52,1.15,1.1,.95,P.crate);crate(p,P,.6,2.16,.5,1.2,.95,.9,P.crateD,.08);crate(p,P,-.2,3.2,.5,1,.8,.85,P.crate,-.1);}
   else if(kind===2){for(const x of [-.85,0,.85])tank(p,P,x,2.16,.52,.4,1.7);if(hi){qb(p,0,2.9,.5,2.7,.1,.98,P.strap,'');}}
   else{sacks(p,P,0,2.16,.5,hi?6:3,k,.95);if(hi)net(p,P,-1.25,1.25,.05,1.05,2.16,3.15,3,2);else qb(p,0,2.16,.5,2.4,.75,.9,P.sack,'b');}
   if(hi&&!wreck)for(const x of [-1,1])p.tube([x*.95,2.16,1.04],[x*.95,3.75,.02],.035,P.strap,{n:3});});});}
 // ---- the infection: veins along the flank seams and out of the engine roots, growth where pods meet the hull ----
 if(!wreck)for(const s of [-1,1]){const X=s*5.07;
  F(1,q=>{vein(q,crawl([X,3.42,-5.4],[X,3.5,4.6],hi?8:3,.13,sd+s*7),.09,P.red);});
  if(hi){F(-3,q=>vein(q,crawl([X,3.45,-3.2],[X,5.9,-3.4],4,.12,sd+s*3+50,[0,0,1]),.07,P.red));F(1.6,q=>vein(q,crawl([X,3.5,1.6],[X,5.3,1.5],3,.12,sd+s*3+60,[0,0,1]),.065,P.red));
   F(-8,q=>vein(q,crawl([X,4.6,-8.9],[X,6.1,-11],4,.14,sd+s*3+70),.07,P.red));F(6,q=>{nodule(q,P,s*5.05,4.62,5.1,.34);nodule(q,P,s*5.05,4.5,-5.9,.3);});
   F(0,q=>vein(q,crawl([s*3.52,4.9,-8],[s*3.52,3.2,-2.5],5,.2,sd+s*3+80),.06,P.redDim));F(6,q=>vein(q,crawl([s*3.52,5.6,8.3],[s*3.52,2.6,5],4,.2,sd+s*3+90),.06,P.redDim));}}
 if(!wreck&&LV.L%2===1){const s=LV.L%4===1?1:-1,A=[s*3.4,8.05,-8],B=[s*4.4,7,9.3],n=hi?7:4,at=t=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t-2.2*t*(1-t),A[2]+(B[2]-A[2])*t];b.cable(A,B,.55,.03,P.strap,{n:hi?6:3});   // bunting of captured flags
  for(let k=0;k<n;k++){const t=(k+.6)/(n+.2),q=at(t),q2=at(t+.045),m=k%3===0&&LV.flags[0]!==P.flagLDF?P.flagLDF:P.flagSet[(k+LV.L)%5];dface(b,[q,q2,[(q[0]+q2[0])/2,q[1]-.8,(q[2]+q2[2])/2]],m);}}
 if(wreck){fire(b,P,-3.6,1,ZB+.3,1.5);fire(b,P,3.2,.7,ZB-.4,1.1);fire(b,P,.6,.5,5,.9);}
 // ---- the ramp: raised (the whole ship) or fallen open (a wreck) ----
 if(part!=='hull')F(zH,q=>q.at(0,dY,zH+.02,0,r=>haulRamp(r,P,LV,sd),wreck?.02:H.closed,wreck?.07:0));
}
WK.model('par-hauler',hauler,{aoH:3.2,aoMin:.6});

// ------------------------------------------------------------------ par-shuttle -----------------------------------------
// The light scavenger shuttle: a stolen cargo hopper that hovers and drops its raiders from an open belly frame. A stubby
// faceted hull with a dead-glass cockpit, a stub wing carrying two vectoring engine pods (nozzles down in the hover), twin
// canted fins, a net of loot lashed on its back, grab clamps under the belly. y = 0 is the foot of the belly frame.
const SHUT={size:[10.2,4.55,11.7],hoverY:4.5,bay:[0,.5,-.4]};
function shuttle(b,o){const K=b.k,hi=b.hi,wreck=!!o.wreck,sd=(o.seed|0)||1,P=parPal(b,wreck),LV=livery(P,sd,K.tint),ZB=-2.9,R=P.red,Rd=P.redDim,D=P.glassTop;
 // a wreck: the hull lies rolled onto its right pod, the tail snapped off and slewed round, the left pod torn away
 const F=(z,fn)=>!wreck?fn(b):z<ZB?b.at(.9,-1,ZB-.3,.5,q=>q.at(0,0,-ZB,0,fn),-.12,.32):b.at(0,-1.2,0,0,fn,.1,-.2),body=splitter(wreck,ZB,F,P);
 const topF=(x,y,z,fn,ry=0)=>F(z,q=>q.at(x,y,z,ry,fn,-HP)),flank=(s,z,x,fn)=>F(z,q=>q.at(s*x,0,z,s*HP,fn));   // frames: +z up (y toward the stern) / +z outward
 // ---- the hull: tail, cargo body, cockpit, nose ----
 const sec=(z,hw,yb,yt,c=.5,t=.55)=>({z,p:[[-hw+c,yb],[hw-c,yb],[hw,yb+c],[hw,yt-t],[hw-t,yt],[-hw+t,yt],[-hw,yt-t],[-hw,yb+c]]});
 body([sec(-5.3,.8,2.3,3.05,.25,.25),sec(-3.6,1.8,1.35,3.3),sec(2.5,1.8,1.35,3.3),sec(3.7,1.6,1.45,3.2,.5,.75),sec(5,1.05,1.7,2.5,.4,.45),sec(5.7,.55,1.85,2.2,.2,.2)],(z,i)=>{
   if(z>3.7&&z<5&&i>=3&&i<=5)return wreck?P.glassDead:i===4?D:i===3?[Rd,D,D,Rd]:[D,Rd,Rd,D];if(z>2.5&&z<3.7&&(i===3||i===5))return wreck?P.glassDead:i===3?[Rd,D,D,Rd]:[D,Rd,Rd,D];
   return i===0?P.weld:i===1||i===7?P.ironD:i===4?(z>5?LV.main===P.hazard?P.plateMil:LV.main:z<2.5?LV.hull:P.ironL):(i===3||i===5)&&z<2.5&&z>-3.6?LV.hullD:P.iron;},{a:P.ironD,z:P.ironL});
 if(hi)F(4,q=>{for(const s of [-1,1]){q.tube([s*.85,3.3,2.5],[s*.85,3.22,3.7],.06,P.weld,{n:3});q.tube([s*.85,3.2,3.7],[s*.6,2.5,5],.06,P.weld,{n:3});q.tube([s*1.6,2.47,3.7],[s*1.05,2.07,5],.06,P.weld,{n:3});q.tube([s*1.6,2.45,3.7],[s*.85,3.2,3.7],.06,P.weld,{n:3});}q.tube([0,3.2,3.7],[0,2.5,5],.05,P.weld,{n:3});});
 if(!wreck)b.halo(0,3,4.6,1.8,WK.PAR.red,.35);
 // ---- the belly: the open cargo frame with its grab clamps, lit red from the bay ----
 if(!wreck){for(const s of [-1,1]){qb(b,s*1.5,0,-.4,.26,.22,5.9,P.ironD,'');for(const z of [-2.9,-.4,2.1]){b.tube([s*1.5,.2,z],[s*1.64,1.75,z],.09,P.iron,{n:4});
    if(hi){const zc=z+1.2;if(zc<2.2){b.tube([s*1.25,1.38,zc],[s*1.05,.78,zc],.075,P.ironL,{n:4});b.tube([s*1.05,.78,zc],[s*.62,.5,zc],.06,P.ironL,{n:4});b.gem(s*.6,.5,zc,.1,.12,.1,P.gold);}}}}
  for(const z of [-3.3,2.5])qb(b,0,.02,z,3.2,.18,.2,P.ironD,'');
  face(b,[[-1.1,1.33,-3],[1.1,1.33,-3],[1.1,1.33,2.2],[-1.1,1.33,2.2]],P.lamp,[0,9,0]);b.halo(0,.8,-.4,3.2,WK.PAR.red,.5);}
 // ---- the stub wing and the two engine pods ----
 const pod=(q,k,s)=>{const n=hi?12:8,out=s>0?0:Math.PI,hot=wreck?P.weld:P.redHot;
  rev(q,0,0,0,hi?[[0,-1.46],[.8,-1.7],[.9,-1.74],[.85,-1.56],[.6,-1],[1,-.6],[1.02,.55],[.9,.85],[.72,.85],[.66,.55],[.5,.55],[.2,.55],[0,.75]]:[[0,-1.46],[.8,-1.7],[.9,-1.74],[.85,-1.56],[.6,-1],[1,-.6],[1.02,.55],[.86,.85],[.66,.55],[.5,.55],[0,.55]],n,
   sg=>sg===0?(wreck?P.weld:[P.redHot,P.redHot,R,R]):sg<3?hot:sg===3?P.ironD:sg===4?P.ironL:sg===5?LV.cowl:hi?(sg<8?P.gold:sg===8?P.weld:sg===9?(wreck?P.weld:R):sg===10?P.weld:P.ironL):(sg===6?P.gold:sg===7?P.weld:sg===8?(wreck?P.weld:R):P.weld),{smooth:hi});
  [-.95,0,.95].forEach((da,j)=>{if(!LV.has(k*10+j+40,.8))return;const a=out+da;q.at(Math.cos(a)*1.01,0,Math.sin(a)*1.01,-a+HP,p=>plate(p,P,0,-.45+.2*LV.r(k*7+j),.82,.8+.2*LV.r(k*5+j),LV.pick(k*10+j+40),{t:.08,bolts:0,rx:wreck&&j===1?-.4:0}));});
  if(!wreck){if(hi){const pts=[];for(let i=0;i<=4;i++){const a=out+Math.PI*.75+i*.36*(k?1:-1);pts.push([Math.cos(a)*1.05,-.5+i*.3,Math.sin(a)*1.05]);}vein(q,pts,.06,R);}q.halo(0,-1.9,0,2.6,WK.PAR.red,.8);}};
 for(const s of [-1,1]){const k=s>0?0:1;
  F(0,q=>{skin(q,[[[s*1.4,2.72,.9],[s*1.4,2.72,-2.3],[s*1.4,3.14,-2.3],[s*1.4,3.14,.9]],[[s*3.3,2.84,.3],[s*3.3,2.84,-1.9],[s*3.3,3.14,-1.9],[s*3.3,3.14,.3]]],(r,i)=>i===2?P.ironL:i===0?P.ironD:P.iron,{z:P.ironD});
   topF(s*2.35,3.14,-.78,p=>plate(p,P,0,-.8,1.5,1.6,LV.pick(70+k),{t:.06,rz:s*.06}));
   if(LV.L%2===k)topF(s*2.35,3.21,-.78,p=>face(p,[[-.75,-.2,0],[.75,-.2,0],[.75,.2,0],[-.75,.2,0]],LV.stripe,[0,0,-9]));
   q.tube([s*3.1,3,-.75],[s*3.5,3,-.75],.44,P.ironD,{n:hi?8:6,caps:true});});
  if(wreck&&k===1){b.at(-5.6,.98,3,2.2,q=>pod(q,k,s),0,HP*1.02);fire(b,P,-3.1,1.5,-.2,1);continue;}
  F(0,q=>q.at(s*3.95,3,-.75,0,r=>pod(r,k,s),.07,s*.09));}
 // ---- twin fins, the stern nozzle ----
 for(const s of [-1,1])F(-4,q=>{skin(q,[[[s*.9,3,-3.15],[s*1.08,3,-3.15],[s*1.08,2.9,-5.15],[s*.9,2.9,-5.15]],[[s*1.52,4.4,-4.55],[s*1.64,4.4,-4.55],[s*1.64,4.4,-5.7],[s*1.52,4.4,-5.7]]],(r,i)=>i===1||i===3?(s>0?LV.main===P.hazard?P.rust:LV.main:LV.second):P.iron,{z:P.ironL});
   if(hi&&s>0)face(q,[[1.37,3.78,-3.98],[1.47,4.02,-4.26],[1.47,4.02,-5.45],[1.37,3.78,-5.38]],LV.stripe,[0,4,-4.5]);});
 F(-5,q=>q.at(0,2.68,-5.25,0,t=>rev(t,0,0,0,[[.5,0],[.64,.42],[.58,.6],[.47,.6],[.4,.14],[0,.14]],hi?10:6,sg=>sg===4?(wreck?P.weld:[P.redHot,P.redHot,R,R]):sg===3?(wreck?P.weld:P.lamp):sg===2?P.ironL:P.ironD,{smooth:hi}),-HP));
 // ---- plundered plates: the brow, the nose, the flanks; kill marks under the side window ----
 topF(0,3.3,3.1,p=>plate(p,P,0,-.5,1.5,1,LV.pick(81),{t:.07}));
 [[1.55,1.5],[-.5,1.9],[-2.6,1.4]].forEach(([z,w],j)=>{for(const s of [-1,1]){const k=90+j*2+(s>0?1:0);if(LV.has(k,.82))flank(s,z,1.8,p=>plate(p,P,0,1.88+.06*LV.r(k),w,.84,LV.pick(k),{t:.08,rz:(LV.r(k+3)-.5)*(wreck?.5:.1),rx:wreck&&j===1?-.4:0}));}});
 if(hi&&!wreck)flank(-1,3.1,1.62,p=>{for(let i=0;i<5;i++)face(p,[[-.4+i*.17,2,.03],[-.33+i*.17,2,.03],[-.33+i*.17,2.36,.03],[-.4+i*.17,2.36,.03]],P.white,[0,0,-9]);});
 // ---- the loot on its back: crates, a tank, sacks under a cargo net; a trophy flag behind the cockpit ----
 F(0,q=>{const c=LV.pick(110),v=sd%3;
  if(wreck){crate(q,P,-.4,3.3,.6,1.2,.7,1,P.crate,.2);b.at(3.4,0,3.6,.7,g=>{crate(g,P,0,0,0,1.1,.7,.9,P.crate,.3);sacks(g,P,1.3,0,.6,3,sd,.6);});return;}
  crate(q,P,v===1?.5:-.45,3.3,.75,1.25,.72,1,c===P.hazard?P.plateSet[1]:c,.12);crate(q,P,v===1?-.55:.55,3.3,v===2?-1.5:-.3,.95,.6,.9,P.crate,-.2);if(hi)crate(q,P,v===1?.4:-.4,4.02,.7,.7,.42,.7,P.crateD,.4);
  if(v!==2)tank(q,P,v===1?-.7:.75,3.3,1.05,.3,.95);sacks(q,P,v===2?.3:-.15,3.3,v===2?-.3:-1.5,hi?6:3,sd+5,.75);
  if(hi)net(q,P,-1.2,1.2,-2.4,.3,3.3,4.05,3,3);else qb(q,0,3.3,-1.3,1.9,.5,1.8,P.net,'b');
  if(hi)for(const s of [-1,1])for(const z of [-2,1.2])q.tube([s*1.8,2.7,z],[s*.7,3.6,z],.035,P.strap,{n:3});
  q.at(-.95,3.3,2.05,HP,f=>flag(f,1.15,1,.55,LV.flags[0],{pole:P.ironL,m2:LV.flags[0]===P.flagLDF?P.flagLDF2:null,torn:true,sag:.2,r:.035}));});
 // ---- the infection ----
 if(!wreck){F(3,q=>{vein(q,crawl([.7,3.34,2.5],[.4,3.34,-.2],hi?4:2,.14,sd+3,[1,0,0]),.06,R);});
  if(hi)for(const s of [-1,1]){F(0,q=>{vein(q,crawl([s*1.84,2.8,2.4],[s*1.84,1.9,.3],4,.12,sd+s+9),.055,R);vein(q,crawl([s*1.84,1.86,-1.6],[s*1.84,2.75,-3.3],4,.1,sd+s+19),.055,R);nodule(q,P,s*1.45,3.2,.5,.26);});}}
 if(wreck){fire(b,P,.3,1.5,ZB+.2,1.1);fire(b,P,-1,.4,2.6,.8);}
}
WK.model('par-shuttle',shuttle,{aoH:1.6,aoMin:.72});

// ------------------------------------------------------------------ portal-gate -----------------------------------------
// The Parasites' portal (16 x 14 x 6): a great ring of twelve mismatched plundered segments (no two alike in size or paint,
// a gilded keystone on top) cradled in a ramped plinth between two leaning piers with braces. Capacitor banks and their
// cables feed it, loot is stacked at its feet, trophy banners hang down the piers. The infection lives in the ring: every
// seam between two segments glows red and veins creep across the faces.
// o.state: 'dormant' (the ring dark but alive: a web of veins across the opening around an ember), 'open' (a red event
// surface, a hot rim round a deep core, arcs between the hot emitters), 'suppressed' (four LDF damper clamps locked on the
// ring, their lock beams crossing the opening into a cyan hub; veins dim, emitters dead, the ring scorched).
// 5E-2d2 critic round 2: (a) DORMANT is asleep: every glow on it is a steady, dim red (it looked as awake as the open gate:
// the seams, veins and lamps pulsed at full strength) and the ember is at 30%; the style breathes the ember's halo every
// 4 s. (b) OPEN no longer burns out: its colours are pre-scaled for the solid shader's 2.3x glow gain like every other
// Parasite glow (the rim was an unscaled near-white) and its halos are a third of what they were. (c) The swirl is no
// longer part of this model: the style draws it as two glow layers that turn against each other (style.js S.warScenery),
// over the static surface here. (d) The piers' four black raking poles read as thorns: they are steel cable stays now,
// each with a turnbuckle, on a hazard-painted anchor block.
const PORT={size:[16,14.6,6.2],cy:6.5,rIn:4.95};
function portal(b,o){const K=b.k,{tint,glow,col}=K,hi=b.hi,P=parPal(b,false),M=K.pal.mil,st=o.state==='open'?'open':o.state==='suppressed'?'sup':'dorm',open=st==='open',sup=st==='sup',dorm=st==='dorm',cy=PORT.cy,r0=PORT.rIn,sd=(o.seed|0)||1,D=Math.PI/180;
 const lampM=dorm?P.redDim:P.red,seamM=open?P.redHot:sup?P.redLow:P.redDim,veinM=open?P.red:P.redLow,emM=open?P.redHot:sup?P.weld:P.redLow,capM=open?P.redHot:sup?P.weld:P.redLow,sc=m=>sup?tint(m,.58):m;   // dormant: steady and dim (P.redDim / redLow never pulse)
 const RP=(a,r,z)=>[Math.cos(a)*r,cy+Math.sin(a)*r,z],ang=(a,fn)=>b.at(0,cy,0,0,fn,0,a-HP);   // ring coordinates; a frame whose +y is the ring's radius at angle a
 // ---- the ring: twelve stolen segments ----
 const S=P.plateSet,SEG=[[P.iron,P.ironL,6.5,.8],[P.rust,P.scrap,6.35,.7],[P.plateMil,P.blue,6.6,.85],[P.iron,S[2],6.45,.76],[S[1],P.white,6.3,.66],[P.hazard,P.hazardD,6.55,.8],[P.gold,P.goldD,6.75,.95],[S[0],P.white,6.4,.7],[P.plateMilD,P.plateMil,6.6,.85],[P.iron,S[4],6.45,.76],[S[2],P.rust,6.3,.68],[P.scrap,P.ironL,6.5,.8]];
 SEG.forEach(([m,m2,r1,d],k)=>{const ac=(-90+k*30)*D,a0=ac-13.8*D,a1=ac+13.8*D,c=hi?.16:0,pr=[[r0,-d],[r1-c,-d],[r1,-d+c],[r1,d-c],[r1-c,d],[r0,d]],ring=a=>pr.map(([r,z])=>RP(a,r,z)),gold=m===P.gold,fm=gold?m:sc(m),ed=gold?P.goldD:sc(tint(m,1.25,.01));
  skin(b,hi?[ring(a0),ring(ac),ring(a1)]:[ring(a0),ring(a1)],(r,i)=>i===5?(sup?P.weld:P.ironD):i===1||i===3?(hi?ed:null):i===2?sc(tint(m,.8)):fm,{a:P.weld,z:P.weld});
  // a second-colour panel on both faces (a hazard segment is striped), a rib across the outer face
  for(const f of [1,-1]){const z=f*(d+.03),w=a=>[RP(ac+a*D,r0+.3,z),RP(ac+a*D,r1-.5,z)];
   if(m===P.hazard){for(let j=-3;j<3;j++)if(j%2){const A=w(j*3.6),B=w((j+1)*3.6);face(b,[A[0],B[0],B[1],A[1]],m2,[0,cy,0]);}}
   else if(k!==0){const A=w(hi?-9:-10),B=w(k%3===1?2:9);face(b,[A[0],B[0],B[1],A[1]],gold?P.goldD:sc(m2),[0,cy,-f*9]);
    if(hi&&!gold)b.detail(()=>{for(const a of [-11.5,11.5])for(const r of [r0+.5,r1-.6]){const q=RP(ac+a*D,r,f*(d+.04));qb(b,q[0],q[1]-.06,q[2],.12,.12,.04,P.weld,'');}});}}
  if(hi&&k%2===1)ang(ac,p=>qb(p,0,r1-.02,0,.5,.14,d*2+.16,sc(P.ironL),'b'));});
 // ---- the seams: the infection glows between every two segments; veins creep from them across both faces ----
 for(let k=0;k<12;k++){const a=(-75+k*30)*D;if(k===0||k===11)continue;ang(a,p=>qb(p,0,r0+.04,0,.34,1.3,1.16,seamM,'blr'));
  if(open||!sup||k%2)for(const f of [1,-1]){if(!hi&&f<0)continue;const dir=(k+(f>0?0:1))%2?1:-1,z=f*.92,h=q=>hz(sd+k*13+(f>0?0:7),q),pts=[RP(a,r0+.25,z*.8)];for(let i=1;i<=(hi?4:2);i++)pts.push(RP(a+dir*i*(hi?4.2:8)*D,r0+.3+(hi?.26:.5)*i+.2*h(i),z+f*.02));vein(b,pts,sup?.06:.085,veinM);
   if(hi&&k%3===0&&!sup){const q=pts[2];vein(b,[q,RP(a+dir*10*D,r0+.35+.3*h(9),z),RP(a+dir*15*D,r0+.2,z*.9)],.055,open?P.red:P.redLow);}}}
 // ---- the emitters on the inner face, the keystone's crest ----
 for(const a of [30,90,150,210,330]){ang(a*D,p=>{skin(p,[[[-.42,r0+.05,-.34],[.42,r0+.05,-.34],[.42,r0+.05,.34],[-.42,r0+.05,.34]],[[-.16,r0-.62,-.16],[.16,r0-.62,-.16],[.16,r0-.62,.16],[-.16,r0-.62,.16]]],sup?P.weld:P.ironL,{z:emM});p.gem(0,r0-.72,0,.17,.24,.17,emM);});
  if(open){const q=RP(a*D,r0-.75,0);b.halo(q[0],q[1],q[2],1.2,WK.PAR.red,.3);}}
 b.at(0,cy+6.72,0,0,q=>{qb(q,0,0,0,2.2,.36,1.5,P.gold,'b');qb(q,0,.36,0,1.1,.4,1,P.goldD,'b');q.gem(0,1,0,.2,.26,.2,sup?P.weld:lampM);
  for(const s of [-1,1])q.at(s*.95,.3,0,s>0?0:Math.PI,f=>flag(f,.92,1.05,.6,s>0?P.flagSet[1]:P.flagLDF,{pole:P.ironL,m2:s>0?null:P.flagLDF2,torn:true,sag:.3,r:.04}),0,-s*.0);});
 // ---- the cradle: a plinth with a tread ramp up each side to the ring's lip, hazard lane edges ----
 skin(b,[-5.8,5.8].map(x=>[[x,-.4,-2.95],[x,-.4,2.95],[x,.5,2.95],[x,1.52,1.15],[x,1.52,-1.15],[x,.5,-2.95]]),(r,i)=>i===0?null:i===3?P.deck:i===2||i===4?P.tread:P.ironD,{a:P.ironD,z:P.ironD});
 for(const f of [1,-1]){for(const s of [-1,1])for(let j=0;j<(hi?4:2);j++){const n=hi?4:2,t0=j/n,t1=(j+1)/n,A=(t,x)=>[x,.52+1.02*t,f*(2.95-1.8*t)];face(b,[A(t0,s*2.9),A(t0,s*2.5),A(t1,s*2.5),A(t1,s*2.9)],j%2?P.hazardD:P.hazard,[0,-9,0]);}
  if(hi)for(let j=1;j<5;j++){const t=j/5;b.at(0,.5+1.02*t,f*(2.95-1.8*t),0,q=>qb(q,0,0,0,4.6,.07,.14,P.ironD,'b'),-f*.52);}}
 // ---- the two piers: stacked plundered blocks leaning on the ring, clamp brackets, braces, a trophy banner down the front ----
 for(const s of [-1,1]){const R=(y,xi,xo,zh)=>({y,p:[[s*xi,-zh],[s*xo,-zh],[s*xo,zh],[s*xi,zh]]}),pm=[P.iron,s>0?P.plateMilD:P.rust,P.ironL,P.iron];
  yloft(b,[R(-.4,5.5,8,1.5),R(1.1,5.6,7.95,1.45),R(1.1,5.75,7.8,1.3),R(3.4,5.9,7.75,1.2),R(3.4,6.02,7.62,1.08),R(6.5,6.2,7.6,1),R(6.5,6.1,7.7,1.1),R(8.7,5.95,7.3,.95)],(r,i)=>r%2?P.weld:pm[r>>1],{z:P.ironL});
  for(const [y,xi] of [[4.5,5.2],[8.1,5.6]]){qb(b,s*(xi+.75),y-.34,0,1.6,.68,hi?2.5:2.3,sc(P.ironL),'');if(hi)for(const f of [1,-1])qb(b,s*(xi+.6),y-.2,f*1.27,.9,.4,.06,P.gold,'kf'.replace(f>0?'f':'k',''));}
  // cable stays (critic round 2: the black raking poles here read as thorns): a taut steel cable from a lug on the pier down to
  // a hazard-painted anchor block, a turnbuckle a third of the way up
  for(const f of [1,-1]){const A=[s*7.35,.14,f*2.8],B=[s*6.95,6.7,f*.95];b.tube(A,B,.055,P.ironL,{n:hi?4:3});qb(b,s*7.35,-.3,f*2.75,1.1,.44,.6,P.hazard,'b');
   if(hi){const T0=L3(A,B,.3),T1=L3(A,B,.4);b.tube(T0,T1,.12,P.gold,{n:5});qb(b,s*7.35,.14,f*2.8,.3,.26,.3,P.ironD,'b');qb(b,B[0],B[1]-.12,B[2],.4,.24,.3,P.ironD,'');qb(b,s*7.35,-.3,f*2.75,.5,.45,.62,P.hazardD,'b');}}
  qb(b,s*6.6,8.7,0,.5,.3,.5,sup?P.weld:lampM,'b');if(!sup)b.halo(s*6.6,9.1,0,dorm?1:1.2,WK.PAR.red,dorm?.18:.3);
  // plundered plates on the outer face, the banner on the face that looks at the visitor
  b.at(s*7.72,0,0,s*HP,p=>{plate(p,P,0,1.3,1.9,1.8,s>0?P.plateMil:S[1],{t:.1,rz:.04});plate(p,P,.1,3.7,1.5,2.3,s>0?P.hazard:S[3],{t:.1,rz:-.05});},0,0);
  for(const f of [1,-1]){const z=f*1.14,bm=f*s>0?P.flagLDF:P.flagSet[f>0?3:0],x=s*6.85,w=.62;b.tube([x-.8,8.25,z+f*.1],[x+.8,8.25,z+f*.1],.05,P.ironL,{n:4});
   const y1=5.9,y2=4.3,zz=z+f*.08;dface(b,[[x-w,8.2,zz],[x+w,8.2,zz],[x+w,y1,zz+f*.1],[x-w,y1,zz+f*.1]],bm);
   if(bm===P.flagLDF)face(b,[[x-w,7.5,zz+f*.03],[x+w,7.5,zz+f*.03],[x+w,6.9,zz+f*.06],[x-w,6.9,zz+f*.06]],P.flagLDF2,[x,7,0]);
   dface(b,[[x-w,y1,zz+f*.1],[x,y1,zz+f*.1],[x-.1,y2+.5,zz+f*.04],[x-w,y2,zz+f*.04]],bm);dface(b,[[x,y1,zz+f*.1],[x+w,y1,zz+f*.1],[x+w,y2+.3,zz+f*.04],[x+.15,y2+.9,zz+f*.04]],bm);}}
 // ---- capacitor banks on the plinth's shoulders, their cables up into the ring; loot at the other feet ----
 for(const f of [1,-1]){const sx=f,bx=sx*4.1,bz=f*2.05;qb(b,bx,.2,bz,2.9,1.02,1.5,P.ironD,'b');if(hi)qb(b,bx,1.22,bz,3.05,.1,1.62,P.ironL,'b');
  for(let j=0;j<3;j++){const x=bx+(j-1)*.9,n=hi?8:6;rev(b,x,1.3,bz,hi?[[.38,0],[.38,.4],[.43,.4],[.43,.56],[.38,.56],[.38,1],[.43,1],[.43,1.16],[.38,1.16],[.38,1.5],[.26,1.72],[0,1.72]]:[[.38,0],[.38,1.5],[.26,1.72],[0,1.72]],n,sg=>hi?(sg===2||sg===6?P.gold:sg===10?capM:sg===9?P.ironL:P.plateMilD):(sg===2?capM:P.plateMilD),{smooth:hi});
   if(!sup)b.halo(x,3.2,bz,.9,WK.PAR.red,open?.35:.1);
   if(hi||j===1){const a=(f>0?-52:232)*D+(j-1)*.07*f,q=RP(a,6.45+.1*j,f*.5);b.cable([x,3,bz],q,1.1+.3*j,.09,P.strap,{n:hi?5:3});}}
  {const a=(f>0?-52:232)*D;ang(a,p=>{qb(p,0,6.25,f*.45,1.3,.5,.9,P.ironD,'b');qb(p,0,6.75,f*.45,.5,.08,.4,sup?M.cyan:lampM,'b');});}
  // loot
  const lx=-sx*4.2,lz=f*2.1;crate(b,P,lx,.36,lz,1.5,1,1.2,P.crate,.15*f);crate(b,P,lx+sx*.2,1.36,lz,1,.75,.95,P.crateD,-.2);if(hi){crate(b,P,lx-sx*1.5,.1,lz+f*.3,1.1,.8,1,S[f>0?1:0],.4);tank(b,P,lx+sx*1.25,.2,lz+f*.35,.36,1.5);sacks(b,P,lx-sx*.3,0,f*2.3,4,7+f,.5);}}
 // ---- the opening ----
 if(dorm){   // dormant: a web of veins strung across the opening around a sleeping ember (30%: tint(P.redDim, .47) is 30% of P.red; its halo is the style's, which breathes it)
  const nV=hi?7:4;for(let k=0;k<nV;k++){const a=(20+k*360/nV+30*hz(sd,k+60))*D,pts=[RP(a,r0-.05,0)],n=hi?4:2;for(let i=1;i<=n;i++){const t=i/n,rr=(r0-.2)*(1-t)+.3*t,aa=a+(hz(sd,k*7+i)-.5)*.5*(1-t);pts.push(RP(aa,rr,(hz(sd,k*5+i+30)-.5)*.5*(1-t)));}vein(b,pts,.085,k%2?P.redDim:P.redLow);
   if(hi){const q=pts[2],a2=a+(k%2?1:-1)*.5;vein(b,[q,RP((a+a2)/2,r0*.72,.1),RP(a2,r0-.1,0)],.05,P.redLow);}}
  blob(b,0,cy,0,.5,.5,.42,P.growth);b.gem(0,cy,0,.34,.42,.34,tint(P.redDim,.47));b.pool(0,1.6,0,2.4,1,WK.PAR.red,.1);}
 if(open){   // open: the event surface (steady glow: a deep core, the Parasite red, a hot pulsing rim; the turning swirl over it is the style's two glow layers), arcs between the emitters
  const sg=(hex,k)=>({c:col(hex).map(v=>v*k),a:1,j:0}),deep=sg(WK.PAR.deep,.12),mid=sg(WK.PAR.red,.3),hotS=sg(WK.PAR.hot,.5),n=hi?24:12,g=(m0,m1)=>[m0,m0,m1,m1],prof=[[r0+.02,.05],[4.72,.08],[4.5,.1],[3.3,.2],[1.7,.27],[0,.3]];
  for(const f of [1,-1])b.at(0,cy,0,0,q=>rev(q,0,0,0,prof,n,sg2=>sg2===0?P.redHot:sg2===1?g(hotS,mid):sg2===2?g(mid,deep):g(deep,deep),{rot:.1}),f*HP);
  const E=[30,90,150,210,330];for(let k=0;k<E.length;k++){const a=E[k]*D,c=E[(k+1)%E.length]*D+(k===E.length-1?TAU:0),pts=[];for(let i=0;i<=(hi?5:2);i++){const t=i/(hi?5:2);pts.push(RP(a+(c-a)*t,r0-.7-.5*Math.sin(t*Math.PI)*(.5+hz(sd,k*9+i)),(hz(sd,k*4+i)-.5)*.9));}for(let i=1;i<pts.length;i++)b.tube(pts[i-1],pts[i],.07,P.redHot,{n:3});}
  b.halo(0,cy,0,7,WK.PAR.red,.16);b.pool(0,.1,3.6,6,3,WK.PAR.red,.26);b.pool(0,.1,-3.6,6,3,WK.PAR.red,.26);}
 if(sup){   // suppressed: four LDF damper clamps on the ring, lock beams into a hub; cyan says who switched it off
  for(const a of [45,135,225,315])ang(a*D,p=>{const r1=6.95;qb(p,0,r0-.2,0,1.7,r1-r0+.2,2.2,M.hull2,'');
   for(const f of [1,-1]){qb(p,0,r0+.15,f*1.13,1.3,1.5,.08,M.plate,f>0?'k':'f');qb(p,0,r0+.62,f*1.18,.92,.2,.05,M.cyan,f>0?'k':'f');if(hi){qb(p,0,r0+1.75,f*1.13,1.5,.12,.06,M.gold,f>0?'k':'f');for(const x of [-.72,.72])qb(p,x,r0-.2,f*1.02,.14,r1-r0+.2,.18,M.hull,f>0?'k':'f');}}
   qb(p,0,r1,0,1.1,.16,1.5,M.plate,'b');qb(p,0,r1+.16,0,.3,.26,.3,M.cyan,'b');p.halo(0,r1+.5,0,1.5,0x22e6ff,.8);
   // the lock beam down to the hub
   qb(p,0,1,0,.42,r0-1.2,.42,M.hull,'tb');for(const f of [1,-1])qb(p,0,1.3,f*.22,.14,r0-2,.03,M.cyan,f>0?'k':'f');if(hi)for(const y of [2.2,3.5])qb(p,0,y,0,.6,.3,.6,M.plate2,'');});
  for(const f of [1,-1])b.at(0,cy,0,0,q=>rev(q,0,0,0,[[1.3,0],[1.3,.3],[1.12,.42],[.62,.42],[.52,.47],[0,.47]],8,sg=>sg===2?M.plate:sg===3?M.gold:sg>=4?M.cyan:M.hull2,{rot:Math.PI/8}),f*HP);
  b.halo(0,cy,1,2.2,0x22e6ff,.4);b.halo(0,cy,-1,2.2,0x22e6ff,.4);
  // scorch fans on the ring's inner face where the emitters burnt out
  if(hi)for(const a of [30,90,150,210,330])for(const f of [1,-1]){const A=RP((a-7)*D,r0+.02,f*.99),B=RP((a+7)*D,r0+.02,f*.99),C=RP((a+3)*D,r0+1,f*.99),E=RP((a-3)*D,r0+1,f*.99);face(b,[A,B,C,E],P.weld,[0,cy,-f*9]);}}
}
WK.model('portal-gate',portal,{aoH:5,aoMin:.6});

// ------------------------------------------------------------------ ldf-post --------------------------------------------
// A Lunar Defense Force field post (8 x 12 x 8, the front toward +z): the humans' own forward emplacement, and the human
// world is BLUE: blue armour on the blast shields, blue roofs, blue-and-white markings (5E-2d2 critic round 2: the posts
// were gunmetal, white and amber with almost no blue, "one kit rearranged", and vanished among the Refuge's buildings).
// Every post has the same SIGNATURE: an armoured pad with cyan corner lights, a ring of leaning blue blast shields, and one
// tall white-and-blue mast in a back corner that flies the LDF flag (1.5x its old size) under a lighthouse lantern; the
// style sweeps a blue searchlight from that lantern (ConquestWarModels.ldf.light(seed) = where it is).
// And every post has its own HERO module, so the nine posts of the world are nine designs (o.seed 1 .. 9, in the order of
// the style's WAR_SCENERY.posts):
//   1 AID POST (the Refuge)             a field aid tent with the medics' blue cross, a comms dish
//   2 TANK RACK (the oxygen complex)    three tall oxygen tanks in a steel rack under a blue manifold, a beam lance
//   3 CHECKPOINT (the viaduct, east)    a striped boom barrier across the front, the guard booth, concrete barriers, a twin gun
//   4 RADAR (the viaduct, west)         a big search radar on its equipment hut, a missile rack
//   5 HEAVY GUN (the Command Base)      a long-barrelled heavy gun in a blue gun house, its shells racked beside it
//   6 SHIELD WALL (the frontier wall)   a section of armoured wall between field pylons, a firing step, a missile rack behind
//   7 RELAY (the corridor pylon)        a lattice relay tower with two relay drums and a glowing insulator stack, a beam lance
//   8 DRILL RIG (the ice mine)          a derrick over a drill floor, an ice core rack, a melt tank
//   9 FLOODLIGHT GANTRY (the dam)       a gantry across the pad with four floodlights, a field gun under it
// Odd designs are mirrored, and every seed deals its own crates.
const LDF={size:[8,12,8],variants:9,padY:.22,mast:[-2.85,-2.85],lightY:10.1},ldfV=sd=>(((sd|0)||1)-1)%9,ldfMir=sd=>ldfV(sd)%2?-1:1;
function ldfPost(b,o){const K=b.k,{mat,rect}=K,T=K.T,M=K.pal.mil,hi=b.hi,sd=(o.seed|0)||1,V=(ldfV(sd)+9)%9,mir=ldfMir(sd),PY=LDF.padY,D=Math.PI/180,
  bagM=mat(0xb3a982,'cloth',0,.12),bagD=mat(0x968c68,'cloth',0,.12),WH=0xe8f6ff,CY=0x22e6ff,
  BL=mat(0x2f6fd6,'paint',.25),BLd=mat(0x1c4594,'paint',.3),BLl=mat(0x6aa6f2,'paint',.15),WP=mat(0xdde5ee,'paint',.25),flB=mat(0x2f7fe6,'cloth',0),flW=mat(0xe9f0f7,'cloth',0),cv=mat(0xd6dde4,'cloth',0,.05),cvD=mat(0xaab4be,'cloth',0,.05),   // the LDF's blue and white (round 2)
  BLc=mat(0x2f6fd6,'paint',0),   // the same blue with no wear, for one big flat face (5E-2d2 critic round 2: the radar's 3.8 m back showed the paint's wear as one rust-red blotch, which read as blood or infection on a human post)
  R=(w,d,y,ch=.14,cx=0,cz=0)=>({p:rect(w,d,hi?ch:0,cx,cz),y}),put=(x,z,ry,fn)=>b.at(mir*x,PY,z,mir*ry,fn),fly=s=>s*mir>0?0:Math.PI;   // fly(s): the yaw that sends a flag toward world x = s (mirrored with the layout)
 // ---- the pad ----
 b.loft([{p:rect(7.8,7.8,1.3),y:-.5},{p:rect(7.8,7.8,1.3),y:.1},{p:rect(7.5,7.5,1.2),y:PY}],r=>r?BLd:M.hull2,{topMat:M.conc});
 for(const sx of [-1,1])for(const sz of [-1,1])face(b,[[sx*2.75,PY+.012,sz*3.6],[sx*3.6,PY+.012,sz*2.75],[sx*3.48,PY+.012,sz*2.63],[sx*2.63,PY+.012,sz*3.48]],M.cyan,[0,-9,0]);
 // ---- the parts ----
 // a blast shield (frame: +z outward): a footing, a leaning gunmetal frame with a gold cap, a pale ceramic plate, a cyan slit
 const bar=(q,w,h=1.5)=>{const hw=w/2,yb=.24;qb(q,0,0,.03,w,yb,.94,M.hull2,'b');
  skin(q,[[[-hw,yb,-.34],[hw,yb,-.34],[hw,yb,.42],[-hw,yb,.42]],[[-hw+.05,h,-.2],[hw-.05,h,-.2],[hw-.05,h,.02],[-hw+.05,h,.02]]],(r,i)=>i===0?M.hull:M.hull2,{z:WP});
  q.at(0,yb,.42,0,p=>{const sl=Math.hypot(h-yb,.4);if(hi)p.bev(0,.07,.03,w-.3,sl*.86,.07,BL,{ch:.035});else qb(p,0,.07,.03,w-.3,sl*.86,.06,BL,'kb');qb(p,0,sl*.66,.08,w*.5,.1,.03,M.cyan,'kb');qb(p,0,sl*.36,.08,w-.5,.12,.03,WP,'kb');
   if(hi)for(const s of [-1,1])qb(p,s*(hw-.3),.14,.08,.09,sl*.42,.04,M.hull2,'kb');},-Math.atan(.4/(h-yb)));};
 const ring=(angs,cz=.1,Rr=3.1,w=1.9)=>angs.forEach(a=>put(Math.sin(a*D)*Rr,cz+Math.cos(a*D)*Rr,a*D,q=>bar(q,w)));
 // sandbags along the frame's x (LOW: stepped courses)
 const bag=(q,x,y,z,yaw,m)=>q.at(x,y,z,yaw,g=>g.loft([{p:rect(.5,.26),y:0},{p:rect(.64,.4),y:.1},{p:rect(.5,.26),y:.21}],m));
 const bags=(q,len,rows,k)=>{for(let r=0;r<rows;r++){const L=len-r*.66;if(!hi){qb(q,0,r*.2,0,L,.21,.4-r*.04,r%2?bagD:bagM,'b');continue;}const n=Math.max(1,Math.round(L/.66));
   for(let i=0;i<n;i++)bag(q,(i-(n-1)/2)*.66,r*.2,(hz(sd,k+r*9+i)-.5)*.07,(hz(sd,k+i*3+r+20)-.5)*.22,(i+r)%3===1?bagD:bagM);}};
 // supplies: a banded crate, a canister
 const box=(q,x,y,z,w,h,d,ry,m,band)=>q.at(x,y,z,ry,c=>{if(hi){c.bev(0,0,0,w,h,d,m,{ch:.04});qb(c,0,h*.56,0,w+.02,.09,d+.02,band,'tb');}else qb(c,0,0,0,w,h,d,m,'b');});
 const can=(q,x,z,h=.66)=>{q.cyl(x,0,z,.2,h,M.plate2,{n:hi?8:5,bev:.04});if(hi)q.cyl(x,h*.5,z,.215,.08,BL,{n:8,top:false});};
 const stock=(q,k)=>{const cm=[M.plate2,M.hull,M.plate,M.hull2],bm=[BL,M.cyan,WP,BL],h=j=>hz(sd,k+j),a=(h(1)*4)|0,c=(h(2)*4)|0;
  box(q,-.5,0,0,1.15,.66,.8,(h(3)-.5)*.3,cm[a],bm[a]);box(q,.62,0,.05,.8,.52,.7,(h(4)-.5)*.5,cm[c],bm[c]);if(h(5)<.6)box(q,-.42,.66,0,.7,.42,.6,(h(6)-.5)*.6,cm[(a+2)%4],bm[(a+1)%4]);else can(q,-.1,.72,.56);
  if(hi||h(7)<.5){can(q,1.3,.2);if(hi&&h(8)<.6)can(q,1.36,-.3,.56);}};
 // the guard booth (door toward +z): gunmetal below, a lit window band, pale ceramic above, a gold cornice
 const booth=q=>{q.loft([R(2.3,2.1,0),R(2.3,2.1,.28)],M.hull2,{top:false});q.loft([R(2.1,1.9,.28),R(2.04,1.84,1.5)],M.hull,{top:false});q.loft([R(1.98,1.78,1.5),R(1.98,1.78,1.98)],M.dark,{top:false});
  q.loft([R(2.1,1.9,1.98),R(2.02,1.82,2.5)],BL,{top:false,bot:hi});q.loft([R(2.5,2.3,2.5),R(2.5,2.3,2.62)],WP,{top:false,bot:hi});q.loft([R(2.5,2.3,2.62),R(1.8,1.6,2.9)],BLd,{topMat:BL});
  for(const s of [-1,1])face(q,[[s*1,1.6,-.62],[s*1,1.6,.62],[s*1,1.9,.62],[s*1,1.9,-.62]],M.ice,[0,1.7,0]);
  face(q,[[-.72,1.6,.9],[.72,1.6,.9],[.72,1.9,.9],[-.72,1.9,.9]],M.ice,[0,1.7,0]);face(q,[[-.5,1.64,-.9],[.5,1.64,-.9],[.5,1.86,-.9],[-.5,1.86,-.9]],M.cyan,[0,1.7,0]);
  qb(q,0,.28,.95,.82,1.2,.06,M.dark,'kb');q.halo(0,1.75,1.2,1.2,0xa8f8ff,.2);
  if(hi){for(const s of [-1,1]){qb(q,s*.5,.28,.95,.1,1.24,.08,M.trim,'kb');q.at(s*1.06,.5,0,s*HP,p=>p.bev(0,0,0,1.25,.8,.07,M.plate2,{ch:.035}));}qb(q,.24,.8,.96,.08,.2,.03,M.cyan,'kb');qb(q,0,.06,1.2,1.1,.1,.5,M.hull2,'b');
   q.bev(.35,2.9,-.2,.6,.2,.5,M.trim,{ch:.04});q.tube([-.6,2.8,-.5],[-.68,4.05,-.58],.02,M.bare,{n:3});q.gem(-.68,4.08,-.58,.04,.06,.04,M.cyan);}};
 // the LDF flag (blue, a pale stripe) flying from height h of whatever stands at the frame's origin
 const flg=(q,h,ry)=>q.at(0,0,0,ry,f=>flag(f,h,2.25,1.3,flB,{m2:flW,sag:.08,ph:sd}));   // 1.5x (round 2)
 // a roof: a flat blue armoured slab on four posts (front edge lower)
 const slab=(q,w,d,h)=>{const px=w/2-.22,pz=d/2-.26,tl=.13;for(const sx of [-1,1])for(const sz of [-1,1]){q.tube([sx*px,0,sz*pz],[sx*px,h-sz*pz*tl+.03,sz*pz],.075,M.trim,{n:4});if(hi)qb(q,sx*px,0,sz*pz,.3,.1,.3,M.hull2,'b');}
  q.at(0,h,0,0,r=>{r.bev(0,0,0,w,.16,d,BLd,{ch:.06});for(const s of [-1,1])if(hi)r.bev(s*w*.25,.16,-.04,w*.43,.07,d*.8,BL,{ch:.03});else qb(r,s*w*.25,.16,-.04,w*.43,.06,d*.8,BL,'b');
   qb(r,0,-.03,d/2+.03,w+.04,.22,.06,WP,'k');face(r,[[-w*.36,-.012,d*.16],[w*.36,-.012,d*.16],[w*.36,-.012,d*.3],[-w*.36,-.012,d*.3]],M.ice,[0,9,0]);
   if(hi)for(const s of [-1,1])r.tube([s*px,-.05,-pz],[s*px,-.05,pz],.045,M.trim,{n:3});},tl);q.pool(0,.03,0,w*.42,d*.42,0xa8f8ff,.2);};
 // weapons (muzzles toward +z): the turntable, then a twin autocannon / a missile rack / a field gun / a beam lance
 const turn=(q,r=1)=>{q.cyl(0,0,0,r,.1,M.dark,{n:hi?12:8});q.cyl(0,.1,0,r*.66,.26,M.hull2,{n:hi?10:6,r2:r*.56});};
 const twin=q=>{turn(q);q.bev(0,.36,-.1,.86,.62,1.1,M.hull,{ch:.08});for(const s of [-1,1])qb(q,s*.52,.44,0,.14,.92,.8,M.plate2,'b');
  q.at(0,1.14,.05,0,g=>{qb(g,0,-.22,-.5,.78,.44,.9,M.hull2,'');
   for(const s of [-1,1]){const x=s*.2,n=hi?6:4;g.tube([x,0,-.3],[x,0,2.25],.08,M.trim,{n});g.tube([x,0,2.25],[x,0,2.6],.125,M.dark,{n,caps:true});g.tube([x,0,-.2],[x,0,.75],.14,M.hull2,{n,caps:true});
    if(hi)g.bev(s*.66,-.34,-.42,.42,.6,.8,BL,{ch:.05});else qb(g,s*.66,-.34,-.42,.42,.6,.8,BL,'');
    if(hi){qb(g,s*.66,-.06,-.42,.44,.09,.82,WP,'tb');g.tube([s*.46,.1,-.2],[s*.24,.08,.1],.07,M.dark,{n:4});g.tube([x,0,1.1],[x,0,1.24],.115,M.gold,{n:6});}}
   qb(g,0,.2,-.2,.14,.16,.3,M.dark,'b');qb(g,0,.24,-.04,.1,.08,.03,M.cyan,'kb');},-.38);};
 const rack=q=>{turn(q,.8);for(const s of [-1,1])skin(q,[[[s*.72,.3,-.55],[s*.9,.3,-.55],[s*.9,.3,.45],[s*.72,.3,.45]],[[s*.72,1.62,-.3],[s*.9,1.62,-.3],[s*.9,1.62,.06],[s*.72,1.62,.06]]],M.hull2,{z:M.trim});
  q.at(0,1.5,-.08,0,g=>{if(hi)g.bev(0,-.5,0,1.44,1,2.1,M.hull,{ch:.09});else qb(g,0,-.5,0,1.44,1,2.1,M.hull,'');
   for(const s of [-1,1]){qb(g,s*.725,-.36,-.05,.05,.72,1.66,BL,s>0?'l':'r');qb(g,s*.755,-.08,.5,.03,.1,.5,M.cyan,s>0?'l':'r');}qb(g,0,.5,-.1,1.2,.05,1.6,M.plate2,'b');
   qb(g,0,-.44,1.05,1.3,.88,.03,M.dark,'k');for(let i=0;i<3;i++)for(let j=0;j<2;j++){const x=(i-1)*.42,y=(j-.5)*.42;g.gem(x,y,1.05,.14,.14,hi?.26:.2,M.plate);if(hi)qb(g,x,y-.17,1.075,.34,.34,.02,M.hull2,'ktbrl');}
   qb(g,0,-.53,.86,1.5,1.06,.12,WP,'kf');qb(g,0,-.4,-1.07,1.1,.8,.03,M.dark,'f');},-.6);};
 const field=q=>{for(const s of [-1,1]){q.tube([s*.28,.42,-.2],[s*.78,.1,-1.6],.09,M.hull2,{n:4});qb(q,s*.8,0,-1.66,.34,.22,.2,M.dark,'b');q.tube([s*.8,.48,.1],[s*1.06,.48,.1],.48,M.dark,{n:hi?10:6,caps:true});q.tube([s*.78,.48,.1],[s*1.09,.48,.1],.2,M.plate2,{n:6,caps:true});}
  q.bev(0,.36,.1,1.5,.42,.66,M.hull,{ch:.07});
  q.at(0,1,.1,0,g=>{const n=hi?8:5;g.tube([0,0,-.85],[0,0,.8],.21,M.hull2,{n,caps:true});g.tube([0,0,.8],[0,0,2.5],.125,M.trim,{n:hi?6:4,r2:.1});g.tube([0,0,2.5],[0,0,2.86],.18,M.dark,{n:hi?6:4,caps:true});g.tube([0,.27,-.3],[0,.27,1.3],.08,M.plate2,{n:4,caps:true});
   for(const s of [-1,1])g.at(s*.72,-.52,.7,-s*.16,p=>hi?p.bev(0,0,0,1.14,1.2,.07,BL,{ch:.04}):qb(p,0,0,0,1.14,1.2,.07,BL,''),-.24);
   qb(g,0,.36,.72,.5,.34,.07,BL,'');if(hi){for(const s of [-1,1])qb(g,s*.72,.4,.82,.9,.07,.05,WP,'k');g.tube([0,0,1.5],[0,0,1.66],.16,M.gold,{n:6});}qb(g,.34,.26,-.5,.1,.1,.26,M.cyan,'b');},-.2);};
 const lance=q=>{turn(q,.85);q.cyl(0,.36,0,.36,.72,M.hull,{n:hi?8:5,r2:.26});for(const s of [-1,1])qb(q,s*.4,1,0,.12,.74,.5,M.plate2,'b');
  q.at(0,1.5,0,0,g=>{if(hi)g.bev(0,-.28,-.5,.62,.56,1.3,M.hull2,{ch:.08});else qb(g,0,-.28,-.5,.62,.56,1.3,M.hull2,'');g.tube([0,0,.1],[0,0,2.9],.1,M.trim,{n:hi?6:4,r2:.05});
   for(let i=0;i<4;i++){const z=.5+i*.52,r=.25-.035*i;g.tube([0,0,z],[0,0,z+.13],r,M.cyan,{n:hi?8:5,caps:true});}g.gem(0,0,2.95,.08,.08,.2,M.ice);g.halo(0,0,2.9,.8,CY,.5);
   for(const s of [-1,1]){g.tube([s*.24,-.02,-.2],[s*.1,0,2.2],.03,M.plate2,{n:3});g.tube([s*.28,-.04,-.95],[s*.5,-.04,-.95],.25,M.plate,{n:hi?8:5,caps:true});}
   qb(g,0,.28,-.6,.4,.07,.9,BL,'b');if(hi)qb(g,0,.29,-.2,.2,.1,.05,M.cyan,'kb');},-.5);};
 // ---- the signature (5E-2d2 critic round 2): one tall white-and-blue mast on every post, the LDF flag under a lighthouse lantern ----
 const sig=q=>{const n=hi?6:4,n8=hi?8:6,Y=LDF.lightY-PY,rr=y=>.21-.09*(y-.9)/(Y-1.5);
  q.bev(0,0,0,1,.42,1,M.hull2,{ch:.1});q.cyl(0,.42,0,.38,.48,BL,{n,r2:.25});q.cyl(0,.9,0,.21,Y-1.5,WP,{n,r2:.12,top:false});
  for(const y of hi?[2.6,4.6,6.6]:[2.6,5.6])q.cyl(0,y,0,rr(y)+.03,.7,BL,{n,r2:rr(y+.7)+.03,top:false});
  if(hi)for(let i=0;i<3;i++){const a=i*TAU/3+.6;q.tube([0,2.3,0],[Math.cos(a)*.8,.05,Math.sin(a)*.8],.03,M.trim,{n:3});}
  // the lantern: a gallery, the lit drum, a blue cap, a whip with a cyan tip (the style's searchlight sweeps from the drum)
  q.cyl(0,Y-.6,0,.52,.1,M.hull2,{n:n8});q.cyl(0,Y-.5,0,.3,.2,BLd,{n:n8});q.cyl(0,Y-.3,0,.3,.6,M.ice,{n:n8,top:false});q.cyl(0,Y+.3,0,.48,.1,BLd,{n:n8});q.cyl(0,Y+.4,0,.42,.44,BL,{n:n8,r2:.06});
  q.tube([0,Y+.8,0],[0,Y+1.4,0],.02,M.bare,{n:3});q.gem(0,Y+1.42,0,.05,.07,.05,M.cyan);q.halo(0,Y,0,1.5,0x8fd0ff,.5);
  if(hi)for(let i=0;i<4;i++){const a=i*HP+.4;q.tube([Math.cos(a)*.47,Y-.5,Math.sin(a)*.47],[Math.cos(a)*.47,Y+.3,Math.sin(a)*.47],.018,M.trim,{n:3});}
  flg(q,Y-.85,mir>0?0:Math.PI);};   // the flag flies inward, over the pad
 // ---- the hero modules (round 2): one per post ----
 // an equipment hut (door toward +z): gunmetal walls, a white cornice, a blue roof
 const hut=(q,w,d,h)=>{q.loft([R(w+.2,d+.2,0),R(w+.2,d+.2,.26)],M.hull2,{top:false});q.loft([R(w,d,.26),R(w-.06,d-.06,h)],M.hull,{top:false});q.loft([R(w+.14,d+.14,h),R(w+.14,d+.14,h+.12)],WP,{top:false,bot:hi});q.loft([R(w+.14,d+.14,h+.12),R(w-.3,d-.3,h+.32)],BLd,{topMat:BL});
  qb(q,-w*.2,.26,d/2-.02,.7,Math.min(.9,h-.4),.05,M.dark,'kb');face(q,[[w*.05,h*.55,d/2-.012],[w*.4,h*.55,d/2-.012],[w*.4,h*.8,d/2-.012],[w*.05,h*.8,d/2-.012]],M.ice,[0,.9,0]);for(const s of [-1,1])qb(q,s*(w/2-.02),h*.5,0,.04,.14,d*.55,M.cyan,s>0?'l':'r');};
 // 1 the aid tent (the ridge along x, the door in the +x gable): pale canvas, the medics' blue cross on both slopes
 const tent=q=>{const hl=1.7,hw=1.45,wh=1.2,rh=2.4,G=sx=>[[sx*hl,0,-hw],[sx*hl,wh,-hw],[sx*hl,rh,0],[sx*hl,wh,hw],[sx*hl,0,hw]];
  for(const s of [-1,1]){face(q,[[-hl,0,s*hw],[hl,0,s*hw],[hl,wh,s*hw],[-hl,wh,s*hw]],cvD,[0,1,0]);face(q,[[-hl-.12,wh-.06,s*(hw+.1)],[hl+.12,wh-.06,s*(hw+.1)],[hl+.12,rh,0],[-hl-.12,rh,0]],cv,[0,0,0]);face(q,G(s),cvD,[0,1,0]);
   const P=(u,v)=>[u,wh+(rh-wh)*v+.035,s*(hw*(1-v)+.035)];face(q,[P(-.75,.36),P(.75,.36),P(.75,.64),P(-.75,.64)],BL,[0,0,0]);face(q,[P(-.22,.12),P(.22,.12),P(.22,.88),P(-.22,.88)],BL,[0,0,0]);}
  face(q,[[hl+.012,0,-.5],[hl+.012,0,.5],[hl+.012,1.55,.34],[hl+.012,1.55,-.34]],M.dark,[0,1,0]);for(const s of [-1,1])face(q,[[hl+.02,0,s*.5],[hl+.02,1.55,s*.34],[hl+.02,.5,s*.86]],BL,[0,1,0]);
  q.tube([-hl-.25,rh+.02,0],[hl+.25,rh+.02,0],.04,M.trim,{n:3});
  if(hi){for(const sx of [-1,1])for(const sz of [-1,1])q.tube([sx*hl,wh,sz*hw],[sx*(hl+.25),0,sz*(hw+.5)],.015,M.bare,{n:3});qb(q,hl+.03,1.7,0,.03,.3,.3,WP,'');q.halo(hl+.3,1,0,1,0xa8f8ff,.2);}};
 // a dish on a pedestal: white bowl, blue back
 const dishOn=(q,r,elev,yaw,ph=1.5)=>{q.bev(0,0,0,.9,.4,.9,M.hull2,{ch:.08});q.cyl(0,.4,0,.19,ph,M.trim,{n:hi?7:5,r2:.13,top:false});
  q.at(0,ph+.55,0,yaw,y=>{for(const s of [-1,1])qb(y,s*.32,-.2,0,.1,.5,.4,M.plate2,'');y.at(0,.14,0,0,d=>{rev(d,0,0,0,[[.14,0],[r*.65,.2*r],[r,.52*r],[r*.96,.57*r],[r*.62,.27*r],[.12,.08]],hi?12:7,s=>s<2?BL:s===2?BLd:WP);
    for(let i=0;i<3;i++){const a=i*TAU/3;d.tube([Math.cos(a)*r*.75,.36*r,Math.sin(a)*r*.75],[0,r*.95,0],.026,M.bare,{n:3});}d.gem(0,r*.95,0,.09,.12,.09,M.cyan);d.halo(0,r*.95,0,.7,CY,.4);},elev);});};
 // 2 the tank rack (along x): three tall white oxygen tanks with blue bands in a steel rack, a blue manifold down to the valve station
 const tanks=q=>{const n=hi?10:6;qb(q,0,0,0,4.7,.16,1.9,M.hull2,'b');
  for(const x of [-1.4,0,1.4]){q.cyl(x,.16,0,.6,.2,M.hull,{n});q.cyl(x,.36,0,.54,3,WP,{n,top:false});q.cyl(x,1.1,0,.555,.4,BL,{n,top:false});if(hi)q.cyl(x,2.6,0,.555,.12,BL,{n,top:false});q.dome(x,3.36,0,.54,.34,.54,WP,{n,rings:hi?3:2});q.cyl(x,3.66,0,.1,.3,M.trim,{n:5});}
  for(const sx of [-1,1]){for(const sz of [-1,1])q.tube([sx*2.15,.16,sz*.82],[sx*2.15,3.3,sz*.82],.07,M.trim,{n:4});q.tube([sx*2.15,3.3,-.82],[sx*2.15,3.3,.82],.06,M.trim,{n:4});}
  for(const sz of [-1,1]){q.tube([-2.15,3.3,sz*.82],[2.15,3.3,sz*.82],.06,M.trim,{n:4});q.tube([-2.15,1.75,sz*.82],[2.15,1.75,sz*.82],.05,M.trim,{n:3});if(hi)for(const sx of [-1,1])q.tube([sx*2.15,.2,sz*.82],[sx*.7,1.75,sz*.82],.035,M.bare,{n:3});}
  q.tube([-1.4,3.9,0],[2.15,3.9,0],.09,BL,{n:hi?6:4});q.tube([2.15,3.9,0],[2.15,1.1,0],.09,BL,{n:hi?6:4});q.bev(2.15,.16,0,.4,1,.8,M.hull,{ch:.05});qb(q,2.15,.7,.41,.24,.2,.03,M.cyan,'kb');q.halo(2.15,.8,.6,.6,CY,.3);};
 // 3 the checkpoint (along x): a blue-and-white boom on its pivot post, raised; a lit stop plate hangs from it; the catch post
 const gate=q=>{q.bev(-2.7,0,0,.6,1.3,.6,BL,{ch:.07});qb(q,-2.7,1.3,0,.72,.1,.72,WP,'b');
  q.at(-2.7,1.02,.36,0,a=>{const N=hi?6:3,L=5.4;for(let k=0;k<N;k++){const x0=k*L/N,x1=(k+1)*L/N;qb(a,(x0+x1)/2,-.08,0,x1-x0,.16,.12,k%2?WP:BL,(k?'l':'')+(k<N-1?'r':''));}
   qb(a,-.5,-.22,0,.62,.44,.3,M.hull2,'');qb(a,2.7,-.66,0,1,.52,.04,M.dark,'');qb(a,2.7,-.58,.025,.8,.34,.02,M.cyan,'kb');if(hi)for(const x of [2.35,3.05])a.tube([x,-.08,0],[x,-.16,0],.015,M.bare,{n:3});a.halo(2.7,-.4,.2,.8,CY,.3);},0,.4);
  q.bev(2.85,0,0,.4,1.15,.4,BL,{ch:.05});qb(q,2.85,1.15,0,.5,.08,.34,WP,'b');q.gem(2.85,1.42,0,.1,.13,.1,M.cyan);q.halo(2.85,1.42,0,.7,CY,.4);};
 // a concrete road barrier along z, a blue block painted on each flank
 const jersey=(q,L)=>{zloft(q,[-L/2,L/2].map(z=>({z,p:[[-.32,0],[.32,0],[.32,.22],[.11,.8],[-.11,.8],[-.32,.22]]})),(z,i)=>i===3?M.plate2:M.conc,{a:M.conc,z:M.conc});
  if(hi)for(const s of [-1,1])for(const z of [-L*.25,L*.25])face(q,[[s*.312,.27,z-.25],[s*.312,.27,z+.25],[s*.14,.74,z+.25],[s*.14,.74,z-.25]],BL,[0,.4,z]);};
 // 4 the search radar: a curved reflector (white face, blue back) on a pedestal on its equipment hut, the feed horn out in front
 const radar=q=>{hut(q,2.5,2,1.35);q.cyl(0,1.67,0,.3,1.05,M.trim,{n:hi?8:5,r2:.22,top:false});if(hi)q.cyl(0,1.67,0,.46,.18,M.hull,{n:8});
  q.at(0,2.72,0,.45,y=>{qb(y,0,0,-.1,1,.3,.6,M.hull2,'');
   y.at(0,.3,0,0,d=>{const W=1.9,H=2.1,ns=hi?6:4,zq=x=>.17*x*x-.5;
    for(let i=0;i<ns;i++){const x0=-W+i*2*W/ns,x1=x0+2*W/ns,z0=zq(x0),z1=zq(x1);face(d,[[x0,0,z0],[x1,0,z1],[x1,H,z1],[x0,H,z0]],i%2?WP:M.plate,[0,H/2,-9]);face(d,[[x0,0,z0-.05],[x1,0,z1-.05],[x1,H,z1-.05],[x0,H,z0-.05]],BLc,[0,H/2,9]);
     if(hi&&i)d.tube([x0,0,z0-.04],[x0,H,z0-.04],.035,BLd,{n:3});}
    d.tube([-W,H*.5,zq(W)-.12],[W,H*.5,zq(W)-.12],.05,M.trim,{n:3});d.tube([0,.1,zq(0)],[0,H*.5,1.25],.035,M.bare,{n:3});d.gem(0,H*.5,1.3,.1,.1,.14,M.cyan);d.halo(0,H*.5,1.3,.7,CY,.4);},-.14);});};
 // 5 the heavy gun: a faceted blue gun house on a wide turntable, a long barrel raised over the shields; its shells stand racked beside it
 const heavy=q=>{turn(q,1.75);
  q.at(0,.36,0,0,g=>{skin(g,[[[-1.3,0,-1.5],[1.3,0,-1.5],[1.3,0,1.2],[-1.3,0,1.2]],[[-1.3,.75,-1.5],[1.3,.75,-1.5],[1.3,.75,1.45],[-1.3,.75,1.45]],[[-.95,1.6,-1.3],[.95,1.6,-1.3],[.95,1.6,.45],[-.95,1.6,.45]]],(r,i)=>r?(i===2?BLl:BLd):BL,{z:BL});
   for(const s of [-1,1])qb(g,s*1.31,.3,-.1,.03,.2,2.3,WP,s>0?'l':'r');g.cyl(-.4,1.6,-.6,.38,.26,BLd,{n:hi?8:5});qb(g,-.4,1.68,-.24,.4,.1,.03,M.cyan,'kb');
   hi?g.bev(0,.5,1.5,1.1,.8,.5,M.hull2,{ch:.08}):qb(g,0,.5,1.5,1.1,.8,.5,M.hull2,'b');
   g.at(0,.92,1.6,0,k=>{const n=hi?8:5;k.tube([0,0,0],[0,0,1.1],.3,M.hull2,{n,caps:true});k.tube([0,0,1.1],[0,0,3.3],.19,M.trim,{n:hi?7:5,r2:.15});k.tube([0,0,3.3],[0,0,3.85],.26,M.dark,{n,caps:true});
    if(hi){k.tube([0,0,1.6],[0,0,1.8],.215,WP,{n:7});for(const s of [-1,1])k.tube([s*.36,.1,-.2],[s*.36,.1,.9],.09,M.plate2,{n:5,caps:true});}},-.28);
   if(hi){g.tube([.6,1.6,-.9],[.66,3.2,-.96],.02,M.bare,{n:3});qb(g,.35,1.6,-.5,.7,.06,.6,BLl,'b');}});};
 const shells=q=>{qb(q,0,0,0,1.6,.2,.7,M.hull2,'b');for(let i=0;i<(hi?4:3);i++){const x=-.52+i*.35;q.cyl(x,.2,0,.14,.62,M.plate2,{n:hi?7:5,top:false});q.cyl(x,.82,0,.14,.3,WP,{n:hi?7:5,r2:.03});if(hi)q.cyl(x,.5,0,.146,.07,BL,{n:7,top:false});}};
 // 6 the shield wall (along x, its face toward +z): three blue armour panels between four field pylons (cyan caps), the emitter bar
 //   across the tops; behind it raking buttresses and a firing step with a rail
 const wall=q=>{for(let k=0;k<4;k++){const x=-3.3+k*2.2;hi?q.bev(x,0,0,.46,3.8,.74,M.hull2,{ch:.07}):qb(q,x,0,0,.46,3.8,.74,M.hull2,'b');qb(q,x,3.8,0,.3,.16,.5,M.cyan,'b');q.halo(x,4,0,.7,CY,.35);if(hi)qb(q,x,1.1,.38,.16,1.7,.03,M.cyan,'kb');}
  for(let k=0;k<3;k++)q.at(-2.2+k*2.2,0,.04,0,p=>{qb(p,0,0,0,1.74,.5,.62,M.hull2,'b');hi?p.bev(0,.5,0,1.74,2.7,.3,BL,{ch:.06}):qb(p,0,.5,0,1.74,2.7,.3,BL,'b');qb(p,0,2.3,.16,1.5,.24,.03,WP,'kb');qb(p,0,1.55,.16,.9,.14,.03,M.dark,'kb');qb(p,0,3.2,0,1.74,.12,.22,BLl,'b');
   if(hi)for(const s of [-1,1])qb(p,s*.62,.7,.16,.12,.6,.03,BLd,'kb');});
  qb(q,0,3.42,0,6.2,.07,.1,M.ice,'lr');
  for(const x of [-2.2,0,2.2])q.tube([x,2.4,-.15],[x,0,-1.45],.09,M.trim,{n:4});qb(q,0,.95,-.7,6,.1,.8,M.hull,'');for(const x of [-2.9,-1.1,1.1,2.9])qb(q,x,0,-.95,.12,.95,.12,M.trim,'tb');
  if(hi){q.tube([-3,1.95,-1.08],[3,1.95,-1.08],.03,M.bare,{n:3});for(const x of [-3,-1.5,0,1.5,3])q.tube([x,1.05,-1.08],[x,1.95,-1.08],.025,M.bare,{n:3});}};
 // 7 the relay: a lattice tower on its hut, two white relay drums with blue rims, a stack of glowing insulators at the top
 const relay=q=>{hut(q,2.2,1.8,1.3);q.truss(0,1.62,0,1.2,.46,5,M.trim,{step:1.25,r:.05});
  for(const [y,ry,r] of [[5.5,.5,.62],[4.2,-2.3,.5]])q.at(0,y,0,ry,d=>{const n=hi?10:6;d.tube([0,0,.3],[0,0,.72],r,WP,{n,caps:true});d.tube([0,0,.7],[0,0,.8],r+.04,BL,{n});d.tube([0,0,0],[0,0,.3],.08,M.trim,{n:4});});
  for(let i=0;i<4;i++)q.cyl(0,6.7+i*.3,0,.32-.05*i,.13,M.cyan,{n:hi?8:5});q.tube([0,6.6,0],[0,8.6,0],.04,M.bare,{n:3});q.gem(0,8.62,0,.06,.08,.06,M.white);q.halo(0,7.2,0,1.3,CY,.45);
  if(hi){q.cable([.5,6.4,.3],[1.3,1.7,1.1],.5,.03,M.dark,{n:4});q.detail(()=>q.ladder([-.62,1.62,0],[-.26,6.4,0],M.bare,{w:.4,dx:0,dz:1}));}};
 // 8 the drill rig: a derrick over the drill floor, the blue motor head on the drill string, ice cores on a rack, a melt tank
 const drill=q=>{const ICE=K.pal.nat.ice;q.bev(0,0,0,3.1,.5,3.1,M.hull2,{ch:.08});qb(q,0,.5,1.45,2.9,.05,.18,M.hazard,'b');
  q.truss(0,.5,0,2.5,.7,5.4,M.trim,{step:1.35,r:.055});q.bev(0,5.9,0,1,.36,1,BL,{ch:.07});qb(q,0,6.26,0,.5,.3,.5,BLd,'b');q.gem(0,6.75,0,.08,.11,.08,M.white);q.halo(0,6.75,0,.8,WH,.4);
  q.tube([0,5.9,0],[0,.5,0],.08,M.bare,{n:hi?6:4});q.cyl(0,3,0,.38,.85,BL,{n:hi?8:5});q.cyl(0,2.8,0,.22,.2,M.hull2,{n:6});q.cyl(0,3.85,0,.2,.25,WP,{n:6});q.cyl(0,.5,0,.62,.18,M.dark,{n:hi?10:6});
  if(hi)for(const s of [-1,1])q.tube([s*.3,3.6,0],[s*.45,5.9,0],.02,M.dark,{n:3});
  q.at(2.25,0,-.1,0,r=>{qb(r,0,0,0,.95,.45,2.3,M.hull,'b');for(let i=0;i<3;i++)r.tube([-.3+i*.3,.58,-1.05],[-.3+i*.3,.58,1.05],.13,ICE,{n:hi?6:4,caps:true});if(hi)for(const z of [-.8,.8])qb(r,0,.45,z,.95,.3,.06,M.trim,'b');});
  q.at(-2.25,0,-.1,0,t=>{const n=hi?8:6;for(const z of [-.7,.7])qb(t,0,0,z,.8,.3,.2,M.hull2,'b');t.tube([0,.72,-1.15],[0,.72,1.15],.5,WP,{n,caps:true});t.tube([0,.72,-.3],[0,.72,.3],.52,BL,{n});if(hi)t.tube([0,1.2,.6],[0,1.5,.6],.07,M.trim,{n:4});});};
 // 9 the floodlight gantry (across x): two lattice legs, a laced beam, a blue header board, four floodlights looking down the front
 const gantry=q=>{for(const s of [-1,1]){q.bev(s*3.05,0,0,1.1,.3,1.1,M.hull2,{ch:.06});q.truss(s*3.05,.3,0,.85,.55,4.75,M.trim,{step:1.2,r:.05});}
  if(hi){for(const y of [5.05,5.65])for(const z of [-.28,.28])q.tube([-3.3,y,z],[3.3,y,z],.05,M.trim,{n:4});for(let k=0;k<8;k++){const x0=-3.3+k*.825,x1=x0+.825;for(const z of [-.28,.28])q.tube([x0,k%2?5.65:5.05,z],[x1,k%2?5.05:5.65,z],.028,M.bare,{n:3});}}
  else qb(q,0,5.05,0,6.6,.6,.56,M.trim,'');
  qb(q,0,5.72,0,2.6,.5,.12,BL,'');qb(q,0,5.88,.07,2.2,.16,.02,WP,'kb');
  for(let k=0;k<4;k++){const x=-2.1+k*1.4;q.at(x,5,.2,0,l=>{hi?l.bev(0,-.56,0,.95,.56,.36,BL,{ch:.05}):qb(l,0,-.56,0,.95,.56,.36,BL,'');qb(l,0,-.5,.19,.8,.44,.03,M.white,'kb');l.halo(0,-.28,.5,1.2,WH,.45);},.55);q.pool(x,.05,2.2,1,1.3,0xa8f8ff,.14);}
  if(hi)q.cable([2.8,5,-.3],[2.3,.8,-2.4],.4,.03,M.dark,{n:4});};
 // ---- the nine posts: the signature on every one, then its hero and what stands with it ----
 put(LDF.mast[0],LDF.mast[1],0,sig);
 if(V===0){ring([-38,0,38]);put(1.75,-1,-HP,tent);put(-1.75,.3,0,q=>dishOn(q,1.15,.7,-.6));put(-3.3,1.3,-HP,q=>bags(q,2,3,1));put(.2,1.6,.2,q=>stock(q,11));}
 else if(V===1){ring([15,50,85]);put(.6,-1.9,0,tanks);put(-1.2,1,-.35,lance);[-100,-55,-10].forEach((a,k)=>put(-1.2+Math.sin(a*D)*1.85,1+Math.cos(a*D)*1.85,a*D,q=>bags(q,1.9,3,60+k*5)));put(2.5,.4,.3,q=>stock(q,21));}
 else if(V===2){ring([-78,78],.4);put(0,2.55,0,gate);put(2.3,-1.7,0,booth);put(-1.3,3.4,HP,q=>jersey(q,2.2));put(1.7,3.4,HP,q=>jersey(q,2));put(-.9,-1.1,0,twin);put(-.9,.75,0,q=>bags(q,2.3,3,5));put(.9,-.2,.3,q=>stock(q,31));}
 else if(V===3){ring([-35,0,35]);put(1,-1.5,0,radar);put(-1.5,1.1,-.2,rack);put(-3.3,-.5,-HP,q=>bags(q,2.2,3,3));put(2.6,.9,.3,q=>stock(q,41));}
 else if(V===4){ring([-62,-28,28,62]);put(.35,-1.3,0,heavy);put(-2.35,.5,.3,shells);put(0,3.35,0,q=>bags(q,2.2,2,5));put(2.3,.9,-.4,q=>stock(q,51));}
 else if(V===5){ring([-90,90],-.8,3.2);put(0,2.7,0,wall);put(.5,-1,0,rack);put(-1.6,.2,.2,q=>stock(q,61));put(2.7,-2.4,-.3,q=>{box(q,0,0,0,1.2,.7,.9,0,M.hull,BL);box(q,.05,.7,0,.9,.5,.7,.3,M.plate2,M.cyan);});}
 else if(V===6){ring([-15,25,65]);put(1.1,-1.6,0,relay);put(-1.3,1,-.2,lance);[-100,-55,-10].forEach((a,k)=>put(-1.3+Math.sin(a*D)*1.85,1+Math.cos(a*D)*1.85,a*D,q=>bags(q,1.9,3,70+k*5)));put(2.2,.6,.2,q=>stock(q,71));}
 else if(V===7){ring([-40,0,40]);put(.6,-.75,0,drill);put(-2.2,1.5,.2,q=>stock(q,81));put(2.9,1.5,HP,q=>bags(q,1.6,3,7));}
 else{ring([-50,-20,20,50],.3);put(0,-.5,0,gantry);put(0,.4,0,field);put(2.3,-2.6,0,q=>{box(q,0,0,0,1.4,.9,1,0,M.hull,BL);if(hi){qb(q,0,.9,0,.5,.3,.5,M.dark,'b');q.tube([.4,.9,.2],[.4,1.5,.2],.05,M.trim,{n:4});}});put(-1.1,-2.5,.1,q=>stock(q,91));}
}
WK.model('ldf-post',ldfPost,{aoH:2.6,aoMin:.66});

root.ConquestWarModels={hauler:{size:HAUL.size,hinge:[0,HAUL.deckY,HAUL.zH+.02],rampLen:HAUL.rampLen,rampW:HAUL.rampW,closedAngle:HAUL.closed,openAngle:HAUL.open,deckY:HAUL.deckY},shuttle:SHUT,portal:{size:PORT.size,cy:PORT.cy,rIn:PORT.rIn},ldf:{size:LDF.size,variants:LDF.variants,light:sd=>[ldfMir(sd)*LDF.mast[0],LDF.lightY,LDF.mast[1]]}};   // light(seed): the lantern on the post's mast, in the model's space (the style's searchlight sweeps from it)
})(typeof globalThis!=='undefined'?globalThis:window);
