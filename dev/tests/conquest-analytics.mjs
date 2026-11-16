// Session 6 analytics (owner Decision 11a; spec §11): anonymous Firebase counters an/<day>/<event>[/<key>] and cohorts
// an/cohort/<firstDay>/{n,d1,d7,d30} through the real Worker (fake Firebase): entry, mission start/end, bank, death, town claim,
// build, gather, the phone's screen events; counted only after the state's CAS write; refused requests count nothing; the request
// queue never reaches the stored state; NO personal data anywhere under an/ (no pid, name, Telegram id or time); client events are
// fixed enums and rate-limited.
import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {makeDB} from './wtest/fakedb.mjs';import {buildSim} from '../../worker/build-sim.mjs';
buildSim();const db=makeDB({pruneEmptyUnder:['conquest']});
globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))return db.handle(url,init);throw Error('Unexpected external request');};
const {default:worker}=await import('../../worker/src/index.js');const {CONQUEST:{Combat:C,World:W,Plot:PL},RULES:R}=await import('../../worker/src/sim.gen.js');
const AN=await import('../../worker/src/conquest-analytics.js');
const env={BOT_TOKEN:'conquest-analytics-test',FIREBASE_DB_SECRET:'SECRET'};let now=Date.UTC(2026,10,16,12);Date.now=()=>now;const DAY=86400000,day=()=>Math.floor(now/DAY);
function auth(id){const u={id,first_name:'Pilot'+id,username:'pilot'+id};const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify(u)});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:R.PVP_V,initData:auth(id),...body})}),env);const t=await r.text();return {status:r.status,...(t.startsWith('{')?JSON.parse(t):{error:t})};}
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const an=()=>db.root.an||{},today=()=>an()[day()]||{};
// ---- 1. pure parts: buckets, enums, the queue ----
ok(AN.minuteBucket(0)==='lt1m'&&AN.minuteBucket(4)==='3-5m'&&AN.minuteBucket(75)==='60mp'&&AN.claimBucket(12)==='10-15m'&&AN.secondsBucket(130)==='120-180s','buckets');
{const s={};AN.track(s,'bank');AN.track(s,'mission_end','recon','victory');AN.track(s,'nope');AN.track(s,'build','Pilot Name');AN.track(s,'gather','user@mail');for(let i=0;i<40;i++)AN.track(s,'bank');
 ok(s.anq.length===24&&s.anq[0][0]==='bank'&&s.anq[1].join('/')==='mission_end/recon/victory'&&!s.anq.some(x=>x.includes('pilot name')||x.join().includes('@')),'only known events with safe keys (no free text), at most 24 a request');
 const q=AN.takeQueue(s);ok(q.length===24&&!('anq' in s),'the queue leaves the state before the write');}
// ---- 2. through the Worker ----
const A=8301,B2=8302;
let r=await call(A,'/api/sync',{});r=await call(A,'/api/conquest/session',{});ok(r.status===200&&r.state&&!('anq' in r.state)&&!('lseed' in r.state),'session opens; the client sees no queue and no seed');
const first=day();ok(today().enter===1&&an().cohort?.[first]?.n===1,'a first entry counts enter and the day\'s cohort');
r=await call(A,'/api/conquest/session',{});ok(today().enter===1,'a reconnect inside a minute is not a new entry');
const stored=db.root.conquest['tg_'+A];ok(stored&&!('anq' in stored)&&stored.an?.f===first,'the stored record keeps only the pilot\'s own first day, never the queue');
// a mission: start, then retreat -> mission_start / mission_end retreated
let seq=r.state.seq;r=await call(A,'/api/conquest/action',{seq:++seq,action:'start-mission',mission:'oxygen-line'});ok(r.status===200&&today().mission_start?.['oxygen-line']===1,'mission_start/oxygen-line');
r=await call(A,'/api/conquest/action',{seq:++seq,action:'return-exploration'});ok(today().mission_end?.['oxygen-line']?.retreated===1,'mission_end/oxygen-line/retreated (once per attempt)');
// a refused request counts nothing
const before=JSON.stringify(an());r=await call(A,'/api/conquest/action',{seq:++seq,action:'bank'});ok(r.status!==200&&JSON.stringify(an())===before,'a refused request (bank away from the terminal) counts nothing');seq--;
// bank at the terminal with cargo, and a death with cargo, through the real reducers (scenario placement in the DB)
{const s=db.root.conquest['tg_'+A];s.position={x:1174,z:1168,y:W.groundAt(1174,1168),surface:'ground'};s.ledger.cargo={alloy:5,biomass:0,helium:0};}
r=await call(A,'/api/conquest/action',{seq:++seq,action:'bank'});ok(r.status===200&&today().bank===1,'bank (something banked)');
{const s=db.root.conquest['tg_'+A];s.hp=1;s.battle.playerHp=1;s.ledger.cargo={alloy:3,biomass:0,helium:0};s.position={x:1260,z:960,y:W.groundAt(1260,960),surface:'ground'};
 const foe=s.battle.enemies.find(e=>e.kind==='sentinel')||s.battle.enemies[0];Object.assign(foe,{x:1266,z:960,y:W.groundAt(1266,960),hp:foe.maxHp,cd:0,decision:0});s.battle.hitBy=foe.id;}
