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
 for(const k of [1,2,4,5]){onFace(k,7.3*C6,q=>{q.box(0,3.95,.03,5.2,1.15,.1,M.dark);q.box(0,4.14,.07,4.5,.7,.08,M.ice);if(hi){for(let j=-2;j<=2;j++)q.box(j*.9,4.1,.1,.07,.78,.1,M.dark);q.box(0,3.86,.14,5.4,.09,.22,M.trim);}});
  onFace(k,7.56*C6,q=>{if(hi){q.bev(0,1,.02,4.4,1.7,.14,M.plate2,{ch:.06});for(const sx of [-1,1])for(const sy of [0,1])q.box(sx*1.95,1.12+sy*1.34,.16,.1,.1,.04,M.bare);q.box(1.2,1.4,.17,1.3,.7,.04,M.dark);for(let j=0;j<4;j++)q.box(1.2,1.5+j*.15,.19,1.2,.04,.04,M.trim);}else q.box(0,1,.02,4.4,1.7,.1,M.plate2);});}
 // the airlock: frame, glowing door, header light, canopy, ramp with lit edges
 onFace(0,7.56*C6,q=>{q.bev(0,f0,.25,3.3,3.5,.6,M.hull2,{ch:.1});q.box(0,f0+.1,.56,2.2,2.9,.08,glow(0x22e6ff,.82));q.box(0,f0+3.1,.6,2.7,.13,.1,M.ice);
  if(hi){q.box(0,f0+.1,.6,.1,2.9,.08,M.dark);for(const sx of [-1,1]){q.box(sx*1.28,f0+.1,.6,.16,3,.12,M.gold);q.box(sx*1.75,f0+1.5,.5,.12,.5,.12,M.amber);}q.at(0,f0+3.7,.9,0,r=>r.bev(0,0,0,4,.22,1.5,M.trim,{ch:.06}),-.12);}
  else q.box(0,f0+3.7,.9,4,.2,1.4,M.trim);
  q.quad([-2.2,f0,.5],[2.2,f0,.5],[2.2,-.05,2.25],[-2.2,-.05,2.25],M.hull2,[0,-3,1]);q.quad([-2.2,-sink,2.25],[2.2,-sink,2.25],[2.2,-.05,2.25],[-2.2,-.05,2.25],M.conc,[0,0,0]);for(const sx of [-1,1]){q.quad([sx*2.2,-sink,.5],[sx*2.2,-sink,2.25],[sx*2.2,-.05,2.25],[sx*2.2,f0,.5],M.conc,[0,0,1.4]);if(hi)q.tube([sx*2.1,f0+.03,.55],[sx*2.1,-.02,2.2],.05,M.cyan,{n:3});}
  if(!hi)q.box(0,-.04,2.2,4.4,.07,.07,M.cyan);q.pool(0,.14,3.2,2.6,2.2,0x22e6ff,.3);});
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
    if(hi){q.box(0,2.72,ap(2.6)+2,.1,3.5,.06,M.dark);for(const s of [-1,1]){q.box(s*1.42,2.72,ap(2.6)+1.98,.18,3.6,.1,M.gold);hazard(q,s*1.72,2.7,ap(2.6)+1.97,.36,1.1,3);}}}
   else if(hi){q.bev(0,2.6,ap(2.6)+d0-.1,2,.9,.5,M.hull,{ch:.08});q.box(0,3.5,ap(3.5)+d0-.2,1.1,.3,.2,M.gold);}});
  // tanks on the deck between the buttresses, a plate panel on each face flank
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
  for(const t of [.25,.5,.75]){const x=-L/2+L*t;if(hi){q.loft([c(1.1,x-.32),c(1.4,x-.26),c(1.4,x-.1)],M.hull2,{smooth:true,top:false});q.loft([c(1.33,x-.1),c(1.33,x+.1)],M.cyan,{smooth:true,top:false});q.loft([c(1.4,x+.1),c(1.4,x+.26),c(1.1,x+.32)],M.hull2,{smooth:true,top:false});}
   else q.loft([c(1.1,x-.24),c(1.38,x),c(1.1,x+.24)],M.cyan,{smooth:true,top:false});}
  if(hi)for(const s of [-1,1])q.loft([c(1.1,s*(L/2-.34)),c(1.3,s*(L/2-.26)),c(1.3,s*L/2)],M.hull,{smooth:true,top:false});});
 b.tube([-L/2,1.27,.28],[L/2,1.27,.28],.2,M.bare,{n:hi?5:3});
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
 if(hi){b.at(.3,3.38,-.32,.5,q=>{q.cyl(0,0,0,.07,.24,M.trim,{n:5});q.at(0,.3,0,0,r=>r.cyl(0,0,0,.08,.2,M.plate,{n:8,r2:.36}),.7);});b.tube([-.58,3.24,-.5],[-.66,4.1,-.56],.025,M.bare,{n:3});b.tube([.58,3.24,-.5],[.64,3.9,-.56],.025,M.bare,{n:3});b.halo(0,2.3,.7,1.6,0xa8f8ff,.45);}
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
// on the +z edge, four legs to the ground (o.sink below it), braces, a torque tube and a junction box.
WK.model('refuge-solar',(b,o)=>{const {pal,tint}=b.k,M=pal.mil,hi=b.hi,w=o.w||14,d=o.d||9,tilt=o.tilt??.3,sink=o.sink??.5,c=Math.cos(tilt),s=Math.sin(tilt),P=(lx,ly,lz)=>[lx,2+ly*c-lz*s,ly*s+lz*c];
 b.at(0,2,0,0,q=>{if(hi)q.bev(0,-.2,0,w+.3,.2,d+.3,M.trim,{ch:.06,bot:true});else qb(q,0,-.2,0,w+.3,.2,d+.3,M.trim);
  const mw=(w-.1)/3,md=(d-.1)/2;if(hi)for(let i=0;i<3;i++)for(let j=0;j<2;j++)qb(q,(i-1)*mw,0,(j-.5)*md,mw-.16,.09,md-.16,M.navy,'b');else qb(q,0,0,0,w-.2,.07,d-.2,M.navy,'b');
  qb(q,0,.02,-d/2-.02,w-.3,.12,.14,M.cyan,'b');qb(q,0,.02,d/2+.02,w-.3,.09,.1,tint(M.cyan,.5),'b');
  if(hi){q.tube([-w/2+.3,-.42,0],[w/2-.3,-.42,0],.16,M.hull2,{n:6,caps:true});for(const sx of [-1,0,1])qb(q,sx*(w/2-.6),-.42,0,.14,.24,d-1,M.hull2,'t');}},tilt);
 for(const sx of [-1,1])for(const sz of [-1,1]){const t=P(sx*(w/2-.6),-.2,sz*(d/2-.6));b.cyl(t[0],-sink,t[2],.14,t[1]+sink,M.trim,{n:hi?6:4,top:false});if(hi)qb(b,t[0],-sink,t[2],.6,sink+.14,.6,M.conc,'b');}
 if(hi){for(const sx of [-1,1]){const a=P(sx*(w/2-.6),-.2,-(d/2-.6)),e=P(sx*(w/2-.6),-.2,d/2-.6);b.tube([a[0],.2,a[2]],[e[0],e[1]-.1,e[2]],.05,M.bare,{n:3});b.tube([e[0],.2,e[2]],[a[0],a[1]-.1,a[2]],.05,M.bare,{n:3});}
  const hz=P(0,-.2,(tilt>=0?-1:1)*(d/2-.6)),zb=hz[2];b.tube([-(w/2-.6),.25,zb],[w/2-.6,hz[1]-.15,zb],.05,M.bare,{n:3});b.tube([w/2-.6,.25,zb],[-(w/2-.6),hz[1]-.15,zb],.05,M.bare,{n:3});
  gearBox(b,w/2-1.5,0,zb,.9,1.1,.5,M.cyan);b.tube([w/2-1.5,1.1,zb],[w/2-1.5,hz[1]-.4,zb],.05,M.dark,{n:3});}
 else qb(b,w/2-1.5,0,P(0,0,(tilt>=0?-1:1)*(d/2-.6))[2],.9,1.1,.5,M.hull2,'b');
});

// ------------------------------------------------------------------ refuge-lamp -----------------------------------------
// A 7.2 m light pylon: base block, slim mast with a cyan slit down its +z side, an arm reaching to z = +0.75, a white lamp.
WK.model('refuge-lamp',(b,o)=>{const M=b.k.pal.mil,hi=b.hi;
 if(hi)b.loft([rc(b,.8,.8,-.3,.14),rc(b,.8,.8,.32,.14),rc(b,.46,.46,.52,.1)],M.hull2);else qb(b,0,-.3,0,.8,.8,.8,M.hull2,'b');
 b.cyl(0,.5,0,.15,6.5,M.trim,{n:hi?6:4,r2:.1,top:false});b.quad([-.04,.9,.16],[.04,.9,.16],[.04,6.4,.12],[-.04,6.4,.12],M.cyan,[0,3,0]);
 qb(b,0,6.94,.34,.22,.17,1,M.hull2);qb(b,0,6.82,.72,.74,.13,.44,M.hull2,'b');qb(b,0,6.78,.72,.62,.04,.34,M.white,'t');
 if(hi){b.quad([-.2,.9,.04],[-.2,.9,-.04],[-.14,6.4,-.04],[-.14,6.4,.04],M.cyan,[0,3,0]);b.quad([.2,.9,.04],[.2,.9,-.04],[.14,6.4,-.04],[.14,6.4,.04],M.cyan,[0,3,0]);
  b.cyl(0,6.2,0,.19,.26,M.gold,{n:6});b.tube([0,6.3,.08],[0,6.94,.6],.045,M.trim,{n:3});b.tube([0,7.1,-.06],[0,7.38,-.06],.03,M.bare,{n:3});b.halo(0,6.76,.72,1.6,0xa8f8ff,.6);}
});

