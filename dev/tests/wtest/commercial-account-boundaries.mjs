// Commercial audit regressions. All identity, DB and durable storage are disposable fixtures.
import assert from 'node:assert/strict';
import test from 'node:test';
import {makeDB} from './fakedb.mjs';
import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();
const {WebSession,issueLunarWebSession,webAuth,approveBotWebsiteLogin}=await import('../../../worker/src/web-auth.js');
const {lunarAuth,approveTelegramLunarLink,resolveTelegramAccount}=await import('../../../worker/src/lunar-identity.js');
const realFetch=globalThis.fetch;
const clock=Date.now;
const pid='ln_1234567890123';
async function fixture(){
 const db=makeDB(),objects=new Map();
 const env={WEB_ORIGIN:'https://game.test',FIREBASE_DB_SECRET:'SECRET',WEB_LOGIN_ENABLED:'1',WEB_TELEGRAM_LINK_ENABLED:'1',BOT_TOKEN:'123:fixture'};
 globalThis.fetch=async(url,opts)=>{
  if(String(url).includes('firebaseio.com/'))return db.handle(url,opts);
  throw Error('Fixture forbids live network: '+url);
 };
 env.SESSIONS={idFromName:n=>n,get(n){
  if(!objects.has(n)){
   const vals=new Map();let q=Promise.resolve();
   objects.set(n,new WebSession({storage:{get:async k=>structuredClone(vals.get(k)),put:async(k,v)=>vals.set(k,structuredClone(v)),deleteAll:async()=>vals.clear(),setAlarm:async()=>{}},blockConcurrencyWhile(fn){const r=q.then(fn);q=r.catch(()=>{});return r;}}));
  }
  return {fetch:(url,opts)=>objects.get(n).fetch(new Request(url,opts))};
 }};
 await db.handle('https://fixture.firebaseio.com/lunarAccounts/'+pid+'.json?auth=SECRET',{method:'PUT',body:JSON.stringify({id:pid,name:'Fixture Pilot',type:'passkey',credentialIDs:['fixture-key']})});
 const session=await issueLunarWebSession(env,{id:1234567890123,lunar_account:true,first_name:'Fixture Pilot'},pid);
 const cookie=session.headers.getSetCookie().find(c=>c.startsWith('__Host-lunar-session=')).split(';')[0];
 const data=await session.json();
 const req=path=>new Request(env.WEB_ORIGIN+path,{method:'POST',headers:{Origin:env.WEB_ORIGIN,Cookie:cookie,'X-Lunar-CSRF':data.csrf,'Content-Type':'application/json'},body:'{}'});
 async function link(){const r=await lunarAuth(req('/auth/lunar/link/start'),env);assert.equal(r.status,200);return (await r.json()).command.slice('/link '.length);}
 return {env,db,link,cookie,csrf:data.csrf,req};
}
async function botIdentity(env,id){
 const request=(path,token)=>new Request(env.WEB_ORIGIN+path,{method:'POST',headers:{Origin:env.WEB_ORIGIN,...(token?{Cookie:token}:{})}});
 const start=await webAuth(request('/auth/bot/start'),env),body=await start.json();
 const token=start.headers.getSetCookie().find(c=>c.startsWith('__Host-lunar-login=')).split(';')[0];
 assert.equal(await approveBotWebsiteLogin(env,body.command.slice('/login '.length),{id,first_name:'Fixture Telegram'}),true);
 const finish=await webAuth(request('/auth/bot/finish',token),env);
 assert.equal(finish.status,200);
 const session=finish.headers.getSetCookie().find(c=>c.startsWith('__Host-lunar-session=')).split(';')[0];
 return (await (await webAuth(new Request(env.WEB_ORIGIN+'/auth/session',{headers:{Cookie:session}}),env)).json()).pid;
}
test('one Lunar account cannot acquire two Telegram owners through outstanding links',async()=>{
 try{
  const {env,db,link}=await fixture();
  const first=await link(),second=await link();
  const [one,two]=await Promise.all([approveTelegramLunarLink(env,first,{id:880001}),approveTelegramLunarLink(env,second,{id:880002})]);
  const bound=[];for(const id of [880001,880002]){try{if(await resolveTelegramAccount(env,id)===pid)bound.push(id);}catch{}}
  assert.equal(bound.length,1,JSON.stringify({one,two,bound,account:db.get('/lunarAccounts/'+pid)}));
  assert.equal([one,two].filter(r=>r.ok).length,1,'only one approval can confirm ownership');
  assert.equal(await botIdentity(env,bound[0]),pid,'verified existing mapping is preserved');
  const rejected=[880001,880002].find(id=>!bound.includes(id));
  await assert.rejects(botIdentity(env,rejected),/unconfirmed account link/,'website bot sign-in must not fall back to another account');
  assert.equal(db.get('/lunarAccounts/'+pid).telegramId,bound[0],'winning reverse owner is retained');
 }finally{globalThis.fetch=realFetch;Date.now=clock;}
});
test('link expiry during persistence must not grant Telegram account access after failed approval',async()=>{
 try{
  const {env,db,link}=await fixture();const code=await link();
  const dbFetch=globalThis.fetch;
  globalThis.fetch=async(url,opts)=>{
   const r=await dbFetch(url,opts);
   if(String(url).includes('/telegramLinks/880003.json')&&opts?.method==='PUT')Date.now=()=>clock()+601000;
   return r;
  };
  const result=await approveTelegramLunarLink(env,code,{id:880003});
  assert.deepEqual(result,{ok:false,error:'expired'});
  await assert.rejects(resolveTelegramAccount(env,880003),/unconfirmed account link/,'failed/expired link must not authorize either account');
  Date.now=clock;globalThis.fetch=dbFetch;
  const retry=await link();
  assert.deepEqual(await approveTelegramLunarLink(env,retry,{id:880003}),{ok:true,pid},'same user may repair an expired pending link with fresh proof');
  assert.equal(await resolveTelegramAccount(env,880003),pid);
 }finally{globalThis.fetch=realFetch;Date.now=clock;}
});
test('website bot sign-in does not trust an orphan Telegram forward mapping',async()=>{
 try{
  const {env,db}=await fixture();
  await db.handle('https://fixture.firebaseio.com/telegramLinks/880004.json?auth=SECRET',{method:'PUT',body:JSON.stringify(pid)});
  await assert.rejects(botIdentity(env,880004),/unconfirmed account link/);
 }finally{globalThis.fetch=realFetch;Date.now=clock;}
});
test('new Telegram links are unavailable by default without mutating account data',async()=>{
 try{
  const {env,db,req}=await fixture();delete env.WEB_TELEGRAM_LINK_ENABLED;
  const before=structuredClone(db.root);
  const response=await lunarAuth(req('/auth/lunar/link/start'),env);
  assert.equal(response.status,503);
  assert.deepEqual(db.root,before);
 }finally{globalThis.fetch=realFetch;Date.now=clock;}
});
test('a Telegram identity already owned by another Lunar account preserves its confirmed mapping',async()=>{
 try{
  const {env,db,link,req}=await fixture();
  assert.deepEqual(await approveTelegramLunarLink(env,await link(),{id:880005}),{ok:true,pid});
  const other='ln_1234567890124';
  await db.handle('https://fixture.firebaseio.com/lunarAccounts/'+other+'.json?auth=SECRET',{method:'PUT',body:JSON.stringify({id:other,name:'Other Pilot',type:'passkey',credentialIDs:['other-key']})});
  const otherSession=await issueLunarWebSession(env,{id:1234567890124,lunar_account:true},other),otherData=await otherSession.json();
  const otherCookie=otherSession.headers.getSetCookie().find(c=>c.startsWith('__Host-lunar-session=')).split(';')[0];
  const start=await lunarAuth(new Request(env.WEB_ORIGIN+'/auth/lunar/link/start',{method:'POST',headers:{Origin:env.WEB_ORIGIN,Cookie:otherCookie,'X-Lunar-CSRF':otherData.csrf}}),env);
  const code=(await start.json()).command.slice('/link '.length),before=structuredClone(db.root);
  assert.deepEqual(await approveTelegramLunarLink(env,code,{id:880005}),{ok:false,error:'already_linked'});
  assert.deepEqual(db.root,before,'conflict must not mutate either account or the existing forward owner');
  assert.equal(await resolveTelegramAccount(env,880005),pid);
  delete env.WEB_TELEGRAM_LINK_ENABLED;
  const status=await lunarAuth(req('/auth/lunar/link/status'),env);
  assert.equal(status.status,200,'hold does not hide existing confirmed ownership');
  assert.equal((await status.json()).telegramId,880005);
 }finally{globalThis.fetch=realFetch;Date.now=clock;}
});
test('session sliding renewal stops at 24h absolute expiry and logout invalidates only its session',async()=>{
 try{
  let {env,cookie,csrf}=await fixture();
  const request=(path,method='POST',token=cookie)=>new Request(env.WEB_ORIGIN+path,{method,headers:{Origin:env.WEB_ORIGIN,Cookie:token,'X-Lunar-CSRF':csrf}});
  for(const hours of [7,14,21]){Date.now=()=>clock()+hours*3600000;assert.equal((await webAuth(request('/auth/renew'),env)).status,200);}
  Date.now=()=>clock()+24*3600000;
  assert.equal((await webAuth(request('/auth/session','GET'),env)).status,401);
  Date.now=clock;
  ({env,cookie,csrf}=await fixture());
  const second=await issueLunarWebSession(env,{id:1234567890123,lunar_account:true},pid);
  const secondCookie=second.headers.getSetCookie().find(c=>c.startsWith('__Host-lunar-session=')).split(';')[0];
  assert.equal((await webAuth(request('/auth/logout'),env)).status,200);
  assert.equal((await webAuth(request('/auth/session','GET'),env)).status,401);
  assert.equal((await webAuth(request('/auth/session','GET',secondCookie),env)).status,200);
 }finally{globalThis.fetch=realFetch;Date.now=clock;}
});
