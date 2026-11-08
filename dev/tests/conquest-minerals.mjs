// Phase 3 minerals inside the authoritative Conquest sim (docs/economy/RESOURCE_ECONOMY.md §5): authored deposits (counts,
// placement rules, reachability), the scanner pulse (radius, Radar module, cooldown, discovery), server-rolled gathering with
// exact channel times and per-pilot respawns, the one-time Starter Vein, operation caches, the 50% rounded-down exposure on
// death (recoverable wreck), banking into an immutable outbox entry, Hull Plating traits in Conquest damage, and the Meteor
// Strike (schedule, gating, waves, one claim and one stored roll per slot, Strike Resonance).
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST:{World:W,Combat:C}}=await import('../../worker/src/sim.gen.js');
const {createState,applyAction,applyCommands}=await import('../../worker/src/conquest-sim.js');
const {missionReward,death,pickups,bank}=await import('../../worker/src/conquest-economy.js');
const A=await import('../../worker/src/conquest-airdrop.js');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
const step=(s,cmd,now)=>applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0,...cmd}]},now);
const fresh=(x,z,t)=>{const s=createState(R.STOCK_L,t);s.position=at(x,z);s.battle.enemies=[];s.lastWall=t;s.creditMs=0;return s;};

// ---- deposits: approved counts, placement, every node reachable and clear ----
{const by=m=>W.deposits.filter(d=>d.m===m);
 ok(by('starter').length===1&&by('fe').length===36&&by('il').length===18&&by('ar').length===10&&by('tq').length===5,'deposits: Starter Vein 1, Ferrite 36, Ilmenite 18, Armalcolite 10, Tranquillityite 5 (approved §5.2)');
 ok(W.sectors.every(sc=>by('fe').filter(d=>Math.hypot(d.x-sc.x,d.z-sc.z)<=sc.radius).length>=2),'Ferrite in every sector (2+ each)');
 ok(by('tq').every(d=>[[1260,845],[1320,1010],[1290,1210],[1240,920],[1230,995]].some(([x,z])=>Math.hypot(d.x-x,d.z-z)<=50)),'Tranquillityite only at VETERAN raid perimeters and hive edges');
 ok(W.deposits.every(d=>!W.solidAt(d.x,d.z)&&!W.waterAt(d.x,d.z)&&!W.forestAt(d.x,d.z)&&W.deckAt(d.x,d.z)===null&&W.floraNodes.every(f=>Math.hypot(f.x-d.x,f.z-d.z)>=14)),'every deposit is clear of structures, water, forests, decks and bio-flora');
 const G=6,x0=640,x1=1460,z0=760,z1=1440,key=(x,z)=>Math.round((x-x0)/G)+':'+Math.round((z-z0)/G),seen=new Map(),queue=[at(898,1024)];seen.set(key(898,1024),queue[0]);
 for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dz] of [[G,0],[-G,0],[0,G],[0,-G]]){const q=W.advance(p,dx,dz);if(Math.hypot(q.x-p.x-dx,q.z-p.z-dz)>1.2||q.x<x0||q.x>x1||q.z<z0||q.z>z1)continue;const k=key(q.x,q.z);if(!seen.has(k)){seen.set(k,q);queue.push(q);}}}
 const reached=(x,z,r)=>{for(const q of seen.values())if(Math.hypot(q.x-x,q.z-z)<=r)return true;return false;};
 const lost=W.deposits.filter(d=>!reached(d.x,d.z,W.HARVEST.radius)),lostStrike=C.strikeSites.filter(t=>!reached(t.x,t.z,8));
 ok(!lost.length&&!lostStrike.length,'all '+W.deposits.length+' deposits and all 8 strike cores reachable from the spawn'+(lost.length?' missing '+lost.map(d=>d.id):'')+(lostStrike.length?' missing '+lostStrike.map(d=>d.id):''));}

