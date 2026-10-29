// Disposable real Worker + fake DB/IDP for website browser QA. This file is not a production route.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {makeDB} from './wtest/fakedb.mjs';import {makeNamespace,installWebSocketPair} from './wtest/fakedo.mjs';import {buildSim} from '../../worker/build-sim.mjs';import {webFixture} from './web-fixture.mjs';
buildSim();installWebSocketPair();const mod=await import('../../worker/src/index.js'),db=makeDB(),fixture=await webFixture(mod.WebSession),root=path.resolve('worker/site-assets');
globalThis.fetch=async(u,o)=>{if(String(u).includes('firebaseio.com/'))return db.handle(u,o);if(String(u)==='https://oauth.telegram.org/.well-known/jwks.json')return Response.json({keys:[fixture.key]});throw Error('Blocked external request: '+u);};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff':'font/woff','.png':'image/png','.webp':'image/webp','.json':'application/json'};
const env={BOT_TOKEN:'123:fixture',FIREBASE_DB_SECRET:'SECRET',WEB_ORIGIN:'https://lunar.test',WEB_LOGIN_ENABLED:'1',SESSIONS:fixture.SESSIONS,ASSETS:{async fetch(req){let p=new URL(req.url).pathname;if(p.endsWith('/'))p+='index.html';const f=path.resolve(root,'.'+p);if(!f.startsWith(root+'/')||!fs.existsSync(f)||!fs.statSync(f).isFile())return new Response('not found',{status:404});return new Response(fs.readFileSync(f),{headers:{'Content-Type':types[path.extname(f)]||'application/octet-stream'}});}}};env.ROOM=makeNamespace(mod.PvpRoom,env);env.LOBBY=makeNamespace(mod.PvpLobby,env);
const server=http.createServer(async(req,res)=>{try{
 let body='';for await(const p of req)body+=p;
 if(req.url==='/__token'){const b=JSON.parse(body);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id_token:await fixture.token(b.nonce,b.id)}));return;}
 if(req.url==='/__dump'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(db.root));return;}
 const r=await mod.default.fetch(new Request(env.WEB_ORIGIN+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body}),env);
 const headers=Object.fromEntries(r.headers);const cookies=r.headers.getSetCookie();if(cookies.length)headers['set-cookie']=cookies;res.writeHead(r.status,headers);res.end(Buffer.from(await r.arrayBuffer()));
 }catch(e){res.writeHead(500);res.end(String(e.stack));}});server.listen(8791,'127.0.0.1',()=>console.log('Isolated website fixture on 8791'));
