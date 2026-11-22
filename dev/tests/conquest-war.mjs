// Session 7 Living Front (owner brief docs/conquest/audit/SESSION_07_BRIEF.md): the war's rules, decision by decision, on the shared
// rules (js/conquest/war.js) and the Worker's own reducer (worker/src/conquest-war.js through conquest-sim.js). Blueprint guardrails
// 5 (territory limits over 10,000 war turns), 6 (bounded absence) and 7 (the war needs no one) land here.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST,RULES:R}=await import('../../worker/src/sim.gen.js');const {War:WR,Combat:C,World:W}=CONQUEST,WAR=WR.WAR;
const {createState,applyAction,applyCommands,refreshState}=await import('../../worker/src/conquest-sim.js');
const {warEvent,warQuiet}=await import('./lib/war-helpers.mjs');
const H=3600000,D=24*H,T0=Date.UTC(2026,10,23,0);let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;};
const point=(x,z)=>({x,z,y:W.groundAt(x,z),surface:'ground'});

// ---- decision 1: the theater -----------------------------------------------------------------------------------------------------
{const rings=[1,2,3,4,5].map(r=>WR.TERRITORIES.filter(t=>t.ring===r).length),w=WR.fresh(T0);
 ok(WR.TERRITORIES.length===20&&JSON.stringify(rings)==='[4,5,5,3,3]','20 territories in five rings 4/5/5/3/3');
 ok(WR.humanHeld(w)===16&&WR.parasiteHeld(w)===4&&WAR.ceiling===8&&WAR.floor===3,'start 16 human / 4 Parasite, ceiling 8, floor 3');
 ok(['ash','east','bastion','citadel'].every(id=>w.o[id]==='p'),'Ash Redoubt, the Eastern Rim, the second bastion and the Citadel start Parasite-held');
 ok(WR.TERRITORIES.filter(t=>t.ex).length===11&&WR.HOOKS.newGround.length===7,'11 territories exist today; 7 new ones wait for 7-V');
 const cap=WR.TERRITORIES.filter(t=>t.cap&&w.o[t.id]==='h').length;ok(cap===12,'12 capturable human territories at the start');
 // the map enforces it: a forged record cannot capture the heartland, free the Inner Ring or touch the new ground
 const f=WR.norm({...w,o:{...w.o,colony:'p',citadel:'h',silt:'p'}},T0);ok(f.o.colony==='h'&&f.o.citadel==='p'&&f.o.silt==='h','Heartland never captured, Inner Ring never falls, new ground safe (norm)');
 // only the human-held territories among the 11 that exist (never the town) can be attacked
 const can=WR.TERRITORIES.filter(t=>WR.attackable(t)).map(t=>t.id).sort();ok(JSON.stringify(can)===JSON.stringify(['ash','colony','crossroads','helium','oxygen','refuge','reservoir','ridge','western']),'attackable: the 11 existing minus the town and the Inner Ring: '+can);
 ok(WR.TERRITORIES.every(t=>Number.isFinite(WR.terraOf(w,t.id).level)),'living terraform state tracked for every territory (7-V draws it)');
 ok(typeof WR.dropships==='function'&&typeof WR.portalOf==='function'&&typeof WR.ldfPosts==='function'&&typeof WR.terraOf==='function'&&WR.HOOKS.dropships&&WR.HOOKS.portal&&WR.HOOKS.ldfPosts&&WR.HOOKS.livingTerraform,'7-V hooks named: dropships, portal, LDF posts, living terraform, new ground');
 // the six-sector Frontline keeps its own count beside the Moon's
 const s=createState(R.STOCK_L,T0);ok(WR.frontline(s.territory).held===1&&WR.frontline(s.territory).of===6&&WR.humanHeld(s.war)===16,'Frontline 1/6 and Moon 16/20, separate counts');
 // over 10,000 war turns the Parasites never leave 3-8 and the heartland is never captured (guardrail 5), on several seeds
 let bad=0,ticks=0,maxFlips=0;for(let seed=0;seed<4;seed++){const x=WR.fresh(T0);x.sc={n:9,done:1};for(let k=1;k<=2500;k++){const now=T0+k*WAR.tickMs,before={...x.o};const out=WR.advance(x,now,'g5:'+seed,{},now-60000);ticks++;
  const flips=WR.IDS.filter(id=>before[id]!==x.o[id]).length,goFlips=out.filter(r=>r.kind==='go').length;if(!goFlips)maxFlips=Math.max(maxFlips,flips);const P=WR.parasiteHeld(x);if(P<3||P>8||WR.TERRITORIES.some(t=>t.heart&&x.o[t.id]!=='h'))bad++;}}
 ok(ticks===10000&&bad===0&&maxFlips<=1,'10,000 war turns: Parasites always 3-8, heartland never captured, at most one territory changes hands a turn outside the Grand Offensive (max '+maxFlips+')');}

