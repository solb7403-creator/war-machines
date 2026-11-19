// Session 6C (owner prompt Nov 18, section 2): friendly units in the Conquest combat engine (js/conquest/combat.js Battle.friends).
// Checks, on the real shared code (the Worker bundle worker/src/sim.gen.js and the phone's own files in a VM):
//  - allies fight with the shared projectiles, damage and steering; the Parasites target across the friendly side
//  - a controller field ('ai' now, a human pilot later); an LDF regular ignores your orders; caps 10 / 20 / 6 / 160 (+ the
//    Parasites' own 96); a general's shield core and every objective are the pilot's alone
//  - ally supers follow the player's charge rule plus a minimum spacing; downed allies return at half hull (never lost)
//  - deterministic: phone == Worker, and a save / reload mid-fight continues exactly
//  - the damage split per fight size (Wing 2, Platoon 4, Battalion 9), written to docs/conquest/session6c/ally-split.json
// Run: node dev/tests/conquest-allies.mjs   (CQ_ALLY_SPLIT=0 skips the split measurement)
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{Combat:C,World:W,Control:K},RULES:R}=await import('../../worker/src/sim.gen.js');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const clone=v=>JSON.parse(JSON.stringify(v));
const kitOf=(r,t=0)=>({w:{a:r==='lancer'?'siege':r==='breacher'?'twin':'pulse',t,q:1},c:{c:(C.ROLES[r]?.cls||['vanguard'])[0],t,q:1}});
function stageOn(CC,id,roles,{L=R.STOCK_L,orders=1,form='wedge',tier=0,extra=null,mil=false}={}){const o=CC.operations[id],q=o.entry||[o.x+22,o.z+26],p={x:q[0],z:q[1],y:W.groundAt(q[0],q[1]),surface:'ground'};
 const B=new CC.Operation(L,p,id);if(extra)extra(B,o);B.squad.orders=orders;B.squad.f=form;
 roles.forEach((r,i)=>{const sl=CC.FORMS[form][i];B.friends.push(CC.friendUnit({id:800000001+i,pid:'p'+i,role:r==='none'?'':r,kit:{...kitOf(r,tier),...(mil?{mil:1}:{})},x:p.x+sl[0]*.5,z:p.z+sl[1]*.5-4,m:1}));});return {B,p};}
const stage=(...a)=>stageOn(C,...a);
// The scripted pilot (a human-like profile: locks the nearest visible Parasite, closes to 60% of its range, fires, raises the
// shield under 80% hull, fires a super when full, steps out of marked strikes, drives to the objective when the area is clear).
function pilotInput(KK,CC,B,p,state){const o=B.operation,alive=B.enemies.filter(e=>e.hp>0&&!e.resident),vis=alive.filter(e=>KK.visible(B,p,e)).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
 const pri=state.lock&&vis.find(e=>e.id===state.lock)||vis.find(e=>e.id===B.carrierId)||vis.find(e=>e.immobile)||vis[0]||null;state.lock=pri?.id||null;
 let goal=pri||alive.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0]||B.objective;
 if(!pri&&!alive.length&&o&&(['battery','extraction'].includes(o.family)||o.id==='recon')&&B.nodes[B.scans])goal={x:B.nodes[B.scans][0],z:B.nodes[B.scans][1]};
 const dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),range=CC.engineeringValues(B.playerStats,B.engineering).range,move=pri?d>range*.6:d>3;
 let mx=move?dx/(d||1):0,mz=move?dz/(d||1):0;const hz=B.hazards?.find(h=>Math.hypot(h.x-p.x,h.z-p.z)<h.radius+2);if(hz){const ax=p.x-hz.x,az=p.z-hz.z,n=Math.hypot(ax,az)||1;mx=ax/n;mz=az/n;}
 if(move&&!hz){let best=-Infinity;for(const off of [0,.6,-.6,1.2,-1.2,1.8,-1.8,2.4,-2.4]){const a=Math.atan2(mx,mz)+off,vx=Math.sin(a),vz=Math.cos(a),q=W.advance(p,vx*4,vz*4),tr=Math.hypot(q.x-p.x,q.z-p.z),sc=tr>2?-Math.hypot(goal.x-q.x,goal.z-q.z)-Math.abs(off)*.7:-Infinity;if(sc>best){best=sc;mx=vx;mz=vz;}}}
 const sa=B.superAttack;return KK.validated(KK.command({x:mx,z:mz,fire:!!pri,lockId:pri?.id||null,aimYaw:Math.atan2(pri?pri.x-p.x:dx,pri?pri.z-p.z:dz),shield:B.playerHp<B.playerMax*.8,super:B.charge>=1000||!!(sa&&sa.bar&&sa.oc===undefined&&sa.el>=sa.bar.z0+0.06)}));}
