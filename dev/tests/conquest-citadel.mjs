// Session 7B Citadel Act I (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md), rule by rule, on the real shared code (the
// Worker bundle) and the real Worker reducers (createState / applyAction / applyCommands), never a server or Firebase:
//  1. tiers I-III and fixed stats; 2. opening a siege (FRONT is a lock, FORCE and DEFENSE are advice); 3. siege prep (48 h, what each
//  removes, spent by the assault that used it; none in a Throne Run); 4. the assault's mechanics (the rampart and the gates, only the
//  pilot breaks the shield core, the core re-forms, dropships shot down lose their wave, cover stops a shell, the airstrike);
//  5. the first clear (exactly once per account, outside the daily cap: the outbox entry and the account's credit), the production
//  bonus (materials and CP, never the Daily Base Yield points), the trophy, Retaliation, the next tier; 6. Throne Run (the week's
//  Gambits, one full chest per tier a week, then the reduced chest, the weekly best); 7. a loss (nothing else taken); 8. the tiers in
//  war.js threatOf and the town's five places; 9. the cutscene lengths. Run: node dev/tests/conquest-citadel.mjs
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Citadel:CI,Combat:C,World:W,Control:K,War:WR,Town:TN}=CONQUEST;
const {createState,applyAction,applyCommands,hydrate}=await import('../../worker/src/conquest-sim.js');
const {airdrop,seal}=await import('../../worker/src/conquest-airdrop.js');
const {ctxOf}=await import('../../worker/src/conquest-war.js');
const {GEAR}=await import('./combat-sim.mjs');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
const DAY=86400000,H=3600000,t0=Date.UTC(2026,10,25,9),at=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});
const step=(B,p,input,n=1)=>{for(let i=0;i<n;i++)Object.assign(p,K.advance(B,p,K.validated(K.command(input)),.05,false));return p;};
// a pilot holding both approach territories, at the siege camp, with a Battalion of nine
function pilot(now=t0,{front=true,bat=9}={}){const s=createState(R.STOCK_L,now);s.lseed=424242;s.war=WR.norm(s.war,now);s.war.sc={n:9,done:1};s.war.ev=[];s.war.go=null;
 if(front)for(const id of WR.APPROACH)s.war.o[id]='h';s.position=CI.stageAt();s.battle.enemies=[];s.lastWall=now;s.creditMs=0;
 if(bat)s.bat={p:Array.from({length:bat},(_,i)=>({id:'p'+i,n:'N'+i,cs:'CS'+i,r:['guardian','lancer','breacher','frostline','mender','corroder','lancer','breacher','guardian'][i],xp:0,rk:5,k:0,h:1,at:now,src:'recruit'})),ps:[{f:'wedge',ids:[]},{f:'wedge',ids:[]},{f:'wedge',ids:[]}],pa:0};
 s.base={tier:5,modules:{hangar:3},builtAt:now-30*DAY,claimedAt:now-DAY,pointsAt:now-DAY,defense:{config:'turret',damage:0,wins:0,alertAt:0,nextAt:now+9e12,active:false}};
 const P=CONQUEST.Plot,p=P.newPlot('ridge',now-30*DAY);p.cc=9;p.b.cc.l=9;p.b.h1={t:'hangar',...P.autoPlace(p,'hangar'),l:5};s.plot=p;return s;}
const act=(s,req,now)=>applyAction(s,{seq:s.seq+1,...req},now);
// end the running assault the way the fight would: every hostile down and the warden's hull at zero, then one real command step
function winNow(s,now){const b=s.battle;for(const e of b.enemies)if(!e.resident)e.hp=0;b.cit.stage=2;b.enemies.push({id:99999,kind:'sentinel',cls:'titan',arch:'siege',x:s.position.x+30,z:s.position.z,y:W.groundAt(s.position.x+30,s.position.z),surface:'ground',hp:0,maxHp:7000,warden:1,commander:true,stats:b.enemies[0]?.stats||{},cd:9,vx:0,vz:0,heading:0,turret:0,decision:1,noLoot:true,lootCreated:true,wave:'warden'});b.time=Math.max(b.time||0,412.345);
 const B=hydrate(s);B.wardenId=99999;s.battle=JSON.parse(JSON.stringify(B));s.battle.wardenId=99999;return applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0}]},now+60);}

