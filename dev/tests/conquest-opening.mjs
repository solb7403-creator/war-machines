// Opening route and loot/banking use only shared controls and authoritative input replay.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C,Control:K},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyCommands,applyAction,hydrate}=await import('../../worker/src/conquest-sim.js');
let now=1800000000000,s=createState(R.STOCK_L,now),seconds=0;
function step(input){now+=50;seconds+=.05;s=applyCommands(s,{seq:s.seq+1,commands:[input]},now);assert(s.hp>0,'opening pilot survives real incoming fire');}
for(let i=0;i<100;i++)step({x:0,z:0});assert.equal(s.hp,s.battle.playerMax,'safe initial spawn');
let seen=null,fired=null;
while(seconds<65&&s.position.x<1195){step({x:1,z:0,aimYaw:Math.PI/2});const B=hydrate(s);if(!seen&&B.enemies.some(e=>K.visible(B,s.position,e)))seen=seconds;if(!fired&&B.projectiles.some(q=>q.team==='enemy'))fired=seconds;}
assert(seen&&seen<=75,'real optional first contact within 75s');
let killed=null;
for(let i=0;i<2000&&!killed;i++){const B=hydrate(s),e=B.enemies.filter(e=>K.visible(B,s.position,e)).sort((a,b)=>Math.hypot(a.x-s.position.x,a.z-s.position.z)-Math.hypot(b.x-s.position.x,b.z-s.position.z))[0];step({x:0,z:0,fire:!!e,lockId:e?.id||null,aimYaw:e?Math.atan2(e.x-s.position.x,e.z-s.position.z):0,shield:true});if(!fired&&s.battle.projectiles.some(q=>q.team==='enemy'))fired=seconds;killed=s.drops[0];}
assert(fired,'real hostile projectiles, not scenery');assert(killed,'actual starter weapon kills generate a drop');
function drive(x,z,budget=80){let start=seconds;while(Math.hypot(s.position.x-x,s.position.z-z)>3&&seconds-start<budget){const dx=x-s.position.x,dz=z-s.position.z,d=Math.hypot(dx,dz);const B=hydrate(s),enemy=B.enemies.find(e=>K.visible(B,s.position,e));step({x:dx/d,z:dz/d,fire:!!enemy,lockId:enemy?.id||null,shield:true});}assert(Math.hypot(s.position.x-x,s.position.z-z)<=3,`physical waypoint ${x},${z}: ${JSON.stringify(s.position)}`);}
drive(killed.x,killed.z);assert(s.ledger.cp>0,'physical loot pickup grants verified CP');
for(const [x,z] of [[1240,1048],[1240,1128],[1174,1128],[1174,1168]])drive(x,z);
const cargo=structuredClone(s.ledger.cargo);s=applyAction(s,{seq:s.seq+1,action:'bank'},now);assert(s.ledger.banked.alloy>=cargo.alloy);assert.equal(s.ledger.cargo.alloy,0);
console.log(JSON.stringify({firstVisibleSeconds:+seen.toFixed(2),firstHostileShotSeconds:+fired.toFixed(2),bankedAtSeconds:+seconds.toFixed(2),cp:s.ledger.cp,banked:s.ledger.banked}));
console.log('PASS safe spawn, physical first contact, genuine hostile fire, real starter kill, salvage collection and Refuge banking');
