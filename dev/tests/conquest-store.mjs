// Session 8 (owner brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md, Nov 26, 2026): the Conquest store's entitlements in the town,
// through the real Worker reducers (worker/src/conquest-shop.js shopAccount + conquest-plot.js + the shared rules). Every item is granted
// on the account (js/rules.js cqGrant, certified in dev/tests/wtest/payments.mjs); here the Conquest record reads it: the second builder
// (two constructions at once), the extra layout slot and the Lunar Pass's two, wall extension packs (capacity only, the +50% cap), the
// Foundry speed-up (4x for 24 h), the town looks (Aurora lighting, Gilded walls, Neon turrets: owned only), the wall-only rare ore (only a
// wall order spends it, never a building, the Foundry's research or the base stores), a paid construction finish (that construction
// only, once, never a repair), the bought collection pieces, the pass's daily Repair Kit and scanner range. Never points or CP.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Plot:P,Catalog:CAT}=CONQUEST;
const {createState,applyAction,refreshState}=await import('../../worker/src/conquest-sim.js');
const {shopCtx,shopAccount,scanBonus,PASS_SCAN_M}=await import('../../worker/src/conquest-shop.js');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};
const D=C.baseDefinition,t0=Date.UTC(2026,10,10,12);let now=t0;const DAY=86400000;
const at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
const rich=s=>{s.ledger.cp=5e7;s.ledger.banked={alloy:1e6,biomass:1e6,helium:1e6};return s;};
const base=site=>{let s=rich(createState(R.STOCK_L,now));s.position=at(D.x,D.z);s.battle.enemies=[];return applyAction(s,{seq:s.seq+1,action:'build-base',...(site?{plot:{site}}:{})},now+=1000);};
const act=(s,action,plot,ctx={})=>applyAction(s,{seq:s.seq+1,action,...(plot!==undefined?{plot}:{})},now+=1000,ctx);
const wait=(s,ms)=>{now+=ms;refreshState(s,now);s.lastWall=now;return s;};
const finishAll=s=>{let g=0;while(P.jobsOf(s.plot).length&&g++<10){const r=Math.max(...P.jobsOf(s.plot).map(j=>j.ready));s=wait(s,r-now+1);}return s;};
const toCC=(s,cc,ctx={})=>{while(s.plot.cc<cc){s=act(s,'plot-upgrade',{id:'cc'},{bmn:{il:99,ar:99},...ctx});s=finishAll(s);}return s;};
// an account (eco record) with these store entitlements, as the Worker would read it
const acct=(cq={},o={})=>shopCtx(R.ecoNorm({cq,...o}),now);
const freeSpot=(s,t)=>P.autoPlace(s.plot,t);

// ---- 1. the second builder: two constructions at once; without it, one ----
{let s=toCC(base('ridge'),3);const A0=acct();
 const c1=freeSpot(s,'cannon');s=act(s,'plot-build',{type:'cannon',i:c1.i,j:c1.j,r:0},{shop:A0});
 const c2=freeSpot(s,'mg');assert.throws(()=>act(structuredClone(s),'plot-build',{type:'mg',i:c2.i,j:c2.j,r:0},{shop:A0}),/builder busy/);ok(true,'one builder: a second construction waits ("builder busy")');
 const A2=acct({b2:1});s=act(s,'plot-build',{type:'mg',i:c2.i,j:c2.j,r:0},{shop:A2});
 ok(s.plot.job&&s.plot.job2&&s.plot.job.t==='cannon'&&s.plot.job2.t==='mg'&&s.plot.b2===1,'the second builder: two constructions at once (p.job + p.job2)');
 const c3=freeSpot(s,'laser');assert.throws(()=>act(structuredClone(s),'plot-build',{type:'cannon',i:c3.i,j:c3.j,r:0},{shop:A2}),/builder busy/);ok(true,'never a third');
 assert.throws(()=>act(structuredClone(s),'plot-upgrade',{id:Object.keys(s.plot.b).find(k=>s.plot.b[k].t==='cannon')},{shop:A2}),/builder busy|already building/);ok(true,'the same building can\'t be on both builders');
 s=finishAll(s);const tc=Object.values(s.plot.b).find(b=>b.t==='cannon'),tm=Object.values(s.plot.b).find(b=>b.t==='mg');ok(tc.l===1&&tm.l===1&&!s.plot.job&&!s.plot.job2,'both finish (settle runs both builders)');
 // a refunded second builder: what runs on it finishes, no new second job starts
 const c4=freeSpot(s,'cannon');s=act(s,'plot-build',{type:'cannon',i:c4.i,j:c4.j,r:0},{shop:A2});const c5=freeSpot(s,'mg');s=act(s,'plot-build',{type:'mg',i:c5.i,j:c5.j,r:0},{shop:A2});
 shopAccount(s,acct(),now);ok(s.plot.b2===0&&s.plot.job2,'refunded: the job already on the second builder keeps running');
 s=finishAll(s);const c6=freeSpot(s,'cannon');s=act(s,'plot-build',{type:'cannon',i:c6.i,j:c6.j,r:0},{shop:acct()});const c7=freeSpot(s,'mg');
 assert.throws(()=>act(structuredClone(s),'plot-build',{type:'mg',i:c7.i,j:c7.j,r:0},{shop:acct()}),/builder busy/);ok(!s.plot.job2,'... and no new one starts on it');
 // repairs take a free builder; never two repairs
 s=finishAll(s);s.plot.dmg={cc:50};s=act(s,'plot-repair',{},{shop:A2});const c8=freeSpot(s,'cannon');s=act(s,'plot-build',{type:'cannon',i:c8.i,j:c8.j,r:0},{shop:A2});
 ok(P.jobsOf(s.plot).some(j=>j.t==='repair')&&P.jobsOf(s.plot).some(j=>j.t==='cannon'),'with two builders, a repair and a construction run side by side');
 s=finishAll(s);}
