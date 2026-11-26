'use strict';
// =====================================================================
// checkout (Session 8, owner brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md): every purchase is a SERVER QUOTE first
// (/api/order), in every currency; the phone only shows it. Telegram: Stars (Telegram's own pay sheet is the confirmation) and GRAM
// while the owner's switch is on (TON Connect, or a transfer link); the website: GRAM (a transfer link + QR) and SOL (the wallet's
// own browser via pay.html, or Solana Pay QR, or an exact-amount send). GRAM is the TON coin, renamed June 15, 2026: the code's 'ton'
// ids stay, the player sees GRAM. A GRAM / SOL quote holds its price 30 minutes; the sheet shows three steps (approve in your wallet,
// confirming on chain, delivered), is safe to leave (the Worker finds the payment itself) and offers Check now, Copy details and Support.
// Receipts: Settings > Purchases (every order, its status and the transaction link).
// =====================================================================
const CUR_NAME={stars:'Stars',ton:'GRAM',sol:'SOL'},CUR_SRV={stars:'STARS',ton:'TON',sol:'SOL'},SRV_CUR={STARS:'stars',TON:'ton',SOL:'sol'};
let payRailsSrv=null,coOpen=null,coPoll=null;
// the rails this surface may pay with (the server decides; until the first sync the surface's own rule)
function payRails(){if(payRailsSrv)return payRailsSrv;return IN_WEB?{stars:false,gram:CRYPTO_PAY,sol:CRYPTO_PAY}:{stars:true,gram:false,sol:false};}
function payCurs(){const r=payRails(),o=[];if(r.stars)o.push('stars');if(r.gram)o.push('ton');if(r.sol)o.push('sol');return o.length?o:[IN_WEB?'ton':'stars'];}
// the picked currency, always one this surface may use (Telegram starts on Stars, the website on GRAM)
function payCurOk(){const cs=payCurs();if(!cs.includes(save.payCur)){save.payCur=cs[0];store();}return save.payCur;}
function curPick(act){const cs=payCurs();if(cs.length<2)return '';return '<div class="seg c'+cs.length+' curpick" role="radiogroup" aria-label="Pay with">'+cs.map(k=>'<button role="radio" aria-checked="'+(payCurOk()===k)+'" class="'+(save.payCur===k?'on':'')+'" data-act="'+(act||'paycur')+'" data-arg="'+k+'">'+(k==='ton'?'GRAM <small>formerly TON</small>':CUR_NAME[k])+'</button>').join('')+'</div>';}
function setPayRails(r){if(!r||typeof r!=='object')return;payRailsSrv={stars:!!r.stars,gram:!!r.gram,sol:!!r.sol};payCurOk();if(typeof uiDirty==='function')uiDirty('shop');}
// a price in the picked currency (labels): Stars, GRAM, or SOL at the live GRAM rate (the quote fixes the exact amount)
function curLabel(p){if(!p)return '';const c=payCurOk();if(c==='stars')return fmtNum(p.stars)+' ⭐';if(c==='sol'){if(!px.sol)fetchPrices();const s=solFor(p.ton);return s?s+' SOL':'… SOL';}return p.ton+' GRAM';}
const ERR_TXT={owned:'You already have this.',limit:'You reached this item\'s limit for now. It resets at 00:00 UTC (weekly limits on Monday).',cap:'Your wall extensions are at the +50% cap.',town:'This needs your town (and, for the Foundry speed-up, a Foundry).',none:'That timer already finished.',closed:'This isn\'t for sale right now.',item:'This item isn\'t for sale.',deal_used:'That deal is used. Check the new price.',gram_off:'GRAM isn\'t available in Telegram right now. Pay with Stars, or with GRAM on the website.',sol_web:'SOL is paid on the website.',stars_tg:'Stars are paid in Telegram.',pending:'SOL prices are loading. Try again in a minute.',rate:'Too many requests. Wait a few seconds.',busy:'The store is busy. Try again in a minute.',reused:'That transaction already paid another order. Message @LunarBattle.'};
// start a purchase: the server quotes it (every rule checked there), then the right checkout opens
async function checkout(desc){
 if(save.payCur==='pts')return;
 if(!ACCOUNT_OK){showToast('Sign in to buy.');return;}
 if(!save.termsOk&&typeof askTerms==='function'){askTerms(()=>checkout(desc));return;}
 const c=payCurOk(),cur=CUR_SRV[c];
 if(checkout.busy)return;checkout.busy=true;
 try{
  const r=await api('/api/order',{a:'quote',cur,desc});
  if(r.E&&typeof applyEco==='function')applyEco(r.E);
  if(c==='stars')return starsCheckout(r.order,desc);
  if(c==='ton'&&IN_TG&&!IN_WEB&&tonConnectUI&&tonWallet)return tonConnectPay(r.order,desc);
  coSheet(r.order,desc);
 }catch(e){const m=String(e&&e.message||'');
  if(m==='open_order'){showToast('You have an open payment for this item. Finish it or cancel it.');coResumeAll(true);return;}
  if(m==='deal_used'&&desc.deal){markDeal(desc.deal);store();uiDirty();}
  if(m==='gram_off'){payRailsSrv={...payRails(),gram:false};payCurOk();uiDirty('shop');}
  showToast(ERR_TXT[m]||'The store is unavailable right now. Try again in a minute.');
 }finally{checkout.busy=false;}
}
// ---- Stars: Telegram's own sheet; the Worker's pre-checkout re-checks the quote; the webhook grants it ----
function starsCheckout(o,desc){
 if(!IN_TG||!TG.openInvoice){showToast('Open the game in Telegram to pay with Stars');return;}
 TG.openInvoice(o.link,status=>{
  if(status==='paid'){save.purchases=save.purchases||[];save.purchases.push({cur:'STARS',amt:o.amt,what:o.item,memo:'STARS|'+o.oid,ts:Date.now()});save.spendStars=(save.spendStars||0)+o.amt;save.starsDone=save.starsDone||{};save.starsDone[o.oid]=1;starsAckQ.push(o.oid);store();starsDeliver(o.oid,0);}
  else if(status==='cancelled'){api('/api/order',{a:'cancel',q:o.oid}).catch(()=>{});showToast('Payment cancelled');}
  else if(status==='failed')showToast('Stars payment failed. Nothing was charged.');
  else if(status==='pending')showToast('Telegram is still confirming. It arrives the moment it does.');
 });
}
// ---- GRAM in Telegram with a connected wallet: TON Connect sends the quote's exact amount and memo; the sheet then confirms ----
async function tonConnectPay(o,desc){
 coSheet(o,desc,'approve');
 try{await tonConnectUI.sendTransaction({validUntil:Math.floor(Date.now()/1000)+600,messages:[{address:o.to,amount:String(o.base),payload:tonCommentPayload(o.memo)}]});coStep(o.oid,'confirm');}
 catch(e){if(e&&e.message&&/cancel|reject|declin/i.test(e.message)){showToast('Payment cancelled in the wallet');coStep(o.oid,'start');}else{showToast('The wallet couldn\'t send it. Use the transfer link below.');coStep(o.oid,'start');}}
}
// ---- the checkout sheet (GRAM and SOL): the quote, how to pay it, its live status ----
const tonLink=(o,app)=>(app?'https://app.tonkeeper.com/transfer/':'ton://transfer/')+o.to+'?amount='+o.base+'&text='+encodeURIComponent(o.memo);
const solPayUrl=o=>'solana:'+o.to+'?amount='+encodeURIComponent(o.amt)+'&reference='+encodeURIComponent(o.ref)+'&label='+encodeURIComponent('LUNAR: War Machines')+'&message='+encodeURIComponent(o.item)+'&memo='+encodeURIComponent(o.oid);
const solPage=(o,w)=>PAY_PAGE+'?a='+o.amt+'&r='+o.ref+'&m='+encodeURIComponent(o.oid)+'&d='+encodeURIComponent(o.item)+(o.usd?'&u='+o.usd:'')+'&w='+w;
const narrowPay=()=>innerWidth<720||matchMedia('(pointer:coarse)').matches;
function coSheet(o,desc,step){coOpen={o,desc,step:step||'start',at:Date.now()};save.coOpen=o.oid;store();
 sheet('checkout',()=>coHtml());coWatch();}
