// Conquest airdrop points (docs/economy/RESOURCE_ECONOMY.md §3). Runs inside the Conquest CAS transaction only.
// A verified outcome adds raw points (value x Command Base multiplier) to this request's accumulator; seal() turns the
// accumulator into ONE immutable outbox entry with a monotonic id. The account side (eco.js creditConquest) credits each
// entry once, by id, against its own watermark (eco.cqw) written in the same account CAS. Entries are never changed after
// they are written, so a credit racing a new request can never lose or double-count points.
import {RULES as R} from './sim.gen.js';
export const OUTBOX_MAX=64;        // pending entries kept; outcomes beyond wait in a spill the account side never reads
export const CREDIT_AFTER_MS=20000;// pending entries are credited once the oldest is this old (or an operation completes)
export const CREDIT_BATCH=8;       // ... or this many entries are pending
const DAY=86400000,list=v=>Array.isArray(v)?v.filter(Boolean):v&&typeof v==='object'?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(Boolean):[];
const tally=(into,n)=>{for(const [k,v] of Object.entries(n||{}))into[k]=(into[k]||0)+(Number(v)||0);return into;};
// The per-pilot Conquest airdrop ledger (additive field; old records start empty). Firebase drops empty lists/maps.
export function airdrop(s){
 const a=s.airdrop&&typeof s.airdrop==='object'?s.airdrop:(s.airdrop={});
 a.seq=Number.isSafeInteger(a.seq)?a.seq:0;a.ack=Number.isSafeInteger(a.ack)?a.ack:0;a.out=list(a.out).filter(e=>Number.isSafeInteger(e.id)&&e.id>a.ack);
 a.hr=a.hr&&typeof a.hr==='object'?a.hr:{h:0,n:0};a.ms=Math.max(0,Number(a.ms)||0);if(a.view&&typeof a.view!=='object')delete a.view;return a;}
const multiplier=s=>R.CQ_BASE_MULT[Math.max(0,Math.min(R.CQ_BASE_MULT.length-1,s.base?.tier|0))];
// One verified points-paying outcome. kind: kill | field | raid | defense | effort | yield (| gather | strike later).
// op: an operation completed (counts as the day's verified activity and as a verified referral play day).
// act: another verified activity (a harvest): releases the day's Daily Base Yield points, not a referral day.
// flat: the value is already final (the Daily Base Yield table is per tier; no Command Base multiplier on top).
export function earn(s,kind,value,now,{op=false,act=false,flat=false}={}){
 if(s.dev?.used)return 0;   // owner dev-mode test record: never earns airdrop points (conquest.js DEV_ACTIONS)
 const a=airdrop(s),h=Math.floor(now/3600000),v=Math.max(0,Number(value)||0);if(!v)return 0;
 if(a.hr.h!==h)a.hr={h,n:0};if(op||act){const d=Math.floor(now/DAY);a.act=d;const y=a.yd&&a.yd.d===d?a.yd:(a.yd={d,op:0,hv:0});if(op)y.op++;else y.hv++;}   // verified activity counts even when the points are rate-limited; Session 6: yd counts the day's operations and harvests (Daily Base Yield steps)
 if(a.hr.n>=R.CQ_PTS.hourMax){a.limited=(a.limited||0)+1;return 0;}   // rate limit: no points beyond the hourly outcome limit
 a.hr.n++;const raw=Math.round(v*(flat?1:multiplier(s))*100)/100,p=a.pend||(a.pend={raw:0,n:{},op:0});
 p.raw=Math.round((p.raw+raw)*100)/100;p.n[kind]=(p.n[kind]||0)+1;if(op)p.op=1;
 return raw;}
