// Session 7C STEP 1 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md): the faster collision lookups in js/conquest/world.js give
// identical results. Two proofs, both with ConquestWorld.LOOKUPS.fast on (the shipped lookups) and off (the original ones, kept beside them):
//  1. every lookup on boundary and random points: raidSolidAt, structureSolidAt, solidAt, rockSolid, blockedAt, colonyLotAt (the same lot
//     object), installationOccludes, move, advance; every footprint's edges (+-1e-9, +-0.5), every rock's ellipse edge, NaN, far away;
//  2. every operation in ConquestCombat.operations (59: field missions, raids, Meteor Strikes, defenses, counterattacks, the town
//     defense, the three Citadel tiers) and the open world, each replayed through the real Worker reducer (conquest-sim.js applyCommands,
//     20 commands a request, a deterministic bot pilot with a fielded Battalion): the whole record must be identical after every request.
// It also reports the replay cost both ways (local Node, not Cloudflare's meter). Run: node dev/tests/conquest-collision-identity.mjs
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST,RULES:R}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Control:K,Citadel:CI}=CONQUEST;
const {createState,applyCommands}=await import('../../worker/src/conquest-sim.js');const {citadelBegin}=await import('../../worker/src/conquest-citadel.js');
const {GEAR}=await import('./combat-sim.mjs');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
const SECS=Number(process.env.CQ_IDENTITY_SECS||30),LOOK=W.LOOKUPS,both=f=>{LOOK.fast=true;const a=f();LOOK.fast=false;const b=f();LOOK.fast=true;return [a,b];};
ok(LOOK&&LOOK.fast===true,'the shipped lookups are the fast ones (ConquestWorld.LOOKUPS.fast)');
// ---- 1. every lookup, point by point ----
{let seed=715,n=0,diff=[];const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const same=(name,f)=>{const [a,b]=both(f);n++;if(!Object.is(a,b)&&JSON.stringify(a)!==JSON.stringify(b))diff.push(name+' '+JSON.stringify(a)+' vs '+JSON.stringify(b));};
 const pt=(x,z)=>{const g=W.groundAt(x,z);same('raidSolidAt '+x+','+z,()=>W.raidSolidAt(x,z));same('structure '+x+','+z,()=>W.structureSolidAt(x,z));same('solid '+x+','+z,()=>W.solidAt(x,z));
  same('lot '+x+','+z,()=>W.colonyLotAt(x,z));for(const y of [g-1,g,g+.08,g+2.2,g+5,g+8,g+12,g+24,g+60,g+150,NaN,undefined])same('blocked '+x+','+y+','+z,()=>W.blockedAt(x,y,z));
  for(const y of [null,g+1,g+3,g+9,NaN])same('rock '+x+','+y+','+z,()=>W.rockSolid(x,z,y));for(const y of [null,g+2,g+6,g+9])same('raidY '+x+','+y+','+z,()=>W.raidSolidAt(x,z,y));};
 const edges=(x0,x1,z0,z1,f)=>{for(const x of [x0,x1])for(const d of [-.5,-1e-9,0,1e-9,.5])for(const z of [z0,(z0+z1)/2,z1])f(x+d,z);for(const z of [z0,z1])for(const d of [-.5,-1e-9,0,1e-9,.5])for(const x of [x0,(x0+x1)/2,x1])f(x,z+d);};
 for(let i=0;i<12000;i++)pt(800+rnd()*650,800+rnd()*520);for(let i=0;i<1500;i++)pt(rnd()*W.WIDTH,rnd()*W.LENGTH);for(let i=0;i<1500;i++)pt(1380+rnd()*360,940+rnd()*280);   // the war region, the whole Moon, the Citadel
 for(const [x,z] of [[-4,-4],[0,0],[-0,-0],[W.WIDTH+4,W.LENGTH+4],[1e9,1e9],[-1e9,5],[NaN,1100],[1100,NaN]])pt(x,z);   // (never an infinite coordinate: the original rockSolid never returns for one; positions are clamped and commands validated)
 for(const o of W.raidObstacles)edges(o.x-o.width/2,o.x+o.width/2,o.z-o.depth/2,o.z+o.depth/2,pt);
 for(const b of W.installations){edges(b.x-11,b.x+11,b.z,b.z+16,pt);edges(b.x-9,b.x+9,b.z+2,b.z+14,pt);edges(b.x+12,b.x+16,b.z+8,b.z+12,pt);}
 for(const l of W.COLONY.lots){const r=Math.hypot(l.w,l.d)/2;edges(l.x-r,l.x+r,l.z-r,l.z+r,pt);}for(const [px,pz] of W.COLONY.railPylons)edges(px-1.5,px+1.5,pz-1.5,pz+1.5,pt);
 for(let cx=6;cx<14;cx++)for(let cz=6;cz<11;cz++)for(const p of W.scenery(cx,cz).filter(p=>p.kind==='rock'&&p.variant>.45))for(const v of [.999999,1,1.000001]){const rx=p.size*1.6+1,rz=p.size+1;pt(p.x+rx*v,p.z);pt(p.x-rx*v,p.z);pt(p.x,p.z+rz*v);pt(p.x,p.z-rz*v);pt(p.x+rx*v*.7071,p.z+rz*v*.7071);}
 for(let i=0;i<3;i++)edges(1150+i*30-12,1150+i*30+12,1068,1092,pt);for(let i=0;i<9;i++){const a=1110+i%3*22,b=1148+Math.floor(i/3)*25;edges(a-8,a+8,b-8,b+8,pt);}
 // line-of-sight occlusion: random segments in the war region and segments that graze every cover box
 const seg=(a,b)=>same('occludes '+JSON.stringify([a,b]),()=>W.installationOccludes(a,b));const P3=(x,z,h)=>({x,y:W.groundAt(x,z)+h,z});
 for(let i=0;i<20000;i++){const x=900+rnd()*450,z=820+rnd()*420,a=rnd()*6.283,L=5+rnd()*90;seg(P3(x,z,2.2),P3(x+Math.cos(a)*L,z+Math.sin(a)*L,rnd()*12));}
 for(const o of [...W.raidObstacles,...W.installations.map(b=>({x:b.x,z:b.z+8,width:18,depth:12}))])for(let k=0;k<60;k++){const a=k*.1047,R0=Math.max(o.width,o.depth);for(const off of [-.5,0,.5,o.width/2,o.depth/2+1e-9])seg(P3(o.x-Math.cos(a)*R0*2+off,o.z-Math.sin(a)*R0*2,2.2),P3(o.x+Math.cos(a)*R0*2,o.z+Math.sin(a)*R0*2-off,2.2+k%7));}
 for(const a of [{x:1100,y:NaN,z:1000},{x:NaN,y:5,z:1}])seg(a,{x:1200,y:5,z:1000});seg({x:1274,y:20,z:850},{x:1274,y:20,z:850});
 // movement: move() and advance() from many places and headings (solidAt, slopes, decks, water)
 for(let i=0;i<4000;i++){const x=850+rnd()*560,z=820+rnd()*480,a=rnd()*6.283,p={x,z,y:W.groundAt(x,z),surface:'ground'};same('move '+x+','+z,()=>W.move(p,Math.cos(a)*3,Math.sin(a)*3));same('advance '+x+','+z,()=>W.advance(p,Math.cos(a)*4,Math.sin(a)*4));}
 ok(!diff.length,'1. every lookup identical on '+n+' point, segment and move checks (fast vs original), including every footprint edge, every rock ellipse edge, NaN and far away'+(diff.length?' FIRST DIFFERENCES: '+diff.slice(0,5).join(' | '):''));}
