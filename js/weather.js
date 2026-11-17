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
 const COL={meteor:'#ffab52',train:'#5fe9ff',arc:'#b8e8ff',vent:'#ffc48a',tornado:'#d9b27a',laser:'#ff4a3a',white:'#ffffff'};
 const SHORT={meteor:'METEOR STRIKES',train:'MAGLEV TRAIN',arc:'PYLON OVERLOAD',vent:'CRATER VENTS',tornado:'SAND TORNADOES',laser:'CEILING LASERS',
  haze:'REGOLITH HAZE',flare:'SOLAR FLARE',steam:'VENT STEAM',dust:'DUST STORM',flicker:'POWER FLICKER'};
 const VCOL={haze:'#cdbfa8',flare:'#ffcf6a',steam:'#cfeef2',dust:'#e0b877',flicker:'#9fb6ff'};
 const PYH=1.55,BEAM_H=9,LEAN=0.03;   // LEAN: the glow batch lays a ribbon flat along its ground direction, so a beam that goes straight up leans a hair away from the camera to get its width across the screen   // the Longshot pylon's coil; where a ceiling laser comes down from
 const cues=new WeakMap(),pend=[],RG={},BLK=[0,0,0];
 let visS=0,flick=1,tdN=0,mk='',envOn=false,M3=null,arcT=null,tipAt=-99,fr=0,d3=-9,PRE=null,PREk='';const LOOP={wind:0,buzz:0};
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
   const rd=series?series.round:0;if(WX_MAP[curMap]&&(typeof wx==='undefined'||!wx||wx.round!==rd||wx.P.map!==curMap||wx.seed!==MM.wx))wxStart();}
  if(++fr-d3>2)pend.length=0;   // the 3D view is not drawing (2D fallback, not loaded yet): impacts are not saved up for it
  const p=plan();
  if(!p){visS=0;flick=1;pend.length=0;LOOP.wind=LOOP.buzz=0;if(typeof fx==='function')fx('wxloop',LOOP);return;}
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
   flick=a<2?(hsh(Math.floor(t*6))<0.5?0.5:1):hsh(Math.floor(t*4)+7)<0.13?0.5:1;}   // at most 6 changes a second while it stutters, 4 while it holds, and never more than half way back   // the lights stutter on their way down, then hold dim with the odd blink
  if(p.vis==='dust')wind=Math.max(wind,visS*0.55);
  LOOP.wind=wind;LOOP.buzz=buzz;if(typeof fx==='function')fx('wxloop',LOOP);
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
 function chip(){   // the HUD line: the hazard's name always; the vision effect beside it, counting down while it lasts
  const p=plan();if(!p||!p.k)return null;const t=elapsed,w=p.vis&&p.win.length?p.win.find(w=>t>=w.t0&&t<w.t1):null;
  return {txt:(p.haz?SHORT[p.haz]:'')+(p.haz&&p.vis?' · ':'')+(p.vis?SHORT[p.vis]+(w?' '+Math.ceil(w.t1-t)+'s':''):''),c:w?VCOL[p.vis]:p.haz?COL[p.haz]:VCOL[p.vis],hot:w?1:0};
 }
 // ---- 3D ----
 const rgbOf=(H,h)=>RG[h]||(RG[h]=H.rgb(h));
 // how many particles to emit this frame for a rate of n per 1/60 s: the same amount of dust per second on a 30, 60 or 120 Hz screen
 const cnt=(H,n)=>{const v=n*Math.min(3,H.dt*60);return Math.floor(v)+(Math.random()<v-Math.floor(v)?1:0);};
 function meshes(H){
  if(M3&&M3.scene===H.scene)return M3;
  const T=H.T,train=new T.Group(),g=new T.Group();train.visible=false;train.add(g);g.scale.x=0.8;g.position.x=-0.6;   // g: the model, nose first along -x; fitted to the sim's train (front at 0, 8 long)
  // the maglev: three cars and a nose, white steel with a dark window band; its lights are drawn in the glow batch
  // every part is baked into ONE geometry per material (five draw calls for the whole train, not one per box)
  const lit=c=>new T.MeshLambertMaterial({color:c}),bins=new Map(),put=(m,G)=>{const N=G.index?G.toNonIndexed():G;let b=bins.get(m);if(!b){b={P:[],N:[]};bins.set(m,b);}b.P.push(...N.attributes.position.array);b.N.push(...N.attributes.normal.array);};
  const box=(m,w,h,d,x,y,z,rz)=>{const G=new T.BoxGeometry(w,h,d);if(rz)G.rotateZ(rz);G.translate(x,y,z);put(m,G);};
  const body=lit('#d7dee8'),dark=lit('#10161f'),trim=lit('#1f8fb0'),roof=lit('#aab6c4'),lamp=new T.MeshBasicMaterial({color:'#9ff3ff'});
  for(let i=0;i<3;i++){const x=-2.2-i*2.62;box(body,2.5,0.95,2.3,x,0.64,0);box(trim,2.52,0.12,2.36,x,0.3,0);box(dark,2.56,0.16,2.2,x,0.1,0);box(roof,2.4,0.08,1.9,x,1.15,0);
   box(lamp,2.2,0.03,0.14,x,1.2,0);for(const e of [-1,1])box(trim,2.4,0.05,0.16,x,1.14,e*1.0);   // a light bar and two blue lines on the roof: what the camera above sees
   for(const e of [-1,1]){box(dark,2.5,0.36,0.03,x,0.84,e*1.16);box(lamp,2.44,0.28,0.02,x,0.84,e*1.18);box(lamp,2.5,0.05,0.03,x,0.52,e*1.165);}   // one lit window band and a light line down each flank
   if(i<2)box(dark,0.14,0.8,1.9,x-1.31,0.6,0);}
  // a tapered nose and tail: a four-sided cone laid along the track, its square section turned flat (2.3 wide, 0.96 tall where it meets the car)
  const cone=(m,len,x,dir)=>{const G=new T.CylinderGeometry(0.2,1.414,len,4,1);G.rotateY(Math.PI/4);G.scale(0.48,1,1.15);G.rotateZ(dir*Math.PI/2);G.translate(x,0.62,0);put(m,G);};
  cone(body,2.1,0.1,-1);cone(body,1.3,-9.05,1);
  for(const e of [-1,1])box(lamp,0.08,0.12,0.3,1.0,0.5,e*0.22);box(dark,0.9,0.22,1.3,-0.35,0.95,0,-0.42);
  for(const [m,b] of bins){const G=new T.BufferGeometry();G.setAttribute('position',new T.Float32BufferAttribute(b.P,3));G.setAttribute('normal',new T.Float32BufferAttribute(b.N,3));g.add(new T.Mesh(G,m));}
  H.scene.add(train);
  // a sand tornado: two nested open funnels with a streaked skin, turning against each other
  const cv=document.createElement('canvas');cv.width=128;cv.height=128;const c=cv.getContext('2d');c.fillStyle='rgba(255,255,255,0.9)';c.fillRect(0,0,128,128);
  for(let i=0;i<90;i++){const x=hsh(i*3.1)*128,y=hsh(i*7.7+1)*128,l=30+hsh(i+5)*70,dk=hsh(i*1.7)<0.6;c.strokeStyle=dk?'rgba(40,26,12,'+(0.16+hsh(i*2.9)*0.3)+')':'rgba(255,244,220,'+(0.2+hsh(i*4.1)*0.4)+')';c.lineWidth=2+hsh(i*2.3)*7;   // streaks wound round it
   for(const o of [0,-128,128]){c.beginPath();c.moveTo(x+o,y);c.lineTo(x+o+l,y-l*0.22);c.stroke();}}
  {const gd=c.createLinearGradient(0,0,0,128);gd.addColorStop(0,'rgba(0,0,0,1)');gd.addColorStop(0.3,'rgba(0,0,0,0)');c.globalCompositeOperation='destination-out';c.fillStyle=gd;c.fillRect(0,0,128,128);c.globalCompositeOperation='source-over';}   // the top of the funnel feathers out (no hard rim)
  const tex=new T.CanvasTexture(cv);tex.wrapS=T.RepeatWrapping;tex.repeat.set(2,1);
  const torn=[];for(let i=0;i<2;i++){const G=new T.Group(),parts=[];
   for(const [rt,rb,h,col,op] of [[1.8,0.4,5.2,'#7a5430',0.8],[1.3,0.26,4.9,'#4f361c',0.92],[0.75,0.14,4.6,'#2a1c0c',0.98]]){const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,24,6,true),new T.MeshBasicMaterial({map:tex,color:col,transparent:true,opacity:op,depthWrite:false,side:T.DoubleSide}));m.position.y=h/2;m.userData.op=op;m.renderOrder=17;G.add(m);parts.push(m);}
   G.visible=false;H.scene.add(G);torn.push({G,parts});}
  return M3={scene:H.scene,train,torn,tex};
 }
 function dispose(){if(M3){try{const free=o=>o.traverse(m=>{if(m.geometry)m.geometry.dispose();if(m.material)m.material.dispose();});M3.scene.remove(M3.train);free(M3.train);for(const t of M3.torn){M3.scene.remove(t.G);free(t.G);}M3.tex.dispose();}catch(e){}M3=null;}envOn=false;PRE=null;}
 function draw3D(H){
  const p=plan();envDrive(H,p);
  if(!p){d3=fr;if(M3){M3.train.visible=false;for(const t of M3.torn)t.G.visible=false;}pend.length=0;return;}
  d3=fr;const t=elapsed,M=p.haz==='train'||p.haz==='tornado'?meshes(H):M3&&M3.scene===H.scene?M3:null;let ti=0,trainOn=false;   // the train and the funnels are built on the maps that have them
  for(const z of p.hz){
   if(z.w>t+0.02)break;if(t>wxEnd(z)+2.5)continue;
   if(z.k==='c'){if(z.vent)vent3(H,z,t);else meteor3(H,z,t);}else if(z.k==='a')arc3(H,z,t);else if(z.k==='t'&&M)trainOn=train3(H,z,t,M)||trainOn;
   else if(z.k==='l')laser3(H,z,t);else if(z.k==='n'&&M&&ti<2)tornado3(H,z,t,M.torn[ti++]);}
  if(M){for(;ti<2;ti++)M.torn[ti].G.visible=false;M.train.visible=trainOn;}
  for(const z of pend)impact3(H,z);pend.length=0;
  clouds3(H,p,t);
  if(p.vis==='dust'&&visS>0.05&&me&&!H.quiet){const n=cnt(H,(H.low?1.5:4)*visS);   // grit streaking across the view
   for(let i=0;i<n;i++)H.emit(false,{x:me.x-11+Math.random()*20,y:0.15+Math.random()*2.4,z:me.y-10+Math.random()*13,vx:9+Math.random()*6,vz:Math.random()-0.5,life:0.55,s0:0.1,s1:0.34,c:'#c9a878',a:0.3});}
 }
 // a meteor: it always comes down the same slanted line (from high in the north-west), so the streak points at the spot.
 // On the ground: the rock's own shadow grows inside one amber ring; both flicker just before it lands
 function meteor3(H,z,t){
  const S=H.SFX,x=fX(z.x),y=fY(z.y),soft=!!z.soft,C=rgbOf(H,COL.meteor),Wt=rgbOf(H,COL.white);
  if(t>=z.t){const te=t-z.t;if(soft||te>0.55)return;const k=te/0.55;   // the landing: a white-hot flash, a ring of dust running out
   if(te<0.2){S.sprite(x,0.6,y,3*(1-te/0.2*0.4),Wt,1-te/0.2);S.disc(x,0.05,y,z.r*1.1,Wt,0.9*(1-te/0.2));}
   S.shock(x,0.05,y,z.r*(0.25+0.95*k),0.5,rgbOf(H,'#ffd9a8'),0.8*(1-k),44);S.disc(x,0.04,y,z.r*0.9,rgbOf(H,'#ff8a3a'),0.5*(1-k),0.25*(1-k));return;}
  const pw=cl((t-z.w)/warnT(z),0,1);
  if(!soft){const hot=pw>0.8&&!H.quiet?0.7+0.3*Math.sin(t*40):1;
   S.disc(x,0.028,y,z.r*(0.25+0.75*pw),BLK,1,(0.3+0.5*pw)*hot);S.disc(x,0.029,y,z.r*(0.12+0.5*pw*pw),BLK,1,0.25+0.45*pw);S.ring(x,0.035,y,z.r,0.05,C,(0.5+0.4*pw)*hot,44,0,0,0,undefined,0.55+0.3*pw);
   if(!H.quiet&&cnt(H,0.25+pw*0.5))H.emit(true,{x:x+rnd(-1,1)*z.r*0.6,y:0.05,z:y+rnd(-1,1)*z.r*0.6,vy:0.7+Math.random(),life:0.6,s0:0.1,s1:0.02,c:'#ffb35a',a:0.7});}
  const k=1-pw,dx=-0.3,dy=0.93,dz=-0.2,hx=x+dx*16*k,hy=0.35+dy*16*k,hz=y+dz*16*k,L=soft?1.2:2.2;
  S.seg(hx,hy,hz,hx+dx*L,hy+dy*L,hz+dz*L,soft?0.04:0.2,0.015,rgbOf(H,soft?COL.meteor:'#ff7a2a'),soft?0.4:0.85);
  if(!soft){S.seg(hx,hy,hz,hx+dx*L*0.5,hy+dy*L*0.5,hz+dz*L*0.5,0.09,0.012,rgbOf(H,'#ffe9c4'),1);S.sprite(hx,hy,hz,0.42,rgbOf(H,'#ffd9a0'),1);S.sprite(hx,hy,hz,0.2,Wt,1);
   if(!H.low&&!H.quiet&&cnt(H,1))H.emit(false,{x:hx+dx*L,y:hy+dy*L,z:hz+dz*L,life:0.8,s0:0.2,s1:0.7,c:'#4a423c',a:0.22});}
  else S.sprite(hx,hy,hz,0.1,C,0.6);
 }
 // a crater vent: the cracks in the floor light up from below and steam wisps out; then it blows: a ragged column of steam
 // and ash, hot at its root, with rock thrown out of it (particles: js/weather.js impact3 and here)
 function vent3(H,z,t){
  const S=H.SFX,x=fX(z.x),y=fY(z.y),C=rgbOf(H,COL.vent),HOT=rgbOf(H,'#ff9a4a');
  if(t<z.t){const pw=cl((t-z.w)/warnT(z),0,1),b=H.quiet?1:0.75+0.25*Math.sin(t*(6+pw*10));
   S.disc(x,0.03,y,z.r*0.9,HOT,(0.05+0.2*pw)*b,0.1*pw);S.ring(x,0.035,y,z.r,0.04,C,(0.25+0.4*pw)*b,48,0,0,0,undefined,0.3+0.3*pw);
   const AM=rgbOf(H,'#ff8a2a');for(let i=0;i<7;i++){let a=hsh(z.id*3+i*5.3)*6.283,r=z.r*(0.05+0.08*hsh(i+z.id)),px=x+Math.cos(a)*r,pz=y+Math.sin(a)*r;   // the cracks: jagged, branching, lit amber from below
    const R1=z.r*(0.5+0.4*hsh(i*2.1+z.id)),al=(0.3+0.7*pw)*b;
    for(let k=0;k<5&&r<R1;k++){a+=(hsh(i*7.3+k*3.1+z.id)-0.5)*1.1;const st=z.r*(0.1+0.1*hsh(i+k*5.7)),nx=px+Math.cos(a)*st,nz=pz+Math.sin(a)*st,w=0.055*(1-k*0.14);S.seg(px,0.04,pz,nx,0.04,nz,w,w*0.8,AM,al,0.45*pw);
     if(k===2){const a2=a+(hsh(i*3.3)<0.5?0.9:-0.9);S.seg(nx,0.04,nz,nx+Math.cos(a2)*st*1.3,0.04,nz+Math.sin(a2)*st*1.3,w*0.7,0.01,AM,al*0.8,0.3*pw);}
     px=nx;pz=nz;r+=st;}}
   if(!H.quiet){const n=cnt(H,(H.low?0.4:1)*(8+44*pw)/20);for(let i=0;i<n;i++){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*z.r*0.8;
     H.emit(false,{x:x+Math.cos(a)*r,y:0.05,z:y+Math.sin(a)*r,vy:0.6+pw*2,life:1,s0:0.2,s1:0.85,c:'#e6f0ec',a:0.4});}
    if(cnt(H,pw*0.5)){const a=Math.random()*6.283,r=Math.random()*z.r*0.6;H.once(x+Math.cos(a)*r,0.06,y+Math.sin(a)*r,0.3,'#ffe0a8',0.5*pw);}}
   return;}
  const te=t-z.t;if(te>1.5)return;const k=te/1.5,f=1-k*k,Wt=rgbOf(H,'#f4f6f2'),ASH=rgbOf(H,'#6a655e');
  if(te<0.3)S.sprite(x,0.5,y,z.r*0.75,rgbOf(H,'#ffb060'),1-te/0.3,0.2);S.disc(x,0.04,y,z.r*0.55,HOT,0.7*f,0.2*f);   // an amber flash at its root
  S.shock(x,0.05,y,z.r*Math.min(1,te*3),0.6,rgbOf(H,'#ece6da'),0.85*(1-k),48);
  // the column: soft clouds stacked up it, widening and thinning towards the top (no beam, no edges), ash in the lower half
  const ht=7.5*Math.min(1,te*4.5),wob=H.quiet?0:te*2;
  for(let i=0;i<8;i++){const u=(i+0.5)/8,hh=0.3+ht*u,r=z.r*(0.2+0.26*u)*(0.8+0.4*Math.min(1,te*3)),sx=Math.sin(i*2.4+wob)*0.18*u*z.r,a=f*(1-u*0.75);
   S.sprite(x+sx,hh,y-LEAN*hh,r,i%3===1&&u<0.6?ASH:Wt,0.55*a,0.5*a);}
  if(!H.quiet&&te<0.9){const n=cnt(H,H.low?1.5:4);for(let i=0;i<n;i++){const a=Math.random()*6.283,r=z.r*0.3*Math.sqrt(Math.random()),up=6+Math.random()*6;   // steam driven up it, spreading as it slows
    H.emit(false,{x:x+Math.cos(a)*r,y:0.2,z:y+Math.sin(a)*r,vx:Math.cos(a)*1.2,vy:up,vz:Math.sin(a)*1.2,life:1+Math.random()*0.6,s0:0.7,s1:2.2,c:Math.random()<0.25?'#8a857d':Math.random()<0.5?'#f1f4f0':'#d9dfda',a:0.34,drag:1.6});}
   for(let i=cnt(H,H.low?0.7:1.5);i>0;i--){const a=Math.random()*6.283,r=z.r*(0.25+0.6*Math.random());H.emit(false,{x:x+Math.cos(a)*r,y:0.15,z:y+Math.sin(a)*r,vx:Math.cos(a)*2.4,vy:1.5+Math.random()*2.5,vz:Math.sin(a)*2.4,life:1.1,s0:0.6,s1:2,c:'#e9f0ec',a:0.32,drag:1.2});}}
 }
 function arcTargets(){   // where the arcs run to: down the lane both ways (the far end of each clear line from the pylon), and a short one to each cliff
  if(arcT)return arcT;arcT=[];const s={x:WX_ARC_AT[0],y:WX_ARC_AT[1],bl:WX_ARC_BL},D=[];
  for(const sg of [-1,1])for(const dg of [-34,-22,-11,-3,3,11,22,34]){const a=dg*Math.PI/180;D.push([Math.sin(a),sg*Math.cos(a)]);}
  D.push([1,0.12],[-1,-0.12]);
  for(const [dx,dy] of D){let last=null;for(let d=1.6;d<15;d+=0.4){const x=s.x+dx*d,y=s.y+dy*d;if(x<4.5||x>15.5||y<1||y>31||!wxArcSees(s,x,y))break;last=[x,y];}if(last)arcT.push(last);}
  return arcT;
 }
 function arc3(H,z,t){
  const S=H.SFX,x=fX(z.x),y=fY(z.y),C=rgbOf(H,'#5fc8ff'),Wt=rgbOf(H,COL.white);
  if(t<z.t){const pw=cl((t-z.w)/warnT(z),0,1);
   S.sprite(x,PYH,y,0.25+0.4*pw,C,0.3+0.5*pw);
   for(let i=0;i<3;i++){const age=t-(z.w+i);if(age<0||age>0.95)continue;const f=1-age/0.95;   // pulse i: brighter and wider each time
    S.sprite(x,PYH,y,(0.45+0.3*i)*(1+age*0.5),Wt,f*(0.4+0.18*i));S.ring(x,0.05,y,1.2+age*(6+i*1.5),0.09,C,0.5*f*(0.6+0.25*i),48,0,0,0,undefined,0.25*f);
    if(!H.quiet)for(let j=0;j<2+i;j++){const sd=Math.floor(t*22)*7+j*13+i,a=hsh(sd)*6.283,r=0.5+0.35*i;S.bolt(x,PYH,y,x+Math.cos(a)*r,PYH-0.2-hsh(sd+3)*0.9,y+Math.sin(a)*r,0.14,5,0.03,C,0.8*f,sd,0,1);}}
   return;}
  const te=t-z.t;if(te>0.45)return;const f=1-te/0.45,sd=H.quiet?z.id*31:Math.floor(t*26)*17;
  const V=rgbOf(H,'#7a6cff');S.sprite(x,PYH,y,1.1,Wt,f);S.sprite(x,PYH,y,2.2,V,0.5*f);S.disc(x,0.05,y,6.5,V,0.5*f,0.12*f);
  arcTargets().forEach((q,i)=>{const ex=fX(q[0]),ey=fY(q[1]);S.bolt(x,PYH,y,ex,0.12,ey,0.55,10,0.08,i%2?V:C,0.95*f,sd+i*101,0.3,0);S.disc(ex,0.05,ey,0.9,V,0.6*f);});   // each arc ends in a splash of light on the floor
  for(const u of units)if(u.hp>0&&wxArcSees(z,fX(u.x),fY(u.y)))S.bolt(x,PYH,y,u.x,0.55,u.y,0.4,9,0.1,Wt,f,sd+u.id*57+9,0.2,0);   // and into every tank it can see
 }
 function train3(H,z,t,M){
  const S=H.SFX,dir=fD(z.dir),dh=H.deckH,C=rgbOf(H,COL.train),yz=fY(z.y),x0=2,x1=18;
  const front=dir>0?x0+z.v*(t-z.t):x1-z.v*(t-z.t),done=dir>0?front-z.len>x1+30:front+z.len<x0-30;
  if(done)return false;
  if(t<z.t+0.35){const pw=cl((t-z.w)/warnT(z),0,1);   // rail lights run along both edges of its lane, in its direction, faster and brighter
   for(let i=0;i<=32;i++){const xi=x0+i*0.5,al=dir>0?xi-x0:x1-xi,b=H.quiet?1:Math.pow(0.5+0.5*Math.sin((al-t*(10+10*pw))*0.9),3),a=(0.3+0.7*pw)*(0.2+0.8*b);   // a pulse chasing along both edges of its lane
    for(const e of [-1,1]){S.sprite(xi,dh+0.1,yz+e*(z.hw+0.12),0.2+0.22*pw*b,C,a);if(i%2===0)S.disc(xi,dh+0.03,yz+e*(z.hw+0.12),0.5,C,0.35*a,0.1*a);}}
   for(const e of [-1,1])S.seg(x0,dh+0.04,yz+e*(z.hw+0.12),x1,dh+0.04,yz+e*(z.hw+0.12),0.05,0.05,C,0.2+0.5*pw,0.2*pw);   // the lane's two edges, lit
   const hl=dir>0?x0-0.4:x1+0.4;S.sprite(hl,dh+0.7,yz,0.7+1.3*pw,rgbOf(H,'#eaffff'),0.35+0.6*pw);S.seg(hl,dh+0.5,yz,hl+dir*(2+5*pw),dh+0.2,yz,0.3,1.2,C,0.12+0.25*pw);}   // its headlight down the line, and the beam it throws along the deck
  const on=dir>0?front>-28:front<48;if(!on)return false;
  M.train.visible=true;M.train.position.set(front,dh+0.06,yz);M.train.rotation.y=dir>0?0:Math.PI;
  const tail=front-dir*z.len;
  const far=front-dir*(z.len+12);
  for(const e of [-1,1]){S.seg(front,dh+0.2,yz+e*1.22,tail,dh+0.2,yz+e*1.22,0.16,0.16,C,1,0.3);S.seg(front,dh+0.92,yz+e*1.17,tail,dh+0.92,yz+e*1.17,0.05,0.05,rgbOf(H,'#eaffff'),0.8);
   S.seg(tail,dh+0.3,yz+e*1.1,far,dh+0.3,yz+e*1.1,0.3,0.02,C,0.5);}   // light strips along both flanks, and the streak it leaves
  S.seg(tail,dh+0.6,yz,far,dh+0.6,yz,0.9,0.05,rgbOf(H,'#dff8ff'),0.22);
  S.sprite(front+dir*0.1,dh+0.6,yz,1.1,rgbOf(H,'#f4ffff'),1);S.seg(front,dh+0.5,yz,front+dir*7,dh+0.2,yz,0.3,1.5,C,0.3);
  for(let i=0;i<4;i++)S.disc(front-dir*(1+i*2.2),dh+0.05,yz,1.5,C,0.4,0.12);   // the glow under it
  if(!H.quiet&&front>x0-2&&tail<x1+2)for(let i=cnt(H,H.low?1:3);i>0;i--){const px=tail+dir*Math.random()*z.len;H.emit(true,{x:px,y:dh+0.1,z:yz+(Math.random()<0.5?-1.2:1.2),vx:-dir*(4+Math.random()*5),vy:0.6+Math.random()*1.5,life:0.35,s0:0.09,s1:0.02,c:'#bff6ff',a:0.9});}
  return true;
 }
 function laser3(H,z,t){
  const S=H.SFX,C=rgbOf(H,COL.laser),Wt=rgbOf(H,'#ffe9e2'),rz=fY(z.y),end=wxEnd(z);
  if(t>end+0.6)return;
  const pw=cl((t-z.w)/warnT(z),0,1),live=t>=z.t&&t<=end,fl=H.quiet?1:hsh(Math.floor(t*18)+z.id*5);
  if(z.y===6||z.y===16||z.y===26)for(const hx of [-0.1,W+0.1]){S.sprite(hx,2.14,rz,0.3+0.4*pw,C,0.5+0.5*pw);S.sprite(hx,2.14,rz,0.12+0.1*pw,Wt,0.6+0.4*pw);}   // the row's two wall mounts glow (the housings the map has)
  const bl=H.quiet?1:0.55+0.45*Math.sin(t*(8+10*pw));S.seg(-0.1,3.1,rz,W+0.1,3.1,rz,0.035,0.035,rgbOf(H,'#5a1a14'),0.9,0.9);   // the rail the ceiling mounts ride on
  for(let hx=2;hx<W;hx+=4){S.seg(hx-0.22,3.1,rz,hx+0.22,3.1,rz,0.09,0.09,C,0.9,0.5);S.sprite(hx,3.1,rz,0.2+0.2*pw,C,(0.5+0.5*pw)*bl);S.seg(hx,3.05,rz-LEAN,hx,0.06,rz,0.02,0.16,C,(0.06+0.16*pw)*bl);S.disc(hx,0.04,rz,0.55,C,(0.2+0.4*pw)*bl);}   // the ceiling mounts blink faster as it comes, each with a thin aiming cone and its light on the floor
  if(t<z.t){   // a dashed flicker along the row it will sweep
   if(fl<0.9)for(let i=-1;i<20;i++){const a=Math.max(0.15,i+0.15+(H.quiet?0:(t*1.5)%1)),b=Math.min(W-0.15,i+0.75+(H.quiet?0:(t*1.5)%1));if(b>a)S.seg(a,0.05,rz,b,0.05,rz,0.14,0.14,C,(0.35+0.55*pw)*bl,0.25*pw);}   // a dashed line marching along the row it will sweep
   S.sprite(fX(z.x0)+(fX(z.x0)<10?0.5:-0.5),0.35,rz,0.22+0.2*pw,C,0.4+0.5*pw);
   return;}
  if(!live){const q=wxPos(z,end),cx=fX(q[0]),k=1-(t-end)/0.6;S.sprite(cx,0.3,rz,0.5*k,C,0.6*k);return;}
  const q=wxPos(z,t),cx=fX(q[0]),sg=fX(z.x1)>fX(z.x0)?1:-1;let floor=0.03;
  for(const w of walls)if(cx>w[0]&&cx<w[0]+w[2]&&rz>w[1]&&rz<w[1]+w[3]){floor=w.mhp?0.85:1.25;break;}   // it stops on top of whatever stands in the row
  // the beam comes down from above the picture: a wide soft glow, the beam, a white core
  S.seg(cx,BEAM_H,rz-LEAN,cx,floor,rz,0.75,0.9,C,0.22);S.seg(cx,BEAM_H,rz-LEAN,cx,floor,rz,0.3,0.38,C,0.95);S.seg(cx,BEAM_H,rz-LEAN,cx,floor,rz,0.1,0.14,Wt,1);
  for(let i=0;i<4;i++){const y0=BEAM_H+i*1.5,a=0.7*(1-(i+1)/5);S.seg(cx,y0+1.5,rz-LEAN*1.2,cx,y0,rz-LEAN,0.26,0.3,C,a);S.seg(cx,y0+1.5,rz-LEAN*1.2,cx,y0,rz-LEAN,0.08,0.1,Wt,a);}   // it fades out upwards: no end in mid-air
  S.disc(cx,floor+0.02,rz,z.r*1.15,C,0.6,0.1);S.sprite(cx,floor+0.3,rz,0.75,Wt,1);S.sprite(cx,floor+0.3,rz,1.5,C,0.5);
  const back=Math.min(7,Math.abs(cx-fX(z.x0)));S.seg(cx,0.045,rz,cx-sg*back,0.045,rz,0.5,0.1,rgbOf(H,'#ff6a2a'),0.85,0.3);S.seg(cx,0.05,rz,cx-sg*back*0.55,0.05,rz,0.2,0.04,rgbOf(H,'#ffd9a0'),0.9);   // the floor it has just crossed still glows
  if(!H.quiet){const ns=cnt(H,H.low?1:3);if(ns)S.sparks(cx,floor+0.1,rz,ns,3.6,C,0.13,0.35,1,floor);
   const c=cue(z);if(floor<0.1&&(c.sx===null||Math.abs(cx-c.sx)>0.5)){c.sx=cx;H.scorch(cx,rz,0.4,0.013,0.5);}}
 }
 // a sand tornado: while it forms, a swirl of dust on the ground with a thin thread rising out of it (no body yet: it cannot
 // touch anything); then the funnel: a dark core inside two turning skins, a skirt of dust at its foot, grit carried round it
 function tornado3(H,z,t,O){
  const q=wxPos(z,Math.max(t,z.t)),x=fX(q[0]),y=fY(q[1]),form=cl((t-z.w)/warnT(z),0,1),fade=t>z.e?cl(1-(t-z.e)/1.5,0,1):1,on=t>=z.t,g=(on?1:form)*fade,S=H.SFX;
  if(g<=0.01){O.G.visible=false;return;}
  const D=rgbOf(H,'#5a4024'),Lt=rgbOf(H,'#c8a26c'),sp=H.quiet?0:t*3.2;
  S.disc(x,0.03,y,z.r*(on?1.35:0.6+0.6*form),BLK,1,(on?0.34:0.22*form)*fade);   // its shadow: where it is, how wide
  for(let i=0;i<3;i++){const a0=sp*(1+i*0.25)+i*2.1,r=z.r*(on?0.55+i*0.3:0.3+0.35*form+i*0.18);S.ring(x,0.04,y,r,on?0.13:0.07,i%2?Lt:D,(on?0.7:0.3+0.4*form)*fade,20,0,0,a0,a0+3.4,0.6);}   // dust dragged round its foot
  O.G.visible=true;O.G.position.set(x,0,y);const sw=H.quiet?0:Math.sin(t*1.3+z.id)*0.07,wd=on?1:0.04+0.1*form*form,ht=on?1:0.1+0.45*form*form;   // while it forms: a short thin wisp that grows (the swirl on the ground carries the warning)
  O.G.rotation.set(sw,0,sw*0.7);O.G.scale.set(wd*(0.4+0.6*fade),ht,wd*(0.4+0.6*fade));
  O.parts.forEach((m,i)=>{m.visible=!(H.low&&i===1);if(!H.quiet)m.rotation.y+=H.dt*(i%2?-8:6);m.material.opacity=m.userData.op*(on?1:0.3+0.5*form)*fade;});   // LOW: two skins, not three
  if(!H.quiet)M3.tex.offset.x=(t*0.35)%1;
  if(H.quiet)return;
  const n=cnt(H,(H.low?2:4)*(on?1:0.7)*g);for(let i=0;i<n;i++){const a=Math.random()*6.283,h=Math.random()*4.4*ht,r=(0.35+h*0.34)*wd+0.1;   // grit carried round the funnel
   H.emit(false,{x:x+Math.cos(a)*r,y:h,z:y+Math.sin(a)*r,vx:-Math.sin(a)*3.4,vy:0.9+Math.random(),vz:Math.cos(a)*3.4,life:0.75,s0:0.4,s1:1.25,c:Math.random()<0.5?'#8c6a42':'#b08a5a',a:0.5*g});}
  for(let i=cnt(H,(H.low?2:3)*(on?1:0.6*form));i>0;i--){const a=Math.random()*6.283;H.emit(false,{x:x+Math.cos(a)*1.3,y:0.12,z:y+Math.sin(a)*1.3,vx:-Math.sin(a)*2.6+Math.cos(a)*0.9,vz:Math.cos(a)*2.6+Math.sin(a)*0.9,vy:0.35,life:1.1,s0:0.6,s1:1.8,c:Math.random()<0.5?'#8c6c46':'#6f5434',a:0.55*fade});}   // the skirt
  if(on&&cnt(H,0.5)){const a=Math.random()*6.283,h=0.4+Math.random()*2.6,r=0.5+h*0.36;H.emit(false,{x:x+Math.cos(a)*r,y:h,z:y+Math.sin(a)*r,vx:-Math.sin(a)*4,vy:0.6,vz:Math.cos(a)*4,life:0.6,s0:0.12,s1:0.1,c:'#3d2f20',a:0.9});}   // stones caught in it
 }
 // one-shot effects when a strike lands (queued by step, drawn here because they need the 3D host)
 function impact3(H,z){
  const x=fX(z.x===undefined?10:z.x),y=fY(z.y===undefined?16:z.y),S=H.SFX;
  if(z.k==='c'&&!z.vent){
   if(z.soft){for(let i=0;i<3;i++)H.emit(false,{x:x+rnd(-0.3,0.3),y:0.1,z:y+rnd(-0.3,0.3),vy:0.5+Math.random()*0.6,life:1.4,s0:0.2,s1:0.9,c:'#a59d90',a:0.22});return;}
   S.blast(x,0.15,y,1.35,1);if(H.env&&!H.quiet)H.env.flash([1,0.8,0.55],1,0.35);H.scorch(x,y,z.r*0.5,0.013,1);H.scorch(x,y,z.r*0.85,0.0135,0.55);
   for(let i=0;i<(H.low?8:18);i++){const a=Math.random()*6.283,sp=3+Math.random()*6;H.emit(false,{x,y:0.2,z:y,vx:Math.cos(a)*sp,vy:3+Math.random()*6,vz:Math.sin(a)*sp,life:0.7+Math.random()*0.5,s0:0.14,s1:0.08,c:'#2c2826',a:0.95,g:18});}   // rock thrown out of the crater
   const n=H.low?6:14;for(let i=0;i<n;i++){const a=Math.random()*6.283,sp=0.6+Math.random()*1.6;   // regolith thrown up: this is what hangs as haze
    H.emit(false,{x:x+Math.cos(a)*0.4,y:0.25,z:y+Math.sin(a)*0.4,vx:Math.cos(a)*sp,vy:0.7+Math.random()*1.5,vz:Math.sin(a)*sp,life:2+Math.random()*1.8,s0:0.6,s1:2.3,c:Math.random()<0.5?'#c4bdb0':'#a9a295',a:0.4,drag:0.9});}
  }else if(z.vent){
   if(H.env&&!H.quiet)H.env.flash([0.7,1,0.9],0.5,0.3);const n=H.low?10:24;
   for(let i=0;i<n;i++){const a=Math.random()*6.283,r=Math.random()*z.r*0.5;H.emit(false,{x:x+Math.cos(a)*r,y:0.2,z:y+Math.sin(a)*r,vx:Math.cos(a)*(0.5+Math.random()*2),vy:5+Math.random()*5,vz:Math.sin(a)*(0.5+Math.random()*2),life:1.2+Math.random(),s0:0.6,s1:2.2,c:'#eef4f1',a:0.26,drag:1.4});}
   for(let i=0;i<(H.low?5:12);i++){const a=Math.random()*6.283;H.emit(true,{x,y:0.3,z:y,vx:Math.cos(a)*3,vy:4+Math.random()*5,vz:Math.sin(a)*3,life:0.8,s0:0.14,s1:0.03,c:'#ffb070',a:0.9,g:9});}
   for(let i=0;i<(H.low?5:9);i++){const a=Math.random()*6.283,sp=2+Math.random()*5;H.emit(false,{x,y:0.3,z:y,vx:Math.cos(a)*sp,vy:6+Math.random()*7,vz:Math.sin(a)*sp,life:1.1+Math.random()*0.5,s0:0.34,s1:0.24,c:'#2e2a27',a:1,g:17});}   // rock thrown out of it
   S.sparks(x,0.3,y,10,5,rgbOf(H,COL.vent),0.16,0.6,1.6,0);
  }else if(z.k==='a'){if(H.env&&!H.quiet)H.env.flash([0.72,0.9,1],1.5,0.4);S.sparks(x,PYH,y,16,6,rgbOf(H,COL.arc),0.14,0.5,1.2,0);}
 }
 function clouds3(H,p,t){
  if(!p.clouds.length)return;const steam=p.vis==='steam',tint=rgbOf(H,steam?'#e6f0f0':'#cfc8bb');
  for(const c of p.clouds){if(t<c.t0||t>=c.t1)continue;const x=fX(c.x),y=fY(c.y),k=steam?cl((t-c.t0)/2,0,1):cl((c.t1-t)/3,0,1)*cl((t-c.t0)/0.6+0.3,0,1);
   H.SFX.disc(x,0.05,y,c.r*1.1,tint,0.34*k,0.46*k);   // the cloud's own footprint on the ground: where it hides a tank
   if(H.quiet)continue;
   const n=cnt(H,(H.low?0.5:1)*c.r*c.r*(steam?0.7:1.3)/20);   // few, large and soft: a cloud is overdraw, and a phone pays for every layer
   for(let i=0;i<n;i++){const a=Math.random()*6.283,r=Math.sqrt(Math.random())*c.r;
    H.emit(false,steam?{x:x+Math.cos(a)*r,y:0.2+Math.random()*0.6,z:y+Math.sin(a)*r,vx:0.25,vy:0.3+Math.random()*0.35,life:3,s0:1.5,s1:3.2,c:Math.random()<0.5?'#e4f0f2':'#c9dade',a:0.38*k}
     :{x:x+Math.cos(a)*r,y:0.3+Math.random()*1.1,z:y+Math.sin(a)*r,vx:0.2,vy:0.12,life:3.4,s0:1.7,s1:3.3,c:Math.random()<0.5?'#d2cbbd':'#b9b2a4',a:0.48*k});}}
 }
 // the whole-map vision effect drives the map's own light and haze (MapEnv): nothing is rebuilt
 function envDrive(H,p){
  const E=H.env;if(!E)return;const V=p&&p.vis?WX_VIS[p.vis]:null,L=V&&!V.local?visS*flick:0;
  if(L<=0.004){if(envOn){envOn=false;E.reset(0.5);}return;}
  envOn=true;if(!PRE||PREk!==E.mapId()){PRE=E.preset();PREk=E.mapId();}const B=PRE,mx=(a,b)=>a+(b-a)*L,m3=(a,b)=>[mx(a[0],b[0]),mx(a[1],b[1]),mx(a[2],b[2])],my=me?me.y:16;
  if(p.vis==='flare')E.set({sunI:mx(B.sunI,B.sunI*1.35),sun:m3(B.sun,[1,0.88,0.62]),exposure:mx(B.exposure,B.exposure*1.08),gGain:mx(B.gGain,B.gGain*1.03),fog:0.36*L,fogC:[0.96,0.82,0.6],fogNear:my-3.5,fogFar:my-14,stars:mx(B.stars,0)},0);
  else if(p.vis==='dust')E.set({sunI:mx(B.sunI,B.sunI*0.78),hemiI:mx(B.hemiI,B.hemiI*0.95),sun:m3(B.sun,[1,0.84,0.6]),sky:m3(B.sky,[0.66,0.56,0.42]),fog:0.66*L,fogC:[0.62,0.52,0.37],fogNear:my-2.5,fogFar:my-10.5,stars:mx(B.stars,0),earth:mx(B.earth,0.1),clear:m3(B.clear,[0.17,0.13,0.09])},0);
  else if(p.vis==='flicker')E.set({sunI:mx(B.sunI,B.sunI*0.34),hemiI:mx(B.hemiI,B.hemiI*0.55),fillI:mx(B.fillI,B.fillI*0.6),gGain:mx(B.gGain,B.gGain*0.86),shadow:mx(B.shadow,0.25)},0);
 }
 // ---- over the whole picture (2D canvas above the world): glare, dust, dimmed lights ----
 function overlay(g,vw,vh,top){
  const p=plan();if(!p||!p.vis||visS<=0.01||WX_VIS[p.vis].local)return;top=top||0;const L=visS*flick,tt=typeof GraphicsMotion!=='undefined'&&GraphicsMotion.reduced()?0:performance.now()/1000,h=vh-top,f0=Math.min(0.2,70/h);
  g.save();g.beginPath();g.rect(0,top,vw,h);g.clip();g.translate(0,top);   // nothing over the HUD band; every wash starts from nothing just under it (f0), so there is no edge
  if(p.vis==='flare'){
   let gr=g.createLinearGradient(0,0,0,h*0.7);gr.addColorStop(0,'rgba(255,232,180,0)');gr.addColorStop(f0,'rgba(255,232,180,'+0.2*L+')');gr.addColorStop(0.5,'rgba(255,214,150,'+0.08*L+')');gr.addColorStop(1,'rgba(255,200,120,0)');g.fillStyle=gr;g.fillRect(0,0,vw,h);
   g.globalCompositeOperation='lighter';const sx=vw*1.02,sy=-h*0.04,r=Math.max(vw,h)*0.62,b=1+0.04*Math.sin(tt*2.3);   // the sun sits just outside the top right corner: only its bloom reaches in
   gr=g.createRadialGradient(sx,sy,0,sx,sy,r*b);gr.addColorStop(0,'rgba(255,246,224,'+0.5*L+')');gr.addColorStop(0.2,'rgba(255,228,176,'+0.2*L+')');gr.addColorStop(0.55,'rgba(255,212,150,'+0.05*L+')');gr.addColorStop(1,'rgba(255,210,140,0)');g.fillStyle=gr;g.fillRect(0,0,vw,h);
   for(let i=1;i<=3;i++){const k=i*0.2,gx=sx+(vw*0.4-sx)*k*2,gy=sy+(h*0.55-sy)*k*2,rr=Math.min(vw,h)*(0.03+0.018*i);gr=g.createRadialGradient(gx,gy,0,gx,gy,rr);gr.addColorStop(0,'rgba(255,220,170,'+0.12*L+')');gr.addColorStop(0.7,'rgba(255,190,120,'+0.05*L+')');gr.addColorStop(1,'rgba(255,190,120,0)');g.fillStyle=gr;g.fillRect(gx-rr,gy-rr,rr*2,rr*2);}   // lens ghosts
  }else if(p.vis==='dust'){
   const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(206,178,132,0)');gr.addColorStop(f0,'rgba(206,178,132,'+0.26*L+')');gr.addColorStop(0.5,'rgba(200,172,128,'+0.1*L+')');gr.addColorStop(1,'rgba(190,164,122,'+0.04*L+')');g.fillStyle=gr;g.fillRect(0,0,vw,h);
   g.lineCap='round';   // grit blown across: soft, tan, long
   g.strokeStyle='rgba(214,186,140,'+0.11*L+')';g.beginPath();   // one path, two passes (a wide faint one under a thin one): soft streaks without a gradient each
   for(let i=0;i<34;i++){const sp=0.3+hsh(i*3.3)*0.45,x=((hsh(i)*1.4+tt*sp)%1.4-0.2)*vw,y=(0.04+hsh(i*7.1)*0.96)*h,l=vw*(0.1+hsh(i*1.9)*0.16);g.moveTo(x,y);g.lineTo(x+l,y+l*0.05);}
   g.lineWidth=Math.max(3,vw/130);g.stroke();g.lineWidth=Math.max(1,vw/420);g.stroke();
  }else if(p.vis==='flicker'){
   let gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(2,4,10,0)');gr.addColorStop(f0,'rgba(2,4,10,'+0.2*L+')');gr.addColorStop(1,'rgba(2,4,10,'+0.2*L+')');g.fillStyle=gr;g.fillRect(0,0,vw,h);
   gr=g.createRadialGradient(vw/2,h*0.56,Math.min(vw,h)*0.2,vw/2,h*0.56,Math.max(vw,h)*0.75);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,6,'+0.42*L+')');g.fillStyle=gr;g.fillRect(0,0,vw,h);
  }
  g.restore();
 }
 // ---- the 2D fallback: the same hazards, flat (X, Y, sc: render.js) ----
  function draw2D(g,over){
  const p=plan();if(!p)return;over=!!over;const t=elapsed,px=x=>X(fX(x)),py=y=>Y(fY(y)),A=(c,a)=>{const n=parseInt(c.slice(1),16);return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')';};
  g.save();
  if(!over)for(const c of p.clouds){if(t<c.t0||t>=c.t1)continue;const gr=g.createRadialGradient(px(c.x),py(c.y),0,px(c.x),py(c.y),c.r*sc);gr.addColorStop(0,A(p.vis==='steam'?'#dbeaee':'#a59d90',0.5));gr.addColorStop(1,A(p.vis==='steam'?'#dbeaee':'#a59d90',0));g.fillStyle=gr;g.beginPath();g.arc(px(c.x),py(c.y),c.r*sc,0,7);g.fill();}
  for(const z of p.hz){
   if(z.w>t+0.02)break;const end=wxEnd(z);if(t>end+1.2||z.soft)continue;const pw=cl((t-z.w)/warnT(z),0,1),col=COL[p.haz||'meteor'];
   if(over!==(z.k==='t'||z.k==='l'||(z.k==='a'&&t>=z.t)))continue;   // the train rides the deck, a laser comes from the ceiling, the arcs fly over cover
   if(z.k==='c'){const x=px(z.x),y=py(z.y),r=z.r*sc;
    if(t<z.t){g.fillStyle=z.vent?A(col,0.06+0.22*pw*pw):'rgba(0,0,0,'+(0.12+0.3*pw)+')';g.beginPath();g.arc(x,y,r*(z.vent?0.45+0.55*pw:0.25+0.75*pw),0,7);g.fill();g.strokeStyle=A(col,0.3+0.4*pw);g.lineWidth=1.5;g.beginPath();g.arc(x,y,r,0,7);g.stroke();   // a meteor: its shadow inside one thin amber ring, as in 3D (never a red disc)
     if(!z.vent){const k=1-pw;g.strokeStyle=A('#ffe2b0',0.9);g.lineWidth=3;g.beginPath();g.moveTo(x-k*sc*5,y-k*sc*12);g.lineTo(x-k*sc*5-sc*0.9,y-k*sc*12-sc*2.2);g.stroke();}}
    else{const k=(t-z.t)/1.1;if(k<1){g.strokeStyle=A(col,0.8*(1-k));g.lineWidth=4;g.beginPath();g.arc(x,y,r*Math.min(1,k*3.4),0,7);g.stroke();g.fillStyle=A('#ffffff',0.5*(1-k));g.beginPath();g.arc(x,y,r*0.3,0,7);g.fill();}}}
   else if(z.k==='a'){const x=px(z.x),y=py(z.y);
    if(t<z.t){for(let i=0;i<3;i++){const age=t-(z.w+i);if(age<0||age>0.95)continue;g.strokeStyle=A(col,0.5*(1-age/0.95));g.lineWidth=2;g.beginPath();g.arc(x,y,(1.2+age*(6+i*1.5))*sc,0,7);g.stroke();}g.fillStyle=A('#ffffff',0.25+0.6*pw);g.beginPath();g.arc(x,y,sc*(0.4+0.5*pw),0,7);g.fill();}
    else if(t-z.t<0.45){g.strokeStyle=A('#eaf8ff',1-(t-z.t)/0.45);g.lineWidth=3;g.beginPath();for(const q of arcTargets()){g.moveTo(x,y);const mx=(x+px(q[0]))/2+(hsh(Math.floor(t*26)+q[0])-0.5)*sc*1.4,my=(y+py(q[1]))/2+(hsh(Math.floor(t*26)+q[1])-0.5)*sc*1.4;g.lineTo(mx,my);g.lineTo(px(q[0]),py(q[1]));}g.stroke();}}
   else if(z.k==='t'){const dir=fD(z.dir),y=py(z.y),front=dir>0?2+z.v*(t-z.t):18-z.v*(t-z.t);
    if(t<z.t+0.35){g.fillStyle=A(col,0.2+0.6*pw);for(let i=0;i<=16;i++)for(const e of [-1,1]){const b=Math.pow(0.5+0.5*Math.sin(((dir>0?i:16-i)-t*(10+10*pw))*0.9),2);g.globalAlpha=0.3+0.7*b;g.fillRect(X(2+i)-2,y+e*(z.hw+0.12)*sc*GK-2,4,4);}g.globalAlpha=1;}
    const a=Math.max(2,Math.min(front,front-dir*z.len)),b=Math.min(18,Math.max(front,front-dir*z.len));if(b>a){g.fillStyle='#cfd8e2';g.fillRect(X(a),y-z.hw*sc*GK,(b-a)*sc,z.hw*2*sc*GK);g.fillStyle=A(col,0.9);g.fillRect(X(a),y-z.hw*sc*GK,(b-a)*sc,3);g.fillRect(X(a),y+z.hw*sc*GK-3,(b-a)*sc,3);}}
   else if(z.k==='l'){const y=py(z.y);
    if(t<z.t){g.strokeStyle=A(col,(0.3+0.4*pw)*(hsh(Math.floor(t*6))<0.8?1:0.5));g.lineWidth=3;g.setLineDash([sc*0.5,sc*0.4]);g.lineDashOffset=-t*sc*1.5;g.beginPath();g.moveTo(X(0),y);g.lineTo(X(W),y);g.stroke();g.setLineDash([]);   // a dashed line marching along the row, and the row's mounts glowing at both walls
     for(const ex of [X(0.3),X(W-0.3)]){const gr=g.createRadialGradient(ex,y,0,ex,y,sc*(0.7+0.5*pw));gr.addColorStop(0,A(col,0.5+0.4*pw));gr.addColorStop(1,A(col,0));g.fillStyle=gr;g.beginPath();g.arc(ex,y,sc*(0.7+0.5*pw),0,7);g.fill();}}
    else if(t<=end){const q=wxPos(z,t),x=px(q[0]);g.strokeStyle=A(col,0.25);g.lineWidth=1.5;g.beginPath();g.moveTo(X(0),y);g.lineTo(X(W),y);g.stroke();g.fillStyle=A(col,0.55);g.beginPath();g.arc(x,y,z.r*sc,0,7);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(x,y,z.r*sc*0.4,0,7);g.fill();}}
   else if(z.k==='n'){const q=wxPos(z,Math.max(t,z.t)),x=px(q[0]),y=py(q[1]),k=(t<z.t?0.25+0.5*pw:1)*(t>z.e?Math.max(0,1-(t-z.e)/1.5):1);
    for(let i=0;i<4;i++){g.strokeStyle=A(i%2?'#e3c79a':'#c9a271',0.55*k);g.lineWidth=sc*0.16;g.beginPath();g.arc(x,y,z.r*sc*(0.3+i*0.24),t*(5+i)+i,t*(5+i)+i+4.2);g.stroke();}}
  }
  g.restore();
 }
 return {step,draw3D,draw2D,overlay,chip,sees,takedown,progress,dispose,in3D:false,COL,SHORT,VCOL,get vis(){return visS*flick;},get td(){return tdN;}};
})();
function wxTakedown(){WeatherFX.takedown();}
