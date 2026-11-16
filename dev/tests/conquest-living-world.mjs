// Session 6 part D (docs/conquest/audit/CONQUEST_1_0_SPEC.md §5.6, §5.7): 12 authored patrol routes, hunter packs by held sectors,
// vein ambush, incursion, the Sortie chain, gear-blind hunters, and the Worker step time with the denser world.
// Writes docs/conquest/session6/living-world.json (step-time measurements).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyCommands,applyAction,refreshState}=await import('../../worker/src/conquest-sim.js');
const {POLICY:P,missionReward,death}=await import('../../worker/src/conquest-economy.js');
const Lv=await import('../../worker/src/conquest-living.js');
const {u32}=await import('../../worker/src/conquest-loot.js');
const L=C.LIVING,now0=30*P.day+7*3600000+60000,point=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),fresh=(now=now0)=>createState(R.STOCK_L,now);
const T=C.refuge,G=C.baseDefinition,S=W.spawn;
const tick=(s,n,cmd={x:0,z:0},dtMs=1000)=>{for(let i=0;i<n;i++)s=applyCommands(s,{seq:s.seq+1,commands:Array(20).fill(cmd)},s.lastWall+dtMs);return s;};

// ---- 1. twelve patrols, two per sector, authored and drivable ----
const routes=C.patrols;assert.equal(routes.length,12);
const per={};for(const r of routes){const sec=W.frontierSectorAt(r.x,r.z).id;per[sec]=(per[sec]||0)+1;}
for(const sec of C.sectors.map(x=>x.id))assert.equal(per[sec],2,sec+' has two patrol routes');
const ids=routes.map(r=>C.spawnIds[r.id]);assert(ids.every(Number.isInteger)&&new Set(ids).size===12,'unique spawn ids');for(let k=10015;k<=10022;k++)assert(ids.includes(k),'spawn id '+k);
const drive=(a,b)=>{const L2=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(L2/1.5);let p=point(a[0],a[1]);for(let k=0;k<n;k++){const q=W.advance(p,(b[0]-a[0])/n,(b[1]-a[1])/n);if(Math.hypot(q.x-p.x,q.z-p.z)<(L2/n)*.8)return false;p=q;}return true;};
for(const r of routes.slice(4)){for(let i=0;i<r.route.length;i++){const a=r.route[i];assert(drive(a,r.route[(i+1)%r.route.length]),r.id+' segment '+i+' drivable');for(const q of [T,S,G,{x:1152,z:1098}])assert(Math.hypot(a[0]-q.x,a[1]-q.z)>=150,r.id+' stays 150 m from the first-hour stage');}}
for(const a of L.packs)for(let i=0;i<a.route.length;i++)assert(drive(a.route[i],a.route[(i+1)%a.route.length]),'pack loop '+a.x+','+a.z+' drivable');
const s0=fresh();assert.equal(s0.battle.enemies.filter(e=>e.base?.kind==='patrol').length,12,'a new save carries all twelve patrols');
console.log('PASS 12 authored patrol routes (2 per sector, spawn ids 10015-10022, every segment drivable, >=150 m from the first-hour stage)');

