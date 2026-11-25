/* LUNAR Conquest world kit — MILITARY models (Session 5E-2d1). The Refuge, the viaduct, Command Bases, the frontier wall and
 * the terraformers' works: cool gunmetal armour, pale ceramic plates, ribs and buttresses, gold trim, cyan and white light
 * (the owner's Meshy town items are the reference). Orderly, symmetric, repeated — nothing hand-made or left lying about.
 * Every model stays inside its slot box (js/conquest/slots.js). b.hi === false is LOW: silhouette and big colour blocks. */
(function(root){
'use strict';
const WK=root.ConquestWorldKit,TAU=Math.PI*2;

// ------------------------------------------------------------------ shared military parts ------------------------------
// an armoured equipment box with a status light
function gearBox(b,x,y,z,w,h,d,light){const M=b.k.pal.mil;b.bev(x,y,z,w,h,d,M.hull2,{ch:.07});if(b.hi){b.box(x,y+h*.2,z+d/2,w*.7,h*.5,.04,M.dark);for(let k=0;k<3;k++)b.box(x,y+h*(.28+.14*k),z+d/2+.02,w*.6,.04,.03,M.trim);}b.box(x+w*.3,y+h*.8,z+d/2+.02,.14,.1,.04,light||M.amber);}
// a roof vent / air handler
function airUnit(b,x,y,z,s){const M=b.k.pal.mil;b.bev(x,y,z,1.5*s,.7*s,1.1*s,M.trim,{ch:.06});b.cyl(x,y+.7*s,z,.36*s,.14*s,M.dark,{n:8});if(b.hi)b.ring(x,y+.86*s,z,.36*s,M.bare,{thin:true});}
// a beacon mast: tube, collar, red light
function beacon(b,x,y,z,h){const M=b.k.pal.mil;b.tube([x,y,z],[x,y+h,z],.07,M.trim,{n:5});b.box(x,y+h,z,.24,.24,.24,M.red);if(b.hi){b.cyl(x,y,z,.16,.3,M.hull2,{n:6});b.tube([x,y+h*.6,z],[x+.5,y+h*.6,z],.03,M.bare,{n:3});b.box(x+.5,y+h*.6-.12,z,.05,.3,.05,M.bare);}b.halo(x,y+h+.12,z,.9,0xff3048,1.1);}

// ------------------------------------------------------------------ refuge-habitat --------------------------------------
// An armoured hex pod: battered gunmetal hull on a lit plinth, six corner buttresses, pale ceramic plates above a belt,
// lit window bands, an airlock with a ramp, a stepped roof with a white skylight dome, plant gear at the back.
// o.sink = how far the plinth runs below y = 0 (slopes). The front (airlock) faces +z. Solid art stays inside r 8.6.
WK.model('refuge-habitat',(b,o)=>{const {pal,tint,circ,glow}=b.k,M=pal.mil,hi=b.hi,sink=o.sink??1.6,f0=.6,C6=Math.cos(Math.PI/6);
 const hex=(r,y)=>({p:circ(r,6,0,0,r,0),y}),face=(k,fn)=>{const a=Math.PI/2-k*Math.PI/3;b.at(Math.cos(a),0,Math.sin(a),-a+Math.PI/2,fn);},onFace=(k,ap,fn)=>{const a=Math.PI/2-k*Math.PI/3;b.at(Math.cos(a)*ap,0,Math.sin(a)*ap,-a+Math.PI/2,fn);};
 // plinth: concrete down the slope, an armoured kerb, the cyan ground strip
 b.loft([hex(8.22,-sink),hex(8.22,f0-.3)],M.conc,{top:false});b.loft([hex(8.34,f0-.3),hex(8.34,f0-.12)],M.cyan,{top:false});b.loft([hex(8.3,f0-.12),hex(8.3,f0),hex(7.7,f0)],M.hull2,{top:false});
 // hull: battered lower body, a dark belt, pale plates above, a gold cornice under the roof
 b.loft([hex(7.62,f0),hex(7.5,3.25)],M.hull,{top:false});b.loft([hex(7.5,3.25),hex(7.7,3.33),hex(7.7,3.6),hex(7.42,3.68)],M.hull2,{top:false});
 b.loft([hex(7.42,3.68),hex(7.3,5.6)],M.plate,{top:false});b.loft([hex(7.3,5.6),hex(7.58,5.68),hex(7.58,5.8)],M.gold,{top:false});b.loft([hex(7.6,5.8),hex(7.6,5.92)],M.cyan,{top:false});
 // stepped roof: armoured slope, a deck, the top hat and its glowing skylight
 b.loft([hex(7.56,5.92),hex(5.5,7.05),hex(3.5,7.15)],(r)=>r?M.hull2:M.hull,{top:false});b.loft([hex(3.3,7.15),hex(3.15,8.2),hex(2.9,8.3)],(r)=>r?M.gold:M.plate,{top:false});
 b.dome(0,8.3,0,2.7,1.15,2.7,glow(0xd8f2ff,.62),{n:hi?12:6,rings:hi?4:2});if(hi){b.ring(0,8.34,0,2.82,M.gold);b.halo(0,9,0,2.4,0xcfefff,.22);}
 // six corner buttresses (the Meshy reactor's ribs): dark fins with a light slit on every other one
 for(let k=0;k<6;k++){const a=k*Math.PI/3;b.at(Math.cos(a)*7.5,0,Math.sin(a)*7.5,-a,q=>{if(hi)q.loft([{p:b.k.rect(1.1,.62,.1),y:f0},{p:b.k.rect(1.0,.56,.1),y:5.5},{p:b.k.rect(.5,.4,.08),y:6.5}],M.hull2,{top:true});else q.box(0,f0,0,1,5.4,.56,M.hull2);if(k%2===0)q.box(.56,1.2,0,.04,4,.14,M.cyan);});}
 // window faces: a recessed lit band up high, a bolted armour panel below, a vent
 for(const k of [1,2,4,5]){onFace(k,7.3*C6,q=>{q.box(0,3.95,.03,5.2,1.15,.1,M.dark);q.box(0,4.14,.07,4.5,.7,.08,M.ice);if(hi){for(let j=-2;j<=2;j++)q.box(j*.9,4.1,.1,.07,.78,.1,M.dark);q.box(0,3.86,.14,5.4,.09,.22,M.trim);}else for(const j of [-1.5,-.5,.5,1.5])qb(q,j*.9,4.12,.1,.12,.74,.04,M.glassDark,'kblrt');});
  onFace(k,7.56*C6,q=>{if(hi){q.bev(0,1,.02,4.4,1.7,.14,M.plate2,{ch:.06});for(const sx of [-1,1])for(const sy of [0,1])q.box(sx*1.95,1.12+sy*1.34,.16,.1,.1,.04,M.bare);q.box(1.2,1.4,.17,1.3,.7,.04,M.dark);for(let j=0;j<4;j++)q.box(1.2,1.5+j*.15,.19,1.2,.04,.04,M.trim);}else q.box(0,1,.02,4.4,1.7,.1,M.plate2);});}
 // the airlock: frame, glowing door, header light, canopy, ramp with lit edges
 onFace(0,7.56*C6,q=>{q.bev(0,f0,.25,3.3,3.5,.6,M.hull2,{ch:.1});q.box(0,f0+.1,.56,2.2,2.9,.08,glow(0x22e6ff,.82));q.box(0,f0+3.1,.6,2.7,.13,.1,M.ice);
  if(!hi)qb(q,0,f0+.1,.59,.12,2.9,.04,M.glassDark,'kblrt');if(hi){q.box(0,f0+.1,.6,.1,2.9,.08,M.dark);for(const sx of [-1,1]){q.box(sx*1.28,f0+.1,.6,.16,3,.12,M.gold);q.box(sx*1.75,f0+1.5,.5,.12,.5,.12,M.amber);}q.at(0,f0+3.7,.9,0,r=>r.bev(0,0,0,4,.22,1.5,M.trim,{ch:.06}),-.12);}
  else q.box(0,f0+3.7,.9,4,.2,1.4,M.trim);
  q.quad([-2.2,f0,.5],[2.2,f0,.5],[2.2,-.05,2.25],[-2.2,-.05,2.25],M.hull2,[0,-3,1]);q.quad([-2.2,-sink,2.25],[2.2,-sink,2.25],[2.2,-.05,2.25],[-2.2,-.05,2.25],M.conc,[0,0,0]);for(const sx of [-1,1]){q.quad([sx*2.2,-sink,.5],[sx*2.2,-sink,2.25],[sx*2.2,-.05,2.25],[sx*2.2,f0,.5],M.conc,[0,0,1.4]);if(hi)q.tube([sx*2.1,f0+.03,.55],[sx*2.1,-.02,2.2],.05,M.cyan,{n:3});}
  if(!hi)q.box(0,-.04,2.2,4.4,.07,.07,M.cyan);q.pool(0,.14,2.9,1.8,1.4,0x6fd6e0,.16);});
 // the back face: plant gear, two tanks and a riser pipe to the roof
 onFace(3,7.56*C6,q=>{gearBox(q,-1.1,f0,.62,2.3,1.9,1.1,M.amber);if(hi){for(const sx of [.9,1.9]){q.cyl(sx,f0,.55,.42,2.3,M.plate2,{n:8,bev:.08});q.ring(sx,f0+1.2,.55,.43,M.gold,{thin:true});}q.pipe([[1.4,f0+2.3,.55],[1.4,f0+3,.3],[1.4,5.2,.12]],.11,M.bare);q.pipe([[-2,f0+1.9,.5],[-2,3.1,.2],[-2,5.2,.12]],.09,M.trim);}});
 // roof kit: air handlers, a hatch, the beacon mast
 airUnit(b,3.4,6.72,-2.6,1);if(hi){airUnit(b,-3.6,6.66,2.2,.8);b.bev(-3.3,6.75,-2.9,1.3,.25,1.3,M.gold,{ch:.05});b.cyl(4.4,6.5,1.6,.3,.9,M.dark,{n:6});b.cyl(4.4,7.4,1.6,.36,.12,M.bare,{n:6});}
 beacon(b,1.5,8.3,-1.1,3);
});

// ------------------------------------------------------------------ more shared parts ----------------------------------
const oct=(b,r,y,cx=0,cz=0)=>({p:b.k.circ(r,8,cx,cz,r,Math.PI/8),y}),ngon=(b,n,r,y,rot=0,cx=0,cz=0)=>({p:b.k.circ(r,n,cx,cz,r,rot),y}),rc=(b,w,d,y,ch=0,cx=0,cz=0)=>({p:b.k.rect(w,d,ch,cx,cz),y});
// a frame at angle a (radians, from +x toward +z) and radius r whose +z looks outward (+x is the tangent)
const rad=(b,a,r,y,fn)=>b.at(Math.cos(a)*r,y,Math.sin(a)*r,-a+Math.PI/2,fn);
// a frame whose +y runs along world +x: lofts in it extrude along x (pipes, beams, car bodies). A ring point is [-y, z].
const alongX=(b,x,y,z,fn)=>b.at(x,y,z,0,fn,0,-Math.PI/2);
// a cheap box: two triangles a face, only the faces not named in `skip` (t top, b bottom, f +z, k -z, r +x, l -x)
function qb(b,x,y,z,w,h,d,m,skip=''){const x0=x-w/2,x1=x+w/2,y1=y+h,z0=z-d/2,z1=z+d/2,c=[x,y+h/2,z],t=o=>(typeof m==='function'?m(o):m);
 if(!skip.includes('t'))b.quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],t('t'),c);if(!skip.includes('b'))b.quad([x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1],t('b'),c);
 if(!skip.includes('f'))b.quad([x0,y,z1],[x1,y,z1],[x1,y1,z1],[x0,y1,z1],t('f'),c);if(!skip.includes('k'))b.quad([x0,y,z0],[x1,y,z0],[x1,y1,z0],[x0,y1,z0],t('k'),c);
 if(!skip.includes('r'))b.quad([x1,y,z0],[x1,y,z1],[x1,y1,z1],[x1,y1,z0],t('r'),c);if(!skip.includes('l'))b.quad([x0,y,z0],[x0,y,z1],[x0,y1,z1],[x0,y1,z0],t('l'),c);return b;}
// a flat ring with a rectangular section (gantry decks, parapets): inner r0, outer r1, height h, n segments
function hoop(b,y,r0,r1,h,n,m,o={}){const rot=o.rot||0,cx=o.x||0,cz=o.z||0,top=o.top||m,out=o.out||m;for(let i=0;i<n;i++){const a0=i/n*TAU+rot,a1=(i+1)/n*TAU+rot,c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1),am=(a0+a1)/2,rm=(r0+r1)/2,ins=[cx+Math.cos(am)*rm,y+h/2,cz+Math.sin(am)*rm],p=(r,c,s,yy)=>[cx+c*r,yy,cz+s*r];
  b.quad(p(r1,c0,s0,y),p(r1,c1,s1,y),p(r1,c1,s1,y+h),p(r1,c0,s0,y+h),out,ins);if(!o.noIn)b.quad(p(r0,c0,s0,y),p(r0,c1,s1,y),p(r0,c1,s1,y+h),p(r0,c0,s0,y+h),m,ins);
  b.quad(p(r0,c0,s0,y+h),p(r1,c0,s0,y+h),p(r1,c1,s1,y+h),p(r0,c1,s1,y+h),top,ins);if(!o.noBot)b.quad(p(r0,c0,s0,y),p(r1,c0,s0,y),p(r1,c1,s1,y),p(r0,c1,s1,y),m,ins);}return b;}
// hazard chevrons on a wall facing +z of the current frame: n alternating bars over w x h
function hazard(b,x,y,z,w,h,n){const M=b.k.pal.mil;for(let k=0;k<n;k++){const xa=x-w/2+w*k/n,xb=xa+w/n;b.quad([xa,y,z],[xb,y,z],[xb,y+h,z],[xa,y+h,z],k%2?M.hazardD:M.hazard,[x,y,z-1]);}return b;}
// a stack of supply crates (tidy): n crates of size s in a row along x, a second layer when n > 2
function crates(b,x,y,z,s,n,light){const M=b.k.pal.mil,row=Math.min(n,2);for(let k=0;k<n;k++){const lay=k<row?0:1,i=lay?k-row:k,cx=x+(i-(lay?(n-row-1)/2:(row-1)/2))*(s+.08),cy=y+lay*(s+.02);b.bev(cx,cy,z,s,s,s,lay?M.plate2:M.hull,{ch:.06});
  if(b.hi){qb(b,cx,cy+s*.42,z+s/2+.01,s*.86,s*.14,.03,M.gold,'kb');qb(b,cx+s*.28,cy+s*.7,z+s/2+.01,.12,.08,.03,light||M.cyan,'kb');}}}
// a gas canister standing on its base
function canister(b,x,y,z,r,h,m){const M=b.k.pal.mil,n=b.hi?8:6;b.cyl(x,y,z,r,h*.86,m||M.plate2,{n,bev:.05});if(b.hi){b.cyl(x,y+h*.86,z,r*.5,h*.1,M.hull2,{n:6});b.cyl(x,y+h*.5,z,r*1.04,h*.09,M.gold,{n,top:false});}}
// a sturdy lattice (hair-thin struts break into dotted moire on a phone): four thick square legs, a ring beam a bay, ONE
// diagonal a face a bay (zigzag) and, on HIGH, a pale gusset block at every joint. w0 / w1 = base / top width.
function lattice(b,x,y,z,w0,w1,h,bays,m,o={}){const M=b.k.pal.mil,r=o.r||.17,C=[[-1,-1],[1,-1],[1,1],[-1,1]],gs=r*3.1,gm=o.gusset||M.plate2,leg=(t,sx,sz)=>{const w=(w0+(w1-w0)*t)/2;return [x+sx*w,y+h*t,z+sz*w];};
 for(const [sx,sz] of C)b.tube(leg(0,sx,sz),leg(1,sx,sz),r*1.25,o.leg||m,{n:4});
 for(let k=0;k<bays;k++){const t0=k/bays,t1=(k+1)/bays;for(let i=0;i<4;i++){const a=C[i],c=C[(i+1)%4],f=(k+i)%2,p=f?c:a,q=f?a:c;
   b.tube(leg(t1,a[0],a[1]),leg(t1,c[0],c[1]),r,m,{n:b.hi?4:3});if(b.hi||i%2===0)b.tube(leg(t0,p[0],p[1]),leg(t1,q[0],q[1]),r*.9,m,{n:b.hi?4:3});
   if(b.hi&&k<bays-1){const g=leg(t1,a[0],a[1]);qb(b,g[0],g[1]-gs*.45,g[2],gs,gs*.9,gs,gm,'b');}}}
 return b;}
// a ladder that survives distance: two stout rails (0.9 m apart along x at most) and a rung every 0.7 m
function steps(b,a,c,w,m){const L=Math.hypot(c[0]-a[0],c[1]-a[1],c[2]-a[2]),n=Math.max(2,Math.round(L/.7));for(const s of [-1,1])b.tube([a[0]+s*w/2,a[1],a[2]],[c[0]+s*w/2,c[1],c[2]],.06,m,{n:4});
 for(let k=1;k<n;k++){const t=k/n,p=[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t,a[2]+(c[2]-a[2])*t];b.tube([p[0]-w/2,p[1],p[2]],[p[0]+w/2,p[1],p[2]],.045,m,{n:3});}return b;}

