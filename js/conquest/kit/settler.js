/* LUNAR Conquest world kit — SETTLER models (Session 5E-2d1). Civilian colonists, a different people from the military
 * (owner, Nov 8): weathered painted prefab domes and habitat modules, patched and scrap-repaired walls, timber add-ons,
 * corrugated roofs, water tanks, greenhouses, workshops, warm amber light, things left lying about. Rugged frontier, not a
 * picnic park. Every model stays inside its slot box (js/conquest/slots.js); o.w / o.d / o.h are the lot's own size.
 * b.hi === false is LOW: the silhouette and the big colour blocks only. */
(function(root){
'use strict';
const WK=root.ConquestWorldKit,TAU=Math.PI*2;
const pick=(a,i)=>a[((i%a.length)+a.length)%a.length];

// ------------------------------------------------------------------ shared settler parts -------------------------------
// crates and a barrel left by a wall
function clutter(b,x,z,n,seed,lean){const {pal}=b.k,S=pal.set;for(let k=0;k<n;k++){const s=.62+.22*((seed+k*7)%3)/2,ox=(k%2)*.8,oy=k>=2?.72:0;if(lean){crate(b.part(),x+ox,oy,z+(k%3)*.16,s,k%2?S.timber:pick(S.fresh,seed+k),(seed+k)*.37);continue;}b.part().bev(x+ox,oy,z+(k%3)*.16,s,s,s,k%2?S.timber:pick(S.fresh,seed+k),{ch:.05,ry:(seed+k)*.37});}
 if(b.hi&&n>1){if(lean)return barrel(b,x-.75,0,z+.2,.3,.82,S.rust);b.cyl(x-.75,0,z+.2,.3,.82,S.rust,{n:8,bev:.04});b.ring(x-.75,.3,z+.2,.31,S.iron,{thin:true});b.ring(x-.75,.6,z+.2,.31,S.iron,{thin:true});}}
// a stovepipe chimney with a rain cap and a guy strut
function stovepipe(b,x,y,z,h,lean){const S=b.k.pal.set;b.cyl(x,y,z,.16,h,S.iron,{n:6});b.cyl(x,y+h+.1,z,.3,.07,S.rust,{n:6,r2:.05});if(b.hi){if(lean)hoop(b,x,y+h*.55,z,.19,.09,S.rust,6);else b.ring(x,y+h*.55,z,.17,S.rust,{thin:true});b.tube([x,y+h*.6,z],[x+.5,y,z+.3],.025,S.iron,{n:3});}}
// a hanging lantern (the settlers' amber light)
function lantern(b,x,y,z,k=1){const S=b.k.pal.set;b.box(x,y-.3,z,.2,.26,.2,S.lamp);if(b.hi){b.box(x,y-.04,z,.26,.05,.26,S.iron);b.tube([x,y,z],[x,y+.25,z],.015,S.iron,{n:3});b.halo(x,y-.2,z,.7*k,0xffb060,.35);}}
// a small water tank on a timber stand
function waterTank(b,x,y,z,r,h,m,lean){const S=b.k.pal.set;for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])b.tube([x+sx*r*.8,y,z+sz*r*.8],[x+sx*r*.7,y+h*.42,z+sz*r*.7],.07,S.timberD,{n:4});
 b.cyl(x,y+h*.42,z,r,h*.5,m,{n:b.hi?10:6,bev:.05});b.cyl(x,y+h*.92,z,r*1.04,h*.1,S.roofRust,{n:b.hi?10:6,r2:.08});if(b.hi){if(lean){hoop(b,x,y+h*.53,z,r*1.03,.07,S.iron,10);hoop(b,x,y+h*.78,z,r*1.03,.07,S.iron,10);}else{b.ring(x,y+h*.55,z,r*1.01,S.iron,{thin:true});b.ring(x,y+h*.8,z,r*1.01,S.iron,{thin:true});}b.tube([x+r,y+h*.5,z],[x+r,y,z],.04,S.iron,{n:4});}}
// laundry on a line between two points
function laundry(b,a,c,seed){const S=b.k.pal.set;b.detail(()=>{b.cable(a,c,.12,.012,S.iron);for(let k=1;k<5;k++){const t=k/5,x=a[0]+(c[0]-a[0])*t,z=a[2]+(c[2]-a[2])*t,y=a[1]+(c[1]-a[1])*t-.12*4*t*(1-t),ry=Math.atan2(c[0]-a[0],c[2]-a[2])+Math.PI/2;b.at(x,y-.62,z,ry,q=>q.box(0,0,0,.42+.1*(k%2),.6,.03,pick(S.canvas,seed+k)));}});}
// a planter box with greens
function planter(b,x,y,z,w,d,seed){const S=b.k.pal.set;b.box(x,y,z,w,.3,d,S.timberD);b.box(x,y+.28,z,w-.12,.06,d-.12,S.soil);const n=b.hi?Math.max(2,Math.round(w/.45)):1;for(let k=0;k<n;k++)b.part().gem(x-w/2+w*(k+.5)/n,y+.5,z,.24,.3,.22,k%2?S.leaf:S.leafD,k*1.3+seed);}
// a hand-painted sign board with a lamp over it
function signBoard(b,x,y,z,w,seed){const S=b.k.pal.set;b.box(x,y,z,w,.55,.08,pick(S.fresh,seed));if(b.hi){b.box(x,y+.2,z+.045,w*.7,.1,.02,S.white);b.box(x-w*.2,y+.36,z+.045,w*.34,.06,.02,S.white);b.box(x,y+.6,z+.1,w*.5,.05,.12,S.iron);b.box(x,y+.55,z+.14,w*.3,.04,.05,S.lamp);}}

// ---- cheap building blocks (triangle budget): a box with no bottom, a plate / disc on a wall facing +z of the frame ----
const bx=(b,x,y,z,w,h,d,m,top)=>b.loft([{p:b.k.rect(w,d,0,x,z),y},{p:b.k.rect(w,d,0,x,z),y:y+h}],m,top?{topMat:top}:{});
const plate=(b,x,y,z,w,h,m)=>b.quad([x-w/2,y,z],[x+w/2,y,z],[x+w/2,y+h,z],[x-w/2,y+h,z],m);
const disc=(b,x,y,z,r,m,n=8,s=1)=>b.at(x,y,z,0,q=>q.cap(q.k.circ(r,n),0,m,true),s*Math.PI/2);   // s = -1 faces -z
// a thin sheet seen from both sides (awnings, tarps, lean-to roofs): the upper face m, the under face darker
function sheet(b,p0,p1,p2,p3,m,under){const ux=p1[0]-p0[0],uz=p1[2]-p0[2],vx=p3[0]-p0[0],vz=p3[2]-p0[2],up=uz*vx-ux*vz>=0,A=up?[p0,p1,p2,p3]:[p3,p2,p1,p0],B=up?[p3,p2,p1,p0]:[p0,p1,p2,p3];b.quad(A[0],A[1],A[2],A[3],m);b.quad(B[0],B[1],B[2],B[3],under||b.k.tint(m,.5));}
// a hoop / painted band around an upright cylinder (no caps)
const hoop=(b,x,y,z,r,hh,m,n,r2)=>b.loft([{p:b.k.circ(r,n,x,z),y},{p:b.k.circ(r2??r,n,x,z),y:y+hh}],m,{top:false,smooth:true});
// a window on a wall facing +z of the frame: timber frame, a lit (or dark) pane, a glazing bar and a sill
function win(b,x,y,z,w,h,o={}){const S=b.k.pal.set,f=o.frame||S.timberD,g=o.lit===false?S.glass:(o.glass||S.warm);
 if(!b.hi){plate(b,x,y-.07,z+.02,w+.16,h+.14,f);plate(b,x,y,z+.04,w,h,g);return;}
 bx(b,x,y-.09,z+.035,w+.2,h+.18,.07,f);plate(b,x,y,z+.075,w,h,g);if(o.mid!==false)plate(b,x,y,z+.09,.06,h,f);if(o.bar)plate(b,x,y+h*.52,z+.09,w,.06,f);
 if(o.sill!==false)bx(b,x,y-.17,z+.1,w+.3,.08,.2,o.sillM||S.timber);
 if(o.shut)for(const s of [-1,1])plate(b,x+s*(w/2+.1+w*.21),y-.04,z+.05,w*.42,h+.08,o.shut);}
// a plank door on a wall facing +z of the frame, with its frame, a little lit pane and a handle
function dr(b,x,y,z,w,h,m,o={}){const S=b.k.pal.set,f=o.frame||S.timberD;
 if(!b.hi){plate(b,x,y,z+.02,w+.2,h+.1,f);plate(b,x,y,z+.04,w,h,m);return;}
 bx(b,x,y,z+.03,w,h,.07,m);bx(b,x,y+h,z+.05,w+.3,.13,.1,f);for(const s of [-1,1])bx(b,x+s*(w/2+.07),y,z+.05,.13,h,.1,f);
 if(o.pane!==false)plate(b,x,y+h*.62,z+.075,w*.42,h*.2,S.warm);plate(b,x+w*.32,y+h*.42,z+.075,.07,.16,S.lamp);}
// a mismatched repair panel on a wall facing +z of the frame
const patchP=(b,x,y,z,w,h,m)=>{plate(b,x,y,z+.03,w,h,m);if(b.hi){const S=b.k.pal.set;for(const sx of [-1,1])for(const sy of [0,1])plate(b,x+sx*(w/2-.09),y+.05+sy*(h-.17),z+.04,.07,.07,S.iron);}};
// a barrel with two iron hoops; a sack; a slatted crate
function barrel(b,x,y,z,r,h,m){const S=b.k.pal.set,n=b.hi?8:6;b.cyl(x,y,z,r,h,m||S.rust,{n,topMat:b.k.tint(m||S.rust,.6)});if(b.hi){hoop(b,x,y+h*.2,z,r*1.05,.07,S.iron,n);hoop(b,x,y+h*.72,z,r*1.05,.07,S.iron,n);}}
const sack=(b,x,y,z,r,m)=>b.dome(x,y,z,r,r*.85,r*.72,m||b.k.pal.set.canvas[0],{n:6,rings:2});
function crate(b,x,y,z,s,m,ry=0){b.at(x,y,z,ry,q=>{bx(q,0,0,0,s,s*.85,s,m,b.k.tint(m,1.12));if(q.hi){const e=b.k.tint(m,.62);bx(q,0,s*.85-.1,0,s+.06,.1,s+.06,e,b.k.tint(m,1.15));bx(q,0,0,0,s+.06,.1,s+.06,e);}});}
// a string of little lamps on a sagging line (the settlers' fairy lights); HIGH only, in the detail batch
function stringLights(b,a,c,n,sag=.25){if(!b.hi)return;const S=b.k.pal.set,g=b.k.glow;b.detail(()=>{b.cable(a,c,sag,.014,S.iron,{n:5});for(let k=0;k<n;k++){const t=(k+.5)/n;b.gem(a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t-sag*4*t*(1-t)-.07,a[2]+(c[2]-a[2])*t,.07,.09,.07,g(k%3===1?0xff7a4a:k%3?0xffd27a:0xffb347,1.3));}});}
// cloth pennants on a line
function bunting(b,a,c,n,seed,sag=.2){if(!b.hi)return;const S=b.k.pal.set;b.detail(()=>{b.cable(a,c,sag,.012,S.iron,{n:4});for(let k=0;k<n;k++){const t0=(k+.2)/n,t1=(k+.8)/n,tm=(t0+t1)/2,P=t=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t-sag*4*t*(1-t),a[2]+(c[2]-a[2])*t],p0=P(t0),p1=P(t1),pm=P(tm);pm[1]-=.32;const m=pick(S.canvas,seed+k*2);b.tri(p0,p1,pm,m);b.tri(p1,p0,pm,m);}});}
// weathered cream timber for trim (barge boards, door frames, ribs): matt and clearly darker than a lamp, never emissive
const creamT=b=>b.k.mat(0xab9a7a,'timber',.5,.1);
// a faceted hull along the frame's x axis (bodies, necks, heads): stations [x, y, z, ry, rz] = centre, vertical and lateral
// radius; n (even) flat facets a ring, facet n-1 the top one and n/2-1 the belly; m = a material or (segment, facet) =>
// material (null leaves the facet out); o.c0 / o.c1 = the material that closes the first / last station
function hull(b,st,n,m,o={}){const mf=typeof m==='function'?m:()=>m,R=st.map(s=>Array.from({length:n},(_,i)=>{const a=(i+.5)/n*TAU;return [s[0],s[1]+Math.cos(a)*s[3],s[2]+Math.sin(a)*(s[4]??s[3])];}));
 for(let k=0;k<st.length-1;k++){const c=[(st[k][0]+st[k+1][0])/2,(st[k][1]+st[k+1][1])/2,(st[k][2]+st[k+1][2])/2];for(let i=0;i<n;i++){const j=(i+1)%n,mm=mf(k,i);if(mm)b.quad(R[k][i],R[k][j],R[k+1][j],R[k+1][i],mm,c);}}
 const cap=(r,mm,ins)=>{for(let k=0;k<n/2-1;k++)b.quad(r[k],r[k+1],r[n-2-k],r[n-1-k],mm,ins);};
 if(o.c0)cap(R[0],o.c0,st[1]);if(o.c1)cap(R[st.length-1],o.c1,st[st.length-2]);return b;}
// a wheel lying on the z axis of the frame: an eight-sided tyre standing on a flat (the facet on the ground is never seen
// and is not drawn), a painted hub; side = the face that shows (1 = +z, -1 = -z, 0 = both)
function wheel(b,x,y,z,r,t,hub,side=0){const S=b.k.pal.set,c=[x,y,z],ring=(zz,rr,n)=>Array.from({length:n},(_,i)=>{const a=(i+.5)/n*TAU;return [x+Math.sin(a)*rr,y-Math.cos(a)*rr,zz];}),fill=(R,m)=>{for(let k=0;k<R.length/2-1;k++)b.quad(R[k],R[k+1],R[R.length-2-k],R[R.length-1-k],m,c);};
 const A=ring(z-t/2,r,8),B=ring(z+t/2,r,8);for(let i=0;i<7;i++)b.quad(A[i],A[i+1],B[i+1],B[i],S.tyre,c);
 for(const s of side?[side]:[-1,1]){fill(s>0?B:A,S.tyre);if(b.hi&&hub)fill(ring(z+s*(t/2+.025),r*.52,6),hub);}}
// a ladder with safety hoops: a -> c (base to top), `side` = unit [x,z] the rungs run along, `out` = unit [x,z] the cage
// bulges toward; o.k thickens every bar (a tall tower's ladder is seen from far away)
function cageLadder(b,a,c,m,side,out,o={}){const w=o.w||.5,th=o.k||1,L=Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2]),n=Math.max(2,Math.round(L/(o.step||.6))),P=t=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t,a[2]+(c[2]-a[2])*t];
 for(const s of [-1,1])b.tube([a[0]+side[0]*s*w/2,a[1],a[2]+side[1]*s*w/2],[c[0]+side[0]*s*w/2,c[1],c[2]+side[1]*s*w/2],.05*th,m,{n:4});
 if(!b.hi)return;for(let k=1;k<n;k++){const p=P(k/n);b.tube([p[0]-side[0]*w/2,p[1],p[2]-side[1]*w/2],[p[0]+side[0]*w/2,p[1],p[2]+side[1]*w/2],.03*th,m,{n:3});}
 if(o.cage===false)return;const cr=o.cr||.48,t0=Math.min(.9,2.4/L),nh=Math.max(2,Math.round(L*(1-t0)/(o.hoopStep||2.2))),ring=t=>{const p=P(t);return [-1,-.5,.5,1].map(u=>{const an=u*Math.PI/2,ox=Math.sin(an)*cr,oo=Math.cos(an)*cr*1.25;return [p[0]+side[0]*ox+out[0]*oo,p[1],p[2]+side[1]*ox+out[1]*oo];});};
 let prev=null;for(let k=0;k<=nh;k++){const R=ring(t0+(1-t0)*k/nh);for(let i=0;i<3;i++)b.tube(R[i],R[i+1],.025*th,m,{n:3});if(prev)for(const i of [1,2])b.tube(prev[i],R[i],.022*th,m,{n:3});prev=R;}}
// a farm cart parked with its shafts on the ground (the frame's +x is the cart's front)
function cart(b,x,y,z,ry,seed,load=1){const S=b.k.pal.set;b.at(x,y,z,ry,q=>{if(q.hi){bx(q,0,.62,0,2.1,.14,1.15,S.timber);for(const s of [-1,1])bx(q,0,.76,s*.54,2.1,.36,.07,S.timberD);bx(q,-1.02,.76,0,.07,.36,1.1,S.timberD);}else bx(q,0,.62,0,2.1,.5,1.15,S.timberD,S.timber);
  for(const s of [-1,1]){wheel(q,-.15,.5,s*.72,.5,.14,S.rust,s);q.tube([1.05,.66,s*.4],[2.2,.08,s*.3],.045,S.timberD,{n:q.hi?4:3});}
  if(load===1){q.dome(-.1,.76,0,.9,.62,.5,b.k.pal.nat.straw,{n:6,rings:2});}else{crate(q,-.5,.76,.1,.6,S.timber,.2);crate(q,.25,.76,-.12,.52,pick(S.fresh,seed),-.3);if(q.hi)sack(q,.7,.76,.25,.28,S.canvas[0]);}});}
// a small farm tractor (the frame's +x is its front): big rear wheels, a painted hood, an open cab frame, an exhaust stack
function tractor(b,x,y,z,ry,seed){const S=b.k.pal.set,hi=b.hi,body=pick([S.fresh[2],S.fresh[0],S.paint[6],S.fresh[2]],seed),g=b.k.glow;b.at(x,y,z,ry,q=>{
  for(const s of [-1,1]){wheel(q,-.55,.72,s*.82,.72,.42,S.white,s);wheel(q,1.05,.42,s*.66,.42,.26,S.white,s);}
  if(hi){q.bev(.55,.62,0,1.5,.62,.74,body,{ch:.07});q.bev(-.5,1.05,0,.6,.24,.62,S.timberD,{ch:.04});}else bx(q,.55,.62,0,1.5,.62,.74,body);bx(q,-.55,.55,0,1.1,.5,1.1,S.iron);   // hood, rear frame, seat
  if(hi)bx(q,1.31,.72,0,.05,.44,.62,S.iron);for(const s of [-1,1])plate3(q,[1.345,1.0,s*.2],.13,g(0xffd59a,1.2));
  q.tube([.9,1.24,.2],[.9,2.15,.2],.06,S.rust,{n:hi?5:3});if(hi)q.cyl(.9,2.15,.2,.1,.12,S.iron,{n:5,r2:.04});
  for(const sx of [-1.02,-.02])for(const sz of [-1,1])q.tube([sx,1.0,sz*.5],[sx,2.2,sz*.5],.04,S.iron,{n:hi?4:3});
  bx(q,-.52,2.2,0,1.25,.07,1.2,pick(S.paint,seed+2));if(hi){q.tube([.05,1.24,0],[-.2,1.62,0],.03,S.iron,{n:3});q.tube([-.2,1.62,-.18],[-.2,1.62,.18],.035,S.iron,{n:4});for(const s of [-1,1])bx(q,-.55,1.42,s*.82,1.0,.06,.46,body);bx(q,-1.2,.5,0,.2,.2,.9,S.rust);}});}
// a small lamp plate facing +x of the frame (headlights)
function plate3(b,p,s,m){b.quad([p[0],p[1]-s/2,p[2]+s/2],[p[0],p[1]-s/2,p[2]-s/2],[p[0],p[1]+s/2,p[2]-s/2],[p[0],p[1]+s/2,p[2]+s/2],m);}
// a rectangular hay bale / a round one lying on its side (axis z)
const bale=(b,x,y,z,ry=0)=>b.at(x,y,z,ry,q=>{bx(q,0,0,0,1.1,.5,.55,b.k.pal.nat.straw);if(q.hi)for(const s of [-.3,.3])bx(q,s,0,0,.04,.51,.57,b.k.pal.set.timberD);});
const roundBale=(b,x,y,z,r,t,ry=0)=>b.at(x,y,z,ry,q=>q.tube([0,r,-t/2],[0,r,t/2],r,b.k.pal.nat.straw,{n:q.hi?8:6,caps:true}));

