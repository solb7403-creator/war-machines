// Session 7 Living Front on the Worker (owner brief docs/conquest/audit/SESSION_07_BRIEF.md; the rules are js/conquest/war.js,
// shared with the phone). Server-authoritative, in the pilot's own Conquest record (s.war, cold part; s.al the alert settings):
//  - the clock runs on every request (refreshState): missed ticks are computed when the pilot next connects, so nothing has to be
//    online; the rolls come from the server-only loot seed (s.lseed), the phone never sees one;
//  - today's sector defense alerts ARE the war clock's assaults (one system): the old 20-minute alert after each capture is gone; a
//    pending assault on a Frontline sector's ground shows as that sector's DEFENSE ALERT and is fought in its INVASION DEFENSE;
//  - the six-sector Frontline keeps its own count (s.territory) beside the Moon's (s.war.o); when the clock takes a territory, the
//    Frontline sector on that ground falls with it (owner decision 1: no code protects existing captures); a counterattack the pilot
//    wins in person re-secures it;
//  - in person (decision 3): one attempt an event, spent when the battle starts; a win holds (entrenched 24 h, fortification kept) or
//    retakes; a loss changes nothing now: at landing the strength roll decides and wear applies, as if you hadn't come;
//  - war battles pay (decision 10) only when won, once an event: a territory defense RULES.CQ_PTS.defense (675), a counterattack or the
//    Grand Offensive par x 225 x the ring's danger; spoils as other Conquest battles of the same danger; battles nobody fought pay nothing;
//  - Fortify (decision 6) and Station (decision 7); the Lunar Pass perks (decision 8) behind the store flag;
//  - the alert schedule (decision 12): the joinable fights and what the war will announce before the front holds, for the cron.
import {CONQUEST,RULES} from './sim.gen.js';
import {earn,settleOpKills,discardOpKills} from './conquest-airdrop.js';
import {cacheMinerals,chained} from './conquest-economy.js';
import {chainWin,chainItem} from './conquest-living.js';
import {roll,bind,empty} from './conquest-loot.js';
import {orderEvent} from './conquest-orders.js';
import {track} from './conquest-analytics.js';
import {townAlerts} from './conquest-town.js';
const {War:WR,Combat:C,Battalion:BT,Alerts:AL}=CONQUEST,WAR=WR.WAR;
const fail=m=>{throw Error('conquest: '+m);};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
export const WAR_ACTIONS=['war-fortify','war-station','war-seen','war-alerts'];
// the Parasite camps (today's installations) inside a territory: overrun with it
const CAMPS=Object.freeze({'redoubt-01':'ash','staging-01':'oxygen','west-depot':'western','crossroads':'crossroads'});
const seedOf=s=>String(s.lseed|0)+':war';
// the Lunar Pass perks wait for the store (decision 8: live when the store opens in Session 8), like the Lab's research perks
export const passLive=premium=>!!premium&&RULES.LAB_STORE_OPEN===true;
export function war(s,now){s.war=WR.norm(s.war,now);return s.war;}
export const ctxOf=s=>({pilots:Array.isArray(s.bat?.p)?s.bat.p:[],morale:0,tiers:0,titan:0});   // planning pick: shared-war morale counts 0 until a shared-war result exists
// ---- the clock: every request (refreshState). seen: the pilot's last request before this one (s.lastWall) --------------------------
export function warTick(s,now){const w=war(s,now),fighting=s.mission&&s.sectorDefense?.active?s.sectorDefense.ev:null;   // the event being fought waits; the rest of the clock runs (the freeze and the weekend calendar hold)
 const out=WR.advance(w,now,seedOf(s),{...ctxOf(s),fighting},Number(s.lastWall)||now);
 for(const r of out)effects(s,r,now);if(!s.mission)WR.scriptReturn(w,now);jobs(s,now);frontSync(s,now);supplySync(s);return out;}
