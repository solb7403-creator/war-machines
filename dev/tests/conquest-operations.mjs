// Real deterministic mission journey through authoritative command replay; fixture placement only at start.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{Combat:C,World:W},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyAction,applyCommands,hydrate}=await import('../../worker/src/conquest-sim.js');
const results=[];
for(const id of Object.keys(C.operations)){
 let now=1800000000000;const o=C.operations[id],L=structuredClone(R.STOCK_L);L.w={a:'moon',t:2,q:1,s:false};L.c={c:'titan',t:2,q:1,s:false};
 let s=createState(L,now);s.position={x:o.x-25,z:o.z+8,y:W.groundAt(o.x-25,o.z+8),surface:'ground'};
 s=applyAction(s,{seq:1,action:'start-mission',mission:id},now);let steps=0;
 while(s.battle.state==='active'&&steps<12000){
  const b=hydrate(s),p=s.position,alive=b.enemies.filter(e=>e.hp>0&&!e.resident),priority=alive.find(e=>e.id===b.carrierId)||alive[0]||(['rescue','oxygen-line'].includes(id)?b.enemies.find(e=>e.resident&&e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<70):null);
  let target=priority||b.objective;
  if(id==='recon'&&b.nodes[b.scans])target={x:b.nodes[b.scans][0],z:b.nodes[b.scans][1]};
  if(id==='rescue')target=b.objective;
  const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),move=id==='recon'||id==='rescue'||!priority?d>5:d>28;
  const input={x:move?dx/d:0,z:move?dz/d:0,fire:!!priority,lockId:priority?.id||null,aimYaw:Math.atan2(priority?priority.x-p.x:dx,priority?priority.z-p.z:dz),shield:b.playerHp<b.playerMax*.8,super:b.charge>=1000};
  now+=50;s=applyCommands(s,{seq:s.seq+1,commands:[input]},now);steps++;
 }
 results.push({id,state:s.battle.state,seconds:steps/20,hp:s.hp,kills:s.battle.kills,position:s.position,objectiveHp:s.battle.objectiveHp,reason:s.battle.reason,stage:s.battle.stage,scans:s.battle.scans});
 console.log(JSON.stringify(results.at(-1)));
 assert.equal(s.battle.state,'victory',id+' actual mission completion');assert(s.settlement.cp>0,id+' guaranteed verified payout');assert.equal(s.territory[o.site].owner,'humanity');
 const cp=s.ledger.cp,reloaded=structuredClone(s);s=applyCommands(reloaded,{seq:s.seq+1,commands:[{x:0,z:0}]},now+50);assert.equal(s.ledger.cp,cp,'reload cannot repeat settlement');
}
console.log('PASS all six authoritative missions with real projectiles, physical traversal, settlement and ownership retention');
