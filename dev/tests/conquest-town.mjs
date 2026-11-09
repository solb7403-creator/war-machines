// Session 5B Town Defense (docs/conquest/SESSION_05B_TOWN_DEFENSE_FULL_PROMPT.txt): the town grows with the Command
// Center, seven site templates, vital buildings, settler homes, wall composite + ore blends (strength/durability/reflect),
// wall caps and extensions (earned paths; the store tile stays disabled), the Foundry economy, the fast wall tools, the
// whole-town raid simulation (pathing through the weakest wall, attacks on the way, Command Center = the raid's objective)
// and each of the eleven turret roles as unit simulations. Real Worker reducer (worker/src/conquest-plot.js) + shared rules.
import assert from 'node:assert/strict';import {writeFileSync,mkdirSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Plot:P}=CONQUEST;
const {createState,applyAction,refreshState}=await import('../../worker/src/conquest-sim.js');
const {campaign}=await import('../../worker/src/conquest-campaign.js');
const {fullTown}=await import('./fixtures/town.mjs');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const D=C.baseDefinition,t0=Date.UTC(2026,10,10,12);let now=t0;const evidence={};
const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
const rich=s=>{s.ledger.cp=5e7;s.ledger.banked={alloy:1e6,biomass:1e6,helium:1e6};return s;};
const base=site=>{let s=rich(createState(R.STOCK_L,now));s.position=at(D.x,D.z);s.battle.enemies=[];return applyAction(s,{seq:s.seq+1,action:'build-base',...(site?{plot:{site}}:{})},now+=1000);};
const act=(s,action,plot,ctx={})=>applyAction(s,{seq:s.seq+1,action,...(plot!==undefined?{plot}:{})},now+=1000,ctx);
const wait=(s,ms)=>{now+=ms;refreshState(s,now);s.lastWall=now;return s;};
const finish=s=>s.plot.job?wait(s,s.plot.job.ready-now+1):s;
const toCC=(s,cc)=>{while(s.plot.cc<cc){s=act(s,'plot-upgrade',{id:'cc'},{bmn:{il:99,ar:99}});s=finish(s);}return s;};
const plain=(site,cc=1)=>{const p=P.newPlot(site,t0);p.cc=cc;p.b.cc.l=cc;return p;};

// ---- 1. the town grows with the Command Center ----
{const sides=Array.from({length:10},(_,k)=>P.townSide(k+1));ok(sides[0]===45&&sides[9]===77&&sides.every((v,k)=>!k||v>sides[k-1]),'town side by CC: '+sides.join(' → ')+' cells (CC1 45×45 as before)');
 const ratio=sides[9]**2/sides[0]**2;ok(ratio>2.8&&ratio<3.2,'CC10 town is '+ratio.toFixed(2)+'× the CC1 area (target about 3×, about 78×78)');
 let s=base('ridge');assert.throws(()=>act(structuredClone(s),'plot-build',{type:'cannon',i:14,j:39,r:0}),/outside the town/);ok(true,'at CC1 a turret 25 cells from the centre is outside the town');
 s=toCC(s,3);const t=act(structuredClone(s),'plot-build',{type:'cannon',i:14,j:39,r:0});ok(t.plot.b['b'+t.plot.n]?.t==='cannon','at CC3 the same spot is inside the grown town (Worker-validated)');
 for(const site of P.SITE_IDS){const n=Array.from({length:10},(_,k)=>P.homes(plain(site,k+1)).length);assert(n.every((v,k)=>!k||v>=n[k-1]),site+' '+n);if(site==='ridge')evidence.homes=n;assert(n[9]>=70,site+' CC10 homes '+n[9]);}
 ok(true,'settler homes fill the districts as the town grows on every site (ridge: '+evidence.homes.join(', ')+'; at least 70 at CC10 everywhere)');
 const p=plain('ridge',10),h=P.homes(p)[5];const q=structuredClone(p);q.b.x={t:'cannon',i:h.i,j:h.j,r:0,l:1};ok(!P.placeError(p,'cannon',h.i,h.j,0)&&!P.homes(q).some(x=>x.id===h.id),'homes never block the pilot: building on a lot moves its settlers out');}

