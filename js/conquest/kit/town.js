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
function TP(b,o,maxL=5){const {mat,glow,tint,pal}=b.k,M=pal.mil,L=Math.max(1,Math.min(maxL,(o.level|0)||1)),fh=o.finish==='sand'?0x8f7c62:o.finish==='graphite'?0x3a424e:0x48535f,
  ah=o.accent!=null?o.accent:(L>=5?0xa8f8ff:L>=3?0x62f0e2:0x7fe9ff),arm=mat(fh,'metal',.3,.04),sand=o.finish==='sand';
 // gm / gm2 / top: the navy-charcoal gunmetal of the owner's Meshy turrets (#232b38 / #2b3442) and its lighter top plates (#36404e)
 return {L,M,ah,arm,gm:mat(sand?0x4c4234:0x232b38,'metal',.25,.03),gm2:mat(sand?0x5a4f3f:0x2b3442,'metal',.3,.03),top:mat(sand?0x6e6250:0x36404e,'metal',.2,.03),arm2:tint(arm,.78),rib:tint(arm,1.34,.014),lite:tint(arm,1.7,.03),gun:tint(arm,.9,.004),dark:M.dark,black:mat(0x14181d,'metal',.1,0),gold:M.gold,goldG:glow(0xffd36b,.6),apron:mat(0x7d848d,'concrete',.3),
  acc:glow(ah,1),accS:glow(ah,.7),white:M.white,ice:M.ice,amber:M.amber,fire:glow(0xff8a3d,1.5),trim:L>=5?M.gold:tint(arm,1.5,.02)};}
// a light pad / window / warhead tip: the shader multiplies a glow by 2.3 and tone-maps it, which bleaches a pale cyan to
// white; the deepened colour (each channel to the power pw) at a part glow (k < 1) comes out on screen as the hex itself
// (#7fe9ff stays cyan: pw 2.5, k 0.45; a warm colour needs pw 1.5)
function pad(b,hex,k=.45,pw=2.5){const c=b.k.col(hex);return {c:[Math.pow(c[0],pw),Math.pow(c[1],pw),Math.pow(c[2],pw)],a:k,j:0};}
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
const strip0=(b,x,y,z,w,d,m)=>b.quad([x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2],m,[x,y-1,z]);   // a flat mark lying on a deck
const strip=(b,x,y,z,w,h,m)=>b.quad([x-w/2,y,z],[x+w/2,y,z],[x+w/2,y+h,z],[x-w/2,y+h,z],m,[x,y,z-1]);
// run fn in n frames around a circle, +z pointing outward
function around(b,cx,cz,r,n,rot,fn){for(let i=0;i<n;i++){const a=i/n*TAU+rot;b.at(cx+Math.cos(a)*r,0,cz+Math.sin(a)*r,-a+HP,q=>fn(q,i,a));}}
// a band around an upright round body (a collar, a light ring): cheap replacement for a torus
function hoop(b,x,y,z,r,hh,t,m,n,rot=0,simple){const C=b.k.circ,R=b.hi&&!simple?[{p:C(r,n,x,z,r,rot),y},{p:C(r+t,n,x,z,r+t,rot),y:y+hh*.25},{p:C(r+t,n,x,z,r+t,rot),y:y+hh*.75},{p:C(r,n,x,z,r,rot),y:y+hh}]:[{p:C(r+t,n,x,z,r+t,rot),y},{p:C(r+t,n,x,z,r+t,rot),y:y+hh}];return b.loft(R,m,{top:false,smooth:true});}
// the inside of a bin: the walls between two rings (A above, B below), facing inward and up (a loft's faces look outward)
function inLoft(b,A,B,m){const n=A.p.length;let cx=0,cz=0;for(const q of A.p){cx+=q[0];cz+=q[1];}cx/=n;cz/=n;
 for(let i=0;i<n;i++){const j=(i+1)%n,a=A.p[i],c=A.p[j],d=B.p[j],e=B.p[i],mx=(a[0]+c[0])/2,mz=(a[1]+c[1])/2;b.quad([a[0],A.y,a[1]],[c[0],A.y,c[1]],[d[0],B.y,d[1]],[e[0],B.y,e[1]],m,[cx+(mx-cx)*3,(A.y+B.y)/2,cz+(mz-cz)*3]);}return b;}
// compacted regolith under a turret disc (so it does not read as an island on the ground): an irregular 12-sided flat patch,
// half extents hx / hz, at y = 0.03, with a slightly darker rim ring that feathers down to the ground (LOW: the patch
// alone). Drawn without the builder's ground shading: it is ground, not a part standing on it.
function groundApron(b,hx,hz,seed=1,ch=1.15){const {mat,tint,hash}=b.k,g=mat(0x6a5f58,'dirt',.2,0),rim=tint(g,.84),t=.3,P=[],ao=b.aoMin,h=k=>hash(seed*31+k);
 [[1,1],[-1,1],[-1,-1],[1,-1]].forEach(([sx,sz],q)=>{const c1=ch*(.62+.5*h(q*3)),c2=ch*(.62+.5*h(q*3+1)),ins=.14*h(q*3+2),off=(h(q*5+7)-.5)*.5,A=[sx*hx,sz*(hz-c1)],C=[sx*(hx-c2),sz*hz];
  if(q%2)P.push([off,sz*(hz-ins)],C,A);else P.push([sx*(hx-ins),off],A,C);});
 b.aoMin=1;try{if(!b.hi)b.cap(P,.03,g,true);else{const I=P.map(v=>[v[0]*(hx-t)/hx,v[1]*(hz-t)/hz]);b.cap(I,.03,g,true);for(let i=0;i<12;i++){const j=(i+1)%12;b.quad([P[i][0],.012,P[i][1]],[P[j][0],.012,P[j][1]],[I[j][0],.03,I[j][1]],[I[i][0],.03,I[i][1]],rim,[0,-9,0]);}}}finally{b.aoMin=ao;}return b;}
// a pad bollard / light post: an octagonal tapered gunmetal post on a base collar, one gold band, a lit slit (pale cyan
// #cfefff unless o.lit) under a chamfered cap: about 120 triangles (o.lite, where a model carries several: 88, a plainer
// collar and cap). LOW: a plain tapered post and its lit cap.
function bollard(b,p,x,y,z,h=1,o={}){const r=o.r||.17,lit=o.lit||pad(b,0xcfefff,.5),n=b.hi?8:5,C=(k,t)=>({p:b.k.circ(r*k,n,x,z,r*k,Math.PI/n),y:y+h*t});
 if(!b.hi){b.loft([C(1.2,0),C(.78,.8)],p.gm,{top:false});b.loft([C(.95,.8),C(.95,1)],lit,{topMat:p.gm2});return b;}
 b.loft(o.lite?[C(1.75,0),C(1.1,.13),C(.78,.8)]:[C(1.75,0),C(1.75,.07),C(1.1,.15),C(.78,.8)],(k)=>k<(o.lite?1:2)?p.gm2:p.gm,{top:false});b.loft([C(1.02,.5),C(.98,.57)],p.gold,{top:false});
 b.loft([C(.8,.8),C(.8,.87)],lit,{top:false});b.loft(o.lite?[C(1.08,.87),C(.62,1)]:[C(1.08,.87),C(1.08,.92),C(.62,1)],p.gm2,{topMat:p.top,bot:!o.lite});return b;}
// the apron every town building stands on: a thin concrete slab, the accent light line on its front edge; vital = a gold
// corner mark with a bollard on it at the two back corners
function apron(b,o,p,vital){const w=o.w-.4,d=o.d-.4;ab(b,0,0,0,w,.3,d,p.apron,.07);for(const sx of [-1,0,1])cb(b,sx*(w/2-1.2),.3,d/2-.3,sx?1:1.4,.05,.12,p.accS);
 if(b.hi)for(const sx of [-1,1]){cb(b,sx*(w/2-.3),.3,d/2-1.1,.1,.05,1.2,p.accS);}
 if(vital)for(const sx of [-1,1]){const x=sx*(w/2-.5),z=-d/2+.5;strip0(b,x,.32,z,.6,.6,b.k.glow(0xffd36b,1.2));bollard(b,p,x,.3,z,.95,{lite:1});}}
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
// Smelter: a ribbed, vaulted furnace hall, a tall stack with a glowing orange rim, a pour channel into the crucible (the
// melt glows deep orange at the wall and yellow-white in the middle, with a warm glow on the apron under it),
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
 const melt=[pad(b,0xff7a1a,.6,1.5),pad(b,0xff9a2c,.8,1.5),b.k.glow(0xffb347,1.7)];   // the melt: #ff7a1a at the edge to #ffb347 in the middle
 b.at(cx,2.34,zf+.4,0,q=>{cb(q,0,-.22,.75,.8,.22,1.5,p.arm2);q.quad([-.2,.02,0],[.2,.02,0],[.2,.02,1.5],[-.2,.02,1.5],melt[0],[0,-1,0]);q.quad([-.08,.03,0],[.08,.03,0],[.08,.03,1.5],[-.08,.03,1.5],melt[2],[0,-1,0]);for(const s of [-1,1])cb(q,s*.33,0,.75,.14,.14,1.5,p.rib);},.2);
 // the crucible on its cradle
 const iron=mat(0x3b2f2a,'metal',.7),cn=hi?10:6;
 b.loft([{p:circ(.8,cn,cx,cz),y:.85},{p:circ(1.22,cn,cx,cz),y:1.35},{p:circ(1.28,cn,cx,cz),y:1.95}],iron,{smooth:true,top:false,bot:true});
 b.loft([{p:circ(1.34,cn,cx,cz),y:1.84},{p:circ(1.34,cn,cx,cz),y:2.06},{p:circ(1.0,cn,cx,cz),y:2.06}],p.arm2,{top:false});
 // inside the lip: the dark wall, then the melt in three rings, deep orange at the wall to yellow-white in the middle
 b.at(cx,0,cz,0,q=>{bowl(q,[[1.0,2.06],[.96,1.86],[.66,1.9],[.3,1.93]],cn,(r)=>r?melt[r-1]:iron,true);q.cap(circ(.3,cn),1.93,melt[2],true);});
 for(const s of [-1,1]){if(hi){cb(b,cx+s*1.38,.3,cz,.3,1.5,.9,p.arm2);b.tube([cx+s*1.22,1.5,cz],[cx+s*1.6,1.5,cz],.16,p.rib,{n:6,caps:true});}
  // the gantry over the crucible: posts, beam, hoist
  b.tube([cx+s*1.72,.3,cz+.75],[cx+s*1.72,3.5,cz+.75],.11,p.rib,{n:hi?5:3});if(hi)b.tube([cx+s*1.72,2.6,cz+.75],[cx+s*1.1,3.5,cz+.75],.07,p.rib,{n:3});}
 cb(b,cx,3.5,cz+.75,3.9,.26,.34,p.arm);if(hi){cb(b,cx+.4,3.2,cz+.75,.5,.3,.5,M.hazard);b.tube([cx+.4,2.5,cz+.75],[cx+.4,3.2,cz+.75],.03,M.bare,{n:3});cb(b,cx+.4,2.36,cz+.75,.2,.16,.2,p.arm2);}
 if(hi){b.tube([cx,2.05,zf+1.85],[cx,1.94,cz-.5],.1,melt[2],{n:4});b.halo(cx,2.3,cz,2.2,0xff8a3d,.22);}b.pool(cx,.34,cz,1.9,1.9,0xff8a2a,.2);
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
 // LOW has no glass shader: its panes are painted pale glass (#9fd0c8), and the foliage green (#3f9a55) shows in the lower panels only
 const gl=hi?[mat(0x5f93b8,'glass',.1),mat(0x78aed0,'glass',.16)]:[mat(0x9fd0c8,'glass',.1,.02),mat(0x8fc3bd,'glass',.16,.02)],gr=hi?[mat(0x2f7a3c,'glass',.16),mat(0x245a30,'glass',.1),mat(0x4a9448,'glass',.2)]:[mat(0x3f9a55,'glass',.16,.02),mat(0x378a4c,'glass',.1,.02),mat(0x3f9a55,'glass',.2,.02)],rings=[];
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
// A wide vehicle hangar: armoured walls under a ribbed arch roof, the big sectional door (segment lines, an amber sill
// stripe) with a lit header in the arched front, parked machines on the apron (one more per level, up to four), framed
// skylights along the ridge, a control cab and a mast at higher levels.
WK.model('town-hangar',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,rect,mat}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2;apron(b,o,p);
 const bw=o.w-1.5,bd=o.d*.55,bz=-hd+.7+bd/2,zf=bz+bd/2,y0=.3,wh=2.7+.14*L,ry=y0+wh,rh=2.1+.14*L,vn=hi?8:4;
 ab(b,0,y0,bz,bw+.4,.5,bd+.4,p.arm2,.12);ab(b,0,y0+.5,bz,bw,wh-.5,bd,p.arm,.1);
 // the arch roof spans the width; its gable faces the front. Ribs every ~1.2 m.
 b.at(0,ry,bz,HP,q=>{q.vault(0,0,0,bd+.1,bw/2+.1,i=>(i===1||i===vn-2)?M.plate2:(i===(vn>>1)-1||i===(vn>>1))?p.arm:p.arm2,{n:vn,h:rh,ends:p.arm});const nr=hi?6:3;for(let k=0;k<nr;k++)q.vault(-(bd/2-.22)+(bd-.44)*k/(nr-1),0,0,.4,bw/2+.22,k===nr-1&&L>=5?p.gold:p.rib,{n:vn,h:rh+.12});});
 band(b,0,ry-.18,bz,bw+.24,.18,bd+.24,p.trim);
 // the door wall: frame, slatted leaf, lit header, corner buttresses; side fins
 const dw=bw*.66,dh=wh+rh*.28;
 b.at(0,0,zf,0,q=>{gateDoor(q,p,0,y0,dw,dh,p.acc,{lh:.14,fd:.26,slats:1,split:false});strip(q,0,y0+dh+.3,.3,dw*.98,.16,p.gold);
  // the sectional leaf: segment lines (#2c3440) every 0.6 m and a joint between its five panels, the amber sill stripe
  {const seg=b.k.mat(0x2c3440,'metal',.2,0),ns=hi?Math.max(3,Math.round(dh/.6)):3;for(let k=1;k<ns;k++)strip(q,0,y0+dh*k/ns-.05,.29,dw,hi?.09:.12,seg);if(hi)for(let k=1;k<5;k++)strip(q,-dw/2+dw*k/5,y0+.2,.295,.07,dh-.2,seg);strip(q,0,y0+.02,.3,dw,.17,pad(b,0xe8b93a,.42,1.5));}for(const s of [-1,1]){fin(q,s*(bw/2-.35),y0+.5,.6,wh-.5,.42,p.arm2,{front:p.rib});if(hi){fin(q,s*(dw/2+1),y0+.5,.42,wh-.3,.3,p.arm2,{front:p.rib});strip(q,s*(bw/2-.35),y0+1,.44,.14,wh*.4,p.accS);}}
  if(hi){for(const s of [-1,1])for(let k=0;k<3;k++)strip(q,s*(dw/2+.18),y0+.2+k*.5,.3,.2,.25,k%2?M.hazardD:M.hazard);strip(q,0,ry+rh*.55,.06,1.6,.3,p.white);}});
 for(const s of [-1,1])b.at(s*bw/2,0,bz,s*HP,q=>{const n=hi?5:2;for(let k=0;k<n;k++)fin(q,-(bd/2-.4)+(bd-.8)*k/(n-1),y0+.5,.42,wh-.6,.28,p.arm2,{front:p.rib});});
 if(hi)b.at(0,0,bz-bd/2,Math.PI,q=>{for(let k=0;k<7;k++)fin(q,-(bw/2-.4)+(bw-.8)*k/6,y0+.5,.42,wh-.6,.28,p.arm2,{front:p.rib});});
 // skylights along the ridge (one per level), the control cab and the mast
 {const sky=pad(b,0x9fb4c8,.4,2);for(let k=0;k<L;k++){const z=bz-(bd/2-.8)+(bd-1.6)*(L>1?k/(L-1):.5);if(hi){cb(b,0,ry+rh+.02,z,1.1,.16,.76,p.gm2);strip0(b,0,ry+rh+.19,z,.86,.52,sky);}else cb(b,0,ry+rh+.04,z,1,.12,.66,sky);}}   // skylights (#9fb4c8) in dark frames
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
 b.truss(0,y0,cz,3.5,.95,ct-y0,p.rib,{step:hi?3:4,r:.17});if(hi)for(const sx of [-1,1])for(const sz of [-1,1])cb(b,sx*1.75,y0,cz+sz*1.75,.66,.3,.66,p.arm2);
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
// Radar station base: an armoured block plinth (60% of the pad wide, 1 m high) and the mast (r 0.58, height 3 + 0.5 * level) whose top carries
// the separately turning dish ('town-radar-dish', placed with its origin at y = 0.3 + 3 + 0.5 * level). Two cable drums,
// an equipment box and a status-light bollard at every level.
function reel(b,p,x,y,z,r,ry){b.at(x,y,z,ry,q=>{const M=p.M;if(!b.hi){q.tube([-.42,r,0],[.42,r,0],r,p.rib,{n:6,caps:true});for(const s of [-1,1])cb(q,s*.5,0,0,.1,r+.08,.9,p.arm2);return;}   // LOW: one drum between its stands
  for(const s of [-1,1]){q.tube([s*.34,r,0],[s*.42,r,0],r,p.rib,{n:8,caps:true});cb(q,s*.5,0,0,.1,r+.08,.9,p.arm2);}q.tube([-.34,r,0],[.34,r,0],r*.66,M.dark,{n:8});q.tube([-.56,r,0],[.56,r,0],.09,p.gold,{n:5,caps:true});});}
