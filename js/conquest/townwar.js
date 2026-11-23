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
 chance:.6,                 // PROPOSAL: an eligible tick announces a town attack 60% of the time (about 0.9 a day at CC2-5, 1.5 at CC6+)
 lastChanceMs:60000,        // decision 1: online when an undefended attack lands: a 60-second RAID INCOMING · DEFEND? last chance
 onlineMs:120000,           // online: a request within the last 2 minutes (the Nov 10 brief B)
 idleMs:20000,              // a live defense with no input for 20 s finishes without the pilot
 shieldMs:8*HOUR,           // decision 2: an 8-hour shield after a loss
 wardMs:24*HOUR,            // the earnable 24-hour shield (the Peace Ward, rare loot, never sold)
 // decision 2: what a lost raid takes (never banked goods, the wallet, CP, points, plates, cosmetics or inventory): FALLEN (the Command
 // Center destroyed) 10% of the production store the Storage Depot does not protect plus 5% of the composite stock; BREACHED (a
 // building lost, the Command Center standing) 5% of that exposed store; HELD nothing
 loss:Object.freeze({fallen:Object.freeze({store:.10,cm:.05}),breached:Object.freeze({store:.05,cm:0}),held:Object.freeze({store:0,cm:0})}),
 // decision 5: a held unfought raid pays the existing defense cache (the town defense's CP and materials: ConquestCombat.operations
 // ['base-defense'].reward), counts toward the wall milestones (3 / 10 wins) and base-defender; no airdrop points
 cache:Object.freeze({cp:160,alloy:15,biomass:10,helium:2}),
 // THREAT -> raid level (index: THREAT rounded, 0..16). Calibrated by the fortress tests (decision 4): the regular's town holds about
 // 3 of 4 raids decided while away along the year; the level stops rising at CAP, where a fully built town holds every raid
 // without a breach even at the top strength (every Citadel tier, a five-star general, the portal open, the Grand Offensive surge)
 // measured (dev/tools/fortress-model.mjs, every site, breach = a vital or 3 buildings): the fully built town holds every raid at level 9
 // and 86% at 10, so the cap is 9; the regular holds about 71% at day 30 (THREAT 3-4: level 6), 79% at day 60 (6-7: level 7), all at
 // day 120-180 (8-11: level 8) and 64% late (14-16: level 9); the grinder 86% late; PROPOSAL numbers until the owner sees them
 level:Object.freeze([4,5,5,6,6,7,7,7,8,8,8,8,8,8,8,9,9]),   // Session 7T refit: level 9 (the cap) from THREAT 15, so the portal and the Grand Offensive surge still matter late in the year
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
 const ev=list(t.ev).filter(e=>typeof e.id==='string'&&/^(t\d{1,6}|go\d{1,9})$/.test(e.id)).map(e=>({id:e.id,a:int(e.a),l:int(e.l),g:G[e.g]?e.g:'skaal',ln:int(e.ln)%8,...(e.go?{go:1}:{}),...(e.lc?{lc:int(e.lc)}:{}),...(e.tr?{tr:int(e.tr)}:{}),...(e.sd!==undefined?{sd:int(e.sd)}:{})})).slice(0,4);
 const past=(Array.isArray(t.past)?t.past:record(t.past)?Object.values(t.past):[]).map(int).filter(x=>x>0).sort((a,b)=>a-b).slice(-6);
 const log=list(t.log).slice(-TOWN.log).map(x=>({id:String(x.id||'').slice(0,16),at:int(x.at),o:['held','breached','fallen','called'].includes(x.o)?x.o:'held',by:x.by==='you'?'you':'away',lv:clamp(int(x.lv),1,10),th:Math.round(Number(x.th)*100)/100||0,g:G[x.g]?x.g:'skaal',core:clamp(int(x.core),0,100),k:int(x.k),sp:int(x.sp),fell:int(x.fell),wl:int(x.wl),...(record(x.tk)?{tk:Object.fromEntries(Object.entries(x.tk).filter(([k,v])=>['alloy','biomass','helium','fe','cm'].includes(k)&&int(v)>0).map(([k,v])=>[k,int(v)]))}:{}),...(x.cache?{cache:1}:{}),...(x.pts?{pts:int(x.pts)}:{}),...(x.go?{go:1}:{}),...(x.dn?{dn:int(x.dn)}:{}),...(x.why?{why:String(x.why).slice(0,24)}:{})}));
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
// THREAT on the town for an attack (ctx: {now, tiers, titan}); the portal counts while open at that moment
function strength(war,e,ctx={}){const T=W().threatOf(war,{g:e.g,t:'town'},ctx,!!e.go);return {...T,level:levelOf(T.total)};}
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
 if(!why&&unit(info.seed+':town:'+k)<TOWN.chance){const e={id:'t'+(tw.n=(tw.n|0)+1),a:k,l:L,g:pickGeneral(info.war,info.tiers,unit(info.seed+':town:g:'+k),at),ln:Math.floor(unit(info.seed+':town:ln:'+k)*8)};tw.ev.push(e);out.push({kind:'announce',ev:e});}
 return out;}
// The Grand Offensive's town target (decision 1): created once its weekend is announced (lands at the window's end), unless the town
// cannot be attacked then; called off when the Grand Offensive is beaten in person.
function goSync(tw,info){const g=info.war?.go;if(!g||g.done||g.won||g.skip)return null;const id='go'+g.w;if(tw.ev.some(e=>e.id===id)||tw.log.some(x=>x.id===id))return null;const L=g.end*tickMs();
 if((info.cc|0)<TOWN.fromCC||!(L>=int(info.townAt)+TOWN.newTownMs)||int(info.shieldUntil)>L)return null;const e={id,a:g.a,l:g.end,g:g.g,ln:Math.floor(unit(info.seed+':town:go:'+g.w)*8),go:1};tw.ev.push(e);return e;}
