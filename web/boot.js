'use strict';
(async()=>{
 if(location.hostname==='solb7403-creator.github.io'){location.replace('https://lunar-api.solb7403.workers.dev/web/play.html'+location.hash);return;}
 const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(Error('A game asset could not load. Please reload.'));document.body.append(s);});
 try{
  const r=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});if(!r.ok){location.replace('/web/login.html'+location.hash);return;}const session=await r.json();
  const sync=await fetch('/api/sync',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Lunar-CSRF':session.csrf},body:JSON.stringify({lab:1})});const snapshot=await sync.json();if(!sync.ok||!snapshot.ok||!snapshot.migOk)throw Error(snapshot.error||'Account verification or game synchronization could not complete.');
  const version=await fetch('/version.json',{cache:'no-store'}).then(r=>r.json());window.BUILD=version.v;window.LUNAR_WEB_EDITION=true;window.LUNAR_WEB={...session,snapshot};
  for(const src of ['rules','core','net','game','match','pvp','render','models3d','graphics','equipment3d','environment3d','proof','render3d','fx','ui','range'])await load('/js/'+src+'.js?v='+encodeURIComponent(version.v));
  await load('/web/scene.js?v='+encodeURIComponent(version.v));await load('/web/game.js?v='+encodeURIComponent(version.v));await load('/js/main.js?v='+encodeURIComponent(version.v));
  document.querySelector('#web-loading').hidden=true;window.lunarWebReady();
 }catch(e){const box=document.querySelector('#web-loading');box.querySelector('h1').textContent='CONNECTION PAUSED';box.querySelector('p:not(.eyebrow)').textContent=e.message||'Server verification is unavailable. Ranked progress remains protected.';}
})();
