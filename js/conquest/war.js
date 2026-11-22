/* Session 7 Living Front (owner brief docs/conquest/audit/SESSION_07_BRIEF.md, decisions 1-13; blueprint §5): the war's shared
   rules. Pure functions over the pilot's own war record (s.war), shared by the phone (the War Map draws from them) and the Worker
   (worker/build-sim.mjs packs this file into the CONQUEST bundle; worker/src/conquest-war.js owns every change). Every result is
   decided on the Worker: the rolls come from the server-only loot seed, the phone never sees them.
   The war runs on its own clock in every pilot's world: a tick every 6 hours; the Parasites may announce one assault and the LDF
   one counterattack a tick, each landing 12 hours (two ticks) later; a battle nobody fights is decided by strength (DEFENSE
   against THREAT, 5-95%), inside hard limits. Nothing here reads gear, power, league, purchases or Command Center level.
   Hooks for Session 7-V (the Fable visual session) are named in HOOKS below: the 7 new territories' ground, dropships flying
   their routes (dropships()), the portal coming alive (portalOf()), LDF posts placed for real (ldfPosts()) and living terraform
   drawn (terraOf()). Town attacks (Session 7T) reuse this clock and the alerts; the Citadel (7B) adds THREAT through ctx.tiers. */
(function(root){
'use strict';
const HOUR=3600000,DAY=24*HOUR;
// ---- settings (owner decisions; each a single setting) -------------------------------------------------------------------
const WAR=Object.freeze({
 v:1,
 tickMs:6*HOUR,            // decision 2: a tick every 6 hours
 warnMs:12*HOUR,           // decision 2: each assault and counterattack is announced 12 hours (two ticks) ahead
 entrenchMs:24*HOUR,       // decision 3: a defense won in person entrenches the territory for 24 hours (no assault may target it)
 freezeMs:DAY,             // decision 4: after one full day away the front holds until you return
 dayNetLoss:2,             // decision 4: battles you didn't fight cost at most 2 territories net in any 24 hours
 dayTicks:4,               // the rolling window of that limit, in ticks (24 h)
 ceiling:8,floor:3,        // decision 1: Parasites never above 8; 3 is the floor (the Inner Ring, which never falls)
 start:{human:16,parasite:4},
 // decision 5: each point of DEFENSE over THREAT is worth the same in log-odds: even 50%, +1 about 70% (k = ln(7/3)), +2 84.5%,
 // +3 92.7%, the same in reverse when behind; always clamped to 5-95%
 odds:Object.freeze({k:Math.log(7/3),min:.05,max:.95}),
 // tuned by the drift simulation (dev/tests/conquest-war-drift.mjs): a front left alone drifts toward the Parasites about one
 // territory every 2-3 days; a pilot who fights about half the assaults and fortifies the threatened territory each day pushes it
 // back within a week. Garrison: the ring's LDF DEFENSE (index = ring); ldf: the LDF's strength in a counterattack by ring;
 // hold: the Parasites' hold of a captured territory by ring.
 garrison:Object.freeze([0,3,3,2,1,0]),interior:1,ldf:Object.freeze([0,0,3,2,2,0]),hold:Object.freeze([0,0,1,1,2,9]),
 assaultChance:.62,counterChance:.5,heartlandShare:.18,airShare:.25,maxPending:2,
 // the portal (blueprint §5): +1 THREAT to every assault while open; a raid won in its territory shuts it for 48 h; it relocates
 // after three suppressions; it also hardens its own ground (+1 hold)
 portal:Object.freeze({threat:1,hold:1,suppressMs:48*HOUR,relocateAfter:3}),
 // a raid won in a Parasite-held territory weakens its hold for the next counterattack (the gambit: hit the source), up to -2, 48 h
 weaken:Object.freeze({per:1,max:2,ms:48*HOUR}),
 // decision 6: Fortify, 5 levels a territory, +1 DEFENSE each. Level 1 costs about half a day of a regular pilot's Conquest income
 // (the economy model's regular, 60 min a day, measured with the audit method on the real Worker functions: 7,121 CP, 1,306 alloy
 // and 303 He-3 a day over the first 120 days, dev/tools/war-model.mjs); each level costs 2.4x the last, times the ring's danger
 // (Rear 1.0, Frontier 1.2, Warfront 1.45); one fortification at a time, on the town's build timers (15 s, 3 min, 20 min, 2 h, 6 h);
 // wear: an assault decided by the strength roll knocks a fortified territory down a level; rebuilding a worn level costs a quarter
 fortify:Object.freeze({max:5,l1:Object.freeze({cp:3560,alloy:653,helium:152}),mult:2.4,danger:Object.freeze([1,1,1,1.2,1.45,1]),
  timeMs:Object.freeze([15000,180000,1200000,7200000,21600000]),rebuild:.25,slots:1}),
 // decision 8 (behind the Lunar Pass flag; live when the store opens in Session 8): a second slot, 20% cheaper, 20% faster
 pass:Object.freeze({slots:2,cost:.8,time:.8}),
 // decision 7: Station, free: up to 2 reserve pilots (roster pilots not fielded) per threatened territory; DEFENSE from their rating,
 // up to +1 for the pair; they return when that assault is decided; a stationed reserve can't garrison the town (7T reads stationed())
 station:Object.freeze({max:2,pair:1,each:.5,min:.25,ref:140}),
 // decision 9: the Grand Offensive, about three territories (planning pick), every weekend: announced Friday 00:00 UTC (24 h ahead),
 // started by the pilot inside its 48-hour window (Saturday 00:00 - Monday 00:00 UTC); not started by the window's end it launches
 // and each target is decided by strength with its extra THREAT. The one event that may change more than one territory in a tick,
 // inside the limits. Skipped while the front is frozen. The town as a target comes with 7T.
 go:Object.freeze({targets:3,surge:1,announceDow:5,openMs:DAY,windowMs:2*DAY,fromDay:5}),
 // decision 10: war battles pay par minutes x 225 x the ring's danger (Heartland and Rear 1.0, Frontier 1.2, Warfront 1.45); a territory
 // defense pays the existing "Defense victory (sector)" value (RULES.CQ_PTS.defense, 675)
 ppm:225,danger:Object.freeze([1,1,1,1.2,1.45,1.45]),par:Object.freeze({counter:3.33,go:5}),
 // decision 10: holding territory: supply +2% production (materials and CP only, never points) per held Frontier or Warfront territory
 supply:Object.freeze({per:.02,max:.16}),
 // living terraform (for 7-V to draw): -2 overrun, -1 blighted, 0 barren, 1 pylon lit, 2 lichen, 3 green; a held territory grows a step
 // every 2 days up to its ring's cap; a raid let through blights it a step; a fallen territory is overrun; a retaken one starts blighted
 terra:Object.freeze({min:-2,cap:Object.freeze([0,3,2,1,1,-2]),growTicks:8}),
 // generals: a beaten general retreats for 3 days, then returns; five-star generals never leave the Inner Ring
 retreatMs:3*DAY,
 log:24
});
// ---- the theater (decision 1): 20 territories in five rings; 11 exist today (ex:1). Until Session 7-V builds their ground, the
// Parasites attack only the human-held territories among the 11 that exist (and never the town: 7T); the 7 new ones show as safe
// human ground; the second bastion and the Citadel stay Parasite-held. x,z: world metres (the War Map's layout and 7-V's ground).
// sector: the Frontline sector on that ground (the six-sector Frontline keeps its own count, js/conquest/world.js sectors).
// def: the defense operation an assault is fought in; cop: the LDF counterattack's operation.
const T=(id,name,ring,x,z,o)=>Object.freeze({id,name,ring,x,z,ex:0,start:'h',sector:null,def:null,cop:null,cap:ring>=2&&ring<=4,heart:ring===1,inner:ring===5,...o});
const TERRITORIES=Object.freeze([
 T('colony','REFUGE COLONY',1,1150,1130,{ex:1,def:'colony-defense-colony',what:'The Refuge terminal, the oxygen towers and the colony town'}),
 T('refuge','REFUGE CORRIDOR',1,1010,1100,{ex:1,sector:'refuge',def:'sector-defense-refuge',what:'The viaduct and the supply bastions'}),
 T('reservoir','RESERVOIR FLATS',1,860,1290,{ex:1,def:'colony-defense-reservoir',what:'The ice crater lake and the farms it waters'}),
 T('town','YOUR TOWN',1,1080,1160,{ex:1,town:1,what:'Your town at the Command Gate. Town attacks arrive with a later update'}),
 T('silt','SILT DUNES',2,690,1150,{what:'Barren dunes west of the corridor: an LDF post, Ferrite veins, a patrol'}),
 T('quarry','OLD QUARRY',2,650,1360,{what:'Abandoned regolith workings: convoys run here'}),
 T('mesa','SOUTH MESA',2,930,1480,{what:'A high mesa above the reservoir: an LDF watch post'}),
 T('kiln','KILN FLATS',2,1150,1440,{what:'Glassy flats south of the colony: a strike site and veins'}),
 T('watch','NORTHWATCH',2,700,960,{what:'The northern watch line: an LDF post and a convoy road'}),
 T('western','WESTERN SALVAGE REACH',3,920,925,{ex:1,sector:'western',def:'sector-defense-western',cop:'counterattack-western',what:'Depot gantries and alloy salvage'}),
 T('glass','GLASS FIELDS',3,840,770,{what:'Fused-glass plains on the north flank'}),
 T('helium','HELIUM BASIN',3,1080,835,{ex:1,sector:'helium',def:'sector-defense-helium',cop:'counterattack-helium',what:'Helium-3 extraction routes and gun emplacements'}),
 T('crossroads','DUST CROSSROADS',3,1100,954,{ex:1,def:'war-defense-crossroads',cop:'counterattack-crossroads',what:'The road junction north of the colony'}),
 T('cinder','CINDER SHELF',3,1320,1370,{what:'Ash terraces on the south flank'}),
 T('ash','ASH REDOUBT',4,1250,900,{ex:1,start:'p',sector:'ash',def:'sector-defense-ash',cop:'counterattack-ash',approach:1,what:'The armored siege gates: the road east to the Citadel'}),
 T('oxygen','OXYGEN SPEAR',4,1230,1020,{ex:1,sector:'oxygen',def:'sector-defense-oxygen',cop:'counterattack-oxygen',approach:1,what:'Reactor towers and air defense'}),
 T('ridge','REFUGE RIDGE',4,1270,1175,{ex:1,sector:'ridge',def:'sector-defense-ridge',cop:'counterattack-ridge',what:'Ridge signal arrays above the colony'}),
 T('east','EASTERN RIM',5,1398,1074,{ex:1,start:'p',what:'The outer bastion of the Hive'}),
 T('bastion','SPORE BASTION',5,1540,960,{start:'p',what:'The second bastion, behind the Eastern Rim'}),
 T('citadel','THE CITADEL',5,1660,1080,{start:'p',what:'The Parasite throne. Its siege arrives with the Citadel update'})
]);
const BY=Object.freeze(Object.fromEntries(TERRITORIES.map(t=>[t.id,t])));
const IDS=Object.freeze(TERRITORIES.map(t=>t.id));
const ADJ=Object.freeze(Object.fromEntries(Object.entries({
 colony:['town','refuge','oxygen','ridge','crossroads','kiln'],refuge:['colony','town','reservoir','western','crossroads','silt','watch'],
 reservoir:['refuge','town','silt','quarry','mesa','kiln'],town:['colony','refuge','reservoir'],silt:['refuge','reservoir','quarry','watch'],
 quarry:['silt','reservoir','mesa'],mesa:['quarry','reservoir','kiln'],kiln:['mesa','reservoir','colony','cinder','ridge'],
 watch:['silt','refuge','western','glass'],western:['watch','glass','helium','crossroads','refuge'],glass:['watch','western','helium'],
 helium:['glass','western','crossroads','ash'],crossroads:['western','helium','ash','oxygen','refuge','colony'],cinder:['kiln','ridge'],
 ash:['helium','crossroads','oxygen','east','bastion'],oxygen:['crossroads','ash','ridge','colony','east'],ridge:['oxygen','colony','cinder','kiln','east'],
 east:['ash','oxygen','ridge','bastion','citadel'],bastion:['east','ash','citadel'],citadel:['east','bastion']}).map(([k,v])=>[k,Object.freeze(v)])));
const RINGS=Object.freeze(['','HEARTLAND','REAR','FRONTIER','WARFRONT','INNER RING']);
// The Citadel's approach (blueprint §6 "FRONT: hold both approach territories in Ring 4"; planning pick: Ash Redoubt and Oxygen Spear,
// the north-east road the journey's "retake Ash Redoubt, hold both approach territories" points at)
const APPROACH=Object.freeze(TERRITORIES.filter(t=>t.approach).map(t=>t.id));
// what the Parasites may attack today (decision 1): human-held, existing ground, never the town (7T)
const attackable=t=>!!t&&t.ex===1&&!t.town&&!t.inner;
// ---- generals (blueprint §5): named, 1-5 stars, each one of the five commander doctrines already built --------------------------
const G=(id,name,stars,pattern)=>Object.freeze({id,name,stars,pattern});
const GENERALS=Object.freeze([
 G('skaal','GRUB-CAPTAIN SKAAL',1,'ambush'),G('nix','BROODWARDEN NIX',1,'carrier'),
 G('rheel','SIEGE-MOTHER RHEEL',2,'plasma'),G('kethra','WARLORD KETHRA',2,'shield'),G('ulm','GOREHOUND ULM',2,'artillery'),
 G('malgrath','OVERSEER MALGRATH',3,'ambush'),G('quorr','HIVELORD QUORR',3,'carrier'),G('ixa','DREAD MATRON IXA',3,'plasma'),
 G('herald','THE PALE HERALD',4,'shield'),G('hand','THE SOVEREIGN\'S HAND',5,'artillery')]);
const GEN=Object.freeze(Object.fromEntries(GENERALS.map(g=>[g.id,g])));
// ---- the scripted first war (decision 13; blueprint §3 first-days table), on the war clock and every rule here -------------------
// day 1 quiet; S1: the LDF holds one territory while you are away (its roll is authored: it holds); S2: one assault inbound when you
// come back on day 2, and you defend it (the War Report introduces the War Map); F1: the First Offensive's dropship lands a Parasite
// foothold on ground that exists today (authored to land unless you beat it in person); C1: the LDF counterattacks and you join it
// and retake the foothold (counterattacks, then Fortify). If F1 is beaten in person, C1 goes to Ash Redoubt instead.
const SCRIPT=Object.freeze({quietMs:6*HOUR,returnMs:18*HOUR,s1:'western',s2:'helium',f1:'crossroads',s1Gen:'skaal',s2Gen:'nix',f1Gen:'skaal',endDay:5});
// ---- small helpers ---------------------------------------------------------------------------------------------------------------
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const list=v=>Array.isArray(v)?v.filter(record):record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]).filter(record):[];
const int=v=>Math.max(0,Math.floor(Number(v)||0));
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
function u32(t){let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;}
const unit=t=>u32(t)/4294967296;
const tickOf=ms=>Math.floor(ms/WAR.tickMs),warnTicks=()=>Math.max(1,Math.round(WAR.warnMs/WAR.tickMs));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// decision 5: the chance a territory holds when DEFENSE - THREAT = d (or an LDF counterattack succeeds when LDF - HOLD = d)
function chance(d){const O=WAR.odds;return clamp(1/(1+Math.exp(-O.k*num(d))),O.min,O.max);}
const pct=p=>Math.round(p*100);
// ---- the war record ----------------------------------------------------------------------------------------------------------
// s.war: {v, t0 the war's start (the first session), k the last tick processed, o ownership {id:'h'|'p'},
// f fortification {id:level}, pk peak level (a worn level rebuilds at a quarter), en entrenched until {id:ms}, tf living terraform
// {id:-2..3}, hs held since {id:tick}, wk weakened holds {id:{n,until}}, ev pending events, log outcomes, rep the War Report read up to,
// ld unfought net changes [{k,d}], por the portal {at,until,n,moves}, gen generals {id:{back,beat}}, go the Grand Offensive,
// jobs fortification jobs [{t,l,ready,ms}], st stationed {id:[pilot ids]}, sc the script, n events made, tro trophies, cnt counts}
function fresh(now){const o={},tf={},hs={},k=tickOf(now);for(const t of TERRITORIES){o[t.id]=t.start;tf[t.id]=t.start==='p'?-2:Math.min(WAR.terra.cap[t.ring],t.ring===1?3:0);hs[t.id]=k;}
 return {v:1,t0:now,k,o,f:{},pk:{},en:{},tf,hs,wk:{},ev:[],log:[],rep:now,ld:[],por:{at:'ash',until:0,n:0,moves:0},gen:{},go:null,jobs:[],st:{},sc:{n:0},n:0,tro:{},cnt:{held:0,lost:0,taken:0,won:0}};}
