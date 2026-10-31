import {readEco} from './eco.js';
import {reconcilePayments} from './payment-ledger.js';
import {settleChainOrder} from './chain-payments.js';
// A per-canonical-account durable wakeup, written before any new payment mutation.
// Each alarm performs ONE bounded unit. No global account scans or silent expiry.
export class PaymentJob {
 constructor(state,env){this.state=state;this.env=env;}
 async fetch(req){
  const {pid}=await req.json();if(!/^(tg|ln)_\d{3,15}$/.test(pid))return new Response('buyer',{status:400});
  await this.state.storage.transaction(async s=>{const old=await s.get('pid');if(old&&old!==pid)throw Error('owner');await s.put('pid',pid);await s.setAlarm(Date.now()+30000);});
  return Response.json({ok:true});
 }
 async alarm(){
  const pid=await this.state.storage.get('pid');if(!pid)return;
  // Re-arm first. Even a lost completion/error response cannot drop recovery.
  await this.state.storage.setAlarm(Date.now()+60000);
  try{
   const S=await readEco(this.env,pid);
   if(Object.keys(S.paymentPending||{}).length){await reconcilePayments(this.env,pid,S);return;}
   const orders=Object.values(S.tonOrders||{}).filter(o=>!S.chainReceipts?.[o.id]&&o.revc!==undefined);
   if(orders.length){const n=(await this.state.storage.get('cursor'))||0;await settleChainOrder(this.env,pid,orders[n%orders.length].id);await this.state.storage.put('cursor',n+1);return;}
   // Stay scheduled at low frequency so a crash between wake and account commit
   // cannot race an empty-account check and permanently lose the new intent.
   await this.state.storage.setAlarm(Date.now()+6*3600000);
  }catch(e){await this.state.storage.put('lastError',{at:Date.now(),error:String(e.message).slice(0,160)});}
 }
}
