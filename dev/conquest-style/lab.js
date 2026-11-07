/* LUNAR Conquest style lab — dev-only harness for Phase 1 visual options (never loaded by the game).
 *
 * Every option renders the SAME canonical subjects: real terrain heights (ConquestWorld), real collision
 * footprints, real scenery placement, the real player tank kit and fixed camera framing. Screenshots
 * therefore compare art direction, not framing. URL: lab.html?opt=<id>&subject=<s>&q=high|low[&t=sec]
 * subjects: refuge · raid · tank · enemy · props · map.   opt=current renders the live build's look.
 * An option is one script, options/<id>/style.js, that calls ConquestStyleLab.register({...}); see README.md.
 */
(function(root){
'use strict';
const params=new URLSearchParams(location.search);
const OPT=params.get('opt')||'current',SUBJECT=params.get('subject')||'refuge',QUALITY=params.get('q')==='low'?'low':'high';
const FIXED_T=params.has('t')?Number(params.get('t')):null,SUBJECTS=['refuge','raid','tank','enemy','props','map'];
const W=root.ConquestWorld,C=root.ConquestCombat,T=root.THREE;
const registry=new Map();
const tag=document.getElementById('lab-tag'),errorBox=document.getElementById('lab-error');
function fail(e){errorBox.style.display='block';errorBox.textContent+=String(e&&e.stack||e)+'\n';root.labError=String(e&&e.message||e);}
addEventListener('error',e=>fail(e.error||e.message));addEventListener('unhandledrejection',e=>fail(e.reason));

// ---------- canonical data (read from the shared modules, never redefined) ----------
// Western Dust Switchback battery raid: the first (HARD) raid site players reach; flat ground; depot 78 m east.
const op=C.operations['raid-battery-1'],site=C.installations.find(s=>s.id==='west-depot');
const FOOTPRINTS=Object.freeze({
 refuge:{
  // Supply terminal (banking/repair point, C.refuge interaction radius 12). Not solid.
  terminal:{x:1174,z:1168,pad:5,interactRadius:C.refuge.radius},
  // Nine habitats: tanks are blocked inside radius 7.8 and shots below ground+9 within radius 8.
  habitats:Array.from({length:9},(_,i)=>({x:1110+i%3*22,z:1148+Math.floor(i/3)*25,solidRadius:7.8,shotHeight:9})),
  // Three oxygen processors: solid radius 12; shots blocked below ground+108 / +146 / +108. Current art: 9 m radius shaft.
  processors:Array.from({length:3},(_,i)=>({x:1150+i*30,z:1080,solidRadius:12,shotHeight:108+i%2*38,artHeight:90+i%2*38})),
  // Solar field (not solid): five 14 x 9 m panels tilted 0.3 rad.
  solar:Array.from({length:5},(_,i)=>({x:1098+i*22,z:1225,w:14,d:9,tilt:.3})),
  base:{x:C.baseDefinition.x,z:C.baseDefinition.z,pad:[38,34]},
  viaduct:{x0:900,x1:1140,zA:1015,zB:1033,deck:24,pillars:[[970,1018],[970,1030],[1070,1018],[1070,1030]]}
 },
 raid:{
  operation:{id:op.id,name:op.name,family:op.family,layout:op.layout,danger:op.danger,x:op.x,z:op.z,entry:op.entry,route:op.route},
  // Parasite installation: tanks blocked in a 22 x 16 box centred (x, z+8) and a radius-2 mast at (x+14, z+10);
  // shots blocked by an 18 x 12 x 12 m bunker at (x, z+8). Current art: 32 x 30 apron, 18 x 8 x 12 bunker, 20 m mast.
  installation:{id:site.id,name:site.name,x:site.x,z:site.z,solid:{x:site.x,z:site.z+8,width:22,depth:16},shot:{x:site.x,z:site.z+8,width:18,depth:12,height:12},mast:{x:site.x+14,z:site.z+10,radius:2,height:20}},
  // Raid cover: exact authoritative boxes (collision + shot occlusion share these numbers).
  obstacles:W.raidObstacles.filter(o=>o.layout===op.layout).map(o=>({...o})),
  // Battery-family objectives: immobile Parasite plasma batteries (enemy turrets), shot-damageable.
  batteries:[{x:op.x,z:op.z},{x:op.x+22,z:op.z-12}],
  // The game places the Blender "raid" battery art here as decor during the raid.
  raidArt:{x:op.x+45,z:op.z+15},
  // Mobile garrison shown at plausible patrol positions inside the portrait frame (they move in play).
  enemies:[{id:'raider',kind:'raider',cls:'scout',arch:'twin',x:op.x+22,z:op.z+10},{id:'command',kind:'command',cls:'titan',arch:'pulse',x:op.x+40,z:op.z}]
 }
});
const PLAYER_LOADOUT=Object.freeze(structuredClone(STOCK_L));

// ---------- fixed camera framing per subject (heights are metres above the local ground) ----------
const FRAMES={
 // from/to: [x, height, z]; heights are metres above the ground at the TARGET point (terrain here is steep).
 refuge:{focus:[1140,1160],from:[1063,74,1306],to:[1150,2,1122]},
 raid:{focus:[930,945],from:[866,17,961],to:[952,2,941],player:{x:899,z:952,heading:1.75}},
 tank:{focus:[1104,1124],from:[1093.5,5.6,1114.2],to:[1104,1.7,1124.5],player:{x:1104,z:1124,heading:2.25}},
 enemy:{focus:[1292,786],from:[1298.6,3.9,793.2],to:[1292.2,1.7,786.2],enemy:{id:'raider',kind:'raider',cls:'scout',arch:'twin',x:1292,z:786,heading:.75}},
 // Props: the real scenery placement (southern terraformed field + rocks); lineup strip starts 14 m in front of the camera.
 props:{focus:[1180,1000],from:[1187,15,1052],to:[1180,2,990],lineup:{x:1186,z:1036,heading:Math.PI}},
 map:{}
};
if(params.has('cam')){const c=params.get('cam').split(',').map(Number);if(c.length===6&&c.every(Number.isFinite)&&FRAMES[SUBJECT]){FRAMES[SUBJECT].from=c.slice(0,3);FRAMES[SUBJECT].to=c.slice(3);}}
// ---------- small helpers ----------
const ground=(x,z)=>W.groundAt(x,z);
function planarUv(positions,ox,oz){const uv=new Float32Array(positions.length/3*2);for(let i=0,j=0;i<positions.length;i+=3,j+=2){uv[j]=(positions[i]+ox)/24;uv[j+1]=(positions[i+2]+oz)/24;}return uv;}
const colorCache=new Map();
function lambert(color){return colorCache.get(color)||(colorCache.set(color,new T.MeshLambertMaterial({color})),colorCache.get(color));}
const shapes={box:new T.BoxGeometry(1,1,1),cone:new T.ConeGeometry(1,1,7),sphere:new T.IcosahedronGeometry(1,1),rock:new T.IcosahedronGeometry(1,0),cylinder:new T.CylinderGeometry(1,1,1,10)};
function form(group,geo,x,y,z,w,h,d,color){const m=new T.Mesh(geo,lambert(color));m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;}
const cube=(group,x,y,z,w,h,d,color)=>form(group,shapes.box,x,y,z,w,h,d,color);
const archMaterial=new T.MeshLambertMaterial({vertexColors:true});
// Same merge the game uses (view.js mergeArchitecture): one vertex-coloured draw per group.
function merge(group,material=archMaterial){const positions=[],normals=[],colors=[],indices=[];group.updateWorldMatrix(true,true);const inverse=new T.Matrix4().copy(group.matrixWorld).invert();
 group.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld)),a=g.attributes.position,b=g.attributes.normal,offset=positions.length/3,c=o.material.color||new T.Color(1,1,1),vc=g.attributes.color;
  for(let i=0;i<a.count;i++){positions.push(a.getX(i),a.getY(i),a.getZ(i));normals.push(b.getX(i),b.getY(i),b.getZ(i));colors.push(vc?vc.getX(i)*c.r:c.r,vc?vc.getY(i)*c.g:c.g,vc?vc.getZ(i)*c.b:c.b);}
  const ix=g.index?g.index.array:Array.from({length:a.count},(_,i)=>i);for(const i of ix)indices.push(i+offset);g.dispose();});
 const geo=new T.BufferGeometry();for(const [k,a] of [['position',positions],['normal',normals],['color',colors]])geo.setAttribute(k,new T.Float32BufferAttribute(a,3));geo.setIndex(indices);group.clear();group.add(new T.Mesh(geo,material));return group;}
