/* Town kit (Session 5C, docs/conquest/SESSION_05C_BASE_UX_FULL_PROMPT.md): one shared kit for every place the pilot's town is
   drawn. The Home Sector (the town as the live world around the tank) and build mode are the same scene; the world pad shows
   a diorama of the same town; the hub hero, the HUD thumbnail, the share card and the build cards reuse it too.
   - kit(S): the models (buildings by level, the eleven turret heads, wall blends with the fortification look, wall posts,
     rubble, settler homes, crew, rovers, raiders, banner, decorations), built with the Neon Frontline style programs.
   - lite(T): the same primitives and colours without a style instance (hub hero, node tests).
   - plan(P,p): what gets instanced (walls by blend, turrets by type and level, homes by kind, posts, rubble).
   - Scene: the instanced town (one draw per wall look, two per turret type and level, one per home kind, posts, rubble).
   - terrain(): the site template with the plaza, dust roads, lane chevrons and the thin cyan town edge.
   - layer2d(): one pixel per cell (2D fallback, HUD thumbnail). diorama(): a merged model of the town at a small scale.
   - sprites: build-card pictures rendered once per session with the same renderer and programs (no new shader variants).
   Presentation only. Every change to a town is a Worker action validated by js/conquest/plot.js. */
(function(root){
'use strict';
const PL=()=>root.ConquestPlot;
// wall look per ore (index 0 = composite): body colour, accent colour, accent glow
const ORE_LOOK=[[0x8a8676,0x8fb4d0,.45],[0x7a4a2c,0xd8b48a,.5],[0x23262c,0x5fa8ff,.75],[0x55657e,0x22e6ff,1],[0x3a2420,0xff7a3d,1.1],[0xbab2e8,0xf6f0ff,1.5],[0x10141f,0x9fe8ff,2.2]];
const GLYPH={cc:'◆',refinery:'⚙',storage:'▦',reactor:'⚡',foundry:'▤',biodome:'✿',hangar:'⌂',helium:'⛽',radar:'◎',shield:'⛨',lab:'⚗',uplink:'⇡',trophy:'♛',cannon:'●',mg:'⁞',laser:'✦',rocket:'⁂',missile:'➹',mortar:'◉',flame:'♨',siege:'■',tesla:'ϟ',lasercannon:'✷',railgun:'═',gate:'▯'};
const hashf=(a,b,c=0)=>{let h=2166136261^c;h=Math.imul(h^a,16777619);h=Math.imul(h^b,16777619);h^=h>>>13;h=Math.imul(h,1274126177);return ((h^h>>>16)>>>0)/4294967296;};

// ------------------------------------------------------------------- lite: the primitives without a style instance -------
function lite(T){const K={};for(const [k,h] of Object.entries({dark:0x222932,dark2:0x2e3844,mid:0x4a5664,panelA:0x9ba8b4,panelB:0xc2ccd5,roof:0x76838f,cyan:0x22e6ff,ice:0xa8f8ff,teal:0x2dffc4,amber:0xffb347,gold:0xffd36b,red:0xff3048,navy:0x0d1729,violet:0xa07bff,chitin:0x2b1531,chitinD:0x150a19,wall:0x2c2833,wallTop:0x4a4352,mag:0xff2bd6,magHot:0xff7ae8}))K[k]=new T.Color(h);
 const flat=g=>{const n=g.index?g.toNonIndexed():g;n.computeVertexNormals();return n;};
 const G={box:new T.BoxGeometry(1,1,1),hex:flat(new T.CylinderGeometry(1,1,1,6,1,false,Math.PI/6)).translate(0,.5,0),oct:flat(new T.CylinderGeometry(1,1,1,8,1,false,Math.PI/8)).translate(0,.5,0),
  cyl:new T.CylinderGeometry(1,1,1,12,1).translate(0,.5,0),cylC:new T.CylinderGeometry(1,1,1,8,1),cone5:flat(new T.ConeGeometry(1,1,5)).translate(0,.5,0),cone6:flat(new T.ConeGeometry(1,1,6)).translate(0,.5,0),
  torus:new T.TorusGeometry(1,.065,4,24),ico:new T.IcosahedronGeometry(1,1),octa:new T.OctahedronGeometry(1,0),dome:new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2),rock:new T.IcosahedronGeometry(1,0)};
 G.blob1=G.ico;G.hexF=()=>G.hex;G.octF=()=>G.oct;G.cylF=()=>G.cyl;
 const _v=new T.Vector3(),_w=new T.Vector3(),_nm=new T.Matrix4(),_q=new T.Quaternion(),_p=new T.Vector3(),_s=new T.Vector3();
 class Bld{constructor(){this.P=[];this.N=[];this.A=[];this.I=[];this.n=0;}
  add(geo,m,c,em=0){const P=geo.attributes.position,N=geo.attributes.normal,ix=geo.index;_nm.copy(m).invert().transpose();
   for(let i=0;i<P.count;i++){_v.fromBufferAttribute(P,i).applyMatrix4(m);this.P.push(_v.x,_v.y,_v.z);_w.fromBufferAttribute(N,i).transformDirection(_nm);this.N.push(_w.x,_w.y,_w.z);this.A.push(c.r,c.g,c.b,em);}
   if(ix)for(let k=0;k<ix.count;k++)this.I.push(ix.getX(k)+this.n);else for(let k=0;k<P.count;k++)this.I.push(this.n+k);this.n+=P.count;return this;}
  box(x,y,z,w,h,d,c,em=0,ry=0){const m=new T.Matrix4().compose(_p.set(x,y,z),_q.setFromAxisAngle(_s.set(0,1,0),ry),_s.set(w,h,d));return this.add(G.box,m,c,em);}
  seg(a,b,t,c,em=0){const d=_w.subVectors(b,a),len=d.length()||1e-3;_q.setFromUnitVectors(_p.set(0,1,0),d.clone().multiplyScalar(1/len));return this.add(G.box,new T.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),_q,_s.set(t,len,t)),c,em);}
  quad(a,b,c,d,col,em=0){const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];let nx=e2[1]*e1[2]-e2[2]*e1[1],ny=e2[2]*e1[0]-e2[0]*e1[2],nz=e2[0]*e1[1]-e2[1]*e1[0];const l=Math.hypot(nx,ny,nz)||1;if(ny<0){nx=-nx;ny=-ny;nz=-nz;}
   for(const p of [a,b,c,d]){this.P.push(p[0],p[1],p[2]);this.N.push(nx/l,ny/l,nz/l);this.A.push(col.r,col.g,col.b,em);}this.I.push(this.n,this.n+1,this.n+2,this.n,this.n+2,this.n+3);this.n+=4;return this;}
  geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.P,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.N,3));g.setAttribute('aCol',new T.Float32BufferAttribute(this.A,4));g.setIndex(this.I);g.computeBoundingSphere();return g;}
  mesh(mat){return new T.Mesh(this.geometry(),mat||litMaterial(T));}}
 return {T,K,G,Bld,lite:true,low:true,MAT:null};}
// Lite geometry on an ordinary lit material: aCol becomes the vertex colour (emissive parts brighter), one program.
let _litMat=null;
function litMaterial(T){if(!_litMat||_litMat.__T!==T){_litMat=new T.MeshPhongMaterial({vertexColors:true,shininess:22});_litMat.__T=T;}return _litMat;}
function phong(T,geo){const a=geo.attributes.aCol;if(!a)return geo;const c=new Float32Array(a.count*3);for(let i=0;i<a.count;i++){const e=Math.min(1.5,a.getW(i));const k=1+e*1.6;c[i*3]=a.getX(i)*k;c[i*3+1]=a.getY(i)*k;c[i*3+2]=a.getZ(i)*k;}geo.setAttribute('color',new T.BufferAttribute(c,3));return geo;}

