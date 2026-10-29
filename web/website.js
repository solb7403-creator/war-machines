'use strict';
// Public website entry; the only identity comes from the official signed-login exchange.
const lunarOrigin=location.hostname==='solb7403-creator.github.io'?'https://lunar-api.solb7403.workers.dev':location.origin;
let loginBusy=false;
function loginNotice(message){const n=document.querySelector('#login-status');if(!n)return;n.hidden=false;n.textContent=message;const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Dismiss');close.onclick=()=>n.hidden=true;n.append(close);}
async function lunarLogin(target='play'){
 if(loginBusy)return;loginBusy=true;
 try{
  if(location.origin!==lunarOrigin){const ref=new URLSearchParams(location.search).get('ref');const context=ref&&/^tg_\d{3,16}$/.test(ref)?'?ref='+encodeURIComponent(ref):'';location.assign(lunarOrigin+'/web/'+context+'#'+target);return;}
  const session=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});if(session.ok){location.assign('/web/play.html#'+target);return;}
  const config=await fetch('/auth/config',{cache:'no-store'}).then(r=>r.json());
  if(!config.enabled){loginNotice('Website sign-in is awaiting Telegram authorization. You can keep playing with your existing account in the Telegram edition.');return;}
  const challenge=await fetch('/auth/challenge',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}).then(async r=>{if(!r.ok)throw Error('Login is unavailable. Please try again.');return r.json();});
  if(!window.Telegram?.Login)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://oauth.telegram.org/js/telegram-login.js';s.onload=resolve;s.onerror=()=>reject(Error('Telegram login could not load.'));document.head.append(s);});
  await new Promise((resolve,reject)=>Telegram.Login.auth({client_id:Number(challenge.client_id),scope:['profile'],nonce:challenge.nonce},async data=>{
   try{if(data?.error||!data?.id_token)throw Error('Login was cancelled or declined.');const r=await fetch('/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id_token:data.id_token})});if(!r.ok)throw Error('Telegram identity could not be verified. Please sign in again.');location.assign('/web/play.html#'+target);resolve();}catch(e){reject(e);}
  }));
 }catch(e){loginNotice(e.message||'Could not sign in.');}finally{loginBusy=false;}
}
window.lunarLogin=lunarLogin;
document.addEventListener('click',e=>{const el=e.target.closest('[data-login],[data-enter]');if(el){e.preventDefault();lunarLogin(el.dataset.enter||'play');}});
if(location.search){const c=new URLSearchParams(location.search).get('ref');if(c&&/^tg_\d{3,16}$/.test(c))try{sessionStorage.setItem('lunar-acquisition-context',c);}catch{} } // Context only. Never forwarded as credited referral.
if(document.querySelector('#landing-machine')){
 const showroom=new LunarShowroom(document.querySelector('#landing-machine'));const L=structuredClone(STOCK_L);L.w.a='siege';L.looks={hull:'plates',mobility:'stock',mount:'firing'};showroom.setLoadout(L);
 document.addEventListener('click',e=>{const b=e.target.closest('[data-chassis],[data-rotate],[data-zoom]');if(!b)return;if(b.dataset.chassis){L.c.c=b.dataset.chassis;showroom.setLoadout(L);document.querySelector('#hero-class').textContent=L.c.c.toUpperCase();document.querySelectorAll('[data-chassis]').forEach(x=>x.classList.toggle('selected',x===b));}else if(b.dataset.rotate)showroom.rotate(Number(b.dataset.rotate));else showroom.setZoom(showroom.zoom+Number(b.dataset.zoom)*.12);});
 addEventListener('pagehide',()=>showroom.dispose(),{once:true});
}
