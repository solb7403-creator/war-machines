'use strict';
// Presentation only. Shared equipment UV/material bank, no simulation RNG, account, inventory or network APIs.
const Environment3D=(()=>{
 const VERSION='env-v1',TERRAIN=new Map(),MAX_TERRAIN=2;
 const active=()=>typeof Equipment3D!=='undefined'&&Equipment3D.active()&&globalThis.LUNAR_ENV_PREVIEW!==false;
 const key=()=>active()?VERSION+'|'+Equipment3D.quality+'|'+Equipment3D.generation:'legacy';
 const STYLES=Object.freeze({classic:{floor:'#30383c',dust:'#656b68',accent:'#7ecbd6',name:'MOONBASE / OPERATIONS'},overpass:{floor:'#2a323a',dust:'#5c6670',accent:'#80c8dd',name:'OVERPASS / TRANSIT'},longshot:{floor:'#393c40',dust:'#79756b',accent:'#b69a69',name:'LONGSHOT / EXTRACTION'},craters:{floor:'#3c3f42',dust:'#858477',accent:'#b4aba0',name:'CRATER FIELD / EXPEDITION'}});
 const MODES=Object.freeze({arena:{label:'ARENA',color:'#83bed8'},zone:{label:'MOON ZONE',color:'#6cbbb6'},crystal:{label:'CRYSTAL RUSH',color:'#ae92c9'},bounty:{label:'BOUNTY',color:'#bd985a'},royale:{label:'LAST STANDING',color:'#9b86bf'},boss:{label:'SURVIVAL',color:'#c29175'}});
 const seed=(x,z)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
 const kit=q=>Equipment3D.kit(q),put=(...args)=>Equipment3D.put(...args),bake=k=>Equipment3D.bake(k),C=()=>Equipment3D.components;
 const box=(x,y,z)=>new THREE.BoxGeometry(x,y,z),cyl=(r,h,n=12)=>new THREE.CylinderGeometry(r,r,h,n);
 const ink={paint:'#57636c',plate:'#3a4650',steel:'#89969f',gold:'#b39a6b',dark:'#19232c',rubber:'#161e24',light:'#a5c5ce'};
 function part(k,sz,p,c=ink.paint,mat='paint'){put(k,box(...sz),mat,c,p);}
 function panel(k,x,y,z,l,w,h,c=ink.paint,mat='paint'){C().panel(k,x,y,z,l,w,h,mat,c,k.quality==='high'?.02:.008);}
 function line(k,a,b,r=.02,c=ink.steel,mat='steel'){C().pipe(k,a,b,r,c,mat);}
 function lamp(k,x,y,z,w=.24,c=ink.light){part(k,[w,.018,.045],[x,y,z],c,'energy');}
 function boltRow(k,x,y,z,dx,count){if(k.quality!=='high')return;for(let i=0;i<count;i++)C().bolt(k,x+dx*i,y,z);}
 function rock(k,x,z,r,h,high,tint){
  const g=new THREE.IcosahedronGeometry(r,high?1:0),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const a=p.getX(i),b=p.getY(i),c=p.getZ(i),n=.85+seed(a+x,c+z)*.16;p.setXYZ(i,a*n,Math.max(.0,(b+r)*h/(2*r)),c*n);}g.deleteAttribute('normal');put(k,g,'paint',tint,[x,0,z],[0,seed(x+9,z)*Math.PI*2,0]);
 }
 function structure(k,glow,wl,q){
  const [x,z,w,d,type]=wl,X=x+w/2,Z=z+d/2,high=q==='high',H=M3.WALL_H[type]||1;
  if(type==='cliff'){
   // Silhouette stays on the collision footprint; nothing projects into the narrow firing corridor.
   part(k,[w,H*.37,d],[X,H*.185,Z],'#343e46');
   for(let y=z+.65;y<z+d-.30;y+=high?1.35:2.8)for(const col of [0,1]){const r=(high?.76:.90)+seed(y,x+col)*.22,cx=x+(col?w-r-.06:r+.06),Z=y+(col? .37:0)+(seed(x,y)-.5)*.28,h=.85+seed(cx,y)*.95;rock(k,cx,Z,r,h,false,seed(x+col,y)>.45?'#596166':'#424f58');}
   const inner=x<10?x+w:x,sgn=x<10?-1:1;
   for(let y=z+.5;y<z+d-.25;y+=high?1.05:2.3){const h=1.0+seed(x,y)*.90,r=.36+seed(y,x)*.20;rock(k,inner+sgn*(r+.03),y,r,h,high,'#5c5f60');if(high)part(k,[.16,.06,.50],[inner+sgn*.04,h*.44,y],'#878076','steel');}
   return;
  }
  if(type==='ctr'){
   const tint=['#4d636a','#71634f','#515e59','#52616c'][Math.floor(seed(x,z)*4)],long=w>=d;
   panel(k,X,.025,Z,w-.02,d-.02,H-.025,tint);
   panel(k,X,H-.02,Z,w-.14,d-.14,.055,'#748187','steel');
   for(const s of [-1,1]){
    const n=Math.max(2,Math.floor((long?w:d)/(high?.50:1.2)));
    for(let i=0;i<n;i++){const a=(i+.5)*(long?w:d)/n;
     part(k,long?[.045,H*.79,.055]:[.055,H*.79,.045],long?[x+a,H*.45,z+(s>0?d-.03:.03)]:[x+(s>0?w-.03:.03),H*.45,z+a],'#253139','rubber');
    }
   }
   for(const sx of [-1,1])for(const sz of [-1,1])part(k,[.12,H,.12],[X+sx*(w/2-.07),H/2,Z+sz*(d/2-.07)],'#889399','steel');
   panel(k,X,H+.039,Z,Math.min(.62,w*.6),Math.min(.40,d*.6),.012,'#baaa83','paint');
   for(let i=0;i<(high?6:3);i++){const a=(i+.5)*(long?w:d)/(high?6:3);part(k,long?[.038,.022,d*.75]:[w*.75,.022,.038],long?[x+a,H+.035,Z]:[X,H+.035,z+a],'#43525b','steel');}
   for(const s of [-1,1]){part(k,long?[w*.72,.015,.04]:[.04,.015,d*.72],long?[X,H+.044,Z+s*d*.35]:[X+s*w*.35,H+.044,Z],'#9b9077','paint');}boltRow(k,x+.18,H+.042,z+.18,(w-.36)/3,4);return;
  }
  if(type==='cmd'){
   panel(k,X,.02,Z,w-.02,d-.02,H*.72,'#3d4d57');
   panel(k,X,H*.70,Z,w*.82,d*.78,.20,'#727d84','steel');
   const radius=Math.min(w,d)*.27;put(k,cyl(radius,.17,high?16:8),'paint','#354650',[X,H+.08,Z]);
   put(k,cyl(radius*.62,.04,high?16:8),'steel','#8f9b9f',[X,H+.18,Z]);
   for(const s of [-1,1]){panel(k,X+s*w*.30,H*.79,Z,.40,d*.42,.16,'#394a55');C().vents(k,{dark:ink.dark},X+s*w*.30,H*.79+.17,Z,.27,d*.34,high?7:3);}
   part(glow,[radius*.85,.012,.035],[X,H+.205,Z],'#92b6bf','energy');
   for(const s of [-1,1]){
    C().vents(k,{dark:ink.dark},X,H*.75,Z+s*d*.26,w*.30,.25,high?8:3);
    part(glow,[w*.40,.055,.02],[X,H*.40,z+(s>0?d-.012:.012)],'#8eafb8','energy');
    for(let i=0;i<3;i++)part(k,[.23,.035,.11],[x+.40+i*.34,.10,Z+s*(d/2-.08)],i%2?'#b6a571':'#202d34','paint');
   }
   panel(k,X,.05,z+d-.09,.64,.10,.45,'#222f37');lamp(glow,X,.49,z+d-.02,.40);return;
  }
  if(type==='pylon'){
   panel(k,X,.01,Z,w-.025,d-.025,.24,'#45515a');put(k,cyl(Math.min(w,d)*.34,.23,high?12:8),'steel','#82918f',[X,.35,Z]);
   for(const s of [-1,1])for(const t of [-1,1]){
    panel(k,X+s*w*.32,.25,Z+t*d*.32,.17,.19,.88,'#3f525a');
    part(glow,[.035,.62,.036],[X+s*w*.33,.72,Z+t*d*.33],'#71b5b2','energy');
   }
   put(glow,cyl(.16,1.26,high?14:8),'energy','#5aafbd',[X,.93,Z]);
   for(const y of [.45,1.10])put(k,new THREE.TorusGeometry(.37,.045,4,high?20:10),'steel','#b6aa83',[X,y,Z],[Math.PI/2,0,0]);return;
  }
  if(type==='lander'){
   const c='#9e8963';panel(k,X,.14,Z,w*.64,d*.76,.45,c,'gold');
   for(const s of [-1,1]){
    line(k,[x+.10,.02,Z+s*d*.38],[X-.35,.45,Z+s*d*.23],.045,ink.steel);
    line(k,[x+w-.10,.02,Z+s*d*.38],[X+.35,.45,Z+s*d*.23],.045,ink.steel);
    panel(k,X,.54,Z+s*d*.15,w*.50,d*.24,.07,'#56636a');
   }
   // Tilted broken antenna remains within its existing solid lander footprint.
   line(k,[X,.57,Z],[X+.35,.96,Z-.12],.025,'#9ca7ac');put(k,new THREE.ConeGeometry(.23,.08,high?12:7),'steel','#8e999c',[X+.35,.97,Z-.12],[.38,0,.31]);lamp(glow,X-.38,.62,Z,.13,'#bda781');return;
  }
  part(k,[w,H,d],[X,H/2,Z]);
 }
 function mapKit(id,q='high'){
  q=q==='low'?'low':'high';
  if(!STYLES[id])id='classic';const M=MAPS[id],k=kit(q),glow=kit(q),high=q==='high';
  // All positive-height decoration sits on existing obstacles or outside the playable rectangle.
  for(const wl of M.walls||[])structure(k,glow,wl,q);
  for(const [x,z,r,type] of M.rocks||[]){
   if(type==='dome'){
    put(k,cyl(r*.98,.15,high?20:10),'paint','#34444e',[x,.075,z]);
    put(k,new THREE.SphereGeometry(r*.87,high?20:10,high?10:5,0,Math.PI*2,0,Math.PI/2),'steel','#9aa6a8',[x,.15,z]);
    for(let i=0;i<(high?8:4);i++){const a=i*Math.PI*2/(high?8:4);line(k,[x+Math.cos(a)*r*.87,.17,z+Math.sin(a)*r*.87],[x+Math.cos(a)*r*.45,.15+r*.75,z+Math.sin(a)*r*.45],.022,'#485760');}
    for(const s of [-1,1])lamp(glow,x+s*r*.42,.30,z+r*.72,.20,'#b8afa0');
   }else rock(k,x,z,r*.95,r*1.08,high,'#6e7477');
  }
  for(const [x,z,r] of M.craters||[]){
   const pts=[[r*.80,.005],[r*.92,.10],[r*1.01,.15],[r*1.10,.065],[r*1.20,.002]].map(p=>new THREE.Vector2(...p));put(k,new THREE.LatheGeometry(pts,high?32:12),'paint','#535b5f',[x,0,z]);
   if(high)for(let i=0;i<8;i++){const a=i*Math.PI/4,j=seed(x+i,z),rad=r*(1.03+j*.13);rock(k,x+Math.cos(a)*rad,z+Math.sin(a)*rad,.065+j*.04,.05+j*.07,false,'#747b7d');}
  }
  // Slab/frame is below the walking surface. No new walls or navigational objects.
  part(k,[W+.50,1.9,H+.50],[W/2,-.96,H/2],'#1e2932');
  for(const z of [-.14,H+.14]){part(k,[W,.09,.13],[W/2,-.04,z],'#58646b','steel');part(glow,[W*.85,.018,.025],[W/2,.012,z],STYLES[id].accent,'energy');}
  for(const x of [-.14,W+.14])part(k,[.12,.10,H],[x,-.04,H/2],'#505e67','steel');
  return {id,quality:q,k,glow,obstacles:(M.walls||[]).map(x=>x.slice()),bridge:M.bridge?JSON.parse(JSON.stringify(M.bridge)):null};
 }
 function terrain(id,q){
  const idq=id+'|'+q;let e=TERRAIN.get(idq);if(e){TERRAIN.delete(idq);TERRAIN.set(idq,e);e.refs++;return e;}
  const high=q==='high',ppu=high?16:8,w=W*ppu,h=H*ppu,cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d'),style=STYLES[id],M=MAPS[id];
  c.fillStyle=style.floor;c.fillRect(0,0,w,h);
  // Private stable generator: never calls the sim's random()/Math.random().
  let state=7403+Object.keys(STYLES).indexOf(id)*977;const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let i=0;i<(high?2400:650);i++){
   const x=rnd()*w,y=rnd()*h,r=.3+rnd()*2.5,v=rnd();c.fillStyle=v>.55?'#858b8918':'#121d2528';c.beginPath();c.ellipse(x,y,r*1.8,r,0,0,Math.PI*2);c.fill();
  }
  // Traffic tracks are flat dust, not new lanes or collision boundaries.
  c.strokeStyle='#b9b3a111';c.lineWidth=ppu*.13;
  for(const x of [5.2,5.7,14.3,14.8]){c.beginPath();c.moveTo(x*ppu,3*ppu);c.bezierCurveTo((x+1)*ppu,10*ppu,(x-1)*ppu,20*ppu,x*ppu,29*ppu);c.stroke();}
  for(const [x,z,dw,dh] of M.walls||[]){c.fillStyle='#0c161e50';c.fillRect((x-.10)*ppu,(z-.10)*ppu,(dw+.20)*ppu,(dh+.20)*ppu);}
  for(const [x,z,r] of M.craters||[]){const g=c.createRadialGradient(x*ppu,z*ppu,r*.25*ppu,x*ppu,z*ppu,r*ppu);g.addColorStop(0,'#19222c');g.addColorStop(.74,'#252e36');g.addColorStop(1,'#6b717240');c.fillStyle=g;c.beginPath();c.arc(x*ppu,z*ppu,r*ppu,0,Math.PI*2);c.fill();c.strokeStyle='#a2aaa744';c.lineWidth=1;c.stroke();}
  c.strokeStyle='#a3afb018';c.lineWidth=1;for(let x=2;x<W;x+=2){c.beginPath();c.moveTo(x*ppu,ppu);c.lineTo(x*ppu,(H-1)*ppu);c.stroke();}
  for(const [z,col] of [[2,'#9b626a'],[H-2,'#527993']]){c.strokeStyle=col;c.lineWidth=ppu*.06;for(let x=2;x<W-1;x+=2){c.beginPath();c.moveTo(x*ppu,z*ppu);c.lineTo((x+.6)*ppu,z*ppu);c.stroke();}}
  const base=new THREE.CanvasTexture(cv);base.colorSpace=THREE.SRGBColorSpace;base.anisotropy=high?2:1;
  let normal=null;if(high){const nc=document.createElement('canvas');nc.width=w/2;nc.height=h/2;const n=nc.getContext('2d'),im=n.createImageData(nc.width,nc.height);for(let i=0;i<im.data.length;i+=4){im.data[i]=126+Math.floor(rnd()*5);im.data[i+1]=126+Math.floor(rnd()*5);im.data[i+2]=254;im.data[i+3]=255;}n.putImageData(im,0,0);normal=new THREE.CanvasTexture(nc);normal.colorSpace=THREE.LinearSRGBColorSpace;}
  e={key:idq,refs:1,base,normal,bytes:w*h*4*(high?1.25:1)};TERRAIN.set(idq,e);trimTerrain();return e;
 }
 function trimTerrain(){for(const [key,e] of TERRAIN){if(TERRAIN.size<=MAX_TERRAIN)break;if(e.refs)continue;e.base.dispose();e.normal?.dispose();TERRAIN.delete(key);}}
 function ground(id,q){const t=terrain(id,q),m=q==='high'?new THREE.MeshStandardMaterial({map:t.base,normalMap:t.normal,normalScale:new THREE.Vector2(.18,.18),roughness:.96,metalness:0}):new THREE.MeshLambertMaterial({map:t.base});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(W,H),m);mesh.rotation.x=-Math.PI/2;mesh.position.set(W/2,.002,H/2);mesh.userData.envTextureLease=t.key;mesh.userData.envOwnedMaterial=true;return mesh;}
 function stencil(text,w,h,q){
  const cv=document.createElement('canvas');cv.width=q==='high'?512:256;cv.height=96;const c=cv.getContext('2d');c.clearRect(0,0,cv.width,96);c.fillStyle='#a6b5b8';c.font='600 '+(q==='high'?31:16)+'px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,cv.width/2,48,cv.width-18);
  const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,opacity:.72,toneMapped:true}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);mesh.userData.envOwnedMaterial=true;mesh.userData.envOwnedTexture=true;return mesh;
 }
 function lightRig(scene,on){
  let d=0;for(const l of scene.children){if(l.isHemisphereLight){l.intensity=on?.92:1.7;l.color.setHex(on?0xbacdd8:0xd2ddff);l.groundColor.setHex(on?0x1b2630:0x3a3344);}else if(l.isDirectionalLight){l.intensity=on?(d? .65:2.35):(d?.55:2.6);l.color.setHex(on?(d?0x8cb7d2:0xede5d5):(d?0x7fa6ff:0xfff1dc));d++;}}
 }
 function groupOf(k){return M3.meshOf(bake(k),null,{});}
 function buildMap(id,mats,q){
  q=q==='low'?'low':'high';
  const raw=mapKit(id,q),G=new THREE.Group();G.name='environment:'+raw.id;G.add(groupOf(raw.k),groupOf(raw.glow));const g=ground(raw.id,q);G.add(g);
  const bridge=raw.bridge?M3.bridgeVisual(raw.bridge,mats):null;if(bridge){
   const colors=[['#3d4362','#52636b'],['#454b6c','#4b5c65'],['#7a82ad','#8c9a9e'],['#8a92bd','#89969a'],['#ffcf4a','#c4b28a']].map(([a,b])=>[new THREE.Color(a),new THREE.Color(b)]);bridge.group.traverse(o=>{const a=o.geometry?.attributes.color;if(!a)return;for(let i=0;i<a.count;i++)for(const [old,c] of colors)if(Math.abs(a.getX(i)-old.r)+Math.abs(a.getY(i)-old.g)+Math.abs(a.getZ(i)-old.b)<.0001){a.setXYZ(i,c.r,c.g,c.b);break;}});G.add(bridge.group);}
  // Deck-only detail is hidden beneath the player, alongside the existing exact bridge fade.
  let top=null;if(raw.bridge){const d=kit(q),[x,z,w,h]=raw.bridge.deck;for(const side of [-1,1])for(let i=0;i<8;i++){const X=x+.55+i*(w-1.1)/7;part(d,[.45,.01,.12],[X,M3.DECK_H+.008,z+h/2+side*(h/2-.30)],'#a29a78');}for(const [rx,rz,rw,rh,o] of raw.bridge.ramps)for(let i=1;i<4;i++){const f=i/4,Z=rz+rh*f,Y=M3.DECK_H*(o<0?f:1-f);for(const side of [-1,1])part(d,[.25,.015,.045],[rx+rw/2+side*.28,Y+.018,Z],'#bfb99e','paint');}top=groupOf(d);G.add(top);}
  const out={group:G,deck:bridge?.deck||null,spin:[],ground:g,env:true,id:raw.id,q,top,disposed:false,obstacles:raw.obstacles};out.dispose=()=>dispose(out);return out;
 }
 function dispose(map){
  if(!map||map.disposed)return;map.disposed=true;const seen=new Set();map.group.traverse(o=>{if(o.geometry&&!o.geometry.userData.hfShared&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}if(o.userData.envOwnedMaterial){if(o.userData.envOwnedTexture)o.material.map?.dispose();o.material.dispose();const t=TERRAIN.get(o.userData.envTextureLease);if(t)t.refs=Math.max(0,t.refs-1);}});trimTerrain();
 }
 function updateMap(map,under){if(map?.top)map.top.visible=!under;}
 function stageKit(kind='inspection',q='high'){
  q=q==='low'?'low':'high';
  const k=kit(q),high=q==='high',engineer=kind==='engineer';
  // Open front/roof: vehicle remains the central readable silhouette at every inspection angle.
  panel(k,0,-.22,0,7.5,6.4,.17,'#28323b');panel(k,0,-.066,0,5.5,4.7,.045,'#424b50');
  for(const s of [-1,1]){
   part(k,[.22,.05,5.9],[s*3.0,-.035,0],'#131e27','rubber');part(k,[.035,.019,4.6],[s*2.85,-.018,0],'#b8a37c','gold');
   for(let i=0;i<8;i++)part(k,[.21,.02,.045],[s*3.0,-.006,-2.50+i*.67],'#8a9498','steel');
   // Gantry uprights are behind / outside the vehicle's bounded inspection envelope.
   panel(k,s*4.6,-.16,-4.2,.55,.65,3.2,'#222d37');
   part(k,[.11,2.75,.10],[s*4.52,1.4,-3.80],'#7c898f','steel');lamp(k,s*4.52,2.60,-3.735,.15,'#a5cad5');
   panel(k,s*3.75,.02,-1.80,.65,.90,.75,'#34444e');C().vents(k,{dark:ink.dark},s*3.75,.78,-1.8,.37,.48,high?8:3);
   if(high)for(let j=0;j<4;j++)part(k,[.03,.10,.50],[s*3.76,.14+j*.13,-1.8],'#c2aa7a','gold');
   for(let i=0;i<5;i++)lamp(k,s*2.35,-.007,-2.0+i,.21,'#94bbc8');
   if(engineer){
    panel(k,s*4.2,.03,.38,.55,1.15,.24,'#39434b');line(k,[s*4.2,.30,.25],[s*3.9,.75,.25],.05,'#819298');line(k,[s*3.9,.75,.25],[s*3.5,.85,.25],.04,'#b19c72','gold');
    put(k,cyl(.12,.07,high?16:8),'steel','#a6b5bb',[s*3.5,.85,.25],[0,0,Math.PI/2]);
   }
  }
  // Rear bulkhead panels, recessed gantry and practical service cabinets; no giant glowing halo.
  panel(k,0,-.16,-4.8,10.2,.32,3.25,'#202c35');
  const count=high?7:4;for(let i=0;i<count;i++){const x=-3.15+i*6.30/(count-1);panel(k,x,.30,-4.59,.72,.065,2.1,'#34434c');part(k,[.57,.024,.012],[x,2.30,-4.54],'#77878f','steel');}
  part(k,[7.9,.20,.55],[0,3.18,-4.26],'#77878c','steel');part(k,[6.8,.07,.06],[0,3.10,-3.94],'#b0c8c9','energy');
  panel(k,0,.30,-4.49,1.65,.13,1.23,'#14212b');part(k,[1.25,.02,.025],[0,1.36,-4.40],'#c8ab79','gold');
  if(high){boltRow(k,-2.9,-.008,2.42,.48,13);for(const s of [-1,1])panel(k,s*2.10,-.035,-2.32,.65,.48,.035,'#b19a70','gold');}
  return {k,kind,quality:q};
 }
 function buildStage(kind,q){const r=stageKit(kind,q),group=groupOf(r.k),sign=stencil(kind==='engineer'?'LUNAR / ENGINEERING':kind==='garage'?'LUNAR / PRIVATE ARSENAL':'LUNAR / INSPECTION',1.45,.30,q);sign.position.set(0,1.02,-4.39);group.add(sign);group.name='lunar-'+kind;const stage={group,kind,q,disposed:false};stage.dispose=()=>dispose(stage);return stage;}
 function modeKit(mode,id,q='high',mine){
  const k=kit(q),m=MODES[mode]||MODES.arena,high=q==='high';
  // Flush painted bands at the arena ends, outside active objective centers and firing lanes.
  for(const z of [1.10,H-1.10])for(let i=0;i<(high?8:4);i++)part(k,[high?.7:1.1,.012,.07],[2.4+i*(W-4.8)/(high?7:3),.014,z],m.color,'paint');
  if(mode==='bounty')for(const z of [2.2,H-2.2]){const g=M3.starGeo(.30,.008);g.rotateX(-Math.PI/2);put(k,g,'gold','#bb9f70',[W/2,.018,z]);}
  if(mode==='boss')for(const z of [2,H-2])for(const s of [-1,1]){part(k,[.6,.012,.06],[W/2+s*.6,.016,z],'#bd9277');}
  if(mode==='crystal')for(const z of [2,H-2])put(k,new THREE.OctahedronGeometry(.20),'steel','#9e89b2',[W/2,.055,z],[0,0,Math.PI/4],[1,.18,1]);
  if(mode==='royale')for(const z of [.45,H-.45])part(k,[W-1.0,.013,.04],[W/2,.017,z],'#8c7eae','paint');
  if(mode==='crystal'&&mine){put(k,cyl(.78,.025,q==='high'?24:12),'steel','#65717c',[mine.x,.018,mine.y]);for(const s of [-1,1])part(k,[.26,.014,.055],[mine.x+s*.98,.024,mine.y],m.color,'paint');}
  return {k,mode,label:m.label};
 }
 function modeContext(mode,id,q,mine){const raw=modeKit(mode,id,q,mine),g=groupOf(raw.k);g.name='mode:'+mode;const label=stencil(raw.label,3.1,.55,q);label.rotation.x=-Math.PI/2;label.position.set(W/2,.022,H-1.65);g.add(label);g.traverse(o=>{if(o.geometry)o.userData.rangeOwnedGeometry=true;});return g;}
 function refresh(){if(typeof document!=='undefined')document.body?.classList.toggle('hf-environment',active());}
 if(typeof addEventListener==='function')addEventListener('lunar-graphics-ready',refresh);
 function stats(){return {version:VERSION,terrain:[...TERRAIN.values()].map(e=>({key:e.key,refs:e.refs,bytes:e.bytes})),bytes:[...TERRAIN.values()].reduce((n,e)=>n+e.bytes,0)};}
 return {VERSION,STYLES,MODES,active,key,mapKit,stageKit,modeKit,bake,buildMap,buildStage,modeContext,updateMap,lightRig,dispose,refresh,stats};
})();
