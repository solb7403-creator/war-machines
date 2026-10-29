// Real workerd + SQLite Durable Objects + WebSockets, with ONLY Firebase REST mocked.
// Run: npx -y --package=wrangler@4 -c 'node smoke-runtime.mjs' (from worker/).
// Reuse Wrangler's installed runtime/bundler; no production DB, bot or external fallback.
import assert from 'node:assert/strict';
import { existsSync, realpathSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { makeDB } from '../dev/tests/wtest/fakedb.mjs';
import { buildSim } from './build-sim.mjs';
import {webFixture} from '../dev/tests/web-fixture.mjs';
import {WebSession} from './src/web-auth.js';
const here=dirname(fileURLToPath(import.meta.url));
const binary=process.env.PATH.split(delimiter).map(p=>join(p,'wrangler')).find(existsSync);
assert.ok(binary,'Run through npm exec --package=wrangler@4');
const fromWrangler=createRequire(realpathSync(binary));
const {Miniflare,convertV4MiniflareOptions}=fromWrangler('miniflare'),{build}=fromWrangler('esbuild');
buildSim();
const bundle=await build({entryPoints:[join(here,'src/index.js')],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
const identity=await webFixture(WebSession);
const db=makeDB(),unexpected=[];let unavailable=true;
const mf=new Miniflare(convertV4MiniflareOptions({host:'127.0.0.1',port:0,name:'lunar-runtime-smoke',modules:true,script:bundle.outputFiles[0].text,
 compatibilityDate:readFileSync(join(here,'wrangler.toml'),'utf8').match(/compatibility_date\s*=\s*"([^"]+)"/)[1],
 durableObjects:{ROOM:{className:'PvpRoom',useSQLite:true},LOBBY:{className:'PvpLobby',useSQLite:true},SESSIONS:{className:'WebSession',useSQLite:true}},
 bindings:{BOT_TOKEN:'smoke-token',FIREBASE_DB_SECRET:'SECRET',PVP_WAIT_MS:'3000',WEB_ORIGIN:'https://web.smoke.test',WEB_LOGIN_ENABLED:'1',TELEGRAM_WEB_CLIENT_ID:'123'},
 outboundService:async req=>{
  const u=new URL(req.url);
  if(u.href==='https://oauth.telegram.org/.well-known/jwks.json')return Response.json({keys:[identity.key]});
  if(u.origin!=='https://warmachines-a6034-default-rtdb.firebaseio.com'){
   unexpected.push(u.origin+u.pathname);throw new Error('No external fallback in runtime smoke');
  }
  if(unavailable)return new Response('fixture unavailable',{status:503});
  return db.handle(req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:await req.text()});
 }
}));
try{
 const base=String(await mf.ready).replace(/\/$/,'');
 const q=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:91999,username:'unavailable'})});
 const d=[...q].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');
 q.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update('smoke-token').digest()).update(d).digest('hex'));
 const rejected=await fetch(base+'/api/pvp/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:q.toString(),v:1,g:'arena',m:'1v1'})});
 assert.equal(rejected.status,500,'unavailable authoritative storage fails closed');
 assert.match((await rejected.json()).detail,/db get eco\/tg_91999 503/,'failure traced to authoritative account read');
 assert.equal(db.get('/eco/tg_91999'),null,'failed read cannot create a phantom account');
 unavailable=false;
 const code=await new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[join(here,'smoke.mjs')],{cwd:here,env:{...process.env,SMOKE_URL:base,SMOKE_BOT_TOKEN:'smoke-token'},stdio:'inherit'});
  p.on('error',reject);p.on('exit',resolve);
 });
 assert.equal(code,0,'real runtime smoke completed');assert.deepEqual(unexpected,[],'no production/external fallback');
 const callWeb=(path,body,cookies='',csrf='')=>mf.dispatchFetch('https://web.smoke.test'+path,{method:body?'POST':'GET',headers:{Origin:'https://web.smoke.test','Content-Type':'application/json',Cookie:cookies,'X-Lunar-CSRF':csrf},body:body?JSON.stringify(body):undefined});
 const challenge=await callWeb('/auth/challenge',{});assert.equal(challenge.status,200);
 const nonce=await challenge.json(),loginCookie=challenge.headers.get('Set-Cookie').split(';')[0];
 const signed=await identity.token(nonce.nonce,8837111);
 const login=await callWeb('/auth/login',{id_token:signed},loginCookie);assert.equal(login.status,200);
 const who=await login.json(),sid=login.headers.getSetCookie().find(c=>c.startsWith('__Host-lunar-session=')).split(';')[0];
 assert.equal((await callWeb('/auth/login',{id_token:signed},loginCookie)).status,401,'SQLite nonce consumed once');
 const shared=await callWeb('/api/sync',{lab:1,mig:{pts:999999}},sid,who.csrf);assert.equal(shared.status,200);
 const account=await shared.json();assert.equal(account.E.earned,0);assert.equal(Object.keys(account.E.lab.machines).length,2);
 assert.equal((await callWeb('/api/sync',{},sid)).status,401,'SQLite session enforces CSRF');
 const joinedWeb=await callWeb('/api/pvp/join',{v:1,g:'arena',m:'1v1',fv:1,labRev:account.E.lab.rev},sid,who.csrf);assert.equal(joinedWeb.status,200);const seat=await joinedWeb.json();
 const socket=await mf.dispatchFetch('https://web.smoke.test/pvp/ws?r='+seat.room+'&t='+seat.tok,{headers:{Upgrade:'websocket',Origin:'https://web.smoke.test',Cookie:sid}});assert.equal(socket.status,101);assert.ok(socket.webSocket);socket.webSocket.accept();socket.webSocket.close();
 assert.equal((await callWeb('/auth/logout',{},sid,who.csrf)).status,200);
 assert.equal((await callWeb('/auth/session',undefined,sid)).status,401);
 console.log('WEB RUNTIME OK: real SQLite sessions/nonce replay/logout, RS256 identity, shared authoritative account and authenticated WebSocket');

 assert.ok(db.log.some(x=>x.startsWith('GET /eco/')),'join exercised actual authoritative reads');
 console.log('RUNTIME FIXTURE OK: account-read outage rejected; isolated Firebase only; real workerd/DO/WebSockets');
}finally{await mf.dispose();}
