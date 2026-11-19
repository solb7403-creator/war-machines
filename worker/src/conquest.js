// Conquest has its own versioned Firebase record and CAS boundary, separate from eco/airdrop.
import {syncWarfront,persistWarfront,applyWarfront} from './conquest-warfront.js';
import {COSMETIC_ACTIONS} from './conquest-cosmetics.js';
import {BASE_ACTIONS} from './conquest-campaign.js';
import {PLOT_ACTIONS,MINERAL_PLOT_ACTIONS,BIG_PLOT_ACTIONS} from './conquest-plot.js';
import {readEco,readTag,writeIf,creditConquest} from './eco.js';
import {seal,due,pending,acknowledge,airdrop} from './conquest-airdrop.js';
import {RULES} from './sim.gen.js';
import {hex} from './db.js';
import {transaction as store,split as splitState,sweep,COLD_KEYS} from './conquest-store.js';
import {createState,applyCommands,applyAction,validateCommands,refreshState,refitState,TRAVEL_ACTIONS,LOOT_ACTIONS} from './conquest-sim.js';
import {RESEARCH_ACTIONS,account as researchAccount} from './conquest-research.js';
import {BAT_ACTIONS,account as batAccount,gearOf,field as batField} from './conquest-battalion.js';
const allowed=(b,keys)=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).every(k=>keys.includes(k));
const response=(status,error,state)=>({status,body:{error,...(state?{state:publicState(state)}:{})}});
import {publicVeins} from './conquest-veins.js';
import {entered,takeQueue,flush,clientEvent} from './conquest-analytics.js';
import {publishBase} from './conquest-visit.js';
import {cleanName} from './db.js';
import {isOwner,OWNER_PID,OWNER_ADMIN} from './owner.js';
// Owner dev mode (owner request, Nov 8 2026): unlimited Conquest resources on the owner's own account only, so he can build
// and feel the whole base. Exactly one account: OWNER_PID, re-verified with isOwner (pinned Telegram admin + linked account)
// on every request. While ON, costs are checked against an unlimited balance and never deducted; everything earned (CP,
// materials, production) is kept. Once ever turned ON, the record is a test record: no Conquest airdrop points (earn()),
// and the base stays off the top 20 and Base of the Week (publishBase). Minerals, wallet and account are never minted.
export const DEV_ACTIONS=['dev-on','dev-off','dev-finish'];
const UNLIMITED=1e9;
export function unlimited(previous,run){const q=structuredClone(previous),L0=previous.ledger||{cp:0,banked:{}},mn0=previous.plot?.mnSpent||{},cm0=previous.plot?.cm,fh0=previous.plot?.fh,ext0=previous.plot?.ext?structuredClone(previous.plot.ext):undefined;
 const keys=new Set([...Object.keys(L0.banked||{}),'alloy','biomass','helium']);q.ledger.cp=UNLIMITED;q.ledger.banked=Object.fromEntries([...keys].map(k=>[k,UNLIMITED]));
 // Session 5B: unlimited wall composite and the full +50% wall extension while dev mode is on (restored afterwards)
 if(q.plot){q.plot.cm=UNLIMITED;q.plot.devx=1;}
 const s=run(q);
 if(s.plot){delete s.plot.devx;if(cm0!==undefined)s.plot.cm=cm0;else if(s.plot.cm>=UNLIMITED/2)s.plot.cm=200;if(fh0!==undefined)s.plot.fh=fh0;else s.plot.fh=0;if(ext0!==undefined)s.plot.ext=ext0;}   // research and drill milestones made in dev mode do not persist (dev mode already gives the full +50%)   // a plot claimed in this request starts with the normal 200
 // gains this request made (bank, collect, production) are kept; nothing this request spent leaves the real balance
 s.ledger.cp=(L0.cp||0)+Math.max(0,s.ledger.cp-UNLIMITED);for(const k of Object.keys(s.ledger.banked||{}))s.ledger.banked[k]=(L0.banked?.[k]||0)+Math.max(0,s.ledger.banked[k]-(keys.has(k)?UNLIMITED:0));
 if(s.plot)s.plot.mnSpent={...mn0};   // base-store minerals: exactly what was really spent before (no spend, no refund)
 return s;}