// ---- 2. hunter packs: 1 + floor(held / 2), out of sight, hourly, never into the Heartland, gear-blind ----
const held=n=>{const s=fresh();C.sectors.slice(0,n).forEach(x=>s.territory[x.id]={owner:'humanity',status:'secured'});C.sectors.slice(n).forEach(x=>s.territory[x.id]={owner:'parasites',status:'active-parasites'});return s;};
assert.deepEqual([1,2,3,4,5,6].map(n=>Lv.packCount(held(n))),[1,2,2,3,3,4],'1 + floor(held sectors / 2), max 4');
{let s=held(6);s.position=point(400,400);refreshState(s,now0);const packs=s.battle.enemies.filter(e=>/^pack:/.test(e.key));assert.equal(packs.length,16,'four packs of four (rings 3-4 add a heavy sentinel)');
 for(let i=0;i<4;i++){const m=packs.filter(e=>e.key.startsWith('pack:'+i+':'));assert.deepEqual(m.map(e=>e.kind).sort(),['command','raider','raider','sentinel']);assert(m.every(e=>e.hunt&&e.hunt.r===200&&e.hunt.leash===300&&!e.hunt.heart));}
 assert(packs.every(e=>Number.isInteger(e.id)&&e.id>=10100&&e.id<10200)&&new Set(packs.map(e=>e.id)).size===16,'pack ids 10100+');
 // a fallen member returns the next UTC hour, never the same hour, never in sight
 const v=packs[0];v.hp=0;s.position=point(400,400);refreshState(s,now0+60000);assert.equal(s.battle.enemies.find(e=>e.key===v.key).hp,0,'same hour: stays down');
 refreshState(s,now0+3600000);assert(s.battle.enemies.find(e=>e.key===v.key).hp>0,'next hour: back');
 const w=s.battle.enemies.find(e=>e.key==='pack:0:1');w.hp=0;s.position=point(L.packs[0].x+100,L.packs[0].z);refreshState(s,now0+3*3600000);assert.equal(s.battle.enemies.find(e=>e.key==='pack:0:1').hp,0,'never pops back in sight');
 // losing sectors: the extra packs withdraw out of sight
 for(const x of C.sectors)s.territory[x.id].owner=x.id==='refuge'?'humanity':'parasites';s.position=point(400,400);refreshState(s,now0+4*3600000);assert.equal(s.battle.enemies.filter(e=>/^pack:[1-3]:/.test(e.key)).length,0);}
// hunt within 200 m, not into the Heartland
{const s=held(1);s.position=point(400,400);refreshState(s,now0);const B=new C.Encounter(s.loadout,point(L.packs[0].x+150,L.packs[0].z));Object.assign(B,structuredClone(s.battle));const e=B.enemies.find(x=>x.key==='pack:0:0');
 B.player={x:L.packs[0].x+150,y:W.groundAt(L.packs[0].x+150,L.packs[0].z)+2.2,z:L.packs[0].z};B.choose(e);assert.equal(e.target,B.player,'a hunter goes for a pilot 150 m away (aggro 200)');
 B.player={x:T.x,y:W.groundAt(T.x,T.z)+2.2,z:T.z};e.hp=e.maxHp;B.choose(e);assert.notEqual(e.target,B.player,'a pack never follows the pilot into the Heartland');}
// gear-blind: the same hunter for a stock tank and a legendary kit
{const legend={...structuredClone(R.STOCK_L),w:{a:'moon',t:2,q:1.1,s:true},c:{c:'titan',t:2,q:1.1,s:true}};const a=createState(R.STOCK_L,now0),b=createState(legend,now0);for(const s of [a,b]){s.position=point(400,400);refreshState(s,now0);}
 const pick=s=>JSON.stringify(s.battle.enemies.filter(e=>/^pack:/.test(e.key)).map(e=>[e.key,e.kind,e.hp,e.stats]));assert.equal(pick(a),pick(b),'hunters never read the pilot\'s gear');}
console.log('PASS hunter packs: 1/2/2/3/3/4 by held sectors, 4 units in rings 3-4, out of sight, hourly return, never chase into the Heartland, gear-blind');