// Advance the town clock to now (the Worker, on every request; before the town's own clock settles, so a raid sees the town as it
// stood at its landing). seen: the pilot's last request (the freeze: after one full day away the front holds, and so does the town:
// announced attacks keep their time left; a Grand Offensive target frozen at its landing is skipped with the Grand Offensive).
function advance(tw,now,info,resolve,seen=now){const K=W().tickOf(now),T=tickMs(),out=[];if(!(K>tw.k))return out;let frozen=0;
 for(let k=tw.k+1;k<=K;k++){const at=k*T;if(at-seen>=W().WAR.freezeMs){frozen++;for(const e of tw.ev){if(e.go&&e.l<=k){tw.ev.splice(tw.ev.indexOf(e),1);out.push({kind:'skip',ev:e});break;}e.a++;e.l++;}continue;}out.push(...step(tw,k,info,resolve).map(x=>({...x,k})));}
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
  ...Array.from({length:11},(_,i)=>({d:60+30*i,em:'streak'+(60+30*i)})),{d:100,dc:'monument100'},{d:365,dc:'monolith365'}].sort((a,b)=>a.d-b.d))});
// the art hooks (row 7-V draws them; until then the banner uses the glyph and the town shows the stand-in piece)
const STREAK_ART=Object.freeze({emblems:Object.freeze(Object.fromEntries(STREAK.rewards.filter(r=>r.em).map((r,i)=>[r.em,{n:r.d+'-DAY EMBLEM',glyph:['✦','✧','❂','✪','✫','✬','✭','✮','✯','✰','❖','✵'][i]||'✦'}]))),
 decor:Object.freeze({beacon30:{n:'Day-30 Signal Beacon',item:'streak-beacon30'},monument100:{n:'Day-100 Monument',item:'streak-monument100'},monolith365:{n:'Day-365 Monolith',item:'streak-monolith365'}})});   // the earn-only town ornaments (js/conquest/catalog.js; stand-in designs until row 7-V)
// st: {n streak days, last the UTC day of the last active day, wk the UTC week, fz freezes used this week, got {day: true} rewards taken}
function streakNorm(st){const r=record(st)?st:{};return {n:int(r.n),last:int(r.last),wk:int(r.wk),fz:Math.min(STREAK.freezes,int(r.fz)),best:int(r.best),got:record(r.got)?Object.fromEntries(Object.entries(r.got).filter(([k])=>/^\d{1,3}$/.test(k)).map(([k])=>[k,1])):{}};}
const weekOf=day=>Math.floor((day+3)/7);   // UTC weeks from Monday
// a verified activity on UTC day `day`: returns {st, days (the new streak count), rewards [milestones reached now], frozen (days covered)}
function streakDay(st0,day){const st=streakNorm(st0);if(st.last===day)return {st,days:st.n,rewards:[],frozen:0};let frozen=0;
 if(st.n&&st.last&&day>st.last+1){let miss=day-st.last-1;for(let d=st.last+1;d<day&&miss>0;d++){const w=weekOf(d);if(w!==st.wk){st.wk=w;st.fz=0;}if(st.fz<STREAK.freezes){st.fz++;frozen++;miss--;}else break;}if(miss>0){st.n=0;st.got={};}}
 const w=weekOf(day);if(w!==st.wk){st.wk=w;st.fz=0;}st.n=(st.n|0)+1;st.last=day;st.best=Math.max(st.best,st.n);
 const rewards=STREAK.rewards.filter(r=>r.d===st.n&&!st.got[String(r.d)]);for(const r of rewards)st.got[String(r.d)]=1;return {st,days:st.n,rewards,frozen};}
// the hub's one line (no modal)
function streakLine(st0,day){const st=streakNorm(st0),alive=st.n&&(st.last===day||st.last===day-1||day-st.last-1<=STREAK.freezes-(weekOf(day)===st.wk?st.fz:0)),n=alive?st.n:0,nx=STREAK.rewards.find(r=>r.d>n),name=r=>r.it?(r.it==='repair'?'REPAIR KIT':'SCANNER CHARGE'):r.em?'BANNER EMBLEM':'TOWN DECORATION';
 const left=STREAK.freezes-(weekOf(day)===st.wk?st.fz:0);
 return {n,today:st.last===day,next:nx||null,left,text:'STREAK '+n+' DAY'+(n===1?'':'S')+(st.last===day?' · TODAY ✓':' · PLAY TODAY')+(nx?' · DAY '+nx.d+': '+name(nx):' · EVERY MILESTONE EARNED')+' · '+left+' FREEZE'+(left===1?'':'S')+' LEFT THIS WEEK'};}
// the town as a raid saw it (the replay's snapshot s.tw.rp.town, written by the Worker) back to a plot the raid engine reads
function plotOfSnap(x){const Pl=root.ConquestPlot;return {v:2,site:x.site,cc:x.cc|0,b:Object.fromEntries(Object.entries(x.b||{}).map(([id,a])=>[id,{t:a[0],i:a[1],j:a[2],r:a[3],l:a[4]}])),w:Pl.decWalls(x.w),dmg:{...(x.dmg||{})},n:0,st:{}};}
root.ConquestTown=Object.freeze({TOWN,STARS,BEACON,STREAK,STREAK_ART,plotOfSnap,fresh,norm,perDay,goSlots,paceOk,canLand,pickGeneral,levelOf,strength,lossOf,step,goSync,advance,defendable,next,fresher,beaconOf,streakNorm,streakDay,streakLine,weekOf});
})(globalThis);