// Orient an object like the game does for hulls: +Z forward along heading, up = terrain normal.
function orient(obj,x,z,heading,flat=false){const up=new T.Vector3(...(flat?[0,1,0]:W.surfaceNormal(x,z))),forward=new T.Vector3(Math.sin(heading),0,Math.cos(heading));forward.addScaledVector(up,-forward.dot(up)).normalize();const right=new T.Vector3().crossVectors(up,forward).normalize();obj.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,forward));}

// ---------- the CURRENT live-build look (ported 1:1 from js/conquest/view.js + app.js) ----------
const current={
 id:'current',name:'CURRENT LIVE BUILD',summary:'Build 20261106233738 as shipped (reference).',
 environment(api){api.scene.background=new T.Color(0x101b29);api.scene.fog=new T.Fog(0x101b29,1100,2560);api.scene.add(new T.HemisphereLight(0xc4ddff,0x353025,.85));const sun=new T.DirectionalLight(0xffe5ba,2.8);sun.position.set(-100,180,-70);api.scene.add(sun);},
 terrainMaterial(){const surface=document.createElement('canvas');surface.width=surface.height=128;const ctx=surface.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=82741;for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;const v=185+(seed>>>26);pixels.data.set([v,v,v,255],i);}ctx.putImageData(pixels,0,0);const t=new T.CanvasTexture(surface);t.wrapS=t.wrapT=T.RepeatWrapping;return new T.MeshLambertMaterial({vertexColors:true,map:t});},
 props(api,list,chunk){const group=new T.Group(),trees=list.filter(p=>p.kind==='tree'),pines=trees.filter(p=>p.variant>=.4),broad=trees.filter(p=>p.variant<.4),relays=list.filter(p=>p.kind==='relay'),rocks=list.filter(p=>p.kind==='rock'&&p.variant>.45);
  const batch=(items,geo,color,shape)=>{if(!items.length)return;const mesh=new T.InstancedMesh(geo,lambert(color),items.length),o=new T.Object3D();items.forEach((p,i)=>{o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);shape(o,p);o.position.x+=p.x-chunk.cx*128;o.position.z+=p.z-chunk.cz*128;o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});group.add(mesh);};
  batch(trees,shapes.cylinder,0x625345,(o,p)=>{o.position.set(0,p.y+p.size*1.6,0);o.scale.set(.22*p.size,3.2*p.size,.22*p.size);});
  for(let level=0;level<2;level++)batch(pines,shapes.cone,level?0x4e7964:0x304f45,(o,p)=>{o.position.set(0,p.y+p.size*(3.1+level*1.4),0);o.scale.set(p.size*(1.6-level*.4),p.size*3,p.size*(1.6-level*.4));});
  batch(broad,shapes.sphere,0x577761,(o,p)=>{o.position.set(0,p.y+p.size*3.8,0);o.scale.set(p.size*1.9,p.size*1.5,p.size*1.9);});
  batch(relays,shapes.cylinder,0x4b5664,(o,p)=>{o.position.set(0,p.y+6,0);o.scale.set(.35,12,.35);});batch(relays,shapes.sphere,0x9f947e,(o,p)=>{o.position.set(0,p.y+12,0);o.scale.set(3,.3,2);o.rotation.z=.6;});
  batch(rocks,shapes.rock,0x727781,(o,p)=>{o.position.set(0,p.y+p.size*.3,0);o.scale.set(p.size*1.6,p.size*(.5+p.variant),p.size);o.rotation.set(p.variant,0,p.variant*.4);});
  return group;},
 refuge(api,f){const g=new T.Group();const sy=ground(1174,1168);cube(g,1174,sy+.15,1168,5,.3,5,0x617d89);cube(g,1174,sy+1.8,1168,2.4,3.6,1.4,0x254552);cube(g,1174,sy+2.6,1167.25,1.9,1.2,.1,0x8ee5e9);
  for(let i=0;i<3;i++){const x=1150+i*30,z=1080,y=ground(x,z),h=90+i%2*38;form(g,shapes.cylinder,x,y+h/2,z,9,h,9,0x657e88);form(g,shapes.cone,x,y+h+8,z,12,16,12,0xb3c9d0);for(let k=1;k<5;k++)form(g,shapes.cylinder,x,y+h*k/5,z,10.5,1.6,10.5,k===4?0x8ee5e9:0xb0b8b9);for(const dx of [-13,13]){cube(g,x+dx,y+h*.25,z,2,h*.5,3,0x404e5a);cube(g,x+dx/2,y+8,z,14,2,3,0xa7b7b9);}cube(g,x+15,y+4,z+15,32,3,3,0x7c919c);}
  for(let i=0;i<9;i++){const x=1110+i%3*22,z=1148+Math.floor(i/3)*25,y=ground(x,z);form(g,shapes.cylinder,x,y+3,z,7,6,7,0x8b9da5);form(g,shapes.sphere,x,y+6,z,7.5,3.5,7.5,0xc1cbd0);cube(g,x,y+3,z-7,8,1,.3,0x75d8ea);cube(g,x+9,y+.15,z,3,.3,17,0xb9a47c);cube(g,x+9,y+8,z+5,.25,16,.25,0x96bac4);cube(g,x+9,y+15,z+5,4,.2,.3,0xf3c780);}
  for(let i=0;i<5;i++){const x=1098+i*22,z=1225,y=ground(x,z);const panel=cube(g,x,y+2,z,14,.3,9,0x233e59);panel.rotation.x=.3;}
  return merge(g);},
 raidSite(api,f){const g=new T.Group(),b=f.installation,y=ground(b.x,b.z);cube(g,b.x,y+.12,b.z,32,.24,30,0x282c34);cube(g,b.x,y+4,b.z+8,18,8,12,0x393440);cube(g,b.x,y+7,b.z+1.8,14,1,.4,0xff4b48);form(g,shapes.cone,b.x,y+10,b.z+8,12,5,9,0x652f3e);cube(g,b.x+14,y+10,b.z+10,.5,20,.5,0x81323b);form(g,shapes.sphere,b.x+14,y+20,b.z+10,1.5,1.5,1.5,0xff3f44);
  for(const o of f.obstacles){const oy=ground(o.x,o.z);cube(g,o.x,oy+o.height/2,o.z,o.width,o.height,o.depth,0x4c4651);cube(g,o.x,oy+o.height+.15,o.z,o.width,.3,o.depth,0x97645c);}
  merge(g);const art=root.ConquestAssets.make(T,'raid',api.quality);if(art){art.position.set(f.raidArt.x,ground(f.raidArt.x,f.raidArt.z),f.raidArt.z);g.add(art);}return g;},
 playerTank(api,vehicle){return vehicle;},
 enemy(api,e){const g=new T.Group(),body=new T.Group();body.rotation.y=-Math.PI/2;g.add(body);
  if(e.immobile){cube(g,0,1,0,7,2,6,0x4f4659);form(g,shapes.cylinder,0,5,0,.4,8,.4,0xb7a2b9);form(g,shapes.sphere,0,9,0,3,.5,2,0xff6966);g.userData.gun=new T.Group();g.userData.marker=form(g,shapes.cone,0,11,0,.6,1,.6,0xff4b48);return g;}
  const P=PAINTS.stock,H=M3.chassisKit(e.cls||'scout',0,P,'#ef665d',[],false);body.add(M3.meshOf(M3.bake(H.k),null,api.modelMats));merge(body);
  const gun=new T.Group();gun.position.y=H.meta.ty;gun.scale.setScalar(M3.weaponScale(e.arch,e.cls));gun.add(M3.meshOf(M3.bake(M3.weaponKit(e.arch,0,P,'#ef665d',false,e.cls).k),null,api.modelMats));merge(gun);body.add(gun);
  g.userData.gun=gun;g.userData.marker=form(g,shapes.cone,0,5,0,.6,1,.6,0xff4b48);g.scale.setScalar(1.65);return g;},
 map(ctx,m){currentMap(ctx,m);}
};
// Port of js/conquest/app.js map() draw(): same geometry, colours and marker semantics.
const terrainTiles=new Map();
function currentMap(ctx,m){const {scale,px,py,discovery:d,state:S}=m,unit=280/W.WIDTH*scale,left=(-40-px)/unit,right=(320-px)/unit,top=W.LENGTH+py/unit,bottom=W.LENGTH+(py-420)/unit;
 ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle='#080e16';ctx.fillRect(0,0,360,420);ctx.save();ctx.translate(40+px,py+420*scale);ctx.scale(unit,-unit);
 const cells=d.cellsIn({x:left,z:bottom,width:right-left,height:top-bottom});ctx.beginPath();for(const cell of cells)ctx.rect(cell.x,cell.z,cell.size,cell.size);ctx.clip();const painted=new Set();
 for(const cell of cells){const resolution=scale>=64?8:scale>=16?32:128,tx=resolution===128?Math.floor(cell.x/128)*128:cell.x,tz=resolution===128?Math.floor(cell.z/128)*128:cell.z,key=tx+':'+tz+':'+resolution;if(painted.has(key))continue;painted.add(key);let tile=terrainTiles.get(key);if(!tile){tile=[];const colorAt=(x,z)=>{const h=W.heightAt(x,z),b=W.biomeAt(x,z),normal=W.normalAt(x,z),l=Math.max(18,Math.min(65,35+h*.035+normal[0]*14+normal[2]*10));return b==='terraformed'?'hsl(140 24% '+l+'%)':b==='massif'?'hsl(210 12% '+l+'%)':'hsl(35 13% '+l+'%)';};
  if(resolution===128)tile.push([tx,tz,colorAt(cell.x+16,cell.z+16)]);else for(let z=cell.z;z<cell.z+32;z+=resolution)for(let x=cell.x;x<cell.x+32;x+=resolution)tile.push([x,z,colorAt(x,z)]);terrainTiles.set(key,tile);}for(const [x,z,color] of tile){ctx.fillStyle=color;ctx.fillRect(x-4,z-4,resolution+8,resolution+8);}}
 if(scale>=32){const chunks=new Set();for(const cell of cells){const cx=Math.floor(cell.x/128),cz=Math.floor(cell.z/128),key=cx+':'+cz;if(chunks.has(key))continue;chunks.add(key);for(const item of W.scenery(cx,cz)){if(!d.has(item.x,item.z))continue;ctx.fillStyle=item.kind==='tree'?'#294d3d':item.kind==='relay'?'#b2c3c7':'#94918b';ctx.beginPath();ctx.arc(item.x,item.z,item.kind==='tree'?item.size*2:item.size,0,Math.PI*2);ctx.fill();}}}
 ctx.strokeStyle='#b7ad89';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(900,1024);ctx.lineTo(1140,1024);ctx.stroke();ctx.strokeStyle='#718a9b';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(960,1024);ctx.lineTo(1080,1024);ctx.stroke();
 if(scale>=32){ctx.strokeStyle='#a2bdc7';ctx.lineWidth=1.5;for(let i=0;i<3;i++){ctx.fillStyle='#637f8b';ctx.beginPath();ctx.arc(1150+i*30,1080,10,0,7);ctx.fill();ctx.stroke();}for(let i=0;i<9;i++){const x=1110+i%3*22,z=1148+Math.floor(i/3)*25;ctx.fillStyle='#b0bdba';ctx.beginPath();ctx.arc(x,z,7.5,0,7);ctx.fill();}ctx.fillStyle='#233e59';for(let i=0;i<5;i++)ctx.fillRect(1091+i*22,1220.5,14,9);}
 for(const l of W.landmarks){if(!d.has(l.x,l.z))continue;ctx.fillStyle=l.id==='oxygen-01'||l.id==='refuge-01'?'#79dce8':'#b7ad89';ctx.beginPath();ctx.arc(l.x,l.z,Math.max(3,3/unit),0,7);ctx.fill();if(scale>=16){ctx.save();ctx.translate(l.x+7/unit,l.z);ctx.scale(1/unit,-1/unit);ctx.font='11px sans-serif';ctx.fillStyle='#f3ddb0';ctx.fillText(l.name,0,0);ctx.restore();}}
 if(scale>=16)for(const cell of cells){const x=cell.x,z=cell.z,n=cell.size;for(const [nx,nz,ax,az,bx,bz,w,h] of [[x-1,z+16,x,z,x+8,z,8,n],[x+33,z+16,x+n,z,x+n-8,z,8,n],[x+16,z-1,x,z,x,z+8,n,8],[x+16,z+33,x,z+n,x,z+n-8,n,8]]){if(d.has(nx,nz))continue;const gr=ctx.createLinearGradient(ax,az,bx,bz);gr.addColorStop(0,'#080e16');gr.addColorStop(1,'rgba(8,14,22,0)');ctx.fillStyle=gr;ctx.fillRect(Math.min(ax,bx),Math.min(az,bz),w,h);}}
 ctx.restore();ctx.strokeStyle='#34404b';ctx.strokeRect(40+px,py,280*scale,420*scale);
 const marker=(item,symbol,color)=>{const p=m.toScreen(item.x,item.z);ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(symbol,p.x,p.y+5);ctx.textAlign='left';if(scale>=32){ctx.font='10px sans-serif';ctx.fillText(item.name,p.x+10,p.y+3);}};
 for(const s of C.installations)if(d.has(s.x,s.z))marker(s,S.territory?.[s.id]?.owner==='humanity'?'⚑':'▲',S.territory?.[s.id]?.owner==='humanity'?'#82e8ce':'#ff7972');
 const ops=Object.values(C.operations);for(const o of ops){if(o.raid||o.defense||o.id==='base-defense'||o.id==='oxygen-line'||C.installations.some(s=>s.id===o.site))continue;const secured=S.territory?.[o.site]?.owner==='humanity';marker(o,secured?'⚑':'◆',secured?'#82e8ce':'#f1cd7e');}
 for(const sector of C.sectors){const list=ops.filter(o=>o.raid&&o.sector===sector.id);if(list.length){const cleared=list.filter(o=>S.completed?.[o.id]).length;marker({x:list.reduce((n,o)=>n+o.x,0)/list.length,z:list.reduce((n,o)=>n+o.z,0)/list.length,name:sector.name+(C.raidsUnlocked(S.completed)?' RAIDS '+cleared+'/'+list.length:' RAIDS · LOCKED')},cleared===list.length?'✓':'✦',cleared===list.length?'#82e8ce':C.raidsUnlocked(S.completed)?'#ffb56b':'#8a8f96');}if(C.sectorDefenseOpen(S.territory?.[sector.id],sector.id)){const o=ops.find(o=>o.defense&&o.sector===sector.id);if(o)marker({...o,name:(S.territory[sector.id].owner==='humanity'?'DEFEND ':'RETAKE ')+sector.name},'!','#ff7972');}}
 const label=(item,text,color,leftSide=false)=>{const p=m.toScreen(item.x,item.z),x=p.x+(leftSide?-10:10),y=p.y+(leftSide?14:3);ctx.font='bold 10px sans-serif';ctx.textAlign=leftSide?'right':'left';ctx.lineWidth=3;ctx.strokeStyle='#080e16';ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.textAlign='left';};
 marker({...C.baseDefinition,name:''},'⌂','#ffc96b');label(C.baseDefinition,'COMMAND BASE '+(S.base?.tier?'T'+S.base.tier:'SITE'),'#ffc96b',true);
 for(const w of S.wrecks||[])if(d.has(w.x,w.z))marker({...w,name:'PERSONAL WRECK'},'◇','#8ee6ef');
 marker({...C.refuge,name:''},'●','#79dce8');label(C.refuge,'REFUGE','#79dce8');
 const p=m.toScreen(m.player.x,m.player.z),t=m.routeTarget;if(t){const q=m.toScreen(t.x,t.z);ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle='#f4cf77';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.restore();}
 ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='rgba(105,215,255,.25)';ctx.beginPath();ctx.arc(0,0,11,0,7);ctx.fill();ctx.strokeStyle='#e7f9ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,11,0,7);ctx.stroke();ctx.rotate(m.player.heading);ctx.fillStyle='#69d7ff';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();ctx.restore();
 ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#080e16';ctx.strokeText('YOU',p.x,p.y-16);ctx.fillStyle='#fff';ctx.fillText('YOU',p.x,p.y-16);ctx.textAlign='left';ctx.fillStyle='#9facbb';ctx.font='10px sans-serif';ctx.fillText('N ↑  ·  '+Math.round(W.WIDTH/scale)+' units across theater frame',8,410);}

// ---------- registry / runtime ----------
function register(option){if(!option||typeof option.id!=='string')throw Error('option needs an id');registry.set(option.id,option);}
function pick(option,key){return typeof option[key]==='function'||key==='mapCss'||key==='mapLegend'?option[key]:current[key];}
let api,renderer,scene,camera,option,chunksGroup,clock0=performance.now(),frameTimes=[],updateFns=[];
const time=()=>FIXED_T!==null?FIXED_T:(performance.now()-clock0)/1000;

function textureBytes(t){const img=t.image;if(!img)return 0;const images=Array.isArray(img)?img:[img];let bytes=0;for(const i of images){const w=i.width||i.videoWidth||0,h=i.height||i.videoHeight||0,per=t.isDataTexture&&i.data?i.data.BYTES_PER_ELEMENT*(t.format===T.RGBAFormat||t.format===undefined?4:t.format===T.RedFormat?1:4):4;bytes+=w*h*per;}const mips=t.generateMipmaps!==false&&t.minFilter!==T.NearestFilter&&t.minFilter!==T.LinearFilter?4/3:1;return bytes*mips;}
function collectTextures(){const seen=new Set();const add=v=>{if(v&&v.isTexture)seen.add(v);};scene.traverse(o=>{const mats=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of mats){for(const k of Object.keys(m)){add(m[k]);}if(m.uniforms)for(const u of Object.values(m.uniforms)){add(u?.value);if(Array.isArray(u?.value))u.value.forEach(add);}}});add(scene.background);add(scene.environment);return seen;}
function stats(){const info=renderer.info,tex=collectTextures();let bytes=0;for(const t of tex)bytes+=textureBytes(t);const a=[...frameTimes].sort((x,y)=>x-y);
 return {option:OPT,subject:SUBJECT,quality:QUALITY,viewport:[innerWidth,innerHeight],pixelRatio:renderer.getPixelRatio(),drawCalls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,programs:info.programs?.length||0,textureMB:+(bytes/1048576).toFixed(2),shadowMap:!!renderer.shadowMap.enabled,frameMedianMs:a.length?+a[Math.floor(a.length/2)].toFixed(2):null,note:'SwiftShader software GL in a cloud container: relative cost only, not iPhone FPS'};}

