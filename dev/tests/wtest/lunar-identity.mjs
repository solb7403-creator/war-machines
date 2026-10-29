// Independent Lunar accounts: real passkey signatures and genuine Telegram Mini App linking.
// All database, DO and Telegram API effects remain isolated in disposable fixtures.
import assert from 'node:assert/strict';
import {createHmac,webcrypto as webCrypto} from 'node:crypto';
import {makeDB} from './fakedb.mjs';
import {installWebSocketPair} from './fakedo.mjs';
import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();installWebSocketPair();
const workerModule=await import('../../../worker/src/index.js');
const worker=workerModule.default;
const db=makeDB();
const env={BOT_TOKEN:'123:passkey-fixture',FIREBASE_DB_SECRET:'SECRET',WEB_ORIGIN:'https://game.test',WEB_LOGIN_ENABLED:'0'};
const calls=[];
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,opts)=>{
 if(String(url).includes('firebaseio.com/'))return db.handle(url,opts);
 if(String(url).includes('api.telegram.org/bot')&&String(url).endsWith('/sendMessage')){
  calls.push(JSON.parse(opts.body));return Response.json({ok:true,result:{}});
 }
 throw Error('Fixture cannot access network: '+String(url));
};
const objects=new Map();
env.SESSIONS={idFromName:n=>n,get(n){if(!objects.has(n)){
 let q=Promise.resolve();const vals=new Map();const state={storage:{
  get:async k=>structuredClone(vals.get(k)),
  put:async(k,v)=>vals.set(k,structuredClone(v)),
  deleteAll:async()=>vals.clear(),setAlarm:async()=>{}
 },blockConcurrencyWhile(fn){const r=q.then(fn);q=r.catch(()=>{});return r;}};
 objects.set(n,new workerModule.WebSession(state));
}return{fetch:(url,opts)=>objects.get(n).fetch(new Request(url,opts))};}};
const origin=env.WEB_ORIGIN;
async function call(path,body,cookies='',csrf='',from=origin){
 const headers={Origin:from,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookies?{Cookie:cookies}:{}),...(csrf?{'X-Lunar-CSRF':csrf}:{})};
 return worker.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
}
const cookie=(r,k)=>r.headers.getSetCookie().find(x=>x.startsWith(k+'='))?.split(';')[0]||'';
const b64=buf=>Buffer.from(buf instanceof Uint8Array?buf:typeof buf==='string'?buf:JSON.stringify(buf)).toString('base64url');
const un64=buf=>new Uint8Array(Buffer.from(buf,'base64url'));
const concat=(...chunks)=>{const out=new Uint8Array(chunks.reduce((a,b)=>a+b.length,0));let i=0;for(const c of chunks){out.set(c,i);i+=c.length;}return out;};
function lengthHeader(major,n){
 if(n<24)return Uint8Array.of((major<<5)|n);
 if(n<256)return Uint8Array.of((major<<5)|24,n);
 if(n<65536)return Uint8Array.of((major<<5)|25,n>>8,n&255);
 throw Error('fixture CBOR length too large');
}
function cbor(v){
 if(typeof v==='number')return lengthHeader(v>=0?0:1,v>=0?v:-v-1);
 if(typeof v==='string'){const b=new TextEncoder().encode(v);return concat(lengthHeader(3,b.length),b);}
 if(v instanceof Uint8Array)return concat(lengthHeader(2,v.length),v);
 if(Array.isArray(v))return concat(lengthHeader(4,v.length),...v.map(cbor));
 const entries=v instanceof Map?[...v.entries()]:Object.entries(v);
 return concat(lengthHeader(5,entries.length),...entries.flatMap(([k,val])=>[cbor(k),cbor(val)]));
}
const rpHash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('game.test')));
const cred=crypto.getRandomValues(new Uint8Array(32));
const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',kp.publicKey);
const cose=cbor(new Map([[1,2],[3,-7],[-1,1],[-2,un64(jwk.x)],[-3,un64(jwk.y)]]));
const authDataCreate=concat(rpHash,Uint8Array.of(0x45,0,0,0,0),new Uint8Array(16),Uint8Array.of(0,cred.length),cred,cose);
const attObj=cbor({fmt:'none',attStmt:{},authData:authDataCreate});
const clientData=(type,challenge)=>new TextEncoder().encode(JSON.stringify({type,challenge,origin,crossOrigin:false}));
const now=Date.now();
let registered=await call('/auth/lunar/register/options',{name:'Lunar Ace'});
assert.equal(registered.status,200);

