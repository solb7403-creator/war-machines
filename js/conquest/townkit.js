/* Shared town kit (Session 5C): the pilot's town built once, the same way, wherever it is shown. The town screen and the
   Home Sector (one scene: build mode is a camera there), the 1/4-style diorama at the shared world's Command Gate, the hub
   hero and the card sprites all use these builders with the Conquest style programs (js/conquest/style.js), so a wall,
   turret or home looks identical everywhere and costs no new shader programs. Presentation only: plot state comes from the
   Worker (js/conquest/plot.js validates every change).
   - kit(S): models (buildings by type and level, turret heads, wall cells by blend, corner posts, rubble, settler homes,
     crew, rovers, raiders, banner, decorations)
   - terrain(S,site,cc,p,o): ground with the town plaza, dust roads to each lane, cell texture, terraces, lakes and cliffs,
     the thin cyan town edge and red hazard chevrons on the raider lanes
   - plan(p): the pure instance plan (walls by blend, posts, rubble, turrets by type and level, homes by kind)
   - walls / turrets / homes: instanced draws from a plan (one per blend look, one base + one head per turret type and level)
   - diorama(S,p,o): a scaled, mostly merged copy of the town for the world pad and the hub (about a dozen draws)
   - layer2d(p): one pixel per cell (terrain, walls by blend, homes) for the 2D view, the HUD thumbnail and the share card */