// Dev mode builds are instant (owner, Nov 8: "get rid of the countdown for testing"): the builder's job completes in the same request.
function instant(s,now){if(s?.plot?.job){s.plot.job.ready=now;refreshState(s,now);}return s;}
export function devAction(previous,r,now){if(previous?.v!==1||r.seq!==previous.seq+1)throw Error('conquest: stale sequence');if(!Number.isSafeInteger(now)||now<previous.lastWall)throw Error('conquest: invalid server clock');
 const s=structuredClone(previous);
 if(r.action==='dev-on'){s.dev={on:1,used:1,at:now};instant(s,now);}
 else if(r.action==='dev-off')s.dev={...(s.dev||{}),on:0,used:1};
 else{if(!s.dev?.on)throw Error('conquest: dev mode is off');if(!s.plot?.job)throw Error('conquest: nothing is building');s.plot.job.ready=now;refreshState(s,now);}
 s.notice={kind:'dev',action:r.action};s.seq=r.seq;return s;}
// Server-only fields never leave the Worker: the vein seed and unscanned veins (s.lodes) become the scanned-only s.veins view.
// lseed: the loot seed (Session 6) never leaves the Worker either.
export function publicState(s){const {lastDigest,rate,raidRoll,raidReceipts,lodes,lseed,...out}=s;if(s.base)out.base={...s.base,modules:s.base.modules||{}};out.veins=publicVeins(s,s.lastWall||0);
 // Meteor Strike core rolls stay server-side until the strike is secured; the client only needs whether a slot is claimed.
 if(s.strikes&&typeof s.strikes==='object')out.strikes=Object.fromEntries(Object.entries(s.strikes).map(([k,v])=>[k,{claimed:v?.claimed?1:0}]));return out;}
// Session 6C: the record is split (worker/src/conquest-store.js): the hot part is the CAS document, the cold part an immutable blob
// named by it. fn sees the whole state exactly as before; the per-minute request limit is checked on the result, as before.
async function transaction(env,pid,fn,now){
 return store(env,pid,fn,(state,h)=>{const m=Math.floor(now/60000);state.rate=state.rate?.m===m?state.rate:{m,n:0};if(++state.rate.n>90)return {abort:true,error:'rate',status:429,state:h};return null;});
}
export function passPremium(S,now){return S?.pass?.prem===true&&S.pass.s===RULES.ecoSeason({day:Math.floor(now/86400000)});}
// Bounded per-isolate cache so repeated recall taps cost no extra account reads; read errors fail closed and are not cached.
const premiumCaches=new WeakMap();
async function premiumPass(env,pid,now){const cache=premiumCaches.get(env)||new Map();premiumCaches.set(env,cache);const hit=cache.get(pid);if(hit&&now-hit.at<60000)return hit.value;let value;try{value=passPremium(await readEco(env,pid),now);}catch{return false;}if(cache.size>=5000)cache.delete(cache.keys().next().value);cache.set(pid,{at:now,value});return value;}
async function canonical(env,pid,now=Date.now()){const S=await readEco(env,pid);if(S.mig===0)throw Error('finish account migration');const day=Math.floor(now/86400000),lgi=S.lgi|0;
 // The HUD's airdrop numbers come from the account on every session open (today's points across all modes, league pay).
 const loadout=S.lab?RULES.labLoadout(S):RULES.ecoLoadout(S,S.L);return {loadout,legacy:S.cqState?.v===1?S.cqState:null,rsAcct:researchCtx(S,now),batAcct:batCtx(S,loadout),view:{d:day,dailyPts:S.dailyDay===day?S.dailyPts||0:0,cap:RULES.DAILY_CAP,cq:S.cqd?.d===day?S.cqd.b||0:0,lgi,pay:RULES.LG_BASE_PAY[lgi]||1,at:now,mn:RULES.mnOf(S.mn),ap:RULES.apOf(S.ap),pts:Math.max(0,Math.round(Number(S.pts)||0)),bmn:RULES.mnOf(S.bmn),rm:Object.keys(S.rm||{}).filter(k=>S.rm[k])}};}
