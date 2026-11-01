// Call sign + password accounts through the real Worker routes. Database, Durable Objects, Turnstile, Google and the
// email service are local fixtures; nothing touches a live account.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';
import {installWebSocketPair} from './fakedo.mjs';
import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();installWebSocketPair();
const mod=await import('../../../worker/src/index.js'),worker=mod.default;
const {tx}=await import('../../../worker/src/eco.js');
const {newSession}=await import('../../../worker/src/web-auth.js');
const {funnelDays}=await import('../../../worker/src/accounts.js');
const db=makeDB(),mails=[];let tsAnswer=true,googleClaims=null;
globalThis.fetch=async(url,opts={})=>{
 const u=String(url);
 if(u.includes('firebaseio.com/'))return db.handle(url,opts);
 if(u==='https://challenges.cloudflare.com/turnstile/v0/siteverify'){const p=new URLSearchParams(String(opts.body));return Response.json({success:tsAnswer&&p.get('response')==='good-token'&&p.get('secret')==='ts-secret'});}
 if(u==='https://api.resend.com/emails'){mails.push(JSON.parse(opts.body));return Response.json({id:'m'+mails.length});}
 if(u==='https://oauth2.googleapis.com/token'){const p=new URLSearchParams(String(opts.body));assert.ok(p.get('code_verifier')&&p.get('client_secret')==='g-secret');const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return Response.json({id_token:b({alg:'RS256'})+'.'+b(googleClaims)+'.sig'});}
 throw Error('No external fallback: '+u);
};
const env={BOT_TOKEN:'123:fixture',FIREBASE_DB_SECRET:'SECRET',WEB_ORIGIN:'https://game.test',WEB_LOGIN_ENABLED:'1'};
const objects=new Map();env.SESSIONS={idFromName:n=>n,get(n){if(!objects.has(n)){
 let q=Promise.resolve();const vals=new Map();const state={storage:{get:async k=>structuredClone(vals.get(k)),put:async(k,v)=>vals.set(k,structuredClone(v)),deleteAll:async()=>vals.clear(),setAlarm:async()=>{}},blockConcurrencyWhile(fn){const r=q.then(fn);q=r.catch(()=>{});return r;}};
 objects.set(n,new mod.WebSession(state));}return {fetch:(url,opts)=>objects.get(n).fetch(new Request(url,opts))};}};
