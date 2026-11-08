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
const WATER_VS=`attribute vec2 aFlow;varying vec2 vF;varying vec3 vWP;
#include <common>
#include <fog_pars_vertex>
void main(){vF=aFlow;vec4 wp=modelMatrix*vec4(position,1.);vWP=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
// Cheap opaque water (one draw for creek, reservoir and crater pool): flow streaks along aFlow.x (metres downstream; 0 =
// still water), bank foam by aFlow.y (-1..1 across / radius), a fresnel sky tint and HIGH-only glints. No reflections.
const WATER_FS=`uniform float uTime,uHigh;uniform vec3 uRimCol;varying vec2 vF;varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
void main(){float t=uTime,f=vF.x,ac=vF.y,still=1.-step(.001,abs(f));
 float r1=mix(sin(f*.9-t*2.2+ac*1.7),sin(vWP.x*.35+vWP.z*.12+t*.6),still)*.5+.5,r2=mix(sin(f*2.3-t*3.1-ac*2.9+vWP.x*.1),sin(vWP.z*.41-vWP.x*.2-t*.8),still)*.5+.5;
 // Frontier water: dark slate blue (#3C5568) with the dusty sky reflected, a little white water, muddy banks
 float edge=smoothstep(.55,1.,abs(ac));vec3 col=mix(vec3(.03,.06,.09),vec3(.045,.091,.136),.5+.5*r1);
 vec3 V=normalize(cameraPosition-vWP);float fres=pow(1.-clamp(V.y,0.,1.),2.4);col=mix(col,vec3(.3,.24,.2),fres*.55);
 col+=vec3(.08,.1,.12)*smoothstep(.72,1.,r1)*(.2-still*.1);
 col+=vec3(1.,.8,.6)*pow(max(0.,r1*r2),9.)*(.25+.45*uHigh)*(1.-still*.4);
 col=mix(col,vec3(.55,.58,.6),smoothstep(.8,.95,abs(ac))*smoothstep(.75,1.,r2)*.35*(1.-still));
 col=mix(col,vec3(.12,.09,.06),smoothstep(.88,1.,abs(ac))*.75);
 gl_FragColor=vec4(col,1.);
#include <fog_fragment>
}`;
// Site influence (friendly glow / Parasite creep) is evaluated per vertex (4 m apart near the player) and interpolated,
// so the fragment shader never loops over the site table.
const TERRAIN_VS=`uniform vec4 uSite[8];uniform sampler2D uAtmoMap;uniform vec4 uAtmoBox;varying vec2 vW;varying vec3 vN;varying vec3 vC;varying float vY;varying float vD;varying vec4 vSite;varying float vAtm;
#include <common>
#include <fog_pars_vertex>
void main(){vW=uv*24.;vN=normal;vC=color;vY=position.y;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;vD=-mvPosition.z;vAtm=texture2D(uAtmoMap,(vW-uAtmoBox.xy)*uAtmoBox.zw).r;
 float ff=0.,fs=0.,fd=1e4,bl=0.;for(int i=0;i<8;i++){vec4 s=uSite[i];if(s.z<=0.)continue;float d=length(vW-s.xy);if(d>s.z)continue;float f=1.-d/s.z;f*=f;if(s.w>0.){ff+=f*s.w;if(f>fs){fs=f;fd=d;}}else bl=max(bl,f);}
 vSite=vec4(ff,fs,fd,bl);
#include <fog_vertex>
}`;
// Regolith detail comes from one tileable texture (R crater height, G/B its gradient, A value noise) sampled at 2-3
// rotated scales: ~3 fetches instead of hundreds of hash ops per pixel (measured ~5x cheaper in software GL).
const TERRAIN_FS=`uniform vec3 uSunDir,uSunCol,uRimDir,uRimCol,uAmbUp,uAmbDn,uDaySun,uDayAmbUp,uDayAmbDn,uDaySunW;uniform float uTime,uHigh;uniform sampler2D uDetail,uShadowMap;uniform vec4 uAtmoBox;
varying vec2 vW;varying vec3 vN;varying vec3 vC;varying float vY;varying float vD;varying vec4 vSite;varying float vAtm;
#include <common>
#include <fog_pars_fragment>
float h12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float hexEdge(vec2 p){const vec2 r=vec2(1.,1.7320508);vec2 h=r*.5;vec2 a=mod(p,r)-h;vec2 b=mod(p-h,r)-h;vec2 g=dot(a,a)<dot(b,b)?a:b;vec2 q=abs(g);return .5-max(dot(q,vec2(.5,.8660254)),q.x);}
// Quality is a uniform (one program for HIGH and LOW, so every branch is compiled everywhere). Texture lookups stay in
// uniform control flow (no implicit-derivative fetches inside per-pixel branches).
void main(){vec3 c=vC;float terra=clamp((c.g-max(c.r,c.b)+.04)/.24,0.,1.);float massif=smoothstep(.0,.06,c.b-c.r);bool hi=uHigh>.5;
 float lod=clamp(1.-vD/320.,0.,1.),lod2=clamp(1.-vD/1500.,0.,1.);
 vec4 d1=texture2D(uDetail,vW*(1./96.));float h1=d1.r-.5;vec2 grad=(d1.gb-.5)*.9;float rim=max(h1,0.)*1.6,bowl=max(-h1,0.)*1.5,tone=.7+.42*d1.a,na=d1.a,va=d1.a,vb=.5,st=.5;
 if(hi){vec4 d2=texture2D(uDetail,vec2(vW.y,-vW.x)*(1./29.)+.31),d3=texture2D(uDetail,vW*(1./8.7)+.67);float h2=(d2.r-.5)*lod2,h3=(d3.r-.5)*lod;
  grad+=vec2(-(d2.b-.5),d2.g-.5)*1.25*lod2+(d3.gb-.5)*1.4*lod;rim+=max(h2,0.)*1.8+max(h3,0.)*1.6;bowl+=max(-h2,0.)*1.3+max(-h3,0.)*1.2;tone+=.24*(d2.a-.5)+.16*(d3.a-.5)*lod;na=d2.a*.62+d1.a*.38;
  va=texture2D(uDetail,vW*(1./73.)+.13).a;vb=texture2D(uDetail,vW*(1./24.)+.71).a;st=texture2D(uDetail,vec2(vY*.032,(vW.x+vW.y)*.0018)).a;}
 // Rugged frontier (owner art direction): the colonists clawed this ground out of the Moon. Grass grows in clumps of olive,
 // dry straw and dark green; bare dirt, gravel and grey regolith (its craters) show through; steep ground is rock with strata
 // and moss on top; shell craters with scorched earth and mud, and tank ruts, scar it. Grit grows with distance from the core.
 float coreD=length(vW-vec2(1130.,1125.)),grit=smoothstep(110.,430.,coreD),n1=d1.a,n2=hi?va:n1;
 float gm=smoothstep(.3,.5,n1*.6+n2*.4+.12*(1.-grit)-.1*grit)*smoothstep(.06,.3,terra),regoP=smoothstep(.62,.8,n2*.7+n1*.3+grit*.2)*(1.-gm),zc=smoothstep(.06,.24,terra),cr=1.-zc*(1.-regoP*.85);grad*=cr;rim*=cr;bowl*=cr;
 vec3 rego=mix(vec3(.074,.078,.088),vec3(.055,.064,.082),massif)*tone;
 vec3 N=normalize(vN+vec3(-grad.x,0.,-grad.y));float steep=smoothstep(.28,.6,1.-N.y);
 if(hi)rego=mix(rego,rego*(.55+.5*st),steep);rego*=(1.-.32*min(bowl,1.))*(1.+.6*min(rim,1.));
 float zv=smoothstep(.05,.24,terra);
 // organic grass: patch colour from low-frequency noise (olive / dry straw / dark green), clump texture from warped noise
 float pc=texture2D(uDetail,vW*(1./11.)+vec2(.21,.63)).a,pw=texture2D(uDetail,vW*(1./5.3)+vec2(.71,.12)).a;
 vec3 clump=pc<.4?mix(vec3(.048,.102,.027),vec3(.147,.195,.042),smoothstep(.3,.4,pc)):pc<.62?mix(vec3(.147,.195,.042),vec3(.39,.32,.105),smoothstep(.52,.62,pc)):vec3(.39,.32,.105)*(.85+.3*pw);
 float gg=texture2D(uDetail,vW*(1./2.7)+.37).a,cs=smoothstep(.3,.62,texture2D(uDetail,vW*(1./1.9)+vec2(pw*.4,pc*.4)).a);vec3 dryG=mix(vec3(.13,.11,.06),vec3(.2,.17,.08),n1);
 vec3 grass=mix(dryG,clump*(.8+.4*gg),.45+.55*cs*lod);
 vec3 dirt=mix(vec3(.11,.085,.062),vec3(.155,.12,.085),gg),regoG=vec3(.254,.242,.216)*(.6+.55*tone)*(1.-.3*min(bowl,1.))*(1.+.4*min(rim,1.));
 float grav=step(.55,h12(floor(vW*3.1)))*lod*.5;dirt=mix(dirt,vec3(.22,.21,.19)*(.7+.5*h12(floor(vW*3.1)+2.)),grav);
 vec3 bare=mix(dirt,regoG,regoP);
 vec3 rock=mix(vec3(.16,.145,.12),vec3(.24,.22,.19),st)*(.7+.4*tone);rock=mix(rock,vec3(.07,.1,.04),smoothstep(.7,.95,N.y)*.6);
 vec3 veg=mix(bare,grass,gm*(1.-.3*grit));veg=mix(veg,rock,smoothstep(.35,.62,steep));
 if(terra<.25)veg=mix(rego,veg,smoothstep(.06,.25,terra));
 // scars: shell craters (scorched black centre, mud ring) and tank-track ruts, denser toward the frontier
 {vec2 sc=floor(vW/16.),so=(vec2(h12(sc+3.),h12(sc+9.))-.5)*9.;float sh=h12(sc+21.);if(sh<.12+.3*grit){float r=length(vW-(sc+.5)*16.-so),R=2.2+3.2*h12(sc+31.);
   veg=mix(veg,vec3(.06,.045,.035),(1.-smoothstep(R*.75,R*1.25,r))*.9);veg=mix(veg,vec3(.018,.016,.014),1.-smoothstep(R*.15,R*.6,r));}
  vec2 rc=floor(vW/34.);float rh=h12(rc+41.);if(rh<.18+.35*grit){float a=h12(rc+43.)*3.1416;vec2 dn=vec2(-sin(a),cos(a));float dd=abs(dot(vW-(rc+.5)*34.,dn)),along=abs(dot(vW-(rc+.5)*34.,vec2(cos(a),sin(a))));
   float rut=(1.-smoothstep(.15,.45,abs(dd-1.2)))*(1.-smoothstep(12.,17.,along));veg=mix(veg,vec3(.07,.05,.035),rut*.85);}}
 rego=mix(rego,veg,zv);
 vec3 em=vec3(0.);
 if(vSite.x>.002&&zv<.95){float line=0.;if(hi){float he=hexEdge(vW/6.);line=1.-smoothstep(0.,.02+.12*(1.-lod),he);}line*=1.-zv;
  float ring=smoothstep(.93,1.,fract(vSite.z/22.-uTime*.08));em+=vec3(.05,.72,1.)*(line*.15*vSite.x+ring*.13*vSite.y+.035*vSite.x)*(1.-.85*zv);}
 float blight=vSite.w;
 if(blight>0.){float vein=1.-smoothstep(0.,.08,abs(va*2.-1.));if(hi)vein+=(1.-smoothstep(0.,.06,abs(vb*2.-1.)))*.5;
  rego=mix(rego,rego*vec3(.75,.45,.85),blight);em+=vec3(1.,.08,.62)*vein*blight*.5*(.7+.3*sin(uTime*2.3-dot(vW,vec2(.05))));}
 float at=vAtm,ndl=max(dot(N,normalize(mix(uSunDir,uDaySunW,at))),0.)*(1.-.88*texture2D(uShadowMap,(vW-uAtmoBox.xy)*uAtmoBox.zw).r*at);vec3 light=mix(uSunCol,uDaySun,at)*ndl+mix(mix(uAmbDn,uDayAmbDn,at),mix(uAmbUp,uDayAmbUp,at),N.y*.5+.5)+uRimCol*max(dot(N,uRimDir),0.)*.7*(1.-at);
 vec3 col=rego*light+em+uRimCol*min(rim,1.)*.03;if(hi)col+=(h12(gl_FragCoord.xy)-.5)/255.;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
const SOLID_VS=`attribute vec4 aCol;uniform vec4 uSite[8];uniform vec2 uOrigin;uniform vec3 uRimCol;uniform float uHigh;uniform sampler2D uAtmoMap,uShadowMap;uniform vec4 uAtmoBox;
varying vec3 vN;varying vec3 vV;varying vec4 vCol;varying vec3 vRim;varying vec3 vWP;varying float vAtm;varying float vShd;
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
 wp=modelMatrix*wp;vWP=wp.xyz;vec3 rc=uRimCol*2.2;vec2 uvA=(wp.xz+uOrigin-uAtmoBox.xy)*uAtmoBox.zw;vAtm=texture2D(uAtmoMap,uvA).r;vShd=texture2D(uShadowMap,uvA).r*vAtm;
 // HIGH tints each vertex's rim by the nearest friendly / Parasite site; LOW keeps the neutral rim (no per-vertex loop).
 if(uHigh>.5){vec2 w=wp.xz+uOrigin;float best=0.;for(int i=0;i<8;i++){vec4 s=uSite[i];if(s.z<=0.)continue;float f=1.-smoothstep(s.z*.6,s.z*1.25,length(w-s.xy));if(f>best){best=f;rc=mix(uRimCol*2.2,s.w>0.?vec3(.06,.62,.8):vec3(.85,.05,.55),f);}}}
 vRim=rc;}`;
const SOLID_FS=`uniform vec3 uSunCol,uAmbUp,uAmbDn,uSunV,uRimV,uUpV,uDaySun,uDayAmbUp,uDayAmbDn,uDaySunV;uniform float uTime,uGlow,uHigh;
varying vec3 vN;varying vec3 vV;varying vec4 vCol;varying vec3 vRim;varying vec3 vWP;varying float vAtm;varying float vShd;
#include <common>
#include <fog_pars_fragment>
void main(){vec3 N=normalize(vN),L=uSunV,R=uRimV,UP=uUpV; // view-space light directions, set once per frame
 float at=vAtm;L=normalize(mix(L,uDaySunV,at));vec3 base=vCol.rgb;float ndl=max(dot(N,L),0.);vec3 sunC=mix(uSunCol,uDaySun,at),aU=mix(uAmbUp,uDayAmbUp,at),aD=mix(uAmbDn,uDayAmbDn,at);
 vec3 lit=base*(sunC*ndl*(1.-.8*vShd)+mix(aD,aU,dot(N,UP)*.5+.5));float rl=max(dot(N,R),0.)*(1.-.7*at);lit+=base*vRim*rl*.5;
 if(uHigh>.5){vec3 V=normalize(vV);float fr=pow(1.-max(dot(N,V),0.),3.);lit+=mix(vRim,vec3(.55,.7,.9),at)*fr*(.25+.75*rl)*(.45-.3*at);vec3 H=normalize(L+V);lit+=sunC*pow(max(dot(N,H),0.),56.)*.16;}
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
void main(){vUv=uv;vCol=aCol;vec4 mvPosition=vec4(position,1.);float bs=length(modelMatrix[0].xyz);   // a billboard's 4 corners store its centre (merged Fx) or the origin (instanced P.bill)
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
const SKY_FS=`uniform vec3 uZenith,uBandA,uBandB,uFogC,uEarthL,uSunW,uDaySunW;uniform sampler2D uEarth;uniform float uSpin,uAtmo,uTime;
varying vec3 vDir;varying vec4 vCol;varying vec2 vQ;varying float vKind;
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5),b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5),c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5),e=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5);return mix(mix(a,b,f.x),mix(c,e,f.x),f.y);}
vec3 night(vec3 d){float h=d.y;float band=exp(-abs(h-.012)*85.);float glow=exp(-max(h,0.)*9.);float hi=exp(-max(h,0.)*2.6);
 vec3 c=uZenith+uBandB*(glow*.55+hi*.12)+uBandA*band;return mix(c,uFogC,smoothstep(.002,-.03,h));}