(function(root){
'use strict';
const P=root.ConquestPlot;
const wallH=code=>{const {o,l}=P.wdecode(code);return 2.6+1.3*P.blendQ(o,l);};
// wall look per ore (index 0 = composite): body colour, accent colour, accent glow
const ORE_LOOK=[[0x8a8f92,0x6a6f72,0],[0x8a8f92,0xa0522d,.15],[0x4a4f58,0xcfe6f0,.55],[0x1e2638,0x22e6ff,1],[0x15131c,0xc9a227,1.1],[0xcfe6f0,0xffffff,1.5],[0xb3122e,0xe0304a,2.2]];   // 5E-2d1 (critic round 3): the same material families as the rebuilt 3D wall tiers (concrete, rusted concrete, steel, dark stone, obsidian + gold, pale glass, ruby), so the map, the thumbnail and the blend buttons match the walls
// ------------------------------------------------------------------- 3D models (style kit) -----------------------------
function kit(S){const T=S.T,K=S.K,G=S.G,lin=h=>new T.Color(h),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3();
 const M=(x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>{_e.set(rx,ry,rz);_q.setFromEuler(_e);return new T.Matrix4().compose(_p.set(x,y,z),_q,_s.set(sx,sy,sz));};
 const C={rust:lin(0x7a4a2c),sand:lin(0x8f7c62),moss:lin(0x3f5a2a),plant:lin(0x3fae4a),glass:lin(0x78aed0),furnace:lin(0xff8a3d),steel:lin(0x6d7884),timber:lin(0x6a4a2e),timberD:lin(0x4a3220),comp:lin(0x8a8676),warm:lin(0xffc47a),
  paint:[lin(0x9a5a3a),lin(0x5a7a8a),lin(0xc9a04a),lin(0x6a8a4a),lin(0x7a6a52),lin(0xbcae8c)],gold:K.gold,cyan:K.cyan,amber:K.amber,dark:lin(0x353d49),dark2:lin(0x404a57),apron:lin(0x7d848d),mid:K.mid,panel:K.panelA,panelB:K.panelB,roof:K.roof,violet:K.violet,red:K.red,teal:K.teal,ice:K.ice,par:K.par};
 const LIGHT={cyan:K.cyan,amber:K.amber,violet:K.violet,green:K.teal,red:K.red};let themeLight=null;
 const accent=l=>l>=5?C.gold:themeLight||(l>=3?C.teal:C.cyan);
// Session 5E-2d1 (owner, Nov 11 + Nov 19): every town model is a slot of the world kit (js/conquest/slots.js, kit/town.js,
 // kit/settler.js), rebuilt to the detail of the owner's Meshy town items. The functions below keep their old shape (a
 // builder or a geometry at the local origin, footprint centred, facing +z) so every town view draws the same models.
 const IDENT=new T.Matrix4(),WKk=()=>root.ConquestWorldKit.kit(S),LHEX={cyan:0x22e6ff,amber:0xffb347,violet:0xa07bff,green:0x2dffc4,red:0xff3048};
 const kb=(id,o)=>{const b=new S.Bld();WKk().place(id,{main:b,det:b,fx:null},IDENT,o||{});return b;};
 const tpar=(type,l,theme,extra)=>{const s=P.sizeOf(type,0),c=P.GRID.cell,Lv=Math.max(1,l|0),o={w:s.w*c,d:s.d*c,level:Lv};if(theme?.finish==='sand'||theme?.finish==='graphite')o.finish=theme.finish;if(theme?.light&&LHEX[theme.light]&&Lv<5)o.accent=LHEX[theme.light];return Object.assign(o,extra||{});};
 // A building at the local origin, footprint centred, facing +z; every level visibly changes it. A turret: its pedestal.
 function building(type,l,theme){if(!root.ConquestWorldKit.MODELS['town-'+type])return new S.Bld();return kb('town-'+type,tpar(type,l,theme,P.BUILDINGS[type]?.turret?{part:'base'}:null));}
 // The rotating head of every turret type (and the radar dish): its own silhouette, so each role reads at a glance.
 // where a head's pivot stands above its building's ground: the radar dish on its mast, a turret head on its low disc
 const headY=(type,l)=>type==='radar'?3.3+Math.max(1,l|0)*.5:.86;
 function head(type,l){return type==='radar'?kb('town-radar-dish',{level:Math.max(1,l|0)}):root.ConquestWorldKit.MODELS['town-'+type]?kb('town-'+type,tpar(type,l,null,{part:'head'})):new S.Bld();}
 // One wall cell (4 m square) read as a fortification at every distance: the kit's town-wall per ore blend (heavier blends
 // stand taller), the corner post, the ruined cell. low = the far / LOW model (silhouette, coping light, one ore band).
 const wpar=(code,low,extra)=>{const {o,l}=P.wdecode(code);return Object.assign({ore:o,lvl:Math.max(1,l),h:Math.round(wallH(code)*100)/100,lod:low?1:0},extra||{});};
 function wallGeo(code,low){return kb('town-wall',wpar(code,low)).geometry();}
 // Diorama shapes (a 27 m model of the whole town): the far wall cell with its light turned down, the far post.
 function wallMini(code){return kb('town-wall',wpar(code,true,{mini:1})).geometry();}
 function postMini(){return kb('town-post',{lod:1}).geometry();}
 // A corner post every 6 cells along a run and at its ends (visual only): a taller pier with a light. One instanced draw.
 function post(low){return kb('town-post',{lod:low?1:0}).geometry();}
 // A ruined wall cell: rubble and a stub, not a hole.
 function rubble(){return kb('town-rubble',{}).geometry();}
 // Settler homes and town structures (the settler kit: patched prefab domes, habitat blocks, water towers, greenhouses,
 // market stalls; warm amber lights). A 2x2 lot (8 m), centred at the origin.
 function home(kind,low){return kb('town-home-'+(['dome','block','tower','green'].includes(kind)?kind:'shop'),{lod:low?1:0,seed:kind.length}).geometry();}
 function person(){return kb('town-person',{}).geometry();}
 function rover(){return kb('town-rover',{}).geometry();}
 // The town raiders (Session 5E-2d2; owner, Nov 21): the light town models of the Parasite units (js/conquest/kit/parunits.js,
 // o.town): r the Scavenger, s the Hoard Fortress, d the stolen drone, w the Grabber, b the Wrecker. One instanced draw per
 // kind in the town view; the front faces +z; the same footprints as before.
 const FOE={r:'par-raider',s:'par-sentinel',d:'par-drone',w:'par-swarm',b:'par-brute'};
 function foe(kind){return kb(FOE[kind]||FOE.r,{town:1}).geometry();}
 // Banner: mast + two-colour flag in the chosen shape, emblem as a small lit mark. Shared by the base and the tank.
 function banner(bn,scale=1){const b=new S.Bld(),c1=new T.Color(bn.colors[0]),c2=new T.Color(bn.colors[1]),h=6*scale,w=2.6*scale,fh=1.7*scale;b.box(0,h/2,0,.16*scale,h,.16*scale,C.dark);
  if(bn.shape==='pennant'){b.add(G.cone5,M(w/2,h-fh/2,0,0,0,-Math.PI/2,fh/2,w,.08*scale),c1);b.box(w*.25,h-fh/2,0,w*.5,fh*.18,.1*scale,c2);}
  else if(bn.shape==='chevron'){b.box(w/2,h-fh/2,0,w,fh,.08*scale,c1);b.box(w/2,h-fh*.5,0,w*.7,fh*.2,.1*scale,c2,0,0);b.add(G.box,M(w*.75,h-fh*.62,0,0,0,.6,w*.45,fh*.16,.1*scale),c2);}
  else if(bn.shape==='square'){b.box(w/2,h-fh/2,0,w,fh,.08*scale,c1);b.box(w/2,h-fh/2,0,w*.9,fh*.12,.1*scale,c2);}
  else{b.box(w/2,h-fh*.45,0,w,fh*.9,.08*scale,c1);b.add(G.cone5,M(w/2,h-fh*.9,0,Math.PI,0,0,w*.5,fh*.4,.07*scale),c1);b.box(w/2,h-fh*.45,0,w*.12,fh*.9,.1*scale,c2);}
  b.add(G.octa,M(w/2,h-fh*.45,.08*scale,0,0,0,.28*scale,.28*scale,.06*scale),c2,1.6);return b;}
 function decor(list,x0,z0,W,D,light){const b=new S.Bld(),tg={main:b,det:b,fx:null},acc=LHEX[light],Kk=WKk();list.forEach((d,i)=>{const a=i/Math.max(1,list.length)*Math.PI*2,x=x0+Math.cos(a)*(W/2+3),z=z0+Math.sin(a)*(D/2+3);
  if(root.ConquestWorldKit.MODELS['decor-'+d])Kk.place('decor-'+d,tg,Kk.M(x,0,z,Math.PI/2-a),acc?{accent:acc}:{});});return b;}
 return {T,M,C,building,head,headY,wallGeo,wallMini,post,postMini,rubble,home,person,rover,foe,lin,banner,decor};}

const KITS=new WeakMap();function kitFor(S){let k=KITS.get(S);if(!k){k=kit(S);KITS.set(S,k);}return k;}

// ------------------------------------------------------------------- ground ------------------------------------------------
// Readability pass (5C audit: "the town reads as a dark slab with dots"): brighter ground inside the town edge (the scene's
// hemisphere light is shared, so the town gets it through brighter ground colours), a lit paved plaza around the Command
// Center, dust roads from the plaza toward each raider lane, a subtle cell texture, slope shading on terraces, lakes and
// cliffs. Raider lanes: red hazard chevrons pointing inward with a faint glow, never brick strips. Town edge: thin cyan line.
const TCOL={ground:[.15,.145,.14],lush:[.1,.17,.07],ash:[.11,.1,.11],pass:[.17,.14,.12],ice:[.42,.55,.62],rim:[.12,.114,.108],cliff:[.1,.1,.106],water:[.03,.08,.14],rock:[.1,.09,.085],crevasse:[.02,.04,.06],vent:[.22,.09,.045],deposit:[.26,.13,.06]};
const PLAZA=[.3,.31,.33],ROAD=[.34,.285,.215];
const ccCenter=p=>{const c=p?.b?.cc;if(!c)return {x:0,z:0,w:4,d:4};const s=P.sizeOf('cc',c.r|0);return {x:P.cellX(c.i)+(s.w-1)*P.GRID.cell/2,z:P.cellZ(c.j)+(s.d-1)*P.GRID.cell/2,w:s.w,d:s.d};};
// lanes: the centroid of each raider gathering cluster (just outside the town edge) and its inward direction
function lanesOf(site,cc){return P.spawnCells(site,cc).map(cl=>{let x=0,z=0;for(const [i,j] of cl){x+=P.cellX(i);z+=P.cellZ(j);}x/=cl.length;z/=cl.length;const L=Math.hypot(x,z)||1;return {x,z,dx:-x/L,dz:-z/L,cells:cl};});}
const segD=(px,pz,ax,az,bx,bz)=>{const vx=bx-ax,vz=bz-az,t=Math.max(0,Math.min(1,((px-ax)*vx+(pz-az)*vz)/(vx*vx+vz*vz||1)));return Math.hypot(px-ax-vx*t,pz-az-vz*t);};
// smooth value noise for regolith mottling (no grid pattern)
const hsh=(i,j)=>{let h=(Math.imul(i,374761393)+Math.imul(j,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
const vn=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return (hsh(i,j)*(1-u)+hsh(i+1,j)*u)*(1-v)+(hsh(i,j+1)*(1-u)+hsh(i+1,j+1)*u)*v-.5;};
const sstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// 5C Max visual pass: one smooth, indexed ground (per-vertex colour and real normals, so terraces shade by the light and
// nothing reads as a checkerboard): regolith mottled at two scales, lifted and warmed inside the town edge (falling off
// softly outside), soft-edged dust roads from the plaza to each lane; then a paved plaza (slab, joints, curb, amber edge
// lights, light pools), street lamps with pools along the roads, water/ice/rocks/vents, the thin cyan edge and the lane chevrons.
function terrain(S,site,cc,p,o={}){const fl=o.floor,hAt=(x,z)=>{const h=P.heightAt(site,x,z);return fl!=null&&h<fl?fl:h;},gY=(i,j)=>{const h=P.groundY(site,i,j);return fl!=null&&h<fl?fl:h;};   // o.floor: the diorama flattens deep terraces (its block must stay low)
const T=S.T,k=kitFor(S),n=P.GRID.n,c=P.GRID.cell,half=n*c/2,step=o.step||4,H0=P.townH(cc),edge=(H0+.5)*c,clip=o.clip||half+(o.ext??60),out=[];
 const C0=ccCenter(p),plaza=Math.max(C0.w,C0.d)*c/2+9+.6*(cc-1),lanes=lanesOf(site,cc),roads=lanes.map(L=>[C0.x,C0.z,L.x,L.z]);
 const H=(x,z)=>Math.abs(x)>half+2||Math.abs(z)>half+2?hAt(Math.sign(x)*Math.min(Math.abs(x),half),Math.sign(z)*Math.min(Math.abs(z),half))+(site==='canyon'?8:2)+vn(x*.05,z*.05)*3:hAt(x,z);
 const tint=site==='delta'?[.9,1,.8]:site==='crater'?[1.02,.97,.93]:site==='plateau'?[1.16,1.05,.84]:site==='ash'?[.8,.79,.84]:site==='ice'?[1.1,1.22,1.36]:site==='canyon'?[1.36,.86,.6]:site==='ridge'?[.95,.96,1.02]:[1,.98,1.02];   // owner gate: each site its own regolith. 5E-2d1 (critic round 3: six of seven sites looked alike): pushed apart (ash dark cool grey, canyon red rock, ice pale blue, plateau sand, ridge grey)
 const lowK=S.low?2.2:1;   // 5E-2d1 (reviewer 1): LOW has no soil surface, so its ground mottling is stronger and has one finer layer (it was a blank gradient)
 const h00=H(0,0),WK0=root.ConquestWorldKit,aSoil=WK0?WK0.surfA(WK0.SURF.dirt,0):0,Kk=WK0?WK0.kit(S):null,lampT={main:null,det:null,fx:null};   // 5E-2d1: the ground carries the soil surface code (HIGH: mottled, grained; it was one flat gradient)
 const col=(x,z)=>{const i=Math.max(0,Math.min(n-1,Math.round(x/c+(n-1)/2))),j=Math.max(0,Math.min(n-1,Math.round(z/c+(n-1)/2))),off=Math.abs(x)>half+2||Math.abs(z)>half+2,t=off?'rim':P.terrainAt(site,i,j),open=!P.NOBUILD[t];let base=TCOL[t]||TCOL.ground;
  const d=Math.max(Math.abs(x),Math.abs(z)),inside=sstep(edge+40,edge-8,d),lift=1.2+.87*inside,band=site==='ridge'||site==='plateau'||site==='canyon'?Math.max(-.14,Math.min(.14,(H(x,z)-h00)*.012)):0,mot=(1+lowK*(.09*vn(x*.03,z*.03)+.045*vn(x*.11+7,z*.11+3))+(S.low?.14*vn(x*.21+3,z*.21+7):0)+.11*vn(x*.009+3,z*.009+5)+band)*(open&&vn(x*.045+11,z*.045+9)>.31?.84:1);   // 5D: a slow octave, height banding on terraced sites and sparse darker patches, so the ground outside the roads is not one tone
  let r=base[0]*lift*mot*tint[0],g=base[1]*lift*mot*tint[1],bb=base[2]*lift*mot*tint[2];
  if(open&&inside>.3){let rd=99;for(const q of roads)rd=Math.min(rd,segD(x,z,q[0],q[1],q[2],q[3]));const w=sstep(7.5,4,rd)*inside;if(w>0){const R2=ROAD[0]*1.7,G2=ROAD[1]*1.7,B2=ROAD[2]*1.7;r+=(R2-r)*w;g+=(G2-g)*w;bb+=(B2-bb)*w;}
   const wl=inside*(1-sstep(plaza+6,plaza+26,Math.max(Math.abs(x-C0.x),Math.abs(z-C0.z))))*.07;r+=wl*.5;g+=wl*.38;bb+=wl*.22;
   const pk=sstep(edge-11,edge-8,d)*(1-sstep(edge-5,edge-2,d))*.5;if(pk>0){r+=(ROAD[0]*1.5-r)*pk;g+=(ROAD[1]*1.5-g)*pk;bb+=(ROAD[2]*1.5-bb)*pk;}}   // warm spill from the lit plaza; 5E-2d1: a worn patrol track just inside the town edge
  return [r,g,bb];};
 {const N=Math.ceil(2*clip/step-1e-6)+1,st=2*clip/(N-1),Pp=new Float32Array(N*N*3),A=new Float32Array(N*N*4),I=[];for(let a2=0;a2<N;a2++)for(let b2=0;b2<N;b2++){const x=-clip+a2*st,z=-clip+b2*st,v=a2*N+b2,cl=col(x,z);Pp.set([x,H(x,z),z],v*3);A.set([cl[0],cl[1],cl[2],aSoil],v*4);}
  for(let a2=0;a2<N-1;a2++)for(let b2=0;b2<N-1;b2++){const v=a2*N+b2;I.push(v,v+1,v+N+1,v,v+N+1,v+N);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(Pp,3));g.setAttribute('aCol',new T.BufferAttribute(A,4));g.setIndex(I);g.computeVertexNormals();g.computeBoundingSphere();out.push(new T.Mesh(g,S.MAT.solid));}
 // owner gate: the far land (one low-poly ring from just under the ground's edge out to ~1.15 km): hills rise to a skyline
 // that fades into the zone's haze, so the town never ends at a visible map edge (drive view, tour, share card).
 if(o.far!==false){const A2=72,RN=10,R1=1150,amp=site==='canyon'?110:site==='crater'?80:site==='ridge'?75:site==='plateau'?55:60,Pp=[],Cc=[],I2=[];
  for(let a2=0;a2<=A2;a2++){const th=a2/A2*Math.PI*2,ct=Math.cos(th),st2=Math.sin(th),rin=(clip-6)/Math.max(Math.abs(ct),Math.abs(st2)),hin=H(ct*rin,st2*rin)-.6;
   for(let r2=0;r2<RN;r2++){const f=r2/(RN-1),r=rin+(R1-rin)*f*f,x=ct*r,z=st2*r,pk=Math.pow(1-Math.abs(vn(11+5.5*ct,3+5.5*st2)*2),3),hill=amp*sstep(rin+25,rin+430,r)*(.45+.35*(vn(5+2.6*ct,7+2.6*st2+f*2)+.5)+.6*pk)+6*vn(x*.012,z*.012)*sstep(rin,rin+40,r);
    Pp.push(x,hin+hill,z);const base=TCOL.rim,m=(.95+.14*vn(x*.02,z*.02))*(1-.3*sstep(rin,R1,r));Cc.push(base[0]*.95*m*tint[0],base[1]*.95*m*tint[1],base[2]*.95*m*tint[2],0);}}
  for(let a2=0;a2<A2;a2++)for(let r2=0;r2<RN-1;r2++){const v=a2*RN+r2;I2.push(v,v+RN,v+1,v+1,v+RN,v+RN+1);}
  const g2=new T.BufferGeometry();g2.setAttribute('position',new T.Float32BufferAttribute(Pp,3));g2.setAttribute('aCol',new T.Float32BufferAttribute(Cc,4));g2.setIndex(I2);g2.computeVertexNormals();g2.computeBoundingSphere();const fm=new T.Mesh(g2,S.MAT.solid);fm.name='cq-town-far';out.push(fm);}
 const pr=new S.Bld(),lamp=(x,y,z,ry,s)=>{if(!Kk){pr.box(x,y+2.3,z,.3,4.6,.3,k.C.dark);pr.box(x,y+4.7,z,.9,.25,.9,k.C.amber,2.2);return;}lampT.main=lampT.det=pr;Kk.place('decor-lamps',lampT,Kk.M(x,y,z,ry,s),{accent:0xffb347});},   // 5E-2d1: yard and street lamps are the kit's town lamp (a square stick with a cube cap stood next to the Meshy items)
  fx=o.glow!==false?new S.Fx():null,reg=S.AT.BLOB||S.AT.SOLID,wc=new T.Color(.09,.23,.34),ic=new T.Color(.55,.72,.82),lim=Math.ceil(clip/c);for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(Math.abs(i-P.MID)>lim||Math.abs(j-P.MID)>lim)continue;const t=P.terrainAt(site,i,j),x=P.cellX(i),z=P.cellZ(j),y=gY(i,j);
  if(t==='water')pr.box(x,-.35,z,c,.1,c,wc,.35);else if(t==='ice')pr.box(x,y+.06,z,c,.08,c,ic,.12);else if(o.props!==false&&t==='rock'&&(i+j)%2===0)pr.add(S.G.rock,k.M(x+1,y+.6,z+1,0,i*j,0,2.2,1.6,2.2),k.C.rust.clone().multiplyScalar(.6));else if(t==='vent')pr.add(S.G.cone6,k.M(x,y,z,0,i,0,1.6,1.4,1.6),k.C.furnace,.8);}
 if(o.props!==false&&o.far!==false)for(let q=0;q<56;q++){const a=hsh(q,7)*Math.PI*2,r=edge+14+hsh(q,13)*(clip-edge-24),x=Math.cos(a)*r,z=Math.sin(a)*r,sz=1.2+hsh(q,29)*2.6;pr.add(S.G.rock,k.M(x,H(x,z)+sz*.25,z,hsh(q,3)*.4,q,0,sz*1.5,sz,sz*1.2),k.C.rust.clone().multiplyScalar(.55+.25*hsh(q,5)));}
 if(site==='crater'&&o.props!==false)for(const d of P.RIM_DEPOSITS){for(let k2=0;k2<6;k2++)pr.add(S.G.rock,k.M(P.cellX(d.i)+2+(k2%3-1)*1.6,.4,P.cellZ(d.j)+2+(k2>2?1.2:-1.2),0,k2,0,1.1,.8,1.1),k.C.rust);pr.box(P.cellX(d.i)+2,.05,P.cellZ(d.j)+2,7,.08,7,k.C.amber,.5);}
 // the plaza: a paved slab with joints every 4 m, a dark curb with an amber light line, four lamp posts and warm light pools
 {const P2=plaza,pave=new T.Color(.38,.375,.37),gh=(x,z)=>hAt(x,z),hi=(x,z,r)=>Math.max(gh(x-r,z-r),gh(x+r,z-r),gh(x-r,z+r),gh(x+r,z+r),gh(x,z)),y0=gh(C0.x,C0.z),nT=Math.max(1,Math.round(2*P2/4)),tw=2*P2/nT;
  for(let a=0;a<nT;a++)for(let b=0;b<nT;b++){const x=C0.x-P2+(a+.5)*tw,z=C0.z-P2+(b+.5)*tw,ti=Math.round(x/c+P.MID),tj=Math.round(z/c+P.MID);if(!P.inGrid(ti,tj)||P.NOBUILD[P.terrainAt(site,ti,tj)])continue;pr.box(x,hi(x,z,tw/2)+.07,z,tw-.1,.14,tw-.1,pave,.08);}   // the 10 cm gaps are the joints
  for(let q=0;q<nT;q++){const u=-P2+(q+.5)*tw;for(const [x,z,w,d] of [[u,-P2,tw+.02,.6],[u,P2,tw+.02,.6],[-P2,u,.6,tw+.02],[P2,u,.6,tw+.02]]){const X2=C0.x+x,Z2=C0.z+z,yy=hi(X2,Z2,.3);pr.box(X2,yy+.2,Z2,w,.4,d,k.C.dark2);pr.box(X2,yy+.42,Z2,w*.98,.05,d*.4,k.C.amber,1.3);}}
  for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1],...(cc>=5?[[0,-1],[1,0],[0,1],[-1,0]]:[])]){const x=C0.x+sx*(P2-1.5),z=C0.z+sz*(P2-1.5),v=.85+.3*hsh(Math.round(x),Math.round(z)),yl=gh(x,z);lamp(x,yl,z,Math.atan2(-sx,-sz),1.4);fx?.flat(x-sx*3,gh(x-sx*3,z-sz*3)+.22,z-sz*3,7,7,reg,[.16*v,.105*v,.042*v],0);}
  fx?.flat(C0.x,y0+.2,C0.z,P2*.9,P2*.9,reg,[.07,.055,.03],0);}
 // street lamps every ~22 m along each road inside the town, each with a warm pool of light
 for(const q of roads){const L=Math.hypot(q[2]-q[0],q[3]-q[1])||1,ux=(q[2]-q[0])/L,uz=(q[3]-q[1])/L;for(let d=plaza+10;d<L;d+=22){const x=q[0]+ux*d-uz*4.5,z=q[1]+uz*d+ux*4.5;if(Math.max(Math.abs(x),Math.abs(z))>edge-2)break;const i=Math.round(x/c+P.MID),j=Math.round(z/c+P.MID);if(!P.inGrid(i,j)||P.NOBUILD[P.terrainAt(site,i,j)])continue;const y=hAt(x,z);
  if(Kk)lamp(x,y,z,Math.atan2(ux,uz),1.25);else{pr.box(x,y+.15,z,.7,.3,.7,k.C.dark2);pr.box(x,y+2.1,z,.22,4.2,.22,k.C.dark);pr.box(x+uz*.9,y+4.12,z-ux*.9,.5,.08,.3,k.C.amber,2.4,Math.atan2(ux,uz));}{const v=.8+.4*hsh(Math.round(x),Math.round(z));fx?.flat(x+uz*.9,y+.18,z-ux*.9,5,5,reg,[.15*v,.095*v,.036*v],0);}}}
 // 5E-2d1 (critic round 3: "the ground outside the paved core is blank"): two wheel ruts along every dust road, and on HIGH
 // loose stones in a few open cells (under 0.3 m: a building's slab covers them, tracks roll over them)
 {const rut=new T.Color(ROAD[0]*1.05,ROAD[1]*1.02,ROAD[2]*1.0),stone=new T.Color(TCOL.ground[0]*1.5*tint[0],TCOL.ground[1]*1.5*tint[1],TCOL.ground[2]*1.5*tint[2]);for(const q of roads){const L=Math.hypot(q[2]-q[0],q[3]-q[1])||1,ux=(q[2]-q[0])/L,uz=(q[3]-q[1])/L,an=Math.atan2(ux,uz);for(let d=plaza+2;d<L-2;d+=4)for(const sd of [-1.15,1.15]){const x=q[0]+ux*(d+2)-uz*sd,z=q[1]+uz*(d+2)+ux*sd;if(Math.max(Math.abs(x),Math.abs(z))>edge-1)continue;const i=Math.round(x/c+P.MID),j=Math.round(z/c+P.MID);if(!P.inGrid(i,j)||P.NOBUILD[P.terrainAt(site,i,j)])continue;pr.box(x,hAt(x,z)+.02,z,.34,.05,4.15,rut,0,an);}}
  if(!S.low&&o.props!==false)for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(Math.abs(i-P.MID)>lim||Math.abs(j-P.MID)>lim||hsh(i*31+7,j*17+3)>.05)continue;const t0=P.terrainAt(site,i,j);if(P.NOBUILD[t0]||t0==='ice')continue;const x0=P.cellX(i),z0=P.cellZ(j);if(Math.max(Math.abs(x0-C0.x),Math.abs(z0-C0.z))<plaza+3)continue;
   for(let q=0;q<3;q++){const x=x0+(hsh(i+q*5,j)-.5)*3,z=z0+(hsh(i,j+q*7)-.5)*3,sz=.22+.2*hsh(i+q,j+q);pr.add(S.G.rock,k.M(x,hAt(x,z)+sz*.18,z,0,q*2.1+i,0,sz*1.3,sz*.62,sz),stone.clone().multiplyScalar(.8+.4*hsh(q,i+j)));}}}
 {const sg=4,nS=Math.max(1,Math.round(2*edge/sg)),L2=(P.GRID.n/2-.5)*c,gh=(x,z)=>hAt(Math.max(-L2,Math.min(L2,x)),Math.max(-L2,Math.min(L2,z)));for(let q=0;q<nS;q++){const u=-edge+(q+.5)*2*edge/nS,w2=2*edge/nS+.05;for(const [x,z,w,d] of [[u,-edge,w2,.32],[u,edge,w2,.32],[-edge,u,.32,w2],[edge,u,.32,w2]])pr.box(x,gh(x,z)+.16,z,w,.06,d,k.C.cyan,.5);}}   // draped on the ground
 for(const L of lanes){const ang=Math.atan2(L.dx,L.dz);for(let s2=0;s2<3;s2++){const cx=L.x+L.dx*s2*5.5,cz=L.z+L.dz*s2*5.5,y=hAt(cx,cz)+.12;for(const sd of [-1,1]){const a=ang+sd*Math.PI/4;pr.box(cx-Math.sin(a)*1.9,y,cz-Math.cos(a)*1.9,.75,.08,4.2,k.C.red,1.5-s2*.3,a);}}fx?.flat(L.x+L.dx*5,hAt(L.x,L.z)+.2,L.z+L.dz*5,9,9,reg,[.3,.03,.06],0);}
 if(pr.n)out.push(pr.mesh());if(fx&&fx.n)out.push(fx.mesh());
 if(o.earth){const e=new S.Bld();e.add(S.G.ico,k.M(-560,300,-1100,0,0,0,100,100,100),new T.Color(.06,.16,.34),.9);e.add(S.G.ico,k.M(-580,316,-1080,0,0,0,70,70,70),new T.Color(.12,.24,.12),.5);out.push(e.mesh());}
 return out;}
