// Shared warfront outbox projection. A per-pilot monotonic watermark and aggregate
// live in one Firebase CAS document, so retries and parallel tabs cannot double count.
import {readTag,writeIf} from './eco.js';
import {dbGet} from './db.js';
import {transaction as cqTx} from './conquest-store.js';
import {CONQUEST} from './sim.gen.js';
import {inventory,bind} from './conquest-loot.js';
import {RULES as R} from './sim.gen.js';
const WEF=CONQUEST.WarEffort;
const PATH='conquestWarfront/frontier-v1',GOAL=1000;
// Session 7C STEP 4: the weekly War Effort rides this document (we: this week, prev: the week before); its public view (we) carries
// numbers, the top squad's name and banner, never a pilot id (the top squad's leader id is a hidden property for the Worker: _top)
function view(v,pending=false,now=Date.now()){const score=v?.score||0,we=WEF.view(v,now),out={id:'frontier-v1',score,participants:v?.participants||0,goal:GOAL,stage:Math.floor(score/GOAL),monument:{unlocked:score>=GOAL,x:1030,z:1120,stage:Math.floor(score/GOAL),banner:we.banner,grown:we.hm,hook:WEF.HOOKS.monument},updatedAt:v?.updatedAt||0,pending,worldBossAvailable:false,worldBossBlocker:'Coordinated human multiplayer is not authenticated or load-certified.',
  we:{...we,last:we.last?{...we.last,top:we.last.top?{n:we.last.top.n||'',bn:we.last.top.bn||null,s:we.last.top.s|0,k:we.last.top.k|0}:null}:null}};
 const top=we.last?.top?.id||v?.prev?.top?.id||null;Object.defineProperty(out,'_top',{value:top,enumerable:false});return out;}
// the week's count: every verified campaign point, each pilot up to two quotas, by squad too; a new week moves the old one to prev
async function weekly(env,s,pid,delta,now,squad,name){const cur=WEF.weekOf(now);
 if(!s.we||s.we.w!==cur){if(s.we&&s.we.w===cur-1){const top=WEF.topSquad(s.we);let pub=null;if(top){const b=await dbGet(env,'cqbase/'+top.id).catch(()=>null);pub={id:top.id,n:String(b?.n||top.n||'').slice(0,24),bn:b?.bn||null,s:top.s,k:top.k};}s.prev={w:s.we.w,n:s.we.n|0,score:s.we.score|0,top:pub};}
  else if(s.we)s.prev={w:s.we.w,n:s.we.n|0,score:s.we.score|0,top:null};s.we={w:cur,n:0,score:0,c:{},sq:{},sqn:{}};}
 const W=s.we;W.c=W.c||{};W.sq=W.sq||{};W.sqn=W.sqn||{};if(!(pid in W.c)&&Object.keys(W.c).length>=WEF.WE.maxPilots)return;
 const before=Number(W.c[pid])||0,raw=before+Math.max(0,delta),cd=WEF.counted(raw)-WEF.counted(before);W.c[pid]=raw;if(!before&&raw>0){W.n=(W.n|0)+1;if(squad)W.sqn[squad]=(W.sqn[squad]|0)+1;}
 W.score=(W.score|0)+cd;if(squad)W.sq[squad]=(W.sq[squad]|0)+cd;if(name&&squad===pid){W.sqnm=W.sqnm||{};W.sqnm[squad]=String(name).slice(0,24);}}
