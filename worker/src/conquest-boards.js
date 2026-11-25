// Session 7C STEP 3 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md; old brief B): five weekly Conquest boards and the Hive Titan's
// 30-day board, as small shared documents (cqb/<kind>/<period>: the best 120 pilots, compare-and-swap like the warfront document), every
// score the Worker's own (from the pilot's verified record after a committed request; never a number the phone sends):
//   town      this week's Town Score gain (the Base of the Week's measure: conquest-visit.js publishBase)
//   defense   the town's defense rating, its best this week
//   raid      raid time-attack: the week's featured raid layout, the fastest verified completion (the Worker's fight clock, stamped in
//             the raid receipt); one featured layout a week so every pilot races the same course (lead's decision)
//   titan     the Hive Titan: the pilot's own damage, the week's slots summed (a slot counts its best attempt once)
//   campaign  this week's campaign score gain (every verified operation adds)
//   titan30   the Hive Titan over 30 days (fixed 30-day periods from the epoch, settled once each)
// Pilots under review are left off (fh, as on cqtop and the leaderboard), at reading and at the payout. A board pays once per period,
// only when at least 20 verified pilots are on it (cqbp/<kind>/<period>/<pid>: who posted), every band rounded down (owner, Nov 24;
// docs/economy/RESOURCE_ECONOMY.md §5.5): titan, 1 Selenite to the top 10% (at most 100) and 1 Moonheart to the top 1% (at most 10);
// titan30, 2 Moonheart to the top 1% (at most 3); the other four, 1,500 CP + 1 rare fragment to the top 10% (at most 100). Equal scores
// rank by who reached the score first. Exactly once: the settlement record (cqbs/<kind>/<period>) is written once with its final
// winner list, then one grant per winner and period (cqgr/<pid>/<kind>-<period>), applied once by id at the pilot's next session open.
import {dbGet,dbPatch,dbDel,weekOf} from './db.js';
import {readTag,writeIf} from './eco.js';
import {CONQUEST,RULES as R} from './sim.gen.js';
import {bankMinerals} from './conquest-airdrop.js';
import {bind} from './conquest-loot.js';
const DAY=86400000,TOP=120,SHOW=100;
export const BOARD=Object.freeze({min:20,top:TOP,show:SHOW,order:Object.freeze(['town','defense','raid','titan','campaign','titan30']),
 kinds:Object.freeze({town:{name:'TOWN SCORE GAIN',lo:false},defense:{name:'DEFENSE RATING',lo:false},raid:{name:'RAID TIME-ATTACK',lo:true},titan:{name:'HIVE TITAN DAMAGE',lo:false},campaign:{name:'CAMPAIGN SCORE',lo:false},titan30:{name:'HIVE TITAN · 30 DAYS',lo:false,days:30}}),
 bands:Object.freeze({titan:[{pct:.10,max:100,mn:{se:1}},{pct:.01,max:10,mn:{mh:1}}],titan30:[{pct:.01,max:3,mn:{mh:2}}],town:[{pct:.10,max:100,cp:1500,fr:{r:1}}],defense:[{pct:.10,max:100,cp:1500,fr:{r:1}}],raid:[{pct:.10,max:100,cp:1500,fr:{r:1}}],campaign:[{pct:.10,max:100,cp:1500,fr:{r:1}}]})});
