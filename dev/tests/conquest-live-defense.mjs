// Session 7T (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md) decision 6 (and 1's last chance) through the real Worker reducers:
// defending your town in person runs the raid engine on the Worker in real time, one input request at a time at the world's 50 ms
// step; the pilot's tank fights beside the turrets, the garrison and the fielded Platoon; one attempt per attack; the result is the
// better of the pilot's fight and the unfought replay (showing up never hurts); a held fight the pilot really fought pays the 675
// defense points (no AFK points); the phone's prediction from a reply plus the same commands gives the Worker's next state exactly;
// leaving or going quiet finishes the fight without the pilot; the 60-second RAID INCOMING · DEFEND? last chance.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Plot:P,War:WR,Raid:RD,Town:TN}=CONQUEST;
const {createState,refreshState,applyAction,applyCommands}=await import('../../worker/src/conquest-sim.js');
const {publicState}=await import('../../worker/src/conquest.js');
const {plotOfSnap}=await import('../../worker/src/conquest-town.js');
const {townPilot,townAttack,midTown}=await import('./lib/town-helpers.mjs');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};const H=3600000,T=WR.WAR.tickMs,t0=Date.UTC(2026,10,23,1);
const rank=o=>({fallen:0,breached:1,held:2})[o];
// a town pilot with a mid town and a garrison of two reserves, an attack announced on it
function setup(site='ridge',g='rheel'){const s=townPilot(CONQUEST,R,createState,t0,{cc:6});const p=midTown(P,site);p.at=s.plot.at;p.st={...s.plot.st};p.cm=s.plot.cm;p.b.h1={t:'hangar',...P.autoPlace(p,'hangar'),l:2};s.plot=p;
 s.bat={p:[1,2,3,4,5,6].map(i=>({id:'p'+i,n:'N'+i,cs:'CS'+i,r:'',xp:0,rk:3,k:0,h:1,kit:{w:{a:'pulse',t:1,q:1,s:false},c:{c:'titan',t:1,q:1,s:false}},at:t0,src:'recruit'})),ps:[{f:'wedge',ids:[]},{f:'wedge',ids:[]},{f:'wedge',ids:[]}],pa:0};
 const e=townAttack(CONQUEST,s,t0,{g});return {s,e};}
// the pilot's bot: from the same state the Worker keeps (the phone's own prediction), steer toward the nearest raider and fire at it
function botCommands(s,n,fire=true){const d=s.td,M=RD.make(plotOfSnap(s.tdp),d.seed,{threat:d.lv,lane:d.ln,units:d.units,dt:.05,pilot:d.pilot,state:d.st,damage:true,frames:false,events:false}),out=[];
 for(let i=0;i<n&&!M.over;i++){const me=M.pilot,f=M.foes.filter(q=>!q.dead).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0];let c={x:0,z:0,fire:false};
  if(f&&!me.down){const dx=f.x-me.x,dz=f.z-me.z,dd=Math.hypot(dx,dz)||1,near=dd<22;c={x:near?0:dx/dd,z:near?0:dz/dd,aimYaw:Math.atan2(dx,dz),fire,lockId:f.id};}
  out.push(c);M.step(c);}return out;}
