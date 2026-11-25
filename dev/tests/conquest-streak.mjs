// Session 7T (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md) decision 11, the soft return streak (the Nov 10 brief C, extended by the
// owner on Nov 22): days with a verified Conquest activity (an operation won or a harvest), two freeze days a week so a missed day never
// resets it, day 1 Repair Kit, day 3 Scanner Charge, day 7 banner emblem, day 30 town decoration, a new earn-only emblem every 30 days
// from day 60 to 360, special decorations on days 100 and 365; never points or minerals. The Worker grants it; the hub shows one line.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Town:TN,Catalog:CAT}=CONQUEST;
const {createState,applyAction}=await import('../../worker/src/conquest-sim.js');const {earn}=await import('../../worker/src/conquest-airdrop.js');
const {townPilot}=await import('./lib/town-helpers.mjs');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};const D=864e5,H=36e5;
const mon=Date.UTC(2026,10,23,12),dayOf=t=>Math.floor(t/D);   // Monday Nov 23
// ---- 1. the day rule (pure) ----
{let st={},r;const play=d=>{r=TN.streakDay(st,d);st=r.st;return r;};const d0=dayOf(mon);
 play(d0);play(d0+1);ok(r.days===2,'two days in a row: a 2-day streak');ok(play(d0+1).days===2,'the same day twice counts once');
 play(d0+3);ok(r.days===3&&r.frozen===1&&r.st.fz===1,'one missed day is covered by a freeze day (no reset): 3 days');
 play(d0+5);ok(r.days===4&&r.st.fz===2,'a second missed day in the week (Friday): the second freeze day');
 play(d0+6);const wk=r.st.wk;play(d0+8);ok(r.days===6&&r.st.wk!==wk&&r.frozen===1&&r.st.fz===1,'a new week brings two fresh freeze days (the missed Monday is covered)');
 let s2={};const p2=d=>{const x=TN.streakDay(s2,d);s2=x.st;return x;};p2(d0);p2(d0+1);const gap=p2(d0+5);ok(gap.days===1,'three missed days in one week: the streak starts again at 1');
 ok(TN.STREAK.freezes===2,'two freeze days a week');}
// ---- 2. the milestones ----
{const R2=TN.STREAK.rewards,at=d=>R2.filter(x=>x.d===d);ok(at(1)[0]?.it==='repair'&&at(3)[0]?.it==='scanner'&&at(7)[0]?.em==='streak7'&&at(30)[0]?.dc==='beacon30','day 1 Repair Kit, day 3 Scanner Charge, day 7 banner emblem, day 30 town decoration');
 const em=R2.filter(x=>x.em&&x.d>=60).map(x=>x.d);ok(em.join()===[60,90,120,150,180,210,240,270,300,330,360].join(),'a new earn-only banner emblem every 30 days from 60 to 360 ('+em.length+')');
 ok(at(100).some(x=>x.dc==='monument100')&&at(365).some(x=>x.dc==='monolith365'),'special town decorations on days 100 and 365');
 ok(R2.every(x=>!('pts' in x)&&!('mn' in x)&&!('cp' in x)&&(x.it||x.em||x.dc)),'never points, minerals or CP: only consumables and cosmetics');
 for(const [k,a] of Object.entries(TN.STREAK_ART.emblems))ok(a.n&&a.glyph,'emblem '+k+' has its art hook ('+a.n+', stand-in '+a.glyph+')');
 for(const [k,a] of Object.entries(TN.STREAK_ART.decor)){const i=CAT.byId[a.item];ok(i&&i.earnOnly&&i.proposedUsd===null&&i.slot==='base','decoration '+k+' is the earn-only town ornament '+a.item+' (never sold)');}}
