// Mobile UI simulation only. No wallet broadcast, live authentication or provider.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();let status='pending',currency='TON',unavailable=false,order,requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.TON_CONNECT_UI={TonConnectUI:class{connected=true;account={chain:'-3'};async sendTransaction(tx){window.sentTon=tx;return {boc:'simulated'};}}};
   window.phantom={solana:{connect:async function(){this.publicKey=new solanaWeb3.PublicKey('11111111111111111111111111111111');},signAndSendTransaction:async tx=>{window.sentSol=tx.instructions.map(i=>({program:i.programId.toString(),keys:i.keys.map(k=>k.pubkey.toString()),data:Array.from(i.data)}));return {signature:'2'.repeat(88)};}}};
  });
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname==='unpkg.com'&&u.pathname.includes('web3.js'))return route.fulfill({body:fs.readFileSync('/tmp/lunar-payment-sdks/sol.js'),contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
   if(u.hostname==='api.devnet.solana.com'){
    const q=req.postDataJSON();const result=q.method==='getGenesisHash'?'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG':{context:{slot:10},value:{blockhash:'11111111111111111111111111111111',lastValidBlockHeight:100}};
    return route.fulfill({json:{jsonrpc:'2.0',id:q.id,result}});
   }
   assert.equal(u.origin,'https://fixture','unexpected external request');
   if(u.pathname==='/auth/session')return route.fulfill({json:{pid:'ln_1000000000001',csrf:'fixture',user:{lunar_account:true}}});
   if(u.pathname.startsWith('/api/chain/')){
    const action=u.pathname.split('/').pop(),body=req.postDataJSON();requests.push({action,body});assert.equal(req.headers()['x-lunar-csrf'],'fixture');
    let d={};
    if(action==='config')d={enabled:!unavailable,network:'testnet'};
    if(action==='list')d={orders:order?[{id:order.id,currency:order.currency,status}]:[]};
    if(action==='order'){currency=body.currency;order={id:'a'.repeat(32),buyer:'ln_1000000000001',currency,network:currency==='TON'?'testnet':'devnet',amountNano:'1000000000',recipient:currency==='TON'?'0:'+'11'.repeat(32):'A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE',reference:'11111111111111111111111111111111',memo:'LWM2|'+currency+'|'+'a'.repeat(32),desc:body.desc,expires:Date.now()+600000};d={order};}
    if(['status','confirm'].includes(action))d={order,status};
    if(action==='prepare')d={prepared:true};
    if(action==='cancel'){status='cancelled';d={ok:true};}
    return route.fulfill({json:d});
   }
   const file=path.join(process.cwd(),u.pathname);return route.fulfill({body:fs.readFileSync(file),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':'text/html'});
  });
  const url='https://fixture/web/checkout.html?item='+encodeURIComponent(JSON.stringify({kind:'vault',tk:'chest'}));
  await page.goto(url);await page.locator('#quote').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('quote').disabled);await page.locator('#quote').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Waiting for a finalized'));
  await page.locator('#wallet').click();await page.waitForFunction(()=>!!window.sentTon);
  const sent=await page.evaluate(()=>window.sentTon);assert.equal(sent.messages[0].amount,order.amountNano);assert.equal(sent.messages[0].address,order.recipient);assert.equal(sent.network,'-3');assert.ok(sent.messages[0].payload);
  console.log('PASS iPhone-width TON exact pre-wallet order and pending display (simulated wallet)');
  await page.locator('#cancel').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('cancelled'));assert.equal(await page.locator('#wallet').isDisabled(),true);
  status='review';await page.reload();await page.waitForFunction(()=>document.querySelector('#history button'));await page.locator('#history button').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('support review'));
  console.log('PASS cancellation, close/reopen server history and durable review screen');
  status='pending';await page.locator('#currency').selectOption('SOL');await page.locator('#quote').click();await page.waitForFunction(()=>document.getElementById('details').textContent.includes('devnet'));await page.locator('#wallet').click();
  await page.waitForFunction(()=>!!window.sentSol);const sol=await page.evaluate(()=>window.sentSol);assert.equal(sol[0].program,'11111111111111111111111111111111');assert.equal(sol[0].keys[1],order.recipient);assert.ok(sol[0].keys.includes(order.reference));assert.equal(sol[1].program,'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');assert.equal(Buffer.from(sol[1].data).toString(),order.memo);
  status='paid';await page.locator('#refresh').click();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('items are saved'));assert.equal(await page.locator('#wallet').isDisabled(),true);
  console.log('PASS real Solana SDK builds exact transfer/reference/memo; simulated wallet return and paid state');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  unavailable=true;await page.reload();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('disabled'));assert.equal(await page.locator('#quote').isDisabled(),true);assert.deepEqual(errors,[]);
  console.log('PASS 390px layout and disabled checkout; no uncaught errors or broadcasts');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
