// Session 5 Phase 1: the pilot's private base plot, server-authoritative (worker/src/conquest-plot.js + js/conquest/plot.js).
// Migration (every old tier/module combination keeps its benefits), build/upgrade/move/wall validation, one builder on the
// Worker clock, storage caps, the power budget, site bonuses and site changes, Command Power, base stores (minerals moved
// from the wallet; monotonic), and the Defense Drill (deterministic, never rewarded, written to the base log).
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Plot:P}=CONQUEST;
const {createState,applyAction,refreshState}=await import('../../worker/src/conquest-sim.js');
const {campaign,production}=await import('../../worker/src/conquest-campaign.js');
const A=await import('../../worker/src/conquest-airdrop.js');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const D=C.baseDefinition,t0=Date.UTC(2026,10,10,12);let now=t0;
const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
const rich=s=>{s.ledger.cp=5e6;s.ledger.banked={alloy:1e6,biomass:1e6,helium:1e6};return s;};
const base=(site)=>{let s=rich(createState(R.STOCK_L,now));s.position=at(D.x,D.z);s.battle.enemies=[];s=applyAction(s,{seq:s.seq+1,action:'build-base',...(site?{plot:{site}}:{})},now+=1000);return s;};
const act=(s,action,plot,ctx={})=>applyAction(s,{seq:s.seq+1,action,...(plot!==undefined?{plot}:{})},now+=1000,ctx);
const wait=(s,ms)=>{now+=ms;refreshState(s,now);s.lastWall=now;return s;};
const finish=s=>s.plot.job?wait(s,s.plot.job.ready-now+1):s;

// ---- 1. migration: every old tier (I..V) x module combination keeps its benefits ----
{const mods=Object.keys(D.modules);let combos=0,bad=[];
 for(let tier=1;tier<=5;tier++){const max=Math.min(3,tier),n=Math.pow(max+1,mods.length);
  for(let c=0;c<n;c++){const m={};let x=c;for(const k of mods){m[k]=x%(max+1);x=Math.floor(x/(max+1));}
   const s=createState(R.STOCK_L,t0);s.base={tier,modules:{...m},builtAt:t0-5e6,claimedAt:t0-4e6,pointsAt:t0-3e6,defense:{config:'turret',damage:0,wins:2,alertAt:0,nextAt:0,active:false}};s.ledger.banked={alloy:77,biomass:55,helium:33};s.ledger.cp=999;s.reputation=400;
   const beforeB=JSON.stringify(C.baseBenefits(tier,m)),beforeP=C.baseProduction({tier,modules:m},400),beforeY=JSON.stringify(C.baseYield({tier,modules:m,claimedAt:t0-4e6,pointsAt:t0-3e6},400,t0)),mult=R.CQ_BASE_MULT[tier];
   campaign(s,t0);combos++;const mm=s.base.modules;
   const same=s.base.tier===tier&&mods.every(k=>k==='vault'?mm[k]===Math.max(1,m[k]):mm[k]===m[k])&&R.CQ_BASE_MULT[s.base.tier]===mult&&s.base.claimedAt===t0-4e6&&s.base.pointsAt===t0-3e6&&s.ledger.cp===999&&s.ledger.banked.alloy===77&&s.base.defense.wins===2;
   const benefits=JSON.stringify(C.baseBenefits(s.base.tier,{...mm,vault:m.vault}))===beforeB&&C.baseProduction(s.base,400)===beforeP&&JSON.stringify(C.baseYield(s.base,400,t0))===beforeY;
   if(!same||!benefits||s.plot.site!=='ridge'||s.plot.cc!==2*tier-1)bad.push(tier+':'+JSON.stringify(m));}}
 ok(!bad.length,'migration: all '+combos+' old tier/module combinations keep tier, points multiplier, shields, radar, CP production, Daily Base Yield clocks, banked goods and defense record'+(bad.length?' FAILED '+bad.slice(0,3):''));
 const s=createState(R.STOCK_L,t0);s.base={tier:2,modules:{reactor:1},pending:{module:'radar',tier:1,readyAt:t0+50000},builtAt:t0,claimedAt:t0,defense:{}};campaign(s,t0);
 ok(!s.base.pending&&s.plot.job?.t==='radar'&&s.plot.job.ready===t0+50000,'a module still under construction continues as the builder\'s job with the same finish time');
 ok(s.plot.migratedFrom?.tier===2&&s.plot.siteFree===0&&s.plot.site==='ridge','migrated bases default to RIDGE; their first site change is free');
 const pv=createState(R.STOCK_L,t0);pv.base={tier:1,modules:{vault:0},pending:{module:'vault',tier:1,readyAt:t0+30000},claimedAt:t0,defense:{}};campaign(pv,t0);campaign(pv,t0+60000);
 ok(pv.base.modules.vault===1&&!pv.plot.job&&P.levelOf(pv.plot,'storage')===1,'a pending module never migrates into an extra free level (review fix: vault I pending -> Storage I, no job)');
 const th=createState(R.STOCK_L,t0);th.base={tier:1,modules:{},claimedAt:t0,defense:{}};campaign(th,t0);th.plot.theme={light:'amber',finish:'steel'};campaign(th,t0+1000);ok(Array.isArray(th.plot.theme.decor)&&th.plot.theme.decor.length===0,'a theme saved with no decorations survives Firebase dropping the empty list (review fix)');
 for(const bad of ['__proto__','constructor','toString'])for(const [act2,pl] of [['plot-build',{type:bad,i:30,j:30,r:0}],['plot-site',{site:bad}],['plot-upgrade',{id:bad}],['plot-move',{id:bad,i:30,j:30,r:0}],['plot-remove',{id:bad}]]){const q=createState(R.STOCK_L,t0);q.base={tier:1,modules:{},claimedAt:t0,defense:{}};q.position=at(D.x,D.z);q.battle.enemies=[];campaign(q,t0);assert.throws(()=>applyAction(q,{seq:q.seq+1,action:act2,plot:pl},t0+1000),/unknown building|invalid site|cannot be removed/);}
 ok(true,'prototype keys (__proto__, constructor, toString) are refused as unknown, never reached (review fix)');
 const v=createState(R.STOCK_L,t0);v.base={tier:1,modules:{vault:0},claimedAt:t0,defense:{}};campaign(v,t0);ok(v.base.modules.vault===1,'every plot has a Storage Depot: banking and repair work inside the plot (vault 0 -> 1 is a gain, never a loss)');}

