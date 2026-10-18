'use strict';
// =====================================================================
// rules: pure game data and stat math, shared by the phone and the PvP server
// (no save, no DOM: worker/build-sim.mjs bundles this file with game.js for the server)
// =====================================================================
const PVP_V=1;   // live-match protocol version: the phone and the server must agree
// ---- combat tuning ----
const STAT={hp:1700,speed:4.4,range:6,dps:70,shot:0.2,bspd:13,turn:3.4};
// mystery box buffs: each lasts until its holder takes BUFF_LIFE damage; same-stat buffs stack
const BUFF={dmg:{n:'DMG',c:'#ff6b5e',amt:0.4,txt:'+40% DAMAGE'},arm:{n:'ARM',c:'#5aa9ff',amt:0.35,txt:'+35% ARMOR'},rof:{n:'ROF',c:'#ffd24a',amt:0.4,txt:'+40% FIRE RATE'},spd:{n:'SPD',c:'#7be07b',amt:0.3,txt:'+30% SPEED'},lck:{n:'LCK',c:'#c28bff',amt:0.1,txt:'+10% CRIT CHANCE'},reg:{n:'REG',c:'#4be3a0',amt:0.003,txt:'+0.3% HP/SEC'}};
const BUFF_KEYS=Object.keys(BUFF);
const CRIT_BASE=0.1,CRIT_MULT=2,GRAZE=0.75,DIRECT=0.4;
const SUPER_MAX=1000,SUPER_LEN=14,FILL_DEALT=1,FILL_TAKEN=0.7,FILL_CRIT=60;
const BUFF_LIFE=780;
// core gems: socketed in the garage, permanent all game. Weaker than box buffs; they multiply with them.
const GEM={dmg:{n:'DMG',name:'Damage',c:'#ff6b5e',amt:0.12},rof:{n:'ROF',name:'Fire rate',c:'#ffd24a',amt:0.10},arm:{n:'ARM',name:'Armor',c:'#5aa9ff',amt:0.08},spd:{n:'SPD',name:'Speed',c:'#7be07b',amt:0.08},lck:{n:'LCK',name:'Luck',c:'#c28bff',amt:0.03},reg:{n:'REG',name:'Repair',c:'#4be3a0',amt:0.001}};
const GORDER=['dmg','rof','arm','spd','lck','reg'];
const GEM_LV=[1,1.2,1.45,1.8,2.25]; // Lv1..5
const gemLvMult=lv=>GEM_LV[Math.min(4,Math.max(0,(lv||1)-1))];
const coreVal=(k,lv)=>GEM[k].amt*gemLvMult(lv);
const UPS={
 hull:{n:'Hull',d:'+8% max health per level',c:'#5aa9ff',costs:[500,2000,5000,12500]},
 cannon:{n:'Cannon',d:'+8% damage per level',c:'#ff6b5e',costs:[500,2000,5000,12500]},
 engine:{n:'Engine',d:'+6% speed per level',c:'#7be07b',costs:[500,2000,5000,12500]},
 target:{n:'Targeting',d:'+2% crit chance per level',c:'#c28bff',costs:[500,2000,5000,12500]},
 reactor:{n:'Reactor',d:'+10% super charge per level',c:'#ffd24a',costs:[500,2000,5000,12500]}};
const UORDER=['hull','cannon','engine','target','reactor'];
// ---- chassis classes & weapons ----
const CH={
 scout:{n:'Scout',d:'Fast and agile',hp:0.8,spd:1.25,turn:1.15,ds:0.9,c:'#7be07b'},
 vanguard:{n:'Vanguard',d:'Balanced all-rounder',hp:1.0,spd:1.0,turn:1.0,ds:1.0,c:'#3fd0c9'},
 titan:{n:'Titan',d:'Slow, very tanky',hp:1.35,spd:0.85,turn:0.9,ds:1.12,c:'#c28bff'}};
const CHORDER=['scout','vanguard','titan'];
// counter triangle: Scout beats Titan, Titan beats Vanguard, Vanguard beats Scout (+15% damage dealt, 10% less taken)
const COUNTER={scout:'titan',titan:'vanguard',vanguard:'scout'},COUNTER_BONUS=0.15,COUNTER_RES=0.10;
const cmult=(a,d)=>{if(!a||!d||!a.cls||!d.cls)return 1;
 if(COUNTER[a.cls]===d.cls)return 1+COUNTER_BONUS;
 if(COUNTER[d.cls]===a.cls)return 1-COUNTER_RES;
 return 1;};
const beatenBy=c=>Object.keys(COUNTER).find(k=>COUNTER[k]===c);
const WEAPONS={
 pulse:{n:'Pulse Cannon',d:'Balanced gun',dps:70,shot:0.2,c:'#3fd0c9',sup:'Pierce Lance'},
 twin:{n:'Twin Repeater',d:'Fast, light hits',dps:66,shot:0.09,c:'#ffd24a',sup:'Static Nova'},
 siege:{n:'Siege Breaker',d:'Slow, heavy hits',dps:74,shot:0.45,c:'#ff6b5e',sup:'Siege Blast'},
 moon:{n:'Moonbeam',d:'Lunar precision laser',dps:72,shot:0.12,c:'#e8f4ff',sup:'Moonfall',premium:true}};
