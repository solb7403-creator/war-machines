// Trailer director: injected into the game page after boot (dev only, never shipped).
// A virtual clock drives every frame, so captures are smooth whatever the render speed.
(function(){
 const D=window.DIR={hud:true,cam:null,ai:true,base:null,camf:null};
 const _db=window.drawBattle;window.drawBattle=function(){if(D.nonum){nums.length=0;pops.length=0;}_db();};
 const _hud=window.drawHUD;window.drawHUD=function(){if(D.hud)_hud();};
 D.saveBase=()=>{fit();D.base={sc,ox,oy};};
 D.applyCam=()=>{
  if(D.camf)D.camf();
  if(!D.cam){if(D.base){sc=D.base.sc;ox=D.base.ox;oy=D.base.oy;}return;}
  const b=D.base,z=D.cam.z;sc=b.sc*z;
  ox=vw/2-D.cam.x*sc;oy=vh*(D.cam.vy||0.5)-D.cam.y*sc*GK;
 };
 const brain=()=>({mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0});
 D.pump=()=>{const q=window.__rafq;window.__rafq=[];q.forEach(f=>f(window.__VT));window.__rafq=[];};
 // one rendered frame of dt seconds
 D.step=dt=>{
  window.__VT+=dt*1000;
  if(D.ai&&me&&me.hp>0&&state==='play'){if(!me.brain)me.brain=brain();botAI(dt,me);}
  if(D.pre)D.pre(dt);
  D.applyCam();
  const q=window.__rafq;window.__rafq=[];
  if(!q.includes(frame))q.push(frame);
  for(const f of q)f(window.__VT);
 };
 // simulate without drawing (warm-up)
 D.sim=(secs,dt)=>{dt=dt||1/30;const n=Math.round(secs/dt);
  for(let i=0;i<n&&state==='play';i++){window.__VT+=dt*1000;if(D.ai&&me&&me.hp>0){if(!me.brain)me.brain=brain();botAI(dt,me);}if(D.pre)D.pre(dt);update(dt);fxTick(dt);}};
 D.load=o=>{
  save.welcomed=true;save.mp=Math.max(save.mp||0,40);save.termsOk=1;
  save.wTier=save.wTier||{};save.cTier=save.cTier||{};save.wOwn=save.wOwn||{};save.cOwn=save.cOwn||{};
  for(const k of ['pulse','twin','siege']){save.wOwn[k]=[0,1,2];if(save.wTier[k]<0)save.wTier[k]=0;}
  for(const k of ['scout','vanguard','titan']){save.cOwn[k]=[0,1,2];if(save.cTier[k]<0)save.cTier[k]=0;}
  if(o.w==='moon'){save.moonbeam=true;save.weapon='moon';}else{save.weapon=o.w;save.wTier[o.w]=o.wt||0;}
  save.chassis=o.c||'vanguard';save.cTier[save.chassis]=o.ct||0;
  save.paints=Object.assign(save.paints||{},{hyper:1,gold:1,void:1,nebula:1,ember:1,founder:1});save.paint=o.paint||'stock';
  save.skin=o.skin?'lunar':'default';if(o.skin)save.skinOwned=true;
  save.vg=o.vg||0;save.up={hull:4,cannon:4,engine:4,target:4,reactor:4};
  store();
 };
 D.match=(g,m,mp)=>{if(typeof inBattle==='function'&&inBattle()){state='menu';try{exitBattle();}catch(e){}}closeAll();save.gtype=g;save.mode=m;save.map=mp;store();prepareMatch();startMatch();D.saveBase();};
 D.place=(u,x,y,a)=>{u.x=u.px=u.ox=u.sx0=x;u.y=u.py=u.oy=y;if(a!==undefined){u.ang=a;u.hd=a;}};
 D.foes=()=>units.filter(u=>u.team!==me.team&&u.hp>0);
 D.nearest=(from)=>{let b=null,bd=1e9;for(const u of units)if(u.team!==from.team&&u.hp>0){const d=Math.hypot(u.x-from.x,u.y-from.y);if(d<bd){bd=d;b=u;}}return b;};
 D.fire=(u,tgt)=>{tgt=tgt||D.nearest(u);u.sp=SUPER_MAX;u.sup=null;const a=tgt?Math.atan2(tgt.y-u.y,tgt.x-u.x):u.ang;return useSuper(u,a);};
 D.god=on=>{for(const u of units)if(u.team===me.team){u.mhp=on?1e6:u.mhp;if(on)u.hp=1e6;}};
})();