// ------------------------------------------------------------------ refuge-processor ------------------------------------
// THE landmark of the Refuge: an oxygen processor tower. Octagonal armoured plinth, a battered block with eight lit
// buttresses, a tapering banded shaft with four cyan ring gantries, pipe runs, a lift rail, a control cap, spire and beacon.
// o.h = tower height above the ground (90 or 128; the slot box's 146 means the 128 m tower). o.sink = plinth depth below y = 0.
// Solid art stays inside r 13 (r 10..12.8 between y 0.7 and 6).
WK.model('refuge-processor',(b,o)=>{const {pal,circ,glow}=b.k,M=pal.mil,hi=b.hi,sink=o.sink??1.6,H=o.h>129?128:(o.h||128),y0=13,rb=6.9,rt=5.3,rAt=y=>rb+(rt-rb)*(y-y0)/(H-y0),O=(r,y)=>oct(b,r,y),C8=Math.cos(Math.PI/8),n=hi?16:10,R=(r,y)=>({p:circ(r,n,0,0,r,Math.PI/n),y});
 // plinth: concrete down the slope, an armoured kerb, the cyan ground strip, the deck
 b.loft([O(12.6,-sink),O(12.6,1.9)],M.conc,{top:false});b.loft([O(12.74,1.9),O(12.74,2.28)],M.hull2,{top:false});b.loft([O(12.8,2.28),O(12.8,2.46)],M.cyan,{top:false});b.loft([O(12.72,2.46),O(12.72,2.6),O(10.3,2.63)],M.hull2,{top:false});
 // battered block: gunmetal, a belt, pale plates, gold cornice, a lit crown line
 const rB=y=>10.6-2*(y-2.6)/10.4;
 b.loft([O(rB(2.6),2.6),O(rB(8.6),8.6)],M.hull,{top:false});b.loft([O(rB(8.6),8.6),O(rB(8.7)+.24,8.72),O(rB(9.3)+.24,9.3),O(rB(9.42),9.42)],M.hull2,{top:false});
 b.loft([O(rB(9.42),9.42),O(rB(12.2),12.2)],M.plate,{top:false});b.loft([O(rB(12.2),12.2),O(rB(12.2)+.3,12.32),O(rB(12.2)+.3,12.6)],M.gold,{top:false});
 b.loft([O(rB(12.6)+.34,12.6),O(rB(12.6)+.34,12.82)],M.cyan,{top:false});b.loft([O(rB(12.8)+.3,12.82),O(8.5,13),O(6.8,13.04)],M.hull2,{top:false});
 // eight buttresses with a light strip each; the front one (+z) is the portal with the blast door
 for(let k=0;k<8;k++){const a=k*Math.PI/4,front=k===2,ap=y=>rB(y)*C8,d0=1.55,d1=.75,w=front?3.6:1.5;
  rad(b,a,0,0,q=>{q.loft([rc(q,w,d0,2.6,hi?.16:0,0,ap(2.6)+d0/2-.2),rc(q,w*.86,d1,11,hi?.12:0,0,ap(11)+d1/2-.2),rc(q,w*.5,.4,12.1,hi?.1:0,0,ap(12.1)+.05)],M.hull2);
   const za=ap(front?7.6:3.1)+(front?1.1:d0-.26),zb=ap(10.7)+d1-.14;q.quad([-.26,front?7.6:3.1,za+.06],[.26,front?7.6:3.1,za+.06],[.26,10.7,zb+.06],[-.26,10.7,zb+.06],M.cyan,[0,6,0]);
   if(front){q.bev(0,2.6,ap(2.6)+1.25,3.9,4.5,1.4,M.hull,{ch:.14});q.box(0,2.72,ap(2.6)+1.97,2.4,3.5,.06,glow(0x22e6ff,.82));q.box(0,6.36,ap(2.6)+1.98,3,.14,.08,M.ice);
    if(hi){q.box(0,2.72,ap(2.6)+2,.1,3.5,.06,M.dark);for(const s of [-1,1]){q.box(s*1.42,2.72,ap(2.6)+1.98,.18,3.6,.1,M.gold);hazard(q,s*1.72,2.7,ap(2.6)+1.97,.36,1.1,3);}}
    else{qb(q,0,2.72,ap(2.6)+2,.14,3.5,.04,M.glassDark,'kblrt');for(const s of [-1,1])qb(q,s*1.42,2.72,ap(2.6)+1.98,.22,3.6,.06,M.gold,'kb');}}
   else if(hi){q.bev(0,2.6,ap(2.6)+d0-.1,2,.9,.5,M.hull,{ch:.08});q.box(0,3.5,ap(3.5)+d0-.2,1.1,.3,.2,M.gold);}});
  // tanks on the deck between the buttresses, a plate panel on each face flank
  if(!hi&&k%2===0){const av=a+Math.PI/8;b.cyl(Math.cos(av)*11.35,2.62,Math.sin(av)*11.35,.82,2.5,M.plate,{n:6,topMat:M.plate2});}
  if(hi){const av=a+Math.PI/8;canister(b,Math.cos(av)*11.35,2.62,Math.sin(av)*11.35,.78,2.7,k%2?M.plate2:M.plate);
   for(const s of [-1,1])rad(b,a,0,0,q=>q.at(s*2.35,0,ap(4.6)+.02,0,p=>p.bev(0,3.5,0,2,3.6,.16,M.plate2,{ch:.07}),-.19));}}
 if(hi)b.detail(()=>{const pts=[];for(let k=0;k<=8;k++){const a=k*Math.PI/4+Math.PI/8;pts.push([Math.cos(a)*12.35,2.6,Math.sin(a)*12.35]);}b.rail(pts,1.1,M.bare,{step:2.4,r:.06});});
 // the shaft: gunmetal with a pale plate band under every collar
 const band=(ya,yb,m)=>b.loft([R(rAt(ya),ya),R(rAt(yb),yb)],m,{smooth:true,top:false});let ya=y0;
 for(let yc=y0+8;yc<H-4;yc+=15){band(ya,yc-4.4,M.hull);band(yc-4.4,yc,M.plate);const r=rAt(yc);
  if(hi)b.loft([R(r+.02,yc),R(r+.34,yc+.14),R(r+.34,yc+.6),R(r+.02,yc+.74)],M.hull2,{smooth:true,top:false});else b.loft([R(r+.3,yc),R(r+.3,yc+.74)],M.hull2,{smooth:true,top:false});ya=yc+.74;}
 band(ya,H-.8,M.hull);
 // four ring gantries on struts
 for(const f of [.3,.48,.66,.84]){const y=H*f,r=rAt(y),Rg=r+2.7,ns=hi?8:4;hoop(b,y-.5,r+1.4,Rg+.3,.3,n,M.hull2,{noIn:!hi});
  if(hi)b.ring(0,y,0,Rg,M.cyan,{t:.62});else hoop(b,y-.2,Rg-.35,Rg+.35,.42,n,M.cyan,{noBot:true});
  for(let k=0;k<ns;k++){const a=k*TAU/ns+Math.PI/ns;rad(b,a,0,0,q=>{qb(q,0,y-.82,(r+Rg)/2-.1,.36,.36,Rg-r+.1,M.trim,'fkt');if(hi)q.tube([0,y-3.2,rAt(y-3.2)],[0,y-.8,Rg-.5],.14,M.trim,{n:4});});}
  if(hi)b.detail(()=>{const pts=[];for(let k=0;k<=n;k++){const a=k/n*TAU;pts.push([Math.cos(a)*(r+1.55),y-.2,Math.sin(a)*(r+1.55)]);}b.rail(pts,1,M.bare,{step:9,r:.05,mid:false});});}
 // four vertical light strips, two pipe runs, the lift rail with its cab, a service ladder
 for(let k=0;k<4;k++){const a=k*Math.PI/2;b.tube([Math.cos(a)*(rAt(y0+2)+.1),y0+2,Math.sin(a)*(rAt(y0+2)+.1)],[Math.cos(a)*(rAt(H-2.5)+.1),H-2.5,Math.sin(a)*(rAt(H-2.5)+.1)],hi?.2:.24,M.cyan,{n:4});}
 for(const [a,top,pr] of [[Math.PI*.25,.84,.34],[Math.PI*1.25,.66,.3]]){const c=Math.cos(a),s=Math.sin(a),yt=H*top-1,p=(r,y)=>[c*r,y,s*r];b.pipe([p(8.3,12.6),p(8.3,14.2),p(rAt(16)+pr+.12,16),p(rAt(yt)+pr+.12,yt)],pr,M.bare,{n:hi?6:4});
  if(hi){const c2=Math.cos(a+.13),s2=Math.sin(a+.13);b.tube([c2*(rAt(14)+.3),13.1,s2*(rAt(14)+.3)],[c2*(rAt(yt-9)+.3),yt-9,s2*(rAt(yt-9)+.3)],.18,M.gold,{n:5});}}
 {const a=Math.PI*.75,c=Math.cos(a),s=Math.sin(a),yl=H*.39;b.tube([c*(rAt(y0)+.2),y0,s*(rAt(y0)+.2)],[c*(rAt(H-3)+.2),H-3,s*(rAt(H-3)+.2)],.26,M.dark,{n:4});
  rad(b,a,rAt(yl)+1.05,yl,q=>{q.bev(0,0,0,2,2.9,1.5,M.plate,{ch:.12});q.box(0,1.3,.76,1.4,.9,.05,M.ice);if(hi){q.box(0,2.9,0,2.2,.16,1.7,M.gold);q.box(0,-.14,0,2.2,.14,1.7,M.hull2);}});}
 if(hi)b.detail(()=>{const a=Math.PI*1.75,c=Math.cos(a),s=Math.sin(a),tx=-s*.45,tz=c*.45,P=(y,k)=>[c*(rAt(y)+.34)+tx*k,y,s*(rAt(y)+.34)+tz*k];for(const k of [-1,1])b.tube(P(y0,k),P(H-1,k),.07,M.bare,{n:3});for(let y=y0+1;y<H-1;y+=2.4)b.tube(P(y,-1),P(y,1),.06,M.bare,{n:3});});
 // the cap: a flared collar, the lit control room, a stepped roof, the spire and its beacon
 b.loft([R(rAt(H-2.8),H-2.8),R(rt+2.1,H-.1),R(rt+2.1,H+.36)],M.hull2,{smooth:true,top:false});b.loft([R(rt+2.2,H+.36),R(rt+2.2,H+.66)],M.cyan,{smooth:true,top:false});b.loft([R(rt+2.14,H+.66),R(rt+2.14,H+.74),R(rt+.8,H+.77)],M.hull2,{top:false});
 b.loft([O(rt+1.06,H+.76),O(rt+.82,H+2.6)],M.plate,{top:false});b.loft([O(rt+1.03,H+1.3),O(rt+.93,H+2.05)],M.ice,{top:false});
 b.loft([O(rt+.82,H+2.6),O(rt+1.06,H+2.7),O(rt+1.06,H+2.95)],M.gold,{top:false});b.loft([O(rt+1,H+2.95),O(3.7,H+5),O(2.5,H+5.03)],M.hull,{top:false});
 for(let k=0;k<4;k++){const a=k*Math.PI/2,x=Math.cos(a)*4.45,z=Math.sin(a)*4.45,nv=hi?8:6;b.cyl(x,H+3.7,z,.82,3.3,M.plate2,{n:nv,r2:.7,topMat:M.dark});if(hi){b.cyl(x,H+6.5,z,.78,.3,M.hull2,{n:nv,top:false});hoop(b,H+7,.4,.6,.04,8,M.ice,{x,z,noBot:true,noIn:true});}else qb(b,x,H+7,z,.7,.03,.7,M.ice,'b');}
 if(hi){for(let k=0;k<8;k++){const a=k*Math.PI/4+Math.PI/8;rad(b,a,rt+.98,H+.78,q=>q.box(0,0,0,.34,1.9,.3,M.hull2));}
  for(let k=0;k<8;k++){const a=k*Math.PI/4;rad(b,a,0,0,q=>q.tube([0,H-3.4,rAt(H-3.4)],[0,H-.2,rt+1.9],.16,M.trim,{n:4}));}
  b.detail(()=>{const pts=[];for(let k=0;k<=n;k++){const a=k/n*TAU;pts.push([Math.cos(a)*(rt+2.05),H+.74,Math.sin(a)*(rt+2.05)]);}b.rail(pts,1,M.bare,{step:9,r:.05,mid:false});});}
 b.loft([ngon(b,6,2.4,H+5),ngon(b,6,1.5,H+9)],M.plate2,{top:false});b.loft([ngon(b,6,1.66,H+9),ngon(b,6,1.66,H+9.4)],M.gold,{top:false});b.loft([ngon(b,6,1.5,H+9.4),ngon(b,6,.2,H+16)],M.plate,{top:true});
 b.box(0,H+15.95,0,.5,.5,.5,M.red);b.halo(0,H+16.2,0,3.2,0xff3048,1.2);
 if(hi)for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4,x=Math.cos(a)*3.1,z=Math.sin(a)*3.1;b.tube([x,H+4.6,z],[x,H+9.6,z],.09,M.trim,{n:4});b.gem(x,H+9.8,z,.2,.3,.2,M.white);}
},{aoH:9,aoMin:.55});

// ------------------------------------------------------------------ refuge-pipe -----------------------------------------
// The overhead pipe bridge between two processor towers. o.w = length along x, centred on the origin, the pipe axis at y = 0.
WK.model('refuge-pipe',(b,o)=>{const {pal,circ}=b.k,M=pal.mil,hi=b.hi,L=o.w||6,n=hi?8:6,c=(r,x)=>({p:circ(r,n),y:x});
 alongX(b,0,0,0,q=>{q.loft([c(1.1,-L/2),c(1.1,L/2)],M.plate2,{smooth:true,top:false});
  if(hi)for(const t of [.25,.5,.75]){const x=-L/2+L*t;q.loft([c(1.1,x-.32),c(1.4,x-.26),c(1.4,x-.1)],M.hull2,{smooth:true,top:false});q.loft([c(1.33,x-.1),c(1.33,x+.1)],M.cyan,{smooth:true,top:false});q.loft([c(1.4,x+.1),c(1.4,x+.26),c(1.1,x+.32)],M.hull2,{smooth:true,top:false});}
  // LOW: still a round six-sided pipe, with two dark collars and a slim cyan band in each
  else for(const t of [1/3,2/3]){const x=-L/2+L*t;q.loft([c(1.1,x-.36),c(1.38,x-.28),c(1.38,x-.08),c(1.38,x+.08),c(1.38,x+.28),c(1.1,x+.36)],r=>r===2?M.cyan:M.hull2,{smooth:true,top:false});}
  if(hi)for(const s of [-1,1])q.loft([c(1.1,s*(L/2-.34)),c(1.3,s*(L/2-.26)),c(1.3,s*L/2)],M.hull,{smooth:true,top:false});});
 b.tube([-L/2,1.27,.28],[L/2,1.27,.28],.2,M.bare,{n:hi?5:4});
 if(hi)for(const t of [.25,.5,.75]){const x=-L/2+L*t;qb(b,x,1.02,.28,.2,.5,.56,M.hull2,'b');}
},{aoH:.01,aoMin:.9});

// ------------------------------------------------------------------ refuge-terminal -------------------------------------
// The supply terminal the player drives up to: a slim armoured console with a slanted lit screen facing +z under a canopy and
// antenna crown, six lit bollards on a ring of radius 5.8 (at x = sin a, z = cos a for a = 30 + 60 k degrees, as the game's
// decals), and supply crates and canisters stacked tidily beside the console. Holograms and ground decals: the game.
WK.model('refuge-terminal',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi;
 b.bev(0,-1.2,0,2.5,1.4,2.1,M.conc,{ch:.12});b.bev(0,.2,0,1.9,.22,1.5,M.hull2,{ch:.06});
 b.loft([rc(b,1.15,.92,.42,hi?.12:0),rc(b,1.05,.85,1.5,hi?.12:0),rc(b,1.05,.85,2.98,hi?.12:0)],(r)=>r?M.plate:M.hull,{top:true});
 for(const s of [-1,1]){b.bev(s*.62,.42,0,.2,2.56,.98,M.hull2,{ch:.05});qb(b,s*.62,.6,.5,.09,2.3,.04,M.cyan,'kb');}
 // the keypad shelf, the slanted screen, the canopy with its downlight
 b.at(0,1.32,.42,0,q=>{q.bev(0,0,.2,1.05,.16,.5,M.hull2,{ch:.04});if(hi){qb(q,-.2,.16,.2,.5,.03,.3,M.dark,'b');for(let k=0;k<3;k++)qb(q,-.38+k*.18,.19,.2,.1,.02,.1,M.ice,'bfkrl');qb(q,.32,.16,.2,.2,.04,.2,M.gold,'b');}},.22);
 b.at(0,2.25,.5,0,q=>{qb(q,0,-.5,0,1.02,1,.1,M.dark,'k');qb(q,0,-.42,.06,.9,.84,.03,glow(0xa8f8ff,.95),'k');if(hi)for(let k=0;k<3;k++)qb(q,-.2,.2-k*.2,.08,.36,.05,.02,M.cyan,'ktbrl');},-.3);
 b.bev(0,2.98,.14,1.7,.26,1.5,M.hull2,{ch:.07});qb(b,0,2.93,.74,1.3,.05,.16,M.white,'t');
 if(hi)qb(b,0,3.06,.9,1.72,.1,.04,M.gold,'k');
 // the antenna crown: a mast with a dish and two whips
 b.tube([-.3,3.24,-.35],[-.3,4.7,-.35],.06,M.trim,{n:4});b.gem(-.3,4.84,-.35,.11,.16,.11,M.white);
 if(hi){b.at(.3,3.38,-.32,.5,q=>{q.cyl(0,0,0,.07,.24,M.trim,{n:5});q.at(0,.3,0,0,r=>r.cyl(0,0,0,.08,.2,M.plate,{n:8,r2:.36}),.7);});b.tube([-.58,3.24,-.5],[-.66,4.1,-.56],.025,M.bare,{n:3});b.tube([.58,3.24,-.5],[.64,3.9,-.56],.025,M.bare,{n:3});}
 b.halo(0,2.3,.7,1.6,0xa8f8ff,hi?.45:.36);   // the lit screen is the terminal's focal point at every quality
 // six bollards with a cyan cap
 for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3,x=Math.sin(a)*5.8,z=Math.cos(a)*5.8;
  if(hi){b.cyl(x,-.5,z,.34,.64,M.hull2,{n:6});b.cyl(x,.14,z,.2,.96,M.hull,{n:6,top:false});b.cyl(x,1.1,z,.25,.17,M.cyan,{n:6});b.cyl(x,1.27,z,.2,.1,M.hull2,{n:6});b.halo(x,1.2,z,.8,0x22e6ff,.55);}
  else{qb(b,x,-.5,z,.34,1.6,.34,M.hull2,'tb');qb(b,x,1.1,z,.4,.2,.4,M.cyan,'b');}}
 // supplies, stacked tidily: crates on a pallet to the left, canisters in a rack to the right
 qb(b,-2.75,0,-.5,2.3,.12,1.3,M.hull2,'b');crates(b,-2.75,.12,-.5,.92,hi?3:2,M.cyan);
 qb(b,2.75,0,-.5,2.2,.12,1.1,M.hull2,'b');for(let k=0;k<3;k++)canister(b,2.05+k*.7,.12,-.5,.3,1.5,k===1?M.plate:M.plate2);
 if(hi){for(const s of [-1,1])b.tube([2.75+s*1.02,.12,-.5],[2.75+s*1.02,1.2,-.5],.05,M.trim,{n:4});b.tube([1.73,1.2,-.5],[3.77,1.2,-.5],.05,M.trim,{n:4});b.tube([1.73,.7,-.14],[3.77,.7,-.14],.035,M.gold,{n:3});}
});

// ------------------------------------------------------------------ refuge-solar ----------------------------------------
// A military solar array: a framed panel of 3 x 2 modules tilted o.tilt (radians) about the x axis around its centre at
// y = 2 (three.js sense, as the old array: a positive tilt lifts the -z edge), a cyan light on the -z edge, a dimmer one
// on the +z edge, a pale ceramic frame, four legs to the ground (o.sink below it), one stout brace a side, a torque tube and
// a junction box. LOW keeps the frame, the six modules in a lighter cell blue and the cyan edge.
WK.model('refuge-solar',(b,o)=>{const {pal,tint}=b.k,M=pal.mil,hi=b.hi,w=o.w||14,d=o.d||9,tilt=o.tilt??.3,sink=o.sink??.5,c=Math.cos(tilt),s=Math.sin(tilt),P=(lx,ly,lz)=>[lx,2+ly*c-lz*s,ly*s+lz*c];
 b.at(0,2,0,0,q=>{if(hi)q.bev(0,-.2,0,w+.3,.2,d+.3,M.plate2,{ch:.06,bot:true});else qb(q,0,-.2,0,w+.3,.2,d+.3,M.plate2);
  // LOW has no painted cell grid: six modules in a lighter cell blue with the pale frame showing between them
  const mw=(w-.1)/3,md=(d-.1)/2,cell=hi?b.k.mat(0x15264d,'solar',0):b.k.mat(0x1c3252,'solar',0);for(let i=0;i<3;i++)for(let j=0;j<2;j++){if(hi)qb(q,(i-1)*mw,0,(j-.5)*md,mw-.16,.09,md-.16,cell,'b');
   else{const x=(i-1)*mw,z=(j-.5)*md,hx=mw/2-.22,hz=md/2-.22;q.quad([x-hx,.03,z-hz],[x+hx,.03,z-hz],[x+hx,.03,z+hz],[x-hx,.03,z+hz],cell,[x,-9,z]);}}
  qb(q,0,.02,-d/2-.02,w-.3,.12,hi?.14:.2,M.cyan,'b');qb(q,0,.02,d/2+.02,w-.3,.09,hi?.1:.14,tint(M.cyan,.5),'b');
  if(hi){q.tube([-w/2+.3,-.42,0],[w/2-.3,-.42,0],.16,M.hull2,{n:6,caps:true});for(const sx of [-1,0,1])qb(q,sx*(w/2-.6),-.42,0,.14,.24,d-1,M.hull2,'t');}},tilt);
 for(const sx of [-1,1])for(const sz of [-1,1]){const t=P(sx*(w/2-.6),-.2,sz*(d/2-.6));b.cyl(t[0],-sink,t[2],.14,t[1]+sink,M.trim,{n:hi?6:4,top:false});if(hi)qb(b,t[0],-sink,t[2],.6,sink+.14,.6,M.conc,'b');}
 if(hi){for(const sx of [-1,1]){const a=P(sx*(w/2-.6),-.2,-(d/2-.6)),e=P(sx*(w/2-.6),-.2,d/2-.6),lo=a[1]<e[1]?a:e,up=a[1]<e[1]?e:a;b.tube([lo[0],.2,lo[2]],[up[0],up[1]-.1,up[2]],.1,M.trim,{n:4});}
  const hz=P(0,-.2,(tilt>=0?-1:1)*(d/2-.6)),zb=hz[2];b.tube([-(w/2-.6),.25,zb],[w/2-.6,hz[1]-.15,zb],.1,M.trim,{n:4});
  gearBox(b,w/2-1.5,0,zb,.9,1.1,.5,M.cyan);b.tube([w/2-1.5,1.1,zb],[w/2-1.5,hz[1]-.4,zb],.05,M.dark,{n:3});}
 else qb(b,w/2-1.5,0,P(0,0,(tilt>=0?-1:1)*(d/2-.6))[2],.9,1.1,.5,M.hull2,'b');
});