function fight(s,now,{fire=true,per=20,max=2000}={}){let steps=0;while(s.td?.active&&steps<max){const cmds=botCommands(s,per,fire);if(!cmds.length)break;now+=cmds.length*50;s=applyCommands(s,{seq:s.seq+1,commands:cmds},now);steps++;}return {s,now};}
// ---- 1. the fight starts: one attempt, the town frozen as it stood, the unfought replay kept on the Worker ----
{let {s,e}=setup();let now=t0+2*H;s.lastWall=now-1000;s=applyAction(s,{seq:s.seq+1,action:'town-defend',town:{id:e.id}},now);
 const ev=s.tw.ev.find(x=>x.id===e.id);ok(s.td?.active&&ev.tr&&s.tdp&&s.tdu,'DEFEND starts the fight: the attempt spent, the town frozen as it stood, the unfought replay computed');
 ok(!('tdu' in publicState(s))&&publicState(s).td.seed===s.td.seed,'the unfought result stays on the Worker until the fight ends (the phone gets the fight, its seed and units)');
 ok(s.td.units.some(u=>u.k==='p')&&s.td.units.filter(u=>u.k==='g').length===2&&s.td.units.some(u=>u.k==='f'),'the pilot fights beside the garrison (2 reserves) and the fielded Platoon');
 assert.throws(()=>applyAction(s,{seq:s.seq+1,action:'town-defend',town:{id:e.id}},now+1000),/already|running/);ok(true,'one attempt per attack');
 assert.throws(()=>applyAction(s,{seq:s.seq+1,action:'plot-repair',plot:{}},now+1000),/finish the defense/);ok(true,'the town cannot be changed mid-fight');
 // ---- 2. inputs drive the raid at the world's 50 ms step; the world waits ----
 const battle=JSON.stringify(s.battle.enemies.map(x=>[x.id,x.x,x.z])),n0=s.td.n;now+=1000;s=applyCommands(s,{seq:s.seq+1,commands:botCommands(s,20)},now);
 ok(s.td.n===n0+20&&JSON.stringify(s.battle.enemies.map(x=>[x.id,x.x,x.z]))===battle,'20 commands = 20 raid steps of 50 ms; the open world waits');
 // ---- 3. the phone's prediction equals the Worker: the same state + the same commands = the same next state ----
 const cmds=botCommands(s,20),d=s.td,M=RD.make(plotOfSnap(s.tdp),d.seed,{threat:d.lv,lane:d.ln,units:d.units,dt:.05,pilot:d.pilot,state:JSON.parse(JSON.stringify(d.st)),damage:true,frames:false,events:false});for(const c of cmds)M.step(c);
 now+=1000;s=applyCommands(s,{seq:s.seq+1,commands:cmds},now);ok(JSON.stringify(M.save())===JSON.stringify(s.td.st),'the phone\'s prediction from a reply plus its commands is the Worker\'s next state, exactly');
 // ---- 4. the Worker's step time: 20 steps of a CC6 town raid per request ----
 const times=[];for(let i=0;i<8&&s.td?.active;i++){const c=botCommands(s,20);now+=1000;const a=performance.now();s=applyCommands(s,{seq:s.seq+1,commands:c},now);times.push(performance.now()-a);}times.sort((a,b)=>a-b);
 ok(times[Math.floor(times.length/2)]<60,'the Worker\'s time for one request (20 steps + the record): median '+times[Math.floor(times.length/2)].toFixed(1)+' ms');
 // ---- 5. the fight to its end: the better of the fight and the unfought replay ----
 const uf=s.tdu?RD.outcomeOf(s.tdu):null;({s,now}=fight(s,now));const x=s.tw.log.find(y=>y.id===e.id);
 ok(!s.td.active&&x&&rank(x.o)>=rank(uf),'the result is the better of the pilot\'s fight ('+s.td.live+') and the unfought replay ('+uf+'): '+x.o);
 ok(x.by==='you'||rank(s.td.live)<=rank(uf),'it is credited to you when your fight was the better one');
 ok(x.o!=='held'||!s.td.fought||x.pts>0,'a held fight you fought pays the defense points ('+(x.pts|0)+')');}
// ---- 6. no AFK points: a pilot who does nothing gets the unfought result and no points ----
{let {s,e}=setup('ridge','skaal');let now=t0+2*H;s.lastWall=now-1000;s=applyAction(s,{seq:s.seq+1,action:'town-defend',town:{id:e.id}},now);({s,now}=fight(s,now,{fire:false}));
 const x=s.tw.log.find(y=>y.id===e.id);ok(x&&!x.pts&&!s.td.fought,'a pilot who never fires earns no points, whatever the town does ('+x.o+')');}
// ---- 7. leaving and going quiet: the rest of the fight runs without the pilot ----
{let {s,e}=setup();let now=t0+2*H;s.lastWall=now-1000;s=applyAction(s,{seq:s.seq+1,action:'town-defend',town:{id:e.id}},now);now+=1000;s=applyCommands(s,{seq:s.seq+1,commands:botCommands(s,20)},now);
 s=applyAction(s,{seq:s.seq+1,action:'town-leave'},now+=1000);ok(!s.td.active&&s.td.why==='left'&&s.tw.log.some(y=>y.id===e.id),'LEAVE: the fight finishes without you and is settled at once');}
{let {s,e}=setup();let now=t0+2*H;s.lastWall=now-1000;s=applyAction(s,{seq:s.seq+1,action:'town-defend',town:{id:e.id}},now);now+=1000;s=applyCommands(s,{seq:s.seq+1,commands:botCommands(s,20)},now);
 s.lastWall=now;now+=25000;refreshState(s,now);ok(!s.td.active&&s.td.why==='idle'&&s.tw.log.some(y=>y.id===e.id),'no input for 20 seconds: the fight finishes without you at the next request');}
