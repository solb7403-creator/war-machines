// Transparent ordinary-play pacing model, not a claim of a recorded 75-minute human playtest.
// Uses real server settlement and bank actions. No production data, no client reward claims.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{Combat:C},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState}=await import('../../worker/src/conquest-sim.js');
const {missionReward,bank}=await import('../../worker/src/conquest-economy.js');
const {baseAction}=await import('../../worker/src/conquest-campaign.js');
const recipe=C.baseDefinition.recipe,rows=[];
// Each contract cycle allows fighting, manual aim/targeting, salvage, driving and banking.
// 90s is deliberately explicit; these allowances are estimates. Fast perfect bots earn sooner.
for(const cycleSeconds of [75,90]){
 const start=1800000000000,s=createState(R.STOCK_L,start),ids=['oxygen-line','relay','recon','convoy'];let baseMinute=null,firstUpgrade=null,now=start;
 for(let i=0;i<3*3600/cycleSeconds;i++){
  now=start+(i+1)*cycleSeconds*1000;s.mission=ids[i%ids.length];s.featuredMission=false;missionReward(s,now);s.mission=null;
  s.position={x:1174,z:1168,y:0,surface:'ground'};bank(s,now);
  if(!firstUpgrade&&s.ledger.cp>=100&&s.ledger.banked.alloy>=4)firstUpgrade=(now-start)/60000;
  if(!baseMinute&&Object.entries(recipe).every(([k,n])=>(k==='cp'?s.ledger.cp:s.ledger.banked[k])>=n)){
   s.position={x:C.baseDefinition.x,z:C.baseDefinition.z,y:0,surface:'ground'};s.battle.enemies=[];baseAction(s,{action:'build-base'},now);baseMinute=(now-start)/60000;
  }
 }
 assert(baseMinute>=45&&baseMinute<=75,`first base at ${baseMinute}min with ${cycleSeconds}s cycles`);assert(s.ledger.cp>recipe.cp,'progress continues for three hours');
 rows.push({cycleSeconds,firstUpgradeMinute:firstUpgrade,baseMinute,after3h:{cp:s.ledger.cp,banked:s.ledger.banked},assumptions:'Four standard contracts, 75–90s each including travel/combat/banking; no world kill loot, featured bonuses, production, purchases, referrals or rank spending. Model settlement only; physical travel is separately tested.'});
}
console.log(JSON.stringify({recipe,modeled:true,physicalHumanPlaytest:false,rows},null,2));
