'use strict';
// Verifies the Telegram sender through Lunar's already-authenticated bot webhook.
// No OAuth window, popup messaging, or Telegram credentials in the browser.
const target=/^(play|garage|quests|ranks|shop|mode:(arena|zone|crystal|bounty|royale|boss))$/.test(location.hash.slice(1))?location.hash.slice(1):'play';
const $=id=>document.getElementById(id);
const status=text=>{$('login-status').textContent=text;};
let pending=false,command='',timer=null,working=false;
async function begin(){
 if(working)return;working=true;
 if(timer){clearInterval(timer);timer=null;}
 $('open-bot').hidden=true;$('manual').hidden=true;$('retry-login').hidden=true;
 status('Preparing a secure one-time sign-in…');
 try{
  const current=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});
  if(current.ok){location.assign('/web/play.html#'+target);return;}
  const response=await fetch('/auth/bot/start',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error('The login service is unavailable. Please try again.');
  if(data.signedIn){location.assign('/web/play.html#'+target);return;}
  if(typeof data.url!=='string'||!/^https:\/\/t\.me\/LunarWarMachinesBot\?start=web_[a-f0-9]{48}$/.test(data.url))throw Error('The Telegram login link was not valid.');
  command=data.command;
  $('open-bot').href=data.url;
  $('open-bot').hidden=false;
  $('manual').hidden=false;
  $('login-command').textContent=command;
  status('Ready. Open Telegram, press Start, then return to this browser tab.');
  timer=setInterval(check,2500);
 }catch(e){
  status(e.message||'Sign-in could not start.');$('retry-login').hidden=false;
 }finally{working=false;}
}
async function check(){
 if(pending||document.hidden)return;
 pending=true;
 try{
  const response=await fetch('/auth/bot/finish',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
  if(response.status===202)return;
  const data=await response.json();
  if(response.ok&&data.ok){
   if(timer){clearInterval(timer);timer=null;}
   status('Identity verified. Entering Lunar…');
   location.assign('/web/play.html#'+target);return;
  }
  if(response.status===401||response.status===503){
   if(timer){clearInterval(timer);timer=null;}
   status(response.status===401?'This verification has expired. Generate a new sign-in.':'Login service temporarily unavailable.');
   $('retry-login').hidden=false;$('open-bot').hidden=true;$('manual').hidden=true;
  }
 }catch{status('Connection interrupted. Verification will resume when you return.');}
 finally{pending=false;}
}
$('copy-code').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(command);$('copy-code').textContent='COPIED';}
 catch{status('Select the command above to copy it into the bot chat.');}
});
$('retry-login').addEventListener('click',begin);
$('oidc-alternative').href='/auth/start?target='+encodeURIComponent(target);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
begin();
