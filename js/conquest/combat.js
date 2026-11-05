/* Local, reward-free Conquest combat. Equipment math remains in rules.js/game.js. */
(function(root){
'use strict';
const W=root.ConquestWorld;
// Conquest-only registry. Owned wpspd already includes the canonical Velocity Core/mods.
const profiles=Object.freeze(Object.fromEntries(Object.entries({
 twin:{interval:.22,range:82,heat:4.8,cooling:16},pulse:{interval:.50,range:92,heat:9,cooling:13},
 moon:{interval:.95,range:125,heat:10.8,cooling:8},siege:{interval:1.20,range:100,heat:16,cooling:9}
}).map(([k,v])=>[k,Object.freeze(v)])));
const tracks=Object.freeze({heatCapacity:.09,heatCooling:.09,bulletVelocity:.10,bulletRange:.09,dashDistance:.10,dashCooldown:-.04,shieldDuration:.08,shieldCooldown:-.04});
const costs=Object.freeze([{cp:100,alloy:4,biomass:2,helium:0},{cp:250,alloy:12,biomass:6,helium:0},{cp:600,alloy:25,biomass:15,helium:2},{cp:1100,alloy:45,biomass:28,helium:4},{cp:1900,alloy:75,biomass:45,helium:7},{cp:3200,alloy:120,biomass:75,helium:12}].map(Object.freeze));
const tuningKeys=Object.freeze(['thermal','ballistics','mobility','shield']);
function engineeringDefaults(e={}){return {ranks:Object.fromEntries(Object.keys(tracks).map(k=>[k,Number.isInteger(e.ranks?.[k])?clamp(e.ranks[k],0,6):0])),tuning:Object.fromEntries(tuningKeys.map(k=>[k,Number.isInteger(e.tuning?.[k])?clamp(e.tuning[k],-3,3):0]))};}
function setHeat(B,total,capacity){total=Math.max(0,total);B.heat=Math.min(capacity,total);B.heatOverflow=Math.max(0,total-capacity);}
function engineeringValues(stats,e){
 const {ranks:r,tuning:t}=engineeringDefaults(e),p=profiles[stats.wtype]||profiles.pulse;
 const bonus=k=>r[k]*tracks[k],benefit=v=>Math.max(0,v)*.05-Math.max(0,-v)*.035,cost=v=>Math.max(0,v)*.035-Math.max(0,-v)*.05;
 return {capacity:100*(1+bonus('heatCapacity')+benefit(t.thermal)),cooling:p.cooling*(1+bonus('heatCooling')+benefit(-t.thermal)),heatPerShot:stats.wtype==='moon'?Math.min(p.heat,3.8+p.cooling*p.interval/rofMult(stats)):p.heat,
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
const droneDefinition=Object.freeze({altitude:15,takeoffSeconds:1.2,speed:4.2,maxPerCarrier:2,tellSeconds:1.1,burstSeconds:2,cycleSeconds:6});
const installations=W.installations;
// Stable authored identities preserve production v1 locks and spawn keys as the region expands.
const spawnIds=Object.freeze({'redoubt-01:0':10001,'redoubt-01:1':10002,'staging-01:0':10003,'staging-01:1':10004,'patrol-01':10005,'patrol-02':10006,'redoubt-01:2':10007,'redoubt-01:3':10008,'west-depot:0':10009,'west-depot:1':10010,'crossroads:0':10011,'crossroads:1':10012,'refuge-scout':10013,'road-intercept':10014});
const legacyOperations=[
 {...mission,family:'defense',site:'oxygen-01',danger:'STANDARD',brief:'Protect the oxygen processor through three assault waves.'},
 {id:'convoy',name:'INTERCEPT THE PARASITE CONVOY',family:'convoy',site:'convoy-lane',x:1090,z:944,danger:'STANDARD',brief:'Intercept the moving armored carrier before it reaches the north exit. Escorts cover its escape.'},
 {id:'relay',name:'SABOTAGE THE RELAY',family:'sabotage',site:'west-depot',x:994,z:944,danger:'STANDARD',brief:'Destroy the guarded relay, then remain at its terminal for eight seconds to disable the uplink.'},
 {id:'recon',name:'SIGNAL RECOVERY',family:'recon',site:'signal-ridge',x:950,z:1110,danger:'STANDARD',brief:'Scan three marked physical sites. Each scan needs three seconds nearby; recover data while scouts hunt you.'},
 {id:'rescue',name:'BEACON EXTRACTION',family:'rescue',site:'rescue-site',x:1150,z:900,danger:'HARD',brief:'Reach the stranded repair crawler and escort it to extraction. Stay close to keep it moving; defend its hull.'},
 {id:'redoubt',name:'BREAK THE REDOUBT',family:'siege',site:'redoubt-01',x:1240,z:920,danger:'VETERAN',brief:'Breach the gate garrison, defeat the armored commander and occupy the command platform.'}
 ];
// Five spatial layouts with different approach angles, routes and objective order.
const raidLayouts=freeze([
 {id:'dust-switchback',name:'Dust Switchback',x:910,z:930,sector:'western',entry:[890,945],route:[[900,920],[930,908],[943,938]],offsets:[[-2,-20],[24,-22],[34,8]],hazard:'drone'},
 {id:'basin-crescent',name:'Basin Crescent',x:1070,z:850,sector:'helium',entry:[1048,862],route:[[1060,834],[1082,828],[1098,850]],offsets:[[-8,-20],[18,-24],[32,0]],hazard:'orbital'},
 {id:'ash-approach',name:'Ash Approach',x:1260,z:845,sector:'ash',entry:[1238,857],route:[[1250,824],[1280,822],[1292,844]],offsets:[[0,-24],[24,-18],[34,14]],hazard:'plasma'},
 {id:'spear-flank',name:'Spear Flank',x:1320,z:1010,sector:'oxygen',entry:[1298,1022],route:[[1310,990],[1334,988],[1350,1010]],offsets:[[-4,-22],[24,-20],[35,8]],hazard:'orbital'},
 {id:'ridge-hook',name:'Ridge Hook',x:1290,z:1210,sector:'ridge',entry:[1268,1222],route:[[1280,1192],[1304,1188],[1320,1210]],offsets:[[-2,-20],[20,-24],[32,10]],hazard:'plasma'}
]);
const raidFamilies=freeze([
 {id:'intercept',name:'ARMORED INTERCEPTION',commander:'ambush',brief:'Cut off the armored carrier before its escape. Eliminate its flanking escorts, then recover its route telemetry at the marked command point.'},
 {id:'sabotage',name:'COMMAND UPLINK SABOTAGE',commander:'shield',brief:'Destroy the command relay and its shield commander, then occupy the vulnerable uplink for six uninterrupted seconds.'},
 {id:'battery',name:'ANTI-AIR BATTERY KNOCKOUT',commander:'artillery',brief:'Knock out both fixed anti-air batteries and their artillery coordinator. Sweep the two separated launch-control points to complete the shutdown.'},
 {id:'extraction',name:'HELIUM DEPOT EXTRACTION',commander:'carrier',brief:'Clear the drone-carrier escort guarding the depot, recover three separated helium canisters, then return to the marked extraction point.'},
 {id:'siege',name:'PLASMA FORTRESS BREACH',commander:'plasma',brief:'Breach the outer mixed garrison. Defeat the plasma siege general in the second phase, then occupy its command platform while avoiding marked plasma impacts.'}
]);
function raidPoint(x,z){for(const r of [0,5,10,15,20,25])for(let i=0;i<(r?16:1);i++){const p={x:x+Math.cos(i*Math.PI/8)*r,z:z+Math.sin(i*Math.PI/8)*r,surface:'ground'};p.y=W.groundAt(p.x,p.z);if(!W.solidAt(p.x,p.z)&&[[4,0],[-4,0],[0,4],[0,-4]].every(([a,b])=>{const q=W.advance(p,a,b);return Math.hypot(q.x-p.x-a,q.z-p.z-b)<.2;}))return [p.x,p.z];}throw Error('conquest: no clear raid approach');}
const raidOperations=raidFamilies.flatMap((f,fi)=>raidLayouts.map((l,i)=>({id:'raid-'+f.id+'-'+(i+1),raid:true,family:f.id,name:f.name+' / '+l.name.toUpperCase(),site:'raid-site-'+f.id+'-'+(i+1),sector:l.sector,layout:l.id,x:l.x+fi*3,z:l.z+fi*4,entry:raidPoint(l.entry[0]+fi*3,l.entry[1]+fi*4),route:l.route.map(([x,z])=>raidPoint(x+fi*3,z+fi*4)),offsets:l.offsets,hazard:l.hazard,commander:f.commander,danger:i<2?'HARD':'VETERAN',brief:f.brief+' '+l.name+' uses '+l.hazard+' targeting across a distinct '+l.sector+' approach.',reward:{cp:180+i*20+fi*15,alloy:18+i*2,biomass:12+fi,helium:3+i}})));
const raidIds=Object.freeze(raidOperations.map(o=>o.id)),sectors=W.sectors;
const operations=freeze(Object.fromEntries([...legacyOperations,...raidOperations,...sectors.map(sector=>{const [x,z]=raidPoint(sector.x,sector.z);return {id:'sector-defense-'+sector.id,name:sector.name+' / INVASION DEFENSE',family:'sector-defense',defense:true,sector:sector.id,site:sector.id,x,z,danger:'HARD',brief:'Repel two incoming Parasite assault waves before they destroy the sector command beacon. A failed defense can recapture this frontier; your permanent first-clear history remains.',reward:{cp:160,alloy:15,biomass:10,helium:2}};}),{id:'base-defense',name:'COMMAND BASE / DEFENSE ALERT',family:'base-defense',site:'personal-base',x:1080,z:1160,danger:'HARD',brief:'Repel two incoming Parasite assault teams. Defend the Command Base reactor while using earned fortifications and your own weapons.',reward:{cp:160,alloy:15,biomass:10,helium:2}}].map(o=>[o.id,{activationRadius:45,...o}])));
// Explicit finite schema, shared previews and server debits; all costs use Conquest-only balances.
const baseDefinition=freeze({x:1080,z:1160,radius:18,recipe:{cp:2550,alloy:110,biomass:65,helium:8},
 tiers:[{cp:2550,alloy:110,biomass:65,helium:8},{cp:4500,alloy:160,biomass:95,helium:12},{cp:4200,alloy:250,biomass:150,helium:20},{cp:6500,alloy:380,biomass:240,helium:32},{cp:10000,alloy:550,biomass:350,helium:50}],
 modules:{reactor:'Claimable CP production',hangar:'Field repair station',defense:'Protective field at your base',vault:'Protected banking at your base',radar:'Regional signal intelligence',uplink:'Operations production capacity'},
 moduleCosts:[{cp:180,alloy:12,biomass:8,helium:1},{cp:400,alloy:25,biomass:16,helium:3},{cp:850,alloy:50,biomass:30,helium:6}],buildSeconds:[60,180,360],maxTier:5});
function baseBenefits(tier=0,modules={}){const defense=modules.defense||0,radar=modules.radar||0;return {radius:Math.max(18+6*defense,tier>=5?30:tier>=4?24:0),mitigation:Math.min(.5,defense*.1+(tier>=4?.1:0)+(tier>=5?.05:0)),radar:Math.max(radar,tier>=5?1:0),radarRange:120+100*Math.max(radar,tier>=5?1:0)+(tier>=5?100:0)};}
const patrols=Object.freeze([{id:'refuge-scout',kind:'raider',x:956,z:1100,route:[[956,1100],[978,1090],[994,1105],[970,1120]]},{id:'road-intercept',kind:'raider',x:1080,z:945,route:[[1080,945],[1115,945],[1130,970],[1100,975]]},{id:'patrol-01',kind:'raider',x:1260,z:970,route:[[1260,970],[1290,970],[1280,1000],[1255,995]]},{id:'patrol-02',kind:'sentinel',x:1300,z:1150,route:[[1300,1150],[1270,1140],[1260,1110],[1290,1120]]}]);
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
function lineClear(a,b,allowObjective=false){if(W.installationOccludes?.(a,b))return false;const d=dist(a,b),n=Math.max(1,Math.ceil(d/.5));for(let i=1;i<n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,z=a.z+(b.z-a.z)*t;if(allowObjective&&Math.hypot(x-1150,z-1080)<12)continue;if(blocked(x,y,z))return false;}return true;}
function enemyStats(a){return {cls:a.cls,gems:[],gemM:{},buffs:[],dmgM:1,critB:0,wdps:a.dps,wshot:a.shot,wpspd:42,wedge:.75};}
class Battle {
 constructor(loadout,playerPosition){
 this.snapshot=freeze(JSON.parse(JSON.stringify(loadout)));this.playerStats={...tankOf(this.snapshot,1),buffs:[]};this.playerStats.wshot=(profiles[this.playerStats.wtype]||profiles.pulse).interval;this.engineering=engineeringDefaults();this.heat=0;this.overheated=false;this.combatSpeed=machineSpeed(this.snapshot,this.playerStats);
 this.charge=0;this.shieldT=0;this.shieldCd=0;this.dashCd=0;this.turretYaw=0;this.playerMax=this.playerStats.mhp;this.playerHp=this.playerMax;this.objectiveMax=1800;this.objectiveHp=this.objectiveMax;
 this.objective={x:1150,y:W.groundAt(1150,1080)+10,z:1080};this.state='active';this.enemies=[];this.projectiles=[];this.effects=[];this.wave=0;this.waveCount=formations.length;this.kills=0;this.shots=0;this.time=0;this.cooldown=0;this.nextWave=0;this.id=0;this.seed=0x03012026;this.aim={x:playerPosition.x,y:playerPosition.y+2,z:playerPosition.z+50};this.player=center(playerPosition);this.approachGrace=Math.hypot(playerPosition.x-mission.x,playerPosition.z-mission.z)>65?60:0;this.spawnWave();
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 spawnWave(){if(this.wave>=formations.length)return;for(const [slot,[kind,x,z]] of formations[this.wave].entries()){const a=archetypes[kind];this.enemies.push({id:++this.id,rewardKey:'wave:'+(this.wave+1)+':'+slot,kind,cls:a.cls,arch:a.arch,x,z,y:W.groundAt(x,z),surface:'ground',hp:a.hp,maxHp:a.hp,heading:Math.PI,turret:Math.PI,stats:enemyStats(a),decision:(this.id%10)*.03,cd:1.5+this.enemies.length*.18,vx:0,vz:0,role:a.role});}this.wave++;this.nextWave=0;}
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
 if(q.team!=='player'&&t===this.player){if(this.shieldT>0)damage*=SHIELD_MULT;const base=baseBenefits(this.baseTier,this.baseModules);if(Math.hypot(this.player.x-baseDefinition.x,this.player.z-baseDefinition.z)<base.radius)damage*=1-base.mitigation;}
 if(q.team==='player'&&t.pattern==='shield'&&this.time%8<3)damage*=.35;
 if(q.team==='player'){this.alert(t);this.charge=Math.min(SUPER_MAX,this.charge+(Math.min(t.hp,damage)*FILL_DEALT+(isCrit?FILL_CRIT:0))*(this.playerStats.fillM||1));t.hp=Math.max(0,t.hp-damage);if(t.hp===0){this.kills++;this.effects.push({kind:'destroy',x:t.x,y:t.y+2,z:t.z,life:.7});}}
 else if(t===this.player){this.charge=Math.min(SUPER_MAX,this.charge+Math.min(this.playerHp,damage)*FILL_TAKEN*(this.playerStats.fillM||1)*(this.playerStats.hitChg||1));this.playerHp=Math.max(0,this.playerHp-damage);}else if(this.time>=this.approachGrace)this.objectiveHp=Math.max(0,this.objectiveHp-damage*(this.defenseConfig==='shield'?.6:1));
 this.effects.push({kind:'impact',x:q.x,y:q.y,z:q.z,life:q.kind==='siege'?.3:.15,weapon:q.kind});
 // Heavy shells retain their shared direct damage; fragments affect only nearby distinct targets.
 if(q.kind==='siege'&&q.team==='player')for(const e of this.enemies)if(e!==t&&e.hp>0&&dist(center(e),q)<5&&lineClear(q,center(e))){const dealt=Math.min(e.hp,damage*.3);this.charge=Math.min(SUPER_MAX,this.charge+dealt*FILL_DEALT*(this.playerStats.fillM||1));e.hp=Math.max(0,e.hp-damage*.3);if(e.hp===0){this.kills++;this.effects.push({kind:'destroy',x:e.x,y:e.y+2,z:e.z,life:.7});}}
 return true;
 }
 alert(e){if(!e.key||e.radioCalled)return;e.radioCalled=true;for(const ally of this.enemies)if(ally!==e&&ally.hp>0&&Math.hypot(ally.x-e.x,ally.z-e.z)<80)ally.radioUntil=this.time+12;this.effects.push({kind:'radio',x:e.x,y:e.y+5,z:e.z,life:.5});}
 moveShots(dt){
 for(const q of this.projectiles){const start={x:q.x,y:q.y,z:q.z};const travel=Math.min(dt,q.life),n=Math.max(1,Math.ceil(Math.hypot(q.vx,q.vy,q.vz)*travel/.35));for(let i=0;i<n&&q.life>0;i++){
 q.x+=q.vx*travel/n;q.y+=q.vy*travel/n;q.z+=q.vz*travel/n;
 if(q.x<0||q.z<0||q.x>W.WIDTH||q.z>W.LENGTH||q.y<=W.groundAt(q.x,q.z)){q.life=0;break;}
 let hit=false;if(q.team==='player'){for(const e of this.enemies)if(e.hp>0&&this.hit(q,e,2.7)){hit=true;break;}}else hit=this.hit(q,this.player,2.5)||(this.objectiveDamageable!==false&&this.hit(q,this.objective,14));
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
 const thermal=engineeringValues(this.playerStats,this.engineering);setHeat(this,(this.heat||0)+(this.heatOverflow||0)-(this.overheated?Math.max(thermal.cooling,thermal.capacity*.13):thermal.cooling)*dt,thermal.capacity);
 if(this.overheated&&this.heat+(this.heatOverflow||0)<=thermal.capacity*.35)this.overheated=false;
 if(fire&&!this.overheated&&this.cooldown<=1e-9){if(this.shoot(this.player,this.aim,this.playerStats,'player',this.playerStats.wtype,0)){
 this.effects.push({kind:'muzzle',x:this.player.x,y:this.player.y,z:this.player.z,weapon:this.playerStats.wtype,life:.1});this.cooldown+=this.playerStats.wshot/rofMult(this.playerStats);this.heat=Math.min(thermal.capacity,this.heat+thermal.heatPerShot);if(this.heat>=thermal.capacity)this.overheated=true;
 }}else if(!fire||this.overheated)this.cooldown=Math.max(0,this.cooldown);
 if(this.playerStats.gems.includes('reg'))this.playerHp=Math.min(this.playerMax,this.playerHp+this.playerMax*gsum(this.playerStats,'reg')*dt);
 for(const e of this.enemies){if(e.hp<=0||e.dormant||e.resident&&Math.hypot(e.x-this.player.x,e.z-this.player.z)>240)continue;e.decision-=dt;e.cd-=dt;if(e.decision<=0){if(e.resident)Encounter.prototype.choose.call(this,e);else this.choose(e);e.decision=.3;}
 const p=this.enemyAdvance?this.enemyAdvance(e,dt):W.advance(e,e.vx*dt,e.vz*dt);if(p!==e){e.x=p.x;e.y=p.y;e.z=p.z;e.surface=p.surface;if(e.vx||e.vz)e.heading=Math.atan2(e.vx,e.vz);}
 const target=e.target||this.objective,ec=center(e),want=Math.atan2(target.x-e.x,target.z-e.z),delta=Math.atan2(Math.sin(want-e.turret),Math.cos(want-e.turret));e.turret+=clamp(delta,-2*dt,2*dt);
 if(e.cd<=0&&Math.abs(delta)<.15&&dist(ec,target)<archetypes[e.kind].range&&lineClear(ec,target,target===this.objective)){this.shoot(ec,target,e.stats,'enemy',e.arch,e.id);e.cd=e.stats.wshot;}
 }
 this.moveShots(dt);
 if(this.playerHp<=0||this.objectiveHp<=0){this.state='defeat';this.reason=this.playerHp<=0?'War Machine disabled':this.operation?.defense?'Sector command beacon destroyed':'Oxygen infrastructure destroyed';this.projectiles=[];return;}
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
  for(const base of installations)for(let i=0;i<(base.id==='redoubt-01'?4:2);i++){
   const kind=base.id==='redoubt-01'&&i===3?'sentinel':i?'command':'raider',a=archetypes[kind],x=base.x+(i%2?10:-10),z=base.z-12-Math.floor(i/2)*10;
   this.enemies.push({route:base.kind==='staging'?[[x,z],[x-30,z-8],[x-40,z+20],[x,z]]:null,id:++this.id,key:base.id+':'+i,base,home:{x,z,y:W.groundAt(x,z)+2.2},kind,cls:a.cls,arch:a.arch,x,z,y:W.groundAt(x,z),surface:'ground',hp:cleared[base.id+':'+i]?0:a.hp,maxHp:a.hp,heading:Math.PI,turret:Math.PI,stats:enemyStats(a),decision:(this.id%10)*.03,cd:2,vx:0,vz:0,role:'guard'});
  }
  for(const site of patrols){const a=archetypes[site.kind],x=site.x,z=site.z;this.enemies.push({id:++this.id,key:site.id,base:{...site,kind:'patrol'},route:site.route,home:{x,z,y:W.groundAt(x,z)+2.2},kind:site.kind,cls:a.cls,arch:a.arch,x,z,y:W.groundAt(x,z),surface:'ground',hp:cleared[site.id]?0:a.hp,maxHp:a.hp,heading:0,turret:0,stats:enemyStats(a),decision:(this.id%10)*.03,cd:2,vx:0,vz:0,role:'guard'});}
  for(const e of this.enemies){e.id=spawnIds[e.key];e.decision=(e.id%10)*.03;}this.id=Math.max(this.id,...this.enemies.map(e=>e.id));
 }
 spawnWave(){} // guard lifecycle is independent of mission waves
 choose(e){
  const d=Math.hypot(this.player.x-e.x,this.player.z-e.z),homeDistance=Math.hypot(this.player.x-e.home.x,this.player.z-e.home.z);
  const alerted=d<65||e.hp<e.maxHp||(e.radioUntil||0)>this.time;
  if(e.hp<e.maxHp*.2&&d<40&&homeDistance>30){e.guardReturning=true;e.navGoal=e.home;super.choose(e);e.guardReturning=false;return;}
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
// All operation progression is physical and replayed by the Worker; no client objective claims.
class Operation extends Battle {
 constructor(loadout,p,id){super(loadout,p);this.operation=operations[id];if(!this.operation)throw Error('unknown operation');this.localEncounter=true;this.enemies=[];this.id=20000;this.stage=0;this.work=0;this.scans=0;this.objectiveHp=this.objectiveMax=1200;this.objectiveDamageable=id==='rescue';this.approachGrace=0;const o=this.operation;this.objective={x:o.x,y:W.groundAt(o.x,o.z)+2.2,z:o.z};
 this.nodes=id==='recon'?[[o.x,o.z],[o.x+30,o.z+20],[o.x+55,o.z-10]]:[];
 // Installation missions fight the persistent world garrison attached by the session.
 const team=o.raid||o.defense||id==='base-defense'?[]:id==='relay'||id==='redoubt'?[]:id==='rescue'?['raider','breacher','command']:['raider','raider'];
 team.forEach((kind,i)=>this.deploy(kind,o.x+18+i*12,o.z-25,'guard:'+i));
 if(id==='convoy'){this.deploy('command',o.x,o.z-10,'carrier');this.carrierId=this.enemies.at(-1).id;}
 if(o.raid)this.setupRaid();if(id==='base-defense'||o.defense){this.objectiveDamageable=true;this.objectiveHp=this.objectiveMax=1800;this.defenseWave=0;this.deployDefense();}
 if(id==='relay'){this.deploy('command',o.x,o.z,'relay');const e=this.enemies.at(-1);e.immobile=true;e.hp=e.maxHp=450;this.relayId=e.id;}
 }
 spawnWave(){}
 setupRaid(){const o=this.operation;this.hazards=[];this.nextHazard=6;this.objectiveDamageable=false;this.nodes=o.route.map(p=>p.slice());this.extracting=false;
  const [a,b,c]=o.offsets;this.deploy('raider',o.x+a[0],o.z+a[1],'flanker');this.deploy(o.layout==='ash-approach'?'sentinel':'command',o.x+b[0],o.z+b[1],'support');
  if(o.family==='sabotage'||o.family==='battery'){for(let i=0;i<(o.family==='battery'?2:1);i++){this.deploy('command',o.x+(i?22:0),o.z+(i?-12:0),'battery:'+i);const e=this.enemies.at(-1);e.immobile=true;e.hp=e.maxHp=o.family==='battery'?240:360;e.objectiveTarget=true;}this.relayId=this.enemies.at(-1).id;}
  if(o.family==='intercept'){this.deploy('command',o.x+c[0],o.z+c[1],'carrier');const e=this.enemies.at(-1);e.hp=e.maxHp=420;this.carrierId=e.id;this.escapeStart={x:e.x,z:e.z};}
  if(o.family!=='siege')this.deployCommander();
 }
 deployCommander(){const o=this.operation;this.deploy(o.commander==='ambush'?'raider':o.commander==='carrier'?'command':'sentinel',o.x+12,o.z-38,'commander');const e=this.enemies.at(-1);e.commander=true;e.pattern=o.commander;e.hp=e.maxHp=o.commander==='ambush'?460:680;e.nextPattern=this.time+4;e.drones=0;this.commanderId=e.id;}
 defenseStep(dt){if(this.defenseConfig==='drone')this.objectiveHp=Math.min(this.objectiveMax,this.objectiveHp+12*dt);if(this.defenseConfig!=='turret')return;this.turretClock=(this.turretClock||0)-dt;if(this.turretClock>0)return;this.turretClock=.6;const from={x:this.operation.x,y:W.groundAt(this.operation.x,this.operation.z)+6,z:this.operation.z},e=this.enemies.find(e=>!e.resident&&e.hp>0&&Math.hypot(e.x-from.x,e.z-from.z)<65&&lineClear(from,center(e)));if(!e)return;const damage=18+3*(this.baseTier||0);e.hp=Math.max(0,e.hp-damage);this.effects.push({kind:'beam',weapon:'pulse',x:from.x,y:from.y,z:from.z,ex:e.x,ey:e.y+2.2,ez:e.z,life:.15});if(!e.hp){this.kills++;this.effects.push({kind:'destroy',x:e.x,y:e.y+2,z:e.z,life:.7});}}
 deployDefense(){this.defenseWave++;for(let i=0;i<3;i++){this.deploy(i===2?'breacher':'raider',this.operation.x-30+i*20,this.operation.z-40,'defense:'+this.defenseWave+':'+i);this.enemies.at(-1).role=i===2?'facility':'player';}this.objectiveDamageable=true;}
 hazardStep(dt){this.hazards=Array.isArray(this.hazards)?this.hazards:[];for(const h of this.hazards){h.remaining-=dt;if(h.remaining>0)continue;const d=Math.hypot(this.player.x-h.x,this.player.z-h.z);if(d<h.radius){let damage=h.damage*(1-.35*d/h.radius)*(1-armor(this.playerStats));if(this.shieldT>0)damage*=SHIELD_MULT;const base=baseBenefits(this.baseTier,this.baseModules);if(Math.hypot(this.player.x-baseDefinition.x,this.player.z-baseDefinition.z)<base.radius)damage*=1-base.mitigation;this.playerHp=Math.max(0,this.playerHp-damage);}if(this.objectiveDamageable&&Math.hypot(this.objective.x-h.x,this.objective.z-h.z)<h.radius)this.objectiveHp=Math.max(0,this.objectiveHp-h.damage);this.effects.push({kind:'destroy',weapon:h.kind,x:h.x,y:h.y+.8,z:h.z,r:h.radius,life:.6});}this.hazards=this.hazards.filter(h=>h.remaining>0).slice(-8);
  for(const e of this.enemies){if(!e.commander||!e.pattern||e.hp<=0||this.time<(e.nextPattern||0))continue;e.nextPattern=this.time+(e.pattern==='artillery'?6:8);e.telegraph=true;const kind=e.pattern==='plasma'?'plasma':e.pattern==='carrier'?'drone':'orbital';if(e.pattern!=='shield'&&e.pattern!=='ambush'){this.markStrike(kind,this.player.x,this.player.z,e.id);if(e.pattern==='carrier'&&e.drones<droneDefinition.maxPerCarrier&&this.enemies.filter(t=>!t.resident&&t.hp>0).length<8){this.deploy('raider',e.x+8,e.z+8,'drone:'+e.drones);const drone=this.enemies.at(-1);drone.drone=true;drone.launchedAt=this.time;drone.surface='air';drone.cd=droneDefinition.takeoffSeconds;drone.telegraph=true;e.drones++;}}}
  if(this.operation.raid&&this.time>=(this.nextHazard||6)){this.nextHazard=this.time+11;this.markStrike(this.operation.hazard,this.player.x,this.player.z,0);}
 }
 markStrike(kind,x,z,source){if(this.hazards.length>=8)return;this.hazards.push({kind,x,z,y:W.groundAt(x,z),radius:kind==='plasma'?9:6,remaining:kind==='drone'?2.6:2.2,damage:kind==='plasma'?75:55,source});}
 raidStep(dt){const o=this.operation,living=this.enemies.filter(e=>e.hp>0&&!e.resident),d=Math.hypot(this.player.x-this.objective.x,this.player.z-this.objective.z);
  if(o.family==='intercept'){const c=this.enemies.find(e=>e.id===this.carrierId);if(c.hp>0&&Math.hypot(c.x-this.escapeStart.x,c.z-this.escapeStart.z)>120){this.state='defeat';this.reason='Armored carrier escaped with the telemetry';return;}if(!living.length&&d<12)this.work+=dt;if(this.work>=3)this.state='victory';}
  if(o.family==='sabotage'){if(!living.length&&d<12)this.work+=dt;else this.work=0;this.stage=this.enemies.filter(e=>e.objectiveTarget&&e.hp<=0).length;if(this.work>=6)this.state='victory';}
  if(o.family==='battery'||o.family==='extraction'){const count=o.family==='battery'?2:3;if(!living.length){const node=this.nodes[this.scans];if(node&&Math.hypot(this.player.x-node[0],this.player.z-node[1])<10){this.work+=dt;if(this.work>=2){this.scans++;this.work=0;}}if(this.scans>=count&&(o.family==='battery'||d<12))this.state='victory';}this.stage=this.scans;}
  if(o.family==='siege'){if(!living.length&&this.stage===0){this.stage=1;this.deployCommander();}else if(!living.length&&this.stage===1&&d<14){this.work+=dt;if(this.work>=5){this.stage=2;this.state='victory';}}}
 }
 deploy(kind,x,z,key){const a=archetypes[kind];const pad=[[0,0],[8,0],[-8,0],[0,8],[0,-8],[12,8],[-12,-8],...Array.from({length:32},(_,i)=>[Math.cos(i*Math.PI/8)*(16+Math.floor(i/16)*8),Math.sin(i*Math.PI/8)*(16+Math.floor(i/16)*8)])].map(([dx,dz])=>({x:x+dx,z:z+dz})).find(p=>Math.hypot(p.x-this.player.x,p.z-this.player.z)>=8&&!W.solidAt(p.x,p.z)&&!this.enemies.some(e=>Math.hypot(e.x-p.x,e.z-p.z)<6));if(!pad)throw Error('conquest: clear the deployment apron');x=pad.x;z=pad.z;this.enemies.push({id:++this.id,rewardKey:this.operation.id+':'+key,kind,cls:a.cls,arch:a.arch,x,z,y:W.groundAt(x,z),surface:'ground',hp:a.hp,maxHp:a.hp,heading:0,turret:0,stats:enemyStats(a),decision:(this.id%10)*.03,cd:2,vx:0,vz:0,role:a.role});}
 enemyAdvance(e,dt){if(!e.drone)return W.advance(e,e.vx*dt,e.vz*dt);if(!Number.isFinite(e.launchedAt))e.launchedAt=this.time;const progress=clamp((this.time-(e.launchedAt||0))/droneDefinition.takeoffSeconds,0,1),x=clamp(e.x+e.vx*dt,1,W.WIDTH-1),z=clamp(e.z+e.vz*dt,1,W.LENGTH-1),y=W.groundAt(x,z)+droneDefinition.altitude*progress;
 // Hovercraft clear low military cover but cannot cross tall physical structures.
 if(W.blockedAt(x,y+2.2,z))return {x:e.x,z:e.z,y:W.groundAt(e.x,e.z)+droneDefinition.altitude*progress,surface:'air'};return {x,y,z,surface:'air'};
 }
 choose(e){
 if(e.drone){if(!Number.isFinite(e.launchedAt))e.launchedAt=this.time;const elapsed=this.time-(e.launchedAt||0),launch=elapsed<droneDefinition.takeoffSeconds,phase=((elapsed-droneDefinition.takeoffSeconds)%droneDefinition.cycleSeconds+droneDefinition.cycleSeconds)%droneDefinition.cycleSeconds,dx=this.player.x-e.x,dz=this.player.z-e.z,d=Math.hypot(dx,dz)||1;
 e.target=this.player;e.telegraph=launch||phase<droneDefinition.tellSeconds;e.vx=e.vz=0;if(!launch){if(d>34||d<24){const speed=d>34?droneDefinition.speed:-droneDefinition.speed;e.vx=dx/d*speed;e.vz=dz/d*speed;}else{e.vx=-dz/d*1.4;e.vz=dx/d*1.4;}}
 if(launch||phase<droneDefinition.tellSeconds||phase>=droneDefinition.tellSeconds+droneDefinition.burstSeconds)e.cd=Math.max(e.cd,.4);return;}
 if(e.id===this.carrierId){const q=W.advance(e,0,this.operation.raid?-1.5:-4);e.vx=q.x-e.x;e.vz=q.z-e.z;e.target=this.player;return;}
 if(e.immobile){e.vx=e.vz=0;e.target=this.player;return;}
 const objective=this.objective;if(this.operation.id!=='rescue'&&this.operation.family!=='base-defense'&&!this.operation.defense)this.objective=this.player;super.choose(e);this.objective=objective;
 if(e.pattern==='shield'){e.shielded=this.time%8<3;e.telegraph=e.shielded;if(e.shielded)e.vx=e.vz=0;return;}
 // The commander pauses before each aimed salvo: visible, avoidable attack tell.
 if(e.pattern==='ambush'){const cycle=this.time%8;if(cycle<2){e.vx=e.vz=0;e.cd=Math.max(e.cd,.3);e.telegraph=true;}else if(cycle<3){const a=Math.atan2(this.player.x-e.x,this.player.z-e.z)+.7;e.vx=Math.sin(a)*6;e.vz=Math.cos(a)*6;}return;}
 if(e.commander&&this.time%6<1.5){e.vx=e.vz=0;e.cd=Math.max(e.cd,.4);e.telegraph=true;}else e.telegraph=false;
 }
 step(dt,fire){if(this.operation.family==='base-defense')this.defenseStep(dt);super.step(dt,fire);if(this.state!=='active')return;this.hazardStep(dt);if(this.playerHp<=0){this.state='defeat';this.reason='War Machine disabled by a telegraphed strike';return;}const o=this.operation,d=Math.hypot(this.player.x-this.objective.x,this.player.z-this.objective.z),living=this.enemies.filter(e=>e.hp>0&&(!e.resident||(['relay','redoubt'].includes(o.id)&&e.base?.id===o.site)));
 if(o.raid)this.raidStep(dt);if((o.family==='base-defense'||o.defense)&&!living.some(e=>!e.resident)){if(this.defenseWave<2)this.deployDefense();else this.state='victory';}
 if(o.id==='convoy'){const c=this.enemies.find(e=>e.id===this.carrierId);this.stage=c.hp<=0?1:0;if(c.hp>0&&c.z<o.z-135){this.state='defeat';this.reason='Armored carrier escaped';}else if(!living.length)this.state='victory';}
 if(o.id==='relay'){const relay=this.enemies.find(e=>e.id===this.relayId);this.stage=relay.hp<=0?1:0;if(this.stage&&!living.length&&d<12)this.work+=dt;if(this.work>=8&&!living.length)this.state='victory';}
 if(o.id==='recon'){const node=this.nodes[this.scans];if(node&&Math.hypot(this.player.x-node[0],this.player.z-node[1])<9){this.work+=dt;if(this.work>=3){this.scans++;this.work=0;}}this.stage=this.scans;if(this.scans===3)this.state='victory';}
 if(o.id==='rescue'){if(d<28){const q=W.advance({x:this.objective.x,z:this.objective.z,y:this.objective.y-2.2,surface:'ground'},0,dt*2);Object.assign(this.objective,{x:q.x,y:q.y+2.2,z:q.z});}this.stage=Math.min(100,Math.floor((this.objective.z-o.z)/.8));if(this.stage>=100)this.state='victory';}
 if(o.id==='redoubt'){if(!living.length&&this.stage===0){this.stage=1;this.deploy('sentinel',o.x+12,o.z-8,'commander');this.enemies.at(-1).commander=true;}else if(!living.length&&this.stage===1&&d<18){this.work+=dt;if(this.work>=6){this.stage=2;this.state='victory';}}}
 if(Math.hypot(this.player.x-o.x,this.player.z-o.z)>260||this.time>600){this.state='defeat';this.reason='Operation perimeter abandoned or time expired';}
 if(this.state!=='active')this.projectiles=[];
 }
}
root.ConquestCombat=Object.freeze({spawnIds,operations,droneDefinition,raidIds,raidLayouts,sectors,baseDefinition,baseBenefits,Operation,profiles,tracks,costs,tuningKeys,engineeringDefaults,engineeringValues,setHeat,mission,installations,patrols,archetypes,formations,Battle,Encounter,lineClear,blocked});
})(globalThis);
