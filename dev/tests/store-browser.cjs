// Session 8 (owner brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md): the store, checkout and receipts in a real browser, on the
// website (GRAM and SOL) and in Telegram (Stars, and GRAM behind the server switch), at 390x844, 390x700 and 320x568 (touch) and
// 1366x768 and 1920x1080 (keyboard and mouse). Every purchase is a real server quote through the real Worker routes: the Stars invoice
// with Telegram's pre-checkout query and payment through the signed webhook, the GRAM memo and the SOL reference found on the chain.
// The chain, Telegram's Bot API, the identity provider and the database are local fakes (dev/tests/wtest/fakechain.mjs): nothing leaves
// the machine. Captures of the store, the checkout and the receipts at every size, on both surfaces.
//   node dev/tests/store-browser.cjs [chromium|webkit|firefox ...]   (default: every engine that is installed)
const {spawn,execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const pw=require('playwright');
const ROOT=path.resolve(__dirname,'../..'),OUT=process.env.SHOTS||'/tmp/lunar-shots/store';fs.mkdirSync(OUT,{recursive:true});
const SIZES=[['390x844',390,844,true],['390x700',390,700,true],['320x568',320,568,true],['1366x768',1366,768,false],['1920x1080',1920,1080,false]];
const engines=(process.argv.slice(2).length?process.argv.slice(2):['chromium','webkit','firefox']).filter(n=>{try{return fs.existsSync(pw[n].executablePath());}catch{return false;}});
let pass=0;const ok=(c,m)=>{if(!c)throw Error('FAIL '+m);pass++;console.log('PASS '+m);};
// an /api/order request in the log: its action and order (the body starts with Telegram's long initData)
const reqOf=r=>{try{const b=JSON.parse(r.postData()||'{}');return J({a:b.a,cur:b.cur,q:b.q,desc:b.desc});}catch{return '?';}};
const LEAVE={waitUntil:'domcontentloaded',timeout:90000},ONLY=process.env.STORE_ONLY||'';   // STORE_ONLY=website | telegram: one surface (debugging)
const J=JSON.stringify;
// the same look at every size: no sideways scroll, every store button a real target, the price in this surface's currency
async function storeChecks(pg,tag,want){
 await pg.waitForSelector('.labshop:not(.cqshop)',{timeout:30000});await pg.waitForSelector('.cqshop',{timeout:30000});
 const r=await pg.evaluate(()=>{const bs=[...document.querySelectorAll('[data-act="labbuy"],[data-act="cqbuy"]')].filter(b=>b.offsetParent),cp=[...document.querySelectorAll('.curpick button')].map(b=>b.textContent.trim());
  return {fits:document.documentElement.scrollWidth<=innerWidth+1,n:bs.length,small:bs.filter(b=>{const q=b.getBoundingClientRect();return q.height<44||q.width<44;}).length,labels:[...new Set(bs.map(b=>b.textContent.replace(/[\d.,]+/g,'#')))],cur:save.payCur,picker:cp,
   points:/never give(s)? (airdrop )?points/i.test(document.querySelector('.labshop:not(.cqshop)').textContent)&&/airdrop points/i.test(document.querySelector('.cqshop').textContent),wall:/walls only/.test(document.querySelector('.cqshop').textContent)};});
 ok(r.fits&&r.n>=20&&r.small===0,tag+': the store fits the width, '+r.n+' live buy buttons, every one at least 44 px');
 ok(J(r.picker)===J(want.picker)&&r.labels.every(l=>l.endsWith(want.unit)),tag+': pay with '+r.picker.join(' / ')+'; every price in '+want.unit.trim()+' ('+r.labels.slice(0,3).join(' ')+')');
 ok(r.points&&r.wall,tag+': says purchases never give airdrop points, and rare ore is for walls only');
 return r;}
// the website's own "Protect your purchases" prompt (web/account-prompts.js) comes up after a first purchase: captured once, then "Not now"
let protectShot=null;
async function prompts(pg,touch){const w=pg.locator('.lw-prompt-wrap [data-p="later"]');if(!(await w.count()))return;if(protectShot){await protectShot();protectShot=null;}if(touch)await w.first().tap();else{await w.first().focus();await pg.keyboard.press('Enter');}await pg.waitForTimeout(250);}
// scroll a part of the page into view in one step inside the page (the Shop re-renders after a sync: a held element can go stale)
const into=(pg,sel)=>pg.evaluate(q=>{const e=document.querySelector(q);if(e)e.scrollIntoView({block:'start'});},sel);
async function press(pg,loc,touch){await prompts(pg,touch);if(touch)await loc.tap();else{await loc.focus();await pg.keyboard.press('Enter');}}
async function sheetOf(pg){return pg.evaluate(()=>{const s=document.querySelector('.cosheet');if(!s)return null;const qr=s.querySelector('.coqr svg'),q=qr&&qr.getBoundingClientRect();
 return {text:s.innerText,steps:[...s.querySelectorAll('.costeps li')].map(l=>l.className),qr:q?Math.round(Math.min(q.width,q.height)):0,qrShown:!!(s.querySelector('.coqr')&&getComputedStyle(s.querySelector('.coqr')).display!=='none'),links:[...s.querySelectorAll('a.btn')].map(a=>a.textContent.trim()),copy:s.querySelectorAll('[data-act="cocopy"]').length,manualOpen:!!(s.querySelector('.comanual')&&s.querySelector('.comanual').open),fits:document.documentElement.scrollWidth<=innerWidth+1,o:coOpen&&coOpen.o};});}
// Check now checks at once (it used to restart a 2.5 s wait: tapped every 2 s it never checked); then the delivery, tapping it now and then
async function waitDelivered(pg,touch,log){
 const n=()=>log.filter(x=>/^REQ .*"a":"status"/.test(x)).length,n0=n(),b=pg.locator('[data-act="cocheck"]');await press(pg,b.first(),touch);
 const t0=Date.now();let quick=false;for(let k=0;k<20;k++){if(n()>n0){quick=Date.now()-t0<1500;break;}await pg.waitForTimeout(75);}
 for(let i=0;i<30;i++){const st=await pg.evaluate(()=>coOpen&&coOpen.o&&coOpen.o.st);if(st==='paid')return {paid:true,quick};if(i%3===2&&await b.count())await press(pg,b.first(),touch).catch(()=>{});await pg.waitForTimeout(700);}
 return {paid:false,quick};}
// a first purchase asks for the terms once (js/ui.js askTerms): read it, capture it, agree; the purchase then goes on by itself
async function terms(pg,touch,shot){const t=pg.locator('[data-act="termsok"]');try{await t.waitFor({timeout:6000});}catch{return false;}if(shot)await shot('terms');await press(pg,t,touch);return true;}
async function closeReveal(pg){for(let i=0;i<4;i++){const b=pg.locator('[data-act="revealok"]');if(!(await b.count()))break;await b.first().click().catch(()=>{});await pg.waitForTimeout(250);}}
// ================================================== the website: GRAM and SOL ==================================================
async function website(browser,name){
 const PORT=8000+Math.floor(Math.random()*900),BASE='https://127.0.0.1:'+PORT;
 execFileSync('node',['worker/build-web.mjs'],{cwd:ROOT,stdio:'ignore'});
 const key=path.join(OUT,'fixture-key.pem'),cert=path.join(OUT,'fixture-cert.pem');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
 const srv=spawn('node',['dev/tests/webserver.mjs'],{cwd:ROOT,env:{...process.env,LUNAR_FIXTURE_PORT:String(PORT),LUNAR_WEB_ORIGIN:BASE,LUNAR_TLS_KEY:key,LUNAR_TLS_CERT:cert},stdio:['ignore','pipe','inherit']});
 await new Promise((res,rej)=>{srv.stdout.on('data',d=>{if(String(d).includes('ready'))res();});setTimeout(()=>rej(Error('website fixture did not start')),60000);});
 try{
  for(const [tag0,w,h,touch] of SIZES){const tag=name+' website '+tag0,opts={viewport:{width:w,height:h},ignoreHTTPSErrors:true,deviceScaleFactor:1};if(touch&&name!=='firefox'){opts.isMobile=true;opts.hasTouch=true;}
   const ctx=await browser.newContext(opts);await ctx.route('**/*',r=>r.request().url().startsWith(BASE)?r.continue():r.abort());
   // the fake chain is told about a payment through this page's own context (a second context would hide the page and pause its timers)
   const post=(p,b)=>ctx.request.post(BASE+p,{data:b}).then(r=>r.json());
   const pg=await ctx.newPage(),errs=[],orderLog=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('request',r=>{if(/\/api\/order$/.test(r.url()))orderLog.push('REQ '+reqOf(r));});pg.on('response',async r=>{if(/\/api\/order$/.test(r.url())){let t;try{t=(await r.text()).slice(0,160);}catch(e){t='(body: '+e.message+')';}orderLog.push('RESP '+r.status()+' '+t);}});
   const shot=n=>pg.screenshot({path:path.join(OUT,name+'-website-'+n+'-'+tag0+'.png')});protectShot=()=>shot('protect-prompt');
   // a new account (call sign + password), straight into the game
   const cs=('St'+name[0]+w+Date.now().toString(36)).slice(0,16);
   await pg.goto(BASE+'/web/login.html#play',LEAVE);await pg.waitForSelector('#su-cs');
   await pg.locator('#su-cs').fill(cs);await pg.waitForFunction(()=>/available/.test(document.querySelector('#su-cs-msg').textContent),null,{timeout:15000});
   await pg.locator('#su-pw').fill('moon tank 42');await pg.locator('#su-go').click();
   await pg.waitForURL('**/web/play.html#play',{timeout:30000});await pg.waitForFunction(()=>typeof save!=='undefined'&&!!save&&!!save.lab&&document.querySelector('#web-loading')?.hidden===true,null,{timeout:60000});
   await pg.evaluate(()=>{save.welcomed=true;closeAll();setTab('shop');});await pg.waitForTimeout(600);
   // 1. the store: GRAM first (the website's main store), SOL beside it, never Stars
   await storeChecks(pg,tag,{picker:['GRAM formerly TON','SOL'],unit:' GRAM'});
   await into(pg,'.labshop:not(.cqshop)');await pg.waitForTimeout(200);await shot('store-lab');
   await into(pg,'.cqshop');await pg.waitForTimeout(200);await shot('store-conquest');
   // 2. a GRAM checkout: the Field kit (a server quote: the exact amount, the memo, the price held 30 minutes)
   await press(pg,pg.locator('[data-act="labbuy"][data-arg="rspack:kit"]'),touch);ok(await terms(pg,touch,shot),tag+': a first purchase shows the terms once (no cash value, refunds, the liquidity pool), then goes on');
   await pg.waitForSelector('.cosheet',{timeout:20000});if(!touch)await pg.waitForSelector('.coqr svg',{timeout:15000});await pg.waitForTimeout(700);
   let s=await sheetOf(pg);
   ok(s.o&&s.o.cur==='TON'&&s.o.amt===1.6&&/^LWM\|/.test(s.o.memo)&&s.o.base==='1600000000'&&/1\.6 GRAM/.test(s.text)&&/Price held \d+ min/.test(s.text)&&s.fits,tag+': GRAM checkout: 1.6 GRAM, the order\'s own memo, the price held, fits');
   ok(J(s.steps)===J(['on','',''])&&/Approve in your wallet/.test(s.text)&&/Delivered/.test(s.text)&&/never give airdrop points/.test(s.text),tag+': three honest steps (approve, confirming, delivered); no airdrop points');
   if(touch)ok(!s.qrShown&&s.links.some(l=>/Keeper/.test(l))&&!s.manualOpen&&s.copy===3,tag+': on a phone: Pay in Keeper (Tonkeeper) and another wallet first; the QR and the by-hand details stay folded');
   else ok(s.qrShown&&s.qr>=240&&s.manualOpen&&s.copy===3,tag+': on a computer: the QR first ('+s.qr+' px), the amount, address and comment with Copy buttons');
   await shot('checkout-gram');
   // the payment lands on the chain (the exact amount and memo); Check now finds it, the item arrives once
   await post('/__ton',{memo:s.o.memo,value:s.o.base});
   {const w=await waitDelivered(pg,touch,orderLog),d=w.paid;ok(w.quick,tag+': Check now asks the server at once');if(!d)console.error('ORDER LOG',orderLog.slice(-12).join('\n'),'\nERRORS',errs.join(' | '),'\nSTATE',J(await pg.evaluate(()=>({co:coOpen&&{st:coOpen.o.st,step:coOpen.step},ov:typeof overlays!=='undefined'?overlays.map(o=>o.key||o.kind||'?'):null,sheet:!!document.querySelector('.cosheet'),vis:document.visibilityState,poll:String(coPoll)}))));ok(d,tag+': GRAM payment found and delivered');}
   await pg.waitForTimeout(500);s=await sheetOf(pg);ok(s&&/Delivered\. It is already in your account/.test(s.text)&&/See the transaction/.test(s.text),tag+': the sheet says delivered, with the Tonviewer link');
   await shot('checkout-gram-delivered');
   await closeReveal(pg);await pg.evaluate(()=>closeAll());await pg.waitForTimeout(300);
   ok(await pg.evaluate(()=>(save.bpt&&save.bpt.thermal)>=1),tag+': the Field kit\'s parts are on the account');
   // 3. SOL at the live GRAM rate (fixture: GRAM $3, SOL $150): the Lab crate (4 GRAM = about 0.08 SOL), its reference key
   await press(pg,pg.locator('.curpick button',{hasText:'SOL'}),touch);await pg.waitForTimeout(500);
   await storeChecks(pg,tag+' (SOL)',{picker:['GRAM formerly TON','SOL'],unit:' SOL'});
   await press(pg,pg.locator('[data-act="labbuy"][data-arg="rspack:crate"]'),touch);await pg.waitForSelector('.cosheet',{timeout:20000});if(!touch)await pg.waitForSelector('.coqr svg',{timeout:15000});await pg.waitForTimeout(700);
   s=await sheetOf(pg);
   ok(s.o&&s.o.cur==='SOL'&&Math.abs(s.o.amt-0.08)<0.001&&s.o.ref&&/≈ \$12/.test(s.text)&&s.links.some(l=>/Phantom/.test(l)),tag+': SOL checkout: '+(s.o&&s.o.amt)+' SOL (≈ $12 at the live rate), its own reference, Phantom / Solflare / Backpack');
   if(!touch)ok(s.qr>=240,tag+': the Solana Pay QR on a computer ('+s.qr+' px)');
   await shot('checkout-sol');
   await post('/__sol',{ref:s.o.ref,lamports:s.o.base});
   {const w=await waitDelivered(pg,touch,orderLog);ok(w.paid&&w.quick,tag+': SOL payment found by its reference and delivered (Check now at once)');}
   await closeReveal(pg);await pg.evaluate(()=>closeAll());await pg.waitForTimeout(300);
   // 4. the receipts: Settings > Purchases (and the Shop's Purchases button)
   await press(pg,pg.locator('.paybar [data-act="purchases"]'),touch);await pg.waitForSelector('.receipt',{timeout:20000});await pg.waitForTimeout(300);
   const rc=await pg.evaluate(()=>({rows:[...document.querySelectorAll('.receipt')].map(r=>({t:r.innerText,cls:r.className})),fits:document.documentElement.scrollWidth<=innerWidth+1}));
   ok(rc.fits&&rc.rows.length===2&&rc.rows.every(r=>/Delivered/.test(r.t)&&/order /.test(r.t)&&/See the transaction/.test(r.t))&&rc.rows.some(r=>/GRAM/.test(r.t))&&rc.rows.some(r=>/SOL/.test(r.t)),tag+': two receipts: item, time, amount, method, order id, Delivered, the transaction link');
   await shot('receipts');await pg.evaluate(()=>closeAll());
   ok(!errs.length,tag+': no page errors '+errs.slice(0,3).join(' | '));
   await ctx.close();}
 }finally{srv.kill();}}
// ================================================== Telegram: Stars, and GRAM behind the switch ==================================================
async function telegram(browser,name){
 const srv=spawn('node',['dev/tests/conquest-server.mjs'],{cwd:ROOT,stdio:['ignore','pipe','inherit']});
 const ready=await new Promise((res,rej)=>{srv.stdout.once('data',d=>{try{res(JSON.parse(String(d).split('\n')[0]));}catch(e){rej(e);}});setTimeout(()=>rej(Error('conquest server did not start')),60000);});
 const base='http://127.0.0.1:'+ready.port,api=async(p,b)=>(await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})})).json();
 const pieces=['command-standard','fire-sunlance','armor-brass','command-wings','fire-ionwake','armor-ceramic','base-bastion','command-orrery','fire-prism','armor-radiant'];
 try{
  let i=0;
  for(const [tag0,w,h,touch] of SIZES){const tag=name+' telegram '+tag0,opts={viewport:{width:w,height:h},deviceScaleFactor:1};if(touch&&name!=='firefox'){opts.isMobile=true;opts.hasTouch=true;}
   const ctx=await browser.newContext(opts),pg=await ctx.newPage(),errs=[],orderLog=[];pg.on('pageerror',e=>errs.push(String(e)));pg.on('request',r=>{if(/\/api\/order$/.test(r.url()))orderLog.push('REQ '+reqOf(r));});pg.on('response',async r=>{if(/\/api\/order$/.test(r.url())){let t;try{t=(await r.text()).slice(0,140);}catch(e){t='(body)';}orderLog.push('RESP '+r.status()+' '+t);}});
   const shot=n=>pg.screenshot({path:path.join(OUT,name+'-telegram-'+n+'-'+tag0+'.png')});
   await pg.addInitScript(d=>{window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.__invoices=[];
    window.Telegram={WebApp:{initData:d,initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},platform:'ios',version:'8.0',ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},
     HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},MainButton:{hide(){},show(){},setText(){},onClick(){},offClick(){}},BackButton:{hide(){},show(){},onClick(){},offClick(){}},
     openLink(u){window.__opened=u;},openTelegramLink(u){window.__opened=u;},
     // Telegram's own payment sheet: the pilot pays; Telegram asks the Worker (the pre-checkout query), then sends the payment
     openInvoice(link,cb){window.__invoices.push(link);fetch('https://lunar.test/__stars',{method:'POST',body:JSON.stringify({link})}).then(r=>r.json()).then(j=>cb(j.ok?'paid':'failed')).catch(()=>cb('failed'));}}};},ready.initData);
   await pg.route('**/*',async r=>{const u=new URL(r.request().url());
    if(u.hostname==='lunar.test'&&u.pathname.startsWith('/__')){const resp=await fetch(base+u.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:r.request().postData()||'{}'});return r.fulfill({status:resp.status,body:await resp.text(),contentType:'application/json'});}
    if(u.pathname.startsWith('/api/')){try{const resp=await fetch(base+u.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:r.request().postData()||'{}'});return r.fulfill({status:resp.status,body:await resp.text(),contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'}});}catch{return r.fulfill({status:503,body:'{}',contentType:'application/json'});}}
    const f=path.join(ROOT,u.pathname.replace(/^\//,''));if(u.hostname==='lunar.test'&&fs.existsSync(f)&&fs.statSync(f).isFile())return r.fulfill({path:f});
    if(u.hostname==='telegram.org')return r.fulfill({body:'',contentType:'application/javascript'});
    return r.abort();});
   await pg.goto('https://lunar.test/index.html',LEAVE);await pg.waitForFunction(()=>typeof save!=='undefined'&&!!save&&typeof checkout==='function',null,{timeout:60000});
   await pg.evaluate(()=>{closeAll();save.welcomed=true;try{localStorage.setItem('lunar-conquest-onboarding-v1','1');}catch(e){}});
   await pg.waitForFunction(()=>typeof payRailsSrv!=='undefined'&&payRailsSrv&&payRailsSrv.stars,null,{timeout:30000});   // the server's rails came with the sync
   await pg.evaluate(()=>{save.payCur='stars';setTab('shop');});await pg.waitForTimeout(600);
   // 1. the store: Stars and GRAM (the switch on), Stars first
   await storeChecks(pg,tag,{picker:['Stars','GRAM formerly TON'],unit:' ⭐'});
   await into(pg,'.cqshop');await pg.waitForTimeout(200);await shot('store-conquest');
   await into(pg,'.labshop:not(.cqshop)');await pg.waitForTimeout(200);await shot('store-lab');
   // 2. Stars: a collection piece through Telegram's own sheet (the Worker's pre-checkout re-check, then the signed payment webhook)
   const star=pieces[i++],gram=pieces[i++];
   await into(pg,'[data-act="cqbuy"][data-arg="cos:'+star+'"]');await shot('checkout-stars');
   await press(pg,pg.locator('[data-act="cqbuy"][data-arg="cos:'+star+'"]'),touch);{const shown=await terms(pg,touch,i===2?shot:null);if(i===2)ok(shown,tag+': a first purchase in Telegram shows the terms once (kept on this device after)');}
   await pg.waitForFunction(()=>window.__invoices.length>0,null,{timeout:20000});
   await pg.waitForFunction(id=>save.cqc&&save.cqc[id],star,{timeout:30000});
   await pg.waitForSelector('.reveal',{timeout:20000});await pg.waitForTimeout(400);
   const rv=await pg.evaluate(()=>({t:document.querySelector('.reveal').innerText,art:document.querySelector('.reveal canvas')?.dataset.art}));
   ok(/In your Conquest collection for good/.test(rv.t)&&rv.art==='cos:'+star,tag+': Stars: Telegram\'s sheet, the Worker\'s pre-checkout, the payment: '+star+' delivered with its reveal card');
   await shot('stars-delivered');await closeReveal(pg);
   // 3. GRAM in Telegram while the switch is on: the transfer sheet (Keeper, another wallet), then delivered
   await pg.evaluate(()=>{closeAll();save.payCur='ton';uiDirty('shop');setTab('shop');});await pg.waitForTimeout(500);
   await storeChecks(pg,tag+' (GRAM)',{picker:['Stars','GRAM formerly TON'],unit:' GRAM'});
   await press(pg,pg.locator('[data-act="cqbuy"][data-arg="cos:'+gram+'"]'),touch);await pg.waitForSelector('.cosheet',{timeout:20000});if(!touch)await pg.waitForSelector('.coqr svg',{timeout:15000});await pg.waitForTimeout(600);
   let s=await sheetOf(pg);if(!touch)ok(s.qrShown&&s.qr>=240,tag+': Telegram on a computer: the QR to scan with a phone wallet ('+s.qr+' px)');ok(s.o&&s.o.cur==='TON'&&/^LWM\|tg_8301\|/.test(s.o.memo)&&s.fits&&/GRAM/.test(s.text)&&!/\bTON chain\b/.test(s.text),tag+': GRAM in Telegram: the quote\'s memo and exact amount, named GRAM');
   await shot('checkout-gram');
   await api('/__ton',{memo:s.o.memo,value:s.o.base});{const w=await waitDelivered(pg,touch,orderLog);if(!w.paid||!w.quick)console.error('TG GRAM',J(w),'\nLOG',orderLog.slice(-8).join('\n'),'\nSTATE',J(await pg.evaluate(()=>({co:coOpen&&{st:coOpen.o.st,oid:coOpen.o.oid},ov:overlays.map(o=>o.key||'?'),btn:!!document.querySelector('[data-act="cocheck"]')}))));ok(w.paid&&w.quick,tag+': GRAM in Telegram delivered (Check now at once)');}
   await closeReveal(pg);await pg.evaluate(()=>closeAll());
   ok(await pg.evaluate(id=>!!(save.cqc&&save.cqc[id]),gram),tag+': the GRAM piece is on the account');
   // 4. the GRAM switch (owner: one step, no release): off -> Telegram shows Stars only and the server refuses a GRAM quote; then on
   if(tag0==='390x700'||tag0==='1366x768'){
    await api('/__gram',{on:false});await pg.evaluate(()=>doSync());await pg.waitForFunction(()=>payRailsSrv&&payRailsSrv.gram===false,null,{timeout:20000});
    await pg.evaluate(()=>{save.payCur='ton';setTab('shop');uiDirty('shop');});await pg.waitForTimeout(500);
    const off=await pg.evaluate(()=>({cur:payCurOk(),picker:document.querySelectorAll('.curpick button').length,label:document.querySelector('[data-act="labbuy"]').textContent}));
    const q=await pg.evaluate(async()=>{try{await api('/api/order',{a:'quote',cur:'TON',desc:{kind:'rspack',tk:'cache'}});return 'quoted';}catch(e){return String(e.message);}});
    ok(off.cur==='stars'&&off.picker===0&&/⭐/.test(off.label)&&q==='gram_off',tag+': the GRAM switch off: Stars only in Telegram, and the server refuses a GRAM quote (gram_off)');
    await shot('gram-switch-off');
    await api('/__gram',{on:true});await pg.evaluate(()=>doSync());await pg.waitForFunction(()=>payRailsSrv&&payRailsSrv.gram===true,null,{timeout:20000});
    ok(await pg.evaluate(()=>{setTab('shop');uiDirty('shop');return payCurs().join();})==='stars,ton',tag+': the switch back on: Stars and GRAM again');}
   // 5. the receipts
   await pg.evaluate(()=>{closeAll();setTab('shop');});await pg.waitForTimeout(300);
   await press(pg,pg.locator('.paybar [data-act="purchases"]'),touch);await pg.waitForSelector('.receipt',{timeout:20000});await pg.waitForTimeout(300);
   const rc=await pg.evaluate(()=>({rows:[...document.querySelectorAll('.receipt')].map(r=>r.innerText),fits:document.documentElement.scrollWidth<=innerWidth+1}));
   ok(rc.fits&&rc.rows.length>=2&&rc.rows.filter(r=>/Delivered/.test(r)).length>=2&&rc.rows.some(r=>/Stars/.test(r)&&/Telegram charge/.test(r))&&rc.rows.some(r=>/GRAM/.test(r)&&/See the transaction/.test(r)),tag+': receipts: the Stars charge and the GRAM transaction, each Delivered');
   await shot('receipts');await pg.evaluate(()=>closeAll());
   ok(!errs.length,tag+': no page errors '+errs.slice(0,3).join(' | '));
   await ctx.close();}
  const o=await api('/__orders');ok(Object.values(o.orders).filter(x=>x.st==='paid').length===10&&Object.keys(o.eco.cqc).length===10,'Telegram: ten pieces paid and delivered, each exactly once');
 }finally{srv.kill();}}
(async()=>{
 try{
  if(!engines.length)throw Error('no browser engine installed');
  for(const name of engines){const browser=await pw[name].launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});
   try{if(ONLY!=='telegram')await website(browser,name);if(ONLY!=='website')await telegram(browser,name);}finally{await browser.close();}}
  console.log('PASS store-browser ('+pass+' checks; captures in '+OUT+')');
 }catch(e){console.error(e);process.exit(1);}
})();
