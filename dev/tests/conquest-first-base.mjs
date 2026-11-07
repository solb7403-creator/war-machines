// First Command Base pacing with raids: old rule (raids from minute 0) vs owner rule (raids after the six field missions,
// harder raids). Transparent model, not a recorded human playtest. Real Worker settlement (missionReward) and banking.
import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{Combat:C},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState}=await import('../../worker/src/conquest-sim.js');const {missionReward,bank}=await import('../../worker/src/conquest-economy.js');
const recipe=C.baseDefinition.recipe,field=C.fieldMissionIds,hard=C.raidIds.filter(id=>C.operations[id].danger==='HARD');
// Assumptions (seconds per attempt, including driving, combat, repair and banking). Starter-gear HARD raid success comes from
// the authoritative scripted-pilot calibration: before 10/10, after 7/10 (dev/tests/conquest-raids.mjs, raid-difficulty.json).
const PACES={brisk:{fieldCycle:90,raidCycle:150,failedRaidCycle:120,oldRaidCycle:120,raidWins:{old:10,new:7}},ordinary:{fieldCycle:120,raidCycle:200,failedRaidCycle:160,oldRaidCycle:160,raidWins:{old:10,new:7}}};let ASSUME;
function model(rule){const start=1800000000000,s=createState(R.STOCK_L,start);let now=start,i=0,raidTurn=0,attempt=0,cleared=new Set();
 const unlocked=()=>rule==='old'||field.every(id=>cleared.has(id)),ready=id=>{const c=s.missionClaims?.[id];return !c||now-(c.lastAt||c.firstAt)>=180000;};
 while(now-start<4*3600000){i++;let id=null,seconds=ASSUME.fieldCycle,won=true;
  if(unlocked()&&i%2===0){id=hard[raidTurn%hard.length];raidTurn++;won=(raidTurn-1)%10<ASSUME.raidWins[rule];seconds=won?(rule==='old'?ASSUME.oldRaidCycle:ASSUME.raidCycle):ASSUME.failedRaidCycle;}
  else id=field.find(x=>!cleared.has(x)&&ready(x))||field.find(ready)||field[i%field.length];
  now+=seconds*1000;if(won&&(C.operations[id].raid||ready(id))){s.mission=id;s.attempt=++attempt;s.featuredMission=false;missionReward(s,now);s.mission=null;cleared.add(id);}
  s.position={x:1174,z:1168,y:0,surface:'ground'};bank(s,now);
  if(Object.entries(recipe).every(([k,n])=>(k==='cp'?s.ledger.cp:s.ledger.banked[k])>=n))return {rule,baseMinute:Math.round((now-start)/600)/100,raidsAttempted:raidTurn,fieldMissionsCleared:[...cleared].filter(x=>field.includes(x)).length};}
 return {rule,baseMinute:null};}
const rows=Object.entries(PACES).map(([pace,a])=>{ASSUME=a;return {pace,assumptions:a,old:model('old'),new:model('new')};});
console.log(JSON.stringify({recipe,rows,modeled:true,physicalHumanPlaytest:false},null,2));
for(const r of rows){assert(r.old.baseMinute&&r.new.baseMinute,'both rules reach Base I');assert(r.new.baseMinute>r.old.baseMinute,'gated, harder raids slow the first base');}
// Owner kept raid rewards unchanged; the remaining gap to the 45-75 minute target is reported, not hidden or forced.
writeFileSync('docs/conquest-session-2/first-base-model.json',JSON.stringify({generatedBy:'dev/tests/conquest-first-base.mjs',recipe,rows,target:'45-75 min',note:'Raid rewards unchanged by owner decision; kill salvage, featured bonuses and production excluded (slower than real).',modeled:true,physicalHumanPlaytest:false},null,2)+'\n');
console.log('PASS first Command Base (modeled): '+rows.map(r=>r.pace+' '+r.old.baseMinute+' -> '+r.new.baseMinute+' min').join(' · ')+' (old rule -> owner rule)');