// The blueprint grid only in a 13x13 patch around the blueprint or the drawing finger, fading out (5C: no whole-town grid).
function gridPatch(S,site,ci,cj){const fx=new S.Fx(),c=P.GRID.cell,reg=S.AT.SOLID||S.AT.BLOB,R=6,N=P.GRID.n,cl=v=>Math.max(0,Math.min(N-1,v));
 for(let a=-R;a<=R;a++)for(let b=-R;b<=R;b++){const i=ci+a,j=cj+b;if(!P.inGrid(i,j))continue;const f=Math.max(0,1-Math.max(Math.abs(a),Math.abs(b))/(R+1)),col=[.05*f,.26*f,.32*f],y=P.groundY(site,cl(i),cl(j))+.13,x=P.cellX(i),z=P.cellZ(j);
  fx.flat(x-c/2,y,z,.05,c/2,reg,col,0);fx.flat(x,y,z-c/2,c/2,.05,reg,col,0);if(a===R)fx.flat(x+c/2,y,z,.05,c/2,reg,col,0);if(b===R)fx.flat(x,y,z+c/2,c/2,.05,reg,col,0);
  if(P.NOBUILD[P.terrainAt(site,i,j)]&&Math.abs(P.groundY(site,i,j))<3)fx.flat(x,y+.01,z,c*.42,c*.42,reg,[.16*f,.03*f,.05*f],0);}
 return fx.mesh();}