function coStep(oid,step){if(coOpen&&coOpen.o.oid===oid){coOpen.step=step;coRedraw();}}
function coRedraw(){const ov=findOv('checkout');if(!ov||!coOpen)return;const b=ov.box.querySelector('.cosheet');if(b){b.outerHTML=coHtml();coQr();}}
function coHtml(){const {o,step}=coOpen,t=o.cur==='TON',left=Math.max(0,o.e-Date.now()),m=Math.floor(left/60000),st=o.st,done=st==='paid',held=st==='held';
 const steps=[['approve',t?'Approve in your wallet':'Approve in your wallet'],['confirm','Confirming on '+(t?'the TON chain':'Solana')],['done','Delivered']],cur=done?2:step==='confirm'||coOpen.seen?1:0;
 const row=(lbl,val,k)=>'<div class="corow"><div><span class="lbl">'+lbl+'</span><b class="val'+(k==='addr'?' addr':'')+'">'+esc(val)+'</b></div><button class="btn sm btn-quiet" data-act="cocopy" data-arg="'+k+'">Copy</button></div>';
 const wal=t?'<a class="btn btn-go block" href="'+esc(tonLink(o,true))+'" target="_blank" rel="noopener">Pay '+o.amt+' GRAM in Keeper (Tonkeeper)</a><a class="btn btn-quiet block" href="'+esc(tonLink(o,false))+'">Another TON wallet</a>'+(IN_TG&&tonConnectUI?'<button class="btn btn-quiet block" data-act="cotonc">Pay with a connected wallet (TON Connect)</button>':''):
  ['phantom','solflare','backpack'].map(w=>'<a class="btn '+(w==='phantom'?'btn-go':'btn-quiet')+' block" href="'+esc(SOL_WALLETS[w].ul(solPage(o,w)))+'" target="_blank" rel="noopener">Pay in '+SOL_WALLETS[w].n+'</a>').join('');
 return '<div class="cosheet" data-oid="'+o.oid+'"><h3>'+esc(o.item)+'</h3>'+
  '<div class="coamt"><b class="num">'+o.amt+'</b> '+(t?'GRAM':'SOL')+(o.usd?'<span class="mut"> ≈ $'+o.usd+'</span>':'')+'</div>'+
  '<ol class="costeps">'+steps.map(([k,l],i)=>'<li class="'+(i<cur?'ok':i===cur?'on':'')+'">'+l+'</li>').join('')+'</ol>'+
  (done?'<p class="cook">✓ Delivered. It is already in your account.</p>'+(o.tx?'<p class="mut">'+txLink(o)+'</p>':'')+'<button class="btn btn-go block" data-act="coclose">Done</button>':
   held?'<p class="cobad">This payment arrived but nothing could be granted ('+esc(o.err||'held')+'). A refund is due: message @LunarBattle with your Player ID.</p>'+(o.tx?'<p class="mut">'+txLink(o)+'</p>':'')+'<button class="btn btn-quiet block" data-act="coclose">Close</button>':
   '<div class="coqr" aria-hidden="'+(narrowPay()?'true':'false')+'"></div>'+wal+
   '<details class="comanual"'+(narrowPay()?'':' open')+'><summary>Pay by hand (exact amount'+(t?' and comment':'')+')</summary>'+row('AMOUNT',String(o.amt)+(t?' GRAM':' SOL'),'amt')+row('ADDRESS',o.to,'addr')+(t?row('COMMENT (REQUIRED)',o.memo,'memo'):'')+
    '<p class="mut">'+(t?'Send exactly this amount with this comment: the comment is how the game finds your payment.':'Send exactly this amount: it is unique to this order.')+'</p></details>'+
   '<p class="mut costatus">'+(coOpen.short?'The payment found is below the price. Send the exact amount.':'Price held '+m+' min. Safe to leave: it arrives the moment it confirms.')+'</p>'+
   '<div class="acts"><button class="btn btn-quiet" data-act="cocheck">Check now</button><button class="btn btn-quiet" data-act="cocancel">Cancel</button></div>'+
   '<p class="dimtxt">Purchases never give airdrop points. Help: @LunarBattle with your Player ID.</p>')+'</div>';}
