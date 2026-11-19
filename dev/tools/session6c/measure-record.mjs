// Session 6C: Conquest record cost with the real Worker routes and the in-memory Firebase stand-in (dev/tests/wtest/fakedb.mjs).
// Firebase download = every response body the database sends the Worker (GET bodies, the CAS write's echo); phone = the Worker's
// reply bodies. Idle: driving with no Parasite near (the phone sends every 2 s); fight: HOLD THE OXYGEN LINE (1 s). "hit": the
// Worker isolate already holds this pilot's cold blob (immutable, cached per isolate); "miss": a cold isolate on every request.
// Run: node dev/tools/session6c/measure-record.mjs
import {createHmac} from 'node:crypto';import {makeDB} from '../../tests/wtest/fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';buildSim();
const db=makeDB({pruneEmptyUnder:['conquest']});let down=0;
globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')){const r=await db.handle(url,init);const t=await r.text();down+=t.length;return new Response(r.status===204?null:t,{status:r.status,headers:r.headers});}throw Error('ext '+url);};
const {default:worker}=await import('../../../worker/src/index.js');
let env={BOT_TOKEN:'conquest-test',FIREBASE_DB_SECRET:'SECRET'};let now=Date.now();Date.now=()=>now;let reply=0,cv=null;
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:7,initData:auth(9001),...body})}),env);const t=await r.text();reply+=t.length;const j=JSON.parse(t);if(j.cv)cv=j.cv;return j;}
await call('/api/sync');let r=await call('/api/conquest/session');let seq=r.state.seq;
async function run(n,step,miss,cmd){down=0;reply=0;for(let i=0;i<n;i++){if(miss)env={...env};now+=step;const x=await call('/api/conquest/input',{seq:++seq,commands:Array.from({length:step/50},(_,k)=>cmd(i,k)),...(cv?{cv}:{})});if(x.error)throw Error(x.error);}return {db:Math.round(down/n),phone:Math.round(reply/n)};}
const out={};
out.idleHit=await run(30,2000,false,i=>({x:i%10<5?0.4:-0.4,z:0}));out.idleMiss=await run(30,2000,true,i=>({x:i%10<5?0.4:-0.4,z:0}));
const s0=db.get('conquest/tg_9001');s0.position={x:1163,z:1132,y:0,surface:'ground'};r=await call('/api/conquest/action',{seq:++seq,action:'start-mission'});
out.fightHit=await run(30,1000,false,()=>({x:0,z:0,fire:true,aimYaw:Math.PI}));out.fightMiss=await run(30,1000,true,()=>({x:0,z:0,fire:true,aimYaw:Math.PI}));
const mb=(b,hz)=>+(b*hz*3600/1e6).toFixed(1);
for(const [k,v] of Object.entries(out)){const hz=k.startsWith('idle')?0.5:1;console.log(k.padEnd(10),'Firebase down',v.db,'B/request',mb(v.db,hz),'MB/pilot-hour · phone',v.phone,'B/request',mb(v.phone,hz),'MB/h');}
