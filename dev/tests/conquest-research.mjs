// Session 6B: Science Lab research through the real Worker reducer (worker/src/conquest-research.js + js/rules.js RTREE) and the
// research mods in the gear rating and the loadout checks. Owner decisions (Nov 16, 2026): research parts + time only (no CP,
// alloy, biomass or helium), jobs on the Worker clock (I 20 min, II 2 h, III 8 h) separate from the builder, one slot and a second
// at Science Lab III, the premium Lunar Pass +1 slot and -25% time, a ruined lab pauses research, Lab I opens Thermal and
// Ballistics, II Drive and Field, III the set mods (each needs its track's other three), a finished job unlocks the mod on the
// account exactly once (the outbox), research mods count in powerOf (the best research build about +8% over the best without on a
// top kit), and PvP checkLoadout / ecoLoadout read mod ownership from the server record only.
// Run: node dev/tests/conquest-research.mjs
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Plot:P}=CONQUEST;
const {createState,applyAction,refreshState}=await import('../../worker/src/conquest-sim.js');
const A=await import('../../worker/src/conquest-airdrop.js');
const RTREE=await import('../../worker/src/conquest-research.js');
const {checkLoadout}=await import('../../worker/src/pvp.js');
const {GEAR}=await import('./combat-sim.mjs');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const D=C.baseDefinition,t0=Date.UTC(2026,10,17,12);let now=t0;
const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
const MIN=60000,HOUR=3600000;
// a pilot with a town at Command Center cc and a Science Lab at level lv (state set up directly: the plot rules are tested elsewhere)
function pilot(cc=5,lv=1,parts={thermal:20,coil:20,servo:20,cap:20}){let s=createState(R.STOCK_L,now);s.ledger.cp=5e6;s.ledger.banked={alloy:1e6,biomass:1e6,helium:1e6};s.position=at(D.x,D.z);s.battle.enemies=[];
 s=applyAction(s,{seq:s.seq+1,action:'build-base'},now+=1000);s.plot.cc=cc;s.plot.b.lab1={t:'lab',i:31,j:43,r:0,l:lv};refreshState(s,now);for(const [k,n] of Object.entries(parts))s.inv.pt[k]=n;return s;}
const act=(s,action,mod,ctx={})=>applyAction(s,{seq:s.seq+1,action,...(mod!==undefined?{mod}:{})},now+=1000,ctx);
const wait=(s,ms)=>{now+=ms;refreshState(s,now);s.lastWall=now;return s;};
const throws=(f,re,m)=>{let e=null;try{f();}catch(x){e=x;}ok(!!e&&re.test(String(e.message)),m+(e?' ('+e.message+')':' (no error)'));};
const money=s=>JSON.stringify({cp:s.ledger.cp,b:s.ledger.banked,mn:s.plot?.mnSpent,cm:s.plot?.cm});

// ---- 1. the tree: 4 tracks x (3 mods + 1 set mod) = 16, a locked fifth slot, the lab levels, the slots ----
{const all=R.RTREE_ALL;ok(all.length===16&&new Set(all).size===16,'16 research unlocks, all distinct: '+all.join(', '));
 for(const t of R.RTREE.order){const ms=R.RTREE.mods[t],F=ms.map(id=>R.rmodOf(id).F);ok(F.filter(f=>f.set).length===1&&F.filter(f=>!f.set).length===3&&F.every(f=>f.rs===t&&!f.leg),R.RTREE.tracks[t].n+': three mods and one set mod, all on its own part');}
 ok(R.RTREE.tracks.thermal.lab===1&&R.RTREE.tracks.coil.lab===1&&R.RTREE.tracks.servo.lab===2&&R.RTREE.tracks.cap.lab===2&&R.RTREE_ALL.filter(id=>R.rmodOf(id).F.set).every(id=>R.rsTierOf(id)===3),'Lab I opens Thermal and Ballistics, Lab II Drive and Field, Lab III the set mods');
 ok(R.RTREE.locked&&R.RTREE.locked.lab===4&&/Role Cores/.test(R.RTREE.locked.n),'a fifth track slot for Role Cores, shown locked (Science Lab level IV, Session 6C)');
 ok(P.BUILDINGS.lab.max===3&&P.BUILDINGS.lab.cc===3,'the Science Lab stays max level 3, built from CC3');
 ok(R.RTREE.timeMs[1]===20*MIN&&R.RTREE.timeMs[2]===2*HOUR&&R.RTREE.timeMs[3]===8*HOUR,'job times I 20 min, II 2 h, III 8 h');
 ok(R.rsSlots(1,false)===1&&R.rsSlots(2,false)===1&&R.rsSlots(3,false)===2&&R.rsSlots(1,true)===2&&R.rsSlots(3,true)===3&&R.rsSlots(0,true)===0,'slots: one, a second at Science Lab III, +1 with the premium pass (none without a lab)');
 for(const t of R.RTREE.order){const L=R.RTREE.legendary[t],F=R.rmodOf(L).F;ok(F.leg&&F.set&&F.rs===t&&R.rmodOf(R.RTREE.mods[t][3]).slot===R.rmodOf(L).slot,'Legendary set mod for '+R.RTREE.tracks[t].n+': '+F.n+' (same slot as the earned set mod, bought, never researched)');}
 for(const id of R.RTREE_ALL.concat(Object.values(R.RTREE.legendary))){const F=R.rmodOf(id).F;const low=new Set(['dashCd','shieldCd','supTaken']);ok(typeof F.d==='string'&&F.d.length>30&&F.role&&F.cue&&F.b&&R.FIT_FIELDS.some(k=>low.has(k)?(F[k]||0)>0:(F[k]||0)<0),F.n+': a name, a role, one behavior in plain words ('+F.b+') and a felt trade-off');}
 ok(new Set(R.RTREE_ALL.map(id=>R.rmodOf(id).F.b)).size===16,'every earned mod has its own behavior (no two the same)');}

