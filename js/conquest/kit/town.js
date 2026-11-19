/* LUNAR Conquest world kit — TOWN models (Session 5E-2d1). The pilot's own town is MILITARY: dark armoured gunmetal, ribbed
 * and buttressed like the owner's Meshy town items (docs/art/meshy-proof/v2/item_town-*.webp), gold trim, cyan / white strip
 * lights and glowing domes. The buildings here stand in the same town, side by side with those Meshy models, at one scale.
 * Also in this file: the wall cell per ore blend, corner post, rubble, the six decorations, and the rusted, overgrown wrecks
 * of the frontier war band. Every model stays inside its slot box (js/conquest/slots.js); o.w / o.d are the footprint in
 * metres. b.hi === false is LOW: the same silhouette and colour blocks at 20-35% of the triangles.
 * Shared params of the town buildings: o.level 1..5 (cc 1..10), o.finish null | 'sand' | 'graphite' (the player's armour
 * theme), o.accent = hex of the accent light (default cyan at levels 1-2, teal at 3-4, gold at 5). Front faces +z. */
(function(root){
'use strict';
const WK=root.ConquestWorldKit,TAU=Math.PI*2,HP=Math.PI/2;

// ------------------------------------------------------------------ shared town parts ----------------------------------
// the town palette for one building: armour by the player's finish, accent light by level (or the player's theme)
function TP(b,o,maxL=5){const {mat,glow,tint,pal}=b.k,M=pal.mil,L=Math.max(1,Math.min(maxL,(o.level|0)||1)),fh=o.finish==='sand'?0x8f7c62:o.finish==='graphite'?0x353d49:0x343a43,
  ah=o.accent!=null?o.accent:(L>=5?0xffd36b:L>=3?0x2dffc4:0x22e6ff),arm=mat(fh,'metal',.3,.04);
 return {L,M,ah,arm,arm2:tint(arm,.7),rib:tint(arm,1.32,.012),lite:tint(arm,1.7,.03),dark:M.dark,black:mat(0x0b0d10,'metal',.1,0),gold:M.gold,goldG:glow(0xffd36b,.85),apron:mat(0x7d848d,'concrete',.3),
  acc:glow(ah,1),accS:glow(ah,.7),white:M.white,ice:M.ice,amber:M.amber,fire:glow(0xff8a3d,1.5),trim:L>=5?M.gold:tint(arm,1.5,.02)};}
// cheap box: four sides and a top (no bottom), 10 triangles
function cb(b,x,y,z,w,h,d,m,ry){if(ry)return b.at(x,y,z,ry,q=>cb(q,0,0,0,w,h,d,m));const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2,y1=y+h,c=[x,y,z];
 b.quad([x0,y,z1],[x1,y,z1],[x1,y1,z1],[x0,y1,z1],m,c).quad([x0,y,z0],[x1,y,z0],[x1,y1,z0],[x0,y1,z0],m,c).quad([x0,y,z0],[x0,y,z1],[x0,y1,z1],[x0,y1,z0],m,c).quad([x1,y,z0],[x1,y,z1],[x1,y1,z1],[x1,y1,z0],m,c).quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],m,c);return b;}
// armoured block: bevelled on HIGH, a cheap box on LOW
const ab=(b,x,y,z,w,h,d,m,ch=.1)=>b.hi?b.bev(x,y,z,w,h,d,m,{ch}):cb(b,x,y,z,w,h,d,m);
// a buttress fin on a wall whose outward normal is +z of the current frame: sloped shoulder, lighter front edge (8 tris)
function fin(b,x,y,w,h,dp,m,o={}){const z=o.z||0,sh=Math.min(o.sh??.5,h*.6),x0=x-w/2,x1=x+w/2,z1=z+dp,yt=y+h,yf=yt-sh,c=[x,y+h*.4,z+dp*.3],f=o.front||m;
 b.quad([x0,y,z1],[x1,y,z1],[x1,yf,z1],[x0,yf,z1],f,c).quad([x0,y,z],[x0,y,z1],[x0,yf,z1],[x0,yt,z],m,c).quad([x1,y,z],[x1,y,z1],[x1,yf,z1],[x1,yt,z],m,c).quad([x0,yf,z1],[x1,yf,z1],[x1,yt,z],[x0,yt,z],f,c);return b;}
// a flat light strip / panel on the +z plane of the current frame
// a band around a rectangular body (four faces, no top): eave trims, light lines
const band=(b,x,y,z,w,h,d,m)=>b.loft([{p:b.k.rect(w,d,0,x,z),y},{p:b.k.rect(w,d,0,x,z),y:y+h}],m,{top:false});
const strip=(b,x,y,z,w,h,m)=>b.quad([x-w/2,y,z],[x+w/2,y,z],[x+w/2,y+h,z],[x-w/2,y+h,z],m,[x,y,z-1]);
// run fn in n frames around a circle, +z pointing outward
function around(b,cx,cz,r,n,rot,fn){for(let i=0;i<n;i++){const a=i/n*TAU+rot;b.at(cx+Math.cos(a)*r,0,cz+Math.sin(a)*r,-a+HP,q=>fn(q,i,a));}}
// a band around an upright round body (a collar, a light ring): cheap replacement for a torus
function hoop(b,x,y,z,r,hh,t,m,n,rot=0,simple){const C=b.k.circ,R=b.hi&&!simple?[{p:C(r,n,x,z,r,rot),y},{p:C(r+t,n,x,z,r+t,rot),y:y+hh*.25},{p:C(r+t,n,x,z,r+t,rot),y:y+hh*.75},{p:C(r,n,x,z,r,rot),y:y+hh}]:[{p:C(r+t,n,x,z,r+t,rot),y},{p:C(r+t,n,x,z,r+t,rot),y:y+hh}];return b.loft(R,m,{top:false,smooth:true});}
// the apron every town building stands on: a thin concrete slab, the accent light line on its front edge; vital = gold corner marks
function apron(b,o,p,vital){const w=o.w-.4,d=o.d-.4;ab(b,0,0,0,w,.3,d,p.apron,.07);cb(b,0,.3,d/2-.3,w-.8,.05,.1,p.accS);
 if(b.hi)for(const sx of [-1,1]){cb(b,sx*(w/2-.3),.3,d/2-1.1,.1,.05,1.2,p.accS);}
 if(vital)for(const sx of [-1,1])cb(b,sx*(w/2-.5),.3,-d/2+.5,.6,.08,.6,b.k.glow(0xffd36b,1.2));}
// an armoured sliding door on the +z plane of the current frame: frame, dark slatted leaf, a light band over it
function gateDoor(b,p,x,y,w,h,light,o={}){const fd=o.fd||.22;ab(b,x,y,0+fd/2,w+.6,h+.45,fd,p.arm2,.08);strip(b,x,y,fd+.02,w,h,p.black);strip(b,x,y+h+.1,fd+.03,w*.94,o.lh||.2,light);
 if(b.hi){const n=o.slats??Math.max(2,Math.round(h/.7));for(let k=1;k<n;k++)cb(b,x,y+h*k/n-.03,fd+.03,w,.06,.05,p.rib);if(o.split!==false)cb(b,x,y,fd+.03,.1,h,.06,p.rib);}return b;}
// a tank / small armoured machine parked on the apron, gun toward +z
function parked(b,p,x,y,z,s,k){const M=p.M,tc=k%2?M.plate2:M.plate;if(!b.hi){cb(b,x,y+.12*s,z,2.1*s,.75*s,3*s,p.rib);cb(b,x,y+.87*s,z-.2*s,1.2*s,.5*s,1.4*s,tc);b.tube([x,y+1.1*s,z+.4*s],[x,y+1.1*s,z+2*s],.11*s,M.dark,{n:4});return;}
 for(const sx of [-1,1])b.loft([{p:b.k.rect(.5*s,2.7*s,0,x+sx*.9*s,z),y},{p:b.k.rect(.5*s,3.1*s,0,x+sx*.9*s,z),y:y+.3*s},{p:b.k.rect(.5*s,2.9*s,0,x+sx*.9*s,z),y:y+.62*s}],M.dark);
 b.bev(x,y+.3*s,z,1.5*s,.62*s,2.9*s,p.rib,{ch:.1*s});b.bev(x,y+.92*s,z-.25*s,1.15*s,.46*s,1.35*s,tc,{ch:.09*s});b.tube([x,y+1.14*s,z+.35*s],[x,y+1.14*s,z+2.05*s],.1*s,M.dark,{n:6,caps:true});b.tube([x,y+1.14*s,z+1.7*s],[x,y+1.14*s,z+2.1*s],.15*s,M.trim,{n:6});
 cb(b,x,y+.93*s,z+1.46*s,.9*s,.05,.04,p.accS);cb(b,x-.3*s,y+1.38*s,z-.4*s,.3*s,.1*s,.3*s,p.gold);}
// a round armoured tank standing upright: body, domed cap, hoops
function vessel(b,p,x,y,z,r,h,m,o={}){const n=o.n||(b.hi?10:6);b.cyl(x,y,z,r,h,m,{n,bev:.06});if(o.dome!==false)b.dome(x,y+h,z,r*.96,r*(o.dh||.55),r*.96,o.cap||m,{n,rings:b.hi?3:2});
 if(b.hi||o.keep){const k=o.hoops??2;for(let i=1;i<=k;i++)hoop(b,x,y+h*i/(k+1)-.07,z,r,.14,.05,o.hoop||p.rib,n);}return b;}

// ------------------------------------------------------------------ town-foundry (3x3) ---------------------------------
// Smelter: a ribbed, vaulted furnace hall, a tall stack with a glowing orange rim, a pour channel into a glowing crucible,
// ingot stacks on the apron, a heavy door under an amber band. Level: taller stack and hall, more ingots, a second stack,
// a roof blower, gold trim at 5.
WK.model('town-foundry',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,rect,circ,mat,tint}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2;apron(b,o,p);
 const bw=o.w-2.8,bd=o.d*.52,bz=-hd+.85+bd/2,bh=3.3+.16*L,y0=.3,zf=bz+bd/2,ry=y0+bh,rr=bd/2+.16,rh=1.1+.07*L,vn=hi?8:4;
 ab(b,0,y0,bz,bw+.5,.6,bd+.5,p.arm2,.14);ab(b,0,y0+.6,bz,bw,bh-.6,bd,p.arm,.1);
 // the ribbed vault roof, an eave band (gold at 5)
 b.vault(0,ry,bz,bw+.16,rr,p.arm2,{n:vn,h:rh,ends:p.arm});const nr=hi?8:4;for(let k=0;k<nr;k++)b.vault(-(bw/2-.3)+(bw-.6)*k/(nr-1),ry,bz,.36,rr+.1,p.rib,{n:vn,h:rh+.1});
 band(b,0,ry-.2,bz,bw+.26,.2,bd+.26,p.trim);
 // buttress fins on every wall; the front leaves room for the door and the furnace mouth
 const dx=-bw*.2,dw=3.2,dh=2.5,cx=bw*.27,cz=zf+2.25;
 b.at(0,0,zf,0,q=>{for(const x of hi?[-bw/2+.3,dx-dw/2-.75,dx+dw/2+.75,cx-1,cx+1,bw/2-.3]:[-bw/2+.3,bw/2-.3])fin(q,x,y0+.6,.42,bh-.75,.3,p.arm2,{front:p.rib});
  gateDoor(q,p,dx,y0,dw,dh,M.amber);
  // the furnace mouth and the pour channel
  ab(q,cx,2.1,.2,1.5,1.1,.4,p.arm2,.08);strip(q,cx,2.3,.43,1,.55,p.fire);});
 b.at(0,0,bz-bd/2,Math.PI,q=>{const n=hi?6:3;for(let k=0;k<n;k++)fin(q,-(bw/2-.3)+(bw-.6)*k/(n-1),y0+.6,.42,bh-.75,.3,p.arm2,{front:p.rib});});
 for(const s of [-1,1])b.at(s*bw/2,0,bz,s*HP,q=>{const n=hi?4:2;for(let k=0;k<n;k++)fin(q,-(bd/2-.5)+(bd-1)*k/(n-1),y0+.6,.42,bh-.75,.3,p.arm2,{front:p.rib});if(hi)strip(q,0,y0+bh*.55,.03,bd*.5,.12,p.accS);});
 b.at(cx,2.34,zf+.4,0,q=>{cb(q,0,-.22,.75,.8,.22,1.5,p.arm2);q.quad([-.14,.02,0],[.14,.02,0],[.14,.02,1.5],[-.14,.02,1.5],p.fire,[0,-1,0]);for(const s of [-1,1])cb(q,s*.33,0,.75,.14,.14,1.5,p.rib);},.2);
 // the crucible on its cradle
 const iron=mat(0x3b2f2a,'metal',.7),cn=hi?10:6;
 b.loft([{p:circ(.8,cn,cx,cz),y:.85},{p:circ(1.22,cn,cx,cz),y:1.35},{p:circ(1.28,cn,cx,cz),y:1.95}],iron,{smooth:true,top:true,topMat:glow(0xff8a3d,1.55),bot:true});
 b.loft([{p:circ(1.34,cn,cx,cz),y:1.84},{p:circ(1.34,cn,cx,cz),y:2.06},{p:circ(.82,cn,cx,cz),y:2.06}],p.arm2,{top:false});
 for(const s of [-1,1]){if(hi){cb(b,cx+s*1.38,.3,cz,.3,1.5,.9,p.arm2);b.tube([cx+s*1.22,1.5,cz],[cx+s*1.6,1.5,cz],.16,p.rib,{n:6,caps:true});}
  // the gantry over the crucible: posts, beam, hoist
  b.tube([cx+s*1.72,.3,cz+.75],[cx+s*1.72,3.5,cz+.75],.11,p.rib,{n:hi?5:3});if(hi)b.tube([cx+s*1.72,2.6,cz+.75],[cx+s*1.1,3.5,cz+.75],.07,p.rib,{n:3});}
 cb(b,cx,3.5,cz+.75,3.9,.26,.34,p.arm);if(hi){cb(b,cx+.4,3.2,cz+.75,.5,.3,.5,M.hazard);b.tube([cx+.4,2.5,cz+.75],[cx+.4,3.2,cz+.75],.03,M.bare,{n:3});cb(b,cx+.4,2.36,cz+.75,.2,.16,.2,p.arm2);}
 if(hi){b.tube([cx,2.05,zf+1.85],[cx,1.98,cz-.6],.09,p.fire,{n:4});b.halo(cx,2.3,cz,2.2,0xff8a3d,.22);b.pool(cx,.34,cz,2,2,0xff8a3d,.16);}
 // the stack: taller with every level, a glowing rim
 const stack=(sx,sz,r,top,hot)=>{const n=hi?10:6;b.cyl(sx,ry-.1,sz,r*1.32,rh+.5,p.arm,{n:hi?8:6,bev:.1});b.cyl(sx,ry+rh+.3,sz,r,top-ry-rh-.3,p.arm2,{n,r2:r*.78,top:false});
  const nh=hi?3:1;for(let k=1;k<=nh;k++){const t=k/(nh+1),yy=ry+rh+.3+(top-ry-rh-.3)*t,rk=r+(r*.78-r)*t;hoop(b,sx,yy,sz,rk,.2,.07,k===nh&&L>=5?p.gold:p.rib,n);}
  b.cyl(sx,top-.28,sz,r*.78,.28,p.dark,{n,r2:r*.98,top:false});b.cyl(sx,top,sz,r*1.0,.14,hot,{n,topMat:p.black});if(hi)b.halo(sx,top+.4,sz,2*r,0xff8a3d,.22);};
 stack(-bw*.3,bz-bd*.16,.8,y0+5.3+.65*L,glow(0xff8a3d,1.4));
 if(L>=3)stack(-bw*.3+1.9,bz-bd*.16,.5,y0+4.1+.55*L,glow(0xff8a3d,1.2));
 // ingot stacks on pallets (more with every level; the newest still glows)
 const ing=mat(0xa59f8e,'metal',.15,.1),hot=glow(0xff8a3d,.42);
 for(let k=0;k<2+L;k++){const c=k%3,lay=(k/3)|0,x=-hw+1.55+c*1.5,y=.44+lay*.36,z=hd-1.45;if(!lay)cb(b,x,.3,z,1.34,.14,1.6,p.arm2);
  if(hi)for(const d of [-.31,.31])b.part().loft([{p:rect(.54,1.36,0,x+d,z),y},{p:rect(.36,1.18,0,x+d,z),y:y+.32}],k===1+L?hot:ing);else cb(b,x,y,z,1.1,.32,1.3,k===1+L?hot:ing);}
 // level kit: a gas bottle rack, a roof blower, roof lights along the eave
 if(L>=2){for(let k=0;k<Math.min(3,L-1);k++)vessel(b,p,bw/2-.5-k*.8,y0,zf+.6,.33,hi?1.5:1.7,k%2?M.plate2:M.plate,{hoops:1,hoop:p.gold,n:hi?8:5,dome:hi});}
 if(L>=4){ab(b,bw*.22,ry+rh*.72,bz,2,.7,1.6,p.arm,.08);b.cyl(bw*.22,ry+rh*.72+.7,bz,.5,.2,p.dark,{n:8});if(hi)hoop(b,bw*.22,ry+rh*.72+.8,bz,.5,.12,.05,p.gold,8);}
 for(let k=0;k<L;k++){const x=-(bw/2-.9)+(bw-1.8)*(L>1?k/(L-1):.5);if(hi)cb(b,x,ry,zf+.14,.5,.14,.12,p.acc);else strip(b,x,ry-.02,zf+.15,.5,.16,p.acc);}
 if(L>=5){band(b,0,y0+.6,bz,bw+.08,.12,bd+.08,p.gold);for(const s of [-1,1])cb(b,s*(bw/2+.02),ry-.2,zf,.5,.3,.5,p.goldG);}
});

