/* LUNAR Conquest style lab — option B · NEON FRONTLINE · STYLIZED SCI-FI (dev-only Phase 1 sample; never loaded by the game).
 *
 * Fixed material set, all created once before the first frame (5 programs + the stock tank's Phong/Basic):
 *  SKY     ShaderMaterial: black dome + teal/violet horizon band + vertex-coloured nebula + stars + Earth, ONE draw.
 *  TERRAIN ShaderMaterial: world-space regolith, 2–3 crater scales (normal-perturbing rims), slope strata, terraformed
 *          bioluminescent lichen, friendly hex grid / scan rings, Parasite creep veins (site table uniform). Fog-aware.
 *  SOLID   ShaderMaterial (Mesh + InstancedMesh): key + hemi + coloured site rim + fresnel; vertex alpha = emissive
 *          (alpha > 1 = pulsing vein). Every structure is merged into one vertex-coloured draw per site.
 *  FX      ShaderMaterial, premultiplied blending: rgb = additive glow, alpha = contact darkening. Decals, halos,
 *          beams, holo signs and ring glows share one 512² mask atlas (R = glow mask, G = shadow mask).
 * Fake bloom is geometry only; no render targets, no post-processing, no shadow map.
 */
(function(root){
'use strict';
const T=root.THREE,LAB=root.ConquestStyleLab,TAU=Math.PI*2;
let CORE=null;
const lin=h=>new T.Color(h);
const E=(h,i=1)=>{const c=new T.Color(h);return [c.r*i,c.g*i,c.b*i];};
const V3=(x,y,z)=>new T.Vector3(x,y,z);
const _v=new T.Vector3(),_w=new T.Vector3(),_p=new T.Vector3(),_s=new T.Vector3(),_q=new T.Quaternion(),_e=new T.Euler(),_nm=new T.Matrix4(),_t=new T.Matrix4();
function M(x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){_e.set(rx,ry,rz);_q.setFromEuler(_e);return new T.Matrix4().compose(_p.set(x,y,z),_q,_s.set(sx,sy,sz));}
function MR(x,z,a,ly,lr,tilt,sx,sy,sz){const m=new T.Matrix4().makeTranslation(x,0,z);m.multiply(_t.makeRotationY(a));m.multiply(_t.makeTranslation(0,ly,lr));m.multiply(_t.makeRotationX(tilt));m.multiply(_t.makeScale(sx,sy,sz));return m;}
function MD(a,b,r){const d=_w.subVectors(b,a),len=d.length()||1e-3;_q.setFromUnitVectors(_p.set(0,1,0),d.multiplyScalar(1/len));return new T.Matrix4().compose(a.clone(),_q,_s.set(r,len,r));}
function MDc(a,b,t){const d=_w.subVectors(b,a),len=d.length()||1e-3;_q.setFromUnitVectors(_p.set(0,1,0),d.multiplyScalar(1/len));return new T.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),_q,_s.set(t,len,t));}
const clamp01=v=>v<0?0:v>1?1:v;

// ---------- palette (linear) ----------
const K={dark:lin(0x222932),dark2:lin(0x2e3844),mid:lin(0x4a5664),panelA:lin(0x9ba8b4),panelB:lin(0xc2ccd5),roof:lin(0x76838f),
 cyan:lin(0x22e6ff),ice:lin(0xa8f8ff),teal:lin(0x2dffc4),amber:lin(0xffb347),red:lin(0xff3048),navy:lin(0x0d1729),
 chitin:lin(0x2b1531),chitinD:lin(0x150a19),wall:lin(0x2c2833),wallTop:lin(0x4a4352),mag:lin(0xff2bd6),magHot:lin(0xff7ae8)};
// World-space light sites: x, z, radius, type (>0 friendly hex/cyan spill strength, <0 Parasite creep / magenta rim).
const SITES=[[1132,1173,80,1],[1174,1168,22,1.3],[1080,1160,46,.9],[1180,1080,56,.55],[994,952,48,-1],[927,934,28,-1],[1230,995,34,-1],[1240,920,34,-1]];
const PYLONS=[[1121,1160.5],[1143,1160.5],[1121,1185.5],[1143,1185.5],[1099,1160.5],[1165,1185.5],[1121,1135],[1143,1135],[1099,1210],[1165,1210]];

// ---------- GLSL ----------
const HASH=`float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec2 h22(vec2 p){vec3 p3=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),u.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x),u.y);}`;
const TERRAIN_VS=`varying vec2 vW;varying vec3 vN;varying vec3 vC;varying float vY;varying float vD;
#include <common>
#include <fog_pars_vertex>
void main(){vW=uv*24.;vN=normal;vC=color;vY=position.y;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;vD=-mvPosition.z;
#include <fog_vertex>
}`;
const TERRAIN_FS=`uniform vec3 uSunDir,uSunCol,uRimDir,uRimCol,uAmbUp,uAmbDn;uniform vec4 uSite[8];uniform float uTime;
varying vec2 vW;varying vec3 vN;varying vec3 vC;varying float vY;varying float vD;
#include <common>
#include <fog_pars_fragment>
${HASH}
float hexEdge(vec2 p){const vec2 r=vec2(1.,1.7320508);vec2 h=r*.5;vec2 a=mod(p,r)-h;vec2 b=mod(p-h,r)-h;vec2 g=dot(a,a)<dot(b,b)?a:b;vec2 q=abs(g);return .5-max(dot(q,vec2(.5,.8660254)),q.x);}
vec2 crater(vec2 p,float cell,float seed,float dens,float k,inout vec2 grad){vec2 g=p/cell+seed;vec2 id=floor(g);vec2 f=fract(g)-.5;vec2 r=h22(id);
 if(r.x>dens)return vec2(0.);float rad=.2+.2*r.y;vec2 c=(h22(id+7.31)-.5)*(.9-2.*rad);vec2 d=(f-c)/rad;float q=length(d);if(q>1.7)return vec2(0.);
 float rim=exp(-(q-1.)*(q-1.)*22.);float dh=(q<1.?1.2*q:0.)-15.4*(q-1.)*rim;grad+=k*dh*d/max(q,.001);return vec2(rim,q<1.?1.-q*q:0.);}
void main(){vec3 c=vC;float terra=smoothstep(.03,.08,c.g-max(c.r,c.b));float massif=smoothstep(.0,.06,c.b-c.r);
 float lod=clamp(1.-vD/320.,0.,1.),lod2=clamp(1.-vD/1500.,0.,1.);vec2 grad=vec2(0.),gm=vec2(0.);
 vec2 k1=crater(vW,118.,0.,.62,.2,grad);vec2 k2=crater(vW,37.,3.7,.55,.3,gm);grad+=gm*lod2;k2*=lod2;vec2 k3=vec2(0.);
#ifdef HIGH
 vec2 gs=vec2(0.);k3=crater(vW,11.5,9.1,.5,.34,gs)*lod;grad+=gs*lod;
#endif
 float rim=k1.x+k2.x+k3.x,bowl=max(max(k1.y,k2.y),k3.y);
 float tone=.7+.42*vn(vW*.021)+.24*(vn(vW*.093+3.1)-.5);
#ifdef HIGH
 tone+=.16*(vn(vW*.41+7.7)-.5)*lod;
#endif
 vec3 rego=mix(vec3(.074,.078,.088),vec3(.055,.064,.082),massif)*tone;
 vec3 N=normalize(vN+vec3(-grad.x,0.,-grad.y));float steep=smoothstep(.3,.62,1.-N.y);
 rego=mix(rego,rego*(.55+.5*vn(vec2(vY*.32,(vW.x+vW.y)*.018))),steep);rego*=(1.-.32*bowl)*(1.+.6*rim);rego*=1.-.38*terra;
 float lp=smoothstep(.5,.74,vn(vW*.055+11.)*.62+vn(vW*.21)*.38)*terra;float speck=step(.84,h12(floor(vW*1.6)))*lp;
 vec3 em=vec3(.0,.62,.5)*(lp*.12+speck*.45)*(.45+.55*lod);float blight=0.;
 for(int i=0;i<8;i++){vec4 s=uSite[i];if(s.z<=0.)continue;float dist=length(vW-s.xy);if(dist>s.z)continue;float fall=1.-dist/s.z;fall*=fall;
  if(s.w>0.){float he=hexEdge(vW/6.);float line=1.-smoothstep(0.,fwidth(he)*1.2+.02,he);float ring=smoothstep(.93,1.,fract(dist/22.-uTime*.08));
   em+=vec3(.05,.72,1.)*(line*.15*fall*s.w+ring*.13*fall+.035*fall*s.w);}else blight=max(blight,fall);}
 if(blight>0.){float v=abs(vn(vW*.14)*2.-1.),v2=abs(vn(vW*.42+5.)*2.-1.);float vein=(1.-smoothstep(0.,.08,v))+(1.-smoothstep(0.,.06,v2))*.5;
  rego=mix(rego,rego*vec3(.75,.45,.85),blight);em+=vec3(1.,.08,.62)*vein*blight*.5*(.7+.3*sin(uTime*2.3-dot(vW,vec2(.05))));}
 float ndl=max(dot(N,uSunDir),0.);vec3 light=uSunCol*ndl+mix(uAmbDn,uAmbUp,N.y*.5+.5)+uRimCol*max(dot(N,uRimDir),0.)*.7;
 vec3 col=rego*light+em+uRimCol*rim*.03;col+=(h12(gl_FragCoord.xy)-.5)/255.;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
const SOLID_VS=`attribute vec4 aCol;uniform vec4 uSite[8];uniform vec2 uOrigin;uniform vec3 uRimCol;
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
 wp=modelMatrix*wp;vWP=wp.xyz;vec2 w=wp.xz+uOrigin;vec3 rc=uRimCol*2.2;float best=0.;
 for(int i=0;i<8;i++){vec4 s=uSite[i];if(s.z<=0.)continue;float f=1.-smoothstep(s.z*.6,s.z*1.25,length(w-s.xy));if(f>best){best=f;rc=mix(uRimCol*2.2,s.w>0.?vec3(.06,.62,.8):vec3(.85,.05,.55),f);}}
 vRim=rc;}`;
const SOLID_FS=`uniform vec3 uSunDir,uSunCol,uRimDir,uAmbUp,uAmbDn;uniform float uTime,uGlow;
varying vec3 vN;varying vec3 vV;varying vec4 vCol;varying vec3 vRim;varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
void main(){vec3 N=normalize(vN),V=normalize(vV);vec3 L=normalize((viewMatrix*vec4(uSunDir,0.)).xyz),R=normalize((viewMatrix*vec4(uRimDir,0.)).xyz),UP=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz);
 vec3 base=vCol.rgb;float ndl=max(dot(N,L),0.);vec3 lit=base*(uSunCol*ndl+mix(uAmbDn,uAmbUp,dot(N,UP)*.5+.5));
 float rl=max(dot(N,R),0.);lit+=base*vRim*rl*.5;float fr=pow(1.-max(dot(N,V),0.),3.);lit+=vRim*fr*(.25+.75*rl)*.45;
#ifdef HIGH
 vec3 H=normalize(L+V);lit+=uSunCol*pow(max(dot(N,H),0.),56.)*.16;
#endif
 float a=vCol.a,em=clamp(a>1.?a-1.:a,0.,1.);float pulse=a>1.?.5+.5*sin(uTime*3.+dot(vWP,vec3(.37,.61,.23))):1.;
 vec3 col=mix(lit,base*uGlow*(.45+.55*pulse),em);gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