function makeVehicle(L,modelMats){
 // Exactly the game's player hull assembly (view.js syncLoadout), without fitted cosmetics.
 const vehicle=new T.Group(),body=new T.Group();body.rotation.y=-Math.PI/2;vehicle.add(body);const P=PAINTS[L.paint]||PAINTS.stock,team='#88cbdc';
 const add=(raw,parent)=>{parent.add(M3.meshOf(M3.bake(raw.k),null,modelMats));for(const a of raw.anims||[]){const m=M3.meshOf(M3.bake(a.k),null,modelMats);m.position.set(...a.p);parent.add(m);}};
 const H=M3.chassisKit(L.c.c,L.c.t,P,team,L.cores,L.skin==='lunar');add(H,body);
 const gun=new T.Group();gun.position.y=H.meta.ty;body.add(gun);gun.scale.setScalar(M3.weaponScale(L.w.a,L.c.c));add(M3.weaponKit(L.w.a,L.w.t,P,team,L.skin==='lunar',L.c.c),gun);
 const fits=fittingVisuals(L),context={cls:L.c.c,ct:L.c.t,arch:L.w.a,wt:L.w.t,lunar:L.skin==='lunar'};add(M3.fittingKit(fits,team,'body',context),body);add(M3.fittingKit(fits,team,'mount',context),gun);
 vehicle.scale.setScalar(1.65);vehicle.userData={gun,body,chassis:H.meta,loadout:L};return vehicle;}

