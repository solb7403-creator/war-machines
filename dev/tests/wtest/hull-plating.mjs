// Hull Plating and minerals through the real Worker (fake Firebase with ETags): fabrication from the owned wallet and
// spendable points (exact costs, upgrade-only, no refund), gear rating and league follow the plates, PvP rebuilds plates
// from the owned record (a client cannot claim them), Arcade/PvP mineral drops on verified results (quits get none) and the
// weekly league minerals at the 20th verified match. Shared rules: HP per plate, set traits by damage type (Moonbeam exempt),
// power equal to the approved model. docs/economy/RESOURCE_ECONOMY.md §5.5, §6
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB();
globalThis.fetch=async(url,init={})=>{const u=String(url);if(!u.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))throw Error('Unexpected external request '+u);return db.handle(url,init);};
const {default:worker}=await import('../../../worker/src/index.js');
const {creditMatch}=await import('../../../worker/src/eco.js');
const {checkLoadout}=await import('../../../worker/src/pvp.js');
const {RULES:R,createSim}=await import('../../../worker/src/sim.gen.js');
const env={BOT_TOKEN:'hull-plating-test',FIREBASE_DB_SECRET:'SECRET'};
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:4,initData:auth(id),...body})}),env);const t=await r.text();return {status:r.status,...(t.startsWith('{')?JSON.parse(t):{error:t})};}
const eco=id=>db.get('eco/tg_'+id);
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};

// ---- shared rules: HP per plate, set traits, power equals the approved model (§6.3 stock column) ----
const p0=R.powerOf(R.STOCK_L),gains=[1,2,3,4,5,6].map(t=>Math.round((R.powerOf({...R.STOCK_L,ap:[t,t,t,t]})/p0-1)*1000)/10);
ok(JSON.stringify(gains)===JSON.stringify([1.5,2.9,4.4,5.9,8.8,10.3]),'full-set gear rating gains, stock kit: '+gains.join(' / ')+'% (approved table)');
const hp0=R.tankOf(R.STOCK_L,1).mhp;
ok(R.tankOf({...R.STOCK_L,ap:[1,0,0,0]},1).mhp===Math.round(hp0*1.01)&&R.tankOf({...R.STOCK_L,ap:[6,6,6,6]},1).mhp===Math.round(hp0*1.16),'one Ferrite plate +1% hull; a Moonheart set +16%');
const T5=R.tankOf({...R.STOCK_L,ap:[5,5,5,6]},1),T6=R.tankOf({...R.STOCK_L,ap:[6,6,6,6]},1),T4=R.tankOf({...R.STOCK_L,ap:[6,6,6,4]},1);
ok(T5.enR===0.1&&!T5.arR&&T6.enR===0.1&&T6.arR===0.1&&!T4.enR,'set traits need all four plates at the tier: Selenite -10% energy, Moonheart adds -10% area, a mixed set none');
ok(R.ecoLoadout(R.ecoNorm({ap:[2,1,0,3]}),{ap:[6,6,6,6]}).ap.join()==='2,1,0,3','the loadout takes plates from the owned record, never from the client');

// ---- traits by damage type in the shared Arcade/PvP sim (Moonbeam exempt) ----
{const host={ev(){},end(){},round(){},death(){}},S=createSim(host);
 const cut=S.plateCutOf||null;   // exposed for tests by worker/sim-api.js
 assert(cut,'sim exposes plateCut');
 const r={enR:0.1,arR:0.1},src=w=>({wtype:w});
 const rows=[['Pulse Cannon shot',cut(r,src('pulse'),null,0),0.9],['Twin Repeater shot',cut(r,src('twin'),null,0),1],['Siege Breaker shot',cut(r,src('siege'),null,0),1],['Moonbeam shot',cut(r,src('moon'),null,0),1],
  ['Pierce Lance',cut(r,src('pulse'),null,1),0.9],['Static Nova',cut(r,src('twin'),null,1),0.81],['Siege Blast',cut(r,src('siege'),null,1),0.9],['Moonfall',cut(r,src('moon'),null,1),1],
  ['meteor',cut(r,null,'meteor',3),0.9],['megatank stomp',cut(r,src('siege'),'stomp',1),0.9],['storm',cut(r,null,'storm',2),1]];
 for(const [n,v,want] of rows)assert(Math.abs(v-want)<1e-9,n+' '+v+' want '+want);
 ok(true,'damage types: '+rows.map(([n,v])=>n+' x'+Math.round(v*100)/100).join(', '));}

