import assert from 'node:assert/strict';
import {buildSim} from '../../worker/build-sim.mjs';
buildSim();
const {CONQUEST,RULES}=await import('../../worker/src/sim.gen.js');
const {validateCommands,createState,applyCommands}=await import('../../worker/src/conquest-sim.js');
assert(CONQUEST.World&&CONQUEST.Combat,'server uses canonical terrain and combat');
for(const value of [null,{},[],[{x:102,z:0}], [{x:0,z:NaN}], [{x:0,z:0,position:{x:9999,z:0}}],Array(41).fill({x:0,z:0})])assert.throws(()=>validateCommands(value));
const commands=validateCommands([{x:1,z:0,aimYaw:0,fire:false}]);assert.equal(commands.length,1);
const now=100000,L=RULES.STOCK_L,s=createState(L,now);
const initial=JSON.stringify(s);
assert.throws(()=>applyCommands(s,{seq:1,commands:Array(20).fill({x:1,z:0})},now),'102-meter exploit cannot buy simulation time');
assert.equal(JSON.stringify(s),initial,'invalid input changes nothing');
const a=applyCommands(s,{seq:1,commands:[{x:1,z:0}]},now+50);
assert(a.position.x>s.position.x);assert(a.position.x-s.position.x<=CONQUEST.World.travelSpeed(L)*.05+1e-6);
assert.throws(()=>applyCommands(a,{seq:1,commands:[{x:1,z:0}]},now+100),'sequence cannot replay movement');
assert.throws(()=>applyCommands(a,{seq:3,commands:[{x:1,z:0}]},now+100),'out of order command rejected');
assert.throws(()=>applyCommands(a,{seq:2,commands:[{x:1,z:0}],hp:999999},now+100),'client HP never accepted');
const damaged=JSON.parse(JSON.stringify(a));damaged.hp=123;damaged.battle.playerHp=123;
const restored=applyCommands(JSON.parse(JSON.stringify(damaged)),{seq:2,commands:[{x:0,z:0}]},now+100);
assert.equal(restored.hp,123,'serialized reload preserves health');
console.log('PASS authoritative command schema, elapsed-time budget, replay/order rejection, canonical movement and persistent HP');