// ------------------------------------------------------------------ town-biodome (3x3) ---------------------------------
// A glass dome on an armoured hex ring with rib arches; the lower panes show the green of the plants inside. Planters with
// shrubs and a nutrient tank stand in the apron's corners. Level: the dome rises, more planters and tanks, a gold crown at 5.
WK.model('town-biodome',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,circ,mat,tint,pal}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2;apron(b,o,p);
 const R=Math.min(hw,hd)-.95,C6=Math.cos(Math.PI/6),hex=(r,y)=>({p:circ(r,6,0,0,r,0),y}),rd=R-.75,dh=2.2+.64*L,yb=1.3,n=hi?12:6,lat=hi?4:2;
 // the armoured ring: plinth, belt light, deck
 b.loft([hex(R,.3),hex(R,1.0),hex(R-.3,yb),hex(rd-.1,yb)],(r)=>r?p.arm2:p.arm,{top:false});b.loft([hex(R+.05,.62),hex(R+.05,.76)],p.accS,{top:false});
 if(L>=5)b.loft([hex(R+.04,.98),hex(R+.04,1.1)],p.gold,{top:false});
 // the dome: flat glass facets; the lower band is tinted by the foliage inside
 const gl=[mat(0x5f93b8,'glass',.1),mat(0x78aed0,'glass',.16)],gr=[mat(0x2f7a3c,'glass',.16),mat(0x245a30,'glass',.1),mat(0x4a9448,'glass',.2)],rings=[];
 for(let i=0;i<=lat;i++){const t=i/lat*HP*.9,c=Math.cos(t),s=Math.sin(t);rings.push({p:circ(rd*c,n,0,0,rd*c,Math.PI/n),y:yb+dh*s/Math.sin(HP*.9)*.94});}
 b.loft(rings,(r,i)=>r===0?(hi&&i%5===3?gl[0]:gr[(i*7)%3]):(r===1&&hi&&i%3!==1?gr[(i+1)%3]:gl[(i+r)%2]),{top:true,topMat:p.arm2});
 // rib arches from the six corners to the crown, corner piers with a light slit
 for(let k=0;k<6;k++){const a=k*Math.PI/3,ca=Math.cos(a),sa=Math.sin(a);let q0=[ca*(rd+.08),yb,sa*(rd+.08)];const seg=hi?4:2;
  for(let i=1;i<=seg;i++){const t=i/seg*HP*.9,c=Math.cos(t)*(rd+.08),q1=[ca*c,yb+dh*Math.sin(t)/Math.sin(HP*.9)*.94+.05,sa*c];b.tube(q0,q1,.13,p.rib,{n:hi?4:3});q0=q1;}
  b.at(ca*(R-.25),0,sa*(R-.25),-a+HP,q=>{fin(q,0,.3,.8,1.75,.42,p.arm2,{front:p.rib,sh:.55,z:-.2});if(k%2===0)strip(q,0,.75,.24,.14,.7,p.acc);});}
 const yt=yb+dh*.94;b.cyl(0,yt-.12,0,.95,.4,p.arm,{n:hi?8:6,bev:.08});b.cyl(0,yt+.28,0,.5,.3,p.acc,{n:6,topMat:p.dark});if(L>=5&&hi)hoop(b,0,yt+.08,0,.95,.2,.08,p.gold,8);
 if(hi){for(const t of [.33,.66]){const a=t*HP*.9,c=Math.cos(a)*(rd+.03);hoop(b,0,yb+dh*Math.sin(a)/Math.sin(HP*.9)*.94-.05,0,c,.1,.04,p.rib,n,Math.PI/n);}b.halo(0,yb+dh*.5,0,R*1.5,0x9fe8c8,.1);}
 // the airlock on the front face
 b.at(0,0,R*C6-.2,0,q=>{ab(q,0,.3,.45,2.5,2.1,1.1,p.arm,.1);strip(q,0,.4,1.01,1.3,1.6,glow(p.ah,.8));strip(q,0,2.08,1.01,1.7,.1,p.white);if(hi){cb(q,0,.4,1.02,.08,1.6,.04,p.dark);for(const s of [-1,1])fin(q,s*1.05,.3,.3,2.2,.2,p.arm2,{front:p.rib,z:1});}});
 // planters and shrubs in the apron's corners (more with every level), the nutrient tank and its pipe at the back
 const leaf=pal.set.leaf,leafD=pal.set.leafD,soil=pal.set.soil;
 const planter=(x,z,ry,k)=>b.at(x,.3,z,ry,q=>{ab(q,0,0,0,2.3,.5,1.1,p.arm2,.07);cb(q,0,.5,0,2.05,.06,.86,soil);const m=hi?3:2;for(let i=0;i<m;i++){const s=.34+.09*((i+k)%2)+.03*L;q.part().ball((i-(m-1)/2)*(2/m),.56+s*.75,((i+k)%2-.5)*.12,s,(i+k)%2?leaf:leafD,true);}if(hi)strip(q,0,.2,.56,1.6,.07,p.accS);});
 const cxr=hw-1.25,czr=hd-.95;planter(-cxr+.2,czr,0,0);if(L>=2)planter(cxr-.2,czr,0,1);if(L>=3)planter(-hw+.95,-hd+2.2,HP,2);if(L>=4)planter(hw-.95,-hd+2.2,HP,3);
 const tk=1.7+.22*L;vessel(b,p,hw-1.5,.3,-hd+1.25,.62,tk,M.plate,{hoop:p.gold,cap:M.plate2});if(hi)b.pipe([[hw-1.5,.3+tk*.6,-hd+1.9],[hw-1.5,.9,-hd+2.5],[R*.8,.9,-R*.55]],.1,M.bare);
 if(L>=3)vessel(b,p,-hw+1.5,.3,-hd+1.25,.55,tk-.5,M.plate2,{hoop:p.rib,cap:M.plate});
 if(L>=5)vessel(b,p,hw-2.85,.3,-hd+1.05,.45,tk-.9,tint(leaf,1.1),{hoop:p.gold,hoops:1});
});

// ------------------------------------------------------------------ town-hangar (4x3) ----------------------------------
// A wide vehicle hangar: armoured walls under a ribbed arch roof, the big dark door with a lit header in the arched front,
// parked machines on the apron (one more per level, up to four), roof lights, a control cab and a mast at higher levels.
WK.model('town-hangar',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,rect,mat}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2;apron(b,o,p);
 const bw=o.w-1.5,bd=o.d*.55,bz=-hd+.7+bd/2,zf=bz+bd/2,y0=.3,wh=2.7+.14*L,ry=y0+wh,rh=2.1+.14*L,vn=hi?8:4;
 ab(b,0,y0,bz,bw+.4,.5,bd+.4,p.arm2,.12);ab(b,0,y0+.5,bz,bw,wh-.5,bd,p.arm,.1);
 // the arch roof spans the width; its gable faces the front. Ribs every ~1.2 m.
 b.at(0,ry,bz,HP,q=>{q.vault(0,0,0,bd+.1,bw/2+.1,p.arm2,{n:vn,h:rh,ends:p.arm});const nr=hi?6:3;for(let k=0;k<nr;k++)q.vault(-(bd/2-.22)+(bd-.44)*k/(nr-1),0,0,.4,bw/2+.22,k===nr-1&&L>=5?p.gold:p.rib,{n:vn,h:rh+.12});});
 band(b,0,ry-.18,bz,bw+.24,.18,bd+.24,p.trim);
 // the door wall: frame, slatted leaf, lit header, corner buttresses; side fins
 const dw=bw*.66,dh=wh+rh*.28;
 b.at(0,0,zf,0,q=>{gateDoor(q,p,0,y0,dw,dh,p.acc,{lh:.24,fd:.26});for(const s of [-1,1]){fin(q,s*(bw/2-.35),y0+.5,.6,wh-.5,.42,p.arm2,{front:p.rib});if(hi){fin(q,s*(dw/2+1),y0+.5,.42,wh-.3,.3,p.arm2,{front:p.rib});strip(q,s*(bw/2-.35),y0+1,.44,.14,wh*.4,p.accS);}}
  if(hi){for(const s of [-1,1])for(let k=0;k<3;k++)strip(q,s*(dw/2+.18),y0+.2+k*.5,.3,.2,.25,k%2?M.hazardD:M.hazard);strip(q,0,ry+rh*.55,.06,1.6,.3,p.white);}});
 for(const s of [-1,1])b.at(s*bw/2,0,bz,s*HP,q=>{const n=hi?5:2;for(let k=0;k<n;k++)fin(q,-(bd/2-.4)+(bd-.8)*k/(n-1),y0+.5,.42,wh-.6,.28,p.arm2,{front:p.rib});});
 if(hi)b.at(0,0,bz-bd/2,Math.PI,q=>{for(let k=0;k<7;k++)fin(q,-(bw/2-.4)+(bw-.8)*k/6,y0+.5,.42,wh-.6,.28,p.arm2,{front:p.rib});});
 // roof lights along the ridge (one per level), the control cab and the mast
 for(let k=0;k<L;k++){const z=bz-(bd/2-.8)+(bd-1.6)*(L>1?k/(L-1):.5);cb(b,0,ry+rh+.1,z,.5,.16,.5,p.white);}
 if(L>=3){const x=bw*.3,yy=ry+rh*.7,ch=6.84-yy;ab(b,x,yy,bz+bd*.2,2.4,ch,2,p.arm,.1);b.at(x,yy,bz+bd*.2+1,0,q=>strip(q,0,ch*.4,.02,2,ch*.36,M.ice));cb(b,x,yy+ch,bz+bd*.2,2.6,.12,2.2,p.arm2);}
 if(L>=4){const x=-bw*.32,yy=ry+rh*.7;b.cyl(x,yy,bz,.34,.6,p.arm2,{n:6});const mt=6.74-yy;b.tube([x,yy+.6,bz],[x,yy+mt,bz],.08,M.trim,{n:5});cb(b,x,yy+mt,bz,.22,.22,.22,M.red);if(hi){b.tube([x-.6,yy+mt*.7,bz],[x+.6,yy+mt*.7,bz],.04,M.bare,{n:3});b.halo(x,yy+mt+.1,bz,.6,0xff3048,1);}}
 // parked machines, guns outward
 const nm=Math.min(4,L),span=bw-3.4;for(let k=0;k<nm;k++)parked(b,p,nm>1?-span/2+span*k/(nm-1):0,y0,zf+2.05,1,k);
 if(hi){b.pool(0,.34,zf+1.6,dw*.5,1.8,p.ah,.16);for(const s of [-1,1])for(let k=0;k<4;k++)cb(b,s*(dw/2+.1),.3,zf+.7+k*.9,.16,.05,.5,p.acc);
  for(const s of [-1,1])b.at(s*bw/2,0,bz,s*HP,q=>{for(let k=0;k<4;k++)strip(q,-(bd/2-.4)+(bd-.8)*(k+.5)/4,y0+wh*.62,.03,.7,.2,M.ice);});}
});

// ------------------------------------------------------------------ town-helium (2x2) ----------------------------------
// Helium-3 extractor: a lattice derrick over a ribbed pump housing, the drill column with its travelling block, a top
// light, and a rack of glowing pale-ice gas canisters (one more per level, up to four). Level: a taller derrick, a work
// deck with lights, a cooler, gold crown and caps at 5.
WK.model('town-helium',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,cz=-.75,top=y0+5.3+L;apron(b,o,p);
 // pump housing and well head
 b.cyl(0,y0,cz,1.7,.6,p.arm2,{n:8,bev:.12});b.cyl(0,y0+.6,cz,1.2,1,p.arm,{n:hi?10:8,bev:.08});if(hi)around(b,0,cz,1.18,8,.3,q=>fin(q,0,y0+.6,.3,1,.3,p.arm2,{front:p.rib,sh:.4}));
 hoop(b,0,y0+1.52,cz,.82,.2,.1,L>=5?p.gold:p.rib,8);
 // the drill column, its collars and the travelling block
 const ct=top-.5;b.cyl(0,y0+1.6,cz,.36,ct-y0-1.6,p.dark,{n:hi?8:5,top:false});if(hi)for(let y=y0+2.5;y<ct-.5;y+=1.15)hoop(b,0,y,cz,.36,.18,.08,p.rib,8,0,1);
 const tb=y0+1.6+(ct-y0-1.6)*.58;b.cyl(0,tb,cz,.72,.5,p.arm,{n:8});hoop(b,0,tb+.17,cz,.72,.16,.05,p.acc,8,0,1);
 // the derrick, its shoes, crown and top light
 b.truss(0,y0,cz,3.5,.95,ct-y0,p.rib,{step:hi?2:3.3,r:.1});if(hi)for(const sx of [-1,1])for(const sz of [-1,1])cb(b,sx*1.75,y0,cz+sz*1.75,.66,.3,.66,p.arm2);
 cb(b,0,ct,cz,1.5,.26,1.5,p.arm2);b.cyl(0,ct+.26,cz,.3,.34,L>=5?p.gold:p.arm,{n:6});cb(b,0,ct+.6,cz,.4,.4,.4,glow(p.ah,1.4));if(hi)b.halo(0,ct+.8,cz,1,p.ah,.5);
 if(L>=4){const wy=y0+(ct-y0)*.36,ww=3.5+(.95-3.5)*.36+.5;cb(b,0,wy,cz,ww,.14,ww,p.arm2);if(hi)for(const sx of [-1,1])for(const sz of [-1,1])cb(b,sx*ww/2,wy+.14,cz+sz*ww/2,.16,.16,.16,p.white);}
 // the canister rack: glowing pale-ice gas bottles with armoured ends, a manifold back to the pump
 const nc=Math.min(4,L),ice=glow(0xa8f8ff,.3),zc=hd-1.3,n=hi?8:5;cb(b,0,y0,zc,o.w-1.5,.18,1.6,p.arm2);
 for(let k=0;k<nc;k++){const x=-hw+1.45+k*1.7;if(hi)b.cyl(x,y0+.18,zc,.6,.26,p.arm,{n,top:false});b.cyl(x,y0+(hi?.44:.18),zc,.52,hi?1.26:1.52,ice,{n,top:false});b.cyl(x,y0+1.7,zc,.6,.24,L>=5?p.gold:p.arm,{n});
  if(hi){b.cyl(x,y0+1.94,zc,.16,.18,M.bare,{n:5});hoop(b,x,y0+1,zc,.52,.12,.05,p.arm,n,0,1);b.tube([x,y0+2.02,zc],[x,y0+2.02,zc-.8],.06,M.bare,{n:4});}}
 if(hi){const x1=-hw+1.45+(nc-1)*1.7;b.pipe([[x1,y0+2.02,zc-.8],[-hw+1.45,y0+2.02,zc-.8],[-hw+1.45,y0+.9,zc-1.1],[-1,y0+.9,cz+.7]],.08,M.bare);b.pool(-hw+1.45+(nc-1)*.85,.34,zc+.2,nc*.9+.4,1.2,0xa8f8ff,.14);}
 // level kit: a cooler block with slats at the back
 if(L>=3){const x=hw-1.35,z=-hd+1.15;ab(b,x,y0,z,1.7,1.5,1.3,p.arm,.08);if(hi){b.at(x,0,z+.65,0,q=>{for(let k=0;k<4;k++)cb(q,0,y0+.3+k*.27,.03,1.3,.1,.06,p.rib);strip(q,.55,y0+1.25,.03,.2,.1,M.amber);});b.cyl(x,y0+1.5,z,.4,.16,p.dark,{n:8});}}
});

