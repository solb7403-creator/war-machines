// Response-loss and transient database failure: real room settlement + server economy, isolated transport.
import assert from 'node:assert/strict';
import {makeDB} from './fakedb.mjs';
import {buildSim} from '../../../worker/build-sim.mjs';buildSim();
const db=makeDB();globalThis.fetch=async(u,o)=>{if(String(u).includes('firebaseio.com/'))return db.handle(u,o);throw Error('No external transport');};
const {creditMatch}=await import('../../../worker/src/eco.js');
const {RoomCore,rules}=await import('../../../worker/src/pvp.js');const R=rules(),env={BOT_TOKEN:'fixture',FIREBASE_DB_SECRET:'SECRET'},now=Date.now();
const calc=()=>({pts:300,pvs:1,won:true});
await Promise.all([creditMatch(env,'tg_772001','Fixture',calc,now,'a'.repeat(32)),creditMatch(env,'tg_772001','Fixture',calc,now,'a'.repeat(32))]);
assert.equal(db.get('/eco/tg_772001/earned'),300,'Same authoritative settlement must award only once');
for(const kind of ['before','after']){
 let calls=0;const pid=kind==='before'?'tg_772002':'tg_772003';
 const io={now:()=>now,day:()=>Math.floor(now/864e5),setTimeout:()=>({}),clearTimeout(){},setInterval:()=>({}),clearInterval(){},left(){},async credit(s,c){calls++;if(kind==='before'&&calls===1)throw Error('temporary outage');const result=await creditMatch(env,s.pid,s.name,c,now,s.resultKey);if(kind==='after'&&calls===1)throw Error('response lost after commit');return result;}};
 const room=new RoomCore(io,{MAP:'classic'});room.seatPlayer({pid,name:'Fixture',q:{g:'arena',m:'1v1'},L:structuredClone(R.STOCK_L),power:100,league:0});room.startVs();room.startFight();const s=room.seats[0];await room.finishSeat(s,{won:true,drawn:false,score:[1,0]},false);
 assert.ok(calls===2&&!s.res.err&&s.res.awarded>0,'Transient '+kind+'-write failure must settle and report real reward');assert.equal(db.get('/eco/'+pid+'/pvm'),1,'Retry cannot duplicate match progression');assert.equal(db.get('/eco/'+pid+'/earned'),s.res.awarded);
}
console.log('PASS PvP concurrent settlement, pre-write outage retry and ambiguous-response replay without duplicate progression');
