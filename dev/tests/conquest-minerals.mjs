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
const VN=await import('../../worker/src/conquest-veins.js');const {publicState}=await import('../../worker/src/conquest.js');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
const step=(s,cmd,now)=>applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0,...cmd}]},now);
const fresh=(x,z,t)=>{const s=createState(R.STOCK_L,t);s.position=at(x,z);s.battle.enemies=[];s.lastWall=t;s.creditMs=0;return s;};

// ---- deposits: approved counts, placement, every node reachable and clear ----
{const by=m=>W.deposits.filter(d=>d.m===m);
 ok(by('starter').length===1&&by('fe').length===36&&by('il').length===19&&by('ar').length===10&&by('tq').length===6,'vein spots: Starter Vein 1, Ferrite 36, Ilmenite 19, Armalcolite 10, Tranquillityite 6 (§5.2; +1 Ilmenite in Oxygen Spear and +1 Tranquillityite on Refuge Ridge so every field has 2+ spots)');
 ok(VN.FIELDS.every(f=>f.spots.length>=2)&&VN.SLOTS.length===17&&VN.SLOTS.filter(x=>x.field.m==='fe').length===7,'16 (mineral, sector) fields, each with 2+ candidate spots; 17 live veins (7 Ferrite, 4 Ilmenite, 3 Armalcolite, 3 Tranquillityite)');
 ok(W.sectors.every(sc=>by('fe').filter(d=>Math.hypot(d.x-sc.x,d.z-sc.z)<=sc.radius).length>=2),'Ferrite in every sector (2+ each)');
 ok(by('tq').every(d=>[[1260,845],[1320,1010],[1290,1210],[1240,920],[1230,995]].some(([x,z])=>Math.hypot(d.x-x,d.z-z)<=50)),'Tranquillityite only at VETERAN raid perimeters and hive edges');
 ok(W.deposits.every(d=>!W.solidAt(d.x,d.z)&&!W.waterAt(d.x,d.z)&&!W.forestAt(d.x,d.z)&&W.deckAt(d.x,d.z)===null&&W.floraNodes.every(f=>Math.hypot(f.x-d.x,f.z-d.z)>=14)),'every deposit is clear of structures, water, forests, decks and bio-flora');
 const G=6,x0=640,x1=1460,z0=760,z1=1440,key=(x,z)=>Math.round((x-x0)/G)+':'+Math.round((z-z0)/G),seen=new Map(),queue=[at(898,1024)];seen.set(key(898,1024),queue[0]);
 for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dz] of [[G,0],[-G,0],[0,G],[0,-G]]){const q=W.advance(p,dx,dz);if(Math.hypot(q.x-p.x-dx,q.z-p.z-dz)>1.2||q.x<x0||q.x>x1||q.z<z0||q.z>z1)continue;const k=key(q.x,q.z);if(!seen.has(k)){seen.set(k,q);queue.push(q);}}}
 const reached=(x,z,r)=>{for(const q of seen.values())if(Math.hypot(q.x-x,q.z-z)<=r)return true;return false;};
 const lost=W.deposits.filter(d=>!reached(d.x,d.z,W.HARVEST.radius)),lostStrike=C.strikeSites.filter(t=>!reached(t.x,t.z,8));
 ok(!lost.length&&!lostStrike.length,'all '+W.deposits.length+' deposits and all 8 strike cores reachable from the spawn'+(lost.length?' missing '+lost.map(d=>d.id):'')+(lostStrike.length?' missing '+lostStrike.map(d=>d.id):''));}