// what a tick's outcome does outside the war record: the Frontline sector and its camp fall with their territory; a fortification
// being built on fallen ground is refunded (it never stood)
function effects(s,r,now){if(r.kind==='refund'){refund(s,r.job);return;}const lost=[];if(r.kind==='a'&&r.r==='lost')lost.push(r.id);if(r.kind==='go')for(const x of r.res||[])if(x.r==='lost')lost.push(x.id);
 for(const id of lost){overrun(s,id,now);refundJobs(s,id);}}
function overrun(s,id,now){const t=WR.BY[id];s.territory=s.territory||{};const fall=k=>{const x=s.territory[k];if(!x||x.owner!=='humanity')return;x.owner='parasites';x.status='recaptured';x.lostAt=now;x.awaitingReinforcements=true;
  for(const e of Object.values(s.battle?.enemies||{}))if(e?.base?.id===k&&s.spawns?.[e.key])s.spawns[e.key].generation=Math.floor(now/864e5)-1;};   // the camp's garrison returns
 if(t?.sector)fall(t.sector);for(const [camp,tid] of Object.entries(CAMPS))if(tid===id)fall(camp);}
// the Frontline shows the war's pending assaults on its ground as its DEFENSE ALERT (a secured sector only); decided, it is secured again
function frontSync(s,now){const w=s.war;if(!s.territory)return;for(const t of WR.TERRITORIES){if(!t.sector)continue;const x=s.territory[t.sector];if(!x||x.owner!=='humanity'||x.status==='contested')continue;
 const alert=w.ev.some(e=>e.k==='a'&&e.t===t.id)||!!(w.go&&!w.go.done&&w.go.t.includes(t.id)&&w.go.open*WAR.tickMs<=now);x.status=alert?'defense-alert':'secured';delete x.defenseAt;}}
// supply (decision 10): +2% production per held Frontier or Warfront territory, max +16%: materials and CP only, never points. The
// Daily Base Yield (Combat.baseYield reads base.sup) and the town's production (Plot.rates reads plot.sup) apply it.
function supplySync(s){const v=WR.supply(s.war);if(s.base)s.base.sup=v;if(s.plot)s.plot.sup=v;}
// ---- Fortify (decision 6): one job at a time (two with the Pass), on the town's build timers ---------------------------------------
function jobs(s,now){const w=s.war;for(let i=w.jobs.length-1;i>=0;i--){const j=w.jobs[i];if(j.ready>now)continue;w.jobs.splice(i,1);if(w.o[j.t]!=='h'){refund(s,j);continue;}
 w.f[j.t]=Math.max(w.f[j.t]||0,j.l);w.pk[j.t]=Math.max(w.pk[j.t]||0,w.f[j.t]);s.notice={kind:'war-fortified',t:j.t,l:w.f[j.t]};}}
function refundJobs(s,id){const w=s.war;for(let i=w.jobs.length-1;i>=0;i--)if(w.jobs[i].t===id){refund(s,w.jobs[i]);w.jobs.splice(i,1);}}
function refund(s,j){const c=WR.fortifyCost(j.t,j.l,!!j.pp,!!j.re);if(!c)return;s.ledger.cp+=c.cp;for(const k of ['alloy','helium'])s.ledger.banked[k]=(s.ledger.banked[k]||0)+c[k];}
function spend(s,price){for(const [k,n] of Object.entries(price))if((k==='cp'?s.ledger.cp:s.ledger.banked[k]||0)<n)fail('insufficient banked '+(k==='helium'?'He-3':k)+': need '+n);
 s.ledger.cp-=price.cp;for(const k of ['alloy','helium'])s.ledger.banked[k]-=price[k];}
