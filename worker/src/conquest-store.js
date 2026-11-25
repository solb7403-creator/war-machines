// Session 6C: the Conquest record split (owner prompt Nov 18 §7; blueprint §10, fix step 1). Every request used to read the whole
// record (readTag) and write it back (writeIf, whose reply echoes it: Firebase refuses print=silent on a conditional write), so a
// pilot driving about once a second downloaded the record twice a second. Now:
//  - the HOT part, at conquest/<pid> (the CAS document, the commit point): the battle near the pilot and everything that changes on
//    an ordinary request (seq, clocks, position, hull, the airdrop outbox, analytics counters, cargo and drops);
//  - the COLD part, an IMMUTABLE blob at cqc/<pid>/<cv> (the town, ore veins, the exploration battle kept during an operation, the
//    world's far Parasites, receipts and history): written with print=silent (no reply body) only when it changed, then named by
//    the hot part's cv in the same CAS write. A request whose CAS loses leaves an orphan blob (deleted best effort); a reader never
//    sees a half-written state, because a blob is only ever referenced after it is complete and is never changed after.
//  - immutable blobs can be cached safely per isolate (pid + cv), so a warm request reads only the hot part.
// The reducer still sees one whole state (join), so every rule, reward and exactly-once credit is unchanged.
import {dbUrl,SILENT} from './db.js';
import {readTag,writeIf} from './eco.js';
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
// cold: large or rarely changed (a whole state still works if any of these is in the hot part: hot fields win in join)
export const COLD_KEYS=Object.freeze(['plot','lodes','explorationBattle','raidReceipts','missionClaims','cosmetics','campaignHistory','achievements','contracts','warfront','territory','strikes','regionRevision','raidProgress','lseed','deposits','harvest','found','ambushed','spawns','loadout','engineering','wo','rs','bat','firsts','checkpoint','completed','orders','reputation','campaignScore','resonance','incursions','war','al','tw','tdp','tdu','twsd','bcn','stk','cit','citRun','fp','fpf','ttn','ttnRun','wkb','rtb','rbest','gra','wep','wet']);   // Session 7B: the Citadel record and the running assault's launch record (they change at a launch, an end or a won raid)   // Session 7: the war record and the alert settings change at a tick or an action, never on an ordinary request
const COLD=new Set(COLD_KEYS);
export const FAR=245;   // m: a Parasite farther than this from the pilot rides whole in the cold part (AI runs within 240 m: it does not move)
// the fields of a unit that change while it fights; everything else about it (its definition, stats, home, route, kit) is static
// and rides in the cold part keyed by id (a static field that does change simply makes the cold part change: always correct)
const DYN=new Set(['id','x','y','z','surface','hp','heading','turret','decision','dec','cd','vx','vz','target','guardReturning','navGoal','routeIndex','radioUntil','radioCalled','lootCreated','shielded','telegraph','enraged','nextPattern','drones','burns','bT','fz','fzA','sh','pd','ad','core','launchedAt','tf','charge','heat','oh','react','tgt','ax','ay','az','sup','kills','down','hurt','hc','rv','rvT','ch','n','dt','dash','dormant','resident']);
const halves=e=>{const d={},st={};for(const [k,v] of Object.entries(e))(DYN.has(k)?d:st)[k]=v;return [d,st];};
// a state -> {hot, cold}; the far Parasites keep their place in the list (key 'e<index>': Firebase keeps it an object)
export function split(s){const hot={},cold={};for(const [k,v] of Object.entries(s||{}))(COLD.has(k)?cold:hot)[k]=v;
 const b=hot.battle,p=hot.position;if(record(b)&&Array.isArray(b.enemies)&&p&&Number.isFinite(p.x)){const near=[],far={};let n=0;
  const es={},fs={};b.enemies.forEach((e,i)=>{if(e&&Number.isFinite(e.x)&&Math.hypot(e.x-p.x,e.z-p.z)>FAR){far['e'+i]=e;n++;}else if(e&&Number.isSafeInteger(e.id)){const [d,st]=halves(e);es['i'+e.id]=st;near.push(d);}else near.push(e);});
  const fr=(Array.isArray(b.friends)?b.friends:[]).map(f=>{if(!f||!Number.isSafeInteger(f.id))return f;const [d,st]=halves(f);fs['i'+f.id]=st;return d;});
  hot.battle={...b,enemies:near,friends:fr};cold.fe={n:b.enemies.length,e:far};cold.es=es;cold.fs=fs;}
 return {hot,cold};}
