// Session 6B: the 16 research mods' behaviors (and the four Legendary set mods) in BOTH combat engines, from one shared engine
// (js/rules.js mf*): the Arcade / PvP sim (js/game.js, the Worker's live-match build) and Conquest (js/conquest/combat.js +
// controls.js, the Worker's replay). Owner rules (Nov 16, 2026): every mod has ONE distinct behavior a pilot notices; triggers
// are deterministic (counts and timers, never a chance to deal damage); behaviors work identically in Arcade and Conquest; the
// phone and the Worker agree. Run: node dev/tests/mod-behaviors.mjs
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,createSim,CONQUEST}=await import('../../worker/src/sim.gen.js');const {World:W,Combat:C,Control:K}=CONQUEST;
const {createState,applyCommands}=await import('../../worker/src/conquest-sim.js');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const near=(a,b,t)=>Math.abs(a-b)<=t;
const KIT=(mods,w='pulse')=>({...structuredClone(R.STOCK_L),w:{a:w,t:2,q:1.1,s:false},c:{c:'vanguard',t:2,q:1.1,s:false},up:{hull:3,cannon:3,engine:3,target:2,reactor:3},cores:['dmg','rof','arm'],gl:{dmg:3,rof:3,arm:3,spd:3,lck:3,reg:3},mods});
const slotOf=id=>R.rmodOf(id).slot,one=id=>({[slotOf(id)]:id});