function run({B,p},{maxS=420,KK=K,CC=C,each=null}={}){let t=0;const st={lock:null};while(B.state==='active'&&t<maxS){const input=pilotInput(KK,CC,B,p,st);if(each)each(B,t);Object.assign(p,KK.advance(B,p,input,.05,false));t+=.05;}
 const pd=B.pilotDmg||0,ad=B.allyDmg||0;return {outcome:B.state,secs:+t.toFixed(1),pilot:Math.round(pd),ally:Math.round(ad),share:+(ad/((ad+pd)||1)).toFixed(3),downs:B.downs||0,hp:Math.round(B.playerHp)};}

// ---- 1. allies fight with the shared rules; the Parasites target across the friendly side ----
{const s=stage('raid-intercept-1',['guardian','lancer','mender','breacher']);let hitFriend=0;const r=run(s,{each:B=>{for(const f of B.friends)if(f.hp<f.maxHp)hitFriend=1;}});
 ok(r.outcome==='victory'&&r.ally>0&&r.pilot>0,'a Platoon of militia allies fights with the shared projectiles and damage: victory, pilot '+r.pilot+' / allies '+r.ally+' damage');
 ok(hitFriend===1,'the Parasites fire at the friendly side too (an ally took damage), not only at the pilot');
 ok(s.B.friends.every(f=>!('stats' in f))&&s.B.projectiles.every(q=>q.team==='enemy'||!('stats' in q)),'friendly units and the pilot\'s / allies\' shots never carry a stats object (derived on each side from the kit: the record stays small)');}
// Guardian: draws fire inside its taunt radius and covers whoever stands behind it
{const {B,p}=stage('raid-intercept-1',['guardian']),e=B.enemies.find(e=>e.hp>0&&!e.resident),g=B.friends[0];
 Object.assign(e,{x:p.x+40,z:p.z});Object.assign(g,{x:p.x+20,z:p.z});const T=B.threat(e,40);ok(T.f===g,'a Guardian inside its taunt radius draws the Parasite\'s fire (it was the pilot\'s by ALLY.pilotBias)');
 Object.assign(g,{x:p.x+8,z:p.z});const q={owner:e.id};ok(Math.abs(B.coverOf(B.player,q)-C.ROLES.guardian.cover)<1e-9,'the Guardian between the shooter and the pilot cuts the hit by '+C.ROLES.guardian.cover*100+'%');
 Object.assign(g,{x:p.x-6,z:p.z});ok(B.coverOf(B.player,q)===0,'no cover from a Guardian standing behind you');}
// ---- 2. controller field and the LDF regular ----
{const {B,p}=stage('raid-intercept-1',[]);const mk=(o)=>C.friendUnit({kit:kitOf(''),m:1,...o});
 const human=mk({id:800000101,pid:'h',x:p.x+5,z:p.z-5}),ldf=mk({id:800000102,side:'ldf',x:p.x+8,z:p.z-8,post:{x:p.x+8,z:p.z-8}}),mine=mk({id:800000103,pid:'m',x:p.x-5,z:p.z-5});
 human.ctl='pilot:test';B.friends.push(human,ldf,mine);B.squad.orders=1;const at=[human.x,human.z];
 for(let i=0;i<120;i++)K.advance(B,p,K.validated({x:0,z:0,order:i===0?3:0}),.05,false);
 ok(human.x===at[0]&&human.z===at[1]&&human.cd===.6,'a unit with a human controller is never driven by the AI (the co-op foundation)');
 ok(B.squad.o==='hold'&&ldf.side==='ldf'&&Math.hypot(ldf.x-ldf.post.x,ldf.z-ldf.post.z)<31,'an LDF regular keeps its own post: your HOLD HERE is for your pilots only');
 ok(C.friendUnit({id:1,x:p.x,z:p.z,side:'ldf'}).side==='ldf'&&C.friendUnit({id:1,x:p.x,z:p.z}).side==='mine','LDF and your own units are the same unit type with a side');}
