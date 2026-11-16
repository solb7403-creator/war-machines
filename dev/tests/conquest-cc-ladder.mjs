// Session 6 (owner Decisions 1 and 13, Nov 15 2026): the Command Center ladder. CC1 "claim your town" = 600 CP + 30 alloy + 15
// biomass + 2 He-3 (keeps x1.05); CC2 takes the rest of the old claim on top of its own old price, so the cumulative cost to CC2
// and to every level from CC4 up is unchanged; CC3 and CC4 are 2,200 CP each (Decision 13: cumulative to CC5 unchanged; CC3's own
// cumulative is 500 CP lower because 2,700 became 2,200). Every points multiplier per level is unchanged. The Worker debits the
// new claim exactly (build-base at the Command Gate).
import assert from 'node:assert/strict';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C,Plot:P},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyAction}=await import('../../worker/src/conquest-sim.js');
const K=['cp','alloy','biomass','helium'];
// main before Session 6 (js/conquest/plot.js CC at 6294297)
const OLD={claim:{cp:2550,alloy:110,biomass:65,helium:8},cost:[null,null,{cp:1800,alloy:50,biomass:30,helium:4},{cp:2700,alloy:110,biomass:65,helium:8},{cp:1700,alloy:100,biomass:60,helium:8},{cp:2500,alloy:150,biomass:90,helium:12},
 {cp:2600,alloy:150,biomass:95,helium:12},{cp:3900,alloy:230,biomass:145,helium:20},{cp:4000,alloy:220,biomass:140,helium:20},{cp:6000,alloy:330,biomass:210,helium:30},{cp:9000,alloy:500,biomass:320,helium:45,il:30,ar:6}]};
const cum=(L,n)=>{const o={};const add=c=>{for(const [k,v] of Object.entries(c||{}))o[k]=(o[k]||0)+v;};add(L.claim);for(let l=2;l<=n;l++)add(L.cost[l]);return o;};
const NEW={claim:P.CC.claim,cost:P.CC.cost};
assert.deepEqual({...P.CC.claim},{cp:600,alloy:30,biomass:15,helium:2},'CC1 claim = 600 CP + 30 alloy + 15 biomass + 2 He-3');
assert.deepEqual({...C.baseDefinition.recipe},{...P.CC.claim},'the Worker debits the plot claim (baseDefinition.recipe = CC.claim)');
assert.deepEqual({...P.CC.cost[2]},{cp:1800+1950,alloy:50+80,biomass:30+50,helium:4+6},'CC2 = its old price + the rest of the old claim (1,950 CP + 80 alloy + 50 biomass + 6 He-3)');
assert.equal(P.CC.cost[3].cp,2200);assert.equal(P.CC.cost[4].cp,2200);
for(const l of [3,4])for(const k of ['alloy','biomass','helium'])assert.equal(P.CC.cost[l][k],OLD.cost[l][k],'CC'+l+' materials unchanged');
for(let l=5;l<=10;l++)assert.deepEqual({...P.CC.cost[l]},OLD.cost[l],'CC'+l+' unchanged');
for(let l=2;l<=10;l++){const a=cum(NEW,l),b=cum(OLD,l);
 if(l===3){assert.equal(a.cp,b.cp-500,'CC3 cumulative CP is exactly 500 lower (Decision 13: 2,700 -> 2,200)');for(const k of ['alloy','biomass','helium'])assert.equal(a[k],b[k]);}
 else assert.deepEqual(a,b,'cumulative cost to CC'+l+' unchanged');}
// every points multiplier by level is unchanged: the tier comes from the CC level only, and the claim keeps x1.05
const tierOld=cc=>cc>0?Math.min(5,Math.ceil(cc/2)):0;
for(let cc=0;cc<=10;cc++)assert.equal(P.tierOf(cc),tierOld(cc),'tier at CC'+cc);
assert.deepEqual([...R.CQ_BASE_MULT],[1,1.05,1.10,1.15,1.20,1.25]);assert.equal(R.CQ_BASE_MULT[P.tierOf(1)],1.05,'CC1 keeps x1.05');
// the Worker: build-base with exactly the claim banked at the Command Gate succeeds; one CP short is refused, nothing taken
const now=Date.UTC(2026,10,16,12),D=C.baseDefinition;
const at=s=>{s.position={x:D.x,z:D.z-6,y:W.groundAt(D.x,D.z-6),surface:'ground'};for(const e of s.battle.enemies)e.hp=0;return s;};
let s=at(createState(R.STOCK_L,now));s.ledger.cp=600;s.ledger.banked={alloy:30,biomass:15,helium:2};
s=applyAction(s,{seq:1,action:'build-base',plot:{site:'ridge'}},now+1000);assert.equal(s.base.tier,1);assert.equal(s.plot.cc,1);assert.equal(s.ledger.cp,0);assert.deepEqual(s.ledger.banked,{alloy:0,biomass:0,helium:0});
let t=at(createState(R.STOCK_L,now));t.ledger.cp=599;t.ledger.banked={alloy:30,biomass:15,helium:2};assert.throws(()=>applyAction(t,{seq:1,action:'build-base'},now+1000),/insufficient banked cp/);
console.log('PASS CC ladder: CC1 600/30/15/2, CC2 3,750/130/80/10, CC3 = CC4 = 2,200 CP; cumulative to CC2 and CC4-CC10 unchanged, CC3 -500 CP (Decision 13); multipliers unchanged; the Worker debits the new claim');
