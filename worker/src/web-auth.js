// Official Telegram Login (OIDC ID token), first-party HttpOnly sessions. No client identity or balances trusted.
const ISSUER='https://oauth.telegram.org',JWKS=ISSUER+'/.well-known/jwks.json';
export const WEB_ORIGIN='https://lunar-api.solb7403.workers.dev';
const LOGIN_COOKIE='__Host-lunar-login',SESSION_COOKIE='__Host-lunar-session',MAX_AGE=8*3600;
const enc=new TextEncoder();
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const origin=env=>env.WEB_ORIGIN||WEB_ORIGIN;
const clientId=env=>String(env.TELEGRAM_WEB_CLIENT_ID||String(env.BOT_TOKEN||'').split(':')[0]);
const ready=env=>env.WEB_LOGIN_ENABLED==='1'&&/^\d{3,16}$/.test(clientId(env))&&!!env.SESSIONS;
const json=(o,status=200,cookie)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
const cookie=(k,v,age)=>k+'='+v+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
const codeReady=env=>ready(env)&&!!String(env.TELEGRAM_OIDC_CLIENT_SECRET||'').trim();
const callbackURL=env=>origin(env)+'/auth/callback';
const safeTarget=v=>/^(play|garage|quests|ranks|shop|mode:(arena|zone|crystal|bounty|royale|boss))$/.test(String(v||''))?String(v):'play';
const oauthRedirect=(where,status=303)=>new Response(null,{status,headers:{Location:where,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const sha256=async data=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(data)));
const expireLoginCookie=resp=>{resp.headers.append('Set-Cookie',cookie(LOGIN_COOKIE,'',0));return resp;};
function getCookie(req,name){const values=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));return values.length===1&&/^[a-f0-9]{64}$/.test(values[0].slice(name.length+1))?values[0].slice(name.length+1):'';}
export const hasWebCookie=req=>!!getCookie(req,SESSION_COOKIE);
// Shared audited primitives for Lunar-owned passkey accounts and optional Telegram linking.
export {record,getCookie,sameOrigin,limited,origin,json,cookie,random};
export const WEB_LOGIN_COOKIE=LOGIN_COOKIE;
export async function issueLunarWebSession(env,user,pid){
 if(!env.SESSIONS||!/^ln_[0-9]{12,15}$/.test(String(pid||''))||!user?.lunar_account)return json({error:'account'},403);
 const sid=random(),csrf=random(),now=Date.now();
 const created=await record(env,sid,'issue',{kind:'session',user,pid,csrf,created:now,expires:now+MAX_AGE*1000,absolute:now+24*3600000});
 if(!created.ok)return json({error:'session_store'},503);
 const result=json({ok:true,user,pid,csrf,expires:now+MAX_AGE*1000},200,cookie(SESSION_COOKIE,sid,MAX_AGE));
 result.headers.append('Set-Cookie',cookie(LOGIN_COOKIE,'',0));return result;
}
function sameOrigin(req,env){return new URL(req.url).origin===origin(env)&&req.headers.get('Origin')===origin(env)&&!['cross-site'].includes(req.headers.get('Sec-Fetch-Site'));}
async function record(env,token,op,value){
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(token))),x=>x.toString(16).padStart(2,'0')).join('');
 return env.SESSIONS.get(env.SESSIONS.idFromName(hash)).fetch('https://session/'+op,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value||{})});
}
// One bounded record per random token, with alarms removing unused/expired records. Atomic one-time consume.
export class WebSession {
 constructor(state){this.state=state;}
 async alarm(){await this.state.storage.deleteAll();}
 async fetch(req){return this.state.blockConcurrencyWhile(async()=>{
  const op=new URL(req.url).pathname,now=Date.now();let v=await this.state.storage.get('record');
  if(op==='/issue'){
   if(v)return json({error:'exists'},409);v=await req.json();
   if(!['challenge','session'].includes(v.kind)||!Number.isFinite(v.expires)||v.expires<=now||v.expires>now+24*3600000)return json({error:'invalid'},400);
   await this.state.storage.put('record',v);await this.state.storage.setAlarm(v.expires);return json({ok:true});
  }
  if(!v||v.expires<=now){await this.state.storage.deleteAll();return json({error:'expired'},401);}
  if(op==='/consume'){
   if(v.kind!=='challenge')return json({error:'invalid'},400);
   if(v.flow==='bot'&&!v.approved)return json({pending:true},202);
   await this.state.storage.deleteAll();return json(v);
  }
  if(op==='/approve'){
   if(v.kind!=='challenge'||v.flow!=='bot'||v.approved)return json({error:'invalid'},409);
   let b;try{b=await req.json();}catch{return json({error:'invalid'},400);}
   if(b.code!==v.code||!b.user||!Number.isSafeInteger(b.user.id)||b.user.id<=0)return json({error:'invalid'},403);
   v.approved={id:b.user.id,first_name:String(b.user.first_name||'Pilot').slice(0,64),last_name:String(b.user.last_name||'').slice(0,64),username:String(b.user.username||'').slice(0,64),web_auth:true};
   await this.state.storage.put('record',v);return json({ok:true});
  }
  if(op==='/attempt'){
   if(v.kind!=='challenge'||(v.attempts||0)>=6)return json({error:'attempts'},429);
   v.attempts=(v.attempts||0)+1;await this.state.storage.put('record',v);return json(v);
  }
  if(op==='/revoke'){await this.state.storage.deleteAll();return json({ok:true});}
  if(op==='/renew'){
   if(v.kind!=='session'||v.absolute<=now)return json({error:'expired'},401);
   v.expires=Math.min(now+MAX_AGE*1000,v.absolute);await this.state.storage.put('record',v);await this.state.storage.setAlarm(v.expires);
  }
  return json(v);
 });}
}
let keys=null,keyTime=0;
function decode(s){const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/'));return new Uint8Array(Array.from(raw,c=>c.charCodeAt(0)));}
export async function verifyWebToken(token,env,challenge,now=Date.now()){
 try{
  if(typeof token!=='string'||token.length>12000)return null;
  const parts=token.split('.');if(parts.length!==3)return null;
  const h=JSON.parse(new TextDecoder().decode(decode(parts[0]))),p=JSON.parse(new TextDecoder().decode(decode(parts[1]))),sec=now/1000;
  if(h.alg!=='RS256'||typeof h.kid!=='string'||h.kid.length>128||p.iss!==ISSUER||p.aud!==clientId(env)||typeof p.nonce!=='string'||p.nonce!==challenge.nonce)return null;
  if(!Number.isFinite(p.exp)||!Number.isFinite(p.iat)||p.exp<=sec||p.exp>sec+7200||p.iat>sec+30||p.iat<challenge.created/1000-30||p.iat>=p.exp)return null;
  // OIDC sub is a different identifier: only the signed profile id maps to the existing tg_<id> economy.
  if(!Number.isSafeInteger(p.id)||p.id<=0||typeof p.sub!=='string'||!p.sub)return null;
  if(!keys||now-keyTime>300000){const r=await fetch(JWKS,{signal:AbortSignal.timeout(8000)});if(!r.ok)return null;const j=await r.json();if(!Array.isArray(j.keys)||j.keys.length>20)return null;keys=j.keys;keyTime=now;}
  const jwk=keys.find(k=>k.kid===h.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
  if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),enc.encode(parts[0]+'.'+parts[1])))return null;
  return {id:p.id,first_name:String(p.given_name||p.name||'Pilot').slice(0,64),last_name:String(p.family_name||'').slice(0,64),username:String(p.preferred_username||'').slice(0,64),web_auth:true};
 }catch{return null;}
}
// Approve an independent one-use browser challenge only from the authenticated Telegram webhook.
// The deep-link code is NOT the browser session cookie; forwarding the link cannot steal the session.
export async function approveBotWebsiteLogin(env,code,user){
 if(!ready(env)||typeof code!=='string'||!/^[a-f0-9]{48}$/.test(code)||!Number.isSafeInteger(user?.id)||user.id<=0)return false;
 const index=await record(env,code,'consume');if(!index.ok)return false;
 const v=await index.json();if(v.kind!=='challenge'||v.flow!=='bot_index'||typeof v.browser!=='string')return false;
 const approve=await record(env,v.browser,'approve',{code,user});return approve.ok;
}
export async function webIdentity(req,env,csrf=true){
 if(!ready(env)||new URL(req.url).origin!==origin(env))return null;
 const token=getCookie(req,SESSION_COOKIE);if(!token||csrf&&!sameOrigin(req,env))return null;
 const res=await record(env,token,'read');if(!res.ok)return null;const s=await res.json();
 if(s.kind!=='session'||csrf&&req.headers.get('X-Lunar-CSRF')!==s.csrf)return null;
 return {user:s.user,pid:s.pid||'tg_'+s.user.id,session:s,token};
}
const limits=new Map();
function limited(req){const k=req.headers.get('CF-Connecting-IP')||'anonymous',m=Math.floor(Date.now()/60000);let v=limits.get(k);if(!v||v.m!==m){v={m,n:0};limits.set(k,v);if(limits.size>10000)limits.clear();}return ++v.n>20;}
export async function webAuth(req,env){
 const path=new URL(req.url).pathname;
 if(path==='/auth/config'&&req.method==='GET')return json({enabled:codeReady(env),client_id:ready(env)?clientId(env):null,origin:origin(env),login:'telegram-oidc-code-pkce'});
 if(path==='/auth/session'&&req.method==='GET'){
  const a=await webIdentity(req,env,false);return a?json({ok:true,user:a.user,pid:a.pid,csrf:a.session.csrf,expires:a.session.expires}):json({error:'signed_out'},401);
 }
 // Browser/bot sign-in avoids cross-app OIDC handoff on iOS. Signed Telegram webhook proves identity.
 if(path==='/auth/bot/start'&&req.method==='POST'){
  if(!ready(env))return json({error:'login_setup_required'},503);
  if(!sameOrigin(req,env))return json({error:'origin'},403);
  if(limited(req))return json({error:'rate'},429);
  const existing=await webIdentity(req,env,false);if(existing)return json({ok:true,signedIn:true});
  const previous=getCookie(req,LOGIN_COOKIE);if(previous)await record(env,previous,'revoke').catch(()=>{});
  const browser=random(),code=random().slice(0,48),now=Date.now(),expires=now+600000;
  const first=await record(env,browser,'issue',{kind:'challenge',flow:'bot',code,created:now,expires});
  if(!first.ok)return json({error:'session_store'},503);
  const second=await record(env,code,'issue',{kind:'challenge',flow:'bot_index',browser,created:now,expires});
  if(!second.ok){await record(env,browser,'revoke');return json({error:'session_store'},503);}
  return json({ok:true,url:'https://t.me/LunarWarMachinesBot?start=web_'+code,command:'/login '+code,expires},200,cookie(LOGIN_COOKIE,browser,600));
 }
 if(path==='/auth/bot/finish'&&req.method==='POST'){
  if(!ready(env))return json({error:'login_setup_required'},503);
  if(!sameOrigin(req,env))return json({error:'origin'},403);
  const browser=getCookie(req,LOGIN_COOKIE);if(!browser)return json({error:'expired'},401);
  const used=await record(env,browser,'consume');
  if(used.status===202)return json({pending:true},202);
  if(!used.ok)return json({error:'expired'},401);
  const v=await used.json();if(v.flow!=='bot'||!v.approved)return json({error:'identity'},401);
  const sid=random(),csrf=random(),now=Date.now();
  const issued=await record(env,sid,'issue',{kind:'session',user:v.approved,csrf,created:now,expires:now+MAX_AGE*1000,absolute:now+24*3600000});
  if(!issued.ok)return json({error:'session_store'},503);
  const result=json({ok:true,user:v.approved,csrf,expires:now+MAX_AGE*1000},200,cookie(SESSION_COOKIE,sid,MAX_AGE));
  result.headers.append('Set-Cookie',cookie(LOGIN_COOKIE,'',0));return result;
 }
 if(path==='/auth/start'&&req.method==='GET'){
  const target=safeTarget(new URL(req.url).searchParams.get('target'));
  const existing=await webIdentity(req,env,false);
  if(existing)return oauthRedirect('/web/play.html#'+target);
  if(!codeReady(env))return oauthRedirect('/web/?login=setup');
  if(limited(req))return oauthRedirect('/web/?login=rate');
  const previous=getCookie(req,LOGIN_COOKIE);if(previous)await record(env,previous,'revoke').catch(()=>{});
  const state=random(),nonce=random(),verifier=b64url(crypto.getRandomValues(new Uint8Array(48))),challenge=b64url(await sha256(verifier));
  const token=random(),now=Date.now();
  const issue=await record(env,token,'issue',{kind:'challenge',flow:'code',state,nonce,verifier,target,created:now,expires:now+300000});
  if(!issue.ok)return oauthRedirect('/web/?login=unavailable');
  const url=new URL('https://oauth.telegram.org/auth');
  for(const [k,v] of Object.entries({client_id:clientId(env),redirect_uri:callbackURL(env),response_type:'code',scope:'openid profile',state,code_challenge:challenge,code_challenge_method:'S256',nonce}))url.searchParams.set(k,v);
  const res=oauthRedirect(url.toString(),302);
  res.headers.append('Set-Cookie',cookie(LOGIN_COOKIE,token,300));
  return res;
 }
 if(path==='/auth/callback'&&req.method==='GET'){
  const fail=reason=>expireLoginCookie(oauthRedirect('/web/?login='+reason));
  if(!codeReady(env))return fail('setup');
  if(limited(req))return fail('rate');
  const token=getCookie(req,LOGIN_COOKIE);if(!token)return fail('expired');
  const attempt=await record(env,token,'attempt');if(!attempt.ok)return fail('expired');
  const challenge=await attempt.json(),params=new URL(req.url).searchParams;
  const state=params.get('state')||'',code=params.get('code')||'';
  if(challenge.flow!=='code'||!state||state!==challenge.state)return fail('invalid');
  if(params.has('error')){await record(env,token,'consume');return fail('cancelled');}
  if(!code||code.length>4096)return fail('invalid');
  const used=await record(env,token,'consume');if(!used.ok)return fail('expired');
  try{
   const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:callbackURL(env),client_id:clientId(env),code_verifier:challenge.verifier});
   const auth=btoa(clientId(env)+':'+String(env.TELEGRAM_OIDC_CLIENT_SECRET));
   const response=await fetch('https://oauth.telegram.org/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+auth},body:body.toString(),signal:AbortSignal.timeout(10000)});
   if(!response.ok)return fail('exchange');
   const data=await response.json();
   const user=await verifyWebToken(data.id_token,env,challenge);if(!user)return fail('identity');
   const sid=random(),csrf=random(),now=Date.now();
   const issued=await record(env,sid,'issue',{kind:'session',user,csrf,created:now,expires:now+MAX_AGE*1000,absolute:now+24*3600000});
   if(!issued.ok)return fail('unavailable');
   const result=oauthRedirect('/web/play.html#'+safeTarget(challenge.target));
   result.headers.append('Set-Cookie',cookie(SESSION_COOKIE,sid,MAX_AGE));
   return expireLoginCookie(result);
  }catch{return fail('exchange');}
 }
 if(!ready(env))return json({error:'login_setup_required'},503);
 if(req.method!=='POST')return json({error:'method'},405);
 if(!sameOrigin(req,env))return json({error:'origin'},403);
 if(limited(req))return json({error:'rate'},429);
 if(path==='/auth/challenge'){
  const previous=getCookie(req,LOGIN_COOKIE);if(previous)await record(env,previous,'revoke');
  const token=random(),nonce=random(),now=Date.now();const r=await record(env,token,'issue',{kind:'challenge',nonce,created:now,expires:now+300000});
  return r.ok?json({nonce,client_id:clientId(env),expires:now+300000},200,cookie(LOGIN_COOKIE,token,300)):json({error:'session_store'},503);
 }
 if(path==='/auth/login'){
  const token=getCookie(req,LOGIN_COOKIE);if(!token)return json({error:'challenge'},401);
  const r=await record(env,token,'attempt');if(!r.ok)return json({error:'challenge'},401);
  let b;try{b=await req.json();}catch{return json({error:'bad_json'},400);}
  const challenge=await r.json(),user=await verifyWebToken(b.id_token,env,challenge);if(!user)return json({error:'identity'},401);
  if(!(await record(env,token,'consume')).ok)return json({error:'replayed'},401);
  const sid=random(),csrf=random(),now=Date.now();
  if(!(await record(env,sid,'issue',{kind:'session',user,csrf,created:now,expires:now+MAX_AGE*1000,absolute:now+24*3600000})).ok)return json({error:'session_store'},503);
  const res=json({ok:true,user,csrf,expires:now+MAX_AGE*1000},200,cookie(SESSION_COOKIE,sid,MAX_AGE));res.headers.append('Set-Cookie',cookie(LOGIN_COOKIE,'',0));return res;
 }
 if(path==='/auth/logout'||path==='/auth/renew'){
  const a=await webIdentity(req,env);if(!a)return json({error:'signed_out'},401);
  const r=await record(env,a.token,path.endsWith('logout')?'revoke':'renew');if(!r.ok)return json({error:'signed_out'},401);
  if(path.endsWith('logout'))return json({ok:true},200,cookie(SESSION_COOKIE,'',0));
  const v=await r.json();return json({ok:true,expires:v.expires},200,cookie(SESSION_COOKIE,a.token,Math.floor((v.expires-Date.now())/1000)));
 }
 return json({error:'not_found'},404);
}