// Firebase drops empty maps and turns arrays into objects: rebuild every field (the Worker calls this on every load).
function norm(w,now){if(!record(w)||w.v!==1)return fresh(now);const o={},f={},pk={},en={},tf={},hs={},wk={},st={},gen={},tro={};
 for(const t of TERRITORIES){o[t.id]=w.o?.[t.id]==='p'||w.o?.[t.id]==='h'?w.o[t.id]:t.start;if(t.inner)o[t.id]='p';if(t.heart)o[t.id]='h';if(!t.ex&&!t.inner)o[t.id]='h';   // the map enforces: the Inner Ring never falls, the Heartland is never captured, the new ground is safe until 7-V
  const fl=Math.min(WAR.fortify.max,int(w.f?.[t.id]));if(fl&&t.cap&&o[t.id]==='h')f[t.id]=fl;const p=Math.min(WAR.fortify.max,int(w.pk?.[t.id]));if(p&&t.cap)pk[t.id]=Math.max(p,f[t.id]||0);
  const e=int(w.en?.[t.id]);if(e)en[t.id]=e;tf[t.id]=clamp(Math.round(num(w.tf?.[t.id],o[t.id]==='p'?-2:0)),WAR.terra.min,3);hs[t.id]=int(w.hs?.[t.id]??tickOf(now));
  const q=w.wk?.[t.id];if(record(q)&&int(q.until)>now)wk[t.id]={n:Math.min(WAR.weaken.max,int(q.n)),until:int(q.until)};
  const sp=w.st?.[t.id];const ids=(Array.isArray(sp)?sp:record(sp)?Object.values(sp):[]).filter(x=>typeof x==='string'&&/^p\d{1,4}$/.test(x)).slice(0,WAR.station.max);if(ids.length)st[t.id]=ids;}
 for(const g of GENERALS){const x=w.gen?.[g.id];if(record(x))gen[g.id]={back:int(x.back),beat:int(x.beat)};if(int(w.tro?.[g.id]))tro[g.id]=int(w.tro[g.id]);}
 const ev=list(w.ev).filter(e=>typeof e.id==='string'&&BY[e.t]&&['a','c'].includes(e.k)).map(e=>({id:e.id,k:e.k,t:e.t,g:GEN[e.g]?e.g:null,a:int(e.a),l:int(e.l),air:e.air?1:0,ds:Math.min(2,int(e.ds)),...(e.tr?{tr:int(e.tr)}:{}),...(e.sc!==undefined&&Number.isFinite(Number(e.sc))?{sc:clamp(Number(e.sc),0,.999999)}:{})}));
 const lg=list(w.log).slice(-WAR.log).map(x=>({at:int(x.at),k:String(x.k||''),t:BY[x.t]?x.t:'',r:String(x.r||'').slice(0,16),by:String(x.by||'').slice(0,8),...(x.g&&GEN[x.g]?{g:x.g}:{}),...(x.w?{w:int(x.w)}:{}),...(x.n?{n:int(x.n)}:{}),...(x.p!==undefined?{p:clamp(num(x.p),0,1)}:{})}));
 const ld=list(w.ld).map(x=>({k:int(x.k),d:Math.round(num(x.d))})).filter(x=>x.d).slice(-12);
 const por=record(w.por)&&BY[w.por.at]?{at:w.por.at,until:int(w.por.until),n:int(w.por.n),moves:int(w.por.moves)}:{at:'ash',until:0,n:0,moves:0};
 const go=record(w.go)&&Number.isSafeInteger(Number(w.go.w))?{w:int(w.go.w),a:int(w.go.a),open:int(w.go.open),end:int(w.go.end),g:GEN[w.go.g]?w.go.g:'malgrath',t:(Array.isArray(w.go.t)?w.go.t:record(w.go.t)?Object.values(w.go.t):[]).filter(x=>BY[x]).slice(0,WAR.go.targets),...(w.go.tr?{tr:int(w.go.tr)}:{}),...(w.go.done?{done:1}:{}),...(w.go.won?{won:1}:{}),...(w.go.skip?{skip:1}:{})}:null;
 const jobs=list(w.jobs).filter(j=>BY[j.t]&&BY[j.t].cap).map(j=>({t:j.t,l:clamp(int(j.l),1,WAR.fortify.max),ready:int(j.ready),ms:int(j.ms),...(j.re?{re:1}:{})})).slice(0,WAR.pass.slots);
 const sc=record(w.sc)?{n:int(w.sc.n),...(w.sc.ret?{ret:int(w.sc.ret)}:{}),...(w.sc.f1?{f1:String(w.sc.f1).slice(0,12)}:{}),...(w.sc.fort?{fort:1}:{}),...(w.sc.done?{done:1}:{})}:{n:0};
 const cnt={held:int(w.cnt?.held),lost:int(w.cnt?.lost),taken:int(w.cnt?.taken),won:int(w.cnt?.won)};
 return {v:1,t0:int(w.t0)||now,k:Number.isSafeInteger(Number(w.k))?Number(w.k):tickOf(now),o,f,pk,en,tf,hs,wk,ev,log:lg,rep:int(w.rep),ld,por,gen,go,jobs,st,sc,n:int(w.n),tro,cnt,...(typeof w.ak==='string'?{ak:w.ak.slice(0,16)}:{})};}   // ak: the alert schedule's key (worker/src/conquest-war.js)