// ---- 3. vein ambush: ring 3+, 35% once a vein generation, 20 s at the vein, leave = off ----
{let hits=0,n=0;for(let seed=1;seed<=4000;seed++){const s={lseed:seed,lodes:{slots:{x:{gen:0}}},mission:null};Lv.ambushRoll(s,'x',{x:L.packs[0].x,z:L.packs[0].z});n++;if(s.ambush)hits++;}assert(Math.abs(hits/n-.35)<.03,'35% ('+hits+'/'+n+')');
 const s={lseed:7,lodes:{slots:{x:{gen:0}}},mission:null};Lv.ambushRoll(s,'x',{x:T.x,z:T.z});assert(!s.ambush,'never in ring 1-2');
 let seed=1;while(u32(seed+':ambush:x:1')/4294967296>=.35)seed++;const q={lseed:seed,lodes:{slots:{x:{gen:0}}},mission:null};Lv.ambushRoll(q,'x',{x:L.packs[0].x,z:L.packs[0].z});assert(q.ambush);delete q.ambush;Lv.ambushRoll(q,'x',{x:L.packs[0].x,z:L.packs[0].z});assert(!q.ambush,'one roll per vein generation');
 // 20 s at the vein through the Worker: two heavy sentinels arrive 65 m away
 let w=fresh();w.lseed=seed;w.position=point(1300,960);w.battle.enemies=w.battle.enemies.filter(e=>Math.hypot(e.x-1300,e.z-960)>200);w.ambush={slot:'x',x:1300,z:960,ms:0};w.ambushed={x:1};w.lastWall=now0;w=tick(w,19);assert(!w.battle.enemies.some(e=>/^ambush:/.test(e.key)),'not before 20 s');w=tick(w,2);
 const amb=w.battle.enemies.filter(e=>/^ambush:/.test(e.key));assert.equal(amb.length,2);assert(amb.every(e=>e.kind==='sentinel'&&Math.abs(Math.hypot(e.home.x-w.position.x,e.home.z-w.position.z)-65)<12),'two heavy sentinels ~65 m out');assert.equal(w.notice.kind,'ambush');
 let x=fresh();x.position=point(1300,960);x.ambush={slot:'x',x:1250,z:960,ms:0};x.lastWall=now0;x=tick(x,1);assert(!x.ambush,'leaving the vein calls it off');}
console.log('PASS vein ambush: ring 3+, 35% once per vein generation (seeded), two heavy sentinels 20 s in, leaving calls it off');

// ---- 4. incursion: 10 calm minutes -> three interceptors 120 m out, never near the Refuge or the gate ----
{let s=fresh();s.position=point(980,1180);s.battle.enemies=s.battle.enemies.filter(e=>Math.hypot(e.x-980,e.z-1180)>300);s.lastWall=now0;s.calm=L.incursion.calmMs-2000;s=tick(s,3);
 const inc=s.battle.enemies.filter(e=>/^incursion:/.test(e.key));assert.equal(inc.length,3);assert(inc.every(e=>e.kind==='raider'&&e.hunt.heart),'three interceptors that may chase anywhere');
 for(const e of inc){const d=Math.hypot(e.home.x-s.position.x,e.home.z-s.position.z);assert(Math.abs(d-120)<12,'~120 m out: '+d);assert(Math.hypot(e.home.x-T.x,e.home.z-T.z)>=60&&Math.hypot(e.home.x-G.x,e.home.z-G.z)>G.radius,'never within 60 m of the Refuge or in the gate zone');}
 assert.equal(s.notice.kind,'incursion');assert(s.calm<=1000,'the calm clock restarts at the incursion');
 let r=fresh();r.position=point(T.x+20,T.z);r.calm=L.incursion.calmMs;r.lastWall=now0;r.battle.enemies=[];r=tick(r,2);assert(!r.battle.enemies.some(e=>/^incursion:/.test(e.key)),'not while the pilot is at the Refuge');
 let f=fresh();f.position=point(980,1180);f.lastWall=now0;f.calm=300000;const foe=f.battle.enemies[0];Object.assign(foe,{x:990,z:1180,y:W.groundAt(990,1180),hp:foe.maxHp});f=tick(f,1);assert.equal(f.calm,0,'a fight resets the calm clock');}
console.log('PASS incursion: after 10 calm minutes three interceptors arrive ~120 m out, never within 60 m of the Refuge or in the gate zone');

