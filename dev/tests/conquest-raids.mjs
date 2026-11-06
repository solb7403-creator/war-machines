import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{Combat:C,World:W,Control:K},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyAction,applyCommands,hydrate}=await import('../../worker/src/conquest-sim.js');
assert.equal(C.raidIds?.length,25,'25 real raid definitions');
assert.equal(new Set(C.raidIds.map(id=>C.operations[id].family)).size,5);
assert.equal(new Set(C.raidIds.map(id=>C.operations[id].layout)).size,5);
assert.equal(C.sectors.length,6);assert.equal(new Set(C.raidIds.map(id=>C.operations[id].commander)).size,5);
for(const id of C.raidIds){const o=C.operations[id];assert(o.raid&&o.reward.cp>0&&o.reward.alloy>0);assert(o.route.length>1);assert(o.brief.length>40);assert(W.frontierSectorAt(o.x,o.z));}
const L=structuredClone(R.STOCK_L);L.w={a:'moon',t:2,q:1,s:false};L.c={c:'titan',t:2,q:1,s:false};
const p={x:920,z:900,y:W.groundAt(920,900),surface:'ground'},b=new C.Operation(L,p,C.raidIds[0]);
b.hazards=[{kind:'orbital',x:p.x,z:p.z,y:p.y,radius:8,remaining:.05,damage:60,source:1}];const hp=b.playerHp;b.tick(.1,p,{});assert(b.playerHp<hp,'telegraphed area attack deals actual shared damage');
const shield=new C.Operation(L,p,C.raidIds[0]);shield.hazards=[{kind:'orbital',x:p.x,z:p.z,y:p.y,radius:8,remaining:.05,damage:60,source:1}];shield.shieldT=3;shield.tick(.1,p,{});assert(hp-shield.playerHp<hp-b.playerHp,'shield counters area strike');
const safe=new C.Operation(L,p,C.raidIds[0]);safe.hazards=[{kind:'orbital',x:p.x+20,z:p.z,y:p.y,radius:8,remaining:.05,damage:60,source:1}];safe.tick(.1,p,{});assert.equal(safe.playerHp,hp,'moving outside marked radius avoids strike');
// A physical-input controller plans around authored cover; it never teleports or edits battle state.
function planRoute(p,target,b,enemy){const step=4,origin={x:p.x,z:p.z},key=(x,z)=>x+':'+z,open=[{i:0,j:0,g:0,f:Math.hypot(target.x-p.x,target.z-p.z)}],best=new Map([[key(0,0),0]]),parent=new Map(),point=n=>({x:origin.x+n.i*step,z:origin.z+n.j*step,y:W.groundAt(origin.x+n.i*step,origin.z+n.j*step),surface:'ground'});let end=null;
 for(let n=0;open.length&&n<2500;n++){open.sort((a,b)=>b.f-a.f);const a=open.pop(),ap=point(a);if(Math.hypot(ap.x-target.x,ap.z-target.z)<(enemy?17:6)&&(!enemy||K.visible(b,ap,target))){end=a;break;}for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const i=a.i+di,j=a.j+dj;if(Math.abs(i)>36||Math.abs(j)>36)continue;const g=a.g+Math.hypot(di,dj)*step,k=key(i,j);if(g>=(best.get(k)??Infinity))continue;const q=W.advance(ap,di*step,dj*step);if(Math.hypot(q.x-(origin.x+i*step),q.z-(origin.z+j*step))>.3)continue;best.set(k,g);parent.set(k,a);open.push({i,j,g,f:g+Math.hypot(target.x-q.x,target.z-q.z)});}}
 if(!end)return [];const route=[];while(end.i||end.j){route.push(point(end));end=parent.get(key(end.i,end.j));}return route.reverse();}
