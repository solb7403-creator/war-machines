'use strict';
// Account settings: call sign, ways back in (passkey, Google, Telegram, recovery email), password, sessions, delete.
const $=id=>document.getElementById(id);
const say=(t,bad)=>{const e=$('account-status');e.textContent=t||'';e.classList.toggle('bad',!!bad);};
let session=null,me=null,linkTimer=null,linkCommand='',working=false;
async function post(path,b={}){
 const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(session?.csrf?{'X-Lunar-CSRF':session.csrf}:{})},body:JSON.stringify(b)});
 let d;try{d=await r.json();}catch{d={};}
 if(r.status===401&&d.error==='signed_out'){location.replace('/web/login.html?mode=login');throw Error('Please log in again.');}
 if(!r.ok){const e=Error(d.msg||'Something went wrong. Please try again.');e.data=d;throw e;}
 return d;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-eye]');if(!b)return;const i=$(b.dataset.eye),on=i.type==='password';i.type=on?'text':'password';b.textContent=on?'🙈':'👁';b.setAttribute('aria-label',on?'Hide password':'Show password');});
function keyName(){const ua=navigator.userAgent||'';if(/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1))return 'Face ID / Touch ID';if(/Android/.test(ua))return 'fingerprint / screen lock';if(/Windows/.test(ua))return 'Windows Hello';if(/Macintosh/.test(ua))return 'Touch ID / passkey';return 'a passkey';}
async function load(){
 try{
  const r=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok){location.replace('/web/login.html?mode=login');return;}
  session=await r.json();me=await post('/auth/acct/me');render();say('');
  const v=/verify=([a-f0-9]{64})/.exec(location.hash);
  if(v){try{await post('/auth/acct/email/verify',{t:v[1]});say('Recovery email confirmed.');me=await post('/auth/acct/me');render();}catch(e){say(e.message,true);}history.replaceState(null,'','/web/account.html');}
  const g=new URLSearchParams(location.search).get('google');
  if(g)say({linked:'Google is linked. You can now log in with Google.',taken:'That Google account is already used by another LUNAR account.',password_first:'Set a password first, then link Google.',cancelled:'Google linking was cancelled.'}[g]||'Google linking could not complete.',g!=='linked');
 }catch(e){say(e.message,true);}
}
function render(){
 $('settings').hidden=false;
 $('acct-cs').textContent=me.cs||'(not chosen yet)';$('pw-user').value=me.cs||'';
 $('acct-id').textContent='Player ID '+me.pid+(me.canChange&&me.cs?' · You can change your call sign once until '+new Date(me.changeUntil).toLocaleDateString():'');
 $('cs-form').hidden=!(me.canChange);
 const ways=[me.passkeys?'a passkey':'',me.google?'Google':'',me.telegram?'Telegram':'',me.email?.v?'a recovery email':''].filter(Boolean);
 $('protect-state').textContent=ways.length?'✓ Your way back in: '+ways.join(', ')+'.':'⚠ No recovery method yet. If you forget your password, the account is lost. Add one below.';
 $('protect-state').className='fine-print '+(ways.length?'good':'warn');
 $('link-google').hidden=!me.features.google||me.google||!me.hasPassword;
 $('link-telegram').hidden=me.telegram;
 $('email-soon').hidden=!!me.features.email;$('email').disabled=!me.features.email;$('email-go').disabled=!me.features.email;
 if(me.email)$('email').placeholder=me.email.a+(me.email.v?' (confirmed)':' (check your inbox)');
 $('pw-title').textContent=me.hasPassword?'Change password':'Set a password';
 $('cur-wrap').hidden=!(me.hasPassword&&me.via==='password');
 $('pw-form').hidden=!me.canSetPassword&&!me.hasPassword;
 if(!me.cs)$('pw-msg').textContent='Pick your call sign in the game first.';
 if(window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable)PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(ok=>{if(ok){$('passkey-name').textContent=keyName();$('add-passkey').hidden=false;}}).catch(()=>{});
}
$('cs-form').addEventListener('submit',async e=>{e.preventDefault();if(working)return;working=true;
 try{const r=await post('/auth/acct/callsign',{cs:$('cs-new').value});say('Your call sign is now '+r.cs+'.');me=await post('/auth/acct/me');render();}
 catch(err){$('cs-msg').textContent=err.message+(err.data?.ideas?.length?' Try: '+err.data.ideas.join(', '):'');$('cs-msg').className='field-msg bad';}
 finally{working=false;}});
