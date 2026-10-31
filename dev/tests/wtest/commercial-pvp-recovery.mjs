// Durable finished-result recovery. All provider/DB transport is fixture-only.
import assert from 'node:assert/strict';
import {makeDB} from './fakedb.mjs';
import {installWebSocketPair} from './fakedo.mjs';installWebSocketPair();
import {buildSim} from '../../../worker/build-sim.mjs';buildSim();
const db=makeDB();let outage=false,loseResponse=false,outageAfterCommit=false;
globalThis.fetch=async(u,o)=>{
 if(!String(u).includes('firebaseio.com/'))throw Error('No external transport');
 if(outage)throw Error('prolonged DB outage');
 const r=await db.handle(u,o);
 if(loseResponse&&o?.method==='PUT'&&String(u).includes('/eco/')){loseResponse=false;if(outageAfterCommit){outage=true;outageAfterCommit=false;}throw Error('response lost after commit');}
 return r;
};
const {creditMatch}=await import('../../../worker/src/eco.js');
const {PvpRoom,rules}=await import('../../../worker/src/pvp.js');
const env={BOT_TOKEN:'fixture',FIREBASE_DB_SECRET:'SECRET'},now=Date.now(),R=rules();
// Losing the first acknowledgement must remain safe after more than the old 64-entry receipt window.
const pid='tg_773001',key='a'.repeat(32),calc=()=>({pts:100,pvs:1,won:true});
loseResponse=true;await assert.rejects(creditMatch(env,pid,'Fixture',calc,now,key));
for(let i=0;i<65;i++)await creditMatch(env,pid,'Fixture',calc,now,(i+1).toString(16).padStart(32,'0'));
const earned=db.get('/eco/'+pid+'/earned'),matches=db.get('/eco/'+pid+'/pvm');
await creditMatch(env,pid,'Fixture',calc,now,key);
assert.equal(db.get('/eco/'+pid+'/earned'),earned,'Delayed result replay must survive 65 newer receipts');
assert.equal(db.get('/eco/'+pid+'/pvm'),matches);

function storageFixture(){
 const data=new Map();let alarm=null,failComplete=false,failIntent=false;
 const storage={
 async get(k){return structuredClone(data.get(k));},
 async put(k,v){if(failIntent&&v.status==='pending')throw Error('DO storage unavailable');if(failComplete&&v.status==='done')throw Error('DO acknowledgement lost');data.set(k,structuredClone(v));},
 async list({prefix}){return new Map([...data].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]));},
 async setAlarm(t){alarm=t;},
 async transaction(fn){const backup=structuredClone(data),savedAlarm=alarm;try{return await fn(storage);}catch(e){data.clear();for(const [k,v]of backup)data.set(k,v);alarm=savedAlarm;throw e;}},
 };
 return {storage,data,get alarm(){return alarm;},loseCompletion(){failComplete=true;},restoreWrites(){failComplete=false;},failIntents(){failIntent=true;}};
}
for(const kind of ['outage','response-loss','completion-loss','ambiguous-outage']){
 const fixture=storageFixture(),room=new PvpRoom({storage:fixture.storage},env),core=room.room();
 // No game timers are needed: finish an authoritative seat using the real room calculation.
 core.io.setTimeout=()=>({});core.io.clearTimeout=()=>{};core.io.setInterval=()=>({});core.io.clearInterval=()=>{};core.io.ghosts=null;
 const id=kind==='outage'?'tg_773002':kind==='response-loss'?'tg_773003':kind==='completion-loss'?'tg_773004':'tg_773006';
 core.seatPlayer({pid:id,name:'Fixture',q:{g:'arena',m:'1v1'},L:structuredClone(R.STOCK_L),power:100,league:0});core.startVs();core.startFight();
 outage=kind==='outage';if(kind==='response-loss')loseResponse=true;if(kind==='completion-loss')fixture.loseCompletion();
 if(kind==='ambiguous-outage'){loseResponse=true;outageAfterCommit=true;}
 await core.finishSeat(core.seats[0],{won:true,drawn:false,score:[1,0]},false);
 assert.ok(fixture.data.size>0,'Authoritative result must be durable before credit');
 if(outage){
  assert.ok(fixture.alarm>now,'Failed settlement must have a recovery alarm');if(kind==='outage')assert.equal(db.get('/eco/'+id),null);else assert.equal(db.get('/eco/'+id+'/pvm'),1);assert.ok(core.seats[0].res.err);
  await new PvpRoom({storage:fixture.storage},env).alarm();
  assert.ok([...fixture.data.values()].every(v=>v.status==='pending'),'Continued outage keeps intent and rearmed alarm');
 }
 // Destroy the in-memory room. Only durable storage survives the restart.
 outage=false;fixture.restoreWrites();const restarted=new PvpRoom({storage:fixture.storage},env);await restarted.alarm();
 assert.equal(db.get('/eco/'+id+'/pvm'),1,'Restart recovers exactly one match');
 const amount=db.get('/eco/'+id+'/earned');assert.ok(amount>0);
 await new PvpRoom({storage:fixture.storage},env).alarm();
 assert.equal(db.get('/eco/'+id+'/pvm'),1);assert.equal(db.get('/eco/'+id+'/earned'),amount);
 const records=[...fixture.data.values()];assert.ok(records.every(v=>v.status==='done'),'Completed result retained for reconnect');
 const forbiddenSeat=await restarted.fetch(new Request('https://room/seat',{method:'POST',body:'{}'}));assert.equal((await forbiddenSeat.json()).err,'started','Restarted finished room cannot start another match');
 const reconnected=await restarted.fetch(new Request('https://room/ws?pid='+id,{headers:{Upgrade:'websocket'}}));
 const messages=[];reconnected.webSocket.accept();reconnected.webSocket.addEventListener('message',e=>messages.push(JSON.parse(e.data)));
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(messages.find(m=>m.k==='res')?.r.awarded,amount,'Restarted result reconnect returns real persisted credit');
 assert.ok(messages.some(m=>m.k==='end'));
}
// If durable intent storage itself is unavailable, no reward write may precede it.
{
 const fixture=storageFixture();fixture.failIntents();const room=new PvpRoom({storage:fixture.storage},env),core=room.room();
 core.io.setTimeout=()=>({});core.io.clearTimeout=()=>{};core.io.setInterval=()=>({});core.io.clearInterval=()=>{};core.io.ghosts=null;
 core.seatPlayer({pid:'tg_773005',name:'Fixture',q:{g:'arena',m:'1v1'},L:structuredClone(R.STOCK_L),power:100,league:0});core.startVs();core.startFight();
 await core.finishSeat(core.seats[0],{won:true,drawn:false,score:[1,0]},false);
 assert.equal(db.get('/eco/tg_773005'),null);assert.ok(core.seats[0].res.err);assert.equal(fixture.data.size,0);
}
console.log('PASS durable PvP outage/restart, response-loss/completion-loss, alarm replay and receipts beyond 64 results');
