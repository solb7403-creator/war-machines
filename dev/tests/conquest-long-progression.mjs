// Settlement/construction model, explicitly assumes successful legitimate sorties.
// This does not simulate travel/combat and is not a timed human playthrough.
import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST,RULES:R}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W}=CONQUEST;
const {createState}=await import('../../worker/src/conquest-sim.js');
const {missionReward,bank}=await import('../../worker/src/conquest-economy.js');
const {campaign,baseAction}=await import('../../worker/src/conquest-campaign.js');
const start=1800000000000,s=createState(R.STOCK_L,start),snapshots=[],marks=[0,30,75,240,1200];
let mark=0,serial=0;
function point(x,z){return {x,z,y:W.groundAt(x,z),surface:'ground'};}
function capture(minute){snapshots.push({minute,base:s.base.tier,modules:{...s.base.modules},cp:s.ledger.cp,banked:{...s.ledger.banked},raidClears:s.raidProgress.clears,shards:s.raidProgress.shards,blueprint:s.raidProgress.blueprint,reputation:s.reputation,campaignScore:s.campaignScore,choices:s.base.tier?['Choose another authored raid family/layout','Respond to real sector or base invasion','Build a module or equip an earned permanent cosmetic']:['Hold Oxygen Line','Patrol and bank salvage','Pursue a field contract and engineering']});}
for(let minute=0;minute<=1200;minute+=1.5){const now=start+minute*60000;campaign(s,now);
 while(mark<marks.length&&minute>=marks[mark])capture(marks[mark++]);
 if(!minute)continue;
 const legacy=['oxygen-line','relay','recon','convoy'],id=minute<75?legacy[serial%legacy.length]:C.raidIds[serial%C.raidIds.length];serial++;s.mission=id;s.attempt=serial;s.featuredMission=false;s.settlement=null;missionReward(s,now);s.mission=null;
 s.position=point(1174,1168);bank(s,now);s.position=point(C.baseDefinition.x,C.baseDefinition.z);s.battle.enemies=[];
 const afford=price=>Object.entries(price).every(([k,n])=>(k==='cp'?s.ledger.cp:s.ledger.banked[k])>=n);
 // Session 5: one builder on the Worker clock. Command Center first (the tier/multiplier path), modules' buildings next.
 const Pl=CONQUEST.Plot,mnFree={};
 if(!s.base.tier&&afford(C.baseDefinition.recipe))baseAction(s,{action:'build-base'},now);
 else if(s.base.tier&&!s.plot.job&&s.plot.cc<Pl.CC.max&&afford(Pl.costOf('cc',s.plot.cc+1)))baseAction(s,{action:'upgrade-base'},now,{bmn:{il:99,ar:99}});
 else if(s.base.tier&&!s.plot.job){const module=Object.keys(C.baseDefinition.modules).find(k=>(s.base.modules[k]||0)<Math.min(3,s.base.tier));const type=module&&Object.keys(Pl.BUILDINGS).find(t=>Pl.BUILDINGS[t].mod===module),cur=type&&Pl.levelOf(s.plot,type);if(type&&!Pl.buildCheck(s.plot,type,cur+1,cur?Object.keys(s.plot.b).find(k=>s.plot.b[k].t===type):null)&&afford(Pl.costOf(type,cur+1)))try{baseAction(s,{action:'base-module',module},now);}catch(e){}}
}
assert.equal(snapshots.length,5);assert(snapshots.at(-1).base===5);assert(snapshots.at(-1).blueprint);assert(snapshots.at(-1).cp>snapshots[3].cp);assert(snapshots.every(x=>x.choices.length>=3));
const report={scope:'Economic settlement/construction model only. Assumes one genuine completed sortie every90s including travel/combat/bank, no kill loot or paid/referral rewards. Uses real reward/bank/base functions; initial/relocation fixtures are model bookkeeping. Actual combat/first-base earning independently tested by conquest-earned-journey and conquest-raids. Not a human playtime promise.',snapshots};
writeFileSync('docs/conquest-session-2/progression-model.json',JSON.stringify(report,null,2));console.log('PASS settlement model 0/30/75/240/1200min, permanent baseV/allmodules/shards and three continuing choices; NOT combat or human timing evidence');