// ------------------------------------------------------------------ settler-hall ----------------------------------------
// The meeting hall, the town's proudest building: a tall timber-and-composite nave under a steep patched gable roof, its
// gable end and wide double doors facing +z, low side aisles under lean-to roofs, a bell cupola on the ridge, a porch with
// the notice board, lanterns and string lights, a field-stone chimney at the back.
WK.model('settler-hall',(b,o)=>{const {pal,tint,mat,glow}=b.k,S=pal.set,w=o.w,d=o.d,h=o.h,sd=o.seed|0,hi=b.hi;
 const wall=pick([S.paint[1],S.paint[2],S.paint[5],S.paint[0]],sd),aisle=sd%2?S.comp:S.white,accent=pick(S.fresh,sd+1),gold=mat(0xc9a04a,'metal',.25),roofs=[S.roof,tint(S.roof,1.25),S.roofRust,tint(S.roof,.85)];
 const f0=.22,nw=w*.29,z0=-d/2+.5,z1=d/2-1.85,zc=(z0+z1)/2,len=z1-z0,wh=h*.46,yr=h*.8,k=(yr-wh)/nw,ov=.42,xe=nw+ov,ye=wh-k*ov,xa=w/2-.5,ya=h*.25,yc=h*.365,zf=z1+.6,zb=z0-.25;
 b.bev(0,-.5,0,w-.4,.72,d-.4,S.conc,{ch:.14});
 // the nave: stone footing, painted plank walls, timber gables
 bx(b,0,f0,zc,nw*2+.18,.55,len+.18,S.stone);b.bev(0,f0+.5,zc,nw*2,wh-f0-.5,len,wall,{ch:.07});
 for(const z of [z1,z0])b.tri([-nw,wh,z],[nw,wh,z],[0,yr,z],S.timber,[0,wh,zc]);
 // the roof: corrugated sheets of three ages, a ridge cap, cream barge boards on the front gable
 const zs=[zb,z0+len*.34,z0+len*.7,zf];for(const sx of [-1,1])for(let i=0;i<3;i++)b.quad([0,yr,zs[i]],[0,yr,zs[i+1]],[sx*xe,ye,zs[i+1]],[sx*xe,ye,zs[i]],pick(roofs,sd+i*(sx>0?1:3)+(sx>0?0:1)),[0,wh,zc]);
 b.tube([0,yr+.04,zb-.05],[0,yr+.04,zf+.05],.11,S.rust,{n:4});
 for(const sx of [-1,1]){b.tube([sx*(xe+.03),ye-.04,zf+.02],[0,yr+.02,zf+.02],.1,S.white,{n:4});if(hi){b.quad([sx*xe,ye-.16,zb],[sx*xe,ye-.16,zf],[sx*xe,ye,zf],[sx*xe,ye,zb],tint(S.roof,.6),[0,ye,zc]);b.quad([0,yr,zf],[sx*xe,ye,zf],[sx*xe,ye-.2,zf-.42],[0,yr-.2,zf-.42],tint(S.roof,.45),[0,yr+3,zf]);}}
 if(hi){const sl=(sx,t,z,ww,dd,m)=>{const x0=sx*xe*t,x1=sx*xe*(t+ww/xe),y0=yr-(yr-ye)*t+.035,y1=yr-(yr-ye)*(t+ww/xe)+.035;b.quad([x0,y0,z],[x0,y0,z+dd],[x1,y1,z+dd],[x1,y1,z],m,[0,wh,zc]);};
  sl(1,.3,z0+len*.12,1.1,1.3,pick(S.paint,sd+4));sl(-1,.5,z0+len*.5,1.2,1.0,S.scrap);sl(-1,.12,z0+len*.1,.9,1.2,S.roofRust);sl(1,.55,z0+len*.62,1.0,.9,S.rust);}
 // side aisles under lean-to roofs, their lit windows, the clerestory lights above them
 const az0=z0+.75,az1=z1-.75,azc=(az0+az1)/2,alen=az1-az0;
 for(const sx of [-1,1]){const axc=sx*(nw+xa)/2,aw=xa-nw;b.bev(axc,f0,azc,aw+.04,ya-f0,alen,aisle,{ch:.06});
  b.quad([sx*nw,yc,az0-.22],[sx*nw,yc,az1+.22],[sx*(xa+.32),ya-.1,az1+.22],[sx*(xa+.32),ya-.1,az0-.22],sx>0?S.roofRust:tint(S.roofRust,.8),[axc,0,azc]);
  for(const z of [az0,az1])b.tri([sx*nw,ya,z],[sx*xa,ya,z],[sx*nw,yc,z],aisle,[axc,ya,azc]);
  if(hi)b.tube([sx*(xa+.32),ya-.12,az0-.22],[sx*(xa+.32),ya-.12,az1+.22],.06,S.timberD,{n:4});
  b.at(sx*(xa+.02),0,azc,sx*Math.PI/2,q=>{for(const u of [-.27,.27])win(q,u*alen,f0+1.0,0,.9,1.15,{bar:true,sillM:S.timber});if(hi)patchP(q,0,f0+.35,0,.8,1.1,sx>0?S.scrap:pick(S.paint,sd+6));});
  b.at(sx*(nw+.01),0,zc,sx*Math.PI/2,q=>{for(let i=-1;i<=1;i++){plate(q,i*len*.27,yc+.22,.02,.9,wh-yc-.5,S.timberD);plate(q,i*len*.27,yc+.28,.04,.78,wh-yc-.62,i===0&&sd%2?S.amber:S.warm);}});}
 // the front: double doors in fresh paint under a lit transom, tall lit windows, timber posts and a tie beam, a round gable light
 b.at(0,0,z1,0,q=>{const py=f0+.22,dw=1.32,dh=h*.25;
  for(const s of [-1,1]){if(hi)bx(q,s*dw/2,py,.04,dw-.04,dh,.08,accent);else plate(q,s*dw/2,py,.04,dw-.04,dh,accent);if(hi){plate(q,s*dw/2,py+dh*.55,.09,dw*.5,dh*.28,tint(accent,.72));plate(q,s*.12,py+dh*.45,.09,.07,.3,S.lamp);}}
  bx(q,0,py+dh,.05,dw*2+.36,.16,.14,S.timberD);for(const s of [-1,1])bx(q,s*(dw+.1),py,.05,.16,dh,.14,S.timberD);
  plate(q,0,py+dh+.2,.03,dw*2+.1,.62,S.timberD);plate(q,0,py+dh+.27,.05,dw*2-.1,.48,S.warm);if(hi)for(const s of [-1,0,1])plate(q,s*dw*.66,py+dh+.27,.06,.06,.48,S.timberD);
  for(const s of [-1,1]){win(q,s*(nw-.72),py+.75,0,.72,dh-.5,{bar:true});bx(q,s*(nw-.1),f0,.05,.22,wh-f0,.16,S.timberD);}
  bx(q,0,wh-.14,.06,nw*2+.3,.26,.2,S.timberD);if(hi)bx(q,0,wh+.12,.05,.2,yr-wh-.5,.14,S.timberD);
  const ry=wh+(yr-wh)*.36,rr=(yr-wh)*.2;disc(q,0,ry,.1,rr+.14,S.white,hi?10:6);disc(q,0,ry,.13,rr,S.amber,hi?10:6);if(hi){plate(q,0,ry-rr,.15,.07,rr*2,S.timberD);plate(q,0,ry-.035,.15,rr*2,.07,S.timberD);}});
 // the porch: plank deck, four posts, a lean-to roof, rails, lanterns, the notice board, a bench
 const pz1=d/2-.32,pw=nw*2+.5,py=f0+.22,yp1=h*.285,pzc=(z1+pz1)/2,xs=[-pw/2+.14,-1.62,1.62,pw/2-.14];
 b.bev(0,f0,pzc,pw,.22,pz1-z1,S.timber,{ch:.04});bx(b,0,f0,pz1+.11,3.3,.11,.22,S.stone);
 for(const x of xs)bx(b,x,py,pz1-.15,.18,yp1-py,.18,S.timberD);bx(b,0,yp1-.2,pz1-.15,pw,.2,.16,S.timberD);
 sheet(b,[-pw/2-.22,yc-.12,z1+.02],[pw/2+.22,yc-.12,z1+.02],[pw/2+.22,yp1,pz1+.24],[-pw/2-.22,yp1,pz1+.24],S.roofRust,tint(S.roof,.55));
 if(hi){for(const s of [-1,1]){b.rail([[s*(pw/2-.14),py,pz1-.15],[s*1.62,py,pz1-.15]],.85,S.timber,{step:1.1,r:.045});b.rail([[s*(pw/2-.14),py,pz1-.15],[s*(pw/2-.14),py,z1+.1]],.85,S.timber,{step:1.3,r:.045});b.tube([s*1.62,yp1-.7,pz1-.15],[s*1.1,yp1-.2,pz1-.15],.05,S.timberD,{n:3});}
  // notice board with pinned sheets, under a small lamp
  b.at(-(nw-1.72),py,z1+.14,0,q=>{for(const s of [-1,1])bx(q,s*.62,0,0,.09,1.95,.09,S.timberD);bx(q,0,.85,0,1.34,1.0,.07,S.timber);plate(q,-.34,1.25,.05,.36,.46,S.white);plate(q,.14,1.08,.05,.42,.34,S.canvas[0]);plate(q,.2,1.5,.05,.3,.26,pick(S.fresh,sd+2));plate(q,-.3,.95,.05,.3,.24,S.canvas[3]);bx(q,0,1.88,.04,1.5,.06,.26,S.roofRust);plate(q,0,1.82,.1,.5,.05,S.lamp);});
  b.at(nw-1.3,py,z1+.34,0,q=>{bx(q,0,.4,0,1.5,.08,.42,S.timber);for(const s of [-1,1])bx(q,s*.58,0,0,.09,.4,.36,S.timberD);bx(q,0,.48,-.2,1.5,.5,.06,S.timber);});}
 for(const s of [-1,1])lantern(b,s*(1.32+.52),yp1-.2,pz1-.5,1.1);
 stringLights(b,[-pw/2-.1,yp1-.04,pz1+.2],[pw/2+.1,yp1-.04,pz1+.2],9,.22);
 // the bell cupola on the ridge: cream base, open timber frame, the bell, a rusty pyramid cap and an amber finial light
 const cz=z1-1.25,cb=yr+.42,ph=h*.105,ct=cb+.12+ph,pk=h*.09;
 bx(b,0,yr-k*.86,cz,1.72,k*.86+.42,1.72,S.white);bx(b,0,cb,cz,1.96,.12,1.96,S.timberD);
 for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){if(hi)bx(b,sx*.72,cb+.12,cz+sz*.72,.16,ph,.16,S.timberD);else b.tube([sx*.72,cb+.12,cz+sz*.72],[sx*.72,ct,cz+sz*.72],.1,S.timberD,{n:3});}
 b.cyl(0,cb+.12+ph*.22,cz,.5,ph*.52,gold,{n:hi?8:6,r2:.2,bot:true});if(hi){b.tube([0,cb+.12+ph*.74,cz],[0,ct,cz],.05,S.iron,{n:3});b.ball(0,cb+.12+ph*.2,cz,.1,S.iron,true);bx(b,0,ct-.14,cz,1.6,.14,.14,S.timberD);}
 b.loft([{p:b.k.rect(2.36,2.36,0,0,cz),y:ct},{p:b.k.rect(.16,.16,0,0,cz),y:ct+pk}],(r,i)=>i%2?S.roofRust:tint(S.roofRust,.82),{bot:true});
 b.tube([0,ct+pk-.05,cz],[0,h*1.1-.2,cz],.05,S.iron,{n:4});b.gem(0,h*1.1-.14,cz,.13,.16,.13,S.lamp);if(hi)b.halo(0,h*1.1-.14,cz,.7,0xffb060,.3);
 stringLights(b,[.9,cb+.1,cz+.9],[pw/2+.2,yp1+.05,pz1+.2],8,.5);stringLights(b,[-.9,cb+.1,cz+.9],[-pw/2-.2,yp1+.05,pz1+.2],8,.5);
 // the back: a field-stone chimney up the gable, a back door, a lit window; yard things in the corners
 const chx=-nw*.42,chh=wh+(yr-wh)*.9;bx(b,chx,f0,z0-.2,1.0,wh*.5,.44,S.stone);bx(b,chx,f0+wh*.5,z0-.16,.74,chh-f0-wh*.5,.36,S.stone);bx(b,chx,chh,z0-.16,.9,.14,.5,S.conc);if(hi)b.cyl(chx,chh+.14,z0-.16,.16,.4,S.iron,{n:6});
 b.at(0,0,z0,Math.PI,q=>{dr(q,-nw*.45,f0+.1,0,.95,2.0,tint(accent,.8));win(q,-nw*.45,wh*.62,0,.8,.9,{bar:true});if(hi){patchP(q,nw*.55,f0+2.3,0,1.2,1.5,S.scrap);bx(q,-nw*.45,f0,.2,1.3,.1,.3,S.stone);}});
 barrel(b,xa-.5,f0,az1+.55,.33,.9,S.rust);if(hi){planter(b,-(xa-.62),f0,az1+.6,1.3,.5,sd);crate(b,xa-.45,f0,az0-.42,.6,S.timber,.3);crate(b,-(xa-.5),f0,az0-.4,.55,pick(S.fresh,sd+3),.15);
  bunting(b,[-pw/2,yp1-.32,pz1-.02],[pw/2,yp1-.32,pz1-.02],9,sd,.12);b.pool(0,.26,pz1+.5,2.4,.6,0xffa84a,.14);}
});

// ------------------------------------------------------------------ settler-block ---------------------------------------
// a prefab habitat module: a painted shell on an iron skid with a roof rim
function module(b,x,y,z,w,h,d,m,rim){const S=b.k.pal.set;b.bev(x,y+.16,z,w,h-.28,d,m,{ch:.09});bx(b,x,y,z,w+.08,.18,d+.08,S.iron);bx(b,x,y+h-.14,z,w+.16,.14,d+.16,rim||S.roof);}
// a striped canvas awning over an opening on a wall facing +z of the frame (two cloth colours alternate)
function awning(b,x,y,z,w,dep,drop,n,c0,c1,o={}){for(let i=0;i<n;i++){const x0=x-w/2+w*i/n,x1=x0+w/n,m=i%2?c1:c0;sheet(b,[x0,y,z],[x1,y,z],[x1,y-drop,z+dep],[x0,y-drop,z+dep],m,b.k.tint(m,.6));if(b.hi&&o.val!==false){const xm=(x0+x1)/2;b.tri([x0,y-drop,z+dep],[x1,y-drop,z+dep],[xm,y-drop-(o.val||.26),z+dep+.02],m);}}}
// a tilted solar panel on a frame (tilt toward +z of the frame)
function solarPanel(b,x,y,z,w,dp,tilt,ry=0,m){const S=b.k.pal.set,navy=m||b.k.mat(0x16284a,'solar',0),rise=Math.sin(tilt)*dp,run=Math.cos(tilt)*dp;b.at(x,y,z,ry,q=>{q.at(0,.25,run/2,0,r=>{bx(r,0,0,-dp/2,w,.08,dp,S.white,navy);},tilt);
  for(const s of [-1,1]){q.tube([s*(w/2-.12),0,-run/2+.1],[s*(w/2-.12),.25+rise,-run/2+.1],.04,S.rust,{n:3});if(q.hi)q.tube([s*(w/2-.12),0,run/2-.1],[s*(w/2-.12),.3,run/2-.1],.04,S.rust,{n:3});}});}
// Three prefab habitat modules stacked off-centre and lived in: salvaged panels, a mural down the windowless side, a timber
// balcony that is also the ground-floor porch, an outside stair, lit windows on every floor, and the roof kit (by seed).
WK.model('settler-block',(b,o)=>{const {pal,tint,mat,glow}=b.k,S=pal.set,w=o.w,d=o.d,h=o.h,sd=o.seed|0,hi=b.hi,PI=Math.PI;
 const cA=pick(S.paint,sd+3),cB=pick(S.paint,sd),cC=pick(S.paint,sd+6),accent=pick(S.fresh,sd),mur=[pick(S.fresh,sd+1),pick(S.fresh,sd+2),pick(S.fresh,sd+3)];
 const f0=.22,zb=-d/2+.55,zf1=d*.28,hs=h-f0,y1=f0+hs*.345,y2=y1+hs*.335,y3=h;
 const A={x0:-w*.44,x1:w*.36,z0:zb,z1:zf1},B={x0:-w*.43,x1:w*.24,z0:zb+.1,z1:zf1-.62},C={x0:-w*.2,x1:w*.3,z0:zb+.25,z1:zf1-1.5};
 const mod=(M,ya,yb,m,rim)=>module(b,(M.x0+M.x1)/2,ya,(M.z0+M.z1)/2,M.x1-M.x0,yb-ya,M.z1-M.z0,m,rim);
 b.bev(0,-.5,0,w-.4,.72,d-.4,S.conc,{ch:.14});
 mod(A,f0,y1,cA,S.roof);mod(B,y1,y2,cB,tint(S.roof,1.2));mod(C,y2,y3,cC,S.roofRust);
 // front walls: door, shuttered lit windows, salvaged panels
 b.at(0,0,A.z1,0,q=>{dr(q,-.2,f0+.2,0,1.0,2.1,tint(accent,.85));win(q,A.x0+1.5,f0+1.25,0,1.1,1.15,{bar:true,shut:pick(S.fresh,sd+2)});win(q,A.x1-1.7,f0+1.25,0,1.3,1.15,{bar:true,glass:S.amber});
  if(hi){patchP(q,A.x1-3.3,f0+.4,0,1.1,1.6,S.scrap);patchP(q,A.x0+2.9,f0+2.6,0,1.3,.8,pick(S.paint,sd+1));}});
 b.at(0,0,B.z1,0,q=>{const gx=B.x1-1.3;plate(q,gx,y1+.14,.03,1.2,2.25,S.timberD);plate(q,gx,y1+.22,.05,1.0,2.05,S.warm);if(hi){plate(q,gx,y1+.22,.07,.07,2.05,S.timberD);plate(q,gx,y1+1.2,.07,1.0,.07,S.timberD);}
  win(q,B.x0+1.4,y1+1.2,0,1.1,1.1,{bar:true});win(q,B.x0+3.6,y1+1.2,0,1.1,1.1,{bar:true,lit:sd%2===0,shut:hi?pick(S.fresh,sd+4):0});if(hi)patchP(q,B.x0+2.5,y1+.3,0,.9,.8,S.rust);});
 b.at(0,0,C.z1,0,q=>{const cx=(C.x0+C.x1)/2+.3;win(q,cx,y2+1.15,0,2.1,1.15,{bar:true,glass:S.warm});awning(q,cx,y2+2.9,.04,2.7,.85,.5,5,pick(S.canvas,sd+1),S.canvas[0]);if(hi)patchP(q,C.x0+.75,y2+.5,0,.9,1.3,pick(S.paint,sd+2));});
 // the mural: big hand-painted colour bands rising across the windowless side wall, a sun over them
 b.at(A.x0,0,0,-PI/2,q=>{const u0=A.z0+.25,u1=A.z1-.25,L=u1-u0,band=(ua,ub,ya,yb,th,m,z)=>q.quad([ua,ya,z],[ua,ya-th,z],[ub,yb-th,z],[ub,yb,z],m,[0,0,-9]);
  band(u0,u1,f0+1.3,y1-.35,.95,mur[0],.03);band(u0,u1,f0+2.3,y1-.3+.62,.95,mur[1],.035);band(u0,u1-L*.38,f0+3.3,y1-.3,.9,mur[2],.04);});
 b.at(B.x0,0,0,-PI/2,q=>{const u0=B.z0+.2,u1=B.z1-.2,band=(ua,ub,ya,yb,th,m,z)=>q.quad([ua,ya,z],[ua,ya-th,z],[ub,yb-th,z],[ub,yb,z],m,[0,0,-9]);
  band(u0,u1,y1+1.05,y1+2.6,.9,mur[1],.03);band(u0,u1,y1+2.0,y2-.3,.9,mur[2],.035);disc(q,u0+1.25,y1+2.75,.04,.62,S.fresh[2],hi?10:6);if(hi)disc(q,u0+1.25,y1+2.75,.05,.36,S.white,8);});
 // the balcony (the porch roof of the ground floor): plank deck on posts, a rail, string lights
 const bz1=d/2-.42,bx0=A.x0+.9,bx1=A.x1,byy=y1-.02;
 b.bev((bx0+bx1)/2,byy-.16,(B.z1+bz1)/2+.05,bx1-bx0,.16,bz1-B.z1-.1,S.timber,{ch:.04});
 for(const x of [bx0+.14,(bx0+bx1)/2+.9,bx1-.14])bx(b,x,f0,bz1-.14,.17,byy-.16-f0,.17,S.timberD);
 if(hi){b.rail([[bx0+.1,byy,B.z1+.2],[bx0+.1,byy,bz1-.1],[bx1-.1,byy,bz1-.1]],.95,S.timber,{step:1.3,r:.045});bx(b,(bx0+bx1)/2,byy-.36,bz1-.14,bx1-bx0,.2,.12,S.timberD);
  stringLights(b,[bx0+.1,byy+.98,bz1-.06],[bx1-.1,byy+.98,bz1-.06],10,.2);laundry(b,[bx0+.5,byy+1.75,bz1-.5],[bx0+3.6,byy+1.75,bz1-.5],sd);for(const x of [bx0+.5,bx0+3.6])b.tube([x,byy,bz1-.5],[x,byy+1.8,bz1-.5],.035,S.timberD,{n:3});
  planter(b,bx1-1.0,byy,bz1-.42,1.2,.4,sd);}
 else bx(b,(bx0+bx1)/2,byy+.5,bz1-.1,bx1-bx0,.45,.06,S.timber);
 lantern(b,-.95,f0+2.75,A.z1+.3);
 // the outside stair up the +x side to a landing on the first module's roof
 const sx=A.x1+.56,zs0=A.z0+.4,zs1=A.z1-1.15,ns=Math.max(4,Math.round((y1-f0)/.42)),run=(zs1-zs0)/ns,rise=(y1-f0)/ns;
 for(const s of [-1,1])b.tube([sx+s*.42,f0,zs0],[sx+s*.42,y1-.08,zs1],.07,S.timberD,{n:4});
 if(hi)for(let i=0;i<ns;i++)bx(b,sx,f0+(i+1)*rise-.08,zs0+(i+.5)*run,.84,.07,run+.05,S.timber);else sheet(b,[sx-.42,f0,zs0],[sx+.42,f0,zs0],[sx+.42,y1-.05,zs1],[sx-.42,y1-.05,zs1],S.timber);
 bx(b,sx,y1-.14,(zs1+A.z1)/2+.08,1.0,.12,A.z1-zs1+.16,S.timber);for(const z of [zs1+.1,A.z1+.05])b.tube([sx+.42,f0,z],[sx+.42,y1-.1,z],.07,S.timberD,{n:4});
 if(hi){b.rail([[sx+.44,f0,zs0],[sx+.44,y1,zs1],[sx+.44,y1,A.z1+.1]],.95,S.timber,{step:1.5,r:.04});b.tube([sx-.42,f0+(y1-f0)*.5,(zs0+zs1)/2],[sx+.42,f0,(zs0+zs1)/2+.6],.04,S.timberD,{n:3});}
 // side and back walls: lit windows, a patch, gas bottles, a drain pipe
 b.at(B.x1,0,0,PI/2,q=>{win(q,-(B.z0+1.6),y1+1.2,0,.95,1.05,{bar:true});if(hi)patchP(q,-(B.z1-1.3),y1+.9,0,1.0,1.4,S.scrap);});
 b.at(C.x1,0,0,PI/2,q=>win(q,-(C.z0+C.z1)/2,y2+1.2,0,1.1,1.05,{bar:true,glass:S.amber}));
 b.at(A.x1,0,0,PI/2,q=>{win(q,-(A.z1-.75),f0+1.3,0,.8,1.0,{bar:true,lit:false});});
 b.at(C.x0,0,0,-PI/2,q=>win(q,(C.z0+C.z1)/2,y2+1.25,0,1.0,1.0,{bar:true}));
 b.at(0,0,A.z0,PI,q=>{win(q,-(A.x0+2),f0+1.4,0,.9,1.0,{bar:true});win(q,-(A.x1-2),f0+1.4,0,.9,1.0,{bar:true,lit:false});if(hi){patchP(q,-.3,f0+.5,0,1.4,1.1,pick(S.paint,sd+4));for(const u of [0,.42])q.cyl(-(A.x0+3.4)+u,f0,.24,.17,.95,u?S.fresh[0]:S.white,{n:6,r2:.1});}});
 b.at(0,0,B.z0,PI,q=>{win(q,-(B.x0+1.8),y1+1.3,0,.9,1.0,{bar:true,glass:S.amber});win(q,-(B.x1-1.6),y1+1.3,0,.9,1.0,{bar:true});});
 b.at(0,0,C.z0,PI,q=>{win(q,-(C.x0+1.5),y2+1.3,0,.9,1.0,{bar:true});if(hi){bx(q,-(C.x1-1.2),y2+1.2,.25,.9,.6,.5,S.scrap);plate(q,-(C.x1-1.2),y2+1.3,.51,.6,.4,S.iron);}});
 if(hi)b.pipe([[C.x1-.3,y3-.1,C.z0-.12],[C.x1-.3,y2+.1,C.z0-.12],[B.x1-.3,y2-.2,B.z0-.14],[B.x1-.3,f0+.1,B.z0-.14]],.07,S.rust,{n:5});
 // the terrace on the second module: a rail, a tarp shade, a planter and a ladder up to it
 const tx0=B.x0+.12,tx1=C.x0-.1;
 if(hi){b.rail([[tx1-.1,y2,B.z1-.12],[tx0,y2,B.z1-.12],[tx0,y2,B.z0+.12],[tx1-.1,y2,B.z0+.12]],.9,S.timber,{step:1.4,r:.04});b.ladder([B.x0+.9,y1,B.z1+.12],[B.x0+.9,y2+.9,B.z1+.12],S.iron,{w:.5});
  planter(b,tx0+.5,y2,B.z0+1.2,.6,1.8,sd+2);crate(b,tx1-.6,y2,B.z0+.8,.55,S.timber,.3);}
 const tz0=B.z0+2.4,tz1=B.z1-.5,ty=y2+2.05;for(const [x,z] of [[tx0+.15,tz0],[tx0+.15,tz1]])b.tube([x,y2,z],[x,ty,z],.045,S.timberD,{n:3});
 sheet(b,[tx0,ty,tz0-.15],[tx0,ty,tz1+.15],[tx1+.1,ty+.45,tz1+.15],[tx1+.1,ty+.45,tz0-.15],pick(S.canvas,sd+2));
 // roof kit (by seed): a water tank, garden boxes, or a solar panel; always a stovepipe and an aerial
 const rcx=(C.x0+C.x1)/2,rcz=(C.z0+C.z1)/2;
 if(sd%3===0)waterTank(b,rcx+.9,y3,rcz-.3,.85,2.25,S.tank,1);
 else if(sd%3===1){planter(b,rcx+.6,y3,rcz+.9,2.6,.6,sd);planter(b,rcx+1.3,y3,rcz-.9,1.2,.6,sd+1);if(hi){for(const s of [-1,1])b.tube([rcx+.6+s*1.2,y3,rcz+.2],[rcx+.6+s*1.2,y3+1.5,rcz+.2],.035,S.timberD,{n:3});b.tube([rcx-.6,y3+1.5,rcz+.2],[rcx+1.8,y3+1.5,rcz+.2],.035,S.timberD,{n:3});b.gem(rcx+.2,y3+1.0,rcz+.2,.5,.5,.12,S.leaf);b.gem(rcx+1.1,y3+.9,rcz+.2,.45,.6,.12,S.leafD);}}
 else{solarPanel(b,rcx+.7,y3,rcz,2.6,1.7,.5);if(hi)bx(b,rcx+2.0,y3,rcz-1.3,.5,.5,.4,S.scrap);}
 stovepipe(b,C.x0+.7,y3,C.z0+.8,1.7,1);
 b.tube([C.x1-.4,y3,C.z1-.4],[C.x1-.4,y3+2.3,C.z1-.4],.035,S.iron,{n:3});if(hi){b.gem(C.x1-.4,y3+2.36,C.z1-.4,.07,.09,.07,glow(0xff5a3a,1.2));b.tube([C.x1-.75,y3+1.8,C.z1-.4],[C.x1-.05,y3+1.8,C.z1-.4],.02,S.iron,{n:3});b.tube([C.x1-.65,y3+1.5,C.z1-.4],[C.x1-.15,y3+1.5,C.z1-.4],.02,S.iron,{n:3});}
 clutter(b,A.x0+.9,A.z1+.75,hi?3:1,sd+1,1);if(hi){barrel(b,bx1-.6,f0,A.z1+.6,.3,.85,S.rust);b.pool(-.2,.26,bz1+.1,2.2,.5,0xffa84a,.13);}
});