// The day's first verified operation releases the Daily Base Yield's points part (no pure AFK points).
export const activeToday=(s,now)=>airdrop(s).act===Math.floor(now/DAY);
// Kills inside an operation are paid by its completion. If the operation fails, retreats or the pilot dies, the verified
// kills inside it are paid instead (world rate), so a lost fight still counts. Reinforcement waves never reach here.
export function opKill(s,value){const a=airdrop(s),k=a.opk&&a.opk.attempt===s.attempt?a.opk:(a.opk={attempt:s.attempt||0,v:0,n:0});k.v+=Math.max(0,Number(value)||0);k.n++;}
export function discardOpKills(s){delete airdrop(s).opk;}
export function settleOpKills(s,now){const a=airdrop(s),k=a.opk;delete a.opk;if(!k||!k.v)return 0;return earn(s,'effort',k.v,now);}
// Simulated play time (50 ms a command step) between entries: the account-side points-a-minute flag uses it.
export function played(s,ms){const a=airdrop(s);a.ms=Math.min(36e5,a.ms+Math.max(0,ms));}
// End of every Conquest transaction: this request's outcomes become one immutable entry (or wait in the spill).
export function seal(s,now){
 const a=airdrop(s),p=a.pend,m=a.pmn,rm=list(a.prm).filter(x=>typeof x==='string'),rj=list(a.prsj).filter(x=>typeof x==='string'),bt=list(a.pbty).filter(x=>typeof x?.id==='string'),fl=list(a.pfl).filter(x=>typeof x?.k==='string');delete a.pend;delete a.pmn;delete a.prm;delete a.prsj;delete a.pbty;delete a.pfl;
 if(p&&p.raw>0||m||rm.length||rj.length||bt.length||fl.length){const sp=a.spill||(a.spill={raw:0,n:{},op:0});if(bt.length)sp.bty=[...list(sp.bty),...bt].filter((x,i,arr)=>arr.findIndex(y=>y.id===x.id)===i);if(fl.length)sp.fl=[...list(sp.fl),...fl].filter((x,i,arr)=>arr.findIndex(y=>y.k===x.k)===i);/* Session 7C: fingerprint flags (cqrepeat, cqnoinput) ride the entry like a bounty */if(p&&p.raw>0){sp.raw=Math.round((sp.raw+p.raw)*100)/100;tally(sp.n,p.n);sp.op=sp.op||p.op;}if(m)sp.mn=tally(sp.mn||{},m);if(rm.length)sp.rm=[...new Set([...list(sp.rm),...rm])];if(rj.length)sp.rsj=[...new Set([...list(sp.rsj),...rj])];}
 if(a.spill&&(a.spill.raw>0||a.spill.mn||list(a.spill.rm).length||list(a.spill.rsj).length||list(a.spill.bty).length||list(a.spill.fl).length)&&a.out.length<OUTBOX_MAX){a.seq++;const e={id:a.seq,at:now,raw:a.spill.raw||0,n:a.spill.n||{},op:a.spill.op?1:0,ms:Math.round(a.ms)};if(a.spill.mn)e.mn=a.spill.mn;if(list(a.spill.rm).length)e.rm=list(a.spill.rm);if(list(a.spill.rsj).length)e.rsj=list(a.spill.rsj);if(list(a.spill.bty).length)e.bty=list(a.spill.bty).map(x=>({id:String(x.id).slice(0,8),pts:Math.max(0,Math.floor(Number(x.pts)||0))}));if(list(a.spill.fl).length)e.fl=list(a.spill.fl).map(x=>({k:String(x.k).slice(0,12),v:String(x.v||'').slice(0,90)}));a.out.push(e);a.ms=0;delete a.spill;}
 return a;}
// Session 6B: a finished Science Lab research job. The mod rides this request's immutable outbox entry (e.rm) to the account,
// where creditConquest records it once (eco S.rm); never points.
export function researchUnlock(s,id){const a=airdrop(s);a.prm=[...list(a.prm),id];}
// Session 6B finish: a Legendary set mod's research job started (its free path). It rides the same way (e.rsj) so the account marks it
// "being researched" (eco S.rsj) and the Lab store will not sell it; the finished job then arrives as e.rm (one ownership, two ways in)
export function researchLegStart(s,id){const a=airdrop(s);a.prsj=[...list(a.prsj),id];}
// Banking Conquest minerals (RESOURCE_ECONOMY.md §5.3): the carried minerals leave the cargo and ride this request's
// immutable outbox entry to the account wallet (credited once, by id, like points). Nothing is lost if the credit waits.
export function bankMinerals(s,mn){const a=airdrop(s),add={};for(const [k,v] of Object.entries(mn||{})){const n=Math.floor(Number(v)||0);if(n>0)add[k]=n;}if(Object.keys(add).length)a.pmn=tally(a.pmn||{},add);return add;}
// Whether this request should credit the account now: an operation completed, the oldest entry waited long enough, or a
// batch is pending. Everything else waits (cheaper; nothing is lost: the session open credits any leftovers).
export function due(s,now){const a=airdrop(s),out=a.out.filter(e=>e.id>a.ack);return out.length>0&&(out.some(e=>e.op||e.mn||e.rm||e.rsj||e.bty||e.fl)||out.length>=CREDIT_BATCH||now-Math.min(...out.map(e=>e.at||now))>=CREDIT_AFTER_MS);}
export const pending=s=>airdrop(s).out.filter(e=>e.id>airdrop(s).ack);
// After the account credited up to cqw: drop those entries and keep the latest account numbers for the HUD.
export function acknowledge(s,cqw,view){const a=airdrop(s);a.ack=Math.max(a.ack,cqw|0);a.seq=Math.max(a.seq|0,a.ack);a.out=a.out.filter(e=>e.id>a.ack);if(view)a.view=view;return a;}   // Session 7B (payout review W1): a record reset or restored on the server numbers its next entries past the account's watermark, so they are credited
// Estimated base points for display (the league factor last read from the account; the account credit is authoritative).
export function estimate(s,raw){const a=airdrop(s),pay=Number(a.view?.pay)||1;return Math.round((Number(raw)||0)*pay);}
// Session 7B: a Citadel tier's first-clear bounty (worker/src/conquest-citadel.js, once: the tier count only rises). It rides this request's
// immutable outbox entry (e.bty, never merged into the capped raw points); the account credits each bounty id once per account
// (rules.js ecoBounty: S.cbty, outside the daily cap). Never through earn(): no hourly limit, no Command Base multiplier, no league factor
export function bounty(s,id,pts){if(s.dev?.used)return 0;const a=airdrop(s),n=Math.max(0,Math.floor(Number(pts)||0));const m=/^cit([1-9])$/.exec(String(id));if(!m||+m[1]>R.CIT_LIVE||!n)return 0;a.pbty=[...list(a.pbty).filter(x=>x.id!==id),{id,pts:n}];return n;}
