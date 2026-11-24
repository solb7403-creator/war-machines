// Session 7T Living Town on the Worker (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md; the rules are js/conquest/townwar.js and
// the raid engine js/conquest/raid.js, shared with the phone). Server-authoritative, in the pilot's own Conquest record:
//  - the town clock (s.tw) runs on every request, inside plotSync BEFORE the town's own clock settles, so a raid that landed while
//    you were away meets the town exactly as it stood at its landing (its builder job finished or not, its store at that hour);
//  - an unfought raid (decision 5) is the real raid engine on the Worker against the town's actual layout and garrison, seeded from
//    the server-only loot seed and reproducible: its replay (s.tw.rp) re-runs the same seed on the phone;
//  - losses (decision 2): damage stays until REPAIR; FALLEN takes 10% of the exposed production store and 5% of the composite stock,
//    BREACHED 5% of the exposed store, HELD nothing; never banked goods, the wallet, CP, points, plates, cosmetics or inventory; an
//    8-hour shield after a loss; the Peace Ward (24 h, rare loot, never sold);
//  - a held unfought raid pays the existing defense cache, counts toward the wall milestones and base-defender; no airdrop points;
//  - defending in person (decision 6): the raid engine runs here in real time at the world's 50 ms step, one input request at a time
//    (s.td, the live state; s.tdp, the town as it stood when the fight began); the result is the better of the pilot's fight and the
//    unfought replay; a held fight pays 675 defense points inside the hourly limit and the cap; one attempt per attack;
//  - the garrison (decision 7): the reserve pilots, one slot per Hangar level up to 5, fight in every raid; a downed one returns at half
//    hull (never lost; REPAIR ALL fixes it).
import {CONQUEST,RULES} from './sim.gen.js';
import {earn} from './conquest-airdrop.js';
import {cacheMinerals} from './conquest-economy.js';
import {roll,bind,empty,u32} from './conquest-loot.js';
import {orderEvent} from './conquest-orders.js';
import {track} from './conquest-analytics.js';
import {bat,hangarLevel} from './conquest-battalion.js';
import {tick as researchTick} from './conquest-research.js';
const {Plot:P,Raid:RD,War:WR,Combat:C,Battalion:BT,Town:TN}=CONQUEST,T=TN.TOWN,HOUR=3600000;
const fail=m=>{throw Error('conquest: '+m);};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
export const TOWN_ACTIONS=['town-defend','town-leave','town-ward','town-seen','strike-beacon'];
export function town(s,now){s.tw=TN.norm(s.tw,now);return s.tw;}
// the town's own server-only seed (review: the raid seeds a replay shows must reveal nothing of the loot seed s.lseed)
function townSeed(s){if(!Number.isSafeInteger(s.twsd)||s.twsd<=0){const a=new Uint32Array(1);crypto.getRandomValues(a);s.twsd=a[0]||1;}return s.twsd;}
const seedOf=s=>String(townSeed(s))+':town';
const infoOf=(s,now)=>({cc:s.plot?.cc|0,townAt:Number(s.base?.builtAt)||Number(s.plot?.at)||0,shieldUntil:Number(s.plot?.shieldUntil)||0,war:s.war,tiers:0,seed:seedOf(s)});   // tiers: the Citadel arrives with 7B (tiers I-III) and Session 11 (IV-IX); pass them here, to settle's cit, to the town-defend start and to townui.js's hub preview together
// ---- the garrison (decision 7): the reserve pilots (not fielded, not stationed, not downed), strongest first, one a Hangar level ------
export function garrisonOf(s){const T0=bat(s),slots=P.garrisonSlots(s.plot);if(!slots)return [];const fielded=BT.picked(T0,hangarLevel(s),'battalion').map(p=>p.id);
 return WR.reserves(T0.p,fielded,s.war).map(p=>({p,r:WR.rating(p)})).sort((a,b)=>b.r-a.r||a.p.id.localeCompare(b.p.id)).slice(0,Math.min(5,slots)).map(x=>x.p);}
