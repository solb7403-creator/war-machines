// Session 7T (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md) decisions 1, 2, 3 and 5 through the real Worker functions:
// town attacks on the war clock (from CC2, 1 a day through CC5 and 2 from CC6 in any 24 hours, 8 h apart, none in a new town's
// first 3 days, none while frozen, announced 12 h ahead, deterministic from the server seed), the unfought raid (the real raid
// engine on the town's actual layout and garrison, reproducible: the replay re-runs it), losses (FALLEN 10% of the exposed store
// + 5% of the composite stock, BREACHED 5%, HELD nothing; never banked goods, CP, the wallet or points), the 8-hour shield, the
// held raid's cache, wall milestones and base-defender (no airdrop points), the Peace Ward, the Grand Offensive's town target.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Plot:P,War:WR,Raid:RD,Town:TN}=CONQUEST;
const {createState,refreshState,applyAction}=await import('../../worker/src/conquest-sim.js');
const {plotOfSnap,garrisonOf}=await import('../../worker/src/conquest-town.js');
const {townPilot,townAttack,midTown}=await import('./lib/town-helpers.mjs');
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};const H=3600000,D=24*H,T=WR.WAR.tickMs;
const t0=Date.UTC(2026,10,23,1);   // a Monday, 01:00 UTC
// a pilot who checks in every 6 hours (never frozen): every tick processed, every landing decided unfought (never online at landing)
function live(s,from,days,step=6*H,vis=null){const land=[];let t=from;for(;t<from+days*D;t+=step){s.lastWall=t-step+60*60000;refreshState(s,t);for(const x of s.tw.log)if(!land.some(y=>y.id===x.id))land.push(x);vis?.(s,t);}return land;}
// ---- 1. eligibility and pace (decision 1) ----
{const s=townPilot(CONQUEST,R,createState,t0,{cc:1});live(s,t0,10);ok(!s.tw.log.length&&!s.tw.ev.length,'a CC1 town is never attacked (town attacks start at Command Center 2)');}
{const claimed=t0,s=townPilot(CONQUEST,R,createState,t0,{cc:3,claimed});const ann=[];const land=live(s,t0,14,6*H,(q)=>{for(const e of q.tw.ev)if(!ann.some(a=>a.id===e.id))ann.push({...e});});
 ok(land.length>=6,'a CC3 town is attacked about once a day ('+land.length+' in 14 days)');ok(land.every(x=>x.at>=claimed+3*D),'none in a new town\'s first 3 days (the first landed on day '+((land[0].at-claimed)/D).toFixed(2)+')');
 ok(ann.every(e=>e.go?e.l-e.a>=WR.warnTicks():e.l-e.a===WR.warnTicks()),'every attack is announced two ticks (12 hours) before it lands (the Grand Offensive\'s town target with its weekend: earlier)');
 const at=land.map(x=>x.at).sort((a,b)=>a-b);ok(at.every((x,i)=>!i||x-at[i-1]>=D),'CC2-5: at most 1 in any 24 hours (shortest gap '+Math.min(...at.slice(1).map((x,i)=>x-at[i]))/H+' h)');}
{const s=townPilot(CONQUEST,R,createState,t0,{cc:7});const land=live(s,t0,21),at=land.map(x=>x.at).sort((a,b)=>a-b),gaps=at.slice(1).map((x,i)=>x-at[i]);
 ok(gaps.every(g=>g>=8*H),'CC6+: at least 8 hours apart (shortest '+Math.min(...gaps)/H+' h)');ok(at.every((x,i)=>i<2||x-at[i-2]>=D),'CC6+: at most 2 in any 24 hours');
 ok(land.length/18>=1.1&&land.length/18<=2,'CC6+: about '+(land.length/18).toFixed(2)+' attacks a day after the first 3 days');
 const s2=townPilot(CONQUEST,R,createState,t0,{cc:7});const land2=live(s2,t0,21);ok(JSON.stringify(land2.map(x=>[x.id,x.at,x.g]))===JSON.stringify(land.map(x=>[x.id,x.at,x.g])),'the schedule is deterministic from the server seed');
 const s3=townPilot(CONQUEST,R,createState,t0,{cc:7});s3.twsd=12345;const land3=live(s3,t0,21);ok(JSON.stringify(land3.map(x=>x.at))!==JSON.stringify(land.map(x=>x.at)),'another pilot\'s seed gives another schedule');
 ok(land.every(x=>x.th>=1&&x.lv>=1&&x.lv<=10&&x.lv===(x.id==='t1'?1:TN.levelOf(x.th))),'each raid\'s level comes from its THREAT (the first, a teaching raid, at level 1: review B5) (never Command Center level): '+[...new Set(land.map(x=>x.th+'->L'+x.lv))].join(', '));}
