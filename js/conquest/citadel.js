/* Session 7B Citadel Act I (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md; blueprint §6; record: Checkpoint 49).
   The Citadel's shared rules and its assault, shared by the phone (prediction, the Citadel card, the HUD) and the Worker
   (worker/build-sim.mjs packs this file into the CONQUEST bundle as Citadel; worker/src/conquest-citadel.js owns every change and
   every payout). Nothing here pays anything: the Worker settles the assault it ran itself from the pilot's verified commands.
   - Fixed stats: a higher tier means new units, layouts and tactics, never bigger numbers. Every unit keeps its archetype's stats
     (js/conquest/combat.js archetypes) in every tier; the three wardens share one authored hull and shield core.
   - Act I, The Outer Works: one fortress layout (a rampart with one gate, a courtyard, the warden's dais), re-fortified per tier:
     I Breach Point (gate generators hold the shield gate; Swarm), II Iron Rain (Spore Mortars shell marked zones; forward cover),
     III The Carrier Deck (dropships land mid-fight unless shot down).
   - The assault: BREACH (the outer guns, the rampart, the gate), PUSH (garrison waves and the tier's hazard), THE GENERAL (a 3-star
     warden on the ambush, artillery or carrier commander's doctrine, with clear tells; only your tank breaks its shield core).
   - Hooks for the Fable Citadel session after 5E-2d2 (stand-in looks now): HOOKS below names every look (js/conquest/citadelview.js
     draws the stand-ins; the dropship's look plugs into 5E-2d2's js/conquest/dropship.js when it is loaded). */