// ---- 1. tiers and fixed stats ----
ok(CI.TIERS.slice(1).map(t=>t.name).join()==='BREACH POINT,IRON RAIN,THE CARRIER DECK'&&CI.CIT.live===3,'Act I: I Breach Point, II Iron Rain, III The Carrier Deck');
ok(CI.TIERS[1].gate==='shield'&&CI.TIERS[1].gens===3&&CI.TIERS[1].unit==='swarm','I: gate generators hold the shield gate; the Swarm');
ok(CI.TIERS[2].mortars>0&&CI.TIERS[2].cover>0&&CI.TIERS[2].zones>0&&CI.TIERS[2].unit==='mortar','II: Spore Mortars shell marked zones; forward cover');
ok(CI.TIERS[3].ships>0&&CI.TIERS[3].unit==='dropship','III: dropships land mid-fight');
ok(['ambush','artillery','carrier'].every((p,i)=>CI.TIERS[i+1].warden.pattern===p&&CI.TIERS[i+1].warden.stars===3),'3-star wardens on the ambush, artillery and carrier commanders');
{const kinds=new Map();for(const t of [1,2,3]){const B=CI.make(R.STOCK_L,CI.stageAt(),'citadel-'+t);for(const e of B.enemies){const k=e.cit+':'+e.kind,sig=JSON.stringify([e.maxHp,e.stats.wdps,e.stats.wshot]);if(kinds.has(k))assert.equal(kinds.get(k),sig,'fixed stats '+k);kinds.set(k,sig);}}
 ok(kinds.size>=4,'fixed stats: every fortress piece has the same hull and gun in every tier it appears ('+[...kinds.keys()].join(', ')+')');}
ok(['swarm','mortar','dropship','structure'].every(k=>C.archetypes[k]),'the Citadel archetypes exist once, in the shared combat engine (the Swarm moved from the drill into the field)');
ok(C.fieldMissionIds.length===6&&!C.fieldMissionIds.some(CI.isCitadel)&&!C.raidIds.some(CI.isCitadel),'the Citadel is never a field mission or a raid (raid unlocks unchanged)');
ok(CI.battlePoints()===Math.round(7*225*1.45)&&CI.battlePoints()===2284,'battle points: par 7 minutes x 225 x the Inner Ring\'s danger 1.45 = 2,284');
ok(JSON.stringify(R.CIT_BOUNTY)==='[0,25000,37500,50000,75000,100000,150000,225000,325000,500000]'&&JSON.stringify(CI.CIT.bounty)===JSON.stringify(R.CIT_BOUNTY),'bounties I 25,000 / II 37,500 / III 50,000 (IV-IX recorded), one table');

// ---- 2. opening a siege ----
{const s=pilot();ok(CI.launchWhy(s,1,t0)==='','FRONT held: Citadel I can launch');
 ok(/hold both approach/.test(CI.launchWhy(pilot(t0,{front:false}),1,t0)),'FRONT: both approach territories must be held at launch');
 ok(/break Citadel I first/i.test(CI.launchWhy(s,2,t0)),'tiers in order: II after I');
 const weak=pilot(t0,{bat:0});weak.plot=null;weak.base={tier:0,modules:{}};ok(CI.launchWhy(weak,1,t0)==='','FORCE and DEFENSE never lock: no Battalion and no town still launches');
 const far=pilot();far.position=at(1160,1130);const s2=act(far,{action:'start-mission',mission:'citadel-1'},t0+1000);
 ok(s2.mission==='citadel-1'&&Math.hypot(s2.position.x-CI.stageAt().x,s2.position.z-CI.stageAt().z)<12,'launched from the Refuge: the tank deploys at the siege camp (fast travel\'s rule)');
 ok(s2.battle.friends.filter(f=>f.side==='mine').length===9,'the assault fields the whole Battalion (9)');
 ok(s2.citRun?.tier===1&&s2.cit.n===1&&s2.cit.cs[1]===1,'the run record and the reveal count');
 let threw='';try{act(pilot(t0,{front:false}),{action:'start-mission',mission:'citadel-1'},t0+1000);}catch(e){threw=e.message;}ok(/approach/.test(threw),'the Worker refuses a launch without FRONT');}

