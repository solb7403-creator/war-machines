import {Address} from '@ton/core';
import {issueTonOrder,tonOrderEligible} from './ton-orders.js';
import {readEco,tx,claimOnce,setLoadout,ctxOf} from './eco.js';
import {RULES} from './sim.gen.js';
import {findChainPayment,providerJson} from './chain-providers.js';
import {paymentPending,reconcilePayments,itemLabel} from './payment-ledger.js';
import {hex} from './db.js';
export const TON_OWNER='UQAq3MBfPQ7Wqo5kL7631yEDKf2E9GOmZdhOfLUWhUiACfzu', SOL_OWNER='A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE';
const idOk=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
export const chainActive=(S,now)=>Object.values(S.tonOrders||{}).some(o=>o.expires>now&&!S.chainReceipts?.[o.id]);
export const cryptoReady=env=>env.CRYPTO_CHECKOUT_ENABLED==='test'&&env.PAYMENT_NETWORK==='testnet'||env.CRYPTO_CHECKOUT_ENABLED==='approved-mainnet'&&env.PAYMENT_NETWORK==='mainnet';
export async function wakePayments(env,pid) {
 if(!env.PAYMENTS)return; // Legacy fixtures/configurations still have account-return recovery.
 const r=await env.PAYMENTS.get(env.PAYMENTS.idFromName(pid)).fetch('https://payment/wake',{method:'POST',body:JSON.stringify({pid})});
 if(!r.ok)throw Error('payment recovery unavailable');
}
function referenceKey() {
 const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',bytes=crypto.getRandomValues(new Uint8Array(32));
 let n=BigInt('0x'+hex(bytes)),s='';while(n){s=alphabet[Number(n%58n)]+s;n/=58n;}
 for(const b of bytes){if(b)break;s='1'+s;}return s;
}
export async function issueChainOrder(env,pid,input,now=Date.now()) {
 if(!cryptoReady(env))return {error:'unavailable'};
 if(!['TON','SOL'].includes(input.currency))return {error:'currency'};
 if(!env.PAYMENTS)return {error:'recovery_unavailable'};
 const test=env.PAYMENT_NETWORK==='testnet',cur=input.currency;
 const recipient=test?(cur==='TON'?env.TON_TEST_RECIPIENT:env.SOL_TEST_RECIPIENT):(cur==='TON'?TON_OWNER:SOL_OWNER);
 if(!recipient)return {error:'recipient_configuration'};
 if(!/^(tg|ln)_\d{3,15}$/.test(pid)||!idOk(input.requestId))return {error:'request'};
 const prior=Object.values((await readEco(env,pid)).tonOrders||{}).find(o=>o.requestId===input.requestId);
 if(prior)return issueTonOrder(env,pid,input,now,{currency:cur,network:test?(cur==='TON'?'testnet':'devnet'):'mainnet',recipient});

 let p;try{p=await providerJson('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana&vs_currencies=usd');}catch{return {error:'price_unavailable'};}
 const tonUsd=p['the-open-network']?.usd,solUsd=p.solana?.usd;
 if(!Number.isFinite(tonUsd)||tonUsd<=0||cur==='SOL'&&(!Number.isFinite(solUsd)||solUsd<=0))return {error:'price_unavailable'};
 // Persist a durable alarm BEFORE issuing any payable order. It will read the
 // authoritative account after interruptions, including a lost issue response.
 await wakePayments(env,pid);
 return issueTonOrder(env,pid,input,now,{currency:cur,network:test?(cur==='TON'?'testnet':'devnet'):'mainnet',recipient,tonUsd,solUsd,...(cur==='SOL'?{reference:referenceKey()}:{})});
}
export async function inspectChainOrder(env,pid,id,now=Date.now()) {
 if(!idOk(id))return {error:'not_found'};
 const S=await readEco(env,pid),order=S.tonOrders?.[id];
 if(!order||order.buyer!==pid)return {error:'not_found'};
 const r=S.chainReceipts?.[id];
 return {order,walletAllowed:!S.chainWalletAttempt?.[id]&&!S.chainCancelled?.[id]&&!r&&now<order.expires,status:r?(r.refunded?'refunded':r.held?'review':'paid'):!tonOrderEligible(S,order,ctxOf(pid,now))?'review':now>=order.expires?'expired':S.chainCancelled?.[id]?'cancelled':'pending',...(r?{receipt:r}:{}),cancelled:!!S.chainCancelled?.[id]};
}
export async function cancelChainOrder(env,pid,id,now=Date.now()) {
 if(!idOk(id))return {error:'not_found'};
 const r=await tx(env,pid,S=>{
  if(S.tonOrders?.[id]?.buyer!==pid)return {abort:true,error:'not_found'};
  S.chainCancelled={...S.chainCancelled,[id]:now};return {ok:true};
 },now);
 // Cancellation is only a UI intent, never evidence that a wallet did not send.
 // Keep reservation until expiry; a subsequent final payment is held for review.
 return r.error?{error:r.error}:{ok:true};
}
export async function settleChainOrder(env,pid,id,signature='',now=Date.now(),lookup=findChainPayment) {
 if(signature&&!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature))return {error:'signature'};
 const view=await inspectChainOrder(env,pid,id,now);if(!view.order)return view;
 if(view.receipt){await reconcilePayments(env,pid,await readEco(env,pid),now);return view;}
 const S=await readEco(env,pid),order=view.order;
 const evidence=await lookup(order,S.chainCursors?.[id]||0,signature,now);
 if(!evidence?.proof) {
  if(Number.isSafeInteger(evidence?.cursor)&&evidence.cursor>=0 || typeof evidence?.cursor==='string'&&/^[1-9A-HJ-NP-Za-km-z]{0,88}$/.test(evidence.cursor))await tx(env,pid,C=>{C.chainCursors={...C.chainCursors,[id]:evidence.cursor};return {};},now);
  return view;
 }
 const proof=evidence.proof;
 // Defense in depth even though only the trusted provider adapter supplies proof.
 if(proof.network!==order.network||!proof.tx||!proof.payer||!Number.isSafeInteger(proof.at)||proof.at<Math.floor(order.created/1000)*1000||proof.at>now||!/^\d+$/.test(proof.amount)||BigInt(proof.amount)<=0n)return {error:'proof'};
 const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(order.network+'|'+order.currency+'|'+proof.tx)));
 const claimed=await claimOnce(env,'chainProofs/'+digest,{pid,id});
 if(!claimed.ok&&(!claimed.v||claimed.v.pid!==pid||claimed.v.id!==id))return {error:'proof_reused'};
 const done=await tx(env,pid,(C,X)=>{
  C.chainReceipts=C.chainReceipts||{};
  if(C.chainReceipts[id])return {receipt:C.chainReceipts[id]};
  const held=proof.hold|| (proof.amount!==order.amountNano?'amount':proof.at>=order.expires?'late':C.chainCancelled?.[id]?'cancelled':!tonOrderEligible(C,order,X)?'eligibility_changed':'');
  const outs=held?[]:RULES.ecoGrant(C,{...order.desc,deal:order.price.deal||null,price:order.price.ton},X);
  if(!held&&(C.lab||['respec','vault'].includes(order.desc.kind))&&C.L)setLoadout(C,C.L);
  const receipt={pid,cur:order.currency,amt:Number(proof.amount)/1e9,gram:order.price.ton,usd:order.revc/100,item:itemLabel(order.desc.kind,order.desc.tk||order.desc.id,order.desc.ri),memo:order.memo,proof:proof.tx,tx:proof.tx,t:proof.at,order:id,network:order.network,payer:proof.payer,slot:proof.slot,
   verified:!held,granted:!held,held:held||'',o:outs.filter(o=>o&&!o.none),revc:Math.round(order.revc*Number(proof.amount)/Number(order.amountNano)),revEvent:'chain_order_'+id};
  C.chainReceipts[id]=receipt;C.paymentWalletPending={...C.paymentWalletPending,[id]:proof.payer};paymentPending(C,'chain',id,'Pilot');return {receipt};
 },now);
 return {order,status:done.receipt.held?'review':'paid',receipt:done.receipt};
}
// Records an independently observed refund; NEVER constructs, signs or broadcasts
// a transfer. Only the audited operator workflow calls this after confirmation.
export async function recordChainRefund(env,pid,id,signature='',now=Date.now(),lookup=findChainPayment){
 const view=await inspectChainOrder(env,pid,id,now);if(!view.receipt)return {error:'receipt'};
 if(view.receipt.refunded)return {ok:true,duplicate:true};
 const original=view.receipt;
 const refundOrder={...view.order,recipient:original.payer,amountNano:String(Math.round(original.amt*1e9)),memo:'LWM2|REFUND|'+id,created:original.t,expires:Number.MAX_SAFE_INTEGER};
 const evidence=await lookup(refundOrder,0,signature,now),proof=evidence?.proof;
 if(!proof||proof.hold||proof.payer!==view.order.recipient && proof.payer!==normalizeTon(view.order.recipient)||proof.amount!==refundOrder.amountNano||proof.network!==view.order.network)return {error:'refund_not_finalized'};
 const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(view.order.network+'|'+view.order.currency+'|'+proof.tx)));
 const claim=await claimOnce(env,'chainProofs/'+digest,{pid,id,refund:true});
 if(!claim.ok&&(!claim.v||claim.v.pid!==pid||claim.v.id!==id||!claim.v.refund))return {error:'proof_reused'};
 await wakePayments(env,pid);
 await tx(env,pid,C=>{
  const r=C.chainReceipts[id];if(r.refunded)return {abort:true};
  if(!r.held){RULES.ecoRefund(C,view.order.desc.kind,r.o||[]);C.spendGram=Math.max(0,(C.spendGram||0)-view.order.price.ton);}
  r.refunded=true;r.verified=false;r.refundTx=proof.tx;r.refundedAt=now;paymentPending(C,'chain',id,'Pilot');return {};
 },now);
 return {ok:true};
}
function normalizeTon(value){try{return Address.parse(value).toRawString();}catch{return value;}}
// A wallet approval may have an ambiguous result. Permit one approval attempt per
// order; never infer "not sent" from a rejected promise or an app being killed.
export async function prepareChainOrder(env,pid,id,now=Date.now()){
 if(!idOk(id))return {error:'not_found'};
 const r=await tx(env,pid,(S,X)=>{
  const order=S.tonOrders?.[id];if(!order||order.buyer!==pid)return {abort:true,error:'not_found'};
  if(S.chainReceipts?.[id]||S.chainCancelled?.[id]||S.chainWalletAttempt?.[id]||now>=order.expires||!tonOrderEligible(S,order,X))return {abort:true,error:'not_payable'};
  S.chainWalletAttempt={...S.chainWalletAttempt,[id]:now};return {order};
 },now);
 return r.error?{error:r.error}:{order:r.order,prepared:true};
}