const unitsOf=pilots=>pilots.map(p=>RD.unitOf({id:p.id,kind:'g',kit:p.kit||BT.militia(p.r),rk:p.rk,role:p.r}));
// ---- the clock: every request (from plotSync) ---------------------------------------------------------------------------------------
export function townClock(s,now){const p=s.plot;if(!p||!s.base?.tier)return [];const tw=town(s,now);s.war=WR.norm(s.war,now);const info=infoOf(s,now),seen=Number(s.lastWall)||now;
 TN.goSync(tw,info);
 const out=TN.advance(tw,now,info,(e,at)=>landing(s,e,at,now,seen),seen);
 // a last chance that ran out: the raid is decided unfought at its end
 for(const e of tw.ev.filter(x=>x.lc&&x.lc<=now&&!x.tr)){tw.ev.splice(tw.ev.indexOf(e),1);const r=settle(s,e,e.lc,null);tw.past=[...tw.past,e.l*WR.WAR.tickMs].slice(-6);out.push({kind:'land',ev:e,r});}
 // a live defense left without input finishes without the pilot (the rest of the fight runs; the better result counts)
 if(s.td?.active&&now-(s.td.last||now)>T.idleMs)liveFinish(s,now,'idle');
 // the first town attack announced makes the game's alerts live (decision 9; Session 7 did this at the first war battle): from here
 // the phone offers browser alerts, and "RAID INCOMING · DEFEND IT" can reach the pilot while away
 if(out.some(x=>x.kind==='announce')){if(!record(s.al))s.al={};s.al.ask=1;}
 return out;}
// The town's alert events (decision 9, the Worker's cron sends them inside the one budget): the attacks the pilot can still defend
// (type 'town', until their landing or the last chance), and, run forward on a copy of the record to `horizon` (the freeze: nothing
// changes while the pilot is away), the attacks the clock will announce and the raids that will breach the town (type 'breach': REPAIR
// and the replay; a held raid is only in the War Report). The real clock and raid engine decide them, so an alert never promises
// what the next request would not show. Only times, ids and the general leave the record.
export function townAlerts(s,now,horizon){const p=s.plot;if(!p||!s.base?.tier)return [];const tw=town(s,now),Tk=WR.WAR.tickMs,out=[];
 for(const e of TN.defendable(tw,now))out.push({id:'tw'+e.id,ty:'town',at:e.a*Tk,until:e.lc||e.l*Tk,...(e.g?{g:e.g}:{})});
 if(!(horizon>now))return out;let c;try{c=structuredClone(s);}catch(_){return out;}
 for(let k=WR.tickOf(now)+1;k*Tk<=horizon;k++){let res;try{res=townClock(c,k*Tk+1);}catch(_){break;}
  for(const x of res){const e=x.ev;if(!e||typeof e.id!=='string')continue;if(x.kind==='announce')out.push({id:'tw'+e.id,ty:'town',at:e.a*Tk,until:e.l*Tk,...(e.g?{g:e.g}:{})});
   else if(x.kind==='land'&&(x.r==='breached'||x.r==='fallen'))out.push({id:'tb'+e.id,ty:'breach',at:e.l*Tk,until:e.l*Tk+16*HOUR,o:x.r});}}
 return out;}
// an attack landing at `at`: the Grand Offensive's target is called off when the Grand Offensive was beaten in person; a pilot online
// at the landing (a request in the 2 minutes before it, and this request within 2 minutes after) gets the 60-second last chance
function landing(s,e,at,now,seen){if(e.tr&&s.td?.active&&s.td.id===e.id)return 'wait';   /* review R2-B1: the attack being fought lands when the fight ends (liveEnd) */const w=s.war;if(e.go&&w?.go&&'go'+w.go.w===e.id&&w.go.won){logOf(s,{id:e.id,at,o:'called',by:'you',g:e.g,go:1,why:'grand offensive beaten'});return 'called';}
 if(int(s.plot?.shieldUntil)>at){logOf(s,{id:e.id,at,o:'called',by:'away',g:e.g,why:'shield'});return 'called';}
 if(!s.mission&&!s.td?.active&&at-seen<T.onlineMs&&now-at<T.onlineMs){e.lc=now+T.lastChanceMs;s.notice={kind:'town-incoming',id:e.id,until:e.lc};return 'wait';}
 return settle(s,e,at,null);}