// ---- 3. siege prep ----
{const s=pilot(),bat=Object.values(C.operations).find(o=>o.raid&&o.family==='battery'),icp=Object.values(C.operations).find(o=>o.raid&&o.family==='intercept');
 const {citadelPrep}=await import('../../worker/src/conquest-citadel.js');citadelPrep(s,bat,t0);citadelPrep(s,icp,t0);
 let P=CI.prepOf(s,t0+47*H);ok(P.aa&&P.cv,'an anti-air battery knockout and an armored interception won: both prep ready for 48 h');
 ok(!CI.prepOf(s,t0+49*H).aa,'prep runs out after 48 h');
 s.war.por={...s.war.por,until:t0+40*H};P=CI.prepOf(s,t0);ok(P.po,'the portal suppressed (the war\'s 48 h rule): no portal reinforcements');
 const s2=act(s,{action:'start-mission',mission:'citadel-1'},t0+1000),b=s2.battle.cit;
 ok(b.air===1&&b.wavesMax===CI.TIERS[1].waves-1&&b.portal===0,'the assault: one LDF airstrike, one fewer wave, no portal surges');
 const s3=winNow(s2,t0+2000);ok(!s3.cit.prep.aa&&!s3.cit.prep.cv&&s3.cit.pu===t0+40*H&&!CI.prepOf(s3,t0+3000).po,'every prep the assault used is spent (the portal suppression can not serve a second siege)');}

// ---- 4. the assault's mechanics ----
{const p=CI.stageAt(),B=CI.make(GEAR.epic,p,'citadel-1').setup({}),c0=CI.centre(),g=CI.LAYOUT.gate;
 const q=at(c0.x+g.u-6,c0.z);Object.assign(p,q);B.player={...q,y:q.y+2.2};for(let i=0;i<60;i++)step(B,p,{x:1,z:0});ok(p.x<c0.x+g.u,'the shield gate holds the gap while a generator stands');
 Object.assign(p,at(c0.x+g.u-6,c0.z+30));for(let i=0;i<60;i++)step(B,p,{x:1,z:0});ok(p.x<c0.x+g.u,'the rampart blocks the tank');
 for(const e of B.enemies)if(e.cit==='gen')e.hp=0;step(B,p,{x:0,z:0});ok(B.cit.stage===1,'the generators down: the shield gate falls, the PUSH begins');
 Object.assign(p,at(c0.x+g.u-6,c0.z));for(let i=0;i<120;i++)step(B,p,{x:1,z:0});ok(p.x>c0.x+g.u,'through the open gate');
 B.deployWarden();const w=B.enemies.find(e=>e.warden);ok(w&&w.core===CI.CIT.warden.core&&w.hp===CI.CIT.warden.hp,'the warden: its shield core up');
 B.friends.push(C.friendUnit({id:800000001,side:'mine',pid:'a',role:'breacher',kit:{w:{a:'pulse',t:2,q:1},c:{c:'titan',t:2,q:1}},m:1,x:p.x+4,z:p.z}));const f=B.friends.at(-1);
 const hp0=w.hp,core0=w.core;B.hit({x:w.x,y:w.y+2.2,z:w.z,vx:1,vy:0,vz:0,team:'ally',kind:'siege',owner:f.id},w,2.7);ok(w.hp===hp0&&w.core===core0,'an ally\'s hit does nothing while the shield core holds');
 B.cit.air=1;B.lockId=w.id;B.callStrike(p);B.time+=3;B.impacts(B.time);ok(w.core===core0&&w.hp===hp0,'the LDF airstrike never touches a shield core');
 B.random=()=>1;for(let i=0;i<400&&w.core>0;i++)B.hit({x:w.x,y:w.y+2.2,z:w.z,vx:1,vy:0,vz:0,team:'player',kind:'pulse',owner:0},w,2.7);ok(w.core===0,'the pilot\'s own fire breaks the shield core');
 B.hit({x:w.x,y:w.y+2.2,z:w.z,vx:1,vy:0,vz:0,team:'ally',kind:'siege',owner:f.id},w,2.7);ok(w.hp<hp0,'the core down: the Battalion hits the hull');
 w.hp=w.maxHp*.6;B.wardenStep();ok(B.cit.reformAt>0&&w.telegraph,'past two thirds the core re-forms after a tell');B.time=B.cit.reformAt+.01;B.wardenStep();ok(w.core===w.coreMax,'the core is back');
 w.hp=0;B.wardenStep();ok(B.state==='victory'&&B.cit.clear>0,'the warden falls: the tier is broken, the clear time is the battle clock');}
{const B=CI.make(GEAR.epic,CI.stageAt(),'citadel-3').setup({}),p=CI.stageAt();for(const e of B.enemies)if(e.cit==='gate')e.hp=0;step(B,p,{x:0,z:0});
 B.launchShip();const s1=B.enemies.find(e=>e.ship);s1.hp=0;B.citStep(.05);const n0=B.enemies.length;B.time+=20;for(let i=0;i<5;i++)B.shipPose(s1);ok(B.enemies.length===n0&&B.cit.down===1,'a dropship shot down before it lands: its wave never lands');
 B.launchShip();const s2=B.enemies.filter(e=>e.ship).at(-1);B.time=s2.ship.t0+CI.CIT.ship.flyS+.01;const n1=B.enemies.length;B.shipPose(s2);ok(B.enemies.length>n1&&B.cit.landed===1,'a dropship that lands unloads its wave');}
{const B=CI.make(GEAR.epic,CI.stageAt(),'citadel-2').setup({}),[cx,cz]=B.cit.cover[0];B.player={x:cx,y:W.groundAt(cx,cz)+2.2,z:cz};B.playerHp=B.playerMax;
 B.cit.shells=[{x:cx,z:cz,r:8,at:B.time,dmg:80}];B.impacts(B.time);ok(B.playerHp===B.playerMax,'Iron Rain: a shell on a unit in forward cover does nothing');
 B.player={x:cx+30,y:W.groundAt(cx+30,cz)+2.2,z:cz};B.cit.shells=[{x:cx+30,z:cz,r:8,at:B.time,dmg:80}];B.impacts(B.time);ok(B.playerHp<B.playerMax,'out of cover the shell lands');}

