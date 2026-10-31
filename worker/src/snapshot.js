import {dbGet,dbUrl} from './db.js';
import {isFlagged} from './eco.js';
import {snapshotRank,snapshotCredit,SNAPSHOT_INDEX_VERSION as VERSION} from './snapshot-rank.js';
const FIELD='snapshotRankV1',PAGE=200;
async function tagged(env,path){
 const r=await fetch(dbUrl(env,path),{headers:{'X-Firebase-ETag':'true'}});
 if(!r.ok)throw Error('snapshot_read '+path);const tag=r.headers.get('ETag');if(!tag)throw Error('snapshot_missing_etag');
 return {value:await r.json(),tag};
}
async function replace(env,path,value,tag){
 const r=await fetch(dbUrl(env,path),{method:'PUT',headers:{'Content-Type':'application/json','if-match':tag},body:JSON.stringify(value)});
 if(r.status===412)return false;if(!r.ok)throw Error('snapshot_index_write');return true;
}
// Explicit, resumable migration library; never invoked by a public request or cron.
// An approved operator must run bounded pages against isolated staging first. No credits are changed.
export async function backfillSnapshotPage(env,{pageSize=200}={}){
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>200)throw Error('snapshot_page_size');
 const state=await tagged(env,'snapshotIndex'),meta=state.value||{};
 if(meta.version===VERSION&&meta.complete)return meta;
 const cursor=meta.version===VERSION?meta.cursor||'':'';
 const q={orderBy:'"$key"',limitToFirst:pageSize+1,...(cursor?{startAt:JSON.stringify(cursor)}:{})};
 const raw=await dbGet(env,'players',q)||{},ids=Object.keys(raw).sort().filter(id=>id>cursor).slice(0,pageSize);
 for(const id of ids){
  let saved=false;
  for(let attempt=0;attempt<4;attempt++){
   const p=await tagged(env,'players/'+id);if(!p.value){saved=true;break;}
   const rank=snapshotRank(id,p.value);if(p.value[FIELD]===rank){saved=true;break;}
   if(await replace(env,'players/'+id,{...p.value,[FIELD]:rank},p.tag)){saved=true;break;}
  }
  if(!saved)throw Error('snapshot_index_profile_busy');
 }
 const next={version:VERSION,cursor:ids.at(-1)||cursor,complete:Object.keys(raw).length<pageSize+1,revision:Number(meta.revision)||0};
 if(!await replace(env,'snapshotIndex',next,state.tag))throw Error('snapshot_index_busy_retry_page');
 return next;
}
// Exact on a stable indexed population. Bounded scans fail explicitly rather than truncating eligibility.
export async function rankedSnapshot(env,fl,{maxPages=20}={}){
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>20)throw Error('snapshot_scan_budget');
 const before=await dbGet(env,'snapshotIndex');
 if(before?.version!==VERSION||!before.complete)throw Error('snapshot_index_not_ready');
 const [flags,held,publishing]=await Promise.all([tagged(env,'flags'),tagged(env,'fh'),tagged(env,'snapshotPublishing')]);
 if(Object.keys(publishing.value||{}).length)throw Error('snapshot_publication_pending');
 // Always use current flags, including when the caller previously fetched admin diagnostics.
 fl=flags.value||{};const holds=held.value||{};let cursor='',finished=false;const rows=[];
 for(let page=0;page<maxPages;page++){
  const q={orderBy:JSON.stringify(FIELD),limitToFirst:PAGE+1,...(cursor?{startAt:JSON.stringify(cursor)}:{})};
  const raw=await dbGet(env,'players',q)||{};
  if(Object.values(raw).some(p=>typeof p?.[FIELD]!=='string'))throw Error('snapshot_stale_index');
  const batch=Object.entries(raw).filter(([,p])=>typeof p?.[FIELD]==='string'&&p[FIELD]>cursor).sort((a,b)=>a[1][FIELD]<b[1][FIELD]?-1:1).slice(0,PAGE);
  for(const [id,p] of batch){
   if(p[FIELD]!==snapshotRank(id,p))throw Error('snapshot_stale_index');cursor=p[FIELD];
   if(!(Number(p.pts)>0)||isFlagged(fl[id])||holds[id])continue;
   rows.push([id,p.name||'Pilot',p.pts||0,p.days||0,snapshotCredit(p),p.sg||0,p.gg||0]);
   if(rows.length===1000){finished=true;break;}
  }
  if(finished||Object.keys(raw).length<PAGE+1){finished=true;break;}
 }
 if(!finished)throw Error('snapshot_scan_budget');
 const endPublishing=await tagged(env,'snapshotPublishing');
 const [after,endFlags,endHeld]=await Promise.all([dbGet(env,'snapshotIndex'),tagged(env,'flags'),tagged(env,'fh')]);
 if(after?.version!==VERSION||!after.complete||after.revision!==before.revision||endFlags.tag!==flags.tag||endHeld.tag!==held.tag||endPublishing.tag!==publishing.tag||Object.keys(endPublishing.value||{}).length)throw Error('snapshot_changed_retry');
 return rows;
}
