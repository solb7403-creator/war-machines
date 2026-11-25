// Session 7C STEP 2 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md): the hub's airdrop standing and trust line, through the real
// Worker (fake Firebase with ETags): the cron's pool board (index.js airdropBoards writes adp from ads/<pid>, pilots under review left
// off), the standing route (POST /api/conquest/standing), the rank against the board, the next mark, the points to the pool, today's
// capped points (a Citadel bounty is outside the cap), the trust line (the share of the last 30 days without a flag; a held pilot sees
// "under review"), the card's words (js/conquest/standing.js), and nothing promises tokens.
import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';import {readFileSync} from 'node:fs';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({});globalThis.fetch=async(url,init={})=>{if(!String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))throw Error('Unexpected external request');return db.handle(url,init);};
const {default:worker,airdropBoards}=await import('../../../worker/src/index.js');const {RULES:R}=await import('../../../worker/src/sim.gen.js');
const ST=await import('../../../worker/src/conquest-standing.js');
const env={BOT_TOKEN:'standing-test',FIREBASE_DB_SECRET:'SECRET'},DAY=86400000;let now=Date.UTC(2026,10,25,12);Date.now=()=>now;let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:R.PVP_V,initData:auth(id),...body})}),env);const t=await r.text();return {status:r.status,...(t.startsWith('{')?JSON.parse(t):{error:t})};}
// ---- 1. the rules (pure) ----
{const S=[9000,8000,8000,7000,5000];ok(ST.rankOf(S,9500)===1&&ST.rankOf(S,9000)===1&&ST.rankOf(S,8000)===2&&ST.rankOf(S,7500)===4&&ST.rankOf(S,1)===6,'1. the rank is 1 + the scores above (ties share the better place)');
 const big=Array.from({length:1000},(_,i)=>100000-i*50);   // #1 100,000 ... #1000 50,050
 const a=ST.standingOf(big,big[841]);ok(a.inPool&&a.rank===842&&a.next.rank===800&&a.next.pts===big[799]-big[841]+1,'#842 in the pool: '+a.next.pts+' pts to #800 (the next mark)');
 const b=ST.standingOf(big,40000);ok(!b.inPool&&b.rank===null&&b.toPool===big[999]-40000+1,'outside a full pool: '+b.toPool+' pts to #1,000');
 const c=ST.standingOf([300,200],50);ok(c.inPool&&c.rank===3,'a pool not yet full: any score is in it');const z=ST.standingOf(big,0);ok(!z.inPool&&z.toPool>0,'no score yet: outside the pool');
 const top=ST.standingOf(big,200000);ok(top.rank===1&&!top.next,'#1 has no next mark');}
{const fd=Math.floor(now/DAY)-60,f={r:{cqppm:{t:now-5*DAY},hours:{t:now-20*DAY}},ok:{cqppm:now-3*DAY,hours:now-19*DAY}};const t=ST.trustOf(f,fd,now);
 ok(t.days===30&&t.flagged===5&&t.p===83&&!t.held,'the trust line: 5 of the last 30 days under a flag (3 + 2, both cleared) -> verified play 83%');
 const h=ST.trustOf({r:{cqrepeat:{t:now-2*DAY}}},fd,now);ok(h.held&&h.flagged===3,'a flag not yet cleared: under review (held)');
 const n=ST.trustOf(null,Math.floor(now/DAY)-4,now);ok(n.days===5&&n.p===100,'a 5-day-old account: the window is its 5 days, no flags -> 100%');}
