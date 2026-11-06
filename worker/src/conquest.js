// Conquest has its own versioned Firebase record and CAS boundary, separate from eco/airdrop.
import {syncWarfront,persistWarfront,applyWarfront} from './conquest-warfront.js';
import {COSMETIC_ACTIONS} from './conquest-cosmetics.js';
import {BASE_ACTIONS} from './conquest-campaign.js';
import {readEco,readTag,writeIf} from './eco.js';
import {RULES} from './sim.gen.js';
import {hex} from './db.js';
import {createState,applyCommands,applyAction,validateCommands,refreshState,refitState,TRAVEL_ACTIONS} from './conquest-sim.js';
const allowed=(b,keys)=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).every(k=>keys.includes(k));
const response=(status,error,state)=>({status,body:{error,...(state?{state:publicState(state)}:{})}});
function publicState(s){const {lastDigest,rate,raidRoll,raidReceipts,...out}=s;if(s.base)out.base={...s.base,modules:s.base.modules||{}};return out;}
async function transaction(env,pid,fn,now){
 const path='conquest/'+pid;
 for(let i=0;i<8;i++){const {v,tag}=await readTag(env,path);const s=v?structuredClone(v):null;const r=await fn(s);if(r.abort)return r;
 const state=r.state,m=Math.floor(now/60000);state.rate=state.rate?.m===m?state.rate:{m,n:0};if(++state.rate.n>90)return {abort:true,error:'rate',status:429,state:v};
 if(await writeIf(env,path,state,tag))return r;}
 throw Error('conquest busy');
}
export function passPremium(S,now){return S?.pass?.prem===true&&S.pass.s===RULES.ecoSeason({day:Math.floor(now/86400000)});}
async function premiumPass(env,pid,now){try{return passPremium(await readEco(env,pid),now);}catch{return false;}}
async function canonical(env,pid){const S=await readEco(env,pid);if(S.mig===0)throw Error('finish account migration');return {loadout:S.lab?RULES.labLoadout(S):RULES.ecoLoadout(S,S.L),legacy:S.cqState?.v===1?S.cqState:null};}
async function projected(env,pid,r,now){if(r.state&&!r.error){try{const war=await syncWarfront(env,pid,r.state.campaignScore||0,now),key=war.id+':'+war.stage;
 if(!r.state.warfront||war.stage>(r.state.warfront.stage||0)||war.stage>0&&!r.state.campaignHistory?.[key]){const saved=await persistWarfront(env,pid,war,now);if(saved){r.state.campaignHistory=saved.campaignHistory;r.state.achievements=saved.achievements;}}
 applyWarfront(r.state,war,now);
 }catch{r.state.warfront={...r.state.warfront,pending:true};}}return result(r);}
function result(r){return r.error?response(r.status||409,r.error,r.state):{status:200,body:{ok:true,state:publicState(r.state),replayed:!!r.replayed}};}
export async function conquestSession(env,a,now=Date.now()){
 if(!allowed(a.b,['gv','initData']))return response(400,'invalid conquest session');
 const {loadout:L,legacy}=await canonical(env,a.pid);
 return projected(env,a.pid,await transaction(env,a.pid,s=>{if(s&&s.v!==1)return {abort:true,error:'unsupported conquest state'};const state=s||legacy||createState(L,now);refreshState(state,now);refitState(state,L);return {state};},now),now);
}
async function submit(env,a,request,reduce,now){
 const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(request))));
 const r=await transaction(env,a.pid,previous=>{
  if(previous?.v!==1)return {abort:true,error:'open conquest session first'};
  if(request.seq===previous.seq){if(digest===previous.lastDigest)return {abort:true,state:previous,replayed:true};return {abort:true,error:'sequence already used',state:previous};}
  try{const state=reduce(previous,request,now);state.lastDigest=digest;return {state};}catch(e){return {abort:true,error:String(e.message).slice(0,120),state:previous};}
 },now);return projected(env,a.pid,r,now);
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
