// Local-only browser harness: real Worker/auth/CAS/reducer, disposable Firebase emulator.
import http from 'node:http';import {readFileSync} from 'node:fs';import {createHmac} from 'node:crypto';import {makeDB} from './wtest/fakedb.mjs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const db=makeDB(),env={BOT_TOKEN:'conquest-browser-only',FIREBASE_DB_SECRET:'SECRET'},pid='tg_8301';
globalThis.fetch=async(u,i)=>{if(String(u).includes('warmachines-a6034-default-rtdb.firebaseio.com'))return db.handle(u,i);throw Error('test harness external fetch blocked');};
const {default:worker}=await import('../../worker/src/index.js');const {createState}=await import('../../worker/src/conquest-sim.js');const {CONQUEST:C,RULES:R}=await import('../../worker/src/sim.gen.js');
// Optional continuation of the *earned* reducer journey in this disposable local DB.
// Align only the test server clock; no production route accepts time/state overrides.
if(process.env.CQ_EARNED_SAVE){const earned=JSON.parse(readFileSync(process.env.CQ_EARNED_SAVE,'utf8')),saved=earned.final;if(!saved?.base?.tier||!saved.base.modules.reactor)throw Error('earned journey must finish first');const realNow=Date.now,offset=saved.lastWall-realNow();Date.now=()=>realNow()+offset;db.root.conquest={[pid]:saved};}
const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:8301,first_name:'BrowserPilot'})});const data=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(data).digest('hex'));const initData=p.toString();
await worker.fetch(new Request('https://test/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:4,initData})}),env);
const measurements=[];
const server=http.createServer(async(req,res)=>{try{let raw='';for await(const chunk of req)raw+=chunk;const b=raw?JSON.parse(raw):{};if(req.url==='/fixture'){
 const loadout=structuredClone(R.STOCK_L);if(b.weapon==='moon')loadout.w={a:'moon',t:0,q:0,s:1};if(b.veteranLoadout){loadout.w={a:'moon',t:2,q:1,s:false};loadout.c={c:'titan',t:2,q:1,s:false};}const s=createState(loadout,Date.now()),point=(x,z)=>({x,z,y:C.World.groundAt(x,z),surface:'ground'});if(b.position)s.position=point(...b.position);
 s.battle=JSON.parse(JSON.stringify(new C.Combat.Encounter(s.loadout,s.position)));if(b.hp){s.hp=s.battle.playerHp=b.hp;}
 if(b.superReady)s.battle.charge=1000;if(b.engineering){s.ledger.cp=1000;s.ledger.banked={alloy:100,biomass:100,helium:10};s.battle.enemies=[];}if(b.baseFunds){s.ledger.cp=100000;s.ledger.banked={alloy:10000,biomass:10000,helium:10000};s.battle.enemies=[];}if(b.cargo)s.ledger.cargo=b.cargo;db.root.conquest=db.root.conquest||{};db.root.conquest[pid]=s;res.end(JSON.stringify({ok:true}));return;
 }if(req.url==='/inspect'){res.end(JSON.stringify({state:db.get('conquest/'+pid),measurements}));return;}
 const t=performance.now(),r=await worker.fetch(new Request('https://test'+req.url,{method:'POST',headers:{'Content-Type':'application/json'},body:raw}),env);const text=await r.text();measurements.push({path:req.url,ms:performance.now()-t,bytes:Buffer.byteLength(text),status:r.status});if(measurements.length>1000)measurements.shift();res.writeHead(r.status,{'Content-Type':'application/json'});res.end(text);
 }catch(e){res.writeHead(500);res.end(JSON.stringify({error:String(e.stack)}));}});
server.listen(0,'127.0.0.1',()=>process.stdout.write(JSON.stringify({port:server.address().port,initData})+'\n'));