// ------------------------------------------------------------------ refuge-lamp -----------------------------------------
// A 7.2 m light pylon: base block, slim mast with a cyan slit down its +z side, an arm reaching to z = +0.75, a white lamp
// (a lit lens block under the arm's spine: it shows from the side and from above, on LOW too).
WK.model('refuge-lamp',(b,o)=>{const M=b.k.pal.mil,hi=b.hi;
 if(hi)b.loft([rc(b,.8,.8,-.3,.14),rc(b,.8,.8,.32,.14),rc(b,.46,.46,.52,.1)],M.hull2);else qb(b,0,-.3,0,.8,.8,.8,M.hull2,'b');
 b.cyl(0,.5,0,.15,6.5,M.trim,{n:hi?6:4,r2:.1,top:false});b.quad([-.04,.9,.16],[.04,.9,.16],[.04,6.4,.12],[-.04,6.4,.12],M.cyan,[0,3,0]);
 qb(b,0,6.94,.34,.22,.17,1,M.hull2);qb(b,0,6.78,.7,.74,.16,.5,M.white,'');
 if(hi){b.quad([-.2,.9,.04],[-.2,.9,-.04],[-.14,6.4,-.04],[-.14,6.4,.04],M.cyan,[0,3,0]);b.quad([.2,.9,.04],[.2,.9,-.04],[.14,6.4,-.04],[.14,6.4,.04],M.cyan,[0,3,0]);
  b.cyl(0,6.2,0,.19,.26,M.gold,{n:6});b.tube([0,6.3,.08],[0,6.94,.6],.045,M.trim,{n:3});b.tube([0,7.1,-.06],[0,7.38,-.06],.03,M.bare,{n:3});qb(b,0,6.94,.7,.5,.05,.3,M.hull2,'b');}
 b.halo(0,6.76,.7,1.6,0xa8f8ff,.3);
});

// ------------------------------------------------------------------ relay-mast ------------------------------------------
// A field relay (instanced across the Moon): footing with four pale ceramic fins, a stout tapering mast (gunmetal below, a
// pale ceramic sleeve above the lower crossbar), two crossbars with insulators, a dish, a panel, a cyan slit on the +z side
// and a white top light at y 9.3.
WK.model('relay-mast',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,n=hi?6:4,rM=y=>.23-.11*(y-.5)/8.62;
 if(hi)b.loft([rc(b,.9,.9,-.4,.16),rc(b,.9,.9,.34,.16),rc(b,.56,.56,.5,.1)],M.hull2);else qb(b,0,-.4,0,.9,.9,.9,M.hull2,'b');
 b.cyl(0,.5,0,rM(.5),2.7,M.hull,{n,r2:rM(3.2),top:false});b.cyl(0,3.2,0,rM(3.2)+.03,3,M.plate,{n,r2:rM(6.2)+.03,top:false});b.cyl(0,6.2,0,rM(6.2),2.92,hi?M.trim:M.plate,{n,r2:rM(9.12),top:false});
 for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>{if(hi)q.loft([rc(q,.16,.4,.3,0,0,.5),rc(q,.12,.1,2.3,0,0,rM(2.3)+.03)],M.plate,{top:false});else for(const e of [-1,1])q.tri([0,.3,.2],[0,.3,.74],[0,2.3,rM(2.3)],M.plate,[e,1,.4]);});
 for(const y of [3,6]){b.tube([-.7,y,0],[.7,y,0],.075,M.hull2,{n:hi?4:3,caps:hi});if(hi){b.cyl(0,y-.14,0,rM(y)+.09,.28,M.hull2,{n:6,top:false});for(const s of [-1,1])b.gem(s*.68,y+.17,0,.1,.18,.1,M.bare);}}
 b.at(.18,8,0,0,q=>{q.cyl(0,0,0,.1,.3,M.plate,{n:hi?8:6,r2:.52});if(hi)q.tube([0,.3,0],[0,.62,0],.03,M.bare,{n:3});},0,-1.05);
 b.at(-.2,4.5,0,0,q=>qb(q,-.4,0,0,.72,.05,.56,M.navy,hi?'':'lrfk'),0,.55);
 b.quad([-.04,1,rM(1)+.02],[.04,1,rM(1)+.02],[.04,8.4,rM(8.4)+.02],[-.04,8.4,rM(8.4)+.02],M.cyan,[0,5,0]);if(hi)b.quad([-.04,1,-rM(1)-.02],[.04,1,-rM(1)-.02],[.04,8.4,-rM(8.4)-.02],[-.04,8.4,-rM(8.4)-.02],M.cyan,[0,5,0]);
 b.gem(0,9.3,0,.2,.26,.2,M.white);
 if(hi)b.cyl(0,9.0,0,.16,.14,M.gold,{n:6,top:false});
});

// ------------------------------------------------------------------ viaduct-segment -------------------------------------
// 4 m of the viaduct below and beside the drive surface (y = 0, drawn by the game between the curbs), ONE structure: a deep
// I-girder under each curb (the curb at z = +-9, 0.7 wide and 0.9 high, is its pale ceramic top flange with a cyan pad on
// top; a dark recessed web with stiffener ribs; a pale bottom flange 1.4 below the deck), a cross-girder and plan braces
// joining the two girders under the deck, a sub-deck plate just under the drive surface, a lane stud (o.stud = 0 leaves it
// out). No end faces: segments chain. 60 in a row, so every triangle counts (at most 120 HIGH / 36 LOW).
WK.model('viaduct-segment',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,L=o.w||4,D=o.d>18.2&&o.d<18.5?18.2:(o.d||18.2),x0=-L/2,x1=L/2,zc=D/2-.1,zg=zc-.5,lite=b.k.tint(M.plate,1.2,.02),
  P=(xa,xb,y0,z0,y1,z1,m,ins)=>b.quad([xa,y0,z0],[xb,y0,z0],[xb,y1,z1],[xa,y1,z1],m,ins),Q=(y0,z0,y1,z1,m,ins)=>P(x0,x1,y0,z0,y1,z1,m,ins);
 for(const s of [-1,1]){const zo=s*(zc+.35),zi=s*(zc-.35),zw=s*(zc+.04),zb=s*(zc+.3),c=[0,-.4,s*(zc-.1)];
  // the curb = the girder's top flange (pale fascia and top, a cyan pad), the web, the pale bottom flange
  if(hi){Q(-.18,zo,.76,zo,M.plate,c);Q(.76,zo,.9,zo-s*.14,lite,c);Q(.9,zi,.9,zo-s*.14,M.plate,c);}else{Q(-.18,zo,.9,zo,M.plate,c);Q(.9,zi,.9,zo,M.plate,c);}
  Q(0,zi,.9,zi,M.trim,c);P(-L*.2,L*.2,.91,s*(zc-.2),.91,s*(zc+.08),M.cyan,[0,0,s*zc]);Q(-1.14,zw,-.18,zw,M.hull,c);Q(-1.14,zw,-1.14,zb,M.plate2,[0,-2,s*zc]);Q(-1.4,zb,-1.14,zb,M.plate2,c);
  if(hi){Q(-.18,zw,-.18,zo,M.hull2,[0,.5,s*zc]);Q(-1.4,s*zg,-.5,s*zg,M.hull2,c);Q(-1.4,s*zg,-1.4,zb,M.dark,[0,0,s*zc]);
   for(const x of [-L/4,L/4]){const zr=s*(zc+.27);P(x-.14,x+.14,-1.14,zr,-.18,zr,M.plate2,c);for(const e of [-1,1])b.quad([x+e*.14,-1.14,zw],[x+e*.14,-1.14,zr],[x+e*.14,-.18,zr],[x+e*.14,-.18,zw],M.hull,[x,-.7,s*zc]);}
   b.quad([-.3,.36,zi-s*.02],[.3,.36,zi-s*.02],[.3,.52,zi-s*.02],[-.3,.52,zi-s*.02],M.ice,[0,.4,s*zc]);}}
 // under the deck: the sub-deck plate (hidden by the drive surface in the game), the soffit, a cross-girder with a pale
 // bottom flange at mid-span and two plan braces: the two girders are visibly one frame
 Q(-.1,-zc+.35,-.1,zc-.35,M.hull,[0,-5,0]);
 if(hi){Q(-.5,-zg,-.5,zg,M.dark,[0,0,0]);for(const e of [-1,1])b.quad([e*.24,-1.3,-zg],[e*.24,-1.3,zg],[e*.24,-.5,zg],[e*.24,-.5,-zg],M.hull2,[0,-.9,0]);
  b.quad([-.32,-1.3,-zg],[.32,-1.3,-zg],[.32,-1.3,zg],[-.32,-1.3,zg],M.plate2,[0,0,0]);
  for(const e of [-1,1])b.quad([x0,-.9,-e*zg],[x0+.5,-.9,-e*zg],[x1,-.9,e*zg],[x1-.5,-.9,e*zg],M.trim,[0,0,0]);}
 else Q(-1.4,-zc-.3,-1.4,zc+.3,M.hull,[0,0,0]);   // LOW: a gunmetal soffit (a near-black one was a black band across the screen from below)
 if(o.stud!==0)b.quad([-1.2,.04,-.12],[1.2,.04,-.12],[1.2,.04,.12],[-1.2,.04,.12],M.ice,[0,-1,0]);
},{aoH:.01,aoMin:.86});

// ------------------------------------------------------------------ viaduct-pier ----------------------------------------
// A hex armoured column: footing with six pale ceramic buttress fins, a shaft tapering 8% in three lifts (gunmetal, pale
// ceramic with dark ribs, gunmetal with pale plates on alternate faces) between two collars at 0.35 and 0.7 of the height
// (cyan pads on alternate faces), and a pale hammerhead bracket (long axis z, across the deck) under the deck.
// o.h = height from the ground to the deck underside; o.sink = footing depth below y = 0.
WK.model('viaduct-pier',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,h=o.h||24,sink=o.sink??1,hh=h-1.7,rA=y=>1.65-.13*Math.max(0,y-.5)/(hh-.5),X=(r,y)=>ngon(b,6,r,y),head=(hx,hz,y)=>({p:[[hx,0],[hx,hz],[-hx,hz],[-hx,0],[-hx,-hz],[hx,-hz]],y}),pad=(q,i)=>i%2?M.cyan:M.hull2;
 if(hi)b.loft([X(1.8,-sink),X(1.8,.36),X(1.68,.5)],M.hull2,{top:false});else b.loft([X(1.8,-sink),X(1.8,.5)],M.hull2,{top:false});
 let ya=.5,lift=0;for(const f of [.35,.7]){const yc=h*f,r=rA(yc);b.loft([X(rA(ya),ya),X(rA(yc-.5),yc-.5)],lift?M.plate:M.hull,{top:false});
  if(hi){b.loft([X(r,yc-.5),X(r+.17,yc-.4),X(r+.17,yc-.14)],M.hull2,{top:false});b.loft([X(r+.21,yc-.14),X(r+.21,yc+.14)],pad,{top:false});b.loft([X(r+.17,yc+.14),X(r+.17,yc+.4),X(r,yc+.5)],M.hull2,{top:false});
   if(lift)for(let k=0;k<3;k++)rad(b,k*TAU/3+Math.PI/6,0,0,q=>qb(q,0,ya+.5,rA(ya)*.866+.02,.4,yc-ya-1.5,.2,M.hull2,'b'));}
  else b.loft([X(r+.16,yc-.5),X(r+.16,yc-.14)],M.hull2,{top:false}).loft([X(r+.2,yc-.14),X(r+.2,yc+.14)],pad,{top:false}).loft([X(r+.16,yc+.14),X(r+.16,yc+.5)],M.hull2,{top:false});ya=yc+.5;lift++;}
 b.loft([X(rA(ya),ya),X(rA(hh),hh)],(q,i)=>i%2===0?M.plate2:M.hull,{top:false});
 b.loft([X(rA(hh),hh),head(1.25,1.74,h-.42),head(1.25,1.74,h-.3)],M.hull2,{top:false});b.loft([head(1.36,1.8,h-.3),head(1.36,1.8,h)],M.plate,{top:true,topMat:M.trim});
 for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6;rad(b,a,0,0,q=>q.loft([rc(q,.56,.84,.3,0,0,1.78),rc(q,.4,.12,h*.2,0,0,rA(h*.2)*.87+.03)],M.plate2,{top:false}));}
 if(hi){for(const s of [-1,1]){b.tube([0,hh-2.2,s*rA(hh-2.2)*.86],[0,h-.36,s*1.6],.13,M.trim,{n:4});qb(b,0,h-.24,s*1.81,.9,.16,.04,M.white,s>0?'k':'f');}
  b.loft([X(rA(hh-.5)+.08,hh-.5),X(rA(hh)+.08,hh-.14)],M.gold,{top:false});}
});

// ------------------------------------------------------------------ viaduct-lamp ----------------------------------------
// The deck-edge light post: the post stands at the origin, the lamp reaches toward +z, 4.1 m. The lamp is a lit lens block
// under a small dark hood (it shows from the side and, around the hood, from above), on LOW too.
WK.model('viaduct-lamp',(b,o)=>{const M=b.k.pal.mil,hi=b.hi;
 if(hi)qb(b,0,0,0,.36,.32,.36,M.hull2,'b');b.loft([rc(b,.18,.18,hi?.32:0),rc(b,.13,.13,3.96)],M.trim,{top:false});
 b.tube([0,3.9,-.04],[0,4.06,.5],.07,M.hull2,{n:hi?4:3});qb(b,0,3.9,.56,.5,.14,.4,M.white,'');qb(b,0,4.04,.54,.3,.08,.22,M.hull2,'b');
 if(hi){b.quad([-.03,.5,.1],[.03,.5,.1],[.03,3.6,.08],[-.03,3.6,.08],M.cyan,[0,2,0]);b.tube([0,3.3,.06],[0,3.92,.34],.035,M.trim,{n:3});b.gem(0,4.14,-.04,.07,.1,.07,M.gold);}
 b.halo(0,3.9,.56,1.3,0xa8f8ff,.3);
});

// ------------------------------------------------------------------ viaduct-gantry --------------------------------------
// The sign gantry frame: posts at z = +-2.6, a beam with a cyan line under it at y 4.25. The game's holographic sign
// hangs between the posts at y 3.6 (kept clear: |z| < 2.25, y 3.0 to 4.18).
WK.model('viaduct-gantry',(b,o)=>{const M=b.k.pal.mil,hi=b.hi;
 for(const s of [-1,1]){const z=s*2.6;if(hi){qb(b,0,0,z,.5,.36,.5,M.hull2,'b');b.loft([rc(b,.28,.28,.36,.06,0,z),rc(b,.22,.22,4.3,.05,0,z)],M.trim,{top:false});qb(b,0,4.46,z,.34,.08,.4,M.gold,'b');b.gem(0,4.56,z,.07,.06,.07,M.amber);
   b.tube([0,3.72,z-s*.1],[0,4.26,z-s*.42],.05,M.trim,{n:3});for(const sx of [-1,1])b.quad([sx*.15,.6,z-.035],[sx*.15,.6,z+.035],[sx*.13,3.9,z+.035],[sx*.13,3.9,z-.035],M.cyan,[0,2,z]);}
  else qb(b,0,0,z,.24,4.3,.24,M.trim,'tb');}
 qb(b,0,4.3,0,.24,.17,5.6,M.hull2);qb(b,0,4.2,0,.12,.1,hi?4.5:5,M.cyan,'t');
 if(hi)for(let k=-2;k<=2;k++)qb(b,0,4.27,k*1.05,.3,.22,.1,M.trim,'b');
});

// ================================================================== Command Base I-V ====================================
// Every base part: origin = the part's own centre on the ground (y = 0 = the base's ground height), its FRONT faces +z.
// The old base-local frame has its front (the Command Gate) at -z, so every part is placed with a half turn (ry = pi).

// ------------------------------------------------------------------ base-pad --------------------------------------------
// The armoured pad (o.w x o.d, deck at y = 0.3, body down to -o.sink): a bevelled rim, edge light strips (the front one
// brightest), the centre hex dais with its lit hex ring (dim before the base is built: o.tier = 0), the paint field
// (o.paint = hex colour, 10 x 8) and flat deck markings. Nothing stands higher than 0.46: it is driven on.
WK.model('base-pad',(b,o)=>{const {pal,mat,glow,tint}=b.k,M=pal.mil,hi=b.hi,w=o.w||38,d=o.d||34,tier=o.tier|0,sink=o.sink??2.1,T=.3,ch=hi?1.4:0,paint=mat(o.paint||0x2c3a49,'paint',.3,0),dim=tint(M.cyan,.6),
  flat=(x0,z0,x1,z1,m,y=T+.012)=>b.quad([x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1],m,[0,-9,0]);
 b.loft([rc(b,w,d,-sink,ch),rc(b,w,d,.02,ch)],M.conc,{top:false});b.loft([rc(b,w,d,.02,ch),rc(b,w-1.6,d-1.6,T,ch)],M.hull,{top:true,topMat:M.hull2});
 qb(b,0,T,d/2-1.2,w-7,.05,.14,M.cyan,'b');qb(b,0,T,-d/2+1.2,w-7,.05,.14,dim,'b');for(const s of [-1,1])qb(b,s*(w/2-1.2),T,0,.14,.05,d-7,dim,'b');
 flat(-5,-4,5,4,paint);
 b.loft([ngon(b,6,4.2,T),ngon(b,6,4.2,T+.09),ngon(b,6,4,T+.13)],M.hull,{top:true,topMat:M.hull2});hoop(b,T+.13,3.2,3.48,.03,6,glow(0x22e6ff,tier?.9:.4),{noBot:true});b.cyl(0,T+.13,0,.7,.05,M.gold,{n:6});
 if(hi){for(const [x0,z0,x1,z1] of [[-5,-4,5,-3.84],[-5,3.84,5,4],[-5,-4,-4.84,4],[4.84,-4,5,4]])flat(x0,z0,x1,z1,M.plate2,T+.02);
  for(let k=0;k<12;k+=2){const a0=k/12*TAU+.13,a1=(k+1)/12*TAU+.13;b.quad([Math.cos(a0)*7,T+.012,Math.sin(a0)*7],[Math.cos(a0)*7.3,T+.012,Math.sin(a0)*7.3],[Math.cos(a1)*7.3,T+.012,Math.sin(a1)*7.3],[Math.cos(a1)*7,T+.012,Math.sin(a1)*7],M.plate2,[0,-9,0]);}
  for(const sx of [-1,1])for(const sz of [-1,1]){const cx=sx*(w/2-4.2),cz=sz*(d/2-4.2);for(let k=0;k<5;k++)flat(cx-1.5+k*.6,cz-1.5,cx-.9+k*.6,cz+1.5,k%2?M.hazardD:M.hazard);}
  for(const [x0,z0,x1,z1] of [[-w/2+2.6,-d/2+2.6,w/2-2.6,-d/2+2.76],[-w/2+2.6,d/2-2.76,w/2-2.6,d/2-2.6],[-w/2+2.6,-d/2+2.6,-w/2+2.76,d/2-2.6],[w/2-2.76,-d/2+2.6,w/2-2.6,d/2-2.6]])flat(x0,z0,x1,z1,M.trim);
  for(const sx of [-1,1])for(const sz of [-1,1])for(let i=0;i<2;i++)for(let j=0;j<2;j++){if(i+j===0)continue;const cx=sx*(8.4+i*4.1),cz=sz*(7+j*3.7);b.quad([cx-1.8,T+.012,cz-1.6],[cx+1.8,T+.012,cz-1.6],[cx+1.8,T+.012,cz+1.6],[cx-1.8,T+.012,cz+1.6],(i+j)%2?M.hull:M.trim,[0,-9,0]);}
  for(const sx of [-1,1])for(let k=0;k<5;k++){const z=6.2+k*(d/2-8.4)/4;flat(sx*5.2-.16,z-.3,sx*5.2+.16,z+.3,M.ice,T+.015);}
  for(let k=0;k<6;k++){const a=k*Math.PI/3;rad(b,a,3.72,T+.13,q=>qb(q,0,0,0,.5,.04,.2,M.gold,'b'));}}
 // LOW: the markings that tell a pad from a slab stay as flat quads: the hex outline round the dais and the hazard corners
 if(!hi){for(let k=0;k<6;k++){const a0=k/6*TAU,a1=(k+1)/6*TAU;b.quad([Math.cos(a0)*6.9,T+.012,Math.sin(a0)*6.9],[Math.cos(a0)*7.35,T+.012,Math.sin(a0)*7.35],[Math.cos(a1)*7.35,T+.012,Math.sin(a1)*7.35],[Math.cos(a1)*6.9,T+.012,Math.sin(a1)*6.9],M.plate2,[0,-9,0]);}
  for(const sx of [-1,1])for(const sz of [-1,1]){const cx=sx*(w/2-4.2),cz=sz*(d/2-4.2);for(let k=0;k<3;k++)flat(cx-1.5+k,cz-1.5,cx-.5+k,cz+1.5,k%2?M.hazardD:M.hazard);}}
},{aoH:.01,aoMin:.88});