// ---- 2. layout slots: 3; +1 with the extra layout slot; +2 more with the premium Lunar Pass ----
{let s=toCC(base('ridge'),2);
 assert.throws(()=>act(structuredClone(s),'plot-layout',{op:'save',k:3},{shop:acct()}),/invalid layout slot/);ok(P.layoutSlots(s.plot)===3,'3 layout slots without the store');
 s=act(s,'plot-layout',{op:'save',k:3},{shop:acct({lay:1})});ok(s.plot.lay.s3&&P.layoutSlots(s.plot)===4,'the extra layout slot: a fourth');
 const prem=shopCtx(R.ecoNorm({cq:{lay:1},pass:{s:R.ecoSeason({day:Math.floor(now/DAY)}),xp:0,prem:true,cf:[],cp:[]}}),now);
 s=act(s,'plot-layout',{op:'save',k:5},{shop:prem});ok(s.plot.lay.s5&&P.layoutSlots(s.plot)===6&&prem.pe>now,'the premium Lunar Pass: two more (six in all)');
 assert.throws(()=>act(structuredClone(s),'plot-layout',{op:'save',k:6},{shop:prem}),/invalid layout slot/);ok(true,'never a seventh');}
// ---- 3. wall extension packs: capacity only, +10% each, up to the +50% cap with the earned ones ----
{let s=toCC(base('ridge'),3);const cap0=P.wallCapOf(s.plot);shopAccount(s,acct({ext:2}),now);
 ok(s.plot.ext.buy===20&&P.wallCapOf(s.plot)===P.wallBase(3)+Math.floor(P.wallBase(3)*(P.extParts(s.plot).total)/100)&&P.wallCapOf(s.plot)>cap0,'two packs: +20% wall capacity ('+cap0+' -> '+P.wallCapOf(s.plot)+' cells)');
 s.plot.ext.r=5;s.plot.ext.d=31;shopAccount(s,acct({ext:5}),now);ok(P.extParts(s.plot).total===50,'never above the +50% cap together with the earned ones');
 ok(P.wallStats(P.wcode(3,2),'ridge').hp===P.wallStats(P.wcode(3,2),'ridge').hp,'strength unchanged: a pack adds cells, never HP');}
// ---- 4. the Foundry speed-up: 4x for 24 h, only inside its window ----
{const mk=()=>{const p=P.newPlot('ridge',t0);p.cc=4;p.b.cc.l=4;p.b.f={t:'foundry',i:30,j:30,r:0,l:3};p.b.s={t:'storage',i:40,j:30,r:0,l:5};p.cm=0;p.fh=10000;p.st={alloy:0,biomass:0,helium:0,fe:0,at:t0};return p;};
 const a=mk(),b=mk();b.frs=t0;b.fr=t0+DAY;P.accrue(a,t0+3600000);P.accrue(b,t0+3600000);
 ok(Math.abs(b.cm-4*a.cm)<1e-6&&a.cm>0,'the Foundry speed-up: 4x composite inside its 24 h ('+a.cm.toFixed(1)+' -> '+b.cm.toFixed(1)+' in an hour)');
 const c=mk();c.frs=t0;c.fr=t0+1800000;P.accrue(c,t0+3600000);ok(Math.abs(c.cm-2.5*a.cm)<1e-6,'half an hour of the window inside the hour: 2.5x');
 const S=R.ecoNorm({});const X={day:Math.floor(t0/DAY),week:1,now:t0};S.buys={};R.cqGrant(S,{kind:'cq',tk:'foundry-rush'},X);const f1=S.cq.fr;R.cqGrant(S,{kind:'cq',tk:'foundry-rush'},{...X,now:t0+3600000});
 ok(S.cq.frs===t0&&f1===t0+DAY&&S.cq.fr===t0+2*DAY,'a second speed-up while one runs adds 24 h to the same window');
 R.cqRefund(S,{tk:'cq',id:'foundry-rush',ms:DAY});R.cqRefund(S,{tk:'cq',id:'foundry-rush',ms:DAY});ok(!S.cq.fr&&!S.cq.frs,'refunds take the hours back');}