// ---- 3. caps ----
{ok(C.CAPS.friends===10&&C.CAPS.hostile===20&&C.CAPS.drones===6&&C.CAPS.projectiles===160&&C.CAPS.enemyProjectiles===96,'caps in any fight: 10 friendly units, 20 active hostiles, 6 drones, 160 projectiles; the Parasites keep today\'s 96');
 const {B,p}=stage('raid-siege-1',[]);for(let i=0;i<30;i++){try{B.deploy('raider',B.operation.x+(i%6)*8-20,B.operation.z-30-Math.floor(i/6)*8,'cap:'+i);}catch(e){}}
 const alive=B.enemies.filter(e=>e.hp>0&&!e.resident).length,set=B.activeHostiles();ok(alive>20&&set&&set.size===20,'with '+alive+' Parasites alive only the nearest 20 run each step');
 const before=new Map(B.enemies.map(e=>[e.id,e.decision]));B.step(.05,false);const ran=B.enemies.filter(e=>e.hp>0&&!e.resident&&e.decision!==before.get(e.id)).length;ok(ran<=20,'the step ran '+ran+' Parasites (at most 20)');
 B.projectiles=[];for(let i=0;i<200;i++)B.shoot({x:p.x,y:p.y+2,z:p.z},{x:p.x+50,y:p.y+2,z:p.z+i},B.enemies[0].stats,'enemy','pulse',B.enemies[0].id);ok(B.projectiles.filter(q=>q.team==='enemy').length===96,'the Parasites stop at their own 96 projectiles');
 for(let i=0;i<200;i++)B.shoot({x:p.x,y:p.y+2,z:p.z},{x:p.x+50,y:p.y+2,z:p.z-i},B.playerStats,'player','pulse',0);ok(B.projectiles.length===160,'no fight holds more than 160 projectiles');}
{const {B}=stage('raid-extraction-1',[]),c=B.enemies.find(e=>e.commander&&e.pattern==='carrier');for(let i=0;i<8;i++){B.deploy('raider',c.x+i,c.z+8,'dr:'+i);const d=B.enemies.at(-1);d.drone=true;d.surface='air';}
 c.drones=0;c.nextPattern=0;B.hazards=[];B.hazardStep(.05);ok(B.enemies.filter(e=>e.drone&&e.hp>0).length===8,'a carrier never launches a drone while 6 or more are alive (8 seeded, none added)');}
// ---- 4. pilot-only: objectives and a general's shield core ----
{const {B,p}=stage('raid-sabotage-1',['guardian','lancer']),o=B.objective,clear=()=>{for(const e of B.enemies)e.hp=0;B.hazards=[];};clear();let most=0;
 for(let i=0;i<200;i++){clear();for(const f of B.friends){f.x=o.x+1;f.z=o.z+1;f.vx=f.vz=0;}K.advance(B,p,K.validated({x:0,z:0}),.05,false);most=Math.max(most,B.work);}ok(most===0&&B.state==='active','allies standing on the uplink with the area clear do not occupy it: only the pilot captures, plants and extracts');
 const at={x:o.x,z:o.z,y:W.groundAt(o.x,o.z),surface:'ground'};for(let i=0;i<200&&B.state==='active';i++){clear();K.advance(B,at,K.validated({x:0,z:0}),.05,false);}ok(B.state==='victory','the pilot on the uplink completes it ('+B.work.toFixed(1)+' s held)');}
{const {B,p}=stage('raid-intercept-1',['lancer']);const e=B.enemies.find(x=>x.hp>0&&!x.resident),f=B.friends[0];e.core=500;const hp=e.hp;
 const q={x:e.x,y:e.y+2.2,z:e.z,vx:1,vy:0,vz:0,team:'ally',kind:'siege',owner:f.id};B.hit(q,e,2.7);ok(e.hp===hp&&e.core===500,'an ally\'s hit does nothing to a general while its shield core holds');
 const qp={x:e.x,y:e.y+2.2,z:e.z,vx:1,vy:0,vz:0,team:'player',kind:'pulse',owner:0};B.random=()=>1;B.hit(qp,e,2.7);ok(e.core<500,'the pilot\'s own hit breaks the shield core');}
