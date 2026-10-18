'use strict';
// =====================================================================
// net: LUNAR server (verified Telegram login), leaderboard file, squad, payments (Stars / TON / SOL)
// =====================================================================
const API='https://lunar-api.solb7403.workers.dev';
const DB_PUBLIC='https://warmachines-a6034-default-rtdb.firebaseio.com';   // only the public leaderboard file is readable
let srvOff=0,srv=null,syncBusy=false,syncWant=false,syncTimer=null,lastSyncAt=0,starsAckQ=[],syncFails=0,lastCredit=null;
function api(path,body){
 return fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({initData:IN_TG?TG.initData:''},body||{}))})
  .then(r=>r.json().then(j=>{if(!r.ok)throw new Error(j.error||('http '+r.status));return j;}));
}
function initBackend(){
 if(IN_TG)doSync(true);
 checkPendingPurchase();checkPendingSol();
 if(save.payCur==='ton')setTimeout(initTonConnect,2500);
}
// ask for a sync soon (batched: at most one request every ~8s)
function syncPlayer(){
 if(!IN_TG||syncTimer)return;
 const wait=Math.max(1500,8000-(Date.now()-lastSyncAt));
 syncTimer=setTimeout(()=>{syncTimer=null;doSync(false);},wait);
}
async function doSync(boot){
 if(!IN_TG)return;
 if(syncBusy){syncWant=true;return;}
 syncBusy=true;lastSyncAt=Date.now();
 captureRef();
 const pw=calcPower(),brk=powerBracket(pw),ack=starsAckQ.splice(0);
 let credited=1;
 try{
  const r=await api('/api/sync',{earned:save.earned||0,boot:!!boot,power:pw,league:brk.key,wins:save.wins||0,losses:save.losses||0,mp:save.mp||0,refBy:save.refBy||'',starsAck:ack});
  srvOff=r.now-Date.now();srv=r.rec;credited=r.credited;syncFails=0;lastCredit=r;
  // the server is the floor: never show fewer points than the leaderboard has
  if(srv.pts>(save.earned||0)){save.pts=(save.pts||0)+srv.pts-(save.earned||0);save.earned=srv.pts;store();}
  if(r.stars&&r.stars.length)recoverStars(r.stars);
  if(typeof uiDirty==='function')uiDirty();
 }catch(e){starsAckQ.unshift(...ack);syncFails++;}
 syncBusy=false;
 if(syncWant){syncWant=false;syncPlayer();return;}
 const behind=srv&&(save.earned||0)>srv.pts&&srv.dailyPts<DAILY_CAP;
 if(syncFails&&syncFails<6)setTimeout(syncPlayer,10000*syncFails);
 else if(behind)setTimeout(syncPlayer,credited>0?0:30000);   // big claims bank in a few steps
}
// Stars purchases paid while the game was closed: deliver them now
function recoverStars(list){
 save.starsDone=save.starsDone||{};
 let n=0;
 for(const it of list){
  if(!it.n)continue;
  if(!save.starsDone[it.n]){
   save.starsDone[it.n]=1;n++;
   grantPurchase(it.k==='box'?{kind:'box',tk:it.t,ri:it.r,price:it.g,deal:it.x||null}:it.k==='paint'?{kind:'paint',id:it.t}:{kind:it.k});
  }
  starsAckQ.push(it.n);
 }
 store();if(n)showToast('Your Stars purchase was delivered');
 syncPlayer();
}

