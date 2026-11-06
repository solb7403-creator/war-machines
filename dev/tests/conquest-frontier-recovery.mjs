// Frontier recovery: the Refuge home sector (no raid objective) is never permanently lost, and captured sectors keep live patrols.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{Combat:C,World:W,Control:K},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyAction,applyCommands,refreshState,hydrate}=await import('../../worker/src/conquest-sim.js');
const point=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
// Same physical-input controller as conquest-sector-victory.mjs: it plans around authored cover and never edits battle state.
function planRoute(p,target,b,enemy){const step=4,origin={x:p.x,z:p.z},key=(x,z)=>x+':'+z,open=[{i:0,j:0,g:0,f:Math.hypot(target.x-p.x,target.z-p.z)}],best=new Map([[key(0,0),0]]),parent=new Map(),at=n=>({x:origin.x+n.i*step,z:origin.z+n.j*step,y:W.groundAt(origin.x+n.i*step,origin.z+n.j*step),surface:'ground'});let end=null;
 for(let n=0;open.length&&n<2500;n++){open.sort((a,b)=>b.f-a.f);const a=open.pop(),ap=at(a);if(Math.hypot(ap.x-target.x,ap.z-target.z)<(enemy?17:6)&&(!enemy||K.visible(b,ap,target))){end=a;break;}for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const i=a.i+di,j=a.j+dj;if(Math.abs(i)>36||Math.abs(j)>36)continue;const g=a.g+Math.hypot(di,dj)*step,k=key(i,j);if(g>=(best.get(k)??Infinity))continue;const q=W.advance(ap,di*step,dj*step);if(Math.hypot(q.x-(origin.x+i*step),q.z-(origin.z+j*step))>.3)continue;best.set(k,g);parent.set(k,a);open.push({i,j,g,f:g+Math.hypot(target.x-q.x,target.z-q.z)});}}
 if(!end)return [];const route=[];while(end.i||end.j){route.push(at(end));end=parent.get(key(end.i,end.j));}return route.reverse();}
function fight(s,now){let ticks=0,planned=[],stuck=0;while(s.battle.state==='active'&&ticks<6000){const b=hydrate(s),p=s.position,alive=b.enemies.filter(e=>e.hp>0&&!e.resident).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)),e=alive.find(e=>K.visible(b,p,e))||alive[0],target=e||b.objective;
 if(planned.length&&Math.hypot(planned[0].x-p.x,planned[0].z-p.z)<2)planned.shift();if(stuck>5||!planned.length&&e&&!K.visible(b,p,e)){planned=planRoute(p,target,b,!!e);stuck=0;}const steering=planned[0]||target,dx=steering.x-p.x,dz=steering.z-p.z,d=Math.hypot(dx,dz),move=planned.length?d>1:e?d>18||!K.visible(b,p,e):false,x=move?dx/(d||1):0,z=move?dz/(d||1):0,before={...p};
 s=applyCommands(s,{seq:s.seq+1,commands:[{x,z,fire:!!e,lockId:e?.id||null,aimYaw:e?Math.atan2(e.x-p.x,e.z-p.z):0,shield:b.playerHp<b.playerMax*.8,super:b.charge>=1000}]},now+=50);ticks++;stuck=move&&Math.hypot(s.position.x-before.x,s.position.z-before.z)<.03?stuck+1:0;}return {s,now};}

// 1. Refuge: invasion alert -> abandoned defense hands it to the Parasites -> a physical retake restores it, rewarded once.
const L=structuredClone(R.STOCK_L);L.w={a:'moon',t:2,q:1,s:false};L.c={c:'titan',t:2,q:1,s:false};
let now=1800000000000,s=createState(L,now);const op=C.operations['sector-defense-refuge'];assert.equal(s.territory.refuge.owner,'humanity');
assert(!C.raidIds.some(id=>C.operations[id].sector==='refuge'),'Refuge has no raid objective, so a retake path is required');
now+=1800001;s.position=point(op.x-20,op.z+15);refreshState(s,now);assert.equal(s.territory.refuge.status,'defense-alert');
s=applyAction(s,{seq:s.seq+1,action:'start-sector-defense',mission:op.id},now+=1000);s=applyAction(s,{seq:s.seq+1,action:'return-exploration'},now+=1000);
assert.deepEqual([s.territory.refuge.owner,s.territory.refuge.status],['parasites','recaptured'],'abandoned defense is a real loss');
assert(C.sectorDefenseOpen(s.territory.refuge,'refuge'),'home sector stays recoverable');assert(!C.sectorDefenseOpen({owner:'parasites',status:'recaptured'},'western'),'raid sectors keep their raid recapture path');
now+=3*86400000;refreshState(s,now);assert(C.sectorDefenseOpen(s.territory.refuge,'refuge'),'still recoverable days later');
s.position=point(op.x-20,op.z+15);const cp0=s.ledger.cp;s=applyAction(s,{seq:s.seq+1,action:'start-sector-defense',mission:op.id},now+=1000);assert.equal(s.mission,op.id,'retake starts the same physical defense');
({s,now}=fight(s,now));assert.equal(s.battle.state,'victory','retake won through server inputs');
assert.deepEqual([s.territory.refuge.owner,s.territory.refuge.status],['humanity','secured']);assert.equal(s.settlement.kind,'sector-defense');assert.equal(s.ledger.cp-cp0,s.settlement.cp,'one authored defense reward');
const cp1=s.ledger.cp;s=applyCommands(structuredClone(s),{seq:s.seq+1,commands:[{x:0,z:0}]},now+50);assert.equal(s.ledger.cp,cp1,'reconnect cannot double the retake reward');
s=applyAction(s,{seq:s.seq+1,action:'return-exploration'},now+=1000);assert.equal(s.mission,null);assert.throws(()=>applyAction(structuredClone(s),{seq:s.seq+1,action:'start-sector-defense',mission:op.id},now+1000),/unavailable/,'no defense while secured and not under alert');
console.log('PASS Refuge home sector: real loss on abandoned invasion defense, physical retake restores ownership, one authored reward, no reconnect duplication');

// 2. Captured sectors keep roaming patrols on their Session 1 refresh; captured garrisons stay down.
now=1800000000000;s=createState(structuredClone(R.STOCK_L),now);
for(const id of C.raidIds){const o=C.operations[id];s.territory[o.sector]={owner:'humanity',status:'secured',capturedAt:now,defenseAt:now+1200000};}
for(const e of s.battle.enemies){e.hp=0;s.spawns[e.key]={generation:Math.floor(now/86400000),deadAt:now};}
s.position=point(5000,5000);refreshState(s,now+2*86400000);
const patrols=s.battle.enemies.filter(e=>e.base?.kind==='patrol'),garrisons=s.battle.enemies.filter(e=>e.base?.kind!=='patrol'&&s.territory[W.frontierSectorAt(e.home.x,e.home.z).id]?.capturedAt);
assert(patrols.length>=4&&patrols.every(e=>e.hp>0),'patrols repopulate captured sectors');assert(garrisons.length&&garrisons.every(e=>e.hp<=0),'captured-sector garrisons stay down');
console.log('PASS captured frontier keeps',patrols.length,'live patrols while',garrisons.length,'captured garrisons stay suppressed');
