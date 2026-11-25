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
 applyWarfront(s,war,now);ok(s.inv.it.repair===10&&s.inv.it.scanner===1&&s.wet===v.we.last.tier&&s.wep.paid===1&&(s.wsq||[]).includes(wk)&&(s.inv.fr.u|0)>=1&&s.notice?.kind==='war-effort','the crate (Repair Kits up to the cap of 10, the Scanner Charge), the tier\'s cosmetic (tier '+s.wet+'), the squad\'s uncommon fragment, a notice');
 ok(s.ledger.cp===cp&&JSON.stringify(s.ledger.banked)===bank&&!(s.airdrop?.pend?.raw>0),'never CP, salvage or points');
 const inv=JSON.stringify(s.inv);applyWarfront(s,war,now+1000);ok(JSON.stringify(s.inv)===inv&&!weDue(s,war),'once: a second application pays nothing');
 const t=createState(R.STOCK_L,now);t.wep={w:wk,c:0};const fr0=t.inv.fr?.u|0;applyWarfront(t,war,now);ok(!(t.inv.it.scanner|0)&&!t.wet&&(t.inv.fr.u|0)===fr0+1,'a member of the top squad who did not contribute: no crate and no tier, but the squad\'s fragment (the brief: "each member gets a fragment"; review round 1)');
 const fr1=t.inv.fr.u|0;applyWarfront(t,war,now+1000);ok((t.inv.fr.u|0)===fr1,'... once a week');
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
// ---- 7. review round 1 (rule reviewer 1, rules 12 and 13; each fails without its fix) ----
{const {pilotWar}=await import('../../../worker/src/conquest-warfront.js');const w0=await syncWarfront(env,'tg_40',0,now,{squad:'tg_40'}),top=w0._top;
 ok(pilotWar(w0,top,'tg_99',null).we.mine===1&&pilotWar(w0,'tg_2',top,null).we.mine===1&&pilotWar(w0,'tg_41','tg_41',null).we.mine===0,'7. the top squad\'s leader is a member of its own squad (its banner flies; it was counted in its recruiter\'s), its recruits too, nobody else');
 // a pilot who contributed to a won week, made no request the week after and returns the week after that still settles it
 const W=WE.weekOf(now),doc=db.get('conquestWarfront/frontier-v1');ok(doc.hist&&doc.hist[W-1]&&doc.hist[W-1].top?.id===top,'every finished week is kept on the document (8 weeks) with its top squad');
 now+=14*DAY;const P=41,pid='tg_41';await call(P,'/api/sync');await call(P,'/api/conquest/session');let st=cqLive(db,pid);st.wep={w:W-1,c:200};st.wkb={w:W+2,cs:st.campaignScore|0};delete st.wsq;db.root.conquest[pid]=st;
 const r=await call(P,'/api/conquest/session'),after=cqLive(db,pid);ok(r.status===200&&after.wep.paid===1&&(after.inv.it.scanner|0)>=1&&after.wet>=1&&r.state.warfront?.we?.past?.w===W-1&&r.state.warfront.we.last?.w!==W-1,'a pilot away the week after a won week, back a week later: its crate and tier are paid from the week kept on the document');
 const again=await call(P,'/api/conquest/session');ok((cqLive(db,pid).inv.it.scanner|0)===(after.inv.it.scanner|0),'... once');}
// ---- 8. review round 2 (rule reviewer 1: rule 13 and note 1; each fails without its fix) ----
{const {pilotWar}=await import('../../../worker/src/conquest-warfront.js');let t=now+21*DAY;const W=WE.weekOf(t);
 db.root.players={...db.root.players,tg_51:{ref:'tg_50'},tg_52:{ref:'tg_51'},tg_54:{ref:'tg_53'},tg_55:{ref:'tg_53'},tg_56:{ref:'tg_51'}};
 // tg_50 recruited tg_51; tg_51 recruited tg_52 (and tg_56, who does not play that week); tg_53 recruited tg_54 and tg_55
 for(const [pid,total,squad] of [['tg_51',300,'tg_50'],['tg_52',100,'tg_51'],['tg_53',150,'tg_53'],['tg_54',150,'tg_53'],['tg_55',50,'tg_53']])await syncWarfront(env,pid,total,t,{squad});
 const we=db.get('conquestWarfront/frontier-v1').we;ok(we.w===W&&we.sq.tg_51===400&&we.sqn.tg_51===2&&we.sq.tg_53===350&&WE.topSquad(we).id==='tg_51','8. a recruited leader counts in its own squad too: tg_51 (300) + its recruit (100) = 400 beats tg_53\'s 350 (it counted only in its recruiter\'s before)');
 // nobody contributes the week after; two weeks later the document still holds week W open (it never rolled): it counts as finished
 t+=14*DAY;const w0=await syncWarfront(env,'tg_99',0,t,{squad:'tg_99'});const mk=(wep)=>{const x=createState(R.STOCK_L,t);if(wep)x.wep=wep;return x;};
 const a=mk({w:W,c:100}),ra=pilotWar(w0,'tg_52','tg_51',a,t);applyWarfront(a,ra,t);ok(ra.we.past?.w===W&&ra.we.past.won&&a.wep.paid===1&&(a.inv.it.scanner|0)===1&&(a.wsq||[]).includes(W),'a won week nobody rolled over (no contribution since) still settles: the crate and the squad fragment');
 const L=mk({w:W,c:300}),rl=pilotWar(w0,'tg_51','tg_50',L,t);applyWarfront(L,rl,t);ok((L.inv.it.scanner|0)===1&&(L.wsq||[]).includes(W),'the leader whose banner flies: its crate and its squad\'s fragment');
 const m=mk(null),fr0=m.inv.fr?.u|0,rm=pilotWar(w0,'tg_56','tg_51',m,t);applyWarfront(m,rm,t);ok((rm.we.sqw||[]).includes(W)&&(m.inv.fr.u|0)===fr0+1&&!(m.inv.it.scanner|0),'a member who played neither that week nor the week after: the fragment when it returns (no crate)');
 const fr1=m.inv.fr.u|0;applyWarfront(m,pilotWar(w0,'tg_56','tg_51',m,t),t+1000);const o=mk({w:W,c:50});applyWarfront(o,pilotWar(w0,'tg_55','tg_53',o,t),t);
 ok((m.inv.fr.u|0)===fr1&&(o.inv.it.scanner|0)===1&&!(o.wsq||[]).length,'... once; a contributor of the other squad gets the crate of the won week and no fragment');}
console.log(JSON.stringify({test:'conquest-wareffort',pass}));
