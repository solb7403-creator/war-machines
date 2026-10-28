'use strict';
// =====================================================================
// render3d: the 3D view. A Three.js scene draws the battlefield under the 2D canvas, which keeps the HUD, health bars,
// labels, aiming and buttons. It only reads the game state (units, bullets, effects): the rules and the sim don't change.
// The camera is a tilted orthographic view, so the ground maps to the screen with one fixed squash (GK) and every
// 2D overlay lines up exactly. Menu pictures (gear, crates, tanks, maps) are 3D renders, cached.
// No WebGL, a failed load, or the 2D setting: everything falls back to the 2D renderer in render.js.
// =====================================================================
const R3={ready:false,failed:false,loading:false,q:'high',fps:60,ft:[],calls:0,drop:0,auto:''};
const TILT=0.6,GKC=Math.cos(TILT),GSN=Math.sin(TILT),TANK_VIS=1.12;   // tanks drawn a touch bigger than their hitbox so they read on a phone
const gfxMode=()=>(typeof save!=='undefined'&&save&&save.gfx)||'auto';   // auto | high | low | 2d
const want3D=()=>gfxMode()!=='2d'&&!R3.off2d;
const use3D=()=>R3.ready&&!R3.failed&&want3D();
function webglOK(){try{const c=document.createElement('canvas');return !!(window.WebGLRenderingContext&&(c.getContext('webgl2')||c.getContext('webgl')));}catch(e){return false;}}
function load3D(){
 if(R3.ready||R3.loading||R3.failed||!want3D())return;
 if(!webglOK()){R3.failed=true;return;}
 R3.loading=true;
 const s=document.createElement('script');s.src='js/vendor/three.lunar.min.js?v='+(window.BUILD||'dev');s.async=true;
 s.onload=()=>{R3.loading=false;try{init3D();R3.ready=true;}catch(e){R3.failed=true;try{console.warn('3D unavailable',e);}catch(_){}}apply3D();};
 s.onerror=()=>{R3.loading=false;R3.failed=true;apply3D();};
 document.head.appendChild(s);
}
// switch the 2D layer between "everything" and "overlay on the 3D scene"
function apply3D(){
 const on=use3D();
 GK=on?GKC:1;
 document.body.classList.toggle('g3d',on);
 if(on)setPR();
 fit();
 artCache.clear();
 if(typeof uiDirty==='function')uiDirty();
}
function setGfx(m){
 save.gfx=m;R3.off2d=false;R3.auto='';if(typeof store==='function')store();
 if(m==='2d'){apply3D();return;}
 if(R3.ready){R3.q=m==='low'?'low':'high';apply3D();}else{R3.failed=false;load3D();}
}
const lowEnd=()=>((navigator.hardwareConcurrency||8)<=4&&(navigator.deviceMemory||8)<=3);

// ---------- renderer, camera, lights, shared materials ----------
let RR=null,RS=null,RC=null,MT=null,PSA=null,PSN=null,STARS=null,CV3=null;
function setPR(){if(!RR)return;const d=Math.min(window.devicePixelRatio||1,2);RR.setPixelRatio(R3.q==='low'?Math.min(1,d):d);RR.setSize(vw||innerWidth,vh||innerHeight,false);}
function init3D(){
 CV3=document.createElement('canvas');CV3.id='c3';document.body.insertBefore(CV3,document.getElementById('c'));
 R3.q=gfxMode()==='low'||(gfxMode()==='auto'&&lowEnd())?'low':'high';
 RR=new THREE.WebGLRenderer({canvas:CV3,antialias:R3.q==='high',alpha:false,powerPreference:'high-performance',stencil:false});
 RR.setClearColor(0x0a0e17,1);RR.outputColorSpace=THREE.SRGBColorSpace;
 CV3.addEventListener('webglcontextlost',e=>{e.preventDefault();R3.failed=true;apply3D();});
 RS=new THREE.Scene();
 RC=new THREE.OrthographicCamera(-10,10,10,-10,1,400);
 RC.up.set(0,GSN,-GKC);RC.position.set(0,GKC*150,GSN*150);RC.lookAt(0,0,0);
 addLights(RS);
 MT=mkMats();
 PSA=mkPS(true);PSN=mkPS(false);RS.add(PSA.pts,PSN.pts);
 STARS=mkStars();RS.add(STARS);
 setPR();
}
function addLights(sc){
 sc.add(new THREE.HemisphereLight(0xd2ddff,0x3a3344,1.7));
 const d=new THREE.DirectionalLight(0xfff1dc,2.6);d.position.set(-6,14,-5);sc.add(d);
 const f=new THREE.DirectionalLight(0x7fa6ff,0.55);f.position.set(5,4,9);sc.add(f);
}
function mkMats(){
 const lit=new THREE.MeshLambertMaterial({vertexColors:true}),shine=new THREE.MeshPhongMaterial({vertexColors:true,shininess:70,specular:0x8a8a8a});
 const glow=new THREE.MeshBasicMaterial({vertexColors:true});
 return {lit,shine,glow,pulse:new THREE.MeshBasicMaterial({vertexColors:true}),
  deck:new THREE.MeshLambertMaterial({vertexColors:true,transparent:true,opacity:1}),tun:new THREE.MeshLambertMaterial({vertexColors:true,transparent:true,opacity:0.6,depthWrite:false}),
  gglow:new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0.55,depthWrite:false})};
}
// ---------- particles: one additive (fire, sparks, glows) and one normal (smoke) system, one draw call each ----------
const PS_VS='attribute float size;attribute vec4 rgba;varying vec4 vC;uniform float uS;uniform float uMax;uniform float uP;'+
 'void main(){vC=rgba;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=min(uMax,size*uS/(uP>0.5?-mv.z:1.0));}';
const PS_FA='varying vec4 vC;void main(){vec2 d=gl_PointCoord-0.5;float r=length(d)*2.0;if(r>1.0)discard;float a=vC.a*pow(1.0-r,1.7);float k=smoothstep(0.45,0.0,r);gl_FragColor=vec4(mix(vC.rgb,vec3(1.0),k*0.65),a);}';
const PS_FN='varying vec4 vC;void main(){vec2 d=gl_PointCoord-0.5;float r=length(d)*2.0;if(r>1.0)discard;gl_FragColor=vec4(vC.rgb,vC.a*pow(1.0-r,1.2));}';
function mkPS(add,max){
 max=max||(R3.q==='low'?700:1600);
 const g=new THREE.BufferGeometry(),P=new Float32Array(max*3),C=new Float32Array(max*4),S=new Float32Array(max);
 g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('rgba',new THREE.BufferAttribute(C,4));g.setAttribute('size',new THREE.BufferAttribute(S,1));
 for(const k of ['position','rgba','size'])g.attributes[k].setUsage(35048);   // dynamic
 const m=new THREE.ShaderMaterial({vertexShader:PS_VS,fragmentShader:add?PS_FA:PS_FN,transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending,uniforms:{uS:{value:20},uMax:{value:256},uP:{value:0}}});
 const pts=new THREE.Points(g,m);pts.frustumCulled=false;pts.renderOrder=add?20:19;
 return {pts,g,P,C,S,max,n:0,live:[]};
}
const RGBC=new Map();const rgb=h=>{let v=RGBC.get(h);if(!v){const n=parseInt(String(h).slice(1),16);v=[(n>>16)/255,((n>>8)&255)/255,(n&255)/255];RGBC.set(h,v);}return v;};
// a particle that lives a while: p={x,y,z,vx,vy,vz,life,s0,s1,c,a,drag,g}
function emit(ps,p){if(ps.live.length>=ps.max*0.8)return;p.t=0;p.life=p.life||0.4;p.drag=p.drag||0;p.g=p.g||0;p.vx=p.vx||0;p.vy=p.vy||0;p.vz=p.vz||0;p.a=p.a===undefined?1:p.a;p.s1=p.s1===undefined?p.s0:p.s1;ps.live.push(p);}
function once(ps,x,y,z,s,c,a){if(ps.n>=ps.max)return;const i=ps.n++,cc=rgb(c);ps.P[i*3]=x;ps.P[i*3+1]=y;ps.P[i*3+2]=z;ps.C[i*4]=cc[0];ps.C[i*4+1]=cc[1];ps.C[i*4+2]=cc[2];ps.C[i*4+3]=a;ps.S[i]=s;}
function psStep(ps,dt){
 const L=ps.live;let j=0;
 for(let i=0;i<L.length;i++){const p=L[i];p.t+=dt;if(p.t>=p.life)continue;
  const k=p.t/p.life,dr=Math.max(0,1-p.drag*dt);p.vx*=dr;p.vz*=dr;p.vy=p.vy*dr-p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<0.02&&p.g){p.y=0.02;p.vy*=-0.3;p.vx*=0.6;p.vz*=0.6;}
  once(ps,p.x,p.y,p.z,p.s0+(p.s1-p.s0)*k,p.c,p.a*(p.fade===0?1:1-k*k));L[j++]=p;}
 L.length=j;
}
function psFlush(ps,scale){
 const g=ps.g;g.setDrawRange(0,ps.n);
 for(const k of ['position','rgba','size']){const a=g.attributes[k];a.needsUpdate=true;}
 ps.pts.material.uniforms.uS.value=scale;ps.n=0;
}
let PMAX=256;
function mkStars(){
 const n=140,g=new THREE.BufferGeometry(),P=new Float32Array(n*3),C=new Float32Array(n*4),S=new Float32Array(n);
 for(let i=0;i<n;i++){P[i*3]=-15+Math.random()*50;P[i*3+1]=-40;P[i*3+2]=-60+Math.random()*110;const b=0.5+Math.random()*0.5;C[i*4]=b;C[i*4+1]=b;C[i*4+2]=1;C[i*4+3]=0.25+Math.random()*0.6;S[i]=0.06+Math.random()*0.12;}
 g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('rgba',new THREE.BufferAttribute(C,4));g.setAttribute('size',new THREE.BufferAttribute(S,1));
 const m=new THREE.ShaderMaterial({vertexShader:PS_VS,fragmentShader:PS_FA,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uS:{value:20},uMax:{value:16},uP:{value:0}}});
 const p=new THREE.Points(g,m);p.frustumCulled=false;p.renderOrder=-1;return p;
}
// soft round texture for decals and beams
let RADT=null;
function radial(){if(RADT)return RADT;const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
 g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.5,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);RADT=new THREE.CanvasTexture(c);return RADT;}