let ipN=0;const freshIP=()=>'10.0.'+Math.floor(++ipN/250)+'.'+(ipN%250);
async function call(path,body,{cookie='',csrf='',origin=env.WEB_ORIGIN,ip='10.9.9.9',method}={}){
 const headers={Origin:origin,'CF-Connecting-IP':ip,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-Lunar-CSRF':csrf}:{})};
 return worker.fetch(new Request(env.WEB_ORIGIN+path,{method:method||(body===undefined?'GET':'POST'),headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
}
const cookieOf=(r,n='__Host-lunar-session')=>r.headers.getSetCookie().find(c=>c.startsWith(n+'='))||'';
const jar=r=>cookieOf(r).split(';')[0];
let passed=0;const ok=(m)=>{passed++;console.log('PASS',m);};
async function signup(cs,pw='moon tank 42',extra={},ip=freshIP()){const r=await call('/auth/acct/signup',{cs,pw,...extra},{ip});return {r,j:await r.clone().json(),c:jar(r)};}
function initData(u,sp){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify(u),...(sp?{start_param:sp}:{})});const d=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
const tgCall=(path,u,body={},sp)=>call(path,{initData:initData(u,sp),...body},{origin:'https://solb7403-creator.github.io'});

// ---- config + live availability ----
let r=await call('/auth/acct/config');assert.equal(r.status,200);let j=await r.json();
assert.deepEqual([j.google,j.email,j.turnstile],[false,false,null],'optional extras stay off until their secrets exist');
r=await call('/auth/acct/check',{cs:'Jake'});j=await r.json();assert.equal(j.available,true);
for(const [cs,why] of [['Jäke','chars'],['Jake😀','chars'],['Jake Doe','spaces'],['ab','short'],['admin','reserved'],['Lunar','reserved'],['lunarbattle','reserved'],['Support_1','reserved'],['FuckYou','blocked'],['sh1t','blocked']]){
 j=await (await call('/auth/acct/check',{cs})).json();assert.equal(j.available,false,cs);assert.equal(j.reason,why,cs);
}
assert.equal((await call('/auth/acct/check',{cs:'Jake'},{origin:'https://evil.test'})).status,403,'same-origin only');
ok('live call sign check: ASCII only, no spaces, 3-16, reserved names and profanity blocked');

// ---- signup happy path ----
const before=JSON.stringify(db.get('/fn')||{});
let s=await signup('Jake');assert.equal(s.r.status,200,JSON.stringify(s.j));
const jake=s.j.pid,jakeCookie=s.c;assert.match(jake,/^ln_\d{12,15}$/);
const setCookie=cookieOf(s.r);assert.match(setCookie,/^__Host-lunar-session=[a-f0-9]{64}; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=7776000$/,'90-day first-party HttpOnly cookie');
assert.ok(!JSON.stringify(s.j).includes('moon tank'),'password never returned');
const acc=db.get('/lunarAccounts/'+jake);assert.equal(acc.type,'password');assert.equal(acc.pw.v,1);assert.equal(acc.pw.it,100000);assert.ok(acc.pw.s&&acc.pw.h);
assert.ok(!JSON.stringify(db.root).includes('moon tank 42'),'password not stored anywhere');
r=await call('/auth/session',undefined,{cookie:jakeCookie});j=await r.json();assert.equal(j.pid,jake);assert.equal(j.user.callsign,'Jake');assert.equal(j.keep,true);
const jakeCsrf=j.csrf;
r=await call('/api/sync',{lab:1},{cookie:jakeCookie,csrf:jakeCsrf});j=await r.json();assert.equal(r.status,200,JSON.stringify(j));
assert.equal(j.cs,'Jake');assert.ok(j.migOk&&j.E.lab,'plays right away');assert.equal(db.get('/eco/'+jake).nm,'Jake');assert.equal(db.get('/players/'+jake).name,'Jake');
assert.equal(db.get('/fn/'+Math.floor(Date.now()/864e5)).made>=1,true,'funnel: account made');
ok('signup: call sign + password, straight into the game, 90-day session, hashed (PBKDF2 v1, 100k) password');

// ---- duplicates: exact match ignoring case only ----
s=await signup('jake');assert.equal(s.r.status,409);assert.equal(s.j.field,'cs');assert.equal(s.j.ideas.length,3,'three alternatives');
for(const i of s.j.ideas)assert.equal((await (await call('/auth/acct/check',{cs:i})).json()).available,true,'suggestions are free');
s=await signup('JAKE');assert.equal(s.r.status,409);
for(const cs of ['j@ke','Jake1','J4ke']){s=await signup(cs);assert.equal(s.r.status,200,cs+' '+JSON.stringify(s.j));assert.equal(db.get('/cs/'+s.j.pid).n,cs,'shown exactly as typed');}
s=await signup('Jäke');assert.equal(s.r.status,400);assert.equal(s.j.field,'cs');
s=await signup('Ace Pilot');assert.equal(s.r.status,400);
ok('duplicates: Jake/jake/JAKE clash; j@ke, Jake1, J4ke allowed; non-ASCII and spaces rejected; 3 free suggestions');

// ---- passwords ----
for(const pw of ['short','password1','12345678','aaaaaaaa','qwerty123']){s=await signup('Pw_'+pw.length+pw[0],pw);assert.equal(s.r.status,400,pw);assert.equal(s.j.field,'pw',pw);}
s=await signup('SameName','samename');assert.equal(s.r.status,400);
ok('weak and common passwords rejected with a friendly hint (min 8, no other rules)');

// ---- login, no enumeration, lockout ----
r=await call('/auth/acct/login',{cs:'JAKE',pw:'moon tank 42',keep:false},{ip:'10.8.0.1'});j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.equal(j.pid,jake);
assert.match(cookieOf(r),/SameSite=Lax$/,'keep me signed in off: browser-session cookie (no Max-Age)');
const wrong=await call('/auth/acct/login',{cs:'Jake',pw:'not it at all'},{ip:'10.8.0.2'}),unknown=await call('/auth/acct/login',{cs:'NoSuchPilot',pw:'not it at all'},{ip:'10.8.0.2'});
assert.equal(wrong.status,401);assert.equal(unknown.status,401);
const [wj,uj]=[await wrong.json(),await unknown.json()];assert.deepEqual(wj,uj,'same answer for wrong password and unknown call sign');assert.equal(wj.msg,'Wrong call sign or password.');
for(let i=0;i<3;i++)await call('/auth/acct/login',{cs:'Jake',pw:'bad guess '+i},{ip:'10.8.0.3'});
r=await call('/auth/acct/login',{cs:'Jake',pw:'bad guess 4'},{ip:'10.8.0.3'});j=await r.json();assert.equal(r.status,401);assert.match(j.msg,/Too many tries/,'5th failure locks');
r=await call('/auth/acct/login',{cs:'Jake',pw:'moon tank 42'},{ip:'10.8.0.4'});assert.equal(r.status,429,'locked even with the right password');assert.match((await r.json()).msg,/wait \d+ minute/);
// the lock also applies to a call sign that doesn't exist (so a lock reveals nothing)
for(let i=0;i<5;i++)await call('/auth/acct/login',{cs:'Ghost_99',pw:'bad guess '+i},{ip:'10.8.0.5'});
assert.equal((await call('/auth/acct/login',{cs:'Ghost_99',pw:'x'},{ip:'10.8.0.6'})).status,429);
db.root.lf['6a616b65'].until=Date.now()-1;
r=await call('/auth/acct/login',{cs:'Jake',pw:'moon tank 42'},{ip:'10.8.0.4'});assert.equal(r.status,200,'unlocks after the wait');assert.equal(db.get('/lf/6a616b65'),null,'success clears the counter');
// per network: many failures across call signs from one address back off too
for(let i=0;i<40;i++)await call('/auth/acct/login',{cs:'Spray'+i,pw:'x'},{ip:'10.7.7.7'});
r=await call('/auth/acct/login',{cs:'Jake',pw:'moon tank 42'},{ip:'10.7.7.7'});assert.equal(r.status,429,'network backoff');
ok('login: case-insensitive call sign, keep-signed-in choice, identical errors, lockout per call sign and per network');

// ---- password change signs out other sessions; log out everywhere ----
const a1=await call('/auth/acct/login',{cs:'Jake',pw:'moon tank 42'},{ip:'10.8.1.1'}),a2=await call('/auth/acct/login',{cs:'Jake',pw:'moon tank 42'},{ip:'10.8.1.2'});
const c1=jar(a1),c2=jar(a2),k1=(await a1.json()).csrf;
r=await call('/auth/acct/password',{pw:'new moon 77'},{cookie:c1,csrf:k1});assert.equal(r.status,401,'current password needed');
r=await call('/auth/acct/password',{cur:'moon tank 42',pw:'new moon 77'},{cookie:c1,csrf:k1});j=await r.json();assert.equal(r.status,200,JSON.stringify(j));
const c1b=jar(r);assert.ok(c1b&&c1b!==c1,'this device gets a fresh session');
assert.equal((await call('/auth/session',undefined,{cookie:c2})).status,401,'other device signed out');
assert.equal((await call('/auth/session',undefined,{cookie:jakeCookie})).status,401,'signup session signed out too');
assert.equal((await call('/auth/session',undefined,{cookie:c1b})).status,200);
assert.equal((await call('/auth/acct/login',{cs:'Jake',pw:'moon tank 42'},{ip:'10.8.1.3'})).status,401,'old password gone');
r=await call('/auth/acct/login',{cs:'Jake',pw:'new moon 77'},{ip:'10.8.1.3'});assert.equal(r.status,200);
const c3=jar(r),k3=(await r.json()).csrf;
r=await call('/auth/acct/logout-all',{},{cookie:c3,csrf:k3});assert.equal(r.status,200);
for(const c of [c1b,c3])assert.equal((await call('/auth/session',undefined,{cookie:c})).status,401,'log out everywhere');
ok('password change signs out other sessions; log out everywhere ends all');

// ---- session refresh on use ----
r=await call('/auth/acct/login',{cs:'Jake',pw:'new moon 77'},{ip:'10.8.1.4'});const cj=jar(r);let jj=await r.json();
const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(cj.split('=')[1]))).toString('hex');
const rec=objects.get(hash);const stored=await rec.state.storage.get('record');stored.expires=Date.now()+3*864e5;await rec.state.storage.put('record',stored);
r=await call('/auth/session',undefined,{cookie:cj});assert.equal(r.status,200);assert.match(cookieOf(r),/Max-Age=77\d{5}/,'opening the site pushes the 90 days forward again');
assert.ok((await r.json()).expires>Date.now()+89*864e5);
ok('sessions refresh on use (90 days from the last visit)');

// ---- signup limits and Turnstile ----
const busyIP='10.66.0.1';for(let i=0;i<3;i++)assert.equal((await signup('Farm'+i,'moon tank 42',{},busyIP)).r.status,200);
s=await signup('Farm3','moon tank 42',{},busyIP);assert.equal(s.r.status,200,'Turnstile off: a household can still sign up a few');
assert.ok(db.get('/flags/'+s.j.pid),'4th from one network is flagged for review (not banned)');
s=await signup('Farm4','moon tank 42',{},busyIP);s=await signup('Farm5','moon tank 42',{},busyIP);
s=await signup('Farm6','moon tank 42',{},busyIP);assert.equal(s.r.status,429,'Turnstile off: a hard daily stop per network');
env.TURNSTILE_SECRET='ts-secret';env.TURNSTILE_SITE_KEY='ts-site';
assert.equal((await (await call('/auth/acct/config')).json()).turnstile,'ts-site');
const ip2='10.66.0.2';for(let i=0;i<3;i++)assert.equal((await signup('Bot'+i,'moon tank 42',{},ip2)).r.status,200,'normal players never see a check');
s=await signup('Bot3','moon tank 42',{},ip2);assert.equal(s.r.status,428);assert.equal(s.j.siteKey,'ts-site');
s=await signup('Bot3','moon tank 42',{ts:'bad-token'},ip2);assert.equal(s.r.status,428);
s=await signup('Bot3','moon tank 42',{ts:'good-token'},ip2);assert.equal(s.r.status,200,'passes with a valid Turnstile token');
const did='a1b2c3d4e5f60718';for(let i=0;i<2;i++)assert.equal((await signup('Dev'+i,'moon tank 42',{did})).r.status,200);
assert.equal((await signup('Dev2','moon tank 42',{did})).r.status,428,'one device making accounts gets the check');
assert.equal((await signup('Dev2','moon tank 42',{did,ts:'good-token'})).r.status,200);
assert.equal((await signup('Dev3','moon tank 42',{did,ts:'good-token'})).r.status,200);
assert.equal((await signup('Dev4','moon tank 42',{did,ts:'good-token'})).r.status,429,'hard stop per device per day');
delete env.TURNSTILE_SECRET;delete env.TURNSTILE_SITE_KEY;
ok('signup gate: no captcha for normal players, limits per network/device, Turnstile only on bursts (off and on), flags not bans');

// ---- referral survives signup and binds at account creation ----
const lj=await call('/auth/acct/login',{cs:'Jake',pw:'new moon 77'},{ip:'10.8.2.2'}),ljc=jar(lj),ljk=(await lj.json()).csrf;
r=await call('/api/squad',{},{cookie:ljc,csrf:ljk});const code=(await r.json()).code;assert.match(code,/^[a-hjkmnp-z2-9]{8}$/);
j=await (await call('/auth/acct/invite',{c:code})).json();assert.equal(j.name,'Jake','"You were invited by Jake"');
s=await signup('Recruit_1','moon tank 42',{inv:code});assert.equal(s.r.status,200);
r=await call('/auth/session',undefined,{cookie:s.c});const rk=(await r.json()).csrf;
r=await call('/api/sync',{lab:1},{cookie:s.c,csrf:rk});j=await r.json();assert.equal(j.rec.ref,jake,'invite bound on the first sync after signup');
assert.equal(db.get('/players/'+s.j.pid+'/ref'),jake);
ok('referral: invite captured before signup, shown as social proof, bound at account creation');

// ---- Telegram players pick a call sign; uniqueness covers every account ----
const tgU={id:5550001,first_name:'Jake',username:'jake'};
r=await tgCall('/api/sync',tgU,{lab:1});j=await r.json();assert.equal(r.status,200);assert.equal(j.cs,null,'no call sign yet: the game asks');
r=await tgCall('/api/callsign',tgU,{op:'info'});j=await r.json();assert.equal(j.cs,null);assert.equal(j.suggest,null,'"jake" is taken, so no prefill');assert.equal(j.ideas.length,3);
r=await tgCall('/api/callsign',tgU,{op:'set',cs:'jake'});assert.equal(r.status,409,'Telegram players are in the same namespace');
r=await tgCall('/api/callsign',tgU,{op:'set',cs:'TgJake'});j=await r.json();assert.equal(r.status,200,JSON.stringify(j));
r=await tgCall('/api/sync',tgU,{lab:1});j=await r.json();assert.equal(j.cs,'TgJake');assert.equal(db.get('/eco/tg_5550001').nm,'TgJake','public name is the call sign');
const tgV={id:5550002,first_name:'Moon Walker'};r=await tgCall('/api/callsign',tgV,{op:'info'});j=await r.json();assert.equal(j.suggest,'Moon_Walker','prefilled from the Telegram name');
// one free change in the first 7 days, then locked; the old name is held 30 days for its owner
r=await tgCall('/api/callsign',tgU,{op:'set',cs:'TgJake2'});assert.equal(r.status,200,'one free change (typo fix)');
assert.equal((await (await call('/auth/acct/check',{cs:'TgJake'})).json()).available,false,'old name held (no impersonation)');
s=await signup('tgjake');assert.equal(s.r.status,409);
r=await tgCall('/api/callsign',tgU,{op:'set',cs:'TgJake3'});assert.equal(r.status,400);assert.equal((await r.json()).error,'locked');
r=await tgCall('/api/callsign',tgV,{op:'set',cs:'Walker_1'});assert.equal(r.status,200);db.root.cs.tg_5550002.t=Date.now()-8*864e5;
r=await tgCall('/api/callsign',tgV,{op:'set',cs:'Walker_2'});assert.equal(r.status,400,'after 7 days: locked');
db.root.csk[Object.keys(db.root.csk).find(k=>db.root.csk[k].n==='TgJake')].until=Date.now()-1;
assert.equal((await (await call('/auth/acct/check',{cs:'TgJake'})).json()).available,true,'freed after 30 days');
ok('Telegram players pick a call sign (prefilled, suggestions), one namespace, one free change in 7 days, old name held 30 days');

// ---- one account across website and Telegram ----
s=await signup('WebAce','ace of moons');const web=s.j.pid;
const fresh={id:5550010,first_name:'Fresh'};await tgCall('/api/sync',fresh,{lab:1});
r=await tgCall('/api/tglink',fresh,{cs:'WebAce',pw:'wrong one!!'});assert.equal(r.status,401);
r=await tgCall('/api/tglink',fresh,{cs:'webace',pw:'ace of moons'});j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.equal(j.pid,web);
r=await tgCall('/api/sync',fresh,{lab:1});j=await r.json();assert.equal(j.pid,web,'Mini App now opens the website account');assert.equal(j.cs,'WebAce');
assert.equal(db.get('/eco/tg_5550010'),null,'the empty Telegram-only record is gone');assert.equal(db.get('/lunarAccounts/'+web).telegramId,5550010);
r=await tgCall('/api/tglink',fresh,{cs:'WebAce',pw:'ace of moons'});assert.equal(r.status,409,'already linked');
// a Telegram account with its own progress is never merged
const veteran={id:5550011,first_name:'Vet'};await tgCall('/api/sync',veteran,{lab:1});await tgCall('/api/act',veteran,{a:'login'});
s=await signup('WebTwo','ace of moons');
r=await tgCall('/api/tglink',veteran,{cs:'WebTwo',pw:'ace of moons'});assert.equal(r.status,409);assert.equal((await r.json()).error,'telegram_progress_exists');
// website "Link Telegram": the bot confirms a one-time code
r=await call('/auth/acct/login',{cs:'WebTwo',pw:'ace of moons'},{ip:'10.8.3.1'});const w2=jar(r),w2k=(await r.json()).csrf;
r=await call('/auth/lunar/link/start',{},{cookie:w2,csrf:w2k});assert.equal(r.status,200);const lc=(await r.json()).command.split(' ')[1];
const secret=await mod.webhookSecret(env),tgw={id:5550012,first_name:'Linker'};
const sent=[];const f0=globalThis.fetch;globalThis.fetch=async(u,o)=>String(u).includes('api.telegram.org')?(sent.push(1),Response.json({ok:true})):f0(u,o);
await worker.fetch(new Request(env.WEB_ORIGIN+'/api/tg-webhook',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-bot-api-secret-token':secret},body:JSON.stringify({message:{text:'/link '+lc,chat:{id:tgw.id,type:'private'},from:tgw}})}),env);
globalThis.fetch=f0;
r=await tgCall('/api/sync',tgw,{lab:1});assert.equal((await r.json()).pid,db.get('/csk/'+Buffer.from('webtwo').toString('hex')).p,'linked from Settings');
ok('same account on the website (call sign + password) and in Telegram (log in with call sign, or Link Telegram); progress never merged');

// ---- Telegram pilot on the website adds a password (keeps the same tg_ record) ----
const tgS=await newSession(env,{id:5550001,first_name:'Jake',username:'jake',web_auth:true},'tg_5550001',{via:'telegram'});
const tgc='__Host-lunar-session='+tgS.sid;
r=await call('/auth/acct/me',{},{cookie:tgc,csrf:tgS.csrf});j=await r.json();assert.equal(j.kind,'telegram');assert.equal(j.cs,'TgJake2');assert.equal(j.hasPassword,false);
r=await call('/auth/acct/password',{pw:'telegram moon 9'},{cookie:tgc,csrf:tgS.csrf});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
assert.equal(db.get('/lunarAccounts/tg_5550001').type,'password');
r=await call('/auth/acct/login',{cs:'tgjake2',pw:'telegram moon 9'},{ip:'10.8.4.1'});assert.equal((await r.json()).pid,'tg_5550001','call sign login reaches the original Telegram pilot');
r=await tgCall('/api/sync',tgU,{lab:1});assert.equal((await r.json()).pid,'tg_5550001','Mini App unchanged');
ok('a Telegram pilot can add a password on the website and log in anywhere with the call sign');

// ---- passkey stays an optional extra ----
r=await call('/auth/acct/login',{cs:'WebAce',pw:'ace of moons'},{ip:'10.8.5.1'});const wa=jar(r),wak=(await r.json()).csrf;
r=await call('/auth/lunar/addkey/options',{},{cookie:wa,csrf:wak});j=await r.json();assert.equal(r.status,200,JSON.stringify(j));assert.equal(j.options.rp.id,'game.test');assert.equal(j.options.user.name,'WebAce');
assert.equal((await call('/auth/lunar/addkey/options',{},{cookie:wa,csrf:'bad'})).status,403,'CSRF');
r=await call('/auth/acct/me',{},{cookie:wa,csrf:wak});j=await r.json();assert.equal(j.recovery,true,'linked Telegram counts as a way back in');assert.equal(j.passkeys,0);
ok('passkey is an optional add-on for password accounts (never required to play)');

// ---- recovery email + reset (only once RESEND_API_KEY is set) ----
r=await call('/auth/acct/email',{email:'p@example.com'},{cookie:wa,csrf:wak});assert.equal(r.status,503);assert.match((await r.json()).msg,/coming soon/);
env.RESEND_API_KEY='re_test';
r=await call('/auth/acct/email',{email:'pilot@example.com'},{cookie:wa,csrf:wak});assert.equal(r.status,200);
const vt=/verify=([a-f0-9]{64})/.exec(mails.at(-1).text)[1];assert.equal(mails.at(-1).to[0],'pilot@example.com');
assert.equal((await call('/auth/acct/email/verify',{t:vt})).status,200);assert.equal(db.get('/lunarAccounts/'+web).email.v,true);
r=await call('/auth/acct/reset/request',{cs:'nobody_here'});assert.deepEqual(await r.json(),{ok:true,email:true},'same answer for unknown call signs');
const nMail=mails.length;r=await call('/auth/acct/reset/request',{cs:'WebAce'});assert.deepEqual(await r.json(),{ok:true,email:true});assert.equal(mails.length,nMail+1);
const rt=/reset=([a-f0-9]{64})/.exec(mails.at(-1).text)[1];
r=await call('/auth/acct/reset/finish',{t:rt,pw:'brand new moon'});assert.equal(r.status,200);
assert.equal((await call('/auth/session',undefined,{cookie:wa})).status,401,'reset signs out old sessions');
assert.equal((await call('/auth/acct/reset/finish',{t:rt,pw:'another moon 1'})).status,401,'reset link is single-use');
assert.equal((await call('/auth/acct/login',{cs:'WebAce',pw:'brand new moon'},{ip:'10.8.5.2'})).status,200);
delete env.RESEND_API_KEY;
ok('recovery email: "coming soon" until set up; verified address; reset link one-time, no enumeration, ends old sessions');

// ---- Google sign-in (on only with its secrets) ----
assert.equal((await call('/auth/google/start')).headers.get('Location'),'/web/login.html?login=google_off');
env.GOOGLE_OAUTH_CLIENT_ID='g-client';env.GOOGLE_OAUTH_CLIENT_SECRET='g-secret';
r=await call('/auth/google/start');const loc=new URL(r.headers.get('Location'));assert.equal(loc.origin+loc.pathname,'https://accounts.google.com/o/oauth2/v2/auth');
assert.equal(loc.searchParams.get('code_challenge_method'),'S256');assert.equal(loc.searchParams.get('redirect_uri'),'https://game.test/auth/google/callback');
const gc=cookieOf(r,'__Host-lunar-login').split(';')[0];
googleClaims={iss:'https://accounts.google.com',aud:'g-client',sub:'1098765432101',nonce:loc.searchParams.get('nonce'),exp:Date.now()/1000+300};
r=await call('/auth/google/callback?state=wrong&code=abc',undefined,{cookie:gc});assert.match(r.headers.get('Location'),/invalid/);
r=await call('/auth/google/start');const loc2=new URL(r.headers.get('Location')),gc2=cookieOf(r,'__Host-lunar-login').split(';')[0];googleClaims.nonce=loc2.searchParams.get('nonce');
r=await call('/auth/google/callback?state='+loc2.searchParams.get('state')+'&code=abc',undefined,{cookie:gc2});assert.equal(r.headers.get('Location'),'/web/play.html#play');
const gs=jar(r);j=await (await call('/auth/session',undefined,{cookie:gs})).json();const gpid=j.pid;assert.match(gpid,/^ln_/);
r=await call('/api/sync',{lab:1},{cookie:gs,csrf:j.csrf});assert.equal((await r.json()).cs,null,'new Google account picks its call sign next');
r=await call('/auth/acct/callsign',{cs:'GooglePilot'},{cookie:gs,csrf:j.csrf});assert.equal(r.status,200);
r=await call('/auth/google/start');const loc3=new URL(r.headers.get('Location')),gc3=cookieOf(r,'__Host-lunar-login').split(';')[0];googleClaims.nonce=loc3.searchParams.get('nonce');
r=await call('/auth/google/callback?state='+loc3.searchParams.get('state')+'&code=abc',undefined,{cookie:gc3});
assert.equal((await (await call('/auth/session',undefined,{cookie:jar(r)})).json()).pid,gpid,'same Google account, same pilot');
delete env.GOOGLE_OAUTH_CLIENT_ID;delete env.GOOGLE_OAUTH_CLIENT_SECRET;
ok('Google sign-in: off without secrets; PKCE + state + nonce; creates or reopens the same kind of account; picks a call sign');

// ---- existing accounts keep working (owner's passkey account, Telegram pilots) ----
const legacy='ln_1234567890123';db.root.lunarAccounts[legacy]={id:legacy,name:'Owner Pilot',created:1,type:'passkey',credentialIDs:['abc']};
const ls=await newSession(env,{id:1234567890123,first_name:'Owner Pilot',username:'Owner Pilot',web_auth:true,lunar_account:true},legacy,{via:'passkey'});
const lsc='__Host-lunar-session='+ls.sid;
r=await call('/api/sync',{lab:1},{cookie:lsc,csrf:ls.csrf});j=await r.json();assert.equal(r.status,200);assert.equal(j.cs,null,'asked once for a call sign');
r=await call('/auth/acct/me',{},{cookie:lsc,csrf:ls.csrf});j=await r.json();assert.equal(j.hasPassword,false);assert.equal(j.recovery,true,'their passkey is their way back in');
r=await call('/auth/acct/callsign',{cs:'OwnerPilot'},{cookie:lsc,csrf:ls.csrf});assert.equal(r.status,200);
r=await call('/auth/acct/password',{pw:'owner moon 2026'},{cookie:lsc,csrf:ls.csrf});assert.equal(r.status,200,'no current password needed after a passkey sign-in');
assert.equal(db.get('/lunarAccounts/'+legacy).type,'passkey','still a passkey account, now with a password too');
assert.equal((await call('/auth/acct/login',{cs:'OwnerPilot',pw:'owner moon 2026'},{ip:'10.8.6.1'})).status,200);
// the owner's own Telegram handle is reserved for everyone else, allowed for the owner
const owner={id:4242,first_name:'Jake',username:'lunarbattle'};
assert.equal((await tgCall('/api/callsign',{id:4243,first_name:'X',username:'someone'},{op:'set',cs:'lunarbattle'})).status,400);
assert.equal((await tgCall('/api/callsign',owner,{op:'set',cs:'LunarBattle'})).status,200,'owner can take their handle');
ok('existing passkey and Telegram accounts keep working; one-time call sign + password set-up; owner handle reserved');

// ---- delete account ----
s=await signup('Leaver','leaving moon');const lv=s.j.pid;r=await call('/auth/session',undefined,{cookie:s.c});const lvk=(await r.json()).csrf;
await call('/api/sync',{lab:1},{cookie:s.c,csrf:lvk});assert.ok(db.get('/eco/'+lv));
assert.equal((await call('/auth/acct/delete',{confirm:'leaver'},{cookie:s.c,csrf:lvk})).status,400,'must type the call sign exactly');
r=await call('/auth/acct/delete',{confirm:'Leaver'},{cookie:s.c,csrf:lvk});assert.equal(r.status,200);
for(const p of ['/eco/','/players/','/lunarAccounts/','/cs/'])assert.equal(db.get(p+lv),null,p);
assert.equal((await call('/auth/session',undefined,{cookie:s.c})).status,401);
assert.equal((await call('/auth/acct/login',{cs:'Leaver',pw:'leaving moon'},{ip:'10.8.7.1'})).status,401);
assert.equal((await signup('leaver')).r.status,409,'name stays reserved 30 days');
ok('delete account: personal data and progress removed, sessions ended, call sign held 30 days');

// ---- funnel counters ----
const day=Math.floor(Date.now()/864e5),f1=structuredClone(db.get('/fn/'+day)||{});
await call('/auth/acct/ping',{e:'land'},{ip:'10.5.0.1'});await call('/auth/acct/ping',{e:'view'},{ip:'10.5.0.1'});await call('/auth/acct/ping',{e:'made'},{ip:'10.5.0.1'});
const f2=structuredClone(db.get('/fn/'+day));assert.equal(f2.land,(f1.land||0)+1);assert.equal(f2.view,(f1.view||0)+1);assert.equal(f2.made,f1.made,'the page cannot count accounts');
s=await signup('Rookie_1');const rp=s.j.pid;await tx(env,rp,S=>{S.mp=1;});await tx(env,rp,S=>{S.days=2;});
const f3=db.get('/fn/'+day);assert.equal(f3.first,(f2.first||0)+1);assert.equal(f3.ret2,(f2.ret2||0)+1);assert.equal(f3.made,f2.made+1);
const rows=await funnelDays(env,7);assert.equal(rows.length,7);assert.equal(rows[0].day,day);assert.equal(rows[0].made,f3.made);
assert.ok(!JSON.stringify(db.get('/fn')).match(/ln_|tg_|10\.5/),'counters only, no personal data');
ok('signup funnel: landing visits, signup views, accounts made, first match, day-2 return per day, shown in admin');

console.log('accounts: passed '+passed);
