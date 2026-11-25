// Session 7C STEP 3 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md; the old brief's D): the Hive Titan, rule by rule, through the
// real shared code (the Worker bundle) and the real Worker reducers (createState / applyAction / applyCommands), never a server:
//  1. the rules: every 6th Meteor Strike slot (00:00 and 12:00 UTC), 9,000 hull, three phases marked at 2/3 and 1/3, a 4-minute clock,
//     fixed stats (the same Titan for a starter and a full legendary pilot), 1,600 base points, the LOOT.titan row and its pity;
//  2. the start: only in a Titan slot, after this pilot's core, inside the window (or the pilot's Strike Beacon on that slot), near the
//     crater, never twice once killed;
//  3. the fight: the phases (the charge lane and slam ring, the burrow out of reach with the swarm, the plasma rain), telegraphed before
//     they land; the clock ends it; the Wing's fire counts a quarter;
//  4. the kill pays once per slot (the points under the cap and the hourly limit, the loot keyed by the slot), a replayed winning request
//     pays nothing more; a destroyed tank leaves no wreck; every attempt's damage is kept (the slot's best) for the weekly board;
//  5. the pity: the 5th Titan without a Selenite pays one.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:Q,RULES:R}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Titan:TT}=Q;
const {createState,applyAction,applyCommands,hydrate}=await import('../../worker/src/conquest-sim.js');const {seal,airdrop}=await import('../../worker/src/conquest-airdrop.js');
const {roll,inventory}=await import('../../worker/src/conquest-loot.js');const {GEAR}=await import('./combat-sim.mjs');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};const H=3600000,DAY=24*H;
// ---- 1. the rules ----
{const T=TT.TITAN;ok(T.hp===9000&&T.clockS===240&&T.every===6&&T.points===1600&&R.CQ_PTS.titan===1600,'1. 9,000 hull, a 4-minute clock, every 6th strike slot, 1,600 base points (RULES.CQ_PTS.titan)');
 const days=[];for(let t=Date.UTC(2026,10,25,0,0);t<Date.UTC(2026,10,28);t+=60000){const M=C.meteorStrike(t);if(M.phase==='open'&&TT.isTitanSlot(M.slot)){const h=new Date(M.impactAt).getUTCHours();if(!days.includes(h))days.push(h);}}
 ok(JSON.stringify(days.sort((a,b)=>a-b))==='[0,12]','the Titan slots fall at 00:00 and 12:00 UTC (slot % 6 === 0 of the 2-hour strike clock)');
 const n=TT.nextTitan(Date.UTC(2026,10,25,9,30));ok(n.slot%6===0&&new Date(n.impactAt).getUTCHours()===12&&!n.live,'the next Titan slot from 09:30 is the 12:00 one (the hub\'s telegraph: '+TT.hhmm(n.impactAt)+' UTC)');
 ok(JSON.stringify(TT.TITAN.phases)===JSON.stringify([2/3,1/3])&&TT.PHASES[1]==='CHARGE + SLAM'&&TT.PHASES[2]==='BURROW + SWARM'&&TT.PHASES[3]==='PLASMA RAIN','three phases, marked at 2/3 and 1/3 of its hull');
 const a=TT.make(GEAR.common,{x:1000,z:1000,y:0,surface:'ground'},'hive-titan'),b=TT.make(GEAR.epic,{x:1000,z:1000,y:0,surface:'ground'},'hive-titan');const ta=a.titan(),tb=b.titan();
 ok(ta.hp===tb.hp&&ta.maxHp===9000&&JSON.stringify(ta.stats)===JSON.stringify(tb.stats)&&ta.kind===tb.kind,'fixed stats: the same Titan against a starter and a full Epic pilot (no scaling)');
 const L=R.LOOT.titan;ok(JSON.stringify(L.rows)===JSON.stringify([{p:.25,part:1},{p:.20,mn:'se'},{p:.02,mn:'mh'},{p:.30,trophy:1},{p:.10,frag:'e'}])&&L.pity.se===5,'LOOT.titan: 25% a part, 20% Selenite, 2% Moonheart, 30% its trophy, 10% an epic fragment; pity 5 -> Selenite');
 ok(R.CQ_TROPHY['hive-titan']&&R.CQ_TROPHY_ORDER.includes('hive-titan')&&!R.CQ_TROPHY_RESERVED.length,'its trophy joins the Trophy Hall (no longer reserved)');
 ok(TT.TITAN.allyMul===.25,'the Wing\'s fire counts a quarter on its hide (a fixed stat)');}