let VGT=null;
function vgrad(){if(VGT)return VGT;const c=document.createElement('canvas');c.width=4;c.height=64;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,64);
 g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(0.75,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,1)');x.fillStyle=g;x.fillRect(0,0,4,64);VGT=new THREE.CanvasTexture(c);return VGT;}
const addMat=(c,o)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o===undefined?1:o,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});

// ---------- model cache ----------
const FITCACHE=new Map();
function fittingB(f,team,part){const key=part+'|'+team+'|'+(part==='body'?f.hull+','+f.mobility:f.mount);if(!FITCACHE.has(key)){const r=M3.fittingKit(f,team,part);FITCACHE.set(key,M3.bake(r.k));}return FITCACHE.get(key);}
const KC=new Map();
function bakedOf(key,fn){let v=KC.get(key);if(v)return v;const r=fn();v={b:M3.bake(r.k),anims:r.anims.map(a=>Object.assign({},a,{b:M3.bake(a.k),k:null})),meta:r.meta};KC.set(key,v);if(KC.size>160){const f=KC.keys().next().value;KC.delete(f);}return v;}
function chassisB(s){return bakedOf(['c',s.cls,s.ct,s.paint,s.lunar?1:0,s.team,s.gems].join('|'),()=>M3.chassisKit(s.cls,s.ct,PAINTS[s.paint],s.team,s.gems?s.gems.split(','):[],s.lunar));}
function weaponB(s){return bakedOf(['w',s.arch,s.wt,s.paint,s.lunar?1:0,s.team,s.cls].join('|'),()=>M3.weaponKit(s.arch,s.wt,PAINTS[s.paint],s.team,s.lunar,s.cls));}
let BOSSB=null;
function bossB(){if(!BOSSB){const k=M3.bossKit();BOSSB={hull:bakedOf('bossH',()=>k.hull),gun:bakedOf('bossG',()=>k.gun)};}return BOSSB;}
// Hyperspace Vault looks (rules.js VAULT_REW): a gold tooth laid on the front deck (it glows from level 10), and where the
// gold trail leaves the rear. The deck height comes from a ray cast down onto the hull, so it sits right on every chassis
let TOOTHG=null;const ZT=0.26;   // off the center line, clear of the barrel
function toothGeo(){
 if(TOOTHG)return TOOTHG;
 const sh=new THREE.Shape(),q=(a,b,c,d)=>sh.quadraticCurveTo(a,-b,c,-d);sh.moveTo(-0.46,0.3);
 q(-0.5,-0.64,-0.22,-0.6);q(0,-0.5,0.22,-0.6);q(0.5,-0.64,0.46,-0.3);q(0.42,0.05,0.3,0.55);q(0.2,0.7,0.12,0.5);q(0.06,0.18,0,0.16);q(-0.06,0.18,-0.12,0.5);q(-0.2,0.7,-0.3,0.55);q(-0.42,0.05,-0.46,-0.3);
 TOOTHG=new THREE.ExtrudeGeometry(sh,{depth:0.16,bevelEnabled:true,bevelThickness:0.05,bevelSize:0.04,bevelSegments:2,curveSegments:5});return TOOTHG;
}
// the hull's top at (x, z): the highest triangle over that point (the hull is merged, non-indexed triangles)
function deckY(geos,x,z){let best=-1;for(const g of geos){if(!g)continue;const a=g.attributes.position.array;
 for(let i=0;i<a.length;i+=9){const x0=a[i],z0=a[i+2],x1=a[i+3],z1=a[i+5],x2=a[i+6],z2=a[i+8],d=(z1-z2)*(x0-x2)+(x2-x1)*(z0-z2);if(Math.abs(d)<1e-9)continue;
  const l0=((z1-z2)*(x-x2)+(x2-x1)*(z-z2))/d,l1=((z2-z0)*(x-x2)+(x0-x2)*(z-z2))/d,l2=1-l0-l1;if(l0<-1e-6||l1<-1e-6||l2<-1e-6)continue;
  const y=l0*a[i+1]+l1*a[i+4]+l2*a[i+7];if(y>best)best=y;}}return best;}
function vaultParts(T,H,spec,mats){
 const geos=[H.b.lit,H.b.shine];let mnx=1e9,mxx=-1e9;
 for(const g of geos){if(!g)continue;const a=g.attributes.position.array;for(let i=0;i<a.length;i+=3){if(a[i]<mnx)mnx=a[i];if(a[i]>mxx)mxx=a[i];}}
 if(mxx<mnx)return;
 let x=mxx-0.22,y=-1;
 for(let i=0;i<6&&y<0.15;i++){y=deckY(geos,x,ZT);if(y<0.15)x-=0.14;}
 if(y<0.15)return;
 const k=M3.kit();M3.put(k,toothGeo().clone(),'#ffcf4a',[x-0.16,y+0.012,ZT],[-Math.PI/2,0,-Math.PI/2],[0.42,0.42,0.42],spec.vt>=2?'glow':'shine');
 T.body.add(M3.meshOf(M3.bake(k),null,mats));
 T.tooth=[x-0.16,y+0.08,ZT];T.rear=[[mnx+0.05,0.35,-0.3],[mnx+0.05,0.35,0.3]];
}
// the parts of one tank spec, as a group: {g, hull, body, tur, anims, meta, wmeta}
function buildTank(spec,mats){
 const g=new THREE.Group(),hull=new THREE.Group(),body=new THREE.Group(),tur=new THREE.Group();g.add(hull);hull.add(body);
 let H,Wk;if(spec.boss){const b=bossB();H=b.hull;Wk=b.gun;}else{H=chassisB(spec);Wk=weaponB(spec);}
 const anims=[];
 body.add(M3.meshOf(H.b,null,mats));
 for(const a of H.anims){const m=M3.meshOf(a.b,null,mats);m.position.set(a.p[0],a.p[1],a.p[2]);body.add(m);anims.push({o:m,axis:a.axis,spd:a.spd,type:a.type});}
 tur.position.y=H.meta.ty;body.add(tur);
 const tg=new THREE.Group();tur.add(tg);tg.add(M3.meshOf(Wk.b,null,mats));
 for(const a of Wk.anims){const m=M3.meshOf(a.b,null,mats);m.position.set(a.p[0],a.p[1],a.p[2]);tg.add(m);anims.push({o:m,axis:a.axis,spd:a.spd,type:a.type});}
 if(spec.fits&&!spec.boss){body.add(M3.meshOf(fittingB(spec.fits,spec.team,'body'),null,mats));tg.add(M3.meshOf(fittingB(spec.fits,spec.team,'mount'),null,mats));}
 const T={g,hull,body,tur,tg,anims,meta:H.meta,wmeta:Wk.meta,tooth:null,rear:null,spec};
 if(spec.vt&&!spec.boss)try{vaultParts(T,H,spec,mats);}catch(e){}
 return T;
}
function stepAnims(anims,dt,t){for(const a of anims){if(a.type==='pulse')a.o.scale.setScalar(1+0.16*Math.sin(t*a.spd));else if(a.axis)a.o.rotation[a.axis]+=a.spd*dt;}}