const pendingCookie=cookie(registered,'__Host-lunar-login'),reg=await registered.json();
assert.equal(reg.options.rp.id,'game.test');
assert.equal(reg.options.authenticatorSelection.residentKey,'required');
assert.ok(!JSON.stringify(reg).includes('Telegram'),'no Telegram in independent registration');
const registrationClient=clientData('webauthn.create',reg.options.challenge);
const registration={id:b64(cred),rawId:b64(cred),type:'public-key',response:{
 attestationObject:b64(attObj),clientDataJSON:b64(registrationClient),transports:['internal']
},clientExtensionResults:{}};
let completed=await call('/auth/lunar/register/verify',{credential:registration},pendingCookie);
assert.equal(completed.status,200,JSON.stringify(await completed.clone().json()));
const assignedCookie=cookie(completed,'__Host-lunar-session');
const first=await completed.json(),pid=first.pid;
assert.match(pid,/^ln_[0-9]{12,15}$/);
assert.equal(first.user.lunar_account,true);
assert.equal(first.user.id,Number(pid.slice(3)));
assert.equal((await call('/auth/lunar/register/verify',{credential:registration},pendingCookie)).status,401,'registration challenge is single-use');
let current=await call('/auth/session',undefined,assignedCookie);
assert.equal(current.status,200);
assert.equal((await current.json()).pid,pid);
const invalid=await call('/api/sync',{lab:1},assignedCookie);
assert.equal(invalid.status,401,'server game API requires CSRF');
let response=await call('/api/sync',{lab:1},assignedCookie,first.csrf);
assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
const game=await response.json();
assert.ok(game.ok&&game.migOk&&game.E.lab,'a new independent Lunar player can play without Telegram');
assert.equal(db.get('/eco/'+pid).mig,1);
assert.equal((await call('/auth/lunar/link/status',{},assignedCookie,first.csrf)).status,200);
const noTelegramEnv=env.BOT_TOKEN;delete env.BOT_TOKEN;
assert.equal((await call('/auth/session',undefined,assignedCookie)).status,200,'Lunar website accounts must not require bot token');
assert.equal((await call('/api/sync',{lab:1},assignedCookie,first.csrf)).status,200,'gameplay must not require Telegram for an unlinked website account');
env.BOT_TOKEN=noTelegramEnv;
console.log('PASS independent Lunar registration, authentic WebAuthn attestation, one-use state, CSRF, game sync without Telegram');

// Discoverable passkey authentication with real ECDSA assertion and counter update.
const begin=await call('/auth/lunar/login/options',{});
assert.equal(begin.status,200);
const loginCookie=cookie(begin,'__Host-lunar-login'),loginOpts=await begin.json();
assert.equal(loginOpts.options.rpId,'game.test');
const authData=concat(rpHash,Uint8Array.of(0x05,0,0,0,1));
const authClient=clientData('webauthn.get',loginOpts.options.challenge);
const hash=await crypto.subtle.digest('SHA-256',authClient);
const rawSig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},kp.privateKey,concat(authData,new Uint8Array(hash))));
const derInt=(x)=>{
 let b=Array.from(x);while(b.length>1&&b[0]===0&&b[1]<128)b.shift();
 if(b[0]>=128)b.unshift(0);return Uint8Array.of(2,b.length,...b);
};
const rSig=derInt(rawSig.slice(0,32)),sSig=derInt(rawSig.slice(32));
const der=concat(Uint8Array.of(0x30,rSig.length+sSig.length),rSig,sSig);
const assertion={id:b64(cred),rawId:b64(cred),type:'public-key',response:{
 authenticatorData:b64(authData),clientDataJSON:b64(authClient),signature:b64(der),userHandle:null
},clientExtensionResults:{}};
const login=await call('/auth/lunar/login/verify',{credential:assertion},loginCookie);
assert.equal(login.status,200,JSON.stringify(await login.clone().json()));
assert.equal((await login.json()).pid,pid);
assert.equal((await call('/auth/lunar/login/verify',{credential:assertion},loginCookie)).status,401,'assertion cannot be replayed');
const keyHash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(assertion.id));
const keyName=Buffer.from(keyHash).toString('hex');
const dbKey=db.get('/passkeys/'+keyName);
assert.ok(dbKey,'credential index saved');
assert.equal(dbKey.counter,1,'signature counter increases after legitimate authentication');

