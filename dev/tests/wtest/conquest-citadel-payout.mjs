// Session 7B: the Citadel first-clear bounty through the REAL Worker routes (fake Firebase with ETags; the third reviewer's harness):
// exactly once per account, outside the 50,000 daily cap, impossible to replay or forge (owner brief
// docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md). Each assault is launched by the real start-mission action and won by the real
// input route; only the fight itself is cut short (the warden placed down), so the settlement, the outbox, the account write and the
// watermark are the production code. Covers: the first clear, a replayed input, two tabs at once, the account write down then back, the
// cap already reached, the hourly limit, the Conquest record reset and re-cleared (review W1: the next tier's bounty still pays), a
// second delivery, ids beyond the live tiers (W2), an owner dev record, and the HUD's capped points (W3).
import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {cqLive} from './cqlive.mjs';import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({pruneEmptyUnder:['conquest']});
let failEco=0;globalThis.fetch=async(url,init={})=>{const u=String(url);if(!u.startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))throw Error('Unexpected external request');
 if(failEco>0&&(init.method||'GET').toUpperCase()==='PUT'&&/\/eco\/tg_\d+\.json/.test(u)){failEco--;return new Response('{"error":"unavailable"}',{status:503});}
 return db.handle(url,init);};
const {default:worker}=await import('../../../worker/src/index.js');
const {RULES:R,CONQUEST}=await import('../../../worker/src/sim.gen.js');const {Citadel:CI,War:WR,World:W}=CONQUEST;
const {hydrate}=await import('../../../worker/src/conquest-sim.js');const {creditConquest}=await import('../../../worker/src/eco.js');
const env={BOT_TOKEN:'citadel-payout-test',FIREBASE_DB_SECRET:'SECRET'},DAY=86400000;
let now=Date.UTC(2026,10,25,9,0,0);Date.now=()=>now;let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:R.PVP_V,initData:auth(id),...body})}),env);const t=await r.text();return {status:r.status,...(t.startsWith('{')?JSON.parse(t):{error:t})};}
const eco=id=>db.get('eco/tg_'+id),cq=id=>cqLive(db,'tg_'+id),pts=id=>eco(id)?.pts||0;
// test set-up (the record, not the rules): FRONT held, at the siege camp, a town; then the warden is down (the fight cut short)
function place(P){const s=cq(P);s.war=WR.norm(s.war,now);s.war.sc={n:9,done:1};s.war.ev=[];s.war.go=null;s.war.k=WR.tickOf(now);for(const id of WR.APPROACH)s.war.o[id]='h';
 s.position=CI.stageAt();s.battle.enemies=[];s.hp=Math.max(s.hp||0,100);s.base={tier:5,modules:{hangar:3},builtAt:now-30*DAY,claimedAt:now-DAY,pointsAt:now-DAY,defense:{config:'turret',damage:0,wins:0,alertAt:0,nextAt:now+9e12,active:false}};return s;}
function wardenDown(P){const s=cq(P),b=s.battle;for(const e of b.enemies)if(!e.resident)e.hp=0;b.cit.stage=2;
 b.enemies.push({id:99999,kind:'sentinel',cls:'titan',arch:'siege',x:s.position.x+30,z:s.position.z,y:W.groundAt(s.position.x+30,s.position.z),surface:'ground',hp:0,maxHp:18500,warden:1,commander:true,stats:b.enemies[0]?.stats||{},cd:9,vx:0,vz:0,heading:0,turret:0,decision:1,noLoot:true,lootCreated:true,wave:'warden'});
 b.time=Math.max(b.time||0,412.345);const B=hydrate(s);B.wardenId=99999;const nb=JSON.parse(JSON.stringify(B));nb.wardenId=99999;s.battle=nb;}
async function fresh(P){await call(P,'/api/sync');const r=await call(P,'/api/conquest/session');assert.equal(r.status,200,'session '+r.error);}
async function clear(P,tier,pre){now+=1000;let s=place(P);if(s.mission){now+=100;await call(P,'/api/conquest/action',{seq:s.seq+1,action:'return-exploration'});s=place(P);}
 now+=200;const st=await call(P,'/api/conquest/action',{seq:s.seq+1,action:'start-mission',mission:'citadel-'+tier});if(st.status!==200)return {start:st};
 wardenDown(P);if(pre)pre(cq(P));now+=200;s=cq(P);const req={seq:s.seq+1,commands:[{x:0,z:0}]};return {req,r:await call(P,'/api/conquest/input',req)};}
// 1. the first clear: +25,000 once, outside the cap; the HUD's day counts only capped points (W3)
{const P=7701;await fresh(P);const p0=pts(P);const {r,req}=await clear(P,1);
 ok(r.status===200&&r.state.settlement?.kind==='citadel'&&r.state.settlement.first===1,'the real routes: the assault launched, won and settled as the first clear of tier I');
 const e=eco(P);ok(e.cbty?.cit1>0&&e.fx?.n===25000,'the account was paid tier I\'s bounty once (eco.cbty) on the free path (outside the cap: eco.fx)');
 ok(pts(P)-p0>=25000,'+'+(pts(P)-p0)+' points: the 25,000 bounty plus the battle points');
 const v=r.state.airdrop?.view||{};ok(v.dailyPts===Math.max(0,(e.dailyPts||0)-25000),'the HUD\'s "AIRDROP TODAY" counts only capped points ('+v.dailyPts+' of '+v.cap+'): the bounty never reads as the cap used up');
 const p1=pts(P);now+=50;const again=await call(P,'/api/conquest/input',req);ok(pts(P)===p1&&eco(P).fx?.n===25000,'the same winning request replayed ('+again.status+'): nothing more');
 const both=await Promise.all([call(P,'/api/conquest/input',req),call(P,'/api/conquest/input',req)]);ok(pts(P)===p1,'two tabs sending it at once ('+both.map(b=>b.status).join(', ')+'): nothing more');
 // a Throne Run of tier I: loot and battle points, never the bounty again
 now+=2*60*1000;const f0=eco(P).fx?.n;const {r:t}=await clear(P,1);ok(t.status===200&&t.state.settlement?.throne===1&&eco(P).fx?.n===f0,'a Throne Run of tier I pays no bounty');
 // a second delivery of an old entry and a new entry naming cit1: 0
 const before=pts(P),again2=await creditConquest(env,'tg_'+P,[{id:1,raw:0,op:1,ms:0,bty:[{id:'cit1',pts:25000}]},{id:9999,raw:0,op:1,ms:0,bty:[{id:'cit1',pts:25000}]}],now);
 ok(again2.bounty===0&&pts(P)===before,'a second delivery (an old id, and a new id naming cit1): 0');}