let died=false;for(let i=0;i<20&&!died;i++){now+=1000;r=await call(A,'/api/conquest/input',{seq:++seq,commands:Array(20).fill({x:0,z:0})});if(r.status!==200){seq--;continue;}died=r.state.hp<=0;}
ok(died&&Object.keys(today().death||{}).length===1&&JSON.stringify(today().death).includes('some'),'death by cause and carrying: '+JSON.stringify(today().death));
// the phone's screen events
for(const [e,k] of [['transmission_read'],['transmission_skip'],['quit_point','map:7'],['session_minutes','12']])r=await call(A,'/api/conquest/an',{e,...(k?{k}:{})});
ok(today().transmission_read===1&&today().transmission_skip===1&&today().quit_point?.map?.['5-10m']===1&&today().session_minutes?.['10-20m']===1,'screen events: radio read / skip, quit point by screen and minute bucket, session minutes');
for(const [e,k] of [['quit_point','<script>:1'],['session_minutes','-4'],['enter'],['mission_end','x'],['quit_point','map:99999']])r=await call(A,'/api/conquest/an',{e,...(k?{k}:{})});
assert.equal((await call(A,'/api/conquest/an',{e:'session_minutes',k:'3',pid:'tg_1'})).status,400);ok(JSON.stringify(today().quit_point)==='{"map":{"5-10m":1}}'&&today().enter===1,'invalid screen events and extra fields are refused; the phone cannot send outcome events');
for(let i=0;i<60;i++)await call(B2,'/api/conquest/an',{e:'transmission_read'});ok(today().transmission_read===1+40,'at most 40 screen events a pilot a UTC day');
// cohorts: D1, D7, D30 by the day the pilot comes back
for(const [dd,k] of [[1,'d1'],[7,'d7'],[30,'d30']]){now=Date.UTC(2026,10,16,12)+dd*DAY;await call(A,'/api/conquest/session',{});ok(an().cohort?.[first]?.[k]===1&&today().return?.[k]===1,k+': a return on day +'+dd+' counts once in the cohort and in that day\'s returns');}
now+=DAY;await call(A,'/api/conquest/session',{});ok(an().cohort[first].d30===1,'never twice');
// ---- 3. no personal data anywhere under an/ ----
{const bad=[];const walk=(o,p)=>{for(const [k,v] of Object.entries(o)){const path=p+'/'+k;if(!/^[a-z0-9_-]+$/i.test(k)||/8301|8302|tg_|pilot/i.test(k))bad.push(path);if(v&&typeof v==='object')walk(v,path);else if(typeof v!=='number')bad.push(path+'='+v);}};walk(an(),'an');
 ok(!bad.length,'under an/ only counters with enum / id / bucket keys: no pid, name, Telegram id or text ('+bad.slice(0,3).join(', ')+')');}
// ---- 4. the admin sheet reads it ----
{const d=await AN.analyticsDays(env,7,now);ok(Array.isArray(d.days)&&d.days.length===7&&d.cohorts.some(c=>c.day===first&&c.n===1&&c.d1===1&&c.d7===1&&c.d30===1),'the admin sheet\'s 7 days and cohorts');}
// ---- 5. town claim (play-minute bucket), build by type, gather by mineral: queued by the reducers ----
{const {createState,applyAction}=await import('../../worker/src/conquest-sim.js');const {harvestStep}=await import('../../worker/src/conquest-sim.js');const D=C.baseDefinition;
 const s=createState(R.STOCK_L,now);s.an={f:day(),d:{},p:13*60000};s.position={x:D.x,z:D.z,y:W.groundAt(D.x,D.z),surface:'ground'};s.battle.enemies=[];s.ledger.cp=1e5;s.ledger.banked={alloy:1e4,biomass:1e4,helium:1e4};
 const a=applyAction(s,{seq:1,action:'build-base',plot:{site:'ridge'}},now);ok(a.anq?.some(x=>x.join('/')==='claim_town/10-15m'),'claim_town by minutes of play (13 min -> 10-15m)');
 const pos=PL.autoPlace(a.plot,'refinery');a.plot.job=null;const b=applyAction(a,{seq:2,action:'plot-build',plot:{type:'refinery',...pos}},now+1000);ok(b.anq?.some(x=>x.join('/')==='build/refinery'),'build by type');}
console.log('conquest analytics: passed '+passed);
