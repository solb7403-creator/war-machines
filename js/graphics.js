'use strict';
// Static release gate. LIVE since 2026-10-31 nonpayment gear release. Rollback: flip the boolean below to false, bump version.json + index.html ?v, publish once.
const GraphicsRelease=Object.freeze({version:'graphics-r1',enabled:true});
// Cosmetic state only: never reads/writes saves, simulation, inventory or authoritative RNG.
const GraphicsMotion=(()=>{
 const PROFILES=Object.freeze({pulse:{kick:.075,damp:19,flash:.065},twin:{kick:.035,damp:26,flash:.040},siege:{kick:.14,damp:12,flash:.095},moon:{kick:.060,damp:17,flash:.085}});
 const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const state=()=>({left:0,right:0,kick:0,charge:0,hit:0,heading:null,aim:0,phase:0,profile:'pulse'});
 const delta=a=>Math.atan2(Math.sin(a),Math.cos(a));
 function shot(s,arch){s.profile=PROFILES[arch]?arch:'pulse';s.kick=Math.min(PROFILES[s.profile].kick*1.5,s.kick+PROFILES[s.profile].kick);s.charge=1;s.shots=(s.shots|0)+1;}   // shots: which barrel of a Meshy weapon recoils next
 function advance(s,dt,v={},quiet=reduced()){
  dt=Math.max(0,Math.min(.05,dt));const hd=v.heading||0,dh=s.heading===null?0:delta(hd-s.heading),dist=(v.dx||0)*Math.cos(hd)+(v.dz||0)*Math.sin(hd);s.heading=hd;
  if(!quiet){const half=v.trackHalfWidth??.78;s.left+=dist+dh*half;s.right+=dist-dh*half;s.phase+=dt;s.kick*=Math.exp(-PROFILES[s.profile].damp*dt);s.hit*=Math.exp(-18*dt);}else{s.kick=0;s.hit=0;}
  s.charge*=Math.exp(-7*dt);s.aim+=delta((v.aim||0)-s.aim)*(1-Math.exp(-38*dt));return s;
 }
 // Wheel and tread displacement on the existing baked surfaces; matching normal/tangent rotation.
 const GLSL=`attribute vec4 drive;uniform vec2 uDrive;uniform vec4 uTrack;uniform float uCharge;varying float vCore;
 void trackFrame(float s,float a,float r,out vec2 p,out float angle){float L=4.0*a+6.2831853*r;s=mod(mod(s,L)+L,L);if(s<2.0*a){p=vec2(s-a,r);angle=0.0;}else if(s<2.0*a+3.14159265*r){float t=(s-2.0*a)/r;p=vec2(a+sin(t)*r,cos(t)*r);angle=-t;}else if(s<4.0*a+3.14159265*r){p=vec2(a-(s-2.0*a-3.14159265*r),-r);angle=3.14159265;}else{float t=(s-4.0*a-3.14159265*r)/r;p=vec2(-a-sin(t)*r,-cos(t)*r);angle=3.14159265-t;}}
 void drivePose(out vec2 old,out vec2 dest,out float ang){old=drive.xy;dest=old;ang=0.0;if(drive.z<0.5)return;float travel=drive.w<0.0?uDrive.x:uDrive.y;if(drive.z<1.5){ang=-travel/max(.06,drive.z-1.0);return;}float center=uTrack.w>0.0?sign(old.x)*uTrack.w:0.0;float a=uTrack.x,r=uTrack.y,s=(drive.z-2.0)*(4.0*a+6.2831853*r);float initial=s<2.0*a?0.0:s<2.0*a+3.14159265*r?-(s-2.0*a)/r:s<4.0*a+3.14159265*r?3.14159265:3.14159265-(s-4.0*a-3.14159265*r)/r;trackFrame(s+travel,a,r,dest,ang);dest+=vec2(center,uTrack.z);ang-=initial;}
 vec2 driveRotate(vec2 v,float a){return mat2(cos(a),sin(a),-sin(a),cos(a))*v;}
 `;
 function attach(root,track,{includeOwned=false}={}){
  const s=state(),uniforms={uDrive:{value:new THREE.Vector2()},uTrack:{value:new THREE.Vector4(...(track||[1,.22,.25,0]))},uCharge:{value:0}},materials=new Map();
  root.traverse(o=>{if(!o.isMesh||(!o.material?.userData.hfShared&&!includeOwned)||o.material.userData.motionSkip)return;const base=o.material,driven=!!o.geometry.attributes.drive,key=base.uuid+'|'+driven;let m=materials.get(key);if(!m){m=base.clone();m.userData={graphicsOwned:true};m.defaultAttributeValues={...m.defaultAttributeValues,drive:[0,0,0,0]};m.customProgramCacheKey=()=> 'lunar-motion-v1|'+driven;m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=GLSL+shader.vertexShader;if(driven){shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvec2 oldDrive,newDrive;float driveAngle;drivePose(oldDrive,newDrive,driveAngle);objectNormal.xy=driveRotate(objectNormal.xy,driveAngle);\n#ifdef USE_TANGENT\nobjectTangent.xy=driveRotate(objectTangent.xy,driveAngle);\n#endif').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.xy=driveRotate(transformed.xy-oldDrive,driveAngle)+newDrive;');}shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCore=position.x;');shader.fragmentShader='uniform float uCharge;varying float vCore;\n'+shader.fragmentShader; if(base.type==='MeshBasicMaterial')shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.0+.20*uCharge*(.6+.4*sin(vCore*18.0-uCharge*7.0));');};materials.set(key,m);}o.material=m;});
  // Meshy models carry their own moving parts (js/meshy3d.js); they are driven from the same cosmetic state
  const meshy=typeof Meshy3D!=='undefined'?Meshy3D.motion(root):null;
  let disposed=false;const motion={state:s,uniforms,meshy,step(dt,v,quiet){advance(s,dt,v,quiet);uniforms.uDrive.value.set(s.left,s.right);uniforms.uCharge.value=quiet?0:s.charge;if(meshy)meshy.step(s,Math.max(0,Math.min(.05,dt)),quiet===undefined?reduced():quiet);},dispose(){if(disposed)return;disposed=true;for(const m of materials.values())m.dispose();materials.clear();if(meshy)meshy.dispose();},materials};root.userData.graphicsMotion=motion;return motion;
 }
 return {PROFILES,state,shot,advance,attach,reduced,delta};
})();
const GraphicsQuality=(()=>{
 const state=()=>({since:0,sum:0,n:0,bad:0,q:'high'});
 function reset(s,now){s.since=now;s.sum=0;s.n=0;s.bad=0;}
 function sample(s,dt,now,{manual=false,hidden=false,loading=false,resolving=false}={}){
  if(manual||hidden||loading||resolving||dt<=0||dt>.5){reset(s,now);return null;}if(now-s.since<6)return null;   // resolving: the resolution governor still has room to step down, so quality waits
  s.sum+=dt;s.n++;if(s.sum<3||s.n<45)return null;const fps=s.n/s.sum;s.sum=0;s.n=0;s.bad=fps<(s.q==='high'?35:21)?s.bad+1:0;
  if(s.bad<2)return null;s.q=s.q==='high'?'low':'2d';reset(s,now);return s.q;
 }
 // Auto starts HIGH unless the device says it is small (owner, Nov 11 2026: the website is the full-quality baseline and
 // Telegram matches it as closely as the device allows; effects scale down only where a device truly can't hold frame rate).
 // iPhones report no memory: they start HIGH and the frame-time watch (sample) and GraphicsResolution step down if needed.
 const initial=({mode='auto',coarse=false,cores=8,memory=null}={})=>mode==='high'?'high':mode==='low'?'low':(memory!==null&&memory<=3)||cores<=2||(coarse&&memory!==null&&memory<4&&cores<=4)?'low':'high';
 return {state,reset,sample,initial};
})();
// Render resolution (Session 5E-2a). One ceiling and one governor for every renderer (battle, Garage, Conquest):
//  - LOW graphics: 1x, fixed.  HIGH on a phone/tablet: up to 2.5x.  HIGH on a desktop: the full device pixel ratio.
//  - a CPU rasterizer (SwiftShader / llvmpipe: GPU-blocklisted browsers, VMs, CI) never goes above 1x.
//  - auto mode: the governor drops the ratio one step only while frame time is really over budget and climbs back when it
//    recovers; a level that failed is retried later each time it fails again (no flicker between two levels).
const GraphicsResolution=(()=>{
 const PHONE_MAX=2.5,DESK_MAX=3,STEP=.25,BUDGET=1000/48,GOOD=1000/56,WINDOW=.5;
 let soft=null;
 const dpr=()=>typeof devicePixelRatio==='number'&&devicePixelRatio>0?devicePixelRatio:1;
 const coarse=()=>typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
 // one throwaway context, once per page: is WebGL running on a CPU rasterizer?
 function software(){
  if(soft!==null)return soft;soft=false;
  try{if(typeof document==='undefined')return soft;const c=document.createElement('canvas'),gl=c.getContext('webgl2')||c.getContext('webgl');if(!gl)return soft;
   const d=gl.getExtension('WEBGL_debug_renderer_info'),r=d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);soft=/swiftshader|llvmpipe|softpipe|software/i.test(String(r||''));
   const lose=gl.getExtension('WEBGL_lose_context');lose&&lose.loseContext();}catch(e){soft=false;}
  return soft;
 }
 function cap(q,o={}){const d=o.dpr||dpr(),sw=o.software!==undefined?o.software:software();if(q==='low')return Math.min(1,d);if(sw)return Math.min(1,d);return Math.min(d,(o.coarse!==undefined?o.coarse:coarse())?PHONE_MAX:DESK_MAX);}
 const antialias=q=>q!=='low'&&!software();
 // governor: feed it every frame's wall time (ms); it returns the new ratio when it changes, else null
 function governor(max,{min=1,start=max,auto=true}={}){
  const g={max,min:Math.min(min,max),ratio:Math.max(Math.min(start,max),Math.min(min,max)),auto,t:0,frames:[],slow:0,good:0,block:new Map(),fails:new Map(),
   setMax(m){this.max=m;this.min=Math.min(this.min,m);if(this.ratio>m){this.ratio=m;return m;}return null;},
   reset(){this.t=0;this.frames.length=0;this.slow=0;this.good=0;this.probe=null;},
   sample(ms,now){
    if(!this.auto||!(ms>0))return null;
    if(ms>250){   // a hidden tab or a single hitch is not a frame rate, but three huge frames in a row on a visible page are an
     // overloaded GPU: drop straight to the floor (before this, a phone under 4 fps never stepped down and Conquest looked frozen)
     this.reset();if(typeof document!=='undefined'&&document.hidden){this.huge=0;return null;}
     this.huge=(this.huge||0)+1;if(this.huge>=3&&this.ratio>this.min){this.huge=0;this.ratio=this.min;this.capped=now+60;return this.ratio;}return null;}
    this.huge=0;
    this.frames.push(ms);this.t+=ms/1000;if(this.t<WINDOW||this.frames.length<12)return null;
    const a=this.frames.slice().sort((x,y)=>x-y),med=a[a.length>>1];this.frames.length=0;this.t=0;
    this.slow=med>BUDGET?this.slow+1:0;this.good=med<=GOOD?this.good+1:0;
    // the window after a step down: if frames did not get at least 10% faster, resolution was not the limit (a 30 fps cap: iOS
    // Low Power Mode, battery savers, some webviews). Undo the step and leave resolution alone for a minute.
    if(this.probe){const pr=this.probe;this.probe=null;if(med>pr.med*.9){this.ratio=pr.from;this.capped=now+60;this.slow=0;this.good=0;return this.ratio;}}
    if(this.capped&&now<this.capped){this.slow=0;}
    if(this.slow>=2&&this.ratio>this.min){   // over budget for a second: one step down, and this level waits longer before its next try
     const lv=+this.ratio.toFixed(2),f=(this.fails.get(lv)||0)+1;this.fails.set(lv,f);this.block.set(lv,now+Math.min(120,6*2**(f-1)));
     this.probe={from:this.ratio,med};this.ratio=Math.max(this.min,+(this.ratio-STEP).toFixed(2));this.slow=0;this.good=0;return this.ratio;}
    if(this.good>=4&&this.ratio<this.max){   // two seconds with headroom: try one step up unless that level failed recently
     const up=Math.min(this.max,+(this.ratio+STEP).toFixed(2));if((this.block.get(up)||0)>now)return null;this.ratio=up;this.good=0;return up;}
    return null;
   }};
  return g;
 }
 return {cap,antialias,software,governor,coarse,PHONE_MAX,CONQUEST_PHONE_MAX:1.5,BUDGET,GOOD,get dpr(){return dpr();}};
})();