// ------------------------------------------------------------------ town-radar (2x2) + town-radar-dish ------------------
// Radar station base: an armoured block plinth (3 x 1 x 3) and the mast (r 0.5, height 3 + 0.5 * level) whose top carries
// the separately turning dish ('town-radar-dish', placed with its origin at y = 0.3 + 3 + 0.5 * level). Cable reels, a
// control cabinet, a status light.
function reel(b,p,x,y,z,r,ry){b.at(x,y,z,ry,q=>{const M=p.M;for(const s of [-1,1]){q.tube([s*.34,r,0],[s*.42,r,0],r,p.rib,{n:b.hi?8:6,caps:true});cb(q,s*.5,0,0,.1,r+.08,.9,p.arm2);}q.tube([-.34,r,0],[.34,r,0],r*.66,M.dark,{n:b.hi?8:6});if(b.hi)q.tube([-.56,r,0],[.56,r,0],.09,p.gold,{n:5,caps:true});});}
WK.model('town-radar',(b,o)=>{const p=TP(b,o),{L,M}=p,{rect,glow}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,mt=y0+3+.5*L,n=hi?10:6;apron(b,o,p);
 // the plinth: a chamfered armoured block, light slits on its faces, struts to the mast
 b.loft([{p:rect(3,3,.55),y:y0},{p:rect(3,3,.55),y:y0+.78},{p:rect(2.5,2.5,.5),y:y0+1}],(r)=>r?p.arm2:p.arm);
 for(let k=0;k<4;k++)b.at(0,0,0,k*HP,q=>{strip(q,0,y0+.3,1.52,1.3,.14,p.acc);if(hi){for(const s of [-1,1])fin(q,s*.86,y0,.26,.86,.16,p.arm2,{front:p.rib,z:1.44,sh:.2});q.tube([.9,y0+1,.9],[.3,y0+2.3,.3],.09,p.rib,{n:4});}});
 // the mast with collars; the bearing ring at its top (gold at 5)
 b.cyl(0,y0+1,0,.78,.3,p.arm,{n:8,bev:.06});b.cyl(0,y0+1.3,0,.5,mt-y0-1.3,p.arm,{n,top:false});
 for(let y=y0+2.2;y<mt-.6;y+=.95)hoop(b,0,y,0,.5,.18,.07,p.rib,n);b.cyl(0,mt-.3,0,.68,.3,L>=5?p.gold:p.arm2,{n,bev:.05});if(hi)hoop(b,0,mt-.52,0,.5,.12,.06,p.acc,n);
 // kit on the apron: cable reels, the control cabinet, the status light
 reel(b,p,-hw+1.35,y0,hd-1.3,.62,.3);if(L>=3)reel(b,p,-hw+1.3,y0,-hd+1.4,.52,-.5);
 if(L>=2){const x=hw-1.25,z=-hd+1.2;ab(b,x,y0,z,1.5,1.5,1,p.arm,.08);b.at(x,0,z+.5,0,q=>{strip(q,-.2,y0+.5,.03,.8,.6,p.black);strip(q,.48,y0+1.15,.03,.16,.12,M.amber);if(hi)for(let k=0;k<3;k++)cb(q,-.2,y0+.6+k*.17,.03,.7,.05,.04,p.rib);});if(hi)b.pipe([[x-.75,y0+.3,z],[1.2,y0+.3,z],[1.2,y0+.3,-1]],.07,M.bare);}
 const sx=hw-1.1,sz=hd-1.1;b.cyl(sx,y0,sz,.22,.3,p.arm2,{n:6});b.tube([sx,y0+.3,sz],[sx,y0+1.7,sz],.08,p.rib,{n:5});cb(b,sx,y0+1.7,sz,.3,.3,.3,glow(p.ah,1.3));if(hi)b.halo(sx,y0+1.85,sz,.6,p.ah,.4);
 if(L>=4)for(const s of [-1,1]){const x=s*(hw-.9),z=s>0?-.2:.4;b.tube([x,y0,z],[x,y0+2.6,z],.05,M.trim,{n:4});cb(b,x,y0+2.6,z,.14,.14,.14,M.red);cb(b,x,y0,z,.4,.2,.4,p.arm2);}
 if(L>=5)b.loft([{p:rect(3.05,3.05,.56),y:y0+.66},{p:rect(3.05,3.05,.56),y:y0+.78}],p.gold,{top:false});
});
// surface of revolution about the frame's +y axis; up = the faces look toward +y (the inside of a bowl)
function bowl(b,prof,n,m,up){const ref=[0,up?-80:80,0];for(let r=0;r<prof.length-1;r++){const [r0,y0]=prof[r],[r1,y1]=prof[r+1];for(let i=0;i<n;i++){const a0=i/n*TAU,a1=(i+1)/n*TAU,c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
   b.quad([c0*r0,y0,s0*r0],[c1*r0,y0,s1*r0],[c1*r1,y1,s1*r1],[c0*r1,y1,s0*r1],typeof m==='function'?m(r,i):m,ref);}}return b;}
// The dish head only: origin at its pivot (the mast top), it looks toward +z and 36 degrees up; the game turns it about y.
WK.model('town-radar-dish',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow}=b.k,hi=b.hi,R=1.6+.25*L,n=hi?12:8,dp=R*.26;
 // the turning yoke
 b.cyl(0,0,0,.6,.22,p.arm2,{n:hi?8:6,top:false});ab(b,0,.22,-.1,.9,.6,.8,p.arm,.08);if(hi)for(const s of [-1,1])cb(b,s*.52,.2,0,.14,.75,.5,p.rib);
 b.at(0,.78,.05,0,q=>{
  // back shell with a hub and four spines, the pale reflector inside, a gold (or trim) rim
  bowl(q,[[.34,-.16],[.42,0],[R*.62,dp*.36],[R,dp]],n,(r)=>r===2?p.arm:p.arm2,false);bowl(q,[[R,dp],[R,dp+.1],[R-.14,dp+.1]],n,(r)=>L>=5?p.gold:p.rib,true);q.cap(b.k.circ(.34,n),-.16,p.arm2,false);
  bowl(q,[[.02,.07],[R*.5,dp*.3+.04],[R-.14,dp+.06]],n,(r,i)=>r?(i%2?M.plate:M.plate2):M.plate2,true);
  if(hi){for(let k=0;k<8;k++){const a=k*HP/2+HP/4,c=Math.cos(a),s=Math.sin(a);q.tube([c*.45,-.04,s*.45],[c*R*.96,dp-.04,s*R*.96],.07,p.rib,{n:3});}cb(q,0,-.5,-.5,.7,.4,.5,p.arm2);for(const s of [-1,1])q.tube([s*.3,-.5,.1],[s*.5,dp*.2,R*.5],.05,M.bare,{n:3});}
  // the feed: three struts to the horn, the accent light at its mouth
  const fy=R*.62;for(let k=0;k<3;k++){const a=k*TAU/3+HP,c=Math.cos(a),s=Math.sin(a);q.tube([c*R*.8,dp*.7,s*R*.8],[c*.12,fy,s*.12],.045,M.trim,{n:3});}
  q.cyl(0,fy-.1,0,.2,.34,p.arm2,{n:hi?6:4,r2:.12});q.cyl(0,fy-.22,0,.16,.12,glow(p.ah,1.2),{n:hi?6:4,bot:true,top:false});if(hi){q.tube([0,.08,0],[0,.5,0],.09,M.trim,{n:5});q.halo(0,fy-.2,0,.5,p.ah,.4);}
 },.3*Math.PI);
});

// ------------------------------------------------------------------ town-uplink (2x2) ----------------------------------
// Uplink mast: a lattice mast (height 6 + 1.6 * level) on an armoured footing, three shrinking cross-yards with antenna
// panels and drums, guy cables to the apron corners, the red top beacon.
WK.model('town-uplink',(b,o)=>{const p=TP(b,o),{L,M}=p,{rect,glow}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,h=6+1.6*L,w0=2.7,w1=.5,wAt=t=>w0+(w1-w0)*t;apron(b,o,p);
 // footing: a chamfered block, corner shoes, a cabinet with a status strip
 b.loft([{p:rect(3.5,3.5,.6),y:y0},{p:rect(3.5,3.5,.6),y:y0+.4},{p:rect(3,3,.5),y:y0+.62}],(r)=>r?p.arm2:p.arm);for(let k=0;k<4;k++)b.at(0,0,0,k*HP,q=>strip(q,0,y0+.14,1.77,1.5,.12,p.accS));
 b.truss(0,y0+.6,0,w0,w1,h-.6,p.rib,{step:hi?2.1:4.6,r:.085});
 // three cross-yards, shrinking upward: beam, end panels, a drum antenna; lights on the tips
 for(let k=1;k<4;k++){const t=k/4,y=y0+h*t,yw=2.9*(1-t)+1.5,ry=k%2?0:HP;b.at(0,y,0,ry,q=>{cb(q,0,0,0,yw*2,.16,.2,L>=5?p.gold:p.arm);
   for(const s of [-1,1]){ab(q,s*yw,-.5,0,.16,1.15,.7,k%2?M.plate:M.plate2,.04);if(hi)cb(q,s*yw,.66,0,.1,.1,.1,p.acc);if(hi)q.tube([s*wAt(t)/2,-.5,0],[s*yw*.8,.02,0],.04,p.rib,{n:3});}
   if(k<3&&(hi||k===1)){q.tube([.2,.1,.5],[.2,.1,.86],.42,M.plate,{n:hi?8:6,caps:true});if(hi)q.tube([.2,.1,.2],[.2,.1,.5],.1,p.arm2,{n:4});}});}
 // antenna panels up the mast (one more per level), the beacon
 for(let k=0;k<L;k++){const t=.5+.4*(k+.5)/L,y=y0+h*t,w=wAt(t)/2+.1;b.at(0,y,0,k*HP+HP/2*0,q=>{ab(q,0,-.5,w+.06,.44,1.1,.12,M.plate,.03);});}
 ab(b,0,y0+h,0,.7,.2,.7,L>=5?p.gold:p.arm2,.04);b.cyl(0,y0+h+.2,0,.2,.44,glow(0xff3048,2),{n:hi?6:4});if(hi){b.tube([0,y0+h+.2,.3],[0,y0+h+.68,.3],.025,M.bare,{n:3});b.halo(0,y0+h+.5,0,1.2,0xff3048,1);}
 // guy cables to the corners (HIGH), anchors, the ground cabinet
 for(const sx of [-1,1])for(const sz of [-1,1]){const ax=sx*(hw-.75),az=sz*(hd-.75);if(hi)cb(b,ax,y0,az,.5,.3,.5,p.arm2);if(hi)b.detail(()=>b.tube([ax,y0+.3,az],[sx*wAt(.6)/2,y0+h*.6,sz*wAt(.6)/2],.03,M.bare,{n:3}));}
 if(L>=2){const x=-hw+1.3,z=.2;ab(b,x,y0,z,1.1,1.5,1.7,p.arm,.08);b.at(x+.55,0,z,HP,q=>{strip(q,0,y0+.4,.03,1.2,.6,p.black);strip(q,0,y0+1.15,.03,1.2,.1,p.acc);});}
 if(L>=4){const x=hw-1.3,z=-.2;ab(b,x,y0,z,1,1.1,1.4,p.arm2,.08);if(hi){b.cyl(x,y0+1.1,z,.5,.14,M.plate2,{n:8});bowlDish(b,p,x,y0+1.24,z,.62);}}
});
function bowlDish(b,p,x,y,z,R){b.at(x,y,z,.6,q=>{q.tube([0,0,0],[0,.4,0],.06,p.M.trim,{n:4});q.at(0,.45,0,0,d=>{bowl(d,[[.05,0],[R,R*.3]],8,p.arm2,false);bowl(d,[[.03,.04],[R,R*.3+.02]],8,p.M.plate,true);},.7);});}

// ------------------------------------------------------------------ town-trophy (3x3) ----------------------------------
// Trophy Hall: a proud dark hall under a gold pyramid skylight, a colonnade front with a gold-framed door, banners in the
// accent colour, and rows of pedestals carrying glowing gold and ice trophies (3 + 2 * level of them).
WK.model('town-trophy',(b,o)=>{const p=TP(b,o),{L,M}=p,{rect,glow,tint}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3;apron(b,o,p);
 const bw=o.w-2.4,bd=o.d*.42,bz=-hd+.8+bd/2,zf=bz+bd/2,bh=3.3,ry=y0+.4+bh,pd=1.5,gG=glow(0xffd36b,1.15),iG=glow(0xa8f8ff,1.3);
 // stylobate (two steps), the hall, a gold cornice
 ab(b,0,y0,bz+pd/2,bw+.9,.2,bd+pd+.9,p.arm2,.06);ab(b,0,y0+.2,bz+pd/2,bw+.4,.2,bd+pd+.4,p.arm2,.06);ab(b,0,y0+.4,bz,bw,bh,bd,p.arm,.1);
 // the portico roof slab over the colonnade, the cornice, the stepped attic and the gold pyramid skylight
 ab(b,0,ry,bz+pd/2,bw+.5,.42,bd+pd+.5,p.arm2,.1);b.loft([{p:rect(bw+.62,bd+pd+.62,0,0,bz+pd/2),y:ry+.3},{p:rect(bw+.62,bd+pd+.62,0,0,bz+pd/2),y:ry+.44}],p.gold,{top:false});
 const pw=bw*.62,pdp=bd*.8,ph=1+.18*L,gP=glow(0xb98a30,.14);b.loft([{p:rect(pw+.9,pdp+.9,.3,0,bz),y:ry+.54},{p:rect(pw+.5,pdp+.5,.3,0,bz),y:ry+.95}],p.arm);
 b.loft([{p:rect(pw,pdp,0,0,bz),y:ry+.95},{p:rect(pw*.12,pdp*.12,0,0,bz),y:ry+.95+ph}],gP,{topMat:M.white});cb(b,0,ry+.95+ph,bz,pw*.12,.14,pdp*.12,glow(0xfff2c8,1.3));
 if(hi){for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])b.tube([sx*pw/2,ry+.97,bz+sz*pdp/2],[sx*pw*.06,ry+.97+ph,bz+sz*pdp*.06],.06,tint(M.gold,1.5),{n:3});b.halo(0,ry+1.2+ph,bz,1.6,0xffe3a0,.25);}
 // colonnade: six columns with gold capitals; the door and the banners behind them
 const nc=hi?6:4,cz2=zf+pd-.35,chh=bh-.02;for(let k=0;k<nc;k++){const x=-(bw/2-.45)+(bw-.9)*k/(nc-1);b.cyl(x,y0+.4,cz2,.3,chh,p.rib,{n:hi?8:5,top:false});if(hi){cb(b,x,y0+.4,cz2,.8,.22,.8,p.arm2);cb(b,x,y0+.4+chh-.2,cz2,.78,.2,.78,p.gold);}}
 b.at(0,0,zf,0,q=>{ab(q,0,y0+.4,.1,2.5,2.9,.2,p.gold,.06);strip(q,0,y0+.4,.22,1.9,2.55,p.black);strip(q,0,y0+2.95,.23,1.9,.14,gG);if(hi){cb(q,0,y0+.4,.22,.08,2.55,.05,p.gold);}
  for(const s of [-1,1])for(const k of hi?[1,2]:[1.5]){const x=s*(1.1+k*bw*.14);strip(q,x,y0+1.3,.04,.62,1.9,glow(p.ah,.55));if(hi){cb(q,x,y0+3.2,.04,.8,.08,.1,p.gold);q.tri([x-.31,y0+1.3,.04],[x+.31,y0+1.3,.04],[x,y0+.95,.04],glow(p.ah,.55),[x,y0,-1]);}}});
 for(const s of [-1,1])b.at(s*bw/2,0,bz,s*HP,q=>{const n=hi?4:2;for(let k=0;k<n;k++)fin(q,-(bd/2-.4)+(bd-.8)*k/(n-1),y0+.4,.4,bh-.1,.26,p.arm2,{front:p.rib});});
 if(hi)b.at(0,0,bz-bd/2,Math.PI,q=>{for(let k=0;k<6;k++)fin(q,-(bw/2-.4)+(bw-.8)*k/5,y0+.4,.4,bh-.1,.26,p.arm2,{front:p.rib});});
 // level kit: braziers on the portico corners, gold finials on the attic
 if(L>=3)for(const s of [-1,1]){const x=s*(bw/2+.05),z=zf+pd+.5;b.cyl(x,y0,z,.28,1.3,p.arm2,{n:6,r2:.2});b.cyl(x,y0+1.3,z,.34,.16,p.gold,{n:6});cb(b,x,y0+1.46,z,.3,.26,.3,glow(0xffb347,1.5));if(hi)b.halo(x,y0+1.7,z,.7,0xffb347,.4);}
 if(L>=4)for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*(pw/2+.1),z=bz+sz*(pdp/2+.1);b.loft([{p:rect(.5,.5,0,x,z),y:ry+.95},{p:rect(.06,.06,0,x,z),y:ry+1.9}],p.gold);}
 // pedestals and trophies in rows on the apron
 const nt=3+2*L,cols=5,z0=hd-.95;for(let k=0;k<nt;k++){const c=k%cols,r=(k/cols)|0,x=-hw+1.3+c*((o.w-2.6)/(cols-1)),z=z0-r*1.12,gold=k%3!==0;
  cb(b,x,y0,z,.72,.62,.72,p.arm2);if(hi){cb(b,x,y0+.62,z,.82,.1,.82,gold?p.gold:M.plate);}b.gem(x,y0+1.14,z,.26,.4,.26,gold?gG:iG,k*.7);}
 if(hi)b.pool(0,.34,z0-.5,hw-1,1.6,0xffd36b,.12);
});