// ---- 2. seven site templates, every lane reachable at every town size ----
{ok(P.SITE_IDS.length===7&&['plateau','ice','ash'].every(k=>P.SITES[k]),'seven sites: '+P.SITE_IDS.map(k=>P.SITES[k].name).join(', '));
 const bad=[];for(const site of P.SITE_IDS)for(let cc=1;cc<=10;cc++){const p=plain(site,cc),r=P.drill(p,3,{frames:false,events:false,waves:[{at:0,raider:P.SITES[site].lanes.length*2}]});if(r.outcome!=='breached'||r.spawned!==P.SITES[site].lanes.length*2)bad.push(site+cc+':'+r.outcome+r.spawned);}
 ok(!bad.length,'on all 7 sites at all 10 CC levels raiders from every lane reach an undefended Command Center (no unreachable lane, no stuck raid) '+bad.slice(0,4));
 const ice=plain('ice',10),cells=[];for(let i=0;i<79;i++)for(let j=0;j<79;j++)if(P.terrainAt('ice',i,j)==='ice')cells.push([i,j]);ok(cells.length>150&&cells.every(([i,j])=>P.placeError(ice,'cannon',i,j,0)==='blocked ground'||!P.inTown(10,i,j)),'ICE BASIN: '+cells.length+' frozen-lake cells, never buildable (raiders cross them at half speed)');
 ok(P.SITES.plateau.wallHp===1.12&&P.wallStats(1,'plateau').hp===Math.round(600*1.12)&&P.SITES.ash.power===1.2&&P.SITES.ice.helium===1.15,'site bonuses: plateau +12% wall strength, ash field +20% reactor power, ice basin +15% Helium-3');
 const pr=plain('ash',1);pr.b.r={t:'reactor',i:30,j:30,r:0,l:2};const pr2=plain('ridge',1);pr2.b.r={t:'reactor',i:30,j:30,r:0,l:2};ok(P.powerSupply(pr)-P.powerSupply(pr2)===Math.round(28*.2),'ash field reactors give 20% more power');}

// ---- 3. Session 5 plots become a fresh town claim (no migration; owner-approved) ----
{const s=createState(R.STOCK_L,t0);s.base={tier:3,modules:{},claimedAt:t0,pointsAt:t0,defense:{wins:4}};s.plot={v:1,site:'canyon',cc:5,b:{cc:{t:'cc',i:20,j:20,r:0,l:5},b1:{t:'storage',i:14,j:21,r:0,l:3}},w:{'3,3':4},n:1,banner:{shape:'pennant',colors:['#22e6ff','#1a2230'],emblem:'moon'},mnSpent:{fe:6}};
 campaign(s,t0);ok(s.plot.v===2&&s.plot.site==='canyon'&&s.plot.cc===5&&s.base.tier===3&&!Object.keys(s.plot.w).length&&s.plot.cm===200&&s.plot.banner?.shape==='pennant'&&s.plot.mnSpent.fe===6&&s.plot.ext.w===4,'a v1 plot is reset to a fresh v2 town: same site, same CC level and tier (points multiplier unchanged), banner kept, 200 composite, base-store accounting kept');}

// ---- 4. vitals and the raid's objective ----
{ok(P.VITALS.cc==='primary'&&['reactor','storage','lab'].every(k=>P.VITALS[k]==='secondary'&&P.BUILDINGS[k].vital==='secondary'),'vitals: Command Center primary; Reactor, Storage Depot and Science Lab secondary');
 let s=toCC(base('ridge'),9);const far=act(structuredClone(s),'plot-build',{type:'reactor',i:8,j:8,r:0});ok(far.plot.b['b'+far.plot.n]?.t==='reactor','a vital can be placed anywhere in the town (a Reactor in the far corner at CC9)');
 const p=plain('ridge',1),r=P.drill(p,5,{frames:false,events:false});ok(r.outcome==='breached'&&r.core===0,'an undefended town: the Command Center falls and the raid wins (outcome '+r.outcome+')');
 const v=plain('ridge',4);v.b.r1={t:'reactor',i:39,j:28,r:0,l:3};for(const [k,[i,j]] of [[30,46],[32,48],[46,46],[48,48],[34,52],[44,52]].entries())v.b['t'+k]={t:'mg',i,j,r:0,l:4};v.b.f={t:'refinery',i:36,j:48,r:0,l:2};const rv=P.drill(v,5,{frames:false,events:false,waves:[{at:0,raider:16}]});
 ok(rv.vitals.includes('reactor')&&rv.power<100,'a secondary vital falls in the raid: the Reactor is lost and power drops to '+rv.power+'% (turrets fire slower)');}

