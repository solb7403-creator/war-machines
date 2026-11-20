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
const WATER_VS=`attribute vec3 aFlow;varying vec3 vF;varying vec3 vWP;
#include <common>
#include <fog_pars_vertex>
void main(){vF=aFlow;vec4 wp=modelMatrix*vec4(position,1.);vWP=wp.xyz;vec4 mvPosition=viewMatrix*wp;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
// Cheap opaque water (one draw for creek, reservoir and crater pool; a second for the canals). aFlow = (metres downstream,
// 0 = still water; across -1..1, where 1 is the shoreline; metres from the middle to that shoreline). Teal, deep in the
// middle and pale in the shallows, short curved ripple strokes that drift with the flow, a pale foam edge and a wet-soil
// bank line. It was near-black with long white streaks and read as an asphalt road (critic round 3). No reflections.
const WATER_FS=`uniform float uTime,uHigh;uniform vec3 uRimCol;varying vec3 vF;varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
float wh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
// one ripple stroke a cell, each with its own place, angle, length and bend (spread = how far the angle strays from the flow)
float ripple(vec2 p,float seed,float spread){vec2 c=floor(p),q=fract(p)-.5;float h=wh(c+seed),a=(h-.5)*spread,len=.17+.2*wh(c+seed+3.1),bend=(wh(c+seed+7.7)-.5)*2.6;
 q-=(vec2(wh(c+seed+1.3),wh(c+seed+5.9))-.5)*.34;float cs=cos(a),sn=sin(a);vec2 r=vec2(q.x*cs+q.y*sn,q.y*cs-q.x*sn);
 return step(.3,h)*(1.-smoothstep(.022,.06,abs(r.y-bend*r.x*r.x)))*(1.-smoothstep(len*.6,len,abs(r.x)));}
void main(){float t=uTime,f=vF.x,ac=abs(vF.y),still=1.-step(.001,abs(f)),m=(1.-ac)*vF.z,bk=m/clamp(vF.z/3.,.35,1.);   // m = metres in from the shoreline (bk: the bank bands are narrower on a narrow canal)
 float shal=1.-smoothstep(0.,min(vF.z*.75,3.4),m);vec3 col=mix(vec3(.122,.373,.478),vec3(.247,.639,.71),shal*.85);
 col=mix(vec3(.165,.435,.525),col,.35+.65*uHigh);
 col*=.95+.07*sin(vWP.x*.21+vWP.z*.13+t*.5)*sin(vWP.z*.17-vWP.x*.09-t*.37);   // a slow swell: big water is never one flat colour
 vec3 V=normalize(cameraPosition-vWP);col=mix(col,vec3(.7,.8,.8),pow(1.-clamp(V.y,0.,1.),3.)*.28);
 vec2 p=mix(vec2((f-t*1.4)*.42,vF.y*vF.z*.8),(vWP.xz+vec2(t*.2,t*.09))*.5,still);float sp=mix(1.3,6.283,still);
 float rp=ripple(p,0.,sp)+uHigh*ripple(p*1.7+17.3,31.,sp)*.7;col=mix(col,vec3(.749,.914,.937),min(rp,1.)*(.24+.14*uHigh)*smoothstep(.5,1.4,bk));
 float lap=.5+.5*sin(t*1.1+vWP.x*.9+vWP.z*.7);col=mix(col,vec3(.788,.839,.753),(1.-smoothstep(.75,1.25+.3*lap,bk))*.6);   // foam edge
 col=mix(col,vec3(.227,.184,.133),1.-smoothstep(.45,.75,bk));   // wet-soil bank line
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
 vec4 d1=texture2D(uDetail,vW*(1./96.));float h1=d1.r-.5;vec2 grad=(d1.gb-.5)*.9;float rim=max(h1,0.)*1.6,bowl=max(-h1,0.)*1.5,tone=.7+.42*d1.a,na=d1.a,va=d1.a,vb=.5,st=.5,st2=.5;
 if(hi){vec4 d2=texture2D(uDetail,vec2(vW.y,-vW.x)*(1./29.)+.31),d3=texture2D(uDetail,vW*(1./8.7)+.67);float h2=(d2.r-.5)*lod2,h3=(d3.r-.5)*lod;
  grad+=vec2(-(d2.b-.5),d2.g-.5)*1.25*lod2+(d3.gb-.5)*1.4*lod;rim+=max(h2,0.)*1.8+max(h3,0.)*1.6;bowl+=max(-h2,0.)*1.3+max(-h3,0.)*1.2;tone+=.24*(d2.a-.5)+.16*(d3.a-.5)*lod;na=d2.a*.62+d1.a*.38;
  va=texture2D(uDetail,vW*(1./73.)+.13).a;vb=texture2D(uDetail,vW*(1./24.)+.71).a;st=texture2D(uDetail,vec2(vY*.032,(vW.x+vW.y)*.0018)).a;st2=texture2D(uDetail,vec2(vY*.21,(vW.x+vW.y)*.004)).a;}
 else{vec4 d2=texture2D(uDetail,vec2(vW.y,-vW.x)*(1./19.)+.31);float h2=(d2.r-.5)*lod;grad+=vec2(-(d2.b-.5),d2.g-.5)*1.3*lod;rim+=max(h2,0.)*1.7;bowl+=max(-h2,0.)*1.25;tone+=.2*(d2.a-.5)*lod;}   // LOW (5E-2d1): one layer of small craters near the camera (the barren Moon was flat navy up close: critic round 3)
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
 // LOW: one patch fetch; its smooth channels stand in for the clump textures. HIGH samples three finer scales on top.
 vec4 dp=texture2D(uDetail,vW*(1./11.)+vec2(.21,.63));float pc=dp.a,pw=dp.r,gg=dp.g,cs=.55;
 if(hi){pw=texture2D(uDetail,vW*(1./5.3)+vec2(.71,.12)).a;gg=texture2D(uDetail,vW*(1./2.7)+.37).a;cs=smoothstep(.3,.62,texture2D(uDetail,vW*(1./1.9)+vec2(pw*.4,pc*.4)).a);}
 vec3 clump=pc<.4?mix(vec3(.048,.102,.027),vec3(.147,.195,.042),smoothstep(.3,.4,pc)):pc<.62?mix(vec3(.147,.195,.042),vec3(.39,.32,.105),smoothstep(.52,.62,pc)):vec3(.39,.32,.105)*(.85+.3*pw);
 vec3 dryG=mix(vec3(.13,.11,.06),vec3(.2,.17,.08),n1);
 vec3 grass=mix(dryG,clump*(.8+.4*gg),.45+.55*cs*lod);
 vec3 dirt=mix(vec3(.11,.085,.062),vec3(.155,.12,.085),gg),regoG=vec3(.254,.242,.216)*(.6+.55*tone)*(1.-.3*min(bowl,1.))*(1.+.4*min(rim,1.));
 // gravel (5E-2d1): round stones of two sizes on two grids turned against each other (it was one square a cell, which read as pixels close up)
 vec2 gp=vW*2.3,gc=floor(gp);float gr=.16+.3*h12(gc+5.);vec2 go=(vec2(h12(gc+2.),h12(gc+7.))-.5)*(1.-2.*gr);float gA=step(.66,h12(gc))*(1.-smoothstep(gr*.7,gr,length(fract(gp)-.5-go)));
 vec2 gq=vec2(vW.x*.8+vW.y*.6,vW.y*.8-vW.x*.6)*4.9,gd=floor(gq);float gs=.14+.3*h12(gd+3.);vec2 gt=(vec2(h12(gd+8.),h12(gd+1.))-.5)*(1.-2.*gs);float gB=step(.6,h12(gd+4.))*(1.-smoothstep(gs*.7,gs,length(fract(gq)-.5-gt)));
 float grav=max(gA,gB)*lod*.5;dirt=mix(dirt,vec3(.22,.21,.19)*(.62+.6*h12((gA>gB?gc:gd)+2.)),grav);
 dirt*=.8+.4*(hi?vb:n1);   // bare soil is mottled
 vec3 bare=mix(dirt,regoG,regoP);
 vec3 rock=mix(vec3(.16,.145,.12),vec3(.24,.22,.19),st)*(.7+.4*tone);rock=mix(rock,vec3(.07,.1,.04),smoothstep(.7,.95,N.y)*.6);
 vec3 veg=mix(bare,grass,gm*(1.-.3*grit));veg=mix(veg,rock,smoothstep(.35,.62,steep));
 if(hi)veg*=mix(1.,.66+.62*st2,smoothstep(.1,.28,1.-vN.y)*lod);   // a bank cut into a slope shows its layers (a bare bank was one flat brown: critic round 3)
 if(terra<.25)veg=mix(rego,veg,smoothstep(.06,.25,terra));
 // scars: shell craters (scorched black centre, mud ring) and tank-track ruts, denser toward the frontier
 {vec2 sc=floor(vW/16.),so=(vec2(h12(sc+3.),h12(sc+9.))-.5)*9.;float sh=h12(sc+21.);if(sh<.12+.3*grit){float r=length(vW-(sc+.5)*16.-so),R=2.2+3.2*h12(sc+31.);
   veg=mix(veg,vec3(.06,.045,.035),(1.-smoothstep(R*.75,R*1.25,r))*.9);veg=mix(veg,vec3(.04,.032,.025),1.-smoothstep(R*.15,R*.6,r));}
  vec2 rc=floor(vW/34.);float rh=h12(rc+41.);if(rh<.18+.35*grit){float a=h12(rc+43.)*3.1416;vec2 dn=vec2(-sin(a),cos(a));float dd=abs(dot(vW-(rc+.5)*34.,dn)),along=abs(dot(vW-(rc+.5)*34.,vec2(cos(a),sin(a))));
   float rut=(1.-smoothstep(.15,.45,abs(dd-1.2)))*(1.-smoothstep(12.,17.,along));veg=mix(veg,vec3(.07,.05,.035),rut*.85);}}
 rego=mix(rego,veg,zv);
 vec3 em=vec3(0.);
 if(vSite.x>.002&&zv<.95){float line=0.;if(hi){float he=hexEdge(vW/6.);line=1.-smoothstep(0.,.02+.12*(1.-lod),he);}line*=1.-zv;
  float ring=smoothstep(.93,1.,fract(vSite.z/22.-uTime*.08));em+=vec3(.05,.72,1.)*(line*.15*vSite.x+ring*.13*vSite.y+.035*vSite.x)*(1.-.85*zv);}
 float blight=vSite.w;
 if(blight>0.){float vein=1.-smoothstep(0.,.08,abs(va*2.-1.));if(hi)vein+=(1.-smoothstep(0.,.06,abs(vb*2.-1.)))*.5;
  rego=mix(rego,rego*vec3(.75,.45,.85),blight);em+=vec3(1.,.08,.62)*vein*blight*.5*(.7+.3*sin(uTime*2.3-dot(vW,vec2(.05))));}
 float at=vAtm,ndl=max(dot(N,normalize(mix(uSunDir,uDaySunW,at))),0.)*(1.-.88*texture2D(uShadowMap,(vW-uAtmoBox.xy)*uAtmoBox.zw).r*at);vec3 light=mix(uSunCol,uDaySun,at)*ndl+mix(mix(uAmbDn,uDayAmbDn,at),mix(uAmbUp,uDayAmbUp,at),N.y*.5+.5)+uRimCol*max(dot(N,uRimDir),0.)*.7*(1.-at);light+=uDaySun*at*.13*(1.-ndl);   // daylight bounce (5E-2d1): terraformed ground turned away from the low sun, or under a shadow, is lit off the sky, never near-black
 vec3 col=rego*light+em+uRimCol*min(rim,1.)*.03;if(hi)col+=(h12(gl_FragCoord.xy)-.5)/255.;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
const SOLID_VS=`attribute vec4 aCol;uniform vec4 uSite[8];uniform vec2 uOrigin,uViewport;uniform vec3 uRimCol;uniform float uHigh,uOutline;uniform sampler2D uAtmoMap,uShadowMap;uniform vec4 uAtmoBox;
varying vec3 vN;varying vec3 vV;varying vec4 vCol;varying vec3 vRim;varying vec3 vWP;varying float vAtm;varying float vShd;varying vec3 vNW;
#include <common>
#include <fog_pars_vertex>
float hv(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
void main(){
#include <beginnormal_vertex>
#include <defaultnormal_vertex>
#include <begin_vertex>
#include <project_vertex>
#include <fog_vertex>
 vN=transformedNormal;vV=-mvPosition.xyz;vCol=aCol;vec4 wp=vec4(transformed,1.);vec3 nw=objectNormal;
 // uOutline > 0 (Session 5E-2d1): the same program draws a tank's clean outline through a building — the hull grown by
 // uOutline pixels in clip space, nudged toward the camera so the ground it stands on never passes the "behind" depth test
 if(uOutline>0.){vec4 cn=projectionMatrix*vec4(mvPosition.xyz+normalize(transformedNormal),1.),c0=projectionMatrix*modelViewMatrix*vec4(0.,0.,0.,1.);vec2 sp=gl_Position.xy/gl_Position.w,od=cn.xy/cn.w-sp,rd=(sp-c0.xy/c0.w)*uViewport;float ol=length(od*uViewport),rl=length(rd);vec2 dir=(ol>1e-5?od*uViewport/ol:vec2(0.))*.55+(rl>1e-5?rd/rl:vec2(0.))*.75;gl_Position.xy+=dir*uOutline*2./uViewport*gl_Position.w;if(uOutline>.5){vec4 m2=mvPosition;m2.z+=1.3;vec4 p2=projectionMatrix*m2;gl_Position.z=p2.z/p2.w*gl_Position.w;}}
#ifdef USE_INSTANCING
 nw=mat3(instanceMatrix)*nw;wp=instanceMatrix*wp;vec2 io=(modelMatrix*vec4(instanceMatrix[3].xyz,1.)).xz+uOrigin;vCol.rgb*=.75+.5*hv(floor(io*4.));
#endif
 wp=modelMatrix*wp;vWP=wp.xyz;vNW=normalize(mat3(modelMatrix)*nw);vec3 rc=uRimCol*2.2;vec2 uvA=(wp.xz+uOrigin-uAtmoBox.xy)*uAtmoBox.zw;vAtm=texture2D(uAtmoMap,uvA).r;vShd=texture2D(uShadowMap,uvA).r*vAtm;
 // HIGH tints each vertex's rim by the nearest friendly / Parasite site; LOW keeps the neutral rim (no per-vertex loop).
 if(uHigh>.5){vec2 w=wp.xz+uOrigin;float best=0.;for(int i=0;i<8;i++){vec4 s=uSite[i];if(s.z<=0.)continue;float f=1.-smoothstep(s.z*.6,s.z*1.25,length(w-s.xy));if(f>best){best=f;rc=mix(uRimCol*2.2,s.w>0.?vec3(.06,.62,.8):vec3(.85,.05,.55),f);}}}
 vRim=rc;}`;
// Surface codes (Session 5E-2d1, js/conquest/worldkit.js SURF): a vertex alpha below zero is no emission but a material whose
// detail the HIGH branch paints from world-anchored coordinates and the shared detail texture (two fetches): armour panel
// seams, chipped paint and rust, planks, concrete pores and stains, glass, corrugated scrap, cloth, chitin, leaves, rock,
// soil, solar cells. LOW keeps the flat vertex colour. No texture from an artist, no extra shader program.
// uPress: the footprint (centre x/z, half size, rotation) of the one building the tank is pressed against; its pixels are
// thinned to a see-through screen (owner, Nov 17 + Nov 19: nothing else is ever see-through).
const SOLID_FS=`uniform vec3 uSunCol,uAmbUp,uAmbDn,uSunV,uRimV,uUpV,uDaySun,uDayAmbUp,uDayAmbDn,uDaySunV,uOutlineCol;uniform float uTime,uGlow,uHigh,uFlash,uOutline,uPressK,uPressY;uniform vec2 uOrigin,uPressR;uniform vec4 uPress;uniform sampler2D uDetail;
varying vec3 vN;varying vec3 vV;varying vec4 vCol;varying vec3 vRim;varying vec3 vWP;varying float vAtm;varying float vShd;varying vec3 vNW;
#include <common>
#include <fog_pars_fragment>
float sh1(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float by2(vec2 a){a=floor(a);return fract(a.x*.5+a.y*a.y*.75);}
void main(){
 if(uOutline>0.){gl_FragColor=vec4(uOutlineCol,1.);
#include <colorspace_fragment>
  return;}
 if(uPress.z>0.&&uPressK>0.&&vWP.y>uPressY){vec2 q=vWP.xz+uOrigin-uPress.xy;q=vec2(q.x*uPressR.x+q.y*uPressR.y,q.y*uPressR.x-q.x*uPressR.y);if(abs(q.x)<uPress.z&&abs(q.y)<uPress.w&&by2(.5*gl_FragCoord.xy)*.25+by2(gl_FragCoord.xy)<uPressK)discard;}
 vec3 N=normalize(vN),L=uSunV,R=uRimV,UP=uUpV; // view-space light directions, set once per frame
 float at=vAtm;L=normalize(mix(L,uDaySunV,at));vec3 base=vCol.rgb;float a=vCol.a,spec=.16,shin=56.,wrap=0.,glassK=0.,frK=1.;vec3 emit=vec3(0.);
 if(a<0.&&uHigh>.5){float sc=-a*10.+.02,code=floor(sc),wear=fract(sc)/.9;vec3 an=abs(vNW);vec3 wp=vec3(vWP.x+uOrigin.x,vWP.y,vWP.z+uOrigin.y);
  bool top=an.y>.6;vec2 uv=top?wp.xz:(an.x>an.z?vec2(wp.z,wp.y):vec2(wp.x,wp.y));
  vec4 tA=texture2D(uDetail,uv*.047+vec2(.31,.17)),tB=texture2D(uDetail,uv*.23+vec2(.7,.13));float nA=tA.a,nB=tB.a,m=nA*.62+nB*.38;vec2 bump=vec2(0.);
  if(code<1.5){        // armour plate: staggered panel seams, per-panel tone, grime in the low noise, fine scuffs
   vec2 pu=uv/vec2(2.1,1.3);pu.x+=.5*mod(floor(pu.y),2.);vec2 fp=fract(pu);float ed=min(min(fp.x,1.-fp.x)*2.1,min(fp.y,1.-fp.y)*1.3),seam=1.-smoothstep(.012,.05,ed),hl=smoothstep(.05,.075,ed)*(1.-smoothstep(.075,.12,ed));
   base*=(.92+.16*sh1(floor(pu)))*(1.-.5*seam)*(1.+.1*hl)*(.93+.14*nB);base*=1.-(.18+.3*wear)*smoothstep(.5,.82,nA);spec=.42;shin=38.;}
  else if(code<2.5){   // painted prefab: faint big panels, sun-faded tone, chips down to primer and rust
   vec2 pu=uv/vec2(2.7,1.9);vec2 fp=fract(pu);float ed=min(min(fp.x,1.-fp.x)*2.7,min(fp.y,1.-fp.y)*1.9),seam=1.-smoothstep(.01,.04,ed);float th=mix(.9,.5,wear),chip=smoothstep(th,th+.035,m),ring=smoothstep(th-.06,th,m)*(1.-chip);
   base*=(.94+.12*sh1(floor(pu)+7.))*(1.-.28*seam)*(.86+.26*nA);base=mix(base,base*1.3+.025,ring*.55);base=mix(base,vec3(.19,.075,.032)*(.6+.8*nB),chip*.9);base*=1.-.22*wear*smoothstep(.55,.9,tA.r);spec=.1;shin=24.;}
  else if(code<3.5){   // timber: boards with gaps, butt joints, a tone per board and a grain
   float pv=(top?uv.x:uv.y)/.36,al=top?uv.y:uv.x,id=floor(pv),f=fract(pv),gap=smoothstep(0.,.07,f)*(1.-smoothstep(.93,1.,f)),hb=sh1(vec2(id,3.)),jt=1.-step(.014,fract(al/2.6+hb));
   float gr=sin(al*11.+hb*40.+sin(pv*2.1+al*.7)*2.4)*.5+.5;base*=(.5+.5*gap)*(.78+.4*hb)*(.9+.14*gr)*(1.-.5*jt)*(.9+.2*nB);base*=1.-.3*wear*smoothstep(.5,.85,nA);spec=.02;}
  else if(code<4.5){   // concrete / stone slab: mottling, pores, form lines, leak stains, a hairline crack
   float pore=smoothstep(.7,.78,nB),crack=1.-smoothstep(.0,.012,abs(nA-.47)),form=1.-smoothstep(.0,.03,abs(fract(uv.y/1.5)-.5)-.47);
   base*=(.84+.3*nA)*(1.-.22*pore)*(1.-.4*crack*step(.4,nB))*(1.-.12*(top?0.:form));base*=1.-(.12+.3*wear)*smoothstep(.5,.8,tA.r);bump=vec2(nB-.5,nA-.5)*.35;spec=.03;frK=.18;}
  else if(code<5.5){   // glass: panes with mullions, sky in the pane; wear = how brightly it is lit from inside
   vec2 pu=uv/vec2(1.1,1.4),fp=fract(pu);float ed=min(min(fp.x,1.-fp.x)*1.1,min(fp.y,1.-fp.y)*1.4),mul=1.-smoothstep(.02,.05,ed);
   base*=(.8+.3*sh1(floor(pu)+3.))*(1.-.6*mul);emit=vCol.rgb*wear*(1.-mul)*(.7+.6*sh1(floor(pu)+11.));glassK=1.-mul;spec=.9;shin=90.;}
  else if(code<6.5){   // corrugated scrap sheet: ridges, heavy rust in the folds
   float cg=sin((top?uv.x:uv.x)*17.),rst=smoothstep(mix(.75,.4,wear),.95,m);base*=(.82+.22*cg)*(.88+.22*nB);base=mix(base,vec3(.2,.085,.035)*(.6+.7*nB),rst*.85);bump=vec2(cg*.35,0.);spec=.12;shin=20.;}
  else if(code<7.5){   // cloth, canvas, tarp: weave and soft folds
   base*=(.88+.22*nB)*(.93+.1*sin(uv.x*7.+nA*6.));wrap=.25;spec=0.;}
  else if(code<8.5){   // Parasite chitin: plated shell with glowing vein lines
   float vein=1.-smoothstep(0.,.03,abs(nA-.5)),cell=smoothstep(.3,.7,nB);base*=(.6+.7*cell);emit=vec3(1.,.12,.78)*vein*(.25+.9*wear);bump=(tA.gb-.5)*.9;spec=.5;shin=30.;}
  else if(code<9.5){   // leaves, moss, grass: clumped tone, sun-yellowed tips, light through the leaf
   base*=(.7+.6*nB);base=mix(base,base*vec3(1.35,1.15,.55),clamp((nA-.42)*1.4,0.,.6));wrap=.45;spec=0.;bump=(tB.gb-.5)*.6;}
  else if(code<10.5){  // rock: strata, mottling, cracks; wear = moss and lichen on the upward faces
   float st=sin(wp.y*4.6+nA*9.)*.5+.5,crack=1.-smoothstep(0.,.014,abs(nB-.5));base*=(.78+.34*nA)*(.9+.16*st)*(1.-.45*crack);
   float ms=wear*smoothstep(.15,.6,vNW.y)*smoothstep(.38,.6,nB);base=mix(base,vec3(.075,.105,.04)*(.7+.6*nA),ms);bump=(tA.gb-.5)*1.1;spec=.05;}
  else if(code<11.5){  // soil, sandbags, gravel
   base*=(.74+.5*nB)*(.9+.2*nA);bump=(tB.gb-.5)*.8;spec=0.;}
  else if(code<12.5){  // solar cells: a cell grid under glass
   vec2 fp=fract(uv/vec2(.62,.62));float ed=min(min(fp.x,1.-fp.x),min(fp.y,1.-fp.y)),ln=1.-smoothstep(.02,.06,ed);base=mix(base*(.85+.3*nB),vec3(.07,.145,.35),ln*.75);spec=.4;shin=70.;glassK=.14;}
  else if(code<13.5){  // bark: upright grooves that wander, a tone per ridge; wear = cracks (it was timber boards, which read as brick on a trunk)
   float g=(top?uv.x+uv.y:uv.x)*3.3+sin(uv.y*1.1+nA*5.)*.55,f=fract(g),gv=smoothstep(0.,.2,f)*(1.-smoothstep(.8,1.,f));
   base*=(.4+.6*gv)*(.8+.4*sh1(vec2(floor(g),5.)))*(.88+.24*nB);base*=1.-.55*wear*(1.-smoothstep(0.,.022,abs(nB-.5)));bump=vec2(gv-.5,0.)*.5;spec=.02;}
  else{                // ice: pale fractures on two slants, frost on the upward faces, the sky in the face; wear = light from inside
   float c1=1.-smoothstep(0.,.045,abs(fract((uv.x*.8+uv.y*.6)*.62+nB*1.1)-.5)),c2=1.-smoothstep(0.,.035,abs(fract((uv.y*.85-uv.x*.5)*.4+nA*2.2+.3)-.5));
   base*=.86+.28*nA;base=mix(base,vec3(.3,.58,.72),max(c1,c2*.8)*.85);base=mix(base,vec3(.72,.86,.92),smoothstep(.45,.8,vNW.y)*(.35+.4*nB));emit=vCol.rgb*wear*.55;glassK=.7;spec=.9;shin=90.;}
  if(bump.x!=0.||bump.y!=0.){vec3 bw=top?vec3(bump.x,0.,bump.y):(an.x>an.z?vec3(0.,bump.y,bump.x):vec3(bump.x,bump.y,0.));N=normalize(N-mat3(viewMatrix)*bw);}
 }
 float ndl=max(dot(N,L),0.);ndl=mix(ndl,ndl*.5+.5,wrap);vec3 sunC=mix(uSunCol,uDaySun,at),aU=mix(uAmbUp,uDayAmbUp,at),aD=mix(uAmbDn,uDayAmbDn,at);
 vec3 lit=base*(sunC*ndl*(1.-.8*vShd)+mix(aD,aU,dot(N,UP)*.5+.5));float rl=max(dot(N,R),0.)*(1.-.7*at);lit+=base*vRim*rl*.5;
 lit+=base*uDaySun*at*(.16+.1*max(-dot(N,L),0.))*(1.-ndl);   // daylight bounce (5E-2d1): a wall turned away from the low sun is lit off the ground, never black
 if(uHigh>.5){vec3 V=normalize(vV);float fr=pow(1.-max(dot(N,V),0.),3.);lit+=mix(vRim,vec3(.55,.7,.9),at)*fr*frK*(.25+.75*rl)*(.45-.3*at);vec3 H=normalize(L+V);lit+=sunC*pow(max(dot(N,H),0.),shin)*spec*(1.-.7*vShd);
  if(glassK>0.)lit+=mix(vec3(.02,.05,.09),vec3(.32,.42,.55),at)*glassK*(.25+.75*fr);lit+=emit*uGlow*.55;}
 float em=clamp(a>1.?a-1.:a,0.,1.);float pulse=a>1.?.5+.5*sin(uTime*3.+dot(vWP,vec3(.37,.61,.23))):1.;
 vec3 col=mix(lit,base*uGlow*(.45+.55*pulse),em);col=mix(col,vec3(1.,.62,.36)*1.35,uFlash*.6);gl_FragColor=vec4(col,1.);   // uFlash: the 80 ms hit flash (Session 6)
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`;
// Billboards (aBill.z = 1) expand in view space by aBill.xy × the object's scale, so pooled effects scale with the mesh.
const FX_VS=`attribute vec4 aCol;attribute vec3 aBill;uniform vec3 uKind[4];varying vec4 vCol;varying vec2 vUv;varying vec3 vWP;
#include <common>
#include <fog_pars_vertex>
void main(){vUv=uv;vCol=aCol;vWP=(modelMatrix*vec4(position,1.)).xyz;vec4 mvPosition=vec4(position,1.);float bs=length(modelMatrix[0].xyz);   // a billboard's 4 corners store its centre (merged Fx) or the origin (instanced P.bill)
#ifdef USE_INSTANCING
 mvPosition=instanceMatrix*mvPosition;bs*=length(instanceMatrix[0].xyz);float k=instanceMatrix[2].z;vCol.rgb*=k<1.5?uKind[0]:k<2.5?uKind[1]:k<3.5?uKind[2]:uKind[3];
#endif
 mvPosition=modelViewMatrix*mvPosition;mvPosition.xy+=aBill.xy*bs;mvPosition.z+=length(aBill.xy)*bs*.55;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`;
const FX_FS=`uniform sampler2D uMap;uniform float uFade,uTime,uAtmo,uHigh;varying vec4 vCol;varying vec2 vUv;varying vec3 vWP;
#include <common>
#include <fog_pars_fragment>
float hexL(vec2 p){const vec2 r=vec2(1.,1.7320508);vec2 h=r*.5;vec2 a=mod(p,r)-h;vec2 b=mod(p-h,r)-h;vec2 g=dot(a,a)<dot(b,b)?a:b;vec2 q=abs(g);return .5-max(dot(q,vec2(.5,.8660254)),q.x);}
void main(){vec4 t=texture2D(uMap,vUv);
 // The atmosphere boundary veil (aCol.a < 0): rising light bands + faint hex lattice, strongest at the ground and at grazing
 // angles; raw additive output (alpha 0 under premultiplied blending), no fog, tone mapping or colour conversion, as authored.
 if(vCol.a<0.){vec3 V=normalize(cameraPosition-vWP);float y=vUv.y,base=exp(-y*3.)*.9+exp(-y*.8)*.4+exp(-y*60.)*1.5,band=.5+.5*sin(vUv.x*.21+y*9.-uTime*1.3),sh=.6+.4*sin(vUv.x*.9-uTime*2.1+y*14.);
  float hx=uHigh>.5?(1.-smoothstep(0.,.04,hexL(vec2(vUv.x*.25,y*14.))))*.18:0.;float graz=1.-abs(V.y)*.5;float a=(base*(.55+.45*band)*sh+hx*exp(-y*2.))*graz*mix(1.,.14,uAtmo)*smoothstep(1.,.55,y);
  gl_FragColor=vec4(mix(vec3(.35,.7,1.),vec3(.75,.9,1.),band)*a*.42,0.);return;}
 vec3 e=vCol.rgb*t.r*uFade;float o=vCol.a*t.g*uFade;
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
const SKY_FS=`uniform vec3 uZenith,uBandA,uBandB,uFogC,uEarthL,uSunW,uDaySunW;uniform sampler2D uEarth;uniform float uSpin,uAtmo,uTime,uHigh;
varying vec3 vDir;varying vec4 vCol;varying vec2 vQ;varying float vKind;
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5),b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5),c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5),e=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5);return mix(mix(a,b,f.x),mix(c,e,f.x),f.y);}
vec3 night(vec3 d){float h=d.y;float band=exp(-abs(h-.012)*85.);float glow=exp(-max(h,0.)*9.);float hi=exp(-max(h,0.)*2.6);
 vec3 c=uZenith+uBandB*(glow*.55+hi*.12)+uBandA*band;return mix(c,uFogC,smoothstep(.002,-.03,h));}
