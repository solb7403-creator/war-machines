import assert from 'node:assert/strict';
import {buildSim} from '../../../worker/build-sim.mjs';
import {makeDB} from './fakedb.mjs';
buildSim();
const P=await import('../../../worker/src/chain-payments.js').catch(()=>({}));
assert.equal(typeof P.issueChainOrder,'function','integrated issuer must exist');
const db=makeDB(),env={FIREBASE_DB_SECRET:'SECRET',BOT_TOKEN:'123:ABC',CRYPTO_CHECKOUT_ENABLED:'test',PAYMENT_NETWORK:'testnet',TON_TEST_RECIPIENT:'0:'+ '11'.repeat(32),SOL_TEST_RECIPIENT:'A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE'};
let outage=false,chainEvidence=null, rpcCalls=[];
globalThis.fetch=async(url,init={})=>{
 if(url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))return db.handle(url,init);
 if(url.startsWith('https://api.coingecko.com/'))return Response.json({'the-open-network':{usd:4},solana:{usd:100}});
 throw Error('unmocked network '+url);
};
env.PAYMENTS={idFromName:x=>x,get:()=>({fetch:async()=>Response.json({ok:true})})};
const pid='ln_1000000000001',now=Date.now(),desc={kind:'vault',tk:'chest'};
const input=(cur='TON',key='a')=>({currency:cur,desc,requestId:key.repeat(32)});
const a=await P.issueChainOrder(env,pid,input(),now);assert.ok(a.order,JSON.stringify(a));
assert.equal(a.order.buyer,pid);assert.equal(a.order.amountNano,'16000000000');
assert.equal((await P.issueChainOrder(env,pid,input('SOL','b'),now)).error,'pending');
assert.deepEqual((await P.issueChainOrder(env,pid,input(),now)).order,a.order);
assert.equal((await P.inspectChainOrder(env,'ln_1000000000002',a.order.id,now)).error,'not_found');
console.log('PASS integrated server orders and cross-currency reservation');
const C=await import('../../../worker/src/chain-providers.js');
const {beginCell}=await import('../../../worker/node_modules/@ton/core/dist/index.js');
let passed=1;
function check(name,fn){fn();passed++;console.log('PASS',name);}
const ton=a.order;
const master={last:{seqno:101}},block={workchain:-1,seqno:100,global_id:-3,root_hash:'root'};
const tonTx={account:ton.recipient,hash:'A'.repeat(43)+'=',now:Math.floor(now/1000),mc_block_seqno:100,emulated:false,
 description:{type:'ord',aborted:false,compute_ph:{success:true,exit_code:0},action:{success:true,result_code:0}},
 in_msg:{source:'0:'+'22'.repeat(32),destination:ton.recipient,value:ton.amountNano,bounced:false,message_content:{body:beginCell().storeUint(0,32).storeStringTail(ton.memo).endCell().toBoc().toString('base64')}}};
