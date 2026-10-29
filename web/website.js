'use strict';
// Public website entry; the only identity comes from the official signed-login exchange.
const lunarOrigin=location.hostname==='solb7403-creator.github.io'?'https://lunar-api.solb7403.workers.dev':location.origin;
let loginBusy=false,loginPreparation=null,loginContext=null;
function loginNotice(message){const n=document.querySelector('#login-status');if(!n)return;n.hidden=false;n.textContent=message;const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Dismiss');close.onclick=()=>n.hidden=true;n.append(close);}
function prepareLogin(){
 if(location.origin!==lunarOrigin)return Promise.resolve();
 if(loginPreparation)return loginPreparation;
 loginPreparation=(async()=>{
  const session=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});if(session.ok){loginContext={signedIn:true};return;}
  const config=await fetch('/auth/config',{cache:'no-store'}).then(r=>r.json());
  if(!config.enabled){loginContext={setup:true};return;}
  const challenge=await fetch('/auth/challenge',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).then(async r=>{if(!r.ok)throw Error('Login is unavailable. Please try again.');return r.json();});
  if(!window.Telegram?.Login)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://oauth.telegram.org/js/telegram-login.js';script.onload=resolve;script.onerror=()=>reject(Error('Telegram login could not load.'));document.head.append(script);});
  loginContext=challenge;
 })().catch(e=>{loginContext=null;throw e;}).finally(()=>{loginPreparation=null;});
 return loginPreparation;
}
function lunarLogin(target='play'){
 if(loginBusy)return;
 if(location.origin!==lunarOrigin){const ref=new URLSearchParams(location.search).get('ref');const context=ref&&/^tg_\d{3,16}$/.test(ref)?'?ref='+encodeURIComponent(ref):'';location.assign(lunarOrigin+'/web/'+context+'#'+target);return;}
 if(loginContext?.signedIn){location.assign('/web/play.html#'+target);return;}
 if(loginContext?.setup){loginNotice('Website sign-in is awaiting Telegram authorization. You can keep playing with your existing account in the Telegram edition.');return;}
 if(!loginContext||loginContext.expires<Date.now()+5000){loginContext=null;loginNotice('Preparing secure sign-in…');prepareLogin().then(()=>loginNotice('Sign-in is ready. Tap Enter the game to continue.')).catch(e=>loginNotice(e.message));return;}
 const challenge=loginContext;loginBusy=true;
 // Open directly in the click event. Awaiting network requests here loses popup activation on Safari.
 try{Telegram.Login.auth({client_id:Number(challenge.client_id),scope:['profile'],nonce:challenge.nonce},async data=>{
  // Telegram's official SDK owns popup lifecycle; its documented API has no close().
  // Never let an optional popup action interrupt the signed-token exchange.
  try{
   if(data?.error||!data?.id_token)throw Error('Login was cancelled or declined.');
   loginNotice('Verifying your Telegram identity…');
   const r=await fetch('/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_token:data.id_token})});
   if(!r.ok)throw Error('Telegram identity could not be verified. Please sign in again.');
   location.assign('/web/play.html#'+target);
  }catch(e){loginNotice(e.message);}finally{loginBusy=false;loginContext=null;prepareLogin().catch(()=>{});}
 });}catch(e){loginBusy=false;loginNotice(e.message||'Could not open Telegram login.');}
}
prepareLogin().catch(()=>{});
window.lunarLogin=lunarLogin;
document.addEventListener('click',e=>{const el=e.target.closest('[data-login],[data-enter]');if(el){e.preventDefault();lunarLogin(el.dataset.enter||'play');}});
if(location.search){const c=new URLSearchParams(location.search).get('ref');if(c&&/^tg_\d{3,16}$/.test(c))try{sessionStorage.setItem('lunar-acquisition-context',c);}catch{} } // Context only. Never forwarded as credited referral.
