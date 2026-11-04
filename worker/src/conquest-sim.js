// Server-owned deterministic Conquest input replay. Client outcomes are never inputs.
import {CONQUEST} from './sim.gen.js';
const {World:W,Combat:C}=CONQUEST;
const STEP_MS=50,MAX_FRAMES=20,MAX_CREDIT_MS=1000;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function record(v){return v&&typeof v==='object'&&!Array.isArray(v);}
function fail(message){throw new Error('conquest: '+message);}
export function validateCommands(input){
 if(!Array.isArray(input)||input.length<1||input.length>MAX_FRAMES)fail('invalid batch');
 return input.map(c=>{
  if(!record(c)||Object.keys(c).some(k=>!['x','z','aimYaw','aimPitch','fire'].includes(k)))fail('invalid command');
  if(!Number.isFinite(c.x)||!Number.isFinite(c.z)||Math.hypot(c.x,c.z)>1.000001)fail('invalid movement');
  if(own(c,'fire')&&typeof c.fire!=='boolean'||own(c,'aimYaw')&&!Number.isFinite(c.aimYaw))fail('invalid combat input');
  if(own(c,'aimPitch')&&(!Number.isFinite(c.aimPitch)||c.aimPitch<-.4||c.aimPitch>.5))fail('invalid aim pitch');
  return {x:c.x,z:c.z,aimPitch:c.aimPitch||0,aimYaw:Math.atan2(Math.sin(c.aimYaw||0),Math.cos(c.aimYaw||0)),fire:!!c.fire};
 });
}
const copy=v=>JSON.parse(JSON.stringify(v));
export function createState(loadout,now){
 if(!Number.isSafeInteger(now)||now<0)fail('invalid server clock');
 const position={x:898,z:1024,y:W.groundAt(898,1024),surface:'ground'},B=new C.Encounter(loadout,position);
 return {v:1,seq:0,lastWall:now,creditMs:0,position,hp:B.playerHp,loadout:copy(B.snapshot),mission:null,battle:copy(B)};
}
function list(v){return Array.isArray(v)?v:v&&typeof v==='object'?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]):[];}
function normalizeStats(v){v.gems=list(v.gems);v.buffs=list(v.buffs);return v;}
function hydrate(s){
 const B=s.mission?new C.Battle(s.loadout,s.position):new C.Encounter(s.loadout,s.position);
 Object.assign(B,copy(s.battle));B.playerHp=s.hp;
 B.enemies=list(B.enemies);B.projectiles=list(B.projectiles);B.effects=list(B.effects);normalizeStats(B.playerStats);
 for(const q of B.projectiles)normalizeStats(q.stats);
 for(const e of B.enemies){
  normalizeStats(e.stats);const t=e.target;
  if(t&&e.home&&t.x===e.home.x&&t.z===e.home.z)e.target=e.home;
  else if(t&&t.x===B.objective.x&&t.z===B.objective.z)e.target=B.objective;
 }
 return B;
}
export function applyCommands(previous,request,now){
 if(!record(request)||Object.keys(request).some(k=>!['seq','commands'].includes(k)))fail('invalid request');
 const commands=validateCommands(request.commands);
 if(previous?.v!==1||!Number.isSafeInteger(request.seq)||request.seq!==previous.seq+1)fail('stale sequence');
 if(!Number.isSafeInteger(now)||now<previous.lastWall)fail('invalid server clock');
 const credit=Math.min(MAX_CREDIT_MS,previous.creditMs+now-previous.lastWall),cost=commands.length*STEP_MS;
 if(cost>credit)fail('simulation exceeds elapsed time');
 const s=copy(previous),B=hydrate(s),speed=s.mission?B.combatSpeed:W.travelSpeed(s.loadout);
 for(const input of commands){
  const old=s.position;
  if(s.hp>0){
   const q=W.advance(old,input.x*speed*STEP_MS/1000,input.z*speed*STEP_MS/1000);
   if(!B.enemies.some(e=>e.hp>0&&Math.hypot(q.x-e.x,q.z-e.z)<3.8&&Math.abs(q.y-e.y)<3))s.position=q;
  }
  let aim={x:s.position.x+Math.sin(input.aimYaw)*160,y:s.position.y+3+Math.sin(input.aimPitch)*160,z:s.position.z+Math.cos(input.aimYaw)*160};
  // Match the existing small angular assist against server-owned visible hulls.
  let best=.18;for(const e of B.enemies){
   if(e.hp<=0||Math.hypot(e.x-s.position.x,e.z-s.position.z)>82||!C.lineClear({x:s.position.x,y:s.position.y+2.2,z:s.position.z},{x:e.x,y:e.y+2.2,z:e.z}))continue;
   const angle=Math.atan2(e.x-s.position.x,e.z-s.position.z),delta=Math.abs(Math.atan2(Math.sin(angle-input.aimYaw),Math.cos(angle-input.aimYaw)));
   if(delta<best){best=delta;aim={x:e.x,y:e.y+2,z:e.z};}
  }
  B.tick(STEP_MS/1000,s.position,{aim,fire:input.fire});s.hp=B.playerHp;
 }
 s.seq=request.seq;s.lastWall=now;s.creditMs=credit-cost;s.battle=copy(B);
 return s;
}

export function applyAction(previous,request,now){
 if(!record(request)||Object.keys(request).some(k=>!['seq','action'].includes(k))||!['start-mission','return-exploration'].includes(request.action))fail('invalid action');
 if(previous?.v!==1||!Number.isSafeInteger(request.seq)||request.seq!==previous.seq+1)fail('stale sequence');
 if(!Number.isSafeInteger(now)||now<previous.lastWall)fail('invalid server clock');
 const s=copy(previous);
 if(request.action==='start-mission'){
  if(s.mission||s.hp<=0||Math.hypot(s.position.x-C.mission.x,s.position.z-C.mission.z)>C.mission.activationRadius)fail('mission unavailable');
  s.explorationBattle=s.battle;s.attempt=(s.attempt||0)+1;s.mission=C.mission.id;
  const B=new C.Battle(s.loadout,s.position);B.playerHp=Math.min(B.playerMax,s.hp);s.battle=copy(B);
 }else{
  if(!s.mission)fail('no active mission');
  const outcome=s.battle.state==='active'?'retreated':s.battle.state;
  s.lastMission={id:s.mission,attempt:s.attempt,outcome,at:now};
  if(outcome==='victory'){s.completed=s.completed||{};s.completed[s.mission]=s.completed[s.mission]||{at:now,attempt:s.attempt};}
  const B=new C.Encounter(s.loadout,s.position);Object.assign(B,s.explorationBattle||{});B.playerHp=Math.min(B.playerMax,s.hp);B.state=s.hp>0?'active':'defeat';B.projectiles=[];
  s.battle=copy(B);delete s.explorationBattle;s.mission=null;
 }
 s.seq=request.seq;s.creditMs=Math.min(MAX_CREDIT_MS,s.creditMs+now-s.lastWall);s.lastWall=now;return s;
}
