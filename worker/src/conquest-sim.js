// Server-owned deterministic input replay; never accepts client outcomes or positions.
import {CONQUEST} from './sim.gen.js';
import {POLICY,ledger,killLoot,pickups,death,missionReward,atTerminal,bank} from './conquest-economy.js';
const {World:W,Combat:C,Control:K}=CONQUEST,STEP_MS=50,MAX_FRAMES=20,MAX_CREDIT_MS=1250;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),copy=v=>JSON.parse(JSON.stringify(v));
const record=v=>v&&typeof v==='object'&&!Array.isArray(v),fail=m=>{throw Error('conquest: '+m);};
const list=v=>Array.isArray(v)?v:v&&typeof v==='object'?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]):[];
export function validateCommands(input){
 if(!Array.isArray(input)||input.length<1||input.length>MAX_FRAMES)fail('invalid batch');
 return input.map(c=>{if(!record(c)||Object.keys(c).some(k=>!['x','z','aimYaw','aimPitch','fire','tapFire','lockId','super','dash','shield'].includes(k)))fail('invalid command');
 if(!Number.isFinite(c.x)||!Number.isFinite(c.z)||Math.hypot(c.x,c.z)>1.000001)fail('invalid movement');
 for(const k of ['fire','tapFire','super','dash','shield'])if(own(c,k)&&typeof c[k]!=='boolean')fail('invalid ability');
 if(own(c,'aimYaw')&&!Number.isFinite(c.aimYaw)||own(c,'aimPitch')&&(!Number.isFinite(c.aimPitch)||c.aimPitch<-.4||c.aimPitch>.5))fail('invalid aim');
 if(c.lockId!=null&&(!Number.isSafeInteger(c.lockId)||c.lockId<1||c.lockId>1e9))fail('invalid target');
 return {x:c.x,z:c.z,aimPitch:c.aimPitch||0,aimYaw:Math.atan2(Math.sin(c.aimYaw||0),Math.cos(c.aimYaw||0)),lockId:c.lockId??null,fire:!!c.fire,tapFire:!!c.tapFire,super:!!c.super,dash:!!c.dash,shield:!!c.shield};});
}
export function createState(loadout,now){
 if(!Number.isSafeInteger(now)||now<0)fail('invalid server clock');const position={x:898,z:1024,y:W.groundAt(898,1024),surface:'ground'},B=new C.Encounter(loadout,position);K.ensure(B);
 const s={v:1,seq:0,lastWall:now,creditMs:0,position,hp:B.playerHp,loadout:copy(B.snapshot),mission:null,battle:copy(B),checkpoint:{...position},safe:[{...position}],stuckMs:0,recoveryAt:0};refreshState(s,now);return s;
}
function stats(v){v.gems=list(v.gems);v.buffs=list(v.buffs);return v;}
export function hydrate(s){const B=s.mission?new C.Battle(s.loadout,s.position):new C.Encounter(s.loadout,s.position);Object.assign(B,copy(s.battle));B.playerHp=s.hp;B.enemies=list(B.enemies);B.projectiles=list(B.projectiles);B.effects=list(B.effects);B.superShells=list(B.superShells);stats(B.playerStats);K.ensure(B);
 for(const q of B.projectiles)stats(q.stats);for(const e of B.enemies){stats(e.stats);const t=e.target;if(t&&e.home&&t.x===e.home.x&&t.z===e.home.z)e.target=e.home;else if(t&&e.navGoal&&t.x===e.navGoal.x&&t.z===e.navGoal.z)e.target=e.navGoal;else if(t&&t.x===B.objective.x&&t.z===B.objective.z)e.target=B.objective;}return B;}
