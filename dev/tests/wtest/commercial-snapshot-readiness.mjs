// Known P1 readiness gate; currently expected to fail. No distribution operation.
import assert from 'node:assert/strict';
import {makeDB} from './fakedb.mjs';
const db=makeDB();
globalThis.fetch=async(url,init)=>{
 if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))return db.handle(url,init);
 throw Error('External fetch forbidden: '+url);
};
const {snapshot}=await import('../../../worker/src/index.js');
db.root.players={};
for(let i=0;i<2000;i++)db.root.players['tg_'+(100000+i)]={pts:201,ac:101,days:1};
db.root.players.tg_99999={pts:200,ac:200,days:10};
const out=await snapshot({BOT_TOKEN:'local-only',FIREBASE_DB_SECRET:'SECRET'},{});
assert.equal(out.length,1000);assert.ok(out.some(r=>r[0]==='tg_99999'),'P1 readiness gate: highest-credit eligible pilot must be in snapshot');
console.log('PASS exact candidate inclusion');