// ---- 5. blend table: strength, durability, reflect, monotonic in ore tier and blend level ----
{const rows=[];for(let o=0;o<=6;o++)for(let l=o?1:0;l<=(o?3:0);l++){const w=P.wallStats(P.wcode(o,l),'ridge'),cost=o?P.ORE_UNITS[o]*P.BLEND_UNITS[l]/40:0;rows.push({blend:P.blendName(P.wcode(o,l)),hp:w.hp,dr:w.dr,refl:w.refl,orePerCell:cost,unlock:'CC'+(P.ORE_CC[o]||1)});}evidence.blends=rows;
 let mono=true;for(let o=1;o<=6;o++)for(let l=1;l<=3;l++){const w=P.wallStats(P.wcode(o,l),'ridge');if(l>1){const a=P.wallStats(P.wcode(o,l-1),'ridge');if(!(w.hp>a.hp&&w.dr>a.dr&&w.refl>=a.refl))mono=false;}if(o>1){const a=P.wallStats(P.wcode(o-1,l),'ridge');if(!(w.hp>a.hp&&w.dr>a.dr&&w.refl>=a.refl))mono=false;}}
 ok(mono,'all three stats rise with the ore tier and with the blend level (18 blends + composite)');
 const c0=P.wallStats(1,'ridge'),fe=P.wallStats(P.wcode(1,1),'ridge'),mh=P.wallStats(P.wcode(6,3),'ridge');
 ok(c0.hp===600&&c0.dr===0&&c0.refl===0&&fe.hp>c0.hp&&mh.hp===5*c0.hp&&mh.dr===.4&&mh.refl===.35,'composite 600 HP modest; Ferrite a cheap step up ('+fe.hp+' HP); Moonheart heavy elite: '+mh.hp+' HP (5×), 40% damage reduction, 35% reflect');
 ok(P.ORE_UNITS[6]*P.BLEND_UNITS[3]/40===.1&&P.ORE_UNITS[1]*P.BLEND_UNITS[1]/40===1,'ore per cell rises with the level and falls with rarity (Ferrite light 1/cell … Moonheart heavy 1 per 10 cells)');
 const hit=P.wallHit(mh,100);ok(Math.abs(hit.reflected-35)<1e-9&&Math.abs(hit.taken-65*.6)<1e-9&&Math.abs(P.wallHit(mh,100,.2).taken-65*.6*.8)<1e-9,'reflect math: a 100-damage hit on Moonheart heavy bounces 35 back at the attacker; the wall takes 65 × 0.6 = 39 (31.2 inside a 20% shield)');
 // reflect in a raid: one brute on a sealed Moonheart-heavy ring with no turrets dies of its own blows; on composite it breaks in
 const ring=(code)=>{const p=plain('ridge',9),{o,l}=P.wdecode(code);for(const c of P.wallPlan(p,[{k:'rect',a:[29,29],b:[49,49],o,l}],{dev:true}).cells)p.w[c.i+','+c.j]=c.code;return p;};
 const mhR=P.drill(ring(19),4,{frames:false,events:false,threat:1,waves:[{at:0,brute:1}]}),cR=P.drill(ring(1),4,{frames:false,events:false,threat:1,waves:[{at:0,brute:1}]});
 ok(mhR.kills===1&&mhR.core===100&&cR.wallsLost>0&&cR.core<100,'durability + reflect in a raid (threat 1): a lone brute dies on a sealed Moonheart-heavy ring (no turrets), but breaks a composite ring and hits the Command Center ('+cR.core+'%)');}

