// Session 6 analytics (owner Decision 11a; docs/conquest/audit/CONQUEST_1_0_SPEC.md §11). Twelve anonymous events as Firebase daily
// counters an/<day>/<event>[/<key>...] (increments, like the signup funnel fn/<day>/<step>) and cohort counters
// an/cohort/<firstDay>/{n,d1,d7,d30}. NO PERSONAL DATA: no pid, name, Telegram id, IP, wallet or timestamp is ever written with an
// event; every key is a fixed enum, a game id (operation, building, mineral) or a bucket. The reducers push events into a
// request-local queue (s.anq) that the endpoint takes off the state BEFORE the CAS write and writes as counters only AFTER that
// write succeeded (a retried or refused request counts nothing). Best effort: a failed counter write never fails a request.
// The only per-pilot field is the pilot's own cohort record s.an = {f: first Conquest UTC day, d: flags, p: simulated play ms}.
import {dbPatch,dbGet} from './db.js';
const DAY=86400000;
export const AN_EVENTS=Object.freeze(['enter','transmission_read','transmission_skip','mission_start','mission_end','death','bank','claim_town','build','raid_start','raid_end','gather','quit_point','session_minutes','return']);
export const CLIENT_EVENTS=Object.freeze(['transmission_read','transmission_skip','quit_point','session_minutes']);
export const SCREENS=Object.freeze(['world','map','briefing','after-action','supply','town','hub','loot','collection','help','more','dialog','radio']);
const SAFE=/^[a-z0-9-]{1,40}$/;
const bucket=(v,edges,unit)=>{for(let i=0;i<edges.length;i++)if(v<edges[i])return (i?edges[i-1]+'-':'lt')+edges[i]+unit;return edges.at(-1)+unit+'p';};
export const minuteBucket=m=>bucket(Math.max(0,Number(m)||0),[1,3,5,10,20,40,60],'m');          // lt1m, 1-3m ... 60mp
export const claimBucket=m=>bucket(Math.max(0,Number(m)||0),[5,10,15,20,30,60,120],'m');        // minutes of play to the town claim
export const secondsBucket=v=>bucket(Math.max(0,Number(v)||0),[60,120,180,300,600],'s');
export const carryingOf=s=>{const c=s.ledger?.cargo||{},m=s.ledger?.mn||{},n=(c.alloy|0)+(c.biomass|0)+(c.helium|0)+Object.values(m).reduce((a,v)=>a+(v|0),0);return n<=0?'none':n<20?'some':'lots';};
// queue an event on this request (never persisted: conquest.js strips s.anq before the write)
const INTERNAL=['cohort-new'];   // a new pilot's first entry: the cohort's n (an/cohort/<firstDay>/n)
export function track(s,event,...keys){if(!AN_EVENTS.includes(event)&&!INTERNAL.includes(event))return;const k=keys.filter(x=>x!==undefined&&x!==null&&x!=='').map(x=>String(x).toLowerCase());if(k.some(x=>!SAFE.test(x))||k.length>3)return;
 const q=Array.isArray(s.anq)?s.anq:(s.anq=[]);if(q.length<24)q.push([event,...k]);}
export const takeQueue=s=>{const q=Array.isArray(s?.anq)?s.anq:[];if(s)delete s.anq;return q;};
// Pilot cohort and the entry events (a session opened after more than a minute away, or the first ever).
export function entered(s,now,away){const day=Math.floor(now/DAY),a=s.an&&typeof s.an==='object'?s.an:(s.an={});if(!Number.isSafeInteger(a.f)){a.f=day;a.d={};track(s,'enter');track(s,'cohort-new');return;}
 a.d=a.d&&typeof a.d==='object'?a.d:{};if(away)track(s,'enter');for(const [k,n] of [['d1',1],['d7',7],['d30',30]])if(day-a.f===n&&!a.d[k]){a.d[k]=1;track(s,'return',k);}}
export function played(s,ms){const a=s.an&&typeof s.an==='object'?s.an:(s.an={});a.p=Math.min(1e10,(Number(a.p)||0)+Math.max(0,ms|0));}
export const playMinutes=s=>(Number(s?.an?.p)||0)/60000;
// Write a request's queue as counters (after the CAS write). The cohort keys go to an/cohort/<firstDay>/...
export async function flush(env,q,firstDay,now=Date.now()){if(!Array.isArray(q)||!q.length)return;const day=Math.floor(now/DAY),patch={};
 for(const [event,...keys] of q){if(event==='cohort-new'){if(Number.isSafeInteger(firstDay))patch['an/cohort/'+firstDay+'/n']={'.sv':{increment:1}};continue;}
  if(event==='return'&&Number.isSafeInteger(firstDay)&&['d1','d7','d30'].includes(keys[0]))patch['an/cohort/'+firstDay+'/'+keys[0]]={'.sv':{increment:1}};
  const path='an/'+day+'/'+[event,...keys].join('/');patch[path]=patch[path]?{'.sv':{increment:(patch[path]['.sv'].increment|0)+1}}:{'.sv':{increment:1}};}
 if(Object.keys(patch).length)await dbPatch(env,'',patch).catch(()=>{});}
// The phone's screen events (POST /api/conquest/an {e, k}): validated against fixed enums, at most 40 a pilot a UTC day per isolate.
const seen=new Map();
export function clientEvent(b,pid,now=Date.now()){const e=b?.e,k=b?.k;if(!CLIENT_EVENTS.includes(e))return null;const day=Math.floor(now/DAY),r=seen.get(pid);
 if(r&&r.d===day&&r.n>=40)return null;if(seen.size>20000)seen.clear();seen.set(pid,{d:day,n:(r&&r.d===day?r.n:0)+1});
 if(e==='transmission_read'||e==='transmission_skip')return [[e]];
 if(e==='session_minutes'){const m=Number(k);return Number.isFinite(m)&&m>=0&&m<=24*60?[[e,minuteBucket(m)]]:null;}
 if(e==='quit_point'){const [screen,m]=String(k||'').split(':');const mm=Number(m);return SCREENS.includes(screen)&&Number.isFinite(mm)&&mm>=0&&mm<=24*60?[[e,screen,minuteBucket(mm)]]:null;}
 return null;}
// The admin sheet: the last n days of counters and the cohorts that started in them.
export async function analyticsDays(env,n=7,now=Date.now()){const d=Math.floor(now/DAY),rows=(await dbGet(env,'an',{orderBy:'"$key"',startAt:JSON.stringify(String(d-Math.max(n,31)))}).catch(()=>null))||{};
 const days=[];for(let i=0;i<n;i++)days.push({day:d-i,...(rows[d-i]||{})});const cohort=rows.cohort||{};
 return {days,cohorts:Object.entries(cohort).map(([f,c])=>({day:Number(f),n:c?.n|0,d1:c?.d1|0,d7:c?.d7|0,d30:c?.d30|0})).filter(c=>c.day>=d-45).sort((a,b)=>b.day-a.day)};}