function terrain(focusX,focusZ,material){
 const mobile=innerWidth<=600,radius=mobile?2:4,fine=mobile?1:2,ox=api.origin.x,oz=api.origin.z,group=new T.Group();
 const keys=W.chunkKeys(focusX,focusZ,radius,fine);
 for(const k of keys){const d=W.chunk(k.cx,k.cz,k.step),g=new T.BufferGeometry();
  // Body + skirt merged exactly as view.js stream() does.
  const verts=[],idx=[];for(let side=0;side<4;side++)for(let t=0;t<=128;t+=k.step){const x=side===0?0:side===1?128:t,z=side===2?0:side===3?128:t,y=W.heightAt(k.cx*128+x,k.cz*128+z),n=verts.length/3;verts.push(x,y,z,x,y-14,z);if(t<128)idx.push(n,n+1,n+2,n+2,n+1,n+3);}
  const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(verts,3));skirt.setIndex(idx);skirt.computeVertexNormals();const offset=d.positions.length/3;
  g.setAttribute('position',new T.Float32BufferAttribute([...d.positions,...verts],3));g.setAttribute('normal',new T.Float32BufferAttribute([...d.normals,...skirt.attributes.normal.array],3));g.setAttribute('color',new T.Float32BufferAttribute([...d.colors,...verts.flatMap((_,i)=>i%3===0?[.41,.4,.37]:[])],3));
  const uv=planarUv(d.positions,k.cx*128,k.cz*128);g.setAttribute('uv',new T.Float32BufferAttribute([...uv,...verts.flatMap((_,i)=>i%3===0?[(verts[i]+k.cx*128)/24,(verts[i+2]+k.cz*128)/24]:[])],2));g.setIndex([...d.indices,...idx.map(i=>i+offset)]);skirt.dispose();
  g.userData.chunk={cx:k.cx,cz:k.cz,step:k.step};const chunk=new T.Group();chunk.add(new T.Mesh(g,material));chunk.position.set(k.cx*128-ox,0,k.cz*128-oz);chunk.userData.chunk=g.userData.chunk;
  if(k.step===4){const D=C.baseDefinition,list=W.scenery(k.cx,k.cz).filter(p=>p.kind!=='tree'||Math.abs(p.x-D.x)>24||Math.abs(p.z-D.z)>22);const props=pick(option,'props').call(option,api,list,{cx:k.cx,cz:k.cz});if(props)chunk.add(props);}
  group.add(chunk);}
 const h=W.horizon(focusX,focusZ,radius),hg=new T.BufferGeometry();for(const [name,values] of [['position',h.positions],['normal',h.normals],['color',h.colors]])hg.setAttribute(name,new T.Float32BufferAttribute(values,3));hg.setAttribute('uv',new T.Float32BufferAttribute(planarUv(h.positions,0,0),2));hg.setIndex(h.indices);hg.userData.horizon=true;
 const horizon=new T.Mesh(hg,material);horizon.position.set(-ox,0,-oz);group.add(horizon);return group;}