// ------------------------------------------------------------------- models ---------------------------------------------
function kit(S){const T=S.T,K=S.K,G=S.G,lin=h=>new T.Color(h),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3(),P=PL();
 const M=(x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>{_e.set(rx,ry,rz);_q.setFromEuler(_e);return new T.Matrix4().compose(_p.set(x,y,z),_q,_s.set(sx,sy,sz));};
 const C={rust:lin(0x7a4a2c),sand:lin(0x8f7c62),moss:lin(0x3f5a2a),plant:lin(0x3fae4a),glass:lin(0x9fd8ff),furnace:lin(0xff8a3d),steel:lin(0x6d7884),timber:lin(0x6a4a2e),timberD:lin(0x4a3220),comp:lin(0x8a8676),warm:lin(0xffc47a),
  paint:[lin(0xb8553a),lin(0x5a7a8a),lin(0xc9a04a),lin(0x6a8a4a),lin(0x8a5a7a),lin(0xd8c8a0)],gold:K.gold,cyan:K.cyan,amber:K.amber,dark:K.dark,dark2:K.dark2,mid:K.mid,panel:K.panelA,panelB:K.panelB,roof:K.roof,violet:K.violet,red:K.red,teal:K.teal,ice:K.ice,mag:K.mag};
 const LIGHT={cyan:K.cyan,amber:K.amber,violet:K.violet,green:K.teal,red:K.red};let themeLight=null;
 const accent=l=>l>=5?C.gold:themeLight||(l>=3?C.teal:C.cyan);
 // A building at the local origin, footprint centred, facing +z; every level visibly changes it.
 function building(type,l,theme){themeLight=theme?.light?LIGHT[theme.light]||null:null;const b=new S.Bld(),fin=theme?.finish==='sand'?C.sand:theme?.finish==='graphite'?C.dark:C.steel,s=P.sizeOf(type),W=s.w*P.GRID.cell,D=s.d*P.GRID.cell,L=Math.max(1,l),a=accent(L),hw=W/2,hd=D/2;
  const pad=()=>{b.box(0,.15,0,W-.4,.3,D-.4,C.dark2);b.box(0,.32,hd-.35,W-.8,.05,.08,a,.7);};
  const vital=()=>{if(P.VITALS[type])for(const sx of [-1,1])b.box(sx*(hw-.5),.36,-hd+.5,.6,.08,.6,C.gold,1.3);};   // gold corner marks: a vital
  switch(type){
   case 'cc':{pad();let y=.3;const tiers=Math.min(10,L);for(let k=0;k<tiers;k++){const r=6.6-k*.48,h=1.5+(k%2)*.5;b.add(G.oct,M(0,y,0,0,k*.2,0,r,h,r),k%2?C.mid:fin);b.add(G.torus,M(0,y+h,0,Math.PI/2,0,0,r*.98,r*.98,r*.98),a,.8);y+=h;}
    b.add(G.cyl,M(0,y,0,0,0,0,.25,6+L*.4,.25),C.panel);b.box(0,y+6.2+L*.4,0,.7,.7,.7,L>=9?C.gold:C.ice,1.6);if(L>=5)for(const sx of [-1,1])for(const sz of [-1,1]){b.box(sx*5.6,2.2,sz*5.6,1.6,4.4+L*.25,1.6,C.dark);b.box(sx*5.6,4.5+L*.25,sz*5.6,1.8,.2,1.8,a,1);}
    if(L>=9){b.add(G.torus,M(0,y+2,0,Math.PI/2,0,0,4.2,4.2,4.2),C.gold,1.2);}for(const sx of [-1,1])for(const sz of [-1,1])b.box(sx*7.4,.4,sz*7.4,.8,.1,.8,C.gold,1.5);break;}
   case 'refinery':{pad();b.box(-hw*.35,2.2,-hd*.2,W*.5,4.4,D*.55,fin);b.box(-hw*.35,4.5,-hd*.2,W*.52,.25,D*.57,C.roof);
    b.add(G.cyl,M(hw*.42,0,-hd*.35,0,0,0,1.5,6+L*.8,1.5),C.mid);b.add(G.cyl,M(hw*.42,5.8+L*.8,-hd*.35,0,0,0,1.65,.3,1.65),a,1);b.add(G.cyl,M(hw*.42,2,-hd*.35,0,0,0,1.55,.6,1.55),C.furnace,1.5);
    b.box(hw*.12,1.1,hd*.25,1,.25,D*.5,C.dark);b.box(hw*.12,1.25,hd*.25,.8,.06,D*.5,C.amber,.6);b.box(-hw*.2,1.6,hd*.62,2.2,2.2,1.6,C.rust);
    if(L>=2)b.add(G.cyl,M(-hw*.75,0,hd*.45,0,0,0,.6,4+L,.6),C.dark);if(L>=3)b.add(G.cyl,M(hw*.42,0,hd*.1,0,0,0,1.1,4+L*.6,1.1),C.mid);if(L>=4)b.box(-hw*.35,5,-hd*.2,W*.3,1.2,D*.3,C.panel);if(L>=5)b.add(G.cyl,M(hw*.42,0,hd*.42,0,0,0,.9,8,.9),C.gold,.3);break;}
   case 'storage':{pad();vital();for(let k=0;k<Math.min(5,L)+1;k++){const x=-hw+1.8+(k%3)*3.6,z=-hd+2+Math.floor(k/3)*4.5;b.add(G.cyl,M(x,.3,z,0,0,0,1.4,2.6+L*.4,1.4),k%2?fin:C.mid);b.add(G.torus,M(x,2.95+L*.4,z,Math.PI/2,0,0,1.42,1.42,1.42),a,.7);}
    for(let k=0;k<3+L;k++)b.box(-hw+1+(k%4)*1.6,.7+Math.floor(k/4)*.9,hd-1.4,1.3,.85,1.3,k%2?C.rust:C.sand);break;}
   case 'reactor':{pad();vital();b.add(G.cyl,M(0,.3,0,0,0,0,3.6,3+L*.6,3.6),C.dark);const top=3.3+L*.6;for(let k=0;k<L+1;k++)b.add(G.torus,M(0,1+k*(top-1)/(L+1),0,Math.PI/2,0,0,3.75,3.75,3.75),C.cyan,1.1);b.add(G.ico,M(0,top+.8,0,0,0,0,1.3,1.3,1.3),C.ice,2);
    if(L>=3)for(const sx of [-1,1])b.add(G.cyl,M(sx*(hw-1.4),.3,-hd+1.4,0,0,0,1,4+L*.5,1),fin);break;}
   case 'foundry':{pad();b.box(0,2,-hd*.15,W-1.6,4,D*.6,fin);b.box(0,4.1,-hd*.15,W-1.4,.25,D*.62,C.roof);b.add(G.cyl,M(-hw*.45,0,-hd*.4,0,0,0,.7,6+L,.7),C.dark);b.add(G.cyl,M(-hw*.45,5.6+L,-hd*.4,0,0,0,.8,.25,.8),C.furnace,1.4);
    b.add(G.cyl,M(hw*.3,.3,hd*.25,0,0,0,1.2,1.6,1.2),C.rust);b.add(G.cyl,M(hw*.3,1.9,hd*.25,0,0,0,1.25,.15,1.25),C.furnace,1.8);   // the crucible
    for(let k=0;k<2+L;k++)b.box(-hw+1.2+(k%3)*1.3,.55+Math.floor(k/3)*.75,hd-1.1,1.1,.7,1.1,C.comp);b.box(0,2.2,hd*.15+.05,W-3,1.2,.1,C.amber,1);break;}
   case 'biodome':{pad();b.add(G.hex,M(0,.3,0,0,0,0,hw-.4,.8,hd-.4),C.dark2);const R=Math.min(hw,hd)-.8,h=2.4+L*.7;for(let k=0;k<8;k++){const ang=k/8*Math.PI*2;b.add(G.box,M(Math.cos(ang)*R*.5,1.1+h*.45,Math.sin(ang)*R*.5,0,-ang,Math.PI/2-.9,.12,R*1.25,.12),C.panel);}
    b.add(G.ico,M(0,1.1,0,0,0,0,R*.98,h,R*.98),C.glass,.18);for(let k=0;k<4+L*2;k++){const ang=k*2.4,r=(k%3+1)*R*.22;b.add(G.cone6,M(Math.cos(ang)*r,1.1,Math.sin(ang)*r,0,ang,0,.5,.8+L*.35+(k%2)*.4,.5),k%2?C.plant:C.moss,.25);}break;}
   case 'hangar':{pad();b.box(0,3,-hd*.15,W-1,6,D*.7,fin);b.box(0,6.1,-hd*.15,W-.8,.3,D*.72,C.roof);b.box(0,3,hd*.2+.1,W-2.4,5.2,.2,C.dark);for(let k=0;k<Math.min(4,L);k++){const x=-hw+2.5+k*((W-5)/Math.max(1,Math.min(4,L)-1||1));b.box(x,.9,hd*.35,2.2,1,3.2,C.mid);b.box(x,1.7,hd*.3,1.4,.6,1.6,C.dark2);b.box(x,1.75,hd*.3+1.4,.18,.18,1.8,C.dark);}
    b.box(0,5.9,hd*.21,W-2.4,.2,.15,a,1);break;}
   case 'helium':{pad();for(const sx of [-1,1])for(const sz of [-1,1])b.seg(new T.Vector3(sx*1.8,.3,sz*1.8),new T.Vector3(0,6+L,0),.18,C.panel);b.add(G.cyl,M(0,.3,0,0,0,0,.45,4,.45),C.dark);for(let k=0;k<Math.min(4,L);k++)b.add(G.cyl,M(-hw+1.2+k*1.9,.3,hd-1.2,0,0,0,.8,1.8,.8),C.ice,.25);b.box(0,6+L,0,.5,.5,.5,a,1.4);break;}
   case 'radar':{pad();b.add(G.cyl,M(0,.3,0,0,0,0,.5,3+L*.5,.5),C.mid);b.box(0,.8,0,3,1,3,C.dark);break;}
   case 'shield':{pad();b.add(G.hex,M(0,.3,0,0,0,0,1.8,1.4,1.8),C.dark);b.add(G.cone6,M(0,1.7,0,0,0,0,.9,3+L*.6,.9),C.mid);b.add(G.ico,M(0,5+L*.6,0,0,0,0,.7,.7,.7),C.cyan,2);break;}
   case 'lab':{pad();vital();b.box(0,2,0,W-1.4,4,D-1.4,fin);b.box(0,4.1,0,W-1.2,.25,D-1.2,C.roof);b.add(G.cyl,M(0,4.2,0,0,0,0,1.6,.4+L*.4,1.6),C.violet,.8);b.box(0,2.4,hd-.65,W-3,1.4,.1,C.violet,1);break;}
   case 'uplink':{pad();const h=6+L*1.6;for(const sx of [-1,1])for(const sz of [-1,1])b.seg(new T.Vector3(sx*1.4,.3,sz*1.4),new T.Vector3(sx*.25,h,sz*.25),.12,C.panel);for(let k=1;k<4;k++)b.box(0,h*k/4,0,2.8*(1-k/4)+.3,.08,.08,C.mid);b.box(0,h+.3,0,.35,.6,.35,C.red,2);break;}
   case 'trophy':{pad();b.box(0,2.2,-hd*.2,W-1.4,4.4,D*.55,C.dark2);b.add(G.cone5,M(0,4.4,-hd*.2,0,Math.PI/4,0,W*.5,1.6,D*.4),C.gold,.2);for(let k=0;k<3+L*2;k++){const x=-hw+1.4+(k%5)*((W-2.8)/4),z=hd-1.8+Math.floor(k/5)*-1.2;b.box(x,.7,z,.8,.8,.8,C.dark);b.add(G.octa,M(x,1.5,z,0,k,0,.3,.4,.3),k%3?C.gold:C.ice,1.4);}break;}
   case 'gate':{b.box(0,1.8,0,3.8,3.6,3.8,C.dark);b.box(0,1.6,1.95,2.4,3,.1,C.amber,.8);b.box(0,3.65,0,4,.15,4,C.cyan,1);break;}
   default:{const B=P.BUILDINGS[type];if(B?.turret){const big=B.pw>1;b.add(G.hex,M(0,0,0,0,0,0,big?1.85:1.6,.6,big?1.85:1.6),C.dark2);b.add(G.cyl,M(0,.6,0,0,0,0,big?1.05:.9,.6+L*.15,big?1.05:.9),fin);b.add(G.torus,M(0,1.25+L*.15,0,Math.PI/2,0,0,.95,.95,.95),a,.7);for(let k=1;k<L;k++)b.box(0,.62+k*.12,big?1.1:.95,.5,.05,.05,C.gold,1);}}}
  return b;}
 // The rotating head of every turret type (and the radar dish): its own silhouette, so each role reads at a glance.
 function head(type,l){const b=new S.Bld(),L=Math.max(1,l),a=accent(L);
  switch(type){
   case 'cannon':b.box(0,0,0,1.4,.9,1.6,C.mid);b.add(G.cyl,M(0,.15,.6,Math.PI/2,0,0,.18,2.2+L*.2,.18),C.dark);b.box(0,.48,-.79,1,.1,.04,a,.9);break;
   case 'mg':b.box(0,0,-.1,1.1,.75,1.2,C.mid);for(const sx of [-.24,.24]){b.add(G.cyl,M(sx,.12,.4,Math.PI/2,0,0,.09,1.9+L*.15,.09),C.dark);b.add(G.cyl,M(sx,.12,2.2+L*.15,Math.PI/2,0,0,.13,.25,.13),C.dark2);}b.box(.7,-.05,-.1,.35,.5,.7,C.amber,.25);break;
   case 'laser':b.add(G.ico,M(0,.2,0,0,0,0,.75,.75,.75),C.dark);b.add(G.cyl,M(0,.2,.4,Math.PI/2,0,0,.28,1.4,.28),C.panel);b.box(0,.2,1.85,.32,.32,.1,C.cyan,2.2);break;
   case 'rocket':b.box(0,.3,0,1.7,1.2,1.4,C.mid);for(let k=0;k<6;k++)b.add(G.cyl,M(-.5+(k%3)*.5,.05+Math.floor(k/3)*.5,.72,Math.PI/2,0,0,.18,.12,.18),C.dark2);for(let k=0;k<6;k++)b.box(-.5+(k%3)*.5,.05+Math.floor(k/3)*.5,.79,.16,.16,.02,C.furnace,1.2);b.box(0,.95,0,1.5,.08,1.2,a,.6);break;
   case 'missile':b.box(0,.3,0,1.6,1,1.4,C.mid);for(let k=0;k<4;k++)b.box(-.4+(k%2)*.8,.1+Math.floor(k/2)*.45,.72,.35,.35,.12,C.red,1);break;
   case 'mortar':b.add(G.cyl,M(0,0,0,-.7,0,0,.45,1.8+L*.15,.45),C.dark);b.add(G.cyl,M(0,0,0,0,0,0,.7,.4,.7),C.mid);break;
   case 'flame':b.add(G.cyl,M(0,.1,-.5,0,0,0,.45,1.1,.45),C.rust);b.add(G.cyl,M(0,.15,.2,Math.PI/2,0,0,.22,1.3,.22),C.dark);b.add(G.cone6,M(0,.15,1.5,Math.PI/2,0,0,.32,.4,.32),C.dark2);b.box(0,.15,1.72,.14,.14,.06,C.furnace,2.4);break;
   case 'siege':b.box(0,.1,-.2,1.9,1.2,2.1,C.mid);b.add(G.cyl,M(0,.25,.7,Math.PI/2,0,0,.32,3.2+L*.3,.32),C.dark);b.add(G.cyl,M(0,.25,3.9+L*.3,Math.PI/2,0,0,.42,.5,.42),C.dark2);for(const sx of [-.7,.7])b.add(G.cyl,M(sx,.05,.3,Math.PI/2,0,0,.12,1.4,.12),C.panel);b.box(0,.75,-1.25,1.2,.1,.04,a,1);break;
   case 'tesla':b.add(G.cyl,M(0,-.2,0,0,0,0,.5,2.2,.5),C.dark);for(let k=0;k<3+Math.min(2,L>>1);k++)b.add(G.torus,M(0,.1+k*.42,0,Math.PI/2,0,0,.62-k*.06,.62-k*.06,.62-k*.06),C.panel,.3);b.add(G.ico,M(0,2.25,0,0,0,0,.42,.42,.42),C.violet,2.6);break;
   case 'lasercannon':b.box(0,0,-.3,1.5,1,1.6,C.dark);b.add(G.cone6,M(0,.15,.9,-Math.PI/2,0,0,.9,.7,.9),C.panelB);b.add(G.torus,M(0,.15,.95,0,0,0,.72,.72,.72),C.mag,1.8);b.box(0,.15,1.05,.3,.3,.1,lin(0xffd0f4),2.6);break;
   case 'railgun':b.box(0,0,-.6,1.4,.9,1.6,C.mid);for(const sx of [-.28,.28])b.box(sx,.2,1.4,.14,.32,3.8+L*.25,C.dark);b.box(0,.2,1.4,.06,.06,3.6+L*.25,C.cyan,2);b.box(0,.6,-.6,1,.12,1.2,a,.9);break;
   case 'radar':b.add(G.cone6,M(0,.4,0,Math.PI*.38,0,0,1.6+l*.25,.6,1.6+l*.25),C.panelB);b.box(0,.2,0,.3,.6,.3,a,1.2);break;}
  return b;}
 // One wall cell (4 m square) read as a fortification at any distance: a darker body on a footing, a lit cap line in the
 // blend's accent, four corner merlons (a crenellated top along any run), then the blend's own look (tint, sheen bands, veins,
 // Selenite glass glint, Moonheart glow); heavier blends stand taller. LOW keeps the footing, body, cap line and merlons.
 const wallH=code=>{const {o,l}=P.wdecode(code);return 2.6+1.3*P.blendQ(o,l);};
 function wallGeo(code,low){const b=new S.Bld(),{o,l}=P.wdecode(code),h=wallH(code),W=4.02,[body,acc,glow]=ORE_LOOK[o],bc=lin(body).multiplyScalar(.72),ac=lin(acc);
  b.box(0,h/2,0,W,h,W,bc);b.box(0,h+.07,0,W+.1,.14,W+.1,ac,glow*.85+.25);   // the body and its lit cap line in the blend's accent
  if(low)return b.geometry();
  for(const s2 of [-1,1])b.box(s2*1.25,h+.45,s2*1.25,1.3,.62,1.3,bc.clone().multiplyScalar(1.18));   // merlons: a crenellated top along any run
  if(o&&l>=2)b.box(0,h*.42,0,W+.04,o>=4?.14+.04*l:.1,W+.04,ac,glow*(.55+.25*l));
  if(o===4&&l>=2)for(let k=0;k<2;k++)b.add(G.cone5,M(-1.1+k*2.2,h+.14,.9-k*1.8,.15,k,0,.18,.6+.2*l,.18),ac,1.3);
  if(o===5)b.box(0,h+.2,0,W*.9,.04,.3,lin(0xffffff),2.4,Math.PI/4);
  if(o===6)b.box(0,h+.2,0,W*.5,.06,W*.5,ac,glow*1.2);
  return b.geometry();}
 // A wall post (corners, ends, junctions, every 6th cell of a straight run): a squat tower with a lit top. Unit height:
 // the instance scales it to the run's wall height.
 function postGeo(low){const b=new S.Bld();b.box(0,.5,0,1.9,1,1.9,C.dark);b.box(0,1.02,0,2.2,.06,2.2,C.cyan,1.1);if(!low)b.box(0,.6,0,1.96,.12,.5,C.amber,.9);return b.geometry();}
 // Rubble: a ruined wall cell (broken chunks and a scorch), never a hole.
 function rubbleGeo(){const b=new S.Bld(),c1=lin(0x5a564c),c2=lin(0x3a3832);for(let k=0;k<6;k++){const a=k*1.7,r=.4+(k%3)*.55;b.add(G.box,M(Math.cos(a)*r*1.1,.25+(k%2)*.2,Math.sin(a)*r,.3*k,k,.5*(k%3),1.1+(k%2)*.5,.5+(k%3)*.25,.9),k%2?c1:c2);}b.box(0,.04,0,4,.08,4,lin(0x15130f));b.add(G.box,M(-.9,.55,.6,0,.7,.8,.4,1.4,.3),lin(0x6d6a60));return b.geometry();}
 // Settler homes and town structures (Session 5 settler kit look). A 2x2 lot (8 m), centred at the origin.
 function home(kind,low){const b=new S.Bld(),pc=C.paint;switch(kind){
   case 'dome':b.box(0,.15,0,7,.3,7,C.dark2);b.add(G.hex,M(0,.3,-.5,0,0,0,2.6,1.6,2.6),pc[1]);b.add(G.dome,M(0,1.9,-.5,0,0,0,2.55,2,2.55),pc[0]);b.add(G.hex,M(0,1.2,-.5,0,0,0,2.62,.35,2.62),C.warm,.8);
    b.box(0,.45,2.3,3.4,.3,1.8,C.timber);for(const sx of [-1,1])b.box(sx*1.5,1.3,3.1,.18,2.2,.18,C.timberD);b.box(0,2.45,2.4,3.6,.14,2,C.comp);if(!low)b.add(G.cyl,M(1.4,2.6,-1.4,0,0,0,.22,1.6,.22),C.rust);break;
   case 'block':b.box(0,.15,0,7,.3,7,C.dark2);b.box(0,1.6,0,5.6,3,5,pc[5]);b.box(.3,4.1,-.2,4.8,2,4.2,pc[2]);for(const y of [1.6,4.1])b.box(0,y,2.52,4.6,.45,.06,C.warm,.7);b.box(0,3.2,2.7,3.4,.16,1,C.timber);
    if(!low){b.box(-2.85,1.4,0,.06,1.2,3,pc[4],.5);b.add(G.cyl,M(0,5.1,0,0,0,0,1.1,1.5,1.1),pc[3]);b.add(G.cone6,M(0,6.6,0,0,0,0,1.2,.5,1.2),C.roof);}break;
   case 'tower':b.box(0,.15,0,7,.3,7,C.dark2);for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])b.seg(new T.Vector3(sx*2.2,.3,sz*2.2),new T.Vector3(sx*1.1,6.5,sz*1.1),.2,C.rust);b.add(G.cyl,M(0,6.4,0,0,0,0,2.2,2.4,2.2),pc[3]);b.add(G.cyl,M(0,7.2,0,0,0,0,2.25,.5,2.25),pc[0]);b.add(G.cone6,M(0,8.8,0,0,0,0,2.3,.7,2.3),C.roof);b.box(0,9.6,0,.3,.3,.3,C.amber,1.6);break;
   case 'green':b.box(0,.15,0,7,.3,7,C.dark2);b.box(0,.6,0,6,.6,4.6,C.moss);b.add(G.cyl,M(0,.9,0,0,0,Math.PI/2,2.3,6,2.3),C.glass,.25);for(let k=-2;k<=2;k++)b.box(k*1.3,2.1,0,.12,2.4,4.8,pc[(k+5)%6]);if(!low)for(let k=0;k<6;k++)b.add(G.cone6,M(-2.2+k*.9,.9,(k%2-.5)*1.6,0,k,0,.4,1,.4),C.plant,.25);break;
   default:b.box(0,.15,0,7,.3,7,C.dark2);b.box(0,1.8,-.8,6,3.4,4,pc[2]);b.box(0,1.3,1.25,5.2,2.2,.1,C.warm,.8);for(let k=0;k<6;k++)b.box(-2.5+k,3.5,1.8,1,.12,1.4,k%2?lin(0xd8c8a0):pc[0]);
    if(!low)for(let k=0;k<4;k++)b.box(-2.6+(k%2)*.95,.45+Math.floor(k/2)*.85,2.6,.85,.85,.85,k%2?C.timber:C.rust);}
  return b.geometry();}
 function person(){const b=new S.Bld();b.box(0,.55,0,.35,.7,.25,C.amber);b.box(0,1.08,0,.24,.26,.24,C.panelB);return b.geometry();}
 function rover(){const b=new S.Bld();b.box(0,.6,0,1.2,.5,2,C.sand);b.box(0,1,-.3,.9,.4,.9,C.dark2);for(const sx of [-1,1])for(const sz of [-.7,.7])b.add(G.cylC,M(sx*.7,.35,sz,0,0,Math.PI/2,.35,.25,.35),C.dark);b.box(0,1.25,-.3,.2,.1,.2,C.cyan,1.5);return b.geometry();}
 function foe(kind){const b=new S.Bld();if(kind==='d'){b.add(G.blob1,M(0,0,0,0,0,0,1.3,.55,1.3),K.chitin);b.box(0,0,0,3.4,.1,.4,K.mag,2.2);b.add(G.octa,M(0,.5,0,0,0,0,.4,.4,.4),K.magHot,2.4);}
  else if(kind==='w'){b.add(G.blob1,M(0,.5,0,0,0,0,.8,.55,1.1),K.chitin);b.box(0,.6,.8,.5,.12,.12,K.mag,2.4);}
  else if(kind==='b'){b.add(G.blob1,M(0,2.2,0,0,0,0,3.4,2.4,3.8),K.chitinD||K.chitin);for(const sx of [-1,1])b.box(sx*2.4,2.4,.6,.9,2.6,2.8,K.dark2);b.box(0,3.2,3.4,2.2,.4,.3,K.mag,2.4);b.add(G.octa,M(0,4.8,0,0,0,0,.7,.9,.7),K.magHot,2.2);}
  else{const s=kind==='s'?2.6:1.7;b.add(G.blob1,M(0,s*.7,0,0,0,0,s,s*.7,s*1.3),K.chitin);b.box(0,s*.95,s*1.15,s*.6,s*.18,.18,K.mag,2.4);b.add(G.octa,M(0,s*1.6,0,0,0,0,.35*s,.45*s,.35*s),K.magHot,2.2);}return b.geometry();}
 // Banner: mast + two-colour flag in the chosen shape, emblem as a small lit mark. Shared by the base and the tank.
 function banner(bn,scale=1){const b=new S.Bld(),c1=new T.Color(bn.colors[0]),c2=new T.Color(bn.colors[1]),h=6*scale,w=2.6*scale,fh=1.7*scale;b.box(0,h/2,0,.16*scale,h,.16*scale,C.dark);
  if(bn.shape==='pennant'){b.add(G.cone5,M(w/2,h-fh/2,0,0,0,-Math.PI/2,fh/2,w,.08*scale),c1);b.box(w*.25,h-fh/2,0,w*.5,fh*.18,.1*scale,c2);}
  else if(bn.shape==='chevron'){b.box(w/2,h-fh/2,0,w,fh,.08*scale,c1);b.box(w/2,h-fh*.5,0,w*.7,fh*.2,.1*scale,c2,0,0);b.add(G.box,M(w*.75,h-fh*.62,0,0,0,.6,w*.45,fh*.16,.1*scale),c2);}
  else if(bn.shape==='square'){b.box(w/2,h-fh/2,0,w,fh,.08*scale,c1);b.box(w/2,h-fh/2,0,w*.9,fh*.12,.1*scale,c2);}
  else{b.box(w/2,h-fh*.45,0,w,fh*.9,.08*scale,c1);b.add(G.cone5,M(w/2,h-fh*.9,0,Math.PI,0,0,w*.5,fh*.4,.07*scale),c1);b.box(w/2,h-fh*.45,0,w*.12,fh*.9,.1*scale,c2);}
  b.add(G.octa,M(w/2,h-fh*.45,.08*scale,0,0,0,.28*scale,.28*scale,.06*scale),c2,1.6);return b;}
 function decor(list,x0,z0,W,D,light){const b=new S.Bld(),L=LIGHT[light]||C.cyan;list.forEach((d,i)=>{const a=i/Math.max(1,list.length)*Math.PI*2,x=x0+Math.cos(a)*(W/2+3),z=z0+Math.sin(a)*(D/2+3);
  if(d==='lamps'){b.box(x,1.6,z,.18,3.2,.18,C.dark);b.box(x,3.3,z,.5,.3,.5,L,2);}else if(d==='crates'){b.box(x,.45,z,.9,.9,.9,C.rust);b.box(x+.8,.4,z+.3,.8,.8,.8,C.sand);}
  else if(d==='antenna'){b.box(x,2.5,z,.12,5,.12,C.panel);b.box(x,5,z,.3,.3,.3,C.red,2);}else if(d==='plants'){b.add(G.cone6,M(x,0,z,0,i,0,.6,1.4,.6),C.plant,.2);b.add(G.cone6,M(x+.8,0,z+.4,0,i,0,.45,1,.45),C.moss,.2);}
  else if(d==='statue'){b.box(x,.5,z,1.6,1,1.6,C.dark2);b.add(G.ico,M(x,1.8,z,0,0,0,.7,1,.7),C.gold,.5);}else if(d==='flags'){for(const k of [-1,1]){b.box(x+k*.6,1.8,z,.1,3.6,.1,C.dark);b.box(x+k*.6+.45,3.2,z,.9,.6,.05,L,.6);}}});return b;}
 // Diorama pieces (small scale, a few dozen triangles each): what reads from 60 m away is the silhouette and the colour.
 function mini(b,type,l,x,z,y,rot,s,ex,theme){const B=P.BUILDINGS[type],sz=P.sizeOf(type,rot|0),W=sz.w*4*s,D=sz.d*4*s,L=Math.max(1,l),V=v=>v*s*ex,fin=theme?.finish==='sand'?C.sand:theme?.finish==='graphite'?C.dark:C.steel,a=accent(L);
  if(type==='cc'){let yy=y;for(let k=0;k<Math.min(10,L);k++){const r=(6.6-k*.48)*s,h=V(1.5+(k%2)*.5);b.add(G.oct,M(x,yy,z,0,k*.2,0,r,h,r),k%2?C.mid:fin);yy+=h;b.add(G.oct,M(x,yy-.02,z,0,k*.2,0,r*1.02,V(.12),r*1.02),a,.9);}
   b.add(G.cyl,M(x,yy,z,0,0,0,.25*s*1.6,V(6+L*.4),.25*s*1.6),C.panel);b.box(x,yy+V(6.2+L*.4),z,1.2*s*1.6,1.2*s*1.6,1.2*s*1.6,L>=9?C.gold:C.ice,1.8);return;}
  if(B?.turret){const H=V(1.4+L*.15),big=B.pw>1;b.add(G.hex,M(x,y,z,0,0,0,(big?1.9:1.6)*s,H,(big?1.9:1.6)*s),C.dark2);b.box(x,y+H+V(.45),z,1.6*s,V(.9),1.9*s,TURRET_TINT[type]?lin(TURRET_TINT[type]):C.mid,.35);return;}
  b.box(x,y+V(.15),z,W*.94,V(.3),D*.94,C.dark2);
  switch(type){
   case 'refinery':b.box(x-W*.15,y+V(2.2),z,W*.5,V(4.4),D*.6,fin);b.add(G.cyl,M(x+W*.25,y,z-D*.2,0,0,0,1.5*s,V(6+L*.8),1.5*s),C.mid);b.box(x+W*.25,y+V(6+L*.8),z-D*.2,1.6*s,V(.4),1.6*s,a,1);break;
   case 'storage':for(let k=0;k<3;k++)b.add(G.cyl,M(x-W*.3+k*W*.3,y,z,0,0,0,1.3*s,V(2.6+L*.4),1.3*s),k%2?fin:C.mid);break;
   case 'reactor':b.add(G.cyl,M(x,y,z,0,0,0,3.4*s,V(3+L*.6),3.4*s),C.dark);b.box(x,y+V(3.6+L*.6),z,1.8*s,1.8*s,1.8*s,C.ice,2);b.add(G.cyl,M(x,y+V(1.4+L*.3),z,0,0,0,3.55*s,V(.25),3.55*s),C.cyan,1.2);break;
   case 'foundry':b.box(x,y+V(2),z,W*.8,V(4),D*.6,fin);b.add(G.cyl,M(x-W*.3,y,z-D*.3,0,0,0,.8*s,V(6+L),.8*s),C.dark);b.box(x-W*.3,y+V(6+L),z-D*.3,.9*s,V(.3),.9*s,C.furnace,1.4);break;
   case 'biodome':b.add(G.dome,M(x,y+V(.3),z,0,0,0,W*.42,V(2.4+L*.7),D*.42),C.glass,.25);break;
   case 'hangar':b.box(x,y+V(3),z,W*.9,V(6),D*.75,fin);b.box(x,y+V(6.1),z,W*.92,V(.3),D*.77,C.roof);break;
   case 'helium':b.add(G.cone5,M(x,y,z,0,0,0,1.6*s,V(6+L),1.6*s),C.panel);b.box(x,y+V(6+L),z,.8*s,.8*s,.8*s,a,1.4);break;
   case 'radar':b.add(G.cyl,M(x,y,z,0,0,0,.5*s,V(3+L*.5),.5*s),C.mid);b.add(G.cone6,M(x,y+V(3+L*.5),z,Math.PI*.38,0,0,(1.6+L*.25)*s,V(.6),(1.6+L*.25)*s),C.panelB);break;
   case 'shield':b.add(G.cone6,M(x,y,z,0,0,0,1.2*s,V(3+L*.6),1.2*s),C.mid);b.box(x,y+V(4+L*.6),z,1.2*s,1.2*s,1.2*s,C.cyan,2);break;
   case 'lab':b.box(x,y+V(2),z,W*.75,V(4),D*.75,fin);b.add(G.cyl,M(x,y+V(4),z,0,0,0,1.6*s,V(.6+L*.4),1.6*s),C.violet,.9);break;
   case 'uplink':b.add(G.cone5,M(x,y,z,0,0,0,1.4*s,V(6+L*1.6),1.4*s),C.panel);b.box(x,y+V(6+L*1.6),z,.6*s,.6*s,.6*s,C.red,2);break;
   case 'trophy':b.box(x,y+V(2.2),z,W*.8,V(4.4),D*.6,C.dark2);b.add(G.cone5,M(x,y+V(4.4),z,0,Math.PI/4,0,W*.45,V(1.6),D*.4),C.gold,.3);break;
   case 'gate':b.box(x,y+V(1.8),z,W,V(3.6),D,C.dark);b.box(x,y+V(3.6),z,W*1.05,V(.15),D*1.05,C.cyan,1);break;
   default:b.box(x,y+V(2),z,W*.8,V(4),D*.8,fin);}}
 const TURRET_TINT={cannon:0x6a7684,mg:0x8a7a52,laser:0x2f9fc8,rocket:0xb0623a,missile:0xa03040,mortar:0x6a6050,flame:0xc0602a,siege:0x55606c,tesla:0x7a5ad8,lasercannon:0xc040b0,railgun:0x40a8d0};
 return {T,M,C,LIGHT,building,head,wallGeo,wallH,postGeo,rubbleGeo,home,person,rover,foe,lin,banner,decor,mini,TURRET_TINT};}