// ------------------------------------------------------------------ base-wall -------------------------------------------
// The perimeter barrier: a berm, a battered gunmetal wall, a shadowed recess, a pale ceramic shoulder band and a dark slot
// under the cap on both faces; on top a walkway of pale cap plates between ceramic parapets, one cyan pad a bay on the
// cap's edge; a dark buttress rib every ~4 m and a gold-crowned post at both ends. o.d = run length along z; 6 thick;
// 5 high; symmetric.
WK.model('base-wall',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,L=o.d||35,sink=o.sink??1,R=(w,y)=>rc(b,w,L,y),n=Math.max(1,Math.floor(L/4)),bay=L/n,len=bay-1.1;
 if(hi)b.loft([R(6,-sink),R(6,.25),R(5.2,1.2)],M.conc,{top:false});else b.loft([R(6,-sink),R(5.4,1.2)],M.conc,{top:false});
 b.loft([R(4.5,1.2),R(4.4,2.3),R(4.16,2.36),R(4.16,2.6),R(4.46,2.68),R(4.3,3.92),R(4.14,3.97),R(4.14,4.17),R(4.8,4.38),R(4.8,4.62)],r=>[M.hull,M.dark,M.dark,M.plate2,M.plate,M.dark,M.dark,M.hull2,M.hull2][r],{top:true,topMat:M.hull});
 for(const s of [-1,1])qb(b,s*2.2,4.62,0,.4,.22,L,f=>f==='t'?M.plate:M.plate2,'b');
 // every bay: a pale cap plate on the walkway, a cyan pad on the cap's edge, bevelled armour panels on both faces
 for(let i=0;i<n;i++){const t=-L/2+(i+.5)*bay;
  if(hi){qb(b,0,4.62,t,3.1,.06,len,M.plate,'b');qb(b,0,4.68,t,.3,.02,.8,M.ice,'b');}else b.quad([-1.55,4.66,t-len/2],[1.55,4.66,t-len/2],[1.55,4.66,t+len/2],[-1.55,4.66,t+len/2],M.plate,[0,0,t]);
  for(const s of [-1,1]){b.quad([s*2.42,4.43,t-.55],[s*2.42,4.43,t+.55],[s*2.42,4.57,t+.55],[s*2.42,4.57,t-.55],M.cyan,[0,4.5,t]);
   if(hi){b.at(s*2.2,2.76,t,s*Math.PI/2,q=>{q.bev(0,0,0,len-.3,1.1,.12,M.plate,{ch:.05});qb(q,0,.42,.07,1.5,.24,.03,M.dark,'kb');},-.065);
    qb(b,s*2.24,1.42,t,.08,.72,len-.3,M.plate2,s>0?'l':'r');qb(b,s*2.3,1.62,t,.04,.3,1.3,M.dark,s>0?'l':'r');}}}
 // a buttress rib between bays; a taller post with a gold crown band and a pale cap closes each end
 for(let i=1;i<n;i++){const t=-L/2+i*bay;
  if(hi){b.loft([rc(b,5.7,.7,.7,.1,0,t),rc(b,4.96,.56,4.3,.1,0,t)],M.hull2,{top:false});for(const s of [-1,1])qb(b,s*2.2,4.62,t,.5,.4,1.1,M.hull2,'b');}
  else qb(b,0,.7,t,5.3,3.6,.6,M.hull2,'b');}
 for(const e of [-1,1]){const t=e*(L/2-.47);b.bev(0,.6,t,5.3,4.3,1,M.hull2,{ch:.12});b.loft([rc(b,5.14,1,4.9,0,0,t),rc(b,5.14,1,5.04,0,0,t)],M.gold,{top:true,topMat:M.plate});
  for(const s of [-1,1])qb(b,s*2.66,2.7,t,.04,1.5,.66,M.plate,s>0?'l':'r');if(hi)qb(b,0,5.04,t,.6,.04,.4,M.white,'b');}
 // 5E-2d2 (reviewer note: the wall was the plainest military piece; HIGH only, LOW's triangles are unchanged): a service
 // conduit along the foot of both faces, clipped at every rib; an amber marker lamp in a dark housing on every other rib; a
 // louvred vent in place of the plain slot on every third bay; hazard chevrons on the end posts. Both faces alike (symmetric).
 if(hi){const amb=b.k.tint(M.amber,.8);
  for(const s of [-1,1]){b.detail(()=>{b.tube([s*2.74,1.34,-L/2+1.1],[s*2.74,1.34,L/2-1.1],.085,M.dark,{n:5});for(let i=1;i<n;i++)qb(b,s*2.76,1.22,-L/2+i*bay,.2,.26,.22,M.trim,'b');});
   for(let i=1;i<n;i+=2){const t=-L/2+i*bay;qb(b,s*2.62,3.36,t,.26,.4,.46,M.dark,s>0?'l':'r');b.quad([s*2.756,3.44,t-.15],[s*2.756,3.44,t+.15],[s*2.756,3.68,t+.15],[s*2.756,3.68,t-.15],amb,[0,3.5,t]);b.halo(s*2.9,3.56,t,.62,0xffb347,.5);}
   b.detail(()=>{for(let i=2;i<n;i+=3){const t=-L/2+(i+.5)*bay;for(let k=0;k<3;k++)qb(b,s*2.33,2.94+k*.24,t,.06,.1,1.7,M.dark,s>0?'l':'r');}
    for(const e of [-1,1]){const t=e*(L/2-.47);for(let k=0;k<4;k++)b.quad([s*2.672,.92,t-.3+k*.15],[s*2.672,.92,t-.15+k*.15],[s*2.672,1.5,t-.15+k*.15+.14],[s*2.672,1.5,t-.3+k*.15+.14],k%2?M.hazardD:M.hazard,[0,1.2,t]);}});}}
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ base-gate -------------------------------------------
// The Command Gate: two armoured towers (5 wide: x = +-12.6 to +-17.6, the full 12 tall, an amber lamp on each top)
// carrying the lintel (a beam 1.5 deep, y 9.7 to 11.2) with the raised sign block at its centre; tanks drive under it. The
// opening stays clear: nothing inside |x| < 12.5 below y 9.5. The sign block's dark front field (+z, at z = 1.33) is the
// game's: it draws the holographic text 2 cm in front of it. o.flank = 0 leaves out the two flank bastions (the wall stubs
// from the towers out to x = +-20.3 at z = -1.1, inside the side walls' solid).
WK.model('base-gate',(b,o)=>{const {pal,glow,tint}=b.k,M=pal.mil,hi=b.hi,sink=o.sink??1,flank=o.flank!==0,amb=tint(glow(0xffb347,1),.5),ch=hi?.24:0,   // amb: half strength, so the lamps stay amber (a full glow tone-maps to yellow-white)
  tw=(s,w,d,y)=>rc(b,w,d,y,ch,s*(12.6+w/2));   // a tower section: its inner face stays plumb on the drive lane's edge (x = 12.6)
 for(const s of [-1,1]){const cx=s*15.05;
  // the tower: a foot, the gunmetal shaft, a belt, the pale ceramic upper shaft, a gold band, the head, the crown, the lamp
  b.bev(s*15.15,-sink,0,5.2,sink+1.3,3.2,M.hull2,{ch:.16});
  b.loft([tw(s,5,3,1.3),tw(s,4.9,2.9,4.9)],M.hull,{top:false});b.loft([tw(s,5.04,3.04,4.9),tw(s,5.04,3.04,5.3)],M.hull2,{top:false});
  b.loft([tw(s,4.84,2.84,5.3),tw(s,4.7,2.66,9)],M.plate,{top:false});b.loft([tw(s,4.86,2.84,9),tw(s,4.86,2.84,9.26)],M.gold,{top:false});
  b.bev(s*15.1,9.26,0,5.2,2,3.1,M.hull2,{ch:.2});b.bev(s*15.2,11.26,0,4.2,.4,2.4,M.hull,{ch:.12});
  if(hi){b.cyl(s*15.2,11.66,0,.72,.1,M.dark,{n:8});b.cyl(s*15.2,11.76,0,.52,.24,amb,{n:8,topMat:amb});b.halo(s*15.2,12.05,0,2.4,0xffb347,.7);b.halo(s*15,10.2,1.9,1.2,0xffb347,.5);
   for(const t of [-1.5,1.5])qb(b,s*15.2+t,11.66,0,.18,.05,1.6,M.cyan,'b');}
  else qb(b,s*15.2,11.66,0,.95,.34,.95,amb,'b');
  qb(b,s*12.58,.5,0,.04,9,1.3,M.dark,'tb'+(s>0?'r':'l'));qb(b,s*12.55,.7,0,.04,8.6,.5,M.cyan,'tb'+(s>0?'r':'l'));
  // the front buttress foot with its hazard band and two cyan strips; the outer buttress fin when no bastion stands there
  b.loft([rc(b,3.4,1.6,-sink,hi?.14:0,cx,2.05),rc(b,3.2,1.3,2,hi?.14:0,cx,1.9),rc(b,2.6,.36,5.2,hi?.1:0,cx,1.6)],M.hull2);
  b.at(cx,.7,2.7,0,q=>hazard(q,0,0,0,2.8,1,hi?6:4),-.1);if(hi)b.at(cx,2.3,2.5,0,q=>{for(const t of [-.65,.65])qb(q,t,0,0,.2,2.3,.04,M.cyan,'kb');},-.236);
  if(!flank)b.loft([rc(b,.8,1.2,-sink,0,s*17.7),rc(b,.5,1,6.6,0,s*17.6),rc(b,.2,.6,8.4,0,s*17.42)],M.hull2);
  for(const f of [1,-1]){   // the front and back faces: corner pilasters, a ceramic panel with two light strips, the head's lamp bar
   if(hi){for(const t of [-1,1])b.loft([rc(b,.5,.2,1.3,0,s*15.1+t*1.95,f*1.52),rc(b,.46,.2,9.1,0,s*14.95+t*1.85,f*1.37)],M.hull2,{top:false});
    b.at(s*15,0,0,f>0?0:Math.PI,q=>{q.bev(0,5.65,1.37,2.7,2.9,.18,M.plate2,{ch:.07});for(const t of [-.7,.7])qb(q,t,6.15,1.47,.22,1.9,.04,M.ice,'kb');
     if(f<0){hazard(q,0,1.5,1.52,3,.9,6);qb(q,0,2.8,1.47,1.8,1.6,.08,M.dark,'kb');for(let k=0;k<4;k++)qb(q,0,2.95+k*.36,1.53,1.6,.07,.04,M.trim,'kb');}
     q.bev(f*s*.1,9.66,1.55,2.8,1.2,.2,M.hull,{ch:.07});qb(q,f*s*.1,10.02,1.66,1.7,.44,.05,f>0?amb:M.white,'kb');});}
   else{if(f<0)qb(b,s*15.05,1.5,-1.52,3,.9,.04,M.hazard,'tbf');qb(b,s*15.1,10.02,f*1.57,1.7,.44,.05,f>0?amb:M.white,'b'+(f>0?'k':'f'));}}
  // flank bastion: the wall stub from the tower's outer face to x = 20.3
  if(flank){const bx=s*18.7,bz=-1.1;b.loft([rc(b,3,1.6,-sink,0,bx,bz),rc(b,2.9,1.5,3.2,0,bx,bz)],M.hull,{top:false});b.loft([rc(b,2.9,1.5,3.2,0,bx,bz),rc(b,2.84,1.44,5.6,0,bx,bz)],M.plate,{top:false});b.loft([rc(b,3.04,1.64,5.6,0,bx,bz),rc(b,3.04,1.64,5.86,0,bx,bz)],M.hull2,{top:false});
   b.loft([rc(b,3.2,1.8,5.86,0,bx,bz),rc(b,3.2,1.8,6.1,0,bx,bz)],M.cyan,{top:false});b.loft([rc(b,3.1,1.7,6.1,0,bx,bz),rc(b,3.1,1.7,6.22,0,bx,bz)],M.hull2,{top:true});
   if(hi){for(const t of [-.75,.75])qb(b,bx+t,6.22,bz,1,.3,1.7,M.hull,'b');for(const f of [1,-1]){qb(b,bx+s*.2,4.1,bz+f*.74,1.9,.36,.04,M.dark,'tb'+(f>0?'k':'f'));qb(b,bx+s*.2,4.22,bz+f*.77,1.6,.1,.03,M.ice,'tb'+(f>0?'k':'f'));qb(b,bx+s*.2,1.2,bz+f*.78,2.1,1.5,.08,M.hull2,'b'+(f>0?'k':'f'));}
    b.at(bx+s*1.3,0,bz,0,q=>q.loft([rc(q,.6,2.2,-sink),rc(q,.5,1.9,5.5)],M.hull2,{top:false}));}}}
 // the lintel: an armoured beam 1.5 deep from the sign block into both towers, plate panels on its faces, floodlights and
 // the lit line underneath
 for(const s of [-1,1])b.bev(s*9.3,9.7,0,8,1.5,2.3,M.hull2,{ch:.2,bot:true});
 qb(b,0,9.6,-.8,25.1,.1,.14,M.cyan,'t');
 for(const f of [1,-1])for(const s of [-1,1]){if(hi)b.at(s*9.2,0,f*1.15,f>0?0:Math.PI,q=>{q.bev(0,9.98,0,6.4,.94,.14,M.plate,{ch:.06});for(let k=-1;k<=1;k++)qb(q,k*2.1,10.14,.15,.12,.62,.03,M.gold,'kb');});else qb(b,s*9.2,9.98,f*1.19,6.4,.94,.06,M.plate,'tb'+(f>0?'k':'f'));}
 if(hi){for(let k=-5;k<=5;k++){if(!k)continue;qb(b,k*2.3,9.56,.5,.9,.14,.5,M.hull,'t');qb(b,k*2.3,9.53,.5,.66,.03,.3,M.white,'t');}
  for(const s of [-1,1])for(let k=3;k<=6;k++)qb(b,s*k*2.05,11.2,0,.5,.2,2.05,M.hull,'b');
  b.detail(()=>{for(const f of [1,-1])for(const s of [-1,1])b.rail([[s*5.7,11.2,f*.98],[s*12.4,11.2,f*.98]],.7,M.bare,{step:2.2,r:.05});});}
 // the sign block: a plain raised block at the centre of the beam (dark fields front and back; the game draws the text on
 // the front one), gold edge lines, a pale stepped cap with the white light bar, twin masts
 b.bev(0,9.7,0,10.8,1.85,2.6,M.hull,{ch:.14,bot:true});b.bev(0,11.55,0,6.6,.26,2,M.plate,{ch:.08});qb(b,0,11.81,0,3.4,.08,.3,M.white,'b');
 for(const f of [1,-1]){qb(b,0,9.76,f*1.31,10.2,1.34,.04,M.dark,'tb'+(f>0?'k':'f'));qb(b,0,11.2,f*1.32,10.2,.12,.04,M.gold,'b'+(f>0?'k':'f'));}
 for(const s of [-1,1]){b.tube([s*4.6,11.55,0],[s*4.6,11.98,0],.06,M.trim,{n:4});if(hi)b.gem(s*4.6,11.9,0,.1,.1,.1,M.cyan);}
 if(hi)b.gem(0,11.42,1.36,.3,.14,.05,M.gold);
},{aoH:4,aoMin:.6});

// ------------------------------------------------------------------ base-hangar -----------------------------------------
// The hangar (16 x 16, 8 high): a skirt, armoured walls with a belt and pale plates, a ribbed barrel-vault roof with a
// lit spine and four vents, and the big slatted door with cyan frame lights on the front (+z). The game's sign hangs
// over the door (y 6.6).
WK.model('base-hangar',(b,o)=>{const {pal,glow,tint}=b.k,M=pal.mil,hi=b.hi,sink=o.sink??.6,W=15.4,wh=5.5,vh=2.1,R=(s,y)=>rc(b,s,s,y,hi?.9:0),nv=hi?10:6,nr=hi?6:3;
 b.bev(0,-sink,0,16,sink+.8,16,M.hull2,{ch:.2});
 b.loft([R(W,.8),R(W-.14,3)],M.hull,{top:false});if(hi)b.loft([R(W-.14,3),R(W+.1,3.08),R(W+.1,3.36),R(W-.2,3.44)],M.hull2,{top:false});else b.loft([R(W,3),R(W,3.44)],M.hull2,{top:false});
 b.loft([R(W-.2,3.44),R(W-.3,5.1)],M.plate,{top:false});b.loft([R(W-.1,5.1),R(W-.1,5.26)],M.cyan,{top:false});b.loft([R(W-.2,5.26),R(W,5.34),R(W,wh)],M.gold,{top:true,topMat:M.hull2});
 // the vault runs front to back; pale shoulders, dark eaves and crown
 b.at(0,wh,0,Math.PI/2,q=>q.vault(0,0,0,W-.5,W/2-.1,i=>{const j=Math.min(i,nv-1-i);return j===0?M.hull2:j>=nv/2-1?M.hull:M.plate;},{h:vh,n:nv,ends:M.hull,ribs:nr,ribR:.11,ribMat:M.hull2}));
 b.bev(0,wh+vh-.12,0,1.1,.3,W-1.6,M.hull2,{ch:.08});qb(b,0,wh+vh+.18,0,.34,.05,W-3,M.ice,'b');
 for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*3.7,z=sz*3.6;b.bev(x,6.9,z,1.9,.92,1.9,M.hull2,{ch:.1});qb(b,x,7.82,z,1.5,.05,1.5,M.dark,'b');if(hi){hoop(b,7.82,.5,.62,.06,8,glow(0x22e6ff,.8),{x,z,noBot:true});b.cyl(x,7.82,z,.5,.03,M.dark,{n:8});}else qb(b,x,7.86,z,.9,.03,.9,glow(0x22e6ff,.8),'b');}
 // buttress fins under the roof ribs
 for(let k=0;k<=nr;k++){const z=-(W-.5)/2+(W-.5)*k/nr,zz=z+(k===0?.3:k===nr?-.3:0);for(const s of [-1,1]){if(hi)b.loft([rc(b,.64,.5,.5,0,s*(W/2-.03),zz),rc(b,.5,.44,wh-.1,0,s*(W/2-.05),zz),rc(b,.2,.4,wh+.3,0,s*(W/2-.25),zz)],M.hull2);else qb(b,s*(W/2-.02),.5,zz,.5,wh-.4,.44,M.hull2,'b');}}
 // the door: a portal frame, the slatted leaf with a window row, cyan header and jambs, the amber sill
 b.at(0,0,W/2-.06,0,q=>{q.bev(0,.2,.05,11,6.2,.5,M.hull2,{ch:.14});qb(q,0,.3,.31,9.5,5.6,.02,M.dark,'kb');qb(q,0,5.92,.32,10,.14,.03,M.cyan,'kb');for(const s of [-1,1])qb(q,s*4.85,.3,.32,.14,5.6,.03,M.cyan,'kb');qb(q,0,.5,.33,9.4,.1,.03,M.amber,'kb');
  if(hi){for(let i=0;i<4;i++)qb(q,0,.98+i*1.3,.33,9.2,.07,.03,M.trim,'kb');for(let k=-3;k<=3;k++)qb(q,k*1.2,4.25,.33,.7,.34,.03,M.ice,'kb');qb(q,0,.3,.325,.1,5.6,.03,M.hull2,'kb');
   for(const s of [-1,1]){hazard(q,s*5.2,.3,.31,.5,1.3,3);q.bev(s*6.5,5.7,.02,.7,.34,.64,M.hull,{ch:.06});qb(q,s*6.5,5.64,.06,.5,.06,.4,M.white,'t');qb(q,s*5.28,3.2,.31,.2,.6,.03,M.gold,'kb');}}},0);
 // side windows high on the walls, a crew door, plant at the back
 for(const s of [-1,1])b.at(s*(W/2-.14),0,0,s*Math.PI/2,q=>{for(const t of [-1,1]){qb(q,t*3.75,3.9,.02,4,.7,.06,M.dark,'kb');qb(q,t*3.75,4,.06,3.6,.46,.03,M.ice,'kb');if(hi)for(let k=-1;k<=1;k++)qb(q,t*3.75+k*.9,4,.08,.08,.46,.03,M.dark,'kb');}
  if(hi&&s>0){q.bev(0,.8,.08,1.5,2.4,.22,M.hull2,{ch:.06});qb(q,0,.86,.2,1,2,.04,glow(0x22e6ff,.7),'kb');qb(q,0,3.24,.2,1.2,.1,.05,M.ice,'kb');}});
 b.at(0,0,-W/2+.06,Math.PI,q=>{for(const [x,ww,hh,l] of [[-3.9,2.8,2.3,M.amber],[-.7,2.2,1.8,M.cyan]]){q.bev(x,.8,.12,ww,hh,.24,M.hull2,{ch:.06});qb(q,x+ww*.3,.8+hh*.82,.25,.16,.1,.03,l,'kb');if(hi)for(let k=0;k<4;k++)qb(q,x-ww*.12,1+k*hh*.17,.25,ww*.56,.06,.03,M.trim,'kb');}
  if(hi){for(const x of [2,2.9,3.8]){q.tube([x,.8,.13],[x,5.2,.13],.11,x===2.9?M.gold:M.bare,{n:5});qb(q,x,2.9,.13,.34,.2,.26,M.hull2,'b');}q.bev(5.1,.8,.12,1.2,1.3,.24,M.plate2,{ch:.05});qb(q,5.1,1.2,.25,.7,.5,.03,M.dark,'kb');}});
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ base-reactor ----------------------------------------
// The reactor on its octagonal plinth (r 7.6, lit strip): a ribbed drum with lit rings, radiator banks, pipe elbows, a gold
// crown and the softly glowing core dome (12 high); the drum's shoulder under the crown is pale ceramic. o.tier: 3+ adds a third ring and crown teeth. o.plinth = 1: the plinth only
// (the citadel model stands on it).
WK.model('base-reactor',(b,o)=>{const {pal,glow,circ}=b.k,M=pal.mil,hi=b.hi,tier=o.tier||2,sink=o.sink??.6,O=(r,y)=>oct(b,r,y),teal=glow(0x2dffc4,1),n=hi?16:10,C=(r,y)=>({p:circ(r,n,0,0,r,Math.PI/n),y}),rD=y=>5.6-.75*(y-1.6)/7.8;
 b.loft([O(7.6,-sink),O(7.6,1.28)],M.hull2,{top:false});b.loft([O(7.75,1.28),O(7.75,1.48)],M.cyan,{top:false});b.loft([O(7.66,1.48),O(7.66,1.6),O(5.6,1.63)],M.hull2,{top:false});
 if(o.plinth){b.cap(O(5.6,1.63).p,1.63,M.hull2);return;}
 b.loft([C(5.86,1.6),C(5.86,2.2),C(rD(2.4),2.4)],M.hull2,{smooth:true,top:false});b.loft([C(rD(2.4),2.4),C(rD(6.9),6.9),C(rD(8.9),8.9)],r=>r?M.plate:M.hull,{smooth:true,top:false});
 b.loft([C(rD(8.9),8.9),C(rD(8.9)+.2,9),C(rD(9.4)+.2,9.4)],M.hull2,{smooth:true,top:false});b.loft([C(4.85,9.4),C(4.85,9.62),C(4.5,9.86)],M.gold,{smooth:true,top:true,topMat:M.hull2});
 // ribs: buttress fins following the drum's taper
 const nr=hi?12:6;for(let k=0;k<nr;k++){const a=k*TAU/nr+(hi?TAU/24:0);rad(b,a,0,0,q=>{if(hi)q.loft([rc(q,.74,.9,1.6,.1,0,5.86+.2),rc(q,.62,.66,8.6,.1,0,rD(8.6)+.26),rc(q,.4,.3,9.5,.08,0,rD(9.5)+.06)],M.hull2);else q.loft([rc(q,.8,.9,1.6,0,0,6),rc(q,.6,.5,9.4,0,0,5.05)],M.hull2);});
  if(k%(hi?3:2)===0){const am=a+TAU/nr/2,c=Math.cos(am),s=Math.sin(am),t=.14;b.quad([c*(rD(3.2)+.03)+s*t,3.2,s*(rD(3.2)+.03)-c*t],[c*(rD(3.2)+.03)-s*t,3.2,s*(rD(3.2)+.03)+c*t],[c*(rD(7.8)+.03)-s*t,7.8,s*(rD(7.8)+.03)+c*t],[c*(rD(7.8)+.03)+s*t,7.8,s*(rD(7.8)+.03)-c*t],M.white,[0,5,0]);}}
 // lit rings: slim cyan hoops (0x5fd8ff, dim enough to stay cyan: the dome is the only white mass) seated on the ribs'
 // outer faces; between two rings a band of short vertical fins, two in every bay between the ribs (the Meshy reactor's ribs)
 // (a full glow at 0.36 of the colour: the shader shows glow x 2.3, and anything brighter tone-maps to white)
 {const ys=tier>=3?[3.4,5.6,7.8]:[3.6,6.6],rw=tier>=3?.3:.46,rh=tier>=3?.2:.28,lit=b.k.tint(glow(0x5fd8ff,1),.36),off=y=>(hi?.9:.84)-(hi?.32:.36)*(y-1.6)/7;
  for(const y of ys){const r=rD(y)+off(y)+rw/2-.05;hoop(b,y-rh/2,r-rw/2,r+rw/2,rh,n,lit,{rot:Math.PI/n,noBot:!hi});}
  if(hi)for(let i=0;i<ys.length-1;i++){const ya=ys[i]+rh/2+.2,yb=ys[i+1]-rh/2-.2,fm=i?M.hull2:M.trim;
   for(let k=0;k<24;k++){const a=TAU/24+(k>>1)*TAU/12+(k%2?2:1)*TAU/36;rad(b,a,0,0,q=>q.loft([rc(q,.26,.6,ya,0,0,rD(ya)+.06),rc(q,.26,.6,yb-.26,0,0,rD(yb-.26)+.06),rc(q,.26,.06,yb,0,0,rD(yb)-.1)],fm,{top:false}));}}}
 // radiator banks and pipe elbows on the plinth
 for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;rad(b,a,6.5,1.6,q=>{q.bev(0,0,0,2.9,.34,1.3,M.hull2,{ch:.06});const m=hi?7:3;for(let i=0;i<m;i++)qb(q,-1.2+2.4*i/(m-1),.34,0,hi?.16:.4,2.3,1.1,i%2?M.plate2:M.trim,'b');if(hi)qb(q,0,2.5,0,2.8,.14,.5,M.hull2,'b');});
  if(hi){const a2=a+.62,c=Math.cos(a2),s=Math.sin(a2);b.pipe([[c*5.7,2.9,s*5.7],[c*6.9,2.9,s*6.9],[c*6.9,1.6,s*6.9]],.3,M.bare,{n:6});const a3=a-.62,c3=Math.cos(a3),s3=Math.sin(a3);b.pipe([[c3*5.7,2.3,s3*5.7],[c3*6.7,2.3,s3*6.7],[c3*6.7,1.6,s3*6.7]],.22,M.trim,{n:5});}}
 // the crown and the core dome
 if(tier>=3&&hi)for(let k=0;k<8;k++){const a=k*Math.PI/4;rad(b,a,4.72,9.62,q=>q.loft([rc(q,.7,.34,0),rc(q,.3,.2,.62,0,0,-.1)],M.gold));}
 // the core dome: pale and softly lit, NOT blown out (the solid shader multiplies emission by 2.3: 0xdfeef2 clips to pure
 // white from about 0.5 up), a shade darker toward its base so the form reads
 {const dm=glow(0xdfeef2,.28);b.dome(0,9.86,0,4.3,1.95,4.3,r=>r?(r>1?dm:b.k.tint(dm,.9)):b.k.tint(dm,.78),{n:hi?14:8,rings:hi?4:2});}
 if(hi){b.ring(0,9.9,0,4.4,M.gold,{thin:true});b.halo(0,11.2,0,2.2,0x2dffc4,.22);}b.cyl(0,11.72,0,.5,.22,teal,{n:6});
},{aoH:3,aoMin:.58});

// ------------------------------------------------------------------ base-tower ------------------------------------------
// A corner gun tower (8 x 8, 14 high): a battered base, an armoured shaft with corner fins and light strips, a parapet
// deck, and the twin-gun turret aimed at +z with its beacon mast. The barrels stay inside the footprint (z <= 3.95).
WK.model('base-tower',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,sink=o.sink??.6,R=(s,y)=>rc(b,s,s,y,hi?.5:0);
 b.bev(0,-sink,0,7.6,sink+2,7.6,M.hull2,{ch:.3});
 b.loft([R(5.9,2),R(5.6,5.3)],M.hull,{top:false});if(hi)b.loft([R(5.6,5.3),R(5.84,5.38),R(5.84,5.66),R(5.56,5.74)],M.hull2,{top:false});else b.loft([R(5.8,5.3),R(5.8,5.74)],M.hull2,{top:false});
 b.loft([R(5.56,5.74),R(5.4,8.6)],M.plate,{top:false});b.loft([R(5.6,8.6),R(5.6,8.8)],M.gold,{top:false});b.loft([R(5.5,8.8),R(6.4,9.1)],M.hull2,{top:false});
 b.bev(0,9.1,0,6.4,.6,6.4,M.hull2,{ch:.12});
 // corner fins with a cyan strip
 for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;rad(b,a,0,0,q=>{if(hi)q.loft([rc(q,.8,.9,1.9,.08,0,3.9),rc(q,.66,.6,8.4,.08,0,3.7),rc(q,.4,.3,9.1,.06,0,3.9)],M.hull2,{top:false});else q.loft([rc(q,.8,.8,1.9,0,0,3.9),rc(q,.6,.6,9.1,0,0,3.75)],M.hull2,{top:false});
   q.quad([-.09,2.3,4.38],[.09,2.3,4.38],[.09,8.3,4.03],[-.09,8.3,4.03],M.cyan,[0,5,0]);});}
 // faces: a sign plaque on the front, firing slits, plates
 for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>{qb(q,0,4.1,2.84,2.4,.3,.05,M.dark,'kb');qb(q,0,4.2,2.87,2,.09,.03,M.ice,'kb');if(hi){q.at(0,0,2.9,0,p=>p.bev(0,2.3,0,3.2,1.3,.14,M.plate2,{ch:.06}),-.045);if(k===0)qb(q,0,7.04,2.74,3.9,1.14,.05,M.dark,'kb');else q.at(0,0,2.74,0,p=>p.bev(0,6.3,0,2.6,1.7,.12,M.plate2,{ch:.06}),-.028);}});
 for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>{for(const x of hi?[-2.1,0,2.1]:[0])qb(q,x,9.7,2.94,hi?1.3:4.6,.42,.5,M.hull,'b');});
 // dark rib strips on the pale band, either side of the face panel (the Meshy items' ribbed armour)
 if(hi){const rib=b.k.mat(0x1b2436,'metal',.2,0);for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>q.at(0,5.8,2.775,0,p=>{for(const x of [-2.08,-1.72,1.72,2.08])qb(p,x,0,.04,.15,2.72,.1,rib,'kb');},-.028));}
 // the turret
 b.cyl(0,9.7,0,2.1,.3,M.dark,{n:hi?12:8});b.loft([rc(b,3.9,4.1,10,hi?.5:0),rc(b,3.9,4.1,10.5,hi?.5:0),rc(b,3,3.1,11.5,hi?.4:0,0,-.3)],M.hull,{top:true,topMat:M.plate});
 b.bev(0,10.22,2.02,2.7,1.02,.7,M.hull2,{ch:.12});
 for(const s of [-1,1]){const x=s*.62,nb=hi?8:5;b.tube([x,10.7,2.2],[x,10.86,3.5],.24,M.trim,{n:nb});b.tube([x,10.86,3.5],[x,10.92,3.95],.36,M.dark,{n:nb,caps:true});if(hi){b.tube([x,10.71,2.3],[x,10.77,2.9],.33,M.hull2,{n:nb,caps:true});qb(b,s*2.06,10.1,-.2,.2,.9,2.6,M.plate2,'b');}}
 b.tube([0,11.3,-1.3],[0,13.3,-1.3],.08,M.trim,{n:5});b.box(0,13.3,-1.3,.26,.26,.26,M.red);b.halo(0,13.45,-1.3,1.2,0xff3048,1);
 if(hi){b.bev(-.9,11.45,.2,.9,.36,.9,M.hull2,{ch:.06});qb(b,-.9,11.52,.67,.5,.2,.04,M.ice,'kb');b.cyl(.95,11.42,-.5,.34,.2,M.dark,{n:8});b.dome(.95,11.62,-.5,.3,.3,.3,M.plate,{n:8,rings:2});
  b.tube([.9,11.4,-1.5],[1.05,13.9,-1.6],.025,M.bare,{n:3});b.cyl(0,12.3,-1.3,.14,.16,M.gold,{n:6});
  b.detail(()=>b.ladder([0,2,-2.98],[0,9.1,-2.86],M.bare,{w:.6}));b.at(0,0,-2.92,Math.PI,q=>{q.bev(0,2,.0,1.3,2.1,.16,M.hull2,{ch:.06});qb(q,0,4.14,.1,.9,.1,.05,M.ice,'kb');});
  // 5E-2d2 (reviewer note: the tower was the plainest military piece; HIGH only, LOW's triangles are unchanged): a lit
  // observation slit in a dark frame on the three plain faces of the pale band, a hazard band round the foot of the shaft, a
  // conduit down the right of every face from the cap to the base, and two floodlamps under the cap's front corners.
  const lit=b.k.tint(M.ice,.75);
  for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>{
   if(k)q.at(0,0,2.74,0,p=>{qb(p,0,7.1,.15,2.1,.52,.05,M.dark,'kb');qb(p,0,7.27,.19,1.8,.16,.03,lit,'kb');for(const x of [-1.14,1.14])qb(p,x,7.04,.17,.1,.64,.07,M.hull2,'kb');},-.028);
   q.detail(()=>{for(let i=0;i<8;i++)q.quad([-2.8+i*.7,2.02,2.97],[-2.1+i*.7,2.02,2.97],[-2.1+i*.7+.2,2.34,2.955],[-2.8+i*.7+.2,2.34,2.955],i%2?M.hazardD:M.hazard,[0,2.2,0]);
    q.tube([2.36,2.3,2.99],[2.36,5.3,2.86],.07,M.dark,{n:4});q.tube([2.36,5.74,2.84],[2.36,8.6,2.76],.07,M.dark,{n:4});for(const y of [3.2,4.6,6.6,7.9])qb(q,2.36,y,2.92-(y-2)*.03,.22,.12,.2,M.trim,'kb');});});
  for(const s of [-1,1]){qb(b,s*2.9,9.34,3.06,.5,.3,.44,M.dark,'t');b.quad([s*2.9-.19,9.37,3.285],[s*2.9+.19,9.37,3.285],[s*2.9+.19,9.6,3.285],[s*2.9-.19,9.6,3.285],M.white,[s*2.9,9.5,3]);b.halo(s*2.9,9.46,3.42,.9,0xdff4ff,.55);}}
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ base-module -----------------------------------------
// A base module on the back wall line: a hex core whose height is its level (o.level 1-3: 2.3 / 3.4 / 4.5 m) with six corner
// buttress fins, a pale ceramic shoulder under a gold cornice, a hatch on each of the two front faces, one lit band a
// level and a softly glowing cap in the function colour (o.color, hex). o.kind (optional: reactor hangar defense vault
// radar uplink) picks the emblem on top.
WK.model('base-module',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,lv=Math.max(1,Math.min(3,(o.level|0)||1)),h=1.2+lv*1.1,col=o.color||0x22e6ff,c=glow(col,.8),cap=glow(col,.5),c9=glow(col,.9),X=(r,y)=>ngon(b,6,r,y,Math.PI/6),ys=h-.95;
 if(hi)b.loft([X(1.9,-.4),X(1.9,.24),X(1.62,.4)],M.hull2,{top:false});else b.loft([X(1.9,-.4),X(1.7,.4)],M.hull2,{top:false});
 b.loft([X(1.5,.4),X(1.45,ys),X(1.56,ys+.08),X(1.5,h)],r=>r?M.plate:M.hull,{top:false});for(let k=1;k<=lv;k++){const y=.4+(ys-.4)*k/(lv+1);b.loft([X(1.53,y-.06),X(1.53,y+.06)],c9,{top:false});}
 b.loft([X(1.62,h),X(1.62,h+.1)],M.gold,{top:false});b.loft([X(1.6,h+.1),X(1.6,h+.28),X(1.25,h+.46)],(r)=>r?M.hull2:cap,{top:true,topMat:M.hull2});
 for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6;rad(b,a,0,0,q=>hi?q.loft([rc(q,.42,.66,.3,0,0,1.58),rc(q,.32,.34,ys,0,0,1.5),rc(q,.24,.14,h,0,0,1.5)],M.hull2,{top:true}):q.loft([rc(q,.42,.66,.3,0,0,1.58),rc(q,.26,.2,h,0,0,1.5)],M.hull2,{top:false}));}
 // the hatches: a pale frame, a dark leaf, a status pad in the function colour
 for(const a of [Math.PI/3,Math.PI*2/3])rad(b,a,1.33,.44,q=>{const hh=Math.min(1.2,ys-.6);qb(q,0,0,.02,.62,hh,.04,M.dark,'kb');if(hi){qb(q,0,hh,.03,.86,.1,.08,M.plate2,'kb');for(const s of [-1,1])qb(q,s*.37,0,.03,.12,hh,.08,M.plate2,'kb');qb(q,0,hh*.62,.05,.2,.08,.03,c9,'kb');}});
 const y=h+.46,kind=o.kind||'';
 if(kind==='reactor'){b.cyl(0,y,0,.5,.3,M.hull2,{n:6});b.ball(0,y+.75,0,.5,c,true);}
 else if(kind==='hangar'){b.at(0,y,0,0,q=>q.vault(0,0,0,1.5,.62,M.plate,{n:hi?6:4,ends:M.hull2}));}
 else if(kind==='defense'){b.bev(0,y,-.1,1,.5,1,M.hull2,{ch:.08});for(const s of [-1,1])b.tube([s*.24,y+.3,.3],[s*.24,y+.42,1.3],.09,M.trim,{n:5,caps:true});}
 else if(kind==='vault'){b.bev(0,y,0,1.2,.7,1,M.plate,{ch:.1});qb(b,0,y+.22,.51,.3,.26,.03,M.gold,'kb');}
 else if(kind==='radar'){b.cyl(0,y,0,.1,.5,M.trim,{n:5});b.at(0,y+.5,0,.6,q=>q.cyl(0,0,0,.12,.3,M.plate,{n:hi?8:6,r2:.7}),.8);}
 else if(kind==='uplink'){b.tube([0,y,0],[0,y+2.1,0],.06,M.trim,{n:4});for(const [yy,r] of [[.7,.34],[1.25,.24]])hoop(b,y+yy,r-.06,r,.06,6,c9,{});b.gem(0,y+2.2,0,.12,.16,.12,c);}
 else{b.cyl(0,y,0,.34,.36,M.hull2,{n:6});b.gem(0,y+.7,0,.24,.34,.24,c);}
 b.halo(0,h+.3,0,1.2,col,.22);
});

