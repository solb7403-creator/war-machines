'use strict';
// Web login uses a full-page authorization-code redirect. No popup or third-party cookies.
const lunarOrigin=location.hostname==='solb7403-creator.github.io'?'https://lunar-api.solb7403.workers.dev':location.origin;
const safeLoginTarget=t=>/^(play|garage|quests|ranks|shop|mode:(arena|zone|crystal|bounty|royale|boss))$/.test(String(t||''))?String(t):'play';
function loginNotice(message){
 const el=document.querySelector('#login-status');if(!el)return;
 el.hidden=false;el.textContent=message;
 const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Dismiss');
 close.onclick=()=>el.hidden=true;el.append(close);
}
function lunarLogin(target='play'){
 const t=safeLoginTarget(target);
 if(location.origin!==lunarOrigin){
  const ref=new URLSearchParams(location.search).get('ref');
  const context=ref&&/^tg_\d{3,16}$/.test(ref)?'?ref='+encodeURIComponent(ref):'';
  location.assign(lunarOrigin+'/web/'+context+'#'+t);
  return;
 }
 // The Worker creates a server-side PKCE challenge and redirects the top-level page to Telegram.
 // This works without popup messaging or depending on the Telegram JS SDK in iPhone Safari.
 location.assign('/auth/start?target='+encodeURIComponent(t));
}
window.lunarLogin=lunarLogin;
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-login],[data-enter]');
 if(el){e.preventDefault();lunarLogin(el.dataset.enter||'play');}
});
const parameters=new URLSearchParams(location.search);
const ref=parameters.get('ref');
if(ref&&/^tg_\d{3,16}$/.test(ref))try{sessionStorage.setItem('lunar-acquisition-context',ref);}catch{}
const loginError=parameters.get('login');
if(loginError){
 const notices={setup:'Telegram website sign-in awaits secure server setup.',rate:'Too many attempts. Please try again shortly.',expired:'Sign-in expired. Please try again.',invalid:'Telegram sign-in could not be verified. Please try again.',cancelled:'Telegram sign-in was cancelled.',exchange:'Telegram login could not complete. Please try again.',identity:'Telegram identity verification failed. Please try again.',unavailable:'Sign-in is temporarily unavailable.'};
 loginNotice(notices[loginError]||'Sign-in could not complete. Please try again.');
 if(window.history?.replaceState)window.history.replaceState(null,'','/web/'+location.hash);
}