// ------------------------------------------------------------------- instance plan + instanced draws ---------------------
// The pure plan both the town screen / Home Sector and the diorama use (dev/tests/conquest-townkit.mjs checks parity).
function plan(p){const w=p.w||{},walls=new Map(),posts=[],rubble=[],has=(i,j)=>Object.prototype.hasOwnProperty.call(w,i+','+j);
 for(const [kk,code] of Object.entries(w)){const [i,j]=kk.split(',').map(Number);if(p.dmg&&P.ruined(p,'w:'+kk)){rubble.push(kk);continue;}const c=code|0;if(!walls.has(c))walls.set(c,[]);walls.get(c).push(kk);
  const nb=(has(i-1,j)?1:0)+(has(i+1,j)?1:0)+(has(i,j-1)?1:0)+(has(i,j+1)?1:0);if(nb===1||nb>=2&&(i+j)%6===0)posts.push(kk);}
 const turrets=new Map(),builds=[];for(const [id,b] of Object.entries(p.b||{})){const building=p.job?.id===id||p.job?.t==='cc'&&b.t==='cc',lvl=b.t==='cc'?p.cc:b.l,B=P.BUILDINGS[b.t];
  if(B?.turret&&lvl>0&&!building){const kk=b.t+':'+lvl;if(!turrets.has(kk))turrets.set(kk,[]);turrets.get(kk).push([id,b]);}else builds.push([id,b,lvl,building]);}
 const homes=new Map();for(const h of P.homes(p)){if(!homes.has(h.k))homes.set(h.k,[]);homes.get(h.k).push(h);}
 return {walls,posts,rubble,turrets,builds,homes};}