// ---- scanner pulse: 150 m (+50 per Radar level), 30 s cooldown; reveals this pilot's live veins only ----
const t0=Date.UTC(2026,10,9,10,0,0);
const live=s=>Object.values(s.lodes.slots).map(v=>W.deposits.find(d=>d.id===v.spot));
{let s=fresh(1174,1172,t0),now=t0+50;const want=live(s).filter(d=>Math.hypot(d.x-1174,d.z-1172)<=150);s=step(s,{scan:true},now);const pub=publicState(s);
 ok(s.scanAt===now&&s.notice.kind==='scan'&&s.notice.radius===150&&s.notice.found===want.length+1&&want.every(d=>pub.veins[d.id]?.left===R.MN_VEIN[d.m].cap)&&s.found['starter-01'],'scan at the Refuge: the Starter Vein + '+want.length+' live vein(s) within 150 m on the MAP, each full');
 const empty=W.deposits.filter(d=>d.m!=='starter'&&Math.hypot(d.x-1174,d.z-1172)<=150&&!want.includes(d));ok(empty.length>0&&empty.every(d=>!pub.veins[d.id]),'empty candidate spots inside the radius stay invisible ('+empty.length+' spots without a live vein)');
 ok(!pub.lodes&&Object.keys(pub.veins).length===want.length&&!JSON.stringify(pub).includes(String(s.lodes.seed)),'public state: scanned veins only, never the seed or an unscanned vein');
 const n0=Object.keys(pub.veins).length;now+=29000;s=step(s,{scan:true},now);ok(s.scanAt===t0+50,'a second pulse inside 30 s does nothing (cooldown)');
 s.position=at(1080,1060);now+=1500;s=step(s,{scan:true},now);ok(s.scanAt===now&&Object.keys(publicState(s).veins).length>=n0,'after 30 s it pulses again; earlier finds stay on the MAP');
 const r=fresh(1174,1172,t0);r.base={tier:2,modules:{radar:2},defense:{}};const rr=step(r,{scan:true},t0+50);ok(rr.notice.radius===250,'Radar module level 2: 250 m pulse');}

// ---- veins: a few pulls, EXHAUSTED for days, a new vein elsewhere in the sector after the regrow, hidden until a SCAN ----
const pullAll=(s,now,ms)=>{for(let i=0;i<ms/50;i++){now+=50;s=step(s,{gather:true},now);}return [s,now];};
const idle=(s,now)=>{s.lastWall=now-1000;s.creditMs=0;return step(s,{},now);};
// Tests pin a slot to a known spot (the live spots are seeded per pilot at random, so an unpinned test could land in a fight).
const pin=(s,spot)=>{const id=Object.keys(s.lodes.slots).find(k=>VN.SLOTS.find(x=>x.id===k).field.spots.includes(spot));for(const [k,v] of Object.entries(s.lodes.slots))if(k!==id&&v.spot===spot)v.spot=VN.SLOTS.find(x=>x.id===k).field.spots.find(z=>z!==spot&&!Object.values(s.lodes.slots).some(w=>w.spot===z));s.lodes.slots[id].spot=spot;s.lodes.seed=424242;return id;};
{const t=Date.UTC(2026,10,9,11);let s=fresh(1174,1172,t),now=t;const slot=pin(s,'fe-01'),d=W.deposits.find(x=>x.id==='fe-01');
 s.position=at(d.x+2,d.z);[s,now]=pullAll(s,now,6000);ok(!s.channel&&!(s.ledger.mn.fe>0),'an unscanned vein cannot be gathered');
 now+=31000;s.lastWall=now-1000;s=step(s,{scan:true},now);[s,now]=pullAll(s,now,4950);ok(s.channel?.ms===4950&&!(s.ledger.mn.fe>0),'Ferrite: 99 steps (4.95 s) channel, nothing yet');
 now+=50;s=step(s,{gather:true},now);const got=s.ledger.mn.fe;
 ok(got>=2&&got<=4&&s.notice.kind==='mineral'&&s.notice.units===got&&s.notice.left===12-got&&!s.notice.exhausted,'5 s pull: +'+got+' Ferrite (2-4, server roll) into cargo; the vein still holds '+(12-got)+' of 12');
 A.seal(s,now);ok(A.airdrop(s).out.at(-1).raw===R.CQ_PTS.gather.fe&&A.activeToday(s,now),'a Ferrite pull pays '+R.CQ_PTS.gather.fe+' points and is the day\'s verified activity');
 let pulls=1;for(const e of s.battle.enemies)e.hp=0;while(s.lodes.slots[slot].left>0&&pulls<12){[s,now]=pullAll(s,now,5050);pulls++;}   // a quiet sector: gathering noise draws Parasites, which would break the channel
 ok(s.ledger.mn.fe===12&&pulls>=3&&pulls<=6&&s.notice.exhausted&&s.notice.regrowMs===R.MN_VEIN.fe.regrowMs&&s.lodes.slots[slot].dry>0,'the vein runs dry after '+pulls+' pulls (12 Ferrite in total, never more than it holds): EXHAUSTED');
 [s,now]=pullAll(s,now,6000);ok(s.ledger.mn.fe===12,'an exhausted vein cannot be gathered again');
 ok(publicState(s).veins[d.id]?.left===0&&publicState(s).veins[d.id]?.dry===s.lodes.slots[slot].dry,'the MAP shows it EXHAUSTED');
 now+=R.MN_VEIN.dryShowMs+1000;s=idle(s,now);ok(!publicState(s).veins[d.id],'... and after '+R.MN_VEIN.dryShowMs/60000+' min it disappears');
 now=s.lodes.slots[slot].next-60000;s=idle(s,now);ok(s.lodes.slots[slot].left===0&&s.lodes.slots[slot].spot===d.id,'5 h 59 min later: still dry (it never refills in minutes or hours at the same spot)');
 now+=61000;s=idle(s,now);const nv=s.lodes.slots[slot],nd=W.deposits.find(x=>x.id===nv.spot);
 ok(nv.left===12&&nv.spot!==d.id&&VN.SLOTS.find(x=>x.id===slot).field.spots.includes(nv.spot)&&W.frontierSectorAt(nd.x,nd.z).id==='refuge'&&!nv.seen&&!publicState(s).veins[nv.spot],'6 h after it ran dry a new Ferrite vein surfaces at another Refuge Corridor spot ('+d.id+' -> '+nv.spot+'), hidden until a SCAN');
 const twins=Object.entries(s.lodes.slots).filter(([k])=>k.startsWith('fe:refuge:')).map(([,v])=>v.spot);ok(new Set(twins).size===twins.length,'two live veins of a field never share a spot');
 s.position=at(nd.x+2,nd.z);now+=31000;s.lastWall=now-1000;s=step(s,{scan:true},now);ok(publicState(s).veins[nv.spot]?.left===12,'a SCAN there reveals it, full');
 const q=fresh(1174,1172,t),q2=fresh(1174,1172,t);ok(q.lodes.seed!==q2.lodes.seed,'each pilot gets a server-only seed (per-pilot clocks and spots, no griefing)');
 const tq=Object.entries(s.lodes.slots).find(([id])=>id.startsWith('tq:'))[1];ok(R.MN_VEIN.tq.regrowMs===5*86400000&&R.MN_VEIN.ar.regrowMs===2*86400000&&R.MN_VEIN.il.regrowMs===12*3600000&&tq.left===3,'regrow delays: Ferrite 6 h, Ilmenite 12 h, Armalcolite 2 days, Tranquillityite 5 days; a Tranquillityite vein holds 3');
 const td=W.deposits.find(x=>x.id==='tq-01');let ts=fresh(td.x+2,td.z,t),tn=t+50;const T=pin(ts,'tq-01');ts.lodes.slots[T].seen=1;[ts,tn]=pullAll(ts,tn,15950);ok(!ts.ledger.mn.tq,'Tranquillityite: 15.95 s, nothing yet');
 tn+=50;ts=step(ts,{gather:true},tn);ok(ts.ledger.mn.tq===1&&ts.notice.left===2,'16 s pull: 1 Tranquillityite; the vein holds 2 more');}

