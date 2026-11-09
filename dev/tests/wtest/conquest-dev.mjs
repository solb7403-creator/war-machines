// Owner dev mode (owner request, Nov 8 2026: "give my dev account unlimited resources so I can fully test the base").
// Worker + fake Firebase. Only the owner account (ln_6392735208728 via the pinned Telegram admin) can turn it on; while ON,
// claims, builds, upgrades and walls cost nothing and every gain is kept; FINISH NOW completes the builder job; the record
// is then a test record: no Conquest airdrop points and never ranked (top 20 / Base of the Week). Everyone else: unchanged.
import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({pruneEmptyUnder:['conquest']});
globalThis.fetch=async(url,init)=>{if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))return db.handle(url,init);throw Error('Unexpected external request');};
const {default:worker}=await import('../../../worker/src/index.js');const {CONQUEST:{Combat:C,World:W,Plot:P}}=await import('../../../worker/src/sim.gen.js');
const {earn}=await import('../../../worker/src/conquest-airdrop.js');const {weekOf}=await import('../../../worker/src/db.js');
const env={BOT_TOKEN:'conquest-dev-test',FIREBASE_DB_SECRET:'SECRET'};let now=Date.UTC(2026,10,10,12);Date.now=()=>now;
const OWNER='ln_6392735208728',PIN=999;
function auth(id,username){const u={id,first_name:'Pilot'+id};if(username)u.username=username;const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify(u)});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(who,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:4,initData:auth(who.id,who.u),...body})}),env);const t=await r.text();return {status:r.status,...(t.startsWith('{')?JSON.parse(t):{error:t})};}
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
db.root.cfg={admin:{lunarbattle:PIN}};db.root.telegramLinks={[PIN]:OWNER};db.root.lunarAccounts={[OWNER]:{id:OWNER,type:'password',name:'Lunar',telegramId:PIN}};
const owner={id:PIN,u:'LunarBattle'},other={id:7301},fake={id:7302,u:'LunarBattle'};   // fake: the admin username on another Telegram id
const D=C.baseDefinition,gate={x:D.x,z:D.z,y:W.groundAt(D.x,D.z),surface:'ground'};
const rec=pid=>db.get('conquest/'+pid);
async function open(who){await call(who,'/api/sync');const r=await call(who,'/api/conquest/session');assert.equal(r.status,200,JSON.stringify(r).slice(0,200));return r.state;}
async function act(who,pid,action,extra={}){const s=rec(pid);return call(who,'/api/conquest/action',{seq:s.seq+1,action,...extra});}
function atGate(pid){const s=rec(pid);s.position=gate;s.battle.enemies=[];db.root.conquest[pid]=s;}
// --- only the owner ---
await open(owner);ok(!!rec(OWNER),'the owner Telegram session plays on the linked owner account');
await open(other);atGate('tg_7301');ok((await act(other,'tg_7301','dev-on')).status===403,'any other pilot is refused (403 owner only)');
await open(fake);ok((await act(fake,'tg_7302','dev-on')).status===403,'the admin username on another Telegram id is refused');
ok(!rec('tg_7301').dev&&!rec('tg_7302').dev,'... and nothing was written to their records');
ok((await act(owner,OWNER,'dev-on',{plot:{}})).status===400,'dev actions take no extra fields');
// --- owner: claim with 0 CP once ON ---
atGate(OWNER);const before=rec(OWNER).ledger;ok(before.cp<D.recipe.cp,'the owner starts without the 2,550 CP claim recipe ('+before.cp+' CP)');
ok((await act(owner,OWNER,'build-base',{plot:{site:'crater'}})).status!==200,'with dev mode OFF the claim is refused (insufficient CP), as for everyone');
let r=await act(owner,OWNER,'dev-on');ok(r.status===200&&r.state.dev?.on===1&&r.state.dev.used===1,'the owner turns dev mode ON');
r=await act(owner,OWNER,'build-base',{plot:{site:'crater'}});ok(r.status===200&&r.state.plot?.site==='crater','with dev mode ON the owner claims the plot for free');
ok(rec(OWNER).ledger.cp===before.cp&&JSON.stringify(rec(OWNER).ledger.banked)===JSON.stringify({...{alloy:0,biomass:0,helium:0},...before.banked}),'... and the real CP and materials are untouched ('+rec(OWNER).ledger.cp+' CP)');
// builds and upgrades: free; FINISH NOW completes the builder's job
let s=rec(OWNER);const at=P.autoPlace(s.plot,'refinery');r=await act(owner,OWNER,'plot-build',{plot:{type:'refinery',...at}});ok(r.status===200&&!rec(OWNER).plot.job&&Object.values(rec(OWNER).plot.b).some(b=>b.t==='refinery'&&b.l===1),'a Refinery is built for free and INSTANTLY (no countdown in dev mode)');
for(let i=0;i<4;i++){r=await act(owner,OWNER,'plot-upgrade',{plot:{id:'cc'}});assert.equal(r.status,200,JSON.stringify(r).slice(0,160));}
ok(rec(OWNER).plot.cc===5&&!rec(OWNER).plot.job,'Command Center upgraded to CC5 for free, each upgrade instant');
ok((await act(owner,OWNER,'dev-finish')).status!==200,'... so FINISH BUILD NOW has nothing left to finish');
// walls spend base-store minerals: free too, base stores untouched
s=rec(OWNER);const cells=[[3,20],[4,20],[5,20]];r=await act(owner,OWNER,'plot-wall',{plot:{cells,tier:1}});ok(r.status===200&&Object.keys(rec(OWNER).plot.w).length>=3,'mineral walls are placed without minerals in the base stores');
ok(Object.values(rec(OWNER).plot.mnSpent||{}).every(n=>!n),'... and no minerals were counted as spent');
ok(rec(OWNER).ledger.cp===before.cp,'real CP still untouched after all of it');
// gains are kept: bank adds real CP on top
s=rec(OWNER);s.position={x:C.refuge.x,z:C.refuge.z,y:W.groundAt(C.refuge.x,C.refuge.z),surface:'ground'};s.ledger.cargo={...s.ledger.cargo,alloy:40};db.root.conquest[OWNER]=s;const al0=s.ledger.banked.alloy||0;
r=await act(owner,OWNER,'bank');ok(r.status===200&&rec(OWNER).ledger.banked.alloy===al0+40,'banking still adds real materials while dev mode is ON (gains kept: alloy '+al0+' → '+rec(OWNER).ledger.banked.alloy+')');
// test record: no airdrop points, never ranked
ok(earn(rec(OWNER),'kill',100,now)===0,'a dev-mode record earns no Conquest airdrop points');
ok(!(db.get('cqtop')?.list||[]).some(x=>x.p===OWNER),'the dev-mode base is never in the top 20');
ok(!Object.values(db.root.cqweek||{}).some(w=>w?.p===OWNER),'... nor Base of the Week');
// a ranking the owner already held is dropped on the next publish, even with nothing changed (review fix)
db.root.cqtop={at:now,list:[{p:OWNER,n:'Lunar',pw:999999,cc:9,site:'crater'},{p:'tg_1',n:'X',pw:1,cc:1,site:'ridge'}]};db.root.cqweek={[weekOf(now)]:{p:OWNER,g:5,pw:9,at:now}};await call(owner,'/api/conquest/session');
ok(!db.get('cqtop').list.some(x=>x.p===OWNER)&&db.get('cqtop').list.length===1&&!db.get('cqweek/'+weekOf(now)),'an existing top-20 entry and Base of the Week title are removed on the next session open');
ok(!!db.get('cqbase/'+OWNER),'... while the public snapshot stays (squadmates can still visit)');
ok(Object.values(rec(OWNER).plot.mnSpent||{}).every(n=>!n),'dev mode never changes the real base-store mineral count');
// OFF: costs are real again; the test flag stays
r=await act(owner,OWNER,'dev-off');ok(r.status===200&&r.state.dev.on===0&&r.state.dev.used===1,'dev mode OFF keeps the test-record flag');
r=await act(owner,OWNER,'plot-upgrade',{plot:{id:'cc'}});ok(r.status!==200,'with dev mode OFF upgrades cost real resources again (refused: '+String(r.error).slice(0,60)+')');
ok((await act(owner,OWNER,'dev-finish')).status!==200,'FINISH NOW only works while dev mode is ON');
// another pilot's economy is unchanged
ok(earn({airdrop:{}},'kill',100,now)>0,'a normal record still earns Conquest airdrop points');
console.log('conquest dev mode: passed '+passed);