function placeEnemy(e){const make=pick(option,'enemy');const g=make.call(option,api,e);if(!g)return null;g.position.set(e.x-api.origin.x,e.y??ground(e.x,e.z),e.z-api.origin.z);orient(g,e.x,e.z,e.heading||0,!!e.drone||!!e.immobile);if(g.userData.gun)g.userData.gun.rotation.y=(e.turret||0)-(e.heading||0);scene.add(g);return g;}
function placeTank(p){const vehicle=makeVehicle(PLAYER_LOADOUT,api.modelMats);const g=pick(option,'playerTank').call(option,api,vehicle,PLAYER_LOADOUT)||vehicle;g.position.set(p.x-api.origin.x,ground(p.x,p.z),p.z-api.origin.z);orient(g,p.x,p.z,p.heading);scene.add(g);api.player={...p,y:ground(p.x,p.z),group:g};return g;}
function placeWorld(group){if(!group)return;group.position.set(-api.origin.x,0,-api.origin.z);scene.add(group);}
function frameCamera(f){const [fx,fh,fz]=f.from,[tx,th,tz]=f.to,base=ground(tx,tz);camera.position.set(fx-api.origin.x,Math.max(base+fh,ground(fx,fz)+2),fz-api.origin.z);camera.lookAt(tx-api.origin.x,base+th,tz-api.origin.z);}