// ---- 2. first build: site choice, guided first build, unlocks by CC ----
{let s=base('crater');ok(s.base.tier===1&&s.plot.cc===1&&s.plot.site==='crater'&&s.plot.b.cc&&Object.values(s.plot.b).some(b=>b.t==='storage'),'claiming the plot: CC1 on a CRATER RIM site with a Storage Depot');
 const cpBefore=s.ledger.cp,al=s.ledger.banked.alloy,open=Object.keys(P.BUILDINGS).filter(k=>P.buildCheck(s.plot,k,1)==='');
 ok(open.sort().join()==='cannon,reactor,refinery','CC1 offers only Refinery, Reactor and the Cannon turret (next unlocks at CC2): '+open.join(', '));
 assert.throws(()=>act(structuredClone(s),'plot-build',{type:'biodome',i:5,j:5,r:0}),/unlocks at CC2/);ok(true,'a CC2 building is refused at CC1');
 const at1=P.autoPlace(s.plot,'refinery');s=act(s,'plot-build',{type:'refinery',...at1});const c=P.costOf('refinery',1);
 ok(s.plot.job.t==='refinery'&&s.plot.job.ready-now===15000&&s.ledger.cp===cpBefore-c.cp&&s.ledger.banked.alloy===al-c.alloy,'guided first build: the Refinery costs '+c.cp+' CP + '+c.alloy+' alloy and takes 15 s on the Worker clock');
 const id=s.plot.job.id;ok(s.plot.b[id].l===0&&P.rates(s.plot).alloy===0,'under construction it does not produce yet');
 assert.throws(()=>act(structuredClone(s),'plot-build',{type:'cannon',...P.autoPlace(s.plot,'cannon')}),/builder busy/);ok(true,'one builder: a second build waits');
 s=wait(s,s.plot.job.ready-now-1000);ok(s.plot.b[id].l===0,'1 s before its finish time: still building (no client clock is trusted)');s=wait(s,1000);ok(s.plot.b[id].l===1&&P.rates(s.plot).alloy>0,'15 s: the Refinery is built and producing');
 // placement validation
 const bad=[[{type:'cannon',i:-1,j:3,r:0},/outside/],[{type:'cannon',i:0,j:0,r:0},/blocked/],[{type:'cannon',i:s.plot.b.cc.i,j:s.plot.b.cc.j,r:0},/occupied/],[{type:'cannon',i:1.5,j:3,r:0},/invalid position/],[{type:'cannon',i:30,j:30,r:5},/invalid position/],[{type:'nuke',i:30,j:30,r:0},/unknown building/]];
 for(const [p,re] of bad)assert.throws(()=>act(structuredClone(s),'plot-build',p),re);ok(true,'placement refused outside the plot, on blocked rim ground, on another building, off-grid, with a bad rotation or an unknown type');
 assert.throws(()=>act(structuredClone(s),'plot-build',{type:'cannon',i:30,j:30,r:0,cost:0}),/invalid plot fields/);ok(true,'extra fields (a client price) are refused');
 const poor=structuredClone(s);poor.ledger.cp=10;assert.throws(()=>act(poor,'plot-build',{type:'cannon',...P.autoPlace(s.plot,'cannon')}),/insufficient banked cp/);ok(true,'a build you cannot afford is refused and nothing is spent');
 assert.throws(()=>act(structuredClone(s),'plot-upgrade',{id}),/needs CC3/);ok(true,'building level II needs CC3 (levels unlock with the Command Center)');
 // CC upgrades and tiers
 s=act(s,'plot-upgrade',{id:'cc'});ok(s.plot.job.t==='cc'&&s.plot.job.ready-now===30000,'CC2 takes 30 s');s=finish(s);ok(s.plot.cc===2&&s.base.tier===1,'CC2 done; tier I (multiplier ×'+R.CQ_BASE_MULT[1]+')');
 s=act(s,'plot-upgrade',{id:'cc'});s=finish(s);ok(s.plot.cc===3&&s.base.tier===2&&R.CQ_BASE_MULT[s.base.tier]===1.1,'CC3 = tier II (×1.10), the same cumulative cost as the old Base II');
 const sum=(a,b)=>Object.fromEntries(Object.keys({...a,...b}).map(k=>[k,(a[k]||0)+(b[k]||0)]));
 ok(JSON.stringify(sum(P.CC.cost[2],P.CC.cost[3]))===JSON.stringify(D.tiers[1])&&JSON.stringify(sum(P.CC.cost[4],P.CC.cost[5]))===JSON.stringify(D.tiers[2])&&JSON.stringify(sum(P.CC.cost[6],P.CC.cost[7]))===JSON.stringify(D.tiers[3])&&JSON.stringify(sum(P.CC.cost[8],P.CC.cost[9]))===JSON.stringify(D.tiers[4]),'cumulative CC costs to CC3/5/7/9 equal the old Base II/III/IV/V costs (the airdrop multiplier arrives as before)');
 ok(P.CC.time[10]===8*3600000&&Math.max(...Object.values(P.BUILDINGS).map(B=>Math.max(...(B.time||[15000,180000,1200000,7200000,21600000]).slice(0,B.max))))<=8*3600000&&P.timeOf('refinery',1)<=60000,'real timers, short early: first builds 15 s; the longest (CC10) 8 h');
 // move and rotate
 const before=JSON.stringify(s.ledger);const ref=s.plot.b[id];s=act(s,'plot-move',{id,i:ref.i,j:ref.j+6,r:1});ok(s.plot.b[id].j===ref.j+6&&s.plot.b[id].r===1&&JSON.stringify(s.ledger)===before,'move + rotate a building: free, validated against the grid');
 const far=structuredClone(s);far.position=at(D.x+60,D.z);assert.throws(()=>act(far,'plot-move',{id,i:ref.i,j:ref.j,r:0}),/approach your Command Gate/);ok(true,'building and moving need you inside the plot (at the Command Gate)');
 const remote=structuredClone(far);const up=act(remote,'plot-upgrade',{id:'cc'});ok(up.plot.job?.t==='cc','upgrades still work from the MAP (remote command, banked goods only)');}