// ---- fabrication through /api/act: exact costs, upgrade-only, power and league follow ----
const P=9301;await call(P,'/api/sync');
let r=await call(P,'/api/act',{a:'plate',k:0,t:1});ok(r.out?.err==='mn'&&r.out.k==='fe'&&r.out.need===40,'no Ferrite: refused, nothing changes (needs 40)');
db.root.eco['tg_'+P].mn={fe:45,il:0,ar:0,tq:0,se:0,mh:0};db.root.eco['tg_'+P].pts=200;
r=await call(P,'/api/act',{a:'plate',k:0,t:1});ok(r.out?.err==='pts'&&r.out.need===100&&eco(P).mn.fe===45,'45 Ferrite but 200 points: refused for points (needs 100 more), wallet untouched');
db.root.eco['tg_'+P].pts=1000;const pw0=eco(P).pw;
r=await call(P,'/api/act',{a:'plate',k:0,t:1});
ok(r.out?.tier===1&&eco(P).ap[0]===1&&eco(P).mn.fe===5&&eco(P).pts===700&&r.E.ap[0]===1&&r.E.mn.fe===5,'FRONT Ferrite plate: 40 Ferrite + 300 points; the phone gets the wallet and plates back');
ok(eco(P).L.ap[0]===1&&eco(P).pw===R.powerOf(eco(P).L)&&R.tankOf(eco(P).L,1).mhp>R.tankOf({...eco(P).L,ap:[0,0,0,0]},1).mhp,'gear rating is recomputed at once from the plated canonical loadout ('+pw0+' -> '+eco(P).pw+'; +1% hull rounds inside one rating point)');
r=await call(P,'/api/act',{a:'plate',k:0,t:1});ok(r.out?.err==='have','the same plate again is refused (upgrade only)');
r=await call(P,'/api/act',{a:'plate',k:7,t:1});ok(r.status===400,'an invalid slot is rejected');
db.root.eco['tg_'+P].mn={fe:20,il:40,ar:0,tq:0,se:0,mh:0};db.root.eco['tg_'+P].pts=2000;
r=await call(P,'/api/act',{a:'plate',k:0,t:2});ok(r.out?.tier===2&&eco(P).mn.fe===0&&eco(P).mn.il===0&&eco(P).pts===500&&eco(P).ap[0]===2,'Ilmenite over Ferrite: 40 Ilmenite + 20 Ferrite + 1,500; the old plate is absorbed (no refund)');
db.root.eco['tg_'+P].ap=[6,6,6,5];db.root.eco['tg_'+P].mn={fe:0,il:0,ar:0,tq:0,se:0,mh:3};db.root.eco['tg_'+P].mn.se=4;db.root.eco['tg_'+P].pts=30000;const lg0=eco(P).lgi,pw1=R.powerOf({...eco(P).L,ap:[6,6,6,5]});
r=await call(P,'/api/act',{a:'plate',k:3,t:6});ok(r.out?.set===6&&eco(P).pw>pw1&&eco(P).pw===R.powerOf(eco(P).L)&&eco(P).lgi>=lg0,'completing a Moonheart set: gear rating '+pw1+' -> '+eco(P).pw+', league recomputed from it');

// ---- PvP rebuilds plates from the owned record ----
const own=eco(P).ap.join();db.root.eco['tg_'+P].ap=[2,0,0,0];const L2=await checkLoadout(env,R,{w:{a:'pulse',t:0},c:{c:'vanguard',t:0},ap:[6,6,6,6]},eco(P));
ok(own==='6,6,6,6'&&L2.ap.join()==='2,0,0,0','PvP loadout: plates from the record (2,0,0,0), a claimed Moonheart set is ignored');