// ---------- map subject: the in-game map dialog structure, painted by the option ----------
function mapState(){
 const territory={refuge:{owner:'humanity'},western:{owner:'humanity',status:'defense-alert'},'west-depot':{owner:'humanity'}},completed=Object.fromEntries(C.fieldMissionIds.map(id=>[id,{at:1}]));
 for(const id of ['raid-intercept-1','raid-sabotage-1','raid-battery-1','raid-extraction-1','raid-siege-1','raid-intercept-2','raid-battery-2'])completed[id]={at:1};
 return {territory,completed,base:{tier:2},wrecks:[{x:1012,z:968}]};}
function fakeDiscovery(){const d=new ConquestDiscovery.Discovery('lab-style-discovery-'+Math.random(),()=>null,()=>{});
 // A mid-campaign explored footprint: every route the six field missions and the first raids drive.
 const path=(a,b)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/16);for(let i=0;i<=n;i++)d.reveal({x:a[0]+(b[0]-a[0])*i/n,z:a[1]+(b[1]-a[1])*i/n});};
 const hub=[1120,1140],stops=[[898,1024],[1024,1024],[1160,1048],[1090,944],[994,944],[950,1110],[1150,900],[1240,920],[922,920],[1080,850],[1270,1175],[1230,1020],[1262,850]];
 for(const s of stops)path(hub,s);path([898,1024],[922,920]);path([922,920],[1080,850]);path([1080,850],[1150,900]);path([1150,900],[1262,850]);path([1240,920],[1230,1020]);path([1230,1020],[1270,1175]);path([1270,1175],[1300,1220]);path([950,1110],[898,1024]);
 for(const s of C.sectors)for(let a=0;a<6;a++)d.reveal({x:s.x+Math.cos(a)*s.radius*.45,z:s.z+Math.sin(a)*s.radius*.45});clearTimeout(d.timer);d.timer=null;return d;}