// ---------- battle state ----------
let B3={map:null,mapId:null,mapKey:null,units:new Map(),uref:null,crates:new Map(),pool:{},seen:new WeakSet(),shellL0:new WeakMap(),pads:null,wrecks:[],t:0,last:0,dyn:null};
function unitSpec(u){
 let ct=Math.max(0,Math.min(2,u.aura|0));
 if(u===me&&typeof myLoadout==='function'){try{ct=Math.max(0,myLoadout().c.t|0);}catch(e){}}
 const lunar=u.skin==='lunar',team=u===me&&lunar?'#e8f4ff':tcol(u.team);
 return {fits:u.fits,cls:CH[u.cls]?u.cls:'vanguard',ct,arch:WEAPONS[u.wtype]?u.wtype:'pulse',wt:Math.max(0,Math.min(2,u.wtier|0)),paint:PAINTS[u.paint]?u.paint:'stock',lunar,team,gems:(u.gems||[]).filter(Boolean).slice(0,3).join(','),boss:!!u.boss,ghost:!!u.gh,vl:u.vl|0,vt:vtOf(u.vl)};
}
const vtOf=vl=>(vl|0)>=10?2:(vl|0)>=1?1:0;   // the tooth: none, gold, glowing
const specKey=s=>[s.cls,s.ct,s.arch,s.wt,s.paint,s.lunar?1:0,s.team,s.gems,s.boss?1:0,s.ghost?1:0,s.vt|0,JSON.stringify(s.fits||{})].join('|');
function unitMats(ghost){
 const lit=MT.lit.clone(),shine=MT.shine.clone();
 if(ghost){for(const m of [lit,shine]){m.transparent=true;m.opacity=0.55;m.emissive=new THREE.Color(0x3a5a9a);m.depthWrite=false;}return {lit,shine,glow:MT.gglow};}
 return {lit,shine,glow:MT.glow};
}
let DEC=null;
function decals(){
 if(DEC)return DEC;
 const flat=g=>{g.rotateX(-Math.PI/2);return g;};
 const arcs=[0,1,2].map(i=>flat(new THREE.RingGeometry(1.92,2.1,16,1,i*Math.PI*2/3,Math.PI*0.45)));
 DEC={varc:arcs,blob:flat(new THREE.CircleGeometry(1.35,20)),glowD:flat(new THREE.CircleGeometry(1.4,20)),aura:flat(new THREE.RingGeometry(1.42,1.6,36)),me:flat(new THREE.RingGeometry(1.62,1.8,40)),
  shield:new THREE.SphereGeometry(4,20,14),blobM:new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.55,depthWrite:false,alphaMap:radial()})};
 return DEC;
}
const SH_VS='varying float vF;void main(){vec3 n=normalize(normalMatrix*normal);vF=1.0-abs(n.z);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const SH_FS='uniform float uA;uniform float uT;varying float vF;void main(){float r=pow(vF,2.4);float fl=0.75+0.25*sin(uT*9.0+vF*14.0);gl_FragColor=vec4(vec3(0.35,0.65,1.0)*r*fl+vec3(0.8,0.92,1.0)*pow(vF,7.0),(r*0.85+0.05)*uA);}';
function unitObj(u){
 const spec=unitSpec(u),key=specKey(spec);let o=B3.units.get(u);
 if(o&&o.key===key)return o;
 if(o)dropUnit(u,o);
 const mats=unitMats(spec.ghost),T=buildTank(spec,mats),D=decals();
 const blob=new THREE.Mesh(D.blob,D.blobM);blob.position.y=0.015;blob.renderOrder=1;T.g.add(blob);
 const ug=new THREE.Mesh(D.glowD,new THREE.MeshBasicMaterial({color:spec.team,transparent:true,opacity:0.32,depthWrite:false,blending:THREE.AdditiveBlending,alphaMap:radial()}));ug.position.y=0.02;ug.renderOrder=2;T.g.add(ug);
 let aura=null;const av=spec.boss?3:spec.lunar||spec.arch==='moon'?3:Math.max(spec.ct,spec.wt);
 if(av>0){aura=new THREE.Mesh(D.aura,addMat(av>=3?'#e8f4ff':RCOL[av],0.5));aura.position.y=0.03;aura.renderOrder=3;T.g.add(aura);}
 let ring=null;if(u===me){ring=new THREE.Mesh(D.me,addMat('#ffd24a',0.9));ring.position.y=0.035;ring.renderOrder=4;T.g.add(ring);}
 let varc=null;if(spec.vl>=10&&!spec.boss){varc=new THREE.Group();const vm=addMat('#ffcf4a',0.65);for(const a of D.varc){const m=new THREE.Mesh(a,vm);m.renderOrder=4;varc.add(m);}varc.position.y=0.04;varc.mat=vm;T.g.add(varc);}   // Vault level 10: a gold aura ring
 o=Object.assign(T,{key,spec,mats,aura,av,ring,varc,ug,shield:null,recoil:0,tipI:0,px:u.x,py:u.y,fl:0});
 RS.add(o.g);B3.units.set(u,o);return o;
}
function dropUnit(u,o){RS.remove(o.g);o.mats.lit.dispose();o.mats.shine.dispose();if(o.varc)o.varc.mat.dispose();if(o.shield)o.shield.material.dispose();B3.units.delete(u);}
function heightAt(u){
 if(!BR||(u.elev||0)!==1)return 0;
 if(inDeck(u.x,u.y))return M3.DECK_H;
 const rp=rampAt(u.x,u.y);if(rp){const f=Math.max(0,Math.min(1,(u.y-rp[1])/rp[3]));return M3.DECK_H*(rp[4]<0?f:1-f);}
 return M3.DECK_H;
}
let _v=null;
function wpos(obj,p){if(!_v)_v=new THREE.Vector3();_v.set(p[0],p[1],p[2]);obj.localToWorld(_v);return _v;}

// ---------- map and per-match objects ----------
function ensureMap(){
 const key=curMap+'|'+R3.q;
 if(B3.mapKey===key)return;
 if(B3.map){RS.remove(B3.map.group);B3.map.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material.map)o.material.map.dispose();});}
 B3.map=M3.buildMap(curMap,MT,R3.q);B3.mapKey=key;RS.add(B3.map.group);
}
function poolGet(name,mk){const P=B3.pool[name]||(B3.pool[name]={items:[],n:0});if(P.n>=P.items.length){const o=mk();P.items.push(o);RS.add(o);}const o=P.items[P.n++];o.visible=true;return o;}
function poolsBegin(){for(const k in B3.pool)B3.pool[k].n=0;}
function poolsEnd(){for(const k in B3.pool){const P=B3.pool[k];for(let i=P.n;i<P.items.length;i++)P.items[i].visible=false;}}
let GEO=null;
function geos(){
 if(GEO)return GEO;const S=M3.shapes,flat=g=>{g.rotateX(-Math.PI/2);return g;};
 const cb=M3.crateGeo(),star=M3.bake((()=>{const k=M3.kit();M3.put(k,M3.starGeo(0.5,0.16),'#ffcf4a',[0,0,0],null,null,'shine');return k;})());
 const bx=document.createElement('canvas');bx.width=bx.height=64;const x=bx.getContext('2d');x.fillStyle='#ffcf4a';x.fillRect(0,0,64,64);x.strokeStyle='#7a5a00';x.lineWidth=6;x.strokeRect(3,3,58,58);x.fillStyle='#4a3500';x.font='700 44px "Chakra Petch",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('?',32,35);
 const bt=new THREE.CanvasTexture(bx);bt.colorSpace=THREE.SRGBColorSpace;
 GEO={unit:new THREE.BoxGeometry(1,1,1),sphere:new THREE.SphereGeometry(1,14,10),ico:new THREE.IcosahedronGeometry(1,0),oct:new THREE.OctahedronGeometry(1),
  disc:flat(new THREE.CircleGeometry(1,40)),ring:flat(new THREE.RingGeometry(0.92,1,64)),ringT:flat(new THREE.RingGeometry(0.86,1,64)),moon:(()=>{const sh=new THREE.Shape();sh.absarc(0,0,0.9,Math.PI*0.25,Math.PI*1.75,false);sh.absarc(0.38,0,0.72,Math.PI*1.68,Math.PI*0.32,true);const g=new THREE.ExtrudeGeometry(sh,{depth:0.02,bevelEnabled:false,curveSegments:10});g.rotateX(-Math.PI/2);return g;})(),col:new THREE.CylinderGeometry(1,1,1,28,1,true),crate:cb,star,
  boxM:new THREE.MeshLambertMaterial({map:bt,emissive:0x3a2800}),cryM:new THREE.MeshPhongMaterial({color:0xb98cff,emissive:0x4a2a8a,shininess:90,specular:0xffffff,flatShading:true}),
  rock:new THREE.MeshLambertMaterial({color:0x5a4a40,flatShading:true})};
 return GEO;
}
function matchObjs(){   // things that live for one match: spawn pads, the crystal mine
 if(B3.uref===units&&B3.dyn)return;
 if(B3.dyn){RS.remove(B3.dyn);B3.dyn.traverse(o=>{if(o.material&&o.material.dispose)o.material.dispose();});}
 for(const [u,o] of B3.units)dropUnit(u,o);
 for(const [c,m] of B3.crates){RS.remove(m);m.material.dispose();}B3.crates.clear();
 for(const w of B3.wrecks)RS.remove(w.g);B3.wrecks=[];PSA.live.length=0;PSN.live.length=0;B3.seen=new WeakSet();
 B3.uref=units;const D=new THREE.Group(),G=geos();
 const done=new Set();
 for(const u of units){if(u.boss||u.sx===undefined)continue;const k=Math.round(u.sx*2)+','+Math.round(u.sy*2);if(done.has(k))continue;done.add(k);
  const pad=new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.95,0.06,6),new THREE.MeshLambertMaterial({color:0x2a3242}));pad.position.set(u.sx,0.03,u.sy);D.add(pad);
  const pr=new THREE.Mesh(new THREE.RingGeometry(0.78,0.9,6).rotateX(-Math.PI/2),addMat(tcol(u.team),0.6));pr.position.set(u.sx,0.065,u.sy);D.add(pr);}
 if(cry){const m=cry.mine,cl=new THREE.Group();
  for(let i=0;i<7;i++){const a=i/7*6.28,r=i?0.55+(i%2)*0.2:0,h=i?0.6+(i%3)*0.25:1.3,c=new THREE.Mesh(G.oct,G.cryM);c.scale.set(0.22,h,0.22);c.position.set(m.x+Math.cos(a)*r,h*0.5,m.y+Math.sin(a)*r);c.rotation.set((i?0.3:0)*Math.cos(a),0,(i?0.3:0)*Math.sin(a));cl.add(c);}
  const rg=new THREE.Mesh(G.ring,addMat('#c79bff',0.5));rg.scale.setScalar(CRY_MINE_R);rg.position.set(m.x,0.03,m.y);cl.add(rg);
  const dk=new THREE.Mesh(G.disc,addMat('#b98cff',0.08));dk.scale.setScalar(CRY_MINE_R);dk.position.set(m.x,0.025,m.y);cl.add(dk);D.add(cl);}
 B3.dyn=D;RS.add(D);
}