export const periodOf=(kind,now)=>kind==='titan30'?'p'+Math.floor(now/DAY/30):'w'+weekOf(now);
export const periodEnd=(per)=>per[0]==='p'?(Number(per.slice(1))+1)*30*DAY:(Number(per.slice(1))+1)*7*DAY+4*DAY;
// the week's featured raid layout (the time-attack course)
export const featuredRaid=now=>{const L=CONQUEST.Combat.raidIds;return L[((weekOf(now)%L.length)+L.length)%L.length];};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
export const rowsOf=doc=>(Array.isArray(doc?.top)?doc.top:record(doc?.top)?Object.values(doc.top):[]).filter(r=>record(r)&&typeof r.p==='string'&&Number.isFinite(r.s));
const better=(kind,a,b)=>BOARD.kinds[kind].lo?a<b:a>b;
export const rank=(kind,rows)=>[...rows].sort((a,b)=>(BOARD.kinds[kind].lo?a.s-b.s:b.s-a.s)||a.at-b.at||(a.p<b.p?-1:1));
// the band sizes for a verified field of n (rounded down; nothing under the minimum field)
export function bandsOf(kind,n){if(n<BOARD.min)return [];return BOARD.bands[kind].map(b=>({...b,k:Math.min(b.max,Math.floor(b.pct*n))}));}
// ---- the pilot's scores, from its verified record ----
const sumSlots=(sl,from,to)=>Object.entries(sl||{}).reduce((a,[k,x])=>{const t=Number(k)*R.STRIKE.everyMs;return t>=from&&t<to?a+(Number(x?.d)||0):a;},0);   // a slot's time: its impact
export function scoresOf(s,now){const out={},wk=weekOf(now),w0=wk*7*DAY+4*DAY,p0=Math.floor(now/DAY/30)*30*DAY,T=CONQUEST.Titan.norm(s?.ttn);
 const b=s?.wkb;if(b&&b.w===wk){const g=(s.campaignScore|0)-(b.cs|0);if(g>0)out.campaign=g;}   // only a real gain posts (review round 1: a zero row counted an idle pilot in the field)
 const td=sumSlots(T.sl,w0,w0+7*DAY),t30=sumSlots(T.sl,p0,p0+30*DAY);if(td>0)out.titan=td;if(t30>0)out.titan30=t30;
 const rt=s?.rtb;if(rt&&rt.w===wk&&rt.id===featuredRaid(now)&&rt.sec>0)out.raid=rt.sec;return out;}
// ---- posting (after a committed request; best effort, never fails the pilot's action) ----
// a pilot's first post of the period also counts it in the board's field (n: shown; the payout counts the verified field exactly)
async function post(env,pid,name,kind,score,now,extra){const per=periodOf(kind,now),path='cqb/'+kind+'/'+per,mk='cqbp/'+kind+'/'+per+'/'+pid;
 const had=await dbGet(env,mk).catch(()=>null),fresh=had===null||had===undefined;if(!fresh&&!better(kind,score,Number(had)))return;
 let done=false;for(let n=0;n<8;n++){const {v,tag}=await readTag(env,path),rows=rowsOf(v),old=rows.find(r=>r.p===pid),up=!old||better(kind,score,old.s);if(!up&&!fresh){done=true;break;}
  const next=up?rank(kind,[...rows.filter(r=>r.p!==pid),{p:pid,n:String(name||'PILOT').slice(0,16),s:score,at:now,...extra}]).slice(0,TOP):rows;
  if(await writeIf(env,path,{v:1,k:kind,per,top:next,n:(Number(v?.n)||0)+(fresh?1:0),at:now},tag)){done=true;break;}}
 if(!done)return false;await dbPatch(env,'',{[mk]:score});return true;}   // the marker (the field) only with the row written: a lost race posts again next time