$('pw-form').addEventListener('submit',async e=>{e.preventDefault();if(working)return;working=true;
 try{const r=await post('/auth/acct/password',{cur:$('pw-cur').value,pw:$('pw-new').value});session.csrf=r.csrf;$('pw-cur').value='';$('pw-new').value='';say('Password saved. Your other devices were logged out.');me=await post('/auth/acct/me');render();}
 catch(err){$('pw-msg').textContent=err.message;$('pw-msg').className='field-msg bad';}
 finally{working=false;}});
$('email-form').addEventListener('submit',async e=>{e.preventDefault();if(working)return;working=true;
 try{const r=await post('/auth/acct/email',{email:$('email').value});say(r.sent?'Check your inbox and tap the link to confirm.':'Saved, but the confirmation email could not be sent. Try again later.',!r.sent);me=await post('/auth/acct/me');render();}
 catch(err){say(err.message,true);}finally{working=false;}});
$('sign-out').addEventListener('click',async()=>{try{await post('/auth/logout');}catch{}location.assign('/web/login.html?mode=login');});
$('sign-out-all').addEventListener('click',async()=>{if(!confirm('Log out on every device, including this one?'))return;try{await post('/auth/acct/logout-all');}catch{}location.assign('/web/login.html?mode=login');});
$('del-form').addEventListener('submit',async e=>{e.preventDefault();if(working)return;
 if($('del-cs').value!==me.cs){say('Type your call sign exactly to confirm.',true);return;}
 if(!confirm('Delete your LUNAR account permanently? This can’t be undone.'))return;working=true;
 try{await post('/auth/acct/delete',{confirm:$('del-cs').value});location.assign('/web/?deleted=1');}catch(err){say(err.message,true);}finally{working=false;}});
// ---- passkey as an extra (never required) ----
const to64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const from64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const regOptions=o=>({...o,challenge:from64(o.challenge),user:{...o.user,id:from64(o.user.id)},excludeCredentials:(o.excludeCredentials||[]).map(c=>({...c,id:from64(c.id)}))});
const credResponse=c=>({id:c.id,rawId:to64(c.rawId),type:c.type,authenticatorAttachment:c.authenticatorAttachment||undefined,response:{clientDataJSON:to64(c.response.clientDataJSON),attestationObject:to64(c.response.attestationObject),transports:c.response.getTransports?.()||[]},clientExtensionResults:c.getClientExtensionResults?.()||{}});
$('add-passkey').addEventListener('click',async()=>{
 if(working)return;working=true;say('Follow your device’s prompt…');
 try{
  // a Telegram-only pilot without a LUNAR login gets the passkey on that same pilot (upgrade); everyone else adds one
  const lunar=me.kind==='lunar',o=await post(lunar?'/auth/lunar/addkey/options':'/auth/lunar/upgrade/options');
  const c=await navigator.credentials.create({publicKey:regOptions(o.options)});if(!c)throw Error('Nothing was created.');
  const r=await post(lunar?'/auth/lunar/addkey/verify':'/auth/lunar/upgrade/verify',{credential:credResponse(c)});
  if(r.csrf)session.csrf=r.csrf;
  say('Added. You can now log in with '+keyName()+'.');me=await post('/auth/acct/me');render();
 }catch(e){say(e.name==='NotAllowedError'?'Cancelled. Nothing was changed.':e.name==='InvalidStateError'?'This device already has a passkey for your account.':e.message,true);}
 finally{working=false;}
});
// ---- Telegram link (the bot confirms a one-time code) ----
async function checkLink(){
 try{const d=await post('/auth/lunar/link/status');
  if(d.linked){$('link-state').textContent='Linked. Telegram and the website now share the same account.';clearInterval(linkTimer);linkTimer=null;me=await post('/auth/acct/me');render();$('tg-box').hidden=true;say('Telegram is linked.');}
  else if(d.expired){$('link-state').textContent='That link expired. Tap Link Telegram again.';clearInterval(linkTimer);linkTimer=null;}
 }catch(e){$('link-state').textContent=e.message;}
}
$('link-telegram').addEventListener('click',async()=>{
 if(working)return;working=true;
 try{
  if(me.kind!=='lunar'){say('Set a password first, then link Telegram.',true);return;}
  const d=await post('/auth/lunar/link/start');if(d.linked){await checkLink();return;}
  if(!/^https:\/\/t\.me\/LunarWarMachinesBot\?start=link_[a-f0-9]{48}$/.test(d.url||''))throw Error('Telegram linking is not available right now.');
  linkCommand=d.command;$('open-bot').href=d.url;$('link-command').textContent=d.command;$('tg-box').hidden=false;
  clearInterval(linkTimer);linkTimer=setInterval(()=>{if(!document.hidden)checkLink();},3000);
 }catch(e){say(e.message,true);}finally{working=false;}
});
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(linkCommand);$('copy-code').textContent='COPIED';}catch{say('Select the command to copy it.');}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&linkTimer)checkLink();});
load();
