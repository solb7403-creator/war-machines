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
 ok(got===2,'3 days on and 4 off for 8 weeks: '+got+' consumables (the day-1 and day-3 ones, once)');}
console.log('PASS soft return streak (decision 11): '+pass+' checks');
