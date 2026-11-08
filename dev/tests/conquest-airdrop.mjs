// Conquest airdrop points inside the authoritative Conquest sim (no account): which outcomes pay, the Command Base
// multiplier, the hourly outcome limit, held operation kills, immutable outbox entries with a spill, and the Daily Base
// Yield clocks (fill, 10% minimum, 24 h stop, points need the day's first operation). docs/economy/RESOURCE_ECONOMY.md §3.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST:{World:W,Combat:C}}=await import('../../worker/src/sim.gen.js');
const {createState,applyAction,applyCommands,refreshState}=await import('../../worker/src/conquest-sim.js');
const {missionReward,killLoot}=await import('../../worker/src/conquest-economy.js');
const A=await import('../../worker/src/conquest-airdrop.js');
const t0=Date.UTC(2026,10,9,9,0,0),at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const raw=s=>(A.airdrop(s).pend?.raw||0);

// ---- what pays: a world kill once per spawn generation; operation completions by danger; cooldowns never pay ----
{const s=createState(R.STOCK_L,t0),e=s.battle.enemies.find(x=>x.base?.kind==='patrol');e.hp=0;
 killLoot(s,e,t0);killLoot(s,e,t0+1000);const k=R.CQ_PTS.kill[e.kind==='command'||e.kind==='sentinel'?'heavy':'light'];
 ok(raw(s)===k&&A.airdrop(s).pend.n.kill===1,'a world kill pays '+k+' once; re-processing the same dead unit pays nothing');
 s.mission='convoy';s.attempt=1;s.featuredMission=false;const r1=missionReward(s,t0+60000);
 ok(r1.ptsRaw===R.CQ_PTS.field&&A.activeToday(s,t0+60000),'field mission: '+R.CQ_PTS.field+' raw, and it is the day\'s verified operation');
 const r2=missionReward(s,t0+90000);ok(r2.kind==='cooldown'&&!r2.ptsRaw&&raw(s)===k+R.CQ_PTS.field,'a replay inside the 3-minute contract reset pays no points');
 const hard=C.raidIds.find(id=>C.operations[id].danger==='HARD'),vet=C.raidIds.find(id=>C.operations[id].danger==='VETERAN');
 s.mission=hard;s.attempt=2;const h=missionReward(s,t0+300000);s.mission=vet;s.attempt=3;const v=missionReward(s,t0+600000);
 ok(h.ptsRaw===R.CQ_PTS.raid.HARD&&v.ptsRaw===R.CQ_PTS.raid.VETERAN,'raids pay by authored danger: HARD '+R.CQ_PTS.raid.HARD+', VETERAN '+R.CQ_PTS.raid.VETERAN);
 s.mission=vet;s.attempt=3;const again=missionReward(s,t0+900000);ok(again===v&&raw(s)===k+R.CQ_PTS.field+R.CQ_PTS.raid.HARD+R.CQ_PTS.raid.VETERAN,'a raid receipt replayed for the same attempt pays no second time');}

// ---- the Command Base multiplier applies to active play only ----
{for(const [tier,m] of [[0,1],[1,1.05],[3,1.15],[5,1.25]]){const s=createState(R.STOCK_L,t0);s.base.tier=tier;A.earn(s,'field',450,t0,{op:true});assert.equal(raw(s),Math.round(450*m*100)/100);}
 ok(true,'Command Base multiplier x1.00 / x1.05 / x1.15 / x1.25 on Conquest active-play points');
 const s=createState(R.STOCK_L,t0);s.base.tier=5;A.earn(s,'yield',2600,t0,{flat:true});ok(raw(s)===2600,'the Daily Base Yield is flat (its table is already per tier)');}

// ---- rate limit: at most CQ_PTS.hourMax points-paying outcomes an hour ----
{const s=createState(R.STOCK_L,t0);let paid=0;for(let i=0;i<R.CQ_PTS.hourMax+5;i++)if(A.earn(s,'kill',35,t0+i*1000))paid++;
 ok(paid===R.CQ_PTS.hourMax&&A.airdrop(s).limited===5,'hourly outcome limit: '+R.CQ_PTS.hourMax+' paid, 5 refused and counted');
 ok(A.earn(s,'kill',35,t0+3600000)===35,'the limit resets with the next UTC hour');}

// ---- held operation kills: discarded by a victory, paid as effort when the operation fails or is abandoned ----
{const s=createState(R.STOCK_L,t0);s.mission='convoy';s.attempt=1;const e={kind:'raider',hp:0,rewardKey:'convoy:test',x:1090,y:0,z:944};
 killLoot(s,e,t0);ok(raw(s)===0&&A.airdrop(s).opk.v===35,'a kill inside an operation is held, not paid');
 s.featuredMission=false;missionReward(s,t0+1000);ok(!A.airdrop(s).opk&&raw(s)===R.CQ_PTS.field,'victory: the completion pays; held kills are discarded (no double pay)');
 const f=createState(R.STOCK_L,t0);f.mission='convoy';f.attempt=1;killLoot(f,{...e,lootCreated:false,rewardKey:'convoy:b'},t0);A.settleOpKills(f,t0+2000);
 ok(raw(f)===35&&A.airdrop(f).pend.n.effort===1,'failed or abandoned operation: the verified kills inside it pay at the world rate');
 const g=createState(R.STOCK_L,t0);g.mission='convoy';g.attempt=1;killLoot(g,{...e,lootCreated:false,rewardKey:'convoy:c'},t0);killLoot(g,{...e,lootCreated:false,rewardKey:'convoy:c'},t0);
 ok(A.airdrop(g).opk.v===35,'the same operation kill key pays at most once a day (daily mission-kill key)');
 const n=createState(R.STOCK_L,t0);n.mission='convoy';n.attempt=1;killLoot(n,{...e,lootCreated:false,noLoot:true,rewardKey:'convoy:d'},t0);ok(!A.airdrop(n).opk,'raid reinforcement waves (noLoot) never pay');}