// ---- decision 2: the clock -------------------------------------------------------------------------------------------------------
{ok(WAR.tickMs===6*H&&WAR.warnMs===12*H&&WR.warnTicks()===2,'a tick every 6 hours; announced 12 hours (two ticks) ahead; single settings');
 const w=WR.fresh(T0);w.sc={n:9,done:1};let first=null;for(let k=1;k<=40&&!first;k++){const out=WR.advance(w,T0+k*WAR.tickMs,'clock',{},T0+k*WAR.tickMs-1000);first=out.find(r=>r.kind==='announce');}
 ok(first&&first.ev.l===first.ev.a+2,'an announced event lands two ticks later');
 const e=first.ev,j=WR.joinable(w,e.a*WAR.tickMs+1);ok(j.some(x=>x.id===e.id),'joinable from its announcement');ok(!WR.joinable(w,e.l*WAR.tickMs).some(x=>x.id===e.id),'not joinable once it lands');}

// ---- decision 3: fighting in person ---------------------------------------------------------------------------------------------
{const now=T0+3*H,w=WR.fresh(T0);w.sc={n:9,done:1};w.f.oxygen=2;w.pk.oxygen=2;const k=WR.tickOf(now);
 w.ev.push({id:'a1',k:'a',t:'oxygen',g:'rheel',a:k,l:k+2,air:0,ds:0});ok(WR.begin(w,'a1',7,now),'the battle begins: the one attempt is spent');ok(!WR.begin(w,'a1',8,now),'one attempt per assault');
 const r=WR.settle(w,'a1',true,now,7);ok(r.won&&w.o.oxygen==='h'&&w.f.oxygen===2&&w.en.oxygen===now+WAR.entrenchMs,'a win holds, keeps its fortification and entrenches 24 h');
 ok(!WR.joinable(w,now).some(x=>x.t==='oxygen')&&!WR.TERRITORIES.filter(t=>WR.attackable(t)).some(t=>w.ev.some(e=>e.t==='oxygen')),'the assault is gone');
 const cands=[];for(let s=0;s<60;s++){const x=structuredClone(w);x.ev=[];for(let kk=k+1;kk<k+4;kk++){const e=null;WR.step(x,kk,'en'+s,{});}cands.push(...x.ev.map(e=>e.t));}ok(!cands.includes('oxygen'),'no assault targets an entrenched territory for 24 h');
 // a loss counts as if you hadn't come: the roll decides at landing and wear applies
 const v=WR.fresh(T0);v.sc={n:9,done:1};v.f.helium=3;v.pk.helium=3;v.ev.push({id:'a2',k:'a',t:'helium',g:'skaal',a:k,l:k+2,air:0,ds:0,sc:0});WR.begin(v,'a2',9,now);const lr=WR.settle(v,'a2',false,now,9);ok(lr&&!lr.won&&v.o.helium==='h'&&v.f.helium===3,'a loss changes nothing now');
 WR.advance(v,(k+2)*WAR.tickMs,'loss',{},now);ok(v.o.helium==='h'&&v.f.helium===2&&v.log.some(x=>x.t==='helium'&&x.r==='held'&&x.w),'at landing the strength roll decides (held here) and wear knocks it down a level');
 // the same when joining an LDF counterattack
 const c=WR.fresh(T0);c.sc={n:9,done:1};c.o.crossroads='p';c.ev.push({id:'c1',k:'c',t:'crossroads',g:null,a:k,l:k+2,air:0,ds:0});WR.begin(c,'c1',3,now);WR.settle(c,'c1',true,now,3);ok(c.o.crossroads==='h'&&c.en.crossroads>now,'a counterattack won in person retakes the territory, entrenched');
 const c2=WR.fresh(T0);c2.sc={n:9,done:1};c2.o.crossroads='p';c2.ev.push({id:'c2',k:'c',t:'crossroads',g:null,a:k,l:k+2,air:0,ds:0,sc:.999});WR.begin(c2,'c2',3,now);WR.settle(c2,'c2',false,now,3);ok(c2.o.crossroads==='p','a counterattack lost in person changes nothing now');WR.advance(c2,(k+2)*WAR.tickMs,'c2',{},now);ok(c2.o.crossroads==='p'&&c2.log.some(x=>x.t==='crossroads'&&x.r==='failed'),'then the LDF\'s strength roll decides it (failed here)');}