// ---- leaderboard: one small file the server rebuilds every 5 minutes ----
let lbCache=null,lbCacheT=0,lbMeta=null,lbBusy=false;
function loadLB(force){
 const now=Date.now();
 if(lbBusy||(!force&&lbCache&&now-lbCacheT<60000))return;
 lbBusy=true;
 fetch(DB_PUBLIC+'/lb.json?t='+Math.floor(now/30000)).then(r=>r.json()).then(lb=>{
  lbBusy=false;lbCacheT=Date.now();
  if(!lb||!lb.top){lbCache=[];lbMeta={n:0,cut:0,t:0};if(typeof uiDirty==='function')uiDirty('ranks');return;}
  const m={};
  for(const [id,n,pts,days,lg] of lb.top)m[id]={id,n,pts,days,league:lg||'',dailyPts:0,weeklyPts:0};
  for(const [id,n,s2] of (lb.daily||[])){m[id]=m[id]||{id,n,pts:0,days:0,league:'',dailyPts:0,weeklyPts:0};m[id].dailyPts=s2;}
  for(const [id,n,s2] of (lb.weekly||[])){m[id]=m[id]||{id,n,pts:0,days:0,league:'',dailyPts:0,weeklyPts:0};m[id].weeklyPts=s2;}
  lbCache=Object.values(m);lbMeta={n:lb.n||0,cut:lb.cut||0,t:lb.t||0,inTop:lb.top.length};
  if(typeof uiDirty==='function')uiDirty('ranks');
 }).catch(()=>{lbBusy=false;lbCacheT=Date.now()-45000;});
}
// your rank by lifetime points, from the leaderboard file plus your own live total
function myRank(pts){
 if(!lbCache)return null;
 const me=playerKey();let above=0;
 for(const p of lbCache)if(p.id!==me&&p.pts>pts)above++;
 const inList=lbMeta&&lbMeta.inTop>=1000&&pts<lbMeta.cut;
 return inList?{rank:null,outside:true}:{rank:above+1,outside:false};
}
// your recruits come from the server (only you can see them)
let squadCache=null,squadT=0,squadBusy=false;
function loadSquad(force){
 if(!IN_TG||squadBusy||(!force&&squadCache&&Date.now()-squadT<60000))return;
 squadBusy=true;
 api('/api/squad',{}).then(r=>{squadCache=r.squad||[];squadT=Date.now();squadBusy=false;if(typeof uiDirty==='function')uiDirty('quests');}).catch(()=>{squadBusy=false;squadT=Date.now()-45000;});
}
let adminData=null;
function loadAdmin(){if(!IN_TG){adminData={error:'Open the game in Telegram to see server stats'};return;}adminData={loading:true};api('/api/admin',{}).then(r=>{adminData=r;uiDirty('admin');}).catch(e=>{adminData={error:String(e.message||e)};uiDirty('admin');});}

