// Session 6 (Conquest Core Fun, part A): the first hour. The spawn at the Refuge, HOLD THE OXYGEN LINE in range at once (60 m),
// the first wave in sight of the spawn, the attacker arrow, the radio, the coach chain, the progressive HUD and the failure lines.
// The mission is played through the real Worker reducer (applyCommands) by three scripted pilots on stock gear: one follows the
// HUD arrow (ConquestGuide.arrowTarget), one never moves, one rushes in. All three must win: the first fight is staged, not luck.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C,Control:K},RULES:R}=await import('../../worker/src/sim.gen.js');
const {createState,applyCommands,applyAction,spawnPoint}=await import('../../worker/src/conquest-sim.js');
// the browser's guide (pure) in its own context, exactly as the page loads it
const ctx={console,Math,JSON,Object,Array,Number,String,Map,Set,Symbol,Error,Date,structuredClone,performance:{now:()=>0}};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['js/rules.js','js/game.js','js/conquest/world.js','js/conquest/combat.js','js/conquest/controls.js','js/conquest/guide.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
const G=ctx.ConquestGuide;
const out={};const now0=Date.UTC(2026,10,16,9);
// 1. the spawn: on the Refuge's north approach, ~40 m from the supply terminal, clear ground, facing the oxygen towers (north)
const S=W.spawn,T=C.refuge;const dT=Math.hypot(S.x-T.x,S.z-T.z);
assert(dT>=35&&dT<=50,'spawn ~40 m from the Refuge terminal ('+dT.toFixed(1)+')');assert(!W.solidAt(S.x,S.z)&&!W.waterAt(S.x,S.z),'spawn on clear ground');
assert.equal(S.yaw,0,'the camera faces north (-Z) at spawn');assert(C.mission.z<S.z&&Math.hypot(1150-S.x,1080-S.z)<70,'the oxygen towers stand in front of the spawn');
assert.equal(W.ringAt(S.x,S.z),1,'the spawn is in the Heartland (ring 1)');
let s=createState(R.STOCK_L,now0);assert.deepEqual([s.position.x,s.position.z],[S.x,S.z],'createState puts every pilot at the spawn');
out.spawn={x:S.x,z:S.z,toTerminal:Math.round(dT)};
// 2. the first mission is in range at the spawn: activation 60 m (was 150 m)
assert.equal(C.mission.activationRadius,60);assert.equal(C.operations['oxygen-line'].activationRadius,60);
const dM=Math.hypot(S.x-C.mission.x,S.z-C.mission.z);assert(dM<=60,'HOLD THE OXYGEN LINE is in range at the spawn ('+dM.toFixed(1)+' m)');
{const far=createState(R.STOCK_L,now0);far.position={...far.position,x:C.mission.x+61,z:C.mission.z,y:W.groundAt(C.mission.x+61,C.mission.z)};assert.throws(()=>applyAction(far,{seq:1,action:'start-mission',mission:'oxygen-line'},now0+500),/mission unavailable/,'61 m away is out of range');}
// 3. play it through the Worker, three ways
function play(mode){let st=createState(R.STOCK_L,now0),seq=0,now=now0+1000;st=applyAction(st,{seq:++seq,action:'start-mission',mission:'oxygen-line'},now);
 const B0=st.battle;const sp={x:st.position.x,y:st.position.y+2.2,z:st.position.z};const wave1=B0.enemies.filter(e=>e.hp>0&&!e.resident);
 assert.equal(wave1.length,2);for(const e of wave1){assert.equal(e.kind,'raider');assert(C.lineClear(sp,{x:e.x,y:e.y+2.2,z:e.z}),'wave 1 is in sight of the spawn');}
 let firstKill=null,sim=0,hpMin=1,arrowChecked=0;const route={};
 for(let r=0;r<300&&!st.settlement&&st.battle.state==='active'&&st.hp>0;r++){const cmds=[];const B={...st.battle,enemies:st.battle.enemies,state:st.battle.state,operation:null};let p={...st.position};
  for(let i=0;i<20;i++){const alive=st.battle.enemies.filter(e=>e.hp>0);const foe=G.arrowTarget(B,p);
   if(foe&&!arrowChecked){const near=alive.filter(e=>!e.resident).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];assert.equal(foe.id,near.id,'the arrow points at the nearest living attacker');arrowChecked=1;}
   let mx=0,mz=0;const goal=mode==='follow'?45:mode==='rush'?18:Infinity;
   if(foe&&Math.hypot(foe.x-p.x,foe.z-p.z)>goal){let aim=foe;   // like the HUD's red arrow: straight when in sight, else along a drivable route
    if(!C.lineClear({x:p.x,y:p.y+2.2,z:p.z},{x:foe.x,y:foe.y+2.2,z:foe.z})){const key=Math.round(foe.x/12)+':'+Math.round(foe.z/12);if(route.key!==key||!route.path){route.key=key;route.path=W.route({x:p.x,z:p.z,y:p.y,surface:'ground'},{x:Math.round(foe.x/12)*12,z:Math.round(foe.z/12)*12},{goal:14});route.from=0;}
     if(route.path){const a=W.routeAim(p,route.path,route.from);route.from=a.index;aim=a.point;}}
    const dx=aim.x-p.x,dz=aim.z-p.z,l=Math.hypot(dx,dz)||1;mx=dx/l;mz=dz/l;}
   const vis=alive.filter(e=>Math.hypot(e.x-p.x,e.z-p.z)<90&&C.lineClear({x:p.x,y:p.y+2.2,z:p.z},{x:e.x,y:e.y+2.2,z:e.z})).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
   cmds.push({x:mx,z:mz,aimYaw:foe?Math.atan2(foe.x-p.x,foe.z-p.z):0,aimPitch:0,lockId:vis?vis.id:null,fire:!!vis,shield:st.hp<st.battle.playerMax*.6});}
  now+=1000;st=applyCommands(st,{seq:++seq,commands:cmds},now);sim+=1;hpMin=Math.min(hpMin,st.hp/st.battle.playerMax);if(firstKill===null&&(st.battle.kills|0)>0)firstKill=sim;}
 if(process.env.DBG)console.log(mode,JSON.stringify(st.position),JSON.stringify(st.battle.enemies.filter(e=>!e.resident&&e.hp>0).map(e=>[e.kind,Math.round(e.x),Math.round(e.z),Math.round(e.hp),e.role])),st.battle.wave);
 return {mode,outcome:st.settlement?'victory':st.battle.state,seconds:sim,firstKillSeconds:firstKill,hullMin:Math.round(hpMin*100),objective:Math.round(100*st.battle.objectiveHp/st.battle.objectiveMax),kind:st.settlement?.kind,cp:st.settlement?.cp};}