const FX_VS=`attribute vec4 aCol;attribute vec3 aBill;uniform vec3 uKind[4];varying vec4 vCol;varying vec2 vUv;
#include <common>
#include <fog_pars_vertex>
void main(){vUv=uv;vCol=aCol;vec4 mvPosition=vec4(position*(1.-aBill.z),1.);float bs=1.;
#ifdef USE_INSTANCING
 mvPosition=instanceMatrix*mvPosition;bs=length(instanceMatrix[0].xyz);float k=instanceMatrix[2].z;vCol.rgb*=k<1.5?uKind[0]:k<2.5?uKind[1]:k<3.5?uKind[2]:uKind[3];
#endif
 mvPosition=modelViewMatrix*mvPosition;mvPosition.xy+=aBill.xy*bs;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
const FX_FS=`uniform sampler2D uMap;varying vec4 vCol;varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
void main(){vec4 t=texture2D(uMap,vUv);vec3 e=vCol.rgb*t.r;float o=vCol.a*t.g;
#ifdef USE_FOG
#ifdef FOG_EXP2
 float f=exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
#else
 float f=1.-smoothstep(fogNear,fogFar,vFogDepth);
#endif
 e*=f;o*=f;
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

// ---------- procedural textures ----------
const AT={};
function region(name,x,y,w,h){AT[name]=[x/512,1-(y+h)/512,(x+w)/512,1-y/512];}
region('SOLID',0,0,64,64);region('BEAM',0,64,64,192);region('BLOB',64,0,128,128);region('RING',192,0,128,128);region('HEX',320,0,128,128);
region('DASH',64,128,128,128);region('ICON',192,128,128,128);region('GRID',320,128,128,128);
const SIGNS=['HAB 01','HAB 02','HAB 03','HAB 04','HAB 05','HAB 06','HAB 07','HAB 08','HAB 09','SUPPLY','O2 01','O2 02','O2 03','SOLAR','HUB','DEPOT'];
SIGNS.forEach((s,i)=>region('S'+i,(i%4)*128,256+Math.floor(i/4)*32,128,32));
function makeAtlas(size){const cv=document.createElement('canvas');cv.width=cv.height=size;const x=cv.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,size,size);x.scale(size/512,size/512);
 const rad=(cx,cy,stops,col)=>{const g=x.createRadialGradient(cx,cy,0,cx,cy,62);for(const [o,v] of stops)g.addColorStop(o,col(v));x.fillStyle=g;x.fillRect(cx-64,cy-64,128,128);};
 x.fillStyle='#ffff00';x.fillRect(0,0,64,64);
 let g=x.createLinearGradient(0,252,0,68);g.addColorStop(0,'#ff0000');g.addColorStop(.55,'#600000');g.addColorStop(1,'#000');x.fillStyle=g;x.fillRect(6,68,52,184);
 x.fillStyle='rgba(0,0,0,.35)';for(let y=70;y<252;y+=6)x.fillRect(6,y,52,2);
 rad(128,64,[[0,255],[.22,200],[.5,80],[.78,18],[1,0]],v=>'rgb('+v+','+v+',0)');
 rad(256,64,[[0,0],[.5,10],[.7,80],[.8,255],[.86,110],[.95,12],[1,0]],v=>'rgb('+v+',0,0)');
 x.save();x.translate(384,64);x.lineJoin='round';const hex=(r)=>{x.beginPath();for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3;x.lineTo(Math.sin(a)*r,Math.cos(a)*r);}x.closePath();};
 hex(58);x.fillStyle='rgb(40,0,0)';x.fill();x.lineWidth=5;x.strokeStyle='#ff0000';x.stroke();hex(48);x.lineWidth=2;x.strokeStyle='rgb(170,0,0)';x.stroke();
 x.strokeStyle='rgb(90,0,0)';x.lineWidth=1.5;for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3;x.beginPath();x.moveTo(Math.sin(a)*14,Math.cos(a)*14);x.lineTo(Math.sin(a)*48,Math.cos(a)*48);x.stroke();}
 x.beginPath();x.arc(0,0,14,0,TAU);x.lineWidth=3;x.strokeStyle='#ff0000';x.stroke();x.restore();
 x.save();x.translate(128,192);x.setLineDash([11,7]);x.lineWidth=4;x.strokeStyle='#ff0000';x.beginPath();x.arc(0,0,59,0,TAU);x.stroke();x.setLineDash([]);x.lineWidth=1.5;x.strokeStyle='rgb(120,0,0)';x.beginPath();x.arc(0,0,53,0,TAU);x.stroke();x.restore();
 x.save();x.translate(256,192);x.strokeStyle='#ff0000';x.lineWidth=5;x.lineJoin='round';x.strokeRect(-30,-22,60,48);x.beginPath();x.moveTo(-30,-8);x.lineTo(30,-8);x.stroke();x.fillStyle='#ff0000';x.fillRect(-5,-2,10,22);x.fillRect(-13,6,26,8);
 x.lineWidth=3;x.beginPath();x.moveTo(-44,-44);x.lineTo(-44,-32);x.moveTo(-44,-44);x.lineTo(-32,-44);x.moveTo(44,44);x.lineTo(44,32);x.moveTo(44,44);x.lineTo(32,44);x.moveTo(44,-44);x.lineTo(32,-44);x.moveTo(44,-44);x.lineTo(44,-32);x.moveTo(-44,44);x.lineTo(-32,44);x.moveTo(-44,44);x.lineTo(-44,32);x.stroke();x.restore();
 x.strokeStyle='#ff0000';x.lineWidth=2;for(let i=0;i<=8;i++){x.beginPath();x.moveTo(324+i*15,132);x.lineTo(324+i*15,252);x.stroke();x.beginPath();x.moveTo(324,132+i*15);x.lineTo(444,132+i*15);x.stroke();}
 x.textAlign='center';x.textBaseline='middle';SIGNS.forEach((s,i)=>{const cx=(i%4)*128,cy=256+Math.floor(i/4)*32;x.strokeStyle='rgb(150,0,0)';x.lineWidth=2;x.strokeRect(cx+5,cy+4,118,24);x.fillStyle='#ff0000';x.fillRect(cx+5,cy+4,5,24);x.fillRect(cx+118,cy+4,5,24);
  x.font="700 19px 'Chakra Petch',sans-serif";x.fillText(s,cx+64,cy+17);});
 const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.ClampToEdgeWrapping;return t;}
function hash3(x,y,z){let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1440662683))|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function vn3(x,y,z){const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf),L=(a,b,t)=>a+(b-a)*t;
 return L(L(L(hash3(xi,yi,zi),hash3(xi+1,yi,zi),u),L(hash3(xi,yi+1,zi),hash3(xi+1,yi+1,zi),u),v),L(L(hash3(xi,yi,zi+1),hash3(xi+1,yi,zi+1),u),L(hash3(xi,yi+1,zi+1),hash3(xi+1,yi+1,zi+1),u),v),w);}
function fbm3(x,y,z,o){let s=0,a=.5,f=1,n=0;for(let i=0;i<o;i++){s+=a*vn3(x*f,y*f,z*f);n+=a;a*=.5;f*=2.03;}return s/n;}
function makeEarth(w,h){const cv=document.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d'),img=x.createImageData(w,h),D=img.data;
 for(let j=0;j<h;j++){const lat=(.5-j/(h-1))*Math.PI;for(let i=0;i<w;i++){const lon=i/w*TAU-Math.PI,px=Math.cos(lat)*Math.sin(lon),py=Math.sin(lat),pz=Math.cos(lat)*Math.cos(lon);
  const n=fbm3(px*1.7+5,py*1.7,pz*1.7,5),cl=fbm3(px*3.1+9,py*3.6,pz*3.1,4);let r,g,b;
  if(n>.53){const k=Math.min(1,(n-.53)*5);r=50+120*k;g=95+55*k;b=55+30*k;}else{const k=clamp01((n-.4)/.13);r=6+18*k;g=34+70*k;b=96+80*k;}
  if(Math.abs(py)>.86){r=g=b=230;}const c=clamp01((cl-.52)*2.8);r+=(240-r)*c;g+=(246-g)*c;b+=(255-b)*c;const o=(j*w+i)*4;D[o]=r;D[o+1]=g;D[o+2]=b;D[o+3]=255;}}
 x.putImageData(img,0,0);const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;t.wrapS=T.RepeatWrapping;t.wrapT=T.ClampToEdgeWrapping;t.generateMipmaps=false;t.minFilter=T.LinearFilter;return t;}

// ---------- geometry builders ----------
function flat(g){const n=g.index?g.toNonIndexed():g;n.computeVertexNormals();return n;}
class Bld{constructor(){this.P=[];this.N=[];this.A=[];this.I=[];this.n=0;}
 add(geo,m,c,em=0,ao=null,grad=null){const P=geo.attributes.position,N=geo.attributes.normal,ix=geo.index;_nm.copy(m).invert().transpose();
  for(let i=0;i<P.count;i++){_v.fromBufferAttribute(P,i).applyMatrix4(m);this.P.push(_v.x,_v.y,_v.z);_w.fromBufferAttribute(N,i).transformDirection(_nm);this.N.push(_w.x,_w.y,_w.z);
   let r,g,b,a;if(grad){const o=grad(_v,P.getX(i),P.getY(i),P.getZ(i));r=o[0];g=o[1];b=o[2];a=o[3];}else{r=c.r;g=c.g;b=c.b;a=em;}
   if(ao&&a<.5){const k=.4+.6*clamp01((_v.y-ao[0])/ao[1]);r*=k;g*=k;b*=k;}this.A.push(r,g,b,a);}
  if(ix)for(let k=0;k<ix.count;k++)this.I.push(ix.getX(k)+this.n);else for(let k=0;k<P.count;k++)this.I.push(this.n+k);this.n+=P.count;return this;}
 box(x,y,z,w,h,d,c,em=0,ry=0,ao=null){return this.add(CORE.G.box,M(x,y,z,0,ry,0,w,h,d),c,em,ao);}
 seg(a,b,t,c,em=0){return this.add(CORE.G.box,MDc(a,b,t),c,em);}
 spike(a,b,r,c,em=0,geo){return this.add(geo||CORE.G.cone5,MD(a,b,r),c,em);}
 geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.P,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.N,3));g.setAttribute('aCol',new T.Float32BufferAttribute(this.A,4));g.setIndex(this.I);g.computeBoundingSphere();return g;}
 mesh(){return this.n?new T.Mesh(this.geometry(),CORE.MAT.solid):new T.Group();}}
class Fx{constructor(){this.P=[];this.U=[];this.A=[];this.B=[];this.I=[];this.n=0;}
 v(x,y,z,u,v,e,o,bx=0,by=0){this.P.push(x,y,z);this.U.push(u,v);this.A.push(e[0],e[1],e[2],o);this.B.push(bx,by,0);return this.n++;}
 q4(a,b,c,d){this.I.push(a,b,c,a,c,d);}
 bill(x,y,z,s,r,e,o=0){const a=this.v(x,y,z,r[0],r[1],e,o,-s,-s),b=this.v(x,y,z,r[2],r[1],e,o,s,-s),c=this.v(x,y,z,r[2],r[3],e,o,s,s),d=this.v(x,y,z,r[0],r[3],e,o,-s,s);this.q4(a,b,c,d);}
 quadV(x,y,z,w,h,ry,r,e,o=0){const cx=Math.cos(ry)*w/2,cz=-Math.sin(ry)*w/2;this.q4(this.v(x-cx,y-h/2,z-cz,r[0],r[1],e,o),this.v(x+cx,y-h/2,z+cz,r[2],r[1],e,o),this.v(x+cx,y+h/2,z+cz,r[2],r[3],e,o),this.v(x-cx,y+h/2,z-cz,r[0],r[3],e,o));}
 quad(p,r,e,o=0){this.q4(this.v(p[0].x,p[0].y,p[0].z,r[0],r[1],e,o),this.v(p[1].x,p[1].y,p[1].z,r[2],r[1],e,o),this.v(p[2].x,p[2].y,p[2].z,r[2],r[3],e,o),this.v(p[3].x,p[3].y,p[3].z,r[0],r[3],e,o));}
 flat(x,y,z,hw,hd,r,e,o=0){this.q4(this.v(x-hw,y,z-hd,r[0],r[1],e,o),this.v(x+hw,y,z-hd,r[2],r[1],e,o),this.v(x+hw,y,z+hd,r[2],r[3],e,o),this.v(x-hw,y,z+hd,r[0],r[3],e,o));}
 decal(api,cx,cz,hw,hd,rot,r,e,o,seg,lift){const cs=Math.cos(rot),sn=Math.sin(rot),base=this.n;
  for(let j=0;j<=seg;j++)for(let i=0;i<=seg;i++){const u=i/seg,v=j/seg,lx=(u*2-1)*hw,lz=(v*2-1)*hd,x=cx+lx*cs+lz*sn,z=cz-lx*sn+lz*cs;this.v(x,api.ground(x,z)+lift,z,r[0]+(r[2]-r[0])*u,r[1]+(r[3]-r[1])*v,e,o);}
  for(let j=0;j<seg;j++)for(let i=0;i<seg;i++){const a=base+j*(seg+1)+i;this.q4(a,a+1,a+seg+2,a+seg+1);}}
 band(x,z,y0,r0,r1,h,e0,e1,seg=16){const base=this.n,S=AT.SOLID,u=(S[0]+S[2])/2,v=(S[1]+S[3])/2;for(let k=0;k<=seg;k++){const a=k/seg*TAU,c=Math.cos(a),s=Math.sin(a);this.v(x+c*r0,y0,z+s*r0,u,v,e0,0);this.v(x+c*r1,y0+h,z+s*r1,u,v,e1,0);}
  for(let k=0;k<seg;k++){const a=base+k*2;this.q4(a,a+2,a+3,a+1);}}
 ringGlow(x,z,y,R,h,e,seg){const z0=[0,0,0];this.band(x,z,y-h/2,R,R,h/2,z0,e,seg);this.band(x,z,y,R,R,h/2,e,z0,seg);}
 mesh(){if(!this.n)return new T.Group();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.P,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.U,2));
  g.setAttribute('aCol',new T.Float32BufferAttribute(this.A,4));g.setAttribute('aBill',new T.Float32BufferAttribute(this.B,3));g.setIndex(this.I);g.computeBoundingSphere();const m=new T.Mesh(g,CORE.MAT.fx);m.renderOrder=2;return m;}}
