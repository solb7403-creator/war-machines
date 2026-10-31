// Exact ranking and bounded index paging. No live database or token distribution.
import assert from 'node:assert/strict';
import {makeDB} from './fakedb.mjs';
const db=makeDB();let failRead=false,changeAfterPage=false,finalPublicationRace=false,publicationReads=0;
globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')){if(failRead)return new Response('unavailable',{status:503});if(finalPublicationRace&&new URL(url).pathname==='/snapshotPublishing.json'&&++publicationReads===2){db.root.snapshotIndex.revision++;finalPublicationRace=false;}const response=await db.handle(url,init);if(changeAfterPage&&String(url).includes('orderBy=%22snapshotRankV1%22')){db.root.snapshotIndex.revision++;changeAfterPage=false;}return response;}throw Error('External fetch forbidden');};
const {snapshot}=await import('../../../worker/src/index.js');
const env={BOT_TOKEN:'local-only',FIREBASE_DB_SECRET:'SECRET'};
db.root.players={};for(let i=0;i<2000;i++)db.root.players['tg_'+(100000+i)]={pts:201,ac:101,days:1};db.root.players.tg_99999={pts:200,ac:200,days:10};
// Original reproduced failure remains the first exactness assertion.
let out;
try{out=await snapshot(env,{});}catch(e){assert.match(e.message,/snapshot_index_not_ready/);}
if(out)assert.ok(out.some(r=>r[0]==='tg_99999'),'highest-credit pilot must not be omitted');
const {backfillSnapshotPage}=await import('../../../worker/src/snapshot.js');
async function ready(){let status;let calls=0;do{status=await backfillSnapshotPage(env,{pageSize:137});assert.ok(++calls<200);}while(!status.complete);}
await ready();out=await snapshot(env,{});assert.equal(out.length,1000);assert.equal(out[0][0],'tg_99999');
// Sparse eligibility, ties spanning many pages, independent identities, and missing ac.
db.root.players={};delete db.root.snapshotIndex;
for(let i=0;i<2600;i++)db.root.players['tg_'+(100000+i)]={pts:1000,ac:1000};
for(let i=0;i<1400;i++)db.root.players['ln_'+(1000000000000+i)]={pts:700,ac:400,name:'Independent'};
db.root.players.tg_200001={pts:500,days:4};db.root.players.tg_200002={pts:600,ac:0};
db.root.flags={};db.root.fh={};
for(let i=0;i<2600;i++){const id='tg_'+(100000+i);if(i%2)db.root.fh[id]=1;else db.root.flags[id]={r:{alt:{t:1,v:1}}};}
await ready();const before=db.log.length;out=await snapshot(env);
assert.equal(out.length,1000);assert.equal(out[0][0],'tg_200001','legacy missing-credit fallback stays points');
assert.ok(out.slice(1).every(r=>r[0].startsWith('ln_')),'independent accounts retain existing eligibility');
assert.deepEqual(out.slice(1).map(r=>r[0]),Object.keys(db.root.players).filter(id=>id.startsWith('ln_')).sort().slice(0,999),'ties deterministically use ID ascending');
db.root.players.tg_900001={pts:9001,ac:9001};await assert.rejects(snapshot(env),/snapshot_stale_index/,'ready index must reject an observed unindexed higher-ranked profile');delete db.root.players.tg_900001;
const reads=db.log.slice(before).filter(s=>s.startsWith('GET /players'));
assert.ok(reads.length>10,'must page beyond first 2000 held candidates');
assert.ok(reads.every(s=>s.includes('orderBy=')&&s.includes('limitToFirst=201')),'every profile read is bounded');
await assert.rejects(snapshot(env,undefined,{maxPages:1}),/snapshot_scan_budget/,'never return truncated results');
failRead=true;await assert.rejects(snapshot(env),/db|snapshot/);failRead=false;
changeAfterPage=true;await assert.rejects(snapshot(env),/snapshot_changed_retry/,'concurrent profile revisions must invalidate export');
finalPublicationRace=true;publicationReads=0;await assert.rejects(snapshot(env),/snapshot_changed_retry/,'completion between final marker and epoch reads must invalidate mixed-page export');
// A cleared historical flag is not disqualifying unless the held index remains set.
db.root.flags.tg_100000.ok={alt:2};out=await snapshot(env);assert.equal(out[0][0],'tg_100000');
console.log('PASS exact top1000, >2000 exclusions, held/flagged, stable ties, independent/legacy policy, bounded paging and fail-closed limits');
