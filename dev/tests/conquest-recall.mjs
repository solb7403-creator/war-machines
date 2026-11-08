// RECALL and remote Command Base management (Worker-authoritative).
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {createState,applyCommands,applyAction}=await import('../../worker/src/conquest-sim.js');
const {passPremium}=await import('../../worker/src/conquest.js');
const C=CONQUEST.Combat,K=CONQUEST.Control,W=CONQUEST.World,D=C.baseDefinition;let now=1_800_000_000_000;
const act=(s,action,extra={},ctx={})=>applyAction(s,{seq:s.seq+1,action,...extra},now+=1000,ctx);
const quiet=(s,seconds)=>{for(let t=0;t<seconds;t+=2){s.creditMs=4000;s=applyCommands(s,{seq:s.seq+1,commands:Array(40).fill({x:0,z:0})},now+=2000);}return s;};
const atBase=s=>Math.hypot(s.position.x-D.x,s.position.z-D.z)<=D.radius;
const fresh=()=>{const s=createState(R.STOCK_L,now);s.position={x:1160,z:1030,y:W.groundAt(1160,1030),surface:'ground'};for(const e of s.battle.enemies)if(Math.hypot(e.x-1160,e.z-1030)<200)e.hp=0;s.ledger.cargo={alloy:33,biomass:21,helium:4};return s;};
// 1. Needs a built base; a 15 s channel of quiet simulated play recalls to the base; cargo stays carried; 10 min cooldown.
{let s=fresh();assert.throws(()=>act(structuredClone(s),'recall-start'),/build your Command Base first/);s.base.tier=1;
 s=act(s,'recall-start');assert.equal(s.recall.cooldownMs,C.RECALL.cooldownMs);const cargo=JSON.stringify(s.ledger);
 s=quiet(s,12);assert(!atBase(s)&&s.recall,'still channeling at 12 s');s=quiet(s,4);assert(atBase(s),'arrives at the Command Base after 15 s');assert(!s.recall);assert.equal(s.notice.kind,'recalled');
 assert.equal(K.baseBlocked({baseTier:1},s.position),false,'outside the base walls');assert.equal(JSON.stringify(s.ledger),cargo,'cargo stays unbanked until banked at the base');
 assert(s.recallReadyAt>now+C.RECALL.cooldownMs-10000&&s.recallReadyAt<=now+C.RECALL.cooldownMs,'10 minute cooldown recorded');
 assert.throws(()=>act(structuredClone(s),'recall-start'),/recall recharging/);}
// 2. Premium Lunar Pass owners (Worker-read entitlement) recharge in 5 minutes.
{let s=fresh();s.base.tier=2;s=act(s,'recall-start',{},{premium:true});assert.equal(s.recall.cooldownMs,C.RECALL.premiumCooldownMs);s=quiet(s,16);assert(atBase(s));assert(s.recallReadyAt-now<=C.RECALL.premiumCooldownMs);
 const season=R.ecoSeason({day:Math.floor(now/86400000)});assert.equal(passPremium({pass:{s:season,prem:true}},now),true);assert.equal(passPremium({pass:{s:season,prem:false}},now),false);assert.equal(passPremium({pass:{s:season-1,prem:true}},now),false,'last season pass is not premium now');assert.equal(passPremium({},now),false);}
// 3. Damage breaks the channel (verified by command replay); cancel and missions end it; no time passes without simulation.
{let s=fresh();s.base.tier=1;s=act(s,'recall-start');const e=s.battle.enemies.find(e=>e.kind==='raider');Object.assign(e,{hp:e.maxHp,x:s.position.x+14,z:s.position.z,y:s.position.y,home:{x:s.position.x+14,z:s.position.z,y:s.position.y+2.2},route:null});
 s=quiet(s,16);assert(!s.recall&&!atBase(s),'hostile fire broke the recall');assert(s.lastHitAt);}
{let s=fresh();s.base.tier=1;s=act(s,'recall-start');s=act(s,'recall-cancel');assert(!s.recall);s=quiet(s,16);assert(!atBase(s));assert.throws(()=>act(structuredClone(s),'recall-cancel'),/no recall/);}
{let s=fresh();s.base.tier=1;s=act(s,'recall-start');now+=60000;s=applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0}]},now);assert(s.recall&&s.recall.simMs===50&&!atBase(s),'wall time alone never completes the channel');}
{let s=fresh();s.base.tier=1;s.position={x:C.operations.relay.x,z:C.operations.relay.z,y:W.groundAt(C.operations.relay.x,C.operations.relay.z),surface:'ground'};s=act(s,'recall-start');s=act(s,'start-mission',{mission:'relay'});assert(!s.recall,'starting an operation ends the channel');assert.throws(()=>act(structuredClone(s),'recall-start'),/Finish or leave the operation/);}
// 4. Remote base command: upgrades and module construction from anywhere (not mid-operation); banking and production need the base.
{let s=fresh();s.base.tier=1;s.ledger.cp=1e6;s.ledger.banked={alloy:1e5,biomass:1e5,helium:1e5};s.base.claimedAt=now-2*86400000;
 s=act(s,'upgrade-base');assert.equal(s.plot.job.l,2,'remote Command Center upgrade queued');assert.throws(()=>act(structuredClone(s),'base-module',{module:Object.keys(D.modules)[0]}),/builder busy/,'one builder');now+=31000;s=act(s,'base-module',{module:Object.keys(D.modules)[0]});assert(s.plot.cc===2&&s.plot.job,'remote module queued once the builder is free');
 assert.throws(()=>act(structuredClone(s),'base-claim'),/approach physical Command Base/);assert.throws(()=>act(structuredClone(s),'repair-base'),/approach physical Command Base/);
 assert.throws(()=>act(structuredClone(s),'bank'),/approach Refuge supply terminal/,'banking needs the Refuge terminal or a Vault base');
 const m=structuredClone(s);m.mission='relay';assert.throws(()=>act(m,'upgrade-base'),/approach physical/);}
console.log('PASS recall: 15 s quiet channel, damage/cancel/mission break it, 10 min (5 min premium) cooldown, cargo unbanked; remote upgrades only');
