// Session 7C STEP 4 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md; blueprint §7 "The shared war"; owner, Nov 24): the weekly War
// Effort bar, through the real Worker code (fake Firebase with ETags): the shared warfront document's weekly count (every verified
// campaign point, each pilot up to two quotas), the population-normalized goal (active pilots x quota x 0.6), zero pilots idle, the
// week rollover, squads on summed contribution (the top squad's name and banner, never a pilot id), the rewards once per pilot and week
// (a won week's crate: 2 Repair Kits + 1 Scanner Charge, its cosmetic tier; the top squad's fragment; never CP, salvage or points),
// High Morale (+1 DEFENSE on every territory, the war rules' morale part) the week after a win, a loss takes nothing; the real session
// route pays them through the record.
import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {makeDB} from './fakedb.mjs';import {buildSim} from '../../../worker/build-sim.mjs';
buildSim();const db=makeDB({});globalThis.fetch=async(url,init={})=>{if(!String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/'))throw Error('Unexpected external request');return db.handle(url,init);};
const {default:worker}=await import('../../../worker/src/index.js');const {RULES:R,CONQUEST}=await import('../../../worker/src/sim.gen.js');const {WarEffort:WE,War:WR,Catalog:CAT}=CONQUEST;
const {syncWarfront,applyWarfront,weDue}=await import('../../../worker/src/conquest-warfront.js');const {ctxOf}=await import('../../../worker/src/conquest-war.js');const {createState}=await import('../../../worker/src/conquest-sim.js');const {cqLive}=await import('./cqlive.mjs');
const env={BOT_TOKEN:'we-test',FIREBASE_DB_SECRET:'SECRET'},DAY=86400000;let now=Date.UTC(2026,10,25,12);Date.now=()=>now;let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id,first_name:'Pilot'+id})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gv:R.PVP_V,initData:auth(id),...body})}),env);const t=await r.text();return {status:r.status,...(t.startsWith('{')?JSON.parse(t):{error:t})};}
const Q=WE.WE.quota;
// ---- 1. the rules ----
ok(WE.goalOf(0)===0&&WE.goalOf(1)===Math.round(Q*.6)&&WE.goalOf(40)===Math.round(40*Q*.6)&&WE.WE.share===.6,'1. the goal: active pilots x the quota ('+Q+') x 0.6; none with zero pilots');
ok(WE.counted(10*Q)===2*Q&&WE.counted(37)===37,'a pilot counts up to two quotas');
{const v=WE.view(null,now);ok(v.now.n===0&&v.now.goal===0&&!v.now.won&&v.hm===0&&v.last===null,'zero pilots: the bar idles (no goal, never won, no High Morale), nothing throws');}
ok(JSON.stringify(WE.WE.crate)==='{"repair":2,"scanner":1}'&&WE.WE.tiers.join()==='1,1.5,2','a won week: the crate 2 Repair Kits + 1 Scanner Charge; tiers at 100% / 150% / 200%');
// ---- 2. the shared document's week ----
const wk=WE.weekOf(now);db.root.players={tg_2:{ref:'tg_1'},tg_3:{ref:'tg_1'},tg_5:{ref:'tg_4'}};db.root.cqbase={tg_1:{n:'Squadleader',bn:{shape:'shield',colors:['#112233','#ffd96a']}},tg_4:{n:'Other'}};
{const add=async(pid,total,squad)=>syncWarfront(env,pid,total,now,{squad});
 await add('tg_1',100,'tg_1');await add('tg_2',150,'tg_1');await add('tg_3',600,'tg_1');await add('tg_4',90,'tg_4');await add('tg_5',40,'tg_4');let v=await add('tg_6',20,'tg_6');
 const doc=db.get('conquestWarfront/frontier-v1'),W=doc.we;ok(W.w===wk&&W.n===6&&W.score===100+150+2*Q+90+40+20&&W.c.tg_3===600,'2. six pilots this week: counted '+W.score+' (tg_3\'s 600 counts two quotas, '+2*Q+')');
 ok(v.we.now.n===6&&v.we.now.goal===WE.goalOf(6)&&v.we.now.won===(W.score>=WE.goalOf(6)),'the view: '+v.we.now.score+' / '+v.we.now.goal+' with 6 pilots');
 ok(W.sq.tg_1===100+150+2*Q&&W.sqn.tg_1===3&&W.sq.tg_4===130&&W.sqn.tg_6===1,'squads sum their members\' counted contribution (tg_1\'s squad of 3: '+W.sq.tg_1+')');
 await add('tg_2',150,'tg_1');ok(db.get('conquestWarfront/frontier-v1').we.score===W.score,'a pilot whose score did not rise adds nothing (the lifetime watermark)');
 // the next week: the old week becomes last week, with its result and the top squad's name and banner (no pilot id)
 now+=7*DAY;v=await add('tg_7',30,'tg_7');const d2=db.get('conquestWarfront/frontier-v1');
 ok(d2.we.w===wk+1&&d2.we.n===1&&d2.prev.w===wk&&d2.prev.top.id==='tg_1'&&d2.prev.top.n==='Squadleader'&&d2.prev.top.bn?.shape==='shield','3. the week rolls over: last week kept (its top squad tg_1\'s, with its leader\'s name and banner)');
 ok(v.we.last.w===wk&&v.we.last.won&&v.we.hm===1&&v.monument.banner?.shape==='shield'&&v.we.last.top.n==='Squadleader','last week won: High Morale this week, the banner at the monument');
 ok(!JSON.stringify(v).includes('tg_')&&v._top==='tg_1','no pilot id in the public view (the top squad\'s leader id stays a hidden Worker property)');}
