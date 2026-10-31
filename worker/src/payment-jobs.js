import {dbGet,dbPatch,hex,hmac,dayOf} from './db.js';
import {readEco,tx,link} from './eco.js';
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
   const wallet=Object.entries(S.paymentWalletPending||{})[0];
   if(wallet){
    const [id,payer]=wallet;
    if(!this.env.BOT_TOKEN)throw Error('wallet index requires configured identity hash key');
    const hash=hex(await hmac(this.env.BOT_TOKEN,'w|'+payer)).slice(0,16);
    const others=await dbGet(this.env,'wal/'+hash)||{};
    for(const other of Object.keys(others).slice(0,20))if(other!==pid)await link(this.env,pid,other,'wallet');
    if(!await dbPatch(this.env,'wal/'+hash,{[pid]:dayOf(Date.now())}))throw Error('wallet index write');
    await tx(this.env,pid,C=>{if(C.paymentWalletPending?.[id]===payer)delete C.paymentWalletPending[id];return {};});return;
   }
   const orders=Object.values(S.tonOrders||{}).filter(o=>!S.chainReceipts?.[o.id]&&o.revc!==undefined);
   if(orders.length){const age=Date.now()-Math.min(...orders.map(o=>o.created));await this.state.storage.setAlarm(Date.now()+(age>7*86400000?6*3600000:age>86400000?3600000:age>900000?300000:60000));const n=(await this.state.storage.get('cursor'))||0;await settleChainOrder(this.env,pid,orders[n%orders.length].id);await this.state.storage.put('cursor',n+1);return;}
   // Stay scheduled at low frequency so a crash between wake and account commit
   // cannot race an empty-account check and permanently lose the new intent.
   await this.state.storage.setAlarm(Date.now()+6*3600000);
  }catch(e){await this.state.storage.put('lastError',{at:Date.now(),error:String(e.message).slice(0,160)});}
 }
}