// ---- Arcade/PvP drops: verified results only; weekly league minerals at the 20th match ----
const D=9302;await call(D,'/api/sync');const rnd=v=>()=>v;
{const S=R.ecoNorm({}),X={day:20000,week:2857,rnd:rnd(0)};const w=R.ecoMatchMinerals(S,{won:true},0,X);
 ok(w.drop.fe===2&&w.drop.il===1&&w.drop.ar===1,'a win with every roll hitting: 2 Ferrite + 1 Ilmenite + 1 Armalcolite');
 const X1={...X,rnd:rnd(0.99)},S1=R.ecoNorm({});ok(JSON.stringify(R.ecoMatchMinerals(S1,{won:true},0,X1).drop)==='{"fe":1}'&&JSON.stringify(R.ecoMatchMinerals(S1,{drawn:true},0,X1).drop)==='{"fe":1}'&&JSON.stringify(R.ecoMatchMinerals(S1,{},0,X1).drop)==='{}','no lucky rolls: win 1 Ferrite, draw 1 Ferrite, loss nothing');
 const S2=R.ecoNorm({});let weekly=null;for(let i=0;i<20;i++){const m=R.ecoMatchMinerals(S2,{},2,{...X,rnd:rnd(0.99)});if(m.weekly)weekly={i,...m.weekly};}
 ok(weekly&&weekly.i===19&&weekly.fe===40&&weekly.il===10&&weekly.ar===2&&!weekly.tq,'Veteran: the 20th verified match of the week pays 40 Ferrite + 10 Ilmenite + 2 Armalcolite (25% Tranquillityite missed)');
 const again=R.ecoMatchMinerals(S2,{},2,{...X,rnd:rnd(0)});ok(!again.weekly,'once a week only');
 const next=R.ecoNorm(JSON.parse(JSON.stringify(S2)));for(let i=0;i<19;i++)R.ecoMatchMinerals(next,{},2,{...X,week:X.week+1,rnd:rnd(0.99)});ok(next.mnw.n===19&&!next.mnw.p&&next.mnw.w===X.week+1,'a new UTC week starts counting again');}
const before=structuredClone(eco(D).mn||{});
const live=await creditMatch(env,'tg_'+D,'Pilot',()=>({pts:100,base:100,won:true,m:{won:true,secs:120,st:{}}}));
ok(live.mn&&live.mn.drop.fe>=1&&eco(D).mn.fe-(before.fe||0)===live.mn.drop.fe,'live PvP win: the drop lands in the wallet in the same credit (+'+live.mn.drop.fe+' Ferrite)');
const q0=structuredClone(eco(D).mn);const quit=await creditMatch(env,'tg_'+D,'Pilot',()=>({pts:0,base:0,m:{quit:true}}));
ok(!quit.mn&&JSON.stringify(eco(D).mn)===JSON.stringify(q0),'a quit drops nothing');

// ---- Conquest minerals reach the wallet exactly once (banked at the Refuge, through the outbox) ----
{const B=9303;await call(B,'/api/sync');let r=await call(B,'/api/conquest/session');assert.equal(r.status,200,JSON.stringify(r.error));
 const s=db.get('conquest/tg_'+B);s.position={x:1174,z:1170,y:0,surface:'ground'};s.ledger.mn={fe:38,il:2};const w0=R.mnOf(eco(B).mn);
 r=await call(B,'/api/conquest/action',{seq:s.seq+1,action:'bank'});assert.equal(r.status,200,JSON.stringify(r.error));
 const w1=eco(B).mn,c=db.get('conquest/tg_'+B);
 ok(w1.fe-w0.fe===38&&w1.il-w0.il===2&&JSON.stringify(c.ledger.mn||{})==='{}'&&(c.airdrop.out||[]).length===0,'banking 38 Ferrite + 2 Ilmenite at the Refuge credits the account wallet at once; the outbox entry is acknowledged');
 ok(r.state.airdrop.view.mn.fe===w1.fe&&r.state.airdrop.credit?.minerals?.fe===38,'the response carries the wallet for the HUD and garage');
 const again=await call(B,'/api/conquest/action',{seq:s.seq+1,action:'bank'});ok(again.replayed&&eco(B).mn.fe===w1.fe,'a resent bank request is replayed without a second credit');}

console.log(`hull plating (worker): passed ${passed}`);