// ------------------------------------------------------------------ relay-mast ------------------------------------------
// A field relay (instanced across the Moon): footing, slim mast, two crossbars with insulators, a dish, a panel, a cyan
// slit on the +z side and a white top light at y 9.3.
WK.model('relay-mast',(b,o)=>{const M=b.k.pal.mil,hi=b.hi;
 if(hi)b.loft([rc(b,.9,.9,-.4,.16),rc(b,.9,.9,.34,.16),rc(b,.5,.5,.5,.1)],M.hull2);else qb(b,0,-.4,0,.9,.9,.9,M.hull2,'b');
 b.cyl(0,.5,0,.15,8.62,M.trim,{n:hi?6:4,r2:.08,top:false});
 for(const y of [3,6]){b.tube([-.7,y,0],[.7,y,0],.06,M.hull2,{n:hi?4:3,caps:hi});if(hi){b.cyl(0,y-.12,0,.2,.24,M.hull2,{n:6,top:false});for(const s of [-1,1])b.gem(s*.68,y+.15,0,.09,.17,.09,M.bare);}}
 b.at(.14,8,0,0,q=>{q.cyl(0,0,0,.1,.3,M.plate,{n:hi?8:6,r2:.52});if(hi)q.tube([0,.3,0],[0,.62,0],.03,M.bare,{n:3});},0,-1.05);
 b.at(-.16,4.5,0,0,q=>qb(q,-.4,0,0,.72,.05,.56,M.navy,hi?'':'lrfk'),0,.55);
 b.quad([-.035,1,.17],[.035,1,.17],[.035,8.4,.11],[-.035,8.4,.11],M.cyan,[0,5,0]);if(hi)b.quad([-.035,1,-.17],[.035,1,-.17],[.035,8.4,-.11],[-.035,8.4,-.11],M.cyan,[0,5,0]);
 b.gem(0,9.3,0,.2,.26,.2,M.white);
 if(hi){b.cyl(0,9.0,0,.13,.14,M.gold,{n:6,top:false});for(let k=0;k<3;k++){const a=k*TAU/3+.5;b.tube([Math.cos(a)*.42,.42,Math.sin(a)*.42],[0,2.3,0],.035,M.bare,{n:3});}}
});

// ------------------------------------------------------------------ viaduct-segment -------------------------------------
// 4 m of the viaduct below and beside the drive surface (y = 0, drawn by the game): the girder slab (1.3 deep, o.d wide) with
// ribs, the two curbs at z = +-9 (0.7 wide, 0.9 high) with a cyan line on top, a lane stud (o.stud = 0 leaves it out).
// No end faces: segments chain. 60 in a row, so every triangle counts.
WK.model('viaduct-segment',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,L=o.w||4,D=o.d>18.2&&o.d<18.5?18.2:(o.d||18.2),x0=-L/2,x1=L/2,zc=D/2-.1,Q=(y0,z0,y1,z1,m,ins)=>b.quad([x0,y0,z0],[x1,y0,z0],[x1,y1,z1],[x0,y1,z1],m,ins);
 for(const s of [-1,1]){const zo=s*(zc+.35),zi=s*(zc-.35);Q(-1.4,s*D/2,0,s*D/2,M.hull2,[0,-.7,0]);Q(0,zo,.9,zo,M.trim,[0,.4,s*zc]);Q(0,zi,.9,zi,M.trim,[0,.4,s*zc]);Q(.9,zi,.9,zo,M.hull,[0,0,s*zc]);Q(0,zo,0,s*D/2,M.hull2,[0,1,s*zc]);
  if(hi){Q(.9,s*(zc-.16),.97,s*(zc-.16),M.cyan,[0,.9,s*zc]);Q(.9,s*(zc+.16),.97,s*(zc+.16),M.cyan,[0,.9,s*zc]);Q(.97,s*(zc-.16),.97,s*(zc+.16),M.cyan,[0,0,s*zc]);
   Q(-1.4,s*(D/2-.6),-.5,s*(D/2-.6),M.hull2,[0,-.9,s*(D/2-.3)]);Q(-1.4,s*(D/2-.6),-1.4,s*D/2,M.dark,[0,0,s*zc]);
   qb(b,0,.14,zo+s*.03,L-.5,.62,.06,M.plate2,s>0?'k':'f');b.quad([-.3,.36,zi-s*.02],[.3,.36,zi-s*.02],[.3,.52,zi-s*.02],[-.3,.52,zi-s*.02],M.ice,[0,.4,s*zc]);}
  else Q(.93,s*(zc-.16),.93,s*(zc+.16),M.cyan,[0,0,s*zc]);}
 if(hi){Q(-.5,-D/2+.6,-.5,D/2-.6,M.dark,[0,0,0]);for(const z of [-4.4,0,4.4]){Q(-1.4,z-.35,-1.4,z+.35,M.dark,[0,0,z]);Q(-1.4,z-.35,-.5,z-.35,M.hull2,[0,-.9,z]);Q(-1.4,z+.35,-.5,z+.35,M.hull2,[0,-.9,z]);}
  for(const s of [-1,1])b.quad([s*.25,-1.2,-D/2+.6],[s*.25,-1.2,D/2-.6],[s*.25,-.5,D/2-.6],[s*.25,-.5,-D/2+.6],M.hull2,[0,-.8,0]);b.quad([-.25,-1.2,-D/2+.6],[.25,-1.2,-D/2+.6],[.25,-1.2,D/2-.6],[-.25,-1.2,D/2-.6],M.dark,[0,0,0]);}
 else Q(-1.4,-D/2,-1.4,D/2,M.dark,[0,0,0]);
 if(o.stud!==0){if(hi)qb(b,0,0,0,2.4,.05,.24,M.ice,'brl');else b.quad([-1.2,.04,-.12],[1.2,.04,-.12],[1.2,.04,.12],[-1.2,.04,.12],M.ice,[0,-1,0]);}
},{aoH:.01,aoMin:.86});

// ------------------------------------------------------------------ viaduct-pier ----------------------------------------
// A hex armoured column: footing, a shaft tapering 8% with two lit collars at 0.35 and 0.7 of the height, pale plates on
// alternate faces between them, and a hammerhead bracket (long axis z, across the deck) under the deck. o.h = height from
// the ground to the deck underside; o.sink = footing depth below y = 0.
WK.model('viaduct-pier',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,h=o.h||24,sink=o.sink??1,hh=h-1.7,rA=y=>1.65-.13*Math.max(0,y-.5)/(hh-.5),X=(r,y)=>ngon(b,6,r,y),head=(hx,hz,y)=>({p:[[hx,0],[hx,hz],[-hx,hz],[-hx,0],[-hx,-hz],[hx,-hz]],y});
 if(hi)b.loft([X(1.8,-sink),X(1.8,.36),X(1.68,.5)],M.hull2,{top:false});else b.loft([X(1.8,-sink),X(1.8,.5)],M.hull2,{top:false});
 let ya=.5;for(const f of [.35,.7]){const yc=h*f,r=rA(yc);b.loft([X(rA(ya),ya),X(rA(yc-.5),yc-.5)],(q,i)=>hi&&f>.5&&i%2?M.plate2:M.hull,{top:false});if(hi)for(const s of [-1,1])b.quad([s*(rA(yc-4)+.02),yc-4,-.12],[s*(rA(yc-4)+.02),yc-4,.12],[s*(rA(yc-1.2)+.02),yc-1.2,.12],[s*(rA(yc-1.2)+.02),yc-1.2,-.12],M.ice,[0,yc-2,0]);
  if(hi){b.loft([X(r,yc-.5),X(r+.17,yc-.4),X(r+.17,yc-.17)],M.hull2,{top:false});b.loft([X(r+.21,yc-.17),X(r+.21,yc+.17)],M.cyan,{top:false});b.loft([X(r+.17,yc+.17),X(r+.17,yc+.4),X(r,yc+.5)],M.hull2,{top:false});}
  else b.loft([X(r+.16,yc-.5),X(r+.16,yc-.17)],M.hull2,{top:false}).loft([X(r+.2,yc-.17),X(r+.2,yc+.17)],M.cyan,{top:false}).loft([X(r+.16,yc+.17),X(r+.16,yc+.5)],M.hull2,{top:false});ya=yc+.5;}
 b.loft([X(rA(ya),ya),X(rA(hh),hh)],(q,i)=>hi&&i%2===0?M.plate2:M.hull,{top:false});
 b.loft([X(rA(hh),hh),head(1.25,1.74,h-.42),head(1.25,1.74,h-.3)],M.hull2,{top:false});b.loft([head(1.36,1.8,h-.3),head(1.36,1.8,h)],M.trim,{top:true});
 if(hi){for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6;rad(b,a,0,0,q=>q.loft([rc(q,.5,.7,.3,0,0,1.75),rc(q,.4,.1,3.2,0,0,rA(3.2)*.87+.02)],M.hull2,{top:false}));}
  for(const s of [-1,1]){b.tube([0,hh-2.2,s*rA(hh-2.2)*.86],[0,h-.36,s*1.6],.13,M.trim,{n:4});qb(b,0,h-.24,s*1.81,.9,.16,.04,M.white,s>0?'k':'f');}
  b.loft([X(rA(hh-.5)+.08,hh-.5),X(rA(hh)+.08,hh-.14)],M.gold,{top:false});}
});