// Inside the zones: a thin, dusty atmosphere. Hazy amber horizon (#C9A27A) to dusky steel blue overhead (#4F6377), a low sun,
// broken dramatic clouds (dark bellies, sunlit amber rims) and distant dust haze along the horizon.
vec3 day(vec3 d){float h=max(d.y,0.);vec3 c=mix(vec3(.58,.36,.19),vec3(.078,.125,.18),pow(h,.42));float s=max(dot(d,uDaySunW),0.);
 c+=vec3(1.,.62,.3)*(pow(s,5.)*.35+pow(s,60.)*.9)+vec3(1.,.9,.75)*smoothstep(.9993,.9997,s)*9.;
 vec2 q=d.xz/(d.y+.1)*1.1+vec2(uTime*.004,uTime*.0015);float cl=uHigh>.5?vn(q)*.5+vn(q*2.3+3.7)*.3+vn(q*5.1+1.3)*.2:vn(q)*.8+.1;float cov=smoothstep(.46,.7,cl)*smoothstep(.0,.12,d.y),body=smoothstep(.55,.85,cl);
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
  uOrigin:{value:new T.Vector2()},uOutline:{value:0},uOutlineCol:{value:new T.Color(0x7ff2ff)},uPress:{value:new T.Vector4(0,0,-1,-1)},uPressR:{value:new T.Vector2(1,0)},uPressK:{value:0},uPressY:{value:-1e5},uGlow:{value:2.3},uHigh:{value:high?1:0},uSunV:{value:sunDir.clone()},uRimV:{value:rimDir.clone()},uUpV:{value:V3(0,1,0)},uViewport:{value:new T.Vector2(800,800)},uFade:{value:1},
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
 const MAT={terrain:mk(TERRAIN_VS,TERRAIN_FS,{uDetail:{value:tex.detail}},{vertexColors:true}),solid:mk(SOLID_VS,SOLID_FS,{uFlash:{value:0},uDetail:{value:tex.detail}}),solidHit:mk(SOLID_VS,SOLID_FS,{uFlash:{value:1},uDetail:{value:tex.detail}}),   // Session 6: the hit flash swaps solid -> solidHit for 80 ms (same shaders: one program, a uniform swap)

  fx:mk(FX_VS,FX_FS,{uMap:{value:tex.atlas},uKind:{value:[V3(.1,.68,1).multiplyScalar(.6),V3(.3,1,.5).multiplyScalar(.5),V3(.6,.95,1).multiplyScalar(.9),V3(1,.1,.7).multiplyScalar(.7)]}},
   {transparent:true,premultipliedAlpha:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-8}),
  sky:mk(SKY_VS,SKY_FS,{uEarth:{value:tex.earth},uEarthDir:{value:V3(.86,.15,.48).normalize()},uEarthSize:{value:.068},uEarthL:{value:V3(-.62,.34,.7).normalize()},uSpin:{value:2.2},
   uZenith:{value:V3(.0002,.0003,.0009)},uBandA:{value:V3(0,.2,.19)},uBandB:{value:V3(.045,.012,.11)},uFogC:{value:V3(.0018,.0021,.0048)}},{fog:false,depthWrite:false,side:T.DoubleSide})};
 const shieldMat=(color,opacity,hexK=1,side=T.DoubleSide)=>{const m=new T.ShaderMaterial({uniforms:{uColor:{value:lin(color)},uTime:U.uTime,uOpacity:{value:opacity},uHex:{value:hexK}},vertexShader:SHIELD_VS,fragmentShader:SHIELD_FS,transparent:true,premultipliedAlpha:true,depthWrite:false,blending:T.AdditiveBlending,side});m.userData.motionSkip=true;m.userData.conquestStyle=true;return m;};
 MAT.shield=shieldMat(0x48d8ff,.85);MAT.field=shieldMat(0x2dd4ff,.32,.12,T.FrontSide);
 // Additive glow/decal draws are never tap targets (view pick() and the browser bots skip userData.noPick).
 const fxMesh=(geo,order=2)=>{const m=new T.Mesh(geo,MAT.fx);m.renderOrder=order;m.userData.noPick=true;return m;};
 const S={id:'neon-frontline',version:1,low,high,software,T,U,MAT,G,AT,SIGN,K,tex,footprints:F,shared:[],ground};
 // ---------- Session 5E-2d1 (owner, Nov 17 + Nov 19): buildings are never see-through unless the tank is pressed against one ----------
 // A tank hidden by a building shows through it as a clean outline (yours and your allies'; enemies never: cover stays real).
 // Same solid program, two more materials: a stencil mask of every tracked tank's true shape (no colour, no depth test), then
 // the hull grown by a few pixels where something stands in front of it (depth GREATER) outside that mask = the outline only.
 MAT.outlineMask=mk(SOLID_VS,SOLID_FS,{uOutline:{value:1e-4},uDetail:{value:tex.detail}},{colorWrite:false,depthTest:false,depthWrite:false,stencilWrite:true,stencilFunc:519,stencilRef:1,stencilZPass:7681});
 const outlineMat=hex=>mk(SOLID_VS,SOLID_FS,{uOutline:{value:3},uOutlineCol:{value:lin(hex)},uDetail:{value:tex.detail}},{depthFunc:6,depthWrite:false,stencilWrite:true,stencilFunc:517,stencilRef:1});
 MAT.outline=outlineMat(0x8ff6ff);MAT.outlineAlly=outlineMat(0xffe29a);
 // A tank's own solid parts (trim strips, LOW hull) are never thinned with the building it is pressed against: the same program
 // with its own, always-off press uniforms. S.own(root) moves a vehicle's solid meshes onto it.
 MAT.own=mk(SOLID_VS,SOLID_FS,{uFlash:{value:0},uDetail:{value:tex.detail},uPress:{value:new T.Vector4(0,0,-1,-1)},uPressK:{value:0}});
 S.own=rt=>{rt?.traverse?.(o=>{if(o.isMesh&&o.material===MAT.solid)o.material=MAT.own;});return rt;};
 // Twins of a tank's solid meshes, kept in their own group (nothing is ever added to a vehicle): sync(list, px) each frame with
 // list = [{root, ally}] and px = the outline width in drawing-buffer pixels.
 // The twins draw the whole tank twice more, so they are only drawn while something stands in front of it. Each frame one
 // box around the tank (all its parts as they stand now, turret included; the lowest 30% left out so the grass it stands in
 // does not count) asks the GPU whether anything is nearer than its front faces: a WebGL2 occlusion query, 12 triangles, no
 // colour, no depth write, the solid program. The answer arrives a frame later and holds the twins on for a few frames.
 // Without WebGL2 queries, without a camera, or when an answer never comes back, the twins are always drawn, as before.
 MAT.outlineProbe=mk(SOLID_VS,SOLID_FS,{uOutline:{value:.51},uDetail:{value:tex.detail}},{colorWrite:false,depthFunc:6,depthWrite:false});
 const PROBE_I=[0,2,3,0,3,1,4,5,7,4,7,6,0,1,5,0,5,4,2,6,7,2,7,3,0,4,6,0,6,2,1,3,7,1,7,5];   // a box's 12 triangles, corners numbered x + 2y + 4z, wound outward
 S.outliner=scene=>{const g=new T.Group();g.name='cq-outline';scene.add(g);const sets=new Map();let frame=0;const _pv=V3(),_pc=V3(),_pm=new T.Matrix4(),_pi=new T.Matrix4();
  const drop=set=>{for(const t of set.tw){g.remove(t[0]);g.remove(t[1]);}if(set.probe){g.remove(set.probe);set.probe.geometry.dispose();if(set.q&&set.gl)try{set.gl.deleteQuery(set.q);}catch(_){}set.q=null;set.probe=null;}};
  const probe=set=>{const geo=new T.BufferGeometry(),N=new Float32Array(24);for(let i=0;i<8;i++)N[i*3+1]=1;
   geo.setAttribute('position',new T.BufferAttribute(new Float32Array(24),3));geo.setAttribute('normal',new T.BufferAttribute(N,3));geo.setAttribute('aCol',new T.BufferAttribute(new Float32Array(32),4));geo.setIndex(PROBE_I.slice());set.flip=false;
   const m=new T.Mesh(geo,MAT.outlineProbe);m.renderOrder=8999;m.matrixAutoUpdate=false;m.frustumCulled=false;m.userData.noPick=true;m.userData.noOutline=true;m.userData.outlineProbe=true;set.pend=0;set.busy=false;set.hot=frame+3;set.ok=true;
   m.onBeforeRender=rd=>{if(set.pend||set.busy||!set.ok)return;const gl=rd.getContext();if(!gl||!gl.beginQuery||gl.ANY_SAMPLES_PASSED_CONSERVATIVE===undefined){set.ok=false;return;}try{if(!set.q||set.gl!==gl){set.gl=gl;set.q=gl.createQuery();}gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE,set.q);set.busy=true;}catch(_){set.ok=false;}};
   m.onAfterRender=()=>{if(!set.busy)return;set.busy=false;try{set.gl.endQuery(set.gl.ANY_SAMPLES_PASSED_CONSERVATIVE);set.pend=frame;}catch(_){set.ok=false;}};g.add(m);return m;};
  // true = draw this tank's twins this frame
  const ask=(set,rt,cam)=>{if(!set.probe||!set.ok||!cam)return true;const P=set.probe.geometry.attributes.position,A=P.array,cp=cam.position;let x0=1e9,y0=1e9,z0=1e9,x1=-1e9,y1=-1e9,z1=-1e9;_pi.copy(rt.matrixWorld).invert();
   for(const o of set.src){const b=o.geometry.boundingBox||(o.geometry.computeBoundingBox(),o.geometry.boundingBox);_pm.multiplyMatrices(_pi,o.matrixWorld);for(let i=0;i<8;i++){_pv.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).applyMatrix4(_pm);x0=Math.min(x0,_pv.x);x1=Math.max(x1,_pv.x);y0=Math.min(y0,_pv.y);y1=Math.max(y1,_pv.y);z0=Math.min(z0,_pv.z);z1=Math.max(z1,_pv.z);}}
   const px=(x1-x0)*.04,pz=(z1-z0)*.04,h=y1-y0;x0-=px;x1+=px;z0-=pz;z1+=pz;y0+=h*.3;y1+=h*.06;_pc.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2).applyMatrix4(rt.matrixWorld);
   const dx=_pc.x-cp.x,dy=_pc.y-cp.y,dz=_pc.z-cp.z,dl=Math.hypot(dx,dy,dz)||1,sh=1/dl;   // the shader brings the box 1.3 m nearer in depth (as it does the outline); 1 m back here leaves it .3 m nearer than it stands
   for(let i=0;i<8;i++){_pv.set(i&1?x1:x0,i&2?y1:y0,i&4?z1:z0).applyMatrix4(rt.matrixWorld);A[i*3]=_pv.x+dx*sh;A[i*3+1]=_pv.y+dy*sh;A[i*3+2]=_pv.z+dz*sh;}P.needsUpdate=true;
   const e=rt.matrixWorld.elements,flip=(e[0]*(e[5]*e[10]-e[6]*e[9])-e[4]*(e[1]*e[10]-e[2]*e[9])+e[8]*(e[1]*e[6]-e[2]*e[5]))<0;
   if(flip!==set.flip){set.flip=flip;const I=set.probe.geometry.index.array;for(let t=0;t<36;t+=3){I[t+1]=PROBE_I[t+(flip?2:1)];I[t+2]=PROBE_I[t+(flip?1:2)];}set.probe.geometry.index.needsUpdate=true;}
   if(set.pend){let done=false,hit=true;try{done=!!set.gl.getQueryParameter(set.q,set.gl.QUERY_RESULT_AVAILABLE);if(done)hit=!!set.gl.getQueryParameter(set.q,set.gl.QUERY_RESULT);}catch(_){set.ok=false;return true;}
    if(done){set.pend=0;if(hit)set.hot=frame+10;}else if(frame-set.pend>40){set.pend=0;set.hot=frame+40;try{set.gl.deleteQuery(set.q);}catch(_){}set.q=null;}}   // an answer that never comes (a lost context): draw the twins and ask again
   return frame<=set.hot;};
  const ok=o=>o.isMesh&&!o.isInstancedMesh&&o.material&&!Array.isArray(o.material)&&!o.material.transparent&&o.material.colorWrite!==false&&o.geometry?.attributes?.normal&&!o.userData.noOutline;
  return {group:g,sets,
   sync(list,px,cam){MAT.outline.uniforms.uOutline.value=MAT.outlineAlly.uniforms.uOutline.value=px;const live=new Set();frame++;
    for(const it of list){const rt=it.root;if(!rt||!rt.parent)continue;let shown=true;for(let p=rt;p;p=p.parent)if(!p.visible){shown=false;break;}if(!shown)continue;live.add(rt);rt.updateWorldMatrix(true,true);
     const src=[];rt.traverse(o=>{if(!ok(o))return;for(let p=o;p&&p!==rt;p=p.parent)if(!p.visible)return;if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();if(o.geometry.boundingSphere.radius*o.matrixWorld.getMaxScaleOnAxis()>.3)src.push(o);});
     let set=sets.get(rt);if(!set||set.src.length!==src.length||set.src.some((o,i)=>o!==src[i]||set.geo[i]!==o.geometry)){if(set)drop(set);set={src,geo:src.map(o=>o.geometry),tw:[]};
      for(const o of src){const a=new T.Mesh(o.geometry,MAT.outlineMask),b=new T.Mesh(o.geometry,it.ally?MAT.outlineAlly:MAT.outline);a.renderOrder=9000;b.renderOrder=9001;for(const m of [a,b]){m.matrixAutoUpdate=false;m.frustumCulled=false;m.userData.noPick=true;m.userData.noOutline=true;m.userData.outlineTwin=true;}g.add(a,b);set.tw.push([a,b]);}set.probe=src.length?probe(set):null;sets.set(rt,set);}
     const on=ask(set,rt,cam);set.on=on;set.src.forEach((o,i)=>{for(const m of set.tw[i]){m.visible=on;if(on){m.matrix.copy(o.matrixWorld);m.matrixWorldNeedsUpdate=true;}}});}
    for(const [rt,set] of sets)if(!live.has(rt)){drop(set);sets.delete(rt);}},
   clear(){for(const set of sets.values())drop(set);sets.clear();},dispose(){this.clear();g.parent?.remove(g);}};};
 // The one footprint the tank is pressed against: {x, z, hw, hd, r} in the solid shader's world frame (render x/z + uOrigin),
 // k = 0..1 how far its pixels are thinned (eased by the caller). null / k = 0: nothing is see-through.
 // fp.y (optional) = the ground under the tank: what stands lower than 0.9 m above it (grass, scrub, a kerb) stays solid
 S.press=(fp,k)=>{U.uPressY.value=fp&&Number.isFinite(fp.y)?fp.y+.9:-1e5;if(fp&&k>0){U.uPress.value.set(fp.x,fp.z,fp.hw,fp.hd);U.uPressR.value.set(Math.cos(fp.r||0),Math.sin(fp.r||0));U.uPressK.value=Math.min(.78,k*.78);}else{U.uPress.value.set(0,0,-1,-1);U.uPressK.value=0;}};
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
  mesh(){return this.n?new T.Mesh(this.geometry(),MAT.solid):new T.Group();}
  // the same batch as several meshes, one per ground cell (a triangle goes to the cell its centre stands in), so the camera
  // drops the cells it does not see; a big place built as one mesh is otherwise drawn whole whenever any corner of it shows
  cells(size=80){const P=this.P,I=this.I,B=new Map();for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,k=Math.floor((P[a]+P[b]+P[c])/3/size)+':'+Math.floor((P[a+2]+P[b+2]+P[c+2])/3/size);let L=B.get(k);if(!L)B.set(k,L=[]);L.push(t);}
   const out=[];for(const L of B.values()){const map=new Map(),p=[],n=[],c=[],ix=[];for(const t of L)for(let j=0;j<3;j++){const v=I[t+j];let w=map.get(v);if(w===undefined){w=map.size;map.set(v,w);p.push(P[v*3],P[v*3+1],P[v*3+2]);n.push(this.N[v*3],this.N[v*3+1],this.N[v*3+2]);c.push(this.A[v*4],this.A[v*4+1],this.A[v*4+2],this.A[v*4+3]);}ix.push(w);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('aCol',new T.Float32BufferAttribute(c,4));g.setIndex(ix);g.computeBoundingSphere();out.push(new T.Mesh(g,MAT.solid));}return out;}}
 class Fx{constructor(){this.P=[];this.U=[];this.A=[];this.B=[];this.I=[];this.n=0;}
  v(x,y,z,u,v,e,o,bx=0,by=0,bz=0){this.P.push(x,y,z);this.U.push(u,v);this.A.push(e[0],e[1],e[2],o);this.B.push(bx,by,bz);return this.n++;}
  q4(a,b,c,d){this.I.push(a,b,c,a,c,d);}
  bill(x,y,z,s,r,e,o=0){if(software&&!this.keep)return;const a=this.v(x,y,z,r[0],r[1],e,o,-s,-s,1),b=this.v(x,y,z,r[2],r[1],e,o,s,-s,1),c=this.v(x,y,z,r[2],r[3],e,o,s,s,1),d=this.v(x,y,z,r[0],r[3],e,o,-s,s,1);this.q4(a,b,c,d);}
  // a free-standing holographic sign: it turns to the camera, so it never reads mirrored from behind (5E-2d1)
  sign(x,y,z,w,h,r,e,o=0){this.q4(this.v(x,y,z,r[0],r[1],e,o,-w/2,-h/2,1),this.v(x,y,z,r[2],r[1],e,o,w/2,-h/2,1),this.v(x,y,z,r[2],r[3],e,o,w/2,h/2,1),this.v(x,y,z,r[0],r[3],e,o,-w/2,h/2,1));}
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

 // ---------- Session 5E-2d1 (owner, Nov 11 + Nov 19): the world kit (js/conquest/slots.js, worldkit.js, kit/*.js) ----------
 // Every code-drawn building and prop is a slot model placed by a matrix (model space: metres, +y up, front +z, ground y = 0).
 // kt() = a placement target (merged main / detail batches + glow); kdone() adds the instanced Meshy draws of the slots the
 // list has swapped; kinst() = one instanced draw of a slot (its Meshy model when the list names one and it has loaded).
 const KW=()=>root.ConquestWorldKit.kit(S),KM=(x,y,z,ry=0,s=1)=>KW().M(x,y,z,ry,s),r2=v=>Math.round(v*100)/100,sA=(n,w=0)=>root.ConquestWorldKit.surfA(root.ConquestWorldKit.SURF[n],w);
 const kt=(Sb,X,det)=>({main:Sb,det:det||Sb,fx:X,swaps:new Map()});
 const kdone=(g,...ts)=>{for(const t of ts)for(const m of KW().swapMeshes(t.swaps,low))g.add(m);return g;};
 const kinst=(id,list,fn,o)=>{const Kk=KW(),im=Kk.instanced(id,list.length,o);list.forEach((e,i)=>Kk.setAt(im,i,fn(e,i)));im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();return im;};
 S.kinst=kinst;
 // ---------- instanced prop geometry (unit space): the kit's rock, mossy rock, crystal and fungus growths, relay mast ----------
 const billGeo=(r,col,o=0)=>{const X=new Fx();X.keep=true;X.bill(0,0,0,1,r,col,o);return keep(X.geometry());};
 const KG=(id,o)=>KW().geometry(id,o||{});
 const P={crystal:KG('crystal-growth'),fungus:KG('fungus-growth'),rock:KG('rock'),rockMoss:KG('rock-moss'),relay:KG('relay-mast'),bill:billGeo(AT.BLOB,[1,1,1]),billBio:billGeo(AT.BLOB,[.62,.12,.46])};
 S.P=P;

 // ---------- The terraformed south (Phase 2): engineered flora, forests, water, atmosphere pylons, dam, bridge, crater ----------
 // Presentation only. Every position comes from ConquestWorld (terraZone, flora, forestTrees, water, pylons, floraNodes);
 // nothing here is collision. Drive-through plants stay <= 1.5 m; only forest stands (the cover canopy) grow tall.
 MAT.water=mk(WATER_VS,WATER_FS,{},{side:T.DoubleSide});const waterWarmGeo=keep(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,0,1],3)).setAttribute('aFlow',new T.Float32BufferAttribute([0,0,1,1,0,1,0,1,1],3)));
 // Flora (the kit's nature models): hardy scrub, flower patch, fern, crystal sprout, moss cushion, burnt stump, wind-bent
 // conifer, broadleaf, dead tree and their shared far LOD, the bio-flora node, the grass clump. A few dozen triangles each:
 // they are instanced by the hundred.
 const TP={plant:KG('scrub'),flower:KG('flower-patch'),fern:KG('fern'),crystal:KG('crystal-sprout'),lichen:KG('moss-cushion'),stump:KG('burnt-stump'),tree:KG('tree-conifer'),treeBroad:KG('tree-broadleaf'),treeDead:KG('tree-dead'),treeFar:KG('tree-far'),node:KG('bio-node'),nodeDim:KG('bio-node-dim'),tuft:KG('grass-tuft')};TP.treeAutumn=TP.treeDead;
 S.TP=TP;
 // Per fine chunk: the visual flora field plus the legacy scenery 'tree' items, drawn by today's terraZone (lush/grass
 // plant, lichen cushion, a blight stump inside the war region; nothing on the far frontier). Two instanced draws at most.
 // Built by a resumable job (S.floraJob) so a chunk's world queries spread over frames under the streaming budget;
 // S.flora runs one to completion (tests, tools).
 function* floraBuild(cx,cz,legacy){const ox=cx*128,oz=cz*128,g=new T.Group(),plants=[],lichen=[],stumps=[];
  const add=(p,zone)=>{if(zone==='lush'||zone==='grass')plants.push([p,zone==='lush'?1:.62]);else if(zone==='lichen')lichen.push(p);else stumps.push(p);};
  for(const p of root.ConquestWorld.flora(cx,cz))add(p,p.zone);yield;
  for(const p of legacy){if(p.x<640||p.x>1500||p.z<900||p.z>1520)continue;add(p,root.ConquestWorld.terraZone(p.x,p.z));}
  // ground cover around each lush/grass plant (deterministic; off water and solids, on the real ground height)
  const Wd=root.ConquestWorld,tufts=[],per=1;for(const [p,k] of plants)for(let j=0,n=k===1?per:high?1:0;j<n;j++){const h=hash3(Math.round(p.x*7),Math.round(p.z*7),j+5),a=h*TAU*3,r=1.4+2.6*((h*7.31)%1),x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;
   if(Math.floor(x/128)!==cx||Math.floor(z/128)!==cz||Wd.waterAt(x,z)||Wd.solidAt(x,z)||Wd.deckAt(x,z)!==null)continue;tufts.push({x,z,y:Wd.groundAt(x,z),s:(.8+.5*((h*13.7)%1))*k,a});}
  yield;
  const inst=(id,list,fn)=>{if(!list.length)return;const im=kinst(id,list,fn);im.userData.noPick=true;g.add(im);};
  inst('scrub',plants,([p,k])=>{const sc=Math.min(1.5/1.35,(.75+.45*p.size))*k;return M(p.x-ox,p.y-.04,p.z-oz,0,p.variant*40,0,sc,sc,sc);});
  inst('moss-cushion',lichen,p=>M(p.x-ox,p.y-.02,p.z-oz,0,p.variant*40,0,.8+.9*p.size,1,.8+.9*p.size));
  if(stumps.length)inst('burnt-stump',stumps,p=>M(p.x-ox,p.y-.05,p.z-oz,0,p.variant*40,0,1,.8+.4*p.size,1));
  // dense clump field (noise-driven: ~45% grass cover in the wild, sparser toward the frontier); ferns by water; rare crystals
  const ferns=[],crys=[],flowers=[],step=high?4.6:7;let cells=0;for(let gx=0;gx<128;gx+=step)for(let gz=0;gz<128;gz+=step){if(++cells%24===0)yield;const h=hash3(cx*977+Math.round(gx*3),cz*613+Math.round(gz*3),11),x=ox+gx+(h-.5)*step,z=oz+gz+(((h*7.31)%1)-.5)*step;
   const tf=Wd.terraformAt(x,z);if(tf<.06)continue;const cover=.5+.5*Math.sin(x*.045+Math.sin(z*.03)*2)*Math.cos(z*.05),dc=Math.hypot(x-1130,z-1125);if(((h*13.7)%1)>(.2+.8*cover)*(dc<220?.8:.68))continue;
   if(Wd.waterAt(x,z)||Wd.solidAt(x,z)||Wd.deckAt(x,z)!==null||Wd.clearedAt(x,z)||Wd.forestAt(x,z)?.core)continue;const y=Wd.groundAt(x,z),r=(h*29.3)%1;
   if(r<.03)crys.push({x,z,y,a:h*40});else if(Wd.creekNearest&&Wd.creekNearest(x,z).d<14&&r<.5)ferns.push({x,z,y,a:h*40,s:.8+.6*((h*3.7)%1)});else if(r<(dc<170?.08:cover>.6?.07:.015))flowers.push({x,z,y,a:h*40});else tufts.push({x,z,y,s:.7+.8*((h*5.3)%1),a:h*40});}
  inst('grass-tuft',tufts,p=>M(p.x-ox,p.y-.03,p.z-oz,0,p.a,0,p.s,p.s*(.8+.5*((p.a*.37)%1)),p.s));if(tufts.length)g.userData.tufts=g.children[g.children.length-1];
  inst('fern',ferns,p=>M(p.x-ox,p.y-.03,p.z-oz,0,p.a,0,p.s,p.s,p.s));if(high){inst('crystal-sprout',crys,p=>M(p.x-ox,p.y-.05,p.z-oz,0,p.a,0,1,1,1));inst('flower-patch',flowers,p=>M(p.x-ox,p.y-.03,p.z-oz,0,p.a,0,1,1,1));}
  return g;}
 S.floraJob=(cx,cz,legacy=[])=>{const it=floraBuild(cx,cz,legacy);let result=null;return {step(deadline,clock){do{const r=it.next();if(r.done){result=r.value;return true;}}while(clock()<deadline);return false;},get result(){return result;}};};
 S.flora=(cx,cz,legacy=[])=>{const j=S.floraJob(cx,cz,legacy);j.step(Infinity,()=>0);return j.result;};
 // Ground flora is <= 1.5 m: per fine chunk it is hidden beyond a distance (tufts sooner), measured from the hull.
 const FLORA_RANGE=high?180:150,TUFT_RANGE=high?150:100;
 S.floraCull=(chunks,p)=>{for(const c of chunks){const g=c.group.userData.flora;if(!g)continue;const d=Math.hypot(c.cx*128+64-p.x,c.cz*128+64-p.z);g.visible=d<FLORA_RANGE;if(g.userData.tufts)g.userData.tufts.visible=d<TUFT_RANGE;}};
 // Once per view: forests, water, pylons + domes, the dam, the creek bridge, the ice-mining crater and the bio-flora nodes,
 // in WORLD coordinates (the view moves the group by the floating origin). update(t, harvested) re-tints the nodes.
 const FLORA_LOD=high?80:55,ringG=keep(new T.TorusGeometry(1,.065,4,high?24:16));// m beyond a forest stand's edge where its trees switch to the far LOD
 S.terraWorld=()=>{const Wd=root.ConquestWorld,Wa=Wd.water,g=new T.Group(),Sb=new Bld(),X=new Fx(),tk=kt(Sb,X),Kk=KW(),domes=[];g.name='cq-terraformed-south';
  // forests: per stand a detailed and a far (LOD) instanced draw; update() shows one of them by camera distance
  const stands=Wd.forests.map((f,si)=>{const trees=Wd.forestTrees(f),lod={f,near:null,far:null,near2:null};if(!trees.length)return lod;
   const draw=(id,list)=>{const im=kinst(id,list,p=>{const k=p.size*.75*(p.edge?.85:1);return M(p.x,p.y-.1,p.z,(p.variant-.5)*.16,-.85+p.variant*.5,0,k,k*(.85+.3*p.variant),k);});im.userData.noPick=true;g.add(im);return im;};
   const conShare=[.55,.75,.3,.35,.5][si%5],con=trees.filter(p=>p.variant<conShare),broad=trees.filter(p=>p.variant>=conShare);
   lod.near=draw('tree-conifer',con);lod.near2=draw(si===0||si===4?'tree-dead':'tree-broadleaf',broad);lod.far=draw('tree-far',trees);lod.far.visible=false;return lod;});
  // water: creek ribbon + reservoir + crater pool, one merged geometry and one draw
  const Pw=[],Fw=[],Iw=[];const quad=(a,b,c,d)=>Iw.push(a,b,c,a,c,d);
  // the shoreline: metres from the middle of the water to where the ground rises through the surface (the shader draws the bank there)
  const shore=(x,z,dx,dz,h,y)=>{for(let d=.6;d<h;d+=.3)if(Wd.groundAt(x+dx*d,z+dz*d)>=y)return d;return h;};
  {const c=Wa.creek,pts=[];for(let i=1;i<c.length;i++){const [ax,az]=c[i-1],[bx,bz]=c[i],l=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(l/2));for(let k=i===1?0:1;k<=n;k++){const u=k/n;pts.push([ax+(bx-ax)*u,az+(bz-az)*u]);}}
   let run=0;pts.forEach(([x,z],i)=>{const [px,pz]=pts[Math.max(0,i-1)],[nx,nz]=pts[Math.min(pts.length-1,i+1)],tx=nx-px,tz=nz-pz,l=Math.hypot(tx,tz)||1,ux=-tz/l,uz=tx/l,y=Wd.waterTopAt(x,z);if(i)run+=Math.hypot(x-px,z-pz);
    const k=Pw.length/3;for(const s of [-1,1]){const h=Wa.half+.25,v=shore(x,z,ux*s,uz*s,h,y);Pw.push(x+ux*h*s,y,z+uz*h*s);Fw.push(run+.001,s*h/v,v);}if(i)quad(k-2,k-1,k+1,k);});}
  const disc=(x,z,rx,rz,y,clipZ=Infinity)=>{const k=Pw.length/3,n=high?48:28;Pw.push(x,y,z);Fw.push(0,0,(rx+rz)/2);for(let i=0;i<=n;i++){const a=i/n*TAU,c=Math.cos(a),sn=Math.sin(a),R=Math.hypot(c*rx,sn*rz),v=shore(x,z,c*rx/R,sn*rz/R,R,y);Pw.push(x+c*rx,y,Math.min(clipZ,z+sn*rz));Fw.push(0,R/v,v);}for(let i=1;i<=n;i++)Iw.push(k,k+i+1,k+i);};
  disc(Wa.lake.x,Wa.lake.z,Wa.lake.rx+1,Wa.lake.rz+1,Wa.lake.surface,Wa.dam.z-Wa.dam.depth/2);disc(Wa.crater.x,Wa.crater.z,Wa.crater.pool+.6,Wa.crater.pool+.6,Wd.waterTopAt(Wa.crater.x,Wa.crater.z));
  {const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(Pw,3));geo.setAttribute('aFlow',new T.Float32BufferAttribute(Fw,3));geo.setIndex(Iw);geo.computeBoundingSphere();const m=new T.Mesh(geo,MAT.water);m.userData.noPick=true;m.name='cq-water';g.add(m);}
  // atmosphere pylons (the kit's atmo-pylon); dome pylons carry a low atmosphere shell
  for(const p of Wd.pylons){const y=ground(p.x,p.z);Kk.place('atmo-pylon',tk,KM(p.x,y,p.z),{});if(p.dome)domes.push([p.x,y,p.z]);}
  // the terraformers' dam across the reservoir outlet (the reservoir is on its -z side), with the spillway glow on the water
  {const d=Wa.dam,cx=(d.x0+d.x1)/2;let lo=Infinity;for(let x=d.x0;x<=d.x1;x+=3)lo=Math.min(lo,ground(x,d.z));const top=Wa.lake.surface+1.6;
   Kk.place('dam',tk,KM(cx,lo,d.z),{w:d.x1-d.x0,h:r2(top-lo),d:d.depth});if(high)X.flat(cx,Wa.lake.surface+.05,d.z-d.depth/2-1.2,(d.x1-d.x0)*.45,2.6,AT.BLOB,E(0x5cf2ff,.35));}
  // the creek bridge: its deck is built on the drive surface's own heights (ConquestWorld.deckAt along the span)
  {const b=Wd.creekBridge,n=12,ys=[];for(let i=0;i<=n;i++){const s=-b.half+i*2*b.half/n,x=b.x+b.ax*s,z=b.z+b.az*s;ys.push(Wd.deckAt(x,z)??ground(x,z));}const y0=Math.min(ys[0],ys[n]);
   Kk.place('creek-bridge',tk,KM(b.x,y0,b.z,Math.atan2(-b.az,b.ax)),{w:b.half*2,d:b.width*2,prof:ys.map(y=>r2(y-y0))});}
  // the ice-mining crater: cut ice blocks around the meltwater pool, the drilling rig and its outflow pipe
  {const k=Wa.crater,y0=ground(k.x,k.z),nI=high?12:8;for(let i=0;i<nI;i++){const a=i/nI*TAU+.2,r=k.pool+2.5+(i%3),x=k.x+Math.cos(a)*r,z=k.z+Math.sin(a)*r;Kk.place('ice-block',tk,KM(x,ground(x,z)-.2,z,a),{w:r2(2+(i%4)*.3),h:r2(2+(i%3)*.8),d:2.2,seed:i%5});}
   const rx=k.x-k.pool-4,rz=k.z-2,ry=ground(rx,rz);Kk.place('ice-rig',tk,KM(rx,ry,rz,Math.atan2(k.x-rx,k.z-rz)),{});
   const pb=Kk.part({aoMin:1});pb.pipe([[rx+1.4,ry+.9,rz+.6],[(rx+k.x)/2-1,(ry+y0)/2+1.1,(rz+k.z)/2],[k.x-k.pool+1.2,y0+.35,k.z]],.26,Kk.pal.mil.bare,{n:high?6:4});Kk.emit(tk,pb,new T.Matrix4());}
  // rocks in the stream: wet mossy boulders along the creek, the odd one mid-current
  {const c=Wa.creek;for(let i=1;i<c.length;i++){const [ax,az]=c[i-1],[bx,bz]=c[i],L=Math.hypot(bx-ax,bz-az),nx=-(bz-az)/L,nz=(bx-ax)/L;for(let u=4;u<L;u+=9){const side=((i*7+u)%3)-1,o=side*(Wa.half-.6)+((u*13)%5-2)*.3,x=ax+(bx-ax)*u/L+nx*o,z=az+(bz-az)*u/L+nz*o,sz=.5+((i*3+u)%4)*.22;Kk.place('rock-moss',tk,M(x,Wd.waterTopAt(x,z)-.05,z,0,u,0,sz*1.2,sz*.7,sz),{seed:(i+u)%4});}}}
  // fords: stepping stones across the creek
  for(const f of Wa.fords)for(let i=0;i<7;i++){const a=i*2.4,r=1.2+(i%3)*1.7,x=f.x+Math.cos(a)*r,z=f.z+Math.sin(a)*r;Kk.place('rock-moss',tk,M(x,ground(x,z)+.18,z,0,a,0,.9,.4,.7),{seed:i%4});}
  g.add(Sb.mesh());if(X.n)g.add(fxMesh(X.geometry()));kdone(g,tk);
  if(domes.length){const dB=new Bld();for(const [x,y,z] of domes)dB.add(G.dome,M(x,y-.5,z,0,0,0,9,7,9),K.cyan,0);const dm=new T.Mesh(dB.geometry(),MAT.field);dm.renderOrder=3;dm.userData.noPick=true;g.add(dm);}
  // bio-flora nodes: ready (bright, haloed) and regrowing (dim) — rebuilt only when a node changes state
  const nodes=new T.Group();nodes.name='cq-bio-flora';g.add(nodes);let key='';
  g.userData.lod=(cam)=>{if(!cam)return;const cx=cam.position.x-g.position.x,cz=cam.position.z-g.position.z;
   for(const L of stands)if(L.near){const far=Math.hypot(cx-L.f.x,cz-L.f.z)-L.f.r>FLORA_LOD;L.near.visible=L.near2.visible=!far;L.far.visible=far;}};
  let lastH,nextH=0;g.userData.update=(harvest,now)=>{if(harvest===lastH&&now<nextH)return;lastH=harvest;nextH=now+500;   // re-key only on new state or twice a second
   const ready=Wd.floraNodes.filter(n=>!(harvest?.[n.id]>now)),k=ready.map(n=>n.id).join();if(k===key)return;key=k;for(const c of [...nodes.children]){nodes.remove(c);if(c.isInstancedMesh)c.dispose();}
   const dim=Wd.floraNodes.filter(n=>!ready.includes(n)),put=(id,list)=>{if(!list.length)return;const im=kinst(id,list,n=>M(n.x,ground(n.x,n.z)-.05,n.z,0,(n.x*.37)%TAU,0,1.25,1.25,1.25));im.userData.noPick=true;nodes.add(im);};
   put('bio-node',ready);put('bio-node-dim',dim);if(high&&ready.length){const im=new T.InstancedMesh(P.billBio,MAT.fx,ready.length);ready.forEach((n,i)=>im.setMatrixAt(i,M(n.x,ground(n.x,n.z)+1.1,n.z,0,0,0,1.9,1.9,1.9)));   // the pods' own pink, no wider than the plant (a big white glow bleached the pods to white-green: critic round 3)
   im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.renderOrder=2;im.userData.noPick=true;nodes.add(im);}};
  g.userData.update(null,0);return g;};

 // ---------- Phase 3: mineral deposits and the Meteor Strike (docs/economy/RESOURCE_ECONOMY.md §5) ----------
 // Presentation only: the pilot's scanned veins (ConquestWorld.knownOre: ore left, or EXHAUSTED for a few minutes), and the
 // shared strike schedule (ConquestCombat.meteorStrike). One instanced draw per mineral look, rebuilt only on state change.
 // the kit's deposits: Ferrite Regolith, Ilmenite, Armalcolite, Tranquillityite, the starter vein, a spent mound; the falling meteor and the crater it leaves
 const ORE_SLOT={fe:'ore-fe',il:'ore-il',ar:'ore-ar',tq:'ore-tq',starter:'ore-starter',dim:'ore-spent'},ML={fe:KG('ore-fe'),il:KG('ore-il'),ar:KG('ore-ar'),tq:KG('ore-tq'),starter:KG('ore-starter'),dim:KG('ore-spent'),meteor:KG('meteor'),crater:KG('strike-crater')};
 S.ML=ML;
 S.mineralWorld=()=>{const Wd=root.ConquestWorld,g=new T.Group(),dep=new T.Group();g.name='cq-minerals';g.add(dep);let key='';
  const one=id=>kinst(id,[0],()=>new T.Matrix4()),meteor=one('meteor'),crater=one('strike-crater');meteor.visible=crater.visible=false;meteor.userData.noPick=crater.userData.noPick=true;g.add(meteor,crater);
  let lastS,nextS=0;g.userData.update=(s,now)=>{if(s!==lastS||now>=nextS){lastS=s;nextS=now+500;   // deposits re-key only on new state or twice a second; the strike animates every frame
   const ore=Wd.knownOre(s,now),list=ore.map(o=>o.d),state=ore.map(o=>o.ready?0:1),k=list.map((d,i)=>d.id+state[i]).join();
   if(k!==key){key=k;for(const c of [...dep.children]){dep.remove(c);c.dispose?.();}const by={};list.forEach((d,i)=>{if(state[i]<0)return;const look=state[i]?'dim':d.m;(by[look]||(by[look]=[])).push(d);});
    for(const [look,L] of Object.entries(by)){const im=kinst(ORE_SLOT[look]||'ore-fe',L,d=>M(d.x,ground(d.x,d.z)-.1,d.z,0,(d.x*.13)%TAU,0,1.3,1.3,1.3));im.userData.noPick=true;dep.add(im);}}}
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
  // Settlers and the military are two peoples (owner, Nov 8): civilian homes, halls, shops, barns, towers, greenhouses and
  // silos are the kit's settler models (weathered paint, patched scrap, timber, amber light, things left lying about); the
  // frontier wall, its watchtowers and gates are military (gunmetal armour, pale plates, cyan light). Every model stays
  // inside its lot's collision footprint; a lot on a slope gets a field-stone footing down to its lowest corner.
  const Kk=KW(),PS=Kk.pal.set,lampFx=new Fx(),districts={core:{m:new Bld(),d:new Bld()},farm:{m:new Bld(),d:new Bld()},wall:{m:new Bld(),d:new Bld()}},TG={},DT={},rotors=[];
  for(const k of Object.keys(districts)){TG[k]=kt(districts[k].m,lampFx,districts[k].d);DT[k]=kt(districts[k].d,lampFx,districts[k].d);}   // DT: small props go wholly into the detail batch (it drops out with distance)
  const dist=l=>l.k==='wall'||l.k==='watch'||l.k==='gate'?'wall':['greenhouse','silo','turbine','solar'].includes(l.k)?'farm':'core';
  const SLOT={hab:'settler-home',block:'settler-block',shop:'settler-shop',hangar:'settler-barn',tower:'settler-water-tower',greenhouse:'settler-greenhouse',silo:'settler-silo',turbine:'settler-turbine',solar:'settler-solar',pad:'settler-plaza',wall:'frontier-wall',watch:'frontier-watch',gate:'frontier-gate'};
  const plazaL=CO.lots.find(l=>l.k==='pad'),hall=plazaL?CO.lots.filter(l=>l.k==='block').sort((p2,q)=>Math.hypot(p2.x-plazaL.x,p2.z-plazaL.z)-Math.hypot(q.x-plazaL.x,q.z-plazaL.z))[0]:null,homes=[],works=[];
  for(const l of CO.lots){const settler=dist(l)!=='wall',hh=Math.abs(Math.round(l.x*7+l.z*13)),tg=TG[dist(l)],y0=ground(l.x,l.z)-.05,c=Math.cos(l.r),s=Math.sin(l.r),id=l.k==='block'&&l===hall?'settler-hall':SLOT[l.k];if(!id)continue;
   if(settler&&['hab','block','shop'].includes(l.k))homes.push(l);if(settler&&['shop','hangar','greenhouse','silo'].includes(l.k))works.push(l);
   let lo=y0;for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]])lo=Math.min(lo,ground(l.x+a*l.w/2*c-b*l.d/2*s,l.z+a*l.w/2*s+b*l.d/2*c));const sink=r2(Math.min(6,y0-lo+.6));
   let ry=-l.r;if(!settler&&(1150-l.x)*-s+(1160-l.z)*c>0)ry+=Math.PI;   // the wall's outer face (+z of its models) looks away from the colony
   if(settler&&l.k!=='pad'&&sink>.75){const fb=Kk.part();fb.loft([{p:Kk.rect(l.w+.5,l.d+.5),y:-sink},{p:Kk.rect(l.w+.3,l.d+.3),y:-.3}],PS.stone,{top:false});Kk.emit(tg,fb,KM(l.x,y0,l.z,ry));}
   Kk.place(id,tg,KM(l.x,y0,l.z,ry),settler?{w:l.w,d:l.d,h:r2(l.h),seed:hh%97}:{w:l.w,d:l.d,h:r2(l.h),sink:Math.max(1,sink)});
   if(l.k==='turbine')rotors.push([l.x-1.5*s,0,l.z+1.5*c,y0+l.h,l.r]);}
  // livestock pens in the corner of some fields (open ground; fences and animals are decoration)
  const pens=[];for(const f of CO.fields){if(Math.abs(Math.round(f.x*3+f.z))%3)continue;const c=Math.cos(f.r),s2=Math.sin(f.r),pw=Math.min(14,f.w*.4),pd=Math.min(10,f.d*.45),ox=f.w/2-pw/2-1,oz=f.d/2-pd/2-1,cx=f.x+ox*c-oz*s2,cz=f.z+ox*s2+oz*c;
   Kk.place('settler-pen',DT.farm,KM(cx,ground(cx,cz),cz,-f.r),{w:r2(pw),d:r2(pd),seed:Math.abs(Math.round(f.x))%7});pens.push({x:cx,z:cz,hw:pw/2-1.2,hd:pd/2-1.2,r:f.r});}
  // roads: cracked paving on the terrain with amber edge strips and dashed lane marks, rutted dirt tracks (bridge sections ride the deck)
  const RB=new Bld(),asphalt=lin(0x24282e),edge=lin(0xffa84a),dash=lin(0xe8e2c8),dirtC=lin(0x5e4a36),rutC=lin(0x3a2c20),lamps=[],aAs=sA('concrete',.7),aDirt=sA('dirt',0);
  for(const r of CO.roads){const pts=[];for(let i=1;i<r.pts.length;i++){const [a,b]=[r.pts[i-1],r.pts[i]],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/3));for(let k=i===1?0:1;k<=n;k++)pts.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
   const hw=r.w/2,yAt=(x,z)=>{const dk=Wd.deckAt(x,z);return dk!==null?dk+.06:ground(x,z)+.09;},paved=!!r.p;let run=0;
   for(let i=1;i<pts.length;i++){const [ax,az]=pts[i-1],[bx,bz]=pts[i],L=Math.hypot(bx-ax,bz-az)||1,nx=-(bz-az)/L,nz=(bx-ax)/L,P=(x,z,o)=>[x+nx*o,yAt(x+nx*o,z+nz*o),z+nz*o];run+=L;
    if(!paved){RB.quad(P(ax,az,-hw),P(bx,bz,-hw),P(bx,bz,hw),P(ax,az,hw),dirtC,aDirt);for(const o of [-1.6,1.6])RB.quad(P(ax,az,o-.35),P(bx,bz,o-.35),P(bx,bz,o+.35),P(ax,az,o+.35),rutC,aDirt);continue;}   // rutted dirt track
    RB.quad(P(ax,az,-hw),P(bx,bz,-hw),P(bx,bz,hw),P(ax,az,hw),asphalt,aAs);for(const s2 of [-1,1])RB.quad(P(ax,az,s2*(hw-.35)),P(bx,bz,s2*(hw-.35)),P(bx,bz,s2*(hw-.05)),P(ax,az,s2*(hw-.05)),edge,1.1);
    if(Math.floor(run/6)%2===0)RB.quad(P(ax,az,-.12),P(bx,bz,-.12),P(bx,bz,.12),P(ax,az,.12),dash,.2);
    if(i%6===0&&r.w>=8)for(const s2 of [-1,1])lamps.push([ax+nx*s2*(hw+1.2),az+nz*s2*(hw+1.2),Math.atan2(nz*s2,nx*s2)]);}}
  // hand-built street lamps: the bracket arm reaches back over the road
  for(const [x,z,a] of lamps){if(Wd.waterAt(x,z)||Wd.solidAt(x,z))continue;Kk.place('settler-lamp',DT.core,KM(x,ground(x,z),z,Math.atan2(-Math.cos(a),-Math.sin(a))),{seed:Math.abs(Math.round(x+z))%5});}
  // fields: crop rows following the ground (golden grain, green crops, dark leafy rows) between turned earth
  const FB=new Bld(),crops=[[lin(0xc2a64a),lin(0x5a4630)],[lin(0x5f9a34),lin(0x4a3a26)],[lin(0x3f7a2a),lin(0x3f3020)]],aLeaf=sA('leaf',0);
  for(const f of CO.fields){const c=Math.cos(f.r),s2=Math.sin(f.r),[cA,cB]=crops[f.c%3],L=(u,v)=>{const x=f.x+u*c-v*s2,z=f.z+u*s2+v*c;return [x,ground(x,z)+.12,z];};
   for(let v=-f.d/2;v<f.d/2;v+=1.6)for(let u=-f.w/2;u<f.w/2;u+=4){const u1=Math.min(u+4,f.w/2);FB.quad(L(u,v),L(u1,v),L(u1,v+.95),L(u,v+.95),cA,aLeaf);FB.quad(L(u,v+.95),L(u1,v+.95),L(u1,v+1.6),L(u,v+1.6),cB,aDirt);}}
  // monorail: box-girder beam spans on pylons + the moving train (railH = the rail top it rides on); power line: poles and sagging wires
  const RL=CO.rail||[],railH=(x,z)=>ground(x,z)+11.6;if(RL.length>1){for(let i=1;i<RL.length;i++){const [a,b]=[RL[i-1],RL[i]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/8);for(let k=0;k<n;k++){const x0=a[0]+(b[0]-a[0])*k/n,z0=a[1]+(b[1]-a[1])*k/n,x1=a[0]+(b[0]-a[0])*(k+1)/n,z1=a[1]+(b[1]-a[1])*(k+1)/n,ya=railH(x0,z0),yb=railH(x1,z1),L=Math.hypot(x1-x0,yb-ya,z1-z0);
     Kk.place('rail-beam',TG.core,M((x0+x1)/2,(ya+yb)/2,(z0+z1)/2,0,Math.atan2(-(z1-z0),x1-x0),Math.asin((yb-ya)/L)),{w:r2(L+.03)});}}
   for(const [x,z] of CO.railPylons)Kk.place('rail-pylon',TG.core,KM(x,ground(x,z),z),{h:11.2});}
  const PW=CO.power||[],wb=Kk.part({aoMin:1}),wire=Kk.mat(0x1c1a18,'flat');for(let i=0;i<PW.length;i++){const [x,z]=PW[i],y=ground(x,z);Kk.place('settler-pole',DT.farm,KM(x,y,z),{seed:i});
   const q=PW[i+1];if(q&&Math.hypot(q[0]-x,q[1]-z)<45){const yq=ground(q[0],q[1]);for(const o of [-1,1])wb.cable([x+o,y+8.7,z],[q[0]+o,yq+8.7,q[1]],.9,.03,wire,{n:high?5:3});}}
  Kk.emit(DT.farm,wb,new T.Matrix4());
  // the town core is the colony's largest batch by far: it is drawn by ground cell (see Bld.cells); the others stay one mesh each
  const parts=[];for(const [k,D] of Object.entries(districts)){if(k==='core'){for(const m of D.m.cells()){m.name='cq-colony-core';m.userData.noPick=true;g.add(m);}for(const dm of D.d.cells()){dm.name='cq-colony-core-detail';dm.userData.noPick=true;g.add(dm);parts.push({dm});}continue;}
   const m=D.m.mesh(),dm=D.d.mesh();m.name='cq-colony-'+k;dm.name='cq-colony-'+k+'-detail';m.userData.noPick=dm.userData.noPick=true;g.add(m,dm);parts.push({m,dm});}
  const roadsM=RB.mesh(),fieldsM=FB.mesh();roadsM.userData.noPick=fieldsM.userData.noPick=true;g.add(roadsM,fieldsM);if(lampFx.n){const sm=fxMesh(lampFx.geometry());sm.name='cq-colony-smoke';g.add(sm);}
  kdone(g,...Object.values(TG),...Object.values(DT));
  // canals: creek-fed irrigation channels in the shared water material
  if(CO.canals?.length){const Pw=[],Fw=[],Iw=[];for(const [a,b] of CO.canals){const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(L/3),nx=-(b[1]-a[1])/L,nz=(b[0]-a[0])/L;for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n,y=ground(x,z)+.15,i0=Pw.length/3;for(const o of [-1,1]){Pw.push(x+nx*o*1.1,y,z+nz*o*1.1);Fw.push(L*k/n+.001,o,1.1);}if(k)Iw.push(i0-2,i0-1,i0+1,i0-2,i0+1,i0);}}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(Pw,3));geo.setAttribute('aFlow',new T.Float32BufferAttribute(Fw,3));geo.setIndex(Iw);geo.computeBoundingSphere();const cm=new T.Mesh(geo,MAT.water);cm.userData.noPick=true;g.add(cm);}
  // moving life: rovers on the roads, settlers on their daily routines, the monorail train, turbine rotors (presentation only).
  // Each kind is the kit's model; two looks of rover, three of settler and two of livestock share the crowd.
  const dyn=(id,n,o)=>{if(!n)return null;const im=Kk.instanced(id,n,o);im.userData.noPick=true;im.frustumCulled=false;g.add(im);return im;};
  const nR=high?10:5,rovA=dyn('settler-rover',Math.ceil(nR/2),{seed:1}),rovB=dyn('settler-rover',Math.floor(nR/2),{seed:4}),rovOf=i=>i%2?[rovB,(i-1)/2]:[rovA,i/2];
  const nC=high?14:0,crew=nC?[0,1,2].map(k=>dyn('settler-person',Math.ceil((nC-k)/3),{seed:k+1})):null;
  // Terraform life (Phase 4): engineered livestock grazing in the pens (gene-band glow), birds circling over the green zones,
  // small hoppers among the bio-flora. Instanced, culled with the colony's detail.
  const nL=pens.length?Math.min(high?24:10,pens.length*(high?4:2)):0,stock=nL?[0,1].map(k=>dyn('livestock',Math.ceil((nL-k)/2),{seed:k+1})):null;
  const nBd=high?18:8,birds=dyn('bird',nBd),nH=high?12:0,hops=dyn('hopper',nH);
  const flocks=(Wd.pylons||[]).slice(0,3),floraL=(Wd.floraNodes||[]).slice(0,nH);
  // Settler daily routines (UTC clock): home overnight, fields and workshops in the morning, the market square at midday,
  // back to work, the square in the evening, then home. Each settler walks between their own anchors.
  const ROUT=[[0,'home'],[6.5,'work'],[11,'plaza'],[13,'work'],[18,'plaza'],[20.5,'home']],anchor=(i,k)=>{const L2=k==='home'?homes[i%Math.max(1,homes.length)]:k==='work'?works[(i*3+1)%Math.max(1,works.length)]:plaza;if(!L2)return [plaza.x,plaza.z];const off=k==='plaza'?8+(i%5)*2:Math.max(L2.w||6,L2.d||6)*.5+2;return [L2.x+Math.cos(i*2.4)*off,L2.z+Math.sin(i*2.4)*off];};
  const train=RL.length>1?kinst('rail-train',[0],()=>new T.Matrix4()):null;if(train){train.userData.noPick=true;train.frustumCulled=false;g.add(train);}
  const rot=rotors.length?dyn('settler-rotor',rotors.length):null;
  const paths=CO.roads.filter(r=>r.w>=8).map(r=>r.pts),plaza=CO.lots.find(l=>l.k==='pad')||{x:1120,z:1110};
  const segs=new Map(),along=(pts,t)=>{let c=segs.get(pts);if(!c){const seg=[];let L=0;for(let i=1;i<pts.length;i++){const l=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(l);L+=l;}segs.set(pts,c={seg,L});}const {seg,L}=c;let d=((t%(2*L))+2*L)%(2*L),back=d>L;if(back)d=2*L-d;for(let i=0;i<seg.length;i++){if(d<=seg[i]){const f=d/seg[i],a=pts[i],b=pts[i+1];return [a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,Math.atan2(b[1]-a[1],b[0]-a[0])+(back?Math.PI:0)];}d-=seg[i];}return [pts[0][0],pts[0][1],0];};
  const _m=new T.Matrix4(),_m2=new T.Matrix4(),_m3=new T.Matrix4(),MI=(x,y,z,ry)=>{_e.set(0,ry,0);_q.setFromEuler(_e);return _m2.compose(_p.set(x,y,z),_q,_s.set(1,1,1));},railLen=RL.length>1?RL.reduce((n,p,i)=>i?n+Math.hypot(p[0]-RL[i-1][0],p[1]-RL[i-1][1]):0,0):0;
  const upd=L=>{for(const im of L)if(im)im.instanceMatrix.needsUpdate=true;};
  g.userData.update=(now,cam)=>{const t=now/1000;
   if(cam&&Math.hypot(cam.position.x-g.position.x-1130,cam.position.z-g.position.z-1125)>(high?700:500)){for(const p of parts)p.dm.visible=false;return;}   // the colony's moving life is out of view
   for(let i=0;i<nR;i++){const P=paths[i%paths.length],[x,z,a]=along(P,t*(6+i%3)+i*57),o=2.2,[im,j]=rovOf(i);Kk.setAt(im,j,MI(x-Math.sin(a)*o,ground(x,z),z+Math.cos(a)*o,-a));}upd([rovA,rovB]);
   if(crew){const hr=(now/3600000)%24;for(let i=0;i<nC;i++){const hh2=(hr+i*.37)%24;let k=ROUT.length-1;while(k>0&&ROUT[k][0]>hh2)k--;const from=anchor(i,ROUT[(k+ROUT.length-1)%ROUT.length][1]),to=anchor(i,ROUT[k][1]),walk=Math.min(1,(hh2-ROUT[k][0])/.4);
     let x=from[0]+(to[0]-from[0])*walk,z=from[1]+(to[1]-from[1])*walk;const head=walk<1?Math.atan2(to[1]-from[1],to[0]-from[0]):i*2.4+t*.2;if(walk>=1){x+=Math.cos(t*.3+i)*1.2;z+=Math.sin(t*.3+i)*1.2;}Kk.setAt(crew[i%3],Math.floor(i/3),MI(x,ground(x,z),z,-head));}upd(crew);}
   if(stock){for(let i=0;i<nL;i++){const pn=pens[i%pens.length],a=t*.05+i*1.7,u=Math.cos(a+i)*pn.hw*.8,v=Math.sin(a*.7+i*2)*pn.hd*.8,c=Math.cos(pn.r),sn=Math.sin(pn.r),x=pn.x+u*c-v*sn,z=pn.z+u*sn+v*c;Kk.setAt(stock[i%2],Math.floor(i/2),MI(x,ground(x,z),z,-(a+pn.r)));}upd(stock);}
   for(let i=0;i<nBd;i++){const f2=flocks[i%Math.max(1,flocks.length)]||plaza,r=40+(i%6)*6,a=t*(.12+.01*(i%3))+i*.35,x=f2.x+Math.cos(a)*r,z=f2.z+Math.sin(a)*r;_m.makeRotationY(-a-Math.PI/2);_m.setPosition(x,ground(x,z)+32+(i%4)*3+Math.sin(t*2+i)*.6,z);_m3.makeRotationZ(Math.sin(t*9+i)*.4);_m.multiply(_m3);Kk.setAt(birds,i,_m);}birds.instanceMatrix.needsUpdate=true;
   if(hops){for(let i=0;i<nH;i++){const fl=floraL[i%Math.max(1,floraL.length)]||plaza,a=t*.4+i,x=fl.x+Math.cos(a)*4,z=fl.z+Math.sin(a*1.3)*4,hopY=Math.abs(Math.sin(t*4+i))*.6;Kk.setAt(hops,i,MI(x,ground(x,z)+hopY,z,-a));}hops.instanceMatrix.needsUpdate=true;}
   if(railLen&&train){const [x,z,a]=along(RL,t*14);train.position.set(x,railH(x,z),z);train.rotation.set(0,-a,0);}
   if(rot){rotors.forEach(([x,ry,z,yy,r],i)=>{Kk.setAt(rot,i,_m.makeRotationY(-r).premultiply(_m2.makeTranslation(x,yy,z)).multiply(_m3.makeRotationZ(t*1.6+i)));});rot.instanceMatrix.needsUpdate=true;}   // the rotor turns about its own axis (the nacelle's nose, +z)
   if(cam){const cx=cam.position.x-g.position.x,cz=cam.position.z-g.position.z,far=high?260:160;for(const p of parts){const bs=p.dm.geometry?.boundingSphere;if(bs)p.dm.visible=Math.hypot(cx-bs.center.x,cz-bs.center.z)-bs.radius<far;}}};
  g.userData.update(0,null);return g;};
 // ---------- frontier dressing (owner art direction): the war-torn edge the colonists hold ----------
 // Decoration only (no collision; gameplay solids come from ConquestWorld): half-overgrown tank wrecks, burnt stumps,
 // sandbag lines and trenches behind the wall, barbed wire beyond it, a rusted pipeline from the ice-mining crater to town,
 // fences around the fields and abandoned machinery. Grit grows with distance from the core. One main draw plus four detail
 // draws (wire, posts, fences) that drop out with distance.
 S.frontierWorld=()=>{const Wd=root.ConquestWorld,CO=Wd.COLONY,g=new T.Group();g.name='cq-frontier';if(!CO)return g;
  const Kk=KW(),B=new Bld(),X=new Fx(),tB=kt(B,X),wrecks=[],quads=[0,1,2,3].map(()=>new Bld()),TQ=quads.map(q=>kt(q,X,q)),Q=(x,z)=>TQ[(x<1100?0:1)+(z<1150?0:2)],mud=lin(0x2a2018),aDirt=sA('dirt',0),
   rd=(x,z)=>{let d=1e9;for(const r of CO.roads)for(let i=1;i<r.pts.length;i++){const a=r.pts[i-1],b=r.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L));d=Math.min(d,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)-r.w/2);}return d;},
   free=(x,z,r=3)=>!Wd.waterAt(x,z)&&!Wd.solidAt(x,z)&&Wd.deckAt(x,z)===null&&!Wd.forestAt(x,z)?.core&&!Wd.colonyLotAt(x,z)&&rd(x,z)>r&&!Wd.deposits.some(d=>Math.hypot(d.x-x,d.z-z)<8)&&!Wd.floraNodes.some(d=>Math.hypot(d.x-x,d.z-z)<8);
  // tank wrecks, half-overgrown, scattered through the war band (denser away from the core)
  for(let cx=760;cx<1360;cx+=70)for(let cz=900;cz<1420;cz+=70){const h=hash3(cx,cz,77),x=cx+35+(h-.5)*50,z=cz+35+(((h*7.1)%1)-.5)*50,tf=Wd.terraformAt(x,z),dc=Math.hypot(x-1130,z-1125);if(tf<.05||tf>.75||dc<170||((h*13.3)%1)>.45||!free(x,z,6))continue;
   Kk.place('tank-wreck',tB,KM(x,ground(x,z)-.12,z,-h*40),{seed:Math.floor(h*89)%6});wrecks.push([x,z]);}
  // burnt stumps through the band
  for(let i=0;i<70;i++){const h=hash3(i,13,5),x=780+h*560,z=920+((h*7.7)%1)*480,tf=Wd.terraformAt(x,z);if(tf<.05||tf>.6||Math.hypot(x-1130,z-1125)<160||!free(x,z,2))continue;Kk.place('burnt-stump',tB,M(x,ground(x,z)-.05,z,0,h*40,0,1.4,1.2+((h*3.3)%1),1.4),{});}
  // behind each wall run: a sandbag line and a trench; beyond it: barbed wire on leaning posts
  for(const l of CO.lots.filter(l=>l.k==='wall')){const c=Math.cos(l.r),sn=Math.sin(l.r),nx=-sn,nz=c,inward=Math.sign((1150-l.x)*nx+(1160-l.z)*nz)||1,nb=Math.max(1,Math.floor(l.w/4));
   for(let k=0;k<nb;k++){const u=(k-(nb-1)/2)*4,o=inward*4.3,x=l.x+u*c+nx*o,z=l.z+u*sn+nz*o;if(!Wd.solidAt(x,z))Kk.place('sandbags',tB,KM(x,ground(x,z),z,-l.r),{w:4,seed:k%3});}
   for(let u=-l.w/2;u<=l.w/2;u+=1.1){const to=inward*7,tx=l.x+u*c+nx*to,tz=l.z+u*sn+nz*to,ty=ground(tx,tz);if(!Wd.solidAt(tx,tz))B.quad([tx-c*.6-nx,ty+.06,tz-sn*.6-nz],[tx+c*.6-nx,ty+.06,tz+sn*.6-nz],[tx+c*.6+nx,ty+.06,tz+sn*.6+nz],[tx-c*.6+nx,ty+.06,tz-sn*.6+nz],mud,aDirt);}
   const wo=-inward*9,D=Q(l.x,l.z);for(let u=-l.w/2-6;u+3<=l.w/2+6;u+=3){const x=l.x+(u+1.5)*c+nx*wo,z=l.z+(u+1.5)*sn+nz*wo;Kk.place('barbed-wire',D,KM(x,ground(x,z),z,-l.r),{w:3,seed:Math.round(u)&3});}}
  // rusted pipeline beside the bridge road, from the ice-mining crater toward town
  {const pts=[[918,1171],[950,1172],[975,1171],[996,1158],[1000,1132]];for(let i=1;i<pts.length;i++){const [a,b]=[pts[i-1],pts[i]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/6);for(let k=0;k<n;k++){const x0=a[0]+(b[0]-a[0])*k/n,z0=a[1]+(b[1]-a[1])*k/n,x1=a[0]+(b[0]-a[0])*(k+1)/n,z1=a[1]+(b[1]-a[1])*(k+1)/n;if(Wd.solidAt(x0,z0)||Wd.waterAt(x0,z0))continue;const y0=ground(x0,z0)+.1,y1=ground(x1,z1)+.1,L=Math.hypot(x1-x0,y1-y0,z1-z0);
    Kk.place('pipeline',tB,M((x0+x1)/2,(y0+y1)/2,(z0+z1)/2,0,Math.atan2(-(z1-z0),x1-x0),Math.asin((y1-y0)/L)),{w:r2(L+.04),sink:1.2});}}}
  // post-and-rail fences around the fields
  for(const f of CO.fields){const c=Math.cos(f.r),sn=Math.sin(f.r),P=(u,v)=>[f.x+u*c-v*sn,f.z+u*sn+v*c],D=Q(f.x,f.z),cor=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>P(a*(f.w/2+1.5),b*(f.d/2+1.5)));
   for(let e=0;e<4;e++){const [a,b]=[cor[e],cor[(e+1)%4]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4);for(let k=0;k<n;k++){if(e===0&&k===1)continue;const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n,x2=a[0]+(b[0]-a[0])*(k+1)/n,z2=a[1]+(b[1]-a[1])*(k+1)/n,y=ground(x,z),y2=ground(x2,z2),L=Math.hypot(x2-x,y2-y,z2-z);
     Kk.place('settler-fence',D,M((x+x2)/2,(y+y2)/2,(z+z2)/2,0,Math.atan2(-(z2-z),x2-x),Math.asin((y2-y)/L)),{w:r2(L),seed:(e*7+k)%8});}}}
  // abandoned machinery: a rusted crane and drill machines at the crater and the north frontier
  for(const [x,z,k] of [[905,1165,0],[1092,1060,1],[1240,1110,1],[972,1080,0]]){if(!free(x,z,3))continue;Kk.place(k===0?'crane-wreck':'drill-wreck',tB,KM(x,ground(x,z)-.1,z,k?.4:(x*.01)%TAU),{});}
  const m=B.mesh();m.userData.noPick=true;m.name='cq-frontier-main';g.add(m);const ds=quads.map((q,i)=>{const d=q.mesh();d.userData.noPick=true;d.name='cq-frontier-detail-'+i;g.add(d);return d;});if(X.n)g.add(fxMesh(X.geometry()));kdone(g,tB,...TQ);g.userData.wrecks=wrecks;
  g.userData.update=cam=>{if(!cam)return;const cx=cam.position.x-g.position.x,cz=cam.position.z-g.position.z,far=high?230:140;for(const d of ds){const bs=d.geometry?.boundingSphere;if(bs)d.visible=Math.hypot(cx-bs.center.x,cz-bs.center.z)-bs.radius<far;}};return g;};
 // ---------- the atmosphere boundary: a shimmering veil where the zone ends (contour of ConquestWorld.terraformAt) ----------
 S.atmoVeil=()=>{const Wd=root.ConquestWorld,step=high?10:16,x0=600,z0=860,nx=Math.ceil(940/step),nz=Math.ceil(700/step),th=.06,v=(i,j)=>Wd.terraformAt(x0+i*step,z0+j*step)-th,P=[],Q=[],I=[];
  const seg=(a,b)=>{const n=P.length/3,H=60,lean=10,c=[1150,1160],ia=Math.hypot(c[0]-a[0],c[1]-a[1])||1,ib=Math.hypot(c[0]-b[0],c[1]-b[1])||1,ya=ground(a[0],a[1])-2,yb=ground(b[0],b[1])-2;
   P.push(a[0],ya,a[1],b[0],yb,b[1],b[0]+(c[0]-b[0])/ib*lean,yb+H,b[1]+(c[1]-b[1])/ib*lean,a[0]+(c[0]-a[0])/ia*lean,ya+H,a[1]+(c[1]-a[1])/ia*lean);const L=Math.hypot(b[0]-a[0],b[1]-a[1]);Q.push(0,0,L,0,L,1,0,1);I.push(n,n+1,n+2,n,n+2,n+3);};
  const lerp=(p,q,a,b)=>{const t=a/(a-b);return [p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];};
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const c=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(([a,b])=>[x0+a*step,z0+b*step,v(a,b)]),e=[];for(let k=0;k<4;k++){const p=c[k],q=c[(k+1)%4];if(p[2]>0!==q[2]>0)e.push(lerp(p,q,p[2],q[2]));}if(e.length===2)seg(e[0],e[1]);else if(e.length===4){seg(e[0],e[1]);seg(e[2],e[3]);}}
  const nV=P.length/3,geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('uv',new T.Float32BufferAttribute(Q,2));
  geo.setAttribute('aCol',new T.Float32BufferAttribute(new Float32Array(nV*4).map((_,i)=>i%4===3?-1:1),4));geo.setAttribute('aBill',new T.Float32BufferAttribute(new Float32Array(nV*3),3));geo.setIndex(I);geo.computeBoundingSphere();
  const m=new T.Mesh(geo,MAT.fx);m.renderOrder=4;m.frustumCulled=false;m.userData.noPick=true;m.name='cq-atmosphere-veil';return m;};

 // ---------- sky + lights ----------
 S.environment=(scene,renderer,o)=>{   // o.guest: a second scene (the Home Sector) shares the sky and lights but never takes over the world's atmosphere
  if(renderer){renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=low?1.25:1.2;renderer.outputColorSpace=T.SRGBColorSpace;}
  scene.background=new T.Color(0);scene.fog=new T.Fog(0x06070f,900,2600);if(!o?.guest)S.atmoScene={scene,renderer};
  const hemi=new T.HemisphereLight(0x3a5a9c,0x16131f,1.5),sun=new T.DirectionalLight(0xe4ecff,2.9),rim=new T.DirectionalLight(0x52c6ff,1.25);sun.position.copy(sunDir).multiplyScalar(500);rim.position.copy(rimDir).multiplyScalar(500);scene.add(hemi,sun,rim);
  let g=o?.guest?S.guestSkyGeo:null;if(!g){const Pp=[],B=[],A=[],I=[],dome=new T.SphereGeometry(1,high?48:32,high?24:16),dp=dome.attributes.position;
  for(let i=0;i<dp.count;i++){const x=dp.getX(i),y=dp.getY(i),z=dp.getZ(i);Pp.push(x,y,z);B.push(0,0,0);const gal=Math.exp(-Math.pow(x*.35+y*.55-z*.76,2)*7),nb=Math.max(0,fbm3(x*2.3+3,y*2.3,z*2.3,4)-.44),up=clamp01(y*3+.1);
   A.push((.02*nb+.0035*gal)*up,(.006*nb+.003*gal)*up,(.05*nb+.007*gal)*up,0);}
  if(!software)for(let k=0;k<dome.index.count;k++)I.push(dome.index.getX(k));dome.dispose();let n=dp.count,seed=1337;const rnd=()=>(seed=(Math.imul(seed,1664525)+1013904223)|0,(seed>>>0)/4294967296);
  for(let s=0,count=high?950:380;s<count;s++){let x,y,z,l;do{x=rnd()*2-1;y=rnd()*2-1;z=rnd()*2-1;l=x*x+y*y+z*z;}while(l>1||l<.01);l=Math.sqrt(l);x/=l;y/=l;z/=l;if(y<.04){y=.04+Math.abs(y)*.9;const k=Math.hypot(x,y,z);x/=k;y/=k;z/=k;}
   const big=rnd()<.035,sz=big?4.6+rnd()*2.6:1.05+rnd()*rnd()*2.3,b=big?1.7:.3+rnd()*rnd()*1.35,t=rnd(),c=t<.2?[.72,.86,1.25]:t<.3?[1.2,.92,.72]:[1,1,1];
   for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){Pp.push(x,y,z);B.push(cx,cy,1);A.push(c[0]*b,c[1]*b,c[2]*b,sz);}I.push(n,n+1,n+2,n,n+2,n+3);n+=4;}
  for(const [cx,cy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){Pp.push(0,1,0);B.push(cx,cy,2);A.push(0,0,0,0);}I.push(n,n+1,n+2,n,n+2,n+3);
  g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Pp,3));g.setAttribute('aBill',new T.Float32BufferAttribute(B,3));g.setAttribute('aCol',new T.Float32BufferAttribute(A,4));g.setIndex(I);keep(g);if(o?.guest)S.guestSkyGeo=g;}   // guest scenes share one sky geometry (it is pinned in S.shared)
  const sky=new T.Mesh(g,MAT.sky);sky.frustumCulled=false;sky.renderOrder=1000;/* after opaque terrain/structures: the depth test culls covered sky pixels */sky.name='cq-style-sky';scene.add(sky);return {sky,lights:[hemi,sun,rim]};};

 // ---------- props (per fine terrain chunk; InstancedMesh, chunk-local positions) ----------
 S.props=(items,cx,cz)=>{const ox=cx*128,oz=cz*128,g=new T.Group(),trees=items.filter(p=>p.kind==='tree'),rocks=items.filter(p=>p.kind==='rock'&&p.variant>.45),relays=items.filter(p=>p.kind==='relay');
  const crystals=high?trees.filter(p=>p.variant>=.4):trees,fungus=high?trees.filter(p=>p.variant<.4):[],halos=[];
  const inst=(id,list,fn)=>{if(!list.length)return;g.add(kinst(id,list,fn));};
  // Trees are not solid in the sim: their replacements stay low (≤1.45 m) and read as passable growths.
  inst('crystal-growth',crystals,p=>{const sh=.42+.36*p.size,sv=Math.min(1.45,.5+.32*p.size);halos.push([p.x-ox,p.y+sv*.62,p.z-oz,sh*1.25,1]);return M(p.x-ox,p.y-.12,p.z-oz,0,p.variant*40,0,sh,sv,sh);});
  inst('fungus-growth',fungus,p=>{const sh=.5+.4*p.size,sv=Math.min(1.3,.55+.26*p.size);halos.push([p.x-ox,p.y+sv*.75,p.z-oz,sh*1.1,2]);return M(p.x-ox,p.y-.06,p.z-oz,0,p.variant*40,0,sh,sv,sh);});
  // Rocks keep the authoritative envelope (ellipsoid 1.6s x (.5+v)s x s at y + .3s, inside the solid ellipse).
  {const zr=rocks.filter(p=>root.ConquestWorld.terraformAt&&root.ConquestWorld.terraformAt(p.x,p.z)>.12),mr=rocks.filter(p=>!zr.includes(p)),rm=p=>M(p.x-ox,p.y+.3*p.size,p.z-oz,(p.variant-.72)*.22,(p.variant*31)%2<1?0:Math.PI,(p.variant-.6)*.16,1.6*p.size,(.5+p.variant)*p.size,p.size);inst('rock',mr,rm);inst('rock-moss',zr,rm);}
  inst('relay-mast',relays,p=>{halos.push([p.x-ox,p.y+9.3,p.z-oz,1.3,3]);return M(p.x-ox,p.y,p.z-oz,0,p.variant*6,0,1,1,1);});
  if(high&&halos.length){const im=new T.InstancedMesh(P.bill,MAT.fx,halos.length);halos.forEach((h,i)=>im.setMatrixAt(i,M(h[0],h[1],h[2],0,0,0,h[3],h[3],h[4])));im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.renderOrder=2;g.add(im);}
  return g;};

 // ---------- Refuge: habitats ("cabins"), oxygen processors, supply terminal, solar field, light pylons ----------
 const ringMin=(x,z,r)=>{let m=ground(x,z);for(let a=0;a<12;a++)m=Math.min(m,ground(x+Math.cos(a*.5236)*r,z+Math.sin(a*.5236)*r));return m;};
 function habitat(tk,X,h,idx){const {x,z}=h,g=ground(x,z),gmin=ringMin(x,z,8.4),ap=7.45*Math.cos(Math.PI/6);
  KW().place('refuge-habitat',tk,KM(x,g,z),{sink:r2(g-gmin+1.6)});
  X.quadV(x,g+6.65,z+ap+1.25,3.4,.85,0,AT['S'+idx],E(0x22e6ff,1.5));
  X.decal(x,z,11.5,11.5,0,AT.BLOB,[0,0,0],.62,low?6:9,.12);X.decal(x,z,9.8,9.8,0,AT.RING,E(0x6fd6e0,.11),0,low?8:12,.16);X.decal(x,z+9.9,2.4,2.4,0,AT.BLOB,E(0x6fd6e0,.14),0,4,.2);}   // 1.5 m past the plinth, pale and faint: a wide saturated ring read as liquid flooding the grass (critic round 3)
 // The tower's portal faces -z (a half turn), under its holographic sign.
 function processor(tk,X,p,i,all){const {x,z}=p,g=ground(x,z),gmin=ringMin(x,z,12.6),H=p.artHeight,rAt=y=>6.9-1.6*(y-13)/(H-13);
  KW().place('refuge-processor',tk,KM(x,g,z,Math.PI),{h:H,sink:r2(g-gmin+1.6)});
  for(const f of [.3,.48,.66,.84])X.ringGlow(x,z,g+H*f,rAt(H*f)+2.7,low?3:4.4,E(0x22e6ff,.55),low?12:20);
  if(i<all.length-1){const q=all[i+1],g2=ground(q.x,q.z),ax=x+12.4,bx=q.x-12.4,ay=Math.max(g,g2)+9.6,by=ay,L=Math.hypot(bx-ax,by-ay,q.z-z);// Overhead pipe bridge, level at the higher tower's 9.6 m (8+ m clearance): the 6 m gap between the solid r12 towers stays drivable.
   KW().place('refuge-pipe',tk,M((ax+bx)/2,(ay+by)/2,(z+q.z)/2,0,Math.atan2(-(q.z-z),bx-ax),Math.asin((by-ay)/L)),{w:r2(L)});}
  X.quadV(x,g+11.5,z-13.4,3.6,.95,Math.PI,AT['S'+(10+i)],E(0x22e6ff,1.5));
  X.decal(x,z,16,16,0,AT.BLOB,[0,0,0],.5,low?6:9,.12);X.decal(x,z,16,16,0,AT.BLOB,E(0x6fd6e0,.13),0,low?6:9,.16);}
 function terminal(tk,X,t){const {x,z}=t,g=ground(x,z);
  X.decal(x,z,6.4,6.4,0,AT.HEX,E(0x22e6ff,.2),0,low?8:12,.14);X.decal(x,z,12.65,12.65,0,AT.DASH,E(0x22e6ff,.14),0,low?12:18,.18);X.decal(x,z,8,8,0,AT.BLOB,E(0x22e6ff,.07),0,8,.1);   // dimmed (5E-2d1): in daylight the pad was a saturated cyan slab that swamped the terminal
  KW().place('refuge-terminal',tk,KM(x,g,z),{});
  X.band(x,z,g+3.3,1.05,.7,6.5,E(0x2dffc4,.45),[0,0,0],14);X.quadV(x,g+7.3,z,3.4,3.4,0,AT.ICON,E(0x2dffc4,1.4));X.quadV(x,g+7.3,z,3.4,3.4,Math.PI/2,AT.ICON,E(0x2dffc4,.9));
  X.quadV(x,g+5.05,z+.3,3.8,.95,0,AT[SIGN.SUPPLY],E(0x22e6ff,1.6));}
 function solar(tk,X,p){const {x,z,w,d,tilt}=p,g=ground(x,z);let lo=g;for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]])lo=Math.min(lo,ground(x+sx*(w/2-.6),z+sz*(d/2-.6)));
  KW().place('refuge-solar',tk,KM(x,g,z),{w,d,tilt,sink:r2(g-lo+.5)});}
 // Light pylons stand on a habitat plinth inside its solid r7.8 (never a 7 m mast in a drive lane); arm + light pool face the lane.
 const pylonAt=([px,pz])=>{const h=F.habitats.reduce((a,b)=>Math.hypot(b.x-px,b.z-pz)<Math.hypot(a.x-px,a.z-pz)?b:a),d=Math.hypot(px-h.x,pz-h.z),ux=(px-h.x)/d,uz=(pz-h.z)/d;return [h.x+ux*7.35,h.z+uz*7.35,Math.atan2(ux,uz)];};
 S.pylons=()=>PYLONS.slice(0,low?6:10).map(pylonAt);
 function pylon(tk,X,px,pz,a){const g=ground(px,pz);KW().place('refuge-lamp',tk,KM(px,g,pz,a),{});X.decal(px+Math.sin(a)*2.6,pz+Math.cos(a)*2.6,3.4,3.4,a,AT.BLOB,E(0x6fd6e0,.13),0,low?4:6,.15);}   // a small pale pool under the lamp (5E-2d1): the 11 m saturated cyan pool read as liquid flooding the grass in daylight
 S.refuge=()=>{const Sb=new Bld(),X=new Fx(),tk=kt(Sb,X);F.habitats.forEach((h,i)=>habitat(tk,X,h,i));F.processors.forEach((p,i,a)=>processor(tk,X,p,i,a));terminal(tk,X,F.terminal);
  F.solar.forEach(p=>solar(tk,X,p));for(const [x,z,a] of S.pylons())pylon(tk,X,x,z,a);const g=kdone(pair(Sb,X),tk);g.name='cq-style-refuge';g.userData.site={x:1150,z:1150,range:1600};return g;};

 // ---------- Refuge viaduct: the deck surface follows W.deckAt exactly (it is the drivable upper route) ----------
 S.viaduct=()=>{const Sb=new Bld(),X=new Fx(),tk=kt(Sb,X),Kk=KW(),zA=1015,zB=1033,deck=x=>W.deckAt(x,1024),aDeck=sA('concrete',.35);
  // Deck ribbon (top surface exactly at deckAt, sampled every 4 m like the live build); the kit's girder segments hang under it.
  const P2=[],N2=[],A2=[],I2=[];let n=0;const col=(c,a=0)=>[c.r,c.g,c.b,a];
  for(let x=900;x<=1140;x+=4){const y=deck(x);for(const [z,c] of [[zA,K.dark2],[zB,K.dark2]]){P2.push(x,y,z);N2.push(0,1,0);A2.push(...col(c));}if(x<1140){const i=n;I2.push(i,i+1,i+2,i+2,i+1,i+3);}n+=2;}
  const deckGeo=new T.BufferGeometry();deckGeo.setAttribute('position',new T.Float32BufferAttribute(P2,3));deckGeo.setAttribute('normal',new T.Float32BufferAttribute(N2,3));deckGeo.setAttribute('aCol',new T.Float32BufferAttribute(A2,4));deckGeo.setIndex(I2);deckGeo.computeVertexNormals();
  Sb.add(deckGeo,new T.Matrix4(),null,0,null,(v)=>[K.dark2.r*(1+.05*Math.sin(v.x*.8)),K.dark2.g,K.dark2.b*(1.04),aDeck]);deckGeo.dispose();
  {const jb=Kk.part({aoH:.01,aoMin:1}),jm=Kk.mat(0x18202e,'flat',0,0);for(let x=904;x<1140;x+=24){const y=deck(x)+.03;jb.quad([x-.11,y,zA+.5],[x+.11,y,zA+.5],[x+.11,y,zB-.5],[x-.11,y,zB-.5],jm,[x,y-9,1024]);}Kk.emit(tk,jb,new T.Matrix4());}   // expansion joints
  for(let x=900;x<1140;x+=4){const a=deck(x),b=deck(x+4),L=Math.hypot(4,b-a),rz=Math.atan2(b-a,4),mid=(a+b)/2;
   Kk.place('viaduct-segment',tk,M(x+2,mid,1024,0,0,rz),{w:r2(L+.02),stud:((x-900)/4)%2===0?1:0});}
  // Piers on the authoritative pier positions (solid in the sim within 1.5 m below the deck): hex columns with lit collars.
  for(const x of [970,1070])for(const z of [1018,1030]){const gy=ground(x,z);Kk.place('viaduct-pier',tk,KM(x,gy,z),{h:r2(deck(x)-1.4-gy)});X.decal(x,z,4.5,4.5,0,AT.BLOB,[0,0,0],.55,4,.12);}
  // Light posts along both edges (the lamp reaches over the deck); spill on the deck.
  for(let x=916;x<1140;x+=24)for(const [z,s] of [[zA,-1],[zB,1]]){const y=deck(x);Kk.place('viaduct-lamp',tk,KM(x,y,z+s*.2,s<0?0:Math.PI),{});X.flat(x,y+.08,z-s*2.2,2.6,2.2,AT.BLOB,E(0x22e6ff,.22));}
  for(const x of [904,1136]){const y=deck(x);X.sign(x,y+3.6,1024,4.4,1.1,AT[SIGN.CORRIDOR],E(0x22e6ff,1.4));Kk.place('viaduct-gantry',tk,KM(x,y,1024),{});}
  const g=kdone(pair(Sb,X),tk);g.name='cq-style-viaduct';g.userData.site={x:1020,z:1024,range:1400};return g;};

 // ---------- Parasite installations (enemy bases) and raid cover ----------
 function coverWall(tk,X,o){const g=ground(o.x,o.z),{x,z,width:w,depth:d,height:h}=o;
  KW().place('cover-wall',tk,KM(x,g,z),{w,d,h});
  X.decal(x,z,w/2+2.2,d/2+2.2,0,AT.BLOB,[0,0,0],.55,6,.1);X.decal(x,z,w/2+3.5,d/2+3.5,0,AT.BLOB,E(0xff2bd6,.2),0,6,.12);}
 function hive(tk,X,inst){const cx=inst.solid.x,cz=inst.solid.z,g=ground(cx,cz);let lo=g;for(const [sx,sz] of [[-11,-8],[11,-8],[11,8],[-11,8]])lo=Math.min(lo,ground(cx+sx,cz+sz));
  KW().place('hive',tk,KM(cx,g,cz),{sink:r2(Math.min(4,g-lo+.6))});
  const mx=inst.mast.x,mz=inst.mast.z,mg=ground(mx,mz);KW().place('hive-mast',tk,KM(mx,mg,mz),{});
  X.band(mx,mz,mg+19.5,.9,.4,14,E(0xff2bd6,.5),[0,0,0],12);
  X.decal(cx,cz,15,12,0,AT.BLOB,[0,0,0],.6,low?6:10,.12);X.decal(cx,cz,21,18,0,AT.BLOB,E(0xff2bd6,.35),0,low?6:10,.16);}
 S.installations=()=>F.installations.map(inst=>{const Sb=new Bld(),X=new Fx(),tk=kt(Sb,X);hive(tk,X,inst);const g=kdone(pair(Sb,X),tk);g.name='cq-style-hive-'+inst.id;g.userData.site={x:inst.solid.x,z:inst.solid.z,range:1100};return g;});
 S.cover=()=>{const groups=new Map();for(const o of F.obstacles){let e=groups.get(o.layout);if(!e){e={Sb:new Bld(),X:new Fx(),x:0,z:0,n:0};e.tk=kt(e.Sb,e.X);groups.set(o.layout,e);}coverWall(e.tk,e.X,o);e.x+=o.x;e.z+=o.z;e.n++;}
  return [...groups.entries()].map(([layout,e])=>{const g=kdone(pair(e.Sb,e.X),e.tk);g.name='cq-style-cover-'+layout;g.userData.site={x:e.x/e.n,z:e.z/e.n,range:900};return g;});};
 // Raid-only Parasite spire (decor where the live build places raid art): crystal cluster on a chitin root.
 S.raidSpire=()=>{const Sb=new Bld(),X=new Fx(),tk=kt(Sb,X);KW().place('raid-spire',tk,KM(0,0,0),{});return kdone(pair(Sb,X),tk);};
 // Blender-authored GLB (constrained parser) adopted into the style: per-mesh PBR factors become vertex colour + emission.
 S.adopt=group=>{group.traverse(o=>{if(!o.isMesh||o.material===MAT.solid)return;const geo=o.geometry,m=o.material;if(!geo.attributes.aCol){const n=geo.attributes.position.count,a=new Float32Array(n*4),c=m.color||new T.Color(1,1,1),e=m.emissive||new T.Color(0,0,0),em=Math.max(e.r,e.g,e.b);
   geo.computeBoundingBox();const y0=geo.boundingBox.min.y,h=Math.max(.01,geo.boundingBox.max.y-y0),p=geo.attributes.position;
   for(let i=0;i<n;i++){const k=em>.05?1:.55+.45*clamp01((p.getY(i)-y0)/(h*.6));a[i*4]=(em>.05?e.r/em:c.r)*k;a[i*4+1]=(em>.05?e.g/em:c.g)*k;a[i*4+2]=(em>.05?e.b/em:c.b)*k;a[i*4+3]=em>.05?Math.min(1,.55+em):0;}
   geo.setAttribute('aCol',new T.BufferAttribute(a,4));}o.material=MAT.solid;});return group;};

 // ---------- Command Base I–V (base-local x/z, absolute y; built to the shared baseBlocked() footprints) ----------
 // opt.shell (Session 5C): only the pad, perimeter and Command Gate, so the pilot's real town (a diorama, js/conquest/townkit.js)
 // stands in the courtyard; the sim's collision volumes are unchanged.
 S.commandBase=(base,opt={})=>{const D=F.base,tier=base.tier||0,Sb=new Bld(),X=new Fx(),tk=kt(Sb,X),Kk=KW(),gy=(x,z)=>ground(D.x+x,D.z+z),y=gy(0,0),shell=!!opt.shell,HT=Math.PI;
  const decal=(x,z,hw,hd,r,e,o,seg,lift)=>{X.decal(D.x+x,D.z+z,hw,hd,0,r,e,o,seg,lift);};
  // The kit's base parts face +z; the base's front (the Command Gate) is -z, so every part is placed with a half turn.
  // World-space decals are rebased to the base-local frame after building (the group sits at the base centre).
  const put=(id,x,z,o,ry=HT,dy=0)=>Kk.place(id,tk,KM(x,y+dy,z,ry),o||{});
  put('base-pad',0,0,{tier:tier?1:0,paint:new T.Color(opt.paint||'#2c3a49').getHex()});
  decal(0,0,5.6,5.6,AT.HEX,E(tier?0x22e6ff:0xffb347,.9),0,low?8:10,.38);
  // Build terminal (exists before purchase): kiosk with amber holo.
  if(!shell){put('base-kiosk',-10,-7,{},HT,.3);X.quadV(-10,y+4.9,-7.2,3.4,3.4,0,AT.ICON,E(0xffb347,1.2));}   // 5D: not under the town diorama (the shell)
  if(!tier){decal(0,0,19,17,AT.DASH,E(0xffb347,.75),0,low?10:16,.4);X.sign(0,y+6.5,-17.4,4.8,1.2,AT[SIGN['BUILD SITE']],E(0xffb347,1.5));}
  if(tier){
   // Perimeter barrier (side walls |x|=17, back wall z=16; 6 m thick in the sim).
   put('base-wall',-17,-.5,{d:35});put('base-wall',17,-.5,{d:35});put('base-wall',0,16,{d:29.6},Math.PI/2);
   // Session 5: the fortress front is the COMMAND GATE into the pilot's private base plot. Armoured pylons on the corner
   // towers' inner faces carry the lintel (render only, outside the drive lane), lit portal field and gate sign; tanks drive under it.
   put('base-gate',0,-18.6,{});
   X.sign(0,y+10.4,-19.95,9.6,1.3,AT[SIGN.COMMAND]||AT.ICON,E(0x22e6ff,1.7));   /* 5E-2d1: the gate's sign turns to the camera like the other free-standing signs (from inside the base it read mirrored) */if(!low)X.quadV(0,y+4.8,-18.6,24.6,9.4,0,AT.BLOB,E(0x22e6ff,.16));
   if(!shell){put('relay-mast',10,12,{},0,.3);X.sign(13.2,y+7,11.6,5,1.25,AT[SIGN['BASE '+['I','II','III','IV','V'][Math.min(5,tier)-1]]],E(0x22e6ff,1.6));}
   if(opt.veteran)put('veteran-monument',-12,10,{},HT,.3);}
  if(tier>=2&&!shell){
   // Hangar (sim: x 1..17, z 1..17), its door facing the pad.
   put('base-hangar',9,9,{});X.quadV(9,y+6.6,.8,4.2,1.05,0,AT[SIGN.HANGAR],E(0x22e6ff,1.5));decal(9,-3,6,4.5,AT.BLOB,E(0x22e6ff,.35),0,6,.42);
   // Reactor (sim: r8 around (-7,8)); tier II drum, tier III+ the Blender command citadel stands on the plinth.
   const cit=tier>=3&&!!opt.citadel;put('base-reactor',-7,8,{tier:Math.min(3,tier),plinth:cit?1:0});
   if(!cit&&high)X.ringGlow(-7,8,y+5.1,6.2,4,E(0x2dffc4,.4),18);
   X.quadV(-7,y+3.2,.15,3.8,.95,0,AT[SIGN.REACTOR],E(0x2dffc4,1.4));}
  if(tier>=3&&!shell)for(const s of [-1,1]){const x=s*15,z=-13;
   // Corner gun towers (sim: 8x8 at (±15,-13)), guns toward the gate.
   put('base-tower',x,z,{});X.quadV(x,y+7.6,z-2.95,3.6,.9,0,AT[SIGN.DEFENSE],E(0x22e6ff,1.3));}
  if(tier>=4&&!shell){const pb=Kk.part({aoMin:1}),MM=Kk.pal.mil;pb.cyl(12,y+8.6,10,.5,.5,MM.hull2,{n:8,bev:.08});pb.tube([12,y+9,10],[12,y+13,10],.18,MM.trim,{n:6});pb.ring(12,y+11.4,10,.26,MM.cyan,{thin:true});Kk.emit(tk,pb,new T.Matrix4());X.quadV(12,y+8.8,15.9,3.4,.85,0,AT[SIGN.RADAR],E(0x22e6ff,1.2));}
  if(tier>=5&&!shell){const x=0,z=16;/* on the solid back-wall line (sim |z-16|<3), so tanks never drive through the tower */put('base-spire',x,z,{});
   if(high)for(const h of [9.5,14,18.5,23])X.ringGlow(x,z,y+h,3.5-(h/26)*.9,2.2,E(0x22e6ff,.45),14);X.quadV(x,y+6.2,z-3.3,4.6,1.15,0,AT[SIGN.COMMAND],E(0x22e6ff,1.6));}
  // Modules along the inner face of the back wall: colour = function, height = level.
  const MOD={reactor:0x2dffc4,hangar:0x22e6ff,defense:0xff3048,vault:0xffd36b,radar:0xa8f8ff,uplink:0xa07bff};
  if(!shell)Object.keys(C.baseDefinition.modules).forEach((m,i)=>{const level=base.modules?.[m]||0;if(!level)return;put('base-module',-12+i*4,13.6,{level:Math.min(3,level),color:MOD[m]||MOD.hangar,kind:m},HT,.3);});
  // Defense damage reads as scorch and wreckage at the gate.
  for(let i=0;i<Math.ceil((base.defense?.damage||0)/20);i++){decal(-12+i*5,-15,2.6,2.2,AT.BLOB,[0,0,0],.75,3,.4);const wb=Kk.part(),WR=Kk.pal.wreck;wb.bev(0,0,0,1.6,.5,.9,WR.hull,{ch:.08});wb.at(.3,.42,.1,.5,q=>q.bev(0,0,0,.9,.22,.6,WR.rust,{ch:.05}),.25);Kk.emit(tk,wb,KM(-12+i*5,y+.28,-15,i));}
  const solidMesh=Sb.mesh(),fxMesh=X.mesh();
  // Rebase world-space decals (built with absolute x/z) into the base-local frame.
  if(fxMesh.geometry){const p=fxMesh.geometry.attributes.position,b=fxMesh.geometry.attributes.aBill;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>500)p.setXYZ(i,p.getX(i)-D.x,p.getY(i),p.getZ(i)-D.z);fxMesh.geometry.computeBoundingSphere();}
  const g=new T.Group();g.add(solidMesh,fxMesh);kdone(g,tk);
  if(tier>=4&&!shell){const r=kinst('town-radar-dish',[0],()=>new T.Matrix4(),{level:3});r.userData.noPick=true;r.frustumCulled=false;r.position.set(12,y+13.1,10);r.name='cq-radar';g.add(r);g.userData.spin=r;}
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
 S.dressTank=(vehicle,o={})=>{const body=vehicle.userData.body,gun=vehicle.userData.gun;if(!body)return vehicle;   /* o (Session 6C allies): ring colour and alpha, no trim strips or lamp glow */vehicle.updateWorldMatrix(true,true);const inv=new T.Matrix4().copy(body.matrixWorld).invert(),pts=[];
  const walk=o=>{if(o===gun)return;if(o.isMesh){const m=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld),a=o.geometry.attributes.position;for(let i=0;i<a.count;i+=2){_v.fromBufferAttribute(a,i).applyMatrix4(m);pts.push(_v.x,_v.y,_v.z);}}for(const c of o.children)walk(c);};
  for(const c of body.children)walk(c);if(!pts.length)return vehicle;let zT=0;for(let i=2;i<pts.length;i+=3)zT=Math.max(zT,Math.abs(pts[i]));
  let yT=-1e9,x0=1e9,x1=-1e9,ax0=1e9,ax1=-1e9;for(let i=0;i<pts.length;i+=3){ax0=Math.min(ax0,pts[i]);ax1=Math.max(ax1,pts[i]);if(Math.abs(pts[i+2])>zT-.12){yT=Math.max(yT,pts[i+1]);x0=Math.min(x0,pts[i]);x1=Math.max(x1,pts[i]);}}
  if(o.strips!==false){const D=new Bld();for(const s of [-1,1])D.box((x0+x1)/2,yT+.018,s*(zT-.05),(x1-x0)*.86,.035,.06,K.cyan,1);const strips=D.mesh();strips.name='cq-style-dress';body.add(strips);}
  const X=new Fx(),hl=(ax1-ax0)/2,cz=(ax0+ax1)/2;X.flat(0,.03,cz,zT*1.5,hl*1.25,AT.BLOB,[0,0,0],.78);X.flat(0,.04,cz,zT*2.1,hl*1.55,AT.RING,E(o.ring??0x22e6ff,o.ringA??.6),0);X.flat(0,.045,cz,zT*1.7,hl*1.3,AT.BLOB,E(o.ring??0x22e6ff,o.blobA??.25),0);
  if(o.lamp!==false)X.flat(0,.05,cz+hl+2.4,1.9,2.6,AT.BLOB,E(0xa8f8ff,.22),0);const glow=X.mesh();glow.name='cq-style-dress';vehicle.add(glow);return vehicle;};

 // ---------- effects: pooled glow billboards, ground rings, holo markers ----------
 const glowCache=new Map();
 S.glow=(color,region='BLOB')=>{const k=color+region;let g=glowCache.get(k);if(!g){g=billGeo(AT[region],E(color,1));glowCache.set(k,g);}return fxMesh(g,3);};
 const ringCache=new Map();
 S.groundRing=(color,region='RING')=>{const k=color+region;let g=ringCache.get(k);if(!g){const X=new Fx();X.flat(0,0,0,1,1,AT[region],E(color,1),0);g=keep(X.geometry());ringCache.set(k,g);}return fxMesh(g);};
 // Holo pillar marker (mission beacon, objectives, caches): ground hex + light band + icon.
 S.holoMarker=(color,{height=10,radius=1.4,icon=true}={})=>{const X=new Fx();X.flat(0,.15,0,radius*2.2,radius*2.2,AT.HEX,E(color,.9),0);X.band(0,0,.2,radius,radius*.55,height,E(color,.55),[0,0,0],12);if(icon){X.quadV(0,height+1.6,0,2.6,2.6,0,AT.ICON,E(color,1.2));X.quadV(0,height+1.6,0,2.6,2.6,Math.PI/2,AT.ICON,E(color,.8));}
  const m=X.mesh();m.renderOrder=2;return m;};
 const cacheGeo={};
 // Session 6 loot v1: a cache holding loot glows in its rarity colour (grey, green, cyan, violet, gold); plain salvage stays amber.
 const LOOT_GLOW=[0xc9d2dc,0x5fe08a,0x46d9ff,0xc18cff,0xffc94a];
 S.cache=(wreck,rarity=-1)=>{const r=wreck?-1:Math.max(-1,Math.min(4,rarity|0)),key=(wreck?'w':'l'+r)+':'+root.ConquestWorldKit.generation+(KW().swapped(wreck?'wreck-cache':'loot-cache')&&typeof Meshy3D!=='undefined'?':'+Meshy3D.generation:'');if(!cacheGeo[key]){const Sb=new Bld(),X=new Fx(),tk=kt(Sb,X),col=wreck?0x8ee6ef:r>=0?LOOT_GLOW[r]:0xffd58a;
   KW().place(wreck?'wreck-cache':'loot-cache',tk,KM(0,0,0,.35),wreck?{}:{rarity:r});X.band(0,0,1.5,.5,.2,5,E(col,.6),[0,0,0],10);cacheGeo[key]={s:keep(Sb.geometry()),f:keep(X.geometry()),tk};}
  const g=new T.Group();g.add(new T.Mesh(cacheGeo[key].s,MAT.solid),fxMesh(cacheGeo[key].f));return kdone(g,cacheGeo[key].tk);};
 S.flag=(owned,friendly)=>{const Sb=new Bld(),X=new Fx(),tk=kt(Sb,X),col=owned?0x2dffc4:friendly?0x22e6ff:0xff2bd6;
  KW().place('sector-flag',tk,KM(0,0,0),{w:3.4,h:12,d:1.4,owner:owned?'owned':friendly?'friendly':'hostile'});X.quadV(0,9.6,.14,2.2,.55,0,AT[owned||friendly?SIGN.SECURED:SIGN.HOSTILE],E(col,1.3));return kdone(pair(Sb,X),tk);};

 // ---------- per-frame: time, viewport, origin, nearest light/creep sites ----------
 const siteKey={};
 S.viewLights=camera=>{camera.updateMatrixWorld();const m=camera.matrixWorldInverse;U.uSunV.value.copy(sunDir).transformDirection(m);U.uDaySunV.value.copy(daySunDir).transformDirection(m);U.uRimV.value.copy(rimDir).transformDirection(m);U.uUpV.value.set(0,1,0).transformDirection(m);};
 // Crossing the boundary: the camera's zone factor eases over about a second; sky, fog/valley mist and exposure follow it.
 const nightFog=new T.Color(0x06070f),dayFog=new T.Color(0x9a8672),nightFogC=V3(.0018,.0021,.0048),dayFogC=V3(.36,.27,.19);
 S.atmo=(p,dt)=>{const tf=W.terraformAt?W.terraformAt(p.x,p.z):0,want=Math.min(1,Math.max(0,(tf-.03)/.13)),a=U.uAtmo.value;U.uAtmo.value=a+(want-a)*Math.min(1,(dt||0)*1.6);
  const k=U.uAtmo.value,A=S.atmoScene;if(A?.scene?.fog){A.scene.fog.color.copy(nightFog).lerp(dayFog,k);A.scene.fog.near=900-640*k;A.scene.fog.far=2600-1250*k;A.scene.background.setRGB(.36*k,.27*k,.19*k);}
  if(A?.renderer)A.renderer.toneMappingExposure=(low?1.25:1.2)-.1*k;MAT.sky.uniforms.uFogC.value.copy(nightFogC).lerp(dayFogC,k);return k;};
 // A guest scene takes the world's current atmosphere once (fog colour, haze distance, background): under a terraformed
 // day sky the far ground fades into the same amber haze as the world, at night into the same dark.
 // Guest renders (the Home Sector, its card sprites and share card) are town-local: SOLID_VS would otherwise sample the
 // world's baked colony shadows, atmosphere map and Parasite/friendly site rim tints at town-local + uOrigin (shadow
 // streaks, a magenta rim on the far hills, day or night light by entry side). One flat texel at the zone's current
 // atmosphere, no shadow, no site tints; S.guest(false) restores the world's values.
 const G1=v=>{const t=new T.DataTexture(new Uint8Array([v,v,v,255]),1,1);t.needsUpdate=true;return t;},guestNoShadow=G1(0),guestAtmo=G1(0),gSave={on:false,sh:null,at:null,sites:null};
 S.guest=on=>{if(on){if(gSave.on)return;gSave.on=true;gSave.sh=U.uShadowMap.value;gSave.at=U.uAtmoMap.value;if(!gSave.sites)gSave.sites=U.uSite.value.map(v=>v.clone());U.uSite.value.forEach((v,i)=>{gSave.sites[i].copy(v);v.set(0,0,0,0);});
   const b=Math.round(255*Math.min(1,Math.max(0,U.uAtmo.value))),d=guestAtmo.image.data;if(d[0]!==b){d[0]=d[1]=d[2]=b;guestAtmo.needsUpdate=true;}U.uShadowMap.value=guestNoShadow;U.uAtmoMap.value=guestAtmo;}
  else{if(!gSave.on)return;gSave.on=false;U.uShadowMap.value=gSave.sh;U.uAtmoMap.value=gSave.at;U.uSite.value.forEach((v,i)=>v.copy(gSave.sites[i]));}};
 S.atmoApply=(scene,near,far)=>{const k=U.uAtmo.value;if(!scene.fog)scene.fog=new T.Fog(0,near,far);scene.fog.color.copy(nightFog).lerp(dayFog,k);scene.fog.near=near*(1-.55*k);scene.fog.far=far*(1-.45*k);if(!scene.background)scene.background=new T.Color(0);scene.background.setRGB(.36*k,.27*k,.19*k);return k;};
 S.update=(dt,t,view)=>{U.uTime.value=t;if(view?.renderer?.getDrawingBufferSize)view.renderer.getDrawingBufferSize(U.uViewport.value);if(view?.origin)U.uOrigin.value.set(view.origin.x,view.origin.z);if(view?.p)S.atmo(view.p,dt);
  const p=view?.p,terr=view?.authority?.state?.territory;if(!p)return;const k=Math.round(p.x/32)*100003+Math.round(p.z/32);if(siteKey.k===k&&siteKey.t===terr)return;siteKey.k=k;siteKey.t=terr;
  const list=allSites(F,terr).map(s=>[s,Math.hypot(s[0]-p.x,s[1]-p.z)-s[2]]).sort((a,b)=>a[1]-b[1]).slice(0,8);for(let i=0;i<8;i++){const s=list[i]?.[0];U.uSite.value[i].set(s?s[0]:0,s?s[1]:0,s?s[2]:0,s?s[3]:0);}};
 // HIGH shading can drop to the LOW branch at runtime (adaptive quality, LOW setting): same programs, no recompile.
 S.setHigh=on=>{U.uHigh.value=high&&on?1:0;};
 // Static groups are culled by distance (they are far apart); cheap per-frame loop.
 S.cull=(groups,p)=>{const k=software?.4:1;for(const g of groups){const s=g.userData.site;if(s)g.visible=Math.hypot(s.x-p.x,s.z-p.z)<s.range*k;}};
 // Compile every program variant once (static + instanced solid/fx, sky, terrain, shields) before play.
 S.warmObjects=()=>{const objs=[new T.Mesh(G.box,MAT.solid),new T.InstancedMesh(G.box,MAT.solid,1),new T.Mesh(P.bill,MAT.fx),new T.InstancedMesh(P.bill,MAT.fx,1),new T.Mesh(G.ico,MAT.shield),new T.Mesh(G.ico,MAT.field),new T.Mesh(waterWarmGeo,MAT.water)];
  for(const o of objs)if(o.isInstancedMesh){o.setMatrixAt(0,new T.Matrix4());o.instanceMatrix.needsUpdate=true;}return objs;};
 S.canvas={bg:'#03060c',grid:'#12303d',cover:'#3c2a46',coverEdge:'#ff4fd8',site:'#8ff6ff',hostile:'#ff4fd8',friend:'#3fe9ff',beacon:['#3fe9ff','#ffc45a'],shot:'#d8faff',enemyShot:'#ff6bd6'};
 S.dispose=()=>{for(const g of S.shared)g.dispose();for(const m of Object.values(MAT))m.dispose();tex.atlas.dispose();tex.earth.dispose();tex.detail.dispose();glowCache.clear();ringCache.clear();batteryCache=droneCache=null;S.shared.length=0;};
 return S;
}