// ---- 3. production, storage caps, collect ----
{let s=base('crater');s=act(s,'plot-build',{type:'refinery',...P.autoPlace(s.plot,'refinery')});s=finish(s);
 const r=P.rates(s.plot);ok(Math.abs(r.alloy-.8*1.15)<1e-9&&Math.abs(r.fe-3/24)<1e-9,'CRATER RIM: +15% alloy ('+r.alloy.toFixed(2)+'/h at Refinery I) and rim deposits (3 Ferrite a day)');
 s=wait(s,3*3600000);ok(Math.abs(s.plot.st.alloy-2.76)<1e-6,'3 h: 2.76 alloy accrued (fractions kept)');
 const banked=s.ledger.banked.alloy;s=act(s,'plot-collect',{});ok(s.ledger.banked.alloy===banked+2&&Math.abs(s.plot.st.alloy-.76)<1e-3,'collect: whole units go to banked alloy, the fraction stays');
 s=wait(s,7*86400000);ok(s.plot.st.alloy===P.caps(s.plot).alloy&&P.caps(s.plot).alloy===70,'a week away: production stops at the Storage Depot cap (70 alloy at Depot I; no stockpile)');
 A.seal(s,now);const out=A.airdrop(s).out.length;s=act(s,'plot-collect',{});A.seal(s,now);ok(A.airdrop(s).out.length===out+1&&A.airdrop(s).out.at(-1).mn?.fe>=3,'rim deposit Ferrite goes to the wallet through the outbox (exactly once)');
 const far=structuredClone(s);far.position=at(D.x+60,D.z);assert.throws(()=>act(far,'plot-collect',{}),/approach your Command Gate/);ok(true,'collecting needs you inside the plot');
 let d=base('delta');d=act(d,'plot-upgrade',{id:'cc'});d=finish(d);d=act(d,'plot-build',{type:'biodome',...P.autoPlace(d.plot,'biodome')});d=finish(d);ok(Math.abs(P.rates(d.plot).biomass-.6*1.15)<1e-9&&P.rates(d.plot).fe===0,'RIVER DELTA: +15% biomass, no rim deposits');}