WK.model('town-radar',(b,o)=>{const p=TP(b,o),{L,M}=p,{rect,glow}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,mt=y0+3+.5*L,n=hi?10:6,bw=Math.min(o.w,o.d)*.6,hb=bw/2;apron(b,o,p);
 // the plinth: a chamfered armoured block 60% of the pad wide, light slits on its faces, struts to the mast
 b.loft([{p:rect(bw,bw,bw*.19),y:y0},{p:rect(bw,bw,bw*.19),y:y0+.78},{p:rect(bw-.6,bw-.6,bw*.17),y:y0+1}],(r)=>r?p.arm2:p.arm);
 for(let k=0;k<4;k++)b.at(0,0,0,k*HP,q=>{strip(q,0,y0+.3,hb+.02,bw*.42,.16,p.acc);if(hi){for(const s of [-1,1])fin(q,s*bw*.28,y0,.3,.86,.18,p.arm2,{front:p.rib,z:hb-.06,sh:.2});q.tube([hb-.7,y0+1,hb-.7],[.36,y0+2.4,.36],.11,p.rib,{n:4});}});
 // the mast with collars; the bearing ring at its top (gold at 5)
 b.cyl(0,y0+1,0,1.15,.36,p.arm,{n:8,bev:.06});b.cyl(0,y0+1.36,0,.58,mt-y0-1.36,p.arm,{n,top:false});
 for(let y=y0+2.2;y<mt-.6;y+=.95)hoop(b,0,y,0,.58,.18,.07,p.rib,n);b.cyl(0,mt-.3,0,.74,.3,L>=5?p.gold:p.arm2,{n,bev:.05});if(hi)hoop(b,0,mt-.52,0,.58,.12,.06,p.acc,n);
 // kit on the apron, so the station is a place and not a stub when the dish is out of view: two cable drums, the
 // equipment box, the status light; more with the level
 reel(b,p,-hw+1.05,y0,hd-1.05,.62,.3);reel(b,p,-hw+1.05,y0,-hd+1.1,.5,-.5);if(L>=3)reel(b,p,-hw+.72,y0,.1,.42,HP);
 {const x=hw-1.25,z=-hd+1.2;ab(b,x,y0,z,1.5,1.5,1,p.arm,.08);b.at(x,0,z+.5,0,q=>{strip(q,-.2,y0+.5,.03,.8,.6,p.black);strip(q,.48,y0+1.15,.03,.16,.12,M.amber);if(hi)for(let k=0;k<3;k++)cb(q,-.2,y0+.6+k*.17,.03,.7,.05,.04,p.rib);});
  if(hi)b.pipe([[x-.75,y0+.3,z],[hb*.5,y0+.3,z],[hb*.5,y0+.3,-hb+.2]],.07,M.bare);
  if(L>=2){ab(b,x-.2,y0+1.5,z,.9,.45,.7,p.arm2,.06);b.tube([x+.45,y0+1.5,z-.2],[x+.45,y0+2.7,z-.2],.035,M.bare,{n:3});}}
 const sx=hw-1.1,sz=hd-1.1;bollard(b,p,sx,y0,sz,1.9,{r:.15,lit:pad(b,p.ah,.6)});if(hi)b.halo(sx,y0+1.6,sz,.6,p.ah,.4);
 if(L>=4)for(const s of [-1,1]){const x=s*(hw-.7),z=s>0?-.2:1.3;b.tube([x,y0,z],[x,y0+2.6,z],.05,M.trim,{n:4});cb(b,x,y0+2.6,z,.14,.14,.14,M.red);cb(b,x,y0,z,.4,.2,.4,p.arm2);}
 if(L>=5)b.loft([{p:rect(bw+.05,bw+.05,bw*.19),y:y0+.66},{p:rect(bw+.05,bw+.05,bw*.19),y:y0+.78}],p.gold,{top:false});
});
// surface of revolution about the frame's +y axis; up = the faces look toward +y (the inside of a bowl)
function bowl(b,prof,n,m,up){const ref=[0,up?-80:80,0];for(let r=0;r<prof.length-1;r++){const [r0,y0]=prof[r],[r1,y1]=prof[r+1];for(let i=0;i<n;i++){const a0=i/n*TAU,a1=(i+1)/n*TAU,c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1);
   b.quad([c0*r0,y0,s0*r0],[c1*r0,y0,s1*r0],[c1*r1,y1,s1*r1],[c0*r1,y1,s0*r1],typeof m==='function'?m(r,i):m,ref);}}return b;}
// The dish head only: origin at its pivot (the mast top), it looks toward +z and 36 degrees up; the game turns it about y.
WK.model('town-radar-dish',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,mat}=b.k,hi=b.hi,R=1.6+.25*L,n=hi?12:8,dp=R*.26,steel=b.k.tint(mat(0x8793a3,'paint',.1,.02),.66),dk=mat(0x2a323e,'paint',.1,0),fy0=r=>.07+(dp-.02)*r*r/(R*R);
 // the turning yoke
 b.cyl(0,0,0,.6,.22,p.arm2,{n:hi?8:6,top:false});ab(b,0,.22,-.1,.9,.6,.8,p.arm,.08);if(hi)for(const s of [-1,1])cb(b,s*.52,.2,0,.14,.75,.5,p.rib);
 b.at(0,.78,.05,0,q=>{
  // back shell with a hub and four spines; inside, the steel blue-grey reflector (#8793a3) with a dark inner ring, a dark
  // seam and a dark rib on every facet joint (HIGH); a narrow gold (or trim) rim
  bowl(q,[[.34,-.16],[.42,0],[R*.62,dp*.36],[R,dp]],n,(r)=>r===2?p.arm:p.arm2,false);bowl(q,[[R,dp],[R,dp+.05],[R-.07,dp+.05]],n,(r)=>L>=5?p.gold:p.rib,true);q.cap(b.k.circ(.34,n),-.16,p.arm2,false);
  bowl(q,(hi?[.02,.2,.3,.62,.66]:[.02,.2,.3]).map(t=>[t<.1?t:R*t,fy0(t<.1?t:R*t)]).concat([[R-.07,fy0(R-.07)]]),n,(r)=>r%2?dk:steel,true);
  if(hi)for(let k=0;k<n;k++){const a=k/n*TAU,c=Math.cos(a),sn=Math.sin(a),r0=R*.32,r1=R-.09,w=.035;q.quad([c*r0+sn*w,fy0(r0)+.012,sn*r0-c*w],[c*r0-sn*w,fy0(r0)+.012,sn*r0+c*w],[c*r1-sn*w,fy0(r1)+.012,sn*r1+c*w],[c*r1+sn*w,fy0(r1)+.012,sn*r1-c*w],dk,[0,-80,0]);}
  if(hi){for(let k=0;k<8;k++){const a=k*HP/2+HP/4,c=Math.cos(a),s=Math.sin(a);q.tube([c*.45,-.04,s*.45],[c*R*.96,dp-.04,s*R*.96],.07,p.rib,{n:3});}cb(q,0,-.5,-.5,.7,.4,.5,p.arm2);for(const s of [-1,1])q.tube([s*.3,-.5,.1],[s*.5,dp*.2,R*.5],.05,M.bare,{n:3});}
  // the feed: three struts to the horn, the accent light at its mouth
  const fy=R*.62;for(let k=0;k<3;k++){const a=k*TAU/3+HP,c=Math.cos(a),s=Math.sin(a);q.tube([c*R*.8,dp*.7,s*R*.8],[c*.12,fy,s*.12],.045,M.trim,{n:3});}
  q.cyl(0,fy-.1,0,.2,.34,p.arm2,{n:hi?6:4,r2:.12});q.cyl(0,fy-.22,0,.16,.12,glow(p.ah,1.2),{n:hi?6:4,bot:true,top:false});if(hi){q.tube([0,.08,0],[0,.5,0],.09,M.trim,{n:5});q.halo(0,fy-.2,0,.5,p.ah,.4);}
 },.3*Math.PI);
});

// ------------------------------------------------------------------ town-uplink (2x2) ----------------------------------
// Uplink mast: a lattice mast (height 6 + 1.6 * level) on an armoured footing, three shrinking cross-yards with antenna
// panels and drums, guy cables to the apron corners, the red top beacon.
WK.model('town-uplink',(b,o)=>{const p=TP(b,o),{L,M}=p,{rect,glow}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,h=6+1.6*L,fw=Math.min(o.w,o.d)*.76,w0=fw*.7,w1=.6,wAt=t=>w0+(w1-w0)*t;apron(b,o,p);
 // footing: a chamfered block 76% of the pad wide, light slits on its faces; the mast's legs stand on its corners
 b.loft([{p:rect(fw,fw,fw*.17),y:y0},{p:rect(fw,fw,fw*.17),y:y0+.45},{p:rect(fw-.7,fw-.7,fw*.15),y:y0+.7}],(r)=>r?p.arm2:p.arm);for(let k=0;k<4;k++)b.at(0,0,0,k*HP,q=>strip(q,0,y0+.15,fw/2+.03,fw*.42,.14,p.accS));
 if(hi)for(const sx of [-1,1])for(const sz of [-1,1])cb(b,sx*w0/2,y0+.7,sz*w0/2,.7,.24,.7,p.arm);
 b.truss(0,y0+.6,0,w0,w1,h-.6,p.rib,{step:hi?3.4:4.6,r:.17});
 // three cross-yards, shrinking upward: beam, end panels, a drum antenna; lights on the tips
 for(let k=1;k<4;k++){const t=k/4,y=y0+h*t,yw=2.9*(1-t)+1.5,ry=k%2?0:HP;b.at(0,y,0,ry,q=>{cb(q,0,0,0,yw*2,.16,.2,L>=5?p.gold:p.arm);
   for(const s of [-1,1]){ab(q,s*yw,-.5,0,.16,1.15,.7,k%2?M.plate:M.plate2,.04);if(hi)cb(q,s*yw,.66,0,.1,.1,.1,p.acc);if(hi)q.tube([s*wAt(t)/2,-.5,0],[s*yw*.8,.02,0],.04,p.rib,{n:3});}
   if(k<3&&(hi||k===1)){q.tube([.2,.1,.5],[.2,.1,.86],.42,M.plate,{n:hi?8:6,caps:true});if(hi)q.tube([.2,.1,.2],[.2,.1,.5],.1,p.arm2,{n:4});}});}
 // antenna panels up the mast (one more per level), the beacon
 for(let k=0;k<L;k++){const t=.5+.4*(k+.5)/L,y=y0+h*t,w=wAt(t)/2+.1;b.at(0,y,0,k*HP+HP/2*0,q=>{ab(q,0,-.5,w+.06,.44,1.1,.12,M.plate,.03);});}
 ab(b,0,y0+h,0,.7,.2,.7,L>=5?p.gold:p.arm2,.04);b.cyl(0,y0+h+.2,0,.2,.44,glow(0xff3048,2),{n:hi?6:4});if(hi){b.tube([0,y0+h+.2,.3],[0,y0+h+.68,.3],.025,M.bare,{n:3});b.halo(0,y0+h+.5,0,1.2,0xff3048,1);}
 // guy cables to the corners (HIGH), anchors, the ground cabinet
 for(const sx of [-1,1])for(const sz of [-1,1]){const ax=sx*(hw-.75),az=sz*(hd-.75);if(hi)cb(b,ax,y0,az,.5,.3,.5,p.arm2);if(hi)b.detail(()=>b.tube([ax,y0+.3,az],[sx*wAt(.6)/2,y0+h*.6,sz*wAt(.6)/2],.03,M.bare,{n:3}));}
 if(L>=2){const x=-hw+.8,z=.2;ab(b,x,y0,z,1.1,1.5,1.7,p.arm,.08);b.at(x+.55,0,z,HP,q=>{strip(q,0,y0+.4,.03,1.2,.6,p.black);strip(q,0,y0+1.15,.03,1.2,.1,p.acc);});}
 if(L>=4){const x=hw-.8,z=-.2;ab(b,x,y0,z,1,1.1,1.4,p.arm2,.08);if(hi){b.cyl(x,y0+1.1,z,.5,.14,M.plate2,{n:8});bowlDish(b,p,x,y0+1.24,z,.62);}}
});
function bowlDish(b,p,x,y,z,R){b.at(x,y,z,.6,q=>{q.tube([0,0,0],[0,.4,0],.06,p.M.trim,{n:4});q.at(0,.45,0,0,d=>{bowl(d,[[.05,0],[R,R*.3]],8,p.arm2,false);bowl(d,[[.03,.04],[R,R*.3+.02]],8,p.M.plate,true);},.7);});}

