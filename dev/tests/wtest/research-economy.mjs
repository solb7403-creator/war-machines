// Session 6B finish (owner decisions, Nov 17 2026): the research economy and the Legendary set mods' free research path, through the
// REAL Worker HTTP routes (fake Firebase with ETags). Fails if any of these rules breaks:
//  1. the tree costs 2 / 4 / 5 / 9 parts of a track's part (20 a track, 80 in all)
//  2. one EARNED research part a day per account: a second part found the same UTC day becomes 1 fragment of its source's pool
//     (elite: uncommon; raid commander, Meteor Strike: rare), and the count starts again at 00:00 UTC
//  3. parts from packs and the Lunar Pass (the account's bonus parts, eco S.bpt) are never limited
//  4. a Legendary set mod can be researched (30 of its track's part, 8 h) only at Science Lab III and only after its track's set mod;
//     it can be bought only after that set mod (never opened by Lab III alone); a Legendary researched or being researched cannot be
//     bought, one bought cannot be researched, a refund removes only a bought one: researched and bought never double
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({pruneEmptyUnder:['conquest']});
globalThis.fetch=async(url,init={})=>{const u=String(url);if(!u.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))throw Error('Unexpected external request '+u);return db.handle(url,init);};
const {default:worker}=await import('../../../worker/src/index.js');
const {RULES:R,CONQUEST:{Combat:C}}=await import('../../../worker/src/sim.gen.js');
const env={BOT_TOKEN:'research-economy-test',FIREBASE_DB_SECRET:'SECRET'};
const DAY=864e5,HOUR=36e5,MIN=6e4;
let now=Date.UTC(2026,10,18,9,0,0);Date.now=()=>now;
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:7,initData:auth(id),...body})}),env);const text=await r.text();return {status:r.status,...(text.startsWith('{')?JSON.parse(text):{text})};}
const eco=id=>db.get('eco/tg_'+id),cq=id=>db.get('conquest/tg_'+id),putCq=(id,v)=>{db.root.conquest['tg_'+id]=JSON.parse(JSON.stringify(v));},putEco=(id,v)=>{db.root.eco['tg_'+id]=JSON.parse(JSON.stringify(v));};
let passed=0;const ok=(cond,msg)=>{assert(cond,msg);passed++;console.log('PASS '+msg);};
const act=(id,action,extra={})=>call(id,'/api/conquest/action',{seq:cq(id).seq+1,action,...extra});
// a pilot with a town (CC cc) and a Science Lab at level lv, standing at the Command Gate, with earned research parts
async function pilot(id,cc,lv,pt){await call(id,'/api/sync',{lab:1});let r=await call(id,'/api/conquest/session');assert.equal(r.status,200,JSON.stringify(r.error));
 const s=cq(id),D=C.baseDefinition;s.ledger.cp=5e6;s.ledger.banked={alloy:1e5,biomass:1e5,helium:1e5};s.position={x:D.x,z:D.z,y:0,surface:'ground'};s.battle.enemies=[];putCq(id,s);now+=1000;
 r=await call(id,'/api/conquest/action',{seq:cq(id).seq+1,action:'build-base'});assert.equal(r.status,200,JSON.stringify(r.error));
 const q=cq(id);q.plot.cc=cc;q.plot.b.lab1={t:'lab',i:31,j:43,r:0,l:lv};q.inv=q.inv||{};q.inv.pt={thermal:0,coil:0,servo:0,cap:0,...pt};putCq(id,q);now+=1000;return cq(id);}