// ---- counts ----------------------------------------------------------------------------------------------------------------------
const humanHeld=w=>IDS.filter(id=>w.o[id]==='h').length;
const parasiteHeld=w=>IDS.filter(id=>w.o[id]==='p').length;
// the six-sector Frontline (its own count, beside the Moon's; never mixed): sectors the pilot has secured (s.territory)
function frontline(territory){const S=root.ConquestWorld?.sectors||[];return {held:S.filter(x=>territory?.[x.id]?.owner==='humanity').length,of:S.length||6};}
const isParasiteNeighbor=(w,id)=>ADJ[id].some(n=>w.o[n]==='p');
// ---- DEFENSE, THREAT and the odds (decision 5) ----------------------------------------------------------------------------------
// ctx: {now, morale (shared-war morale: 0 until a shared-war result exists, planning pick), tiers (Citadel tiers cleared, 7B),
// titan (a living Hive Titan, 7C), pilots (the roster, to rate stationed reserves), pass}
function stationValue(pilots,ids){const S=WAR.station;let v=0;for(const id of (ids||[]).slice(0,S.max)){const p=(pilots||[]).find(x=>x.id===id);if(!p)continue;v+=Math.min(S.each,Math.max(S.min,S.each*rating(p)/S.ref));}return Math.round(Math.min(S.pair,v)*100)/100;}
function rating(p){const C=root.ConquestCombat;let pw=100;try{if(C?.allyLoadout&&typeof powerOf==='function')pw=powerOf(C.allyLoadout(p.kit||{}));}catch(_){}return pw+4*((p.rk|0||1)-1);}
function defenseOf(w,id,ctx={}){const t=BY[id];if(!t)return {total:0,parts:[]};const parts=[];const add=(k,label,v)=>{if(v)parts.push({k,label,v:Math.round(v*100)/100});};
 add('garrison','LDF garrison',WAR.garrison[t.ring]);add('fort','Fortification '+(w.f[id]||0),w.f[id]||0);add('station','Stationed pilots',stationValue(ctx.pilots,w.st[id]));
 if(!isParasiteNeighbor(w,id))add('interior','No Parasite neighbor',WAR.interior);add('morale','Shared-war morale',num(ctx.morale));
 return {total:Math.round(parts.reduce((a,p)=>a+p.v,0)*100)/100,parts};}