// ------------------------------------------------------------------ town-trophy (3x3) ----------------------------------
// Trophy Hall: a proud dark hall under a navy-panelled pyramid roof with gold hips and a gold finial, a colonnade front
// with a gold-framed door, banners in the accent colour, and rows of pedestals carrying glowing gold and ice trophies
// (3 + 2 * level of them).
WK.model('town-trophy',(b,o)=>{const p=TP(b,o),{L,M}=p,{rect,glow,tint}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3;apron(b,o,p);
 const bw=o.w-2.4,bd=o.d*.42,bz=-hd+.8+bd/2,zf=bz+bd/2,bh=3.3,ry=y0+.4+bh,pd=1.5,gG=glow(0xffd36b,1.15),iG=glow(0xa8f8ff,1.3);
 // stylobate (two steps), the hall, a gold cornice
 ab(b,0,y0,bz+pd/2,bw+.9,.2,bd+pd+.9,p.arm2,.06);ab(b,0,y0+.2,bz+pd/2,bw+.4,.2,bd+pd+.4,p.arm2,.06);ab(b,0,y0+.4,bz,bw,bh,bd,p.arm,.1);
 // the portico roof slab over the colonnade, the cornice, the stepped attic and the pyramid roof
 ab(b,0,ry,bz+pd/2,bw+.5,.42,bd+pd+.5,p.arm2,.1);b.loft([{p:rect(bw+.62,bd+pd+.62,0,0,bz+pd/2),y:ry+.3},{p:rect(bw+.62,bd+pd+.62,0,0,bz+pd/2),y:ry+.44}],p.gold,{top:false});
 const pw=bw*.62,pdp=bd*.8,ph=1+.18*L,gH=tint(M.gold,1.35,.01),yr=ry+.95,ft=pw*.1,fd=pdp*.1;b.loft([{p:rect(pw+.9,pdp+.9,.3,0,bz),y:ry+.54},{p:rect(pw+.5,pdp+.5,.3,0,bz),y:yr}],p.arm);
 // the roof: dark navy panels between gold hips, a gold eave line and a gold finial (gold is trim only)
 b.loft([{p:rect(pw,pdp,0,0,bz),y:yr},{p:rect(ft,fd,0,0,bz),y:yr+ph}],(r,i)=>i%2?M.navy:tint(M.navy,1.5,.006),{topMat:M.gold});band(b,0,yr,bz,pw+.06,.1,pdp+.06,M.gold);
 for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])b.tube([sx*pw/2,yr+.03,bz+sz*pdp/2],[sx*ft/2,yr+ph+.03,bz+sz*fd/2],.1,gH,{n:hi?4:3});
 cb(b,0,yr+ph,bz,ft+.16,.12,fd+.16,M.gold);b.gem(0,yr+ph+.44,bz,.2,.36,.2,gH);
 if(hi){cb(b,0,yr+ph*.42,bz+pdp*.29+.03,pw*.3,.05,.06,p.accS);b.halo(0,yr+ph+.5,bz,1,0xffe3a0,.14);}
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
// The town gate (3.8 x 3.8 m in plan, 4 m to the pylon tops; it is drawn shut: the rules open it, not the model): two
// gunmetal pylons with chamfered corners and chamfered tops, a gold cap band and a small hooded beacon on each, standing a
// metre over the lintel between them; under the lintel, on both faces, the recessed door: hazard-amber slats (#e8b93a) on a
// dark leaf (#1b222c) under a cyan header strip. LOW keeps the two pylons, the door, the amber slat block, the header strip
// and the gold bands.
WK.model('town-gate',(b,o)=>{const p=TP(b,o),{rect,mat}=b.k,hi=b.hi,W=3.8,H=4,pw=1.05,dw=W-pw*2,dz=W/2-.62,lz=W/2-.5,ly=2.95,dh=ly-.9,amb=pad(b,0xe8b93a,.42,1.5),leaf=mat(0x1b222c,'paint',.3,0),cy=pad(b,0x8fe6ff,.5),ch=hi?.16:0;
 ab(b,0,0,0,W,.22,W,p.gm2,.07);
 for(const sx of [-1,1]){const x=sx*(W/2-pw/2),R=(dw2,dd,y,c=ch)=>({p:rect(pw-dw2,W-dd,c,x,0),y});
  // the pylon: a foot collar, the shaft, the gold cap band, the chamfered top with its top plate
  b.loft(hi?[R(0,0,.22),R(0,0,.5),R(.1,.1,.6),R(.1,.1,H-.5),R(.5,.9,H-.12,.1)]:[R(0,0,.22),R(.1,.1,H-.5),R(.5,.9,H-.12)],(r)=>hi&&r===0?p.gm2:r===(hi?3:1)?p.gm2:p.gm,{topMat:p.top});
  b.loft([R(.04,.04,H-.78,hi?.19:0),R(.04,.04,H-.6,hi?.19:0)],p.gold,{top:false});
  if(!hi)continue;
  // the hooded beacon: a collar, the lit drum (the accent colour), a dark hood
  {const C=(r,y)=>({p:b.k.circ(r,6,x,0,r,0),y}),y=H-.12;b.loft([C(.2,y),C(.2,y+.08)],p.gm2,{top:false});b.loft([C(.13,y+.08),C(.13,y+.22)],pad(b,p.ah,.6),{top:false});b.loft([C(.23,y+.22),C(.23,y+.26),C(.08,y+.38)],p.gm,{topMat:p.gold,bot:true});b.halo(x,y+.2,0,.55,p.ah,.3);}
  // armour: a top plate, a cyan slit and a buttress foot on the two faces; a long plate and a light line on the outer side
  for(const sz of [-1,1])b.at(x,0,sz*(W/2-.05),sz>0?0:Math.PI,q=>{strip(q,0,1.75,.02,pw*.62,1.3,p.top);strip(q,0,.75,.02,.1,.8,cy);fin(q,0,.22,pw*.5,.42,.1,p.gm2,{front:p.top,sh:.2});});
  b.at(x+sx*(pw/2-.05),0,0,sx*HP,q=>{strip(q,0,1.75,.02,W*.46,1.3,p.top);strip(q,0,1.2,.03,W*.5,.07,cy);for(const s of [-1,1])fin(q,s*W*.3,.22,.34,.5,.1,p.gm2,{front:p.top,sh:.2});});}
 // the lintel between the pylons (a metre under their tops), and the recessed door on both faces
 ab(b,0,ly-.75,0,dw+.2,.75,lz*2,p.gm2,.08);
 for(const sz of [-1,1])b.at(0,0,sz*dz,sz>0?0:Math.PI,q=>{strip(q,0,.22,0,dw+.1,dh+.1,leaf);strip(q,0,ly-.52,lz-dz+.02,dw-.16,.17,cy);
   if(!hi){strip(q,0,.5,.02,dw-.1,1.3,amb);for(const y of [.86,1.3])strip(q,0,y,.03,dw-.1,.17,leaf);return;}   // LOW: the amber slat block, two dark gaps
   for(let k=0;k<5;k++)cb(q,0,.42+k*.33,.03,dw-.14,.17,.06,amb);cb(q,0,.3,.04,.09,dh-.1,.08,p.gm);   // the slats, the leaf joint
   for(const s of [-1,1]){cb(q,s*(dw/2-.02),.22,.06,.12,dh,.12,p.gm2);strip0(q,s*dw*.25,.235,lz-dz+.35,dw*.3,.22,amb);}   // guide rails, sill marks on the plinth
   strip(q,0,ly-.2,lz-dz+.02,dw*.5,.06,p.gold);});
 if(hi)b.pool(0,.05,W/2+.8,1.3,.7,p.ah,.14);
});

// ================================================== turrets (1x1 and 2x1 cells) =======================================
// Every turret is one slot: a round dark pedestal disc on a patch of compacted ground (o.part = 'base') and the turning head
// (o.part = 'head': origin at its pivot, the weapon toward +z). With no o.part the whole turret is drawn, the head at
// y = 1.4 + 0.15 * level. Each head has its own silhouette so its role reads at a glance; o.big = the 2-cell pedestal.
const TURRET_Y=.86,HEAD_S=1.3;   // the head's pivot above the ground; the head is drawn 1.3x (chunky, like the Meshy turrets)
// a small light lying on the sloped rim of an n-sided disc (vertices at rot + k * TAU / n): centred on angle a0, half span
// da, between the bevel's lower ring (ra, ya) and upper ring (rb, yb), covering the fraction u0..u1 of the slope. It is cut
// at the disc's corners so every piece lies flat on its facet (a light centred on a facet is one quad).
function rimLight(b,n,rot,a0,da,ra,ya,rb,yb,u0,u1,m){const st=TAU/n,cn=Math.cos(Math.PI/n),f=a=>{let t=(a-rot)%st;if(t<0)t+=st;return cn/Math.cos(t-st/2);},cuts=[a0-da];
 for(let k=Math.ceil((a0-da-rot)/st-1e-6);rot+k*st<a0+da-1e-4;k++){const v=rot+k*st;if(v>a0-da+1e-4)cuts.push(v);}cuts.push(a0+da);
 const P=(a,u)=>{const r=(ra+(rb-ra)*u)*f(a)+.014;return [Math.cos(a)*r,ya+(yb-ya)*u+.014,Math.sin(a)*r];};
 for(let i=0;i<cuts.length-1;i++){const a=cuts[i],c=cuts[i+1];b.quad(P(a,u0),P(c,u0),P(c,u1),P(a,u1),m,[0,-3,0]);}return b;}
function turretBase(b,p,big){const {circ,tint}=b.k,hi=b.hi,L=p.L,r0=big?1.95:1.7,r1=big?1.2:1.02,nd=big?6:4,n=hi&&!big?16:12,rot=big?Math.PI/n:Math.PI/4-Math.PI/n,C=(r,y)=>({p:circ(r,n,0,0,r,rot),y}),rim=tint(p.top,1.16,.006);
 // the compacted ground the disc stands on: the cell and the slot's margin (0.55 m) around it
 groundApron(b,big?4.59:2.55,2.55,big?5:2);
 // the pedestal of the owner's Meshy turrets: a low, wide, round dark disc (16 sides; 12 on the 2-cell disc and on LOW) with a
 // lighter rim, small cyan lights on the rim's bevel (four, or six on the 2-cell disc; each sits on one facet), a stepped collar
 b.loft(hi?[C(r0,0),C(r0,.1),C(r0-.34,.33),C(r0*.74,.36),C(r0*.74,.46),C(r1,.5),C(r1,.74)]:[C(r0,0),C(r0,.1),C(r0-.34,.33),C(r1,.5),C(r1,.74)],(r)=>r===0?rim:r===1?p.top:r%2?p.gm2:p.gm,{topMat:p.gm,smooth:false});
 for(let k=0;k<nd;k++)rimLight(b,n,rot,k*TAU/nd+(big?0:Math.PI/4),TAU*.021,r0,.1,r0-.34,.33,.2,.8,pad(b,0x8fe6ff,.55));
 if(hi){hoop(b,0,.5,0,r1,.1,.05,p.top,n,rot,1);for(let k=0;k<nd;k++){const a=k*TAU/nd+(big?Math.PI/6:0);b.at(Math.cos(a)*(r0*.74+.02),.36,Math.sin(a)*(r0*.74+.02),-a+HP,q=>cb(q,0,0,0,.34,.1,.2,p.top));}}
 for(let k=1;k<L;k++){const a=HP+(k-(L)/2)*.3,rs=(r0*.74+r1)/2;cb(b,Math.cos(a)*rs,.47,Math.sin(a)*rs,.16,.08,.16,p.gold,-a+HP);}}   // one gold stud a level, at the front