// ------------------------------------------------------------------ viaduct-lamp ----------------------------------------
// The deck-edge light post: the post stands at the origin, the lamp reaches toward +z, 4.1 m.
WK.model('viaduct-lamp',(b,o)=>{const M=b.k.pal.mil,hi=b.hi;
 if(hi)qb(b,0,0,0,.36,.32,.36,M.hull2,'b');b.loft([rc(b,.18,.18,hi?.32:0),rc(b,.13,.13,3.96)],M.trim,{top:false});
 b.tube([0,3.9,-.04],[0,4.08,.66],.07,M.hull2,{n:hi?4:3});qb(b,0,3.98,.56,.5,.1,.36,M.hull2,'b');b.quad([-.2,3.975,.42],[.2,3.975,.42],[.2,3.975,.7],[-.2,3.975,.7],M.white,[0,5,.5]);
 if(hi){b.quad([-.03,.5,.1],[.03,.5,.1],[.03,3.6,.08],[-.03,3.6,.08],M.cyan,[0,2,0]);b.tube([0,3.3,.06],[0,3.98,.38],.035,M.trim,{n:3});b.gem(0,4.14,-.04,.07,.1,.07,M.gold);b.halo(0,3.9,.56,1.3,0xa8f8ff,.6);}
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
},{aoH:.01,aoMin:.88});