// ------------------------------------------------------------------- the instancing plan --------------------------------
// What the town draws, independent of camera and renderer: the Home Sector (drive camera) and build mode (overhead camera)
// render the same plan, so they always show the same instance counts (dev/tests/conquest-townkit.mjs).
function plan(p){const P=PL(),walls=new Map(),posts=[],rubble=[],turrets=new Map(),buildings=[],w=p.w||{},ruinedKey=k=>!!p.dmg&&P.ruined(p,'w:'+k);
 for(const [k,c] of Object.entries(w)){if(ruinedKey(k)){rubble.push(k);continue;}const code=c|0;if(!walls.has(code))walls.set(code,[]);walls.get(code).push(k);}
 // posts: corners, ends, junctions and every 6th cell of a straight run (visual only)
 const has=(i,j)=>{const c=w[i+','+j];return !!c&&!ruinedKey(i+','+j);};
 for(const list of walls.values())for(const k of list){const [i,j]=k.split(',').map(Number),e=has(i+1,j),wv=has(i-1,j),n=has(i,j-1),s=has(i,j+1),hz=e||wv,vt=n||s,deg=e+wv+n+s;
  const corner=deg===2&&hz&&vt,straight=deg===2&&!corner;if(deg===1||corner||straight&&(e&&wv?i%6===0:j%6===0)||deg===3&&(i+j)%6===0)posts.push(k);}
 for(const [id,b] of Object.entries(p.b||{})){const building=p.job?.id===id||p.job?.t==='cc'&&b.t==='cc',lvl=b.t==='cc'?p.cc:b.l,B=P.BUILDINGS[b.t];
  if(B?.turret&&lvl>0&&!building){const kk=b.t+':'+b.l;if(!turrets.has(kk))turrets.set(kk,[]);turrets.get(kk).push([id,b]);continue;}buildings.push([id,b,lvl,building]);}
 const homes=new Map();for(const h of P.homes(p)){if(!homes.has(h.k))homes.set(h.k,[]);homes.get(h.k).push(h);}
 return {walls,posts,rubble,turrets,buildings,homes};}