const WORDER=['pulse','twin','siege'];
const TIER_MULT=[1.0,1.10,1.32];
// Crate items roll 105-110% of their rarity; salvaged items store their own multiplier.
const ROLL_MIN=1.05,ROLL_MAX=1.10;
const SALV_MIN={1:1.010,2:1.031},SALV_MAX={1:1.030,2:1.044};
// ---- paints: looks only, no stats. Your team color still shows on the tracks, turret core and health bar ----
const PAINTS={
 stock:{n:'Stock',hull:'#2c3a49',tur:'#3b4a5b',trim:'#d5dee7'},
 regolith:{n:'Regolith',hull:'#565a62',tur:'#6a6f79',trim:'#d8c49a',pass:'free'},
 eclipse:{n:'Eclipse',hull:'#17131f',tur:'#251e31',trim:'#ff9a55',pass:'prem'},
 aurora:{n:'Aurora',hull:'#15393a',tur:'#1f4e50',trim:'#7be3e0',pass:'prem'},
 nebula:{n:'Nebula',hull:'#35255a',tur:'#463271',trim:'#c79bff',ton:2.4,stars:150},
 ember:{n:'Ember',hull:'#5a2418',tur:'#73301f',trim:'#ff9a55',ton:2.4,stars:150},
 arctic:{n:'Arctic',hull:'#a9b6c8',tur:'#c2ccd9',trim:'#ffffff',ton:2.4,stars:150},
 venom:{n:'Venom',hull:'#1d3b21',tur:'#28502d',trim:'#7be07b',ton:2.4,stars:150},
 gold:{n:'Gold plate',hull:'#7a5c16',tur:'#9a7720',trim:'#ffe08a',ton:4.8,stars:300,shine:true},
 void:{n:'Void',hull:'#07080d',tur:'#121522',trim:'#4d9fff',ton:4.8,stars:300,shine:true}};
// ---- featured mode: one mode a day pays +25% and gets a live queue ----
const FEATURE_ROT=['crystal','royale','bounty','crystal','bounty','royale','zone'],FEATURED_X=1.25;   // by UTC day; season 1 opens with Crystal Rush
const featuredOn=day=>FEATURE_ROT[((day%7)+7)%7];
const LIVE_BASE=['arena','zone'];   // always live; the featured mode joins them each day. Other modes stay vs AI
const liveModes=day=>LIVE_BASE.includes(featuredOn(day))?LIVE_BASE.slice():LIVE_BASE.concat(featuredOn(day));
// ---- match modes: team sizes, game types and what they pay (the PvP server scores with these too) ----
const MODES={
 '1v1':{n:1,label:'1v1',win:125,draw:60,loss:30},
 '2v2':{n:2,label:'2v2',win:200,draw:100,loss:50},
 '3v3':{n:3,label:'3v3',win:300,draw:150,loss:75}};
const ZONE_X={'1v1':3,'2v2':2,'3v3':1.5};   // Moon Zone runs ~4x longer, so it pays more per match
// Game types. The rules are data, so a PvP server or a 3D client can run the same matches.
// t: time limit (s). respawn: tanks come back after dying. x: pay multiplier per team size (longer matches pay more per match,
// so points per minute stay level across modes). solo: free for all with that many tanks, no teams.
// Every mode plays against AI pilots; Arena, Moon Zone and the featured mode also have live queues (real players take the seats).
const GTYPES={
 arena:{label:'Arena',d:'Destroy the enemy team',t:180},
 zone:{label:'Moon Zone',d:'Hold the moving zone. First to 100.',t:180,respawn:true,x:ZONE_X},
 crystal:{label:'Crystal Rush',d:'Grab crystals from the mine. Hold 10 for 15 seconds to win.',t:180,respawn:true,x:{'1v1':3,'2v2':2,'3v3':1.5}},
 bounty:{label:'Bounty',d:'Kills earn stars. Every kill raises your bounty.',t:120,respawn:true,x:{'1v1':3.5,'2v2':2.25,'3v3':1.5}},
 royale:{label:'Last Standing',d:'6 tanks, 1 survivor. Stay inside the ring.',t:150,solo:6}};