// Session 6B: what research reads from the account (eco record): bonus parts (Lunar Pass premium tiers, part packs), instant-finish
// credits (written only by a verified purchase; checkout is off until Session 8) and the current season's premium pass (slot + 25%).
function researchCtx(S,now){const prem=RULES.passResearch(passPremium(S,now));   /* the pass's research perks wait for the Lab store (rules.js passResearch) */return {bpt:{...(S.bpt||{})},bch:Math.max(0,S.bch|0),rsx:{...(S.rsx||{})},lsm:{...(S.lsm||{})},prem:prem?1:0,premium:prem};}
// Session 6C: what the battalion reads from the account (eco record): its owned weapons and chassis (AUTO-ARM's spare gear), the
// liveries it owns and the RECRUIT instant-finish credits (written only by a verified purchase; checkout is off until Session 8)
function batCtx(S,loadout){return {gear:gearOf(S,loadout),liv:{...(S.liv||{})},rcx:{...(S.rcx||{})}};}   // lsm: the Legendary set mods bought (a bought one is never researched)
async function projected(env,pid,r,now){if(r.state&&!r.error){try{const war=await syncWarfront(env,pid,r.state.campaignScore||0,now),key=war.id+':'+war.stage;
 if(!r.state.warfront||war.stage>(r.state.warfront.stage||0)||war.stage>0&&!r.state.campaignHistory?.[key]){const saved=await persistWarfront(env,pid,war,now);if(saved){r.state.campaignHistory=saved.campaignHistory;r.state.achievements=saved.achievements;}}
 applyWarfront(r.state,war,now);
 }catch{r.state.warfront={...r.state.warfront,pending:true};}}return result(r);}
// Conquest airdrop points (docs/economy/RESOURCE_ECONOMY.md §3.5): the committed Conquest record's immutable outbox
// entries are credited to the account exactly once (eco.cqw watermark, same account CAS), then dropped here. A failed or
// busy account write leaves them pending for the next request or session open; nothing earned is lost.
async function settleAirdrop(env,pid,r,now,force=false){
 const s=r.state;if(!s||s.v!==1||r.error||!(force?pending(s).length:due(s,now)))return r;
 let c;try{c=await creditConquest(env,pid,pending(s),now);}catch{return r;}
 const view={d:c.day,dailyPts:c.dailyPts,cap:RULES.DAILY_CAP,cq:c.cqToday,lgi:c.lgi,pay:c.pay,at:now,mn:c.mn,ap:c.ap,pts:c.pts,rm:c.rm||[]};
 // Prune with its own CAS loop: server bookkeeping, not a pilot request (never counts against the request rate limit).
 for(let i=0;i<8;i++){const {v,tag}=await readTag(env,'conquest/'+pid);if(!v||v.v!==1)break;const cur=structuredClone(v);acknowledge(cur,c.cqw,view);if(await writeIf(env,'conquest/'+pid,cur,tag))break;}   // the outbox rides the hot part (conquest-store.js): this prune never touches the cold blob
 acknowledge(s,c.cqw,view);s.airdrop.credit={base:c.base,awarded:c.awarded,capped:c.capped,at:now,...(Object.keys(c.minerals||{}).length?{minerals:c.minerals}:{})};return r;}