function counts(pl){let wc=0,tc=0,hc=0;for(const l of pl.walls.values())wc+=l.length;for(const l of pl.turrets.values())tc+=l.length;for(const l of pl.homes.values())hc+=l.length;
 return {wallCells:wc,wallLooks:pl.walls.size,turrets:tc,turretGroups:pl.turrets.size,homes:hc,homeKinds:pl.homes.size,buildings:pl.buildings.length,posts:pl.posts.length,rubble:pl.rubble.length};}

// ------------------------------------------------------------------- terrain ---------------------------------------------
// The site template under the town, lit: brighter ground inside the town edge with a subtle per-cell texture, a paved plaza
// around the Command Center, dust roads from the Command Center toward each raider lane, terraces, lakes and cliffs; red
// hazard chevrons at the lanes pointing inward with a faint ground glow; the town edge as one thin cyan line.
const TCOL={ground:[.2,.19,.18],lush:[.12,.2,.08],ash:[.13,.12,.13],pass:[.22,.18,.15],ice:[.52,.64,.72],rim:[.13,.12,.12],cliff:[.085,.085,.095],water:[.04,.1,.17],rock:[.14,.13,.12],crevasse:[.03,.05,.08],vent:[.3,.12,.05],deposit:[.32,.17,.08]};
function roadCells(P,p){const out=new Set(),cc=p.b?.cc;if(!cc)return out;const c0=[cc.i+1.5,cc.j+1.5];
 for(const cl of P.spawnCells(p.site,p.cc)){if(!cl.length)continue;const e=cl[Math.floor(cl.length/2)],dx=e[0]-c0[0],dy=e[1]-c0[1],n=Math.ceil(Math.hypot(dx,dy));
  for(let t=0;t<=n;t++){const x=c0[0]+dx*t/n,y=c0[1]+dy*t/n;for(const [a,b] of [[0,0],[1,0],[0,1]])out.add(Math.round(x-.5+a*.6)+','+Math.round(y-.5+b*.6));}}return out;}
