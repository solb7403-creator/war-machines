// Official website auth through real Worker routes. Telegram JWKS/database/DO transport are isolated fixtures.
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {makeDB} from './fakedb.mjs';
import {makeNamespace,installWebSocketPair} from './fakedo.mjs';
import {fakeRec} from './fakerec.mjs';
import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();installWebSocketPair();
const mod=await import('../../../worker/src/index.js'),worker=mod.default;
const db=makeDB(),pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';jwk.alg='RS256';jwk.use='sig';
globalThis.fetch=async (url,opts)=>{if(String(url).includes('firebaseio.com/'))return db.handle(url,opts);if(String(url)==='https://oauth.telegram.org/.well-known/jwks.json')return Response.json({keys:[jwk]});throw Error('No external fallback: '+url);};
const env={BOT_TOKEN:'123:fixture',FIREBASE_DB_SECRET:'SECRET',WEB_ORIGIN:'https://game.test',WEB_LOGIN_ENABLED:'1'};
async function call(path,body,cookies='',csrf='',origin=env.WEB_ORIGIN){const headers={Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookies?{Cookie:cookies}:{}),...(csrf?{'X-Lunar-CSRF':csrf}:{})};return worker.fetch(new Request(env.WEB_ORIGIN+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),env);}
let r=await call('/auth/config');assert.equal(r.status,200,'website login configuration route exists');
console.log('PASS website auth configuration route');
// Separate disposable per-token DO storage; no production database, cookies or account IDs.
const objects=new Map();env.SESSIONS={idFromName:n=>n,get(n){if(!objects.has(n)){
 let q=Promise.resolve();const vals=new Map();const state={storage:{get:async k=>structuredClone(vals.get(k)),put:async(k,v)=>vals.set(k,structuredClone(v)),deleteAll:async()=>vals.clear(),setAlarm:async()=>{}},blockConcurrencyWhile(fn){const r=q.then(fn);q=r.catch(()=>{});return r;}};
 objects.set(n,new mod.WebSession(state));}return {fetch:(url,opts)=>objects.get(n).fetch(new Request(url,opts))};}};