const int=v=>Math.max(0,Math.floor(Number(v)||0));
function logOf(s,x){const tw=s.tw;tw.log=[...tw.log,x].slice(-T.log);}
// the town as the raid sees it (and its replay): positions, levels, walls, the damage it already carries
function snapOf(p){return {site:p.site,cc:p.cc|0,b:Object.fromEntries(Object.entries(p.b||{}).map(([id,b])=>[id,[b.t,b.i,b.j,b.r|0,b.l|0]])),w:P.encWalls(p.w),dmg:{...(p.dmg||{})}};}
export const plotOfSnap=TN.plotOfSnap;   // shared with the phone's replay (js/conquest/townwar.js)
// ---- settle a raid (unfought, or after a live fight: live = {R the pilot's fight, fought: the pilot really fought}) ----------------------
// cit: the Citadel tiers cleared (0 until the Citadel passes them: until then a town attack is level 1-4, the Grand Offensive's target up to
// 7; the cap-level Selenite needs tiers VIII-IX). The session that passes them: the same value here, in infoOf, at the town-defend start
// and in the hub's preview (or pay a live fight at s.td.lv), so the level fought is the level paid
export function settle(s,e,at,live,cit=0){const p=s.plot,tw=s.tw;
 const job=P.settle(p,at);if(job)s.notice={kind:'plot-built',type:job.t,level:job.l};P.accrue(p,at);researchTick(s,at);
 const st=TN.strength(s.war,e,{now:at,tiers:Math.max(0,Math.min(9,cit|0)),titan:0}),lv=st.level,seed=u32(String(townSeed(s))+':town:'+e.id),gar=garrisonOf(s),units=unitsOf(gar),snap=snapOf(p);
 const R0=live?.uf||RD.make(p,seed,{threat:lv,lane:e.ln,units,damage:true,frames:false,events:false}).run();
 const rank=r=>({fallen:0,breached:1,held:2})[RD.outcomeOf(r)],lost=r=>Object.values(r.damage||{}).reduce((a,v)=>a+v,0);
 const useLive=!!live?.R&&(rank(live.R)>rank(R0)||rank(live.R)===rank(R0)&&lost(live.R)<=lost(R0)),R=useLive?live.R:R0,o=RD.outcomeOf(R);   // decision 6: the better of the two, so showing up never hurts
 // the replay: the same seed on the same town with the same garrison (an unfought result; a fight you won in person was its own picture)
 tw.rp=useLive?{id:e.id,at,o,by:'you'}:{id:e.id,at,seed,lv,ln:e.ln,o,by:'away',town:live?.snap||snap,u:live?live.gar:units};
 const G=WR.GEN[e.g];P.applyRaidDamage(p,R,at,(G?G.name:'Parasites')+(useLive?' · defended in person':''));
 // a downed garrison or Platoon pilot returns at half hull (never lost; REPAIR ALL repairs it)
 const T0=bat(s);let dn=0;for(const u of R.units||[])if(u.down&&u.k!=='p'){const pl=T0.p.find(x=>x.id===u.id);if(pl&&pl.h!==.5){pl.h=.5;dn++;}}
 const taken=TN.lossOf(o,P.loot(p),p.cm);for(const [k,v] of Object.entries(taken)){if(k==='cm')p.cm=Math.max(0,(p.cm||0)-v);else p.st[k]=Math.max(0,(p.st[k]||0)-v);}
 if(o!=='held')p.shieldUntil=Math.max(int(p.shieldUntil),at+T.shieldMs);
 const x={id:e.id,at,o,by:useLive||live?.fought?'you':'away',lv,th:st.total,g:e.g,core:R.core,k:R.kills,sp:R.spawned,fell:(R.fell||[]).length,wl:R.wallsLost|0,...(Object.keys(taken).length?{tk:taken}:{}),...(e.go?{go:1}:{}),...(dn?{dn}:{})};
 let receipt={kind:'town-raid',...x,shield:o!=='held'?p.shieldUntil:0};
 if(o==='held'){const pay=T.cache;s.ledger.cp+=pay.cp;for(const k of ['alloy','biomass','helium'])s.ledger.banked[k]=(s.ledger.banked[k]||0)+pay[k];x.cache=1;
  s.base.defense.wins=(s.base.defense.wins|0)+1;p.ext=record(p.ext)?p.ext:{r:0,d:0,w:0};p.ext.w=Math.max(p.ext.w|0,s.base.defense.wins);s.achievements=s.achievements||{};s.achievements['base-defender']=s.achievements['base-defender']||at;tw.won=(tw.won|0)+1;
  receipt={...receipt,cp:pay.cp,alloy:pay.alloy,biomass:pay.biomass,helium:pay.helium};
  // in person (decision 6): a defense the pilot held and really fought pays the 675 defense points (inside the hourly limit and the cap),
  // the defense minerals and a loot roll, like any defense won live; the general who led it is beaten (a trophy and a retreat)
  // (review: paid whenever the settled result is HELD and the pilot really fought, whichever of the two pictures counted)
  if(live?.fought){const pts=earn(s,'defense',RULES.CQ_PTS.defense,at,{op:true}),key='town:'+e.id,mn=cacheMinerals(s,'defense',key),loot=bind(s,roll(s,'defense',key),at,{where:'town defense'});
   const se=TN.seOf(lv);if(se){s.ledger.mn=s.ledger.mn||{};s.ledger.mn.se=(s.ledger.mn.se||0)+se;mn.se=(mn.se||0)+se;x.se=se;}   // Session 7T-P decision 2: a raid at the cap held in person drops Selenite (cargo, banked at the Refuge)
   x.pts=pts;orderEvent(s,'op');orderEvent(s,'defense');s.reputation=(s.reputation||0)+60;s.campaignScore=(s.campaignScore||0)+15;let trophy=null;if(G&&WR.beatGeneral(s.war,G.id,at)){trophy=G.id;s.achievements['general-'+G.id]=at;}
   receipt={...receipt,ptsRaw:pts,...(Object.keys(mn).length?{mn}:{}),...(empty(loot)&&!loot.pieces?{}:{loot}),reputation:60,...(trophy?{trophy}:{})};}}
 logOf(s,x);track(s,'town_raid',o,useLive?'live':'away');if(live)s.notice=receipt;return o;}