// ---------- region map: holographic tactical display with a lettered grid reference ----------
const MAPC={relief:null,glyphs:new Map(),labels:new Map(),overlay:null,fontWait:false,mctx:null};
const MFONT="600 10px 'Chakra Petch','Segoe UI',system-ui,sans-serif",GFONT="bold 30px 'Segoe UI Symbol','DejaVu Sans','Noto Sans Symbols2',sans-serif";
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
  // Session 5 Phase 4: terraformed zones (soft green), roads (paved amber, dirt dashed), settler lots (amber) and the military
  // wall, watchtowers and gates (cyan), fields (green). Discovered ground only; labels stay zoom-only.
  {const CO=Wd.COLONY;for(const py of Wd.pylons||[]){if(!d.has(py.x,py.z))continue;const [X0,Y0]=P(py.x,py.z),Rr=py.r*scale,gg=x.createRadialGradient(X0,Y0,Rr*.15,X0,Y0,Rr);gg.addColorStop(0,'rgba(80,210,100,.17)');gg.addColorStop(1,'rgba(80,210,100,0)');x.fillStyle=gg;x.beginPath();x.arc(X0,Y0,Rr,0,TAU);x.fill();}
   if(CO){for(const f of CO.fields||[]){if(!d.has(f.x,f.z))continue;const c=Math.cos(f.r),sn=Math.sin(f.r);x.beginPath();for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const [X0,Y0]=P(f.x+u*f.w/2*c-v*f.d/2*sn,f.z+u*f.w/2*sn+v*f.d/2*c);x.lineTo(X0,Y0);}x.closePath();x.fillStyle='rgba(110,170,60,.35)';x.fill();}
    for(const r of CO.roads||[]){if(!r.pts.some(([wx,wz])=>d.has(wx,wz)))continue;x.beginPath();r.pts.forEach(([wx,wz],i)=>{const [X0,Y0]=P(wx,wz);i?x.lineTo(X0,Y0):x.moveTo(X0,Y0);});x.lineWidth=Math.max(1,r.w*scale*.55);x.strokeStyle=r.p?'rgba(255,168,74,.8)':'rgba(160,120,80,.7)';x.setLineDash(r.p?[]:[3,3]);x.stroke();}x.setLineDash([]);
    for(const l of CO.lots||[]){if(!d.has(l.x,l.z)||l.k==='pad')continue;const mil=['wall','watch','gate'].includes(l.k),c=Math.cos(l.r),sn=Math.sin(l.r);x.beginPath();for(const [u,v] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const [X0,Y0]=P(l.x+u*l.w/2*c-v*l.d/2*sn,l.z+u*l.w/2*sn+v*l.d/2*c);x.lineTo(X0,Y0);}x.closePath();x.fillStyle=mil?'rgba(70,238,255,.9)':'rgba(255,168,74,.85)';x.fill();}}}
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
 MAPC.overlay=cv;return cv;}