const MEMO=new Map();
export async function postBoards(env,pid,name,s,now,{town=null,defense=null}={}){if(!s||s.dev?.used||typeof pid!=='string'||/[.#$\[\]/]/.test(pid))return;const sc=scoresOf(s,now);if(town!==null&&town>0)sc.town=town;if(defense!==null&&defense>0)sc.defense=defense;
 const m=MEMO.get(pid)||{},extra={...(s.plot?.cc?{cc:s.plot.cc|0}:{})};for(const [k,v] of Object.entries(sc)){const key=k+':'+periodOf(k,now);if(m[key]!==undefined&&!better(k,v,m[key]))continue;if(await post(env,pid,name,k,v,now,extra).catch(()=>false))m[key]=v;}
 MEMO.delete(pid);MEMO.set(pid,m);if(MEMO.size>20000)MEMO.delete(MEMO.keys().next().value);}
// ---- reading (POST /api/conquest/boards): every board this period, names and scores, the pilot's own place, the field and the bands ----
export async function conquestBoards(env,a,now=Date.now()){const b=a.b||{};if(Object.keys(b).some(k=>!['gv','initData'].includes(k)))return {status:400,body:{error:'invalid boards'}};
 const kinds=BOARD.order,[fh,...docs]=await Promise.all([dbGet(env,'fh').catch(()=>null),...kinds.map(k=>dbGet(env,'cqb/'+k+'/'+periodOf(k,now)).catch(()=>null))]),held=id=>!!(fh&&fh[id]);
 const boards={};kinds.forEach((k,i)=>{const all=rank(k,rowsOf(docs[i]).filter(r=>!held(r.p))),me=all.findIndex(r=>r.p===a.pid);
  boards[k]={name:BOARD.kinds[k].name,per:periodOf(k,now),ends:periodEnd(periodOf(k,now)),lo:!!BOARD.kinds[k].lo,top:all.slice(0,SHOW).map((r,j)=>({r:j+1,n:r.n,s:r.s,...(r.cc?{cc:r.cc}:{}),...(r.p===a.pid?{me:1}:{})})),me:me>=0?{r:me+1,s:all[me].s}:null,field:Math.max(all.length,(Number(docs[i]?.n)||0)-rowsOf(docs[i]).filter(r=>held(r.p)).length),   /* pilots under review leave the shown field too (the payout counts the markers minus every held pilot) */
   bands:BOARD.bands[k].map(x=>({pct:x.pct,max:x.max,...(x.cp?{cp:x.cp}:{}),...(x.fr?{fr:x.fr}:{}),...(x.mn?{mn:x.mn}:{})})),min:BOARD.min};});
 const mine=held(a.pid);return {status:200,body:{ok:true,boards,raid:featuredRaid(now),held:mine,t:now}};}
// ---- the payout (the 5-minute cron): every period that has ended, once ----
async function fieldOf(env,kind,per,fh){const ids=(await dbGet(env,'cqbp/'+kind+'/'+per,{shallow:'true'}).catch(()=>null))||{};return Object.keys(ids).filter(id=>!(fh&&fh[id])).length;}
export function winnersOf(kind,rows,n,fh){const ok=rank(kind,rows.filter(r=>!(fh&&fh[r.p])&&r.s>0)),out=[];for(const b of bandsOf(kind,n))for(let i=0;i<b.k&&i<ok.length;i++)out.push({p:ok[i].p,r:i+1,s:ok[i].s,pct:b.pct,...(b.cp?{cp:b.cp}:{}),...(b.fr?{fr:b.fr}:{}),...(b.mn?{mn:b.mn}:{})});return out;}
export async function settleBoard(env,kind,per,now){const sp='cqbs/'+kind+'/'+per;let {v,tag}=await readTag(env,sp);
 if(!v){const fh=(await dbGet(env,'fh').catch(()=>null))||{},doc=await dbGet(env,'cqb/'+kind+'/'+per).catch(()=>null),n=await fieldOf(env,kind,per,fh),w=winnersOf(kind,rowsOf(doc),n,fh);
  const rec={v:1,k:kind,per,n,small:n<BOARD.min?1:0,w:w.map(x=>[x.p,x.r,x.s,x.pct]),at:now,granted:0};if(!(await writeIf(env,sp,rec,tag))){({v}=await readTag(env,sp));if(!v)return null;}else v=rec;}   // a second run reads the one written
 if(v.granted)return v;const up={};for(const [p,r,s,pct] of (Array.isArray(v.w)?v.w:[])){const b=BOARD.bands[kind].find(x=>x.pct===pct);if(!b||typeof p!=='string')continue;const gid=kind+'-'+per+'-'+String(pct).replace('.','');up['cqgr/'+p+'/'+gid]={k:kind,per,r,s,pct,...(b.cp?{cp:b.cp}:{}),...(b.fr?{fr:b.fr}:{}),...(b.mn?{mn:b.mn}:{}),at:now};}
 if(Object.keys(up).length)await dbPatch(env,'',up);await dbPatch(env,sp,{granted:now});return {...v,granted:now};}
// a period settles 70 minutes after its end: the hourly cqalt scan has seen every cluster once more and the held index (fh) was rebuilt
// with every flag raised by then (review round 1: a flag raised in the settling cron run itself was not yet in fh)
export const SETTLE_AFTER=70*60000;
export async function settleBoards(env,now=Date.now()){let n=0;for(const kind of BOARD.order){const per=periodOf(kind,now),prev=kind==='titan30'?'p'+(Number(per.slice(1))-1):'w'+(Number(per.slice(1))-1);
  if(now<periodEnd(prev)+SETTLE_AFTER)continue;const done=await dbGet(env,'cqbs/'+kind+'/'+prev+'/granted').catch(()=>null);if(done)continue;await settleBoard(env,kind,prev,now);n++;}
 return n;}
// ---- the grants, at the session open: each applied once by id (s.gra keeps the applied ids), then deleted ----
// a grant counts only if its period's settlement record lists this pilot in that band (the winners list written once by the cron):
// anything else in the inbox is cleared unpaid
// a grant (and the record of having applied it) lives GRANT_KEEP periods: 12 weeks for a weekly board, 3 thirty-day periods for the Titan's
// 30-day board. Older grants expire unpaid (the pilot did not open Conquest for about 3 months); within that window every applied id is
// kept (s.gra), so a grant can never pay twice however many arrive at once (review round 1: a count cap of 60 paid 70 grants as 80)
export const GRANT_KEEP=Object.freeze({w:12,p:3});
export function grantLive(per,now){if(typeof per!=='string'||!/^[wp]-?\d{1,7}$/.test(per))return false;const age=(per[0]==='p'?Math.floor(now/DAY/30):weekOf(now))-Number(per.slice(1));return age>=0&&age<=GRANT_KEEP[per[0]];}
export async function pendingGrants(env,pid,now=Date.now()){const g=await dbGet(env,'cqgr/'+pid).catch(()=>null);if(!record(g))return {ok:{},bad:[]};const ok={},bad=[];
 const keys=[...new Set(Object.values(g).filter(x=>record(x)&&BOARD.kinds[x.k]&&grantLive(x.per,now)).map(x=>x.k+'/'+x.per))],recs=new Map(await Promise.all(keys.map(async k=>[k,await dbGet(env,'cqbs/'+k).catch(()=>null)])));
 for(const [gid,x] of Object.entries(g)){if(!record(x)||!BOARD.kinds[x.k]||!grantLive(x.per,now)){bad.push(gid);continue;}const key=x.k+'/'+x.per;
  const rec=recs.get(key),hit=Array.isArray(rec?.w)&&rec.w.some(w=>Array.isArray(w)&&w[0]===pid&&w[3]===x.pct)&&gid===x.k+'-'+x.per+'-'+String(x.pct).replace('.','');if(hit)ok[gid]=x;else bad.push(gid);}
 return {ok,bad};}
export function applyGrants(s,grants,now){const done=new Set((Array.isArray(s.gra)?s.gra:[]).filter(id=>grantLive(String(id).split('-')[1],now))),got=[];
 for(const [gid,g] of Object.entries(grants||{})){if(done.has(gid)||!record(g)||!BOARD.kinds[g.k]||!grantLive(g.per,now))continue;const b=BOARD.bands[g.k].find(x=>x.pct===g.pct);if(!b)continue;   // the amounts are the table's, never the grant's
  if(!s.dev?.used){if(b.cp){s.ledger.cp+=b.cp;}if(b.fr)bind(s,{fr:{...b.fr}},now,{where:'weekly board'});if(b.mn)bankMinerals(s,b.mn);}
  done.add(gid);got.push({k:g.k,r:g.r|0,pct:g.pct,...(b.cp?{cp:b.cp}:{}),...(b.fr?{fr:b.fr}:{}),...(b.mn?{mn:b.mn}:{})});}
 s.gra=[...done];if(got.length)s.notice={kind:'board-reward',got};return got;}   // every id inside the window (at most 12 x 6 + 3)
export async function clearGrants(env,pid,ids){if(!ids.length)return;const up={};for(const id of ids)up['cqgr/'+pid+'/'+id]=null;await dbPatch(env,'',up).catch(()=>{});}
// ---- the reducer's part (worker/src/conquest-sim.js) ----
// every request: the week's starting campaign score (the campaign board's baseline), set at the pilot's first request of the week
export function boardWeek(s,now){const w=weekOf(now);if(!s.wkb||s.wkb.w!==w){if(s.wkb)s.wep={w:s.wkb.w,c:Math.max(0,(s.campaignScore|0)-(s.wkb.cs|0))};s.wkb={w,cs:Math.max(0,s.campaignScore|0)};}}   // wep: the week before's contribution (the War Effort's rewards: conquest-warfront.js)
// a raid won: the Worker's own fight clock stamped in its receipt (sec), the pilot's best for the layout, the week's best on the featured
// raid (the time-attack board's score)
export function raidTime(s,id,B,now){const sec=Math.max(.1,Math.round((Number(B?.time)||0)*10)/10);s.settlement.sec=sec;s.rbest=record(s.rbest)?s.rbest:{};if(!(s.rbest[id]>0)||sec<s.rbest[id])s.rbest[id]=sec;
 const w=weekOf(now);if(id===featuredRaid(now)&&(!s.rtb||s.rtb.w!==w||s.rtb.id!==id||sec<s.rtb.sec))s.rtb={w,id,sec};}
