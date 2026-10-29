'use strict';
// First-party discoverable passkeys. Telegram verification is an optional fallback.
// Never store private keys, user IDs, or identity claims in localStorage.
const target=/^(play|garage|quests|ranks|shop|mode:(arena|zone|crystal|bounty|royale|boss))$/.test(location.hash.slice(1))?location.hash.slice(1):'play';
const $=id=>document.getElementById(id);
const status=t=>{$('login-status').textContent=t;};
let busy=false,telegramPolling=false,telegramCommand='',timer=null;
const to64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const from64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const post=async(path,body={},csrf)=>{
 const response=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(csrf?{'X-Lunar-CSRF':csrf}:{})},body:JSON.stringify(body)});
 let data;try{data=await response.json();}catch{data={};}
 if(!response.ok)throw Error(data.error||'The account service is unavailable.');
 return data;
};
const redirect=()=>location.assign('/web/play.html#'+target);
function createResponse(credential){
 return {id:credential.id,rawId:to64(credential.rawId),type:credential.type,
  authenticatorAttachment:credential.authenticatorAttachment||undefined,
  response:{clientDataJSON:to64(credential.response.clientDataJSON),
   attestationObject:to64(credential.response.attestationObject),
   transports:credential.response.getTransports?.()||[]},
  clientExtensionResults:credential.getClientExtensionResults?.()||{}};
}
function loginResponse(credential){
 return {id:credential.id,rawId:to64(credential.rawId),type:credential.type,
  response:{clientDataJSON:to64(credential.response.clientDataJSON),
   authenticatorData:to64(credential.response.authenticatorData),
   signature:to64(credential.response.signature),
   userHandle:credential.response.userHandle?to64(credential.response.userHandle):null},
  clientExtensionResults:credential.getClientExtensionResults?.()||{}};
}
function optionsForRegistration(o){
 return {...o,challenge:from64(o.challenge),user:{...o.user,id:from64(o.user.id)},
  excludeCredentials:(o.excludeCredentials||[]).map(c=>({...c,id:from64(c.id)}))};
}
function optionsForAuthentication(o){
 return {...o,challenge:from64(o.challenge),
  allowCredentials:(o.allowCredentials||[]).map(c=>({...c,id:from64(c.id)}))};
}
const webauthn=()=>!!(window.PublicKeyCredential&&navigator.credentials?.create&&navigator.credentials?.get);
async function runPasskey(register){
 if(busy)return;
 if(!webauthn()){status('This browser does not support passkeys. Use a recent Safari, Chrome, or compatible browser.');return;}
 const name=$('pilot-name').value.trim();
 if(register&&!/^[A-Za-z0-9][A-Za-z0-9 ._-]{2,15}$/.test(name)){status('Choose a pilot name between 3 and 16 characters.');return;}
 busy=true;$('create-passkey').disabled=true;$('sign-in-passkey').disabled=true;
 status(register?'Creating your Lunar passkey…':'Confirm your Lunar passkey…');
 try{
  let options=await post(register?'/auth/lunar/register/options':'/auth/lunar/login/options',register?{name}:{});
  if(options.signedIn){redirect();return;}
  const credential=register
   ?await navigator.credentials.create({publicKey:optionsForRegistration(options.options)})
   :await navigator.credentials.get({publicKey:optionsForAuthentication(options.options)});
  if(!credential)throw Error('No passkey was selected.');
  await post(register?'/auth/lunar/register/verify':'/auth/lunar/login/verify',
   {credential:register?createResponse(credential):loginResponse(credential)});
  status('Lunar identity verified. Entering the game…');redirect();
 }catch(e){
  const msg=e.name==='NotAllowedError'?'The passkey request was cancelled or timed out.':e.name==='InvalidStateError'?'This passkey is already registered. Try signing in.':e.message||'Passkey verification failed.';
  status(msg);
 }finally{busy=false;$('create-passkey').disabled=false;$('sign-in-passkey').disabled=false;}
}
async function checkExisting(){
 try{
  const r=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)return;
  const s=await r.json();
  $('existing-account').hidden=false;
  $('existing-message').textContent=s.user?.lunar_account?'You are signed in to your independent LUNAR account.':'You are signed in using Telegram. Secure this existing pilot with a Lunar passkey in Account Settings to keep all progress. Do not create a second account.';
  $('secure-original').hidden=!!s.user?.lunar_account;
  $('continue-game').href='/web/play.html#'+target;
 }catch{}
}
async function switchAccount(){
 try{const r=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});if(r.ok){
  const s=await r.json();await post('/auth/logout',{},s.csrf);
 }}catch{status('Could not sign out. Please try again.');return;}
 $('existing-account').hidden=true;status('Signed out. You can now create or sign in to a Lunar account.');
}
async function startTelegram(){
 if(busy)return;busy=true;
 if(timer){clearInterval(timer);timer=null;}
 $('open-bot').hidden=true;$('manual').hidden=true;$('retry-login').hidden=true;
 status('Preparing optional Telegram verification…');
 try{
  const data=await post('/auth/bot/start');
  if(data.signedIn){redirect();return;}
  if(!/^https:\/\/t\.me\/LunarWarMachinesBot\?start=web_[a-f0-9]{48}$/.test(data.url||''))throw Error('Telegram sign-in link is invalid.');
  telegramCommand=data.command;$('open-bot').href=data.url;
  $('open-bot').hidden=false;$('manual').hidden=false;
  $('login-command').textContent=telegramCommand;
  status('Open the bot and press Start, then return to Safari.');
  timer=setInterval(checkTelegram,2500);
 }catch(e){status(e.message);$('retry-login').hidden=false;}
 finally{busy=false;}
}
async function checkTelegram(){
 if(telegramPolling||document.hidden)return;telegramPolling=true;
 try{
  const response=await fetch('/auth/bot/finish',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:'{}'});
  if(response.status===202)return;
  const data=await response.json();
  if(response.ok&&data.ok){clearInterval(timer);timer=null;redirect();return;}
  if(response.status===401||response.status===503){clearInterval(timer);timer=null;$('retry-login').hidden=false;status('The code expired or Telegram is unavailable. Create a Lunar account without Telegram instead.');}
 }catch{}finally{telegramPolling=false;}
}
$('create-passkey').addEventListener('click',()=>runPasskey(true));
$('sign-in-passkey').addEventListener('click',()=>runPasskey(false));
$('switch-account').addEventListener('click',switchAccount);
$('start-telegram').addEventListener('click',startTelegram);
$('retry-login').addEventListener('click',startTelegram);
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(telegramCommand);$('copy-code').textContent='COPIED';}catch{status('Select the command to copy.');}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&timer)checkTelegram();});
checkExisting();
