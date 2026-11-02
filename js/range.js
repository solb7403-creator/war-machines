'use strict';
// Practice has no api/store/sync/proof/match calls. Only an owned snapshot enters the isolated realm;
// only bounded device summaries leave it. Normal pending results/payment recovery keep their own lifecycle.
let rangeOwnedLive=null,rangeSource=null,rangeRun=null,rangeBound=false,rangeLoading=0;
let rangeOptions={g:'arena',map:'classic',seed:104729,preset:'standard',control:'player'};
const rangeCopy=x=>JSON.parse(JSON.stringify(x));
const rangeLocalKey=k=>'lunar_range_'+k+'_v1:'+playerKey();
function rangeRemember(S){
 const keys=['up','gemLvl','wOwn','cOwn','roll','salv','paints','moonbeam','skin','vg'];
 const owned={lab:{v:1}};for(const k of keys)if(S[k]!==undefined)owned[k]=rangeCopy(S[k]);
 rangeOwnedLive={owned,at:Date.now()};
 try{localStorage.setItem(rangeLocalKey('owned'),JSON.stringify(rangeOwnedLive));}catch(e){}
}
function rangeOwned(){
 if(!SRV_ECO)return {owned:rangeCopy(save),at:0,offline:true};
 let o=rangeOwnedLive;
 if(!o)try{const s=localStorage.getItem(rangeLocalKey('owned'));if(s&&s.length<32768)o=JSON.parse(s);}catch(e){}
 return o&&o.owned?{...o,offline:!rangeOwnedLive||navigator.onLine===false||syncFails>0}:null;
}
function rangeStatus(){const o=rangeOwned();return !o?'Connect once to validate owned gear.':o.offline?'Offline experiment · cached owned gear. Saving and ranked play require server validation.':'Practice / No rewards · last server-validated owned gear. Save and Equip are separate.';}
function rangeHistory(id){
 try{const raw=localStorage.getItem(rangeLocalKey('results'));if(!raw||raw.length>160000)return [];const rows=JSON.parse(raw)[id];return Array.isArray(rows)?rows.filter(r=>r&&typeof r.key==='string'&&typeof r.build==='string'&&Number.isFinite(r.duration)).slice(-20):[];}catch(e){return [];}
}
function rangeWriteHistory(id,result){
 const out={};for(const mid of Object.values(save.lab?.slots||{}).slice(0,6))out[mid]=rangeHistory(mid);
 out[id]=result?out[id].concat(result).slice(-20):[];
 try{localStorage.setItem(rangeLocalKey('results'),JSON.stringify(out));return true;}catch(e){return false;}
}
function openRange(id){   // Free Test: the bay exactly as saved
 if(rangeRun||inBattle()||pvpOn()||state==='vs'||state==='play'||labBusy){showToast('Finish your current match or save first.');return;}
 const M=save.lab?.machines[id],O=rangeOwned();
 if(!M||!Object.values(save.lab.slots).includes(id)||!O){showToast('Connect once to load your owned machines.');return;}
 const spec=rangeCopy(M.spec),err=labValidate(O.owned,spec);
 if(err){showToast(labMessage(err));return;}
 rangeSource={id,name:M.name,spec,rev:save.lab.rev};
 rangeSetupScreen();
}
function rangeModeNote(g){return {arena:'Quick Arena: single-round 1v1 elimination.',zone:'2v2 Moon Zone: capture and hold the moving zone.',crystal:'2v2 Crystal Rush: carry 10 crystals and hold for 15 seconds.',bounty:'2v2 Bounty: earn stars from eliminations; respawns are on.',royale:'Last Standing: six pilots, separate teams, closing storm.',boss:'Survival: you + a standard AI wingman vs the real scaled megatank. The boss scales with your build; opponent preset does not apply.'}[g];}
function rangeSetupScreen(){
 const old=findOv('rangesetup');if(old)closeOverlay(old);
 const s=rangeSource,O=rangeOwned();if(!s||!O)return;
 const L=ecoLoadout(O.owned,s.spec),T=machineMetrics(L),opts=(items,val)=>items.map(([k,n])=>'<option value="'+k+'"'+(val===k?' selected':'')+'>'+esc(n)+'</option>').join('');
 openOverlay('sheet','<h3>Free Test Range</h3><p class="range-note">Practice / No rewards</p><p class="mut" id="range-connection">'+esc(rangeStatus())+'</p><b>'+esc(s.name)+(s.fromEditor?' · unsaved draft':'')+'</b><canvas id="range-preview" class="labpreview" aria-label="Test machine preview"></canvas><p class="mut">Base HP '+T.hp+' · ordinary DPS '+T.dps+' · driving speed '+T.spd+'. Mode health scaling still applies.</p><div class="labform"><label>Mode<select id="range-mode">'+opts(GT_ORDER.map(k=>[k,GTYPES[k].label]),rangeOptions.g)+'</select></label><p class="mut" id="range-mode-note">'+rangeModeNote(rangeOptions.g)+'</p><label>Control<select id="range-control">'+opts([['player','Drive myself'],['ai','Watch AI drive my build']],rangeOptions.control)+'</select></label><details><summary>Trial conditions</summary><label>Opponent<select id="range-opponent">'+opts([['standard','Standard · Stock Vanguard / Pulse'],['equipped','Equipped · Rare gear + 3 upgrades']],rangeOptions.preset)+'</select></label><p class="mut">Fixed presets, no gear grants. AI wingmen stay Standard.</p><label>Map<select id="range-map">'+opts(MAP_REAL.map(k=>[k,MAPS[k].n]),rangeOptions.map)+'</select></label><label>Seed<input id="range-seed" type="number" min="1" max="4294967295" inputmode="numeric" value="'+rangeOptions.seed+'"></label><p class="mut">Same seed repeats engine randomness in this version. Player inputs may differ; cross-browser identical replays are not promised.</p></details></div><p id="range-error" role="status" class="mut"></p><div class="range-actions"><button class="btn btn-go block" data-act="rangestart">Start free trial</button><button class="btn btn-quiet" data-act="rangeadjust">Adjust in the Garage</button><button class="btn btn-ghost" data-act="rangeclose">Garage</button><button class="linkbtn" data-act="rangehistory">Recent local results ('+rangeHistory(s.id).length+'/20)</button></div>',{key:'rangesetup',onClose:()=>{if(rangeRun&&!rangeRun.sim)rangeDispose();}});
 const c=$('#range-preview'),w=c.clientWidth||260;c.width=w*dpr;c.height=150*dpr;const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);drawMachinePreview(ctx,w,150,L);
 rangeUpdateMode();
}
function rangeUpdateMode(){const g=$('#range-mode')?.value;if(!g)return;$('#range-mode-note').textContent=rangeModeNote(g);$('#range-opponent').disabled=g==='boss';}
document.addEventListener('change',e=>{if(e.target.id==='range-mode')rangeUpdateMode();});
function rangeRenderState(){return {curMap,BR,baseWalls,navWalls,walls,rocks,craters,crates,me,units,bullets,timeLeft,state,boxes,matchG,MM,series,evt,warns,elapsed,gzones,gscore,cry,storm,boss,shells,mstat,...rangeFxState()};}
function rangeFxState(){return {pops,nums,beams,banner,feed,blasts,novas,shakeT,shakeM,ffwd,tut};}
function rangeUseState(v){({curMap,BR,baseWalls,navWalls,walls,rocks,craters,crates,me,units,bullets,timeLeft,state,boxes,matchG,MM,series,evt,warns,elapsed,gzones,gscore,cry,storm,boss,shells,mstat,pops,nums,beams,banner,feed,blasts,novas,shakeT,shakeM,ffwd,tut}=v);}
function rangeWithView(fn){
 const r=rangeRun;if(!r?.sim||rangeBound)return fn();
 const before=rangeRenderState();rangeUseState({...r.sim.view(),...r.fx});rangeBound=true;
 try{return fn();}finally{r.fx=rangeFxState();rangeUseState(before);rangeBound=false;}
}
function combatView(fn){
 if(rangeRun){if(!rangeRun.sim||rangeRun.paused||rangeRun.done||rangeRun.cfg.control!=='player')return;return rangeWithView(fn);}
 return fn();
}
function rangeResetInput(){joy.on=false;joy.id=null;joy.dx=joy.dy=0;aim=null;resetTapFocus();for(const k in keys)delete keys[k];}
async function rangeStart(repeat){
 if(rangeRun||!rangeSource)return;
 const O=rangeOwned(),err=O&&labValidate(O.owned,rangeSource.spec);
 if(!O||err){showToast(err?labMessage(err):'Connect once to validate owned gear.');return;}
 let cfg;
 if(repeat&&rangeSource.last)cfg=rangeCopy(rangeSource.last);
 else{
  const seed=Number($('#range-seed')?.value);
  if(!Number.isInteger(seed)||seed<1||seed>4294967295){$('#range-error').textContent='Choose a whole-number seed from 1 to 4294967295.';return;}
  rangeOptions={g:$('#range-mode').value,map:$('#range-map').value,seed,preset:$('#range-opponent').value,control:$('#range-control').value};
  cfg={...rangeOptions,L:ecoLoadout(O.owned,rangeSource.spec)};
 }
 const token=++rangeLoading,frame=document.createElement('iframe');
 frame.hidden=true;frame.title='Isolated practice engine';frame.src='range-engine.html';
 // Engine loads only local combat scripts. CSP in that document disallows all outgoing connections.
 const r={frame,sim:null,cfg,fx:{pops:[],nums:[],beams:[],banner:null,feed:[],blasts:[],novas:[],shakeT:0,shakeM:0,ffwd:false,tut:null},acc:0,paused:false,done:false};
 rangeRun=r;
 const errorEl=$('#range-error');if(errorEl)errorEl.textContent='Loading isolated combat…';
 try{
  await new Promise((resolve,reject)=>{const tm=setTimeout(()=>reject(new Error('Engine unavailable. Reconnect to load practice assets.')),8000);r.cancel=()=>{clearTimeout(tm);reject(new Error('cancelled'));};frame.onload=()=>{clearTimeout(tm);resolve();};frame.onerror=()=>{clearTimeout(tm);reject(new Error('Practice assets unavailable'));};document.body.appendChild(frame);});
  if(token!==rangeLoading||rangeRun!==r)return;
  r.sim=frame.contentWindow.RangeSim;if(!r.sim)throw new Error('Practice assets unavailable. Reconnect and retry.');
  r.sim.setup(cfg);rangeSource.last=rangeCopy(cfg);closeAll();rangeResetInput();
  document.body.classList.add('battle','range-running');fit();
  r.back=()=>rangePause();pushBack(r.back);
  const bar=document.createElement('div');bar.id='range-bar';bar.innerHTML='<span>Practice · No rewards<br><small>'+GTYPES[cfg.g].label+' · '+(cfg.control==='ai'?'AI driving':'You drive')+'</small></span><button class="btn btn-quiet" data-act="rangepause">Stop / Exit</button>';document.body.appendChild(bar);
 }catch(e){if(rangeRun===r){rangeDispose();if(e.message!=='cancelled')showToast(e.message);}}
}
function rangeFrame(dt){
 try{rangeTick(dt);}catch(e){
  rangeDispose();closeAll();rangeSetupScreen();showToast('Practice stopped safely. Your bay is unchanged.');
  console.warn('Practice stopped:',e.message);
 }
}
function rangeTick(dt){
 const r=rangeRun;if(!r?.sim)return;
 if(!r.paused&&!r.done&&!document.hidden){r.acc+=dt;while(r.acc>=1/60&&r.sim.view().state==='play'){r.sim.step(1/60,inputVec());r.acc-=1/60;}}
 rangeWithView(()=>{
  if(use3D()){ensureMap();matchObjs();}
  for(const a of r.sim.events())onSimEv(a);
  if(!r.paused)fxTick(dt);drawBattle();
 });
 if(!r.done&&r.sim.view().state==='over')rangeFinish();
}
function rangePause(){
 const r=rangeRun;if(!r?.sim||r.done||findOv('rangepause'))return;
 r.paused=true;rangeResetInput();
 openOverlay('modal','<h3>Practice paused</h3><p class="mut">No rewards, losses or account changes. Resume, stop this trial, or go back to the Garage.</p><div class="range-actions"><button class="btn btn-go" data-act="rangeresume">Resume trial</button><button class="btn btn-quiet" data-act="rangestop">Stop and see results</button><button class="btn btn-ghost" data-act="rangeadjust">Adjust in the Garage</button><button class="btn btn-ghost" data-act="rangeexit">Garage</button></div>',{key:'rangepause',sticky:true,onClose:()=>{if(rangeRun===r)r.paused=false;}});
}
function rangeFinish(){
 const r=rangeRun;if(!r?.sim||r.done)return;r.done=true;rangeResetInput();
 const result=rangeCopy(r.sim.result()),conditions={version:r.sim.version,g:r.cfg.g,map:r.cfg.map,seed:r.cfg.seed,preset:r.cfg.g==='boss'?'scaled-boss':r.cfg.preset,control:r.cfg.control,opponents:result.opponents};
 delete result.opponents;
 const summary={...result,key:JSON.stringify(conditions),build:JSON.stringify(r.cfg.L),conditions,name:rangeSource.name,stats:machineMetrics(r.cfg.L),at:Date.now()};
 rangeSource.result=summary;const stored=rangeWriteHistory(rangeSource.id,summary);rangeDispose();rangeResultsScreen(summary,stored);
}
function rangeDispose(){
 const r=rangeRun;++rangeLoading;
 if(r){if(r.back)dropBack(r.back);if(r.cancel&&!r.sim)r.cancel();if(r.sim){rangeWithView(()=>{if(typeof clearRange3D==='function')clearRange3D();});r.sim.dispose();}r.frame.remove();}
 rangeRun=null;$('#range-bar')?.remove();document.body.classList.remove('range-running','battle');rangeResetInput();fit();uiDirty();
}
function rangeCompare(a,b){if(!b)return 'No earlier trial to compare.';if(a.key!==b.key)return 'Different conditions — not directly comparable.';if(a.outcome==='stopped'||b.outcome==='stopped')return 'Stopped trials — not a complete comparison.';return a.conditions.control==='ai'?'Same AI trial conditions. One trial is not proof of a stronger build.':'Same conditions; your driving inputs may differ. One trial is not proof of a stronger build.';}
function rangeObjective(r){const o=r.objective;return r.conditions.g==='zone'?'Team zone score '+o.score.join(' : ')+' · captures '+o.captures:r.conditions.g==='crystal'?'Team crystals '+o.score.join(' : ')+' · collected '+o.collected:r.conditions.g==='bounty'?'Team stars '+o.score.join(' : ')+' · earned '+o.stars:r.conditions.g==='royale'?'Place '+o.place+' of '+o.of:r.conditions.g==='boss'?'Megatank '+o.bossDown+'% down':'Surviving tanks '+o.remaining.length;}
function rangeResultRow(r){return '<p><b>'+esc(r.name)+' · '+r.outcome+'</b><br>'+r.duration+'s · '+fmtNum(r.damage)+' dealt / '+fmtNum(r.taken)+' taken · '+r.kills+' kills / '+r.deaths+' deaths<br><span class="mut">'+esc(rangeObjective(r))+'<br>'+GTYPES[r.conditions.g].label+' · '+MAPS[r.conditions.map].n+' · seed '+r.conditions.seed+' · '+(r.control==='ai'?'AI-controlled':'Player-controlled')+'<br>'+esc(r.conditions.version)+' · '+(r.conditions.preset==='scaled-boss'?'Scaled megatank':r.conditions.preset)+'<br>Base HP '+r.stats.hp+' / DPS '+r.stats.dps+' / speed '+r.stats.spd+'</span></p>';}
function rangeResultsScreen(r,stored){
 const rows=rangeHistory(rangeSource.id),prev=rows.slice(0,-1).reverse().find(x=>x.key===r.key)||rows[rows.length-2];
 openOverlay('sheet','<h3>Trial '+r.outcome+'</h3><p class="range-note">Practice / No rewards · local only</p>'+rangeResultRow(r)+'<p>'+esc(rangeCompare(r,prev))+'</p>'+(prev?'<details><summary>Compare previous trial</summary>'+rangeResultRow(prev)+'</details>':'')+(!stored?'<p class="mut">Device storage unavailable; this result was not retained.</p>':'')+'<div class="range-actions"><button class="btn btn-go" data-act="rangerepeat">Repeat same trial</button><button class="btn btn-quiet" data-act="rangeadjust">Adjust in the Garage</button><button class="btn btn-quiet" data-act="rangeoptions">Change conditions</button><button class="btn btn-ghost" data-act="rangeclose">Garage</button></div>',{key:'rangeresults'});
}
function rangeAdjust(){rangeDispose();closeAll();const s=rangeSource;if(s)gSelect(s.id);setTab('garage');}
function rangeExit(){rangeDispose();closeAll();setTab('garage');}
ACT.rangecard=id=>{gIdle().then(()=>openRange(id));};   // after any change still saving
ACT.rangestart=()=>rangeStart(false);
ACT.rangerepeat=()=>rangeStart(true);
ACT.rangeoptions=()=>{closeAll();rangeSetupScreen();};
ACT.rangeadjust=()=>rangeAdjust();ACT.rangeexit=()=>rangeExit();ACT.rangeclose=()=>rangeExit();
ACT.rangepause=()=>rangePause();
ACT.rangeresume=()=>{const o=findOv('rangepause');if(o)closeOverlay(o);};
ACT.rangestop=()=>{const r=rangeRun;if(!r?.sim)return;closeAll();r.sim.stop();rangeFinish();};
ACT.rangehistory=()=>{const rows=rangeHistory(rangeSource.id);openOverlay('sheet','<h3>Recent local trials</h3><p class="mut">Up to 20 per machine, on this device only. Different conditions are not directly comparable.</p>'+rows.slice().reverse().map(rangeResultRow).join('')+'<button class="btn btn-ghost block" data-act="rangeclear">Clear this machine’s results</button>',{key:'rangehistory'});};
ACT.rangeclear=()=>{rangeWriteHistory(rangeSource.id,null);const o=findOv('rangehistory');if(o)closeOverlay(o);showToast('Local results cleared');};
addEventListener('keydown',e=>{if(e.key==='Escape'&&rangeRun){e.preventDefault();rangePause();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&rangeRun)rangePause();});
addEventListener('pagehide',()=>{if(rangeRun)rangeDispose();});
addEventListener('offline',()=>{const e=$('#range-connection');if(e)e.textContent=rangeStatus();});