function blob(detail,amp,seed){const g=new T.IcosahedronGeometry(1,detail),p=g.attributes.position,cache=new Map();
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=Math.round(x*997)+','+Math.round(y*997)+','+Math.round(z*997);let f=cache.get(k);if(f===undefined){f=1-amp+2*amp*hash3(Math.round(x*97)+seed,Math.round(y*97),Math.round(z*97));cache.set(k,f);}
  let yy=y*f;if(yy<-.45)yy=-.45+(yy+.45)*.25;p.setXYZ(i,x*f,yy,z*f);}
 let mx=0,my=0,mz=0;for(let i=0;i<p.count;i++){mx=Math.max(mx,Math.abs(p.getX(i)));my=Math.max(my,p.getY(i));mz=Math.max(mz,Math.abs(p.getZ(i)));}g.scale(1/mx,1/my,1/mz);g.computeVertexNormals();return g;}
const gradC=(y0,y1,c0,c1,c2)=>v=>{const t=clamp01((v.y-y0)/(y1-y0));if(t<.2)return [c0[0],c0[1],c0[2],0];if(t<.62){const k=(t-.2)/.42;return [c0[0]+(c1[0]-c0[0])*k,c0[1]+(c1[1]-c0[1])*k,c0[2]+(c1[2]-c0[2])*k,.2+.4*k];}
 const k=(t-.62)/.38;return [c1[0]+(c2[0]-c1[0])*k,c1[1]+(c2[1]-c1[1])*k,c1[2]+(c2[2]-c1[2])*k,.6+.4*k];};
const CYC=[[.008,.045,.06],[.03,.4,.55],[.5,1,1]],MAGC=[[.03,.005,.035],[.5,.02,.4],[1,.5,.95]];

function core(api){
 if(CORE)return CORE;
 const high=!api.low,DEF=high?{HIGH:''}:{};
 const U={uTime:{value:0},uSunDir:{value:V3(-.55,.5,.67).normalize()},uSunCol:{value:lin(0xe4ecff).multiplyScalar(2.9/Math.PI)},
  uRimDir:{value:V3(.62,.32,-.72).normalize()},uRimCol:{value:lin(0x52c6ff).multiplyScalar(1.15/Math.PI)},
  uAmbUp:{value:lin(0x3a5a9c).multiplyScalar(1.5/Math.PI)},uAmbDn:{value:lin(0x16131f).multiplyScalar(1.5/Math.PI)},
  uSite:{value:SITES.map(s=>new T.Vector4(...s))},uOrigin:{value:new T.Vector2(api.origin?api.origin.x:0,api.origin?api.origin.z:0)},
  uGlow:{value:2.3},uViewport:{value:new T.Vector2(800,800)},
  fogColor:{value:new T.Color(0x06070f)},fogNear:{value:900},fogFar:{value:2600},fogDensity:{value:.00025}};
 const G={box:new T.BoxGeometry(1,1,1),hex:flat(new T.CylinderGeometry(1,1,1,6,1,false,Math.PI/6)).translate(0,.5,0),oct:flat(new T.CylinderGeometry(1,1,1,8,1,false,Math.PI/8)).translate(0,.5,0),
  cyl:new T.CylinderGeometry(1,1,1,16,1).translate(0,.5,0),cylC:new T.CylinderGeometry(1,1,1,10,1),cone5:flat(new T.ConeGeometry(1,1,5)).translate(0,.5,0),cone6:flat(new T.ConeGeometry(1,1,6)).translate(0,.5,0),
  torus:new T.TorusGeometry(1,.065,6,40),ico:new T.IcosahedronGeometry(1,2),octa:new T.OctahedronGeometry(1,0),blob1:blob(1,.13,11),blob2:blob(2,.06,23),rock:blob(1,.17,5),
  shard:flat(new T.LatheGeometry([new T.Vector2(0,-.02),new T.Vector2(.3,0),new T.Vector2(.34,.68),new T.Vector2(0,1)],6)),
  pod:new T.LatheGeometry([[0,0],[.1,0],[.12,.3],[.3,.5],[.34,.66],[.26,.8],[.1,.9],[0,.92]].map(([r,y])=>new T.Vector2(r,y)),8)};
 const fr={};G.hexF=r=>fr['h'+r]||(fr['h'+r]=flat(new T.CylinderGeometry(r,1,1,6,1,false,Math.PI/6)).translate(0,.5,0));
 G.octF=r=>fr['o'+r]||(fr['o'+r]=flat(new T.CylinderGeometry(r,1,1,8,1,false,Math.PI/8)).translate(0,.5,0));G.cylF=r=>fr['c'+r]||(fr['c'+r]=new T.CylinderGeometry(r,1,1,20,1).translate(0,.5,0));
 const tex={atlas:makeAtlas(high?512:256),earth:makeEarth(high?256:128,high?128:64)};
 const mk=(vs,fs,extra,opts)=>new T.ShaderMaterial(Object.assign({uniforms:Object.assign({},U,extra||{}),vertexShader:vs,fragmentShader:fs,defines:DEF,fog:true},opts||{}));
 const MAT={terrain:mk(TERRAIN_VS,TERRAIN_FS,null,{vertexColors:true}),solid:mk(SOLID_VS,SOLID_FS),
  fx:mk(FX_VS,FX_FS,{uMap:{value:tex.atlas},uKind:{value:[V3(.1,.68,1).multiplyScalar(.6),V3(.3,1,.5).multiplyScalar(.5),V3(.6,.95,1).multiplyScalar(.9),V3(1,.1,.7).multiplyScalar(.7)]}},
   {transparent:true,premultipliedAlpha:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-8}),
  sky:mk(SKY_VS,SKY_FS,{uEarth:{value:tex.earth},uEarthDir:{value:V3(0,.1,-1).normalize()},uEarthSize:{value:.075},uEarthL:{value:V3(-.62,.34,.7).normalize()},uSpin:{value:2.2},
   uZenith:{value:V3(.0002,.0003,.0009)},uBandA:{value:V3(0,.2,.19)},uBandB:{value:V3(.045,.012,.11)},uFogC:{value:V3(.0018,.0021,.0048)}},{fog:false,depthWrite:false,side:T.DoubleSide})};
 CORE={U,G,MAT,tex,high};
 // instanced prop geometries (unit space)
 const cr=new Bld();for(const [x,z,h,tx,tz,r] of [[0,0,1,0,0,.95],[.45,.12,.7,.38,-.2,.62],[-.42,.22,.62,-.32,.26,.56],[.12,-.48,.55,.14,.4,.5],[-.3,-.36,.46,-.28,-.3,.44],[.52,-.3,.38,.42,.3,.4]])cr.add(G.shard,M(x,-.04,z,tz*.6,0,-tx*.6,r,h,r),null,0,null,gradC(0,1,...CYC));
 const fu=new Bld();for(const [x,z,s] of [[0,0,1],[.5,.2,.72],[-.45,.3,.6],[.15,-.5,.66],[-.35,-.4,.45]])fu.add(G.pod,M(x,0,z,0,x*3,0,s,s,s),null,0,null,(v,lx,ly)=>ly<.3?[.012,.02,.03,0]:ly<.72?[.02,.015,.07,.15]:[.25,1,.55,.95]);
 const rk=new Bld();rk.add(G.rock,new T.Matrix4(),null,0,null,v=>{const k=clamp01(v.y*.5+.5);return [.03+.05*k,.032+.054*k,.04+.06*k,0];});
 const rl=new Bld();rl.box(0,4.6,0,.22,9.2,.22,K.mid);rl.box(0,.25,0,.9,.5,.9,K.dark);for(const y of [3,6])rl.box(0,y,0,1.3,.08,.08,K.dark2);rl.add(G.cone6,M(.35,8.4,0,0,0,-1.1,.9,.35,.9),K.panelB);rl.box(0,9.35,0,.32,.32,.32,K.ice,1);rl.box(0,4.6,.12,.05,8.4,.03,K.cyan,1);
 const bq=new T.BufferGeometry(),b=AT.BLOB;bq.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));bq.setAttribute('aBill',new T.Float32BufferAttribute([-1,-1,1,1,-1,1,1,1,1,-1,1,1],3));
 bq.setAttribute('uv',new T.Float32BufferAttribute([b[0],b[1],b[2],b[1],b[2],b[3],b[0],b[3]],2));bq.setAttribute('aCol',new T.Float32BufferAttribute(new Array(16).fill(1).map((v,i)=>i%4===3?0:1),4));bq.setIndex([0,1,2,0,2,3]);
 CORE.P={crystal:cr.geometry(),fungus:fu.geometry(),rock:rk.geometry(),relay:rl.geometry(),bill:bq};
 return CORE;}

// ---------- sky ----------
function earthDir(api){const f=LAB.FRAMES[api.subject];if(!f||!f.from)return V3(.6,.14,-.79).normalize();
 const base=api.ground(f.to[0],f.to[2]),from=V3(f.from[0],Math.max(base+f.from[1],api.ground(f.from[0],f.from[2])+2),f.from[2]),d=V3(f.to[0],base+f.to[1],f.to[2]).sub(from);
 // Review framing only: in-game Earth is one fixed direction (the Moon is tidally locked); the lab turns it into each shot.
 const cfg={refuge:[11,3.4],raid:[6,9],tank:[-7,7.5],enemy:[7,7.5],props:[-6,8.5]}[api.subject]||[0,8],a=Math.atan2(d.x,d.z)+cfg[0]*Math.PI/180,el=cfg[1]*Math.PI/180;
 return V3(Math.sin(a)*Math.cos(el),Math.sin(el),Math.cos(a)*Math.cos(el));}
function buildSky(api){const high=!api.low,P=[],B=[],A=[],I=[],dome=new T.SphereGeometry(1,high?48:32,high?24:16),dp=dome.attributes.position;
 for(let i=0;i<dp.count;i++){const x=dp.getX(i),y=dp.getY(i),z=dp.getZ(i);P.push(x,y,z);B.push(0,0,0);const gal=Math.exp(-Math.pow(x*.35+y*.55-z*.76,2)*7),nb=Math.max(0,fbm3(x*2.3+3,y*2.3,z*2.3,4)-.44),up=clamp01(y*3+.1);
  A.push((.02*nb+.0035*gal)*up,(.006*nb+.003*gal)*up,(.05*nb+.007*gal)*up,0);}
 for(let k=0;k<dome.index.count;k++)I.push(dome.index.getX(k));let n=dp.count,seed=1337;const rnd=()=>(seed=(Math.imul(seed,1664525)+1013904223)|0,(seed>>>0)/4294967296);
 for(let s=0,count=high?950:380;s<count;s++){let x,y,z,l;do{x=rnd()*2-1;y=rnd()*2-1;z=rnd()*2-1;l=x*x+y*y+z*z;}while(l>1||l<.01);l=Math.sqrt(l);x/=l;y/=l;z/=l;if(y<.04){y=.04+Math.abs(y)*.9;const k=Math.hypot(x,y,z);x/=k;y/=k;z/=k;}
  const big=rnd()<.035,sz=big?4.6+rnd()*2.6:1.05+rnd()*rnd()*2.3,b=big?1.7:.3+rnd()*rnd()*1.35,t=rnd(),c=t<.2?[.72,.86,1.25]:t<.3?[1.2,.92,.72]:[1,1,1];
  for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){P.push(x,y,z);B.push(cx,cy,1);A.push(c[0]*b,c[1]*b,c[2]*b,sz);}I.push(n,n+1,n+2,n,n+2,n+3);n+=4;}
 for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){P.push(0,1,0);B.push(cx,cy,2);A.push(0,0,0,0);}I.push(n,n+1,n+2,n,n+2,n+3);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('aBill',new T.Float32BufferAttribute(B,3));g.setAttribute('aCol',new T.Float32BufferAttribute(A,4));g.setIndex(I);
 const m=new T.Mesh(g,CORE.MAT.sky);m.frustumCulled=false;m.renderOrder=-1000;return m;}