// Idle time cannot be banked beyond the 4 s real-time reserve (which absorbs phone network stalls) and spent as a burst.
const idle=applyCommands(s,{seq:1,commands:Array(40).fill({x:1,z:0})},now+3600000),idle2=applyCommands(idle,{seq:2,commands:Array(40).fill({x:1,z:0})},now+3600000);
assert.equal(idle2.creditMs,0);assert.throws(()=>applyCommands(idle2,{seq:3,commands:[{x:1,z:0}]},now+3600000));
// Production server replay performs the hit/kill, including terrain-aware vertical aim assist.
let fight=createState(L,now);fight.position={x:1240,z:893,y:CONQUEST.World.groundAt(1240,893),surface:'ground'};
fight.battle=JSON.parse(JSON.stringify(new CONQUEST.Combat.Encounter(L,fight.position)));
let ticks=0;while(fight.battle.enemies[0].hp>0&&ticks<20){const e=fight.battle.enemies[0],yaw=Math.atan2(e.x-fight.position.x,e.z-fight.position.z);fight=applyCommands(fight,{seq:fight.seq+1,commands:Array(20).fill({x:0,z:0,aimYaw:yaw,lockId:e.id,fire:true})},now+(++ticks)*1000);}
assert.equal(fight.battle.enemies[0].hp,0,'server computes actual projectile kill');assert(fight.battle.cleared['redoubt-01:0']);
assert(fight.hp<=fight.battle.playerMax);console.log('PASS idle-credit cap and server-computed projectile damage/destruction');
// Firebase removes empty arrays/maps rather than preserving the JSON wire shape.
const firebase=JSON.parse(JSON.stringify(a));delete firebase.battle.projectiles;delete firebase.battle.effects;delete firebase.battle.playerStats.gems;delete firebase.battle.playerStats.buffs;
for(const e of firebase.battle.enemies){delete e.stats.gems;delete e.stats.buffs;}
assert.doesNotThrow(()=>applyCommands(firebase,{seq:2,commands:[{x:0,z:0}]},now+100),'Firebase empty collection normalization');
const {applyAction}=await import('../../worker/src/conquest-sim.js');
assert.throws(()=>applyAction(s,{seq:1,action:'start-mission'},now+100),'activation uses server position');
const missionStart=JSON.parse(JSON.stringify(s));missionStart.position={x:1163,z:1132,y:CONQUEST.World.groundAt(1163,1132),surface:'ground'};missionStart.hp=456;missionStart.battle.playerHp=456;
const mission=applyAction(missionStart,{seq:1,action:'start-mission'},now+100);assert.equal(mission.hp,456);assert.equal(mission.battle.playerHp,456);assert.equal(mission.mission,'oxygen-line');
const retreatState=applyAction(mission,{seq:2,action:'return-exploration'},now+200);assert.equal(retreatState.hp,456);assert(!retreatState.completed?.['oxygen-line'],'retreat cannot complete mission');
assert.throws(()=>applyAction(mission,{seq:2,action:'return-exploration',victory:true},now+200),'client cannot report mission outcome');
let sortie=createState(L,now);sortie.position={x:1160,z:1048,y:CONQUEST.World.groundAt(1160,1048),surface:'ground'};sortie=applyAction(sortie,{seq:1,action:'start-mission'},now);
let seconds=0;while(sortie.battle.state==='active'&&seconds<150){const e=sortie.battle.enemies.find(e=>!e.resident&&e.hp>0),yaw=e?Math.atan2(e.x-sortie.position.x,e.z-sortie.position.z):0;sortie=applyCommands(sortie,{seq:sortie.seq+1,commands:Array(20).fill({x:0,z:0,aimYaw:yaw,lockId:e?.id,fire:!!e})},now+(++seconds)*1000);}
assert.equal(sortie.battle.state,'victory','server computes the full three-wave victory');assert.equal(sortie.battle.kills,7);
const completed=applyAction(sortie,{seq:sortie.seq+1,action:'return-exploration'},now+(seconds+1)*1000);assert(completed.completed['oxygen-line']);assert.equal(completed.hp,sortie.hp);
console.log('PASS authoritative mission activation, HP continuity, retreat rejection and real three-wave victory:',seconds,'seconds');
// Arrival jitter consumes previously earned reserve; it never creates movement time.
let jitter=createState(L,now),elapsed=1500;for(let i=0;i<8;i++){if(i)elapsed+=i%2?970:1030;jitter=applyCommands(jitter,{seq:jitter.seq+1,commands:Array(20).fill({x:1,z:0})},now+elapsed);}assert(jitter.position.x-s.position.x<=CONQUEST.World.travelSpeed(L)*elapsed/1000+1e-6);assert(jitter.creditMs<=4000);console.log('PASS bounded earned timing reserve handles ordinary HTTP arrival jitter');
const wonPosition=structuredClone(sortie.position);const afterVictory=applyCommands(sortie,{seq:sortie.seq+1,commands:Array(20).fill({x:1,z:0,dash:true,shield:true,fire:true})},now+(seconds+1)*1000);assert.deepEqual(afterVictory.position,wonPosition,'real verified victory freezes movement until returning to exploration');assert.equal(afterVictory.ledger.cp,sortie.ledger.cp,'ended-state inputs cannot duplicate mission credit, including a latched featured bonus');console.log('PASS authoritative terminal mission state freezes traversal without reward duplication');
const stuckWon=structuredClone(afterVictory);stuckWon.stuckMs=2000;assert.throws(()=>applyAction(stuckWon,{seq:stuckWon.seq+1,action:'recover'},now+(seconds+2)*1000),'recovery cannot bypass terminal mission freeze');console.log('PASS terminal mission cannot recover into invulnerable exploration');
assert.equal(afterVictory.stuckMs,sortie.stuckMs,'terminal inputs cannot manufacture stuck history');const wonRoam=applyAction(afterVictory,{seq:afterVictory.seq+1,action:'return-exploration'},now+(seconds+2)*1000);assert.throws(()=>applyAction(wonRoam,{seq:wonRoam.seq+1,action:'recover'},now+(seconds+3)*1000),'returning cannot turn terminal inputs into a recovery teleport');console.log('PASS terminal inputs cannot synthesize recovery eligibility across transitions');