function plazaOf(p){const c=p.b?.cc;return c?{i0:c.i-2,j0:c.j-2,i1:c.i+5,j1:c.j+5}:null;}
function terrain(S,k,p,group){const T=S.T,P=PL(),site=p.site,cc=p.cc,b=new S.Bld(),n=P.GRID.n,c=P.GRID.cell,half=n*c/2,step=4,ext=60,H0=P.townH(cc),pz=plazaOf(p),roads=roadCells(P,p);
 const col=(x,z)=>{const i=Math.round(x/c+(n-1)/2),j=Math.round(z/c+(n-1)/2);if(Math.abs(x)>half+2||Math.abs(z)>half+2)return [.05,.05,.06];const t=P.terrainAt(site,i,j),inside=P.cheb(i,j)<=H0;let base=TCOL[t]||TCOL.ground;
  if(inside&&!P.NOBUILD[t]&&pz&&i>=pz.i0&&i<=pz.i1&&j>=pz.j0&&j<=pz.j1)base=(i+j)%2?[.34,.34,.36]:[.31,.31,.33];
  else if(inside&&!P.BLOCKED[t]&&roads.has(i+','+j))base=[.31,.26,.2];
  const f=(inside?1:.5)*(.93+.14*hashf(i,j,7)),tint=site==='delta'&&t==='ground'?[.85,.97,.7]:site==='crater'?[1.05,.95,.85]:site==='plateau'?[1.08,1,.92]:[1,1,1.04];return [base[0]*f*tint[0],base[1]*f*tint[1],base[2]*f*tint[2]];};
 const H=(x,z)=>Math.abs(x)>half+2||Math.abs(z)>half+2?P.heightAt(site,Math.sign(x)*Math.min(Math.abs(x),half),Math.sign(z)*Math.min(Math.abs(z),half))+(site==='canyon'?8:2)+((Math.abs(x)+Math.abs(z))%23)*.05:P.heightAt(site,x,z);
 const tc=new T.Color();for(let x=-half-ext;x<half+ext;x+=step)for(let z=-half-ext;z<half+ext;z+=step){const q=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]].map(([a,bb])=>[a,H(a,bb),bb]),cc2=col(x+step/2,z+step/2);tc.setRGB(cc2[0],cc2[1],cc2[2]);b.quad(q[0],q[3],q[2],q[1],tc,0);}
 group.add(b.mesh());
 // rocks, vents and deposits get props; water and ice a surface
 const pr=new S.Bld(),wc=new T.Color(.05,.16,.26),ic=new T.Color(.6,.76,.86);for(let i=0;i<n;i++)for(let j=0;j<n;j++){const t=P.terrainAt(site,i,j),x=P.cellX(i),z=P.cellZ(j),y=P.groundY(site,i,j);
  if(t==='water')pr.box(x,-.35,z,c,.1,c,wc,.35);else if(t==='ice')pr.box(x,y+.06,z,c,.08,c,ic,.14);else if(t==='rock'&&(i+j)%2===0)pr.add(S.G.rock,k.M(x+1,y+.6,z+1,0,i*j,0,2.2,1.6,2.2),k.C.rust.clone().multiplyScalar(.7));else if(t==='vent')pr.add(S.G.cone6,k.M(x,y,z,0,i,0,1.6,1.4,1.6),k.C.furnace,.8);}
 if(site==='crater')for(const d of P.RIM_DEPOSITS){for(let k2=0;k2<6;k2++)pr.add(S.G.rock,k.M(P.cellX(d.i)+2+(k2%3-1)*1.6,.4,P.cellZ(d.j)+2+(k2>2?1.2:-1.2),0,k2,0,1.1,.8,1.1),k.C.rust);pr.box(P.cellX(d.i)+2,.05,P.cellZ(d.j)+2,7,.08,7,k.C.amber,.5);}
 if(pr.n)group.add(pr.mesh());
 const fx=new S.Fx(),r=S.AT?.SOLID||[0,0,1,1],u=(r[0]+r[2])/2,v=(r[1]+r[3])/2,quad=(pts,e,o=0)=>{const ids=pts.map(([x,y,z])=>fx.v(x,y,z,u,v,e,o));fx.q4(ids[0],ids[1],ids[2],ids[3]);};
 // the town edge: one thin cyan line following the ground
 const e=(H0+.5)*c,gy=(x,z)=>P.heightAt(site,x,z)+.1;for(let t=-e;t<e;t+=2){for(const [x0,z0,x1,z1] of [[t,-e,t+2,-e],[t,e,t+2,e],[-e,t,-e,t+2],[e,t,e,t+2]]){const nx=z1-z0?.07:0,nz=x1-x0?.07:0;quad([[x0-nx,gy(x0,z0),z0-nz],[x1-nx,gy(x1,z1),z1-nz],[x1+nx,gy(x1,z1),z1+nz],[x0+nx,gy(x0,z0),z0+nz]],[.08,.75,.9]);}}
 // raider lanes: chevrons pointing inward and a faint red ground glow (never brick strips)
 const blob=S.AT?.BLOB;for(const cl of P.spawnCells(site,cc)){if(!cl.length)continue;let cx=0,cz=0;for(const [i,j] of cl){cx+=P.cellX(i);cz+=P.cellZ(j);}cx/=cl.length;cz/=cl.length;const L=Math.hypot(cx,cz)||1,dx=-cx/L,dz=-cz/L,px=-dz,pz2=dx,w2=Math.max(2,cl.length*c/2);
  if(blob)fx.flat(cx,gy(cx,cz)+.02,cz,w2+3,w2+3,blob,[.55,.04,.08],0);
  for(let s2=0;s2<3;s2++){const ox=cx+dx*(s2*3.4-3),oz=cz+dz*(s2*3.4-3),tip=[ox+dx*1.6,oz+dz*1.6];for(const side of [-1,1]){const bx=ox+px*side*w2*.7,bz=oz+pz2*side*w2*.7,ux=(tip[0]-bx),uz=(tip[1]-bz),ul=Math.hypot(ux,uz)||1,qx=-uz/ul*.45,qz=ux/ul*.45;
    quad([[bx-qx,gy(bx,bz)+.06,bz-qz],[tip[0]-qx,gy(tip[0],tip[1])+.06,tip[1]-qz],[tip[0]+qx,gy(tip[0],tip[1])+.06,tip[1]+qz],[bx+qx,gy(bx,bz)+.06,bz+qz]],[1.3,.16,.2].map(q=>q*(1-s2*.22)));}}}
 if(fx.n)group.add(fx.mesh());
 const earth=new S.Bld();earth.add(S.G.ico,k.M(-560,300,-1100,0,0,0,100,100,100),new T.Color(.06,.16,.34),.9);earth.add(S.G.ico,k.M(-580,316,-1080,0,0,0,70,70,70),new T.Color(.12,.24,.12),.5);group.add(earth.mesh());}
const terrainKey=p=>[p.site,p.cc,p.b?.cc?.i,p.b?.cc?.j].join(':');
// The height of the RENDERED town ground at (x,z): the terrain mesh's own triangles (4 m lattice, diagonal from the low
// corner), so a tank driving the Home Sector sits exactly on what you see; open ground continues past the 79-cell grid.
function rawH(site,x,z){const P=PL(),half=P.GRID.n*P.GRID.cell/2;return Math.abs(x)>half+2||Math.abs(z)>half+2?P.heightAt(site,Math.sign(x)*Math.min(Math.abs(x),half),Math.sign(z)*Math.min(Math.abs(z),half))+(site==='canyon'?8:2)+((Math.abs(x)+Math.abs(z))%23)*.05:P.heightAt(site,x,z);}
function groundAt(site,x,z){const x0=Math.floor((x-2)/4)*4+2,z0=Math.floor((z-2)/4)*4+2,u=(x-x0)/4,v=(z-z0)/4,h0=rawH(site,x0,z0),h1=rawH(site,x0+4,z0),h2=rawH(site,x0+4,z0+4),h3=rawH(site,x0,z0+4);
 return v>=u?h0+(h2-h3)*u+(h3-h0)*v:h0+(h1-h0)*u+(h2-h1)*v;}
// Damage you can see (plot.dmg; drills never write it): damaged and ruined walls smoke, ruined turrets and buildings spark.
// Positions in town metres times `scale` plus an offset (the world diorama passes its own scale).
function damageEmitters(p,scale=1,ox=0,oy=0,oz=0,yAt){const P=PL(),out=[],dm=p.dmg||{},cs=P.GRID.cell,h=yAt||((x,z)=>P.heightAt(p.site,x,z));
 const ids=Object.keys(dm).filter(k=>dm[k]>0).sort((a,b)=>(dm[b]/(P.maxHpOf(p,b)||1))-(dm[a]/(P.maxHpOf(p,a)||1)));
 for(const id of ids.slice(0,40)){const ruined=P.ruined(p,id);if(id.startsWith('w:')){const [i,j]=id.slice(2).split(',').map(Number),x=P.cellX(i),z=P.cellZ(j);out.push({x:ox+x*scale,y:oy+(h(x,z)+(ruined?1:3))*scale,z:oz+z*scale,kind:'smoke',k:ruined?1:.6,s:scale,seed:(i*31+j*17)%97/97});continue;}
  const b=p.b?.[id];if(!b)continue;const sz=P.sizeOf(b.t,b.r|0),x=P.cellX(b.i)+(sz.w-1)*cs/2,z=P.cellZ(b.j)+(sz.d-1)*cs/2,top=(h(x,z)+(P.BUILDINGS[b.t]?.turret?2.2:4))*scale;
  out.push({x:ox+x*scale,y:oy+top,z:oz+z*scale,kind:'smoke',k:ruined?1:.5,s:scale,seed:(b.i*13+b.j*7)%89/89});if(ruined)out.push({x:ox+x*scale,y:oy+top,z:oz+z*scale,kind:'spark',k:1,s:scale,seed:(b.i*5+b.j*11)%83/83});}
 return out;}
// A small pool of camera-facing smoke puffs and sparks updated in place each frame: one draw, the shared glow program.
function puffs(S,max){const T=S.T,n=max,Pp=new Float32Array(n*12),U=new Float32Array(n*8),A=new Float32Array(n*16),B=new Float32Array(n*12),I=[];for(let q=0;q<n;q++){const b=q*4;I.push(b,b+1,b+2,b,b+2,b+3);}
 const g=new T.BufferGeometry();const at={position:new T.BufferAttribute(Pp,3),uv:new T.BufferAttribute(U,2),aCol:new T.BufferAttribute(A,4),aBill:new T.BufferAttribute(B,3)};for(const [k2,v] of Object.entries(at)){v.setUsage?.(35048);g.setAttribute(k2,v);}g.setIndex(I);g.computeBoundingSphere();   // 35048 = DYNAMIC_DRAW (the slim build has no constant); never culled
 const m=new T.Mesh(g,S.MAT.fx);m.renderOrder=3;m.frustumCulled=false;m.userData.noPick=true;const blob=S.AT.BLOB,spark=S.AT.SPARK||S.AT.BLOB;
 const set=(q,x,y,z,s,r,e,o)=>{for(let c=0;c<4;c++){const v=q*4+c,cx=c===0||c===3?-1:1,cy=c<2?-1:1;Pp[v*3]=x;Pp[v*3+1]=y;Pp[v*3+2]=z;U[v*2]=cx<0?r[0]:r[2];U[v*2+1]=cy<0?r[1]:r[3];A[v*4]=e[0];A[v*4+1]=e[1];A[v*4+2]=e[2];A[v*4+3]=o;B[v*3]=cx*s;B[v*3+1]=cy*s;B[v*3+2]=1;}};
 return {mesh:m,step(em,t){let q=0;for(const e of em||[]){if(q>=n)break;if(e.kind==='smoke'){for(let k=0;k<2&&q<n;k++){const ph=(t*.32+e.seed+k*.5)%1,s=(1.4+ph*3)*e.s*(.7+.5*e.k),c=.05*(1-ph);set(q++,e.x+Math.sin(e.seed*40+ph*3)*.8*e.s,e.y+ph*7*e.s,e.z+Math.cos(e.seed*33+ph*2)*.8*e.s,s,blob,[c,c,c*1.1],.5*(1-ph)*e.k);}}
   else{const fl=Math.sin(t*37+e.seed*91)>.2?1:0;set(q++,e.x+Math.sin(t*23+e.seed)*.6*e.s,e.y+.4*e.s,e.z+Math.cos(t*19+e.seed)*.6*e.s,(.5+Math.abs(Math.sin(t*11+e.seed*7)))*e.s,spark,[1.8*fl,1*fl,.35*fl],0);}}
  for(let r=q;r<n;r++)if(A[r*16+3]!==0||Pp[r*12+1]!==-1e4)set(r,0,-1e4,0,0,blob,[0,0,0],0);for(const v of Object.values(at))v.needsUpdate=true;m.visible=q>0;}};}