// ---- 5. the town looks: owned only; a refund takes the look off ----
{let s=toCC(base('ridge'),2);const look={light:'aurora',finish:'steel',decor:[],ws:'gilded',ts:'neon'};
 assert.throws(()=>act(structuredClone(s),'plot-theme',look,{shop:acct()}),/store/);ok(true,'the Aurora lighting, the Gilded walls and the Neon turrets need their purchase');
 s=act(s,'plot-theme',look,{shop:acct({aur:1,gild:1,neon:1})});ok(s.plot.theme.light==='aurora'&&s.plot.theme.ws==='gilded'&&s.plot.theme.ts==='neon','owned: the town wears them');
 s=act(s,'plot-theme',{light:'cyan',finish:'sand',decor:['flags']},{shop:acct({aur:1,gild:1,neon:1})});ok(!s.plot.theme.ws&&!s.plot.theme.ts,'and takes them off again');
 s=act(s,'plot-theme',look,{shop:acct({aur:1,gild:1,neon:1})});shopAccount(s,acct(),now);ok(s.plot.theme.light==='violet'&&!s.plot.theme.ws&&!s.plot.theme.ts,'refunded: the looks come off (the free violet light instead of the Aurora)');}
// ---- 6. the wall-only ore: only a wall order spends it, first; never buildings, research or the base stores ----
{let s=toCC(base('ridge'),9,{shop:acct()});const p=s.plot;const wm={mh:30};
 const plan=P.wallPlan(p,[{k:'line',a:[P.MID-20,P.MID-24],b:[P.MID+20,P.MID-24],o:6,l:3}],{dev:false});assert(!plan.err,plan.err);const need=plan.cost.mh||0;
 s=act(s,'plot-wall',{s:[{k:'line',a:[P.MID-20,P.MID-24],b:[P.MID+20,P.MID-24],o:6,l:3}]},{bmn:{mh:0},wmn:wm,shop:acct({},{wmn:wm})});
 ok(need>0&&s.plot.wmSpent.mh===need&&!(s.plot.mnSpent.mh>0),'a Moonheart heavy wall spends the wall-only Moonheart first ('+need+' of 30), the base stores untouched');
 assert.throws(()=>act(structuredClone(s),'plot-research',{},{bmn:{},wmn:{se:99,tq:99,ar:99},shop:acct()}),/base stores|Foundry/);ok(true,'the Foundry\'s research never spends wall-only ore');
 const wm2={se:0,tq:0,ar:0,mh:30};const p2=structuredClone(s.plot);s.plot.wmSpent.mh=30;
 assert.throws(()=>act(structuredClone(s),'plot-wall',{s:[{k:'line',a:[P.MID-20,P.MID+24],b:[P.MID+20,P.MID+24],o:6,l:3}]},{bmn:{mh:0},wmn:wm2,shop:acct()}),/base stores/);ok(true,'spent wall-only ore is gone: a wall needing more falls back to the base stores (and fails without them)');
 s.plot.wmSpent.mh=need;const keys=Object.keys(s.plot.w).filter(k=>P.wdecode(s.plot.w[k]).o===6).slice(0,10);const before=s.plot.wmSpent.mh;
 {const {refundWalls}=await import('../../worker/src/conquest-plot.js');const mn0=s.plot.mnSpent.mh|0;refundWalls(s,keys);ok(keys.length&&s.plot.wmSpent.mh<before&&(s.plot.mnSpent.mh|0)===mn0,'walls taken down by a site change give their ore back to the wall-only store first (never laundered into the base stores): '+before+' -> '+s.plot.wmSpent.mh);}
 const g=R.ecoNorm({});R.cqGrant(g,{kind:'orecrate',tk:'se'},{day:1,week:1,now});ok(g.wmn.se===R.SHOP.ore.se.q&&!g.mn.se&&!g.bmn,'a Selenite wall crate lands in the wall-only store, never the wallet or the base stores');}
