'use strict';
// =====================================================================
// net: LUNAR server (verified Telegram login), leaderboard file, squad, payments (Stars / GRAM / SOL: js/checkout.js)
// =====================================================================
const API=IN_WEB?location.origin:'https://lunar-api.solb7403.workers.dev';
const DB_PUBLIC='https://warmachines-a6034-default-rtdb.firebaseio.com';   // only the public leaderboard file is readable
let srvOff=0,srv=null,syncBusy=false,syncWant=false,syncTimer=null,lastSyncAt=0,starsAckQ=[],syncFails=0,lastCredit=null;
function apiFetch(path,body,signal,keepalive){   // keepalive: the request outlives the page (a pagehide / navigation does not cancel it)
 return fetch(API+path,{method:'POST',...(keepalive?{keepalive:true}:{}),credentials:IN_WEB?'same-origin':'omit',headers:{'Content-Type':'application/json',...(IN_WEB?{'X-Lunar-CSRF':window.LUNAR_WEB.csrf}:{})},body:JSON.stringify(Object.assign({gv:PVP_V,initData:IN_TG?TG.initData:''},body||{})),signal});
}
function api(path,body){
 return apiFetch(path,body).then(r=>r.json().then(j=>{if(!r.ok){if(j.error==='update'){const q=new URLSearchParams(location.search);q.set('v',j.build||Date.now());location.replace(location.pathname+'?'+q.toString()+location.hash);}if(IN_WEB&&r.status===401)window.dispatchEvent(new Event('lunar-session-expired'));throw new Error(j.error||('http '+r.status));}return j;}));
}
function initBackend(){
 if(ACCOUNT_OK){doSync(true);setTimeout(()=>loadSquad(),3000);}   // the invite link is ready before the first win
 if(IN_WEB)return;
 if(save.payCur==='ton')setTimeout(initTonConnect,2500);   // Telegram: TON Connect for GRAM (open orders resume from the sync: js/checkout.js)
}
// ask for a sync soon (batched: at most one request every ~8s)
function syncPlayer(){
 if(!ACCOUNT_OK||syncTimer)return;
 const wait=Math.max(1500,8000-(Date.now()-lastSyncAt));
 syncTimer=setTimeout(()=>{syncTimer=null;doSync(false);},wait);
}
async function doSync(boot){
 if(!ACCOUNT_OK)return;
 if(syncBusy){syncWant=true;return;}
 syncBusy=true;lastSyncAt=Date.now();
 captureRef();
 if(SRV_ECO)await flushMatches();   // results waiting for the server go first, so its record includes them
 const ack=starsAckQ.splice(0);
 const body={lab:1,boot:!!boot,L:myLoadout(),starsAck:ack,did:deviceId(),dh:deviceHash()},ghAck=save.ghAck||0,inv=inviteCode();
 if(inv)body.inv=inv;   // a website invite code (server-issued); the server decides if this pilot can still be recruited
 if(ghAck)body.ghAck=ghAck;   // the ghost report we showed: the server can clear it
 // one time, the first time this pilot meets the server that owns the economy: this device's progress moves over
 // (the server checks it against payments and points on record, and flags what it can't explain)
 if(IN_TG&&SRV_ECO&&!save.migOk)body.mig=ecoCopy();
 try{
  const r=await api('/api/sync',body);
  if(/^(?:tg|ln)_\d{3,15}$/.test(String(r.pid||'')))VERIFIED_PID=r.pid; // Authenticated, server-owned player ID.
  if('cs' in r&&typeof setCallsign==='function'){setCallsign(r.cs);if(!r.cs&&boot)setTimeout(()=>askCallsign(false),1200);}
  srvOff=r.now-Date.now();srv=r.rec;syncFails=0;lastCredit=r;
  if(r.rec){save.refBy=r.rec.ref||null;if(r.rec.ref||(r.rec.days||0)>1)inviteDone();}   // the server's binding is the only one
  if(SRV_ECO){if(r.migOk)save.migOk=1;if(r.E&&!ecoBusy&&!(save.mq&&save.mq.length))applyEco(r.E);}
  if(r.stars&&r.stars.length)recoverStars(r.stars);
  if(r.pay&&typeof setPayRails==='function'){setPayRails(r.pay.rails);if(r.pay.open&&r.pay.open.length)coResume(r.pay.open);}   // Session 8: the rails this surface pays with (the GRAM switch), an open GRAM / SOL order to keep checking
  if(ghAck&&save.ghAck===ghAck)save.ghAck=0;
  if(r.ghost&&r.ghost.m&&typeof showGhostReport==='function'){save.ghAck=r.ghost.last||Date.now();showGhostReport(r.ghost);}
  store();
  if(typeof wikiDone==='function')setTimeout(wikiDone,300);   // opened from the wiki's end-of-page button
 }catch(e){starsAckQ.unshift(...ack);syncFails++;}
 syncBusy=false;
 if(syncWant){syncWant=false;syncPlayer();return;}
 if(syncFails&&syncFails<6)setTimeout(syncPlayer,10000*syncFails);
}
// Stars purchases paid while the game was closed. In Telegram the server already added them when Telegram confirmed
// the payment (it.o: what each gave); outside the server economy the phone grants them itself
function recoverStars(list){
 save.starsDone=save.starsDone||{};
 let n=0;
 for(const it of list){
  if(!it.n)continue;
  if(!save.starsDone[it.n]){
   save.starsDone[it.n]=1;n++;
   if(SRV_ECO)showOuts(it.o||[]);
   else grantPurchase(it.k==='box'||it.k==='core'||it.k==='gear'?{kind:it.k,tk:it.t,ri:it.r,price:it.g,deal:it.x||null,c:it.c||null}:it.k==='paint'?{kind:'paint',id:it.t}:{kind:it.k,c:it.c||null});
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
 // through the server's edge cache; straight from the database if that fails
 fetch(API+'/lb.json?t='+Math.floor(now/30000)).then(r=>{if(!r.ok)throw new Error('lb');return r.json();}).catch(()=>fetch(DB_PUBLIC+'/lb.json?t='+Math.floor(now/30000)).then(r=>r.json())).then(lb=>{
  lbBusy=false;lbCacheT=Date.now();
  if(!lb||!lb.top){lbCache=[];lbMeta={n:0,cut:0,t:0};if(typeof uiDirty==='function')uiDirty('ranks');return;}
  const m={};
  const row=(id,n)=>m[id]||(m[id]={id,n,pts:0,days:0,league:'',dailyPts:0,weeklyPts:0,vl:0,vg:0});
  for(const [id,n,pts,days,lg,vl] of lb.top)m[id]={id,n,pts,days,league:lg||'',dailyPts:0,weeklyPts:0,vl:vl||0,vg:0};
  for(const [id,n,s2,lg,vl] of (lb.daily||[])){const p=row(id,n);p.dailyPts=s2;p.league=p.league||lg||'';p.vl=Math.max(p.vl,vl||0);}   // rows carry the league key ('' until a pilot has one)
  for(const [id,n,s2,lg,vl] of (lb.weekly||[])){const p=row(id,n);p.weeklyPts=s2;p.league=p.league||lg||'';p.vl=Math.max(p.vl,vl||0);}
  for(const [id,n,g,vl] of (lb.vault||[])){const p=row(id,n);p.vg=g;p.vl=Math.max(p.vl,vl||0);}   // the Hyperspace Vault board: lifetime Gold
  lbCache=Object.values(m);lbMeta={n:lb.n||0,cut:lb.cut||0,t:lb.t||0,inTop:lb.top.length,lpf:lb.lpf||0,lps:lb.lps||0.25,ref:lb.ref||null};
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
let squadCache=null,squadInfo=null,squadT=0,squadBusy=false;
function loadSquad(force){
 if(!ACCOUNT_OK||squadBusy||(!force&&squadCache&&Date.now()-squadT<60000))return;
 squadBusy=true;
 api('/api/squad',{}).then(r=>{squadCache=r.squad||[];squadInfo={me:r.me||{},code:r.code||null,phase:r.phase||null,cap:r.cap||REF_PCT_CAP};squadT=Date.now();squadBusy=false;if(typeof uiDirty==='function')uiDirty('quests');}).catch(()=>{squadBusy=false;squadT=Date.now()-45000;});
}
let adminData=null;
function loadAdmin(extra){if(!IN_TG){adminData={error:'Open the game in Telegram to see server stats'};return;}if(!adminData||adminData.error)adminData={loading:true};api('/api/admin',extra||{}).then(r=>{adminData=r;uiDirty('admin');}).catch(e=>{adminData={error:String(e.message||e)};uiDirty('admin');});}

// ================= payments =================
const TON_RECIPIENT='UQAq3MBfPQ7Wqo5kL7631yEDKf2E9GOmZdhOfLUWhUiACfzu';  // the owner's wallet: receives every GRAM payment (the server's quote names it)
const TON_MANIFEST_URL='https://solb7403-creator.github.io/war-machines/tonconnect-manifest.json';
const SOL_RECIPIENT='A37J13iXXA47n4kFKvR9Cao1u8A6v3HP8qMCSCJDi7AE'; // Jake's War Machines SOL wallet
const PAY_PAGE='https://solb7403-creator.github.io/war-machines/pay.html';
let tonConnectUI=null,tonWallet=null,tonLoading=false;
// Session 8: every purchase is a server quote first (/api/order, js/checkout.js); the server finds GRAM and SOL payments on chain itself
// and grants them, so the phone keeps no payment queue of its own and never reports a payment's details (the old /api/pay-log is retired)
// TON text comment as a one-cell BOC (opcode 0 + UTF-8 text), base64 for TON Connect payload
function tonCommentPayload(txt){
 const tb=Array.from(new TextEncoder().encode(txt)).slice(0,120),n=4+tb.length;
 const b=[0xb5,0xee,0x9c,0x72,0x01,0x01,0x01,0x01,0x00,2+n,0x00,0x00,2*n,0,0,0,0].concat(tb);
 let bin='';b.forEach(x=>bin+=String.fromCharCode(x));return btoa(bin);
}
// live prices so SOL costs about the same $ as the GRAM price (labels only: the server's quote fixes the exact SOL amount)
let px={ton:0,sol:0,t:0},pxBusy=false;
function fetchPrices(){
 if(pxBusy||Date.now()-px.t<300000)return;
 pxBusy=true;
 // the website's security policy allows only its own server: it reads the rates there (Session 6B, worker /api/rates)
 (IN_WEB?fetch('/api/rates',{cache:'no-store'}).then(r=>r.json()).then(d=>({t:d.ton,s:d.sol})):fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,solana&vs_currencies=usd').then(r=>r.json()).then(d=>({t:d['the-open-network'].usd,s:d.solana.usd})))
  .then(({t,s})=>{if(t>0&&s>0){px={ton:t,sol:s,t:Date.now()};uiDirty('shop');}})
  .catch(()=>{}).finally(()=>{pxBusy=false;});
}
function solFor(ton){if(!px.ton||!px.sol)return 0;const v=ton*px.ton/px.sol;return v>=1?Math.round(v*1000)/1000:Math.round(v*10000)/10000;}
// prices in the surface's currency: Telegram Stars or GRAM, the website GRAM or SOL (SOL at the live GRAM rate; the quote fixes it)
function labPriceLabel(p){return curLabel(p);}
function priceLabel(ton,stars){return curLabel({ton,stars});}
// a purchase: the server quotes it with every rule checked (js/checkout.js); the price argument is only what the button showed
function pay(ton,desc){checkout(desc);}
// ---- Telegram Stars: invoice created + payment confirmed by the LUNAR server ----
// a paid Stars purchase: the server grants it when Telegram's confirmation arrives (usually within a second or two)
function starsDeliver(nonce,k){
 api('/api/act',{a:'paid',n:nonce}).then(r=>{
  if(r&&r.out&&r.out.outs){if(r.E)applyEco(r.E);showOuts(r.out.outs);return;}
  if(k<20)setTimeout(()=>starsDeliver(nonce,k+1),1500);else showToast('Payment received. Your item arrives in a moment.');
 }).catch(()=>{if(k<20)setTimeout(()=>starsDeliver(nonce,k+1),2500);});
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
// ---- TON Connect for GRAM in Telegram (loads only when someone pays with GRAM there) ----
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
// GRAM payments are found on chain by the server (js/checkout.js polls the order's status); TON Connect only sends the transfer