const txLink=o=>o.cur==='TON'?'<a href="https://tonviewer.com/transaction/'+encodeURIComponent(o.tx)+'" target="_blank" rel="noopener">See the transaction</a>':o.cur==='SOL'?'<a href="https://solscan.io/tx/'+encodeURIComponent(o.tx)+'" target="_blank" rel="noopener">See the transaction</a>':'Telegram charge '+esc(String(o.tx).slice(-12));
// the desktop QR (a GRAM transfer link, or Solana Pay with the order's reference): drawn with the vendored qrcode.js, loaded on demand
let qrLoad=null;
function coQr(){const ov=findOv('checkout'),box=ov&&ov.box.querySelector('.coqr');if(!box||!coOpen||narrowPay()||coOpen.o.st!=='open')return;
 const draw=()=>{try{const q=qrcode(0,'M');q.addData(coOpen.o.cur==='TON'?tonLink(coOpen.o,false):solPayUrl(coOpen.o));q.make();box.innerHTML=q.createSvgTag({cellSize:6,margin:3,scalable:true});const sv=box.querySelector('svg');if(sv){sv.setAttribute('role','img');sv.setAttribute('aria-label','Scan with your phone\'s wallet');}box.insertAdjacentHTML('beforeend','<small>Scan with your phone\'s wallet</small>');}catch(e){box.remove();}};
 if(typeof qrcode==='function'){draw();return;}
 if(!qrLoad)qrLoad=new Promise((ok,no)=>{const s=document.createElement('script');s.src=(IN_WEB?'/js/':'js/')+'vendor/qrcode.js';s.onload=ok;s.onerror=no;document.head.appendChild(s);});
 qrLoad.then(draw).catch(()=>box.remove());}
