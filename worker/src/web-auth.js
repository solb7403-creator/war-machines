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
const cookie=(k,v,age)=>`${k}=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
function getCookie(req,name){const values=(req.headers.get('Cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));return values.length===1&&/^[a-f0-9]{64}$/.test(values[0].slice(name.length+1))?values[0].slice(name.length+1):'';}
export const hasWebCookie=req=>!!getCookie(req,SESSION_COOKIE);
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
   await this.state.storage.deleteAll();return json(v);
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
export async function webIdentity(req,env,csrf=true){
 if(!ready(env)||new URL(req.url).origin!==origin(env))return null;
 const token=getCookie(req,SESSION_COOKIE);if(!token||csrf&&!sameOrigin(req,env))return null;
 const res=await record(env,token,'read');if(!res.ok)return null;const s=await res.json();
 if(s.kind!=='session'||csrf&&req.headers.get('X-Lunar-CSRF')!==s.csrf)return null;
 return {user:s.user,pid:'tg_'+s.user.id,session:s,token};
}
const limits=new Map();
function limited(req){const k=req.headers.get('CF-Connecting-IP')||'anonymous',m=Math.floor(Date.now()/60000);let v=limits.get(k);if(!v||v.m!==m){v={m,n:0};limits.set(k,v);if(limits.size>10000)limits.clear();}return ++v.n>20;}
export async function webAuth(req,env){
 const path=new URL(req.url).pathname;
 if(path==='/auth/config'&&req.method==='GET')return json({enabled:ready(env),client_id:ready(env)?clientId(env):null,origin:origin(env),login:'official-telegram-oidc'});
 if(path==='/auth/session'&&req.method==='GET'){
  const a=await webIdentity(req,env,false);return a?json({ok:true,user:a.user,csrf:a.session.csrf,expires:a.session.expires}):json({error:'signed_out'},401);
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
