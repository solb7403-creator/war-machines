// Raid doctrine: authored, telegraphed reinforcement waves and VETERAN commander enrage, with unchanged raid economy.
import assert from 'node:assert/strict';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{Combat:C,World:W},RULES:R}=await import('../../worker/src/sim.gen.js');
const {killLoot}=await import('../../worker/src/conquest-economy.js');
const L=structuredClone(R.STOCK_L);L.w={a:'moon',t:2,q:1,s:false};L.c={c:'titan',t:2,q:1,s:false};

function start(id){const o=C.operations[id],p={x:o.entry[0],z:o.entry[1],y:W.groundAt(o.entry[0],o.entry[1]),surface:'ground'},b=new C.Operation(L,p,id);return {o,p,b};}
// Unit-level harness: clear the current force, then advance shared simulation time without player input.
function clearForce(b){for(const e of b.enemies)if(!e.resident&&e.hp>0&&!e.commander)e.hp=0;}
// Siege generals deploy in phase two; the wave doctrine waits for that phase to be cleared.
function advance(b,p,seconds){for(let t=0;t<seconds;t+=.05)b.tick(.05,p,{});}

for(const id of C.raidIds){const o=C.operations[id];assert.equal(o.drops?.length,2,id+' has two authored drop zones');for(const [x,z] of o.drops){assert(!W.solidAt(x,z),id+' drop zone is clear ground');assert(Math.hypot(x-o.x,z-o.z)<60,id+' drop zone belongs to the site');}}

for(const [id,waves] of [['raid-sabotage-1',1],['raid-sabotage-3',2]]){
 const {o,p,b}=start(id);assert.equal(o.danger,waves===2?'VETERAN':'HARD');b.playerHp=b.playerMax=1e9;
 advance(b,p,8.5);assert(!b.hazards.some(h=>h.kind==='drop'),'no reinforcement while the initial force holds');
 for(let wave=1;wave<=waves;wave++){
  clearForce(b);const c=b.enemies.find(e=>e.commander&&e.hp>0);if(c){c.hp=c.maxHp;advance(b,p,1);assert(!b.hazards.some(h=>h.kind==='drop'),'no wave while the commander still fights');c.hp=0;}for(let n=0;n<120&&!b.hazards.some(h=>h.kind==='drop');n++)b.tick(.05,p,{});
  const drop=b.hazards.find(h=>h.kind==='drop');assert(drop,id+' wave '+wave+' is telegraphed before landing');assert(drop.remaining>3.5&&drop.radius===7,'readable 4s landing zone');
  const [x,z]=o.drops[wave-1];assert.equal(drop.x,x);assert.equal(drop.z,z);
  const before=b.enemies.length;advance(b,p,4.2);const landed=b.enemies.slice(before);
  assert.equal(landed.length,2,id+' authored wave '+wave+' size');assert(landed.every(e=>e.noLoot&&e.reinforcement===wave&&e.rewardKey.startsWith(id+':reinforce:'+wave)),'reinforcements carry no salvage');
  assert.equal(landed.some(e=>e.kind==='breacher'),wave===2,'only the VETERAN second wave brings a heavy breacher');
  for(const e of landed)e.hp=0;
  if(wave<waves){const landedAt=b.time;clearForce(b);advance(b,p,24);assert(!b.hazards.some(h=>h.kind==='drop'),'breather: no follow-up wave within 25s of landing');assert(b.time-landedAt<25);}
 }
 clearForce(b);advance(b,p,6);assert.equal(b.reinforcements,waves,id+' calls exactly '+waves+' wave(s)');assert(!b.hazards.some(h=>h.kind==='drop'),'no further waves');
}

// Sieges: clearing the outer garrison brings the general, not a wave; the wave lands during the platform hold after the general falls.
{const {p,b}=start('raid-siege-1');b.playerHp=b.playerMax=1e9;advance(b,p,8.5);for(const e of b.enemies)if(!e.resident)e.hp=0;b.tick(.05,p,{});assert.equal(b.stage,1,'general phase');assert(!b.hazards.some(h=>h.kind==='drop'),'no wave on phase change');
 for(const e of b.enemies)if(!e.resident)e.hp=0;for(let n=0;n<80&&!b.hazards.some(h=>h.kind==='drop');n++)b.tick(.05,p,{});assert(b.hazards.some(h=>h.kind==='drop'),'wave during the platform hold');}
// Landing zones are a real telegraphed threat with counterplay: standing inside hurts, Shield mitigates, leaving avoids.
{const {o,p,b}=start('raid-battery-1');advance(b,p,8.5);clearForce(b);for(const e of b.enemies)e.hp=0;b.tick(.05,p,{});const drop=b.hazards.find(h=>h.kind==='drop');assert(drop);
 const inside={x:drop.x,z:drop.z,y:drop.y,surface:'ground'},hp=b.playerHp;b.player=inside;drop.remaining=.05;b.tick(.1,inside,{});assert(b.playerHp<hp,'landing blast deals shared damage');}

// VETERAN commanders enrage below 40% hull and shorten the telegraphed cadence; HARD commanders never enrage.
for(const [id,enrage] of [['raid-battery-1',false],['raid-battery-3',true]]){const {p,b}=start(id);b.playerHp=b.playerMax=1e9;const c=b.enemies.find(e=>e.commander);c.hp=c.maxHp*.35;b.tick(.05,p,{});assert.equal(!!c.enraged,enrage,id+' enrage rule');
 if(enrage){advance(b,p,2);const t=b.time;c.nextPattern=t;b.tick(.05,p,{});assert(c.nextPattern-b.time<=6*.65+.06,'enraged artillery cadence is shorter');}}

// Economy invariance: reinforcement kills create no salvage, ordinary raid kills still do, and authored payouts are unchanged.
{const now=1800000000000,s={mission:'raid-sabotage-3',position:{x:0,z:0,y:0}};killLoot(s,{noLoot:true,rewardKey:'raid-sabotage-3:reinforce:1:0',x:1,z:1,y:0,kind:'raider'},now);assert.equal(s.drops.length,0,'no reinforcement salvage');
 killLoot(s,{rewardKey:'raid-sabotage-3:flanker',x:1,z:1,y:0,kind:'raider'},now);assert.equal(s.drops.length,1,'authored raid kill salvage unchanged');}
for(const id of C.raidIds){const o=C.operations[id],f=['intercept','sabotage','battery','extraction','siege'].indexOf(o.family),i=Number(id.at(-1))-1;assert.deepEqual(o.reward,{cp:180+i*20+f*15,alloy:18+i*2,biomass:12+f,helium:3+i},id+' payout unchanged');}
console.log('PASS raid doctrine: telegraphed HARD 1 / VETERAN 2 reinforcement waves, enrage, landing-zone counterplay, zero added salvage');