// ---- 5. the first clear: exactly once per account, outside the daily cap ----
{let s=act(pilot(),{action:'start-mission',mission:'citadel-1'},t0+1000);s=winNow(s,t0+2000);const rec=s.settlement;
 ok(rec?.kind==='citadel'&&rec.first===1&&rec.bounty===25000&&s.cit.t===1&&s.cit.fc[1]&&s.cit.tro[1],'the first clear of tier I: tier cleared, trophy, the 25,000 bounty');
 const A=airdrop(s);seal(s,t0+2000);const e=A.out.at(-1);ok(Array.isArray(e?.bty)&&e.bty.length===1&&e.bty[0].id==='cit1'&&e.bty[0].pts===25000,'the bounty rides the request\'s immutable outbox entry (e.bty)');
 ok(!(e.raw>=25000),'it never joins the capped raw points');
 ok(rec.ptsRaw>0&&Math.abs(rec.ptsRaw-CI.battlePoints()*R.CQ_BASE_MULT[5])<1,'the assault pays its battle points (inside the cap and the hourly limit)');
 ok(s.base.cpb===.05&&s.plot.cpb===.05,'production +5% (the record of the bonus)');
 {const b0={...s.base,cpb:0},Y0=C.baseYield(b0,0,t0+DAY),Y1=C.baseYield(s.base,0,t0+DAY);ok(Y1.cp>Y0.cp&&Y1.alloy>=Y0.alloy&&Y1.pts===Y0.pts,'production +5%: CP and materials up, the Daily Base Yield points unchanged');}
 ok(ctxOf(s).tiers===1&&WR.threatOf(s.war,{g:'skaal',t:'ash'},ctxOf(s)).parts.some(x=>x.k==='tiers'&&x.v===1),'Retaliation +1: war.js threatOf reads ctx.tiers');
 ok(CI.nextTier(s.cit)?.n===2,'the next tier appears');
 // the Hive re-fortifies the next tier for 7 days after a first clear (lead's design: the measured pacing; Throne Runs stay open)
 {const T=s.cit.fc[1],h={...s,mission:null,battle:{...s.battle,enemies:[]},hp:100};for(const id of WR.APPROACH)h.war.o[id]='h';
  ok(/re-fortifies Citadel II: it opens in 6 d 23 h/.test(CI.launchWhy(h,2,T+H))&&CI.launchWhy(h,1,T+H)==='','the next tier re-fortifies for 7 days (Citadel II opens in 6 d 23 h); a Throne Run of tier I is open meanwhile');
  let threw='';try{act(h,{action:'start-mission',mission:'citadel-2'},T+H);}catch(e){threw=e.message;}ok(/re-fortifies/.test(threw),'the Worker refuses Citadel II while it re-fortifies');
  ok(CI.opensAt(h.cit,2)===T+7*DAY&&CI.launchWhy(h,2,T+7*DAY)==='','Citadel II opens 7 days after the first clear of Citadel I');}
 // a second clear of tier I (a Throne Run) pays loot, never first-clear points
 const s1={...s,mission:null,battle:{...s.battle,enemies:[]}};for(const id of WR.APPROACH)s1.war.o[id]='h';s1.war.ev=[];s1.war.k=WR.tickOf(t0+DAY);let s2=act(s1,{action:'start-mission',mission:'citadel-1'},t0+DAY);s2=winNow(s2,t0+DAY+1000);seal(s2,t0+DAY+1000);
 ok(s2.settlement.throne===1&&!s2.settlement.bounty&&s2.cit.t===1&&!airdrop(s2).out.slice(-1)[0]?.bty,'a repeat clear (Throne Run) pays no bounty');
 // the account side: each bounty id once per account, outside the 50,000 cap
 const X={day:Math.floor(t0/DAY),week:1},S={pts:0,earned:0,dailyPts:0,weeklyPts:0};R.ecoPlayAward(S,60000,60000,X);ok(S.dailyPts===R.DAILY_CAP,'the capped points stop at 50,000');
 const got=R.ecoBounty(S,'cit1',X);ok(got===25000&&S.pts===R.DAILY_CAP+25000,'the bounty is paid outside the cap (cap already reached)');
 ok(R.ecoBounty(S,'cit1',X)===0&&R.ecoBounty(S,'cit1',{day:X.day+40,week:9})===0,'exactly once per account: a replayed or later entry with the same id pays nothing');
 R.ecoPlayAward(S,10000,10000,X);ok(S.dailyPts-25000===R.DAILY_CAP,'and the bounty never uses up the cap\'s room (capped points still 50,000)');
 ok(R.ecoBounty(S,'cit9x',X)===0&&R.ecoBounty(S,'cit0',X)===0&&R.ecoBounty({},'x',X)===0,'only a real bounty id pays');
 const S2={pts:0,earned:0,dailyPts:0,weeklyPts:0};ok(R.ecoBounty(S2,'cit2',X)===37500&&R.ecoBounty(S2,'cit3',X)===50000,'II 37,500 and III 50,000 from the one table');
 const dev=act(pilot(),{action:'start-mission',mission:'citadel-1'},t0+1000);dev.dev={used:1};const d2=winNow(dev,t0+2000);seal(d2,t0+2000);ok(!airdrop(d2).out.some(x=>x.bty),'an owner dev record never earns a bounty');}