// the order's status, every 4 s while the sheet is open (and on return to the page), then every 20 s in the background
function coWatch(){clearTimeout(coPoll);const tick=async()=>{if(!coOpen)return;const o=coOpen.o;
  try{const r=await api('/api/order',{a:'status',q:o.oid});if(r.E&&typeof applyEco==='function')applyEco(r.E);if(r.order){coOpen.o={...o,...r.order};coOpen.short=!!r.short;if(r.order.st==='paid'){coDone(coOpen.o,r.outs||r.order.out||[]);return;}if(r.order.st==='held'){coRedraw();save.coOpen=null;store();return;}if(r.order.st==='cancelled'){coOpen=null;save.coOpen=null;store();return;}}}catch(e){}
  coRedraw();coPoll=setTimeout(tick,findOv('checkout')?4000:20000);};
 coQr();coPoll=setTimeout(tick,2500);}
function coDone(o,outs){save.coOpen=null;save.purchases=save.purchases||[];save.purchases.push({cur:o.cur,amt:o.amt,what:o.item,memo:o.memo||o.oid,proof:o.tx||'',ts:Date.now()});store();
 coOpen={o,desc:coOpen&&coOpen.desc,step:'done'};coRedraw();showOuts(outs||[]);showToast('Delivered: '+o.item);uiDirty('shop');coAfter(o);}
