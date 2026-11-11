// Continuous earned progression: accelerated trusted test clock, actual canonical inputs/outcomes.
// No seeded resources, equipment, positions, enemy HP, victories or settlement calls.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST:{World:W,Combat:C,Control:K}}=await import('../../worker/src/sim.gen.js');
const {createState,applyCommands,applyAction,hydrate}=await import('../../worker/src/conquest-sim.js');
const initial=1800000000000,terminal={x:1174,z:1168};let now=initial,s=createState(R.STOCK_L,now),path=[],pathKey='',stalled=0;
const trace=[],minutes=()=>+( (now-initial)/60000).toFixed(2),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function record(event){const row={event,minute:minutes(),hp:Math.round(s.hp),cp:s.ledger.cp,banked:structuredClone(s.ledger.banked),cargo:structuredClone(s.ledger.cargo),position:s.position};trace.push(row);console.log(JSON.stringify(row));}
function tick(input,frames=5){const old=s.position;now+=frames*50;s=applyCommands(s,{seq:s.seq+1,commands:Array.from({length:frames},(_,i)=>i?{...input,super:false}:input)},now);   /* SUPER is a press (5E-2b: a second press stops the timing bar), so only the first command of a batch carries it */assert(s.hp>0,'continuous starter pilot survives at '+minutes()+'min');stalled=distance(old,s.position)<.01?stalled+1:0;}
function action(action,extra={}){s=applyAction(s,{seq:s.seq+1,action,...extra},now);path=[];pathKey='';}
function route(B,target,radius){
 const p=s.position,key=Math.round(target.x/3)+':'+Math.round(target.z/3)+':'+radius;
 while(path.length&&distance(p,path[0])<2.5)path.shift();
 if(pathKey!==key||!path.length||stalled>10){
  const step=4,k=(x,z,surface)=>x+':'+z+':'+surface,origin={...p},start=k(0,0,p.surface),open=[{x:0,z:0,p:origin,g:0,f:distance(p,target)}],best=new Map([[start,0]]),parents=new Map(),points=new Map([[start,origin]]),closed=new Set();let end;
  for(let n=0;open.length&&n<6000;n++){
   open.sort((a,b)=>b.f-a.f);const c=open.pop(),ck=k(c.x,c.z,c.p.surface);if(closed.has(ck))continue;closed.add(ck);
   if(distance(c.p,target)<=Math.max(radius,4)){end=ck;break;}
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
    const x=c.x+dx,z=c.z+dz,f=W.roadAt?.(c.p.x,c.p.z)?1/W.ROAD_FAST:1,q=W.advance(c.p,dx*step*f,dz*step*f),nk=k(x,z,q.surface),g=c.g+Math.hypot(dx,dz)*step;
    if(closed.has(nk)||Math.hypot(q.x-origin.x-x*step,q.z-origin.z-z*step)>.3||Array.from({length:8},(_,i)=>({x:c.p.x+(q.x-c.p.x)*(i+1)/8,z:c.p.z+(q.z-c.p.z)*(i+1)/8})).some(p=>[[0,0],[1.6,0],[-1.6,0],[0,1.6],[0,-1.6]].some(o=>K.baseBlocked(B,{x:p.x+o[0],z:p.z+o[1]})))||B.enemies.some(e=>e.hp>0&&distance(q,e)<4)||g>=(best.get(nk)??Infinity))continue;
    best.set(nk,g);parents.set(nk,ck);points.set(nk,q);open.push({x,z,p:q,g,f:g+distance(q,target)});
   }
  }
  assert(end,'reachable physical route at '+minutes()+'min from '+JSON.stringify(p)+' to '+JSON.stringify(target));
  path=[];for(let key=end;key!==start;key=parents.get(key))path.unshift(points.get(key));pathKey=key;stalled=0;
 }
 return path[0]||target;
}
function command(target,{stop=5,enemy=null,exploration=!s.mission}={}){
 const B=hydrate(s),p=s.position,move=distance(p,target)>stop,goal=move?route(B,target,stop):p,dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz);
 const input={x:move&&d?dx/d:0,z:move&&d?dz/d:0,fire:!!enemy,lockId:enemy?.id||null,aimYaw:enemy?Math.atan2(enemy.x-p.x,enemy.z-p.z):Math.atan2(dx,dz),shield:B.playerHp<B.playerMax*.85,super:(!!enemy&&K.visible(B,p,enemy)&&B.charge>=1000)||!!(B.superAttack&&B.superAttack.bar&&B.superAttack.oc===undefined&&B.superAttack.el>=B.superAttack.bar.z0+0.06)};
 const speed=B.combatSpeed*(exploration?2:1),frames=move?Math.max(1,Math.min(10,Math.floor(d/(speed*.05)*.7))):10;tick(input,frames);
}
function nearest(B,enemies=B.enemies){return enemies.filter(e=>K.visible(B,s.position,e)).sort((a,b)=>distance(s.position,a)-distance(s.position,b))[0];}
function go(x,z,stop=5){const start=now,target={x,z};while(distance(s.position,target)>stop){const B=hydrate(s);command(target,{stop,enemy:nearest(B)});assert(now-start<180000,'travel budget '+x+','+z);}path=[];}
function supply(){
 // East corridor avoids the real oxygen towers and Refuge building array.
 go(1240,1048);go(1240,1128);go(1174,1128);go(terminal.x,terminal.z,5);action('bank');action('repair');
}
// Genuine opening: same safe start, viaduct, physical starter kill and salvage as opening regression.
for(let i=0;i<10;i++)tick({x:0,z:0},10);assert.equal(s.hp,s.battle.playerMax);
while(s.position.x<1195)tick({x:1,z:0,aimYaw:Math.PI/2});
record('first-contact');
for(let i=0;i<200&&!s.drops.length;i++){const B=hydrate(s);command(s.position,{enemy:nearest(B)});}assert(s.drops.length,'real opening drop');
go(s.drops[0].x,s.drops[0].z,4);assert(s.ledger.cp>0);supply();record('first-kill-salvage-bank');
const ids=['oxygen-line','relay','recon'];let completed=0,baseMinute=null;
while((!baseMinute||s.ledger.cp<C.baseDefinition.moduleCosts[0].cp)&&now-initial<90*60000){
 const id=ids[completed%ids.length],o=C.operations[id];
 // Leave Refuge through the real eastern/northern approach, then route to the activation apron.
 go(1174,1128);go(1240,1128);go(1240,1048);go(o.x-24,o.z-20,8);
 const claim=s.missionClaims[id],wait=claim?180000-now+(claim.lastAt||claim.firstAt):0;
 // Only the actual contract cooldown may require waiting. All alternatives have been visited.
 if(wait>0)for(let elapsed=0;elapsed<wait;elapsed+=1000)tick({x:0,z:0,shield:true},20);
 action('start-mission',{mission:id});const start=now;
 while(s.battle.state==='active'){
  const B=hydrate(s),p=s.position,required=B.enemies.filter(e=>e.hp>0&&(!e.resident||(['relay','redoubt'].includes(id)&&e.base?.id===o.site))),enemy=required.find(e=>e.id===B.carrierId)||nearest(B,required)||required[0];
  let target=enemy||B.objective,stop=enemy&&K.visible(B,p,enemy)?26:8;
  if(id==='oxygen-line'&&!enemy){target=p;stop=1;}
  if(id==='recon'&&B.nodes[B.scans]){target={x:B.nodes[B.scans][0],z:B.nodes[B.scans][1]};stop=5;}
  if(id==='relay'&&enemy?.immobile&&!K.visible(B,p,enemy)&&p.z>o.z-14){target={x:o.x-25,z:o.z-20};stop=5;}
  command(target,{stop,enemy});assert(now-start<600000,'operation completes in its real time budget');
 }
 assert.equal(s.battle.state,'victory',id);assert(s.settlement.cp>0);completed++;record(id+'-victory');action('return-exploration');supply();record('bank-'+completed);
 const D=C.baseDefinition;
 if(!baseMinute&&Object.entries(D.recipe).every(([k,n])=>(k==='cp'?s.ledger.cp:s.ledger.banked[k])>=n)){
  go(1080,1140);go(D.x,D.z,5);action('build-base');baseMinute=minutes();record('earned-command-base-I');
 }
}
assert(baseMinute,'first base earned within 90 accelerated game minutes');
// A real paid-for module must mature through input time; there is no readyAt or balance override.
assert(baseMinute>=45&&baseMinute<=75,'measured starter first-base time stays in the owner target');
go(1080,1140);go(C.baseDefinition.x,C.baseDefinition.z,5);action('base-module',{module:'reactor'});record('earned-reactor-construction');
for(let i=0;i<60;i++)tick({x:0,z:0},20);assert.equal(s.base.modules.reactor,1);record('earned-reactor-complete');
const reloaded=structuredClone(s);assert.equal(hydrate(reloaded).playerHp,s.hp);assert.equal(reloaded.base.modules.reactor,1);assert.equal(reloaded.base.tier,1);assert.equal(Object.keys(reloaded.completed).length,3);
const report={scope:'continuous shared-reducer journey with accelerated trusted test clock and automated target/routing controller; no resource/equipment/position/outcome fixtures; not a rendered native-input or human playthrough',sourceBase:process.env.CQ_SOURCE_SHA||'working-tree',baseMinute,completed,trace,final:s};
writeFileSync('/tmp/lunar-earned-journey.json',JSON.stringify(report,null,2));
console.log('PASS continuous starter kill/salvage/bank, distinct real missions naturally earned physical Command Base and completed paid module');