// ---- 6. Throne Run ----
{let s=act(pilot(),{action:'start-mission',mission:'citadel-1'},t0+1000);s=winNow(s,t0+2000);const wk=CI.weekOf(t0+DAY);
 const hold=(st,now)=>{for(const id of WR.APPROACH)st.war.o[id]='h';st.war.ev=[];st.war.k=WR.tickOf(now);return st;};   // a test placement: the front still held when the pilot relaunches (the war clock is caught up to now)
 const run=(st,now)=>winNow(act(hold({...st,mission:null,battle:{...st.battle,enemies:[]},hp:st.hp>0?st.hp:100},now),{action:'start-mission',mission:'citadel-1'},now),now+1000);
 const r1=run(s,t0+DAY),r2=run(r1,t0+DAY+H);ok(r1.settlement.chest==='full'&&r2.settlement.chest==='reduced','Throne Run: one full chest per tier per week, then the reduced chest');
 ok(JSON.stringify(r1.settlement.gambits)===JSON.stringify(CI.gambitsOf(wk))&&CI.gambitsOf(wk).length===2,'the week\'s Gambits (the same pair for every pilot that week)');
 ok(r1.cit.lb&&r1.cit.lb.t===1&&r1.cit.wk[1].w===wk,'the clear time goes to the weekly board (the Worker\'s own clock)');
 const r3=run(r2,t0+8*DAY);ok(r3.settlement.chest==='full','a new week: the full chest again');
 ok(new Set(CI.GAMBIT_WEEKS.map(x=>x.join())).size===CI.GAMBIT_WEEKS.length&&CI.GAMBIT_WEEKS.every(x=>CI.GAMBITS[x[0]].bane&&!CI.GAMBITS[x[1]].bane),'the Gambits rotate: a bane and a boon each week');
 const pr=pilot();const {citadelPrep}=await import('../../worker/src/conquest-citadel.js');pr.cit={...s.cit};citadelPrep(pr,Object.values(C.operations).find(o=>o.raid&&o.family==='battery'),t0);const tr=act(pr,{action:'start-mission',mission:'citadel-1'},t0+1000);
 ok(tr.battle.cit.air===(CI.gambitsOf(CI.weekOf(t0)).includes('airwing')?1:0)&&tr.cit.prep.aa,'a Throne Run uses no siege prep (it waits for the next siege)');}