// ------------------------------------------------------------------ settler-shop ----------------------------------------
// a market stall front: plank counter with produce boxes, a striped awning on posts, hanging lanterns
function stall(b,o){const {S,w,z0,z1,y0,ya,yb,sd,c0,c1,n}=o,hi=b.hi,pzs=z1-.22,lite=o.lite&&!hi,pt=yb+(ya-yb)*.22/(z1-z0)-.02;
 awning(b,0,ya,z0,w,z1-z0,ya-yb,n,c0,c1);
 for(const x of o.posts){if(lite)b.tube([x,y0,pzs],[x,pt,pzs],.09,S.timberD,{n:3});else bx(b,x,y0,pzs,.16,pt-y0,.16,S.timberD);}if(!lite)bx(b,0,yb-.14,pzs,w-.1,.13,.12,S.timberD);
 const cw=o.cw,cx=o.cx,cz=o.cz;if(hi)b.bev(cx,y0,cz,cw,.86,.62,S.timber,{ch:.04});else bx(b,cx,y0,cz,cw,.9,.62,S.timber,b.k.tint(S.timber,1.25));if(hi)bx(b,cx,y0+.86,cz,cw+.16,.07,.78,S.timberD,b.k.tint(S.timber,1.25));plate(b,cx,y0+.2,cz+.32,cw-.3,.42,pick(S.fresh,sd+1));
 const goods=[S.leaf,S.fresh[2],S.fresh[0],S.leafD,S.canvas[3]],ng=hi?Math.max(2,Math.round(cw/.95)):lite?1:2;for(let i=0;i<ng;i++){const gx=cx-cw/2+cw*(i+.5)/ng;bx(b,gx,y0+.93,cz,cw/ng-.14,.2,.58,S.timberD,pick(goods,sd+i));}
 for(let i=0;i<o.lamps;i++){const lx=-w/2+w*(i+.5)/o.lamps;if(lite)b.gem(lx,yb-.34,pzs-.04,.11,.14,.11,S.lamp);else lantern(b,lx,yb-.14,pzs-.04,.9);}}
// The market workshop: a false-front store with its painted sign on the roof edge, an open shopfront behind a counter under
// a striped awning, a scrap roof with a turbine vent, and the trade's clutter.
WK.model('settler-shop',(b,o)=>{const {pal,tint,mat,glow}=b.k,S=pal.set,w=o.w,d=o.d,h=o.h,sd=o.seed|0,hi=b.hi,PI=Math.PI;
 const wall=pick(S.paint,sd+2),accent=pick(S.fresh,sd),c0=pick([S.canvas[1],S.canvas[2],S.canvas[4],S.canvas[3]],sd),c1=S.canvas[0],dark=mat(0x1d1712,'flat'),roofs=[S.roof,S.roofRust,S.scrap];
 const f0=.22,bz0=-d/2+.45,bz1=-d*.05,bzc=(bz0+bz1)/2,bw=w-1.0,yw=h*.5,yf=h*.66,ybk=h*.5;
 b.bev(0,-.5,0,w-.4,.72,d-.4,S.conc,{ch:.14});
 // the workshop body, its lean-to roof in three mismatched sheets, the plank false front
 b.bev(0,f0,bzc,bw,yw-f0,bz1-bz0,wall,{ch:.08});bx(b,0,f0,bzc,bw+.1,.95,bz1-bz0+.1,S.timber);
 for(let i=0;i<3;i++){const x0=-bw/2-.2+(bw+.4)*i/3,x1=x0+(bw+.4)/3;b.quad([x0,yf-.06,bz1],[x1,yf-.06,bz1],[x1,ybk,bz0-.22],[x0,ybk,bz0-.22],pick(roofs,sd+i),[0,0,bzc]);}
 for(const s of [-1,1])b.tri([s*bw/2,yw,bz0],[s*bw/2,yw,bz1],[s*bw/2,yf-.08,bz1],wall,[0,yw,bzc]);
 bx(b,0,yw-.3,bz1-.02,bw+.16,yf-yw+.42,.16,S.timber);if(hi)bx(b,0,yf+.1,bz1-.02,bw+.3,.1,.26,S.timberD);
 // the sign on the roof edge: a hand-painted board on struts with two lamps over it
 const sw=w*.46,sy=yf+.24,sh=Math.min(h*.2,h-sy-.42);bx(b,0,sy,bz1,sw,sh,.12,accent);bx(b,0,sy+sh,bz1,sw*.5,sh*.28,.12,accent);
 plate(b,0,sy+sh*.34,bz1+.07,sw*.74,sh*.2,S.white);if(hi){plate(b,-sw*.1,sy+sh*.66,bz1+.07,sw*.4,sh*.14,S.white);disc(b,sw*.34,sy+sh*.74,bz1+.07,sh*.16,S.fresh[2],6);for(const s of [-1,1]){b.tube([s*sw*.36,sy+.1,bz1-.06],[s*sw*.36,yf-.3,bz1-.9],.04,S.timberD,{n:3});b.tube([s*sw*.3,sy+sh,bz1],[s*sw*.3,sy+sh+.22,bz1+.3],.025,S.iron,{n:3});plate(b,s*sw*.3,sy+sh+.14,bz1+.31,.22,.1,S.lamp);}}
 // the shopfront: a dark open bay with lit shelves, the workshop door
 b.at(0,0,bz1+.06,0,q=>{const ox=-bw*.14,ow=bw*.6;plate(q,ox,f0+.15,.03,ow,yw-f0-.75,dark);plate(q,ox,f0+1.55,.05,ow-.3,.07,S.timber);plate(q,ox,f0+.95,.05,ow-.3,.07,S.timber);
  for(let i=0;i<(hi?5:3);i++)plate(q,ox-ow*.38+ow*.19*i*(hi?1:1.9),f0+(i%2?1.03:1.63),.06,.34,.3,i%3?S.warm:S.amber);
  bx(q,ox,yw-.6,.04,ow+.3,.16,.12,S.timberD);for(const s of [-1,1])bx(q,ox+s*(ow/2+.08),f0,.04,.16,yw-f0-.5,.12,S.timberD);
  dr(q,bw/2-1.0,f0+.1,0,.95,2.0,tint(accent,.8));});
 stall(b,{S,w:bw+.3,z0:bz1+.1,z1:d/2-.28,y0:f0,ya:yw-.06,yb:h*.45,sd,c0,c1,n:8,posts:[-bw/2+.05,-bw*.17,bw*.17,bw/2-.05],cw:bw*.56,cx:-bw*.16,cz:d/2-1.15,lamps:3});
 // side and back walls, the roof kit: a turbine vent, a stovepipe, a patch
 for(const s of [-1,1])b.at(s*bw/2,0,bzc,s*PI/2,q=>{win(q,0,f0+1.15,0,.9,1.0,{bar:true,lit:s>0||sd%2===0});if(hi)patchP(q,s*.9,f0+.3,0,.8,1.0,s>0?S.scrap:pick(S.paint,sd+5));});
 b.at(0,0,bz0,PI,q=>{win(q,bw*.2,f0+1.2,0,1.0,.9,{bar:true});if(hi){dr(q,-bw*.25,f0+.1,0,.9,1.9,S.timber,{pane:false});for(const u of [0,.4])q.cyl(bw*.4+u,f0,.2,.16,.9,u?S.white:S.fresh[1],{n:6,r2:.1});}});
 const vx=-bw*.28,vz=bzc-.2,vy=ybk+(yf-ybk)*.45;b.cyl(vx,vy-.1,vz,.3,.5,S.iron,{n:hi?8:6});b.dome(vx,vy+.4,vz,.44,.36,.44,S.scrap,{n:hi?8:6,rings:2});
 stovepipe(b,bw*.36,vy-.2,bz0+.5,h-vy-.05,1);
 if(hi){const pm=pick(S.paint,sd+1);b.quad([.4,ybk+(yf-ybk)*.2+.03,bz0+.6],[1.9,ybk+(yf-ybk)*.2+.03,bz0+.6],[1.9,ybk+(yf-ybk)*.62+.03,bz0+1.8],[.4,ybk+(yf-ybk)*.62+.03,bz0+1.8],pm,[0,0,bzc]);}
 // the trade's clutter: stacked crates, barrels, sacks, a chalk board
 const fz=d/2-.75;crate(b,-bw/2+.45,f0,fz+.1,.7,S.timber,.2);barrel(b,bw/2-.4,f0,fz+.15,.32,.9,S.rust);sack(b,bw*.2,f0,d/2-1.2,.36,S.canvas[0]);
 if(hi){crate(b,-bw/2+.5,f0+.6,fz+.1,.55,pick(S.fresh,sd+2),-.3);crate(b,-bw/2+1.25,f0,fz+.2,.55,S.timberD,.5);barrel(b,bw/2-1.05,f0,fz+.3,.28,.75,pick(S.paint,sd+4));sack(b,bw*.2+.5,f0,d/2-1.0,.3,S.canvas[3]);sack(b,bw*.2+.2,f0+.42,d/2-1.15,.26,S.canvas[0]);
  b.at(bw*.36,f0,d/2-.6,-.3,q=>{sheet(q,[-.3,0,.18],[.3,0,.18],[.3,.85,0],[-.3,.85,0],S.iron,S.iron);plate(q,0,.25,.13,.4,.1,S.white);});
  bunting(b,[-bw/2,h*.43-.2,d/2-.36],[bw/2,h*.43-.2,d/2-.36],8,sd+1,.1);b.pool(0,.26,d/2-.2,3,.5,0xffa84a,.13);}
});

// ------------------------------------------------------------------ settler-barn ----------------------------------------
// a barrel roof along x in sheets: strips i = 0..n-1 run from the +z eave over the ridge to the -z eave; mf(seg, i) = the
// sheet's material, or null for an open strip
function tunnel(b,x0,x1,y,cz,r,rise,n,segs,mf){for(let s=0;s<segs;s++){const xa=x0+(x1-x0)*s/segs,xb=x0+(x1-x0)*(s+1)/segs;for(let i=0;i<n;i++){const m=mf(s,i);if(!m)continue;const a0=i/n*Math.PI,a1=(i+1)/n*Math.PI;
   b.quad([xa,y+Math.sin(a0)*rise,cz+Math.cos(a0)*r],[xb,y+Math.sin(a0)*rise,cz+Math.cos(a0)*r],[xb,y+Math.sin(a1)*rise,cz+Math.cos(a1)*r],[xa,y+Math.sin(a1)*rise,cz+Math.cos(a1)*r],m,[(xa+xb)/2,y,cz]);}}}
// an arch rib over such a roof, and the end wall under it (a fan facing sx along x)
function archRib(b,x,y,cz,r,rise,n,rr,m,sides=3){let p=null;for(let i=0;i<=n;i++){const a=i/n*Math.PI,q=[x,y+Math.sin(a)*rise*1.012,cz+Math.cos(a)*r*1.012];if(p)b.tube(p,q,rr,m,{n:sides});p=q;}}
const archRibbon=(b,x,y,cz,r,rise,n,w,m)=>tunnel(b,x-w/2,x+w/2,y,cz,r*1.012,rise*1.012,n,1,()=>m);
function archEnd(b,x,y,cz,r,rise,n,m,sx){for(let i=0;i<n;i++){const a0=i/n*Math.PI,a1=(i+1)/n*Math.PI;b.tri([x,y,cz],[x,y+Math.sin(a0)*rise,cz+Math.cos(a0)*r],[x,y+Math.sin(a1)*rise,cz+Math.cos(a1)*r],m,[x-sx,y+rise*.4,cz]);}}
// a curved patch / painted mark on an upright cylinder between two angles (x = cos, z = sin)
function arcBand(b,x,y,z,r,hh,a0,a1,m,n=3){for(let i=0;i<n;i++){const p=a0+(a1-a0)*i/n,q=a0+(a1-a0)*(i+1)/n;b.quad([x+Math.cos(p)*r,y,z+Math.sin(p)*r],[x+Math.cos(q)*r,y,z+Math.sin(q)*r],[x+Math.cos(q)*r,y+hh,z+Math.sin(q)*r],[x+Math.cos(p)*r,y+hh,z+Math.sin(p)*r],m,[x,y,z]);}}
// a barn door leaf on a wall facing +z of the frame: planks with a cream frame and cross brace
function barnLeaf(b,x,y,z,w,h,m){const S=b.k.pal.set,c=creamT(b),t=.2;if(b.hi)bx(b,x,y,z,w,h,.09,m);else plate(b,x,y,z+.05,w,h,m);const zz=z+.06;
 plate(b,x,y,zz,w,t,c);plate(b,x,y+h-t,zz,w,t,c);if(!b.hi)return;plate(b,x,y+h*.5-t/2,zz,w,t,c);for(const s of [-1,1])plate(b,x+s*(w/2-t/2),y,zz,t,h,c);
 for(const [ya,yb] of [[y+t,y+h*.5-t/2],[y+h*.5+t/2,y+h-t]])b.quad([x-w/2+t,ya,zz],[x-w/2+t+.2,ya,zz],[x+w/2-t,yb,zz],[x+w/2-t-.2,yb,zz],c,[x,y,zz-5]);}