const done=(id,mods)=>{const q=cq(id);q.rs=q.rs||{};q.rs.done={...(q.rs.done||{}),...Object.fromEntries(mods.map(m=>[m,now]))};q.rs.seen={...(q.rs.seen||{}),...Object.fromEntries(mods.map(m=>[m,1]))};putCq(id,q);const e=eco(id);e.rm={...(e.rm||{}),...Object.fromEntries(mods.map(m=>[m,1]))};putEco(id,e);};
const finishAll=async id=>{now+=9*HOUR;const r=await call(id,'/api/conquest/session');assert.equal(r.status,200);return r;};
// a part on the ground where the pilot stands, picked up by the next input batch (the real pickup path: bind)
async function find(id,part,src){const s=cq(id);s.drops=s.drops||[];s.drops.push({id:'test:'+Math.random(),x:s.position.x,y:s.position.y||0,z:s.position.z,amount:{cp:0,alloy:0,biomass:0,helium:0},expires:now+5*MIN,loot:{pt:{[part]:1},src},r:2,label:'PART'});putCq(id,s);now+=100;
 const r=await call(id,'/api/conquest/input',{seq:cq(id).seq+1,commands:[{x:0,z:0}]});assert.equal(r.status,200,JSON.stringify(r.error));return cq(id);}

// ---- 1. the tree costs 2 / 4 / 5 / 9 (owner, Nov 17) ----
ok(JSON.stringify(R.RTREE.cost)==='[2,4,5,9]'&&R.RTREE.cost.reduce((a,b)=>a+b,0)===20&&Object.values(R.rsTreeCost()).reduce((a,b)=>a+b,0)===80,'research costs 2, 4, 5 and 9 parts: 20 a track, 80 in all');
{const P=9501;await pilot(P,5,3,{thermal:20});const want=[['vent',2],['overclock',4],['heatsink',5]];let t0=cq(P).inv.pt.thermal;
 for(const [m,n] of want){const r=await act(P,'research-start',{mod:m});ok(r.status===200&&t0-r.state.inv.pt.thermal===n,m+' costs '+n+' Thermal Cores ('+JSON.stringify(r.error||'')+')');t0=r.state.inv.pt.thermal;if(cq(P).rs.jobs.length>=2)await finishAll(P);}
 await finishAll(P);const r=await act(P,'research-start',{mod:'inferno'});ok(r.status===200&&t0-r.state.inv.pt.thermal===9&&r.state.rs.jobs.some(j=>j.mod==='inferno'&&j.ms===8*HOUR),'the set mod Inferno Core costs 9 and takes 8 h');}

// ---- 2. one earned research part a day; the next one is a fragment of its source's pool; 00:00 UTC starts the count again ----
{const P=9502;await pilot(P,5,1,{});const d0=Math.floor(now/DAY);
 let s=await find(P,'thermal','elite');ok(s.inv.pt.thermal===1&&s.inv.pd.d===d0&&s.inv.pd.n===1,'the first research part of the UTC day reaches the inventory');
 let fr=s.inv.fr.u;s=await find(P,'coil','elite');ok(s.inv.pt.coil===0&&s.inv.fr.u===fr+1,'a second earned part the same day (an elite\'s): 1 uncommon fragment instead');
 fr=s.inv.fr.r;s=await find(P,'servo','commander');ok(s.inv.pt.servo===0&&s.inv.fr.r===fr+1,'a raid commander\'s part past the limit: 1 rare fragment');
 fr=s.inv.fr.r;s=await find(P,'cap','strike');ok(s.inv.pt.cap===0&&s.inv.fr.r===fr+1,'a Meteor Strike\'s part past the limit: 1 rare fragment');
 const pts0=eco(P).pts;now=(d0+1)*DAY-1000;s=await find(P,'coil','elite');ok(s.inv.pt.coil===0,'23:59:59 UTC: still the same day, still a fragment');
 now=(d0+1)*DAY+1000;s=await find(P,'coil','elite');ok(s.inv.pt.coil===1&&s.inv.pd.d===d0+1&&s.inv.pd.n===1,'00:00 UTC: the count starts again, the next part is kept');
 fr=s.inv.fr.u;s=await find(P,'thermal','elite');ok(s.inv.pt.thermal===1&&s.inv.fr.u===fr+1,'and the day\'s second is a fragment again');
 ok(eco(P).pts===pts0,'fragments from the limit never pay points');}