// ---- A. the shared engine: deterministic counts and timers ----
{const T=R.tankOf(KIT(one('vent')),1),mf=R.mfNew(T);let t=0,vent=null,n=0;for(let i=0;i<40&&!vent;i++){R.mfStep(T,mf,0.2,{spd:0});t+=0.2;n++;const o=R.mfShot(T,mf,0.2);if(o&&o.vent)vent={t,n};}
 ok(vent&&near(vent.t,3.2,0.01)&&R.mfShot(T,mf,0.2)===null,'Vent Barrel: the 16th shot of an unbroken 0.2 s stream (3 s of fire) is the vent round, then the count restarts');
 const mf2=R.mfNew(T);for(let i=0;i<10;i++){R.mfStep(T,mf2,0.2,{});R.mfShot(T,mf2,0.2);}R.mfStep(T,mf2,1.0,{});R.mfShot(T,mf2,0.2);ok(mf2.st===0,'a pause longer than one and a half shots plus a quarter second ends the stream');}
{const T=R.tankOf(KIT(one('overclock')),1),mf=R.mfNew(T);let on=null;for(let i=0;i<30;i++){R.mfStep(T,mf,0.2,{});R.mfShot(T,mf,0.2);if(mf.ovc&&on===null)on=i;}
 ok(on!==null&&R.mfRate(T,mf)===1.3,'Overclock Breech: after 3.5 s of fire the rate is x1.3 (shot '+on+')');R.mfStep(T,mf,1,{});ok(R.mfRate(T,mf)===0.7&&mf.cool>0,'letting go: it cools at x0.7');R.mfStep(T,mf,1.6,{});ok(R.mfRate(T,mf)===1,'then back to normal');}
{const T=R.tankOf(KIT(one('inferno')),1),mf=R.mfNew(T);let burns=0,first=null;for(let i=0;i<60;i++){R.mfStep(T,mf,0.2,{});const o=R.mfShot(T,mf,0.2);if(o&&o.burn){burns++;if(first===null)first=i;}}
 ok(first===13&&burns>0,'Inferno Core: ignites after 2.5 s of fire (shot '+first+') and its hits carry burns ('+burns+' of 60 shots)');
 let L=[];for(let i=0;i<5;i++)L=R.mfBurn(L,7,T.rm.inferno,100);ok(L.length===2&&L.every(b=>near(b.d,0.32*100/2,1e-9)),'two burns from one tank at once (the oldest is replaced), each 0.32 s of damage over 2 s');}
{const T=R.tankOf(KIT(one('rail')),1),mf=R.mfNew(T),k=[];for(let i=1;i<=18;i++){R.mfStep(T,mf,0.2,{});const o=R.mfShot(T,mf,0.2);if(o&&o.rail)k.push(i);}ok(k.join()==='6,12,18','Rail Driver: every 6th shot is a rail slug');}
{const T=R.tankOf(KIT(one('marksman')),1),mf=R.mfNew(T),seq=[[1,1],[1,1],[1,1],[1,1],[1,0],[1,1],[1,1],[2,1],[2,1],[2,1]],c=seq.map(([id,d])=>R.mfHit(T,mf,id,!!d)?1:0);
 ok(c.join('')==='0010000001','Marksman Coil: the 3rd direct hit in a row on one target is a sure critical; a graze or a new target restarts it');R.mfHit(T,mf,3,true);R.mfHit(T,mf,3,true);R.mfMiss(T,mf);ok(!R.mfHit(T,mf,3,true),'a miss restarts it too');}
{const T=R.tankOf(KIT(one('heatsink')),1),mf=R.mfNew(T);let rings=0;for(let i=0;i<10;i++)rings+=R.mfTaken(T,mf,T.mhp*0.05,0,0,T.mhp).ring;ok(rings===2,'Heat Sink Plating: a heat ring for every fifth of the hull lost (10 x 5% = 2 rings)');}
{const T=R.tankOf(KIT(one('momentum')),1),mf=R.mfNew(T);R.mfStep(T,mf,0.5,{spd:0.9});ok(R.mfTaken(T,mf,100,0,0,T.mhp).amt===100,'Momentum Plating: not yet at half a second');R.mfStep(T,mf,0.6,{spd:0.9});
 ok(near(R.mfTaken(T,mf,100,0,0,T.mhp).amt,80,1e-9)&&R.mfTaken(T,mf,100,1,0,T.mhp).amt===100,'after 1 s flat out: shots hit 20% softer (supers do not)');R.mfStep(T,mf,0.4,{spd:0.2});ok(R.mfTaken(T,mf,100,0,0,T.mhp).amt===100,'slowing down ends it');}
{const T=R.tankOf(KIT(one('capacitor')),1),mf=R.mfNew(T);R.mfStep(T,mf,0.3,{spd:0});ok(R.mfShieldRate(T,mf)===1,'Capacitor Bank: not yet');R.mfStep(T,mf,0.3,{spd:0});ok(R.mfShieldRate(T,mf)===5,'standing still half a second: the shield recharges x5');R.mfStep(T,mf,0.05,{spd:0.5});ok(R.mfShieldRate(T,mf)===1,'moving ends it');}
{const T=R.tankOf(KIT(one('reflector')),1),mf=R.mfNew(T);ok(R.mfTaken(T,mf,35,0,65,T.mhp).refl===65&&R.mfTaken(T,mf,35,2,65,T.mhp).refl===0,'Reflector Field: all the damage the shield blocks goes back (shots and supers; not hazards)');}
{const T=R.tankOf(KIT(one('aegis')),1),mf=R.mfNew(T);R.mfShieldEnd(T,mf,T.mhp);const osh=mf.osh;ok(near(osh,T.mhp*0.11,1e-6),'Aegis Matrix: the shield ends in an overshield of 11% of the hull');ok(R.mfTaken(T,mf,osh-1,0,0,T.mhp).amt===0&&near(R.mfTaken(T,mf,10,0,0,T.mhp).amt,9,1e-6),'it takes the next hits first');
 R.mfShieldEnd(T,mf,T.mhp);R.mfStep(T,mf,6.1,{});ok(mf.osh===0,'it fades after 6 s');}
{const T=R.tankOf(KIT(one('traction')),1),mf=R.mfNew(T);R.mfDash(T,mf,4);ok(near(R.mfSpeed(T,mf),1.6,1e-9),'Traction Servo: +60% speed after a dash');R.mfStep(T,mf,2.01,{});ok(R.mfSpeed(T,mf)===1,'for 2 s');}
{const T=R.tankOf(KIT(one('overdrive')),1),mf=R.mfNew(T);ok(R.mfDashReady(T,mf,0),'Overdrive: ready');R.mfDash(T,mf,4);ok(R.mfDashReady(T,mf,4)&&R.mfDashTick(T,mf,0.1,4)===0,'a second charge right after the first');R.mfDash(T,mf,4);ok(!R.mfDashReady(T,mf,0)&&R.mfDashTick(T,mf,0.1,4)>3,'then the cooldown');
 for(let i=0;i<41;i++)R.mfDashTick(T,mf,0.1,4);ok(mf.dq===1,'one charge back after one cooldown');for(let i=0;i<41;i++)R.mfDashTick(T,mf,0.1,4);ok(mf.dq===2,'both after two');
 const H=R.tankOf(KIT(one('hyperdrive')),1),m2=R.mfNew(H);R.mfDash(H,m2,4);R.mfDash(H,m2,4);ok(R.mfDashReady(H,m2,4),'Hyperdrive (Legendary): a third charge');}