export function refreshState(s,now){s.drops=list(s.drops);s.wrecks=list(s.wrecks);s.safe=list(s.safe);ledger(s,now);s.daily.missionKills=list(s.daily.missionKills);s.battle.enemies=list(s.battle.enemies);
 if(s.mission)return;const day=Math.floor(now/POLICY.day),fresh=new C.Encounter(s.loadout,s.position);
 for(const e of fresh.enemies)if(!s.battle.enemies.some(old=>old.key===e.key))s.battle.enemies.push(copy(e));
 for(const e of s.battle.enemies){const m=s.spawns[e.key]||(s.spawns[e.key]={generation:day});if(e.hp>0||Math.hypot(e.home.x-s.position.x,e.home.z-s.position.z)<=POLICY.visibleRadius)continue;
 const patrol=e.base?.kind==='patrol',ready=patrol?now-(m.deadAt||now)>=POLICY.patrolRefresh:m.generation<day;
 if(ready){const replacement=fresh.enemies.find(x=>x.key===e.key);if(replacement){for(const key of Object.keys(e))delete e[key];Object.assign(e,copy(replacement));s.spawns[e.key]={generation:patrol?m.generation+1:day};if(s.battle.cleared)delete s.battle.cleared[e.key];}}}
}
function footing(s,p){if(p.surface==='ground'&&W.solidAt(p.x,p.z))return false;return [[2,0],[-2,0],[0,2],[0,-2]].every(([x,z])=>{const q=W.advance(p,x,z);return Math.hypot(q.x-p.x-x,q.z-p.z-z)<.1;});}
export function refitState(s,L){if(s.mission||JSON.stringify(s.loadout)===JSON.stringify(L))return;const safe=atTerminal(s)||Math.hypot(s.position.x-898,s.position.z-1024)<20;if(!safe)return;const B=hydrate(s),fresh=new C.Encounter(L,s.position);s.hp=Math.min(s.hp,fresh.playerMax);B.playerStats=fresh.playerStats;B.playerMax=fresh.playerMax;B.combatSpeed=fresh.combatSpeed;B.snapshot=fresh.snapshot;B.playerHp=s.hp;s.loadout=copy(L);s.battle=copy(B);}
function time(previous,seq,now){if(previous?.v!==1||!Number.isSafeInteger(seq)||seq!==previous.seq+1)fail('stale sequence');if(!Number.isSafeInteger(now)||now<previous.lastWall)fail('invalid server clock');}
export function applyCommands(previous,request,now){
 if(!record(request)||Object.keys(request).some(k=>!['seq','commands'].includes(k)))fail('invalid request');const commands=validateCommands(request.commands);time(previous,request.seq,now);
 const credit=Math.min(MAX_CREDIT_MS,previous.creditMs+now-previous.lastWall),cost=commands.length*STEP_MS;if(cost>credit)fail('simulation exceeds elapsed time');
 const s=copy(previous);refreshState(s,now);const B=hydrate(s);
 for(const input of commands){const running=B.state==='active',old=s.position;s.position=K.advance(B,s.position,input,STEP_MS/1000,!s.mission);s.hp=B.playerHp;
 const wanted=running?Math.hypot(input.x,input.z):0,moved=Math.hypot(old.x-s.position.x,old.z-s.position.z);s.stuckMs=wanted>.1&&moved<B.combatSpeed*.05*.15?(s.stuckMs||0)+STEP_MS:wanted>.1?0:s.stuckMs||0;
 if(s.hp>0){const last=s.safe.at(-1);if((!last||Math.hypot(last.x-s.position.x,last.z-s.position.z)>=8)&&footing(s,s.position)){s.safe.push({...s.position});s.safe=s.safe.slice(-10);}for(const e of B.enemies)if(e.hp<=0)killLoot(s,e,now);pickups(s,now);}
 if(s.hp<=0){death(s,now);break;}
 }
 if(s.mission&&B.state==='victory'&&!s.settlement){s.settlement=missionReward(s,now);s.completed=s.completed||{};s.completed[s.mission]=s.completed[s.mission]||{at:now,attempt:s.attempt};}
 s.seq=request.seq;s.lastWall=now;s.creditMs=credit-cost;s.battle=copy(B);return s;
}
function mergeResidents(from,to){for(const e of from.enemies.filter(e=>e.resident)){const old=to.enemies.find(x=>x.key===e.key);if(old){const id=old.id;Object.assign(old,copy(e),{id,resident:false});if(old.hp<=0){to.cleared=to.cleared||{};to.cleared[old.key]=true;}}}}
export function applyAction(previous,request,now){
 if(!record(request)||Object.keys(request).some(k=>!['seq','action'].includes(k))||!['start-mission','return-exploration','bank','repair','respawn','recover'].includes(request.action))fail('invalid action');time(previous,request.seq,now);const s=copy(previous);refreshState(s,now);let B=hydrate(s);
 if(request.action==='start-mission'){
 if(s.mission||s.hp<=0||Math.hypot(s.position.x-C.mission.x,s.position.z-C.mission.z)>C.mission.activationRadius)fail('mission unavailable');s.explorationBattle=copy(B);s.attempt=(s.attempt||0)+1;s.mission=C.mission.id;s.settlement=null;const fresh=new C.Battle(s.loadout,s.position);K.carry(B,fresh);B=fresh;B.enemies.push(...s.explorationBattle.enemies.map(e=>({...copy(e),id:100000000+e.id,resident:true})));B.playerHp=Math.min(B.playerMax,s.hp);B.lockId=null;
 }else if(request.action==='return-exploration'){
 if(!s.mission)fail('no active mission');s.lastMission={id:s.mission,attempt:s.attempt,outcome:B.state==='active'?'retreated':B.state,at:now,settlement:s.settlement||null};const fresh=new C.Encounter(s.loadout,s.position);Object.assign(fresh,s.explorationBattle||{});mergeResidents(B,fresh);K.carry(B,fresh);B=fresh;B.playerHp=s.hp;B.state=s.hp>0?'active':'defeat';B.projectiles=[];B.lockId=null;delete s.explorationBattle;s.mission=null;
 }else if(request.action==='bank'){bank(s,now);
 }else if(request.action==='repair'){
 if(!atTerminal(s)||B.enemies.some(e=>e.hp>0&&Math.hypot(e.x-s.position.x,e.z-s.position.z)<80))fail('repair requires safe Refuge terminal');s.hp=B.playerHp=B.playerMax;s.notice={kind:'repaired'};
 }else if(request.action==='respawn'){
 if(s.hp>0||!s.death?.active)fail('no verified defeat');const old=B;B=new C.Encounter(s.loadout,s.checkpoint||{x:898,z:1024,y:W.groundAt(898,1024),surface:'ground'});Object.assign(B,s.explorationBattle||s.battle);mergeResidents(old,B);K.carry(old,B);s.position={...(s.checkpoint||{x:898,z:1024,y:W.groundAt(898,1024),surface:'ground'})};s.hp=B.playerHp=B.playerMax;B.state='active';B.projectiles=[];B.superShells=[];B.superAttack=null;B.shieldT=0;B.lockId=null;s.mission=null;delete s.explorationBattle;s.death.active=false;s.notice={kind:'respawned'};
 }else{
 if(s.hp<=0||B.state!=='active'||(s.stuckMs||0)<1500||now<(s.recoveryAt||0))fail('recovery unavailable');let p=[...s.safe].reverse().find(p=>{const d=Math.hypot(p.x-s.position.x,p.z-s.position.z);return d>=6&&d<=80&&footing(s,p);});
 if(!p)for(const r of [8,12,20,32]){for(let i=0;i<16;i++){const q=W.advance(s.position,Math.cos(i*Math.PI/8)*r,Math.sin(i*Math.PI/8)*r);if(Math.hypot(q.x-s.position.x,q.z-s.position.z)>=6&&footing(s,q)){p=q;break;}}if(p)break;}
 if(!p)fail('no reachable safe position');s.position={...p};s.recoveryAt=now+30000;s.stuckMs=0;
 }
 s.battle=copy(B);s.seq=request.seq;s.creditMs=Math.min(MAX_CREDIT_MS,s.creditMs+now-s.lastWall);s.lastWall=now;return s;
}