// ---- 3. parts from packs and the Lunar Pass (the account's bonus parts) are never limited ----
{const P=9503;await pilot(P,5,3,{thermal:0});const d0=Math.floor(now/DAY);
 let s=await find(P,'thermal','elite');ok(s.inv.pd.n===1,'today\'s earned part is taken');
 const e=eco(P);e.bpt={thermal:40,coil:0,servo:0,cap:0};putEco(P,e);   // as a Research cache + Lab crates or pass tiers would add (eco ecoAddParts)
 let r=await act(P,'research-start',{mod:'vent'});ok(r.status===200&&r.state.rs.jobs[0].paid.e===1&&r.state.rs.jobs[0].paid.b===1,'research takes the earned part first, then bonus parts, past the daily limit');
 r=await act(P,'research-start',{mod:'overclock'});ok(r.status===200&&r.state.rs.jobs.length===2&&r.state.rs.bs.thermal===5,'a second job runs on bonus parts alone: '+r.state.rs.bs.thermal+' spent, none of it limited');
 ok(cq(P).inv.pd.n===1&&cq(P).inv.pd.d===d0,'bonus parts never touch the daily count');
 // the pass's parts arrive as bonus parts too (rules.js passPartsAt, when the Lab store opens): one road, no limit
 ok(R.passPartsAt(10,true)===1&&R.passPartsAt(20,true)===1&&R.passPartsAt(30,true)===1&&R.passPartsAt(10,false)===0,'Lunar Pass premium tiers 10/20/30 give 1 of each part as bonus parts (from the day the Lab store opens)');
 const S=R.ecoNorm({});R.ecoAddParts(S,8);ok(R.CQ_PART_ORDER.every(k=>S.bpt[k]===8),'a pack adds its parts to the same bonus total (no daily count anywhere on the account)');}

