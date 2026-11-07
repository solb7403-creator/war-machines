/* LUNAR Conquest art direction "NEON FRONTLINE" — the Phase 2 graphics overhaul, picked from three Phase 1 options
 * (docs/conquest/IMPLEMENTATION_CHECKPOINT.md, Checkpoint 21). Presentation only: every builder reads the canonical
 * ConquestWorld / ConquestCombat footprints and never defines collision, simulation, rewards or hitboxes.
 *
 * ConquestStyle.create(THREE,{low}) -> one instance per Conquest view and quality. A fixed material set is created once
 * and compiled before play (no runtime program creation):
 *   sky      black dome, teal/violet horizon band, nebula, stars and Earth — one draw
 *   terrain  world-space regolith with 2–3 crater scales, slope strata, lichen glow on terraformed ground, friendly hex
 *            grid / scan rings and Parasite creep veins around the nearest 8 sites (uSite, refreshed as the player moves)
 *   solid    structures, props, hull dressing: key + hemisphere + site-tinted rim + fresnel; vertex alpha = emission
 *   fx       premultiplied glow / contact-shadow decals, halos, beams and holo signs from one mask atlas
 *   shield   fresnel energy shell (player Shield, Command Base field)
 * Fake bloom is geometry only: no render targets, no post-processing, no shadow map. THREE is only touched inside
 * create(): the game loads three.js after boot. */
(function(root){
'use strict';
const TAU=Math.PI*2,clamp01=v=>v<0?0:v>1?1:v;
function hash3(x,y,z){let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1440662683))|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function vn3(x,y,z){const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf),L=(a,b,t)=>a+(b-a)*t;
 return L(L(L(hash3(xi,yi,zi),hash3(xi+1,yi,zi),u),L(hash3(xi,yi+1,zi),hash3(xi+1,yi+1,zi),u),v),L(L(hash3(xi,yi,zi+1),hash3(xi+1,yi,zi+1),u),L(hash3(xi,yi+1,zi+1),hash3(xi+1,yi+1,zi+1),u),v),w);}
function fbm3(x,y,z,o){let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*vn3(x*f,y*f,z*f);n+=a;a*=.5;f*=2.03;}return s/n;}

// ---------- canonical footprints (read from the shared modules; art must stay inside them) ----------
function footprints(W,C){
 return {
  habitats:Array.from({length:9},(_,i)=>({x:1110+i%3*22,z:1148+Math.floor(i/3)*25})),            // solid r7.8, shots < +9 within 8
  processors:Array.from({length:3},(_,i)=>({x:1150+i*30,z:1080,artHeight:90+i%2*38})),           // solid r12, shots < +108/146
  terminal:{x:C.refuge.x,z:C.refuge.z},solar:Array.from({length:5},(_,i)=>({x:1098+i*22,z:1225,w:14,d:9,tilt:.3})),
  base:{x:C.baseDefinition.x,z:C.baseDefinition.z},
  installations:C.installations.map(s=>({id:s.id,x:s.x,z:s.z,solid:{x:s.x,z:s.z+8},mast:{x:s.x+14,z:s.z+10}})), // 22x16 box, r2 mast
  obstacles:W.raidObstacles,
  raidSites:C.sectors.map(sec=>{const list=Object.values(C.operations).filter(o=>o.raid&&o.sector===sec.id);return list.length?{sector:sec.id,x:list.reduce((n,o)=>n+o.x,0)/list.length,z:list.reduce((n,o)=>n+o.z,0)/list.length}:null;}).filter(Boolean)};
}
// Light/creep sites for the terrain + rim shaders: [x, z, radius, strength] (>0 friendly cyan, <0 Parasite magenta).
function allSites(F,territory){const out=[[1132,1173,80,1],[F.terminal.x,F.terminal.z,22,1.3],[F.base.x,F.base.z,46,.9],[1180,1080,56,.55]];
 for(const s of F.installations)out.push([s.solid.x,s.solid.z,46,territory?.[s.id]?.owner==='humanity'?.5:-1]);for(const r of F.raidSites)out.push([r.x,r.z,30,-1]);return out;}
const PYLONS=[[1121,1160.5],[1143,1160.5],[1121,1185.5],[1143,1185.5],[1099,1160.5],[1165,1185.5],[1121,1135],[1143,1135],[1099,1210],[1165,1210]];

