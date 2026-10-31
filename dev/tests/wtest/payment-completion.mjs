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
console.log(JSON.stringify({passed,failed:0,allOutboundMocked:true}));