const barrel=(b,x,y,z0,z1,r,m,n)=>b.tube([x,y,z0],[x,y,z1],r,m,{n,caps:true});
const HEAD={
 // a tank-turret: sloped armour, a mantlet box, a short fat barrel with a muzzle collar, trunnion caps, hatch and sight
 cannon(b,p){const hi=b.hi,M=p.M,L=p.L,n=hi?8:5,br=.29,z0=1.2,z1=z0+1.72+L*.16;ab(b,0,-.45,-.05,1.5,.9,1.7,p.arm,.16);
  // the mantlet box at the barrel root (1.5 barrel diameters), the fat short barrel, its root sleeve and the muzzle collar
  ab(b,0,-.44,1,br*3,br*3,.5,p.arm2,.1);barrel(b,0,0,z0,z1,br,p.gun,n);b.tube([0,0,z0+.04],[0,0,z0+.5],br*1.2,p.rib,{n});
  b.tube([0,0,z1-.34],[0,0,z1],br*1.4,p.arm2,{n,caps:true});b.tube([0,0,z1-.46],[0,0,z1-.34],br*1.16,p.gold,{n});b.at(0,0,z1+.02,0,q=>q.cap(b.k.circ(br*.62,n),0,p.black,true),HP);
  b.at(0,0,-.9,Math.PI,q=>strip(q,0,.12,.02,1,.1,p.acc));
  if(hi){ab(b,-.2,.45,-.3,.74,.14,.74,p.arm2,.05);cb(b,.44,.45,.28,.22,.2,.3,p.rib);strip(b,.44,.5,.435,.14,.1,p.ice);
   for(const s of [-1,1]){ab(b,s*.8,-.3,-.1,.12,.55,1.2,p.lite,.04);b.tube([s*.84,0,-.1],[s*.93,0,-.1],.3,p.arm2,{n:8,caps:true});}b.tube([-.5,.45,-.6],[-.5,.78,-.6],.02,M.bare,{n:3});}},
 // twin heavy machine guns: fat perforated jackets, a round drum magazine on each side of the head
 mg(b,p){const hi=b.hi,M=p.M,L=p.L,n=hi?6:4,z1=.5+1.9+L*.15,dn=8;ab(b,0,-.38,-.1,1.15,.76,1.25,p.arm,.12);
  for(const sx of [-.29,.29]){barrel(b,sx,.02,.5,z1,.1,p.gun,n);b.tube([sx,.02,.55],[sx,.02,1.5],.17,p.rib,{n});b.tube([sx,.02,z1-.05],[sx,.02,z1+.22],.155,p.arm2,{n,caps:hi});}
  // a round drum magazine on each side of the head (the Meshy gun's two "ears") with a lit face; HIGH: a yellow band round each
  for(const s of [-1,1]){b.tube([s*.57,0,-.1],[s*.95,0,-.1],.4,p.arm2,{n:dn,caps:true});if(hi)b.tube([s*.68,0,-.1],[s*.84,0,-.1],.425,M.hazard,{n:dn});
   b.tube([s*.95,0,-.1],[s*.985,0,-.1],hi?.25:.18,hi?p.acc:p.accS,{n:hi?dn:6,caps:!hi});}
  if(hi){cb(b,0,.38,-.25,.6,.12,.5,p.arm2);strip(b,0,-.1,.53,.5,.1,p.acc);b.tube([.45,.3,.3],[.29,.12,.5],.05,M.bare,{n:3});b.tube([-.45,.3,.3],[-.29,.12,.5],.05,M.bare,{n:3});}},
 // a beam emitter (the owner's Meshy laser): a chamfered box housing, a short fat lens barrel on its face and the glowing
 // cyan lens; one cooling ring, side ribs and a light line on HIGH
 laser(b,p){const hi=b.hi,M=p.M,n=hi?10:6,zl=1.42,lens=b.k.glow(0x22e6ff,2);ab(b,0,-.4,-.15,1.3,1.2,1.5,p.arm,.16);
  b.tube([0,.2,.55],[0,.2,zl],.42,p.arm2,{n,caps:true});b.tube([0,.2,zl-.14],[0,.2,zl+.04],.48,p.gun,{n,caps:true});b.at(0,.2,zl+.05,0,q=>q.cap(b.k.circ(.34,n),0,lens,true),HP);
  if(hi){b.at(0,.2,.95,0,q=>q.ring(0,0,0,.45,M.cyan,{thin:true}),HP);for(const s of [-1,1]){for(let k=0;k<3;k++)cb(b,s*.66,-.2+k*.26,-.2,.1,.09,.9,p.rib);b.at(s*.655,0,-.15,s*HP,q=>strip(q,0,.56,.006,1,.06,p.acc));}
   ab(b,-.2,.8,-.35,.6,.12,.7,p.arm2,.04);cb(b,.34,.8,-.1,.26,.1,.4,p.gold);b.at(0,0,-.9,Math.PI,q=>strip(q,0,.1,.006,.8,.1,p.acc));b.halo(0,.2,zl+.14,.7,0x22e6ff,.5);}},
 // a twin rocket pod (the owner's Meshy pod): two chamfered launch boxes side by side on a central yoke, pitched up 15
 // degrees; four recessed round tubes in each face with the gold-orange warhead tips showing; blast vents at the back
 rocket(b,p){const hi=b.hi,M=p.M,n=hi?6:5,tip=pad(b,0xf0a640,.48,1.5),pw=.8,px=.57,pl=1.5,zf=pl/2;
  ab(b,0,-.3,-.05,1.15,.4,.95,p.arm2,.1);cb(b,0,.1,-.05,.3,.74,.62,p.arm);b.tube([-px,.72,-.05],[px,.72,-.05],.2,p.rib,{n:hi?8:5});
  b.at(0,.72,-.05,0,q=>{for(const s of [-1,1]){const x=s*px;ab(q,x,-pw/2,0,pw,pw,pl,p.arm,.1);
    strip(q,x,-pw/2+.07,zf+.02,pw-.14,pw-.14,p.black);
    if(hi){ab(q,x,-pw/2-.05,zf-.21,pw+.1,pw+.1,.42,p.arm,.09);q.quad([x-.3,-.3,-zf-.016],[x+.3,-.3,-zf-.016],[x+.3,.3,-zf-.016],[x-.3,.3,-zf-.016],p.black,[x,0,0]);
     cb(q,x,pw/2+.05,zf-.38,.44,.04,.1,p.acc);cb(q,x,pw/2,-.3,.3,.07,.5,p.rib);}
    for(let k=0;k<4;k++){const cx=x+(k%2?.19:-.19),cy=k<2?-.19:.19;
     if(hi){q.tube([cx,cy,zf-.02],[cx,cy,zf+.09],.165,p.arm2,{n});q.tube([cx,cy,zf-.06],[cx,cy,zf+.22],.125,tip,{n:5,r2:.02});}
     else q.quad([cx-.12,cy-.12,zf+.04],[cx+.12,cy-.12,zf+.04],[cx+.12,cy+.12,zf+.04],[cx-.12,cy+.12,zf+.04],tip,[cx,cy,0]);}}},-.262);
  if(hi){strip(b,0,-.2,.43,.6,.1,p.acc);cb(b,0,.84,-.05,.22,.2,.4,p.arm2);b.tube([0,1.04,-.15],[0,1.5,-.15],.02,M.bare,{n:3});}},
 // four guided missiles on launch rails, red-nosed, canted up
 missile(b,p){const hi=b.hi,M=p.M,n=hi?8:5,body=b.k.mat(0x3a4a63,'paint',.25,.03),nose=b.k.glow(0xd8402a,.34),wb=b.k.glow(0xe8eef5,.5);ab(b,0,-.3,-.25,1.5,.5,1.3,p.arm,.1);b.at(0,.2,-.2,0,q=>{for(let k=0;k<4;k++){const x=-.42+(k%2)*.84,y=.1+Math.floor(k/2)*.5;
    // dark bodies, a thin white band behind each red-orange nose: the four tips are the only bright accents
    q.tube([x,y,-.55],[x,y,.8],.17,body,{n,caps:true});q.tube([x,y,.8],[x,y,.89],.175,wb,{n});q.tube([x,y,.89],[x,y,1.3],.17,nose,{n,r2:.02});if(hi){cb(q,x,y-.24,-.1,.1,.08,1.3,p.arm2);for(const s of [-1,1])cb(q,x+s*.2,y-.03,-.5,.14,.06,.3,p.rib);}}
   if(hi){cb(q,0,-.12,0,1.5,.1,1.1,p.arm2);cb(q,0,.86,-.2,1.3,.08,.9,p.arm2);}},-.28);
  if(hi){strip(b,0,-.2,.41,.8,.1,p.acc);cb(b,0,.2,-.95,.9,.5,.2,p.rib);}},
 // a heavy mortar: a short fat tube on a recoil cradle, elevated, with a shell rack
 mortar(b,p){const hi=b.hi,M=p.M,L=p.L,n=hi?10:6;b.cyl(0,-.2,0,.78,.34,p.arm2,{n,bev:.06});
  // LOW has no rim light: there the tube takes the lit armour colour, and keeps its light ring and a pale muzzle band
  b.at(0,.1,-.1,0,q=>{q.cyl(0,0,0,.44,1.75+L*.15,hi?p.gun:p.lite,{n,r2:.4,topMat:p.black});if(hi){hoop(q,0,.2,0,.44,.2,.07,p.rib,n);hoop(q,0,1.4+L*.15,0,.41,.18,.06,p.arm,n);hoop(q,0,.8,0,.43,.1,.04,p.acc,n);}
   else{hoop(q,0,.74,0,.43,.16,.04,p.acc,n);hoop(q,0,1.5+L*.15,0,.4,.25,.03,p.arm2,n);}},.7);
  for(const s of [-1,1])b.tube([s*.5,-.05,-.3],[s*.3,.7,.42],.07,p.rib,{n:4});
  if(hi){for(let k=0;k<3;k++){b.cyl(-.6+k*.24,.14,-.62,.09,.34,M.plate2,{n:6});b.cyl(-.6+k*.24,.48,-.62,.09,.12,M.hazard,{n:6,r2:.02});}cb(b,-.36,.1,-.62,.8,.06,.3,p.arm);}},
 // a flame projector: twin fuel tanks, a shrouded nozzle and the burning pilot light
 flame(b,p){const hi=b.hi,M=p.M,n=hi?8:5,red=b.k.mat(0x8a3a26,'paint',.6);for(const sx of [-.3,.3]){if(hi)vessel(b,p,sx,-.35,-.55,.28,1,red,{n,hoops:1});
   else b.loft([{p:b.k.rect(.5,.5,0,sx,-.55),y:-.35},{p:b.k.rect(.5,.5,0,sx,-.55),y:.68},{p:b.k.rect(.26,.26,0,sx,-.55),y:.84}],red);}   // LOW: two red tank blocks
  ab(b,0,-.3,.05,.9,.6,.8,p.arm,.1);barrel(b,0,.05,.4,1.5,.2,p.gun,n);b.tube([0,.05,1.4],[0,.05,1.85],.22,p.arm2,{n,r2:.34});
  b.at(0,0,1.86,0,q=>strip(q,0,-.09,0,.28,.28,b.k.glow(0xff8a3d,2)));
  if(hi){b.tube([.3,.5,-.5],[.2,.3,.3],.04,M.bare,{n:3});b.tube([-.3,.5,-.5],[-.2,.3,.3],.04,M.bare,{n:3});cb(b,0,.3,.1,.5,.1,.5,M.hazard);for(const z of [.7,1])b.at(0,.05,z,0,q=>q.ring(0,0,0,.23,p.rib,{thin:true}),HP);b.halo(0,.05,2,.8,0xff8a3d,.6);}},
 // a siege gun: a low sloped gunmetal hull (#232b38) under lighter top plates (#36404e), a long heavy barrel in a fat recoil
 // sleeve with a slotted muzzle brake and gold barrel bands, a recoil cylinder each side
 siege(b,p){const hi=b.hi,L=p.L,n=hi?10:6,z1=.8+3.2+L*.3,R=(w,d,y,cz,c)=>({p:b.k.rect(w,d,hi?c:0,0,cz),y}),gunM=b.k.tint(p.top,1.12,.004);
  b.loft([R(1.95,2.2,-.5,-.25,.2),R(1.95,2.2,.2,-.25,.2),R(1.5,1.72,.7,-.4,.16)],(r)=>r?p.gm2:p.gm,{topMat:p.top});ab(b,0,-.35,.9,1.1,.9,.4,p.gm2,.12);
  barrel(b,0,.15,1,z1-.3,.28,p.gm2,n);b.tube([0,.15,1.15],[0,.15,2.35],.4,gunM,{n});b.tube([0,.15,2.35],[0,.15,2.55],.46,p.gm2,{n,caps:true});b.tube([0,.15,z1-.98],[0,.15,z1-.86],.34,p.gold,{n});
  // the muzzle brake: a wide chamfered block with two blast slots a side, the bore dark
  ab(b,0,-.17,z1-.4,.86,.64,.8,p.gm2,.1);b.at(0,.15,z1+.012,0,q=>q.cap(b.k.circ(.2,n),0,p.black,true),HP);
  for(const sx of [-.7,.7])b.tube([sx,-.05,.4],[sx,-.05,1.8],.12,gunM,{n:hi?6:4,caps:true});b.at(0,0,-1.36,Math.PI,q=>strip(q,0,.02,.02,1.2,.12,p.acc));
  if(hi){for(const s of [-1,1]){b.at(s*.435,0,z1-.4,s*HP,q=>{for(const z of [-.17,.17])strip(q,z,.02,.006,.16,.26,p.black);});ab(b,s*1.02,-.3,-.25,.12,.5,1.6,p.top,.04);}
   ab(b,-.34,.7,-.6,.66,.14,.8,p.top,.05);cb(b,.5,.7,-.1,.3,.24,.4,p.gm2);strip(b,.5,.77,.105,.2,.12,p.ice);b.tube([0,.15,2.55],[0,.15,2.63],.36,p.gold,{n});for(const z of [3,3.4])b.at(0,.15,z,0,q=>q.ring(0,0,0,.31,p.gold,{thin:true}),HP);}},
 // a lightning coil: an insulated column wound with fat pale rings under a crackling orb, a gold-capped pylon each side
 tesla(b,p){const hi=b.hi,M=p.M,L=p.L,n=hi?10:6,k3=3+Math.min(2,L>>1),vio=b.k.glow(0xe6fbff,1.9),coil=pad(b,0xcfe9ff,.52,2);b.cyl(0,-.2,0,.62,.3,p.arm2,{n,bev:.06});b.cyl(0,.1,0,.34,1.9,M.plate2,{n,r2:.2});
  // the coil: fat pale rings (2.5x the old tube) shrinking up the column
  for(let k=0;k<k3;k++){const y=.34+k*.44,r=.6-k*.065;hoop(b,0,y-.125,0,r-.125,.25,.25,coil,n);}
  // two chunky side pylons flank the column to 70% of its height, gold caps
  for(const s of [-1,1]){const x=s*.78,h=1.53;if(hi)b.loft([{p:b.k.rect(.36,.6,.08,x,0),y:-.2},{p:b.k.rect(.3,.5,.07,x,0),y:h-.2}],p.arm,{top:false});else cb(b,x,-.2,0,.32,h,.54,p.arm);cb(b,x,h-.2,0,.4,.2,.62,p.gold);
   if(hi){b.at(x+s*.16,0,0,s*HP,q=>strip(q,0,.1,.012,.14,h-.6,p.accS));cb(b,s*.5,-.2,0,.3,.26,.4,p.arm2);}}
  b.ball(0,2.25,0,.42,vio,!hi);if(hi){for(let k=0;k<3;k++){const a=k*TAU/3;b.tube([Math.cos(a)*.5,-.1,Math.sin(a)*.5],[Math.cos(a)*.16,1.95,Math.sin(a)*.16],.035,M.bare,{n:3});}b.ring(0,2.25,0,.56,p.arm2,{thin:true,rx:.5});}b.halo(0,2.25,0,1.2,0x7fe9ff,.5);},
 // a heavy beam cannon: a dark focusing dish (#2a323e, 16 sides; 12 on LOW) carried by two yoke arms from the gunmetal body;
 // inside the dish one concentric cyan ring (#8fe6ff) and a bright core only at its centre
 lasercannon(b,p){const hi=b.hi,n=hi?16:12,C=b.k.circ,dish=b.k.mat(0x2a323e,'metal',.25,.03),bowlM=b.k.mat(0x2a323e,'paint',.05,.02),ring=pad(b,0x8fe6ff,.62),R=(r,z)=>({p:C(r,n),y:z}),dy=.5,dz=.5;
  b.loft([{p:b.k.rect(1.5,1.6,hi?.16:0,0,-.35),y:-.5},{p:b.k.rect(1.5,1.6,hi?.16:0,0,-.35),y:.42},{p:b.k.rect(1.2,1.25,hi?.14:0,0,-.42),y:.72}],(r)=>r?p.gm2:p.gm,{topMat:p.top});
  // the dish looks at the target: the dark back shell, a lighter lip, the cyan ring, a dark hub and the core
  b.at(0,dy,dz,0,q=>{q.loft(hi?[R(.3,0),R(.44,.16),R(.74,.5),R(.8,.6)]:[R(.3,0),R(.74,.5),R(.8,.6)],dish,{smooth:true,top:false});
   bowl(q,hi?[[.13,.26],[.3,.34],[.44,.42],[.56,.48],[.74,.57],[.8,.605]]:[[.13,.26],[.44,.42],[.56,.48],[.8,.605]],n,(r)=>r===(hi?2:1)?ring:hi&&r===4?p.top:hi&&r===0?p.black:bowlM,true);q.cap(C(.13,n),.26,b.k.glow(0xeafcff,1.9),true);},HP);
  // the yoke: an arm each side from the body's shoulders out to the dish's trunnions
  for(const s of [-1,1]){ab(b,s*.87,dy-.2,.2,.24,.4,1.5,p.gm2,.06);if(hi){b.tube([s*.66,dy,dz+.36],[s*1.03,dy,dz+.36],.14,p.top,{n:8,caps:true});b.tube([s*1.03,dy,dz+.36],[s*1.06,dy,dz+.36],.09,p.gold,{n:6,caps:true});}}
  b.at(0,0,-1.16,Math.PI,q=>strip(q,0,.05,.02,1,.1,p.acc));
  if(hi){ab(b,0,.72,-.5,.7,.12,.6,p.top,.04);strip(b,0,.76,-.195,.44,.05,ring);b.halo(0,dy,dz+.75,.9,0x8fe6ff,.42);}},
 // a railgun: two long rails over a capacitor bank (a dark lid with one cyan strip), a cyan arc between them
 railgun(b,p){const hi=b.hi,M=p.M,L=p.L,len=3.8+L*.25,zc=-.5+len/2;ab(b,0,-.45,-.6,1.45,.9,1.65,p.arm,.14);
  for(const sx of [-.28,.28])ab(b,sx,.04,zc,.15,.34,len,p.gun,.04);b.box(0,.17,zc,.07,.07,len-.3,b.k.glow(0x22e6ff,1.8));cb(b,0,.5,-.6,1,.12,1.2,p.arm2);strip0(b,0,.632,-.6,.2,1.04,pad(b,0x8fe6ff,.55));
  if(hi){for(let k=0;k<4;k++){const z=.5+k*(len-1.2)/3;ab(b,0,-.04,z,.82,.46,.16,p.rib,.04);}for(const s of [-1,1])for(let k=0;k<3;k++)b.cyl(s*.5,.45,-1.1+k*.42,.15,.3,M.plate2,{n:6,topMat:M.cyan});b.tube([.6,.3,-.9],[.6,.9,-.9],.02,M.bare,{n:3});b.halo(0,.2,zc+len/2,.8,0x22e6ff,.5);}}};