// ------------------------------------------------------------------- the instanced town ---------------------------------
// One scene object for the Home Sector and build mode. sync(p) rebuilds only what changed; far=true swaps walls and homes to
// the lighter geometry (distance LOD, no instance rebuild); hide(id) drops a structure during a raid replay (walls become
// rubble). A CC10 town (2,000+ wall cells, 42 turrets, ~70 homes): about 60 draws.
class Scene{constructor(S,k){const T=S.T;this.S=S;this.k=k;this.T=T;this.g={terrain:new T.Group(),build:new T.Group(),walls:new T.Group(),turrets:new T.Group(),homes:new T.Group()};
  this.meshes=new Map();this.tur=new Map();this.wim=new Map();this.him=new Map();this.wgeo=new Map();this.hgeo=new Map();this.tgeo=new Map();this.keys={};this.anim=[];this.far=false;this.M4=new T.Matrix4();this.root=new T.Group();for(const v of Object.values(this.g))this.root.add(v);}
 cached(m,key,make){let g=m.get(key);if(!g){g=make();m.set(key,g);}return g;}
 keep(){return new Set([...this.wgeo.values(),...this.hgeo.values(),...this.tgeo.values(),this.postG,this.postGL,this.rubG].filter(Boolean));}
 inst(geo,n){const m=new this.T.InstancedMesh(geo,this.S.MAT?.solid||litMaterial(this.T),Math.max(1,n));m.count=n;m.frustumCulled=false;return m;}
 wipe(g){const keep=this.keep();for(const o of [...g.children]){o.traverse(q=>{if(q.geometry&&!q.geometry.userData?.hfShared&&!keep.has(q.geometry))q.geometry.dispose();if(q.isInstancedMesh)q.dispose?.();});}g.clear();}
 footY(site,b){const P=PL(),s=P.sizeOf(b.t,b.r|0);return P.heightAt(site,P.cellX(b.i)+(s.w-1)*P.GRID.cell/2,P.cellZ(b.j)+(s.d-1)*P.GRID.cell/2);}
 sync(p,o={}){const P=PL(),{S,T,k,g}=this,low=!!S.low||!!this.far,M4=this.M4,pl=plan(p),theme=p.theme;this.plan=pl;
  if(this.keys.ter!==terrainKey(p)){this.keys.ter=terrainKey(p);this.wipe(g.terrain);terrain(S,k,p,g.terrain);}
  const want=new Set();this.anim=[];
  for(const [id,b,lvl,building] of pl.buildings){const B=P.BUILDINGS[b.t],key=[b.t,lvl,b.i,b.j,b.r|0,building?1:0,theme?.finish||'',theme?.light||'',p.dmg&&P.ruined(p,id)?1:0].join(':');want.add(id);let e=this.meshes.get(id);
   if(!e||e.key!==key){if(e)this.drop(e);const og=new T.Group(),s2=P.sizeOf(b.t,b.r|0);og.position.set(P.cellX(b.i)+(s2.w-1)*P.GRID.cell/2,this.footY(p.site,b),P.cellZ(b.j)+(s2.d-1)*P.GRID.cell/2);og.rotation.y=-(b.r|0)*Math.PI/2;
    if(lvl>0||building){const m=k.building(b.t,Math.max(1,lvl),theme).mesh();m.userData.id=id;og.add(m);}
    const hd=B?.turret||b.t==='radar'?k.head(b.t,Math.max(1,lvl)).mesh():null;if(hd){hd.position.y=b.t==='radar'?3.3+lvl*.5:1.4+lvl*.15;og.add(hd);og.userData.head=hd;og.userData.radar=b.t==='radar';}
    if(building){const sc=new S.Bld(),s3=P.sizeOf(b.t),W=s3.w*P.GRID.cell,D=s3.d*P.GRID.cell,h=b.t==='cc'?10+p.cc:6;for(const [x,z] of [[-1,-1],[1,-1],[1,1],[-1,1]])sc.box(x*W/2,h/2,z*D/2,.18,h,.18,k.C.amber,.6);for(let y=1.5;y<h;y+=2.2){sc.box(0,y,-D/2,W,.12,.12,k.C.amber,.5);sc.box(0,y,D/2,W,.12,.12,k.C.amber,.5);sc.box(-W/2,y,0,.12,.12,D,k.C.amber,.5);sc.box(W/2,y,0,.12,.12,D,k.C.amber,.5);}
     og.add(sc.mesh());const dr=new S.Bld();for(let q=0;q<3;q++)dr.box(Math.cos(q*2.1)*W*.6,h+1.5,Math.sin(q*2.1)*D*.6,.8,.25,.8,k.C.cyan,2);const drm=dr.mesh();og.add(drm);og.userData.drones=drm;}
    g.build.add(og);e={o:og,key,id,b};this.meshes.set(id,e);}
   if(e.o.userData.drones)this.anim.push(e.o);}
  for(const [id,e] of this.meshes)if(!want.has(id)){this.drop(e);this.meshes.delete(id);}
  // complete turrets: one base and one head draw per turret type and level (a CC10 town has up to 42 turrets)
  const tk=JSON.stringify([[...pl.turrets.values()].flat().map(([id,b])=>[id,b.t,b.l,b.i,b.j]),theme?.finish,theme?.light,p.dmg?Object.keys(p.dmg).filter(x=>!x.startsWith('w:')).join():'']);if(this.keys.tur!==tk){this.keys.tur=tk;this.wipe(g.turrets);this.tur.clear();
   for(const [kk,list] of pl.turrets){const [t,l]=kk.split(':'),tk2=kk+':'+(theme?.finish||'')+(theme?.light||''),bg=this.cached(this.tgeo,tk2+':b',()=>k.building(t,+l,theme).geometry()),hg=this.cached(this.tgeo,tk2+':h',()=>k.head(t,+l).geometry()),base=this.inst(bg,list.length),hd=this.inst(hg,list.length);
    const items=list.map(([id,b],n)=>{const x=P.cellX(b.i),z=P.cellZ(b.j),y=P.groundY(p.site,b.i,b.j);M4.makeTranslation(x,y,z);base.setMatrixAt(n,M4);return {id,x,y:y+1.4+(+l)*.15,z,n,spin:(b.i*7+b.j*3)%6,ruined:!!(p.dmg&&P.ruined(p,id))};});
    base.instanceMatrix.needsUpdate=true;g.turrets.add(base,hd);this.tur.set(kk,{base,hd,items});}}
  // walls: per blend look a NEAR draw (full detail) and a FAR draw (the light geometry), bucketed around a focus point (your
  // tank in the Home Sector, the camera target in build mode); posts and rubble one draw each
  const wk=JSON.stringify(p.w)+!!S.low+JSON.stringify(p.dmg||{});if(this.keys.walls!==wk){this.keys.walls=wk;this.wipe(g.walls);this.wim.clear();this.wcell=new Map();this.hidden=new Set();const lo=!!S.low;
   for(const [c,keys] of pl.walls){const near=this.inst(this.cached(this.wgeo,c+':'+lo,()=>k.wallGeo(c,lo)),keys.length),far=lo?null:this.inst(this.cached(this.wgeo,c+':true',()=>k.wallGeo(c,true)),keys.length);
    const pos=keys.map(kk=>{const [i,j]=kk.split(',').map(Number);return [kk,P.cellX(i),P.groundY(p.site,i,j),P.cellZ(j)];});near.userData.code=c;g.walls.add(near);if(far)g.walls.add(far);this.wim.set(c,{near,far,pos});}
   this.bucket(true);
   if(!this.postG){this.postG=k.postGeo(false);this.postGL=k.postGeo(true);this.rubG=k.rubbleGeo();}
   const pm=this.inst(low?this.postGL:this.postG,pl.posts.length),_q=new T.Quaternion(),_v=new T.Vector3(),_s=new T.Vector3();this.postMesh=pm;this.postAt=new Map();
   pl.posts.forEach((kk,n)=>{const [i,j]=kk.split(',').map(Number),h=k.wallH(p.w[kk])+.9;M4.compose(_v.set(P.cellX(i),P.groundY(p.site,i,j),P.cellZ(j)),_q,_s.set(1,h,1));pm.setMatrixAt(n,M4);this.postAt.set(kk,n);});pm.instanceMatrix.needsUpdate=true;g.walls.add(pm);
   const cap=Math.max(1,pl.rubble.length+Object.keys(p.w||{}).length);const rm=this.inst(this.rubG,cap);rm.count=0;this.rubMesh=rm;for(const kk of pl.rubble)this.addRubble(p,kk);g.walls.add(rm);}
  // settler homes: one instanced draw per home kind
  const hk=[...pl.homes.values()].flat().map(h=>h.id).join()+p.site+p.cc+low;if(this.keys.homes!==hk){this.keys.homes=hk;this.wipe(g.homes);this.him.clear();this.hcell=new Map();
   for(const [kind,list] of pl.homes){const m=this.inst(this.cached(this.hgeo,kind+low,()=>k.home(kind,low)),list.length),_q=new T.Quaternion(),_v=new T.Vector3(),_one=new T.Vector3(1,1,1),up=new T.Vector3(0,1,0);list.forEach((h,n)=>{const x=P.cellX(h.i)+P.GRID.cell/2,z=P.cellZ(h.j)+P.GRID.cell/2;_q.setFromAxisAngle(up,(h.seed%4)*Math.PI/2);M4.compose(_v.set(x,P.heightAt(p.site,x,z),z),_q,_one);m.setMatrixAt(n,M4);this.hcell.set(h.id,[m,n]);});m.instanceMatrix.needsUpdate=true;g.homes.add(m);this.him.set(kind,m);}}
  const ck=JSON.stringify([p.banner,p.theme,p.b.cc?.i,p.b.cc?.j,p.site]);if(this.keys.deco!==ck){this.keys.deco=ck;if(this.deco){g.build.remove(this.deco);this.deco.traverse(q=>{if(!q.geometry?.userData?.hfShared)q.geometry?.dispose?.();});}this.deco=new T.Group();const c=p.b.cc;if(c){const x0=P.cellX(c.i)+6,z0=P.cellZ(c.j)+6;this.deco.position.y=this.footY(p.site,c);
   if(p.banner){const m=k.banner(p.banner,1.6).mesh();m.position.set(x0+7,0,z0-7);this.deco.add(m);}if(p.theme?.decor?.length)this.deco.add(k.decor(p.theme.decor,x0,z0,16,16,p.theme.light).mesh());}g.build.add(this.deco);}
  return pl;}
 addRubble(p,kk){const P=PL(),rm=this.rubMesh;if(!rm||rm.count>=rm.instanceMatrix.count)return;const [i,j]=kk.split(',').map(Number),T=this.T,m=new T.Matrix4().makeRotationY(((i*7+j*13)%4)*Math.PI/2);m.setPosition(P.cellX(i),P.groundY(p.site,i,j),P.cellZ(j));rm.setMatrixAt(rm.count++,m);rm.instanceMatrix.needsUpdate=true;}
 drop(e){const keep=this.keep();this.g.build.remove(e.o);e.o.traverse(q=>{if(!keep.has(q.geometry))q.geometry?.dispose?.();});}
 // the wall LOD: cells within r of the focus use the full wall, the rest the light one (rebucketed when the focus moves 10 m)
 setFocus(x,z,r){this.focus={x,z,r};if(!this.lastFocus||Math.hypot(x-this.lastFocus.x,z-this.lastFocus.z)>=10||r!==this.lastFocus.r)this.bucket(true);}
 bucket(){const f=this.focus||{x:0,z:0,r:1e9},M4=this.M4;this.lastFocus={...f};this.dirty=false;
  for(const w of this.wim.values()){let a=0,b=0;for(const [kk,x,y,z] of w.pos){if(this.hidden?.has(kk))continue;const near=!w.far||Math.hypot(x-f.x,z-f.z)<=f.r,m=near?w.near:w.far,n=near?a++:b++;M4.makeTranslation(x,y,z);m.setMatrixAt(n,M4);this.wcell.set(kk,[m,n]);}
   w.near.count=a;w.near.instanceMatrix.needsUpdate=true;if(w.far){w.far.count=b;w.far.instanceMatrix.needsUpdate=true;}}}
 // homes and wall posts: distance LOD with hysteresis (the lighter geometry when zoomed out; no instance rebuild)
 setFar(far,p){if(far===this.far)return;this.far=far;const lo=!!this.S.low||far,k=this.k;for(const [kind,m] of this.him)m.geometry=this.cached(this.hgeo,kind+lo,()=>k.home(kind,lo));if(this.postMesh)this.postMesh.geometry=lo?this.postGL:this.postG;
  if(p)this.keys.homes=[...plan(p).homes.values()].flat().map(h=>h.id).join()+p.site+p.cc+lo;}
 // a structure falls during a raid replay: walls become rubble, homes and turrets disappear, buildings hide
 hide(id,p){const T=this.T,zero=new T.Matrix4().makeScale(0,0,0);if(id.startsWith('w:')){const kk=id.slice(2);if(!this.wcell?.has(kk)||this.hidden.has(kk))return;this.hidden.add(kk);this.dirty=true;this.addRubble(p,kk);const pn=this.postAt?.get(kk);if(pn!==undefined){this.postMesh.setMatrixAt(pn,zero);this.postMesh.instanceMatrix.needsUpdate=true;}return;}
  const he=this.hcell?.get(id);if(he){he[0].setMatrixAt(he[1],zero);he[0].instanceMatrix.needsUpdate=true;return;}
  for(const t of this.tur.values())for(const it of t.items)if(it.id===id){it.dead=true;t.base.setMatrixAt(it.n,zero);t.base.instanceMatrix.needsUpdate=true;return;}
  const e=this.meshes.get(id);if(e)e.o.visible=false;}
 // turret heads: idle scan, aim during a raid replay, track the pilot's tank when it is near (Home Sector)
 heads(clock,watch){const T=this.T,M4=this.M4,_q=this._q||(this._q=new T.Quaternion()),_v=this._v||(this._v=new T.Vector3()),_s=this._s||(this._s=new T.Vector3()),up=this._up||(this._up=new T.Vector3(0,1,0));
  for(const o of this.meshes.values()){const hd=o.o.userData.head;if(hd)hd.rotation.y=hd.userData.aim??(clock*(o.o.userData.radar?1:.4))%(Math.PI*2);}
  for(const t of this.tur.values()){for(const it of t.items){let a=it.aim;if(a===undefined&&watch&&!it.ruined&&Math.hypot(watch.x-it.x,watch.z-it.z)<45)a=Math.atan2(watch.x-it.x,watch.z-it.z);if(a===undefined)a=(clock*.4+it.spin)%(Math.PI*2);
    it.shown=it.shown===undefined?a:it.shown+Math.atan2(Math.sin(a-it.shown),Math.cos(a-it.shown))*Math.min(1,.12);_q.setFromAxisAngle(up,it.shown);const z=it.dead?0:1;M4.compose(_v.set(it.x,it.y-(it.ruined?.5:0),it.z),_q,_s.set(z,it.ruined?z*.7:z,z));t.hd.setMatrixAt(it.n,M4);}t.hd.instanceMatrix.needsUpdate=true;}
  for(const o of this.anim){const dr=o.userData.drones;dr.rotation.y=clock*1.4;dr.position.y=Math.sin(clock*3)*.4;}if(this.dirty)this.bucket();}
 counts(){let wallCells=0,turrets=0,homes=0;for(const w of this.wim.values())wallCells+=w.near.count+(w.far?w.far.count:0);for(const t of this.tur.values())turrets+=t.base.count;for(const m of this.him.values())homes+=m.count;
  return {wallCells,wallLooks:this.wim.size,turrets,turretGroups:this.tur.size,homes,homeKinds:this.him.size,buildings:this.meshes.size,posts:this.postMesh?.count||0,rubble:this.rubMesh?.count||0};}
 dispose(){this.root.traverse(o=>{if(o.isMesh||o.isInstancedMesh){if(!o.geometry?.userData?.hfShared)o.geometry?.dispose?.();if(o.isInstancedMesh)o.dispose?.();}});for(const m of [this.wgeo,this.hgeo,this.tgeo])for(const gq of m.values())gq.dispose?.();for(const gq of [this.postG,this.postGL,this.rubG])gq?.dispose?.();}}

