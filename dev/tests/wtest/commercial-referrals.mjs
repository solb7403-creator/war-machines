// Commercial referral boundaries: real Worker, hermetic Firebase, no external fallback.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {makeDB} from './fakedb.mjs';
const db=makeDB();
let failReferralProjection=false;
globalThis.fetch=async(url,init)=>{
 if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')){
  if(failReferralProjection&&init?.method==='PATCH'&&Object.keys(JSON.parse(init.body)).some(k=>k==='players/tg_8111/ref')){failReferralProjection=false;return new Response('unavailable',{status:503});}
  return db.handle(url,init);
 }
 throw Error('External fetch forbidden: '+url);
};
const {default:worker,sync}=await import('../../../worker/src/index.js');
const {RULES:R}=await import('../../../worker/src/sim.gen.js');
const env={BOT_TOKEN:'commercial-referrals-local',FIREBASE_DB_SECRET:'SECRET'};
const now=Date.now(),day=Math.floor(now/86400000);
function auth(id,start){
 const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Referral'})});
 if(start)p.set('start_param',start);
 const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');
 p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();
}
async function call(id,body={},start){const res=await worker.fetch(new Request('https://local/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:auth(id,start),...body})}),env);assert.equal(res.status,200);return res.json();}
let failed=0;
async function check(name,fn){try{await fn();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.message);}}
await call(9101);await call(9102);
await check('unsigned body cannot enroll a recruit',async()=>{assert.equal((await call(8101,{refBy:'tg_9101'})).rec.ref,null);});
await check('signed invitation wins over untrusted body',async()=>{assert.equal((await call(8102,{refBy:'tg_9102'},'ref_9101')).rec.ref,'tg_9101');});
await check('missing local referral still enrolls signed invitation',async()=>{assert.equal((await call(8103,{},'ref_9101')).rec.ref,'tg_9101');});
await check('old high-earned one-active-day pilot cannot be recruited',async()=>{
 await call(8104);Object.assign(db.root.eco.tg_8104,{days:1,fd:day-90,earned:500000,t:now-90*86400000});
 // Legacy record predates referral eligibility markers.
 delete db.root.eco.tg_8104.refDay;
 assert.equal((await call(8104,{refBy:'tg_9101'},'ref_9101')).rec.ref,null);
});
await check('new-account invitation eligibility ends after its first UTC day',async()=>{
 await sync(env,{}, {id:8105},'tg_8105',now-2*86400000);
 assert.equal((await call(8105,{refBy:'tg_9101'},'ref_9101')).rec.ref,null);
});
await check('concurrent first bindings agree and remain immutable on replay',async()=>{
 const results=await Promise.all([
  sync(env,{refBy:'tg_9101'},{id:8106},'tg_8106',now,'','ref_9101'),
  sync(env,{refBy:'tg_9102'},{id:8106},'tg_8106',now,'','ref_9102')
 ]);
 assert.equal(results[0].rec.ref,results[1].rec.ref);const ref=results[0].rec.ref;
 assert.equal(db.get('/players/tg_8106/ref'),ref);assert.equal((await call(8106,{},'ref_9102')).rec.ref,ref);
});
db.root.telegramLinks={8107:'ln_880000000000',9103:'ln_880001000000'};
db.root.lunarAccounts={ln_880000000000:{id:'ln_880000000000',type:'passkey',name:'Linked',telegramId:8107},ln_880001000000:{id:'ln_880001000000',type:'passkey',name:'Inviter',telegramId:9103}};
await call(9103);
await check('self-referral rejects both direct and linked Telegram aliases',async()=>{
 assert.equal((await call(8108,{refBy:'tg_8108'},'ref_8108')).rec.ref,null);
 const r=await call(8107,{refBy:'tg_8107'},'ref_8107');assert.equal(r.pid,'ln_880000000000');assert.equal(r.rec.ref,null);
});
await check('self-referral rejects a zero-padded Telegram alias',async()=>{assert.equal((await call(8112,{},'ref_08112')).rec.ref,null);});
await check('linked inviter receives canonical squad attribution',async()=>{assert.equal((await call(8109,{refBy:'tg_9103'},'ref_9103')).rec.ref,'ln_880001000000');});
await check('legacy established referral persists through new sync state',async()=>{
 await call(8110);db.root.players.tg_8110.ref='tg_9101';
 assert.equal((await call(8110,{},'ref_9102')).rec.ref,'tg_9101');
});
await check('lost referral projection is repaired without rebinding on reconnect',async()=>{
 failReferralProjection=true;
 assert.equal((await sync(env,{}, {id:8111},'tg_8111',now,'','ref_9101')).rec.ref,'tg_9101');
 assert.equal(db.get('/players/tg_8111/ref'),null);
 assert.equal((await call(8111,{},'ref_9102')).rec.ref,'tg_9101');
 assert.equal(db.get('/players/tg_8111/ref'),'tg_9101');
});
await check('referral caps, carryover and repeated claims preserve all rewards',async()=>{
 const X={day:12345,week:1763,rnd:()=>0.2,pk:'tg_8201'},S=R.ecoNorm({}),rows=[{id:'tg_8202',pts:100000,days:10}];
 assert.equal(R.ecoSquad(S,rows,X).pts,9500);assert.equal(S.refPD.a,2000);assert.equal(R.ecoSquad(S,rows,X).pts,0);
 assert.equal(R.ecoSquad(S,rows,{...X,day:X.day+1}).pts,2000);assert.equal(R.ecoSquad(S,rows,{...X,day:X.day+2}).pts,1000);assert.equal(R.ecoSquad(S,rows,{...X,day:X.day+2}).pts,0);
 const C=R.ecoNorm({});R.ecoAward(C,20000,X);assert.equal(R.ecoSquad(C,rows,X).pts,0);assert.deepEqual(C.refC,{});
});
await check('website-only identities do not produce synthetic Telegram referral links',()=>{
 const source=readFileSync(new URL('../../../js/core.js',import.meta.url),'utf8');
 const referral=source.slice(source.indexOf('const BOT_PLAY='),source.indexOf('// back from the wiki'));
 const context=vm.createContext({IN_TG:false,IN_WEB:true,TG_USER:{id:880000000000,lunar_account:true}});
 vm.runInContext(referral+';globalThis.link=refLink();',context);assert.equal(context.link,null);
});
await check('clean-device sync restores canonical inviter and clears stale local inviter',async()=>{
 const source=readFileSync(new URL('../../../js/net.js',import.meta.url),'utf8');
 const fn=source.slice(source.indexOf('async function doSync('),source.indexOf('// Stars purchases paid'));
 const context=vm.createContext({Date,ACCOUNT_OK:true,SRV_ECO:true,IN_TG:false,syncBusy:false,syncWant:false,starsAckQ:[],save:{migOk:1,refBy:'tg_forged'},
  captureRef(){},flushMatches:async()=>{},deviceId:()=>'',deviceHash:()=>'',myLoadout:()=>({}),store(){},
  api:async()=>({pid:'tg_8110',now:Date.now(),rec:{ref:'ln_880001000000'}})});
 vm.runInContext(fn,context);await vm.runInContext('doSync(false)',context);assert.equal(context.save.refBy,'ln_880001000000');
 context.api=async()=>({pid:'tg_8110',now:Date.now(),rec:{ref:null}});
 await vm.runInContext('doSync(false)',context);assert.equal(context.save.refBy,null);
});
if(failed)process.exitCode=1;