function result(r){return r.error?response(r.status||409,r.error,r.state):{status:200,body:{ok:true,state:publicState(r.state),replayed:!!r.replayed}};}
// Session 6C: an input reply carries the hot part only when nothing cold changed and the phone already holds this cold version
// (it sends the cv it has); the phone keeps its cold fields (js/conquest/session.js). Every other reply is the whole state.
export function publicHot(s){const {hot}=splitState(s),{lastDigest,rate,raidRoll,...out}=hot;if(s.base)out.base={...s.base,modules:s.base.modules||{}};return out;}
export async function conquestSession(env,a,now=Date.now()){
 if(!allowed(a.b,['gv','initData']))return response(400,'invalid conquest session');
 const {loadout:L,legacy,view,rsAcct,batAcct}=await canonical(env,a.pid,now);
 const r0=await transaction(env,a.pid,s=>{if(s&&s.v!==1)return {abort:true,error:'unsupported conquest state'};const away=!s||now-(s.lastWall||0)>60000,state=s||legacy||createState(L,now);if(state.chain&&away)delete state.chain;entered(state,now,away);   /* Session 6: the Sortie chain ends when the pilot left Conquest (a reconnect inside a minute keeps it) */refreshState(state,now);researchAccount(state,rsAcct,now);batAccount(state,batAcct,now);if(!state.mission)batField(state,state.battle,state.position,'wing');refitState(state,L);seal(state,now);airdrop(state).view=view;const anq=takeQueue(state);return {state,anq};},now);
 if(!r0.abort&&r0.cv)await sweep(env,a.pid,r0.cv,r0.cvn,now);   // Session 6C: orphan cold blobs (an attempt that died between its blob and its CAS), throttled
 if(!r0.abort&&r0.anq?.length)await flush(env,r0.anq,r0.state?.an?.f,now);   // Session 6 analytics: entry, cohort and return, after the write
 const out=await projected(env,a.pid,await settleAirdrop(env,a.pid,r0,now,true),now);if(out.status===200&&r0.cv)out.body.cv=r0.cv;   // Session 6C: the cold version the phone now holds
 if(out.status===200&&out.body?.state?.plot)await publishBase(env,a.pid,cleanName(a.user),out.body.state,now).catch(()=>{});   // builder jobs settle on open
 return out;
}
async function submit(env,a,request,reduce,now,cv=null){
 const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(request))));
 const r=await transaction(env,a.pid,previous=>{
  if(previous?.v!==1)return {abort:true,error:'open conquest session first'};
  if(request.seq===previous.seq){if(digest===previous.lastDigest)return {abort:true,state:previous,replayed:true};return {abort:true,error:'sequence already used',state:previous};}
  try{const state=reduce(previous,request,now);seal(state,now);state.lastDigest=digest;const anq=takeQueue(state);return {state,anq};}catch(e){return {abort:true,error:String(e.message).slice(0,120),state:previous};}
 },now);if(!r.abort&&r.anq?.length)await flush(env,r.anq,r.state?.an?.f,now);   // Session 6 analytics: counted only after the CAS write
 const out=await projected(env,a.pid,await settleAirdrop(env,a.pid,r,now),now);
 if(out.status===200&&r.state){const hcv=r.cv;if(hcv){out.body.cv=hcv;if(cv&&cv===hcv&&!r.cold&&!r.replayed){const st=out.body.state;out.body.hot=publicHot(r.state);if(st?.warfront)out.body.hot.warfront=st.warfront;if(st?.airdrop)out.body.hot.airdrop=st.airdrop;delete out.body.state;}}}
 return out;
}
// Session 6 analytics: the phone's screen events (the opening radio, where a session ended, its length). Fixed enums only.
export async function conquestEvent(env,a,now=Date.now()){if(!allowed(a.b,['gv','initData','e','k']))return response(400,'invalid event');const q=clientEvent(a.b,a.pid,now);if(q)await flush(env,q,null,now);return {status:200,body:{ok:true}};}
export async function conquestInput(env,a,now=Date.now()){
 if(!allowed(a.b,['gv','initData','seq','commands','cv'])||!Number.isSafeInteger(a.b.seq)||a.b.seq<1||a.b.cv!==undefined&&(typeof a.b.cv!=='string'||a.b.cv.length>40))return response(400,'invalid conquest input');
 let commands;try{commands=validateCommands(a.b.commands);}catch{return response(400,'invalid conquest command');}
 return submit(env,a,{seq:a.b.seq,commands},applyCommands,now,a.b.cv||null);
}
export async function conquestAction(env,a,now=Date.now()){
 if(a.b&&DEV_ACTIONS.includes(a.b.action)){
  if(!allowed(a.b,['gv','initData','seq','action'])||!Number.isSafeInteger(a.b.seq)||a.b.seq<1)return response(400,'invalid conquest action fields');
  if(a.pid!==OWNER_PID||!(await isOwner(env,a,[OWNER_ADMIN])))return response(403,'owner only');
  return submit(env,a,{seq:a.b.seq,action:a.b.action},devAction,now);}
 if(!allowed(a.b,['gv','initData','seq','action','upgrade','tuning','position','mission','module','item','slot','destination','plot','order','mod','bat'])||!Number.isSafeInteger(a.b.seq)||a.b.seq<1||!['start-mission','return-exploration','bank','repair','respawn','recover','buy-upgrade','set-tuning',...BASE_ACTIONS,...COSMETIC_ACTIONS,...PLOT_ACTIONS,'start-defense','start-sector-defense',...TRAVEL_ACTIONS,...LOOT_ACTIONS,...RESEARCH_ACTIONS,...BAT_ACTIONS].includes(a.b.action))return response(400,'invalid conquest action');
 if(a.b.bat!==undefined&&JSON.stringify(a.b.bat).length>600)return response(400,'invalid conquest action fields');
 if(!['buy-upgrade','set-tuning','start-mission','base-module','defense-config','start-sector-defense','fast-travel','build-base',...COSMETIC_ACTIONS,...PLOT_ACTIONS,...LOOT_ACTIONS,...RESEARCH_ACTIONS,...BAT_ACTIONS].includes(a.b.action)&&Object.keys(a.b).some(k=>!['gv','initData','seq','action'].includes(k)))return response(400,'invalid conquest action fields');
 if(a.b.plot!==undefined&&JSON.stringify(a.b.plot).length>(BIG_PLOT_ACTIONS.includes(a.b.action)?9000:2400))return response(400,'invalid conquest action fields');
 const request={seq:a.b.seq,action:a.b.action};for(const key of ['upgrade','tuning','position','mission','module','item','slot','destination','plot','order','mod','bat'])if(Object.prototype.hasOwnProperty.call(a.b,key))request[key]=a.b[key];
 // Recall cooldown depends on the account's current-season premium Lunar Pass, read server-side from the eco record.
 // Base stores (Session 5): mineral costs read the account's moved-to-base total (monotonic) once per such action.
 const ctx=a.b.action==='recall-start'?{premium:await premiumPass(env,a.pid,now)}:MINERAL_PLOT_ACTIONS.includes(a.b.action)?{bmn:RULES.mnOf((await readEco(env,a.pid)).bmn)}:RESEARCH_ACTIONS.includes(a.b.action)?researchCtx(RULES.ecoNorm(await readEco(env,a.pid)),now):['hangar-arm','hangar-livery'].includes(a.b.action)?await (async()=>{const S=RULES.ecoNorm(await readEco(env,a.pid));return batCtx(S,S.lab?RULES.labLoadout(S):RULES.ecoLoadout(S,S.L));})():{};   /* Session 6C: AUTO-ARM and liveries read the account once */   /* Session 6B: research reads the account once (bonus parts, finish credits, premium pass) */const owner=a.pid===OWNER_PID&&await isOwner(env,a,[OWNER_ADMIN]).catch(()=>false);
 const out=await submit(env,a,request,(p,r,n)=>owner&&p?.dev?.on?unlimited(p,q=>instant(applyAction(q,r,n,{...ctx,bmn:Object.fromEntries(Object.keys(RULES.mnOf({})).map(k=>[k,9e6]))}),n)):applyAction(p,r,n,ctx),now);
 // Session 5: publish the plot's public snapshot (visits, top 20, Base of the Week) after a verified plot change. Best effort.
 if(out.status===200&&out.body?.state?.plot&&!out.body.replayed&&(PLOT_ACTIONS.includes(a.b.action)||['build-base','upgrade-base','base-module'].includes(a.b.action)))await publishBase(env,a.pid,cleanName(a.user),out.body.state,now).catch(()=>{});
 return out;
}