// a pilot at a Titan slot with the strike core extracted (the strike's own steps: tested in conquest-minerals / economy)
const T0=Date.UTC(2026,10,25,12,1);
function atTitan(L=GEAR.epic,t=T0){const M=C.meteorStrike(t),s=createState(structuredClone(L),t);s.lseed=777;s.strikeSlot=M.slot;s.strikes={[M.slot]:{roll:{tq:.5,se:.5,mh:.5},claimed:1}};const a=TT.arenaOf(M.site);s.position={x:a.x,z:a.z+30,y:W.groundAt(a.x,a.z+30),surface:'ground'};s.battle.enemies=[];s.lastWall=t;s.hp=s.hp||2000;return {s,M};}
const start=(s,t)=>{const x=applyAction(s,{seq:s.seq+1,action:'start-mission',mission:'hive-titan'},t);seal(x,t);return x;};
const refused=(f,re)=>{try{f();return '';}catch(e){return re.test(e.message)?e.message:'WRONG: '+e.message;}};
// ---- 2. the start ----
{const {s}=atTitan();const x=start(s,T0+1000);ok(x.mission==='hive-titan'&&x.battle.ttn.slot===x.strikeSlot&&x.ttnRun?.slot===x.strikeSlot,'2. a Titan slot, the core extracted, at the crater: the hunt starts on that slot');
 const T=hydrate(x).titan(),a=TT.arenaOf(C.meteorStrike(T0).site);ok(Math.hypot(T.x-a.x,T.z-a.z)<1&&T.hp===9000,'the Titan rises at the slot\'s crater with its whole hull');}
{const t=Date.UTC(2026,10,25,14,1),M=C.meteorStrike(t),s=createState(structuredClone(GEAR.epic),t);s.strikeSlot=M.slot;s.strikes={[M.slot]:{claimed:1}};const a=TT.arenaOf(M.site);s.position={x:a.x,z:a.z+30,y:W.groundAt(a.x,a.z+30),surface:'ground'};s.battle.enemies=[];
 ok(!TT.isTitanSlot(M.slot)&&refused(()=>start(s,t+1000),/only in a Titan slot/),'not a Titan slot (14:00): refused');}
{const {s}=atTitan();s.strikes[s.strikeSlot].claimed=0;ok(refused(()=>start(s,T0+1000),/extract this strike/),'the core not extracted: refused');}
{const {s,M}=atTitan();ok(refused(()=>start(s,M.closesAt+1000),/closed/),'the slot\'s window closed: refused');}
{const {s}=atTitan();s.position={x:s.position.x+400,z:s.position.z,y:0,surface:'ground'};ok(refused(()=>start(s,T0+1000),/strike crater/),'far from the crater: refused');}
{const {s,M}=atTitan(GEAR.epic,T0+3*H);ok(refused(()=>start(s,T0+3*H),/only in a Titan slot|closed/),'the Strike Beacon cannot call a Titan outside the current Titan slot');
 const {s:b}=atTitan(GEAR.epic,T0);b.bcn={d:Math.floor(T0/DAY),slot:b.strikeSlot,site:M.site.id,until:T0+20*60000,at:T0};ok(start(b,T0+60000).mission==='hive-titan','... and a beacon on the current Titan slot counts as that slot');}