// ---------- props (per fine chunk; InstancedMesh like the game) ----------
function propsFor(api,items,ox,oz){const K0=core(api),g=new T.Group(),high=K0.high,trees=items.filter(p=>p.kind==='tree'),rocks=items.filter(p=>p.kind==='rock'&&p.variant>.45),relays=items.filter(p=>p.kind==='relay');
 const crystals=high?trees.filter(p=>p.variant>=.4):trees,fungus=high?trees.filter(p=>p.variant<.4):[],halos=[];
 const inst=(geo,list,fn,mat)=>{if(!list.length)return;const im=new T.InstancedMesh(geo,mat||K0.MAT.solid,list.length);list.forEach((p,i)=>im.setMatrixAt(i,fn(p)));im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();g.add(im);};
 inst(K0.P.crystal,crystals,p=>{const sh=.42+.36*p.size,sv=Math.min(1.45,.5+.32*p.size);halos.push([p.x-ox,p.y+sv*.62,p.z-oz,sh*1.25,1]);return M(p.x-ox,p.y-.12,p.z-oz,0,p.variant*40,0,sh,sv,sh);});
 inst(K0.P.fungus,fungus,p=>{const sh=.5+.4*p.size,sv=Math.min(1.3,.55+.26*p.size);halos.push([p.x-ox,p.y+sv*.75,p.z-oz,sh*1.1,2]);return M(p.x-ox,p.y-.06,p.z-oz,0,p.variant*40,0,sh,sv,sh);});
 inst(K0.P.rock,rocks,p=>M(p.x-ox,p.y+.3*p.size,p.z-oz,(p.variant-.72)*.22,(p.variant*31)%2<1?0:Math.PI,(p.variant-.6)*.16,1.6*p.size,(.5+p.variant)*p.size,p.size));
 inst(K0.P.relay,relays,p=>{halos.push([p.x-ox,p.y+9.35,p.z-oz,1.3,3]);return M(p.x-ox,p.y,p.z-oz,0,p.variant*6,0,1,1,1);});
 if(high&&halos.length)inst(K0.P.bill,halos,h=>M(h[0],h[1],h[2],0,0,0,h[3],h[3],h[4]),K0.MAT.fx);
 for(const c of g.children)if(c.material===K0.MAT.fx)c.renderOrder=2;return g;}

// ---------- Refuge ----------
function ringMin(api,x,z,r){let m=api.ground(x,z);for(let a=0;a<12;a++)m=Math.min(m,api.ground(x+Math.cos(a*.5236)*r,z+Math.sin(a*.5236)*r));return m;}
function habitat(api,S,X,h,idx){const {x,z}=h,g=api.ground(x,z),gmin=ringMin(api,x,z,8.4),low=api.low,f0=g+.6,ap=7.45*Math.cos(Math.PI/6),apL=7.55*Math.cos(Math.PI/6);
 const hex=(R,y0,y1,c,em=0,ao=null)=>S.add(CORE.G.hex,M(x,y0,z,0,0,0,R,y1-y0,R),c,em,ao);
 const face=(k,out,y,w,hh,d,c,em=0,tilt=0)=>{const a=k*Math.PI/3;S.add(CORE.G.box,M(x+Math.sin(a)*out,y,z+Math.cos(a)*out,tilt,a,0,w,hh,d),c,em);};
 hex(8.25,gmin-1.6,f0,K.dark);hex(8.34,f0-.2,f0,K.cyan,1);
 if(g-gmin>1.4)for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3;S.box(x+Math.sin(a)*8.3,(gmin-1.6+f0-.2)/2,z+Math.cos(a)*8.3,.55,f0-.2-(gmin-1.6),.55,K.mid,0,a);}
 hex(7.55,f0,g+3.2,K.panelA,0,[f0,2.6]);hex(7.63,g+3.2,g+3.45,K.dark2);hex(7.45,g+3.45,g+5.6,K.panelB);hex(7.6,g+5.6,g+5.8,K.cyan,1);
 S.add(CORE.G.hexF(.73),M(x,g+5.8,z,0,0,0,7.5,1.3,7.5),K.roof);hex(3.1,g+7.1,g+8.3,K.panelB);hex(2.6,g+8.3,g+8.45,K.ice,.85);
 for(const k of [0,2,4]){const a=Math.PI/6+k*Math.PI/3;S.box(x+Math.sin(a)*7.5,g+3.2,z+Math.cos(a)*7.5,.17,5.1,.17,K.cyan,1,a);}
 for(const k of [1,2,4,5]){face(k,ap+.02,g+4.45,5,1.05,.08,K.dark);face(k,ap+.07,g+4.45,4.4,.62,.06,K.ice,.92);if(!low)face(k,apL+.05,g+1.6,3.2,.35,.1,K.dark2);}
 face(0,apL+.12,g+2.25,3.1,3.3,.42,K.dark);face(0,apL+.36,g+2.05,2.2,2.8,.08,K.cyan,.82);face(0,apL+.38,g+3.62,2.7,.13,.1,K.ice,1);face(0,apL+.75,g+4.05,4,.2,1.4,K.mid,-.12);
 face(0,apL+.9,f0-.15,4.4,.3,2,K.dark);face(0,apL+1.88,f0+.02,4.4,.07,.07,K.cyan,1);face(3,apL+.6,g+1.6,2.6,1.9,1.2,K.mid);face(3,apL+1.22,g+1.9,.4,.4,.05,K.amber,1);
 S.box(x+1.5,g+9.8,z-1.1,.12,3,.12,K.mid);S.box(x+1.5,g+11.35,z-1.1,.3,.3,.3,K.red,1);
 X.bill(x+1.5,g+11.35,z-1.1,.9,AT.BLOB,E(0xff3048,1.1));X.quadV(x,g+6.65,z+ap+1.25,3.4,.85,0,AT['S'+idx],E(0x22e6ff,1.5));
 X.decal(api,x,z,11.5,11.5,0,AT.BLOB,[0,0,0],.62,low?6:9,.12);X.decal(api,x,z,10.6,10.6,0,AT.RING,E(0x22e6ff,.5),0,low?8:12,.16);X.decal(api,x,z+10.2,3.6,3.6,0,AT.BLOB,E(0x22e6ff,.45),0,4,.2);}
function processor(api,S,X,p,i,all){const {x,z}=p,g=api.ground(x,z),gmin=ringMin(api,x,z,12.6),H=p.artHeight,y0=g+13,y1=g+H,rb=6.9,rt=5.3,low=api.low,rAt=y=>rb+(rt-rb)*(y-y0)/(y1-y0);
 S.add(CORE.G.oct,M(x,gmin-1.6,z,0,0,0,12.6,g+2.6-(gmin-1.6),12.6),K.dark);S.add(CORE.G.oct,M(x,g+2.45,z,0,0,0,12.72,.2,12.72),K.cyan,1);
 S.add(CORE.G.octF(.81),M(x,g+2.6,z,0,0,0,10.6,10.4,10.6),K.panelA,0,[g+2.6,8]);
 for(let k=0;k<8;k++)S.add(CORE.G.box,MR(x,z,k*Math.PI/4,g+7.8,8.95,-.176,.7,6.2,.12),K.cyan,.9);
 S.add(CORE.G.cylF(+(rt/rb).toFixed(3)),M(x,y0,z,0,0,0,rb,y1-y0,rb),K.panelB);
 for(let y=y0+8;y<y1-4;y+=15){const r=rAt(y);S.add(CORE.G.cyl,M(x,y,z,0,0,0,r+.12,.7,r+.12),K.dark2);}
 for(const f of [.3,.48,.66,.84]){const y=g+H*f,r=rAt(y),R=r+2.7;S.add(CORE.G.torus,M(x,y,z,Math.PI/2,0,0,R,R,R),K.cyan,1);
  for(let k=0;k<4;k++)S.add(CORE.G.box,MR(x,z,k*Math.PI/2+Math.PI/4,y,(r+R)/2,0,.35,.35,R-r),K.mid);X.ringGlow(x,z,y,R,low?3:4.4,E(0x22e6ff,.55),low?12:20);}
 S.add(CORE.G.octF(.62),M(x,y1,z,0,0,0,rt+.6,5,rt+.6),K.panelA);S.add(CORE.G.torus,M(x,y1+.4,z,Math.PI/2,0,0,rt+.9,rt+.9,rt+.9),K.cyan,1);
 S.add(CORE.G.cone6,M(x,y1+5,z,0,0,0,2.4,11,2.4),K.panelB);S.box(x,y1+16.2,z,.5,.5,.5,K.red,1);X.bill(x,y1+16.2,z,3.2,AT.BLOB,E(0xff3048,1.2));
 const tilt=Math.atan((rb-rt)/(y1-y0));for(let k=0;k<4;k++)S.add(CORE.G.box,MR(x,z,k*Math.PI/2,(y0+y1)/2,(rb+rt)/2+.03,-tilt,.28,y1-y0-4,.28),K.cyan,1);
 if(i<all.length-1){const q=all[i+1],g2=api.ground(q.x,q.z);S.add(CORE.G.cylC,MDc(V3(x+12.4,g+4.2,z),V3(q.x-12.4,g2+4.2,q.z),1.1),K.mid);
  for(const t of [.25,.5,.75])S.add(CORE.G.cylC,MDc(V3(x+12.4+(q.x-x-24.8)*t-.15,g+4.2+(g2-g)*t,z),V3(x+12.4+(q.x-x-24.8)*t+.15,g+4.2+(g2-g)*t,z),1.35),K.cyan,1);}
 X.decal(api,x,z,16,16,0,AT.BLOB,[0,0,0],.5,low?6:9,.12);X.decal(api,x,z,18,18,0,AT.BLOB,E(0x22e6ff,.28),0,low?6:9,.16);}
function terminal(api,S,X,t){const {x,z}=t,g=api.ground(x,z),low=api.low;
 X.decal(api,x,z,6.4,6.4,0,AT.HEX,E(0x22e6ff,1.15),0,low?8:12,.14);X.decal(api,x,z,12.65,12.65,0,AT.DASH,E(0x2dffc4,.6),0,low?12:18,.18);X.decal(api,x,z,8,8,0,AT.BLOB,E(0x22e6ff,.3),0,8,.1);
 S.box(x,g-.4,z,1.9,1.6,1.5,K.dark);S.box(x,g+1.7,z,1.05,2.6,.85,K.panelA,0,0,[g,2.5]);S.box(x,g+3.12,z,1.6,.28,1.2,K.dark2);S.add(CORE.G.box,M(x,g+2.25,z+.5,-.3,0,0,1.25,.85,.06),K.ice,.95);
 for(const s of [-1,1])S.box(x+s*.55,g+1.7,z+.43,.08,2.4,.08,K.cyan,1);
 for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3,bx=x+Math.sin(a)*5.8,bz=z+Math.cos(a)*5.8,bg=api.ground(bx,bz);S.box(bx,bg+.5,bz,.28,1.4,.28,K.dark2);S.box(bx,bg+1.25,bz,.34,.16,.34,K.cyan,1);if(!low)X.bill(bx,bg+1.25,bz,.9,AT.BLOB,E(0x22e6ff,.8));}
 X.band(x,z,g+3.3,1.05,.7,6.5,E(0x2dffc4,.45),[0,0,0],14);X.quadV(x,g+7.3,z,3.4,3.4,0,AT.ICON,E(0x2dffc4,1.4));X.quadV(x,g+7.3,z,3.4,3.4,Math.PI/2,AT.ICON,E(0x2dffc4,.9));
 X.quadV(x,g+5.05,z+.3,3.8,.95,0,AT.S9,E(0x22e6ff,1.6));X.bill(x,g+2.3,z+.6,1.6,AT.BLOB,E(0xa8f8ff,.5));}
