'use strict';
// Create account (call sign + password) or log in. Telegram, Google and passkeys are optional alternatives.
// No identity, password or name is kept in localStorage; the session is a first-party HttpOnly cookie.
const target=/^(play|garage|quests|ranks|shop|engineer|range|mode:(arena|zone|crystal|bounty|royale|boss))$/.test(location.hash.slice(1))?location.hash.slice(1):'play';
const $=id=>document.getElementById(id);
const status=(t,bad)=>{const el=$('login-status');el.textContent=t||'';el.classList.toggle('bad',!!bad);};
const CS_RE=/^[A-Za-z0-9@_\-.!#$*+~^?=%:]{3,16}$/;
let busy=false,telegramPolling=false,telegramCommand='',timer=null,cfg={},checkTimer=null,checkSeq=0,tsToken='',tsWidget=null,mode='signup';
const post=async(path,body={},csrf)=>{
 const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(csrf?{'X-Lunar-CSRF':csrf}:{})},body:JSON.stringify(body)});
 let d;try{d=await r.json();}catch{d={};}
 if(!r.ok){const e=Error(d.msg||friendly(d.error)||'Something went wrong. Please try again.');e.data=d;e.status=r.status;throw e;}
 return d;
};
const friendly=c=>({rate:'Too many tries. Please wait a minute.',origin:'Please reload the page and try again.',account_service_unavailable:'The game server is busy. Please try again in a moment.',session_store:'The game server is busy. Please try again.',login_setup_required:'Telegram sign-in is not available right now.',expired:'That took too long. Please try again.'})[c];
const go=()=>{try{localStorage.setItem('lunar-had-account','1');}catch{}location.assign('/web/play.html#'+target);};
function deviceId(){try{let d=localStorage.getItem('lwm_did');if(!/^[0-9a-f]{16}$/.test(d||'')){d=[...crypto.getRandomValues(new Uint8Array(8))].map(x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem('lwm_did',d);}return d;}catch{return '';}}
// ---- an invite link (?i=<code>) is kept 14 days, through redirects, closing the browser and the signup form ----
function invite(){
 try{const m=/[?&]i=([a-hjkmnp-z2-9]{8})(?:&|$)/i.exec(location.search);if(m)localStorage.setItem('lunar-invite',JSON.stringify({c:m[1].toLowerCase(),t:Date.now()}));
  const v=JSON.parse(localStorage.getItem('lunar-invite')||'null');return v&&/^[a-hjkmnp-z2-9]{8}$/.test(v.c)&&Date.now()-v.t<14*864e5?v.c:'';}catch{return '';}
}
const inv=invite();
// ---- modes ----
function show(m){
 mode=m;
 for(const [id,on] of [['signup-form',m==='signup'],['login-form',m==='login'],['forgot-form',m==='forgot'],['reset-form',m==='reset']])$(id).hidden=!on;
 $('tab-signup').setAttribute('aria-selected',m==='signup');$('tab-login').setAttribute('aria-selected',m==='login'||m==='forgot');
 $('auth-title').innerHTML=m==='login'?'Welcome back. <em>Log in.</em>':m==='forgot'?'Get back in.':m==='reset'?'New password.':'Pick a call sign. <em>Start playing.</em>';
 $('others').hidden=m==='reset';
 passkeyLabel();status('');
}
// ---- password eye ----
document.addEventListener('click',e=>{const b=e.target.closest('[data-eye]');if(!b)return;const i=$(b.dataset.eye),on=i.type==='password';i.type=on?'text':'password';b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',on?'Hide password':'Show password');b.textContent=on?'🙈':'👁';i.focus();});
// ---- live call sign check (debounced; the server rate-limits it too) ----
function csLocal(v){
 if(!v)return 'Your name on the leaderboard. 3–16 characters, no spaces.';
 if(/\s/.test(v))return 'No spaces, please. Try '+v.replace(/\s+/g,'_').slice(0,16)+'.';
 if(/[^\x21-\x7e]/.test(v))return 'Use plain keyboard letters, numbers and symbols only (no emoji or accents).';
 if(v.length<3)return 'At least 3 characters.';
 if(!CS_RE.test(v))return 'Letters, numbers and @ _ - . ! # $ * + ~ ^ ? = % : only.';
 return '';
}
function csMsg(t,cls){const el=$('su-cs-msg');el.textContent=t;el.className='field-msg'+(cls?' '+cls:'');}
function setIdeas(list){
 const box=$('su-ideas');box.replaceChildren();box.hidden=!list?.length;
 for(const s of list||[]){const b=document.createElement('button');b.type='button';b.textContent=s;b.onclick=()=>{$('su-cs').value=s;checkCs(true);$('su-pw').focus();};box.append(b);}
}
async function checkCs(now){
 clearTimeout(checkTimer);const v=$('su-cs').value,local=csLocal(v),seq=++checkSeq;
 if(local){csMsg(local,v?'bad':'');setIdeas([]);return false;}
 csMsg('Checking…');
 const run=async()=>{
  try{const r=await post('/auth/acct/check',{cs:v});if(seq!==checkSeq)return r.available;
   if(r.available){csMsg('✓ '+v+' is available','good');setIdeas([]);}else{csMsg('✗ '+(r.msg||'That call sign is taken.')+(r.ideas?.length?' Try one of these:':''),'bad');setIdeas(r.ideas);}
   return r.available;
  }catch(e){if(seq===checkSeq)csMsg(e.message,'bad');return null;}
 };
 if(now)return run();
 checkTimer=setTimeout(run,450);return null;
}
$('su-cs').addEventListener('input',()=>checkCs(false));
function pwLocal(v){
 if(!v)return '';if(v.length<8)return 'At least 8 characters ('+(8-v.length)+' more).';
 if(/^(.)\1+$/.test(v)||/^(?:12345678|123456789|1234567890|password|password1|qwerty123|qwertyuiop|11111111|00000000|iloveyou|abcd1234)$/i.test(v))return 'That password is too common. Add a few words or numbers only you would think of.';
 return '';
}
$('su-pw').addEventListener('input',()=>{const m=pwLocal($('su-pw').value),el=$('su-pw-msg');el.textContent=m||($('su-pw').value?'✓ Looks good':'At least 8 characters. A short phrase is easy to remember.');el.className='field-msg'+(m?' bad':$('su-pw').value?' good':'');});
// ---- Turnstile (only asked for when signups from this network look automated) ----
function turnstile(siteKey){
 return new Promise((resolve,reject)=>{
  const box=$('su-turnstile');box.hidden=false;
  const render=()=>{try{if(tsWidget!==null)window.turnstile.reset(tsWidget);else tsWidget=window.turnstile.render(box,{sitekey:siteKey,callback:t=>{tsToken=t;resolve(t);},'error-callback':()=>reject(Error('The robot check could not load. Please try again.'))});}catch(e){reject(e);}};
  if(window.turnstile)return render();
  const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=render;s.onerror=()=>reject(Error('The robot check could not load. Please check your connection.'));document.head.append(s);
 });
}
function lock(on){busy=on;for(const id of ['su-go','li-go','fp-go','rs-go','passkey-btn','start-telegram'])if($(id))$(id).disabled=on;}
// ---- create account ----
$('signup-form').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;
 const cs=$('su-cs').value,pw=$('su-pw').value,lc=csLocal(cs),lp=pwLocal(pw)||(pw?'':'Choose a password (at least 8 characters).');
 if(lc){csMsg(lc,'bad');$('su-cs').focus();return;}
 if(lp){$('su-pw-msg').textContent=lp;$('su-pw-msg').className='field-msg bad';$('su-pw').focus();return;}
 lock(true);status('Creating your account…');
 try{
  for(let i=0;i<2;i++){
   try{await post('/auth/acct/signup',{cs,pw,keep:true,inv,did:deviceId(),ts:tsToken||undefined});break;}
   catch(err){if(err.status===428&&err.data?.siteKey&&i===0){status('One quick check…');await turnstile(err.data.siteKey);continue;}throw err;}
  }
  status('Welcome, '+cs+'! Starting your first battle…');go();
 }catch(err){
  const d=err.data||{};
  if(d.field==='cs'){csMsg('✗ '+err.message,'bad');setIdeas(d.ideas);$('su-cs').focus();status('');}
  else if(d.field==='pw'){$('su-pw-msg').textContent=err.message;$('su-pw-msg').className='field-msg bad';$('su-pw').focus();status('');}
  else if(d.error==='already_signed_in'){go();}
  else status(err.message,true);
  if(tsWidget!==null)try{window.turnstile.reset(tsWidget);tsToken='';}catch{}
 }finally{lock(false);}
});
// ---- log in ----
$('login-form').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;
 const cs=$('li-cs').value.trim(),pw=$('li-pw').value;
 if(!cs||!pw){status('Enter your call sign and password.',true);(cs?$('li-pw'):$('li-cs')).focus();return;}
 lock(true);status('Logging in…');
 try{await post('/auth/acct/login',{cs,pw,keep:$('li-keep').checked});status('Logged in. Loading your arsenal…');go();}
 catch(err){status(err.message,true);$('li-pw').select?.();}
 finally{lock(false);}
});
// ---- forgot / reset ----
$('forgot-open').onclick=()=>{show('forgot');$('fp-cs').value=$('li-cs').value;};
$('forgot-back').onclick=()=>show('login');
$('forgot-form').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;const cs=$('fp-cs').value.trim();
 if(!CS_RE.test(cs)){status('Enter your call sign.',true);return;}
 lock(true);
 try{const r=await post('/auth/acct/reset/request',{cs});status(r.email?'If that account has a confirmed recovery email, a reset link is on its way. Check your inbox (and spam).':'Recovery email is coming soon. Use another way in above, or contact support.');}
 catch(err){status(err.message,true);}finally{lock(false);}
});
$('reset-form').addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;const t=(/reset=([a-f0-9]{64})/.exec(location.hash)||[])[1];
 lock(true);
 try{await post('/auth/acct/reset/finish',{t,pw:$('rs-pw').value});history.replaceState(null,'','/web/login.html');status('Password saved.');go();}
 catch(err){status(err.message,true);}finally{lock(false);}
});
// ---- passkey (optional; shown only where this device can make one) ----
const to64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const from64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const createResponse=c=>({id:c.id,rawId:to64(c.rawId),type:c.type,authenticatorAttachment:c.authenticatorAttachment||undefined,response:{clientDataJSON:to64(c.response.clientDataJSON),attestationObject:to64(c.response.attestationObject),transports:c.response.getTransports?.()||[]},clientExtensionResults:c.getClientExtensionResults?.()||{}});
const loginResponse=c=>({id:c.id,rawId:to64(c.rawId),type:c.type,response:{clientDataJSON:to64(c.response.clientDataJSON),authenticatorData:to64(c.response.authenticatorData),signature:to64(c.response.signature),userHandle:c.response.userHandle?to64(c.response.userHandle):null},clientExtensionResults:c.getClientExtensionResults?.()||{}});
const regOptions=o=>({...o,challenge:from64(o.challenge),user:{...o.user,id:from64(o.user.id)},excludeCredentials:(o.excludeCredentials||[]).map(c=>({...c,id:from64(c.id)}))});
const authOptions=o=>({...o,challenge:from64(o.challenge),allowCredentials:(o.allowCredentials||[]).map(c=>({...c,id:from64(c.id)}))});
let passkeyName='Passkey';
function deviceKeyName(){
 const ua=navigator.userAgent||'',touchMac=/Macintosh/.test(ua)&&navigator.maxTouchPoints>1;
 if(/iPhone|iPad|iPod/.test(ua)||touchMac)return 'Face ID / Touch ID';
 if(/Android/.test(ua))return 'Fingerprint / screen lock';
 if(/Windows/.test(ua))return 'Windows Hello';
 if(/Macintosh/.test(ua))return 'Touch ID / passkey';
 return 'Passkey';
}
function passkeyLabel(){$('passkey-label').textContent=(mode==='signup'?'Create with ':'Log in with ')+passkeyName;}
async function passkeySetup(){
 try{
  if(!window.PublicKeyCredential||!navigator.credentials?.create)return;
  const ok=await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().catch(()=>false);
  if(!ok)return;
  passkeyName=deviceKeyName();$('passkey-btn').hidden=false;passkeyLabel();
 }catch{}
}
$('passkey-btn').addEventListener('click',async()=>{
 if(busy)return;const register=mode==='signup';
 if(register){const cs=$('su-cs').value,lc=csLocal(cs);if(lc){csMsg(lc||'Pick a call sign first.','bad');$('su-cs').focus();status('Pick your call sign first, then tap '+passkeyName+'.');return;}}
 lock(true);status(register?'Follow your device’s prompt…':'Confirm with '+passkeyName+'…');
 try{
  const o=await post(register?'/auth/lunar/register/options':'/auth/lunar/login/options',register?{name:$('su-cs').value,inv,did:deviceId()}:{});
  if(o.signedIn){go();return;}
  const c=register?await navigator.credentials.create({publicKey:regOptions(o.options)}):await navigator.credentials.get({publicKey:authOptions(o.options)});
  if(!c)throw Error('Nothing was selected.');
  await post(register?'/auth/lunar/register/verify':'/auth/lunar/login/verify',{credential:register?createResponse(c):loginResponse(c)});
  go();
 }catch(e){
  status(e.name==='NotAllowedError'?'Cancelled. You can use your password instead.':e.name==='InvalidStateError'?'This device already has a LUNAR passkey. Try Log in.':e.data?.field==='cs'?e.message:(e.data?.error==='unknown_passkey'?'That passkey isn’t linked to an account here. Log in with your call sign instead.':e.message),true);
 }finally{lock(false);}
});
// ---- Telegram (bot confirms a one-time code; works in every browser, no popups) ----
async function startTelegram(){
 if(busy)return;busy=true;if(timer){clearInterval(timer);timer=null;}
 $('telegram-box').hidden=false;$('retry-login').hidden=true;status('Preparing Telegram sign-in…');
 try{
  const d=await post('/auth/bot/start');if(d.signedIn){go();return;}
  if(!/^https:\/\/t\.me\/LunarWarMachinesBot\?start=web_[a-f0-9]{48}$/.test(d.url||''))throw Error('Telegram sign-in is not available right now.');
  telegramCommand=d.command;$('open-bot').href=d.url;$('login-command').textContent=telegramCommand;
  status('Open the bot, press Start, then come back here.');timer=setInterval(checkTelegram,2500);
 }catch(e){status(e.message,true);$('retry-login').hidden=false;}
 finally{busy=false;}
}
async function checkTelegram(){
 if(telegramPolling||document.hidden)return;telegramPolling=true;
 try{
  const r=await fetch('/auth/bot/finish',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{}'});
  if(r.status===202)return;const d=await r.json();
  if(r.ok&&d.ok){clearInterval(timer);timer=null;go();return;}
  if(r.status===401||r.status===503){clearInterval(timer);timer=null;$('retry-login').hidden=false;status('That code expired. Get a new one, or use your call sign and password.',true);}
 }catch{}finally{telegramPolling=false;}
}
$('start-telegram').addEventListener('click',startTelegram);
$('retry-login').addEventListener('click',startTelegram);
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(telegramCommand);$('copy-code').textContent='COPIED';}catch{status('Select the command to copy it.');}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&timer)checkTelegram();});
// ---- already signed in ----
async function checkExisting(){
 try{
  const r=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;
  const s=await r.json();$('existing-account').hidden=false;
  $('existing-message').textContent='You’re logged in'+(s.user?.callsign?' as '+s.user.callsign:'')+'.';
  $('continue-game').href='/web/play.html#'+target;
 }catch{}
}
$('switch-account').addEventListener('click',async()=>{
 try{const r=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});if(r.ok){const s=await r.json();await post('/auth/logout',{},s.csrf);}}catch{status('Could not log out. Please try again.',true);return;}
 $('existing-account').hidden=true;status('Logged out.');
});
// ---- keep the button above the on-screen keyboard ----
document.addEventListener('focusin',e=>{if(!e.target.matches('input'))return;const f=e.target.form;setTimeout(()=>{f?.querySelector('.go,[type=submit]')?.scrollIntoView({block:'nearest',behavior:'smooth'});},350);});
window.visualViewport?.addEventListener('resize',()=>{const a=document.activeElement;if(a?.matches?.('input'))a.form?.querySelector('[type=submit]')?.scrollIntoView({block:'nearest'});});
// ---- start ----
$('tab-signup').onclick=()=>{show('signup');$('su-cs').focus();};
$('tab-login').onclick=()=>{show('login');$('li-cs').focus();};
const params=new URLSearchParams(location.search);
if(/reset=[a-f0-9]{64}/.test(location.hash))show('reset');
else{let had=false;try{had=localStorage.getItem('lunar-had-account')==='1';}catch{}show(params.get('mode')==='login'||had?'login':'signup');}
const notices={google_off:'Google sign-in isn’t switched on yet. Use your call sign and password.',expired:'That took too long. Please try again.',invalid:'Sign-in could not be verified. Please try again.',cancelled:'Sign-in was cancelled.',identity:'Sign-in could not be verified. Please try again.',unavailable:'Sign-in is busy. Please try again.',retry:'Please try again.',rate:'Too many tries. Please wait a minute.'};
if(params.get('login'))status(notices[params.get('login')]||'Sign-in could not complete. Please try again.',true);
passkeySetup();checkExisting();
fetch('/auth/acct/config',{cache:'no-store'}).then(r=>r.json()).then(c=>{cfg=c;$('start-google').hidden=!c.google;$('forgot-email-li').hidden=!c.email;$('forgot-email-box').hidden=!c.email;if(c.telegram===false)$('start-telegram').hidden=true;}).catch(()=>{});
if(inv)post('/auth/acct/invite',{c:inv}).then(r=>{if(r.name){$('invited-by').textContent=r.name;$('invited').hidden=false;}}).catch(()=>{});
try{if(!sessionStorage.getItem('lunar-view')){sessionStorage.setItem('lunar-view','1');navigator.sendBeacon?.('/auth/acct/ping',new Blob([JSON.stringify({e:'view'})],{type:'application/json'}))||post('/auth/acct/ping',{e:'view'}).catch(()=>{});}}catch{}
// warm the game while the player types: same URLs the game page loads, so they come from the cache
(window.requestIdleCallback||(f=>setTimeout(f,1200)))(async()=>{try{const v=(await fetch('/version.json',{cache:'no-store'}).then(r=>r.json())).v;
 for(const s of ['rules','core','net','game','match','pvp','render','models3d','graphics','equipment3d','environment3d','proof','render3d','fx','ui','range']){const l=document.createElement('link');l.rel='prefetch';l.href='/js/'+s+'.js?v='+encodeURIComponent(v);document.head.append(l);}
 for(const s of ['/js/showroom.js','/web/game.js','/web/account-prompts.js']){const l=document.createElement('link');l.rel='prefetch';l.href=s+'?v='+encodeURIComponent(v);document.head.append(l);}
}catch{}});