// ---- 3. the Worker grants it on the day's first verified activity, never otherwise ----
{let s=createState(R.STOCK_L,mon);s.inv=null;let t=mon;
 s=applyAction(s,{seq:s.seq+1,action:'war-seen'},t);ok(!s.stk?.n,'no verified activity: no streak day (opening the game is not enough)');
 const pts0=()=>s.airdrop?.pend?.raw||0,cp0=s.ledger.cp,mn0=JSON.stringify(s.ledger.mn||{});
 earn(s,'field',100,t,{op:true});const before=pts0();s=applyAction(s,{seq:s.seq+1,action:'war-seen'},t+1000);
 ok(s.stk.n===1&&s.stk.nw.d===dayOf(t)&&s.inv.it.repair>=1&&s.stk.nw.r?.[0]?.it==='repair','an operation won: day 1, a Repair Kit');
 ok(pts0()===before&&s.ledger.cp===cp0&&JSON.stringify(s.ledger.mn||{})===mn0,'the reward is never points, CP or minerals');
 const kits=s.inv.it.repair;s=applyAction(s,{seq:s.seq+1,action:'war-seen'},t+2000);ok(s.stk.n===1&&s.inv.it.repair===kits,'the same day again: nothing more');
 for(let d=1;d<=6;d++){t=mon+d*D;earn(s,'field',100,t,{act:true});s=applyAction(s,{seq:s.seq+1,action:'war-seen'},t);}
 ok(s.stk.n===7&&s.inv.it.scanner>=1&&s.stk.got['7']===1,'a harvest counts too: 7 days, a Scanner Charge on day 3 and the day-7 emblem');
 s.inv.it.repair=R.CQ_ITEM_MAX;const s1=structuredClone(s);s1.stk={...TN.streakNorm(s1.stk),n:0,got:{}};s1.stk.last=0;earn(s1,'field',100,t+D,{op:true});const g=applyAction(s1,{seq:s1.seq+1,action:'war-seen'},t+D);ok(g.inv.it.repair===R.CQ_ITEM_MAX,'consumables never pass their cap (Repair Kit at '+R.CQ_ITEM_MAX+')');
 const dev=structuredClone(s);dev.dev={used:1};earn(dev,'field',100,t+D,{op:true});const dv=applyAction(dev,{seq:dev.seq+1,action:'war-seen'},t+D);ok(dv.stk.n===7,'an owner dev-mode record never counts');}
// ---- 4. the banner emblem is earn-only; the decoration is earned at its day ----
{const t=mon;let s=townPilot(CONQUEST,R,createState,t,{cc:2});const ban=e=>applyAction(structuredClone(s),{seq:s.seq+1,action:'plot-banner',plot:{shape:'shield',colors:['#112233','#ddeeff'],emblem:e}},t);
 assert.throws(()=>ban('streak7'),/earned on the return streak/);ok(true,'the day-7 emblem cannot be set before day 7');
 s.stk={n:7,last:dayOf(t),wk:TN.weekOf(dayOf(t)),fz:0,best:7,got:{1:1,3:1,7:1}};const b=ban('streak7');ok(b.plot.banner.emblem==='streak7','reached: it goes on the town banner');
 assert.throws(()=>ban('streak60'),/earned on the return streak/);ok(true,'a later emblem stays locked');
 s.stk={n:1,last:dayOf(t)+20,wk:TN.weekOf(dayOf(t)+20),fz:0,best:7,got:{1:1}};ok(ban('streak7').plot.banner.emblem==='streak7','review B4: after the streak resets, the day-7 emblem is still yours (kept by the best streak)');
 ok(!CAT.eligible('streak-beacon30',s)&&CAT.eligible('streak-beacon30',{...s,stk:{...s.stk,best:30}})&&CAT.eligible('streak-monolith365',{stk:{best:365}}),'the Day-30 Signal Beacon is earned at 30 days, the Day-365 Monolith at 365');}
// ---- 5. the hub's one line ----
{const d0=dayOf(mon);let st={};for(let d=0;d<4;d++)st=TN.streakDay(st,d0+d).st;const L=TN.streakLine(st,d0+3),L2=TN.streakLine(st,d0+4);
 ok(L.n===4&&L.today&&/STREAK 4 DAYS · TODAY ✓ · DAY 7: BANNER EMBLEM/.test(L.text),'today played: '+L.text);ok(L2.n===4&&!L2.today&&/PLAY TODAY/.test(L2.text)&&/2 FREEZES LEFT/.test(L2.text),'tomorrow: '+L2.text);
 ok(TN.streakLine(st,d0+9).n===0,'after a long break the line shows 0 (it starts again on the next play)');}