// ---- 5. fair AI supers: the player's charge rule plus a minimum spacing (three full assaults, militia allies: long fights) ----
{const log=[];for(const id of ['raid-siege-1','raid-siege-2','raid-siege-4']){const {B,p}=stage(id,['lancer','lancer','breacher','guardian','mender','corroder','frostline','breacher','lancer'],{extra:assaultFixture});
  const orig=B.allySuper,meter=new Map();B.allySuper=function(f,st,aim){const m=meter.get(f.id)||{last:0,sum:0};log.push({op:id,id:f.id,t:B.time,charge:m.sum+Math.max(0,f.charge-m.last),meter:f.charge});meter.set(f.id,{last:0,sum:0});return orig.call(this,f,st,aim);};
  run({B,p},{each:BB=>{for(const f of BB.friends){const m=meter.get(f.id)||{last:0,sum:0};if(f.charge>m.last)m.sum+=f.charge-m.last;m.last=f.charge;meter.set(f.id,m);}}});}
 const byKey=new Map();for(const e of log){const k=e.op+':'+e.id;(byKey.get(k)||byKey.set(k,[]).get(k)).push(e.t);}
 const spaced=[...byKey.values()].every(ts=>ts.every((t,i)=>!i||t-ts[i-1]>=C.ALLY.superSpacing-1e-9)),gap=['raid-siege-1','raid-siege-2','raid-siege-4'].every(op=>{const ts=log.filter(e=>e.op===op).map(e=>e.t);return ts.every((t,i)=>!i||t-ts[i-1]>=C.ALLY.superGap-1e-9);});
 ok(log.length>0&&spaced&&gap,'ally supers: '+log.length+' in three full assaults, never closer than '+C.ALLY.superSpacing+' s for one unit or '+C.ALLY.superGap+' s across all units');
 ok(log.every(e=>e.charge>=R.SUPER_MAX-1e-6&&e.meter>=R.SUPER_MAX-1e-6),'every ally super came after a full meter ('+R.SUPER_MAX+') of that unit\'s own damage dealt and taken (the player\'s charge rule): '+log.map(e=>Math.round(e.charge)).join(', '));}
// ---- 6. downed allies: never lost; they return at half hull ----
{const p0={x:W.spawn.x,z:W.spawn.z,y:W.groundAt(W.spawn.x,W.spawn.z),surface:'ground'},B=new C.Encounter(R.STOCK_L,p0);B.enemies=[];B.friends.push(C.friendUnit({id:800000201,pid:'d',kit:kitOf(''),x:p0.x-6,z:p0.z-6,m:1}));
 const f=B.friends[0];B.friendDown(f);for(let i=0;i<20*(C.ALLY.returnS+1);i++)K.advance(B,p0,K.validated({x:0,z:0}),.05,true);
 ok(!f.down&&f.hurt===1&&Math.abs(f.hp-f.maxHp*C.ALLY.downHull)<1+f.maxHp*.03*1.1,'a downed ally returns after '+C.ALLY.returnS+' quiet seconds at half hull (hp '+Math.round(f.hp)+' of '+f.maxHp+'), marked for repair');
 for(let i=0;i<20*30;i++)K.advance(B,p0,K.validated({x:0,z:0}),.05,true);ok(f.hp<=f.maxHp*C.ALLY.downHull+1e-6,'it stays at half hull until it is repaired (quiet regeneration stops at its cap)');}
{const {B,p}=stage('raid-intercept-1',['mender','breacher']),m=B.friends[0],d=B.friends[1];B.enemies.forEach(e=>{e.hp=0;});B.friendDown(d);Object.assign(d,{x:m.x+3,z:m.z});
 for(let i=0;i<20*4;i++)K.advance(B,p,K.validated({x:0,z:0}),.05,false);ok(!d.down&&m.rv===1&&d.hp>=Math.round(d.maxHp*C.ROLES.mender.revive)&&d.hp<=d.maxHp*(C.ROLES.mender.revive+C.ROLES.mender.heal*4),'a Mender revives one downed ally per fight ('+Math.round(C.ROLES.mender.revive*100)+'% hull)');
 B.friendDown(d);for(let i=0;i<20*6;i++)K.advance(B,p,K.validated({x:0,z:0}),.05,false);ok(d.down===1,'and only one');}