// ---- migration from the Phase 3 respawning deposits ----
{const t=Date.UTC(2026,10,9,11,30),s=createState(R.STOCK_L,t);delete s.lodes;s.found={'starter-01':1,'fe-01':1,'fe-02':1,'il-05':1};s.deposits={'starter-01':1,'fe-01':t+60000};s.ledger.mn={fe:4};s.ledger.cp=777;s.lastWall=t;s.creditMs=0;
 const m=applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0}]},t+50),pub=publicState(m);
 ok(m.lodes?.v===1&&Object.keys(m.lodes.slots).length===17&&m.deposits['starter-01']===1&&m.found['starter-01']===1&&!m.found['fe-02']&&!m.deposits['fe-01']&&m.ledger.mn.fe===4&&m.ledger.cp===777,'old save migrates: 17 fresh veins, the Starter Vein stays used, carried minerals and CP untouched, old respawn clocks dropped');
 const f2=Object.values(m.lodes.slots).find(v=>v.spot==='fe-02');ok(f2&&f2.seen&&pub.veins['fe-02']?.left===12,'a deposit the pilot had found (and was ready) becomes a live vein already on their MAP');
 ok(!Object.values(m.lodes.slots).some(v=>v.spot==='fe-01'&&v.seen),'a deposit still on its old respawn clock is not pre-revealed');}

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
 ok(s.territory[site.sector]?.status!=='contested'&&!s.territory[site.id]&&!s.contestPrevious,'a strike never contests its sector or leaves a fake territory entry (review fix)');
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