function solar(api,S,X,p){const {x,z,w,d,tilt}=p,g=api.ground(x,z),m=M(x,g+2,z,tilt,0,0,1,1,1),at=(lx,ly,lz)=>V3(lx,ly,lz).applyMatrix4(m);
 S.add(CORE.G.box,M(x,g+2,z,tilt,0,0,w,.26,d),K.navy);S.add(CORE.G.box,M(x,g+1.9,z,tilt,0,0,w+.3,.16,d+.3),K.mid);
 S.add(CORE.G.box,new T.Matrix4().multiplyMatrices(m,M(0,.16,-d/2,0,0,0,w,.08,.08)),K.cyan,1);
 X.quad([at(-w*.48,.15,d*.48),at(w*.48,.15,d*.48),at(w*.48,.15,-d*.48),at(-w*.48,.15,-d*.48)],AT.GRID,E(0x22e6ff,.42));
 for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const c=at(sx*(w/2-.6),0,sz*(d/2-.6)),gy=api.ground(c.x,c.z);if(c.y>gy)S.box(c.x,(c.y+gy-.5)/2,c.z,.25,c.y-gy+.5,.25,K.mid);}}
function pylon(api,S,X,px,pz){const g=api.ground(px,pz);S.box(px,g+3.4,pz,.24,7.2,.24,K.mid);S.box(px,g+.2,pz,.7,.5,.7,K.dark);S.box(px,g+7.05,pz+.35,.22,.18,.9,K.dark2);S.box(px,g+6.92,pz+.75,.7,.12,.38,K.ice,1);S.box(px,g+3.4,pz+.13,.06,6.2,.04,K.cyan,1);
 X.bill(px,g+6.8,pz+.75,1.7,AT.BLOB,E(0xa8f8ff,.8));X.decal(api,px,pz+.6,5.5,5.5,0,AT.BLOB,E(0x22e6ff,.3),0,api.low?4:6,.15);}

// ---------- Parasite raid site ----------
function coverWall(api,S,X,o){const g=api.ground(o.x,o.z),{x,z,width:w,depth:d,height:h}=o,long=w>=d,L=long?w:d,n=Math.max(1,Math.floor(L/3));
 S.box(x,g+(h-.35-1.2)/2,z,w,h-.35+1.2,d,K.wall,0,0,[g,3]);S.box(x,g+h-.175,z,w-.34,.35,d-.34,K.wallTop);
 for(let i=1;i<n;i++){const t=-L/2+i*L/n;if(long)S.box(x+t,g+(h-.5)/2,z,.14,h-.5,d+.06,K.dark);else S.box(x,g+(h-.5)/2,z+t,w+.06,h-.5,.14,K.dark);}
 for(const s of [-1,1]){if(long){S.box(x,g+h-.42,z+s*(d/2+.01),w-.5,.09,.05,K.mag,1.85);S.box(x,g+.55,z+s*(d/2+.01),w-.5,.06,.05,K.mag,1.6);}else{S.box(x+s*(w/2+.01),g+h-.42,z,.05,.09,d-.5,K.mag,1.85);S.box(x+s*(w/2+.01),g+.55,z,.05,.06,d-.5,K.mag,1.6);}}
 X.decal(api,x,z,w/2+2.2,d/2+2.2,0,AT.BLOB,[0,0,0],.55,6,.1);X.decal(api,x,z,w/2+3.5,d/2+3.5,0,AT.BLOB,E(0xff2bd6,.2),0,6,.12);}
function hive(api,S,X,inst){const cx=inst.solid.x,cz=inst.solid.z,g=api.ground(cx,cz),ax=9,ay=12.4,az=6,low=api.low;
 S.add(CORE.G.blob1,M(cx,g-.6,cz,0,0,0,11.2,2.4,8.2),K.chitinD);S.add(CORE.G.blob2,M(cx,g,cz,0,0,0,ax,ay,az),K.chitin,0,[g,9]);
 for(let k=0;k<8;k++){const ph=k*Math.PI/4+.2,dx=Math.cos(ph),dz=Math.sin(ph),rr=1/Math.sqrt(dx*dx/(ax*ax)+dz*dz/(az*az));let prev=null;
  for(let j=0;j<=9;j++){const t=j/9*Math.PI/2*.94,p=V3(cx+dx*rr*Math.cos(t)*1.05,g+ay*Math.sin(t)*1.04,cz+dz*rr*Math.cos(t)*1.05);if(prev)S.seg(prev,p,.28,K.mag,1.85);prev=p;}}
 for(const f of [.25,.55]){let prev=null;for(let j=0;j<=24;j++){const ph=j/24*TAU,y=ay*f,s=Math.sqrt(1-f*f)*1.05,p=V3(cx+Math.cos(ph)*ax*s,g+y,cz+Math.sin(ph)*az*s);if(prev)S.seg(prev,p,.2,K.mag,1.7);prev=p;}}
 const cp=V3(cx-ax*.9,g+4.4,cz);S.add(CORE.G.ico,M(cp.x,cp.y,cp.z,0,0,0,2.1,2.1,2.1),K.magHot,1.95);S.add(CORE.G.torus,M(cp.x+.4,cp.y,cp.z,0,Math.PI/2,0,2.6,2.6,4),K.chitinD);
 X.bill(cp.x-1.2,cp.y,cp.z,7.5,AT.BLOB,E(0xff2bd6,1.1));X.bill(cp.x-1.6,cp.y,cp.z,3,AT.BLOB,E(0xffb0f0,1.2));
 for(const [a,el,len] of [[.6,.55,2.4],[1.5,.6,2.3],[2.4,.5,2.6],[3.3,.62,2.2],[4.2,.5,2.5],[5.1,.58,2.4],[5.9,.66,2],[.15,.78,1.8],[3,.8,1.7],[1.1,.85,1.6]]){
  const dx=Math.cos(a)*Math.cos(el),dy=Math.sin(el),dz=Math.sin(a)*Math.cos(el),p=V3(cx+ax*dx*.97,g+ay*dy*.97,cz+az*dz*.97),nrm=V3(dx/ax,dy/ay+1.4/ay*0,dz/az).normalize().add(V3(0,1.4,0)).normalize(),tip=p.clone().addScaledVector(nrm,len);
  S.spike(p,tip,.5,K.chitinD);S.spike(p.clone().lerp(tip,.5),tip,.24,K.mag,1);}
 for(const [sx,sz,hh] of [[-9.6,-6.4,2.2],[9.4,-6.6,2.6],[-9.4,6.4,2.4],[9.6,6.2,2],[0,-7.2,1.6],[-3,7.3,1.8],[4,7.2,1.5],[-10.2,0,1.8]]){const b=V3(cx+sx*.92,api.ground(cx+sx,cz+sz)-.2,cz+sz*.92),t=V3(cx+sx,b.y+hh,cz+sz);S.spike(b,t,.45,K.chitinD);S.spike(b.clone().lerp(t,.55),t,.2,K.mag,1);}
 const mx=inst.mast.x,mz=inst.mast.z,mg=api.ground(mx,mz);S.add(CORE.G.hexF(.3),M(mx,mg-1,mz,0,.3,0,1.7,18.6,1.7),K.chitin);
 for(let k=0;k<3;k++){const a=.3+k*2.094;S.seg(V3(mx+Math.sin(a)*1.68,mg,mz+Math.cos(a)*1.68),V3(mx+Math.sin(a)*.55,mg+17.3,mz+Math.cos(a)*.55),.16,K.mag,1.9);}
 for(const [a,hh] of [[.9,5.5],[2.9,4.2],[4.9,6.2]]){const b=V3(mx+Math.cos(a)*1.1,mg-.3,mz+Math.sin(a)*1.1);S.spike(b,V3(mx+Math.cos(a)*1.9,mg+hh,mz+Math.sin(a)*1.9),.42,K.chitinD);}
 S.add(CORE.G.ico,M(mx,mg+18.8,mz,0,0,0,1.15,1.15,1.15),K.magHot,1.95);for(let k=0;k<4;k++){const a=k*Math.PI/2+.4;S.spike(V3(mx+Math.cos(a)*.6,mg+17.6,mz+Math.sin(a)*.6),V3(mx+Math.cos(a)*1.6,mg+20,mz+Math.sin(a)*1.6),.18,K.mag,1);}
 X.bill(mx,mg+18.8,mz,5.5,AT.BLOB,E(0xff2bd6,1.2));X.bill(mx,mg+18.8,mz,2.2,AT.BLOB,E(0xffc0f4,1.2));X.band(mx,mz,mg+19.5,.9,.4,14,E(0xff2bd6,.5),[0,0,0],12);
 X.decal(api,cx,cz,15,12,0,AT.BLOB,[0,0,0],.6,low?6:10,.12);X.decal(api,cx,cz,21,18,0,AT.BLOB,E(0xff2bd6,.35),0,low?6:10,.16);}
function spireDecor(api,S,X,a){const g=api.ground(a.x,a.z);S.add(CORE.G.blob1,M(a.x,g-.5,a.z,0,.5,0,4.4,1.8,3.8),K.chitinD);
 for(const [dx,dz,hh,tx,tz,r] of [[0,0,7.2,0,0,1],[1.6,.8,5,.35,.2,.8],[-1.4,1.1,4.3,-.3,.3,.75],[.6,-1.6,3.8,.15,-.4,.7],[-1,-1.2,3.2,-.25,-.3,.6]])
  S.add(CORE.G.shard,M(a.x+dx,g-.3,a.z+dz,tz,0,-tx,r*1.4,hh,r*1.4),null,0,null,gradC(g,g+7,...MAGC));
 X.bill(a.x,g+4,a.z,7,AT.BLOB,E(0xff2bd6,.7));X.decal(api,a.x,a.z,8,8,0,AT.BLOB,E(0xff2bd6,.3),0,6,.12);}

// ---------- enemies ----------
function paintParasite(geo){const c=geo.attributes.color,n=c.count,a=new Float32Array(n*4);
 for(let i=0;i<n;i++){const r=c.getX(i),g=c.getY(i),b=c.getZ(i),l=.3*r+.59*g+.11*b;let o;
  if(b>.85&&g>.5&&r<.6)o=[1,.12,.45,1];else if(r>.95&&g<.3)o=[1,.1,.6,1];else if(r>.7&&g<.3&&b<.3)o=[1,.08,.75,1.85];else if(r>.4&&g<.1&&b<.1)o=[.6,.02,.35,.7];
  else if(r>.45&&g>.25&&g<.45&&b<.2)o=[.16,.022,.07,0];else if(l>.6)o=[.36,.28,.4,0];else{const k=clamp01((l-.03)/.45);o=[.008+.1*k,.004+.05*k,.012+.13*k,0];}
  a.set(o,i*4);}geo.setAttribute('aCol',new T.BufferAttribute(a,4));return geo;}
function battery(api,e){const g=new T.Group(),S=new Bld(),X=new Fx(),Gn=new Bld();
 S.add(CORE.G.blob1,M(0,.15,0,0,.4,0,3.3,2.3,2.8),K.chitin,0,[0,2.2]);
 for(let k=0;k<6;k++){const a=k*Math.PI/3+.3;S.spike(V3(Math.cos(a)*2.3,.7,Math.sin(a)*1.9),V3(Math.cos(a)*3.35,-.1,Math.sin(a)*2.85),.34,K.chitinD);}
 for(let k=0;k<5;k++){const ph=k*TAU/5;let prev=null;for(let j=0;j<=6;j++){const t=j/6*Math.PI/2*.9,p=V3(Math.cos(ph)*3.3*Math.cos(t)*1.04,.15+2.3*Math.sin(t)*1.03,Math.sin(ph)*2.8*Math.cos(t)*1.04);if(prev)S.seg(prev,p,.13,K.mag,1.85);prev=p;}}
 S.add(CORE.G.hexF(.62),M(0,1.8,0,0,.2,0,1.25,4.6,1.25),K.chitin);S.add(CORE.G.torus,M(0,4.3,0,Math.PI/2,0,0,1.2,1.2,1.8),K.mag,1.8);
 const gun=new T.Group();gun.position.y=6.6;g.add(gun);g.userData.gun=gun;
 Gn.add(CORE.G.ico,M(0,.2,0,0,0,0,1.25,1.25,1.25),K.magHot,1.95);
 for(let k=0;k<3;k++){const a=k*TAU/3+.5;Gn.spike(V3(Math.cos(a)*.9,-1.1,Math.sin(a)*.9),V3(Math.cos(a)*1.55,1.5,Math.sin(a)*1.55),.32,K.chitinD);}
 for(const s of [-1,1]){Gn.spike(V3(s*.6,0,.4),V3(s*.38,.25,2.85),.3,K.chitin,0,CORE.G.cone6);Gn.add(CORE.G.ico,M(s*.38,.25,2.75,0,0,0,.2,.2,.2),K.magHot,1);}
 Gn.spike(V3(0,.2,-.5),V3(0,1.3,-2.4),.38,K.chitinD);gun.add(Gn.mesh());
 X.bill(0,6.8,0,5,AT.BLOB,E(0xff2bd6,1.2));X.bill(0,6.8,0,2.2,AT.BLOB,E(0xffd0f6,1.4));X.flat(0,.06,0,5.2,4.6,AT.BLOB,E(0xff2bd6,.45),0);X.flat(0,.05,0,4.6,4.2,AT.BLOB,[0,0,0],.7);
 g.add(S.mesh());g.add(X.mesh());const mk=new Bld();mk.add(CORE.G.octa,M(0,11,0,0,0,0,.45,.6,.45),K.mag,1);const marker=mk.mesh();g.add(marker);g.userData.marker=marker;return g;}