// ---- decision 4: the limits ------------------------------------------------------------------------------------------------------
{// at most 2 territories net in any 24 h from battles nobody fought, whether you logged in or not
 let worst=0;for(let seed=0;seed<200;seed++){const w=WR.fresh(T0);w.sc={n:9,done:1};const hist=[];for(let k=1;k<=60;k++){const now=T0+k*WAR.tickMs,b=WR.parasiteHeld(w);WR.advance(w,now,'d4:'+seed,{},now-1000);hist.push(WR.parasiteHeld(w)-b);}
  for(let i=0;i+4<=hist.length;i++)worst=Math.max(worst,hist.slice(i,i+4).reduce((a,x)=>a+x,0));}
 ok(worst<=2,'unfought battles never cost more than 2 territories net in any 24 h (worst '+worst+')');
 // after one full day away the front holds until you return; then what was announced keeps its time left (guardrail 6)
 const w=WR.fresh(T0);w.sc={n:9,done:1};const k=WR.tickOf(T0+18*H);w.ev.push({id:'a5',k:'a',t:'oxygen',g:'ixa',a:k,l:k+2,air:0,ds:0,sc:.999});const seen=T0+1000,back=T0+5*D;   // announced late on the day you left: it would land after the front froze
 const o0={...w.o};const out=WR.advance(w,back,'away',{},seen);const moved=WR.IDS.filter(id=>o0[id]!==w.o[id]).length,frozen=out.find(r=>r.kind==='frozen');
 ok(frozen&&frozen.n>0&&w.ev.some(e=>e.id==='a5'),'away 5 days: the front froze after the first day ('+frozen?.n+' ticks frozen)');
 ok(moved<=2,'away five days: at most 2 territories moved (all inside the first day), moved '+moved);
 const e=w.ev.find(e=>e.id==='a5');ok(e.l*WAR.tickMs>back,'the inbound assault keeps its time left after the freeze');
 // the war needs no one: a year with no request never throws, never stalls (guardrail 7)
 const z=WR.fresh(T0);let threw=false;try{WR.advance(z,T0+365*D,'empty',{},T0);WR.advance(z,T0+365*D+WAR.tickMs,'empty',{},T0+365*D);}catch(_){threw=true;}ok(!threw&&z.k===WR.tickOf(T0+365*D+WAR.tickMs),'a year with no requests: no error, the clock is current');
 // accomplishments are permanent: trophies stay through any change of hands
 const t=WR.fresh(T0);WR.beatGeneral(t,'rheel',T0);WR.flip(t,'oxygen','p',WR.tickOf(T0),T0);const n=WR.norm(structuredClone(t),T0+9*D);ok(n.tro.rheel===T0,'a general\'s trophy is permanent');}