// ------------------------------------------------------------------- 2D: one pixel per cell ------------------------------
const T2={ground:[43,47,54],lush:[32,58,28],ash:[34,32,36],pass:[58,34,32],ice:[120,160,180],rim:[42,42,48],cliff:[26,27,32],water:[18,58,92],rock:[46,40,36],crevasse:[10,20,30],vent:[110,44,20],deposit:[122,74,44]};
function layer2d(p,cache){const P=PL(),key=p.site+p.cc+JSON.stringify(p.w)+P.homes(p).length+JSON.stringify(p.b)+JSON.stringify(p.dmg||{});if(cache?.key===key)return cache;const n=P.GRID.n,c=cache?.c||(typeof document!=='undefined'?document.createElement('canvas'):null);if(!c)return null;c.width=c.height=n;const g=c.getContext('2d'),img=g.createImageData(n,n),h=P.townH(p.cc);
 const put=(i,j,rgb)=>{if(i<0||j<0||i>=n||j>=n)return;const o=(j*n+i)*4;img.data[o]=rgb[0];img.data[o+1]=rgb[1];img.data[o+2]=rgb[2];img.data[o+3]=255;};
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){const t=T2[P.terrainAt(p.site,i,j)]||T2.ground,f=P.cheb(i,j)<=h?1:.45;put(i,j,t.map(v=>Math.round(v*f)));}
 for(const hm of P.homes(p))for(const [a,b] of [[0,0],[1,0],[0,1],[1,1]])put(hm.i+a,hm.j+b,[150,110,70]);
 for(const [kk,code] of Object.entries(p.w||{})){const [i,j]=kk.split(',').map(Number),{o,l}=P.wdecode(code),c0=ORE_LOOK[o][0],c1=ORE_LOOK[o][1],t=o?l/3*.6:0,mix=k=>Math.round(((c0>>k)&255)*(1-t)+((c1>>k)&255)*t);put(i,j,p.dmg&&P.ruined(p,'w:'+kk)?[60,40,36]:[mix(16),mix(8),mix(0)]);}
 for(const [id,b] of Object.entries(p.b||{})){const s=P.sizeOf(b.t,b.r|0),col=b.t==='cc'?[34,230,255]:P.BUILDINGS[b.t]?.turret?[255,211,107]:P.VITALS[b.t]?[200,170,100]:[150,165,180],hurt=p.dmg&&p.dmg[id]>0;for(let a=0;a<s.w;a++)for(let d=0;d<s.d;d++)put(b.i+a,b.j+d,hurt?[255,70,80]:col);}
 g.putImageData(img,0,0);return {key,c,cc:p.cc};}
// The HUD thumbnail: the town square of the 2D layer, scaled with no smoothing, a red ring when damaged.
function thumb(p,canvas,cache){const P=PL(),L=layer2d(p,cache);if(!L||!canvas)return L;const g=canvas.getContext('2d'),W=canvas.width,H=canvas.height,h=P.townH(p.cc),i0=P.MID-h-1,side=2*h+3,dmg=Object.keys(p.dmg||{}).length>0;
 g.clearRect(0,0,W,H);g.imageSmoothingEnabled=false;g.drawImage(L.c,i0,i0,side,side,2,2,W-4,H-4);g.lineWidth=dmg?3:1.5;g.strokeStyle=dmg?'#ff3048':'#22e6ff99';g.strokeRect(1,1,W-2,H-2);return L;}

// ------------------------------------------------------------------- diorama ---------------------------------------------
// The pilot's actual town as one merged model on a plinth: walls (merged runs by blend, ruined cells low), turrets, vitals,
// the Command Center at its level's height, homes, the banner and a terrain relief of the site. `size` is the plinth side
// (m); heights are exaggerated (ex) so walls and buildings read from the world camera. Two draws (solid + glow).
function diorama(S,k,p,opt={}){const P=PL(),T=S.T,size=opt.size||20,ex=opt.ex||2.2,h=P.townH(p.cc),side=(2*h+3)*P.GRID.cell,s=size/side,base=opt.plinth??1,b=new S.Bld(),C=k.C,site=p.site,cl=(x,z)=>[x*s,z*s];
 const hgt=(x,z)=>base+P.heightAt(site,x,z)*s*ex*.6;
 // plinth: a stepped dark base with a lit edge; the top is the site relief (every second cell on LOW)
 b.box(0,base*.45,0,size+1.6,base*.9,size+1.6,C.dark);b.box(0,base*.92,0,size+1.9,.06,size+1.9,C.cyan,1.1);b.box(0,.12,0,size+1.9,.24,size+1.9,C.dark2);
 const st=opt.low||h>=28?2:1,cs=P.GRID.cell,tc=new T.Color(),i0=P.MID-h-1,i1=P.MID+h+1,lift=opt.bright??2;for(let i=i0;i<=i1;i+=st)for(let j=i0;j<=i1;j+=st){const t=P.terrainAt(site,i,j),inside=P.cheb(i,j)<=h,c0=TCOL[t]||TCOL.ground,f=(inside?lift:lift*.55)*(.92+.16*hashf(i,j,3));tc.setRGB(c0[0]*f,c0[1]*f,c0[2]*f);
  const x0=P.cellX(i)-cs/2,z0=P.cellZ(j)-cs/2,x1=x0+cs*st,z1=z0+cs*st;b.quad([x0*s,hgt(x0,z0),z0*s],[x0*s,hgt(x0,z1),z1*s],[x1*s,hgt(x1,z1),z1*s],[x1*s,hgt(x1,z0),z0*s],tc,0);}
 const e=(h+.5)*cs*s;for(const [x,z,w,d] of [[0,-e,2*e,.08],[0,e,2*e,.08],[-e,0,.08,2*e],[e,0,.08,2*e]])b.box(x,base+.05,z,w,.05,d,C.cyan,1);
 // walls: runs along each row merged into one box per blend (a ruined cell is a low rubble block)
 const w=p.w||{},rows=new Map();let wallCells=0,rubble=0;for(const [kk,c] of Object.entries(w)){const [i,j]=kk.split(',').map(Number);if(!rows.has(j))rows.set(j,[]);rows.get(j).push([i,c|0,!!(p.dmg&&P.ruined(p,'w:'+kk))]);}
 for(const [j,list] of rows){list.sort((a,b2)=>a[0]-b2[0]);let run=null;const flush=()=>{if(!run)return;const n=run.n,x=(P.cellX(run.i)+(n-1)*cs/2),z=P.cellZ(j),[bx,bz]=cl(x,z),y=hgt(x,z),look=ORE_LOOK[run.c?P.wdecode(run.c).o:0];
   if(run.r){b.box(bx,y+.1,bz,n*cs*s,.2,cs*s*.9,new T.Color(0x4a463e));rubble+=n;}else{const hh=k.wallH(run.c)*s*ex,bc=new T.Color(look[0]).multiplyScalar(1.05);b.box(bx,y+hh/2,bz,n*cs*s+.02,hh,cs*s*1.15,bc);b.box(bx,y+hh+.04,bz,n*cs*s+.06,.08,cs*s*1.15+.06,new T.Color(look[1]),look[2]*.9+.6);wallCells+=n;}run=null;};
  for(const [i,c,r] of list){if(run&&run.i+run.n===i&&run.c===c&&run.r===r)run.n++;else{flush();run={i,c,r,n:1};}}flush();}
 // buildings, turrets, vitals, the Command Center (its height grows with the level)
 let turrets=0,buildings=0;for(const [id,bd] of Object.entries(p.b||{})){const lvl=bd.t==='cc'?p.cc:bd.l;if(!(lvl>0)&&!(p.job?.id===id))continue;const sz=P.sizeOf(bd.t,bd.r|0),x=P.cellX(bd.i)+(sz.w-1)*cs/2,z=P.cellZ(bd.j)+(sz.d-1)*cs/2,[bx,bz]=cl(x,z);
  if(p.dmg&&P.ruined(p,id)){b.box(bx,hgt(x,z)+.08,bz,sz.w*cs*s*.9,.16,sz.d*cs*s*.9,new T.Color(0x3a2a26));continue;}k.mini(b,bd.t,Math.max(1,lvl),bx,bz,hgt(x,z),bd.r|0,s,ex*(bd.t==='cc'?1.35:1),p.theme);if(P.BUILDINGS[bd.t]?.turret)turrets++;else buildings++;}
 let homes=0;for(const hm of P.homes(p)){const x=P.cellX(hm.i)+cs/2,z=P.cellZ(hm.j)+cs/2,[bx,bz]=cl(x,z),y=hgt(x,z),pc=C.paint[hm.seed%6];b.box(bx,y+1.2*s*ex,bz,6*s,2.4*s*ex,5*s,pc);b.box(bx,y+2.55*s*ex,bz,6.4*s,.3*s*ex,5.4*s,C.roof);homes++;}
 const g=new T.Group(),solid=S.MAT?new T.Mesh(b.geometry(),S.MAT.solid):new T.Mesh(phong(T,b.geometry()),litMaterial(T));solid.userData.noPick=true;g.add(solid);
 if(p.banner&&opt.banner!==false){const cc=p.b?.cc,bx=cc?(P.cellX(cc.i)+10)*s:size/2-1,bz=cc?(P.cellZ(cc.j)-2)*s:-size/2+1,bm=k.banner(p.banner,opt.bannerScale||Math.max(.35,s*6));const m=S.MAT?bm.mesh():new T.Mesh(phong(T,bm.geometry()),litMaterial(T));m.position.set(bx,cc?hgt(P.cellX(cc.i),P.cellZ(cc.j)):base,bz);m.userData.noPick=true;g.add(m);}
 g.userData.counts={wallCells,rubble,turrets,buildings,homes};g.userData.size=size;g.userData.scale=s;return g;}