const counts=pl=>({walls:[...pl.walls.values()].reduce((a,l)=>a+l.length,0),posts:pl.posts.length,rubble:pl.rubble.length,turrets:[...pl.turrets.values()].reduce((a,l)=>a+l.length,0),homes:[...pl.homes.values()].reduce((a,l)=>a+l.length,0),builds:pl.builds.length});
const cached=(m,key,make)=>{let g=m.get(key);if(!g){g=make();m.set(key,g);}return g;};
function inst(R,geo,n){const m=new R.T.InstancedMesh(geo,R.S.MAT.solid,Math.max(1,n));m.count=n;m.frustumCulled=false;return m;}
// R: {T,S,k,wgeo,hgeo,tgeo} (geometry caches kept across rebuilds). Each returns what the caller needs to hide or animate.
function walls(R,p,pl,low,group,mini){const {T,k}=R,M4=new T.Matrix4(),_q=new T.Quaternion(),_v=new T.Vector3(),_s=new T.Vector3(),wim=new Map(),wcell=new Map(),wpost=new Map();
 for(const [c,keys] of pl.walls){const geo=mini==='hero'?cached(R.wgeo,'hero:'+c,()=>{const b=new R.S.Bld(),s=P.GRID.cell,h=wallH(c);b.box(0,h*.5,0,s,h,s,k.C.dark2);b.box(0,h+.1,0,s,.2,s,k.C.cyan,.2);return b.geometry();}):mini?cached(R.wgeo,'mini:'+c,()=>k.wallMini(c)):cached(R.wgeo,c+':'+low,()=>k.wallGeo(c,low)),m=inst(R,geo,keys.length);   /* 'hero' (5E-2d2, the pad's model): one plain block a cell with a lit top, so the wall reads as one clean band */
  const wv=R.wv||1;keys.forEach((kk,n)=>{const [i,j]=kk.split(',').map(Number);if(wv===1)M4.makeTranslation(P.cellX(i),Math.max(R.ymin??-1e9,P.groundY(p.site,i,j)),P.cellZ(j));else M4.compose(_v.set(P.cellX(i),Math.max(R.ymin??-1e9,P.groundY(p.site,i,j)),P.cellZ(j)),_q.identity(),_s.set(1,wv,1));m.setMatrixAt(n,M4);wcell.set(kk,[m,n]);});m.instanceMatrix.needsUpdate=true;group.add(m);wim.set(c,m);}
 if(mini==='hero')return {wim,wcell,wpost};   // no posts, no rubble: at the pad's scale they are specks
 if(pl.posts.length){const m=inst(R,mini?cached(R.wgeo,'post:mini',()=>k.postMini()):cached(R.wgeo,'post:'+low,()=>k.post(low)),pl.posts.length);pl.posts.forEach((kk,n)=>{const [i,j]=kk.split(',').map(Number),h=wallH(p.w[kk]|0);M4.compose(_v.set(P.cellX(i),Math.max(R.ymin??-1e9,P.groundY(p.site,i,j)),P.cellZ(j)),_q.identity(),_s.set(1,(h+1.2)/5.2*(R.wv||1),1));m.setMatrixAt(n,M4);wpost.set(kk,[m,n]);});m.instanceMatrix.needsUpdate=true;group.add(m);}
 if(pl.rubble.length){const m=inst(R,cached(R.wgeo,'rubble',()=>k.rubble()),pl.rubble.length);pl.rubble.forEach((kk,n)=>{const [i,j]=kk.split(',').map(Number);_q.setFromAxisAngle(_s.set(0,1,0),(i*7+j*3)%4*Math.PI/2);M4.compose(_v.set(P.cellX(i),Math.max(R.ymin??-1e9,P.groundY(p.site,i,j)),P.cellZ(j)),_q,_s.set(1,1,1));m.setMatrixAt(n,M4);});m.instanceMatrix.needsUpdate=true;group.add(m);}
 return {wim,wcell,wpost};}
function turrets(R,p,pl,theme,group){const {T,k}=R,M4=new T.Matrix4(),tur=new Map();
 for(const [kk,list] of pl.turrets){const [t,l]=kk.split(':');
  // the owner's Meshy turret when its file is in (HIGH): an instanced fixed base and an instanced head, pedestal on the cell centre
  const my=!R.S.low&&typeof Meshy3D!=='undefined'?Meshy3D.townTurret(t,list.length,+l,theme,false):null;
  if(my){const items=list.map(([id,b],n)=>{const x=P.cellX(b.i),z=P.cellZ(b.j),y=P.groundY(p.site,b.i,b.j);my.base.setMatrixAt(n,my.matrix(M4,x,y,z,0,0,false));my.hd.setMatrixAt(n,my.matrix(M4,x,y,z,0,0,false));return {id,t,x,y,z,n,spin:(b.i*7+b.j*3)%6};});
   my.base.instanceMatrix.needsUpdate=my.hd.instanceMatrix.needsUpdate=true;group.add(my.base,my.hd);tur.set(kk,{base:my.base,hd:my.hd,items,meshy:my});continue;}
  const tk2=kk+':'+(theme?.finish||'')+(theme?.light||''),bg=cached(R.tgeo,tk2+':b',()=>k.building(t,+l,theme).geometry()),hg=cached(R.tgeo,tk2+':h',()=>k.head(t,+l).geometry()),base=inst(R,bg,list.length),hd=inst(R,hg,list.length);
  const items=list.map(([id,b],n)=>{const x=P.cellX(b.i),z=P.cellZ(b.j),y=P.groundY(p.site,b.i,b.j);M4.makeTranslation(x,y,z);base.setMatrixAt(n,M4);M4.makeTranslation(x,y+k.headY(t,+l),z);hd.setMatrixAt(n,M4);return {id,t,x,y:y+k.headY(t,+l),z,n,spin:(b.i*7+b.j*3)%6};});
  base.instanceMatrix.needsUpdate=hd.instanceMatrix.needsUpdate=true;group.add(base,hd);tur.set(kk,{base,hd,items});}
 return tur;}