// ---- decision 5: strength --------------------------------------------------------------------------------------------------------
{const p=d=>WR.chance(d);ok(p(0)===.5&&Math.abs(p(1)-.7)<.005&&Math.abs(p(2)-.845)<.005&&Math.abs(p(3)-.927)<.005,'even 50%, +1 70%, +2 84.5%, +3 92.7%');
 ok([1,2,3].every(d=>Math.abs(p(-d)-(1-p(d)))<1e-9),'the same in reverse when behind');ok([-99,-6,-4,4,6,99].every(d=>p(d)>=.05&&p(d)<=.95)&&p(9)===.95&&p(-9)===.05,'always between 5% and 95%');
 const w=WR.fresh(T0),e={id:'x',k:'a',t:'oxygen',g:'ixa',air:0,ds:0},a=WR.threatOf(w,e,{now:T0,tiers:0}).total,b=WR.threatOf(w,e,{now:T0,tiers:2}).total;ok(b===a+2,'each Citadel tier cleared adds THREAT');
 ok(WR.defenseOf(w,'oxygen',{now:T0}).parts.every(x=>x.k!=='morale'),'shared-war morale counts 0 until a shared-war result exists');
 const A=WR.ldfOf(w,'ash',{now:T0}).total,Hh=WR.holdOf(w,'ash',{now:T0}).total,o=WR.odds(w,{k:'c',t:'ash'},{now:T0});ok(o.p===WR.chance(A-Hh),'LDF counterattacks use the same rule in reverse');}

// ---- decision 6: Fortify ---------------------------------------------------------------------------------------------------------
{const F=WAR.fortify,c1=WR.fortifyCost('silt',1),c2=WR.fortifyCost('silt',2),f=WR.fortifyCost('western',1),wf=WR.fortifyCost('oxygen',1);
 ok(c1.cp===3700&&c1.alloy===650&&c1.helium===150,'level 1 (Rear) = about half a day of a regular pilot\'s Conquest income: 3,700 CP, 650 alloy, 150 He-3 (measured: dev/tests/conquest-war-pace.mjs)');
 ok(Math.abs(c2.cp/c1.cp-2.4)<.01&&Math.abs(f.cp/c1.cp-1.2)<.01&&Math.abs(wf.cp/c1.cp-1.45)<.01,'x2.4 a level, x1.0 / 1.2 / 1.45 by ring');
 ok(JSON.stringify(F.timeMs)===JSON.stringify([1,2,3,4,5].map(l=>CONQUEST.Plot.timeOf('refinery',l))),'the town\'s build timers (the Refinery\'s: '+F.timeMs.map(x=>x/1000+' s').join(', ')+')');
 ok(WR.fortifyCost('silt',2,false,true).cp===Math.round(c2.cp*.25),'rebuilding a worn level costs a quarter');
 // on the Worker: one at a time, banked resources, the job lands on the clock; a fallen territory loses its fortification
 let s=createState(R.STOCK_L,T0);s.ledger.cp=1e6;s.ledger.banked={alloy:1e6,biomass:1e6,helium:1e6};warQuiet(CONQUEST,s,T0);
 s=applyAction(s,{seq:1,action:'war-fortify',war:{t:'helium'}},T0+1000);ok(s.war.jobs.length===1&&s.ledger.cp===1e6-WR.fortifyCost('helium',1).cp,'Fortify debits banked CP, alloy and He-3');
 assert.throws(()=>applyAction(s,{seq:2,action:'war-fortify',war:{t:'western'}},T0+2000),/one fortification at a time/);pass++;
 assert.throws(()=>applyAction(s,{seq:2,action:'war-fortify',war:{t:'ash'}},T0+2000),/Parasites hold/);pass++;
 assert.throws(()=>applyAction(s,{seq:2,action:'war-fortify',war:{t:'colony'}},T0+2000),/cannot be fortified/);pass++;
 s=applyAction(s,{seq:2,action:'war-seen'},T0+20000);ok(s.war.f.helium===1&&!s.war.jobs.length,'level 1 stands after 15 s on the Worker clock');
 const w=s.war;w.f.helium=4;w.pk.helium=4;WR.flip(w,'helium','p',WR.tickOf(T0),T0);ok(!w.f.helium&&!w.pk.helium,'a fallen territory loses its fortification');}