ok(R.mfPierce(R.tankOf(KIT(one('pierce')),1))===0.8&&R.mfPierce(R.tankOf(KIT({}),1))===0,'Penetrator Coil: 80% of a shield\'s protection ignored');
// no randomness anywhere in the engine (the owner rule: no luck-based damage)
{const src=['mfNew','mfStep','mfShot','mfRate','mfHit','mfMiss','mfTaken','mfShieldEnd','mfShieldRate','mfSpeed','mfDashReady','mfDash','mfDashTick','mfBurn','mfHud'].map(f=>R[f].toString()).join('\n');ok(!/random|Math\.random/.test(src),'the shared engine never rolls a chance');}

// ---- B. the Arcade / PvP engine (the Worker's live-match build): two still tanks, A fires at B ----
function arcade(modsA,{secs=10,shieldB=false,hitA=null,map='craters',dashA=null,noCrit=false}={}){
 const evs=[];const sim=createSim({seed:7,ev:a=>evs.push(a),end(){},round(){},death(){}});
 sim.setup({g:'arena',m:'1v1',map,series:false,seats:[{pid:'a',name:'A',L:KIT(modsA)},{pid:'b',name:'B',L:{...KIT({}),cores:[null,null,null]}}]});sim.start();
 const [A,B]=sim.units;if(noCrit)A.critB=-9;   /* the target carries no armor core; noCrit: no random criticals (measuring exact amounts) */sim.setCtl(A,'net');sim.setCtl(B,'net');A.x=16;A.y=27;B.x=16;B.y=23.5;A.ang=-Math.PI/2;B.hp=B.mhp=1e7;
 const log=[];let t=0;
 for(let i=0;i<secs*60;i++){B.cd=99;B.x=16;B.y=23.5;if(shieldB&&!(B.shieldT>0)){B.shieldCd=0;sim.netShield(B);}if(hitA&&i%hitA.every===0)sim.hit(A,hitA.amt,B,null,0,false,true,0);if(dashA&&dashA.includes(i))sim.netDash(A,0,-1);
  sim.step(1/60);t+=1/60;for(const e of evs){if(e[0]==='Q'&&e[1]===0)log.push({t,k:e[2]});if(e[0]==='h'&&e[1]===1&&e[6]===0)log.push({t,k:'hit',amt:e[2],kind:e[3]});if(e[0]==='b'&&e[2]===0)log.push({t,k:'shot'});}evs.length=0;}
 return {sim,A,B,log};}