// ------------------------------------------------------------------ base-spire ------------------------------------------
// The tier V command tower on the back wall line: an octagonal bastion that straddles the wall, a tapering hex shaft with
// four cyan ring gantries (y 9.5 / 14 / 18.5 / 23, inside r 3.5), a lit command deck at y 25, a mast and an ice beacon at 32.6.
WK.model('base-spire',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,sink=o.sink??.6,O=(r,y)=>oct(b,r,y),X=(r,y)=>ngon(b,6,r,y,Math.PI/6),rS=y=>2.4-(y/26)*.91;
 b.loft([O(3.95,-sink),O(3.95,1),O(3.7,1.2)],M.hull2,{top:false});b.loft([O(3.6,1.2),O(3.2,4.9)],M.hull,{top:false});b.loft([O(3.3,4.9),O(3.3,5.14)],M.cyan,{top:false});
 b.loft([O(3.2,5.14),O(3.1,6.1)],M.plate,{top:false});b.loft([O(3.1,6.1),O(3.34,6.2),O(3.34,6.45),O(2.3,6.5)],M.gold,{top:false});
 for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;rad(b,a,0,0,q=>q.loft([rc(q,.9,1.1,-sink,hi?.1:0,0,3.25),rc(q,.7,.8,6.4,hi?.1:0,0,2.86),rc(q,.4,.4,9,hi?.08:0,0,2.26)],M.hull2));}
 // the shaft: gunmetal and pale segments between collars
 let ya=6.5,i=0;for(const yc of [9.5,14,18.5,23]){b.loft([X(rS(ya),ya),X(rS(yc-.6),yc-.6)],i%2?M.plate:M.hull,{top:false});b.loft([X(rS(yc)+.14,yc-.6),X(rS(yc)+.14,yc-.2)],M.hull2,{top:false});ya=yc-.2;i++;
  const r=rS(yc),Rg=r+1.1;if(hi){b.ring(0,yc,0,Rg,M.cyan,{t:.7});hoop(b,yc-.34,r+.1,Rg+.06,.14,12,M.hull2,{});}else hoop(b,yc-.14,Rg-.16,Rg+.16,.28,8,M.cyan,{noBot:true});
  for(let k=0;k<3;k++){const a=k*TAU/3+i;rad(b,a,0,0,q=>q.tube([0,yc-1.5,rS(yc-1.5)*.87],[0,yc-.3,Rg-.1],.09,M.trim,{n:4}));}}
 b.loft([X(rS(ya),ya),X(1.5,24.4)],M.plate,{top:false});
 if(hi)for(let k=0;k<3;k++){const a=k*TAU/3+Math.PI/2,c=Math.cos(a),s=Math.sin(a);b.tube([c*(rS(7)*.87+.04),7,s*(rS(7)*.87+.04)],[c*(rS(24)*.87+.04),24,s*(rS(24)*.87+.04)],.08,M.cyan,{n:4});}
 // the command deck: a flared pod with a lit window band
 b.loft([O(1.6,24.2),O(3.05,25.2),O(3.05,25.34)],M.hull2,{top:false});b.loft([O(3.0,25.34),O(2.9,26.1)],M.ice,{top:false});b.loft([O(2.94,26.1),O(3.26,26.2),O(3.26,26.42)],M.gold,{top:false});b.loft([O(3.2,26.42),O(1.5,27.5),O(1.1,27.52)],M.hull,{top:false});
 if(hi)for(let k=0;k<8;k++){const a=k*Math.PI/4+Math.PI/8;rad(b,a,2.92,25.34,q=>q.box(0,0,0,.3,.8,.26,M.hull2));const a2=k*Math.PI/4;rad(b,a2,2.72,25.34,q=>qb(q,0,0,0,.12,.78,.12,M.hull2,'tb'));}
 // the mast: cross-arms with dishes, the beacon in its claw
 b.loft([X(1.1,27.5),X(.5,30),X(.2,31.9)],M.plate2,{top:true});
 b.ball(0,32.6,0,.78,glow(0xa8f8ff,1),!hi);b.halo(0,32.6,0,3.4,0x22e6ff,.7);
 if(hi){for(let k=0;k<3;k++){const a=k*TAU/3;b.tube([Math.cos(a)*.3,31.6,Math.sin(a)*.3],[Math.cos(a)*.86,32.5,Math.sin(a)*.86],.06,M.gold,{n:3});}
  b.tube([-1.7,28.7,0],[1.7,28.7,0],.07,M.trim,{n:4});for(const s of [-1,1])b.at(s*1.7,28.7,0,s>0?0:Math.PI,q=>q.at(0,0,0,0,r=>r.cyl(0,0,0,.1,.3,M.plate,{n:8,r2:.6}),0,-1.2));
  b.tube([0,29.8,-1.1],[0,29.8,1.1],.05,M.trim,{n:3});for(const s of [-1,1])b.gem(0,29.95,s*1.1,.08,.14,.08,M.white);b.loft([X(.62,29.9),X(.62,30.1)],M.gold,{top:false});}
},{aoH:5,aoMin:.58});