function portalOpen(w,now){return !(int(w.por?.until)>now);}
function threatOf(w,ev,ctx={},go=false){const parts=[],add=(k,label,v)=>{if(v)parts.push({k,label,v:Math.round(v*100)/100});},g=GEN[ev?.g];
 add('general',(g?g.name:'Assault force')+' '+'★'.repeat(g?g.stars:1),g?g.stars:1);if(portalOpen(w,ctx.now))add('portal','Portal open ('+(BY[w.por.at]?.name||'')+')',WAR.portal.threat);
 add('titan','Hive Titan',ctx.titan?1:0);add('tiers','Citadel tiers cleared',int(ctx.tiers));if(go)add('surge','Grand Offensive surge',WAR.go.surge);
 // a stationed Lancer shoots down a dropship of an airborne assault (blueprint §5: "Lancers ... can shoot one down first, which removes its wave")
 if(ev?.air&&ev.ds){const lancers=(w.st[ev.t]||[]).map(i=>(ctx.pilots||[]).find(p=>p.id===i)).filter(p=>p&&p.r==='lancer').length;add('downed','Dropships shot down by Lancers',-Math.min(ev.ds,lancers));}
 return {total:Math.max(0,Math.round(parts.reduce((a,p)=>a+p.v,0)*100)/100),parts};}
// the Parasites' hold of a territory they took, and the LDF's strength against it (the same rule in reverse)
function holdOf(w,id,ctx={}){const t=BY[id],parts=[],add=(k,label,v)=>{if(v)parts.push({k,label,v});};add('hold','Parasite hold',WAR.hold[t?.ring||0]);if(w.por?.at===id&&portalOpen(w,ctx.now))add('portal','The portal',WAR.portal.hold);add('tiers','Citadel tiers cleared',int(ctx.tiers));
 const q=w.wk[id];if(q&&q.until>ctx.now)add('weak','Weakened by your raids',-q.n);return {total:Math.max(0,parts.reduce((a,p)=>a+p.v,0)),parts};}
function ldfOf(w,id,ctx={}){const t=BY[id],parts=[],add=(k,label,v)=>{if(v)parts.push({k,label,v:Math.round(v*100)/100});};add('ldf','LDF assault force',WAR.ldf[t?.ring||0]);add('station','Stationed pilots',stationValue(ctx.pilots,w.st[id]));add('morale','Shared-war morale',num(ctx.morale));
 return {total:Math.round(parts.reduce((a,p)=>a+p.v,0)*100)/100,parts};}
// the line the card shows first ("DEFENSE 3 vs THREAT 2. Holds 70% if you're away.")
function odds(w,ev,ctx={}){if(!ev)return null;if(ev.k==='c'){const A=ldfOf(w,ev.t,ctx),H=holdOf(w,ev.t,ctx),p=chance(A.total-H.total);return {kind:'c',a:A,h:H,p,line:'LDF '+fmt(A.total)+' vs HOLD '+fmt(H.total)+'. The LDF retakes it '+pct(p)+'% of the time without you.'};}
 const D=defenseOf(w,ev.t,ctx),Th=threatOf(w,ev,ctx,ev.go),p=chance(D.total-Th.total),heart=BY[ev.t]?.heart;
 return {kind:'a',d:D,th:Th,p,line:'DEFENSE '+fmt(D.total)+' vs THREAT '+fmt(Th.total)+'. '+(heart?'Repelled ':'Holds ')+pct(p)+'% if you\'re away.'};}
const fmt=v=>Number.isInteger(v)?String(v):v.toFixed(1).replace(/\.0$/,'');
// ---- fortification (decision 6) -------------------------------------------------------------------------------------------------
function fortifyCost(id,level,pass=false,rebuild=false){const t=BY[id],F=WAR.fortify;if(!t?.cap||level<1||level>F.max)return null;const k=Math.pow(F.mult,level-1)*F.danger[t.ring]*(pass?WAR.pass.cost:1)*(rebuild?F.rebuild:1);
 return {cp:Math.round(F.l1.cp*k),alloy:Math.round(F.l1.alloy*k),helium:Math.round(F.l1.helium*k)};}
