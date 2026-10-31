// Focused audit fixture. Every outbound request terminates here; no live network.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { makeDB } from './fakedb.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db = makeDB(), env = { BOT_TOKEN: '123:ABC', FIREBASE_DB_SECRET: 'SECRET' };
let priceOutage = false, failMetaWrite = false;
const tonTransactions=[];
const recipient = 'A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE';
globalThis.fetch = async (url, init = {}) => {
  if (url.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')) {
    if (failMetaWrite && new URL(url).pathname === '/meta.json' && init.method === 'PUT') {
      failMetaWrite = false;
      return Response.json({ error: 'local fixture: lost write' }, { status: 500 });
    }
    return db.handle(url, init);
  }
  if (url.startsWith('https://api.telegram.org/')) return Response.json({ ok: true, result: 'https://t.me/$local-fixture' });
  if (url.startsWith('https://toncenter.com/')) return Response.json({ result: tonTransactions });
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
let failed=0;
const check = (description, actual, expected) => {
  try { assert.deepEqual(actual,expected); console.log('PASS',description); }
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
console.log(JSON.stringify({failed,allOutboundMocked:true}));
process.exitCode=failed?1:0;
