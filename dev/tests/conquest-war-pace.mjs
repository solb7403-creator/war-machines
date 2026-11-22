// Session 7 owner decisions 6 and 11: Fortify level 1 costs about half a day of a regular pilot's Conquest income (the economy model's
// regular: 60 min a day), and no war system can be maxed by a regular free player in under about a year: with EVERY bonus on (the
// supply bonus included, War Orders, the town's full production) a regular who puts every CP, alloy and He-3 into Fortify needs at
// least a year (365 days) to fortify all 12 capturable human territories to level 5, before wear. Fails if faster. The model is
// dev/tools/war-model.mjs (the real Worker reward, bank, claim, plot and War Order functions); its numbers go to
// docs/economy/war-model.json. Every other war system is bounded by this one or by the limits (tested in conquest-war.mjs): the
// supply bonus grows only with fortification levels (+0.4% a level), the Moon count is capped by the Inner Ring, generals' trophies
// are spread over the Citadel's acts.
import assert from 'node:assert/strict';import {writeFileSync,mkdirSync} from 'node:fs';
const {model}=await import('../tools/war-model.mjs');const m=model(120);
mkdirSync('docs/economy',{recursive:true});writeFileSync('docs/economy/war-model.json',JSON.stringify(m,null,1)+'\n');
for(const k of ['cp','alloy','helium'])assert(m.l1VsHalfDay[k]>=.9&&m.l1VsHalfDay[k]<=1.1,'Fortify level 1 is about half a day of a regular\'s income ('+k+': '+m.fortifyL1[k]+' vs half a day '+m.halfDay[k]+')');
console.log('PASS Fortify level 1 = '+m.fortifyL1.cp+' CP, '+m.fortifyL1.alloy+' alloy, '+m.fortifyL1.helium+' He-3: about half a day of the regular\'s '+m.incomePerDay.cp+' CP, '+m.incomePerDay.alloy+' alloy and '+m.incomePerDay.helium+' He-3');
const P=m.pace;assert(P.everyBonus.days>=365,'a regular free pilot with every bonus on maxes Fortify in '+P.everyBonus.days+' days: under a year');
assert(P.everyBonus.days<=P.noSupply.days,'the supply bonus only speeds it up');assert(P.everyBonus.supplyAtEnd<=.16,'supply never above +16%');
console.log('PASS year-long pace: every bonus on, all 12 capturable territories to level 5 in '+P.everyBonus.days+' days (without the supply '+P.noSupply.days+'; level 1 everywhere day '+P.everyBonus.milestones.L1all+', level 3 day '+P.everyBonus.milestones.L3all+'); with the Lunar Pass (when the store opens) '+P.lunarPass.days+' days');
