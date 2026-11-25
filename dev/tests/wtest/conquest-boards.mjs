// Session 7C STEP 3 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md): the weekly boards and their rewards, through the real Worker
// (fake Firebase with ETags): scores only from the pilot's verified record, the CAS documents, pilots under review left off, the reading
// route, the week rollover, the raid time-attack stamp, and the payout: once per board per period, only with 20+ verified pilots, every
// band rounded down and capped (owner, Nov 24: Titan weekly 1 Selenite top 10% <= 100, 1 Moonheart top 1% <= 10; Titan 30 days 2
// Moonheart top 1% <= 3; the other four 1,500 CP + 1 rare fragment top 10% <= 100); each grant applied once by id at the session open,
// its amounts always the table's.
import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({});globalThis.fetch=async(url,init={})=>{if(!String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))throw Error('Unexpected external request');return db.handle(url,init);};
const {default:worker}=await import('../../../worker/src/index.js');const {RULES:R,CONQUEST}=await import('../../../worker/src/sim.gen.js');
const BD=await import('../../../worker/src/conquest-boards.js');const {cqLive}=await import('./cqlive.mjs');
const env={BOT_TOKEN:'boards-test',FIREBASE_DB_SECRET:'SECRET'},DAY=86400000;let now=Date.UTC(2026,10,25,12);Date.now=()=>now;let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'+id})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:R.PVP_V,initData:auth(id),...body})}),env);const t=await r.text();return {status:r.status,...(t.startsWith('{')?JSON.parse(t):{error:t})};}
const wk=Math.floor((now-4*DAY)/(7*DAY));
// ---- 1. the rules ----
{const B=BD.BOARD;ok(JSON.stringify(B.order)==='["town","defense","raid","titan","campaign","titan30"]'&&B.min===20,'1. five weekly boards and the Titan\'s 30-day board; rewards need 20 verified pilots');
 ok(JSON.stringify(B.bands.titan)==='[{"pct":0.1,"max":100,"mn":{"se":1}},{"pct":0.01,"max":10,"mn":{"mh":1}}]'&&JSON.stringify(B.bands.titan30)==='[{"pct":0.01,"max":3,"mn":{"mh":2}}]'&&['town','defense','raid','campaign'].every(k=>JSON.stringify(B.bands[k])==='[{"pct":0.1,"max":100,"cp":1500,"fr":{"r":1}}]'),'the owner\'s bands (Nov 24): Titan 1 Selenite top 10% <= 100 + 1 Moonheart top 1% <= 10; 30 days 2 Moonheart top 1% <= 3; the rest 1,500 CP + 1 rare fragment top 10% <= 100');
 const k=n=>BD.bandsOf('titan',n).map(b=>b.k).join('/');ok(k(19)===''&&k(20)==='2/0'&&k(25)==='2/0'&&k(99)==='9/0'&&k(100)==='10/1'&&k(250)==='25/2'&&k(5000)==='100/10','rounded down and capped: 19 pilots nothing; 20 -> 2 Selenite / 0 Moonheart; 100 -> 10 / 1; 250 -> 25 / 2; 5,000 -> 100 / 10');
 ok(BD.bandsOf('titan30',299)[0].k===2&&BD.bandsOf('titan30',400)[0].k===3&&BD.bandsOf('town',37)[0].k===3,'30 days: 299 -> 2, 400 -> 3 (the cap); the others: 37 -> 3');
 ok(BD.periodOf('town',Date.UTC(2026,10,29,23,59))!==BD.periodOf('town',Date.UTC(2026,10,30,0,0))&&BD.periodOf('town',Date.UTC(2026,10,30,0,0))===BD.periodOf('town',Date.UTC(2026,11,6,23,59)),'the week rolls over on Monday 00:00 UTC');}
// ---- 2. scores from the verified record only; posting; held pilots left off; dev records never ranked ----
{const s={v:1,campaignScore:140,wkb:{w:wk,cs:100},ttn:{v:1,sl:{}},plot:{cc:6}},slot=Math.floor(now/R.STRIKE.everyMs/6)*6;s.ttn.sl[slot]={k:1,d:6400,a:1};s.ttn.sl[slot-6]={k:0,d:2000,a:1};
 const sc=BD.scoresOf(s,now);ok(sc.campaign===40&&sc.titan>=6400&&sc.titan30>=sc.titan,'2. the scores come from the record: the week\'s campaign gain (40), the Titan damage of the week\'s slots, the 30 days\'');
 await BD.postBoards(env,'tg_9001','Ace',s,now,{town:120,defense:900});const cb=db.get('cqb/campaign/'+BD.periodOf('campaign',now));ok(cb?.top?.[0]?.p==='tg_9001'&&cb.top[0].s===40&&cb.n===1&&db.get('cqbp/campaign/'+BD.periodOf('campaign',now)+'/tg_9001')===40,'posted to the shared document (CAS) and the field marker');
 await BD.postBoards(env,'tg_9001','Ace',{...s,campaignScore:130},now);ok(db.get('cqb/campaign/'+BD.periodOf('campaign',now)).top[0].s===40,'a lower score never replaces a better one');
 await Promise.all([1,2,3,4,5,6].map(i=>BD.postBoards(env,'tg_91'+i,'P'+i,{...s,campaignScore:100+i},now)));const cb2=db.get('cqb/campaign/'+BD.periodOf('campaign',now));ok(cb2.top.length===7&&cb2.n===7,'six pilots posting at once: no entry lost (the CAS retries)');
 await BD.postBoards(env,'tg_9100','Dev',{...s,campaignScore:999,dev:{used:1}},now);ok(!db.get('cqb/campaign/'+BD.periodOf('campaign',now)).top.some(r=>r.p==='tg_9100'),'an owner dev record is never ranked');
 db.root.fh={tg_9001:1};const r=await call(9002,'/api/conquest/boards');ok(r.status===200&&r.boards.campaign.top.length===6&&!r.boards.campaign.top.some(x=>x.n==='Ace')&&r.boards.raid&&r.raid===BD.featuredRaid(now),'the reading route: the pilot under review left off (as cqtop), names and scores only, the week\'s featured raid ('+r.raid+')');
 ok(!JSON.stringify(r.boards).includes('tg_'),'pilot ids never leave the Worker');delete db.root.fh;}
// ---- 3. the raid time-attack stamp ----
{const id=BD.featuredRaid(now),s={settlement:{kind:'first-clear'}};BD.raidTime(s,id,{time:187.43},now);ok(s.settlement.sec===187.4&&s.rbest[id]===187.4&&s.rtb.sec===187.4&&BD.scoresOf(s,now).raid===187.4,'3. a raid won: the Worker\'s fight clock stamped in its receipt (187.4 s), the pilot\'s best and the week\'s featured-raid score');
 BD.raidTime(s,id,{time:201},now);ok(s.rtb.sec===187.4&&s.rbest[id]===187.4,'a slower clear keeps the best');
 const other=CONQUEST.Combat.raidIds.find(x=>x!==id),t={settlement:{}};BD.raidTime(t,other,{time:90},now);ok(!t.rtb&&t.rbest[other]===90,'another layout keeps a personal best, off the week\'s board');}
// ---- 4. the payout: once, only with 20+ verified pilots, rounded down ----
async function seed(kind,per,n,{held=[],tie=false}={}){const top=[],mk={};for(let i=0;i<n;i++){const p='tg_'+(70000+i);top.push({p,n:'P'+i,s:tie?500:1000-i,at:now-DAY+i*1000});mk[p]=1000-i;}db.root.cqb=db.root.cqb||{};(db.root.cqb[kind]=db.root.cqb[kind]||{})[per]={v:1,k:kind,per,top:BD.rank(kind,top).slice(0,120),n,at:now};db.root.cqbp=db.root.cqbp||{};(db.root.cqbp[kind]=db.root.cqbp[kind]||{})[per]=mk;db.root.fh=Object.fromEntries(held.map(p=>[p,1]));}
{const per='w'+(wk-1),later=Date.UTC(2026,10,25,12)+2*7*DAY;await seed('town',per,12);await BD.settleBoard(env,'town',per,later);const v=db.get('cqbs/town/'+per);ok(v.small===1&&v.n===12&&!v.w.length&&!Object.keys(db.root.cqgr||{}).length,'4. a field of 12: no reward (small field), the settlement recorded');}
{const per='w'+(wk-2);await seed('titan',per,250,{held:['tg_70000']});await BD.settleBoard(env,'titan',per,now);const v=db.get('cqbs/titan/'+per),g=db.root.cqgr||{};
 const se=Object.entries(g).filter(([,x])=>x['titan-'+per+'-01']).length,mh=Object.entries(g).filter(([,x])=>x['titan-'+per+'-001']).length;
 ok(v.n===249&&se===24&&mh===2&&!g.tg_70000,'a Titan field of 250 with one pilot under review: 249 verified -> 24 Selenite (10%, rounded down), 2 Moonheart (1%); the held pilot skipped');
 ok(g.tg_70001['titan-'+per+'-001']&&g.tg_70001['titan-'+per+'-01']&&g.tg_70002['titan-'+per+'-001']&&!g.tg_70003?.['titan-'+per+'-001'],'#1 and #2 of the verified ranking get the Moonheart (and the Selenite)');
 const before=JSON.stringify(db.root.cqgr);await BD.settleBoard(env,'titan',per,now+60000);await BD.settleBoards(env,now+120000);ok(JSON.stringify(db.root.cqgr)===before&&db.get('cqbs/titan/'+per).granted,'settled twice (and the cron again): the same winners, no new grant');}
{const per='p'+(Math.floor(now/DAY/30)-3);await seed('titan30',per,5000);await BD.settleBoard(env,'titan30',per,now);const n=Object.values(db.root.cqgr).filter(x=>x['titan30-'+per+'-001']).length;ok(n===3,'the 30-day Titan board of 5,000: 2 Moonheart to 3 pilots (the cap)');}
{const per='w'+(wk-3);await seed('campaign',per,40,{tie:true});await BD.settleBoard(env,'campaign',per,now);const w=db.get('cqbs/campaign/'+per).w.map(x=>x[0]);ok(w.length===4&&w.join()==='tg_70000,tg_70001,tg_70002,tg_70003','equal scores: the first to reach the score ranks first (4 of 40 in the 10% band)');}
// ---- 5. the grant, applied once at the session open, the table's amounts ----
{const P=70001,pid='tg_'+P;await call(P,'/api/sync');const r1=await call(P,'/api/conquest/session');const s1=cqLive(db,pid);
 ok(r1.status===200&&s1.gra?.length>=2&&!Object.keys(db.get('cqgr/'+pid)||{}).length&&r1.state.notice?.kind==='board-reward','5. the session open applies the pilot\'s grants once (ids kept), clears the inbox, says so');
 const W=db.get('eco/'+pid)?.mn||{};ok((W.se|0)>=1&&(W.mh|0)>=1&&!(s1.ledger.mn?.se|0),'the minerals reach the account wallet through the outbox (1 Selenite, 1 Moonheart: banked, never carried cargo)');
 const per='w'+(wk-3),pidC='tg_70000',gid='campaign-'+per+'-01';await call(70000,'/api/sync');await call(70000,'/api/conquest/session');const cp0=cqLive(db,pidC).ledger.cp;
 ok((cqLive(db,pidC).gra||[]).includes(gid),'the campaign board\'s winner got its grant (applied at its session open)');
 db.root.cqgr=db.root.cqgr||{};db.root.cqgr[pidC]={[gid]:{k:'campaign',per,pct:0.1,cp:1500}};await call(70000,'/api/conquest/session');ok(cqLive(db,pidC).ledger.cp===cp0&&!Object.keys(db.get('cqgr/'+pidC)||{}).length,'the same grant written again: nothing paid twice (the id was applied), the inbox cleared');
 db.root.cqgr[pidC]={['campaign-'+per+'-001']:{k:'campaign',per,pct:0.01,cp:999999},['town-w'+(wk-1)+'-01']:{k:'town',per:'w'+(wk-1),pct:0.1,cp:1500},junk:{k:'x'}};await call(70000,'/api/conquest/session');
 ok(cqLive(db,pidC).ledger.cp===cp0&&!Object.keys(db.get('cqgr/'+pidC)||{}).length,'grants not in a settlement record (a band it did not win, a board where it is not listed, junk): unpaid and cleared');
 const P2='tg_70001',g2='titan-w'+(wk-2)+'-01';ok((cqLive(db,P2).gra||[]).includes(g2),'a Titan winner\'s grant was verified against the settlement record and applied');}
console.log(JSON.stringify({test:'conquest-boards',pass}));