// ---- 2. the cron's pool board and the route ----
{db.root.ads={};for(let i=0;i<1100;i++)db.root.ads['tg_'+(500000+i)]=200000-i*100;db.root.ads.tg_7101=150050;db.root.ads.tg_7102=100;db.root.ads.tg_7103=199950;   // tg_7103 would be #2 but is under review
 db.root.flags={tg_7103:{n:'Held',r:{cqrepeat:{t:now-DAY,v:'x'}}}};const fl=db.root.flags,okF=([id])=>!(fl[id]&&Object.keys(fl[id].r||{}).length);
 await airdropBoards(env,now,fl,okF);const adp=db.get('adp');ok(adp&&adp.s.length===R.AIRDROP.ptsTop&&adp.s.every((v,i,a)=>!i||a[i-1]>=v)&&!adp.s.includes(199950),'2. the cron writes the pool\'s '+adp.s.length+' scores (descending), the pilot under review left off');
 const day=Math.floor(now/DAY);db.root.players={tg_7101:{d:day,dailyPts:32000,fxn:25000,fd:day-90},tg_7102:{d:day,dailyPts:52000,fxn:0,fd:day-2},tg_7103:{d:day,dailyPts:100,fd:day-40}};
 const r1=await call(7101,'/api/conquest/standing');const s1=r1.st;ok(r1.status===200&&s1.inPool&&s1.rank===ST.rankOf(adp.s,150050)&&s1.next&&s1.today===7000&&s1.cap===R.DAILY_CAP,'the route: #'+s1.rank+' in the pool, '+s1.next.pts+' pts to #'+s1.next.rank+', today 7,000 / 50,000 (the 25,000 bounty is outside the cap)');
 ok(s1.trust.p===100&&!s1.trust.held&&s1.dist===false,'verified play 100%; the standing says nothing is distributed (AIRDROP.dist false)');
 const r2=await call(7102,'/api/conquest/standing');ok(!r2.st.inPool&&r2.st.toPool===adp.s[R.AIRDROP.ptsTop-1]-100+1&&r2.st.today===52000,'a pilot outside the pool: '+r2.st.toPool+' pts to #1,000; today\'s capped points as banked');
 const r3=await call(7103,'/api/conquest/standing');ok(r3.st.held&&r3.st.rank===null&&r3.st.trust.held,'a pilot under review: no rank, "under review"');
 now+=30*1000;db.root.ads.tg_7101=199999;const r4=await call(7101,'/api/conquest/standing');ok(r4.st.rank===2,'the pilot\'s own score is live (the board is the cron\'s): a new score ranks at once (#'+r4.st.rank+')');}
// ---- 3. the card's words (js/conquest/standing.js) ----
{globalThis.localStorage={getItem:()=>null,setItem:()=>{}};globalThis.fmtNum=n=>Math.round(n).toLocaleString('en-US');new Function(readFileSync(new URL('../../../js/conquest/standing.js',import.meta.url),'utf8'))();const L=globalThis.ConquestStanding.lines;
 const a=L({inPool:true,rank:842,next:{rank:800,pts:1200},today:12840,cap:50000,top:1000,trust:{p:94,days:30}});ok(a.big==='#842 IN THE POINTS POOL'&&a.sub==='1,200 pts to #800'&&a.today==='TODAY 12,840 / 50,000'&&a.trust==='VERIFIED PLAY 94% · LAST 30 DAYS','3. the card: "#842 IN THE POINTS POOL · 1,200 pts to #800 · TODAY 12,840 / 50,000 · VERIFIED PLAY 94%"');
 const h=L({held:true,today:0,cap:50000,top:1000,trust:{held:true}});ok(h.big==='UNDER REVIEW'&&/keep playing and earning/.test(h.sub)&&/sit out the boards and the airdrop snapshot/.test(h.sub)&&!h.trust,'under review: the rule (play on, sit out the boards and the snapshot until cleared), no percentage');
 const c=L({inPool:true,rank:5,next:{rank:3,pts:10},today:50000,cap:50000,top:1000,trust:{p:100,days:30}});ok(/CAP REACHED\. Loot, minerals and CP still drop\./.test(c.today),'at the cap: "CAP REACHED. Loot, minerals and CP still drop."');
 const src=readFileSync(new URL('../../../js/conquest/standing.js',import.meta.url),'utf8');ok(/No token amount is promised/.test(src)&&!/you will (get|receive)|guaranteed/i.test(src),'the card never promises tokens');}
console.log(JSON.stringify({test:'conquest-standing',pass}));