// The workshop barn: a barrel-vault roof of mismatched corrugated sheets along x on low painted walls, timber gable ends,
// big sliding doors on the +x end (one half open on the dark workshop and its amber work light, a tractor nosing out), a
// lean-to down the -z side, a ridge ventilator with a weather vane, the cart parked on the apron.
WK.model('settler-barn',(b,o)=>{const {pal,tint,mat,glow,hash}=b.k,S=pal.set,w=o.w,d=o.d,h=o.h,sd=o.seed|0,hi=b.hi,PI=Math.PI;
 const wall=pick([S.paint[1],S.paint[5],S.paint[2],S.paint[6]],sd),roofs=[S.roof,tint(S.roof,1.22),S.roofRust,S.scrap,tint(S.roof,.86),tint(pick(S.paint,sd+2),.8)],dark=mat(0x17120e,'flat'),trim=creamT(b),doorM=pick([S.timber,S.paint[2],S.timber,S.paint[0]],sd);
 const f0=.22,x0=-w/2+.55,x1=w/2-3.1,xc=(x0+x1)/2,L=x1-x0,zA=-d/2+2.35,zB=d/2-.8,cz=(zA+zB)/2,r=(zB-zA)/2,wh=h*.36,rise=h*.52,yv=wh+rise,n=hi?10:6,segs=hi?5:3,ro=r+.3;
 b.bev(0,-.5,0,w-.4,.72,d-.4,S.conc,{ch:.14});
 bx(b,xc,f0,cz,L+.14,.5,2*r+.14,S.stone);b.bev(xc,f0+.45,cz,L,wh-f0-.45,2*r,wall,{ch:.07});
 // the roof: five bays of sheets of every age, timber ribs, cream barge arches, a ridge cap
 tunnel(b,x0-.3,x1+.5,wh,cz,ro,rise,n,segs,(s,i)=>{const q=hash(sd*131+s*17+i*29);return q<.52?roofs[0]:q<.68?roofs[1]:q<.8?roofs[4]:q<.93||!hi?roofs[2]:q<.975?roofs[3]:roofs[5];});
 archEnd(b,x1,wh,cz,ro-.02,rise-.02,n,S.timber,1);archEnd(b,x0,wh,cz,ro-.02,rise-.02,n,S.timber,-1);
 archRib(b,x1+.5,wh,cz,ro,rise,n,.15,trim,hi?4:3);if(hi){archRib(b,x0-.3,wh,cz,ro,rise,n,.15,trim,4);for(let s=1;s<segs;s++)archRib(b,x0-.3+(L+.8)*s/segs,wh,cz,ro,rise,n,.075,S.timberD,3);}
 b.tube([x0-.35,yv+.03,cz],[x1+.55,yv+.03,cz],.12,S.rust,{n:4});if(hi)for(const s of [-1,1])b.tube([x0-.3,wh-.02,cz+s*ro],[x1+.5,wh-.02,cz+s*ro],.08,S.timberD,{n:3});
 // the ridge ventilator and its weather vane; a stovepipe
 const vh=h-yv,vx=xc+L*.08;bx(b,vx,yv-.3,cz,2.3,.3+vh*.4,1.15,wall);b.gable(vx,yv+vh*.4,cz,2.3,vh*.3,1.15,S.roofRust,{over:.22,gable:S.timber});
 if(hi){for(const s of [-1,1])for(const u of [-.55,.55])plate(b,vx+u,yv+.06,cz+s*.58,.8,vh*.26,dark),b.quad([vx+u-.4,yv+.06,cz-.58],[vx+u+.4,yv+.06,cz-.58],[vx+u+.4,yv+.06+vh*.26,cz-.58],[vx+u-.4,yv+.06+vh*.26,cz-.58],dark,[vx,yv,cz]);
  b.tube([vx,yv+vh*.68,cz],[vx,h-.03,cz],.035,S.iron,{n:3});b.tube([vx-.45,h-.22,cz],[vx+.5,h-.22,cz],.03,S.iron,{n:3});b.tri([vx+.5,h-.22,cz],[vx+.22,h-.08,cz],[vx+.22,h-.36,cz],S.rust);b.tri([vx+.5,h-.22,cz],[vx+.22,h-.36,cz],[vx+.22,h-.08,cz],S.rust);}
 stovepipe(b,x0+L*.16,wh+rise*.82,cz-ro*.5,vh*.9+rise*.12,1);
 // the +x gable: track, one leaf shut, one slid aside, the dark workshop with its work light, the hay door and hoist
 const dw=r*1.1,dh=wh+rise*.22-f0;
 b.at(x1+.03,0,cz,PI/2,q=>{plate(q,-dw/4,f0,.02,dw/2,dh,dark);barnLeaf(q,dw/4,f0+.06,.05,dw/2-.05,dh-.08,doorM);barnLeaf(q,-dw*.82,f0+.06,.16,dw/2-.05,dh-.08,doorM);
  bx(q,-dw*.22,f0+dh+.02,.14,dw*1.72,.13,.2,S.iron);for(const s of [-1,1])bx(q,s*(dw/2+.09),f0,.03,.2,dh,.1,S.timberD);
  plate(q,-dw*.36,f0+dh-.75,.04,.3,.2,S.lamp);if(hi){plate(q,-dw*.12,f0+.2,.035,.5,1.5,mat(0x3a2a1c,'timber',.5));plate(q,-dw*.2,f0+1.9,.035,1.2,.09,mat(0x3a2a1c,'timber',.5));q.halo(-dw*.36,f0+dh-.7,.3,1.2,0xffb060,.4);}
  const hy=f0+dh+.75,hw=.95,hh=Math.min(1.25,rise*.3);plate(q,0,hy-.11,.03,hw+.28,hh+.22,trim);plate(q,0,hy,.05,hw,hh,S.timberD);
  if(hi){q.tube([0,hy+hh+.4,0],[0,hy+hh+.4,1.25],.07,S.timberD,{n:4});q.tube([0,hy+hh+.36,1.1],[0,hy+hh-.5,1.1],.018,S.iron,{n:3});bx(q,0,hy+hh-1.0,1.1,.5,.42,.36,b.k.pal.nat.straw);}});
 lantern(b,x1+.34,f0+dh-.1,cz+dw/2+.55,1.1);
 // the -x gable: a round lit window, a door, a patch
 b.at(x0-.03,0,cz,-PI/2,q=>{if(hi)disc(q,0,wh+rise*.45,.04,.68,trim,10);disc(q,0,wh+rise*.45,.06,.5,S.warm,hi?10:6);dr(q,-r*.4,f0+.08,0,1.0,2.1,doorM);win(q,r*.42,f0+1.2,0,1.0,1.1,{bar:true});if(hi)patchP(q,r*.3,wh+.4,0,1.3,1.0,S.scrap);});
 // +z wall: lit windows, a ladder left against the eave, a barrel under the eave
 b.at(xc,0,zB,0,q=>{for(const u of [-.32,0,.32])win(q,u*L,f0+1.15,0,1.05,1.0,{bar:true,lit:u!==0||sd%2===0,glass:u<0?S.amber:S.warm});if(hi){patchP(q,L*.16,f0+.25,0,1.0,1.3,pick(S.paint,sd+4));patchP(q,-L*.44,f0+1.4,0,.7,1.1,S.scrap);}});
 if(hi)barrel(b,x0+.8,f0,zB+.42,.3,.9,S.tank);if(hi)b.ladder([xc+L*.18,f0,zB+.62],[xc+L*.18,wh+.5,zB+.2],S.timberD,{w:.5});
 // the lean-to down the -z side: posts, a mismatched roof, the hay, crates and a workbench under it
 const lx0=x0+1.5,lx1=x1-1.4,lz=-d/2+.5,ly0=wh-.2,ly1=h*.225,np=3;
 for(let i=0;i<3;i++){const xa=lx0+(lx1-lx0)*i/3,xb=lx0+(lx1-lx0)*(i+1)/3;sheet(b,[xa-.02,ly0,zA],[xb+.02,ly0,zA],[xb+.02,ly1,lz-.18],[xa-.02,ly1,lz-.18],pick([S.roofRust,S.scrap,S.roof],sd+i),tint(S.roof,.5));}
 for(let i=0;i<=np;i++){const px=lx0+.12+(lx1-lx0-.24)*i/np;if(hi)bx(b,px,f0,lz+.08,.17,ly1+.02-f0,.17,S.timberD);else b.tube([px,f0,lz+.08],[px,ly1,lz+.08],.11,S.timberD,{n:4});}bx(b,(lx0+lx1)/2,ly1-.16,lz+.08,lx1-lx0,.15,.13,S.timberD);
 b.at(xc,0,zA,PI,q=>{dr(q,L*.2,f0+.08,0,.95,2.0,doorM,{pane:false});win(q,-L*.1,f0+1.2,0,.9,.9,{bar:true});});
 const lzc=(zA+lz)/2;bale(b,lx0+.9,f0,lzc-.2,.1);bale(b,lx0+2.1,f0,lzc-.3,-.08);bale(b,lx0+1.5,f0+.5,lzc-.25,.2);crate(b,lx1-.7,f0,lzc-.3,.8,S.timber,.1);
 if(hi){crate(b,lx1-1.6,f0,lzc-.1,.65,pick(S.fresh,sd+1),.4);crate(b,lx1-.8,f0+.68,lzc-.3,.55,S.timberD,-.2);barrel(b,lx1-2.5,f0,lzc-.5,.3,.85,S.rust);
  bx(b,xc-.2,f0+.8,zA-.45,2.0,.09,.7,S.timber);for(const u of [-.85,.85])bx(b,xc-.2+u,f0,zA-.45,.1,.8,.6,S.timberD);bx(b,xc-.6,f0+.89,zA-.4,.5,.25,.3,S.scrap);lantern(b,xc+1.2,ly1+.35,lzc-.2,.9);}
 if(sd%2)waterTank(b,x0+.55,f0,zA-1.05,.62,h*.36,S.tank,1);else{roundBale(b,x0+.62,f0,zA-.72,.6,1.0,0);if(hi)roundBale(b,x0+.62,f0,zA-1.72,.5,.85,.1);}
 // the apron: the tractor nosing out of the open door, the cart, crates and drums
 tractor(b,x1+.75,f0,cz+dw/4,0,sd);cart(b,x1+1.85,f0,cz-dw/2-.2,PI/2-.22,sd,sd%2?2:1);
 crate(b,x1+.55,f0,cz-dw*.22,.75,S.timber,.12);barrel(b,x1+2.45,f0,d/2-.95,.32,.9,pick(S.fresh,sd+3));
 if(hi){crate(b,x1+.5,f0+.64,cz-dw*.22,.55,pick(S.fresh,sd+2),.5);barrel(b,x1+1.75,f0,d/2-.8,.32,.9,S.rust);b.pool(x1+1.2,.26,cz+dw/4,1.4,1.2,0xffa84a,.16);}
});

// ------------------------------------------------------------------ settler-water-tower ---------------------------------
// The colony's landmark: a patched, painted tank with iron hoops and a hand-painted colour band on a heavy rusty frame (four
// thick legs, a few girts and zigzag braces, a gusset plate at every joint: nothing thin enough to shimmer at a distance), a
// conical scrap roof, a plank walkway round the tank, a caged ladder, the riser pipe down the middle to the valve house, a
// half-way deck with a lantern, an aerial with the amber light on top.  o.h = total height (the tank starts at 0.72 h).
function waterTower(b,o,c){const {pal,tint,mat,glow}=b.k,S=pal.set,w=Math.min(o.w,o.d),h=o.h,sd=o.seed|0,hi=b.hi,PI=Math.PI,f0=c?.3:.22;
 const tankC=pick([S.tank,S.paint[3],S.paint[0],S.paint[1]],sd),bandC=pick(S.fresh,sd+(sd%4===0?2:0));
 const yt=h*.72,yT=h*.9,rt=w*(c?.31:.385),rp=w*(c?.37:.47),w0=w*(c?.56:.74),w1=w*(c?.4:.5),yd=yt-.3,nT=hi?(c?10:14):8;
 if(c)bx(b,0,0,0,o.w,.3,o.d,S.conc);else b.bev(0,-.5,0,o.w-.4,.72,o.d-.4,S.conc,{ch:.14});
 // the frame: legs, a ring of girts and one brace a face on every level (the braces zigzag up the tower)
 const C4=[[-1,-1],[1,-1],[1,1],[-1,1]],lg=(t,q)=>{const e=(w0+(w1-w0)*t)/2;return [q[0]*e,f0+(yd-f0)*t,q[1]*e];},L=c?2:(hi?4:3),rl=c?.13:.21,rg=c?.1:.16;
 for(const q of C4)b.tube(lg(0,q),lg(1,q),rl,S.rust,{n:hi?5:3});
 for(let k=0;k<L;k++)for(let i=0;i<4;i++){const a=C4[i],d=C4[(i+1)%4],up=(k+i)%2===0;b.tube(lg((k+1)/L,a),lg((k+1)/L,d),rg,S.rust,{n:hi?4:3});
  if(hi||!c||k===0)b.tube(lg(k/L,up?a:d),lg((k+1)/L,up?d:a),rg*.85,S.rust,{n:hi?4:3});}
 // gusset plates: a dark iron kite over every joint, on both faces that meet at the leg
 if(hi){const g=c?.46:.74,off=rl+.02,T0=lg(1,C4[0]),B0=lg(0,C4[0]),ul=Math.hypot(T0[0]-B0[0],T0[1]-B0[1],T0[2]-B0[2]);
  for(let k=0;k<=L;k++)for(let i=0;i<4;i++){const a=C4[i],d=C4[(i+1)%4],nx=(a[0]+d[0])/2*off,nz=(a[1]+d[1])/2*off;
   for(const [p,q] of [[a,d],[d,a]]){const J=lg(k/L,p),T=lg(1,p),B=lg(0,p),u=[(T[0]-B[0])/ul,(T[1]-B[1])/ul,(T[2]-B[2])/ul],hx=(q[0]-p[0])/2,hz=(q[1]-p[1])/2,g0=k?g:0,g1=k<L?g:0;
    b.quad([J[0]-u[0]*g0+nx,J[1]-u[1]*g0,J[2]-u[2]*g0+nz],[J[0]+hx*g*1.15+nx,J[1],J[2]+hz*g*1.15+nz],[J[0]+u[0]*g1+nx,J[1]+u[1]*g1,J[2]+u[2]*g1+nz],[J[0]-hx*rl+nx,J[1],J[2]-hz*rl+nz],S.iron,[0,J[1],0]);}}}
 for(const [sx,sz] of C4){if(!c)bx(b,sx*w0/2,f0,sz*w0/2,1.0,.5,1.0,S.conc);if(hi)b.tube([sx*w1/2,yd-(c?.9:1.9),sz*w1/2],[sx*rp*.66,yd,sz*rp*.66],c?.09:.13,S.rust,{n:4});}
 // the walkway and its rail (LOW: a plank parapet)
 const dk=c?.2:.26;b.cyl(0,yd,0,rp,dk,S.timber,{n:8,bot:true});const rpts=[];for(let i=0;i<=8;i++){const a=i/8*TAU;rpts.push([Math.cos(a)*(rp-.1),yd+dk,Math.sin(a)*(rp-.1)]);}
 if(!hi)hoop(b,0,yd+dk,0,rp-.08,c?.42:.6,S.timberD,8);else if(!c)b.rail(rpts,1.0,S.timberD,{step:9,r:.08,mid:false});
 else for(let i=0;i<8;i++){b.tube(rpts[i],[rpts[i][0],yd+.8,rpts[i][2]],.07,S.timberD,{n:3});b.tube([rpts[i][0],yd+.78,rpts[i][2]],[rpts[i+1][0],yd+.78,rpts[i+1][2]],.06,S.timberD,{n:3});}
 // the tank: paint, hoops, the hand-painted band and mark, repair patches, a level gauge
 b.cyl(0,yt-.1,0,rt,yT-yt+.1,tankC,{n:nT,bev:c?.06:.12,bot:true});const th=yT-yt;
 hoop(b,0,yt+th*.66,0,rt+.03,th*.17,bandC,nT);
 for(const t of hi?[.1,.42,.9]:[.42])hoop(b,0,yt+th*t,0,rt+.05,c?.07:.12,S.iron,nT);
 if(hi){arcBand(b,0,yt+th*.16,0,rt+.035,th*.22,2.3,2.95,S.rust,2);arcBand(b,0,yt+th*.5,0,rt+.035,th*.3,4.4,4.9,pick(S.paint,sd+5),2);arcBand(b,0,yt+th*.15,0,rt+.035,th*.2,5.6,6.1,S.scrap,2);
  arcBand(b,0,yt+th*.705,0,rt+.045,th*.08,.9,2.2,S.white,4);
  const ga=.35;b.at(Math.cos(ga)*(rt+.06),0,Math.sin(ga)*(rt+.06),PI/2-ga,q=>{plate(q,0,yt+th*.12,0,c?.16:.26,th*.5,S.white);plate(q,0,yt+th*.36,.02,c?.24:.4,c?.06:.1,S.fresh[0]);});}
 // conical scrap roof, the aerial and the amber light
 const ry=h*.058;b.cyl(0,yT,0,rt*1.1,ry,S.roofRust,{n:nT,r2:c?.1:.16,bot:true,band:(r,i)=>i%4===1?S.roof:i%4===3?tint(S.roofRust,.8):S.roofRust});
 b.tube([0,yT+ry-.05,0],[0,h-(c?.14:.3),0],c?.05:.08,S.iron,{n:4});b.gem(0,h-(c?.13:.2),0,c?.12:.2,c?.13:.2,c?.12:.2,S.lamp);if(hi){b.halo(0,h-.2,0,c?.45:.6,0xffb060,.25);if(!c)for(const [y,l] of [[.5,.5],[.75,.34]])b.tube([-l,yT+ry+(h-yT-ry)*y,0],[l,yT+ry+(h-yT-ry)*y,0],.05,S.iron,{n:3});}
 // riser pipe and the valve house at its foot
 b.tube([0,f0,0],[0,yt,0],c?.11:.2,S.rust,{n:hi?6:c?3:4});if(hi)for(const t of [.3,.62])hoop(b,0,f0+(yt-f0)*t,0,c?.14:.25,.12,S.iron,6);
 if(c){if(hi)bx(b,0,f0,0,.9,.6,.9,S.scrap);}else{b.bev(0,f0,0,1.3,1.0,1.3,pick(S.paint,sd+2),{ch:.06});bx(b,0,f0+1.0,0,1.5,.08,1.5,S.roofRust);if(hi){b.at(0,0,.66,0,q=>{disc(q,.2,f0+.55,.03,.24,S.fresh[0],6);plate(q,-.35,f0+.2,.02,.36,.6,S.iron);});b.pipe([[.65,f0+.3,0],[1.5,f0+.3,0],[1.5,f0+.9,0]],.09,S.rust,{n:4});b.box(1.5,f0+.9,0,.18,.12,.34,S.iron);}}
 // ladders: caged up the frame, a plain one up the tank
 if(hi||!c)cageLadder(b,[0,f0,w0/2+rl+.1],[0,yd,w1/2+rl+.12],S.iron,[1,0],[0,1],{w:c?.44:.6,cr:c?.38:.46,step:c?.9:1.2,hoopStep:c?3.2:4.4,cage:hi,k:c?1.5:2});
 if(hi){const lz=Math.sqrt(rt*rt*.75)+.14;cageLadder(b,[rt*.5,yd+dk,lz],[rt*.5,yT+.25,lz],S.iron,[1,0],[0,1],{w:c?.36:.5,step:c?.7:.9,cage:false,k:c?1.3:1.7});}
 if(c)return;
 // half-way deck: planks, a rail, a lantern and a crate; bunting and a name board lower down
 const tm=.5,ym=f0+(yd-f0)*tm,wm=w0+(w1-w0)*tm,yk=ym+.22;bx(b,0,ym,0,wm+.5,.22,wm+.5,S.timber);
 if(hi){const e=wm/2+.14;b.rail([[e,yk,e-1.1],[e,yk,-e],[-e,yk,-e],[-e,yk,e],[-1.1,yk,e]],.95,S.timberD,{step:9,r:.07,mid:false});crate(b,-e+.6,yk,-e+.6,.6,S.timber,.3);barrel(b,e-.55,yk,-e+.55,.28,.75,S.rust);lantern(b,-e+.25,yk+1.75,e-.25,1);b.tube([-e+.25,yk,e-.25],[-e+.25,yk+1.78,e-.25],.07,S.timberD,{n:4});
  const yb=f0+3.6,wb=(w0+(w1-w0)*(3.6/(yd-f0)))/2+rl+.04;bunting(b,[wb,yb,-wb],[wb,yb,wb],7,sd,.3);bunting(b,[-wb,yb,-wb],[wb,yb,-wb],7,sd+2,.3);
  b.at(-wb*.45,0,wb+.08,0,q=>{bx(q,0,yb-.5,0,1.5,.62,.07,bandC);plate(q,0,yb-.3,.05,1.1,.1,S.white);plate(q,-.2,yb-.12,.05,.6,.07,S.white);});
  b.tube([-w0/2+.5,f0,-w0/2+.5],[-w1/2+.5,yd,-w1/2+.5],.09,S.scrap,{n:4});b.pool(0,.26,2.2,1.3,.6,0xffa84a,.1);}
}
WK.model('settler-water-tower',(b,o)=>waterTower(b,o,false));

// ------------------------------------------------------------------ settler-greenhouse ----------------------------------
// a wheelbarrow (the frame's +x is its front)
function barrow(b,x,y,z,ry,m){const S=b.k.pal.set;b.at(x,y,z,ry,q=>{q.loft([{p:b.k.rect(.55,.4,0,.05,0),y:.3},{p:b.k.rect(.9,.6,0,.05,0),y:.62}],m,{top:false,bot:true});q.cap(b.k.rect(.82,.52,0,.05,0),.5,S.soil,true);wheel(q,.58,.2,0,.2,.1);for(const s of [-1,1]){q.tube([.5,.25,s*.12],[-.95,.55,s*.3],.03,S.timberD,{n:3});q.tube([-.4,.4,s*.24],[-.4,0,s*.24],.03,S.iron,{n:3});}});}
// a rack of garden tools on two posts (faces +z of the frame)
function toolRack(b,x,y,z,ry){const S=b.k.pal.set;b.at(x,y,z,ry,q=>{for(const s of [-1,1])bx(q,s*.7,0,0,.1,1.7,.1,S.timberD);bx(q,0,1.45,0,1.5,.12,.08,S.timber);if(!q.hi)return;bx(q,0,.5,0,1.5,.1,.08,S.timber);
  q.tube([-.42,.1,.1],[-.42,1.62,.08],.03,S.timber,{n:3});plate(q,-.42,.06,.11,.24,.34,S.iron);q.tube([0,.1,.1],[0,1.66,.08],.03,S.timber,{n:3});plate(q,0,.08,.11,.42,.1,S.rust);q.tube([.4,.1,.1],[.4,1.6,.08],.03,S.timber,{n:3});plate(q,.4,.08,.11,.2,.2,S.iron);});}
