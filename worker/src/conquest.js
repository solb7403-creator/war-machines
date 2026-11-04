// Conquest state lives alongside the server-owned account in one Firebase ETag write.
// A retry or a second tab cannot apply an input batch twice. No client outcomes enter this path.
import {tx,setLoadout} from './eco.js';
import {hex} from './db.js';
import {createState,applyCommands,applyAction,validateCommands} from './conquest-sim.js';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function allowed(body,keys){return body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).every(k=>keys.includes(k));}
const response=(status,error)=>({status,body:{error}});
const publicState=s=>{const {lastDigest,...state}=s;return state;};
function result(r){
 if(r.rate)return response(429,'rate');
 if(r.error)return response(r.status||409,r.error);
 return {status:200,body:{ok:true,state:publicState(r.state),replayed:!!r.replayed}};
}
export async function conquestSession(env,a,now=Date.now()){
 if(!allowed(a.b,['gv','initData']))return response(400,'invalid conquest session');
 return result(await tx(env,a.pid,S=>{
  if(S.mig===0)return {abort:true,error:'finish account migration'};
  if(S.cqState?.v===1)return {abort:true,state:S.cqState};
  if(S.cqState)return {abort:true,error:'unsupported conquest state'};
  const loadout=setLoadout(S,S.L);S.cqState=createState(loadout,now);
  return {state:S.cqState};
 },now,{rl:true}));
}
export async function conquestInput(env,a,now=Date.now()){
 if(!allowed(a.b,['gv','initData','seq','commands'])||!own(a.b,'seq'))return response(400,'invalid conquest input');
 let commands;
 try{commands=validateCommands(a.b.commands);}catch{return response(400,'invalid conquest command');}
 if(!Number.isSafeInteger(a.b.seq)||a.b.seq<1)return response(400,'invalid conquest sequence');
 const request={seq:a.b.seq,commands};
 const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(request))));
 return result(await tx(env,a.pid,S=>{
  const previous=S.cqState;
  if(previous?.v!==1)return {abort:true,error:'open conquest session first'};
  if(request.seq===previous.seq){
   if(digest===previous.lastDigest)return {abort:true,state:previous,replayed:true};
   return {abort:true,error:'sequence already used'};
  }
  try{S.cqState=applyCommands(previous,request,now);}catch(e){return {abort:true,error:String(e.message).slice(0,100)};}
  S.cqState.lastDigest=digest;return {state:S.cqState};
 },now,{rl:true}));
}

export async function conquestAction(env,a,now=Date.now()){
 if(!allowed(a.b,['gv','initData','seq','action'])||!Number.isSafeInteger(a.b.seq)||a.b.seq<1||!['start-mission','return-exploration'].includes(a.b.action))return response(400,'invalid conquest action');
 const request={seq:a.b.seq,action:a.b.action},digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(request))));
 return result(await tx(env,a.pid,S=>{
  const previous=S.cqState;if(previous?.v!==1)return {abort:true,error:'open conquest session first'};
  if(request.seq===previous.seq){if(digest===previous.lastDigest)return {abort:true,state:previous,replayed:true};return {abort:true,error:'sequence already used'};}
  try{S.cqState=applyAction(previous,request,now);}catch(e){return {abort:true,error:String(e.message).slice(0,100)};}
  S.cqState.lastDigest=digest;return {state:S.cqState};
 },now,{rl:true}));
}