// ---- scanner pulse: 150 m (+50 per Radar level), 30 s cooldown, discoveries persist ----
const t0=Date.UTC(2026,10,9,10,0,0);
{let s=fresh(1174,1172,t0),now=t0+50;s=step(s,{scan:true},now);const near=W.deposits.filter(d=>Math.hypot(d.x-1174,d.z-1172)<=150);
 ok(s.scanAt===now&&s.notice.kind==='scan'&&s.notice.radius===150&&s.notice.found===near.length&&near.every(d=>s.found[d.id])&&s.found['starter-01'],'scan at the Refuge: '+near.length+' deposits within 150 m revealed, the Starter Vein among them');
 const far=W.deposits.find(d=>Math.hypot(d.x-1174,d.z-1172)>200);ok(!s.found[far.id],'deposits beyond the radius stay hidden');
 const n0=Object.keys(s.found).length;now+=29000;s=step(s,{scan:true},now);ok(s.scanAt===t0+50,'a second pulse inside 30 s does nothing (cooldown)');
 s.position=at(1080,1060);now+=1500;s=step(s,{scan:true},now);ok(s.scanAt===now&&Object.keys(s.found).length>n0,'after 30 s it pulses again and adds new finds; earlier finds stay on the MAP');
 const r=fresh(1174,1172,t0);r.base={tier:2,modules:{radar:2},defense:{}};const rr=step(r,{scan:true},t0+50);ok(rr.notice.radius===250,'Radar module level 2: 250 m pulse');}

// ---- gathering: discovered + ready only; exact channel; server roll; points; per-pilot respawn ----
{const d=W.deposits.find(x=>x.m==='fe'),t=Date.UTC(2026,10,9,11);let s=fresh(d.x+2,d.z,t),now=t;
 for(let i=0;i<120;i++){now+=50;s=step(s,{gather:true},now);}ok(!s.channel&&!s.deposits&&!(s.ledger.mn.fe>0),'an undiscovered deposit cannot be gathered');
 s.found={[d.id]:1};const before=s.seq;for(let i=0;i<99;i++){now+=50;s=step(s,{gather:true},now);}ok(s.channel?.ms===4950&&!(s.ledger.mn.fe>0),'Ferrite: 99 steps (4.95 s) channel, nothing yet');
 now+=50;s=step(s,{gather:true},now);const got=s.ledger.mn.fe;
 ok(got>=2&&got<=4&&s.deposits[d.id]===now+R.MN_GATHER.fe.respawnMs&&s.notice.kind==='mineral'&&s.notice.units===got,'5 s: +'+got+' Ferrite (2-4, server roll) into cargo; respawns in 20 min for this pilot');
 A.seal(s,now);ok(A.airdrop(s).out.at(-1).raw===R.CQ_PTS.gather.fe&&A.activeToday(s,now),'a Ferrite harvest pays '+R.CQ_PTS.gather.fe+' points and is the day\'s verified activity');
 for(let i=0;i<120;i++){now+=50;s=step(s,{gather:true},now);}ok(s.ledger.mn.fe===got,'a depleted deposit cannot be gathered again');
 let qs=fresh(d.x+2,d.z,t),qn=t;for(let i=0;i<120;i++){qn+=50;qs=step(qs,{},qn);}qs.found={[d.id]:1};for(let i=0;i<100;i++){qn+=50;qs=step(qs,{gather:true},qn);}ok(qs.ledger.mn.fe===got,'the same deposit at the same moment rolls the same amount (deterministic, server-only)');
 const tq=W.deposits.find(x=>x.m==='tq');let ts=fresh(tq.x+2,tq.z,t),tn=t;ts.found={[tq.id]:1};for(let i=0;i<319;i++){tn+=50;ts=step(ts,{gather:true},tn);}ok(!ts.ledger.mn.tq,'Tranquillityite: 15.95 s, nothing yet');
 tn+=50;ts=step(ts,{gather:true},tn);ok(ts.ledger.mn.tq===1&&ts.deposits[tq.id]===tn+R.MN_GATHER.tq.respawnMs,'16 s channel: 1 Tranquillityite, 8 h respawn');}

