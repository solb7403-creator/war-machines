// First-party LUNAR accounts. Credential keys are passkeys (WebAuthn), not Telegram IDs.
// The website is the account authority; Telegram is only an optional verified linked client.
// Do not trust browser-supplied identity, names on login, or credential public keys on login.
import {
  generateRegistrationOptions,verifyRegistrationResponse,
  generateAuthenticationOptions,verifyAuthenticationResponse
} from '@simplewebauthn/server';
import {dbGet,dbPut,dbPatch,dbUrl,cleanName,hex} from './db.js';
import {claimOnce} from './eco.js';
import {csProblem,csKey} from './callsign.js';
import {csAvailable,claimKey,csOf,signupGate,signupDone} from './accounts.js';
import {
  WEB_LOGIN_COOKIE,record,getCookie,sameOrigin,limited,origin,json,cookie,random,
  webIdentity,issueLunarWebSession
} from './web-auth.js';

const LINK_COOKIE='__Host-lunar-link',MAX_BODY=20000;
const idPattern=/^ln_[0-9]{12,15}$/;
const firstPartyPattern=/^(?:ln_[0-9]{12,15}|tg_[0-9]{3,15})$/;
const codePattern=/^[a-f0-9]{48}$/;
const keyPattern=/^[A-Za-z0-9_-]{20,1500}$/;
const b64u=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decodeB64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const newPilotID=()=>{
 const raw=crypto.getRandomValues(new Uint8Array(7));
 const number=Number(BigInt('0x'+hex(raw))%8000000000000n)+1000000000000;
 return 'ln_'+number;
};
const rpID=env=>new URL(origin(env)).hostname;
const noStore=()=>({'Cache-Control':'no-store'});
const bad=(message,status=400)=>json({error:message},status);
const authorized=req=>req.method==='POST';
const cookieSet=(res,k,val,seconds)=>{res.headers.append('Set-Cookie',cookie(k,val,seconds));return res;};
async function parse(req){
 const raw=await req.text();
 if(raw.length>MAX_BODY)throw Error('Request too large');
 return JSON.parse(raw);
}
const sha=async data=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data)));
const userOf=(pid,name,cs)=>({id:Number(pid.slice(3)),first_name:name,username:name,callsign:cs||undefined,web_auth:true,lunar_account:true});
const credentialPath=async id=>'passkeys/'+await sha(id);
const sessionResult=(env,u,pid)=>issueLunarWebSession(env,u,pid);
export async function resolveTelegramAccount(env,id){
 if(!Number.isSafeInteger(id)||id<=0)return null;
 const link=await dbGet(env,'telegramLinks/'+id);
 return typeof link==='string'&&idPattern.test(link)?link:null;
}
export async function approveTelegramLunarLink(env,code,tgUser){
 if(!env.SESSIONS||!codePattern.test(code)||!Number.isSafeInteger(tgUser?.id)||tgUser.id<=0)return {ok:false,error:'code'};
 const response=await record(env,code,'consume');
 if(!response.ok)return {ok:false,error:'expired'};
 const item=await response.json();
 if(item.kind!=='challenge'||item.flow!=='lunar_link_index'||!idPattern.test(item.pid)||!item.browser)return {ok:false,error:'invalid'};
 const account=await dbGet(env,'lunarAccounts/'+item.pid);
 if(!account?.id||account.id!==item.pid)return {ok:false,error:'account'};
 // A pilot who started in Telegram must secure that original account with a passkey.
 // Never silently point an established Telegram economy at a fresh Lunar account: it would orphan
 // gear, lifetime credit, payment receipts, quests and referral history under tg_<id>.
 const legacy='tg_'+tgUser.id;
 const [secured,progress,profile]=await Promise.all([
  dbGet(env,'lunarAccounts/'+legacy),
  dbGet(env,'eco/'+legacy),
  dbGet(env,'players/'+legacy)
 ]);
 if(secured||progress||profile)return {ok:false,error:'telegram_progress_exists'};
 // Firebase ETag transaction: a Telegram identity can bind to exactly one Lunar ID.
 const claimed=await claimOnce(env,'telegramLinks/'+tgUser.id,item.pid);
 if(!claimed.ok&&claimed.v!==item.pid)return {ok:false,error:'already_linked'};
 const approved=await record(env,item.browser,'link-approve',{code,tgId:tgUser.id,pid:item.pid});
 if(!approved.ok)return {ok:false,error:'expired'};
 await dbPatch(env,'lunarAccounts/'+item.pid,{telegramId:tgUser.id});
 return {ok:true,pid:item.pid};
}

