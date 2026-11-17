// Session 6B: Science Lab research through the real Worker HTTP routes (fake Firebase with ETags): a job started with research-start
// spends parts only, runs on the Worker clock, and its mod reaches the account record (eco S.rm) exactly once through the Conquest
// outbox; the garage then fits it (lab_save) and power follows; the premium Lunar Pass on the account gives -25% time and a second
// slot; bonus parts on the account (eco S.bpt) are spent after earned ones; a client can never write S.rm, S.lsm, S.bpt or S.rsx.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({pruneEmptyUnder:['conquest']});
globalThis.fetch=async(url,init={})=>{const u=String(url);if(!u.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))throw Error('Unexpected external request '+u);return db.handle(url,init);};
const {default:worker}=await import('../../../worker/src/index.js');
const {RULES:R,CONQUEST:{Combat:C}}=await import('../../../worker/src/sim.gen.js');
const env={BOT_TOKEN:'conquest-research-test',FIREBASE_DB_SECRET:'SECRET'};
let now=Date.UTC(2026,10,17,10,0,0);Date.now=()=>now;
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:7,initData:auth(id),...body})}),env);const text=await r.text();return {status:r.status,...(text.startsWith('{')?JSON.parse(text):{text})};}
const eco=id=>db.get('eco/tg_'+id),cq=id=>db.get('conquest/tg_'+id),putCq=(id,v)=>{db.root.conquest['tg_'+id]=JSON.parse(JSON.stringify(v));},putEco=(id,v)=>{db.root.eco['tg_'+id]=JSON.parse(JSON.stringify(v));};
let passed=0;const ok=(cond,msg)=>{assert(cond,msg);passed++;console.log('PASS '+msg);};
const MIN=60000;
// a pilot with a town (CC cc) and a Science Lab at level lv, standing at the Command Gate, with research parts
async function pilot(id,cc,lv,pt){await call(id,'/api/sync',{lab:1});let r=await call(id,'/api/conquest/session');assert.equal(r.status,200,JSON.stringify(r.error));
 const s=cq(id),D=C.baseDefinition;s.ledger.cp=5e6;s.ledger.banked={alloy:1e5,biomass:1e5,helium:1e5};s.position={x:D.x,z:D.z,y:0,surface:'ground'};s.battle.enemies=[];putCq(id,s);now+=1000;
 r=await call(id,'/api/conquest/action',{seq:cq(id).seq+1,action:'build-base'});assert.equal(r.status,200,JSON.stringify(r.error));
 const q=cq(id);q.plot.cc=cc;q.plot.b.lab1={t:'lab',i:31,j:43,r:0,l:lv};q.inv=q.inv||{};q.inv.pt={thermal:0,coil:0,servo:0,cap:0,...pt};putCq(id,q);now+=1000;return cq(id);}

// ---- a Thermal I job end to end: parts -> job -> Worker clock -> the account record -> the garage fits it -> power rises ----
const P=9401;let s=await pilot(P,5,1,{thermal:5});const cp0=s.ledger.cp,b0=JSON.stringify(s.ledger.banked);
let r=await call(P,'/api/conquest/action',{seq:s.seq+1,action:'research-start',mod:'vent'});ok(r.status===200&&r.state.rs.jobs[0].mod==='vent',JSON.stringify(r.error||'research-start: Vent Barrel running'));
ok(r.state.ledger.cp===cp0&&JSON.stringify(r.state.ledger.banked)===b0&&r.state.inv.pt.thermal===5-R.RTREE.cost[0],'only research parts were spent (CP and banked materials unchanged)');
ok(!eco(P).rm||!eco(P).rm.vent,'not on the account before the job finishes');
now+=21*MIN;r=await call(P,'/api/conquest/session');ok(r.status===200&&r.state.rs.done.vent,'20 minutes later the session open finishes the job (Worker clock)');
ok(eco(P).rm&&eco(P).rm.vent===1,'the account record now holds Vent Barrel (credited from the outbox)');
ok((cq(P).airdrop.out||[]).every(e=>!e.rm),'the outbox entry was acknowledged and dropped');
const pts0=eco(P).pts,daily0=eco(P).dailyPts;now+=1000;r=await call(P,'/api/conquest/session');ok(eco(P).pts===pts0&&eco(P).dailyPts===daily0,'research pays no airdrop points');
// the garage: fit it on the active bay (server-validated lab_save) and the power follows
r=await call(P,'/api/act',{a:'lab_read'});const E=r.E,lab=E.lab,id=lab.active,M=lab.machines[id],pw0=eco(P).pw;
r=await call(P,'/api/act',{a:'lab_save',id,rev:lab.rev,name:M.name,spec:{...M.spec,mods:{...M.spec.mods,mount:'vent'},catalog:R.FIT_VERSION}});
ok(r.status===200&&!r.out?.err&&eco(P).lab.machines[id].spec.mods.mount==='vent',JSON.stringify(r.out||r.error)+' -> the garage fits the researched Vent Barrel');
ok(eco(P).pw>pw0,'gear rating follows the fitted mod: power '+pw0+' -> '+eco(P).pw+' (league and matchmaking read it)');
r=await call(P,'/api/act',{a:'lab_save',id,rev:eco(P).lab.rev,name:M.name,spec:{...eco(P).lab.machines[id].spec,mods:{mount:'overclock'},catalog:R.FIT_VERSION}});
ok(r.out?.err==='owned','the garage refuses a mod that was never researched (owned)');