// ---- 2. a job: parts + time only, never CP or materials; Worker clock; reveal; the outbox unlock ----
{let s=pilot(5,1);const before=money(s),pt0={...s.inv.pt};
 s=act(s,'research-start','vent');const j=s.rs.jobs[0];
 ok(j&&j.mod==='vent'&&j.ms===20*MIN&&j.part==='thermal'&&s.inv.pt.thermal===pt0.thermal-R.RTREE.cost[0],'Vent Barrel: '+R.RTREE.cost[0]+' Thermal Cores and a 20-minute job');
 ok(money(s)===before,'no CP, alloy, biomass, helium, base minerals or composite spent (only parts)');
 ok(Object.keys(s.inv.pt).every(k=>k==='thermal'||s.inv.pt[k]===pt0[k]),'only that track\'s part');
 throws(()=>act(s,'research-start','overclock'),/slot is busy/,'one job at a time below Science Lab III');
 s=wait(s,19*MIN);ok(!s.rs.done.vent&&s.rs.jobs.length===1&&Math.abs(s.rs.jobs[0].left-MIN)<=3000,'19 minutes in: running, about 1 minute left (Worker clock: '+Math.round(s.rs.jobs[0].left/1000)+' s)');
 s=wait(s,2*MIN);ok(s.rs.done.vent&&!s.rs.jobs.length,'20 minutes: researched');
 const p=A.pending(s);A.seal(s,now);const e=A.airdrop(s).out.find(x=>x.rm);ok(e&&e.rm.includes('vent')&&!(e.raw>0),'the unlock rides one immutable outbox entry to the account (no points)');
 ok(A.due(s,now),'a research unlock is credited at once (not batched)');
 throws(()=>act(s,'research-start','vent'),/already researched/,'a mod is researched once');
 s=act(s,'research-seen','vent');ok(s.rs.seen.vent===1,'the reveal card is marked seen (once, on every device)');}

// ---- 3. lab levels, order costs, set-mod requirement, Lab III second slot ----
{let s=pilot(5,1);throws(()=>act(s,'research-start','traction'),/Science Lab II/,'Drive needs Science Lab II');
 throws(()=>act(s,'research-start','inferno'),/Science Lab III/,'a set mod needs Science Lab III');
 s=pilot(9,3);s=act(s,'research-start','vent');s=act(s,'research-start','overclock');
 ok(s.rs.jobs.length===2&&s.rs.jobs[1].part==='thermal'&&s.rs.jobs[1].paid.e===R.RTREE.cost[1],'Science Lab III: a second slot; the second Thermal mod costs '+R.RTREE.cost[1]);
 throws(()=>act(s,'research-start','heatsink'),/slot is busy/,'two slots at Lab III without the pass');
 throws(()=>act(s,'research-start','inferno'),/other three Thermal/,'the set mod needs the track\'s other three researched');
 s=wait(s,21*MIN);s=act(s,'research-start','heatsink');ok(s.rs.jobs[0].paid.e===R.RTREE.cost[2],'the third Thermal mod costs '+R.RTREE.cost[2]);
 s=wait(s,21*MIN);s=act(s,'research-start','inferno');const j=s.rs.jobs[0];ok(j.mod==='inferno'&&j.ms===8*HOUR&&j.paid.e===R.RTREE.cost[3],'the Thermal set mod: '+R.RTREE.cost[3]+' Thermal Cores, 8 hours');
 s=wait(s,8*HOUR+1000);ok(s.rs.done.inferno,'Inferno Core researched');}

