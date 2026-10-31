import {readEco,tx} from './eco.js';
import {reconcilePayments} from './payment-ledger.js';
import {hex} from './db.js';
export async function paymentOps(env,actor,b,now=Date.now()){
 let allowed;try{allowed=JSON.parse(env.PAYMENT_OPERATOR_PIDS||'[]');}catch{return {error:'unavailable'};}
 if(env.PAYMENT_OPS_ENABLED!=='1'||!Array.isArray(allowed)||!allowed.includes(actor))return {error:'forbidden'};
 if(!/^(tg|ln)_\d{3,15}$/.test(b.buyer)||!['reconcile','note'].includes(b.action)||typeof b.reason!=='string'||b.reason.length<8||b.reason.length>240)return {error:'request'};
 const S=await readEco(env,b.buyer);
 const plan={actor,buyer:b.buyer,action:b.action,reason:b.reason,seq:S.paymentSeq||0,revision:S.rev||0};
 const confirm=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(plan))));
 const pending=Object.entries(S.paymentPending||{}).map(([key,v])=>({key,type:v.type,id:v.id,version:v.v}));
 if(b.dryRun!==false)return {dryRun:true,plan,confirm,pending,held:[...Object.entries(S.starReceipts||{}),...Object.entries(S.chainReceipts||{})].filter(([,r])=>r.held&&!r.rf&&!r.refunded).map(([id,r])=>({id,held:r.held}))};
 if(b.confirm!==confirm)return {error:'stale_confirmation'};
 const started=await tx(env,b.buyer,C=>{
  if((C.rev||0)!==plan.revision)return {abort:true,error:'stale_confirmation'};
  C.paymentAudit=C.paymentAudit||{};
  if(Object.keys(C.paymentAudit).length>=100)return {abort:true,error:'audit_capacity'};
  C.paymentAudit[confirm]={...plan,at:now,state:'authorized'};return {ok:true};
 },now);
 if(started.error)return {error:started.error};
 if(b.action==='reconcile')await reconcilePayments(env,b.buyer,await readEco(env,b.buyer),now);
 await tx(env,b.buyer,C=>{C.paymentAudit[confirm].state='completed';return {};},now);
 return {ok:true,audit:confirm};
}