// ---- 2. every operation replayed through the Worker reducer, both ways ----
const DAY=86400000,ROLES=['guardian','lancer','breacher','frostline','mender','corroder'];
function seeded(){let r=0x9e3779b9;const next=()=>{r^=r<<13;r>>>=0;r^=r>>>17;r^=r<<5;r>>>=0;return r;};globalThis.crypto.getRandomValues=a=>{for(let i=0;i<a.length;i++)a[i]=next()%(2**(8*a.BYTES_PER_ELEMENT||4));return a;};Math.random=()=>next()/4294967296;}
const realRand=Math.random,realCrypto=globalThis.crypto.getRandomValues.bind(globalThis.crypto);
const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),copy=o=>JSON.parse(JSON.stringify(o));
// the record a running operation leaves (start-mission's own steps after its checks: worker/src/conquest-sim.js), with a Battalion beside you
function opRecord(id,t0){const op=C.operations[id],L=structuredClone(GEAR.rare),s=createState(L,t0);s.lseed=4242;s.war.sc={n:9,done:1};
 const cit=CI.isCitadel(id),pos=cit?CI.stageAt():at(op.x-18,op.z+10);s.position=pos;s.battle.enemies=[];s.explorationBattle=copy(s.battle);s.attempt=1;s.mission=id;s.featuredMission=false;s.settlement=null;
 if(op.strike){const M=C.meteorStrike(t0);s.strikes={[M.slot]:{roll:{tq:.5,se:.5,mh:.5}}};s.strikeSlot=M.slot;}
 if(op.raid)s.raidRoll={attempt:1,v:.5};
 if(id==='base-defense'){s.base={tier:5,modules:{hangar:3},builtAt:t0-30*DAY,claimedAt:t0-DAY,pointsAt:t0-DAY,defense:{config:'turret',damage:0,wins:0,alertAt:t0,nextAt:t0,active:true}};}
 if(op.defense&&op.war)s.sectorDefense={active:true,id,at:t0,go:false};
 const B=id==='oxygen-line'?new C.Battle(s.loadout,pos):cit?CI.make(s.loadout,pos,id):new C.Operation(s.loadout,pos,id);
 if(cit){s.cit=CI.norm({v:1,t:Number(id.split('-')[1])-1});citadelBegin(s,B,op,t0);}
 B.squad={orders:1,f:'wedge',o:'follow',t:0};for(let i=0;i<6;i++){const sl=C.FORMS.wedge[i%C.FORMS.wedge.length];B.friends.push(C.friendUnit({id:800000001+i,side:'mine',pid:'p'+i,role:ROLES[i],kit:{w:{a:'pulse',t:1,q:1},c:{c:C.ROLES[ROLES[i]].cls[0],t:1,q:1}},m:1,x:pos.x+sl[0]*.5,z:pos.z+sl[1]*.5-4}));}
 B.playerHp=Math.min(B.playerMax,s.hp);s.battle=copy(B);return s;}