// 2. the account write down at the victory: the entry waits, then pays once
{const P=7702;await fresh(P);const p0=pts(P);failEco=8;const {r}=await clear(P,1);failEco=0;const mid=pts(P);
 ok(r.status===200&&mid===p0&&(cq(P).airdrop.out||[]).some(e=>(e.bty||[]).some(b=>b.id==='cit1')),'the account write down at the victory: nothing paid yet, the bounty waits in the outbox');
 now+=100;const s=cq(P);await call(P,'/api/conquest/input',{seq:s.seq+1,commands:[{x:0,z:0}]});ok(eco(P).cbty?.cit1>0&&eco(P).fx?.n===25000&&!(cq(P).airdrop.out||[]).length,'the next request pays it once and the outbox empties');}
// 3. the cap already reached: the bounty in full, the battle points capped, the day's cap room unchanged
{const P=7703;await fresh(P);const E=db.root.eco['tg_'+P];E.dailyPts=R.DAILY_CAP;E.dailyDay=Math.floor(now/DAY);const p0=pts(P);const {r}=await clear(P,1);
 ok(r.status===200&&pts(P)-p0===25000&&eco(P).fx?.n===25000,'the cap already reached today: the 25,000 bounty paid in full, the battle points capped (+'+(pts(P)-p0)+')');
 const S=structuredClone(eco(P)),X={day:Math.floor(now/DAY),week:0};ok(R.ecoPlayAward(S,1000,1000,X).base===0,'and the cap room is still none for ordinary points');}
// 4. the hourly limit reached: battle points 0, the bounty paid
{const P=7704;await fresh(P);const p0=pts(P);const {r}=await clear(P,1,s=>{s.airdrop.hr={h:Math.floor(now/3600000),n:R.CQ_PTS.hourMax};});
 ok(r.status===200&&pts(P)-p0===25000,'the hourly limit reached: the battle points stop, the bounty is paid (+'+(pts(P)-p0)+')');}
// 5. review W1: the Conquest record reset on the server after tier I; tier I re-cleared pays 0, tier II pays (its entry id is at or below the
// old watermark), once
{const P=7705;await fresh(P);await clear(P,1);now+=2*60*1000;await clear(P,1);now+=2*60*1000;await clear(P,1);const w=eco(P).cqw;
 db.root.conquest&&delete db.root.conquest['tg_'+P];for(const k of Object.keys(db.root))if(k.startsWith('conquest')&&db.root[k]&&db.root[k]['tg_'+P])delete db.root[k]['tg_'+P];
 await call(P,'/api/conquest/session');const f1=eco(P).fx?.n|0;const {r:r1}=await clear(P,1);ok(r1.status===200&&(eco(P).fx?.n|0)===f1,'a reset record re-clears tier I: the account pays 0 (watermark '+w+')');
 now+=8*DAY;const {r:r2,start:st2}=await clear(P,2);ok(r2.status===200&&r2.state.settlement?.first===1&&eco(P).cbty?.cit2>0,'... and its first clear of tier II still pays 37,500 although its outbox ids restarted below the watermark (review W1)');
 const f2=eco(P).fx?.n|0,{r:r3}=await clear(P,2);ok(r3.state?.settlement?.throne===1&&(eco(P).fx?.n|0)===f2,'... once');}
// 6. review W2: ids beyond the live tiers pay nothing, even if something ever wrote one; the amount is always the table's
{const P=7706;await fresh(P);const p0=pts(P),c=await creditConquest(env,'tg_'+P,[{id:1,raw:0,op:0,ms:0,bty:[4,5,6,7,8,9].map(n=>({id:'cit'+n,pts:500000}))}],now);
 ok(c.bounty===0&&pts(P)===p0&&R.CIT_LIVE===3,'cit4-cit9 pay 0 while the live tiers are I-III (rules.js CIT_LIVE)');
 const d=await creditConquest(env,'tg_'+P,[{id:2,raw:0,op:0,ms:0,bty:[{id:'cit2',pts:1}]}],now);ok(d.bounty===37500,'the amount is the table\'s, never the entry\'s (an entry claiming 1 paid 37,500)');}
// 7. an owner dev record never earns airdrop points
{const P=7707;await fresh(P);const p0=pts(P);const {r}=await clear(P,1,s=>{s.dev={on:0,used:1};});ok(r.status===200&&!eco(P).cbty?.cit1&&pts(P)===p0,'an owner dev record clears tier I and earns no bounty');}
console.log(JSON.stringify({test:'conquest-citadel-payout',pass}));