// ------------------------------------------------------------------ town-gate (1x1) ------------------------------------
// The town gate block: an armoured gatehouse (3.8 x 3.6 x 3.8) with corner piers, an amber-lit door panel on +z and a
// cyan-lit roof edge.
WK.model('town-gate',(b,o)=>{const p=TP(b,o),{M}=p,{rect,glow}=b.k,hi=b.hi,W=3.8,H=3.6;
 ab(b,0,0,0,W,.45,W,p.arm2,.1);ab(b,0,.45,0,W-.5,H-.95,W-.5,p.arm,.08);
 for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*(W/2-.36),z=sz*(W/2-.36);if(hi)b.loft([{p:rect(.72,.72,.1,x,z),y:.45},{p:rect(.72,.72,.1,x,z),y:H-.55},{p:rect(.5,.5,.08,x,z),y:H-.5}],p.arm2,{top:false});else cb(b,x,.45,z,.72,H-.95,.72,p.arm2);}
 // parapet slab with the cyan light edge, corner caps
 ab(b,0,H-.5,0,W,.3,W,p.arm2,.06);b.loft([{p:rect(W+.04,W+.04),y:H-.2},{p:rect(W+.04,W+.04),y:H-.08}],M.cyan,{top:false});cb(b,0,H-.08,0,W-.1,.08,W-.1,p.arm);
 if(hi){for(const sx of [-1,1])for(const sz of [-1,1])cb(b,sx*(W/2-.36),H-.08,sz*(W/2-.36),.6,.14,.6,M.gold);cb(b,0,H,0,1.2,.1,1.2,p.arm2);}
 // the door: amber-lit panel in a dark frame, slats, a header light
 b.at(0,0,W/2-.25,0,q=>{ab(q,0,.45,.1,2.5,2.55,.22,p.arm2,.06);strip(q,0,.5,.23,1.7,2,glow(0xffb347,.7));if(hi){for(let k=0;k<4;k++)cb(q,0,.5+k*.52,.23,1.7,.16,.05,p.dark);cb(q,0,.5,.23,.22,2,.05,p.dark);strip(q,0,2.68,.23,1.7,.1,M.amber);}});
 if(hi){for(const s of [-1,1])b.at(s*(W/2-.25),0,0,s*HP,q=>{strip(q,0,1.5,.02,1.3,.12,M.cyan);});b.pool(0,.05,W/2+.8,1.4,.8,0xffb347,.2);}
});

// ================================================== turrets (1x1 and 2x1 cells) =======================================
// Every turret is one slot: an armoured hex pedestal with a drum and an accent ring (o.part = 'base') and the turning head
// (o.part = 'head': origin at its pivot, the weapon toward +z). With no o.part the whole turret is drawn, the head at
// y = 1.4 + 0.15 * level. Each head has its own silhouette so its role reads at a glance; o.big = the 2-cell pedestal.
function turretBase(b,p,big){const {circ}=b.k,hi=b.hi,L=p.L,r0=big?1.85:1.6,r1=big?1.05:.9,n=hi?12:6,H6=(r,y)=>({p:circ(r,6,0,0,r,Math.PI/6),y});
 b.loft([H6(r0,0),H6(r0,.36),H6(r0-.2,.6)],p.arm2,{topMat:p.arm});
 if(hi)for(let k=0;k<6;k++){const a=k*TAU/6+TAU/12;b.at(Math.cos(a)*(r0*.866-.03),0,Math.sin(a)*(r0*.866-.03),-a+HP,q=>{cb(q,0,.07,0,r0*.56,.24,.1,p.rib);strip(q,0,.14,.06,r0*.3,.06,k%2?p.accS:p.M.dark);});}
 b.cyl(0,.6,0,r1,.6+L*.15,p.arm,{n,bev:.05});hoop(b,0,1.0+L*.15,0,r1,.14,.06,p.acc,n,0,!hi);
 if(hi){hoop(b,0,.6,0,r1,.14,.1,p.rib,n);b.ribs(0,.74,0,r1,.22+L*.15,4,p.arm2,{w:.24,dp:.16,rot:Math.PI/4,bev:false});}
 for(let k=1;k<L;k++)cb(b,0,.64+k*.12,(big?1.1:.95)+.02,.5,.05,.06,p.gold);}
const barrel=(b,x,y,z0,z1,r,m,n)=>b.tube([x,y,z0],[x,y,z1],r,m,{n,caps:true});
const HEAD={
 // a tank-turret: sloped armour, mantlet, a sleeved barrel with a muzzle brake, hatch and sight
 cannon(b,p){const hi=b.hi,M=p.M,L=p.L,n=hi?8:5,z1=.95+2.2+L*.2;ab(b,0,-.45,-.05,1.5,.9,1.7,p.arm,.16);ab(b,0,-.3,.86,.8,.62,.34,p.arm2,.1);
  barrel(b,0,.02,1,z1,.16,M.dark,n);b.tube([0,.02,1.2],[0,.02,2],.22,p.rib,{n});b.tube([0,.02,z1-.34],[0,.02,z1],.25,p.arm2,{n,caps:true});
  b.at(0,0,-.9,Math.PI,q=>strip(q,0,.12,.02,1,.1,p.acc));
  if(hi){ab(b,-.2,.45,-.3,.74,.14,.74,p.arm2,.05);cb(b,.44,.45,.28,.22,.2,.3,p.rib);strip(b,.44,.5,.435,.14,.1,p.ice);for(const s of [-1,1])ab(b,s*.8,-.3,-.1,.12,.55,1.2,p.lite,.04);b.tube([-.5,.45,-.6],[-.5,1.25,-.6],.02,M.bare,{n:3});}},
 // twin heavy machine guns: perforated jackets, an ammunition drum on the side
 mg(b,p){const hi=b.hi,M=p.M,L=p.L,n=hi?6:4,z1=.5+1.9+L*.15;ab(b,0,-.38,-.1,1.15,.76,1.25,p.arm,.12);
  for(const sx of [-.26,.26]){barrel(b,sx,.02,.5,z1,.07,M.dark,n);b.tube([sx,.02,.55],[sx,.02,1.5],.12,p.rib,{n});b.tube([sx,.02,z1-.05],[sx,.02,z1+.22],.11,p.arm2,{n,caps:true});}
  b.at(.72,0,-.1,0,q=>{if(hi)q.cyl(0,-.3,0,.3,.5,M.hazard,{n:8,rz:.4,topMat:M.hazardD});else cb(q,0,-.3,0,.36,.5,.7,M.hazard);});
  if(hi){cb(b,0,.38,-.25,.6,.12,.5,p.arm2);strip(b,0,-.1,.53,.5,.1,p.acc);cb(b,-.66,-.2,-.1,.16,.4,.6,p.arm2);b.tube([.45,.1,.3],[.26,.05,.5],.05,M.bare,{n:3});}},
 // a beam emitter: a faceted ball housing, a ringed lens barrel and the glowing cyan lens
 laser(b,p){const hi=b.hi,M=p.M,n=hi?10:6;b.ball(0,.2,0,.74,p.arm2,!hi);b.tube([0,.2,.3],[0,.2,1.75],.27,p.lite,{n,caps:true});
  b.tube([0,.2,1.7],[0,.2,1.86],.33,p.arm2,{n,caps:true});b.at(0,0,1.87,0,q=>strip(q,0,.04,0,.32,.32,b.k.glow(0x22e6ff,2)));
  if(hi){for(const z of [.75,1.1,1.45])b.at(0,.2,z,0,q=>q.ring(0,0,0,.3,M.cyan,{thin:true}),HP);for(const s of [-1,1])for(let k=0;k<3;k++)cb(b,s*.72,-.1+k*.2,-.2,.14,.07,.7,p.rib);cb(b,0,.9,-.1,.3,.12,.5,p.gold);b.halo(0,.2,1.95,.7,0x22e6ff,.5);}},
 // a six-tube rocket pod: honeycomb muzzles with warheads showing, a lit top rail, blast vents at the back
 rocket(b,p){const hi=b.hi,M=p.M,n=hi?8:5;ab(b,0,-.3,0,1.75,1.2,1.45,p.arm,.12);
  for(let k=0;k<6;k++){const x=-.52+(k%3)*.52,y=.02+Math.floor(k/3)*.52;b.tube([x,y,.6],[x,y,.86],.2,p.arm2,{n,caps:true});b.at(x,y,.87,0,q=>strip(q,0,-.11,0,.22,.22,p.fire));}
  cb(b,0,.9,0,1.5,.08,1.2,p.accS);
  if(hi){for(const s of [-1,1]){ab(b,s*.94,-.1,-.1,.12,.8,1,p.lite,.04);cb(b,s*.5,-.2,-.78,.5,.7,.08,M.dark);}cb(b,0,.98,-.3,.4,.14,.4,p.arm2);b.tube([.3,1.05,-.3],[.3,1.5,-.3],.02,M.bare,{n:3});}},
 // four guided missiles on launch rails, red-nosed, canted up
 missile(b,p){const hi=b.hi,M=p.M,n=hi?8:5;ab(b,0,-.3,-.25,1.5,.5,1.3,p.arm,.1);b.at(0,.2,-.2,0,q=>{for(let k=0;k<4;k++){const x=-.42+(k%2)*.84,y=.1+Math.floor(k/2)*.5;
    q.tube([x,y,-.55],[x,y,.85],.17,M.plate,{n,caps:true});q.tube([x,y,.85],[x,y,1.3],.17,M.red,{n,r2:.02});if(hi){cb(q,x,y-.24,-.1,.1,.08,1.3,p.arm2);for(const s of [-1,1])cb(q,x+s*.2,y-.03,-.5,.14,.06,.3,p.rib);}}
   if(hi){cb(q,0,-.12,0,1.5,.1,1.1,p.arm2);cb(q,0,.86,-.2,1.3,.08,.9,p.arm2);}},-.28);
  if(hi){strip(b,0,-.2,.41,.8,.1,p.acc);cb(b,0,.2,-.95,.9,.5,.2,p.rib);}},
 // a heavy mortar: a short fat tube on a recoil cradle, elevated, with a shell rack
 mortar(b,p){const hi=b.hi,M=p.M,L=p.L,n=hi?10:6;b.cyl(0,-.2,0,.78,.34,p.arm2,{n,bev:.06});
  b.at(0,.1,-.1,0,q=>{q.cyl(0,0,0,.44,1.75+L*.15,M.dark,{n,r2:.4,topMat:p.black});if(hi){hoop(q,0,.2,0,.44,.2,.07,p.rib,n);hoop(q,0,1.4+L*.15,0,.41,.18,.06,p.arm,n);hoop(q,0,.8,0,.43,.1,.04,p.acc,n);}},.7);
  for(const s of [-1,1])b.tube([s*.5,-.05,-.3],[s*.3,.7,.42],.07,p.rib,{n:4});
  if(hi){for(let k=0;k<3;k++){b.cyl(-.6+k*.24,.14,-.62,.09,.34,M.plate2,{n:6});b.cyl(-.6+k*.24,.48,-.62,.09,.12,M.hazard,{n:6,r2:.02});}cb(b,-.36,.1,-.62,.8,.06,.3,p.arm);}},
 // a flame projector: twin fuel tanks, a shrouded nozzle and the burning pilot light
 flame(b,p){const hi=b.hi,M=p.M,n=hi?8:5;for(const sx of hi?[-.3,.3]:[0])vessel(b,p,sx,-.35,-.55,hi?.28:.45,1,b.k.mat(0x8a3a26,'paint',.6),{n,hoops:1});
  ab(b,0,-.3,.05,.9,.6,.8,p.arm,.1);barrel(b,0,.05,.4,1.5,.2,M.dark,n);b.tube([0,.05,1.4],[0,.05,1.85],.22,p.arm2,{n,r2:.34});
  b.at(0,0,1.86,0,q=>strip(q,0,-.09,0,.28,.28,b.k.glow(0xff8a3d,2)));
  if(hi){b.tube([.3,.5,-.5],[.2,.3,.3],.04,M.bare,{n:3});b.tube([-.3,.5,-.5],[-.2,.3,.3],.04,M.bare,{n:3});cb(b,0,.3,.1,.5,.1,.5,M.hazard);for(const z of [.7,1])b.at(0,.05,z,0,q=>q.ring(0,0,0,.23,p.rib,{thin:true}),HP);b.halo(0,.05,2,.8,0xff8a3d,.6);}},
 // a siege gun: a long heavy barrel with recoil cylinders in a deep armoured cradle
 siege(b,p){const hi=b.hi,M=p.M,L=p.L,n=hi?10:6,z1=.8+3.2+L*.3;ab(b,0,-.5,-.25,1.95,1.2,2.2,p.arm,.18);ab(b,0,-.35,.9,1.1,.9,.4,p.arm2,.12);
  barrel(b,0,.15,1,z1,.3,M.dark,n);b.tube([0,.15,1.2],[0,.15,2.6],.38,p.rib,{n});b.tube([0,.15,z1-.5],[0,.15,z1],.42,p.arm2,{n,caps:true});
  for(const sx of [-.7,.7])b.tube([sx,-.05,.4],[sx,-.05,1.8],.12,M.plate2,{n:hi?6:4,caps:true});b.at(0,0,-1.36,Math.PI,q=>strip(q,0,.2,.02,1.2,.12,p.acc));
  if(hi){ab(b,-.4,.7,-.5,.8,.16,.8,p.arm2,.05);cb(b,.6,.7,.2,.3,.26,.4,p.rib);strip(b,.6,.78,.405,.2,.12,p.ice);for(const s of [-1,1])ab(b,s*1.02,-.3,-.25,.12,.8,1.6,p.lite,.04);for(const z of [3,3.4])b.at(0,.15,z,0,q=>q.ring(0,0,0,.33,p.gold,{thin:true}),HP);}},
 // a lightning coil: an insulated column wound with rings under a crackling violet orb
 tesla(b,p){const hi=b.hi,M=p.M,L=p.L,n=hi?10:6,k3=3+Math.min(2,L>>1),vio=b.k.glow(0xb07bff,2.2);b.cyl(0,-.2,0,.62,.3,p.arm2,{n,bev:.06});b.cyl(0,.1,0,.34,1.9,M.plate2,{n,r2:.2});
  for(let k=0;k<k3;k++){const y=.3+k*.42,r=.62-k*.07;if(hi)b.ring(0,y,0,r,k%2?p.rib:p.gold,{t:1.2});else hoop(b,0,y-.05,0,r-.06,.1,.06,p.rib,n);}
  b.ball(0,2.25,0,.42,vio,!hi);if(hi){for(let k=0;k<3;k++){const a=k*TAU/3;b.tube([Math.cos(a)*.5,-.1,Math.sin(a)*.5],[Math.cos(a)*.16,1.95,Math.sin(a)*.16],.035,M.bare,{n:3});}b.ring(0,2.25,0,.56,p.arm2,{thin:true,rx:.5});}b.halo(0,2.25,0,1.4,0xb07bff,.7);},
 // a heavy beam cannon: a wide focusing dish round a magenta ring and a white-hot core
 lasercannon(b,p){const hi=b.hi,M=p.M,n=hi?12:6,C=b.k.circ,mag=b.k.glow(0xff2bd6,1.8),R=(r,z)=>({p:C(r,n),y:z});ab(b,0,-.5,-.35,1.55,1,1.65,p.arm,.14);
  b.at(0,.1,.45,0,q=>{q.loft([R(.34,0),R(.5,.2),R(.92,.62),R(.98,.72)],M.plate,{smooth:true,top:false});q.loft([R(.86,.7),R(.42,.44)],p.arm2,{smooth:true,top:false});q.loft([R(.78,.66),R(.66,.6)],mag,{smooth:true,top:false});q.cap(C(.42,n),.45,b.k.glow(0xffd0f4,2.2),true);},HP);
  if(hi){for(const s of [-1,1]){ab(b,s*.84,-.3,-.35,.14,.7,1.3,p.lite,.04);b.tube([s*.5,.5,-.8],[s*.5,.5,.5],.07,M.bare,{n:4});}cb(b,0,.5,-.6,.8,.16,.7,p.arm2);strip(b,0,.56,-.245,.5,.06,mag);b.halo(0,.1,1.3,1.1,0xff2bd6,.6);}},
 // a railgun: two long rails over a capacitor bank, a cyan arc between them
 railgun(b,p){const hi=b.hi,M=p.M,L=p.L,len=3.8+L*.25,zc=-.5+len/2;ab(b,0,-.45,-.6,1.45,.9,1.65,p.arm,.14);
  for(const sx of [-.28,.28])ab(b,sx,.04,zc,.15,.34,len,M.dark,.04);b.box(0,.17,zc,.07,.07,len-.3,b.k.glow(0x22e6ff,1.8));cb(b,0,.5,-.6,1,.12,1.2,p.accS);
  if(hi){for(let k=0;k<4;k++){const z=.5+k*(len-1.2)/3;ab(b,0,-.04,z,.82,.46,.16,p.rib,.04);}for(const s of [-1,1])for(let k=0;k<3;k++)b.cyl(s*.5,.45,-1.1+k*.42,.15,.3,M.plate2,{n:6,topMat:M.cyan});b.tube([.6,.3,-.9],[.6,.9,-.9],.02,M.bare,{n:3});b.halo(0,.2,zc+len/2,.8,0x22e6ff,.5);}}};