const dioramaKey=p=>JSON.stringify([p.site,p.cc,p.b,p.w,p.banner,p.theme,p.dmg||{},p.job?.id||'']);
// A cheap signature of what a picture of the town shows (walls by position and blend, buildings, banner, theme, damage,
// name): the world pad, the HUD thumbnail and the hub redraw only when it changes.
function townSig(p){if(!p)return '';let h=0,n=0;const w=p.w||{};for(const k in w){const c=w[k]|0,i=k.indexOf(','),a=+k.slice(0,i),b=+k.slice(i+1);h=(h+(a*131+b*7+1)*(c+3))%1000000007;n++;}let bs='';const B=p.b||{};for(const id in B){const x=B[id];bs+=id+':'+x.t+':'+x.i+'.'+x.j+'.'+(x.r|0)+'.'+(x.l|0)+';';}
 return [p.site,p.cc,n,h,bs,JSON.stringify(p.banner||0),JSON.stringify(p.theme||0),JSON.stringify(p.dmg||0),p.job?.id||'',p.name||''].join('|');}

// ------------------------------------------------------------------- sprites ---------------------------------------------
// Build-card pictures (buildings, turrets with their heads, wall blends, store items), rendered once per session through the
// view's own renderer with the same style programs and light counts as the town scene (no new shader variants): drawn into
// a corner of the canvas the sheet covers, read back in the same task, keyed transparent and cached as data URLs.
const SPR=new Map();
const spriteKey=(kind,a,b)=>kind+':'+a+':'+(b||0);
// bounds of a small group (the slim three build has no Box3): centre and radius from the vertices
function bounds(T,g){g.updateMatrixWorld(true);const v=new T.Vector3(),lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];g.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i+=3){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);lo[0]=Math.min(lo[0],v.x);lo[1]=Math.min(lo[1],v.y);lo[2]=Math.min(lo[2],v.z);hi[0]=Math.max(hi[0],v.x);hi[1]=Math.max(hi[1],v.y);hi[2]=Math.max(hi[2],v.z);}});
 if(lo[0]>hi[0])return {c:new T.Vector3(),r:1};return {c:new T.Vector3((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2),r:Math.max(.5,Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])*.5)};}
function spriteJob(S,k,renderer){const T=S.T,sc=new T.Scene();sc.fog=new T.Fog(0x000000,5000,6000);sc.background=new T.Color(0);
 const lights=[new T.HemisphereLight(0x8aa6dc,0x2a2632,2.1),new T.DirectionalLight(0xe4ecff,3.2),new T.DirectionalLight(0x52c6ff,1.4)];lights[1].position.set(200,400,150);lights[2].position.set(-300,200,-200);sc.add(...lights);
 const cam=new T.PerspectiveCamera(30,1,.1,500),queue=[];let busy=false;
 const model=(kind,a,b2)=>{const g=new T.Group();if(kind==='b'){if(PL().BUILDINGS[a]?.turret){g.add(k.building(a,b2||1).mesh());const hd=k.head(a,b2||1).mesh();hd.position.y=1.4+(b2||1)*.15;hd.rotation.y=-.7;g.add(hd);}else g.add(k.building(a,b2||1).mesh());if(a==='radar'){const hd=k.head('radar',1).mesh();hd.position.y=3.8;g.add(hd);}}
  else if(kind==='w'){for(const [x,z] of [[-2,0],[2,0],[2,4]]){const m=new T.Mesh(k.wallGeo(a,false),S.MAT.solid);m.position.set(x,0,z);g.add(m);}}
  else if(kind==='s')g.add(storeModel(S,k,a));return g;};
 return {queue,
  want(kind,a,b2){const key=spriteKey(kind,a,b2);if(SPR.has(key))return SPR.get(key);if(!queue.some(q=>q.key===key))queue.push({key,kind,a,b:b2});return null;},
  // render up to n queued sprites into the canvas's bottom-left corner (under the sheet); returns the keys done
  run(n=2,px=72){if(busy||!queue.length||!renderer?.getContext)return [];busy=true;const done=[];try{const gl=renderer.getContext(),pr=renderer.getPixelRatio?.()||1,W=Math.round(px*pr),buf=new Uint8Array(W*W*4);
   for(let q=0;q<n&&queue.length;q++){const it=queue.shift(),g=model(it.kind,it.a,it.b);sc.add(g);const {c,r}=bounds(T,g);
    cam.position.set(c.x+r*1.9,c.y+r*1.5,c.z+r*2.6);cam.lookAt(c);cam.aspect=1;cam.updateProjectionMatrix();S.viewLights?.(cam);renderer.setScissorTest(true);renderer.setViewport(0,0,px,px);renderer.setScissor(0,0,px,px);renderer.setClearColor(0x000000,1);renderer.clear();renderer.render(sc,cam);
    gl.readPixels(0,0,W,W,gl.RGBA,gl.UNSIGNED_BYTE,buf);renderer.clear();renderer.setScissorTest(false);sc.remove(g);g.traverse(o=>{if(o.geometry&&!o.geometry.userData?.hfShared)o.geometry.dispose();});
    const cv=document.createElement('canvas');cv.width=cv.height=W;const x=cv.getContext('2d'),img=x.createImageData(W,W);for(let y=0;y<W;y++)for(let i=0;i<W;i++){const s=((W-1-y)*W+i)*4,d=(y*W+i)*4,l=buf[s]+buf[s+1]+buf[s+2];img.data[d]=buf[s];img.data[d+1]=buf[s+1];img.data[d+2]=buf[s+2];img.data[d+3]=Math.min(255,l*6);}
    x.putImageData(img,0,0);SPR.set(it.key,cv.toDataURL('image/png'));done.push(it.key);}}catch(e){queue.length=0;}finally{busy=false;}return done;},
  dispose(){sc.clear();}};}
// Store previews (every item in ConquestPlot.STORE has its own picture, ready for the day checkout opens).
function storeModel(S,k,id){const T=S.T,g=new T.Group(),P=PL(),add=(geo,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,S.MAT.solid);m.position.set(x,y,z);g.add(m);return m;};
 if(id==='wall-ext-10'){for(let n=0;n<3;n++)add(k.wallGeo(P.wcode(2,2),false),(n-1)*4,0,0);const b=new S.Bld();b.box(0,6.4,0,1.2,3.4,.4,k.C.gold,1.6);b.box(0,6.4,0,3.4,1.2,.4,k.C.gold,1.6);add(b.geometry());}
 else if(id==='skin-gilded'){const b=new S.Bld();for(let n=0;n<3;n++){b.box((n-1)*4,1.6,0,4,3.2,4,k.C.gold,.25);b.box((n-1)*4,3.3,0,4.1,.2,4.1,new T.Color(0xfff1b8),1.4);}add(b.geometry());}
 else if(id==='skin-turret-neon'){for(const [t,x] of [['cannon',-2.6],['laser',2.6]]){const b=k.building(t,3);b.box(0,1.9,0,2.2,.12,2.2,k.C.mag,2);add(b.geometry(),x);const h=add(k.head(t,3).geometry(),x,1.85,0);h.rotation.y=-.6;}}
 else if(id==='foundry-rush'){add(k.building('foundry',3).geometry());const b=new S.Bld();for(let n=0;n<3;n++)b.box(-4+n*1.3,7+n*.6,3,.9,.25,.25,k.C.amber,2);add(b.geometry());}
 else if(id==='builder-2'){const b=new S.Bld();for(const x of [-3,3]){b.box(x,3.2,0,1.6,.45,1.6,k.C.cyan,2);b.box(x,2.2,0,.3,1.6,.3,k.C.mid);}for(const [x,z] of [[-1,-1],[1,-1],[1,1],[-1,1]])b.box(x*4,2.5,z*3,.18,5,.18,k.C.amber,.6);add(b.geometry());}
 else if(id==='theme-aurora'){add(k.building('cc',4,{light:'violet',finish:'graphite'}).geometry());const b=new S.Bld();for(let n=0;n<5;n++)b.box(-6+n*3,12+Math.sin(n)*1.2,-5,2.6,.25,.4,[k.C.teal,k.C.violet,k.C.cyan][n%3],2);add(b.geometry());}
 else if(id==='layout-4'){const b=new S.Bld();for(let n=0;n<4;n++)b.box((n%2)*5-2.5,.3,Math.floor(n/2)*5-2.5,4.2,.6,4.2,n===3?k.C.gold:k.C.mid,n===3?1:0);add(b.geometry());}
 else add(k.building('trophy',2).geometry());
 return g;}

root.ConquestTownKit=Object.freeze({ORE_LOOK,GLYPH,TCOL,lite,kit,litMaterial,phong,plan,counts,terrain,terrainKey,roadCells,plazaOf,groundAt,damageEmitters,puffs,Scene,layer2d,thumb,diorama,dioramaKey,spriteJob,spriteKey,storeModel,SPRITES:SPR,townSig});
})(globalThis);