const cookieFrom=(r,name)=>r.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0]||'';
const b64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
async function token(nonce,patch={},header={}){const now=Math.floor(Date.now()/1000),s=b64({alg:'RS256',kid:'test-key',...header})+'.'+b64({iss:'https://oauth.telegram.org',aud:'123',sub:'different-oidc-subject',id:888001,given_name:'Web Pilot',iat:now,exp:now+300,nonce,...patch});return s+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(s))).toString('base64url');}
async function challenge(){const r=await call('/auth/challenge',{});assert.equal(r.status,200);assert.match(r.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);return {c:cookieFrom(r,'__Host-lunar-login'),...(await r.json())};}
let ch=await challenge();let jwt=await token(ch.nonce);
for(const [patch,head] of [[{aud:'evil'},{}],[{iss:'https://evil.test'},{}],[{exp:1},{}],[{nonce:'other'},{}],[{id:'888001'},{}],[{}, {alg:'none'}]]){assert.equal((await call('/auth/login',{id_token:await token(ch.nonce,patch,head)},ch.c)).status,401);}
// Fresh challenge after its bounded six failures.
ch=await challenge();jwt=await token(ch.nonce);
assert.equal((await call('/auth/login',{id_token:jwt},ch.c,'','https://evil.test')).status,403);
assert.equal((await call('/auth/login',{id_token:jwt},'')).status,401);
const [one,two]=await Promise.all([call('/auth/login',{id_token:jwt},ch.c),call('/auth/login',{id_token:jwt},ch.c)]);
assert.equal([one,two].filter(x=>x.status===200).length,1,'nonce consumption is atomic');
const logged=one.status===200?one:two,sid=cookieFrom(logged,'__Host-lunar-session'),identity=await logged.json();assert.equal(identity.user.id,888001);
assert.equal((await call('/auth/login',{id_token:jwt},ch.c)).status,401,'replay refused');
assert.equal((await call('/api/sync',{lab:1},sid)).status,401,'CSRF required');
assert.equal((await call('/api/sync',{lab:1},sid,identity.csrf,'https://evil.test')).status,401);
assert.equal((await call('/api/sync',{lab:1,initData:'unsigned'},sid,identity.csrf)).status,401,'mixed identities refused');
r=await call('/api/sync',{lab:1,mig:{pts:999999},refBy:'tg_999999'},sid,identity.csrf);assert.equal(r.status,200);let S=await r.json();assert.equal(S.E.pts,0);assert.equal(S.E.earned,0);assert.ok(S.E.lab);assert.equal(db.get('/players/tg_888001/ref'),null);
const tgData=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:888001,first_name:'Mini App',is_premium:true})});const d=[...tgData].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');tgData.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));
r=await call('/api/sync',{initData:tgData.toString(),lab:1},'', '', 'https://solb7403-creator.github.io');assert.equal(r.status,200);assert.deepEqual((await r.json()).E.lab,S.E.lab,'same canonical account across platforms');
const spec=structuredClone(S.E.lab.machines.m_spare.spec);spec.mods={hull:'plates',mobility:'stable',mount:'stock'};spec.catalog=1;
r=await call('/api/act',{a:'lab_save',id:'m_spare',rev:S.E.lab.rev,name:'Web MK-II',spec,pid:'tg_999999'},sid,identity.csrf);assert.equal(r.status,200);S=await r.json();assert.equal(S.E.lab.machines.m_spare.name,'Web MK-II');assert.equal(db.get('/eco/tg_999999'),null);
// A valid signed website session enters the same ticket/proof/scoring pipeline as Telegram.
const beforeEarned=db.get('/eco/tg_888001/earned');
const startResponse=await call('/api/match/start',{g:'arena',m:'2v2',map:'classic',pv:1,fv:1,labRev:S.E.lab.rev},sid,identity.csrf);
assert.equal(startResponse.status,200);const ticket=await startResponse.json();assert.ok(ticket.tok);
const clock=Date.now;Date.now=()=>clock()+70000;
const scored=await call('/api/match/end',{tok:ticket.tok,r:{won:true,pts:999999,stats:{dmg:2500,kills:1},pf:fakeRec({g:'arena',m:'2v2',won:true,dur:69,dmg:2500})}},sid,identity.csrf);
const score=await scored.json();assert.equal(score.ok,true,JSON.stringify(score));assert.ok(score.res.awarded>0&&score.res.awarded<1000);assert.equal(score.E.earned,beforeEarned+score.res.awarded);
const replay=await call('/api/match/end',{tok:ticket.tok,r:{won:true}},sid,identity.csrf);assert.equal((await replay.json()).E.earned,score.E.earned,'proof/ticket credit once');
Date.now=clock;
const mini=await call('/api/sync',{initData:tgData.toString(),lab:1},'','','https://solb7403-creator.github.io');assert.equal((await mini.json()).E.earned,score.E.earned,'website battle credit visible to Mini App');
// Web joins have session-bound tickets; legacy Telegram tickets keep their original format.
env.ROOM=makeNamespace(mod.PvpRoom,env);env.LOBBY=makeNamespace(mod.PvpLobby,env);
const joined=await call('/api/pvp/join',{v:1,g:'arena',m:'1v1',labRev:score.E.lab.rev,fv:1},sid,identity.csrf);const seat=await joined.json();assert.equal(joined.status,200,JSON.stringify(seat));assert.ok(seat.tok.includes('.web.'));
const wsReq=(cookies,origin)=>new Request(env.WEB_ORIGIN+'/pvp/ws?r='+seat.room+'&t='+seat.tok,{headers:{Upgrade:'websocket',Cookie:cookies,Origin:origin}});
assert.equal((await worker.fetch(wsReq('',env.WEB_ORIGIN),env)).status,403);
assert.equal((await worker.fetch(wsReq(sid,'https://evil.test'),env)).status,403);
const {who}=await import('../../../worker/src/eco.js');const knownAge={nw:1};who(knownAge,{id:888001,web_auth:true});assert.equal(knownAge.nw,1,'web profile must not reset verified account age weighting');
assert.equal((await call('/api/stars-invoice',{},sid,identity.csrf)).status,403);
r=await call('/auth/session',undefined,sid);assert.equal(r.status,200);assert.equal((await r.json()).user.id,888001);
assert.equal((await call('/auth/renew',{},sid,identity.csrf)).status,200);
assert.equal((await call('/auth/logout',{},sid,identity.csrf)).status,200);assert.equal((await call('/auth/session',undefined,sid)).status,401);
ch=await challenge();const oldNow=Date.now;Date.now=()=>oldNow()+301000;assert.equal((await call('/auth/login',{id_token:await token(ch.nonce)},ch.c)).status,401,'expired challenge');Date.now=oldNow;