// ---- 4. Legendary set mods: the free research path and the buy gate, one ownership ----
{const P=9504;await pilot(P,5,2,{thermal:50});
 let r=await act(P,'research-start',{mod:'sunfire'});ok(r.status===409&&/Science Lab III/.test(r.error),'Sunfire cannot be researched below Science Lab III ('+r.error+')');
 {const q=cq(P);q.plot.b.lab1.l=3;putCq(P,q);}
 r=await act(P,'research-start',{mod:'sunfire'});ok(r.status===409&&/Inferno Core first/.test(r.error),'at Science Lab III, not before its track\'s set mod Inferno Core ('+r.error+')');
 ok(R.ecoOwned(R.ecoNorm(JSON.parse(JSON.stringify(eco(P)))),{kind:'rsleg',tk:'sunfire'},{week:1}),'nor can it be bought before Inferno Core: Science Lab III alone never opens the Lab store\'s Legendary');
 done(P,['vent','overclock','heatsink','inferno']);
 ok(!R.ecoOwned(R.ecoNorm(JSON.parse(JSON.stringify(eco(P)))),{kind:'rsleg',tk:'sunfire'},{week:1}),'after Inferno Core it would be on sale (checkout stays off: LAB_STORE_OPEN '+R.LAB_STORE_OPEN+')');
 const t0=cq(P).inv.pt.thermal;r=await act(P,'research-start',{mod:'sunfire'});
 ok(r.status===200&&t0-r.state.inv.pt.thermal===30&&r.state.rs.jobs.some(j=>j.mod==='sunfire'&&j.ms===8*HOUR),'Sunfire researched for 30 Thermal Cores, an 8-hour job ('+JSON.stringify(r.error||'')+')');
 ok(eco(P).rsj&&eco(P).rsj.sunfire===1,'the account knows at once that Sunfire is being researched');
 ok(R.ecoOwned(R.ecoNorm(JSON.parse(JSON.stringify(eco(P)))),{kind:'rsleg',tk:'sunfire'},{week:1}),'a Legendary being researched cannot be bought');
 r=await act(P,'research-start',{mod:'sunfire'});ok(r.status===409&&/already researching/.test(r.error),'nor researched twice ('+r.error+')');
 await finishAll(P);ok(cq(P).rs.done.sunfire&&eco(P).rm.sunfire===1&&!(eco(P).rsj||{}).sunfire,'8 hours later it is researched: on the account (rm), no longer "being researched"');
 ok(R.rmodOwned(R.ecoNorm(JSON.parse(JSON.stringify(eco(P)))),'mount','sunfire')&&R.ecoOwned(R.ecoNorm(JSON.parse(JSON.stringify(eco(P)))),{kind:'rsleg',tk:'sunfire'},{week:1}),'researched: it fits in the garage and cannot be bought');
 {const r2=await call(P,'/api/act',{a:'lab_read'}),E=r2.E,lab=E.lab,id=lab.active,M=lab.machines[id];const r3=await call(P,'/api/act',{a:'lab_save',id,rev:lab.rev,name:M.name,spec:{...M.spec,mods:{...M.spec.mods,mount:'sunfire'},catalog:R.FIT_VERSION}});
  ok(r3.status===200&&!r3.out?.err&&eco(P).lab.machines[id].spec.mods.mount==='sunfire','the garage (lab_save, server-validated) fits the researched Sunfire');}
 // a refund removes only a bought one: the researched Sunfire stays
 {const S=R.ecoNorm(JSON.parse(JSON.stringify(eco(P))));R.ecoRefund(S,'rsleg',[{tk:'rsleg',id:'sunfire'}]);ok(R.rmodOwned(S,'mount','sunfire'),'a refund of a bought Sunfire never takes a researched one');}
 // the open store (a test-only copy of the rules with LAB_STORE_OPEN true): a paid order for a researched or a being-researched Legendary grants nothing
 const O=(()=>{const ctx=vm.createContext({console}),src=fs.readFileSync(new URL('../../../js/rules.js',import.meta.url),'utf8');assert(src.includes('const LAB_STORE_OPEN=false;'));vm.runInContext(src.replace('const LAB_STORE_OPEN=false;','const LAB_STORE_OPEN=true;')+'\n;globalThis.__R={ecoNorm,ecoGrant,ecoOwned,ecoRefund,rmodOwned};',ctx);return ctx.__R;})();
 {const S=O.ecoNorm(JSON.parse(JSON.stringify(eco(P))));ok(O.ecoGrant(S,{kind:'rsleg',tk:'sunfire',price:9.6},{week:1}).length===0&&!(S.lsm&&S.lsm.sunfire),'store open: a paid order for the researched Sunfire grants nothing (never double)');}
 {const S=O.ecoNorm({rm:{pierce:1,marksman:1,predictor:1,rail:1},rsj:{starfall:1}});ok(O.ecoGrant(S,{kind:'rsleg',tk:'starfall',price:9.6},{week:1}).length===0,'store open: a Legendary being researched cannot be bought either');}
 // bought first: research refuses it
 {const e=eco(P);e.lsm={hyperdrive:1};putEco(P,e);done(P,['traction','ram','momentum','overdrive']);const q=cq(P);q.inv.pt.servo=40;putCq(P,q);}
 r=await act(P,'research-start',{mod:'hyperdrive'});ok(r.status===409&&/bought/.test(r.error),'a bought Hyperdrive cannot be researched ('+r.error+')');
 ok(cq(P).inv.pt.servo===40,'and costs nothing');
 {const S=R.ecoNorm(JSON.parse(JSON.stringify(eco(P))));R.ecoRefund(S,'rsleg',[{tk:'rsleg',id:'hyperdrive'}]);ok(!R.rmodOwned(S,'mobility','hyperdrive'),'a refund removes a bought Legendary (it was only bought)');}}

console.log('PASS wtest/research-economy ('+passed+' checks)');