// ---- 7. orders (Hangar II): follow, attack, hold here, fall back; LOCKED before Hangar II ----
{const {B,p}=stage('raid-intercept-1',['breacher','lancer']);B.squad.orders=0;ok(!B.squadOrder(3),'before Hangar II there are no orders (the first wingman only follows and fights)');
 B.squad.orders=1;const e=B.enemies.find(x=>x.hp>0&&!x.resident);B.lockId=e.id;ok(B.squadOrder(5)&&B.squad.o==='attack'&&B.squad.t===e.id,'the smart order with a lock: ATTACK my locked target');
 B.lockId=null;ok(B.squadOrder(5)&&B.squad.o==='follow','the smart order with nothing locked: REGROUP (follow)');
 B.squadOrder(3);const hx=B.squad.x,hz=B.squad.z;ok(B.squad.o==='hold'&&hx===p.x&&hz===p.z,'HOLD HERE marks where you are');
 B.squadOrder(4);ok(B.squad.o==='fallback','FALL BACK');}
// ---- 8. deterministic: the phone's own files == the Worker bundle; a save and reload mid-fight continues exactly ----
{const ctx=vm.createContext({console,Math,JSON,Object,Array,Number,Set,Map,WeakMap,Infinity,isFinite,String,Error});ctx.globalThis=ctx;
 for(const f of ['js/range-host.js','js/rules.js','js/game.js','js/conquest/world.js','js/conquest/combat.js','js/conquest/controls.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
 const CP=ctx.ConquestCombat,KP=ctx.ConquestControl,roles=['guardian','lancer','mender','breacher','corroder','frostline'];
 const a=stageOn(C,'raid-battery-1',roles),b=stageOn(CP,'raid-battery-1',roles);const ra=run(a,{maxS:40}),rb=run(b,{maxS:40,KK:KP,CC:CP});
 const sig=B=>JSON.stringify({f:B.friends.map(f=>[f.x,f.z,f.hp,f.kills,f.charge]),e:B.enemies.map(e=>[e.x,e.z,e.hp]),p:B.playerHp,t:B.time,pd:B.pilotDmg,ad:B.allyDmg});
 ok(sig(a.B)===sig(b.B)&&ra.ally>0,'the phone\'s files and the Worker bundle run the same allied fight to the same state, bit for bit (40 s, six roles)');
 const c=stage('raid-battery-1',roles),st={lock:null};let t=0;while(t<12){Object.assign(c.p,K.advance(c.B,c.p,pilotInput(K,C,c.B,c.p,st),.05,false));t+=.05;}
 const saved=clone(c.B),d=new C.Operation(R.STOCK_L,c.p,'raid-battery-1');Object.assign(d,clone(saved));for(const k of ['enemies','friends','fields','projectiles','hazards','nodes','superShells'])d[k]=Array.isArray(d[k])?d[k]:[];K.ensure(d);
 const p2={...c.p},st2={...st};let t2=t;while(t<30){Object.assign(c.p,K.advance(c.B,c.p,pilotInput(K,C,c.B,c.p,st),.05,false));t+=.05;}while(t2<30){Object.assign(p2,K.advance(d,p2,pilotInput(K,C,d,p2,st2),.05,false));t2+=.05;}
 ok(sig(c.B)===sig(d),'a save and reload in the middle of the fight (the Worker\'s record round trip) continues exactly');}
// ---- 9. the damage split per fight size ----
function epicL(){return {...clone(R.STOCK_L),w:{a:'pulse',t:2,q:1.08,s:false},c:{c:'vanguard',t:2,q:1.08,s:false}};}
// A full assault (blueprint §4: Battalion fights arrive in Sessions 7 / 7B): the siege raid plus 12 VETERAN-hardened Parasites
// placed by this test (authored, fixed, never matched to anyone's gear): about 20 hostiles active.
function assaultFixture(B,o){['raider','raider','raider','raider','breacher','breacher','command','command','sentinel','raider','command','breacher'].forEach((k,i)=>{try{B.deploy(k,o.x+(i%4-1.5)*12,o.z-10-Math.floor(i/4)*10,'assault:'+i);B.harden(B.enemies.at(-1));}catch(e){}});}
if(process.env.CQ_ALLY_SPLIT!=='0'){const sizes={
  wing:{allies:2,roles:['none','none'],gear:'stock pilot + militia (Common, no cores)',ops:['convoy','relay','recon','rescue','redoubt']},
  platoon:{allies:4,roles:['guardian','lancer','mender','breacher'],gear:'stock pilot + militia',ops:['raid-intercept-1','raid-intercept-3','raid-sabotage-2','raid-sabotage-4','raid-battery-1','raid-battery-3','raid-extraction-2','raid-extraction-4','raid-siege-3','raid-siege-5']},
  battalion:{allies:9,roles:['guardian','guardian','lancer','lancer','mender','breacher','breacher','corroder','frostline'],gear:'equal Epic gear (pilot and allies Epic, the pilot keeps its three cores)',fixture:'full assault: the siege raids + 12 VETERAN Parasites',ops:['raid-siege-1','raid-siege-2','raid-siege-3','raid-siege-4','raid-intercept-2','raid-intercept-4','raid-sabotage-3','raid-sabotage-5','raid-battery-2','raid-extraction-1']}};
 const out={generatedBy:'dev/tests/conquest-allies.mjs',scope:'scripted pilot (locks the nearest, closes to 60% range, shield under 80%, super when full) with allies on the real shared engine; not a human playtest',ally:{...C.ALLY},sizes:{}};
 for(const [k,S] of Object.entries(sizes)){const rows=[];for(const id of S.ops){const big=k==='battalion',r=run(stage(id,S.roles,big?{extra:assaultFixture,tier:2,L:epicL()}:{mil:true}));   /* Session 6C section 9: the Wing and the Platoon are militia crews (kit.mil) */rows.push({id,...r});}
  const pd=rows.reduce((a,r)=>a+r.pilot,0),ad=rows.reduce((a,r)=>a+r.ally,0),share=+(ad/(ad+pd)).toFixed(3);out.sizes[k]={allies:S.allies,roles:S.roles,gear:S.gear,...(S.fixture?{fixture:S.fixture}:{}),allyShare:share,pilotShare:+(1-share).toFixed(3),wins:rows.filter(r=>r.outcome==='victory').length+'/'+rows.length,rows};
  console.log('SPLIT '+k+': allies '+(share*100).toFixed(1)+'% of the damage, pilot '+((1-share)*100).toFixed(1)+'%, wins '+out.sizes[k].wins);}
 const bat=out.sizes.battalion.allyShare;ok(bat>=.55&&bat<=.65,'a full assault: allies about 60% of the damage ('+(bat*100).toFixed(1)+'%), the pilot about 40% and 100% of objectives');
 ok(out.sizes.wing.allyShare<out.sizes.platoon.allyShare&&out.sizes.platoon.allyShare<bat,'the allies\' share grows with the fight size: Wing '+out.sizes.wing.allyShare+' < Platoon '+out.sizes.platoon.allyShare+' < Battalion '+bat);
 fs.mkdirSync('docs/conquest/session6c',{recursive:true});fs.writeFileSync('docs/conquest/session6c/ally-split.json',JSON.stringify(out,null,1)+'\n');}
// ---- 10. Session 6C section 9 (owner, Nov 18): allies must not let a stock pilot skip VETERAN. The Worker's own start and fielding
// (start-mission: the open world's residents, the roster, AUTO-ARM, field; a Hangar II town and four recruits) with every Session 6C
// change on; the shared engine then runs the raids test's physical-input pilot (dev/tests/lib/raid-pilot.mjs), checked once against
// the reducer driving every step. The rule (planning picks): (a) a stock pilot with a militia Platoon clears at most 3 of the 15
// VETERAN raids; (b) with an Epic-armed Platoon at least 8; (c) a militia Platoon still helps on HARD (at least the pilot alone's
// clears); (d) the first wingman stays useful: its rescue is won, and as your wingman (militia) it lands kills in the field missions.
// Cause (measured, recorded in docs/conquest/session6c/veteran-rule.json): with ALLY's numbers the militia crews dealt half the damage
// AND soaked about 45% of the fire that would kill the pilot; aim and reaction alone left 4-6 of 15, so militia crews also draw less
// fire (MILITIA.pilotBias, the lead's creative-director pick) and freeze up in VETERAN operations (MILITIA_VET). Never an enemy stat.
if(process.env.CQ_ALLY_VET!=='0'){const CQ=(await import('../../worker/src/sim.gen.js')).CONQUEST,{createState,applyAction,applyCommands,hydrate}=await import('../../worker/src/conquest-sim.js'),BA=await import('../../worker/src/conquest-battalion.js'),{raidPilot,raidPilotBattle}=await import('./lib/raid-pilot.mjs');
 const runB=raidPilotBattle({C,W,K}),runW=raidPilot({C,W,K,R,createState,applyAction,applyCommands,hydrate}),T2=R.TIER_MULT[2],NOW=1800000000000;
 const epicGear={w:['pulse','siege','twin','pulse'].map(k=>({k,t:2,s:false,q:1,m:T2})),c:['titan','vanguard','scout','vanguard'].map(k=>({k,t:2,s:false,q:1,m:T2}))};const commonGear={w:['pulse','siege','twin','pulse'].map(k=>({k,t:0,s:false,q:1,m:1})),c:['titan','vanguard','scout','vanguard'].map(k=>({k,t:0,s:false,q:1,m:1}))};
 const roster=({n=0,hangar=2,gear='militia'})=>(s,now)=>{if(!n)return;if(hangar){const q=CQ.Plot.newPlot('ridge',now);q.cc=3;q.b.cc.l=3;q.siteFree=1;q.b.hg1={t:'hangar',i:24,j:40,r:0,l:hangar};s.plot=q;s.base={tier:2,modules:{},builtAt:now-9e8,claimedAt:now-3e7,pointsAt:now-3e7};}
  const T=BA.bat(s);T.w=1;if(gear==='epic'||gear==='common'){T.g=clone(gear==='epic'?epicGear:commonGear);T.own={w:{a:'pulse',t:0,s:false},c:{c:'vanguard',t:0,s:false}};}for(let i=0;i<n;i++)BA.newPilot(s,'recruit',now);BA.arm(s);};
 function start(id,opt={}){let s=createState(clone(R.STOCK_L),NOW);s.completed=Object.fromEntries(C.fieldMissionIds.map(id=>[id,{at:NOW,attempt:0}]));roster(opt)(s,NOW);const o=C.operations[id],e=o.entry||[o.x-25,o.z+8];s.position={x:e[0],z:e[1],y:W.groundAt(e[0],e[1]),surface:'ground'};
  s=applyAction(s,{seq:1,action:'start-mission',mission:id},NOW);return {B:hydrate(s),p:{...s.position}};}
 const fight=(id,opt)=>{const {B,p}=start(id,opt),r=runB(B,p);r.mil=B.friends.filter(f=>f.side==='mine'&&f.mil).length;r.fielded=B.friends.filter(f=>f.side==='mine').length;return r;};
 // fidelity: the engine driven directly gives the reducer's own outcome, step for step (two sample raids)
 for(const id of ['raid-intercept-4','raid-siege-4']){const a=runW(id,clone(R.STOCK_L),{setup:roster({n:4}),now:NOW}),b=fight(id,{n:4});ok(a.outcome===b.outcome&&a.seconds===b.seconds&&a.hullLeft===b.hullLeft&&a.kills===b.kills&&a.akills===b.akills,id+': the engine driven directly = the reducer step by step ('+b.outcome+' in '+b.seconds+' s, hull '+b.hullLeft+'%, '+b.kills+' + '+b.akills+' kills)');}
 const VET=C.raidIds.filter(id=>C.operations[id].danger==='VETERAN'),HARD=C.raidIds.filter(id=>C.operations[id].danger==='HARD'),WING=['convoy','relay','recon','rescue','redoubt'];
 const set=(ids,opt)=>{const rows=ids.map(id=>({id,...fight(id,opt)})),wins=rows.filter(r=>r.outcome==='victory').length,pd=rows.reduce((a,r)=>a+r.pilotDmg,0),ad=rows.reduce((a,r)=>a+r.allyDmg,0);return {wins,of:rows.length,allyShare:+(ad/((ad+pd)||1)).toFixed(3),allyKills:rows.reduce((a,r)=>a+r.akills,0),rows:rows.map(r=>({id:r.id,outcome:r.outcome,s:r.seconds,hull:r.hullLeft,kills:r.kills,allyKills:r.akills,fielded:r.fielded,militia:r.mil}))};};
 const alone=set(VET,{}),mil=set(VET,{n:4}),common=set(VET,{n:4,gear:'common'}),epic=set(VET,{n:4,gear:'epic'}),hardAlone=set(HARD,{}),hardMil=set(HARD,{n:4}),wing=set(WING,{n:1,hangar:0}),rescue=fight('wingman-rescue',{});
 ok(mil.rows.every(r=>r.fielded===4&&r.militia===4)&&epic.rows.every(r=>r.fielded===4&&r.militia===0)&&wing.rows.every(r=>r.fielded===1&&r.militia===1),'the Worker fields a Platoon of 4 at Hangar II (militia kits with no spare gear, Epic kits from spare Epic gear) and the first wingman alone in a militia kit');
 ok(common.rows.every(r=>r.fielded===4&&r.militia===4)&&common.wins<=3,'(a) spare Common gear is still a militia kit (Common, no cores): a Common-armed Platoon clears '+common.wins+' of '+common.of+' VETERAN raids (at most 3)');
 ok(alone.wins===0,'a stock pilot alone clears '+alone.wins+' of '+alone.of+' VETERAN raids');
 ok(mil.wins<=3,'(a) a stock pilot with a militia Platoon clears '+mil.wins+' of '+mil.of+' VETERAN raids (at most 3; allies '+(mil.allyShare*100).toFixed(1)+'% of the damage)');
 ok(epic.wins>=8,'(b) the same stock pilot with an Epic-armed Platoon clears '+epic.wins+' of '+epic.of+' (at least 8; allies '+(epic.allyShare*100).toFixed(1)+'%)');
 ok(hardMil.wins>=hardAlone.wins,'(c) a militia Platoon still helps on HARD raids: '+hardMil.wins+' of '+hardMil.of+' with it, '+hardAlone.wins+' alone');
 const wk=wing.rows.filter(r=>r.allyKills>0).length;ok(rescue.outcome==='victory'&&wing.allyKills>=2&&wing.allyShare>=.15,'(d) the first wingman stays useful: its rescue is won ('+rescue.seconds+' s), then in the field missions it lands '+wing.allyKills+' kills (in '+wk+' of '+WING.length+') and deals '+(wing.allyShare*100).toFixed(1)+'% of the damage (at least 2 kills and 15%; militia kit)');
 fs.mkdirSync('docs/conquest/session6c',{recursive:true});fs.writeFileSync('docs/conquest/session6c/veteran-rule.json',JSON.stringify({generatedBy:'dev/tests/conquest-allies.mjs section 10',scope:'scripted physical-input pilot (the raids test\'s), the Worker\'s own start and fielding; not a human playtest',militia:{...C.MILITIA},militiaVeteran:{...C.MILITIA_VET},ally:{...C.ALLY},
  before:{note:'this harness (the shared pilot after its two fixes) with every militia number at ALLY\'s and no Common-kit rule (reviewer 2, Nov 19)',veteranAlone:'0/15',veteranMilitiaPlatoon:'11/15 (allies 50.6% of the damage)',veteranCommonPlatoon:'11/15 (Common spares made allies non-militia)',veteranEpicPlatoon:'13/15',hardAlone:'10/10',wingman:'5 kills, 20.8% of the damage; rescue won',firstHarness:'the old pilot (before its fixes): militia Platoon 9/15 (allies 52.7%, 119 kills to the pilot\'s 77; the pilot took 1423 HP vs 1700 alone: the crews soaked 1174 HP a fight), HARD alone 8/10'},
  after:{veteranAlone:alone.wins+'/'+alone.of,veteranMilitiaPlatoon:mil.wins+'/'+mil.of+' (allies '+(mil.allyShare*100).toFixed(1)+'%)',veteranCommonPlatoon:common.wins+'/'+common.of,veteranEpicPlatoon:epic.wins+'/'+epic.of+' (allies '+(epic.allyShare*100).toFixed(1)+'%)',hardAlone:hardAlone.wins+'/'+hardAlone.of,hardMilitiaPlatoon:hardMil.wins+'/'+hardMil.of+' (allies '+(hardMil.allyShare*100).toFixed(1)+'%)',wingman:'field missions '+wing.wins+'/'+wing.of+', '+wing.allyKills+' kills in '+wk+', '+(wing.allyShare*100).toFixed(1)+'% of the damage; rescue '+rescue.outcome},
  sets:{alone,militia:mil,epic,hardAlone,hardMilitia:hardMil,wing,rescue:{outcome:rescue.outcome,s:rescue.seconds,kills:rescue.kills}}},null,1)+'\n');}
console.log('PASS conquest-allies ('+passed+' checks)');