function enemyHull(api,e){const g=api.baseline.enemy(api,e),body=g.children.find(c=>c.isGroup),old=g.userData.marker;if(old&&old.parent)old.parent.remove(old);
 g.traverse(o=>{if(o.isMesh&&o.geometry.attributes.color){paintParasite(o.geometry);o.material=CORE.MAT.solid;}});
 const hull=body&&body.children.find(c=>c.isMesh);if(!hull)return g;const p=hull.geometry.attributes.position;let x0=1e9,x1=-1e9,y1=-1e9,zw=0;
 for(let i=0;i<p.count;i++){x0=Math.min(x0,p.getX(i));x1=Math.max(x1,p.getX(i));y1=Math.max(y1,p.getY(i));zw=Math.max(zw,Math.abs(p.getZ(i)));}const L=x1-x0;
 const topAt=(fx,wz)=>{let b=-1e9;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-fx)<.08*L&&Math.abs(p.getZ(i))<wz)b=Math.max(b,p.getY(i));return b;};
 const D=new Bld();for(let i=0;i<4;i++){const fx=x0+L*(.2+.16*i),ty=topAt(fx,.2*zw);if(ty<-1e8)continue;const hh=.26+.1*(i%2),b=V3(fx,ty-.05,0),t=V3(fx-hh*.8,ty+hh,0);D.spike(b,t,.09,K.chitinD);D.spike(b.clone().lerp(t,.5),t,.045,K.mag,1);}
 for(const s of [-1,1]){let best=0;for(let i=0;i<p.count;i++){const y=p.getY(i);if(y>.3*y1&&y<.62*y1)best=Math.max(best,Math.abs(p.getZ(i)));}D.box((x0+x1)/2,.46*y1,s*(best+.012),L*.6,.04,.02,K.mag,1.85);}
 let fy0=1e9,fy1=-1e9;for(let i=0;i<p.count;i++)if(p.getX(i)>x1-.06*L&&Math.abs(p.getZ(i))<.5*zw){fy0=Math.min(fy0,p.getY(i));fy1=Math.max(fy1,p.getY(i));}
 if(fy1>fy0)for(const s of [-1,1])D.add(CORE.G.ico,M(x1+.01,(fy0+fy1)/2,s*.2*zw,0,0,0,.06*zw+.03,.06*zw+.03,.06*zw+.03),K.magHot,1);body.add(D.mesh());
 const X=new Fx();X.flat(0,.05,0,zw*1.7,L*.75,AT.BLOB,[0,0,0],.7);X.flat(0,.06,0,zw*2.2,L*.95,AT.BLOB,E(0xff2bd6,.5),0);g.add(X.mesh());
 const mk=new Bld();mk.add(CORE.G.octa,M(0,5,0,0,0,0,.36,.5,.36),K.mag,1);const marker=mk.mesh();g.add(marker);g.userData.marker=marker;return g;}

// ---------- player tank dressing (geometry untouched) ----------
function dressTank(api,vehicle){const body=vehicle.userData.body,gun=vehicle.userData.gun;vehicle.updateWorldMatrix(true,true);const inv=new T.Matrix4().copy(body.matrixWorld).invert(),pts=[];
 const walk=o=>{if(o===gun)return;if(o.isMesh){const m=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld),a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){_v.fromBufferAttribute(a,i).applyMatrix4(m);pts.push(_v.x,_v.y,_v.z);}}for(const c of o.children)walk(c);};
 for(const c of body.children)walk(c);if(!pts.length)return vehicle;let zT=0;for(let i=2;i<pts.length;i+=3)zT=Math.max(zT,Math.abs(pts[i]));
 let yT=-1e9,x0=1e9,x1=-1e9,ax0=1e9,ax1=-1e9;for(let i=0;i<pts.length;i+=3){ax0=Math.min(ax0,pts[i]);ax1=Math.max(ax1,pts[i]);if(Math.abs(pts[i+2])>zT-.12){yT=Math.max(yT,pts[i+1]);x0=Math.min(x0,pts[i]);x1=Math.max(x1,pts[i]);}}
 const D=new Bld();for(const s of [-1,1])D.box((x0+x1)/2,yT+.018,s*(zT-.05),(x1-x0)*.86,.035,.06,K.cyan,1);body.add(D.mesh());
 const X=new Fx(),hl=(ax1-ax0)/2,cz=(ax0+ax1)/2;X.flat(0,.03,cz,zT*1.5,hl*1.25,AT.BLOB,[0,0,0],.78);X.flat(0,.04,cz,zT*2.1,hl*1.55,AT.RING,E(0x22e6ff,.6),0);X.flat(0,.045,cz,zT*1.7,hl*1.3,AT.BLOB,E(0x22e6ff,.25),0);
 X.flat(0,.05,cz+hl+2.4,1.9,2.6,AT.BLOB,E(0xa8f8ff,.22),0);vehicle.add(X.mesh());return vehicle;}

// ---------- map: holographic tactical display ----------
const MAPC={relief:null,glyphs:new Map(),labels:new Map(),overlay:null,fontWait:false,mctx:null};
const MFONT="600 10px 'Chakra Petch','Segoe UI',system-ui,sans-serif",GFONT="bold 30px 'Segoe UI Symbol','DejaVu Sans','Noto Sans Symbols2',sans-serif";
function relief(m,unit,vis){const Wd=m.W,d=m.discovery,c=MAPC.relief;
 if(c&&c.scale===m.scale&&c.low===m.low&&vis.x0>=c.x0&&vis.x1<=c.x1&&vis.z0>=c.z0&&vis.z1<=c.z1&&d.cellsIn({x:c.x0,z:c.z0,width:c.x1-c.x0,height:c.z1-c.z0}).length===c.n)return c;
 const pad=Math.max(96,(vis.x1-vis.x0)*.3),x0=Math.max(0,Math.floor((vis.x0-pad)/32)*32),x1=Math.min(Wd.WIDTH,Math.ceil((vis.x1+pad)/32)*32),z0=Math.max(0,Math.floor((vis.z0-pad)/32)*32),z1=Math.min(Wd.LENGTH,Math.ceil((vis.z1+pad)/32)*32);
 const cells=d.cellsIn({x:x0,z:z0,width:x1-x0,height:z1-z0}),ppu=Math.min(unit*2,2048/(x1-x0),2048/(z1-z0)),cw=Math.ceil((x1-x0)*ppu),ch=Math.ceil((z1-z0)*ppu);
 const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const x=cv.getContext('2d'),out={canvas:cv,x0,x1,z0,z1,ppu,scale:m.scale,low:m.low,n:cells.length};MAPC.relief=out;if(!cells.length)return out;
 const s=m.low?8:4,nx=Math.round((x1-x0)/s)+1,nz=Math.round((z1-z0)/s)+1,H=new Float32Array(nx*nz).fill(NaN),B=new Uint8Array(nx*nz),Y=j=>(nz-1-j)*s*ppu;
 for(const cell of cells){const i0=Math.round((cell.x-x0)/s),j0=Math.round((cell.z-z0)/s),n=Math.round(cell.size/s);for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const k=(j0+j)*nx+i0+i;if(k<0||k>=H.length||H[k]===H[k])continue;const wx=x0+(i0+i)*s,wz=z0+(j0+j)*s;H[k]=Wd.heightAt(wx,wz);const b=Wd.biomeAt(wx,wz);B[k]=b==='terraformed'?1:b==='massif'?2:0;}}
 const img=new ImageData(nx,nz),D=img.data,ok=k=>H[k]===H[k];
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i,h=H[k];if(h!==h)continue;const hl=i>0&&ok(k-1)?H[k-1]:h,hr=i<nx-1&&ok(k+1)?H[k+1]:h,hd=j>0&&ok(k-nx)?H[k-nx]:h,hu=j<nz-1&&ok(k+nx)?H[k+nx]:h,hx=(hr-hl)/(2*s),hz=(hu-hd)/(2*s);
  const sh=clamp01(.5+(.7*hx-.7*hz)*1.15),ht=clamp01((h+140)/170);let r=3+sh*15+ht*6,g=13+sh*50+ht*16,bb=22+sh*60+ht*18;if(B[k]===1){r*=.6;g=g*1.08+12;bb=bb*.9+4;}else if(B[k]===2){r+=4;g*=.85;bb=bb*1.1+8;}
  const o=((nz-1-j)*nx+i)*4;D[o]=r;D[o+1]=g;D[o+2]=bb;D[o+3]=255;}
 const sm=document.createElement('canvas');sm.width=nx;sm.height=nz;sm.getContext('2d').putImageData(img,0,0);x.imageSmoothingEnabled=true;x.drawImage(sm,-.5*s*ppu,-.5*s*ppu,nx*s*ppu,nz*s*ppu);
 x.strokeStyle='rgba(0,229,255,.08)';x.lineWidth=1;x.beginPath();for(let gx=Math.ceil(x0/64)*64;gx<=x1;gx+=64){const X0=(gx-x0)*ppu;x.moveTo(X0,0);x.lineTo(X0,ch);}for(let gz=Math.ceil(z0/64)*64;gz<=z1;gz+=64){const Y0=(z1-gz)*ppu;x.moveTo(0,Y0);x.lineTo(cw,Y0);}x.stroke();
 const step=m.low?10:5,minor=new Path2D(),major=new Path2D();
 for(const cell of cells){const i0=Math.round((cell.x-x0)/s),j0=Math.round((cell.z-z0)/s),n=Math.round(cell.size/s);for(let j=j0;j<j0+n;j++)for(let i=i0;i<i0+n;i++){const a=H[j*nx+i],b=H[j*nx+i+1],c2=H[(j+1)*nx+i+1],dd=H[(j+1)*nx+i];if(a!==a||b!==b||c2!==c2||dd!==dd)continue;
  const lo=Math.min(a,b,c2,dd),hi=Math.max(a,b,c2,dd);for(let L=Math.ceil(lo/step)*step;L<hi;L+=step){const q=[];if((a<L)!==(b<L))q.push(i+(L-a)/(b-a),j);if((b<L)!==(c2<L))q.push(i+1,j+(L-b)/(c2-b));if((dd<L)!==(c2<L))q.push(i+(L-dd)/(c2-dd),j+1);if((a<L)!==(dd<L))q.push(i,j+(L-a)/(dd-a));
   const path=Math.round(L)%25===0?major:minor;for(let t=0;t+3<q.length;t+=4){path.moveTo(q[t]*s*ppu,Y(q[t+1]));path.lineTo(q[t+2]*s*ppu,Y(q[t+3]));}}}}
 x.lineCap='round';x.strokeStyle='rgba(20,200,255,.28)';x.lineWidth=1;x.stroke(minor);x.strokeStyle='rgba(0,229,255,.16)';x.lineWidth=3.2;x.stroke(major);x.strokeStyle='rgba(130,248,255,.8)';x.lineWidth=1.2;x.stroke(major);
 const P=(wx,wz)=>[(wx-x0)*ppu,(z1-wz)*ppu];
 if(m.scale>=32){for(let cxk=Math.floor(x0/128);cxk<=Math.floor((x1-1)/128);cxk++)for(let czk=Math.floor(z0/128);czk<=Math.floor((z1-1)/128);czk++)for(const it of Wd.scenery(cxk,czk)){if(!d.has(it.x,it.z))continue;const [X0,Y0]=P(it.x,it.z);
   if(it.kind==='tree'){x.fillStyle='rgba(60,255,205,.8)';x.fillRect(X0-1,Y0-1,2,2);}else if(it.kind==='relay'){x.fillStyle='rgba(170,245,255,.95)';x.fillRect(X0-2,Y0-.5,4,1);x.fillRect(X0-.5,Y0-2,1,4);}
   else if(it.variant>.45){x.fillStyle='rgba(130,150,180,.45)';x.beginPath();x.arc(X0,Y0,Math.max(1,it.size*ppu*.9),0,TAU);x.fill();}}
  const F=LAB.FOOTPRINTS.refuge,hexP=(wx,wz,r)=>{x.beginPath();for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3,[X0,Y0]=P(wx+Math.sin(a)*r,wz+Math.cos(a)*r);k?x.lineTo(X0,Y0):x.moveTo(X0,Y0);}x.closePath();};
  const V=F.viaduct;if(d.has((V.x0+V.x1)/2,(V.zA+V.zB)/2)){const [a0,b0]=P(V.x0,V.zA),[a1,b1]=P(V.x1,V.zB);x.fillStyle='rgba(120,160,190,.25)';x.fillRect(a0,b1,a1-a0,b0-b1);x.strokeStyle='rgba(150,220,255,.75)';x.lineWidth=1.2;x.strokeRect(a0,b1,a1-a0,b0-b1);}
  for(const h of F.habitats)if(d.has(h.x,h.z)){hexP(h.x,h.z,8);x.fillStyle='rgba(0,45,60,.95)';x.fill();x.strokeStyle='rgba(70,238,255,.95)';x.lineWidth=1.3;x.stroke();}
  for(const p of F.processors)if(d.has(p.x,p.z)){const [X0,Y0]=P(p.x,p.z);x.beginPath();x.arc(X0,Y0,12*ppu,0,TAU);x.fillStyle='rgba(0,45,60,.95)';x.fill();x.strokeStyle='rgba(70,238,255,.95)';x.stroke();x.beginPath();x.arc(X0,Y0,6*ppu,0,TAU);x.stroke();}
  for(const p of F.solar)if(d.has(p.x,p.z)){const [X0,Y0]=P(p.x-p.w/2,p.z+p.d/2);x.strokeStyle='rgba(70,238,255,.7)';x.strokeRect(X0,Y0,p.w*ppu,p.d*ppu);}
  if(d.has(F.terminal.x,F.terminal.z)){hexP(F.terminal.x,F.terminal.z,5);x.fillStyle='rgba(45,255,196,.9)';x.fill();}
  const Bd=F.base;if(d.has(Bd.x,Bd.z)){hexP(Bd.x,Bd.z,19);x.setLineDash([4,3]);x.strokeStyle='rgba(255,196,90,.9)';x.lineWidth=1.3;x.stroke();x.setLineDash([]);}}
 x.globalCompositeOperation='destination-in';x.fillStyle='#fff';x.beginPath();for(const cell of cells)x.rect((cell.x-x0)*ppu-.6,(z1-cell.z-cell.size)*ppu-.6,cell.size*ppu+1.2,cell.size*ppu+1.2);x.fill();
 x.globalCompositeOperation='source-atop';x.fillStyle='rgba(0,0,0,.2)';for(let yy=0;yy<ch;yy+=3)x.fillRect(0,yy,cw,1);
 const fade=9*ppu,fr=new Path2D(),gr=(ax,ay,bx,by,rx,ry,rw,rh)=>{const g=x.createLinearGradient(ax,ay,bx,by);g.addColorStop(0,'rgba(1,4,9,.92)');g.addColorStop(1,'rgba(1,4,9,0)');x.fillStyle=g;x.fillRect(rx,ry,rw,rh);};
 for(const cell of cells){const X0=(cell.x-x0)*ppu,Y0=(z1-cell.z-cell.size)*ppu,S2=cell.size*ppu,w=!d.has(cell.x-1,cell.z+16),e=!d.has(cell.x+cell.size+1,cell.z+16),so=!d.has(cell.x+16,cell.z-1),no=!d.has(cell.x+16,cell.z+cell.size+1);
  if(w){gr(X0,0,X0+fade,0,X0,Y0,fade,S2);fr.moveTo(X0,Y0);fr.lineTo(X0,Y0+S2);}if(e){gr(X0+S2,0,X0+S2-fade,0,X0+S2-fade,Y0,fade,S2);fr.moveTo(X0+S2,Y0);fr.lineTo(X0+S2,Y0+S2);}
  if(no){gr(0,Y0,0,Y0+fade,X0,Y0,S2,fade);fr.moveTo(X0,Y0);fr.lineTo(X0+S2,Y0);}if(so){gr(0,Y0+S2,0,Y0+S2-fade,X0,Y0+S2-fade,S2,fade);fr.moveTo(X0,Y0+S2);fr.lineTo(X0+S2,Y0+S2);}}
 x.globalCompositeOperation='source-over';x.strokeStyle='rgba(0,229,255,.2)';x.lineWidth=4;x.stroke(fr);x.strokeStyle='rgba(110,244,255,.75)';x.lineWidth=1;x.stroke(fr);return out;}
