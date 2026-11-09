// Session 5 Phase 2 (Worker + fake Firebase): verified plot changes publish a public snapshot (no ledger, materials,
// minerals, timers or positions); the top 20 by Command Power and Base of the Week (largest verified weekly gain) update by
// CAS; visits are read-only and open only to the top 20, your squad and the Base of the Week.
import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({pruneEmptyUnder:['conquest']});
globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))return db.handle(url,init);throw Error('Unexpected external request');};
const {default:worker}=await import('../../../worker/src/index.js');const {CONQUEST:{Combat:C,World:W,Plot:P}}=await import('../../../worker/src/sim.gen.js');
const env={BOT_TOKEN:'conquest-test',FIREBASE_DB_SECRET:'SECRET'};let now=Date.UTC(2026,10,10,12);Date.now=()=>now;
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'+id})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:4,initData:auth(id),...body})}),env);const t=await r.text();return {status:r.status,...(t.startsWith('{')?JSON.parse(t):{error:t})};}
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const D=C.baseDefinition,gate={x:D.x,z:D.z,y:W.groundAt(D.x,D.z),surface:'ground'};
async function pilotWithBase(id,site){await call(id,'/api/sync');await call(id,'/api/conquest/session');const s=db.get('conquest/tg_'+id);s.position=gate;s.battle.enemies=[];s.ledger.cp=1e6;s.ledger.banked={alloy:1e5,biomass:1e5,helium:1e5};db.root.conquest['tg_'+id]=s;
 const r=await call(id,'/api/conquest/action',{seq:s.seq+1,action:'build-base',plot:{site}});assert.equal(r.status,200,JSON.stringify(r).slice(0,200));return r.state;}
const a=await pilotWithBase(8201,'canyon');const snap=db.get('cqbase/tg_8201');
ok(snap&&snap.site==='canyon'&&snap.cc===1&&snap.pw===a.plot.power&&snap.n==='Pilot8201'&&snap.b.cc,'claiming a plot publishes its public snapshot (site, CC, Command Power, layout)');
ok(!('ledger' in snap)&&!('st' in snap)&&!('mnSpent' in snap)&&!('job' in snap)&&!JSON.stringify(snap).includes('banked'),'the snapshot holds no ledger, materials, minerals, production store or timers');
ok(db.get('cqtop').list.some(x=>x.p==='tg_8201'),'the pilot enters the Command Power top 20');
ok(snap.w0===snap.pw&&!db.root.cqweek,'a first publish starts the week at its own power: an existing base is not "gain" (review fix)');
// a second pilot builds more: their verified gain makes them Base of the Week
const b=await pilotWithBase(8202,'ridge');now+=1000;let s=db.get('conquest/tg_8202');const at=P.autoPlace(s.plot,'refinery');
let r=await call(8202,'/api/conquest/action',{seq:s.seq+1,action:'plot-build',plot:{type:'refinery',...at}});now+=16000;r=await call(8202,'/api/conquest/session');
s=db.get('conquest/tg_8202');r=await call(8202,'/api/conquest/action',{seq:s.seq+1,action:'plot-upgrade',plot:{id:'cc'}});now+=31000;await call(8202,'/api/conquest/session');
const wk=Object.keys(db.root.cqweek||{})[0],bow=db.get('cqweek/'+wk);ok(bow?.p==='tg_8202'&&bow.g>0,'Base of the Week: the largest verified weekly Command Power gain (+'+bow?.g+', no votes)');
const top=db.get('cqtop').list;ok(top[0].p==='tg_8202'&&top.length===2,'top list sorted by Command Power');
// visits: lists, read-only snapshot, permissions
const before=JSON.stringify(db.root);await call(8203,'/api/sync');const L=await call(8203,'/api/conquest/visit');
ok(L.status===200&&L.top.length===2&&L.week?.p==='tg_8202'&&Array.isArray(L.squad),'the visit list shows the top 20, your squad and the Base of the Week');
const v=await call(8203,'/api/conquest/visit',{pid:'tg_8201'});ok(v.status===200&&v.base.site==='canyon'&&v.base.b.cc&&!('ledger' in v.base),'visiting a top-20 base returns its public layout only');
ok(JSON.stringify(db.root.cqbase)===JSON.stringify(JSON.parse(before).cqbase)&&JSON.stringify(db.root.conquest.tg_8201)===JSON.stringify(JSON.parse(before).conquest.tg_8201),'... the visited pilot\'s Conquest record and snapshot are byte-identical');
db.root.cqbase.tg_9999={n:'Hidden',site:'ridge',cc:1,pw:1,b:{},w:{},at:now};ok((await call(8203,'/api/conquest/visit',{pid:'tg_9999'})).status===403,'a base outside the top 20, your squad and the Base of the Week cannot be opened');
ok(!('at' in v.base),'the visit hides when the pilot was last active');db.root.fh={tg_8201:1};const hidden=await call(8203,'/api/conquest/visit');ok(!hidden.top.some(x=>x.p==='tg_8201'),'pilots under review are left off the public lists');delete db.root.fh;
ok((await call(8203,'/api/conquest/visit',{pid:'tg_8201',write:1})).status===400&&(await call(8203,'/api/conquest/visit',{pid:'../eco'})).status===400,'extra fields and bad ids are refused');
// squad: a recruit can visit their referrer even outside the top 20
db.root.players.tg_8204={...(db.root.players.tg_8204||{}),ref:'tg_9999',name:'Recruit'};await call(8204,'/api/sync');db.root.players.tg_8204.ref='tg_9999';const sq=await call(8204,'/api/conquest/visit',{pid:'tg_9999'});
ok(sq.status===200&&sq.base.n==='Hidden','squadmates can visit each other (here: a recruit visits their referrer)');
// Session 5B review fix: walls (composite refunds 1:1) must not farm Base of the Week by dipping before the rollover
{const {publishBase}=await import('../../../worker/src/conquest-visit.js');const W1=Date.UTC(2026,10,11,12),W2=W1+7*86400000,pl=(pw)=>({plot:{site:'ridge',cc:5,power:pw,b:{cc:{t:'cc',i:37,j:37,r:0,l:5}},w:{}}});
 await publishBase(env,'tg_8300','Dipper',pl(4000),W1);await publishBase(env,'tg_8300','Dipper',pl(1000),W1+1000);   // walls removed late in the week
 await publishBase(env,'tg_8300','Dipper',pl(1000),W2);await publishBase(env,'tg_8300','Dipper',pl(4000),W2+1000);   // rebuilt after the rollover
 const sn=db.get('cqbase/tg_8300'),bw=db.get('cqweek/'+Object.keys(db.root.cqweek).sort().at(-1));ok(sn.w0===4000&&sn.pk===4000&&(bw?.p!=='tg_8300'||bw.g<=0),'removing walls before the weekly rollover and rebuilding them after is no Base of the Week gain (baseline = peak power)');}
console.log(`conquest visit: passed ${passed}`);