// Inside the zones: a thin, dusty atmosphere. Hazy amber horizon (#C9A27A) to dusky steel blue overhead (#4F6377), a low sun,
// broken dramatic clouds (dark bellies, sunlit amber rims) and distant dust haze along the horizon.
vec3 day(vec3 d){float h=max(d.y,0.);vec3 c=mix(vec3(.58,.36,.19),vec3(.078,.125,.18),pow(h,.42));float s=max(dot(d,uDaySunW),0.);
 c+=vec3(1.,.62,.3)*(pow(s,5.)*.35+pow(s,60.)*.9)+vec3(1.,.9,.75)*smoothstep(.9993,.9997,s)*9.;
 vec2 q=d.xz/(d.y+.1)*1.1+vec2(uTime*.004,uTime*.0015);float cl=vn(q)*.5+vn(q*2.3+3.7)*.3+vn(q*5.1+1.3)*.2;float cov=smoothstep(.46,.7,cl)*smoothstep(.0,.12,d.y),body=smoothstep(.55,.85,cl);
 vec3 cc=mix(vec3(.16,.13,.13),vec3(.36,.3,.27),body*.6)+vec3(1.,.55,.25)*pow(s,3.)*(1.-body)*.9;c=mix(c,cc,cov*.88);
 float haze=exp(-h*9.);c=mix(c,vec3(.5,.36,.24),haze*.55);return mix(c,uFogC,smoothstep(.03,-.05,d.y));}
vec3 sky(vec3 d){return uAtmo<.002?night(d):uAtmo>.998?day(d):mix(night(d),day(d),uAtmo);}
void main(){vec3 d=normalize(vDir);vec3 col;
 float nf=1.-uAtmo;if(vKind<.5){col=sky(d)+vCol.rgb*nf;}
 else if(vKind<1.5){float r2=dot(vQ,vQ);float core=exp(-r2*6.5);float cr=vCol.a>4.?(exp(-abs(vQ.x)*18.)*exp(-vQ.y*vQ.y*2.5)+exp(-abs(vQ.y)*18.)*exp(-vQ.x*vQ.x*2.5))*.55:0.;col=sky(d)+vCol.rgb*(core+cr)*nf*nf;}
 else{vec2 q=vQ*1.7;float r=length(q);vec3 L=normalize(uEarthL);float side=dot(q/max(r,1e-4),normalize(L.xy))*.5+.5;float o=max(r-1.,0.);
  vec3 halo=vec3(.12,.55,1.)*(exp(-o*6.)*(.22+.85*side)*.7+exp(-o*30.)*.55*(.4+.6*side));col=sky(d)+halo*(1.-uAtmo);
  if(r<1.){vec3 n=vec3(q,sqrt(1.-r*r));vec3 m=vec3(n.x,.92*n.y-.39*n.z,.39*n.y+.92*n.z);float lon=atan(m.x,m.z)+uSpin;float lat=asin(clamp(m.y,-1.,1.));
   vec3 tx=texture2D(uEarth,vec2(lon*.1591549+.5,lat*.3183099+.5)).rgb;float ndl=dot(n,L);float day=smoothstep(-.12,.32,ndl);
   vec3 s=tx*(.06+1.75*max(ndl,0.))*day+vec3(.0015,.004,.012)*(1.-day);s+=vec3(.16,.58,1.)*pow(1.-n.z,2.3)*(.1+1.3*smoothstep(-.35,.6,ndl));
   float aa=clamp((1.-r)/max(fwidth(r)*1.5,1e-4),0.,1.)*(1.-uAtmo);col=mix(col,s,aa);}}
 col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
// The atmosphere boundary: an additive shimmering veil (rising light bands + faint hex lattice), strongest at the ground and
// at grazing view angles, so crossing the zone edge reads as passing through the atmosphere of another world.
const VEIL_VS=`varying vec2 vUv;varying vec3 vWP;
#include <common>
void main(){vUv=uv;vec4 wp=modelMatrix*vec4(position,1.);vWP=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`;
const VEIL_FS=`uniform float uTime,uAtmo,uHigh;varying vec2 vUv;varying vec3 vWP;
float hexL(vec2 p){const vec2 r=vec2(1.,1.7320508);vec2 h=r*.5;vec2 a=mod(p,r)-h;vec2 b=mod(p-h,r)-h;vec2 g=dot(a,a)<dot(b,b)?a:b;vec2 q=abs(g);return .5-max(dot(q,vec2(.5,.8660254)),q.x);}
void main(){vec3 V=normalize(cameraPosition-vWP);float y=vUv.y,base=exp(-y*3.)*.9+exp(-y*.8)*.4+exp(-y*60.)*1.5,band=.5+.5*sin(vUv.x*.21+y*9.-uTime*1.3),sh=.6+.4*sin(vUv.x*.9-uTime*2.1+y*14.);
 float hx=uHigh>.5?(1.-smoothstep(0.,.04,hexL(vec2(vUv.x*.25,y*14.))))*.18:0.;float graz=1.-abs(V.y)*.5;float a=(base*(.55+.45*band)*sh+hx*exp(-y*2.))*graz*mix(1.,.14,uAtmo)*smoothstep(1.,.55,y);
 vec3 c=mix(vec3(.35,.7,1.),vec3(.75,.9,1.),band)*a*.42;gl_FragColor=vec4(c,1.);}`;   // additive (SRC_ALPHA, ONE): alpha 1 adds c
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

// Texture sources are generated once per session; every view gets its own Texture over the same image data (its renderer
// uploads it; dispose() frees only that GPU copy).
const TEXSRC={T:null,map:new Map()};
function texMemo(T,key,make){if(TEXSRC.T!==T){TEXSRC.T=T;TEXSRC.map.clear();}let t=TEXSRC.map.get(key);if(!t)TEXSRC.map.set(key,t=make());const c=t.clone();c.needsUpdate=true;return c;}
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
 const sunDir=V3(-.55,.5,.67).normalize(),rimDir=V3(.62,.32,-.72).normalize(),daySunDir=V3(-.7,.26,.66).normalize();   // inside the zones: a low frontier sun (~15 deg)
 const U={uTime:{value:0},uSunDir:{value:sunDir},uSunCol:{value:lin(0xe4ecff).multiplyScalar(2.9/Math.PI)},uRimDir:{value:rimDir},uRimCol:{value:lin(0x52c6ff).multiplyScalar(1.15/Math.PI)},
  uAmbUp:{value:lin(0x3a5a9c).multiplyScalar(1.5/Math.PI)},uAmbDn:{value:lin(0x16131f).multiplyScalar(1.5/Math.PI)},uSite:{value:Array.from({length:8},()=>new T.Vector4(0,0,0,0))},
  uOrigin:{value:new T.Vector2()},uGlow:{value:2.3},uHigh:{value:high?1:0},uSunV:{value:sunDir.clone()},uRimV:{value:rimDir.clone()},uUpV:{value:V3(0,1,0)},uViewport:{value:new T.Vector2(800,800)},uFade:{value:1},
  fogColor:{value:new T.Color(0x06070f)},fogNear:{value:900},fogFar:{value:2600},fogDensity:{value:.00025}};
 // Terraformed zones (owner art direction): a breathable daytime world under the atmosphere dome. The atmosphere map holds
 // each spot's zone factor (ConquestWorld.terraformAt), sampled per vertex: terrain, buildings and hulls inside a zone get warm
 // daylight with a blue-sky ambient; outside stays the black-skied grey Moon. uAtmo is the camera's own factor (sky, fog, veil).
 const AB=[600,860,1540,1560],atmoTex=(()=>{const N=high?128:96,d=new Uint8Array(N*N*4);for(let j=0;j<N;j++)for(let i=0;i<N;i++){const x=AB[0]+(i+.5)/N*(AB[2]-AB[0]),z=AB[1]+(j+.5)/N*(AB[3]-AB[1]),t=W.terraformAt?W.terraformAt(x,z):0,v=Math.round(255*Math.min(1,Math.max(0,(t-.03)/.13)));d.set([v,v,v,255],(j*N+i)*4);}
  const tx=new T.DataTexture(d,N,N);tx.magFilter=tx.minFilter=T.LinearFilter;tx.generateMipmaps=false;tx.needsUpdate=true;return tx;})();
 // Baked long shadows for the low frontier sun: every static caster (colony buildings, walls, towers, Refuge pods, hives,
 // forest trees) is swept along the sun direction into a ground shadow texture once (no shadow-map pass per frame). Terrain
 // darkens under it; hulls and buildings sampling it per vertex dim as they pass through. Moving units cast nothing.
 const shadowTex=(()=>{const NX=high?512:256,NZ=high?384:192,d=new Uint8Array(NX*NZ*4),sx=(AB[2]-AB[0])/NX,sz=(AB[3]-AB[1])/NZ,hd=Math.hypot(daySunDir.x,daySunDir.z),dx=-daySunDir.x/hd,dz=-daySunDir.z/hd,cot=hd/daySunDir.y,v=new Float32Array(NX*NZ);
  const splat=(x,z,k)=>{const i=Math.floor((x-AB[0])/sx),j=Math.floor((z-AB[1])/sz);if(i<0||j<0||i>=NX||j>=NZ)return;const q=j*NX+i;if(k>v[q])v[q]=k;};
  const cast=(pts,h,own)=>{const L=Math.min(70,h*cot),st=Math.min(sx,sz);for(const [x,z] of pts)for(let t=0;t<=L;t+=st){const px=x+dx*t,pz=z+dz*t;if(own&&own(px,pz))continue;splat(px,pz,.92-.35*t/Math.max(L,1));}};   // never on the caster's own footprint
  const rect=(x,z,w,dd,r)=>{const c=Math.cos(r),s2=Math.sin(r),out=[];for(let u=-w/2;u<=w/2;u+=1.5)for(let q=-dd/2;q<=dd/2;q+=1.5)out.push([x+u*c-q*s2,z+u*s2+q*c]);return out;},inRect=(x,z,w,dd,r)=>(px,pz)=>{const c=Math.cos(r),s2=Math.sin(r),ex=px-x,ez=pz-z;return Math.abs(ex*c+ez*s2)<=w/2+.8&&Math.abs(-ex*s2+ez*c)<=dd/2+.8;},inDisc=(x,z,r)=>(px,pz)=>Math.hypot(px-x,pz-z)<=r+.8;
  const disc=(x,z,r)=>{const out=[];for(let a=0;a<6.283;a+=.5)for(let rr=.5;rr<=r;rr+=1.5)out.push([x+Math.cos(a)*rr,z+Math.sin(a)*rr]);out.push([x,z]);return out;};
  for(const l of W.COLONY?.lots||[])if(l.s||l.k==='turbine')cast(rect(l.x,l.z,l.w,l.d,l.r),l.h,inRect(l.x,l.z,l.w,l.d,l.r));
  for(let i=0;i<3;i++)cast(disc(1150+i*30,1080,10),120,inDisc(1150+i*30,1080,12));for(let i=0;i<9;i++)cast(disc(1110+i%3*22,1148+Math.floor(i/3)*25,7),9,inDisc(1110+i%3*22,1148+Math.floor(i/3)*25,7.8));
  for(const b of W.installations||[])cast(rect(b.x,b.z+8,18,12,0),12,inRect(b.x,b.z+8,18,12,0));for(const p of W.pylons||[])cast(disc(p.x,p.z,1.2),15);
  for(const f of W.forests||[])for(const t of W.forestTrees(f))cast(disc(t.x,t.z,1.6*t.size*.75),6.5*t.size*.75);
  for(let q=0;q<v.length;q++){const b=Math.round(255*v[q]);d[q*4]=d[q*4+1]=d[q*4+2]=b;d[q*4+3]=255;}
  const tx=new T.DataTexture(d,NX,NZ);tx.magFilter=tx.minFilter=T.LinearFilter;tx.generateMipmaps=false;tx.needsUpdate=true;return tx;})();
 Object.assign(U,{uShadowMap:{value:shadowTex},uAtmo:{value:0},uAtmoMap:{value:atmoTex},uAtmoBox:{value:new T.Vector4(AB[0],AB[1],1/(AB[2]-AB[0]),1/(AB[3]-AB[1]))},uSunW:{value:sunDir},
  uDaySun:{value:lin(0xffdcb6).multiplyScalar(3.6/Math.PI)},uDayAmbUp:{value:lin(0x7088a8).multiplyScalar(1.25/Math.PI)},uDayAmbDn:{value:lin(0x5a4a38).multiplyScalar(.8/Math.PI)},
  uDaySunW:{value:daySunDir},uDaySunV:{value:daySunDir.clone()}});
 const G={box:new T.BoxGeometry(1,1,1),hex:flat(new T.CylinderGeometry(1,1,1,6,1,false,Math.PI/6)).translate(0,.5,0),oct:flat(new T.CylinderGeometry(1,1,1,8,1,false,Math.PI/8)).translate(0,.5,0),
  cyl:new T.CylinderGeometry(1,1,1,16,1).translate(0,.5,0),cylC:new T.CylinderGeometry(1,1,1,10,1),cone5:flat(new T.ConeGeometry(1,1,5)).translate(0,.5,0),cone6:flat(new T.ConeGeometry(1,1,6)).translate(0,.5,0),
  torus:new T.TorusGeometry(1,.065,6,40),ico:new T.IcosahedronGeometry(1,2),octa:new T.OctahedronGeometry(1,0),blob1:blob(1,.13,11),blob2:blob(2,.06,23),rock:blob(1,.17,5),
  shard:flat(new T.LatheGeometry([new T.Vector2(0,-.02),new T.Vector2(.3,0),new T.Vector2(.34,.68),new T.Vector2(0,1)],6)),
  pod:new T.LatheGeometry([[0,0],[.1,0],[.12,.3],[.3,.5],[.34,.66],[.26,.8],[.1,.9],[0,.92]].map(([r,y])=>new T.Vector2(r,y)),8),
  dome:new T.SphereGeometry(1,high?28:18,high?14:9,0,TAU,0,Math.PI/2)};
 const fr={};G.hexF=r=>fr['h'+r]||(fr['h'+r]=flat(new T.CylinderGeometry(r,1,1,6,1,false,Math.PI/6)).translate(0,.5,0));
 G.octF=r=>fr['o'+r]||(fr['o'+r]=flat(new T.CylinderGeometry(r,1,1,8,1,false,Math.PI/8)).translate(0,.5,0));G.cylF=r=>fr['c'+r]||(fr['c'+r]=new T.CylinderGeometry(r,1,1,20,1).translate(0,.5,0));
 const tex={atlas:texMemo(T,'atlas'+high,()=>makeAtlas(T,high?512:256)),earth:texMemo(T,'earth'+high,()=>makeEarth(T,high?256:128,high?128:64)),detail:texMemo(T,'detail'+high,()=>makeDetail(T,high?256:128))};
 const mk=(vs,fs,extra,o)=>{const m=new T.ShaderMaterial(Object.assign({uniforms:Object.assign({},U,extra||{}),vertexShader:vs,fragmentShader:fs,fog:true},o||{}));m.userData.motionSkip=true;m.userData.conquestStyle=true;return m;};
 const MAT={terrain:mk(TERRAIN_VS,TERRAIN_FS,{uDetail:{value:tex.detail}},{vertexColors:true}),solid:mk(SOLID_VS,SOLID_FS),
  fx:mk(FX_VS,FX_FS,{uMap:{value:tex.atlas},uKind:{value:[V3(.1,.68,1).multiplyScalar(.6),V3(.3,1,.5).multiplyScalar(.5),V3(.6,.95,1).multiplyScalar(.9),V3(1,.1,.7).multiplyScalar(.7)]}},
   {transparent:true,premultipliedAlpha:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-8}),
  sky:mk(SKY_VS,SKY_FS,{uEarth:{value:tex.earth},uEarthDir:{value:V3(.86,.15,.48).normalize()},uEarthSize:{value:.068},uEarthL:{value:V3(-.62,.34,.7).normalize()},uSpin:{value:2.2},
   uZenith:{value:V3(.0002,.0003,.0009)},uBandA:{value:V3(0,.2,.19)},uBandB:{value:V3(.045,.012,.11)},uFogC:{value:V3(.0018,.0021,.0048)}},{fog:false,depthWrite:false,side:T.DoubleSide})};
 const shieldMat=(color,opacity,hexK=1,side=T.DoubleSide)=>{const m=new T.ShaderMaterial({uniforms:{uColor:{value:lin(color)},uTime:U.uTime,uOpacity:{value:opacity},uHex:{value:hexK}},vertexShader:SHIELD_VS,fragmentShader:SHIELD_FS,transparent:true,premultipliedAlpha:true,depthWrite:false,blending:T.AdditiveBlending,side});m.userData.motionSkip=true;m.userData.conquestStyle=true;return m;};
 MAT.shield=shieldMat(0x48d8ff,.85);MAT.field=shieldMat(0x2dd4ff,.32,.12,T.FrontSide);
 MAT.veil=new T.ShaderMaterial({uniforms:{uTime:U.uTime,uAtmo:U.uAtmo,uHigh:U.uHigh},vertexShader:VEIL_VS,fragmentShader:VEIL_FS,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});MAT.veil.userData.conquestStyle=true;MAT.veil.userData.motionSkip=true;
 // Additive glow/decal draws are never tap targets (view pick() and the browser bots skip userData.noPick).
 const fxMesh=(geo,order=2)=>{const m=new T.Mesh(geo,MAT.fx);m.renderOrder=order;m.userData.noPick=true;return m;};
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
  quad(a,b,c,d,col,em=0,col2){const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];let nx=e2[1]*e1[2]-e2[2]*e1[1],ny=e2[2]*e1[0]-e2[0]*e1[2],nz=e2[0]*e1[1]-e2[1]*e1[0];const l=Math.hypot(nx,ny,nz)||1;if(ny<0){nx=-nx;ny=-ny;nz=-nz;}
   for(const [i,p] of [a,b,c,d].entries()){const q=col2&&(i===2||i===3)?col2:col;this.P.push(p[0],p[1],p[2]);this.N.push(nx/l,ny/l,nz/l);this.A.push(q.r,q.g,q.b,em);}this.I.push(this.n,this.n+1,this.n+2,this.n,this.n+2,this.n+3);this.n+=4;return this;}
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
   g.setAttribute('aCol',new T.Float32BufferAttribute(this.A,4));g.setAttribute('aBill',new T.Float32BufferAttribute(this.B,3));g.setIndex(this.I);g.computeBoundingSphere();
   let bb=0;for(let i=0;i<this.B.length;i+=3)if(this.B[i+2])bb=Math.max(bb,Math.hypot(this.B[i],this.B[i+1]));if(bb)g.boundingSphere.radius+=bb*1.2;return g;}
  mesh(){return this.n?fxMesh(this.geometry()):new T.Group();}}
 S.Bld=Bld;S.Fx=Fx;
 const pair=(Sb,X)=>{const g=new T.Group();g.add(Sb.mesh(),X.mesh());return g;};

 // ---------- instanced prop geometry (unit space) ----------
 const cr=new Bld();for(const [x,z,h,tx,tz,r] of [[0,0,1,0,0,.95],[.45,.12,.7,.38,-.2,.62],[-.42,.22,.62,-.32,.26,.56],[.12,-.48,.55,.14,.4,.5],[-.3,-.36,.46,-.28,-.3,.44],[.52,-.3,.38,.42,.3,.4]])cr.add(G.shard,M(x,-.04,z,tz*.6,0,-tx*.6,r,h,r),null,0,null,gradC(0,1,...CYC));
 const fu=new Bld();for(const [x,z,s] of [[0,0,1],[.5,.2,.72],[-.45,.3,.6],[.15,-.5,.66],[-.35,-.4,.45]])fu.add(G.pod,M(x,0,z,0,x*3,0,s,s,s),null,0,null,(v,lx,ly)=>ly<.3?[.012,.02,.03,0]:ly<.72?[.02,.015,.07,.15]:[.08,.9,.35,.75]);
 const rk=new Bld();rk.add(G.rock,new T.Matrix4(),null,0,null,v=>{const k=clamp01(v.y*.5+.5);return [.022+.042*k,.024+.045*k,.03+.052*k,0];});
 // inside the zones: weathered grey-brown stone with moss on the upward faces (same shape and collision envelope)
 const rkm=new Bld();rkm.add(G.rock,new T.Matrix4(),null,0,null,(v,lx,ly,lz)=>{const k=clamp01(v.y*.5+.5),mo=clamp01((ly-.25)*2.2);return [(.07+.08*k)*(1-mo)+.05*mo,(.065+.072*k)*(1-mo)+.075*mo,(.058+.06*k)*(1-mo)+.03*mo,0];});
 const rl=new Bld();rl.box(0,4.6,0,.22,9.2,.22,K.mid);rl.box(0,.25,0,.9,.5,.9,K.dark);for(const y of [3,6])rl.box(0,y,0,1.3,.08,.08,K.dark2);rl.add(G.cone6,M(.35,8.4,0,0,0,-1.1,.9,.35,.9),K.panelB);rl.box(0,9.35,0,.32,.32,.32,K.ice,1);rl.box(0,4.6,.12,.05,8.4,.03,K.cyan,1);