function homes(R,p,pl,low,group){const {T,k}=R,M4=new T.Matrix4(),_q=new T.Quaternion(),_v=new T.Vector3(),_one=new T.Vector3(1,1,1),up=new T.Vector3(0,1,0),him=new Map(),hcell=new Map();
 for(const [kind,list] of pl.homes){const m=inst(R,cached(R.hgeo,kind+low,()=>k.home(kind,low)),list.length);list.forEach((h,n)=>{const x=P.cellX(h.i)+P.GRID.cell/2,z=P.cellZ(h.j)+P.GRID.cell/2;_q.setFromAxisAngle(up,(h.seed%4)*Math.PI/2);M4.compose(_v.set(x,P.heightAt(p.site,x,z),z),_q,_one);m.setMatrixAt(n,M4);hcell.set(h.id,[m,n]);});m.instanceMatrix.needsUpdate=true;group.add(m);him.set(kind,m);}
 return {him,hcell};}

// Damage you can see (5C): damaged walls and buildings smoke, ruined turrets and buildings spark. Two instanced draws
// (dark puffs, hot sparks), animated by damageStep() in the Home Sector, frozen on the diorama.
function damageFx(R,p,group){const {T,S,k}=R,src=[];for(const key of Object.keys(p.dmg||{})){if(src.length>=48)break;const ru=P.ruined(p,key);
  if(key.startsWith('w:')){const kk=key.slice(2);if(ru||!p.w[kk])continue;const [i,j]=kk.split(',').map(Number);src.push({x:P.cellX(i),z:P.cellZ(j),y:P.groundY(p.site,i,j)+wallH(p.w[kk]|0),spark:false});}
  else{const b=p.b?.[key];if(!b)continue;const f=fp(b),tur=!!P.BUILDINGS[b.t]?.turret;src.push({x:f.x,z:f.z,y:P.heightAt(p.site,f.x,f.z)+(tur?2.4:4.5),spark:ru,smoke:!tur||!ru});}}
 if(!src.length)return null;const sg=cached(R.wgeo,'smoke',()=>{const b=new S.Bld();b.add(S.G.ico,k.M(0,0,0,0,0,0,1,1,1),new T.Color(.05,.05,.055));return b.geometry();}),kg=cached(R.wgeo,'spark',()=>{const b=new S.Bld();b.box(0,0,0,.22,.22,.22,k.C.furnace,3.2);return b.geometry();});
 const puffs=src.filter(x=>x.smoke!==false).length*3,sparks=src.filter(x=>x.spark).length*4,sm=inst(R,sg,puffs),sp=inst(R,kg,sparks);group.add(sm,sp);const fx={src,sm,sp,M4:new T.Matrix4(),v:new T.Vector3(),q:new T.Quaternion(),sc:new T.Vector3()};damageStep(fx,0);return fx;}
function damageStep(fx,t){if(!fx)return;const {src,sm,sp,M4,v,q,sc}=fx;let a=0,b=0;src.forEach((s2,n)=>{if(s2.smoke!==false)for(let k2=0;k2<3;k2++){const ph=(t*.32+k2/3+n*.137)%1,r=(.5+ph*1.3)*(1-ph*.55);M4.compose(v.set(s2.x+Math.sin(n*2.1+k2+t*.4)*.7*ph,s2.y+ph*7,s2.z+Math.cos(n*1.3+k2)*.7*ph),q.identity(),sc.set(r,r,r));sm.setMatrixAt(a++,M4);}
  if(s2.spark)for(let k2=0;k2<4;k2++){const ph=(t*1.7+k2*.27+n*.31)%1,on=Math.sin(t*23+n*5+k2*2)>-.2?1:0;M4.compose(v.set(s2.x+Math.sin(n+k2*1.7)*1.2,s2.y-.4+ph*1.8,s2.z+Math.cos(n*.7+k2*2.3)*1.2),q.identity(),sc.set(on,on,on));sp.setMatrixAt(b++,M4);}});
 sm.instanceMatrix.needsUpdate=sp.instanceMatrix.needsUpdate=true;}

// ------------------------------------------------------------------- diorama -----------------------------------------------
// One indexed geometry from many solid geometries (position/normal/aCol), each with its own transform: the diorama's static
// part (buildings, turrets, homes, banner, decorations) is one draw.
function Merge(T){const P2=[],N=[],A=[],I=[];let n=0;const v=new T.Vector3();   // transforms here are rotation + translation (+ uniform scale): normals use transformDirection (the vendored three has no Matrix3)
 return {add(geo,m,nm){const p=geo.attributes.position,no=geo.attributes.normal,ac=geo.attributes.aCol,ix=geo.index;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);P2.push(v.x,v.y,v.z);v.fromBufferAttribute(no,i).transformDirection(nm||m);/* nm: the normal matrix when m stretches */N.push(v.x,v.y,v.z);A.push(ac.getX(i),ac.getY(i),ac.getZ(i),ac.getW(i));}
   if(ix)for(let k=0;k<ix.count;k++)I.push(ix.getX(k)+n);else for(let k=0;k<p.count;k++)I.push(k+n);n+=p.count;},
  get n(){return n;},
  geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P2,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('aCol',new T.Float32BufferAttribute(A,4));g.setIndex(I);g.computeBoundingSphere();return g;}};}
const fp=(b)=>{const s=P.sizeOf(b.t,b.r|0);return {x:P.cellX(b.i)+(s.w-1)*P.GRID.cell/2,z:P.cellZ(b.j)+(s.d-1)*P.GRID.cell/2};};
// The pilot's town as a model: town-scale geometry in a group scaled by o.scale, centred on the town centre, on a dark
// plinth with a lit edge. Walls keep their instanced draws (same plan as the full-size town); the rest is one merged draw.
// LOW / hub stand-ins (5C review): every building but the Command Center as its footprint block with a lit top (gold on
// vitals), turrets as a base and a barrel, homes as a painted block. The CC keeps its full model so its level reads.
function standIn(S,k,t,lvl){const T=S.T,b=new S.Bld();if(t==='home'){b.box(0,1.4,0,5.6,2.8,5.6,k.C.paint[lvl%6]);b.box(0,2.9,0,6,.2,6,k.C.roof||k.C.dark2);return b.geometry();}
 if(P.BUILDINGS[t]?.turret){b.box(0,.6,0,2.6,1.2,2.6,k.C.dark2);b.box(0,1.6,.5,1.1,.7,2.6,k.C.mid);b.box(0,1.98,-.2,.6,.06,.6,k.C.cyan,1.2);return b.geometry();}
 const z=P.sizeOf(t,0),W=z.w*P.GRID.cell-1,D=z.d*P.GRID.cell-1,H=2.4+Math.max(1,lvl)*1.1;b.box(0,H/2,0,W,H,D,k.C.mid);b.box(0,H+.1,0,W*.86,.2,D*.86,P.VITALS[t]?k.C.gold:k.C.cyan,P.VITALS[t]?1.3:.8);return b.geometry();}
// 5D: a generator, so the shared world can build the model in slices across idle time (iPhone: 65-106 ms in one task before);
// diorama() drains it in one go (the same output, used by the hub, the tests and the Home Sector thumbnail)
// o.hero (5E-2d2; owner, Nov 21: "hero pieces only: it is noise at phone size"; the world's pad passes it, the hub does not): the
// board, the walls as one clean lit band, the Command Center and up to nine more buildings (one of each kind, the vital and
// the largest first), the banner and the halo. The buildings keep their places round the Command Center but are drawn larger
// (up to 2.3x, as far as the innermost wall allows), since the homes, turrets, lamps and rocks that stood between them are not
// drawn: about ten pieces that read at phone size instead of several hundred specks. counts stays the town's own plan.
function heroPick(pl){const sc=e=>{const z=P.sizeOf(e[1].t,0);return (e[1].t==='cc'?1e9:0)+(P.VITALS[e[1].t]?1e6:0)+z.w*z.d*1e3+e[2]*10;},seen=new Set(),out=[];
 for(const e of pl.builds.slice().sort((a,b)=>sc(b)-sc(a))){if(out.length>=10)break;const t=e[1].t;if(t==='gate'||seen.has(t))continue;seen.add(t);out.push(e);}return out;}