// review R2-B2: each milestone once per pilot: breaking the streak on purpose never farms its consumables
{let st={},got=0;const d0=dayOf(mon);for(let w=0;w<8;w++)for(let d=0;d<3;d++){const r=TN.streakDay(st,d0+w*7+d);st=r.st;got+=r.rewards.filter(x=>x.it).length;}
 ok(got===2,'3 days on and 4 off for 8 weeks: '+got+' consumables (the day-1 and day-3 ones, once)');
 // review (round 2): after a reset the hub's line never promises a milestone already given (8 days played, then back on day 20)
 let s2={};for(let d=0;d<8;d++)s2=TN.streakDay(s2,d0+d).st;s2=TN.streakDay(s2,d0+20).st;const L3=TN.streakLine(s2,d0+20);
 ok(L3.n===1&&L3.next?.d===30&&/DAY 30: TOWN DECORATION/.test(L3.text),'after a reset the line names the next milestone not yet given: '+L3.text);}
// review R2 note: a day whose verified activity came through the world's commands (an operation won, a harvest: both are paid inside
// applyCommands) counts on that request, with no action after it (a pilot who wins one operation and leaves)
{const {applyCommands}=await import('../../worker/src/conquest-sim.js');const s=createState(R.STOCK_L,mon);s.inv=null;const t=mon+3600000;
 earn(s,'field',100,t-1000,{op:true});   // the win, paid earlier in the same request's frames
 const c=applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0}]},t);ok(c.stk?.n===1&&c.stk.nw?.d===dayOf(t),'a day won through the world\'s commands counts on that request, with no action after it');
 const c2=applyCommands(c,{seq:c.seq+1,commands:[{x:0,z:0}]},t+60000);ok(c2.stk.n===1&&c2.inv.it.repair===c.inv.it.repair,'... once a day (the next command request adds nothing)');}
// ---- Session 7T-P decision 4 (owner, Nov 23): welcome-back kits: back after 14 or more UTC days away (days with no verified activity),
// the day-1 Repair Kit and the day-3 Scanner Charge again, once a return; never points or minerals ----
{const d0=dayOf(mon),W=TN.STREAK.welcome;ok(W.away===14&&W.days.join()==='1,3','welcome back: after '+W.away+' days away, the day-'+W.days.join(' and day-')+' kits');
 const run=(st,days)=>{const got=[];let r;for(const d of days){r=TN.streakDay(st,d);st=r.st;got.push(...r.rewards.map(x=>({...x,day:d})));}return {st,got,r};};
 let a=run({},Array.from({length:7},(_,i)=>d0+i));ok(a.st.n===7&&a.st.got['1']&&a.st.got['3']&&a.st.got['7'],'a 7-day streak: every early milestone given');
 const last=d0+6,back=last+15;   // 14 full UTC days with no activity in between
 {const L=TN.streakLine(a.st,back);ok(L.back&&L.welcome&&/STREAK 0 DAYS · PLAY TODAY · WELCOME BACK · DAY 1: REPAIR KIT/.test(L.text),'review B3: back after 14 days, before the first win or harvest, the line names the kit that comes back: '+L.text);
  ok(!TN.streakLine(a.st,last+14).back,'13 days away: no pending welcome on the line');}
 let b=run(a.st,[back]);ok(b.r.back===1&&b.r.days===1&&b.got.length===1&&b.got[0].it==='repair'&&b.got[0].wb===1,'14 days away, then a verified day: WELCOME BACK, the day-1 Repair Kit again (streak day 1)');
 ok(TN.streakLine(b.st,back).welcome&&/STREAK 1 DAY · TODAY ✓ · WELCOME BACK · DAY 3: SCANNER CHARGE/.test(TN.streakLine(b.st,back).text),'the hub line on the return: '+TN.streakLine(b.st,back).text);
 let c=run(b.st,[back+1,back+2]);ok(c.got.length===1&&c.got[0].it==='scanner'&&c.got[0].wb===1&&c.got[0].day===back+2,'the return\'s third day: the day-3 Scanner Charge again');
 let e=run(c.st,Array.from({length:10},(_,i)=>back+3+i));ok(!e.got.length,'then nothing more on this return (the day-7 emblem was already earned: never twice)');
 ok(!TN.streakLine(c.st,back+3).welcome,'the line stops saying WELCOME BACK once both kits are given');
 let n13=run(a.st,[last+14]);ok(n13.r.back===0&&!n13.got.length,'13 days away: no welcome-back kits (the streak restarts, every milestone already given)');
 let again=run(e.st,[back+12+15]);ok(again.r.back===1&&again.got.length===1&&again.got[0].it==='repair'&&again.got[0].wb===1,'away 14 days again: the next return re-grants again (once a return)');
 let same=run(again.st,[back+12+15]);ok(!same.got.length&&same.r.back===0,'the same return day twice: once');
 // a pilot whose first streak never reached day 3: the return re-grants the day-1 kit; the day-3 kit, never given, comes as the plain milestone
 let f=run({},[d0,d0+1]);let g=run(f.st,[d0+1+15,d0+17,d0+18]);ok(g.got.length===2&&g.got[0].wb===1&&g.got[1].it==='scanner'&&!g.got[1].wb,'never reached day 3 before: the return re-grants the day-1 kit; the day-3 kit is its first (no re-grant label)');
 // no farm: a pilot who plays one day and then stays away 14 days, all year, gets one Repair Kit a return (and never the day-3 kit)
 let st={},kits=0,scan=0;for(let d=d0;d<d0+365;d+=15){const r=TN.streakDay(st,d);st=r.st;for(const x of r.rewards){if(x.it==='repair')kits++;if(x.it==='scanner')scan++;}}
 ok(kits===25&&scan===0,'one day every 15 days for a year: '+kits+' Repair Kits and '+scan+' Scanner Charges (one kit a return; a daily pilot\'s kill caches drop about one consumable a day: LOOT mob 4% and elite 8% an item); never points or minerals');
 ok(TN.STREAK.rewards.filter(r=>W.days.includes(r.d)).every(r=>r.it&&!('pts' in r)&&!('mn' in r)&&!('cp' in r)),'the welcome-back kits are the day-1 and day-3 consumables only');}