// ---- immutable entries: one per request, monotonic ids, spill when the outbox is full ----
{const s=createState(R.STOCK_L,t0);A.earn(s,'kill',35,t0);A.earn(s,'kill',35,t0);A.played(s,4000);A.seal(s,t0);
 const a=A.airdrop(s);ok(a.out.length===1&&a.out[0].id===1&&a.out[0].raw===70&&a.out[0].n.kill===2&&a.out[0].ms===4000,'one request: one entry {id 1, raw 70, 2 kills, 4 s of play}');
 A.seal(s,t0+1);ok(a.out.length===1,'a request without outcomes writes no entry');
 const frozen=JSON.stringify(a.out[0]);A.earn(s,'field',450,t0+2,{op:true});A.seal(s,t0+2);ok(JSON.stringify(a.out[0])===frozen&&a.out[1].id===2&&a.out[1].op===1,'later outcomes never modify an earlier entry');
 for(let i=0;i<A.OUTBOX_MAX+3;i++){A.earn(s,'kill',35,t0+10+i);A.seal(s,t0+10+i);}
 ok(a.out.length===A.OUTBOX_MAX&&a.spill?.raw===35*5,'outbox full ('+A.OUTBOX_MAX+'): new outcomes wait in a spill the account never reads');
 A.acknowledge(s,a.out.at(-1).id,{pay:1.18});A.seal(s,t0+999);ok(a.out.length===1&&!a.spill&&a.out[0].raw===35*5&&a.view.pay===1.18,'after acknowledgement the spill becomes the next immutable entry');
 ok(A.estimate(s,1000)===1180,'display estimate uses the last league pay read from the account');}

// ---- credit timing: an operation at once; kills batch for 20 s or 8 entries ----
{const s=createState(R.STOCK_L,t0);A.earn(s,'kill',35,t0);A.seal(s,t0);ok(!A.due(s,t0+1000)&&A.due(s,t0+A.CREDIT_AFTER_MS),'a lone kill waits '+A.CREDIT_AFTER_MS/1000+' s');
 A.earn(s,'field',450,t0+2000,{op:true});A.seal(s,t0+2000);ok(A.due(s,t0+2000),'an operation completion credits at once');}

// ---- Daily Base Yield through the real base action ----
{const d=C.baseDefinition,s=createState(R.STOCK_L,t0);s.position=at(d.x,d.z);s.battle.enemies=[];s.ledger.cp=100000;s.ledger.banked={alloy:10000,biomass:10000,helium:10000};
 let a=applyAction(s,{seq:1,action:'build-base'},t0);ok(a.base.claimedAt===t0&&a.base.pointsAt===t0,'building Base I starts both yield clocks');
 assert.throws(()=>applyAction(structuredClone(a),{seq:2,action:'base-claim'},t0+3600000),/produ.*4%/);ok(true,'at 4% the yield cannot be collected (minimum 10%)');
 const banked={...a.ledger.banked},cp=a.ledger.cp;a=applyAction(a,{seq:2,action:'base-claim'},t0+43200000);
 const half=C.baseYield({...a.base,claimedAt:t0},a.reputation,t0+43200000);
 ok(a.ledger.cp-cp===half.cp&&a.ledger.banked.alloy-banked.alloy===Math.floor(R.CQ_YIELD.alloy[1]*.5)&&a.notice.pointsHeld&&!raw(a),'12 h, no operation today: 50% of CP and materials banked; the points part is held');
 ok(a.base.pointsAt===t0&&a.base.claimedAt===t0+43200000,'the points clock keeps filling while it waits (materials clock reset)');
 A.earn(a,'field',450,t0+43300000,{op:true});A.seal(a,t0+43300000);const p0=raw(a)+A.airdrop(a).out.reduce((x,e)=>x+e.raw,0);
 a=applyAction(a,{seq:3,action:'base-claim'},t0+43400000);A.seal(a,t0+43400000);const got=A.airdrop(a).out.at(-1);   // the Worker seals every request
 ok(got.n.yield===1&&got.raw===Math.floor(R.CQ_YIELD.pts[1]*(43400000/86400000))&&a.base.pointsAt===t0+43400000,'after the day\'s first operation the held points part pays ('+got.raw+' of '+R.CQ_YIELD.pts[1]+' at 50%)');
 const late=structuredClone(a);late.base.claimedAt=t0-5*86400000;late.base.pointsAt=t0-5*86400000;const y=C.baseYield(late.base,late.reputation,t0+43500000);
 ok(y.fill===1&&y.pointsFill===1&&y.pts===R.CQ_YIELD.pts[1],'five days away: each clock stops at one full 24 h fill (no stockpile)');
 const far=structuredClone(a);far.position=at(d.x+60,d.z);assert.throws(()=>applyAction(far,{seq:4,action:'base-claim'},t0+86400000*2),/terminal/);ok(true,'collection needs the physical Command Base terminal (not the MAP)');
 const legacy=createState(R.STOCK_L,t0);legacy.base={tier:2,modules:{},builtAt:t0-9e8,claimedAt:t0-1000};delete legacy.base.pointsAt;refreshState(legacy,t0);ok(legacy.base.pointsAt===t0-1000,'existing bases migrate: the points clock starts at the old claim time');}

console.log(`conquest airdrop (sim): passed ${passed}`);