function* dioramaGen(S,p,o={}){const T=S.T,k=kitFor(S),low=!!o.low,hero=!!o.hero,R={T,S,k,wv:o.wv||1,ymin:o.floor??-6,wgeo:o.cache?.wgeo||new Map(),hgeo:o.cache?.hgeo||new Map(),tgeo:o.cache?.tgeo||new Map()},g=new T.Group(),town=new T.Group(),pl=plan(p),h=P.townH(p.cc),c=P.GRID.cell,half=Math.min((h+2.5)*c,P.GRID.n*c/2);   // never past the site grid (its edge row took the off-grid heights)
 g.add(town);const sc=o.scale||1,vy=o.vy||1,bv=o.bv||1;town.scale.set(sc,sc*vy,sc);   // bv: buildings, turrets and homes stretched upward about their own base (walls keep vy)
 const tm=terrain(S,p.site,p.cc,p,{step:low?12:8,clip:half,props:!low&&!hero,glow:!low,far:false,floor:R.ymin});for(const m of tm){const a=m.geometry?.attributes?.aCol;if(a&&m.material===S.MAT.solid&&a.count>500){for(let i=0;i<a.count;i++)a.setW(i,Math.max(a.getW(i),.32));a.needsUpdate=true;}town.add(m);}   // owner gate: the board is self-lit (the courtyard is dark)
 yield;   // terrain done
 // The board is a cut block of the site: skirts from the ground's edge down to a base plate under its lowest point (the old
 // plinth top sat at height 0, buried ridge terraces and the crater bowl under it and z-fought with flat ground).
 const gp=tm[0].geometry.attributes.position,ga=tm[0].geometry.attributes.aCol,N=Math.round(Math.sqrt(gp.count));let minH=0;for(let i=0;i<gp.count;i++)minH=Math.min(minH,gp.getY(i));const base=minH-1.2;
 {const Pp=[],Nn=[],A=[],I=[],sc0=TCOL.cliff,sk=[sc0[0]*1.7,sc0[1]*1.7,sc0[2]*1.7],e1=new T.Vector3(),e2=new T.Vector3(),nn=new T.Vector3();
  const side=(idx,dx,dz)=>{for(let q=0;q<idx.length-1;q++){const a=idx[q],b2=idx[q+1],n0=Pp.length/3,ax=gp.getX(a),ay=gp.getY(a),az=gp.getZ(a),bx=gp.getX(b2),by=gp.getY(b2),bz=gp.getZ(b2);Pp.push(ax,ay,az,bx,by,bz,bx,base,bz,ax,base,az);for(let r=0;r<4;r++)Nn.push(dx,0,dz);for(const v of [a,b2])A.push(ga.getX(v)*.7,ga.getY(v)*.7,ga.getZ(v)*.7,.22);A.push(sk[0]*.45,sk[1]*.45,sk[2]*.5,.06,sk[0]*.45,sk[1]*.45,sk[2]*.5,.06);   // a geological cut: the edge's own ground fading to dark rock
    e1.set(bx-ax,by-ay,bz-az);e2.set(bx-ax,base-ay,bz-az);nn.crossVectors(e1,e2);if(nn.x*dx+nn.z*dz>=0)I.push(n0,n0+1,n0+2,n0,n0+2,n0+3);else I.push(n0,n0+2,n0+1,n0,n0+3,n0+2);}};
  const rng=[...Array(N).keys()];side(rng.map(b2=>b2),-1,0);side(rng.map(b2=>(N-1)*N+b2),1,0);side(rng.map(a2=>a2*N),0,-1);side(rng.map(a2=>a2*N+N-1),0,1);
  const g2=new T.BufferGeometry();g2.setAttribute('position',new T.Float32BufferAttribute(Pp,3));g2.setAttribute('normal',new T.Float32BufferAttribute(Nn,3));g2.setAttribute('aCol',new T.Float32BufferAttribute(A,4));g2.setIndex(I);g2.computeBoundingSphere();town.add(new T.Mesh(g2,S.MAT.solid));}
 {const b=new S.Bld();b.box(0,base-.2,0,2*half+2,.4,2*half+2,k.C.dark2);for(const [x,z,w,d] of [[0,-half-1,2*half+2.4,.5],[0,half+1,2*half+2.4,.5],[-half-1,0,.5,2*half+2.4],[half+1,0,.5,2*half+2.4]])b.box(x,base-.1,z,w,.3,d,k.C.cyan,.5);town.add(b.mesh());}
 yield;   // terrain, skirts and plinth done
 const hY=(x,z)=>Math.max(R.ymin,P.heightAt(p.site,x,z)),gY2=(i,j)=>Math.max(R.ymin,P.groundY(p.site,i,j)),W=walls(R,p,pl,true,town,hero?'hero':true),mg=Merge(T),M4=new T.Matrix4(),NM=new T.Matrix4(),_q=new T.Quaternion(),_v=new T.Vector3(),_z=new T.Vector3(),_one=new T.Vector3(1,bv,1),_nv=new T.Vector3(1,1/bv,1),up=new T.Vector3(0,1,0),theme=p.theme||null;let nT=0,nH=0,nB=0;
 yield;   // walls done
 let yc=0,hz=1;const Cc=ccCenter(p),blds=hero?heroPick(pl):pl.builds;
 if(hero){let rm=0,lim=half-c;for(const e of blds){const f=fp(e[1]),z=P.sizeOf(e[1].t,e[1].r|0);rm=Math.max(rm,Math.max(Math.abs(f.x-Cc.x),Math.abs(f.z-Cc.z))+Math.max(z.w,z.d)*c*.6);}
  for(const kk of Object.keys(p.w||{})){const [i,j]=kk.split(',').map(Number);lim=Math.min(lim,Math.max(Math.abs(P.cellX(i)-Cc.x),Math.abs(P.cellZ(j)-Cc.z))-c);}
  hz=Math.max(1,Math.min(2.3,lim*.9/Math.max(1,rm)));_one.set(hz,bv,hz);_nv.set(1/hz,1/bv,1/hz);}
 for(const [id,b,lvl,building] of blds){if(++yc%40===0)yield;const f=fp(b);f.x=Cc.x+(f.x-Cc.x)*hz;f.z=Cc.z+(f.z-Cc.z)*hz;const y=hY(f.x,f.z);_q.setFromAxisAngle(up,-(b.r|0)*Math.PI/2);M4.compose(_v.set(f.x,y,f.z),_q,_one);NM.compose(_z,_q,_nv);mg.add(low&&b.t!=='cc'?cached(R.tgeo,'si:'+b.t+':'+Math.max(1,lvl),()=>standIn(S,k,b.t,lvl)):cached(R.tgeo,'d:'+b.t+':'+Math.max(1,lvl)+':'+(theme?.finish||'')+(theme?.light||''),()=>k.building(b.t,Math.max(1,lvl),theme).geometry()),M4,NM);nB++;
  if(b.t==='radar'&&!low){M4.compose(_v.set(f.x,y+k.headY('radar',lvl)*bv,f.z),_q.setFromAxisAngle(up,.7),_one);NM.compose(_z,_q,_nv);mg.add(cached(R.tgeo,'dh:radar:'+Math.max(1,lvl),()=>k.head('radar',Math.max(1,lvl)).geometry()),M4,NM);}}
 yield;   // buildings done
 if(!hero)for(const [kk,list] of pl.turrets){const [t,l]=kk.split(':'),bg=low?cached(R.tgeo,'si:'+t,()=>standIn(S,k,t,1)):cached(R.tgeo,kk+':'+(theme?.finish||'')+(theme?.light||'')+':b',()=>k.building(t,+l,theme).geometry()),hg=low?null:cached(R.tgeo,kk+':'+(theme?.finish||'')+(theme?.light||'')+':h',()=>k.head(t,+l).geometry());
  for(const [,b] of list){if(++yc%40===0)yield;const x=P.cellX(b.i),z=P.cellZ(b.j),y=gY2(b.i,b.j);_q.setFromAxisAngle(up,(b.i*7+b.j*3)%6);M4.compose(_v.set(x,y,z),low?_q:_q.identity(),_one);NM.compose(_z,_q,_nv);mg.add(bg,M4,NM);if(hg){M4.compose(_v.set(x,y+k.headY(t,+l)*bv,z),_q.setFromAxisAngle(up,(b.i*7+b.j*3)%6),_one);NM.compose(_z,_q,_nv);mg.add(hg,M4,NM);}nT++;}}
 yield;   // turrets done
 if(!hero)for(const [kind,list] of pl.homes){const geo=low?cached(R.hgeo,'si:'+kind,()=>standIn(S,k,'home',kind.length)):cached(R.hgeo,kind+true,()=>k.home(kind,true));for(const hm of list){if(++yc%40===0)yield;const x=P.cellX(hm.i)+c/2,z=P.cellZ(hm.j)+c/2;M4.compose(_v.set(x,hY(x,z),z),_q.setFromAxisAngle(up,(hm.seed%4)*Math.PI/2),_one);NM.compose(_z,_q,_nv);mg.add(geo,M4,NM);nH++;}}
 const C0=ccCenter(p),cy=hY(C0.x,C0.z);
 {const hb=new S.Bld(),r2=Math.max(C0.w,C0.d)*c*hz;hb.add(S.G.cyl,k.M(0,0,0,0,0,0,r2,.1,r2),p.cc>=9?k.C.gold:k.C.cyan,.7);const hg=hb.geometry();M4.makeTranslation(C0.x,cy+.16,C0.z);mg.add(hg,M4);hg.dispose();}   // owner gate: a halo under the Command Center (gold from CC9) so the eye finds it on the model
 if(p.banner){const bg=k.banner(p.banner,3.2).geometry();M4.compose(_v.set(C0.x+(C0.w*c/2+3)*hz,cy,C0.z-(C0.d*c/2+2)*hz),_q.identity(),_one);NM.compose(_z,_q,_nv);mg.add(bg,M4,NM);bg.dispose();}
 if(p.theme?.decor?.length&&!hero){const dg=k.decor(p.theme.decor,C0.x,C0.z,C0.w*c+6,C0.d*c+6,p.theme.light).geometry();M4.identity();if(dg.attributes.position.count)mg.add(dg,M4);dg.dispose();}
 yield;   // before the merge (one big Float32 build)
 if(mg.n){const m=new T.Mesh(mg.geometry(),S.MAT.solid);m.userData.merged=true;town.add(m);}
 if(!hero)damageFx(R,p,town);
 const shown={walls:[...W.wim.values()].reduce((a,m)=>a+m.count,0),posts:W.wpost.size,rubble:hero?0:pl.rubble.length,turrets:nT,homes:nH,builds:nB};
 g.userData={lift:(.4-base)*sc*vy,counts:hero?counts(pl):shown,shown,hero,kit:!low,plan:pl,R,half:half*sc,ccY:cy*sc};
 return g;}
