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
  const ref=new URLSearchParams(location.search).get('i');
  const context=ref&&/^[a-z0-9]{8}$/i.test(ref)?'?i='+encodeURIComponent(ref.toLowerCase()):'';
  location.assign(lunarOrigin+'/web/'+context+'#'+t);
  return;
 }
 // Open the first-party pilot verification screen; the Telegram bot confirms a one-time code.
 location.assign('/web/login.html#'+t);
}
window.lunarLogin=lunarLogin;
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-login],[data-enter]');
 if(el){e.preventDefault();lunarLogin(el.dataset.enter||'play');}
});
const parameters=new URLSearchParams(location.search);
// a squad invite (?i=<code>): kept 14 days on this site so it survives the sign-in redirects and closing Safari
const ref=parameters.get('i');
if(ref&&/^[a-hjkmnp-z2-9]{8}$/i.test(ref))try{const v=JSON.parse(localStorage.getItem('lunar-invite')||'null');if(!v||Date.now()-v.t>14*864e5)localStorage.setItem('lunar-invite',JSON.stringify({c:ref.toLowerCase(),t:Date.now()}));}catch{}
const loginError=parameters.get('login');
if(loginError){
 const notices={setup:'Telegram website sign-in awaits secure server setup.',rate:'Too many attempts. Please try again shortly.',expired:'Sign-in expired. Please try again.',invalid:'Telegram sign-in could not be verified. Please try again.',cancelled:'Telegram sign-in was cancelled.',exchange:'Telegram login could not complete. Please try again.',identity:'Telegram identity verification failed. Please try again.',unavailable:'Sign-in is temporarily unavailable.'};
 loginNotice(notices[loginError]||'Sign-in could not complete. Please try again.');
 if(window.history?.replaceState)window.history.replaceState(null,'','/web/'+location.hash);
}