// Focused audit fixture. Every outbound request terminates here; no live network.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { makeDB } from './fakedb.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db = makeDB(), env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' };
let priceOutage = false, failMetaWrite = false, tonBarrier = null, measuredFetches = null, failReceiptWrite = null;
const tonTransactions=[], tgCalls=[];
const recipient = 'A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE';
globalThis.fetch = async (url, init = {}) => {
  if (measuredFetches !== null) measuredFetches++;
  if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) {
    if (failMetaWrite && new URL(url).pathname === '/meta.json' && init.method === 'PUT') {
      failMetaWrite = false;
      return Response.json({ error: 'local fixture: lost write' }, { status: 500 });
    }
    if (failReceiptWrite && new URL(url).pathname === failReceiptWrite && init.method === 'PUT') {
      failReceiptWrite = null;
      return Response.json({error:'local fixture: receipt write failed'}, {status:500});
    }
    return db.handle(url, init);
  }
  if (url.startsWith('https://api.telegram.org/')) { tgCalls.push([url.split('/').pop(), JSON.parse(init.body)]); return Response.json({ ok: true, result: 'https://t.me/$local-fixture' }); }
  if (url.startsWith('https://toncenter.com/')) { if(tonBarrier) { const barrier=tonBarrier; if(--barrier.left===0) {tonBarrier=null;barrier.release();} await barrier.promise; } return Response.json({ result: tonTransactions }); }
  if (url.startsWith('https://api.coingecko.com/')) {
    if (priceOutage) throw Error('local fixture: prices unavailable');
    return Response.json({ 'the-open-network': { usd: 4 }, solana: { usd: 100 } });
  }
  if (['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'].includes(url)) {
    // An unrelated historical tx, no order reference/memo, zero recipient credit.
    return Response.json({ result: { blockTime: 1, meta: { err: null, preBalances: [10, 100], postBalances: [9, 100] }, transaction: { message: { accountKeys: ['unrelated-payer', recipient] } } } });
  }
  throw Error('Unexpected outbound request blocked: ' + url);
};
const { default: worker, webhookSecret } = await import('../../../worker/src/index.js');
const secret = await webhookSecret(env);
const initData = id => {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now()/1000)), user: JSON.stringify({id}) });
  const data = [...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  p.set('hash', createHmac('sha256', createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(data).digest('hex'));
  return p.toString();
};
const api = async (path, id, body, expectedStatus=200) => {
  const r = await worker.fetch(new Request('https://fixture'+path, {method:'POST',body:JSON.stringify({initData:initData(id),...body})}),env);
  assert.equal(r.status,expectedStatus); return r.json();
};
const hook = async body => {
  const r = await worker.fetch(new Request('https://fixture/api/tg-webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body:JSON.stringify(body)}),env);
  assert.equal(r.status,200);
};
const pay = (charge, id=111) => hook({message:{from:{id},successful_payment:{currency:'XTR',total_amount:1000,telegram_payment_charge_id:charge,invoice_payload:JSON.stringify({u:id,k:'vault',t:'chest',g:16,n:'n'+charge})}}});
const refund = (charge,id=111) => hook({message:{from:{id},refunded_payment:{currency:'XTR',total_amount:1000,telegram_payment_charge_id:charge}}});
let failed=0,passed=0;
const check = (description, actual, expected) => {
  try { assert.deepEqual(actual,expected); passed++; console.log('PASS',description); }
  catch { failed++; console.log('FAIL',description, JSON.stringify({actual,expected})); }
};
await pay('first');
const gold1=db.get('/eco/tg_111/vg'), revenue1=db.get('/meta/revc');
await pay('first');
check('immediate Stars replay grants once',db.get('/eco/tg_111/vg'),gold1);
check('immediate Stars replay accounts revenue once',db.get('/meta/revc'),revenue1);
for(let i=0;i<12;i++) await pay('later'+i);
const gold13=db.get('/eco/tg_111/vg');
await pay('first');
check('Stars replay after 12 subsequent payments never grants again',db.get('/eco/tg_111/vg'),gold13);
const beforeRefund=db.get('/meta/revc');
await Promise.all([refund('first'),refund('first')]);
check('concurrent duplicate refund subtracts revenue once',db.get('/meta/revc'),beforeRefund-1300);
check('concurrent duplicate refund removes one purchase',db.get('/eco/tg_111/vg'),gold13-gold1);
await pay('first');
check('successful-payment replay preserves durable refund tombstone',typeof db.get('/starsPaid/tg_111/first/rf'),'number');
const solBody={cur:'SOL',amt:0,gram:16,memo:'LWM|tg_222|fixture',proof:'2'.repeat(88),desc:{kind:'vault',tk:'chest'}};
const healthy=await api('/api/pay-log',222,solBody);
check('SOL is safely unavailable until orders bind proofs',healthy.error,'unavailable');
priceOutage=true;
const outage=await api('/api/pay-log',222,solBody);
check('price outage never verifies zero-credit unrelated SOL transaction',outage.verified===true,false);
check('price outage never grants unpaid Vault Gold',db.get('/eco/tg_222/vg')||0,0);
check('paused SOL never consumes a transaction proof',db.get('/solTx'),null);
const beforeAgain=db.get('/meta/revc');
await refund('first');
check('refund replay after success replay does not debit twice',db.get('/meta/revc'),beforeAgain);
const beforeCrashGold=db.get('/eco/tg_111/vg'),beforeCrashRev=db.get('/meta/revc');
failMetaWrite=true;
await assert.rejects(pay('crash'),/payment revenue write/);
await pay('crash');
check('success retry after inventory commit grants once',db.get('/eco/tg_111/vg'),beforeCrashGold+gold1);
check('success retry completes revenue once',db.get('/meta/revc'),beforeCrashRev+1300);
failMetaWrite=true;
await assert.rejects(refund('crash'),/payment revenue write/);
await refund('crash');
check('refund retry after inventory commit removes once',db.get('/eco/tg_111/vg'),beforeCrashGold);
check('refund retry completes revenue once',db.get('/meta/revc'),beforeCrashRev);
await refund('outoforder');
await pay('outoforder');
check('refund arriving before success prevents grant',db.get('/eco/tg_111/vg'),beforeCrashGold);
check('refund arriving before success settles net zero revenue',db.get('/meta/revc'),beforeCrashRev);
const beforeConcurrentGold=db.get('/eco/tg_111/vg'),beforeConcurrentRev=db.get('/meta/revc');
await Promise.all([pay('concurrent'),pay('concurrent')]);
check('concurrent success grants once',db.get('/eco/tg_111/vg'),beforeConcurrentGold+gold1);
check('concurrent success accounts once',db.get('/meta/revc'),beforeConcurrentRev+1300);
await Promise.all([refund('concurrent'),refund('concurrent')]);
check('concurrent refund revokes once',db.get('/eco/tg_111/vg'),beforeConcurrentGold);
check('concurrent refund accounts once',db.get('/meta/revc'),beforeConcurrentRev);
db.root.starsPaid.tg_111.legacyRefunded={k:'vault',t:'chest',g:16,stars:1000,n:'legacyRefunded',o:[],rf:123};
const beforeLegacy=db.get('/meta/revc');
await refund('legacyRefunded');
check('pre-upgrade settled refund replay preserves revenue',db.get('/meta/revc'),beforeLegacy);
db.root.starsPaid.tg_111.legacyPaid={k:'vault',t:'chest',g:16,stars:1000,n:'legacyPaid',o:[]};
await pay('legacyPaid');
check('pre-upgrade paid receipt replay preserves revenue',db.get('/meta/revc'),beforeLegacy);
failMetaWrite=true;
await assert.rejects(refund('legacyPaid'),/payment revenue write/);
await refund('legacyPaid');
check('pre-upgrade receipt new refund retry settles once',db.get('/meta/revc'),beforeLegacy-1300);
priceOutage=false;
tonTransactions.push({in_msg:{value:'16000000000',message:'LWM|tg_333|settlement'},transaction_id:{hash:'localton'}});
const tonBody={cur:'TON',amt:16,gram:16,memo:'LWM|tg_333|settlement',desc:{kind:'vault',tk:'chest'}};
const beforeTon=db.get('/meta/revc');
failMetaWrite=true;
await api('/api/pay-log',333,tonBody,500);
await api('/api/pay-log',333,tonBody);
check('TON retry after settlement failure grants once',db.get('/eco/tg_333/vg'),gold1);
check('TON retry after settlement failure accounts once',db.get('/meta/revc'),beforeTon+6400);
await pay('linked',444);
db.root.telegramLinks={444:'ln_1000000000001'};
db.root.lunarAccounts={ln_1000000000001:{id:'ln_1000000000001',type:'passkey',telegramId:444}};
await pay('linked',444);
check('canonical remapping never grants replay to another account',db.get('/eco/ln_1000000000001/vg')||0,0);
await refund('linked',444);
check('refund after canonical remapping reverses original owner',db.get('/eco/tg_444/vg'),0);
db.root.starsPaid.tg_555={legacyLink:{k:'vault',t:'chest',g:16,stars:1000,n:'legacyLink',o:[]}};
db.root.telegramLinks[555]='ln_1000000000002';
db.root.lunarAccounts.ln_1000000000002={id:'ln_1000000000002',type:'passkey',telegramId:555};
await pay('legacyLink',555);
check('pre-upgrade receipt ownership survives canonical remapping',db.get('/eco/ln_1000000000002/vg')||0,0);
await pay('orphanLink',666);
db.root.telegramLinks[666]='ln_1000000000003'; // Interrupted link has no reciprocal account.
let orphanError=false;
try { await pay('orphanLink',666); await refund('orphanLink',666); } catch { orphanError=true; }
check('known charge settlement ignores a later broken identity mapping',orphanError,false);
check('known charge refund with broken mapping reverses original owner',db.get('/eco/tg_666/vg'),0);
await assert.rejects(pay('linked',777),/payment owner unavailable/);
check('charge ownership validates the original Telegram user',db.get('/eco/tg_777/vg')||0,0);
const page=readFileSync(new URL('../../../pay.html',import.meta.url),'utf8');
const inline=[...page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].find(([,attrs,body])=>!attrs.includes('type=')&&body.includes('(function(){'))[2];
const paused={innerHTML:''};
let walletTouched=false;
try { vm.runInNewContext(inline,{document:{querySelector:selector=>{assert.equal(selector,'.wrap');return paused;}},window:new Proxy({},{get(){walletTouched=true;throw Error('wallet touched');}})}); }
catch { walletTouched=true; }
check('old direct SOL checkout links show unavailable before wallet code',!walletTouched&&/temporarily unavailable/i.test(paused.innerHTML),true);
// Step 2B: precheckout is the last point at which stale invoices can be refused without charging.
const invoice = async (id, body) => {
  const response = await api('/api/stars-invoice', id, body);
  return {...response, payload: tgCalls.find(([method, body]) => method === 'createInvoiceLink' && JSON.parse(body.payload).n === response.nonce)[1].payload};
};
const checkout = async (id, order, amount=order.stars, currency='XTR') => {
  const qid='q'+Math.random();
  await hook({pre_checkout_query:{id:qid,from:{id},currency,total_amount:amount,invoice_payload:order.payload}});
  return tgCalls.find(([method, body]) => method === 'answerPreCheckoutQuery' && body.pre_checkout_query_id === qid)[1].ok;
};
const quote=await invoice(880,{kind:'box',tk:'gem',ri:1,deal:'d'});
check('precheckout rejects a mismatched amount before charging',await checkout(880,quote,1),false);
check('precheckout accepts an unchanged eligible invoice',await checkout(880,quote),true);
db.root.eco.tg_880=db.root.eco.tg_880||{}; db.root.eco.tg_880.dealD=Math.floor(Date.now()/86400000);
check('precheckout rejects a stale already-used deal',await checkout(880,quote),false);
const passQuote=await invoice(881,{kind:'pass'});
const stalePass={...passQuote,payload:JSON.stringify({...JSON.parse(passQuote.payload),t:String(Number(JSON.parse(passQuote.payload).t)+1)})};
check('precheckout rejects a pass payload from a different season',await checkout(881,stalePass),false);
const ownedQuote=await invoice(882,{kind:'moonbeam'});
db.root.eco.tg_882={moonbeam:true};
check('precheckout rejects an item owned since invoice creation',await checkout(882,ownedQuote),false);
const expiredQuote=await invoice(885,{kind:'vault',tk:'chest'});
const realNow=Date.now;
Date.now=()=>realNow()+11*60000;
check('precheckout rejects an expired server quote',await checkout(885,expiredQuote),false);
Date.now=realNow;
const parallelQuotes=await Promise.all([invoice(886,{kind:'box',tk:'gem',ri:1,deal:'d'}),invoice(886,{kind:'box',tk:'gem',ri:1,deal:'d'})]);
const parallelCheckouts=await Promise.all(parallelQuotes.map(order=>checkout(886,order)));
check('concurrent precheckouts reserve only one outstanding purchase',parallelCheckouts.filter(Boolean).length,1);
const issued=await invoice(887,{kind:'vault',tk:'chest'});
await checkout(887,issued);
const quotedPay=charge=>hook({message:{from:{id:887},successful_payment:{currency:'XTR',total_amount:issued.stars,telegram_payment_charge_id:charge,invoice_payload:issued.payload}}});
await quotedPay('quotedOne');
check('new quoted Stars checkout grants after matching acceptance',db.get('/eco/tg_887/vg'),gold1);
await quotedPay('quotedTwo');
check('a second charge cannot consume one accepted quote twice',db.get('/eco/tg_887/vg'),gold1);
check('a second charge is retained for refund/support review',db.get('/starsPaid/tg_887/quotedTwo/held'),'quote_used');
const delayedPass=await invoice(888,{kind:'pass'});
await checkout(888,delayedPass);
Date.now=()=>realNow()+40*86400000;
await hook({message:{from:{id:888},successful_payment:{currency:'XTR',total_amount:delayedPass.stars,telegram_payment_charge_id:'seasonLate',invoice_payload:delayedPass.payload}}});
check('a delayed old-season success never grants the new season',db.get('/eco/tg_888/pass/prem'),false);
check('a delayed old-season success is retained for support review',db.get('/starsPaid/tg_888/seasonLate/held'),'quote_ineligible');
Date.now=realNow;
// Unpriced legacy logging must never create a verified product receipt for migration.
tonTransactions.push({in_msg:{value:'1',message:'LWM|tg_889|unpriced'},transaction_id:{hash:'tiny'}});
await api('/api/pay-log',889,{cur:'TON',amt:0,item:'Moonbeam',memo:'LWM|tg_889|unpriced'});
check('missing product details cannot create a verified TON sale',db.get('/payments/LWM_LWM_tg_889_unpriced/verified')===true,false);
const recoveryBefore=db.get('/meta/revc');
failMetaWrite=true;
await assert.rejects(pay('noProviderRetry',883),/payment revenue write/);
await api('/api/sync',883,{boot:true});
check('authenticated sync reconciles committed Stars receipt without provider retry',db.get('/meta/revc'),recoveryBefore+1300);
const recoveryTonBefore=db.get('/meta/revc');
tonTransactions.push({in_msg:{value:'16000000000',message:'LWM|tg_884|noProviderRetry'},transaction_id:{hash:'localtonRecovery'}});
failMetaWrite=true;
await api('/api/pay-log',884,{...tonBody,memo:'LWM|tg_884|noProviderRetry'},500);
await api('/api/sync',884,{boot:true});
check('authenticated sync reconciles committed TON receipt without provider retry',db.get('/meta/revc'),recoveryTonBefore+6400);

tonTransactions.push(...['one','two'].map(n=>({in_msg:{value:'12000000000',message:'LWM|tg_890|'+n},transaction_id:{hash:'concurrentTon'+n}})));
{ let release; const promise=new Promise(resolve=>release=resolve); tonBarrier={left:2,promise,release}; }
await Promise.all(['one','two'].map(n=>api('/api/pay-log',890,{cur:'TON',amt:12,memo:'LWM|tg_890|'+n,desc:{kind:'box',tk:'gem',ri:1,deal:'d'}})));
check('concurrent TON settlements cannot both consume the daily offer',db.get('/eco/tg_890/buys/gem1|'+Math.floor(Date.now()/86400000)),1);
check('stale concurrent TON settlement remains in review',Object.values(db.get('/eco/tg_890/chainReceipts')).filter(r=>r.held).length,1);
const wrongBuyer=await invoice(891,{kind:'vault',tk:'chest'});
check('precheckout rejects a different Telegram buyer',await checkout(892,wrongBuyer),false);
check('precheckout rejects a different currency',await checkout(891,wrongBuyer,wrongBuyer.stars,'USD'),false);
const unknownQuote={stars:1000,payload:JSON.stringify({q:1,u:891,k:'vault',t:'chest',g:16,n:'000000000000'})};
check('precheckout rejects an unissued server quote',await checkout(891,unknownQuote),false);
const repeated=await invoice(893,{kind:'box',tk:'weapon',ri:1});
db.root.eco.tg_893={buys:{weapon1:1}};
check('precheckout rejects a repeat-buy price changed since invoice creation',await checkout(893,repeated),false);
const refundBefore=db.get('/meta/revc');
await pay('refundNoProviderRetry',894);
failMetaWrite=true;
await assert.rejects(refund('refundNoProviderRetry',894),/payment revenue write/);
await api('/api/sync',894,{boot:true});
check('sync reconciles refund revenue without provider retry',db.get('/meta/revc'),refundBefore);
check('sync clears completed payment work durably',Object.keys(db.get('/eco/tg_894/paymentPending')||{}).length,0);
const batchBefore=db.get('/meta/revc');
for(let i=0;i<11;i++) {
  failMetaWrite=true;
  await assert.rejects(pay('batch'+i,895),/payment revenue write/);
}
let maxSyncFetches=0;
const budgetedSync=async(id,status=200)=>{
  measuredFetches=0;
  try { await api('/api/sync',id,{boot:true},status); maxSyncFetches=Math.max(maxSyncFetches,measuredFetches); return measuredFetches; }
  finally { measuredFetches=null; }
};
let batchFetches=await budgetedSync(895);
check('sync with eleven pending receipts stays within fifty total outbound fetches',batchFetches<=50,true);
check('one sync reconciliation batch is limited to two receipts',db.get('/meta/revc'),batchBefore+2600);
check('unprocessed durable receipts remain pending',Object.keys(db.get('/eco/tg_895/paymentPending')||{}).length,9);
let drainCalls=0,maxDrainFetches=batchFetches;
while(Object.keys(db.get('/eco/tg_895/paymentPending')||{}).length&&drainCalls++<10) maxDrainFetches=Math.max(maxDrainFetches,await budgetedSync(895));
check('later syncs drain the remaining durable receipts',Object.keys(db.get('/eco/tg_895/paymentPending')||{}).length,0);
check('all drain syncs stay within fifty outbound fetches',maxDrainFetches<=50,true);
check('bounded recovery completes revenue exactly once',db.get('/meta/revc'),batchBefore+14300);
await Promise.all([api('/api/sync',895,{boot:true}),refund('batch0',895)]);
await api('/api/sync',895,{boot:true});
check('sync racing a refund does not lose or double its journal work',db.get('/meta/revc'),batchBefore+13000);
for(const [name,fields] of [['aborted',{description:{aborted:true}}],['bounced',{in_msg:{bounced:true}}],['failedCompute',{description:{compute_ph:{success:false}}}]]) {
  const memo='LWM|tg_896|'+name;
  tonTransactions.push({...fields,in_msg:{...(fields.in_msg||{}),value:'16000000000',message:memo},transaction_id:{hash:'invalid'+name}});
  const result=await api('/api/pay-log',896,{...tonBody,memo});
  check('TON '+name+' transaction never authorizes goods',result.verified===true,false);
}
check('failed TON provider records never grant inventory',db.get('/eco/tg_896/vg')||0,0);
const heldStatus=await api('/api/act',887,{a:'paid',n:issued.nonce});
check('original quote delivery remains visible despite a held duplicate charge',Array.isArray(heldStatus.out.outs),true);
const heldSeasonStatus=await api('/api/act',888,{a:'paid',n:delayedPass.nonce});
check('held Stars status is review rather than delivered outputs',heldSeasonStatus.out.review,true);
const heldBoot=await api('/api/sync',888,{boot:true});
check('held Stars receipt stays visible on a later boot',heldBoot.paymentReview,1);
check('held Stars receipt never appears as undelivered goods',(heldBoot.stars||[]).length,0);
const netSource=readFileSync(new URL('../../../js/net.js',import.meta.url),'utf8');
const deliverSource=netSource.slice(netSource.indexOf('function starsDeliver('),netSource.indexOf('// ---- SOL:',netSource.indexOf('function starsDeliver(')));
let reviewOutput=false,reviewMessage='',reviewRetry=false;
vm.runInNewContext(deliverSource+'; starsDeliver("fixture",0)',{api:async()=>({out:{review:true}}),showOuts:()=>reviewOutput=true,showToast:text=>reviewMessage=text,setTimeout:()=>reviewRetry=true});
await new Promise(resolve=>setImmediate(resolve));
check('client reports held Stars review without delivered output',!reviewOutput&&/support|review|LunarBattle/i.test(reviewMessage)&&!reviewRetry,true);
const starterOrder=await invoice(898,{kind:'starter'});
await checkout(898,starterOrder);
const starterPay=charge=>hook({message:{from:{id:898},successful_payment:{currency:'XTR',total_amount:starterOrder.stars,telegram_payment_charge_id:charge,invoice_payload:starterOrder.payload}}});
await starterPay('originalStarter');
await starterPay('heldStarter');
const starterSpend=db.get('/eco/tg_898/spendGram');
await refund('heldStarter',898);
check('refund of a held starter never revokes the original paid starter',db.get('/eco/tg_898/starter'),true);
check('refund of held goods never reduces previously verified spending',db.get('/eco/tg_898/spendGram'),starterSpend);
const refundedHeldBoot=await api('/api/sync',898,{boot:true});
check('refunded held receipt clears its review notice',refundedHeldBoot.paymentReview,0);
// A failed second projection must not undo durable cleanup of the first receipt.
const failureBatchBefore=db.get('/meta/revc');
for(let i=0;i<10;i++) {
  failMetaWrite=true;
  await assert.rejects(pay('budget'+i,899),/payment revenue write/);
}
failReceiptWrite='/starsPaid/tg_899/budget1.json';
const failedSyncFetches=await budgetedSync(899,500);
check('a receipt projection failure stays within the sync fetch budget',failedSyncFetches<=50,true);
check('completed receipt cleanup survives a later receipt failure',db.get('/eco/tg_899/paymentPending/stars_budget0'),null);
check('failed receipt remains durably pending',!!db.get('/eco/tg_899/paymentPending/stars_budget1'),true);
drainCalls=0;maxDrainFetches=failedSyncFetches;
while(Object.keys(db.get('/eco/tg_899/paymentPending')||{}).length&&drainCalls++<10) maxDrainFetches=Math.max(maxDrainFetches,await budgetedSync(899));
check('multiple budgeted syncs drain the backlog after one receipt failure',Object.keys(db.get('/eco/tg_899/paymentPending')||{}).length,0);
check('failure recovery syncs all stay within fifty total fetches',maxDrainFetches<=50,true);
check('failure recovery never doubles accounting',db.get('/meta/revc'),failureBatchBefore+13000);
console.log(JSON.stringify({passed,failed,maxSyncFetches,allOutboundMocked:true}));
process.exitCode=failed?1:0;