// ---- the pilot's war actions (the War Map) -------------------------------------------------------------------------------------
// war-fortify {war:{t}} · war-station {war:{t,p:[pilot ids]}} · war-seen · war-alerts {war:{on?,tz?,push?:{endpoint,keys}|null,drop?,sw?:{type:0|1}}}
export function warAction(s,r,now,ctx={}){const w=war(s,now),q=record(r.war)?r.war:{},pass=passLive(ctx.premium);
 if(r.action==='war-seen'){w.rep=now;s.notice={kind:'war-seen'};return;}
 if(r.action==='war-alerts'){alerts(s,q,now);return;}
 const t=WR.BY[q.t];if(!t)fail('unknown territory');
 if(r.action==='war-fortify'){if(!t.cap)fail(t.name+' cannot be fortified');if(w.o[t.id]!=='h')fail('the Parasites hold '+t.name);if(w.jobs.some(j=>j.t===t.id))fail(t.name+' is already being fortified');
  if(w.jobs.length>=WR.fortifySlots(pass))fail('one fortification at a time'+(WR.fortifySlots(pass)>1?'':' (a second slot comes with the Lunar Pass)'));const l=(w.f[t.id]||0)+1;if(l>WAR.fortify.max)fail(t.name+' is fully fortified');
  const re=l<=(w.pk[t.id]||0),price=WR.fortifyCost(t.id,l,pass,re);spend(s,price);const ms=WR.fortifyTime(l,pass);w.jobs.push({t:t.id,l,ready:now+ms,ms,...(re?{re:1}:{}),...(pass?{pp:1}:{})});
  track(s,'war_fortify',t.id,'l'+l);s.notice={kind:'war-fortify',t:t.id,l,ready:now+ms,...price,rebuild:re};return;}
 if(r.action==='war-station'){const ids=(Array.isArray(q.p)?q.p:[]).filter(x=>typeof x==='string').slice(0,WAR.station.max+1);if(ids.length>WAR.station.max)fail('station at most '+WAR.station.max+' pilots a territory');
  const threatened=w.ev.some(e=>e.t===t.id)||!!(w.go&&!w.go.done&&w.go.t.includes(t.id));if(ids.length&&!threatened)fail(t.name+' is not threatened: station reserves where a battle is announced');
  const T=s.bat||{},pilots=Array.isArray(T.p)?T.p:[],lv=hangarLv(s),fielded=new Set(BT.picked(T,lv,'battalion').map(p=>p.id)),busy=new Set();for(const [k,v] of Object.entries(w.st))if(k!==t.id)for(const id of v)busy.add(id);
  for(const id of ids){const p=pilots.find(x=>x.id===id);if(!p)fail('unknown pilot');if(fielded.has(id))fail(p.cs+' is fielded: station a reserve (a roster pilot your Hangar does not field)');if(busy.has(id))fail(p.cs+' is stationed elsewhere');if(p.h===.5)fail(p.cs+' needs a repair first');}
  if(new Set(ids).size!==ids.length)fail('a pilot twice');if(ids.length)w.st[t.id]=ids;else delete w.st[t.id];s.notice={kind:'war-station',t:t.id,n:ids.length,v:WR.stationValue(pilots,ids)};return;}
 fail('invalid war action');}