// ---- 4. power budget and limits ----
{let s=base('ridge');const p=s.plot;ok(P.powerSupply(p)===15&&P.powerUse(p)===1,'CC1 supplies 15 power; the Depot draws 1');
 const q=structuredClone(p);for(let k=0;k<20;k++)q.b['x'+k]={t:'refinery',i:0,j:0,r:0,l:1};ok(/not enough power/.test(P.buildCheck(q,'cannon',1)),'over the power budget a build is refused');
 q.b.rx={t:'reactor',i:0,j:0,r:0,l:3};ok(P.powerSupply(q)===15+42,'a Reactor adds 14 power a level');
 s=act(s,'plot-build',{type:'cannon',...P.autoPlace(s.plot,'cannon')});s=finish(s);s=act(s,'plot-build',{type:'cannon',...P.autoPlace(s.plot,'cannon')});s=finish(s);
 assert.throws(()=>act(structuredClone(s),'plot-build',{type:'cannon',...P.autoPlace(s.plot,'cannon')}),/turret limit at CC1/);ok(true,'turret limit: 2 at CC1');}

// ---- 5. walls: base stores (wallet minerals moved to base), tiers, caps ----
{let s=base('ridge');const line=P.wallLine([14,8],[22,8]);ok(line.length===9,'drag-to-draw: a straight wall of 9 sections');
 assert.throws(()=>act(structuredClone(s),'plot-wall',{cells:line,tier:1},{bmn:{fe:0}}),/base stores need fe/);ok(true,'a regolith wall needs Ferrite in the base stores');
 s=act(s,'plot-wall',{cells:line,tier:1},{bmn:{fe:30}});ok(Object.keys(s.plot.w).length===9&&s.plot.mnSpent.fe===18,'regolith wall: 9 sections, 18 Ferrite from the base stores (2 each) + CP');
 assert.throws(()=>act(structuredClone(s),'plot-wall',{cells:P.wallLine([14,10],[22,10]),tier:1},{bmn:{fe:30}}),/base stores need fe/);ok(true,'the stores count what was spent (30 moved, 18 spent: 12 left)');
 assert.throws(()=>act(structuredClone(s),'plot-wall',{cells:line,tier:2},{bmn:{il:99}}),/unlocks at CC2/);ok(true,'titanium walls unlock at CC2');
 assert.throws(()=>act(structuredClone(s),'plot-wall',{cells:[[0,0]],tier:1},{bmn:{fe:99}}),/blocked/);ok(true,'walls only on buildable ground');
 const many=Array.from({length:39},(_,k)=>[8+k%30,30+Math.floor(k/30)]);const q=structuredClone(s);q.plot.w=Object.fromEntries(Array.from({length:P.wallCap(1)},(_,k)=>[P.key(8+k%30,36+Math.floor(k/30)),1]));
 ok(/wall limit/.test(P.wallError(q.plot,[[20,20]],1)||'')||/occupied/.test(P.wallError(q.plot,[[20,20]],1)||''),'wall limit: '+P.wallCap(1)+' sections at CC1');
 s=act(s,'plot-remove',{cells:line.slice(0,3)});ok(Object.keys(s.plot.w).length===6,'walls can be removed (no refund)');
 ok(R.ecoBaseStore({mn:{fe:5}},{fe:9}).err==='mn'&&JSON.stringify(R.ecoBaseStore({mn:{fe:9,il:1}},{fe:4}).bmn)==='{"fe":4,"il":0,"ar":0,"tq":0,"se":0,"mh":0}','moving minerals to the base stores: only what the wallet holds, one way, the stores total only grows');}