function turret(type){return (b,o)=>{const p=TP(b,o),big=(o.w||4)>5,part=o.part;if(part!=='head')turretBase(b,p,big);if(part!=='base')b.at(0,part==='head'?0:TURRET_Y,0,0,q=>HEAD[type](q,p),0,0,HEAD_S);};}
for(const t of Object.keys(HEAD))WK.model('town-'+t,turret(t));

// ================================================== the six Meshy-backed buildings ==================================
// On HIGH these six are drawn with the owner's Meshy models; the code models are the LOW-graphics / still-loading
// stand-ins (b.hi true = the fuller stand-in). They follow the Meshy silhouettes and the old levels.
const octR=(b,r,y,cx=0,cz=0)=>({p:b.k.circ(r,8,cx,cz,r,Math.PI/8),y});

// town-cc (4x4): the hero. A stepped octagonal command tower whose bottom tier spans about 80% of the pad and whose beacon
// stands about 12 m up (13.5 m at level 10): one more tier per level (never fewer than three), two cyan windows a face on
// every tier (the Meshy CC's), the entrance on the front, a windowed core drum under a gold crown ring, a roof cone, mast
// and beacon; corner pylons from level 5, a gold ring and a gold beacon from 9. A bollard on a gold mark at each apron corner.
WK.model('town-cc',(b,o)=>{const p=TP(b,o,10),{L,M}=p,{glow,circ,mat}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,C8=Math.cos(Math.PI/8),S8=Math.sin(Math.PI/8),win=pad(b,0x7fe9ff,.48),crown=mat(0xc9a227,'metal',0,0);apron(b,o,p);
 for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*(hw-.75),z=sz*(hd-.75);strip0(b,x,.32,z,.7,.7,glow(0xffd36b,1.3));bollard(b,p,x,.3,z,1.05,{lite:1});}
 const hm=Math.min(hw,hd),nt=Math.max(3,L),ht=5.6+.1*L,r0=hm*(.86+.005*L),r1=r0*.6,rd=r0*.46,th=ht/nt;let y=y0;
 for(let k=0;k<nt;k++){const r=r0+(r1-r0)*(nt>1?k/(nt-1):0),m=k%2?p.arm2:p.arm,fw=2*r*S8;
  b.loft(hi?[octR(b,r,y),octR(b,r-.1,y+th-.18),octR(b,r-.3,y+th)]:[octR(b,r,y),octR(b,r-.2,y+th)],m,{topMat:p.arm2});
  // two discrete windows a face (LOW: one block a face); the entrance face of the first tier keeps its door
  if(hi?(nt<=5||k%2===0):(nt<=4||k%2===0)){const ww=Math.min(.66,fw*.17),wh=Math.min(.86,th*.44),wy=y+th*.27;
   around(b,0,0,(r-.03)*C8,8,0,(q,i)=>{if(k===0&&i===2)return;if(hi)for(const s of [-1,1]){strip(q,s*fw*.2,wy-.07,.04,ww+.16,wh+.15,p.black);strip(q,s*fw*.2,wy,.06,ww,wh,win);}else strip(q,0,wy,.07,fw*.44,wh,win);});}
  if(hi&&(nt<=5||k%2===0))around(b,0,0,r-.12,8,Math.PI/8,q=>fin(q,0,y,.5,th,.3,p.arm2,{front:p.rib,sh:Math.min(.4,th*.4)}));
  y+=th;}
 // the entrance on the front face of the first tier
 b.at(0,0,r0*C8-.1,0,q=>gateDoor(q,p,0,y0,Math.min(3,r0*.4),Math.min(th-.4,2.4),p.acc));
 // core drum: a window in every bay between its fins, the gold crown ring on its rim, roof cone, mast and beacon
 const dh=2.5+.03*L,n=hi?12:8,cn=Math.cos(Math.PI/n),ch=dh*.08,yt=y+dh;b.cyl(0,y,0,rd,dh,p.arm,{n,bev:.1});
 around(b,0,0,rd*cn,n,Math.PI/n,q=>{const w=rd*.26;if(hi)strip(q,0,y+dh*.36-.07,.03,w+.16,dh*.3+.14,p.black);strip(q,0,y+dh*.36,.05,w,dh*.3,win);});
 if(hi)around(b,0,0,rd,12,0,q=>fin(q,0,y+.08,.3,dh-.3,.16,p.arm2,{front:p.rib,sh:.14}));
 b.loft(hi?[{p:circ(rd+.02,n),y:yt-ch*1.5},{p:circ(rd+.2,n),y:yt-ch},{p:circ(rd+.2,n),y:yt+ch*.5},{p:circ(rd-.04,n),y:yt+ch*.5}]:[{p:circ(rd+.2,n),y:yt-ch},{p:circ(rd+.2,n),y:yt+ch*.5},{p:circ(rd-.04,n),y:yt+ch*.5}],crown,{top:false,smooth:false});
 if(hi)around(b,0,0,rd+.06,n,Math.PI/n,q=>cb(q,0,yt+ch*.5,0,rd*.2,.16,.16,crown));
 b.loft([{p:circ(rd-.1,n),y:yt+.04},{p:circ(rd*.7,n),y:yt+.52},{p:circ(.6,n),y:yt+1.2}],(r)=>r?p.arm2:p.arm,{smooth:true,topMat:p.arm});
 const my=yt+1.2,mh=1.5+.04*L;b.cyl(0,my,0,.22,mh,M.trim,{n:6,r2:.12});b.gem(0,my+mh+.25,0,.3,.42,.3,L>=9?glow(0xffd36b,1.8):glow(0xa8f8ff,1.8));
 if(hi){b.tube([-.8,my+mh*.55,0],[.8,my+mh*.55,0],.05,M.bare,{n:3});bowlDish(b,p,rd*.5,yt+.56,-rd*.4,.7);b.halo(0,my+mh+.3,0,1,L>=9?0xffd36b:0xa8f8ff,.6);}
 if(L>=9)hoop(b,0,y+dh*.1,0,rd,.2,.14,crown,n);
 // corner pylons from level 5
 if(L>=5)for(const sx of [-1,1])for(const sz of [-1,1]){const x=sx*(hw-1.75),z=sz*(hd-1.75),h=3.2+.22*L;ab(b,x,y0,z,1.5,h,1.5,p.arm2,.14);cb(b,x,y0+h,z,1.62,.16,1.62,p.acc);if(hi)cb(b,x,y0+h+.16,z,1.1,.3,1.1,L>=9?p.gold:p.arm);
   if(hi)b.at(x,0,z,sz>0?0:Math.PI,q=>strip(q,0,y0+.8,.77,.16,h-1.6,p.accS));}
 // tanks beside the entrance, a gold-collared pipe from each into the first tier (Meshy: vessels and pipes at the foot)
 if(L>=2&&hi)for(const s of [-1,1]){const x=s*(r0*.42+1.1),z=Math.min(r0*C8+.72,hd-1.05);vessel(b,p,x,y0,z,.62,1.5,p.arm,{hoop:p.gold,hoops:1,n:8});
  b.pipe([[x,y0+1.7,z],[x,y0+2.35,z],[x,y0+2.35,z-1.1]],.15,p.arm2);hoop(b,x,y0+1.86,z,.15,.2,.07,crown,6,0,1);}
});