// ---- 7. a loss: the used prep is spent, nothing else is taken ----
{const s=pilot();s.ledger.cargo={alloy:40,biomass:20,helium:8};const {citadelPrep}=await import('../../worker/src/conquest-citadel.js');citadelPrep(s,Object.values(C.operations).find(o=>o.raid&&o.family==='battery'),t0);
 let a=act(s,{action:'start-mission',mission:'citadel-1'},t0+1000);a.hp=1;a.battle.playerHp=1;a.battle.projectiles=[];const B=hydrate(a);B.hazards=[{kind:'orbital',x:a.position.x,z:a.position.z,y:a.position.y,radius:9,remaining:.01,damage:9999,source:0}];a.battle=JSON.parse(JSON.stringify(B));
 const d=applyCommands(a,{seq:a.seq+1,commands:[{x:0,z:0},{x:0,z:0}]},t0+5000);
 ok(d.settlement?.kind==='citadel-loss'&&d.settlement.spent.includes('aa')&&!d.cit.prep.aa,'destroyed in the assault: the used siege prep is spent');
 ok(!d.death?.active&&!(d.wrecks||[]).length&&d.ledger.cargo.alloy===40&&d.hp>0,'nothing else is taken: no wreck, no cargo lost, the tank towed back');
 const r=act(d,{action:'return-exploration'},t0+6000);ok(!r.mission&&r.battle.state==='active','back to exploration');
 let q=act(pilot(),{action:'start-mission',mission:'citadel-1'},t0+1000);q=act(q,{action:'return-exploration'},t0+2000);ok(q.settlement?.kind==='citadel-loss'&&q.cit.lost===1,'a retreat is a loss (spends the prep it used)');}

// ---- 8. the tiers in the town (five places) and the war ----
{const src=readFileSync(new URL('../../worker/src/conquest-town.js',import.meta.url),'utf8'),ui=readFileSync(new URL('../../js/conquest/townui.js',import.meta.url),'utf8');
 ok(/infoOf=\(s,now\)=>\(\{.*tiers:citTiers\(s\)/.test(src),'town: infoOf passes the tiers (the clock and the attacker\'s stars)');
 ok(/export function settle\(s,e,at,live,cit=citTiers\(s\)\)/.test(src),'town: settle\'s cit defaults to the tiers cleared');
 ok(/TN\.strength\(s\.war,e,\{now,tiers:citTiers\(s\)/.test(src),'town: the town-defend start fights at the tiers cleared');
 ok((ui.match(/tiers:root\.ConquestCitadel\?\.tiersOf\(s\)\|\|0/g)||[]).length===2,'townui.js: the hub preview and the last-chance line read the tiers');
 ok(/lv=live&&Number\.isSafeInteger\(live\.lv\)\?live\.lv:st\.level/.test(src),'a fight is paid at the level it was fought');
 const s=pilot();s.cit={...CI.fresh(),t:2};const [lo,hi]=TN.STARS[2],g=TN.pickGeneral(s.war,CI.tiersOf(s),.99,t0);ok(WR.GEN[g].stars>=lo&&WR.GEN[g].stars<=hi,'the town\'s attacker follows townwar.js STARS for the tiers cleared');
 ok(TN.levelOf(WR.threatOf(s.war,{g:'skaal',t:'town'},{now:t0,tiers:3}).total)<TN.TOWN.se.from,'tiers I-III stay below the cap level: the Selenite drop stays dormant (Session 11)');}

// ---- 9. cutscenes ----
ok(CI.cutOf(1,0).full&&CI.cutOf(1,0).ms===CI.CIT.cut.fullMs&&!CI.cutOf(1,1).full&&CI.cutOf(1,1).ms<CI.cutOf(1,0).ms,'the reveal: full length on a tier\'s first attempt, shorter after');
{const cs=readFileSync(new URL('../../js/conquest/cutscene.js',import.meta.url),'utf8');ok(/SKIP/.test(cs)&&/Escape/.test(cs)&&/view\.cinematic=true/.test(cs),'always skippable (SKIP, Escape, Enter, Space); the fight waits while it plays');}
console.log(JSON.stringify({test:'conquest-citadel',pass}));