const results=[];
for(const id of (process.env.CQ_RAID_IDS?process.env.CQ_RAID_IDS.split(','):C.raidIds)){
 const o=C.operations[id];let now=1800000000000,s=createState(L,now);s.completed=Object.fromEntries(C.fieldMissionIds.map(id=>[id,{at:now,attempt:0}]));const q=o.entry;s.position={x:q[0],z:q[1],y:W.groundAt(q[0],q[1]),surface:'ground'};s=applyAction(s,{seq:1,action:'start-mission',mission:id},now);let steps=0,stuck=0,planned=[],bestGap=Infinity,sinceBest=0,goalKey='';
 while(s.battle.state==='active'&&steps<10000){
  const b=hydrate(s),p=s.position,alive=b.enemies.filter(e=>e.hp>0&&!e.resident),visible=alive.filter(e=>K.visible(b,p,e));
  const priority=visible.find(e=>e.id===b.carrierId)||visible.find(e=>e.immobile)||visible[0]||alive[0];
  let target=priority||b.objective;
  if(!priority&&['battery','extraction'].includes(o.family)&&b.scans<(o.family==='battery'?2:3)&&b.nodes[b.scans])target={x:b.nodes[b.scans][0],z:b.nodes[b.scans][1]};
  // Progress watchdog: oscillating against a slope or cover without closing distance forces a fresh physical route.
  const key=(priority?'e'+priority.id:'n'+b.scans)+':'+b.stage,gap=Math.hypot(target.x-p.x,target.z-p.z);if(key!==goalKey){goalKey=key;bestGap=gap;sinceBest=0;}else if(gap<bestGap-.5){bestGap=gap;sinceBest=0;}else sinceBest++;
  if(planned.length&&Math.hypot(planned[0].x-p.x,planned[0].z-p.z)<2)planned.shift();if(stuck>5||sinceBest>60&&!planned.length||!planned.length&&priority&&!K.visible(b,p,priority)){planned=planRoute(p,target,b,!!priority);stuck=0;if(sinceBest>60){sinceBest=0;bestGap=gap;}}const steering=planned[0]||target;
  const dx=steering.x-p.x,dz=steering.z-p.z,d=Math.hypot(dx,dz),move=planned.length?d>1:priority?d>18||!K.visible(b,p,priority):d>4;
  let mx=move?dx/(d||1):0,mz=move?dz/(d||1):0;
  const hazard=b.hazards?.find(h=>Math.hypot(h.x-p.x,h.z-p.z)<h.radius+2);if(hazard){const ax=p.x-hazard.x,az=p.z-hazard.z,n=Math.hypot(ax,az)||1;mx=Math.hypot(ax,az)<.01?1:ax/n;mz=Math.hypot(ax,az)<.01?0:az/n;}
  if(move&&!hazard&&!planned.length){let best=-Infinity;for(const off of [0,.6,-.6,1.2,-1.2,1.8,-1.8,2.4,-2.4]){const a=Math.atan2(mx,mz)+off,vx=Math.sin(a),vz=Math.cos(a),q=W.advance(p,vx*4,vz*4),travel=Math.hypot(q.x-p.x,q.z-p.z),score=travel>2?-Math.hypot(steering.x-q.x,steering.z-q.z)-Math.abs(off)*.7:-Infinity;if(score>best){best=score;mx=vx;mz=vz;}}}
  const input={x:mx,z:mz,fire:!!priority,lockId:priority?.id||null,aimYaw:Math.atan2(priority?priority.x-p.x:dx,priority?priority.z-p.z:dz),shield:b.playerHp<b.playerMax*.8,super:b.charge>=1000};
  const before={...p};now+=50;s=applyCommands(s,{seq:s.seq+1,commands:[input]},now);steps++;stuck=move&&Math.hypot(s.position.x-before.x,s.position.z-before.z)<.03?stuck+1:0;
 }
 const r={id,family:o.family,layout:o.layout,commander:o.commander,outcome:s.battle.state,seconds:steps/20,hp:s.hp,kills:s.battle.kills,stage:s.battle.stage,scans:s.battle.scans,position:s.position,settlement:s.settlement};results.push(r);console.log(JSON.stringify(r));if(s.battle.state!=='victory')console.log(JSON.stringify(s.battle.enemies.filter(e=>e.hp>0&&!e.resident))); 
 assert.equal(s.battle.state,'victory',id+' real command-driven completion');assert(s.settlement.cp>0);assert(s.completed[id]);
 const cp=s.ledger.cp;s=applyCommands(structuredClone(s),{seq:s.seq+1,commands:[{x:0,z:0}]},now+50);assert.equal(s.ledger.cp,cp,'reconnect cannot double reward');
}
writeFileSync(process.env.CQ_RAID_IDS?'/tmp/lunar-raid-partial.json':'/tmp/lunar-raid-evidence.json',JSON.stringify({source:'authoritative physical command replay; canonical Legendary gear fixture; initial position placed at authored entry; subsequent movement/combat/objectives/settlement replayed authoritatively',results},null,2));
console.log('PASS '+results.length+' raids: real damage/movement/objectives/settlement/reconnect');