const fortifyTime=(level,pass=false)=>Math.round(WAR.fortify.timeMs[clamp(level,1,WAR.fortify.max)-1]*(pass?WAR.pass.time:1));
const fortifySlots=pass=>pass?WAR.pass.slots:WAR.fortify.slots;
// what it takes to fortify every capturable human territory of the start (12) from 0 to 5 (decision 6's year-long pace)
function fortifyAll(pass=false){const out={cp:0,alloy:0,helium:0,ms:0,jobs:0};for(const t of TERRITORIES){if(!t.cap||t.start!=='h')continue;for(let l=1;l<=WAR.fortify.max;l++){const c=fortifyCost(t.id,l,pass);out.cp+=c.cp;out.alloy+=c.alloy;out.helium+=c.helium;out.ms+=fortifyTime(l,pass);out.jobs++;}}return out;}
// ---- supply (decision 10): +2% production per held Frontier or Warfront territory, max +16% (materials and CP only, never points) ----
function supply(w){if(!w?.o)return 0;const n=TERRITORIES.filter(t=>(t.ring===3||t.ring===4)&&w.o[t.id]==='h').length;return Math.min(WAR.supply.max,Math.round(n*WAR.supply.per*1000)/1000);}
// ---- war battle points (decision 10): par minutes x 225 x the ring's danger; a territory defense pays CQ_PTS.defense (675) ----------
function battlePoints(kind,id){const t=BY[id];if(!t)return 0;if(kind==='a')return typeof CQ_PTS!=='undefined'?CQ_PTS.defense:675;const par=kind==='go'?WAR.par.go:WAR.par.counter;return Math.round(par*WAR.ppm*WAR.danger[t.ring]);}
// the danger a war battle's spoils use (as other Conquest battles of the same danger): Frontier = HARD, Warfront = VETERAN
const dangerOf=id=>{const r=BY[id]?.ring||1;return r>=4?'VETERAN':r===3?'HARD':'STANDARD';};
// ---- the stationed reserves (decision 7) --------------------------------------------------------------------------------------------
function stationed(w){const out=new Set();for(const ids of Object.values(w?.st||{}))for(const id of ids)out.add(id);return out;}
// a reserve is a roster pilot not fielded (not in the largest force the Hangar can field); fielded: the ids the Hangar fields
function reserves(pilots,fieldedIds,w){const f=new Set(fieldedIds||[]),s=stationed(w);return (pilots||[]).filter(p=>!f.has(p.id)&&!s.has(p.id)&&p.h!==.5);}
// ---- the clock ---------------------------------------------------------------------------------------------------------------------
// The next event id (a stable, unique key: the server's rolls and the one-claim rule key on it).
const nextId=(w,kind)=>(w.n=(w.n|0)+1,kind+w.n);
function candidates(w,now,kind){const busy=new Set(w.ev.map(e=>e.t));if(w.go&&!w.go.done)for(const t of w.go.t)busy.add(t);
 if(kind==='c')return TERRITORIES.filter(t=>t.cap&&attackable(t)&&w.o[t.id]==='p'&&!busy.has(t.id)&&ADJ[t.id].some(n=>w.o[n]==='h'));
 return TERRITORIES.filter(t=>attackable(t)&&w.o[t.id]==='h'&&!busy.has(t.id)&&!(int(w.en[t.id])>now));}
function pickGeneral(w,ring,r,now){const want=ring<=1?1:ring===3?(r<.6?1:2):(r<.6?2:3);for(let s=want;s>=1;s--){const pool=GENERALS.filter(g=>g.stars===s&&!(int(w.gen[g.id]?.back)>now));if(pool.length)return pool[Math.floor(r*997)%pool.length].id;}return GENERALS[0].id;}
// schedule one Parasite assault at tick k (the target and the general from the seed; null when nothing can be attacked)
function scheduleAssault(w,k,seed,now,force){const r=x=>unit(seed+':war:'+k+':'+x);if(!force&&w.ev.filter(e=>e.k==='a').length>=WAR.maxPending)return null;
 const all=candidates(w,now,'a');if(!all.length)return null;let pool;const heart=all.filter(t=>t.heart),front=all.filter(t=>t.cap&&isParasiteNeighbor(w,t.id)),deep=all.filter(t=>t.cap&&!isParasiteNeighbor(w,t.id));
 const roll=r('kind');let air=0;
 if(heart.length&&roll<WAR.heartlandShare)pool=heart;else if(deep.length&&roll<WAR.heartlandShare+WAR.airShare*(front.length?1:2)){pool=deep;air=1;}else pool=front.length?front:deep.length?(air=1,deep):heart;
 if(!pool.length)return null;const t=pool[Math.floor(r('t')*pool.length)%pool.length];
 const ev={id:nextId(w,'a'),k:'a',t:t.id,g:pickGeneral(w,t.ring,r('g'),now),a:k,l:k+warnTicks(),air,ds:air?1+(r('ds')<.4?1:0):0};w.ev.push(ev);return ev;}
function scheduleCounter(w,k,seed,now){const r=x=>unit(seed+':war:'+k+':'+x);if(w.ev.filter(e=>e.k==='c').length>=WAR.maxPending)return null;const all=candidates(w,now,'c');if(!all.length)return null;
 const t=all[Math.floor(r('ct')*all.length)%all.length];const ev={id:nextId(w,'c'),k:'c',t:t.id,g:null,a:k,l:k+warnTicks(),air:0,ds:0};w.ev.push(ev);return ev;}