// ---- 8. showing up never hurts (decision 6): over towns and generals, the live result is never worse than the unfought one ----
{let worse=0,n=0,better=0;for(const site of ['ash','ice','delta'])for(const g of ['skaal','rheel','malgrath']){let {s,e}=setup(site,g);let now=t0+2*H;s.lastWall=now-1000;s=applyAction(s,{seq:s.seq+1,action:'town-defend',town:{id:e.id}},now);const uf=RD.outcomeOf(s.tdu);({s,now}=fight(s,now));const x=s.tw.log.find(y=>y.id===e.id);n++;if(rank(x.o)<rank(uf))worse++;if(rank(s.td.live)>rank(uf))better++;}
 ok(worse===0,'in '+n+' defenses the settled result was never worse than the unfought replay');ok(better>=1,'and the pilot\'s own fight beat the unfought replay in '+better+' of them');}
// ---- 9. the last chance: online when an undefended attack lands: 60 seconds to DEFEND, then it is decided unfought ----
{let {s,e}=setup();const L=e.l*T;s.lastWall=L-30000;refreshState(s,L+5000);const ev=s.tw.ev.find(x=>x.id===e.id);ok(ev&&ev.lc===L+5000+60000&&!s.tw.log.some(y=>y.id===e.id),'online at the landing: RAID INCOMING · DEFEND? for 60 seconds (nothing decided yet)');
 const s2=applyAction(structuredClone(s),{seq:s.seq+1,action:'town-defend',town:{id:e.id}},L+30000);ok(s2.td?.active,'DEFEND inside the minute starts the fight');
 s.lastWall=L+5000;refreshState(s,L+70000);ok(s.tw.log.some(y=>y.id===e.id&&y.by==='away')&&!s.tw.ev.some(x=>x.id===e.id),'no answer in the minute: decided unfought');}
// review B2: a held defense the pilot really fought pays the defense points even when the unfought picture is the one that counts
{const {settle}=await import('../../worker/src/conquest-town.js');const s=townPilot(CONQUEST,R,createState,t0,{cc:6,strong:true}),e=townAttack(CONQUEST,s,t0,{g:'kethra'}),at=e.l*T;
 const R0=RD.make(s.plot,77,{threat:2,lane:0,damage:true,frames:false,events:false}).run(),R1={...R0,damage:{...(R0.damage||{}),cc:((R0.damage||{}).cc||0)+40}};
 const before=s.airdrop?.pend?.raw||0,o=settle(s,e,at,{R:R1,uf:R0,fought:true,snap:null,gar:[]}),x=s.tw.log.at(-1);
 ok(RD.outcomeOf(R0)==='held'&&o==='held'&&x.by==='you'&&x.pts>0&&(s.airdrop?.pend?.raw||0)>before&&s.tw.rp.by==='away','held and really fought: '+x.pts+' raw points although the unfought picture (less damage) is the one shown');
 const s2=townPilot(CONQUEST,R,createState,t0,{cc:6,strong:true}),e2=townAttack(CONQUEST,s2,t0,{g:'kethra'});settle(s2,e2,e2.l*T,{R:R1,uf:R0,fought:false,snap:null,gar:[]});ok(!s2.tw.log.at(-1).pts,'not really fought: no points (no AFK points)');}
// review B3: your own walls let your tank through (raiders and the garrison still stop at them): one closed ring around the middle
{const p=P.newPlot('crater',0);p.cc=4;p.b.cc.l=4;const ring=P.wallPlan({...p,devx:1},[{k:'rect',a:[P.MID-9,P.MID-9],b:[P.MID+9,P.MID+9],o:1,l:1}],{dev:true});for(const x of ring.cells)p.w[x.i+','+x.j]=x.code;
 const go=kind=>{const u=RD.unitOf(kind==='p'?{id:'you',kind:'p',L:R.STOCK_L}:{id:'g1',kind:'g',kit:{w:{a:'pulse',t:1,q:1},c:{c:'titan',t:1,q:1}},rk:3}),M=RD.make(p,5,{threat:1,units:[u],pilot:{x:P.cellX(P.MID),z:P.cellZ(P.MID+6),h:0},dt:.05,frames:false,events:false});
  for(let i=0;i<300&&!M.over;i++)M.step({x:0,z:1});const v=M.units.find(w=>w.id===u.id);return P.cheb(Math.round(v.x/P.GRID.cell+P.MID),Math.round(v.z/P.GRID.cell+P.MID));};
 const d=go('p');ok(d>9,'your tank drives out through its own wall ring (now '+d+' cells from the middle; the ring is at 9)');}
console.log('PASS live defense (decisions 6 and 1): '+pass+' checks');
