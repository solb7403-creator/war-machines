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
})(typeof globalThis!=='undefined'?globalThis:window);
