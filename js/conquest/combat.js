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

// Session 6 (first hour): the first mission is staged at the new Refuge spawn (ConquestWorld.spawn, 33 m south of this marker):
// it is in range at once (activation 60 m, was 150 m), the first wave is in sight of the spawn and every wave is in sight of a
// pilot who follows the HUD arrow (it points at the nearest living attacker during any defense mission). World data only.
const mission=Object.freeze({id:'oxygen-line',x:1152,z:1098,name:'HOLD THE OXYGEN LINE',activationRadius:60});
// Authored constants, deliberately independent of the pilot's equipment and performance.
const archetypes=Object.freeze({
 raider:Object.freeze({name:'Parasite interceptor',cls:'scout',arch:'twin',hp:180,dps:18,shot:.45,speed:2.8,range:43,role:'player'}),
 breacher:Object.freeze({name:'Parasite oxygen saboteur',cls:'vanguard',arch:'siege',hp:230,dps:24,shot:1.15,speed:2.1,range:40,role:'facility'}),
 sentinel:Object.freeze({name:'Parasite heavy sentinel',cls:'titan',arch:'siege',hp:1100,dps:72,shot:1.15,speed:1.8,range:54,role:'player'}),
 command:Object.freeze({name:'Parasite fire coordinator',cls:'titan',arch:'pulse',hp:330,dps:26,shot:.65,speed:2.0,range:48,role:'support'}),
 // Session 7B Citadel (js/conquest/citadel.js): the Swarm moves from the town drill engine into the field (the drill's swarmling at field
 // scale: about a third of an interceptor's hull, quicker, a short bite); the Spore Mortar, the dropship and the fortress's structures
 // never fire a gun (the Citadel module drives their shells, flights and gates). Fixed stats: the same in every tier
 swarm:Object.freeze({name:'Parasite swarmling',cls:'scout',arch:'twin',hp:56,dps:11,shot:.55,speed:3.6,range:8,role:'player'}),
 mortar:Object.freeze({name:'Spore Mortar',cls:'titan',arch:'siege',hp:600,dps:0,shot:9,speed:0,range:0,role:'support'}),
 dropship:Object.freeze({name:'Parasite dropship',cls:'titan',arch:'pulse',hp:700,dps:0,shot:9,speed:0,range:0,role:'support'}),
 structure:Object.freeze({name:'Parasite fortification',cls:'titan',arch:'siege',hp:900,dps:0,shot:9,speed:0,range:0,role:'support'}),
 bastion:Object.freeze({name:'Parasite rampart gun',cls:'titan',arch:'siege',hp:1000,dps:9,shot:1.4,speed:0,range:96,role:'player'})   // outranges a tank's 92 m: flank or break it
});
// Hull Plating set traits (rules.js plateStats; RESOURCE_ECONOMY.md §6.1). Energy: the fire coordinator's and the plasma
// batteries' pulse fire, plasma bombardment. Area: artillery/orbital strikes and plasma splash. Nothing else is cut.
const plateTaken=(st,energy,area)=>(energy?1-(st?.enR||0):1)*(area?1-(st?.arR||0):1);
const droneDefinition=Object.freeze({altitude:15,takeoffSeconds:1.2,speed:4.2,maxPerCarrier:2,tellSeconds:1.1,burstSeconds:2,cycleSeconds:6});
const installations=W.installations;
// Stable authored identities preserve production v1 locks and spawn keys as the region expands.
const spawnIds=Object.freeze({'redoubt-01:0':10001,'redoubt-01:1':10002,'staging-01:0':10003,'staging-01:1':10004,'patrol-01':10005,'patrol-02':10006,'redoubt-01:2':10007,'redoubt-01:3':10008,'west-depot:0':10009,'west-depot:1':10010,'crossroads:0':10011,'crossroads:1':10012,'refuge-scout':10013,'road-intercept':10014,'patrol-03':10015,'patrol-04':10016,'patrol-05':10017,'patrol-06':10018,'patrol-07':10019,'patrol-08':10020,'patrol-09':10021,'patrol-10':10022});
const legacyOperations=[
 {...mission,family:'defense',site:'oxygen-01',danger:'STANDARD',firstCp:250,brief:'Protect the oxygen processor through three assault waves.'},
 {id:'convoy',name:'INTERCEPT THE PARASITE CONVOY',family:'convoy',site:'convoy-lane',x:1090,z:944,danger:'STANDARD',firstCp:140,brief:'Intercept the moving armored carrier before it reaches the north exit. Escorts cover its escape.'},
 {id:'relay',name:'SABOTAGE THE RELAY',family:'sabotage',site:'west-depot',x:994,z:944,danger:'STANDARD',firstCp:130,brief:'Destroy the guarded relay, then remain at its terminal for eight seconds to disable the uplink.'},
 {id:'recon',name:'SIGNAL RECOVERY',family:'recon',site:'signal-ridge',x:950,z:1110,danger:'STANDARD',firstCp:100,brief:'Scan three marked physical sites. Each scan needs three seconds nearby; recover data while scouts hunt you.'},
 {id:'rescue',name:'BEACON EXTRACTION',family:'rescue',site:'rescue-site',x:1150,z:900,danger:'HARD',firstCp:150,brief:'Reach the stranded repair crawler and escort it to extraction. Stay close to keep it moving; defend its hull.'},
 // Session 6C (owner, Nov 18): the first wingman's rescue, right after the first plate (the coach chain's end): its own STANDARD
 // mission at the colony's south fields (open ground, clear sight lines from the drive in), 106 m from the Refuge terminal. It pays no airdrop points, CP, salvage or loot: its reward
 // is the pilot, who joins as your wingman (worker/src/conquest-battalion.js outcome). Not one of the six field missions.
 {id:'wingman-rescue',name:'RESCUE THE DOWNED PILOT',family:'wingman',wingman:true,site:'wingman-site',x:1100,z:1244,danger:'STANDARD',firstCp:0,brief:'A pilot is down at the colony\'s south fields and two interceptors are closing in. Clear them, then hold beside the wreck for 4 seconds to pull the pilot out: they fly with you as your wingman.'},
 {id:'redoubt',name:'BREAK THE REDOUBT',family:'siege',site:'redoubt-01',x:1240,z:920,danger:'VETERAN',firstCp:220,brief:'Breach the gate garrison, defeat the armored commander and occupy the command platform.'}
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
const raidOperations=raidFamilies.flatMap((f,fi)=>raidLayouts.map((l,i)=>({id:'raid-'+f.id+'-'+(i+1),raid:true,family:f.id,name:f.name+' / '+l.name.toUpperCase(),site:'raid-site-'+f.id+'-'+(i+1),sector:l.sector,layout:l.id,x:l.x+fi*3,z:l.z+fi*4,entry:raidPoint(l.entry[0]+fi*3,l.entry[1]+fi*4),route:l.route.map(([x,z])=>raidPoint(x+fi*3,z+fi*4)),drops:[raidPoint(l.x+fi*3-26,l.z+fi*4-30),raidPoint(l.x+fi*3+30,l.z+fi*4+18)],offsets:l.offsets,hazard:l.hazard,commander:f.commander,danger:i<2?'HARD':'VETERAN',brief:f.brief+' '+l.name+' uses '+l.hazard+' targeting across a distinct '+l.sector+' approach.',reward:{cp:180+i*20+fi*15,alloy:18+i*2,biomass:12+fi,helium:3+i}})));
const raidIds=Object.freeze(raidOperations.map(o=>o.id)),sectors=W.sectors;
// A sector defense opens during a real invasion alert. Sectors with no raid objective (the Refuge home sector) can also be
// retaken through the same physical defense after an invasion is lost, so no sector is ever permanently unrecoverable.
const retakeSectors=new Set(sectors.map(s=>s.id).filter(id=>!raidOperations.some(o=>o.sector===id)));
function sectorDefenseOpen(t,sector){return !!t&&(t.owner==='humanity'&&t.status==='defense-alert'||retakeSectors.has(sector)&&t.owner==='parasites'&&t.status==='recaptured');}
// Meteor Strike (docs/economy/RESOURCE_ECONOMY.md §5.4): every 2 hours on the even UTC hour, the same site for every pilot,
// rotating through 8 authored craters in every sector (the dangerous ones included). 5 min telegraph, open for 20 min.
// Each pilot contests it in their own world: two waves (interceptors, then a fixed HARD heavy group), then a 16 s core channel.
const strikeSites=freeze([['refuge','REFUGE CORRIDOR',1007,1181],['ash','ASH REDOUBT',1357,858],['oxygen','OXYGEN SPEAR',1268,1087],['western','WESTERN SALVAGE REACH',892,817],
 ['helium','HELIUM BASIN',1184,804],['ridge','REFUGE RIDGE',1366,1192],['south','RESERVOIR FLATS',895,1313],['east','EASTERN RIM',1398,1074]].map(([sector,name,x,z],i)=>freeze({id:'strike-'+(i+1),sector,name,x,z})));
function meteorStrike(now){const S=STRIKE,slot=Math.floor((now+S.telegraphMs)/S.everyMs),impactAt=slot*S.everyMs,closesAt=impactAt+S.windowMs,site=strikeSites[((slot%strikeSites.length)+strikeSites.length)%strikeSites.length];
 return {slot,impactAt,closesAt,site,phase:now<impactAt?'telegraph':now<closesAt?'open':'idle',nextAt:now<closesAt?impactAt:impactAt+S.everyMs};}
const strikeOperations=strikeSites.map(t=>({id:t.id,name:'METEOR STRIKE / '+t.name,family:'strike',strike:true,site:t.id,sector:t.sector,x:t.x,z:t.z,danger:'HARD',
 brief:'A meteor has hit '+t.name+'. Beat both Parasite waves converging on the crater, then hold at the strike core for 16 seconds to extract it. Rewards are carried: bring them home.'}));
// Session 7 Living Front (js/conquest/war.js): every war battle is a defense-shaped operation (defense:true, war: 'a' an assault you
// defend, 'c' an LDF counterattack you join). The six sector defenses fight the assaults on their ground; two Colony Defenses (the
// heartland battle type: three light waves on the settlement with the colony's turrets firing in support), the Dust Crossroads
// defense and six Joint Operations (the LDF lands a beachhead in a Parasite-held territory: hold it against three counter-waves with
// five LDF tanks beside your Platoon) are new. Authored by ring, never by the pilot's gear. A general who leads an assault joins its
// last wave (set by the Worker from the war event: Operation.general).
const WAR_DEF=Object.freeze({STANDARD:{cp:160,alloy:15,biomass:10,helium:2},HARD:{cp:200,alloy:20,biomass:12,helium:4},VETERAN:{cp:240,alloy:24,biomass:14,helium:6}});
const warOperations=[
 ...[['colony','REFUGE COLONY',1130,1235,'the colony\'s south fields'],['reservoir','RESERVOIR FLATS',870,1280,'the reservoir farms']].map(([t,name,x0,z0,where])=>{const [x,z]=raidPoint(x0,z0);return {id:'colony-defense-'+t,name:name+' / COLONY DEFENSE',family:'colony-defense',defense:true,colony:true,war:'a',territory:t,site:'war-'+t,x,z,danger:'STANDARD',waves:3,brief:'A Parasite raiding party is coming for '+where+'. Hold three light waves off the settlement beacon while the colony turrets fire in support. The heartland is never captured, but a raid let through spreads the blight.',reward:WAR_DEF.STANDARD};}),
 (()=>{const [x,z]=raidPoint(1085,985);return {id:'war-defense-crossroads',name:'DUST CROSSROADS / INVASION DEFENSE',family:'sector-defense',defense:true,war:'a',territory:'crossroads',site:'war-crossroads',x,z,danger:'HARD',brief:'Repel two incoming Parasite assault waves before they destroy the junction beacon. Lose it and the Parasites hold the road north of the colony.',reward:WAR_DEF.STANDARD};})(),
 ...[['western','WESTERN SALVAGE REACH',905,945,3],['helium','HELIUM BASIN',1065,858,3],['crossroads','DUST CROSSROADS',1080,990,3],['oxygen','OXYGEN SPEAR',1205,1040,4],['ridge','REFUGE RIDGE',1245,1160,4],['ash','ASH REDOUBT',1225,925,4]].map(([t,name,x0,z0,ring])=>{const [x,z]=raidPoint(x0,z0),danger=ring>=4?'VETERAN':'HARD';return {id:'counterattack-'+t,name:name+' / JOINT OPERATION',family:'counterattack',defense:true,war:'c',territory:t,site:'war-c-'+t,x,z,danger,waves:3,ldf:5,brief:'The LDF has landed a beachhead in '+name+'. Five LDF tanks fight beside your Platoon: hold the beacon against three Parasite counter-waves and the territory is retaken.',reward:WAR_DEF[danger]};})];
const operations=freeze(Object.fromEntries([...legacyOperations,...raidOperations,...strikeOperations,...sectors.map(sector=>{const [x,z]=raidPoint(sector.x,sector.z);return {id:'sector-defense-'+sector.id,name:sector.name+' / INVASION DEFENSE',family:'sector-defense',defense:true,war:'a',territory:sector.id,sector:sector.id,site:sector.id,x,z,danger:'HARD',brief:'Repel two incoming Parasite assault waves before they destroy the sector command beacon. A failed defense can recapture this frontier; your permanent first-clear history remains.',reward:{cp:160,alloy:15,biomass:10,helium:2}};}),...warOperations,{id:'base-defense',name:'COMMAND BASE / DEFENSE ALERT',family:'base-defense',site:'personal-base',x:1080,z:1160,danger:'HARD',brief:'Repel two incoming Parasite assault teams. Defend the Command Base reactor while using earned fortifications and your own weapons.',reward:{cp:160,alloy:15,biomass:10,helium:2}},
 // Session 7B: the Citadel's Act I tiers (the Outer Works, in the Inner Ring east of the Eastern Rim); their rules, layout and payouts are
 // js/conquest/citadel.js and worker/src/conquest-citadel.js (battle points by the war formula, never this table's spoils)
 {id:'hive-titan',name:'THE HIVE TITAN',family:'titan',titan:true,hidden:true,site:'titan',x:strikeSites[0].x,z:strikeSites[0].z,activationRadius:160,danger:'HARD',brief:'The Hive Titan rose at the strike crater: 9,000 hull, three phases, 4 minutes before it burrows away.'},   // Session 7C: the Hive Titan (js/conquest/titan.js; worker/src/conquest-titan.js)
 ...[1,2,3].map(t=>({id:'citadel-'+t,name:'THE CITADEL · '+['','I','II','III'][t]+' · '+['','BREACH POINT','IRON RAIN','THE CARRIER DECK'][t],family:'citadel',citadel:t,battalion:true,site:'citadel',x:1590,z:1080,activationRadius:140,danger:'HARD',brief:'',reward:{cp:0,alloy:0,biomass:0,helium:0}}))].map(o=>[o.id,{activationRadius:45,...o}])));
// Explicit finite schema, shared previews and server debits; all costs use Conquest-only balances.
// The Refuge supply terminal: physical banking/repair point (same coordinates as the Worker POLICY.terminal).
const refuge=freeze({id:'refuge',x:1174,z:1168,radius:12,name:'REFUGE SUPPLY'});
const baseDefinition=freeze({x:1080,z:1160,radius:30,recipe:{cp:600,alloy:30,biomass:15,helium:2},   // = ConquestPlot.CC.claim (Session 6, Decision 1)
 
 tiers:[{cp:2550,alloy:110,biomass:65,helium:8},{cp:4500,alloy:160,biomass:95,helium:12},{cp:4200,alloy:250,biomass:150,helium:20},{cp:6500,alloy:380,biomass:240,helium:32},{cp:10000,alloy:550,biomass:350,helium:50}],
 modules:{reactor:'Claimable CP production',hangar:'Field repair station',defense:'Protective field at your base',vault:'Protected banking at your base',radar:'Regional signal intelligence',uplink:'Operations production capacity'},
 moduleCosts:[{cp:180,alloy:12,biomass:8,helium:1},{cp:400,alloy:25,biomass:16,helium:3},{cp:850,alloy:50,biomass:30,helium:6}],buildSeconds:[60,180,360],maxTier:5});
function baseBenefits(tier=0,modules={}){const defense=modules.defense||0,radar=modules.radar||0;return {radius:Math.max(18+6*defense,tier>=5?30:tier>=4?24:0),mitigation:Math.min(.5,defense*.1+(tier>=4?.1:0)+(tier>=5?.05:0)),radar:Math.max(radar,tier>=5?1:0),radarRange:120+100*Math.max(radar,tier>=5?1:0)+(tier>=5?100:0)};}
// road-intercept patrols the south road just outside the home perimeter, where the Helium, Ash and Crossroads routes leave
// home (it previously doubled up on the Crossroads garrison camp). It stays >=150 m from the base and Refuge terminal.
const patrols=Object.freeze([{id:'refuge-scout',kind:'raider',x:956,z:1100,route:[[956,1100],[978,1090],[994,1105],[970,1120]]},{id:'road-intercept',kind:'raider',x:1078,z:1008,route:[[1078,1008],[1100,1004],[1104,990],[1082,992]]},{id:'patrol-01',kind:'raider',x:1260,z:970,route:[[1260,970],[1290,970],[1280,1000],[1255,995]]},{id:'patrol-02',kind:'sentinel',x:1300,z:1150,route:[[1300,1150],[1270,1140],[1260,1110],[1290,1120]]},
 // Session 6 living world (spec §5.6): 4 -> 12 routes, two per sector, authored and drivable (searched loops), every waypoint >=150 m
 // from the Refuge terminal, the spawn, the Command Gate and the first mission, >=30 m from installations, operations and other routes.
 // solo: the new routes (like every hunter) never join an operation as residents, so no raid, field mission, strike or defense
 // changes difficulty (blueprint §5); they wait outside the operation exactly where they were.
 {id:'patrol-03',solo:true,kind:'breacher',x:1315,z:1068,route:[[1315,1068],[1299,1068],[1299,1052],[1315,1052]]},{id:'patrol-04',solo:true,kind:'raider',x:1353,z:1153,route:[[1353,1153],[1337,1153],[1337,1137],[1353,1137]]},
 {id:'patrol-05',solo:true,kind:'sentinel',x:1216,z:875,route:[[1216,875],[1200,881],[1194,865],[1210,859]]},{id:'patrol-06',solo:true,kind:'command',x:1317,z:890,route:[[1317,890],[1305,902],[1293,890],[1305,878]]},
 {id:'patrol-07',solo:true,kind:'raider',x:882,z:975,route:[[882,975],[870,987],[858,975],[870,963]]},{id:'patrol-08',solo:true,kind:'breacher',x:972,z:865,route:[[972,865],[960,877],[948,865],[960,853]]},
 {id:'patrol-09',solo:true,kind:'command',x:1042,z:812,route:[[1042,812],[1018,822],[1008,798],[1032,788]]},{id:'patrol-10',solo:true,kind:'raider',x:1143,z:808,route:[[1143,808],[1127,808],[1127,792],[1143,792]]}]);
// HOLD THE OXYGEN LINE, re-staged for the first hour (Session 6; authored, never matched to the pilot's gear). Wave 1: two
// interceptors strafing the towers 35-40 m in front of the spawn (role 'facility': they shoot the tower, not you; the first kill
// inside seconds). Wave 2: the heavy sentinel that
// broke through the colony's north gate comes down the main street, 90 m away and in sight the whole way (the first enemy that
// hurts). Wave 3: a raider, a saboteur and a coordinator flank the processor from the north-west. Tuned with scripted pilots:
// one that follows the arrow, one that never moves and one that rushes in all win on stock gear (dev/tests/conquest-first-hour.mjs).
const formations=Object.freeze([
 Object.freeze([['raider',1172,1098,'facility'],['raider',1184,1104,'facility']]),
 Object.freeze([['sentinel',1064,1128]]),
 Object.freeze([['raider',1124,1098],['breacher',1118,1104],['command',1112,1110]])
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
// Session 6 living world (spec §5.6): one authored hunter (hunter packs, incursions, vein ambushes). Archetype stats only, never the
// pilot's gear. hunt = {r: aggro m, leash: m from home, heart: may chase into the Heartland}; ids are the Worker's fixed ranges.
function hunter(kind,key,id,x,z,hunt,route=null){const a=archetypes[kind];return {id,key,base:{kind:'hunter',id:key},route,home:{x,z,y:W.groundAt(x,z)+2.2},kind,cls:a.cls,arch:a.arch,x,z,y:W.groundAt(x,z),surface:'ground',hp:a.hp,maxHp:a.hp,heading:0,turret:0,stats:enemyStats(a),decision:(id%10)*.03,cd:2,vx:0,vz:0,role:'guard',hunt};}
// Hunter pack anchors in the order they open (1 + floor(held sectors / 2), spec §5.6): rings 3-4. Two loops sit 21-27 m from a
// field mission, so packs never start a hunt within 150 m of a field-mission marker (nearFieldMission, Battle.choose).
let FIELD_MARKS=null;
function nearFieldMission(p){FIELD_MARKS=FIELD_MARKS||fieldMissionIds.map(id=>[operations[id].x,operations[id].z]);for(const [x,z] of FIELD_MARKS)if(Math.hypot(p.x-x,p.z-z)<150)return true;return false;}
const LIVING=Object.freeze({packs:Object.freeze([{x:1270,z:946,route:[[1294,946],[1270,970],[1246,946],[1270,922]]},{x:850,z:870,route:[[866,886],[834,886],[834,854],[866,854]]},{x:1320,z:1175,route:[[1334,1189],[1306,1189],[1306,1161],[1334,1161]]},{x:1170,z:863,route:[[1186,879],[1154,879],[1154,847],[1186,847]]}].map(Object.freeze)),   // searched drivable loops: Ash north, Western, Ridge east, Helium-Ash saddle
 pack:Object.freeze(['raider','raider','command']),hardExtra:'sentinel',aggro:200,leash:300,regenMs:3600000,
 ambush:Object.freeze({chance:.35,afterMs:20000,ring:3,stay:40,kinds:Object.freeze(['sentinel','sentinel']),from:65}),
 incursion:Object.freeze({calmMs:600000,kinds:Object.freeze(['raider','raider','raider']),from:120,refuge:60,fightR:70}),
 ids:Object.freeze({pack:10100,ambush:10200,incursion:10210}),chain:Object.freeze({windowMs:600000,per:0,item:.10,max:3})});   // Sortie chain (owner, Nov 16): no CP and no salvage (per 0); a win with k earlier links has a k x 10% chance (10/20/30%) of one bonus consumable, rolled on the Worker from the loot seed (worker/src/conquest-living.js chainItem)
// ---- Session 6C: the friendly side (blueprint §4; owner prompt Nov 18). Your pilots (side 'mine') and LDF regulars (side 'ldf',
// outside your command) fight with the Parasites' projectiles, damage and steering, the side flipped. Every unit carries a
// controller: 'ai' today, a human pilot later (the co-op foundation). Its stats are tankOf() of its own kit (friendStats: no
// second rule set, no plating, engineering or mods, no cores); its role signature is ROLES x m, where m (rank and Role Core level)
// is set by the Worker when it deploys the unit, so nothing here reads progression, gear rating or purchases. Deterministic: the
// battle's seeded random() for crits only, so the phone's prediction and the Worker's replay agree.
// Caps in any fight (blueprint §12): 10 friendly units, 20 active hostiles, 6 drones, 160 projectiles; the Parasites keep their
// own 96 (today's cap), so allies never change how often a Parasite may fire.
const CAPS=Object.freeze({friends:10,hostile:20,drones:6,projectiles:160,enemyProjectiles:96,friendProjectiles:48});
// Allies are deliberately less sharp than a pilot (the pilot stays decisive: about 40% of the damage in a full assault, 100% of
// objectives): they decide every ALLY.decide s, aim at where their target was at that decision (the aim lag), wait ALLY.react s
// on a new target before the first shot and turn their turret at ALLY.turn of the tank's rate. Tuned by the damage-split
// measurement (dev/tests/conquest-allies.mjs), never through Parasite stats.
const ALLY=Object.freeze({decide:.6,react:2.9,reactLock:.5,turn:.5,align:.1,leash:42,regroup:95,pilotBias:12,superSpacing:20,superGap:3,downHull:.5,returnS:15,quietR:60,fireLane:2.2});
// Session 6C section 9 (owner, Nov 18): allies in a MILITIA kit (no spare gear: Common, no cores; kit.mil, js/conquest/battalion.js)
// are green crews, tuned on their own so a militia Platoon never lets a stock pilot skip VETERAN (dev/tests/conquest-allies.mjs
// section 10). Their aim and reaction only (decide / react / reactLock / turn), plus pilotBias: how much less a Parasite wants a
// green crew than the pilot (lead's creative-director decision, Nov 19: the measured cause was the crews SOAKING the fire that
// would kill the pilot, not only their damage). In a VETERAN-danger operation they freeze up (MILITIA_VET); in every other fight
// they stay useful. Allies armed from your real spare gear keep ALLY's numbers everywhere. Never an enemy stat.
// Measured (dev/tests/conquest-allies.mjs section 10, docs/conquest/session6c/veteran-rule.json): with ALLY's numbers a stock pilot and
// a militia Platoon cleared 11 of the 15 VETERAN raids (alone 0; the current harness); these clear at most 3, an Epic-armed Platoon still 13.
const MILITIA=Object.freeze({decide:.6,react:2.9,reactLock:.5,turn:.5,pilotBias:0});   /* normal fights: ALLY's numbers (review 2: a greener table cost the first wingman and bought nothing for rule (a)) */
const MILITIA_VET=Object.freeze({decide:2.4,react:9,reactLock:3.5,turn:.2,pilotBias:45});
const tune=(B,f)=>f&&f.mil?(B&&B.operation&&B.operation.danger==='VETERAN'?MILITIA_VET:MILITIA):ALLY;
// The six roles (blueprint §4 table; starting values for the simulations). Every number is the base at m = 1.
const ROLES=Object.freeze({
 '':Object.freeze({n:'WINGMAN',keep:.72,range:1}),
 guardian:Object.freeze({n:'GUARDIAN',cls:['titan'],keep:.55,range:1,cover:.20,coverR:12,taunt:45,pull:20,hold:3}),   /* hold: a Guardian draws the fire of at most 3 Parasites at once (review 2: stacked taunts made four Guardians beat a balanced force) */
 breacher:Object.freeze({n:'BREACHER',cls:['vanguard'],keep:.45,range:1,structure:.40,frozen:.50,frozenR:15,charge:9,chargeT:.4,chargeMin:12,chargeMax:35}),
 lancer:Object.freeze({n:'LANCER',cls:['titan','vanguard'],keep:.85,range:1.4,close:.6,closeR:20,air:.50,burst:.30}),
 mender:Object.freeze({n:'MENDER',cls:['scout','vanguard'],keep:.8,range:1,heal:.012,healR:18,revive:.35,reviveR:30,reviveS:2.5,low:.35}),
 corroder:Object.freeze({n:'CORRODER',cls:['vanguard'],keep:.7,range:1,shred:.05,stacks:4,shredS:5}),
 frostline:Object.freeze({n:'FROSTLINE',cls:['scout'],keep:.75,range:1,every:8,fieldR:7,fieldS:4,slow:.5,freezeAfter:1,freeze:1.5})});
const ROLE_ORDER=Object.freeze(['guardian','breacher','lancer','mender','corroder','frostline']);
// Formation slots [right, forward] in metres from the pilot, along the squad's smoothed heading (chosen before the fight).
const FORMS=Object.freeze({line:Object.freeze([[-7,-3],[7,-3],[-14,-3],[14,-3],[-21,-3],[21,-3],[-28,-3],[28,-3],[0,-10],[0,-17]]),
 wedge:Object.freeze([[-6,-7],[6,-7],[-12,-14],[12,-14],[-18,-21],[18,-21],[-24,-28],[24,-28],[0,-14],[0,-24]]),
 escort:Object.freeze([[0,9],[-9,0],[9,0],[0,-9],[-7,7],[7,7],[-7,-7],[7,-7],[0,-15],[0,15]])});
const ORDERS=Object.freeze(['','follow','attack','hold','fallback','smart']);const ORDER_GAP=1;   // s between two orders that count
const FST=new WeakMap(),GHOST=Object.freeze({kit:null});   // a unit's stats, derived from its kit on each side (never saved with the battle)
// The loadout a friendly unit fights with: its kit's weapon and chassis (tier and roll), nothing else (militia: Common, no cores)
function allyLoadout(kit){const w=kit&&kit.w||{},c=kit&&kit.c||{},wa=w.a==='moon'||WORDER.includes(w.a)?w.a:'pulse',cc=CHORDER.includes(c.c)?c.c:'vanguard',q=v=>Number(v)>0&&Number(v)<2?Number(v):1;
 return {w:{a:wa,t:wa==='moon'?2:clamp(w.t|0,0,2),q:q(w.q),s:false},c:{c:cc,t:clamp(c.t|0,0,2),q:q(c.q),s:false},up:{hull:0,cannon:0,engine:0,target:0,reactor:0},cores:[],gl:{},skin:'default',paint:'stock'};}
function friendStats(f){let t=FST.get(f);if(t)return t;const L=allyLoadout(f.kit);t={...tankOf(L,1),buffs:[]};t.wshot=(profiles[t.wtype]||profiles.pulse).interval;t.speed=machineSpeed(L,t);t.eng=engineeringValues(t,engineeringDefaults());FST.set(f,t);return t;}
// A friendly unit at full (or half) hull. o: {id, side, pid, role, kit, m, x, z, hull, name}
function friendUnit(o){const f={id:o.id,side:o.side==='ldf'?'ldf':'mine',ctl:'ai',pid:o.pid??null,role:ROLES[o.role]&&o.role?o.role:'',kit:{w:{...(o.kit?.w||{a:'pulse',t:0,q:1})},c:{...(o.kit?.c||{c:'vanguard',t:0,q:1})}},m:Math.max(1,Math.min(2,Number(o.m)||1)),
 x:o.x,z:o.z,y:W.groundAt(o.x,o.z),surface:'ground',heading:o.heading||0,turret:o.heading||0,vx:0,vz:0,cd:.6,heat:0,oh:0,dec:(o.id%10)*.045,react:0,tgt:0,charge:0,sup:-99,kills:0,down:0,hurt:0,rv:0,ch:0,fz:0,n:0};if(o.kit?.mil)f.mil=1;   /* a militia crew (MILITIA) */
 if(o.name)f.name=String(o.name).slice(0,24);const t=friendStats(f);f.maxHp=t.mhp;f.hp=Math.max(1,Math.round(t.mhp*(o.hull===.5?ALLY.downHull:1)));if(o.post)f.post={x:o.post.x,z:o.post.z};return f;}
class Battle {
 constructor(loadout,playerPosition){
 this.snapshot=freeze(JSON.parse(JSON.stringify(loadout)));this.playerStats={...tankOf(this.snapshot,1),buffs:[]};this.playerStats.wshot=(profiles[this.playerStats.wtype]||profiles.pulse).interval;this.engineering=engineeringDefaults();this.heat=0;this.overheated=false;this.combatSpeed=machineSpeed(this.snapshot,this.playerStats);
 this.charge=0;this.shieldT=0;this.shieldCd=0;this.dashCd=0;this.turretYaw=0;this.modQ=[];this.playerMax=this.playerStats.mhp;this.playerHp=this.playerMax;this.objectiveMax=1800;this.objectiveHp=this.objectiveMax;
 this.objective={x:1150,y:W.groundAt(1150,1080)+10,z:1080};this.state='active';this.enemies=[];this.projectiles=[];this.effects=[];this.wave=0;this.waveCount=formations.length;this.kills=0;this.shots=0;this.time=0;this.cooldown=0;this.nextWave=0;this.id=0;this.seed=0x03012026;this.aim={x:playerPosition.x,y:playerPosition.y+2,z:playerPosition.z+50};this.player=center(playerPosition);this.approachGrace=Math.hypot(playerPosition.x-mission.x,playerPosition.z-mission.z)>65?60:0;this.friends=[];this.fields=[];this.squad={o:'follow',t:0,x:0,z:0,at:0,f:'wedge',orders:0};this.spawnWave();
 }
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 spawnWave(){if(this.wave>=formations.length)return;for(const [slot,[kind,x,z,role]] of formations[this.wave].entries()){const a=archetypes[kind];this.enemies.push({id:++this.id,rewardKey:'wave:'+(this.wave+1)+':'+slot,kind,cls:a.cls,arch:a.arch,x,z,y:W.groundAt(x,z),surface:'ground',hp:a.hp,maxHp:a.hp,heading:Math.PI,turret:Math.PI,stats:enemyStats(a),decision:(this.id%10)*.03,cd:1.5+this.enemies.length*.18,vx:0,vz:0,role:role||a.role});}this.wave++;this.nextWave=0;}
 shoot(from,to,stats,team,kind,owner){
 if(!this.shotRoom(team))return false;if(team==='enemy'&&this.enemies.some(e=>e.id===owner&&e.resident&&(e.target===e.home||e.target===e.navGoal)))return false;let d=dist(from,to);if(d<.01)return false;const ally=team==='ally',values=ally?stats.eng:engineeringValues(stats,this.engineering),speed=team==='player'||ally?values.velocity:stats.wpspd;
 if(kind==='twin'){const side=(ally?this.friendById(owner)?.n||0:this.shots)%2?1:-1,ax=(to.z-from.z)/d*.55*side,az=-(to.x-from.x)/d*.55*side;from={x:from.x+ax,y:from.y,z:from.z+az};}
 d=dist(from,to);const q={id:++this.id,x:from.x,y:from.y,z:from.z,vx:(to.x-from.x)/d*speed,vy:(to.y-from.y)/d*speed,vz:(to.z-from.z)/d*speed,life:(team==='player'?values.range:ally?values.range*(ROLES[this.friendById(owner)?.role||'']?.range||1):82)/speed,team,kind,owner};if(team==='enemy')q.stats=stats;this.projectiles.push(q);   // the pilot's and allies' shots name their owner (shotStats): their stats are never saved with the battle
 if(ally){const f=this.friendById(owner);if(f)f.n++;}else{this.shots++;if(team==='player')this.playerShots=(this.playerShots||0)+1;}return true;
 }
 choose(e){
 const a=archetypes[e.kind],ec=center(e),pd=dist(ec,this.player);
 // Session 6C: a Parasite that hunts the pilot picks among the pilot and the friendly units (threat: position and role only)
 const role=e.role||a.role,T=this.friends.length&&!e.guardReturning&&(role==='player'||role==='support')?this.threat(e,pd):null,p=T?T.t:this.player,tdist=T?T.d:pd;e.tf=T&&T.f?T.f.id:0;
 e.target=e.guardReturning?(e.navGoal||e.home):role==='player'&&tdist<90||role==='support'&&tdist<38?p:this.objective;
 this.steer(e,e.target,e.guardReturning?0:a.range*.72,a.speed,this.enemies,ec);
 }
 // Shared steering (the Parasites and, side flipped, the friendly units): the best of twelve headings by distance to the wanted
 // range, the turn it costs, crowding and a clear line of fire from where it would be. ec: the unit's centre when already known.
 steer(e,target,desired,speed,crowd,ec,cover=true){
 const dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz),visible=lineClear(ec||center(e),target,target===this.objective);
 e.vx=e.vz=0;if(visible&&d<desired+4&&d>desired-10)return visible;
 const heading=Math.atan2(dx,dz)+(visible&&d<desired-10?Math.PI:0);let best=-Infinity;
 for(const off of [0,.45,-.45,.9,-.9,1.35,-1.35,1.8,-1.8,2.4,-2.4,Math.PI]){
 const angle=heading+off,vx=Math.sin(angle),vz=Math.cos(angle),q=W.advance(e,vx*4,vz*4),travel=Math.hypot(q.x-e.x,q.z-e.z);if(travel<2.5)continue;
 let score=-Math.abs(Math.hypot(target.x-q.x,target.z-q.z)-desired)-Math.abs(off)*.5;
 for(const other of crowd)if(other!==e&&other.hp>0)score-=Math.max(0,8-Math.hypot(other.x-q.x,other.z-q.z))*4;
 if(cover&&lineClear(center(q),target,target===this.objective))score+=6;
 if(score>best){best=score;e.vx=vx*speed;e.vz=vz*speed;}
 }
 return visible;
 }
 hit(q,t,r){const ally=q.team==='ally',ours=q.team==='player'||ally,fr=!ours&&t.side!==undefined,targetCenter=ours||fr?center(t):t,d=dist(q,targetCenter);if(d>r)return false;
 const speed2=q.vx*q.vx+q.vy*q.vy+q.vz*q.vz,rx=targetCenter.x-q.x,ry=targetCenter.y-q.y,rz=targetCenter.z-q.z,along=(rx*q.vx+ry*q.vy+rz*q.vz)/Math.sqrt(speed2),off=Math.sqrt(Math.max(0,rx*rx+ry*ry+rz*rz-along*along));
 const owner=this.shotStats(q),direct=off<r*.4,mine=q.team==='player'&&owner.rm,sure=mine?mfHit(owner,this.modState(),t.id,direct):false;   // Marksman Coil (Session 6B): every 3rd direct hit in a row is a sure critical
 // Session 6C: an ally's shot (q.owner = its unit); the Lancer's combo: a shredded target takes its shot as a full hit
 const shooter=ally?this.friendById(q.owner):null,R=shooter?ROLES[shooter.role]||ROLES['']:null,sh=ours&&t.sh&&t.sh.t>this.time?t.sh:null,full=direct||R===ROLES.lancer&&!!sh&&off<r*.8;
 const isCrit=full&&(sure||this.random()<CRIT_BASE+gsum(owner,'lck')+(owner.critB||0)),edge=full?(isCrit?CRIT_MULT:1):owner.wedge||GRAZE;
 const defender=ours?t.stats:t===this.player?this.playerStats:fr?friendStats(t):null;
 const rawD=owner.wdps*owner.wshot*dmgMult(owner)*projectileImpactMult(owner)*(q.railM||1)*edge+(q.mv||0)*(direct?1:owner.wedge||GRAZE);let damage=rawD*(defender?cmult(owner,defender)*(1-armor(defender)):1);   // q.mv: a vent round's extra seconds of damage
 if(sh)damage*=1+sh.k*sh.n;   // Corroder shred: the target takes more damage from everyone on your side
 if(ours&&t.core>0){if(ally)damage=0;else{const c=Math.min(t.core,damage);t.core-=c;damage-=c;}}   // a general's shield core: only the pilot breaks it (owner rule); allies cannot touch the unit while it holds
 if(shooter&&R){const m=shooter.m,ds=Math.hypot(t.x-shooter.x,t.z-shooter.z);   // role signatures (blueprint §4), x m (rank, Role Core level)
  if(R===ROLES.lancer){if(ds<R.closeR)damage*=R.close;if(t.drone||t.ship)damage*=1+R.air*m;if(sh)damage*=1+R.burst*m;}
  else if(R===ROLES.breacher){if(t.immobile||t.objectiveTarget||t.id===this.carrierId)damage*=1+R.structure*m;if(t.fz>0&&ds<R.frozenR)damage*=1+R.frozen*m;}}
 let blocked=0;if(q.team==='enemy'&&t===this.player){if(this.shieldT>0){blocked=damage*(1-SHIELD_MULT);damage*=SHIELD_MULT;}damage*=plateTaken(this.playerStats,q.kind==='pulse',false);const base=baseBenefits(this.baseTier,this.baseModules);if(Math.hypot(this.player.x-baseDefinition.x,this.player.z-baseDefinition.z)<base.radius)damage*=1-base.mitigation;}
 if(q.team==='enemy'&&(t===this.player||fr)&&this.friends.length){const c=this.coverOf(t,q);if(c)damage*=1-c;}   // a Guardian between the shooter and you (or an ally) takes the edge off
 if(ours&&t.pattern==='shield'&&this.time%8<3){const keep=Math.max(q.rail?1:0,mfPierce(owner),R===ROLES.breacher?.5:0);damage*=.35+keep*.65;if(keep>0&&!q.rail&&mine)mfCue(this.modState(),'pierce');}   // Penetrator Coil and rail slugs get through the shield commander's barrier (a Breacher half of it)
 if(q.team==='player'){this.alert(t);t.pd=1;this.pilotDmg=(this.pilotDmg||0)+Math.min(t.hp,damage);if(t.titan)t.tp=(t.tp||0)+Math.min(t.hp,damage);   /* Session 7C: the pilot's own damage to the Hive Titan (js/conquest/titan.js) */this.charge=Math.min(SUPER_MAX,this.charge+(Math.min(t.hp,damage)*FILL_DEALT+(isCrit?FILL_CRIT:0))*(this.playerStats.fillM||1));t.hp=Math.max(0,t.hp-damage);if(t.hp===0){this.kills++;this.effects.push({kind:'destroy',x:t.x,y:t.y+2,z:t.z,life:.7,at:this.time});}   // pd: the pilot's own tank dealt part of this unit's damage (points, CP and loot need it once an ally has touched it)
  if(q.burn&&t.hp>0)t.burns=mfBurn(t.burns,0,q.burn,this.modDps());   // Inferno Core: the hit sets its target burning
  if(q.mv){this.effects.push({kind:'destroy',k:'siege0',oc:0,x:q.x,y:q.y,z:q.z,r:5,life:.5,at:this.time});for(const e of this.enemies)if(e!==t&&e.hp>0&&dist(center(e),q)<5)this.modHurt(e,rawD*q.ms);}}   // the vent round bursts on the Parasites beside its target (modHurt adds each one's own counter and armor; the target's are not carried over, as in the Arcade)
 else if(ally){if(t.titan)damage*=root.ConquestTitan?.TITAN.allyMul??1;this.alert(t);t.ad=1;   /* Session 7C: the Hive Titan's hide takes a quarter of allied fire (a fixed stat: js/conquest/titan.js) */if(shooter)shooter.charge=Math.min(SUPER_MAX,shooter.charge+(Math.min(t.hp,damage)*FILL_DEALT+(isCrit?FILL_CRIT:0))*(owner.fillM||1));this.allyDmg=(this.allyDmg||0)+Math.min(t.hp,damage);t.hp=Math.max(0,t.hp-damage);   // the player's charge rule, on the ally's own meter
  if(t.hp===0)this.friendKill(t,shooter);else if(R===ROLES.corroder){const C=R,k=C.shred*shooter.m;t.sh=sh?{n:Math.min(C.stacks,sh.n+1),t:this.time+C.shredS,k:Math.max(sh.k,k)}:{n:1,t:this.time+C.shredS,k};}}
 else if(t===this.player){this.hitBy=q.owner;if(this.playerStats.rm){const M=mfTaken(this.playerStats,this.modState(),damage,0,blocked,this.playerMax);damage=M.amt;if(M.ring)this.modQ.push({k:'ring',n:M.ring});if(M.refl>0)this.modQ.push({k:'refl',e:q.owner,d:M.refl});}   // Momentum, the overshield; heat rings and reflections land after this hit
  this.charge=Math.min(SUPER_MAX,this.charge+Math.min(this.playerHp,damage)*FILL_TAKEN*(this.playerStats.fillM||1)*(this.playerStats.hitChg||1));this.playerHp=Math.max(0,this.playerHp-damage);}
 else if(fr){t.charge=Math.min(SUPER_MAX,t.charge+Math.min(t.hp,damage)*FILL_TAKEN*(defender.fillM||1)*(defender.hitChg||1));t.hp=Math.max(0,t.hp-damage);if(t.hp<=0)this.friendDown(t);}
 else if(this.time>=this.approachGrace)this.objectiveHp=Math.max(0,this.objectiveHp-damage*(this.defenseConfig==='shield'?.6:1));
 const fx={kind:'impact',x:q.x,y:q.y,z:q.z,life:q.kind==='siege'?.3:.15,weapon:q.kind};if(ally)fx.a=1;this.effects.push(fx);
 // Heavy shells retain their shared direct damage; fragments affect only nearby distinct targets.
 if(q.kind==='siege'&&ours)for(const e of this.enemies)if(e!==t&&e.hp>0&&dist(center(e),q)<5&&lineClear(q,center(e))){let d=damage*.3;if(ally&&e.titan)d*=root.ConquestTitan?.TITAN.allyMul??1;   /* Session 7C review: the Titan's hide takes a quarter of allied splash too */if(e.core>0){if(ally)continue;const c=Math.min(e.core,d);e.core-=c;d-=c;}   /* Session 7B review: a shield core takes splash too (only the pilot breaks it) */const dealt=Math.min(e.hp,d);if(ally){e.ad=1;if(shooter)shooter.charge=Math.min(SUPER_MAX,shooter.charge+dealt*FILL_DEALT*(owner.fillM||1));this.allyDmg=(this.allyDmg||0)+dealt;e.hp=Math.max(0,e.hp-d);if(e.hp===0)this.friendKill(e,shooter);continue;}
  e.pd=1;this.pilotDmg=(this.pilotDmg||0)+dealt;if(e.titan)e.tp=(e.tp||0)+dealt;this.charge=Math.min(SUPER_MAX,this.charge+dealt*FILL_DEALT*(this.playerStats.fillM||1));e.hp=Math.max(0,e.hp-d);if(e.hp===0){this.kills++;this.effects.push({kind:'destroy',x:e.x,y:e.y+2,z:e.z,life:.7,at:this.time});}}
 return true;
 }
 alert(e){if(!e.key||e.radioCalled)return;e.radioCalled=true;for(const ally of this.enemies)if(ally!==e&&ally.hp>0&&Math.hypot(ally.x-e.x,ally.z-e.z)<80)ally.radioUntil=this.time+12;this.effects.push({kind:'radio',x:e.x,y:e.y+5,z:e.z,life:.5});}
 moveShots(dt){
 for(const q of this.projectiles){const start={x:q.x,y:q.y,z:q.z};const travel=Math.min(dt,q.life),n=Math.max(1,Math.ceil(Math.hypot(q.vx,q.vy,q.vz)*travel/.35));for(let i=0;i<n&&q.life>0;i++){
 q.x+=q.vx*travel/n;q.y+=q.vy*travel/n;q.z+=q.vz*travel/n;
 if(q.x<0||q.z<0||q.x>W.WIDTH||q.z>W.LENGTH||q.y<=W.groundAt(q.x,q.z)){q.life=0;break;}
 let hit=false;if(q.team==='player'||q.team==='ally'){for(const e of this.enemies)if(e.hp>0&&!(q.hit&&q.hit.includes(e.id))&&this.hit(q,e,2.7)){hit=true;q.landed=1;if(q.rail){q.hit.push(e.id);if(q.hit.length<q.rail)hit=false;}break;}}else hit=this.hit(q,this.player,2.5)||this.friends.length>0&&this.friendHit(q)||(this.objectiveDamageable!==false&&this.hit(q,this.objective,14));   // a rail slug passes through the first Parasite into the next
 if(hit||blocked(q.x,q.y,q.z)){q.life=0;break;}}
 
 q.life-=dt;if(q.life<=0&&q.team==='player'&&!q.landed&&this.playerStats.rm&&this.playerStats.rm.marksman)mfMiss(this.playerStats,this.modState());}   // a shot that hit nothing restarts Marksman Coil's count
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
 const mf=this.playerStats.rm?this.modState():null,iv=this.playerStats.wshot/(rofMult(this.playerStats)*mfRate(this.playerStats,mf));   // Overclock Breech changes the interval
 if(mf){const mo=mfShot(this.playerStats,mf,iv),q=this.projectiles[this.projectiles.length-1];if(mo&&q){if(mo.vent){q.mv=mo.vent*this.modDps();q.ms=mo.splash;}if(mo.rail){const k=mo.rail.spd;q.vx*=k;q.vy*=k;q.vz*=k;q.life/=k;q.rail=mo.rail.through;q.hit=[];q.railM=mo.rail.mult;}if(mo.burn)q.burn=mo.burn;}}   // research mods: a vent round, a rail slug, an Inferno burn
 this.effects.push({kind:'muzzle',x:this.player.x,y:this.player.y,z:this.player.z,weapon:this.playerStats.wtype,life:.1});this.cooldown+=iv;this.heat=Math.min(thermal.capacity,this.heat+thermal.heatPerShot);if(this.heat>=thermal.capacity)this.overheated=true;
 }}else if(!fire||this.overheated)this.cooldown=Math.max(0,this.cooldown);
 if(this.playerStats.rm||this.enemies.some(e=>e.burns&&e.burns.length))this.modTick(dt);
 if(this.playerStats.gems.includes('reg'))this.playerHp=Math.min(this.playerMax,this.playerHp+this.playerMax*gsum(this.playerStats,'reg')*dt);
 const act=this.enemies.length>CAPS.hostile?this.activeHostiles():null;   // Session 6C: at most 20 Parasites run at once (the nearest)
 for(const e of this.enemies){if(e.hp<=0||e.dormant||e.resident&&Math.hypot(e.x-this.player.x,e.z-this.player.z)>240)continue;if(act&&!act.has(e.id))continue;if(e.fz>0){e.fz-=dt;continue;}   // frozen by a Frostline field: no move, no shot
 e.decision-=dt;e.cd-=dt;if(e.decision<=0){if(this.lure(e));else if(e.resident)Encounter.prototype.choose.call(this,e);else this.choose(e);e.decision=.3;}
 const k=this.fields.length?this.slowAt(e):1,p=this.enemyAdvance?this.enemyAdvance(e,dt*k):W.advance(e,e.vx*dt*k,e.vz*dt*k);if(p!==e){e.x=p.x;e.y=p.y;e.z=p.z;e.surface=p.surface;if(e.vx||e.vz)e.heading=Math.atan2(e.vx,e.vz);}
 const target=e.target||this.objective,ec=center(e),want=Math.atan2(target.x-e.x,target.z-e.z),delta=Math.atan2(Math.sin(want-e.turret),Math.cos(want-e.turret));e.turret+=clamp(delta,-2*dt,2*dt);
 if(e.cd<=0&&Math.abs(delta)<.15&&dist(ec,target)<archetypes[e.kind].range&&lineClear(ec,target,target===this.objective)){this.shoot(ec,target,e.stats,'enemy',e.arch,e.id);e.cd=e.stats.wshot;}
 }
 if(this.friends.length)this.friendStep(dt);if(this.fields.length)this.fieldStep(dt);
 this.moveShots(dt);
 if(this.playerHp<=0||this.objectiveHp<=0){this.state='defeat';this.reason=this.playerHp<=0?'War Machine disabled':this.operation?.defense?'Sector command beacon destroyed':'Oxygen infrastructure destroyed';this.projectiles=[];return;}
 if(!this.localEncounter&&!this.enemies.some(e=>!e.resident&&e.hp>0)){if(this.wave===formations.length){this.state='victory';this.projectiles=[];}else{this.nextWave+=dt;if(this.nextWave>=3)this.spawnWave();}}
 if(!this.localEncounter&&Math.hypot(this.player.x-mission.x,this.player.z-mission.z)>240){this.state='defeat';this.reason='Retreated beyond the defense perimeter';this.projectiles=[];}
 }
 // ---- Science Lab research mods (Session 6B): the behaviors are rules.js mf* (one engine with the Arcade); this applies them to
 // the pilot's tank and the Parasites. Deterministic (the battle clock, no randomness), so the phone's prediction and the Worker's
 // replay agree; the state (this.mf) and the burns on Parasites are saved with the battle.
 modState(){return this.mf||(this.mf=mfNew(this.playerStats));}
 modDps(){const t=this.playerStats;return Math.max(1,t.wdps*dmgMult(t)*rofMult(t)*projectileImpactMult(t));}
 modHurt(e,amount,raw){if(!(amount>0)||!e||e.hp<=0)return 0;const t=this.playerStats,d=(raw?amount:amount*cmult(t,e.stats)*(1-armor(e.stats)))*(e.sh&&e.sh.t>this.time?1+e.sh.k*e.sh.n:1);this.alert(e);e.pd=1;let d2=d;if(e.core>0){const c=Math.min(e.core,d2);e.core-=c;d2-=c;}this.pilotDmg=(this.pilotDmg||0)+Math.min(e.hp,d2);if(e.titan)e.tp=(e.tp||0)+Math.min(e.hp,d2);const old=e.hp;
  this.charge=Math.min(SUPER_MAX,this.charge+Math.min(e.hp,d2)*FILL_DEALT*(t.fillM||1));e.hp=Math.max(0,e.hp-d2);if(old>0&&!e.hp){this.kills++;this.effects.push({kind:'destroy',x:e.x,y:e.y+2,z:e.z,life:.7,at:this.time});}return d2;}
 modTick(dt){
  for(const e of this.enemies){if(!e.burns||!e.burns.length)continue;e.bT=(e.bT||0)+dt;for(const b of e.burns){const h=Math.min(dt,b.t);b.a=(b.a||0)+b.d*h;b.t-=h;}   // Inferno Core burns, dealt every half second
   if(e.bT>=.5||e.burns.every(b=>b.t<=0)){e.bT=0;let a=0;for(const b of e.burns){a+=b.a||0;b.a=0;}if(e.pattern==='shield'&&this.time%8<3)a*=.35+mfPierce(this.playerStats)*.65;   // the shield commander's barrier cuts a burn tick like a shot (Penetrator Coil gets most through), as a raised shield does in the Arcade
   if(a>0&&e.hp>0){this.modHurt(e,a);this.effects.push({kind:'impact',x:e.x,y:e.y+2,z:e.z,life:.2,weapon:'siege'});}}
   e.burns=e.burns.filter(b=>b.t>0||b.a>0);if(!e.burns.length)delete e.burns;}   // a burn whose time ran out between two ticks still deals what it built up (as in the Arcade sim)
  const t=this.playerStats;if(!t.rm||this.playerHp<=0)return;const mf=this.modState(),p=this.player,lp=this.mfP;
  const v=lp&&dt>0?Math.hypot(p.x-lp.x,p.z-lp.z)/dt:0;this.mfP={x:p.x,z:p.z};
  mfStep(t,mf,dt,{spd:this.dashState?1:v/Math.max(.1,this.combatSpeed*mfSpeed(t,mf))});
  // Reflex Skirts: the shield raises itself when a marked strike is about to land on the pilot
  if(t.rm.reflex&&!(this.shieldCd>0)&&!(this.shieldT>0)&&(this.hazards||[]).some(h=>h.remaining>0&&h.remaining<=t.rm.reflex.lead&&Math.hypot(p.x-h.x,p.z-h.z)<h.radius+2)){const V=engineeringValues(t,this.engineering);this.shieldT=V.shieldDuration;this.shieldCd=V.shieldCooldown;mfCue(mf,'reflex');}
  const Q=this.modQ||[];this.modQ=[];
  for(const m of Q){if(m.k==='ring'){const dmg=m.n*t.rm.heatsink.dmg*this.modDps(),R=engineeringValues(t,this.engineering).range;this.effects.push({kind:'nova',k:'twin1',oc:0,x:p.x,y:p.y-2.2,z:p.z,r:8,life:.45,at:this.time});
    for(const e of this.enemies)if(e.hp>0&&dist(center(e),p)<=R&&lineClear(p,center(e))){this.modHurt(e,dmg);this.effects.push({kind:'impact',x:e.x,y:e.y+2,z:e.z,life:.25,weapon:'siege'});}}   // Heat Sink Plating: every Parasite in range and sight
   else if(m.k==='refl'){const e=this.enemies.find(x=>x.id===m.e);if(e&&e.hp>0){this.modHurt(e,m.d*(1-armor(e.stats)),true);this.effects.push({kind:'impact',x:e.x,y:e.y+2,z:e.z,life:.25,weapon:'pulse'});}}}}   // Reflector Field: back at the shooter
 // Decoy Beacon (Session 6 consumable, rules.js CQ_ITEMS.decoy): while it lives, every Parasite within its radius drives to the
 // beacon and fires at it instead of the pilot. Position only: it never reads the pilot's gear (the 5D fairness rule).
 lure(e){const d=this.decoy;if(!d||!(d.t>0)||Math.hypot(e.x-d.x,e.z-d.z)>d.r)return false;const a=archetypes[e.kind],dx=d.x-e.x,dz=d.z-e.z,l=Math.hypot(dx,dz)||1;
  e.target={x:d.x,y:(d.y||0)+2.2,z:d.z};e.vx=l>9?dx/l*a.speed:0;e.vz=l>9?dz/l*a.speed:0;return true;}
 dispose(){this.projectiles=[];this.enemies=[];this.effects=[];}
}
// ---- Session 6C: the friendly side's engine (blueprint §4 build notes). The Parasites' steering (steer) and targeting rules with
// the side flipped: each unit decides every ALLY.decide s where it belongs (its formation slot, the hold point, behind the pilot,
// a Mender when it is low), which Parasite its role wants, and fires its own weapon on its own cooldown and heat.
Object.assign(Battle.prototype,{
 shotRoom(team){if(this.projectiles.length>=CAPS.projectiles)return false;if(team==='player')return true;let n=0;for(const q of this.projectiles)if(q.team===team)n++;return n<(team==='enemy'?CAPS.enemyProjectiles:CAPS.friendProjectiles);},
 shotStats(q){return q.stats||(q.team==='player'?this.playerStats:q.team==='ally'?friendStats(this.friendById(q.owner)||GHOST):enemyStats(archetypes.raider));},
 friendById(id){for(const f of this.friends)if(f.id===id)return f;return null;},
 friendStats(f){return friendStats(f);},
 // the unit a Parasite fires at: the nearest of the pilot and the friendly units by an effective distance (the pilot first by
 // ALLY.pilotBias m: Parasites focus the pilot; a Guardian inside its taunt radius draws fire). Position and role only.
 threat(e,pd){let best=null,bd=pd;const held=g=>{let n=0;for(const x of this.enemies)if(x!==e&&x.hp>0&&!x.dormant&&x.tf===g.id)n++;return n;};for(const f of this.friends){if(f.down||f.hp<=0)continue;const d=Math.hypot(f.x-e.x,f.z-e.z),eff=(f.role==='guardian'&&d<ROLES.guardian.taunt&&(e.tf===f.id||held(f)<ROLES.guardian.hold)?d-ROLES.guardian.pull*f.m:d+ALLY.pilotBias)+(f.mil?tune(this,f).pilotBias:0);if(eff<bd){bd=eff;best=f;}}
  return best?{t:center(best),d:Math.hypot(best.x-e.x,best.z-e.z),f:best}:{t:this.player,d:pd};},
 // Guardian: a friendly unit (or the pilot) within its cover radius, with the Guardian on the shooter's side, takes less damage
 coverOf(t,q){const sh=this.enemies.find(e=>e.id===q.owner);if(!sh)return 0;let best=0;for(const g of this.friends){if(g===t||g.role!=='guardian'||g.down||g.hp<=0)continue;const gx=g.x-t.x,gz=g.z-t.z;if(Math.hypot(gx,gz)>ROLES.guardian.coverR||gx*(sh.x-t.x)+gz*(sh.z-t.z)<=0)continue;best=Math.max(best,Math.min(.45,ROLES.guardian.cover*g.m));}return best;},
 friendHit(q){for(const f of this.friends)if(!f.down&&f.hp>0&&Math.abs(f.x-q.x)<3.2&&Math.abs(f.z-q.z)<3.2&&this.hit(q,f,2.5))return true;return false;},
 friendKill(e,f){if(f)f.kills++;this.akills=(this.akills||0)+1;this.effects.push({kind:'destroy',x:e.x,y:e.y+2,z:e.z,life:.7,at:this.time,a:1});},
 friendDown(f){f.hp=0;f.down=1;f.hurt=1;f.hc=ALLY.downHull;f.vx=f.vz=0;f.dash=null;f.tgt=0;f.dt=0;this.downs=(this.downs||0)+1;this.effects.push({kind:'destroy',x:f.x,y:f.y+2,z:f.z,life:.7,at:this.time,a:1});},
 activeHostiles(){const P=this.player,list=this.enemies.filter(e=>e.hp>0&&!e.dormant&&!(e.resident&&Math.hypot(e.x-P.x,e.z-P.z)>240));if(list.length<=CAPS.hostile)return null;
  return new Set(list.map(e=>[Math.hypot(e.x-P.x,e.z-P.z),e.id]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]).slice(0,CAPS.hostile).map(x=>x[1]));},
 slowAt(e){let k=1;for(const z of this.fields)if(Math.hypot(e.x-z.x,e.z-z.z)<z.r)k=Math.min(k,1-z.k);return k;},
 // Frostline cryo fields: they slow every Parasite inside; a light unit (a scout hull or a drone) inside for a second freezes
 fieldStep(dt){for(const z of this.fields)z.t-=dt;this.fields=this.fields.filter(z=>z.t>0);if(!this.fields.length)return;const F=ROLES.frostline;
  for(const e of this.enemies){if(e.hp<=0)continue;let inside=null;for(const z of this.fields)if(Math.hypot(e.x-z.x,e.z-z.z)<z.r){inside=z;break;}
   if(!inside){if(e.fzA)e.fzA=0;continue;}if((e.cls==='scout'||e.drone)&&!(e.fz>0)){e.fzA=(e.fzA||0)+dt;if(e.fzA>=F.freezeAfter){e.fz=inside.fr;e.fzA=0;e.cd=Math.max(e.cd,e.fz);this.effects.push({kind:'impact',x:e.x,y:e.y+2,z:e.z,life:.4,weapon:'frost',a:1});}}}},
 // where the unit's formation slot is (relative to the pilot, along the squad's smoothed heading)
 slotPoint(i,explore){const S=this.squad,F=FORMS[S.f]||FORMS.wedge,o=F[Math.max(0,i)%F.length],h=Number.isFinite(S.hd)?S.hd:0,k=explore?1.15:1;return {x:this.player.x+(Math.cos(h)*o[0]+Math.sin(h)*o[1])*k,z:this.player.z+(-Math.sin(h)*o[0]+Math.cos(h)*o[1])*k};},
 // behind the pilot, away from the nearest Parasite (FALL BACK, and a damaged unit with no Mender)
 fallbackPoint(){const P=this.player;let near=null,bd=80;for(const e of this.enemies){if(e.hp<=0)continue;const d=Math.hypot(e.x-P.x,e.z-P.z);if(d<bd){bd=d;near=e;}}
  if(near){const l=bd||1;return {x:P.x-(near.x-P.x)/l*16,z:P.z-(near.z-P.z)/l*16};}const h=Number.isFinite(this.squad.hd)?this.squad.hd:0;return {x:P.x-Math.sin(h)*14,z:P.z-Math.cos(h)*14};},
 // COMMAND (owner, Nov 18): 1 follow, 2 attack (the locked target; with no lock the Parasite nearest your aim), 3 hold here, 4 fall
 // back, 5 the smart order (attack my locked target, or regroup when nothing is locked). Your pilots only; LDF regulars keep theirs.
 squadOrder(k){const S=this.squad;if(!S.orders||!this.friends.some(f=>f.side==='mine'))return false;{const g=this.time-(Number.isFinite(S.ot)?S.ot:-99);if(g>=0&&g<ORDER_GAP)return false;}S.ot=this.time;k=k|0;const P=this.player;   /* one order a second (reviewer 1: an order in every command reset every ally's decision timer and undid the aim lag) */
  if(k===5)k=this.lockId!=null&&this.enemies.some(e=>e.id===this.lockId&&e.hp>0)?2:1;if(k<1||k>4)return false;let t=0;
  if(k===2){t=this.lockId!=null&&this.enemies.some(e=>e.id===this.lockId&&e.hp>0)?this.lockId:0;if(!t){let bs=.5;const y=this.turretYaw||0;for(const e of this.enemies){if(e.hp<=0)continue;const d=Math.hypot(e.x-P.x,e.z-P.z);if(d>120)continue;const a=Math.abs(Math.atan2(Math.sin(Math.atan2(e.x-P.x,e.z-P.z)-y),Math.cos(Math.atan2(e.x-P.x,e.z-P.z)-y)));if(a<bs){bs=a;t=e.id;}}}if(!t)k=1;}
  const changed=S.o!==ORDERS[k]||S.t!==t||k===3;S.o=ORDERS[k];S.t=t;S.at=this.time;if(k===3){S.x=P.x;S.z=P.z;}if(changed)for(const f of this.friends)if(f.side==='mine')f.dec=Math.min(f.dec,(f.id%5)*.04);   /* only a new order makes the crews re-decide (review 1: a repeated order shortened the militia freeze) */
  this.effects.push({kind:'order',o:S.o,x:P.x,y:P.y-2.2,z:P.z,life:.8,at:this.time});return true;},
 laneClear(f,a,b){const dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L,blocks=o=>{const px=o.x-a.x,pz=o.z-a.z,al=px*ux+pz*uz;return al>2&&al<L-2&&Math.abs(px*uz-pz*ux)<ALLY.fireLane;};
  if(blocks(this.player))return false;for(const o of this.friends)if(o!==f&&!o.down&&o.hp>0&&blocks(o))return false;return true;},   // never through the pilot or another friendly unit
 // the Parasite this unit's role wants (blueprint §4 "Answers"); every role helps with what threatens the pilot and the pilot's lock
 roleTarget(f,R,range,anchor,reach,leash){let best=null,bs=-Infinity;const P=this.player,role=f.role;
  for(const e of this.enemies){if(e.hp<=0||e.dormant)continue;const d=Math.hypot(e.x-f.x,e.z-f.z);if(d>reach||Math.hypot(e.x-anchor.x,e.z-anchor.z)>leash+range)continue;
   const dp=Math.hypot(e.x-P.x,e.z-P.z),heavy=e.kind==='sentinel'||e.kind==='command'||!!e.commander,light=e.cls==='scout'||!!e.drone;let sc=-d;if(dp<40)sc+=15;if(e.id===this.lockId)sc+=role?10:50;
   if(role==='guardian'){if(dp<30)sc+=25;}
   else if(role==='breacher'){if(e.immobile||e.objectiveTarget||e.id===this.carrierId)sc+=40;if(e.fz>0)sc+=30;}
   else if(role==='lancer'){if(e.drone)sc+=40;if(d<R.closeR)sc-=30;if(e.sh&&e.sh.t>this.time)sc+=20;sc+=d*.3;}
   else if(role==='mender')sc-=10;
   else if(role==='corroder'){if(heavy)sc+=30;if(e.commander)sc+=15;if(!(e.sh&&e.sh.t>this.time&&e.sh.n>=R.stacks))sc+=10;}
   else if(role==='frostline'){if(light)sc+=30;for(const o of this.enemies)if(o!==e&&o.hp>0&&Math.hypot(o.x-e.x,o.z-e.z)<R.fieldR)sc+=8;}
   if(sc>bs){bs=sc;best=e;}}
  return best;},
 chooseFriend(f,st,R,slot,explore){const S=this.squad,P=this.player,mine=f.side==='mine',order=mine&&S.orders?S.o:'follow',range=st.eng.range*R.range;
  let anchor,leash;
  if(!mine){anchor=f.post||{x:f.x,z:f.z};leash=30;}
  else if(order==='hold'){anchor={x:S.x,z:S.z};leash=10;}
  else if(order==='fallback'){anchor=this.fallbackPoint();leash=6;}
  else{anchor=this.slotPoint(slot,explore);leash=ALLY.leash;}
  // left far behind (a fast-travel, a long drive): rejoin at the slot unless a fight holds the unit
  if(mine&&Math.hypot(f.x-P.x,f.z-P.z)>ALLY.regroup&&!this.enemies.some(e=>e.hp>0&&Math.hypot(e.x-f.x,e.z-f.z)<40)){const p=this.slotPoint(slot,explore);if(!W.solidAt(p.x,p.z)){f.x=p.x;f.z=p.z;f.y=W.groundAt(p.x,p.z);f.surface='ground';f.vx=f.vz=0;f.tgt=0;return;}}
  // a Mender goes to a downed unit it can still revive this fight; a damaged unit falls back to a Mender (or behind the pilot)
  let rv=null;if(f.role==='mender'&&!f.rv)rv=this.friends.find(o=>o.down&&o.side===f.side&&Math.hypot(o.x-f.x,o.z-f.z)<ROLES.mender.reviveR)||null;
  const low=!rv&&f.role!=='mender'&&f.hp<f.maxHp*ROLES.mender.low;
  if(rv){anchor={x:rv.x,z:rv.z};leash=3;}else if(low){const m=this.friends.find(o=>o!==f&&o.role==='mender'&&!o.down&&o.hp>0);anchor=m?{x:m.x,z:m.z}:this.fallbackPoint();leash=5;}
  else if(f.role==='guardian'&&mine&&order==='follow'){let near=null,bd=60;for(const e of this.enemies){if(e.hp<=0)continue;const d=Math.hypot(e.x-P.x,e.z-P.z);if(d<bd){bd=d;near=e;}}if(near){const l=bd||1;anchor={x:P.x+(near.x-P.x)/l*8,z:P.z+(near.z-P.z)/l*8};}}   // stands between the pilot and the nearest threat
  let t=null;if(mine&&order==='attack'&&S.t){t=this.enemies.find(e=>e.id===S.t&&e.hp>0)||null;if(!t){S.o='follow';S.t=0;}}
  if(!t)t=this.roleTarget(f,R,range,anchor,order==='fallback'||low||rv?Math.min(25,range):range+15,leash);
  if((t?t.id:0)!==f.tgt){f.tgt=t?t.id:0;f.react=t&&t.id===this.lockId?tune(this,f).reactLock:tune(this,f).react;}   // reaction time: a new target waits before the first shot (less for the pilot's own lock: the squad datalink)
  if(t){const c=center(t);f.ax=c.x;f.ay=c.y;f.az=c.z;}   // the aim lag: the unit aims at where its target is now until it decides again
  const da=Math.hypot(f.x-anchor.x,f.z-anchor.z),speed=st.speed*(explore?2:1)*(da>leash+12?1.25:1),crowd=[...this.friends,{x:P.x,z:P.z,hp:1}];
  if(t&&!rv&&!low&&order!=='fallback'&&da<=leash+range*.5){this.steer(f,center(t),range*R.keep,speed,crowd,null);if(Math.hypot(f.x+f.vx-anchor.x,f.z+f.vz-anchor.z)>leash+range*.5)f.vx=f.vz=0;}
  else if(da>2.5)this.steer(f,{x:anchor.x,y:W.groundAt(anchor.x,anchor.z)+2.2,z:anchor.z},0,speed,crowd,null,false);
  else f.vx=f.vz=0;
  if(f.role==='breacher'&&t&&!f.dash&&this.time>=f.ch){const d=Math.hypot(t.x-f.x,t.z-f.z);if(d>R.chargeMin&&d<R.chargeMax&&lineClear(center(f),center(t))){f.dash={t:R.chargeT,x:(t.x-f.x)/d,z:(t.z-f.z)/d};f.ch=this.time+R.charge;}}   // the short charge
  if(f.role==='frostline'&&t&&this.time>=f.fz&&Math.hypot(t.x-f.x,t.z-f.z)<range){this.fields=this.fields.filter(z=>z.by!==f.id);this.fields.push({x:t.x,z:t.z,r:R.fieldR,t:R.fieldS,k:Math.min(.7,R.slow*f.m),fr:Math.min(3,R.freeze*f.m),by:f.id});f.fz=this.time+R.every;this.effects.push({kind:'nova',k:'twin0',oc:0,x:t.x,y:t.y,z:t.z,r:R.fieldR,life:.6,at:this.time,a:1});}},
 friendStep(dt){const S=this.squad,P=this.player,explore=this.localEncounter&&!this.operation;
  const h=Number.isFinite(this.heading)?this.heading:this.turretYaw||0;if(!Number.isFinite(S.hd))S.hd=h;S.hd+=clamp(Math.atan2(Math.sin(h-S.hd),Math.cos(h-S.hd)),-2.5*dt,2.5*dt);
  const quiet=explore&&!this.enemies.some(e=>e.hp>0&&Math.hypot(e.x-P.x,e.z-P.z)<ALLY.quietR);let i=0;
  for(const f of this.friends){const slot=f.side==='mine'?i++:-1;if(f.ctl!=='ai')continue;   // a human pilot (co-op) is driven by its own inputs, never by this AI
   if(f.down){if(explore&&quiet){f.dt=(f.dt||0)+dt;if(f.dt>=ALLY.returnS){const p=this.slotPoint(slot,explore);if(!W.solidAt(p.x,p.z)){f.x=p.x;f.z=p.z;f.y=W.groundAt(p.x,p.z);}f.down=0;f.dt=0;f.hp=Math.round(f.maxHp*ALLY.downHull);}}else if(explore)f.dt=0;continue;}   // never lost: it returns at half hull
   const st=friendStats(f),R=ROLES[f.role]||ROLES[''],cap=f.maxHp*(f.hc||1);f.dec-=dt;f.cd-=dt;f.react-=dt;
   if(quiet&&f.hp<cap)f.hp=Math.min(cap,f.hp+f.maxHp*.03*dt);
   if(f.dec<=0){this.chooseFriend(f,st,R,slot,explore);f.dec=tune(this,f).decide;}
   f.heat=Math.max(0,f.heat-(f.oh?Math.max(st.eng.cooling,st.eng.capacity*.13):st.eng.cooling)*dt);if(f.oh&&f.heat<=st.eng.capacity*.35)f.oh=0;
   if(f.dash){f.dash.t-=dt;if(f.dash.t<=0)f.dash=null;}
   const vx=f.dash?f.dash.x*st.speed*5.1:f.vx,vz=f.dash?f.dash.z*st.speed*5.1:f.vz;
   if(vx||vz){const q=this.moveOf?this.moveOf(f,vx*dt,vz*dt):W.advance(f,vx*dt,vz*dt);if(q.x!==f.x||q.z!==f.z){f.heading=Math.atan2(q.x-f.x,q.z-f.z);f.x=q.x;f.y=q.y;f.z=q.z;f.surface=q.surface;}}
   if(f.role==='mender'){const H=ROLES.mender,amt=H.heal*f.m*dt;let best=null,bf=1;
    if(this.playerHp>0&&this.playerHp<this.playerMax&&Math.hypot(P.x-f.x,P.z-f.z)<H.healR){bf=this.playerHp/this.playerMax;best=P;}
    for(const o of this.friends){if(o===f||o.down||o.hp<=0||o.hp>=o.maxHp*(o.hc||1)||Math.hypot(o.x-f.x,o.z-f.z)>H.healR)continue;const r=o.hp/o.maxHp;if(r<bf){bf=r;best=o;}}
    if(best===P)this.playerHp=Math.min(this.playerMax,this.playerHp+this.playerMax*amt);else if(best)best.hp=Math.min(best.maxHp*(best.hc||1),best.hp+best.maxHp*amt);
    if(!f.rv){const d=this.friends.find(o=>o.down&&o.side===f.side&&Math.hypot(o.x-f.x,o.z-f.z)<6);if(d){f.rvT=(f.rvT||0)+dt;if(f.rvT>=H.reviveS){d.down=0;d.dt=0;d.hp=Math.round(d.maxHp*H.revive);f.rv=1;f.rvT=0;this.effects.push({kind:'nova',k:'pulse0',oc:0,x:d.x,y:d.y,z:d.z,r:4,life:.6,at:this.time,a:1});}}else f.rvT=0;}}
   const t=f.tgt?this.enemies.find(e=>e.id===f.tgt&&e.hp>0):null;if(!t||!Number.isFinite(f.ax))continue;
   const want=Math.atan2(f.ax-f.x,f.az-f.z),delta=Math.atan2(Math.sin(want-f.turret),Math.cos(want-f.turret)),turn=STAT.turn*(st.turnM||1)*tune(this,f).turn*dt;f.turret+=clamp(delta,-turn,turn);
   const fc=center(f),aim={x:f.ax,y:f.ay,z:f.az},range=st.eng.range*R.range;
   if(f.cd<=0&&!f.oh&&f.react<=0&&Math.abs(delta)<ALLY.align&&dist(fc,aim)<range&&this.laneClear(f,fc,aim)&&lineClear(fc,aim)&&this.shoot(fc,aim,st,'ally',st.wtype,f.id)){
    f.cd=st.wshot/rofMult(st);f.heat+=st.eng.heatPerShot;if(f.heat>=st.eng.capacity){f.heat=st.eng.capacity;f.oh=1;}this.effects.push({kind:'muzzle',x:fc.x,y:fc.y,z:fc.z,weapon:st.wtype,life:.1,a:1});}
   // its super: the player's charge rule (its own damage dealt and taken) plus a minimum spacing, per unit and across all units
   if(f.charge>=SUPER_MAX&&this.allySuper&&this.time-f.sup>=ALLY.superSpacing&&this.time-(Number.isFinite(this.allySup)?this.allySup:-99)>=ALLY.superGap&&f.react<=0&&dist(fc,aim)<range&&lineClear(fc,aim)){f.sup=this.time;this.allySup=this.time;this.allySuper(f,st,aim);f.charge=0;}}}   // the meter empties after the shot (as the pilot's)
});
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
  // Session 6 hunters (packs, incursions, vein ambushes): authored aggro and leash, never gear (spec §5.6). A pack never follows
  // the pilot into the Heartland (ring 1: the first hour stays the incursions' ground only), and never hunts within 150 m of a
  // field-mission marker (packs 0 and 3 loop 21-27 m from BREAK THE REDOUBT and BEACON EXTRACTION: no ambush on the way in or on
  // RETURN TO EXPLORATION). Positions only: the same on the Worker and the client.
  if(e.hunt){const H=e.hunt,inHeart=!H.heart&&(W.ringAt(this.player.x,this.player.z)===1||nearFieldMission(this.player));if(!inHeart&&(d<H.r||e.hp<e.maxHp)&&homeDistance<H.leash){const objective=this.objective,tg=this.friends.length?this.threat(e,d).t:this.player;this.objective=tg;super.choose(e);this.objective=objective;e.target=tg;}
   else {e.guardReturning=true;if(e.route){e.routeIndex=e.routeIndex||0;if(Math.hypot(e.x-e.route[e.routeIndex][0],e.z-e.route[e.routeIndex][1])<3)e.routeIndex=(e.routeIndex+1)%e.route.length;const [x,z]=e.route[e.routeIndex];e.navGoal={x,z,y:W.groundAt(x,z)+2.2};}else e.navGoal=e.home;super.choose(e);e.guardReturning=false;}
   const q=W.advance(e,e.vx,e.vz);if(Math.hypot(q.x-e.home.x,q.z-e.home.z)>H.leash)e.vx=e.vz=0;return;}
  const alerted=d<65||e.hp<e.maxHp||(e.radioUntil||0)>this.time||this.friends.length>0&&this.friends.some(f=>!f.down&&f.hp>0&&Math.hypot(f.x-e.x,f.z-e.z)<50);
  if(e.hp<e.maxHp*.2&&d<40&&homeDistance>30){e.guardReturning=true;e.navGoal=e.home;super.choose(e);e.guardReturning=false;return;}
  if(alerted&&homeDistance<100){const objective=this.objective,tg=this.friends.length?this.threat(e,d).t:this.player;this.objective=tg;super.choose(e);this.objective=objective;e.target=tg;}
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
// Raid doctrine by danger. Enemy-side only: it never reads the player's loadout, gear, Moonbeam or Lunar Skin. HARD is a real
// fight for starter gear; VETERAN usually beats starter gear and needs upgrades or skill. Added units carry no salvage, so
// verified raid payouts are unchanged.
const raidDoctrine=freeze({
 HARD:freeze({hull:1.15,objectiveHull:1.1,damage:1.15,garrison:freeze(['raider']),waves:freeze([freeze(['raider','raider']),freeze(['raider','breacher'])]),engageAt:0,breather:22,hazardEvery:10,enrageAt:.35,enrageCadence:.8,cadence:1}),
 VETERAN:freeze({hull:1.55,objectiveHull:1.3,damage:1.5,garrison:freeze(['raider','command']),waves:freeze([freeze(['raider','raider','breacher']),freeze(['raider','command','raider']),freeze(['sentinel','raider'])]),engageAt:1,breather:18,hazardEvery:7.5,enrageAt:.5,enrageCadence:.6,cadence:.85})});