// town-refinery (3x4): the group covers about 80% of the pad. A ribbed process block carrying the big ore hopper (a dark
// bin, a thin gold rim, a small amber heap of ore at its bottom), two domed tanks beside it (the tall one with the orange furnace glow at its foot),
// a bent pipe with gold collars from each tank over to the hopper, a chimney at the rear corner 1.4x the block's height,
// the conveyor climbing to the hopper. Level: taller tanks and chimney, a front stack, a third column, a roof unit, a gold
// column at 5.
WK.model('town-refinery',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,circ,rect}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,n=hi?12:7,gold=M.gold;apron(b,o,p);
 const bx=-hw*.3,bz=-hd*.22,bw=o.w*.52,bd=o.d*.48,bh=4.6,ry=y0+bh,zf=bz+bd/2;
 ab(b,bx,y0,bz,bw+.4,.5,bd+.4,p.arm2,.12);ab(b,bx,y0+.5,bz,bw,bh-.5,bd,p.arm,.12);band(b,bx,ry-.2,bz,bw+.2,.2,bd+.2,p.trim);
 for(const s of [-1,1])b.at(bx+s*bw/2,0,bz,s*HP,q=>{const k=hi?5:2;for(let i=0;i<k;i++)fin(q,-(bd/2-.5)+(bd-1)*i/(k-1),y0+.5,.44,bh-.6,.28,p.arm2,{front:p.rib});});
 b.at(bx,0,zf,0,q=>{for(const s of [-1,1])fin(q,s*(bw/2-.3),y0+.5,.44,bh-.6,.28,p.arm2,{front:p.rib});const dx=-bw*.27;if(hi)ab(q,dx,y0+.9,.1,1.9,2.1,.2,p.arm2,.06);strip(q,dx,y0+1.1,.22,1.3,1.5,p.black);strip(q,dx,y0+2.72,.22,1.3,.12,M.amber);});
 // the hopper: an inverted funnel, a dark bin with a thin gold rim round its mouth and a small amber heap of ore at its bottom
 const hy=ry,hh=2,hx=bw*.78,hz=bd*.56,ht=hy+hh,ore=pad(b,0xe8b93a,.42,1.5),HR=(w,d,y,dx=0)=>({p:rect(w,d,0,bx+dx,bz),y});
 b.loft([HR(hx*.5,hz*.5,hy),HR(hx,hz,ht)],p.arm2,{top:false});
 b.loft([HR(hx+.12,hz+.12,ht-.12),HR(hx+.12,hz+.12,ht+.06),HR(hx-.14,hz-.14,ht+.06)],gold,{top:false});inLoft(b,HR(hx-.14,hz-.14,ht+.06),HR(hx*.62,hz*.62,ht-.8),p.black);
 b.loft([HR(hx*.62,hz*.62,ht-.8),HR(hx*.2,hz*.2,ht-.52,.2)],ore,{topMat:ore});
 if(hi)for(const s of [-1,1]){b.at(bx,0,bz+s*hz*.38,0,q=>{fin(q,-hx*.3,hy,.3,hh*.8,.3,p.arm2,{front:p.rib,z:s>0?hz*.02:-hz*.02-.3,sh:.1});});}
 // the conveyor from the front apron up to the hopper, amber-lit
 {const a=[bx,y0+.5,hd-1.3],c=[bx,ht+.5,bz+bd*.2],len=Math.hypot(c[1]-a[1],c[2]-a[2]),pit=Math.atan2(c[1]-a[1],a[2]-c[2]);
  b.at(a[0],a[1],a[2],Math.PI,q=>{cb(q,0,-.16,len/2,1.1,.26,len,p.arm2);q.quad([-.38,.11,0],[.38,.11,0],[.38,.11,len],[-.38,.11,len],p.black,[0,-2,len/2]);for(const s of [-1,1])cb(q,s*.5,.1,len/2,.1,.16,len,p.rib);const nl=hi?6:3;for(let i=0;i<nl;i++)cb(q,0,.11,len*(i+.5)/nl,.5,.05,.2,glow(0xffb347,.9));},-pit);
  cb(b,bx,y0,hd-1.3,1.5,.5,1.2,p.arm2);for(const s of [-1,1])b.tube([bx+s*.45,y0,zf+1.1],[bx+s*.45,y0+.5+(zf+1.1-a[2])/(c[2]-a[2])*(c[1]-a[1])-.1,zf+1.1],.09,p.rib,{n:4});}
 // a domed tank: furnace glow at the foot of the first, hoops, an accent ring under the dome
 const col=(x,z,r,h,m,hot)=>{b.cyl(x,y0,z,r*1.18,.5,p.arm2,{n:8,bev:.08});b.cyl(x,y0+.5,z,r,h-.5,m,{n,top:false});b.dome(x,y0+h,z,r,r*.7,r,m,{n,rings:hi?3:2});
  if(hot)b.loft([{p:circ(r+.04,n,x,z),y:y0+1.4},{p:circ(r+.04,n,x,z),y:y0+2}],glow(0xff8a3d,1.5),{top:false,smooth:true});
  if(hi){if(hot)around(b,x,z,r+.02,8,.2,q=>fin(q,0,y0+1.2,.3,1,.12,p.arm2,{sh:.1}));for(let i=1;i<=3;i++)hoop(b,x,y0+2+(h-2.4)*i/3.4,z,r,.2,.08,i===3?gold:p.rib,n);}
  b.loft([{p:circ(r+.06,n,x,z),y:y0+h-.2},{p:circ(r+.06,n,x,z),y:y0+h-.06}],p.acc,{top:false,smooth:true});};
 // a bent pipe from a tank's dome over to the hopper mouth, a gold collar at each end
 const spout=(x,z,r,h)=>{const yt=y0+h+r*.7,xe=bx+hx/2-.75,pr=.24,pn=hi?6:4,yk=Math.min(yt+.42,o.h-.32);b.pipe([[x,yt-.12,z],[x,yk,z],[xe,Math.max(ht+1.2,Math.min(yt-.5,yk)),z],[xe,ht+.42,z]],pr,p.arm2,{n:pn,joint:p.rib});
  hoop(b,x,yt-.06,z,pr,.24,.09,gold,pn,0,1);hoop(b,xe,ht+.4,z,pr,.3,.09,gold,pn,0,1);};
 const tx=hw*.55,z1=-hd*.42,h1=5.4+.78*L,z2=z1+3.15,h2=4.5+.6*L;
 col(tx,z1,1.45,h1,p.arm,true);spout(tx,z1,1.45,h1);if(hi)b.halo(tx,y0+1.7,z1+1.5,2.2,0xff8a3d,.25);
 col(tx,z2,1.3,h2,p.arm2,false);spout(tx,z2,1.3,h2);
 if(L>=3)col(tx,z2+2.7,1,3.6+.5*L,p.arm,false);
 if(L>=5){const zg=z2+4.95;col(tx,zg,.85,7.6,p.arm,false);b.dome(tx,y0+7.6,zg,.87,.62,.87,gold,{n,rings:hi?3:2});for(const t of [.3,.6])hoop(b,tx,y0+7.6*t,zg,.85,.3,.08,gold,n,0,1);}
 // the chimney at the rear corner: 1.4x the block's height (and a little more with every level), a gold band, a dark cap
 {const x=-hw+1.5,z=-hd+1.5,h=bh*1.4+.35*L,cn=hi?10:6;b.cyl(x,y0,z,.95,.6,p.arm2,{n:8,bev:.08});b.cyl(x,y0+.6,z,.68,h-.6,p.arm,{n:cn,r2:.54,top:false});
  hoop(b,x,y0+h-.5,z,.55,.26,.08,gold,cn,0,!hi);b.cyl(x,y0+h,z,.56,.6,p.dark,{n:cn,r2:.72,topMat:p.black});if(hi){hoop(b,x,y0+h*.45,z,.6,.2,.07,p.rib,cn);b.halo(x,y0+h+.5,z,1.3,0xff8a3d,.1);}}
 // level kit: a thin stack at the front, a roof unit; low pipes from the tanks into the block
 if(L>=2){const x=-hw+1.1,z=hd*.42,h=3.8+L;b.cyl(x,y0,z,.75,.5,p.arm2,{n:6});b.cyl(x,y0+.5,z,.5,h,p.arm2,{n:hi?8:5,r2:.4,top:false});b.cyl(x,y0+.5+h,z,.5,.2,p.dark,{n:hi?8:5,topMat:p.black});if(hi)hoop(b,x,y0+h*.6,z,.46,.16,.06,gold,8,0,1);}
 if(L>=4){ab(b,bx-bw*.22,ry,bz-bd*.38,bw*.32,1,bd*.14,p.arm2,.08);if(hi)strip(b,bx-bw*.22,ry+.4,bz-bd*.31+.02,bw*.22,.14,p.accS);}
 if(hi)for(const zz of [z1,z2])b.pipe([[bx+bw/2,y0+1.3,zz+.5],[tx-1.2,y0+1.3,zz+.5]],.16,M.bare);
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

// town-reactor (3x3, a vital): a tall ribbed barrel about 79% of the pad wide (its height about 0.8 of the dome's diameter),
// deep buttress fins standing 8% of the radius proud with cyan rings showing between them, a gold crown and the glowing
// white dome; radiator blocks at the front corners, coolant towers at the back from level 3.
WK.model('town-reactor',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,circ}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,n=hi?16:8,R=Math.min(hw,hd)*.73,rc=R*.58,fd=R*.08+.1;apron(b,o,p,true);
 const dh=4+.2*L,yb=y0+.5,top=yb+dh,C=(r,y)=>({p:circ(r,n),y}),ring=pad(b,p.ah,.5);
 ab(b,0,y0,0,o.w-2,.5,o.d-2,p.arm2,.14);
 b.loft([C(R*.96,yb),C(R,yb+dh*.25),C(R,yb+dh*.66),C(rc+.34,top)],(r)=>r===2?p.arm2:p.arm,{smooth:true,topMat:p.arm2});
 // the ribs (sloped shoulders), and cyan rings showing between them
 around(b,0,0,R-.1,hi?16:8,Math.PI/n,q=>fin(q,0,yb,hi?.4:.62,dh*.82,fd,p.arm2,{front:p.rib,sh:dh*.26}));
 const nrn=hi?L+1:Math.min(2,L);for(let k=0;k<nrn;k++){const y=yb+dh*(.14+.44*(nrn>1?k/(nrn-1):.5));b.loft([C(R+.06,y),C(R+.06,y+.16)],ring,{top:false,smooth:true});}
 // gold crown, the white dome
 b.loft([C(rc+.3,top-.1),C(rc+.36,top+.24),C(rc,top+.32)],p.gold,{top:false,smooth:true});b.dome(0,top+.2,0,rc,Math.min(rc*.8,7.9-top-.2),rc,glow(0xdfeef2,.72),{n,rings:hi?4:2});
 if(hi){around(b,0,0,rc+.32,16,0,q=>cb(q,0,top+.12,0,.26,.26,.2,M.gold));b.halo(0,top+1,0,rc*1.4,0xcfefff,.14);}
 // radiator blocks with fins at the front corners, pipes at the foot
 for(const s of [-1,1]){const x=s*(hw-1.8),z=hd-1.8;ab(b,x,y0+.5,z,1.5,1.9,1.5,p.arm,.1);if(hi){for(let k=0;k<5;k++)cb(b,x,y0+.6,z-.6+k*.3,1.7,1.7,.12,p.rib);b.pipe([[s*1.3,y0+.72,R*.9],[s*1.3,y0+.72,z+.3],[x-s*.7,y0+.72,z+.3]],.18,p.arm2);}}
 // coolant towers at the back corners from level 3
 if(L>=3)for(const s of [-1,1]){const x=s*(hw-1.5),z=-hd+1.5,h=3.1+.45*L;vessel(b,p,x,y0,z,.9,h,p.arm,{hoop:L>=5?p.gold:p.rib,n:hi?10:6,dh:.5});b.loft([{p:circ(.95,hi?10:6,x,z),y:y0+h-.2},{p:circ(.95,hi?10:6,x,z),y:y0+h-.06}],p.acc,{top:false,smooth:true});}
});

// town-shield (2x2): a hex pedestal, a tapered core wound with coil rings (LOW: three flat cyan rings), the glowing orb;
// four pylons with gold caps.
WK.model('town-shield',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,circ}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,n=hi?10:6,H6=(r,y)=>({p:circ(r,6,0,0,r,0),y});apron(b,o,p);
 const R=Math.min(hw,hd)*.8,ch=2.8+.58*L,yb=y0+1.4,top=yb+ch,cr=1.2,cr2=.62;   // the hex pedestal spans 80% of the pad
 b.loft([H6(R,y0),H6(R,y0+.5),H6(R*.78,y0+.9),H6(R*.6,yb)],(r)=>r===1?p.arm2:p.arm,{topMat:p.arm2});b.loft([H6(R+.04,y0+.28),H6(R+.04,y0+.4)],p.accS,{top:false});
 // the core and its coil rings (one more per level), the orb
 b.cyl(0,yb,0,cr,ch,p.arm2,{n,r2:cr2});const nr=3+L;for(let k=0;k<nr;k++){const t=(k+.6)/(nr+.4),r=cr+(cr2-cr)*t+.42;if(hi)b.ring(0,yb+ch*t,0,r,glow(0xa8f8ff,1.1),{thin:nr>6});}
 if(!hi)for(const t of [.2,.5,.8]){const r=cr+(cr2-cr)*t+.5,y=yb+ch*t;for(let i=0;i<8;i++){const a=i/8*TAU,c=(i+1)/8*TAU,P=(an,rr)=>[Math.cos(an)*rr,y,Math.sin(an)*rr];b.quad(P(a,r-.13),P(c,r-.13),P(c,r+.13),P(a,r+.13),pad(b,0x8fe6ff,.62),[0,y-9,0]);}}   // LOW: three flat cyan rings
 b.cyl(0,top,0,.74,.24,L>=5?p.gold:p.arm,{n:hi?8:6});b.ball(0,top+.86,0,.72,glow(0xdff8ff,1.1),!hi);if(hi)b.halo(0,top+.86,0,1.8,0x9fe8ff,.35);
 // four pylons with gold caps and a light slit
 for(let k=0;k<4;k++){const a=k*HP+HP/2,x=Math.cos(a)*R*.72,z=Math.sin(a)*R*.72,h=1.9+ch*.42;b.at(x,0,z,-a+HP,q=>{if(hi)q.loft([{p:b.k.rect(.86,.86,.14),y:y0+.6},{p:b.k.rect(.68,.68,.1),y:y0+h}],p.arm,{top:false});else cb(q,0,y0+.6,0,.76,h-.6,.76,p.arm);cb(q,0,y0+h,0,.88,.34,.88,M.gold);strip(q,0,y0+1.2,.42,.16,h-1.6,p.acc);});}
});