// ---- 2. the freeze: after a full day away the town holds too; what was announced keeps its time left ----
{const s=townPilot(CONQUEST,R,createState,t0,{cc:7});s.lastWall=t0;const k0=WR.tickOf(t0),e=townAttack(CONQUEST,s,t0);e.a=k0+3;e.l=k0+5;s.tw.k=k0;   // announced 18 h after the pilot left, landing 29 h after it
 const left=e.l*T-(e.a*T);refreshState(s,t0+5*D);ok(!s.tw.log.some(x=>x.id===e.id)&&s.tw.ev.some(x=>x.id===e.id),'away more than a day: the raid landing after the first full day did not land while the front was frozen');
 const still=s.tw.ev.find(x=>x.id===e.id);ok(still.l*T>t0+5*D&&still.l*T-(t0+5*D)<=left,'it keeps its time left ('+((still.l*T-(t0+5*D))/H).toFixed(1)+' h after the return)');
 ok(s.tw.log.every(x=>x.at-t0<D)&&s.tw.ev.every(x=>x.id===e.id||x.a*T-t0<D||x.go),'and nothing else was announced or landed while frozen (all before the first full day: '+s.tw.log.length+' landed, '+s.tw.ev.length+' waiting)');
 s.lastWall=t0+5*D;refreshState(s,still.l*T+60000);ok(s.tw.log.some(x=>x.id===e.id),'back home, it lands when its time is up');}
// ---- 3. an unfought raid: the real engine, damage, losses, the shield, the replay ----
{const s=townPilot(CONQUEST,R,createState,t0,{cc:3});const p=s.plot,bmn0=JSON.stringify(s.airdrop||{}),cp0=s.ledger.cp,bank0=JSON.stringify(s.ledger.banked),cm0=p.cm,st0={...p.st};
 const e=townAttack(CONQUEST,s,t0);s.lastWall=t0;refreshState(s,e.l*T+30*60000);const x=s.tw.log.find(y=>y.id===e.id);
 ok(x&&x.o==='fallen'&&x.by==='away','an undefended CC3 town falls to its raid ('+x?.o+', Command Center '+x?.core+'%)');
 ok(P.hpLeft(p,'cc')>=1&&p.dmg.cc>0,'the damage stays until REPAIR (the Command Center is never left below 1 HP)');
 const L=P.loot({...p,dmg:{}});ok(x.tk&&x.tk.cm===Math.floor(cm0*.05),'FALLEN: 5% of the composite stock taken ('+x.tk.cm+' of '+cm0+')');
 ok(x.tk.alloy>0&&x.tk.alloy<=Math.ceil(st0.alloy*.75*.1)+1,'FALLEN: 10% of the production store the Storage Depot does not protect ('+x.tk.alloy+' alloy of '+Math.floor(st0.alloy)+')');
 ok(s.ledger.cp===cp0&&JSON.stringify(s.ledger.banked)===bank0,'never banked goods or CP');ok(JSON.stringify(s.airdrop||{})===bmn0,'never points (and no airdrop outbox entry for an unfought raid)');
 ok(p.shieldUntil===x.at+8*H,'an 8-hour shield after a loss');
 const rp=s.tw.rp;ok(rp&&rp.id===e.id&&rp.town&&Number.isSafeInteger(rp.seed),'the replay is stored: seed, level, lane and the town as it stood');
 const Rr=RD.make(plotOfSnap(rp.town),rp.seed,{threat:rp.lv,lane:rp.ln,units:rp.u,damage:true}).run();ok(RD.outcomeOf(Rr)===x.o&&Rr.core===x.core&&Rr.kills===x.k,'the replay re-runs to the very same result ('+Rr.kills+' kills, Command Center '+Rr.core+'%) with frames to draw ('+Rr.frames.length+')');
 // a raid that lands inside the shield is called off
 const e2=townAttack(CONQUEST,s,x.at+H);e2.l=WR.tickOf(x.at)+1;s.lastWall=x.at+H;refreshState(s,e2.l*T+60000);ok(s.tw.log.find(y=>y.id===e2.id)?.o==='called','a raid landing inside the shield is called off');}
