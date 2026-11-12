'use strict';
// =====================================================================
// MapEnv: the shared environment layer of the Arcade maps (Session 5E-2c). Presentation only: it never reads the sim's
// random(), the save or the network, and nothing here changes a hitbox.
//
// One instance per battle scene owns everything that is "the weather" of a map, so a later session can drive it per match
// (rain, dust storms, meteor showers, solar flares, crater vents, ceiling lasers, a maglev train) WITHOUT rebuilding a map:
//   lighting   the scene's three lights (sky, sun, fill) and the baked ground's two light terms, kept in step
//   fog        a linear depth haze (ground shader + scene.fog for every lit mesh), off by default
//   sky        clear colour, stars, the Earth, a flash layer (lightning / flare)
//   particles  ambient emitters (dust motes, steam, sparks) that write into the host's two particle batches
//   anchors    named points each map publishes for hazards (vents, laser mounts, rail line, drop zones)
//
// API (all on the object create() returns):
//   env.use(mapId, anchors)        load a map's preset (MapEnv.PRESETS[mapId]) and its ambient emitters; called by Arena3D
//   env.set(patch, seconds)        blend any state fields to new values over `seconds` (0 = now). Fields: see STATE below
//   env.reset(seconds)             blend back to the map's preset and drop every 'weather' emitter
//   env.flash(rgb, strength, sec)  a short additive pulse of light on ground, props and tanks (lightning, flare, blast)
//   env.addEmitter(spec) -> id     an ambient / weather particle emitter (spec: see EMITTER below); env.removeEmitter(id);
//                                  env.clearEmitters(group)
//   env.update(dt, t)              once a frame (render3d calls it)
//   env.state                      the live values; env.uniforms: what the ground shader reads (uAmb, uSun, uFogC, uFog)
//   env.anchors                    {vents:[[x,z,r]..], lasers:[[x,y,z,dx,dz]..], rail:[[x,y,z],[x,y,z]], drops:[[x,z]..], area:[x0,z0,x1,z1]}
//   env.sunDir()                   unit vector towards the sun. Changing state.sunDir moves the lights at once; the baked
//                                  shadows follow on env.onRebake (Arena3D re-bakes the ground in one frame, no rebuild)
// STATE fields (colours are linear [r,g,b]):
//   sunDir[3]  sun[3] sunI   sky[3] gnd[3] hemiI   fill[3] fillI   gGain (ground brightness trim)  gAmb (how much sky light
//   reaches ground in shadow: lower = darker, harder ground shadows; props and tanks are not affected)
//   fogC[3] fog (0..1) fogNear fogFar (ground z where the haze starts / is full; smaller z is further from the camera)
//   clear[3] stars (0..1) earth (0..1) exposure   shadow (0..1 strength of tank / crate ground shadows)
// EMITTER spec: {group:'ambient'|'weather', add:true|false, rate (per second), area:[x0,z0,x1,z1], y:[lo,hi], life:[lo,hi],
//   size:[start,end], color:'#rrggbb' or [colours], alpha, vel:[vx,vy,vz], jitter (speed spread), gravity, drag}
// =====================================================================
const MapEnv=(()=>{
 const VERSION='mapenv-1';
 const lin=h=>{const n=parseInt(String(h).slice(1),16),f=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return [f(n>>16),f((n>>8)&255),f(n&255)];};
 const SUN=[-0.6,0.66,-0.45];   // one sun for every outdoor map: shadows fall right and towards the camera, a little longer than the prop is tall (1.14 x)
 const base={sunDir:SUN,sun:lin('#fffaf2'),sunI:2.5,sky:lin('#b9cbe0'),gnd:lin('#2a3038'),hemiI:0.95,fill:lin('#9ab8de'),fillI:0.8,gGain:1.06,gAmb:0.44,
  fogC:lin('#8a8f98'),fog:0,fogNear:30,fogFar:-12,clear:lin('#04060b'),stars:1,earth:1,exposure:1.1,shadow:0.62};
 // Per-map presets: the look each map loads with. Outdoor maps share the sun; each has its own temperature and ambient motes.
 const PRESETS={
  classic:Object.assign({},base,{emit:[{kind:'motes',rate:5,color:['#fff4dc','#cfe2ff'],alpha:0.5}]}),
  overpass:Object.assign({},base,{sun:lin('#fff8ee'),sunI:2.55,sky:lin('#bfd2e8'),emit:[{kind:'motes',rate:5,color:['#ffffff','#9fe8ff'],alpha:0.5}]}),
  longshot:Object.assign({},base,{sun:lin('#fff6e8'),sunI:2.55,sky:lin('#b4c5dc'),hemiI:0.95,emit:[{kind:'motes',rate:4,color:['#ffe6bf','#ffd08a'],alpha:0.45}]}),
  craters:Object.assign({},base,{sun:lin('#fffaf2'),sky:lin('#b4c8e0'),emit:[{kind:'motes',rate:5,color:['#fff4dc','#d8e6ff'],alpha:0.5}]}),
  canyon:Object.assign({},base,{sun:lin('#fff6e8'),sunI:2.55,sky:lin('#b2c3da'),hemiI:0.95,emit:[{kind:'motes',rate:4,color:['#ffe0b8','#e8d2b0'],alpha:0.45},{kind:'fall',rate:1.2}]}),
  // the only interior: overhead work lights (a steep "sun": short shadows straight under things), cool steel bounce
  bunker:Object.assign({},base,{sunDir:[-0.42,0.84,-0.34],sun:lin('#fff3e0'),sunI:2.1,sky:lin('#aab2bc'),gnd:lin('#262c33'),hemiI:0.66,fill:lin('#8cc4dc'),fillI:0.75,
   clear:lin('#030509'),shadow:0.5,gAmb:0.8,emit:[{kind:'motes',rate:4,color:['#bfefff','#ffe2b0'],alpha:0.4},{kind:'steam',rate:2.2},{kind:'spark',rate:0.35}]})
 };
 const KEYS=['sunDir','sun','sunI','sky','gnd','hemiI','fill','fillI','gGain','gAmb','fogC','fog','fogNear','fogFar','clear','stars','earth','exposure','shadow'];
 const copy=s=>{const o={};for(const k of KEYS)o[k]=Array.isArray(s[k])?s[k].slice():s[k];return o;};
 const mix=(a,b,f)=>Array.isArray(a)?a.map((v,i)=>v+(b[i]-v)*f):a+(b-a)*f;
 const hex=h=>{const n=parseInt(String(h).slice(1),16);return [(n>>16)/255,((n>>8)&255)/255,(n&255)/255];};
 // host: {scene, renderer, lights:{hemi,key,fill}, emit(add,p), dot(add,x,y,z,size,r,g,b,a), low(), quiet(), sky:{stars,earth}}
 function create(T,host){
  const state=copy(base),from=copy(base),to=copy(base);let tw=1,twD=0,preset=copy(base),mapId='classic',flashT=0,flashD=0,flashS=0,flashC=[1,1,1],eid=0;
  const uniforms={uAmb:{value:new T.Vector3()},uSun:{value:new T.Vector3()},uFogC:{value:new T.Vector3()},uFog:{value:new T.Vector3(0,0,1)},uFlash:{value:new T.Vector3()}};
  const emitters=[],anchors={vents:[],lasers:[],rail:null,drops:[],area:[0,0,20,32]};
  const env={VERSION,state,uniforms,anchors,onRebake:null,emitters},clearC=new T.Color(),bakedDir=[0,0,0];let haveDir=false;
  env.sunDir=()=>{const d=state.sunDir,l=Math.hypot(d[0],d[1],d[2])||1;return [d[0]/l,d[1]/l,d[2]/l];};
  function sync(){
   const L=host.lights,d=env.sunDir(),fl=flashT>0?flashS*Math.pow(flashT/flashD,1.5):0;
   if(L){
    L.hemi.color.setRGB(state.sky[0],state.sky[1],state.sky[2]);L.hemi.groundColor.setRGB(state.gnd[0],state.gnd[1],state.gnd[2]);L.hemi.intensity=state.hemiI+fl*0.9;
    L.key.color.setRGB(state.sun[0]+flashC[0]*fl,state.sun[1]+flashC[1]*fl,state.sun[2]+flashC[2]*fl);L.key.intensity=state.sunI;L.key.position.set(d[0]*20,d[1]*20,d[2]*20);
    L.fill.color.setRGB(state.fill[0],state.fill[1],state.fill[2]);L.fill.intensity=state.fillI;
   }
   // the baked ground is lit exactly like a flat Lambert surface under the same three lights (three: radiance = albedo/PI * E).
   // Its sun term is stored as 0.78 for flat lit ground, so slopes facing the sun can be brighter than flat ground.
   const g=state.gGain/Math.PI,ga=g*state.gAmb,fy=L?Math.max(0,L.fill.position.y/(L.fill.position.length()||1)):0.4;
   uniforms.uAmb.value.set((state.sky[0]*state.hemiI+state.fill[0]*state.fillI*fy)*ga+flashC[0]*fl*0.4,(state.sky[1]*state.hemiI+state.fill[1]*state.fillI*fy)*ga+flashC[1]*fl*0.4,(state.sky[2]*state.hemiI+state.fill[2]*state.fillI*fy)*ga+flashC[2]*fl*0.4);
   const k=state.sunI*d[1]/0.78*g;uniforms.uSun.value.set(state.sun[0]*k,state.sun[1]*k,state.sun[2]*k);
   uniforms.uFogC.value.set(state.fogC[0],state.fogC[1],state.fogC[2]);uniforms.uFog.value.set(state.fog,state.fogNear,state.fogFar);
   if(host.scene){   // every lit mesh (props, tanks) takes the same haze through scene.fog; created only when a haze is asked for
    if(state.fog>0.001){const c=host.cam?host.cam():null,f=z=>c?c.depthOf(z):150-z*0.565;
     if(!host.scene.fog)host.scene.fog=new T.Fog(0,1,2);host.scene.fog.color.setRGB(state.fogC[0],state.fogC[1],state.fogC[2]);
     const n=f(state.fogNear),fr=f(state.fogFar);host.scene.fog.near=n;host.scene.fog.far=n+(fr-n)/Math.max(0.02,state.fog);}
    else if(host.scene.fog)host.scene.fog.far=1e9,host.scene.fog.near=1e9-1;
   }
   if(host.renderer){host.renderer.setClearColor(clearC.setRGB(state.clear[0],state.clear[1],state.clear[2]),1);if(host.exposure!==false)host.renderer.toneMappingExposure=state.exposure;}
   if(host.sky)host.sky(state.stars,state.earth);
   // the baked shadows follow the sun once it has stopped moving (a blend re-bakes once, at its end, not every frame)
   if(!haveDir){haveDir=true;bakedDir[0]=d[0];bakedDir[1]=d[1];bakedDir[2]=d[2];}
   else if(tw>=1&&Math.abs(d[0]-bakedDir[0])+Math.abs(d[1]-bakedDir[1])+Math.abs(d[2]-bakedDir[2])>0.002){bakedDir[0]=d[0];bakedDir[1]=d[1];bakedDir[2]=d[2];if(env.onRebake)env.onRebake(d);}
  }
  env.apply=s=>{for(const k of KEYS)if(s[k]!==undefined){state[k]=Array.isArray(s[k])?s[k].slice():s[k];to[k]=state[k];from[k]=state[k];}tw=1;sync();};
  env.set=(patch,sec)=>{for(const k of KEYS){from[k]=Array.isArray(state[k])?state[k].slice():state[k];if(patch[k]!==undefined)to[k]=Array.isArray(patch[k])?patch[k].slice():patch[k];}
   if(!(sec>0)){for(const k of KEYS)state[k]=Array.isArray(to[k])?to[k].slice():to[k];tw=1;sync();}else{tw=0;twD=sec;}};
  env.reset=sec=>{env.clearEmitters('weather');env.set(preset,sec||0);};
  env.flash=(rgb,strength,sec)=>{flashC=rgb||[1,1,1];flashS=strength||1;flashD=flashT=Math.max(0.05,sec||0.3);};
  // ---- ambient / weather emitters ----
  env.addEmitter=spec=>{const e=Object.assign({id:++eid,group:'ambient',add:true,rate:4,area:anchors.area,y:[0.2,1.6],life:[2,4],size:[0.05,0.02],color:'#ffffff',alpha:0.5,vel:[0,0,0],jitter:0.1,gravity:0,drag:0,acc:0},spec);
   e.cols=(Array.isArray(e.color)?e.color:[e.color]);emitters.push(e);return e.id;};
  env.removeEmitter=id=>{const i=emitters.findIndex(e=>e.id===id);if(i>=0)emitters.splice(i,1);};
  env.clearEmitters=group=>{for(let i=emitters.length-1;i>=0;i--)if(!group||emitters[i].group===group)emitters.splice(i,1);};
  const rnd=(a,b)=>a+(b-a)*Math.random();
  function stepEmitters(dt){
   if(!host.emit||(host.quiet&&host.quiet()))return;   // reduced motion: the air stands still
   const k=host.low&&host.low()?0.4:1;
   for(const e of emitters){e.acc+=e.rate*k*dt;let n=Math.floor(e.acc);if(n<=0)continue;e.acc-=n;n=Math.min(n,6);
    for(let i=0;i<n;i++){const p=e.pick?e.pick():null,x=p?p[0]:rnd(e.area[0],e.area[2]),z=p?p[2]:rnd(e.area[1],e.area[3]),y=p?p[1]:rnd(e.y[0],e.y[1]);
     host.emit(e.add,{x,y,z,vx:e.vel[0]+rnd(-1,1)*e.jitter,vy:e.vel[1]+rnd(-1,1)*e.jitter*0.5,vz:e.vel[2]+rnd(-1,1)*e.jitter,life:rnd(e.life[0],e.life[1]),s0:e.size[0],s1:e.size[1],
      c:e.cols[(Math.random()*e.cols.length)|0],a:e.alpha,g:e.gravity,drag:e.drag,fade:e.fade});}}
  }
  // the kinds a preset can name; each is only an emitter spec, so weather code can add its own with addEmitter
  function ambient(kind,o){
   const A=anchors.area;
   if(kind==='motes')return {group:'ambient',add:true,rate:o.rate,area:A,y:[0.25,1.9],life:[2.6,4.6],size:[0.035,0.085],color:o.color,alpha:o.alpha||0.5,vel:[0.05,0.03,0.03],jitter:0.09};   // dust glinting in the light
   if(kind==='fall')return {group:'ambient',add:false,rate:o.rate,y:[1.2,1.5],life:[0.7,1.1],size:[0.07,0.16],color:['#8d8a84','#6f6c68'],alpha:0.42,vel:[0,-0.9,0],jitter:0.16,gravity:2.2,
    pick:()=>{const v=anchors.walls&&anchors.walls.length?anchors.walls[(Math.random()*anchors.walls.length)|0]:null;return v?[v[0]+rnd(-0.3,0.3),rnd(1.1,1.4),v[1]+rnd(-0.3,0.3)]:null;}};   // grit trickling off the canyon walls
   if(kind==='steam')return {group:'ambient',add:false,rate:o.rate,life:[1.4,2.4],size:[0.16,0.7],color:['#b8c6cf','#93a3ad'],alpha:0.2,vel:[0,0.55,0],jitter:0.12,drag:0.4,
    pick:()=>{const v=anchors.vents.length?anchors.vents[(Math.random()*anchors.vents.length)|0]:null;return v?[v[0]+rnd(-0.1,0.1),v[3]||0.3,v[1]+rnd(-0.1,0.1)]:null;}};
   if(kind==='spark')return {group:'ambient',add:true,rate:o.rate,life:[0.35,0.7],size:[0.07,0.02],color:['#ffd27a','#fff2c4','#9fe8ff'],alpha:0.95,vel:[0,0.6,0],jitter:1.1,gravity:5,
    pick:()=>{const v=anchors.sparks&&anchors.sparks.length?anchors.sparks[(Math.random()*anchors.sparks.length)|0]:null;return v?[v[0],v[1],v[2]]:null;}};
   return null;
  }
  env.use=(id,a)=>{mapId=PRESETS[id]?id:'classic';const P=PRESETS[mapId];preset=copy(P);
   anchors.vents=(a&&a.vents)||[];anchors.lasers=(a&&a.lasers)||[];anchors.rail=(a&&a.rail)||null;anchors.drops=(a&&a.drops)||[];anchors.walls=(a&&a.walls)||[];anchors.sparks=(a&&a.sparks)||[];anchors.area=(a&&a.area)||[0,0,20,32];
   env.clearEmitters();for(const o of P.emit||[]){const s=ambient(o.kind,o);if(s)env.addEmitter(s);}
   flashT=0;haveDir=false;env.apply(preset);};
  env.update=(dt,t)=>{
   if(tw<1){tw=Math.min(1,tw+dt/Math.max(0.001,twD));const f=tw*tw*(3-2*tw);for(const k of KEYS)state[k]=mix(from[k],to[k],f);}
   if(flashT>0)flashT=Math.max(0,flashT-dt);
   sync();stepEmitters(dt);
  };
  env.mapId=()=>mapId;env.preset=()=>copy(preset);
  env.use('classic');
  return env;
 }
 return {VERSION,PRESETS,SUN,create,lin,hex};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=MapEnv;
