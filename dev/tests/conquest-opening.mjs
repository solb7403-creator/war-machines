// Opening (Session 6 first hour): the safe spawn at the Refuge, HOLD THE OXYGEN LINE one tap away (in range at the spawn),
// physical first contact within seconds, genuine hostile fire, a real starter kill and its drop, the defense won, salvage
// collected and banked at the Refuge terminal. Shared controls and authoritative input replay only: no seeded outcomes.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C,Control:K},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyCommands,applyAction,hydrate}=await import('../../worker/src/conquest-sim.js');
let now=1800000000000,s=createState(R.STOCK_L,now),seconds=0;
function step(input){now+=50;seconds+=.05;s=applyCommands(s,{seq:s.seq+1,commands:[input]},now);assert(s.hp>0,'opening pilot survives real incoming fire');}
const near=(B,list)=>list.filter(e=>K.visible(B,s.position,e)).sort((a,b)=>Math.hypot(a.x-s.position.x,a.z-s.position.z)-Math.hypot(b.x-s.position.x,b.z-s.position.z))[0];
let path=null,goalKey='';
function toward(x,z){const key=Math.round(x/6)+':'+Math.round(z/6);if(goalKey!==key||!path){goalKey=key;path=W.route({...s.position},{x,z},{goal:4});path.from=0;}const a=W.routeAim(s.position,path,path.from);path.from=a.index;const dx=a.point.x-s.position.x,dz=a.point.z-s.position.z,d=Math.hypot(dx,dz)||1;return {x:dx/d,z:dz/d};}
for(let i=0;i<100;i++)step({x:0,z:0});assert.equal(s.hp,s.battle.playerMax,'safe initial spawn');
assert.deepEqual([s.position.x,s.position.z],[W.spawn.x,W.spawn.z],'the pilot starts at the Refuge spawn');
s=applyAction(s,{seq:s.seq+1,action:'start-mission',mission:'oxygen-line'},now);assert.equal(s.mission,'oxygen-line','the first defense starts right at the spawn');
const started=seconds;let seen=null,fired=null,killed=null;
while(s.battle.state==='active'&&seconds-started<300){const B=hydrate(s),foes=B.enemies.filter(e=>e.hp>0&&!e.resident),e=near(B,foes);if(seen===null&&e)seen=seconds-started;
 const far=foes.sort((a,b)=>Math.hypot(a.x-s.position.x,a.z-s.position.z)-Math.hypot(b.x-s.position.x,b.z-s.position.z))[0],mv=!e&&far?toward(far.x,far.z):{x:0,z:0};
 step({...mv,fire:!!e,lockId:e?.id||null,aimYaw:e?Math.atan2(e.x-s.position.x,e.z-s.position.z):0,shield:s.hp<s.battle.playerMax*.6});
 if(fired===null&&s.battle.projectiles.some(q=>q.team==='enemy'))fired=seconds-started;if(!killed&&s.drops.length)killed={...s.drops[0],at:seconds-started};}
assert(seen!==null&&seen<=2,'physical first contact within seconds of the start ('+seen+' s)');assert(fired!==null,'real hostile projectiles, not scenery');
assert(killed&&killed.at<=15,'an actual starter weapon kill generates a drop within 15 s ('+killed?.at+' s)');
assert.equal(s.battle.state,'victory','the staged first defense is won on stock gear');assert.equal(s.settlement.kind,'first-clear');
s=applyAction(s,{seq:s.seq+1,action:'return-exploration'},now);
function drive(x,z,r=3,budget=90){const t0=seconds;path=null;while(Math.hypot(s.position.x-x,s.position.z-z)>r&&seconds-t0<budget)step({...toward(x,z),shield:true});assert(Math.hypot(s.position.x-x,s.position.z-z)<=r,`physical waypoint ${x},${z}: ${JSON.stringify(s.position)}`);}
const cp0=s.ledger.cp;for(const d of [...s.drops].filter(d=>Math.hypot(d.x-s.position.x,d.z-s.position.z)<80))drive(d.x,d.z,3);assert(s.ledger.cp>cp0,'physical loot pickup grants verified CP');
drive(C.refuge.x,C.refuge.z,4);const cargo=structuredClone(s.ledger.cargo);s=applyAction(s,{seq:s.seq+1,action:'bank'},now);assert(s.ledger.banked.alloy>=cargo.alloy);assert.equal(s.ledger.cargo.alloy,0);assert(s.firsts?.bank,'the first bank is recorded (the HUD BASE line and the coach chain read it)');
console.log(JSON.stringify({firstVisibleSeconds:+seen.toFixed(2),firstHostileShotSeconds:+fired.toFixed(2),firstDropSeconds:+killed.at.toFixed(2),bankedAtSeconds:+seconds.toFixed(2),cp:s.ledger.cp,banked:s.ledger.banked}));
console.log('PASS safe Refuge spawn, the first defense in range at once, physical first contact, genuine hostile fire, real starter kill, salvage collection and Refuge banking');