// ---- 6. wall tools ----
{const L=P.line4([10,10],[17,13]);ok(L.length===8+3&&L.every((c,k)=>!k||Math.abs(c[0]-L[k-1][0])+Math.abs(c[1]-L[k-1][1])===1)&&L.at(-1)+''==='17,13','LINE: a solid 4-connected line (no diagonal gaps raiders could slip through)');
 const Rc=P.rectCells([20,20],[29,24]);ok(Rc.length===2*(10+5)-4&&new Set(Rc.map(String)).size===Rc.length,'RECT: a closed outline of '+Rc.length+' cells');
 const G=P.ringCells([39,39],[39,51]),set=new Set(G.map(String));ok(G.length>60&&G.every(([i,j])=>[[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b])=>set.has((i+a)+','+(j+b))).length>=1),'RING: a closed '+G.length+'-cell ring (radius 12), each cell joined to the next');
 const p=plain('ridge',3),pl=P.wallPlan(p,[{k:'line',a:[30,30],b:[40,30],o:0,l:0},{k:'line',a:[30,30],b:[34,30],o:1,l:2}]);ok(pl.cells.length===11&&pl.cells.filter(c=>c.code===P.wcode(1,2)).length===5&&pl.cost.cm===11&&pl.cost.fe===10,'a later section overrides earlier ones on the same cells (draft order); 11 composite + 10 Ferrite');
 p.w['30,30']=P.wcode(1,2);const rb=P.wallPlan(p,[{k:'line',a:[30,30],b:[31,30],o:2,l:1}]);ok(rb.fresh===1&&rb.cost.cm===1&&rb.cost.il===1,'re-blending an existing wall costs only the new ore; a new cell also costs composite');
 ok(/nothing to build/.test(P.wallPlan(p,[{k:'cells',c:[30,30],o:1,l:2}]).err),'the same blend on the same cell is skipped (nothing to build)');
 const big=Array.from({length:P.MAX_SECTIONS+1},()=>({k:'line',a:[30,31],b:[31,31],o:0,l:0})),rings=[0,1,2,3,4].map(k=>({k:'rect',a:[k,k],b:[78-k,78-k],o:0,l:0}));
 ok(/invalid wall plan/.test(P.wallPlan(p,big).err)&&/too many cells/.test(P.wallPlan(p,rings).err)&&/invalid wall shape/.test(P.wallPlan(p,[{k:'cells',c:Array.from({length:2402},(_,k)=>k%79),o:0,l:0}]).err),'orders are bounded: at most '+P.MAX_SECTIONS+' sections and '+P.MAX_WALL_CELLS+' cells');
 for(const bad of [{k:'line',a:[1.5,2],b:[3,3],o:0,l:0},{k:'ring',a:[39,39],b:[39,0],o:0,l:0},{k:'line',a:[-1,2],b:[3,3],o:0,l:0},{k:'cells',c:[1,2,3],o:0,l:0},{k:'oval',a:[1,1],b:[2,2],o:0,l:0},{k:'line',a:[30,30],b:[31,30],o:1,l:0},{k:'line',a:[30,30],b:[31,30],o:7,l:1}])assert(P.wallPlan(p,[bad]).err,JSON.stringify(bad));ok(true,'malformed shapes and blends are refused (fractional, off-grid, oversized ring, odd cell list, unknown tool, ore without a level, unknown ore)');
 let s=toCC(base('ridge'),2);const cm=s.plot.cm;s=act(s,'plot-wall',{s:[{k:'ring',a:[39,39],b:[39,50],o:0,l:0}]});const n=Object.keys(s.plot.w).length;ok(n>40&&s.plot.cm===cm-n,'the Worker expands a RING order itself: '+n+' cells for '+n+' composite in one small request');
 assert.throws(()=>act(structuredClone(s),'plot-wall',{s:[{k:'line',a:[30,30],b:[31,30],o:0,l:0}],cost:0}),/invalid plot fields/);ok(true,'extra fields in a wall order are refused');}