// ---- 4. the premium Lunar Pass: +1 slot and -25% time; parts from bonus once earned run out ----
{let s=pilot(5,1,{thermal:1,coil:20,servo:20,cap:20});const ctx={premium:true,bpt:{thermal:9,coil:0,servo:0,cap:0}};
 s=act(s,'research-start','vent',ctx);const j=s.rs.jobs[0];ok(j.ms===15*MIN&&j.pass===1,'premium pass: a Lab I job takes 15 minutes (-25%)');
 ok(j.paid.e===1&&j.paid.b===R.RTREE.cost[0]-1&&s.inv.pt.thermal===0&&s.rs.bs.thermal===R.RTREE.cost[0]-1,'earned parts first, then bonus parts (pass tiers, packs) from the account');
 s=act(s,'research-start','pierce',ctx);ok(s.rs.jobs.length===2,'premium pass: a second slot below Lab III');
 throws(()=>act(s,'research-start','marksman',ctx),/slot is busy/,'pass slots are capped (two below Lab III)');
 const s2=pilot(5,1,{thermal:0,coil:0,servo:0,cap:0});throws(()=>act(s2,'research-start','vent',{premium:false,bpt:{thermal:R.RTREE.cost[0]-1}}),/needs \d+ Thermal Core/,'not enough parts: refused, nothing spent');
 const s3=pilot(5,1,{thermal:0,coil:0,servo:0,cap:0});s3.rs.bs.thermal=5;throws(()=>act(s3,'research-start','vent',{bpt:{thermal:5}}),/needs/,'bonus parts already spent here cannot be spent twice (account total minus spent)');}

// ---- 5. a ruined Science Lab pauses research; repair resumes it ----
{let s=pilot(5,2);s=act(s,'research-start','traction');const ms=s.rs.jobs[0].ms;s=wait(s,30*MIN);const left=s.rs.jobs[0].left;
 const m=P.maxHpOf(s.plot,'lab1');s.plot.dmg.lab1=m;refreshState(s,now);ok(P.ruined(s.plot,'lab1'),'raid damage ruins the lab');
 s=wait(s,3*HOUR);ok(s.rs.jobs.length===1&&s.rs.jobs[0].left===left&&!s.rs.done.traction,'ruined: the job does not advance ('+Math.round(left/60000)+' min left after 3 h)');
 throws(()=>act(s,'research-start','ram'),/ruined/,'no new job while the lab is ruined');
 delete s.plot.dmg.lab1;s=wait(s,ms-30*MIN+1000);ok(s.rs.done.traction,'repaired: the clock runs again and the job finishes on time');
 // a repair job finishing between two requests: the pause ends when the crews finish, not at the next request
 let q=pilot(5,2);q=act(q,'research-start','ram');q.plot.dmg.lab1=P.maxHpOf(q.plot,'lab1');refreshState(q,now);const l0=q.rs.jobs[0].left;q.plot.job={id:'repair',t:'repair',l:0,fix:{lab1:q.plot.dmg.lab1},at:now,ready:now+10*MIN};
 q=wait(q,40*MIN);ok(Math.abs((l0-q.rs.jobs[0].left)-30*MIN)<2000,'repair done 10 min into a 40 min wait: 30 min of research ran');}

// ---- 6. instant-finish credits (a verified purchase only; checkout is off) ----
{let s=pilot(5,1);s=act(s,'research-start','pierce');const id=s.rs.jobs[0].id;RTREE.account(s,{bpt:{},rsx:{[id]:now}},now);ok(s.rs.done.pierce&&s.rs.fx[id]===1,'a finish credit on the account completes that job at once');
 s=act(s,'research-start','marksman');const id2=s.rs.jobs[0].id;RTREE.account(s,{bpt:{},rsx:{[id]:now}},now);ok(!s.rs.done.marksman&&s.rs.jobs[0].id===id2,'a credit finishes only its own job, once');}