// ---- 4. a held raid: the cache, the wall milestones, base-defender, no points ----
{const s=townPilot(CONQUEST,R,createState,t0,{cc:10,strong:true});const cp0=s.ledger.cp,b0={...s.ledger.banked},wins0=s.base.defense.wins,ad0=JSON.stringify(s.airdrop||{});
 const e=townAttack(CONQUEST,s,t0,{g:'skaal'});s.lastWall=t0;refreshState(s,e.l*T+60000);const x=s.tw.log.find(y=>y.id===e.id);
 ok(x?.o==='held','a strong CC10 town holds ('+x?.o+', '+x?.k+'/'+x?.sp+')');ok(s.ledger.cp===cp0+TN.TOWN.cache.cp&&s.ledger.banked.alloy===b0.alloy+15&&s.ledger.banked.biomass===b0.biomass+10&&s.ledger.banked.helium===b0.helium+2,'a held unfought raid pays the existing defense cache (160 CP, 15 alloy, 10 biomass, 2 He-3)');
 ok(s.base.defense.wins===wins0+1&&s.plot.ext.w>=wins0+1&&s.achievements['base-defender'],'it counts toward the wall milestones (3 / 10 wins) and base-defender');ok(JSON.stringify(s.airdrop||{})===ad0&&!x.pts,'and pays no airdrop points (nobody played)');
 ok(!x.tk&&!(s.plot.shieldUntil>x.at),'held: nothing taken, no shield');}
// ---- 5. breached: a building lost, the Command Center standing: 5% of the exposed store ----
{let found=null;for(const site of ['ridge','ash','ice','delta','crater'])for(const g of WR.GENERALS.map(x=>x.id)){if(found)break;const s=townPilot(CONQUEST,R,createState,t0,{cc:6});const p=midTown(P,site);p.at=s.plot.at;p.st={...s.plot.st};p.cm=s.plot.cm;s.plot=p;
  const e=townAttack(CONQUEST,s,t0,{g});s.lastWall=t0;const st={...s.plot.st};refreshState(s,e.l*T+60000);const x=s.tw.log.find(y=>y.id===e.id);if(x?.o==='breached'){found={x,st,site,g};break;}}
 ok(found,'a raid can breach without taking the Command Center ('+found?.site+', '+found?.g+')');const L5=found.x.tk||{};ok(!L5.cm&&(L5.alloy|0)<=Math.ceil(found.st.alloy*.75*.05)+1,'BREACHED: 5% of the exposed production store, no composite ('+JSON.stringify(L5)+')');}