const logAt=(w,e)=>{w.log.push(e);if(w.log.length>WAR.log)w.log.splice(0,w.log.length-WAR.log);};
// the unfought net loss inside the rolling day ending at tick k (losses +1, LDF retakes by strength -1)
const netDay=(w,k)=>w.ld.filter(x=>x.k>k-WAR.dayTicks&&x.k<=k).reduce((a,x)=>a+x.d,0);
const noteNet=(w,k,d)=>{w.ld.push({k,d});w.ld=w.ld.filter(x=>x.k>k-WAR.dayTicks-2);};
// a territory changes hands (the clock or a pilot's win). Fortification is lost with it; living terraform follows; stationed pilots return.
function flip(w,id,to,k,now){w.o[id]=to;w.hs[id]=k;if(to==='p'){delete w.f[id];delete w.pk[id];delete w.en[id];w.tf[id]=-2;}else{w.tf[id]=Math.max(-1,Math.min(w.tf[id],-1));delete w.wk[id];}delete w.st[id];}
// One tick of the war (when it is not frozen): land what is due, then schedule. Returns what happened (for the Worker's side effects:
// the Frontline sector falls with its territory, trophies, alerts).
function step(w,k,seed,ctx){const now=k*WAR.tickMs,out=[];ctx={...ctx,now};let flips=0;
 // generals return; the portal reopens
 for(const [id,x] of Object.entries(w.gen))if(x.back&&x.back<=now)x.back=0;
 // 1. events landing now, oldest first
 const due=w.ev.filter(e=>e.l<=k).sort((a,b)=>a.a-b.a||a.id.localeCompare(b.id));
 for(const e of due){w.ev.splice(w.ev.indexOf(e),1);const t=BY[e.t],u=e.sc!==undefined?e.sc:unit(seed+':war:roll:'+e.id);
  if(e.k==='a'){const O=odds(w,e,ctx),held=u<O.p;const r={kind:'a',ev:e,id:e.t,p:O.p,held};
   if(t.heart){if(!held){w.tf[e.t]=Math.max(WAR.terra.min+1,w.tf[e.t]-1);logAt(w,{at:now,k:'a',t:e.t,r:'raided',by:'roll',g:e.g,p:O.p});r.r='raided';}else{logAt(w,{at:now,k:'a',t:e.t,r:'held',by:'ldf',g:e.g,p:O.p});w.cnt.held++;r.r='held';}}
   else if(held||w.o[e.t]!=='h'){const worn=w.f[e.t]>0;if(worn)w.f[e.t]--;logAt(w,{at:now,k:'a',t:e.t,r:'held',by:'ldf',g:e.g,p:O.p,...(worn?{w:1}:{})});w.cnt.held++;r.r='held';r.worn=worn;}
   else{const blocked=flips>=1?'tick':netDay(w,k)+1>WAR.dayNetLoss?'day':parasiteHeld(w)+1>WAR.ceiling?'ceiling':'';
    if(blocked){const worn=w.f[e.t]>0;if(worn)w.f[e.t]--;logAt(w,{at:now,k:'a',t:e.t,r:'held',by:'limit',g:e.g,p:O.p,...(worn?{w:1}:{})});w.cnt.held++;r.r='held';r.limit=blocked;r.worn=worn;}   // the roll said it falls, a limit held it: still decided by strength, so wear applies
    else{flip(w,e.t,'p',k,now);flips++;noteNet(w,k,1);logAt(w,{at:now,k:'a',t:e.t,r:'lost',by:'roll',g:e.g,p:O.p});w.cnt.lost++;r.r='lost';}}
   delete w.st[e.t];out.push(r);}
  else{const O=odds(w,e,ctx),ok=u<O.p,r={kind:'c',ev:e,id:e.t,p:O.p,ok};
   if(w.o[e.t]!=='p'){r.r='moot';}
   else if(ok&&flips<1){flip(w,e.t,'h',k,now);flips++;noteNet(w,k,-1);logAt(w,{at:now,k:'c',t:e.t,r:'retaken',by:'ldf',p:O.p});w.cnt.taken++;r.r='retaken';}
   else{logAt(w,{at:now,k:'c',t:e.t,r:ok?'stalled':'failed',by:ok?'limit':'roll',p:O.p});r.r='failed';}
   delete w.st[e.t];out.push(r);}}
 // 2. the Grand Offensive's window ends: if it was not won in person, it launches; each target decided by strength with its extra THREAT
 if(w.go&&!w.go.done&&w.go.end<=k){const g=w.go;g.done=1;if(!g.won){const res=[];for(const id of g.t){if(w.o[id]!=='h'){res.push({id,r:'moot'});continue;}const e={id:'go'+g.w+':'+id,k:'a',t:id,g:g.g,air:1,ds:1,go:1},O=odds(w,e,ctx),u=unit(seed+':war:go:'+g.w+':'+id),held=u<O.p;
   if(held){const worn=w.f[id]>0;if(worn)w.f[id]--;logAt(w,{at:now,k:'g',t:id,r:'held',by:'ldf',g:g.g,p:O.p,...(worn?{w:1}:{})});w.cnt.held++;res.push({id,r:'held',worn});}
   else{const blocked=netDay(w,k)+1>WAR.dayNetLoss?'day':parasiteHeld(w)+1>WAR.ceiling?'ceiling':'';if(blocked){const worn=w.f[id]>0;if(worn)w.f[id]--;logAt(w,{at:now,k:'g',t:id,r:'held',by:'limit',g:g.g,p:O.p,...(worn?{w:1}:{})});w.cnt.held++;res.push({id,r:'held',limit:blocked,worn});}
    else{flip(w,id,'p',k,now);noteNet(w,k,1);logAt(w,{at:now,k:'g',t:id,r:'lost',by:'roll',g:g.g,p:O.p});w.cnt.lost++;res.push({id,r:'lost'});}}
   delete w.st[id];}out.push({kind:'go',res});}}
 // 3. schedule: the script for a new pilot's first days, then the war's own rolls
 const sc=scriptStep(w,k,seed,ctx);if(sc.length)out.push(...sc);
 if(scriptDone(w)){const r=x=>unit(seed+':war:'+k+':'+x);if(r('a')<WAR.assaultChance){const e=scheduleAssault(w,k,seed,now);if(e)out.push({kind:'announce',ev:e});}
  if(r('c')<WAR.counterChance){const e=scheduleCounter(w,k,seed,now);if(e)out.push({kind:'announce',ev:e});}
  const g=goStep(w,k,seed,now);if(g)out.push(g);}
 // 4. living terraform: a held territory grows a step every 2 days up to its ring's cap
 for(const t of TERRITORIES)if(w.o[t.id]==='h'){const cap=WAR.terra.cap[t.ring];if(w.tf[t.id]<cap&&(k-(w.hs[t.id]|0))>0&&(k-(w.hs[t.id]|0))%WAR.terra.growTicks===0)w.tf[t.id]++;}
 return out;}
// the weekly Grand Offensive: announced at Friday 00:00 UTC, open Saturday 00:00 to Monday 00:00 UTC (the targets chosen at the announcement)
function goWeek(k){const now=k*WAR.tickMs,day=Math.floor(now/DAY),dow=(day+4)%7;return {day,dow,hour:Math.floor(now%DAY/HOUR)};}
function goStep(w,k,seed,now){const {day,dow,hour}=goWeek(k);if(dow!==WAR.go.announceDow||hour!==0)return null;if(w.go&&!w.go.done)return null;if((now-w.t0)/DAY<WAR.go.fromDay)return null;
 const pool=candidates(w,now,'a').filter(t=>t.cap);if(!pool.length)return null;const r=x=>unit(seed+':war:go:'+day+':'+x);
 const front=pool.filter(t=>isParasiteNeighbor(w,t.id)),deep=pool.filter(t=>!isParasiteNeighbor(w,t.id)),order=[...front,...deep].sort((a,b)=>(isParasiteNeighbor(w,b.id)-isParasiteNeighbor(w,a.id))||(u32(seed+':go:'+day+':'+a.id)-u32(seed+':go:'+day+':'+b.id)));
 const t=order.slice(0,WAR.go.targets).map(x=>x.id),g=['malgrath','quorr','ixa'][Math.floor(r('g')*3)%3],open=k+Math.round(WAR.go.openMs/WAR.tickMs),end=open+Math.round(WAR.go.windowMs/WAR.tickMs);
 w.go={w:day,a:k,open,end,g,t};logAt(w,{at:now,k:'g',t:t[0],r:'announced',by:'hive',g,n:t.length});return {kind:'go-announce',go:w.go};}
// ---- the scripted first war (decision 13) -------------------------------------------------------------------------------------------
const scriptDone=w=>!!w.sc?.done;
function scriptStep(w,k,seed,ctx){const S=SCRIPT,sc=w.sc,now=k*WAR.tickMs,out=[];if(sc.done)return out;const age=now-w.t0;
 const ann=(t,g,kind,o={})=>{const e={id:nextId(w,kind),k:kind,t,g:kind==='a'?g:null,a:k,l:k+warnTicks(),air:o.air?1:0,ds:o.air?1:0,...(o.sc!==undefined?{sc:o.sc}:{})};w.ev.push(e);out.push({kind:'announce',ev:e,script:sc.n});return e;};
 // S1 (the first tick at least 6 h after the war began): an assault the LDF holds while you are away (an authored roll: it holds)
 if(sc.n===0&&age>=S.quietMs){if(w.o[S.s1]==='h'){ann(S.s1,S.s1Gen,'a',{sc:0});}sc.n=1;return out;}
 // S2 waits for the pilot's return on day 2: scriptReturn() announces it then (it is fought or decided by strength)
 // F1: once S2 is decided (and at least one tick later), the First Offensive's dropship: it lands unless beaten in person (authored roll)
 if(sc.n===2&&!w.ev.some(e=>e.k==='a')){if(w.o[S.f1]==='h'){ann(S.f1,S.f1Gen,'a',{air:1,sc:.999});sc.f1=S.f1;}sc.n=3;return out;}
 // C1: the LDF's counterattack on the foothold (or on Ash Redoubt when the landing was beaten)
 if(sc.n===3&&!w.ev.some(e=>e.k==='a')){const t=w.o[S.f1]==='p'?S.f1:'ash';if(w.o[t]==='p')ann(t,null,'c');sc.n=4;return out;}
 // done when C1 is decided (Fortify is introduced on the War Map from here), or by day 5 whatever happened
 if(sc.n===4&&!w.ev.length||age>=S.endDay*DAY){sc.done=1;sc.fort=1;}
 return out;}