// The greenhouse: a glass tunnel along x over a stone kerb, ribs in whatever paint was left, two roof lights propped open,
// one side rolled up over the raised beds, a door at the +x end, a water butt on the gutter, a tool rack, planters outside.
function greenhouse(b,o,c){const {pal,tint,mat,glow,hash}=b.k,S=pal.set,w=o.w,d=o.d,h=o.h,sd=o.seed|0,hi=b.hi,PI=Math.PI,f0=c?.3:.22;
 const glassM=mat(0x8f9c8a,'glass',.15),glassB=mat(0xa9ae98,'glass',.25),tanP=mat(0xc49a52,'cloth',0,.08),ply=mat(0x94703f,'timber',.5,.1),trim=creamT(b),glassLit=mat(0xe2c98a,'glass',.6),inside=mat(0x1e2e1a,'leaf',0,0);
 const tx0=-w/2+(c?.45:.6),tx1=w/2-(c?1.0:1.5),xc=(tx0+tx1)/2,len=tx1-tx0,cz=c?-.45:-d*.05,r=c?d*.5-1.3:d/2-1.25,kw=c?.3:.42,yf=f0+kw,rise=h-yf-(c?.1:.16),n=hi?10:6,segs=c?(hi?3:2):(hi?6:3);
 if(c)bx(b,0,0,0,w,.3,d,S.conc);else b.bev(0,-.5,0,w-.4,.72,d-.4,S.conc,{ch:.14});
 bx(b,xc,f0,cz,len+.16,kw,2*r+.16,S.stone,S.soil);
 // raised beds and their greens (seen through the rolled-up side and the door)
 for(const sz of [-1,1]){const bz=cz+sz*r*.5;if(!hi){bx(b,xc,yf,bz,len-.9,.6,r*.5,S.timberD,sz>0?S.leaf:S.leafD);continue;}bx(b,xc,yf,bz,len-.9,.36,r*.56,S.timberD,S.soil);if(c)bx(b,xc,yf+.36,bz,len-1.3,.34,r*.36,sz>0?S.leaf:S.leafD);
  else{const ng=sz>0?12:6;for(let i=0;i<ng;i++)b.part().gem(tx0+.8+(len-1.6)*(i+.5)/ng,yf+.62+.1*(i%3),bz,.42,.36+.12*(i%2),.5,i%3?S.leaf:S.leafD,i*1.7);if(sz>0)for(let i=0;i<4;i++)b.gem(xc-len*.14+len*.09*i,yf+.98,bz+.25,.1,.1,.1,i%2?S.fresh[0]:S.fresh[2]);}}
 // the glass: mixed panes, a few lit warm from inside, the +z side rolled up over the middle bays
 const open=(s,i)=>i===0&&(c?s===(hi?1:0):hi?(s===2||s===3):s===1);
 tunnel(b,tx0,tx1,yf,cz,r,rise,n,segs,(s,i)=>{if(open(s,i))return null;const q=hash(sd*71+s*13+i*31),pk=(s*5+i*3+sd)%11;return pk===0?tanP:pk===6?ply:q<.14&&hi?glassLit:q<.5?glassB:glassM;});
 archEnd(b,tx0,yf,cz,r,rise,n,glassM,-1);archEnd(b,tx1,yf,cz,r,rise,n,glassB,1);
 const ox0=tx0+len*(c?(hi?1/3:0):1/3),ox1=tx0+len*(c?(hi?2/3:.5):2/3),oy=yf+Math.sin(PI/n)*rise,oz=cz+Math.cos(PI/n)*r;b.tube([ox0,oy+.04,oz+.06],[ox1,oy+.04,oz+.06],c?.09:.13,S.canvas[0],{n:hi?5:3,caps:true});
 // ribs in mixed paints, the ridge pole and purlins
 const ribP=[trim,S.timber,S.paint[1],trim,S.paint[0],S.paint[5],S.timberD];
 for(let s=0;s<=segs;s++){if(hi)archRib(b,tx0+len*s/segs,yf,cz,r,rise,n,c?.06:.085,pick(ribP,sd+s),3);else archRibbon(b,tx0+len*s/segs,yf,cz,r,rise,n,c?.16:.22,pick(ribP,sd+s));}
 b.tube([tx0-.1,yf+rise+.03,cz],[tx1+.1,yf+rise+.03,cz],c?.07:.1,trim,{n:4});
 if(hi)for(const s of [-1,1]){const a=PI/2+s*PI*.3;b.tube([tx0,yf+Math.sin(a)*rise*1.01,cz+Math.cos(a)*r*1.01],[tx1,yf+Math.sin(a)*rise*1.01,cz+Math.cos(a)*r*1.01],.045,S.timberD,{n:3});}
 // two roof lights propped open
 for(const t of c?[.5]:[.27,.73]){const vx=tx0+len*t,a=PI*.5-PI/n*1.5,ya=yf+Math.sin(a)*rise,za=cz+Math.cos(a)*r,vw=c?.7:1.0,vl=c?.8:1.2,yv=Math.min(ya+.45,h-.06);
  sheet(b,[vx-vw,ya+.06,za-.05],[vx+vw,ya+.06,za-.05],[vx+vw,yv,za+vl],[vx-vw,yv,za+vl],hi?glassLit:glassB,glassM);if(hi){b.tube([vx-vw,yv,za+vl],[vx+vw,yv,za+vl],.05,trim,{n:3});b.tube([vx,yv,za+vl],[vx,yf+Math.sin(a-PI/n)*rise,cz+Math.cos(a-PI/n)*r],.03,S.timberD,{n:3});}}
 // the +x end: timber door frame, the door left open, the green dark inside, a lantern
 b.at(tx1+.03,0,cz,PI/2,q=>{const dw=c?.9:1.1,dh=Math.min(2.1,rise*.62);plate(q,0,yf,.02,dw,dh,inside);if(hi||!c){for(const s of [-1,1])bx(q,s*(dw/2+.07),f0,.04,.14,dh+kw,.12,S.timberD);bx(q,0,yf+dh,.04,dw+.4,.14,.12,S.timberD);}else plate(q,0,yf-.05,.01,dw+.3,dh+.2,S.timberD);
  if(hi){q.tube([0,yf+dh+.14,.04],[0,yf+rise-.05,.04],.05,S.timberD,{n:3});for(const s of [-1,1])q.tube([s*(dw/2+.14),yf+dh*.6,.04],[s*r*.82,yf+dh*.6,.04],.045,S.timberD,{n:3});}
  q.at(dw/2+.05,yf,.1,-1.15,p=>{if(hi){bx(p,dw/2,0,0,dw,dh,.06,S.timber);plate(p,dw/2,dh*.45,.04,dw*.7,dh*.45,glassB);p.quad([dw*.85,dh*.45,-.04],[dw*.15,dh*.45,-.04],[dw*.15,dh*.9,-.04],[dw*.85,dh*.9,-.04],glassB);}else sheet(p,[0,0,0],[dw,0,0],[dw,dh,0],[0,dh,0],S.timber,S.timber);});
  if(hi||!c)bx(q,0,f0,.35,dw+.5,kw*.5,.6,S.stone);});
 if(hi||!c)lantern(b,tx1+.3,yf+Math.min(2.1,rise*.62)+.5,cz-(c?.75:.95),.9);else b.gem(tx1+.2,yf+Math.min(2.1,rise*.62)+.2,cz-.75,.12,.15,.12,S.lamp);
 if(hi||!c){const a=PI*.5;b.tube([tx0,yf+.06,cz+r+.1],[tx1,yf+.06,cz+r+.1],.07,S.rust,{n:3});}
 return {tx0,tx1,xc,len,cz,r,yf,rise,f0};}
WK.model('settler-greenhouse',(b,o)=>{const S=b.k.pal.set,{tint,mat}=b.k,hi=b.hi,sd=o.seed|0,w=o.w,d=o.d,h=o.h,G=greenhouse(b,o,false),{tx0,tx1,xc,len,cz,r,yf,f0}=G,fz=cz+r+.8,PI=Math.PI;
 // the water butt on the gutter, at the door corner
 const wx=tx1+.62,wz=cz+r+.45;bx(b,wx,f0,wz,1.2,.24,1.2,S.stone);b.cyl(wx,f0+.24,wz,.56,1.45,pick([S.paint[0],S.paint[5],S.paint[7]],sd),{n:hi?10:6,bev:.05,topMat:S.water});if(hi){hoop(b,wx,f0+.6,wz,.59,.08,S.iron,10);hoop(b,wx,f0+1.3,wz,.59,.08,S.iron,10);b.pipe([[tx1-.1,yf+.06,cz+r+.1],[wx-.1,yf+.5,cz+r+.1],[wx-.1,f0+1.75,wz-.1]],.06,S.rust,{n:4});b.tube([wx,f0+.5,wz+.56],[wx,f0+.5,wz+.74],.04,S.iron,{n:3});}
 toolRack(b,tx1+.5,f0,cz-r*.72,PI/2);
 // planters along the front, either side of the rolled-up bays; a wheelbarrow, sacks and pots before them
 planter(b,tx0+len*.15,f0,fz,len*.24,.62,sd);planter(b,tx0+len*.86,f0,fz,len*.2,.62,sd+2);
 if(hi){planter(b,tx0+len*.36,f0,fz+.2,len*.1,.5,sd+1);barrow(b,xc+.6,f0,fz+.05,.12,S.rust);sack(b,xc-1.6,f0,fz-.1,.34,S.canvas[0]);sack(b,xc-1.1,f0,fz+.2,.3,S.canvas[3]);for(let i=0;i<3;i++)b.cyl(xc-2.6+i*.34,f0,fz+.5-(i%2)*.3,.15,.26,S.rust,{n:6,r2:.2,topMat:S.soil});
  b.gem(xc-2.6,f0+.45,fz+.5,.16,.22,.16,S.leaf);}
 // the back: a stove with its pipe, a compost box, a crate
 const bz=cz-r-.45;b.bev(tx0+len*.2,f0,bz,.8,.9,.6,S.iron,{ch:.05});b.tube([tx0+len*.2,f0+.9,bz],[tx0+len*.2,h-.16,bz],.11,S.iron,{n:5});b.cyl(tx0+len*.2,h-.16,bz,.2,.1,S.rust,{n:5,r2:.05});plate(b,tx0+len*.2,f0+.3,bz+.31,.3,.25,S.amber);
 if(hi){b.at(tx0+len*.2,0,bz-.305,PI,q=>plate(q,0,f0+.3,0,.3,.25,S.amber));bx(b,tx0+len*.55,f0,bz,1.3,.8,.6,S.timberD,S.soil);crate(b,tx0+len*.75,f0,bz,.5,S.timber,.2);b.gem(tx0+len*.5,f0+.9,bz,.3,.2,.22,S.leafD);b.pool(tx1+.9,.26,cz,.8,.9,0xffa84a,.12);}
});

// ------------------------------------------------------------------ settler-silo ----------------------------------------
// The grain silo: a ribbed, hooped cylinder in faded paint with a rust band, a conical roof and vent cap, a caged ladder to
// a little landing at the eave, the feed auger leaning from its hopper to the roof, an amber band light, a hatch.
WK.model('settler-silo',(b,o)=>{const {pal,tint,mat,glow}=b.k,S=pal.set,w=Math.min(o.w,o.d),h=o.h,sd=o.seed|0,hi=b.hi,PI=Math.PI;
 const body=pick([S.white,S.paint[3],S.paint[0],S.paint[7]],sd),bandC=pick(S.fresh,sd+1),f0=.22,r=w*.34,cz=-w*.04,cx=-w*.03,yb=h*.74,yc=h*.9,n=hi?14:8;
 b.bev(0,-.5,0,o.w-.4,.72,o.d-.4,S.conc,{ch:.14});
 b.cyl(cx,f0,cz,r+.14,.45,S.conc,{n});b.cyl(cx,f0+.45,cz,r,yb-f0-.45,body,{n,bev:.06});
 // hoops (the ribs), the rust band low down, the hand-painted band high up, the amber band light
 hoop(b,cx,h*.24,cz,r+.025,h*.1,S.rust,n);hoop(b,cx,yb-h*.09,cz,r+.025,h*.04,bandC,n);hoop(b,cx,h*.52,cz,r+.05,.2,S.amber,n);
 const hs=hi?[.1,.19,.36,.44,.6,.68]:[.36];for(const t of hs)hoop(b,cx,h*t,cz,r+.06,.12,S.iron,n);
 if(hi){b.ribs(cx,f0+.45,cz,r,yb-f0-.5,7,tint(body,.82),{w:.16,dp:.12,bev:false,rot:.3});arcBand(b,cx,h*.38,cz,r+.035,h*.12,3.5,4.1,S.scrap,2);arcBand(b,cx,h*.56,cz,r+.035,h*.1,5.3,5.8,pick(S.paint,sd+2),2);b.halo(cx,h*.53,cz+r,.8,0xffa84a,.12);}
 // conical roof in mismatched panels, the vent cap, a rod
 b.cyl(cx,yb,cz,r*1.07,yc-yb,S.roof,{n,r2:r*.2,bot:true,band:(q,i)=>i%5===2?S.roofRust:i%5===4?tint(S.roof,1.25):S.roof});
 b.cyl(cx,yc-.02,cz,r*.24,h*.035,S.iron,{n:hi?8:6});b.cyl(cx,yc+h*.035-.02,cz,r*.36,h*.03,S.roofRust,{n:hi?8:6,r2:.05,bot:true});b.tube([cx,yc+h*.06,cz],[cx,h,cz],.035,S.iron,{n:3});
 // the caged ladder on the front and its landing at the eave
 const lz=cz+r+.2;cageLadder(b,[cx+.9,f0,lz-.14],[cx+.9,yb-.3,lz-.14],S.iron,[1,0],[0,1],{w:.5,cr:.45});
 bx(b,cx+.9,yb-.42,cz+r+.3,1.5,.1,.75,S.timber);if(hi){b.rail([[cx+.2,yb-.32,cz+r+.62],[cx+1.6,yb-.32,cz+r+.62]],.85,S.iron,{step:2,r:.035});for(const s of [-1,1])b.tube([cx+.9+s*.6,yb-.42,cz+r+.6],[cx+.9+s*.6,yb-1.2,cz+r*.96],.035,S.iron,{n:3});b.ladder([cx+.9,yb-.3,cz+r*.98],[cx+.3,yc-.1,cz+r*.3],S.iron,{w:.4});}
 // the hatch, a lantern over it, a hand-painted number
 b.at(cx-r*.5,0,cz+Math.sqrt(r*r*.75)+.02,-PI/6,q=>{bx(q,0,f0+.5,0,.9,1.25,.1,S.scrap);plate(q,0,f0+.6,.07,.7,1.05,S.rust);if(hi){disc(q,0,f0+1.15,.09,.2,S.iron,6);plate(q,0,f0+2.3,.03,.9,.9,S.white);plate(q,-.18,f0+2.42,.05,.14,.66,bandC);plate(q,.14,f0+2.42,.05,.14,.66,bandC);plate(q,.14,f0+2.42,.06,.3,.14,bandC);}});
 // the feed auger: hopper and motor at the foot, the tube to the roof, two stays
 const a0=[cx+r+.75,f0+.5,cz-.3],a1=[cx+r*.28,yc-h*.035,cz-.1];b.tube(a0,a1,.21,S.scrap,{n:hi?6:4,caps:true});
 b.loft([{p:b.k.rect(.5,.5,0,a0[0],a0[2]),y:f0+.35},{p:b.k.rect(1.1,1.1,0,a0[0],a0[2]),y:f0+1.0}],pick(S.fresh,sd),{top:false,bot:true});for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])b.tube([a0[0]+sx*.45,f0,a0[2]+sz*.45],[a0[0]+sx*.3,f0+.7,a0[2]+sz*.3],.04,S.iron,{n:3});
 if(hi){const P=t=>[a0[0]+(a1[0]-a0[0])*t,a0[1]+(a1[1]-a0[1])*t,a0[2]+(a1[2]-a0[2])*t];for(const t of [.35,.68]){const p=P(t),dx=p[0]-cx,dz=p[2]-cz,l=Math.hypot(dx,dz);b.tube(p,[cx+dx/l*r,p[1]-.5,cz+dz/l*r],.04,S.iron,{n:3});hoop(b,p[0],p[1]-.1,p[2],.2,.2,S.rust,6);}
  bx(b,a0[0],f0+1.0,a0[2]+.75,.5,.4,.4,S.iron);sack(b,a0[0]-.2,f0,a0[2]+1.5,.34,S.canvas[0]);sack(b,a0[0]+.25,f0,a0[2]+1.9,.3,S.canvas[3]);barrel(b,cx-r-.45,f0,cz+r*.2,.28,.85,S.rust);lantern(b,cx-r*.5-.2,f0+2.3,cz+r+.42,.9);}
});

// ------------------------------------------------------------------ settler-turbine / settler-rotor ---------------------
// The wind pump mast: a rust-streaked, patched tube mast in three ages of paint with a hand-painted band, on a footing with
// four props under a work deck and four guy wires to anchor stones, climbing rungs, the nacelle on top (its nose points +z;
// the rotor is the separate slot settler-rotor placed at (0, o.h, 1.5)), a painted tail vane, an amber light.
WK.model('settler-turbine',(b,o)=>{const {pal,tint,mat,glow}=b.k,S=pal.set,w=Math.min(o.w,o.d),h=o.h,sd=o.seed|0,hi=b.hi,n=hi?8:6;
 const nac=pick([S.paint[5],S.paint[0],S.paint[6],S.paint[1]],sd),band=pick([S.fresh[0],S.fresh[2],S.canvas[4],S.paint[1]],sd),fin=pick([S.fresh[2],S.fresh[0],S.canvas[4],S.paint[2]],sd),cream=mat(0xb9ae94,'paint',.95,.1);
 const y0=.25,yt=h-.62,H=yt-y0,cols=[mat(0x6a4a36,'scrap',.75),pick([S.comp,S.paint[7],S.paint[4]],sd),cream],ts=[0,.36,.7,1],rad=t=>.56-.26*t;
 b.bev(0,-.5,0,w-.5,.75,w-.5,S.conc,{ch:.12});
 for(let i=0;i<3;i++)b.cyl(0,y0+H*ts[i],0,rad(ts[i]),H*(ts[i+1]-ts[i]),cols[i],{n,r2:rad(ts[i+1]),top:i===2});
 // the painted band; iron collars at the joints, rust streaks running down from them, bolted patches
 hoop(b,0,y0+H*.78,0,rad(.78)+.03,H*.075,band,n,rad(.855)+.03);
 if(hi){for(const i of [1,2])hoop(b,0,y0+H*ts[i]-.12,0,rad(ts[i])+.05,.24,S.iron,n);hoop(b,0,y0,0,.7,.34,S.iron,n,.6);
  for(const [t,a,l] of [[.7,.6,.1],[.7,3.9,.14],[.78,2.3,.09],[1,5.1,.12],[1,1.4,.07]])arcBand(b,0,y0+H*(t-l),0,rad(t-l)+.025,H*l,a,a+.5,S.rust,1);
  arcBand(b,0,y0+H*.44,0,rad(.44)+.03,H*.08,.4,1.9,S.scrap,2);arcBand(b,0,y0+H*.56,0,rad(.56)+.03,H*.07,3.2,4.6,pick(S.paint,sd+5),2);}
 // four props under the work deck, four guy wires from a collar to anchor stones at the corners
 const yp=y0+H*.3,e=w/2-.4,ga=y0+H*.64,ax=w/2-.5;
 for(const [sx,sz] of [[1,0],[0,1],[-1,0],[0,-1]])b.tube([sx*e,y0,sz*e],[sx*rad(.3)*.8,yp,sz*rad(.3)*.8],.11,S.rust,{n:hi?4:3});
 bx(b,0,yp-.1,0,1.5,.14,1.5,S.timber);
 for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){b.tube([sx*rad(.64)*.6,ga,sz*rad(.64)*.6],[sx*ax,y0+.2,sz*ax],.07,S.iron,{n:3});if(hi)bx(b,sx*ax,y0-.02,sz*ax,.44,.34,.44,S.stone);}
 if(hi){hoop(b,0,ga-.12,0,rad(.64)+.05,.24,S.iron,n);cageLadder(b,[-rad(.3)-.14,yp+.04,0],[-rad(1)-.12,yt-.3,0],S.iron,[0,1],[-1,0],{w:.44,step:1.3,cage:false,k:1.6});}
 // the head: yaw bearing, nacelle with a patch, the nose collar, tail boom and vane, the light
 b.cyl(0,yt,0,.4,.22,S.iron,{n});b.bev(0,yt+.2,.12,.98,.95,2.0,nac,{ch:.1});b.tube([0,h,1.12],[0,h,1.3],.4,S.iron,{n,caps:true,r2:.32});
 if(hi){b.quad([-.3,yt+1.16,-.5],[.36,yt+1.16,-.5],[.36,yt+1.16,.5],[-.3,yt+1.16,.5],S.scrap,[0,0,0]);for(const s of [-1,1])b.at(s*.495,0,.12,s*Math.PI/2,q=>plate(q,0,yt+.42,0,.9,.4,s>0?S.rust:tint(nac,.7)));hoop(b,0,yt+.9,.12,.6,.06,S.iron,6);}
 b.tube([0,h+.1,-.86],[0,h+.3,-1.42],.08,S.iron,{n:4});sheet(b,[0,h-.3,-1.0],[0,h-.12,-1.47],[0,h+.95,-1.47],[0,h+.72,-1.0],fin,fin);if(hi)sheet(b,[.012,h+.16,-1.05],[.012,h+.2,-1.44],[.012,h+.42,-1.44],[.012,h+.38,-1.05],tint(fin,.55),tint(fin,.55));
 b.tube([0,yt+1.15,-.3],[0,yt+1.55,-.3],.05,S.iron,{n:3});b.gem(0,yt+1.62,-.3,.13,.16,.13,S.lamp);if(hi)b.halo(0,yt+1.62,-.3,.5,0xffb060,.25);
});
// The rotor: three hand-shaped blades in the XY plane about the origin (the game spins it about z), radius 9 by default
// (o.r = radius). One blade is a later replacement in another paint; the tips are banded.
WK.model('settler-rotor',(b,o)=>{const {pal,tint,rect}=b.k,S=pal.set,sd=o.seed|0,hi=b.hi,R=o.r||9,k=R/9,tip=pick([S.fresh[2],S.fresh[0],S.canvas[4]],sd);
 for(let i=0;i<3;i++){const m=i===2?pick([S.paint[0],S.paint[7],S.paint[5]],sd):S.paint[3];b.at(0,o.lift||0,0,0,q=>{
   if(hi)q.loft([{p:rect(.4*k,.2,0,0,.02),y:.4*k},{p:rect(.98*k,.15,0,.14*k,.02),y:1.5*k},{p:rect(.62*k,.1,0,.1*k,.02),y:5.6*k},{p:rect(.4*k,.07,0,.05*k,.02),y:8.1*k},{p:rect(.22*k,.05,0,.03*k,.02),y:R}],(r)=>r===3?tip:m);
   else q.loft([{p:rect(.9*k,.15,0,.12*k,.02),y:.6*k},{p:rect(.5*k,.09,0,.06*k,.02),y:7.6*k},{p:rect(.24*k,.05,0,.03*k,.02),y:R}],(r)=>r===1?tip:m,{top:false});},0,i*TAU/3);}
 if(hi){b.tube([0,0,-.3],[0,0,.6],.56*k,pick(S.fresh,sd+1),{n:8,r2:.14,caps:true});}else b.gem(0,0,.1,.55*k,.55*k,.5,pick(S.fresh,sd+1));
});