function diorama(S,p,o={}){const it=dioramaGen(S,p,o);let r;do r=it.next();while(!r.done);return r.value;}

// ------------------------------------------------------------------- 2D layer ----------------------------------------------
// One pixel per cell in a canvas (terrain, walls by blend, homes): drawn scaled with no smoothing. Cheap at any town size.
const T2={ground:[43,47,54],lush:[32,58,28],ash:[34,32,36],pass:[58,34,32],ice:[120,160,180],rim:[42,42,48],cliff:[26,27,32],water:[18,58,92],rock:[46,40,36],crevasse:[10,20,30],vent:[110,44,20],deposit:[122,74,44]};
function layer2d(p,c){const n=P.GRID.n,h=P.townH(p.cc);c=c||document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d'),img=g.createImageData(n,n);
 const put=(i,j,rgb)=>{const o=(j*n+i)*4;img.data[o]=rgb[0];img.data[o+1]=rgb[1];img.data[o+2]=rgb[2];img.data[o+3]=255;};
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){const t=T2[P.terrainAt(p.site,i,j)]||T2.ground,f=P.cheb(i,j)<=h?1.45:.45;put(i,j,t.map(v=>Math.min(255,Math.round(v*f))));}
 {const c0=p.b?.cc;if(c0){const s0=P.sizeOf('cc',c0.r|0),r=Math.ceil(Math.max(s0.w,s0.d)/2)+2+Math.floor((p.cc-1)*.15);for(let i=c0.i-r;i<c0.i+s0.w+r;i++)for(let j=c0.j-r;j<c0.j+s0.d+r;j++)if(P.inGrid(i,j)&&!P.NOBUILD[P.terrainAt(p.site,i,j)])put(i,j,[96,98,104]);}}   // the paved plaza (owner gate: the CC1 thumbnail read as an empty tile)
 for(const hm of P.homes(p))for(const [a,b] of [[0,0],[1,0],[0,1],[1,1]])put(hm.i+a,hm.j+b,[150,110,70]);
 for(const [kk,code] of Object.entries(p.w||{})){const [i,j]=kk.split(',').map(Number),{o,l}=P.wdecode(code),c0=ORE_LOOK[o][0],c1=ORE_LOOK[o][1],t=o?l/3*.6:0,mix=k=>Math.round(((c0>>k)&255)*(1-t)+((c1>>k)&255)*t);put(i,j,p.dmg&&P.ruined(p,'w:'+kk)?[90,40,40]:[mix(16),mix(8),mix(0)]);}
 for(const b of Object.values(p.b||{})){const s=P.sizeOf(b.t,b.r|0),col=b.t==='cc'?[255,211,107]:P.VITALS[b.t]?[200,170,110]:P.BUILDINGS[b.t]?.turret?[34,230,255]:[120,140,160];for(let a=0;a<s.w;a++)for(let d=0;d<s.d;d++)if(P.inGrid(b.i+a,b.j+d))put(b.i+a,b.j+d,col);}
 g.putImageData(img,0,0);return c;}
// A small thumbnail of the town (the ⌂ MY BASE HUD button): the town square cropped from the 2D layer, red ring when damaged.
function thumb(p,size=44,c){const n=P.GRID.n,h=P.townH(p.cc),side=2*h+1,i0=P.MID-h,src=layer2d(p);c=c||document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle='#05070d';g.fillRect(0,0,size,size);g.drawImage(src,i0,i0,side,side,1,1,size-2,size-2);
 {const c0=p.b?.cc;if(c0){const s0=P.sizeOf('cc',c0.r|0),k=(size-2)/side,x=1+(c0.i-i0+s0.w/2)*k,y=1+(c0.j-i0+s0.d/2)*k,gr=g.createRadialGradient?.(x,y,0,x,y,size*(.16+.012*p.cc));const col=p.cc>=9?'255,211,107':'120,236,255';if(gr?.addColorStop){gr.addColorStop(0,'rgba('+col+',.9)');gr.addColorStop(1,'rgba('+col+',0)');g.fillStyle=gr;g.fillRect(0,0,size,size);}
  for(const b of Object.values(p.b||{})){if(b.t==='cc')continue;const s1=P.sizeOf(b.t,b.r|0),bx=1+(b.i-i0)*k,by=1+(b.j-i0)*k;g.fillStyle=P.BUILDINGS[b.t]?.turret?'#5ff0ff':P.VITALS[b.t]?'#ffd36b':'#c8d6e4';g.fillRect(Math.round(bx),Math.round(by),Math.max(2,Math.round(s1.w*k)),Math.max(2,Math.round(s1.d*k)));}}}   // buildings stay visible at any town size   // the Command Center glows
 const dmg=Object.keys(p.dmg||{}).length>0;g.strokeStyle=dmg?'#ff3048':'#22e6ff';g.lineWidth=dmg?3:1.5;g.strokeRect(1,1,size-2,size-2);return c;}

root.ConquestTownKit=Object.freeze({ORE_LOOK,TCOL,kit:kitFor,wallH,terrain,gridPatch,lanesOf,ccCenter,plan,counts,walls,turrets,homes,diorama,dioramaGen,damageFx,damageStep,Merge,layer2d,thumb});
})(globalThis);
