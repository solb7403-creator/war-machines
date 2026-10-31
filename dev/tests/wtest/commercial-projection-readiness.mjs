// Authoritative economy/profile publication must preserve revision order and export guards.
// Delaying the older projection must never overwrite newer authoritative totals.
import assert from 'node:assert/strict';
import {makeDB} from './fakedb.mjs';
import {buildSim} from '../../../worker/build-sim.mjs';buildSim();
const db=makeDB(),pid='tg_630001',env={BOT_TOKEN:'fixture',FIREBASE_DB_SECRET:'SECRET'};
let release,entered,releaseMeta,enteredMeta,holdMeta=false;const metaGate=new Promise(r=>releaseMeta=r),metaWaiting=new Promise(r=>enteredMeta=r);
const gate=new Promise(r=>release=r),waiting=new Promise(r=>entered=r);let blocked=false;
globalThis.fetch=async(url,init={})=>{
 if(!String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))throw Error('External transport forbidden');
 const body=init.body?JSON.parse(init.body):{};
 if(!blocked&&((init.method==='PATCH'&&body[`players/${pid}/pts`]===100)||(init.method==='PUT'&&new URL(url).pathname==='/players/'+pid+'.json'&&body.pts===100))){blocked=true;entered();await gate;}
 if(holdMeta&&init.method==='PATCH'&&body['snapshotIndex/revision']){holdMeta=false;enteredMeta();await metaGate;}
 return db.handle(url,init);
};
const {creditMatch}=await import('../../../worker/src/eco.js');
const {snapshot}=await import('../../../worker/src/index.js');
const {backfillSnapshotPage}=await import('../../../worker/src/snapshot.js');
const first=creditMatch(env,pid,'Fixture',()=>({pts:100,pvs:1,won:true}));
await waiting;db.root.snapshotIndex={version:1,complete:true,revision:0};await assert.rejects(snapshot(env),/snapshot_publication_pending/);await creditMatch(env,pid,'Fixture',()=>({pts:200,pvs:2,won:true}));release();await first;
assert.equal(db.get('/eco/'+pid+'/earned'),300);
while(!(await backfillSnapshotPage(env)).complete){}
const rows=await snapshot(env);
assert.equal(rows[0][2],300,'Remaining P1: research profile must agree with authoritative earned credit before eligibility export');
assert.equal(db.get('/cfg/maxid'),630001,'new account metadata survives older publication losing');
holdMeta=true;const third=creditMatch(env,pid,'Fixture',()=>({pts:50,pvs:3,won:true}));await metaWaiting;assert.equal(db.get('/players/'+pid+'/pts'),350);await assert.rejects(snapshot(env),/snapshot_publication_pending/,'export must reject the profile-PUT/metadata-PATCH gap');releaseMeta();await third;assert.equal((await snapshot(env))[0][2],350);
console.log('PASS authoritative projection ordering, publication-gap fail-closed guard and first-account metadata');
