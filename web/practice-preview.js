'use strict';
// Preview adapter around the existing range.js + sandboxed RangeSim; never starts the account boot.
const previewPanel=$('#practice-panel'),previewStatus=$('#practice-status');
let previewLast=performance.now(),previewStarting=false;
for(const id of GT_ORDER){const o=document.createElement('option');o.value=id;o.textContent=GTYPES[id].label;$('#practice-mode').append(o);}
function previewMenu(message){if(rangeRun){rangeRun.paused=true;rangeResetInput();}previewStatus.textContent=message;previewPanel.hidden=false;$('#practice-resume').hidden=!rangeRun?.sim||rangeRun.done;}
// Replace account-facing range menus and result persistence with this single in-memory panel.
rangePause=()=>{if(rangeRun&&!rangeRun.sim)rangeRun.pauseRequested=true;previewMenu('Practice paused. No rewards or account changes.');};
rangeFinish=()=>{const r=rangeRun;if(!r||r.done)return;r.done=true;const result=r.sim.result();previewMenu('Practice '+result.outcome+' · '+result.duration+'s · '+result.damage+' damage · '+result.kills+' kills. Nothing saved.');};
async function previewStart(){
 if(previewStarting)return;previewStarting=true;$('#practice-start').disabled=true;
 try{
  rangeDispose();const L=structuredClone(STOCK_L),pick=$('#practice-loadout').value;
  if(pick==='scout'){L.c.c='scout';L.c.t=1;L.w.a='twin';L.w.t=1;}
  if(pick==='lunar'){L.c.c='titan';L.c.t=2;L.w.a='moon';L.w.t=2;L.skin='lunar';}
  const cfg={g:$('#practice-mode').value,map:'classic',seed:104729,preset:'standard',control:'player',L};
  const frame=document.createElement('iframe');frame.hidden=true;frame.title='Isolated local practice simulation';frame.src='range-engine.html';
  const r={frame,sim:null,cfg,fx:{pops:[],nums:[],beams:[],banner:null,feed:[],blasts:[],novas:[],shakeT:0,shakeM:0,ffwd:false,tut:null},acc:0,paused:true,done:false};rangeRun=r;
  previewStatus.textContent='Loading isolated practice…';
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Practice assets unavailable. Reload to retry.')),10000);frame.onload=()=>{clearTimeout(t);resolve();};frame.onerror=()=>{clearTimeout(t);reject(Error('Practice engine unavailable'));};document.body.append(frame);});
  r.sim=frame.contentWindow.RangeSim;if(!r.sim)throw Error('Practice engine unavailable');r.sim.setup(cfg);
  document.body.classList.add('battle','range-running');rangeResetInput();fit();
  if(document.hidden||r.pauseRequested)rangePause();else{r.paused=false;previewPanel.hidden=true;}previewLast=performance.now();
 }catch(e){rangeDispose();previewMenu(e.message);console.error(e);}
 finally{previewStarting=false;$('#practice-start').disabled=false;}
}
$('#practice-start').onclick=previewStart;
$('#practice-menu').onclick=rangePause;
$('#practice-resume').onclick=()=>{if(!rangeRun?.sim||rangeRun.done)return;rangeResetInput();rangeRun.acc=0;rangeRun.paused=false;previewLast=performance.now();previewPanel.hidden=true;};
$('#practice-quality').onchange=e=>setGfx(e.target.value);
function previewFrame(now){const dt=Math.max(0,Math.min(.05,(now-previewLast)/1000));previewLast=now;
 try{if(rangeRun?.sim&&!document.hidden)rangeTick(dt);}catch(e){rangePause();previewStatus.textContent='Practice paused after a rendering error. Reload to retry.';console.error(e);}
 requestAnimationFrame(previewFrame);
}
addEventListener('blur',()=>{if(rangeRun)rangePause();});
addEventListener('pageshow',()=>{previewLast=performance.now();if(rangeRun?.sim)rangePause();else previewMenu('Practice ready. Start a new local match.');});
setGfx('auto');requestAnimationFrame(previewFrame);
