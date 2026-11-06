// Shared warfront outbox projection. A per-pilot monotonic watermark and aggregate
// live in one Firebase CAS document, so retries and parallel tabs cannot double count.
import {readTag,writeIf} from './eco.js';
const PATH='conquestWarfront/frontier-v1',GOAL=1000;
function view(v,pending=false){const score=v?.score||0;return {id:'frontier-v1',score,participants:v?.participants||0,goal:GOAL,stage:Math.floor(score/GOAL),monument:{unlocked:score>=GOAL,x:1030,z:1120,stage:Math.floor(score/GOAL)},updatedAt:v?.updatedAt||0,pending,worldBossAvailable:false,worldBossBlocker:'Coordinated human multiplayer is not authenticated or load-certified.'};}
// Every Conquest request projects the shared campaign. A pilot whose campaign score has not risen past what this isolate already
// synced is served the newest aggregate this isolate observed (at most 30s old) instead of re-reading the shared document; any new
// contribution still goes straight through the CAS below. Bounded per isolate; keyed by env so separate deployments never mix.
const CACHE_MS=30000,CACHE_PILOTS=5000,caches=new WeakMap();
function cacheFor(env){if(!env||typeof env!=='object')return null;let c=caches.get(env);if(!c)caches.set(env,c={view:null,at:0,known:new Map()});return c;}
function remember(c,pid,total,result,now){if(!c)return result;c.view=result;c.at=now;c.known.delete(pid);c.known.set(pid,total);if(c.known.size>CACHE_PILOTS)c.known.delete(c.known.keys().next().value);return result;}
export async function syncWarfront(env,pid,total,now){
 if(!Number.isSafeInteger(total)||total<0||typeof pid!=='string'||/[.#$\[\]/]/.test(pid))throw Error('conquest: invalid campaign projection');
 const c=cacheFor(env),known=c?.known.get(pid);if(c?.view&&known!==undefined&&total<=known&&now>=c.at&&now-c.at<CACHE_MS)return c.view;
 for(let n=0;n<12;n++){
  const {v,tag}=await readTag(env,PATH),s=v||{v:1,score:0,participants:0,contributions:{},updatedAt:0};s.contributions=s.contributions||{};
  const old=s.contributions[pid]||0;if(total<=old)return remember(c,pid,old,view(s),now);
  if(!old&&Object.keys(s.contributions).length>=10000)return remember(c,pid,total,view(s,true),now); // bounded public launch; no fabricated capacity claim
  s.score+=total-old;if(!old)s.participants++;s.contributions[pid]=total;s.updatedAt=now;
  if(await writeIf(env,PATH,s,tag))return remember(c,pid,total,view(s),now);
 }
 throw Error('conquest: campaign projection busy');
}

// Only called with the server's aggregate projection, never client-provided data.
export function applyWarfront(s,war,now){
 if(!s.warfront||war.stage>=(s.warfront.stage||0))s.warfront=war;s.campaignHistory=s.campaignHistory||{};s.achievements=s.achievements||{};
 if(war.stage>0){const key=war.id+':'+war.stage;s.campaignHistory[key]=s.campaignHistory[key]||{id:war.id,stage:war.stage,at:now,score:war.score};s.achievements['campaign-stage-'+war.stage]=s.achievements['campaign-stage-'+war.stage]||now;}
 return s;
}
// Persist milestone receipts independently of action sequence. Re-read and CAS the
// newest pilot record: a delayed projection cannot roll back another tab's inputs.
export async function persistWarfront(env,pid,war,now){
 for(let i=0;i<8;i++){const {v,tag}=await readTag(env,'conquest/'+pid);if(!v)return null;const s=structuredClone(v);applyWarfront(s,war,now);if(await writeIf(env,'conquest/'+pid,s,tag))return s;}
 throw Error('conquest: milestone persistence busy');
}