function mapPaint(ctx,m){const Wd=m.W,Cb=m.C,S=m.state||{},d=m.discovery,scale=m.scale,unit=280/Wd.WIDTH*scale;
 if(!MAPC.fontWait&&document.fonts&&!document.fonts.check(MFONT)){MAPC.fontWait=true;document.fonts.load(MFONT).then(()=>{MAPC.labels.clear();MAPC.overlay=null;m.repaint?.();}).catch(()=>{});}
 ctx.setTransform(2,0,0,2,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='#010409';ctx.fillRect(0,0,360,420);
 const vis={x0:(-40-m.px)/unit,x1:(320-m.px)/unit,z0:Wd.LENGTH+(m.py-420)/unit,z1:Wd.LENGTH+m.py/unit},rel=relief(m,unit,vis);
 if(rel&&rel.n){const dx=Math.round((40+m.px+rel.x0*unit)*2)/2,dy=Math.round((m.py+(1-rel.z1/Wd.LENGTH)*420*scale)*2)/2;ctx.imageSmoothingEnabled=true;ctx.drawImage(rel.canvas,dx,dy,(rel.x1-rel.x0)*unit,(rel.z1-rel.z0)*unit);}
 ctx.strokeStyle='rgba(0,229,255,.25)';ctx.lineWidth=1;ctx.strokeRect(40+m.px,m.py,280*scale,420*scale);
 // Owner playtest (Nov 8): no lettered grid and no sector rings; the map shows only places a pilot acts on.
 const player=m.player||{x:Cb.refuge.x,z:Cb.refuge.z,heading:0,none:true},you=m.toScreen(player.x,player.z),t=m.player?m.routeTarget:null;if(t){const q=m.toScreen(t.x,t.z);ctx.save();ctx.lineCap='round';ctx.strokeStyle='rgba(255,196,90,.2)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(you.x,you.y);ctx.lineTo(q.x,q.y);ctx.stroke();
  ctx.setLineDash([5,4]);ctx.strokeStyle='#ffc45a';ctx.lineWidth=1.6;ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(q.x,q.y,7,0,TAU);ctx.moveTo(q.x-11,q.y);ctx.lineTo(q.x-4,q.y);ctx.moveTo(q.x+4,q.y);ctx.lineTo(q.x+11,q.y);ctx.moveTo(q.x,q.y-11);ctx.lineTo(q.x,q.y-4);ctx.moveTo(q.x,q.y+4);ctx.lineTo(q.x,q.y+11);ctx.stroke();ctx.restore();}
 const marks=[],add=(wx,wz,g,c,txt,pri,o)=>marks.push(Object.assign({p:m.toScreen(wx,wz),g,c,t:txt,pri},o||{}));
 const zoomed=scale>=64,routed=o=>!!t&&Math.hypot(t.x-o.x,t.z-o.z)<1;
 for(const s of Cb.installations)if(d.has(s.x,s.z)){const cap=S.territory?.[s.id]?.owner==='humanity';add(s.x,s.z,cap?'⚑':'▲',cap?'#5effd0':'#ff4fd8',s.name,5);}
 const ops=Object.values(Cb.operations);if(m.mission){const done=m.missionDone;add(m.mission.x,m.mission.z,done?'✓':'◆','#f1cd7e',m.mission.name,4);}
 // Scanned veins (ore left / EXHAUSTED, then gone) and the live Meteor Strike
 {const now=Date.now();for(const o of Wd.knownOre(S,now)){const dp=o.d,ready=o.ready,k=dp.mineral,c=typeof MINERALS!=='undefined'?MINERALS[k].c:'#c0703f';
   add(dp.x,dp.z,'⬢',ready?c:'#566070',zoomed||dp.m==='starter'||routed(dp)||!ready?(typeof MINERALS!=='undefined'?MINERALS[k].s:'Ore')+(ready?(dp.m==='starter'?'':' · '+o.left+'/'+o.cap):' · EXHAUSTED'):'',dp.m==='tq'||dp.m==='starter'?5:dp.m==='ar'?3:1);}
  for(const f of Wd.floraNodes||[])if(d.has(f.x,f.z)&&!(S.harvest?.[f.id]>now))add(f.x,f.z,'✿','#7dff8a',zoomed||routed(f)?'Bio-flora':'',1);
  const M=Cb.meteorStrike?.(now);if(M&&M.phase!=='idle'&&!S.strikes?.[M.slot]?.claimed)add(M.site.x,M.site.z,'☄',M.phase==='open'?'#ff7a3d':'#ffd36b',(M.phase==='open'?'STRIKE OPEN · ':'IMPACT ')+Math.max(0,Math.ceil(((M.phase==='open'?M.closesAt:M.impactAt)-now)/60000))+'m',9);}
 for(const o of ops){if(o.raid||o.defense||o.strike||o.id==='base-defense'||o.id==='oxygen-line'||Cb.installations.some(s=>s.id===o.site))continue;const sec=S.territory?.[o.site]?.owner==='humanity';add(o.x,o.z,sec?'⚑':'◆',sec?'#5effd0':'#ffd36b',zoomed||routed(o)?o.name:'',4);}
 for(const sector of Cb.sectors){const list=ops.filter(o=>o.raid&&o.sector===sector.id);if(list.length){const cleared=list.filter(o=>S.completed?.[o.id]).length,un=Cb.raidsUnlocked(S.completed),done=cleared===list.length;
   if(un)add(list.reduce((n,o)=>n+o.x,0)/list.length,list.reduce((n,o)=>n+o.z,0)/list.length,done?'✓':'✦',done?'#5effd0':un?'#ffb347':'#8a93a0',un?'RAIDS '+cleared+'/'+list.length:'RAIDS · LOCKED',6);}
  if(Cb.sectorDefenseOpen(S.territory?.[sector.id],sector.id)){const o=ops.find(o=>o.defense&&o.sector===sector.id);if(o)add(o.x,o.z,'!','#ff4060',(S.territory[sector.id].owner==='humanity'?'DEFEND ':'RETAKE ')+sector.name,8);}}
 if(m.convoy){const a=m.toScreen(1090,944),b=m.toScreen(1090,809);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#ffb347';ctx.lineWidth=2;ctx.stroke();}
 const Bd=Cb.baseDefinition;add(Bd.x,Bd.z,'⌂','#ffc45a','MY BASE'+(S.plot?' · CC'+S.plot.cc:S.base?.tier?'':' · CLAIM HERE'),9,{left:true,big:true});
 if(zoomed&&Wd.COLONY){const L=Wd.COLONY.lots||[],mean=a=>a.length?[a.reduce((n,l)=>n+l.x,0)/a.length,a.reduce((n,l)=>n+l.z,0)/a.length]:null,town=mean(L.filter(l=>['hab','block','shop'].includes(l.k))),wall=mean(L.filter(l=>l.k==='wall'||l.k==='watch')),farm=mean(Wd.COLONY.fields||[]);
  if(town&&d.has(town[0],town[1]))add(town[0],town[1],'■','#ffa84a','SETTLER TOWN',3);if(farm&&d.has(farm[0],farm[1]))add(farm[0],farm[1],'✿','#9fd85a','FARMS',2);if(wall&&d.has(wall[0],wall[1]))add(wall[0],wall[1],'▮','#46eeff','FRONTIER WALL · MILITARY',2);}
 for(const w of S.wrecks||[])if(d.has(w.x,w.z))add(w.x,w.z,'◇','#8ee6ef','YOUR WRECK',8);add(Cb.refuge.x,Cb.refuge.z,'●','#3fe9ff','REFUGE',10);
 for(const k of marks){if(k.p.x<-12||k.p.x>372||k.p.y<-12||k.p.y>432)continue;if(k.dot){ctx.fillStyle=k.c;ctx.beginPath();ctx.arc(k.p.x,k.p.y,2,0,TAU);ctx.fill();}else if(k.big){ctx.save();ctx.strokeStyle=k.c;ctx.globalAlpha=.55+.35*Math.sin((m.time||0)*3);ctx.lineWidth=2;ctx.beginPath();ctx.arc(k.p.x,k.p.y,17,0,TAU);ctx.stroke();ctx.restore();ctx.drawImage(glyph(k.g,k.c),k.p.x-18,k.p.y-18,36,36);}else ctx.drawImage(glyph(k.g,k.c),k.p.x-12,k.p.y-12,24,24);}   // Find My Base: the base is the one big, pulsing marker
 const ys=label(['YOU'],'#ffffff',false),obst=[{x:0,y:403,w:360,h:17},{x:you.x-13,y:you.y-13,w:26,h:26},{x:you.x-ys.w/2,y:you.y-16-ys.h,w:ys.w,h:ys.h}];
 for(const k of marks)if(!k.dot)obst.push(k.big?{x:k.p.x-17,y:k.p.y-17,w:34,h:34}:{x:k.p.x-7,y:k.p.y-7,w:14,h:14});
 const items=[];for(const k of marks){if(!k.t||k.p.x<-10||k.p.x>370||k.p.y<-10||k.p.y>430)continue;items.push({p:k.p,s:label(wrap(k.t),k.c,k.dim),pri:k.pri,c:k.c,left:k.left});}
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
 ctx.font=MFONT;ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='#5fd8e8';ctx.fillText('N ↑',14,414);
 const sb=100*unit;if(sb>8&&sb<200){ctx.strokeStyle='#5fd8e8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(350-sb,411);ctx.lineTo(350,411);ctx.moveTo(350-sb,407);ctx.lineTo(350-sb,414);ctx.moveTo(350,407);ctx.lineTo(350,414);ctx.stroke();ctx.textAlign='right';ctx.fillText('100 m',350,404);ctx.textAlign='left';}}
const MAP_LEGEND=[['●','#3fe9ff','Refuge'],['⌂','#ffc45a','My base'],['◆','#ffd36b','Mission'],['⬢','#c0703f','Ore'],['✿','#7dff8a','Bio-flora'],['▲','#ff4fd8','Parasites'],['■','#ffa84a','Settlers'],['■','#46eeff','Military'],['!','#ff4060','Alert']].map(([g,c,t])=>'<span class="cq-key"><b style="color:'+c+'">'+g+'</b> '+t+'</span>').join('');

root.ConquestStyle=Object.freeze({id:'neon-frontline',version:1,create,footprints,allSites,map:mapPaint,MAP_LEGEND,resetMapCache(){if(MAPC.relief)MAPC.relief.canvas.width=MAPC.relief.canvas.height=0;MAPC.relief=null;}});
})(typeof window!=='undefined'?window:globalThis);