// ---- decision 7: Station ---------------------------------------------------------------------------------------------------------
{let s=createState(R.STOCK_L,T0);warQuiet(CONQUEST,s,T0);const ids=['p1','p2','p3','p4'];s.bat={v:1,n:4,p:ids.map((id,i)=>({id,n:'Pilot '+i,cs:'CS'+i,r:i===1?'lancer':'',xp:0,rk:1+i,k:0,h:1,kit:null,at:T0})),ps:[{f:'wedge',ids:['p1']},{f:'wedge',ids:[]},{f:'wedge',ids:[]}],pa:0};
 assert.throws(()=>applyAction(s,{seq:1,action:'war-station',war:{t:'oxygen',p:['p2']}},T0+1000),/not threatened/);pass++;
 warEvent(CONQUEST,s,'oxygen',T0,{general:'ixa',air:1});
 assert.throws(()=>applyAction(s,{seq:1,action:'war-station',war:{t:'oxygen',p:['p1']}},T0+1000),/fielded/);pass++;   // with no Hangar, one pilot (the preset's first) is fielded
 assert.throws(()=>applyAction(s,{seq:1,action:'war-station',war:{t:'oxygen',p:['p2','p3','p4']}},T0+1000),/at most 2/);pass++;
 s=applyAction(s,{seq:1,action:'war-station',war:{t:'oxygen',p:['p2','p3']}},T0+1000);const v=WR.stationValue(s.bat.p,s.war.st.oxygen);ok(s.war.st.oxygen.length===2&&v>0&&v<=1,'two reserves stationed for free, +'+v+' DEFENSE (at most +1 for the pair)');
 const e=s.war.ev.find(x=>x.t==='oxygen'),th=WR.threatOf(s.war,e,{now:T0,pilots:s.bat.p});ok(th.parts.some(p=>p.k==='downed'),'a stationed Lancer shoots down a landing dropship');
 const {isStationed}=await import('../../worker/src/conquest-war.js');ok(isStationed(s,'p2')&&!isStationed(s,'p4'),'a stationed reserve is marked (it cannot garrison the town: Session 7T)');
 s=applyCommands(s,{seq:2,commands:[{x:0,z:0}]},e.l*WAR.tickMs+1000);ok(!s.war.st.oxygen,'they return when the assault is decided');}

// ---- decision 8: the Lunar Pass perks, behind the store flag -----------------------------------------------------------------------
{const {passLive}=await import('../../worker/src/conquest-war.js');ok(R.LAB_STORE_OPEN===false&&passLive(true)===false,'the Pass perks wait for the store (Session 8)');
 ok(WR.fortifySlots(true)===2&&WR.fortifySlots(false)===1&&WR.fortifyCost('oxygen',3,true).cp===Math.round(WR.fortifyCost('oxygen',3).cp*.8/1)&&WR.fortifyTime(5,true)===Math.round(WR.fortifyTime(5)*.8),'with the Pass: a second slot, 20% cheaper, 20% faster');}

// ---- decision 9: the Grand Offensive ------------------------------------------------------------------------------------------------
{const w=WR.fresh(T0);w.sc={n:9,done:1};let ann=null;for(let k=WR.tickOf(T0)+1;k<WR.tickOf(T0+16*D)&&!ann;k++){const out=WR.advance(w,k*WAR.tickMs,'go',{},k*WAR.tickMs-1000);ann=out.find(r=>r.kind==='go-announce');}
 const g=ann.go,{dow,hour}=WR.goWeek(g.a);ok(ann&&dow===5&&hour===0,'announced Friday 00:00 UTC');ok(g.t.length>=1&&g.t.length<=WAR.go.targets&&g.end-g.open===8&&g.open-g.a===4,'about three territories ('+g.t.length+' free here: a territory already under an assault is not doubled up); open 24 h after the announcement for 48 h');
 {const q=WR.fresh(T0);q.sc={n:9,done:1};let a2=null;for(let k=WR.tickOf(T0+4*D);!a2;k++){a2=WR.step(q,k,'go-fresh',{}).find(r=>r.kind==='go-announce');q.ev=[];}ok(a2.go.t.length===3,'on a quiet front: exactly three targets');}
 const before={...w.o},Pb=WR.parasiteHeld(w);WR.advance(w,g.end*WAR.tickMs,'go',{},g.end*WAR.tickMs-1000);const lost=WR.IDS.filter(id=>before[id]==='h'&&w.o[id]==='p').length;
 ok(w.go.done&&w.log.some(x=>x.k==='g'&&x.r!=='announced'),'not started by the end of its window, it launches and each target is decided by strength');ok(lost<=2&&WR.parasiteHeld(w)<=8,'it may change more than one territory in a tick, inside the limits (lost '+lost+')');
 const e={id:'g',k:'a',t:g.t[0],g:g.g,air:1,ds:1,go:1};ok(WR.threatOf(w,e,{now:T0},true).parts.some(p=>p.k==='surge'),'each target carries the Grand Offensive\'s extra THREAT');
 // skipped while the front is frozen
 const z=WR.fresh(T0);z.sc={n:9,done:1};for(let k=WR.tickOf(T0)+1;!z.go;k++)WR.advance(z,k*WAR.tickMs,'go',{},k*WAR.tickMs-1000);const z0={...z.o},gg=z.go;WR.advance(z,(gg.end+2)*WAR.tickMs,'go',{},gg.a*WAR.tickMs);ok(z.go.skip&&WR.IDS.every(id=>z0[id]===z.o[id]||id!==gg.t[0]),'away through its window (front frozen): skipped');
 // won in person: every target holds, entrenched
 const y=WR.fresh(T0);y.sc={n:9,done:1};for(let k=WR.tickOf(T0)+1;!y.go;k++)WR.advance(y,k*WAR.tickMs,'go',{},k*WAR.tickMs-1000);const now=y.go.open*WAR.tickMs+H;WR.begin(y,'go'+y.go.w,4,now);WR.settle(y,'go'+y.go.w,true,now,4);ok(y.go.won&&y.go.t.every(id=>y.en[id]>now),'beaten in person: every target holds, entrenched');}