// ------------------------------------------------------------------ base-kiosk ------------------------------------------
// The build terminal (2 x 1.5, 3.4 high, a whip to 4.5): a console with a slanted AMBER screen facing +z (amber is the game's
// "build here"); every other light on it is military cyan / white, the kick plates are pale ceramic.
WK.model('base-kiosk',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi;
 b.bev(0,-.3,0,2.1,.62,1.6,M.hull2,{ch:.08});b.loft([rc(b,1.9,1.4,.32,hi?.1:0),rc(b,1.84,1.34,1.7,hi?.1:0),rc(b,1.8,1,3.3,hi?.1:0,0,-.16)],(r)=>r?M.plate:M.hull,{top:true,topMat:M.hull2});
 b.at(0,2.5,.5,0,q=>{qb(q,0,-.62,0,1.66,1.24,.1,M.dark,'k');qb(q,0,-.5,.06,1.5,1,.03,glow(0xffb347,.95),'k');if(hi){for(let k=0;k<3;k++)qb(q,-.3,.2-k*.24,.08,.6,.06,.02,M.hazardD,'ktbrl');qb(q,.45,-.3,.08,.3,.3,.02,M.hazardD,'ktbrl');}},-.203);
 for(const s of [-1,1])qb(b,s*.93,.5,.55,.07,1.1,.2,M.cyan,'b'+(s>0?'l':'r'));
 b.bev(0,3.3,-.16,2,.16,1.2,M.hull2,{ch:.05});qb(b,0,3.34,.45,1.9,.08,.03,M.gold,'kb');b.tube([-.7,3.46,-.5],[-.7,4.5,-.5],.035,M.trim,{n:3});b.gem(-.7,4.56,-.5,.08,.1,.08,M.white);
 if(hi){b.at(0,1.5,.66,0,q=>{q.bev(0,0,.12,1.5,.14,.4,M.hull2,{ch:.04});for(let k=0;k<4;k++)qb(q,-.48+k*.32,.14,.12,.2,.02,.16,k===3?M.cyan:M.trim,'b');},.24);
  for(const s of [-1,1])qb(b,s*.5,.4,.71,.7,.5,.03,M.plate,'kb');b.bev(.5,3.46,-.3,.5,.2,.4,M.trim,{ch:.04});b.halo(0,2.5,.7,1.1,0xffb347,.25);}
});

// ------------------------------------------------------------------ veteran-monument ------------------------------------
// The field veteran's monument (3 x 3, 5.7 high): a three-tier armoured plinth with a gold edge, a gold plaque on its front and
// a lit bollard on each corner; a dark stone obelisk with a lit line at its foot, one gold inscription band at 40% of the
// height and a thin cyan channel up each face; a softly lit gold pyramid cap and a white tip. Gold is only on the cap, the
// band, the plaque and the plinth edge (a whole gold shaft went olive on its shaded faces under the Moon's light).
WK.model('veteran-monument',(b,o)=>{const {pal,glow,mat,tint}=b.k,M=pal.mil,hi=b.hi,X=(r,y)=>ngon(b,4,r,y,Math.PI/4),stone=mat(0x2a3346,'concrete',.25,0),gold=glow(0xc9a227,.18),cap=glow(0xc9a227,.3),plaque=glow(0xc9a84a,.22),ink=mat(0x3a2c10,'flat',0,0),rs=y=>.62-.32*(y-1.56)/3.04,C45=Math.SQRT1_2;   // the gold carries a little light of its own: it stays gold on shaded faces
 // a three-tier plinth, a bollard with a gold cap and a cyan light on each corner of the first tier
 b.bev(0,0,0,3,.5,3,M.hull2,{ch:.1});b.bev(0,.5,0,2.2,.5,2.2,M.hull,{ch:.08});b.bev(0,1,0,1.62,.2,1.62,M.hull2,{ch:.06});
 for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*1.2,z=sz*1.2;if(hi){b.cyl(x,.5,z,.13,.4,M.hull2,{n:6,bev:.03});b.cyl(x,.9,z,.16,.06,gold,{n:6});b.box(x,.96,z,.12,.1,.12,M.cyan);}else{b.box(x,.5,z,.26,.42,.26,M.hull2);b.box(x,.92,z,.16,.12,.16,M.cyan);}}
 if(hi)b.loft([rc(b,2.24,2.24,.78),rc(b,2.24,2.24,.92)],gold,{top:false});
 // the gold plaque on the front of the second tier (three inscription lines on HIGH)
 qb(b,0,.57,1.12,1.34,hi?.2:.3,.05,plaque,'kb');if(hi)for(let i=0;i<3;i++)qb(b,(i-1)*.02,.6+i*.055,1.15,1.1-i*.2,.022,.01,ink,'kblrt');
 // one loft: flared foot, the lit line, the shaft with the band (3 cm proud of the stone on HIGH), the cap (proud as well)
 if(hi)b.loft([X(.95,1.2),X(.8,1.5),X(.62,1.56),X(rs(2.14),2.14),X(rs(2.14)+.05,2.17),X(rs(2.5)+.05,2.47),X(rs(2.5),2.5),X(.3,4.6),X(.345,4.63),X(.02,5.4)],r=>r===1?M.cyan:r>6?cap:r>2&&r<6?gold:stone,{top:false});
 else b.loft([X(.95,1.2),X(.8,1.5),X(.62,1.56),X(rs(2.14),2.14),X(rs(2.5),2.5),X(.3,4.6),X(.02,5.4)],r=>r===1?M.cyan:r===5?cap:r===3?gold:stone,{top:false});
 // a lit cyan channel up the middle of each face of the shaft, above the band
 {const ch=tint(M.cyan,.8),ya=2.62,yb=4.4,za=rs(ya)*C45+.012,zb=rs(yb)*C45+.012,hw=hi?.035:.05;for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>q.quad([-hw,ya,za],[hw,ya,za],[hw,yb,zb],[-hw,yb,zb],ch,[0,3.5,0]));}
 b.gem(0,5.5,0,.14,.2,.14,M.white);b.halo(0,5.4,0,1.6,0xffd36b,.45);
},{aoH:2,aoMin:.6});

// ================================================================== the frontier wall ===================================
// ------------------------------------------------------------------ frontier-wall ---------------------------------------
// A run of the frontier wall the colonists hold. o.w = run length along x, o.d / o.h = the lot's depth and height (3 / 5):
// the body is o.d thick, the walkway slab and buttresses reach o.d / 2 + 0.2, the parapet top is at o.h + 1; o.sink below
// the ground. The OUTER face is +z: a crenellated parapet with pale-capped merlons and firing slits, a dark buttress every
// bay (about 3.6 m), a pale ceramic shoulder band over the gunmetal foot with a shadowed recess between them, one cyan
// pad a bay on the walkway slab's edge; the inner face has pilasters and the walkway rail. Gold-crowned end posts with
// hazard stripes close each run.
WK.model('frontier-wall',(b,o)=>{const {pal,tint}=b.k,M=pal.mil,hi=b.hi,w=o.w||13,d=o.d||3,h=o.h||5,sink=o.sink??4,hd=d/2,R=(dd,y)=>rc(b,w,dd,y),ys=1+(h-1.9)*.42,ph=h-ys-1.3,
  x0=-w/2+1.1,nb=Math.max(1,Math.round((w-2.2)/3.6)),bw=(w-2.2)/nb;
 b.loft([R(d,-sink),R(d,.9),R(d-.14,1),R(d-.3,ys),R(d-.56,ys+.05),R(d-.56,ys+.25),R(d-.26,ys+.32),R(d-.5,h-.98),R(d-.7,h-.94),R(d-.7,h-.66),R(d+.4,h-.62),R(d+.4,h-.3)],r=>[M.conc,M.conc,M.hull,M.dark,M.dark,M.plate2,M.plate,M.dark,M.dark,M.hull2,M.hull2][r],{top:true,topMat:M.plate2});
 // outer parapet with pale-capped merlons and firing slits; inner kerb and rail
 qb(b,0,h-.3,hd-.05,w,.62,.5,M.hull,'b');const nm=Math.max(2,Math.round(w/2.2));
 for(let k=0;k<nm;k++){const x=-w/2+w*(k+.5)/nm;qb(b,x,h+.32,hd-.05,w/nm-.7,.68,.5,f=>f==='t'?M.plate:M.hull,'b');if(hi)qb(b,x,h-.14,hd+.21,.5,.3,.02,M.dark,'kb');}
 qb(b,0,h-.3,-hd-.02,w,.2,.3,f=>f==='t'?M.plate:M.hull2,'b');if(hi)b.detail(()=>b.rail([[-w/2+1,h-.1,-hd-.02],[w/2-1,h-.1,-hd-.02]],.85,M.bare,{step:3.2,r:.07,mid:false}));
 // a buttress (outer) and a pilaster (inner) between bays
 for(let i=1;i<nb;i++){const x=x0+i*bw;b.loft([rc(b,1.3,.62,-sink,0,x,hd-.11),rc(b,1.2,.6,h*.5,0,x,hd-.1),rc(b,.9,.3,h-.84,0,x,hd-.1)],M.hull2,{top:false});b.loft([rc(b,.9,.4,-sink,0,x,-hd),rc(b,.8,.3,h-.84,0,x,-hd-.02)],M.hull2,{top:false});
  if(hi){qb(b,x,h*.5+.5,hd+.15,.5,.2,.08,M.hull2,'b');qb(b,x,h*.5+.46,hd+.15,.36,.04,.06,M.white,'t');}}
 // every bay: a cyan pad on the slab's edge; bevelled ceramic armour on the shoulder with a dark slot, a plate on the foot
 for(let i=0;i<nb;i++){const x=x0+(i+.5)*bw;b.quad([x-.55,h-.54,hd+.21],[x+.55,h-.54,hd+.21],[x+.55,h-.4,hd+.21],[x-.55,h-.4,hd+.21],M.cyan,[x,h-.5,0]);
  if(hi){b.at(x,ys+.4,hd-.12,0,q=>{q.bev(0,0,0,bw-1.5,ph-.16,.14,M.plate,{ch:.06});qb(q,0,ph*.42,.08,Math.min(1.5,bw-2.2),.26,.03,M.dark,'kb');},-.12/ph);b.at(x,1.14,hd-.07,0,q=>q.bev(0,0,0,bw-1.7,ys-1.3,.1,M.plate2,{ch:.05}),-.06);}}
 // end posts: taller, striped, a gold crown band under a pale cap, a cyan lamp on top
 for(const s of [-1,1]){const x=s*(w/2-.52);b.bev(x,-sink,0,1.1,sink+h+.72,d+.4,M.hull2,{ch:.1});b.loft([rc(b,1.16,d+.46,h+.44,0,x),rc(b,1.16,d+.46,h+.58,0,x)],M.gold,{top:false});b.bev(x,h+.72,0,.86,.2,d+.1,M.plate,{ch:.05});
  b.at(x,0,hd+.2,0,q=>{hazard(q,0,1.6,.02,1,1.2,4);q.quad([-.4,3.3,.02],[.4,3.3,.02],[.4,h-.2,.02],[-.4,h-.2,.02],M.plate,[0,3,-1]);});qb(b,x,h+.92,0,.3,.08,.3,M.cyan,'b');
  if(hi){b.at(x,0,-hd-.2,Math.PI,q=>hazard(q,0,1.6,.02,1,1.2,4));qb(b,x,3.6,hd+.23,.16,h-4.2,.02,M.ice,'kb');}}
},{aoH:3,aoMin:.58});

// ------------------------------------------------------------------ frontier-watch --------------------------------------
// A frontier watchtower on o.w x o.d (6 x 6), cabin top at o.h (12): four splayed armoured legs with ONE stout diagonal a
// face a tier, a ring beam and pale gusset blocks at mid height (thin X braces turn to moire on a phone), an
// enclosed cabin with a lit window band, a hipped roof (0.3 overhang) with a searchlight (front, +z), an antenna with a red
// tip (to o.h + 1.1) and cyan trim, a ladder up the back.
WK.model('frontier-watch',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,w=o.w||6,d=o.d||6,h=o.h||12,sink=o.sink??1,fy=h*.66,R=(k,y,ch)=>rc(b,w*k,d*k,y,hi?ch:0);
 // legs and braces
 const L=(sx,sz,t)=>[sx*(w/2-.55-(w*.2-.55)*t*0+(-(w/2-.55)+w*.32)*t),fy*t,sz*(d/2-.55+(-(d/2-.55)+d*.32)*t)];
 for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const a=L(sx,sz,0),c=L(sx,sz,1);b.bev(a[0],-sink,a[2],1.1,sink+.4,1.1,M.hull2,{ch:.1});b.loft([rc(b,.72,.72,.4,hi?.12:0,a[0],a[2]),rc(b,.5,.5,fy,hi?.1:0,c[0],c[2])],M.hull,{top:false});}
 const C=[[-1,-1],[1,-1],[1,1],[-1,1]];for(let i=0;i<4;i++){const p=C[i],q=C[(i+1)%4];b.tube(L(p[0],p[1],.07),L(q[0],q[1],.5),.17,M.trim,{n:hi?4:3});if(hi||i%2===0)b.tube(L(q[0],q[1],.52),L(p[0],p[1],.95),.17,M.trim,{n:hi?4:3});
  b.tube(L(p[0],p[1],.51),L(q[0],q[1],.51),.2,M.hull2,{n:hi?4:3});if(hi){const g=L(p[0],p[1],.51);qb(b,g[0],g[1]-.34,g[2],.9,.68,.9,M.plate2,'b');}}
 // the cabin: floor, armoured lower wall, the window band, a pale upper band, cyan trim, the roof
 b.loft([R(.86,fy-.3,.5),R(1,fy,.6),R(1,fy+.24,.6)],M.hull2,{top:false});b.loft([R(.96,fy+.24,.7),R(.95,h*.8,.7)],M.hull,{top:false});
 b.loft([R(.93,h*.8,.7),R(.92,h*.89,.7)],hi?M.glassDark:M.ice,{top:false});b.loft([R(.95,h*.89,.7),R(.95,h*.94,.7)],M.plate,{top:false});b.loft([R(.97,h*.94,.7),R(.97,h*.955,.7)],M.cyan,{top:false});
 b.loft([R(1.1,h*.955,.8),R(1.1,h*.975,.8),R(.56,h+.08,.4)],(r)=>r?M.plate2:M.hull2,{top:false});b.loft([R(.56,h+.08,.4),R(.56,h+.12,.4)],M.cyan,{top:false});b.loft([R(.52,h+.12,.4),R(.5,h+.16,.4)],M.plate2,{top:true,topMat:M.plate2});
 if(!hi)for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>{const ww=(k%2?d:w),z=(k%2?w:d)*.93/2+.03;for(const x of [-1.5,-.5,.5,1.5])qb(q,x*ww*.2,h*.8,z,ww*.045,h*.09,.03,M.glassDark,'kblrt');});
 if(hi)for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>{const ww=(k%2?d:w),z=(k%2?w:d)*.93/2+.02;for(const x of [-1,0,1])qb(q,x*ww*.22,h*.8+.08,z,ww*.19,h*.09-.16,.03,M.ice,'kb');qb(q,0,fy+.7,z+.1,ww*.5,h*.14-1.3,.1,M.plate2,'kb');});
 // roof kit: searchlight, antenna, an air unit, the hatch light
 b.at(w*.36,h-.12,d*.36,.5,q=>{q.cyl(0,-.1,0,.18,.34,M.trim,{n:6});q.at(0,.42,0,0,r=>{r.tube([0,0,-.3],[0,0,.34],.3,M.hull2,{n:hi?8:5,caps:true});r.tube([0,0,.34],[0,0,.38],.25,M.white,{n:hi?8:5,caps:true});},.3);});b.halo(w*.3+.3,h+.4,d*.3+.5,1.2,0xe8f6ff,.4);
 b.tube([-w*.26,h*.99,-d*.26],[-w*.26,h+1,-d*.26],.06,M.trim,{n:4});b.gem(-w*.26,h+1.02,-d*.26,.1,.1,.1,M.red);
 if(hi){airUnit(b,w*.06,h+.16,-d*.04,.55);qb(b,-w*.12,h+.16,d*.08,.9,.06,.9,M.hazard,'b');qb(b,-w*.12,h+.2,d*.08,.7,.03,.7,M.hull2,'b');b.tube([-w*.26,h+.5,-d*.26],[-w*.26+.6,h+.5,-d*.26],.03,M.bare,{n:3});b.halo(-w*.26,h+1.05,-d*.26,.8,0xff3048,.9);
  b.detail(()=>steps(b,[0,0,-d*.42],[0,fy-.3,-d*.3],.7,M.bare));qb(b,0,fy-.34,-d*.3,1.1,.06,1.1,M.gold,'t');qb(b,0,fy+.5,d*.48+.03,.9,.1,.04,M.cyan,'kb');}
},{aoH:4,aoMin:.6});