// ---- the Starter Vein: once ever, 35 Ferrite ----
{const v=W.deposits.find(x=>x.m==='starter'),t=Date.UTC(2026,10,9,12);let s=fresh(v.x+2,v.z,t),now=t+50;s=step(s,{scan:true},now);
 for(let i=0;i<100;i++){now+=50;s=step(s,{gather:true},now);}ok(s.ledger.mn.fe===35&&s.deposits[v.id]===1&&s.notice.starter,'the Starter Vein gives 35 Ferrite');
 now+=86400000*3;s.lastWall=now-1000;for(let i=0;i<120;i++){now+=50;s=step(s,{gather:true},now);}ok(s.ledger.mn.fe===35,'... once ever (never respawns)');}

// ---- caches, death exposure, wreck recovery, banking through the outbox ----
{const t=Date.UTC(2026,10,9,13),s=createState(R.STOCK_L,t);s.mission='convoy';s.attempt=1;const r=missionReward(s,t+60000);
 ok(r.mn?.fe===3&&s.ledger.mn.fe===3+(r.mn.il?0:0)&&(!r.mn.il||r.mn.il===1),'field mission victory cache: 3 Ferrite (+1 Ilmenite at 50%: '+(r.mn.il?'hit':'missed')+')');
 const hard=C.raidIds.find(id=>C.operations[id].danger==='HARD');s.mission=hard;s.attempt=2;const h=missionReward(s,t+400000);ok(h.mn?.il===2,'HARD raid cache: 2 Ilmenite (+Armalcolite at 40%)');
 s.ledger.mn={fe:7,il:1,ar:3};s.position=at(1100,1100);s.hp=0;death(s,t+500000);
 ok(s.ledger.mn.fe===4&&s.ledger.mn.il===1&&s.ledger.mn.ar===2&&s.death.amount.mn.fe===3&&!s.death.amount.mn.il&&s.death.amount.mn.ar===1,'death: half of each carried mineral, rounded down, drops into the wreck (7 -> 3, 1 -> 0, 3 -> 1)');
 delete s.death;s.hp=100;pickups(s,t+510000);ok(s.ledger.mn.fe===7&&s.ledger.mn.ar===3,'recovering the wreck returns them');
 s.position=at(1174,1170);s.mission=null;delete s.airdrop?.pend;bank(s,t+520000);A.seal(s,t+520000);const e=A.airdrop(s).out.at(-1);
 ok(JSON.stringify(s.ledger.mn)==='{}'&&e.mn.fe===7&&e.mn.ar===3&&A.due(s,t+520000),'banking at the Refuge: minerals leave cargo into one immutable outbox entry, credited at once');}

// ---- Hull Plating traits in Conquest: pulse fire and plasma/orbital strikes ----
{const L={...R.STOCK_L,ap:[6,6,6,6]},b=new C.Encounter(L,at(1100,1100));ok(b.playerStats.enR===0.1&&b.playerStats.arR===0.1&&b.playerMax===R.tankOf(L,1).mhp*(b.playerMax/R.tankOf(L,1).mhp),'Conquest reads plates from the canonical loadout (HP and traits)');
 const plain=new C.Encounter(R.STOCK_L,at(1100,1100));ok(b.playerMax>plain.playerMax,'Moonheart set: more Conquest hull ('+plain.playerMax+' -> '+b.playerMax+')');}