// Full-page OAuth authorization-code/PKCE with a mocked Telegram token endpoint and real Worker session routes.
env.TELEGRAM_OIDC_CLIENT_SECRET='fixture-oidc-secret';
r=await call('/auth/config');assert.equal((await r.json()).enabled,true);
let start=await call('/auth/start?target=garage');
assert.equal(start.status,302);
let authURL=new URL(start.headers.get('Location'));
assert.equal(authURL.origin,'https://oauth.telegram.org');
assert.equal(authURL.pathname,'/auth');
assert.equal(authURL.searchParams.get('redirect_uri'),env.WEB_ORIGIN+'/auth/callback');
assert.equal(authURL.searchParams.get('response_type'),'code');
assert.equal(authURL.searchParams.get('code_challenge_method'),'S256');
assert.match(authURL.searchParams.get('code_challenge'),/^[A-Za-z0-9_-]+$/);
const codeCookie=cookieFrom(start,'__Host-lunar-login');
assert.match(start.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
const tokenHash=createHash('sha256').update(codeCookie.split('=')[1]).digest('hex');
const challengeRecord=await env.SESSIONS.get(tokenHash).fetch('https://session/attempt',{method:'POST'});
assert.equal(challengeRecord.status,200);
const codeChallenge=await challengeRecord.json();
assert.equal(codeChallenge.flow,'code');
assert.equal(codeChallenge.nonce,authURL.searchParams.get('nonce'));
assert.equal(codeChallenge.state,authURL.searchParams.get('state'));
const expectedPKCE=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(codeChallenge.verifier))).toString('base64url');
assert.equal(expectedPKCE,authURL.searchParams.get('code_challenge'));
const oldFetch=globalThis.fetch;let exchanges=0;
globalThis.fetch=async (url,opts)=>{
 if(String(url)==='https://oauth.telegram.org/token'){
  exchanges++;
  assert.equal(opts.method,'POST');
  assert.equal(opts.headers.Authorization,'Basic '+Buffer.from('123:fixture-oidc-secret').toString('base64'));
  const form=new URLSearchParams(opts.body);
  assert.equal(form.get('code'),'valid-disposable-code');
  assert.equal(form.get('code_verifier'),codeChallenge.verifier);
  assert.equal(form.get('redirect_uri'),env.WEB_ORIGIN+'/auth/callback');
  return Response.json({id_token:await token(codeChallenge.nonce)});
 }
 return oldFetch(url,opts);
};
const cbPath='/auth/callback?state='+encodeURIComponent(codeChallenge.state)+'&code=valid-disposable-code';
r=await call(cbPath,undefined,codeCookie);
assert.equal(r.status,303);
assert.equal(r.headers.get('Location'),'/web/play.html#garage');
const codeSession=cookieFrom(r,'__Host-lunar-session');
assert.ok(codeSession,'first-party signed session issued after verified code exchange');
assert.equal((await call('/auth/session',undefined,codeSession)).status,200);
assert.equal(exchanges,1);
r=await call(cbPath,undefined,codeCookie);
assert.equal(r.headers.get('Location'),'/web/?login=expired','replayed callback cannot issue session');
assert.equal(exchanges,1);
globalThis.fetch=oldFetch;
const wrongStart=await call('/auth/start?target=garage'),wrongCookie=cookieFrom(wrongStart,'__Host-lunar-login');
r=await call('/auth/callback?code=forged&state=incorrect',undefined,wrongCookie);
assert.equal(r.headers.get('Location'),'/web/?login=invalid');
delete env.TELEGRAM_OIDC_CLIENT_SECRET;
assert.equal((await call('/auth/config').then(r=>r.json())).enabled,false);
assert.equal((await call('/auth/start')).headers.get('Location'),'/web/?login=setup');
assert.equal((await call('/auth/session',undefined,codeSession)).status,200,'existing sessions remain valid when fresh OIDC configuration is absent');
console.log('PASS redirect OIDC PKCE/state/nonce, confidential code exchange, shared signed sessions, replay, safe setup gating');


