import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST:{World:W,Combat:C}}=await import('../../worker/src/sim.gen.js');
const {createState,applyAction,refreshState}=await import('../../worker/src/conquest-sim.js');
const now=1800000000000,s=createState(R.STOCK_L,now),d=C.baseDefinition;
s.position={x:d.x,z:d.z,y:W.groundAt(d.x,d.z),surface:'ground'};s.battle.enemies=[];s.ledger.cp=100000;s.ledger.banked={alloy:10000,biomass:10000,helium:10000};
let a=applyAction(s,{seq:1,action:'build-base'},now);assert.equal(a.base.tier,1);assert.equal(a.ledger.cp,s.ledger.cp-d.recipe.cp);assert.throws(()=>applyAction(a,{seq:2,action:'build-base'},now),/built/);
a=applyAction(a,{seq:2,action:'base-module',module:'reactor'},now);assert(a.base.pending);refreshState(a,now+60000);assert.equal(a.base.modules.reactor,1);
const before=a.ledger.cp;a=applyAction(a,{seq:3,action:'base-claim'},now+86400000);assert(a.ledger.cp>before);assert.throws(()=>applyAction(a,{seq:4,action:'base-claim'},now+86400001),/production/);
assert.throws(()=>applyAction(a,{seq:4,action:'base-module',module:'forged'},now+86400001),/module/);
// Owner rule: upgrades may be queued remotely from the MAP; collecting production still needs the physical base.
const b=structuredClone(a);b.position.x+=100;assert.throws(()=>applyAction(structuredClone(b),{seq:4,action:'base-claim'},now+86400001),/terminal/);{const remote=structuredClone(b);remote.ledger.cp+=1e6;for(const k of Object.keys(remote.ledger.banked))remote.ledger.banked[k]+=1e5;const up=applyAction(remote,{seq:4,action:'upgrade-base'},now+86400001);assert.equal(up.base.tier,remote.base.tier+1,'remote tier upgrade from 100 m away');}
const legacy=createState(R.STOCK_L,now);delete legacy.base;legacy.reputation=731;const cp=legacy.ledger.cp;refreshState(legacy,now);assert.equal(legacy.reputation,731);assert.equal(legacy.ledger.cp,cp);
console.log('PASS atomic base ownership, immutable costs, physical terminal, construction clock, passive claim and additive migration');
// Personal fortress collision must be instance-local; it cannot change the shared Moon geometry.
const {Control:K}= (await import('../../worker/src/sim.gen.js')).CONQUEST;
const start={x:d.x-22,z:d.z,y:W.groundAt(d.x-22,d.z),surface:'ground'};
const builtBattle=new C.Encounter(R.STOCK_L,start);builtBattle.enemies=[];builtBattle.baseTier=2;
let blocked=start;for(let i=0;i<60;i++)blocked=K.advance(builtBattle,blocked,{x:1,z:0},1/60,true);
assert(blocked.x<=d.x-19,'personal wall stops the canonical hull');
const emptyBattle=new C.Encounter(R.STOCK_L,start);emptyBattle.enemies=[];let empty=start;for(let i=0;i<60;i++)empty=K.advance(emptyBattle,empty,{x:1,z:0},1/60,true);
assert(empty.x>blocked.x+2,'another personal instance has no phantom wall');
console.log('PASS per-player base collision and independent unbuilt instances');
// Fortress fields protect only inside the owned base; no weapon/enemy stat scaling.
function incoming(tier,modules={},offset=0){const p={x:d.x+offset,z:d.z,y:W.groundAt(d.x+offset,d.z),surface:'ground'},b=new C.Encounter(R.STOCK_L,p),stats=structuredClone(b.enemies[0].stats);b.baseTier=tier;b.baseModules=modules;const before=b.playerHp;b.hit({...b.player,vx:0,vy:0,vz:1,team:'enemy',kind:'pulse',stats},b.player,2.5);return before-b.playerHp;}
const bare=incoming(0);assert(Math.abs(incoming(4)/bare-.9)<1e-9,'tier IV physical shield reduces real incoming damage10% without a module');assert(Math.abs(incoming(5,{defense:2})/bare-.65)<1e-9,'tier V adds15% to the earned20% Defense module');assert.equal(incoming(5,{defense:2},60),bare,'fortress protection never follows the pilot outside its physical field');
const beacon=createState(R.STOCK_L,now);beacon.base.tier=5;refreshState(beacon,now);assert(beacon.radarContacts.length>0,'tier V beacon returns genuine regional contacts without a Radar module');assert(beacon.radarContacts.every(c=>beacon.battle.enemies.some(e=>e.id===c.id&&e.hp>0)),'no invented contacts');assert.equal(C.baseBenefits(5,{}).radarRange,320);assert.equal(C.baseBenefits(5,{radar:3}).radarRange,520);console.log('PASS tier IV/V real base-local shields, outside-field fairness and real regional beacon');