// Every Conquest request projects the shared campaign. A pilot whose campaign score has not risen past what this isolate already
// synced is served the newest aggregate this isolate observed (at most 30s old) instead of re-reading the shared document; any new
// contribution still goes straight through the CAS below. Bounded per isolate; keyed by env so separate deployments never mix.
const CACHE_MS=30000,CACHE_PILOTS=5000,caches=new WeakMap();
function cacheFor(env){if(!env||typeof env!=='object')return null;let c=caches.get(env);if(!c)caches.set(env,c={view:null,at:0,known:new Map()});return c;}
function remember(c,pid,total,result,now){if(!c)return result;c.view=result;c.at=now;c.known.delete(pid);c.known.set(pid,total);if(c.known.size>CACHE_PILOTS)c.known.delete(c.known.keys().next().value);return result;}
export async function syncWarfront(env,pid,total,now,{squad=null,name=''}={}){
 if(!Number.isSafeInteger(total)||total<0||typeof pid!=='string'||/[.#$\[\]/]/.test(pid))throw Error('conquest: invalid campaign projection');
 const c=cacheFor(env),known=c?.known.get(pid);if(c?.view&&known!==undefined&&total<=known&&now>=c.at&&now-c.at<CACHE_MS)return c.view;
 for(let n=0;n<12;n++){
  const {v,tag}=await readTag(env,PATH),s=v||{v:1,score:0,participants:0,contributions:{},updatedAt:0};s.contributions=s.contributions||{};
  const old=s.contributions[pid]||0;if(total<=old)return remember(c,pid,old,view(s,false,now),now);
  if(!old&&Object.keys(s.contributions).length>=10000)return remember(c,pid,total,view(s,true,now),now); // bounded public launch; no fabricated capacity claim
  await weekly(env,s,pid,total-old,now,squad,name);   // Session 7C: the weekly War Effort
  s.score+=total-old;if(!old)s.participants++;s.contributions[pid]=total;s.updatedAt=now;
  if(await writeIf(env,PATH,s,tag))return remember(c,pid,total,view(s,false,now),now);
 }
 throw Error('conquest: campaign projection busy');
}

// Only called with the server's aggregate projection, never client-provided data.
export function applyWarfront(s,war,now){
 if(!s.warfront||war.stage>=(s.warfront.stage||0)||war.we?.w!==s.warfront?.we?.w||(war.we?.hm|0)!==(s.warfront?.we?.hm|0))s.warfront=war;weRewards(s,war,now);s.campaignHistory=s.campaignHistory||{};s.achievements=s.achievements||{};
 if(war.stage>0){const key=war.id+':'+war.stage;s.campaignHistory[key]=s.campaignHistory[key]||{id:war.id,stage:war.stage,at:now,score:war.score};s.achievements['campaign-stage-'+war.stage]=s.achievements['campaign-stage-'+war.stage]||now;}
 return s;
}
// Persist milestone receipts independently of action sequence. Re-read and CAS the
// newest pilot record: a delayed projection cannot roll back another tab's inputs.
export async function persistWarfront(env,pid,war,now){
 // Session 6C: the record is split (conquest-store.js); campaignHistory and achievements ride the cold part, so this goes through
 // the same split transaction (whole state in, hot CAS + cold blob out)
 const r=await cqTx(env,pid,s=>s?(applyWarfront(s,war,now),{state:s}):{abort:true});return r.abort?null:r.state;
}
// Session 7C STEP 4: the War Effort's rewards for the pilot's last week, each once (s.wep: the week before's contribution, captured by
// worker/src/conquest-boards.js boardWeek at the pilot's first request of a week): a won week's crate (2 Repair Kits + 1 Scanner
// Charge) and its cosmetic tier (s.wet: the earn-only War Effort pieces, js/conquest/catalog.js), the top squad's uncommon fragment
// (whether or not the bar was won). Never CP, salvage or points.
export function weDue(s,war){const L=war?.we?.last,P=s?.wep;return !!(L&&P&&P.w===L.w&&P.c>0&&(L.won&&!P.paid||war.we.mine&&!P.sq));}
function weRewards(s,war,now){const L=war?.we?.last,P=s.wep;if(!L||!P||P.w!==L.w||!(P.c>0)||s.dev?.used)return;const got={};
 if(L.won&&!P.paid){P.paid=1;const v=inventory(s);for(const [k,n] of Object.entries(WEF.WE.crate)){const add=Math.max(0,Math.min(n,R.CQ_ITEM_MAX-(v.it[k]|0)));v.it[k]=(v.it[k]|0)+add;got[k]=add;}s.wet=Math.max(s.wet|0,L.tier|0);got.tier=L.tier|0;}
 if(war.we.mine&&!P.sq){P.sq=1;const f=bind(s,{fr:{[WEF.WE.squadFrag]:1}},now,{where:'squad banner'});got.fr=f.fr||{[WEF.WE.squadFrag]:1};}
 if(Object.keys(got).length)s.notice={kind:'war-effort',w:L.w,won:L.won?1:0,tier:L.tier|0,got};}
