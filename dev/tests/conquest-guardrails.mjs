// Session 6C guardrails (owner prompt Nov 18, section 8; blueprint §12), on the real shared engine (worker/src/sim.gen.js) and the
// Worker's own operation start and fielding (worker/src/conquest-sim.js start-mission, worker/src/conquest-battalion.js field):
//  2. Better gear always helps: Starter, Epic and Legendary win rates rise in that order on every authored encounter (the field
//     missions, the 25 raids, the Meteor Strikes, the territory defenses) and on the town defense at every base tier: no encounter
//     where a better kit wins less often, and more wins in total at every step. Starter = the stock kit; Epic = Epic Pulse + Epic
//     Vanguard (the same classes: only the rarity changes); Legendary = the Moonbeam + Epic Vanguard + the Lunar Skin.
//  4. Composition matters: a balanced force beats a one-role force of equal gear on most authored operations, for every one of
//     the six roles (simulation: contested fights, the 15 VETERAN raids as authored, a stock pilot and four allies in equal Rare gear).
// (Guardrail 1 lives in conquest-combat.mjs + conquest-power-chip.mjs, guardrail 3 in conquest-allies.mjs section 5.)
// The pilot is the raids test's physical-input pilot (dev/tests/lib/raid-pilot.mjs) on the engine directly: no reducer per step,
// which gives exactly the reducer's outcome (checked in conquest-allies.mjs section 10). Seeds: the battle's own crit seed and a
// small change of entry point. Run: node dev/tests/conquest-guardrails.mjs   (CQ_GUARD=2 or 4 runs one; CQ_SEEDS=n, default 4)
import assert from 'node:assert/strict';import fs from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:CQ,RULES:R}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Control:K}=CQ;
const {createState,applyAction,hydrate}=await import('../../worker/src/conquest-sim.js');
const {raidPilotBattle}=await import('./lib/raid-pilot.mjs');const runB=raidPilotBattle({C,W,K});
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const clone=v=>JSON.parse(JSON.stringify(v)),only=process.env.CQ_GUARD,SEEDS=Math.max(1,Number(process.env.CQ_SEEDS)||4),out={generatedBy:'dev/tests/conquest-guardrails.mjs',scope:'scripted pilot (the raids test\'s physical-input controller) on the shared engine; not a human playtest'};
const NOW=1800000000000,seedOf=k=>(0x03012026^Math.imul(k+1,0x9e3779b1))>>>0;
// ---- 2. better gear always helps ----
if(!only||only==='2'){
 const STARTER=clone(R.STOCK_L),EPIC={...clone(R.STOCK_L),w:{a:'pulse',t:2,q:1,s:false},c:{c:'vanguard',t:2,q:1,s:false}},LEG={...clone(R.STOCK_L),w:{a:'moon',t:2,q:1,s:false},c:{c:'vanguard',t:2,q:1,s:false},skin:'lunar'};
 const GEAR=[['starter',STARTER],['epic',EPIC],['legendary',LEG]];
 const at=(o,k)=>{const e=o.entry||[o.x-25,o.z+8],a=k*2.4;return {x:e[0]+(k?Math.cos(a)*3:0),z:e[1]+(k?Math.sin(a)*3:0)};};
 // the Worker's own start (residents of the open world come in, as for a real pilot); seed k changes the crit seed and the entry
 function viaWorker(id,L,k){let s=createState(clone(L),NOW);s.completed=Object.fromEntries(C.fieldMissionIds.map(id=>[id,{at:NOW,attempt:0}]));const q=at(C.operations[id],k);s.position={x:q.x,z:q.z,y:W.groundAt(q.x,q.z),surface:'ground'};
  s=applyAction(s,{seq:1,action:'start-mission',mission:id},NOW);const B=hydrate(s);B.seed=seedOf(k);return {B,p:{...s.position}};}
 // a Meteor Strike, a territory defense or the town defense opens on the world's own clock or an alert: built directly, the same way
 function direct(id,L,k,tier=0){const o=C.operations[id],q=at(o,k),p={x:q.x,z:q.z,y:W.groundAt(q.x,q.z),surface:'ground'},B=new C.Operation(clone(L),p,id);if(tier){B.baseTier=tier;B.defenseConfig='turret';}B.seed=seedOf(k);return {B,p};}   // the town's own turret support grows with its tier
 const list=[...C.fieldMissionIds.map(id=>[id,0,'worker']),['wingman-rescue',0,'worker'],...C.raidIds.map(id=>[id,0,'worker']),...Object.keys(C.operations).filter(id=>C.operations[id].strike).map(id=>[id,0,'direct']),...Object.keys(C.operations).filter(id=>C.operations[id].defense).map(id=>[id,0,'direct']),...[1,2,3,4,5].map(t=>['base-defense',t,'direct'])];
 const rows=[],tot={starter:0,epic:0,legendary:0};
 for(const [id,tier,how] of list){const w={},hull={};for(const [g,L] of GEAR){w[g]=0;hull[g]=0;for(let k=0;k<SEEDS;k++){const {B,p}=how==='worker'?viaWorker(id,L,k):direct(id,L,k,tier),r=runB(B,p,{maxSteps:8400});if(r.outcome==='victory')w[g]++;hull[g]+=r.hullLeft;}tot[g]+=w[g];}
  const name=id+(tier?' (town tier '+tier+')':''),row={id:name,danger:C.operations[id].danger,wins:w,hull};rows.push(row);console.log(JSON.stringify(row));
  ok(w.starter<=w.epic&&w.epic<=w.legendary,name+': win rates Starter '+w.starter+' <= Epic '+w.epic+' <= Legendary '+w.legendary+' of '+SEEDS);}
 ok(tot.starter<tot.epic&&tot.epic<tot.legendary,'better gear always helps: '+tot.starter+' < '+tot.epic+' < '+tot.legendary+' wins over '+list.length+' encounters x '+SEEDS+' seeds');
 out.gearOrder={seeds:SEEDS,encounters:list.length,totals:tot,rows};}
