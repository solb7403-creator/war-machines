'use strict';
// =====================================================================
// main: boot order and the frame loop
// =====================================================================
let lastFrame=performance.now(),overDraw=0;
function frame(now){
 const dt=Math.min(0.05,(now-lastFrame)/1000);lastFrame=now;
 try{
  if(inBattle()){
   if(state==='play'){if(!paused){const n=ffwd&&me&&me.hp<=0?3:1;for(let i=0;i<n&&state==='play';i++)update(dt);tutTick(dt);}drawBattle();overDraw=1.2;}
   else if(state==='round')drawBattle();
   else if(overDraw>0){overDraw-=dt;drawBattle();}   // let the last explosions finish behind the results
  }else tickHero(now);
 }catch(e){setTimeout(()=>{throw e;});}   // report it, keep the game running
 requestAnimationFrame(frame);
}
function boot(){
 loadSave();rollPeriods();captureRef();
 initUI();
 const afterCloud=()=>{
  initBackend();loadLB();if(IN_TG)loadSquad();
  if(save.payCur==='sol')fetchPrices();
  if(!save.welcomed&&(save.mp||0)===0)showWelcome();
  uiDirty();
 };
 cloudLoad(cs=>{
  // the newer copy wins: Telegram cloud (follows the account) or this device
  if(cs&&typeof cs.pts==='number'&&((cs._ts||0)>(save._ts||0)||(cs.earned||cs.pts)>(save.earned||0))){loadSave(cs);rollPeriods();try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}}
  else cloudSave();
  afterCloud();
 });
 // canvas text uses the menu font: repaint once it has loaded
 try{document.fonts.load('600 16px "Chakra Petch"').then(()=>uiDirty()).catch(()=>{});}catch(e){}
 requestAnimationFrame(frame);
}
boot();