// ---------- the frame ----------
function frame3D(shx,shy){
 const now=performance.now(),dt=Math.min(0.05,B3.last?(now-B3.last)/1000:0.016);B3.last=now;B3.t+=dt;const t=B3.t;
 perfWatch(dt);
 if(!use3D())return;
 ensureMap();matchObjs();
 const s=sc,ox2=ox+shx,oy2=oy+shy;
 RC.left=-ox2/s;RC.right=(vw-ox2)/s;RC.top=oy2/s;RC.bottom=-(vh-oy2)/s;RC.updateProjectionMatrix();
 const pr=RR.getPixelRatio(),pxs=s*pr;
 STARS.material.uniforms.uS.value=pr*18;
 poolsBegin();
 const G=geos(),meUnder=me&&typeof underDeck==='function'&&underDeck(me);
 // map: spinning pylons, deck fades while you're under it, pulsing energy
 for(const sp of B3.map.spin)sp.o.rotation[sp.axis]+=sp.spd*dt;
 if(B3.map.deck){MT.tun.opacity=meUnder?0.28:0.62;MT.deck.opacity=meUnder?0.8:1;MT.deck.transparent=meUnder;MT.deck.depthWrite=!meUnder;}
 const pl=0.75+0.25*Math.sin(now/350);MT.pulse.color.setRGB(pl,pl,pl);
 // crates
 const live=new Set(crates);
 for(const [c,m] of B3.crates)if(!live.has(c)){RS.remove(m);m.material.dispose();B3.crates.delete(c);}
 for(const c of crates){let m=B3.crates.get(c);
  if(!m){m=new THREE.Group();const mat=new THREE.MeshLambertMaterial({vertexColors:true});m.add(new THREE.Mesh(G.crate.lit,mat));m.material=mat;m.scale.set(c[2],0.85,c[3]);m.position.set(c[0]+c[2]/2,0,c[1]+c[3]/2);RS.add(m);B3.crates.set(c,m);}
  const f=c.hp/c.mhp;m.material.emissive.setHex(c.flash>0?0x6a4a20:0x000000);m.material.color.setScalar(0.55+0.45*f);m.rotation.z=(1-f)*0.06*Math.sin(c[0]*7);}
 // tanks
 const seen=new Set();
 for(const u of units){
  if(u.hp<=0)continue;
  const o=unitObj(u);seen.add(u);o.g.visible=true;
  const hgt=heightAt(u),hd=u.hd===undefined?u.ang:u.hd,ds=R*(u.dscale||1)*TANK_VIS;
  let lift=0;if(u.boss&&warns.length){for(const w of warns)if(w.boss&&w.src===u&&w.r>2){const k=1-w.t/w.t0;lift=Math.sin(Math.min(1,k*1.15)*Math.PI)*0.9;}}
  o.g.position.set(u.x,hgt,u.y);o.g.scale.setScalar(ds);
  o.hull.rotation.y=-hd;o.tur.rotation.y=-(u.ang-hd);
  o.body.position.y=(o.meta.bob?o.meta.bob*Math.sin(t*3+(u.id||0)):0)+lift/ds;
  o.recoil=Math.max(0,o.recoil-dt*6);o.tg.position.x=-o.recoil*0.14;
  stepAnims(o.anims,dt,t);
  const fl=u.flash>0;if(fl!==o.fl){o.fl=fl;const e=fl?(armor(u)>0?BUFF.arm.c:'#ffe27a'):'#000000';o.mats.lit.emissive.set(e);o.mats.shine.emissive.set(e);if(!fl&&u.gh){o.mats.lit.emissive.setHex(0x3a5a9a);o.mats.shine.emissive.setHex(0x3a5a9a);}}
  if(o.ring){const k=0.7+0.3*Math.sin(now/280);o.ring.material.opacity=k;}
  if(o.aura&&o.av>=2)o.aura.material.opacity=0.35+0.3*(0.5+0.5*Math.sin(now/420));
  if(u.boss&&u.bt&&u.bt.enr){o.mats.lit.emissive.setRGB(0.25+0.15*Math.sin(now/120),0.02,0);if(Math.random()<dt*20)emit(PSN,{x:u.x+(Math.random()-0.5),y:1.6,z:u.y+(Math.random()-0.5),vy:1.2,vx:(Math.random()-0.5)*0.4,life:1.2,s0:0.5,s1:1.4,c:'#2a1a18',a:0.55});}
  // shield: a crackling plasma sphere
  if(u.shieldT>0){if(!o.shield){o.shield=new THREE.Mesh(decals().shield,new THREE.ShaderMaterial({vertexShader:SH_VS,fragmentShader:SH_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uA:{value:1},uT:{value:0}}}));o.shield.position.y=0.5;o.g.add(o.shield);}
   o.shield.visible=true;o.shield.material.uniforms.uT.value=t;o.shield.scale.setScalar(1+0.03*Math.sin(t*7));
   if(Math.random()<dt*14){const a=Math.random()*6.28,b=Math.random()*1.4;emit(PSA,{x:u.x+Math.cos(a)*Math.cos(b)*2.7,y:0.4+Math.sin(b)*2.7,z:u.y+Math.sin(a)*Math.cos(b)*2.7,life:0.18,s0:0.35,s1:0.1,c:'#cfe8ff'});}}
  else if(o.shield)o.shield.visible=false;
  // movement: speed trail (dash, boost) and the epic / legendary glow trail
  const mv=Math.hypot(u.x-o.px,u.y-o.py);o.px=u.x;o.py=u.y;
  o.g.updateMatrixWorld();
  if(mv>0.004&&o.meta.trail.length&&R3.q!=='low')for(const p of o.meta.trail){const w=wpos(o.hull,p);emit(PSA,{x:w.x,y:w.y,z:w.z,life:0.35,s0:0.38,s1:0.05,c:o.meta.tc,a:0.85});}
  if((u.dash||spdMult(u)>1)&&mv>0.01)emit(PSA,{x:u.x,y:hgt+0.35,z:u.y,life:0.3,s0:1.1,s1:0.2,c:o.spec.team,a:0.35});
  // Hyperspace Vault: gold engine trail (level 5), the glowing tooth and gold aura (10), hyperspace shimmer (25)
  const vl=o.spec.vl;
  if(vl>=5&&mv>0.004&&o.rear)for(const p of o.rear){const w=wpos(o.hull,p);emit(PSA,{x:w.x,y:w.y,z:w.z,life:0.55,s0:0.42,s1:0.06,c:Math.random()<0.3?'#fff3c2':'#ffcf4a',a:0.9,vy:0.25});}
  if(o.tooth&&o.spec.vt>=2){const w=wpos(o.body,o.tooth);once(PSA,w.x,w.y,w.z,(0.9+0.25*Math.sin(now/260))*ds,'#ffcf4a',0.6);}
  if(o.varc){o.varc.rotation.y=-t*0.9;o.varc.mat.opacity=0.45+0.25*Math.sin(now/380);}
  if(vl>=25&&Math.random()<dt*(R3.q==='low'?6:14)){const a=Math.random()*6.28,d=Math.random()*1.3*ds;emit(PSA,{x:u.x+Math.cos(a)*d,y:hgt+0.35+Math.random()*0.9*ds,z:u.y+Math.sin(a)*d,vy:0.6,life:0.6,s0:0.08,s1:0.42,c:['#ffffff','#c79bff','#ffcf4a','#ff7ad9'][(Math.random()*4)|0],a:0.95});}
  // soft glows on lights, orbs and cores (a cheap stand-in for bloom)
  for(const h of o.meta.halos){const w=wpos(o.body,h);once(PSA,w.x,w.y,w.z,h[4]*ds*1.6,h[3],0.55);}
  for(const h of o.wmeta.halos){const w=wpos(o.tg,h);once(PSA,w.x,w.y,w.z,h[4]*ds*1.6,h[3],0.55);}
  // super charging: light gathers at the muzzle
  if(u.sup&&SUP[u.sup.w]){const S=SUP[u.sup.w],k=1-u.sup.t/S.charge,tp=o.wmeta.tips[0];if(tp){const w=wpos(o.tg,tp);once(PSA,w.x,w.y,w.z,0.6+1.6*k,'#ff5a4a',0.5+0.5*k);once(PSA,w.x,w.y,w.z,0.3+0.6*k,'#ffffff',0.8);}}
  // bounty: a gold star over tanks worth 3+
  if(matchG==='bounty'&&(u.bty||0)>=3){const st=poolGet('star',()=>{const m=new THREE.Group();m.add(new THREE.Mesh(G.star.shine,MT.shine));return m;});
   st.position.set(u.x,hgt+1.9*ds/R*0.7+0.4*Math.sin(t*3),u.y);st.rotation.y=t*2.2;st.scale.setScalar(0.7+Math.min(0.8,(u.bty-3)*0.08));}
 }
 for(const [u,o] of B3.units)if(!seen.has(u)){if(units.includes(u))o.g.visible=false;else dropUnit(u,o);}
 // wrecks: charred hulls that smoke, then sink away
 B3.wrecks=B3.wrecks.filter(w=>{w.t+=dt;const k=w.t/3.2;if(k>=1){RS.remove(w.g);w.mat.dispose();return false;}
  w.g.position.y=w.y0-Math.max(0,k-0.6)*0.8;w.mat.opacity=1-Math.max(0,k-0.6)/0.4;
  if(Math.random()<dt*10)emit(PSN,{x:w.x+(Math.random()-0.5)*0.5,y:w.y0+0.5,z:w.z+(Math.random()-0.5)*0.5,vy:0.9,vx:0.2,life:1.4,s0:0.4,s1:1.5,c:'#1d1f24',a:0.6*(1-k)});
  if(k<0.5&&Math.random()<dt*8)emit(PSA,{x:w.x+(Math.random()-0.5)*0.6,y:w.y0+0.4,z:w.z+(Math.random()-0.5)*0.6,vy:1.4,life:0.4,s0:0.5,s1:0.1,c:'#ff8a3d'});
  return true;});
 // bullets: a core in the weapon's color with a team-colored halo, each weapon with its own trail
 for(const q of bullets){
  const own=q.o||{},arch=own.wtype||'pulse',ho=own.hp!==undefined?heightAt(own):0,y=ho+0.52,dm=Math.min(1.8,q.dm||1),tc=tcol(own.team||0);
  if(!B3.seen.has(q)){B3.seen.add(q);muzzle(own,arch);}
  const wc=arch==='moon'?'#fff6d8':WEAPONS[arch]?WEAPONS[arch].c:'#ffffff';
  if(arch==='twin'){once(PSA,q.x,y,q.y,0.55*dm,tc,0.55);once(PSA,q.x,y,q.y,0.26*dm,'#fff4c0',1);emit(PSA,{x:q.x,y,z:q.y,life:0.09,s0:0.22,s1:0.05,c:wc,a:0.7});}
  else if(arch==='siege'){once(PSA,q.x,y,q.y,1.1*dm,tc,0.5);once(PSA,q.x,y,q.y,0.5*dm,'#ffb36b',1);emit(PSN,{x:q.x,y,z:q.y,life:0.5,s0:0.25,s1:0.7,c:'#3a3d45',a:0.4,vy:0.3});}
  else if(arch==='moon'){once(PSA,q.x,y,q.y,0.9*dm,'#bfe6ff',0.6);once(PSA,q.x,y,q.y,0.38*dm,'#ffffff',1);emit(PSA,{x:q.x+(Math.random()-0.5)*0.1,y,z:q.y+(Math.random()-0.5)*0.1,life:0.28,s0:0.22,s1:0.02,c:'#ffe7a0',a:0.9});}
  else{once(PSA,q.x,y,q.y,0.85*dm,tc,0.55);once(PSA,q.x,y,q.y,0.36*dm,wc,1);emit(PSA,{x:q.x,y,z:q.y,life:0.12,s0:0.3,s1:0.06,c:wc,a:0.7});}
 }
 // power-up boxes, crystals
 for(const bx of boxes){const m=poolGet('box',()=>{const g=new THREE.Group();g.add(new THREE.Mesh(G.unit,G.boxM));const beam=new THREE.Mesh(G.col,new THREE.MeshBasicMaterial({color:0xffcf4a,transparent:true,opacity:0.35,depthWrite:false,blending:THREE.AdditiveBlending,alphaMap:vgrad(),side:THREE.DoubleSide}));beam.scale.set(0.45,3.2,0.45);beam.position.y=1.0;beam.name='beam';g.add(beam);return g;});
  m.position.set(bx.x,0.55+0.12*Math.sin(now/220+bx.x),bx.y);m.children[0].rotation.set(0.35,now/700,0);m.children[0].scale.setScalar(0.62);once(PSA,bx.x,0.6,bx.y,1.4,'#ffcf4a',0.35);}
 if(cry)cry.loose.forEach((c,i)=>{const m=poolGet('cry',()=>new THREE.Mesh(G.oct,G.cryM));const k=Math.min(1,0.3+c.age*2);
  m.position.set(c.x,(c.l===1?M3.DECK_H:0)+0.55+0.14*Math.sin(now/320+i),c.y);m.scale.set(0.24*k,0.38*k,0.24*k);m.rotation.y=now/600+i;once(PSA,c.x,m.position.y,c.y,1.1*k,'#b98cff',0.45);});
 // Moon Zones: glowing pad, a light column, the capture ring
 if(gzones)for(const z of gzones){const col=z.own===0?TC[0]:z.own===1?TC[1]:'#c9d6e3';
  const d=poolGet('zdisc',()=>new THREE.Mesh(G.disc,addMat('#ffffff',0.15)));d.material.color.set(col);d.material.opacity=0.2+0.07*Math.sin(now/300);d.scale.setScalar(z.r);d.position.set(z.x,0.03,z.y);
  const rg=poolGet('zring',()=>new THREE.Mesh(G.ringT,addMat('#ffffff',0.9)));rg.material.color.set(col);rg.scale.setScalar(z.r);rg.position.set(z.x,0.04,z.y);
  const mk=poolGet('zmoon',()=>new THREE.Mesh(G.moon,addMat('#ffffff',0.85)));mk.material.color.set(col);mk.position.set(z.x,0.05,z.y);mk.rotation.y=now/1500;
  const cl=poolGet('zcol',()=>new THREE.Mesh(G.col,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.3,depthWrite:false,blending:THREE.AdditiveBlending,alphaMap:vgrad(),side:THREE.DoubleSide})));
  cl.material.color.set(col);cl.material.opacity=0.45;cl.scale.set(z.r,2.6,z.r);cl.position.set(z.x,1.2,z.y);cl.rotation.y=now/2000;
  if(Math.random()<dt*6){const a=Math.random()*6.28,r=Math.random()*z.r;emit(PSA,{x:z.x+Math.cos(a)*r,y:0.1,z:z.y+Math.sin(a)*r,vy:1.2,life:1.2,s0:0.3,s1:0.05,c:col,a:0.8});}}
 // Last Standing: the storm wall
 if(storm){const m=poolGet('storm',()=>new THREE.Mesh(G.col,new THREE.MeshBasicMaterial({color:0xa070ff,transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending,alphaMap:vgrad(),side:THREE.DoubleSide})));
  m.scale.set(Math.max(0.1,storm.r),1.8,Math.max(0.1,storm.r));m.position.set(storm.x,0.9,storm.y);m.material.opacity=storm.r>14?0.22:0.45;m.rotation.y=now/3000;
  for(let i=0;i<(R3.q==='low'?1:3);i++){const a=Math.random()*6.28;emit(PSA,{x:storm.x+Math.cos(a)*storm.r,y:Math.random()*2.5,z:storm.y+Math.sin(a)*storm.r,vy:0.6,life:0.8,s0:0.45,s1:0.1,c:'#c79bff',a:0.7});}}
 // meteors and Megatank shells falling onto their warning rings
 for(const w of warns){if(w.boss&&w.r>2)continue;const k=Math.max(0,w.t/w.t0),m=poolGet('met',()=>new THREE.Mesh(G.ico,G.rock));
  const hh=k*13,dx=k*3.5;m.position.set(w.x-dx,hh+0.3,w.y-dx*0.6);m.scale.setScalar(w.boss?0.32:0.45);m.rotation.set(now/200,now/300,0);
  once(PSA,m.position.x,m.position.y,m.position.z,w.boss?1.6:2.2,w.boss?'#ff5a3a':'#ff9a45',0.8);emit(PSA,{x:m.position.x,y:m.position.y,z:m.position.z,life:0.35,s0:1.0,s1:0.1,c:'#ffb35a',a:0.8});
  if(R3.q!=='low')emit(PSN,{x:m.position.x,y:m.position.y,z:m.position.z,life:0.8,s0:0.5,s1:1.2,c:'#2c2c30',a:0.45});}
 // super shells (Siege Blast): an arcing fireball
 for(const sh of shells){if(!B3.shellL0.has(sh))B3.shellL0.set(sh,sh.life||1);const L0=B3.shellL0.get(sh),f=1-Math.max(0,sh.life)/L0,hh=0.6+Math.sin(Math.min(1,f)*Math.PI)*2.2;
  const m=poolGet('shell',()=>new THREE.Mesh(G.sphere,addMat('#ff9d45',1)));m.position.set(sh.x,hh,sh.y);m.scale.setScalar(0.32);
  once(PSA,sh.x,hh,sh.y,2.4,'#ff7a2f',0.75);once(PSA,sh.x,hh,sh.y,1.0,'#ffe08a',1);emit(PSA,{x:sh.x,y:hh,z:sh.y,life:0.3,s0:0.9,s1:0.1,c:'#ff8a3d'});emit(PSN,{x:sh.x,y:hh,z:sh.y,life:0.9,s0:0.6,s1:1.6,c:'#33302e',a:0.5,vy:0.3});}
 // beams (Pierce Lance, Moonfall)
 for(const bm of beams){const big=(bm.w||1.2)>=1.9,dx=bm.bx-bm.ax,dz=bm.by-bm.ay,L=Math.hypot(dx,dz),a=Math.atan2(dz,dx),k=Math.min(1,bm.t/0.15);
  const o=poolGet('beam',()=>new THREE.Mesh(G.unit,addMat('#ffffff',1)));o.material.color.set(big?'#ffe7a0':bm.c);o.material.opacity=0.75*k;
  o.scale.set(L,0.35,0.9*(bm.w||1.2)*(0.7+0.3*k));o.position.set(bm.ax+dx/2,0.55,bm.ay+dz/2);o.rotation.set(0,-a,0);
  const c=poolGet('beamc',()=>new THREE.Mesh(G.unit,addMat('#ffffff',1)));c.material.opacity=k;c.scale.set(L,0.2,0.28*(bm.w||1.2));c.position.copy(o.position);c.rotation.copy(o.rotation);
  for(let i=0;i<(big?5:2);i++){const f=Math.random();emit(PSA,{x:bm.ax+dx*f,y:0.55,z:bm.ay+dz*f,vy:big?2:1,vx:(Math.random()-0.5),vz:(Math.random()-0.5),life:0.35,s0:big?0.7:0.4,s1:0.05,c:big?'#fff3c4':bm.c});}}
 // blasts: a fireball, a ground shockwave, embers and smoke on the first frame
 for(const b of blasts){const k=1-b.t/b.t0;
  if(!B3.seen.has(b)){B3.seen.add(b);boom3(b.x,b.y,b.r,b.c);}
  const f=poolGet('blast',()=>new THREE.Mesh(G.sphere,addMat('#ffffff',1)));f.material.color.set(b.c);f.material.opacity=Math.max(0,1-k)*0.8;f.scale.setScalar(b.r*(0.25+0.6*k));f.position.set(b.x,0.3+b.r*0.2*k,b.y);
  const r=poolGet('bring',()=>new THREE.Mesh(G.ring,addMat('#ffffff',1)));r.material.color.set(b.c);r.material.opacity=Math.max(0,1-k);r.scale.setScalar(b.r*(0.3+0.9*k));r.position.set(b.x,0.06,b.y);}
 // Static Nova: jagged electric rings
 for(const n of novas){const k=1-n.t/n.t0;if(!B3.seen.has(n)){B3.seen.add(n);for(let i=0;i<24;i++){const a=i/24*6.28;emit(PSA,{x:n.x,y:0.5,z:n.y,vx:Math.cos(a)*n.r*2.2,vz:Math.sin(a)*n.r*2.2,drag:3,life:0.45,s0:0.5,s1:0.1,c:'#e9f6ff'});}}
  for(let ring=0;ring<3;ring++){const m=poolGet('nova',()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(48*6*3),3));return new THREE.Mesh(g,addMat('#ffffff',1));});
   novaRing(m.geometry,n.r*(0.25+0.75*k)*(1-ring*0.2),0.12-ring*0.03,k);m.position.set(n.x,0.4+ring*0.15,n.y);m.material.color.set(ring?n.c:'#e9f6ff');m.material.opacity=Math.max(0,1-k);}}
 poolsEnd();
 psStep(PSA,dt);psStep(PSN,dt);psFlush(PSA,pxs);psFlush(PSN,pxs);
 RR.render(RS,RC);
 R3.calls=RR.info.render.calls;
}
function novaRing(g,R,w,k){const P=g.attributes.position.array,N=48;let o=0;const pt=[];
 for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,j=(Math.random()-0.5)*0.35*(1-k*0.5);pt.push([Math.cos(a)*(R+j),Math.sin(a)*(R+j)]);}
 for(let i=0;i<N;i++){const [x0,z0]=pt[i],[x1,z1]=pt[i+1],n0=Math.hypot(x0,z0)||1,n1=Math.hypot(x1,z1)||1;
  const a=[x0,0,z0],b=[x1,0,z1],c=[x1+x1/n1*w,0,z1+z1/n1*w],d=[x0+x0/n0*w,0,z0+z0/n0*w];
  for(const v of [a,b,c,a,c,d]){P[o++]=v[0];P[o++]=v[1];P[o++]=v[2];}}
 g.attributes.position.needsUpdate=true;g.computeBoundingSphere();}