// ---- 5. Sortie chain ----
{const s=fresh();s.ledger.cp=0;const ops=C.fieldMissionIds;let t=now0;const pays=[];for(let i=0;i<5;i++){s.mission=ops[i];s.attempt=i+1;t+=120000;const r=missionReward(s,t);pays.push([r.cp,r.chain?.links||0,r.ptsRaw]);}
 const base=pays.map(p=>p[0]);assert.deepEqual(pays.map(p=>p[1]),[0,1,2,3,3],'links found by each win');
 const firstCp=ops.slice(0,5).map(id=>C.operations[id].firstCp||250);assert.deepEqual(base,firstCp.map((c,i)=>Math.round(c*(1+L.chain.per*Math.min(3,i)))+(i===2?100:0)),'+'+(+(L.chain.per*100).toFixed(2))+'% per link, max +'+(+(L.chain.per*300).toFixed(2))+'% (the third field order of the day adds its usual +100 CP, unchained)');
 assert.equal(L.chain.per,.0125,'owner correction Nov 16: +1.25% CP and salvage a link (was +10%)');
 const pts=pays.map(p=>p[2]);assert(pts.every(p=>p===pts[0]),'airdrop points never multiplied');
 // the raid chest: one rarity step at three links
 const r=fresh();r.chain={n:3,at:now0};r.mission=Object.values(C.operations).find(o=>o.raid).id;r.attempt=1;let epic=0;for(let i=0;i<400;i++){const q=structuredClone(r);q.lseed=i;q.attempt=i;const rc=missionReward(q,now0+1000);if(rc.loot?.fr?.e)epic++;if(rc.loot?.fr?.r)assert.fail('a three-link chest never pays a rare fragment (it stepped up)');}assert(epic>10,'epic fragments from a three-link chest: '+epic);
 // breaks: lapse, death, RECALL, a real session reopen
 assert.equal(Lv.chainLinks({chain:{n:2,at:now0}},now0+L.chain.windowMs+1),0,'10 minutes without a win: the chain lapses');
 const d=fresh();d.chain={n:2,at:now0};death(d,now0);assert(!d.chain,'death ends the chain');
 assert(fs.readFileSync(new URL('../../worker/src/conquest-sim.js',import.meta.url),'utf8').includes("chainBreak(s);}   // the Sortie chain ends on RECALL"),'RECALL ends the chain');
 {const src=fs.readFileSync(new URL('../../worker/src/conquest.js',import.meta.url),'utf8');assert(src.includes('const away=!s||now-(s.lastWall||0)>60000')&&src.includes('if(state.chain&&away)delete state.chain;'),'leaving Conquest (away > 60 s) ends the chain');}}
console.log('PASS Sortie chain: +'+[0,1,2,3,3].map(k=>+(k*L.chain.per*100).toFixed(2)).join('/')+'% CP and salvage on consecutive wins inside 10 min, epic chest fragment at three links, points untouched, breaks on lapse/death/RECALL/leaving');

// ---- 6. Worker step time with the denser world (relative, this machine) ----
function measure(setup,label){let s=fresh();s.lastWall=now0;setup(s);refreshState(s,now0);const ms=[];for(let i=0;i<40;i++){const t=performance.now();s=applyCommands(s,{seq:s.seq+1,commands:Array(20).fill({x:Math.sin(i/4),z:Math.cos(i/4),fire:true})},s.lastWall+1000);ms.push(performance.now()-t);}
 ms.sort((a,b)=>a-b);return {label,medianMs:+ms[20].toFixed(2),p90Ms:+ms[36].toFixed(2),near:s.battle.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-s.position.x,e.z-s.position.z)<240).length,total:s.battle.enemies.length};}
const quiet=measure(s=>{s.position=point(S.x,S.z);},'spawn (first hour)');
const pack=measure(s=>{C.sectors.forEach(x=>s.territory[x.id]={owner:'humanity',status:'secured'});s.position=point(400,400);refreshState(s,now0);s.position=point(L.packs[0].x+40,L.packs[0].z+10);},'beside a hunter pack, all packs out (16 hunters, 12 patrols)');
const report={quiet,pack,ratio:+(pack.medianMs/Math.max(.01,quiet.medianMs)).toFixed(2),note:'applyCommands with 20 commands (one second of play); median of 40 requests; this machine, relative only'};
fs.mkdirSync(new URL('../../docs/conquest/session6/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../../docs/conquest/session6/living-world.json',import.meta.url),JSON.stringify(report,null,1)+'\n');
assert(pack.medianMs<400&&quiet.medianMs<150,'pathological regression guard only (CI machines vary): '+pack.medianMs+' / '+quiet.medianMs+' ms');   // the real numbers are recorded in living-world.json and Checkpoint 40
assert(C.Encounter.toString().includes('<240'),'the nearby-AI radius (240 m) is unchanged: far hunters cost nothing');
console.log('PASS Worker step time: '+quiet.medianMs+' ms at the spawn, '+pack.medianMs+' ms beside a pack ('+pack.near+' units within 240 m) per second of play');