// ---- 4. composition matters, in contested fights (reviewer 2): a stock pilot and four allies in equal Rare gear on the 15 VETERAN
// raids as authored, two crit seeds each. A force of nine (or nine Rare tanks) wins every authored raid, so there the make-up only moves
// the clear time; four allies make the fights real. The balanced force (Guardian, Lancer, Mender, Breacher) must win more fights than
// each one-role force, and at least as many on most operations ----
if(!only||only==='4'){
 const T=1,kitOf=r=>({w:{a:r==='lancer'?'siege':r==='breacher'?'twin':'pulse',t:T,q:1},c:{c:(C.ROLES[r]?.cls||['vanguard'])[0],t:T,q:1}});
 function force(id,roles,k){const o=C.operations[id],q=o.entry||[o.x+22,o.z+26],p={x:q[0],z:q[1],y:W.groundAt(q[0],q[1]),surface:'ground'},B=new C.Operation(clone(R.STOCK_L),p,id);B.seed=seedOf(k);B.squad.orders=1;B.squad.f='wedge';
  roles.forEach((r,i)=>{const sl=C.FORMS.wedge[i];B.friends.push(C.friendUnit({id:800000001+i,pid:'p'+i,role:r,kit:kitOf(r),x:p.x+sl[0]*.5,z:p.z+sl[1]*.5-4,m:1}));});const r=runB(B,p,{maxSteps:8400});return {w:r.outcome==='victory'?1:0,s:r.seconds};}
 const OPS=C.raidIds.filter(id=>C.operations[id].danger==='VETERAN'),SE=2,BAL=['guardian','lancer','mender','breacher'],wins=roles=>OPS.map(id=>{let w=0,t=0;for(let k=0;k<SE;k++){const r=force(id,roles,k);w+=r.w;if(r.w)t+=r.s;}return {w,t:w?+(t/w).toFixed(2):null};});
 // a raid is won by the force that wins more of its fights; with as many wins, by the faster clear (at least 1 s: no photo finish)
 const bal=wins(BAL),res={balanced:bal},sum=a=>a.reduce((x,y)=>x+y.w,0),beats=(b,o)=>b.w>o.w||b.w===o.w&&b.w>0&&b.t<o.t-1;
 for(const r of C.ROLE_ORDER){const one=wins(Array(4).fill(r));res[r]=one;const won=OPS.filter((_,i)=>beats(bal[i],one[i])).length,lost=OPS.filter((_,i)=>beats(one[i],bal[i])).length;
  ok(won>OPS.length/2,'composition matters: a balanced force beats four '+C.ROLES[r].n+'s on '+won+' of '+OPS.length+' contested VETERAN raids (loses '+lost+'; fights won '+sum(bal)+' to '+sum(one)+' of '+OPS.length*SE+')');}
 out.composition={balanced:BAL,ops:OPS,seeds:SE,gear:'stock pilot, four allies in equal Rare gear',results:res};}
fs.mkdirSync('docs/conquest/session6c',{recursive:true});if(!only)fs.writeFileSync('docs/conquest/session6c/guardrails.json',JSON.stringify(out,null,1)+'\n');
console.log('PASS conquest-guardrails ('+passed+' checks)');
