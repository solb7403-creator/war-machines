/* Command Base town (Session 5B, docs/conquest/SESSION_05B_TOWN_DEFENSE_FULL_PROMPT.txt; Session 5 base builder before it):
   the shared, deterministic rules of a pilot's private town. The town grows with the Command Center (CC1 45x45 cells ->
   CC10 77x77, about 3x the area) on a fixed 79x79 grid of 4 m cells; seven site templates shape the whole defense; vital
   buildings (Command Center primary; Reactor, Storage Depot, Science Lab secondary) are the raiders' objectives; settler
   homes fill the districts as the town grows; walls are wall composite with an optional ore blend (strength, durability,
   reflectiveness); eleven turret types; a whole-town raid simulation (the Defense Drill now, async raids in Session 7).
   The phone uses it for build mode and previews; the Worker uses the same code to validate every action on the Worker clock
   (worker/src/conquest-plot.js). Nothing here grants anything. */
(function(root){
'use strict';
const SEC=1000,MIN=60000,HOUR=3600000,DAY=86400000;
const GRID=Object.freeze({n:79,cell:4,size:316});
const N=GRID.n,C=GRID.cell,MID=(N-1)/2,NN=N*N;
const cellX=i=>(i-MID)*C,cellZ=j=>(j-MID)*C,key=(i,j)=>i+','+j;
const hash=(a,b,c=0)=>{let h=2166136261^c;h=Math.imul(h^a,16777619);h=Math.imul(h^b,16777619);h^=h>>>13;h=Math.imul(h,1274126177);return ((h^h>>>16)>>>0)/4294967296;};
const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const T=o=>Object.freeze(o);
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);

// ---------------------------------------------------------------- town extent ----------------------------------------
// Half extent of the town square by Command Center level (CC1 45x45 ... CC10 77x77 cells). Raiders gather in the 1-cell
// ring just outside it, so the 79-cell grid always has room for that ring.
const TOWN=T([22,24,26,28,30,32,34,36,37,38]);
const clampCC=cc=>Math.max(1,Math.min(10,cc|0||1));
const townH=cc=>TOWN[clampCC(cc)-1];
const townSide=cc=>2*townH(cc)+1;
const cheb=(i,j)=>Math.max(Math.abs(i-MID),Math.abs(j-MID));
const inGrid=(i,j)=>Number.isInteger(i)&&Number.isInteger(j)&&i>=0&&j>=0&&i<N&&j<N;
const inTown=(cc,i,j)=>inGrid(i,j)&&cheb(i,j)<=townH(cc);

// ---------------------------------------------------------------- sites ----------------------------------------------
// Seven owner-approved site templates (Crater Rim, River Delta, Ridge, Canyon + Highland Plateau, Ice Basin, Ash Field).
// Each has a terrain template over the whole 79x79 grid and approach LANES: rays from the centre to an edge point; raiders
// enter where a lane crosses the ring just outside the current town, and natural barriers are carved open along a lane.
const L=(s,at,w=4)=>T({s,at,w});
const site=(o)=>T({alloy:1,biomass:1,helium:1,range:1,wallHp:1,power:1,...o,lanes:T(o.lanes)});
const SITES=T({
 crater:site({id:'crater',name:'CRATER RIM',bonus:'+15% alloy from Refineries and two rim deposits (Ferrite for your wallet). The crater rim is a natural inner wall with four passes.',short:'+15% ALLOY · RIM DEPOSITS',alloy:1.15,rimFe:true,lanes:[L('n',0),L('e',0),L('s',0),L('w',0)]}),
 delta:site({id:'delta',name:'RIVER DELTA',bonus:'+15% biomass from Biodomes. River channels split the town into islands joined by fords.',short:'+15% BIOMASS · FORDS',biomass:1.15,lush:true,lanes:[L('n',0),L('e',-.45),L('s',0),L('w',.35)]}),
 ridge:site({id:'ridge',name:'RIDGE',bonus:'+10% turret range from the high ground. Cliffs guard the lower west and south terraces.',short:'+10% TURRET RANGE',range:1.1,lanes:[L('n',.09),L('e',-.09),L('s',.55)]}),
 canyon:site({id:'canyon',name:'CANYON',bonus:'Hard to raid: only two narrow lanes along the canyon floor. Side ravines climb to the plateau.',short:'2 NARROW LANES',lanes:[L('s',0,2),L('n',.41,2)]}),
 plateau:site({id:'plateau',name:'HIGHLAND PLATEAU',bonus:'+12% wall strength on bedrock. A summit and an escarpment ring are natural walls, each with three ramps.',short:'+12% WALLS · 3 RAMPS',wallHp:1.12,lanes:[L('n',-.3,3),L('e',.3,3),L('s',-.6,3)]}),
 ice:site({id:'ice',name:'ICE BASIN',bonus:'+15% Helium-3. Frozen lakes cannot be built on and slow raiders to half speed: natural kill zones.',short:'+15% HELIUM-3 · SLOW ICE',helium:1.15,lanes:[L('n',.5),L('e',.5),L('s',-.5),L('w',-.5)]}),
 ash:site({id:'ash',name:'ASH FIELD',bonus:'+20% Reactor power from geothermal vents. Basalt ridges channel raiders, but five lanes make it the most open site.',short:'+20% POWER · 5 LANES',power:1.2,lanes:[L('n',0),L('e',-.7),L('s',.3),L('w',.6),L('w',-.5)]})
});
const SITE_IDS=Object.keys(SITES);
const siteOf=p=>SITES[p?.site]||SITES.ridge;
function laneEdge(q){const o=MID+q.at*MID;return q.s==='n'?[o,0]:q.s==='s'?[o,N-1]:q.s==='e'?[N-1,o]:[0,o];}
const LV={};
function laneVec(s){return LV[s]||(LV[s]=SITES[s].lanes.map(q=>{const [ex,ey]=laneEdge(q),dx=ex-MID,dy=ey-MID;return T({...q,dx,dy,len2:dx*dx+dy*dy,len:Math.hypot(dx,dy)});}));}
function corridor(s,i,j){const u=i-MID,v=j-MID;for(const q of laneVec(s)){const t=(u*q.dx+v*q.dy)/q.len2;if(t<.12||t>1.04)continue;if(Math.abs(u*q.dy-v*q.dx)/q.len<=q.w/2+.01)return q;}return null;}
// The cells where each lane's raiders gather this CC: the lane ray crossing the ring just outside the town.
function spawnCells(s,cc){const r=townH(cc)+1;return laneVec(s).map(q=>{const k=r/Math.max(Math.abs(q.dx),Math.abs(q.dy)),ci=Math.round(MID+q.dx*k),cj=Math.round(MID+q.dy*k),out=[];
 for(let o=-Math.floor(q.w/2);o<Math.ceil(q.w/2);o++){const i=q.s==='n'||q.s==='s'?ci+o:ci,j=q.s==='n'||q.s==='s'?cj:cj+o;if(inGrid(i,j))out.push([i,j]);}return out;});}

// ---------------------------------------------------------------- terrain --------------------------------------------
// Kinds: ground, lush, ash (buildable); pass (a lane carved through a barrier, buildable); ice (passable at half speed,
// not buildable); rim, cliff, water, rock, crevasse, vent, deposit (blocked).
const BLOCKED=T({rim:1,water:1,cliff:1,deposit:1,rock:1,crevasse:1,vent:1});
const NOBUILD=T({...BLOCKED,ice:1});
const SLOW=T({ice:.5});
const RIM_DEPOSITS=T([T({i:26,j:29}),T({i:52,j:50})]);
const segD=(u,v,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((u-a[0])*dx+(v-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(u-a[0]-dx*t,v-a[1]-dy*t);};
const ICE_CRACKS=[[[10,-30],[25,-12]],[[-35,-20],[-18,-28]],[[18,16],[31,31]],[[-30,25],[-12,34]]];
const zc=u=>7*Math.sin(u/7)+4;
function deltaWater(u,v){let d=Math.abs(v-zc(u)),wet=d<1.6&&![[-33,-30],[-12,-9],[9,12],[30,33]].some(([a,b])=>u>=a&&u<=b);
 if(u>=6){const db=Math.abs(v-(zc(u)+.85*(u-6)));if(u>=8&&db<1.3&&!(u>=19&&u<=22))wet=true;d=Math.min(d,db);}
 if(u<=-14){const dn=Math.abs(v-(zc(u)-.8*(-14-u)));if(u<=-16&&dn<1.3&&!(u>=-27&&u<=-24))wet=true;d=Math.min(d,dn);}
 return {d,wet};}
function baseTerrain(s,i,j){const u=i-MID,v=j-MID,r=Math.hypot(u,v);
 switch(s){
  case 'crater':if(RIM_DEPOSITS.some(d=>i>=d.i&&i<d.i+2&&j>=d.j&&j<d.j+2))return 'deposit';if(r>20.5&&r<24.5)return 'rim';if(r>=28&&hash(i>>1,j>>1,11)<.05)return 'rock';return 'ground';
  case 'delta':{const w=deltaWater(u,v);return w.wet?'water':w.d<6?'lush':'ground';}
  case 'ridge':if(u>=-22&&u<=-19&&!(v>=-28&&v<=-25)&&!(v>=25&&v<=28))return 'cliff';if(u>=-36&&u<=-34&&!(v>=-6&&v<=-3))return 'cliff';if(v>=19&&v<=22&&u>=-18&&!(u>=8&&u<=16))return 'cliff';return 'ground';
  case 'canyon':{const a=Math.abs(u);if(a>13&&a<=17&&!(u<0&&v>=-18&&v<=-15)&&!(u>0&&v>=10&&v<=13))return 'cliff';if(a<=13&&(v>=-22&&v<=-21||v>=22&&v<=23))return 'cliff';return 'ground';}
  case 'plateau':if(r>=8.5&&r<10||r>=20.5&&r<23)return 'cliff';if(r>=12&&r<19&&hash(i>>1,j>>1,23)<.06||r>=25&&hash(i>>1,j>>1,29)<.04)return 'rock';return 'ground';
  case 'ice':if(((u+14)/11)**2+((v-10)/8)**2<1||((u-22)/7)**2+((v+22)/5)**2<1)return 'ice';if(ICE_CRACKS.some(([a,b])=>segD(u,v,a,b)<.6))return 'crevasse';return 'ground';
  case 'ash':{if(r<9)return 'ash';const w=u*.6+v*.8,sv=-u*.8+v*.6,k=Math.floor((w+104)/13);if((w+104)%13<1.3&&hash(k,Math.floor((sv+104)/9),31)>=.3)return 'rock';
   const a=Math.round(u/11),b=Math.round(v/11),cx=a*11+Math.round((hash(a,b,41)-.5)*4),cz=b*11+Math.round((hash(b,a,43)-.5)*4);if((a||b)&&hash(a,b,37)<.35&&u>=cx&&u<cx+2&&v>=cz&&v<cz+2)return 'vent';return 'ash';}
 }return 'ground';}
const TER={};
function terrainMap(s){if(TER[s])return TER[s];const a=new Array(NN);for(let i=0;i<N;i++)for(let j=0;j<N;j++){let t=baseTerrain(s,i,j);if(BLOCKED[t]&&t!=='deposit'&&corridor(s,i,j))t='pass';a[i*N+j]=t;}return TER[s]=a;}
function terrainAt(s,i,j){if(!inGrid(i,j)||!SITES[s])return 'rim';return terrainMap(s)[i*N+j];}
// metres, for the look: buildable ground is flat within each terrace, barriers rise or fall between them
function heightAt(s,x,z){const i=x/C+MID,j=z/C+MID,u=i-MID,v=j-MID,r=Math.hypot(u,v),ri=Math.round(i),rj=Math.round(j),cor=inGrid(ri,rj)&&!!corridor(s,ri,rj);
 switch(s){
  case 'crater':return smooth((r-19.8)/2.2)*(1-smooth((r-23.4)/2.4))*7*(cor?.25:1)+smooth((r-24)/5)*1.2-smooth((14-r)/14)*1.2;
  case 'delta':return -smooth((2.2-deltaWater(u,v).d)/1.4)*1.4;
  case 'ridge':return -8*Math.max(smooth((-u-19)/3.2),smooth((v-18.6)/3.6)*smooth((u+21)/3))-8*smooth((-u-33.4)/2.8);
  case 'canyon':{const a=Math.abs(u);return 12*smooth((a-13.2)/3.8)+(a<=13.5?8*(smooth((v+23)/1.2)*(1-smooth((v+20.8)/1.2))+smooth((v-21.2)/1.2)*(1-smooth((v-23.6)/1.2)))*(cor?.15:1):0);}
  case 'plateau':return 5*smooth((22.6-r)/2.4)+4*smooth((10-r)/1.5);
  case 'ice':{const t=terrainAt(s,ri,rj);return t==='ice'?-.45:t==='crevasse'?-2.6:Math.sin(u*.3)*Math.cos(v*.27)*.25;}
  case 'ash':{const t=terrainAt(s,ri,rj);return t==='rock'?2.4:t==='vent'?1.1:0;}
 }return 0;}
const groundY=(s,i,j)=>heightAt(s,cellX(i),cellZ(j));

// ---------------------------------------------------------------- catalog --------------------------------------------
// Costs are per level (index 0 = level 1) and spend BANKED Conquest materials (cp/alloy/biomass/helium); mineral costs (fe,
// il, ar, tq, se, mh) spend the pilot's BASE STORES (minerals moved from the wallet with "MOVE TO BASE STORES"). Timers are on
// the Worker clock. Power: `pw` per level is the building's draw; the Command Center and Reactors supply power.
const CPS=['cp','alloy','biomass','helium'],MNS=['fe','il','ar','tq','se','mh'];
const TIME=[15*SEC,3*MIN,20*MIN,2*HOUR,6*HOUR],TIME3=[30*SEC,10*MIN,HOUR];
const grow=(base,g,levels)=>Array.from({length:levels},(_,l)=>Object.fromEntries(Object.entries(base).map(([k,v])=>[k,Math.round(v*Math.pow(g,l))])));
const tur=(o)=>T({w:1,d:1,max:5,...o,turret:T(o.turret)});
const BUILDINGS=T({
 refinery:T({n:'Refinery',w:3,d:4,max:5,cc:1,pw:2,count:[[1,1],[5,2],[9,3]],cost:grow({cp:60,alloy:4,biomass:2},2.4,5),prod:{alloy:.8},desc:'A conveyor feeds rock and scrap from your town to the smelter: alloy for your stores (no wallet minerals used).'}),
 storage:T({n:'Storage Depot',w:3,d:3,max:5,cc:1,pw:1,count:[[1,1]],cost:grow({cp:90,alloy:8},2.4,5),mod:'vault',vital:'secondary',desc:'Caps what production can hold (it stops when full). Bank salvage here. A vital: raiders target it.'}),
 reactor:T({n:'Reactor',w:3,d:3,max:5,cc:1,pw:0,count:[[1,1],[3,2],[5,3],[7,4],[9,5]],cost:grow({cp:140,alloy:8,helium:1},2.4,5),mod:'reactor',power:14,vital:'secondary',desc:'Power for every building and turret. Feeds Daily Base Yield CP. A vital: if it falls, turrets slow down.'}),
 foundry:T({n:'Foundry',w:3,d:3,max:5,cc:2,pw:2,count:[[2,1],[7,2]],cost:grow({cp:120,alloy:10},2.4,5),desc:'Load alloy and it becomes wall composite (4 composite per alloy). Its research earns wall extensions.'}),
 biodome:T({n:'Biodome',w:3,d:3,max:5,cc:2,pw:2,count:[[2,1],[6,2],[10,3]],cost:grow({cp:150,alloy:8,biomass:8},2.4,5),prod:{biomass:.6},desc:'Plants grow under the dome: biomass.'}),
 hangar:T({n:'Hangar',w:4,d:3,max:5,cc:2,pw:1,count:[[2,1]],cost:grow({cp:180,alloy:12},2.4,5),mod:'hangar',desc:'Your owned tanks on display. Repairs your hull at the base.'}),
 helium:T({n:'Helium Extractor',w:2,d:2,max:5,cc:3,pw:2,count:[[3,1],[7,2],[10,3]],cost:grow({cp:200,alloy:10,biomass:5},2.4,5),prod:{helium:.15},desc:'Draws Helium-3 out of the ground.'}),
 radar:T({n:'Radar',w:2,d:2,max:5,cc:3,pw:2,count:[[3,1]],cost:grow({cp:200,alloy:10,helium:2},2.4,5),mod:'radar',desc:'Longer SCAN pulses and real radar contacts in the field.'}),
 shield:T({n:'Shield Generator',w:2,d:2,max:5,cc:3,pw:3,count:[[3,1],[6,2],[9,3]],cost:grow({cp:240,alloy:14,helium:2},2.4,5),mod:'defense',desc:'Protective field: less damage at your base and in raids near it.'}),
 lab:T({n:'Science Lab',w:3,d:3,max:3,cc:3,pw:2,count:[[3,1]],cost:grow({cp:320,alloy:18,biomass:8,helium:3},2.4,3),time:TIME3,vital:'secondary',desc:'Built and upgradable now; its research tree (tank mods) is coming soon. A vital: raiders target it.'}),
 uplink:T({n:'Uplink',w:2,d:2,max:5,cc:4,pw:2,count:[[4,1]],cost:grow({cp:260,alloy:14,helium:3},2.4,5),mod:'uplink',desc:'+10% Daily Base Yield CP per level (up to III).'}),
 trophy:T({n:'Trophy Hall',w:3,d:3,max:3,cc:5,pw:1,count:[[5,1]],cost:grow({cp:300,alloy:16},2.4,3),time:TIME3,desc:'Defeated commanders, legendary minerals and future ladder trophies.'}),
 // Eleven turret types (owner decision 7), unlocked across CC levels so early choices stay simple. dt: damage type.
 cannon:tur({n:'Cannon Turret',cc:1,pw:1,role:'ALL-ROUND',turret:{range:28,dmg:34,rof:1.1,dt:'kin'},cost:grow({cp:70,alloy:5},2.4,5),desc:'Reliable kinetic turret: steady single shots at anything in range.'}),
 mg:tur({n:'Twin-Barrel MG',cc:1,pw:1,role:'VS SWARMS',turret:{range:22,dmg:7,rof:.14,dt:'kin',light:1.45},cost:grow({cp:80,alloy:5},2.4,5),desc:'Fast and light: shreds swarmlings, raiders and drones; weak against armor.'}),
 laser:tur({n:'Laser Turret',cc:2,pw:1,role:'FAST BEAM',turret:{range:24,dmg:9,rof:.25,dt:'en',light:1.2},cost:grow({cp:110,alloy:6,helium:1},2.4,5),desc:'Fast energy beam; melts light hulls.'}),
 rocket:tur({n:'Rocket Pod',cc:3,pw:1,role:'SALVO · AREA',turret:{range:30,dmg:18,salvo:4,rof:3.4,splash:3.5,ground:1,dt:'kin'},cost:grow({cp:140,alloy:8,helium:1},2.4,5),desc:'Four-rocket salvos that blanket an area: best against packs on the ground (it cannot track flyers).'}),
 missile:tur({n:'Missile Turret',cc:4,pw:1,role:'ANTI-AIR',turret:{range:36,dmg:55,rof:2,splash:3,airFirst:1,dt:'kin'},cost:grow({cp:160,alloy:8,helium:2},2.4,5),desc:'Anti-drone missiles; hits flyers first.'}),
 mortar:tur({n:'Mortar',cc:5,pw:1,role:'LONG SPLASH',turret:{range:44,min:10,dmg:46,rof:3,splash:6,ground:1,dt:'kin'},cost:grow({cp:190,alloy:10,helium:2},2.4,5),desc:'Long-range splash on the ground; cannot hit close targets or flyers.'}),
 flame:tur({n:'Flame Projector',cc:5,pw:1,role:'SHORT CONE · BURNS',turret:{range:13,dmg:5,rof:.2,cone:.38,burn:6,burnT:3,ground:1,light:1.3,dt:'fire'},cost:grow({cp:170,alloy:9,biomass:4},2.4,5),desc:'A short cone of fire: everything in front burns for 3 s. Put it where raiders bunch up.'}),
 siege:tur({n:'Heavy Siege Cannon',cc:6,pw:2,role:'VS ARMOR',turret:{range:34,dmg:240,rof:4.6,pierce:1,heavyFirst:1,ground:1,dt:'kin'},cost:grow({cp:260,alloy:16,helium:3},2.4,5),desc:'Slow, huge armor-piercing hits; aims at the toughest target in range.'}),
 tesla:tur({n:'Tesla Arc Coil',cc:7,pw:2,role:'CHAINS',turret:{range:18,dmg:30,rof:1.1,chain:4,jump:7,decay:.8,light:1.2,dt:'en'},cost:grow({cp:300,alloy:16,helium:4},2.4,5),desc:'Arcs jump between up to five nearby enemies.'}),
 lasercannon:tur({n:'Laser Cannon',cc:8,pw:2,role:'CHARGED BURST',turret:{range:34,dmg:210,rof:3.6,pierce:.5,dt:'en'},cost:grow({cp:340,alloy:18,helium:5},2.4,5),desc:'Charges, then fires one high-burst beam; half-ignores armor.'}),
 railgun:tur({n:'Railgun',cc:9,pw:2,role:'PIERCES A LINE',turret:{range:50,dmg:190,rof:5,line:1.4,pierce:1,dt:'kin'},cost:grow({cp:420,alloy:22,helium:6},2.4,5),desc:'A hypersonic slug through everything in a line, out to 50 m.'}),
 gate:T({n:'Gate',w:1,d:1,max:1,cc:3,pw:0,count:[[3,2],[5,4],[8,6],[10,8]],cost:[{cp:60,alloy:4}],time:[10*SEC],gate:true,desc:'A wall section your crews can open.'})
});
const TURRETS=Object.freeze(Object.keys(BUILDINGS).filter(k=>BUILDINGS[k].turret));
const TURRET_CAP=T([3,5,7,10,13,17,22,27,34,42]);
// Vitals (owner decision 2): the Command Center is the primary objective (destroyed = the raid wins); the secondary vitals
// cut that building's output when they fall (Reactor: power, so turrets slow down; Storage: the production store is exposed
// to raids from Session 7; Science Lab: research pauses, Session 6). Placed anywhere in the town.
const VITALS=T({cc:'primary',reactor:'secondary',storage:'secondary',lab:'secondary'});
const VITAL_EFFECT=T({cc:'the raid wins',reactor:'power cut: turrets fire slower, shields weaken',storage:'production store exposed (player raids will take a share)',lab:'research paused'});
// Command Center levels. The cumulative cost to CC3/5/7/9 equals the old Command Base II/III/IV/V costs, so the Conquest
// points multiplier (tier) arrives exactly as before.
const CC=T({max:10,claim:{cp:2550,alloy:110,biomass:65,helium:8},
 cost:[null,null,{cp:1800,alloy:50,biomass:30,helium:4},{cp:2700,alloy:110,biomass:65,helium:8},{cp:1700,alloy:100,biomass:60,helium:8},{cp:2500,alloy:150,biomass:90,helium:12},
  {cp:2600,alloy:150,biomass:95,helium:12},{cp:3900,alloy:230,biomass:145,helium:20},{cp:4000,alloy:220,biomass:140,helium:20},{cp:6000,alloy:330,biomass:210,helium:30},{cp:9000,alloy:500,biomass:320,helium:45,il:30,ar:6}],
 time:[0,0,30*SEC,3*MIN,10*MIN,30*MIN,HOUR,2*HOUR,3*HOUR,5*HOUR,8*HOUR],w:4,d:4});

// ---------------------------------------------------------------- walls ----------------------------------------------
// Walls are WALL COMPOSITE (1 a cell; every pilot starts with 200, the Foundry makes more) with an optional ORE BLEND per
// section: an ore and a level (light/medium/heavy). Strength (max HP), durability (damage reduction) and reflectiveness
// (share of incoming damage bounced back at the attacker) all scale with q = ore tier weight x blend weight, so they are
// monotonic in both. Moonheart heavy (q = 1): 5x composite HP, 40% damage reduction, 35% reflect.
const ORES=T(['fe','il','ar','tq','se','mh']);             // a blend's ore index o = 1..6
const ORE_NAME=T({fe:'Ferrite',il:'Ilmenite',ar:'Armalcolite',tq:'Tranquillityite',se:'Selenite',mh:'Moonheart'});
const ORE_CC=T([0,1,2,4,5,7,9]);                            // CC that unlocks blending with ore o
const TIER_W=T([0,.12,.25,.42,.6,.8,1]),BLEND_W=T([0,.4,.7,1]),BLEND_NAME=T(['NONE','LIGHT','MEDIUM','HEAVY']);
const ORE_UNITS=T([0,40,20,10,4,2,1]),BLEND_UNITS=T([0,1,2,4]);   // ore per cell = ORE_UNITS[o] x BLEND_UNITS[l] / 40
const COMPOSITE=T({hp:600,perCell:1,start:200,perAlloy:4,rate:5,cap0:400,capPer:300,hopperPer:30});
const WALL_CAP=T([600,756,911,1067,1222,1378,1533,1689,1844,2000]);
const wcode=(o,l)=>o?1+(o-1)*3+l:1;
const wdecode=c=>{c|=0;return c<=1?{o:0,l:0}:{o:Math.floor((c-2)/3)+1,l:(c-2)%3+1};};
const blendQ=(o,l)=>TIER_W[o]*BLEND_W[l];
function wallStats(c,s){const {o,l}=wdecode(c),q=blendQ(o,l),S=SITES[s]||SITES.ridge;return {o,l,q,hp:Math.round(COMPOSITE.hp*(1+4*q)*S.wallHp),dr:Math.round(40*q)/100,refl:Math.round(35*q)/100};}
const blendName=c=>{const {o,l}=wdecode(c);return o?ORE_NAME[ORES[o-1]]+' '+BLEND_NAME[l].toLowerCase():'Composite';};
// Wall extensions (owner decision 4): up to +50% of the level's base cap. Earned by Foundry research with rarer ores, Defense
// Drill milestones and real base defenses won; or bought (store, capacity only, disabled until payments are certified).
const EXT=T({max:50,research:T([T({pct:6,fl:1,cost:T({il:30})}),T({pct:6,fl:2,cost:T({ar:12})}),T({pct:6,fl:3,cost:T({ar:25})}),T({pct:6,fl:4,cost:T({tq:6})}),T({pct:6,fl:5,cost:T({se:2})})]),
 drill:T([T({cc:1,pct:4}),T({cc:3,pct:4}),T({cc:5,pct:4}),T({cc:7,pct:4}),T({cc:9,pct:4})]),defense:T([T({wins:3,pct:5}),T({wins:10,pct:5})]),pack:10});
// The base store (owner decision 11; MONEY RULE: what is sold and its limits are the owner's business decisions, changed here
// in this one table). Checkout stays DISABLED until payments are certified (Session 8): every tile shows as unavailable.
const STORE=T({checkout:false,items:T([
 T({id:'wall-ext-10',name:'Wall extension pack',what:'+10% wall capacity at your level (capacity only: strength still comes from composite and ore)',grants:T({extPct:10}),limit:'up to the +50% extension cap with earned ones',usd:2.99}),
 T({id:'skin-gilded',name:'Gilded wall skin',what:'cosmetic finish for walls (stats unchanged)',usd:4.99}),
 T({id:'skin-turret-neon',name:'Neon turret skins',what:'cosmetic finish for all eleven turrets',usd:4.99}),
 T({id:'foundry-rush',name:'Foundry speed-up',what:'the Foundry converts loaded alloy 4x faster for 24 h',usd:1.99}),
 T({id:'builder-2',name:'Second builder',what:'two constructions at once (an earnable second builder exists too)',usd:9.99}),
 T({id:'theme-aurora',name:'Aurora town lighting',what:'cosmetic town lighting',usd:3.99}),
 T({id:'layout-slot',name:'Extra layout slot',what:'a fourth saved town layout (walls, turrets, vitals)',usd:1.99})]),
 // Ores the store may sell (owner-adjustable default, RESOURCE_ECONOMY §9.1): common and uncommon only; rare-or-better earn-only.
 ores:T({fe:true,il:true,ar:false,tq:false,se:false,mh:false})});
const wallBase=cc=>WALL_CAP[clampCC(cc)-1];
function extParts(p,dev=false){const e=record(p?.ext)?p.ext:{},r=Math.max(0,Math.min(EXT.research.length,e.r|0)),dm=e.d|0,w=e.w|0,research=EXT.research.slice(0,r).reduce((a,x)=>a+x.pct,0),
 drill=EXT.drill.reduce((a,x,k)=>a+((dm>>k)&1?x.pct:0),0),defense=EXT.defense.reduce((a,x)=>a+(w>=x.wins?x.pct:0),0),bought=Math.max(0,e.buy|0),devx=dev||p?.devx?EXT.max:0;
 return {research,drill,defense,bought,dev:devx,total:Math.min(EXT.max,research+drill+defense+bought+devx)};}
const wallCap=cc=>wallBase(cc);
function wallCapOf(p,dev=false){const b=wallBase(p?.cc);return b+Math.floor(b*extParts(p,dev).total/100);}

// ---------------------------------------------------------------- state helpers --------------------------------------
// A town (plot v2): {v:2, site, cc, b:{id:{t,i,j,r,l}}, w:{"i,j":blend code}, n, job (one builder), st (production store),
// cm (wall composite), fh (alloy loaded in the Foundry), ext:{r research steps, d drill milestone bits, w defense wins},
// siteFree, siteAt, log:[raid results], mnSpent:{fe..} (base stores spent), banner, theme}
const levelCap=(type,cc)=>Math.min(type==='cc'?CC.max:BUILDINGS[type].max,type==='cc'?CC.max:Math.ceil(cc/2));
const countCap=(type,cc)=>{const B=BUILDINGS[type];if(!B||cc<B.cc)return 0;if(B.turret)return Infinity;let n=0;for(const [at,c] of B.count)if(cc>=at)n=c;return n;};
const tierOf=cc=>cc>0?Math.min(5,Math.ceil(cc/2)):0;   // the old Command Base tier (I..V): points multiplier, yield, travel
const costOf=(type,level)=>type==='cc'?CC.cost[level]:BUILDINGS[type].cost[level-1];
const timeOf=(type,level)=>type==='cc'?CC.time[level]:(BUILDINGS[type].time||TIME)[level-1];
const sizeOf=(type,r=0)=>{const B=type==='cc'?CC:BUILDINGS[type];return r%2?{w:B.d,d:B.w}:{w:B.w,d:B.d};};
function ccLevel(p){return p?.cc|0;}
function cells(b){const s=sizeOf(b.t,b.r|0),out=[];for(let a=0;a<s.w;a++)for(let c=0;c<s.d;c++)out.push([b.i+a,b.j+c]);return out;}
function occupancy(p,skip){const o=new Map();for(const [id,b] of Object.entries(p.b||{})){if(id===skip)continue;for(const [i,j] of cells(b))o.set(key(i,j),id);}for(const k of Object.keys(p.w||{}))if(!o.has(k))o.set(k,'wall');return o;}
function countOf(p,type){return Object.values(p.b||{}).filter(b=>b.t===type).length;}
function turretCount(p){return Object.values(p.b||{}).filter(b=>BUILDINGS[b.t]?.turret).length;}
// Levels count only once built; a building being upgraded keeps working at its old level.
function reactorPower(p,l){return BUILDINGS.reactor.power*l*siteOf(p).power;}
function powerSupply(p,alive=null){let s=12+3*ccLevel(p);for(const [id,b] of Object.entries(p.b||{}))if(b.t==='reactor'&&!ruined(p,id)&&(!alive||alive(id)))s+=reactorPower(p,b.l|0);return Math.round(s);}
function powerUse(p,extra=null){let u=0;for(const [id,b] of Object.entries(p.b||{})){const B=BUILDINGS[b.t];if(!B)continue;const l=extra&&extra.id===id?extra.l:b.l|0;u+=B.pw*l;}if(extra&&!extra.id)u+=BUILDINGS[extra.t].pw*extra.l;return u;}
function levelOf(p,type){let l=0;for(const b of Object.values(p.b||{}))if(b.t===type)l=Math.max(l,b.l|0);return l;}
function levelSum(p,type){let l=0;for(const [id,b] of Object.entries(p.b||{}))if(b.t===type&&!ruined(p,id))l+=b.l|0;return l;}
// Old Command Base modules derived from buildings (capped at III, as before): every old formula keeps working unchanged.
function modulesOf(p){const m={};for(const [type,B] of Object.entries(BUILDINGS))if(B.mod)m[B.mod]=Math.min(3,Object.entries(p.b||{}).reduce((a,[id,b])=>b.t===type&&!ruined(p,id)?Math.max(a,b.l|0):a,0));return m;}
// Storage caps: production stops when a material reaches its cap. Composite: the Foundry stops when the stock is full.
function caps(p){const d=Object.entries(p.b||{}).reduce((a,[id,b])=>b.t==='storage'&&!ruined(p,id)?Math.max(a,b.l|0):a,0);return {alloy:30+40*d,biomass:30+40*d,helium:8+10*d,fe:30,cm:COMPOSITE.cap0+COMPOSITE.capPer*levelSum(p,'foundry'),fh:COMPOSITE.hopperPer*levelSum(p,'foundry')};}
function rates(p){const S=siteOf(p),r={alloy:0,biomass:0,helium:0,fe:0,cm:0};
 for(const [id,b] of Object.entries(p.b||{})){const B=BUILDINGS[b.t];if(!B?.prod||!(b.l>0)||ruined(p,id))continue;for(const [k,v] of Object.entries(B.prod))r[k]+=v*b.l*(k==='alloy'?S.alloy:k==='biomass'?S.biomass:k==='helium'?S.helium:1);}
 if(S.rimFe&&ccLevel(p)>=1)r.fe+=3/24;   // two rim deposits: 3 Ferrite a day
 r.cm=COMPOSITE.rate*levelSum(p,'foundry');return r;}
// Production accrues continuously into the plot store (fractions kept), capped; collected inside the plot. The Foundry
// turns the alloy loaded into its hopper into composite at its rate, straight into the composite stock, up to its cap.
function accrue(p,now){const st=p.st||(p.st={alloy:0,biomass:0,helium:0,fe:0,at:now});const dt=Math.max(0,Math.min(7*DAY,now-(Number(st.at)||now)));
 if(dt>0){const r=rates(p),c=caps(p);for(const k of ['alloy','biomass','helium','fe']){const old=Number(st[k])||0;st[k]=Math.max(old,Math.min(c[k],old+r[k]*dt/HOUR));}   // a lower cap (a ruined Depot) stops production, never deletes what is stored
  const cm=Number(p.cm)||0,fh=Number(p.fh)||0,out=Math.max(0,Math.min(r.cm*dt/HOUR,fh*COMPOSITE.perAlloy,c.cm-cm));if(out>0){p.cm=cm+out;p.fh=Math.max(0,fh-out/COMPOSITE.perAlloy);}}
 st.at=now;return st;}
// Command Power: a visible score from building levels, wall strength and defenses.
function power(p){if(!p)return 0;let s=100*ccLevel(p);for(const b of Object.values(p.b||{})){const B=BUILDINGS[b.t];if(!B)continue;s+=(B.turret?30:B.gate?10:20)*(b.l|0)*(1+.15*((b.l|0)-1));}
 for(const c of Object.values(p.w||{})){const {o,l}=wdecode(c);s+=.5+6*blendQ(o,l);}return Math.round(s);}

// ---------------------------------------------------------------- settler homes --------------------------------------
// Settler lots fill the districts as the town grows (owner decision 1): a fixed lattice per site, each lot unlocking at the
// first CC whose town keeps it 3 cells inside the edge. A lot is lived in unless the pilot builds over it (homes never block
// the pilot: the settlers move out). Homes are real structures in a raid.
const HOME_KINDS=T(['dome','dome','dome','block','block','tower','green','market','dome','block','green','dome']);
const LOTS={};
function lotsOf(s){if(LOTS[s])return LOTS[s];const out=[];for(let a=-7;a<=7;a++)for(let b=-7;b<=7;b++){const ci=MID+a*5+Math.round((hash(a+9,b+9,51)-.5)*2),cj=MID+b*5+Math.round((hash(b+9,a+9,53)-.5)*2);
  const cl=[[ci,cj],[ci+1,cj],[ci,cj+1],[ci+1,cj+1]];if(Math.min(...cl.map(([i,j])=>cheb(i,j)))<=14)continue;if(cl.some(([i,j])=>!inGrid(i,j)||NOBUILD[terrainAt(s,i,j)]||corridor(s,i,j)))continue;
  const far=Math.max(...cl.map(([i,j])=>cheb(i,j)));let cc=0;for(let k=1;k<=10;k++)if(far<=townH(k)-3){cc=k;break;}if(!cc)continue;
  out.push(T({id:'h'+out.length,i:ci,j:cj,cc,k:HOME_KINDS[Math.floor(hash(a+9,b+9,57)*HOME_KINDS.length)],seed:Math.floor(hash(a+9,b+9,59)*1e6)}));}
 return LOTS[s]=T(out);}
function homes(p){const occ=occupancy(p),cc=ccLevel(p);return lotsOf(siteOf(p).id).filter(h=>h.cc<=cc&&!occ.has(key(h.i,h.j))&&!occ.has(key(h.i+1,h.j))&&!occ.has(key(h.i,h.j+1))&&!occ.has(key(h.i+1,h.j+1)));}

// ---------------------------------------------------------------- validation -----------------------------------------
// Placement: inside the town, on buildable terrain, no overlap with buildings or walls. Returns '' when valid, else why.
function placeError(p,type,i,j,r=0,skip=null){if(!Number.isInteger(i)||!Number.isInteger(j)||![0,1,2,3].includes(r))return 'invalid position';const s=sizeOf(type,r),occ=occupancy(p,skip),cc=ccLevel(p)||1;
 for(let a=0;a<s.w;a++)for(let c=0;c<s.d;c++){const x=i+a,z=j+c;if(!inGrid(x,z))return 'outside the plot';if(!inTown(cc,x,z))return 'outside the town (it grows with the Command Center)';if(NOBUILD[terrainAt(p.site,x,z)])return 'blocked ground';if(occ.has(key(x,z)))return 'occupied';}return '';}
// Everything a build or upgrade needs, checked in one place (Worker and phone).
function buildCheck(p,type,level,id=null){const cc=ccLevel(p);if(type==='cc'){if(level!==cc+1||level>CC.max)return 'command center at maximum';return '';}
 const B=BUILDINGS[type];if(!B)return 'unknown building';if(cc<B.cc)return 'unlocks at CC'+B.cc;if(level>levelCap(type,cc))return level>B.max?'maximum level':'needs CC'+(level*2-1);
 if(!id){if(B.turret?turretCount(p)>=TURRET_CAP[cc-1]:countOf(p,type)>=countCap(type,cc))return B.turret?'turret limit at CC'+cc+' ('+TURRET_CAP[cc-1]+')':'limit reached';}
 const use=powerUse(p,{id,t:type,l:level}),sup=powerSupply(p);if(type!=='reactor'&&use>sup)return 'not enough power ('+use+'/'+sup+')';return '';}

// ---------------------------------------------------------------- wall tools -----------------------------------------
// Shapes for the fast wall tools (owner decision 9): a solid (4-connected) line, a rectangle outline, a ring, or a list of
// cells (copy/paste). The Worker expands the same shapes, so a 600-cell ring is one small request.
const MAX_WALL_CELLS=1200,MAX_SECTIONS=12;
function line4(a,b){let [x,y]=a;const [x1,y1]=b,dx=Math.abs(x1-x),dy=Math.abs(y1-y),sx=x1>x?1:-1,sy=y1>y?1:-1,out=[[x,y]];   // grid walk: one axis step at a time
 for(let ix=0,iy=0;(ix<dx||iy<dy)&&out.length<=MAX_WALL_CELLS;){if((.5+ix)/dx<(.5+iy)/dy){x+=sx;ix++;}else{y+=sy;iy++;}out.push([x,y]);}return out;}
function rectCells(a,b){const i0=Math.min(a[0],b[0]),i1=Math.max(a[0],b[0]),j0=Math.min(a[1],b[1]),j1=Math.max(a[1],b[1]),out=[];
 for(let i=i0;i<=i1;i++){out.push([i,j0]);if(j1!==j0)out.push([i,j1]);}for(let j=j0+1;j<j1;j++){out.push([i0,j]);if(i1!==i0)out.push([i1,j]);}return out;}
function ringCells(c,e){const R=Math.round(Math.hypot(e[0]-c[0],e[1]-c[1]));if(R<1)return [[c[0],c[1]]];const n=Math.max(8,Math.ceil(R*8)),out=[],seen=new Set();let prev=null;
 const add=q=>{const k=q[0]+','+q[1];if(!seen.has(k)){seen.add(k);out.push(q);}};
 for(let k=0;k<=n;k++){const a=k/n*Math.PI*2,q=[c[0]+Math.round(Math.cos(a)*R),c[1]+Math.round(Math.sin(a)*R)];if(prev)for(const x of line4(prev,q))add(x);else add(q);prev=q;}return out;}
const pt=v=>Array.isArray(v)&&v.length===2&&Number.isInteger(v[0])&&Number.isInteger(v[1])&&v[0]>=0&&v[1]>=0&&v[0]<N&&v[1]<N;
function shapeCells(sec){if(!record(sec))return null;
 if(sec.k==='line'||sec.k==='rect'||sec.k==='ring'){if(!pt(sec.a)||!pt(sec.b))return null;if(sec.k==='ring'&&Math.hypot(sec.b[0]-sec.a[0],sec.b[1]-sec.a[1])>44)return null;return sec.k==='line'?line4(sec.a,sec.b):sec.k==='rect'?rectCells(sec.a,sec.b):ringCells(sec.a,sec.b);}
 if(sec.k==='cells'){const c=sec.c;if(!Array.isArray(c)||!c.length||c.length%2||c.length>2*MAX_WALL_CELLS||!c.every(x=>Number.isInteger(x)&&x>=0&&x<N))return null;const out=[];for(let k=0;k<c.length;k+=2)out.push([c[k],c[k+1]]);return out;}
 return null;}
const wallLine=line4;
// Everything a wall order needs, checked in one place: sections [{k,a,b|c,o,l}] -> the cells to build (new or re-blended),
// cells skipped (blocked ground, buildings, outside the town, already that blend), composite + ore cost, and why not.
// Later sections override earlier ones on the same cell (the draft order). Ore totals round up once per order.
function wallPlan(p,sections,opt={}){const cc=ccLevel(p);if(!Array.isArray(sections)||!sections.length||sections.length>MAX_SECTIONS)return {err:'invalid wall plan'};
 const want=new Map();let total=0;
 for(const sec of sections){if(!record(sec))return {err:'invalid wall plan'};const o=sec.o,l=sec.l;if(!Number.isInteger(o)||o<0||o>6||!Number.isInteger(l)||l<0||l>3||(o===0)!==(l===0))return {err:'invalid blend'};
  if(cc<ORE_CC[o])return {err:ORE_NAME[ORES[o-1]]+' blends unlock at CC'+ORE_CC[o]};const cl=shapeCells(sec);if(!cl)return {err:'invalid wall shape'};total+=cl.length;if(total>MAX_WALL_CELLS)return {err:'too many cells in one order (max '+MAX_WALL_CELLS+')'};
  const code=wcode(o,l);for(const [i,j] of cl)want.set(key(i,j),code);}
 const occ=occupancy(p),w=p.w||{},skip={outside:0,blocked:0,occupied:0,same:0},out=[],units=[0,0,0,0,0,0,0],stock={...stockOf(p)},used={};let fresh=0,stored=0;for(const v of Object.values(stock))stored+=Math.max(0,v|0);
 for(const [k,code] of want){const [i,j]=k.split(',').map(Number);if(!inTown(cc,i,j)){skip.outside++;continue;}if(NOBUILD[terrainAt(p.site,i,j)]){skip.blocked++;continue;}const o2=occ.get(k);if(o2&&o2!=='wall'){skip.occupied++;continue;}
  if((w[k]|0)===code){skip.same++;continue;}const isNew=!w[k];if(isNew&&(stock[code]|0)>0){stock[code]--;used[code]=(used[code]||0)+1;out.push({i,j,code,isNew,stock:1});continue;}if(isNew)fresh++;const {o,l}=wdecode(code);units[o]+=ORE_UNITS[o]*BLEND_UNITS[l];out.push({i,j,code,isNew});}
 const cost={};if(fresh)cost.cm=fresh*COMPOSITE.perCell;for(let o=1;o<=6;o++)if(units[o])cost[ORES[o-1]]=Math.ceil(units[o]/40);
 const have=Object.keys(w).length+stored,cap=wallCapOf(p,!!opt.dev),err=!out.length?'nothing to build: every cell is '+(skip.same?'already that blend':skip.occupied?'a building':skip.blocked?'blocked ground':'outside the town'):fresh&&have+fresh>cap?'wall limit at CC'+cc+': '+have+' + '+fresh+' > '+cap:'';   // re-blending existing cells never needs new capacity; stored cells already count
 return {cells:out,skip,cost,fresh,have,cap,err,used};}
function wallRemovePlan(p,sections){if(!Array.isArray(sections)||!sections.length||sections.length>MAX_SECTIONS)return {err:'invalid wall plan'};const w=p.w||{},out=new Set();let total=0;
 for(const sec of sections){const cl=shapeCells(sec);if(!cl)return {err:'invalid wall shape'};total+=cl.length;if(total>MAX_WALL_CELLS)return {err:'too many cells in one order'};for(const [i,j] of cl){const k=key(i,j);if(w[k])out.add(k);}}
 return out.size?{keys:[...out],err:''}:{keys:[],err:'no walls there'};}

// ---------------------------------------------------------------- creation -------------------------------------------
// Layout slots near the centre, tried in order with a spiral search (deterministic auto layout).
const HOME={cc:[37,37],storage:[31,38],refinery:[42,38],reactor:[37,32],foundry:[46,37],biodome:[37,42],hangar:[31,33],helium:[43,33],radar:[34,43],shield:[41,43],lab:[31,43],uplink:[44,43],trophy:[43,29]};
function autoPlace(p,type,r=0){const [hi,hj]=HOME[type]||[39,39];for(let rad=0;rad<40;rad++)for(let a=-rad;a<=rad;a++)for(const [i,j] of [[hi+a,hj-rad],[hi+a,hj+rad],[hi-rad,hj+a],[hi+rad,hj+a]]){if(!placeError(p,type,i,j,r))return {i,j,r};}return null;}
function newPlot(s,now){const p={v:2,site:SITES[s]?s:'ridge',cc:1,b:{},w:{},n:0,st:{alloy:0,biomass:0,helium:0,fe:0,at:now},cm:COMPOSITE.start,fh:0,ext:{r:0,d:0,w:0},log:[],mnSpent:{},siteFree:0,siteAt:0,at:now};
 const c=autoPlace(p,'cc');p.b.cc={t:'cc',i:c.i,j:c.j,r:0,l:1};const st=autoPlace(p,'storage');p.b['b'+(++p.n)]={t:'storage',i:st.i,j:st.j,r:0,l:1};return p;}
// Session 5B: no live players, so a Session 5 plot (v1) becomes a fresh town claim on the same site at the same Command
// Center level (tier, points multiplier and banked goods unchanged; banner and theme kept). Owner-approved, no migration.
function resetPlot(old,now){const p=newPlot(old?.site,now),cc=Math.max(1,Math.min(CC.max,old?.cc|0||1));p.cc=cc;p.b.cc.l=cc;p.siteFree=old?.siteFree?1:0;p.siteAt=Number(old?.siteAt)||0;
 if(old?.banner)p.banner=old.banner;if(old?.theme)p.theme=old.theme;p.mnSpent={...(record(old?.mnSpent)?old.mnSpent:{})};p.resetFrom={v:old?.v|0,at:now};return p;}
// Pre-plot saves: tier I..V becomes CC 1/3/5/7/9 (same points multiplier, yield and travel), every module becomes its
// building at the same level, a pending module build becomes the builder's job, banked goods and the yield clock stay.
function migrate(base,now){const t=Math.max(1,Math.min(5,base.tier|0)),p=newPlot('ridge',now);p.cc=2*t-1;p.b.cc.l=p.cc;p.migratedFrom={tier:t,modules:{...(base.modules||{})},at:now};
 const map={reactor:'reactor',hangar:'hangar',defense:'shield',vault:'storage',radar:'radar',uplink:'uplink'};
 for(const [m,type] of Object.entries(map)){const lvl=Math.max(0,Math.min(3,base.modules?.[m]|0));if(type==='storage'){p.b.b1.l=Math.max(1,lvl);continue;}if(!lvl)continue;const at=autoPlace(p,type);if(at)p.b['b'+(++p.n)]={t:type,...at,l:lvl};}
 if(base.pending&&map[base.pending.module]){const type=map[base.pending.module],want=Math.max(1,Math.min(3,base.pending.tier|0)),cur=Object.entries(p.b).find(([,b])=>b.t===type);let id=cur?.[0];if(!id){const at=autoPlace(p,type);if(at){id='b'+(++p.n);p.b[id]={t:type,...at,l:want-1};}}
  if(id&&(p.b[id].l|0)<want){p.b[id].l=want-1;p.job={id,t:type,l:want,at:now,ready:Math.max(now,Number(base.pending.readyAt)||now)};}}
 return p;}
// Finish the builder's job when its time is up (Worker clock).
function settle(p,now){if(p?.job&&now>=p.job.ready){const j=p.job;if(j.t==='repair'){accrue(p,j.ready);for(const [k,hp] of Object.entries(record(j.fix)?j.fix:{}))if(p.dmg?.[k]!==undefined){const d=(Number(p.dmg[k])||0)-(Number(hp)||0);if(d>0)p.dmg[k]=d;else delete p.dmg[k];}delete p.job;return j;}if(j.t==='cc'){accrue(p,j.ready);p.cc=j.l;p.b.cc.l=j.l;}else if(p.b[j.id]){accrue(p,j.ready);p.b[j.id].l=j.l;}delete p.job;return j;}return null;}

// ---------------------------------------------------------------- persistent damage, repair, rating, layouts, hooks ---
// Owner addendum (Nov 8): raid damage persists (raids, not the drill): p.dmg = {structure id: HP lost} (building ids and
// "w:i,j" wall cells). A structure at 0 HP is ruined: it does not block, fire or produce until repaired (a ruined Reactor
// gives no power, a ruined Storage Depot no capacity). REPAIR costs composite (walls) and alloy/CP (buildings) and builder
// time. The raid engine reads current HP; only raids write damage (applyRaidDamage, used by Session 7 async raids).
function maxHpOf(p,id){if(typeof id!=='string')return 0;if(id.startsWith('w:')){const c=p?.w?.[id.slice(2)];return c?wallStats(c,p.site).hp:0;}const b=p?.b?.[id];if(!b)return 0;return hpOfBuilding(b.t==='cc'?{...b,l:p.cc|0}:b);}
function hpLeft(p,id){const m=maxHpOf(p,id);return Math.max(0,m-Math.max(0,Number(p?.dmg?.[id])||0));}
function ruined(p,id){return !!p?.dmg&&maxHpOf(p,id)>0&&hpLeft(p,id)<=0;}
function repairPlan(p){let cm=0,alloy=0,cp=0,hp=0;const keys=[],fix={};for(const [id,d0] of Object.entries(p?.dmg||{})){const m=maxHpOf(p,id),d=Math.min(m,Math.max(0,Number(d0)||0));if(!m||!d)continue;keys.push(id);fix[id]=Math.round(d);hp+=d;const f=d/m;
  if(id.startsWith('w:'))cm+=f*COMPOSITE.perCell;else{const b=p.b[id],c=b.t==='cc'?(p.cc>1?CC.cost[p.cc]:CC.claim):costOf(b.t,Math.max(1,b.l|0))||{};alloy+=f*.3*(c.alloy||0);cp+=f*.2*(c.cp||0);}}
const cost={};if(cm)cost.cm=Math.ceil(cm);if(alloy)cost.alloy=Math.ceil(alloy);if(cp)cost.cp=Math.ceil(cp);return {keys,fix,hp:Math.round(hp),cost,ms:keys.length?Math.round(Math.min(2*HOUR,Math.max(10*SEC,hp/150*SEC))):0};}
// After a real raid (Session 7): write each structure's HP lost (the Command Center is never left below 1 HP) and an alert.
function applyRaidDamage(p,result,now,by='raider'){p.dmg=record(p.dmg)?p.dmg:{};for(const [id,lost] of Object.entries(result?.damage||{})){const m=maxHpOf(p,id);if(!m)continue;const d=Math.min(id==='cc'?m-1:m,Math.max(0,Math.round((Number(p.dmg[id])||0)+lost)));if(d>0)p.dmg[id]=d;}
 alert(p,{at:now,kind:'raid',by:String(by).slice(0,40),outcome:result?.outcome||'',changed:1});return p;}
// Attack alerts hook: (who, when, outcome) events for the Telegram bot (Session 7 sends them; sent stays 0 until then).
function alert(p,e){const all=[{...e,sent:e.kind==='raid'?0:1},...(Array.isArray(p.alerts)?p.alerts:Object.values(p.alerts||{})).filter(Boolean)],unsent=all.filter(x=>!x.sent).slice(0,20),sent=all.filter(x=>x.sent).slice(0,Math.max(3,10-unsent.length));p.alerts=all.filter(x=>unsent.includes(x)||sent.includes(x));return p;}   // drills are logged as already handled; unsent raid alerts are never pushed out by drills
// Loot protection hook (display now, Session 7 raids use it): banked goods are never raidable; of the town's production
// store and composite stock, the Storage Depot protects 25% + 10% a level (up to 75%).
function loot(p){const lv=Object.entries(p?.b||{}).reduce((a,[id,b])=>b.t==='storage'&&!ruined(p,id)?Math.max(a,b.l|0):a,0),protect=Math.min(.75,.25+.1*lv),st=p?.st||{},have={alloy:st.alloy||0,biomass:st.biomass||0,helium:st.helium||0,fe:st.fe||0,cm:p?.cm||0},raidable={},safe={};
 for(const [k,v] of Object.entries(have)){raidable[k]=Math.floor(v*(1-protect));safe[k]=Math.floor(v)-raidable[k];}return {protect,raidable,protected:safe};}
// DEFENSE RATING (raid matchmaking and Base of the Week later): wall strength (effective HP vs composite), turret firepower
// (dps x range), how well vitals are covered by turrets, and the Command Center level. Ruined structures do not count.
function defenseRating(p){if(!p)return 0;const S=siteOf(p);let walls=0,tur=0,cov=0,nv=0;const ts=[];for(const [k,c] of Object.entries(p.w||{})){if(ruined(p,'w:'+k))continue;const w=wallStats(c,S.id);walls+=w.hp/Math.max(.05,(1-w.dr)*(1-w.refl))/COMPOSITE.hp;}
 for(const [id,b] of Object.entries(p.b||{})){const B=BUILDINGS[b.t];if(!B?.turret||!(b.l>0)||ruined(p,id))continue;const T2=B.turret,l=b.l|0,range=T2.range*S.range*(1+.04*(l-1));tur+=T2.dmg*(1+.25*(l-1))*(T2.salvo||1)/T2.rof*range/28;ts.push({x:cellX(b.i),z:cellZ(b.j),r:range});}
 for(const b of Object.values(p.b||{})){if(!VITALS[b.t])continue;nv++;const sz=sizeOf(b.t,b.r|0),x=cellX(b.i)+(sz.w-1)*C/2,z=cellZ(b.j)+(sz.d-1)*C/2;cov+=Math.min(1,ts.filter(t=>Math.hypot(t.x-x,t.z-z)<=t.r).length/3);}
 return Math.round(walls*2+tur*1.5+(nv?cov/nv:0)*300+50*ccLevel(p));}
// Layout slots (3; a fourth is a store item, disabled): save walls, turrets and vitals positions; apply moves buildings and
// walls in one tap. Nothing is rebuilt or charged: walls are a stock of cells by blend, taken up and set down again; cells
// a layout has no room for stay in storage (placed again for free with the wall tools). Not while the town is damaged.
const LAYOUT=T({slots:3});
const B64='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function encWalls(w){let out='';for(const [k,c] of Object.entries(w||{})){const [i,j]=k.split(',').map(Number),n=i*N+j;out+=B64[(n>>12)&63]+B64[(n>>6)&63]+B64[n&63]+B64[c&63];}return out;}
function decWalls(str){const w={};if(typeof str!=='string'||str.length%4)return w;for(let k=0;k<str.length;k+=4){const v=[0,1,2,3].map(q=>B64.indexOf(str[k+q]));if(v.some(x=>x<0))return {};const n=(v[0]<<12)|(v[1]<<6)|v[2],i=Math.floor(n/N),j=n%N,c=v[3];if(inGrid(i,j)&&c>=1&&c<=19)w[i+','+j]=c;}return w;}
function layoutOf(p,now=0){return {at:now,cc:ccLevel(p),b:Object.fromEntries(Object.entries(p.b||{}).map(([id,b])=>[id,[b.i,b.j,b.r|0]])),w:encWalls(p.w)};}
function applyLayout(p,L){if(!record(L)||!record(L.b))return 'empty layout slot';if(repairPlan(p).keys.length)return 'repair your town first';
 const stock={...stockOf(p)};for(const c of Object.values(p.w||{}))stock[c|0]=(stock[c|0]||0)+1;
 const nb={};for(const [id,b] of Object.entries(p.b||{})){nb[id]={...b};const at=L.b[id];if(Array.isArray(at)&&p.job?.id!==id&&[0,1,2].every(k=>Number.isInteger(at[k])))Object.assign(nb[id],{i:at[0],j:at[1],r:((at[2]%4)+4)%4});}
 const q={...p,b:nb,w:{}};for(const id of Object.keys(nb)){const b=nb[id];if(placeError(q,b.t,b.i,b.j,b.r|0,id)){const rest={...q,b:Object.fromEntries(Object.entries(nb).filter(([k])=>k!==id))},at=autoPlace(rest,b.t,b.r|0)||autoPlace(rest,b.t,0);if(!at)return 'that layout no longer fits';Object.assign(b,at);}}
 const occ=occupancy(q),w={};for(const [k,c] of Object.entries(decWalls(L.w))){const [i,j]=k.split(',').map(Number);if((stock[c]|0)>0&&inTown(ccLevel(p),i,j)&&!NOBUILD[terrainAt(p.site,i,j)]&&!occ.has(k)){w[k]=c;stock[c]--;}}
 p.b=nb;p.w=w;p.ws=Object.fromEntries(Object.entries(stock).filter(([,n])=>n>0));return '';}
// Refund rules (owner addendum): removing a wall returns 50% of its composite and none of its ore; removing a turret returns
// 50% of what all its levels cost (materials and CP; minerals never). Rounded down, so splitting an order never gains.
function turretRefund(b){const B=BUILDINGS[b?.t];if(!B?.turret)return {};const sum={};for(let l=1;l<=(b.l|0);l++)for(const [k,v] of Object.entries(B.cost[l-1]||{}))if(!MNS.includes(k))sum[k]=(sum[k]||0)+v;return Object.fromEntries(Object.entries(sum).map(([k,v])=>[k,Math.floor(v/2)]).filter(([,v])=>v>0));}
const wallRefund=n=>Math.floor(n*COMPOSITE.perCell/2);
// Garrison hook (Session 7): defending tanks from the Hangar; one slot a Hangar level. Data only.
const stockOf=p=>{const w=p?.ws;if(Array.isArray(w))return Object.fromEntries(w.map((n,i)=>[String(i),n|0]).filter(([,n])=>n>0));return record(w)?Object.fromEntries(Object.entries(w).filter(([,n])=>(n|0)>0).map(([k,n])=>[k,n|0])):{};};   // Firebase returns numeric-keyed maps as arrays
const garrisonSlots=p=>Object.entries(p?.b||{}).reduce((a,[id,b])=>b.t==='hangar'&&!ruined(p,id)?a+(b.l|0):a,0);

// ---------------------------------------------------------------- raid simulation ------------------------------------
// The whole-town raid (owner decision 3): waves gather at the lanes just outside the town and path toward the Command
// Center through the cheapest route, where every structure's cost is its effective HP (walls weighted by strength,
// durability and reflect) and every cell's cost includes the turret threat covering it, so they break through the
// weakest wall. On the way they attack whatever blocks them and (raiders, swarmlings, sentinels) whatever is in reach:
// turrets, production, homes, vitals. Destroying the Command Center wins the raid; a fallen Reactor cuts power. Drones fly
// straight at turrets. Deterministic from (layout, seed, threat). The Defense Drill (no rewards) and async raids (Session 7)
// both use it. The flow field is a Dijkstra field with decrease-only updates (structures only fall during a raid).
const RAID=T({dt:.1,maxT:130,maxTPer:5,hpGrow:1.19,dmGrow:1.11,hpHome:260,breakRate:40,threatK:.008,kinds:T({
 raider:T({c:'r',hp:110,spd:6,dmg:14,rof:.8,range:3.5,light:1,opp:1}),
 swarm:T({c:'w',hp:34,spd:7.6,dmg:6,rof:.55,range:2.6,light:1,opp:1}),
 sentinel:T({c:'s',hp:420,spd:3.2,dmg:42,rof:1.4,range:4.2,armor:.3,opp:1,pref:1}),
 brute:T({c:'b',hp:1500,spd:2.3,dmg:110,rof:2.2,range:4.6,armor:.45,wall:1.8}),
 drone:T({c:'d',hp:70,spd:9,dmg:10,rof:.6,range:3,air:1,light:1})})});
const DRILL=RAID;
const KIND_IDS=Object.keys(RAID.kinds);
function drillWaves(t){const n=clampCC(t),w=[{at:2,raider:3+n,swarm:n>=2?2*n:0,sentinel:Math.floor(n/3),brute:0,drone:0},{at:24,raider:2+n,swarm:3*n,sentinel:1+Math.floor(n/2),brute:0,drone:Math.floor(n/2)},
 {at:48,raider:2+Math.ceil(1.2*n),swarm:2*n,sentinel:1+Math.floor(n/2),brute:n>=5?Math.floor((n-3)/2):0,drone:1+Math.floor(n/2)}];if(n>=6)w.push({at:74,raider:n,swarm:4*n,sentinel:n,brute:Math.floor(n/3),drone:n});return w;}
// A hit on a wall: the reflected share of the incoming damage goes back to the attacker; the rest is reduced by durability
// (and a Shield Generator's field) before it reaches the wall's HP.
function wallHit(w,dmg,shield=0){const reflected=dmg*(w.refl||0);return {reflected,taken:(dmg-reflected)*(1-(w.dr||0))*(1-shield)};}
function hpOfBuilding(b){if(b.t==='cc')return 1500+500*(b.l|0);const B=BUILDINGS[b.t];if(!B)return 500;if(B.turret)return Math.round((220+90*(b.l|0))*(B.pw>1?1.25:1));if(B.gate)return 900;return B.vital?700+250*(b.l|0):500+200*(b.l|0);}
// a tiny binary heap of (value, cell) for the flow field
function Heap(){const v=[],c=[];return {get size(){return v.length;},push(x,y){let k=v.length;v.push(x);c.push(y);while(k>0){const q=(k-1)>>1;if(v[q]<=x)break;v[k]=v[q];c[k]=c[q];k=q;}v[k]=x;c[k]=y;},
 pop(){const tv=v[0],tc=c[0],lv=v.pop(),lc=c.pop();if(v.length){let k=0;for(;;){let m=2*k+1;if(m>=v.length)break;if(m+1<v.length&&v[m+1]<v[m])m++;if(v[m]>=lv)break;v[k]=v[m];c[k]=c[m];k=m;}v[k]=lv;c[k]=lc;}return [tv,tc];}};}
// The simulation as a generator: the phone runs it in slices (no main-thread freeze), the Worker runs it to the end.
function drill(plot,seed=1,opt={}){const g=drillGen(plot,seed,opt);let r;do r=g.next();while(!r.done);return r.value;}
function* drillGen(plot,seed=1,opt={}){
 const p=plot,S=siteOf(p),sid=S.id,cc=clampCC(p.cc),h=townH(cc),threat=clampCC(opt.threat||cc),ter=terrainMap(sid),dt=RAID.dt,frames=[],events=[],keepF=opt.frames!==false,keepE=opt.events!==false;
 const rnd=(()=>{let s=(seed>>>0)||1;return ()=>{s=Math.imul(s^s>>>15,2246822507)^Math.imul(s^s>>>13,3266489909);s^=s>>>16;return (s>>>0)/4294967296;};})();
 const blk=new Int32Array(NN).fill(-1),structs=[],hpK=Math.pow(RAID.hpGrow,threat-1),dmK=Math.pow(RAID.dmGrow,threat-1);
 const addS=s=>{s.idx=structs.length;let x=0,z=0,x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const [i,j] of s.cells){blk[i*N+j]=s.idx;const cx=cellX(i),cz=cellZ(j);x+=cx;z+=cz;x0=Math.min(x0,cx-2);x1=Math.max(x1,cx+2);z0=Math.min(z0,cz-2);z1=Math.max(z1,cz+2);}
  s.x=x/s.cells.length;s.z=z/s.cells.length;s.x0=x0;s.x1=x1;s.z0=z0;s.z1=z1;s.eff=s.hp/Math.max(.05,(1-(s.dr||0))*(1-(s.refl||0)));structs.push(s);return s;};
 const left=(id,m)=>Math.max(0,m-Math.max(0,Number(p.dmg?.[id])||0));   // persistent raid damage: structures start at the HP they have
 for(const [id,b] of Object.entries(p.b||{})){const l=b.t==='cc'?cc:b.l|0;if(!(l>0))continue;const B=BUILDINGS[b.t],hp=hpOfBuilding({...b,l});addS({id,t:b.t,kind:b.t==='cc'?'core':B?.turret?'turret':'bld',hp:left(id,hp),max:hp,cells:cells(b),l,vital:VITALS[b.t]||''});}
 for(const [k,c] of Object.entries(p.w||{})){const [i,j]=k.split(',').map(Number);if(!inGrid(i,j)||blk[i*N+j]>=0)continue;const w=wallStats(c,sid),hp=left('w:'+k,w.hp);if(hp<=0)continue;addS({id:'w:'+k,t:'wall',kind:'wall',hp,max:w.hp,dr:w.dr,refl:w.refl,cells:[[i,j]],code:c|0});}
 for(const hm of homes(p))addS({id:hm.id,t:'home',kind:'home',hp:RAID.hpHome,max:RAID.hpHome,cells:[[hm.i,hm.j],[hm.i+1,hm.j],[hm.i,hm.j+1],[hm.i+1,hm.j+1]]});
 const core=structs.find(s=>s.kind==='core');if(!core)return {outcome:'no-command-center',frames:[],events:[],kills:0,lost:0,time:0,spawned:0,core:0,fell:[],vitals:[],breaches:[],wallsLost:0,homesLost:0,threat};
 const use=powerUse(p),reactors=new Set(structs.filter(s=>s.t==='reactor').map(s=>s.id));let pf=1;
 const repower=()=>{const sup=powerSupply(p,id=>reactors.has(id)&&structs.find(s=>s.id===id).hp>0);pf=use>0?Math.max(.35,Math.min(1,sup/use)):1;};
 const shields=structs.filter(s=>s.t==='shield').map(s=>({s,x:s.x,z:s.z,r:12+3*s.l,k:Math.min(.5,.1*s.l)}));
 const shieldK=(x,z)=>{let k=0;for(const q of shields)if(q.s.hp>0&&Math.hypot(q.x-x,q.z-z)<q.r)k=Math.max(k,q.k);return k*pf;};
 const turrets=structs.filter(s=>s.kind==='turret').map(s=>{const B=BUILDINGS[s.t].turret,l=s.l;return {s,type:s.t,B,range:B.range*S.range*(1+.04*(l-1)),min:B.min||0,dmg:B.dmg*(1+.25*(l-1)),cd:rnd()*B.rof*.5,kills:0,done:0};});
 // passable cells: inside the town or its gathering ring, not on a barrier
 const pass=new Uint8Array(NN),slow=new Float32Array(NN).fill(1);for(let i=0;i<N;i++)for(let j=0;j<N;j++){const c=i*N+j,t=ter[c];if(cheb(i,j)<=h+1&&!BLOCKED[t]){pass[c]=1;slow[c]=SLOW[t]||1;}}
 const threatMap=new Float32Array(NN),cover=t=>{const r=Math.ceil(t.range/C),ti=Math.round(t.s.x/C+MID),tj=Math.round(t.s.z/C+MID),out=[];for(let i=Math.max(0,ti-r);i<=Math.min(N-1,ti+r);i++)for(let j=Math.max(0,tj-r);j<=Math.min(N-1,tj+r);j++)if(Math.hypot(cellX(i)-t.s.x,cellZ(j)-t.s.z)<=t.range)out.push(i*N+j);return out;};
 for(const t of turrets){t.cells=cover(t);t.dps=t.s.hp>0?t.dmg*(t.B.salvo||1)/t.B.rof:0;for(const c of t.cells)threatMap[c]+=t.dps*RAID.threatK;}   // a ruined turret adds no threat
 const cost=c=>{const si=blk[c];let w=1/slow[c]+threatMap[c];if(si>=0){const s=structs[si];if(s.hp>0&&s!==core)w+=s.eff/RAID.breakRate;}return w;};
 const field=new Float64Array(NN).fill(Infinity),heap=Heap(),NB4=[[1,0],[-1,0],[0,1],[0,-1]],DX8=[1,-1,0,0,1,1,-1,-1],DZ8=[0,0,1,-1,1,-1,1,-1];let ver=0;
 const relax=()=>{while(heap.size){const [v,c]=heap.pop();if(v>field[c])continue;const i=(c/N)|0,j=c-i*N;for(const [a,b] of NB4){const x=i+a,z=j+b;if(x<0||z<0||x>=N||z>=N)continue;const n=x*N+z;if(!pass[n])continue;const nv=v+cost(n);if(nv<field[n]){field[n]=nv;heap.push(nv,n);}}}};
 for(const [i,j] of core.cells){field[i*N+j]=0;heap.push(0,i*N+j);}relax();
 const lowered=new Set();const lower=()=>{ver++;for(const c of lowered){if(!pass[c]||field[c]===0)continue;const i=(c/N)|0,j=c-i*N;let m=Infinity;for(const [a,b] of NB4){const x=i+a,z=j+b;if(x<0||z<0||x>=N||z>=N)continue;m=Math.min(m,field[x*N+z]);}const nv=m+cost(c);if(nv<field[c]){field[c]=nv;heap.push(nv,c);}}lowered.clear();relax();};
 const foes=[],fell=[],vitals=[],breach=[];let id=0,time=0,kills=0,done=false,homesLost=0,wallsLost=0,shots=0;
 const reach=(f,s)=>Math.hypot(Math.max(s.x0-f.x,0,f.x-s.x1),Math.max(s.z0-f.z,0,f.z-s.z1));
 const killFoe=f=>{if(f.hp<=0&&!f.dead){f.dead=true;f.hp=0;kills++;}};
 const destroy=s=>{s.hp=0;if(keepE)events.push({t:Math.round(time*10)/10,k:'destroyed',id:s.id});if(s===core){done=true;return;}
  if(s.kind==='wall'){wallsLost++;breach.push(s.cells[0]);}else if(s.kind==='home')homesLost++;else{fell.push({id:s.id,t:s.t});if(s.vital)vitals.push(s.t);}
  if(s.t==='reactor')repower();if(s.kind==='turret'){const t=turrets.find(q=>q.s===s);if(t)for(const c of t.cells){threatMap[c]-=t.dps*RAID.threatK;lowered.add(c);}}
  for(const [i,j] of s.cells)lowered.add(i*N+j);};
 const hurt=(s,dmg,f)=>{if(s.hp<=0)return;const k=shieldK(s.x,s.z);let taken=dmg*(1-k);if(s.kind==='wall'){const h2=wallHit(s,dmg,k);if(h2.reflected>0&&f){f.hp-=h2.reflected;killFoe(f);}taken=h2.taken;}s.hp-=taken;if(s.hp<=0)destroy(s);};
 const strike=(f,s)=>{if(f.cd>0)return;f.cd=f.K.rof;hurt(s,f.K.dmg*dmK*(s.kind==='wall'&&f.K.wall?f.K.wall:1),f);};
 const spawns=spawnCells(sid,cc);let laneK=0;
 const spawn=kind=>{for(let tries=0;tries<spawns.length;tries++){const cl=spawns[(laneK++)%spawns.length].filter(([i,j])=>isFinite(field[i*N+j])||RAID.kinds[kind].air);if(!cl.length)continue;const [i,j]=cl[Math.floor(rnd()*cl.length)],K=RAID.kinds[kind];
   foes.push({id:++id,kind,K,x:cellX(i)+(rnd()-.5)*2,z:cellZ(j)+(rnd()-.5)*2,hp:K.hp*hpK,max:K.hp*hpK,cd:rnd()*K.rof,burn:0,tgt:-1});return;}};
 const dmgTo=(t,f,base)=>{if(f.dead)return;const B=t.B,arm=f.K.armor||0,d=base*(f.K.light&&B.light?B.light:1)*(1-arm*(1-(B.pierce||0)));f.hp-=d;t.done+=Math.min(d,f.hp+d);killFoe(f);if(f.dead)t.kills++;};
 const shot=(t,x,z,extra)=>{shots++;if(keepE&&shots<=3000)events.push({t:Math.round(time*10)/10,k:'shot',from:t.s.id,ty:t.type,x:Math.round(x*10)/10,z:Math.round(z*10)/10,...(extra||{})});};
 const BK=10,bk=Array.from({length:BK*BK},()=>[]),bOf=v=>Math.max(0,Math.min(BK-1,Math.floor((v+160)/32)));
 const fire=(t,live)=>{const B=t.B;let best=null,bs=Infinity;const bx0=bOf(t.s.x-t.range),bx1=bOf(t.s.x+t.range),bz0=bOf(t.s.z-t.range),bz1=bOf(t.s.z+t.range);
  for(let bx=bx0;bx<=bx1;bx++)for(let bz=bz0;bz<=bz1;bz++)for(const f of bk[bx*BK+bz]){if(f.dead)continue;const d=Math.hypot(f.x-t.s.x,f.z-t.s.z);if(d>t.range||d<t.min)continue;const air=!!f.K.air;if(B.ground&&air)continue;const sc=B.heavyFirst?-f.hp:d-(B.airFirst&&air?100:0);if(sc<bs){bs=sc;best=f;}}
  if(!best)return false;const dx=best.x-t.s.x,dz=best.z-t.s.z,dist=Math.hypot(dx,dz)||1;
  if(B.salvo){for(let k=0;k<B.salvo;k++){const x=best.x+(rnd()-.5)*3.2,z=best.z+(rnd()-.5)*3.2;for(const f of live)if(!f.dead&&!f.K.air&&Math.hypot(f.x-x,f.z-z)<=B.splash)dmgTo(t,f,t.dmg);if(k===0)shot(t,x,z);}}
  else if(B.cone){for(const f of live){if(f.dead||f.K.air)continue;const fx=f.x-t.s.x,fz=f.z-t.s.z,d=Math.hypot(fx,fz);if(d>t.range||d<.1)continue;if(Math.acos(Math.max(-1,Math.min(1,(fx*dx+fz*dz)/(d*dist))))<=B.cone){dmgTo(t,f,t.dmg);f.burn=B.burnT;f.burnD=B.burn*(1+.25*(t.s.l-1));f.burnBy=t;}}shot(t,best.x,best.z);}
  else if(B.chain){let cur=best,dm=t.dmg;const hit=new Set([best]),pts=[[Math.round(best.x),Math.round(best.z)]];dmgTo(t,best,dm);for(let k=0;k<B.chain;k++){dm*=B.decay;let nx=null,nd=B.jump;for(const f of live)if(!f.dead&&!hit.has(f)){const d=Math.hypot(f.x-cur.x,f.z-cur.z);if(d<nd){nd=d;nx=f;}}if(!nx)break;hit.add(nx);dmgTo(t,nx,dm);pts.push([Math.round(nx.x),Math.round(nx.z)]);cur=nx;}shot(t,best.x,best.z,{ch:pts});}
  else if(B.line){const ux=dx/dist,uz=dz/dist;for(const f of live){if(f.dead)continue;const fx=f.x-t.s.x,fz=f.z-t.s.z,a=fx*ux+fz*uz;if(a<0||a>t.range)continue;if(Math.abs(fx*uz-fz*ux)<=B.line)dmgTo(t,f,t.dmg);}shot(t,t.s.x+ux*t.range,t.s.z+uz*t.range);}
  else{if(B.splash){for(const f of live)if(!f.dead&&(f===best||Math.hypot(f.x-best.x,f.z-best.z)<=B.splash)&&!(B.ground&&f.K.air))dmgTo(t,f,t.dmg);}else dmgTo(t,best,t.dmg);shot(t,best.x,best.z);}
  return true;};
 const airTarget=f=>{let best=null,bd=Infinity;for(const t of turrets)if(t.s.hp>0){const d=Math.hypot(t.s.x-f.x,t.s.z-f.z);if(d<bd){bd=d;best=t.s;}}if(best)return best;for(const s of structs)if(s.vital==='secondary'&&s.hp>0){const d=Math.hypot(s.x-f.x,s.z-f.z);if(d<bd){bd=d;best=s;}}return best||core;};
 const step=(f,tx,tz)=>{const d=Math.hypot(tx-f.x,tz-f.z)||1,ci=Math.max(0,Math.min(N-1,Math.round(f.x/C+MID))),cj=Math.max(0,Math.min(N-1,Math.round(f.z/C+MID))),v=f.K.spd*(f.K.air?1:slow[ci*N+cj])*dt;f.x+=(tx-f.x)/d*Math.min(d,v);f.z+=(tz-f.z)/d*Math.min(d,v);};
 const freeCell=c=>pass[c]&&(blk[c]<0||structs[blk[c]].hp<=0||structs[blk[c]]===core);
// opt.waves: a custom wave list for unit simulations (tests); the Worker and the phone always use drillWaves(threat)
 const waves=(Array.isArray(opt.waves)?opt.waves:drillWaves(threat)).map(w=>({...w})),solid=structs.filter(s=>s.kind!=='wall');repower();
 const steps=Math.round((opt.maxT||RAID.maxT+RAID.maxTPer*(threat-1))/dt);
 const every=opt.yieldEvery|0;
 for(let n=0;n<steps&&!done;n++){time=n*dt;if(every&&n&&n%every===0)yield n/steps;
  for(const w of waves)if(!w.done&&time>=w.at){w.done=true;for(const kind of KIND_IDS)for(let k=0;k<(w[kind]|0);k++)spawn(kind);}
  if(lowered.size&&n%5===0)lower();   // fallen structures update the field every 0.5 s (bounded work in raids where hundreds of cells fall)
  for(const f of foes){if(f.dead)continue;if(f.burn>0){f.burn-=dt;const bd=Math.min(f.hp,(f.burnD||0)*dt);f.hp-=bd;if(f.burnBy)f.burnBy.done+=bd;killFoe(f);if(f.dead){if(f.burnBy)f.burnBy.kills++;continue;}}f.cd=Math.max(0,f.cd-dt);const K=f.K;
   if(K.air){const s=airTarget(f);if(reach(f,s)<=K.range+1.5)strike(f,s);else step(f,s.x,s.z);if(done)break;continue;}
   if(reach(f,core)<=K.range+.5){strike(f,core);if(done)break;continue;}
   if(f.tgt>=0){const s=structs[f.tgt];if(s.hp>0&&reach(f,s)<=K.range+1){strike(f,s);continue;}f.tgt=-1;}
   const i=Math.max(0,Math.min(N-1,Math.round(f.x/C+MID))),j=Math.max(0,Math.min(N-1,Math.round(f.z/C+MID))),c=i*N+j;let bi=f.bi;
   if(f.cc!==c||f.ver!==ver){f.cc=c;f.ver=ver;bi=-1;let bv=field[c];for(let q=0;q<8;q++){const a=DX8[q],b=DZ8[q],x=i+a,z=j+b;if(x<0||z<0||x>=N||z>=N)continue;const nc=x*N+z;if(!pass[nc])continue;if(a&&b&&!(freeCell(x*N+j)&&freeCell(i*N+z)))continue;if(field[nc]<bv-1e-9){bv=field[nc];bi=nc;}}f.bi=bi;f.scan=0;}
   if(bi<0){step(f,core.x,core.z);continue;}
   const bs=blk[bi]>=0?structs[blk[bi]]:null;
   if(bs&&bs.hp>0&&bs!==core){if(reach(f,bs)<=K.range+.6)strike(f,bs);else step(f,cellX((bi/N)|0),cellZ(bi%N));continue;}
   if(K.opp&&f.scan--<=0){f.scan=4;let pick=-1,pd=Infinity;const r=K.pref?2:1;for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++){const x=i+a,z=j+b;if(x<0||z<0||x>=N||z>=N)continue;const si=blk[x*N+z];if(si<0)continue;const s=structs[si];if(s.hp<=0||s.kind==='wall'||s===core)continue;if(r===2&&s.kind!=='turret'&&(a<-1||a>1||b<-1||b>1))continue;const d=reach(f,s);if(d<=K.range+1&&d<pd){pd=d;pick=si;}}
    if(pick>=0){f.tgt=pick;strike(f,structs[pick]);continue;}}
   step(f,cellX((bi/N)|0),cellZ(bi%N));}
  if(done)break;
  const live=foes.filter(f=>!f.dead);for(const b of bk)b.length=0;for(const f of live)bk[bOf(f.x)*BK+bOf(f.z)].push(f);if(live.length)for(const t of turrets){if(t.s.hp<=0)continue;t.cd-=dt;if(t.cd>0)continue;if(fire(t,live))t.cd=t.B.rof/pf;else t.cd=0;}
  if(keepF&&n%5===0){const fs=[],ss=[];for(const f of live)if(!f.dead)fs.push([f.id,f.K.c,Math.round(f.x*10)/10,Math.round(f.z*10)/10]);for(const s of solid)if(s.hp<s.max&&ss.length<300)ss.push([s.id,Math.round(100*s.hp/s.max)]);frames.push({t:Math.round(time*10)/10,f:fs,s:ss});}
  if(waves.every(w=>w.done)&&foes.every(f=>f.dead))break;}
 // breach points: destroyed wall cells grouped by proximity
 const groups=[];for(const [i,j] of breach){const g=groups.find(q=>Math.max(Math.abs(q.i-i),Math.abs(q.j-j))<=3);if(g){g.n++;g.si+=i;g.sj+=j;g.i=Math.round(g.si/g.n);g.j=Math.round(g.sj/g.n);}else groups.push({i,j,n:1,si:i,sj:j});}
 const outcome=core.hp<=0?'breached':foes.some(f=>!f.dead)?'held':'repelled';
 const byTurret=Object.fromEntries(turrets.map(t=>[t.s.id,{t:t.type,kills:t.kills,dmg:Math.round(t.done)}]));
 const lostNow=opt.damage?Object.fromEntries(structs.filter(s=>s.kind!=='home').map(s=>[s.id,Math.round(left(s.id,s.max)-Math.max(0,s.hp))]).filter(([,v])=>v>0)):undefined;
 return {outcome,seed:seed>>>0,threat,byTurret,...(lostNow?{damage:lostNow}:{}),time:Math.round(time*10)/10,kills,spawned:id,lost:fell.length+homesLost,fell:fell.slice(0,40),vitals:[...new Set(vitals)],homesLost,wallsLost,breaches:groups.sort((a,b)=>b.n-a.n).slice(0,12).map(g=>[g.i,g.j,g.n]),
  core:Math.max(0,Math.round(100*core.hp/core.max)),power:Math.round(pf*100),frames:keepF?frames:[],events:keepE?events:[]};}

// Town names (Session 5C): up to 16 characters (letters, digits, spaces, apostrophes, dashes, dots), checked against a
// profanity list after folding case, spacing, repeated letters and common digit swaps. Empty = the default "<SITE> TOWN".
// The Worker validates every rename (plot-name); the phone shows the same verdict before sending.
const NAME_MAX=16;
const NAME_BAD=T(['fuck','shit','cunt','nigg','nigger','faggot','bitch','whore','slut','nazi','hitler','porn','pussy','asshole','bastard','retard','kike','twat','penis','vagina','jizz','dildo','molest']);
const NAME_BAD_WORD=T(['fag','rape','rapist','dick','tits','anal','sex','kkk','isis','spic','chink','hoe','ass','nig','nigga','coon','gook','cum','semen','anus','cock','wank','wanker','pedo','piss','boob','butt']);
function townName(raw){if(typeof raw!=='string')return {err:'invalid name'};const name=(raw.normalize?raw.normalize('NFKC'):raw).replace(/\s+/g,' ').trim();if(!name)return {ok:true,name:''};
 if(name.length>NAME_MAX)return {err:'up to '+NAME_MAX+' characters'};if(!/^[A-Za-z0-9 '.\-]+$/.test(name))return {err:'use letters, numbers, spaces, - and \' only'};
 const sw={0:'o',1:'i',3:'e',4:'a',5:'s',7:'t',8:'b'},low=name.toLowerCase().replace(/[0134578]/g,c=>sw[c]),fold=t=>t.replace(/(.)\1+/g,'$1'),raw2=low.replace(/[^a-z]/g,''),letters=fold(raw2),words=low.split(/[^a-z]+/).filter(Boolean);
 if(NAME_BAD.some(b=>raw2.includes(b)||fold(b).length>=4&&letters.includes(fold(b)))||words.some(w=>NAME_BAD_WORD.includes(w)||NAME_BAD_WORD.includes(fold(w))))return {err:'please pick another name'};
 return {ok:true,name};}
root.ConquestPlot=Object.freeze({NAME_MAX,townName,GRID,MID,TOWN,SITES,SITE_IDS,BUILDINGS,TURRETS,TURRET_CAP,VITALS,VITAL_EFFECT,CC,CPS,MNS,DRILL,RAID,RIM_DEPOSITS,BLOCKED,NOBUILD,SLOW,
 ORES,ORE_NAME,ORE_CC,TIER_W,BLEND_W,BLEND_NAME,ORE_UNITS,BLEND_UNITS,COMPOSITE,WALL_CAP,EXT,STORE,MAX_WALL_CELLS,MAX_SECTIONS,
 cellX,cellZ,key,hash,clampCC,townH,townSide,inTown,inGrid,cheb,terrainAt,heightAt,groundY,corridor,spawnCells,laneEdge,
 wallCap,wallBase,wallCapOf,extParts,wcode,wdecode,blendQ,wallStats,blendName,levelCap,countCap,tierOf,costOf,timeOf,sizeOf,cells,occupancy,countOf,turretCount,
 powerSupply,powerUse,levelOf,levelSum,modulesOf,caps,rates,accrue,power,lotsOf,homes,placeError,buildCheck,line4,rectCells,ringCells,shapeCells,wallLine,wallPlan,wallRemovePlan,
 autoPlace,newPlot,resetPlot,migrate,settle,drill,drillGen,raid:drill,drillWaves,hpOfBuilding,wallHit,
 maxHpOf,hpLeft,ruined,repairPlan,applyRaidDamage,alert,loot,defenseRating,LAYOUT,encWalls,decWalls,layoutOf,applyLayout,turretRefund,wallRefund,garrisonSlots,stockOf,SEC,MIN,HOUR,DAY});
})(globalThis);
