// Driving netcode: the client predicts in the Worker's exact fixed steps, so reconciliation over phone-class latency and
// jitter neither snaps (including after Dash) nor freezes. The frame loop below mirrors ConquestView.tick's control path.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R}=await import('../../worker/src/sim.gen.js');const {createState,applyCommands,applyAction,validateCommands}=await import('../../worker/src/conquest-sim.js');
function client(){let clock=100000;const timers=[];const context=vm.createContext({console,performance:{now:()=>clock},setTimeout:(f,ms)=>timers.push({at:clock+ms,f}),clearTimeout});
 for(const f of ['js/rules.js','js/game.js','js/conquest/world.js','js/conquest/combat.js','js/conquest/controls.js','js/conquest/session.js'])vm.runInContext(fs.readFileSync(f,'utf8'),context,{filename:f});
 return {context,timers,get clock(){return clock;},set clock(v){clock=v;}};}
// 1. The client's normalized command is byte-identical to what the Worker replays.
{const {context}=client(),K=context.ConquestControl;let seed=7;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<500;i++){const a=r()*Math.PI*2,l=r()*1.4,raw={x:Math.cos(a)*l,z:Math.sin(a)*l,aimYaw:(r()-.5)*40,aimPitch:(r()-.5)*.8,lockId:r()<.3?null:1+Math.floor(r()*1e6),fire:r()<.5,tapFire:r()<.2,super:r()<.1,dash:r()<.1,shield:r()<.1};
 const c=K.command(raw),wire=JSON.parse(JSON.stringify(c));assert.deepEqual(validateCommands([wire])[0],JSON.parse(JSON.stringify(K.validated(c))));}
 console.log('PASS client prediction uses exactly the Worker-validated command (500 random inputs)');}
// 2. Drive with dashes over phone latency; measure every reconciliation.
async function drive({rtt,jitter,seconds=40,stall=0,act=false}){
 const env=client(),{context}=env,K=context.ConquestControl;let server=createState(R.STOCK_L,100000),seed=rtt+jitter+1;const rand=()=>(seed=(seed*16807)%2147483647)/2147483647;const pending=[];let reconnects=0,requests=0;
 const transport=(path,b)=>new Promise((resolve,reject)=>{b=JSON.parse(JSON.stringify(b));requests++;const hold=stall&&env.clock>110000&&env.clock<110000+stall?stall:0,up=hold+rtt/2+rand()*jitter,down=rtt/2+rand()*jitter;
  pending.push({at:env.clock+up,run(){try{if(path.endsWith('/session')){reconnects++;}else if(b.seq!==server.seq)server=path.endsWith('/input')?applyCommands(server,b,Math.floor(env.clock)):applyAction(server,b,Math.floor(env.clock));const out=structuredClone(server);pending.push({at:env.clock+down,run(){resolve({state:out});}});}catch(e){const err=Object.assign(Error(String(e.message)),{status:409});pending.push({at:env.clock+down,run(){reject(err);}});}}});});
 const view={p:server.position,syncLoadout(){},flushHealth(){},progress:{complete(){}},clearEnemyVisuals(){}},S=new context.ConquestSession(view,transport);
 const drain=async()=>{for(let k=0;k<30;k++){pending.sort((a,b)=>a.at-b.at);let any=false;while(pending.length&&pending[0].at<=env.clock){pending.shift().run();any=true;}env.timers.sort((a,b)=>a.at-b.at);while(env.timers.length&&env.timers[0].at<=env.clock){env.timers.shift().f();any=true;}await new Promise(r=>setImmediate(r));if(!any)break;}};
 S.connect();for(let i=0;i<40&&!S.connected;i++){env.clock+=50;await drain();}assert(S.connected);reconnects=0;
 let acc=0,latch={},frozen=0,t=0,lastDash=-1,actionResult=null;const dashes=new Set([4,9,14,19,24,29,34]);
 while(t<seconds){const dt=1/60+(rand()<.05?rand()*.05:0)+(rand()-.5)*.002;env.clock+=dt*1000;t+=dt;await drain();S.pump();
  const B=view.battle||view.encounter,sec=Math.floor(t);let fdt=dt;if(!S.connected||S.stalled){fdt=0;frozen++;}
  const dash=dashes.has(sec)&&lastDash!==sec;if(dash)lastDash=sec;if(dash)latch.dash=true;
  if(act&&sec===20&&actionResult===null){actionResult='pending';S.action('repair').then(ok=>actionResult=ok);}
  const a=t*.35,held={x:Math.cos(a),z:Math.sin(a),aimYaw:a,aimPitch:0,lockId:null,fire:false};acc+=fdt;
  while(acc>=K.STEP-1e-9){acc-=K.STEP;const command=K.command({...held,...latch});latch={};view.p=K.advance(B,view.p,K.validated(command),K.STEP,!view.battle);S.enqueue(command);}
 }
 for(let i=0;i<120&&(S.queue.length||S.busy||pending.length);i++){env.clock+=50;await drain();S.pump();}
 const corrections=S.corrections.slice(1),max=Math.max(0,...corrections);
 return {rtt,jitter,frozen,reconnects,requests,maxCorrection:max,finalGap:Math.hypot(view.p.x-server.position.x,view.p.z-server.position.z),queue:S.queue.length,actionResult,status:S.status,error:S.error};}
for(const [rtt,jitter] of [[120,60],[400,150],[800,250]]){const r=await drive({rtt,jitter});
 assert.equal(r.reconnects,0,JSON.stringify(r));assert.equal(r.frozen,0,'no frozen frames: '+JSON.stringify(r));assert(r.maxCorrection<1e-6,'prediction is reproduced, not corrected: '+JSON.stringify(r));assert(r.finalGap<1e-6,'client and Worker agree after seven dashes: '+JSON.stringify(r));
 assert(r.requests<=r.rtt/1000+45,'about one input request per second: '+JSON.stringify(r));console.log('PASS '+rtt+'ms RTT ±'+jitter+': 7 dashes, 0 reconnects, 0 frozen frames, max correction '+r.maxCorrection.toExponential(1)+' m, '+r.requests+' requests');}
// 3. A 2.5s network stall is absorbed by the Worker's real-time credit reserve: no snap, no discarded inputs.
{const r=await drive({rtt:300,jitter:100,stall:2500});assert.equal(r.reconnects,0,JSON.stringify(r));assert(r.maxCorrection<1e-6&&r.finalGap<1e-6,JSON.stringify(r));console.log('PASS 2.5s stall: caught up without reconnect or correction, '+r.frozen+' paused frames');}
// 4. A server-rejected action mid-drive (repair away from the Refuge) neither freezes driving nor resyncs/snaps it.
{const r=await drive({rtt:300,jitter:100,act:true});assert.equal(r.actionResult,false);assert.equal(r.reconnects,0,JSON.stringify(r));assert.equal(r.frozen,0,JSON.stringify(r));assert(r.maxCorrection<1e-6,JSON.stringify(r));console.log('PASS rejected action during driving: no freeze, no resync, no correction');}