const hangarLv=s=>{let lv=0;for(const b of Object.values(s.plot?.b||{}))if(b?.t==='hangar')lv=Math.max(lv,b.l|0);return lv;};
// the reserves that may be stationed (decision 7): roster pilots the Hangar does not field, not stationed, not downed
export function reservesOf(s){const T=s.bat||{};return WR.reserves(T.p||[],BT.picked(T,hangarLv(s),'battalion').map(p=>p.id),s.war);}
// a stationed reserve can't garrison the town (Session 7T reads this)
export const isStationed=(s,pilotId)=>WR.stationed(s.war).has(pilotId);
// ---- the alert settings (decision 12) -----------------------------------------------------------------------------------------------
// push: a browser subscription (website only): its endpoint must be a known push service (the cron POSTs to it); up to 3 devices
const PUSH_HOSTS=/^https:\/\/([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com|push\.microsoft\.com)\//;
const b64u=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{16,140}={0,2}$/.test(v);
export function alertSettings(s){const a=record(s.al)?s.al:{};const ps=(Array.isArray(a.ps)?a.ps:record(a.ps)?Object.values(a.ps):[]).filter(p=>record(p)&&typeof p.e==='string'&&PUSH_HOSTS.test(p.e)&&b64u(p.k)&&b64u(p.a)).slice(-3);
 const sw=record(a.sw)?Object.fromEntries(Object.keys(a.sw).filter(k=>AL.PRI[k]&&a.sw[k]===0).map(k=>[k,0])):{};   // Session 7T decision 9: the types switched off
 s.al={on:a.on===0?0:1,ask:a.ask?1:0,tz:Number.isSafeInteger(a.tz)&&Math.abs(a.tz)<=840?a.tz:0,ps,sw,...(a.home?{home:1}:{})};return s.al;}
function alerts(s,q,now){const a=alertSettings(s);if(q.on!==undefined)a.on=q.on?1:0;
 if(record(q.sw)){const keys=Object.keys(q.sw);if(keys.length>AL.TYPES.length||keys.some(k=>!AL.PRI[k]))fail('invalid alert type');for(const k of keys){if(q.sw[k])delete a.sw[k];else a.sw[k]=0;}}   // per-type switches (decision 9)
 if(q.tz!==undefined){const tz=Math.round(Number(q.tz));if(!Number.isSafeInteger(tz)||Math.abs(tz)>840)fail('invalid time zone');a.tz=tz;}
 if(q.home)a.home=1;   // the iOS "Add LUNAR to your Home Screen" card was shown (one time)
 if(q.push===null||q.drop){a.ps=a.ps.filter(p=>p.e!==(q.drop||'')&&q.push!==null);}
 else if(record(q.push)){const e=String(q.push.endpoint||''),k=q.push.keys?.p256dh,au=q.push.keys?.auth;if(e.length>600||!PUSH_HOSTS.test(e)||!b64u(k)||!b64u(au))fail('invalid push subscription');a.ps=[...a.ps.filter(p=>p.e!==e),{e,k,a:au,at:now}].slice(-3);a.on=1;}
 s.al=a;s.notice={kind:'war-alerts',on:a.on,push:a.ps.length,sw:{...a.sw}};}
// the client reports its time zone with each session open (the alerts' local night)
export function reportTz(s,tz){if(tz===undefined)return;const v=Math.round(Number(tz));if(Number.isSafeInteger(v)&&Math.abs(v)<=840)alertSettings(s).tz=v;}
// ---- a war battle: start, then settle -------------------------------------------------------------------------------------------
// The event this operation fights now (an assault on its territory, the LDF's counterattack, or the Grand Offensive on one of its
// targets), or null. The phone shows the same thing from the same rules.
export const battleFor=WR.battleFor;
export function warCheck(s,op,now){const w=war(s,now),e=battleFor(w,op,now);if(!e)fail('no battle here right now: the War Map shows what is inbound');return e;}
// the battle begins: the one attempt is spent now. Returns the s.sectorDefense record.
export function warBegin(s,op,now){const w=war(s,now),e=warCheck(s,op,now),b=WR.begin(w,e.id,s.attempt,now);if(!b)fail('this battle was already fought');al1(s);
 track(s,'war_battle',e.go?'go':e.k==='c'?'counter':'assault',e.t);return {sector:op.sector||null,territory:op.territory,ev:e.id,kind:e.go?'go':e.k,attempt:s.attempt,active:true,...(e.g?{g:e.g}:{}),...(e.go?{go:1}:{})};}
const al1=s=>{alertSettings(s).ask=1;};   // the pilot's first war battle: from here the alerts are live and the phone offers browser alerts (decision 12)
// the battle's authored extras: the general who leads an assault joins its last wave; the Grand Offensive fights three waves
export function warExtras(a,B){if(!a)return;const g=WR.GEN[a.g];if(g)B.general={id:g.id,stars:g.stars,pattern:g.pattern};if(a.go)B.waveMax=3;}
// victory, defeat or a retreat. Returns the receipt (s.settlement).
export function warOutcome(s,outcome,now){const a=s.sectorDefense;if(!a?.active)return s.settlement||null;a.active=false;const w=war(s,now),t=a.territory||a.sector,kind=a.kind||'a',op=C.operations[s.mission]?.war?C.operations[s.mission]:C.operations[WR.opOf({k:kind==='c'?'c':'a',t})],won=outcome==='victory';
 const x=a.sector?s.territory?.[a.sector]:null;if(x&&x.status==='contested'){x.status=x.owner==='humanity'?'secured':(x.lostAt?'recaptured':'active-parasites');}   // the Frontline sector goes back to how it was; the war decides the ground
 const r=WR.settle(w,a.ev,won,now,a.attempt),base={kind:won&&r?(kind==='c'?'war-retaken':kind==='go'?'war-offensive':'war-held'):'war-fought',war:kind,territory:t,outcome,at:now,stolen:0};
 if(!won||!r){settleOpKills(s,now);const receipt={...base,ptsRaw:0,cp:0,alloy:0,biomass:0,helium:0,used:1,line:'The strength roll decides it when it lands: '+(WR.odds(w,kind==='go'?{k:'a',t,g:w.go?.g,air:1,ds:1,go:1}:WR.pending(w,a.ev),{...ctxOf(s),now})?.line||'')};if(a.sector&&s.territory?.[a.sector])s.territory[a.sector].defenseReport=receipt;s.notice=receipt;frontSync(s,now);return receipt;}
 discardOpKills(s);track(s,'war_won',kind==='go'?'go':kind==='c'?'counter':'assault',t);const danger=kind==='a'?'defense':kind==='go'?'VETERAN':WR.dangerOf(t),pts=earn(s,'defense',WR.battlePoints(kind,t),now,{op:true});
 const links=chainWin(s,now),pay=chained(op?.reward||{cp:160,alloy:15,biomass:10,helium:2},links);s.ledger.cp+=pay.cp;for(const k of ['alloy','biomass','helium'])s.ledger.cargo[k]+=pay[k]||0;
 const key='war:'+a.ev+':'+(a.attempt|0),mn=cacheMinerals(s,danger,key),loot=bind(s,kind==='a'?roll(s,'defense',key):roll(s,'chest',key),now,{where:'war battle'});
 orderEvent(s,'op');orderEvent(s,'defense');s.reputation=(s.reputation||0)+40;s.campaignScore=(s.campaignScore||0)+12;s.achievements=s.achievements||{};s.achievements['war-'+(kind==='c'?'retaken':kind==='go'?'offensive':'defended')]=s.achievements['war-'+(kind==='c'?'retaken':kind==='go'?'offensive':'defended')]||now;
 let trophy=null;if(r.general){if(WR.beatGeneral(w,r.general,now)){trophy=r.general;s.achievements['general-'+r.general]=now;}}
 if(kind==='c'&&a.sector)reSecure(s,a.sector,now);   // you retook it in person: the Frontline sector on that ground is yours again
 const receipt={...base,ptsRaw:pts,...(Object.keys(mn).length?{mn}:{}),...(empty(loot)&&!loot.pieces?{}:{loot}),cp:pay.cp,alloy:pay.alloy||0,biomass:pay.biomass||0,helium:pay.helium||0,reputation:40,...(trophy?{trophy}:{}),...(links?{chain:chainItem(s,key,links,now)}:{}),
  entrenched:kind!=='c'||w.o[t]==='h'?now+WAR.entrenchMs:0,...(kind==='go'?{targets:r.targets}:{})};
 if(a.sector&&s.territory?.[a.sector])s.territory[a.sector].defenseReport=receipt;s.notice=receipt;frontSync(s,now);return receipt;}
function reSecure(s,sector,now){s.territory=s.territory||{};const x=s.territory[sector]||{};s.territory[sector]={...x,owner:'humanity',status:'secured',capturedAt:x.capturedAt||now,awaitingReinforcements:false};s.achievements['secured-'+sector]=s.achievements['secured-'+sector]||now;}
// a raid won (missionReward): in a Parasite-held territory it weakens the hold; in the portal's territory it shuts the portal for 48 h
export function warRaid(s,op,now){const w=war(s,now),id=op?.sector&&WR.BY[op.sector]?op.sector:null;if(!id)return null;const r=WR.raidWon(w,id,now);return Object.keys(r).length?r:null;}
// ---- the alert schedule (decision 12): the doc the cron reads (wal/<pid>) ----------------------------------------------------------
// Events: the fights the pilot can still join, plus what the war will announce before the front holds (a full day after this
// request), forecast from the same deterministic clock (nothing is sent before its announcement). Only the announcement's time,
// territory and landing are written; the rolls never leave the Conquest record.
export function alertDoc(s,now){if(!s?.war)return null;const w=s.war=WR.norm(s.war,now),a=alertSettings(s);const live=a.on===1&&a.ask===1;
 const evs=live?WR.alertEvents(w):[],seen=new Set(evs.map(e=>e.id));
 if(live){const f=structuredClone(w),ctx=ctxOf(s),end=WR.tickOf(now+WAR.freezeMs-1);for(let k=f.k+1;k<=end;k++){WR.step(f,k,seedOf(s),{...ctx});for(const e of WR.alertEvents(f))if(!seen.has(e.id)){seen.add(e.id);evs.push(e);}}}
 const ev=evs.filter(e=>e.until>now).map(e=>({id:e.id,k:e.kind,t:e.t,at:e.at,until:e.until,...(e.n?{n:e.n}:{})}));
 // Session 7T decision 9: the town's attacks (and the raids forecast to breach it) join the same schedule, ahead of the war's
 if(live){let tev=[];try{tev=townAlerts(s,now,now+WAR.freezeMs);}catch(_){}for(const e of tev)if(e.until>now&&!seen.has(e.id)){seen.add(e.id);ev.push(e);}}
 ev.sort((x,y)=>x.at-y.at);const list=ev.slice(0,16);
 // one budget for every notification (decision 9): rm, the daily reminder is sent by the alert cron (worker/src/index.js sendReminders
 // leaves this pilot to it); ga, the game's alerts are live; pl, bd, y90: what the cron needs for the Meteor, the Beacon and the yield
 const tier=s.base?.tier|0,d={v:1,on:a.on===1?1:0,ga:live?1:0,rm:1,tz:a.tz,ev:list,sw:{...a.sw},pl:now,bd:Number(s.bcn?.d)||0,y90:tier?(Number(s.base.claimedAt)||0)+.9*RULES.CQ_YIELD.day:0,ps:a.ps.map(p=>({e:p.e,k:p.k,a:p.a}))};
 const plan=d.on?AL.plan([...list,...AL.synth(d,now,a.tz)],now,a.tz,undefined,a.sw):[];
 return {...d,nx:plan[0]?.at||0};}
// After a Conquest reducer: the schedule doc to write after the commit, or null when nothing it depends on changed (a cheap key:
// the tick, the events and their attempts, the Grand Offensive, ownership and the alert settings). Kept in s.war.ak.
export function alertChange(s,now){try{return alertChange0(s,now);}catch(_){return null;}}   // best effort: the alerts never fail a Conquest request
function alertChange0(s,now){if(!s?.war)return null;const w=s.war=WR.norm(s.war,now);const a=alertSettings(s),tw=s.tw,p=s.plot;
 // Session 7T: the town's clock, its attacks, the town itself (a forecast raid meets it as built), the Beacon, the yield, the switches
 // and the local day (the reminder skips a day already played)
 const town=tw?[tw.k,(tw.ev||[]).map(e=>[e.id,e.tr|0,e.l,e.lc|0]),(tw.log||[]).length,p?.cc|0,p?Object.values(p.b||{}).reduce((x,b)=>x+(b.l|0)*7+b.i*3+b.j,0):0,p?Object.keys(p.w||{}).length:0,p?Object.keys(p.dmg||{}).length:0,Number(p?.shieldUntil)||0,p?.job?.end|0,(s.bat?.p||[]).map(x=>x.id+(x.h===.5?'d':'')).join('')]:0;
 const key=WR.u32(JSON.stringify([w.k,w.ev.map(e=>[e.id,e.tr|0,e.l]),w.go&&[w.go.w,w.go.tr|0,w.go.done|0],a.on,a.ask,a.tz,a.ps.map(p=>p.e),WR.IDS.map(id=>w.o[id]+(w.f[id]|0)+(w.st[id]?.length|0)).join(''),w.jobs.length,
  town,Number(s.base?.claimedAt)||0,s.bcn?.d|0,a.sw,WR.localDay(now,a.tz)])).toString(36);
 if(key===w.ak)return null;w.ak=key;return alertDoc(s,now);}