// a super landing: a big fireball, a ground shockwave ring of sparks, and each weapon's own touch
function impact3(x,z,w){
 const C=(typeof IMPACT!=='undefined'&&IMPACT[w])||{r:2.4,c:'#ffb35a',c2:'#ffe08a'},lo=R3.q==='low';
 boom3(x,z,C.r*0.9,C.c);
 const n=lo?14:30;for(let i=0;i<n;i++){const a=i/n*6.28;emit(PSA,{x,y:0.15,z,vx:Math.cos(a)*C.r*4,vz:Math.sin(a)*C.r*4,vy:0.3,drag:2.5,life:0.45,s0:0.5,s1:0.08,c:C.c2,a:0.9});}
 once(PSA,x,0.8,z,C.r*4.2,C.c2,1);once(PSA,x,0.5,z,C.r*6,C.c,0.6);
 if(w==='moon')for(let i=0;i<(lo?10:24);i++)emit(PSA,{x:x+(Math.random()-0.5)*0.8,y:0.3,z:z+(Math.random()-0.5)*0.8,vy:7+Math.random()*5,drag:0.6,life:0.7+Math.random()*0.3,s0:0.9,s1:0.2,c:i%3?'#bfe6ff':'#ffffff',a:0.95});   // a pillar of moonlight
 else if(w==='siege'&&!lo)for(let i=0;i<10;i++){const a=Math.random()*6.28,s=Math.random()*C.r;emit(PSN,{x:x+Math.cos(a)*s*0.3,y:0.6,z:z+Math.sin(a)*s*0.3,vy:1.6,vx:Math.cos(a)*s*0.4,vz:Math.sin(a)*s*0.4,drag:0.8,life:1.6,s0:0.8,s1:2.2,c:'#2a2b30',a:0.55});}   // a smoke column
 else if(w==='twin')for(let i=0;i<(lo?8:18);i++){const a=Math.random()*6.28,s=2+Math.random()*5;emit(PSA,{x,y:0.6,z,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:2+Math.random()*3,g:6,life:0.35,s0:0.25,s1:0.05,c:'#e2f4ff'});}   // electric sparks
 else for(let i=0;i<(lo?8:16);i++){const a=Math.random()*6.28,s=3+Math.random()*4;emit(PSA,{x,y:0.5,z,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:3+Math.random()*4,g:10,life:0.6,s0:0.3,s1:0.1,c:'#ffd24a'});}   // gold shrapnel
}
function boom3(x,z,r,c){
 const n=Math.round((R3.q==='low'?6:14)*Math.min(2.5,r));
 for(let i=0;i<n;i++){const a=Math.random()*6.28,s=(1+Math.random()*2.5)*r;emit(PSA,{x,y:0.4,z,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:1+Math.random()*3,g:6,drag:1.5,life:0.5+Math.random()*0.4,s0:0.35,s1:0.05,c:Math.random()<0.5?c:'#ffe08a'});}
 for(let i=0;i<Math.round(n*0.4);i++){const a=Math.random()*6.28,s=Math.random()*r;emit(PSN,{x:x+Math.cos(a)*s*0.4,y:0.5,z:z+Math.sin(a)*s*0.4,vx:Math.cos(a)*s*0.6,vz:Math.sin(a)*s*0.6,vy:0.8,drag:1,life:1.2+Math.random()*0.6,s0:r*0.5,s1:r*1.2,c:'#2a2b30',a:0.5});}
 once(PSA,x,0.6,z,r*3,c,0.9);
}
function muzzle(u,arch){
 const o=B3.units.get(u);if(!o||!o.wmeta.tips.length)return;
 const tp=o.wmeta.tips[o.tipI++%o.wmeta.tips.length],w=wpos(o.tg,tp),c=arch==='moon'?'#e8f4ff':WEAPONS[arch]?WEAPONS[arch].c:'#ffffff';
 o.recoil=arch==='twin'?0.4:1;
 emit(PSA,{x:w.x,y:w.y,z:w.z,life:0.07,s0:arch==='siege'?1.6:0.9,s1:0.3,c,a:1,fade:0});
 if(arch==='siege'&&R3.q!=='low')emit(PSN,{x:w.x,y:w.y,z:w.z,life:0.6,s0:0.4,s1:1.1,c:'#4a4c55',a:0.45,vy:0.5});
}
// game events: kills (explosion + wreck), hits (sparks; counters burn gold, resisted hits flash blue), crates breaking
function ev3D(a){
 if(!use3D()||!RS)return;
 const U=i=>i>=0?units[i]:null;
 if(a[0]==='I'){impact3(a[1],a[2],a[3]);return;}
 if(a[0]==='k'){const r=U(a[1]);if(!r)return;const o=B3.units.get(r);
  if(o){const w=new THREE.Group(),mat=new THREE.MeshLambertMaterial({color:0x1a1c22,transparent:true,emissive:0x2a0c00});
   o.body.children.forEach(ch=>{if(ch.isGroup)return;const c=ch.clone();c.traverse(x=>{if(x.isMesh)x.material=mat;});w.add(c);});
   const m0=o.body.children[0];if(m0){const c=m0.clone();c.traverse(x=>{if(x.isMesh)x.material=mat;});w.add(c);}
   w.position.copy(o.g.position);w.scale.copy(o.g.scale);w.rotation.y=o.hull.rotation.y+0.3;RS.add(w);
   B3.wrecks.push({g:w,mat,t:0,x:r.x,z:r.y,y0:o.g.position.y});}
  for(let i=0;i<10;i++){const aa=Math.random()*6.28;emit(PSA,{x:r.x,y:0.6,z:r.y,vx:Math.cos(aa)*4,vz:Math.sin(aa)*4,vy:4+Math.random()*3,g:12,life:0.9,s0:0.3,s1:0.15,c:'#ffb35a'});}
  return;}
 if(a[0]==='h'&&!a[3]&&a[2]>0){const t=U(a[1]),s=U(a[6]);if(!t)return;
  const dx=s?s.x-t.x:0,dz=s?s.y-t.y:0,d=Math.hypot(dx,dz)||1,x=t.x+dx/d*0.55,z=t.y+dz/d*0.55,y=heightAt(t)+0.5;
  const ctr=s&&s.cls&&t.cls&&!s.boss&&!t.boss?(COUNTER[s.cls]===t.cls?1:COUNTER[t.cls]===s.cls?-1:0):0;
  const c=ctr>0?'#ffb02e':ctr<0?'#7fc8ff':s?tcol(s.team):'#ffffff',n=ctr?9:a[4]?8:4;
  for(let i=0;i<n;i++){const aa=Math.atan2(dz,dx)+(Math.random()-0.5)*2.2,sp=2+Math.random()*4;emit(PSA,{x,y,z,vx:Math.cos(aa)*sp,vz:Math.sin(aa)*sp,vy:Math.random()*2,drag:4,life:0.25,s0:ctr?0.42:0.3,s1:0.04,c});}
  once(PSA,x,y,z,ctr?1.8:a[4]?1.5:0.9,c,0.8);
  if(ctr<0)emit(PSA,{x:t.x,y,z:t.y,life:0.22,s0:2.4,s1:3.2,c:'#7fc8ff',a:0.35});
  return;}
 if(a[0]==='X'){const x=a[2],z=a[3];for(let i=0;i<14;i++){const aa=Math.random()*6.28;emit(PSN,{x,y:0.5,z,vx:Math.cos(aa)*3,vz:Math.sin(aa)*3,vy:2+Math.random()*3,g:9,life:0.8,s0:0.22,s1:0.18,c:'#7a5530',a:1,fade:0});}return;}
 if(a[0]==='m'){const x=a[1],z=a[2];for(let i=0;i<10;i++){const aa=Math.random()*6.28;emit(PSN,{x,y:0.3,z,vx:Math.cos(aa)*2,vz:Math.sin(aa)*2,vy:3,g:6,life:0.9,s0:0.25,s1:0.2,c:'#5a5650',a:1,fade:0});}}
}
// frame-rate watch: auto quality steps down to Low, then to 2D, if this phone can't keep up
function perfWatch(dt){
 if(typeof state==='undefined'||state!=='play'||document.hidden)return;
 R3.ft.push(dt);if(R3.ft.length>90)R3.ft.shift();
 if(R3.ft.length<90)return;
 const avg=R3.ft.reduce((a,b)=>a+b,0)/R3.ft.length;R3.fps=Math.round(1/avg);
 if(gfxMode()!=='auto'||!use3D()||window.LUNAR_NO_AUTOGFX)return;
 if(R3.q==='high'&&R3.fps<40){R3.q='low';R3.auto='low';setPR();R3.ft=[];return;}
 if(R3.q==='low'&&R3.fps<24){R3.drop++;R3.ft=[];if(R3.drop>=2){R3.off2d=true;R3.auto='2d';apply3D();if(typeof showToast==='function')showToast('Switched to 2D graphics so the game runs smoothly. Change it in Settings.');}}
}