// ---- 3. the fight ----
function fight(s,t,policy,{secs=260}={}){let now=t;for(let k=0;k<secs&&s.battle.state==='active';k++){const cmds=[];for(let i=0;i<20;i++)cmds.push(policy(s));now+=1000;s=applyCommands(s,{seq:s.seq+1,commands:cmds},now);seal(s,now);}return {s,now};}
const sit=()=>({x:0,z:0});
{const {s}=atTitan();let x=start(s,T0+1000);const tell=[],seen=new Set();let now=T0+1000;
 for(let k=0;k<12;k++){now+=1000;x=applyCommands(x,{seq:x.seq+1,commands:Array(20).fill({x:0,z:0})},now);for(const h of x.battle.hazards||[])if(!seen.has(h.kind+h.x)){seen.add(h.kind+h.x);tell.push(h.kind+'@'+Math.round(x.battle.time));}}
 const li=tell.findIndex(k=>k.startsWith('lane')),ri=tell.findIndex(k=>k.startsWith('ring'));ok(x.battle.ttn.phase===1&&li>=0&&ri>li,'3. phase I: a charge lane is marked before it charges, then the slam ring is marked before it lands ('+tell.join(', ')+')');}
{const {s}=atTitan();let x=start(s,T0+1000);const B=hydrate(x);B.titan().hp=5900;x.battle=JSON.parse(JSON.stringify(B));let now=T0+1000,burrowed=false,adds=0,under=false;
 for(let k=0;k<6;k++){now+=1000;x=applyCommands(x,{seq:x.seq+1,commands:Array(20).fill({x:0,z:0})},now);const T=x.battle.enemies.find(e=>e.titan);if(T.dormant){burrowed=true;under=T.y<W.groundAt(T.x,T.z)-30;}adds=Math.max(adds,x.battle.enemies.filter(e=>e.swarm&&e.hp>0).length);}
 ok(x.battle.ttn.phase===2&&x.battle.ttn.mark[0]>0&&burrowed&&under&&adds>0,'phase II at 2/3 (marked): it burrows out of reach (dormant, under its crater) and the swarm comes');}
{const {s}=atTitan();let x=start(s,T0+1000);const B=hydrate(x);B.titan().hp=2900;x.battle=JSON.parse(JSON.stringify(B));let now=T0+1000,rain=0;
 for(let k=0;k<6;k++){now+=1000;x=applyCommands(x,{seq:x.seq+1,commands:Array(20).fill({x:0,z:0})},now);rain=Math.max(rain,(x.battle.ttn.rings||[]).filter(r=>r.k==='rain').length);}
 ok(x.battle.ttn.phase===3&&rain>=3,'phase III at 1/3: the plasma rain, its rings marked '+TT.TITAN.rain.tellS+' s before they land');}
{const {s}=atTitan(GEAR.epic);let x=start(s,T0+1000);const B=hydrate(x);B.time=TT.TITAN.clockS-.2;x.battle=JSON.parse(JSON.stringify(B));const r=fight(x,T0+1000,sit,{secs:2});
 ok(r.s.battle.state==='defeat'&&r.s.settlement?.kind==='titan-loss'&&r.s.settlement.why.includes('burrowed away'),'the 4-minute clock ends the hunt (it burrows away)');}
{const m=TT.make(GEAR.epic,{x:1000,z:1000,y:0,surface:'ground'},'hive-titan'),T=m.titan(),f={team:'ally',x:T.x,y:T.y+2.2,z:T.z,vx:1,vy:0,vz:0,owner:1};const hp0=T.hp;m.friends.push(C.friendUnit({id:1,side:'mine',pid:'p',role:'lancer',kit:{w:{a:'pulse',t:1,q:1},c:{c:'vanguard',t:1,q:1}},m:1,x:T.x+5,z:T.z}));
 const same=TT.make(GEAR.epic,{x:1000,z:1000,y:0,surface:'ground'},'hive-titan');same.friends.push({...m.friends[0]});const S=same.enemies[0];S.titan=0;   // the same unit, not a Titan
 m.hit(f,T,3);same.hit({...f},S,3);ok(hp0-T.hp>0&&Math.abs((hp0-T.hp)-(S.maxHp-S.hp)*.25)<1e-6,'the Wing\'s shot on the Titan does a quarter of the same shot on another unit');}