function turret(type){return (b,o)=>{const p=TP(b,o),big=(o.w||4)>5,part=o.part,hy=1.4+p.L*.15;if(part!=='head')turretBase(b,p,big);if(part!=='base')b.at(0,part==='head'?0:hy,0,0,q=>HEAD[type](q,p));};}
for(const t of Object.keys(HEAD))WK.model('town-'+t,turret(t));

// ================================================== the six Meshy-backed buildings ==================================
// On HIGH these six are drawn with the owner's Meshy models; the code models are the LOW-graphics / still-loading
// stand-ins (b.hi true = the fuller stand-in). They follow the Meshy silhouettes and the old levels.
const octR=(b,r,y,cx=0,cz=0)=>({p:b.k.circ(r,8,cx,cz,r,Math.PI/8),y});

// town-cc (4x4): a stepped octagonal command tower, one more tier per level (1..10), a lit core drum, a mast; corner
// pylons from level 5, a gold ring from 9. Gold corner marks on the apron.
WK.model('town-cc',(b,o)=>{const p=TP(b,o,10),{L,M}=p,{glow,circ,rect}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,C8=Math.cos(Math.PI/8);apron(b,o,p);
 for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*(hw-.75),z=sz*(hd-.75),g=glow(0xffd36b,1.3);if(hi)cb(b,x,.3,z,.7,.08,.7,g);else b.quad([x-.35,.32,z-.35],[x+.35,.32,z-.35],[x+.35,.32,z+.35],[x-.35,.32,z+.35],g,[x,0,z]);}
 const nt=L,ht=2.6+.42*L,r0=Math.min(6.9,5.3+.2*L),r1=3.9,th=ht/nt;let y=y0;
 for(let k=0;k<nt;k++){const r=r0+(r1-r0)*(nt>1?k/(nt-1):0),m=k%2?p.arm2:p.arm;
  b.loft(hi?[octR(b,r,y),octR(b,r-.1,y+th-.18),octR(b,r-.3,y+th)]:[octR(b,r,y),octR(b,r-.2,y+th)],m,{topMat:p.arm2});
  if(hi||k%4===0)b.loft([octR(b,r+.03,y+th*.6),octR(b,r+.01,y+th*.6+.1)],p.accS,{top:false});
  if(hi){around(b,0,0,(r-.05)*C8,8,0,(q,i)=>{if(i%2===0&&th>.5)strip(q,0,y+th*.16,.03,r*.3,th*.3,M.ice);});
   if(nt<=5||k%2===0)around(b,0,0,r-.12,8,Math.PI/8,q=>fin(q,0,y,.5,th,.3,p.arm2,{front:p.rib,sh:Math.min(.4,th*.4)}));}
  y+=th;}
 // the entrance on the front face of the first tier
 b.at(0,0,r0*C8-.1,0,q=>gateDoor(q,p,0,y0,Math.min(3,r0*.4),Math.min(th-.4,2.4),p.acc));
 // core drum with the lit window band, roof cone, mast and beacon
 const dh=1.9+.08*L,n=hi?12:8;b.cyl(0,y,0,3.1,dh,p.arm,{n,bev:.1});b.loft([{p:circ(3.14,n),y:y+dh*.42},{p:circ(3.14,n),y:y+dh*.42+.46}],glow(0xcfefff,.85),{top:false,smooth:true});
 if(hi)around(b,0,0,3.1,12,0,q=>fin(q,0,y+.08,.3,dh-.16,.16,p.arm2,{front:p.rib,sh:.14}));
 hoop(b,0,y+dh-.16,0,3.1,.24,.12,L>=9?p.gold:p.rib,n);b.loft([{p:circ(3.2,n),y:y+dh+.02},{p:circ(3.2,n),y:y+dh+.14}],p.acc,{top:false,smooth:true});
 b.loft([{p:circ(3,n),y:y+dh+.08},{p:circ(2.2,n),y:y+dh+.5},{p:circ(.6,n),y:y+dh+1.1}],(r)=>r?p.arm2:p.arm,{smooth:true,topMat:p.arm});
 const my=y+dh+1.1,mh=1.4+.1*L;b.cyl(0,my,0,.22,mh,M.trim,{n:6,r2:.12});b.gem(0,my+mh+.25,0,.3,.42,.3,L>=9?glow(0xffd36b,1.8):glow(0xa8f8ff,1.8));
 if(hi){b.tube([-.8,my+mh*.55,0],[.8,my+mh*.55,0],.05,M.bare,{n:3});bowlDish(b,p,1.6,y+dh+.5,-1.2,.7);b.halo(0,my+mh+.3,0,1,L>=9?0xffd36b:0xa8f8ff,.6);}
 if(L>=9)hoop(b,0,y+dh*.2,0,3.1,.2,.14,p.gold,n);
 // corner pylons from level 5
 if(L>=5)for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*(hw-1.75),z=sz*(hd-1.75),h=3.2+.22*L;ab(b,x,y0,z,1.5,h,1.5,p.arm2,.14);cb(b,x,y0+h,z,1.62,.16,1.62,p.acc);if(hi)cb(b,x,y0+h+.16,z,1.1,.3,1.1,L>=9?p.gold:p.arm);
   if(hi)b.at(x,0,z,sz>0?0:Math.PI,q=>strip(q,0,y0+.8,.77,.16,h-1.6,p.accS));}
 // tanks beside the entrance (Meshy: vessels and pipes at the foot)
 if(L>=2&&hi)for(const s of [-1,1]){vessel(b,p,s*(r0*.42+1),y0,r0*C8+.72,.62,1.5,p.arm,{hoop:p.gold,hoops:1,n:8});}
});

// town-refinery (3x4): a ribbed process hall with a gold-rimmed ore hopper, a tall column with a furnace glow, a conveyor
// climbing to the hopper. Level: taller column, a stack, a second column, a roof unit, a gold column at 5.
WK.model('town-refinery',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,circ,rect,mat}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,n=hi?12:7;apron(b,o,p);
 const bx=-hw*.33,bz=-hd*.22,bw=o.w*.5,bd=o.d*.5,bh=4.2,ry=y0+bh,zf=bz+bd/2;
 ab(b,bx,y0,bz,bw+.4,.5,bd+.4,p.arm2,.12);ab(b,bx,y0+.5,bz,bw,bh-.5,bd,p.arm,.12);band(b,bx,ry-.2,bz,bw+.2,.2,bd+.2,p.trim);
 for(const s of [-1,1])b.at(bx+s*bw/2,0,bz,s*HP,q=>{const k=hi?5:2;for(let i=0;i<k;i++)fin(q,-(bd/2-.5)+(bd-1)*i/(k-1),y0+.5,.44,bh-.6,.28,p.arm2,{front:p.rib});});
 b.at(bx,0,zf,0,q=>{for(const s of [-1,1])fin(q,s*(bw/2-.3),y0+.5,.44,bh-.6,.28,p.arm2,{front:p.rib});if(hi){ab(q,0,y0+.9,.1,2,2,.2,p.arm2,.06);strip(q,0,y0+1.1,.22,1.4,1.4,p.black);strip(q,0,y0+2.62,.22,1.4,.12,M.amber);}});
 // the hopper: an inverted funnel with a gold rim, ore inside
 const hy=ry,hh=1.5,hx=bw*.7,hz=bd*.5;b.loft([{p:rect(hx*.5,hz*.5,0,bx,bz),y:hy},{p:rect(hx,hz,0,bx,bz),y:hy+hh}],p.arm,{top:true,topMat:mat(0x9a8650,'dirt',0)});
 b.loft([{p:rect(hx+.16,hz+.16,0,bx,bz),y:hy+hh-.16},{p:rect(hx+.16,hz+.16,0,bx,bz),y:hy+hh+.16},{p:rect(hx-.5,hz-.5,0,bx,bz),y:hy+hh+.16},{p:rect(hx-.5,hz-.5,0,bx,bz),y:hy+hh+.02}],(r)=>r===2?p.arm2:p.gold,{top:false});
 if(hi)for(const s of [-1,1]){b.at(bx,0,bz+s*hz*.38,0,q=>{fin(q,-hx*.3,hy,.3,hh*.8,.3,p.arm2,{front:p.rib,z:s>0?hz*.02:-hz*.02-.3,sh:.1});});}
 // the conveyor from the front apron up to the hopper, amber-lit
 {const a=[bx,y0+.5,hd-1.3],c=[bx,hy+hh+.5,bz+bd*.2],len=Math.hypot(c[1]-a[1],c[2]-a[2]),pit=Math.atan2(c[1]-a[1],a[2]-c[2]);
  b.at(a[0],a[1],a[2],Math.PI,q=>{cb(q,0,-.16,len/2,1.1,.26,len,p.arm2);q.quad([-.38,.11,0],[.38,.11,0],[.38,.11,len],[-.38,.11,len],p.black,[0,-2,len/2]);for(const s of [-1,1])cb(q,s*.5,.1,len/2,.1,.16,len,p.rib);const nl=hi?6:3;for(let i=0;i<nl;i++)cb(q,0,.11,len*(i+.5)/nl,.5,.05,.2,glow(0xffb347,.9));},-pit);
  cb(b,bx,y0,hd-1.3,1.5,.5,1.2,p.arm2);for(const s of [-1,1])b.tube([bx+s*.45,y0,zf+1.1],[bx+s*.45,y0+.5+(zf+1.1-a[2])/(c[2]-a[2])*(c[1]-a[1])-.1,zf+1.1],.09,p.rib,{n:4});}
 // the tall column: furnace glow at its foot, hoops, an accent ring and a dome
 const col=(x,z,r,h,m,hot)=>{b.cyl(x,y0,z,r*1.18,.5,p.arm2,{n:8,bev:.08});b.cyl(x,y0+.5,z,r,h-.5,m,{n,top:false});b.dome(x,y0+h,z,r,r*.7,r,m,{n,rings:hi?3:2});
  if(hot)b.loft([{p:circ(r+.04,n,x,z),y:y0+1.4},{p:circ(r+.04,n,x,z),y:y0+2}],glow(0xff8a3d,1.5),{top:false,smooth:true});
  if(hi){if(hot)around(b,x,z,r+.02,8,.2,q=>fin(q,0,y0+1.2,.3,1,.12,p.arm2,{sh:.1}));for(let i=1;i<=3;i++)hoop(b,x,y0+2+(h-2.4)*i/3.4,z,r,.2,.08,i===3?p.gold:p.rib,n);}
  b.loft([{p:circ(r+.06,n,x,z),y:y0+h-.2},{p:circ(r+.06,n,x,z),y:y0+h-.06}],p.acc,{top:false,smooth:true});};
 const cxx=hw*.44;col(cxx,-hd*.36,1.45,5.4+.78*L,p.arm,true);if(hi)b.halo(cxx,y0+1.7,-hd*.36+1.5,2.2,0xff8a3d,.25);
 if(L>=3)col(cxx,hd*.08,1.1,3.8+.6*L,p.arm2,false);
 if(L>=5){col(cxx,hd*.42,.85,7.6,p.arm,false);b.dome(cxx,y0+7.6,hd*.42,.87,.62,.87,M.gold,{n,rings:hi?3:2});for(const t of [.3,.6])hoop(b,cxx,y0+7.6*t,hd*.42,.85,.3,.08,M.gold,n,0,1);}
 // level kit: a thin stack by the hall, a roof unit; a pipe bridge from hall to column
 if(L>=2){const x=-hw+1.1,z=hd*.42,h=3.8+L;b.cyl(x,y0,z,.75,.5,p.arm2,{n:6});b.cyl(x,y0+.5,z,.5,h,p.arm2,{n:hi?8:5,r2:.4,top:false});b.cyl(x,y0+.5+h,z,.5,.2,p.dark,{n:hi?8:5,topMat:p.black});if(hi)hoop(b,x,y0+h*.6,z,.46,.16,.06,p.gold,8,0,1);}
 if(L>=4){ab(b,bx-bw*.22,ry,bz-bd*.36,bw*.32,1,bd*.16,p.arm2,.08);if(hi)strip(b,bx-bw*.22,ry+.4,bz-bd*.28+.02,bw*.22,.14,p.accS);}
 if(hi)b.pipe([[bx+bw/2,y0+3,bz-1],[cxx-1.5,y0+3,bz-1],[cxx-1.5,y0+3,-hd*.36],[cxx-1.3,y0+3,-hd*.36]],.16,M.bare);
});

