// Continuous earned progression (Session 6: the new first hour, end to end through the Worker reducer): accelerated trusted
// test clock, actual canonical inputs/outcomes, and the HUD's own NEXT chip rules (js/conquest/guide.js) choose every order.
// No seeded resources, equipment, positions, enemy HP, victories or settlement calls. The account wallet is the outbox credited
// exactly as eco.js creditConquest does (minerals + base points at Rookie pay), so the first plate is fabricated with rules.js
// ecoPlate from what was really banked. The simulated minutes to each first-hour moment go to docs/conquest/session6/.
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';import vm from 'node:vm';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST:{World:W,Combat:C,Control:K}}=await import('../../worker/src/sim.gen.js');
const {createState,applyCommands,applyAction,hydrate}=await import('../../worker/src/conquest-sim.js');
const {seal,acknowledge}=await import('../../worker/src/conquest-airdrop.js');
const gctx={console,Math,JSON,Object,Array,Number,String,Map,Set,Symbol,Error,Date,structuredClone,performance:{now:()=>0}};gctx.globalThis=gctx;vm.createContext(gctx);
for(const f of ['js/rules.js','js/game.js','js/conquest/world.js','js/conquest/combat.js','js/conquest/controls.js','js/conquest/guide.js'])vm.runInContext(readFileSync(f,'utf8'),gctx,{filename:f});const G=gctx.ConquestGuide;
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
// The account side: every sealed outbox entry is credited once (minerals to the wallet, base points at Rookie pay x1), as
// eco.js creditConquest does; the HUD's wallet view follows it.
const acct={mn:R.mnOf({}),pts:0,ptsSpent:0,ap:[0,0,0,0]},moments={};
function credit(){seal(s,now);const a=s.airdrop;let top=a.ack;for(const e of a.out){if(e.id<=a.ack)continue;acct.pts+=Math.round(e.raw);for(const [k,v] of Object.entries(e.mn||{}))acct.mn[k]=(acct.mn[k]||0)+v;top=Math.max(top,e.id);}acknowledge(s,top,{mn:{...acct.mn},ap:[...acct.ap],pay:1});}
function moment(k){if(moments[k]===undefined){moments[k]=minutes();record(k);}}
function bankAt(){go(terminal.x,terminal.z,5);action('bank');action('repair');credit();}
function tryGo(x,z,stop,budget){const start=now,target={x,z};try{while(distance(s.position,target)>stop&&now-start<budget){const B=hydrate(s);command(target,{stop,enemy:nearest(B)});}}catch(e){}path=[];return distance(s.position,target)<=stop;}
function sweep(){for(const d of [...s.drops].filter(d=>distance(d,s.position)<90).sort((a,b)=>distance(a,s.position)-distance(b,s.position))){const cp=s.ledger.cp;tryGo(d.x,d.z,4,45000);if(s.ledger.cp>cp)moment('first-loot');}}   // pickup is best effort: a cache wedged between buildings is left
function fight(id){const o=C.operations[id],start=now;moment('first-fight');
 while(s.battle.state==='active'){const B=hydrate(s),p=s.position,required=B.enemies.filter(e=>e.hp>0&&(!e.resident||(['relay','redoubt'].includes(id)&&e.base?.id===o.site))),enemy=required.find(e=>e.id===B.carrierId)||nearest(B,required)||required[0];
  let target=enemy||B.objective,stop=enemy&&K.visible(B,p,enemy)?26:8;
  if(id==='oxygen-line'&&!enemy){target=p;stop=1;}
  if(id==='wingman-rescue'&&!enemy)stop=4;   // Session 6C: hold beside the downed pilot's wreck (within 8 m) to pull them out
  if(id==='recon'&&B.nodes[B.scans]){target={x:B.nodes[B.scans][0],z:B.nodes[B.scans][1]};stop=5;}
  if(id==='relay'&&enemy?.immobile&&!K.visible(B,p,enemy)&&p.z>o.z-14){target={x:o.x-25,z:o.z-20};stop=5;}
  command(target,{stop,enemy});if((s.battle.kills|0)>0)moment('first-kill');assert(now-start<600000,'operation completes in its real time budget');}
 assert.equal(s.battle.state,'victory',id);assert(id==='wingman-rescue'?s.settlement.kind==='wingman'&&s.settlement.cp===0&&!!s.settlement.bat?.joined:s.settlement.cp>0);record(id+'-victory');action('return-exploration');credit();sweep();}