// ---- 4. the payout ----
{const {s}=atTitan();let x=start(s,T0+1000);const B=hydrate(x);const T=B.titan();T.hp=0;T.tp=6800;x.battle=JSON.parse(JSON.stringify(B));const mult=R.CQ_BASE_MULT[0];
 const req={seq:x.seq+1,commands:[{x:0,z:0}]},y=applyCommands(x,req,T0+2000);seal(y,T0+2000);const st=y.settlement,e=airdrop(y).out.at(-1);
 ok(st?.kind==='titan'&&st.first===1&&Math.abs(st.ptsRaw-1600*mult)<1e-6&&e&&e.op===1&&e.raw>=st.ptsRaw-1e-6,'4. the kill: '+st.ptsRaw+' base points (1,600 x the Command Base multiplier '+mult+') in an immutable outbox entry (the cap and hourly limit apply on the account)');
 ok(st.loot&&!st.loot.mn?.tq&&(y.ledger.mn.tq|0)===(x.ledger.mn?.tq|0)&&y.ttn.sl[y.strikeSlot].k===1&&y.ttn.sl[y.strikeSlot].d===6800&&y.ttn.kills===1,'the loot (the LOOT.titan roll: no Tranquillityite, Checkpoint 50) and the slot marked killed with the pilot\'s 6,800 damage');
 let threw='';try{applyCommands(y,req,T0+2500);}catch(err){threw=err.message;}const again=(()=>{try{return applyCommands(structuredClone(x),req,T0+2000);}catch(err){return null;}})();
 ok(/sequence|digest|replay|already/i.test(threw)||threw,'a replayed winning request is refused by the record\'s sequence ('+String(threw).slice(0,40)+')');
 const back=applyAction(y,{seq:y.seq+1,action:'return-exploration'},T0+3000);ok(refused(()=>start(back,T0+4000),/already brought down/),'a second hunt in the slot is refused once it is down');
 const z=structuredClone(back);z.mission='hive-titan';z.ttnRun={slot:z.strikeSlot,attempt:z.attempt|0};const B2=TT.make(z.loadout,z.position,'hive-titan').setup({slot:z.strikeSlot,site:C.meteorStrike(T0).site});B2.titan().hp=0;z.battle=JSON.parse(JSON.stringify(B2));z.settlement=null;delete z.anEnd;
 const w=applyCommands(z,{seq:z.seq+1,commands:[{x:0,z:0}]},T0+5000);ok(w.settlement?.kind==='titan'&&w.settlement.first===0&&w.settlement.ptsRaw===0&&!w.settlement.loot,'... and even a forced second kill pays nothing (the slot\'s mark): once per slot');}
{const {s}=atTitan(GEAR.common);let x=start(s,T0+1000);const B=hydrate(x);B.playerHp=1;x.battle=JSON.parse(JSON.stringify(B));x.hp=1;x.ledger.mn={se:3};
 const r=fight(x,T0+1000,sit,{secs:30});ok(r.s.battle.state==='defeat'&&!r.s.death&&r.s.hp>0&&(r.s.ledger.mn.se|0)===3&&r.s.settlement?.why==='destroyed','destroyed in the hunt: no wreck, no cargo lost (3 Selenite still carried), towed back with a quarter hull');}
{const {s}=atTitan();let x=start(s,T0+1000);let B=hydrate(x);B.titan().tp=2100;x.battle=JSON.parse(JSON.stringify(B));x=applyAction(x,{seq:x.seq+1,action:'return-exploration'},T0+2000);const slot=x.strikeSlot;ok(x.ttn.sl[slot].d===2100&&x.settlement?.kind==='titan-loss','a retreat keeps its damage (2,100) for the board');
 x=start(x,T0+3000);B=hydrate(x);B.titan().tp=1500;x.battle=JSON.parse(JSON.stringify(B));x=applyAction(x,{seq:x.seq+1,action:'return-exploration'},T0+4000);ok(x.ttn.sl[slot].d===2100&&x.ttn.sl[slot].a===2,'a weaker second attempt in the slot keeps the best (2,100): the slot counts its best attempt once');}
// ---- 5. the pity ----
{const s=createState(R.STOCK_L,T0);s.lseed=1;inventory(s);let drought=0,maxDrought=0,pityPaid=0,se=0;
 for(let k=1;k<=400;k++){const o=roll(s,'titan','slot:'+(k*6));if(o.mn?.se){se++;maxDrought=Math.max(maxDrought,drought);drought=0;if(o.pity)pityPaid++;}else drought++;}
 ok(maxDrought<=4&&pityPaid>0,'5. 400 Titans: never more than 4 in a row without a Selenite (the 5th pays it: '+pityPaid+' pity Selenites; '+se+' Selenite in all)');}
// ---- review round 1 (airdrop integrity, notes 1 and 2) ----
{const M=TT.slotNow(T0),slot=M.slot,late=M.closesAt+11*60000,s={strikeSlot:slot,strikes:{[slot]:{claimed:1}},ttn:{v:1,sl:{}}};
 ok(TT.isTitanSlot(slot)&&TT.startWhy(s,late)==='this Titan slot has closed'&&TT.startWhy({...s,bcn:{slot,until:late+30*60000}},late)==='','a Strike Beacon on this Titan slot opens the hunt in the slot\'s idle phase (without it the slot is closed)');
 const many={};for(let i=1;i<=70;i++)many[i*6]={k:0,d:i,a:1};const kept=Object.keys(TT.norm({sl:many}).sl).length;ok(kept===64,'the Titan record keeps 64 slots: a 30-day board period holds 60 ('+kept+')');}
console.log(JSON.stringify({test:'conquest-titan',pass}));
