/* One in-flight authenticated request. Server snapshots are the only source of secured rewards. */
(function(root){
'use strict';const C=root.ConquestCombat,K=root.ConquestControl,clone=v=>JSON.parse(JSON.stringify(v));
const list=v=>Array.isArray(v)?v:v&&typeof v==='object'?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]):[];
// Mirrors the Worker: at most SEND commands per request and CREDIT_MS of banked real time. A backlog beyond STALL pauses
// local simulation (never discards inputs) until the Worker has caught up; RESYNC is a genuinely lost link.
const STEP_MS=50,SEND=40,CREDIT_MS=4000,PUMP_MS=1000,STALL=120,RESUME=60,RESYNC=400;
// Session 6C (the record split, worker/src/conquest-store.js): with no Parasite within IDLE_R m and no operation, recall, gather or
// fresh press, the phone sends every IDLE_MS instead of every second (a full 40-command batch); an input reply may carry only
// the hot part (the phone sends the cold version it holds, cv) and the phone keeps its own copy of the cold fields.
const IDLE_MS=2000,IDLE_R=160,COLD=['plot','lodes','explorationBattle','raidReceipts','missionClaims','cosmetics','campaignHistory','achievements','contracts','warfront','territory','strikes','regionRevision','raidProgress','lseed','deposits','harvest','found','ambushed','spawns','loadout','engineering','wo','rs','bat','firsts','checkpoint','completed','orders','reputation','campaignScore','resonance','incursions','veins'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// A server-rejected request (HTTP error with a reason) changed nothing; only transport failures may have committed.
const rejected=e=>Number.isInteger(e?.status)&&e.status>=400&&e.status<500&&e.status!==429&&!/sequence|session/.test(String(e.message));
const retryWait=e=>e?.status===429?1000:String(e?.message).includes('elapsed time')?250:0;
class Session{
 constructor(view,transport){this.view=view;this.transport=transport;this.queue=[];this.elapsed=0;this.connected=false;this.disposed=false;this.busy=false;this.edges={};this.status='CONNECTING';this.serial=Promise.resolve();this.lastSend=0;this.nextConnect=0;this.pumpAt=performance.now();this.pushed=0;this.sent=0;this.stalled=false;this.corrections=[];}
 async connect(){this.nextConnect=performance.now()+5000;try{const r=await this.transport('/api/conquest/session',{tz:-new Date().getTimezoneOffset()});if(this.disposed)return false;this.keep(r);this.queue=[];this.sent=this.pushed;this.elapsed=0;this.stalled=false;this.apply(r.state);this.connected=true;this.pumpAt=performance.now()+150;this.status='SECURED';return true;}catch(e){this.connected=false;this.status='ONLINE REQUIRED FOR SECURE REWARDS';this.error=String(e.message);return false;}}
 // the cold fields of the last whole state, and its cold version (an input reply with only the hot part merges over them)
 keep(r){if(r&&r.state){this.cold={};for(const k of COLD)if(r.state[k]!==undefined)this.cold[k]=r.state[k];}if(r&&r.cv)this.cv=r.cv;return r;}
 merged(r){if(!r)return r;if(r.hot&&this.cold){if(r.cv)this.cv=r.cv;return {...this.cold,...r.hot};}this.keep(r);return r.state;}
 idle(){const v=this.view,B=v?.battle||v?.encounter,p=v?.p,s=this.state;if(!B||!p||s?.mission||s?.recall||v.gathering||performance.now()-(this.pressAt||0)<5000)return false;return !(B.enemies||[]).some(e=>e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<IDLE_R);}
 apply(s){if(this.disposed||this.state&&s.seq<this.state.seq)return;const v=this.view,oldPosition={...v.p},oldPhase=this.phase;this.phase=(s.mission||'roam')+':'+(s.attempt||0);this.state=s;this.ackAt=performance.now();this.loadout=s.loadout;
 const CI=root.ConquestCitadel,B=s.mission?(s.mission==='oxygen-line'?new C.Battle(s.loadout,s.position):CI?.isCitadel(s.mission)?CI.make(s.loadout,s.position,s.mission):new C.Operation(s.loadout,s.position,s.mission)):new C.Encounter(s.loadout,s.position);Object.assign(B,clone(s.battle));B.citRestore?.();/* Session 7B: a Citadel assault is its own Operation (js/conquest/citadel.js) */B.enemies=list(B.enemies);B.id=Math.max(Number(B.id)||0,...B.enemies.map(e=>e.id));B.hazards=list(B.hazards);B.nodes=list(B.nodes);B.effects=list(B.effects);B.projectiles=list(B.projectiles);B.superShells=list(B.superShells);B.friends=list(B.friends);B.fields=list(B.fields);B.playerStats.gems=list(B.playerStats.gems);B.playerStats.buffs=list(B.playerStats.buffs);B.playerHp=s.hp;K.ensure(B);
 for(const e of B.enemies){e.stats.gems=list(e.stats.gems);e.stats.buffs=list(e.stats.buffs);if(e.target&&e.home&&e.target.x===e.home.x&&e.target.z===e.home.z)e.target=e.home;if(e.target&&e.navGoal&&e.target.x===e.navGoal.x&&e.target.z===e.navGoal.z)e.target=e.navGoal;if(e.target&&e.target.x===B.objective.x&&e.target.z===B.objective.z)e.target=B.objective;}
 for(const p of B.projectiles)if(p.stats){p.stats.gems=list(p.stats.gems);p.stats.buffs=list(p.stats.buffs);}
 // Reconcile to a verified endpoint without passing correction displacement to discovery.
 v.p={...s.position};if(s.mission){v.battle=B;}else{v.battle=null;v.encounter=B;}if(oldPhase!==this.phase){v.clearEnemyVisuals?.();v.selectedId=null;if(s.mission&&!v.explorationCamera){v.explorationCamera={yaw:v.yaw,pitch:v.pitch,distance:v.distance};v.yaw=-.8;v.pitch=.95;v.distance=100;if(v.camera){v.camera.fov=75;v.camera.updateProjectionMatrix();}}else if(!s.mission&&v.explorationCamera){Object.assign(v,v.explorationCamera);v.explorationCamera=null;if(v.camera){v.camera.fov=55;v.camera.updateProjectionMatrix();}}}
 if(v.selectedId&&!B.enemies.some(e=>e.id===v.selectedId&&e.hp>0))v.selectedId=null;
 // Retain inputs created while the request was in flight, then replay prediction only. Commands are already normalized
 // fixed steps, so this replay is the same computation the Worker performs next.
 for(const i of this.queue)v.p=K.advance(B,v.p,K.validated(i),STEP_MS/1000,!s.mission);if(B.mf)B.mf.q=[];   // research-mod cues of replayed steps already played
 const correction={x:oldPosition.x-v.p.x,z:oldPosition.z-v.p.z},size=Math.hypot(correction.x,correction.z);this.corrections.push(size);if(this.corrections.length>64)this.corrections.shift();
 if(oldPhase===this.phase&&size<12){v.renderCorrection={x:(v.renderCorrection?.x||0)+correction.x,z:(v.renderCorrection?.z||0)+correction.z};v.correctionAdded={x:(v.correctionAdded?.x||0)+correction.x,z:(v.correctionAdded?.z||0)+correction.z};}else v.renderCorrection={x:0,z:0};
 if(s.completed?.['oxygen-line'])v.progress?.complete('oxygen-line');v.syncLoadout();v.flushHealth();
 }
 // Accept one already-normalized fixed-step command that the view has just predicted.
 enqueue(command){if(!this.connected||this.disposed)return false;if(command&&(command.dash||command.shield||command.super||command.scan||command.order||command.tapFire))this.pressAt=performance.now();this.queue.push(command);this.pushed++;this.stalled=this.queue.length>=STALL||this.stalled&&this.queue.length>RESUME;
 if(this.queue.length>RESYNC)this.resync();return true;}
 // A stall pauses local simulation until the Worker catches up; it must clear as soon as the backlog drains.
 unstall(){if(this.stalled&&this.queue.length<=RESUME)this.stalled=false;}
 resync(){this.queue=[];this.sent=this.pushed;this.status='RECONNECTING';this.connected=false;if(!this.busy){this.busy=true;this.connect().finally(()=>this.busy=false);}}
 credit(){return Math.min(CREDIT_MS,Math.max(0,(this.state?.creditMs||0)+performance.now()-(this.ackAt||0)));}
 pump(){if(this.disposed)return;const now=performance.now();this.unstall();if(!this.connected){if(!this.busy&&now>=this.nextConnect){this.busy=true;this.connect().finally(()=>this.busy=false);}return;}
 // Send about once per second; send at once while a backlog exists. A skipped beat stays due instead of waiting a second.
 if(!this.busy&&!this.actionBusy&&this.queue.length&&(now-this.pumpAt>=(this.idle()?IDLE_MS:PUMP_MS)||this.queue.length>=SEND)&&this.credit()>=STEP_MS){this.pumpAt=now;this.flush();}}
 // Legacy variable-frame sampler (kept for tools/tests): accumulates real frame time into fixed commands.
 sample(dt,input){if(!this.connected||this.disposed||this.actionBusy)return;for(const k of ['tapFire','super','dash','shield'])this.edges[k]=this.edges[k]||input[k];this.elapsed+=dt;
 while(this.elapsed>=.05){this.elapsed-=.05;this.queue.push({...input,tapFire:false,super:false,dash:false,shield:false,...this.edges});this.pushed++;this.edges={};}
 if(this.queue.length>40){this.resync();return;}
 }
 async flush(limit=Infinity){if(this.busy||!this.connected||!this.queue.length||this.disposed)return;const count=Math.min(SEND,limit,this.queue.length,Math.floor(this.credit()/STEP_MS));if(count<1)return;this.busy=true;const commands=this.queue.splice(0,count),request={seq:this.state.seq+1,commands,...(this.cv?{cv:this.cv}:{})};this.sent+=count;this.inflight=count;
 try{let r;try{r=await this.transport('/api/conquest/input',request);}catch(first){if(rejected(first)&&!String(first.message).includes('elapsed time'))throw first;if(retryWait(first))await sleep(retryWait(first));r=await this.transport('/api/conquest/input',request);}if(!this.disposed){this.apply(this.merged(r));this.status='SECURED';}}
 catch(e){this.error=String(e.message);this.queue=[];this.sent=this.pushed;this.connected=false;this.status='RECONNECTING';await this.connect();}finally{this.busy=false;this.inflight=0;this.unstall();}
 }
 async action(action,parameters={}){if(this.disposed)return false;if(!this.connected&&!await this.connect())return false;
 // Serialize actions after every command recorded before the tap; later driving keeps predicting and is replayed after it.
 if(this.actionBusy)return false;this.actionBusy=true;const cut=this.pushed;
 try{while(this.busy)await sleep(20);while(this.sent<cut&&this.connected){const before=this.sent;await this.flush(cut-this.sent);if(this.sent===before)await sleep(25);}if(!this.connected)throw Error(this.error||'connection lost');this.busy=true;
 const body={seq:this.state.seq+1,action,...parameters};let r;try{r=await this.transport('/api/conquest/action',body);}catch(first){if(rejected(first))throw first;if(retryWait(first))await sleep(retryWait(first));r=await this.transport('/api/conquest/action',body);}this.keep(r);this.apply(r.state);this.status='SECURED';return true;
 }catch(e){this.error=String(e.message);this.status='ACTION UNAVAILABLE';this.busy=false;if(!rejected(e))await this.connect();return false;}finally{this.busy=false;this.actionBusy=false;}}
 // A session sync that loses no input (Session 6B finish, CI transmission: the Refuge refit asked for its sync through connect(),
 // which drops the unsent commands as a lost link must, so a SHIELD or DASH pressed in that moment never reached the Worker): the
 // commands recorded before it go first, the ones made while it is in flight stay queued and are replayed on the answer. It never
 // holds actionBusy (an action tapped meanwhile waits for it instead of being refused) and takes busy only for its own request
 refresh(){if(this.disposed||!this.connected||this.refreshing)return Promise.resolve(false);this.refreshing=true;const cut=this.pushed;
  return (async()=>{try{
   while(this.connected&&!this.disposed){if(this.busy||this.actionBusy){await sleep(20);continue;}if(this.sent<cut){const before=this.sent;await this.flush(cut-this.sent);if(this.sent===before)await sleep(25);continue;}break;}
   if(!this.connected||this.disposed)return false;this.busy=true;   // in the same turn as the checks above: no flush or action starts in between
   const r=await this.transport('/api/conquest/session',{tz:-new Date().getTimezoneOffset()});if(!this.disposed){this.keep(r);this.apply(r.state);this.status='SECURED';}return true;
  }catch(e){this.error=String(e.message);return false;}finally{this.busy=false;this.refreshing=false;}})();}
 dispose(){this.disposed=true;this.queue=[];this.connected=false;}
}
root.ConquestSession=Session;
})(globalThis);