out.missions=['follow','stay','rush'].map(play);
for(const m of out.missions){assert.equal(m.outcome,'victory',m.mode+' pilot wins the first defense: '+JSON.stringify(m));assert(m.firstKillSeconds<=15,'first kill inside 15 s of the start');assert.equal(m.kind,'first-clear');assert.equal(m.cp,250);}
// 4. the radio: 15 seconds, two lines at a time, the old onboarding flag
assert.equal(G.RADIO.key,'lunar-conquest-onboarding-v1');for(const kb of [false,true]){const P=G.RADIO.pairs(kb);assert.equal(P.length*G.RADIO.pairMs,15000);for(const pair of P){assert.equal(pair.length,2);for(const l of pair)assert(l.length<=70,'one short line: '+l);}}
assert(/SPACE/.test(G.RADIO.pairs(true)[1][0])&&/FIRE/.test(G.RADIO.pairs(false)[1][0]),'keyboard and touch wording');
// 5. the coach chain, one step at a time, from the Worker's own state
const st={completed:{},ledger:{cp:0,banked:{alloy:0,biomass:0,helium:0},cargo:{alloy:0,biomass:0,helium:0},mn:{}}};const p0={x:S.x,z:S.z};
const step=(o={})=>G.coachStep(st,p0,{wallet:{fe:0},plates:[0,0,0,0],...o})?.coach||null;
assert.equal(step(),null,'no coach before the first mission (the mission line leads)');
st.completed['oxygen-line']=1;assert.equal(step(),'bank');st.firsts={bank:1};assert.equal(step(),'scan');
const starter=W.deposits.find(d=>d.m==='starter');assert(Math.hypot(starter.x-T.x,starter.z-T.z)<=40&&W.roadAt(starter.x,starter.z),'the Starter Vein is on the Refuge road within 40 m of the terminal');
st.found={[starter.id]:1};assert.equal(step(),'gather');st.deposits={[starter.id]:1};st.ledger.mn={fe:35};assert.equal(step(),'bank2');st.ledger.mn={};
assert.equal(step({wallet:{fe:38}}),'more','38 Ferrite (Starter Vein 35 + the first clear 3) is 2 short of the 40 a plate needs');assert.equal(G.coachStep(st,p0,{wallet:{fe:38},plates:[0,0,0,0]}).name,'2 MORE FERRITE');{const m=G.coachStep(st,p0,{wallet:{fe:38},plates:[0,0,0,0]});assert(C.fieldMissionIds.includes(m.id)&&/3 Ferrite/.test(m.line),'with no scanned vein in reach, the next field mission closes the gap');}
assert.equal(step({wallet:{fe:40}}),'plate');assert.equal(step({wallet:{fe:40},plates:[1,0,0,0]}),null,'the chain ends with the first plate');
// 6. the progressive HUD: minute 0 shows nothing but the chip, hull and heat
const z={};for(const k of ['airdrop','base','meteor','orders'])assert.equal(G.hudOpen(z,k),false,k+' hidden at minute 0');
assert.equal(G.hudOpen({airdrop:{ack:1}},'airdrop'),true);assert.equal(G.hudOpen({firsts:{bank:1}},'base'),true);assert.equal(G.hudOpen({base:{tier:1}},'meteor'),true);assert.equal(G.hudOpen({wo:{seen:1}},'orders'),true);
// 7. a failed operation names the cause and the fix
const B={reason:'Oxygen infrastructure destroyed',objective:{x:1150,z:1080},enemies:[{x:1190,z:1040,hp:10},{x:1200,z:1050,hp:5}]};const [cause,fix]=G.failureLines(B);
assert(/north-east/.test(cause)&&/red arrow/.test(fix),cause+' / '+fix);for(const r of ['War Machine disabled','Retreated beyond the defense perimeter','Armored carrier escaped','Operation perimeter abandoned or time expired','War Machine disabled by a telegraphed strike']){const L=G.failureLines({reason:r});assert(L[0]&&L[1]&&L[1]!==L[0],r);}
// 8. the board after the coach: the claim as soon as it is affordable, else the nearest field mission
const b={completed:{'oxygen-line':1},ledger:{cp:600,banked:{alloy:30,biomass:15,helium:2}}};assert.equal(G.boardOrder(b,p0).name,'CLAIM YOUR TOWN');
b.ledger.cp=599;const f=G.boardOrder(b,p0);assert(C.fieldMissionIds.includes(f.id)&&!b.completed[f.id],'next field mission');assert(/599 \/ 600 CP/.test(f.line));
fs.mkdirSync('docs/conquest/session6',{recursive:true});fs.writeFileSync('docs/conquest/session6/first-hour.json',JSON.stringify(out,null,1)+'\n');
console.log('PASS first hour: spawn',out.spawn,'| first defense',out.missions.map(m=>m.mode+' '+m.outcome+' '+m.seconds+'s, first kill '+m.firstKillSeconds+'s, hull min '+m.hullMin+'%').join(' · '));