function buildMap(){
 const css=option.mapCss;if(css){const s=document.createElement('style');s.textContent=css;document.head.append(s);}
 const panel=document.createElement('section');panel.className='cq';document.body.append(panel);const d=document.createElement('div');d.className='cq-dialog cq-map';panel.append(d);
 const el=(t,cls,text)=>{const n=document.createElement(t);if(cls)n.className=cls;if(text!=null)n.textContent=text;d.append(n);return n;};
 el('h2','','FRONTLINE / REGION MAP');el('p','cq-map-mission','HOLD THE OXYGEN LINE · SECURED · PERSONAL COMPLETION');
 const legend=el('p','cq-map-legend','Terrain appears only where explored. ◆ Mission · ✦ Raid site (five families) · ! Defense alert · ● Friendly facility · ▲ Parasite installation (when discovered). Drag to pan · pinch or + / − to zoom · north ↑.');if(option.mapLegend)legend.innerHTML=option.mapLegend;
 const player={x:1124,z:1132,heading:2.4};el('p','','YOU · X '+player.x+' / Z '+player.z+' · ROUTE · ASH REDOUBT RAIDS · 323 m');
 const routes=el('div','cq-home-routes');for(const [t,c] of [['NAVIGATE · REFUGE','cq-nav-refuge'],['NAVIGATE · COMMAND BASE','cq-nav-base']]){const b=document.createElement('button');b.textContent=t;b.className=c;routes.append(b);}
 const canvas=el('canvas');canvas.width=720;canvas.height=840;const controls=el('div','cq-map-controls');for(const t of ['＋','−','WHOLE WORLD','LOCATE SELF','CLOSE MAP']){const b=document.createElement('button');b.textContent=t;controls.append(b);}
 el('h3','','FAST TRAVEL');el('p','','READY · departing REFUGE CORRIDOR · carried cargo stays aboard, unbanked');
 // Same pan/zoom state the game's LOCATE SELF produces on open (scale 64, player centred).
 const scale=64,u=player.x/W.WIDTH,v=1-player.z/W.LENGTH,px=Math.max(280-280*scale,Math.min(0,140-u*280*scale)),py=Math.max(420-420*scale,Math.min(0,210-v*420*scale));
 const m={W,C,quality:QUALITY,low:QUALITY==='low',time:time(),scale,px,py,width:360,height:420,dpr:2,discovery:fakeDiscovery(),state:mapState(),player,routeTarget:{x:1266,z:853,name:'ASH REDOUBT RAIDS'},
  toScreen(x,z){return {x:40+px+x/W.WIDTH*280*scale,y:py+(1-z/W.LENGTH)*420*scale};},
  toWorld(sx,sy){return {x:(sx-40-px)/(280*scale)*W.WIDTH,z:(1-(sy-py)/(420*scale))*W.LENGTH};}};
 api.mapModel=m;const ctx=canvas.getContext('2d');const t0=performance.now();pick(option,'map').call(option,ctx,m);const first=performance.now()-t0;const t1=performance.now();pick(option,'map').call(option,ctx,m);const repaint=performance.now()-t1;
 root.labStats={option:OPT,subject:'map',quality:QUALITY,viewport:[innerWidth,innerHeight],mapFirstPaintMs:+first.toFixed(1),mapRepaintMs:+repaint.toFixed(1),note:'desktop CPU timing; a pan/zoom repaint must stay cheap on phones'};
 tag.textContent=(option.name||OPT)+' · MAP · '+QUALITY.toUpperCase();requestAnimationFrame(()=>requestAnimationFrame(()=>{root.labReady=true;}));}