const tonProof=C.tonEvidence(ton,tonTx,master,block,now);
check('TON positively included successful native receipt accepted',()=>assert.ok(tonProof));
for(const [name,mutate] of Object.entries({
 missingSuccess:t=>delete t.description.compute_ph.success,aborted:t=>t.description.aborted=true,bounced:t=>t.in_msg.bounced=true,
 failedAction:t=>t.description.action.result_code=1,unknownFinality:t=>delete t.mc_block_seqno,unfinalized:t=>t.mc_block_seqno=101,
 wrongDestination:t=>t.in_msg.destination='0:'+'33'.repeat(32),zero:t=>t.in_msg.value='0',old:t=>t.now-=100,
 wrongMemo:t=>t.in_msg.message_content.body=beginCell().storeUint(0,32).storeStringTail('old').endCell().toBoc().toString('base64'),emulated:t=>t.emulated=true
})) {const t=structuredClone(tonTx);mutate(t);check('TON rejects '+name,()=>assert.equal(C.tonEvidence(ton,t,master,block,now),null));}
check('TON wrong chain rejected',()=>assert.equal(C.tonEvidence(ton,tonTx,master,{...block,global_id:-239},now),null));
check('TON paid underamount retained for hold',()=>assert.equal(C.tonEvidence(ton,{...tonTx,in_msg:{...tonTx.in_msg,value:'1'}},master,block,now).hold,'amount'));
const paid=await P.settleChainOrder(env,pid,ton.id,'',now,async()=>({proof:tonProof}));
check('TON grant commits exactly once',()=>assert.equal(paid.status,'paid'));
const gold=db.get('/eco/'+pid+'/vg');
const {reconcilePayments}=await import('../../../worker/src/payment-ledger.js');
const {readEco}=await import('../../../worker/src/eco.js');
await reconcilePayments(env,pid,await readEco(env,pid),now);
const revenue=db.get('/meta/revc');
await Promise.all([P.settleChainOrder(env,pid,ton.id,'',now,async()=>({proof:tonProof})),P.settleChainOrder(env,pid,ton.id,'',now,async()=>({proof:tonProof}))]);
check('TON delivery replay has no inventory or revenue effect',()=>{assert.equal(db.get('/eco/'+pid+'/vg'),gold);assert.equal(db.get('/meta/revc'),revenue);});
const sol=(await P.issueChainOrder(env,pid,input('SOL','b'),now)).order;
check('SOL server conversion preserves original source rounding',()=>assert.equal(sol.amountNano,'640000000'));
const sig='2'.repeat(88),payer='8'.repeat(32),status={confirmationStatus:'finalized',err:null,slot:10};
const solTx={slot:10,blockTime:Math.floor(now/1000),meta:{err:null},transaction:{signatures:[sig],message:{accountKeys:[{pubkey:payer,signer:true},{pubkey:sol.recipient,signer:false},{pubkey:sol.reference,signer:false}],instructions:[{program:'system',programId:'11111111111111111111111111111111',parsed:{type:'transfer',info:{source:payer,destination:sol.recipient,lamports:Number(sol.amountNano)}}},{programId:'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',parsed:sol.memo}]}}};
const solProof=C.solEvidence(sol,sig,solTx,status,C.SOL_DEV_GENESIS,now);
check('SOL exact finalized native transfer accepted',()=>assert.ok(solProof));
for(const [name,mutate] of Object.entries({
 zero:t=>t.transaction.message.instructions[0].parsed.info.lamports=0,
 wrongDestination:t=>t.transaction.message.instructions[0].parsed.info.destination=payer,
 unrelatedInstruction:t=>t.transaction.message.instructions[0].programId='attacker',
 nonNative:t=>t.transaction.message.instructions[0].parsed.type='transferChecked',
 missingMemo:t=>t.transaction.message.instructions.pop(),wrongMemo:t=>t.transaction.message.instructions[1].parsed='old',
 unsignedPayer:t=>t.transaction.message.accountKeys[0].signer=false,
 missingReference:t=>t.transaction.message.accountKeys.pop(),failed:t=>t.meta.err={InstructionError:[0,'error']},
 historic:t=>t.blockTime=1,missingTime:t=>delete t.blockTime,wrongSlot:t=>t.slot=11,
 wrongHash:t=>t.transaction.signatures[0]='3'.repeat(88)
})){const t=structuredClone(solTx);mutate(t);check('SOL rejects '+name,()=>assert.equal(C.solEvidence(sol,sig,t,status,C.SOL_DEV_GENESIS,now),null));}
check('SOL unfinalized rejected',()=>assert.equal(C.solEvidence(sol,sig,solTx,{...status,confirmationStatus:'confirmed'},C.SOL_DEV_GENESIS,now),null));
check('SOL wrong network rejected',()=>assert.equal(C.solEvidence(sol,sig,solTx,status,C.SOL_MAIN_GENESIS,now),null));
check('SOL underpayment is review evidence, never matching delivery',()=>assert.equal(C.solEvidence(sol,sig,{...solTx,transaction:{...solTx.transaction,message:{...solTx.transaction.message,instructions:[{...solTx.transaction.message.instructions[0],parsed:{type:'transfer',info:{source:payer,destination:sol.recipient,lamports:1}}},solTx.transaction.message.instructions[1]]}}},status,C.SOL_DEV_GENESIS,now).hold,'amount'));
const beforeSol=db.get('/eco/'+pid+'/vg');
await Promise.all([P.settleChainOrder(env,pid,sol.id,'',now,async()=>({proof:solProof})),P.settleChainOrder(env,pid,sol.id,'',now,async()=>({proof:solProof}))]);
check('concurrent SOL callbacks grant once',()=>assert.equal(db.get('/eco/'+pid+'/vg'),beforeSol+gold));
const canceled=(await P.issueChainOrder(env,pid,input('TON','c'),now)).order;
await P.cancelChainOrder(env,pid,canceled.id,now);
const beforeHeld=db.get('/eco/'+pid+'/vg');
const held=await P.settleChainOrder(env,pid,canceled.id,'',now,async()=>({proof:{...tonProof,tx:'B'.repeat(43)+'='}}));
check('cancelled but paid is retained in review with no grant',()=>{assert.equal(held.status,'review');assert.equal(db.get('/eco/'+pid+'/vg'),beforeHeld);});
const changed=(await P.issueChainOrder(env,pid,{...input('TON','d'),desc:{kind:'moonbeam'}},now)).order;
db.root.eco[pid].moonbeam=true;
const changedHeld=await P.settleChainOrder(env,pid,changed.id,'',now,async()=>({proof:{...tonProof,amount:changed.amountNano,tx:'C'.repeat(43)+'='}}));
check('ownership change after payment is held',()=>assert.equal(changedHeld.status,'review'));
const late=(await P.issueChainOrder(env,pid,input('TON','e'),now)).order;
const lateHeld=await P.settleChainOrder(env,pid,late.id,'',now+700000,async()=>({proof:{...tonProof,tx:'D'.repeat(43)+'=',at:now+650000}}));
check('paid after expiry held, never silent discard',()=>assert.equal(lateHeld.status,'review'));
const wrong=(await P.issueChainOrder(env,'ln_1000000000002',input('TON','f'),now)).order;
const reused=await P.settleChainOrder(env,'ln_1000000000002',wrong.id,'',now,async()=>({proof:tonProof}));
check('transaction cannot be claimed by another order or account',()=>assert.equal(reused.error,'proof_reused'));
await assert.rejects(P.settleChainOrder(env,'ln_1000000000002',wrong.id,'',now,async()=>{throw Error('provider down');}),/provider down/);
check('provider outage creates no receipt',()=>assert.equal(db.get('/eco/ln_1000000000002/chainReceipts'),null));
const workerMod=await import('../../../worker/src/index.js');
const {issueLunarWebSession}=await import('../../../worker/src/web-auth.js');
const {createHmac}=await import('node:crypto');
const realFetch=globalThis.fetch,tgCalls=[],tgPaths=[];
let providerOffline=false,failRevenue=false,countFetch=0,measure=false;
globalThis.fetch=async(url,init={})=>{
 if(measure)countFetch++;
 if(url.includes('firebaseio.com/')){
  if(failRevenue&&new URL(url).pathname==='/meta.json'&&init.method==='PUT'){failRevenue=false;return new Response('{}',{status:503});}
  return db.handle(url,init);
 }
 if(url.startsWith('https://api.telegram.org/')){tgPaths.push(url);tgCalls.push([url.split('/').pop(),JSON.parse(init.body)]);return Response.json({ok:true,result:'https://t.me/$fixture'});}
 if(url.startsWith('https://testnet.toncenter.com/api/v3')){
  if(providerOffline)throw Error('outage');
  return Response.json(url.includes('/transactions?')?{transactions:[tonTx]}:url.includes('/masterchainInfo')?master:{blocks:[block]});
 }
 if(url==='https://api.devnet.solana.com'){
  if(providerOffline)throw Error('outage');
  const body=JSON.parse(init.body);rpcCalls.push(body);
  const result={getGenesisHash:C.SOL_DEV_GENESIS,getSignaturesForAddress:[{signature:sig}],getTransaction:solTx,getSignatureStatuses:{value:[status]}}[body.method];
  return Response.json({jsonrpc:'2.0',id:1,result});
 }
 return realFetch(url,init);
};
check('TON actual adapter schema is consumed',()=>{});
assert.ok((await C.findChainPayment(ton,0,'',now)).proof);
assert.ok((await C.findChainPayment(sol,0,'',now)).proof);
check('SOL adapter asks RPC explicitly for finalized jsonParsed',()=>assert.equal(rpcCalls.find(x=>x.method==='getTransaction').params[1].commitment,'finalized'));
providerOffline=true;
await assert.rejects(C.findChainPayment(ton,0,'',now),/outage/);await assert.rejects(C.findChainPayment(sol,0,'',now),/outage/);providerOffline=false;
check('both actual provider transports propagate outage without success',()=>{});
const sessions=new Map();
function state(values=new Map()){
 const storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),setAlarm:async t=>values.set('_alarm',t),deleteAll:async()=>values.clear(),transaction:async fn=>fn(storage)};
 return {storage,blockConcurrencyWhile:fn=>fn()};
}
env.WEB_ORIGIN='https://fixture';
env.SESSIONS={idFromName:x=>x,get:key=>({fetch:(url,init)=>{if(!sessions.has(key))sessions.set(key,new workerMod.WebSession(state()));return sessions.get(key).fetch(new Request(url,init));}})};
const login=await issueLunarWebSession(env,{id:1000000000003,lunar_account:true},'ln_1000000000003');
const session=await login.json(),cookie=login.headers.get('Set-Cookie').split(';')[0];
const requestApi=(path,b,override={})=>workerMod.default.fetch(new Request('https://fixture'+path,{method:'POST',headers:{Origin:'https://fixture',Cookie:cookie,'X-Lunar-CSRF':session.csrf,...override},body:JSON.stringify(b)}),env);
check('issued session has first-party passkey origin',()=>assert.ok(cookie));
assert.equal((await requestApi('/api/chain/order',input('TON','1'),{'X-Lunar-CSRF':''})).status,401);
assert.equal((await requestApi('/api/chain/order',input('TON','1'),{Origin:'https://evil.test'})).status,401);
check('chain route rejects missing CSRF and cross-origin',()=>{});
const sign=id=>{const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id})});const data=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(data).digest('hex'));return p.toString();};
const tgData=sign(12345);
assert.equal((await workerMod.default.fetch(new Request('https://fixture/api/chain/order',{method:'POST',body:JSON.stringify({...input(),initData:tgData})}),env)).status,403);
check('Telegram-signed Mini App cannot call crypto routes',()=>{});
assert.equal((await requestApi('/api/chain/order',{...input(),initData:tgData})).status,401);
check('mixed website and Telegram identities rejected',()=>{});
const httpOrder=await (await requestApi('/api/chain/order',input('TON','1'))).json();assert.ok(httpOrder.order);
assert.equal((await (await requestApi('/api/chain/status',{id:ton.id})).json()).error,'not_found');
check('authenticated HTTP order and account isolation',()=>{});
const enabled=env.CRYPTO_CHECKOUT_ENABLED;delete env.CRYPTO_CHECKOUT_ENABLED;
assert.equal((await (await requestApi('/api/chain/order',input('TON','2'))).json()).error,'unavailable');env.CRYPTO_CHECKOUT_ENABLED=enabled;
check('new checkout defaults off without explicit isolated flag',()=>{});
const webhook=async body=>workerMod.default.fetch(new Request('https://fixture/api/tg-webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':await workerMod.webhookSecret(env)},body:JSON.stringify(body)}),env);
const invoice=await workerMod.default.fetch(new Request('https://fixture/api/stars-invoice',{method:'POST',body:JSON.stringify({initData:tgData,kind:'vault',tk:'chest'})}),env);assert.equal(invoice.status,200);
const invoiceBody=tgCalls.find(([m])=>m==='createInvoiceLink')[1];
await P.issueChainOrder(env,'tg_12345',input('SOL','3'),now);
await webhook({pre_checkout_query:{id:'cross-rail',from:{id:12345},currency:'XTR',total_amount:1000,invoice_payload:invoiceBody.payload}});
check('Stars precheckout cannot race an active chain order',()=>assert.equal(tgCalls.find(([m,b])=>m==='answerPreCheckoutQuery'&&b.pre_checkout_query_id==='cross-rail')[1].ok,false));
// No-return receipt recovery and retry accounting with a newly created DO object.
const recoveryPid='tg_12346';
failRevenue=true;
const receiptCallback={message:{from:{id:12346},successful_payment:{currency:'XTR',total_amount:1000,telegram_payment_charge_id:'durableJob',invoice_payload:JSON.stringify({u:12346,k:'vault',t:'chest',g:16,n:'fixture'})}}};
await assert.rejects(webhook(receiptCallback),/payment revenue write/);
const beforeRecovery=db.get('/meta/revc'),values=new Map([['pid',recoveryPid]]);
let job=new workerMod.PaymentJob(state(values),env);job=null;job=new workerMod.PaymentJob(state(values),env);
measure=true;countFetch=0;await job.alarm();measure=false;
const jobFetches=countFetch;
check('no-return account recovered after DO recreation',()=>assert.equal(db.get('/meta/revc'),beforeRecovery+1300));
check('background recovery stays under fifty subrequests',()=>assert.ok(jobFetches<=50,jobFetches));
await job.alarm();check('repeated alarms do not duplicate revenue',()=>assert.equal(db.get('/meta/revc'),beforeRecovery+1300));
const {paymentOps}=await import('../../../worker/src/payment-ops.js');env.PAYMENT_OPS_ENABLED='1';env.PAYMENT_OPERATOR_PIDS=JSON.stringify(['ln_1000000000003']);
const op={buyer:pid,action:'note',reason:'Investigated held payment; no refund authorized'};
const beforeDry=JSON.stringify(db.root),dry=await paymentOps(env,'ln_1000000000003',op,now);
check('operator dry run does not mutate database',()=>assert.equal(JSON.stringify(db.root),beforeDry));
check('unauthorized operator rejected',()=>assert.equal(dry.error,undefined));
assert.equal((await paymentOps(env,'ln_9999999999999',op,now)).error,'forbidden');
assert.equal((await paymentOps(env,'ln_1000000000003',{...op,dryRun:false,confirm:'forged'},now)).error,'stale_confirmation');
const noted=await paymentOps(env,'ln_1000000000003',{...op,dryRun:false,confirm:dry.confirm},now);
check('explicit confirmation creates durable actor/reason audit',()=>{assert.equal(noted.ok,true);assert.equal(db.get('/eco/'+pid+'/paymentAudit/'+noted.audit+'/state'),'completed');});
// Authenticated finalized settlement through actual transport/HTTP and delayed
// per-account accounting; provider evidence is still wholly synthetic.
tonTx.hash='E'.repeat(43)+'=';tonTx.account=httpOrder.order.recipient;tonTx.in_msg.destination=httpOrder.order.recipient;
tonTx.in_msg.message_content.body=beginCell().storeUint(0,32).storeStringTail(httpOrder.order.memo).endCell().toBoc().toString('base64');
tonTx.now=Math.floor(httpOrder.order.created/1000);
measure=true;countFetch=0;
const confirmed=await (await requestApi('/api/chain/confirm',{id:httpOrder.order.id})).json();
measure=false;const confirmFetches=countFetch;
check('authenticated HTTP confirmation grants with actual adapter',()=>assert.equal(confirmed.status,'paid'));
check('chain confirmation stays below fifty subrequests',()=>assert.ok(confirmFetches<50,confirmFetches));
const chainRev=db.get('/meta/revc'),chainJob=new workerMod.PaymentJob(state(new Map([['pid',httpOrder.order.buyer]])),env);
await chainJob.alarm();
check('no-return crypto accounting recovers without another checkout request',()=>assert.equal(db.get('/meta/revc'),chainRev+6400));
await chainJob.alarm();assert.equal(db.get('/meta/revc'),chainRev+6400);
// Accept an invoice, then receive successful payment beyond quote expiry.
const tgLate=sign(12347);
await workerMod.default.fetch(new Request('https://fixture/api/stars-invoice',{method:'POST',body:JSON.stringify({initData:tgLate,kind:'vault',tk:'chest'})}),env);
const lateInvoice=tgCalls.filter(([m])=>m==='createInvoiceLink').at(-1)[1];
await webhook({pre_checkout_query:{id:'late-test',from:{id:12347},currency:'XTR',total_amount:1000,invoice_payload:lateInvoice.payload}});
const clock=Date.now;Date.now=()=>clock()+700000;
try{await webhook({message:{from:{id:12347},successful_payment:{currency:'XTR',total_amount:1000,telegram_payment_charge_id:'late-quoted',invoice_payload:lateInvoice.payload}}});}finally{Date.now=clock;}
check('Stars payment after accepted quote expiration is held',()=>{assert.equal(db.get('/eco/tg_12347/starReceipts/late-quoted/held'),'quote_ineligible');assert.equal(db.get('/eco/tg_12347/vg')||0,0);});
const cancelData=sign(12348);
const tgApi=(path,body)=>workerMod.default.fetch(new Request('https://fixture'+path,{method:'POST',body:JSON.stringify({initData:cancelData,...body})}),env);
const cancelInvoice=await (await tgApi('/api/stars-invoice',{kind:'vault',tk:'chest'})).json();
const cancelResult=await tgApi('/api/stars-cancel',{nonce:cancelInvoice.nonce});
assert.equal(cancelResult.status,200,'Stars cancellation must have a durable authenticated route');
check('Stars cancellation is durable and authenticated',()=>assert.equal(db.get('/eco/tg_12348/starCancelled/'+cancelInvoice.nonce)>0,true));
const canceledPayload=tgCalls.filter(([m])=>m==='createInvoiceLink').at(-1)[1].payload;
await webhook({pre_checkout_query:{id:'cancel-test',from:{id:12348},currency:'XTR',total_amount:1000,invoice_payload:canceledPayload}});
check('cancelled Stars quote cannot pass precheckout',()=>assert.equal(tgCalls.find(([m,b])=>m==='answerPreCheckoutQuery'&&b.pre_checkout_query_id==='cancel-test')[1].ok,false));
await webhook({message:{from:{id:12348},successful_payment:{currency:'XTR',total_amount:1000,telegram_payment_charge_id:'cancel-paid',invoice_payload:canceledPayload}}});
check('cancelled but actually paid Stars remains review with zero goods',()=>{assert.equal(db.get('/eco/tg_12348/starReceipts/cancel-paid/held'),'cancelled');assert.equal(db.get('/eco/tg_12348/vg')||0,0);});
const statusResponse=await (await tgApi('/api/stars-status',{nonce:cancelInvoice.nonce})).json();
check('Stars held status never claims delivered',()=>assert.equal(statusResponse.status,'review'));
env.STARS_TEST_MODE='1';
await tgApi('/api/stars-invoice',{kind:'vault',tk:'chest'});
delete env.STARS_TEST_MODE;
check('Stars dedicated test endpoint remains compatible with fixture transport',()=>assert.ok(tgPaths.at(-1).includes('/test/createInvoiceLink')));
const conflict=await P.issueChainOrder(env,pid,input('SOL','a'),now);
check('same request key cannot switch immutable order currency',()=>assert.equal(conflict.error,'request_conflict'));
while(Object.keys((await readEco(env,pid)).paymentPending||{}).length)await reconcilePayments(env,pid,await readEco(env,pid),now);
const refundBefore=db.get('/meta/revc'),refundGold=db.get('/eco/'+pid+'/vg');
assert.equal((await P.recordChainRefund(env,pid,sol.id,'',now,async()=>({proof:null}))).error,'refund_not_finalized');
const refunded=await P.recordChainRefund(env,pid,sol.id,'',now,async()=>({proof:{...solProof,tx:'4'.repeat(88),payer:sol.recipient}}));
check('refund requires finalized outgoing owner transfer, no broadcast',()=>assert.equal(refunded.ok,true));
await reconcilePayments(env,pid,await readEco(env,pid),now);
const afterRefund=db.get('/meta/revc');
check('confirmed refund reverses one grant and one revenue event',()=>{assert.equal(db.get('/eco/'+pid+'/vg'),refundGold-gold);assert.equal(afterRefund,refundBefore-6400);});
await P.recordChainRefund(env,pid,sol.id,'',now,async()=>{throw Error('duplicate should not requery');});await reconcilePayments(env,pid,await readEco(env,pid),now);
check('refund replay remains terminal and accounts once',()=>{assert.equal(db.get('/meta/revc'),afterRefund);});
const savedFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{if(url.includes('coingecko.com'))throw Error('no feed');return savedFetch(url,init);};
const retryDuringOutage=await P.issueChainOrder(env,pid,input('TON','a'),now);
globalThis.fetch=savedFetch;
check('lost-response retry recovers immutable quote even during price outage',()=>assert.equal(retryDuringOutage.order.id,ton.id));
const concurrentData=sign(12349);
await workerMod.default.fetch(new Request('https://fixture/api/stars-invoice',{method:'POST',body:JSON.stringify({initData:concurrentData,kind:'vault',tk:'chest'})}),env);
const concurrentInvoice=tgCalls.filter(([m])=>m==='createInvoiceLink').at(-1)[1];
const [chainRace]=await Promise.all([
 P.issueChainOrder(env,'tg_12349',input('TON','8'),now),
 webhook({pre_checkout_query:{id:'true-cross-race',from:{id:12349},currency:'XTR',total_amount:1000,invoice_payload:concurrentInvoice.payload}})
]);
const starRace=tgCalls.find(([m,b])=>m==='answerPreCheckoutQuery'&&b.pre_checkout_query_id==='true-cross-race')[1].ok;
check('concurrent Stars acceptance and chain issuance have one CAS winner',()=>assert.equal(Number(!!chainRace.order)+Number(starRace),1));
const retainedPid='ln_1000000000004',retained=(await P.issueChainOrder(env,retainedPid,input('TON','9'),now)).order;
const account=db.root.eco[retainedPid];account.chainReceipts={};
for(let i=0;i<32;i++){const id=i.toString(16).padStart(32,'0');account.tonOrders[id]={...retained,id,requestId:id};account.chainReceipts[id]={granted:true};}
account.chainReceipts[retained.id]={granted:true};
check('settled purchases do not exhaust unresolved-order capacity',()=>{});
assert.ok((await P.issueChainOrder(env,retainedPid,input('TON','f'),now)).order);
const attempt=(await P.issueChainOrder(env,'ln_1000000000005',input('TON','7'),now)).order;
await P.prepareChainOrder(env,'ln_1000000000005',attempt.id,now);
check('persisted pre-wallet intent prevents a second ambiguous approval',()=>{});
assert.equal((await P.prepareChainOrder(env,'ln_1000000000005',attempt.id,now)).error,'not_payable');
assert.equal((await P.inspectChainOrder(env,'ln_1000000000005',attempt.id,now)).walletAllowed,false);
const {hmac,hex}=await import('../../../worker/src/db.js');
const walletHash=hex(await hmac(env.BOT_TOKEN,'w|'+tonProof.payer)).slice(0,16);
check('no-return wallet identity projection preserved',()=>assert.equal(db.get('/wal/'+walletHash+'/'+httpOrder.order.buyer)!==null,true));
const farmJob=new workerMod.PaymentJob(state(new Map([['pid',pid]])),env);
measure=true;countFetch=0;await farmJob.alarm();measure=false;
check('shared verified payer still links canonical accounts with bounded requests',()=>{assert.equal(db.get('/lk/'+pid+'/'+httpOrder.order.buyer),'wallet');assert.ok(countFetch<50);});
check('RPC network binding uses full observed genesis hashes, not shortened CAIP identifiers',()=>{
 assert.equal(C.SOL_DEV_GENESIS,'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG');
 assert.equal(C.SOL_MAIN_GENESIS,'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
});
const historyBody={buyer:pid,action:'requeue-receipt',rail:'chain',order:sol.id,reason:'Repair historically lost journal from authoritative receipt'};
const historyGold=db.get('/eco/'+pid+'/vg'),historyRevenue=db.get('/meta/revc');
const historyDry=await paymentOps(env,'ln_1000000000003',historyBody,now);
await paymentOps(env,'ln_1000000000003',{...historyBody,dryRun:false,confirm:historyDry.confirm},now);
await reconcilePayments(env,pid,await readEco(env,pid),now);
check('explicit historical receipt requeue never regrants goods or recounts revenue',()=>{assert.equal(db.get('/eco/'+pid+'/vg'),historyGold);assert.equal(db.get('/meta/revc'),historyRevenue);});
const {readFileSync}=await import('node:fs');
const recorded=JSON.parse(readFileSync(new URL('./fixtures/ton-testnet-observed.json',import.meta.url),'utf8'));
check('recorded public TON testnet schema confirms positive masterchain metadata',()=>{assert.equal(recorded.block.global_id,-3);assert.equal(recorded.block.seqno,recorded.transaction.mc_block_seqno);assert.ok(recorded.master.last.seqno>recorded.transaction.mc_block_seqno);});
check('recorded unrelated finalized TON transaction cannot pay a fresh order',()=>assert.equal(C.tonEvidence(ton,recorded.transaction,recorded.master,recorded.block,Date.now()),null));
console.log(JSON.stringify({passed,failed:0,jobFetches,confirmFetches,walletFetches:countFetch,allOutboundMocked:true}));