// ---- a client can never write research ownership, bonus parts or finish credits ----
{const before=JSON.stringify([eco(P).rm,eco(P).lsm,eco(P).bpt,eco(P).rsx]);for(const body of [{rm:{rail:1},lsm:{sunfire:1},bpt:{thermal:99},rsx:{j9:1}}]){await call(P,'/api/sync',body);}
 ok(JSON.stringify([eco(P).rm,eco(P).lsm,eco(P).bpt,eco(P).rsx])===before,'a sync from the phone cannot add researched mods, Legendary set mods, bonus parts or finish credits');}

// ---- the premium Lunar Pass on the account: -25% time and an extra slot; bonus parts after earned ones ----
const Q=9402;s=await pilot(Q,5,1,{thermal:1,coil:5});{const e=eco(Q);const season=R.ecoSeason({day:Math.floor(now/86400000)});e.pass={s:season,xp:0,prem:true,cf:[],cp:[]};e.bpt={thermal:4,coil:0,servo:0,cap:0};putEco(Q,e);}
r=await call(Q,'/api/conquest/action',{seq:cq(Q).seq+1,action:'research-start',mod:'vent'});ok(r.status===200&&r.state.rs.jobs[0].ms===(R.LAB_STORE_OPEN?15:20)*MIN,JSON.stringify(r.error||'premium pass: the Lab I job takes '+(R.LAB_STORE_OPEN?'15 minutes':'20 minutes while the Lab store is closed (its perks start with the store)')));
ok(r.state.rs.jobs[0].paid.e===1&&r.state.rs.jobs[0].paid.b===R.RTREE.cost[0]-1&&r.state.rs.bs.thermal===R.RTREE.cost[0]-1,'earned Thermal Core first, then bonus parts from the account');
r=await call(Q,'/api/conquest/action',{seq:cq(Q).seq+1,action:'research-start',mod:'pierce'});ok(R.LAB_STORE_OPEN?r.status===200&&r.state.rs.jobs.length===2:r.status!==200,JSON.stringify(R.LAB_STORE_OPEN?r.error||'premium pass: a second slot at Science Lab I':'premium pass: no second slot while the Lab store is closed'));
ok(R.passResearch(true,true)&&!R.passResearch(true,false)&&!R.passResearch(false,true)&&R.rsSlots(1,R.passResearch(true,true))===2&&R.rsQuote({done:{},jobs:[]},'vent',1,R.passResearch(true,true)).ms===15*MIN,'when the Lab store opens: the premium pass gives a second slot and 15-minute Lab I jobs');
r=await call(Q,'/api/conquest/action',{seq:cq(Q).seq+1,action:'research-start',mod:'marksman'});ok(r.status===409&&/slot/.test(r.error),'no third slot below Lab III ('+r.error+')');
// pass gone (a new season): one slot again, full time
{const e=eco(Q);e.pass={s:e.pass.s+1,xp:0,prem:false,cf:[],cp:[]};putEco(Q,e);}now+=(R.LAB_STORE_OPEN?16:21)*MIN;   // the premium job (15 min with the store open, 20 while closed) is overr=await call(Q,'/api/conquest/session');
r=await call(Q,'/api/conquest/action',{seq:cq(Q).seq+1,action:'research-start',mod:'marksman'});ok(r.status===200&&r.state.rs.jobs.find(j=>j.mod==='marksman').ms===20*MIN,JSON.stringify(r.error||'without the pass: the full 20 minutes'));
// the field must be a research mod id
r=await call(Q,'/api/conquest/action',{seq:cq(Q).seq+1,action:'research-start',mod:'__proto__'});ok(r.status===409,'unknown mod ids are refused ('+r.error+')');
r=await call(Q,'/api/conquest/action',{seq:cq(Q).seq+1,action:'research-start',mod:'sunfire'});ok(r.status===409,'a Legendary set mod cannot be researched ('+r.error+')');

console.log('PASS wtest/conquest-research ('+passed+' checks)');