const billGeo=(r,col,o=0)=>{const X=new Fx();X.keep=true;X.bill(0,0,0,1,r,col,o);return keep(X.geometry());};
 const P={crystal:keep(cr.geometry()),fungus:keep(fu.geometry()),rock:keep(rk.geometry()),rockMoss:keep(rkm.geometry()),relay:keep(rl.geometry()),bill:billGeo(AT.BLOB,[1,1,1])};
 S.P=P;

 // ---------- The terraformed south (Phase 2): engineered flora, forests, water, atmosphere pylons, dam, bridge, crater ----------
 // Presentation only. Every position comes from ConquestWorld (terraZone, flora, forestTrees, water, pylons, floraNodes);
 // nothing here is collision. Drive-through plants stay <= 1.5 m; only forest stands (the cover canopy) grow tall.
 MAT.water=mk(WATER_VS,WATER_FS,{},{side:T.DoubleSide});const waterWarmGeo=keep(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,0,1],3)).setAttribute('aFlow',new T.Float32BufferAttribute([0,0,1,0,0,1],2)));
 // Flora budget: buds are 8-triangle gems (G.octa) and crowns 20-triangle gems, never the 320-triangle G.ico sphere.
 const leafG=keep(flat(new T.OctahedronGeometry(1,0)).scale(1,.5,1).translate(0,.5,0)),gem=keep(new T.IcosahedronGeometry(1,0)),cushion=keep(blob(0,.16,11)),TP={};
 {const stem=lin(0x3b2a1c),olive=lin(0x6b7a3a),straw=lin(0xa89a5b),dkg=lin(0x3e5a2e),bark=lin(0x3e3024),burnt=lin(0x1c1814);
  // Rugged frontier flora (owner art direction). plant: hardy scrub, a low olive bush with a few dry thorn spikes
  const pl=new Bld();const nb=high?3:2;for(let k=0;k<nb;k++){const a=k/nb*TAU+.4,r=.25+.1*k;pl.add(gem,M(Math.cos(a)*r,.3,Math.sin(a)*r,0,a,0,.5,.3,.45),k%2?olive:dkg);}
  for(let k=0;k<(high?4:2);k++){const a=k*1.7+.2;pl.spike(V3(Math.cos(a)*.2,.15,Math.sin(a)*.2),V3(Math.cos(a)*.8,.75+.15*(k%2),Math.sin(a)*.8),.04,stem);}TP.plant=keep(pl.geometry());
  // flower patch (only near the colony core)
  const fl=new Bld();fl.add(gem,M(0,.15,0,0,0,0,.4,.2,.4),dkg);for(let k=0;k<4;k++){const a=k*1.6;fl.add(G.octa,M(Math.cos(a)*.35,.42,Math.sin(a)*.35,0,0,0,.08,.06,.08),k%2?lin(0xd8c27a):lin(0xe6dccb));}TP.flower=keep(fl.geometry());
  // fern for gullies and stream banks
  const fe=new Bld();for(let k=0;k<(high?6:4);k++){const a=k/(high?6:4)*TAU;fe.add(leafG,MR(0,0,a,.05,.05,1.05,.22,.95,.03),k%2?lin(0x4f7a30):lin(0x3f6a26));}TP.fern=keep(fe.geometry());
  // rare crystal sprout accent (the old teal growth)
  const cs=new Bld();for(let k=0;k<3;k++)cs.add(G.shard,M(Math.cos(k*2.1)*.15,0,Math.sin(k*2.1)*.15,.3*Math.cos(k*2.1),k,.3*Math.sin(k*2.1),.3,.9+.3*k,.3),lin(0x4fe0c8),.9);TP.crystal=keep(cs.geometry());
  // moss cushion on the fringe
  const li=new Bld();li.add(cushion,M(0,.04,0,0,0,0,1,.14,.8),lin(0x4a5226));TP.lichen=keep(li.geometry());
  // burnt stump (war edge and blight): charred trunk with a magenta vein where the blight took it
  const st=new Bld();st.add(G.hex,M(0,0,0,0,.4,0,.22,.75,.22),burnt);st.spike(V3(0,.7,0),V3(.18,1.15,.05),.09,burnt);st.seg(V3(.05,.05,.2),V3(.02,.7,.2),.035,K.mag,.9);TP.stump=keep(st.geometry());
  // trees (cover canopy is 7.5 m): wind-bent conifer, muted broadleaf, dead/burnt tree; one shared far LOD
  const co=new Bld();co.add(G.hex,M(0,0,0,.08,0,0,.24,2.6,.24),bark);const tiers=high?4:3;for(let t=0;t<tiers;t++){const y=1.7+t*1.4,r=2.1-t*.48;co.add(G.cone6,M(.35+t*.28,y,0,0,t*.5,-.12,r*1.05,2.3,r*.85),t%2?lin(0x2a4220):lin(0x33502a));}TP.tree=keep(co.geometry());
  const bl=new Bld();bl.add(G.hex,M(0,0,0,.1,0,0,.28,3.5,.28),bark);bl.add(G.hex,M(.4,2.5,0,0,0,.7,.12,1.6,.12),bark);const n=high?5:3;for(let k=0;k<n;k++){const a=k/n*TAU+.3,r=k?1.2:0;bl.add(gem,M(.5+Math.cos(a)*r,k?4.3+.4*(k%2):5.3,Math.sin(a)*r,0,a,0,k?1.45:1.8,k?1.05:1.3,k?1.4:1.7),[lin(0x4b5a2c),lin(0x3a4a24),lin(0x5e6630)][k%3]);}TP.treeBroad=keep(bl.geometry());
  const dd=new Bld();dd.add(G.hex,M(0,0,0,.12,0,0,.26,6.2,.26),burnt);for(const [y,a,l] of [[3.2,.4,1.8],[4.4,2.6,1.5],[5.3,4.4,1.2],[2.4,5.5,1.4]])dd.seg(V3(0,y,0),V3(Math.cos(a)*l,y+.9,Math.sin(a)*l),.07,burnt);TP.treeDead=keep(dd.geometry());TP.treeAutumn=TP.treeDead;
  const tf=new Bld();tf.add(G.hex,M(0,0,0,0,0,0,.26,3.4,.26),bark);tf.add(G.cone6,M(.3,2.4,0,0,0,0,2.1,3.2,1.9),lin(0x2f4a24));tf.add(G.cone6,M(.6,4.6,0,0,.5,0,1.5,2.6,1.4),lin(0x3a5228));TP.treeFar=keep(tf.geometry());
  // bio-flora node (the harvestable Biomass plant, kept readable for gameplay): a tough bush; ready = glowing pods
  const bulb=(b,hot)=>{b.add(G.cone5,M(0,0,0,0,0,0,.12,.7,.12),stem);for(let k=0;k<4;k++){const a=k*TAU/4+.4;b.add(gem,M(Math.cos(a)*.38,.7,Math.sin(a)*.38,0,a,0,.5,.42,.5),k%2?olive:dkg);}
   if(hot)for(let k=0;k<5;k++){const a=k*1.3;b.add(G.octa,M(Math.cos(a)*.55,1+.15*(k%2),Math.sin(a)*.55,0,0,0,.13,.13,.13),lin(0xff5fd2),1.6);}else b.add(gem,M(0,1,0,0,0,0,.2,.2,.2),lin(0x5a4a3a));return b;};
  TP.node=keep(bulb(new Bld(),true).geometry());TP.nodeDim=keep(bulb(new Bld(),false).geometry());
  // grass clump: blades of varied height in olive, dry straw and dark green, mixed per clump (HIGH 6 blades, LOW 3)
  const tu=new Bld(),cols=[olive,straw,dkg,olive,straw,dkg];for(let k=0;k<(high?6:3);k++)tu.add(leafG,MR(0,0,k*1.05+.4,0,.08+.04*(k%2),.28+.06*(k%3),.08,.45+.18*((k*7)%5),.03),cols[k]);TP.tuft=keep(tu.geometry());}
 S.TP=TP;
 // Per fine chunk: the visual flora field plus the legacy scenery 'tree' items, drawn by today's terraZone (lush/grass
 // plant, lichen cushion, a blight stump inside the war region; nothing on the far frontier). Two instanced draws at most.
 S.flora=(cx,cz,legacy=[])=>{const ox=cx*128,oz=cz*128,g=new T.Group(),plants=[],lichen=[],stumps=[];
  const add=(p,zone)=>{if(zone==='lush'||zone==='grass')plants.push([p,zone==='lush'?1:.62]);else if(zone==='lichen')lichen.push(p);else stumps.push(p);};
  for(const p of root.ConquestWorld.flora(cx,cz))add(p,p.zone);
  for(const p of legacy){if(p.x<640||p.x>1500||p.z<900||p.z>1520)continue;add(p,root.ConquestWorld.terraZone(p.x,p.z));}
  // ground cover around each lush/grass plant (deterministic; off water and solids, on the real ground height)
  const Wd=root.ConquestWorld,tufts=[],per=1;for(const [p,k] of plants)for(let j=0,n=k===1?per:high?1:0;j<n;j++){const h=hash3(Math.round(p.x*7),Math.round(p.z*7),j+5),a=h*TAU*3,r=1.4+2.6*((h*7.31)%1),x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;
   if(Math.floor(x/128)!==cx||Math.floor(z/128)!==cz||Wd.waterAt(x,z)||Wd.solidAt(x,z)||Wd.deckAt(x,z)!==null)continue;tufts.push({x,z,y:Wd.groundAt(x,z),s:(.8+.5*((h*13.7)%1))*k,a});}
  const inst=(geo,list,fn)=>{if(!list.length)return;const im=new T.InstancedMesh(geo,MAT.solid,list.length);list.forEach((e,i)=>im.setMatrixAt(i,fn(e)));im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.userData.noPick=true;g.add(im);};
  inst(TP.plant,plants,([p,k])=>{const sc=Math.min(1.5/1.35,(.75+.45*p.size))*k;return M(p.x-ox,p.y-.04,p.z-oz,0,p.variant*40,0,sc,sc,sc);});
  inst(TP.lichen,lichen,p=>M(p.x-ox,p.y-.02,p.z-oz,0,p.variant*40,0,.8+.9*p.size,1,.8+.9*p.size));
  if(stumps.length)inst(TP.stump,stumps,p=>M(p.x-ox,p.y-.05,p.z-oz,0,p.variant*40,0,1,.8+.4*p.size,1));
  // dense clump field (noise-driven: ~45% grass cover in the wild, sparser toward the frontier); ferns by water; rare crystals
  const ferns=[],crys=[],flowers=[],step=high?4.8:7;for(let gx=0;gx<128;gx+=step)for(let gz=0;gz<128;gz+=step){const h=hash3(cx*977+Math.round(gx*3),cz*613+Math.round(gz*3),11),x=ox+gx+(h-.5)*step,z=oz+gz+(((h*7.31)%1)-.5)*step;
   const tf=Wd.terraformAt(x,z);if(tf<.06)continue;const cover=.5+.5*Math.sin(x*.045+Math.sin(z*.03)*2)*Math.cos(z*.05),dc=Math.hypot(x-1130,z-1125);if(((h*13.7)%1)>cover*(dc<220?.85:.6))continue;
   if(Wd.waterAt(x,z)||Wd.solidAt(x,z)||Wd.deckAt(x,z)!==null||Wd.clearedAt(x,z)||Wd.forestAt(x,z)?.core)continue;const y=Wd.groundAt(x,z),r=(h*29.3)%1;
   if(r<.03)crys.push({x,z,y,a:h*40});else if(Wd.creekNearest&&Wd.creekNearest(x,z).d<14&&r<.5)ferns.push({x,z,y,a:h*40,s:.8+.6*((h*3.7)%1)});else if(dc<170&&r<.08)flowers.push({x,z,y,a:h*40});else tufts.push({x,z,y,s:.7+.8*((h*5.3)%1),a:h*40});}
  inst(TP.tuft,tufts,p=>M(p.x-ox,p.y-.03,p.z-oz,0,p.a,0,p.s,p.s*(.8+.5*((p.a*.37)%1)),p.s));if(tufts.length)g.userData.tufts=g.children[g.children.length-1];
  inst(TP.fern,ferns,p=>M(p.x-ox,p.y-.03,p.z-oz,0,p.a,0,p.s,p.s,p.s));if(high){inst(TP.crystal,crys,p=>M(p.x-ox,p.y-.05,p.z-oz,0,p.a,0,1,1,1));inst(TP.flower,flowers,p=>M(p.x-ox,p.y-.03,p.z-oz,0,p.a,0,1,1,1));}
  return g;};
 // Ground flora is <= 1.5 m: per fine chunk it is hidden beyond a distance (tufts sooner), measured from the hull.
 const FLORA_RANGE=high?180:150,TUFT_RANGE=high?150:100;
 S.floraCull=(chunks,p)=>{for(const c of chunks){const g=c.group.userData.flora;if(!g)continue;const d=Math.hypot(c.cx*128+64-p.x,c.cz*128+64-p.z);g.visible=d<FLORA_RANGE;if(g.userData.tufts)g.userData.tufts.visible=d<TUFT_RANGE;}};
 // Once per view: forests, water, pylons + domes, the dam, the creek bridge, the ice-mining crater and the bio-flora nodes,
 // in WORLD coordinates (the view moves the group by the floating origin). update(t, harvested) re-tints the nodes.
 const FLORA_LOD=high?80:55,ringG=keep(new T.TorusGeometry(1,.065,4,high?24:16));// m beyond a forest stand's edge where its trees switch to the far LOD
 S.terraWorld=()=>{const Wd=root.ConquestWorld,Wa=Wd.water,g=new T.Group(),Sb=new Bld(),X=new Fx(),domes=[];g.name='cq-terraformed-south';
  // forests: per stand a detailed and a far (LOD) instanced draw; update() shows one of them by camera distance
  const stands=Wd.forests.map((f,si)=>{const trees=Wd.forestTrees(f),lod={f,near:null,far:null,near2:null};if(!trees.length)return lod;
   const draw=(geo,list)=>{const im=new T.InstancedMesh(geo,MAT.solid,Math.max(1,list.length));im.count=list.length;list.forEach((p,i)=>{const k=p.size*.75*(p.edge?.85:1);im.setMatrixAt(i,M(p.x,p.y-.1,p.z,(p.variant-.5)*.16,-.85+p.variant*.5,0,k,k*(.85+.3*p.variant),k));});im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.userData.noPick=true;g.add(im);return im;};
   const conShare=[.55,.75,.3,.35,.5][si%5],con=trees.filter(p=>p.variant<conShare),broad=trees.filter(p=>p.variant>=conShare);
   lod.near=draw(TP.tree,con);lod.near2=draw(si===0||si===4?TP.treeDead:TP.treeBroad,broad);lod.far=draw(TP.treeFar,trees);lod.far.visible=false;return lod;});
  // water: creek ribbon + reservoir + crater pool, one merged geometry and one draw
  const Pw=[],Fw=[],Iw=[];const quad=(a,b,c,d)=>Iw.push(a,b,c,a,c,d);
  {const c=Wa.creek,pts=[];for(let i=1;i<c.length;i++){const [ax,az]=c[i-1],[bx,bz]=c[i],l=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(l/2));for(let k=i===1?0:1;k<=n;k++){const u=k/n;pts.push([ax+(bx-ax)*u,az+(bz-az)*u]);}}
   let run=0;pts.forEach(([x,z],i)=>{const [px,pz]=pts[Math.max(0,i-1)],[nx,nz]=pts[Math.min(pts.length-1,i+1)],tx=nx-px,tz=nz-pz,l=Math.hypot(tx,tz)||1,ux=-tz/l,uz=tx/l,y=Wd.waterTopAt(x,z);if(i)run+=Math.hypot(x-px,z-pz);
    const k=Pw.length/3;for(const s of [-1,1]){const h=Wa.half+.25;Pw.push(x+ux*h*s,y,z+uz*h*s);Fw.push(run+.001,s);}if(i)quad(k-2,k-1,k+1,k);});}
  const disc=(x,z,rx,rz,y,clipZ=Infinity)=>{const k=Pw.length/3,n=high?48:28;Pw.push(x,y,z);Fw.push(0,0);for(let i=0;i<=n;i++){const a=i/n*TAU;Pw.push(x+Math.cos(a)*rx,y,Math.min(clipZ,z+Math.sin(a)*rz));Fw.push(0,1);}for(let i=1;i<=n;i++)Iw.push(k,k+i+1,k+i);};
  disc(Wa.lake.x,Wa.lake.z,Wa.lake.rx+1,Wa.lake.rz+1,Wa.lake.surface,Wa.dam.z-Wa.dam.depth/2);disc(Wa.crater.x,Wa.crater.z,Wa.crater.pool+.6,Wa.crater.pool+.6,Wd.waterTopAt(Wa.crater.x,Wa.crater.z));
  {const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(Pw,3));geo.setAttribute('aFlow',new T.Float32BufferAttribute(Fw,2));geo.setIndex(Iw);geo.computeBoundingSphere();const m=new T.Mesh(geo,MAT.water);m.userData.noPick=true;m.name='cq-water';g.add(m);}
  // atmosphere pylons: plinth, slender mast, three emitter rings, crown; dome pylons carry a low atmosphere shell
  for(const p of Wd.pylons){const y=ground(p.x,p.z);Sb.add(G.hex,M(p.x,y-.6,p.z,0,0,0,1.7,1.2,1.7),K.dark);Sb.add(G.hex,M(p.x,y+.55,p.z,0,0,0,1.75,.12,1.75),K.cyan,1);Sb.add(G.hex,M(p.x,y,p.z,0,0,0,.42,14,.42),K.dark2);
   for(const h of [5,9,12.6])Sb.add(ringG,M(p.x,y+h,p.z,Math.PI/2,0,0,1.1-h*.03,1.1-h*.03,2.4),K.cyan,1.3);Sb.add(G.ico,M(p.x,y+14.4,p.z,0,0,0,.55,.55,.55),K.ice,1.8);
   if(high)X.bill(p.x,y+14.4,p.z,4.2,AT.BLOB,E(0x5cf2ff,.6));if(p.dome)domes.push([p.x,y,p.z]);}
  // the terraformers' dam across the reservoir outlet, with a neon crest and spillway glow
  {const d=Wa.dam,cx=(d.x0+d.x1)/2;let lo=Infinity;for(let x=d.x0;x<=d.x1;x+=3)lo=Math.min(lo,ground(x,d.z));const top=Wa.lake.surface+1.6;
   Sb.add(G.box,M(cx,(lo-2+top)/2,d.z,0,0,0,d.x1-d.x0,top-lo+2,d.depth),K.wall);Sb.add(G.box,M(cx,top+.08,d.z-d.depth/2+.2,0,0,0,d.x1-d.x0,.16,.3),K.cyan,1.2);
   for(let x=d.x0+6;x<d.x1-4;x+=10)Sb.add(G.box,M(x,(lo+top)/2,d.z+d.depth/2+.05,0,0,0,.3,top-lo-.5,.1),K.dark2);if(high)X.flat(cx,Wa.lake.surface+.05,d.z-d.depth/2-1.2,(d.x1-d.x0)*.45,2.6,AT.BLOB,E(0x5cf2ff,.35));}
  // the creek bridge: deck segments along its arch + glowing rails
  {const b=Wd.creekBridge,n=12;for(let i=0;i<n;i++){const s0=-b.half+i*2*b.half/n,s1=s0+2*b.half/n,xa=b.x+b.ax*s0,za=b.z+b.az*s0,xb=b.x+b.ax*s1,zb=b.z+b.az*s1,ya=Wd.deckAt(xa,za)??ground(xa,za),yb=Wd.deckAt(xb,zb)??ground(xb,zb),cxm=(xa+xb)/2,czm=(za+zb)/2,ang=Math.atan2(b.ax,b.az);
    const tilt=-Math.atan2(yb-ya,Math.hypot(xb-xa,zb-za)),len=Math.hypot(xb-xa,zb-za,yb-ya);Sb.add(G.box,MR(cxm,czm,ang,(ya+yb)/2-.22,0,tilt,b.width*2,.42,len+.04),K.dark2);
    for(const w of [-1,1])Sb.add(G.box,MR(cxm+b.az*w*b.width,czm-b.ax*w*b.width,ang,(ya+yb)/2+.55,0,tilt,.12,.1,len),K.cyan,1.1);}}
  // the ice-mining crater: ice blocks around the meltwater pool, a drilling rig and the outflow pipe
  {const k=Wa.crater,y0=ground(k.x,k.z);for(let i=0;i<(high?12:8);i++){const a=i/(high?12:8)*TAU+.2,r=k.pool+2.5+(i%3);Sb.add(G.shard,M(k.x+Math.cos(a)*r,ground(k.x+Math.cos(a)*r,k.z+Math.sin(a)*r)-.2,k.z+Math.sin(a)*r,(i%2)*.3,a,0,1.1+(i%4)*.35,1.6+(i%3)*.7,1.1),K.ice,.55);}
   const rx=k.x-k.pool-4,rz=k.z-2,ry=ground(rx,rz);for(const [a,b] of [[-1.6,-1.6],[1.6,-1.6],[1.6,1.6],[-1.6,1.6]])Sb.seg(V3(rx+a,ry,rz+b),V3(rx+a*.25,ry+8,rz+b*.25),.18,K.mid);Sb.add(G.box,M(rx,ry+8.2,rz,0,0,0,1.4,.6,1.4),K.dark2);Sb.add(G.hex,M(rx,ry,rz,0,0,0,.18,9,.18),K.cyan,1.2);
   Sb.seg(V3(rx,ry+1,rz),V3(k.x,y0+1.2,k.z),.28,K.panelA);if(high)X.bill(rx,ry+9,rz,2.6,AT.BLOB,E(0x9ff6ff,.55));}
  // rocks in the stream: wet boulders along the creek, the odd one mid-current
  {const c=Wa.creek;for(let i=1;i<c.length;i++){const [ax,az]=c[i-1],[bx,bz]=c[i],L=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/L,nz=(bx-ax)/L;for(let t=4;t<L;t+=9){const side=((i*7+t)%3)-1,o=side*(Wa.half-.6)+((t*13)%5-2)*.3,x=ax+(bx-ax)*t/L+nx*o,z=az+(bz-az)*t/L+nz*o,sz=.5+((i*3+t)%4)*.22;Sb.add(G.rock,M(x,Wd.waterTopAt(x,z)-.35,z,0,t,0,sz*1.2,sz*.7,sz),lin(0x2a2a28));}}}
  // fords: stepping stones across the creek
  for(const f of Wa.fords)for(let i=0;i<7;i++){const a=i*2.4,r=1.2+(i%3)*1.7;Sb.add(G.rock,M(f.x+Math.cos(a)*r,ground(f.x+Math.cos(a)*r,f.z+Math.sin(a)*r)+.25,f.z+Math.sin(a)*r,0,a,0,.9,.35,.7),K.mid);}
  g.add(Sb.mesh());if(X.n)g.add(fxMesh(X.geometry()));
  if(domes.length){const dB=new Bld();for(const [x,y,z] of domes)dB.add(G.dome,M(x,y-.5,z,0,0,0,9,7,9),K.cyan,0);const dm=new T.Mesh(dB.geometry(),MAT.field);dm.renderOrder=3;dm.userData.noPick=true;g.add(dm);}
  // bio-flora nodes: ready (bright, haloed) and regrowing (dim) — rebuilt only when a node changes state
  const nodes=new T.Group();nodes.name='cq-bio-flora';g.add(nodes);let key='';
  g.userData.lod=(cam)=>{if(!cam)return;const cx=cam.position.x-g.position.x,cz=cam.position.z-g.position.z;
   for(const L of stands)if(L.near){const far=Math.hypot(cx-L.f.x,cz-L.f.z)-L.f.r>FLORA_LOD;L.near.visible=L.near2.visible=!far;L.far.visible=far;}};
  g.userData.update=(harvest,now)=>{const ready=Wd.floraNodes.filter(n=>!(harvest?.[n.id]>now)),k=ready.map(n=>n.id).join();if(k===key)return;key=k;for(const c of [...nodes.children]){nodes.remove(c);if(c.isInstancedMesh)c.dispose();}
   const dim=Wd.floraNodes.filter(n=>!ready.includes(n)),put=(geo,list)=>{if(!list.length)return;const im=new T.InstancedMesh(geo,MAT.solid,list.length);list.forEach((n,i)=>im.setMatrixAt(i,M(n.x,ground(n.x,n.z)-.05,n.z,0,(n.x*.37)%TAU,0,1.25,1.25,1.25)));im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.userData.noPick=true;nodes.add(im);};
   put(TP.node,ready);put(TP.nodeDim,dim);if(high&&ready.length){const im=new T.InstancedMesh(P.bill,MAT.fx,ready.length);ready.forEach((n,i)=>im.setMatrixAt(i,M(n.x,ground(n.x,n.z)+1.6,n.z,0,0,0,2.2,2.2,2)));im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.renderOrder=2;im.userData.noPick=true;nodes.add(im);}};
  g.userData.update(null,0);return g;};

 // ---------- Phase 3: mineral deposits and the Meteor Strike (docs/economy/RESOURCE_ECONOMY.md §5) ----------
 // Presentation only: the pilot's discovered deposits (s.found) and their per-pilot respawn clocks (s.deposits), and the
 // shared strike schedule (ConquestCombat.meteorStrike). One instanced draw per mineral look, rebuilt only on state change.
 const ML={};{const rust=lin(0x7a4a2c),steel=lin(0x9aa6b2),basalt=lin(0x15161c),dark=lin(0x101015);
  const fe=new Bld();for(const [x,z,s] of [[0,0,1],[.9,.3,.7],[-.7,.5,.6],[.2,-.8,.55]])fe.add(G.rock,M(x,s*.35,z,0,x*3,0,s*.9,s*.6,s*.9),rust);for(let k=0;k<(high?5:3);k++)fe.add(G.octa,M(Math.cos(k*1.3)*.6,.55+.1*k%2,Math.sin(k*1.3)*.6,0,k,0,.09,.09,.09),steel,.9);ML.fe=keep(fe.geometry());
  const il=new Bld();il.add(G.rock,M(0,.2,0,0,0,0,1.1,.45,1),basalt);for(let k=0;k<(high?5:3);k++){const a=k*1.25;il.add(G.shard,M(Math.cos(a)*.45,.25,Math.sin(a)*.45,.35*Math.cos(a),a,.35*Math.sin(a),.55,1.3+.3*(k%2),.55),dark,0);il.add(G.octa,M(Math.cos(a)*.6,1.25+.2*(k%2),Math.sin(a)*.6,0,0,0,.06,.06,.06),lin(0x5f86b8),1.4);}ML.il=keep(il.geometry());
  const ar=new Bld();ar.add(G.rock,M(0,.25,0,0,0,0,1.2,.6,1.1),lin(0x2a3240));for(let k=0;k<(high?6:4);k++){const a=k*1.05;ar.add(G.shard,M(Math.cos(a)*.5,.3,Math.sin(a)*.5,.3*Math.cos(a),a,.3*Math.sin(a),.5,1.6+.4*(k%3),.5),lin(0x5b6d84),.25);ar.seg(V3(Math.cos(a)*.5,.4,Math.sin(a)*.5),V3(Math.cos(a)*.7,1.7,Math.sin(a)*.7),.03,K.cyan,1.3);}ML.ar=keep(ar.geometry());
  const tq=new Bld();tq.add(G.rock,M(0,.3,0,0,0,0,1.3,.7,1.2),basalt);for(let k=0;k<(high?8:5);k++){const a=k*.8;tq.add(G.shard,M(Math.cos(a)*.35,.5,Math.sin(a)*.35,.45*Math.cos(a),a,.45*Math.sin(a),.22,1.5+.5*(k%2),.22),lin(0xff7a3d),1.5);}ML.tq=keep(tq.geometry());
  const sv=new Bld();for(const [x,z,s] of [[0,0,1.5],[1.3,.4,1],[-1.1,.7,.9],[.3,-1.2,.8],[-.5,-.9,.7]])sv.add(G.rock,M(x,s*.35,z,0,x*3,0,s*.9,s*.6,s*.9),rust);sv.add(G.hex,M(0,0,0,0,0,0,.08,4.2,.08),K.cyan,1.2);sv.add(gem,M(0,4.4,0,0,0,0,.35,.35,.35),lin(0xffb070),1.8);ML.starter=keep(sv.geometry());
  const dim=new Bld();dim.add(G.rock,M(0,.12,0,0,0,0,.9,.25,.8),lin(0x2a2c33));ML.dim=keep(dim.geometry());
  const met=new Bld();met.add(gem,M(0,0,0,0,0,0,1.6,1.6,1.6),lin(0xffb070),2.2);for(let k=1;k<=6;k++)met.add(gem,M(-k*1.4,k*2.6,0,0,k,0,1.2-k*.15,1.2-k*.15,1.2-k*.15),lin(0xff7a3d),1.8-k*.2);ML.meteor=keep(met.geometry());
  const cr=new Bld();cr.add(ringG,M(0,.3,0,Math.PI/2,0,0,7,7,6),lin(0xff7a3d),1.5);for(let k=0;k<(high?10:6);k++){const a=k/(high?10:6)*TAU;cr.add(G.rock,M(Math.cos(a)*7.5,.2,Math.sin(a)*7.5,0,a,0,1.2,.6,1),basalt);}cr.add(gem,M(0,1.1,0,0,0,0,.7,.9,.7),lin(0xa8e4ff),2.2);ML.crater=keep(cr.geometry());}
 S.ML=ML;
 S.mineralWorld=()=>{const Wd=root.ConquestWorld,g=new T.Group(),dep=new T.Group();g.name='cq-minerals';g.add(dep);let key='';
  const meteor=new T.Mesh(ML.meteor,MAT.solid),crater=new T.Mesh(ML.crater,MAT.solid);meteor.visible=crater.visible=false;meteor.userData.noPick=crater.userData.noPick=true;g.add(meteor,crater);
  g.userData.update=(s,now)=>{const found=s?.found||{},list=(Wd.deposits||[]).filter(d=>found[d.id]),state=list.map(d=>{const t=d.m==='starter'?(s.deposits?.[d.id]?-1:0):s.deposits?.[d.id]>now?1:0;return t;}),k=list.map((d,i)=>d.id+state[i]).join();
   if(k!==key){key=k;for(const c of [...dep.children]){dep.remove(c);c.dispose?.();}const by={};list.forEach((d,i)=>{if(state[i]<0)return;const look=state[i]?'dim':d.m;(by[look]||(by[look]=[])).push(d);});
    for(const [look,L] of Object.entries(by)){const im=new T.InstancedMesh(ML[look],MAT.solid,L.length);L.forEach((d,i)=>im.setMatrixAt(i,M(d.x,ground(d.x,d.z)-.1,d.z,0,(d.x*.13)%TAU,0,1.3,1.3,1.3)));im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.userData.noPick=true;dep.add(im);}}
   const Mt=root.ConquestCombat?.meteorStrike?.(now),claimed=Mt&&s?.strikes?.[Mt.slot]?.claimed;
   if(Mt&&Mt.phase==='telegraph'){const f=Math.max(0,(Mt.impactAt-now)/STRIKE.telegraphMs),y=ground(Mt.site.x,Mt.site.z);meteor.visible=true;meteor.position.set(Mt.site.x+f*260,y+4+f*520,Mt.site.z-f*90);meteor.rotation.y=-.33;crater.visible=false;}
   else if(Mt&&Mt.phase==='open'&&!claimed){meteor.visible=false;crater.visible=true;crater.position.set(Mt.site.x,ground(Mt.site.x,Mt.site.z),Mt.site.z);crater.rotation.y=now*2e-4%TAU;}
   else meteor.visible=crater.visible=false;};
  return g;};

 // ---------- the colony (owner art direction): core town, farm ring, frontier wall, roads, monorail, power lines ----------
 // Neon Frontline human architecture on a modular kit (hex habitat pods, blocks, shopfronts, hangars, ringed oxygen towers,
 // greenhouses, silos, turbines, solar arrays, wall runs, watchtowers, gates). Static pieces are merged per district into a
 // main batch and a detail batch (lamps, signage, windows, small props) that drops out with distance (LOD): a handful of
 // draws for the whole colony. Positions and collision come from ConquestWorld.COLONY (shared with the Worker).
 S.colonyWorld=()=>{const Wd=root.ConquestWorld,CO=Wd.COLONY,g=new T.Group();g.name='cq-colony';if(!CO||!CO.lots)return g;
  const wallC=lin(0x2b3442),panel=lin(0x8fa0b2),white=lin(0xd5dde4),warm=lin(0xffcf8a),cy=K.cyan,mag=lin(0xff4fd8),glass=lin(0x8fd8e8),roof=lin(0x3a4654),conc=lin(0x6c7178),green=lin(0x3f7a2c),
   districts={core:{m:new Bld(),d:new Bld()},farm:{m:new Bld(),d:new Bld()},wall:{m:new Bld(),d:new Bld()}},rotors=[],lampFx=new Fx();
  const dist=l=>l.k==='wall'||l.k==='watch'||l.k==='gate'?'wall':['greenhouse','silo','turbine','solar'].includes(l.k)?'farm':'core';
  const R=(l,x,y,z)=>{const c=Math.cos(l.r),s=Math.sin(l.r);return [l.x+x*c-z*s,y,l.z+x*s+z*c];};
  const barrel=(B,l,y0,len,rad,col,em=0)=>{const [wx,,wz]=R(l,0,0,0);B.add(G.cylC,M(wx,y0,wz,0,-l.r,Math.PI/2,rad,len,rad),col,em);};   // a vault lying along the lot's length
  // Settlers (owner, Nov 8): civilian towns and farms wear weathered, painted, patched materials with warm amber lights; the
  // military (Refuge, Command Bases, frontier wall) keeps the cyan armoured Neon Frontline. Full settler architecture: session 5.
  const amberC=lin(0xffa84a),PAINT=[lin(0xa88a5a),lin(0x8a4a32),lin(0x5f8a86),lin(0xc9c2b0),lin(0x7a6a52),lin(0x9a5a3a)],panelM=panel,whiteM=white,roofM=roof,patchC=[lin(0x5a5248),lin(0x8a8070),lin(0x6a3a2a)];
  for(const l of CO.lots){const settler=dist(l)!=='wall',hh=Math.abs(Math.round(l.x*7+l.z*13)),cy=settler?amberC:K.cyan,panel=settler?PAINT[hh%PAINT.length]:panelM,white=settler?PAINT[(hh+3)%PAINT.length]:whiteM,roof=settler?lin(0x4a3e34):roofM;
   const D=districts[dist(l)],B=D.m,Dt=D.d,y0=ground(l.x,l.z)-.15,ry=-l.r,at=(x,y,z,rx,sx,sy,sz,ryy=0)=>{const [wx,wy,wz]=R(l,x,y,z);return M(wx,y0+wy,wz,rx,ry+ryy,0,sx,sy,sz);},w=l.w,d=l.d,h=l.h;
   if(l.k!=='pad'&&l.k!=='wall')B.add(G.box,at(0,-2,0,0,w+.6,4,d+.6),conc);                      // foundation plinth
   if(settler&&['hab','block','shop','hangar','silo'].includes(l.k))Dt.add(G.box,at(w*(.12-(hh%3)*.12),h*(.3+(hh%4)*.08),d/2+.06,0,w*.26,h*.18,.08),patchC[hh%3]);   // scrap-repair patch
   if(l.k==='hab'){B.add(G.hex,at(0,0,0,0,w*.48,h*.7,d*.48),panel);B.add(G.hexF(.8),at(0,h*.7,0,0,w*.48,h*.3,d*.48),roof);B.add(G.hex,at(0,h*.38,0,0,w*.49,.6,d*.49),warm,.75);Dt.add(G.hex,at(0,h*.7,0,0,w*.5,.18,d*.5),cy,1.2);}
   else if(l.k==='block'){B.add(G.box,at(0,h/2,0,0,w,h,d),white);for(let k=1;k<4;k++)B.add(G.box,at(0,h*k/4,0,0,w+.05,.5,d+.05),warm,.7);B.add(G.box,at(0,h+.4,0,0,w*.5,.8,d*.4),roof);for(const sx of [-1,1])Dt.add(G.box,at(sx*w/2,h/2,d/2,0,.2,h,.2),cy,1.2);}
   else if(l.k==='shop'){B.add(G.box,at(0,2,0,0,w,4,d),panel);B.add(G.box,at(0,1.4,d/2,0,w*.86,2.4,.1),warm,.8);B.add(G.box,at(0,3.9,d/2+.9,0,w+.4,.25,2),[mag,cy,lin(0xffb347)][Math.abs(Math.round(l.x+l.z))%3]);Dt.add(G.box,at(0,4.7,d/2+.1,0,w*.55,.8,.15),[cy,mag,warm][Math.abs(Math.round(l.x))%3],1.4);}
   else if(l.k==='hangar'){barrel(B,l,y0,w,Math.min(d*.5,h),roof);B.add(G.box,at(w/2,h*.3,0,0,.2,h*.6,d*.6),lin(0x1a2028));Dt.add(G.box,at(w/2+.1,h*.62,0,0,.1,.3,d*.62),cy,1.3);}
   else if(l.k==='tower'){B.add(G.cyl,at(0,0,0,0,w*.38,h,d*.38),white);for(const hh of [.3,.55,.8])B.add(ringG,at(0,h*hh,0,Math.PI/2,w*.5,d*.5,3),cy,1.2);B.add(G.dome,at(0,h,0,0,w*.4,w*.35,d*.4),glass,.5);}
   else if(l.k==='greenhouse'){barrel(B,l,y0,w,Math.min(d*.5,h),glass,.35);B.add(G.box,at(0,.4,0,0,w*.9,.8,d*.7),green);for(let k=-2;k<=2;k++)Dt.add(G.box,at(k*w/5,h*.5,0,0,.2,h*.95,d*1.02),white);}
   else if(l.k==='silo'){B.add(G.cyl,at(0,0,0,0,w*.45,h*.85,d*.45),white);B.add(G.cone6,at(0,h*.85,0,0,w*.47,h*.18,d*.47),roof);Dt.add(G.cyl,at(0,h*.6,0,0,w*.46,.35,d*.46),cy,1.2);}
   else if(l.k==='turbine'){B.add(G.cyl,at(0,0,0,0,.45,h,.45),white);B.add(G.box,at(0,h,0,0,1.2,1,2.6),white);rotors.push([...R(l,0,0,1.5),y0+h,l.r]);}
   else if(l.k==='solar'){for(let k=-1;k<=1;k++){B.add(G.box,at(k*w/3,1.3,0,.45,w/3-.4,.12,d*.9),lin(0x15305a),.05);B.add(G.box,at(k*w/3,.6,0,0,.25,1.2,.25),conc);}}
   else if(l.k==='pad'){B.add(G.hex,at(0,0,0,0,w*.5,.35,d*.5),lin(0x4b5058));for(const k of [-1,0,1])Dt.add(G.box,at(k*2,.42,0,0,k?.6:3.6,.05,k?5:.6),white,.6);for(let k=0;k<6;k++){const a=k/6*TAU;Dt.add(G.box,at(Math.cos(a)*w*.47,.45,Math.sin(a)*d*.47,0,.6,.15,.6),cy,1.6);}}
   else if(l.k==='wall'){B.add(G.box,at(0,1,0,0,w,10,d+.4),wallC);B.add(G.box,at(0,h-.6,0,0,w,.3,d+.5),lin(0x55606e));Dt.add(G.box,at(0,h-.35,0,0,w,.22,d+.6),cy,1.3);for(let k=-w/2+3;k<w/2;k+=6)Dt.add(G.box,at(k,h*.45,d/2+.25,0,1.2,h*.7,.3),lin(0x3a4452));}
   else if(l.k==='watch'){for(const [sx,sz] of [[-1,-1],[1,-1],[1,1],[-1,1]])B.add(G.box,at(sx*w*.3,h*.38,sz*d*.3,0,.6,h*.76,.6),wallC);B.add(G.box,at(0,h*.82,0,0,w,h*.28,d),panel);B.add(G.box,at(0,h*.85,0,0,w+.1,.6,d+.1),warm,.8);B.add(G.box,at(0,h-.1,0,0,w+.6,.4,d+.6),roof);Dt.add(G.box,at(0,h+.6,0,0,1,1,1),cy,1.6);}
   else if(l.k==='gate'){B.add(G.box,at(0,h/2,0,0,w*.5,h,d*.5),wallC);Dt.add(G.box,at(0,h-.5,0,0,w*.55,.4,d*.55),cy,1.5);}
  }
  // roads: dark paved ribbon on the terrain with neon edge strips and dashed lane marks (bridge sections ride the deck)
  const RB=new Bld(),asphalt=lin(0x24282e),edge=lin(0xffa84a),dash=lin(0xe8e2c8),dirtC=lin(0x5e4a36),rutC=lin(0x3a2c20),lamps=[];
  for(const r of CO.roads){const pts=[];for(let i=1;i<r.pts.length;i++){const [a,b]=[r.pts[i-1],r.pts[i]],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/3));for(let k=i===1?0:1;k<=n;k++)pts.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
   const hw=r.w/2,yAt=(x,z)=>{const dk=Wd.deckAt(x,z);return dk!==null?dk+.06:ground(x,z)+.09;},paved=!!r.p;let run=0;
   for(let i=1;i<pts.length;i++){const [ax,az]=pts[i-1],[bx,bz]=pts[i],L=Math.hypot(bx-ax,bz-az)||1,nx=-(bz-az)/L,nz=(bx-ax)/L,P=(x,z,o)=>[x+nx*o,yAt(x+nx*o,z+nz*o),z+nz*o];run+=L;
    if(!paved){RB.quad(P(ax,az,-hw),P(bx,bz,-hw),P(bx,bz,hw),P(ax,az,hw),dirtC);for(const o of [-1.6,1.6])RB.quad(P(ax,az,o-.35),P(bx,bz,o-.35),P(bx,bz,o+.35),P(ax,az,o+.35),rutC);continue;}   // rutted dirt track
    RB.quad(P(ax,az,-hw),P(bx,bz,-hw),P(bx,bz,hw),P(ax,az,hw),asphalt);for(const s2 of [-1,1])RB.quad(P(ax,az,s2*(hw-.35)),P(bx,bz,s2*(hw-.35)),P(bx,bz,s2*(hw-.05)),P(ax,az,s2*(hw-.05)),edge,1.1);
    if(Math.floor(run/6)%2===0)RB.quad(P(ax,az,-.12),P(bx,bz,-.12),P(bx,bz,.12),P(ax,az,.12),dash,.2);
    if(i%6===0&&r.w>=8)for(const s2 of [-1,1])lamps.push([ax+nx*s2*(hw+1.2),az+nz*s2*(hw+1.2),Math.atan2(nz*s2,nx*s2)]);}}
  for(const [x,z,a] of lamps){if(Wd.waterAt(x,z)||Wd.solidAt(x,z))continue;const y=ground(x,z),Dt=districts.core.d;Dt.add(G.cyl,M(x,y,z,0,0,0,.12,6,.12),lin(0x55606e));Dt.add(G.box,M(x-Math.cos(a)*.8,y+6,z-Math.sin(a)*.8,0,-a,0,1.8,.15,.3),lin(0x55606e));Dt.add(G.box,M(x-Math.cos(a)*1.5,y+5.85,z-Math.sin(a)*1.5,0,0,0,.5,.12,.5),warm,1.5);
   if(high)lampFx.bill(x-Math.cos(a)*1.5,y+5.7,z-Math.sin(a)*1.5,.8,AT.BLOB,E(0xffd59a,.18));}
  // fields: crop rows following the ground (golden grain, green crops, dark leafy rows)
  const FB=new Bld(),crops=[[lin(0xc2a64a),lin(0x5a4630)],[lin(0x5f9a34),lin(0x4a3a26)],[lin(0x3f7a2a),lin(0x3f3020)]];
  for(const f of CO.fields){const c=Math.cos(f.r),s2=Math.sin(f.r),[cA,cB]=crops[f.c%3],L=(u,v)=>{const x=f.x+u*c-v*s2,z=f.z+u*s2+v*c;return [x,ground(x,z)+.12,z];};
   for(let v=-f.d/2;v<f.d/2;v+=1.6)for(let u=-f.w/2;u<f.w/2;u+=4){const u1=Math.min(u+4,f.w/2);FB.quad(L(u,v),L(u1,v),L(u1,v+.95),L(u,v+.95),cA,0);FB.quad(L(u,v+.95),L(u1,v+.95),L(u1,v+1.6),L(u,v+1.6),cB,0);}}
  // monorail: beam on pylons + the moving train; power line: poles and wires
  const RL=CO.rail||[],railH=(x,z)=>ground(x,z)+11;if(RL.length>1){for(let i=1;i<RL.length;i++){const [a,b]=[RL[i-1],RL[i]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8);for(let k=0;k<n;k++){const x0=a[0]+(b[0]-a[0])*k/n,z0=a[1]+(b[1]-a[1])*k/n,x1=a[0]+(b[0]-a[0])*(k+1)/n,z1=a[1]+(b[1]-a[1])*(k+1)/n;districts.core.m.seg(V3(x0,railH(x0,z0),z0),V3(x1,railH(x1,z1),z1),.9,lin(0x9aa6b2));districts.core.d.seg(V3(x0,railH(x0,z0)+.55,z0),V3(x1,railH(x1,z1)+.55,z1),.12,lin(0xffa84a),1.1);}}
   for(const [x,z] of CO.railPylons){districts.core.m.add(G.cyl,M(x,ground(x,z)-1,z,0,0,0,.9,12.2,.9),lin(0x7d8894));}}
  const PW=CO.power||[];for(let i=0;i<PW.length;i++){const [x,z]=PW[i],y=ground(x,z);districts.farm.d.add(G.cyl,M(x,y,z,0,0,0,.13,9,.13),lin(0x2e2822));districts.farm.d.add(G.box,M(x,y+8.6,z,0,0,0,2.4,.16,.16),lin(0x2e2822));
   const q=PW[i+1];if(q&&Math.hypot(q[0]-x,q[1]-z)<45){const yq=ground(q[0],q[1]);for(const o of [-1,1])districts.farm.d.seg(V3(x+o,y+8.7,z),V3(q[0]+o,yq+8.7,q[1]),.03,lin(0x222222));}}
  const parts=[];for(const [k,D] of Object.entries(districts)){const m=D.m.mesh(),dm=D.d.mesh();m.name='cq-colony-'+k;dm.name='cq-colony-'+k+'-detail';m.userData.noPick=dm.userData.noPick=true;g.add(m,dm);parts.push({m,dm});}
  const roadsM=RB.mesh(),fieldsM=FB.mesh();roadsM.userData.noPick=fieldsM.userData.noPick=true;g.add(roadsM,fieldsM);if(lampFx.n)g.add(fxMesh(lampFx.geometry()));
  // canals: creek-fed irrigation channels in the shared water material
  if(CO.canals?.length){const Pw=[],Fw=[],Iw=[];for(const [a,b] of CO.canals){const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(L/3),nx=-(b[1]-a[1])/L,nz=(b[0]-a[0])/L;for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n,y=ground(x,z)+.15,i0=Pw.length/3;for(const o of [-1,1]){Pw.push(x+nx*o*1.1,y,z+nz*o*1.1);Fw.push(k*3+.001,o);}if(k)Iw.push(i0-2,i0-1,i0+1,i0-2,i0+1,i0);}}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(Pw,3));geo.setAttribute('aFlow',new T.Float32BufferAttribute(Fw,2));geo.setIndex(Iw);geo.computeBoundingSphere();const cm=new T.Mesh(geo,MAT.water);cm.userData.noPick=true;g.add(cm);}
  // moving life: rovers on the roads, crew at the plaza, the monorail train, turbine rotors (presentation only)
  const rov=new Bld();rov.box(0,.9,0,3.2,1.1,1.8,white);rov.box(.7,1.7,0,1.3,.8,1.6,glass,.4);for(const [x,z] of [[-1,-.95],[1,-.95],[-1,.95],[1,.95]])rov.add(G.cylC,M(x,.45,z,Math.PI/2,0,0,.45,.3,.45),lin(0x15181c));rov.box(-1.6,1.1,0,.1,.3,1.6,cy,1.4);
  const rovG=rov.geometry(),nR=high?10:5,rovers=new T.InstancedMesh(rovG,MAT.solid,nR);rovers.userData.noPick=true;g.add(rovers);
  const crewB=new Bld();crewB.add(G.cyl,M(0,0,0,0,0,0,.15,.8,.15),lin(0x2a2a26));crewB.add(G.cyl,M(0,.8,0,0,0,0,.2,.55,.2),lin(0x5a5e4a));crewB.add(G.cyl,M(0,1.12,0,0,0,0,.205,.08,.205),lin(0xff8a3d),.4);crewB.add(G.octa,M(0,1.5,0,0,0,0,.16,.19,.16),lin(0xd8dcd8));const nC=high?10:0,crew=nC?new T.InstancedMesh(crewB.geometry(),MAT.solid,nC):null;if(crew){crew.userData.noPick=true;g.add(crew);}
  const trainB=new Bld();for(let k=0;k<3;k++){trainB.box(k*7.4,0,0,7,2.6,2.6,white);trainB.box(k*7.4,.4,0,7.05,.7,2.65,warm,.7);trainB.box(k*7.4,1.35,0,7.05,.15,2.7,cy,1.3);}const train=new T.Mesh(trainB.geometry(),MAT.solid);train.userData.noPick=true;g.add(train);
  const rotB=new Bld();for(let k=0;k<3;k++)rotB.add(G.box,M(0,0,0,0,0,k*TAU/3,.35,9,.12).multiply(new T.Matrix4().makeTranslation(0,.5,0)),white);const rot=rotors.length?new T.InstancedMesh(rotB.geometry(),MAT.solid,rotors.length):null;if(rot){rot.userData.noPick=true;g.add(rot);}
  const paths=CO.roads.filter(r=>r.w>=8).map(r=>r.pts),plaza=CO.lots.find(l=>l.k==='pad')||{x:1120,z:1110};
  const along=(pts,t)=>{let L=0;const seg=[];for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);L+=l;}let d=((t%(2*L))+2*L)%(2*L),back=d>L;if(back)d=2*L-d;for(let i=0;i<seg.length;i++){if(d<=seg[i]){const f=d/seg[i],a=pts[i],b=pts[i+1];return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,Math.atan2(b[1]-a[1],b[0]-a[0])+(back?Math.PI:0)];}d-=seg[i];}return [pts[0][0],pts[0][1],0];};
  const _m=new T.Matrix4(),railLen=RL.length>1?RL.reduce((n,p,i)=>i?n+Math.hypot(p[0]-RL[i-1][0],p[1]-RL[i-1][1]):0,0):0;
  g.userData.update=(now,cam)=>{const t=now/1000;
   for(let i=0;i<nR;i++){const P=paths[i%paths.length],[x,z,a]=along(P,t*(6+i%3)+i*57),side=(Math.floor(((t*(6+i%3)+i*57)/1)%2))?1:1,o=2.2;rovers.setMatrixAt(i,M(x-Math.sin(a)*o*side,ground(x,z),z+Math.cos(a)*o*side,0,-a,0,1,1,1));}rovers.instanceMatrix.needsUpdate=true;
   if(crew){for(let i=0;i<nC;i++){const a=i*2.4+t*(.15+.05*(i%3)),r=8+(i%5)*2.2,x=plaza.x+Math.cos(a)*r,z=plaza.z+Math.sin(a)*r;crew.setMatrixAt(i,M(x,ground(x,z),z,0,-a,0,1,1,1));}crew.instanceMatrix.needsUpdate=true;}
   if(railLen){const [x,z,a]=along(RL,t*14);train.position.set(x,railH(x,z)+1.9,z);train.rotation.set(0,-a,0);}
   if(rot){rotors.forEach(([x,ry,z,yy,r],i)=>{rot.setMatrixAt(i,_m.makeRotationY(-r).premultiply(new T.Matrix4().makeTranslation(x,yy,z)).multiply(new T.Matrix4().makeRotationX(t*1.6+i)));});rot.instanceMatrix.needsUpdate=true;}
   if(cam){const cx=cam.position.x-g.position.x,cz=cam.position.z-g.position.z,far=high?260:160;for(const p of parts){const bs=p.dm.geometry.boundingSphere;if(bs)p.dm.visible=Math.hypot(cx-bs.center.x,cz-bs.center.z)-bs.radius<far;}}};
  g.userData.update(0,null);return g;};
 // ---------- frontier dressing (owner art direction): the war-torn edge the colonists hold ----------
 // Decoration only (no collision; gameplay solids come from ConquestWorld): half-overgrown tank wrecks, burnt stumps,
 // sandbag lines and trenches behind the wall, barbed wire beyond it, a rusted pipeline from the ice-mining crater to town,
 // fences around the fields and abandoned machinery. Grit grows with distance from the core. One main draw plus four detail
 // draws (wire, posts, fences) that drop out with distance.
 S.frontierWorld=()=>{const Wd=root.ConquestWorld,CO=Wd.COLONY,g=new T.Group();g.name='cq-frontier';if(!CO)return g;
  const B=new Bld(),quads=[0,1,2,3].map(()=>new Bld()),Q=(x,z)=>quads[(x<1100?0:1)+(z<1150?0:2)],rust=lin(0x6a3f26),wreck=lin(0x3a3530),moss=lin(0x3e5a2e),bag=lin(0x8f8064),mud=lin(0x2a2018),post=lin(0x4a4038),wire=lin(0x2a2a2a),
   rd=(x,z)=>{let d=1e9;for(const r of CO.roads)for(let i=1;i<r.pts.length;i++){const a=r.pts[i-1],b=r.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L));d=Math.min(d,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)-r.w/2);}return d;},
   free=(x,z,r=3)=>!Wd.waterAt(x,z)&&!Wd.solidAt(x,z)&&Wd.deckAt(x,z)===null&&!Wd.forestAt(x,z)?.core&&!Wd.colonyLotAt(x,z)&&rd(x,z)>r&&!Wd.deposits.some(d=>Math.hypot(d.x-x,d.z-z)<8)&&!Wd.floraNodes.some(d=>Math.hypot(d.x-x,d.z-z)<8);
  // tank wrecks, half-overgrown, scattered through the war band (denser away from the core)
  for(let cx=760;cx<1360;cx+=70)for(let cz=900;cz<1420;cz+=70){const h=hash3(cx,cz,77),x=cx+35+(h-.5)*50,z=cz+35+(((h*7.1)%1)-.5)*50,tf=Wd.terraformAt(x,z),dc=Math.hypot(x-1130,z-1125);if(tf<.05||tf>.75||dc<170||((h*13.3)%1)>.45||!free(x,z,6))continue;
   const y=ground(x,z)-.4,a=h*40,tilt=((h*5.7)%1-.5)*.25,R=(lx,ly,lz)=>[x+lx*Math.cos(a)-lz*Math.sin(a),y+ly,z+lx*Math.sin(a)+lz*Math.cos(a)];
   const at=(lx,ly,lz,sx,sy,sz,c,ex=0)=>{const [wx,wy,wz]=R(lx,ly,lz);B.add(G.box,M(wx,wy,wz,tilt,-a+ex,tilt*.6,sx,sy,sz),c);};
   at(0,.8,0,5.2,1.3,3,wreck);at(-.4,1.75,.3,2.6,.9,2.1,rust,.5);for(const s2 of [-1,1])at(0,.5,s2*1.7,5.6,.9,.6,lin(0x1e1c1a));const [bx2,by2,bz2]=R(1.2,1.9,.6);B.seg(V3(bx2,by2,bz2),V3(bx2+Math.cos(a+.5)*3.2,by2-1.2,bz2+Math.sin(a+.5)*3.2),.14,rust);
   at(.6,1.5,-.6,1.6,.25,1.2,moss);for(let k=0;k<5;k++){const [tx,ty,tz]=R(-2+k,.9+.4*(k%2),(k%3-1)*1.2);B.add(TP.tuft,M(tx,ty,tz,0,k,0,1.2,1.4,1.2),moss);}}
  // burnt stumps through the band
  for(let i=0;i<70;i++){const h=hash3(i,13,5),x=780+h*560,z=920+((h*7.7)%1)*480,tf=Wd.terraformAt(x,z);if(tf<.05||tf>.6||Math.hypot(x-1130,z-1125)<160||!free(x,z,2))continue;B.add(TP.stump,M(x,ground(x,z)-.05,z,0,h*40,0,1.4,1.2+((h*3.3)%1),1.4),lin(0x1c1814));}
  // behind each wall run: a sandbag line and a trench; beyond it: barbed wire on posts
  for(const l of CO.lots.filter(l=>l.k==='wall')){const c=Math.cos(l.r),sn=Math.sin(l.r),nx=-sn,nz=c,inward=Math.sign((1150-l.x)*nx+(1160-l.z)*nz)||1;
   for(let u=-l.w/2;u<=l.w/2;u+=1.1){for(const row of [0,1]){const o=inward*(4+row*.55),x=l.x+u*c+nx*o,z=l.z+u*sn+nz*o;if(Wd.solidAt(x,z))continue;B.add(G.rock,M(x,ground(x,z)+.25+row*.32,z,0,u,0,.62,.3,.4),bag);}
    const to=inward*7,tx=l.x+u*c+nx*to,tz=l.z+u*sn+nz*to,ty=ground(tx,tz);if(!Wd.solidAt(tx,tz))B.quad([tx-c*.6-nx,ty+.06,tz-sn*.6-nz],[tx+c*.6-nx,ty+.06,tz+sn*.6-nz],[tx+c*.6+nx,ty+.06,tz+sn*.6+nz],[tx-c*.6+nx,ty+.06,tz-sn*.6+nz],mud);}
   const wo=-inward*9,D=Q(l.x,l.z);for(let u=-l.w/2-6;u<=l.w/2+6;u+=3){const x=l.x+u*c+nx*wo,z=l.z+u*sn+nz*wo,y=ground(x,z);D.add(G.box,M(x,y+.7,z,0,-l.r,.12,.12,1.4,.12),post);D.add(ringG,M(x+c*1.5,y+.5,z+sn*1.5,0,-l.r,0,.5,.5,6),wire);
    if(u+3<=l.w/2+6){const x2=x+c*3,z2=z+sn*3,y2=ground(x2,z2);for(const hh of [.4,.8,1.2])D.seg(V3(x,y+hh,z),V3(x2,y2+hh,z2),.02,wire);}}}
  // rusted pipeline beside the bridge road, from the ice-mining crater toward town
  {const pts=[[918,1171],[950,1172],[975,1171],[996,1158],[1000,1132]];for(let i=1;i<pts.length;i++){const [a,b]=[pts[i-1],pts[i]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/6);for(let k=0;k<n;k++){const x0=a[0]+(b[0]-a[0])*k/n,z0=a[1]+(b[1]-a[1])*k/n,x1=a[0]+(b[0]-a[0])*(k+1)/n,z1=a[1]+(b[1]-a[1])*(k+1)/n;if(Wd.solidAt(x0,z0)||Wd.waterAt(x0,z0))continue;const y0=ground(x0,z0)+1.1,y1=ground(x1,z1)+1.1;
    B.seg(V3(x0,y0,z0),V3(x1,y1,z1),.42,rust);B.add(G.box,M(x0,y0-.6,z0,0,0,0,.25,1.2,.6),post);if(k%3===0)B.add(G.cyl,M(x0,y0-.05,z0,0,0,Math.PI/2,.55,.25,.55),lin(0x4a2e1c));}}}
  // fences around the fields
  for(const f of CO.fields){const c=Math.cos(f.r),sn=Math.sin(f.r),P=(u,v)=>[f.x+u*c-v*sn,f.z+u*sn+v*c],D=Q(f.x,f.z),cor=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>P(a*(f.w/2+1.5),b*(f.d/2+1.5)));
   for(let e=0;e<4;e++){const [a,b]=[cor[e],cor[(e+1)%4]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4);for(let k=0;k<n;k++){if(e===0&&k===1)continue;const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n,x2=a[0]+(b[0]-a[0])*(k+1)/n,z2=a[1]+(b[1]-a[1])*(k+1)/n,y=ground(x,z),y2=ground(x2,z2);D.add(G.box,M(x,y+.6,z,0,0,0,.14,1.2,.14),post);for(const hh of [.5,1])D.seg(V3(x,y+hh,z),V3(x2,y2+hh,z2),.04,lin(0x6a5e50));}}}
  // abandoned machinery: a rusted crane and drill rigs at the crater and the north frontier
  for(const [x,z,k] of [[905,1165,0],[1092,1060,1],[1240,1110,1],[972,1080,0]]){if(!free(x,z,3))continue;const y=ground(x,z);if(k===0){for(const [a,b] of [[-1.2,-1.2],[1.2,-1.2],[1.2,1.2],[-1.2,1.2]])B.seg(V3(x+a,y,z+b),V3(x+a*.3,y+9,z+b*.3),.15,rust);B.seg(V3(x,y+9,z),V3(x+7,y+7.5,z+2),.18,rust);B.add(G.box,M(x,y+.4,z,0,0,0,3.4,.8,3.4),wreck);}
   else{B.add(G.box,M(x,y+1,z,0,.4,0,4.5,2,2.4),rust);B.add(G.box,M(x+.8,y+2.6,z,0,.4,0,1.8,1.4,2),wreck);B.seg(V3(x-1.5,y+2,z),V3(x-3.5,y+4.5,z+1),.2,rust);B.add(TP.tuft,M(x-1,y+2,z,0,0,0,1.3,1.4,1.3),moss);}}
  const m=B.mesh();m.userData.noPick=true;m.name='cq-frontier-main';g.add(m);const ds=quads.map((q,i)=>{const d=q.mesh();d.userData.noPick=true;d.name='cq-frontier-detail-'+i;g.add(d);return d;});
  g.userData.update=cam=>{if(!cam)return;const cx=cam.position.x-g.position.x,cz=cam.position.z-g.position.z,far=high?230:140;for(const d of ds){const bs=d.geometry?.boundingSphere;if(bs)d.visible=Math.hypot(cx-bs.center.x,cz-bs.center.z)-bs.radius<far;}};return g;};
 // ---------- the atmosphere boundary: a shimmering veil where the zone ends (contour of ConquestWorld.terraformAt) ----------
 S.atmoVeil=()=>{const Wd=root.ConquestWorld,step=high?10:16,x0=600,z0=860,nx=Math.ceil(940/step),nz=Math.ceil(700/step),th=.06,v=(i,j)=>Wd.terraformAt(x0+i*step,z0+j*step)-th,P=[],Q=[],I=[];
  const seg=(a,b)=>{const n=P.length/3,H=60,lean=10,c=[1150,1160],ia=Math.hypot(c[0]-a[0],c[1]-a[1])||1,ib=Math.hypot(c[0]-b[0],c[1]-b[1])||1,ya=ground(a[0],a[1])-2,yb=ground(b[0],b[1])-2;
   P.push(a[0],ya,a[1],b[0],yb,b[1],b[0]+(c[0]-b[0])/ib*lean,yb+H,b[1]+(c[1]-b[1])/ib*lean,a[0]+(c[0]-a[0])/ia*lean,ya+H,a[1]+(c[1]-a[1])/ia*lean);const L=Math.hypot(b[0]-a[0],b[1]-a[1]);Q.push(0,0,L,0,L,1,0,1);I.push(n,n+1,n+2,n,n+2,n+3);};
  const lerp=(p,q,a,b)=>{const t=a/(a-b);return [p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];};
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const c=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(([a,b])=>[x0+a*step,z0+b*step,v(a,b)]),e=[];for(let k=0;k<4;k++){const p=c[k],q=c[(k+1)%4];if(p[2]>0!==q[2]>0)e.push(lerp(p,q,p[2],q[2]));}if(e.length===2)seg(e[0],e[1]);else if(e.length===4){seg(e[0],e[1]);seg(e[2],e[3]);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('uv',new T.Float32BufferAttribute(Q,2));geo.setIndex(I);geo.computeBoundingSphere();
  const m=new T.Mesh(geo,MAT.veil);m.renderOrder=4;m.frustumCulled=false;m.userData.noPick=true;m.name='cq-atmosphere-veil';return m;};

 // ---------- sky + lights ----------
 S.environment=(scene,renderer)=>{
  if(renderer){renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=low?1.25:1.2;renderer.outputColorSpace=T.SRGBColorSpace;}
  scene.background=new T.Color(0);scene.fog=new T.Fog(0x06070f,900,2600);S.atmoScene={scene,renderer};
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
  {const zr=rocks.filter(p=>root.ConquestWorld.terraformAt&&root.ConquestWorld.terraformAt(p.x,p.z)>.12),mr=rocks.filter(p=>!zr.includes(p)),rm=p=>M(p.x-ox,p.y+.3*p.size,p.z-oz,(p.variant-.72)*.22,(p.variant*31)%2<1?0:Math.PI,(p.variant-.6)*.16,1.6*p.size,(.5+p.variant)*p.size,p.size);inst(P.rock,mr,rm);inst(P.rockMoss,zr,rm);}
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
 // Light pylons stand on a habitat plinth inside its solid r7.8 (never a 7 m mast in a drive lane); arm + light pool face the lane.
 const pylonAt=([px,pz])=>{const h=F.habitats.reduce((a,b)=>Math.hypot(b.x-px,b.z-pz)<Math.hypot(a.x-px,a.z-pz)?b:a),d=Math.hypot(px-h.x,pz-h.z),ux=(px-h.x)/d,uz=(pz-h.z)/d;return [h.x+ux*7.35,h.z+uz*7.35,Math.atan2(ux,uz)];};
 S.pylons=()=>PYLONS.slice(0,low?6:10).map(pylonAt);
 function pylon(Sb,X,px,pz,a){const g=ground(px,pz),sx=Math.sin(a),sz=Math.cos(a),o=d=>[px+sx*d,pz+sz*d];Sb.box(px,g+3.4,pz,.24,7.2,.24,K.mid,0,a);Sb.box(px,g+.2,pz,.7,.5,.7,K.dark,0,a);
  let [ax,az]=o(.35);Sb.box(ax,g+7.05,az,.22,.18,.9,K.dark2,0,a);[ax,az]=o(.75);Sb.box(ax,g+6.92,az,.7,.12,.38,K.ice,1,a);X.bill(ax,g+6.8,az,1.7,AT.BLOB,E(0xa8f8ff,.8));
  [ax,az]=o(.13);Sb.box(ax,g+3.4,az,.06,6.2,.04,K.cyan,1,a);[ax,az]=o(3.2);X.decal(ax,az,5.5,5.5,a,AT.BLOB,E(0x22e6ff,.3),0,low?4:6,.15);}
 S.refuge=()=>{const Sb=new Bld(),X=new Fx();F.habitats.forEach((h,i)=>habitat(Sb,X,h,i));F.processors.forEach((p,i,a)=>processor(Sb,X,p,i,a));terminal(Sb,X,F.terminal);
  F.solar.forEach(p=>solar(Sb,X,p));for(const [x,z,a] of S.pylons())pylon(Sb,X,x,z,a);const g=pair(Sb,X);g.name='cq-style-refuge';g.userData.site={x:1150,z:1150,range:1600};return g;};

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
  if(tier>=5){const x=0,z=16;/* on the solid back-wall line (sim |z-16|<3), so tanks never drive through the tower */Sb.add(G.hexF(.62),M(x,y,z,0,0,0,2.4,26,2.4),K.panelB);for(let h=5;h<=24;h+=4.5){const r=2.4-(h/26)*.9;Sb.add(G.torus,M(x,y+h,z,Math.PI/2,0,0,r+1.1,r+1.1,r+1.1),K.cyan,1);if(high)X.ringGlow(x,z,y+h,r+1.1,2.2,E(0x22e6ff,.45),14);}
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
 // position/normal/aCol of two solid geometries in one indexed geometry (the hull's own attributes may be indexed or not).
 const join=(a,b)=>{const g=new T.BufferGeometry(),na=a.attributes.position.count,nb=b.attributes.position.count,get=['getX','getY','getZ','getW'];
  for(const k of ['position','normal','aCol']){const A=a.attributes[k],B=b.attributes[k],n=A.itemSize,arr=new Float32Array((na+nb)*n);
   for(let i=0;i<na;i++)for(let j=0;j<n;j++)arr[i*n+j]=A[get[j]](i);for(let i=0;i<nb;i++)for(let j=0;j<n;j++)arr[(na+i)*n+j]=B[get[j]](i);g.setAttribute(k,new T.BufferAttribute(arr,n));}
  const ia=a.index?Array.from(a.index.array):Array.from({length:na},(_,i)=>i),ib=b.index?Array.from(b.index.array,i=>i+na):Array.from({length:nb},(_,i)=>i+na);g.setIndex(ia.concat(ib));g.computeBoundingSphere();return g;};
 const PATTERN={shield:[K.cyan,0x48d8ff],ambush:[K.amber,0xffb347],artillery:[K.red,0xff5a3c],carrier:[K.teal,0x2dffc4],plasma:[K.violet,0xb07bff],command:[K.magHot,0xff7ae8]};
 const markers=()=>{const g=new T.Group(),a=new Bld(),b=new Bld();a.add(G.octa,M(0,0,0,0,0,0,.36,.5,.36),K.mag,1);b.add(G.octa,M(0,0,0,0,0,0,.44,.6,.44),K.amber,1);const n=a.mesh(),t=b.mesh();t.visible=false;n.userData.noPick=t.userData.noPick=true;g.add(n,t);g.userData.states=[n,t];return g;};
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
  const dress=D.geometry();cached.style={body:keep(join(body,dress)),dress:keep(dress),fx:keep(X.geometry())};return cached.style;};
 S.hullMeshes=(cached,e)=>{const st=S.parasiteHull(cached,e);return {body:new T.Mesh(software?cached.body:st.body,MAT.solid),gun:new T.Mesh(cached.gun,MAT.solid),dress:null,fx:low?null:fxMesh(st.fx),marker:markers()};};
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
  const g=new T.Group(),gun=new T.Group();gun.position.y=6.6;gun.add(new T.Mesh(batteryCache.gun,MAT.solid));g.add(new T.Mesh(batteryCache.base,MAT.solid),gun,fxMesh(batteryCache.fx));
  const mk=markers();mk.position.y=11;g.add(mk);g.userData.gun=gun;g.userData.marker=mk;return g;};
 // Airborne drone: chitin body, four glowing rotor rings, eye; same ~1.8 m footprint as the live drone.
 let droneCache=null;
 S.drone=()=>{if(!droneCache){const Sb=new Bld(),X=new Fx();Sb.add(G.blob1,M(0,1.35,0,0,0,0,1.05,.42,.75),K.chitin);Sb.add(G.ico,M(.95,1.32,0,0,0,0,.22,.18,.22),K.magHot,1.9);
   for(const x of [-1,1])for(const z of [-1,1]){Sb.box(x*.8,1.22,z*.7,.28,.18,.9,K.chitinD);Sb.add(G.torus,M(x,1.5,z*.9,Math.PI/2,0,0,.46,.46,.46),K.mag,1.8);}
   X.bill(.95,1.32,0,.8,AT.BLOB,E(0xff2bd6,.9));X.flat(0,-1.2,0,1.8,1.5,AT.BLOB,E(0xff2bd6,.35),0);droneCache={body:keep(Sb.geometry()),fx:keep(X.geometry())};}
  const g=new T.Group(),body=new T.Group();body.rotation.y=-Math.PI/2;body.add(new T.Mesh(droneCache.body,MAT.solid),fxMesh(droneCache.fx));g.add(body);
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
 S.glow=(color,region='BLOB')=>{const k=color+region;let g=glowCache.get(k);if(!g){g=billGeo(AT[region],E(color,1));glowCache.set(k,g);}return fxMesh(g,3);};
 const ringCache=new Map();
 S.groundRing=(color,region='RING')=>{const k=color+region;let g=ringCache.get(k);if(!g){const X=new Fx();X.flat(0,0,0,1,1,AT[region],E(color,1),0);g=keep(X.geometry());ringCache.set(k,g);}return fxMesh(g);};
 // Holo pillar marker (mission beacon, objectives, caches): ground hex + light band + icon.
 S.holoMarker=(color,{height=10,radius=1.4,icon=true}={})=>{const X=new Fx();X.flat(0,.15,0,radius*2.2,radius*2.2,AT.HEX,E(color,.9),0);X.band(0,0,.2,radius,radius*.55,height,E(color,.55),[0,0,0],12);if(icon){X.quadV(0,height+1.6,0,2.6,2.6,0,AT.ICON,E(color,1.2));X.quadV(0,height+1.6,0,2.6,2.6,Math.PI/2,AT.ICON,E(color,.8));}
  const m=X.mesh();m.renderOrder=2;return m;};
 const cacheGeo={};
 S.cache=(wreck)=>{const key=wreck?'w':'l';if(!cacheGeo[key]){const Sb=new Bld(),X=new Fx(),c=wreck?K.cyan:K.amber,col=wreck?0x8ee6ef:0xffd58a;Sb.box(0,.7,0,2,1.4,2,K.dark2);Sb.box(0,1.45,0,2.1,.12,2.1,c,1);for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]])Sb.box(x*1.02,.7,z*1.02,.1,1.4,.1,c,1);
  X.band(0,0,1.5,.5,.2,5,E(col,.6),[0,0,0],10);X.bill(0,2.2,0,1.6,AT.BLOB,E(col,.8));X.flat(0,.06,0,2.4,2.4,AT.BLOB,E(col,.4),0);cacheGeo[key]={s:keep(Sb.geometry()),f:keep(X.geometry())};}
  const g=new T.Group();g.add(new T.Mesh(cacheGeo[key].s,MAT.solid),fxMesh(cacheGeo[key].f));return g;};
 S.flag=(owned,friendly)=>{const Sb=new Bld(),X=new Fx(),c=owned?K.teal:friendly?K.cyan:K.mag,col=owned?0x2dffc4:friendly?0x22e6ff:0xff2bd6;Sb.box(0,7,0,.2,14,.2,K.mid);Sb.box(0,.3,0,.9,.6,.9,K.dark);
  Sb.box(2.1,12,0,3.8,1.9,.12,K.dark2);Sb.box(2.1,12,.07,3.5,1.6,.02,c,.85);X.bill(.1,14.2,0,1.1,AT.BLOB,E(col,.9));X.quadV(2.1,12,.1,3.6,.9,0,AT[owned||friendly?SIGN.SECURED:SIGN.HOSTILE],E(col,1.3));return pair(Sb,X);};

 // ---------- per-frame: time, viewport, origin, nearest light/creep sites ----------
 const siteKey={};
 S.viewLights=camera=>{camera.updateMatrixWorld();const m=camera.matrixWorldInverse;U.uSunV.value.copy(sunDir).transformDirection(m);U.uDaySunV.value.copy(daySunDir).transformDirection(m);U.uRimV.value.copy(rimDir).transformDirection(m);U.uUpV.value.set(0,1,0).transformDirection(m);};
 // Crossing the boundary: the camera's zone factor eases over about a second; sky, fog/valley mist and exposure follow it.
 const nightFog=new T.Color(0x06070f),dayFog=new T.Color(0x9a8672),nightFogC=V3(.0018,.0021,.0048),dayFogC=V3(.36,.27,.19);
 S.atmo=(p,dt)=>{const tf=W.terraformAt?W.terraformAt(p.x,p.z):0,want=Math.min(1,Math.max(0,(tf-.03)/.13)),a=U.uAtmo.value;U.uAtmo.value=a+(want-a)*Math.min(1,(dt||0)*1.6);
  const k=U.uAtmo.value,A=S.atmoScene;if(A?.scene?.fog){A.scene.fog.color.copy(nightFog).lerp(dayFog,k);A.scene.fog.near=900-640*k;A.scene.fog.far=2600-1250*k;A.scene.background.setRGB(.36*k,.27*k,.19*k);}
  if(A?.renderer)A.renderer.toneMappingExposure=(low?1.25:1.2)-.1*k;MAT.sky.uniforms.uFogC.value.copy(nightFogC).lerp(dayFogC,k);return k;};
 S.update=(dt,t,view)=>{U.uTime.value=t;if(view?.renderer?.getDrawingBufferSize)view.renderer.getDrawingBufferSize(U.uViewport.value);if(view?.origin)U.uOrigin.value.set(view.origin.x,view.origin.z);if(view?.p)S.atmo(view.p,dt);
  const p=view?.p,terr=view?.authority?.state?.territory;if(!p)return;const k=Math.round(p.x/32)*100003+Math.round(p.z/32);if(siteKey.k===k&&siteKey.t===terr)return;siteKey.k=k;siteKey.t=terr;
  const list=allSites(F,terr).map(s=>[s,Math.hypot(s[0]-p.x,s[1]-p.z)-s[2]]).sort((a,b)=>a[1]-b[1]).slice(0,8);for(let i=0;i<8;i++){const s=list[i]?.[0];U.uSite.value[i].set(s?s[0]:0,s?s[1]:0,s?s[2]:0,s?s[3]:0);}};
 // HIGH shading can drop to the LOW branch at runtime (adaptive quality, LOW setting): same programs, no recompile.
 S.setHigh=on=>{U.uHigh.value=high&&on?1:0;};
 // Static groups are culled by distance (they are far apart); cheap per-frame loop.
 S.cull=(groups,p)=>{const k=software?.4:1;for(const g of groups){const s=g.userData.site;if(s)g.visible=Math.hypot(s.x-p.x,s.z-p.z)<s.range*k;}};
 // Compile every program variant once (static + instanced solid/fx, sky, terrain, shields) before play.
 S.warmObjects=()=>{const objs=[new T.Mesh(G.box,MAT.solid),new T.InstancedMesh(G.box,MAT.solid,1),new T.Mesh(P.bill,MAT.fx),new T.InstancedMesh(P.bill,MAT.fx,1),new T.Mesh(G.ico,MAT.shield),new T.Mesh(G.ico,MAT.field),new T.Mesh(waterWarmGeo,MAT.water),new T.Mesh(waterWarmGeo,MAT.veil)];
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
 const fp=m.scale>=32&&!!m.footprints;if(c&&c.d===d&&c.fp===fp&&c.level===level&&c.low===m.low&&c.version===(d.version??0)&&vis.x0>=c.x0&&vis.x1<=c.x1&&vis.z0>=c.z0&&vis.z1<=c.z1)return c;
 const pad=Math.max(64,(vis.x1-vis.x0)*.25),x0=Math.max(0,Math.floor((vis.x0-pad)/32)*32),x1=Math.min(Wd.WIDTH,Math.ceil((vis.x1+pad)/32)*32),z0=Math.max(0,Math.floor((vis.z0-pad)/32)*32),z1=Math.min(Wd.LENGTH,Math.ceil((vis.z1+pad)/32)*32);
 const cells=d.cellsIn({x:x0,z:z0,width:x1-x0,height:z1-z0}),scale=Math.min(ppu,2048/(x1-x0),2048/(z1-z0)),cw=Math.max(1,Math.ceil((x1-x0)*scale)),ch=Math.max(1,Math.ceil((z1-z0)*scale));
 const cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const x=cv.getContext('2d'),out={canvas:cv,x0,x1,z0,z1,ppu:scale,level,low:m.low,version:d.version??0,n:cells.length,d,fp};if(c)c.canvas.width=c.canvas.height=0;MAPC.relief=out;if(!cells.length)return out;
 const s=Math.max(m.low?8:4,Math.min(32,Math.round(1/scale/4)*4||4)),nx=Math.round((x1-x0)/s)+1,nz=Math.round((z1-z0)/s)+1,H=new Float32Array(nx*nz).fill(NaN),B=new Uint8Array(nx*nz),Y=j=>(nz-1-j)*s*scale;
 for(const cell of cells){const i0=Math.round((cell.x-x0)/s),j0=Math.round((cell.z-z0)/s),n=Math.max(1,Math.round(cell.size/s));for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const k=(j0+j)*nx+i0+i;if(k<0||k>=H.length||H[k]===H[k])continue;const wx=x0+(i0+i)*s,wz=z0+(j0+j)*s;H[k]=Wd.heightAt(wx,wz);const b=Wd.biomeAt(wx,wz);B[k]=b==='terraformed'?1:b==='massif'?2:0;}}
 const img=new ImageData(nx,nz),Dd=img.data,ok=k=>H[k]===H[k];
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const k=j*nx+i,h=H[k];if(h!==h)continue;const hl=i>0&&ok(k-1)?H[k-1]:h,hr=i<nx-1&&ok(k+1)?H[k+1]:h,hd=j>0&&ok(k-nx)?H[k-nx]:h,hu=j<nz-1&&ok(k+nx)?H[k+nx]:h,hx=(hr-hl)/(2*s),hz=(hu-hd)/(2*s);
  const sh=clamp01(.5+(.7*hx-.7*hz)*1.15),ht=clamp01((h+140)/170);let r=3+sh*15+ht*6,g=13+sh*50+ht*16,bb=22+sh*60+ht*18;if(B[k]===1){r*=.6;g=g*1.08+12;bb=bb*.9+4;}else if(B[k]===2){r+=4;g*=.85;bb=bb*1.1+8;}
  const o=((nz-1-j)*nx+i)*4;Dd[o]=r;Dd[o+1]=g;Dd[o+2]=bb;Dd[o+3]=255;}
 const sm=document.createElement('canvas');sm.width=nx;sm.height=nz;sm.getContext('2d').putImageData(img,0,0);x.imageSmoothingEnabled=true;x.drawImage(sm,-.5*s*scale,-.5*s*scale,nx*s*scale,nz*s*scale);sm.width=sm.height=0;
 const step=s>=16?25:m.low?10:5,minor=new Path2D(),major=new Path2D();
 for(const cell of cells){const i0=Math.round((cell.x-x0)/s),j0=Math.round((cell.z-z0)/s),n=Math.max(1,Math.round(cell.size/s));for(let j=j0;j<j0+n;j++)for(let i=i0;i<i0+n;i++){const a=H[j*nx+i],b=H[j*nx+i+1],c2=H[(j+1)*nx+i+1],dd=H[(j+1)*nx+i];if(a!==a||b!==b||c2!==c2||dd!==dd)continue;
  const lo=Math.min(a,b,c2,dd),hi=Math.max(a,b,c2,dd);for(let L=Math.ceil(lo/step)*step;L<hi;L+=step){const q=[];if((a<L)!==(b<L))q.push(i+(L-a)/(b-a),j);if((b<L)!==(c2<L))q.push(i+1,j+(L-b)/(c2-b));if((dd<L)!==(c2<L))q.push(i+(L-dd)/(c2-dd),j+1);if((a<L)!==(dd<L))q.push(i,j+(L-a)/(dd-a));
   const path=Math.round(L)%(step*5)===0?major:minor;for(let t=0;t+3<q.length;t+=4){path.moveTo(q[t]*s*scale,Y(q[t+1]));path.lineTo(q[t+2]*s*scale,Y(q[t+3]));}}}}
 x.lineCap='round';x.strokeStyle='rgba(20,200,255,.28)';x.lineWidth=1;x.stroke(minor);x.strokeStyle='rgba(0,229,255,.16)';x.lineWidth=3.2;x.stroke(major);x.strokeStyle='rgba(130,248,255,.8)';x.lineWidth=1.2;x.stroke(major);
 const P=(wx,wz)=>[(wx-x0)*scale,(z1-wz)*scale],F=m.footprints;
 if(fp){for(let cxk=Math.floor(x0/128);cxk<=Math.floor((x1-1)/128);cxk++)for(let czk=Math.floor(z0/128);czk<=Math.floor((z1-1)/128);czk++)for(const it of Wd.scenery(cxk,czk)){if(!d.has(it.x,it.z))continue;const [X0,Y0]=P(it.x,it.z);
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
 // Phase 3: discovered mineral deposits (ready / depleted with the respawn minutes) and the live Meteor Strike
 {const now=Date.now();for(const dp of Wd.deposits||[]){if(!S.found?.[dp.id])continue;const until=dp.m==='starter'?(S.deposits?.[dp.id]?Infinity:0):(S.deposits?.[dp.id]||0)-now,ready=until<=0,k=dp.mineral,c=typeof MINERALS!=='undefined'?MINERALS[k].c:'#c0703f';
   if(dp.m==='starter'&&!ready)continue;add(dp.x,dp.z,'◆',ready?c:'#566070',(typeof MINERALS!=='undefined'?MINERALS[k].s:'Ore')+(ready?'':' · '+Math.ceil(until/60000)+'m'),dp.m==='tq'||dp.m==='starter'?5:dp.m==='ar'?3:1);}
  const M=Cb.meteorStrike?.(now);if(M&&M.phase!=='idle'&&!S.strikes?.[M.slot]?.claimed)add(M.site.x,M.site.z,'☄',M.phase==='open'?'#ff7a3d':'#ffd36b',(M.phase==='open'?'STRIKE OPEN · ':'IMPACT ')+Math.max(0,Math.ceil(((M.phase==='open'?M.closesAt:M.impactAt)-now)/60000))+'m',9);}
 for(const o of ops){if(o.raid||o.defense||o.strike||o.id==='base-defense'||o.id==='oxygen-line'||Cb.installations.some(s=>s.id===o.site))continue;const sec=S.territory?.[o.site]?.owner==='humanity';add(o.x,o.z,sec?'⚑':'◆',sec?'#5effd0':'#ffd36b',o.name,4);}
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

root.ConquestStyle=Object.freeze({id:'neon-frontline',version:1,create,footprints,allSites,map:mapPaint,MAP_LEGEND,resetMapCache(){if(MAPC.relief)MAPC.relief.canvas.width=MAPC.relief.canvas.height=0;MAPC.relief=null;}});
})(typeof window!=='undefined'?window:globalThis);