const first=(log,k)=>log.find(e=>e.k===k);
{const {A,log}=arcade(one('vent')),v=first(log,'vent'),shots=log.filter(e=>e.k==='shot'),f0=shots[0].t,iv=shots[1].t-shots[0].t;ok(v&&v.t-f0>=3-1e-6&&v.t-f0<=3+iv+0.02,'Arcade: Vent Barrel\'s first vent round '+(v&&(v.t-f0).toFixed(2))+' s after the first shot (3 s of fire, shot interval '+iv.toFixed(2)+' s)');
 const hits=log.filter(e=>e.k==='hit'),norm=hits[1].amt,big=Math.max(...hits.map(h=>h.amt)),dps=A.wdps*1.36*1.1*1*(1+0)||0;ok(big>norm*1.8,'the vent round lands '+(big/norm).toFixed(1)+'x a normal shot (half a second of damage on a 0.2 s shot)');}
{const {log}=arcade(one('rail')),k=log.filter(e=>e.k==='rail').length,s=log.filter(e=>e.k==='shot').length;ok(k===Math.floor(s/6),'Arcade: Rail Driver: '+k+' slugs in '+s+' shots (every 6th)');}
{const {log}=arcade(one('marksman'),{secs:6}),c=log.filter(e=>e.k==='crit').length;ok(c>=5,'Arcade: Marksman Coil sure criticals on a still target: '+c+' in 6 s');}
{const {log}=arcade(one('pierce'),{secs:4,shieldB:true}),p=log.filter(e=>e.k==='pierce').length,h=log.filter(e=>e.k==='hit');const {log:l0}=arcade({},{secs:4,shieldB:true}),h0=l0.filter(e=>e.k==='hit');
 const avg=a=>a.reduce((x,y)=>x+y.amt,0)/a.length;ok(p>0&&avg(h)>avg(h0)*1.7,'Arcade: Penetrator Coil through a raised shield: '+(avg(h)/avg(h0)).toFixed(2)+'x the damage of a plain shot');}
{const {log}=arcade(one('inferno'),{secs:8}),i=first(log,'inferno'),f0=log.find(e=>e.k==='shot').t,burns=log.filter(e=>e.k==='hit'&&e.t>(i?i.t:99));ok(i&&i.t-f0>=2.5-1e-6&&i.t-f0<=2.75&&burns.length>0,'Arcade: Inferno Core ignites '+(i&&(i.t-f0).toFixed(2))+' s after the first shot and burns land');}
{const {log}=arcade(one('heatsink'),{secs:3,hitA:{every:10,amt:200}}),r=log.filter(e=>e.k==='ring').length;ok(r>=3,'Arcade: Heat Sink Plating rings while taking fire: '+r);}
{const {sim,A}=arcade(one('aegis'),{secs:0.1});A.shieldCd=0;sim.netShield(A);for(let i=0;i<200;i++)sim.step(1/60);ok(A.mf&&A.mf.osh>0,'Arcade: Aegis Matrix leaves an overshield when the shield ends ('+Math.round(A.mf.osh)+')');}
{const {sim,A}=arcade(one('overdrive'),{secs:0.1});A.dashCd=0;const a=sim.netDash(A,0,-1);for(let i=0;i<14;i++)sim.step(1/60);const b=sim.netDash(A,0,-1);for(let i=0;i<14;i++)sim.step(1/60);const c=sim.netDash(A,0,-1);ok(a&&b&&!c,'Arcade: Overdrive: two dashes back to back, not a third');}
{const {sim,A}=arcade(one('traction'),{secs:0.1});const s0=sim.R.STAT.speed;sim.netDash(A,0,-1);for(let i=0;i<20;i++)sim.step(1/60);ok(A.mf&&A.mf.tr>0,'Arcade: Traction Servo: the boost runs after a dash');}

