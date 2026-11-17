'use strict';
// =====================================================================
// weather: what the Arcade weather and the map hazards LOOK and SOUND like (Session 5E-2e). Presentation only.
// The plan (which strike, where, when) is rules.js wxPlan; every hit is decided by the sim (game.js weatherTick) or, in a
// live match, by the room's own sim. Nothing here decides a hit, reads the sim's random() or touches a hitbox: this file
// reads the plan and the round clock and draws / plays what the plan says is happening right now, so the phone, a desktop
// and a live match all show the same thing at the same moment.
//   step(dt)        once a frame: sound cues, the vision effect's strength, the first-time tip (render.js drawBattle)
//   draw3D(H)       the hazards in the 3D scene (render3d.js frame3D gives the host H: glow batch, particles, MapEnv)
//   draw2D(g)       the same hazards on the 2D fallback
//   overlay(g,w,h)  glare / dust / dimmed lights over the whole picture (2D and 3D)
//   chip()          the HUD line under the clock;  sees(u): can my side see this enemy (minimap, edge markers)
// Every warning is the same every time: sound first, then light (owner: subtle, readable, learnable).
//   meteor   a falling whistle, a streak down the same slanted line, an amber glow growing on the landing spot
//   train    a two-tone horn (twice), rail lights running along both edges of its lane, its headlight far down the line
//   arc      three rising pulses of the coils (hum + glow + a ring on the ground), then it fires
//   vent     a hiss that rises, wisps from the cracks, a glow under the crater floor
//   tornado  it forms where it will start (thin, harmless), wind that gets louder the closer it is
//   laser    the row's two mounts glow, a faint flicker along the row, a rising whine
// =====================================================================
const WeatherFX=(()=>{
 const COL={meteor:'#ffab52',train:'#5fe9ff',arc:'#b8e8ff',vent:'#8ff5d2',tornado:'#d9b27a',laser:'#ff4a3a',white:'#ffffff'};
 const SHORT={meteor:'METEOR STRIKES',train:'MAGLEV TRAIN',arc:'PYLON OVERLOAD',vent:'CRATER VENTS',tornado:'SAND TORNADOES',laser:'CEILING LASERS',
  haze:'REGOLITH HAZE',flare:'SOLAR FLARE',steam:'VENT STEAM',dust:'DUST STORM',flicker:'POWER FLICKER'};
 const VCOL={haze:'#cdbfa8',flare:'#ffcf6a',steam:'#cfeef2',dust:'#e0b877',flicker:'#9fb6ff'};
 const PYH=2.45,BEAM_H=7.5,LEAN=0.02;   // LEAN: the glow batch lays a ribbon flat along its ground direction, so a beam that goes straight up leans a hair away from the camera to get its width across the screen   // the Longshot pylon's coil; where a ceiling laser comes down from
 const cues=new WeakMap(),pend=[],RG={},BLK=[0,0,0];
 let visS=0,flick=1,tdN=0,mk='',envOn=false,M3=null,arcT=null,tipAt=-99;
 const cl=(v,a,b)=>v<a?a:v>b?b:v,rnd=(a,b)=>a+(b-a)*Math.random(),hsh=n=>{const v=Math.sin(n*12.9898)*43758.5453;return v-Math.floor(v);};
 const plan=()=>typeof wx!=='undefined'&&wx&&(state==='play'||state==='round')&&!(typeof rangeRun!=='undefined'&&rangeRun)?wx.P:null;   // never over the practice range (its engine has no weather)
 const flip=()=>typeof pvpOn==='function'&&pvpOn()&&typeof pvp!=='undefined'&&!!pvp&&!!pvp.flip;   // a live match on team 1: the whole map is turned for you
 const fX=x=>flip()?W-x:x,fY=y=>flip()?H-y:y,fD=d=>flip()?-d:d;
 const cue=z=>{let c=cues.get(z);if(!c){c={w:0,h:0,p:0,sx:null};cues.set(z,c);}return c;};
 const snd=(k,x,y,v)=>{if(typeof fx==='function')fx('wx',{k,x,y,v});};
 const warnT=z=>z.t-z.w;
 // ---- once a frame ----
 function step(dt){
  // a live match: this phone works the plan out itself from the room's seed (pvp.js put it in MM), round by round
  if(typeof pvpOn==='function'&&pvpOn()&&typeof MM!=='undefined'&&MM&&Number.isInteger(MM.wx)&&(state==='play'||state==='round')){
   const rd=series?series.round:0;if(typeof wx==='undefined'||!wx||wx.round!==rd||wx.P.map!==curMap||wx.seed!==MM.wx)wxStart();}
  const p=plan();
  if(!p){visS=0;flick=1;pend.length=0;if(typeof fx==='function')fx('wxloop',{wind:0,buzz:0});return;}
  const key=wx.seed+'|'+curMap;if(key!==mk){mk=key;tdN=0;tipAt=-99;}
  const t=elapsed,fresh=at=>t-at<0.7&&state==='play';
  let wind=0,buzz=0;
  for(const z of p.hz){
   if(z.w>t+0.02)break;
   const end=wxEnd(z);if(t>end+3)continue;
   const c=cue(z),hz=p.haz||'meteor';
   if(!c.w){c.w=1;if(fresh(z.w)&&!z.soft){snd(z.k==='c'?(z.vent?'ventWarn':'meteorWarn'):z.k==='t'?'trainHorn':z.k==='l'?'laserWarn':z.k==='n'?'tornadoForm':'arcPulse0',fX(z.x===undefined?10:z.x),fY(z.y===undefined?16:z.y));tip(hz);}}
   if(z.k==='a')while(c.p<2&&t>=z.w+c.p+1){c.p++;if(fresh(z.w+c.p))snd('arcPulse'+c.p,fX(z.x),fY(z.y));}
   if(z.k==='t'&&!c.p&&t>=z.w+1.5){c.p=1;if(fresh(z.w+1.5))snd('trainHorn',10,16,1.25);}
   if(!c.h&&t>=z.t){c.h=1;if(fresh(z.t)){pend.push(z);
    if(!z.soft)snd(z.k==='c'?(z.vent?'ventHit':'meteorHit'):z.k==='t'?'trainPass':z.k==='l'?'laserFire':z.k==='n'?'tornadoUp':'arcHit',fX(z.x===undefined?10:z.x),fY(z.y===undefined?16:z.y));}}
   if(me&&z.k==='n'&&t<z.e+1){const q=wxPos(z,Math.max(t,z.t)),d=Math.hypot(fX(q[0])-me.x,fY(q[1])-me.y),g=t<z.t?(t-z.w)/warnT(z)*0.5:t>z.e?1-(t-z.e):1;wind=Math.max(wind,cl(1-d/13,0.12,1)*g);}
   if(me&&z.k==='l'&&t>=z.t&&t<=end){const q=wxPos(z,t);buzz=Math.max(buzz,cl(1-Math.hypot(fX(q[0])-me.x,fY(q[1])-me.y)/14,0.2,1));}
  }
  // the whole-map vision effect: it builds for 2 s before it counts (the sim's rule starts at t0), and clears in 1.5 s
  let s=0;const V=p.vis?WX_VIS[p.vis]:null;
  if(V&&!V.local)for(const w of p.win){const k=t<w.t0-2?0:t<w.t0?(t-(w.t0-2))/2*0.6:t<w.t1?Math.min(1,0.6+(t-w.t0)*0.8):t<w.t1+1.5?1-(t-w.t1)/1.5:0;if(k>s)s=k;}
  visS+=(s-visS)*Math.min(1,dt*6);
  flick=1;
  if(p.vis==='flicker'&&visS>0.02&&!(typeof GraphicsMotion!=='undefined'&&GraphicsMotion.reduced())){const w=p.win.find(w=>t>=w.t0-2&&t<w.t1+1.5),a=w?t-(w.t0-2):9;
   flick=a<2?(hsh(Math.floor(t*17))<0.5?0.25:1):hsh(Math.floor(t*9)+7)<0.07?0.55:1;}   // the lights stutter on their way down, then hold dim with the odd blink
  if(p.vis==='dust')wind=Math.max(wind,visS*0.55);
  if(typeof fx==='function')fx('wxloop',{wind,buzz});
 }
 // the first times a pilot meets a hazard, one line says how to dodge it (three times per hazard, then never again)
 function tip(hz){
  if(typeof save==='undefined'||!save||elapsed-tipAt<30)return;const n=(save.wxTip=save.wxTip||{})[hz]|0;if(n>=3)return;
  save.wxTip[hz]=n+1;tipAt=elapsed;if(typeof store==='function')store();
  if(typeof banner!=='undefined')banner={t:4,txt:WX_HZ[hz].how,c:COL[hz]};
 }
 function takedown(){tdN++;}
 // how the earned finish stands, counting this match's takedowns on top of the server's record. counted: false when this
 // match plays the phone's own weather roll (no ticket in time): the server will not count it, and the HUD says so
 function progress(){
  const M=typeof WX_MAP!=='undefined'&&WX_MAP[curMap];if(!M)return null;
  const live=typeof pvpOn==='function'&&pvpOn(),counted=live||(typeof battleWx!=='undefined'&&battleWx!==null)||(typeof SRV_ECO!=='undefined'&&!SRV_ECO);
  const base=typeof save!=='undefined'&&save&&save.hz?save.hz[curMap]|0:0;
  return {fin:M.fin,n:PAINTS[M.fin].n,have:Math.min(WX_FINISH_N,base+(counted?tdN:0)),need:WX_FINISH_N,now:tdN,counted,done:base>=WX_FINISH_N};
 }
 // can my side see this enemy right now (dust, glare, a cloud)? The same rule the sim uses for locking on (rules.js wxSight)
 function sees(u){
  const p=plan();if(!p||!p.vis||!me)return true;const f=flip();
  for(const v of units){if(v.hp<=0||v.team!==me.team)continue;
   if(Math.hypot(v.x-u.x,v.y-u.y)<=wxSight(p,elapsed,f?W-v.x:v.x,f?H-v.y:v.y,f?W-u.x:u.x,f?H-u.y:u.y))return true;}
  return false;
 }
 function chip(){
  const p=plan();if(!p||!p.k)return null;const t=elapsed;
  if(p.vis&&p.win.length){const w=p.win.find(w=>t>=w.t0&&t<w.t1);if(w)return {txt:SHORT[p.vis]+' '+Math.ceil(w.t1-t)+'s',c:VCOL[p.vis],hot:1};}
  return {txt:(p.haz?SHORT[p.haz]:'')+(p.haz&&p.vis?' · ':'')+(p.vis?SHORT[p.vis]:''),c:p.haz?COL[p.haz]:VCOL[p.vis],hot:0};
 }
 // ---- 3D ----
 const rgbOf=(H,h)=>RG[h]||(RG[h]=H.rgb(h));
 function meshes(H){
  if(M3&&M3.scene===H.scene)return M3;
  const T=H.T,g=new T.Group();g.visible=false;
  // the maglev: three cars and a nose, white steel with a dark window band; its lights are drawn in the glow batch
  const lit=c=>new T.MeshLambertMaterial({color:c}),box=(m,w,h,d,x,y,z)=>{const b=new T.Mesh(new T.BoxGeometry(w,h,d),m);b.position.set(x,y,z);g.add(b);return b;};
  const body=lit('#cfd8e2'),dark=lit('#141b26'),trim=lit('#2f6f88');
  for(let i=0;i<3;i++){const x=-1.55-i*2.62;box(body,2.5,0.95,2.3,x,0.62,0);box(dark,2.52,0.3,2.32,x,0.78,0);box(trim,2.5,0.1,2.36,x,0.2,0);box(dark,2.3,0.12,1.5,x,1.13,0);}
  const nose=box(body,1.1,0.7,2.0,-0.42,0.52,0);nose.rotation.z=-0.28;box(dark,0.5,0.28,1.7,-0.5,0.8,0).rotation.z=-0.5;
  H.scene.add(g);
  // a sand tornado: two nested open funnels with a streaked skin, turning against each other
  const cv=document.createElement('canvas');cv.width=128;cv.height=128;const c=cv.getContext('2d');c.clearRect(0,0,128,128);c.fillStyle='rgba(255,255,255,0.62)';c.fillRect(0,0,128,128);
  for(let i=0;i<26;i++){const y=hsh(i*4.3)*128;c.fillStyle='rgba(60,40,20,'+(0.1+hsh(i*2.9)*0.22)+')';c.fillRect(0,y,128,2+hsh(i*5.1)*7);}   // darker bands turning with it
  for(let i=0;i<70;i++){const x=hsh(i*3.1)*128,y=hsh(i*7.7+1)*128,l=18+hsh(i+5)*46,a=0.1+hsh(i*1.7)*0.34;c.strokeStyle='rgba(255,255,255,'+a+')';c.lineWidth=2+hsh(i*2.3)*5;c.beginPath();c.moveTo(x,y);c.lineTo(x+l,y-l*0.34);c.stroke();
   c.beginPath();c.moveTo(x-128,y);c.lineTo(x+l-128,y-l*0.34);c.stroke();}
  const tex=new T.CanvasTexture(cv);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  const torn=[];for(let i=0;i<2;i++){const G=new T.Group(),parts=[];
   for(const [rt,rb,h,col,op] of [[1.6,0.32,4.6,'#c39a66',0.8],[1.05,0.18,4.2,'#e6cda3',0.7]]){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,20,4,true),new T.MeshBasicMaterial({map:tex,color:col,transparent:true,opacity:op,depthWrite:false,side:T.DoubleSide}));m.position.y=h/2;m.userData.op=op;m.renderOrder=17;G.add(m);parts.push(m);}
   G.visible=false;H.scene.add(G);torn.push({G,parts});}
  return M3={scene:H.scene,train:g,torn,tex};
 }
 function dispose(){if(M3){try{M3.scene.remove(M3.train);for(const t of M3.torn)M3.scene.remove(t.G);M3.tex.dispose();}catch(e){}M3=null;}envOn=false;}
 function draw3D(H){
  const p=plan();envDrive(H,p);
  if(!p){if(M3){M3.train.visible=false;for(const t of M3.torn)t.G.visible=false;}pend.length=0;return;}
  const t=elapsed,M=meshes(H);let ti=0,trainOn=false;
  for(const z of p.hz){
   if(z.w>t+0.02)break;if(t>wxEnd(z)+2.5)continue;
   if(z.k==='c'){if(z.vent)vent3(H,z,t);else meteor3(H,z,t);}else if(z.k==='a')arc3(H,z,t);else if(z.k==='t')trainOn=train3(H,z,t,M)||trainOn;
   else if(z.k==='l')laser3(H,z,t);else if(z.k==='n'&&ti<2)tornado3(H,z,t,M.torn[ti++]);}
  for(;ti<2;ti++)M.torn[ti].G.visible=false;M.train.visible=trainOn;
  for(const z of pend)impact3(H,z);pend.length=0;
  clouds3(H,p,t);
  if(p.vis==='dust'&&visS>0.05&&me&&!H.quiet){const n=Math.round((H.low?2:5)*visS);   // grit streaking across the view
   for(let i=0;i<n;i++)H.emit(false,{x:me.x-11+Math.random()*20,y:0.15+Math.random()*2.4,z:me.y-10+Math.random()*13,vx:9+Math.random()*6,vz:Math.random()-0.5,life:0.55,s0:0.1,s1:0.34,c:'#c9a878',a:0.3});}
 }
 // a meteor: it always comes down the same slanted line (from high in the north-west), so the streak points at the spot
 function meteor3(H,z,t){
  if(t>=z.t)return;const S=H.SFX,x=fX(z.x),y=fY(z.y),soft=!!z.soft,pw=cl((t-z.w)/warnT(z),0,1),C=rgbOf(H,COL.meteor);
  if(!soft){const hot=pw>0.82&&!H.quiet?0.75+0.25*Math.sin(t*38):1;   // the rock's own shadow grows on the spot, inside an amber ring; both flicker just before it lands
   S.disc(x,0.028,y,z.r*(0.35+0.65*pw),BLK,1,0.1+0.3*pw);S.disc(x,0.03,y,z.r*(0.5+0.5*pw),C,(0.08+0.3*pw*pw)*hot,0.12*pw);S.ring(x,0.035,y,z.r,0.035,C,(0.16+0.42*pw)*hot,40);
   if(!H.quiet&&Math.random()<0.25+pw*0.5)H.emit(true,{x:x+rnd(-1,1)*z.r*0.6,y:0.05,z:y+rnd(-1,1)*z.r*0.6,vy:0.7+Math.random(),life:0.6,s0:0.1,s1:0.02,c:'#ffb35a',a:0.7});}
  const k=1-pw,dx=-0.3,dy=0.93,dz=-0.2,hx=x+dx*16*k,hy=0.35+dy*16*k,hz=y+dz*16*k,L=soft?1.3:2.7;
  S.seg(hx,hy,hz,hx+dx*L,hy+dy*L,hz+dz*L,soft?0.045:0.3,0.02,rgbOf(H,soft?COL.meteor:'#ff7a2a'),soft?0.4:0.85);
  if(!soft){S.seg(hx,hy,hz,hx+dx*L*0.55,hy+dy*L*0.55,hz+dz*L*0.55,0.13,0.015,rgbOf(H,'#ffe9c4'),1);S.sprite(hx,hy,hz,0.55,rgbOf(H,'#ffd9a0'),1);S.sprite(hx,hy,hz,0.24,rgbOf(H,COL.white),1);
   if(!H.low&&!H.quiet)H.emit(false,{x:hx+dx*L,y:hy+dy*L,z:hz+dz*L,life:0.8,s0:0.2,s1:0.7,c:'#4a423c',a:0.22});}
  else S.sprite(hx,hy,hz,0.1,C,0.6);
 }
 function vent3(H,z,t){
  const S=H.SFX,x=fX(z.x),y=fY(z.y),C=rgbOf(H,COL.vent);
  if(t<z.t){const pw=cl((t-z.w)/warnT(z),0,1),b=H.quiet?1:0.75+0.25*Math.sin(t*(6+pw*10));
   S.disc(x,0.03,y,z.r*0.92,C,(0.06+0.24*pw)*b,0.16*pw);S.ring(x,0.035,y,z.r,0.035,C,(0.12+0.34*pw)*b,44);
   const HOT=rgbOf(H,'#ffb070');for(let i=0;i<7;i++){const a=hsh(z.id*3+i*5.3)*6.283,r0=z.r*(0.08+0.12*hsh(i+z.id)),r1=z.r*(0.5+0.4*hsh(i*2.1+z.id)),a2=a+(hsh(i*9.7)-0.5)*0.5;   // the cracks light up from below
    const mx=x+Math.cos(a2)*(r0+r1)/2,mz=y+Math.sin(a2)*(r0+r1)/2;S.seg(x+Math.cos(a)*r0,0.04,y+Math.sin(a)*r0,mx,0.04,mz,0.035,0.03,HOT,(0.15+0.75*pw)*b);S.seg(mx,0.04,mz,x+Math.cos(a)*r1,0.04,y+Math.sin(a)*r1,0.03,0.012,HOT,(0.12+0.6*pw)*b);}
   if(!H.quiet){const n=(H.low?0.4:1)*(8+44*pw)/60;for(let i=0;i<3;i++)if(Math.random()<n){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*z.r*0.8;   // wisps from the cracks
     H.emit(false,{x:x+Math.cos(a)*r,y:0.05,z:y+Math.sin(a)*r,vy:0.6+pw*2,life:1,s0:0.2,s1:0.85,c:'#e6f4f1',a:0.4});}
    if(Math.random()<pw*0.5){const a=Math.random()*6.283,r=Math.random()*z.r*0.6;H.once(x+Math.cos(a)*r,0.06,y+Math.sin(a)*r,0.3,'#ffe0a8',0.5*pw);}}
   return;}
  const te=t-z.t;if(te>1.1)return;const k=te/1.1,h=6.5*Math.min(1,te*6);   // the eruption: a column, a ring running out to the edge of the blast
  const f=1-k*k,Wt=rgbOf(H,'#f2fffb');
  S.seg(x,0.05,y,x,h,y-LEAN,z.r*0.34*(1-k*0.4),z.r*0.2,C,0.9*f,0.55*f);S.seg(x,0.05,y,x,h*0.85,y-LEAN,z.r*0.14,0.06,Wt,f,0.6*f);S.sprite(x,0.5,y,z.r*0.55,Wt,0.9*f,0.3*f);
  S.shock(x,0.05,y,z.r*Math.min(1,te*3.4),0.6,C,0.9*(1-k),48);S.churn(x,0.04,y,z.r*Math.min(1,0.35+te*2.6),Wt,0.75*f,0.5*f);S.disc(x,0.045,y,z.r,C,0.5*(1-k),0.2*(1-k));
  if(!H.quiet&&te<0.7)for(let i=0;i<(H.low?1:3);i++){const a=Math.random()*6.283,r=z.r*(0.2+0.6*Math.random());   // steam boiling out over the whole blast, as long as it lasts
   H.emit(false,{x:x+Math.cos(a)*r,y:0.15,z:y+Math.sin(a)*r,vx:Math.cos(a)*2.4,vy:1.5+Math.random()*2.5,vz:Math.sin(a)*2.4,life:1.1,s0:0.5,s1:1.9,c:'#e9f6f3',a:0.42,drag:1.2});}
 }
 function arcTargets(){   // where the arcs run to: the far end of every clear line from the pylon, down the lane (plan coordinates)
  if(arcT)return arcT;arcT=[];const s={x:WX_ARC_AT[0],y:WX_ARC_AT[1],bl:WX_ARC_BL};
  for(let i=0;i<14;i++){const a=(i+0.5)/14*6.283,dx=Math.cos(a),dy=Math.sin(a);let d=1.6,last=null;
   for(;d<15;d+=0.4){const x=s.x+dx*d,y=s.y+dy*d;if(x<4.5||x>15.5||y<1||y>31||!wxArcSees(s,x,y))break;last=[x,y];}
   if(last)arcT.push(last);}
  return arcT;
 }
 function arc3(H,z,t){
  const S=H.SFX,x=fX(z.x),y=fY(z.y),C=rgbOf(H,COL.arc),Wt=rgbOf(H,COL.white);
  if(t<z.t){const pw=cl((t-z.w)/warnT(z),0,1);
   S.sprite(x,PYH,y,0.3+0.5*pw,C,0.2+0.5*pw);
   for(let i=0;i<3;i++){const age=t-(z.w+i);if(age<0||age>0.95)continue;const f=1-age/0.95;   // pulse i: brighter and wider each time
    S.sprite(x,PYH,y,(0.6+0.4*i)*(1+age*0.5),Wt,f*(0.45+0.2*i));S.ring(x,0.05,y,1.2+age*(6+i*1.5),0.05,C,0.3*f*(0.6+0.25*i),48);
    if(!H.quiet)for(let j=0;j<2+i;j++){const sd=Math.floor(t*22)*7+j*13+i,a=hsh(sd)*6.283,r=0.5+0.35*i;S.bolt(x,PYH,y,x+Math.cos(a)*r,PYH-0.2-hsh(sd+3)*0.9,y+Math.sin(a)*r,0.14,5,0.03,C,0.8*f,sd,0,1);}}
   return;}
  const te=t-z.t;if(te>0.45)return;const f=1-te/0.45,sd=H.quiet?z.id*31:Math.floor(t*26)*17;
  S.sprite(x,PYH,y,2.4,Wt,f);S.disc(x,0.05,y,4.5,C,0.35*f);
  arcTargets().forEach((q,i)=>S.bolt(x,PYH,y,fX(q[0]),0.12,fY(q[1]),0.55,10,0.07,C,0.95*f,sd+i*101,0.3,0));
  for(const u of units)if(u.hp>0&&wxArcSees(z,fX(u.x),fY(u.y)))S.bolt(x,PYH,y,u.x,0.55,u.y,0.4,9,0.1,Wt,f,sd+u.id*57+9,0.2,0);   // and into every tank it can see
 }
 function train3(H,z,t,M){
  const S=H.SFX,dir=fD(z.dir),dh=H.deckH,C=rgbOf(H,COL.train),yz=fY(z.y),x0=2,x1=18;
  const front=dir>0?x0+z.v*(t-z.t):x1-z.v*(t-z.t),done=dir>0?front-z.len>x1+30:front+z.len<x0-30;
  if(done)return false;
  if(t<z.t+0.35){const pw=cl((t-z.w)/warnT(z),0,1);   // rail lights run along both edges of its lane, in its direction, faster and brighter
   for(let i=0;i<=16;i++){const xi=x0+i,al=dir>0?xi-x0:x1-xi,b=H.quiet?1:Math.pow(0.5+0.5*Math.sin((al-t*(10+10*pw))*0.9),2),a=(0.12+0.7*pw)*(0.25+0.75*b);
    for(const e of [-1,1])S.sprite(xi,dh+0.1,yz+e*(z.hw+0.12),0.13+0.1*pw,C,a);}
   S.sprite(dir>0?x0-0.4:x1+0.4,dh+0.7,yz,0.5+1.0*pw,rgbOf(H,'#eaffff'),0.25+0.6*pw);}   // its headlight, down the line
  const on=dir>0?front>-28:front<48;if(!on)return false;
  M.train.visible=true;M.train.position.set(front,dh+0.06,yz);M.train.rotation.y=dir>0?0:Math.PI;
  const tail=front-dir*z.len;
  for(const e of [-1,1]){S.seg(front,dh+0.16,yz+e*1.2,tail,dh+0.16,yz+e*1.2,0.1,0.1,C,0.85);S.seg(front,dh+0.9,yz+e*1.17,tail,dh+0.9,yz+e*1.17,0.03,0.03,rgbOf(H,'#eaffff'),0.6);}
  S.sprite(front+dir*0.1,dh+0.6,yz,0.8,rgbOf(H,'#f4ffff'),1);S.seg(front,dh+0.5,yz,front+dir*6,dh+0.3,yz,0.25,1.3,C,0.22);
  S.disc((front+tail)/2,dh+0.05,yz,1.6,C,0.25);
  if(!H.quiet&&front>x0-2&&tail<x1+2)for(let i=0;i<(H.low?1:3);i++){const px=tail+dir*Math.random()*z.len;H.emit(true,{x:px,y:dh+0.1,z:yz+(Math.random()<0.5?-1.2:1.2),vx:-dir*(4+Math.random()*5),vy:0.6+Math.random()*1.5,life:0.35,s0:0.09,s1:0.02,c:'#bff6ff',a:0.9});}
  return true;
 }
 function laser3(H,z,t){
  const S=H.SFX,C=rgbOf(H,COL.laser),Wt=rgbOf(H,'#ffe9e2'),rz=fY(z.y),end=wxEnd(z);
  if(t>end+0.3)return;
  const pw=cl((t-z.w)/warnT(z),0,1),live=t>=z.t&&t<=end,fl=H.quiet?1:hsh(Math.floor(t*18)+z.id*5);
  for(const hx of [-0.1,W+0.1])S.sprite(hx,2.14,rz,0.22+0.3*pw,C,0.35+0.55*pw);   // the row's two wall mounts glow
  for(let hx=2;hx<W;hx+=4)S.sprite(hx,3.1,rz,0.1+0.12*pw,C,0.45+0.45*pw);   // and the ceiling mounts along the row
  if(!live){if(t<z.t&&fl<0.82){S.seg(0.15,0.05,rz,W-0.15,0.05,rz,0.06,0.06,C,(0.2+0.45*pw)*(0.45+0.55*fl));if(pw>0.5)S.seg(0.15,0.05,rz,W-0.15,0.05,rz,0.3,0.3,C,0.12*pw*fl);}   // a faint flicker along the row it will sweep
   if(t<z.t)S.sprite(fX(z.x0)+(fX(z.x0)<10?0.5:-0.5),0.35,rz,0.16+0.14*pw,C,0.3+0.5*pw);
   return;}
  const q=wxPos(z,t),cx=fX(q[0]);let floor=0.03;
  for(const w of walls)if(cx>w[0]&&cx<w[0]+w[2]&&rz>w[1]&&rz<w[1]+w[3]){floor=w.mhp?0.85:1.25;break;}   // it stops on top of whatever stands in the row
  S.seg(cx,BEAM_H,rz-LEAN,cx,floor,rz,0.2,0.3,C,0.9);S.seg(cx,BEAM_H,rz-LEAN,cx,floor,rz,0.07,0.11,Wt,1);
  S.disc(cx,floor+0.02,rz,z.r*1.05,C,0.5);S.sprite(cx,floor+0.25,rz,0.55,Wt,0.9);S.sprite(cx,BEAM_H,rz,0.5,C,0.8);
  S.seg(0.15,0.05,rz,W-0.15,0.05,rz,0.05,0.05,C,0.3);
  if(!H.quiet){if(Math.random()<0.7)S.sparks(cx,floor+0.1,rz,2,3.2,C,0.12,0.3,1,floor);
   const c=cue(z);if(floor<0.1&&(c.sx===null||Math.abs(cx-c.sx)>0.55)){c.sx=cx;H.scorch(cx,rz,0.34,0.013,0.4);}}
 }
 function tornado3(H,z,t,O){
  const q=wxPos(z,Math.max(t,z.t)),x=fX(q[0]),y=fY(q[1]),form=cl((t-z.w)/warnT(z),0,1),fade=t>z.e?cl(1-(t-z.e)/1.5,0,1):1,g=(t<z.t?0.2+0.5*form:1)*fade;
  if(g<=0.01){O.G.visible=false;return;}
  O.G.visible=true;O.G.position.set(x,0,y);const sw=H.quiet?0:Math.sin(t*1.3+z.id)*0.07;O.G.rotation.set(sw,0,sw*0.7);O.G.scale.set(0.35+0.65*g,0.5+0.5*g,0.35+0.65*g);
  O.parts.forEach((m,i)=>{if(!H.quiet)m.rotation.y+=H.dt*(i?-7.5:5.5);m.material.opacity=m.userData.op*(t<z.t?0.35+0.45*form:1)*fade;m.material.map.offset.y=H.quiet?0:(t*(i?0.5:0.3))%1;});
  if(H.quiet)return;
  const n=(H.low?2:4);for(let i=0;i<n;i++)if(Math.random()<g){const a=Math.random()*6.283,h=Math.random()*4.2,r=0.35+h*0.32;   // dust carried round the funnel
   H.emit(false,{x:x+Math.cos(a)*r,y:h,z:y+Math.sin(a)*r,vx:-Math.sin(a)*3.2,vy:0.9+Math.random(),vz:Math.cos(a)*3.2,life:0.75,s0:0.4,s1:1.2,c:Math.random()<0.5?'#c9a271':'#a8875e',a:0.42*g});}
  H.SFX.disc(x,0.03,y,z.r*1.25,BLK,1,0.22*g);   // its shadow on the ground: where it is, and how wide
  if(Math.random()<0.7*g){const a=Math.random()*6.283;H.emit(false,{x:x+Math.cos(a)*1.3,y:0.1,z:y+Math.sin(a)*1.3,vx:-Math.sin(a)*2.2,vz:Math.cos(a)*2.2,vy:0.2,life:0.9,s0:0.4,s1:1.2,c:'#b89468',a:0.24*g});}
 }
 // one-shot effects when a strike lands (queued by step, drawn here because they need the 3D host)
 function impact3(H,z){
  const x=fX(z.x===undefined?10:z.x),y=fY(z.y===undefined?16:z.y),S=H.SFX;
  if(z.k==='c'&&!z.vent){
   if(z.soft){for(let i=0;i<3;i++)H.emit(false,{x:x+rnd(-0.3,0.3),y:0.1,z:y+rnd(-0.3,0.3),vy:0.5+Math.random()*0.6,life:1.4,s0:0.2,s1:0.9,c:'#a59d90',a:0.22});return;}
   S.blast(x,0.15,y,1.35,1);if(H.env)H.env.flash([1,0.76,0.46],0.8,0.35);H.scorch(x,y,z.r*0.85,0.013,0.75);
   const n=H.low?6:14;for(let i=0;i<n;i++){const a=Math.random()*6.283,sp=0.6+Math.random()*1.6;   // regolith thrown up: this is what hangs as haze
    H.emit(false,{x:x+Math.cos(a)*0.4,y:0.25,z:y+Math.sin(a)*0.4,vx:Math.cos(a)*sp,vy:0.7+Math.random()*1.5,vz:Math.sin(a)*sp,life:2+Math.random()*1.8,s0:0.5,s1:2,c:'#9c9488',a:0.3,drag:0.9});}
  }else if(z.vent){
   if(H.env)H.env.flash([0.7,1,0.9],0.5,0.3);const n=H.low?10:24;
   for(let i=0;i<n;i++){const a=Math.random()*6.283,r=Math.random()*z.r*0.5;H.emit(false,{x:x+Math.cos(a)*r,y:0.2,z:y+Math.sin(a)*r,vx:Math.cos(a)*(0.5+Math.random()*2),vy:5+Math.random()*5,vz:Math.sin(a)*(0.5+Math.random()*2),life:1.2+Math.random(),s0:0.4,s1:1.7,c:'#e4f3f0',a:0.34,drag:1.4});}
   for(let i=0;i<(H.low?5:12);i++){const a=Math.random()*6.283;H.emit(true,{x,y:0.3,z:y,vx:Math.cos(a)*3,vy:4+Math.random()*5,vz:Math.sin(a)*3,life:0.8,s0:0.14,s1:0.03,c:'#ffd9a0',a:0.9,g:9});}
   S.sparks(x,0.3,y,10,5,rgbOf(H,COL.vent),0.16,0.6,1.6,0);
  }else if(z.k==='a'){if(H.env)H.env.flash([0.72,0.9,1],1.5,0.4);S.sparks(x,PYH,y,16,6,rgbOf(H,COL.arc),0.14,0.5,1.2,0);}
 }
 function clouds3(H,p,t){
  if(!p.clouds.length)return;const steam=p.vis==='steam',tint=rgbOf(H,steam?'#dcecee':'#a39b8e');
  for(const c of p.clouds){if(t<c.t0||t>=c.t1)continue;const x=fX(c.x),y=fY(c.y),k=steam?cl((t-c.t0)/2,0,1):cl((c.t1-t)/3,0,1)*cl((t-c.t0)/0.6+0.3,0,1);
   H.SFX.churn(x,0.05,y,c.r*1.05,tint,0.2*k,0.3*k);   // the cloud's own footprint on the ground: where it hides a tank
   if(H.quiet)continue;
   const n=(H.low?0.5:1)*c.r*c.r*(steam?1.5:1.7)/60;
   for(let i=0;i<3;i++)if(Math.random()<n){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*c.r;
    H.emit(false,steam?{x:x+Math.cos(a)*r,y:0.2+Math.random()*0.6,z:y+Math.sin(a)*r,vx:0.25,vy:0.3+Math.random()*0.35,life:3,s0:1.2,s1:2.7,c:Math.random()<0.5?'#e4f0f2':'#c9dade',a:0.36*k}
     :{x:x+Math.cos(a)*r,y:0.3+Math.random()*1.1,z:y+Math.sin(a)*r,vx:0.18,vy:0.08,life:3.2,s0:1.4,s1:2.6,c:Math.random()<0.5?'#aaa295':'#8f887c',a:0.38*k});}}
 }
 // the whole-map vision effect drives the map's own light and haze (MapEnv): nothing is rebuilt
 function envDrive(H,p){
  const E=H.env;if(!E)return;const V=p&&p.vis?WX_VIS[p.vis]:null,L=V&&!V.local?visS*flick:0;
  if(L<=0.004){if(envOn){envOn=false;E.reset(0.5);}return;}
  envOn=true;const B=E.preset(),mx=(a,b)=>a+(b-a)*L,m3=(a,b)=>[mx(a[0],b[0]),mx(a[1],b[1]),mx(a[2],b[2])],my=me?me.y:16;
  if(p.vis==='flare')E.set({sunI:mx(B.sunI,B.sunI*1.5),sun:m3(B.sun,[1,0.88,0.62]),exposure:mx(B.exposure,B.exposure*1.25),gGain:mx(B.gGain,B.gGain*1.1),fog:0.6*L,fogC:[1,0.88,0.66],fogNear:my-2.5,fogFar:my-11.5,stars:mx(B.stars,0)},0);
  else if(p.vis==='dust')E.set({sunI:mx(B.sunI,B.sunI*0.78),hemiI:mx(B.hemiI,B.hemiI*0.95),sun:m3(B.sun,[1,0.84,0.6]),sky:m3(B.sky,[0.66,0.56,0.42]),fog:0.72*L,fogC:[0.5,0.41,0.28],fogNear:my-2.5,fogFar:my-10.5,stars:mx(B.stars,0),earth:mx(B.earth,0.1),clear:m3(B.clear,[0.17,0.13,0.09])},0);
  else if(p.vis==='flicker')E.set({sunI:mx(B.sunI,B.sunI*0.34),hemiI:mx(B.hemiI,B.hemiI*0.55),fillI:mx(B.fillI,B.fillI*0.6),gGain:mx(B.gGain,B.gGain*0.86),shadow:mx(B.shadow,0.25)},0);
 }
 // ---- over the whole picture (2D canvas above the world): glare, dust, dimmed lights ----
 function overlay(g,vw,vh){
  const p=plan();if(!p||!p.vis||visS<=0.01||WX_VIS[p.vis].local)return;const L=visS*flick,tt=typeof GraphicsMotion!=='undefined'&&GraphicsMotion.reduced()?0:performance.now()/1000;
  g.save();
  if(p.vis==='flare'){
   let gr=g.createLinearGradient(0,0,0,vh*0.78);gr.addColorStop(0,'rgba(255,238,196,'+0.5*L+')');gr.addColorStop(0.42,'rgba(255,216,150,'+0.2*L+')');gr.addColorStop(1,'rgba(255,200,120,0)');g.fillStyle=gr;g.fillRect(0,0,vw,vh);
   g.globalCompositeOperation='lighter';const sx=vw*0.74,sy=vh*0.05,r=Math.max(vw,vh)*0.6,b=1+0.05*Math.sin(tt*2.3);
   gr=g.createRadialGradient(sx,sy,0,sx,sy,r*b);gr.addColorStop(0,'rgba(255,250,236,'+0.85*L+')');gr.addColorStop(0.12,'rgba(255,234,186,'+0.42*L+')');gr.addColorStop(0.5,'rgba(255,214,150,'+0.1*L+')');gr.addColorStop(1,'rgba(255,210,140,0)');g.fillStyle=gr;g.fillRect(0,0,vw,vh);
   for(let i=0;i<5;i++){const a=0.55+i*0.42+Math.sin(tt*0.6+i)*0.04,len=r*(0.9+0.25*Math.sin(tt*1.1+i*2));   // the bloom's rays
    gr=g.createLinearGradient(sx,sy,sx+Math.cos(a)*len,sy+Math.sin(a)*len);gr.addColorStop(0,'rgba(255,240,200,'+0.22*L+')');gr.addColorStop(1,'rgba(255,230,180,0)');g.strokeStyle=gr;g.lineWidth=Math.max(6,vw*0.03);g.beginPath();g.moveTo(sx,sy);g.lineTo(sx+Math.cos(a)*len,sy+Math.sin(a)*len);g.stroke();}
   for(let i=1;i<=3;i++){const k=i*0.28,gx=sx+(vw*0.5-sx)*k*2.1,gy=sy+(vh*0.5-sy)*k*2.1,rr=vw*(0.035+0.02*i);gr=g.createRadialGradient(gx,gy,0,gx,gy,rr);gr.addColorStop(0,'rgba(255,220,170,'+0.16*L+')');gr.addColorStop(0.7,'rgba(255,190,120,'+0.07*L+')');gr.addColorStop(1,'rgba(255,190,120,0)');g.fillStyle=gr;g.fillRect(gx-rr,gy-rr,rr*2,rr*2);}   // lens ghosts
  }else if(p.vis==='dust'){
   const gr=g.createLinearGradient(0,0,0,vh);gr.addColorStop(0,'rgba(176,142,92,'+0.4*L+')');gr.addColorStop(0.45,'rgba(172,140,92,'+0.16*L+')');gr.addColorStop(1,'rgba(160,130,88,'+0.05*L+')');g.fillStyle=gr;g.fillRect(0,0,vw,vh);
   g.strokeStyle='rgba(240,218,178,'+0.26*L+')';g.lineWidth=Math.max(1,vw/420);g.beginPath();
   for(let i=0;i<46;i++){const sp=0.35+hsh(i*3.3)*0.5,x=((hsh(i)*1.3+tt*sp)%1.3-0.15)*vw,y=hsh(i*7.1)*vh,l=vw*(0.05+hsh(i*1.9)*0.09);g.moveTo(x,y);g.lineTo(x+l,y+l*0.06);}
   g.stroke();
  }else if(p.vis==='flicker'){
   g.fillStyle='rgba(2,4,10,'+0.2*L+')';g.fillRect(0,0,vw,vh);
   const gr=g.createRadialGradient(vw/2,vh*0.56,Math.min(vw,vh)*0.2,vw/2,vh*0.56,Math.max(vw,vh)*0.75);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,6,'+0.42*L+')');g.fillStyle=gr;g.fillRect(0,0,vw,vh);
  }
  g.restore();
 }
 // ---- the 2D fallback: the same hazards, flat (X, Y, sc: render.js) ----
 function draw2D(g){
  const p=plan();if(!p)return;const t=elapsed,px=x=>X(fX(x)),py=y=>Y(fY(y)),A=(c,a)=>{const n=parseInt(c.slice(1),16);return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')';};
  g.save();
  for(const c of p.clouds){if(t<c.t0||t>=c.t1)continue;const gr=g.createRadialGradient(px(c.x),py(c.y),0,px(c.x),py(c.y),c.r*sc);gr.addColorStop(0,A(p.vis==='steam'?'#dbeaee':'#a59d90',0.5));gr.addColorStop(1,A(p.vis==='steam'?'#dbeaee':'#a59d90',0));g.fillStyle=gr;g.beginPath();g.arc(px(c.x),py(c.y),c.r*sc,0,7);g.fill();}
  for(const z of p.hz){
   if(z.w>t+0.02)break;const end=wxEnd(z);if(t>end+1.2||z.soft)continue;const pw=cl((t-z.w)/warnT(z),0,1),col=COL[p.haz||'meteor'];
   if(z.k==='c'){const x=px(z.x),y=py(z.y),r=z.r*sc;
    if(t<z.t){g.fillStyle=A(col,0.06+0.22*pw*pw);g.beginPath();g.arc(x,y,r*(0.45+0.55*pw),0,7);g.fill();g.strokeStyle=A(col,0.15+0.35*pw);g.lineWidth=1.5;g.beginPath();g.arc(x,y,r,0,7);g.stroke();
     if(!z.vent){const k=1-pw;g.strokeStyle=A('#ffe2b0',0.9);g.lineWidth=3;g.beginPath();g.moveTo(x-k*sc*5,y-k*sc*12);g.lineTo(x-k*sc*5-sc*0.9,y-k*sc*12-sc*2.2);g.stroke();}}
    else{const k=(t-z.t)/1.1;if(k<1){g.strokeStyle=A(col,0.8*(1-k));g.lineWidth=4;g.beginPath();g.arc(x,y,r*Math.min(1,k*3.4),0,7);g.stroke();g.fillStyle=A('#ffffff',0.5*(1-k));g.beginPath();g.arc(x,y,r*0.3,0,7);g.fill();}}}
   else if(z.k==='a'){const x=px(z.x),y=py(z.y);
    if(t<z.t){for(let i=0;i<3;i++){const age=t-(z.w+i);if(age<0||age>0.95)continue;g.strokeStyle=A(col,0.5*(1-age/0.95));g.lineWidth=2;g.beginPath();g.arc(x,y,(1.2+age*(6+i*1.5))*sc,0,7);g.stroke();}g.fillStyle=A('#ffffff',0.25+0.6*pw);g.beginPath();g.arc(x,y,sc*(0.4+0.5*pw),0,7);g.fill();}
    else if(t-z.t<0.45){g.strokeStyle=A('#eaf8ff',1-(t-z.t)/0.45);g.lineWidth=3;g.beginPath();for(const q of arcTargets()){g.moveTo(x,y);const mx=(x+px(q[0]))/2+(hsh(Math.floor(t*26)+q[0])-0.5)*sc*1.4,my=(y+py(q[1]))/2+(hsh(Math.floor(t*26)+q[1])-0.5)*sc*1.4;g.lineTo(mx,my);g.lineTo(px(q[0]),py(q[1]));}g.stroke();}}
   else if(z.k==='t'){const dir=fD(z.dir),y=py(z.y),front=dir>0?2+z.v*(t-z.t):18-z.v*(t-z.t);
    if(t<z.t+0.35){g.fillStyle=A(col,0.2+0.6*pw);for(let i=0;i<=16;i++)for(const e of [-1,1]){const b=Math.pow(0.5+0.5*Math.sin(((dir>0?i:16-i)-t*(10+10*pw))*0.9),2);g.globalAlpha=0.3+0.7*b;g.fillRect(X(2+i)-2,y+e*(z.hw+0.12)*sc*GK-2,4,4);}g.globalAlpha=1;}
    const a=Math.max(2,Math.min(front,front-dir*z.len)),b=Math.min(18,Math.max(front,front-dir*z.len));if(b>a){g.fillStyle='#cfd8e2';g.fillRect(X(a),y-z.hw*sc*GK,(b-a)*sc,z.hw*2*sc*GK);g.fillStyle=A(col,0.9);g.fillRect(X(a),y-z.hw*sc*GK,(b-a)*sc,3);g.fillRect(X(a),y+z.hw*sc*GK-3,(b-a)*sc,3);}}
   else if(z.k==='l'){const y=py(z.y);
    if(t<z.t){g.strokeStyle=A(col,(0.1+0.3*pw)*(hsh(Math.floor(t*18))<0.8?1:0.2));g.lineWidth=1.5;g.beginPath();g.moveTo(X(0),y);g.lineTo(X(W),y);g.stroke();}
    else if(t<=end){const q=wxPos(z,t),x=px(q[0]);g.strokeStyle=A(col,0.25);g.lineWidth=1.5;g.beginPath();g.moveTo(X(0),y);g.lineTo(X(W),y);g.stroke();g.fillStyle=A(col,0.55);g.beginPath();g.arc(x,y,z.r*sc,0,7);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(x,y,z.r*sc*0.4,0,7);g.fill();}}
   else if(z.k==='n'){const q=wxPos(z,Math.max(t,z.t)),x=px(q[0]),y=py(q[1]),k=(t<z.t?0.25+0.5*pw:1)*(t>z.e?Math.max(0,1-(t-z.e)/1.5):1);
    for(let i=0;i<4;i++){g.strokeStyle=A(i%2?'#e3c79a':'#c9a271',0.55*k);g.lineWidth=sc*0.16;g.beginPath();g.arc(x,y,z.r*sc*(0.3+i*0.24),t*(5+i)+i,t*(5+i)+i+4.2);g.stroke();}}
  }
  g.restore();
 }
 return {step,draw3D,draw2D,overlay,chip,sees,takedown,progress,dispose,COL,SHORT,VCOL,get vis(){return visS*flick;},get td(){return tdN;}};
})();
function wxTakedown(){WeatherFX.takedown();}