// ---- 7. the account: ownership comes from the server record only ----
{const S=R.ecoNorm({});R.labEnsure(S);const L=R.ecoLoadout(S,{mods:{mount:'vent',hull:'aegis',mobility:'hyperdrive'}});
 ok(L.mods.mount==='stock'&&L.mods.hull==='stock'&&L.mods.mobility==='stock','ecoLoadout: research mods not researched and Legendary set mods not bought fall back to Stock');
 const S2=R.ecoNorm({rm:{vent:1,aegis:1,sunfire:1},lsm:{hyperdrive:1,vent:1}});ok(S2.rm.vent&&S2.rm.aegis&&!S2.rm.sunfire&&S2.lsm.hyperdrive&&!S2.lsm.vent,'the record keeps researched mods and bought Legendary ones apart (a Legendary is never "researched", a research mod never "bought")');
 R.labEnsure(S2);const L2=R.ecoLoadout(S2,{mods:{mount:'vent',hull:'aegis',mobility:'hyperdrive'}});ok(L2.mods.mount==='vent'&&L2.mods.hull==='aegis'&&L2.mods.mobility==='hyperdrive','owned research and Legendary mods fit');
 const M=S2.lab.machines[S2.lab.active];ok(R.labValidate(S2,{...R.labSpec(R.ecoLoadout(S2,M.spec)),mods:{mount:'overclock'}})==='owned','the garage save refuses a mod not researched');
 const P0=await checkLoadout({},R,{mods:{mount:'rail',hull:'aegisp',mobility:'overdrive'}},R.ecoNorm({lab:undefined}));ok(P0.mods.mount==='stock'&&P0.mods.hull==='stock'&&P0.mods.mobility==='stock','PvP checkLoadout: a client claiming unowned mods fights with Stock');
 const S3=R.ecoNorm({rm:{rail:1,overdrive:1},lsm:{aegisp:1}});R.labEnsure(S3);S3.lab.machines[S3.lab.active].spec.mods={mount:'rail',hull:'aegisp',mobility:'overdrive'};const P1=await checkLoadout({},R,{mods:{}},S3);ok(P1.mods.mount==='rail'&&P1.mods.hull==='aegisp'&&P1.mods.mobility==='overdrive','PvP checkLoadout: the garage bay\'s owned mods, from the record');
 const S4=R.ecoNorm({rm:{rail:1}});R.labEnsure(S4);S4.lab.machines[S4.lab.active].spec.mods={mount:'rail',hull:'aegisp',mobility:'overdrive'};const P2=await checkLoadout({},R,{mods:{}},S4);ok(P2.mods.mount==='rail'&&P2.mods.hull==='stock'&&P2.mods.mobility==='stock','PvP checkLoadout: a bay saved with mods the record does not hold fights with Stock in those slots');}

// ---- 8. research mods in the gear rating: the +8% target on a top kit, set mods strongest in their slot ----
{const L=GEAR.legend,z=m=>R.powerZ({...L,mods:m}),gain=(a,b)=>Math.exp((z(a)-z(b))/R.POWER_K)-1;
 const legal=m=>{const f=R.fittingStats(m);return f.weight<=R.FIT_BUDGET.weight&&f.power<=R.FIT_BUDGET.power;};
 const best=f=>{let b=null;for(const hull of Object.keys(R.FITS.hull))for(const mobility of Object.keys(R.FITS.mobility))for(const mount of Object.keys(R.FITS.mount)){const m={hull,mobility,mount};if(!legal(m)||!f(m))continue;if(!b||z(m)>z(b))b=m;}return b;};
 const free=best(m=>R.FIT_ORDER.every(k=>!R.FITS[k][m[k]].rs)),res=best(m=>R.FIT_ORDER.every(k=>!R.FITS[k][m[k]].leg));const g=gain(res,free);
 ok(g>0.07&&g<0.09,'top kit: the best research build is +'+(g*100).toFixed(1)+'% gear rating over the best build without research (target about +8%; '+JSON.stringify(res)+' vs '+JSON.stringify(free)+')');
 for(const slot of R.FIT_ORDER){const ids=Object.keys(R.FITS[slot]).filter(id=>R.FITS[slot][id].rs&&!R.FITS[slot][id].leg),one=id=>gain({[slot]:id},{}),sets=ids.filter(id=>R.FITS[slot][id].set),regs=ids.filter(id=>!R.FITS[slot][id].set),free2=Object.keys(R.FITS[slot]).filter(id=>!R.FITS[slot][id].rs);
  ok(sets.every(s=>regs.every(r=>one(s)>one(r))&&free2.every(f=>one(s)>one(f))),slot+': the set mod'+(sets.length>1?'s are':' is')+' stronger than every other option in the slot ('+sets.map(s=>R.FITS[slot][s].n+' +'+(one(s)*100).toFixed(1)+'%').join(', ')+')');}
 for(const t of R.RTREE.order){const e=R.RTREE.mods[t][3],l=R.RTREE.legendary[t],se=R.rmodOf(e).slot,ge=gain({[se]:e},{}),gl=gain({[se]:l},{});ok(gl>ge+0.01,R.rmodOf(l).F.n+' is a step stronger than '+R.rmodOf(e).F.n+': +'+(gl*100).toFixed(1)+'% vs +'+(ge*100).toFixed(1)+'%');}
 const S=R.ecoNorm({rm:Object.fromEntries(R.RTREE_ALL.map(k=>[k,1]))});R.labEnsure(S);const M=S.lab.machines[S.lab.active],p0=R.powerOf(R.labLoadout(S));M.spec.mods={...res};const p1=R.powerOf(R.labLoadout(S));
 ok(p1>p0&&p1===R.powerOf({...R.labLoadout(S),mods:res}),'the fitted research mods raise the bay\'s power through the server loadout ('+p0+' -> '+p1+'; league and matchmaking read it)');}

console.log('PASS conquest-research ('+passed+' checks)');