// ------------------------------------------------------------------ settler-solar ---------------------------------------
// A farm solar rack: three salvaged panels of different makes tilted toward +z on timber A-frame trestles: a sound one, a
// dull one in a rusty frame with a cracked corner, and a dead replacement that has slipped, half under a tied-down tarp. A junction
// box with the amber tell-tale on the end trestle, a battery crate.
WK.model('settler-solar',(b,o)=>{const {pal,tint,mat,glow}=b.k,S=pal.set,w=o.w,d=o.d,h=o.h||2.4,sd=o.seed|0,hi=b.hi,rn=hi?4:3;
 const zf=d/2-.45,zb=-d/2+.5,yf=.55,ybk=Math.max(1.2,h-.3),run=zf-zb,tilt=Math.atan2(ybk-yf,run),pl=Math.hypot(run,ybk-yf)+.5,pw=(w-.5)/3,xs=[-w/2+.45,-w/6,w/6,w/2-.45];
 const cells=[mat(hi?0x15202c:0x1e2b3a,'solar',0),mat(0x28323c,'metal',.5),mat(0x2b2724,'metal',.7)],frames=[S.timberD,S.rust,S.scrap],tarp=pick([S.canvas[3],S.canvas[0],S.canvas[4]],sd),ya=ybk-.1,za=zb+.1;
 // the trestles: an A of two legs under the high edge (a plain back leg on the inner ones), a stub post under the low edge,
 // the rafter between them; two purlins carry the panels
 xs.forEach((x,i)=>{const end=i===0||i===3;b.tube([x,0,zb-.4],[x,ya,za],.1,S.timberD,{n:rn});if(end){b.tube([x,0,zb+.8],[x,ya,za],.1,S.timber,{n:rn});if(hi)b.tube([x,ya*.45,zb-.22],[x,ya*.45,zb+.5],.07,S.timberD,{n:4});}
  b.tube([x,0,zf],[x,yf-.06,zf],.1,S.timberD,{n:rn});if(hi)b.tube([x,yf-.14,zf],[x,ya-.04,za],.08,S.timber,{n:4});});
 for(const [z,y] of [[za,ya],[zf,yf-.1]])b.tube([-w/2+.2,y,z],[w/2-.2,y,z],.09,S.timber,{n:rn});
 // the panels (v: 0 sound, 1 rusty frame and cracked, 2 the dull replacement)
 for(let i=0;i<3;i++){const px=-w/2+.25+pw*(i+.5),v=(i+sd)%3,len=v===1?pl*.88:pl,zc=v===1?-(pl-len)/2:v===2?.16:0;
  b.at(px,(yf+ybk)/2,(zf+zb)/2,v===2?.03:0,q=>{bx(q,0,0,zc,pw-.14,.09,len,frames[v],cells[v]);const bat=(x,z,wx,wz)=>q.quad([x-wx,.094,z-wz],[x+wx,.094,z-wz],[x+wx,.094,z+wz],[x-wx,.094,z+wz],frames[v],[0,-1,0]);
   if(!hi)bat(0,zc,pw/2-.07,.05);else if(v){bat(0,zc,.045,len/2);for(const s of [-1,1])bat(0,zc+s*len/6,pw/2-.07,.045);}
   if(v===1&&hi){const y=.1,z0=zc+len*.5;q.quad([-pw*.42,y,z0-.08],[-pw*.42,y,z0-len*.3],[-pw*.2,y,z0-len*.2],[-pw*.12,y,z0-.08],S.iron,[0,-1,0]);
    q.tri([-pw*.2,y,z0-len*.2],[pw*.22,y,z0-len*.46],[-pw*.25,y,z0-len*.25],tint(cells[1],2.6,.05),[0,-1,0]);q.tri([-pw*.12,y,z0-.08],[pw*.3,y,z0-len*.16],[-pw*.15,y,z0-.2],tint(cells[1],2.6,.05),[0,-1,0]);}
   if(v===2){const y=.13,z0=zc-pl/2-.05;q.quad([-pw/2-.05,y,z0],[pw*.24,y,z0],[pw*.1,y,zc-pl*.02],[-pw/2-.05,y,zc+pl*.14],tarp,[0,-1,0]);sheet(q,[-pw/2-.05,y,z0],[pw*.24,y,z0],[pw*.2,-.5,z0-.06],[-pw/2+.06,-.4,z0-.06],tarp);
    if(hi){q.quad([-pw/2-.05,y,z0],[-pw/2-.05,y,zc+pl*.14],[-pw/2-.07,-.22,zc+pl*.08],[-pw/2-.07,-.3,z0+.1],tint(tarp,.8),[0,0,zc]);q.tube([pw*.1,y,zc-pl*.02],[pw*.3,-.05,zc+pl*.1],.03,S.iron,{n:3});}}},tilt);}
 // the junction box on the end trestle, the amber tell-tale on top of it, the cable and the battery crate
 const jx=xs[3]+.27,jy=ya*.5;bx(b,jx,jy,zb+.14,.34,.62,.5,S.scrap,S.roofRust);bx(b,jx,jy+.62,zb+.14,.2,.18,.2,S.amber);
 if(hi){b.halo(jx,jy+.72,zb+.14,.45,0xffa84a,.25);b.pipe([[jx,jy,zb+.3],[jx,.1,zb+.3],[jx-1.1,.1,zb+.5]],.05,S.iron,{n:4});crate(b,jx-1.5,0,zb+.45,.7,S.timber,.2);barrel(b,xs[0]+.7,0,zb+.4,.26,.7,S.rust);}
});

// ------------------------------------------------------------------ settler-plaza ---------------------------------------
// The market square, drivable (nothing above 0.9 m): rings of worn paving of different stone round a low well, a painted
// sun of setts at its foot, four paths to the roads, flower beds in stone kerbs, low benches and amber kerb lamps.
WK.model('settler-plaza',(b,o)=>{const {pal,tint,mat,glow,hash,rect,circ}=b.k,S=pal.set,w=o.w,d=o.d,sd=o.seed|0,hi=b.hi,R=Math.min(w,d)/2,u=R/10,PI=Math.PI;
 const tones=[S.stone,S.conc,tint(S.stone,1.22),tint(S.conc,.82),mat(0x857b66,'concrete',.6),tint(S.stone,.84)],acc=[mat(0x5f8a86,'concrete',.7),mat(0x9a5a3a,'concrete',.7),mat(0xb39a66,'concrete',.6)],pt=(r,a,y)=>[Math.cos(a)*r,y,Math.sin(a)*r];
 const seg=(r0,r1,a0,a1,y,m)=>b.quad(pt(r0,a0,y),pt(r0,a1,y),pt(r1,a1,y),pt(r1,a0,y),m,[0,-9,0]);
 // the slab of dark setts with a chamfered kerb
 b.loft(hi?[{p:rect(w-.2,d-.2,R*.27),y:-.4},{p:rect(w-.2,d-.2,R*.27),y:.05},{p:rect(w-.5,d-.5,R*.27-.1),y:.11}]:[{p:rect(w-.2,d-.2,R*.27),y:-.4},{p:rect(w-.2,d-.2,R*.27),y:.11}],tint(S.stone,.72),{topMat:tint(S.stone,.78)});
 // paving rings: each ring its own stone and level, single stones in faded paint
 const rings=[[1.95,3.45,hi?12:6,.13],[3.55,5.2,hi?18:9,.16],[5.3,7.0,hi?24:8,.13],[7.1,8.7,hi?30:10,.16]];
 rings.forEach(([r0,r1,n,y],ri)=>{for(let i=0;i<n;i++){const q=hash(sd*53+ri*19+i*7),m=hi&&q>.93?pick(acc,ri+i):pick(tones,ri*2+(i%2)+(q>.6?1:0));seg(r0*u,r1*u,(i+.04)/n*TAU+ri*.21,(i+.96)/n*TAU+ri*.21,y+(hi?.012*(i%2):0),m);}});
 // the kerb ring round the square and the four paths through it
 const kn=hi?32:12;b.loft(hi?[{p:circ(9.2*u,kn),y:.08},{p:circ(9.2*u,kn),y:.3},{p:circ(8.85*u,kn),y:.3},{p:circ(8.85*u,kn),y:.12}]:[{p:circ(9.2*u,kn),y:.08},{p:circ(9.2*u,kn),y:.3},{p:circ(8.85*u,kn),y:.3}],(r)=>r===1?tint(S.conc,1.15):S.conc,{top:false});
 for(let k=0;k<4;k++)b.at(0,0,0,k*PI/2,q=>{const pw=1.5*u;for(let j=0;j<(hi?4:2);j++){const z0=(3.5+(hi?1.6:3.2)*j)*u,z1=z0+(hi?1.52:3.1)*u;q.quad([-pw,.2,z0],[pw,.2,z0],[pw,.2,z1],[-pw,.2,z1],pick(tones,j+k+2),[0,-9,0]);}
   if(hi)q.quad([-pw*1.25,.32,8.75*u],[pw*1.25,.32,8.75*u],[pw*1.25,.32,9.3*u],[-pw*1.25,.32,9.3*u],tint(S.conc,1.2),[0,-9,0]);if(hi)q.quad([-pw*1.25,.11,9.3*u],[pw*1.25,.11,9.3*u],[pw*1.25,.32,9.3*u],[-pw*1.25,.32,9.3*u],S.conc,[0,0,0]);});
 // the sun of setts at the well's foot
 for(let i=0;i<8;i++){const a=i/8*TAU+PI/8;b.tri(pt(1.95*u,a-.2,.19),pt(1.95*u,a+.2,.19),pt(3.35*u,a,.19),i%2?acc[2]:acc[0],[0,-9,0]);}
 // the well: stone ring, cap stones, water, the centre stone with its lamp
 const wn=hi?12:8,ro=1.75*u,ri=1.3*u;b.loft(hi?[{p:circ(ro+.1,wn),y:.1},{p:circ(ro,wn),y:.3},{p:circ(ro,wn),y:.6},{p:circ(ro+.06,wn),y:.62},{p:circ(ro+.06,wn),y:.7},{p:circ(ri-.05,wn),y:.7}]:[{p:circ(ro,wn),y:.1},{p:circ(ro,wn),y:.7},{p:circ(ri-.05,wn),y:.7}],(r)=>r>=(hi?3:1)?tint(S.conc,1.2):S.stone,{top:false});
 if(hi)for(let i=0;i<wn;i++){const a0=i/wn*TAU,a1=(i+1)/wn*TAU;b.quad(pt(ri-.05,a0,.7),pt(ri-.05,a1,.7),pt(ri-.05,a1,.38),pt(ri-.05,a0,.38),tint(S.stone,.7),[0,.5,0]);}
 b.cap(circ(ri-.05,wn),hi?.42:.52,S.water,true);b.cyl(0,.42,0,.3*u,.36,S.stone,{n:hi?6:4,r2:.22*u});b.gem(0,.84,0,.09,.06,.09,S.lamp);
 if(hi){b.halo(0,.8,0,.5,0xffb060,.3);for(let i=0;i<3;i++){const a=i/3*TAU+.5;b.tube(pt(.2*u,a,.62),pt(.75*u,a,.44),.035,S.water,{n:3});}
  b.cyl(ro+.5,.12,.6,.2,.34,S.timber,{n:6,r2:.24,topMat:S.water});b.tube([ro+.5,.46,.38],[ro+.5,.62,.6],.02,S.iron,{n:3});b.tube([ro+.5,.62,.6],[ro+.5,.46,.82],.02,S.iron,{n:3});}
 // on the diagonals: a flower bed in a stone kerb, a low bench facing the well, kerb lamps
 for(let k=0;k<4;k++){const a=k*PI/2+PI/4,na=hi?4:2,poly=[];for(let i=0;i<=na;i++)poly.push([Math.cos(a-.3+.6*i/na)*7.0*u,Math.sin(a-.3+.6*i/na)*7.0*u]);for(let i=na;i>=0;i--)poly.push([Math.cos(a-.3+.6*i/na)*5.45*u,Math.sin(a-.3+.6*i/na)*5.45*u]);
  b.loft([{p:poly,y:.1},{p:poly,y:.42}],k%2?S.stone:tint(S.conc,.9),{topMat:S.soil});
  const np=hi?7:2;for(let i=0;i<np;i++){const t=(i+.5)/np,aa=a-.25+.5*t,rr=(6.2+.35*((i%2)*2-1))*u,p=pt(rr,aa,.5);b.part().gem(p[0],p[1],p[2],.5*u,.26,.42*u,i%2?S.leaf:S.leafD,i+k);if(hi&&i%2===0)b.gem(p[0]+.12,.74,p[2]-.1,.13,.12,.13,pick(S.fresh,k+i));}
  b.at(Math.cos(a)*4.4*u,0,Math.sin(a)*4.4*u,PI/2-a,q=>{if(hi)bx(q,0,.12,0,2.0*u,.3,.5,S.stone);bx(q,0,hi?.42:.12,0,2.2*u,hi?.07:.37,.62,S.timber);});
  for(const da of [-.42,.42]){const p=pt(9.03*u,a+da,0);if(hi){bx(b,p[0],.28,p[2],.3,.26,.3,S.stone);bx(b,p[0],.54,p[2],.22,.13,.22,S.lamp);bx(b,p[0],.67,p[2],.3,.05,.3,S.iron);if(da>0)b.halo(p[0],.62,p[2],.6,0xffb060,.3);}else b.gem(p[0],.5,p[2],.2,.24,.2,S.lamp);}
  // the corners of the square: a planted tub
  const cxy=(R-1.75*u)*.985;if(hi){b.at(Math.cos(a)*cxy*Math.SQRT2*.86,0,Math.sin(a)*cxy*Math.SQRT2*.86,PI/4,q=>{bx(q,0,.1,0,1.3*u,.36,1.3*u,S.timberD,S.soil);q.gem(0,.6,0,.5*u,.28,.5*u,S.leafD,k);q.gem(.2,.66,.15,.2,.2,.2,pick(S.fresh,k+2));});}}
 // somebody's things: a chalked hopscotch, a produce crate left by a bench
 if(hi){b.at(4.2*u,0,-1.2*u,.4,q=>{for(let i=0;i<5;i++)q.quad([-.3+(i%2)*.3,.2,i*.62],[.3+(i%2)*.3,.2,i*.62],[.3+(i%2)*.3,.2,i*.62+.56],[-.3+(i%2)*.3,.2,i*.62+.56],i%2?S.white:tint(S.white,.85),[0,-9,0]);});
  crate(b,Math.cos(PI/4)*4.4*u+1.5,.12,Math.sin(PI/4)*4.4*u-.9,.5,S.timber,.5);b.gem(Math.cos(PI/4)*4.4*u+1.5,.62,Math.sin(PI/4)*4.4*u-.9,.2,.12,.2,S.fresh[2]);}
},{aoH:1.1,aoMin:.8});

// ------------------------------------------------------------------ settler-pen -----------------------------------------
// A livestock pen: a hand-built post-and-rail fence round the rectangle, the gate swung open on the +z side, a water
// trough, hay, a feed rack. (The animals are the separate slot "livestock".)
WK.model('settler-pen',(b,o)=>{const {pal,tint,mat}=b.k,S=pal.set,N=pal.nat,w=o.w,d=o.d,sd=o.seed|0,hi=b.hi,PI=Math.PI,hx=w/2-.15,hz=d/2-.15,gx0=w*.08,gx1=gx0+2.6;
 const post=(x,z,hh=1.2,m=S.timberD)=>{if(hi){bx(b,x,0,z,.2,hh,.2,m);}else b.tube([x,0,z],[x,hh,z],.13,m,{n:4});};
 const run=(a,c,sag=0)=>{for(const y of [.52,1.0])b.tube([a[0],y,a[1]],[c[0],y-(y>.9?sag:0),c[1]],.085,y>.9?S.timber:tint(S.timber,.85),{n:hi?4:3});};
 const nx=hi?6:3,nz=hi?4:2;
 for(const z of [-hz,hz])for(let i=0;i<=nx;i++){const x=-hx+2*hx*i/nx;if(z>0&&x>gx0+.2&&x<gx1-.2)continue;post(x,z);}
 for(const x of [-hx,hx])for(let i=1;i<nz;i++)post(x,-hz+2*hz*i/nz);
 post(gx0,hz,1.38);post(gx1,hz,1.38);
 run([-hx,-hz],[hx,-hz]);run([-hx,-hz],[-hx,hz]);run([hx,-hz],[hx,hz],hi?.12:0);run([-hx,hz],[gx0,hz]);run([gx1,hz],[hx,hz]);
 // the gate, swung inward on its post
 b.at(gx1,0,hz,PI-.95,q=>{const gw=gx1-gx0-.1;if(hi){for(const y of [.3,.98])q.tube([.05,y,0],[gw,y,0],.075,S.timber,{n:4});for(const x of [.08,gw])q.tube([x,.24,0],[x,1.06,0],.075,S.timber,{n:4});q.tube([.08,.3,0],[gw,.98,0],.06,S.timberD,{n:4});}
   else sheet(q,[.05,.3,0],[gw,.3,0],[gw,1.0,0],[.05,1.0,0],S.timber,S.timber);});
 // water trough, hay, the feed rack, a mended board, a lantern on the gate post
 const tx=-hx+1.1;bx(b,tx,.18,-hz*.2,.8,.42,2.6,S.scrap,S.water);
 bale(b,hx-1.2,0,-hz+1.0,.2);
 const rx=-w*.12,rz=-hz+1.15;bx(b,rx,.55,rz,2.2,.5,.8,S.timberD,N.straw);
 if(hi){for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){bx(b,tx+sx*.3,0,-hz*.2+sz*1.1,.1,.2,.1,S.timberD);b.tube([rx+sx*1.0,0,rz+sz*.5],[rx+sx*1.0,.58,rz+sz*.32],.05,S.timberD,{n:3});}
  b.dome(rx,1.02,rz,1.0,.3,.34,N.straw,{n:6,rings:2});bale(b,hx-1.3,.5,-hz+1.05,-.3);bale(b,hx-2.5,0,-hz+.9,-.1);roundBale(b,hx-1.1,0,-hz+2.6,.55,.9,.3);
  b.at(hx-w*.2,0,hz+.08,0,q=>plate(q,0,.38,0,1.5,.3,pick(S.paint,sd)));b.at(hx-w*.2,0,hz-.08,PI,q=>plate(q,0,.38,0,1.5,.3,pick(S.paint,sd)));
  b.cyl(tx+.9,0,-hz*.2+1.7,.18,.3,S.rust,{n:6,r2:.22});b.box(gx0,1.38,hz,.2,.04,.2,S.iron);b.box(gx0,1.16,hz+.16,.16,.2,.16,S.lamp);b.halo(gx0,1.26,hz+.2,.5,0xffb060,.3);}else bx(b,gx0,1.12,hz+.17,.2,.24,.2,S.lamp);
});