// At most one heavy sentinel per raid: a layout that already fields one (Ash Approach) gets a breacher in its place.
function waveKinds(D,n,heavyFielded){const kinds=D.waves[Math.min(n,D.waves.length)-1];return heavyFielded?kinds.map(k=>k==='sentinel'?'breacher':k):[...kinds];}
function doctrineOf(o){return o?.raid?raidDoctrine[o.danger]||raidDoctrine.HARD:null;}
class Operation extends Battle {
 constructor(loadout,p,id){super(loadout,p);this.operation=operations[id];if(!this.operation)throw Error('unknown operation');this.localEncounter=true;this.enemies=[];this.id=20000;this.stage=0;this.work=0;this.scans=0;this.objectiveHp=this.objectiveMax=1200;this.objectiveDamageable=id==='rescue';this.approachGrace=0;const o=this.operation;this.objective={x:o.x,y:W.groundAt(o.x,o.z)+2.2,z:o.z};
 this.nodes=id==='recon'?[[o.x,o.z],[o.x+30,o.z+20],[o.x+55,o.z-10]]:[];
 // Installation missions fight the persistent world garrison attached by the session.
 const team=o.raid||o.defense||o.strike||id==='base-defense'||o.wingman?[]:id==='relay'||id==='redoubt'?[]:id==='rescue'?['raider','breacher','command']:['raider','raider'];
 team.forEach((kind,i)=>this.deploy(kind,o.x+18+i*12,o.z-25,'guard:'+i));
 if(o.wingman){[[-16,16],[-16,-16]].forEach(([dx,dz],i)=>this.deploy('raider',o.x+dx,o.z+dz,'pinning:'+i));for(const e of this.enemies){e.noLoot=true;e.noKill=1;}   // pays nothing: no salvage, points, loot or War Order kill
  const w=friendUnit({id:800000999,side:'ldf',kit:{w:{a:'pulse',t:0,q:1},c:{c:'vanguard',t:0,q:1}},x:o.x,z:o.z,heading:Math.PI});w.ctl='none';w.down=1;w.hp=0;w.wreck=1;this.friends.push(w);}   // the downed pilot's tank
 if(id==='convoy'){this.deploy('command',o.x,o.z-10,'carrier');this.carrierId=this.enemies.at(-1).id;}
 if(o.raid)this.setupRaid();if(id==='base-defense'||o.defense){this.objectiveDamageable=true;this.objectiveHp=this.objectiveMax=1800;this.defenseWave=0;this.waveMax=o.waves||2;if(o.colony){this.defenseConfig='turret';this.baseTier=2;}if(o.ldf)this.deployLdf(o.ldf);this.deployDefense();}
 if(id==='relay'){this.deploy('command',o.x,o.z,'relay');const e=this.enemies.at(-1);e.immobile=true;e.hp=e.maxHp=450;this.relayId=e.id;}
 if(o.family==='strike'){this.strikeWave=0;this.deployStrike();}
 }
 // Meteor Strike waves: fixed authored HARD tier, never matched to the pilot's gear (interceptors, then a heavy group)
 deployStrike(){const o=this.operation,n=++this.strikeWave,kinds=n===1?['raider','raider','raider']:['sentinel','command','raider'];kinds.forEach((kind,i)=>this.deploy(kind,o.x-28+i*14,o.z-34,'strike:'+n+':'+i));}
 spawnWave(){}
 setupRaid(){const o=this.operation;this.hazards=[];this.nextHazard=6;this.reinforcements=0;this.reinforcing=false;this.objectiveDamageable=false;this.nodes=o.route.map(p=>p.slice());this.extracting=false;
  const [a,b,c]=o.offsets;this.deploy('raider',o.x+a[0],o.z+a[1],'flanker');this.deploy(o.layout==='ash-approach'?'sentinel':'command',o.x+b[0],o.z+b[1],'support');
  if(o.family==='sabotage'||o.family==='battery'){for(let i=0;i<(o.family==='battery'?2:1);i++){this.deploy('command',o.x+(i?22:0),o.z+(i?-12:0),'battery:'+i);const e=this.enemies.at(-1);e.immobile=true;e.hp=e.maxHp=o.family==='battery'?240:360;e.objectiveTarget=true;}this.relayId=this.enemies.at(-1).id;}
  if(o.family==='intercept'){this.deploy('command',o.x+c[0],o.z+c[1],'carrier');const e=this.enemies.at(-1);e.hp=e.maxHp=420;this.carrierId=e.id;this.escapeStart={x:e.x,z:e.z};}
  // The doctrine garrison holds the far side of the objective (away from the authored entry), never the entry itself.
  const D=doctrineOf(o),ex=o.x-o.entry[0],ez=o.z-o.entry[1],el=Math.hypot(ex,ez)||1,ux=ex/el,uz=ez/el;D.garrison.forEach((kind,i)=>{const side=(i%2?-1:1)*(10+Math.floor(i/2)*8);try{this.deploy(kind,o.x+ux*18-uz*side,o.z+uz*18+ux*side,'doctrine:'+i);}catch(error){return;}const e=this.enemies.at(-1);e.noLoot=true;e.doctrine=true;});
  if(o.family!=='siege')this.deployCommander();for(const e of this.enemies)this.harden(e);
 }
 harden(e){const D=doctrineOf(this.operation);if(!D||!e||e.hardened||e.resident)return;// Heavy sentinels already hit hardest (72 dps at 54 m): they take half the hull bonus and no damage bonus.
  const heavy=e.kind==='sentinel',k=e.objectiveTarget||e.id===this.carrierId?D.objectiveHull:heavy?1+(D.hull-1)/2:D.hull;e.hp=e.maxHp=Math.round(e.maxHp*k);e.stats.dmgM=(e.stats.dmgM||1)*(heavy?1:D.damage);e.hardened=true;}
 deployCommander(){const o=this.operation;this.deploy(o.commander==='ambush'?'raider':o.commander==='carrier'?'command':'sentinel',o.x+12,o.z-38,'commander');const e=this.enemies.at(-1);e.commander=true;e.pattern=o.commander;e.hp=e.maxHp=o.commander==='ambush'?460:680;e.nextPattern=this.time+4;e.drones=0;this.commanderId=e.id;this.harden(e);}
 defenseStep(dt){if(this.defenseConfig==='drone')this.objectiveHp=Math.min(this.objectiveMax,this.objectiveHp+12*dt);if(this.defenseConfig!=='turret')return;this.turretClock=(this.turretClock||0)-dt;if(this.turretClock>0)return;this.turretClock=.6;const from={x:this.operation.x,y:W.groundAt(this.operation.x,this.operation.z)+6,z:this.operation.z},e=this.enemies.find(e=>!e.resident&&e.hp>0&&Math.hypot(e.x-from.x,e.z-from.z)<65&&lineClear(from,center(e)));if(!e)return;const damage=18+3*(this.baseTier||0);e.hp=Math.max(0,e.hp-damage);this.effects.push({kind:'beam',weapon:'pulse',x:from.x,y:from.y,z:from.z,ex:e.x,ey:e.y+2.2,ez:e.z,life:.15});if(!e.hp){this.kills++;this.effects.push({kind:'destroy',x:e.x,y:e.y+2,z:e.z,life:.7,at:this.time});}}
 // Session 7: Colony Defense waves are three light interceptors; a Joint Operation's counter-waves grow (a heavy in the last at HARD, two at
 // VETERAN); every other defense keeps its two waves of two interceptors and a saboteur. A general leading the assault joins the last wave.
 deployDefense(){const o=this.operation;if(o.family==='colony-defense'||o.family==='counterattack'){this.defenseWave++;const n=this.defenseWave,kinds=o.family==='colony-defense'?['raider','raider','raider']:n===1?['raider','raider','breacher']:n<(this.waveMax||3)?['raider','breacher',o.danger==='VETERAN'?'sentinel':'raider']:['breacher','sentinel',o.danger==='VETERAN'?'sentinel':'raider'];
  kinds.forEach((kind,i)=>{this.deploy(kind,o.x-30+i*20,o.z-40,'defense:'+n+':'+i);this.enemies.at(-1).role=kind==='breacher'?'facility':'player';});this.objectiveDamageable=true;if(n>=(this.waveMax||2))this.deployGeneral();return;}
  this.deployDefenseWave();if(this.defenseWave>=(this.waveMax||2))this.deployGeneral();}
 // the general (js/conquest/war.js GENERALS): a commander with its doctrine's pattern, its hull by stars (authored, never by gear)
 deployGeneral(){const g=this.general;if(!g||this.generalId||!g.pattern)return;const o=this.operation;try{this.deploy(g.pattern==='ambush'?'raider':g.pattern==='carrier'?'command':'sentinel',o.x+12,o.z-38,'general');}catch(e){return;}const e=this.enemies.at(-1);e.commander=true;e.general=String(g.id||'');e.pattern=g.pattern;e.hp=e.maxHp=300+120*Math.max(1,Math.min(5,g.stars|0));e.nextPattern=this.time+4;e.drones=0;this.generalId=e.id;}
 // five LDF tanks in militia kit (Common, no cores), outside your command: they fight beside you
 deployLdf(n){const o=this.operation;for(let i=0;i<Math.min(5,n|0)&&this.friends.length<CAPS.friends;i++)this.friends.push(friendUnit({id:800090000+i,side:'ldf',kit:{w:{a:'pulse',t:0,q:1},c:{c:i%2?'titan':'vanguard',t:0,q:1},mil:1},x:o.x-10+i*5,z:o.z+14,heading:Math.PI,name:'LDF '+(i+1)}));}
 deployDefenseWave(){this.defenseWave++;for(let i=0;i<3;i++){this.deploy(i===2?'breacher':'raider',this.operation.x-30+i*20,this.operation.z-40,'defense:'+this.defenseWave+':'+i);this.enemies.at(-1).role=i===2?'facility':'player';}this.objectiveDamageable=true;}
 hazardStep(dt){this.hazards=Array.isArray(this.hazards)?this.hazards:[];for(const h of this.hazards){h.remaining-=dt;if(h.remaining>0)continue;const d=Math.hypot(this.player.x-h.x,this.player.z-h.z);if(d<h.radius){this.hitBy=-1;let damage=h.damage*(1-.35*d/h.radius)*(1-armor(this.playerStats));if(this.shieldT>0)damage*=SHIELD_MULT;damage*=plateTaken(this.playerStats,h.kind==='plasma',h.kind==='plasma'||h.kind==='orbital');const base=baseBenefits(this.baseTier,this.baseModules);if(Math.hypot(this.player.x-baseDefinition.x,this.player.z-baseDefinition.z)<base.radius)damage*=1-base.mitigation;if(this.playerStats.rm){const M=mfTaken(this.playerStats,this.modState(),damage,2,0,this.playerMax);damage=M.amt;if(M.ring)this.modQ.push({k:'ring',n:M.ring});}this.playerHp=Math.max(0,this.playerHp-damage);}if(this.objectiveDamageable&&Math.hypot(this.objective.x-h.x,this.objective.z-h.z)<h.radius)this.objectiveHp=Math.max(0,this.objectiveHp-h.damage);this.effects.push({kind:'destroy',weapon:h.kind,x:h.x,y:h.y+.8,z:h.z,r:h.radius,life:.6});if(h.kind==='drop')this.landReinforcements(h);}this.hazards=this.hazards.filter(h=>h.remaining>0).slice(-8);
  for(const e of this.enemies){if(!e.commander||!e.pattern||e.hp<=0||this.time<(e.nextPattern||0))continue;{const D=doctrineOf(this.operation);e.nextPattern=this.time+(e.pattern==='artillery'?6:8)*(D?D.cadence*(e.enraged?D.enrageCadence:1):e.enraged?.65:1);}e.telegraph=true;const kind=e.pattern==='plasma'?'plasma':e.pattern==='carrier'?'drone':'orbital';if(e.pattern!=='shield'&&e.pattern!=='ambush'){this.markStrike(kind,this.player.x,this.player.z,e.id);if(e.pattern==='carrier'&&e.drones<droneDefinition.maxPerCarrier&&this.enemies.filter(t=>!t.resident&&t.hp>0).length<8&&this.enemies.filter(t=>t.drone&&t.hp>0).length<CAPS.drones){this.deploy('raider',e.x+8,e.z+8,'drone:'+e.drones);const drone=this.enemies.at(-1);this.harden(drone);drone.drone=true;drone.launchedAt=this.time;drone.surface='air';drone.cd=droneDefinition.takeoffSeconds;drone.telegraph=true;e.drones++;}}}
  if(this.operation.raid&&this.time>=(this.nextHazard||6)){this.nextHazard=this.time+(doctrineOf(this.operation)?.hazardEvery||11);this.markStrike(this.operation.hazard,this.player.x,this.player.z,0);}
 }
 markStrike(kind,x,z,source){if(this.hazards.length>=8)return;this.hazards.push({kind,x,z,y:W.groundAt(x,z),radius:kind==='plasma'?9:6,remaining:kind==='drone'?2.6:2.2,damage:(kind==='plasma'?75:55)*(doctrineOf(this.operation)?.damage||1),source});}
 // Authored raid doctrine: HARD sites call one telegraphed reinforcement wave, VETERAN sites two, and VETERAN commanders
 // shorten their telegraphed cadence below 40% hull. Reinforcements carry no salvage, so verified raid payouts are unchanged.
 reinforceStep(){const o=this.operation,D=doctrineOf(o),waves=D.waves.length,living=this.enemies.filter(e=>e.hp>0&&!e.resident);
  for(const e of living)if(e.commander&&!e.enraged&&e.hp<e.maxHp*D.enrageAt){e.enraged=true;e.nextPattern=Math.min(e.nextPattern||0,this.time+1.5);}
  // A breather follows each wave: the next is called only if the objective is still open 25s after the last landing.
  // Waves land once the site is clear and the objective hold begins (sieges: after the general falls), never on top of a commander fight.
  if(this.reinforcing||(this.reinforcements||0)>=waves||!o.drops||this.time<8||living.length>D.engageAt||living.some(e=>e.commander)||o.family==='siege'&&this.stage<1||Number.isFinite(this.lastLanding)&&this.time<this.lastLanding+D.breather)return;
  const [x,z]=o.drops[(this.reinforcements||0)%o.drops.length];this.reinforcing=true;this.hazards=Array.isArray(this.hazards)?this.hazards:[];this.hazards.push({kind:'drop',x,z,y:W.groundAt(x,z),radius:7,remaining:4,damage:40*D.damage,source:-1,wave:(this.reinforcements||0)+1});}
 landReinforcements(h){const o=this.operation,D=doctrineOf(o),n=this.reinforcements=(this.reinforcements||0)+1,kinds=waveKinds(D,n,this.enemies.some(e=>e.kind==='sentinel'&&!e.resident));this.reinforcing=false;this.lastLanding=this.time;
  kinds.forEach((kind,i)=>{try{this.deploy(kind,h.x+(i-1)*6,h.z,'reinforce:'+n+':'+i);}catch(error){return;}const e=this.enemies.at(-1);e.noLoot=true;e.reinforcement=n;e.cd=1.2;this.harden(e);});}
 raidStep(dt){const o=this.operation,living=this.enemies.filter(e=>e.hp>0&&!e.resident),d=Math.hypot(this.player.x-this.objective.x,this.player.z-this.objective.z);this.reinforceStep();
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
 step(dt,fire){if(this.operation.family==='base-defense'||this.operation.colony)this.defenseStep(dt);super.step(dt,fire);if(this.state!=='active')return;this.hazardStep(dt);if(this.playerHp<=0){this.state='defeat';this.reason='War Machine disabled by a telegraphed strike';return;}const o=this.operation,d=Math.hypot(this.player.x-this.objective.x,this.player.z-this.objective.z),living=this.enemies.filter(e=>e.hp>0&&(!e.resident||(['relay','redoubt'].includes(o.id)&&e.base?.id===o.site)));
 if(o.raid)this.raidStep(dt);if((o.family==='base-defense'||o.defense)&&!living.some(e=>!e.resident)){if(this.defenseWave<(this.waveMax||2))this.deployDefense();else this.state='victory';}
 if(o.family==='strike'){if(!living.length){if(this.strikeWave<2)this.deployStrike();else{this.stage=2;const hurt=this.playerHp<(this.coreHp??this.playerHp);this.coreHp=this.playerHp;if(d<8&&!hurt)this.work+=dt;else this.work=0;if(this.work>=STRIKE.channelMs/1000)this.state='victory';}}else{this.stage=this.strikeWave-1;this.work=0;this.coreHp=this.playerHp;}}
 if(o.id==='convoy'){const c=this.enemies.find(e=>e.id===this.carrierId);this.stage=c.hp<=0?1:0;if(c.hp>0&&c.z<o.z-135){this.state='defeat';this.reason='Armored carrier escaped';}else if(!living.length)this.state='victory';}
 if(o.id==='relay'){const relay=this.enemies.find(e=>e.id===this.relayId);this.stage=relay.hp<=0?1:0;if(this.stage&&!living.length&&d<12)this.work+=dt;if(this.work>=8&&!living.length)this.state='victory';}
 if(o.id==='recon'){const node=this.nodes[this.scans];if(node&&Math.hypot(this.player.x-node[0],this.player.z-node[1])<9){this.work+=dt;if(this.work>=3){this.scans++;this.work=0;}}this.stage=this.scans;if(this.scans===3)this.state='victory';}
 if(o.id==='rescue'){if(d<28){const q=W.advance({x:this.objective.x,z:this.objective.z,y:this.objective.y-2.2,surface:'ground'},0,dt*2);Object.assign(this.objective,{x:q.x,y:q.y+2.2,z:q.z});}this.stage=Math.min(100,Math.floor((this.objective.z-o.z)/.8));if(this.stage>=100)this.state='victory';}
 if(o.wingman){const dw=Math.hypot(this.player.x-o.x,this.player.z-o.z);this.stage=living.length?0:1;if(!living.length&&dw<8)this.work+=dt;else if(living.length)this.work=0;if(this.work>=4)this.state='victory';}   // only the pilot extracts
 if(o.id==='redoubt'){if(!living.length&&this.stage===0){this.stage=1;this.deploy('sentinel',o.x+12,o.z-8,'commander');this.enemies.at(-1).commander=true;}else if(!living.length&&this.stage===1&&d<18){this.work+=dt;if(this.work>=6){this.stage=2;this.state='victory';}}}
 if(Math.hypot(this.player.x-o.x,this.player.z-o.z)>260||this.time>600){this.state='defeat';this.reason='Operation perimeter abandoned or time expired';}
 if(this.state!=='active')this.projectiles=[];
 }
}
// Daily Command Base CP batch (shared so the MAP shows the Worker's exact figure).
function baseProduction(base,reputation=0){const b=base||{},m=b.modules||{};return b.tier?Math.min(800,40*b.tier+35*(m.reactor||0)+Math.floor(Math.sqrt(reputation||0))*3)*(1+.1*(m.uplink||0)):0;}
// Daily Base Yield (shared by the Worker and the HUD meter): two clocks, each filling over 24 h and stopping when full.
// claimedAt drives CP + materials; pointsAt drives the airdrop points part (it keeps filling while it waits for the day's
// first verified operation). Amounts are the full-day table x fill, rounded down; the Worker settles the same numbers.
function baseYield(base,reputation=0,now=Date.now()){const b=base||{},Y=CQ_YIELD,t=Math.max(0,Math.min(5,b.tier|0)),f=at=>Math.max(0,Math.min(1,(now-(Number(at)||0))/Y.day));
 if(!t)return {tier:0,fill:0,pointsFill:0,cp:0,alloy:0,biomass:0,helium:0,pts:0,full:false,min:Y.min};
 const fill=f(b.claimedAt),pointsFill=f(b.pointsAt??b.claimedAt);
 const sup0=1+Math.max(0,Math.min(.16,Number(b.sup)||0)),cpb=Math.max(0,Math.min(.45,Number(b.cpb)||0)),sup=sup0+cpb;   // Session 7 supply (js/conquest/war.js supply): held Frontier and Warfront territory, materials and CP only, never the points part; Session 7B: + 5% a Citadel tier cleared (b.cpb), the same rule
 return {tier:t,fill,pointsFill,cp:Math.floor(baseProduction(b,reputation)*fill*sup),alloy:Math.floor(Y.alloy[t]*fill*sup),biomass:Math.floor(Y.biomass[t]*fill*sup),helium:Math.floor(Y.helium[t]*fill*sup),pts:Math.floor(Y.pts[t]*pointsFill),full:fill>=1,min:Y.min,sup:sup0-1,cpb};}
// RECALL to the Command Base: a 15 s channel of simulated play that any damage breaks; 10 min cooldown, 5 min for
// premium Lunar Pass owners (entitlement read by the Worker from the account, never from the client).
const RECALL=freeze({channelMs:15000,cooldownMs:600000,premiumCooldownMs:300000});
// Owner rule: raids unlock only after the six opening field missions each have a verified clear.
const fieldMissionIds=freeze(Object.keys(operations).filter(id=>!operations[id].raid&&!operations[id].defense&&!operations[id].strike&&!operations[id].wingman&&!operations[id].citadel&&!operations[id].titan&&id!=='base-defense'));   // the six (the wingman's rescue is not one)
function fieldProgress(completed){return fieldMissionIds.filter(id=>completed?.[id]).length;}
function raidsUnlocked(completed){return fieldProgress(completed)>=fieldMissionIds.length;}
// Fast travel network, shared by client and Worker: the Refuge, the Command Base once built, and every frontier sector
// humanity holds. Departure needs a quiet spot inside one of those nodes; travel changes position only (cargo stays unbanked).
const TRAVEL={safeRadius:60,quietMs:10000},arrivals=new Map();
// Candidate arrival points per node: the authored spot first, then two rings inside the node, each on open, level footing.
function travelArrivals(id,x,z,radius){if(arrivals.has(id))return arrivals.get(id);const open=p=>!W.solidAt(p.x,p.z)&&[[2,0],[-2,0],[0,2],[0,-2]].every(([dx,dz])=>{const n=W.advance(p,dx,dz),f=W.speedFactor(p);return Math.hypot(n.x-p.x-dx*f,n.z-p.z-dz*f)<.1;});
 const near=(cx,cz)=>{for(let r=0;r<=12;r+=4)for(let i=0;i<(r?8:1);i++){const a=i*Math.PI/4,qx=cx+Math.cos(a)*r,qz=cz+Math.sin(a)*r,p={x:qx,z:qz,y:W.groundAt(qx,qz),surface:'ground'};if(open(p))return freeze(p);}return null;};
 const out=[near(x,z)];for(const ring of [Math.min(40,radius*.4),Math.min(80,radius*.75)])for(let i=0;i<8;i++){const a=i*Math.PI/4;out.push(near(x+Math.cos(a)*ring,z+Math.sin(a)*ring));}
 const list=freeze(out.filter(Boolean));arrivals.set(id,list);return list;}
function travelNodes(territory={},baseTier=0){const nodes=[{id:'refuge',name:'REFUGE SUPPLY',x:refuge.x,z:refuge.z,radius:45,arrivals:travelArrivals('refuge',refuge.x-6,refuge.z-8,24)}];
 if(baseTier>0)nodes.push({id:'base',name:'MY BASE',x:baseDefinition.x,z:baseDefinition.z,radius:45,arrivals:travelArrivals('base',baseDefinition.x,baseDefinition.z-10,24)});
 for(const s of sectors)if(s.id!=='refuge'&&territory?.[s.id]?.owner==='humanity')nodes.push({id:s.id,name:s.name,x:s.x,z:s.z,radius:s.radius,arrivals:travelArrivals(s.id,s.x,s.z,s.radius)});
 // The Refuge corridor is humanity's home sector: departing anywhere inside it counts as the Refuge network.
 const home=sectors.find(s=>s.id==='refuge');if(home)nodes.push({id:'refuge-corridor',name:home.name,x:home.x,z:home.z,radius:home.radius,departOnly:true});
 // The respawn point at the viaduct west ramp is the Refuge's front door: a freshly respawned pilot can depart from it.
 nodes.push({id:'refuge-viaduct',name:'REFUGE VIADUCT',x:898,z:1024,radius:45,departOnly:true});
 return nodes;}
// First candidate arrival with no live hostile within the safe radius (and outside the Command Base walls); null if none.
function travelArrival(node,enemies,blocked){return node?.arrivals?.find(p=>!blocked?.(p)&&!(enemies||[]).some(e=>e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<TRAVEL.safeRadius))||null;}
function travelNodeAt(state,p){return travelNodes(state?.territory,state?.base?.tier||0).find(n=>Math.hypot(p.x-n.x,p.z-n.z)<=n.radius)||null;}
function travelBlock(state,p,enemies,now){if(!state)return 'Online connection required';if(state.mission)return 'Finish or leave the operation first';if(!(state.hp>0))return 'Machine disabled';
 if((enemies||[]).some(e=>e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<TRAVEL.safeRadius))return 'Hostiles within 60 m — clear the area first';
 if(state.lastHitAt&&(state.quietMs||0)<TRAVEL.quietMs)return 'Under fire — hold 10 s without taking damage';
 if(!travelNodeAt(state,p))return 'Fast travel departs from the Refuge, your Command Base or a sector you hold';return null;}
// Session 6B zone bands (owner decision 6): the gear rating (POWER) a zone's authored threat asks for, shown on the region map and
// every briefing. Informational only: no enemy ever reads it (the 5D fair-world rule). A zone's band is its ring's authored tier
// (docs/conquest/CONQUEST_BLUEPRINT.md §5: Heartland and Rear STANDARD, Frontier the HARD sectors, Warfront the VETERAN sectors, the
// Inner Ring beyond them); a briefing shows its own operation's authored danger tier. The numbers are the kits that clear each tier in
// the scripted-pilot tests (dev/tests/conquest-raids.mjs: the stock tank, power 68, clears STANDARD and 8 of 10 HARD raids; an Epic
// kit, power 164, clears 13 of 15 VETERAN raids where the stock tank clears none). STANDARD starts at 55 so a brand-new account
// (power 59: no cores owned yet) reads as in band in the Heartland.
const DANGER_BAND=Object.freeze({STANDARD:Object.freeze([55,100]),HARD:Object.freeze([75,135]),VETERAN:Object.freeze([140,220])});
const RING_TIER=Object.freeze(['','STANDARD','STANDARD','HARD','VETERAN','VETERAN']);
const zoneBands=()=>Object.freeze(Object.fromEntries([1,2,3,4,5].map(r=>[r,DANGER_BAND[RING_TIER[r]]])));
const zoneBand=ring=>DANGER_BAND[RING_TIER[ring]]||DANGER_BAND.STANDARD;
const operationBand=o=>o&&DANGER_BAND[o.danger]?DANGER_BAND[o.danger]:zoneBand(o?W.ringAt(o.x,o.z):1);
root.ConquestCombat=Object.freeze({CAPS,ALLY,MILITIA,MILITIA_VET,ROLES,ROLE_ORDER,FORMS,ORDERS,allyLoadout,friendStats,friendUnit,DANGER_BAND,zoneBand,zoneBands,operationBand,hunter,LIVING,strikeSites,meteorStrike,waveKinds,baseProduction,baseYield,RECALL,raidDoctrine,refuge,fieldMissionIds,fieldProgress,raidsUnlocked,TRAVEL,travelNodes,travelNodeAt,travelBlock,travelArrival,sectorDefenseOpen,spawnIds,operations,droneDefinition,raidIds,raidLayouts,sectors,baseDefinition,baseBenefits,Operation,profiles,tracks,costs,tuningKeys,engineeringDefaults,engineeringValues,setHeat,mission,installations,patrols,archetypes,formations,Battle,Encounter,lineClear,blocked});
})(globalThis);