// ------------------------------------------------------------------ frontier-gate ---------------------------------------
// A frontier gate tower (pairs of them flank a road): a tapered armoured pylon (footprint 3.6, top at o.h = 9) with a lit
// cyan cap band and two cyan cap lights, and a barrier-arm housing on the front (+z) with its striped arm raised: a small
// red warning beacon on the arm's tip. No amber: that is the settlers' light.
WK.model('frontier-gate',(b,o)=>{const {pal,mat}=b.k,M=pal.mil,hi=b.hi,h=o.h||9,sink=o.sink??1,R=(s,y,ch=.5)=>rc(b,s,s,y,hi?ch:0),red=mat(0xb8322a,'paint',.3,0);
 b.bev(0,-sink,0,3.6,sink+1.2,3.6,M.hull2,{ch:.2});
 b.loft([R(3,1.2),R(2.78,h*.44)],M.hull,{top:false});b.loft([R(2.9,h*.44,.5),R(2.9,h*.48,.5)],M.hull2,{top:false});b.loft([R(2.74,h*.48),R(2.44,h*.73)],M.plate,{top:false});
 b.loft([R(2.44,h*.73),R(2.9,h*.76),R(2.9,h*.9-.16)],M.hull2,{top:false});b.loft([R(2.96,h*.9-.16),R(2.96,h*.9)],M.gold,{top:false});b.loft([R(2.98,h*.9),R(2.98,h*.9+.2)],M.cyan,{top:false});b.loft([R(2.9,h*.9+.2),R(2.2,h)],M.hull,{top:true,topMat:M.plate2});
 for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;rad(b,a,0,0,q=>q.loft([rc(q,.6,.6,1.1,0,0,1.86),rc(q,.4,.3,h*.74,0,0,1.52)],M.hull2,{top:false}));}
 for(const s of [-1,1]){b.cyl(s*.7,h,0,.16,.14,M.hull2,{n:6});b.gem(s*.7,h+.26,0,.15,.14,.15,M.cyan);b.halo(s*.7,h+.26,0,.8,0x22e6ff,.3);}
 // faces: a lit vision slit, plate, hazard band
 for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>{qb(q,0,h*.8,1.46,1.5,.34,.04,M.dark,'kb');qb(q,0,h*.8+.08,1.49,1.2,.14,.03,M.ice,'kb');if(hi&&k)q.at(0,0,1.44,0,p=>p.bev(0,1.7,0,1.7,2,.12,M.plate2,{ch:.06}),-.04);});
 if(hi){const rib=mat(0x1b2436,'metal',.2,0),y0=h*.49,y1=h*.72,sl=(1.37-1.22)/(h*.25);for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>q.at(0,y0,1.365,0,p=>{for(const x of [-.72,-.24,.24,.72])qb(p,x,0,.03,.15,y1-y0,.09,rib,'kb');},-sl));}
 // the barrier: housing, pivot, the raised arm with its tip light
 b.bev(0,1.2,1.92,1.8,1.3,.9,M.hull2,{ch:.1});qb(b,0,1.3,2.38,1.5,.3,.03,M.hazard,'kb');
 b.bev(.55,1.6,2.14,.5,.5,.5,M.trim,{ch:.08});for(let k=0;k<6;k++)qb(b,.55,2.1+k*.82,2.2,.2,.82,.2,k%2?M.plate:red,'tb');b.gem(.55,h*.78+.1,2.2,.13,.15,.13,M.red);b.halo(.55,h*.78+.1,2.2,.6,0xff3048,.5);
 if(hi){hazard(b,0,1.26,2.385,1.5,.34,5);qb(b,-.5,2.5,2.0,.3,.2,.3,M.cyan,'b');b.at(0,0,-1.5,Math.PI,q=>{q.bev(0,1.2,.02,1.1,2.1,.14,M.hull2,{ch:.06});qb(q,0,3.36,.1,.8,.1,.05,M.ice,'kb');});b.tube([-.9,h,-.6],[-.9,h+.4,-.6],.03,M.bare,{n:3});}
},{aoH:3,aoMin:.6});

// ================================================================== the terraformers' works =============================
// ------------------------------------------------------------------ atmo-pylon ------------------------------------------
// An atmosphere pylon (15.2 m): hex plinth with cyan pads on alternate faces and six pale ceramic fins, a stout tapering
// mast (gunmetal foot, pale ceramic above), three emitter rings at 5 / 9 / 12.6 m and a glowing crown at 14.4.
WK.model('atmo-pylon',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,X=(r,y)=>ngon(b,6,r,y),em=glow(0x22e6ff,1.3),rM=y=>.58-.22*(y-.9)/12.7;
 b.loft([X(1.7,-.6),X(1.7,.5)],M.hull2,{top:false});b.loft([X(1.76,.5),X(1.76,.64)],(q,i)=>i%2?M.cyan:M.hull2,{top:false});b.loft([X(1.7,.64),X(1.5,.74),X(.8,.96)],M.hull,{top:false});
 b.loft([X(.8,.9),X(.72,3.5),X(rM(3.7),3.7)],M.hull2,{top:false});b.loft([X(rM(3.7),3.7),X(rM(13.6),13.6)],M.plate,{top:false});
 for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6;rad(b,a,0,0,q=>q.loft([rc(q,.26,1,.74,0,0,1.02),rc(q,.2,.5,3.7,0,0,.82)],M.plate,{top:true}));}
 for(const y of [5,9,12.6]){const R=1.1-y*.03,r=rM(y);if(hi)b.loft([X(r+.1,y-.3),X(r+.1,y+.3)],M.hull2,{top:false});
  if(hi)b.ring(0,y,0,R,em,{t:1.9});else hoop(b,y-.16,R-.1,R+.1,.32,8,em,{noBot:true,noIn:true});
  for(let k=0;k<3;k++){const a=k*TAU/3+y;b.tube([Math.cos(a)*r,y-.2,Math.sin(a)*r],[Math.cos(a)*R,y,Math.sin(a)*R],.08,M.trim,{n:3});if(hi)b.gem(Math.cos(a)*(R+.08),y,Math.sin(a)*(R+.08),.1,.2,.1,M.gold,-a);}}
 // the crown: a cup, gold claws, the glowing core
 b.loft([X(rM(13.6),13.6),X(.56,13.86),X(.56,14)],M.hull2,{top:true});b.ball(0,14.4,0,.55,glow(0xa8f8ff,1.8),!hi);b.halo(0,14.4,0,3.4,0x5cf2ff,.45);
 if(hi){for(let k=0;k<3;k++){const a=k*TAU/3+.5;b.tube([Math.cos(a)*.5,13.9,Math.sin(a)*.5],[Math.cos(a)*.64,14.7,Math.sin(a)*.64],.06,M.gold,{n:3});}
  gearBox(b,0,.72,1.12,.9,.8,.5,M.cyan);b.detail(()=>{b.cable([.3,1.5,1.2],[.2,4.4,.4],-.25,.06,M.dark);});}
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ dam -------------------------------------------------
// The terraformers' dam. o.w = length along x, o.h = base (y = 0) to crest, o.d = 4 (art within z +-2.5), o.sink below the
// base. The reservoir is on -z (vertical face, the cyan crest light, a row of pads, on that edge); the downstream face (+z)
// is battered: a concrete lower lift, a pale ceramic upper lift, dark buttress piers every 10 m with a slim rib between
// them, two spillway gates beside the centre under hoist housings, pale cap plates along the crest, the control hut on the
// crest (it stands 3.4 m above o.h), rails, gold-crowned abutments, and an access stair in the last bay toward +x.
WK.model('dam',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,N=pal.nat,hi=b.hi,W=o.w||66,H=o.h||9,sink=o.sink??2,hc=H-.5,yl=hc*.55,zf=y=>1.7-.6*Math.max(0,Math.min(1,y/hc)),np=Math.max(1,Math.floor((W-8)/10)+1),px=i=>(i-(np-1)/2)*10,
  g0=np%2?5:10,gates=np>=3?[[-g0,1],[g0,0]]:[],atGate=x=>gates.some(g=>Math.abs(x-g[0])<3.3),atStair=x=>np>=2&&x>px(np-1)-9.4&&x<px(np-1);
 // body: a concrete lower lift, a dark ledge, the pale ceramic upper lift, the crest slab with the walkway
 const B=(y,z1)=>rc(b,W,z1+2,y,0,0,(z1-2)/2);b.loft([B(-sink,zf(-sink)),B(yl,zf(yl))],M.conc,{top:false});b.loft([B(yl,zf(yl)+.14),B(yl+.3,zf(yl)+.14)],M.hull2,{top:false});b.loft([B(yl+.3,zf(yl+.3)),B(hc,zf(hc))],M.plate2,{top:false});
 b.loft([rc(b,W,3.9,hc,0,0,-.35),rc(b,W,3.9,H,0,0,-.35)],M.hull2,{top:true,topMat:M.hull});qb(b,0,H,-2.18,W-1.2,.1,.22,M.hull2,'b');
 // the walkway rails: chunky two-bar rails on both edges of the crest
 if(hi)b.detail(()=>{for(const z of [1.45,-1.9])b.rail([[-W/2+2.6,H,z],[W/2-2.6,H,z]],1.1,M.bare,{step:3.3,r:.11});});
 // buttress piers with a pale cap; on both sides of each: a pale cap plate on the crest, a cyan pad on the reservoir
 // edge, a bevelled ceramic panel on the upper lift (not over a gate or the stair)
 for(let i=0;i<np;i++){const x=px(i);b.loft([rc(b,1.8,1.1,-sink,hi?.12:0,x,1.95),rc(b,1.4,.8,hc,hi?.1:0,x,1.42),rc(b,1.4,.8,H+.3,hi?.1:0,x,1.42)],M.hull2,{top:true,topMat:M.plate});
  if(hi)qb(b,x,H-1.1,1.83,.22,.6,.03,M.ice,'kb');
  for(const e of [-1,1]){const xc=x+e*2.5;if(Math.abs(xc)+2<W/2-2.4){if(hi)qb(b,xc,H,-.3,3.9,.06,2.8,M.plate,'b');else b.quad([xc-1.95,H+.04,-1.7],[xc+1.95,H+.04,-1.7],[xc+1.95,H+.04,1.1],[xc-1.95,H+.04,1.1],M.plate,[xc,0,0]);
    qb(b,xc,H+.1,-2.18,2.2,.08,.2,M.cyan,hi?'b':'blr');
    if(hi&&!atGate(xc)&&!atStair(xc))b.at(xc,yl+.55,zf(yl+.55)+.03,0,q=>q.bev(0,0,0,3.7,hc-yl-1.1,.16,M.plate,{ch:.08}),-.6/hc);}}}
 // a slim rib half-way between piers on the upper lift
 for(let i=0;i<np-1;i++){const x=px(i)+5;if(atGate(x)||atStair(x))continue;b.loft([rc(b,.8,.6,yl+.3,0,x,zf(yl+.3)+.2),rc(b,.7,.44,hc,0,x,zf(hc)+.14)],M.hull2,{top:false});}
 // the reservoir face (-z; in the world the water stands 1.6 m under the crest): behind every pier a sloped buttress 60% of
 // the crest height with a pilaster and a level light above it; two outflow pipe stubs, each under a cyan marker bar and a
 // cyan gauge strip that runs up to the crest (the part that shows above the water)
 {const yb=H*.6;for(let i=0;i<np;i++){const x=px(i);
   b.loft(hi?[rc(b,3.4,.5,-sink,0,x,-2.23),rc(b,2.5,.5,yb*.4,0,x,-2.23),rc(b,1.2,.04,yb,0,x,-2)]:[rc(b,3.4,.5,-sink,0,x,-2.23),rc(b,1.2,.04,yb,0,x,-2)],M.hull2,{top:false});
   qb(b,x,yb-.2,-2.08,.9,hc-yb+.2,.16,M.hull2,hi?'tbf':'tbflr');if(hi)qb(b,x,H-1.2,-2.17,.24,.5,.03,M.ice,'tbflr');}
  const pr=Math.min(.75,H*.085),py=H*.3,pn=hi?8:6,my=py+pr*1.3+.2;
  for(const x of np>=3?[5-px(np-1),px(np-1)-5]:np===2?[0]:[]){b.tube([x,py,-1.9],[x,py,-2.5],pr,M.plate2,{n:pn});b.tube([x,py,-2.1],[x,py,-2.46],pr*.78,M.dark,{n:pn,caps:true});
   if(hi)b.tube([x,py,-1.95],[x,py,-2.16],pr*1.3,M.hull2,{n:pn,caps:true});
   qb(b,x,my,-2.04,1.5,.2,.08,M.cyan,hi?'f':'ftblr');for(let y=my+.75,k=0;y<hc-.4;y+=.75,k++)qb(b,x,y,-2.03,k%2?.9:.5,.14,.06,M.cyan,'ftblr');}}
 // abutment blocks at both ends: a pale ceramic shoulder, a gold crown band, a pale cap
 for(const s of [-1,1]){const x=s*(W/2-1.17);b.bev(x,-sink,-.1,2.4,H+sink+.5,4.6,M.hull,{ch:.16});b.loft([rc(b,2.46,4.66,H-1.5,0,x,-.1),rc(b,2.46,4.66,H+.12,0,x,-.1)],M.plate,{top:false});b.loft([rc(b,2.5,4.7,H+.24,0,x,-.1),rc(b,2.5,4.7,H+.42,0,x,-.1)],M.gold,{top:false});
  b.bev(x,H+.5,-.1,1.9,.24,4,M.plate,{ch:.08});qb(b,x,H*.42,2.21,.3,H*.3,.03,M.cyan,'kb');if(hi){b.at(x,0,2.2,0,q=>hazard(q,0,.6,.02,2,1,4));qb(b,x,H+.74,-.1,.5,.1,2.4,M.white,'b');}}
 // spillway gates: a dark throat, the steel leaf, a chute down the face, the hoist housing on the crest
 for(const [gx,open] of gates){const gy=hc-3.5,gw=6;qb(b,gx,gy,zf(gy+1.7)+.03,gw,3.4,.06,M.dark,'kb');
  b.at(gx,0,0,0,q=>{const z0=zf(gy)+.1,lift=open?1.1:0;q.bev(0,gy+lift,z0,gw-.5,3-lift*.4,.2,M.plate2,{ch:.07});if(hi)for(let k=0;k<3;k++)qb(q,0,gy+lift+.5+k*.8,z0+.11,gw-.9,.14,.08,M.hull2,'kb');
   q.quad([-gw/2,gy,zf(gy)+.04],[gw/2,gy,zf(gy)+.04],[gw/2,-sink,zf(-sink)+.4],[-gw/2,-sink,zf(-sink)+.4],M.plate,[0,gy/2,-3]);for(const s of [-1,1])q.quad([s*gw/2,gy+.5,zf(gy)+.04],[s*gw/2,gy,zf(gy)+.44],[s*gw/2,-sink,zf(-sink)+.78],[s*gw/2,-sink,zf(-sink)+.4],M.hull2,[s*(gw/2-1),0,0]);
   if(open)q.quad([-gw/2+.4,gy+.9,zf(gy)+.12],[gw/2-.4,gy+.9,zf(gy)+.12],[gw/2-.4,-sink,zf(-sink)+.48],[-gw/2+.4,-sink,zf(-sink)+.48],N.ice,[0,gy/2,-3]);
   for(const s of [-1,1]){q.bev(s*2.5,H,.2,.5,2.3,.6,M.hull,{ch:.08});if(hi)q.tube([s*1.5,gy+lift+2.8,z0],[s*1.5,H+2.2,.2],.09,M.bare,{n:4});}
   q.bev(0,H+2.3,.2,5.9,.5,1,M.hull2,{ch:.1});if(hi)gearBox(q,0,H+2.8,.2,1.6,.8,.9,open?M.cyan:M.red);else qb(q,0,H+2.8,.2,1.6,.8,.9,M.hull2,'b');qb(q,0,H+2.36,.72,1.6,.1,.04,M.cyan,'kb');});}
 // the control hut over the centre
 b.at(0,H,-.25,0,q=>{q.bev(0,0,0,3.4,1.2,2.6,M.hull,{ch:.1});q.bev(0,1.2,0,3.3,1.2,2.5,M.plate,{ch:.1});q.bev(0,2.4,0,3.8,.24,3,M.hull2,{ch:.08});for(const f of [1,-1])qb(q,0,1.36,f*1.26,2.5,.7,.03,M.ice,'tb'+(f>0?'k':'f'));
  q.tube([1.2,2.64,-.9],[1.2,3.9,-.9],.05,M.trim,{n:4});q.gem(1.2,3.96,-.9,.1,.1,.1,M.red);if(hi){airUnit(q,-.8,2.64,.2,.7);for(const f of [1,-1])for(const x of [-.62,.62])qb(q,x,1.36,f*1.28,.08,.7,.03,M.hull2,'tb'+(f>0?'k':'f'));qb(q,1.72,.1,0,.05,1.9,.9,glow(0x22e6ff,.7),'tbl');q.halo(1.2,3.96,-.9,.8,0xff3048,.8);}});
 // the access stair: two flights in the last bay toward +x
 if(np>=2){const xa=px(np-1)-1.3,xb=xa-(hi?6.4:6.4),rise=hc/2,st=hi?Math.max(4,Math.round(rise/.5)):0,P=(t,f)=>{const y=f?rise+rise*t:rise*t,x=f?xb+(xa-xb)*t:xa+(xb-xa)*t;return [x,y,zf(y)+.44];};
  for(const f of [0,1]){const a=P(0,f),c=P(1,f);for(const dz of [-.34,.34])b.quad([a[0],a[1]-.3,a[2]+dz],[c[0],c[1]-.3,c[2]+dz],[c[0],c[1],c[2]+dz],[a[0],a[1],a[2]+dz],M.hull2,[(a[0]+c[0])/2,(a[1]+c[1])/2-.15,(a[2]+c[2])/2]);
   for(let k=0;k<st;k++){const p=P((k+.5)/st,f);qb(b,p[0],p[1]-.06,p[2],Math.abs(xa-xb)/st,.08,.68,M.trim,'bfk');}
   if(hi)b.detail(()=>b.tube([a[0],a[1]+.95,a[2]+.32],[c[0],c[1]+.95,c[2]+.32],.07,M.bare,{n:3}));else b.quad([a[0],a[1],a[2]-.34],[c[0],c[1],c[2]-.34],[c[0],c[1],c[2]+.34],[a[0],a[1],a[2]+.34],M.trim,[0,-9,0]);}
  const m=P(1,0);qb(b,xb-.7,m[1]-.1,m[2],1.4,.1,.7,M.trim,'');const e=P(1,1);qb(b,xa+.5,e[1]-.1,e[2]-.1,1,.1,1,M.trim,'');if(hi)for(const p of [m,P(0,0)])b.tube([xb-1.3,-sink,p[2]+.26],[xb-1.3,m[1]-.1,m[2]+.26],.09,M.trim,{n:4});}
},{aoH:5,aoMin:.6});