// ------------------------------------------------------------------ base-wall -------------------------------------------
// The perimeter barrier: a berm, a battered armoured wall with a belt and pale plates, a lit line under the cap on both
// faces, a walkway between parapets, and buttress ribs every ~4 m. o.d = run length along z; 6 thick; 5 high; symmetric.
WK.model('base-wall',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,L=o.d||35,sink=o.sink??1,R=(w,y)=>rc(b,w,L,y),n=Math.max(1,Math.floor(L/4));
 if(hi)b.loft([R(6,-sink),R(6,.25),R(5.2,1.2)],M.conc,{top:false});else b.loft([R(6,-sink),R(5.4,1.2)],M.conc,{top:false});
 b.loft([R(4.5,1.2),R(4.36,2.5)],M.hull,{top:false});if(hi)b.loft([R(4.36,2.5),R(4.58,2.58),R(4.58,2.86),R(4.3,2.94)],M.hull2,{top:false});else b.loft([R(4.5,2.5),R(4.5,2.94)],M.hull2,{top:false});
 b.loft([R(4.3,2.94),R(4.2,3.95)],M.plate,{top:false});b.loft([R(4.36,3.95),R(4.36,4.15)],M.cyan,{top:false});b.loft([R(4.24,4.15),R(4.8,4.38),R(4.8,4.62)],M.hull2,{top:true,topMat:M.hull});
 for(const s of [-1,1])qb(b,s*2.2,4.62,0,.4,.2,L,M.hull2,'b');
 for(let i=0;i<=n;i++){const t=-L/2+i*L/n+(i===0?.32:i===n?-.32:0);
  if(hi){b.loft([rc(b,5.7,.64,.7,.1,0,t),rc(b,4.96,.52,4.3,.1,0,t)],M.hull2,{top:false});const tm=Math.max(-L/2+.66,Math.min(L/2-.66,t));for(const s of [-1,1]){qb(b,s*2.2,4.62,tm,.46,.38,1.3,M.hull,'b');qb(b,s*2.44,4.74,tm,.04,.14,.9,M.gold,'tb'+(s>0?'l':'r'));b.quad([s*2.63,3.05,t-.08],[s*2.63,3.05,t+.08],[s*2.56,3.75,t+.08],[s*2.56,3.75,t-.08],M.ice,[0,3.4,t]);}}
  else qb(b,0,.7,t,5.3,3.6,.56,M.hull2,'tb');}
 if(hi)for(let i=0;i<n;i++){const t=-L/2+(i+.5)*L/n;qb(b,0,4.62,t,.9,.03,L/n-1.6,M.plate2,'b');qb(b,0,4.65,t,.24,.02,.7,M.ice,'b');for(const s of [-1,1]){qb(b,s*2.24,1.5,t,.08,.74,L/n-1.5,M.plate2,s>0?'l':'r');qb(b,s*2.3,1.72,t,.04,.3,1.2,M.dark,s>0?'l':'r');}}
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ base-gate -------------------------------------------
// The Command Gate: two armoured pylons (x = +-13.4) carrying the lintel (y 9.7 to 11.1) and its crest; tanks drive under
// it. The opening stays clear: nothing inside |x| < 12.5 below y 9.5. The sign field on the lintel front (+z) is the
// game's. o.flank = 0 leaves out the two flank bastions (6.4 x 6 at x = +-17, z = -1.1: the old front wall stubs beside
// the gate, inside the side walls' solid), which reach x = +-20.2, beyond the 30 m slot box.
WK.model('base-gate',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,sink=o.sink??1,flank=o.flank!==0;
 for(const s of [-1,1]){const cx=s*13.6,ins=[cx,5,0];
  b.bev(s*13.7,-sink,0,2.3,sink+1.3,3,M.hull2,{ch:.16});
  b.loft([rc(b,2,2.6,1.3,hi?.2:0,cx),rc(b,2,2.5,4.9,hi?.2:0,cx)],M.hull,{top:false});b.loft([rc(b,2.16,2.66,4.9,hi?.2:0,cx+s*.02),rc(b,2.16,2.66,5.3,hi?.2:0,cx+s*.02)],M.hull2,{top:false});
  b.loft([rc(b,1.96,2.44,5.3,hi?.2:0,cx-s*.02),rc(b,1.9,2.3,8.7,hi?.2:0,cx-s*.05)],M.plate,{top:false});b.loft([rc(b,2.1,2.5,8.7,hi?.2:0,cx+s*.05),rc(b,2.1,2.5,8.95,hi?.2:0,cx+s*.05)],M.gold,{top:false});
  b.bev(s*13.75,8.95,0,2.5,2.4,2.9,M.hull2,{ch:.18});b.bev(s*13.75,11.35,0,1.9,.3,2.2,M.hull,{ch:.1});
  qb(b,s*12.58,.5,0,.04,9,1.3,M.dark,'tb'+(s>0?'r':'l'));qb(b,s*12.55,.7,0,.04,8.6,.5,M.cyan,'tb'+(s>0?'r':'l'));
  // the front buttress foot, the outer buttress fin, the lamp mast on the head
  b.loft([rc(b,1.7,1.6,-sink,hi?.14:0,cx+s*.05,2.05),rc(b,1.6,1.3,2,hi?.14:0,cx+s*.05,1.9),rc(b,1.3,.36,5.2,hi?.1:0,cx,1.44)],M.hull2);
  b.at(cx+s*.05,.7,2.64,0,q=>{hazard(q,0,0,0,1.36,1,4);if(hi)qb(q,0,1.5,-.06,.24,1.9,.05,M.cyan,'kb');},-.1);
  b.loft([rc(b,.8,1.2,-sink,0,s*14.6),rc(b,.5,1,6.6,0,s*14.72),rc(b,.2,.6,8.4,0,s*14.66)],M.hull2);
  b.tube([s*14.3,11.65,0],[s*14.3,11.9,0],.06,M.trim,{n:4});b.gem(s*14.3,11.9,0,.12,.1,.12,M.red);
  for(const f of [1,-1]){const z=f*1.3;   // front and back faces of the pylon
   if(hi){b.at(cx,0,z,f>0?0:Math.PI,q=>{q.bev(0,5.6,.0,1.36,2.8,.16,M.plate2,{ch:.07});qb(q,0,6.2,.17,.2,1.6,.04,M.ice,'kb');if(f<0){hazard(q,0,1.5,.03,1.5,.9,4);qb(q,0,2.9,.02,.9,1.5,.08,M.dark,'kb');for(let k=0;k<4;k++)qb(q,0,3.05+k*.34,.1,.8,.06,.04,M.trim,'kb');}
     q.bev(0,9.5,.14,1.3,.9,.2,M.hull,{ch:.06});qb(q,0,9.72,.26,.7,.3,.05,f>0?M.amber:M.white,'kb');});}
   else{qb(b,cx,1.5,z+f*.02,1.5,.9,.04,M.hazard,'tb'+(f>0?'k':'f'));qb(b,cx,9.72,z+f*.16,.7,.3,.05,f>0?M.amber:M.white,'b'+(f>0?'k':'f'));}}
  // flank bastion
  if(flank){const bx=s*17,bz=-1.1;b.loft([rc(b,6.4,1.6,-sink,0,bx,bz),rc(b,6.3,1.5,3.2,0,bx,bz)],M.hull,{top:false});b.loft([rc(b,6.3,1.5,3.2,0,bx,bz),rc(b,6.24,1.44,5.6,0,bx,bz)],M.plate,{top:false});b.loft([rc(b,6.44,1.64,5.6,0,bx,bz),rc(b,6.44,1.64,5.86,0,bx,bz)],M.hull2,{top:false});
   b.loft([rc(b,6.6,1.8,5.86,0,bx,bz),rc(b,6.6,1.8,6.1,0,bx,bz)],M.cyan,{top:false});b.loft([rc(b,6.5,1.7,6.1,0,bx,bz),rc(b,6.5,1.7,6.22,0,bx,bz)],M.hull2,{top:true});
   if(hi){for(const t of [-2.2,0,2.2])qb(b,bx+t,6.22,bz,1.3,.3,1.7,M.hull,'b');for(const f of [1,-1]){qb(b,bx+s*.9,4.1,bz+f*.74,3.4,.36,.04,M.dark,'tb'+(f>0?'k':'f'));qb(b,bx+s*.9,4.22,bz+f*.77,3,.1,.03,M.ice,'tb'+(f>0?'k':'f'));qb(b,bx+s*.9,1.2,bz+f*.78,3.8,1.5,.08,M.hull2,'b'+(f>0?'k':'f'));}
    b.at(bx+s*2.9,0,bz,0,q=>q.loft([rc(q,.6,2.2,-sink),rc(q,.5,1.9,5.5)],M.hull2,{top:false}));}}}
 // the lintel: an armoured beam with plate panels beside the sign field, floodlights and the lit line underneath
 b.bev(0,9.7,0,28.4,1.4,2.6,M.hull2,{ch:.2,bot:true});
 qb(b,0,9.6,-1.08,26.2,.1,.14,M.cyan,'t');
 for(const f of [1,-1]){qb(b,0,9.94,f*1.31,10.6,.94,.04,M.dark,'tb'+(f>0?'k':'f'));
  for(const s of [-1,1]){if(hi)b.at(s*9.25,0,f*1.3,f>0?0:Math.PI,q=>{q.bev(0,9.96,0,6.6,.9,.14,M.plate,{ch:.06});for(let k=-1;k<=1;k++)qb(q,k*2.2*1,10.1,.15,.12,.62,.03,M.gold,'kb');});else qb(b,s*9.25,9.96,f*1.34,6.6,.9,.06,M.plate,'tb'+(f>0?'k':'f'));}}
 if(hi){for(let k=-5;k<=5;k++){if(!k)continue;qb(b,k*2.3,9.56,.5,.9,.14,.5,M.hull,'t');qb(b,k*2.3,9.53,.5,.66,.03,.3,M.white,'t');}
  for(let k=-6;k<=6;k++)if(Math.abs(k)>2)qb(b,k*2.05,11.1,0,.5,.22,2.3,M.hull,'b');
  b.detail(()=>{for(const f of [1,-1])for(const s of [-1,1])b.rail([[s*4.3,11.1,f*1.15],[s*12.3,11.1,f*1.15]],.8,M.bare,{step:2,r:.045});});}
 // the crest: stepped, gold-trimmed, a white light bar, twin masts
 b.bev(0,10.9,0,8,.62,2.8,M.hull,{ch:.12});b.bev(0,11.52,0,5.2,.3,2,M.plate,{ch:.08});qb(b,0,11.2,1.42,7.2,.12,.04,M.gold,'kb');qb(b,0,11.2,-1.42,7.2,.12,.04,M.gold,'fb');qb(b,0,11.82,0,3.4,.08,.3,M.white,'b');
 for(const s of [-1,1]){b.tube([s*3.3,11.52,0],[s*3.3,11.98,0],.05,M.trim,{n:4});if(hi){b.gem(s*3.3,11.9,0,.09,.09,.09,M.cyan);b.bev(s*5.2,11.1,0,1.2,.36,2.4,M.hull2,{ch:.08});}}
 if(hi){b.gem(0,11.2,1.46,.34,.3,.06,M.gold);b.halo(-13.6,9.9,1.6,1.2,0xffb347,.6);b.halo(13.6,9.9,1.6,1.2,0xffb347,.6);}
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
// crown and the glowing core dome (12 high). o.tier: 3+ adds a third ring and crown teeth. o.plinth = 1: the plinth only
// (the citadel model stands on it).
WK.model('base-reactor',(b,o)=>{const {pal,glow,circ}=b.k,M=pal.mil,hi=b.hi,tier=o.tier||2,sink=o.sink??.6,O=(r,y)=>oct(b,r,y),teal=glow(0x2dffc4,1),n=hi?16:10,C=(r,y)=>({p:circ(r,n,0,0,r,Math.PI/n),y}),rD=y=>5.6-.75*(y-1.6)/7.8;
 b.loft([O(7.6,-sink),O(7.6,1.28)],M.hull2,{top:false});b.loft([O(7.75,1.28),O(7.75,1.48)],M.cyan,{top:false});b.loft([O(7.66,1.48),O(7.66,1.6),O(5.6,1.63)],M.hull2,{top:false});
 if(o.plinth){b.cap(O(5.6,1.63).p,1.63,M.hull2);return;}
 b.loft([C(5.86,1.6),C(5.86,2.2),C(rD(2.4),2.4)],M.hull2,{smooth:true,top:false});b.loft([C(rD(2.4),2.4),C(rD(8.9),8.9)],M.hull,{smooth:true,top:false});
 b.loft([C(rD(8.9),8.9),C(rD(8.9)+.2,9),C(rD(9.4)+.2,9.4)],M.hull2,{smooth:true,top:false});b.loft([C(4.85,9.4),C(4.85,9.62),C(4.5,9.86)],M.gold,{smooth:true,top:true,topMat:M.hull2});
 // ribs: buttress fins following the drum's taper
 const nr=hi?12:6;for(let k=0;k<nr;k++){const a=k*TAU/nr+(hi?TAU/24:0);rad(b,a,0,0,q=>{if(hi)q.loft([rc(q,.74,.9,1.6,.1,0,5.86+.2),rc(q,.62,.66,8.6,.1,0,rD(8.6)+.26),rc(q,.4,.3,9.5,.08,0,rD(9.5)+.06)],M.hull2);else q.loft([rc(q,.8,.9,1.6,0,0,6),rc(q,.6,.5,9.4,0,0,5.05)],M.hull2);});
  if(k%(hi?3:2)===0){const am=a+TAU/nr/2,c=Math.cos(am),s=Math.sin(am),t=.14;b.quad([c*(rD(3.2)+.03)+s*t,3.2,s*(rD(3.2)+.03)-c*t],[c*(rD(3.2)+.03)-s*t,3.2,s*(rD(3.2)+.03)+c*t],[c*(rD(7.8)+.03)-s*t,7.8,s*(rD(7.8)+.03)+c*t],[c*(rD(7.8)+.03)+s*t,7.8,s*(rD(7.8)+.03)-c*t],M.white,[0,5,0]);}}
 // lit rings
 for(const y of tier>=3?[3.4,5.6,7.8]:[3.6,6.6]){const r=rD(y)+1.12;if(hi)b.ring(0,y,0,r,M.cyan,{t:.6,thin:tier>=3});else hoop(b,y-.12,r-.16,r+.16,.24,n,M.cyan,{noBot:true});}
 // radiator banks and pipe elbows on the plinth
 for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;rad(b,a,6.5,1.6,q=>{q.bev(0,0,0,2.9,.34,1.3,M.hull2,{ch:.06});const m=hi?7:3;for(let i=0;i<m;i++)qb(q,-1.2+2.4*i/(m-1),.34,0,hi?.16:.4,2.3,1.1,i%2?M.plate2:M.trim,'b');if(hi)qb(q,0,2.5,0,2.8,.14,.5,M.hull2,'b');});
  if(hi){const a2=a+.62,c=Math.cos(a2),s=Math.sin(a2);b.pipe([[c*5.7,2.9,s*5.7],[c*6.9,2.9,s*6.9],[c*6.9,1.6,s*6.9]],.3,M.bare,{n:6});const a3=a-.62,c3=Math.cos(a3),s3=Math.sin(a3);b.pipe([[c3*5.7,2.3,s3*5.7],[c3*6.7,2.3,s3*6.7],[c3*6.7,1.6,s3*6.7]],.22,M.trim,{n:5});}}
 // the crown and the core dome
 if(tier>=3&&hi)for(let k=0;k<8;k++){const a=k*Math.PI/4;rad(b,a,4.72,9.62,q=>q.loft([rc(q,.7,.34,0),rc(q,.3,.2,.62,0,0,-.1)],M.gold));}
 b.dome(0,9.86,0,4.3,1.95,4.3,glow(tier>=4?0xe4fff6:0xc8f4ea,tier>=4?.8:.66),{n:hi?14:8,rings:hi?4:2});
 if(hi){b.ring(0,9.9,0,4.4,M.gold,{thin:true});b.halo(0,11.2,0,3.2,0x2dffc4,.4);}b.cyl(0,11.72,0,.5,.22,teal,{n:6});
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
 // the turret
 b.cyl(0,9.7,0,2.1,.3,M.dark,{n:hi?12:8});b.loft([rc(b,3.9,4.1,10,hi?.5:0),rc(b,3.9,4.1,10.5,hi?.5:0),rc(b,3,3.1,11.5,hi?.4:0,0,-.3)],M.hull,{top:true,topMat:M.plate});
 b.bev(0,10.22,2.02,2.7,1.02,.7,M.hull2,{ch:.12});
 for(const s of [-1,1]){const x=s*.62,nb=hi?8:5;b.tube([x,10.7,2.2],[x,10.86,3.5],.24,M.trim,{n:nb});b.tube([x,10.86,3.5],[x,10.92,3.95],.36,M.dark,{n:nb,caps:true});if(hi){b.tube([x,10.71,2.3],[x,10.77,2.9],.33,M.hull2,{n:nb,caps:true});qb(b,s*2.06,10.1,-.2,.2,.9,2.6,M.plate2,'b');}}
 b.tube([0,11.3,-1.3],[0,13.3,-1.3],.08,M.trim,{n:5});b.box(0,13.3,-1.3,.26,.26,.26,M.red);b.halo(0,13.45,-1.3,1.2,0xff3048,1);
 if(hi){b.bev(-.9,11.45,.2,.9,.36,.9,M.hull2,{ch:.06});qb(b,-.9,11.52,.67,.5,.2,.04,M.ice,'kb');b.cyl(.95,11.42,-.5,.34,.2,M.dark,{n:8});b.dome(.95,11.62,-.5,.3,.3,.3,M.plate,{n:8,rings:2});
  b.tube([.9,11.4,-1.5],[1.05,13.9,-1.6],.025,M.bare,{n:3});b.cyl(0,12.3,-1.3,.14,.16,M.gold,{n:6});
  b.detail(()=>b.ladder([0,2,-2.98],[0,9.1,-2.86],M.bare,{w:.6}));b.at(0,0,-2.92,Math.PI,q=>{q.bev(0,2,.0,1.3,2.1,.16,M.hull2,{ch:.06});qb(q,0,4.14,.1,.9,.1,.05,M.ice,'kb');});}
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ base-module -----------------------------------------
// A base module on the back wall line: a hex core whose height is its level (o.level 1-3: 2.3 / 3.4 / 4.5 m), one lit band a
// level and a glowing cap in the function colour (o.color, hex). o.kind (optional: reactor hangar defense vault radar uplink)
// picks the emblem on top.
WK.model('base-module',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,lv=Math.max(1,Math.min(3,(o.level|0)||1)),h=1.2+lv*1.1,col=o.color||0x22e6ff,c=glow(col,1),c9=glow(col,.9),X=(r,y)=>ngon(b,6,r,y,Math.PI/6);
 if(hi)b.loft([X(1.9,-.4),X(1.9,.24),X(1.62,.4)],M.hull2,{top:false});else b.loft([X(1.9,-.4),X(1.7,.4)],M.hull2,{top:false});
 b.loft([X(1.5,.4),X(1.42,h)],M.hull,{top:false});for(let k=1;k<=lv;k++){const y=h*k/(lv+1)+.1;b.loft([X(1.57,y-.07),X(1.57,y+.07)],c9,{top:false});}
 b.loft([X(1.62,h),X(1.62,h+.12)],M.gold,{top:false});b.loft([X(1.6,h+.12),X(1.6,h+.34),X(1.25,h+.48)],(r)=>r?M.hull2:c,{top:true,topMat:M.hull2});
 if(hi)for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6;rad(b,a,0,0,q=>q.loft([rc(q,.34,.5,.3,0,0,1.62),rc(q,.26,.24,h,0,0,1.5)],M.hull2,{top:false}));}
 const y=h+.48,kind=o.kind||'';
 if(kind==='reactor'){b.cyl(0,y,0,.5,.3,M.hull2,{n:6});b.ball(0,y+.75,0,.5,c,true);}
 else if(kind==='hangar'){b.at(0,y,0,0,q=>q.vault(0,0,0,1.5,.62,M.plate,{n:hi?6:4,ends:M.hull2}));}
 else if(kind==='defense'){b.bev(0,y,-.1,1,.5,1,M.hull2,{ch:.08});for(const s of [-1,1])b.tube([s*.24,y+.3,.3],[s*.24,y+.42,1.3],.09,M.trim,{n:5,caps:true});}
 else if(kind==='vault'){b.bev(0,y,0,1.2,.7,1,M.gold,{ch:.1});qb(b,0,y+.22,.51,.3,.26,.03,M.dark,'kb');}
 else if(kind==='radar'){b.cyl(0,y,0,.1,.5,M.trim,{n:5});b.at(0,y+.5,0,.6,q=>q.cyl(0,0,0,.12,.3,M.plate,{n:hi?8:6,r2:.7}),.8);}
 else if(kind==='uplink'){b.tube([0,y,0],[0,y+2.1,0],.06,M.trim,{n:4});for(const [yy,r] of [[.7,.34],[1.25,.24]])hoop(b,y+yy,r-.06,r,.06,6,c9,{});b.gem(0,y+2.2,0,.12,.16,.12,c);}
 else{b.cyl(0,y,0,.34,.36,M.hull2,{n:6});b.gem(0,y+.74,0,.3,.4,.3,c);}
 b.halo(0,h+.3,0,1.2,col,.45);
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
// The amber build terminal (2 x 1.5, 3.4 high, a whip to 4.5): a console with a slanted amber screen facing +z.
WK.model('base-kiosk',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi;
 b.bev(0,-.3,0,2.1,.62,1.6,M.hull2,{ch:.08});b.loft([rc(b,1.9,1.4,.32,hi?.1:0),rc(b,1.84,1.34,1.7,hi?.1:0),rc(b,1.8,1,3.3,hi?.1:0,0,-.16)],(r)=>r?M.plate2:M.hull,{top:true,topMat:M.hull2});
 b.at(0,2.5,.5,0,q=>{qb(q,0,-.62,0,1.66,1.24,.1,M.dark,'k');qb(q,0,-.5,.06,1.5,1,.03,glow(0xffb347,.95),'k');if(hi){for(let k=0;k<3;k++)qb(q,-.3,.2-k*.24,.08,.6,.06,.02,M.hazardD,'ktbrl');qb(q,.45,-.3,.08,.3,.3,.02,M.hazardD,'ktbrl');}},-.203);
 for(const s of [-1,1])qb(b,s*.93,.5,.55,.07,1.1,.2,M.amber,'b'+(s>0?'l':'r'));
 b.bev(0,3.3,-.16,2,.16,1.2,M.hull2,{ch:.05});qb(b,0,3.34,.45,1.9,.08,.03,M.gold,'kb');b.tube([-.7,3.46,-.5],[-.7,4.5,-.5],.035,M.trim,{n:3});b.gem(-.7,4.56,-.5,.08,.1,.08,M.amber);
 if(hi){b.at(0,1.5,.66,0,q=>{q.bev(0,0,.12,1.5,.14,.4,M.hull2,{ch:.04});for(let k=0;k<4;k++)qb(q,-.48+k*.32,.14,.12,.2,.02,.16,k===3?M.amber:M.trim,'b');},.24);
  for(const s of [-1,1])hazard(b,s*.6,.34,.71,.5,.5,3);b.bev(.5,3.46,-.3,.5,.2,.4,M.trim,{ch:.04});b.halo(0,2.5,.7,1.1,0xffb347,.25);}
});

// ------------------------------------------------------------------ veteran-monument ------------------------------------
// The field veteran's monument (3 x 3, 5.6 high): a stepped armoured plinth, a gold obelisk with a lit band and a white tip.
WK.model('veteran-monument',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,X=(r,y)=>ngon(b,4,r,y,Math.PI/4);
 b.bev(0,0,0,3,.5,3,M.hull2,{ch:.1});b.bev(0,.5,0,2.2,.5,2.2,M.hull,{ch:.08});if(hi){b.box(0,.56,1.11,1.2,.34,.04,M.gold);for(const s of [-1,1])b.box(s*1.2,.5,1.2,.3,.3,.3,M.cyan);}
 b.loft([X(.95,1),X(.8,1.5),X(.62,1.56),X(.3,4.6),X(.02,5.4)],(r)=>r===1?M.cyan:M.gold,{top:false});b.gem(0,5.5,0,.14,.2,.14,M.white);b.halo(0,5.4,0,1.6,0xffd36b,.9);
},{aoH:2,aoMin:.6});

// ================================================================== the frontier wall ===================================
// ------------------------------------------------------------------ frontier-wall ---------------------------------------
// A run of the frontier wall the colonists hold. o.w = run length along x, o.d / o.h = the lot's depth and height (3 / 5):
// the body is o.d thick, the walkway slab and buttresses reach o.d / 2 + 0.2, the parapet top is at o.h + 1; o.sink below
// the ground. The OUTER face is +z: a crenellated parapet with firing slits, buttresses about every 6 m, plate cladding;
// the inner face has pilasters and the walkway rail. End posts with hazard stripes close each run.
WK.model('frontier-wall',(b,o)=>{const {pal,tint}=b.k,M=pal.mil,hi=b.hi,w=o.w||13,d=o.d||3,h=o.h||5,sink=o.sink??4,hd=d/2,R=(dd,y)=>rc(b,w,dd,y);
 b.loft([R(d,-sink),R(d,.9),R(d-.14,1)],M.conc,{top:false});b.loft([R(d-.14,1),R(d-.5,h-.82)],M.hull,{top:false});b.loft([R(d+.24,h-.82),R(d+.24,h-.62)],M.cyan,{top:false});b.loft([R(d+.4,h-.62),R(d+.4,h-.3)],M.hull2,{top:true,topMat:M.conc});
 // outer parapet with merlons and firing slits; inner kerb and rail
 qb(b,0,h-.3,hd-.05,w,.62,.5,M.hull,'b');const nm=Math.max(2,Math.round(w/2.2));
 for(let k=0;k<nm;k++){const x=-w/2+w*(k+.5)/nm;qb(b,x,h+.32,hd-.05,w/nm-.7,.62,.5,M.hull,'b');if(hi){qb(b,x,h+.94,hd-.05,w/nm-.62,.06,.5,M.plate2,'b');qb(b,x,h-.12,hd+.21,.16,.36,.02,M.dark,'kb');}}
 qb(b,0,h-.3,-hd-.02,w,.2,.3,M.hull2,'b');if(hi)b.detail(()=>b.rail([[-w/2+1,h-.1,-hd-.02],[w/2-1,h-.1,-hd-.02]],.85,M.bare,{step:2.2,r:.05}));
 // buttresses (outer) and pilasters (inner) about every 6 m, plate cladding between them
 const xs=[];for(let x=-w/2+3;x<w/2-1.2;x+=6)xs.push(x);
 for(const x of xs){b.loft([rc(b,1.3,.62,-sink,0,x,hd-.11),rc(b,1.2,.6,h*.5,0,x,hd-.1),rc(b,.9,.3,h-.84,0,x,hd-.1)],M.hull2,{top:false});b.loft([rc(b,.9,.4,-sink,0,x,-hd),rc(b,.8,.3,h-.84,0,x,-hd-.02)],M.hull2,{top:false});
  if(hi){qb(b,x,h*.5+.5,hd+.15,.5,.2,.08,M.hull2,'b');qb(b,x,h*.5+.46,hd+.15,.36,.04,.06,M.white,'t');}}
 if(hi){const ed=[-w/2+1.1,...xs,w/2-1.1];for(let i=0;i<ed.length-1;i++){const a=ed[i]+.75,c=ed[i+1]-.75;if(c-a<1.2)continue;b.at((a+c)/2,0,hd-.2,0,q=>q.bev(0,1.5,0,c-a,h-2.9,.12,M.plate2,{ch:.06}),-.055);}}
 // end posts: taller, striped, a lamp on top
 for(const s of [-1,1]){const x=s*(w/2-.55);b.bev(x,-sink,0,1.1,sink+h+.72,d+.4,M.hull2,{ch:.1});b.bev(x,h+.72,0,.8,.2,d,M.hull,{ch:.05});b.at(x,0,hd+.2,0,q=>hazard(q,0,1.6,.02,1,1.2,4));
  if(hi){b.at(x,0,-hd-.2,Math.PI,q=>hazard(q,0,1.6,.02,1,1.2,4));qb(b,x,h+.92,0,.3,.08,.3,M.cyan,'b');qb(b,x,3.4,hd+.21,.16,1.2,.02,M.ice,'kb');}}
},{aoH:3,aoMin:.58});

// ------------------------------------------------------------------ frontier-watch --------------------------------------
// A frontier watchtower on o.w x o.d (6 x 6), cabin top at o.h (12): four splayed armoured legs with cross braces, an
// enclosed cabin with a lit window band, a hipped roof (0.3 overhang) with a searchlight (front, +z), an antenna with a red
// tip (to o.h + 1.1) and cyan trim, a ladder up the back.
WK.model('frontier-watch',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,w=o.w||6,d=o.d||6,h=o.h||12,sink=o.sink??1,fy=h*.66,R=(k,y,ch)=>rc(b,w*k,d*k,y,hi?ch:0);
 // legs and braces
 const L=(sx,sz,t)=>[sx*(w/2-.55-(w*.2-.55)*t*0+(-(w/2-.55)+w*.32)*t),fy*t,sz*(d/2-.55+(-(d/2-.55)+d*.32)*t)];
 for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const a=L(sx,sz,0),c=L(sx,sz,1);b.bev(a[0],-sink,a[2],1.1,sink+.4,1.1,M.hull2,{ch:.1});b.loft([rc(b,.72,.72,.4,hi?.12:0,a[0],a[2]),rc(b,.5,.5,fy,hi?.1:0,c[0],c[2])],M.hull,{top:false});}
 const C=[[-1,-1],[1,-1],[1,1],[-1,1]];for(let i=0;i<4;i++){const p=C[i],q=C[(i+1)%4];for(const [t0,t1] of [[.08,.5],[.52,.94]]){b.tube(L(p[0],p[1],t0),L(q[0],q[1],t1),.085,M.trim,{n:hi?4:3});if(hi)b.tube(L(q[0],q[1],t0),L(p[0],p[1],t1),.085,M.trim,{n:4});}
  b.tube(L(p[0],p[1],.51),L(q[0],q[1],.51),.1,M.hull2,{n:hi?4:3});}
 // the cabin: floor, armoured lower wall, the window band, a pale upper band, cyan trim, the roof
 b.loft([R(.86,fy-.3,.5),R(1,fy,.6),R(1,fy+.24,.6)],M.hull2,{top:false});b.loft([R(.96,fy+.24,.7),R(.95,h*.8,.7)],M.hull,{top:false});
 b.loft([R(.93,h*.8,.7),R(.92,h*.89,.7)],hi?M.glassDark:M.ice,{top:false});b.loft([R(.95,h*.89,.7),R(.95,h*.94,.7)],M.plate,{top:false});b.loft([R(.97,h*.94,.7),R(.97,h*.955,.7)],M.cyan,{top:false});
 b.loft([R(1.1,h*.955,.8),R(1.1,h*.975,.8),R(.56,h+.08,.4)],(r)=>r?M.hull:M.hull2,{top:false});b.loft([R(.56,h+.08,.4),R(.56,h+.12,.4)],M.cyan,{top:false});b.loft([R(.52,h+.12,.4),R(.5,h+.16,.4)],M.plate2,{top:true,topMat:M.plate2});
 if(hi)for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>{const ww=(k%2?d:w),z=(k%2?w:d)*.93/2+.02;for(const x of [-1,0,1])qb(q,x*ww*.22,h*.8+.08,z,ww*.19,h*.09-.16,.03,M.ice,'kb');qb(q,0,fy+.7,z+.1,ww*.5,h*.14-1.3,.1,M.plate2,'kb');});
 // roof kit: searchlight, antenna, an air unit, the hatch light
 b.at(w*.36,h-.12,d*.36,.5,q=>{q.cyl(0,-.1,0,.18,.34,M.trim,{n:6});q.at(0,.42,0,0,r=>{r.tube([0,0,-.3],[0,0,.34],.3,M.hull2,{n:hi?8:5,caps:true});r.tube([0,0,.34],[0,0,.38],.25,M.white,{n:hi?8:5,caps:true});},.3);});b.halo(w*.3+.3,h+.4,d*.3+.5,1.2,0xe8f6ff,.4);
 b.tube([-w*.26,h*.99,-d*.26],[-w*.26,h+1,-d*.26],.06,M.trim,{n:4});b.gem(-w*.26,h+1.02,-d*.26,.1,.1,.1,M.red);
 if(hi){airUnit(b,w*.06,h+.16,-d*.04,.55);qb(b,-w*.12,h+.16,d*.08,.9,.06,.9,M.hazard,'b');qb(b,-w*.12,h+.2,d*.08,.7,.03,.7,M.hull2,'b');b.tube([-w*.26,h+.5,-d*.26],[-w*.26+.6,h+.5,-d*.26],.03,M.bare,{n:3});b.halo(-w*.26,h+1.05,-d*.26,.8,0xff3048,.9);
  b.detail(()=>{b.ladder([0,0,-d*.42],[0,fy-.3,-d*.3],M.bare,{w:.6});});qb(b,0,fy-.34,-d*.3,1.1,.06,1.1,M.gold,'t');qb(b,0,fy+.5,d*.48+.03,.9,.1,.04,M.cyan,'kb');}
},{aoH:4,aoMin:.6});