// ... and the Worker grants them on the return's first verified activity, never points, CP or minerals; an owner dev record never counts
{let s=createState(R.STOCK_L,mon);s.inv=null;const d0=dayOf(mon);
 for(let d=0;d<7;d++){const t=mon+d*D;earn(s,'field',100,t,{op:true});s=applyAction(s,{seq:s.seq+1,action:'war-seen'},t);}
 const kits=s.inv.it.repair|0,scans=s.inv.it.scanner|0,t=mon+(6+15)*D;earn(s,'field',100,t,{op:true});const pts=s.airdrop?.pend?.raw||0,cp=s.ledger.cp,mn=JSON.stringify(s.ledger.mn||{});
 const dv=structuredClone(s);s=applyAction(s,{seq:s.seq+1,action:'war-seen'},t);
 ok(s.stk.n===1&&s.stk.nw.wb===1&&s.stk.nw.r?.[0]?.it==='repair'&&s.stk.nw.r[0].wb===1&&s.inv.it.repair===Math.min(R.CQ_ITEM_MAX,kits+1),'the Worker: back after 14 days away, a verified day re-grants the Repair Kit (nw.wb, the kit marked wb)');
 ok((s.airdrop?.pend?.raw||0)===pts&&s.ledger.cp===cp&&JSON.stringify(s.ledger.mn||{})===mn,'... and gives no points, CP or minerals');
 for(let d=1;d<=2;d++){const t2=t+d*D;earn(s,'field',100,t2,{act:true});s=applyAction(s,{seq:s.seq+1,action:'war-seen'},t2);}
 ok(s.stk.n===3&&s.inv.it.scanner===Math.min(R.CQ_ITEM_MAX,scans+1)&&s.stk.nw.r?.[0]?.wb===1,'... and on the return\'s third day the Scanner Charge');
 dv.dev={used:1};const dd=applyAction(dv,{seq:dv.seq+1,action:'war-seen'},t);ok(dd.stk.n===7&&!dd.stk.nw?.wb,'an owner dev-mode record never gets them');}
console.log('PASS soft return streak (decision 11) and welcome-back kits (7T-P decision 4): '+pass+' checks');