// ---- 6. the garrison: the reserve pilots fight; a downed one is never lost (half hull, REPAIR) ----
{const s=townPilot(CONQUEST,R,createState,t0,{cc:4});const p=s.plot;p.b.h1={t:'hangar',...P.autoPlace(p,'hangar'),l:2};
 s.bat={p:[1,2,3,4,5,6].map(i=>({id:'p'+i,n:'N'+i,cs:'CS'+i,r:'',xp:0,rk:1,k:0,h:1,kit:{w:{a:'pulse',t:1,q:1,s:false},c:{c:'titan',t:1,q:1,s:false}},at:t0,src:'recruit'})),ps:[{f:'wedge',ids:[]},{f:'wedge',ids:[]},{f:'wedge',ids:[]}],pa:0};
 refreshState(s,t0);const g=garrisonOf(s);ok(g.length===2&&g.every(x=>!['p1','p2','p3','p4'].includes(x.id)),'the garrison: reserves only (not the 4 the Hangar fields), one slot per Hangar level ('+g.map(x=>x.id).join(',')+')');
 s.war.st={helium:['p5']};ok(garrisonOf(s).every(x=>x.id!=='p5'),'a stationed reserve cannot garrison the town (Station stays as shipped)');s.war.st={};
 const e=townAttack(CONQUEST,s,t0);s.lastWall=t0;refreshState(s,e.l*T+60000);const x=s.tw.log.find(y=>y.id===e.id),dn=s.bat.p.filter(q=>q.h===.5);
 ok(s.tw.rp.u.length===2,'both garrison pilots fought the raid (they are in its replay)');ok(dn.length===(x.dn|0)&&s.bat.p.length===6,'a downed garrison pilot is never lost: '+dn.length+' at half hull, the roster still 6');}
// ---- 7. the Grand Offensive's town target counts as one of that day's attacks; beaten in person it is called off ----
{const s=townPilot(CONQUEST,R,createState,t0,{cc:7});s.war.t0=t0-10*D;const fri=Date.UTC(2026,10,27,0),kf=WR.tickOf(fri);let t=fri-6*H;for(;t<=fri;t+=H){s.lastWall=t-H;refreshState(s,t);}
 const GO={w:Math.floor(fri/D),a:kf,open:kf+4,end:kf+12,g:'malgrath',t:['western','helium','ridge']};
 // review (round 2): a town that was never raided is not a target: its first attack stays the teaching raid (test changed for this rule)
 {const n=structuredClone(s);n.tw=TN.norm(n.tw,fri);n.tw.ev=[];n.tw.log=[];n.tw.n=0;n.war.go={...GO};for(let u=fri+H;u<=fri+2*H;u+=H){n.lastWall=u-H;refreshState(n,u);}ok(!n.tw.ev.some(e=>e.go),'a town never raided is not a Grand Offensive target (its first attack is the teaching raid)');}
 if(!s.tw.log.some(x=>x.o!=='called')){s.tw.log.push({id:'t0',at:fri-2*D,o:'held',by:'away',lv:1,th:1,g:'skaal'});s.tw.n=Math.max(s.tw.n|0,1);}   // this town met its teaching raid two days before
 s.war.go={...GO};for(t=fri+H;t<=fri+2*H;t+=H){s.lastWall=t-H;refreshState(s,t);}   // the weekend's Grand Offensive, announced Friday 00:00 UTC (Session 7's own rules make it; this test is about its town target)
 const go=s.war.go,ge=s.tw.ev.find(e=>e.go);ok(go&&ge&&ge.l===go.end,'the weekend Grand Offensive adds the town as a target, landing at its window\'s end ('+new Date(ge.l*T).toISOString()+')');
 const slots=TN.goSlots(s.war,ge.l*T-D,ge.l*T+D);ok(slots.includes(ge.l*T),'its landing is the slot held back for it');
 s.war.go.won=1;s.war.go.done=1;for(t=fri+3*H;t<=ge.l*T+6*H;t+=6*H){s.lastWall=t-H;refreshState(s,t);}ok(s.tw.log.find(x=>x.id===ge.id)?.o==='called','beaten in person, the Grand Offensive\'s town target is called off');
 const all=s.tw.log.filter(x=>x.o!=='called').map(x=>x.at).concat([ge.l*T]).sort((a,b)=>a-b);ok(all.every((x,i)=>i<2||x-all[i-2]>=D),'with it, still at most 2 town attacks in any 24 hours');}