// ------------------------------------------------------------------ frontier-gate ---------------------------------------
// A frontier gate tower (pairs of them flank a road): a tapered armoured pylon (footprint 3.6, top at o.h = 9) with a lit
// cap band, amber warning lights, and a barrier-arm housing on the front (+z) with its striped arm raised.
WK.model('frontier-gate',(b,o)=>{const {pal,mat}=b.k,M=pal.mil,hi=b.hi,h=o.h||9,sink=o.sink??1,R=(s,y,ch=.5)=>rc(b,s,s,y,hi?ch:0),red=mat(0xb8322a,'paint',.3,0);
 b.bev(0,-sink,0,3.6,sink+1.2,3.6,M.hull2,{ch:.2});
 b.loft([R(3,1.2),R(2.78,h*.44)],M.hull,{top:false});b.loft([R(2.9,h*.44,.5),R(2.9,h*.48,.5)],M.hull2,{top:false});b.loft([R(2.74,h*.48),R(2.44,h*.73)],M.plate,{top:false});
 b.loft([R(2.44,h*.73),R(2.9,h*.76),R(2.9,h*.9)],M.hull2,{top:false});b.loft([R(2.98,h*.9),R(2.98,h*.945)],M.cyan,{top:false});b.loft([R(2.9,h*.945),R(2.2,h)],M.hull,{top:true,topMat:M.hull2});
 for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;rad(b,a,0,0,q=>q.loft([rc(q,.6,.6,1.1,0,0,1.86),rc(q,.4,.3,h*.74,0,0,1.52)],M.hull2,{top:false}));}
 for(const s of [-1,1]){b.cyl(s*.7,h,0,.16,.14,M.hull2,{n:6});b.gem(s*.7,h+.26,0,.15,.14,.15,M.amber);b.halo(s*.7,h+.26,0,.8,0xffb347,.45);}
 // faces: a lit vision slit, plate, hazard band
 for(let k=0;k<4;k++)b.at(0,0,0,k*Math.PI/2,q=>{qb(q,0,h*.8,1.46,1.5,.34,.04,M.dark,'kb');qb(q,0,h*.8+.08,1.49,1.2,.14,.03,M.ice,'kb');if(hi&&k)q.at(0,0,1.44,0,p=>p.bev(0,1.7,0,1.7,2,.12,M.plate2,{ch:.06}),-.04);});
 // the barrier: housing, pivot, the raised arm with its tip light
 b.bev(0,1.2,1.92,1.8,1.3,.9,M.hull2,{ch:.1});qb(b,0,1.3,2.38,1.5,.3,.03,M.hazard,'kb');
 b.bev(.55,1.6,2.14,.5,.5,.5,M.trim,{ch:.08});for(let k=0;k<6;k++)qb(b,.55,2.1+k*.82,2.2,.2,.82,.2,k%2?M.plate:red,'tb');b.gem(.55,h*.78+.1,2.2,.12,.14,.12,M.amber);
 if(hi){hazard(b,0,1.26,2.385,1.5,.34,5);qb(b,-.5,2.5,2.0,.3,.2,.3,M.amber,'b');b.at(0,0,-1.5,Math.PI,q=>{q.bev(0,1.2,.02,1.1,2.1,.14,M.hull2,{ch:.06});qb(q,0,3.36,.1,.8,.1,.05,M.ice,'kb');});b.tube([-.9,h,-.6],[-.9,h+.4,-.6],.03,M.bare,{n:3});}
},{aoH:3,aoMin:.6});