// ---------- menu pictures: 3D renders on a small offscreen renderer, cached ----------
let AR=null;const artCache=new Map();
function artR(){
 if(AR)return AR;
 const c=document.createElement('canvas');c.width=c.height=256;
 const r=new THREE.WebGLRenderer({canvas:c,alpha:true,antialias:true,preserveDrawingBuffer:true,stencil:false});
 r.setClearColor(0x000000,0);r.outputColorSpace=THREE.SRGBColorSpace;
 const s=new THREE.Scene();addLights(s);
 const cam=new THREE.PerspectiveCamera(26,1,0.1,200);
 const mats=mkMats(),ps=mkPS(true,64);ps.pts.material.uniforms.uP.value=1;s.add(ps.pts);
 c.addEventListener('webglcontextlost',e=>{e.preventDefault();AR=null;artCache.clear();});
 AR={r,c,s,cam,mats,ps,maps:new Map()};return AR;
}
// put a model group in the art scene, aim the camera, render at w x h css px into ctx
function artShot(ctx,w,h,grp,view,halos){
 const A=artR(),pw=Math.max(1,Math.round(w*dpr)),ph=Math.max(1,Math.round(h*dpr));
 if(A.c.width!==pw||A.c.height!==ph)A.r.setSize(pw,ph,false);
 A.s.add(grp);grp.updateMatrixWorld(true);
 const cam=view.cam||A.cam;
 if(!view.cam){cam.aspect=pw/ph;cam.fov=view.fov||26;const R0=view.r||1.6,el=view.el===undefined?0.55:view.el,az=view.az===undefined?0.9:view.az,dist=R0/Math.sin(cam.fov*Math.PI/360)*(view.z||1)/Math.min(1,cam.aspect);
  cam.position.set(Math.sin(az)*Math.cos(el)*dist+(view.cx||0),Math.sin(el)*dist+(view.cy||0),Math.cos(az)*Math.cos(el)*dist+(view.cz||0));cam.up.set(0,1,0);cam.lookAt(view.cx||0,view.cy||0,view.cz||0);cam.updateProjectionMatrix();}
 A.ps.n=0;for(const hl of halos||[]){const v=hl[0];once(A.ps,v.x,v.y,v.z,hl[2],hl[1],0.55);}
 psFlush(A.ps,ph*0.9);
 A.r.render(A.s,cam);
 A.s.remove(grp);
 ctx.drawImage(A.c,0,0,w,h);
}
function cachedArt(ctx,w,h,key,fn){
 const k=key+'@'+w+'x'+h+'x'+dpr;let c=artCache.get(k);
 if(!c){c=document.createElement('canvas');c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);fn(x);artCache.set(k,c);if(artCache.size>120)artCache.delete(artCache.keys().next().value);}
 ctx.drawImage(c,0,0,w,h);
}
function haloList(o,parts){const out=[];o.g.updateMatrixWorld(true);for(const h of o.meta.halos||[])out.push([wpos(o.body,h).clone(),h[3],h[4]*1.5]);if(o.tooth&&o.spec&&o.spec.vt>=2)out.push([wpos(o.body,o.tooth).clone(),'#ffcf4a',1.1]);if(parts!==1)for(const h of o.wmeta.halos||[])out.push([wpos(o.tg,h).clone(),h[3],h[4]*1.5]);return out;}
// a tank (or part of one) for the menus. parts: 1 = chassis only, 2 = weapon only, 3 = whole tank
function artTank(ctx,w,h,spec,parts,opt){
 opt=opt||{};const A=artR(),T=buildTank(spec,A.mats);
 if(parts===1)T.tur.visible=false;
 if(parts===2){T.body.children.forEach(c=>{if(c!==T.tur)c.visible=false;});T.tur.position.set(-0.75,0,0);}
 T.hull.rotation.y=opt.hd===undefined?0:opt.hd;T.tur.rotation.y=opt.ta||0;
 if(opt.t!==undefined)stepAnims(T.anims,0,opt.t);
 const hal=haloList(T,parts);
 const r=(spec.boss?2.2:parts===2?1.25:1.55)*(spec.arch==='moon'&&parts!==1?1.22:1);   // the Moonbeam (Tide Engine) is long and tall: frame it wider
 artShot(ctx,w,h,T.g,{r,el:opt.el===undefined?0.6:opt.el,az:opt.az===undefined?0.95:opt.az,cy:parts===2?0.3:0.35,z:opt.z||1},hal);
}
const mySpec=(o)=>{let L=null;try{L=myLoadout();}catch(e){}const lunar=save.skin==='lunar';
 return Object.assign({fits:L?fittingVisuals(L):undefined,cls:L?L.c.c:'vanguard',ct:L?Math.max(0,L.c.t|0):0,arch:L?L.w.a:'pulse',wt:L?Math.max(0,L.w.t|0):0,paint:save.paint||'stock',lunar,team:lunar?'#e8f4ff':TC[0],gems:(save.cores||[]).filter(Boolean).join(','),boss:false,ghost:false,vl:vaultLevel(save.vg),vt:vtOf(vaultLevel(save.vg))},o||{});};
