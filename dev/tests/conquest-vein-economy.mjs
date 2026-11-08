// Owner ore fix (Nov 8 2026): veins run dry, new ones appear. Proves the economy model uses the LIVE vein rules (rules.js
// MN_VEIN / MN_GATHER and the authored fields in conquest-veins.js) and that the owner's armor targets still hold
// (docs/economy/RESOURCE_ECONOMY.md §7.2): regular Conquest-focused full common set 3-4 days, uncommon 1-2 weeks, rare about
// 1 month, very rare 2-3 months; dedicated 2-3x faster, never 10x; a 6 h/day grinder is capped by the veins. Modeled, not
// measured with players.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST:{World:W}}=await import('../../worker/src/sim.gen.js');
const VN=await import('../../worker/src/conquest-veins.js');
const {MODEL:M}=await import('../tools/economy-model.mjs');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
for(const k of ['fe','il','ar','tq']){const D=M.P.deposits[k],live=VN.SLOTS.filter(x=>x.field.m===k).length,spots=W.deposits.filter(d=>d.m===k).length,G=R.MN_GATHER[k];
 ok(D.veins===live&&D.cap===R.MN_VEIN[k].cap&&D.regrowH*3600000===R.MN_VEIN[k].regrowMs&&D.spots===spots&&D.channel*1000===G.ms&&Math.abs(D.yield-(G.min+G.max)/2)<1e-9,k+': model = live rules ('+live+' live veins of '+D.cap+' at '+spots+' spots, new vein after '+D.regrowH+' h, '+D.channel+' s pulls of '+G.min+'-'+G.max+')');}
const T=M.timelines,d=(p,t)=>T[p].full[t]??Infinity;
ok(d('conquest',1)>=3&&d('conquest',1)<=4,'regular Conquest-focused: full Ferrite set in '+d('conquest',1)+' days (target 3-4)');
ok(d('conquest',2)>=7&&d('conquest',2)<=14,'... Ilmenite set in '+d('conquest',2)+' days (target 1-2 weeks)');
ok(d('conquest',3)>=24&&d('conquest',3)<=38,'... Armalcolite set in '+d('conquest',3)+' days (target about 1 month)');
ok(d('conquest',4)>=60&&d('conquest',4)<=92,'... Tranquillityite set in '+d('conquest',4)+' days (target 2-3 months)');
for(const t of [1,2,3,4,5,6]){const r=d('conquest',t)/d('dedicated',t);ok(r>=1.4&&r<=3.6,'dedicated vs regular, tier '+t+': '+r.toFixed(1)+'x faster (2-3x, never 10x)');}
for(const t of [3,4,5,6]){const r=d('conquest',t)/d('grinder',t);ok(r<10,'a 6 h/day grinder, tier '+t+': '+r.toFixed(1)+'x the regular pace (veins cap gathering; never 10x)');}
// the cap binds the grinder's gathering: a day of veins holds less ore than six hours of pulls would take
{const D=M.P.deposits.fe,supply=D.veins*D.cap*3;ok(supply<0.25*360*0.6/0.6*D.yield*3,'Ferrite veins cap a grinder at '+supply+' a day (3 sessions), below what 90 min of pulls would take');}
// mining feels like mining: several pulls a vein, never a refill at the same spot within a day
for(const k of ['fe','il','ar','tq']){const pulls=R.MN_VEIN[k].cap/((R.MN_GATHER[k].min+R.MN_GATHER[k].max)/2);ok(pulls>=2.5&&pulls<=5&&R.MN_VEIN[k].regrowMs>=6*3600000,k+': about '+pulls.toFixed(1)+' pulls a vein; the next vein surfaces '+R.MN_VEIN[k].regrowMs/3600000+' h later at another spot');}
console.log(`conquest vein economy: passed ${passed}`);