const GT_ORDER=['arena','zone','crystal','bounty','royale'];
const GT_PICK={...GTYPES,random:{label:'Random',d:'A different mode every match'}};   // what the selector shows; Random resolves at match start
const ROYALE_PTS=[260,200,140,100,60,30],ROYALE_HP=2,BTY_HP=0.5,BTY_RESPAWN=3;   // Last Standing pays by place, 1st to 6th. Bounty: lighter tanks and quick respawns, so kills keep coming
const isSolo=gk=>!!(GTYPES[gk]&&GTYPES[gk].solo);
function winBase(gk,mk){   // points for a win before the league multiplier, featured bonus and streak
 if(isSolo(gk))return ROYALE_PTS[0];
 const M=MODES[mk];return Math.round(M.win*(gk==='arena'?(mk==='1v1'?SERIES_X:1):GTYPES[gk].x[mk]));
}
// 1v1 Arena is a best of 3: first to 2 round wins pays ×2. A drawn round doesn't count (5 rounds at most)
const SERIES_X=2,ROUND_T=90;
// LEAGUE (by gear power): who you get matched against + point multiplier. Not the same as your TIER (lifetime points).
const LEAGUES=['ROOKIE','PILOT','ACE','ELITE','LEGEND'];
function powerBracket(pw){
 if(pw<150)return {n:'Rookie',key:'ROOKIE',mult:1.0,c:'#9fb0c2',i:0};
 if(pw<250)return {n:'Pilot',key:'PILOT',mult:1.25,c:'#6fcf97',i:1};
 if(pw<400)return {n:'Ace',key:'ACE',mult:1.5,c:'#4d9fff',i:2};
 if(pw<600)return {n:'Elite',key:'ELITE',mult:1.75,c:'#ff9d3c',i:3};
 return {n:'Legend',key:'LEGEND',mult:2.0,c:'#ff4d6d',i:4};
}
// ---- gear and tank stats from a loadout ----
// A loadout is everything that sets a tank's stats: {w:{a,t,q,s}, c:{c,t,q,s}, up:{hull..reactor}, cores:[3], gl:{gem levels}, skin, paint}
// t = rarity (-1 stock, 0 common, 1 rare, 2 epic), q = crate roll (1.05-1.10, 1 for starter gear) or the salvage multiplier, s = salvaged
function weaponOf(arch,t,q,sal){
 if(arch==='moon'){const b=WEAPONS.moon;return {arch:'moon',tier:2,dps:b.dps,shot:b.shot,pspd:26,premium:true,mult:TIER_MULT[2],q:1,sal:false};}
 const tc=Math.max(0,t|0),b=WEAPONS[arch]||WEAPONS.pulse,mt=sal?q:TIER_MULT[tc]*q;
 return {arch,tier:t,sal:!!sal,q,mult:mt,dps:Math.round(b.dps*mt),shot:b.shot,pspd:22+2*tc};
}
function chassisOf(cls,t,q,sal){
 const tc=Math.max(0,t|0),b=CH[cls]||CH.vanguard,mt=sal?q:TIER_MULT[tc]*q;
 return {cls,tier:t,sal:!!sal,q,mult:mt,hp:Math.round(b.hp*mt*100)/100,spd:Math.round(b.spd*(1+(mt-1)*0.5)*100)/100,turn:Math.round((b.turn+0.05*tc)*100)/100,size:b.ds};
}
const auraOf=it=>it.premium?3:it.sal?0:Math.max(0,it.tier);   // rarity ring under the tank: none, rare, epic, legendary
function powerOf(L){
 const U=L.up,W=weaponOf(L.w.a,L.w.t,L.w.q,L.w.s),Cc=chassisOf(L.c.c,L.c.t,L.c.q,L.c.s),skinM=L.skin==='lunar'?1.08:1;
 const hp=STAT.hp*(1+0.08*U.hull)*Cc.hp*skinM,dps=W.dps*(1+0.08*U.cannon)*skinM,spd=(1+0.06*U.engine)*Cc.spd;
 let coreM=1;for(const c of (L.cores||[]))if(c){const lv=(L.gl&&L.gl[c])||1;coreM*=(1+0.05*lv);}
 return Math.round(Math.pow(hp*dps*spd,1/3)*coreM*1.2);   // starter ≈ 72-100
}
const STOCK_L={w:{a:'pulse',t:0,q:1,s:false},c:{c:'vanguard',t:0,q:1,s:false},up:{hull:0,cannon:0,engine:0,target:0,reactor:0},cores:['dmg','rof','arm'],gl:{},skin:'default',paint:'stock'};   // a new pilot's tank
// the stat block a tank fights with (n = health scale for the mode and team size)
function tankOf(L,n){
 const U=L.up,W0=weaponOf(L.w.a,L.w.t,L.w.q,L.w.s),Cc=chassisOf(L.c.c,L.c.t,L.c.q,L.c.s),skin=L.skin==='lunar'?1.08:1;
 return {gems:(L.cores||[]).filter(Boolean),gemM:Object.fromEntries(GORDER.map(k=>[k,gemLvMult(L.gl&&L.gl[k])])),
  mhp:Math.round(STAT.hp*(1+0.08*U.hull)*Cc.hp*skin*n),dmgM:(1+0.08*U.cannon)*skin,spdM:(1+0.06*U.engine)*Cc.spd,
  critB:0.02*U.target,fillM:1+0.10*U.reactor,turnM:Cc.turn,
  wtype:W0.arch,wdps:W0.dps,wshot:W0.shot,wpspd:W0.pspd,wtier:W0.tier,wmult:W0.mult,chm:Cc.mult,dscale:Cc.size,cls:Cc.cls,
  aura:Math.max(auraOf(W0),auraOf(Cc)),paint:PAINTS[L.paint]?L.paint:'stock',skin:L.skin==='lunar'?'lunar':'default'};
}
