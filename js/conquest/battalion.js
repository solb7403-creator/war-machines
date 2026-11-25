/* Session 6C Battalion rules (owner prompt Nov 18; blueprint §4), shared by the phone and the Worker (worker/build-sim.mjs packs
   this file into the CONQUEST bundle): the roster of named recruits, fielding by Hangar level, fight sizes, ranks, Role Core
   levels, AUTO-ARM from the account's spare owned gear, the FORCE rating, presets and formations. Pure functions over plain
   records: the Worker owns every change (worker/src/conquest-battalion.js); the phone only reads these to draw the HANGAR.
   Never sold: pilots, ranks, Role Core levels. Nothing here ever pays airdrop points. */
(function(root){
'use strict';
const C=root.ConquestCombat;
const ROSTER_MAX=16;
// allies you can field: 1 with no Hangar; Hangar levels I-V field 2 / 4 / 5 / 7 / 9 (owner, Nov 18)
const FIELD=Object.freeze([1,2,4,5,7,9]);
// fight sizes (blueprint §4 Decision 2): Wing for roaming, field missions and mining escorts; Platoon for raids, territory and
// town defenses (and Meteor Strikes: a HARD group fight like a raid, planning pick); Battalion for Citadel assaults, Grand
// Offensives and co-op (Sessions 7 and 7B; an operation marked battalion:true uses it, tests use it now)
const SCALE=Object.freeze({wing:2,platoon:4,battalion:9});
function scaleOf(op){if(!op)return 'wing';if(op.battalion)return 'battalion';if(op.raid||op.defense||op.family==='base-defense'||op.strike)return 'platoon';return 'wing';}
// One new thing per stage (blueprint §3, planning pick): the first wingman follows and fights; roles, COMMAND orders and
// formations open with Hangar level II (the Platoon stage)
const ROLES_AT=2;
// Ranks 1-10 from operations fought (lead's pace, judged by the owner's goal rules; weeks are report numbers only): XP per
// operation won by its authored danger, 1 for a lost fight that lasted at least FOUGHT_S (a retreat gives nothing), the most
// one operation can give is one rank (XCOM's rule). Ranks 3, 6 and 9 upgrade the role signature.
const XP=Object.freeze({STANDARD:1,HARD:2,VETERAN:3}),FOUGHT_S=30;
const RANK_XP=Object.freeze([0,4,12,25,45,75,115,170,240,330]);   // XP to reach rank 1..10
const RANK_NAMES=Object.freeze(['','CADET','PILOT','PILOT FIRST CLASS','CORPORAL','SERGEANT','STAFF SERGEANT','LIEUTENANT','CAPTAIN','MAJOR','COMMANDER']);
const rankOf=xp=>{let r=1;for(let i=1;i<RANK_XP.length;i++)if(xp>=RANK_XP[i])r=i+1;return Math.min(10,r);};
const sigTier=rank=>rank>=9?3:rank>=6?2:rank>=3?1:0;
// Role Cores (Science Lab IV): level 1 free with the role; levels 2-5 cost 2 / 4 / 5 / 9 command chips (owner, Nov 18: 20 a role,
// 120 for all six), chips and time only, 8 h jobs in the Lab's research slots. A role's level reaches every pilot of that role.
const RC=Object.freeze({max:5,cost:Object.freeze([0,0,2,4,5,9]),ms:28800000,lab:4});
// the signature's strength m: +10% a Role Core level above 1 and +10% at each of ranks 3, 6 and 9 (1.0 .. 1.7)
const strength=(rank,lv)=>Math.round((1+.1*sigTier(rank)+.1*(Math.max(1,Math.min(RC.max,lv|0||1))-1))*100)/100;
// Command chips (owner, Nov 18): the day's first win with at least one of your pilots fielded gives 1, guaranteed; 1 earned chip
// per account per UTC day (the Worker's clock); earned chips are kept like earned research parts (max 50); a chip found after the
// day's chip becomes 1 cosmetic fragment of pool CHIP.swap (the CQ_PART_SWAP pattern, for later chip sources). Chips from the
// chip pack are a separate account total (eco S.bch, like S.bpt) and ignore the daily limit.
const CHIP=Object.freeze({day:1,max:50,swap:'u'});
// The Hangar's RECRUIT job (planning picks): time only (no CP), 8 h on the Worker clock, one at a time, none while the roster is
// full. Recruits also come from your first win of BEACON EXTRACTION (the HARD 'rescue' operation) each UTC day, and the first
// wingman from the rescue right after the first plate (operation WINGMAN below).
const RECRUIT=Object.freeze({ms:28800000});
// Downed allies return at half hull until repaired with alloy at the Refuge or your town (alloy per pilot: the lead's PROPOSAL
// from the economy model, RESOURCE_ECONOMY.md §15; your own hull repair stays free)
const REPAIR=Object.freeze({alloy:6});
const FORMATIONS=Object.freeze(['line','wedge','escort']),FORM_NAMES=Object.freeze({line:'LINE',wedge:'WEDGE',escort:'ESCORT'}),PRESETS=3;
// what each role answers (blueprint §4) and its hint words for a briefing
const ROLE_INFO=Object.freeze({
 guardian:Object.freeze({n:'Guardian',chassis:'Titan',sig:'Draws fire. Allies behind it take 20% less damage',answers:'Brutes, focus fire on you',icon:'⛨'}),
 breacher:Object.freeze({n:'Breacher',chassis:'Vanguard',sig:'Bonus damage to structures and shield domes. Short charge',answers:'Shield Wardens, batteries, walls',icon:'⯁'}),
 lancer:Object.freeze({n:'Lancer',chassis:'Titan or Vanguard',sig:'Out-ranges everything. Weak inside 20 m. Bonus against drones and dropships',answers:'Spore Mortars, turrets, airships',icon:'➶'}),
 mender:Object.freeze({n:'Mender',chassis:'Scout or Vanguard',sig:'Heals nearby allies. Revives one downed ally per fight',answers:'Attrition, long sieges',icon:'✚'}),
 corroder:Object.freeze({n:'Corroder',chassis:'Vanguard',sig:'Stacking armor shred: the target takes more damage from everyone',answers:'Sentinels, generals, Leeches',icon:'☣'}),
 frostline:Object.freeze({n:'Frostline',chassis:'Scout',sig:'Cryo fields slow; light units freeze',answers:'Swarms, Burrowers, interceptor rushes',icon:'❄'})});
// the first wingman's rescue (owner, Nov 18): its own STANDARD mission near the Refuge, right after the first plate; it pays no
// airdrop points (no new points source) and no salvage: its reward is the pilot
const WINGMAN=Object.freeze({id:'wingman-rescue'});
// names: 16 named recruits, each with a call sign (generic names; picked from the pilot's own server seed without repeats)
const FIRST=Object.freeze(['Mara','Ivo','Sela','Tomas','Nadia','Oren','Kaito','Lena','Ravi','Ines','Dario','Yuki','Hana','Felix','Amara','Bo','Cyra','Dmitri','Esme','Farid','Greta','Hugo','Isla','Jonas','Kenji','Lior','Mina','Niko','Olu','Priya','Quinn','Rosa','Soren','Talia','Uma','Vik','Wren','Yara','Zane','Arlo']);
const LAST=Object.freeze(['Voss','Okafor','Lindqvist','Reyes','Tanaka','Haddad','Novak','Brandt','Castillo','Duarte','Ekwueme','Fischer','Grieve','Halloran','Ibarra','Jansen','Kowal','Larsen','Moreau','Nakamura','Orlov','Petrov','Quade','Rasmussen','Sato','Teller','Ueda','Varga','Whitlock','Yilmaz','Zielinski','Achebe']);
const CALLS=Object.freeze(['ANVIL','ARROW','BANSHEE','BASTION','BLITZ','CINDER','COBALT','COMET','CROW','DAGGER','DRIFT','DUSK','EMBER','FALCON','FLINT','FROST','GHOST','GRANITE','HALO','HAMMER','IRIS','JACKAL','JUNO','KESTREL','LANCE','LYNX','MAGPIE','MANTIS','MOTH','NOMAD','ONYX','ORBIT','PIKE','QUILL','RAVEN','RELIC','RIPTIDE','SABRE','SHALE','SPARROW','TALON','TEMPEST','THISTLE','UMBRA','VESPER','VIPER','WARDEN','ZEPHYR']);
function u32(t){let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0;}
// a new pilot's identity: name and call sign from the seed, never repeating a call sign already on the roster
function identity(seed,n,taken){const used=new Set(taken||[]);let k=u32(seed+':cs:'+n)%CALLS.length;for(let i=0;i<CALLS.length&&used.has(CALLS[k]);i++)k=(k+1)%CALLS.length;
 return {n:FIRST[u32(seed+':fn:'+n)%FIRST.length]+' '+LAST[u32(seed+':ln:'+n)%LAST.length],cs:CALLS[k]};}
const fieldCap=hangarLv=>FIELD[Math.max(0,Math.min(5,hangarLv|0))];
const fielded=(hangarLv,scale)=>Math.min(fieldCap(hangarLv),SCALE[scale]||SCALE.wing);
// ---- AUTO-ARM (owner, Nov 18; blueprint Decision 9): your best spare owned weapons and chassis, one item per tank; with no spare
// gear an ally uses a militia kit (Common, no cores). gear: the account's owned items (RULES.gearList on the Worker, from the
// account record only). own: the pilot's own loadout (its weapon and chassis are not spare). pilots: in the order to arm.
const militia=role=>({w:{a:'pulse',t:0,q:1,s:false},c:{c:(C.ROLES[role]?.cls||['vanguard'])[0],t:0,q:1,s:false},mil:1});
const WPREF=Object.freeze({lancer:['moon','siege','pulse','twin'],breacher:['twin','siege','pulse','moon'],'':['pulse','siege','twin','moon']});
// Session 7T (owner decision 8): an item's key (weapon or chassis, tier, salvaged), so a pilot's own pick can name it
const keyOf=it=>it?String(it.k)+':'+(it.t|0)+(it.s?':s':''):'';
function autoArm(gear,own,pilots,fixed){const W=[...(gear?.w||[])],Ch=[...(gear?.c||[])],used=(list,it)=>list.splice(list.indexOf(it),1);
 const same=(a,b)=>a&&b&&a.k===b.k&&(a.t|0)===(b.t|0)&&!!a.s===!!b.s;const ow=own?.w?{k:own.w.a,t:own.w.t,s:!!own.w.s}:null,oc=own?.c?{k:own.c.c,t:own.c.t,s:!!own.c.s}:null;
 {const i=W.findIndex(x=>same(x,ow));if(i>=0)W.splice(i,1);}{const i=Ch.findIndex(x=>same(x,oc));if(i>=0)Ch.splice(i,1);}   // the pilot's own tank keeps its items
 // Session 7T: the pilots' own picks (fixed[id] = {w, c}: owned spare items) come off the lists first; AUTO-ARM fills the rest as before
 const fx=fixed||{};for(const f of Object.values(fx)){if(f?.w&&W.includes(f.w))used(W,f.w);if(f?.c&&Ch.includes(f.c))used(Ch,f.c);}
 const kits={};for(const p of pilots){const role=p.r||'',cls=C.ROLES[role]?.cls||null,pref=WPREF[role]||WPREF[''],mine=fx[p.id]||{};
  const c=mine.c||Ch.filter(x=>!cls||cls.includes(x.k)).sort((a,b)=>b.m-a.m||cls?.indexOf(a.k)-cls?.indexOf(b.k)||0)[0],w=mine.w||W.slice().sort((a,b)=>b.m-a.m||pref.indexOf(a.k)-pref.indexOf(b.k))[0];
  const M=militia(role),kit={w:w?{a:w.k,t:w.t,q:w.q,s:!!w.s}:M.w,c:c?{c:c.k,t:c.t,q:c.q,s:!!c.s}:M.c};if(w&&!mine.w)used(W,w);if(c&&!mine.c)used(Ch,c);if(!(kit.w.t>0||kit.w.s||kit.w.a==='moon'||kit.c.t>0||kit.c.s))kit.mil=1;kits[p.id]=kit;}   /* Session 6C review 2: an all-Common kit (Common, no cores) is a militia crew, spare or not */
 return kits;}
// Session 7T (owner decision 8): your spare owned items (the account's gear minus what your own tank wears), for the picker
function spare(gear,own){const W=[...(gear?.w||[])],Ch=[...(gear?.c||[])],same=(a,b)=>a&&b&&a.k===b.k&&(a.t|0)===(b.t|0)&&!!a.s===!!b.s,ow=own?.w?{k:own.w.a,t:own.w.t,s:!!own.w.s}:null,oc=own?.c?{k:own.c.c,t:own.c.t,s:!!own.c.s}:null;
 {const i=W.findIndex(x=>same(x,ow));if(i>=0)W.splice(i,1);}{const i=Ch.findIndex(x=>same(x,oc));if(i>=0)Ch.splice(i,1);}return {w:W,c:Ch};}
// what a kit makes of a pilot (the same tankOf() rules as your own tank): damage a second, hull, speed, POWER and the pilot's rating
function kitStats(kit,rk=1){let t=null,L=null;try{L=C.allyLoadout(kit||{});t=tankOf(L,1);}catch(_){}if(!t)return null;let pw=0;try{pw=powerOf(L);}catch(_){}
 return {dps:Math.round(t.wdps*(t.dmgM||1)),hp:t.mhp,spd:Math.round((t.spdM||1)*100),power:pw,rating:pw+4*((rk|0||1)-1),shot:t.wshot,cls:t.cls,type:t.wtype};}
// ---- FORCE (the battalion rating, js/conquest/rating.js key 'force'): informational only, nothing reads it. The fielded pilots'
// gear power (POWER of each ally's own kit) plus 4 a rank above 1 and 6 a Role Core level above 1.
function force(pilots,rc){let n=0;for(const p of pilots||[]){const L=C.allyLoadout(p.kit||militia(p.r));n+=powerOf(L)+4*((p.rk|0||1)-1)+6*((p.r?Math.max(1,rc?.[p.r]|0):1)-1);}return Math.round(n);}
// the forces a briefing shows: the active preset's pilots in order, then the rest of the roster, up to the fight size
function picked(bat,hangarLv,scale){const all=(bat?.p||[]),ps=bat?.ps?.[bat?.pa|0],order=[...(ps?.ids||[]).map(id=>all.find(p=>p.id===id)).filter(Boolean),...all.filter(p=>!(ps?.ids||[]).includes(p.id))];return order.slice(0,fielded(hangarLv,scale));}
// a briefing's enemy roster (blueprint §4: "Every briefing shows the enemy roster as icons with one hint line"): the operation's
// authored units (its garrison, waves and commander; never matched to anyone's gear) and the roles that answer them
const ENEMY=Object.freeze({raider:Object.freeze({n:'interceptor',light:1}),breacher:Object.freeze({n:'saboteur'}),sentinel:Object.freeze({n:'heavy sentinel',heavy:1}),command:Object.freeze({n:'fire coordinator',heavy:1}),drone:Object.freeze({n:'drone',light:1,air:1})});
const BOSS=Object.freeze({ambush:'ambush commander',shield:'shield commander',artillery:'artillery commander',carrier:'carrier commander',plasma:'plasma siege general'});
function enemyRoster(op){if(!op)return {units:[],hint:'',want:[]};const count={},add=(k,n=1)=>{count[k]=(count[k]||0)+n;};let boss=null;
 if(op.raid){const D=C.raidDoctrine[op.danger]||C.raidDoctrine.HARD;add('raider');add(op.layout==='ash-approach'?'sentinel':'command');D.garrison.forEach(k=>add(k));for(const w of D.waves)w.forEach(k=>add(k));
  if(op.family==='sabotage'||op.family==='battery')add('command',op.family==='battery'?2:1);if(op.family==='intercept')add('command');boss=op.family==='siege'?'plasma':op.commander;if(op.commander==='carrier'||op.hazard==='drone')add('drone',2);}
 else if(op.strike){add('raider',4);add('sentinel');add('command');}
 else if(op.defense||op.family==='base-defense'){add('raider',4);add('breacher',2);}
 else if(op.id===WINGMAN.id)add('raider',2);
 else if(op.id==='oxygen-line'){add('raider',3);add('sentinel');add('breacher');add('command');}
 else if(op.id==='rescue'){add('raider');add('breacher');add('command');}else if(op.id==='convoy')add('command',2);else if(op.id==='redoubt'){add('raider',2);add('command',2);add('sentinel');}else add('raider',2);
 if(op.id===WINGMAN.id)return {units:[{k:'raider',n:2,name:'interceptor',light:true,heavy:false,air:false}],want:[],hint:'2 interceptors guard the wreck. Clear them, then hold beside it for 4 seconds.'};   // a solo rescue: no roles to bring
 const units=Object.entries(count).map(([k,n])=>({k,n,name:ENEMY[k].n,heavy:!!ENEMY[k].heavy,light:!!ENEMY[k].light,air:!!ENEMY[k].air}));if(boss)units.push({k:'boss',n:1,name:BOSS[boss]||'commander',boss,heavy:1});
 const light=units.filter(u=>u.light&&!u.air).reduce((a,u)=>a+u.n,0),want=[];
 if(light>=3)want.push('frostline');if(units.some(u=>u.air)||op.hazard==='drone')want.push('lancer');if(op.family==='sabotage'||op.family==='battery'||boss==='shield')want.push('breacher');
 if(units.some(u=>u.heavy&&u.k!=='command')||boss==='plasma')want.push('corroder');if(op.danger==='VETERAN')want.push('guardian');if(op.defense||op.family==='base-defense'||op.family==='siege')want.push('mender');if(want.length<2)for(const r of ['guardian','lancer'])if(!want.includes(r)&&want.length<2)want.push(r);
 const say=u=>u.n>1?u.n+' '+u.name+'s':(/^[aeiou]/.test(u.name)?'an ':'a ')+u.name,list=units.slice(0,4).map(say),line=list.length>1?list.slice(0,-1).join(', ')+' and '+list.at(-1):list[0]||'';
 const roles=want.slice(0,2).map(r=>(r==='frostline'?'':/^[aeiou]/.test(r)?'an ':'a ')+ROLE_INFO[r].n);
 return {units,want:want.slice(0,2),hint:line?line[0].toUpperCase()+line.slice(1)+'. Bring '+roles.join(' and ')+'.':''};}
root.ConquestBattalion=Object.freeze({ROSTER_MAX,FIELD,SCALE,scaleOf,ROLES_AT,XP,FOUGHT_S,RANK_XP,RANK_NAMES,rankOf,sigTier,RC,strength,CHIP,RECRUIT,REPAIR,FORMATIONS,FORM_NAMES,PRESETS,ROLE_INFO,WINGMAN,identity,fieldCap,fielded,militia,autoArm,keyOf,spare,kitStats,force,picked,enemyRoster,u32});
})(globalThis);
