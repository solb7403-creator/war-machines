/* A single disposable renderer. The app's existing frame loop owns its updates. */
(function(root){
'use strict';
const W=root.ConquestWorld;
// Canvas fallback reads the same camera, world positions and canonical hull radii. No second simulation.
function canvasRenderer(v){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),T=v.T,point=new T.Vector3();let width=1,height=1;
 const project=(x,y,z)=>{point.set(x-v.origin.x,y,z-v.origin.z).project(v.camera);return {x:(point.x+1)*width/2,y:(1-point.y)*height/2,visible:point.z<1&&point.z>-1};};
 const line=(a,b,color,w=1)=>{if(!a.visible||!b.visible)return;ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
 const circle=(p,r,color,fill=true)=>{const a=project(p.x,p.y,p.z),b=project(p.x+r,p.y,p.z),c=project(p.x,p.y,p.z+r),radius=Math.max(2,Math.hypot(a.x-b.x,a.y-b.y),Math.hypot(a.x-c.x,a.y-c.y));if(!a.visible)return;ctx.beginPath();ctx.ellipse(a.x,a.y,radius,radius*.65,0,0,Math.PI*2);ctx.fillStyle=color;ctx.strokeStyle=color;if(fill)ctx.fill();else ctx.stroke();};
 return {domElement:canvas,isConquestCanvas:true,setPixelRatio(){},setSize(w,h){width=w;height=h;canvas.width=w;canvas.height=h;canvas.style.width=w+'px';canvas.style.height=h+'px';},dispose(){},forceContextLoss(){},render(){
 v.camera.updateMatrixWorld();ctx.fillStyle='#18242d';ctx.fillRect(0,0,width,height);const B=v.battle||v.encounter,p=v.p;
 for(let x=-48;x<=48;x+=8)for(let z=-48;z<=48;z+=8){const a={x:p.x+x,z:p.z+z};line(project(a.x,W.groundAt(a.x,a.z),a.z),project(a.x+8,W.groundAt(a.x+8,a.z),a.z),'#41505a');line(project(a.x,W.groundAt(a.x,a.z),a.z),project(a.x,W.groundAt(a.x,a.z+8),a.z+8),'#41505a');}
 const sites=[...root.ConquestCombat.installations,...W.landmarks,{...root.ConquestCombat.baseDefinition,name:'COMMAND BASE '+(v.authority?.state?.base?.tier||0)}];for(const site of sites)if(Math.hypot(site.x-p.x,site.z-p.z)<180){const y=W.groundAt(site.x,site.z);circle({x:site.x,y,z:site.z},7,'#5d6d78');const a=project(site.x,y+8,site.z);if(a.visible){ctx.fillStyle='#d1bf8a';ctx.font='10px sans-serif';ctx.fillText(site.name||'STRUCTURE',a.x,a.y);}}
 if(!B)return;const base=v.authority?.state?.base,D=root.ConquestCombat.baseDefinition;if(base?.tier){circle({x:D.x,y:W.groundAt(D.x,D.z),z:D.z},15+base.tier,'#80cbc4',false);for(let i=0;i<base.tier;i++)circle({x:D.x-12+i*6,y:W.groundAt(D.x,D.z)+4,z:D.z+10},2,'#d7c58a');}for(const e of B.enemies)if(e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<180){circle({x:e.x,y:e.y+2.2,z:e.z},2.7,e.id===v.selectedId?'#efcf78':'#bd605c');line(project(e.x,e.y+2.2,e.z),project(e.x+Math.sin(e.turret)*4,e.y+2.2,e.z+Math.cos(e.turret)*4),'#edb2a5',2);}
 circle({x:p.x,y:p.y+2.2,z:p.z},2.5,'#8dbfc9');line(project(p.x,p.y+2.2,p.z),project(p.x+Math.sin(B.turretYaw)*4,p.y+2.2,p.z+Math.cos(B.turretYaw)*4),'#e6f6ff',3);if(B.shieldT>0)circle({x:p.x,y:p.y+2.2,z:p.z},4.5,'#72dcff',false);
 for(const q of B.projectiles){const speed=Math.hypot(q.vx,q.vy,q.vz),length=q.kind==='moon'?6:1,a=project(q.x,q.y,q.z),b=project(q.x-q.vx/speed*length,q.y-q.vy/speed*length,q.z-q.vz/speed*length);line(a,b,q.kind==='moon'?'#61daff':q.team==='player'?'#d8faff':'#ff9079',q.kind==='moon'?4:2);if(q.kind==='moon')line(a,b,'#f5ffff',1);}
 for(const e of B.effects){if(e.kind==='beam'){const a=project(e.x,e.y,e.z),b=project(e.ex,e.ey,e.ez);line(a,b,e.weapon==='moon'?'#ac9cff':'#66d9ec',8);line(a,b,'#f2ffff',2);}else circle(e,e.kind==='destroy'?2:.4,e.weapon==='moon'?'#d1b5ff':'#ffda9b');}
 if(B.overheated){ctx.fillStyle='#ffb37d';const a=project(p.x,p.y+5,p.z);ctx.fillText('VENT',a.x,a.y);} }
 };
}
class View {
 constructor(host,onError){
 const T=root.THREE;this.T=T;this.lifecycle=new AbortController();this.host=host;this.onError=onError;this.chunks=new Map();this.keys={};this.stick={x:0,z:0};this.yaw=-Math.PI/2;this.pitch=.42;this.distance=23;this.frames=0;this.fps=0;this.elapsed=0;this.builds=0;this.disposed=false;
 this.p={x:898,z:1024,y:W.groundAt(898,1024),surface:'ground'};
 try{const p=JSON.parse(localStorage.getItem('lunar-conquest-position-v1'));if(p&&Number.isFinite(p.x)&&Number.isFinite(p.z)){this.jump(p.x,p.z);if(p.surface==='bridge'){const deck=W.deckAt(this.p.x,this.p.z);if(deck!==null){this.p.surface='bridge';this.p.y=deck;}}}}catch(_){}
 this.discovery=root.ConquestDiscovery?.create();
 if(this.p.x===898&&this.p.z===1024)this.discovery?.spawn(this.p);
 try{if(typeof gfxMode==='function'&&gfxMode()==='2d')throw Error('2d selected');this.renderer=new T.WebGLRenderer({antialias:false,powerPreference:'low-power'});}catch(_){this.renderer=canvasRenderer(this);}this.renderer.setPixelRatio(typeof gfxMode==='function'&&gfxMode()==='low'?1:Math.min(devicePixelRatio,1.5));host.append(this.renderer.domElement);
 this.hfRelease=typeof Equipment3D!=='undefined'?Equipment3D.attach():null;if(typeof Equipment3D!=='undefined')Equipment3D.configure(this.renderer);
 this.scene=new T.Scene();this.scene.background=new T.Color(0x101b29);this.scene.fog=new T.Fog(0x101b29,1100,2560);
 this.camera=new T.PerspectiveCamera(55,1,.2,3000);this.scene.add(new T.HemisphereLight(0xc4ddff,0x353025,.85));const sun=new T.DirectionalLight(0xffe5ba,2.8);sun.position.set(-100,180,-70);this.scene.add(sun);
 const surface=document.createElement('canvas');surface.width=surface.height=128;const ctx=surface.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=82741;for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;const v=185+(seed>>>26);pixels.data.set([v,v,v,255],i);}ctx.putImageData(pixels,0,0);this.groundTexture=new T.CanvasTexture(surface);this.groundTexture.wrapS=this.groundTexture.wrapT=T.RepeatWrapping;this.groundTexture.repeat.set(1,1);this.material=new T.MeshLambertMaterial({vertexColors:true,map:this.groundTexture});this.archMaterial=new T.MeshLambertMaterial({vertexColors:true});this.shared=[];this.props=new T.Group();this.scene.add(this.props);
 this.box=new T.BoxGeometry(1,1,1);this.shared.push(this.box);this.cone=new T.ConeGeometry(1,1,7);this.sphere=new T.IcosahedronGeometry(1,1);this.rock=new T.IcosahedronGeometry(1,0);this.cylinder=new T.CylinderGeometry(1,1,1,10);this.shared.push(this.cone,this.sphere,this.rock,this.cylinder);this.materials={};
 this.vehicle=new T.Group();this.scene.add(this.vehicle);this.loadoutKey='';this.syncLoadout();
 this.progress=root.ConquestProgress?.create();
 this.safeHistory=[];this.recoveryClock=0;this.stuckSeconds=0;this.recoveryReadyAt=0;
 let cleared={};try{cleared=JSON.parse(localStorage.getItem('lunar-conquest-garrisons-v1'))||{};}catch(_){}
 this.encounter=root.ConquestCombat?new root.ConquestCombat.Encounter(myLoadout(),this.p,cleared):null;this.restoreHealth();
 this.enemyMeshes=new Map();this.shotMeshes=[];this.effectMeshes=[];this.aimYaw=0;this.aimPitch=0;this.makeBeacon();
 this.origin={x:0,z:0};this.makeLandmarks();this.batchLandmarks();this.bind();this.resize();this.selectedId=null;this.pendingAbilities={};this.aimYaw=Math.PI/2;this.lootMeshes=new Map();
 if(root.ConquestSession&&typeof ACCOUNT_OK!=='undefined'&&ACCOUNT_OK){try{const legacy=localStorage.getItem('lunar-conquest-position-v1');if(legacy&&!localStorage.getItem('lunar-conquest-legacy-position-v1'))localStorage.setItem('lunar-conquest-legacy-position-v1',legacy);}catch(_){}this.authority=new root.ConquestSession(this,async(path,body)=>{const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);try{const r=await apiFetch(path,body,abort.signal),j=await r.json();if(!r.ok){if(j.error==='update'){const q=new URLSearchParams(location.search);q.set('v',j.build||Date.now());location.replace(location.pathname+'?'+q.toString()+location.hash);}if(IN_WEB&&r.status===401)window.dispatchEvent(new Event('lunar-session-expired'));throw Error(j.error||'Conquest connection unavailable');}return j;}finally{clearTimeout(timer);}});this.authority.connect();}

 }
 syncLoadout(){
 const L=this.battle?.snapshot||this.authority?.loadout||myLoadout(),key=JSON.stringify([L,typeof Equipment3D!=='undefined'?Equipment3D.generation:0,!!this.authority?.state?.achievements?.['field-veteran']]);this.speed=this.battle?.state==='active'?this.battle.combatSpeed:W.travelSpeed(L);this.loadout=L;
 if(key===this.loadoutKey)return;this.loadoutKey=key;
 this.motion?.dispose();if(typeof Equipment3D!=='undefined')Equipment3D.releaseTree(this.vehicle);
 this.vehicle.traverse(o=>{if(o.geometry&&!o.geometry.userData.hfShared&&!this.shared?.includes(o.geometry))o.geometry.dispose();});this.vehicle.clear();
 const T=this.T,P=PAINTS[L.paint]||PAINTS.stock,team='#88cbdc';
 if(!this.modelMats)this.modelMats={lit:new T.MeshPhongMaterial({vertexColors:true,shininess:45}),shine:new T.MeshPhongMaterial({vertexColors:true,shininess:65}),glow:new T.MeshBasicMaterial({vertexColors:true})};
 const body=new T.Group();body.rotation.y=-Math.PI/2;this.vehicle.add(body);
 const add=(raw,parent)=>{parent.add(M3.meshOf(M3.bake(raw.k),null,this.modelMats));for(const a of raw.anims||[]){const m=M3.meshOf(M3.bake(a.k),null,this.modelMats);m.position.set(...a.p);parent.add(m);}};
 const H=M3.chassisKit(L.c.c,L.c.t,P,team,L.cores,L.skin==='lunar');const hullB=M3.bake(H.k);body.add(M3.meshOf(hullB,null,this.modelMats));for(const a of H.anims||[]){const m=M3.meshOf(M3.bake(a.k),null,this.modelMats);m.position.set(...a.p);body.add(m);}
 const gun=new T.Group();this.gun=gun;gun.position.y=H.meta.ty;body.add(gun);gun.scale.setScalar(M3.weaponScale(L.w.a,L.c.c));add(M3.weaponKit(L.w.a,L.w.t,P,team,L.skin==='lunar',L.c.c),gun);
 if(this.authority?.state?.achievements?.['field-veteran']){this.form(body,this.box,-.55,H.meta.ty*.7,0,.12,.18,1.25,0xf0d38c);this.form(body,this.box,-.65,H.meta.ty*.7+.15,0,.14,.12,.6,0x8ee8df);}
 const fits=fittingVisuals(L),context={cls:L.c.c,ct:L.c.t,arch:L.w.a,wt:L.w.t,lunar:L.skin==='lunar'};add(M3.fittingKit(fits,team,'body',context),body);add(M3.fittingKit(fits,team,'mount',context),gun);
 if(L.vl>0&&typeof vaultParts==='function')vaultParts({body},{b:hullB},{vl:L.vl,vt:typeof vtOf==='function'?vtOf(L.vl):L.vl>=10?2:1},this.modelMats);
 this.vehicle.scale.setScalar(1.65);
 if(typeof GraphicsMotion!=='undefined')this.motion=GraphicsMotion.attach(this.vehicle,H.meta.track||[(2.61-.48)/2,.24,.25,0],{includeOwned:true});
 }
 makeBeacon(){if(!root.ConquestCombat)return;const m=root.ConquestCombat.mission;this.beacon=new this.T.Group();this.form(this.beacon,this.cylinder,0,9,0,.3,18,.3,0x7fffe8);this.form(this.beacon,this.sphere,0,18,0,2,2,2,0xe9ca77);this.scene.add(this.beacon);}
 startMission(retry=false,id='oxygen-line'){if(this.authority)return this.authority.action('start-mission',{mission:id}).then(ok=>{if(ok){this.selectedId=null;this.reset();this.syncLoadout();}return ok;});if(!root.ConquestCombat||this.battle?.state==='active')return false;const m=root.ConquestCombat.operations[id];if(!m||this.encounter?.playerHp<=0)return false;if(Math.hypot(this.p.x-m.x,this.p.z-m.z)>(retry?240:m.activationRadius))return false;this.clearBattle();this.explorationCamera={yaw:this.yaw,pitch:this.pitch,distance:this.distance};this.battle=id==='oxygen-line'?new root.ConquestCombat.Battle(myLoadout(),this.p):new root.ConquestCombat.Operation(myLoadout(),this.p,id);if(Number.isFinite(this.encounter?.playerHp))this.battle.playerHp=Math.min(this.battle.playerMax,this.encounter.playerHp);root.ConquestControl?.carry(this.encounter,this.battle);this.battle.enemies.push(...this.encounter.enemies.map(e=>({...JSON.parse(JSON.stringify(e)),id:100000000+e.id,resident:true})));this.battle.id=Math.max(this.battle.id,...this.battle.enemies.map(e=>e.id));this.selectedId=null;this.resultHandled=false;this.yaw=-.8;this.pitch=.95;this.distance=100;this.camera.fov=75;this.camera.updateProjectionMatrix();this.aimYaw=this.heading||0;this.reset();this.syncLoadout();return true;}
 clearBattle(){if(this.battle&&this.encounter){for(const e of this.battle.enemies.filter(e=>e.resident)){const old=this.encounter.enemies.find(x=>x.key===e.key);if(old){const id=old.id;Object.assign(old,JSON.parse(JSON.stringify(e)),{id,resident:false});if(old.hp<=0)this.encounter.cleared[old.key]=true;}}root.ConquestControl?.carry(this.battle,this.encounter);this.selectedId=null;this.encounter.playerHp=Math.min(this.encounter.playerMax,this.battle.playerHp);if(this.encounter.playerHp<=0)this.encounter.state='defeat';}this.battle=null;this.flushHealth();if(this.explorationCamera){Object.assign(this,this.explorationCamera);this.explorationCamera=null;}if(this.gun)this.gun.rotation.y=0;if(this.reticle)this.reticle.visible=false;if(this.camera){this.camera.fov=55;this.camera.updateProjectionMatrix();}this.firing=false;for(const g of this.enemyMeshes?.values()||[]){this.scene.remove(g);g.traverse(o=>{if(o.geometry&&!this.shared?.includes(o.geometry))o.geometry.dispose();});}this.enemyMeshes?.clear();for(const m of [...this.shotMeshes||[],...this.effectMeshes||[]])this.scene.remove(m);this.shotMeshes=[];this.effectMeshes=[];if(this.vehicle)this.syncLoadout();}
 clearEnemyVisuals(){for(const g of this.enemyMeshes?.values()||[]){this.scene.remove(g);g.traverse(o=>{if(o.geometry&&!this.shared?.includes(o.geometry)&&!o.geometry.userData.hfShared)o.geometry.dispose();});}this.enemyMeshes?.clear();}
 enemyModel(e){const T=this.T,g=new T.Group(),body=new T.Group();body.rotation.y=-Math.PI/2;g.add(body);if(e.immobile){this.cube(g,0,1,0,7,2,6,0x4f4659);this.form(g,this.cylinder,0,5,0,.4,8,.4,0xb7a2b9);this.form(g,this.sphere,0,9,0,3,.5,2,0xff6966);g.userData.gun=new T.Group();g.userData.marker=this.form(g,this.cone,0,11,0,.6,1,.6,0xff4b48);this.scene.add(g);return g;}const P=PAINTS.stock,H=M3.chassisKit(e.cls||'scout',0,P,'#ef665d',[],false);body.add(M3.meshOf(M3.bake(H.k),null,this.modelMats));this.mergeArchitecture(body);const gun=new T.Group();gun.position.y=H.meta.ty;gun.scale.setScalar(M3.weaponScale(e.arch,e.cls));gun.add(M3.meshOf(M3.bake(M3.weaponKit(e.arch,0,P,'#ef665d',false,e.cls).k),null,this.modelMats));this.mergeArchitecture(gun);body.add(gun);g.userData.gun=gun;g.userData.marker=this.form(g,this.cone,0,5,0,.6,1,.6,0xff4b48);g.scale.setScalar(1.65);this.scene.add(g);return g;}
 controlInput(dt,sx=0,sz=0){
 if(this.keys.KeyQ)this.aimYaw+=dt*1.8;if(this.keys.KeyE)this.aimYaw-=dt*1.8;
 return {x:Math.cos(this.yaw)*sx-Math.sin(this.yaw)*sz,z:-Math.sin(this.yaw)*sx-Math.cos(this.yaw)*sz,aimYaw:this.aimYaw,aimPitch:this.aimPitch,lockId:this.selectedId??null,fire:this.firing||!!this.keys.Space,tapFire:!!this.fireTap,super:!!this.pendingAbilities?.super||!!this.keys.KeyR,dash:!!this.pendingAbilities?.dash||!!this.keys.ShiftLeft,shield:!!this.pendingAbilities?.shield||!!this.keys.KeyF};
 }
 combatTick(dt){const B=this.battle||this.encounter;if(!B)return;const before=performance.now();
 if(root.ConquestControl){if(!this.controlStepped){const i=this.controlInput(dt);this.p=root.ConquestControl.advance(B,this.p,i,dt,!this.battle);}this.controlStepped=false;
 this.aimPoint=root.ConquestControl.aim(B,this.p,this.controlInput(0),0);if(this.selectedId&&!B.lockId)this.selectedId=null;
 }else{this.aimPoint={x:this.p.x+Math.sin(this.aimYaw)*160,y:this.p.y+2.2,z:this.p.z+Math.cos(this.aimYaw)*160};B.tick(dt,this.p,{aim:this.aimPoint,fire:this.firing||!!this.keys.Space});}
 if(Number.isFinite(this.audioShots)&&(B.playerShots||0)>this.audioShots&&typeof fx==='function')fx('shot',B.playerStats.wtype);this.audioShots=Math.max(this.audioShots||0,B.playerShots||0);this.simMs=(this.controlSimMs||0)+performance.now()-before;this.controlSimMs=0;this.fireTap=false;this.pendingAbilities={};this.flushHealth();
 if(this.gun)this.gun.rotation.y=(B.turretYaw??this.aimYaw)-(this.heading||0);
 if(!this.authority&&this.battle&&B.state==='victory'&&!this.resultHandled){this.progress?.complete(root.ConquestCombat.mission.id);this.resultHandled=true;}
 }
 requestAction(action,parameters){if(this.authority)return this.authority.action(action,parameters);if(action==='return-exploration'){this.clearBattle();return Promise.resolve(true);}return Promise.resolve(false);}
 selected(){const B=this.battle||this.encounter,e=B?.enemies.find(e=>e.id===this.selectedId);if(!root.ConquestControl?.visible(B,this.p,e))return null;const c=this.camera?.position;if(c&&this.origin&&!root.ConquestCombat.lineClear({x:c.x+this.origin.x,y:c.y,z:c.z+this.origin.z},{x:e.x,y:e.y+2.2,z:e.z}))return null;return e;}
 useCanvasFallback(){if(this.disposed||this.renderer.isConquestCanvas)return;const old=this.renderer;this.abort.abort();this.renderer=canvasRenderer(this);this.host.replaceChildren(this.renderer.domElement);old.dispose();this.bind();this.resize();}
 pick(clientX,clientY){if(this.renderer.isConquestCanvas){const r=this.renderer.domElement.getBoundingClientRect(),B=this.battle||this.encounter;let picked=null,best=Infinity;this.camera.updateMatrixWorld();for(const e of B.enemies){if(!root.ConquestControl.visible(B,this.p,e))continue;const a=new this.T.Vector3(e.x-this.origin.x,e.y+2.2,e.z-this.origin.z).project(this.camera),b=new this.T.Vector3(e.x+2.7-this.origin.x,e.y+2.2,e.z-this.origin.z).project(this.camera),c=new this.T.Vector3(e.x-this.origin.x,e.y+2.2,e.z+2.7-this.origin.z).project(this.camera),x=(a.x+1)*r.width/2,y=(1-a.y)*r.height/2,d=Math.hypot(clientX-r.x-x,(clientY-r.y-y)/.65),radius=Math.max(2,Math.hypot((b.x-a.x)*r.width/2,(b.y-a.y)*r.height/2),Math.hypot((c.x-a.x)*r.width/2,(c.y-a.y)*r.height/2));if(a.z<1&&d<radius&&d<best){picked=e.id;best=d;}}this.selectedId=this.selectedId===picked?null:picked;return;}const rect=this.renderer.domElement.getBoundingClientRect(),ray=new this.T.Raycaster();ray.setFromCamera(new this.T.Vector2((clientX-rect.x)/rect.width*2-1,-(clientY-rect.y)/rect.height*2+1),this.camera);
 const meshes=[];for(const [id,g] of this.enemyMeshes){const e=(this.battle||this.encounter)?.enemies.find(e=>e.id===id);if(e?.hp>0&&g.visible)g.traverse(m=>{if(m.isMesh&&m!==g.userData.marker){m.userData.hostileId=id;meshes.push(m);}});}
 const hit=ray.intersectObjects(meshes,false)[0];if(!hit){this.selectedId=null;return;}const id=hit.object.userData.hostileId,e=(this.battle||this.encounter).enemies.find(e=>e.id===id);
 // Picking must hit the hull; ray occlusion and tank line of sight both apply.
 const origin={x:ray.ray.origin.x+this.origin.x,y:ray.ray.origin.y,z:ray.ray.origin.z+this.origin.z},point={x:hit.point.x+this.origin.x,y:hit.point.y,z:hit.point.z+this.origin.z};
 if(!root.ConquestControl.visible(this.battle||this.encounter,this.p,e)||!root.ConquestCombat.lineClear(origin,point)){this.selectedId=null;return;}
 this.selectedId=this.selectedId===id?null:id;
 }
 combatRender(){if(this.renderer.isConquestCanvas)return;const ox=this.origin.x,oz=this.origin.z,m=this.routeTarget||root.ConquestCombat?.mission;if(this.beacon&&m){this.beacon.position.set(m.x-ox,W.groundAt(m.x,m.z),m.z-oz);this.beacon.visible=!this.battle&&Math.hypot(this.p.x-m.x,this.p.z-m.z)<350;}
 const B=this.battle||this.encounter;if(!B)return;
 if(!this.reticle){const geo=new this.T.RingGeometry(.65,.85,16);this.shared.push(geo);this.reticle=new this.T.Mesh(geo,this.mat(0xf4cf77));this.scene.add(this.reticle);}this.reticle.visible=B.state==='active';if(this.aimPoint){this.reticle.position.set(this.aimPoint.x-ox,this.aimPoint.y,this.aimPoint.z-oz);this.reticle.quaternion.copy(this.camera.quaternion);}
 const visible=new Set(B.enemies.filter(e=>Math.hypot(e.x-this.p.x,e.z-this.p.z)<240).map(e=>e.id));
 for(const [id,g] of this.enemyMeshes)if(!visible.has(id)){this.scene.remove(g);g.traverse(o=>{if(o.geometry&&!this.shared?.includes(o.geometry))o.geometry.dispose();});this.enemyMeshes.delete(id);}
 for(const e of B.enemies){if(!visible.has(e.id))continue;let g=this.enemyMeshes.get(e.id);if(!g){g=this.enemyModel(e);this.enemyMeshes.set(e.id,g);}g.visible=true;if(g.userData.marker){g.userData.marker.visible=e.hp>0;g.userData.marker.material=this.mat(e.telegraph?0xffdd74:0xff4b48);}g.scale.set(1.65,e.hp>0?1.65:.6,1.65);g.userData.gun.rotation.z=e.hp>0?0:.4;g.userData.gun.rotation.y=(e.turret||0)-(e.heading||0);g.position.set(e.x-ox,e.y,e.z-oz);const up=new this.T.Vector3(...W.surfaceNormal(e.x,e.z)),forward=new this.T.Vector3(Math.sin(e.heading||0),0,Math.cos(e.heading||0));forward.addScaledVector(up,-forward.dot(up)).normalize();const right=new this.T.Vector3().crossVectors(up,forward).normalize();g.quaternion.setFromRotationMatrix(new this.T.Matrix4().makeBasis(right,up,forward));}
 this.campaignRender(B,ox,oz);this.combatPresentation(B,ox,oz);
 const items=[...(B.projectiles||[]),...(B.superShells||[]).map(q=>({...q,team:'player',kind:'siege'}))];
 for(let i=0;i<Math.max(items.length,this.shotMeshes.length);i++){let g=this.shotMeshes[i],p=items[i];if(!g&&p){g=this.createLaserEffect();this.shotMeshes.push(g);this.scene.add(g);}if(!g)continue;g.visible=!!p;if(!p)continue;
 g.position.set(p.x-ox,p.y,p.z-oz);g.quaternion.identity();g.scale.setScalar(1);
 const laser=p.kind==='moon',core=g.children[0],halo=g.children[1];core.geometry=laser?this.cylinder:this.sphere;core.material=this.effectMaterial(laser?0xf1ffff:p.team==='player'?0x9ff7ff:0xff6b42);halo.visible=laser;const edge=g.children[2];edge.visible=laser;if(laser){edge.scale.set(.23,5.4,.23);}
 if(laser){core.scale.set(.07,6,.07);halo.scale.set(.17,5,.17);this.alignLaser(g,p.vx,p.vy,p.vz);}else core.scale.setScalar(p.kind==='siege'?.5:p.kind==='twin'?.18:.28);
 }
 const effects=B.effects||[];for(let i=0;i<Math.max(effects.length,this.effectMeshes.length);i++){let g=this.effectMeshes[i],p=effects[i];if(!g&&p){g=this.createLaserEffect();this.effectMeshes.push(g);this.scene.add(g);}if(!g)continue;g.visible=!!p;if(!p)continue;
 const dx=(p.ex??p.x)-p.x,dy=(p.ey??p.y)-p.y,dz=(p.ez??p.z)-p.z,length=Math.hypot(dx,dy,dz),beam=p.kind==='beam',moon=p.weapon==='moon';g.position.set(p.x-ox+dx/2,p.y+dy/2,p.z-oz+dz/2);g.quaternion.identity();g.scale.setScalar(1);
 const core=g.children[0],halo=g.children[1];halo.visible=beam&&moon;g.children[2].visible=beam&&moon;if(beam&&moon)g.children[2].scale.set(.9,Math.max(.2,length),.9);if(beam&&moon&&!g.userData.rings){if(!this.laserRingGeo){this.laserRingGeo=new this.T.RingGeometry(.85,1,20);this.shared.push(this.laserRingGeo);}g.userData.rings=[0,1].map(()=>{const ring=new this.T.Mesh(this.laserRingGeo,this.effectMaterial(0x9b88ff,true));ring.rotation.x=Math.PI/2;g.add(ring);return ring;});}for(const [i,ring] of (g.userData.rings||[]).entries()){ring.visible=beam&&moon;ring.position.y=(i?1:-1)*length*.3;ring.scale.setScalar(1.5+(1-p.life/.4)*3);}core.geometry=beam?this.cylinder:this.sphere;core.material=this.effectMaterial(moon?0xf3ffff:p.kind==='destroy'?0xffbb66:0xc9faff);
 if(beam){core.scale.set(moon?.22:.3,Math.max(.2,length),moon?.22:.3);halo.scale.set(.65*(.8+.2*Math.sin(B.time*55)),Math.max(.2,length),.65);this.alignLaser(g,dx,dy,dz);}else{const radius=p.kind==='nova'?(p.r||4)*(1-p.life/.45):moon?.45:p.kind==='destroy'?1:.25;core.scale.setScalar(radius);}
 }

 }
 // Visual-only extension points for future graphics work. All geometry/materials are view-owned and pooled.
 campaignRender(B,ox,oz){
 const C=root.ConquestCombat,s=this.authority?.state,D=C.baseDefinition,base=s?.base||{tier:0,modules:{}},key=JSON.stringify([base.tier,base.modules,this.loadout.paint,!!s?.achievements?.['field-veteran']]);
 if(key!==this.baseVisualKey){this.baseVisualKey=key;if(this.baseGroup){this.scene.remove(this.baseGroup);this.baseGroup.traverse(o=>{if(o.geometry&&!this.shared?.includes(o.geometry))o.geometry.dispose();});}
 const g=this.baseGroup=new this.T.Group();this.scene.add(g);const y=W.groundAt(D.x,D.z),tier=base.tier,trim=0x84dfe0,steel=0x4d626f;
 this.cube(g,0,y+.15,0,38,.3,34,0x313f4b);this.form(g,this.cylinder,0,y+.5,0,8,.7,8,0x708f99);
 // Physical build terminal exists before purchase, with an unmistakable construction apron.
 this.cube(g,-10,y+1.7,-7,2,3.4,1.5,steel);this.cube(g,-10,y+2.5,-7.8,1.6,1,.1,trim);
 if(tier){for(const side of [-1,1]){this.cube(g,side*17,y+2,0,2,4,32,steel);this.cube(g,side*17,y+4.3,0,2,.5,32,trim);}this.cube(g,0,y+2,16,32,4,2,steel);this.cube(g,10,y+4,12,1,8,1,steel);this.cube(g,13,y+7,12,5,2,.25,trim);
 const paint=parseInt((PAINTS[this.loadout.paint]||PAINTS.stock).hull.slice(1),16);this.cube(g,0,y+1,0,12,.3,10,paint);if(s?.achievements?.['field-veteran']){this.form(g,this.cone,-12,y+5,10,2,4,2,0xf3d48d);this.cube(g,-12,y+2,10,4,1,4,0xc8b36e);}
 if(tier>=2){this.form(g,this.cylinder,-7,y+5,8,6,10,6,steel);this.form(g,this.cone,-7,y+11,8,7,3,7,0xa9b6ba);this.cube(g,9,y+4,9,12,8,12,steel);this.cube(g,9,y+3.5,2.9,8,6,.2,0x17232c);}
 if(tier>=3)for(const x of [-15,15]){this.cube(g,x,y+5,-13,4,10,4,steel);this.form(g,this.cylinder,x,y+11,-13,3,2,3,0x9fb0b6);this.cube(g,x,y+12,-16,1.2,1.2,7,trim);}
 if(tier>=4){this.form(g,this.cylinder,12,y+10,10,.5,20,.5,steel);const radar=this.form(g,this.sphere,12,y+20,10,6,.8,4,trim);radar.rotation.z=.5;}
 if(tier>=5){this.form(g,this.cylinder,0,y+13,12,3,26,3,steel);this.form(g,this.cone,0,y+30,12,5,9,5,0xc5d7d6);for(let h=8;h<=24;h+=4)this.form(g,this.cylinder,0,y+h,12,3.5,.6,3.5,trim);}
 for(const [module,level] of Object.entries(base.modules)){if(!level)continue;const i=Object.keys(D.modules).indexOf(module),x=-12+i*4;this.cube(g,x,y+1+level,14,3,2+level*2,3,module==='reactor'?0x87e0d6:0x849eac);}
 }
 this.mergeArchitecture(g);
 }
 this.baseGroup.position.set(D.x-ox,0,D.z-oz);this.baseGroup.visible=Math.hypot(D.x-this.p.x,D.z-this.p.z)<350;if(!this.baseField){this.baseField=new this.T.Mesh(this.sphere,this.effectMaterial(0x78d8e9,true));this.scene.add(this.baseField);}const benefits=C.baseBenefits(base.tier,base.modules);this.baseField.visible=this.baseGroup.visible&&benefits.mitigation>0;this.baseField.position.set(D.x-ox,W.groundAt(D.x,D.z)+2,D.z-oz);this.baseField.scale.set(benefits.radius,benefits.radius*.5,benefits.radius);
 // Ownership banners change only from verified persistent campaign state.
 if(!this.flags)this.flags=new Map();if(!this.flagSites){this.flagSites=[...C.installations];for(const o of Object.values(C.operations))if(!this.flagSites.some(site=>site.id===o.site))this.flagSites.push({id:o.site,x:o.x,z:o.z,friendly:o.id==='oxygen-line'||o.id==='rescue'});}for(const site of this.flagSites){let g=this.flags.get(site.id);const owned=s?.territory?.[site.id]?.owner==='humanity';if(!g){g=new this.T.Group();this.form(g,this.cylinder,0,7,0,.18,14,.18,0xaabac2);const flag=this.cube(g,2,12,0,4,2,.2,0xff6257);g.userData.flag=flag;this.scene.add(g);this.flags.set(site.id,g);}g.userData.flag.material=this.mat(owned?0x82e8ce:site.friendly?0x699fae:0xff6257);g.position.set(site.x-ox,W.groundAt(site.x,site.z),site.z-oz);g.visible=Math.hypot(site.x-this.p.x,site.z-this.p.z)<350;}
 // Mark actual scan sites, sabotage terminal and escort crawler from shared simulation.
 const cues=[];if(B.operation){if(B.operation.id==='recon')for(let i=0;i<B.nodes.length;i++)cues.push({x:B.nodes[i][0],z:B.nodes[i][1],color:i<B.scans?0x82e8ce:0xf6d782});else cues.push({x:B.objective.x,z:B.objective.z,color:0x82e8ce});}
 if(!this.objectiveMeshes)this.objectiveMeshes=[];for(let i=0;i<Math.max(cues.length,this.objectiveMeshes.length);i++){let g=this.objectiveMeshes[i];if(!g&&cues[i]){g=new this.T.Group();this.form(g,this.cylinder,0,.5,0,3,1,3,0x405563);this.cube(g,0,2,0,3,3,2,0x8ce4db);this.form(g,this.cylinder,0,7,0,.1,10,.1,0xf6d782);this.scene.add(g);this.objectiveMeshes.push(g);}if(!g)continue;const c=cues[i];g.visible=!!c;if(c)g.position.set(c.x-ox,W.groundAt(c.x,c.z),c.z-oz);}
 }
 mergeArchitecture(group){const positions=[],normals=[],colors=[],indices=[];group.updateWorldMatrix(true,true);const inverse=new this.T.Matrix4().copy(group.matrixWorld).invert();group.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(new this.T.Matrix4().multiplyMatrices(inverse,o.matrixWorld)),a=g.attributes.position,b=g.attributes.normal,offset=positions.length/3,c=o.material.color;for(let i=0;i<a.count;i++){positions.push(a.getX(i),a.getY(i),a.getZ(i));normals.push(b.getX(i),b.getY(i),b.getZ(i));const vc=g.attributes.color;colors.push(vc?vc.getX(i)*c.r:c.r,vc?vc.getY(i)*c.g:c.g,vc?vc.getZ(i)*c.b:c.b);}const ix=g.index?g.index.array:Array.from({length:a.count},(_,i)=>i);for(const i of ix)indices.push(i+offset);g.dispose();if(!this.shared.includes(o.geometry)&&!o.geometry.userData.hfShared)o.geometry.dispose();});const geo=new this.T.BufferGeometry();for(const [k,a] of [['position',positions],['normal',normals],['color',colors]])geo.setAttribute(k,new this.T.Float32BufferAttribute(a,3));geo.setIndex(indices);group.clear();group.add(new this.T.Mesh(geo,this.archMaterial));}
 effectMaterial(color,halo=false){const key='fx'+color+halo;return this.materials[key]||(this.materials[key]=new this.T.MeshBasicMaterial({color,transparent:halo,opacity:halo?.3:1,depthWrite:!halo}));}
 createLaserEffect(){const g=new this.T.Group();g.add(new this.T.Mesh(this.cylinder,this.effectMaterial(0xf1ffff)),new this.T.Mesh(this.cylinder,this.effectMaterial(0x58dbff,true)),new this.T.Mesh(this.cylinder,this.effectMaterial(0x9a72ff,true)));g.children[2].visible=false;return g;}
 alignLaser(g,x,y,z){if(!this.laserAxis){this.laserAxis=new this.T.Vector3(0,1,0);this.laserDirection=new this.T.Vector3();}this.laserDirection.set(x,y,z);if(this.laserDirection.lengthSq()>1e-10)g.quaternion.setFromUnitVectors(this.laserAxis,this.laserDirection.normalize());}
 dashStreak(B,ox,oz){if(!this.dashMesh){this.dashMesh=this.createLaserEffect();this.scene.add(this.dashMesh);}const g=this.dashMesh;g.visible=!!B.dashState;if(!g.visible)return;g.position.set(this.p.x-ox-B.dashState.x*3,this.p.y+1,this.p.z-oz-B.dashState.z*3);g.children[0].scale.set(.08,7,.08);g.children[1].scale.set(.25,6,.25);this.alignLaser(g,B.dashState.x,0,B.dashState.z);}
 moonCharge(B,ox,oz){if(!this.chargeMesh){this.chargeMesh=this.createLaserEffect();this.scene.add(this.chargeMesh);}const g=this.chargeMesh;g.visible=B.superAttack?.weapon==='moon';if(!g.visible)return;const yaw=B.superAttack.yaw;g.position.set(this.p.x-ox+Math.sin(yaw)*4,this.p.y+3,this.p.z-oz+Math.cos(yaw)*4);g.children[0].scale.set(.1,2,.1);g.children[1].scale.set(.3,3,.3);this.alignLaser(g,Math.sin(yaw),0,Math.cos(yaw));}
 gunVent(B,ox,oz){if(!this.ventMesh){this.ventMesh=this.createLaserEffect();this.scene.add(this.ventMesh);}const g=this.ventMesh;g.visible=!!B.overheated;g.position.set(this.p.x-ox,this.p.y+4,this.p.z-oz);g.children[0].material=this.effectMaterial(0xffa477,true);g.children[0].scale.set(.4,1+Math.sin(B.time*14)*.25,.4);g.children[1].visible=false;}
 combatPresentation(B,ox,oz){
 const T=this.T,s=this.authority?.state;this.dashStreak(B,ox,oz);this.gunVent(B,ox,oz);this.moonCharge(B,ox,oz);
 if(!this.shieldMesh){this.shieldMaterial=new T.MeshBasicMaterial({color:0x70dcff,transparent:true,opacity:.18,wireframe:true,depthWrite:false});this.shieldMesh=new T.Mesh(this.sphere,this.shieldMaterial);this.shieldMesh.scale.set(4.3,3.6,4.5);this.scene.add(this.shieldMesh);}
 this.shieldMesh.visible=B.shieldT>0&&B.playerHp>0;this.shieldMesh.position.set(this.p.x-ox,this.p.y+2.5,this.p.z-oz);
 const selected=this.selected();if(selected){const hull=this.enemyMeshes.get(selected.id);if(hull){if(!this.selectionBox){this.selectionMaterial=new T.MeshBasicMaterial({color:0xf1d58a,wireframe:true,transparent:true,opacity:.7,depthWrite:false});this.selectionBox=new T.Mesh(this.box,this.selectionMaterial);this.scene.add(this.selectionBox);}this.selectionBox.position.set(selected.x-ox,selected.y+2.6,selected.z-oz);this.selectionBox.quaternion.copy(hull.quaternion);const size=selected.cls==='titan'?8.5:selected.cls==='vanguard'?7:6;this.selectionBox.scale.set(size,4.5,size);this.selectionBox.visible=true;}}else if(this.selectionBox)this.selectionBox.visible=false;
 const caches=[...(s?.drops||[]),...(s?.wrecks||[]).map(w=>({...w,wreck:true}))].filter(d=>d.expires>Date.now()&&Math.hypot(d.x-this.p.x,d.z-this.p.z)<240),keep=new Set(caches.map(d=>d.id));
 for(const [id,g] of this.lootMeshes)if(!keep.has(id)){this.scene.remove(g);this.lootMeshes.delete(id);}
 for(const d of caches){let g=this.lootMeshes.get(d.id);if(!g){g=new T.Group();this.cube(g,0,1,0,2,1.4,2,d.wreck?0x4396aa:0xab9159);this.cube(g,0,1.8,0,2.1,.2,2.1,d.wreck?0x9eefff:0xffd58a);this.form(g,this.cone,0,4,0,.45,.7,.45,d.wreck?0x9eefff:0xffd58a);this.scene.add(g);this.lootMeshes.set(d.id,g);}g.position.set(d.x-ox,d.y,d.z-oz);}
 }
 mat(color){return this.materials[color]||(this.materials[color]=new this.T.MeshLambertMaterial({color}));}
 cube(group,x,y,z,w,h,d,color){const m=new this.T.Mesh(this.box,this.mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;}
 makeLandmarks(){
 // Distinct Parasite armored bunkers, red signal masts and deployment apron.
 for(const b of root.ConquestCombat?.installations||[]){const y=W.groundAt(b.x,b.z);
 this.cube(this.props,b.x,y+.12,b.z,32,.24,30,0x282c34);
 this.cube(this.props,b.x,y+4,b.z+8,18,8,12,0x393440);
 this.cube(this.props,b.x,y+7,b.z+1.8,14,1,.4,0xff4b48);
 this.form(this.props,this.cone,b.x,y+10,b.z+8,12,5,9,0x652f3e);
 this.cube(this.props,b.x+14,y+10,b.z+10,.5,20,.5,0x81323b);
 this.form(this.props,this.sphere,b.x+14,y+20,b.z+10,1.5,1.5,1.5,0xff3f44);
 }
 // A modest Refuge supply terminal uses existing settlement ground.
 const sy=W.groundAt(1174,1168);this.cube(this.props,1174,sy+.15,1168,5,.3,5,0x617d89);this.cube(this.props,1174,sy+1.8,1168,2.4,3.6,1.4,0x254552);this.cube(this.props,1174,sy+2.6,1167.25,1.9,1.2,.1,0x8ee5e9);
 // Bridge strip geometry shares the navigation provider, including sloping ramps.
 const T=this.T,a=[],ix=[];for(let x=900;x<=1140;x+=4){for(const z of [1015,1033])a.push(x,W.deckAt(x,z),z);if(x<1140){const i=(x-900)/4*2;ix.push(i,i+1,i+2,i+2,i+1,i+3);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(a,3));g.setIndex(ix);g.computeVertexNormals();this.shared.push(g);const deck=new T.Mesh(g,this.mat(0x667d8a));this.props.add(deck);
 // Opaque deck thickness and supports; upper and lower routes remain visibly separate.
 this.cube(this.props,1020,23.35,1024,120,1.2,18,0x445361);
 for(const x of [970,1070])for(const z of [1018,1030]){const y=W.groundAt(x,z);this.cube(this.props,x,(y+23)/2,z,3,23-y,3,0x697780);}
 for(let x=904;x<1140;x+=8)for(const z of [1015,1033])this.cube(this.props,x,W.deckAt(x,z)+.6,z,2,1.2,.6,0xd1b36e);
 // Continuous deck-edge rails and exposed truss depth follow the same ramp provider.
 for(let x=900;x<1140;x+=4)for(const z of [1015,1033]){const a=W.deckAt(x,z),b=W.deckAt(x+4,z),rail=this.cube(this.props,x+2,(a+b)/2+1.4,z,Math.hypot(4,b-a),.3,.35,0xd1b36e);rail.rotation.z=Math.atan2(b-a,4);}
 // Monumental oxygen processors, grounded on individual footings, with pressure collars and pipework.
 for(let i=0;i<3;i++){const x=1150+i*30,z=1080,y=W.groundAt(x,z),h=90+i%2*38;
 this.form(this.props,this.cylinder,x,y+h/2,z,9,h,9,0x657e88);
 this.form(this.props,this.cone,x,y+h+8,z,12,16,12,0xb3c9d0);
 for(let k=1;k<5;k++){this.form(this.props,this.cylinder,x,y+h*k/5,z,10.5,1.6,10.5,k===4?0x8ee5e9:0xb0b8b9);}
 for(const dx of [-13,13]){this.cube(this.props,x+dx,y+h*.25,z,2,h*.5,3,0x404e5a);this.cube(this.props,x+dx/2,y+8,z,14,2,3,0xa7b7b9);}
 this.cube(this.props,x+15,y+4,z+15,32,3,3,0x7c919c);
 }
 // Habitats follow the ground; repeated ribs, glazing, solar fields and antennae establish a refuge.
 for(let i=0;i<9;i++){const x=1110+i%3*22,z=1148+Math.floor(i/3)*25,y=W.groundAt(x,z);
 this.form(this.props,this.cylinder,x,y+3,z,7,6,7,0x8b9da5);
 this.form(this.props,this.sphere,x,y+6,z,7.5,3.5,7.5,0xc1cbd0);
 this.cube(this.props,x,y+3,z-7,8,1,.3,0x75d8ea);this.cube(this.props,x+9,y+.15,z,3,.3,17,0xb9a47c);
 this.cube(this.props,x+9,y+8,z+5,.25,16,.25,0x96bac4);this.cube(this.props,x+9,y+15,z+5,4,.2,.3,0xf3c780);
 }
 for(let i=0;i<5;i++){const x=1098+i*22,z=1225,y=W.groundAt(x,z);const panel=this.cube(this.props,x,y+2,z,14,.3,9,0x233e59);panel.rotation.x=.3;}
 }
 batchLandmarks(){
 // Merge static architecture into one colored draw instead of one call per collar, window and support.
 const positions=[],normals=[],colors=[],indices=[],v=new this.T.Vector3(),n=new this.T.Vector3();this.props.updateMatrixWorld(true);
 this.props.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld),a=g.attributes.position,b=g.attributes.normal,offset=positions.length/3,color=o.material.color;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i);n.fromBufferAttribute(b,i);positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);colors.push(color.r,color.g,color.b);}indices.push(...(g.index?Array.from(g.index.array):Array.from({length:a.count},(_,i)=>i)).map(i=>i+offset));g.dispose();});
 const g=new this.T.BufferGeometry();for(const [name,a] of [['position',positions],['normal',normals],['color',colors]])g.setAttribute(name,new this.T.Float32BufferAttribute(a,3));g.setIndex(indices);this.shared.push(g);this.props.clear();this.props.add(new this.T.Mesh(g,this.archMaterial));
 }
 form(group,geo,x,y,z,w,h,d,color){const m=new this.T.Mesh(geo,this.mat(color));m.position.set(x,y,z);m.scale.set(w,h,d);group.add(m);return m;}
 bind(){this.abort=new AbortController();const on=(el,t,f)=>el.addEventListener(t,f,{signal:this.abort.signal});
 on(window,'resize',()=>this.resize());on(window,'keydown',e=>{if(!/INPUT|TEXTAREA/.test(e.target.tagName)){this.keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();}});on(window,'keyup',e=>delete this.keys[e.code]);on(window,'blur',()=>this.reset());on(document,'visibilitychange',()=>{this.reset();this.discovery?.flush();this.flushHealth();});on(window,'pagehide',()=>{this.discovery?.flush();this.flushHealth();});
 const c=this.renderer.domElement,pointers=new Map();let drag=null,pinch=0;
 on(c,'pointerdown',e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,time:performance.now(),moved:false,multi:pointers.size>1};if(pointers.size>1){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);drag.multi=true;}c.setPointerCapture(e.pointerId);});
 on(c,'pointermove',e=>{const p=pointers.get(e.pointerId);if(!p||!drag)return;p.x=e.clientX;p.y=e.clientY;if(pointers.size>1){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)this.zoom((pinch-d)*.2);pinch=d;drag.multi=true;return;}if(drag.id!==e.pointerId)return;
 if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>7)drag.moved=true;if(drag.moved){const delta=(e.clientX-drag.x)*.008;this.yaw-=delta;this.aimYaw-=delta;this.pitch=Math.max(.08,Math.min(1.25,this.pitch+(e.clientY-drag.y)*.006));this.aimPitch=Math.max(-.4,Math.min(.5,this.aimPitch-(e.clientY-drag.y)*.003));}drag.x=e.clientX;drag.y=e.clientY;});
 on(c,'pointerup',e=>{pointers.delete(e.pointerId);if(drag?.id===e.pointerId&&!drag.moved&&!drag.multi&&performance.now()-drag.time<250)this.pick(e.clientX,e.clientY);if(!pointers.size){drag=null;pinch=0;}});on(c,'pointercancel',e=>{pointers.delete(e.pointerId);drag=null;pinch=0;});on(c,'wheel',e=>{e.preventDefault();this.zoom(e.deltaY*.03);});

 }
 // Local continuity is a presentation fallback; verified rewards use Worker-owned HP.
 healthKey(){return (typeof SAVE_KEY==='string'?SAVE_KEY:'wm_save_v1')+':conquest-health-v1';}
 restoreHealth(){
 if(!this.encounter)return;try{const v=JSON.parse(localStorage.getItem(this.healthKey()));if(v?.v===1&&Number.isFinite(v.hp)&&v.hp>=0){this.encounter.playerHp=Math.min(this.encounter.playerMax,v.hp);if(!this.encounter.playerHp)this.encounter.state='defeat';}}catch(_){}
 }
 flushHealth(){
 const hp=(this.battle||this.encounter)?.playerHp;if(!Number.isFinite(hp)||hp===this.savedHealthHp)return;
 try{localStorage.setItem(this.healthKey(),JSON.stringify({v:1,hp:Math.max(0,hp)}));this.savedHealthHp=hp;}catch(_){}
 }
 safeFooting(p){
 if(p.surface==='ground'&&W.solidAt(p.x,p.z))return false;
 if(((this.battle||this.encounter)?.enemies||[]).some(e=>e.hp>0&&Math.hypot(p.x-e.x,p.z-e.z)<4&&Math.abs(p.y-e.y)<4))return false;
 return [[2,0],[-2,0],[0,2],[0,-2]].every(([dx,dz])=>{const q=W.advance(p,dx,dz);return Math.hypot(q.x-p.x-dx,q.z-p.z-dz)<.1;});
 }
 recover(){
 if(this.authority)return this.authority.action('recover');
 if(this.recoveryClock<this.recoveryReadyAt||this.stuckSeconds<1.5&&this.encounter?.state!=='defeat')return false;
 let safe=[...this.safeHistory].reverse().find(p=>Math.hypot(p.x-this.p.x,p.z-this.p.z)>=6&&Math.hypot(p.x-this.p.x,p.z-this.p.z)<=80&&this.safeFooting(p));
 // Fresh saved-position entries may have no breadcrumb yet. Validate a short
 // continuous physical route to a local checkpoint; never warp through an obstacle.
 if(!safe)for(const radius of [8,12,20,32]){for(let i=0;i<16;i++){const a=i*Math.PI/8,q=W.advance(this.p,Math.cos(a)*radius,Math.sin(a)*radius);if(Math.hypot(q.x-this.p.x,q.z-this.p.z)>=6&&this.safeFooting(q)){safe=q;break;}}if(safe)break;}
 if(!safe)return false;
 // Assign the endpoint directly: never feed a recovery displacement to atlas.accept.
 this.p={...safe};this.reset();this.stuckSeconds=0;this.recoveryReadyAt=this.recoveryClock+30;
 if(this.encounter?.state==='defeat'){this.encounter.playerHp=this.encounter.playerMax;this.encounter.state='active';this.encounter.projectiles=[];}
 return true;
 }
 recordSafe(dt,attempted,moved){
 this.recoveryClock+=dt;
 this.stuckSeconds=attempted>.001&&moved<attempted*.2?this.stuckSeconds+dt:attempted>.001?0:this.stuckSeconds;
 const last=this.safeHistory.at(-1);
 if(this.p.surface==='ground'&&!W.solidAt(this.p.x,this.p.z)&&(!last||Math.hypot(last.x-this.p.x,last.z-this.p.z)>8)){
 const free=this.safeFooting(this.p);
 if(free){this.safeHistory.push({...this.p});if(this.safeHistory.length>10)this.safeHistory.shift();}
 }
 }
 reset(){this.resume=true;this.keys={};this.stick={x:0,z:0};this.firing=false;this.fireTap=false;this.pendingAbilities={};}
 resize(){const w=this.host.clientWidth,h=this.host.clientHeight;this.detailRadius=w<=600?1:2;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 zoom(v){this.distance=Math.max(16,Math.min(110,this.distance+v));}
 jump(x,z){if(this.authority)return false;x=Math.max(1,Math.min(W.WIDTH-1,Number(x)));z=Math.max(1,Math.min(W.LENGTH-1,Number(z)));if(!Number.isFinite(x)||!Number.isFinite(z))return false;this.p={x,z,y:W.groundAt(x,z),surface:'ground'};this.pending=Infinity;this.reset();return true;}
 stream(){if(this.renderer.isConquestCanvas){this.pending=0;return;}const cell=Math.floor(this.p.x/128)+':'+Math.floor(this.p.z/128);
 if(cell!==this.horizonKey){this.horizonKey=cell;if(this.horizon){this.scene.remove(this.horizon);this.horizon.geometry.dispose();}const d=W.horizon(this.p.x,this.p.z,this.host.clientWidth<=600?2:4),g=new this.T.BufferGeometry();for(const [name,values] of [['position',d.positions],['normal',d.normals],['color',d.colors]])g.setAttribute(name,new this.T.Float32BufferAttribute(values,3));g.setAttribute('uv',new this.T.Float32BufferAttribute(d.positions.flatMap((_,i)=>i%3===0?[d.positions[i]/24,d.positions[i+2]/24]:[]),2));g.setIndex(d.indices);this.horizon=new this.T.Mesh(g,this.material);this.scene.add(this.horizon);}
 const selectionKey=cell+':'+this.detailRadius;if(selectionKey===this.selectionKey&&this.pending===0)return;if(selectionKey!==this.selectionKey){this.selectionKey=selectionKey;this.wanted=W.chunkKeys(this.p.x,this.p.z,this.host.clientWidth<=600?2:4,this.detailRadius);this.wanted.sort((a,b)=>Math.hypot(a.cx*128-this.p.x,a.cz*128-this.p.z)-Math.hypot(b.cx*128-this.p.x,b.cz*128-this.p.z));}
 const wanted=this.wanted;const keep=new Map(wanted.map(k=>[k.key,k]));for(const [key,o] of this.chunks){if(!keep.has(key)||keep.get(key).step!==o.step){this.scene.remove(o.group);o.group.traverse(m=>{if(m.geometry&&!this.shared.includes(m.geometry))m.geometry.dispose();if(m.isInstancedMesh)m.dispose();});this.chunks.delete(key);}}
 // Build nearest first, at most two per frame; no persistent CPU mesh cache.
 let budget=1;const streamStart=performance.now();
 for(const k of wanted){if(this.chunks.has(k.key)||!budget||performance.now()-streamStart>3)continue;budget--;const d=W.chunk(k.cx,k.cz,k.step),T=this.T,g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(d.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(d.normals,3));g.setAttribute('color',new T.Float32BufferAttribute(d.colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(d.positions.flatMap((_,i)=>i%3===0?[(d.positions[i]+k.cx*128)/24,(d.positions[i+2]+k.cz*128)/24]:[]),2));g.setIndex(d.indices);
 const group=new T.Group();group.add(new T.Mesh(g,this.material));
 // Skirts hide coarse/fine edge cracks without changing the canonical surface.
 const verts=[],idx=[];for(let side=0;side<4;side++)for(let t=0;t<=128;t+=k.step){let x=side===0?0:side===1?128:t,z=side===2?0:side===3?128:t,y=W.heightAt(k.cx*128+x,k.cz*128+z),n=verts.length/3;verts.push(x,y,z,x,y-14,z);if(t<128)idx.push(n,n+1,n+2,n+2,n+1,n+3);}
 const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(verts,3));skirt.setIndex(idx);skirt.computeVertexNormals();const offset=d.positions.length/3,combined=g.clone();for(const [name,size,extra] of [['position',3,verts],['normal',3,Array.from(skirt.attributes.normal.array)],['color',3,verts.flatMap((_,i)=>i%3===0?[.41,.4,.37]:[])],['uv',2,verts.flatMap((_,i)=>i%3===0?[verts[i]/24,verts[i+2]/24]:[])]])combined.setAttribute(name,new T.Float32BufferAttribute([...g.attributes[name].array,...extra],size));combined.setIndex([...d.indices,...idx.map(i=>i+offset)]);group.children[0].geometry=combined;g.dispose();skirt.dispose();
 // Trees have separate trunks and varied layered crowns; all repetition is instanced and distance culled.
 if(k.step===4){const D=root.ConquestCombat.baseDefinition,list=W.scenery(k.cx,k.cz).filter(p=>p.kind!=='tree'||Math.abs(p.x-D.x)>24||Math.abs(p.z-D.z)>22),trees=list.filter(p=>p.kind==='tree'),pines=trees.filter(p=>p.variant>=.4),broad=trees.filter(p=>p.variant<.4),relays=list.filter(p=>p.kind==='relay'),rocks=list.filter(p=>p.kind==='rock'&&p.variant>.45);
 const batch=(items,geo,color,shape)=>{if(!items.length)return;const mesh=new T.InstancedMesh(geo,this.mat(color),items.length),o=new T.Object3D();items.forEach((p,i)=>{shape(o,p);o.position.x+=p.x-k.cx*128;o.position.z+=p.z-k.cz*128;o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});group.add(mesh);};
 batch(trees,this.cylinder,0x625345,(o,p)=>{o.position.set(0,p.y+p.size*1.6,0);o.scale.set(.22*p.size,3.2*p.size,.22*p.size);});
 for(let level=0;level<2;level++)batch(pines,this.cone,level?0x4e7964:0x304f45,(o,p)=>{o.position.set(0,p.y+p.size*(3.1+level*1.4),0);o.scale.set(p.size*(1.6-level*.4),p.size*3,p.size*(1.6-level*.4));});
 batch(broad,this.sphere,0x577761,(o,p)=>{o.position.set(0,p.y+p.size*3.8,0);o.scale.set(p.size*1.9,p.size*1.5,p.size*1.9);});
 batch(relays,this.cylinder,0x4b5664,(o,p)=>{o.position.set(0,p.y+6,0);o.scale.set(.35,12,.35);});batch(relays,this.sphere,0x9f947e,(o,p)=>{o.position.set(0,p.y+12,0);o.scale.set(3,.3,2);o.rotation.z=.6;});
 batch(rocks,this.rock,0x727781,(o,p)=>{o.position.set(0,p.y+p.size*.3,0);o.scale.set(p.size*1.6,p.size*(.5+p.variant),p.size);o.rotation.set(p.variant,0,p.variant*.4);});
 }
 this.scene.add(group);this.chunks.set(k.key,{group,step:k.step,cx:k.cx,cz:k.cz});this.builds++;}
 this.pending=wanted.length-this.chunks.size;
 }
 tick(dt){if(this.disposed||document.hidden)return;this.profileFrame();if(this.resume){dt=0;this.resume=false;}dt=Math.min(.25,Math.max(0,dt));if(this.authority&&(!this.authority.connected||this.authority.actionBusy))dt=0;this.loadoutElapsed=(this.loadoutElapsed||0)+dt;if(this.loadoutElapsed>=.5){this.syncLoadout();this.loadoutElapsed=0;}this.elapsed+=dt;this.frames++;if(this.elapsed>.5){this.fps=this.frames/this.elapsed;this.elapsed=0;this.frames=0;}
 let sx=this.stick.x+(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0),sz=this.stick.z+(this.keys.KeyW||this.keys.ArrowUp?1:0)-(this.keys.KeyS||this.keys.ArrowDown?1:0),n=Math.max(1,Math.hypot(sx,sz));sx/=n;sz/=n;
 const dx=(Math.cos(this.yaw)*sx-Math.sin(this.yaw)*sz)*this.speed*dt,dz=(-Math.sin(this.yaw)*sx-Math.cos(this.yaw)*sz)*this.speed*dt;
 const old=this.p,board=this.battle||this.encounter;if(root.ConquestControl&&board){const input=this.controlInput(dt,sx,sz);const simStart=performance.now();this.p=root.ConquestControl.advance(board,this.p,input,dt,!this.battle);this.controlSimMs=performance.now()-simStart;this.authority?.sample(dt,input);this.controlStepped=true;}else this.p=this.encounter?.state==='defeat'&&!this.battle?this.p:W.advance(this.p,dx,dz);
 if((this.battle||this.encounter)?.state==='active'&&(this.battle||this.encounter).enemies.some(e=>e.hp>0&&Math.hypot(this.p.x-e.x,this.p.z-e.z)<3.8&&Math.abs(this.p.y-e.y)<3))this.p=old;this.blocked=(sx||sz)&&old===this.p;
 const mx=this.p.x-old.x,mz=this.p.z-old.z,moved=Math.hypot(mx,mz);
 this.recordSafe(dt,Math.hypot(dx,dz),moved);
 if(moved)this.heading=Math.atan2(mx,mz);
 if(this.motion){const h=this.heading||0,pathScale=moved?Math.hypot(mx,this.p.y-old.y,mz)/moved:1;this.motion.step(dt,{dx:mx*pathScale/1.65,dz:mz*pathScale/1.65,heading:Math.PI/2-h,trackHalfWidth:M3.CHASSIS_VISUALS[this.loadout.c.c][M3.visualTier(this.loadout.c.t)].trackZ},false);}
 this.discovery?.accept(old,this.p,dt,this.speed);
 const up=new this.T.Vector3(...W.surfaceNormal(this.p.x,this.p.z));if(this.p.surface==='bridge'){const a=W.deckAt(this.p.x-.1,this.p.z),b=W.deckAt(this.p.x+.1,this.p.z);up.set(a!==null&&b!==null?-(b-a)/.2:0,1,0).normalize();}const forward=new this.T.Vector3(Math.sin(this.heading||0),0,Math.cos(this.heading||0));forward.addScaledVector(up,-forward.dot(up)).normalize();const right=new this.T.Vector3().crossVectors(up,forward).normalize();this.vehicle.quaternion.setFromRotationMatrix(new this.T.Matrix4().makeBasis(right,up,forward));
 this.combatTick(dt);this.stream();this.origin.x=Math.floor(this.p.x/128)*128;this.origin.z=Math.floor(this.p.z/128)*128;const ox=this.origin.x,oz=this.origin.z;
 for(const c of this.chunks.values())c.group.position.set(c.cx*128-ox,0,c.cz*128-oz);this.props.position.set(-ox,0,-oz);this.horizon?.position.set(-ox,0,-oz);const correction=this.renderCorrection||(this.renderCorrection={x:0,z:0}),decay=Math.exp(-dt*14);correction.x*=decay;correction.z*=decay;this.vehicle.position.set(this.p.x-ox+correction.x,this.p.y,this.p.z-oz+correction.z);
 const nearBase=this.authority?.state?.base?.tier&&Math.hypot(this.p.x-root.ConquestCombat.baseDefinition.x,this.p.z-root.ConquestCombat.baseDefinition.z)<40;if(nearBase&&!this.baseCamera){this.baseCamera={distance:this.distance,pitch:this.pitch};this.distance=65;this.pitch=.9;}else if(!nearBase&&this.baseCamera){Object.assign(this,this.baseCamera);this.baseCamera=null;}const tx=this.p.x-ox,tz=this.p.z-oz,d=this.distance,cy=this.p.y+3;let cx=this.p.x+Math.sin(this.yaw)*Math.cos(this.pitch)*d,cz=this.p.z+Math.cos(this.yaw)*Math.cos(this.pitch)*d,hy=cy+Math.sin(this.pitch)*d;
 // Sample the sight ray to lift the camera above intervening terrain and opaque bridge surfaces.
 for(let i=1;i<=16;i++){const t=i/16,x=this.p.x+(cx-this.p.x)*t,z=this.p.z+(cz-this.p.z)*t;const ground=W.groundAt(x,z)+3;hy=Math.max(hy,cy+(ground-cy)/t);const deck=W.deckAt(x,z);if(deck!==null&&this.p.surface==='bridge')hy=Math.max(hy,cy+(deck+3-cy)/t);}
 // Pull camera in front of opaque structures rather than looking through processor walls.
 for(let i=1;i<=96;i++){const t=i/96,x=this.p.x+(cx-this.p.x)*t,z=this.p.z+(cz-this.p.z)*t,y=cy+(hy-cy)*t;if(W.blockedAt(x,y,z)){const safe=Math.max(.03,(i-2)/96);cx=this.p.x+(cx-this.p.x)*safe;cz=this.p.z+(cz-this.p.z)*safe;hy=cy+(hy-cy)*safe;break;}}
 // A close obstruction must not push the camera inside our own hull.
 if(Math.hypot(cx-this.p.x,cz-this.p.z)<7){cx=this.p.x;cz=this.p.z+.1;hy=Math.max(hy,this.p.y+Math.max(18,d*.8));}
 this.camera.position.set(cx-ox+correction.x,hy,cz-oz+correction.z);this.camera.lookAt(tx+correction.x,cy,tz+correction.z);this.combatRender();const renderStart=root.performance?root.performance.now():Date.now();this.renderer.render(this.scene,this.camera);this.renderCpuMs=(root.performance?root.performance.now():Date.now())-renderStart;
 }
 profileFrame(){const now=root.performance?root.performance.now():Date.now();if(this.profileLast){const ms=now-this.profileLast;if(!this.frameSamples)this.frameSamples=[];this.frameSamples.push(ms);if(this.frameSamples.length>600)this.frameSamples.shift();this.frameCount=(this.frameCount||0)+1;this.hitches=(this.hitches||0)+(ms>100?1:0);this.worstFrame=Math.max(this.worstFrame||0,ms);
 if(!this.renderer.isConquestCanvas&&this.frameCount%60===0&&typeof gfxMode==='function'&&gfxMode()==='auto'){const a=this.frameSamples.slice(-60).sort((a,b)=>a-b),p95=a[Math.floor(a.length*.95)];this.slowWindows=p95>24?(this.slowWindows||0)+1:0;this.fastWindows=p95<18?(this.fastWindows||0)+1:0;if(this.slowWindows>=2){const previous=this.autoRatio||this.renderer.getPixelRatio?.()||1.5;this.autoRatio=previous<=1?.75:1;if(previous!==this.autoRatio)this.renderer.setPixelRatio(this.autoRatio);this.detailRadius=1;this.autoLow=true;this.slowWindows=0;this.fastWindows=0;}else if(this.autoLow&&this.fastWindows>=18){this.autoRatio=this.autoRatio===.75?1:Math.min(devicePixelRatio,1.5);this.renderer.setPixelRatio(this.autoRatio);this.autoLow=this.autoRatio<=1;this.fastWindows=0;}}}
 this.profileLast=now;
 }
 performanceReport(){const a=[...(this.frameSamples||[])].sort((a,b)=>a-b),n=a.length;return {samples:n,pixelRatio:this.autoRatio||this.renderer.getPixelRatio?.()||0,percentBelow50fps:n?100*a.filter(t=>t>20).length/n:null,percentBelow40fps:n?100*a.filter(t=>t>25).length/n:null,percentBelow30fps:n?100*a.filter(t=>t>1000/30).length/n:null,simulationMs:this.simMs||0,renderSubmissionMs:this.renderCpuMs||0,heapBytes:root.performance?.memory?.usedJSHeapSize||null,textures:this.renderer.info?.memory?.textures||0,frameMedian:n?a[Math.floor(n*.5)]:null,frameP95:n?a[Math.floor(n*.95)]:null,worstFrame:this.worstFrame||0,hitches:this.hitches||0,drawCalls:this.renderer.info?.render?.calls||0,triangles:this.renderer.info?.render?.triangles||0,geometries:this.renderer.info?.memory?.geometries||0,chunks:this.chunks.size,enemies:(this.battle||this.encounter)?.enemies.filter(e=>e.hp>0).length||0,projectiles:(this.battle||this.encounter)?.projectiles.length||0,autoLow:!!this.autoLow,physicalDeviceVerified:false};}
 dispose(){if(this.disposed)return;this.authority?.dispose();this.clearBattle();this.disposed=true;this.lifecycle.abort();this.discovery?.flush();try{if(this.encounter)localStorage.setItem('lunar-conquest-garrisons-v1',JSON.stringify(this.encounter.cleared));}catch(_){}this.encounter?.dispose();this.abort.abort();try{localStorage.setItem('lunar-conquest-position-v1',JSON.stringify({x:this.p.x,z:this.p.z,surface:this.p.surface}));}catch(_){}for(const c of this.chunks.values())c.group.traverse(m=>{if(m.geometry&&!this.shared.includes(m.geometry))m.geometry.dispose();if(m.isInstancedMesh)m.dispose();});this.chunks.clear();this.horizon?.geometry.dispose();this.baseGroup?.traverse(o=>{if(o.geometry&&!this.shared?.includes(o.geometry))o.geometry.dispose();});this.motion?.dispose();if(typeof Equipment3D!=='undefined')Equipment3D.releaseTree(this.vehicle);this.vehicle.traverse(o=>{if(o.geometry&&!o.geometry.userData.hfShared&&!this.shared?.includes(o.geometry))o.geometry.dispose();});Object.values(this.modelMats||{}).forEach(m=>m.dispose());this.shared.forEach(g=>g.dispose());this.selectionMaterial?.dispose();this.shieldMaterial?.dispose();this.lootMeshes?.clear();this.material.dispose();this.archMaterial.dispose();this.groundTexture.dispose();Object.values(this.materials).forEach(m=>m.dispose());this.hfRelease?.();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
root.ConquestView=View;
})(globalThis);
