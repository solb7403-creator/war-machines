/* Local, reward-free Conquest combat. Equipment math remains in rules.js/game.js. */
(function(root){
'use strict';
const W=root.ConquestWorld;
// Conquest-only registry. Owned wpspd already includes the canonical Velocity Core/mods.
const profiles=Object.freeze(Object.fromEntries(Object.entries({
 twin:{interval:.22,range:82,heat:8,cooling:16},pulse:{interval:.50,range:92,heat:17,cooling:13},
 moon:{interval:.95,range:125,heat:36,cooling:10},siege:{interval:1.20,range:100,heat:30,cooling:9}
}).map(([k,v])=>[k,Object.freeze(v)])));
const tracks=Object.freeze({heatCapacity:.09,heatCooling:.09,bulletVelocity:.10,bulletRange:.09,dashDistance:.10,dashCooldown:-.04,shieldDuration:.08,shieldCooldown:-.04});
const costs=Object.freeze([{cp:100,alloy:4,biomass:2,helium:0},{cp:250,alloy:12,biomass:6,helium:0},{cp:600,alloy:25,biomass:15,helium:2}].map(Object.freeze));
const tuningKeys=Object.freeze(['thermal','ballistics','mobility','shield']);
function engineeringDefaults(e={}){return {ranks:Object.fromEntries(Object.keys(tracks).map(k=>[k,Number.isInteger(e.ranks?.[k])?clamp(e.ranks[k],0,3):0])),tuning:Object.fromEntries(tuningKeys.map(k=>[k,Number.isInteger(e.tuning?.[k])?clamp(e.tuning[k],-3,3):0]))};}
function engineeringValues(stats,e){
 const {ranks:r,tuning:t}=engineeringDefaults(e),p=profiles[stats.wtype]||profiles.pulse;
 const bonus=k=>r[k]*tracks[k],benefit=v=>Math.max(0,v)*.05-Math.max(0,-v)*.035,cost=v=>Math.max(0,v)*.035-Math.max(0,-v)*.05;
 return {capacity:100*(1+bonus('heatCapacity')+benefit(t.thermal)),cooling:p.cooling*(1+bonus('heatCooling')+benefit(-t.thermal)),heatPerShot:p.heat,
 velocity:stats.wpspd*3*(1+bonus('bulletVelocity')+benefit(-t.ballistics)),range:p.range*(1+bonus('bulletRange')+benefit(t.ballistics)),
 dashTime:.4,dashSpeed:5.1*(1+bonus('dashDistance')+benefit(t.mobility)),dashCooldown:Math.max(1,4*(stats.dashCdM||1)*(1+bonus('dashCooldown')+cost(t.mobility))),
 shieldDuration:3*(1+bonus('shieldDuration')+benefit(t.shield)),shieldCooldown:Math.max(5,25*(stats.shieldCdM||1)*(1+bonus('shieldCooldown')+cost(t.shield)))};
}

const mission=Object.freeze({id:'oxygen-line',x:1160,z:1048,name:'HOLD THE OXYGEN LINE',activationRadius:150});
// Authored constants, deliberately independent of the pilot's equipment and performance.
const archetypes=Object.freeze({
 raider:Object.freeze({name:'Parasite interceptor',cls:'scout',arch:'twin',hp:180,dps:18,shot:.45,speed:2.8,range:43,role:'player'}),
 breacher:Object.freeze({name:'Parasite oxygen saboteur',cls:'vanguard',arch:'siege',hp:230,dps:24,shot:1.15,speed:2.1,range:40,role:'facility'}),
 sentinel:Object.freeze({name:'Parasite heavy sentinel',cls:'titan',arch:'siege',hp:1100,dps:72,shot:1.15,speed:1.8,range:54,role:'player'}),
 command:Object.freeze({name:'Parasite fire coordinator',cls:'titan',arch:'pulse',hp:330,dps:26,shot:.65,speed:2.0,range:48,role:'support'})
});
const installations=W.installations;
const patrols=Object.freeze([{id:'patrol-01',kind:'raider',x:1260,z:970,route:[[1260,970],[1290,970],[1280,1000],[1255,995]]},{id:'patrol-02',kind:'sentinel',x:1300,z:1150,route:[[1300,1150],[1270,1140],[1260,1110],[1290,1120]]}]);
const formations=Object.freeze([
 Object.freeze([['raider',1218,995],['breacher',1230,995]]),
 Object.freeze([['raider',1218,995],['breacher',1230,995]]),
 Object.freeze([['raider',1218,995],['breacher',1230,995],['command',1240,995]])
]);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function freeze(o){Object.values(o).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(o);}
function center(p){return {x:p.x,y:p.y+2.2,z:p.z};}
// Conservative solid volumes share authored landmark geometry. Terrain uses its exact triangles.
function blocked(x,y,z){
 if(W.blockedAt)return W.blockedAt(x,y,z);
 if(y<=W.groundAt(x,z)+.08)return true;
 for(let i=0;i<3;i++){const a=1150+i*30,h=90+i%2*38,b=W.groundAt(a,1080);if(Math.hypot(x-a,z-1080)<11&&y>=b&&y<=b+h+16)return true;}
 for(let i=0;i<9;i++){const a=1110+i%3*22,b=1148+Math.floor(i/3)*25,h=W.groundAt(a,b);if(Math.hypot(x-a,z-b)<7.8&&y>=h&&y<=h+10)return true;}
 const deck=W.deckAt(x,z);if(deck!==null&&y<deck+.3&&y>deck-1.3)return true;
 for(const a of [970,1070])for(const b of [1018,1030])if(Math.abs(x-a)<1.7&&Math.abs(z-b)<1.7&&y<24&&y>W.groundAt(x,z))return true;
 return false;
}
function lineClear(a,b,allowObjective=false){const d=dist(a,b),n=Math.max(1,Math.ceil(d/.5));for(let i=1;i<n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,z=a.z+(b.z-a.z)*t;if(allowObjective&&Math.hypot(x-1150,z-1080)<12)continue;if(blocked(x,y,z))return false;}return true;}
function enemyStats(a){return {cls:a.cls,gems:[],gemM:{},buffs:[],dmgM:1,critB:0,wdps:a.dps,wshot:a.shot,wpspd:42,wedge:.75};}
class Battle {
 constructor(loadout,playerPosition){
 this.snapshot=freeze(JSON.parse(JSON.stringify(loadout)));this.playerStats={...tankOf(this.snapshot,1),buffs:[]};this.playerStats.wshot=(profiles[this.playerStats.wtype]||profiles.pulse).interval;this.engineering=engineeringDefaults();this.heat=0;this.overheated=false;this.combatSpeed=machineSpeed(this.snapshot,this.playerStats);
 this.charge=0;this.shieldT=0;this.shieldCd=0;this.dashCd=0;this.turretYaw=0;this.playerMax=this.playerStats.mhp;this.playerHp=this.playerMax;this.objectiveMax=1800;this.objectiveHp=this.objectiveMax;
 this.objective={x:1150,y:W.groundAt(1150,1080)+10,z:1080};this.state='active';this.enemies=[];this.projectiles=[];this.effects=[];this.wave=0;this.waveCount=formations.length;this.kills=0;this.shots=0;this.time=0;this.cooldown=0;this.nextWave=0;this.id=0;this.seed=0x03012026;this.aim={x:playerPosition.x,y:playerPosition.y+2,z:playerPosition.z+50};this.player=center(playerPosition);this.approachGrace=Math.hypot(playerPosition.x-mission.x,playerPosition.z-mission.z)>65?60:0;this.spawnWave();
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 spawnWave(){if(this.wave>=formations.length)return;for(const [slot,[kind,x,z]] of formations[this.wave].entries()){const a=archetypes[kind];this.enemies.push({id:++this.id,rewardKey:'wave:'+(this.wave+1)+':'+slot,kind,cls:a.cls,arch:a.arch,x,z,y:W.groundAt(x,z),surface:'ground',hp:a.hp,maxHp:a.hp,heading:Math.PI,turret:Math.PI,stats:enemyStats(a),decision:0,cd:1.5+this.enemies.length*.18,vx:0,vz:0,role:a.role});}this.wave++;this.nextWave=0;}
 shoot(from,to,stats,team,kind,owner){
 if(this.projectiles.length>=96)return false;if(team==='enemy'&&this.enemies.some(e=>e.id===owner&&e.resident&&(e.target===e.home||e.target===e.navGoal)))return false;let d=dist(from,to);if(d<.01)return false;const values=engineeringValues(stats,this.engineering),speed=team==='player'?values.velocity:stats.wpspd;
 if(kind==='twin'){const side=this.shots%2?1:-1,ax=(to.z-from.z)/d*.55*side,az=-(to.x-from.x)/d*.55*side;from={x:from.x+ax,y:from.y,z:from.z+az};}
 d=dist(from,to);this.projectiles.push({id:++this.id,x:from.x,y:from.y,z:from.z,vx:(to.x-from.x)/d*speed,vy:(to.y-from.y)/d*speed,vz:(to.z-from.z)/d*speed,life:(team==='player'?values.range:82)/speed,team,kind,owner,stats});this.shots++;if(team==='player')this.playerShots=(this.playerShots||0)+1;return true;
 }
 choose(e){
 const a=archetypes[e.kind],p=this.player,ec=center(e),pd=dist(ec,p);
 e.target=e.guardReturning?(e.navGoal||e.home):a.role==='player'&&pd<90||a.role==='support'&&pd<38?p:this.objective;
 const target=e.target,dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz),visible=lineClear(ec,target,target===this.objective),desired=e.guardReturning?0:a.range*.72;
 e.vx=e.vz=0;if(visible&&d<desired+4&&d>desired-10)return;
 const heading=Math.atan2(dx,dz)+(visible&&d<desired-10?Math.PI:0);let best=-Infinity;
 for(const off of [0,.45,-.45,.9,-.9,1.35,-1.35,1.8,-1.8,2.4,-2.4,Math.PI]){
 const angle=heading+off,vx=Math.sin(angle),vz=Math.cos(angle),q=W.advance(e,vx*4,vz*4),travel=Math.hypot(q.x-e.x,q.z-e.z);if(travel<2.5)continue;
 let score=-Math.abs(Math.hypot(target.x-q.x,target.z-q.z)-desired)-Math.abs(off)*.5;
 for(const other of this.enemies)if(other!==e&&other.hp>0)score-=Math.max(0,8-Math.hypot(other.x-q.x,other.z-q.z))*4;
 if(lineClear(center(q),target,target===this.objective))score+=6;
 if(score>best){best=score;e.vx=vx*a.speed;e.vz=vz*a.speed;}
 }
 }
 hit(q,t,r){const d=dist(q,q.team==='player'?center(t):t);if(d>r)return false;
 const targetCenter=q.team==='player'?center(t):t,speed2=q.vx*q.vx+q.vy*q.vy+q.vz*q.vz,rx=targetCenter.x-q.x,ry=targetCenter.y-q.y,rz=targetCenter.z-q.z,along=(rx*q.vx+ry*q.vy+rz*q.vz)/Math.sqrt(speed2),off=Math.sqrt(Math.max(0,rx*rx+ry*ry+rz*rz-along*along));
 const owner=q.stats,direct=off<r*.4,isCrit=direct&&this.random()<CRIT_BASE+gsum(owner,'lck')+(owner.critB||0),edge=direct?(isCrit?CRIT_MULT:1):owner.wedge||GRAZE;
 const defender=q.team==='player'?t.stats:t===this.player?this.playerStats:null;
 let damage=owner.wdps*owner.wshot*dmgMult(owner)*projectileImpactMult(owner)*edge*(defender?cmult(owner,defender)*(1-armor(defender)):1);
 if(q.team!=='player'&&t===this.player&&this.shieldT>0)damage*=SHIELD_MULT;
 if(q.team==='player'){this.charge=Math.min(SUPER_MAX,this.charge+(Math.min(t.hp,damage)*FILL_DEALT+(isCrit?FILL_CRIT:0))*(this.playerStats.fillM||1));t.hp=Math.max(0,t.hp-damage);if(t.hp===0){this.kills++;this.effects.push({kind:'destroy',x:t.x,y:t.y+2,z:t.z,life:.7});}}
 else if(t===this.player){this.charge=Math.min(SUPER_MAX,this.charge+Math.min(this.playerHp,damage)*FILL_TAKEN*(this.playerStats.fillM||1)*(this.playerStats.hitChg||1));this.playerHp=Math.max(0,this.playerHp-damage);}else if(this.time>=this.approachGrace)this.objectiveHp=Math.max(0,this.objectiveHp-damage);
 this.effects.push({kind:'impact',x:q.x,y:q.y,z:q.z,life:q.kind==='siege'?.3:.15,weapon:q.kind});
 // Heavy shells retain their shared direct damage; fragments affect only nearby distinct targets.
 if(q.kind==='siege'&&q.team==='player')for(const e of this.enemies)if(e!==t&&e.hp>0&&dist(center(e),q)<5&&lineClear(q,center(e))){const dealt=Math.min(e.hp,damage*.3);this.charge=Math.min(SUPER_MAX,this.charge+dealt*FILL_DEALT*(this.playerStats.fillM||1));e.hp=Math.max(0,e.hp-damage*.3);if(e.hp===0){this.kills++;this.effects.push({kind:'destroy',x:e.x,y:e.y+2,z:e.z,life:.7});}}
 return true;
 }
 moveShots(dt){
 for(const q of this.projectiles){const start={x:q.x,y:q.y,z:q.z};const travel=Math.min(dt,q.life),n=Math.max(1,Math.ceil(Math.hypot(q.vx,q.vy,q.vz)*travel/.35));for(let i=0;i<n&&q.life>0;i++){
 q.x+=q.vx*travel/n;q.y+=q.vy*travel/n;q.z+=q.vz*travel/n;
 if(q.x<0||q.z<0||q.x>W.WIDTH||q.z>W.LENGTH||q.y<=W.groundAt(q.x,q.z)){q.life=0;break;}
 let hit=false;if(q.team==='player'){for(const e of this.enemies)if(e.hp>0&&this.hit(q,e,2.7)){hit=true;break;}}else hit=this.hit(q,this.player,2.5)||this.hit(q,this.objective,14);
 if(hit||blocked(q.x,q.y,q.z)){q.life=0;break;}}
 
 q.life-=dt;}
 this.projectiles=this.projectiles.filter(q=>q.life>0);
 }
 tick(dt,playerPosition,input={}){
 if(this.state!=='active')return;dt=clamp(Number(dt)||0,0,.25);this.player=center(playerPosition);if(input.aim&&[input.aim.x,input.aim.y,input.aim.z].every(Number.isFinite))this.aim={...input.aim};
 // Fixed 60 Hz integration keeps collision, fire cadence and AI equivalent at low rendering rates.
 let left=dt;while(left>1e-8&&this.state==='active'){const h=Math.min(left,1/60);left-=h;this.step(h,!!input.fire);}
 }
 step(dt,fire){
 this.time+=dt;this.abilityStep?.(dt);this.cooldown=Math.max(-dt,this.cooldown-dt);this.effects.forEach(e=>e.life-=dt);this.effects=this.effects.filter(e=>e.life>0).slice(-32);
 const thermal=engineeringValues(this.playerStats,this.engineering);this.heat=Math.max(0,(this.heat||0)-thermal.cooling*dt);
 if(this.overheated&&this.heat<=thermal.capacity*.35)this.overheated=false;
 if(fire&&!this.overheated&&this.cooldown<=1e-9){if(this.shoot(this.player,this.aim,this.playerStats,'player',this.playerStats.wtype,0)){
 this.effects.push({kind:'muzzle',x:this.player.x,y:this.player.y,z:this.player.z,weapon:this.playerStats.wtype,life:.1});this.cooldown+=this.playerStats.wshot/rofMult(this.playerStats);this.heat=Math.min(thermal.capacity,this.heat+thermal.heatPerShot);if(this.heat>=thermal.capacity)this.overheated=true;
 }}else if(!fire||this.overheated)this.cooldown=Math.max(0,this.cooldown);
 if(this.playerStats.gems.includes('reg'))this.playerHp=Math.min(this.playerMax,this.playerHp+this.playerMax*gsum(this.playerStats,'reg')*dt);
 for(const e of this.enemies){if(e.hp<=0)continue;e.decision-=dt;e.cd-=dt;if(e.decision<=0){if(e.resident)Encounter.prototype.choose.call(this,e);else this.choose(e);e.decision=.3;}
 const p=W.advance(e,e.vx*dt,e.vz*dt);if(p!==e){e.x=p.x;e.y=p.y;e.z=p.z;e.surface=p.surface;if(e.vx||e.vz)e.heading=Math.atan2(e.vx,e.vz);}
 const target=e.target||this.objective,ec=center(e),want=Math.atan2(target.x-e.x,target.z-e.z),delta=Math.atan2(Math.sin(want-e.turret),Math.cos(want-e.turret));e.turret+=clamp(delta,-2*dt,2*dt);
 if(e.cd<=0&&Math.abs(delta)<.15&&dist(ec,target)<archetypes[e.kind].range&&lineClear(ec,target,target===this.objective)){this.shoot(ec,target,e.stats,'enemy',e.arch,e.id);e.cd=e.stats.wshot;}
 }
 this.moveShots(dt);
 if(this.playerHp<=0||this.objectiveHp<=0){this.state='defeat';this.reason=this.playerHp<=0?'War Machine disabled':'Oxygen infrastructure destroyed';this.projectiles=[];return;}
 if(!this.localEncounter&&!this.enemies.some(e=>!e.resident&&e.hp>0)){if(this.wave===formations.length){this.state='victory';this.projectiles=[];}else{this.nextWave+=dt;if(this.nextWave>=3)this.spawnWave();}}
 if(!this.localEncounter&&Math.hypot(this.player.x-mission.x,this.player.z-mission.z)>240){this.state='defeat';this.reason='Retreated beyond the defense perimeter';this.projectiles=[];}
 }
 dispose(){this.projectiles=[];this.enemies=[];this.effects=[];}
}
// A small local theater uses the same projectiles, damage, models and steering as missions.
// Defeated guards are personal client state, never rewards or territorial ownership.
class Encounter extends Battle {
 constructor(loadout,p,cleared={}){
  super(loadout,p);this.localEncounter=true;this.enemies=[];this.wave=formations.length;this.id=10000;this.objectiveHp=this.objectiveMax=1e9;this.cleared=cleared=cleared&&typeof cleared==='object'&&!Array.isArray(cleared)?cleared:{};
  for(const base of installations)for(let i=0;i<2;i++){
   const kind=i?'command':'raider',a=archetypes[kind],x=base.x+(i?10:-10),z=base.z-12;
   this.enemies.push({id:++this.id,key:base.id+':'+i,base,home:{x,z,y:W.groundAt(x,z)+2.2},kind,cls:a.cls,arch:a.arch,x,z,y:W.groundAt(x,z),surface:'ground',hp:cleared[base.id+':'+i]?0:a.hp,maxHp:a.hp,heading:Math.PI,turret:Math.PI,stats:enemyStats(a),decision:0,cd:2,vx:0,vz:0,role:'guard'});
  }
  for(const site of patrols){const a=archetypes[site.kind],x=site.x,z=site.z;this.enemies.push({id:++this.id,key:site.id,base:{...site,kind:'patrol'},route:site.route,home:{x,z,y:W.groundAt(x,z)+2.2},kind:site.kind,cls:a.cls,arch:a.arch,x,z,y:W.groundAt(x,z),surface:'ground',hp:cleared[site.id]?0:a.hp,maxHp:a.hp,heading:0,turret:0,stats:enemyStats(a),decision:0,cd:2,vx:0,vz:0,role:'guard'});}
 }
 spawnWave(){} // guard lifecycle is independent of mission waves
 choose(e){
  const d=Math.hypot(this.player.x-e.x,this.player.z-e.z),homeDistance=Math.hypot(this.player.x-e.home.x,this.player.z-e.home.z);
  const alerted=d<65||e.hp<e.maxHp;
  if(alerted&&homeDistance<100){const objective=this.objective;this.objective=this.player;super.choose(e);this.objective=objective;e.target=this.player;}
  else {e.guardReturning=true;if(e.route){e.routeIndex=e.routeIndex||0;if(Math.hypot(e.x-e.route[e.routeIndex][0],e.z-e.route[e.routeIndex][1])<3)e.routeIndex=(e.routeIndex+1)%e.route.length;const [x,z]=e.route[e.routeIndex];e.navGoal={x,z,y:W.groundAt(x,z)+2.2};}super.choose(e);e.guardReturning=false;}
  const q=W.advance(e,e.vx,e.vz);if(Math.hypot(q.x-e.home.x,q.z-e.home.z)>65)e.vx=e.vz=0;
 }
 shoot(from,to,stats,team,kind,owner){if(team==='enemy'&&this.enemies.some(e=>e.id===owner&&(e.target===e.home||e.target===e.navGoal)))return false;return super.shoot(from,to,stats,team,kind,owner);}
 step(dt,fire){
  // Only nearby installations run AI, and only while exploration is active.
  const all=this.enemies,near=all.filter(e=>Math.hypot(e.x-this.player.x,e.z-this.player.z)<240);
  this.enemies=near;super.step(dt,fire);this.enemies=all;
  for(const e of all)if(e.hp<=0)this.cleared[e.key]=true;
  if(this.playerHp>0){this.state='active';this.reason=null;}
 }
}
root.ConquestCombat=Object.freeze({profiles,tracks,costs,tuningKeys,engineeringDefaults,engineeringValues,mission,installations,patrols,archetypes,formations,Battle,Encounter,lineClear,blocked});
})(globalThis);