// ---- the pilot's town actions --------------------------------------------------------------------------------------------------------
// town-defend {town:{id}} · town-leave · town-ward · town-seen · strike-beacon (no town needed)
export function townAction(s,r,now,ctx={}){if(r.action==='strike-beacon'){beacon(s,now);return;}const tw=town(s,now),p=s.plot;if(!p||!s.base?.tier)fail('claim your town first');const q=record(r.town)?r.town:{};
 if(r.action==='town-seen'){tw.seen=now;s.notice={kind:'town-seen'};return;}
 if(r.action==='town-ward'){if(s.td?.active)fail('finish the defense first');if((tw.ws|0)<1)fail('no Peace Ward left: they drop as rare loot from defenses and Meteor Strikes');tw.ws--;tw.wu=now;p.shieldUntil=Math.max(int(p.shieldUntil),now)+T.wardMs;
  const off=tw.ev.filter(e=>!e.tr&&(e.lc||e.l*WR.WAR.tickMs)<p.shieldUntil);for(const e of off){tw.ev.splice(tw.ev.indexOf(e),1);logOf(s,{id:e.id,at:now,o:'called',by:'you',g:e.g,...(e.go?{go:1}:{}),why:'peace ward'});}
  s.notice={kind:'town-ward',until:p.shieldUntil,called:off.length,left:tw.ws};return;}
 if(r.action==='town-leave'){if(!s.td?.active)fail('no defense running');liveFinish(s,now,'left');return;}
 if(r.action==='town-defend'){liveStart(s,typeof q.id==='string'?q.id:'',now,ctx);return;}
 fail('invalid town action');}