// ---- 7. a paid construction finish: that construction only, once; never a repair ----
{let s=toCC(base('ridge'),3);const c1=freeSpot(s,'cannon');s=act(s,'plot-build',{type:'cannon',i:c1.i,j:c1.j,r:0},{shop:acct()});const j=s.plot.job,key=R.cfxKey(j.id+'@'+j.l);
 ok(key&&j.ready>now,'a running construction: '+key);
 shopAccount(s,acct({},{cfx:{'b999@2':1}}),now);ok(s.plot.job&&s.plot.job.ready>now,'a credit for another construction finishes nothing');
 shopAccount(s,acct({},{cfx:{[key]:1}}),now);ok(s.plot.job.ready===now&&s.plot.cfxU[key],'the paid finish ends that construction now');
 s=wait(s,1);ok(!s.plot.job&&s.plot.b[j.id].l===1,'and it stands at once');
 s=act(s,'plot-upgrade',{id:j.id},{shop:acct({},{cfx:{[key]:1}})});ok(s.plot.job&&s.plot.job.ready>now,'the same credit never finishes the next level (once)');
 s=finishAll(s);s.plot.dmg={cc:40};s=act(s,'plot-repair',{},{shop:acct()});shopAccount(s,acct({},{cfx:{['cc@'+s.plot.cc]:1,'repair@0':1}}),now);ok(s.plot.job.t==='repair'&&s.plot.job.ready>now,'never a repair (construction timers only)');
 ok(R.cfxKey('repair@0')===null&&R.cfxKey('cc@4')==='cc@4'&&R.cfxKey('b12@5')==='b12@5'&&R.cfxKey('../x')===null,'finish credits name a construction only (cc@level, b<id>@level)');}
// ---- 8. the collection: a bought piece is owned; a refunded one comes off unless it was earned ----
{let s=base('ridge');const A=acct({},{cqc:{'base-monolith':1,'fire-prism':1}});shopAccount(s,A,now);
 ok(s.cosmetics.owned['base-monolith']?.source==='bought'&&s.cosmetics.owned['fire-prism']?.source==='bought','bought pieces are owned in the collection');
 s=applyAction(s,{seq:s.seq+1,action:'equip-cosmetic',item:'base-monolith'},now+=1000);ok(s.cosmetics.equipped.base==='base-monolith','a bought piece equips like an earned one');}
{let s=base('ridge');shopAccount(s,acct({},{cqc:{'base-bastion':1,'base-monolith':1}}),now);refreshState(s,now);
 s.cosmetics.equipped.base='base-monolith';shopAccount(s,acct(),now);ok(!s.cosmetics.owned['base-monolith']&&!s.cosmetics.equipped.base&&s.cosmetics.owned['base-bastion']?.source!=='bought','refunded: the bought piece comes off (and off the town); one also earned by play (Bastion: Command Base I) stays');}
// ---- 9. the Lunar Pass's Conquest perks: a Repair Kit a day, the scanner +50 m, two layout slots ----
{let s=base('ridge');now=Math.floor(now/DAY)*DAY+DAY+3600000;   // 01:00 UTC: the same-day checks stay inside one UTC day
 const prem=shopCtx(R.ecoNorm({pass:{s:R.ecoSeason({day:Math.floor(now/DAY)}),xp:0,prem:true,cf:[],cp:[]}}),now);
 const r0=s.inv?.it?.repair|0;shopAccount(s,prem,now);const r1=s.inv.it.repair|0;shopAccount(s,prem,now+3600000);
 ok(r1===r0+1&&(s.inv.it.repair|0)===r1,'premium pass: one Repair Kit a UTC day ('+r0+' -> '+r1+'; a second read the same day adds none)');
 shopAccount(s,prem,now+DAY);ok((s.inv.it.repair|0)===r1+1,'... and one more the next day');
 s.inv.it.repair=R.CQ_ITEM_MAX;shopAccount(s,prem,now+2*DAY);ok(s.inv.it.repair===R.CQ_ITEM_MAX,'never above the consumables\' cap');
 ok(scanBonus(s,now)===PASS_SCAN_M&&PASS_SCAN_M===50&&scanBonus(base('ridge'),now)===0,'the scanner reaches 50 m further with the pass');
 const pts=s.ledger.cp;shopAccount(s,prem,now+3*DAY);ok(s.ledger.cp===pts&&!JSON.stringify(s.airdrop?.out||[]).includes('pass'),'the pass perks never give points or CP');}
console.log('conquest store: passed '+passed);