// The pilot came back (a session open, after advance()): on day 2 or later S2 is announced at the current tick, so the first War
// Report shows it inbound (it lands two ticks after that tick: 6-12 hours from now) and the pilot can defend it.
function scriptReturn(w,now){const sc=w.sc,S=SCRIPT;if(sc.done||sc.n!==1||sc.ret||now-w.t0<S.returnMs)return null;sc.ret=now;sc.n=2;const k=tickOf(now);
 if(w.o[S.s2]!=='h'||w.ev.some(e=>e.t===S.s2))return null;const e={id:nextId(w,'a'),k:'a',t:S.s2,g:S.s2Gen,a:k,l:k+warnTicks(),air:0,ds:0};w.ev.push(e);return {kind:'announce',ev:e,script:1,k};}
// ---- advance the war to now (the Worker on every request; the drift simulation; never the phone) ------------------------------------
// ctx: {pilots, morale, tiers, titan}. seed: the pilot's server-only seed. seen: the pilot's last request before this one (the
// Worker's s.lastWall: kept out of the war record so an ordinary request never rewrites it). Returns every tick's outcomes.
function advance(w,now,seed,ctx={},seen=now){const K=tickOf(now),out=[];if(!(K>w.k))return out;let frozen=0;
 for(let k=w.k+1;k<=K;k++){const at=k*WAR.tickMs;if(at-seen>=WAR.freezeMs){frozen++;if(w.go&&!w.go.done&&w.go.end<=k){w.go.done=1;w.go.skip=1;}continue;}out.push(...step(w,k,seed,ctx).map(x=>({...x,k})));}   // the Grand Offensive keeps the weekend calendar: its window ending while the front is frozen skips it
 w.k=K;if(frozen){for(const e of w.ev){e.a+=frozen;e.l+=frozen;}   // the front held: nothing landed; what was announced keeps its time left
  logAt(w,{at:now,k:'f',t:'',r:'frozen',by:'hold',n:frozen});out.push({kind:'frozen',n:frozen});}
 return out;}
// ---- in person (decision 3) -----------------------------------------------------------------------------------------------------------
// The pilot can fight an event once, any time until it lands: assaults (defend), counterattacks (join the LDF), the Grand Offensive.
const pending=(w,id)=>w.ev.find(e=>e.id===id)||null;
function joinable(w,now){const out=[];for(const e of w.ev)if(!e.tr&&e.l*WAR.tickMs>now)out.push(e);const g=w.go;if(g&&!g.done&&!g.tr&&g.open*WAR.tickMs<=now&&g.end*WAR.tickMs>now)out.push({id:'go'+g.w,k:'g',t:g.t[0],l:g.end,g:g.g,go:1});return out;}
// a win: the assault is beaten (the territory holds, entrenches 24 h, keeps its fortification); a counterattack retakes the territory
// (entrenched); the Grand Offensive is beaten (every target holds and entrenches). A loss changes nothing now: at landing the strength
// roll decides and wear applies, as if you hadn't come. Returns what changed.
// begin(): the battle starts (the one attempt is spent at once, so a retreat or a reload can never buy a second try)
function begin(w,eventId,attempt,now){if(/^go\d+$/.test(eventId)){const g=w.go;if(!g||g.done||g.tr||'go'+g.w!==eventId||!(g.open*WAR.tickMs<=now&&g.end*WAR.tickMs>now))return null;g.tr=attempt||1;return {kind:'go',go:g};}
 const e=pending(w,eventId);if(!e||e.tr||!(e.l*WAR.tickMs>now))return null;e.tr=attempt||1;return {kind:e.k,ev:e};}
function settle(w,eventId,won,now,attempt){const k=tickOf(now);
 if(/^go\d+$/.test(eventId)){const g=w.go;if(!g||g.done||'go'+g.w!==eventId||g.tr&&attempt&&g.tr!==attempt)return null;g.tr=attempt||g.tr||1;if(!won)return {kind:'go',won:false};g.won=1;g.done=1;for(const id of g.t)if(w.o[id]==='h'){w.en[id]=now+WAR.entrenchMs;delete w.st[id];}logAt(w,{at:now,k:'g',t:g.t[0],r:'beaten',by:'you',g:g.g,n:g.t.length});w.cnt.won++;return {kind:'go',won:true,targets:g.t.slice(),general:g.g};}
 const e=pending(w,eventId);if(!e||e.tr&&attempt&&e.tr!==attempt||e.tr&&!attempt)return null;e.tr=attempt||e.tr||1;if(!won)return {kind:e.k,won:false,ev:e};
 w.ev.splice(w.ev.indexOf(e),1);delete w.st[e.t];w.cnt.won++;
 if(e.k==='a'){if(w.o[e.t]==='h'&&BY[e.t].cap)w.en[e.t]=now+WAR.entrenchMs;logAt(w,{at:now,k:'a',t:e.t,r:'defended',by:'you',...(e.g?{g:e.g}:{})});return {kind:'a',won:true,ev:e,general:e.g};}
 if(w.o[e.t]==='p'){flip(w,e.t,'h',k,now);w.en[e.t]=now+WAR.entrenchMs;}logAt(w,{at:now,k:'c',t:e.t,r:'retaken',by:'you'});return {kind:'c',won:true,ev:e};}
// a general beaten in person: a permanent trophy (accomplishments are permanent) and a retreat; five-star generals never leave the Inner Ring
function beatGeneral(w,id,now){const g=GEN[id];if(!g)return false;const x=w.gen[id]||(w.gen[id]={back:0,beat:0});x.beat++;x.back=now+WAR.retreatMs;const first=!w.tro[id];if(first)w.tro[id]=now;return first;}
// a raid won in a Parasite-held territory weakens its hold (and suppresses the portal there); a raid in the portal's territory shuts it
function raidWon(w,id,now){const out={};if(!BY[id]||w.o[id]!=='p')return out;const q=w.wk[id]&&w.wk[id].until>now?w.wk[id]:{n:0,until:0};q.n=Math.min(WAR.weaken.max,q.n+WAR.weaken.per);q.until=now+WAR.weaken.ms;w.wk[id]=q;out.weak=q.n;
 if(w.por.at===id&&portalOpen(w,now)){w.por.until=now+WAR.portal.suppressMs;w.por.n++;out.portal=1;if(w.por.n>=WAR.portal.relocateAfter){w.por.n=0;w.por.moves++;const opts=TERRITORIES.filter(t=>w.o[t.id]==='p'&&t.id!==id&&t.ex).map(t=>t.id);w.por.at=opts.length?opts[w.por.moves%opts.length]:'east';out.moved=w.por.at;}}
 return out;}