(function(root){
'use strict';
const HOUR=3600000,DAY=24*HOUR,WEEK=7*DAY,MONDAY0=4*DAY;   // weeks start Monday 00:00 UTC (worker/src/db.js weekOf)
const CC=root.ConquestCombat,W=()=>root.ConquestWorld,WR=()=>root.ConquestWar;
const int=v=>Math.max(0,Math.floor(Number(v)||0)),num=v=>Number.isFinite(Number(v))?Number(v):0,record=v=>v&&typeof v==='object'&&!Array.isArray(v),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ROMAN=Object.freeze(['','I','II','III','IV','V','VI','VII','VIII','IX']);
// ---- settings (owner decisions in the brief; the lead's design numbers are named as such) ---------------------------------------
const CIT=Object.freeze({
 v:1,
 live:3,                                      // tiers built: Act I. Tiers IV-IX arrive with Session 11 on this framework
 // first-clear airdrop bounties, base points, once per account, outside the 50,000 daily cap (owner, Nov 23: the blueprint's table x5;
 // IV-IX recorded for Session 11 in the blueprint and docs/economy/RESOURCE_ECONOMY.md)
 bounty:CIT_BOUNTY,                           // js/rules.js (the account side credits by the same table)
 prod:.05,                                    // production +5% a tier cleared (materials and CP only; Daily Base Yield points unchanged)
 limitS:480,                                  // the siege window (lead's design): 8 minutes from the launch; the full Battalion breaks a tier in 6-8
 par:7,                                       // the assault's par minutes (lead's design: the brief's 6-8 minutes with the full Battalion)
 ring:5,                                      // the Inner Ring: the ring's danger in the battle points formula (war.js WAR.danger)
 prepMs:48*HOUR,                              // each siege prep objective stays valid 48 hours
 refortMs:7*DAY,                              // lead's design (measured pacing): after a tier's first clear the Hive re-fortifies the next one for 7 days
 // lead's design numbers (fixed for every tier): the warden's hull and shield core (re-formed twice), the gate and its generators
 warden:Object.freeze({hp:18500,core:2800,reform:Object.freeze([2/3,1/3]),tellS:2.5,enrage:.4}),
 gate:Object.freeze({hp:15000}),gen:Object.freeze({hp:6000}),mortar:Object.freeze({hp:600,everyS:9,tellS:2.4,r:8,zoneR:14,dmg:80}),
 ship:Object.freeze({hp:700,flyS:14,unloadS:6,everyS:30,minS:10,firstS:4}),strike:Object.freeze({tellS:2,r:11,dmg:650,ahead:40}),
 cover:Object.freeze({r:7}),drop:Object.freeze({tellS:3,r:7,dmg:40}),portal:Object.freeze({atS:Object.freeze([50,20])}),
 waveS:40, waveMin:8,                                    // PUSH: a reinforcement wave lands every 35 s after the gate falls (the pressure ramps; the phase stays near 2:15)
 wardenS:45, escortS:30, escortCap:4,                                  // ...and the warden comes out at most 45 s after the last wave (or when the courtyard is down to two)
 // cutscenes (owner, Nov 23): always skippable; full length on a tier's first attempt, shorter after
 cut:Object.freeze({fullMs:18000,shortMs:5000})
});
// ---- the wardens (blueprint §6: 3 stars in Act I, reusing the ambush, artillery and carrier commanders' doctrines). Lead's choice:
// the Citadel's own wardens, never in the war's general pool (war.js GENERALS keeps its picks, its seeded streams and the town's
// attackers unchanged); a warden falls with its tier, so there is no retreat-and-return
const WARDENS=Object.freeze({
 1:Object.freeze({id:'skorva',name:'GATEWARDEN SKORVA',stars:3,pattern:'ambush',tell:'goes still, then flanks you with an aimed salvo'}),
 2:Object.freeze({id:'vorn',name:'SPOREMASTER VORN',stars:3,pattern:'artillery',tell:'marks the ground under you, then the shells land'}),
 3:Object.freeze({id:'thraxa',name:'DECK-ADMIRAL THRAXA',stars:3,pattern:'carrier',tell:'launches attack drones from the deck'})});
// ---- the tiers (blueprint §6 table; Act I). swarm: vents' cadence (s), size and the cap of living swarmlings; mortars / cover /
// zones: Iron Rain's pieces; ships: dropships in the PUSH (each carries one wave); waves: PUSH reinforcement waves by drop
const W1=Object.freeze(['sentinel','sentinel','raider','raider','breacher','command']),RW=Object.freeze(['raider','raider','breacher','sentinel']);
const T=o=>Object.freeze(o);
const TIERS=Object.freeze([null,
 T({n:1,name:'BREACH POINT',act:1,mech:'Destroy the gate generators to drop the shield gate',unit:'swarm',unitName:'SWARM',role:'frostline',warden:WARDENS[1],
  gate:'shield',gens:3,guns:4,swarm:T({every:14,n:4,cap:10}),mortars:0,cover:0,zones:0,ships:0,waves:8,rw:Object.freeze(['raider','raider','breacher','sentinel','raider','breacher']),
  brief:'Three gate generators hold the shield gate. Bring them down, push the courtyard while the Swarm pours from the vents, then break the warden.'}),
 T({n:2,name:'IRON RAIN',act:1,mech:'Marked bombardment zones. Take forward cover',unit:'mortar',unitName:'SPORE MORTAR',role:'lancer',warden:WARDENS[2],
  gate:'hard',gens:0,guns:4,swarm:T({every:24,n:3,cap:6}),mortars:3,cover:5,zones:3,ships:0,waves:15,rw:Object.freeze(['raider','sentinel','breacher','raider','sentinel','command']),
  brief:'Spore Mortars shell every marked zone. Move between the bunkers, break the gate, silence the mortars and break the warden.'}),
 T({n:3,name:'THE CARRIER DECK',act:1,mech:'Dropships land mid-fight unless shot down',unit:'dropship',unitName:'DROPSHIP',role:'lancer',warden:WARDENS[3],
  gate:'hard',gens:0,guns:4,swarm:T({every:24,n:3,cap:6}),mortars:2,cover:2,zones:0,ships:16,waves:0,rw:Object.freeze(['raider','sentinel','breacher','raider','sentinel','command']),
  brief:'Break the gate, then shoot the dropships down before they land: every one that lands unloads a wave. Then break the warden.'})]);
// recommended FORCE (js/conquest/battalion.js force) and DEFENSE (the town rating) bands: advice shown beside your ratings, never a
// lock. Lead's numbers from the pacing model (dev/tools/citadel-model.mjs): the regular's ratings at the tier's target day
const BANDS=Object.freeze([null,T({force:[780,980],defense:[8500,11100]}),T({force:[950,1190],defense:[11400,14800]}),T({force:[980,1230],defense:[11500,15000]})]);   // measured (dev/tools/citadel-model.mjs kits, fortress-model towns): the low end is FORCE / DEFENSE on the day each profile first breaks the tier, the high end 1.25x / 1.3x
// ---- siege prep (blueprint §6): three optional objectives, each a mission type that exists today, each valid 48 h, each removing one
// authored piece of the fortress. aa: an ANTI-AIR BATTERY KNOCKOUT raid won (one LDF airstrike in the assault); cv: an ARMORED
// INTERCEPTION raid won (the convoy: one fewer reinforcement wave); po: the portal suppressed (war.js: a raid won in the portal's
// territory shuts it 48 h: no portal reinforcements mid-fight)
const PREP=Object.freeze({
 aa:T({name:'KNOCK OUT THE ANTI-AIR BATTERIES',family:'battery',gives:'One LDF airstrike in the assault',short:'AIRSTRIKE'}),
 cv:T({name:'CUT THE SUPPLY CONVOY',family:'intercept',gives:'One fewer reinforcement wave',short:'ONE WAVE LESS'}),
 po:T({name:'SUPPRESS THE PORTAL',family:null,gives:'No portal reinforcements mid-fight',short:'NO PORTAL'})});
// ---- Throne Run (blueprint §6 "After the Sovereign"): replay a cleared tier weekly with rotating Commander's Gambit modifiers, the
// same pair for every pilot in a UTC week (Monday 00:00); one full reward chest per tier per week, then the reduced chest; a
// clear-time board. Lead's design: each week pairs a bane with a boon (rule changes, never bigger numbers)
const GAMBITS=Object.freeze({
 noshield:T({name:'NO SHIELDS',bane:1,what:'Your Shield ability is offline'}),
 double:T({name:'DOUBLE REINFORCEMENTS',bane:1,what:'One more reinforcement wave (or dropship)'}),
 enraged:T({name:'ENRAGED WARDEN',bane:1,what:'The warden is enraged from the start: faster tells'}),
 tide:T({name:'SWARM TIDE',bane:1,what:'The Swarm vents open twice as often'}),
 barrage:T({name:'OPEN BARRAGE',bane:1,what:'A marked strike falls on you every 12 seconds'}),
 portalstorm:T({name:'PORTAL STORM',bane:1,what:'Portal reinforcements arrive even with the portal suppressed'}),
 airwing:T({name:'LDF AIR WING',bane:0,what:'One more LDF airstrike'}),
 overdrive:T({name:'OVERDRIVE',bane:0,what:'Your Dash recharges twice as fast'})});
const GAMBIT_WEEKS=Object.freeze([['double','airwing'],['noshield','overdrive'],['tide','airwing'],['enraged','overdrive'],['barrage','airwing'],['portalstorm','overdrive']].map(Object.freeze));
const weekOf=now=>Math.floor((num(now)-MONDAY0)/WEEK);
const gambitsOf=week=>GAMBIT_WEEKS[((int(week)%GAMBIT_WEEKS.length)+GAMBIT_WEEKS.length)%GAMBIT_WEEKS.length];
// ---- the fortress (Act I, The Outer Works): a local frame centred on the operation (u east toward the dais, v south), metres ----
const OP=t=>CC.operations['citadel-'+t];
const centre=()=>{const o=OP(1);return {x:o.x,z:o.z};};
const at=(u,v)=>{const c=centre();return {x:c.x+u,z:c.z+v};};
const LAYOUT=Object.freeze({
 wallR:2.6,gate:T({u:-30,v0:-9,v1:9}),
 walls:Object.freeze([[-30,-60,-30,-9],[-30,9,-30,60],[-30,-60,70,-60],[-30,60,70,60],[70,-60,70,60]].map(Object.freeze)),
 stage:T({u:-130,v:0}),                         // the siege camp: where the assault starts (beyond the rampart guns' 96 m)
 gens:Object.freeze([[-46,-42],[-46,42],[-38,-17]].map(Object.freeze)),
 guns:Object.freeze([[-27,-50],[-27,-26],[-27,26],[-27,50]].map(Object.freeze)),
 gateAt:T({u:-31,v:0}),
 ventsOut:Object.freeze([[-66,-48],[-66,48]].map(Object.freeze)),ventsIn:Object.freeze([[8,-44],[8,44]].map(Object.freeze)),
 mortars:Object.freeze([[6,-30],[10,0],[6,30]].map(Object.freeze)),
 cover:Object.freeze([[-74,-22],[-74,22],[-52,-6],[-52,30],[14,-16]].map(Object.freeze)),
 zones:Object.freeze([[-84,0],[-60,-34],[-60,34]].map(Object.freeze)),
 garrison:Object.freeze([[30,-18],[34,0],[30,18],[44,-8],[44,8]].map(Object.freeze)),
 drops:Object.freeze([[24,-34],[24,34],[40,0]].map(Object.freeze)),
 pads:Object.freeze([[24,-32],[24,32],[42,-14],[42,14]].map(Object.freeze)),
 portalAt:T({u:48,v:-40}),throne:T({u:58,v:0})});
// every look the Fable Citadel session replaces, by name (js/conquest/citadelview.js draws today's stand-ins)
const HOOKS=Object.freeze({
 fortress:'the Outer Works: the rampart, the gate, the courtyard and the dais (LAYOUT, world metres: op centre + (u, v))',
 shieldGate:'the shield gate across the gap while a generator stands (tier I)',gate:'the hard gate (tiers II-III)',
 generator:'a gate generator (cit "gen")',gun:'an outer gun on the rampart (cit "gun")',vent:'a Swarm vent',
 swarm:'the Swarm (archetype swarm)',mortar:'the Spore Mortar (archetype mortar) and its shells (B.cit.shells)',
 cover:'a forward cover bunker (B.cit.cover)',zone:'a marked bombardment zone (B.cit.zones)',
 dropship:'the dropship (archetype dropship; e.ship): plugs into ConquestDropship.flight / stage (5E-2d2) when it is loaded',
 warden:'the warden (e.warden) and its shield core (e.core / e.coreMax)',airstrike:'the LDF airstrike (B.cit.strikes)',
 portal:'the portal surge (B.cit.portalAt)',reveal:'each tier\'s reveal cutscene (js/conquest/cutscene.js SCRIPTS)'});
// ---- the pilot's Citadel record (s.cit): t tiers cleared, fc first clears {tier: ms}, tro trophies {tier: ms}, prep {aa|cv: {at,
// until}}, pu the portal suppression already used (its until), tr {w week, ch {tier: week of the full chest}}, best {tier: {ms, w}}
// best clear times, wk {tier: {ms, w}} this week's best, cs {tier: cutscenes seen}, n attempts, won, lost, lb the latest clear for the
// board ({w, t, ms, at}) -----------------------------------------------------------------------------------------------------------
function fresh(){return {v:1,t:0,fc:{},tro:{},prep:{},pu:0,tr:{w:-1,ch:{}},best:{},wk:{},cs:{},n:0,won:0,lost:0};}
const tierMap=(o,f)=>{const out={};if(record(o))for(const [k,v] of Object.entries(o)){const t=int(k);if(t>=1&&t<=9){const x=f(v);if(x!==undefined)out[t]=x;}}return out;};
function norm(c){if(!record(c)||c.v!==1)return fresh();
 const prep={};for(const k of ['aa','cv'])if(record(c.prep?.[k])&&int(c.prep[k].until)>0)prep[k]={at:int(c.prep[k].at),until:int(c.prep[k].until)};
 const time=v=>record(v)&&int(v.ms)>0?{ms:int(v.ms),w:Math.floor(num(v.w))}:undefined;
 return {v:1,t:clamp(int(c.t),0,9),fc:tierMap(c.fc,v=>int(v)||undefined),tro:tierMap(c.tro,v=>int(v)||undefined),prep,pu:int(c.pu),
  tr:{w:Number.isSafeInteger(Number(c.tr?.w))?Number(c.tr.w):-1,ch:tierMap(c.tr?.ch,v=>Number.isSafeInteger(Number(v))?Number(v):undefined)},
  best:tierMap(c.best,time),wk:tierMap(c.wk,time),cs:tierMap(c.cs,v=>int(v)||undefined),n:int(c.n),won:int(c.won),lost:int(c.lost),
  ...(record(c.lb)&&int(c.lb.ms)>0?{lb:{w:Math.floor(num(c.lb.w)),t:clamp(int(c.lb.t),1,9),ms:int(c.lb.ms),at:int(c.lb.at)}}:{})};}
const tiersOf=s=>clamp(int(s?.cit?.v===1?s.cit.t:0),0,9);   // the Citadel tiers cleared: the Retaliation level (war.js threatOf ctx.tiers)
const isCitadel=id=>/^citadel-[1-9]$/.test(String(id||''));
const tierOfId=id=>isCitadel(id)?int(String(id).slice(8)):0;
// the next tier to break (null when every built tier is cleared: Act II arrives with Session 11)
const nextTier=c=>{const t=norm(c).t+1;return t<=CIT.live?TIERS[t]:null;};
// FRONT readiness (blueprint §6): both approach territories (war.js APPROACH: Ash Redoubt, Oxygen Spear) human-held
const frontHeld=w=>!!w?.o&&WR().APPROACH.every(id=>w.o[id]==='h');
// the siege prep active now (what the next assault would use)
function prepOf(s,now){const c=norm(s?.cit),w=s?.war,live=k=>!!c.prep[k]&&c.prep[k].until>now;let po=false;
 try{po=!!w&&!WR().portalOpen(WR().norm(structuredClone(w),now),now)&&int(w.por?.until)>int(c.pu);}catch(_){po=false;}
 return {aa:live('aa'),cv:live('cv'),po,until:{aa:live('aa')?c.prep.aa.until:0,cv:live('cv')?c.prep.cv.until:0,po:po?int(w.por.until):0}};}
// why this tier cannot be launched now ('' when it can). FORCE and DEFENSE are advice: they never block
const opensAt=(c,t)=>{c=norm(c);t=int(t);return t>1&&t===c.t+1&&int(c.fc[t-1])>0?int(c.fc[t-1])+CIT.refortMs:0;};   // 0: open now (tier I, or a cleared tier's Throne Run)
const dhm=ms=>{const m=Math.max(1,Math.ceil(ms/60000)),d=Math.floor(m/1440),h=Math.floor(m%1440/60);return d?d+' d '+h+' h':h?h+' h '+m%60+' m':m+' m';};
function launchWhy(s,tier,now){const c=norm(s?.cit),t=int(tier);if(t<1||t>CIT.live)return 'that Citadel tier is not built yet';
 if(t>c.t+1)return 'break Citadel '+ROMAN[c.t+1]+' first';{const at=opensAt(c,t);if(at&&num(now)<at)return 'the Hive re-fortifies Citadel '+ROMAN[t]+': it opens in '+dhm(at-num(now));}if(!frontHeld(s?.war))return 'hold both approach territories first (Ash Redoubt and Oxygen Spear)';
 if(s?.mission)return 'finish or leave the operation first';if(s?.td?.active)return 'finish the town defense first';if(!(num(s?.hp)>0))return 'Machine disabled';return '';}
// the assault's battle points (the approved formula: par minutes x 225 x the ring's danger)
const battlePoints=()=>Math.round(CIT.par*WR().WAR.ppm*WR().WAR.danger[CIT.ring]);
const bountyOf=t=>CIT.bounty[clamp(int(t),0,9)]||0;
const prodOf=tiers=>Math.round(CIT.prod*clamp(int(tiers),0,9)*10000)/10000;
// the cutscene for a tier's assault: full on its first attempt, short after (seen = reveals already started)
const cutOf=(tier,seen)=>({tier:int(tier),full:!(int(seen)>0),ms:int(seen)>0?CIT.cut.shortMs:CIT.cut.fullMs});
// ---- the assault (an Operation of the shared combat engine) -------------------------------------------------------------------
// B.cit: the fortress's live state (plain data, saved with the battle): tier, stage 0 BREACH / 1 PUSH / 2 THE GENERAL / 3 won, open (the
// gate's fall), waves / wavesMax, ships (launched) / shipsMax, portal (surges left), air (airstrikes left), strikes, shells, drops (pending
// impacts), next (timers), down (dropships shot down), landed, gam (the Throne Run's Gambits), prep (what siege prep removed), say (the
// latest call-out {t, at}), clear (the clear time, s)
const dist2=(ax,az,bx,bz)=>Math.hypot(ax-bx,az-bz);
function segDist(px,pz,s){const c=centre(),x1=c.x+s[0],z1=c.z+s[1],x2=c.x+s[2],z2=c.z+s[3],dx=x2-x1,dz=z2-z1,l2=dx*dx+dz*dz||1,k=clamp(((px-x1)*dx+(pz-z1)*dz)/l2,0,1);return Math.hypot(px-(x1+dx*k),pz-(z1+dz*k));}
class Assault extends CC.Operation{
 constructor(loadout,p,id){super(loadout,p,id);const o=this.operation,Tr=TIERS[o.citadel];
  this.enemies=[];this.id=20000;this.objectiveDamageable=false;   // the engine's two guards of a plain operation stand nowhere near the Citadel
  this.cit={tier:Tr.n,stage:0,open:0,waves:0,wavesMax:Tr.waves,lastWave:-99,ships:0,shipsMax:Tr.ships,portal:2,air:0,strikes:[],shells:[],drops:[],next:{swarm:6,mortar:[],ship:0,barrage:12},down:0,landed:0,gam:[],prep:{aa:0,cv:0,po:0},say:{t:'BREACH · '+Tr.mech.toUpperCase(),at:0},clear:0,phase:[0,0],warden:0};
  const L=LAYOUT,put=(kind,u,v,key,patch)=>{const q=at(u,v);try{this.deploy(kind,q.x,q.z,key);}catch(_){return null;}const e=this.enemies.at(-1);Object.assign(e,{immobile:true,noLoot:true},patch);return e;};
  // BREACH: the outer guns on the rampart, the generators (I) or the hard gate (II-III), the mortars (II-III)
  L.guns.slice(0,Tr.guns).forEach(([u,v],i)=>put('bastion',u,v,'cit:gun:'+i,{cit:'gun'}));   // the rampart guns outrange a tank: they fire at the Battalion's nearest threat
  if(Tr.gate==='shield')L.gens.slice(0,Tr.gens).forEach(([u,v],i)=>put('structure',u,v,'cit:gen:'+i,{cit:'gen',hp:CIT.gen.hp,maxHp:CIT.gen.hp,objectiveTarget:true}));
  else put('structure',L.gateAt.u,L.gateAt.v,'cit:gate',{cit:'gate',hp:CIT.gate.hp,maxHp:CIT.gate.hp,objectiveTarget:true});
  L.mortars.slice(0,Tr.mortars).forEach(([u,v],i)=>{const e=put('mortar',u,v,'cit:mortar:'+i,{cit:'mortar',hp:CIT.mortar.hp,maxHp:CIT.mortar.hp});if(e)this.cit.next.mortar.push(4+2*i);});
  this.cit.cover=L.cover.slice(0,Tr.cover).map(([u,v])=>{const q=at(u,v);return [q.x,q.z];});
  this.cit.zones=L.zones.slice(0,Tr.zones).map(([u,v])=>{const q=at(u,v);return [q.x,q.z];});
  this.objective={...this.objective,...at(L.throne.u,L.throne.v)};this.objective.y=W().groundAt(this.objective.x,this.objective.z)+2.2;}
 // the Worker's start: what the siege prep removes and the Throne Run's Gambits (the phone gets the same through the saved battle)
 setup({prep={},gambits=[]}={}){const c=this.cit,g=(gambits||[]).filter(k=>GAMBITS[k]).slice(0,3);c.gam=g;c.prep={aa:prep.aa?1:0,cv:prep.cv?1:0,po:prep.po?1:0};
  c.air=(prep.aa?1:0)+(g.includes('airwing')?1:0);
  const more=g.includes('double')?1:0,less=prep.cv?1:0;if(c.shipsMax)c.shipsMax=Math.max(0,c.shipsMax-less+more);else c.wavesMax=Math.max(0,c.wavesMax-less+more);
  c.portal=prep.po&&!g.includes('portalstorm')?0:CIT.portal.atS.length;return this;}
 say(t){this.cit.say={t,at:Math.round(this.time*10)/10};}
 // a saved battle (Firebase drops empty lists and may hand lists back as maps): every list of the fortress's state, rebuilt
 citRestore(){const L=v=>Array.isArray(v)?v:record(v)?Object.keys(v).sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]):[],c=record(this.cit)?this.cit:{};
  for(const k of ['strikes','shells','drops','gam','cover','zones','phase'])c[k]=L(c[k]);while(c.phase.length<2)c.phase.push(0);c.next=record(c.next)?c.next:{swarm:0,mortar:[],ship:0,barrage:12};c.next.mortar=L(c.next.mortar);
  c.prep=record(c.prep)?c.prep:{aa:0,cv:0,po:0};c.say=record(c.say)?c.say:{t:'',at:0};this.cit=c;return this;}
 // ---- the rampart: a unit never passes a wall or the closed gate; it slides along the wall (to the gate) instead ----
 gateClosed(){return this.cit.stage<1;}
 wallHit(q){const L=LAYOUT,c=centre();for(const s of L.walls)if(segDist(q.x,q.z,s)<L.wallR)return s;if(this.gateClosed()){const g=L.gate,u=q.x-c.x,v=q.z-c.z;if(Math.abs(u-g.u)<L.wallR&&v>g.v0-L.wallR&&v<g.v1+L.wallR)return [g.u,g.v0,g.u,g.v1];}return null;}
 crosses(p,q){const c=centre(),L=LAYOUT;for(const s of [...L.walls,...(this.gateClosed()?[[L.gate.u,L.gate.v0,L.gate.u,L.gate.v1]]:[])]){const ax=c.x+s[0],az=c.z+s[1],bx=c.x+s[2],bz=c.z+s[3],d1=(bx-ax)*(p.z-az)-(bz-az)*(p.x-ax),d2=(bx-ax)*(q.z-az)-(bz-az)*(q.x-ax),d3=(q.x-p.x)*(az-p.z)-(q.z-p.z)*(ax-p.x),d4=(q.x-p.x)*(bz-p.z)-(q.z-p.z)*(bx-p.x);if(d1*d2<0&&d3*d4<0)return s;}return null;}
 slideOf(p,q){if(!q||!(Math.abs(q.x-p.x)+Math.abs(q.z-p.z)))return q;const s=this.crosses(p,q)||this.wallHit(q);if(!s)return q;if(this.wallHit(p))return this.unstick(p,q);
  const tx=s[2]-s[0],tz=s[3]-s[1],l=Math.hypot(tx,tz)||1,ux=tx/l,uz=tz/l,k=(q.x-p.x)*ux+(q.z-p.z)*uz;if(Math.abs(k)<1e-6)return p;const r=W().advance(p,ux*k,uz*k);return this.crosses(p,r)||this.wallHit(r)?p:r;}
 unstick(p,q){return this.wallHit(q)&&segDist(q.x,q.z,this.wallHit(q))<=segDist(p.x,p.z,this.wallHit(p))?p:q;}   // a unit standing in a wall's margin may only move out of it
 moveOf(f,dx,dz){return this.slideOf(f,W().advance(f,dx,dz));}
 enemyAdvance(e,dt){if(e.ship)return this.shipPose(e);if(e.drone)return super.enemyAdvance(e,dt);return this.slideOf(e,W().advance(e,e.vx*dt,e.vz*dt));}
 choose(e){if(e.ship||e.cit){e.vx=e.vz=0;e.target=this.player;e.tf=0;if(e.cit==='gun'&&this.friends.length){const T=this.threat(e,Math.hypot(e.x-this.player.x,e.z-this.player.z));if(T?.f){e.target=T.t;e.tf=T.f.id;}}return;}super.choose(e);}
 // ---- the fight ----
 step(dt,fire){const c=this.cit;if(c.gam.includes('noshield')){this.shieldT=0;this.shieldCd=Math.max(this.shieldCd||0,.5);}if(c.gam.includes('overdrive')&&this.dashCd>0)this.dashCd=Math.max(0,this.dashCd-dt);
  super.step(dt,fire);if(this.state!=='active')return;if(this.time>=CIT.limitS){this.state='defeat';this.reason='The siege window closed';this.projectiles=[];this.say('THE SIEGE WINDOW CLOSED');return;}this.citStep(dt);}
 living(f){return this.enemies.filter(e=>e.hp>0&&!e.resident&&!e.dormant&&(!f||f(e)));}
 pushLeft(){return this.living(e=>e.wave&&!e.swarm&&!e.ship).length;}
 citStep(dt){const c=this.cit,Tr=TIERS[c.tier],t=this.time;
  if(c.stage===0&&this.gateDown()){c.stage=1;c.open=t;this.say(Tr.gate==='shield'?'SHIELD GATE DOWN · PUSH INTO THE COURTYARD':'THE GATE IS BREACHED · PUSH IN');this.citWave(W1,LAYOUT.garrison,'garrison',true);if(c.shipsMax)c.next.ship=t+CIT.ship.firstS;}
  if(c.stage===1){
   const since=t-Math.max(c.open,c.lastWave);if(!c.shipsMax&&c.waves<c.wavesMax&&!c.drops.some(d=>d.k==='wave')&&(since>=CIT.waveS||since>=CIT.waveMin&&this.pushLeft()<=2)){const [u,v]=LAYOUT.drops[c.waves%LAYOUT.drops.length],q=at(u,v);c.waves++;c.lastWave=t;c.drops.push({k:'wave',x:q.x,z:q.z,at:t+CIT.drop.tellS,n:c.waves});this.mark('cdrop',q.x,q.z,CIT.drop.r,CIT.drop.tellS,CIT.drop.dmg);this.say('REINFORCEMENTS INBOUND');}
   if(c.shipsMax&&c.ships<c.shipsMax&&(t>=c.next.ship||t>=c.next.ship-CIT.ship.everyS+CIT.ship.minS&&this.pushLeft()<=2&&!this.living(e=>e.ship&&!e.landed&&!e.left).length)){this.launchShip();c.next.ship=t+CIT.ship.everyS;}   /* the next ship launches early once the courtyard is down to two and the sky is clear */
   const done=c.shipsMax?c.ships>=c.shipsMax&&!this.living(e=>e.ship&&!e.left).length:c.waves>=c.wavesMax&&!c.drops.some(d=>d.k==='wave');
   if(done&&(this.pushLeft()<=2||t>=Math.max(c.lastWave,c.lastShip||0)+CIT.wardenS))this.deployWarden();}
  if(c.stage===2)this.wardenStep();
  // the portal's surges (no portal reinforcements when the portal was suppressed: siege prep)
  if(c.portal>0&&c.stage>=1){const i=CIT.portal.atS.length-c.portal,due=i===0?c.stage>=1&&t>=c.open+CIT.portal.atS[0]:c.stage>=2&&t>=c.warden+CIT.portal.atS[1];if(due){c.portal--;this.citWave(['raider','raider','raider'],[[LAYOUT.portalAt.u,LAYOUT.portalAt.v]],'portal');this.effects.push({kind:'radio',...at(LAYOUT.portalAt.u,LAYOUT.portalAt.v),y:this.player.y+6,life:1.2});this.say('THE PORTAL SURGES');}}
  this.swarmStep(Tr,t);this.mortarStep(Tr,t);this.impacts(t);
  if(c.gam.includes('barrage')&&t>=c.next.barrage){c.next.barrage=t+12;this.markStrike('orbital',this.player.x,this.player.z,0);}}
 gateDown(){const Tr=TIERS[this.cit.tier],k=Tr.gate==='shield'?'gen':'gate';return !this.enemies.some(e=>e.cit===k&&e.hp>0);}
 // a wave of authored units at these spots (reinforcements carry no salvage: the operation's economy is its battle points)
 citWave(kinds,spots,tag,loot=false){const n=this.cit.spawned=(this.cit.spawned|0)+1;kinds.forEach((kind,i)=>{const [u,v]=spots[i%spots.length],q=at(u,v);try{this.deploy(kind,q.x+(i>=spots.length?(i-spots.length)*5-4:0),q.z,loot?'cit:'+tag+':'+i:'cit:'+tag+':'+n+':'+i);}catch(_){return;}const e=this.enemies.at(-1);e.wave=tag;e.cd=1.2;if(!loot)e.noLoot=true;});}
 mark(kind,x,z,r,tellS,damage){this.hazards=Array.isArray(this.hazards)?this.hazards:[];if(this.hazards.length>=8)return;this.hazards.push({kind,x,z,y:W().groundAt(x,z),radius:r,remaining:tellS,damage,source:0});}
 swarmStep(Tr,t){const c=this.cit,S=Tr.swarm;if(!S||t<c.next.swarm)return;c.next.swarm=t+S.every*(c.gam.includes('tide')?.5:1);
  const live=this.living(e=>e.swarm).length,n=Math.min(S.n,S.cap-live);if(n<=0)return;const vents=c.stage>=1?LAYOUT.ventsIn:LAYOUT.ventsOut,[u,v]=vents[Math.floor(t/S.every)%vents.length],q=at(u,v);
  for(let i=0;i<n;i++){try{this.deploy('swarm',q.x+(i%2?3:-3),q.z+(i>1?3:-3),'cit:swarm:'+Math.round(t*10)+':'+i);}catch(_){continue;}const e=this.enemies.at(-1);e.swarm=1;e.noLoot=true;e.wave='swarm';}}
 // Spore Mortars: a marked shell on the pilot (or on a marked zone with someone in it) every 9 s each; forward cover stops the shell
 mortarStep(Tr,t){const c=this.cit,M=CIT.mortar,ms=this.enemies.filter(e=>e.cit==='mortar');ms.forEach((e,i)=>{if(e.hp<=0||t<(c.next.mortar[i]??Infinity))return;c.next.mortar[i]=t+M.everyS;
  const units=[this.player,...this.friends.filter(f=>f.side==='mine'&&!f.down&&f.hp>0)],zone=c.zones.find(z=>units.some(p=>dist2(p.x,p.z,z[0],z[1])<M.zoneR)),odd=(Math.floor(t/M.everyS)+i)%2===1;
  const [x,z,r]=zone&&odd?[zone[0],zone[1],M.zoneR]:[this.player.x,this.player.z,M.r];c.shells.push({x,z,r,at:t+M.tellS,dmg:M.dmg,src:e.id});this.mark('mortar',x,z,r,M.tellS,0);});}
 covered(p){return this.cit.cover.some(q=>dist2(p.x,p.z,q[0],q[1])<CIT.cover.r);}
 // what lands now: mortar shells (the pilot and allies in the zone, unless in cover), the drops' waves, the airstrikes
 impacts(t){const c=this.cit;
  for(const sh of c.shells.filter(x=>x.at<=t)){if(!this.covered(this.player)&&dist2(this.player.x,this.player.z,sh.x,sh.z)<sh.r){this.hitBy=sh.src||-1;let d=sh.dmg*(1-armor(this.playerStats));if(this.shieldT>0)d*=SHIELD_MULT;this.playerHp=Math.max(0,this.playerHp-d);}
   for(const f of this.friends)if(f.side==='mine'&&!f.down&&f.hp>0&&!this.covered(f)&&dist2(f.x,f.z,sh.x,sh.z)<sh.r){f.hp=Math.max(0,f.hp-sh.dmg*(1-armor(CC.friendStats(f))));if(f.hp<=0)this.friendDown?.(f);}
   this.effects.push({kind:'destroy',weapon:'mortar',x:sh.x,y:W().groundAt(sh.x,sh.z)+.8,z:sh.z,r:sh.r,life:.6});}
  c.shells=c.shells.filter(x=>x.at>t);
  for(const d of c.drops.filter(x=>x.at<=t)){if(d.k==='wave')this.citWave(TIERS[c.tier].rw||RW,[[d.x-centre().x,d.z-centre().z]],'reinforce');}
  c.drops=c.drops.filter(x=>x.at>t);
  for(const s of c.strikes.filter(x=>x.at<=t)){for(const e of this.enemies){if(e.hp<=0||e.dormant||e.resident||dist2(e.x,e.z,s.x,s.z)>=CIT.strike.r)continue;e.ad=1;if(e.core>0)continue;   // the LDF's ordnance never touches a shield core (only your tank breaks it)
    const old=e.hp;e.hp=Math.max(0,e.hp-CIT.strike.dmg);if(old>0&&!e.hp)this.effects.push({kind:'destroy',x:e.x,y:e.y+2,z:e.z,life:.7,at:this.time});}
   this.effects.push({kind:'destroy',weapon:'siege',x:s.x,y:W().groundAt(s.x,s.z)+.8,z:s.z,r:CIT.strike.r,life:.8});}
  c.strikes=c.strikes.filter(x=>x.at>t);
  for(const e of this.enemies)if(e.ship&&e.hp<=0&&!e.landed&&!e.counted){e.counted=1;c.down++;c.lastShip=t;this.say('DROPSHIP SHOT DOWN · ITS WAVE NEVER LANDS');}}
 // the LDF airstrike (siege prep: the anti-air batteries knocked out): the pilot calls it on the locked target or 40 m ahead
 callStrike(p){const c=this.cit;if(!(c.air>0)||this.state!=='active')return false;const lock=this.enemies.find(e=>e.id===this.lockId&&e.hp>0),yaw=this.turretYaw||0,x=lock?lock.x:p.x+Math.sin(yaw)*CIT.strike.ahead,z=lock?lock.z:p.z+Math.cos(yaw)*CIT.strike.ahead;
  c.air--;c.strikes.push({x,z,at:this.time+CIT.strike.tellS});this.mark('air',x,z,CIT.strike.r,CIT.strike.tellS,0);this.say('LDF AIRSTRIKE INBOUND');return true;}
 // dropships (tier III): fly in from the deck over 14 s, unload one wave on landing, lift away 6 s later; shot down first, the wave is lost
 launchShip(){const c=this.cit,[u,v]=LAYOUT.pads[c.ships%LAYOUT.pads.length],pad=at(u,v),from=at(260,v*1.6);c.ships++;let e;try{this.deploy('dropship',pad.x,pad.z,'cit:ship:'+c.ships);}catch(_){return;}e=this.enemies.at(-1);
  Object.assign(e,{ship:{pad:[pad.x,pad.z],from:[from.x,from.z],t0:this.time,n:c.ships},noLoot:true,surface:'air',cd:999});const P=this.shipPose(e);Object.assign(e,{x:P.x,y:P.y,z:P.z});this.say('DROPSHIP INBOUND · SHOOT IT DOWN');}
 shipPose(e){const S=e.ship,k=clamp((this.time-S.t0)/CIT.ship.flyS,0,1),ease=1-(1-k)*(1-k),x=S.from[0]+(S.pad[0]-S.from[0])*ease,z=S.from[1]+(S.pad[1]-S.from[1])*ease,g=W().groundAt(x,z);
  if(k>=1&&!e.landed&&e.hp>0){e.landed=1;this.cit.landed++;this.cit.lastShip=this.time;this.citWave(TIERS[this.cit.tier].rw||RW,[[S.pad[0]-centre().x,S.pad[1]-centre().z]],'ship');this.say('A DROPSHIP LANDED · ITS WAVE IS OUT');}
  if(e.landed&&this.time>=S.t0+CIT.ship.flyS+CIT.ship.unloadS&&!e.left){e.left=1;e.dormant=true;}
  if(e.left)return {x:S.pad[0]+400,y:g+90,z:S.pad[1],surface:'air'};
  return {x,y:g+(k>=1?1.5:1.5+34*(1-ease)),z,surface:'air'};}
 // THE GENERAL: the warden (3 stars) on its doctrine; its shield core takes only your tank's fire and re-forms twice after a tell
 deployWarden(){const c=this.cit,Tr=TIERS[c.tier],G=Tr.warden,q=at(LAYOUT.throne.u,LAYOUT.throne.v);if(c.stage>=2)return;c.stage=2;c.warden=this.time;
  try{this.deploy('sentinel',q.x,q.z,'cit:warden');}catch(_){c.stage=1;return;}const e=this.enemies.at(-1);
  Object.assign(e,{warden:1,commander:true,general:G.id,pattern:G.pattern,hp:CIT.warden.hp,maxHp:CIT.warden.hp,core:CIT.warden.core,coreMax:CIT.warden.core,nextPattern:this.time+4,drones:0,noLoot:false,wave:'warden',...(c.gam.includes('enraged')?{enraged:true}:{})});
  this.wardenId=e.id;c.next.escort=this.time+CIT.escortS;this.citWave(['raider','raider'],[[LAYOUT.throne.u-8,-10],[LAYOUT.throne.u-8,10]],'escort');this.say(G.name+' · ONLY YOUR TANK BREAKS THE SHIELD CORE');}
 wardenStep(){const c=this.cit,e=this.enemies.find(x=>x.id===this.wardenId);if(!e)return;
  if(e.hp<=0){this.state='victory';c.stage=3;c.clear=Math.round(this.time*1000);this.projectiles=[];this.say('THE WARDEN FALLS');return;}
  if(this.time>=(c.next.escort||Infinity)){c.next.escort=this.time+CIT.escortS;if(this.living(x=>x.wave&&String(x.wave).startsWith('escort')).length<CIT.escortCap){const k=(c.esc=(c.esc|0)+1)%2;this.citWave(['raider','breacher'],[[LAYOUT.throne.u-10,k?-14:14]],'escort'+c.esc);this.say('THE WARDEN CALLS ITS GUARD');}}
  if(!e.enraged&&e.hp<e.maxHp*CIT.warden.enrage){e.enraged=true;e.nextPattern=Math.min(e.nextPattern||0,this.time+1.5);this.say('THE WARDEN ENRAGES');}
  if(c.reformAt){if(this.time>=c.reformAt){e.core=e.coreMax;c.reformAt=0;e.telegraph=false;this.say('SHIELD CORE UP · BREAK IT');}return;}
  const i=CIT.warden.reform.findIndex((f,k)=>!c.phase[k]&&e.core<=0&&e.hp<=e.maxHp*f);if(i>=0){for(let k=0;k<=i;k++)c.phase[k]=1;c.reformAt=this.time+CIT.warden.tellS;e.telegraph=true;this.say('THE CORE IS RE-FORMING');}}
}
const make=(loadout,p,id)=>new Assault(loadout,p,id);
// the staging point of the siege camp (where a launched assault starts)
const stageAt=()=>{const q=at(LAYOUT.stage.u,LAYOUT.stage.v);return {x:q.x,z:q.z,y:W().groundAt(q.x,q.z),surface:'ground'};};
root.ConquestCitadel=Object.freeze({opensAt,CIT,TIERS,WARDENS,BANDS,PREP,GAMBITS,GAMBIT_WEEKS,LAYOUT,HOOKS,ROMAN,Assault,make,fresh,norm,tiersOf,isCitadel,tierOfId,nextTier,frontHeld,prepOf,
 launchWhy,battlePoints,bountyOf,prodOf,cutOf,weekOf,gambitsOf,stageAt,centre,at,segDist});
})(globalThis);