// ---- defending in person (decision 6) --------------------------------------------------------------------------------------------------
// The fight starts at the town (the Command Gate); a pilot elsewhere in the open world is brought home first when nothing hostile is
// near (the fast-travel rule). The attempt is spent at once: a retreat or a reload never buys a second try.
function liveStart(s,id,now,ctx){const tw=s.tw,p=s.plot,e=tw.ev.find(x=>x.id===id);if(!e)fail('no raid on your town to defend');if(e.tr)fail('this raid was already fought: one attempt per attack');
 if(!(e.lc?e.lc>now:e.l*WR.WAR.tickMs>now))fail('this raid already landed');if(s.mission)fail('finish or leave the operation first');if(s.td?.active)fail('a defense is already running');if(s.hp<=0)fail('Machine disabled');
 const D=C.baseDefinition;if(Math.hypot(s.position.x-D.x,s.position.z-D.z)>D.radius){if(typeof ctx.travel==='function'){const why=ctx.travel();if(why)fail(why);}else fail('return to your town first');}
 e.tr=s.attempt=(s.attempt|0)+1;
 const job=P.settle(p,now);if(job)s.notice={kind:'plot-built',type:job.t,level:job.l};P.accrue(p,now);
 const st=TN.strength(s.war,e,{now,tiers:0,titan:0}),seed=u32(String(townSeed(s))+':town:'+e.id),gar=unitsOf(garrisonOf(s)),T0=bat(s),gid=new Set(gar.map(u=>u.id));
 const plat=BT.picked(T0,hangarLevel(s),'platoon').filter(x=>!gid.has(x.id)&&x.h!==.5).map(x=>RD.unitOf({id:x.id,kind:'f',kit:x.kit||BT.militia(x.r),rk:x.rk,role:x.r}));
 const me=RD.unitOf({id:'you',kind:'p',L:s.loadout}),units=[...gar,...plat,me],pad=padOf(p);
 const uf=RD.make(p,seed,{threat:st.level,lane:e.ln,units:gar,damage:true,frames:false,events:false}).run();   // the unfought replay, now (the better of the two counts)
 s.tdp=snapOf(p);s.td={active:true,id:e.id,seed,lv:st.level,ln:e.ln,th:st.total,g:e.g,t0:now,last:now,n:0,units,pilot:pad,st:null,uf:{o:RD.outcomeOf(uf),core:uf.core,k:uf.kills,sp:uf.spawned,fell:(uf.fell||[]).length}};s.tdu=uf;
 track(s,'town_defend',e.go?'go':'raid',String(st.level));s.notice={kind:'town-defend',id:e.id,lv:st.level};}
// the pilot's start: the gate pad (the town drive's own: the nearest free spot south of the Command Center)
function padOf(p){const cc=p.b?.cc,sz=P.sizeOf('cc',cc?.r|0),x=P.cellX(cc.i)+(sz.w-1)*P.GRID.cell/2,z=P.cellZ(cc.j)+(sz.d-1)*P.GRID.cell/2+sz.d*P.GRID.cell/2+10;return {x:Math.round(x*10)/10,z:Math.round(z*10)/10,h:Math.PI};}
// the machine for this request (restored from the last request's state, on the town as it stood when the fight began)
function machine(s){const d=s.td;return RD.make(plotOfSnap(s.tdp),d.seed,{threat:d.lv,lane:d.ln,units:d.units,dt:.05,pilot:d.pilot,state:d.st,damage:true,frames:false,events:false});}
// one input request's commands: one 50 ms raid step each (the world's step), the pilot's tank steered and firing by them
export function liveSteps(s,commands,now){const d=s.td;if(!d?.active)return;const M=machine(s);for(const c of commands){if(M.over)break;M.step(c);}d.n=M.n;d.last=now;d.st=M.save();if(M.over)liveEnd(s,M,now,'done');}
// the fight ends: by itself (every wave down, the Command Center fallen or the clock), or the pilot left / went quiet: the rest runs
// without the pilot's commands
export function liveFinish(s,now,why){const d=s.td;if(!d?.active)return;const M=machine(s);let guard=0;while(!M.over&&guard++<20000)M.step(null);liveEnd(s,M,now,why);}
function liveEnd(s,M,now,why){const d=s.td,tw=s.tw,e=tw.ev.find(x=>x.id===d.id);const R=M.result(),me=(R.units||[]).find(u=>u.k==='p');
 // the pilot really fought (no AFK points, the standing owner rule): at least 5 raiders downed or 4% of the damage dealt to them
 const all=Object.values(R.byTurret||{}).reduce((a,t)=>a+t.dmg,0)+(R.units||[]).reduce((a,u)=>a+u.dmg,0),fought=!!me&&(me.kills>=5||me.dmg>=.04*all);
 d.active=false;delete d.st;
 if(e){tw.ev.splice(tw.ev.indexOf(e),1);tw.past=[...tw.past,now].slice(-6);const o=settle(s,e,now,{R,uf:s.tdu||null,fought,snap:s.tdp,gar:d.units.filter(u=>u.k==='g')});d.o=o;d.why=why;d.fought=fought?1:0;d.live=RD.outcomeOf(R);}
 delete s.tdu;delete s.tdp;s.td={active:false,id:d.id,o:d.o,live:d.live,why,fought:d.fought|0,at:now};s.notice={...(s.notice||{}),kind:'town-defended',live:d.live,why};}