// ---- 7. caps and extensions (earned paths; the store tile stays disabled) ----
{ok(P.WALL_CAP.join()==='600,756,911,1067,1222,1378,1533,1689,1844,2000','base wall cap by CC: '+P.WALL_CAP.join(', '));
 const p=plain('ridge',10);p.ext={r:5,d:31,w:10};const e=P.extParts(p);ok(e.research===30&&e.drill===20&&e.defense===10&&e.total===50&&P.wallCapOf(p)===3000,'every earned path at once is capped at +50%: 2,000 → 3,000 cells at CC10');
 ok(P.STORE.checkout===false&&P.STORE.items.some(i=>i.grants?.extPct===10)&&['skin-gilded','skin-turret-neon','foundry-rush','builder-2'].every(id=>P.STORE.items.some(i=>i.id===id))&&!P.STORE.ores.ar&&!P.STORE.ores.mh&&P.STORE.ores.fe&&P.STORE.ores.il,'store table (one data table): wall extension packs (capacity only), wall/turret skins, Foundry speed-up, second builder; checkout DISABLED; rare-or-better ores not sellable');
 let s=toCC(base('ridge'),2);const before=P.wallCapOf(s.plot);assert.throws(()=>act(structuredClone(s),'plot-research',{}),/needs a Foundry/);
 s=act(s,'plot-build',{type:'foundry',...P.autoPlace(s.plot,'foundry')});s=finish(s);assert.throws(()=>act(structuredClone(s),'plot-research',{},{bmn:{il:0}}),/base stores need il/);
 s=act(s,'plot-research',{},{bmn:{il:30}});ok(s.plot.ext.r===1&&s.plot.mnSpent.il===30&&P.wallCapOf(s.plot)===before+Math.floor(P.wallBase(2)*.06),'Foundry research (30 Ilmenite from the base stores) earns +6% wall capacity: '+before+' → '+P.wallCapOf(s.plot));
 assert.throws(()=>act(structuredClone(s),'plot-research',{},{bmn:{il:30,ar:99}}),/Foundry at level 2/);ok(true,'the next research step needs a higher Foundry level (rarer ores further up)');
 // drill milestone: a held drill at CC1+ sets the first milestone once; a breached drill sets nothing
 let d=base('ridge');const snap=JSON.stringify(d.ledger);d=act(d,'plot-drill',{});ok(d.plot.log[0].outcome==='breached'&&!d.plot.ext.d&&JSON.stringify(d.ledger)===snap,'a breached drill earns nothing (and no drill ever pays CP or materials)');
 let g=base('ridge');for(const [t,i,j] of [['cannon',35,35],['cannon',42,42],['mg',42,35]]){g=act(g,'plot-build',{type:t,i,j,r:0});g=finish(g);}g=act(g,'plot-wall',{s:[{k:'ring',a:[39,39],b:[46,39],o:1,l:1}]},{bmn:{fe:99}});
 g=wait(g,61000);g=act(g,'plot-drill',{});const L0=g.plot.log[0];ok(L0.outcome!=='breached'&&L0.core>=50&&(g.plot.ext.d&1)===1&&L0.ext===4,'holding a drill at CC1 earns the first drill milestone once: +4% wall capacity ('+L0.outcome+', core '+L0.core+'%)');
 g=wait(g,61000);g=act(g,'plot-drill',{});ok(!g.plot.log[0].ext&&g.plot.ext.d===1,'... and only once');
 const w=base('ridge');w.base.defense.wins=3;campaign(w,now);ok(w.plot.ext.w===3&&P.extParts(w.plot).defense===5,'3 real base defenses won: +5% wall capacity (10 wins: +10%)');}

// ---- 8. composite and the Foundry ----
{let s=toCC(base('ridge'),2);assert.throws(()=>act(structuredClone(s),'plot-feed',{n:10}),/Foundry first/);s=act(s,'plot-build',{type:'foundry',...P.autoPlace(s.plot,'foundry')});s=finish(s);
 const al=s.ledger.banked.alloy;s=act(s,'plot-feed',{n:100});ok(s.plot.fh===30&&s.ledger.banked.alloy===al-30,'loading alloy: the Foundry I hopper takes 30 (the rest stays banked)');
 const cm=s.plot.cm;s=wait(s,3600000);ok(Math.abs(s.plot.cm-(cm+5))<1e-6&&Math.abs(s.plot.fh-(30-5/4))<1e-6,'1 h: +5 composite from 1.25 alloy (4 composite per alloy, 5 an hour at level I)');
 const a=structuredClone(s.plot),b=structuredClone(s.plot);P.accrue(a,now+10*3600000);for(let k=1;k<=10;k++)P.accrue(b,now+k*3600000);ok(Math.abs(a.cm-b.cm)<1e-6&&Math.abs(a.fh-b.fh)<1e-6,'the same composite whether the Worker settles every hour or once after 10 h');
 const c=structuredClone(s.plot);c.cm=P.caps(c).cm-1;c.fh=30;P.accrue(c,now+20*3600000);ok(c.cm===P.caps(c).cm&&c.fh>29,'production stops at the composite cap ('+P.caps(c).cm+' at Foundry I) without burning the loaded alloy');
 assert.throws(()=>act(structuredClone(s),'plot-wall',{s:[{k:'rect',a:[16,16],b:[62,62],o:0,l:0},{k:'rect',a:[18,18],b:[60,60],o:0,l:0}]}),/not enough wall composite/);ok(true,'a wall order larger than the composite stock is refused (nothing spent)');}