// ---- decision 10: rewards ---------------------------------------------------------------------------------------------------------
{ok(WR.battlePoints('a','oxygen')===R.CQ_PTS.defense&&R.CQ_PTS.defense===675,'a territory defense pays the existing Defense victory (sector), 675');
 ok(WR.battlePoints('c','western')===Math.round(3.33*225*1.2)&&WR.battlePoints('c','oxygen')===Math.round(3.33*225*1.45)&&WR.battlePoints('go','oxygen')===Math.round(5*225*1.45),'war battles: par x 225 x the ring\'s danger (counterattack '+WR.battlePoints('c','western')+' / '+WR.battlePoints('c','oxygen')+', Grand Offensive '+WR.battlePoints('go','oxygen')+')');
 ok(WR.battlePoints('c','refuge')===Math.round(3.33*225),'Heartland and Rear danger 1.0');
 // battles nobody fought pay nothing: a landed assault leaves the airdrop outbox untouched
 let s=createState(R.STOCK_L,T0);warQuiet(CONQUEST,s,T0);const e=warEvent(CONQUEST,s,'oxygen',T0,{roll:0});const pend=JSON.stringify(s.airdrop?.pend||null),cp=s.ledger.cp;
 s=applyCommands(s,{seq:1,commands:[{x:0,z:0}]},e.l*WAR.tickMs+1000);ok(JSON.stringify(s.airdrop?.pend||null)===pend&&s.ledger.cp===cp,'a battle nobody fought pays nothing');
 // supply: earned through fortification, max +16%, materials and CP only, never the yield's points
 const w=WR.fresh(T0);ok(WR.supply(w)===0,'supply starts at 0 (earned, not given: Checkpoint 46)');for(const t of WR.TERRITORIES)if(t.cap&&t.start==='h')w.f[t.id]=5;ok(WR.supply(w)===.16,'the whole front (all twelve) at level 5: +16% (the max)');
 w.f.western=4;ok(WR.supply(w)<.16&&WR.supply(w)>.155,'every level counts (a Frontier level: '+((.16-WR.supply(w))*100).toFixed(2)+'%)');w.f.western=5;WR.flip(w,'western','p',1,T0);ok(WR.supply(w)<.16,'a fallen territory feeds nothing');const b={tier:3,claimedAt:T0-D,pointsAt:T0-D},y0=C.baseYield(b,0,T0),y1=C.baseYield({...b,sup:.16},0,T0);
 ok(y1.cp>y0.cp&&y1.alloy>y0.alloy&&y1.pts===y0.pts,'supply raises the yield\'s CP and materials, never its points');}