function glyph(gl,c){const k=gl+c;let s=MAPC.glyphs.get(k);if(s)return s;s=document.createElement('canvas');s.width=s.height=48;const x=s.getContext('2d');x.font=GFONT;x.textAlign='center';x.textBaseline='middle';
 x.shadowColor=c;x.shadowBlur=11;x.fillStyle=c;x.fillText(gl,24,25);x.shadowBlur=0;x.fillText(gl,24,25);x.lineWidth=1;x.strokeStyle='rgba(255,255,255,.6)';x.strokeText(gl,24,25);MAPC.glyphs.set(k,s);return s;}
function wrap(t){t=String(t).toUpperCase();if(t.length<=17)return [t];const p=t.split(' / ');if(p.length===2)return [p[0]+' /',p[1]];const w=t.split(' ');let best=[t],score=1e9;
 for(let i=1;i<w.length;i++){const a=w.slice(0,i).join(' '),b=w.slice(i).join(' '),sc=Math.max(a.length,b.length);if(sc<score){score=sc;best=[a,b];}}return best;}
function label(lines,c,dim){const k=lines.join('|')+c+(dim?1:0);let s=MAPC.labels.get(k);if(s)return s;const mx=MAPC.mctx||(MAPC.mctx=document.createElement('canvas').getContext('2d'));mx.font=MFONT;if(dim)mx.letterSpacing='1px';
 const w=Math.ceil(Math.max(...lines.map(l=>mx.measureText(l).width)))+6,h=lines.length*11+3;mx.letterSpacing='0px';const cv=document.createElement('canvas');cv.width=w*2;cv.height=h*2;const x=cv.getContext('2d');x.scale(2,2);x.font=MFONT;x.textBaseline='top';x.lineJoin='round';if(dim)x.letterSpacing='1px';
 lines.forEach((l,i)=>{const y=2+i*11;x.lineWidth=3;x.strokeStyle='rgba(1,4,9,.94)';x.strokeText(l,3,y);x.fillStyle=c;if(!dim){x.shadowColor=c;x.shadowBlur=5;x.fillText(l,3,y);x.shadowBlur=0;}x.fillText(l,3,y);});s={cv,w,h};MAPC.labels.set(k,s);return s;}
function overlay(){if(MAPC.overlay)return MAPC.overlay;const cv=document.createElement('canvas');cv.width=720;cv.height=840;const x=cv.getContext('2d');const g=x.createRadialGradient(360,420,200,360,420,580);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.62)');x.fillStyle=g;x.fillRect(0,0,720,840);
 x.fillStyle='rgba(0,229,255,.035)';for(let y=0;y<840;y+=4)x.fillRect(0,y,720,1);x.strokeStyle='rgba(0,229,255,.8)';x.lineWidth=2;for(const [cx,cy,sx,sy] of [[8,8,1,1],[712,8,-1,1],[8,832,1,-1],[712,832,-1,-1]]){x.beginPath();x.moveTo(cx,cy+sy*26);x.lineTo(cx,cy);x.lineTo(cx+sx*26,cy);x.stroke();}
 x.fillStyle='rgba(0,229,255,.6)';x.font="600 17px 'Chakra Petch',sans-serif";x.fillText('TACTICAL HOLO · SECTOR GRID',20,30);MAPC.overlay=cv;return cv;}