// town-lab (3x3, a vital): a dark ribbed dome on an octagonal drum, a mint green light ring at the dome's foot (#7dffb8),
// the same light in the skylight lantern (taller with the level) and in a line over the dark door, a gold cap and a small
// dish; dark sample tanks with mint rings and caps (#35d07a) beside the porch.
WK.model('town-lab',(b,o)=>{const p=TP(b,o),{L,M}=p,{glow,circ}=b.k,hi=b.hi,hw=o.w/2,hd=o.d/2,y0=.3,n=hi?16:8,mint=pad(b,0x7dffb8,.46,2),mintD=pad(b,0x35d07a,.5,1.5),C8=Math.cos(Math.PI/8);apron(b,o,p,true);
 const R=Math.min(hw,hd)*.78,dhh=2,yd=y0+.3+dhh,rd=R*.9,domeH=2.7;
 b.loft([octR(b,R+.25,y0),octR(b,R+.25,y0+.3),octR(b,R,y0+.3),octR(b,R,yd-.2),octR(b,R-.25,yd)],(r)=>r<2?p.arm2:p.arm,{topMat:p.arm2});
 around(b,0,0,R-.06,8,Math.PI/8,q=>fin(q,0,y0+.3,.7,dhh,.36,p.arm2,{front:p.rib,sh:.5}));
 if(hi)around(b,0,0,R*C8,8,0,(q,i)=>{if(i!==2){strip(q,0,y0+.9,.02,R*.42,.9,p.arm2);for(const s of [-1,1])strip(q,s*R*.12,y0+1.2,.04,R*.14,.3,i%2?mint:p.black);}});
 // the mint ring, the dome and its ribs
 b.loft([{p:circ(rd+.12,n),y:yd-.02},{p:circ(rd+.12,n),y:yd+.2}],mint,{top:false,smooth:true});b.dome(0,yd+.1,0,rd,domeH,rd,p.arm2,{n,rings:hi?4:2,cut:.86});
 if(hi)for(let k=0;k<16;k++){const a=k/16*TAU;let q0=null;for(let i=0;i<=3;i++){const t=i/3*HP*.84,r=(rd+.05)*Math.cos(t),q1=[Math.cos(a)*r,yd+.1+domeH*Math.sin(t)+.03,Math.sin(a)*r];if(q0)b.tube(q0,q1,.1,p.rib,{n:3});q0=q1;}}
 // the skylight lantern (taller with the level), gold cap, dish
 const ly=yd+.1+domeH*Math.sin(HP*.86)-.1,lh=.3+.2*L,lr=rd*Math.cos(HP*.86)+.25;b.cyl(0,ly,0,lr,.2,p.arm,{n:hi?10:6});b.cyl(0,ly+.2,0,lr*.82,lh,mint,{n:hi?10:6,top:false});b.cyl(0,ly+.2+lh,0,lr,.2,M.gold,{n:hi?10:6,r2:lr*.5});
 if(hi){b.halo(0,ly+.4,0,2.2,0x7dffb8,.3);bowlDish(b,p,rd*.55,yd+domeH*.62,-rd*.5,.6);}
 // the entrance: an armoured porch, the dark door under a mint light line
 b.at(0,0,R*C8-.2,0,q=>{ab(q,0,y0,.5,2.8,2.3,1.2,p.arm,.1);strip(q,0,y0+.1,1.11,1.5,1.7,p.black);strip(q,0,y0+1.95,1.11,2,.12,mint);if(hi){cb(q,0,y0+.1,1.11,.1,1.7,.05,p.arm2);strip(q,.5,y0+.9,1.115,.12,.2,mintD);for(const s of [-1,1])fin(q,s*1.2,y0,.3,2.4,.2,p.arm2,{front:p.rib,z:1.1});}});
 // level kit: dark sample tanks beside the porch, a mint ring and a mint cap on each
 for(let k=0;k<Math.min(4,L-1);k++){const s=k%2?1:-1,x=s*(hw-1.2),z=hd-1.3-(k>>1)*1.5;vessel(b,p,x,y0,z,.5,1.5,p.arm2,{hoop:mint,hoops:1,keep:1,n:hi?8:5,cap:mintD});}
});

// ================================================== walls: the cell per ore blend, corner post, rubble =============
// ore looks, index 0 = composite: [body colour, accent colour, accent glow, surface, wear]. The tiers follow the owner's
// wall reference, one material each: concrete (composite), rusted concrete (Ferrite), steel plate (Ilmenite), dark stone
// (Armalcolite), obsidian with gold flecks (Tranquillityite), pale glass (Selenite Glass), ruby (Moonheart).
const ORE=[[0x8a8f92,0x7fe9ff,0,'concrete',.3],[0x8a8f92,0xa0522d,0,'concrete',.85],[0x4a4f58,0x5fa8ff,.55,'metal',.3],[0x1e2638,0x22e6ff,1,'rock',0],[0x15131c,0xc9a227,.6,'rock',0],[0xcfe6f0,0xffffff,1.5,'glass',.2],[0xb3122e,0xe0304a,1.6,'rock',0]];
// town-wall: ONE wall cell, 4.02 x 4.02 m in plan, instanced up to 2,000 times. o.ore 0..6, o.lvl 1..3, o.h = height
// (the merlon tops stand at o.h + 0.22, as the old coping did). A fortification: a sloped plinth (the bottom 20%), the body
// in the tier's material, a thin lit strip under the deck in the tier's light (cyan on concrete, rust-amber on rusted
// concrete, gold on obsidian, white on glass, red on ruby), a walkway 25% darker than before between four corner merlons
// (30% of the width, 15% of the height) whose tops carry a lighter rim, so stacked rings do not read as paving from above.
// What a face carries (HIGH) says the material: concrete a recessed bay; rusted concrete the bay, rust straps (one per
// blend level), rust streaks under the deck and bolt heads; steel its plate seams and blue bars; dark stone its block
// joints, a cyan seam and cyan bars; obsidian a faceted panel and gold flecks (more with the level) under a gold needle
// crest; glass a pane with white edge highlights; ruby an emissive core. The section is the same on all four sides and
// every part that overhangs the cell does so by the same amount, so cells tile along x and z: a row reads as one
// crenellated wall, its merlons 1.2 m wide with 0.6 m (across a joint) and 1.0 m (mid-cell) crenels between them.
WK.model('town-wall',(b,o)=>{const {mat,glow,tint,rect,hash}=b.k,hi=b.hi,ore=Math.max(0,Math.min(6,o.ore|0)),lvl=Math.max(1,Math.min(3,(o.lvl|0)||1)),h=o.h||4,W=4.02,[bc,ac,g,sf,wr]=ORE[ore],R=(w,y)=>({p:rect(w,w),y});
 // the tier's light: a part glow that keeps its colour on screen (cyan, rust-amber, gold), or the accent glow
 const lit=(k,kg)=>ore===0?pad(b,ac,k):ore===1?pad(b,0xe0935a,k*.9,1.5):ore===4?pad(b,ac,k*1.1,1.5):glow(ac,Math.min(2,kg));
 const body=tint(mat(bc,sf,wr,0),ore===5?.84:.9),foot=tint(body,.8),acc=ore===1?tint(mat(ac,'concrete',.9,0),.8):lit(.45,g*(.55+.25*lvl)),cap=o.mini?lit(.16,Math.max(.14,g*.18)):lit(.45,Math.max(.55,g*.8)),
  cope=tint(body,.58),mer=tint(body,1.14,.006),rimM=ore===5?tint(body,1.22):tint(body,1.55,.02),yt=h+.22,mh=h*.15,yd=yt-mh,ys=yd-h*.05,yp=h*.2,mw=W*.3,mc=W/2-mw/2-.3,z=W/2,
  deck=(w,y,m)=>b.quad([-w/2,y,-w/2],[w/2,y,-w/2],[w/2,y,w/2],[-w/2,y,w/2],m,[0,y-1,0]),F=(fn)=>{for(let k=0;k<4;k++)b.at(0,0,0,k*HP,fn);},
  merlon=(x,zz)=>{band(b,x,yd,zz,mw,mh,mw,mer);strip0(b,x,yt,zz,mw,mw,rimM);if(hi)strip0(b,x,yt+.012,zz,mw-.3,mw-.3,mer);};   // a merlon: its top is the lighter rim (HIGH: round a darker inset)
 if(!hi){   // LOW: the plinth, the body, the lit strip, the deck and two merlons on a diagonal (so two show on every side)
  b.loft(o.mini?[R(W+.3,0),R(W,ys),R(W,yd)]:[R(W+.34,0),R(W,yp),R(W,ys),R(W,yd)],(r)=>r===(o.mini?1:2)?cap:r||o.mini?body:foot,{top:false});deck(W,yd,cope);
  for(const s of [-1,1])merlon(s*mc,-s*mc);return;}
 b.loft([R(W+.34,0),R(W,yp),R(W,ys),R(W,yd)],(r)=>r===2?cap:r?body:foot,{top:false});deck(W,yd,cope);
 for(const sx of [-1,1])for(const sz of [-1,1])merlon(sx*mc,sz*mc);
 const pw=W*.6,py=h*.3,ph=h*.4,zp=z+.02,zq=z+.04,line=ore===3?tint(body,3,.02):tint(body,.45),yb=ys-yp;
 F(q=>{const bar=w=>{for(let k=0;k<lvl;k++)strip(q,0,py+ph*(.5+.22*(k-(lvl-1)/2))-ph*.04,zq,w,ph*.08,acc);};   // the bars, one per blend level
  if(ore<2){strip(q,0,py,zp,pw,ph,tint(body,.55));                                                             // concrete: a recessed bay between the cell's two piers
   if(!ore){strip(q,0,py,zq,pw,h*.028,tint(body,1.3,.01));return;}                                             // composite: its pale sill
   bar(pw*.74);for(const [x,l,w] of [[-W*.37,.36,.13],[W*.33,.24,.1]])q.quad([x-w,ys,zq],[x+w,ys,zq],[x+w*.4,ys-h*l,zq],[x-w*.3,ys-h*l,zq],acc,[x,ys,0]);   // Ferrite: rust straps, rust streaks down the piers
   for(const s of [-1,1])strip(q,s*(pw/2+.2),py+.1,zq+.006,.17,.17,mat(0x3a3f47,'metal',.4,0));}                                                            // and a bolt head each side
  else if(ore===2){const ym=yp+yb*.68;strip(q,0,ym-.03,zp,W-.1,.06,line);strip(q,0,ym,zp,.06,ys-ym,line);for(const s of [-1,1])strip(q,s*W*.26,yp,zp,.06,ym-yp-.03,line);bar(pw*.56);}   // Ilmenite: steel plates, their seams
  else if(ore===3){for(const t of [.36,.7])strip(q,0,yp+yb*t-.025,zp,W-.1,.05,line);strip(q,W*.2,yp,zp,.05,yb*.36-.025,line);strip(q,-W*.14,yp+yb*.7+.025,zp,.05,yb*.3-.025,line);   // Armalcolite: dark stone blocks, pale joints
   bar(pw*.5);strip(q,-(pw/2+(W-pw)/4),yp+.08,zq,.1,yb-.16,glow(ac,.9));}                                                                                                             // and the cyan seam down one pier
  else if(ore===4){const c=ph*.3,fc=tint(body,1.9,.01);for(const t of [0,1])q.quad([-pw/2+c,py+ph*t,zp],[pw/2-c,py+ph*t,zp],[pw/2,py+ph/2,zp],[-pw/2,py+ph/2,zp],t?fc:tint(fc,.7),[0,py,0]);   // Tranquillityite: obsidian, a faceted panel
   for(let k=0;k<2+lvl;k++){const x=(hash(k*7+3)-.5)*W*.84,y=yp+.2+(yb-.5)*hash(k*13+5),s=.13+.1*hash(k*5+1);q.quad([x-s,y,zq],[x+s*.3,y-s*.6,zq],[x+s,y+s*.2,zq],[x-s*.2,y+s*.7,zq],acc,[x,y,0]);}}   // gold flecks, one more per blend level
  else if(ore===5){strip(q,0,py,zp,pw,ph,tint(body,.72));strip(q,0,py+ph-.05,zq,pw,.05,acc);strip(q,-pw/2,py,zq,.05,ph,acc);strip(q,-W/2+.06,yp,zp,.06,yb,acc);bar(pw*.5);}   // Selenite Glass: a pane, white edge highlights
  else{strip(q,0,py,zp,pw,ph,glow(ac,.2+.07*lvl));strip(q,0,py+ph*.2,zq,pw*.42,ph*.6,glow(0xff5a6e,.7+.2*lvl));}});                                              // Moonheart: ruby, the emissive core in every face
 if(ore===4){const n=lvl,P=[[0,0],[1.05,0],[-1.05,0]];for(let k=0;k<n;k++)b.at(P[k][0],yd,P[k][1],k*1.3,q=>q.loft([{p:b.k.circ(.13,3),y:0},{p:b.k.circ(.015,3),y:.5+.14*lvl+.1*(k%2)}],pad(b,ac,.7,1.5),{top:false}),.14+.05*(k%2));}   // Tranquillityite: the gold needle crest
 else if(ore===5){const w=glow(0xffffff,1.9);b.quad([-W*.42,yd+.03,-.12],[W*.42,yd+.03,-.12],[W*.42,yd+.03,.12],[-W*.42,yd+.03,.12],w,[0,-1,0]);}   // Selenite Glass: the glint line
 else if(ore===6)deck(.92,yd+.03,glow(ac,1.7));                                                                                                       // Moonheart: the deep-glow core slab
});
// town-post: the corner post (1.9 x 5.5 x 1.9) that stands on a wall cell: a taller armoured pier; its top light is a cyan
// slit under a chamfered cap (LOW: a lit block).
WK.model('town-post',(b,o)=>{const {mat,glow,rect,pal}=b.k,M=pal.mil,hi=b.hi,d=mat(0x434d5a,'metal',.25,0),d2=mat(0x52606e,'metal',.25,0),R=(w,y)=>({p:rect(w,w),y}),cy=glow(0x7fe9ff,1.5);
 if(!hi){b.loft([R(1.8,0),R(1.45,4.7)],d,{top:false});b.loft([R(1.76,4.7),R(1.76,5.14)],M.gold,{top:false});b.quad([-.88,5.14,-.88],[.88,5.14,-.88],[.88,5.14,.88],[-.88,5.14,.88],d2,[0,0,0]);cb(b,0,5.14,0,.5,.32,.5,cy);return;}
 b.loft([R(1.9,0),R(1.9,.55),R(1.5,.8),R(1.42,4.66),R(1.78,4.86),R(1.78,5.14),R(1.3,5.2)],(r)=>r===0||r>=3?d2:d);cb(b,0,5.2,0,.9,.1,.9,M.gold);b.loft([R(.5,5.3),R(.5,5.4)],cy,{top:false});b.loft([R(.74,5.4),R(.74,5.45),R(.4,5.56)],d,{topMat:d2,bot:true});for(let k=0;k<4;k++)b.at(0,0,0,k*HP,q=>strip(q,0,2.2,.74,.8,1.5,M.plate2));
 for(let k=0;k<4;k++)b.at(0,0,0,k*HP,q=>{strip(q,0,1.1,.75,.1,3.3,glow(0x22e6ff,.7));q.quad([-.3,4.9,.9],[.3,4.9,.9],[.3,5.08,.9],[-.3,5.08,.9],M.gold,[0,5,0]);});
});
// town-rubble: a ruined wall cell (4 x 1.4 x 4): no tidy base, a scorched patch with a broken edge, the snapped pillar stub
// of the wall with two bent rebar rods, and tilted broken slabs of mixed size lying against it and each other, their
// undersides scorch-dark.
WK.model('town-rubble',(b,o)=>{const {mat,tint,hash}=b.k,hi=b.hi,d=mat(0x4a5565,'metal',.5,.08),d2=mat(0x56616e,'concrete',.6,.08),sc=mat(0x141a26,'concrete',.3,0),ru=tint(mat(0x7a4a2c,'scrap',.9,.1),.8);
 // the scorched ground: a jagged patch, a low broken foot on HIGH
 const J=(r,k)=>Array.from({length:9},(_,i)=>{const a=i/9*TAU+.2,rr=r*(.72+.3*hash(i*5+k));return [Math.cos(a)*rr,Math.sin(a)*rr];});
 b.cap(J(1.9,3),.03,sc,true);if(hi)b.loft([{p:J(1.5,3),y:.03},{p:J(1.22,3),y:.15}],tint(d2,.55),{topMat:tint(d2,.7)});
 // a broken slab: a plate with one corner snapped off (k picks the corner), lying tilted; its underside is scorched
 const slab=(x,y,z,w,dp,t,ry,rx,rz,m,k)=>b.part().at(x,y,z,ry,q=>{const sx=k&1?-1:1,sz=k&2?-1:1,P=hi?[[-w/2,-dp/2],[w/2,-dp/2],[w/2,dp*.08],[w*.12,dp/2],[-w/2,dp/2]].map(v=>[v[0]*sx,v[1]*sz]):[[-w/2,-dp/2],[w/2,-dp/2],[w*.3*sx,dp/2*sz],[-w/2*sx,dp/2*sz]].map((v,i)=>i<2?[v[0]*sx,v[1]*sz]:v);
   q.loft([{p:P,y:-t/2},{p:P,y:t/2}],(r,i)=>i<0?sc:tint(m,.8),{topMat:m,bot:true});},rx,rz);
 // the snapped pillar stub (a jagged top), its fallen head lying beside it
 {const x0=-1.62,x1=-.72,z0=-1.2,z1=-.3,H=[1.22,.88,.62,1.05],P=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],c=[(x0+x1)/2,.3,(z0+z1)/2];
  for(let i=0;i<4;i++){const j=(i+1)%4;b.quad([P[i][0],0,P[i][1]],[P[j][0],0,P[j][1]],[P[j][0],H[j],P[j][1]],[P[i][0],H[i],P[i][1]],i%2?d2:d,c);}
  b.quad([P[0][0],H[0],P[0][1]],[P[1][0],H[1],P[1][1]],[P[2][0],H[2],P[2][1]],[P[3][0],H[3],P[3][1]],sc,[c[0],-2,c[2]]);
  // two bent rebar rods out of the break
  b.tube([-1.45,1,-1],[-1.3,1.34,-.8],.06,ru,{n:3});b.tube([-1.3,1.34,-.8],[-.8,1.16,-.6],.06,ru,{n:3});
  if(hi){b.tube([-1.0,.7,-.5],[-.9,1.2,-.25],.06,ru,{n:3});b.tube([-.9,1.2,-.25],[-.42,.95,.05],.06,ru,{n:3});}}
 slab(.25,.56,-.75,2.3,1.5,.24,.12,.06,-.42,d,0);                    // the big one, propped on the stub
 slab(.88,.16,1.05,1.7,1.25,.22,.5,.1,.05,d2,1);                    // flat, front right
 slab(-.95,.3,1.1,1.25,.9,.2,-.5,-.36,.1,d,2);                      // tipped up, front left
 if(hi){slab(1.3,.5,-.95,1.15,1,.2,-.3,-.1,.62,d2,3);               // leaning on the big one, back right
  slab(.75,.42,.72,.85,.62,.16,1.2,.3,-.12,tint(d,1.15),1);         // a small one on the flat one
  slab(-1.6,.4,.35,.8,.62,.16,.2,.1,-1.0,d2,0);                   // on edge against the stub
  b.part().at(-.3,.36,.5,.8,q=>cb(q,0,-.2,0,.85,.4,.5,d),.3,.5);   // the pillar's fallen head
  for(let k=0;k<3;k++){const a=k*2.3+.9,r=1.5+.25*hash(k*7+2);b.part().gem(Math.cos(a)*r,.14,Math.sin(a)*r,.24,.16,.2,k%2?d2:tint(d,.8),a);}}
});