// ------------------------------------------------------------------ settler-lamp / pole / fence -------------------------
// A hand-built 6 m street lamp: a thick timber post, a little out of true, in a stone footing with two props, a heavy
// bracket beam on a knee brace reaching 1.5 m toward +z, the lantern under its tip (an iron hood, the amber lamp box at
// about y 5.5, a drip plate), a faded cloth wrap or a notice on the post. LOW keeps the post, the beam and the lit lantern.
WK.model('settler-lamp',(b,o)=>{const {pal,tint,rect}=b.k,S=pal.set,sd=o.seed|0,hi=b.hi,h=o.h>0&&o.h<12?Math.min(o.h,6.2)-.2:6;
 const m=sd%3===1?S.timber:S.timberD,lean=((sd%3)-1)*.018,lz=1.45;
 if(hi){b.loft([{p:rect(.6,.6),y:0},{p:rect(.46,.46),y:.46}],S.stone);for(const s of [-1,1])b.tube([s*.25,.4,0],[s*.04,1.35,0],.07,m,{n:4});}
 b.at(0,0,0,0,q=>{q.loft([{p:rect(.32,.32),y:0},{p:rect(.23,.23),y:h}],m);
  if(hi){bx(q,0,h-.14,.68,.17,.19,1.92,m);q.tube([0,h-1.55,.1],[0,h-.12,1.08],.08,m,{n:4});}else{q.tube([0,h-.05,-.2],[0,h-.05,1.64],.11,m,{n:3});q.tube([0,h-1.55,.1],[0,h-.12,1.08],.08,m,{n:3});}
  // the lantern: hood, lit box, drip plate
  q.loft([{p:rect(.52,.52,0,0,lz),y:h-.34},{p:rect(hi?.2:.06,hi?.2:.06,0,0,lz),y:h-.14}],S.iron,{top:hi});bx(q,0,h-.66,lz,.34,.32,.34,b.k.glow(0xffc070,1));
  if(hi){bx(q,0,h-.72,lz,.42,.06,.42,S.iron);q.halo(0,h-.5,lz,.8,0xffd59a,.32);
   if(sd%2)q.at(0,0,.165,0,r=>{plate(r,0,1.5,0,.3,.42,S.white);plate(r,0,1.64,.012,.2,.07,pick(S.fresh,sd));});else q.loft([{p:rect(.37,.37),y:1.25},{p:rect(.36,.36),y:1.62}],pick([S.canvas[0],S.canvas[3],S.canvas[4]],sd),{top:false});}},0,lean);
});
// A 9 m power pole: a thick round timber pole in a stone collar, a heavy braced crossarm along x (2.5 m) with stout
// insulators at x = +-1 (the game draws the wires between (+-1, 8.7)), a scrap band and a side stay propping it, or a
// transformer can with an amber tell-tale on some seeds (o.can = 1 / 0 forces it).
WK.model('settler-pole',(b,o)=>{const {pal,tint,rect,circ,mat}=b.k,S=pal.set,sd=o.seed|0,hi=b.hi,h=9,can=o.can!==undefined?!!o.can:sd%3===0,ins=mat(0xcfc6b0,'paint',.2),pm=tint(S.timber,.8);
 if(hi){b.loft([{p:circ(.21,6),y:0},{p:circ(.14,6),y:h}],pm);b.loft([{p:rect(.48,.48),y:0},{p:rect(.4,.4),y:.5}],S.stone);bx(b,0,8.3,0,2.5,.2,.2,S.timber);}
 else{b.loft([{p:rect(.36,.36),y:0},{p:rect(.24,.24),y:h}],pm);if(can)b.tube([-1.25,8.4,0],[1.25,8.4,0],.13,S.timber,{n:3});else bx(b,0,8.3,0,2.5,.2,.2,S.timber);}
 if(!can)b.tube([.98,0,0],[.1,4.4,0],.09,pm,{n:hi?4:3});
 for(const s of [-1,1]){b.tube([s,8.5,0],[s,8.74,0],.115,ins,{n:hi?4:3,r2:.05});if(hi)b.tube([s*.9,8.32,.07],[0,7.5,.07],.06,S.timber,{n:3});}
 if(hi&&!can){b.tube([0,8.96,0],[0,9.2,0],.12,ins,{n:4,r2:.05});hoop(b,0,2.0,0,.215,.5,sd%2?S.rust:pick(S.paint,sd),6,.2);b.at(0,0,.19,0,q=>plate(q,0,2.75,0,.26,.34,S.white));}
 if(can){b.cyl(.42,6.5,0,.27,.85,S.scrap,{n:hi?6:4,topMat:S.roofRust});if(hi){b.tube([.12,7.0,0],[.3,7.0,0],.06,S.iron,{n:3});b.tube([.42,7.35,0],[.92,8.42,0],.04,S.iron,{n:3});b.at(.42,0,.275,0,q=>plate(q,0,6.72,0,.16,.12,S.amber));}}
});
// One span of field fence: a thick, leaning post on a footing stone at x = -o.w / 2 (about 1.25 m tall) and two heavy
// rails to x = +o.w / 2 (spans chain end to end), a stake propping the middle, a mended board or a brace by seed.
WK.model('settler-fence',(b,o)=>{const {pal,tint,rect}=b.k,S=pal.set,sd=o.seed|0,hi=b.hi,L=o.w||4,x0=-L/2,x1=L/2,j=(sd%3-1)*.05,lean=((sd%5)-2)*.03;
 if(!hi){b.loft([{p:rect(.22,.2,0,x0,0),y:0},{p:rect(.2,.18,0,x0,0),y:1.22}],S.timberD);for(const y of [.4,.9])b.tube([x0,y+.08,.115],[x1,y+.08,.115],.085,y>.5?S.timber:tint(S.timber,.85),{n:3});return;}
 bx(b,x0,0,0,.4,.15,.3,S.stone);b.at(x0,0,0,0,q=>q.loft([{p:rect(.22,.2),y:0},{p:rect(.2,.18),y:1.16},{p:rect(.1,.09),y:1.27}],S.timberD),0,lean);
 bx(b,0,.9+j,.115,L+.06,.16,.07,S.timber);bx(b,0,.4,.115,L+.06,.16,.07,sd%4===1?pick(S.paint,sd):tint(S.timber,.85));
 b.at(L*.08,0,-.02,0,q=>q.loft([{p:rect(.15,.13),y:0},{p:rect(.13,.11),y:.78}],S.timberD),0,-lean*1.5);
 if(sd%2){const bl=Math.hypot(L*.4,.6);b.at(x0+.08,.28,.17,0,q=>bx(q,bl/2,0,0,bl,.11,.04,S.timberD),0,Math.atan2(.6,L*.4));}else bx(b,L*.3,.3,.165,.2,.78,.04,pick(S.paint,sd+2));
});

// ------------------------------------------------------------------ rovers, people, livestock (instanced, moving) -------
// The settlers' utility rover (the frame's +x is FORWARD): a farm truck in faded settler paint (terracotta, ochre, olive or
// cream by seed, never the military's teal): round chunky tyres under mudguards, a hood, a cab in a second paint with glass,
// a plank cargo bed with a tarped load, a roll bar with an amber light bar, warm headlights, a tail-light strip. LOW keeps
// the cab, the hood, the loaded bed and the four round wheels. c = the small town runabout.
function rover(b,o,c){const {pal,tint,mat,glow}=b.k,S=pal.set,sd=o.seed|0,hi=b.hi,PI=Math.PI,full=hi&&!c;
 const body=pick([S.paint[0],S.paint[1],S.paint[6],S.paint[3]],sd),cabC=pick([S.paint[6],S.paint[3],S.paint[0],S.paint[5]],sd),tarp=pick([S.canvas[0],S.canvas[3],S.canvas[4],S.canvas[0]],sd);
 for(const sx of [-1,1])for(const sz of [-1,1]){wheel(b,sx*1.02,.47,sz*.74,.47,.36,S.white,sz);if(hi)bx(b,sx*1.02,.95,sz*.79,1.12,.07,.3,tint(body,.62));}
 if(full)b.bev(-.03,.46,0,3.1,.5,1.36,body,{ch:.08});else bx(b,-.03,.46,0,3.1,.5,1.36,body);
 if(hi||!c){if(full)b.bev(1.2,.96,0,.66,.3,1.22,body,{ch:.07});else bx(b,1.2,.96,0,.66,.3,1.22,body);}
 if(hi){b.bev(.42,.96,0,.98,.95,1.4,cabC,{ch:.08});bx(b,.4,1.91,0,1.16,.07,1.52,S.roofRust);}else bx(b,.42,.96,0,.98,.98,1.4,cabC,S.roofRust);
 b.quad([.92,1.3,.58],[.92,1.3,-.58],[.92,1.8,-.58],[.92,1.8,.58],S.glass);
 if(hi||!c)for(const s of [-1,1])b.at(.42,0,s*.705,s>0?0:PI,q=>plate(q,0,1.34,0,.7,.44,S.glass));
 for(const s of [-1,1])plate3(b,[hi||!c?1.535:1.525,hi||!c?1.1:.76,s*.42],.2,S.lamp);
 b.quad([-1.585,1.0,-.6],[-1.585,1.0,.6],[-1.585,1.13,.6],[-1.585,1.13,-.6],glow(0xff5a3a,1.1));
 // the bed: boards, the load under a tarp, a crate; the roll bar and its light
 if(hi){for(const s of [-1,1])bx(b,-.84,.96,s*.64,1.46,.3,.07,S.timber);bx(b,-1.55,.96,0,.07,.3,1.3,S.timberD);b.dome(-1.0,.96,0,.5,.52,.52,tarp,{n:6,rings:2});}
 else if(!c){bx(b,-.86,.96,0,1.44,.3,1.34,S.timberD,S.timber);bx(b,-.98,1.26,0,.94,.3,1.0,tarp);}
 if(full){crate(b,-.38,.96,.22,.46,S.timber,.2);bx(b,-.4,.96,-.36,.2,.36,.3,S.fresh[0]);bx(b,1.56,.5,0,.1,.2,1.44,S.iron);plate3(b,[1.536,1.09,0],.3,S.iron);
  b.at(.42,0,.708,0,q=>plate(q,-.02,.99,0,.8,.3,sd%2?S.rust:pick(S.paint,sd+5)));b.quad([1.0,1.265,-.5],[1.42,1.265,-.5],[1.42,1.265,-.05],[1.0,1.265,-.05],S.rust,[1.2,0,0]);
  b.tube([-1.45,1.26,-.56],[-1.45,2.15,-.56],.03,S.iron,{n:3});b.tri([-1.45,2.15,-.56],[-1.45,1.95,-.56],[-1.75+.14,2.05,-.56],S.fresh[0]);b.tri([-1.45,1.95,-.56],[-1.45,2.15,-.56],[-1.61,2.05,-.56],S.fresh[0]);
  for(const s of [-1,1])b.tube([-.12,.96,s*.62],[-.12,2.12,s*.5],.06,S.iron,{n:4});b.tube([-.12,2.12,-.5],[-.12,2.12,.5],.06,S.iron,{n:4});}
 if(hi)bx(b,full?-.12:.4,c?1.98:2.1,0,.12,.1,.5,S.amber);else if(!c)b.gem(.4,2.0,0,.09,.09,.3,S.amber);
}
WK.model('settler-rover',(b,o)=>rover(b,o,false));
WK.model('town-rover',(b,o)=>b.at(0,0,0,-Math.PI/2,q=>rover(q,o,true),0,0,.625));
// A settler (faces +x of the frame, H tall), chunky enough to read from 30 m: short thick legs under a long coat that widens
// to the shoulders (its front left open on a shirt), a scarf yoke in a second colour, sleeves held a little off the body, a
// pack with a bedroll on the back, a big head under a wide-brimmed hat (odd seeds) or a pointed hood (even seeds). LOW keeps
// the two legs, the coat and yoke, the head and a cone of a hat.
function person(b,o,H){const {mat,tint,rect,circ}=b.k,sd=o.seed|0,hi=b.hi,PI=Math.PI,cl=(h,j=.06)=>mat(h,'cloth',0,j),hood=sd%2===0;
 const coat=pick([cl(0x6f7450),cl(0x8f4f36),cl(0xa98a55),cl(0x7a5a44)],sd),yoke=pick([cl(0xc9a04a),cl(0xcfc3a4),cl(0x9a4a32),cl(0xc9a04a)],sd),shirt=pick([cl(0xcfc3a4),cl(0xb39a66),cl(0xd8c8a0),cl(0xb8a27a)],sd),trous=cl(0x38302a,.04);
 const skin=pick([mat(0xc49a78,'flat'),mat(0x8a5a3c,'flat'),mat(0xe0b896,'flat')],sd+1),hair=mat(0x2a1e16,'flat'),hat=pick([cl(0xb39a66),cl(0xc7a868),cl(0x7a5634),cl(0x8a6a44)],sd),pack=mat(0x6a4a2c,'timber',.4,.05),roll=cl(0xcfc3a4);
 b.at(0,0,0,0,q=>{const hex=(rx,rz,y)=>({p:circ(rx,6,0,0,rz,PI/6),y});
  if(!hi){for(const s of [-1,1])q.tube([.02,0,s*.15],[0,.6,s*.13],.17,trous,{n:3,r2:.14});
   q.loft([{p:rect(.36,.54,0,-.02,0),y:.52},{p:rect(.56,.8,0,-.05,0),y:1.34}],(r,i)=>i===1?shirt:coat,{topMat:yoke});
   if(hood){q.loft([{p:rect(.4,.42,0,.01,0),y:1.34},{p:rect(.42,.44,0,0,0),y:1.6},{p:rect(.05,.05,0,-.12,0),y:1.78}],(r,i)=>!r&&i===1?skin:yoke,{top:false});return;}
   q.loft([{p:rect(.36,.36,0,.02,0),y:1.34},{p:rect(.36,.36,0,.02,0),y:1.62}],(r,i)=>i===3?hair:skin,{top:false});
   q.loft([{p:circ(.43,6,.03,0,.4),y:1.57},{p:circ(.05,6,.02,0,.05),y:1.78}],hat,{top:false});return;}
  for(const s of [-1,1]){q.tube([.03,0,s*.145],[0,.62,s*.12],.14,trous,{n:6,r2:.1});q.tube([0,1.25,s*.33],[.07,.68,s*.4],.095,tint(coat,.84),{n:6,r2:.08});}
  q.loft([hex(.2,.27,.52),hex(.28,.38,1.26),hex(.14,.16,1.4)],(r,i)=>r?yoke:i===5?shirt:coat,{top:false});
  bx(q,-.31,.8,0,.22,.48,.46,pack,roll);
  if(hood){q.loft([{p:circ(.23,6,.01,0,.23),y:1.36},{p:circ(.245,6,0,0,.24),y:1.62},{p:circ(.05,6,-.13,0,.05),y:1.8}],(r,i)=>!r&&(i===0||i===5)?skin:yoke,{top:false});return;}
  q.loft([{p:circ(.19,6,.02,0,.185),y:1.36},{p:circ(.2,6,.02,0,.195),y:1.64}],(r,i)=>i===2||i===3?hair:skin,{top:false});
  q.at(.02,1.6,0,0,r=>{r.cap(circ(.43,8,.02,0,.4,PI/8),0,hat,true);r.loft([{p:circ(.22,6),y:0},{p:circ(.18,6),y:.15}],hat,{topMat:tint(hat,1.12)});},0,-.09);},0,0,H/1.75);}
WK.model('settler-person',(b,o)=>person(b,o,1.75));
WK.model('town-person',(b,o)=>b.at(0,0,0,-Math.PI/2,q=>person(q,o,1.5)));
// Engineered livestock (the frame's +x is its front): a stocky barrel body with a shoulder hump, a dark back and hide patches,
// a thick neck carrying the head low, a dark muzzle, big pale horns, ears, four tapered legs with dark hooves, a tufted tail,
// and the herd's small amber ear tags (the only light it carries). LOW keeps the body, the head, the horns and the four legs.
WK.model('livestock',(b,o)=>{const {mat,glow,tint}=b.k,sd=o.seed|0,hi=b.hi,fl=(h,j=.08)=>mat(h,'flat',0,j);
 const hide=pick([fl(0xb39a78),fl(0x8f6a4a),fl(0xc9bfa6)],sd),spot=pick([fl(0x5a3e2c),fl(0x3a2e26),fl(0x8a5a3a)],sd),back=tint(spot,.85),dark=fl(0x2a211a,0),horn=fl(0xd9cfb4,0),tag=glow(0xffa84a,1),spots=sd%2?'01 10 11 15 26':'00 05 11 16 21';
 b.at(-.1,0,0,0,q=>{
  const ear=s=>q.quad([.64,.85,s*.31],[.76,.85,s*.31],[.76,.71,s*.38],[.64,.71,s*.38],tag,[.7,.6,0]);
  if(!hi){hull(q,[[-.78,.88,0,.32,.3],[.48,.95,0,.44,.36]],6,(k,i)=>i===5?back:i===0?spot:hide,{c0:hide,c1:hide});
   hull(q,[[.36,.98,0,.3,.27],[1.0,.5,0,.19,.19]],4,hide,{c1:dark});
   for(const [x,z] of [[-.52,-.2],[.3,-.2],[.3,.2],[-.52,.2]])q.tube([x,0,z],[x,.72,z],.1,tint(hide,.7),{n:3,r2:.16});
   for(const s of [-1,1]){q.tube([.72,.9,s*.17],[.9,1.26,s*.46],.08,horn,{n:3,r2:.02});ear(s);}return;}
  hull(q,[[-.8,.86,0,.22,.2],[-.5,.9,0,.4,.36],[.12,.96,0,.47,.4],[.5,.95,0,.36,.3]],8,(k,i)=>i===7?back:spots.includes(''+k+i)?spot:hide,{c0:hide,c1:hide});
  hull(q,[[.36,.98,0,.3,.25],[.7,.83,0,.25,.23],[.9,.64,0,.23,.21],[1.03,.46,0,.17,.17]],6,(k,i)=>k===2?dark:k===1&&i===5?spot:hide,{c1:dark});
  for(const s of [-1,1]){q.tube([.74,.94,s*.16],[.9,1.28,s*.46],.08,horn,{n:4,r2:.02});q.tube([.7,.88,s*.18],[.7,.84,s*.36],.065,hide,{n:3,r2:.03});ear(s);}
  // legs: thick where they leave the body, thin shanks, dark hooves; the hind ones set back at the hock
  for(const [x,z,dx] of [[.3,-.2,0],[.3,.2,0],[-.5,-.19,-.1],[-.5,.19,-.1]])q.loft([{p:b.k.rect(.17,.17,0,x+dx+.02,z),y:0},{p:b.k.rect(.12,.12,0,x+dx,z),y:.14},{p:b.k.rect(dx?.3:.24,.2,0,x,z),y:.76}],(r)=>r?hide:dark,{top:false});
  q.tube([-.8,.98,0],[-.92,.52,0],.05,back,{n:3,r2:.035});q.gem(-.93,.44,0,.07,.12,.07,dark);});
});