// town-storage (3x3, a vital): an armoured depot hall with a ribbed roof and a shutter door, tank silos that grow in
// number and height with the level, crates by the door.
WK.model('town-storage',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,circ,rect}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,n=hi?10:6;apron(b,o,p,true);
 const bx=-hw*.26,bz=hd*.2,bw=o.w*.62,bd=o.d*.56,bh=3.1,zf=bz+bd/2;
 // the depot: battered body with chamfered roof edges, four roof ribs, the slatted shutter and its light
 ab(b,bx,y0,bz,bw+.3,.4,bd+.3,p.arm2,.1);b.loft([{p:rect(bw,bd,.3,bx,bz),y:y0+.4},{p:rect(bw,bd,.3,bx,bz),y:y0+bh-.7},{p:rect(bw-1.3,bd-.3,.3,bx,bz),y:y0+bh}],(r)=>r?p.arm2:p.arm);
 const nr=hi?4:2;for(let k=0;k<nr;k++){const x=bx-(bw/2-1.4)+(bw-2.8)*k/(nr-1);ab(b,x,y0+bh,bz,.4,.5,bd-.8,p.rib,.08);}
 b.at(bx,0,zf,0,q=>{gateDoor(q,p,0,y0,bw*.5,bh-1.2,p.acc,{slats:6,split:false});if(hi)for(const s of [-1,1])fin(q,s*(bw/2-.45),y0+.4,.4,bh-1.2,.24,p.arm2,{front:p.rib});});
 if(hi)for(const s of [-1,1])b.at(bx+s*bw/2,0,bz,s*HP,q=>{for(let k=0;k<3;k++)fin(q,-(bd/2-.8)+(bd-1.6)*k/2,y0+.4,.4,bh-1.2,.24,p.arm2,{front:p.rib});strip(q,0,y0+1.2,.03,bd*.4,.1,p.accS);});
 // tank silos: two at level 1, one more per level (up to six), taller with the level; a lit ring under every cap
 const sp=[[4.1,-4.05],[1.35,-4.05],[-1.4,-4.05],[-4.15,-4.05],[4.1,-1.3],[4.1,1.45]],ns=Math.min(5,L)+1,sh=2.1+.38*L,sr=Math.min(1.25,hw*.21);
 for(let k=0;k<ns;k++){const x=sp[k][0]/6*hw,z=sp[k][1]/6*hd,m=k%2?p.arm:p.arm2;b.cyl(x,y0,z,sr,sh,m,{n,top:false});b.dome(x,y0+sh,z,sr,.55,sr,m,{n,rings:hi?3:2});b.loft([{p:circ(sr+.05,n,x,z),y:y0+sh-.22},{p:circ(sr+.05,n,x,z),y:y0+sh-.08}],p.acc,{top:false,smooth:true});
  if(hi){hoop(b,x,y0+sh*.45,z,sr,.18,.07,L>=5?p.gold:p.rib,n,0,1);hoop(b,x,y0+.1,z,sr,.3,.1,p.rib,n,0,1);b.cyl(x,y0+sh+.5,z,.3,.16,L>=5?p.gold:M.plate2,{n:6});}}
 // crates by the door (more with the level)
 const nc=hi?Math.min(6,2+L):2;for(let k=0;k<nc;k++){const c=k%3,l=(k/3)|0;ab(b,hw-1.5-c*.05,y0+l*.86,hd-1.2-c*1.05+l*.5,1,.84,.96,k%2?M.plate2:p.rib,.06);}
});

// town-reactor (3x3, a vital): a ribbed drum with cyan rings between the ribs, a gold crown and the glowing white dome;
// radiator blocks at the sides, coolant towers at the back from level 3.
WK.model('town-reactor',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,circ}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,n=hi?16:8,R=Math.min(hw,hd)*.63;apron(b,o,p,true);
 const dh=2.7+.52*L,yb=y0+.5,top=yb+dh,C=(r,y)=>({p:circ(r,n),y});
 ab(b,0,y0,0,o.w-2,.5,o.d-2,p.arm2,.14);
 b.loft([C(R*.96,yb),C(R,yb+dh*.3),C(R,yb+dh*.72),C(R*.8,top)],(r)=>r===2?p.arm2:p.arm,{smooth:true,topMat:p.arm2});
 // the ribs (sloped shoulders), and cyan rings showing between them
 around(b,0,0,R-.08,hi?16:8,Math.PI/n,q=>fin(q,0,yb,hi?.42:.6,dh*.86,.42,p.arm2,{front:p.rib,sh:dh*.2}));
 const nrn=hi?L+1:Math.min(2,L);for(let k=0;k<nrn;k++){const y=yb+dh*(.16+.56*(nrn>1?k/(nrn-1):.5));b.loft([C(R+.1,y),C(R+.1,y+.14)],M.cyan,{top:false,smooth:true});}
 // gold crown, the white dome
 const rc=R*.74;b.loft([C(rc+.3,top-.1),C(rc+.34,top+.22),C(rc,top+.3)],p.gold,{top:false,smooth:true});b.dome(0,top+.2,0,rc,Math.min(1.7,7.9-top-.2),rc,glow(0xe8f6ff,1),{n,rings:hi?4:2});
 if(hi){around(b,0,0,rc+.3,16,0,q=>cb(q,0,top+.1,0,.24,.26,.2,M.gold));b.halo(0,top+1,0,rc*1.6,0xcfefff,.25);}
 // radiator blocks with fins at the sides, pipes at the foot
 for(const s of [-1,1]){const x=s*(hw-1.45);ab(b,x,y0+.5,.4,1.3,1.9,2.6,p.arm,.1);if(hi){for(let k=0;k<5;k++)cb(b,x+s*.1,y0+.6,.4-1+k*.5,1.3,1.7,.14,p.rib);b.pipe([[x,y0+.8,2],[x,y0+.8,2.6],[s*R*.5,y0+.8,R*.82]],.16,p.arm2);}}
 if(hi)for(const s of [-1,1])b.pipe([[s*1.2,y0+.75,R*.9],[s*1.2,y0+.75,R+.9],[s*2.6,y0+.75,R+.9]],.18,p.arm2);
 // coolant towers at the back corners from level 3
 if(L>=3)for(const s of [-1,1]){const x=s*(hw-1.5),z=-hd+1.5,h=3.1+.45*L;vessel(b,p,x,y0,z,.9,h,p.arm,{hoop:L>=5?p.gold:p.rib,n:hi?10:6,dh:.5});b.loft([{p:circ(.95,hi?10:6,x,z),y:y0+h-.2},{p:circ(.95,hi?10:6,x,z),y:y0+h-.06}],p.acc,{top:false,smooth:true});}
});

// town-shield (2x2): a hex pedestal, a tapered core wound with coil rings, the glowing orb; four pylons with gold caps.
WK.model('town-shield',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,circ}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,n=hi?10:6,H6=(r,y)=>({p:circ(r,6,0,0,r,0),y});apron(b,o,p);
 const R=Math.min(hw,hd)*.72,ch=2.8+.58*L,yb=y0+1.4,top=yb+ch;
 b.loft([H6(R,y0),H6(R,y0+.5),H6(R*.78,y0+.9),H6(R*.62,yb)],(r)=>r===1?p.arm2:p.arm,{topMat:p.arm2});b.loft([H6(R+.04,y0+.28),H6(R+.04,y0+.4)],p.accS,{top:false});
 // the core and its coil rings (one more per level), the orb
 b.cyl(0,yb,0,.95,ch,p.arm2,{n,r2:.5});const nr=3+L;for(let k=0;k<nr;k++){const t=(k+.6)/(nr+.4),r=.95+(.5-.95)*t+.34;if(hi)b.ring(0,yb+ch*t,0,r,glow(0xa8f8ff,1.1),{thin:nr>6});else if(k%2===0)b.loft([{p:circ(r,6),y:yb+ch*t-.08},{p:circ(r,6),y:yb+ch*t+.08}],glow(0xa8f8ff,1.1),{top:false});}
 b.cyl(0,top,0,.6,.24,L>=5?p.gold:p.arm,{n:hi?8:6});b.ball(0,top+.86,0,.72,glow(0xdff8ff,1.1),!hi);if(hi)b.halo(0,top+.86,0,1.8,0x9fe8ff,.35);
 // four pylons with gold caps and a light slit
 for(let k=0;k<4;k++){const a=k*HP+HP/2,x=Math.cos(a)*R*.74,z=Math.sin(a)*R*.74,h=1.9+ch*.42;b.at(x,0,z,-a+HP,q=>{if(hi)q.loft([{p:b.k.rect(.62,.62,.1),y:y0+.6},{p:b.k.rect(.5,.5,.08),y:y0+h}],p.arm,{top:false});else cb(q,0,y0+.6,0,.56,h-.6,.56,p.arm);cb(q,0,y0+h,0,.66,.3,.66,M.gold);strip(q,0,y0+1.2,.3,.12,h-1.6,p.acc);});}
});

// town-lab (3x3, a vital): a dark ribbed dome on an octagonal drum, the violet glow at the dome's foot, in the door and
// in the skylight lantern (taller with the level), a gold cap and a small dish.
WK.model('town-lab',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,circ}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,n=hi?16:8,vio=glow(0xa07bff,.8),C8=Math.cos(Math.PI/8);apron(b,o,p,true);
 const R=Math.min(hw,hd)*.78,dhh=2,yd=y0+.3+dhh,rd=R*.9,domeH=2.7;
 b.loft([octR(b,R+.25,y0),octR(b,R+.25,y0+.3),octR(b,R,y0+.3),octR(b,R,yd-.2),octR(b,R-.25,yd)],(r)=>r<2?p.arm2:p.arm,{topMat:p.arm2});
 around(b,0,0,R-.06,8,Math.PI/8,q=>fin(q,0,y0+.3,.7,dhh,.36,p.arm2,{front:p.rib,sh:.5}));
 if(hi)around(b,0,0,R*C8,8,0,(q,i)=>{if(i!==2){strip(q,0,y0+.9,.02,R*.42,.9,p.arm2);for(const s of [-1,1])strip(q,s*R*.12,y0+1.2,.04,R*.14,.3,i%2?vio:p.black);}});
 // the violet ring, the dome and its ribs
 b.loft([{p:circ(rd+.12,n),y:yd-.02},{p:circ(rd+.12,n),y:yd+.2}],vio,{top:false,smooth:true});b.dome(0,yd+.1,0,rd,domeH,rd,p.arm2,{n,rings:hi?4:2,cut:.86});
 if(hi)for(let k=0;k<16;k++){const a=k/16*TAU;let q0=null;for(let i=0;i<=3;i++){const t=i/3*HP*.84,r=(rd+.05)*Math.cos(t),q1=[Math.cos(a)*r,yd+.1+domeH*Math.sin(t)+.03,Math.sin(a)*r];if(q0)b.tube(q0,q1,.1,p.rib,{n:3});q0=q1;}}
 // the skylight lantern (taller with the level), gold cap, dish
 const ly=yd+.1+domeH*Math.sin(HP*.86)-.1,lh=.3+.2*L,lr=rd*Math.cos(HP*.86)+.25;b.cyl(0,ly,0,lr,.2,p.arm,{n:hi?10:6});b.cyl(0,ly+.2,0,lr*.82,lh,vio,{n:hi?10:6,top:false});b.cyl(0,ly+.2+lh,0,lr,.2,M.gold,{n:hi?10:6,r2:lr*.5});
 if(hi){b.halo(0,ly+.4,0,2.2,0xa07bff,.3);bowlDish(b,p,rd*.55,yd+domeH*.62,-rd*.5,.6);}
 // the entrance: an armoured porch with the violet door
 b.at(0,0,R*C8-.2,0,q=>{ab(q,0,y0,.5,2.8,2.3,1.2,p.arm,.1);strip(q,0,y0+.1,1.11,1.5,1.7,vio);strip(q,0,y0+1.95,1.11,2,.1,M.white);if(hi){cb(q,0,y0+.1,1.11,.1,1.7,.05,p.dark);for(const s of [-1,1])fin(q,s*1.2,y0,.3,2.4,.2,p.arm2,{front:p.rib,z:1.1});}});
 // level kit: sample tanks beside the porch
 for(let k=0;k<Math.min(4,L-1);k++){const s=k%2?1:-1,x=s*(hw-1.2),z=hd-1.3-(k>>1)*1.5;vessel(b,p,x,y0,z,.5,1.5,M.plate,{hoop:p.gold,hoops:1,n:hi?8:5,cap:glow(0xa07bff,.5)});}
});

// ================================================== walls: the cell per ore blend, corner post, rubble =============
// ore looks, index 0 = composite: [body colour, accent colour, accent glow, surface]
const ORE=[[0x8a8676,0x5c5a50,0,'concrete'],[0x7a4a2c,0xb7a28a,.15,'metal'],[0x23262c,0x5fa8ff,.55,'metal'],[0x55657e,0x22e6ff,1,'metal'],[0x3a2420,0xff7a3d,1.1,'concrete'],[0xbab2e8,0xf6f0ff,1.5,'glass'],[0x10141f,0x9fe8ff,2.2,'metal']];
// town-wall: ONE wall cell, 4.02 x 4.02 m in plan, instanced up to 2,000 times. o.ore 0..6, o.lvl 1..3, o.h = height.
// A fortification: a battered foot, the body (colour x 0.72), a wider coping with a lit chamfer in the ore's accent, ore
// bands (one per blend level) and the ore's own character. The section is the same on all four sides and every part that
// overhangs the cell does so by the same amount, so cells tile along x and z with nothing showing between neighbours.
WK.model('town-wall',(b,o)=>{const {mat,glow,tint,rect}=b.k,hi=b.hi,ore=Math.max(0,Math.min(6,o.ore|0)),lvl=Math.max(1,Math.min(3,(o.lvl|0)||1)),h=o.h||4,W=4.02,[bc,ac,g,sf]=ORE[ore],R=(w,y)=>({p:rect(w,w),y});
 const body=tint(mat(bc,sf,ore===1?.9:ore===5?.25:ore===4?.7:.3,0),.72),foot=tint(body,.8),acc=g>0?glow(ac,Math.min(2,g*(.55+.25*lvl))):mat(ac,'concrete',.3,0),cap=o.mini?(ore?glow(ac,Math.max(.14,g*.18)):glow(0xd8c08a,.1)):ore?glow(ac,Math.min(2,Math.max(.55,g*.8))):glow(0xd8c08a,.45),
  cope=ore>=5?tint(mat(ac,sf,.2,0),.5):mat(0x353d49,'metal',.2,0),top=(w,y,m)=>b.quad([-w/2,y,-w/2],[w/2,y,-w/2],[w/2,y,w/2],[-w/2,y,w/2],m,[0,y-1,0]),F=(fn)=>{for(let k=0;k<4;k++)b.at(0,0,0,k*HP,fn);},z=W/2;
 if(!hi){   // LOW: battered body, the lit coping, one ore band
  if(ore){b.loft([R(W+.3,0),R(W,h)],body,{top:false});if(!o.mini)b.loft([R(W+.2,h*.5),R(W+.14,h*.5+.2)],acc,{top:false});}else b.loft([R(W+.3,0),R(W,h*.34),R(W,h)],body,{top:false});
  b.loft([R(W+.22,h-.04),R(W,h+.22)],cap,{top:false});top(W,h+.22,cope);return;}
 b.loft([R(W+.34,0),R(W+.34,.26),R(W,h*.34),R(W,h-.02)],(r)=>r<2?foot:body,{top:false});
 b.loft([R(W+.22,h-.06),R(W+.22,h+.1),R(W,h+.22)],(r)=>r?cap:cope,{top:false});top(W,h+.22,cope);
 if(!ore){b.loft([R(W+.05,h*.56),R(W+.05,h*.56+.09)],mat(0x3c3a34,'concrete',.5,0),{top:false});F(q=>{strip(q,-.95,h*.62,z+.02,.5,h*.24,foot);strip(q,.95,h*.62,z+.02,.5,h*.24,foot);});return;}   // composite: a joint line and cast recesses
 const bh=ore>=4?.12+.04*lvl:.1;for(let k=0;k<lvl;k++)b.loft([R(W+.05,h*(.4+.16*k)),R(W+.05,h*(.4+.16*k)+bh)],acc,{top:false});
 if(ore===1)F(q=>{for(const s of [-1,1]){strip(q,s*1,h*.72,z+.03,1.1,h*.18,mat(ac,'metal',.6,0));}});                                    // Ferrite: riveted pale plates
 else if(ore===2)F(q=>{const m=tint(mat(0x3d4654,'metal',.1,0),1);for(const s of [-1,1])q.quad([s*.98-.62,h*.7,z+.03],[s*.98,h*.7-h*.2,z+.03],[s*.98+.62,h*.7,z+.03],[s*.98,h*.7+h*.2,z+.03],m,[0,h*.7,0]);});   // Ilmenite: faceted dark panels
 else if(ore===3)F(q=>{strip(q,0,h*.36,z+.03,.1,h*.6,glow(ac,.9));if(lvl>=2)strip(q,-1.3,h*.74,z+.03,.6,.07,glow(ac,.9));});               // Armalcolite: the cyan seam
 else if(ore===4){const m=glow(ac,1.3),n=lvl+1;for(let k=0;k<n;k++){const x=n>2?-1.2+(k%2)*2.4:-.9+k*1.8,zz=n>2?-1.1+((k/2)|0)*2.2-(n===3&&k===2?1.1:0)*1:0;b.at(n===3&&k===2?0:x,h+.2,n===3&&k===2?0:zz,k*1.3,q=>q.loft([{p:b.k.circ(.13,3),y:0},{p:b.k.circ(.015,3),y:.55+.2*lvl+.12*(k%2)}],m,{top:false}),.14+.05*(k%2));}}   // Tranquillityite: the needle crest
 else if(ore===5){const w=glow(0xffffff,1.9);b.at(0,h+.24,0,HP/2,q=>q.quad([-W*.42,0,-.12],[W*.42,0,-.12],[W*.42,0,.12],[-W*.42,0,.12],w,[0,-1,0]));if(lvl>=2)F(q=>strip(q,.9,h*.12,z+.03,.1,h*.76,w));}   // Selenite Glass: the glint line
 else if(ore===6){const m=glow(ac,Math.min(2,g*1.2*.9));top(W*.5,h+.24,m);F(q=>strip(q,0,h*.44+lvl*.3,z+.03,.5,h*.3,m));}                   // Moonheart: the deep-glow core slab
});
// town-post: the corner post (1.9 x 5.5 x 1.9) that stands on a wall cell: a taller armoured pier with a cyan top light.
WK.model('town-post',(b,o)=>{const {mat,glow,rect,pal}=b.k,M=pal.mil,hi=b.hi,d=mat(0x353d49,'metal',.25,0),d2=mat(0x404a57,'metal',.25,0),R=(w,y)=>({p:rect(w,w),y}),cy=glow(0x22e6ff,1.6);
 if(!hi){b.loft([R(1.8,0),R(1.45,4.7)],d,{top:false});b.loft([R(1.76,4.7),R(1.76,5.14)],d2,{top:false});b.quad([-.88,5.14,-.88],[.88,5.14,-.88],[.88,5.14,.88],[-.88,5.14,.88],d2,[0,0,0]);cb(b,0,5.14,0,.5,.32,.5,cy);return;}
 b.loft([R(1.9,0),R(1.9,.55),R(1.5,.8),R(1.42,4.66),R(1.78,4.86),R(1.78,5.14),R(1.3,5.2)],(r)=>r===0||r>=3?d2:d);cb(b,0,5.2,0,.52,.3,.52,cy);
 for(let k=0;k<4;k++)b.at(0,0,0,k*HP,q=>{strip(q,0,1.1,.75,.1,3.3,glow(0x22e6ff,.7));q.quad([-.3,4.9,.9],[.3,4.9,.9],[.3,5.08,.9],[-.3,5.08,.9],M.gold,[0,5,0]);});
});
// town-rubble: a ruined wall cell (4 x 1.4 x 4): the broken stub of the wall on its foot, fallen blocks around it.
WK.model('town-rubble',(b,o)=>{const {mat,tint,rect,hash}=b.k,hi=b.hi,d=mat(0x353d49,'metal',.5,.1),d2=mat(0x404a57,'concrete',.6,.1),ru=tint(mat(0x7a4a2c,'scrap',.9,.1),.55),c=[0,.2,0];
 // the stub: a jagged remnant of the body
 const stub=(x0,x1,H,m)=>{const P=[[x0,-.62],[x1,-.62],[x1,.62],[x0,.62]];for(let i=0;i<4;i++){const j=(i+1)%4;b.quad([P[i][0],0,P[i][1]],[P[j][0],0,P[j][1]],[P[j][0],H[j],P[j][1]],[P[i][0],H[i],P[i][1]],i%2?d2:m,[(x0+x1)/2,.2,0]);}b.quad([P[0][0],H[0],P[0][1]],[P[1][0],H[1],P[1][1]],[P[2][0],H[2],P[2][1]],[P[3][0],H[3],P[3][1]],tint(d2,.85),[(x0+x1)/2,-2,0]);};
 stub(-1.8,-.5,[1.38,1.2,.95,1.3],d);stub(-.5,1.1,[.7,.42,.6,.52],d);
 // the foot that survived, fallen slabs and chunks
 b.loft([{p:rect(3.96,3.96),y:0},{p:rect(3.7,3.7),y:.16}],d2,{top:false});b.quad([-1.85,.16,-1.85],[1.85,.16,-1.85],[1.85,.16,1.85],[-1.85,.16,1.85],tint(d2,.8),[0,0,0]);
 const n=hi?7:2;for(let k=0;k<n;k++){const a=k*2.4+.6,r=1.25+.45*hash(k*7+2),x=Math.cos(a)*r*(k%2?.82:.7),z=(Math.sin(a)>0?1:-1)*(1.05+.4*hash(k*3+1)),s=.38+.26*hash(k*11+5);
  if(k%3===2)b.part().gem(x,.16+s*.4,z,s*.9,s*.6,s*.7,ru,a);else b.part().at(x,.14,z,a,q=>cb(q,0,0,0,s*1.5,s*.7,s*1.1,k%2?d:d2),.2*(k%2?1:-1),.16);}
 if(hi){b.at(.6,.16,1.3,.5,q=>cb(q,0,0,0,1.5,.14,.7,ru),0,.1);b.tube([1.2,.5,-.3],[1.75,1.25,-.5],.04,ru,{n:3});b.tube([.9,.6,.2],[1.3,1.3,.5],.04,ru,{n:3});}
});