// live matches: the room's roster carries each tank's research mods (the phone predicts its own Traction and Overdrive with the
// same rules) and the snapshot carries the server's mod state for the HUD (field 19)
{const {sim,A}=arcade({mount:'vent',mobility:'overdrive'},{secs:4});const ro=sim.roster();ok(ro[0].rm&&ro[0].rm.vent&&ro[0].rm.overdrive&&!ro[1].rm,'live roster: the research mods of the tank that fits them, nothing for the other');
 const sn=sim.snap(),m=sn.u[0][18];ok(Array.isArray(m)&&m.length===6&&m[4]===2&&sn.u[1][18]===0,'live snapshot: the 19th field carries the mod state (dash charges '+(m&&m[4])+'), 0 without mods');}
{const {sim,A}=arcade(one('traction'),{secs:0.1});A.claim=null;sim.netDash(A,0,-1);for(let i=0;i<13;i++)sim.step(1/60);const v0=sim.R.STAT.speed;
 const x0=A.x,y0=A.y;sim.netClaim(A,A.x,A.y-3,A.tp||0);for(let i=0;i<30;i++)sim.step(1/60);const d=Math.hypot(A.x-x0,A.y-y0);ok(d>v0*0.5*1.3,'live: the server lets a Traction tank drive at its boosted speed ('+(d/0.5).toFixed(2)+' u/s vs '+v0.toFixed(2)+')');}
// ---- C. the same scenarios in Conquest (the Worker's engine) ----
const pt=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'}),P=pt(1500,1500);
function conquest(mods,{secs=10,shieldE=false,w='pulse',noCrit=false}={}){const B=new C.Encounter(KIT(mods,w),P);if(noCrit)B.playerStats.critB=-9;const e=structuredClone(new C.Encounter(R.STOCK_L,P).enemies[0]);
 Object.assign(e,{id:1,x:P.x,z:P.z+20,y:W.groundAt(P.x,P.z+20),hp:1e7,maxHp:1e7,decision:999,cd:999,vx:0,vz:0});if(shieldE)e.pattern='shield';B.enemies=[e];
 const log=[];let q=P,t=0,hp=e.hp;for(let i=0;i<secs*20;i++){q=K.advance(B,q,{x:0,z:0,aimYaw:0,lockId:1,fire:true},0.05,true);t+=0.05;e.decision=999;e.cd=999;
  const mf=B.mf;if(mf&&mf.q&&mf.q.length){for(const k of mf.q)log.push({t,k});mf.q.length=0;}if(e.hp<hp){log.push({t,k:'hit',amt:hp-e.hp});hp=e.hp;}}
 return {B,e,log};}
{const {B,log}=conquest(one('vent')),v=first(log,'vent'),h=log.filter(e=>e.k==='hit'),iv=B.playerStats.wshot/R.GEM?B.playerStats.wshot:0.5;ok(v&&v.t>=3&&v.t<=3+0.5+0.15,'Conquest: Vent Barrel\'s first vent round at '+(v&&v.t.toFixed(2))+' s of fire (the same 3 s rule; Conquest\'s pulse fires every 0.5 s)');}
{const {B,log}=conquest(one('rail'),{secs:10}),k=log.filter(e=>e.k==='rail').length;ok(k===Math.floor(B.shots/6),'Conquest: Rail Driver: '+k+' slugs in '+B.shots+' shots (every 6th)');}
{const {log}=conquest(one('inferno'),{secs:8}),i=first(log,'inferno');ok(i&&i.t>=2.5&&i.t<=3.15,'Conquest: Inferno Core ignites at '+(i&&i.t.toFixed(2))+' s of fire (the same 2.5 s rule)');}
{const {log}=conquest(one('pierce'),{secs:8,shieldE:true}),p=log.filter(e=>e.k==='pierce').length;ok(p>0,'Conquest: Penetrator Coil through the shield commander\'s barrier ('+p+' hits)');}
// identical value in both engines: the vent round adds the same seconds of damage per second on both
{const a=arcade(one('vent'),{secs:8,noCrit:true}),c=conquest(one('vent'),{secs:8,noCrit:true});const bonus=(L,dps)=>{const vent=[],other=[];let armed=false;for(const e of L){if(e.k==='vent')armed=true;else if(e.k==='hit'&&!(e.kind>0)){if(armed){vent.push(e.amt);armed=false;}else other.push(e.amt);}}other.sort((x,y)=>x-y);return (Math.min(...vent)-other[Math.floor(other.length/2)])/dps;};   // the smallest vent round (not a critical) minus a normal shot
 const dA=a.A.wdps*R.TIER_MULT[2]*0+1;const ad=Math.max(1,a.A.wdps*a.A.dmgM*(1+R.GEM.dmg.amt*R.gemLvMult(3))*(1+R.GEM.rof.amt*R.gemLvMult(3))*R.projectileImpactMult(a.A)),cd=c.B.modDps();
 const bA=bonus(a.log,a.A.wdps*R.GEM&&a.sim?a.sim.units[0].wdps*0+ad:ad),bC=bonus(c.log,cd*R.cmult(c.B.playerStats,c.e.stats));   /* the chassis counter applies to mod damage as to any shot (Vanguard vs the Parasite's class) */ok(near(bA,0.5,0.02)&&near(bC,0.5,0.02),'both engines: a vent round adds about half a second of the tank\'s own damage (Arcade '+bA.toFixed(2)+' s, Conquest '+bC.toFixed(2)+' s)');}