// ================================================================== the terraformers' works =============================
// ------------------------------------------------------------------ atmo-pylon ------------------------------------------
// An atmosphere pylon (15.2 m): hex plinth with a cyan strip, cooling fins, a slender mast, three emitter rings at
// 5 / 9 / 12.6 m and a glowing crown at 14.4.
WK.model('atmo-pylon',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,X=(r,y)=>ngon(b,6,r,y),em=glow(0x22e6ff,1.3),rM=y=>.42-.16*(y-.9)/12.7;
 b.loft([X(1.7,-.6),X(1.7,.5)],M.hull2,{top:false});b.loft([X(1.76,.5),X(1.76,.64)],M.cyan,{top:false});b.loft([X(1.7,.64),X(1.5,.74),X(.62,.96)],M.hull,{top:false});
 b.loft([X(.62,.9),X(.56,3.5),X(.42,3.7)],M.hull2,{top:false});b.loft([X(rM(3.7),3.7),X(rM(13.6),13.6)],M.plate2,{top:false});
 for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6;rad(b,a,0,0,q=>{if(hi)q.loft([rc(q,.12,.8,.9,0,0,.95),rc(q,.1,.5,3.3,0,0,.78)],M.plate,{top:true});else qb(q,0,.9,.9,.12,2.4,.7,M.plate,'b');});}
 for(const y of [5,9,12.6]){const R=1.1-y*.03,r=rM(y);if(hi)b.loft([X(r+.1,y-.3),X(r+.1,y+.3)],M.hull2,{top:false});
  if(hi)b.ring(0,y,0,R,em,{t:1.9});else hoop(b,y-.16,R-.1,R+.1,.32,8,em,{noBot:true,noIn:true});
  for(let k=0;k<3;k++){const a=k*TAU/3+y;b.tube([Math.cos(a)*r,y-.2,Math.sin(a)*r],[Math.cos(a)*R,y,Math.sin(a)*R],.05,M.trim,{n:3});if(hi)b.gem(Math.cos(a)*(R+.08),y,Math.sin(a)*(R+.08),.1,.2,.1,M.gold,-a);}}
 // the crown: a cup, gold claws, the glowing core
 b.loft([X(rM(13.6),13.6),X(.5,13.86),X(.5,14)],M.hull2,{top:true});b.ball(0,14.4,0,.55,glow(0xa8f8ff,1.8),!hi);b.halo(0,14.4,0,3.4,0x5cf2ff,.45);
 if(hi){for(let k=0;k<3;k++){const a=k*TAU/3+.5;b.tube([Math.cos(a)*.46,13.9,Math.sin(a)*.46],[Math.cos(a)*.62,14.7,Math.sin(a)*.62],.05,M.gold,{n:3});}
  gearBox(b,0,.72,1.12,.9,.8,.5,M.cyan);b.detail(()=>{b.cable([.3,1.5,1.2],[.2,4.4,.36],-.25,.04,M.dark);b.cable([-.3,1.5,1.2],[-.2,8.6,.3],-.3,.03,M.dark);});}
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ dam -------------------------------------------------
// The terraformers' dam. o.w = length along x, o.h = base (y = 0) to crest, o.d = 4 (art within z +-2.5), o.sink below the
// base. The reservoir is on -z (vertical face, the cyan crest light on that edge); the downstream face (+z) is battered,
// with buttress piers every 10 m, two spillway gates beside the centre pier under hoist housings, the control hut on the
// crest (it stands 3.4 m above o.h), rails, and an access stair in the last bay toward +x.
WK.model('dam',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,N=pal.nat,hi=b.hi,W=o.w||66,H=o.h||9,sink=o.sink??2,hc=H-.5,zf=y=>1.7-.6*Math.max(0,Math.min(1,y/hc)),np=Math.max(1,Math.floor((W-8)/10)+1),px=i=>(i-(np-1)/2)*10;
 // body: two lifts of concrete with a ledge, the crest slab with the walkway
 const B=(y,z1)=>rc(b,W,z1+2,y,0,0,(z1-2)/2);b.loft([B(-sink,zf(-sink)),B(hc*.55,zf(hc*.55))],M.conc,{top:false});b.loft([B(hc*.55,zf(hc*.55)+.14),B(hc*.55+.3,zf(hc*.55)+.14)],M.hull2,{top:false});b.loft([B(hc*.55+.3,zf(hc*.55+.3)),B(hc,zf(hc))],M.conc,{top:false});
 b.loft([rc(b,W,3.9,hc,0,0,-.35),rc(b,W,3.9,H,0,0,-.35)],M.hull2,{top:true,topMat:M.conc});qb(b,0,H,-2.18,W-1.2,.16,.22,M.cyan,'b');
 if(hi)b.detail(()=>{b.rail([[-W/2+2.6,H,1.45],[W/2-2.6,H,1.45]],1,M.bare,{step:3.3,r:.055});b.rail([[-W/2+2.6,H,-1.9],[W/2-2.6,H,-1.9]],1,M.bare,{step:3.3,r:.055});});
 // buttress piers
 for(let i=0;i<np;i++){const x=px(i);b.loft([rc(b,1.8,1.1,-sink,hi?.12:0,x,1.95),rc(b,1.4,.8,hc,hi?.1:0,x,1.42),rc(b,1.4,.8,H+.3,hi?.1:0,x,1.42)],M.hull2,{top:true,topMat:M.hull});
  if(hi){qb(b,x,H-1.1,1.83,.22,.6,.03,M.ice,'kb');qb(b,x,H+.3,1.42,.5,.1,.3,M.cyan,'b');}}
 // abutment blocks at both ends
 for(const s of [-1,1]){const x=s*(W/2-1.2);b.bev(x,-sink,-.1,2.4,H+sink+.5,4.6,M.hull,{ch:.16});b.bev(x,H+.5,-.1,1.9,.24,4,M.hull2,{ch:.08});qb(b,x,H*.5,2.21,.3,H*.36,.03,M.cyan,'kb');if(hi){b.at(x,0,2.2,0,q=>hazard(q,0,.6,.02,2,1,4));qb(b,x,H+.74,-.1,.5,.1,2.4,M.white,'b');}}
 // spillway gates: a dark throat, the steel leaf, a chute down the face, the hoist housing on the crest
 const g0=np%2?5:10,gates=np>=3?[[-g0,1],[g0,0]]:[];
 for(const [gx,open] of gates){const gy=hc-3.5,gw=6;qb(b,gx,gy,zf(gy+1.7)+.03,gw,3.4,.06,M.dark,'kb');
  b.at(gx,0,0,0,q=>{const z0=zf(gy)+.1,lift=open?1.1:0;q.bev(0,gy+lift,z0,gw-.5,3-lift*.4,.2,M.plate2,{ch:.07});if(hi)for(let k=0;k<3;k++)qb(q,0,gy+lift+.5+k*.8,z0+.11,gw-.9,.14,.08,M.hull2,'kb');
   q.quad([-gw/2,gy,zf(gy)+.04],[gw/2,gy,zf(gy)+.04],[gw/2,-sink,zf(-sink)+.4],[-gw/2,-sink,zf(-sink)+.4],M.plate,[0,gy/2,-3]);for(const s of [-1,1])q.quad([s*gw/2,gy+.5,zf(gy)+.04],[s*gw/2,gy,zf(gy)+.44],[s*gw/2,-sink,zf(-sink)+.78],[s*gw/2,-sink,zf(-sink)+.4],M.hull2,[s*(gw/2-1),0,0]);
   if(open)q.quad([-gw/2+.4,gy+.9,zf(gy)+.12],[gw/2-.4,gy+.9,zf(gy)+.12],[gw/2-.4,-sink,zf(-sink)+.48],[-gw/2+.4,-sink,zf(-sink)+.48],N.ice,[0,gy/2,-3]);
   for(const s of [-1,1]){q.bev(s*2.5,H,.2,.5,2.3,.6,M.hull,{ch:.08});if(hi)q.tube([s*1.5,gy+lift+2.8,z0],[s*1.5,H+2.2,.2],.07,M.bare,{n:4});}
   q.bev(0,H+2.3,.2,5.9,.5,1,M.hull2,{ch:.1});if(hi)gearBox(q,0,H+2.8,.2,1.6,.8,.9,open?M.cyan:M.amber);else qb(q,0,H+2.8,.2,1.6,.8,.9,M.hull2,'b');qb(q,0,H+2.36,.72,5.2,.1,.04,M.cyan,'kb');});}
 // the control hut over the centre pier
 b.at(0,H,-.25,0,q=>{q.bev(0,0,0,3.4,1.2,2.6,M.hull,{ch:.1});q.bev(0,1.2,0,3.3,1.2,2.5,M.plate,{ch:.1});q.bev(0,2.4,0,3.8,.24,3,M.hull2,{ch:.08});for(const f of [1,-1])qb(q,0,1.36,f*1.26,2.5,.7,.03,M.ice,'tb'+(f>0?'k':'f'));
  q.tube([1.2,2.64,-.9],[1.2,3.9,-.9],.05,M.trim,{n:4});q.gem(1.2,3.96,-.9,.1,.1,.1,M.red);if(hi){airUnit(q,-.8,2.64,.2,.7);for(const f of [1,-1])for(const x of [-.62,.62])qb(q,x,1.36,f*1.28,.08,.7,.03,M.hull2,'tb'+(f>0?'k':'f'));qb(q,1.72,.1,0,.05,1.9,.9,glow(0x22e6ff,.7),'tbl');q.halo(1.2,3.96,-.9,.8,0xff3048,.8);}});
 // the access stair: two flights in the last bay toward +x
 if(np>=2){const xa=px(np-1)-1.3,xb=xa-(hi?6.4:6.4),rise=hc/2,st=hi?Math.max(4,Math.round(rise/.5)):0,P=(t,f)=>{const y=f?rise+rise*t:rise*t,x=f?xb+(xa-xb)*t:xa+(xb-xa)*t;return [x,y,zf(y)+.44];};
  for(const f of [0,1]){const a=P(0,f),c=P(1,f);for(const dz of [-.34,.34])b.quad([a[0],a[1]-.3,a[2]+dz],[c[0],c[1]-.3,c[2]+dz],[c[0],c[1],c[2]+dz],[a[0],a[1],a[2]+dz],M.hull2,[(a[0]+c[0])/2,(a[1]+c[1])/2-.15,(a[2]+c[2])/2]);
   for(let k=0;k<st;k++){const p=P((k+.5)/st,f);qb(b,p[0],p[1]-.06,p[2],Math.abs(xa-xb)/st,.08,.68,M.trim,'bfk');}
   if(hi)b.detail(()=>b.tube([a[0],a[1]+.95,a[2]+.32],[c[0],c[1]+.95,c[2]+.32],.045,M.bare,{n:3}));else b.quad([a[0],a[1],a[2]-.34],[c[0],c[1],c[2]-.34],[c[0],c[1],c[2]+.34],[a[0],a[1],a[2]+.34],M.trim,[0,-9,0]);}
  const m=P(1,0);qb(b,xb-.7,m[1]-.1,m[2],1.4,.1,.7,M.trim,'');const e=P(1,1);qb(b,xa+.5,e[1]-.1,e[2]-.1,1,.1,1,M.trim,'');if(hi)for(const p of [m,P(0,0)])b.tube([xb-1.3,-sink,p[2]+.26],[xb-1.3,m[1]-.1,m[2]+.26],.07,M.trim,{n:4});}
},{aoH:5,aoMin:.6});

