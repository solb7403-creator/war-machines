'use strict';
// =====================================================================
// main: boot order and the frame loop
// =====================================================================
let lastFrame=performance.now(),overDraw=0;
function frame(now){
 const dt=Math.min(0.05,(now-lastFrame)/1000);lastFrame=now;
 try{
  if(typeof Conquest!=='undefined'&&Conquest.active){Conquest.tick(now);}
  else if(typeof rangeRun!=='undefined'&&rangeRun){rangeFrame(dt);}
  else if(inBattle()){
   if(typeof pvpOn==='function'&&pvpOn()){pvpFrame(dt);drawBattle();overDraw=1.2;}   // live match: the server runs the fight
   else if(state==='play'){if(!paused){const n=ffwd&&me&&me.hp<=0?3:1;for(let i=0;i<n&&state==='play';i++){update(dt);fxTick(dt);}tutTick(dt);}drawBattle();overDraw=1.2;}
   else if(state==='round')drawBattle();
   else if(overDraw>0){overDraw-=dt;drawBattle();}   // let the last explosions finish behind the results
  }else{tickHero(now);if(typeof tickEquipmentPreview==='function')tickEquipmentPreview(now);}
 }catch(e){setTimeout(()=>{throw e;});}   // report it, keep the game running
 try{if(typeof ambience==='function'){const cq=typeof Conquest!=='undefined'&&Conquest.active;ambience(cq?(Conquest.ambience?.()||null):!(typeof rangeRun!=='undefined'&&rangeRun)&&inBattle()&&(state==='play'||state==='round'||(typeof pvpOn==='function'&&pvpOn()))?curMap:null);}}catch(e){}   // Arcade map beds; Conquest's zone beds (Session 6B)
 requestAnimationFrame(frame);
}
function boot(){
 loadSave();rollPeriods();captureRef();
 // The pilot's tank, as early as possible (owner, Nov 20): ask the server for the real loadout now, and start downloading the
 // model files of the tank this device holds (nearly always the same tank; if the server says otherwise its files are fetched then).
 if(typeof bootSync==='function')bootSync(true);
 if(typeof Meshy3D!=='undefined'&&typeof want3D==='function'&&want3D()&&webglOK())Meshy3D.prefetch(myLoadout());
 initUI();
 if(typeof load3D==='function')load3D();   // the 3D view loads in the background; without WebGL (or on the 2D setting) the game draws in 2D
 const afterCloud=()=>{
  // the Telegram cloud copy has been compared: the launch sync's answer (asked for above, held until now: js/net.js doSync) may land
  if(typeof loadoutProve==='function')loadoutProve('cloud');
  initBackend();loadLB();if(ACCOUNT_OK)loadSquad();
  if(!IN_WEB&&save.payCur==='sol')fetchPrices();
  if(!save.welcomed&&(save.mp||0)===0)showWelcome();
  if(typeof pvpResume==='function')pvpResume();   // back from an update reload: rejoin the live queue
  uiDirty();
 };
 cloudLoad(cs=>{
  if(typeof ConquestDiscovery!=='undefined')ConquestDiscovery.markReady();
  // Exploration is monotonic even when the older economy snapshot contains newly visited regions.
  const discovery=typeof ConquestDiscovery!=='undefined'?ConquestDiscovery.create():null;
  discovery?.merge(cs?.conquestDiscovery);
  const missionProgress=typeof ConquestProgress!=='undefined'?ConquestProgress.create():null;
  missionProgress?.merge(cs?.conquestProgress);
  if(typeof ConquestProgress!=='undefined')ConquestProgress.markReady();
  // the newer copy wins: Telegram cloud (follows the account) or this device
  if(cs&&typeof cs.pts==='number'&&((cs._ts||0)>(save._ts||0)||(cs.earned||cs.pts)>(save.earned||0))){loadSave(cs);rollPeriods();try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}}
  else cloudSave();
  discovery?.flush();
  missionProgress?.flush();
  afterCloud();
 });
 // canvas text uses the menu font: repaint once it has loaded
 try{document.fonts.load('600 16px "Chakra Petch"').then(()=>uiDirty()).catch(()=>{});}catch(e){}
 requestAnimationFrame(frame);
}
// Public browser visitors use verified website accounts; the Mini App entry remains unchanged.
if(!IN_TG&&!WEB_EDITION&&!window.LUNAR_LOCAL_ECO)location.replace('https://lunar-api.solb7403.workers.dev/web/');else boot();
