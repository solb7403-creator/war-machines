/* Command Base plot (Session 5, docs/conquest/SESSION_05_BASE_BUILDER_FULL_PROMPT.txt): the shared, deterministic rules of a
   pilot's private base plot. Sites and their terrain, the build grid, buildings with levels/costs/timers/power/production/
   storage caps, walls and turrets, unlocks by Command Center level, Command Power, the migration from the old Command Base
   tiers/modules, and the Defense Drill simulation. The phone uses it for build mode and previews; the Worker uses the same
   code to validate every action on the Worker clock (worker/src/conquest-plot.js). Nothing here grants anything. */
(function(root){
'use strict';
const SEC=1000,MIN=60000,HOUR=3600000,DAY=86400000;
const GRID=Object.freeze({n:45,cell:4,size:180});
const N=GRID.n,C=GRID.cell,MID=(N-1)/2;
const cellX=i=>(i-MID)*C,cellZ=j=>(j-MID)*C,key=(i,j)=>i+','+j;
const hash=(a,b,c=0)=>{let h=2166136261^c;h=Math.imul(h^a,16777619);h=Math.imul(h^b,16777619);h^=h>>>13;h=Math.imul(h,1274126177);return ((h^h>>>16)>>>0)/4294967296;};
const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);

// ---------------------------------------------------------------- sites ----------------------------------------------
// Four owner-approved site types. Each has a terrain template (height, blocked ground) and approach LANES: the edge
// openings attackers use (Defense Drill now; async raids in Session 7). Canyon has fewer and narrower lanes.
const SITES=Object.freeze({
 crater:Object.freeze({id:'crater',name:'CRATER RIM',bonus:'+15% alloy from the Refinery and rim deposits on the plot (Ferrite for your wallet)',short:'+15% ALLOY · RIM DEPOSITS',alloy:1.15,biomass:1,range:1,rimFe:true,
  lanes:[{i:22,j:0,w:4},{i:44,j:22,w:4},{i:22,j:44,w:4},{i:0,j:22,w:4}]}),
 delta:Object.freeze({id:'delta',name:'RIVER DELTA',bonus:'+15% biomass from the Biodome; water and lush ground',short:'+15% BIOMASS · LUSH GROUND',alloy:1,biomass:1.15,range:1,lush:true,
  lanes:[{i:22,j:0,w:4},{i:44,j:12,w:4},{i:22,j:44,w:4},{i:0,j:30,w:4}]}),
 ridge:Object.freeze({id:'ridge',name:'RIDGE',bonus:'+10% turret range; long sightlines from the high ground',short:'+10% TURRET RANGE',alloy:1,biomass:1,range:1.1,
  lanes:[{i:24,j:0,w:4},{i:44,j:20,w:4},{i:34,j:44,w:4}]}),
 canyon:Object.freeze({id:'canyon',name:'CANYON',bonus:'Hard to raid: only two narrow approach lanes',short:'2 NARROW LANES',alloy:1,biomass:1,range:1,
  lanes:[{i:22,j:44,w:2},{i:31,j:0,w:2}]})
});
const SITE_IDS=Object.keys(SITES);
// Terrain kind of a cell for a site: 'ground', 'lush', 'rim' (raised, blocked), 'water' (blocked), 'cliff' (blocked),
// 'deposit' (crater rim deposit, blocked), 'lane' (open approach, buildable). Pure function of the site.
function laneAt(site,i,j){for(const L of SITES[site].lanes){const h=L.w/2;if(L.j===0||L.j===N-1){if(Math.abs(i-L.i)<h+.01&&Math.abs(j-L.j)<=4)return L;}else if(Math.abs(j-L.j)<h+.01&&Math.abs(i-L.i)<=4)return L;}return null;}
const RIM_DEPOSITS=Object.freeze([{i:9,j:12},{i:35,j:33}]);
function terrainAt(site,i,j){
 if(i<0||j<0||i>=N||j>=N)return 'rim';const lane=laneAt(site,i,j),edge=Math.min(i,j,N-1-i,N-1-j);
 if(site==='crater'){const r=Math.hypot(i-MID,j-MID);if(RIM_DEPOSITS.some(d=>i>=d.i&&i<d.i+2&&j>=d.j&&j<d.j+2))return 'deposit';if(lane)return 'lane';if(r>20.5||edge<2)return 'rim';return 'ground';}
 if(site==='delta'){const zc=MID+7*Math.sin((i-MID)/7)+4,wet=Math.abs(j-zc)<1.6&&!(i>=10&&i<=13)&&!(i>=31&&i<=34);if(lane)return 'lane';if(edge<1)return 'rim';if(wet)return 'water';return Math.abs(j-zc)<6?'lush':'ground';}
 if(site==='ridge'){if(lane)return 'lane';if(i<4||j>N-5&&!(i>=30&&i<=38))return 'cliff';if(edge<1)return 'rim';return 'ground';}
 if(site==='canyon'){if(lane)return 'lane';if(i<9||i>N-10||j<2||j>N-2)return 'cliff';return 'ground';}
 return 'ground';}
const BLOCKED={rim:1,water:1,cliff:1,deposit:1};
function heightAt(site,x,z){// metres, for the plot's look (the grid itself is flat ground at y=0 where buildable)
 const i=x/C+MID,j=z/C+MID,edge=Math.min(i,j,N-1-i,N-1-j);
 if(site==='crater'){const r=Math.hypot(i-MID,j-MID);return smooth((r-19)/5)*7*(laneAt(site,Math.round(i),Math.round(j))?.25:1)-smooth((14-r)/14)*1.2;}
 if(site==='delta'){const zc=MID+7*Math.sin((i-MID)/7)+4,d=Math.abs(j-zc);return -smooth((2.2-d)/1.4)*1.4+smooth((2-edge)/2)*1.5;}
 if(site==='ridge'){return -smooth((5-i)/3)*9-smooth((j-(N-6))/3)*9*(i>=30&&i<=38?.15:1)+smooth((3-edge)/3)*.6;}
 if(site==='canyon'){const w=Math.min(i-8,N-9-i);return smooth((1.5-w)/2)*16+smooth((2.5-j)/2)*14+smooth((j-(N-2.5))/2)*10*(Math.abs(i-22)<2?0:1);}
 return 0;}

// ---------------------------------------------------------------- catalog --------------------------------------------
// Costs are per level (index 0 = level 1) and spend BANKED Conquest materials (cp/alloy/biomass/helium); mineral costs (fe,
// il, ar, se, mh) spend the pilot's BASE STORES (minerals moved from the wallet with "MOVE TO BASE STORES"). Timers are on
// the Worker clock. Power: `pw` per level is the building's draw; the Command Center and Reactors supply power.
const CPS=['cp','alloy','biomass','helium'],MNS=['fe','il','ar','tq','se','mh'];
const TIME=[15*SEC,3*MIN,20*MIN,2*HOUR,6*HOUR],TIME3=[30*SEC,10*MIN,HOUR];
const grow=(base,g,levels)=>Array.from({length:levels},(_,l)=>Object.fromEntries(Object.entries(base).map(([k,v])=>[k,Math.round(v*Math.pow(g,l))])));
const T=(o)=>Object.freeze(o);
const BUILDINGS=T({
 refinery:T({n:'Refinery',w:3,d:4,max:5,cc:1,pw:2,count:[[1,1],[7,2]],cost:grow({cp:60,alloy:4,biomass:2},2.4,5),prod:{alloy:.8},desc:'Conveyor feeds scrap and ore to the smelter: alloy for your stores.'}),
 storage:T({n:'Storage Depot',w:3,d:3,max:5,cc:1,pw:1,count:[[1,1]],cost:grow({cp:90,alloy:8},2.4,5),mod:'vault',desc:'Caps what production can hold (it stops when full). Bank salvage here.'}),
 reactor:T({n:'Reactor',w:3,d:3,max:5,cc:1,pw:0,count:[[1,1],[6,2]],cost:grow({cp:140,alloy:8,helium:1},2.4,5),mod:'reactor',power:14,desc:'Power for every building. Feeds Daily Base Yield CP.'}),
 biodome:T({n:'Biodome',w:3,d:3,max:5,cc:2,pw:2,count:[[2,1],[8,2]],cost:grow({cp:150,alloy:8,biomass:8},2.4,5),prod:{biomass:.6},desc:'Plants grow under the dome: biomass.'}),
 hangar:T({n:'Hangar',w:4,d:3,max:5,cc:2,pw:1,count:[[2,1]],cost:grow({cp:180,alloy:12},2.4,5),mod:'hangar',desc:'Your owned tanks on display. Repairs your hull at the base.'}),
 helium:T({n:'Helium Extractor',w:2,d:2,max:5,cc:3,pw:2,count:[[3,1],[8,2]],cost:grow({cp:200,alloy:10,biomass:5},2.4,5),prod:{helium:.15},desc:'Helium-3 from the regolith.'}),
 radar:T({n:'Radar',w:2,d:2,max:5,cc:3,pw:2,count:[[3,1]],cost:grow({cp:200,alloy:10,helium:2},2.4,5),mod:'radar',desc:'Longer SCAN pulses and real radar contacts in the field.'}),
 shield:T({n:'Shield Generator',w:2,d:2,max:5,cc:3,pw:3,count:[[3,1],[7,2]],cost:grow({cp:240,alloy:14,helium:2},2.4,5),mod:'defense',desc:'Protective field: less damage at your base and in the Defense Drill.'}),
 lab:T({n:'Science Lab',w:3,d:3,max:3,cc:3,pw:2,count:[[3,1]],cost:grow({cp:320,alloy:18,biomass:8,helium:3},2.4,3),time:TIME3,desc:'Built and upgradable now. Its research tree (tank mods) arrives in Session 6.'}),
 uplink:T({n:'Uplink',w:2,d:2,max:5,cc:4,pw:2,count:[[4,1]],cost:grow({cp:260,alloy:14,helium:3},2.4,5),mod:'uplink',desc:'+10% Daily Base Yield CP per level (up to III).'}),
 trophy:T({n:'Trophy Hall',w:3,d:3,max:3,cc:5,pw:1,count:[[5,1]],cost:grow({cp:300,alloy:16},2.4,3),time:TIME3,desc:'Defeated commanders, legendary minerals and future ladder trophies.'}),
 cannon:T({n:'Cannon Turret',w:1,d:1,max:5,cc:1,pw:1,turret:{range:28,dmg:34,rof:1.1,splash:0},cost:grow({cp:70,alloy:5},2.4,5),desc:'Reliable kinetic turret.'}),
 laser:T({n:'Laser Turret',w:1,d:1,max:5,cc:2,pw:1,turret:{range:24,dmg:9,rof:.25,splash:0},cost:grow({cp:110,alloy:6,helium:1},2.4,5),desc:'Fast beam; melts light hulls.'}),
 missile:T({n:'Missile Turret',w:1,d:1,max:5,cc:4,pw:1,turret:{range:36,dmg:55,rof:2,splash:3,air:true},cost:grow({cp:160,alloy:8,helium:2},2.4,5),desc:'Anti-drone missiles; hits flyers first.'}),
 mortar:T({n:'Mortar',w:1,d:1,max:5,cc:5,pw:1,turret:{range:44,min:10,dmg:46,rof:3,splash:6},cost:grow({cp:190,alloy:10,helium:2},2.4,5),desc:'Long-range splash; cannot hit close targets.'}),
 gate:T({n:'Gate',w:1,d:1,max:1,cc:4,pw:0,count:[[4,2],[8,4]],cost:[{cp:60,alloy:4}],time:[10*SEC],gate:true,desc:'A wall section your crews can open.'})
});
const TURRETS=Object.freeze(Object.keys(BUILDINGS).filter(k=>BUILDINGS[k].turret));
const TURRET_CAP=[2,4,5,6,8,9,10,12,14,16];
// Command Center levels. Reaching a level costs its row. The cumulative cost to CC3/5/7/9 equals the old Command Base
// II/III/IV/V costs, so the Conquest points multiplier (tier) arrives exactly as before; CC2/4/6/8/10 are new steps.
const CC=Object.freeze({max:10,claim:{cp:2550,alloy:110,biomass:65,helium:8},
 cost:[null,null,{cp:1800,alloy:50,biomass:30,helium:4},{cp:2700,alloy:110,biomass:65,helium:8},{cp:1700,alloy:100,biomass:60,helium:8},{cp:2500,alloy:150,biomass:90,helium:12},
  {cp:2600,alloy:150,biomass:95,helium:12},{cp:3900,alloy:230,biomass:145,helium:20},{cp:4000,alloy:220,biomass:140,helium:20},{cp:6000,alloy:330,biomass:210,helium:30},{cp:9000,alloy:500,biomass:320,helium:45,il:30,ar:6}],
 time:[0,0,30*SEC,3*MIN,10*MIN,30*MIN,HOUR,2*HOUR,3*HOUR,5*HOUR,8*HOUR],w:4,d:4});
// Walls: drag-to-draw cells. Tiers look visibly different and cost minerals from the base stores (the regolith tier also CP).
const WALLS=Object.freeze([null,
 T({id:'regolith',n:'Regolith wall',cc:1,hp:400,cost:{cp:5,fe:2}}),
 T({id:'titanium',n:'Titanium wall',cc:2,hp:900,cost:{alloy:2,il:1}}),
 T({id:'armalcolite',n:'Armalcolite wall',cc:5,hp:1600,cost:{alloy:3,ar:1}}),
 T({id:'selenite',n:'Selenite glass wall',cc:7,hp:2400,reflect:.3,cost:{alloy:4,se:1}}),
 T({id:'moonheart',n:'Moonheart wall',cc:9,hp:3500,reflect:.3,cost:{alloy:5,mh:1}})]);
const wallCap=cc=>24+16*cc;
const levelCap=(type,cc)=>Math.min(type==='cc'?CC.max:BUILDINGS[type].max,type==='cc'?CC.max:Math.ceil(cc/2));
const countCap=(type,cc)=>{const B=BUILDINGS[type];if(!B||cc<B.cc)return 0;if(B.turret)return Infinity;let n=0;for(const [at,c] of B.count)if(cc>=at)n=c;return n;};
const tierOf=cc=>cc>0?Math.min(5,Math.ceil(cc/2)):0;   // the old Command Base tier (I..V) that drives the points multiplier, yield and travel
const costOf=(type,level)=>type==='cc'?CC.cost[level]:BUILDINGS[type].cost[level-1];
const timeOf=(type,level)=>type==='cc'?CC.time[level]:(BUILDINGS[type].time||TIME)[level-1];
const sizeOf=(type,r=0)=>{const B=type==='cc'?CC:BUILDINGS[type];return r%2?{w:B.d,d:B.w}:{w:B.w,d:B.d};};

// ---------------------------------------------------------------- state helpers --------------------------------------
// A plot: {v:1, site, cc (level), b:{id:{t,i,j,r,l}}, w:{"i,j":tier}, n (id counter), job (one builder), st (production
// store), siteFree (first site change used), siteAt (last change), log:[drill results], mnSpent:{fe..} (base stores spent)}
const live=(p,now)=>{const out={};for(const [id,b] of Object.entries(p?.b||{}))out[id]=b;return out;};
function ccLevel(p){return p?.cc|0;}
function cells(b){const s=sizeOf(b.t,b.r|0),out=[];for(let a=0;a<s.w;a++)for(let c=0;c<s.d;c++)out.push([b.i+a,b.j+c]);return out;}
function occupancy(p,skip){const o=new Map();for(const [id,b] of Object.entries(p.b||{})){if(id===skip)continue;for(const [i,j] of cells(b))o.set(key(i,j),id);}for(const k of Object.keys(p.w||{}))if(!o.has(k))o.set(k,'wall');return o;}
function countOf(p,type){return Object.values(p.b||{}).filter(b=>b.t===type).length;}
function turretCount(p){return Object.values(p.b||{}).filter(b=>BUILDINGS[b.t]?.turret).length;}
// Levels count only once built; a building being upgraded keeps working at its old level.
function powerSupply(p){let s=12+3*ccLevel(p);for(const b of Object.values(p.b||{}))if(b.t==='reactor')s+=BUILDINGS.reactor.power*(b.l|0);return s;}
function powerUse(p,extra=null){let u=0;for(const [id,b] of Object.entries(p.b||{})){const B=BUILDINGS[b.t];if(!B)continue;const l=extra&&extra.id===id?extra.l:b.l|0;u+=B.pw*l;}if(extra&&!extra.id)u+=BUILDINGS[extra.t].pw*extra.l;return u;}
function levelOf(p,type){let l=0;for(const b of Object.values(p.b||{}))if(b.t===type)l=Math.max(l,b.l|0);return l;}
// Old Command Base modules derived from buildings (capped at III, as before): every old formula keeps working unchanged.
function modulesOf(p){const m={};for(const [type,B] of Object.entries(BUILDINGS))if(B.mod)m[B.mod]=Math.min(3,levelOf(p,type));return m;}
// Storage caps: production stops when a material reaches its cap.
function caps(p){const d=levelOf(p,'storage');return {alloy:30+40*d,biomass:30+40*d,helium:8+10*d,fe:30};}
function rates(p){const S=SITES[p.site]||SITES.ridge,r={alloy:0,biomass:0,helium:0,fe:0};
 for(const b of Object.values(p.b||{})){const B=BUILDINGS[b.t];if(!B?.prod||!(b.l>0))continue;for(const [k,v] of Object.entries(B.prod))r[k]+=v*b.l*(k==='alloy'?S.alloy:k==='biomass'?S.biomass:1);}
 if(S.rimFe&&ccLevel(p)>=1)r.fe+=3/24;   // two rim deposits: 3 Ferrite a day
 return r;}
// Production accrues continuously into the plot store (fractions kept), capped; collected inside the plot.
function accrue(p,now){const st=p.st||(p.st={alloy:0,biomass:0,helium:0,fe:0,at:now});const dt=Math.max(0,Math.min(7*DAY,now-(Number(st.at)||now)));if(dt>0){const r=rates(p),c=caps(p);for(const k of ['alloy','biomass','helium','fe'])st[k]=Math.min(c[k],(Number(st[k])||0)+r[k]*dt/HOUR);}st.at=now;return st;}
// Command Power: a visible score from building levels, wall tiers and defenses.
function power(p){if(!p)return 0;let s=100*ccLevel(p);for(const b of Object.values(p.b||{})){const B=BUILDINGS[b.t];if(!B)continue;s+=(B.turret?30:B.gate?10:20)*(b.l|0)*(1+.15*((b.l|0)-1));}
 for(const t of Object.values(p.w||{}))s+=[0,1,2,4,7,10][t|0]||0;return Math.round(s);}

// ---------------------------------------------------------------- validation -----------------------------------------
// Placement: inside the grid, on buildable terrain, no overlap with buildings or walls. Returns '' when valid, else why.
function placeError(p,type,i,j,r=0,skip=null){if(!Number.isInteger(i)||!Number.isInteger(j)||![0,1,2,3].includes(r))return 'invalid position';const s=sizeOf(type,r),occ=occupancy(p,skip);
 for(let a=0;a<s.w;a++)for(let c=0;c<s.d;c++){const x=i+a,z=j+c;if(x<0||z<0||x>=N||z>=N)return 'outside the plot';if(BLOCKED[terrainAt(p.site,x,z)])return 'blocked ground';if(occ.has(key(x,z)))return 'occupied';}return '';}
// Everything a build or upgrade needs, checked in one place (Worker and phone).
function buildCheck(p,type,level,id=null){const cc=ccLevel(p);if(type==='cc'){if(level!==cc+1||level>CC.max)return 'command center at maximum';return '';}
 const B=BUILDINGS[type];if(!B)return 'unknown building';if(cc<B.cc)return 'unlocks at CC'+B.cc;if(level>levelCap(type,cc))return level>B.max?'maximum level':'needs CC'+(level*2-1);
 if(!id){if(B.turret?turretCount(p)>=TURRET_CAP[cc-1]:countOf(p,type)>=countCap(type,cc))return B.turret?'turret limit at CC'+cc:'limit reached';}
 const use=powerUse(p,{id,t:type,l:level}),sup=powerSupply(p);if(type!=='reactor'&&use>sup)return 'not enough power ('+use+'/'+sup+')';return '';}
function wallError(p,cellsList,tier){const cc=ccLevel(p),W=WALLS[tier];if(!W)return 'invalid wall tier';if(cc<W.cc)return W.n+' unlocks at CC'+W.cc;if(!Array.isArray(cellsList)||!cellsList.length||cellsList.length>40)return 'invalid wall path';
 const occ=occupancy(p),seen=new Set();for(const c of cellsList){if(!Array.isArray(c)||c.length!==2)return 'invalid wall path';const [i,j]=c;if(!Number.isInteger(i)||!Number.isInteger(j)||i<0||j<0||i>=N||j>=N)return 'outside the plot';const k=key(i,j);if(seen.has(k))return 'invalid wall path';seen.add(k);if(BLOCKED[terrainAt(p.site,i,j)])return 'blocked ground';const o=occ.get(k);if(o&&o!=='wall')return 'occupied';if(o==='wall'&&(p.w[k]|0)>=tier)return 'already that tier';}
 const total=Object.keys(p.w||{}).length+cellsList.filter(([i,j])=>!(p.w||{})[key(i,j)]).length;if(total>wallCap(cc))return 'wall limit at CC'+cc+' ('+wallCap(cc)+' sections)';return '';}
// A straight drag from a to b in grid cells (the build-mode wall tool): horizontal, vertical or diagonal steps.
function wallLine(a,b){const out=[];let [x,y]=a;const [x1,y1]=b,dx=Math.sign(x1-x),dy=Math.sign(y1-y),n=Math.max(Math.abs(x1-x),Math.abs(y1-y));for(let k=0;k<=n&&out.length<40;k++){out.push([Math.round(a[0]+(x1-a[0])*(n?k/n:0)),Math.round(a[1]+(y1-a[1])*(n?k/n:0))]);}return out.filter((c,i)=>!out.slice(0,i).some(d=>d[0]===c[0]&&d[1]===c[1]));}
const wallCost=(p,cellsList,tier)=>{const W=WALLS[tier],sum={};for(const [i,j] of cellsList){if((p.w||{})[key(i,j)]>=tier)continue;for(const [k,v] of Object.entries(W.cost))sum[k]=(sum[k]||0)+v;}return sum;};

// ---------------------------------------------------------------- creation and migration -----------------------------
// Layout slots near the centre, tried in order with a spiral search for each site (deterministic auto layout).
const HOME={cc:[20,20],storage:[14,21],refinery:[25,21],reactor:[20,15],biodome:[20,25],hangar:[14,16],helium:[26,16],radar:[17,26],shield:[24,26],lab:[14,26],uplink:[27,26],trophy:[26,12]};
function autoPlace(p,type,r=0){const [hi,hj]=HOME[type]||[22,22];for(let rad=0;rad<20;rad++)for(let a=-rad;a<=rad;a++)for(const [i,j] of [[hi+a,hj-rad],[hi+a,hj+rad],[hi-rad,hj+a],[hi+rad,hj+a]]){if(!placeError(p,type,i,j,r))return {i,j,r};}return null;}
function newPlot(site,now){const p={v:1,site:SITES[site]?site:'ridge',cc:1,b:{},w:{},n:0,st:{alloy:0,biomass:0,helium:0,fe:0,at:now},log:[],mnSpent:{},siteFree:0,siteAt:0,at:now};
 const c=autoPlace(p,'cc');p.b.cc={t:'cc',i:c.i,j:c.j,r:0,l:1};const s=autoPlace(p,'storage');p.b['b'+(++p.n)]={t:'storage',i:s.i,j:s.j,r:0,l:1};return p;}
// The CC record mirrors p.cc (its level) so it renders and moves like any other building.
// Old saves: tier I..V becomes CC 1/3/5/7/9 (same points multiplier, yield and travel), every module becomes its building at
// the same level (same benefits), a pending module build becomes the builder's job, banked goods and the yield clock stay.
function migrate(base,now){const t=Math.max(1,Math.min(5,base.tier|0)),p=newPlot('ridge',now);p.cc=2*t-1;p.b.cc.l=p.cc;p.migratedFrom={tier:t,modules:{...(base.modules||{})},at:now};
 const map={reactor:'reactor',hangar:'hangar',defense:'shield',vault:'storage',radar:'radar',uplink:'uplink'};
 for(const [m,type] of Object.entries(map)){const lvl=Math.max(0,Math.min(3,base.modules?.[m]|0));if(type==='storage'){p.b.b1.l=Math.max(1,lvl);continue;}if(!lvl)continue;const at=autoPlace(p,type);if(at)p.b['b'+(++p.n)]={t:type,...at,l:lvl};}
 if(base.pending&&map[base.pending.module]){const type=map[base.pending.module],cur=Object.entries(p.b).find(([,b])=>b.t===type);let id=cur?.[0];if(!id){const at=autoPlace(p,type);if(at){id='b'+(++p.n);p.b[id]={t:type,...at,l:0};}}
  if(id)p.job={id,t:type,l:(p.b[id].l|0)+1,at:now,ready:Math.max(now,Number(base.pending.readyAt)||now)};}
 return p;}
// Finish the builder's job when its time is up (Worker clock).
function settle(p,now){if(p?.job&&now>=p.job.ready){const j=p.job;if(j.t==='cc'){p.cc=j.l;p.b.cc.l=j.l;}else if(p.b[j.id]){accrue(p,j.ready);p.b[j.id].l=j.l;}delete p.job;return j;}return null;}

// ---------------------------------------------------------------- Defense Drill ---------------------------------------
// A simulated Parasite attack on the pilot's own layout, watched, never rewarded. Deterministic from (layout, seed):
// waves enter by the site's lanes and follow a flow field to the Command Center; walls and buildings in the way are
// attacked; drones fly straight at turrets. Turrets fire with real ranges/rates (site and level adjusted), Shield
// Generators soften damage near them. The Worker runs it to write the base log; the phone replays the same frames.
const DRILL=Object.freeze({dt:.1,maxT:90,kinds:{raider:{hp:110,spd:6,dmg:14,rof:.8,range:3.5},sentinel:{hp:420,spd:3.2,dmg:42,rof:1.4,range:4},drone:{hp:70,spd:9,dmg:10,rof:.6,range:3,air:true}}});
function drillWaves(cc){const n=Math.min(10,cc|0||1);return [{at:2,raider:3+n,sentinel:Math.floor(n/3),drone:0},{at:22,raider:2+n,sentinel:1+Math.floor(n/2),drone:Math.floor(n/2)},{at:45,raider:2+Math.ceil(n*1.2),sentinel:1+Math.floor(n/2),drone:1+Math.floor(n/2)}];}
function hpOfBuilding(b){if(b.t==='cc')return 1500+500*(b.l|0);const B=BUILDINGS[b.t];return B?.turret?220+90*(b.l|0):B?.gate?900:500+200*(b.l|0);}
function drill(plot,seed=1,opt={}){
 const p=plot,site=SITES[p.site]||SITES.ridge,rnd=(()=>{let s=(seed>>>0)||1;return ()=>{s=Math.imul(s^s>>>15,2246822507)^Math.imul(s^s>>>13,3266489909);s^=s>>>16;return (s>>>0)/4294967296;};})();
 const blocks=new Map(),structs=[];for(const [id,b] of Object.entries(p.b||{})){if(!(b.l>0))continue;const s={id,t:b.t,hp:hpOfBuilding(b),max:hpOfBuilding(b),cells:cells(b),l:b.l|0};s.x=s.cells.reduce((a,c)=>a+cellX(c[0]),0)/s.cells.length;s.z=s.cells.reduce((a,c)=>a+cellZ(c[1]),0)/s.cells.length;structs.push(s);for(const [i,j] of s.cells)blocks.set(key(i,j),s);}
 for(const [k,t] of Object.entries(p.w||{})){const [i,j]=k.split(',').map(Number),W=WALLS[t|0];if(!W)continue;const s={id:'w:'+k,t:'wall',tier:t|0,hp:W.hp,max:W.hp,cells:[[i,j]],x:cellX(i),z:cellZ(j)};structs.push(s);blocks.set(k,s);}
 const core=structs.find(s=>s.t==='cc');if(!core)return {outcome:'no-command-center',frames:[],kills:0,lost:0,time:0};
 const shields=structs.filter(s=>s.t==='shield').map(s=>({x:s.x,z:s.z,r:12+3*s.l,k:Math.min(.5,.1*s.l)}));
 const turrets=structs.filter(s=>BUILDINGS[s.t]?.turret).map(s=>{const B=BUILDINGS[s.t].turret,l=s.l;return {s,type:s.t,range:B.range*site.range*(1+.04*(l-1)),min:B.min||0,dmg:B.dmg*(1+.25*(l-1)),rof:B.rof,splash:B.splash,air:!!B.air,cd:0};});
 // flow field: cost to reach the core from every cell (empty 1, wall/building cells weighted by their HP so they get breached)
 let field=null;const cost=(i,j)=>{const t=terrainAt(p.site,i,j);if(BLOCKED[t])return Infinity;const s=blocks.get(key(i,j));if(!s||s.hp<=0||s===core)return 1;return 1+s.hp/60;};
 const flow=()=>{const d=new Float64Array(N*N).fill(Infinity),q=[];for(const [i,j] of core.cells){d[i*N+j]=0;q.push([0,i,j]);}
  while(q.length){let bi=0;for(let k=1;k<q.length;k++)if(q[k][0]<q[bi][0])bi=k;const [c,i,j]=q[bi];q[bi]=q[q.length-1];q.pop();if(c>d[i*N+j])continue;
   for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=i+a,z=j+b;if(x<0||z<0||x>=N||z>=N)continue;const w=cost(x,z);if(!isFinite(w))continue;const nc=c+w;if(nc<d[x*N+z]){d[x*N+z]=nc;q.push([nc,x,z]);}}}field=d;};
 flow();
 const foes=[],frames=[],events=[];let id=0,time=0,kills=0,dirty=false;const waves=drillWaves(p.cc).map(w=>({...w}));const shieldK=(x,z)=>{let k=0;for(const s of shields)if(Math.hypot(s.x-x,s.z-z)<s.r)k=Math.max(k,s.k);return k;};
 const hurt=(s,dmg)=>{if(s.hp<=0)return;s.hp-=dmg*(1-shieldK(s.x,s.z));if(s.hp<=0){s.hp=0;events.push({t:Math.round(time*10)/10,k:'destroyed',id:s.id});if(s.t==='wall'||!BUILDINGS[s.t]?.turret)dirty=true;}};
 const spawn=(kind,lane)=>{const L=site.lanes[lane%site.lanes.length],off=(rnd()-.5)*(L.w-1)*C;const edgeZ=L.j===0||L.j===N-1;const x=edgeZ?cellX(L.i)+off:cellX(L.i===0?0:N-1),z=edgeZ?cellZ(L.j===0?0:N-1):cellZ(L.j)+off;const K=DRILL.kinds[kind];foes.push({id:++id,kind,x,z,hp:K.hp,max:K.hp,cd:0});};
 const steps=Math.round((opt.maxT||DRILL.maxT)/DRILL.dt);
 for(let n=0;n<steps;n++){time=n*DRILL.dt;
  for(const w of waves)if(!w.done&&time>=w.at){w.done=true;let lane=Math.floor(rnd()*site.lanes.length);for(const kind of ['raider','sentinel','drone'])for(let k=0;k<w[kind];k++)spawn(kind,lane++);}
  if(dirty){flow();dirty=false;}
  for(const f of foes){if(f.hp<=0)continue;const K=DRILL.kinds[f.kind];f.cd=Math.max(0,f.cd-DRILL.dt);
   let target=null;if(K.air){let bd=Infinity;for(const t of turrets)if(t.s.hp>0){const d=Math.hypot(t.s.x-f.x,t.s.z-f.z);if(d<bd){bd=d;target=t.s;}}if(!target)target=core;}
   if(K.air){const d=Math.hypot(target.x-f.x,target.z-f.z);if(d<=K.range+2){if(f.cd<=0){hurt(target,K.dmg);f.cd=K.rof;}}else{f.x+=(target.x-f.x)/d*K.spd*DRILL.dt;f.z+=(target.z-f.z)/d*K.spd*DRILL.dt;}continue;}
   const i=Math.max(0,Math.min(N-1,Math.round(f.x/C+MID))),j=Math.max(0,Math.min(N-1,Math.round(f.z/C+MID)));
   if(Math.hypot(core.x-f.x,core.z-f.z)<=K.range+C*2){if(f.cd<=0){hurt(core,K.dmg);f.cd=K.rof;}continue;}
   let bi=i,bj=j,bc=field[i*N+j];for(const [a,b] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=i+a,z=j+b;if(x<0||z<0||x>=N||z>=N)continue;const c=field[x*N+z];if(c<bc-1e-9){bc=c;bi=x;bj=z;}}
   const blocker=blocks.get(key(bi,bj));if(blocker&&blocker.hp>0&&blocker!==core){if(Math.hypot(blocker.x-f.x,blocker.z-f.z)<=K.range+C*.75){if(f.cd<=0){hurt(blocker,K.dmg);f.cd=K.rof;}continue;}}
   const tx=cellX(bi),tz=cellZ(bj),d=Math.hypot(tx-f.x,tz-f.z)||1;f.x+=(tx-f.x)/d*Math.min(d,K.spd*DRILL.dt);f.z+=(tz-f.z)/d*Math.min(d,K.spd*DRILL.dt);}
  for(const t of turrets){if(t.s.hp<=0)continue;t.cd=Math.max(0,t.cd-DRILL.dt);if(t.cd>0)continue;let best=null,bd=Infinity;
   for(const f of foes){if(f.hp<=0)continue;const d=Math.hypot(f.x-t.s.x,f.z-t.s.z);if(d>t.range||d<t.min)continue;const air=DRILL.kinds[f.kind].air;if(t.type==='mortar'&&air)continue;const pr=d-(t.air&&air?100:0);if(pr<bd){bd=pr;best=f;}}
   if(!best)continue;t.cd=t.rof;events.push({t:Math.round(time*10)/10,k:'shot',from:t.s.id,x:Math.round(best.x*10)/10,z:Math.round(best.z*10)/10});
   for(const f of foes){if(f.hp<=0)continue;if(f===best||t.splash&&Math.hypot(f.x-best.x,f.z-best.z)<=t.splash){f.hp-=t.dmg;if(f.hp<=0){f.hp=0;kills++;}}}}
  if(n%5===0&&opt.frames!==false)frames.push({t:Math.round(time*10)/10,f:foes.filter(f=>f.hp>0).map(f=>[f.id,f.kind[0],Math.round(f.x*10)/10,Math.round(f.z*10)/10]),s:structs.filter(s=>s.hp<s.max).map(s=>[s.id,Math.round(100*s.hp/s.max)])});
  if(core.hp<=0||waves.every(w=>w.done)&&foes.every(f=>f.hp<=0))break;}
 const lost=structs.filter(s=>s.hp<=0&&s!==core).length,outcome=core.hp<=0?'breached':foes.some(f=>f.hp>0)?'held':'repelled';
 return {outcome,seed:seed>>>0,time:Math.round(time*10)/10,kills,spawned:id,lost,core:Math.round(100*core.hp/core.max),frames:opt.frames===false?[]:frames,events:opt.events===false?[]:events.slice(0,600)};}

root.ConquestPlot=Object.freeze({GRID,SITES,SITE_IDS,BUILDINGS,TURRETS,TURRET_CAP,CC,WALLS,CPS,MNS,DRILL,RIM_DEPOSITS,cellX,cellZ,key,terrainAt,heightAt,BLOCKED,laneAt,
 wallCap,levelCap,countCap,tierOf,costOf,timeOf,sizeOf,cells,occupancy,countOf,turretCount,powerSupply,powerUse,levelOf,modulesOf,caps,rates,accrue,power,
 placeError,buildCheck,wallError,wallLine,wallCost,autoPlace,newPlot,migrate,settle,drill,drillWaves,hpOfBuilding,hash,SEC,MIN,HOUR,DAY});
})(globalThis);
