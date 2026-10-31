'use strict';
(async()=>{
 const $=id=>document.getElementById(id);let session,approved;
 async function call(b){const r=await fetch('/api/payment-ops',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Lunar-CSRF':session.csrf},body:JSON.stringify(b)});const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'Operation unavailable');return d;}
 for(const id of ['buyer','action','order','rail','signature','reason'])$(id).oninput=()=>{approved=null;$('confirm').disabled=true;};
 $('preview').onclick=async()=>{try{const body=Object.fromEntries(['buyer','action','order','rail','signature','reason'].map(id=>[id,$(id).value]));const d=await call({...body,dryRun:true});approved={...body,dryRun:false,confirm:d.confirm};$('plan').textContent=JSON.stringify(d,null,2);$('confirm').disabled=false;$('status').textContent='Dry run only. Review the actor, buyer, operation and reason before confirming.';}catch(e){$('status').textContent=e.message;}};
 $('confirm').onclick=async()=>{if(!approved)return;$('confirm').disabled=true;try{const d=await call(approved);$('status').textContent='Recorded audit '+d.audit+'. No money was sent.';approved=null;}catch(e){$('status').textContent=e.message+' Preview again before retrying.';}};
 try{const r=await fetch('/auth/session',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('Sign in to your operator passkey account first.');session=await r.json();}catch(e){$('preview').disabled=true;$('status').textContent=e.message;}
})();
