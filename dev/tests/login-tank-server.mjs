// Test-only server for dev/tests/login-tank-browser.py: the real Worker (website sessions AND Telegram sign-in) on a disposable
// in-memory database, serving the website build (worker/site-assets). One account plays on the website and in the Telegram
// Mini App, so "the loadout changed on another device" is a real second sign-in changing the same server record.
// Never a production route. Run from the repository root: node dev/tests/login-tank-server.mjs
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createHmac} from 'node:crypto';
import {makeDB} from './wtest/fakedb.mjs';import {makeNamespace,installWebSocketPair} from './wtest/fakedo.mjs';import {buildSim} from '../../worker/build-sim.mjs';import {webFixture} from './web-fixture.mjs';
buildSim();installWebSocketPair();
const mod=await import('../../worker/src/index.js'),{RULES:R,CONQUEST:C}=await import('../../worker/src/sim.gen.js'),{createState}=await import('../../worker/src/conquest-sim.js');
const db=makeDB({pruneEmptyUnder:['conquest']}),fixture=await webFixture(mod.WebSession),root=path.resolve('worker/site-assets');
globalThis.fetch=async(u,o)=>{if(String(u).includes('firebaseio.com/'))return db.handle(u,o);if(String(u)==='https://oauth.telegram.org/.well-known/jwks.json')return Response.json({keys:[fixture.key]});if(String(u).startsWith('https://api.coingecko.com/'))return Response.json({'the-open-network':{usd:3},solana:{usd:150}});throw Error('Blocked external request: '+u);};
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.json':'application/json','.glb':'model/gltf-binary','.webmanifest':'application/manifest+json'};
const ORIGIN='https://lunar.test';
const env={BOT_TOKEN:'123:fixture',FIREBASE_DB_SECRET:'SECRET',WEB_ORIGIN:ORIGIN,WEB_LOGIN_ENABLED:'1',SESSIONS:fixture.SESSIONS,ASSETS:{async fetch(req){let p=new URL(req.url).pathname;if(p.endsWith('/'))p+='index.html';const f=path.resolve(root,'.'+p);if(!f.startsWith(root+'/')||!fs.existsSync(f)||!fs.statSync(f).isFile())return new Response('not found',{status:404});return new Response(fs.readFileSync(f),{headers:{'Content-Type':types[path.extname(f)]||'application/octet-stream'}});}}};
env.ROOM=makeNamespace(mod.PvpRoom,env);env.LOBBY=makeNamespace(mod.PvpLobby,env);
// Telegram's own signature over the launch data (the Worker verifies it with the bot token)
function initData(id){
 const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),query_id:'q',user:JSON.stringify({id,first_name:'Pilot',username:'pilot'+id})});
 const dcs=[...p.entries()].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');
 p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(dcs).digest('hex'));return p.toString();
}
const worker=(p,body)=>mod.default.fetch(new Request(ORIGIN+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env).then(r=>r.json());
const spec=(S,g)=>R.labSpec(R.ecoLoadout(S,{...R.STOCK_L,w:{a:g.w[0],t:g.w[1],s:false},c:{c:g.c[0],t:g.c[1],s:false},paint:g.paint||'stock'}));
const server=http.createServer(async(req,res)=>{try{
 let body='';for await(const p of req)body+=p;
 const send=o=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(o));};
 if(req.url==='/__token'){const b=JSON.parse(body);return send({id_token:await fixture.token(b.nonce,b.id)});}
 if(req.url==='/__initdata'){return send({initData:initData(JSON.parse(body).id)});}
 if(req.url==='/__dump'){return send(db.root);}
 // an account that owns every chassis and weapon, its first bay fitted with `a` ({w:[arch,tier], c:[class,tier]})
 if(req.url==='/__seed'){const b=JSON.parse(body),pid='tg_'+b.id;
  const S=R.ecoNorm({mig:1,wOwn:{pulse:[0,1,2],twin:[0,1,2],siege:[0,1,2]},cOwn:{scout:[0,1,2],vanguard:[0,1,2],titan:[0,1,2]},mp:5,paints:{stock:1,crimson:1}});R.labEnsure(S);
  S.lab.machines.m_legacy.spec=spec(S,b.a);S.lab.machines.m_spare.spec=spec(S,b.spare||b.a);S.L=R.labLoadout(S);S.rev=1;
  db.root.eco=db.root.eco||{};db.root.eco[pid]=S;return send({ok:true,L:S.L});}
 // "another device": the same pilot signs in elsewhere and saves a different tank into the active bay, through the Worker's own action
 if(req.url==='/__other-device'){const b=JSON.parse(body),pid='tg_'+b.id,S=db.root.eco[pid],M=S.lab.machines[S.lab.active];
  const r=await worker('/api/act',{gv:R.PVP_V,initData:initData(b.id),a:'lab_save',id:S.lab.active,rev:S.lab.rev,name:M.name,spec:spec(S,b.to)});
  return send({ok:!!(r.out&&r.out.ok),out:r.out||r,rev:db.root.eco[pid].rev,L:db.root.eco[pid].L});}
 // Conquest: the pilot already has a town (Command Center level cc), parked at the base gate, with the tank the account fields
 if(req.url==='/__conquest'){const b=JSON.parse(body),pid='tg_'+b.id,S=db.root.eco[pid],now=Date.now(),cc=Math.max(1,Math.min(10,b.cc|0||3));
  const s=createState(structuredClone(R.labLoadout(S)),now),D=C.Combat.baseDefinition;
  s.base={tier:Math.ceil(cc/2),modules:{},builtAt:now-9e8,claimedAt:now-3e7,pointsAt:now-3e7};const q=C.Plot.newPlot('ridge',now);q.cc=cc;q.b.cc.l=cc;q.siteFree=1;s.plot=q;
  s.position={x:D.x,z:D.z,y:C.World.groundAt(D.x,D.z),surface:'ground'};s.battle=JSON.parse(JSON.stringify(new C.Combat.Encounter(s.loadout,s.position)));s.battle.enemies=[];
  s.ledger.cp=100000;s.completed=Object.fromEntries(C.Combat.fieldMissionIds.map(id=>[id,{at:now,attempt:0}]));
  db.root.conquest=db.root.conquest||{};db.root.conquest[pid]=s;if(db.root.cqc)delete db.root.cqc[pid];return send({ok:true});}
 const r=await mod.default.fetch(new Request(ORIGIN+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:body}),env);
 const headers=Object.fromEntries(r.headers);const cookies=r.headers.getSetCookie();if(cookies.length)headers['set-cookie']=cookies;res.writeHead(r.status,headers);res.end(Buffer.from(await r.arrayBuffer()));
 }catch(e){res.writeHead(500);res.end(String(e.stack));}});
server.listen(Number(process.env.LUNAR_FIXTURE_PORT)||8793,'127.0.0.1',()=>console.log('login-tank fixture ready'));
