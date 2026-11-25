/* Session 7T Living Town (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md, decisions 1-3, 5, 6, 10, 11): the town attack track's
   shared rules. Pure functions over the pilot's town attack record (s.tw), shared by the phone (the hub card, the War Map, the town)
   and the Worker (worker/build-sim.mjs packs this file into the CONQUEST bundle; worker/src/conquest-town.js owns every change).
   Town attacks are their own track on Session 7's war clock (js/conquest/war.js): announced two ticks (12 h) ahead, landing on a
   tick, defendable in person any time until they land. The territory war's assaults, limits and tests are untouched.
   Strength: Session 7's THREAT inputs on the town (ConquestWar.threatOf: the general's stars, the portal while open, the Citadel tiers
   cleared, the Grand Offensive surge), never Command Center level, gear or purchases; the waves are the raid engine's
   drillWaves(level) for the level that THREAT maps to (LEVEL, calibrated by dev/tests/conquest-fortress.mjs).
   The Strike Beacon (decision 10) and the soft return streak (decision 11) live here too: small day rules the hub reads. */
(function(root){
'use strict';
const HOUR=3600000,DAY=24*HOUR;
const W=()=>root.ConquestWar;
const TOWN=Object.freeze({
 v:1,
 fromCC:2,                  // decision 1: only from Command Center level 2
 newTownMs:3*DAY,           // none in a new town's first 3 days (from the claim)
 gapMs:8*HOUR,              // at least 8 hours apart
 windowMs:DAY,              // at most 1 in any 24 hours through CC5, 2 from CC6 (a rolling window: no midnight double)
 perDay:Object.freeze([0,1,1,1,1,1,2,2,2,2,2]),
 chance:.6,                 // owner-adopted Nov 23 (Session 7T-P decision 1): an eligible tick announces a town attack 60% of the time (about 0.9 a day at CC2-5, 1.5 at CC6+)
 lastChanceMs:60000,        // decision 1: online when an undefended attack lands: a 60-second RAID INCOMING · DEFEND? last chance
 onlineMs:120000,           // online: a request within the last 2 minutes (the Nov 10 brief B)
 idleMs:20000,              // a live defense with no input for 20 s finishes without the pilot
 shieldMs:8*HOUR,           // decision 2: an 8-hour shield after a loss
 wardMs:24*HOUR,            // the earnable 24-hour shield (the Peace Ward, rare loot, never sold)
 // decision 2: what a lost raid takes (never banked goods, the wallet, CP, points, plates, cosmetics or inventory): FALLEN (the Command
 // Center destroyed) 10% of the production store the Storage Depot does not protect plus 5% of the composite stock; BREACHED (a
 // building lost, the Command Center standing) 5% of that exposed store; HELD nothing
 loss:Object.freeze({fallen:Object.freeze({store:.10,cm:.05}),breached:Object.freeze({store:.05,cm:0}),held:Object.freeze({store:0,cm:0})}),
 // decision 5: a held raid pays the existing defense cache (the town defense's CP and materials: ConquestCombat.operations
 // ['base-defense'].reward; one nobody fought pays `away` below), counts toward the wall milestones (3 / 10 wins) and base-defender; no airdrop points
 cache:Object.freeze({cp:160,alloy:15,biomass:10,helium:2}),
 // Session 7B STEP 3, owner decision (Nov 24): what a held raid nobody fought pays: the cache without its CP (a raid really fought in
 // person keeps the whole cache above). Measured (dev/tools/held-raid-cache.mjs; Checkpoint 49 STEP 3): the first of the four options
 // (full, half, without its CP, none) that keeps the walled regular's CC10 inside the Session 6 band (101 pilots: median 27.8, mean
 // 26.5; the whole cache gave 20.8 / 22.8) and the heavy player's late fortress about 9 of 10 (88.1%)
 away:Object.freeze({cp:0,alloy:15,biomass:10,helium:2}),
 // Session 7T-P decision 2 (owner, Nov 23): Selenite for the late fortress. A raid at the cap level (9) held in person (settled HELD and
 // really fought: the 675 defense points' own rule) drops n Selenite into the pilot's cargo (banked at the Refuge like every mineral).
 // The amount is the fortress model's (dev/tools/selenite-candidates.mjs, 56 raids a day on two seed sets). The owner's addendum (Nov 23)
 // targets the 2-hour heavy player: 8 brings them to about 9 of 10 raids held late in the year (88.1%: 85.7 and 90.5, from 77.1; 4 gave
 // 81.3, 12 gave 87.8) while the regular's hold rates stay within 3.6 points of 7T's at every measured day (the regular meets level 9
 // only from about day 320); the grinder 94.1% (from 85.7). The other candidate, Strike Resonance every 8 strikes, moved the grinder by
 // 0 and -1 points and the regular by 7. Gated to the cap so Selenite stays a late-fortress reward (a drop on every held defense lifted
 // the regular 7-13 points at day 120 and gave new pilots Selenite from their first raid). Ships inert: level 9 needs THREAT 15, so
 // Citadel tiers VIII-IX (Session 11; 7B builds tiers I-III, which top out at level 8), passed to the town clock in all five places
 // (worker/src/conquest-town.js infoOf, settle's cit, the town-defend start; js/conquest/townui.js's hub preview and last-chance line). Earn-only: never sold.
 se:Object.freeze({from:9,n:8}),
 // THREAT -> raid level (index: THREAT rounded, 0..16). Calibrated by the fortress tests (decision 4): the regular's town holds about
 // 3 of 4 raids decided while away along the year; the level stops rising at CAP, where a fully built town holds every raid
 // without a breach even at the top strength (every Citadel tier, a five-star general, the portal open, the Grand Offensive surge)
 // measured (dev/tools/fortress-model.mjs, every site, breach = a vital or 3 buildings): the fully built town holds every raid at level 9
 // and 86% at 10, so the cap is 9; the regular holds about 71% at day 30 (THREAT 3-4: level 6), 79% at day 60 (6-7: level 7), all at
 // day 120-180 (8-11: level 8) and 64% late (14-16: level 9); the grinder 86% late. The table and the cap: owner-adopted Nov 23 (Session 7T-P decision 1)
 level:Object.freeze([1,1,2,3,4,5,6,7,8,8,8,8,8,8,8,9,9]),   // Session 7T refit (owner-adopted Nov 23): a young town meets young raids (days 5-14 before any Citadel tier: THREAT 1-4), level 9 (the cap) only from THREAT 15 so the portal and the Grand Offensive surge still matter late in the year
 cap:9,
 log:16
});
// the general who attacks the town, by the Citadel tiers cleared (the Retaliation level, blueprint §5 "strength follows the
// Retaliation level"): 1-2 stars before any tier; five stars only after tier IX (the Sovereign's Hand comes for your town)
const STARS=Object.freeze([[1,2],[1,2],[2,3],[2,3],[3,3],[3,4],[3,4],[4,4],[4,5],[5,5]]);
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const list=v=>Array.isArray(v)?v.filter(record):record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(record):[];
const int=v=>Math.max(0,Math.floor(Number(v)||0));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const tickMs=()=>W().WAR.tickMs,warn=()=>W().warnTicks();
// ---- the record ----------------------------------------------------------------------------------------------------------------
// s.tw: {v, k the last tick processed, n attacks made, ev pending [{id, a announced tick, l landing tick, g general, ln lane, go (the
// Grand Offensive's town target), lc last-chance end ms, tr the attempt spent in person}], past [landing ms of recent attacks], log
// [results], rp the latest raid's replay, ws Peace Wards held, wu the last ward used, won held raids, seen (the log read up to)}
function fresh(now){return {v:1,k:W().tickOf(now),n:0,ev:[],past:[],log:[],rp:null,ws:0,won:0,seen:now};}
function norm(t,now){if(!record(t)||t.v!==1){const f=fresh(now);if(record(t))f.ws=Math.min(10,int(t.ws));return f;}const G=W().GEN;   // a Peace Ward found before the first town attack is kept
 const ev=list(t.ev).filter(e=>typeof e.id==='string'&&/^(t\d{1,6}|go\d{1,9})$/.test(e.id)).map(e=>({id:e.id,a:int(e.a),l:int(e.l),g:G[e.g]?e.g:'skaal',ln:int(e.ln)%8,...(e.go?{go:1}:{}),...(e.lc?{lc:int(e.lc)}:{}),...(e.tr?{tr:int(e.tr)}:{}),...(e.sd!==undefined?{sd:int(e.sd)}:{}),...(e.first?{first:1}:{})})).slice(0,4);
 const past=(Array.isArray(t.past)?t.past:record(t.past)?Object.values(t.past):[]).map(int).filter(x=>x>0).sort((a,b)=>a-b).slice(-6);
 const log=list(t.log).slice(-TOWN.log).map(x=>({id:String(x.id||'').slice(0,16),at:int(x.at),o:['held','breached','fallen','called'].includes(x.o)?x.o:'held',by:x.by==='you'?'you':'away',lv:clamp(int(x.lv),1,10),th:Math.round(Number(x.th)*100)/100||0,g:G[x.g]?x.g:'skaal',core:clamp(int(x.core),0,100),k:int(x.k),sp:int(x.sp),fell:int(x.fell),wl:int(x.wl),...(record(x.tk)?{tk:Object.fromEntries(Object.entries(x.tk).filter(([k,v])=>['alloy','biomass','helium','fe','cm'].includes(k)&&int(v)>0).map(([k,v])=>[k,int(v)]))}:{}),...(x.cache?{cache:1}:{}),...(x.f?{f:1}:{}),...(x.pts?{pts:int(x.pts)}:{}),...(x.go?{go:1}:{}),...(x.dn?{dn:int(x.dn)}:{}),...(x.se?{se:int(x.se)}:{}),...(x.why?{why:String(x.why).slice(0,24)}:{})}));
 const rp=record(t.rp)&&typeof t.rp.id==='string'?t.rp:null;
 return {v:1,k:Number.isSafeInteger(Number(t.k))?Number(t.k):W().tickOf(now),n:int(t.n),ev,past,log,rp,ws:Math.min(10,int(t.ws)),...(t.wu?{wu:int(t.wu)}:{}),won:int(t.won),seen:int(t.seen)};}
// ---- pace (decision 1) --------------------------------------------------------------------------------------------------------
const perDay=cc=>TOWN.perDay[clamp(cc|0,0,10)];
// every Grand Offensive's landing (its window's end, Monday 00:00 UTC) from the war's day 5: held back for the town target that counts
// as one of that day's town attacks (decision 1)
function goSlots(war,from,to){const out=[],t0=int(war?.t0),d0=Math.floor(from/DAY)-7,d1=Math.floor(to/DAY)+7;for(let d=d0;d<=d1;d++)if((d+4)%7===1){const at=d*DAY;if(at>=from&&at<=to&&(at-3*DAY-t0)/DAY>=W().WAR.go.fromDay)out.push(at);}return out;}
// at most n in any rolling 24 hours and at least 8 hours apart, over the sorted landing times
function paceOk(times,cc){const t=[...times].sort((a,b)=>a-b),n=perDay(cc);if(!n)return false;for(let i=1;i<t.length;i++)if(t[i]-t[i-1]<TOWN.gapMs)return false;for(let i=0;i+n<t.length;i++)if(t[i+n]-t[i]<TOWN.windowMs)return false;return true;}
// can an attack land at L (ms)? info: {cc, townAt (the claim), shieldUntil, war}
function canLand(tw,L,info){if((info.cc|0)<TOWN.fromCC)return 'cc';if(!(L>=int(info.townAt)+TOWN.newTownMs))return 'new town';if(int(info.shieldUntil)>L)return 'shield';
 const near=[...tw.past,...tw.ev.map(e=>e.l*tickMs()),...goSlots(info.war,L-2*DAY,L+2*DAY).filter(x=>!tw.ev.some(e=>e.go&&e.l*tickMs()===x))];
 if(near.some(x=>x===L))return 'slot';return paceOk([...near.filter(x=>Math.abs(x-L)<2*DAY),L],info.cc)?'':'pace';}
// ---- strength (decision 3) ---------------------------------------------------------------------------------------------------------
function pickGeneral(war,tiers,r,now){const [lo,hi]=STARS[clamp(tiers|0,0,9)],want=lo+Math.floor(r*(hi-lo+1)),G=W().GENERALS;
 for(let s=want;s>=1;s--){const pool=G.filter(g=>g.stars===s&&!(int(war?.gen?.[g.id]?.back)>now));if(pool.length)return pool[Math.floor(r*997)%pool.length].id;}return G[0].id;}
const levelOf=th=>Math.min(TOWN.cap,TOWN.level[clamp(Math.round(Number(th)||0),0,TOWN.level.length-1)]);
// decision 2 (7T-P): the Selenite a raid of this level pays when held in person (0 below the cap)
const seOf=lv=>(Number(lv)||0)>=TOWN.se.from?TOWN.se.n:0;
// THREAT on the town for an attack (ctx: {now, tiers, titan}); the portal counts while open at that moment
// the first attack on a town is a teaching raid (review B5): a one-star general at level 1, whatever the THREAT around it
function strength(war,e,ctx={}){const T=W().threatOf(war,{g:e.g,t:'town'},ctx,!!e.go);return {...T,level:e.first?1:levelOf(T.total)};}
// ---- losses (decision 2) -----------------------------------------------------------------------------------------------------------
// loot: ConquestPlot.loot(plot) (the Storage Depot protects 25% + 10% a level of the production store); cm: the whole composite stock
function lossOf(outcome,loot,cm){const L=TOWN.loss[outcome]||TOWN.loss.held,out={};for(const k of ['alloy','biomass','helium','fe']){const v=Math.floor((loot?.raidable?.[k]||0)*L.store);if(v>0)out[k]=v;}const c=Math.floor((Number(cm)||0)*L.cm);if(c>0)out.cm=c;return out;}
// ---- the clock -------------------------------------------------------------------------------------------------------------------------
const unit=t=>W().unit(t);
// One tick: land what is due (resolve(e, at) settles it on the Worker; it returns the outcome), then maybe announce one.
// info: {cc, townAt, shieldUntil, war, tiers, seed}. Returns what happened.
function step(tw,k,info,resolve){const T=tickMs(),at=k*T,out=[];
 for(const e of tw.ev.filter(x=>x.l<=k&&!x.lc).sort((a,b)=>a.l-b.l||a.id.localeCompare(b.id))){const r=resolve?resolve(e,e.l*T):null;if(r==='wait')continue;tw.ev.splice(tw.ev.indexOf(e),1);if(r&&r!=='called')tw.past=[...tw.past,e.l*T].slice(-6);out.push({kind:'land',ev:e,r});}
 const L=k+warn(),Lms=L*T,why=canLand(tw,Lms,info);
 if(!why&&unit(info.seed+':town:'+k)<TOWN.chance){const first=!(tw.n|0)&&!tw.log.length,e={id:'t'+(tw.n=(tw.n|0)+1),a:k,l:L,g:first?pickGeneral(info.war,0,0,at):pickGeneral(info.war,info.tiers,unit(info.seed+':town:g:'+k),at),ln:Math.floor(unit(info.seed+':town:ln:'+k)*8),...(first?{first:1}:{})};tw.ev.push(e);out.push({kind:'announce',ev:e});}
 return out;}
// The Grand Offensive's town target (decision 1): created once its weekend is announced (lands at the window's end), unless the town
// cannot be attacked then; called off when the Grand Offensive is beaten in person.
function goSync(tw,info){const g=info.war?.go;if(!g||g.done||g.won||g.skip)return null;const id='go'+g.w;if(tw.ev.some(e=>e.id===id)||tw.log.some(x=>x.id===id))return null;const L=g.end*tickMs();
 if(!tw.log.some(x=>x.o!=='called'))return null;   // review (round 2): a town joins the Grand Offensive's targets once its first raid (the teaching raid) has landed
 if((info.cc|0)<TOWN.fromCC||!(L>=int(info.townAt)+TOWN.newTownMs)||int(info.shieldUntil)>L)return null;const e={id,a:g.a,l:g.end,g:g.g,ln:Math.floor(unit(info.seed+':town:go:'+g.w)*8),go:1};tw.ev.push(e);return e;}
// Advance the town clock to now (the Worker, on every request; before the town's own clock settles, so a raid sees the town as it
// stood at its landing). seen: the pilot's last request (the freeze: after one full day away the front holds, and so does the town:
// announced attacks keep their time left; a Grand Offensive target frozen at its landing is skipped with the Grand Offensive).
function advance(tw,now,info,resolve,seen=now){const K=W().tickOf(now),T=tickMs(),out=[];if(!(K>tw.k))return out;let frozen=0;
 for(let k=tw.k+1;k<=K;k++){const at=k*T;if(at-seen>=W().WAR.freezeMs){frozen++;for(const e of [...tw.ev]){if(e.go&&e.l<=k){tw.ev.splice(tw.ev.indexOf(e),1);out.push({kind:'skip',ev:e});continue;}e.a++;e.l++;}continue;}out.push(...step(tw,k,info,resolve).map(x=>({...x,k})));}
 tw.k=K;if(frozen)out.push({kind:'frozen',n:frozen});return out;}
// what the pilot can defend now: announced, not landed (or in its last-chance minute), not yet fought
function defendable(tw,now){return (tw?.ev||[]).filter(e=>!e.tr&&(e.lc?e.lc>now:e.l*tickMs()>now));}
const next=(tw,now)=>defendable(tw,now).sort((a,b)=>(a.lc||a.l*tickMs())-(b.lc||b.l*tickMs()))[0]||null;
// the War Report's town lines since the pilot last read it (held raids appear only here: decision 9)
const fresher=(tw,since)=>(tw?.log||[]).filter(x=>x.at>since);
// ---- the Strike Beacon (decision 10; the Nov 10 brief C): once a UTC day a pilot may call a strike at the current slot's site within a
// 20-minute window of their choosing: identical waves, rewards, roll (keyed to the slot: the stored roll applies if the slot was already
// started) and Resonance; it counts as that slot ----
const BEACON=Object.freeze({windowMs:20*60000});
function beaconOf(s,now){const C=root.ConquestCombat,M=C?.meteorStrike?.(now);if(!M)return {ready:false};const day=Math.floor(now/DAY),b=record(s?.bcn)?s.bcn:{},used=int(b.d)===day,active=used&&int(b.until)>now;
 const claimed=!!s?.strikes?.[M.slot]?.claimed,open=M.phase==='open'||M.phase==='telegraph';
 return {ready:!used&&!claimed&&!open,used,active,slot:active?int(b.slot):M.slot,site:active?(C.strikeSites.find(x=>x.id===b.site)||M.site):M.site,until:active?int(b.until):0,claimed,open,day};}
// ---- the soft return streak (decision 11; the Nov 10 brief C, extended by the owner on Nov 22): days with any verified Conquest
// activity; two freeze days a UTC week so a missed day never resets it; never points or minerals ----
const STREAK=Object.freeze({freezes:2,
 rewards:Object.freeze([{d:1,it:'repair'},{d:3,it:'scanner'},{d:7,em:'streak7'},{d:30,dc:'beacon30'},
  ...Array.from({length:11},(_,i)=>({d:60+30*i,em:'streak'+(60+30*i)})),{d:100,dc:'monument100'},{d:365,dc:'monolith365'}].sort((a,b)=>a.d-b.d)),
 // Session 7T-P decision 4 (owner, Nov 23): welcome-back kits. A pilot back after 14 or more UTC days with no verified activity (the
 // streak has reset by then: two freeze days a week never cover 14) gets the day-1 Repair Kit and the day-3 Scanner Charge once more,
 // on that return's streak days 1 and 3: each re-armed once a return (the next needs another 14 days away); never points or minerals
 welcome:Object.freeze({away:14,days:Object.freeze([1,3])})});
// the art hooks (row 7-V draws them; until then the banner uses the glyph and the town shows the stand-in piece)
const STREAK_ART=Object.freeze({emblems:Object.freeze(Object.fromEntries(STREAK.rewards.filter(r=>r.em).map((r,i)=>[r.em,{n:r.d+'-DAY EMBLEM',glyph:['✦','✧','❂','✪','✫','✬','✭','✮','✯','✰','❖','✵'][i]||'✦'}]))),
 decor:Object.freeze({beacon30:{n:'Day-30 Signal Beacon',item:'streak-beacon30'},monument100:{n:'Day-100 Monument',item:'streak-monument100'},monolith365:{n:'Day-365 Monolith',item:'streak-monolith365'}})});   // the earn-only town ornaments (js/conquest/catalog.js; stand-in designs until row 7-V)
// st: {n streak days, last the UTC day of the last active day, wk the UTC week, fz freezes used this week, got {day: true} rewards taken,
// wb the UTC day of the latest welcome back, wm the welcome-back kits re-armed and not yet given (bit k: STREAK.welcome.days[k])}
function streakNorm(st){const r=record(st)?st:{};return {n:int(r.n),last:int(r.last),wk:int(r.wk),fz:Math.min(STREAK.freezes,int(r.fz)),best:int(r.best),got:record(r.got)?Object.fromEntries(Object.entries(r.got).filter(([k])=>/^\d{1,3}$/.test(k)).map(([k])=>[k,1])):{},wb:int(r.wb),wm:int(r.wm)&((1<<STREAK.welcome.days.length)-1)};}
const weekOf=day=>Math.floor((day+3)/7);   // UTC weeks from Monday
// a verified activity on UTC day `day`: returns {st, days (the new streak count), rewards [milestones reached now; wb: a welcome-back
// re-grant], frozen (days covered), back (1: the first day back after 14+ days away)}
function streakDay(st0,day){const st=streakNorm(st0);if(st.last===day)return {st,days:st.n,rewards:[],frozen:0,back:0};let frozen=0,back=0;
 // decision 4 (7T-P): back after 14+ UTC days with no verified activity: the day-1 and day-3 kits this pilot was given are re-armed
 if(st.last&&day-st.last-1>=STREAK.welcome.away){back=1;st.wb=day;STREAK.welcome.days.forEach((d,k)=>{if(st.got[String(d)]){delete st.got[String(d)];st.wm|=1<<k;}});}
 if(st.n&&st.last&&day>st.last+1){let miss=day-st.last-1;for(let d=st.last+1;d<day&&miss>0;d++){const w=weekOf(d);if(w!==st.wk){st.wk=w;st.fz=0;}if(st.fz<STREAK.freezes){st.fz++;frozen++;miss--;}else break;}if(miss>0)st.n=0;}   // review R2-B2: a reset restarts the count; each milestone is given once per pilot (got is kept)
 const w=weekOf(day);if(w!==st.wk){st.wk=w;st.fz=0;}st.n=(st.n|0)+1;st.last=day;st.best=Math.max(st.best,st.n);
 const rewards=STREAK.rewards.filter(r=>r.d===st.n&&!st.got[String(r.d)]).map(r=>{const k=STREAK.welcome.days.indexOf(r.d);if(k>=0&&(st.wm>>k)&1){st.wm&=~(1<<k);return {...r,wb:1};}return r;});
 for(const r of rewards)st.got[String(r.d)]=1;return {st,days:st.n,rewards,frozen,back};}
// the hub's one line (no modal). back: a return after 14+ days away not yet played today (review B3: the line names the kit that comes back)
function streakLine(st0,day){const st=streakNorm(st0),back=!!(st.last&&st.last!==day&&day-st.last-1>=STREAK.welcome.away);if(back)for(const d of STREAK.welcome.days)delete st.got[String(d)];const alive=st.n&&(st.last===day||st.last===day-1||day-st.last-1<=STREAK.freezes-(weekOf(day)===st.wk?st.fz:0)),n=alive?st.n:0,nx=STREAK.rewards.find(r=>r.d>n&&!st.got[String(r.d)]),name=r=>r.it?(r.it==='repair'?'REPAIR KIT':'SCANNER CHARGE'):r.em?'BANNER EMBLEM':'TOWN DECORATION';
 const left=STREAK.freezes-(weekOf(day)===st.wk?st.fz:0),wk=STREAK.welcome.days.indexOf(nx?.d),welcome=back||!!(alive&&st.wb&&(st.wb===day||wk>=0&&(st.wm>>wk)&1));   // decision 4 (7T-P): the return's line says so
 return {n,today:st.last===day,next:nx||null,left,welcome,back,text:'STREAK '+n+' DAY'+(n===1?'':'S')+(st.last===day?' · TODAY ✓':' · PLAY TODAY')+(welcome?' · WELCOME BACK':'')+(nx?' · DAY '+nx.d+': '+name(nx):' · EVERY MILESTONE EARNED')+' · '+left+' FREEZE'+(left===1?'':'S')+' LEFT THIS WEEK'};}
// ---- Session 7T-P decision 3 (owner, Nov 23): the first wall ring, the town coach's step before Command Center level 4 ---------------
// Closed when raiders gathering outside the town cannot reach the Command Center or a vital (Reactor, Storage Depot, Science Lab)
// without breaking a wall: a flood from the raid's gathering cells (ConquestPlot.spawnCells) over the ground raiders walk (the raid
// engine's rule: the town and its gathering ring, never a natural barrier) through every cell that holds no wall. Buildings and turrets
// never close a ring (raiders wreck them); a damaged wall still counts (REPAIR restores it). Pure and cheap (one flood over the 79x79
// grid): the phone's coach and the models share it. Returns {closed, walls (cells), open (the first structure reached: 'cc' or the
// vital's type), id, out (that vital stands outside the walls' ring), gap: [i,j] for the coach's marker: where the open way crosses the
// walls' ring, or the vital that stands outside it}. A Gate closes a ring like a wall.
function flood(p,o={}){const Pl=root.ConquestPlot,N=Pl.GRID.n,cc=Pl.clampCC(p.cc),h=Pl.townH(cc),site=p.site,w=record(p.w)?p.w:{},at=(i,j)=>i*N+j;
 const gate=new Set();for(const b of Object.values(p.b||{}))if(record(b)&&Pl.BUILDINGS[b.t]?.gate)for(const [i,j] of Pl.cells(b))gate.add(i+','+j);   // a Gate closes a ring like a wall (raiders must break its 900 HP; review B2)
 const walk=(i,j)=>i>=0&&j>=0&&i<N&&j<N&&Pl.cheb(i,j)<=h+1&&!Pl.BLOCKED[Pl.terrainAt(site,i,j)]&&!w[i+','+j]&&!gate.has(i+','+j),from=new Int32Array(N*N).fill(-2),q=[];
 for(const lane of Pl.spawnCells(site,cc))for(const [i,j] of lane)if(walk(i,j)&&from[at(i,j)]===-2){from[at(i,j)]=-1;q.push(at(i,j));}
 for(let k=0;k<q.length;k++){const c=q[k];if(o.stop&&o.stop(c))return {from,hit:c,N};const i=(c/N)|0,j=c-i*N;for(const [x,z] of [[i+1,j],[i-1,j],[i,j+1],[i,j-1]]){if(!walk(x,z)||from[at(x,z)]!==-2)continue;from[at(x,z)]=c;q.push(at(x,z));}}
 return {from,hit:-1,N};}
function ringOf(p,o={}){const Pl=root.ConquestPlot;if(!Pl||!p?.b?.cc)return {closed:false,walls:0,open:'cc',id:'cc',out:false,gap:null};
 const N=Pl.GRID.n,w=record(p.w)?p.w:{},walls=Object.keys(w).length,tgt=new Map(),at=(i,j)=>i*N+j;
 const must=b=>b.t==='cc'||(b.l|0)>0&&(Pl.VITALS[b.t]||o.all&&Pl.BUILDINGS[b.t]&&!Pl.BUILDINGS[b.t].turret&&!Pl.BUILDINGS[b.t].gate);   // o.all: every building but turrets and gates
 for(const [id,b] of Object.entries(p.b)){if(!record(b)||!must(b))continue;for(const [i,j] of Pl.cells(b))tgt.set(at(i,j),{t:b.t,id});}
 const {from,hit}=flood(p,{stop:c=>tgt.has(c)});if(hit<0)return {closed:true,walls,open:'',id:'',out:false,gap:null};
 const T0=tgt.get(hit),c0=p.b.cc,sz=Pl.sizeOf('cc',c0.r|0),ci=c0.i+(sz.w-1)/2,cj=c0.j+(sz.d-1)/2,dist=(i,j)=>Math.hypot(i-ci,j-cj);
 const rs=Object.keys(w).map(k=>{const [i,j]=k.split(',').map(Number);return dist(i,j);}).sort((a,b)=>a-b),R=rs.length?rs[rs.length>>1]:0,path=[];for(let c=hit;c>=0;c=from[c])path.push([(c/N)|0,c%N]);
 const out=T0.t!=='cc'&&!!rs.length&&dist(...path[0])>R+1;let gap=null;if(out)gap=path[0];else if(rs.length){let best=Infinity;for(const [i,j] of path){const d=Math.abs(dist(i,j)-R);if(d<best){best=d;gap=[i,j];}}}
 return {closed:false,walls,open:T0.t,id:T0.id,out,gap};}
// The coach's SUGGEST A RING (decision 3): the one wall order (composite, no ore) that closes the town within the composite stock, in the
// coach's own order: the RING tool from the Command Center by radius (the smallest that closes it), then a square RECT, then the square
// with its frozen shore sealed (ICE BASIN: walls cannot stand on ice, so every buildable cell inside the square that touches the ice becomes
// wall, the Session 7T fortress plan's shore rule), then a RECT pulled in on one or two sides (cliffs there); null when none closes (a vital
// beside ice or rock: move it). Measured (dev/tools/coach-ring-repairs.mjs): the RING order beats rects hugging the buildings (a ring of
// radius 9, then one of about 13 once the town grows, keeps the later buildings inside two wall layers; tight rects left them outside,
// 27,000-56,000 CP of REPAIR on 21-pilot panels against about 200). The town models use it too (fortress-model.mjs ladderRun).
const ROOM=12;
function ringPlan(p,o={}){const Pl=root.ConquestPlot;if(!Pl||!p?.b?.cc)return null;const budget=o.cm??Math.floor(Number(p.cm)||0),c=p.b.cc,sz=Pl.sizeOf('cc',c.r|0),ci=Math.round(c.i+(sz.w-1)/2),cj=Math.round(c.j+(sz.d-1)/2),H=Math.min(20,Pl.townH(p.cc)-2);
 const N=Pl.GRID.n,cc=Pl.clampCC(p.cc),occ=Pl.occupancy(p),w0=record(p.w)?p.w:{},room=Pl.wallCapOf(p)-Object.keys(w0).length-Object.values(Pl.stockOf(p)).reduce((a,n)=>a+n,0),site=p.site;
 const ok=(i,j)=>Pl.inTown(cc,i,j)&&!Pl.NOBUILD[Pl.terrainAt(site,i,j)]&&!w0[i+','+j]&&!(occ.get(i+','+j)&&occ.get(i+','+j)!=='wall'),ice=(i,j)=>Pl.inGrid(i,j)&&Pl.terrainAt(site,i,j)==='ice';
 const shore=r=>{const out=[];for(let i=ci-r;i<=ci+r;i++)for(let j=cj-r;j<=cj+r;j++)if(!ice(i,j)&&[[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>ice(i+a,j+b))&&ok(i,j))out.push([i,j]);return out;};
 const radii=Array.from({length:Math.max(0,H-5)},(_,k)=>6+k);   // the first ring: the smallest that closes the town (the coach's RING by radius)
 const cand=[],R=(a,b)=>cand.push({k:'rect',a,b,o:0,l:0});for(const r of radii)cand.push({k:'ring',a:[ci,cj],b:[ci+r,cj],o:0,l:0});for(const r of radii)R([ci-r,cj-r],[ci+r,cj+r]);
 const iceNear=Array.from({length:2*H+1},(_,a)=>a).some(a=>Array.from({length:2*H+1},(_,b)=>b).some(b=>ice(ci-H+a,cj-H+b)));
 if(iceNear)for(const r of radii){const sq=Pl.rectCells([ci-r,cj-r],[ci+r,cj+r]).filter(([i,j])=>ok(i,j)),cells=[...new Map([...sq,...shore(r)].map(q=>[q[0]+','+q[1],q])).values()];if(cells.length&&cells.length<=Pl.MAX_WALL_CELLS)cand.push({k:'cells',c:cells.flat(),o:0,l:0,r});}
 for(const r of radii)for(let t=r-1;t>=2;t--){R([ci-r,cj-r],[ci+r,cj+t]);R([ci-r,cj-t],[ci+r,cj+r]);R([ci-r,cj-r],[ci+t,cj+r]);R([ci-t,cj-r],[ci+r,cj+r]);R([ci-t,cj-r],[ci+r,cj+t]);R([ci-r,cj-r],[ci+t,cj+t]);R([ci-t,cj-t],[ci+r,cj+r]);R([ci-r,cj-t],[ci+t,cj+r]);}
 // the Worker's own wall rules for these cells (wallPlan: inside the town, buildable ground, not under a building); the Worker checks the
 // order again when the pilot confirms it
 const cellsOf=(sec,w)=>{const add=new Set();for(const [i,j] of Pl.shapeCells(sec)||[])if(ok(i,j)&&!w[i+','+j])add.add(i+','+j);return add;};
 const closes=(w)=>ringOf({...p,w},o).closed,rOf=sec=>sec.k==='ring'?Math.round(Math.hypot(sec.b[0]-sec.a[0],sec.b[1]-sec.a[1])):sec.k==='rect'?Math.min(Math.abs(sec.b[0]-sec.a[0]),Math.abs(sec.b[1]-sec.a[1]))/2:(sec.r||0);
 let first=null;for(const sec of cand){const add=cellsOf(sec,w0);if(!add.size||add.size>budget||add.size>room)continue;const w={...w0};for(const k of add)w[k]=1;if(!closes(w))continue;first={sec,add,w};break;}
 if(!first)return null;
 // a second, outer layer in the same order when the stock allows it (DOUBLE): two layers hold far better than one (a single ring of radius
 // 12 was still breached in 12 of 16 raids, about 20,000 CP of REPAIR; an inner and an outer ring about 200 CP); the outer one closes the
 // town on its own and stands at least 4 cells out
 const secs=[first.sec];let fresh=first.add.size,w=first.w;const r0=rOf(first.sec);
 for(const sec of o.single?[]:cand){if(sec.k!==first.sec.k||rOf(sec)<Math.max(ROOM,r0+4))continue;const add=cellsOf(sec,w);if(!add.size||fresh+add.size>budget||fresh+add.size>room)continue;const w2={...w0};for(const k of cellsOf(sec,w0))w2[k]=1;if(!closes(w2))continue;
  for(const k of add)w[k]=1;secs.push(sec);fresh+=add.size;break;}
 const {from}=flood({...p,w}),inside=Object.values(p.b).filter(b=>record(b)&&Pl.cells(b).every(([i,j])=>from[i*N+j]===-2)).length;
 const clean=secs.map(({r,...x})=>x);return {sec:clean[0],secs:clean,fresh,inside,double:clean.length>1};}
// the town as a raid saw it (the replay's snapshot s.tw.rp.town, written by the Worker) back to a plot the raid engine reads
function plotOfSnap(x){const Pl=root.ConquestPlot;return {v:2,site:x.site,cc:x.cc|0,b:Object.fromEntries(Object.entries(x.b||{}).map(([id,a])=>[id,{t:a[0],i:a[1],j:a[2],r:a[3],l:a[4]}])),w:Pl.decWalls(x.w),dmg:{...(x.dmg||{})},n:0,st:{}};}
const cacheOf=x=>x?.o==='held'&&x.cache?(x.f?TOWN.cache:TOWN.away):null;   // f: really fought in person   // Session 7B STEP 3
root.ConquestTown=Object.freeze({TOWN,cacheOf,STARS,BEACON,STREAK,STREAK_ART,plotOfSnap,ringOf,ringPlan,fresh,norm,perDay,goSlots,paceOk,canLand,pickGeneral,levelOf,seOf,strength,lossOf,step,goSync,advance,defendable,next,fresher,beaconOf,streakNorm,streakDay,streakLine,weekOf});
})(globalThis);