// ---- 9. raid pathing: the weakest wall, attacks on the way ----
{const p=plain('ridge',9),{o,l}=P.wdecode(19);for(const c of P.wallPlan(p,[{k:'rect',a:[29,29],b:[49,49],o,l}],{dev:true}).cells)p.w[c.i+','+c.j]=c.code;for(let i=36;i<=38;i++)p.w[i+',49']=1;   // a 3-cell composite patch in the south side
 const r=P.drill(p,8,{frames:false,events:true,threat:1,waves:[{at:0,raider:14,sentinel:3}]}),broken=r.events.filter(e=>e.k==='destroyed'&&e.id.startsWith('w:')).map(e=>e.id.slice(2));
 ok(broken.length&&broken.every(k=>['36,49','37,49','38,49'].includes(k)),'raiders path through the weakest wall: only the composite patch in a Moonheart-heavy ring is broken ('+broken.join(' ')+')');
 const q=plain('ridge',2);q.b.t={t:'cannon',i:40,j:22,r:0,l:1};const rq=P.drill(q,8,{frames:false,events:false,waves:[{at:0,raider:10}]});ok(rq.fell.some(f=>f.id==='t'),'raiders attack structures in reach on the way: the Cannon beside the north lane falls');
 const hm=plain('ash',4),r2=P.drill(hm,8,{frames:false,events:false,waves:[{at:0,raider:20,swarm:10}]});ok(r2.homesLost>0,'settler homes on the way are attacked too ('+r2.homesLost+' lost)');}

