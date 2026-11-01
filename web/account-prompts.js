'use strict';
// Website-only nudges, all optional and dismissible (never a wall):
//  - older passkey/Google accounts: one-time "add a password" (so they can log in on any device)
//  - "Protect your account" after the first win, right after the first purchase, and on reaching the top 1,000
//  - "Install LUNAR" / Add to Home Screen after the first win, where the platform supports it
(function(){
 const W=window.LUNAR_WEB||{},pid=W.pid||'';
 const seen=k=>{try{return localStorage.getItem('lunar-p-'+k+'-'+pid)==='1';}catch{return true;}};
 const mark=k=>{try{localStorage.setItem('lunar-p-'+k+'-'+pid,'1');}catch{}};
 let me=null,open=false,installEvt=null;
 const post=(p,b={})=>fetch(p,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Lunar-CSRF':W.csrf},body:JSON.stringify(b)}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok){const e=Error(d.msg||'Something went wrong.');e.data=d;throw e;}return d;});
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;});
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const ua=navigator.userAgent||'',iOS=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
 const inApp=/Telegram|Instagram|FBAN|FBAV|Twitter|TikTok|musical_ly|Line\//i.test(ua);
 const iosSafari=iOS&&/Safari/.test(ua)&&!/CriOS|FxiOS|EdgiOS/.test(ua)&&!inApp;
 const busyNow=()=>typeof state!=='undefined'&&['play','vs','round','range'].includes(state)||(typeof rangeRun!=='undefined'&&rangeRun);
 function dialog(html,onAction){
  open=true;const wrap=document.createElement('div');wrap.className='lw-prompt-wrap';
  wrap.innerHTML='<div class="lw-prompt" role="dialog" aria-modal="true" aria-labelledby="lw-p-title">'+html+'</div>';
  document.body.append(wrap);
  const close=()=>{wrap.remove();open=false;};
  wrap.addEventListener('click',async e=>{const b=e.target.closest('[data-p]');if(!b){if(e.target===wrap)close();return;}const r=await onAction(b.dataset.p,wrap,b);if(r!==false)close();});
  wrap.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  setTimeout(()=>wrap.querySelector('input,button')?.focus(),30);
  return close;
 }
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 function askPassword(){
  if(open||!me||me.hasPassword||me.kind!=='lunar'||!me.cs||seen('pw'))return false;
  mark('pw');
  dialog('<h2 id="lw-p-title">Add a password</h2><p>Log in on any phone or computer with <b>'+esc(me.cs)+'</b> and a password. Your passkey keeps working too.</p>'+
   '<input type="text" name="username" autocomplete="username" value="'+esc(me.cs)+'" hidden><label for="lw-pw">Password</label><input id="lw-pw" type="password" autocomplete="new-password" minlength="8" maxlength="200"><p class="lw-msg" id="lw-pw-msg">At least 8 characters.</p>'+
   '<div class="lw-actions"><button class="lw-go" data-p="save">Save password</button><button class="lw-skip" data-p="later">Later</button></div>',async(a,w)=>{
    if(a!=='save')return true;const m=w.querySelector('#lw-pw-msg');
    try{const r=await post('/auth/acct/password',{pw:w.querySelector('#lw-pw').value});W.csrf=r.csrf;me.hasPassword=true;window.showToast?.('Password saved');return true;}
    catch(e){m.textContent=e.message;m.className='lw-msg bad';return false;}
   });
  return true;
 }
 function protect(kind){
  if(open||!me||me.recovery||seen('protect-'+kind))return false;
  mark('protect-'+kind);
  const title=kind==='buy'?'Protect your purchases':'Protect your account';
  const why=kind==='buy'?'You own paid items now. Add a way back in so a forgotten password never costs you them.':kind==='top'?'You’re in the top 1,000! Add a way back in so a forgotten password never costs you your rank.':'Nice win! Add a way back in, in case you ever forget your password.';
  dialog('<h2 id="lw-p-title">'+title+'</h2><p>'+why+'</p><ul class="lw-ways"><li>Face ID / fingerprint / passkey</li>'+(me.features?.google?'<li>Link Google</li>':'')+'<li>Link Telegram</li><li>Recovery email'+(me.features?.email?'':' (coming soon)')+'</li></ul>'+
   '<div class="lw-actions"><button class="lw-go" data-p="go">Set it up (1 minute)</button><button class="lw-skip" data-p="later">Not now</button></div>',a=>{if(a==='go')location.assign('/web/account.html#protect');return true;});
  return true;
 }
 function install(){
  if(open||standalone()||inApp||seen('install'))return false;
  if(installEvt){mark('install');dialog('<h2 id="lw-p-title">Install LUNAR</h2><p>Open LUNAR full-screen from your home screen or desktop, like an app. Free, no store needed.</p><div class="lw-actions"><button class="lw-go" data-p="install">Install</button><button class="lw-skip" data-p="later">Not now</button></div>',async a=>{if(a==='install'){try{installEvt.prompt();await installEvt.userChoice;}catch{}installEvt=null;}return true;});return true;}
  if(iosSafari){mark('install');dialog('<h2 id="lw-p-title">Add LUNAR to your Home Screen</h2><p>Tap the <b>Share</b> button <span aria-hidden="true">⬆︎</span>, then <b>Add to Home Screen</b>. LUNAR then opens full-screen like an app.</p><div class="lw-actions"><button class="lw-go" data-p="ok">Got it</button></div>',()=>true);return true;}
  return false;
 }
 let base=null;
 function tick(){
  if(!me||open||busyNow()||document.hidden||typeof save==='undefined'||!save)return;
  if(!base)base={wins:save.wins|0};
  if(askPassword())return;
  const won=(save.wins|0)>0,bought=(save.spendGram||0)>0||(save.vg|0)>0||!!save.founder||!!save.starter;
  const top=typeof lbCache!=='undefined'&&lbCache&&Array.isArray(lbCache.top)&&lbCache.top.some(r=>r&&r[0]===pid);
  if(bought&&protect('buy'))return;
  if(top&&protect('top'))return;
  if(won&&protect('win'))return;
  if(won&&(save.wins|0)>(base.wins|0)&&install())return;   // right after a win in this visit
 }
 window.lunarAfterCallsign=async()=>{try{me=await post('/auth/acct/me');}catch{}setTimeout(tick,800);};
 post('/auth/acct/me').then(r=>{me=r;}).catch(()=>{});
 setInterval(tick,4000);
})();
