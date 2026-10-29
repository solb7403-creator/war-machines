'use strict';
const $=id=>document.getElementById(id);
const say=text=>{$('account-status').textContent=text;};
let session=null,linkTimer=null,linkCommand='',working=false;
async function post(path,b={},csrf=session?.csrf){
 const r=await fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(csrf?{'X-Lunar-CSRF':csrf}:{})},body:JSON.stringify(b)});
 let d;try{d=await r.json();}catch{d={};}
 if(!r.ok)throw Error(d.error||'Account service unavailable.');
 return d;
}
async function load(){
 try{
  const r=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok){location.replace('/web/login.html');return;}
  session=await r.json();
  const a=await post('/auth/lunar/account');
  $('account-identity').hidden=false;
  $('account-identity').textContent=(a.kind==='lunar'?'LUNAR PILOT: ':'TELEGRAM PILOT: ')+a.name+' · Account ID '+a.pid;
  $('lunar-account-details').hidden=a.kind!=='lunar';
  $('telegram-account-details').hidden=a.kind==='lunar';
  say('Secure account connected.');
  if(a.kind==='lunar')await checkLink();
 }catch(e){say(e.message);}
}
async function checkLink(){
 if(!session)return;
 try{
  const data=await post('/auth/lunar/link/status');
  if(data.linked){
   $('link-state').textContent='LINKED: Your Telegram account is connected. The website and Mini App share the same Lunar player ID, inventory, and progress.';
   $('link-telegram').hidden=true;$('open-bot').hidden=true;$('manual').hidden=true;
   if(linkTimer){clearInterval(linkTimer);linkTimer=null;}
  }else if(data.expired){
   $('link-state').textContent='Link expired. Generate another link if you still want to connect Telegram.';
   $('link-telegram').hidden=false;
  }else if(linkCommand){
   $('link-state').textContent='Awaiting confirmation in Telegram. Return here after pressing Start.';
  }else{
   $('link-state').textContent='Telegram is not linked, and it is not needed to play on this website.';
  }
 }catch(e){$('link-state').textContent=e.message;}
}
async function linkTelegram(){
 if(working)return;working=true;$('link-telegram').disabled=true;
 try{
  const data=await post('/auth/lunar/link/start');
  if(data.linked){await checkLink();return;}
  if(!/^https:\/\/t\.me\/LunarWarMachinesBot\?start=link_[a-f0-9]{48}$/.test(data.url||''))throw Error('Invalid Telegram link.');
  linkCommand=data.command;
  $('open-bot').href=data.url;$('open-bot').hidden=false;$('manual').hidden=false;
  $('link-command').textContent=data.command;
  $('link-telegram').hidden=true;$('link-state').textContent='Open the Telegram bot, press Start, and then return to this page.';
  if(linkTimer)clearInterval(linkTimer);
  linkTimer=setInterval(()=>{if(!document.hidden)checkLink();},3000);
 }catch(e){$('link-state').textContent=e.message;}
 finally{working=false;$('link-telegram').disabled=false;}
}
async function logout(){
 if(!session){location.assign('/web/login.html');return;}
 try{await post('/auth/logout');location.assign('/web/login.html');}
 catch(e){say('Could not sign out: '+e.message);}
}
$('link-telegram').addEventListener('click',linkTelegram);
$('sign-out').addEventListener('click',logout);
$('switch-lunar').addEventListener('click',logout);
$('copy-code').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(linkCommand);$('copy-code').textContent='COPIED';}catch{say('Select the command above to copy it.');}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&linkTimer)checkLink();});
load();
