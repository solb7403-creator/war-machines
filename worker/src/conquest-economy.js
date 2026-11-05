import {CONQUEST} from './sim.gen.js';
// Separate Conquest ledger. Nothing here modifies Arcade, airdrop or paid inventory.
export const POLICY=Object.freeze({day:86400000,patrolRefresh:1200000,dropLife:300000,wreckLife:600000,maxDrops:48,maxWrecks:3,pickupRadius:6,visibleRadius:350,daily:{cp:3000,alloy:300,biomass:240,helium:60},terminal:{x:1174,z:1168,r:12},first:{cp:250,alloy:24,biomass:16,helium:6},replay:{cp:75,alloy:8,biomass:5,helium:2}});
const MATERIALS=['alloy','biomass','helium'],empty=()=>({alloy:0,biomass:0,helium:0});
export function ledger(s,now){s.ledger=s.ledger||{cp:0,banked:empty(),cargo:empty()};s.drops=s.drops||[];s.wrecks=s.wrecks||[];s.spawns=s.spawns||{};s.missionClaims=s.missionClaims||{};const day=Math.floor(now/POLICY.day);if(s.daily?.day!==day)s.daily={day,cp:0,...empty(),missionKills:[]};s.drops=s.drops.filter(d=>d.expires>now).slice(-POLICY.maxDrops);s.wrecks=s.wrecks.filter(d=>d.expires>now).slice(-POLICY.maxWrecks);return s.ledger;}
function grant(s,amount,mission=false){const awarded={};for(const k of ['cp',...MATERIALS]){const n=Math.max(0,mission?(amount[k]||0):amount[k]||0);s.daily[k]+=n;awarded[k]=n;if(k==='cp')s.ledger.cp+=n;else s.ledger.cargo[k]+=n;}s.reputation=(s.reputation||0)+Math.floor((awarded.cp||0)/3);s.notice={kind:'reward',...awarded};return awarded;}
export function killLoot(s,e,now){
 ledger(s,now);if(e.lootCreated)return;e.lootCreated=true;
 let id;if(s.mission&&!e.resident){const key=e.rewardKey;if(!key||s.daily.missionKills.includes(key))return;s.daily.missionKills.push(key);id='m:'+s.daily.day+':'+key;}
 else {const meta=s.spawns[e.key]||(s.spawns[e.key]={generation:Math.floor(now/POLICY.day)});if(meta.lootGeneration===meta.generation)return;meta.lootGeneration=meta.generation;meta.deadAt=now;id='e:'+e.key+':'+meta.generation;}
 const heavy=e.kind==='command'||e.kind==='sentinel',patrol=e.base?.kind==='patrol';
 const amount=heavy?{cp:45,alloy:6,biomass:4,helium:1}:patrol?{cp:7,alloy:2,biomass:1,helium:0}:{cp:18,alloy:3,biomass:2,helium:0};
 if(s.drops.some(d=>d.id===id))return;s.drops.push({id,x:e.x,y:e.y,z:e.z,amount,expires:now+POLICY.dropLife});s.drops=s.drops.slice(-POLICY.maxDrops);
}
export function pickups(s,now){ledger(s,now);for(const d of [...s.drops])if(Math.hypot(d.x-s.position.x,d.z-s.position.z)<=POLICY.pickupRadius&&Math.abs(d.y-s.position.y)<6){grant(s,d.amount);s.drops=s.drops.filter(x=>x.id!==d.id);}for(const w of [...s.wrecks])if(Math.hypot(w.x-s.position.x,w.z-s.position.z)<=POLICY.pickupRadius&&Math.abs(w.y-s.position.y)<6){for(const k of MATERIALS)s.ledger.cargo[k]+=w.amount[k];s.wrecks=s.wrecks.filter(x=>x.id!==w.id);s.notice={kind:'wreck-recovered',...w.amount};}}
export function death(s,now){ledger(s,now);if(s.death?.active)return;s.deathSerial=(s.deathSerial||0)+1;const amount=empty();for(const k of MATERIALS){amount[k]=Math.floor(s.ledger.cargo[k]/2);s.ledger.cargo[k]-=amount[k];}const id='wreck:'+s.deathSerial;s.wrecks.push({id,...s.position,amount,expires:now+POLICY.wreckLife});s.wrecks=s.wrecks.slice(-POLICY.maxWrecks);s.death={active:true,id,at:now,expires:now+POLICY.wreckLife,position:{...s.position},amount};s.notice={kind:'defeat'};}
export function missionReward(s,now){ledger(s,now);const id=s.mission,claim=s.missionClaims[id];
 if(claim&&now-(claim.lastAt||claim.firstAt)<180000)return {kind:'cooldown',cp:0,alloy:0,biomass:0,helium:0};
 const first=!claim,daily=claim?.day!==s.daily.day,amount=first?{...POLICY.first,cp:({convoy:140,relay:130,recon:100,rescue:150,redoubt:220})[id]||250}:daily?POLICY.replay:{cp:45,alloy:6,biomass:4,helium:1};
 const awarded=grant(s,{...amount,cp:amount.cp+(s.featuredMission?20:0)},true);s.missionClaims[id]={firstAt:claim?.firstAt||now,lastAt:now,day:s.daily.day,count:(claim?.count||0)+1};
 s.orders=s.orders?.day===s.daily.day?s.orders:{day:s.daily.day,completed:0};s.orders.completed++;
 if(s.orders.completed===3){s.ledger.cp+=100;s.reputation+=50;s.achievements=s.achievements||{};s.achievements['field-veteran']=s.achievements['field-veteran']||now;awarded.cp+=100;}
 return {kind:first?'first-clear':daily?'daily-replay':'repeat',reputation:Math.floor(awarded.cp/3),...awarded};}
export function atTerminal(s){return !s.mission&&s.hp>0&&(Math.hypot(s.position.x-POLICY.terminal.x,s.position.z-POLICY.terminal.z)<=POLICY.terminal.r||s.base?.modules?.vault&&Math.hypot(s.position.x-CONQUEST.Combat.baseDefinition.x,s.position.z-CONQUEST.Combat.baseDefinition.z)<=18);}
export function bank(s,now){ledger(s,now);if(!atTerminal(s))throw Error('conquest: approach Refuge supply terminal');for(const k of MATERIALS){s.ledger.banked[k]+=s.ledger.cargo[k];s.ledger.cargo[k]=0;}s.notice={kind:'banked'};}