// ---- D. Conquest: the phone's prediction and the Worker's replay agree (state saved between requests) ----
{const now0=Date.UTC(2026,10,17,12),mods={mount:'inferno',hull:'heatsink',mobility:'overdrive'};
 let s=createState(KIT(mods),now0);const e=structuredClone(new C.Encounter(R.STOCK_L,s.position).enemies[0]);Object.assign(e,{id:999,key:'dummy',x:s.position.x,z:s.position.z+25,y:W.groundAt(s.position.x,s.position.z+25),hp:5000,maxHp:5000,decision:999,cd:999,vx:0,vz:0,dormant:false});
 s.battle.enemies=[e];s.creditMs=4000;
 // the phone: one battle, never saved
 const B=K.ensure?(()=>{const b=new C.Encounter(KIT(mods),s.position);Object.assign(b,JSON.parse(JSON.stringify(s.battle)));b.playerStats=new C.Encounter(KIT(mods),s.position).playerStats;b.enemies=JSON.parse(JSON.stringify(s.battle.enemies));return b;})():null;
 const cmds=[];for(let i=0;i<120;i++)cmds.push({x:0,z:0,aimYaw:0,lockId:999,fire:true,dash:i===30||i===34});
 let q=s.position;for(const c of cmds){const v=K.validated(K.command(c));q=K.advance(B,q,v,0.05,true);for(const x of B.enemies)if(x.id===999){x.decision=999;x.cd=999;}}
 // the Worker: the same commands in requests of 20, the battle saved (JSON) between them
 let now=now0;for(let i=0;i<cmds.length;i+=20){now+=1000;s.battle.enemies.forEach(x=>{if(x.id===999){x.decision=999;x.cd=999;}});s=JSON.parse(JSON.stringify(applyCommands(s,{seq:s.seq+1,commands:cmds.slice(i,i+20)},now)));}
 const we=s.battle.enemies.find(x=>x.id===999),pe=B.enemies.find(x=>x.id===999);
 ok(we&&pe&&Math.abs(we.hp-pe.hp)<1e-6,'phone and Worker agree on the Parasite\'s hull after 6 s of Inferno fire and burns ('+(pe&&pe.hp.toFixed(1))+')');
 ok(JSON.stringify({...s.battle.mf,q:[]})===JSON.stringify({...B.mf,q:[]}),'phone and Worker agree on every mod counter (streak, Inferno window, dash charges)');}

{const fs=await import('node:fs'),ms=fs.readFileSync('js/match.js','utf8'),gs=fs.readFileSync('js/game.js','utf8');ok(ms.split("case 'm':").length===2&&/case 'm':\{const x=a\[1\],y=a\[2\],r=a\[3\];blasts\.push/.test(ms)&&/case 'Q':\{const u=U\(a\[1\]\)/.test(ms)&&/ev\('Q',u\.id,k\)/.test(gs)&&!/ev\('m',u\.id/.test(gs),'mod cues use their own event code (Q): meteor and megatank impacts keep m (blast, sound, shake)');}
console.log('PASS mod behaviors ('+passed+' checks)');