// ------------------------------------------------------------------ creek-bridge ----------------------------------------
// The creek road bridge. o.w = span along x, o.d = deck width (6.8), o.prof = n + 1 deck heights along the span from
// x = -o.w / 2 to +o.w / 2 (relative to y = 0; default: a gentle 1.2 m arch). The deck's top surface is AT the profile,
// 0.42 thick; side girders with kerbs, a braced rail with a cyan light line at z = +-o.d / 2, lamp pylons and abutments at
// both ends, two piers down to y = -3.
WK.model('creek-bridge',(b,o)=>{const {pal}=b.k,M=pal.mil,hi=b.hi,W=o.w||18,D=o.d||6.8,hd=D/2,prof=Array.isArray(o.prof)&&o.prof.length>1?o.prof:Array.from({length:13},(_,i)=>+(1.2*Math.sin(i/12*Math.PI)).toFixed(3)),n=prof.length-1,X=i=>-W/2+W*i/n,
  Y=x=>{const t=Math.max(0,Math.min(n-1e-6,(x+W/2)/W*n)),i=Math.floor(t);return prof[i]+(prof[i+1]-prof[i])*(t-i);};
 for(let i=0;i<n;i++){const x0=X(i),x1=X(i+1),y0=prof[i],y1=prof[i+1],ym=(y0+y1)/2,Q=(a0,z0,a1,z1,m,ins)=>b.quad([x0,y0+a0,z0],[x1,y1+a0,z0],[x1,y1+a1,z1],[x0,y0+a1,z1],m,ins);
  Q(0,-hd,0,hd,M.hull2,[0,ym-9,0]);Q(-.42,-hd,-.42,hd,M.dark,[0,ym+9,0]);
  for(const s of [-1,1]){const zo=s*(hd+.16),zi=s*(hd-.16),c=[(x0+x1)/2,ym-.4,s*hd];Q(-.95,zo,.16,zo,M.hull,c);Q(.16,zi,.16,zo,M.trim,c);Q(0,zi,.16,zi,M.trim,c);Q(-.95,zi,-.95,zo,M.dark,c);if(hi)Q(-.95,zi,-.42,zi,M.hull2,c);
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
// The ice-mining drill rig (5 x 5, 9.6 m): skids and a deck, a four-leg lattice derrick, the glowing drill string through a
// rotary table, a travelling block, the crown block and winch, a motor housing with its stack, a mud tank, hoses.
WK.model('ice-rig',(b,o)=>{const {pal,glow}=b.k,M=pal.mil,hi=b.hi,sink=o.sink??.5;
 for(const s of [-1,1])b.bev(0,-sink,s*1.95,4.7,sink+.32,.56,M.hull2,{ch:.1});for(const x of [-1.9,0,1.9])qb(b,x,.02,0,.4,.26,3.4,M.hull2,'b');qb(b,0,.28,0,3.9,.1,3.5,M.hull,'b');
 b.truss(0,.38,0,3.3,.95,7.8,M.trim,{step:1.95,r:.085});
 if(hi)for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])qb(b,sx*1.65,.38,sz*1.65,.5,.16,.5,M.gold,'b');
 // the drill string, rotary table and travelling block
 b.tube([0,-sink,0],[0,5,0],.13,glow(0x22e6ff,1.2),{n:hi?6:4});b.tube([0,5.8,0],[0,8.2,0],.09,M.bare,{n:4});b.cyl(0,.38,0,.74,.34,M.hull2,{n:hi?10:6,bev:.06});
 b.bev(0,5,0,.86,.84,.7,M.hull2,{ch:.1});if(hi){b.cyl(0,.72,0,.4,.2,M.gold,{n:8});qb(b,0,5.3,.36,.5,.24,.03,M.hazard,'kb');for(const s of [-1,1])b.tube([s*.3,5.84,0],[s*.24,8.2,0],.03,M.dark,{n:3});b.halo(0,2.6,0,1.5,0x9ff6ff,.22);}
 // the crown block, the winch drum, the beacon
 b.bev(0,8.18,0,1.5,.5,1.5,M.hull2,{ch:.1});b.tube([-.5,8.95,0],[.5,8.95,0],.26,M.plate2,{n:hi?8:5,caps:true});for(const s of [-1,1])qb(b,s*.6,8.68,0,.12,.56,.6,M.hull,'b');
 b.tube([0,8.68,-.55],[0,9.5,-.55],.045,M.trim,{n:3});b.gem(0,9.5,-.55,.09,.1,.09,M.red);
 // the motor housing with its stack, the mud tank, hoses, work lights
 gearBox(b,-1.1,.38,-1.25,1.5,1.25,1,M.amber);b.cyl(-1.6,1.63,-1.4,.12,1.5,M.dark,{n:6});canister(b,1.25,.38,-1.2,.52,1.8,M.plate2);
 if(hi){b.cyl(-1.6,3.13,-1.4,.17,.1,M.bare,{n:6});b.cable([-.5,1.4,-.9],[0,.9,-.3],.3,.07,M.dark);b.cable([1.25,1.9,-.8],[.5,3.6,.1],-.5,.06,M.dark);b.cable([1.25,1.2,-.7],[.3,.8,-.2],.2,.06,M.dark);
  for(const s of [-1,1]){qb(b,s*.9,5.9,.95,.4,.14,.26,M.hull2,'b');qb(b,s*.9,5.86,.98,.3,.04,.18,M.white,'t');}b.halo(0,5.8,1,1.1,0xe8f6ff,.28);
  // the monkey board: a small platform with a rail half-way up
  qb(b,0,4.02,1.25,1.9,.08,.9,M.hull,'');b.detail(()=>{b.rail([[-.95,4.1,.85],[-.95,4.1,1.7],[.95,4.1,1.7],[.95,4.1,.85]],.8,M.bare,{step:1,r:.035});b.ladder([1.2,.4,1.62],[.62,4.05,1.02],M.bare,{w:.5});});
  hazard(b,0,.1,2.235,3.6,.2,9);}
},{aoH:3,aoMin:.6});

// ------------------------------------------------------------------ rail-pylon ------------------------------------------
// A monorail pylon: footing, a tapering octagonal column with a lit collar, a flared head (the same from every side, so
// it needs no heading). The column is o.h long in all (12.2): it starts o.sink (1) below y = 0, the head's top is at
// y = o.h - o.sink.
WK.model('rail-pylon',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,sink=o.sink??1,Y=(o.h||12.2)-sink,n=hi?8:6,X=(r,y)=>ngon(b,n,r,y,Math.PI/n),yc=Y*.56,rA=y=>.8-.2*y/(Y-1.5);
 if(hi)b.loft([X(1.08,-sink),X(1.08,.36),X(.86,.52)],M.hull2,{top:false});else b.loft([X(1.08,-sink),X(.9,.52)],M.hull2,{top:false});
 b.loft([X(rA(.5),.5),X(rA(yc-.4),yc-.4)],M.hull,{top:false});if(hi){b.loft([X(rA(yc)+.02,yc-.4),X(rA(yc)+.14,yc-.3),X(rA(yc)+.14,yc-.14)],M.hull2,{top:false});b.loft([X(rA(yc)+.14,yc+.14),X(rA(yc)+.14,yc+.3),X(rA(yc)+.02,yc+.4)],M.hull2,{top:false});}
 b.loft([X(rA(yc)+.17,yc-.14),X(rA(yc)+.17,yc+.14)],M.cyan,{top:false});b.loft([X(rA(yc+.4),yc+(hi?.4:.14)),X(.6,Y-1.5)],hi?M.plate2:M.hull,{top:false});
 b.loft([X(.6,Y-1.5),X(1.04,Y-.4),X(1.08,Y-.34),X(1.08,Y)],M.hull2,{top:true,topMat:M.trim});
 if(hi)for(let k=0;k<4;k++){const a=k*Math.PI/2;rad(b,a,1,Y-.26,q=>qb(q,0,0,0,.4,.12,.03,M.white,'kb'));rad(b,a,0,0,q=>q.loft([rc(q,.3,.36,.3,0,0,.9),rc(q,.22,.1,2.6,0,0,rA(2.6)*.92)],M.hull2,{top:false}));}
},{aoH:3,aoMin:.62});

// ------------------------------------------------------------------ rail-beam -------------------------------------------
// One span of the monorail beam: o.w long along x, the guide rail's top at y = 0. A box girder with flanges, the guide
// rail and a thin cyan line under the top flange on both sides. No end faces: spans chain.
WK.model('rail-beam',(b,o)=>{const M=b.k.pal.mil,hi=b.hi,L=o.w||8,x0=-L/2,x1=L/2,Q=(y0,z0,y1,z1,m,ins)=>b.quad([x0,y0,z0],[x1,y0,z0],[x1,y1,z1],[x0,y1,z1],m,ins);
 Q(0,-.17,0,.17,M.bare,[0,-1,0]);Q(-.14,-.55,-.14,.55,M.hull,[0,-1,0]);Q(-1.3,-.4,-1.3,.4,M.dark,[0,0,0]);
 for(const s of [-1,1]){Q(-.3,s*.55,-.14,s*.55,M.hull,[0,-.2,0]);Q(-.4,s*.5,-.3,s*.5,M.cyan,[0,-.3,0]);Q(-1.3,s*.4,-.4,s*.32,M.hull2,[0,-.8,0]);
  if(hi){Q(-.14,s*.17,0,s*.17,M.bare,[0,-.1,0]);Q(-.4,s*.32,-.4,s*.5,M.dark,[0,0,s*.4]);for(const x of [-L/2+.25,0,L/2-.25])b.quad([x-.12,-1.24,s*.42],[x+.12,-1.24,s*.42],[x+.12,-.44,s*.42],[x-.12,-.44,s*.42],M.trim,[x,-.8,0]);}}
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