// ================================================== decorations (small set pieces at the origin) ====================
const decoP=(b,o)=>{const {mat,glow,tint,pal}=b.k,M=pal.mil,arm=mat(0x343a43,'metal',.3,.04),ah=o.accent!=null?o.accent:0x22e6ff;return {M,arm,arm2:tint(arm,.7),rib:tint(arm,1.32,.012),ah,acc:glow(ah,1),gold:M.gold};};
// decor-lamps: a 3.4 m town lamp; o.accent = light colour
WK.model('decor-lamps',(b,o)=>{const p=decoP(b,o),{glow}=b.k,hi=b.hi;
 if(hi)b.loft([{p:b.k.rect(.56,.56,.12),y:0},{p:b.k.rect(.56,.56,.12),y:.2},{p:b.k.rect(.3,.3,.08),y:.42}],p.arm2);else cb(b,0,0,0,.5,.3,.5,p.arm2);
 b.tube([0,.3,0],[0,2.86,0],.075,p.rib,{n:hi?6:4});if(hi){hoop(b,0,1.1,0,.075,.14,.04,p.gold,6,0,1);b.cyl(0,2.8,0,.2,.12,p.arm2,{n:6,r2:.14});}
 cb(b,0,2.92,0,.34,.32,.34,glow(p.ah,1.7));if(hi){for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])b.tube([sx*.17,2.9,sz*.17],[sx*.17,3.26,sz*.17],.025,p.arm2,{n:3});}
 b.loft([{p:b.k.rect(.58,.58),y:3.24},{p:b.k.rect(.2,.2),y:3.4}],p.arm,{topMat:p.gold});b.halo(0,3.05,0,.8,p.ah,.4);b.pool(0,.05,0,1.6,1.6,p.ah,.14);
});
// decor-crates: three armoured supply crates (two on LOW)
WK.model('decor-crates',(b,o)=>{const p=decoP(b,o),{M}=p,hi=b.hi,crate=(x,y,z,w,h,d,m,ry,lid)=>b.at(x,y,z,ry,q=>{cb(q,0,0,0,w,h,d,m);if(hi){band(q,0,h*.68,0,w+.05,h*.12,d+.05,lid);for(const s of [-1,1])band(q,s*w*.3,0,0,.1,h+.02,d+.06,p.arm2);strip(q,0,h*.3,d/2+.02,w*.22,h*.1,p.acc);}});
 crate(-.44,0,-.14,.84,.78,.8,p.arm,.1,p.gold);crate(.47,0,hi?-.2:.24,.76,.58,.74,M.plate2,-.16,p.rib);if(hi)crate(.12,0,.4,.5,.4,.4,M.hazard,.3,M.hazardD);
});
// decor-antenna: a 5 m whip antenna with a red tip light on a small base
WK.model('decor-antenna',(b,o)=>{const p=decoP(b,o),{M}=p,{glow}=b.k,hi=b.hi;
 b.cyl(0,0,0,.28,.3,p.arm2,{n:hi?6:5,r2:.2});b.tube([0,.3,0],[0,2.6,0],.06,p.rib,{n:hi?5:3});b.tube([0,2.6,0],[0,4.9,0],.03,M.bare,{n:3});cb(b,0,4.9,0,.16,.16,.16,glow(0xff3048,2));
 if(hi){hoop(b,0,2.5,0,.06,.16,.05,p.gold,6,0,1);for(const [y,w] of [[3.2,.26],[3.8,.2],[4.4,.14]]){b.tube([-w,y,0],[w,y,0],.02,M.bare,{n:3});b.tube([0,y,-w],[0,y,w],.02,M.bare,{n:3});}b.tube([.2,.3,0],[.04,1.5,0],.025,p.arm2,{n:3});b.tube([-.2,.3,0],[-.04,1.5,0],.025,p.arm2,{n:3});b.halo(0,5,0,.7,0xff3048,1);}
});
// decor-plants: an armoured planter with two shrubs
WK.model('decor-plants',(b,o)=>{const p=decoP(b,o),S=b.k.pal.set,hi=b.hi,R=b.k.rect;
 b.loft(hi?[{p:R(1.44,1,.1),y:0},{p:R(1.56,1.1,.1),y:.42},{p:R(1.56,1.1,.1),y:.52},{p:R(1.36,.9,.1),y:.52}]:[{p:R(1.44,1),y:0},{p:R(1.56,1.1),y:.52}],(r)=>r===1?p.rib:p.arm2,{topMat:S.soil});
 if(hi){strip(b,0,.16,.54,.9,.07,p.acc);}
 b.part().ball(-.36,.98,.02,.48,S.leaf,true);b.part().ball(.4,.86,-.04,.38,S.leafD,true);if(hi){b.part().ball(-.2,1.22,-.1,.3,S.leafD,true);b.part().ball(.52,1.06,.1,.22,S.leaf,true);}
});
// decor-statue: a stepped plinth with a faceted gold figure
WK.model('decor-statue',(b,o)=>{const p=decoP(b,o),{glow,rect}=b.k,hi=b.hi,g=glow(0xb98a30,.16),g2=glow(0xd0a040,.24);
 cb(b,0,0,0,1.6,.3,1.6,p.arm2);cb(b,0,.3,0,1.2,.7,1.2,p.arm);if(hi){band(b,0,.86,0,1.26,.1,1.26,p.gold);for(let k=0;k<4;k++)b.at(0,0,0,k*HP,q=>strip(q,0,.48,.61,.6,.08,p.acc));}
 b.gem(0,1.72,0,.46,.72,.4,g,.4);b.gem(0,2.62,0,.24,.3,.24,g2,.9);
 if(hi){for(const s of [-1,1]){const a=[s*.2,1.9,-.1],c=[s*.82,2.75,-.3],d=[s*.3,2.4,-.16];b.tri(a,c,d,g2,[0,2,2]);b.tri(a,c,d,g,[0,2,-3]);}b.halo(0,2.1,0,.9,0xffd36b,.14);}
});
// decor-flags: two 3.6 m poles with pennants in the accent colour
WK.model('decor-flags',(b,o)=>{const p=decoP(b,o),{glow}=b.k,hi=b.hi,fl=glow(p.ah,.22);
 for(const [x,l] of [[-.95,.95],[.15,.85]]){if(hi)cb(b,x,0,0,.26,.16,.26,p.arm2);b.tube([x,0,0],[x,3.56,0],.05,p.rib,{n:hi?5:3});if(hi)b.gem(x,3.6,0,.07,.1,.07,p.gold);
  for(const s of [-1,1])b.quad([x+.05,3.42,s*.012],[x+.05,2.82,s*.012],[x+l,2.98,s*.012],[x+l,3.26,s*.012],fl,[x,3,-s]);
  if(hi){for(const s of [-1,1])b.quad([x+.05,3.2,s*.02],[x+.05,3.04,s*.02],[x+l*.8,3.08,s*.02],[x+l*.8,3.16,s*.02],glow(0xffffff,.5),[x,3,-s]);}}
});