// Optional Telegram link proof requires signed private webhook, and cannot hijack another Lunar player.
const linkStart=await call('/auth/lunar/link/start',{},assignedCookie,first.csrf);
assert.equal(linkStart.status,200,JSON.stringify(await linkStart.clone().json()));
const linkBody=await linkStart.json(),linkCode=linkBody.command.match(/^\/link ([a-f0-9]{48})$/)[1];
assert.equal(linkBody.url,'https://t.me/LunarWarMachinesBot?start=link_'+linkCode);
assert.equal((await call('/auth/lunar/link/status',{},assignedCookie,first.csrf)).status,200);
const tgUser={id:888001,first_name:'Pilot',username:'tgp'};
const linkMessage={message:{text:'/start link_'+linkCode,chat:{id:888001,type:'private'},from:tgUser}};
async function webhook(body,secret){
 return worker.fetch(new Request(origin+'/api/tg-webhook',{method:'POST',headers:{
  'Content-Type':'application/json','x-telegram-bot-api-secret-token':secret
 },body:JSON.stringify(body)}),env);
}
const secret=await workerModule.webhookSecret(env);
assert.equal((await webhook(linkMessage,'not-signed')).status,403);
let statusResponse=await call('/auth/lunar/link/status',{},assignedCookie,first.csrf);
assert.equal((await statusResponse.json()).linked,false);
assert.equal((await webhook(linkMessage,secret)).status,200);
assert.equal(calls.length,1);
assert.match(calls[0].text,/linked to your LUNAR website account/);
const linked=await call('/auth/lunar/link/status',{},assignedCookie,first.csrf);
assert.equal((await linked.json()).linked,true);
assert.equal(db.get('/telegramLinks/888001'),pid);
assert.equal(db.get('/lunarAccounts/'+pid).telegramId,888001);
assert.equal((await webhook(linkMessage,secret)).status,200);
assert.match(calls.at(-1).text,/failed or expired/i);
const signed=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify(tgUser)});
const data=[...signed].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
signed.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(data).digest('hex'));
response=await call('/api/sync',{initData:signed.toString(),lab:1},'','','https://solb7403-creator.github.io');
assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
const telegramGame=await response.json();
assert.deepEqual(telegramGame.E.lab,game.E.lab,'verified Telegram Mini App uses independent Lunar account inventory');
assert.equal(db.get('/eco/'+pid).nm,'Lunar Ace','linked Telegram must retain the chosen Lunar callsign');
assert.equal(db.get('/eco/tg_888001'),null,'linked Telegram must not create a parallel account');

// A linked pilot who signs into the website through the optional Telegram bot must
// also enter the independent Lunar ID, never a duplicate tg_<id> account.
env.WEB_LOGIN_ENABLED='1'; // Only the optional bot authentication flow requires Telegram login configuration.
const botStart=await call('/auth/bot/start',{});
assert.equal(botStart.status,200);
const botBody=await botStart.json(),botCookie=cookie(botStart,'__Host-lunar-login');
const linkLogin=botBody.command.match(/^\/login ([a-f0-9]{48})$/)[1];
await webhook({message:{text:'/login '+linkLogin,chat:{id:888001,type:'private'},from:tgUser}},secret);
const botFinish=await call('/auth/bot/finish',{},botCookie);
assert.equal(botFinish.status,200);
assert.equal((await botFinish.json()).pid,undefined,'legacy bot callback does not expose player ID in the response');
const websiteFromBot=await call('/auth/session',undefined,cookie(botFinish,'__Host-lunar-session'));
assert.equal((await websiteFromBot.json()).pid,pid,'Telegram website login resolves to canonical Lunar identity');
const existing=await call('/auth/lunar/account',{},assignedCookie,first.csrf);
assert.equal((await existing.json()).telegramLinked,true);
console.log('PASS discoverable passkey signature login, counters, anti-replay, signed optional Telegram link, same game economy');
globalThis.fetch=realFetch;