// ================================================== decorations (small set pieces at the origin) ====================
const decoP=(b,o)=>{const {mat,glow,tint,pal}=b.k,M=pal.mil,arm=mat(0x343a43,'metal',.3,.04),ah=o.accent!=null?o.accent:0x22e6ff;return {M,arm,arm2:tint(arm,.7),rib:tint(arm,1.32,.012),ah,acc:glow(ah,1),gold:M.gold,gm:mat(0x232b38,'metal',.25,.03),gm2:mat(0x2b3442,'metal',.3,.03)};};
// decor-lamps: a 3.3 m town lamp: an octagonal tapered gunmetal post on a base collar, one gold band, and a hooded lamp
// head (a lit lantern drum under a chamfered hood whose underside glows); o.accent = light colour. LOW: a plain tapered
// post, the lit drum and the hood.
WK.model('decor-lamps',(b,o)=>{const p=decoP(b,o),hi=b.hi,n=hi?8:5,lit=pad(b,p.ah,.62),C=(r,y)=>({p:b.k.circ(r,n,0,0,r,Math.PI/n),y});
 if(hi){b.loft([C(.27,0),C(.27,.1),C(.15,.22),C(.075,2.8)],(k)=>k<2?p.gm2:p.gm,{top:false});b.loft([C(.115,1.1),C(.11,1.24)],p.gold,{top:false});b.loft([C(.075,2.8),C(.13,2.86)],p.gm2,{top:false});}
 else b.loft([C(.2,0),C(.08,2.86)],p.gm,{top:false});
 b.loft([C(.13,2.86),C(.13,3.04)],lit,{top:false});
 // the hood: its glowing underside, the chamfered shell, a gold finial
 if(hi)b.cap(C(.27,0).p,3.04,b.k.glow(p.ah,1.5),false);
 b.loft(hi?[C(.28,3.04),C(.28,3.1),C(.1,3.27)]:[C(.28,3.04),C(.1,3.27)],p.gm2,{topMat:hi?p.gold:p.gm2,bot:!hi});b.halo(0,2.95,0,.8,p.ah,.4);b.pool(0,.05,0,1.6,1.6,p.ah,.14);
});
// decor-crates: three armoured supply crates (two on LOW)
WK.model('decor-crates',(b,o)=>{const p=decoP(b,o),{M}=p,hi=b.hi,crate=(x,y,z,w,h,d,m,ry,lid)=>b.at(x,y,z,ry,q=>{cb(q,0,0,0,w,h,d,m);if(hi){band(q,0,h*.68,0,w+.05,h*.12,d+.05,lid);for(const s of [-1,1])band(q,s*w*.3,0,0,.1,h+.02,d+.06,p.arm2);strip(q,0,h*.3,d/2+.02,w*.22,h*.1,p.acc);}});
 crate(-.44,0,-.14,.84,.78,.8,p.arm,.1,p.gold);crate(.47,0,hi?-.2:.24,.76,.58,.74,M.plate2,-.16,p.rib);if(!hi){band(b,-.44,.52,-.14,.9,.12,.86,p.gold);strip(b,.47,.2,.62,.3,.12,p.acc);}if(hi)crate(.12,0,.4,.5,.4,.4,M.hazard,.3,M.hazardD);
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
 const lobe=(x,y,z,rx,ry,m)=>{const C=b.k.circ,n=hi?7:5;b.part().loft([{p:C(rx*.55,n,x,z),y:y-ry*.5},{p:C(rx,n,x,z),y:y-ry*.1},{p:C(rx*.78,n,x,z),y:y+ry*.45},{p:C(rx*.2,n,x,z),y:y+ry*.8}],(r)=>r===0?b.k.tint(m,.55):r===1?m:b.k.tint(m,1.3,.02),{smooth:false});};
 lobe(-.36,.98,.02,.52,.62,S.leaf);lobe(.4,.84,-.04,.42,.5,S.leafD);if(hi){lobe(-.1,1.26,-.12,.34,.46,S.leaf);lobe(.5,1.12,.12,.24,.34,S.leaf);cb(b,.1,.52,.3,.12,.24,.12,b.k.glow(0xffe08a,.5));}
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
WK.model('sandbags',(b,o)=>{const {pal,tint,rect,hash}=b.k,Wk=pal.wreck,hi=b.hi,w=o.w||4,n=Math.max(2,Math.round(w/(hi?.95:1.34))),bl=w/n,sd=o.seed|0,seam=tint(Wk.bag,.5);
 // a bag: a pillow that sags over what is under it (wider in the middle, a pinched dark seam at both ends)
 const bag=(x,y,z,l,d,k)=>{const m=k%3===1?tint(Wk.bag,.84):k%3===2?tint(Wk.bag,1.12,.01):Wk.bag,ry=(hash(sd*5+k)-.5)*.2;b.part().at(x,y,z,ry,q=>{
   if(hi){q.loft([{p:rect(l-.2,d-.16),y:0},{p:rect(l+.02,d+.04),y:.14},{p:rect(l-.06,d-.04),y:.27},{p:rect(l-.36,d-.3),y:.36}],(r)=>r===0?tint(m,.7):r===2?tint(m,1.1,.01):m,{topMat:tint(m,1.14,.01)});for(const sx of [-1,1])q.quad([sx*(l/2-.02),.06,-d/2+.1],[sx*(l/2-.02),.06,d/2-.1],[sx*(l/2-.02),.26,d/2-.14],[sx*(l/2-.02),.26,-d/2+.14],seam,[0,.15,0]);}
   else q.loft([{p:rect(l-.1,d-.08),y:0},{p:rect(l,d),y:.14},{p:rect(l-.24,d-.2),y:.34}],(r)=>r?tint(m,1.08):tint(m,.75),{topMat:tint(m,1.12)});});};
 for(let k=0;k<n;k++)bag(-w/2+bl*(k+.5),0,.06,bl-.05,.7,k);for(let k=0;k<n-1;k++)bag(-w/2+bl*(k+1),.3,-.02,bl-.05,.64,k+7);
 bag(-w/2+bl*1.5,.6,-.06,bl-.1,.58,sd+3);if(hi)tuft(b,-w*.3,0,.5,.9,Wk.moss,sd);
});
// barbed-wire (o.w along x): one span: a leaning steel picket with a rust cap at x = -w/2, three pale strands to x = +w/2
// and a concertina coil of three loops along its foot (two on LOW). Pale steel on purpose: black wire on a navy post
// vanished on the barren Moon (critic round 3).
WK.model('barbed-wire',(b,o)=>{const {pal,mat}=b.k,hi=b.hi,w=o.w||3,x0=-w/2,x1=w/2,lean=.16,post=mat(0x5d6878,'metal',.5),cap=mat(0x7a3b22,'scrap',.9),wire=mat(0x9aa6b6,'metal',.3),coil=mat(0xb4bec9,'metal',.2);
 b.tube([x0-.02,0,.02],[x0+lean,1.46,-.04],.1,post,{n:hi?5:3});b.tube([x0+lean*.93,1.36,-.036],[x0+lean*1.02,1.5,-.042],.13,cap,{n:hi?5:3,caps:true});if(hi)b.tube([x0+.5,0,.3],[x0+lean*.7,1,-.02],.05,post,{n:3});
 for(const y of [.45,.85,1.25]){const xa=x0+lean*y/1.42;b.tube([xa,y,0],[x1+lean*y/1.42,y,0],hi?.03:.04,wire,{n:3});}
 // the concertina: round loops (eight steps a loop on HIGH), leaning along the span
 const loops=hi?3:2,per=hi?8:5,n=loops*per;let p0=null;for(let i=0;i<=n;i++){const t=i/n,a=t*TAU*loops,q=[x0+.35+(w-.7)*t,.5+Math.sin(a)*.44,.3+Math.cos(a)*.44];if(p0)b.tube(p0,q,hi?.032:.045,coil,{n:3});p0=q;}
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
 if(hi)b.truss(0,.45,tz,w0,w1,th-.45,rA,{step:3.6,r:.14});else{const leg=(t,sx,sz)=>{const w=(w0+(w1-w0)*t)/2;return [sx*w,.45+(th-.45)*t,tz+sz*w];},C=[[-1,-1],[1,-1],[1,1],[-1,1]];for(const c of C)b.tube(leg(0,c[0],c[1]),leg(1,c[0],c[1]),.09,rA,{n:3});for(const t of [.4,.8])for(let i=0;i<4;i++)b.tube(leg(t,C[i][0],C[i][1]),leg(t,C[(i+1)%4][0],C[(i+1)%4][1]),.06,rA,{n:3});}
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