const list=v=>Array.isArray(v)?v:record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]):[];
// {hot, cold} -> the state (hot fields win, so a whole record written to the hot path, with no cv, is read as it is)
export function join(hot,cold){if(!record(hot))return hot;const s={...(record(cold)?cold:{}),...hot};delete s.fe;delete s.es;delete s.fs;delete s.cv;delete s.cvn;
 if(record(s.battle)&&record(cold)){const es=record(cold.es)?cold.es:{},fs=record(cold.fs)?cold.fs:{};s.battle={...s.battle,enemies:list(s.battle.enemies).map(d=>d&&es['i'+d.id]?{...es['i'+d.id],...d}:d),friends:list(s.battle.friends).map(d=>d&&fs['i'+d.id]?{...fs['i'+d.id],...d}:d)};}
 const fe=record(cold)?cold.fe:null;if(record(fe)&&record(fe.e)&&record(s.battle)){const near=list(s.battle.enemies),at=fe.e,total=Math.max(fe.n|0,near.length+Object.keys(at).length),out=[];let k=0;
  for(let i=0;i<total;i++){const e=at['e'+i];if(e)out.push(e);else if(k<near.length)out.push(near[k++]);}while(k<near.length)out.push(near[k++]);s.battle={...s.battle,enemies:out};}
 return s;}
// Firebase's own shape (sorted keys; empty maps, empty lists and nulls dropped): two colds compare equal when Firebase would store
// the same thing, so a request that changed nothing cold writes nothing cold
export function canon(v){if(Array.isArray(v)){const a=v.map(canon).filter(x=>x!==undefined);return a.length?a:undefined;}
 if(record(v)){const o={};for(const k of Object.keys(v).sort()){const x=canon(v[k]);if(x!==undefined)o[k]=x;}return Object.keys(o).length?o:undefined;}
 return v===null||v===undefined||typeof v==='function'||(typeof v==='number'&&!Number.isFinite(v))?undefined:v;}
const caches=new WeakMap(),CACHE_PILOTS=400;   // reviewer 1: a full CC10 town's cold part is ~127 KB of heap: 400 pilots stay near 50 MB of a 128 MB isolate
function cacheOf(env){if(!env||typeof env!=='object')return null;let c=caches.get(env);if(!c)caches.set(env,c=new Map());return c;}
export const stats={hotReads:0,coldReads:0,coldHits:0,coldWrites:0,coldDeletes:0};
async function coldOf(env,pid,cv){const c=cacheOf(env),hit=c?.get(pid);if(hit&&hit.cv===cv){stats.coldHits++;c.delete(pid);c.set(pid,hit);return structuredClone(hit.v);}
 stats.coldReads++;const r=await fetch(dbUrl(env,'cqc/'+pid+'/'+cv));if(!r.ok)throw Error('db get cqc '+r.status);const v=await r.json();if(v===null)return null;remember(env,pid,cv,v);return structuredClone(v);}