// ---- the Strike Beacon (decision 10; the Nov 10 brief C): once a UTC day the pilot calls a Meteor Strike at the current slot's site, for
// 20 minutes from the call (a window of their choosing). start-mission accepts it as that slot (worker/src/conquest-sim.js): the same
// waves, rewards, the server's roll for the slot (the stored one if the slot was already started) and Resonance; it counts as that slot.
// Not while a real strike is telegraphed or open (join that one), not for a slot whose core is already yours, not twice in a UTC day.
function beacon(s,now){if(s.mission)fail('finish the operation first');const b=TN.beaconOf(s,now);
 if(!b.ready)fail(b.used?'the Strike Beacon recharges at 00:00 UTC (once a day)':b.claimed?'this strike\'s core is already yours: call the Beacon for the next one':b.open?'a Meteor Strike is open now: join it at '+(b.site?.name||'its site'):'no Meteor Strike to call');
 const M=C.meteorStrike(now);s.bcn={d:b.day,slot:M.slot,site:M.site.id,until:now+TN.BEACON.windowMs,at:now};s.notice={kind:'strike-beacon',site:M.site.id,name:M.site.name,until:s.bcn.until};track(s,'beacon','call',M.site.id);}
// the Beacon window the strike start accepts for this operation now, or null
export function beaconFor(s,op,now){const b=s.bcn;return b&&op?.strike&&Number(b.until)>now&&b.site===op.id&&Number.isSafeInteger(Number(b.slot))?b:null;}
// ---- the soft return streak (decision 11; the Nov 10 brief C, extended Nov 22): a UTC day counts when it has a verified Conquest
// activity (an operation won or a harvest: the airdrop record's act day, the same rule as the Daily Base Yield's points), granted here
// after the action. Two freeze days a week cover missed days (never a reset for one or two); rewards: day 1 a Repair Kit, day 3 a
// Scanner Charge (the consumables, up to their cap), day 7 and every 30 days from 60 to 360 an earn-only banner emblem, days 30, 100 and
// 365 a town decoration (earn-only ornaments); never points, minerals or CP. s.stk.nw: the latest grant, for the hub's one line.
// Session 7T-P decision 4: welcome-back kits: back after 14+ UTC days away, the day-1 Repair Kit and the day-3 Scanner Charge again, once a
// return (ConquestTown.streakDay re-arms them; nw.wb marks the return day, a re-granted kit carries wb).
export function streakSync(s,now){const day=Math.floor(now/864e5);if(s.dev?.used||Number(s.airdrop?.act)!==day)return null;const st0=TN.streakNorm(s.stk);if(st0.last===day)return null;
 const r=TN.streakDay(st0,day),inv=s.inv&&typeof s.inv==='object'?s.inv:null,given=[];
 for(const x of r.rewards){if(x.it&&inv){inv.it=record(inv.it)?inv.it:{};const had=inv.it[x.it]|0;inv.it[x.it]=Math.min(RULES.CQ_ITEM_MAX,had+1);given.push({d:x.d,it:x.it,n:inv.it[x.it]-had,...(x.wb?{wb:1}:{})});}else given.push(x);}
 s.stk={...r.st,nw:{d:day,n:r.days,...(given.length?{r:given}:{}),...(r.frozen?{fz:r.frozen}:{}),...(r.back?{wb:1}:{})}};track(s,'streak',String(Math.min(r.days,400)),given.some(x=>x.wb)?'welcome':given.length?'reward':'day');return r;}
