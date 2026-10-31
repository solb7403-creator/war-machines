'use strict';
// Static release gate. LIVE since 2026-10-31 nonpayment gear release. Rollback: flip the boolean below to false, bump version.json + index.html ?v, publish once.
const GraphicsRelease=Object.freeze({version:'graphics-r1',enabled:true});
// Cosmetic state only: never reads/writes saves, simulation, inventory or authoritative RNG.
const GraphicsMotion=(()=>{
 const PROFILES=Object.freeze({pulse:{kick:.075,damp:19,flash:.065},twin:{kick:.035,damp:26,flash:.040},siege:{kick:.14,damp:12,flash:.095},moon:{kick:.060,damp:17,flash:.085}});
 const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const state=()=>({left:0,right:0,kick:0,charge:0,hit:0,heading:null,aim:0,phase:0,profile:'pulse'});
 const delta=a=>Math.atan2(Math.sin(a),Math.cos(a));
 function shot(s,arch){s.profile=PROFILES[arch]?arch:'pulse';s.kick=Math.min(PROFILES[s.profile].kick*1.5,s.kick+PROFILES[s.profile].kick);s.charge=1;}
 function advance(s,dt,v={},quiet=reduced()){
  dt=Math.max(0,Math.min(.05,dt));const hd=v.heading||0,dh=s.heading===null?0:delta(hd-s.heading),dist=(v.dx||0)*Math.cos(hd)+(v.dz||0)*Math.sin(hd);s.heading=hd;
  if(!quiet){s.left+=dist+dh*.78;s.right+=dist-dh*.78;s.phase+=dt;s.kick*=Math.exp(-PROFILES[s.profile].damp*dt);s.hit*=Math.exp(-18*dt);}else{s.kick=0;s.hit=0;}
  s.charge*=Math.exp(-7*dt);s.aim+=delta((v.aim||0)-s.aim)*(1-Math.exp(-38*dt));return s;
 }
 // Wheel and tread displacement on the existing baked surfaces; matching normal/tangent rotation.
 const GLSL=`attribute vec4 drive;uniform vec2 uDrive;uniform vec4 uTrack;uniform float uCharge;varying float vCore;
 void trackFrame(float s,float a,float r,out vec2 p,out float angle){float L=4.0*a+6.2831853*r;s=mod(mod(s,L)+L,L);if(s<2.0*a){p=vec2(s-a,r);angle=0.0;}else if(s<2.0*a+3.14159265*r){float t=(s-2.0*a)/r;p=vec2(a+sin(t)*r,cos(t)*r);angle=-t;}else if(s<4.0*a+3.14159265*r){p=vec2(a-(s-2.0*a-3.14159265*r),-r);angle=3.14159265;}else{float t=(s-4.0*a-3.14159265*r)/r;p=vec2(-a-sin(t)*r,-cos(t)*r);angle=3.14159265-t;}}
 void drivePose(out vec2 old,out vec2 dest,out float ang){old=drive.xy;dest=old;ang=0.0;if(drive.z<0.5)return;float travel=drive.w<0.0?uDrive.x:uDrive.y;if(drive.z<1.5){ang=-travel/max(.06,drive.z-1.0);return;}float center=uTrack.w>0.0?sign(old.x)*uTrack.w:0.0;float a=uTrack.x,r=uTrack.y,s=(drive.z-2.0)*(4.0*a+6.2831853*r);float initial=s<2.0*a?0.0:s<2.0*a+3.14159265*r?-(s-2.0*a)/r:s<4.0*a+3.14159265*r?3.14159265:3.14159265-(s-4.0*a-3.14159265*r)/r;trackFrame(s+travel,a,r,dest,ang);dest+=vec2(center,uTrack.z);ang-=initial;}
 vec2 driveRotate(vec2 v,float a){return mat2(cos(a),sin(a),-sin(a),cos(a))*v;}
 `;
 function attach(root,track){
  const s=state(),uniforms={uDrive:{value:new THREE.Vector2()},uTrack:{value:new THREE.Vector4(...(track||[1,.22,.25,0]))},uCharge:{value:0}},materials=new Map();
  root.traverse(o=>{if(!o.isMesh||!o.material?.userData.hfShared)return;const base=o.material,driven=!!o.geometry.attributes.drive,key=base.uuid+'|'+driven;let m=materials.get(key);if(!m){m=base.clone();m.userData={graphicsOwned:true};m.defaultAttributeValues={...m.defaultAttributeValues,drive:[0,0,0,0]};m.customProgramCacheKey=()=> 'lunar-motion-v1|'+driven;m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=GLSL+shader.vertexShader;if(driven){shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvec2 oldDrive,newDrive;float driveAngle;drivePose(oldDrive,newDrive,driveAngle);objectNormal.xy=driveRotate(objectNormal.xy,driveAngle);\n#ifdef USE_TANGENT\nobjectTangent.xy=driveRotate(objectTangent.xy,driveAngle);\n#endif').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.xy=driveRotate(transformed.xy-oldDrive,driveAngle)+newDrive;');}shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCore=position.x;');shader.fragmentShader='uniform float uCharge;varying float vCore;\n'+shader.fragmentShader; if(base.type==='MeshBasicMaterial')shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.0+.20*uCharge*(.6+.4*sin(vCore*18.0-uCharge*7.0));');};materials.set(key,m);}o.material=m;});
  let disposed=false;const motion={state:s,uniforms,step(dt,v,quiet){advance(s,dt,v,quiet);uniforms.uDrive.value.set(s.left,s.right);uniforms.uCharge.value=quiet?0:s.charge;},dispose(){if(disposed)return;disposed=true;for(const m of materials.values())m.dispose();materials.clear();},materials};root.userData.graphicsMotion=motion;return motion;
 }
 return {PROFILES,state,shot,advance,attach,reduced,delta};
})();
const GraphicsQuality=(()=>{
 const state=()=>({since:0,sum:0,n:0,bad:0,q:'high'});
 function reset(s,now){s.since=now;s.sum=0;s.n=0;s.bad=0;}
 function sample(s,dt,now,{manual=false,hidden=false,loading=false}={}){
  if(manual||hidden||loading||dt<=0||dt>.5){reset(s,now);return null;}if(now-s.since<6)return null;
  s.sum+=dt;s.n++;if(s.sum<3||s.n<45)return null;const fps=s.n/s.sum;s.sum=0;s.n=0;s.bad=fps<(s.q==='high'?35:21)?s.bad+1:0;
  if(s.bad<2)return null;s.q=s.q==='high'?'low':'2d';reset(s,now);return s.q;
 }
 const initial=({mode='auto',coarse=false,cores=8,memory=null}={})=>mode==='high'?'high':mode==='low'?'low':coarse&&(memory===null||memory<6||cores<8)||cores<=4&&(memory===null||memory<4)?'low':'high';
 return {state,reset,sample,initial};
})();