// ---- 8. the Peace Ward (24 h, earned as rare loot, never sold) ----
{const s=townPilot(CONQUEST,R,createState,t0,{cc:6});const e=townAttack(CONQUEST,s,t0);s.tw.ws=1;let r=applyAction(s,{seq:s.seq+1,action:'town-ward'},t0+60000);
 ok(r.plot.shieldUntil>=t0+60000+24*H-1&&r.tw.ws===0&&r.tw.log.find(x=>x.id===e.id)?.o==='called','a Peace Ward: 24 hours of shield; the raid it covers is called off');
 assert.throws(()=>applyAction(r,{seq:r.seq+1,action:'town-ward'},t0+120000),/no Peace Ward/);ok(true,'no ward left: refused');
 ok(R.LOOT.defense.rows.some(x=>x.ward)&&R.LOOT.strike.rows.some(x=>x.ward)&&!JSON.stringify(P.STORE.items).includes('ward'),'the Peace Ward drops as rare loot (live town defenses, Meteor Strikes) and is in no store');}
// review B5: the first attack on a town is a teaching raid: a one-star general at level 1
{const s=townPilot(CONQUEST,R,createState,t0,{cc:3,claimed:t0-4*D});let first=null;for(let t=t0;t<t0+5*D&&!first;t+=6*H){s.lastWall=t-5*H;refreshState(s,t);first=(s.tw.ev||[]).find(e=>e.first)||null;}
 ok(first&&WR.GEN[first.g].stars===1&&TN.strength(s.war,first,{now:t0,tiers:0}).level===1,'the first attack on a town is a scouting party: '+(first?WR.GEN[first.g].name+' (1 star), raid level 1':'none'));
 const later=TN.step(TN.norm({...s.tw,ev:[],log:[{id:'t9',at:1,o:'held',by:'away',lv:1,th:1,g:'skaal'}],n:5},t0),WR.tickOf(t0)+40,{cc:3,townAt:0,shieldUntil:0,war:s.war,tiers:0,seed:'x'},null);ok(!later.some(x=>x.ev?.first),'only the first');}
// review (round 2), decision 9: the War Report lists the town's raids since it was last read (a held raid appears only there and on the
// hub card), and a fresh one opens the report; reading it (war-seen) clears them
{globalThis.ConquestWar=WR;globalThis.ConquestTown=TN;await import('../../js/conquest/warmap.js');const WM=globalThis.ConquestWarMap,now=Date.now();
 const s={war:WR.norm(WR.fresh(now-5*D),now),tw:TN.norm(null,now)};s.war.sc={n:9,done:1};s.war.ev=[];s.war.go=null;s.war.rep=now-3*H;
 s.tw.log=[{id:'t1',at:now-2*H,o:'held',by:'away',lv:2,th:2,g:'skaal',cache:1},{id:'t0',at:now-9*H,o:'breached',by:'away',lv:2,th:2,g:'skaal'},{id:'go5',at:now-H,o:'called',by:'away',lv:3,th:3,g:'malgrath'}];
 const texts=[],node=(tag,cls,text)=>({tag,cls,text,children:[],append(...x){this.children.push(...x);},classList:{add(){}},set textContent(v){this.children=[];},get textContent(){return '';}}),
  el=(tag,cls,text,parent)=>{const e=node(tag,cls,text);if(text)texts.push(text);if(parent)parent.children.push(e);return e;},button=(label,fn,cls)=>{texts.push(label);return node('button',cls,label);};
 ok(WM.shouldReport(s),'a raid on the town since the report was last read opens the War Report');
 WM.report(node('section'),s,{el,button,done(){},defend(){},map(){}});const lines=texts.filter(t=>/YOUR TOWN/.test(t));
 ok(lines.length===1&&/YOUR TOWN HELD · level 2 · GRUB-CAPTAIN SKAAL · defense cache paid/.test(lines[0]),'it lists the held raid (only the one since it was read; a called-off target never): '+lines.join(' | '));
 s.war.rep=now;ok(!WM.shouldReport(s),'read (war-seen), nothing new: no report');}
console.log('PASS away raids (decisions 1, 2, 3, 5): '+pass+' checks');