// ================= payments =================
const TON_RECIPIENT='UQAq3MBfPQ7Wqo5kL7631yEDKf2E9GOmZdhOfLUWhUiACfzu';  // Jake's Tonkeeper - receives all TON payments
const TON_MANIFEST_URL='https://solb7403-creator.github.io/war-machines/tonconnect-manifest.json';
const SOL_RECIPIENT='A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE'; // Jake's War Machines SOL wallet
const PAY_PAGE='https://solb7403-creator.github.io/war-machines/pay.html';
let tonConnectUI=null,tonWallet=null,tonLoading=false;
function newMemo(){return 'LWM|'+playerKey()+'|'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function descLabel(d){
 if(!d)return 'Purchase';
 if(d.kind==='box')return TIER_N[d.ri]+' '+(d.tk==='weapon'?'Weapon Cache':d.tk==='chassis'?'Chassis Crate':'Gem Cache');
 if(d.kind==='paint')return 'Paint: '+((PAINTS[d.id]||{}).n||d.id);
 return d.kind==='moonbeam'?'Moonbeam':d.kind==='skin'?'Lunar Skin':d.kind==='starter'?'Starter Pack':d.kind==='founder'?'Founder Pack':d.kind==='pass'?'Lunar Pass, season '+seasonNo():'Purchase';
}
// record a confirmed payment locally and on the server (which re-checks it on-chain)
function logPayment(rec){
 save.purchases=save.purchases||[];save.purchases.push(rec);
 if(rec.cur==='SOL')save.spendSol=Math.round(((save.spendSol||0)+rec.amt)*1e6)/1e6;
 store();
 if(!IN_TG)return;
 const send=(k)=>api('/api/pay-log',{cur:rec.cur,amt:rec.amt,gram:rec.gram,usd:rec.usd||0,item:rec.what,memo:rec.memo,proof:rec.proof||''}).catch(()=>{if(k<3)setTimeout(()=>send(k+1),20000*(k+1));});
 send(0);
}
// TON text comment as a one-cell BOC (opcode 0 + UTF-8 text), base64 for TON Connect payload
function tonCommentPayload(txt){
 const tb=Array.from(new TextEncoder().encode(txt)).slice(0,120),n=4+tb.length;
 const b=[0xb5,0xee,0x9c,0x72,0x01,0x01,0x01,0x01,0x00,2+n,0x00,0x00,2*n,0,0,0,0].concat(tb);
 let bin='';b.forEach(x=>bin+=String.fromCharCode(x));return btoa(bin);
}
// live prices so SOL costs about the same $ as the TON price
let px={ton:0,sol:0,t:0},pxBusy=false;
function fetchPrices(){
 if(pxBusy||Date.now()-px.t<300000)return;
 pxBusy=true;
 fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana&vs_currencies=usd')
  .then(r=>r.json()).then(d=>{const t=d['the-open-network'].usd,s=d.solana.usd;if(t>0&&s>0){px={ton:t,sol:s,t:Date.now()};uiDirty('shop');}})
  .catch(()=>{}).finally(()=>{pxBusy=false;});
}
function solFor(ton){if(!px.ton||!px.sol)return 0;const v=ton*px.ton/px.sol;return v>=1?Math.round(v*1000)/1000:Math.round(v*10000)/10000;}
function priceLabel(ton,stars){
 if(save.payCur==='stars')return fmtNum(stars)+' ⭐';
 if(save.payCur==='sol'){const s=solFor(ton);return s?s+' SOL':'… SOL';}
 return ton+' TON';
}
function pay(ton,desc){
 if(save.payCur==='pts')return;
 if(!save.termsOk&&typeof askTerms==='function'){askTerms(()=>pay(ton,desc));return;}   // agree to the terms once, before the first purchase
 if(save.payCur==='stars')payWithStars(ton,desc);else if(save.payCur==='sol')payWithSol(ton,desc);else payWithTon(ton,desc);
}
// ---- Telegram Stars: invoice created + payment confirmed by the LUNAR server ----
let starsBusy=false;
async function payWithStars(ton,desc){
 if(!IN_TG||!TG.openInvoice){showToast('Open the game in Telegram to pay with Stars');return;}
 if(starsBusy)return;starsBusy=true;showToast('Opening Stars checkout…');
 try{
  const d=await api('/api/stars-invoice',{kind:desc.kind,tk:desc.kind==='paint'?desc.id:desc.kind==='pass'?String(seasonNo()):desc.tk,ri:desc.ri,price:ton,deal:desc.deal||''});
  if(!d.link)throw new Error(d.error||'invoice');
  TG.openInvoice(d.link,status=>{
   starsBusy=false;
   if(status==='paid'){
    save.purchases=save.purchases||[];save.purchases.push({cur:'STARS',amt:d.stars,gram:ton,what:descLabel(desc),memo:'STARS|'+d.nonce,ts:Date.now()});
    save.spendStars=(save.spendStars||0)+d.stars;save.starsDone=save.starsDone||{};save.starsDone[d.nonce]=1;starsAckQ.push(d.nonce);store();
    grantPurchase(desc);syncPlayer();
   }else if(status==='cancelled')showToast('Payment cancelled');
   else if(status==='failed')showToast('Stars payment failed. Nothing was charged.');
  });
 }catch(e){starsBusy=false;
  if(e&&e.message==='deal_used'){markDeal(desc.deal);store();if(typeof uiDirty==='function')uiDirty();showToast('You already used this deal. Check the new price.');return;}   // used on another device
  showToast('Stars checkout is unavailable right now. Try again in a minute.');}
}
// ---- SOL: Solana Pay reference key lets us find exactly this payment on-chain ----
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes){let d=[0];for(const by of bytes){let c=by;for(let i=0;i<d.length;i++){c+=d[i]<<8;d[i]=c%58;c=(c/58)|0;}while(c){d.push(c%58);c=(c/58)|0;}}
 let out='';for(const by of bytes){if(by===0)out+='1';else break;}for(let i=d.length-1;i>=0;i--)out+=B58[d[i]];return out;}
const SOL_REF=encodeURIComponent('https://solb7403-creator.github.io');
const SOL_WALLETS={
 phantom:{n:'Phantom',ul:u=>'https://phantom.app/ul/browse/'+encodeURIComponent(u)+'?ref='+SOL_REF},
 solflare:{n:'Solflare',ul:u=>'https://solflare.com/ul/v1/browse/'+encodeURIComponent(u)+'?ref='+SOL_REF},
 backpack:{n:'Backpack',ul:u=>'https://backpack.app/ul/v1/browse/'+encodeURIComponent(u)+'?ref='+SOL_REF},
 other:{n:'Keeper / other',ul:null}};