export async function lunarAuth(req,env){
 const path=new URL(req.url).pathname;
 if(!env.SESSIONS||!env.FIREBASE_DB_SECRET)return bad('account_service_unavailable',503);
 if(!authorized(req)||!sameOrigin(req,env))return bad('origin',403);
 if(!['/auth/lunar/link/status','/auth/lunar/account'].includes(path)&&limited(req))return bad('rate',429);

 if(path==='/auth/lunar/register/options'){
  const existing=await webIdentity(req,env,false);
  if(existing)return bad('already_signed_in',409);
  let b;try{b=await parse(req);}catch{return bad('bad_json');}
  // a passkey account picks a unique call sign too (same rules as call sign + password)
  const name=String(b.name||'');
  const problem=csProblem(name);if(problem)return json({error:'callsign',field:'cs',msg:problem.msg},400);
  if(!await csAvailable(env,name))return json({error:'taken',field:'cs',msg:'That call sign is taken.'},409);
  const gate=await signupGate(env,req,b,Date.now());if(gate.stop)return gate.stop;
  const pid=newPilotID();
  const options=await generateRegistrationOptions({
   rpName:'LUNAR: War Machines',rpID:rpID(env),userID:new TextEncoder().encode(pid),userName:pid,
   userDisplayName:name,attestationType:'none',supportedAlgorithmIDs:[-7,-257],
   authenticatorSelection:{residentKey:'required',userVerification:'required'}
  });
  const prior=getCookie(req,WEB_LOGIN_COOKIE);if(prior)await record(env,prior,'revoke').catch(()=>{});
  const browser=random(),now=Date.now();
  const issued=await record(env,browser,'issue',{kind:'challenge',flow:'passkey_register',challenge:options.challenge,pid,name,gate:{iph:gate.iph,did:gate.did,ipN:gate.ipN,devN:gate.devN,day:gate.day,prev:gate.prev},inv:/^[a-hjkmnp-z2-9]{8}$/.test(String(b.inv||''))?b.inv:null,created:now,expires:now+300000});
  if(!issued.ok)return bad('session_store',503);
  return cookieSet(json({ok:true,options}),WEB_LOGIN_COOKIE,browser,300);
 }

 if(path==='/auth/lunar/register/verify'){
  const browser=getCookie(req,WEB_LOGIN_COOKIE);if(!browser)return bad('expired',401);
  const response=await record(env,browser,'consume');if(!response.ok)return bad('expired',401);
  const stored=await response.json();if(stored.flow!=='passkey_register')return bad('challenge',401);
  let b;try{b=await parse(req);}catch{return bad('bad_json');}
  try{
   if(!b.credential||!keyPattern.test(String(b.credential.id||'')))return bad('credential',400);
   const verified=await verifyRegistrationResponse({
    response:b.credential,expectedChallenge:stored.challenge,expectedOrigin:origin(env),
    expectedRPID:rpID(env),requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]
   });
   if(!verified.verified||!verified.registrationInfo?.credential)return bad('identity',401);
   const credential=verified.registrationInfo.credential;
   const path=await credentialPath(credential.id);
   const now=Date.now();
   if(!await claimKey(env,stored.name,stored.pid,now))return json({error:'taken',field:'cs',msg:'That call sign was just taken. Pick another and try again.'},409);
   const account={id:stored.pid,name:stored.name,created:now,type:'passkey',credentialIDs:[credential.id]};
   const owner=await claimOnce(env,'lunarAccounts/'+stored.pid,account);
   if(!owner.ok)return bad('account_collision',409);
   const storedKey={pid:stored.pid,id:credential.id,publicKey:b64u(credential.publicKey),counter:credential.counter||0,transports:credential.transports||[],created:now};
   const claimed=await claimOnce(env,path,storedKey);
   if(!claimed.ok)return bad('credential_already_registered',409);
   await dbPut(env,'cs/'+stored.pid,{n:stored.name,k:csKey(stored.name),t:now,c:0});
   if(stored.gate)await signupDone(env,stored.gate,stored.pid,stored.name,now).catch(()=>{});
   const u=userOf(stored.pid,stored.name,stored.name);if(stored.inv)u.inv=stored.inv;
   return await sessionResult(env,u,stored.pid);
  }catch{return bad('passkey_verification_failed',401);}
 }

 // Telegram-first upgrade: keep the existing tg_<id> game record and bind a new first-party
 // passkey to it. This is not a destructive transfer, so every verified point and receipt survives.
 if(path==='/auth/lunar/upgrade/options'){
  const identity=await webIdentity(req,env);
  if(!identity||!/^tg_[0-9]{3,15}$/.test(identity.pid)||identity.user?.lunar_account||identity.pid!=='tg_'+identity.user?.id)return bad('telegram_session_required',403);
  const existingLink=await dbGet(env,'telegramLinks/'+identity.user.id);
  if(existingLink&&existingLink!==identity.pid)return bad('already_linked',409);
  if(await dbGet(env,'lunarAccounts/'+identity.pid))return bad('already_secured',409);
  const S=await dbGet(env,'eco/'+identity.pid);
  if(S&&S.mig===0)return bad('complete_telegram_setup_first',409);
  const profile=await dbGet(env,'players/'+identity.pid);
  const name=cleanName({lunar_name:profile?.name||cleanName(identity.user)});
  const options=await generateRegistrationOptions({
   rpName:'LUNAR: War Machines',rpID:rpID(env),userID:new TextEncoder().encode(identity.pid),
   userName:identity.pid,userDisplayName:name,attestationType:'none',supportedAlgorithmIDs:[-7,-257],
   authenticatorSelection:{residentKey:'required',userVerification:'required'}
  });
  const prior=getCookie(req,WEB_LOGIN_COOKIE);if(prior)await record(env,prior,'revoke').catch(()=>{});
  const browser=random(),now=Date.now();
  const issued=await record(env,browser,'issue',{kind:'challenge',flow:'passkey_upgrade',
   challenge:options.challenge,pid:identity.pid,name,sessionHash:await sha(identity.token),
   created:now,expires:now+300000});
  if(!issued.ok)return bad('session_store',503);
  return cookieSet(json({ok:true,options}),WEB_LOGIN_COOKIE,browser,300);
 }

 if(path==='/auth/lunar/upgrade/verify'){
  const identity=await webIdentity(req,env);
  if(!identity||!/^tg_[0-9]{3,15}$/.test(identity.pid)||identity.user?.lunar_account||identity.pid!=='tg_'+identity.user?.id)return bad('telegram_session_required',403);
  const browser=getCookie(req,WEB_LOGIN_COOKIE);if(!browser)return bad('expired',401);
  const response=await record(env,browser,'consume');if(!response.ok)return bad('expired',401);
  const stored=await response.json();
  if(stored.flow!=='passkey_upgrade'||stored.pid!==identity.pid||stored.sessionHash!==await sha(identity.token))return bad('challenge',401);
  let b;try{b=await parse(req);}catch{return bad('bad_json');}
  try{
   if(!b.credential||!keyPattern.test(String(b.credential.id||'')))return bad('credential',400);
   const verified=await verifyRegistrationResponse({
    response:b.credential,expectedChallenge:stored.challenge,expectedOrigin:origin(env),
    expectedRPID:rpID(env),requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]
   });
   if(!verified.verified||!verified.registrationInfo?.credential)return bad('identity',401);
   const existingLink=await dbGet(env,'telegramLinks/'+identity.user.id);
  if(existingLink&&existingLink!==identity.pid)return bad('already_linked',409);
   const credential=verified.registrationInfo.credential;
   const keyPath=await credentialPath(credential.id);
   if(await dbGet(env,keyPath))return bad('credential_already_registered',409);
   // Reserve this Telegram identity before creating the first-party credential. A concurrent
   // website-first link to a different Lunar account must never create two owners.
   const reserved=await claimOnce(env,'telegramLinks/'+identity.user.id,identity.pid);
   if(!reserved.ok&&reserved.v!==identity.pid)return bad('already_linked',409);
   const account={id:identity.pid,name:stored.name,created:Date.now(),type:'passkey',
    source:'telegram',telegramId:identity.user.id,credentialIDs:[credential.id]};
   const owner=await claimOnce(env,'lunarAccounts/'+identity.pid,account);
   if(!owner.ok)return bad('already_secured',409);
   const savedKey={pid:identity.pid,id:credential.id,publicKey:b64u(credential.publicKey),
    counter:credential.counter||0,transports:credential.transports||[],created:Date.now()};
   const claimed=await claimOnce(env,keyPath,savedKey);
   if(!claimed.ok)return bad('credential_already_registered',409);
   return await sessionResult(env,userOf(identity.pid,stored.name),identity.pid);
  }catch{return bad('passkey_verification_failed',401);}
 }

 if(path==='/auth/lunar/login/options'){
  const existing=await webIdentity(req,env,false);
  if(existing?.user?.lunar_account)return json({ok:true,signedIn:true});
  const options=await generateAuthenticationOptions({
   rpID:rpID(env),userVerification:'required',allowCredentials:[]
  });
  const prior=getCookie(req,WEB_LOGIN_COOKIE);if(prior)await record(env,prior,'revoke').catch(()=>{});
  const browser=random(),now=Date.now();
  const issued=await record(env,browser,'issue',{kind:'challenge',flow:'passkey_login',challenge:options.challenge,created:now,expires:now+300000});
  if(!issued.ok)return bad('session_store',503);
  return cookieSet(json({ok:true,options}),WEB_LOGIN_COOKIE,browser,300);
 }

 if(path==='/auth/lunar/login/verify'){
  const browser=getCookie(req,WEB_LOGIN_COOKIE);if(!browser)return bad('expired',401);
  const response=await record(env,browser,'consume');if(!response.ok)return bad('expired',401);
  const stored=await response.json();if(stored.flow!=='passkey_login')return bad('challenge',401);
  let b;try{b=await parse(req);}catch{return bad('bad_json');}
  try{
   const assertion=b.credential;
   if(!assertion||!keyPattern.test(String(assertion.id||'')))return bad('credential',400);
   const keyPath=await credentialPath(assertion.id),saved=await dbGet(env,keyPath);
   if(!saved||!firstPartyPattern.test(saved.pid)||saved.id!==assertion.id)return bad('unknown_passkey',401);
   const checked=await verifyAuthenticationResponse({
    response:assertion,expectedChallenge:stored.challenge,expectedOrigin:origin(env),
    expectedRPID:rpID(env),requireUserVerification:true,
    credential:{id:saved.id,publicKey:decodeB64(saved.publicKey),counter:saved.counter||0,transports:saved.transports||[]}
   });
   if(!checked.verified)return bad('identity',401);
   const account=await dbGet(env,'lunarAccounts/'+saved.pid);
   if(!account||account.id!==saved.pid)return bad('account',401);
   // Signature counters are not a universal anti-replay mechanism for synced passkeys (often zero).
   // The unpredictable single-use browser challenge is authoritative; retain observed counter.
   if(checked.authenticationInfo?.newCounter>Number(saved.counter||0)){
    const r=await fetch(dbUrl(env,keyPath),{headers:{'X-Firebase-ETag':'true'}});
    if(r.ok){const latest=await r.json(),tag=r.headers.get('ETag');
     if(latest&&latest.id===saved.id&&latest.counter<=checked.authenticationInfo.newCounter&&tag)
      await fetch(dbUrl(env,keyPath),{method:'PUT',headers:{'Content-Type':'application/json','if-match':tag},
       body:JSON.stringify({...latest,counter:checked.authenticationInfo.newCounter})});
    }
   }
   const cs=await csOf(env,saved.pid);
   return await sessionResult(env,userOf(saved.pid,cs?cs.n:account.name,cs?cs.n:null),saved.pid);
  }catch{return bad('passkey_verification_failed',401);}
 }

 // add Face ID / fingerprint / Windows Hello to an account that already has a password (optional extra security)
 if(path==='/auth/lunar/addkey/options'){
  const identity=await webIdentity(req,env);
  if(!identity?.user?.lunar_account)return bad('lunar_account_required',403);
  const account=await dbGet(env,'lunarAccounts/'+identity.pid);
  if(!account||account.id!==identity.pid)return bad('account',403);
  if((account.credentialIDs||[]).length>=10)return bad('too_many_passkeys',409);
  const cs=await csOf(env,identity.pid),name=cs?cs.n:account.name;
  const options=await generateRegistrationOptions({
   rpName:'LUNAR: War Machines',rpID:rpID(env),userID:new TextEncoder().encode(identity.pid),userName:name,userDisplayName:name,
   attestationType:'none',supportedAlgorithmIDs:[-7,-257],excludeCredentials:(account.credentialIDs||[]).map(id=>({id})),
   authenticatorSelection:{residentKey:'required',userVerification:'required'}
  });
  const browser=random(),now=Date.now();
  const issued=await record(env,browser,'issue',{kind:'challenge',flow:'passkey_add',challenge:options.challenge,pid:identity.pid,sessionHash:await sha(identity.token),created:now,expires:now+300000});
  if(!issued.ok)return bad('session_store',503);
  return cookieSet(json({ok:true,options}),WEB_LOGIN_COOKIE,browser,300);
 }
 if(path==='/auth/lunar/addkey/verify'){
  const identity=await webIdentity(req,env);
  if(!identity?.user?.lunar_account)return bad('lunar_account_required',403);
  const browser=getCookie(req,WEB_LOGIN_COOKIE);if(!browser)return bad('expired',401);
  const response=await record(env,browser,'consume');if(!response.ok)return bad('expired',401);
  const stored=await response.json();
  if(stored.flow!=='passkey_add'||stored.pid!==identity.pid||stored.sessionHash!==await sha(identity.token))return bad('challenge',401);
  let b;try{b=await parse(req);}catch{return bad('bad_json');}
  try{
   if(!b.credential||!keyPattern.test(String(b.credential.id||'')))return bad('credential',400);
   const verified=await verifyRegistrationResponse({response:b.credential,expectedChallenge:stored.challenge,expectedOrigin:origin(env),
    expectedRPID:rpID(env),requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});
   if(!verified.verified||!verified.registrationInfo?.credential)return bad('identity',401);
   const credential=verified.registrationInfo.credential,keyPath=await credentialPath(credential.id);
   const claimed=await claimOnce(env,keyPath,{pid:identity.pid,id:credential.id,publicKey:b64u(credential.publicKey),counter:credential.counter||0,transports:credential.transports||[],created:Date.now()});
   if(!claimed.ok)return bad('credential_already_registered',409);
   const account=await dbGet(env,'lunarAccounts/'+identity.pid);
   await dbPatch(env,'lunarAccounts/'+identity.pid,{credentialIDs:[...(account?.credentialIDs||[]),credential.id].slice(-10)});
   return json({ok:true});
  }catch{return bad('passkey_verification_failed',401);}
 }

 if(path==='/auth/lunar/link/start'){
  const identity=await webIdentity(req,env);
  if(!identity?.user?.lunar_account||!firstPartyPattern.test(identity.pid))return bad('lunar_account_required',403);
  const account=await dbGet(env,'lunarAccounts/'+identity.pid);
  if(!account||account.id!==identity.pid)return bad('account',403);
  if(account.telegramId)return json({ok:true,linked:true,telegramId:account.telegramId});
  if(!idPattern.test(identity.pid))return bad('upgrade_account_not_linkable',409);
  const browser=random(),code=random().slice(0,48),now=Date.now(),expires=now+600000;
  const first=await record(env,browser,'issue',{kind:'challenge',flow:'lunar_link',pid:identity.pid,code,created:now,expires});
  if(!first.ok)return bad('session_store',503);
  const second=await record(env,code,'issue',{kind:'challenge',flow:'lunar_link_index',pid:identity.pid,browser,created:now,expires});
  if(!second.ok){await record(env,browser,'revoke');return bad('session_store',503);}
  const result=json({ok:true,url:'https://t.me/LunarWarMachinesBot?start=link_'+code,command:'/link '+code,expires});
  return cookieSet(result,LINK_COOKIE,browser,600);
 }

 if(path==='/auth/lunar/link/status'){
  const identity=await webIdentity(req,env);
  if(!identity?.user?.lunar_account||!firstPartyPattern.test(identity.pid))return bad('lunar_account_required',403);
  const account=await dbGet(env,'lunarAccounts/'+identity.pid);
  if(!account)return bad('account',403);
  if(account.telegramId)return json({ok:true,linked:true,telegramId:account.telegramId});
  const browser=getCookie(req,LINK_COOKIE);
  if(!browser)return json({ok:true,linked:false});
  const response=await record(env,browser,'read');
  if(!response.ok)return json({ok:true,linked:false,expired:true});
  const item=await response.json();
  if(item.flow!=='lunar_link'||item.pid!==identity.pid)return bad('link',403);
  return json({ok:true,linked:!!item.approved,telegramId:item.approved?.telegramId||null});
 }

 if(path==='/auth/lunar/account'){
  const identity=await webIdentity(req,env);
  if(!identity)return bad('signed_out',401);
  const acc=identity.user?.lunar_account?await dbGet(env,'lunarAccounts/'+identity.pid):null;
  const cs=await csOf(env,identity.pid);
  return json({ok:true,pid:identity.pid,kind:identity.user?.lunar_account?'lunar':'telegram',name:cs?cs.n:acc?.name||cleanName(identity.user),callsign:cs?cs.n:null,telegramLinked:!!acc?.telegramId,telegramId:acc?.telegramId||null,telegramOrigin:acc?.source==='telegram',canUpgrade:!identity.user?.lunar_account&&/^tg_[0-9]{3,15}$/.test(identity.pid)});
 }

 return bad('not_found',404);
}