function remember(env,pid,cv,v){const c=cacheOf(env);if(!c)return;c.delete(pid);c.set(pid,{cv,v});if(c.size>CACHE_PILOTS)c.delete(c.keys().next().value);}
async function putBlob(env,pid,cv,v){stats.coldWrites++;const r=await fetch(dbUrl(env,'cqc/'+pid+'/'+cv,SILENT),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)});if(!r.ok)throw Error('db put cqc '+r.status);}
function dropBlob(env,pid,cv){stats.coldDeletes++;return fetch(dbUrl(env,'cqc/'+pid+'/'+cv,SILENT),{method:'DELETE'}).catch(()=>{});}
const cvId=(n,i)=>n+'x'+(Date.now()%1e6).toString(36)+i+Math.floor(Math.random()*1e6).toString(36);
// The Conquest CAS transaction on the split record. fn(state|null) -> {state} | {abort}; returns fn's result after the commit.
// guard(state): the per-request rate limit (it may abort with a result). Up to 8 tries on a write race, as before.
export async function transaction(env,pid,fn,guard){const path='conquest/'+pid;
 for(let i=0;i<8;i++){stats.hotReads++;const {v:h,tag}=await readTag(env,path);let cold=null;
  if(record(h)&&h.cv){cold=await coldOf(env,pid,h.cv);if(cold===null)continue;}   // the blob was replaced under us (a newer commit): read again
  const whole=record(h)?join(h,cold):h,r=await fn(whole?structuredClone(whole):null);if(r.abort)return r;
  const state=r.state,g=guard?guard(state,h):null;if(g)return g;
  const {hot,cold:c2}=split(state),k2=canon(c2)||{},same=record(h)&&!!h.cv&&JSON.stringify(canon(cold)||{})===JSON.stringify(k2);
  let cv=record(h)?h.cv:null,fresh=null;if(!same){fresh=cvId((record(h)?h.cvn|0:0)+1,i);await putBlob(env,pid,fresh,k2);cv=fresh;}
  hot.cv=cv;hot.cvn=fresh?(record(h)?h.cvn|0:0)+1:(record(h)?h.cvn|0:0);
  if(await writeIf(env,path,hot,tag)){if(fresh){remember(env,pid,fresh,k2);if(record(h)&&h.cv)await dropBlob(env,pid,h.cv);}r.cold=fresh?1:0;r.cv=cv;r.cvn=hot.cvn;return r;}
  if(fresh)await dropBlob(env,pid,fresh);}   // the CAS lost: this attempt's blob is an orphan
 throw Error('conquest busy');}
// at a session open: delete orphan blobs (an attempt that died between its blob and its CAS); keys only (shallow). Only blobs of a
// generation at or below the one just committed (cvn) can be orphans: a request still in flight writes generation cvn + 1 or later
// before its CAS, so it is never touched (deleting it would strand the record on a missing cold part). An id it cannot read is kept.
const genOf=k=>{const m=/^(\d{1,12})x/.exec(k);return m?Number(m[1]):Infinity;};
const SWEPT=new WeakMap(),SWEEP_MS=3600000,SWEEP_MAX=20;   // at most 20 deletes in one session open (the subrequest budget); the rest go an hour later   // at most once an hour per pilot per isolate: a shallow read is cheap, not free
export async function sweep(env,pid,cv,cvn,now=Date.now()){if(!cv||!Number.isFinite(cvn))return 0;let m=SWEPT.get(env);if(!m){m=new Map();SWEPT.set(env,m);}const last=m.get(pid);if(last&&now-last<SWEEP_MS)return 0;m.set(pid,now);if(m.size>5000)m.delete(m.keys().next().value);
 try{const r=await fetch(dbUrl(env,'cqc/'+pid,{shallow:'true'}));if(!r.ok)return 0;const v=await r.json();if(!record(v))return 0;let n=0;for(const k of Object.keys(v))if(k!==cv&&genOf(k)<=cvn&&n<SWEEP_MAX){n++;await dropBlob(env,pid,k);}return n;}catch{return 0;}}
// the whole state, read only (tests, admin)
export async function readState(env,pid){const {v:h}=await readTag(env,'conquest/'+pid);if(!record(h)||!h.cv)return h;const c=await coldOf(env,pid,h.cv);return join(h,c);}