// ------------------------------------------------------------------ creek-bridge ----------------------------------------
// The creek road bridge. o.w = span along x, o.d = deck width (6.8), o.prof = n + 1 deck heights along the span from
// x = -o.w / 2 to +o.w / 2 (relative to y = 0; default: a gentle 1.2 m arch). The deck's top surface is AT the profile,
// 0.42 thick; pale ceramic side girders with kerbs, a braced rail with a cyan light line at z = +-o.d / 2, lamp pylons and abutments at
// both ends, two piers down to y = -3.
WK.model('creek-bridge',(b,o)=>{const {pal}=b.k,M=pal.mil,hi=b.hi,W=o.w||18,D=o.d||6.8,hd=D/2,prof=Array.isArray(o.prof)&&o.prof.length>1?o.prof:Array.from({length:13},(_,i)=>+(1.2*Math.sin(i/12*Math.PI)).toFixed(3)),n=prof.length-1,X=i=>-W/2+W*i/n,
  Y=x=>{const t=Math.max(0,Math.min(n-1e-6,(x+W/2)/W*n)),i=Math.floor(t);return prof[i]+(prof[i+1]-prof[i])*(t-i);};
 for(let i=0;i<n;i++){const x0=X(i),x1=X(i+1),y0=prof[i],y1=prof[i+1],ym=(y0+y1)/2,Q=(a0,z0,a1,z1,m,ins)=>b.quad([x0,y0+a0,z0],[x1,y1+a0,z0],[x1,y1+a1,z1],[x0,y0+a1,z1],m,ins);
  Q(0,-hd,0,hd,M.hull2,[0,ym-9,0]);Q(-.42,-hd,-.42,hd,M.dark,[0,ym+9,0]);
  for(const s of [-1,1]){const zo=s*(hd+.16),zi=s*(hd-.16),c=[(x0+x1)/2,ym-.4,s*hd];Q(-.95,zo,.16,zo,M.plate2,c);Q(.16,zi,.16,zo,M.plate,c);Q(0,zi,.16,zi,M.trim,c);Q(-.95,zi,-.95,zo,M.dark,c);if(hi)Q(-.95,zi,-.42,zi,M.hull2,c);
   // the rail: posts, the top chord, the cyan line, a diagonal
   const z=s*hd,skip=!hi&&i%2;if(!skip)qb(b,x0,y0+.16,z,.16,.94,.16,M.hull2,'tb');if(i===n-1)qb(b,x1,y1+.16,z,.16,.94,.16,M.hull2,'tb');
   b.tube([x0,y0+1.1,z],[x1,y1+1.1,z],.075,M.trim,{n:hi?4:3});b.tube([x0,y0+.66,z],[x1,y1+.66,z],.05,M.cyan,{n:3});
   if(hi)b.tube(i%2?[x0,y0+.2,z]:[x0,y0+1.05,z],i%2?[x1,y1+1.05,z]:[x1,y1+.2,z],.04,M.trim,{n:3});}
  if(hi){qb(b,x0,y0-.78,0,.3,.36,D-.3,M.hull2,'tfk');if(i%2===0)b.quad([x0+W/n*.2,ym+.012,-.1],[x1-W/n*.2,ym+.012,-.1],[x1-W/n*.2,ym+.012,.1],[x0+W/n*.2,ym+.012,.1],M.plate2,[0,ym-9,0]);}}
 // abutments and lamp pylons at both ends
 for(const s of [-1,1]){const x=s*(W/2-.7),ye=prof[s<0?0:n];b.loft([rc(b,1.8,D+.3,-3,0,s*(W/2-.9)),rc(b,1.4,D+.3,ye-.44,0,x)],M.conc,{top:true});
  for(const sz of [-1,1]){const z=sz*(hd-.03);if(hi){b.bev(s*(W/2-.26),ye-.44,z,.5,2.1,.46,M.hull2,{ch:.07});qb(b,s*(W/2-.26),ye+1.66,z,.36,.14,.34,M.white,'b');b.bev(s*(W/2-.26),ye+1.8,z,.44,.08,.42,M.hull,{ch:.03});hazard(b,s*(W/2-.26),ye+.1,z+.235,.48,.6,3);b.halo(s*(W/2-.26),ye+1.75,z,.9,0xa8f8ff,.35);}
   else{qb(b,s*(W/2-.26),ye-.44,z,.5,2.1,.46,M.hull2,'b');qb(b,s*(W/2-.26),ye+1.66,z,.4,.14,.38,M.white,'b');}}}
 // piers: twin columns under a cap beam, on a footing
 for(const t of [1/3,2/3]){const x=-W/2+W*t,yt=Y(x)-.96;qb(b,x,yt-.5,0,.8,.5,D-.4,M.hull2,'t');for(const s of [-1,1]){b.cyl(x,-3,s*(hd-1.2),.42,yt+2.5,M.hull,{n:hi?6:4,r2:.36,top:false});if(hi){b.cyl(x,yt-1.6,s*(hd-1.2),.46,.3,M.cyan,{n:6,top:false});}}
  if(hi){b.bev(x,-3,0,1.5,.7,D-.2,M.conc,{ch:.12});b.tube([x,-2,hd-1.2],[x,yt-.6,-hd+1.2],.07,M.trim,{n:3});b.tube([x,-2,-hd+1.2],[x,yt-.6,hd-1.2],.07,M.trim,{n:3});}}
},{aoH:.01,aoMin:.85});

// ------------------------------------------------------------------ ice-rig ---------------------------------------------
// The ice-mining drill rig (5 x 5, 9.6 m): skids and a pale deck, a four-leg lattice derrick (two bays of stout struts, one
// diagonal a face, gusset blocks: thin lattices turn to moire on a phone), the glowing drill string through a rotary
// table, a travelling block, the crown block and winch, a motor housing with its stack, a mud tank, hoses.
WK.model('ice-rig',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,sink=o.sink??.5;
 for(const s of [-1,1])b.bev(0,-sink,s*1.95,4.7,sink+.32,.56,M.hull2,{ch:.1});for(const x of [-1.9,0,1.9])qb(b,x,.02,0,.4,.26,3.4,M.hull2,'b');qb(b,0,.28,0,3.9,.1,3.5,M.plate2,'b');
 lattice(b,0,.38,0,3.3,.95,7.8,2,M.trim,{r:.17,leg:M.hull,gusset:M.plate});
 for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])qb(b,sx*1.65,.38,sz*1.65,.62,.2,.62,M.plate,'b');
 // the drill string, rotary table and travelling block
 b.tube([0,-sink,0],[0,5,0],.15,glow(0x22e6ff,1),{n:hi?6:4});b.tube([0,5.8,0],[0,8.2,0],.11,M.bare,{n:4});b.cyl(0,.38,0,.74,.34,M.hull2,{n:hi?10:6,bev:.06});
 b.bev(0,5,0,.9,.84,.74,M.plate2,{ch:.1});if(hi){b.cyl(0,.72,0,.4,.2,M.gold,{n:8});qb(b,0,5.3,.38,.5,.24,.03,M.hazard,'kb');b.halo(0,2.6,0,1.5,0x9ff6ff,.22);}
 // the crown block, the winch drum, the beacon
 b.bev(0,8.18,0,1.5,.5,1.5,M.hull2,{ch:.1});b.tube([-.5,8.95,0],[.5,8.95,0],.26,M.plate,{n:hi?8:5,caps:true});for(const s of [-1,1])qb(b,s*.6,8.68,0,.12,.56,.6,M.hull,'b');
 b.tube([0,8.68,-.55],[0,9.5,-.55],.05,M.trim,{n:3});b.gem(0,9.5,-.55,.1,.1,.1,M.red);
 // the motor housing with its stack, the mud tank, hoses, work lights
 gearBox(b,-1.1,.38,-1.25,1.5,1.25,1,M.cyan);b.cyl(-1.6,1.63,-1.4,.14,1.5,M.dark,{n:6});canister(b,1.25,.38,-1.2,.52,1.8,M.plate);
 if(hi){b.cyl(-1.6,3.13,-1.4,.19,.1,M.bare,{n:6});b.cable([-.5,1.4,-.9],[0,.9,-.3],.3,.08,M.dark,{n:4});b.cable([1.25,1.9,-.8],[.5,3.6,.1],-.5,.08,M.dark,{n:4});
  for(const s of [-1,1]){qb(b,s*.9,5.9,.95,.4,.14,.26,M.hull2,'b');qb(b,s*.9,5.86,.98,.3,.04,.18,M.white,'t');}b.halo(0,5.8,1,1.1,0xe8f6ff,.28);
  // the monkey board at the mid ring: a platform with a solid ceramic parapet (no hairline rails)
  qb(b,0,4.36,1.5,2.1,.1,.8,M.hull,'');for(const s of [-1,1])qb(b,s*1,4.46,1.5,.08,.5,.8,M.plate2,'b');qb(b,0,4.46,1.86,2.08,.5,.08,M.plate2,'b');
  hazard(b,0,.1,2.235,3.6,.2,9);}
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ rail-pylon ------------------------------------------
// A monorail pylon: footing with four pale ceramic buttress fins, a tapering octagonal column (gunmetal below a collar with
// cyan pads, pale ceramic above it), a flared head with a pale rim (the same from every side, so it needs no heading).
// The column is o.h long in all (12.2): it starts o.sink (1) below y = 0, the head's top is at y = o.h - o.sink.
WK.model('rail-pylon',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,sink=o.sink??1,Y=(o.h||12.2)-sink,n=hi?8:6,X=(r,y)=>ngon(b,n,r,y,Math.PI/n),yc=Y*.5,rA=y=>.8-.2*y/(Y-1.5);
 if(hi)b.loft([X(1.08,-sink),X(1.08,.36),X(.86,.52)],M.hull2,{top:false});else b.loft([X(1.08,-sink),X(.9,.52)],M.hull2,{top:false});
 b.loft([X(rA(.5),.5),X(rA(yc-.4),yc-.4)],M.hull,{top:false});if(hi){b.loft([X(rA(yc)+.02,yc-.4),X(rA(yc)+.14,yc-.3),X(rA(yc)+.14,yc-.14)],M.hull2,{top:false});b.loft([X(rA(yc)+.14,yc+.14),X(rA(yc)+.14,yc+.3),X(rA(yc)+.02,yc+.4)],M.hull2,{top:false});}
 b.loft([X(rA(yc)+.17,yc-.14),X(rA(yc)+.17,yc+.14)],(q,i)=>i%2?M.cyan:M.hull2,{top:false});b.loft([X(rA(yc+.4),yc+(hi?.4:.14)),X(.6,Y-1.5)],M.plate,{top:false});
 b.loft([X(.6,Y-1.5),X(1.04,Y-.4),X(1.08,Y-.34),X(1.08,Y)],r=>r===2?M.plate2:M.hull2,{top:true,topMat:M.trim});
 for(let k=0;k<4;k++){const a=k*Math.PI/2;rad(b,a,0,0,q=>q.loft([rc(q,.34,.56,.3,0,0,.96),rc(q,.24,.1,3.6,0,0,rA(3.6)*.92+.03)],M.plate,{top:false}));if(hi)rad(b,a,1,Y-.26,q=>qb(q,0,0,0,.4,.12,.03,M.white,'kb'));}
},{aoH:3,aoMin:.62});

// ------------------------------------------------------------------ rail-beam -------------------------------------------
// One span of the monorail beam: o.w long along x, the guide rail's top at y = 0. A box girder (0.9 wide, 1 deep) under a
// pale ceramic top flange (1.36 wide: the train's skirts clear it), the guide rail on top, stiffener ribs, a pale bottom
// lip and small cyan under-lights (pads under the flange and on the soffit); on HIGH a deep rib under mid-span, a dark
// conduit down each side and a pale bracket under each end. No end faces: spans chain. About 190 / 24.
WK.model('rail-beam',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,L=o.w||8,x0=-L/2,x1=L/2,P=(xa,xb,y0,z0,y1,z1,m,ins)=>b.quad([xa,y0,z0],[xb,y0,z0],[xb,y1,z1],[xa,y1,z1],m,ins),Q=(y0,z0,y1,z1,m,ins)=>P(x0,x1,y0,z0,y1,z1,m,ins);
 Q(0,-.17,0,.17,M.bare,[0,-1,0]);Q(-.14,-.68,-.14,.68,M.plate,[0,-1,0]);Q(-1.3,-.45,-1.3,.45,M.hull,[0,0,0]);   // a gunmetal soffit on HIGH too: near-black, it was a black band across the sky from below
 for(const s of [-1,1]){Q(-.36,s*.68,-.14,s*.68,M.plate,[0,-.2,0]);Q(-1.3,s*.45,-.36,s*.45,M.hull,[0,-.8,0]);Q(-.36,s*.45,-.36,s*.68,M.hull2,[0,0,s*.5]);
  for(const x of hi?[-L/4,L/4]:[0])P(x-.5,x+.5,-.6,s*.462,-.44,s*.462,M.cyan,[0,-.5,0]);
  if(hi){Q(-.14,s*.17,0,s*.17,M.bare,[0,-.1,0]);Q(-1.3,s*.53,-1.14,s*.53,M.plate2,[0,-1.2,0]);for(const x of [-L/2+.3,0,L/2-.3])P(x-.13,x+.13,-1.14,s*.51,-.36,s*.51,M.hull2,[x,-.8,0]);}}
 if(hi){for(const x of [-L/4,L/4])P(x-.4,x+.4,-1.31,-.2,-1.31,.2,M.cyan,[0,0,0]);
  // close up it was a plain box (critic round 3): a deep rib under mid-span, a dark conduit with clips down each side and a
  // pale bracket block under each end, where the span sits on its pylon head
  const rib=b.k.mat(0x3a4352,'metal',.3,0),duct=b.k.mat(0x20283a,'metal',.2,0);qb(b,0,-1.6,0,.3,.3,.98,rib,'t');
  for(const s of [-1,1]){b.tube([x0,-.92,s*.5],[x1,-.92,s*.5],.075,duct,{n:4});for(const x of [-L*.375,-L*.125,L*.125,L*.375])qb(b,x,-1.02,s*.5,.12,.2,.2,M.plate2,'');}
  for(const e of [-1,1])qb(b,e*(L/2-.3),-1.58,0,.6,.28,1.24,M.plate2,'t');}
},{aoH:.01,aoMin:.9});

// ------------------------------------------------------------------ rail-train ------------------------------------------
// The colony monorail: three cars along +x (centres at x = 0, 7.4, 14.8), y = 0 = the rail top they ride on. Each car is
// 7 x 2.6 x 2.6 (skirts hang to -0.3 beside the beam): a rounded-bevel body in pale plate with a warm lit window band, a
// cyan stripe, bogie covers, roof units; gangways between the cars; a tapered nose with a white light at both ends.
WK.model('rail-train',(b0,o)=>b0.at(-7.4,0,0,0,b=>{const {pal,glow,tint}=b.k,M=pal.mil,hi=b.hi,warm=glow(0xffc47a,.8),HP=[[.12,.78],[-.3,.78],[-.3,1.2],[.3,1.3],[.95,1.3],[1.1,1.3],[1.25,1.3],[1.95,1.24],[2.35,1.05],[2.6,.6]],
  sec=(x,sz=1,sy=1)=>({p:HP.map(([y,z])=>[-(y<.3?y:.3+(y-.3)*sy),z*(y<.3?Math.min(1,sz+.08):sz)]).concat(HP.slice().reverse().map(([y,z])=>[-(y<.3?y:.3+(y-.3)*sy),-z*(y<.3?Math.min(1,sz+.08):sz)])),y:x}),
  mats=[M.hull2,M.hull2,M.hull2,M.plate,M.cyan,M.plate,hi?M.glassDark:warm,M.plate,M.plate2,M.hull],mf=(r,i)=>i<0?M.hull2:i===19?M.dark:mats[i<10?i:18-i];
 for(let c=0;c<3;c++){const cx=c*7.4,first=c===0,last=c===2;
  alongX(b,cx,0,0,q=>{const R=[];if(first)R.push(sec(-3.5,.56,.6),sec(-3.05,.86,.9),sec(-2.3,1,1));else{if(hi)R.push(sec(-3.5,.94,.97));R.push(sec(hi?-3.36:-3.5,1,1));}
   if(last)R.push(sec(2.3,1,1),sec(3.05,.86,.9),sec(3.5,.56,.6));else{R.push(sec(hi?3.36:3.5,1,1));if(hi)R.push(sec(3.5,.94,.97));}
   q.loft(R,mf,{top:true,bot:true,topMat:last?M.glassDark:M.hull2});});
  if(hi){for(const s of [-1,1]){const W=(x0,x1,m,y0=1.33,y1=1.87)=>b.quad([cx+x0,y0,s*(1.3-(y0-1.25)*.086+.015)],[cx+x1,y0,s*(1.3-(y0-1.25)*.086+.015)],[cx+x1,y1,s*(1.3-(y1-1.25)*.086+.015)],[cx+x0,y1,s*(1.3-(y1-1.25)*.086+.015)],m,[cx,1.6,0]);
    for(const x of [-2.15,-1.3,1.3,2.15])if(!(first&&x<-2)&&!(last&&x>2))W(x-.36,x+.36,warm);for(const x of [-.32,.32])W(x-.2,x+.2,warm,1.4,1.84);
    b.quad([cx-.68,.36,s*1.315],[cx+.68,.36,s*1.315],[cx+.68,1.22,s*1.315],[cx-.68,1.22,s*1.315],M.plate2,[cx,1,0]);b.quad([cx-.03,.36,s*1.32],[cx+.03,.36,s*1.32],[cx+.03,1.22,s*1.32],[cx-.03,1.22,s*1.32],M.hull2,[cx,1,0]);
    for(const x of [-2.2,2.2]){b.at(cx+x,-.24,s*1.24,0,p=>p.bev(0,0,0,1.7,.56,.14,M.hull,{ch:.05}));qb(b,cx+x,-.07,s*1.325,.3,.22,.03,M.gold,'tb');}
    b.quad([cx-2.9,2.602,s*.62],[cx+2.9,2.602,s*.62],[cx+2.9,2.602,s*.52],[cx-2.9,2.602,s*.52],M.cyan,[cx,0,s*.57]);}
   for(const x of [-1.6,1.6])b.bev(cx+x,2.6,0,1.5,.1,.86,M.plate,{ch:.04});b.bev(cx,2.6,0,.7,.08,.5,M.hull2,{ch:.03});}
  if(!last)qb(b,cx+3.7,.2,0,.42,2.2,2.1,M.dark,'lr');}
 // nose lights at both ends
 for(const [x,s] of [[-3.52,-1],[18.32,1]]){b.quad([x,.72,-.5],[x,.72,.5],[x,.9,.5],[x,.9,-.5],M.white,[x-s,0,0]);b.quad([x,1.35,-.56],[x,1.35,.56],[x,1.62,.56],[x,1.62,-.56],hi?M.glassDark:M.dark,[x-s,0,0]);if(hi){b.quad([x,.44,-.62],[x,.44,-.4],[x,.56,-.4],[x,.56,-.62],M.red,[x-s,0,0]);b.quad([x,.44,.62],[x,.44,.4],[x,.56,.4],[x,.56,.62],M.red,[x-s,0,0]);b.halo(x+s*.1,.82,0,1.2,0xe8f6ff,.6);}}
}),{aoH:.01,aoMin:.9});
})(typeof globalThis!=='undefined'?globalThis:window);
