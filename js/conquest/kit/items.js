/* LUNAR Conquest world kit — the four CONSUMABLES (Session 5E-2d2; the 5E addendum's "drop sprites for consumables": Repair
 * Kit, Shield Cell, Scanner Charge, Decoy Beacon as simple meshes). Each is a slot (js/conquest/slots.js item-*), one small
 * prop about a metre tall that reads by SHAPE and by its own light: repair = a field case with a green cross, shield = a
 * caged cyan cell, scanner = a dish with an amber sweep, decoy = a tripod beacon with a violet lamp. The 64 px icons the
 * HUD, the picker, the loot screen and the drop labels show are rendered from these models by
 * dev/tests/conquest-item-sprites.py (img/conquest/item-*.png), so the icon and the model are one design.
 * Front faces +z; b.hi === false is LOW. */
(function(root){
'use strict';
const WK=root.ConquestWorldKit,TAU=Math.PI*2;
const P=b=>{const {mat,glow,tint,pal}=b.k,M=pal.mil;return {M,gm:mat(0x2b3442,'metal',.25,.03),gm2:mat(0x3a4656,'metal',.3,.03),pale:mat(0xc9d2da,'metal',.25,.03),black:mat(0x14181d,'metal',.1,0),gold:M.gold,tint,glow,mat};};
// Repair Kit (1.1 x 0.9 x 0.8): a pale armoured field case, gunmetal corner guards, a carry handle, a lit green cross on the lid
// and the front, two gold latches.
WK.model('item-repair',(b,o)=>{const p=P(b),g=p.glow(0x12a544,.7),w=o.w-.08,h=o.h,d=o.d-.08,bh=h*.74,body=p.mat(0x8f9aa6,'metal',.2,.03),plate=p.mat(0xe6ecf0,'paint',.15,.02);
 b.bev(0,0,0,w,bh,d,body,{ch:.07,bot:true});b.bev(0,bh*.6,0,w+.03,.07,d+.03,p.gm,{ch:.02});
 for(const sx of [-1,1])for(const sz of [-1,1])b.bev(sx*(w/2-.08),0,sz*(d/2-.08),.2,bh+.02,.2,p.gm,{ch:.04});
 // a white panel with the green cross: on the lid and on the front
 b.box(0,bh,0,w*.62,.02,d*.66,plate);b.box(0,bh+.02,0,w*.5,.03,d*.2,g).box(0,bh+.02,0,w*.17,.03,d*.56,g);
 b.box(0,bh*.1,d/2,w*.5,bh*.42,.02,plate);b.box(0,bh*.25,d/2+.02,w*.4,bh*.13,.03,g).box(0,bh*.14,d/2+.02,w*.12,bh*.34,.03,g);
 for(const sx of [-1,1])b.box(sx*w*.34,bh*.62,d/2+.01,.09,.13,.04,p.gold);
 b.tube([-w*.2,bh,-d*.02],[-w*.2,h-.05,-d*.02],.035,p.gm2,{n:5}).tube([w*.2,bh,-d*.02],[w*.2,h-.05,-d*.02],.035,p.gm2,{n:5}).tube([-w*.23,h-.05,-d*.02],[w*.23,h-.05,-d*.02],.05,p.black,{n:6,caps:true});
 if(b.hi)b.halo(0,bh+.2,0,1.5,0x5fe08a,.22);},{aoH:.9,aoMin:.7});
// Shield Cell (0.8 x 1.2 x 0.8): an upright cyan energy cell between two gunmetal end caps, caged by four gold-banded struts.
WK.model('item-shield',(b,o)=>{const p=P(b),g=p.glow(0x46d9ff,1.6),r=Math.min(o.w,o.d)/2,h=o.h;
 b.cyl(0,0,0,r,.2*h,p.gm,{n:b.hi?12:8,bev:.04,bot:true});b.cyl(0,.2*h,0,r*.62,.56*h,g,{n:b.hi?12:8,top:false});b.cyl(0,.76*h,0,r,.16*h,p.gm,{n:b.hi?12:8,bev:.04});
 b.cyl(0,.92*h,0,r*.42,.08*h,p.gold,{n:8,bev:.02});
 for(let i=0;i<4;i++){const a=i/4*TAU+TAU/8,x=Math.cos(a)*r*.86,z=Math.sin(a)*r*.86;b.tube([x,.18*h,z],[x,.78*h,z],.05,p.gm2,{n:5});if(b.hi)b.ball(x,.48*h,z,.075,p.gold,true);}
 if(b.hi){b.ring(0,.48*h,0,r*.9,p.pale,{thin:true});b.halo(0,.5*h,0,1.7,0x46d9ff,.3);}},{aoH:1.2,aoMin:.7});
// Scanner Charge (1.0 x 1.0 x 1.0): a puck base with an amber sweep ring, a tilted pale dish on a short yoke and a feed horn.
WK.model('item-scanner',(b,o)=>{const p=P(b),g=p.glow(0xffb347,1.5),r=Math.min(o.w,o.d)/2,h=o.h;
 b.cyl(0,0,0,r*.92,.16*h,p.gm,{n:b.hi?14:8,bev:.04,bot:true});b.cyl(0,.16*h,0,r*.74,.05*h,g,{n:b.hi?14:8});b.cyl(0,.21*h,0,r*.36,.2*h,p.gm2,{n:8,bev:.02});
 b.at(0,.58*h,0,0,q=>{q.cyl(0,0,0,r*.8,.05*h,p.gm,{n:b.hi?14:8,r2:r*.9,bot:true,topMat:p.pale});q.cyl(0,.05*h,0,r*.3,.012,g,{n:b.hi?14:8});
  q.tube([0,.05*h,0],[0,.36*h,0],.035,p.gm2,{n:5});q.ball(0,.38*h,0,.09,g,true);for(let i=0;i<3;i++){const a=i/3*TAU;q.tube([Math.cos(a)*r*.7,.05*h,Math.sin(a)*r*.7],[0,.34*h,0],.02,p.gm2,{n:3});}},.7,-.25);
 if(b.hi)b.halo(0,.2*h,0,1.6,0xffb347,.22);},{aoH:1,aoMin:.7});
// Decoy Beacon (0.9 x 1.3 x 0.9): a tripod with a gunmetal head, a violet strobe lamp under a cage and a whip antenna.
WK.model('item-decoy',(b,o)=>{const p=P(b),g=p.glow(0xc18cff,1.7),r=Math.min(o.w,o.d)/2,h=o.h;
 for(let i=0;i<3;i++){const a=i/3*TAU+.5,x=Math.cos(a)*r*.74,z=Math.sin(a)*r*.74;b.tube([x,.04,z],[Math.cos(a)*.08,.52*h,Math.sin(a)*.08],.06,p.gm2,{n:5});b.cyl(x,0,z,.1,.05,p.black,{n:6,bot:true});}
 b.cyl(0,.48*h,0,r*.46,.14*h,p.gm,{n:b.hi?10:6,bev:.03,bot:true});b.cyl(0,.62*h,0,r*.42,.03*h,p.gold,{n:b.hi?10:6});
 b.dome(0,.65*h,0,r*.4,.24*h,r*.4,g,{n:b.hi?10:6,rings:b.hi?4:2});
 if(b.hi)for(let i=0;i<4;i++){const a=i/4*TAU;b.tube([Math.cos(a)*r*.43,.63*h,Math.sin(a)*r*.43],[Math.cos(a)*r*.1,.91*h,Math.sin(a)*r*.1],.022,p.gm2,{n:3});}
 b.cyl(0,.89*h,0,r*.12,.03*h,p.gm,{n:6});b.tube([0,.9*h,0],[.03,h,0],.015,p.pale,{n:3});
 if(b.hi)b.halo(0,.72*h,0,1.8,0xc18cff,.3);},{aoH:1.3,aoMin:.7});
})(typeof globalThis!=='undefined'?globalThis:window);