// ---- 4. the rewards, once, through the record ----
{const v=await syncWarfront(env,'tg_8',0,now,{squad:'tg_8'});const s=createState(R.STOCK_L,now);s.wep={w:wk,c:250};s.inv.it.repair=9;const cp=s.ledger.cp,bank=JSON.stringify(s.ledger.banked);
 const war={...v,we:{...v.we,mine:1}};ok(weDue(s,war),'4. a contributor of the won week is due its rewards');
 applyWarfront(s,war,now);ok(s.inv.it.repair===10&&s.inv.it.scanner===1&&s.wet===v.we.last.tier&&s.wep.paid===1&&s.wep.sq===1&&(s.inv.fr.u|0)>=1&&s.notice?.kind==='war-effort','the crate (Repair Kits up to the cap of 10, the Scanner Charge), the tier\'s cosmetic (tier '+s.wet+'), the squad\'s uncommon fragment, a notice');
 ok(s.ledger.cp===cp&&JSON.stringify(s.ledger.banked)===bank&&!(s.airdrop?.pend?.raw>0),'never CP, salvage or points');
 const inv=JSON.stringify(s.inv);applyWarfront(s,war,now+1000);ok(JSON.stringify(s.inv)===inv&&!weDue(s,war),'once: a second application pays nothing');
 const t=createState(R.STOCK_L,now);t.wep={w:wk,c:0};applyWarfront(t,war,now);ok(!(t.inv.it.scanner|0)&&!t.wet,'a pilot who did not contribute that week: nothing');
 const lost={...war,we:{...war.we,last:{...war.we.last,won:false,tier:0},hm:0,mine:0}},u=createState(R.STOCK_L,now);u.wep={w:wk,c:300};const before=JSON.stringify(u.inv);applyWarfront(u,lost,now);ok(JSON.stringify(u.inv)===before&&!u.wet,'a lost week takes nothing and pays no crate');
 ok(CAT.items.filter(i=>i.earn?.we).map(i=>i.id).join()==='we-standard,we-trail,we-monument'&&CAT.eligible('we-trail',{wet:2})&&!CAT.eligible('we-monument',{wet:2}),'the cosmetic reward tiers: three earn-only pieces, unlocked by the tier reached');}
// ---- 5. High Morale: +1 DEFENSE on every territory, only the week after a win ----
{const s=createState(R.STOCK_L,now),v=await syncWarfront(env,'tg_9',0,now,{squad:'tg_9'});applyWarfront(s,v,now);const id=WR.TERRITORIES.find(t=>s.war.o[t.id]==='h')?.id;
 const d1=WR.defenseOf(s.war,id,ctxOf(s,now)),d0=WR.defenseOf(s.war,id,{...ctxOf(s,now),morale:0});ok(ctxOf(s,now).morale===1&&d1.total-d0.total===1&&d1.parts.some(p=>p.k==='morale'&&p.v===1),'5. High Morale: the war rules\' "Shared-war morale" part +1 DEFENSE on '+id);
 ok(ctxOf(s,now+7*DAY).morale===0,'... only that week');}
// ---- 6. the real session route pays them (and the reply shows them once) ----
{const P=31,pid='tg_31';await call(P,'/api/sync');await call(P,'/api/conquest/session');const st=cqLive(db,pid);st.wep={w:wk,c:180};st.wkb={w:wk+1,cs:st.campaignScore|0};db.root.conquest[pid]=st;
 const r=await call(P,'/api/conquest/session'),after=cqLive(db,pid);ok(r.status===200&&after.wep.paid===1&&(after.inv.it.scanner|0)>=1&&r.state.notice?.kind==='war-effort'&&r.state.warfront?.we?.hm===1,'6. the session open: the record pays the won week\'s crate through the route (persisted), the reply shows it and High Morale');
 const r2=await call(P,'/api/conquest/session'),again=cqLive(db,pid);ok(again.inv.it.scanner===after.inv.it.scanner&&again.inv.it.repair===after.inv.it.repair,'... once (the next session open pays nothing)');}
console.log(JSON.stringify({test:'conquest-wareffort',pass}));