// ---------- GLSL ----------
const HASH=`float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 h22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),u.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x),u.y);}`;
// Site influence (friendly glow / Parasite creep) is evaluated per vertex (4 m apart near the player) and interpolated,
// so the fragment shader never loops over the site table.
const TERRAIN_VS=`uniform vec4 uSite[8];varying vec2 vW;varying vec3 vN;varying vec3 vC;varying float vY;varying float vD;varying vec4 vSite;
#include <common>
#include <fog_pars_vertex>
void main(){vW=uv*24.;vN=normal;vC=color;vY=position.y;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;vD=-mvPosition.z;
 float ff=0.,fs=0.,fd=1e4,bl=0.;for(int i=0;i<8;i++){vec4 s=uSite[i];if(s.z<=0.)continue;float d=length(vW-s.xy);if(d>s.z)continue;float f=1.-d/s.z;f*=f;if(s.w>0.){ff+=f*s.w;if(f>fs){fs=f;fd=d;}}else bl=max(bl,f);}
 vSite=vec4(ff,fs,fd,bl);
#include <fog_vertex>
}`;
// Regolith detail comes from one tileable texture (R crater height, G/B its gradient, A value noise) sampled at 2-3
// rotated scales: ~3 fetches instead of hundreds of hash ops per pixel (measured ~5x cheaper in software GL).
const TERRAIN_FS=`uniform vec3 uSunDir,uSunCol,uRimDir,uRimCol,uAmbUp,uAmbDn;uniform float uTime,uHigh;uniform sampler2D uDetail;
varying vec2 vW;varying vec3 vN;varying vec3 vC;varying float vY;varying float vD;varying vec4 vSite;
#include <common>
#include <fog_pars_fragment>
float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float hexEdge(vec2 p){const vec2 r=vec2(1.,1.7320508);vec2 h=r*.5;vec2 a=mod(p,r)-h;vec2 b=mod(p-h,r)-h;vec2 g=dot(a,a)<dot(b,b)?a:b;vec2 q=abs(g);return .5-max(dot(q,vec2(.5,.8660254)),q.x);}
// Quality is a uniform (one program for HIGH and LOW, so every branch is compiled everywhere). Texture lookups stay in
// uniform control flow (no implicit-derivative fetches inside per-pixel branches).
void main(){vec3 c=vC;float terra=smoothstep(.03,.08,c.g-max(c.r,c.b));float massif=smoothstep(.0,.06,c.b-c.r);bool hi=uHigh>.5;
 float lod=clamp(1.-vD/320.,0.,1.),lod2=clamp(1.-vD/1500.,0.,1.);
 vec4 d1=texture2D(uDetail,vW*(1./96.));float h1=d1.r-.5;vec2 grad=(d1.gb-.5)*.9;float rim=max(h1,0.)*1.6,bowl=max(-h1,0.)*1.5,tone=.7+.42*d1.a,na=d1.a,va=d1.a,vb=.5,st=.5;
 if(hi){vec4 d2=texture2D(uDetail,vec2(vW.y,-vW.x)*(1./29.)+.31),d3=texture2D(uDetail,vW*(1./8.7)+.67);float h2=(d2.r-.5)*lod2,h3=(d3.r-.5)*lod;
  grad+=vec2(-(d2.b-.5),d2.g-.5)*1.25*lod2+(d3.gb-.5)*1.4*lod;rim+=max(h2,0.)*1.8+max(h3,0.)*1.6;bowl+=max(-h2,0.)*1.3+max(-h3,0.)*1.2;tone+=.24*(d2.a-.5)+.16*(d3.a-.5)*lod;na=d2.a*.62+d1.a*.38;
  va=texture2D(uDetail,vW*(1./73.)+.13).a;vb=texture2D(uDetail,vW*(1./24.)+.71).a;st=texture2D(uDetail,vec2(vY*.032,(vW.x+vW.y)*.0018)).a;}
 vec3 rego=mix(vec3(.074,.078,.088),vec3(.055,.064,.082),massif)*tone;
 vec3 N=normalize(vN+vec3(-grad.x,0.,-grad.y));float steep=smoothstep(.3,.62,1.-N.y);
 if(hi)rego=mix(rego,rego*(.55+.5*st),steep);rego*=(1.-.32*min(bowl,1.))*(1.+.6*min(rim,1.));rego*=1.-.38*terra;
 vec3 em=vec3(0.);if(terra>0.){float lp=smoothstep(.5,.74,na)*terra,speck=0.;if(hi)speck=step(.84,h12(floor(vW*1.6)))*lp*(1.-smoothstep(.14,.3,length(fract(vW*1.6)-.5)));em=vec3(.0,.62,.5)*(lp*.12+speck*.45)*(.45+.55*lod);}
 if(vSite.x>.002){float line=0.;if(hi){float he=hexEdge(vW/6.);line=1.-smoothstep(0.,.02+.12*(1.-lod),he);}
  float ring=smoothstep(.93,1.,fract(vSite.z/22.-uTime*.08));em+=vec3(.05,.72,1.)*(line*.15*vSite.x+ring*.13*vSite.y+.035*vSite.x);}
 float blight=vSite.w;
 if(blight>0.){float vein=1.-smoothstep(0.,.08,abs(va*2.-1.));if(hi)vein+=(1.-smoothstep(0.,.06,abs(vb*2.-1.)))*.5;
  rego=mix(rego,rego*vec3(.75,.45,.85),blight);em+=vec3(1.,.08,.62)*vein*blight*.5*(.7+.3*sin(uTime*2.3-dot(vW,vec2(.05))));}
 float ndl=max(dot(N,uSunDir),0.);vec3 light=uSunCol*ndl+mix(uAmbDn,uAmbUp,N.y*.5+.5)+uRimCol*max(dot(N,uRimDir),0.)*.7;
 vec3 col=rego*light+em+uRimCol*min(rim,1.)*.03;if(hi)col+=(h12(gl_FragCoord.xy)-.5)/255.;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
const SOLID_VS=`attribute vec4 aCol;uniform vec4 uSite[8];uniform vec2 uOrigin;uniform vec3 uRimCol;uniform float uHigh;
varying vec3 vN;varying vec3 vV;varying vec4 vCol;varying vec3 vRim;varying vec3 vWP;
#include <common>
#include <fog_pars_vertex>
float hv(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
void main(){
#include <beginnormal_vertex>
#include <defaultnormal_vertex>
#include <begin_vertex>
#include <project_vertex>
#include <fog_vertex>
 vN=transformedNormal;vV=-mvPosition.xyz;vCol=aCol;vec4 wp=vec4(transformed,1.);
#ifdef USE_INSTANCING
 wp=instanceMatrix*wp;vec2 io=(modelMatrix*vec4(instanceMatrix[3].xyz,1.)).xz+uOrigin;vCol.rgb*=.75+.5*hv(floor(io*4.));
#endif
 wp=modelMatrix*wp;vWP=wp.xyz;vec3 rc=uRimCol*2.2;
 // HIGH tints each vertex's rim by the nearest friendly / Parasite site; LOW keeps the neutral rim (no per-vertex loop).
 if(uHigh>.5){vec2 w=wp.xz+uOrigin;float best=0.;for(int i=0;i<8;i++){vec4 s=uSite[i];if(s.z<=0.)continue;float f=1.-smoothstep(s.z*.6,s.z*1.25,length(w-s.xy));if(f>best){best=f;rc=mix(uRimCol*2.2,s.w>0.?vec3(.06,.62,.8):vec3(.85,.05,.55),f);}}}
 vRim=rc;}`;
const SOLID_FS=`uniform vec3 uSunCol,uAmbUp,uAmbDn,uSunV,uRimV,uUpV;uniform float uTime,uGlow,uHigh;
varying vec3 vN;varying vec3 vV;varying vec4 vCol;varying vec3 vRim;varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
void main(){vec3 N=normalize(vN),L=uSunV,R=uRimV,UP=uUpV; // view-space light directions, set once per frame
 vec3 base=vCol.rgb;float ndl=max(dot(N,L),0.);vec3 lit=base*(uSunCol*ndl+mix(uAmbDn,uAmbUp,dot(N,UP)*.5+.5));float rl=max(dot(N,R),0.);lit+=base*vRim*rl*.5;
 if(uHigh>.5){vec3 V=normalize(vV);float fr=pow(1.-max(dot(N,V),0.),3.);lit+=vRim*fr*(.25+.75*rl)*.45;vec3 H=normalize(L+V);lit+=uSunCol*pow(max(dot(N,H),0.),56.)*.16;}
 float a=vCol.a,em=clamp(a>1.?a-1.:a,0.,1.);float pulse=a>1.?.5+.5*sin(uTime*3.+dot(vWP,vec3(.37,.61,.23))):1.;
 vec3 col=mix(lit,base*uGlow*(.45+.55*pulse),em);gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
// Billboards (aBill.z = 1) expand in view space by aBill.xy × the object's scale, so pooled effects scale with the mesh.
const FX_VS=`attribute vec4 aCol;attribute vec3 aBill;uniform vec3 uKind[4];varying vec4 vCol;varying vec2 vUv;
#include <common>
#include <fog_pars_vertex>
void main(){vUv=uv;vCol=aCol;vec4 mvPosition=vec4(position*(1.-aBill.z),1.);float bs=length(modelMatrix[0].xyz);
#ifdef USE_INSTANCING
 mvPosition=instanceMatrix*mvPosition;bs*=length(instanceMatrix[0].xyz);float k=instanceMatrix[2].z;vCol.rgb*=k<1.5?uKind[0]:k<2.5?uKind[1]:k<3.5?uKind[2]:uKind[3];
#endif
 mvPosition=modelViewMatrix*mvPosition;mvPosition.xy+=aBill.xy*bs;mvPosition.z+=length(aBill.xy)*bs*.55;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
const FX_FS=`uniform sampler2D uMap;uniform float uFade;varying vec4 vCol;varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
void main(){vec4 t=texture2D(uMap,vUv);vec3 e=vCol.rgb*t.r*uFade;float o=vCol.a*t.g*uFade;
#ifdef USE_FOG
 float f=1.-smoothstep(fogNear,fogFar,vFogDepth);e*=f;o*=f;
#endif
 gl_FragColor=vec4(e,o);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const SKY_VS=`attribute vec3 aBill;attribute vec4 aCol;uniform vec2 uViewport;uniform float uEarthSize;uniform vec3 uEarthDir;
varying vec3 vDir;varying vec4 vCol;varying vec2 vQ;varying float vKind;
void main(){vKind=aBill.z;vCol=aCol;vQ=aBill.xy;vec3 d=aBill.z>1.5?uEarthDir:position;vec3 vd=mat3(viewMatrix)*d;
 if(aBill.z>1.5)vd+=vec3(aBill.xy*uEarthSize*1.7,0.);vDir=(vec4(vd,0.)*viewMatrix).xyz;vec4 p=projectionMatrix*vec4(vd,1.);
 if(aBill.z>.5&&aBill.z<1.5)p.xy+=aBill.xy*aCol.a*2.*p.w/uViewport;gl_Position=p.xyww;}`;
const SKY_FS=`uniform vec3 uZenith,uBandA,uBandB,uFogC,uEarthL;uniform sampler2D uEarth;uniform float uSpin;
varying vec3 vDir;varying vec4 vCol;varying vec2 vQ;varying float vKind;
vec3 sky(vec3 d){float h=d.y;float band=exp(-abs(h-.012)*85.);float glow=exp(-max(h,0.)*9.);float hi=exp(-max(h,0.)*2.6);
 vec3 c=uZenith+uBandB*(glow*.55+hi*.12)+uBandA*band;return mix(c,uFogC,smoothstep(.002,-.03,h));}
void main(){vec3 d=normalize(vDir);vec3 col;
 if(vKind<.5){col=sky(d)+vCol.rgb;}
 else if(vKind<1.5){float r2=dot(vQ,vQ);float core=exp(-r2*6.5);float cr=vCol.a>4.?(exp(-abs(vQ.x)*18.)*exp(-vQ.y*vQ.y*2.5)+exp(-abs(vQ.y)*18.)*exp(-vQ.x*vQ.x*2.5))*.55:0.;col=sky(d)+vCol.rgb*(core+cr);}
 else{vec2 q=vQ*1.7;float r=length(q);vec3 L=normalize(uEarthL);float side=dot(q/max(r,1e-4),normalize(L.xy))*.5+.5;float o=max(r-1.,0.);
  vec3 halo=vec3(.12,.55,1.)*(exp(-o*6.)*(.22+.85*side)*.7+exp(-o*30.)*.55*(.4+.6*side));col=sky(d)+halo;
  if(r<1.){vec3 n=vec3(q,sqrt(1.-r*r));vec3 m=vec3(n.x,.92*n.y-.39*n.z,.39*n.y+.92*n.z);float lon=atan(m.x,m.z)+uSpin;float lat=asin(clamp(m.y,-1.,1.));
   vec3 tx=texture2D(uEarth,vec2(lon*.1591549+.5,lat*.3183099+.5)).rgb;float ndl=dot(n,L);float day=smoothstep(-.12,.32,ndl);
   vec3 s=tx*(.06+1.75*max(ndl,0.))*day+vec3(.0015,.004,.012)*(1.-day);s+=vec3(.16,.58,1.)*pow(1.-n.z,2.3)*(.1+1.3*smoothstep(-.35,.6,ndl));
   float aa=clamp((1.-r)/max(fwidth(r)*1.5,1e-4),0.,1.);col=mix(col,s,aa);}}
 col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
// Energy shell: additive fresnel rim + moving hex scan, transparent, never writes depth.
const SHIELD_VS=`varying vec3 vN;varying vec3 vV;varying vec3 vP;
void main(){vP=position;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const SHIELD_FS=`uniform vec3 uColor;uniform float uTime,uOpacity,uHex;varying vec3 vN;varying vec3 vV;varying vec3 vP;
void main(){float fr=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.4);vec2 p=vec2(atan(vP.z,vP.x)*3.2,vP.y*5.5);
 vec2 r=vec2(1.,1.7320508),h=r*.5,a=mod(p,r)-h,b=mod(p-h,r)-h,g=dot(a,a)<dot(b,b)?a:b,q=abs(g);float edge=.5-max(dot(q,vec2(.5,.8660254)),q.x);
 float hex=1.-smoothstep(0.,.06,edge);float scan=smoothstep(.85,1.,fract(vP.y*.6-uTime*.6));
 vec3 col=uColor*(fr*.9+hex*(.12*uHex+.5*fr)+scan*.25*fr)*uOpacity;gl_FragColor=vec4(col,0.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

// ---------- mask atlas layout (R = glow mask, G = contact-shadow mask) ----------
const AT={};
function region(name,x,y,w,h){x+=2;y+=2;w-=4;h-=4;AT[name]=[x/512,1-(y+h)/512,(x+w)/512,1-y/512];}
region('SOLID',0,0,64,64);region('BEAM',0,64,64,192);region('BLOB',64,0,128,128);region('RING',192,0,128,128);region('HEX',320,0,128,128);
region('DASH',64,128,128,128);region('ICON',192,128,128,128);region('GRID',320,128,128,128);region('SPARK',448,0,64,64);region('FLARE',448,64,64,64);
const SIGNS=['HAB 01','HAB 02','HAB 03','HAB 04','HAB 05','HAB 06','HAB 07','HAB 08','HAB 09','SUPPLY','O2 01','O2 02','O2 03','SOLAR','HUB','DEPOT',
 'COMMAND','HANGAR','REACTOR','RADAR','UPLINK','VAULT','DEFENSE','CORRIDOR','BUILD SITE','BASE I','BASE II','BASE III','BASE IV','BASE V','HOSTILE','SECURED'];
SIGNS.forEach((s,i)=>region('S'+i,(i%4)*128,256+Math.floor(i/4)*32,128,32));
const SIGN=Object.fromEntries(SIGNS.map((s,i)=>[s,'S'+i]));
function makeAtlas(T,size){const cv=document.createElement('canvas');cv.width=cv.height=size;const x=cv.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,size,size);x.scale(size/512,size/512);
 const rad=(cx,cy,stops,col,r=62)=>{const g=x.createRadialGradient(cx,cy,0,cx,cy,r);for(const [o,v] of stops)g.addColorStop(o,col(v));x.fillStyle=g;x.fillRect(cx-r-2,cy-r-2,2*r+4,2*r+4);};
 x.fillStyle='#ffff00';x.fillRect(0,0,64,64);
 let g=x.createLinearGradient(0,252,0,68);g.addColorStop(0,'#ff0000');g.addColorStop(.55,'#600000');g.addColorStop(1,'#000');x.fillStyle=g;x.fillRect(6,68,52,184);
 x.fillStyle='rgba(0,0,0,.35)';for(let y=70;y<252;y+=6)x.fillRect(6,y,52,2);
 rad(128,64,[[0,255],[.22,200],[.5,80],[.78,18],[1,0]],v=>'rgb('+v+','+v+',0)');
 rad(256,64,[[0,0],[.5,10],[.7,80],[.8,255],[.86,110],[.95,12],[1,0]],v=>'rgb('+v+',0,0)');
 x.save();x.translate(384,64);x.lineJoin='round';const hex=r=>{x.beginPath();for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3;x.lineTo(Math.sin(a)*r,Math.cos(a)*r);}x.closePath();};
 hex(58);x.fillStyle='rgb(40,0,0)';x.fill();x.lineWidth=5;x.strokeStyle='#ff0000';x.stroke();hex(48);x.lineWidth=2;x.strokeStyle='rgb(170,0,0)';x.stroke();
 x.strokeStyle='rgb(90,0,0)';x.lineWidth=1.5;for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3;x.beginPath();x.moveTo(Math.sin(a)*14,Math.cos(a)*14);x.lineTo(Math.sin(a)*48,Math.cos(a)*48);x.stroke();}
 x.beginPath();x.arc(0,0,14,0,TAU);x.lineWidth=3;x.strokeStyle='#ff0000';x.stroke();x.restore();
 x.save();x.translate(128,192);x.setLineDash([11,7]);x.lineWidth=4;x.strokeStyle='#ff0000';x.beginPath();x.arc(0,0,59,0,TAU);x.stroke();x.setLineDash([]);x.lineWidth=1.5;x.strokeStyle='rgb(120,0,0)';x.beginPath();x.arc(0,0,53,0,TAU);x.stroke();x.restore();
 x.save();x.translate(256,192);x.strokeStyle='#ff0000';x.lineWidth=5;x.lineJoin='round';x.strokeRect(-30,-22,60,48);x.beginPath();x.moveTo(-30,-8);x.lineTo(30,-8);x.stroke();x.fillStyle='#ff0000';x.fillRect(-5,-2,10,22);x.fillRect(-13,6,26,8);
 x.lineWidth=3;x.beginPath();for(const [a,b,c,d] of [[-44,-44,-44,-32],[-44,-44,-32,-44],[44,44,44,32],[44,44,32,44],[44,-44,32,-44],[44,-44,44,-32],[-44,44,-32,44],[-44,44,-44,32]]){x.moveTo(a,b);x.lineTo(c,d);}x.stroke();x.restore();
 x.strokeStyle='#ff0000';x.lineWidth=2;for(let i=0;i<=8;i++){x.beginPath();x.moveTo(324+i*15,132);x.lineTo(324+i*15,252);x.stroke();x.beginPath();x.moveTo(324,132+i*15);x.lineTo(444,132+i*15);x.stroke();}
 // SPARK: four-point star glint; FLARE: soft core + ring (explosions, muzzle flashes)
 x.save();x.translate(480,32);for(const [w,h] of [[30,3],[3,30]]){const gg=x.createRadialGradient(0,0,0,0,0,30);gg.addColorStop(0,'#ff0000');gg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gg;x.fillRect(-w,-h,2*w,2*h);}rad(0,0,[[0,255],[.4,120],[1,0]],v=>'rgb('+v+',0,0)',14);x.restore();
 rad(480,96,[[0,255],[.25,190],[.55,60],[.72,140],[.8,40],[1,0]],v=>'rgb('+v+','+Math.round(v*.5)+',0)',30);
 x.textAlign='center';x.textBaseline='middle';SIGNS.forEach((s,i)=>{const cx=(i%4)*128,cy=256+Math.floor(i/4)*32;x.strokeStyle='rgb(150,0,0)';x.lineWidth=2;x.strokeRect(cx+5,cy+4,118,24);x.fillStyle='#ff0000';x.fillRect(cx+5,cy+4,5,24);x.fillRect(cx+118,cy+4,5,24);
  x.font="700 "+(s.length>8?16:19)+"px 'Chakra Petch',sans-serif";x.fillText(s,cx+64,cy+17);});
 const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.generateMipmaps=false;t.minFilter=T.LinearFilter;return t;}
function makeDetail(T,N){const H=new Float32Array(N*N),A=new Float32Array(N*N);let seed=7403;const rnd=()=>(seed=(Math.imul(seed,1664525)+1013904223)|0,(seed>>>0)/4294967296);
 // Tileable crater field: bowls with raised rims, wrapped across the tile edges.
 for(let k=0;k<34;k++){const cx=rnd()*N,cz=rnd()*N,r=N*(.018+.085*Math.pow(rnd(),1.7)),depth=.55+.45*rnd(),R=Math.ceil(r*1.6);
  for(let j=-R;j<=R;j++)for(let i=-R;i<=R;i++){const d=Math.hypot(i,j)/r;if(d>1.6)continue;const x=((Math.floor(cx+i)%N)+N)%N,z=((Math.floor(cz+j)%N)+N)%N,bowl=d<1?-(1-d*d)*depth:0,rim=.42*depth*Math.exp(-Math.pow((d-1)/.2,2));H[z*N+x]+=bowl+rim;}}
 // Tileable value noise (two periodic octaves) for tone, strata, lichen and veins.
 const lat=(P,s)=>{const g=Array.from({length:P*P},()=>rnd());return (x,z)=>{const fx=x/N*P,fz=z/N*P,ix=Math.floor(fx),iz=Math.floor(fz),u=fx-ix,v=fz-iz,su=u*u*(3-2*u),sv=v*v*(3-2*v),G=(a,b)=>g[((b%P+P)%P)*P+((a%P+P)%P)];
  return (G(ix,iz)*(1-su)+G(ix+1,iz)*su)*(1-sv)+(G(ix,iz+1)*(1-su)+G(ix+1,iz+1)*su)*sv;};};
 const n1=lat(8),n2=lat(24);for(let z=0;z<N;z++)for(let x=0;x<N;x++)A[z*N+x]=n1(x,z)*.65+n2(x,z)*.35;
 const D=new Uint8Array(N*N*4),q=v=>Math.max(0,Math.min(255,Math.round(v*255)));
 for(let z=0;z<N;z++)for(let x=0;x<N;x++){const k=z*N+x,h=H[k],gx=(H[z*N+(x+1)%N]-H[z*N+(x+N-1)%N])*N/32,gz=(H[((z+1)%N)*N+x]-H[((z+N-1)%N)*N+x])*N/32;D[k*4]=q(.5+h*.42);D[k*4+1]=q(.5+gx*.5);D[k*4+2]=q(.5+gz*.5);D[k*4+3]=q(A[k]);}
 const t=new T.DataTexture(D,N,N,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=N>128?T.LinearMipmapLinearFilter:T.LinearMipmapNearestFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}
function makeEarth(T,w,h){const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d'),img=x.createImageData(w,h),D=img.data;
 for(let j=0;j<h;j++){const lat=(.5-j/(h-1))*Math.PI;for(let i=0;i<w;i++){const lon=i/w*TAU-Math.PI,px=Math.cos(lat)*Math.sin(lon),py=Math.sin(lat),pz=Math.cos(lat)*Math.cos(lon);
  const n=fbm3(px*1.7+5,py*1.7,pz*1.7,5),cl=fbm3(px*3.1+9,py*3.6,pz*3.1,4);let r,g,b;
  if(n>.53){const k=Math.min(1,(n-.53)*5);r=50+120*k;g=95+55*k;b=55+30*k;}else{const k=clamp01((n-.4)/.13);r=6+18*k;g=34+70*k;b=96+80*k;}
  if(Math.abs(py)>.94){r=g=b=215;}const c=clamp01((cl-.52)*2.8);r+=(240-r)*c;g+=(246-g)*c;b+=(255-b)*c;const o=(j*w+i)*4;D[o]=r;D[o+1]=g;D[o+2]=b;D[o+3]=255;}}
 x.putImageData(img,0,0);const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;t.generateMipmaps=false;t.minFilter=T.LinearFilter;return t;}

function create(T,opts={}){
 // software: a CPU rasterizer (SwiftShader/llvmpipe) was detected; it takes the LOW shading path at runtime.
 const W=root.ConquestWorld,C=root.ConquestCombat,software=!!opts.software,low=!!opts.low||software,high=!low,F=footprints(W,C),ground=(x,z)=>W.groundAt(x,z);
 const lin=h=>new T.Color(h),E=(h,i=1)=>{const c=new T.Color(h);return [c.r*i,c.g*i,c.b*i];},V3=(x,y,z)=>new T.Vector3(x,y,z);
 const _v=new T.Vector3(),_w=new T.Vector3(),_p=new T.Vector3(),_s=new T.Vector3(),_q=new T.Quaternion(),_e=new T.Euler(),_nm=new T.Matrix4(),_t=new T.Matrix4();
 const M=(x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>{_e.set(rx,ry,rz);_q.setFromEuler(_e);return new T.Matrix4().compose(_p.set(x,y,z),_q,_s.set(sx,sy,sz));};
 const MR=(x,z,a,ly,lr,tilt,sx,sy,sz)=>{const m=new T.Matrix4().makeTranslation(x,0,z);m.multiply(_t.makeRotationY(a));m.multiply(_t.makeTranslation(0,ly,lr));m.multiply(_t.makeRotationX(tilt));m.multiply(_t.makeScale(sx,sy,sz));return m;};
 const MD=(a,b,r)=>{const d=_w.subVectors(b,a),len=d.length()||1e-3;_q.setFromUnitVectors(_p.set(0,1,0),d.multiplyScalar(1/len));return new T.Matrix4().compose(a.clone(),_q,_s.set(r,len,r));};
 const MDc=(a,b,t)=>{const d=_w.subVectors(b,a),len=d.length()||1e-3;_q.setFromUnitVectors(_p.set(0,1,0),d.multiplyScalar(1/len));return new T.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),_q,_s.set(t,len,t));};
 const K={dark:lin(0x222932),dark2:lin(0x2e3844),mid:lin(0x4a5664),panelA:lin(0x9ba8b4),panelB:lin(0xc2ccd5),roof:lin(0x76838f),
  cyan:lin(0x22e6ff),ice:lin(0xa8f8ff),teal:lin(0x2dffc4),amber:lin(0xffb347),gold:lin(0xffd36b),red:lin(0xff3048),navy:lin(0x0d1729),violet:lin(0xa07bff),
  chitin:lin(0x2b1531),chitinD:lin(0x150a19),wall:lin(0x2c2833),wallTop:lin(0x4a4352),mag:lin(0xff2bd6),magHot:lin(0xff7ae8)};
 const flat=g=>{const n=g.index?g.toNonIndexed():g;n.computeVertexNormals();return n;};
 function blob(detail,amp,seed){const g=new T.IcosahedronGeometry(1,detail),p=g.attributes.position,cache=new Map();
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=Math.round(x*997)+','+Math.round(y*997)+','+Math.round(z*997);let f=cache.get(k);if(f===undefined){f=1-amp+2*amp*hash3(Math.round(x*97)+seed,Math.round(y*97),Math.round(z*97));cache.set(k,f);}
   let yy=y*f;if(yy<-.45)yy=-.45+(yy+.45)*.25;p.setXYZ(i,x*f,yy,z*f);}
  let mx=0,my=0,mz=0;for(let i=0;i<p.count;i++){mx=Math.max(mx,Math.abs(p.getX(i)));my=Math.max(my,p.getY(i));mz=Math.max(mz,Math.abs(p.getZ(i)));}g.scale(1/mx,1/my,1/mz);g.computeVertexNormals();return g;}
 const gradC=(y0,y1,c0,c1,c2)=>v=>{const t=clamp01((v.y-y0)/(y1-y0));if(t<.2)return [c0[0],c0[1],c0[2],0];if(t<.62){const k=(t-.2)/.42;return [c0[0]+(c1[0]-c0[0])*k,c0[1]+(c1[1]-c0[1])*k,c0[2]+(c1[2]-c0[2])*k,.2+.4*k];}
  const k=(t-.62)/.38;return [c1[0]+(c2[0]-c1[0])*k,c1[1]+(c2[1]-c1[1])*k,c1[2]+(c2[2]-c1[2])*k,.6+.4*k];};
 const CYC=[[.008,.045,.06],[.03,.4,.55],[.5,1,1]],MAGC=[[.03,.005,.035],[.5,.02,.4],[1,.5,.95]];

 // ---------- shared state: uniforms, geometry, textures, the fixed material set ----------
 const sunDir=V3(-.55,.5,.67).normalize(),rimDir=V3(.62,.32,-.72).normalize();
 const U={uTime:{value:0},uSunDir:{value:sunDir},uSunCol:{value:lin(0xe4ecff).multiplyScalar(2.9/Math.PI)},uRimDir:{value:rimDir},uRimCol:{value:lin(0x52c6ff).multiplyScalar(1.15/Math.PI)},
  uAmbUp:{value:lin(0x3a5a9c).multiplyScalar(1.5/Math.PI)},uAmbDn:{value:lin(0x16131f).multiplyScalar(1.5/Math.PI)},uSite:{value:Array.from({length:8},()=>new T.Vector4(0,0,0,0))},
  uOrigin:{value:new T.Vector2()},uGlow:{value:2.3},uHigh:{value:high?1:0},uSunV:{value:sunDir.clone()},uRimV:{value:rimDir.clone()},uUpV:{value:V3(0,1,0)},uViewport:{value:new T.Vector2(800,800)},uFade:{value:1},
  fogColor:{value:new T.Color(0x06070f)},fogNear:{value:900},fogFar:{value:2600},fogDensity:{value:.00025}};
 const G={box:new T.BoxGeometry(1,1,1),hex:flat(new T.CylinderGeometry(1,1,1,6,1,false,Math.PI/6)).translate(0,.5,0),oct:flat(new T.CylinderGeometry(1,1,1,8,1,false,Math.PI/8)).translate(0,.5,0),
  cyl:new T.CylinderGeometry(1,1,1,16,1).translate(0,.5,0),cylC:new T.CylinderGeometry(1,1,1,10,1),cone5:flat(new T.ConeGeometry(1,1,5)).translate(0,.5,0),cone6:flat(new T.ConeGeometry(1,1,6)).translate(0,.5,0),
  torus:new T.TorusGeometry(1,.065,6,40),ico:new T.IcosahedronGeometry(1,2),octa:new T.OctahedronGeometry(1,0),blob1:blob(1,.13,11),blob2:blob(2,.06,23),rock:blob(1,.17,5),
  shard:flat(new T.LatheGeometry([new T.Vector2(0,-.02),new T.Vector2(.3,0),new T.Vector2(.34,.68),new T.Vector2(0,1)],6)),
  pod:new T.LatheGeometry([[0,0],[.1,0],[.12,.3],[.3,.5],[.34,.66],[.26,.8],[.1,.9],[0,.92]].map(([r,y])=>new T.Vector2(r,y)),8),
  dome:new T.SphereGeometry(1,high?28:18,high?14:9,0,TAU,0,Math.PI/2)};
 const fr={};G.hexF=r=>fr['h'+r]||(fr['h'+r]=flat(new T.CylinderGeometry(r,1,1,6,1,false,Math.PI/6)).translate(0,.5,0));
 G.octF=r=>fr['o'+r]||(fr['o'+r]=flat(new T.CylinderGeometry(r,1,1,8,1,false,Math.PI/8)).translate(0,.5,0));G.cylF=r=>fr['c'+r]||(fr['c'+r]=new T.CylinderGeometry(r,1,1,20,1).translate(0,.5,0));
 const tex={atlas:makeAtlas(T,high?512:256),earth:makeEarth(T,high?256:128,high?128:64),detail:makeDetail(T,high?256:128)};
 const mk=(vs,fs,extra,o)=>{const m=new T.ShaderMaterial(Object.assign({uniforms:Object.assign({},U,extra||{}),vertexShader:vs,fragmentShader:fs,fog:true},o||{}));m.userData.motionSkip=true;m.userData.conquestStyle=true;return m;};
 const MAT={terrain:mk(TERRAIN_VS,TERRAIN_FS,{uDetail:{value:tex.detail}},{vertexColors:true}),solid:mk(SOLID_VS,SOLID_FS),
  fx:mk(FX_VS,FX_FS,{uMap:{value:tex.atlas},uKind:{value:[V3(.1,.68,1).multiplyScalar(.6),V3(.3,1,.5).multiplyScalar(.5),V3(.6,.95,1).multiplyScalar(.9),V3(1,.1,.7).multiplyScalar(.7)]}},
   {transparent:true,premultipliedAlpha:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-8}),
  sky:mk(SKY_VS,SKY_FS,{uEarth:{value:tex.earth},uEarthDir:{value:V3(.86,.15,.48).normalize()},uEarthSize:{value:.068},uEarthL:{value:V3(-.62,.34,.7).normalize()},uSpin:{value:2.2},
   uZenith:{value:V3(.0002,.0003,.0009)},uBandA:{value:V3(0,.2,.19)},uBandB:{value:V3(.045,.012,.11)},uFogC:{value:V3(.0018,.0021,.0048)}},{fog:false,depthWrite:false,side:T.DoubleSide})};
 const shieldMat=(color,opacity,hexK=1)=>{const m=new T.ShaderMaterial({uniforms:{uColor:{value:lin(color)},uTime:U.uTime,uOpacity:{value:opacity},uHex:{value:hexK}},vertexShader:SHIELD_VS,fragmentShader:SHIELD_FS,transparent:true,premultipliedAlpha:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});m.userData.motionSkip=true;m.userData.conquestStyle=true;return m;};
 MAT.shield=shieldMat(0x48d8ff,.85);MAT.field=shieldMat(0x2dd4ff,.32,.12);
 const S={id:'neon-frontline',version:1,low,high,software,T,U,MAT,G,AT,SIGN,K,tex,footprints:F,shared:[],ground};
 const keep=g=>{g.userData.hfShared=true;S.shared.push(g);return g;};
 for(const g of Object.values(G))if(g&&g.isBufferGeometry)keep(g);

 // ---------- builders: Bld = merged vertex-coloured solid draw; Fx = merged glow/decal draw ----------
 class Bld{constructor(){this.P=[];this.N=[];this.A=[];this.I=[];this.n=0;}
  add(geo,m,c,em=0,ao=null,grad=null){const P=geo.attributes.position,N=geo.attributes.normal,ix=geo.index;_nm.copy(m).invert().transpose();
   for(let i=0;i<P.count;i++){_v.fromBufferAttribute(P,i).applyMatrix4(m);this.P.push(_v.x,_v.y,_v.z);_w.fromBufferAttribute(N,i).transformDirection(_nm);this.N.push(_w.x,_w.y,_w.z);
    let r,g,b,a;if(grad){const o=grad(_v,P.getX(i),P.getY(i),P.getZ(i));r=o[0];g=o[1];b=o[2];a=o[3];}else{r=c.r;g=c.g;b=c.b;a=em;}
    if(ao&&a<.5){const k=.4+.6*clamp01((_v.y-ao[0])/ao[1]);r*=k;g*=k;b*=k;}this.A.push(r,g,b,a);}
   if(ix)for(let k=0;k<ix.count;k++)this.I.push(ix.getX(k)+this.n);else for(let k=0;k<P.count;k++)this.I.push(this.n+k);this.n+=P.count;return this;}
  box(x,y,z,w,h,d,c,em=0,ry=0,ao=null){return this.add(G.box,M(x,y,z,0,ry,0,w,h,d),c,em,ao);}
  seg(a,b,t,c,em=0){return this.add(G.box,MDc(a,b,t),c,em);}
  spike(a,b,r,c,em=0,geo){return this.add(geo||G.cone5,MD(a,b,r),c,em);}
  geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.P,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.N,3));g.setAttribute('aCol',new T.Float32BufferAttribute(this.A,4));g.setIndex(this.I);g.computeBoundingSphere();return g;}
  mesh(){return this.n?new T.Mesh(this.geometry(),MAT.solid):new T.Group();}}
 class Fx{constructor(){this.P=[];this.U=[];this.A=[];this.B=[];this.I=[];this.n=0;}
  v(x,y,z,u,v,e,o,bx=0,by=0,bz=0){this.P.push(x,y,z);this.U.push(u,v);this.A.push(e[0],e[1],e[2],o);this.B.push(bx,by,bz);return this.n++;}
  q4(a,b,c,d){this.I.push(a,b,c,a,c,d);}
  bill(x,y,z,s,r,e,o=0){if(software&&!this.keep)return;const a=this.v(x,y,z,r[0],r[1],e,o,-s,-s,1),b=this.v(x,y,z,r[2],r[1],e,o,s,-s,1),c=this.v(x,y,z,r[2],r[3],e,o,s,s,1),d=this.v(x,y,z,r[0],r[3],e,o,-s,s,1);this.q4(a,b,c,d);}
  quadV(x,y,z,w,h,ry,r,e,o=0){const cx=Math.cos(ry)*w/2,cz=-Math.sin(ry)*w/2;this.q4(this.v(x-cx,y-h/2,z-cz,r[0],r[1],e,o),this.v(x+cx,y-h/2,z+cz,r[2],r[1],e,o),this.v(x+cx,y+h/2,z+cz,r[2],r[3],e,o),this.v(x-cx,y+h/2,z-cz,r[0],r[3],e,o));}
  quad(p,r,e,o=0){this.q4(this.v(p[0].x,p[0].y,p[0].z,r[0],r[1],e,o),this.v(p[1].x,p[1].y,p[1].z,r[2],r[1],e,o),this.v(p[2].x,p[2].y,p[2].z,r[2],r[3],e,o),this.v(p[3].x,p[3].y,p[3].z,r[0],r[3],e,o));}
  flat(x,y,z,hw,hd,r,e,o=0){this.q4(this.v(x-hw,y,z-hd,r[0],r[1],e,o),this.v(x+hw,y,z-hd,r[2],r[1],e,o),this.v(x+hw,y,z+hd,r[2],r[3],e,o),this.v(x-hw,y,z+hd,r[0],r[3],e,o));}
  decal(cx,cz,hw,hd,rot,r,e,o,seg,lift){if(software)return;const cs=Math.cos(rot),sn=Math.sin(rot),base=this.n;
   for(let j=0;j<=seg;j++)for(let i=0;i<=seg;i++){const u=i/seg,v=j/seg,lx=(u*2-1)*hw,lz=(v*2-1)*hd,x=cx+lx*cs+lz*sn,z=cz-lx*sn+lz*cs;this.v(x,ground(x,z)+lift,z,r[0]+(r[2]-r[0])*u,r[1]+(r[3]-r[1])*v,e,o);}
   for(let j=0;j<seg;j++)for(let i=0;i<seg;i++){const a=base+j*(seg+1)+i;this.q4(a,a+1,a+seg+2,a+seg+1);}}
  band(x,z,y0,r0,r1,h,e0,e1,seg=16){const base=this.n,Sg=AT.SOLID,u=(Sg[0]+Sg[2])/2,v=(Sg[1]+Sg[3])/2;for(let k=0;k<=seg;k++){const a=k/seg*TAU,c=Math.cos(a),s=Math.sin(a);this.v(x+c*r0,y0,z+s*r0,u,v,e0,0);this.v(x+c*r1,y0+h,z+s*r1,u,v,e1,0);}
   for(let k=0;k<seg;k++){const a=base+k*2;this.q4(a,a+2,a+3,a+1);}}
  ringGlow(x,z,y,R,h,e,seg){const z0=[0,0,0];this.band(x,z,y-h/2,R,R,h/2,z0,e,seg);this.band(x,z,y,R,R,h/2,e,z0,seg);}
  geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.P,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.U,2));
   g.setAttribute('aCol',new T.Float32BufferAttribute(this.A,4));g.setAttribute('aBill',new T.Float32BufferAttribute(this.B,3));g.setIndex(this.I);g.computeBoundingSphere();return g;}
  mesh(){if(!this.n)return new T.Group();const m=new T.Mesh(this.geometry(),MAT.fx);m.renderOrder=2;return m;}}
 S.Bld=Bld;S.Fx=Fx;
 const pair=(Sb,X)=>{const g=new T.Group();g.add(Sb.mesh(),X.mesh());return g;};

 // ---------- instanced prop geometry (unit space) ----------
 const cr=new Bld();for(const [x,z,h,tx,tz,r] of [[0,0,1,0,0,.95],[.45,.12,.7,.38,-.2,.62],[-.42,.22,.62,-.32,.26,.56],[.12,-.48,.55,.14,.4,.5],[-.3,-.36,.46,-.28,-.3,.44],[.52,-.3,.38,.42,.3,.4]])cr.add(G.shard,M(x,-.04,z,tz*.6,0,-tx*.6,r,h,r),null,0,null,gradC(0,1,...CYC));
 const fu=new Bld();for(const [x,z,s] of [[0,0,1],[.5,.2,.72],[-.45,.3,.6],[.15,-.5,.66],[-.35,-.4,.45]])fu.add(G.pod,M(x,0,z,0,x*3,0,s,s,s),null,0,null,(v,lx,ly)=>ly<.3?[.012,.02,.03,0]:ly<.72?[.02,.015,.07,.15]:[.08,.9,.35,.75]);
 const rk=new Bld();rk.add(G.rock,new T.Matrix4(),null,0,null,v=>{const k=clamp01(v.y*.5+.5);return [.022+.042*k,.024+.045*k,.03+.052*k,0];});
 const rl=new Bld();rl.box(0,4.6,0,.22,9.2,.22,K.mid);rl.box(0,.25,0,.9,.5,.9,K.dark);for(const y of [3,6])rl.box(0,y,0,1.3,.08,.08,K.dark2);rl.add(G.cone6,M(.35,8.4,0,0,0,-1.1,.9,.35,.9),K.panelB);rl.box(0,9.35,0,.32,.32,.32,K.ice,1);rl.box(0,4.6,.12,.05,8.4,.03,K.cyan,1);
const billGeo=(r,col,o=0)=>{const X=new Fx();X.keep=true;X.bill(0,0,0,1,r,col,o);return keep(X.geometry());};
 const P={crystal:keep(cr.geometry()),fungus:keep(fu.geometry()),rock:keep(rk.geometry()),relay:keep(rl.geometry()),bill:billGeo(AT.BLOB,[1,1,1])};
 S.P=P;

 // ---------- sky + lights ----------
 S.environment=(scene,renderer)=>{
  if(renderer){renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=low?1.25:1.2;renderer.outputColorSpace=T.SRGBColorSpace;}
  scene.background=new T.Color(0);scene.fog=new T.Fog(0x06070f,900,2600);
  const hemi=new T.HemisphereLight(0x3a5a9c,0x16131f,1.5),sun=new T.DirectionalLight(0xe4ecff,2.9),rim=new T.DirectionalLight(0x52c6ff,1.25);sun.position.copy(sunDir).multiplyScalar(500);rim.position.copy(rimDir).multiplyScalar(500);scene.add(hemi,sun,rim);
  const Pp=[],B=[],A=[],I=[],dome=new T.SphereGeometry(1,high?48:32,high?24:16),dp=dome.attributes.position;
  for(let i=0;i<dp.count;i++){const x=dp.getX(i),y=dp.getY(i),z=dp.getZ(i);Pp.push(x,y,z);B.push(0,0,0);const gal=Math.exp(-Math.pow(x*.35+y*.55-z*.76,2)*7),nb=Math.max(0,fbm3(x*2.3+3,y*2.3,z*2.3,4)-.44),up=clamp01(y*3+.1);
   A.push((.02*nb+.0035*gal)*up,(.006*nb+.003*gal)*up,(.05*nb+.007*gal)*up,0);}
  if(!software)for(let k=0;k<dome.index.count;k++)I.push(dome.index.getX(k));dome.dispose();let n=dp.count,seed=1337;const rnd=()=>(seed=(Math.imul(seed,1664525)+1013904223)|0,(seed>>>0)/4294967296);
  for(let s=0,count=high?950:380;s<count;s++){let x,y,z,l;do{x=rnd()*2-1;y=rnd()*2-1;z=rnd()*2-1;l=x*x+y*y+z*z;}while(l>1||l<.01);l=Math.sqrt(l);x/=l;y/=l;z/=l;if(y<.04){y=.04+Math.abs(y)*.9;const k=Math.hypot(x,y,z);x/=k;y/=k;z/=k;}
   const big=rnd()<.035,sz=big?4.6+rnd()*2.6:1.05+rnd()*rnd()*2.3,b=big?1.7:.3+rnd()*rnd()*1.35,t=rnd(),c=t<.2?[.72,.86,1.25]:t<.3?[1.2,.92,.72]:[1,1,1];
   for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){Pp.push(x,y,z);B.push(cx,cy,1);A.push(c[0]*b,c[1]*b,c[2]*b,sz);}I.push(n,n+1,n+2,n,n+2,n+3);n+=4;}
  for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){Pp.push(0,1,0);B.push(cx,cy,2);A.push(0,0,0,0);}I.push(n,n+1,n+2,n,n+2,n+3);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Pp,3));g.setAttribute('aBill',new T.Float32BufferAttribute(B,3));g.setAttribute('aCol',new T.Float32BufferAttribute(A,4));g.setIndex(I);keep(g);
  const sky=new T.Mesh(g,MAT.sky);sky.frustumCulled=false;sky.renderOrder=1000;/* after opaque terrain/structures: the depth test culls covered sky pixels */sky.name='cq-style-sky';scene.add(sky);return {sky,lights:[hemi,sun,rim]};};

 // ---------- props (per fine terrain chunk; InstancedMesh, chunk-local positions) ----------
 S.props=(items,cx,cz)=>{const ox=cx*128,oz=cz*128,g=new T.Group(),trees=items.filter(p=>p.kind==='tree'),rocks=items.filter(p=>p.kind==='rock'&&p.variant>.45),relays=items.filter(p=>p.kind==='relay');
  const crystals=high?trees.filter(p=>p.variant>=.4):trees,fungus=high?trees.filter(p=>p.variant<.4):[],halos=[];
  const inst=(geo,list,fn,mat)=>{if(!list.length)return;const im=new T.InstancedMesh(geo,mat||MAT.solid,list.length);list.forEach((p,i)=>im.setMatrixAt(i,fn(p)));im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();g.add(im);};
  // Trees are not solid in the sim: their replacements stay low (≤1.45 m) and read as passable growths.
  inst(P.crystal,crystals,p=>{const sh=.42+.36*p.size,sv=Math.min(1.45,.5+.32*p.size);halos.push([p.x-ox,p.y+sv*.62,p.z-oz,sh*1.25,1]);return M(p.x-ox,p.y-.12,p.z-oz,0,p.variant*40,0,sh,sv,sh);});
  inst(P.fungus,fungus,p=>{const sh=.5+.4*p.size,sv=Math.min(1.3,.55+.26*p.size);halos.push([p.x-ox,p.y+sv*.75,p.z-oz,sh*1.1,2]);return M(p.x-ox,p.y-.06,p.z-oz,0,p.variant*40,0,sh,sv,sh);});
  // Rocks keep the authoritative envelope (ellipsoid 1.6s x (.5+v)s x s at y + .3s, inside the solid ellipse).
  inst(P.rock,rocks,p=>M(p.x-ox,p.y+.3*p.size,p.z-oz,(p.variant-.72)*.22,(p.variant*31)%2<1?0:Math.PI,(p.variant-.6)*.16,1.6*p.size,(.5+p.variant)*p.size,p.size));
  inst(P.relay,relays,p=>{halos.push([p.x-ox,p.y+9.35,p.z-oz,1.3,3]);return M(p.x-ox,p.y,p.z-oz,0,p.variant*6,0,1,1,1);});
  if(high&&halos.length)inst(P.bill,halos,h=>M(h[0],h[1],h[2],0,0,0,h[3],h[3],h[4]),MAT.fx);
  for(const c of g.children)if(c.material===MAT.fx)c.renderOrder=2;return g;};

 // ---------- Refuge: habitats ("cabins"), oxygen processors, supply terminal, solar field, light pylons ----------
 const ringMin=(x,z,r)=>{let m=ground(x,z);for(let a=0;a<12;a++)m=Math.min(m,ground(x+Math.cos(a*.5236)*r,z+Math.sin(a*.5236)*r));return m;};
 function habitat(Sb,X,h,idx){const {x,z}=h,g=ground(x,z),gmin=ringMin(x,z,8.4),f0=g+.6,ap=7.45*Math.cos(Math.PI/6),apL=7.55*Math.cos(Math.PI/6);
  const hex=(R,y0,y1,c,em=0,ao=null)=>Sb.add(G.hex,M(x,y0,z,0,0,0,R,y1-y0,R),c,em,ao);
  const face=(k,out,y,w,hh,d,c,em=0,tilt=0)=>{const a=k*Math.PI/3;Sb.add(G.box,M(x+Math.sin(a)*out,y,z+Math.cos(a)*out,tilt,a,0,w,hh,d),c,em);};
  hex(8.25,gmin-1.6,f0,K.dark);hex(8.34,f0-.2,f0,K.cyan,1);
  if(g-gmin>1.4)for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3;Sb.box(x+Math.sin(a)*8.3,(gmin-1.6+f0-.2)/2,z+Math.cos(a)*8.3,.55,f0-.2-(gmin-1.6),.55,K.mid,0,a);}
  hex(7.55,f0,g+3.2,K.panelA,0,[f0,2.6]);hex(7.63,g+3.2,g+3.45,K.dark2);hex(7.45,g+3.45,g+5.6,K.panelB);hex(7.6,g+5.6,g+5.8,K.cyan,1);
  Sb.add(G.hexF(.73),M(x,g+5.8,z,0,0,0,7.5,1.3,7.5),K.roof);hex(3.1,g+7.1,g+8.3,K.panelB);hex(2.6,g+8.3,g+8.45,K.ice,.85);
  for(const k of [0,2,4]){const a=Math.PI/6+k*Math.PI/3;Sb.box(x+Math.sin(a)*7.5,g+3.2,z+Math.cos(a)*7.5,.17,5.1,.17,K.cyan,1,a);}
  for(const k of [1,2,4,5]){face(k,ap+.02,g+4.45,5,1.05,.08,K.dark);face(k,ap+.07,g+4.45,4.4,.62,.06,K.ice,.92);if(high)face(k,apL+.05,g+1.6,3.2,.35,.1,K.dark2);}
  face(0,apL+.12,g+2.25,3.1,3.3,.42,K.dark);face(0,apL+.36,g+2.05,2.2,2.8,.08,K.cyan,.82);face(0,apL+.38,g+3.62,2.7,.13,.1,K.ice,1);face(0,apL+.75,g+4.05,4,.2,1.4,K.mid,-.12);
  face(0,apL+.9,f0-.15,4.4,.3,2,K.dark);face(0,apL+1.88,f0+.02,4.4,.07,.07,K.cyan,1);face(3,apL+.6,g+1.6,2.6,1.9,1.2,K.mid);face(3,apL+1.22,g+1.9,.4,.4,.05,K.amber,1);
  Sb.box(x+1.5,g+9.8,z-1.1,.12,3,.12,K.mid);Sb.box(x+1.5,g+11.35,z-1.1,.3,.3,.3,K.red,1);
  X.bill(x+1.5,g+11.35,z-1.1,.9,AT.BLOB,E(0xff3048,1.1));X.quadV(x,g+6.65,z+ap+1.25,3.4,.85,0,AT['S'+idx],E(0x22e6ff,1.5));
  X.decal(x,z,11.5,11.5,0,AT.BLOB,[0,0,0],.62,low?6:9,.12);X.decal(x,z,10.6,10.6,0,AT.RING,E(0x22e6ff,.3),0,low?8:12,.16);X.decal(x,z+10.2,3.6,3.6,0,AT.BLOB,E(0x22e6ff,.32),0,4,.2);}
 function processor(Sb,X,p,i,all){const {x,z}=p,g=ground(x,z),gmin=ringMin(x,z,12.6),H=p.artHeight,y0=g+13,y1=g+H,rb=6.9,rt=5.3,rAt=y=>rb+(rt-rb)*(y-y0)/(y1-y0);
  Sb.add(G.oct,M(x,gmin-1.6,z,0,0,0,12.6,g+2.6-(gmin-1.6),12.6),K.dark);Sb.add(G.oct,M(x,g+2.45,z,0,0,0,12.72,.2,12.72),K.cyan,1);
  Sb.add(G.octF(.81),M(x,g+2.6,z,0,0,0,10.6,10.4,10.6),K.panelA,0,[g+2.6,8]);
  for(let k=0;k<8;k++)Sb.add(G.box,MR(x,z,k*Math.PI/4,g+7.8,8.95,-.176,.7,6.2,.12),K.cyan,.9);
  Sb.add(G.cylF(+(rt/rb).toFixed(3)),M(x,y0,z,0,0,0,rb,y1-y0,rb),K.panelB);
  for(let y=y0+8;y<y1-4;y+=15){const r=rAt(y);Sb.add(G.cyl,M(x,y,z,0,0,0,r+.12,.7,r+.12),K.dark2);}
  for(const f of [.3,.48,.66,.84]){const y=g+H*f,r=rAt(y),R=r+2.7;Sb.add(G.torus,M(x,y,z,Math.PI/2,0,0,R,R,R),K.cyan,1);
   for(let k=0;k<4;k++)Sb.add(G.box,MR(x,z,k*Math.PI/2+Math.PI/4,y,(r+R)/2,0,.35,.35,R-r),K.mid);X.ringGlow(x,z,y,R,low?3:4.4,E(0x22e6ff,.55),low?12:20);}
  Sb.add(G.octF(.62),M(x,y1,z,0,0,0,rt+.6,5,rt+.6),K.panelA);Sb.add(G.torus,M(x,y1+.4,z,Math.PI/2,0,0,rt+.9,rt+.9,rt+.9),K.cyan,1);
  Sb.add(G.cone6,M(x,y1+5,z,0,0,0,2.4,11,2.4),K.panelB);Sb.box(x,y1+16.2,z,.5,.5,.5,K.red,1);X.bill(x,y1+16.2,z,3.2,AT.BLOB,E(0xff3048,1.2));
  const tilt=Math.atan((rb-rt)/(y1-y0));for(let k=0;k<4;k++)Sb.add(G.box,MR(x,z,k*Math.PI/2,(y0+y1)/2,(rb+rt)/2+.03,-tilt,.28,y1-y0-4,.28),K.cyan,1);
  if(i<all.length-1){const q=all[i+1],g2=ground(q.x,q.z);// Overhead pipe bridge (8+ m clearance): the 6 m gap between the solid r12 towers stays drivable.
   Sb.add(G.cylC,MDc(V3(x+12.4,g+9.6,z),V3(q.x-12.4,g2+9.6,q.z),1.1),K.mid);
   for(const t of [.25,.5,.75])Sb.add(G.cylC,MDc(V3(x+12.4+(q.x-x-24.8)*t-.15,g+9.6+(g2-g)*t,z),V3(x+12.4+(q.x-x-24.8)*t+.15,g+9.6+(g2-g)*t,z),1.35),K.cyan,1);}
  X.quadV(x,g+11.5,z-12.9,3.6,.95,Math.PI,AT['S'+(10+i)],E(0x22e6ff,1.5));
  X.decal(x,z,16,16,0,AT.BLOB,[0,0,0],.5,low?6:9,.12);X.decal(x,z,18,18,0,AT.BLOB,E(0x22e6ff,.28),0,low?6:9,.16);}
 function terminal(Sb,X,t){const {x,z}=t,g=ground(x,z);
  X.decal(x,z,6.4,6.4,0,AT.HEX,E(0x22e6ff,1.15),0,low?8:12,.14);X.decal(x,z,12.65,12.65,0,AT.DASH,E(0x2dffc4,.6),0,low?12:18,.18);X.decal(x,z,8,8,0,AT.BLOB,E(0x22e6ff,.3),0,8,.1);
  Sb.box(x,g-.4,z,1.9,1.6,1.5,K.dark);Sb.box(x,g+1.7,z,1.05,2.6,.85,K.panelA,0,0,[g,2.5]);Sb.box(x,g+3.12,z,1.6,.28,1.2,K.dark2);Sb.add(G.box,M(x,g+2.25,z+.5,-.3,0,0,1.25,.85,.06),K.ice,.95);
  for(const s of [-1,1])Sb.box(x+s*.55,g+1.7,z+.43,.08,2.4,.08,K.cyan,1);
  for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3,bx=x+Math.sin(a)*5.8,bz=z+Math.cos(a)*5.8,bg=ground(bx,bz);Sb.box(bx,bg+.5,bz,.28,1.4,.28,K.dark2);Sb.box(bx,bg+1.25,bz,.34,.16,.34,K.cyan,1);if(high)X.bill(bx,bg+1.25,bz,.9,AT.BLOB,E(0x22e6ff,.8));}
  X.band(x,z,g+3.3,1.05,.7,6.5,E(0x2dffc4,.45),[0,0,0],14);X.quadV(x,g+7.3,z,3.4,3.4,0,AT.ICON,E(0x2dffc4,1.4));X.quadV(x,g+7.3,z,3.4,3.4,Math.PI/2,AT.ICON,E(0x2dffc4,.9));
  X.quadV(x,g+5.05,z+.3,3.8,.95,0,AT[SIGN.SUPPLY],E(0x22e6ff,1.6));X.bill(x,g+2.3,z+.6,1.6,AT.BLOB,E(0xa8f8ff,.5));}
 function solar(Sb,X,p){const {x,z,w,d,tilt}=p,g=ground(x,z),m=M(x,g+2,z,tilt,0,0,1,1,1),at=(lx,ly,lz)=>V3(lx,ly,lz).applyMatrix4(m);
  Sb.add(G.box,M(x,g+2,z,tilt,0,0,w,.26,d),K.navy);Sb.add(G.box,M(x,g+1.9,z,tilt,0,0,w+.3,.16,d+.3),K.mid);
  Sb.add(G.box,new T.Matrix4().multiplyMatrices(m,M(0,.16,-d/2,0,0,0,w,.08,.08)),K.cyan,1);
  X.quad([at(-w*.48,.15,d*.48),at(w*.48,.15,d*.48),at(w*.48,.15,-d*.48),at(-w*.48,.15,-d*.48)],AT.GRID,E(0x22e6ff,.42));
  for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const c=at(sx*(w/2-.6),0,sz*(d/2-.6)),gy=ground(c.x,c.z);if(c.y>gy)Sb.box(c.x,(c.y+gy-.5)/2,c.z,.25,c.y-gy+.5,.25,K.mid);}}
 function pylon(Sb,X,px,pz){const g=ground(px,pz);Sb.box(px,g+3.4,pz,.24,7.2,.24,K.mid);Sb.box(px,g+.2,pz,.7,.5,.7,K.dark);Sb.box(px,g+7.05,pz+.35,.22,.18,.9,K.dark2);Sb.box(px,g+6.92,pz+.75,.7,.12,.38,K.ice,1);Sb.box(px,g+3.4,pz+.13,.06,6.2,.04,K.cyan,1);
  X.bill(px,g+6.8,pz+.75,1.7,AT.BLOB,E(0xa8f8ff,.8));X.decal(px,pz+.6,5.5,5.5,0,AT.BLOB,E(0x22e6ff,.3),0,low?4:6,.15);}
 S.refuge=()=>{const Sb=new Bld(),X=new Fx();F.habitats.forEach((h,i)=>habitat(Sb,X,h,i));F.processors.forEach((p,i,a)=>processor(Sb,X,p,i,a));terminal(Sb,X,F.terminal);
  F.solar.forEach(p=>solar(Sb,X,p));for(const [x,z] of PYLONS.slice(0,low?6:10))pylon(Sb,X,x,z);const g=pair(Sb,X);g.name='cq-style-refuge';g.userData.site={x:1150,z:1150,range:1600};return g;};

 // ---------- Refuge viaduct: the deck surface follows W.deckAt exactly (it is the drivable upper route) ----------
 S.viaduct=()=>{const Sb=new Bld(),X=new Fx(),zA=1015,zB=1033,deck=x=>W.deckAt(x,1024);
  // Deck ribbon (top surface exactly at deckAt, sampled every 4 m like the live build) with a thickness skirt.
  const P2=[],N2=[],A2=[],I2=[];let n=0;const col=(c,a=0)=>[c.r,c.g,c.b,a];
  for(let x=900;x<=1140;x+=4){const y=deck(x);for(const [z,c] of [[zA,K.dark2],[zB,K.dark2]]){P2.push(x,y,z);N2.push(0,1,0);A2.push(...col(c));}if(x<1140){const i=n;I2.push(i,i+1,i+2,i+2,i+1,i+3);}n+=2;}
  const deckGeo=new T.BufferGeometry();deckGeo.setAttribute('position',new T.Float32BufferAttribute(P2,3));deckGeo.setAttribute('normal',new T.Float32BufferAttribute(N2,3));deckGeo.setAttribute('aCol',new T.Float32BufferAttribute(A2,4));deckGeo.setIndex(I2);deckGeo.computeVertexNormals();
  Sb.add(deckGeo,new T.Matrix4(),null,0,null,(v)=>[K.dark2.r*(1+.05*Math.sin(v.x*.8)),K.dark2.g,K.dark2.b*(1.04),0]);deckGeo.dispose();
  for(let x=900;x<1140;x+=4){const a=deck(x),b=deck(x+4),L=Math.hypot(4,b-a),rz=Math.atan2(b-a,4),mid=(a+b)/2;
   // Under-deck slab, curbs with neon strips, centre lane marker.
   Sb.add(G.box,M(x+2,mid-.75,1024,0,0,rz,L+.02,1.3,18.2),K.dark);for(const z of [zA,zB]){Sb.add(G.box,M(x+2,mid+.45,z,0,0,rz,L+.02,.9,.7),K.mid);Sb.add(G.box,M(x+2,mid+.93,z,0,0,rz,L,.06,.74),K.cyan,1);}
   if(((x-900)/4)%2===0)Sb.add(G.box,M(x+2,mid+.04,1024,0,0,rz,2.4,.04,.24),K.ice,.9);}
  // Pillars on the authoritative pier positions (solid in the sim within 1.5 m below the deck): hex columns with lit collars.
  for(const x of [970,1070])for(const z of [1018,1030]){const gy=ground(x,z),top=23.4;Sb.add(G.hexF(.92),M(x,gy-1,z,0,0,0,1.65,top-gy+1,1.65),K.mid,0,[gy,8]);
   for(const f of [.35,.7]){const y=gy+(top-gy)*f;Sb.add(G.hex,M(x,y,z,0,0,0,1.78,.35,1.78),K.cyan,1);}X.decal(x,z,4.5,4.5,0,AT.BLOB,[0,0,0],.55,4,.12);}
  // Light posts along both edges; halo + spill on the deck.
  for(let x=916;x<1140;x+=24)for(const [z,s] of [[zA,-1],[zB,1]]){const y=deck(x);Sb.box(x,y+2.4,z+s*.2,.16,3.4,.16,K.mid);Sb.box(x,y+4.05,z-s*.25,.24,.14,.9,K.dark2);Sb.box(x,y+3.97,z-s*.55,.5,.08,.3,K.ice,1);
   if(high)X.bill(x,y+3.9,z-s*.55,1.3,AT.BLOB,E(0xa8f8ff,.6));X.flat(x,y+.08,z-s*2.2,2.6,2.2,AT.BLOB,E(0x22e6ff,.22));}
  for(const x of [904,1136]){const y=deck(x);X.quadV(x,y+3.6,1024,4.4,1.1,Math.PI/2,AT[SIGN.CORRIDOR],E(0x22e6ff,1.4));Sb.box(x,y+2,1024-2.6,.2,4,.2,K.mid);Sb.box(x,y+2,1024+2.6,.2,4,.2,K.mid);Sb.box(x,y+4.25,1024,.14,.14,5.4,K.cyan,1);}
  const g=pair(Sb,X);g.name='cq-style-viaduct';g.userData.site={x:1020,z:1024,range:1400};return g;};

 // ---------- Parasite installations (enemy bases) and raid cover ----------
 function coverWall(Sb,X,o){const g=ground(o.x,o.z),{x,z,width:w,depth:d,height:h}=o,long=w>=d,L=long?w:d,n=Math.max(1,Math.floor(L/3));
  Sb.box(x,g+(h-.35-1.2)/2,z,w,h-.35+1.2,d,K.wall,0,0,[g,3]);Sb.box(x,g+h-.175,z,w-.34,.35,d-.34,K.wallTop);
  for(let i=1;i<n;i++){const t=-L/2+i*L/n;if(long)Sb.box(x+t,g+(h-.5)/2,z,.14,h-.5,d+.06,K.dark);else Sb.box(x,g+(h-.5)/2,z+t,w+.06,h-.5,.14,K.dark);}
  for(const s of [-1,1]){if(long){Sb.box(x,g+h-.42,z+s*(d/2+.01),w-.5,.09,.05,K.mag,1.85);Sb.box(x,g+.55,z+s*(d/2+.01),w-.5,.06,.05,K.mag,1.6);}else{Sb.box(x+s*(w/2+.01),g+h-.42,z,.05,.09,d-.5,K.mag,1.85);Sb.box(x+s*(w/2+.01),g+.55,z,.05,.06,d-.5,K.mag,1.6);}}
  X.decal(x,z,w/2+2.2,d/2+2.2,0,AT.BLOB,[0,0,0],.55,6,.1);X.decal(x,z,w/2+3.5,d/2+3.5,0,AT.BLOB,E(0xff2bd6,.2),0,6,.12);}
 function hive(Sb,X,inst){const cx=inst.solid.x,cz=inst.solid.z,g=ground(cx,cz),ax=9,ay=12.4,az=6;
  Sb.add(G.blob1,M(cx,g-.6,cz,0,0,0,11.2,2.4,8.2),K.chitinD);Sb.add(G.blob2,M(cx,g,cz,0,0,0,ax,ay,az),K.chitin,0,[g,9]);
  for(let k=0;k<8;k++){const ph=k*Math.PI/4+.2,dx=Math.cos(ph),dz=Math.sin(ph),rr=1/Math.sqrt(dx*dx/(ax*ax)+dz*dz/(az*az));let prev=null;
   for(let j=0;j<=9;j++){const t=j/9*Math.PI/2*.94,p=V3(cx+dx*rr*Math.cos(t)*1.05,g+ay*Math.sin(t)*1.04,cz+dz*rr*Math.cos(t)*1.05);if(prev)Sb.seg(prev,p,.28,K.mag,1.85);prev=p;}}
  for(const f of [.25,.55]){let prev=null;for(let j=0;j<=24;j++){const ph=j/24*TAU,y=ay*f,s=Math.sqrt(1-f*f)*1.05,p=V3(cx+Math.cos(ph)*ax*s,g+y,cz+Math.sin(ph)*az*s);if(prev)Sb.seg(prev,p,.2,K.mag,1.7);prev=p;}}
  const cp=V3(cx-ax*.9,g+4.4,cz);Sb.add(G.ico,M(cp.x,cp.y,cp.z,0,0,0,2.1,2.1,2.1),K.magHot,1.95);Sb.add(G.torus,M(cp.x+.4,cp.y,cp.z,0,Math.PI/2,0,2.6,2.6,4),K.chitinD);
  X.bill(cp.x-1.2,cp.y,cp.z,7.5,AT.BLOB,E(0xff2bd6,1.1));X.bill(cp.x-1.6,cp.y,cp.z,3,AT.BLOB,E(0xffb0f0,1.2));
  for(const [a,el,len] of [[.6,.55,2.4],[1.5,.6,2.3],[2.4,.5,2.6],[3.3,.62,2.2],[4.2,.5,2.5],[5.1,.58,2.4],[5.9,.66,2],[.15,.78,1.8],[3,.8,1.7],[1.1,.85,1.6]]){
   const dx=Math.cos(a)*Math.cos(el),dy=Math.sin(el),dz=Math.sin(a)*Math.cos(el),p=V3(cx+ax*dx*.97,g+ay*dy*.97,cz+az*dz*.97),nrm=V3(dx/ax,dy/ay,dz/az).normalize().add(V3(0,1.4,0)).normalize(),tip=p.clone().addScaledVector(nrm,len);
   Sb.spike(p,tip,.5,K.chitinD);Sb.spike(p.clone().lerp(tip,.5),tip,.24,K.mag,1);}
  for(const [sx,sz,hh] of [[-9.6,-6.4,2.2],[9.4,-6.6,2.6],[-9.4,6.4,2.4],[9.6,6.2,2],[0,-7.2,1.6],[-3,7.3,1.8],[4,7.2,1.5],[-10.2,0,1.8]]){const b=V3(cx+sx*.92,ground(cx+sx,cz+sz)-.2,cz+sz*.92),t=V3(cx+sx,b.y+hh,cz+sz);Sb.spike(b,t,.45,K.chitinD);Sb.spike(b.clone().lerp(t,.55),t,.2,K.mag,1);}
  const mx=inst.mast.x,mz=inst.mast.z,mg=ground(mx,mz);Sb.add(G.hexF(.3),M(mx,mg-1,mz,0,.3,0,1.7,18.6,1.7),K.chitin);
  for(let k=0;k<3;k++){const a=.3+k*2.094;Sb.seg(V3(mx+Math.sin(a)*1.68,mg,mz+Math.cos(a)*1.68),V3(mx+Math.sin(a)*.55,mg+17.3,mz+Math.cos(a)*.55),.16,K.mag,1.9);}
  for(const [a,hh] of [[.9,5.5],[2.9,4.2],[4.9,6.2]]){const b=V3(mx+Math.cos(a)*1.1,mg-.3,mz+Math.sin(a)*1.1);Sb.spike(b,V3(mx+Math.cos(a)*1.9,mg+hh,mz+Math.sin(a)*1.9),.42,K.chitinD);}
  Sb.add(G.ico,M(mx,mg+18.8,mz,0,0,0,1.15,1.15,1.15),K.magHot,1.95);for(let k=0;k<4;k++){const a=k*Math.PI/2+.4;Sb.spike(V3(mx+Math.cos(a)*.6,mg+17.6,mz+Math.sin(a)*.6),V3(mx+Math.cos(a)*1.6,mg+20,mz+Math.sin(a)*1.6),.18,K.mag,1);}
  X.bill(mx,mg+18.8,mz,5.5,AT.BLOB,E(0xff2bd6,1.2));X.bill(mx,mg+18.8,mz,2.2,AT.BLOB,E(0xffc0f4,1.2));X.band(mx,mz,mg+19.5,.9,.4,14,E(0xff2bd6,.5),[0,0,0],12);
  X.decal(cx,cz,15,12,0,AT.BLOB,[0,0,0],.6,low?6:10,.12);X.decal(cx,cz,21,18,0,AT.BLOB,E(0xff2bd6,.35),0,low?6:10,.16);}
 S.installations=()=>F.installations.map(inst=>{const Sb=new Bld(),X=new Fx();hive(Sb,X,inst);const g=pair(Sb,X);g.name='cq-style-hive-'+inst.id;g.userData.site={x:inst.solid.x,z:inst.solid.z,range:1100};return g;});
 S.cover=()=>{const groups=new Map();for(const o of F.obstacles){let e=groups.get(o.layout);if(!e){e={Sb:new Bld(),X:new Fx(),x:0,z:0,n:0};groups.set(o.layout,e);}coverWall(e.Sb,e.X,o);e.x+=o.x;e.z+=o.z;e.n++;}
  return [...groups.entries()].map(([layout,e])=>{const g=pair(e.Sb,e.X);g.name='cq-style-cover-'+layout;g.userData.site={x:e.x/e.n,z:e.z/e.n,range:900};return g;});};
 // Raid-only Parasite spire (decor where the live build places raid art): crystal cluster on a chitin root.
 S.raidSpire=()=>{const Sb=new Bld(),X=new Fx();Sb.add(G.blob1,M(0,-.5,0,0,.5,0,4.4,1.8,3.8),K.chitinD);
  for(const [dx,dz,hh,tx,tz,r] of [[0,0,7.2,0,0,1],[1.6,.8,5,.35,.2,.8],[-1.4,1.1,4.3,-.3,.3,.75],[.6,-1.6,3.8,.15,-.4,.7],[-1,-1.2,3.2,-.25,-.3,.6]])
   Sb.add(G.shard,M(dx,-.3,dz,tz,0,-tx,r*1.4,hh,r*1.4),null,0,null,gradC(0,7,...MAGC));
  X.bill(0,4,0,7,AT.BLOB,E(0xff2bd6,.7));X.flat(0,.12,0,8,8,AT.BLOB,E(0xff2bd6,.3),0);return pair(Sb,X);};
 // Blender-authored GLB (constrained parser) adopted into the style: per-mesh PBR factors become vertex colour + emission.
 S.adopt=group=>{group.traverse(o=>{if(!o.isMesh||o.material===MAT.solid)return;const geo=o.geometry,m=o.material;if(!geo.attributes.aCol){const n=geo.attributes.position.count,a=new Float32Array(n*4),c=m.color||new T.Color(1,1,1),e=m.emissive||new T.Color(0,0,0),em=Math.max(e.r,e.g,e.b);
   geo.computeBoundingBox();const y0=geo.boundingBox.min.y,h=Math.max(.01,geo.boundingBox.max.y-y0),p=geo.attributes.position;
   for(let i=0;i<n;i++){const k=em>.05?1:.55+.45*clamp01((p.getY(i)-y0)/(h*.6));a[i*4]=(em>.05?e.r/em:c.r)*k;a[i*4+1]=(em>.05?e.g/em:c.g)*k;a[i*4+2]=(em>.05?e.b/em:c.b)*k;a[i*4+3]=em>.05?Math.min(1,.55+em):0;}
   geo.setAttribute('aCol',new T.BufferAttribute(a,4));}o.material=MAT.solid;});return group;};

 // ---------- Command Base I–V (base-local x/z, absolute y; built to the shared baseBlocked() footprints) ----------
 S.commandBase=(base,opt={})=>{const D=F.base,tier=base.tier||0,Sb=new Bld(),X=new Fx(),gy=(x,z)=>ground(D.x+x,D.z+z),y=gy(0,0);
  const decal=(x,z,hw,hd,r,e,o,seg,lift)=>{X.decal(D.x+x,D.z+z,hw,hd,0,r,e,o,seg,lift);};
  // World-space decals are rebased to the base-local frame after building (the group sits at the base centre).
  Sb.box(0,y-.9,0,38,2.4,34,K.dark,0,0,[y-2,2.4]);Sb.box(0,y+.2,0,37.4,.2,33.4,K.dark2);Sb.box(0,y+.29,-17.05,38,.06,.12,K.cyan,1);Sb.box(0,y+.29,17.05,38,.06,.12,K.cyan,.6);for(const s of [-1,1])Sb.box(s*19.05,y+.29,0,.12,.06,34,K.cyan,.6);
  Sb.add(G.hex,M(0,y+.27,0,0,0,0,4.2,.16,4.2),K.dark2);Sb.add(G.hex,M(0,y+.35,0,0,0,0,3.4,.06,3.4),K.cyan,tier?.9:.4);
  const paint=new T.Color(opt.paint||'#2c3a49');Sb.box(0,y+.31,0,10,.04,8,paint,0);
  decal(0,0,5.6,5.6,AT.HEX,E(tier?0x22e6ff:0xffb347,.9),0,low?8:10,.38);
  // Build terminal (exists before purchase): kiosk with amber holo.
  Sb.box(-10,y+1.7,-7,2,3.4,1.5,K.dark2,0,0,[y,3]);Sb.box(-10,y+2.5,-7.78,1.6,1,.06,K.amber,.95);X.quadV(-10,y+4.6,-7.2,3.4,3.4,0,AT.ICON,E(0xffb347,1.2));
  if(!tier){decal(0,0,19,17,AT.DASH,E(0xffb347,.75),0,low?10:16,.4);X.quadV(0,y+6.5,-17.4,4.8,1.2,0,AT[SIGN['BUILD SITE']],E(0xffb347,1.5));}
  if(tier){
   // Perimeter barrier (side walls |x|=17, back wall z=16; 6 m thick in the sim): berm + wall + lit cap.
   const wall=(cx,cz,len,alongX)=>{const w=alongX?len:5.6,d=alongX?5.6:len;Sb.box(cx,y+.6,cz,alongX?len:6,1.2,alongX?6:len,K.dark,0,0,[y,1]);
    Sb.box(cx,y+2.6,cz,alongX?len:4.4,3.8,alongX?4.4:len,K.wall,0,0,[y,3.5]);Sb.box(cx,y+4.65,cz,alongX?len:4.8,.3,alongX?4.8:len,K.wallTop);
    for(const s of [-1,1])Sb.box(alongX?cx:cx+s*2.42,y+4.1,alongX?cz+s*2.42:cz,alongX?len-.4:.06,.12,alongX?.06:len-.4,K.cyan,1);
    const n=Math.floor(len/4);for(let i=1;i<n;i++){const t=-len/2+i*len/n;Sb.box(alongX?cx+t:cx,y+2.6,alongX?cz:cz+t,alongX?.16:4.5,3.7,alongX?4.5:.16,K.dark2);}};
   wall(-17,-.5,35,false);wall(17,-.5,35,false);wall(0,16,29.6,true);
   for(const [x,z] of [[-17,-17.5],[17,-17.5]]){Sb.box(x,y+3,z,6.4,6,1.6,K.dark2,0,0,[y,5]);Sb.box(x,y+6.1,z,6.6,.25,1.8,K.cyan,1);X.bill(x,y+6.4,z,1.6,AT.BLOB,E(0x22e6ff,.9));}
   Sb.box(10,y+4,12,.6,8,.6,K.mid);Sb.box(10,y+8.2,12,.9,.4,.9,K.cyan,1);X.quadV(13.2,y+7,11.6,5,1.25,0,AT[SIGN['BASE '+['I','II','III','IV','V'][Math.min(5,tier)-1]]],E(0x22e6ff,1.6));
   if(opt.veteran){Sb.add(G.cone6,M(-12,y+.3,10,0,0,0,1.2,5,1.2),K.gold,.7);Sb.box(-12,y+.5,10,3,1,3,K.dark2);X.bill(-12,y+5.4,10,1.6,AT.BLOB,E(0xffd36b,.9));}}
  if(tier>=2){
   // Hangar (sim: x 1..17, z 1..17): chamfered block, lit door facing the pad.
   Sb.box(9,y+3.6,9,15.4,7.2,15.4,K.panelA,0,0,[y,6]);Sb.add(G.hexF(.82),M(9,y+7.2,9,0,Math.PI/4,0,10.4,1.6,10.4),K.roof);Sb.box(9,y+.4,9,16,.8,16,K.dark);
   Sb.box(9,y+3.1,1.25,9.5,5.6,.4,K.dark);Sb.box(9,y+5.95,1.15,10,.14,.3,K.cyan,1);for(const s of [-1,1])Sb.box(9+s*4.85,y+3.1,1.15,.14,5.6,.3,K.cyan,1);Sb.box(9,y+.55,1.1,9.4,.1,.3,K.amber,1);
   for(let i=0;i<4;i++)Sb.box(9,y+1+i*1.3,1.02,9.2,.05,.06,K.dark2);X.quadV(9,y+6.6,.8,4.2,1.05,0,AT[SIGN.HANGAR],E(0x22e6ff,1.5));decal(9,-3,6,4.5,AT.BLOB,E(0x22e6ff,.35),0,6,.42);
   for(const [vx,vz] of [[5.5,13],[12.5,13],[5.5,5],[12.5,5]]){Sb.box(vx,y+7.5,vz,2,.5,2,K.dark2);Sb.box(vx,y+7.78,vz,1.6,.06,1.6,K.cyan,.8);}
   // Reactor plinth (sim: r8 around (-7,8)); tier II drum, tier III+ the Blender command citadel stands on it.
   Sb.add(G.oct,M(-7,y,8,0,0,0,7.6,1.6,7.6),K.dark);Sb.add(G.oct,M(-7,y+1.5,8,0,0,0,7.75,.18,7.75),K.cyan,1);
   if(tier<3||!opt.citadel){Sb.add(G.cylF(.86),M(-7,y+1.6,8,0,0,0,5.6,8.4,5.6),K.panelB);for(const h of [3.6,6.6])Sb.add(G.torus,M(-7,y+h,8,Math.PI/2,0,0,5.9,5.9,5.9),K.cyan,1);
    Sb.add(G.dome,M(-7,y+10,8,0,0,0,4.9,2.4,4.9),K.panelA);Sb.add(G.hex,M(-7,y+12.2,8,0,0,0,1,.5,1),K.teal,1);X.bill(-7,y+12.8,8,2.4,AT.BLOB,E(0x2dffc4,.9));if(high)X.ringGlow(-7,8+D.z-D.z,y+5.1,6.2,4,E(0x2dffc4,.4),18);}
   X.quadV(-7,y+3.2,.15,3.8,.95,0,AT[SIGN.REACTOR],E(0x2dffc4,1.4));}
  if(tier>=3)for(const s of [-1,1]){const x=s*15,z=-13;
   // Corner gun towers (sim: 8x8 at (±15,-13)).
   Sb.box(x,y+1,z,7.6,2,7.6,K.dark,0,0,[y,2]);Sb.box(x,y+5.5,z,5.6,7.2,5.6,K.panelA,0,0,[y+2,6]);Sb.box(x,y+9.4,z,6.4,.6,6.4,K.dark2);
   for(const [cx,cz] of [[-1,-1],[1,-1],[-1,1],[1,1]])Sb.box(x+cx*2.82,y+5.5,z+cz*2.82,.14,7,.14,K.cyan,1);
   Sb.box(x,y+10.6,z,4.2,1.8,4.2,K.dark2);for(const t of [-.55,.55])Sb.add(G.cylC,MDc(V3(x+t,y+10.7,z-1.6),V3(x+t,y+10.9,z-6.4),.34),K.mid);Sb.box(x,y+11.6,z+1.2,.5,.5,.5,K.red,1);
   X.bill(x,y+11.6,z+1.2,1.2,AT.BLOB,E(0xff3048,1));X.quadV(x,y+7.6,z-2.86,3.6,.9,0,AT[SIGN.DEFENSE],E(0x22e6ff,1.3));}
  if(tier>=4){Sb.box(12,y+10,10,.5,5.6,.5,K.mid);Sb.box(12,y+12.9,10,.8,.4,.8,K.cyan,1);X.quadV(12,y+8.8,15.9,3.4,.85,0,AT[SIGN.RADAR],E(0x22e6ff,1.2));}
  if(tier>=5){const x=0,z=16;// on the solid back-wall line (sim |z-16|<3), so tanks never drive through the towerSb.add(G.hexF(.62),M(x,y,z,0,0,0,2.4,26,2.4),K.panelB);for(let h=5;h<=24;h+=4.5){const r=2.4-(h/26)*.9;Sb.add(G.torus,M(x,y+h,z,Math.PI/2,0,0,r+1.1,r+1.1,r+1.1),K.cyan,1);if(high)X.ringGlow(x,z,y+h,r+1.1,2.2,E(0x22e6ff,.45),14);}
   Sb.add(G.cone6,M(x,y+26,z,0,0,0,1.3,6,1.3),K.panelA);Sb.add(G.ico,M(x,y+32.6,z,0,0,0,.8,.8,.8),K.ice,1);X.bill(x,y+32.6,z,4.2,AT.BLOB,E(0x22e6ff,1.2));X.quadV(x,y+6.2,z-2.7,4.6,1.15,0,AT[SIGN.COMMAND],E(0x22e6ff,1.6));}
  // Modules along the inner face of the back wall: colour = function, height = level.
  const MOD={reactor:[K.teal,0x2dffc4],hangar:[K.cyan,0x22e6ff],defense:[K.red,0xff3048],vault:[K.gold,0xffd36b],radar:[K.ice,0xa8f8ff],uplink:[K.violet,0xa07bff]};
  Object.keys(C.baseDefinition.modules).forEach((m,i)=>{const level=base.modules?.[m]||0;if(!level)return;const x=-12+i*4,h=1.2+level*1.1,c=MOD[m]||MOD.hangar,mz=13.6;Sb.add(G.hex,M(x,y,mz,0,0,0,1.5,h,1.5),K.dark2);Sb.add(G.hex,M(x,y+h,mz,0,0,0,1.6,.3,1.6),c[0],1);
   for(let k=1;k<=level;k++)Sb.add(G.hex,M(x,y+h*k/(level+1),mz,0,0,0,1.56,.12,1.56),c[0],.9);X.bill(x,y+h+.6,mz,1.3,AT.BLOB,E(c[1],.8));});
  // Defense damage reads as scorch and wreckage at the gate.
  for(let i=0;i<Math.ceil((base.defense?.damage||0)/20);i++){decal(-12+i*5,-15,2.6,2.2,AT.BLOB,[0,0,0],.75,3,.4);Sb.box(-12+i*5,y+.5,-15,1.6,.5,.9,K.chitinD,0,i);}
  const solidMesh=Sb.mesh(),fxMesh=X.mesh();
  // Rebase world-space decals (built with absolute x/z) into the base-local frame.
  if(fxMesh.geometry){const p=fxMesh.geometry.attributes.position,b=fxMesh.geometry.attributes.aBill;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>500)p.setXYZ(i,p.getX(i)-D.x,p.getY(i),p.getZ(i)-D.z);fxMesh.geometry.computeBoundingSphere();}
  const g=new T.Group();g.add(solidMesh,fxMesh);if(tier>=4){const dish=new Bld();dish.add(G.cone6,M(0,0,0,Math.PI/2,0,0,2.6,1,2.6),K.panelB);dish.add(G.box,M(0,0,-.5,0,0,0,.2,.2,1.2),K.cyan,1);const r=dish.mesh();r.position.set(12,y+13.6,10);r.name='cq-radar';g.add(r);g.userData.spin=r;}
  return g;};

 // ---------- enemies: Parasite war machines on today's canonical hull silhouettes (bbox unchanged) ----------
 const paint=geo=>{const c=geo.attributes.color,n=c.count,a=new Float32Array(n*4);
  for(let i=0;i<n;i++){const r=c.getX(i),g=c.getY(i),b=c.getZ(i),l=.3*r+.59*g+.11*b;let o;
   if(b>.85&&g>.5&&r<.6)o=[1,.12,.45,1];else if(r>.95&&g<.3)o=[1,.1,.6,1];else if(r>.7&&g<.3&&b<.3)o=[1,.08,.75,1.85];else if(r>.4&&g<.1&&b<.1)o=[.6,.02,.35,.7];
   else if(r>.45&&g>.25&&g<.45&&b<.2)o=[.16,.022,.07,0];else if(l>.6)o=[.36,.28,.4,0];else{const k=clamp01((l-.03)/.45);o=[.02+.19*k,.01+.085*k,.032+.23*k,0];}
   a.set(o,i*4);}geo.setAttribute('aCol',new T.BufferAttribute(a,4));return geo;};
 const PATTERN={shield:[K.cyan,0x48d8ff],ambush:[K.amber,0xffb347],artillery:[K.red,0xff5a3c],carrier:[K.teal,0x2dffc4],plasma:[K.violet,0xb07bff],command:[K.magHot,0xff7ae8]};
 const markers=()=>{const g=new T.Group(),a=new Bld(),b=new Bld();a.add(G.octa,M(0,0,0,0,0,0,.36,.5,.36),K.mag,1);b.add(G.octa,M(0,0,0,0,0,0,.44,.6,.44),K.amber,1);const n=a.mesh(),t=b.mesh();t.visible=false;g.add(n,t);g.userData.states=[n,t];return g;};
 // Hull: cached per silhouette by the view (merged body/gun geometry with vertex colours) -> painted + dressed once.
 S.parasiteHull=(cached,e)=>{if(cached.style)return cached.style;const body=paint(cached.body),gun=paint(cached.gun),p=body.attributes.position;let x0=1e9,x1=-1e9,y1=-1e9,zw=0;
  for(let i=0;i<p.count;i++){x0=Math.min(x0,p.getX(i));x1=Math.max(x1,p.getX(i));y1=Math.max(y1,p.getY(i));zw=Math.max(zw,Math.abs(p.getZ(i)));}const L=x1-x0;
  const topAt=(fx,wz)=>{let b=-1e9;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-fx)<.08*L&&Math.abs(p.getZ(i))<wz)b=Math.max(b,p.getY(i));return b;};
  const D=new Bld();for(let i=0;i<4;i++){const fx=x0+L*(.2+.16*i),ty=topAt(fx,.2*zw);if(ty<-1e8)continue;const hh=.26+.1*(i%2),b=V3(fx,ty-.05,0),t=V3(fx-hh*.8,ty+hh,0);D.spike(b,t,.09,K.chitinD);D.spike(b.clone().lerp(t,.5),t,.045,K.mag,1);}
  for(const s of [-1,1]){let best=0;for(let i=0;i<p.count;i++){const y=p.getY(i);if(y>.3*y1&&y<.62*y1)best=Math.max(best,Math.abs(p.getZ(i)));}D.box((x0+x1)/2,.46*y1,s*(best+.012),L*.6,.04,.02,K.mag,1.85);}
  let fy0=1e9,fy1=-1e9;for(let i=0;i<p.count;i++)if(p.getX(i)>x1-.06*L&&Math.abs(p.getZ(i))<.5*zw){fy0=Math.min(fy0,p.getY(i));fy1=Math.max(fy1,p.getY(i));}
  if(fy1>fy0)for(const s of [-1,1])D.add(G.ico,M(x1+.01,(fy0+fy1)/2,s*.2*zw,0,0,0,.045*zw+.02,.045*zw+.02,.045*zw+.02),K.mag,.85);
  if(e.commander){const c=PATTERN[e.pattern]||PATTERN.command;D.spike(V3(-L*.12,y1,0),V3(-L*.2,y1+.9,0),.18,K.chitinD);D.add(G.octa,M(-L*.16,y1+1.05,0,0,0,0,.2,.32,.2),c[0],1);for(const s of [-1,1])D.box(-L*.1,y1*.8,s*(zw+.03),L*.5,.06,.04,c[0],1.6);}
  const X=new Fx();X.flat(0,.05,0,zw*1.7,L*.75,AT.BLOB,[0,0,0],.7);X.flat(0,.06,0,zw*2.2,L*.95,AT.BLOB,e.commander?E((PATTERN[e.pattern]||PATTERN.command)[1],.55):E(0xff2bd6,.5),0);
  cached.style={dress:keep(D.geometry()),fx:keep(X.geometry())};return cached.style;};
 S.hullMeshes=(cached,e)=>{const st=S.parasiteHull(cached,e);return {body:new T.Mesh(cached.body,MAT.solid),gun:new T.Mesh(cached.gun,MAT.solid),dress:software?null:new T.Mesh(st.dress,MAT.solid),fx:low?null:Object.assign(new T.Mesh(st.fx,MAT.fx),{renderOrder:2}),marker:markers()};};
 // Immobile plasma battery / relay (objective turret): ~7 x 6 m base, ~11 m tall like the live build.
 let batteryCache=null;
 S.battery=()=>{if(!batteryCache){const Sb=new Bld(),X=new Fx(),Gn=new Bld();
   Sb.add(G.blob1,M(0,.15,0,0,.4,0,3.3,2.3,2.8),K.chitin,0,[0,2.2]);
   for(let k=0;k<6;k++){const a=k*Math.PI/3+.3;Sb.spike(V3(Math.cos(a)*2.3,.7,Math.sin(a)*1.9),V3(Math.cos(a)*3.35,-.1,Math.sin(a)*2.85),.34,K.chitinD);}
   for(let k=0;k<5;k++){const ph=k*TAU/5;let prev=null;for(let j=0;j<=6;j++){const t=j/6*Math.PI/2*.9,p=V3(Math.cos(ph)*3.3*Math.cos(t)*1.04,.15+2.3*Math.sin(t)*1.03,Math.sin(ph)*2.8*Math.cos(t)*1.04);if(prev)Sb.seg(prev,p,.13,K.mag,1.85);prev=p;}}
   Sb.add(G.hexF(.62),M(0,1.8,0,0,.2,0,1.25,4.6,1.25),K.chitin);Sb.add(G.torus,M(0,4.3,0,Math.PI/2,0,0,1.2,1.2,1.8),K.mag,1.8);
   Gn.add(G.ico,M(0,.2,0,0,0,0,1.25,1.25,1.25),K.magHot,1.95);
   for(let k=0;k<3;k++){const a=k*TAU/3+.5;Gn.spike(V3(Math.cos(a)*.9,-1.1,Math.sin(a)*.9),V3(Math.cos(a)*1.55,1.5,Math.sin(a)*1.55),.32,K.chitinD);}
   for(const s of [-1,1]){Gn.spike(V3(s*.6,0,.4),V3(s*.38,.25,2.85),.3,K.chitin,0,G.cone6);Gn.add(G.ico,M(s*.38,.25,2.75,0,0,0,.2,.2,.2),K.magHot,1);}
   Gn.spike(V3(0,.2,-.5),V3(0,1.3,-2.4),.38,K.chitinD);
   X.bill(0,6.8,0,4.2,AT.BLOB,E(0xff2bd6,.62));X.bill(0,6.8,0,1.9,AT.BLOB,E(0xffd0f6,.7));X.flat(0,.06,0,5.2,4.6,AT.BLOB,E(0xff2bd6,.45),0);X.flat(0,.05,0,4.6,4.2,AT.BLOB,[0,0,0],.7);
   batteryCache={base:keep(Sb.geometry()),gun:keep(Gn.geometry()),fx:keep(X.geometry())};}
  const g=new T.Group(),gun=new T.Group();gun.position.y=6.6;gun.add(new T.Mesh(batteryCache.gun,MAT.solid));g.add(new T.Mesh(batteryCache.base,MAT.solid),gun,Object.assign(new T.Mesh(batteryCache.fx,MAT.fx),{renderOrder:2}));
  const mk=markers();mk.position.y=11;g.add(mk);g.userData.gun=gun;g.userData.marker=mk;return g;};
 // Airborne drone: chitin body, four glowing rotor rings, eye; same ~1.8 m footprint as the live drone.
 let droneCache=null;
 S.drone=()=>{if(!droneCache){const Sb=new Bld(),X=new Fx();Sb.add(G.blob1,M(0,1.35,0,0,0,0,1.05,.42,.75),K.chitin);Sb.add(G.ico,M(.95,1.32,0,0,0,0,.22,.18,.22),K.magHot,1.9);
   for(const x of [-1,1])for(const z of [-1,1]){Sb.box(x*.8,1.22,z*.7,.28,.18,.9,K.chitinD);Sb.add(G.torus,M(x,1.5,z*.9,Math.PI/2,0,0,.46,.46,.46),K.mag,1.8);}
   X.bill(.95,1.32,0,.8,AT.BLOB,E(0xff2bd6,.9));X.flat(0,-1.2,0,1.8,1.5,AT.BLOB,E(0xff2bd6,.35),0);droneCache={body:keep(Sb.geometry()),fx:keep(X.geometry())};}
  const g=new T.Group(),body=new T.Group();body.rotation.y=-Math.PI/2;body.add(new T.Mesh(droneCache.body,MAT.solid),Object.assign(new T.Mesh(droneCache.fx,MAT.fx),{renderOrder:2}));g.add(body);
  const gun=new T.Group();g.add(gun);const mk=markers();mk.position.y=3;g.add(mk);g.userData.gun=gun;g.userData.marker=mk;return g;};

 // ---------- player tank dressing (canonical geometry untouched): cyan fender strips, contact shadow, ring underglow ----------
 S.dressTank=vehicle=>{const body=vehicle.userData.body,gun=vehicle.userData.gun;if(!body)return vehicle;vehicle.updateWorldMatrix(true,true);const inv=new T.Matrix4().copy(body.matrixWorld).invert(),pts=[];
  const walk=o=>{if(o===gun)return;if(o.isMesh){const m=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld),a=o.geometry.attributes.position;for(let i=0;i<a.count;i+=2){_v.fromBufferAttribute(a,i).applyMatrix4(m);pts.push(_v.x,_v.y,_v.z);}}for(const c of o.children)walk(c);};
  for(const c of body.children)walk(c);if(!pts.length)return vehicle;let zT=0;for(let i=2;i<pts.length;i+=3)zT=Math.max(zT,Math.abs(pts[i]));
  let yT=-1e9,x0=1e9,x1=-1e9,ax0=1e9,ax1=-1e9;for(let i=0;i<pts.length;i+=3){ax0=Math.min(ax0,pts[i]);ax1=Math.max(ax1,pts[i]);if(Math.abs(pts[i+2])>zT-.12){yT=Math.max(yT,pts[i+1]);x0=Math.min(x0,pts[i]);x1=Math.max(x1,pts[i]);}}
  const D=new Bld();for(const s of [-1,1])D.box((x0+x1)/2,yT+.018,s*(zT-.05),(x1-x0)*.86,.035,.06,K.cyan,1);const strips=D.mesh();strips.name='cq-style-dress';body.add(strips);
  const X=new Fx(),hl=(ax1-ax0)/2,cz=(ax0+ax1)/2;X.flat(0,.03,cz,zT*1.5,hl*1.25,AT.BLOB,[0,0,0],.78);X.flat(0,.04,cz,zT*2.1,hl*1.55,AT.RING,E(0x22e6ff,.6),0);X.flat(0,.045,cz,zT*1.7,hl*1.3,AT.BLOB,E(0x22e6ff,.25),0);
  X.flat(0,.05,cz+hl+2.4,1.9,2.6,AT.BLOB,E(0xa8f8ff,.22),0);const glow=X.mesh();glow.name='cq-style-dress';vehicle.add(glow);return vehicle;};

 // ---------- effects: pooled glow billboards, ground rings, holo markers ----------
 const glowCache=new Map();
 S.glow=(color,region='BLOB')=>{const k=color+region;let g=glowCache.get(k);if(!g){g=billGeo(AT[region],E(color,1));glowCache.set(k,g);}const m=new T.Mesh(g,MAT.fx);m.renderOrder=3;m.frustumCulled=false;return m;};
 const ringCache=new Map();
 S.groundRing=(color,region='RING')=>{const k=color+region;let g=ringCache.get(k);if(!g){const X=new Fx();X.flat(0,0,0,1,1,AT[region],E(color,1),0);g=keep(X.geometry());ringCache.set(k,g);}const m=new T.Mesh(g,MAT.fx);m.renderOrder=2;return m;};
 // Holo pillar marker (mission beacon, objectives, caches): ground hex + light band + icon.
 S.holoMarker=(color,{height=10,radius=1.4,icon=true}={})=>{const X=new Fx();X.flat(0,.15,0,radius*2.2,radius*2.2,AT.HEX,E(color,.9),0);X.band(0,0,.2,radius,radius*.55,height,E(color,.55),[0,0,0],12);if(icon){X.quadV(0,height+1.6,0,2.6,2.6,0,AT.ICON,E(color,1.2));X.quadV(0,height+1.6,0,2.6,2.6,Math.PI/2,AT.ICON,E(color,.8));}
  const m=X.mesh();m.renderOrder=2;return m;};
 const cacheGeo={};
 S.cache=(wreck)=>{const key=wreck?'w':'l';if(!cacheGeo[key]){const Sb=new Bld(),X=new Fx(),c=wreck?K.cyan:K.amber,col=wreck?0x8ee6ef:0xffd58a;Sb.box(0,.7,0,2,1.4,2,K.dark2);Sb.box(0,1.45,0,2.1,.12,2.1,c,1);for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]])Sb.box(x*1.02,.7,z*1.02,.1,1.4,.1,c,1);
  X.band(0,0,1.5,.5,.2,5,E(col,.6),[0,0,0],10);X.bill(0,2.2,0,1.6,AT.BLOB,E(col,.8));X.flat(0,.06,0,2.4,2.4,AT.BLOB,E(col,.4),0);cacheGeo[key]={s:keep(Sb.geometry()),f:keep(X.geometry())};}
  const g=new T.Group();g.add(new T.Mesh(cacheGeo[key].s,MAT.solid),Object.assign(new T.Mesh(cacheGeo[key].f,MAT.fx),{renderOrder:2}));return g;};
 S.flag=(owned,friendly)=>{const Sb=new Bld(),X=new Fx(),c=owned?K.teal:friendly?K.cyan:K.mag,col=owned?0x2dffc4:friendly?0x22e6ff:0xff2bd6;Sb.box(0,7,0,.2,14,.2,K.mid);Sb.box(0,.3,0,.9,.6,.9,K.dark);
  Sb.box(2.1,12,0,3.8,1.9,.12,K.dark2);Sb.box(2.1,12,.07,3.5,1.6,.02,c,.85);X.bill(.1,14.2,0,1.1,AT.BLOB,E(col,.9));X.quadV(2.1,12,.1,3.6,.9,0,AT[owned||friendly?SIGN.SECURED:SIGN.HOSTILE],E(col,1.3));return pair(Sb,X);};

 // ---------- per-frame: time, viewport, origin, nearest light/creep sites ----------
 const siteKey={};
 S.viewLights=camera=>{camera.updateMatrixWorld();const m=camera.matrixWorldInverse;U.uSunV.value.copy(sunDir).transformDirection(m);U.uRimV.value.copy(rimDir).transformDirection(m);U.uUpV.value.set(0,1,0).transformDirection(m);};
 S.update=(dt,t,view)=>{U.uTime.value=t;if(view?.renderer?.getDrawingBufferSize)view.renderer.getDrawingBufferSize(U.uViewport.value);if(view?.origin)U.uOrigin.value.set(view.origin.x,view.origin.z);
  const p=view?.p,terr=view?.authority?.state?.territory;if(!p)return;const k=Math.round(p.x/32)*100003+Math.round(p.z/32);if(siteKey.k===k&&siteKey.t===terr)return;siteKey.k=k;siteKey.t=terr;
  const list=allSites(F,terr).map(s=>[s,Math.hypot(s[0]-p.x,s[1]-p.z)-s[2]]).sort((a,b)=>a[1]-b[1]).slice(0,8);for(let i=0;i<8;i++){const s=list[i]?.[0];U.uSite.value[i].set(s?s[0]:0,s?s[1]:0,s?s[2]:0,s?s[3]:0);}};
 // Static groups are culled by distance (they are far apart); cheap per-frame loop.
 S.cull=(groups,p)=>{const k=software?.4:1;for(const g of groups){const s=g.userData.site;if(s)g.visible=Math.hypot(s.x-p.x,s.z-p.z)<s.range*k;}};
 // Compile every program variant once (static + instanced solid/fx, sky, terrain, shields) before play.
 S.warmObjects=()=>{const objs=[new T.Mesh(G.box,MAT.solid),new T.InstancedMesh(G.box,MAT.solid,1),new T.Mesh(P.bill,MAT.fx),new T.InstancedMesh(P.bill,MAT.fx,1),new T.Mesh(G.ico,MAT.shield),new T.Mesh(G.ico,MAT.field)];
  for(const o of objs)if(o.isInstancedMesh){o.setMatrixAt(0,new T.Matrix4());o.instanceMatrix.needsUpdate=true;}return objs;};
 S.canvas={bg:'#03060c',grid:'#12303d',cover:'#3c2a46',coverEdge:'#ff4fd8',site:'#8ff6ff',hostile:'#ff4fd8',friend:'#3fe9ff',beacon:['#3fe9ff','#ffc45a'],shot:'#d8faff',enemyShot:'#ff6bd6'};
 S.dispose=()=>{for(const g of S.shared)g.dispose();for(const m of Object.values(MAT))m.dispose();tex.atlas.dispose();tex.earth.dispose();tex.detail.dispose();glowCache.clear();ringCache.clear();batteryCache=droneCache=null;S.shared.length=0;};
 return S;
}

// ---------- region map: holographic tactical display with a lettered grid reference ----------
const MAPC={relief:null,glyphs:new Map(),labels:new Map(),overlay:null,fontWait:false,mctx:null};
const MFONT="600 10px 'Chakra Petch','Segoe UI',system-ui,sans-serif",GFONT="bold 30px 'Segoe UI Symbol','DejaVu Sans','Noto Sans Symbols2',sans-serif";
const colName=i=>{i=Math.max(0,i);return String.fromCharCode(65+Math.floor(i/26)%26)+String.fromCharCode(65+i%26);};
// The relief is rendered at a power-of-two resolution level and reused across pan and pinch steps within that level.
function relief(m,unit,vis){const Wd=m.W,d=m.discovery,c=MAPC.relief,level=Math.max(-6,Math.min(3,Math.ceil(Math.log2(unit*2)))),ppu=Math.pow(2,level);
 if(c&&c.level===level&&c.low===m.low&&c.version===(d.version??0)&&vis.x0>=c.x0&&vis.x1<=c.x1&&vis.z0>=c.z0&&vis.z1<=c.z1)return c;
 const pad=Math.max(64,(vis.x1-vis.x0)*.25),x0=Math.max(0,Math.floor((vis.x0-pad)/32)*32),x1=Math.min(Wd.WIDTH,Math.ceil((vis.x1+pad)/32)*32),z0=Math.max(0,Math.floor((vis.z0-pad)/32)*32),z1=Math.min(Wd.LENGTH,Math.ceil((vis.z1+pad)/32)*32);
 const cells=d.cellsIn({x:x0,z:z0,width:x1-x0,height:z1-z0}),scale=Math.min(ppu,2048/(x1-x0),2048/(z1-z0)),cw=Math.max(1,Math.ceil((x1-x0)*scale)),ch=Math.max(1,Math.ceil((z1-z0)*scale));
 const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const x=cv.getContext('2d'),out={canvas:cv,x0,x1,z0,z1,ppu:scale,level,low:m.low,version:d.version??0,n:cells.length};MAPC.relief=out;if(!cells.length)return out;
 const s=Math.max(m.low?8:4,Math.min(32,Math.round(1/scale/4)*4||4)),nx=Math.round((x1-x0)/s)+1,nz=Math.round((z1-z0)/s)+1,H=new Float32Array(nx*nz).fill(NaN),B=new Uint8Array(nx*nz),Y=j=>(nz-1-j)*s*scale;
 for(const cell of cells){const i0=Math.round((cell.x-x0)/s),j0=Math.round((cell.z-z0)/s),n=Math.max(1,Math.round(cell.size/s));for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const k=(j0+j)*nx+i0+i;if(k<0||k>=H.length||H[k]===H[k])continue;const wx=x0+(i0+i)*s,wz=z0+(j0+j)*s;H[k]=Wd.heightAt(wx,wz);const b=Wd.biomeAt(wx,wz);B[k]=b==='terraformed'?1:b==='massif'?2:0;}}
 const img=new ImageData(nx,nz),Dd=img.data,ok=k=>H[k]===H[k];
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i,h=H[k];if(h!==h)continue;const hl=i>0&&ok(k-1)?H[k-1]:h,hr=i<nx-1&&ok(k+1)?H[k+1]:h,hd=j>0&&ok(k-nx)?H[k-nx]:h,hu=j<nz-1&&ok(k+nx)?H[k+nx]:h,hx=(hr-hl)/(2*s),hz=(hu-hd)/(2*s);
  const sh=clamp01(.5+(.7*hx-.7*hz)*1.15),ht=clamp01((h+140)/170);let r=3+sh*15+ht*6,g=13+sh*50+ht*16,bb=22+sh*60+ht*18;if(B[k]===1){r*=.6;g=g*1.08+12;bb=bb*.9+4;}else if(B[k]===2){r+=4;g*=.85;bb=bb*1.1+8;}
  const o=((nz-1-j)*nx+i)*4;Dd[o]=r;Dd[o+1]=g;Dd[o+2]=bb;Dd[o+3]=255;}
 const sm=document.createElement('canvas');sm.width=nx;sm.height=nz;sm.getContext('2d').putImageData(img,0,0);x.imageSmoothingEnabled=true;x.drawImage(sm,-.5*s*scale,-.5*s*scale,nx*s*scale,nz*s*scale);
 const step=s>=16?25:m.low?10:5,minor=new Path2D(),major=new Path2D();
 for(const cell of cells){const i0=Math.round((cell.x-x0)/s),j0=Math.round((cell.z-z0)/s),n=Math.max(1,Math.round(cell.size/s));for(let j=j0;j<j0+n;j++)for(let i=i0;i<i0+n;i++){const a=H[j*nx+i],b=H[j*nx+i+1],c2=H[(j+1)*nx+i+1],dd=H[(j+1)*nx+i];if(a!==a||b!==b||c2!==c2||dd!==dd)continue;
  const lo=Math.min(a,b,c2,dd),hi=Math.max(a,b,c2,dd);for(let L=Math.ceil(lo/step)*step;L<hi;L+=step){const q=[];if((a<L)!==(b<L))q.push(i+(L-a)/(b-a),j);if((b<L)!==(c2<L))q.push(i+1,j+(L-b)/(c2-b));if((dd<L)!==(c2<L))q.push(i+(L-dd)/(c2-dd),j+1);if((a<L)!==(dd<L))q.push(i,j+(L-a)/(dd-a));
   const path=Math.round(L)%(step*5)===0?major:minor;for(let t=0;t+3<q.length;t+=4){path.moveTo(q[t]*s*scale,Y(q[t+1]));path.lineTo(q[t+2]*s*scale,Y(q[t+3]));}}}}
 x.lineCap='round';x.strokeStyle='rgba(20,200,255,.28)';x.lineWidth=1;x.stroke(minor);x.strokeStyle='rgba(0,229,255,.16)';x.lineWidth=3.2;x.stroke(major);x.strokeStyle='rgba(130,248,255,.8)';x.lineWidth=1.2;x.stroke(major);
 const P=(wx,wz)=>[(wx-x0)*scale,(z1-wz)*scale],F=m.footprints;
 if(m.scale>=32&&F){for(let cxk=Math.floor(x0/128);cxk<=Math.floor((x1-1)/128);cxk++)for(let czk=Math.floor(z0/128);czk<=Math.floor((z1-1)/128);czk++)for(const it of Wd.scenery(cxk,czk)){if(!d.has(it.x,it.z))continue;const [X0,Y0]=P(it.x,it.z);
   if(it.kind==='tree'){x.fillStyle='rgba(60,255,205,.8)';x.fillRect(X0-1,Y0-1,2,2);}else if(it.kind==='relay'){x.fillStyle='rgba(170,245,255,.95)';x.fillRect(X0-2,Y0-.5,4,1);x.fillRect(X0-.5,Y0-2,1,4);}
   else if(it.variant>.45){x.fillStyle='rgba(130,150,180,.45)';x.beginPath();x.arc(X0,Y0,Math.max(1,it.size*scale*.9),0,TAU);x.fill();}}
  const hexP=(wx,wz,r)=>{x.beginPath();for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3,[X0,Y0]=P(wx+Math.sin(a)*r,wz+Math.cos(a)*r);k?x.lineTo(X0,Y0):x.moveTo(X0,Y0);}x.closePath();};
  if(d.has(1020,1024)){const [a0,b0]=P(900,1015),[a1,b1]=P(1140,1033);x.fillStyle='rgba(120,160,190,.25)';x.fillRect(a0,b1,a1-a0,b0-b1);x.strokeStyle='rgba(150,220,255,.75)';x.lineWidth=1.2;x.strokeRect(a0,b1,a1-a0,b0-b1);}
  for(const h of F.habitats)if(d.has(h.x,h.z)){hexP(h.x,h.z,8);x.fillStyle='rgba(0,45,60,.95)';x.fill();x.strokeStyle='rgba(70,238,255,.95)';x.lineWidth=1.3;x.stroke();}
  for(const p of F.processors)if(d.has(p.x,p.z)){const [X0,Y0]=P(p.x,p.z);x.beginPath();x.arc(X0,Y0,12*scale,0,TAU);x.fillStyle='rgba(0,45,60,.95)';x.fill();x.strokeStyle='rgba(70,238,255,.95)';x.stroke();x.beginPath();x.arc(X0,Y0,6*scale,0,TAU);x.stroke();}
  for(const p of F.solar)if(d.has(p.x,p.z)){const [X0,Y0]=P(p.x-p.w/2,p.z+p.d/2);x.strokeStyle='rgba(70,238,255,.7)';x.strokeRect(X0,Y0,p.w*scale,p.d*scale);}
  for(const s of F.installations)if(d.has(s.x,s.z)){const [X0,Y0]=P(s.solid.x-11,s.solid.z+8);x.fillStyle='rgba(70,0,50,.9)';x.fillRect(X0,Y0,22*scale,16*scale);x.strokeStyle='rgba(255,80,214,.9)';x.lineWidth=1.2;x.strokeRect(X0,Y0,22*scale,16*scale);}
  if(d.has(F.terminal.x,F.terminal.z)){hexP(F.terminal.x,F.terminal.z,5);x.fillStyle='rgba(45,255,196,.9)';x.fill();}
  const Bd=F.base;if(d.has(Bd.x,Bd.z)){hexP(Bd.x,Bd.z,19);x.setLineDash([4,3]);x.strokeStyle='rgba(255,196,90,.9)';x.lineWidth=1.3;x.stroke();x.setLineDash([]);}}
 x.globalCompositeOperation='destination-in';x.fillStyle='#fff';x.beginPath();for(const cell of cells)x.rect((cell.x-x0)*scale-.6,(z1-cell.z-cell.size)*scale-.6,cell.size*scale+1.2,cell.size*scale+1.2);x.fill();
 x.globalCompositeOperation='source-atop';x.fillStyle='rgba(0,0,0,.2)';for(let yy=0;yy<ch;yy+=3)x.fillRect(0,yy,cw,1);
 if(scale>=.25){const fade=9*scale,frn=new Path2D(),gr=(ax,ay,bx,by,rx,ry,rw,rh)=>{const g=x.createLinearGradient(ax,ay,bx,by);g.addColorStop(0,'rgba(1,4,9,.92)');g.addColorStop(1,'rgba(1,4,9,0)');x.fillStyle=g;x.fillRect(rx,ry,rw,rh);};
  for(const cell of cells){const X0=(cell.x-x0)*scale,Y0=(z1-cell.z-cell.size)*scale,S2=cell.size*scale,w=!d.has(cell.x-1,cell.z+16),e=!d.has(cell.x+cell.size+1,cell.z+16),so=!d.has(cell.x+16,cell.z-1),no=!d.has(cell.x+16,cell.z+cell.size+1);
   if(w){gr(X0,0,X0+fade,0,X0,Y0,fade,S2);frn.moveTo(X0,Y0);frn.lineTo(X0,Y0+S2);}if(e){gr(X0+S2,0,X0+S2-fade,0,X0+S2-fade,Y0,fade,S2);frn.moveTo(X0+S2,Y0);frn.lineTo(X0+S2,Y0+S2);}
   if(no){gr(0,Y0,0,Y0+fade,X0,Y0,S2,fade);frn.moveTo(X0,Y0);frn.lineTo(X0+S2,Y0);}if(so){gr(0,Y0+S2,0,Y0+S2-fade,X0,Y0+S2-fade,S2,fade);frn.moveTo(X0,Y0+S2);frn.lineTo(X0+S2,Y0+S2);}}
  x.globalCompositeOperation='source-over';x.strokeStyle='rgba(0,229,255,.2)';x.lineWidth=4;x.stroke(frn);x.strokeStyle='rgba(110,244,255,.75)';x.lineWidth=1;x.stroke(frn);}
 x.globalCompositeOperation='source-over';return out;}
function glyph(gl,c){const k=gl+c;let s=MAPC.glyphs.get(k);if(s)return s;s=document.createElement('canvas');s.width=s.height=48;const x=s.getContext('2d');x.font=GFONT;x.textAlign='center';x.textBaseline='middle';
 x.shadowColor=c;x.shadowBlur=11;x.fillStyle=c;x.fillText(gl,24,25);x.shadowBlur=0;x.fillText(gl,24,25);x.lineWidth=1;x.strokeStyle='rgba(255,255,255,.6)';x.strokeText(gl,24,25);MAPC.glyphs.set(k,s);return s;}
function wrap(t){t=String(t).toUpperCase();if(t.length<=17)return [t];const p=t.split(' / ');if(p.length===2)return [p[0]+' /',p[1]];const w=t.split(' ');let best=[t],score=1e9;
 for(let i=1;i<w.length;i++){const a=w.slice(0,i).join(' '),b=w.slice(i).join(' '),sc=Math.max(a.length,b.length);if(sc<score){score=sc;best=[a,b];}}return best;}
function label(lines,c,dim){const k=lines.join('|')+c+(dim?1:0);let s=MAPC.labels.get(k);if(s)return s;const mx=MAPC.mctx||(MAPC.mctx=document.createElement('canvas').getContext('2d'));mx.font=MFONT;if(dim)mx.letterSpacing='1px';
 const w=Math.ceil(Math.max(...lines.map(l=>mx.measureText(l).width)))+6,h=lines.length*11+3;mx.letterSpacing='0px';const cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;const x=cv.getContext('2d');x.scale(2,2);x.font=MFONT;x.textBaseline='top';x.lineJoin='round';if(dim)x.letterSpacing='1px';
 lines.forEach((l,i)=>{const y=2+i*11;x.lineWidth=3;x.strokeStyle='rgba(1,4,9,.94)';x.strokeText(l,3,y);x.fillStyle=c;if(!dim){x.shadowColor=c;x.shadowBlur=5;x.fillText(l,3,y);x.shadowBlur=0;}x.fillText(l,3,y);});s={cv,w,h};if(MAPC.labels.size>400)MAPC.labels.clear();MAPC.labels.set(k,s);return s;}
function overlay(){if(MAPC.overlay)return MAPC.overlay;const cv=document.createElement('canvas');cv.width=720;cv.height=840;const x=cv.getContext('2d');const g=x.createRadialGradient(360,420,200,360,420,580);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.62)');x.fillStyle=g;x.fillRect(0,0,720,840);
 x.fillStyle='rgba(0,229,255,.035)';for(let y=0;y<840;y+=4)x.fillRect(0,y,720,1);x.strokeStyle='rgba(0,229,255,.8)';x.lineWidth=2;for(const [cx,cy,sx,sy] of [[8,8,1,1],[712,8,-1,1],[8,832,1,-1],[712,832,-1,-1]]){x.beginPath();x.moveTo(cx,cy+sy*26);x.lineTo(cx,cy);x.lineTo(cx+sx*26,cy);x.stroke();}
 x.fillStyle='rgba(0,229,255,.6)';x.font="600 17px 'Chakra Petch',sans-serif";x.fillText('TACTICAL HOLO · SECTOR GRID',36,58);MAPC.overlay=cv;return cv;}
function mapPaint(ctx,m){const Wd=m.W,Cb=m.C,S=m.state||{},d=m.discovery,scale=m.scale,unit=280/Wd.WIDTH*scale;
 if(!MAPC.fontWait&&document.fonts&&!document.fonts.check(MFONT)){MAPC.fontWait=true;document.fonts.load(MFONT).then(()=>{MAPC.labels.clear();MAPC.overlay=null;m.repaint?.();}).catch(()=>{});}
 ctx.setTransform(2,0,0,2,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='#010409';ctx.fillRect(0,0,360,420);
 const vis={x0:(-40-m.px)/unit,x1:(320-m.px)/unit,z0:Wd.LENGTH+(m.py-420)/unit,z1:Wd.LENGTH+m.py/unit},rel=relief(m,unit,vis);
 if(rel&&rel.n){const dx=Math.round((40+m.px+rel.x0*unit)*2)/2,dy=Math.round((m.py+(1-rel.z1/Wd.LENGTH)*420*scale)*2)/2;ctx.imageSmoothingEnabled=true;ctx.drawImage(rel.canvas,dx,dy,(rel.x1-rel.x0)*unit,(rel.z1-rel.z0)*unit);}
 ctx.strokeStyle='rgba(0,229,255,.25)';ctx.lineWidth=1;ctx.strokeRect(40+m.px,m.py,280*scale,420*scale);
 // Lettered / numbered grid reference (columns west→east, rows south→north) for calling out positions.
 const tl=m.toWorld(0,0),br=m.toWorld(360,420),gs=[50,100,250,500,1000,2500,5000,10000].find(g=>g*unit>=46)||10000,gx0=Math.floor(tl.x/gs),gx1=Math.ceil(br.x/gs),gz0=Math.floor(br.z/gs),gz1=Math.ceil(tl.z/gs);
 ctx.strokeStyle='rgba(0,229,255,.12)';ctx.lineWidth=.8;ctx.beginPath();for(let i=gx0;i<=gx1;i++){const x=m.toScreen(i*gs,0).x;ctx.moveTo(x,12);ctx.lineTo(x,403);}for(let j=gz0;j<=gz1;j++){const y=m.toScreen(0,j*gs).y;ctx.moveTo(12,y);ctx.lineTo(360,y);}ctx.stroke();
 const ringL=[];for(const sec of Cb.sectors){const p=m.toScreen(sec.x,sec.z),r=sec.radius*unit;if(p.x+r<0||p.x-r>360||p.y+r<0||p.y-r>420)continue;const own=S.territory?.[sec.id]?.owner==='humanity',rgb=own?'0,229,255':'255,60,214';
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.lineWidth=4;ctx.strokeStyle='rgba('+rgb+',.08)';ctx.stroke();ctx.setLineDash([6,4]);ctx.lineWidth=1;ctx.strokeStyle='rgba('+rgb+',.55)';ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='rgba('+rgb+',.85)';ctx.lineWidth=1.4;ctx.beginPath();for(let k=0;k<4;k++){const a=k*Math.PI/2;ctx.moveTo(p.x+Math.cos(a)*(r-4),p.y+Math.sin(a)*(r-4));ctx.lineTo(p.x+Math.cos(a)*(r+4),p.y+Math.sin(a)*(r+4));}ctx.stroke();if(r>16)ringL.push({sec,p,r,own});}
 const player=m.player||{x:Cb.refuge.x,z:Cb.refuge.z,heading:0,none:true},you=m.toScreen(player.x,player.z),t=m.player?m.routeTarget:null;if(t){const q=m.toScreen(t.x,t.z);ctx.save();ctx.lineCap='round';ctx.strokeStyle='rgba(255,196,90,.2)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(you.x,you.y);ctx.lineTo(q.x,q.y);ctx.stroke();
  ctx.setLineDash([5,4]);ctx.strokeStyle='#ffc45a';ctx.lineWidth=1.6;ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(q.x,q.y,7,0,TAU);ctx.moveTo(q.x-11,q.y);ctx.lineTo(q.x-4,q.y);ctx.moveTo(q.x+4,q.y);ctx.lineTo(q.x+11,q.y);ctx.moveTo(q.x,q.y-11);ctx.lineTo(q.x,q.y-4);ctx.moveTo(q.x,q.y+4);ctx.lineTo(q.x,q.y+11);ctx.stroke();ctx.restore();}
 const marks=[],add=(wx,wz,g,c,txt,pri,o)=>marks.push(Object.assign({p:m.toScreen(wx,wz),g,c,t:txt,pri},o||{}));
 if(scale>=16)for(const l of Wd.landmarks)if(d.has(l.x,l.z))add(l.x,l.z,'·','#7fd3e0',l.name,1,{dim:true,dot:true});
 for(const s of Cb.installations)if(d.has(s.x,s.z)){const cap=S.territory?.[s.id]?.owner==='humanity';add(s.x,s.z,cap?'⚑':'▲',cap?'#5effd0':'#ff4fd8',s.name,5);}
 const ops=Object.values(Cb.operations);if(m.mission){const done=m.missionDone;add(m.mission.x,m.mission.z,done?'✓':'◆','#f1cd7e',m.mission.name,4);}
 for(const o of ops){if(o.raid||o.defense||o.id==='base-defense'||o.id==='oxygen-line'||Cb.installations.some(s=>s.id===o.site))continue;const sec=S.territory?.[o.site]?.owner==='humanity';add(o.x,o.z,sec?'⚑':'◆',sec?'#5effd0':'#ffd36b',o.name,4);}
 for(const sector of Cb.sectors){const list=ops.filter(o=>o.raid&&o.sector===sector.id);if(list.length){const cleared=list.filter(o=>S.completed?.[o.id]).length,un=Cb.raidsUnlocked(S.completed),done=cleared===list.length;
   add(list.reduce((n,o)=>n+o.x,0)/list.length,list.reduce((n,o)=>n+o.z,0)/list.length,done?'✓':'✦',done?'#5effd0':un?'#ffb347':'#8a93a0',un?'RAIDS '+cleared+'/'+list.length:'RAIDS · LOCKED',6);}
  if(Cb.sectorDefenseOpen(S.territory?.[sector.id],sector.id)){const o=ops.find(o=>o.defense&&o.sector===sector.id);if(o)add(o.x,o.z,'!','#ff4060',(S.territory[sector.id].owner==='humanity'?'DEFEND ':'RETAKE ')+sector.name,8);}}
 if(m.convoy){const a=m.toScreen(1090,944),b=m.toScreen(1090,809);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#ffb347';ctx.lineWidth=2;ctx.stroke();}
 const Bd=Cb.baseDefinition;add(Bd.x,Bd.z,'⌂','#ffc45a','COMMAND BASE '+(S.base?.tier?'T'+S.base.tier:'SITE'),9,{left:true});
 for(const w of S.wrecks||[])if(d.has(w.x,w.z))add(w.x,w.z,'◇','#8ee6ef','PERSONAL WRECK',3);add(Cb.refuge.x,Cb.refuge.z,'●','#3fe9ff','REFUGE',10);
 for(const k of marks){if(k.p.x<-12||k.p.x>372||k.p.y<-12||k.p.y>432)continue;if(k.dot){ctx.fillStyle=k.c;ctx.beginPath();ctx.arc(k.p.x,k.p.y,2,0,TAU);ctx.fill();}else ctx.drawImage(glyph(k.g,k.c),k.p.x-12,k.p.y-12,24,24);}
 const ys=label(['YOU'],'#ffffff',false),obst=[{x:0,y:403,w:360,h:17},{x:0,y:0,w:360,h:12},{x:0,y:0,w:12,h:420},{x:12,y:18,w:150,h:16},{x:you.x-13,y:you.y-13,w:26,h:26},{x:you.x-ys.w/2,y:you.y-16-ys.h,w:ys.w,h:ys.h}];
 for(const k of marks)if(!k.dot)obst.push({x:k.p.x-7,y:k.p.y-7,w:14,h:14});
 const items=[];for(const k of marks){if(!k.t||k.p.x<-10||k.p.x>370||k.p.y<-10||k.p.y>430)continue;items.push({p:k.p,s:label(wrap(k.t),k.c,k.dim),pri:k.pri,c:k.c,left:k.left});}
 for(const rl of ringL)items.push({p:rl.p,ring:rl,s:label([rl.sec.name],rl.own?'#61eaf6':'#ff74e0',true),pri:7,c:rl.own?'#61eaf6':'#ff74e0'});
 items.sort((a,b)=>b.pri-a.pri||(Math.hypot(a.p.x-you.x,a.p.y-you.y)-Math.hypot(b.p.x-you.x,b.p.y-you.y)));
 const placed=obst.slice(),fits=r=>r.x>=13&&r.y>=13&&r.x+r.w<=358&&r.y+r.h<=402&&!placed.some(o=>r.x<o.x+o.w&&r.x+r.w>o.x&&r.y<o.y+o.h&&r.y+r.h>o.y);
 for(const it of items){const w=it.s.w,h=it.s.h;let cands;
  if(it.ring){cands=[];for(const deg of [-90,-66,-114,-42,-138,-18,-162,90,66,114]){const a=deg*Math.PI/180;cands.push([Math.cos(a)*it.ring.r-w/2,Math.sin(a)*it.ring.r-h/2,0]);}}
  else{const near=[[9,-h/2,0],[-9-w,-h/2,0],[-w/2,-10-h,0],[-w/2,10,0]];if(it.left)near.unshift(near.splice(1,1)[0]);cands=near.concat([[16,-h-8,1],[16,8,1],[-16-w,-h-8,1],[-16-w,8,1],[-w/2,-22-h,1],[-w/2,22,1],[30,-h/2,1],[-30-w,-h/2,1],[26,-h-22,1],[-26-w,-h-22,1],[26,20,1],[-26-w,20,1],[-w/2,-36-h,1],[-w/2,36,1],[46,-h-6,1],[-46-w,-h-6,1],[44,14,1],[-44-w,14,1]]);}
  for(const [dx,dy,lead] of cands){const r={x:it.p.x+dx,y:it.p.y+dy,w,h};if(fits(r)){placed.push(r);it.at={r,lead};break;}}}
 for(const it of items){if(!it.at)continue;const r=it.at.r;if(it.at.lead){const nx=Math.max(r.x,Math.min(it.p.x,r.x+r.w)),ny=Math.max(r.y,Math.min(it.p.y,r.y+r.h)),dx=nx-it.p.x,dy=ny-it.p.y,l=Math.hypot(dx,dy)||1;
   ctx.globalAlpha=.65;ctx.strokeStyle=it.c;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(it.p.x+dx/l*8,it.p.y+dy/l*8);ctx.lineTo(nx,ny);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=it.c;ctx.fillRect(nx-1.2,ny-1.2,2.4,2.4);}
  ctx.drawImage(it.s.cv,r.x,r.y,it.s.w,it.s.h);}
 if(!player.none){ctx.save();ctx.translate(you.x,you.y);ctx.fillStyle='rgba(0,229,255,.16)';ctx.beginPath();ctx.arc(0,0,14,0,TAU);ctx.fill();ctx.strokeStyle='rgba(170,250,255,.95)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,11,0,TAU);ctx.stroke();
 ctx.rotate(player.heading||0);ctx.shadowColor='#00e5ff';ctx.shadowBlur=8;ctx.fillStyle='#3fe9ff';ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(6.5,6.5);ctx.lineTo(0,3);ctx.lineTo(-6.5,6.5);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();ctx.restore();
 ctx.drawImage(ys.cv,you.x-ys.w/2,you.y-16-ys.h,ys.w,ys.h);}ctx.drawImage(overlay(),0,0,360,420);
 // Grid margins: column letters along the top, row numbers down the left.
 ctx.fillStyle='rgba(1,8,14,.9)';ctx.fillRect(0,0,360,12);ctx.fillRect(0,12,12,391);ctx.strokeStyle='rgba(0,229,255,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(12,12.5);ctx.lineTo(360,12.5);ctx.moveTo(12.5,12);ctx.lineTo(12.5,403);ctx.stroke();
 ctx.font=MFONT;ctx.fillStyle='#6fe3f0';ctx.textAlign='center';ctx.textBaseline='middle';for(let i=gx0;i<gx1;i++){const x=m.toScreen((i+.5)*gs,0).x;if(x>22&&x<350)ctx.fillText(colName(i),x,6.5);}
 for(let j=gz0;j<gz1;j++){const y=m.toScreen(0,(j+.5)*gs).y;if(y>20&&y<398){ctx.save();ctx.translate(6.5,y);ctx.rotate(-Math.PI/2);ctx.fillText(String(j).padStart(2,'0'),0,0);ctx.restore();}}
 ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='#5fd8e8';ctx.fillText('GRID '+gs+' M · N ↑ · '+Math.round(Wd.WIDTH/scale)+' M ACROSS',10,414);
 const sb=100*unit;if(sb>8&&sb<200){ctx.strokeStyle='#5fd8e8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(350-sb,411);ctx.lineTo(350,411);ctx.moveTo(350-sb,407);ctx.lineTo(350-sb,414);ctx.moveTo(350,407);ctx.lineTo(350,414);ctx.stroke();ctx.textAlign='right';ctx.fillText('100 m',350,404);ctx.textAlign='left';}}
const MAP_LEGEND='<span class="cq-holo-key">HOLO RELIEF · explored ground only.</span> <b style="color:#ffd36b">◆</b> Mission · <b style="color:#ffb347">✦</b> Raid site (<b style="color:#5effd0">✓</b> cleared · grey locked) · <b style="color:#ff4060">!</b> Defense alert · <b style="color:#3fe9ff">●</b> Refuge · <b style="color:#ffc45a">⌂</b> Command Base · <b style="color:#ff4fd8">▲</b> Parasite installation (when discovered; <b style="color:#5effd0">⚑</b> captured) · <b style="color:#8ee6ef">◇</b> Wreck. Grid letters + numbers call out positions. Drag to pan · pinch or + / − to zoom · north ↑.';

root.ConquestStyle=Object.freeze({id:'neon-frontline',version:1,create,footprints,allSites,map:mapPaint,MAP_LEGEND,resetMapCache(){MAPC.relief=null;}});
})(typeof window!=='undefined'?window:globalThis);
