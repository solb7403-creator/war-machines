// Conquest has its own versioned Firebase record and CAS boundary, separate from eco/airdrop.
import {syncWarfront,persistWarfront,applyWarfront} from './conquest-warfront.js';
import {COSMETIC_ACTIONS} from './conquest-cosmetics.js';
import {BASE_ACTIONS} from './conquest-campaign.js';
import {readEco,readTag,writeIf,creditConquest} from './eco.js';
import {seal,due,pending,acknowledge,airdrop} from './conquest-airdrop.js';
import {RULES} from './sim.gen.js';
import {hex} from './db.js';
import {createState,applyCommands,applyAction,validateCommands,refreshState,refitState,TRAVEL_ACTIONS} from './conquest-sim.js';
const allowed=(b,keys)=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).every(k=>keys.includes(k));
const response=(status,error,state)=>({status,body:{error,...(state?{state:publicState(state)}:{})}});
import {publicVeins} from './conquest-veins.js';
// Server-only fields never leave the Worker: the vein seed and unscanned veins (s.lodes) become the scanned-only s.veins view.
export function publicState(s){const {lastDigest,rate,raidRoll,raidReceipts,lodes,...out}=s;if(s.base)out.base={...s.base,modules:s.base.modules||{}};out.veins=publicVeins(s,s.lastWall||0);
 // Meteor Strike core rolls stay server-side until the strike is secured; the client only needs whether a slot is claimed.
 if(s.strikes&&typeof s.strikes==='object')out.strikes=Object.fromEntries(Object.entries(s.strikes).map(([k,v])=>[k,{claimed:v?.claimed?1:0}]));return out;}
async function transaction(env,pid,fn,now){
 const path='conquest/'+pid;
 for(let i=0;i<8;i++){const {v,tag}=await readTag(env,path);const s=v?structuredClone(v):null;const r=await fn(s);if(r.abort)return r;
 const state=r.state,m=Math.floor(now/60000);state.rate=state.rate?.m===m?state.rate:{m,n:0};if(++state.rate.n>90)return {abort:true,error:'rate',status:429,state:v};
 if(await writeIf(env,path,state,tag))return r;}
 throw Error('conquest busy');
}
export function passPremium(S,now){return S?.pass?.prem===true&&S.pass.s===RULES.ecoSeason({day:Math.floor(now/86400000)});}
// Bounded per-isolate cache so repeated recall taps cost no extra account reads; read errors fail closed and are not cached.
const premiumCaches=new WeakMap();
async function premiumPass(env,pid,now){const cache=premiumCaches.get(env)||new Map();premiumCaches.set(env,cache);const hit=cache.get(pid);if(hit&&now-hit.at<60000)return hit.value;let value;try{value=passPremium(await readEco(env,pid),now);}catch{return false;}if(cache.size>=5000)cache.delete(cache.keys().next().value);cache.set(pid,{at:now,value});return value;}
async function canonical(env,pid,now=Date.now()){const S=await readEco(env,pid);if(S.mig===0)throw Error('finish account migration');const day=Math.floor(now/86400000),lgi=S.lgi|0;
 // The HUD's airdrop numbers come from the account on every session open (today's points across all modes, league pay).
 return {loadout:S.lab?RULES.labLoadout(S):RULES.ecoLoadout(S,S.L),legacy:S.cqState?.v===1?S.cqState:null,view:{d:day,dailyPts:S.dailyDay===day?S.dailyPts||0:0,cap:RULES.DAILY_CAP,cq:S.cqd?.d===day?S.cqd.b||0:0,lgi,pay:RULES.LG_BASE_PAY[lgi]||1,at:now,mn:RULES.mnOf(S.mn),ap:RULES.apOf(S.ap)}};}
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
 const view={d:c.day,dailyPts:c.dailyPts,cap:RULES.DAILY_CAP,cq:c.cqToday,lgi:c.lgi,pay:c.pay,at:now,mn:c.mn,ap:c.ap};
 // Prune with its own CAS loop: server bookkeeping, not a pilot request (never counts against the request rate limit).
 for(let i=0;i<8;i++){const {v,tag}=await readTag(env,'conquest/'+pid);if(!v||v.v!==1)break;const cur=structuredClone(v);acknowledge(cur,c.cqw,view);if(await writeIf(env,'conquest/'+pid,cur,tag))break;}
 acknowledge(s,c.cqw,view);s.airdrop.credit={base:c.base,awarded:c.awarded,capped:c.capped,at:now,...(Object.keys(c.minerals||{}).length?{minerals:c.minerals}:{})};return r;}