// ---- 10. eleven turret roles (unit simulations: one turret at level III, the same spot, the same wave) ----
{ok(P.TURRETS.length===11&&P.TURRETS.join()==='cannon,mg,laser,rocket,missile,mortar,flame,siege,tesla,lasercannon,railgun','eleven turret types: '+P.TURRETS.map(t=>P.BUILDINGS[t].n).join(', '));
 ok(P.TURRETS.every((t,k)=>P.BUILDINGS[t].cc>=1&&P.BUILDINGS[t].cc<=9)&&P.TURRETS.filter(t=>P.BUILDINGS[t].cc===1).length===2&&P.TURRET_CAP[9]>=40,'unlocked across CC1-CC9 (two at CC1), turret cap '+P.TURRET_CAP.join('/'));
 const sim=(type,waves,{i=39,j=30,seed=11,site='ridge'}={})=>{const p=plain(site,10);p.b.t={t:type,i,j,r:0,l:3};return P.drill(p,seed,{events:true,frames:false,threat:1,waves});};
 const kills=(type,w,o)=>sim(type,w,o).byTurret.t.kills,dmg=(type,w,o)=>sim(type,w,o).byTurret.t.dmg,roles={};
 const swarm=[{at:0,swarm:40}],pack=[{at:0,raider:24}],armor=[{at:0,brute:3,sentinel:4}],air=[{at:0,drone:14}];
 roles.mgVsSwarm=[kills('mg',swarm),kills('cannon',swarm),kills('siege',swarm)];ok(roles.mgVsSwarm[0]>roles.mgVsSwarm[1]&&roles.mgVsSwarm[0]>roles.mgVsSwarm[2],'TWIN-BARREL MG is the swarm killer: '+roles.mgVsSwarm[0]+' swarmlings vs Cannon '+roles.mgVsSwarm[1]+', Siege '+roles.mgVsSwarm[2]);
 roles.siegeVsArmor=[dmg('siege',armor),dmg('mg',armor),dmg('cannon',armor)];ok(roles.siegeVsArmor[0]>roles.siegeVsArmor[1]&&roles.siegeVsArmor[0]>roles.siegeVsArmor[2],'HEAVY SIEGE CANNON is the armor breaker: '+roles.siegeVsArmor[0]+' damage on brutes/sentinels vs MG '+roles.siegeVsArmor[1]+', Cannon '+roles.siegeVsArmor[2]);
 roles.rocketVsPack=[dmg('rocket',pack),dmg('cannon',pack)];ok(roles.rocketVsPack[0]>roles.rocketVsPack[1],'ROCKET POD salvos blanket packs: '+roles.rocketVsPack[0]+' damage vs Cannon '+roles.rocketVsPack[1]);
 roles.missileVsAir=[kills('missile',air),kills('mortar',air),kills('siege',air)];ok(roles.missileVsAir[0]>0&&roles.missileVsAir[1]===0&&roles.missileVsAir[2]===0,'MISSILE is anti-air: '+roles.missileVsAir[0]+' drones; Mortar and Siege cannot hit flyers');
 const mo=sim('mortar',pack),mt=P.cellX(39),mz=P.cellZ(30);ok(mo.events.filter(e=>e.k==='shot').every(e=>Math.hypot(e.x-mt,e.z-mz)>=10-.01)&&mo.byTurret.t.dmg>0,'MORTAR: long splash, never fires inside its 10 m minimum range');
 const fl=sim('flame',swarm);ok(fl.events.filter(e=>e.k==='shot').every(e=>Math.hypot(e.x-mt,e.z-mz)<=13*1.1*1.08+.01)&&fl.byTurret.t.kills>=10,'FLAME PROJECTOR: a short cone (≤ 15.4 m at level III on a ridge) that burns: '+fl.byTurret.t.kills+' swarmlings');
 const te=sim('tesla',swarm);ok(te.events.some(e=>e.k==='shot'&&e.ch?.length>=3),'TESLA ARC COIL chains between nearby enemies (arcs of up to 5 targets)');
 const rg=sim('railgun',pack);ok(rg.byTurret.t.kills>rg.events.filter(e=>e.k==='shot').length*1.2,'RAILGUN pierces a line: '+rg.byTurret.t.kills+' kills from '+rg.events.filter(e=>e.k==='shot').length+' slugs');
 const lc=sim('lasercannon',armor),lcShot=lc.byTurret.t.dmg/Math.max(1,lc.events.filter(e=>e.k==='shot').length),cn=sim('cannon',armor),cnShot=cn.byTurret.t.dmg/Math.max(1,cn.events.filter(e=>e.k==='shot').length);ok(lcShot>4*cnShot,'LASER CANNON: one charged high-burst beam ('+Math.round(lcShot)+' a shot vs Cannon '+Math.round(cnShot)+')');
 roles.laserVsLight=[dmg('laser',pack),dmg('cannon',pack)];ok(roles.laserVsLight[0]>roles.laserVsLight[1]*.8,'LASER: fast energy beam, strong on light hulls ('+roles.laserVsLight[0]+' vs Cannon '+roles.laserVsLight[1]+')');
 evidence.turretRoles=roles;}

// ---- 11. the raid stays bounded (worst case per drill, node) ----
{const ms={};for(const site of P.SITE_IDS){const q=fullTown(P,site,{now:t0});let worst=0,worstW=0;for(let k=0;k<3;k++){let t=performance.now();P.drill(q,101+k,{});worst=Math.max(worst,performance.now()-t);t=performance.now();P.drill(q,201+k,{frames:false,events:false});worstW=Math.max(worstW,performance.now()-t);}ms[site]={walls:Object.keys(q.w).length,turrets:P.turretCount(q),homes:P.homes(q).length,replayMs:Math.round(worst),workerMs:Math.round(worstW)};}
 evidence.raidMs=ms;const wr=Math.max(...Object.values(ms).map(x=>x.replayMs)),ww=Math.max(...Object.values(ms).map(x=>x.workerMs));
 ok(ww<350&&wr<450,'a full CC10 town raid (2,000 wall cells, 42 turrets, homes, 211 raiders) stays bounded in node: worst '+ww+' ms on the Worker path, '+wr+' ms with replay frames ('+JSON.stringify(ms).slice(0,180)+')');}

mkdirSync('docs/conquest/session5b',{recursive:true});writeFileSync('docs/conquest/session5b/town-rules.json',JSON.stringify(evidence,null,1));
console.log(`conquest town: passed ${passed}`);
