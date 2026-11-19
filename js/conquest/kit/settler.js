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
function clutter(b,x,z,n,seed){const {pal}=b.k,S=pal.set;for(let k=0;k<n;k++){const s=.62+.22*((seed+k*7)%3)/2,ox=(k%2)*.8,oy=k>=2?.72:0;b.part().bev(x+ox,oy,z+(k%3)*.16,s,s,s,k%2?S.timber:pick(S.fresh,seed+k),{ch:.05,ry:(seed+k)*.37});}
 if(b.hi&&n>1){b.cyl(x-.75,0,z+.2,.3,.82,S.rust,{n:8,bev:.04});b.ring(x-.75,.3,z+.2,.31,S.iron,{thin:true});b.ring(x-.75,.6,z+.2,.31,S.iron,{thin:true});}}
// a stovepipe chimney with a rain cap and a guy strut
function stovepipe(b,x,y,z,h){const S=b.k.pal.set;b.cyl(x,y,z,.16,h,S.iron,{n:6});b.cyl(x,y+h+.1,z,.3,.07,S.rust,{n:6,r2:.05});if(b.hi){b.ring(x,y+h*.55,z,.17,S.rust,{thin:true});b.tube([x,y+h*.6,z],[x+.5,y,z+.3],.025,S.iron,{n:3});}}
// a hanging lantern (the settlers' amber light)
function lantern(b,x,y,z,k=1){const S=b.k.pal.set;b.box(x,y-.3,z,.2,.26,.2,S.lamp);if(b.hi){b.box(x,y-.04,z,.26,.05,.26,S.iron);b.tube([x,y,z],[x,y+.25,z],.015,S.iron,{n:3});b.halo(x,y-.2,z,.7*k,0xffb060,.35);}}
// a small water tank on a timber stand
function waterTank(b,x,y,z,r,h,m){const S=b.k.pal.set;for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])b.tube([x+sx*r*.8,y,z+sz*r*.8],[x+sx*r*.7,y+h*.42,z+sz*r*.7],.07,S.timberD,{n:4});
 b.cyl(x,y+h*.42,z,r,h*.5,m,{n:b.hi?10:6,bev:.05});b.cyl(x,y+h*.92,z,r*1.04,h*.1,S.roofRust,{n:b.hi?10:6,r2:.08});if(b.hi){b.ring(x,y+h*.55,z,r*1.01,S.iron,{thin:true});b.ring(x,y+h*.8,z,r*1.01,S.iron,{thin:true});b.tube([x+r,y+h*.5,z],[x+r,y,z],.04,S.iron,{n:4});}}
// laundry on a line between two points
function laundry(b,a,c,seed){const S=b.k.pal.set;b.detail(()=>{b.cable(a,c,.12,.012,S.iron);for(let k=1;k<5;k++){const t=k/5,x=a[0]+(c[0]-a[0])*t,z=a[2]+(c[2]-a[2])*t,y=a[1]+(c[1]-a[1])*t-.12*4*t*(1-t),ry=Math.atan2(c[0]-a[0],c[2]-a[2])+Math.PI/2;b.at(x,y-.62,z,ry,q=>q.box(0,0,0,.42+.1*(k%2),.6,.03,pick(S.canvas,seed+k)));}});}
// a planter box with greens
function planter(b,x,y,z,w,d,seed){const S=b.k.pal.set;b.box(x,y,z,w,.3,d,S.timberD);b.box(x,y+.28,z,w-.12,.06,d-.12,S.soil);const n=b.hi?Math.max(2,Math.round(w/.45)):1;for(let k=0;k<n;k++)b.part().gem(x-w/2+w*(k+.5)/n,y+.5,z,.24,.3,.22,k%2?S.leaf:S.leafD,k*1.3+seed);}
// a hand-painted sign board with a lamp over it
function signBoard(b,x,y,z,w,seed){const S=b.k.pal.set;b.box(x,y,z,w,.55,.08,pick(S.fresh,seed));if(b.hi){b.box(x,y+.2,z+.045,w*.7,.1,.02,S.white);b.box(x-w*.2,y+.36,z+.045,w*.34,.06,.02,S.white);b.box(x,y+.6,z+.1,w*.5,.05,.12,S.iron);b.box(x,y+.55,z+.14,w*.3,.04,.05,S.lamp);}}

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