// ---- decision 13: the scripted first war, on the clock --------------------------------------------------------------------------------
{let s=createState(R.STOCK_L,T0+H);const w0=s.war;ok(w0.sc.n===0&&!w0.ev.length,'a new pilot\'s war starts quiet');
 // the first day: the pilot plays, then leaves; S1 is announced and held by the LDF while away
 let now=T0+H;for(let h=1;h<=12;h++){now=T0+H+h*H;refreshState(s,now);s.lastWall=now;}const s1=s.war.ev.find(e=>e.t===WR.SCRIPT.s1);ok(s1,'S1: an assault on '+WR.SCRIPT.s1+' is announced while day 1 goes on');
 now=T0+H+26*H;refreshState(s,now);s.lastWall=now;   // back the next day (S1 landed at midnight)
 const rep=WR.report(s.war,now);ok(rep.items.some(x=>x.t===WR.SCRIPT.s1&&x.r==='held'&&x.by==='ldf'),'the first War Report: the LDF held '+WR.SCRIPT.s1);
 const s2=s.war.ev.find(e=>e.t===WR.SCRIPT.s2&&e.k==='a');ok(s2&&rep.inbound.some(e=>e.t===WR.SCRIPT.s2),'and one assault is inbound ('+WR.SCRIPT.s2+') when the pilot comes back');
 // the pilot defends it in person (the Worker path: start, win)
 const op=C.operations[WR.BY[WR.SCRIPT.s2].def];s.position=point(op.x-20,op.z+15);s.battle.enemies=[];s=applyAction(s,{seq:s.seq+1,action:'start-sector-defense',mission:op.id},now+1000);ok(s.mission===op.id,'the defense starts from its alert');
 s.battle.state='victory';s=applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0}]},now+2000);ok(s.settlement?.kind==='war-held'&&s.settlement.ptsRaw>0,'won in person: held, paid');s=applyAction(s,{seq:s.seq+1,action:'return-exploration'},now+3000);
 // days 2-4: the First Offensive's dropship lands a foothold on ground that exists today; the LDF counterattacks it
 let f1=null,c1=null;for(let h=1;h<=60&&!c1;h++){const t=now+h*H;s=applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0}]},t);s.lastWall=t;f1=f1||s.war.ev.find(e=>e.t===WR.SCRIPT.f1&&e.air);c1=s.war.ev.find(e=>e.k==='c');now=t;}
 ok(f1&&s.war.o[WR.SCRIPT.f1]==='p','F1: the First Offensive\'s dropship landed a Parasite foothold on '+WR.SCRIPT.f1);ok(c1&&c1.t===WR.SCRIPT.f1,'C1: the LDF counterattacks the foothold');
 const cop=C.operations[WR.BY[c1.t].cop];s.position=point(cop.x-20,cop.z+15);s.battle.enemies=[];s=applyAction(s,{seq:s.seq+1,action:'start-sector-defense',mission:cop.id},now+1000);ok(s.mission===cop.id&&s.battle.friends.filter(f=>f.side==='ldf').length===5,'the pilot joins the Joint Operation beside five LDF tanks');
 s.battle.state='victory';s=applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0}]},now+2000);ok(s.war.o[c1.t]==='h'&&s.settlement.kind==='war-retaken','and retakes it');s=applyAction(s,{seq:s.seq+1,action:'return-exploration'},now+3000);
 s=applyCommands(s,{seq:s.seq+1,commands:[{x:0,z:0}]},now+WAR.tickMs+5000);ok(s.war.sc.done&&s.war.sc.fort,'then Fortify is introduced and the war\'s own rolls take over');}

// a war battle being fought: only its own event waits (it never lands mid-fight); the rest of the clock runs
{const w=WR.fresh(T0);w.sc={n:9,done:1};const k=WR.tickOf(T0);w.ev.push({id:'a7',k:'a',t:'oxygen',g:'ixa',a:k,l:k+1,air:0,ds:0,tr:3,sc:.999},{id:'a8',k:'a',t:'helium',g:'nix',a:k,l:k+1,air:0,ds:0,sc:.999});
 WR.advance(w,(k+1)*WAR.tickMs,'fight',{fighting:'a7'},(k+1)*WAR.tickMs-1000);ok(w.ev.some(e=>e.id==='a7')&&!w.ev.some(e=>e.id==='a8'),'the event being fought waits for the battle; the others land');}
console.log('PASS conquest war (decisions 1-10 and 13; guardrails 5, 6, 7): '+pass+' checks');
