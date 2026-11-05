/* One in-flight authenticated request. Server snapshots are the only source of secured rewards. */
(function(root){
'use strict';const C=root.ConquestCombat,K=root.ConquestControl,clone=v=>JSON.parse(JSON.stringify(v));
const list=v=>Array.isArray(v)?v:v&&typeof v==='object'?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]):[];
class Session{
 constructor(view,transport){this.view=view;this.transport=transport;this.queue=[];this.elapsed=0;this.connected=false;this.disposed=false;this.busy=false;this.edges={};this.status='CONNECTING';this.serial=Promise.resolve();this.lastSend=0;this.nextConnect=0;this.pumpAt=performance.now();}
 async connect(){this.nextConnect=performance.now()+5000;try{const r=await this.transport('/api/conquest/session',{});if(this.disposed)return false;this.queue=[];this.elapsed=0;this.apply(r.state);this.connected=true;this.pumpAt=performance.now()+150;this.status='SECURED';return true;}catch(e){this.connected=false;this.status='ONLINE REQUIRED FOR SECURE REWARDS';this.error=String(e.message);return false;}}
 apply(s){if(this.disposed||this.state&&s.seq<this.state.seq)return;const v=this.view,oldPhase=this.phase;this.phase=(s.mission||'roam')+':'+(s.attempt||0);this.state=s;this.loadout=s.loadout;
 const B=s.mission?new C.Battle(s.loadout,s.position):new C.Encounter(s.loadout,s.position);Object.assign(B,clone(s.battle));B.enemies=list(B.enemies);B.effects=list(B.effects);B.projectiles=list(B.projectiles);B.superShells=list(B.superShells);B.playerStats.gems=list(B.playerStats.gems);B.playerStats.buffs=list(B.playerStats.buffs);B.playerHp=s.hp;K.ensure(B);
 for(const e of B.enemies){e.stats.gems=list(e.stats.gems);e.stats.buffs=list(e.stats.buffs);if(e.target&&e.home&&e.target.x===e.home.x&&e.target.z===e.home.z)e.target=e.home;if(e.target&&e.navGoal&&e.target.x===e.navGoal.x&&e.target.z===e.navGoal.z)e.target=e.navGoal;if(e.target&&e.target.x===B.objective.x&&e.target.z===B.objective.z)e.target=B.objective;}
 for(const p of B.projectiles){p.stats.gems=list(p.stats.gems);p.stats.buffs=list(p.stats.buffs);}
 // Reconcile to a verified endpoint without passing correction displacement to discovery.
 v.p={...s.position};if(s.mission){v.battle=B;}else{v.battle=null;v.encounter=B;}if(oldPhase!==this.phase){v.selectedId=null;if(s.mission&&!v.explorationCamera){v.explorationCamera={yaw:v.yaw,pitch:v.pitch,distance:v.distance};v.yaw=-.8;v.pitch=.95;v.distance=100;if(v.camera){v.camera.fov=75;v.camera.updateProjectionMatrix();}}else if(!s.mission&&v.explorationCamera){Object.assign(v,v.explorationCamera);v.explorationCamera=null;if(v.camera){v.camera.fov=55;v.camera.updateProjectionMatrix();}}}
 if(v.selectedId&&!B.enemies.some(e=>e.id===v.selectedId&&e.hp>0))v.selectedId=null;
 // Retain inputs created while the request was in flight, then replay prediction only.
 for(const i of this.queue)v.p=K.advance(B,v.p,i,.05,!s.mission);
 if(s.completed?.['oxygen-line'])v.progress?.complete('oxygen-line');v.syncLoadout();v.flushHealth();
 }
 pump(){if(this.disposed)return;const now=performance.now();if(!this.connected){if(!this.busy&&now>=this.nextConnect){this.busy=true;this.connect().finally(()=>this.busy=false);}return;}if(now-this.pumpAt>=1000){this.pumpAt=now;if(!this.busy&&!this.actionBusy&&this.queue.length)this.flush();}}
 sample(dt,input){if(!this.connected||this.disposed||this.actionBusy)return;for(const k of ['tapFire','super','dash','shield'])this.edges[k]=this.edges[k]||input[k];this.elapsed+=dt;
 while(this.elapsed>=.05){this.elapsed-=.05;this.queue.push({...input,tapFire:false,super:false,dash:false,shield:false,...this.edges});this.edges={};}
 if(this.queue.length>40){this.queue=[];this.status='RECONNECTING';this.connected=false;if(!this.busy){this.busy=true;this.connect().finally(()=>this.busy=false);}return;}
 }
 async flush(){if(this.busy||!this.connected||!this.queue.length||this.disposed)return;this.busy=true;const commands=this.queue.splice(0,20),request={seq:this.state.seq+1,commands};
 try{let r;try{r=await this.transport('/api/conquest/input',request);}catch(first){if(String(first.message).includes('elapsed time'))await new Promise(r=>setTimeout(r,250));r=await this.transport('/api/conquest/input',request);}if(!this.disposed){this.apply(r.state);this.status='SECURED';}}
 catch(e){this.queue=[];this.connected=false;this.status='RECONNECTING';await this.connect();}finally{this.busy=false;}
 }
 async action(action,parameters={}){if(this.disposed)return false;if(!this.connected&&!await this.connect())return false;
 // Serialize actions and movement; conflicting tabs receive a canonical resync, never duplicate credit.
 if(this.actionBusy)return false;this.actionBusy=true;
 try{while(this.busy)await new Promise(r=>setTimeout(r,20));while(this.queue.length)await this.flush();this.busy=true;
 const body={seq:this.state.seq+1,action,...parameters};let r;try{r=await this.transport('/api/conquest/action',body);}catch(first){r=await this.transport('/api/conquest/action',body);}this.apply(r.state);this.status='SECURED';return true;
 }catch(e){this.error=String(e.message);this.status='ACTION UNAVAILABLE';await this.connect();return false;}finally{this.busy=false;this.actionBusy=false;}}
 dispose(){this.disposed=true;this.queue=[];this.connected=false;}
}
root.ConquestSession=Session;
})(globalThis);