function exploreRecord(t0){const s=createState(GEAR.rare,t0);s.lseed=777;s.position=at(1162,1130);return s;}
// a deterministic bot: the nearest live hostile it can see (else the nearest, else the objective), closes to 30 m, fires locked
function bot(s){const B=s.battle,p=s.position,live=(B.enemies||[]).filter(e=>e&&e.hp>0&&!e.dormant);let t=null,td=Infinity;for(const e of live){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<td){td=d;t=e;}}
 const goal=t||B.objective||{x:p.x+10,z:p.z},dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz)||1,go=!t||d>30;
 return {x:go?dx/d:0,z:go?dz/d:0,fire:!!t,lockId:t?t.id:null,aimYaw:Math.atan2(dx,dz),shield:B.playerHp<B.playerMax*.8,super:(B.charge||0)>=1000};}
function replay(mk,t0){seeded();let s=mk(t0),now=t0+1000;s.lastWall=t0;s.creditMs=0;const hashes=[];let err=null;
 for(let k=0;k<SECS;k++){const cmds=[];for(let i=0;i<20;i++)cmds.push(bot(s));now+=1000;try{s=applyCommands(s,{seq:s.seq+1,commands:cmds},now);}catch(e){err=String(e.message||e);break;}hashes.push(createHash('sha1').update(JSON.stringify(s)).digest('hex'));if(s.battle?.state&&s.battle.state!=='active'&&s.mission)break;}
 return {hashes,err,state:s.battle?.state,steps:hashes.length};}
const t0=Date.UTC(2026,10,25,9),ids=Object.keys(C.operations),rows=[];let fastMs=0,slowMs=0;
for(const id of [...ids,'(open world)']){const mk=id==='(open world)'?exploreRecord:t=>opRecord(id,t);let ta=performance.now();LOOK.fast=true;const a=replay(mk,t0);const fa=performance.now()-ta;ta=performance.now();LOOK.fast=false;const b=replay(mk,t0);const fb=performance.now()-ta;LOOK.fast=true;
 fastMs+=fa;slowMs+=fb;const same=a.hashes.length===b.hashes.length&&a.hashes.every((h,i)=>h===b.hashes[i])&&a.err===b.err;rows.push({id,requests:a.steps,end:a.state,err:a.err,fastMs:Math.round(fa),originalMs:Math.round(fb),same});
 if(!same)console.log('DIFF',id,{a:a.hashes.length,b:b.hashes.length,firstAt:a.hashes.findIndex((h,i)=>h!==b.hashes[i]),errA:a.err,errB:b.err});}
Math.random=realRand;globalThis.crypto.getRandomValues=realCrypto;
const bad=rows.filter(r=>!r.same),requests=rows.reduce((x,r)=>x+r.requests,0),errs=rows.filter(r=>r.err);
console.log(JSON.stringify({rows:rows.map(r=>[r.id,r.requests,r.end,r.fastMs,r.originalMs,r.err||''].join(' '))},null,0));
ok(rows.length===ids.length+1&&ids.length>=59,'every operation ('+ids.length+') and the open world replayed both ways');
ok(!errs.length,'every replay ran through the Worker reducer without an error'+(errs.length?': '+errs.map(r=>r.id+' '+r.err).join('; '):''));
ok(!bad.length,'2. every replayed operation\'s record is identical after every request ('+requests+' requests of 20 commands, '+SECS+' game seconds each)'+(bad.length?' DIFFERENT: '+bad.map(r=>r.id).join(', '):''));
const cut=1-fastMs/slowMs;console.log('REPORT replay cost (local Node '+process.version+', not Cloudflare): original lookups '+Math.round(slowMs)+' ms, fast lookups '+Math.round(fastMs)+' ms for the same '+requests+' requests: '+Math.round(cut*1000)/10+'% less');
console.log(JSON.stringify({test:'conquest-collision-identity',pass,secs:SECS,requests,fastMs:Math.round(fastMs),originalMs:Math.round(slowMs),cutPct:Math.round(cut*1000)/10}));