async function start(){
 option=registry.get(OPT)||(OPT==='current'?current:null);if(!option)throw Error('unknown option '+OPT+' (did options/'+OPT+'/style.js register?)');
 if(!SUBJECTS.includes(SUBJECT))throw Error('unknown subject '+SUBJECT);
 await root.ConquestAssets.load(T).catch(()=>{});
 if(SUBJECT==='map'){api={T,THREE:T,W,C,quality:QUALITY,low:QUALITY==='low',time,footprints:FOOTPRINTS,baseline:current,merge,orient,ground};buildMap();return;}
 // Renderer exactly as the game creates it (view.js): no MSAA, low-power, HIGH pixel ratio <=1.5, LOW 1.
 renderer=new T.WebGLRenderer({antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true});renderer.setPixelRatio(QUALITY==='low'?1:Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);document.getElementById('stage').append(renderer.domElement);
 if(typeof Equipment3D!=='undefined'){Equipment3D.quality=QUALITY;await Equipment3D.ensure(QUALITY).catch(()=>false);Equipment3D.configure(renderer);}
 scene=new T.Scene();camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.2,3000);
 const f=FRAMES[SUBJECT],ox=Math.floor(f.focus[0]/128)*128,oz=Math.floor(f.focus[1]/128)*128;
 const modelMats={lit:new T.MeshPhongMaterial({vertexColors:true,shininess:45}),shine:new T.MeshPhongMaterial({vertexColors:true,shininess:65}),glow:new T.MeshBasicMaterial({vertexColors:true})};
 api={T,THREE:T,W,C,M3,Equipment3D:root.Equipment3D,assets:root.ConquestAssets,quality:QUALITY,low:QUALITY==='low',scene,camera,renderer,origin:{x:ox,z:oz},subject:SUBJECT,time,footprints:FOOTPRINTS,modelMats,ground,normal:(x,z)=>W.surfaceNormal(x,z),merge,orient,baseline:current,
  onUpdate(fn){updateFns.push(fn);},
  async loadGLB(url){const r=await fetch(url);if(!r.ok)throw Error('GLB '+url+' HTTP '+r.status);return root.ConquestAssets.parse(T,await r.arrayBuffer());},
  makeVehicle:L=>makeVehicle(L||PLAYER_LOADOUT,modelMats),placeEnemy};
 await (option.prepare?option.prepare(api):null);
 pick(option,'environment').call(option,api);
 const material=pick(option,'terrainMaterial').call(option,api);chunksGroup=terrain(f.focus[0],f.focus[1],material);scene.add(chunksGroup);
 if(SUBJECT==='refuge')placeWorld(pick(option,'refuge').call(option,api,FOOTPRINTS.refuge));
 if(SUBJECT==='raid'){placeWorld(pick(option,'raidSite').call(option,api,FOOTPRINTS.raid));const R=FOOTPRINTS.raid;
  for(const [i,b] of R.batteries.entries())placeEnemy({id:'battery-'+i,kind:'command',cls:'titan',arch:'pulse',immobile:true,objectiveTarget:true,x:b.x,z:b.z,heading:Math.PI});
  for(const e of R.enemies)placeEnemy({...e,heading:-1.9,turret:-1.75});placeTank(f.player);}
 if(SUBJECT==='tank'){placeTank(f.player);}
 if(SUBJECT==='enemy'){placeEnemy({...f.enemy,turret:f.enemy.heading});}
 if(SUBJECT==='props'&&typeof option.propLineup==='function'){const L=f.lineup;placeWorld(option.propLineup(api,L));}
 frameCamera(f);
 tag.textContent=(option.name||OPT)+' · '+SUBJECT.toUpperCase()+' · '+QUALITY.toUpperCase();
 // Warm every program once, then measure a short run of frames before declaring the shot ready.
 renderer.compile(scene,camera);let n=0,last=performance.now();
 const loop=()=>{const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;for(const fn of updateFns)fn(dt,time());if(option.update)option.update(api,dt,time());const s=performance.now();renderer.render(scene,camera);frameTimes.push(performance.now()-s);n++;
  if(n===24){root.labStats=stats();root.labReady=true;}if(n<24||FIXED_T===null)requestAnimationFrame(loop);};requestAnimationFrame(loop);
}
root.ConquestStyleLab=Object.freeze({register,FOOTPRINTS,FRAMES,SUBJECTS,current,stats:()=>stats()});
// Load the option script (options/<id>/style.js) unless the live-build reference is requested.
function boot(){if(OPT==='current'){start().catch(fail);return;}const s=document.createElement('script');s.src='options/'+encodeURIComponent(OPT)+'/style.js?'+Date.now();s.onload=()=>start().catch(fail);s.onerror=()=>fail('missing options/'+OPT+'/style.js');document.body.append(s);}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot);else boot();
})(globalThis);