const SOL_ORDER=['phantom','solflare','backpack','other'];
function payWithSol(ton,desc){
 const sol=solFor(ton);
 if(!sol){fetchPrices();showToast('Loading the SOL price. Tap again in a second.');return;}
 const ref=b58(crypto.getRandomValues(new Uint8Array(32))),memo=newMemo();
 // unique tail (1-999 micro-SOL) makes each order's exact amount identifiable on-chain
 const lamports=Math.floor(sol*1e9/1e6)*1e6+(1+Math.floor(Math.random()*999))*1e3;
 const solX=(lamports/1e9).toFixed(6).replace(/0+$/,'');
 save.pendingSol={desc,gram:ton,sol:+solX,lamports,ref,memo,since:Date.now(),usd:Math.round(ton*px.ton*100)/100};store();
 const q='?a='+solX+'&r='+ref+'&m='+encodeURIComponent(memo)+'&d='+encodeURIComponent(descLabel(desc))+'&u='+(save.pendingSol.usd||'');
 const w=SOL_WALLETS[save.solWallet]?save.solWallet:'phantom',page=PAY_PAGE+q+'&w='+w;
 const link=SOL_WALLETS[w].ul?SOL_WALLETS[w].ul(page):page;
 try{if(IN_TG)TG.openLink(link);else window.open(link,'_blank');}catch(e){window.open(link,'_blank');}
 showToast(SOL_WALLETS[w].ul?'Approve in '+SOL_WALLETS[w].n+', then come back':'Send the exact amount, then come back');
 watchSol(900000);
}
// several public Solana endpoints: if one blocks or rate-limits the Telegram webview, try the next
const SOL_RPCS=['https://solana-rpc.publicnode.com','https://api.mainnet-beta.solana.com','https://solana.drpc.org','https://rpc.ankr.com/solana'];
let solRpcI=0;
async function solRpc(method,params){
 let lastErr;
 for(let k=0;k<SOL_RPCS.length;k++){
  const url=SOL_RPCS[(solRpcI+k)%SOL_RPCS.length];
  try{
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
   if(!r.ok)throw new Error('http '+r.status);
   const d=await r.json();if(d.error)throw new Error(d.error.message||'rpc');
   solRpcI=(solRpcI+k)%SOL_RPCS.length;return d.result;
  }catch(e){lastErr=e;}
 }
 throw lastErr||new Error('no rpc');
}
async function findSolPayment(p){
 // 1) wallet-link payments carry our reference key; 2) manual sends (Keeper etc.) match by exact unique amount
 let sigs=await solRpc('getSignaturesForAddress',[p.ref,{limit:5,commitment:'confirmed'}])||[];
 const exactOnly=!sigs.length;
 if(exactOnly)sigs=(await solRpc('getSignaturesForAddress',[SOL_RECIPIENT,{limit:40,commitment:'confirmed'}])||[]).filter(sg=>!sg.blockTime||sg.blockTime*1000>=p.since-60000);
 for(const sg of sigs){
  if(sg.err)continue;
  const tx=await solRpc('getTransaction',[sg.signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'confirmed'}]);
  if(!tx||!tx.meta||tx.meta.err)continue;
  const keys=tx.transaction.message.accountKeys.map(k=>k.pubkey||k),i=keys.indexOf(SOL_RECIPIENT);
  if(i<0)continue;
  const got=tx.meta.postBalances[i]-tx.meta.preBalances[i];
  if(exactOnly?got===p.lamports:got>=p.lamports*0.999)return sg.signature;
 }
 return null;
}
let solWatch=null;
function watchSol(ms){
 if(solWatch)return;
 const t0=Date.now();
 const tick=async()=>{
  const p=save.pendingSol;if(!p){solWatch=null;return;}
  try{const sig=await findSolPayment(p);
   if(sig&&save.pendingSol){save.pendingSol=null;
    logPayment({cur:'SOL',amt:p.sol,gram:p.gram,usd:p.usd,what:descLabel(p.desc),memo:p.memo,proof:sig,ts:Date.now()});
    grantPurchase(p.desc);solWatch=null;uiDirty('shop');return;}
  }catch(e){}
  if(Date.now()-t0>ms){solWatch=null;return;}
  solWatch=setTimeout(tick,2500);
 };
 solWatch=setTimeout(tick,1500);
}
function checkPendingSol(){
 const p=save.pendingSol;if(!p)return;
 if(Date.now()-p.since>24*3600*1000){save.pendingSol=null;store();return;}
 watchSol(600000);
}
// coming back from the wallet app: resume checking right away
function payResume(){if(save&&save.pendingSol){clearTimeout(solWatch);solWatch=null;watchSol(600000);}if(save&&save.pendingTx)checkPendingPurchase();}
try{if(TG&&TG.onEvent)TG.onEvent('activated',payResume);}catch(e){}
addEventListener('focus',payResume);addEventListener('pageshow',payResume);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)payResume();});
// ---- TON Connect (loads only when someone pays with TON) ----
function initTonConnect(attempt){
 attempt=attempt||0;
 try{
  if(tonConnectUI)return;
  if(typeof TON_CONNECT_UI==='undefined'){
   if(!tonLoading){tonLoading=true;const sc=document.createElement('script');sc.src='https://unpkg.com/@tonconnect/ui@2.0.9/dist/tonconnect-ui.min.js';document.head.appendChild(sc);}
   if(attempt<40)setTimeout(()=>initTonConnect(attempt+1),250);
   return;
  }
  tonConnectUI=new TON_CONNECT_UI.TonConnectUI({manifestUrl:TON_MANIFEST_URL});
  tonConnectUI.onStatusChange(w=>{tonWallet=w;uiDirty('shop');});
 }catch(e){console.log('TON Connect init failed:',e);}
}
function tonWalletButton(){
 if(tonWallet&&tonConnectUI){try{tonConnectUI.disconnect();}catch(e){}showToast('Wallet disconnected');}
 else if(tonConnectUI)tonConnectUI.openModal();
 else{showToast('Loading wallets…');initTonConnect();setTimeout(()=>{if(tonConnectUI)tonConnectUI.openModal();},1500);}
}
// If the wallet app never returns to the page (common on iOS), confirm the payment on the TON chain by its memo instead.
async function verifyPurchaseOnChain(amount,sinceTs,timeoutMs,isDone,memo){
 const t0=Date.now();
 while(Date.now()-t0<timeoutMs){
  if(isDone())return false;
  try{
   const r=await fetch('https://toncenter.com/api/v2/getTransactions?address='+TON_RECIPIENT+'&limit=50');
   const d=await r.json();
   for(const t of (d.result||[])){
    if((t.utime*1000)<sinceTs-10000)continue;
    const val=parseInt(((t.in_msg||{}).value||'0'),10)/1e9;
    if(memo&&String((t.in_msg||{}).message||'')!==memo)continue; // only OUR payment counts
    if(val+1e-9>=amount)return (t.transaction_id&&t.transaction_id.hash)||true;
   }
  }catch(e){}
  await new Promise(r=>setTimeout(r,5000));
 }
 return false;
}
function checkPendingPurchase(){
 const p=save.pendingTx;
 if(!p||!p.desc)return;
 if(Date.now()-p.since>2*3600*1000){save.pendingTx=null;store();return;}
 verifyPurchaseOnChain(p.amount,p.since,60000,()=>false,p.memo).then(ok=>{
  if(ok&&save.pendingTx){logPayment({cur:'TON',amt:p.amount,gram:p.amount,what:descLabel(p.desc),memo:p.memo||'',proof:typeof ok==='string'?ok:'',ts:Date.now()});grantPurchase(p.desc);}
 });
}
async function payWithTon(amount,desc){
 if(!tonConnectUI){showToast('Loading wallets…');initTonConnect();return;}
 if(!tonWallet){tonConnectUI.openModal();showToast('Connect a TON wallet first');return;}
 const sinceTs=Date.now(),memo=newMemo();
 let granted=false;
 const grant=(proof)=>{if(granted)return;granted=true;
  logPayment({cur:'TON',amt:amount,gram:amount,usd:px.ton?Math.round(amount*px.ton*100)/100:0,what:descLabel(desc),memo,proof:proof||'',ts:Date.now()});
  grantPurchase(desc);};
 // persist so a closed/killed page can still complete the purchase on next launch
 if(desc){save.pendingTx={desc:desc,amount,since:sinceTs,memo};store();}
 verifyPurchaseOnChain(amount,sinceTs,180000,()=>granted,memo).then(ok=>{
  if(ok)grant(typeof ok==='string'?ok:'');
  else if(!granted)showToast('Payment not detected yet. If you paid, it unlocks automatically when it confirms.');
 });
 showToast('Waiting for your wallet…');
 try{
  const tx=pl=>tonConnectUI.sendTransaction({validUntil:Math.floor(Date.now()/1000)+300,
   messages:[Object.assign({address:TON_RECIPIENT,amount:Math.round(amount*1e9).toString()},pl?{payload:pl}:{})]});
  let res;
  try{res=await tx(tonCommentPayload(memo));}
  catch(e1){
   if(e1&&e1.message&&/cancel|reject|declin/i.test(e1.message))throw e1;
   res=await tx(null); // wallet refused the comment: pay without it (still logged with the memo here)
  }
  grant(res&&res.boc?'boc':'');
 }catch(e){
  if(e&&e.message&&/cancel|reject|declin/i.test(e.message)){save.pendingTx=null;store();showToast('Payment cancelled');}
  else showToast('Payment failed. Nothing was sent.');
 }
}