// ---- what the War Map and the alerts read ----------------------------------------------------------------------------------------------
// The most urgent fight the pilot can still join (the NEXT ORDER): the soonest to land, assaults before counterattacks.
function nextOrder(w,now){const j=joinable(w,now).sort((a,b)=>a.l-b.l||(a.k==='a'?-1:1));return j[0]||null;}
// the War Report: outcomes since the pilot last read it, and what is inbound
function report(w,now){const since=int(w.rep),items=w.log.filter(x=>x.at>since&&x.r!=='announced'),inbound=joinable(w,now);return {since,items,inbound,next:nextOrder(w,now),go:w.go&&!w.go.done?w.go:null,fresh:items.length>0};}
// ---- alerts (decision 12): at most 3 a day, none in the pilot's local night, several events in one alert, only fights the pilot can
// still join plus the Grand Offensive announcement. events: [{id, at (announced, ms), until (lands, ms), kind, t}]; tz: the pilot's
// UTC offset in minutes (east positive). Returns the sends [{at, ids}] in order (a pure plan: the Worker's cron sends them).
const ALERT=Object.freeze({perDay:3,nightFrom:22,nightTo:8,lead:HOUR,minGap:2*HOUR});
const localHour=(ms,tz)=>((Math.floor((ms+tz*60000)/HOUR)%24)+24)%24;
const localDay=(ms,tz)=>Math.floor((ms+tz*60000)/DAY);
const night=(ms,tz)=>{const h=localHour(ms,tz);return ALERT.nightFrom>ALERT.nightTo?h>=ALERT.nightFrom||h<ALERT.nightTo:h>=ALERT.nightFrom&&h<ALERT.nightTo;};
function morning(ms,tz){const loc=ms+tz*60000,d=Math.floor(loc/DAY);let m=d*DAY+ALERT.nightTo*HOUR;if(m<=loc)m+=DAY;return m-tz*60000;}   // the next local 08:00
function alertPlan(events,from,tz=0,sentToday={day:null,n:0,last:0}){const ev=(events||[]).filter(e=>e&&e.until-ALERT.lead>Math.max(from,e.at)).map(e=>({...e,t0:Math.max(from,e.at)})).sort((a,b)=>a.t0-b.t0);
 const sends=[],done=new Set();let day=sentToday.day??null,n=sentToday.n|0,last=Number(sentToday.last)||-Infinity;
 for(let guard=0;guard<64;guard++){const open=ev.filter(e=>!done.has(e.id));if(!open.length)break;let t=Math.max(open[0].t0,last+ALERT.minGap);
  if(night(t,tz))t=morning(t,tz);if(localDay(t,tz)!==day){day=localDay(t,tz);n=0;}
  if(n>=ALERT.perDay){t=morning(t+1,tz);if(localDay(t,tz)!==day){day=localDay(t,tz);n=0;}}
  const ids=open.filter(e=>e.t0<=t&&e.until-ALERT.lead>t).map(e=>e.id);for(const e of open)if(e.until-ALERT.lead<=t)done.add(e.id);   // too late to join: never sent
  if(!ids.length)continue;sends.push({at:t,ids});ids.forEach(id=>done.add(id));n++;last=t;}
 return sends;}
// the joinable fights and the Grand Offensive announcement as alert events (from the war record)
function alertEvents(w){const out=[];for(const e of w.ev)if(!e.tr)out.push({id:e.id,kind:e.k,t:e.t,at:e.a*WAR.tickMs,until:e.l*WAR.tickMs});const g=w.go;if(g&&!g.done&&!g.tr)out.push({id:'go'+g.w,kind:'g',t:g.t[0],n:g.t.length,at:g.a*WAR.tickMs,until:g.end*WAR.tickMs});return out;}
function alertText(evs,at){const name=id=>BY[id]?.name||id,ago=e=>{const h=Math.max(1,Math.round((e.until-at)/HOUR));return h+' h';};const lines=evs.map(e=>e.kind==='a'?(BY[e.t]?.heart?'Parasites raiding ':'Assault on ')+name(e.t)+' lands in '+ago(e):e.kind==='c'?'LDF counterattack on '+name(e.t)+' · join it, '+ago(e)+' left':'GRAND OFFENSIVE · '+(e.n||3)+' territories · start it this weekend');
 return {title:evs.length>1?'LUNAR · '+evs.length+' WAR ALERTS':evs[0]?.kind==='g'?'LUNAR · GRAND OFFENSIVE':'LUNAR · WAR ALERT',body:lines.join('\n')};}
// ---- Session 7-V hooks (visuals only; the logic is complete without them) ------------------------------------------------------------
const HOOKS=Object.freeze({newGround:Object.freeze(TERRITORIES.filter(t=>!t.ex).map(t=>t.id)),dropships:'ConquestWar.dropships(war, now)',portal:'ConquestWar.portalOf(war, now)',ldfPosts:'ConquestWar.ldfPosts(war)',livingTerraform:'ConquestWar.terraOf(war, id)'});
// dropships in flight: every pending airborne assault flies from the portal's territory to its target (7-V draws the route and the landing)
function dropships(w,now){const from=BY[w.por?.at]||BY.east;return w.ev.filter(e=>e.k==='a'&&e.air).map(e=>{const to=BY[e.t],a=e.a*WAR.tickMs,l=e.l*WAR.tickMs;return {id:e.id,from:{x:from.x,z:from.z},to:{x:to.x,z:to.z},ships:e.ds,at:a,lands:l,progress:clamp((now-a)/Math.max(1,l-a),0,1)};});}
function portalOf(w,now){const t=BY[w.por?.at]||BY.ash;return {at:t.id,name:t.name,x:t.x,z:t.z,open:portalOpen(w,now),until:int(w.por?.until),suppressions:int(w.por?.n),relocateAfter:WAR.portal.relocateAfter};}
function ldfPosts(w){return TERRITORIES.filter(t=>!t.inner&&w.o[t.id]==='h').map(t=>({id:t.id,x:t.x,z:t.z,ring:t.ring,garrison:WAR.garrison[t.ring],fort:w.f[t.id]||0,stationed:(w.st[t.id]||[]).length}));}
const TERRA_NAMES=Object.freeze({'-2':'OVERRUN','-1':'BLIGHTED','0':'BARREN','1':'PYLON LIT','2':'LICHEN','3':'GREEN'});
function terraOf(w,id){const v=clamp(num(w?.tf?.[id]),-2,3);return {level:v,name:TERRA_NAMES[String(v)],blight:v<0?-v:0,green:Math.max(0,v)};}
root.ConquestWar=Object.freeze({WAR,TERRITORIES,BY,IDS,ADJ,RINGS,APPROACH,GENERALS,GEN,SCRIPT,ALERT,HOOKS,attackable,chance,fresh,norm,humanHeld,parasiteHeld,frontline,
 defenseOf,threatOf,holdOf,ldfOf,odds,portalOpen,fortifyCost,fortifyTime,fortifySlots,fortifyAll,supply,battlePoints,dangerOf,stationValue,rating,stationed,reserves,
 tickOf,warnTicks,step,advance,scriptReturn,scriptDone,goWeek,pending,joinable,begin,settle,beatGeneral,raidWon,nextOrder,report,alertPlan,alertEvents,alertText,
 localHour,localDay,night,morning,dropships,portalOf,ldfPosts,terraOf,u32,unit,flip,netDay,isParasiteNeighbor});
})(globalThis);