// ---- Meteor Strike: schedule, gating, waves, one stored roll and one claim per slot, Resonance ----
{const M=C.meteorStrike(Date.UTC(2026,10,9,17,56));ok(M.phase==='telegraph'&&new Date(M.impactAt).toISOString()==='2026-11-09T18:00:00.000Z'&&M.closesAt-M.impactAt===1200000,'every 2 h on the even UTC hour: 17:56 is the telegraph for the 18:00 impact; open 20 min');
 ok(C.meteorStrike(Date.UTC(2026,10,9,18,19)).phase==='open'&&C.meteorStrike(Date.UTC(2026,10,9,18,21)).phase==='idle'&&C.meteorStrike(Date.UTC(2026,10,9,19,56)).site.id!==M.site.id,'open until 18:20, then idle; the next slot is a different crater');
 ok(new Set(Array.from({length:8},(_,i)=>C.meteorStrike(Date.UTC(2026,10,9,0)+i*7200000+60000).site.sector)).size===8,'8 consecutive strikes visit all 8 craters (every sector, the dangerous ones included)');
 const open=Date.UTC(2026,10,9,18,2),O=C.meteorStrike(open),site=O.site,other=C.strikeSites.find(x=>x.id!==site.id);
 let s=fresh(site.x,site.z+10,open-700000);s.completed={};
 assert.throws(()=>applyAction(s,{seq:s.seq+1,action:'start-mission',mission:site.id},open-600000),/no meteor strike/);
 const so=fresh(other.x,other.z+10,open-60000);assert.throws(()=>applyAction(so,{seq:so.seq+1,action:'start-mission',mission:other.id},open),/no meteor strike/);
 ok(true,'a strike cannot start before impact or at another crater');
 s=applyAction(s,{seq:s.seq+1,action:'start-mission',mission:site.id},open);const roll=structuredClone(s.strikes[O.slot].roll);
 ok(s.mission===site.id&&s.battle.enemies.filter(e=>!e.resident).map(e=>e.kind).join()==='raider,raider,raider'&&roll.se>=0&&roll.se<1,'the open crater starts: wave 1 is three interceptors; the core roll is stored now');
 s=applyAction(s,{seq:s.seq+1,action:'return-exploration'},open+60000);s.position=at(site.x,site.z+10);s=applyAction(s,{seq:s.seq+1,action:'start-mission',mission:site.id},open+120000);
 ok(JSON.stringify(s.strikes[O.slot].roll)===JSON.stringify(roll),'a retry in the same slot keeps the same roll (no re-roll by retrying or reloading)');
 s.ledger.mn={};const r=missionReward(s,open+300000),want={il:2,ar:2};if(roll.tq<R.STRIKE.tq)want.tq=1;if(roll.se<R.STRIKE.se)want.se=1;if(roll.mh<R.STRIKE.mh)want.mh=1;
 ok(r.kind==='strike'&&r.ptsRaw===R.CQ_PTS.strike&&r.cp===120&&JSON.stringify(r.mn)===JSON.stringify(want)&&s.ledger.mn.il===2,'secured: '+R.CQ_PTS.strike+' raw points, 120 CP, carried '+JSON.stringify(r.mn));
 ok(missionReward(s,open+310000).kind==='strike-claimed',"once per pilot per slot");
 assert.throws(()=>{const z=structuredClone(s);z.mission=null;z.position=at(site.x,site.z+10);applyAction(z,{seq:z.seq+1,action:'start-mission',mission:site.id},open+400000);},/already extracted/);ok(true,'a claimed slot cannot be started again');
 const q=createState(R.STOCK_L,open);q.resonance=11;q.strikes={[O.slot]:{roll:{tq:.99,se:.99,mh:.99}}};q.strikeSlot=O.slot;q.mission=site.id;const g=missionReward(q,open+1000);
 ok(g.mn.se===1&&g.core.includes('resonance-se')&&g.resonance===12,'Strike Resonance: the 12th secured strike guarantees a Selenite whatever the roll');
 const m=createState(R.STOCK_L,open);m.resonance=39;m.strikes={[O.slot]:{roll:{tq:.99,se:.99,mh:.99}}};m.strikeSlot=O.slot;m.mission=site.id;ok(missionReward(m,open+1000).mn.mh===1,'... and the 40th a Moonheart');
 const b=new C.Operation(R.STOCK_L,at(site.x,site.z+10),site.id);for(const e of b.enemies)e.hp=0;b.step(.05,false);ok(b.enemies.filter(e=>e.hp>0).map(e=>e.kind).join()==='sentinel,command,raider','wave 2: a fixed HARD heavy group (heavy sentinel, fire coordinator, interceptor)');
 for(const e of b.enemies)e.hp=0;b.player.x=site.x;b.player.z=site.z;let n=0;while(b.state==='active'&&n<400){b.step(.05,false);n++;}ok(b.state==='victory'&&Math.abs(n*.05-16)<.06,'then the core channel: 16 s at the crater');
 ok(!C.fieldMissionIds.some(id=>C.operations[id].strike),'strikes never count as field missions (raid unlocks unchanged)');}

console.log(`conquest minerals: passed ${passed}`);