// 1. The first defense, right at the spawn (the radio plays over it on a phone; no dialog stands between spawn and fight).
for(let i=0;i<10;i++)tick({x:0,z:0},10);assert.equal(s.hp,s.battle.playerMax);assert.deepEqual([s.position.x,s.position.z],[W.spawn.x,W.spawn.z]);
action('start-mission',{mission:'oxygen-line'});fight('oxygen-line');
// 2. The coach chain, exactly as the NEXT chip leads it: BANK -> SCAN -> GATHER -> BANK -> (more Ferrite) -> FABRICATE.
const opts=()=>({wallet:acct.mn,plates:acct.ap,now});let guard=0;
for(let c=G.coachStep(s,s.position,opts());c&&guard<20;c=G.coachStep(s,s.position,opts()),guard++){record('coach-'+c.coach);
 if(c.coach==='bank'||c.coach==='bank2'){bankAt();moment(c.coach==='bank'?'first-bank':'ferrite-banked');}
 else if(c.coach==='more'&&C.operations[c.id]){const o=C.operations[c.id];go(o.x,o.z,Math.min(o.activationRadius-6,30));action('start-mission',{mission:c.id});fight(c.id);bankAt();moment('second-mission');}
 else if(c.coach==='scan'||c.coach==='more'&&c.kind==='coach'){go(c.x,c.z,Math.min(c.radius,40));tick({x:0,z:0,scan:true},2);moment('first-scan');for(let i=0;i<30;i++)tick({x:0,z:0},20);}
 else if(c.coach==='gather'||c.coach==='more'){go(c.x,c.z,3);const t0=now;while(G.coachStep(s,s.position,opts())?.coach===c.coach&&now-t0<60000){const B=hydrate(s),e=nearest(B);if(e)command(s.position,{enemy:e});else tick({x:0,z:0,gather:true},10);}moment(c.coach==='gather'?'starter-vein':'second-ferrite');}
 else if(c.coach==='plate'){go(terminal.x,terminal.z,5);const r=R.ecoPlate(acct,0,1);assert(!r.err,'first plate: '+JSON.stringify(r));credit();moment('first-plate');}}
assert(acct.ap[0]===1,'the coach chain ends with the FRONT Ferrite plate fitted');
// 3. The board: the nearest field missions until the town is affordable, then CLAIM YOUR TOWN at the Command Gate.
let completed=1,baseMinute=null;
while(!baseMinute&&now-initial<60*60000){const o=G.boardOrder(s,s.position,{pay:1});assert(o,'the NEXT chip always has an order');
 if(o.name==='CLAIM YOUR TOWN'){go(1080,1140);go(o.x,o.z,5);action('build-base',{plot:{site:'ridge'}});baseMinute=minutes();moment('first-town');break;}
 const id=o.id;assert(C.fieldMissionIds.includes(id)||id==='wingman-rescue','the board leads to a field mission (or, right after the first plate, the rescue of the first wingman: Session 6C): '+o.name);go(o.x,o.z,Math.min(o.activationRadius-6,30));
 action('start-mission',{mission:id});fight(id);completed++;bankAt();moment('field-'+completed);}
assert(baseMinute,'the town is claimed in the first session');assert(baseMinute<=22,'CLAIM YOUR TOWN at <= 22 simulated minutes (owner target): '+baseMinute);
// 4. A real paid-for module must mature through input time; there is no readyAt or balance override (the earned-defense test continues this save).
while(s.ledger.cp<C.baseDefinition.moduleCosts[0].cp||Object.entries(C.baseDefinition.moduleCosts[0]).some(([k,n])=>k!=='cp'&&s.ledger.banked[k]<n)){const o=G.boardOrder(s,s.position,{pay:1})||C.operations.recon;const id=C.fieldMissionIds.includes(o.id)?o.id:'recon';const claim=s.missionClaims[id],wait=claim?180000-now+(claim.lastAt||claim.firstAt):0;if(wait>0)for(let e=0;e<wait;e+=1000)tick({x:0,z:0,shield:true},20);const op=C.operations[id];go(op.x,op.z,Math.min(op.activationRadius-6,30));action('start-mission',{mission:id});fight(id);bankAt();assert(now-initial<120*60000,'module affordable in two hours');}
go(1080,1140);go(C.baseDefinition.x,C.baseDefinition.z,5);action('base-module',{module:'reactor'});record('earned-reactor-construction');
for(let i=0;i<60;i++)tick({x:0,z:0},20);assert.equal(s.base.modules.reactor,1);record('earned-reactor-complete');
const reloaded=structuredClone(s);assert.equal(hydrate(reloaded).playerHp,s.hp);assert.equal(reloaded.base.modules.reactor,1);assert.equal(reloaded.base.tier,1);
const report={scope:'continuous shared-reducer journey with accelerated trusted test clock; orders chosen by the HUD NEXT chip rules (js/conquest/guide.js); automated target/routing controller; no resource/equipment/position/outcome fixtures; not a rendered native-input or human playthrough',sourceBase:process.env.CQ_SOURCE_SHA||'working-tree',baseMinute,completed,moments,trace,final:s};
writeFileSync('/tmp/lunar-earned-journey.json',JSON.stringify(report,null,2));mkdirSync('docs/conquest/session6',{recursive:true});writeFileSync('docs/conquest/session6/first-hour-journey.json',JSON.stringify({scope:report.scope,moments,baseMinute,completed},null,1)+'\n');
console.log('MOMENTS '+JSON.stringify(moments));
console.log('PASS the new first hour end to end: first defense at the spawn, kill, loot, bank, scan, Starter Vein, first plate, field missions by the NEXT chip, town claimed at '+baseMinute+' simulated minutes, then a real module');