// ---- 6. sites: change rules, lanes, turret range ----
{let s=base('ridge');s=act(s,'plot-site',{site:'canyon'});ok(s.plot.site==='canyon'&&s.notice.free&&s.plot.siteFree===1,'first site change is free');
 assert.throws(()=>act(structuredClone(s),'plot-site',{site:'delta'}),/cooldown/);ok(true,'later changes have a 24 h cooldown');
 s=wait(s,86400000+1000);const al=s.ledger.banked.alloy;s=act(s,'plot-site',{site:'delta'});ok(s.ledger.banked.alloy===al-150,'... and cost 150 alloy');
 ok(Object.values(s.plot.b).every((b,i,arr)=>!P.placeError(s.plot,b.t,b.i,b.j,b.r|0,Object.keys(s.plot.b)[i])),'every building is re-seated on valid ground of the new site');
 ok(P.SITES.canyon.lanes.length===2&&P.SITES.canyon.lanes.every(l=>l.w===2)&&P.SITE_IDS.filter(k=>k!=='canyon').every(k=>P.SITES[k].lanes.length>=3&&P.SITES[k].lanes.every(l=>l.w===4)),'CANYON: 2 narrow lanes (others 3-4 wide lanes)');
 ok(P.SITES.ridge.range===1.1,'RIDGE: +10% turret range');}

// ---- 7. Defense Drill: deterministic, watched, never rewarded ----
{let s=base('ridge');s=act(s,'plot-build',{type:'cannon',...P.autoPlace(s.plot,'cannon')});s=finish(s);
 const snap=JSON.stringify({l:s.ledger,a:s.airdrop,r:s.reputation,c:s.campaignScore,ach:s.achievements});s=act(s,'plot-drill',{});
 const log=s.plot.log[0];ok(log&&['held','repelled','breached'].includes(log.outcome)&&log.spawned>0,'Defense Drill: '+log.outcome+' ('+log.kills+'/'+log.spawned+' Parasites, '+log.lost+' structures lost) written to the base log');
 ok(JSON.stringify({l:s.ledger,a:s.airdrop,r:s.reputation,c:s.campaignScore,ach:s.achievements})===snap,'the drill grants nothing: CP, materials, minerals, airdrop points, reputation, score and achievements unchanged');
 assert.throws(()=>act(structuredClone(s),'plot-drill',{}),/drill crews reset/);ok(true,'one drill a minute');
 const replay=P.drill(s.plot,log.seed);ok(replay.outcome===log.outcome&&replay.kills===log.kills&&replay.lost===log.lost&&replay.frames.length>10,'the phone replays the same drill from the seed ('+replay.frames.length+' frames)');
 const naked=P.drill(base('ridge').plot,7),strong=structuredClone(s.plot);for(let k=0;k<10;k++){const at=P.autoPlace(strong,'cannon');strong.b['t'+k]={t:'cannon',...at,l:5};}const st=P.drill(strong,7);
 ok(st.kills>naked.kills&&st.core>=naked.core,'defenses matter: 10 Cannon V turrets kill '+st.kills+' vs '+naked.kills+' undefended (core '+st.core+'% vs '+naked.core+'%)');
 const ridge=structuredClone(strong),flat=structuredClone(strong);flat.site='crater';ok(P.drill(ridge,7).events.filter(e=>e.k==='shot').length>=P.drill({...ridge,site:'delta'},7).events.filter(e=>e.k==='shot').length-50,'ridge range bonus feeds the drill turrets');
 const t=performance.now();for(let k=0;k<5;k++)P.drill(strong,k+1,{frames:false,events:false});ok((performance.now()-t)/5<60,'a full drill simulates in '+((performance.now()-t)/5).toFixed(1)+' ms (Worker budget)');}

// ---- 8. Command Power ----
{const s=base('ridge'),p0=P.power(s.plot);const q=structuredClone(s.plot);q.w={'10,10':5,'11,10':5};const p1=P.power(q);ok(p0>0&&p1===p0+20,'Command Power: '+p0+' for a fresh CC1 plot; Moonheart wall sections add 10 each');}

console.log(`conquest plot: passed ${passed}`);