function mapPaint(ctx,m){const Wd=m.W,Cb=m.C,S=m.state||{},d=m.discovery,scale=m.scale,unit=280/Wd.WIDTH*scale;
 if(!MAPC.fontWait&&document.fonts&&!document.fonts.check(MFONT)){MAPC.fontWait=true;document.fonts.load(MFONT).then(()=>{MAPC.labels.clear();MAPC.overlay=null;mapPaint(ctx,m);}).catch(()=>{});}
 ctx.setTransform(2,0,0,2,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='#010409';ctx.fillRect(0,0,360,420);
 const vis={x0:(-40-m.px)/unit,x1:(320-m.px)/unit,z0:Wd.LENGTH+(m.py-420)/unit,z1:Wd.LENGTH+m.py/unit},rel=relief(m,unit,vis);
 if(rel&&rel.n){const dx=Math.round((40+m.px+rel.x0*unit)*2)/2,dy=Math.round((m.py+(1-rel.z1/Wd.LENGTH)*420*scale)*2)/2;ctx.drawImage(rel.canvas,dx,dy,(rel.x1-rel.x0)*unit,(rel.z1-rel.z0)*unit);}
 ctx.strokeStyle='rgba(0,229,255,.25)';ctx.lineWidth=1;ctx.strokeRect(40+m.px,m.py,280*scale,420*scale);
 const ringL=[];for(const sec of Cb.sectors){const p=m.toScreen(sec.x,sec.z),r=sec.radius*unit;if(p.x+r<0||p.x-r>360||p.y+r<0||p.y-r>420)continue;const own=S.territory?.[sec.id]?.owner==='humanity',rgb=own?'0,229,255':'255,60,214';
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,TAU);ctx.lineWidth=4;ctx.strokeStyle='rgba('+rgb+',.08)';ctx.stroke();ctx.setLineDash([6,4]);ctx.lineWidth=1;ctx.strokeStyle='rgba('+rgb+',.55)';ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='rgba('+rgb+',.85)';ctx.lineWidth=1.4;ctx.beginPath();for(let k=0;k<4;k++){const a=k*Math.PI/2;ctx.moveTo(p.x+Math.cos(a)*(r-4),p.y+Math.sin(a)*(r-4));ctx.lineTo(p.x+Math.cos(a)*(r+4),p.y+Math.sin(a)*(r+4));}ctx.stroke();ringL.push({sec,p,r,own});}
 const you=m.toScreen(m.player.x,m.player.z),t=m.routeTarget;if(t){const q=m.toScreen(t.x,t.z);ctx.save();ctx.lineCap='round';ctx.strokeStyle='rgba(255,196,90,.2)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(you.x,you.y);ctx.lineTo(q.x,q.y);ctx.stroke();
  ctx.setLineDash([5,4]);ctx.lineDashOffset=-(m.time||0)*12;ctx.strokeStyle='#ffc45a';ctx.lineWidth=1.6;ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(q.x,q.y,7,0,TAU);ctx.moveTo(q.x-11,q.y);ctx.lineTo(q.x-4,q.y);ctx.moveTo(q.x+4,q.y);ctx.lineTo(q.x+11,q.y);ctx.moveTo(q.x,q.y-11);ctx.lineTo(q.x,q.y-4);ctx.moveTo(q.x,q.y+4);ctx.lineTo(q.x,q.y+11);ctx.stroke();ctx.restore();}
 const marks=[],add=(wx,wz,g,c,txt,pri,o)=>marks.push(Object.assign({p:m.toScreen(wx,wz),g,c,t:txt,pri},o||{}));
 if(scale>=16)for(const l of Wd.landmarks)if(d.has(l.x,l.z))add(l.x,l.z,'·','#7fd3e0',l.name,1,{dim:true,dot:true});
 for(const s of Cb.installations)if(d.has(s.x,s.z)){const cap=S.territory?.[s.id]?.owner==='humanity';add(s.x,s.z,cap?'⚑':'▲',cap?'#5effd0':'#ff4fd8',s.name,5);}
 const ops=Object.values(Cb.operations);for(const o of ops){if(o.raid||o.defense||o.id==='base-defense'||o.id==='oxygen-line'||Cb.installations.some(s=>s.id===o.site))continue;const sec=S.territory?.[o.site]?.owner==='humanity';add(o.x,o.z,sec?'⚑':'◆',sec?'#5effd0':'#ffd36b',o.name,4);}
 for(const sector of Cb.sectors){const list=ops.filter(o=>o.raid&&o.sector===sector.id);if(list.length){const cleared=list.filter(o=>S.completed?.[o.id]).length,un=Cb.raidsUnlocked(S.completed),done=cleared===list.length;
   add(list.reduce((n,o)=>n+o.x,0)/list.length,list.reduce((n,o)=>n+o.z,0)/list.length,done?'✓':'✦',done?'#5effd0':un?'#ffb347':'#8a93a0',un?'RAIDS '+cleared+'/'+list.length:'RAIDS · LOCKED',6);}
  if(Cb.sectorDefenseOpen(S.territory?.[sector.id],sector.id)){const o=ops.find(o=>o.defense&&o.sector===sector.id);if(o)add(o.x,o.z,'!','#ff4060',(S.territory[sector.id].owner==='humanity'?'DEFEND ':'RETAKE ')+sector.name,8);}}
 const Bd=Cb.baseDefinition;add(Bd.x,Bd.z,'⌂','#ffc45a','COMMAND BASE '+(S.base?.tier?'T'+S.base.tier:'SITE'),9,{left:true});
 for(const w of S.wrecks||[])if(d.has(w.x,w.z))add(w.x,w.z,'◇','#8ee6ef','PERSONAL WRECK',3);add(Cb.refuge.x,Cb.refuge.z,'●','#3fe9ff','REFUGE',10);
 for(const k of marks){if(k.p.x<-12||k.p.x>372||k.p.y<-12||k.p.y>432)continue;if(k.dot){ctx.fillStyle=k.c;ctx.beginPath();ctx.arc(k.p.x,k.p.y,2,0,TAU);ctx.fill();}else ctx.drawImage(glyph(k.g,k.c),k.p.x-12,k.p.y-12,24,24);}
 const ys=label(['YOU'],'#ffffff',false),obst=[{x:0,y:403,w:360,h:17},{x:0,y:0,w:150,h:20},{x:you.x-13,y:you.y-13,w:26,h:26},{x:you.x-ys.w/2,y:you.y-16-ys.h,w:ys.w,h:ys.h}];
 for(const k of marks)if(!k.dot)obst.push({x:k.p.x-7,y:k.p.y-7,w:14,h:14});
 const items=[];for(const k of marks){if(!k.t||k.p.x<-10||k.p.x>370||k.p.y<-10||k.p.y>430)continue;items.push({p:k.p,s:label(wrap(k.t),k.c,k.dim),pri:k.pri,c:k.c,left:k.left});}
 for(const rl of ringL)items.push({p:rl.p,ring:rl,s:label([rl.sec.name],rl.own?'#61eaf6':'#ff74e0',true),pri:7,c:rl.own?'#61eaf6':'#ff74e0'});
 items.sort((a,b)=>b.pri-a.pri||(Math.hypot(a.p.x-you.x,a.p.y-you.y)-Math.hypot(b.p.x-you.x,b.p.y-you.y)));
 const placed=obst.slice(),fits=r=>r.x>=2&&r.y>=2&&r.x+r.w<=358&&r.y+r.h<=402&&!placed.some(o=>r.x<o.x+o.w&&r.x+r.w>o.x&&r.y<o.y+o.h&&r.y+r.h>o.y);
 for(const it of items){const w=it.s.w,h=it.s.h;let cands;
  if(it.ring){cands=[];for(const deg of [-90,-66,-114,-42,-138,-18,-162,90,66,114]){const a=deg*Math.PI/180;cands.push([Math.cos(a)*it.ring.r-w/2,Math.sin(a)*it.ring.r-h/2,0]);}}
  else{const near=[[9,-h/2,0],[-9-w,-h/2,0],[-w/2,-10-h,0],[-w/2,10,0]];if(it.left)near.unshift(near.splice(1,1)[0]);cands=near.concat([[16,-h-8,1],[16,8,1],[-16-w,-h-8,1],[-16-w,8,1],[-w/2,-22-h,1],[-w/2,22,1],[30,-h/2,1],[-30-w,-h/2,1],[26,-h-22,1],[-26-w,-h-22,1],[26,20,1],[-26-w,20,1],[-w/2,-36-h,1],[-w/2,36,1],[46,-h-6,1],[-46-w,-h-6,1],[44,14,1],[-44-w,14,1]]);}
  for(const [dx,dy,lead] of cands){const r={x:it.p.x+dx,y:it.p.y+dy,w,h};if(fits(r)){placed.push(r);it.at={r,lead};break;}}}
 for(const it of items){if(!it.at)continue;const r=it.at.r;if(it.at.lead){const nx=Math.max(r.x,Math.min(it.p.x,r.x+r.w)),ny=Math.max(r.y,Math.min(it.p.y,r.y+r.h)),dx=nx-it.p.x,dy=ny-it.p.y,l=Math.hypot(dx,dy)||1;
   ctx.globalAlpha=.65;ctx.strokeStyle=it.c;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(it.p.x+dx/l*8,it.p.y+dy/l*8);ctx.lineTo(nx,ny);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=it.c;ctx.fillRect(nx-1.2,ny-1.2,2.4,2.4);}
  ctx.drawImage(it.s.cv,r.x,r.y,it.s.w,it.s.h);}
 ctx.save();ctx.translate(you.x,you.y);ctx.fillStyle='rgba(0,229,255,.16)';ctx.beginPath();ctx.arc(0,0,14+1.5*Math.sin((m.time||0)*3),0,TAU);ctx.fill();ctx.strokeStyle='rgba(170,250,255,.95)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,11,0,TAU);ctx.stroke();
 ctx.rotate(m.player.heading);ctx.shadowColor='#00e5ff';ctx.shadowBlur=8;ctx.fillStyle='#3fe9ff';ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(6.5,6.5);ctx.lineTo(0,3);ctx.lineTo(-6.5,6.5);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();ctx.restore();
 ctx.drawImage(ys.cv,you.x-ys.w/2,you.y-16-ys.h,ys.w,ys.h);ctx.drawImage(overlay(),0,0,360,420);
 ctx.font=MFONT;ctx.fillStyle='#5fd8e8';ctx.textAlign='left';ctx.fillText('N ↑ · '+Math.round(Wd.WIDTH/scale)+' UNITS ACROSS THEATER FRAME',10,414);
 const sb=100*unit;ctx.strokeStyle='#5fd8e8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(350-sb,411);ctx.lineTo(350,411);ctx.moveTo(350-sb,407);ctx.lineTo(350-sb,414);ctx.moveTo(350,407);ctx.lineTo(350,414);ctx.stroke();ctx.textAlign='right';ctx.fillText('100 m',350,404);ctx.textAlign='left';}

const MAP_CSS=`.cq .cq-dialog.cq-map{background:linear-gradient(180deg,rgba(0,229,255,.07),rgba(0,0,0,0) 140px),repeating-linear-gradient(0deg,rgba(0,229,255,.03) 0 1px,transparent 1px 4px),#01060b!important;border:1px solid rgba(0,229,255,.5)!important;box-shadow:0 0 0 1px rgba(0,229,255,.08) inset,0 0 30px rgba(0,229,255,.2),inset 0 0 44px rgba(0,229,255,.06)!important;color:#b9ecf4!important}
.cq .cq-dialog.cq-map h2{color:#8ff6ff!important;text-shadow:0 0 10px rgba(0,229,255,.85),0 0 2px #fff;letter-spacing:.16em}
.cq .cq-dialog.cq-map .cq-map-mission{color:#5dffc9!important;border-left-color:#19ffc8!important;text-shadow:0 0 8px rgba(25,255,200,.45)}
.cq .cq-dialog.cq-map p{color:#a9dbe4!important}.cq .cq-dialog.cq-map .cq-map-legend b{font-weight:700;text-shadow:0 0 6px currentColor}
.cq .cq-dialog.cq-map button{background:rgba(0,28,38,.6)!important;border:1px solid rgba(0,229,255,.62)!important;color:#c3faff!important;text-shadow:0 0 6px rgba(0,229,255,.9);box-shadow:inset 0 0 14px rgba(0,229,255,.16),0 0 10px rgba(0,229,255,.16)!important;letter-spacing:.08em}
.cq .cq-dialog.cq-map button.cq-nav-base{border-color:rgba(255,180,70,.8)!important;color:#ffd99a!important;text-shadow:0 0 6px rgba(255,170,60,.9);box-shadow:inset 0 0 14px rgba(255,170,60,.16),0 0 10px rgba(255,170,60,.16)!important}
.cq .cq-dialog.cq-map canvas{background:#000!important;border:1px solid rgba(0,229,255,.55)!important;box-shadow:0 0 22px rgba(0,229,255,.25),inset 0 0 0 1px rgba(0,229,255,.1)!important;border-radius:3px}
.cq .cq-dialog.cq-map h3{color:#8ff6ff!important;text-shadow:0 0 8px rgba(0,229,255,.7)}`;
const MAP_LEGEND='<span style="color:#7fe9f5">HOLO RELIEF · explored ground only.</span> <b style="color:#ffd36b">◆</b> Mission · <b style="color:#ffb347">✦</b> Raid site (<b style="color:#5effd0">✓</b> cleared · grey locked) · <b style="color:#ff4060">!</b> Defense alert · <b style="color:#3fe9ff">●</b> Refuge · <b style="color:#ffc45a">⌂</b> Command Base · <b style="color:#ff4fd8">▲</b> Parasite / <b style="color:#5effd0">⚑</b> captured · <b style="color:#8ee6ef">◇</b> Wreck. Drag to pan · pinch or + / − to zoom · north ↑.';

LAB.register({
 id:'b',name:'NEON FRONTLINE · STYLIZED SCI-FI',
 summary:'Black sky with teal horizon band and big haloed Earth; charcoal cratered regolith with lichen glow and base hex grids; hex neon prefab pods; crystal/fungus growths; magenta-veined Parasite hives; holo contour map.',
 async prepare(api){if(document.fonts&&document.fonts.load){try{await Promise.race([document.fonts.load("700 19px 'Chakra Petch'"),new Promise(r=>setTimeout(r,1500))]);}catch(_){}}core(api);},
 environment(api){const K0=core(api),U=K0.U;api.renderer.toneMappingExposure=api.low?1.25:1.2;api.scene.background=new T.Color(0);api.scene.fog=new T.Fog(0x06070f,900,2600);
  api.scene.add(new T.HemisphereLight(0x3a5a9c,0x16131f,1.5));const sun=new T.DirectionalLight(0xe4ecff,2.9);sun.position.copy(U.uSunDir.value).multiplyScalar(500);api.scene.add(sun);
  const rim=new T.DirectionalLight(0x52c6ff,1.25);rim.position.copy(U.uRimDir.value).multiplyScalar(500);api.scene.add(rim);K0.MAT.sky.uniforms.uEarthDir.value.copy(earthDir(api));api.scene.add(buildSky(api));},
 terrainMaterial(api){return core(api).MAT.terrain;},
 props(api,items,chunk){return propsFor(api,items,chunk.cx*128,chunk.cz*128);},
 refuge(api,f){core(api);const S=new Bld(),X=new Fx();f.habitats.forEach((h,i)=>habitat(api,S,X,h,i));f.processors.forEach((p,i,a)=>processor(api,S,X,p,i,a));terminal(api,S,X,f.terminal);
  f.solar.forEach(p=>solar(api,S,X,p));for(const [x,z] of PYLONS.slice(0,api.low?6:10))pylon(api,S,X,x,z);const g=new T.Group();g.add(S.mesh(),X.mesh());return g;},
 raidSite(api,f){core(api);const S=new Bld(),X=new Fx();for(const o of f.obstacles)coverWall(api,S,X,o);hive(api,S,X,f.installation);spireDecor(api,S,X,f.raidArt);const g=new T.Group();g.add(S.mesh(),X.mesh());return g;},
 playerTank(api,vehicle){core(api);return dressTank(api,vehicle);},
 enemy(api,e){core(api);return e.immobile?battery(api,e):enemyHull(api,e);},
 propLineup(api,at){core(api);const dir=[Math.sin(at.heading),Math.cos(at.heading)],items=[];
  [['tree',1.2,.7],['tree',3.4,.85],['tree',1.3,.2],['tree',3.3,.15],['rock',1.3,.6],['rock',3.2,.95],['relay',1.4,.5]].forEach(([kind,size,variant],i)=>{const dd=3+i*5.2,x=at.x+dir[0]*dd+(i%2?1.5:-1.5),z=at.z+dir[1]*dd;items.push({x,z,y:api.ground(x,z),kind,size,variant});});
  return propsFor(api,items,0,0);},
 mapCss:MAP_CSS,mapLegend:MAP_LEGEND,
 map(ctx,m){mapPaint(ctx,m);},
 update(api,dt,t){if(!CORE)return;CORE.U.uTime.value=t;if(api.renderer)api.renderer.getDrawingBufferSize(CORE.U.uViewport.value);}
});
})(globalThis);