// ------------------------------------------------------------------ the town's settler homes (7 x 7 m lots, instanced) --
// a small tank on a crate stand (the compact roof / yard tank of the town homes)
function miniTank(b,x,y,z,r,h,m){const S=b.k.pal.set,n=b.hi?8:6;bx(b,x,y,z,r*1.5,h*.34,r*1.5,S.timberD);b.cyl(x,y+h*.34,z,r,h*.5,m,{n});b.cyl(x,y+h*.84,z,r*1.06,h*.16,S.roofRust,{n,r2:.06});if(b.hi)hoop(b,x,y+h*.52,z,r*1.03,.07,S.iron,n);}
// Town home: dome — the compact cousin of settler-home: a patched prefab dome on a drum, a bolted-on cabin, a porch.
WK.model('town-home-dome',(b,o)=>{const {pal,tint,mat,glow,circ}=b.k,S=pal.set,w=o.w,d=o.d,h=o.h,sd=o.seed|0,hi=b.hi,PI=Math.PI,f0=.3;
 const wall=pick(S.paint,sd),domeC=pick(S.paint,sd+2),patch=pick(S.paint,sd+5),accent=pick(S.fresh,sd),r=Math.min(w,d)*.31,cz=-d*.1,hc=f0+(h-f0)*.36,dh=(h-f0)*.44,n=8,flip=sd%2?-1:1,ringAt=(rr,y)=>({p:circ(rr,n,0,cz,rr,PI/8),y});
 bx(b,0,0,0,w,.3,d,S.conc);
 if(hi)b.loft([ringAt(r*1.03,f0),ringAt(r*1.03,f0+.25)],S.iron,{top:false});b.loft([ringAt(r,f0),ringAt(r,hc)],(rr,i)=>i%3===1?patch:wall,{top:false});b.loft([ringAt(r*1.06,hc),ringAt(r*1.06,hc+.18)],S.timberD,{top:false});
 const L=hi?3:2,rings=[];for(let i=0;i<=L;i++){const t=i/L*PI/2*.92,c=Math.cos(t),s=Math.sin(t);rings.push(ringAt(r*1.02*c,hc+.18+dh*s));}
 b.loft(rings,(rr,i)=>(i+rr)%5===0?patch:(i%2?domeC:tint(domeC,.9)),{top:true,topMat:S.iron});
 b.cyl(0,hc+.14+dh*.97,cz,r*.26,.22,S.roofRust,{n:6,r2:r*.3});
 if(hi)for(let k=0;k<n;k++){const a=k/n*TAU+PI/8;b.tube([Math.cos(a)*r*1.04,hc+.16,cz+Math.sin(a)*r*1.04],[Math.cos(a)*r*.42,hc+.18+dh*.91,cz+Math.sin(a)*r*.42],.04,S.timberD,{n:3});}
 const ap=r*Math.cos(PI/n)+.01;for(const k of [0,2,5]){const a=(k+.5)/n*TAU+PI/8;b.at(Math.cos(a)*ap,0,cz+Math.sin(a)*ap,-a+PI/2,q=>win(q,0,f0+(hc-f0)*.42,0,.72,.62,{bar:true,sill:k!==5,glass:k===2?S.amber:S.warm}));}
 // the bolted-on cabin, the porch with its lean-to roof, the door and lantern
 const mx=flip*(r*.78+w*.08),mw=w*.26,mdp=d*.3,mh=(hc-f0)*.86;if(hi)b.bev(mx,f0,cz+.1,mw,mh,mdp,S.scrap,{ch:.06});else bx(b,mx,f0,cz+.1,mw,mh,mdp,S.scrap);
 b.quad([mx-mw/2-.12,f0+mh+.02,cz+.1-mdp/2-.12],[mx+mw/2+.12,f0+mh+.02,cz+.1-mdp/2-.12],[mx+mw/2+.12,f0+mh+.26,cz+.1+mdp/2+.12],[mx-mw/2-.12,f0+mh+.26,cz+.1+mdp/2+.12],S.roofRust,[mx,0,cz]);
 b.at(mx,0,cz+.1+mdp/2,0,q=>{if(hi)q.quad([-mw/2,f0+mh,0],[mw/2,f0+mh,0],[mw/2,f0+mh+.24,0],[-mw/2,f0+mh+.24,0],S.scrap);win(q,0,f0+mh*.45,0,.55,.5,{sill:false,mid:false});});
 const pz=cz+r*.9,pw=w*.5,pd=d/2-.28-pz,ph=f0+(hc-f0)*.92;bx(b,0,f0,pz+pd/2,pw,.14,pd,S.timber);
 for(const sx of [-1,1]){if(hi)bx(b,sx*(pw/2-.12),f0+.14,pz+pd-.14,.14,ph-f0-.14,.14,S.timberD);else b.tube([sx*(pw/2-.12),f0,pz+pd-.14],[sx*(pw/2-.12),ph,pz+pd-.14],.09,S.timberD,{n:3});}
 sheet(b,[-pw/2-.15,ph+.4,pz-.05],[pw/2+.15,ph+.4,pz-.05],[pw/2+.15,ph,pz+pd+.12],[-pw/2-.15,ph,pz+pd+.12],S.roofRust,tint(S.roof,.55));
 b.at(0,0,cz+r*Math.cos(PI/n),0,q=>dr(q,0,f0+.14,0,.85,1.7,tint(accent,.8)));
 if(hi){lantern(b,pw*.3,ph-.04,pz+pd*.6,.8);stringLights(b,[-pw/2,ph-.04,pz+pd+.08],[pw/2,ph-.04,pz+pd+.08],5,.14);}else plate(b,pw*.3,ph-.4,pz+pd-.1,.2,.24,S.lamp);
 // roof and yard kit (by seed)
 const py=hc+.18+dh*.62;stovepipe(b,-flip*r*.5,py,cz-r*.22,h-py-.22,1);
 if(sd%3===0)miniTank(b,-flip*(w*.34),f0,cz-d*.1,.55,(h-f0)*.5,S.tank);else if(sd%3===1){if(hi)planter(b,-flip*(w*.35),f0,cz+.2,.7,1.8,sd);else bx(b,-flip*(w*.35),f0,cz+.2,.7,.5,1.8,S.timberD,S.leaf);}else{crate(b,-flip*(w*.33),f0,cz-.3,.7,S.timber,.2);if(hi){crate(b,-flip*(w*.33),f0,cz+.6,.55,pick(S.fresh,sd+1),.5);barrel(b,-flip*(w*.36),f0,cz-1.2,.28,.8,S.rust);}}
});
// Town home: block — the compact cousin of settler-block: two stacked prefab modules, a mural, a balcony, a roof tank.
WK.model('town-home-block',(b,o)=>{const {pal,tint,mat,glow}=b.k,S=pal.set,w=o.w,d=o.d,h=o.h,sd=o.seed|0,hi=b.hi,PI=Math.PI,f0=.3;
 const cA=pick(S.paint,sd+5),cB=pick(S.paint,sd+2),accent=pick(S.fresh,sd),mur=[pick(S.fresh,sd+1),pick(S.fresh,sd+2),pick(S.fresh,sd+3)],y1=f0+(h-f0)*.42,yt=f0+(h-f0)*.8;
 const A={x0:-w*.4,x1:w*.33,z0:-d/2+.45,z1:d*.17},B={x0:-w*.39,x1:w*.14,z0:-d/2+.55,z1:d*.17-.85};
 const mod=(M,ya,yb,m,rim)=>{const cx=(M.x0+M.x1)/2,cz=(M.z0+M.z1)/2,mw=M.x1-M.x0,md=M.z1-M.z0;if(hi)module(b,cx,ya,cz,mw,yb-ya,md,m,rim);else{bx(b,cx,ya,cz,mw,yb-ya-.12,md,m);bx(b,cx,yb-.12,cz,mw+.16,.12,md+.16,rim);}};
 bx(b,0,0,0,w,.3,d,S.conc);mod(A,f0,y1,cA,S.roof);mod(B,y1,yt,cB,S.roofRust);
 b.at(0,0,A.z1,0,q=>{dr(q,A.x1-1.1,f0+.2,0,.9,1.85,tint(accent,.85));win(q,A.x0+1.5,f0+.95,0,1.1,.95,{bar:true,shut:hi?pick(S.fresh,sd+2):0});});
 b.at(0,0,B.z1,0,q=>{const gx=B.x1-.85;plate(q,gx,y1+.14,.03,.95,1.85,S.timberD);plate(q,gx,y1+.2,.05,.8,1.7,S.warm);win(q,B.x0+1.25,y1+.85,0,1.2,.95,{bar:true,glass:S.amber});awning(q,B.x0+1.25,y1+2.3,.04,1.7,.65,.36,hi?4:2,pick(S.canvas,sd+1),S.canvas[0],{val:.2});});
 b.at(A.x0,0,0,-PI/2,q=>{const u0=A.z0+.2,u1=A.z1-.2,band=(ya,yb,th,m,z)=>q.quad([u0,ya,z],[u0,ya-th,z],[u1,yb-th,z],[u1,yb,z],m,[0,0,-9]);band(f0+1.0,y1-.3,.7,mur[0],.03);band(f0+1.75,y1+.2,.65,mur[1],.035);});
 b.at(B.x0,0,0,-PI/2,q=>{const u0=B.z0+.2,u1=B.z1-.2;q.quad([u0,y1+1.2,.03],[u0,y1+.55,.03],[u1,yt-1.0,.03],[u1,yt-.35,.03],mur[2],[0,0,-9]);disc(q,u0+.85,yt-.8,.04,.4,S.fresh[2],hi?8:6);});
 // the balcony / porch, its rail and lights; a ladder to the terrace on the first module
 const bz1=d/2-.34,bx0=A.x0+.5,bx1=A.x1,byy=y1-.02;bx(b,(bx0+bx1)/2,byy-.13,(B.z1+bz1)/2,bx1-bx0,.13,bz1-B.z1,S.timber);
 for(const x of [bx0+.12,bx1-.12]){if(hi)bx(b,x,f0,bz1-.12,.15,byy-.13-f0,.15,S.timberD);else b.tube([x,f0,bz1-.12],[x,byy,bz1-.12],.09,S.timberD,{n:3});}
 if(hi){b.rail([[bx0+.08,byy,bz1-.08],[bx1-.08,byy,bz1-.08]],.85,S.timber,{step:1.6,r:.045});stringLights(b,[bx0,byy+.88,bz1-.04],[bx1,byy+.88,bz1-.04],5,.14);lantern(b,A.x1-1.9,y1-.3,A.z1+.3,.8);b.ladder([A.x1+.12,f0,A.z0+1.2],[A.x1+.12,y1+.7,A.z0+1.2],S.iron,{w:.45,dx:0,dz:1});}
 else bx(b,(bx0+bx1)/2,byy+.45,bz1-.08,bx1-bx0,.4,.05,S.timber);
 // side and back windows, roof kit (by seed), a stovepipe
 b.at(B.x1,0,0,PI/2,q=>win(q,-(B.z0+B.z1)/2,y1+.9,0,.9,.9,{bar:true}));b.at(0,0,A.z0,PI,q=>{win(q,-(A.x0+1.6),f0+1.0,0,.85,.9,{bar:true,lit:sd%2===0});});b.at(0,0,B.z0,PI,q=>win(q,-(B.x0+1.6),y1+.9,0,.85,.9,{bar:true}));
 const rx=(B.x0+B.x1)/2,rz=(B.z0+B.z1)/2,tx=(B.x1+A.x1)/2;
 if(sd%3===0)miniTank(b,rx+.3,yt,rz-.2,.62,h-yt-.02,S.tank);else if(sd%3===1){if(hi){planter(b,rx,yt,rz+.5,2.0,.5,sd);bx(b,rx+.4,yt,rz-.7,1.2,.4,.5,S.timberD,S.leafD);}else bx(b,rx,yt,rz,2.0,.5,1.4,S.timberD,S.leaf);}else solarPanel(b,rx+.2,yt,rz,2.0,1.4,.5);
 stovepipe(b,B.x0+.6,yt,B.z0+.6,h-yt-.2,1);
 crate(b,tx,y1,B.z0+.5,.5,S.timber,.3);if(hi)barrel(b,tx,y1,rz+.4,.24,.7,S.rust);
});
// Town home: water tower — the compact cousin of settler-water-tower.
WK.model('town-home-tower',(b,o)=>waterTower(b,o,true));
// Town home: greenhouse — the compact cousin of settler-greenhouse, with its water butt and a planter by the door.
WK.model('town-home-green',(b,o)=>{const S=b.k.pal.set,hi=b.hi,sd=o.seed|0,G=greenhouse(b,o,true),{tx1,xc,len,cz,r,f0}=G;
 barrel(b,tx1-.25,f0,cz+r+.5,.36,1.0,S.paint[5]);if(hi){planter(b,xc-len*.3,f0,cz+r+.65,len*.3,.5,sd);planter(b,xc+len*.22,f0,cz+r+.95,len*.22,.5,sd+1);sack(b,xc-.2,f0,cz+r+.9,.28,S.canvas[0]);}else bx(b,xc-len*.3,f0,cz+r+.65,len*.3,.5,.5,S.timberD,S.leaf);
});
// Town home: market stall — the compact cousin of settler-shop: a small false-front store behind its counter and awning.
WK.model('town-home-shop',(b,o)=>{const {pal,tint,mat,glow}=b.k,S=pal.set,w=o.w,d=o.d,h=o.h,sd=o.seed|0,hi=b.hi,PI=Math.PI,f0=.3;
 const wall=pick(S.paint,sd+2),accent=pick(S.fresh,sd),c0=pick([S.canvas[1],S.canvas[2],S.canvas[4],S.canvas[3]],sd),c1=S.canvas[0],dark=mat(0x1d1712,'flat');
 const bz0=-d/2+.4,bz1=-d*.09,bzc=(bz0+bz1)/2,bw=w-1.0,H=h-f0,yw=f0+H*.5,yf=f0+H*.66;
 bx(b,0,0,0,w,.3,d,S.conc);
 if(hi)b.bev(0,f0,bzc,bw,yw-f0,bz1-bz0,wall,{ch:.07});else bx(b,0,f0,bzc,bw,yw-f0,bz1-bz0,wall);
 for(let i=0;i<2;i++){const x0=-bw/2-.15+(bw+.3)*i/2,x1=x0+(bw+.3)/2;b.quad([x0,yf-.05,bz1],[x1,yf-.05,bz1],[x1,yw,bz0-.15],[x0,yw,bz0-.15],i?S.roofRust:S.roof,[0,0,bzc]);}
 if(hi)for(const s of [-1,1])b.tri([s*bw/2,yw,bz0],[s*bw/2,yw,bz1],[s*bw/2,yf-.07,bz1],wall,[0,yw,bzc]);
 bx(b,0,yw-.25,bz1-.02,bw+.14,yf-yw+.35,.14,S.timber);
 const sw=w*.5,sy=yf+.16,sh=Math.min(H*.2,h-sy-.12);bx(b,0,sy,bz1,sw,sh,.1,accent);plate(b,0,sy+sh*.3,bz1+.06,sw*.72,sh*.24,S.white);if(hi){plate(b,-sw*.12,sy+sh*.66,bz1+.06,sw*.4,sh*.14,S.white);for(const s of [-1,1])b.tube([s*sw*.36,sy+.1,bz1-.05],[s*sw*.36,yf-.25,bz1-.7],.035,S.timberD,{n:3});}
 b.at(0,0,bz1+.05,0,q=>{const ow=bw*.8;plate(q,0,f0+.12,.03,ow,yw-f0-.62,dark);plate(q,0,f0+1.25,.05,ow-.3,.06,S.timber);for(let i=0;i<3;i++)plate(q,-ow*.3+ow*.3*i,f0+1.33,.06,.3,.26,i%2?S.amber:S.warm);});
 stall(b,{S,w:bw+.2,z0:bz1+.08,z1:d/2-.24,y0:f0,ya:yw-.05,yb:f0+H*.42,sd,c0,c1,n:6,posts:hi?[-bw/2+.05,0,bw/2-.05]:[-bw/2+.05,bw/2-.05],cw:bw*.6,cx:-bw*.12,cz:d/2-1.0,lamps:2,lite:true});
 for(const s of [-1,1])b.at(s*bw/2,0,bzc,s*PI/2,q=>win(q,0,f0+1.0,0,.8,.85,{bar:true,lit:s>0}));
 const vy=yw+(yf-yw)*.4;stovepipe(b,bw*.34,vy-.1,bz0+.45,h-vy-.12,1);if(hi){b.cyl(-bw*.26,vy-.1,bzc-.1,.24,.4,S.iron,{n:6});b.dome(-bw*.26,vy+.3,bzc-.1,.36,.3,.36,S.scrap,{n:6,rings:2});}
 crate(b,-bw/2+.4,f0,d/2-.75,.6,S.timber,.2);barrel(b,bw/2-.35,f0,d/2-.7,.28,.8,S.rust);if(hi){crate(b,-bw/2+.42,f0+.52,d/2-.75,.45,pick(S.fresh,sd+2),-.3);sack(b,bw*.28,f0,d/2-1.0,.3,S.canvas[0]);}
});

// ------------------------------------------------------------------ settler-home ----------------------------------------
// A prefab dome home that a family has lived in for years: a patched dome on a drum wall, a bolted-on habitat module, a
// timber porch under a corrugated lean-to, a stovepipe, a water tank, and their things.
WK.model('settler-home',(b,o)=>{const {pal,tint,mat,glow}=b.k,S=pal.set,w=o.w,d=o.d,h=o.h,sd=o.seed|0,hi=b.hi;
 const wall=pick(S.paint,sd),domeC=pick(S.paint,sd+2),patch=pick(S.paint,sd+5),accent=pick(S.fresh,sd),r=Math.min(w,d)*.335,cz=-d*.09,hc=h*.34,flip=sd%2?-1:1;
 // slab and a step of field stone
 b.bev(0,-.5,0,w-.5,.72,d-.5,S.conc,{ch:.14});
 // drum wall: eight painted panels, every other one a different faded paint; a dark kick band at its foot
 const n=8,ringAt=(rr,y)=>({p:b.k.circ(rr,n,0,cz,rr,Math.PI/8),y});
 b.loft([ringAt(r*1.03,.22),ringAt(r*1.03,.5)],S.iron,{top:false});
 b.loft([ringAt(r,.5),ringAt(r,hc)],(rr,i)=>i%3===1?patch:wall,{top:false});
 b.loft([ringAt(r*1.05,hc),ringAt(r*1.05,hc+.22)],S.timberD,{top:false});   // eave band
 // the dome: flat-faceted prefab shell in two paints with a bolted patch, a vent cap on top
 const dh=h*.4,L=hi?4:2,rings=[];for(let i=0;i<=L;i++){const t=i/L*Math.PI/2*.93,c=Math.cos(t),s=Math.sin(t);rings.push(ringAt(r*1.02*c,hc+.22+dh*s));}
 b.loft(rings,(rr,i)=>(i+rr)%5===0?patch:(i%2?domeC:tint(domeC,.9)),{top:true,topMat:S.iron});
 b.cyl(0,hc+.2+dh*.98,cz,r*.2,.3,S.iron,{n:8,bev:.04});b.cyl(0,hc+.5+dh*.98,cz,r*.3,.1,S.roofRust,{n:8,r2:.06});
 if(hi){for(let k=0;k<n;k++){const a=k/n*TAU+Math.PI/8;b.tube([Math.cos(a)*r*1.04,hc+.2,cz+Math.sin(a)*r*1.04],[Math.cos(a)*r*.36,hc+.22+dh*.93,cz+Math.sin(a)*r*.36],.045,S.timberD,{n:3});}}
 // lit round-ish windows on the drum's side faces
 for(const k of [0,2,5,7]){const a=(k+.5)/n*TAU+Math.PI/8,ap=r*Math.cos(Math.PI/n)+.01;b.at(Math.cos(a)*ap,0,cz+Math.sin(a)*ap,-a+Math.PI/2,q=>{q.window(0,hc*.48,0,.8,.7,{color:0xffc47a,k:.85,mid:true,frame:S.timberD});if(hi)q.box(0,hc*.48-.16,.12,1,.08,.2,S.timber);});}
 // the bolted-on module on one side: a small corrugated cabin with its own shed roof and a porthole
 const mx=flip*(r*.74+w*.1),mw=w*.3,mdp=d*.36,mh=hc*.92;b.bev(mx,.2,cz+.2,mw,mh,mdp,S.scrap,{ch:.07});
 b.at(mx,mh+.2,cz+.2,0,q=>q.quad([-mw/2-.15,.0,-mdp/2-.15],[mw/2+.15,.0,-mdp/2-.15],[mw/2+.15,.34*flip>0?.34:0,mdp/2+.15],[-mw/2-.15,.34*flip>0?.34:0,mdp/2+.15],S.roofRust,[0,-1,0]));
 b.box(mx,mh+.16,cz+.2,mw+.2,.08,mdp+.2,S.roofRust);
 b.at(mx+flip*(mw/2+.01),0,cz+.2,flip>0?Math.PI/2:-Math.PI/2,q=>q.window(0,mh*.5,0,.6,.5,{color:0xffc47a,k:.7,frame:S.iron}));
 // the porch: plank deck, posts, a corrugated lean-to roof, the door and its lantern
 const pz=cz+r*.92,pw=w*.56,pd=d/2-.35-pz,py=.34;b.bev(0,.2,pz+pd/2,pw,py-.2+.06,pd,S.timber,{ch:.04});
 const ph=hc*.86;for(const sx of [-1,1])b.box(sx*(pw/2-.14),py,pz+pd-.16,.16,ph-py,.16,S.timberD);
 if(hi){for(const sx of [-1,1])b.tube([sx*(pw/2-.14),ph-.5,pz+pd-.16],[sx*(pw/2-.6),ph,pz+pd-.16],.04,S.timberD,{n:3});b.rail([[-pw/2+.14,py,pz+pd-.16],[-pw/2+.14,py,pz+.2]],.8,S.timberD,{step:1.2});b.rail([[pw/2-.14,py,pz+pd-.16],[pw/2-.14,py,pz+.2]],.8,S.timberD,{step:1.2});}
 b.quad([-pw/2-.2,ph+.5,pz-.1],[pw/2+.2,ph+.5,pz-.1],[pw/2+.2,ph,pz+pd+.2],[-pw/2-.2,ph,pz+pd+.2],S.roofRust,[0,0,pz]);b.quad([-pw/2-.2,ph+.42,pz-.1],[pw/2+.2,ph+.42,pz-.1],[pw/2+.2,ph-.08,pz+pd+.2],[-pw/2-.2,ph-.08,pz+pd+.2],tint(S.roof,.6),[0,ph+2,pz]);
 b.at(0,0,cz+r*Math.cos(Math.PI/n),0,q=>{q.door(0,py,0,.95,1.95,{mat:tint(accent,.8),frame:S.timberD,step:false});});
 b.box(0,.02,pz+pd+.28,1.5,.2,.5,S.stone);
 lantern(b,pw*.3,ph-.02,pz+pd*.7);
 // roof kit and yard: stovepipe, water tank or garden, antenna, clutter, laundry or planter (by seed)
 stovepipe(b,-flip*r*.5,hc+.2+dh*.62,cz-r*.25,h*.3);
 if(sd%3===0)waterTank(b,-flip*(w*.34),.2,cz-d*.22,.72,h*.52,S.tank);else if(sd%3===1){planter(b,-flip*(w*.33),.2,cz+.3,.8,2.2,sd);planter(b,-flip*(w*.33),.2,cz-2,.8,1.4,sd+1);}else clutter(b,-flip*(w*.3),cz-.6,4,sd);
 clutter(b,mx-flip*.2,pz+pd*.5,hi?3:1,sd+3);
 if(hi){b.detail(()=>{b.tube([flip*r*.3,hc+.2+dh*.8,cz-r*.3],[flip*r*.3,hc+.2+dh*.8+h*.3,cz-r*.3],.025,S.iron,{n:3});b.box(flip*r*.3,hc+.2+dh*.8+h*.3,cz-r*.3,.08,.08,.08,glow(0xff5a3a,1.2));signBoard(b,-pw*.2,ph-.72,pz+pd-.02,1.3,sd);
   for(let k=0;k<5;k++)b.box(-pw/2+pw*(k+.5)/5,ph-.12-.07*Math.sin((k+.5)/5*Math.PI),pz+pd+.16,.09,.09,.09,glow(k%2?0xffb347:0xff7a4a,1.3));});
  if(sd%2===0)laundry(b,[flip*(w*.44),2.1,cz+d*.3],[flip*(w*.44),2.1,cz-d*.32],sd);
  b.pool(0,.26,pz+pd+.9,1.6,1.1,0xffa84a,.16);}
});
})(typeof globalThis!=='undefined'?globalThis:window);