// returns true when it drew the picture in 3D
function art3D(ctx,w,h,a){
 if(!use3D()||!w||!h)return false;
 try{
  if(a[0]==='hero'){heroArt(ctx,w,h,performance.now()/1000);return true;}
  if(a[0]==='tank'){const sp=a[1]==='lunar'?mySpec({lunar:true,team:'#e8f4ff',paint:'stock'}):a[1]==='paint'?mySpec({paint:PAINTS[a[2]]?a[2]:'stock',lunar:false,team:TC[0]}):mySpec();
   cachedArt(ctx,w,h,'t|'+specKey(sp),x=>artTank(x,w,h,sp,3,{az:0.95}));return true;}
  if(a[0]==='gear'){const isW=a[1]==='w',k=a[2];
   const it=k==='moon'?getW('moon'):a[3]===undefined?(isW?getW(save.weapon):getC(save.chassis)):(isW?getW(k,+a[3],a[4]==='1'):getC(k,+a[3],a[4]==='1'));
   const base=mySpec({paint:it.sal?'regolith':'stock',lunar:false,gems:''});
   const sp=isW?Object.assign(base,{arch:it.arch||'pulse',wt:Math.max(0,it.tier|0)}):Object.assign(base,{cls:it.cls||'vanguard',ct:Math.max(0,it.tier|0)});
   const small=Math.min(w,h)<80;cachedArt(ctx,w,h,'g|'+(isW?'w':'c')+'|'+specKey(sp)+'|'+(it.sal?1:0),x=>artTank(x,w,h,sp,isW?2:1,{az:isW?1.15:0.95,z:(isW?0.92:1)*(small?0.78:1)}));return true;}
  if(a[0]==='unit'){const u=units[+a[1]];if(!u)return true;const sp=unitSpec(u);
   artTank(ctx,w,h,sp,3,{hd:u.team===0?0.35:-1.95,az:0.9,z:u.boss?1.0:1.05});return true;}
  if(a[0]==='crate'){const tk=a[1],ri=+a[2];cachedArt(ctx,w,h,'cr|'+tk+'|'+ri,x=>{const A=artR(),r=M3.crateKit(tk,ri),b=M3.bake(r.k),g=M3.meshOf(b,null,A.mats);
    for(const an of r.anims){const m=M3.meshOf(M3.bake(an.k),null,A.mats);m.position.set(an.p[0],an.p[1],an.p[2]);m.rotation.y=0.6;g.add(m);}
    artShot(x,w,h,g,{r:1.32,el:0.42,az:0.7,cy:0.78},r.meta.halos.map(hl=>[new THREE.Vector3(hl[0],hl[1],hl[2]),hl[3],hl[4]]));});return true;}
  if(a[0]==='gem'){cachedArt(ctx,w,h,'gem|'+a[1],x=>{const A=artR(),r=M3.gemKit(a[1]),g=M3.meshOf(M3.bake(r.k),null,A.mats);g.rotation.y=0.5;
    artShot(x,w,h,g,{r:0.95,el:0.3,az:0.5},[[new THREE.Vector3(0,0,0),GEM[a[1]]?GEM[a[1]].c:'#8a97ab',2.6]]);});return true;}
  if(a[0]==='map'&&a[1]!=='random'){cachedArt(ctx,w,h,'map|'+a[1],x=>mapArt(x,w,h,a[1]));return true;}
 }catch(e){try{console.warn('art3D',e);}catch(_){}}
 return false;
}
function mapArt(ctx,w,h,id){
 const A=artR();let m=A.maps.get(id);if(!m){m=M3.buildMap(id,A.mats,'high');A.maps.set(id,m);}
 const cam=new THREE.OrthographicCamera(-1,1,1,-1,1,400),s=Math.min(w/W,h/(H*GKC+1.2)),hw=w/2/s,hh=h/2/s;
 cam.left=-hw;cam.right=hw;cam.top=hh;cam.bottom=-hh;cam.up.set(0,GSN,-GKC);cam.position.set(W/2,GKC*150,H/2+GSN*150);cam.lookAt(W/2,0,H/2);cam.updateProjectionMatrix();
 artShot(ctx,w,h,m.group,{cam},[]);
}
// the Play tab hero: your tank on the moon, turret idling. The moon and stars stay 2D; the tank is 3D, drawn live
function heroArt(ctx,w,h,t){
 drawHeroScene(ctx,w,h,t,true);
 const room=h-58,r=Math.max(16,Math.min(w*0.12,room*0.2)),cx=w/2,cy=room*0.62,bw=r*5.2,bh=r*3.6;
 const sp=mySpec(),k='hero|'+specKey(sp);
 if(!AR||!AR.hero||AR.hero.k!==k){const A=artR();AR.hero={k,T:buildTank(sp,A.mats)};}
 const T=AR.hero.T;T.hull.rotation.y=0.25;T.tur.rotation.y=Math.sin(t*0.55)*0.42;stepAnims(T.anims,0.033,t);
 T.body.position.y=T.meta.bob?T.meta.bob*Math.sin(t*3):0;
 ctx.save();ctx.translate(cx-bw/2,cy-bh*0.62);artShot(ctx,bw,bh,T.g,{r:sp.arch==='moon'?1.85:1.55,el:0.5,az:0.95,cy:sp.arch==='moon'?0.5:0.35},haloList(T,3));ctx.restore();
}

function machineArt3D(ctx,w,h,L){
 if(!R3.ready||R3.failed||gfxMode()==='2d')return false;
 try{const sp=unitSpec({...tankOf(L,1),team:0});sp.ct=L.c.t;cachedArt(ctx,w,h,'lab|'+specKey(sp),c=>artTank(c,w,h,sp,3,{az:1}));return true;}catch(e){return false;}
}