function result(r){return r.error?response(r.status||409,r.error,r.state):{status:200,body:{ok:true,state:publicState(r.state),replayed:!!r.replayed}};}
export async function conquestSession(env,a,now=Date.now()){
 if(!allowed(a.b,['gv','initData']))return response(400,'invalid conquest session');
 const {loadout:L,legacy,view}=await canonical(env,a.pid,now);
 return projected(env,a.pid,await settleAirdrop(env,a.pid,await transaction(env,a.pid,s=>{if(s&&s.v!==1)return {abort:true,error:'unsupported conquest state'};const state=s||legacy||createState(L,now);refreshState(state,now);refitState(state,L);seal(state,now);airdrop(state).view=view;return {state};},now),now,true),now);
}
async function submit(env,a,request,reduce,now){
 const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(request))));
 const r=await transaction(env,a.pid,previous=>{
  if(previous?.v!==1)return {abort:true,error:'open conquest session first'};
  if(request.seq===previous.seq){if(digest===previous.lastDigest)return {abort:true,state:previous,replayed:true};return {abort:true,error:'sequence already used',state:previous};}
  try{const state=reduce(previous,request,now);seal(state,now);state.lastDigest=digest;return {state};}catch(e){return {abort:true,error:String(e.message).slice(0,120),state:previous};}
 },now);return projected(env,a.pid,await settleAirdrop(env,a.pid,r,now),now);
}
export async function conquestInput(env,a,now=Date.now()){
 if(!allowed(a.b,['gv','initData','seq','commands'])||!Number.isSafeInteger(a.b.seq)||a.b.seq<1)return response(400,'invalid conquest input');
 let commands;try{commands=validateCommands(a.b.commands);}catch{return response(400,'invalid conquest command');}
 return submit(env,a,{seq:a.b.seq,commands},applyCommands,now);
}
export async function conquestAction(env,a,now=Date.now()){
 if(!allowed(a.b,['gv','initData','seq','action','upgrade','tuning','position','mission','module','item','slot','destination'])||!Number.isSafeInteger(a.b.seq)||a.b.seq<1||!['start-mission','return-exploration','bank','repair','respawn','recover','buy-upgrade','set-tuning',...BASE_ACTIONS,...COSMETIC_ACTIONS,'start-defense','start-sector-defense',...TRAVEL_ACTIONS].includes(a.b.action))return response(400,'invalid conquest action');
 if(!['buy-upgrade','set-tuning','start-mission','base-module','defense-config','start-sector-defense','fast-travel',...COSMETIC_ACTIONS].includes(a.b.action)&&Object.keys(a.b).some(k=>!['gv','initData','seq','action'].includes(k)))return response(400,'invalid conquest action fields');
 const request={seq:a.b.seq,action:a.b.action};for(const key of ['upgrade','tuning','position','mission','module','item','slot','destination'])if(Object.prototype.hasOwnProperty.call(a.b,key))request[key]=a.b[key];
 // Recall cooldown depends on the account's current-season premium Lunar Pass, read server-side from the eco record.
 const ctx=a.b.action==='recall-start'?{premium:await premiumPass(env,a.pid,now)}:{};return submit(env,a,request,(p,r,n)=>applyAction(p,r,n,ctx),now);
}