// A Telegram-signed private bot command proves account ownership without relying on iOS OAuth handoff.
// The URL code is independent of the HttpOnly browser session secret and is strictly single-use.
let botStart=await call('/auth/bot/start',{});
assert.equal(botStart.status,200);
const botChallenge=await botStart.json(),browserCookie=cookieFrom(botStart,'__Host-lunar-login');
assert.match(botChallenge.url,/^https:\/\/t\.me\/LunarWarMachinesBot\?start=web_[a-f0-9]{48}$/);
assert.match(botChallenge.command,/^\/login [a-f0-9]{48}$/);
assert.ok(!botChallenge.url.includes(browserCookie.split('=')[1]),'deep link must never expose the browser login secret');
assert.equal((await call('/auth/bot/finish',{},browserCookie)).status,202,'browser waits for actual Telegram verification');
const code=botChallenge.command.slice('/login '.length);
const msg={message:{text:'/start web_'+code,chat:{id:888001,type:'private'},from:{id:888001,first_name:'Verified via bot',username:'realpilot'}}};
const botWebhook=async(body,secret)=>worker.fetch(new Request(env.WEB_ORIGIN+'/api/tg-webhook',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-bot-api-secret-token':secret},body:JSON.stringify(body)}),env);
assert.equal((await botWebhook(msg,'forged')).status,403,'unsigned webhook must not authorize a web login');
assert.equal((await call('/auth/bot/finish',{},browserCookie)).status,202,'forged update cannot authenticate');
let sent=[];const webhookFetch=globalThis.fetch;
globalThis.fetch=async(url,opts)=>{
 if(String(url).includes('api.telegram.org/bot')&&String(url).endsWith('/sendMessage')){
  sent.push(JSON.parse(opts.body));return Response.json({ok:true,result:{}});
 }
 return webhookFetch(url,opts);
};
const secret=await mod.webhookSecret(env);
assert.equal((await botWebhook(msg,secret)).status,200);
assert.equal(sent.length,1);assert.match(sent[0].text,/verified/i);
const botLogin=await call('/auth/bot/finish',{},browserCookie);
assert.equal(botLogin.status,200);
const botSession=cookieFrom(botLogin,'__Host-lunar-session');
assert.ok(botSession);
assert.equal((await call('/auth/session',undefined,botSession)).status,200);
assert.equal((await call('/auth/bot/finish',{},browserCookie)).status,401,'browser session cannot be claimed twice');
assert.equal((await botWebhook(msg,secret)).status,200,'replayed signed bot command must be harmless');
assert.match(sent.at(-1).text,/expired|used/i);
let second=await call('/auth/bot/start',{}),secondBody=await second.json(),secondCookie=cookieFrom(second,'__Host-lunar-login');
const crossChat={message:{text:secondBody.command,chat:{id:999003,type:'group'},from:{id:999003}}};
await botWebhook(crossChat,secret);
assert.equal((await call('/auth/bot/finish',{},secondCookie)).status,202,'group message cannot approve web identity');
await botWebhook({message:{text:secondBody.command,chat:{id:888001,type:'private'},from:{id:888001,first_name:'Verified via bot'}}},secret);
const secondDone=await call('/auth/bot/finish',{},secondCookie);
assert.equal(secondDone.status,200,'manual /login command is supported when deep link fails');
assert.equal((await secondDone.json()).user.id,888001,'bot account matches original Telegram Mini App player ID');
globalThis.fetch=webhookFetch;
console.log('PASS Telegram bot proof (signed private webhook), independent one-use code, pending/expiry, replay, no shared-secret leakage, browser session identity');

env.WEB_LOGIN_ENABLED='0';assert.equal((await call('/auth/config').then(r=>r.json())).enabled,false);assert.equal((await call('/auth/challenge',{})).status,503);
console.log('PASS official JWT signature/claims/nonce, race/replay/expiry/CSRF, first-party sessions/logout, shared Telegram identity, authoritative inventory/points/referral and private independent bays');

for(const room of env.ROOM.live.values())room.core?.closeAll();