// ================================================== frontier wrecks (the green war band) ===========================
// rusted, overgrown, abandoned: pal.wreck. A grass tuft = a few leaning blades.
function tuft(b,x,y,z,s,m,k=0){const n=b.hi?3:2;for(let i=0;i<n;i++){const a=k*1.7+i*2.1;b.at(x+Math.cos(a)*.1*s,y,z+Math.sin(a)*.1*s,a,q=>q.loft([{p:b.k.circ(.07*s,3),y:0},{p:b.k.circ(.01*s,3),y:.5*s*(1-.2*i)}],m,{top:false}),.3+.12*i);}}
// the wreck palette's colours on another surface (armour plate and pipe are worn metal, not corrugated sheet)
const resurf=(b,m,surf,wear)=>({c:m.c,a:b.k.surfA(b.k.SURF[surf],wear),j:m.j});
// tank-wreck (5.8 x 2.6 x 3.8, the hull's length along x): a burnt hull tilted into the ground, one track thrown, the
// turret askew with a drooping bent barrel, a blown hatch, rust streaks, moss and grass. o.seed varies turret and tilt.
WK.model('tank-wreck',(b,o)=>{const {pal,tint,rect,circ,hash}=b.k,W0=pal.wreck,Wk=Object.assign({},W0,{hull:resurf(b,tint(W0.hull,1.25),'paint',.85),rust:resurf(b,W0.rust,'metal',.95)}),hi=b.hi,sd=o.seed|0,h1=hash(sd*7+1),h2=hash(sd*13+5),h3=hash(sd*29+3),sg=sd%2?1:-1;
 const burnt=resurf(b,tint(W0.hull,.42),'metal',.6),moss=Wk.moss,grass=pal.nat.olive,ch=hi?.22:0;
 if(hi)b.cap(circ(1,9,0,0,1,.3).map((q,i)=>[q[0]*(2.3+.45*hash(sd+i*3)),q[1]*(1.5+.35*hash(sd+i*5+1))]),.03,Wk.mud,true);
 b.at(0,-.26,-.12,0,q=>{
  // lower hull (scorch-dark) and the upper hull with its glacis; the engine deck is rust
  q.loft([{p:rect(4.5,1.9,ch),y:.2},{p:rect(5,2,ch),y:.7},{p:rect(5,2,ch),y:1}],burnt,{top:false});
  q.loft([{p:rect(5,2.2,ch),y:1},{p:rect(4.7,2.1,ch),y:1.28},{p:rect(3.5,1.8,ch,-.35,0),y:1.5}],(r)=>r?Wk.hull:Wk.rust,{topMat:Wk.hull});
  // the track that stayed on (-z side)
  q.loft([{p:rect(4.5,.46,0,0,-1.2),y:.05},{p:rect(5.15,.46,0,0,-1.2),y:.4},{p:rect(5.15,.46,0,0,-1.2),y:.8},{p:rect(4.8,.46,0,0,-1.2),y:1.02}],Wk.track);
  // the thrown side: bare road wheels, the track lying in the grass
  const nw=hi?5:3;for(let k=0;k<nw;k++){const x=-1.9+3.8*k/(nw-1);q.tube([x,.48,1.02],[x,.48,1.36],k===1?.3:.36,k%2?Wk.rust:Wk.track,{n:hi?7:5,caps:true});}
  if(hi)q.tube([2.3,.86,1.02],[2.3,.86,1.32],.26,Wk.rust,{n:6,caps:true});
  // rust streaks down the sides, the open engine grille
  if(hi){for(let k=0;k<5;k++){const x=-2+k*.95+.3*hash(sd+k);q.quad([x,1.02,-1.44],[x+.3,1.02,-1.44],[x+.22,.5+.2*hash(k+sd*3),-1.44],[x+.06,.42,-1.44],Wk.rust,[x,.7,0]);}
   for(let k=0;k<3;k++)cb(q,-1.9,1.5,-.5+k*.5,.9,.05,.3,burnt);q.quad([1.3,1.31,-.7],[2.2,1.26,-.7],[2.2,1.26,.6],[1.3,1.31,.6],Wk.rust,[1.7,0,0]);}
  // moss over the deck and the glacis, a blanket of it down the rear corner, creepers over the hull
  cb(q,-.9,1.5,.35,1.5,.07,1,moss);if(hi){cb(q,1.6,1.3,-.5,.9,.06,.7,moss,.4);cb(q,-2,1.3,.6,.7,.08,.6,moss,.3);
   q.quad([-2.52,1.02,-.2],[-2.52,1.02,1.02],[-2.3,.3,1.02],[-2.3,.42,-.1],moss,[0,.6,.4]);q.quad([-2.5,1.04,1.12],[-1.2,1.04,1.12],[-1.5,.5,1.12],[-2.3,.36,1.12],tint(moss,.8),[-1.8,.7,0]);q.quad([-1.4,1.03,-1.45],[.1,1.03,-1.45],[-.2,.66,-1.45],[-1.1,.55,-1.45],moss,[-.6,.8,0]);
   q.cable([-2.4,1.32,-.9],[-.6,1.52,-.7],.02,.035,tint(moss,.7),{n:3});q.cable([.9,1.3,1.1],[2.4,1.05,.4],.03,.035,tint(moss,.7),{n:3});}
  // the turret, thrown askew: blown hatch, drooping bent barrel
  q.at(-.3,1.48,.08,(.25+.33*h3)*sg,t=>{
   t.loft([{p:rect(2,1.6,hi?.4:0),y:0},{p:rect(1.8,1.45,hi?.36:0),y:.42},{p:rect(1.2,1,hi?.26:0),y:.7}],(r)=>r?Wk.hull:Wk.rust,{topMat:Wk.rust});
   cb(t,.95,.08,0,.5,.44,.8,burnt);t.tube([1.1,.32,0],[2.1,.24,0],.14,Wk.hull,{n:hi?6:4});t.tube([2.1,.24,0],[2.72,-.3,.14],.13,Wk.rust,{n:hi?6:4,caps:true});
   if(hi){t.ball(2.1,.24,0,.17,Wk.rust,true);t.tube([2.62,-.22,.12],[2.78,-.36,.15],.18,burnt,{n:6});t.cap(circ(.3,7,-.2,.25),.71,burnt);
    t.at(-.56,.7,.25,.3,l=>{l.cyl(0,0,0,.33,.07,Wk.rust,{n:7,bot:true});},0,1.15);cb(t,.2,.7,-.3,.6,.07,.45,moss,.6);tuft(t,-.5,.6,-.4,1,grass,sd);}
  },.1+.06*h1,.05*sg);
  if(hi){tuft(q,-1.6,1.5,.2,1.1,grass,sd+1);tuft(q,.4,1.5,.75,.9,moss,sd+2);tuft(q,-2.1,1.3,-.5,1,grass,sd+4);}
 },(.06+.07*h1)*sg,-.045-.05*h2);
 // the thrown track in the grass, tufts at the foot
 {const pts=hi?[[2.3,1.35],[1.3,1.62],[.2,1.7],[-.9,1.6],[-1.9,1.72]]:[[2.3,1.4],[.2,1.68],[-1.9,1.7]];for(let i=1;i<pts.length;i++){const a=pts[i-1],c=pts[i];b.quad([a[0],.07,a[1]-.2],[a[0],.07,a[1]+.16],[c[0],.07,c[1]+.16],[c[0],.07,c[1]-.2],i%2?Wk.track:tint(Wk.track,1.5),[0,-1,0]);}}
 const nt=hi?6:2;for(let k=0;k<nt;k++){const a=k*1.9+sd,x=(k%2?1:-1)*(1.2+1.3*hash(sd+k*5)),z=(k%3-1)*1.55;tuft(b,x,0,z,1.3+.5*hash(k+sd),k%2?grass:moss,k+sd);}
});
// sandbags (o.w along x): a stacked line, two rows high, the upper row offset by half a bag
WK.model('sandbags',(b,o)=>{const {pal,tint,rect,hash}=b.k,Wk=pal.wreck,hi=b.hi,w=o.w||4,n=Math.max(2,Math.round(w/(hi?1:1.34))),bl=w/n,sd=o.seed|0;
 const bag=(x,y,z,l,d,k)=>{const m=k%3===1?tint(Wk.bag,.86):Wk.bag,ry=(hash(sd*5+k)-.5)*.16;b.part().at(x,y,z,ry,q=>{if(hi){q.loft([{p:rect(l-.14,d-.12),y:0},{p:rect(l,d),y:.13},{p:rect(l-.22,d-.2),y:.31}],m,{top:false});q.quad([-l/2+.11,.31,-d/2+.1],[l/2-.11,.31,-d/2+.1],[l/2-.11,.31,d/2-.1],[-l/2+.11,.31,d/2-.1],tint(m,1.08),[0,0,0]);}else{q.loft([{p:rect(l,d),y:0},{p:rect(l-.14,d-.12),y:.3}],m,{top:false});q.quad([-l/2+.07,.3,-d/2+.06],[l/2-.07,.3,-d/2+.06],[l/2-.07,.3,d/2-.06],[-l/2+.07,.3,d/2-.06],m,[0,0,0]);}});};
 for(let k=0;k<n;k++)bag(-w/2+bl*(k+.5),0,.06,bl-.03,.66,k);for(let k=0;k<n-1;k++)bag(-w/2+bl*(k+1),.28,-.04,bl-.03,.6,k+7);
 if(hi)tuft(b,-w*.3,0,.5,.9,Wk.moss,sd);
});
// barbed-wire (o.w along x): one span: a leaning post at x = -w/2, three strands to x = +w/2, a coil of wire
WK.model('barbed-wire',(b,o)=>{const {pal,hash}=b.k,Wk=pal.wreck,hi=b.hi,w=o.w||3,x0=-w/2,x1=w/2,lean=.16;
 b.tube([x0-.02,0,.02],[x0+lean,1.42,-.04],.065,Wk.post,{n:hi?4:3});
 for(const [y,s] of [[.4,.05],[.8,.09],[1.2,.06]]){const xa=x0+lean*y/1.42;b.tube([xa,y,0],[x1+lean*y/1.42,y,0],.022,Wk.wire,{n:3});}
 // the coil: a loose helix along the foot of the span
 const n=hi?8:1;let p0=null;for(let i=0;i<=n;i++){const t=i/n,a=t*TAU*2.6,q=[x0+.35+(w-.7)*t,.3+Math.sin(a)*.26,.34+Math.cos(a)*.26];if(p0)b.tube(p0,q,.018,Wk.wire,{n:3});p0=q;}
});
// pipeline (o.w along x, the pipe axis at y = 1.0): a rusted span, a flange collar at x = -w/2 and a cradle there that
// runs down to y = -o.sink (default 0.6) for slopes
WK.model('pipeline',(b,o)=>{const {pal,tint}=b.k,Wk=pal.wreck,hi=b.hi,w=o.w||6,x0=-w/2,sink=o.sink??.6,n=hi?8:5,r=.42,rA=resurf(b,tint(Wk.rust,.95),'metal',.95),rB=resurf(b,tint(Wk.rust,.66),'metal',.8),conc=resurf(b,tint(Wk.post,1.2),'concrete',.8);
 if(hi){b.tube([x0,1,0],[x0+w*.42,1,0],r,rA,{n});b.tube([x0+w*.42,1,0],[x0+w*.5,1,0],r+.035,Wk.hull,{n});b.tube([x0+w*.5,1,0],[x0+w,1,0],r,rB,{n});}else b.tube([x0,1,0],[x0+w,1,0],r,rA,{n});
 // the flange collar and the cradle under it
 b.tube([x0,1,0],[x0+.26,1,0],r+.14,resurf(b,Wk.hull,'metal',.8),{n,caps:true});
 if(hi){cb(b,x0+.24,-sink,0,.44,sink+.42,1.1,conc);for(const s of [-1,1])b.quad([x0+.04,.42,s*.5],[x0+.44,.42,s*.5],[x0+.44,1,s*.44],[x0+.04,1,s*.44],conc,[x0+.24,.6,0]);cb(b,x0+.24,.42,0,.34,.2,.9,Wk.hull);
  cb(b,x0+w*.2,1.39,0,.9,.05,.36,Wk.moss);b.tube([x0+w*.72,1.3,.2],[x0+w*.72,1.66,.2],.06,Wk.hull,{n:3});}
 else cb(b,x0+.24,-sink,0,.4,sink+.7,.9,conc);
});
// crane-wreck (4 x 9 x 7): an abandoned rusted crane: a four-leg tower, the broken jib sagging toward +z with a dangling
// hook cable, the cab, a counterweight.
WK.model('crane-wreck',(b,o)=>{const {pal,tint}=b.k,Wk=pal.wreck,hi=b.hi,tz=-2,th=7.5,w0=2.5,w1=1.1,rA=resurf(b,Wk.rust,'metal',.95),rB=resurf(b,tint(Wk.rust,.7),'paint',.9),burnt=resurf(b,tint(Wk.hull,.6),'metal',.6);
 // base slab, moss on it
 if(hi)b.bev(0,0,tz,3.3,.45,2.9,Wk.hull,{ch:.1});else cb(b,0,0,tz,3.3,.45,2.9,Wk.hull);cb(b,-.9,.45,tz+.8,1.1,.06,.8,Wk.moss);
 // the tower
 if(hi)b.truss(0,.45,tz,w0,w1,th-.45,rA,{step:2.3,r:.07});else{const leg=(t,sx,sz)=>{const w=(w0+(w1-w0)*t)/2;return [sx*w,.45+(th-.45)*t,tz+sz*w];},C=[[-1,-1],[1,-1],[1,1],[-1,1]];for(const c of C)b.tube(leg(0,c[0],c[1]),leg(1,c[0],c[1]),.09,rA,{n:3});for(const t of [.4,.8])for(let i=0;i<4;i++)b.tube(leg(t,C[i][0],C[i][1]),leg(t,C[(i+1)%4][0],C[(i+1)%4][1]),.06,rA,{n:3});}
 // the slew ring and the cab with its broken window
 cb(b,0,th,tz,1.5,.26,1.5,Wk.hull);cb(b,.3,th+.26,tz-.1,1.15,1.1,1.25,rB);b.at(.3,0,tz+.53,0,q=>strip(q,0,th+.66,.01,.8,.44,burnt));if(hi){cb(b,.3,th+1.36,tz-.1,1.3,.07,1.4,Wk.hull);strip(b,.3-.2,th+.66,tz+.545,.3,.2,Wk.rust);}
 // the counter-jib with its weight, the jib: one length still up, the rest broken and hanging
 const j0=[-.45,th+.5,tz],j1=[-.45,th+.72,tz+2.9],j2=[-.2,th-2.2,tz+5.1],jib=(a,c,r,m)=>{for(const s of [-1,1])b.tube([a[0]+s*.3,a[1],a[2]],[c[0]+s*.3,c[1],c[2]],r,m,{n:3});b.tube([a[0],a[1]+.5,a[2]],[c[0],c[1]+.5,c[2]],r,m,{n:3});
   if(hi){const k=4;for(let i=0;i<k;i++){const t0=i/k,t1=(i+1)/k,P=(t,dx,dy)=>[a[0]+(c[0]-a[0])*t+dx,a[1]+(c[1]-a[1])*t+dy,a[2]+(c[2]-a[2])*t];b.tube(P(t0,-.3,0),P(t1,0,.5),r*.7,m,{n:3});b.tube(P(t0,.3,0),P(t1,0,.5),r*.7,m,{n:3});b.tube(P(t1,-.3,0),P(t1,.3,0),r*.7,m,{n:3});}}};
 jib(j0,j1,.06,rA);jib(j1,j2,.055,rB);b.tube([-.45,th+.6,tz],[-.45,th+.4,tz-1.4],.1,rA,{n:hi?4:3});cb(b,-.45,th-.1,tz-1.25,.9,.6,.5,burnt);
 if(hi){b.tube([-.45,th+1.36,tz-.1],[-.45,th+1.24,tz+2.9],.02,Wk.wire,{n:3});b.tube([0,th+1.36,tz-.1],[-.45,th+.5,tz-1.4],.02,Wk.wire,{n:3});}
 // the hook cable hangs from the broken end
 b.tube(j2,[j2[0],1.5,j2[2]+.1],.025,Wk.wire,{n:3});cb(b,j2[0],1.1,j2[2]+.1,.3,.42,.22,Wk.hull);if(hi){b.tube([j2[0],1.1,j2[2]+.1],[j2[0]+.12,.84,j2[2]+.1],.04,rA,{n:3});b.tube([j2[0]+.12,.84,j2[2]+.1],[j2[0]-.1,.76,j2[2]+.1],.04,rA,{n:3});
  tuft(b,1.2,0,tz+1.6,1.4,Wk.moss,1);tuft(b,-1.5,0,tz+1.5,1.3,pal.nat.olive,2);tuft(b,.9,.45,tz-.9,1,Wk.moss,3);b.tube([1.25,.45,tz+1.25],[.9,3,tz+.9],.03,Wk.moss,{n:3});}
});
// drill-wreck (5 x 5 x 3): an abandoned drilling machine: a rusted tracked body, the cab, the tilted drill arm, grass.
WK.model('drill-wreck',(b,o)=>{const {pal,tint,rect}=b.k,W0=pal.wreck,Wk=Object.assign({},W0,{hull:resurf(b,tint(W0.hull,1.2),'paint',.85)}),hi=b.hi,rA=resurf(b,W0.rust,'paint',.95),rB=resurf(b,tint(W0.rust,.65),'metal',.9),burnt=resurf(b,tint(W0.hull,.5),'metal',.5),grass=pal.nat.olive;
 b.at(.19,-.08,0,0,q=>{
  // tracks, hull, engine deck, cab
  for(const s of [-1,1])q.loft([{p:rect(3.6,.46,0,.2,s*.98),y:0},{p:rect(4.2,.46,0,.2,s*.98),y:.32},{p:rect(4.2,.46,0,.2,s*.98),y:.66},{p:rect(3.9,.46,0,.2,s*.98),y:.84}],Wk.track);
  if(hi)q.bev(.2,.5,0,3.7,1,1.6,rA,{ch:.1});else cb(q,.2,.5,0,3.7,1,1.6,rA);cb(q,1.35,1.5,0,1.3,1.15,1.5,Wk.hull);
  q.at(1.35,0,.76,0,c=>strip(c,0,1.95,.01,.9,.5,burnt));q.at(2.01,0,0,HP,c=>strip(c,0,1.95,.01,1.1,.5,burnt));cb(q,-.2,1.5,0,1.5,.3,1.3,rB);
  if(hi){for(let k=0;k<3;k++)cb(q,-.7+k*.42,1.8,0,.14,.05,1.1,burnt);q.cyl(.3,1.8,-.45,.12,.7,burnt,{n:5});cb(q,1.35,2.65,0,1.4,.07,1.6,rB);
   for(const s of [-1,1])for(let k=0;k<3;k++)q.tube([-1.1+k*1.3,.38,s*1.2],[-1.1+k*1.3,.38,s*1.24],.27,rB,{n:6,caps:true});}
  // the drill arm: a leaning mast on a yoke, the rod and auger, a hydraulic strut
  const a=[-1.1,1.5,0],c=[-2.3,4.86,0];for(const s of [-1,1])q.tube([a[0],a[1],s*.3],[c[0],c[1],s*.22],.09,rA,{n:hi?4:3});
  if(hi)for(let k=1;k<=4;k++){const t=k/4.4,x=a[0]+(c[0]-a[0])*t,y=a[1]+(c[1]-a[1])*t;q.tube([x,y,-.3],[x,y,.3],.05,rA,{n:3});}
  cb(q,-1.15,1.5,0,.6,.4,.9,Wk.hull);q.tube([-.4,1.7,0],[-1.6,3,0],.07,Wk.hull,{n:hi?5:3});
  const d0=[c[0]+.24,c[1]-.3,0],d1=[a[0]-.62,.25,0];q.tube(d0,d1,.11,rB,{n:hi?6:4});q.tube(d1,[d1[0]+.12,-.1,0],.2,burnt,{n:hi?6:4,r2:.03});
  if(hi){for(let k=1;k<=3;k++){const t=k/4,x=d0[0]+(d1[0]-d0[0])*t,y=d0[1]+(d1[1]-d0[1])*t;q.at(x,y,0,0,r=>r.cyl(0,-.04,0,.22,.08,rA,{n:6,bot:true}),0,-.34);}cb(q,c[0]+.1,c[1]-.34,0,.5,.36,.6,Wk.hull);}
  // moss and grass on the deck
  cb(q,.1,1.8,.3,.9,.06,.6,Wk.moss);if(hi){cb(q,1.3,2.72,-.2,.8,.05,.7,Wk.moss);tuft(q,-.4,1.8,-.3,1,grass,1);tuft(q,1.5,2.7,.3,.8,Wk.moss,3);}
 },.05,.04);
 if(hi){tuft(b,-1.7,0,1.1,1.3,grass,4);tuft(b,1.9,0,-1.25,1.2,Wk.moss,5);}
});
})(typeof globalThis!=='undefined'?globalThis:window);