// a Conquest purchase: the town reads the account at once (the second builder, a finish, the looks...)
function coAfter(o){try{const k=o.d&&o.d.kind;if(['cq','cos','orecrate','cfin','rsfin','rspack','rsleg'].includes(k)&&typeof conquestShopRefresh==='function')conquestShopRefresh();}catch(e){}}
// resume: an open GRAM / SOL order from the server (sync) or this phone keeps being checked until it confirms
function coResume(list){const open=(list||[]).filter(o=>o&&o.open);if(!open.length)return;const o=open.find(x=>x.oid===save.coOpen)||open[0];if(coOpen&&coOpen.o.oid===o.oid)return;coOpen={o,step:'confirm',at:Date.now()};coWatch();}
async function coResumeAll(show){try{const r=await api('/api/order',{a:'list'});const open=(r.orders||[]).filter(o=>o.open&&o.cur!=='STARS');if(!open.length)return;coOpen={o:open[0],step:'confirm',at:Date.now()};if(show)sheet('checkout',()=>coHtml());coWatch();}catch(e){}}
addEventListener('focus',()=>{if(coOpen&&coOpen.o.st==='open'){clearTimeout(coPoll);coWatch();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&coOpen&&coOpen.o.st==='open'){clearTimeout(coPoll);coWatch();}});
// ---- receipts: Settings > Purchases (every order: item, amount, method, time, status, the transaction link) ----
const RST={paid:'Delivered',held:'Held: refund due',refunded:'Refunded',cancelled:'Cancelled',open:'Waiting for payment'};
function purchasesHtml(L){
 const rows=L.length?L.map(o=>{const s=o.st==='open'&&!o.open?'cancelled':o.st;return '<div class="receipt st-'+esc(s)+'"><div class="grow"><b>'+esc(o.item)+'</b><span class="mut">'+new Date(o.t).toISOString().slice(0,16).replace('T',' ')+' UTC · '+o.amt+' '+(o.cur==='STARS'?'Stars':o.cur==='TON'?'GRAM':'SOL')+' · order '+esc(o.oid)+'</span>'+(o.tx&&s!=='open'?'<span class="mut">'+txLink(o)+'</span>':'')+'</div><span class="rst">'+(RST[s]||esc(s))+'</span>'+(o.open&&o.cur!=='STARS'?'<button class="btn sm btn-quiet" data-act="coresume" data-arg="'+esc(o.oid)+'">Open</button>':'')+'</div>';}).join(''):'<p class="mut">No purchases yet.</p>';
 return '<h3>Purchases</h3>'+rows+'<p class="dimtxt">Purchases never give airdrop points. A payment that couldn\'t be delivered is held for a refund: message @LunarBattle with your Player ID.</p>';}
async function openPurchases(){let L;try{L=(await api('/api/order',{a:'list'})).orders||[];}catch(e){showToast('Purchases are unavailable right now.');return;}sheet('purchases',()=>purchasesHtml(L));}
Object.assign(ACT,{
 cocopy:a=>{const o=coOpen&&coOpen.o;if(!o)return;const v=a==='amt'?String(o.amt):a==='addr'?o.to:o.memo;try{navigator.clipboard.writeText(v).then(()=>showToast('Copied'),()=>prompt('Copy:',v));}catch(e){prompt('Copy:',v);}},
 cocheck:()=>{if(coOpen){coOpen.seen=1;clearTimeout(coPoll);coWatch();showToast('Checking the chain…');}},
 cocancel:async()=>{const o=coOpen&&coOpen.o;if(!o)return;try{await api('/api/order',{a:'cancel',q:o.oid});}catch(e){}coOpen=null;save.coOpen=null;store();const ov=findOv('checkout');if(ov)closeOverlay(ov);showToast('Order cancelled. If you already paid, it still arrives.');},
 coclose:()=>{const ov=findOv('checkout');if(ov)closeOverlay(ov);if(coOpen&&coOpen.o.st!=='open')coOpen=null;},
 cotonc:()=>{const o=coOpen&&coOpen.o;if(!o)return;if(!tonConnectUI){initTonConnect();showToast('Loading wallets…');return;}if(!tonWallet){tonConnectUI.openModal();return;}tonConnectPay(o,coOpen.desc);},
 coresume:()=>{const ov=findOv('purchases');if(ov)closeOverlay(ov);coResumeAll(true);},
 purchases:()=>openPurchases()
});
