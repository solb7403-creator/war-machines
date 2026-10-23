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
// Build budget: 4 levels per stat, at most 14 levels across all five (3.5 stats maxed), spread however you like.
// Reset build: every level goes back to 0 and you get half the points they cost back (the other half is gone)
const BUILD_MAX=14,RESPEC_BACK=0.5;
const upLevels=U=>UORDER.reduce((a,k)=>a+((U&&U[k])|0),0);
const upInvested=U=>UORDER.reduce((a,k)=>{let s=0;for(let i=0;i<((U&&U[k])|0);i++)s+=UPS[k].costs[i];return a+s;},0);
// ---- chassis classes & weapons ----
const CH={
 scout:{n:'Scout',d:'Fast and agile',hp:0.8,spd:1.25,turn:1.15,ds:0.9,c:'#7be07b'},
 vanguard:{n:'Vanguard',d:'Balanced all-rounder',hp:1.0,spd:1.0,turn:1.0,ds:1.0,c:'#3fd0c9'},
 titan:{n:'Titan',d:'Slow, very tanky',hp:1.35,spd:0.85,turn:0.9,ds:1.12,c:'#c28bff'}};
const CHORDER=['scout','vanguard','titan'];
// counter triangle: Scout beats Titan, Titan beats Vanguard, Vanguard beats Scout (+15% damage dealt, 10% less taken)
const COUNTER={scout:'titan',titan:'vanguard',vanguard:'scout'},COUNTER_BONUS=0.15,COUNTER_RES=0.10;
const cmult=(a,d)=>{if(!a||!d||!a.cls||!d.cls||a.boss||d.boss)return 1;
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
 void:{n:'Void',hull:'#07080d',tur:'#121522',trim:'#4d9fff',ton:4.8,stars:300,shine:true},
 founder:{n:'Founder',hull:'#aab2c0',tur:'#d3d9e3',trim:'#ffcf4a',shine:true,only:'founder'}};   // Founder pack only, never sold on its own
// ---- featured mode: one mode a day pays +25% and gets a live queue ----
const FEATURE_ROT=['crystal','royale','bounty','crystal','bounty','royale','zone'],FEATURED_X=1.25;   // by UTC day; season 1 opens with Crystal Rush
const featuredOn=day=>FEATURE_ROT[((day%7)+7)%7];
const LIVE_BASE=['arena','zone'];   // always live; the featured mode joins them each day. Other modes stay vs AI
const liveModes=day=>LIVE_BASE.includes(featuredOn(day))?LIVE_BASE.slice():LIVE_BASE.concat(featuredOn(day));
// ---- deals, per pilot: the first rare or epic gem cache each UTC day is 30% off; one epic crate (any kind) each UTC week is 25% off.
// Every currency. The server tracks Stars use (deals/<pid>) and only then allows the lower price
const DEAL_D_OFF=0.3,DEAL_W_OFF=0.25;
// ---- Founder pack: one per pilot, sold only until $LUNAR launches (set to false at launch; the server stops selling it too) ----
const FOUNDER_OPEN=true;
// ---- match modes: team sizes, game types and what they pay (the PvP server scores with these too) ----
const MODES={
 '1v1':{n:1,label:'1v1',win:125,draw:60,loss:30},
 '2v2':{n:2,label:'2v2',win:200,draw:100,loss:50},
 '3v3':{n:3,label:'3v3',win:300,draw:150,loss:75}};
const ZONE_X={'1v1':3,'2v2':2.4,'3v3':2.1};   // Moon Zone runs ~4x longer, so it pays more per match
// Game types. The rules are data, so a PvP server or a 3D client can run the same matches.
// t: time limit (s). respawn: tanks come back after dying. x: pay multiplier per team size (longer matches pay more per match,
// so points per minute stay level across modes). solo: free for all with that many tanks, no teams.
// Every mode plays against AI pilots; Arena, Moon Zone and the featured mode also have live queues (real players take the seats).
const GTYPES={
 arena:{label:'Arena',d:'Destroy the enemy team',t:180,x:{'1v1':1,'2v2':1.6,'3v3':1.4}},
 zone:{label:'Moon Zone',d:'Hold the moving zone. First to 100.',t:180,respawn:true,x:ZONE_X},
 crystal:{label:'Crystal Rush',d:'Grab crystals from the mine. Hold 10 for 15 seconds to win.',t:180,respawn:true,x:{'1v1':3,'2v2':2.4,'3v3':2.1}},
 bounty:{label:'Bounty',d:'Kills earn stars. Every kill raises your bounty.',t:120,respawn:true,x:{'1v1':3.5,'2v2':2.8,'3v3':2.4}},
 royale:{label:'Last Standing',d:'6 tanks, 1 survivor. Stay inside the ring.',t:150,solo:6},
 boss:{label:'Survival',d:'A megatank hunts your team. Destroy it to win; survive the clock for a draw.',t:180,boss:true,x:{'1v1':3,'2v2':2.4,'3v3':2.1}}};
const GT_ORDER=['arena','zone','crystal','bounty','royale','boss'];
const GT_PICK={...GTYPES,random:{label:'Random',d:'A different mode every match'}};   // what the selector shows; Random resolves at match start
const ROYALE_PTS=[900,600,400,200,100,50],ROYALE_HP=2,BTY_HP=0.5,BTY_RESPAWN=3;   // Last Standing pays by place, 1st to 6th. Bounty: lighter tanks and quick respawns, so kills keep coming
const isSolo=gk=>!!(GTYPES[gk]&&GTYPES[gk].solo);
function winBase(gk,mk){   // points for a win before the league multiplier, featured bonus and streak
 if(isSolo(gk))return ROYALE_PTS[0];
 return Math.round(MODES[mk].win*teamX(gk,mk,true));
}
// pay multiplier for a game type and team size. Every step up in team size pays at least 25% more per match, for wins, draws and losses
function teamX(gk,mk,series){
 if(isSolo(gk))return 1;
 return GTYPES[gk].x[mk]*(gk==='arena'&&mk==='1v1'&&series?SERIES_X:1);
}
// win streak bonus (+20 a win, up to 5 wins). Scaled like the win pay, so a bigger team still pays at least 25% more with a streak
function streakPts(gk,mk,streak){
 const n=Math.min(streak,5)*20;
 if(isSolo(gk))return n;
 return Math.round(n*winBase(gk,mk)/winBase(gk,'1v1'));
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

// =====================================================================
// economy: points, quests, login streak, Lunar Pass, crates, upgrades, squad payouts, purchases.
// Pure functions over an economy state S (same field names as the phone's save). In Telegram only the server runs
// them, so only the server can change a pilot's points and gear; outside Telegram the phone runs them for local play.
// X = {day, week, rnd, pk}: UTC day and week numbers, a random source (0..1), the player id (picks the dailies)
// =====================================================================
const DAILY_CAP=20000;   // max points a pilot can bank per UTC day
const WIKI_URL='https://solb7403-creator.github.io/war-machines/wiki.html';
const X_URL='https://x.com/thelunarmeme';   // X/Twitter profile
const TG_URL='https://t.me/LUNARmemecoin';   // Telegram news channel
const LINKS={wiki:WIKI_URL,x:X_URL,tg:TG_URL};
// tiers (lifetime points) and their daily login bonus
const TIERS=['Bronze','Silver','Gold','Platinum','Diamond'],TPTS=[0,10000,50000,150000,400000],TDAILY=[25,50,100,200,400];
const tierOfPts=p=>{let t=0;for(let i=0;i<TPTS.length;i++)if((p||0)>=TPTS[i])t=i;return t;};
const SHARD_NEED={1:3,2:6,3:10,4:15};   // shards to take a core from level L to L+1
const SALV_PTS=[0,10000,20000],TUNE_PTS=[3000,10000,30000],DUP_PTS=[50,150,400];   // DUP_PTS: a crate roll that doesn't beat what you have
// shop prices (the server charges these; TON, Stars, points)
const RPRICE=[4,8,23],RSTARS=[250,500,1500],RPTS=[20000,80000,0];
const STARTER={ton:6,stars:399},FOUNDER={ton:19,stars:1199},MOONBEAM_PRICE=50,SKIN_PRICE=30;
const PREMIUM={moonbeam:{ton:50,stars:3300},skin:{ton:30,stars:2000},starter:STARTER,founder:FOUNDER};
// milestone quests (one-time)
const QUESTS=[
 {id:'q_win1',n:'First blood',d:'Win your first match',pts:50,goal:1},
 {id:'q_win3',n:'Warmonger',d:'Win 3 matches',pts:150,goal:3},
 {id:'q_dmg',n:'Heavy hitter',d:'Deal 2,500 damage in one match',pts:100,goal:2500},
 {id:'q_super',n:'Overcharged',d:'Fire your super twice in one match',pts:100,goal:2},
 {id:'q_box',n:'Scavenger',d:'Grab 3 mystery boxes in one match',pts:75,goal:3},
 {id:'q_clean',n:'Untouchable',d:'Win a match without dropping below 75% health',pts:250,goal:1},
 {id:'q_wiki',n:'Read the wiki',d:'How to play, the airdrop and tokenomics',pts:200,goal:1,link:'wiki'},
 {id:'q_x',n:'Follow on X',d:'Updates and announcements',pts:50,goal:1,link:'x'},
 {id:'q_tg',n:'Join the channel',d:'Airdrop news first',pts:50,goal:1,link:'tg'}].filter(q=>!q.link||LINKS[q.link]);
const MS_BY={};QUESTS.forEach(q=>MS_BY[q.id]=q);
// daily quests: 4 a day (2 easy, 1 medium, 1 hard), picked per player per day; finish all 4 for a bonus.
// 1 free swap a day (2 with the premium pass). Weekly: 5 quests a week, plus a chest for claiming 20 dailies.
// Your login streak boosts every quest's points (ecoBoost). Stats come from each finished match (ecoAfterMatch).
const DQ_POOL=[
 {id:'play4',lv:0,t:'Play 4 matches',goal:4,pts:100,st:'plays'},
 {id:'win2',lv:0,t:'Win 2 matches',goal:2,pts:120,st:'wins'},
 {id:'box3',lv:0,t:'Grab 3 mystery boxes',goal:3,pts:100,st:'boxes'},
 {id:'sup3',lv:0,t:'Fire 3 supers',goal:3,pts:100,st:'sups'},
 {id:'dmg6k',lv:0,t:'Deal 6,000 damage',goal:6000,pts:100,st:'dmg'},
 {id:'kill4',lv:0,t:'Destroy 4 enemy tanks',goal:4,pts:100,st:'kills'},
 {id:'feat1',lv:0,t:'Play a featured-mode match',goal:1,pts:100,st:'featured'},
 {id:'quick1',lv:0,t:'Play a Quick Match',goal:1,pts:100,st:'quick'},
 {id:'win4',lv:1,t:'Win 4 matches',goal:4,pts:180,st:'wins'},
 {id:'kill10',lv:1,t:'Destroy 10 enemy tanks',goal:10,pts:170,st:'kills'},
 {id:'dmg15k',lv:1,t:'Deal 15,000 damage',goal:15000,pts:170,st:'dmg'},
 {id:'kill4m',lv:1,t:'Destroy 4 tanks in one match',goal:4,pts:180,st:'kills',mx:1},
 {id:'nodie',lv:1,t:'Win without being destroyed',goal:1,pts:170,st:'cleanWins'},
 {id:'zwin',lv:1,t:'Win a Moon Zone match',goal:1,pts:160,st:'zoneWins'},
 {id:'cap3',lv:1,t:'Capture the Moon Zone 3 times',goal:3,pts:160,st:'caps'},
 {id:'cry10',lv:1,t:'Collect 10 crystals in Crystal Rush',goal:10,pts:160,st:'crystals'},
 {id:'bnt5',lv:1,t:'Earn 5 bounty stars',goal:5,pts:160,st:'stars'},
 {id:'top3',lv:1,t:'Finish top 3 in Last Standing',goal:1,pts:160,st:'top3'},
 {id:'twin',lv:1,t:'Win a 2v2 or 3v3 match',goal:1,pts:160,st:'teamWins'},
 {id:'ovpw',lv:1,t:'Win a match on Overpass',goal:1,pts:160,st:'ovpWins'},
 {id:'win6',lv:2,t:'Win 6 matches',goal:6,pts:280,st:'wins'},
 {id:'row3',lv:2,t:'Win 3 matches in a row',goal:3,pts:280,st:'streak',mx:1},
 {id:'nodie2',lv:2,t:'Win 2 matches without being destroyed',goal:2,pts:280,st:'cleanWins'},
 {id:'sweep',lv:2,t:'Win a 1v1 Arena match 2-0',goal:1,pts:260,st:'sweeps'},
 {id:'ls1',lv:2,t:'Win a Last Standing match',goal:1,pts:300,st:'royaleWins'},
 {id:'featw3',lv:2,t:'Win 3 featured-mode matches',goal:3,pts:260,st:'featWins'},
 {id:'bntw2',lv:2,t:'Win 2 Bounty matches',goal:2,pts:260,st:'bountyWins'},
 {id:'cryw2',lv:2,t:'Win 2 Crystal Rush matches',goal:2,pts:260,st:'crystalWins'}];
const DQ_SLOTS=[0,0,1,2],DQ_LV=['Easy','Medium','Hard'],DQ_ALL_BONUS=250,DQ_SWAPS=1;
// Weekly quests are the same for every pilot: the first WQ_FIXED every week, plus WQ_N-WQ_FIXED picked by the week.
// u: counts different values (days played, modes won), not a total. mx: best single match (or current win streak).
// pd: on how many different days you reached pd of it (N a day on M days); goal counts days
const WQ_POOL=[
 {id:'wdays',t:'Play on 5 different days',goal:5,pts:1500,st:'day',u:1},
 {id:'wquick30',t:'Play 30 Quick Matches',goal:30,pts:3750,st:'quick'},
 {id:'wwin20',t:'Win 20 matches',goal:20,pts:1250,st:'wins'},
 {id:'wplay35',t:'Play 35 matches',goal:35,pts:1000,st:'plays'},
 {id:'wkill50',t:'Destroy 50 enemy tanks',goal:50,pts:1000,st:'kills'},
 {id:'wdmg',t:'Deal 80,000 damage',goal:80000,pts:1000,st:'dmg'},
 {id:'wmodes',t:'Win in 4 different modes',goal:4,pts:1000,st:'winMode',u:1},
 {id:'wzone6',t:'Win 6 Moon Zone matches',goal:6,pts:1000,st:'zoneWins'},
 {id:'wteam8',t:'Win 8 team matches (2v2 or 3v3)',goal:8,pts:1000,st:'teamWins'},
 {id:'wls3d',t:'Win Last Standing on 3 different days',goal:3,pts:2000,st:'royaleWins',pd:1},
 {id:'wrow5',t:'Win 5 matches in a row',goal:5,pts:1250,st:'streak',mx:1},
 {id:'wfeat16',t:'Play 16 featured-mode matches',goal:16,pts:2000,st:'featured'},
 {id:'wsup60',t:'Fire 60 supers',goal:60,pts:1800,st:'sups'},
 {id:'wbox30',t:'Grab 30 mystery boxes',goal:30,pts:750,st:'boxes'},
 {id:'wclean4d',t:'Win 2 matches without being destroyed on 4 different days',goal:4,pts:1600,st:'cleanWins',pd:2},
 {id:'wcap30',t:'Capture the Moon Zone 30 times',goal:30,pts:2000,st:'caps'}];
const WQ_N=5,WQ_FIXED=2,PASS_XP_WQ=150,WQ_GOAL=20,WQ_PTS=2000;   // WQ_GOAL dailies open the weekly chest
// weekly quests from before Oct 19, 2026 (per-pilot lists): kept only so a list started that week still shows. Safe to delete after Oct 26
const WQ_OLD=[{id:'wls2',t:'Win 2 Last Standing matches',goal:2,pts:1250,st:'royaleWins'},{id:'wquick8',t:'Play 8 Quick Matches',goal:8,pts:1000,st:'quick'},
 {id:'wfeat8',t:'Play 8 featured-mode matches',goal:8,pts:1000,st:'featured'},{id:'wsup25',t:'Fire 25 supers',goal:25,pts:750,st:'sups'},
 {id:'wclean5',t:'Win 5 matches without being destroyed',goal:5,pts:1000,st:'cleanWins'},{id:'wcap15',t:'Capture the Moon Zone 15 times',goal:15,pts:1000,st:'caps'}];
const DQ_BY={},WQ_BY={};DQ_POOL.forEach(q=>DQ_BY[q.id]=q);WQ_POOL.concat(WQ_OLD).forEach(q=>WQ_BY[q.id]=q);
// login streak bonus on quest points: day 2 of your streak +5%, up to +30% from day 7. Counts once today's daily reward is claimed
const QB_STEP=0.05,QB_MAX=0.3;
const streakBoost=n=>Math.min(QB_MAX,QB_STEP*Math.max(0,n-1));
// Lunar Pass: a 28-day season with 30 tiers. Free track for everyone, premium track for pass owners.
// The premium track never gives points, so buying it can't buy leaderboard rank (the airdrop stays earned).
const PASS_LEN=28,PASS_TIERS=30,PASS_XP=350,PASS_START=20744,PASS_PRICE={ton:13,stars:799};   // season 1 starts Oct 18, 2026 (UTC day 20744)
const PASS_XP_WIN=40,PASS_XP_DRAW=25,PASS_XP_LOSS=20,PASS_XP_FEAT=10,PASS_XP_QUEST=50,PASS_XP_ALL=100;
const PASS_FREE=[null,{k:'pts',n:150},{k:'box',tk:'gem',ri:0},{k:'pts',n:150},{k:'pts',n:200},{k:'box',tk:'weapon',ri:0},{k:'pts',n:200},{k:'box',tk:'gem',ri:0},{k:'pts',n:250},{k:'pts',n:250},{k:'box',tk:'chassis',ri:0},
 {k:'pts',n:250},{k:'box',tk:'gem',ri:0},{k:'pts',n:300},{k:'pts',n:300},{k:'box',tk:'gem',ri:1},{k:'pts',n:300},{k:'box',tk:'gem',ri:0},{k:'pts',n:350},{k:'pts',n:350},{k:'box',tk:'weapon',ri:0},
 {k:'pts',n:350},{k:'box',tk:'gem',ri:0},{k:'pts',n:400},{k:'pts',n:400},{k:'box',tk:'gem',ri:1},{k:'pts',n:400},{k:'box',tk:'gem',ri:0},{k:'pts',n:500},{k:'pts',n:500},{k:'paint',id:'regolith'}];
const PASS_PREM=[null,{k:'paint',id:'eclipse'},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'weapon',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:1},
 {k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'chassis',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'paint',id:'aurora'},
 {k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'weapon',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'chassis',ri:2}];
// daily login reward: 7-day streak calendar (misses reset it) + tier bonus
const STREAK_PTS=[100,150,200,250,300,400,1000];
// squad (referrals): you get paid when your recruits keep playing
const REF_MS=[{days:2,pts:1500,r:500,n:'Comes back the next day'},{days:5,pts:5000,r:2000,n:'5 days active, 5K points'},{days:10,pts:20000,r:5000,n:'10 days active, 20K points'}];
const REF_PCT=0.05,REF_WELCOME=1000,REF_PCT_CAP=2000;   // 5% of recruits' points, max 2,000/day from the % part

function rng32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

// what the server owns (the phone copies these from every server reply)
const ECO_KEYS=['pts','earned','dailyPts','weeklyPts','dailyDay','weeklyNum','days','sk','ld','fd','up','gemLvl','gemShards','wOwn','cOwn','roll','salv',
 'paints','skin','moonbeam','starter','founder','pass','dq','wk','wq','q','login','streak','buys','dealD','dealW','refC','refPD','refWelcome','wins','losses','mp','ptsSpent','spendGram'];
const listOf=v=>Array.isArray(v)?v.filter(x=>x!==null&&x!==undefined):v&&typeof v==='object'?Object.values(v):[];
// fill in anything missing: new pilots, old saves, and database copies (the database drops empty lists and objects)
function ecoNorm(S){
 const obj=k=>{if(!S[k]||typeof S[k]!=='object'||Array.isArray(S[k]))S[k]={};return S[k];};
 for(const k of ['pts','earned','dailyPts','weeklyPts','streak','wins','losses','mp','ptsSpent','spendGram','days','sk'])if(typeof S[k]!=='number'||!Number.isFinite(S[k]))S[k]=k==='earned'?(Number(S.pts)||0):0;
 const up=obj('up');for(const k of UORDER)up[k]=Math.max(0,Math.min(4,up[k]|0));
 // over the build budget (levels bought before it existed): the top levels come off, paid back in full
 while(upLevels(up)>BUILD_MAX){let k=UORDER[0];for(const j of UORDER)if(up[j]>=up[k])k=j;up[k]--;S.pts+=UPS[k].costs[up[k]];S.ptsSpent=Math.max(0,S.ptsSpent-UPS[k].costs[up[k]]);}
 const gl=obj('gemLvl'),gs=obj('gemShards');for(const k of GORDER){gl[k]=Math.max(1,Math.min(5,gl[k]|0||1));gs[k]=Math.max(0,gs[k]|0);}
 const wo=obj('wOwn'),co=obj('cOwn');
 for(const k of WORDER)wo[k]=[...new Set(listOf(wo[k]).map(Number).filter(t=>t>=0&&t<=2))];
 for(const k of CHORDER)co[k]=[...new Set(listOf(co[k]).map(Number).filter(t=>t>=0&&t<=2))];
 for(const k in wo)if(!WORDER.includes(k))delete wo[k];for(const k in co)if(!CHORDER.includes(k))delete co[k];
 if(!wo.pulse.includes(0))wo.pulse.unshift(0);if(!co.vanguard.includes(0))co.vanguard.unshift(0);   // starter gear
 obj('roll');obj('salv');obj('q');obj('buys');obj('refC');const pa=obj('paints');pa.stock=1;
 if(S.skin!=='lunar')S.skin='default';S.moonbeam=!!S.moonbeam;S.starter=!!S.starter;S.founder=!!S.founder;
 if(S.dq&&typeof S.dq==='object'){S.dq.ids=listOf(S.dq.ids);S.dq.p=S.dq.p||{};S.dq.c=S.dq.c||{};S.dq.was=listOf(S.dq.was);}
 if(S.wk&&typeof S.wk==='object'){S.wk.ids=listOf(S.wk.ids);S.wk.p=S.wk.p||{};S.wk.u=S.wk.u||{};S.wk.c=S.wk.c||{};for(const id in S.wk.u)S.wk.u[id]=listOf(S.wk.u[id]);}
 if(S.pass&&typeof S.pass==='object'){S.pass.cf=listOf(S.pass.cf);S.pass.cp=listOf(S.pass.cp);S.pass.xp=Number(S.pass.xp)||0;S.pass.prem=!!S.pass.prem;}
 return S;
}
// ---- gear in the state ----
const hasW=(S,k,t)=>!!(S.wOwn&&S.wOwn[k]&&S.wOwn[k].indexOf(t)>=0);
const hasC=(S,k,t)=>!!(S.cOwn&&S.cOwn[k]&&S.cOwn[k].indexOf(t)>=0);
const rollIn=(S,k,t)=>(S.roll&&S.roll[k+':'+t])||1;
const salvIn=(S,k,t)=>{const v=S.salv&&S.salv[k+':'+t];return v?(v<1?SALV_MIN[t]||1.01:v):0;};   // old saves stored a fraction
const gearMultIn=(S,k,t,sal)=>sal?salvIn(S,k,t):TIER_MULT[t]*rollIn(S,k,t);
function bestOf(S,isW,k){   // the strongest version of a weapon or chassis line the pilot owns (crate or salvaged), or null
 let best=null;
 for(const t of ((isW?S.wOwn:S.cOwn)[k]||[])){const m=gearMultIn(S,k,t,false);if(!best||m>best.m)best={t,s:false,m};}
 for(const t of [1,2])if(salvIn(S,k,t)){const m=gearMultIn(S,k,t,true);if(!best||m>best.m)best={t,s:true,m};}
 return best;
}
// The loadout a pilot can actually field: gear they own (with the recorded rolls) and their recorded upgrade and core levels.
// Gear they don't own falls back to the best version of that line they do own, then to starter gear.
function ecoLoadout(S,L0){
 L0=L0&&typeof L0==='object'?L0:{};
 const pick=(isW,x)=>{
  x=x&&typeof x==='object'?x:{};
  if(isW&&x.a==='moon'&&S.moonbeam)return {a:'moon',t:2,q:1,s:false};
  const keys=isW?WORDER:CHORDER;let k=isW?x.a:x.c;if(!keys.includes(k))k=isW?'pulse':'vanguard';
  let t=Math.round(Number(x.t)),s=!!x.s&&t>=1;
  const owns=s?salvIn(S,k,t)>0:(isW?hasW(S,k,t):hasC(S,k,t));
  if(!(t>=0&&t<=2)||!owns){const b=bestOf(S,isW,k);if(b){t=b.t;s=b.s;}else{k=isW?'pulse':'vanguard';t=0;s=false;}}
  const q=Math.round((s?salvIn(S,k,t):rollIn(S,k,t))*1000)/1000;
  return isW?{a:k,t,q,s}:{c:k,t,q,s};
 };
 const w=pick(true,L0.w),c=pick(false,L0.c);
 const seen={},cores=[0,1,2].map(i=>{const k=L0.cores&&L0.cores[i];if(!GEM[k]||seen[k])return null;seen[k]=1;return k;});
 const chs=CHORDER.filter(k=>bestOf(S,false,k)).map(k=>k===c.c?{...c}:pick(false,{c:k,t:-9}));
 const paint=PAINTS[L0.paint]&&S.paints&&S.paints[L0.paint]?L0.paint:'stock';
 return {w,c,up:{...S.up},cores,gl:{...S.gemLvl},skin:S.skin==='lunar'?'lunar':'default',paint,chs};
}
// ---- points ----
function ecoRoll(S,X){if(S.dailyDay!==X.day){S.dailyDay=X.day;S.dailyPts=0;}if(S.weeklyNum!==X.week){S.weeklyNum=X.week;S.weeklyPts=0;}}
// every point a pilot earns goes through here: the daily cap, the daily/weekly boards and days active
function ecoAward(S,n,X){
 n=Math.round(Number(n)||0);if(n<=0)return 0;
 ecoRoll(S,X);n=Math.min(n,Math.max(0,DAILY_CAP-(S.dailyPts||0)));if(n<=0)return 0;
 S.pts+=n;S.earned+=n;S.dailyPts+=n;S.weeklyPts+=n;
 if(S.ld!==X.day){S.sk=S.ld===X.day-1?(S.sk||0)+1:1;S.days=(S.days||0)+1;S.ld=X.day;if(S.fd===undefined||S.fd===null)S.fd=X.day;}   // a day counts once you bank points that day
 return n;
}
// ---- crates, salvage, tune-up, upgrades ----
const ecoBuyKey=(tk,ri,X)=>tk==='gem'?'gem'+ri+'|'+X.day:tk+ri;
// gear crates: x1, x2, x3 (only 3 items each). Gem caches: +25% per buy that day, resets daily. Common crates are always the base price
function ecoBoxMult(S,tk,ri,X){if(ri===0)return 1;const n=(S.buys&&S.buys[ecoBuyKey(tk,ri,X)])||0;return tk==='gem'?1+0.25*n:Math.min(3,1+n);}
// deals: the first rare or epic gem cache each UTC day is 30% off ('d'); one epic crate a UTC week is 25% off ('w')
function ecoDealOf(S,tk,ri,X){if(tk==='gem'&&ri>=1&&S.dealD!==X.day)return 'd';if(ri===2&&S.dealW!==X.week)return 'w';return null;}
const dealMult=k=>k==='d'?1-DEAL_D_OFF:k==='w'?1-DEAL_W_OFF:1;
// what something costs right now, in TON and Stars (deal: the deal the buyer asked for, used only if it applies)
function ecoPrice(S,d,X){
 if(d.kind==='box'){const k=d.deal&&d.deal===ecoDealOf(S,d.tk,d.ri,X)?d.deal:null,m=ecoBoxMult(S,d.tk,d.ri,X)*dealMult(k);
  return {ton:Math.round(RPRICE[d.ri]*m*100)/100,stars:Math.round(RSTARS[d.ri]*m),deal:k};}
 if(d.kind==='paint'){const P=PAINTS[d.id];return P&&P.stars?{ton:P.ton,stars:P.stars}:null;}
 if(d.kind==='pass')return {ton:PASS_PRICE.ton,stars:PASS_PRICE.stars};
 return PREMIUM[d.kind]?{ton:PREMIUM[d.kind].ton,stars:PREMIUM[d.kind].stars}:null;
}
// already owned (one-time items): selling it again would charge for nothing
function ecoOwned(S,d,X){
 if(d.kind==='starter')return S.starter;if(d.kind==='founder')return S.founder||!FOUNDER_OPEN;if(d.kind==='moonbeam')return S.moonbeam;
 if(d.kind==='skin')return S.skin==='lunar';if(d.kind==='paint')return !!(S.paints&&S.paints[d.id]);if(d.kind==='pass')return ecoPassState(S,X).prem;
 return false;
}
// open a crate. Returns what came out (the phone words it): gem {gem,n,lv,up}; gear {isW,k,tier,roll,kind: new|up|dup,old,pts}
function ecoOpenBox(S,tk,ri,X){
 const R=X.rnd;
 if(tk==='gem'){
  const k=GORDER[(R()*GORDER.length)|0],n=ri===0?1+((R()*2)|0):ri===1?3+((R()*2)|0):6+((R()*4)|0);
  S.gemShards[k]+=n;let lv=S.gemLvl[k],up=0;
  while(lv<5&&S.gemShards[k]>=SHARD_NEED[lv]){S.gemShards[k]-=SHARD_NEED[lv];lv++;up++;}
  S.gemLvl[k]=lv;return {tk,ri,gem:k,n,lv,up,sh:S.gemShards[k]};
 }
 const isW=tk==='weapon',keys=isW?WORDER:CHORDER,own=isW?S.wOwn:S.cOwn;
 const roll=Math.round((ROLL_MIN+R()*(ROLL_MAX-ROLL_MIN))*100)/100;
 const cands=keys.filter(k=>!(own[k]||[]).includes(ri));
 if(cands.length){const k=cands[(R()*cands.length)|0];own[k]=(own[k]||[]).concat(ri);S.roll[k+':'+ri]=roll;return {tk,ri,isW,k,tier:ri,roll,kind:'new'};}
 // collection complete: re-roll a random item of this rarity, keep the better roll
 const k=keys[(R()*3)|0],old=rollIn(S,k,ri);
 if(roll>old){S.roll[k+':'+ri]=roll;return {tk,ri,isW,k,tier:ri,roll,old,kind:'up'};}
 return {tk,ri,isW,k,tier:ri,roll,old,kind:'dup',pts:ecoAward(S,DUP_PTS[ri],X)};
}
function ecoCratePts(S,tk,ri,X){
 const c=RPTS[ri]||0;
 if(!c)return {err:'paid'};
 if(S.pts<c)return {err:'pts',need:c-S.pts};
 S.pts-=c;const bk=ecoBuyKey(tk,ri,X);S.buys[bk]=(S.buys[bk]||0)+1;S.ptsSpent+=c;
 return ecoOpenBox(S,tk,ri,X);
}
function ecoSalvage(S,tk,ri,X){
 const c=SALV_PTS[ri],isW=tk==='weapon';
 if(!c)return {err:'item'};
 if(S.pts<c)return {err:'pts',need:c-S.pts};
 const keys=isW?WORDER:CHORDER,k=keys[(X.rnd()*3)|0],old=salvIn(S,k,ri);
 const q=Math.round((SALV_MIN[ri]+X.rnd()*(SALV_MAX[ri]-SALV_MIN[ri]))*1000)/1000;
 S.pts-=c;S.ptsSpent+=c;
 if(q>old)S.salv[k+':'+ri]=q;
 return {tk,ri,isW,k,tier:ri,sal:true,q,old,better:q>old};
}
// tune-up: pay points to re-roll an owned crate item (105-110%), you keep the better roll. Starter gear has no roll to tune
function ecoTune(S,isW,k,t,X){
 if(!(isW?hasW(S,k,t):hasC(S,k,t))||!(S.roll&&S.roll[k+':'+t]))return {err:'crate'};
 const old=rollIn(S,k,t),c=TUNE_PTS[t];
 if(old>=ROLL_MAX-0.0001)return {err:'max'};
 if(S.pts<c)return {err:'pts',need:c-S.pts};
 S.pts-=c;S.ptsSpent+=c;
 const roll=Math.round((ROLL_MIN+X.rnd()*(ROLL_MAX-ROLL_MIN))*100)/100,better=roll>old;
 if(better)S.roll[k+':'+t]=roll;
 return {isW,k,t,better,old,roll};
}
function ecoUp(S,k){
 if(!UPS[k])return {err:'item'};
 const lvl=S.up[k];if(lvl>=4)return {err:'max'};
 if(upLevels(S.up)>=BUILD_MAX)return {err:'budget'};
 const cost=UPS[k].costs[lvl];if(S.pts<cost)return {err:'pts',need:cost-S.pts};
 S.pts-=cost;S.ptsSpent+=cost;S.up[k]++;return {k,lv:S.up[k]};
}
function ecoRespec(S){   // clear the build: every level to 0, half the points back
 const inv=upInvested(S.up);if(!inv)return {err:'empty'};
 const back=Math.floor(inv*RESPEC_BACK);
 for(const k of UORDER)S.up[k]=0;
 S.pts+=back;S.ptsSpent=Math.max(0,S.ptsSpent-back);
 return {back,lost:inv-back};
}
// ---- purchases (only after the payment is verified). Returns what each part gave, so a refund can take it back ----
function ecoGrant(S,d,X){
 const outs=[];
 if(d.kind==='box'){const bk=ecoBuyKey(d.tk,d.ri,X);S.buys[bk]=(S.buys[bk]||0)+1;if(d.deal==='d')S.dealD=X.day;else if(d.deal==='w')S.dealW=X.week;
  S.spendGram+=Number(d.price)||RPRICE[d.ri]||0;outs.push(ecoOpenBox(S,d.tk,d.ri,X));}
 else if(d.kind==='starter'){if(!S.starter){S.starter=true;S.spendGram+=STARTER.ton;outs.push(ecoOpenBox(S,'weapon',1,X),ecoOpenBox(S,'chassis',1,X),ecoOpenBox(S,'gem',1,X));}}
 else if(d.kind==='founder'){if(!S.founder){S.founder=true;S.spendGram+=FOUNDER.ton;S.paints.founder=1;outs.push({tk:'paint',id:'founder'},ecoOpenBox(S,'weapon',2,X),ecoOpenBox(S,'gem',1,X),ecoOpenBox(S,'gem',1,X));}}
 else if(d.kind==='moonbeam'){if(!S.moonbeam){S.moonbeam=true;S.spendGram+=MOONBEAM_PRICE;outs.push({tk:'moonbeam'});}}
 else if(d.kind==='skin'){if(S.skin!=='lunar'){S.skin='lunar';S.spendGram+=SKIN_PRICE;outs.push({tk:'skin'});}}
 else if(d.kind==='paint'){const P=PAINTS[d.id];if(P&&P.stars&&!S.paints[d.id]){S.paints[d.id]=1;S.spendGram+=P.ton||0;outs.push({tk:'paint',id:d.id});}}
 else if(d.kind==='pass'){const P=ecoPassState(S,X);if(!P.prem){P.prem=true;S.spendGram+=PASS_PRICE.ton;outs.push({tk:'pass',s:P.s});}}
 return outs;
}
// a refunded purchase: take back exactly what it gave
function ecoRefund(S,kind,outs){
 if(kind==='starter')S.starter=false;
 for(const o of listOf(outs)){
  if(!o||typeof o!=='object')continue;
  if(o.gem&&GEM[o.gem]){const k=o.gem;S.gemShards[k]-=o.n||0;while(S.gemShards[k]<0&&S.gemLvl[k]>1){S.gemLvl[k]--;S.gemShards[k]+=SHARD_NEED[S.gemLvl[k]];}S.gemShards[k]=Math.max(0,S.gemShards[k]);}
  else if(o.kind==='new'){const own=o.isW?S.wOwn:S.cOwn;own[o.k]=(own[o.k]||[]).filter(t=>t!==o.tier);delete S.roll[o.k+':'+o.tier];if(!S.wOwn.pulse.includes(0))S.wOwn.pulse.unshift(0);if(!S.cOwn.vanguard.includes(0))S.cOwn.vanguard.unshift(0);}
  else if(o.kind==='up'){if(rollIn(S,o.k,o.tier)===o.roll)S.roll[o.k+':'+o.tier]=o.old;}
  else if(o.kind==='dup'){const p=o.pts||0;S.pts=Math.max(0,S.pts-p);S.earned=Math.max(0,S.earned-p);}
  else if(o.tk==='paint'){delete S.paints[o.id];if(o.id==='founder')S.founder=false;}
  else if(o.tk==='moonbeam')S.moonbeam=false;
  else if(o.tk==='skin')S.skin='default';
  else if(o.tk==='pass'){if(S.pass&&S.pass.s===o.s)S.pass.prem=false;}
 }
}
// ---- milestones ----
function ecoMsAdd(S,id,val,isMax){const Q=MS_BY[id];if(!Q)return;const e=S.q[id]||(S.q[id]={p:0,done:false,claimed:false});e.p=isMax?Math.max(e.p||0,val||0):(e.p||0)+(val||0);if(e.p>=Q.goal)e.done=true;}
function ecoMsClaim(S,id,X){const Q=MS_BY[id],e=S.q[id];if(!Q||!e||!e.done||e.claimed)return null;e.claimed=true;return {pts:ecoAward(S,Q.pts,X)};}
function ecoVisit(S,id){const Q=MS_BY[id];if(!Q||!Q.link)return false;const e=S.q[id]||(S.q[id]={p:0,done:false,claimed:false});e.p=Q.goal;e.done=true;return true;}
// ---- login streak ----
function ecoLoginState(S,X){
 const d=X.day,L=S.login||{last:-9,n:0};
 const claimedToday=L.last===d,alive=L.last===d||L.last===d-1;
 const next=claimedToday?L.n:(alive?L.n+1:1);   // streak count after today's claim
 return {claimedToday,streak:alive?L.n:0,next,slot:((next-1)%7),reward:STREAK_PTS[(next-1)%7]+TDAILY[tierOfPts(S.earned||0)]};
}
function ecoLogin(S,X){
 const s=ecoLoginState(S,X);if(s.claimedToday)return null;
 S.login={last:X.day,n:s.next};
 const pts=ecoAward(S,s.reward,X),box=s.slot===6?ecoOpenBox(S,'gem',0,X):null;   // day 7: a free gem cache too
 return {pts,box,day:s.slot+1};
}
// ---- daily and weekly quests ----
function weeklyIds(w){   // the same list for every pilot that week, so nobody draws an easier or richer set
 const r=rng32(hashStr('wk:'+w)),pool=WQ_POOL.slice(WQ_FIXED),ids=WQ_POOL.slice(0,WQ_FIXED).map(q=>q.id);
 while(ids.length<WQ_N){const i=(r()*pool.length)|0;ids.push(pool.splice(i,1)[0].id);}
 return ids;
}
function ecoQuests(S,X){   // today's dailies and this week's weeklies exist
 const d=X.day;
 if(!S.dq||S.dq.d!==d||S.dq.v!==2){
  const r=rng32(hashStr(X.pk+':'+d)),ids=[];
  for(const lv of DQ_SLOTS){const pool=DQ_POOL.filter(q=>q.lv===lv&&!ids.includes(q.id));ids.push(pool[(r()*pool.length)|0].id);}
  S.dq={v:2,d,ids,p:{},c:{},all:false,sw:0,was:[]};
 }
 const w=X.week;
 if(!S.wq||S.wq.w!==w)S.wq={w,n:0,claimed:false};
 if(!S.wk||S.wk.w!==w)S.wk={w,ids:weeklyIds(w),p:{},u:{},c:{}};
}
function questRows(ids,p,c,BY,u,day){return ids.filter(id=>BY[id]).map(id=>{const Q=BY[id],v=p[id]||0,t=Q.pd&&u&&u[id]&&u[id][0]===day?u[id][1]:0;
 return {...Q,p:Math.min(v,Q.goal),done:v>=Q.goal,claimed:!!c[id],today:Math.min(t,Q.pd||0)};});}
function ecoDailyRows(S,X){ecoQuests(S,X);return questRows(S.dq.ids,S.dq.p,S.dq.c,DQ_BY,null,X.day);}
function ecoWeeklyRows(S,X){ecoQuests(S,X);return questRows(S.wk.ids,S.wk.p,S.wk.c,WQ_BY,S.wk.u,X.day);}
function qAdd(p,u,Q,stats,day){   // one match's stats into one quest
 const v=stats[Q.st];
 if(Q.pd){   // u[id] = [day, count that day]; a day counts once it reaches pd
  if(!v)return;const d=stats.day!==undefined?stats.day:day,s=u[Q.id]&&u[Q.id][0]===d?u[Q.id]:(u[Q.id]=[d,0]),was=s[1];
  s[1]+=v;if(was<Q.pd&&s[1]>=Q.pd)p[Q.id]=(p[Q.id]||0)+1;return;}
 if(Q.u){if(v===undefined||v===null||v===false)return;const s=u[Q.id]||(u[Q.id]=[]);if(!s.includes(v))s.push(v);p[Q.id]=s.length;return;}
 if(!v)return;
 p[Q.id]=Q.mx?Math.max(p[Q.id]||0,v):(p[Q.id]||0)+v;
}
function ecoProgress(S,stats,X){   // one finished match into today's and this week's quests
 ecoQuests(S,X);
 for(const id of S.dq.ids)if(DQ_BY[id])qAdd(S.dq.p,{},DQ_BY[id],stats,X.day);
 for(const id of S.wk.ids)if(WQ_BY[id])qAdd(S.wk.p,S.wk.u,WQ_BY[id],stats,X.day);
}
function ecoBoost(S,X){const L=ecoLoginState(S,X);return L.claimedToday?streakBoost(L.streak):0;}
const ecoQPts=(S,n,X)=>Math.round(n*(1+ecoBoost(S,X)));
function ecoSwapsLeft(S,X){ecoQuests(S,X);return Math.max(0,DQ_SWAPS+(ecoPassState(S,X).prem?1:0)-(S.dq.sw||0));}
// swap one unfinished daily for another of the same difficulty (never back to one you had today)
function ecoSwap(S,id,X){
 const qs=ecoDailyRows(S,X),Q=qs.find(q=>q.id===id);
 if(!Q||Q.done||Q.claimed||ecoSwapsLeft(S,X)<1)return null;
 const pool=DQ_POOL.filter(q=>q.lv===Q.lv&&!S.dq.ids.includes(q.id)&&!(S.dq.was||[]).includes(q.id));
 if(!pool.length)return null;
 const N=pool[(X.rnd()*pool.length)|0];
 S.dq.ids[S.dq.ids.indexOf(id)]=N.id;delete S.dq.p[id];
 S.dq.was=(S.dq.was||[]).concat(id);S.dq.sw=(S.dq.sw||0)+1;
 return N;
}
function ecoClaimDaily(S,id,X){
 const qs=ecoDailyRows(S,X),Q=qs.find(q=>q.id===id);
 if(!Q||!Q.done||Q.claimed)return null;
 S.dq.c[id]=true;S.wq.n=(S.wq.n||0)+1;
 let n=ecoAward(S,ecoQPts(S,Q.pts,X),X),all=false;ecoPassXP(S,PASS_XP_QUEST,X);
 if(!S.dq.all&&qs.every(q=>q.claimed||q.id===id)){S.dq.all=true;all=true;n+=ecoAward(S,ecoQPts(S,DQ_ALL_BONUS,X),X);ecoPassXP(S,PASS_XP_ALL,X);}
 return {pts:n,all};
}
function ecoClaimWeekly(S,id,X){
 const Q=ecoWeeklyRows(S,X).find(q=>q.id===id);
 if(!Q||!Q.done||Q.claimed)return null;
 S.wk.c[id]=true;const n=ecoAward(S,ecoQPts(S,Q.pts,X),X);ecoPassXP(S,PASS_XP_WQ,X);
 return {pts:n};
}
function ecoChest(S,X){
 ecoQuests(S,X);
 if(S.wq.claimed||(S.wq.n||0)<WQ_GOAL)return null;
 S.wq.claimed=true;const n=ecoAward(S,ecoQPts(S,WQ_PTS,X),X);
 return {pts:n,box:ecoOpenBox(S,'gem',1,X)};
}
// ---- Lunar Pass ----
const ecoSeason=X=>Math.max(1,Math.floor((X.day-PASS_START)/PASS_LEN)+1);
function ecoPassState(S,X){const s=ecoSeason(X);if(!S.pass||S.pass.s!==s)S.pass={s,xp:0,prem:false,cf:[],cp:[]};S.pass.cf=S.pass.cf||[];S.pass.cp=S.pass.cp||[];return S.pass;}
const ecoPassTier=(S,X)=>Math.min(PASS_TIERS,Math.floor(ecoPassState(S,X).xp/PASS_XP));
function ecoPassXP(S,n,X){if(!n)return 0;const P=ecoPassState(S,X),b=ecoPassTier(S,X);P.xp=Math.min(PASS_TIERS*PASS_XP,P.xp+n);return ecoPassTier(S,X)-b;}
function ecoClaimPass(S,track,i,X){
 const P=ecoPassState(S,X);i=+i;
 if(!(i>=1&&i<=ecoPassTier(S,X)))return null;
 const prem=track==='p',list=prem?P.cp:P.cf,r=(prem?PASS_PREM:PASS_FREE)[i];
 if(!r||list.includes(i)||(prem&&!P.prem))return null;
 list.push(i);
 if(r.k==='pts')return {pts:ecoAward(S,r.n,X)};   // free track only: the premium track never gives points
 if(r.k==='paint'){S.paints[r.id]=1;return {paint:r.id};}
 return {box:ecoOpenBox(S,r.tk,r.ri,X)};
}
// ---- matches ----
// points for a finished match: mode pay, best of 3, featured, league multiplier, win streak (o: won, drawn, place, top3, g, m, feat, series)
function ecoMatchPts(S,o,mult,X){
 if(o.won)S.streak++;else if(!o.drawn&&!o.top3)S.streak=0;   // Last Standing: 2nd and 3rd keep your streak
 const mk=MODES[o.m]?o.m:'1v1',sb=o.won?streakPts(o.g,mk,S.streak):0,M=MODES[mk],solo=isSolo(o.g);
 const zx=teamX(o.g,mk,!!o.series),fxm=o.feat?FEATURED_X:1;
 const base=Math.round(solo?ROYALE_PTS[Math.max(1,Math.min(6,o.place||6))-1]:(o.won?M.win:o.drawn?M.draw:M.loss)*zx);
 const pts=Math.round(base*fxm*mult)+sb;
 return {pts,awarded:ecoAward(S,pts,X),base,modeX:zx,featX:fxm,streak:S.streak,streakBonus:sb};
}
function ecoQuit(S){S.streak=0;S.losses++;S.mp++;}   // left mid-match: a loss, no points
// everything else a finished match changes: wins and losses, pass XP, milestone and quest progress
// (o: won, drawn, top3, feat, quick, g, m, map, streak, seriesW, st: {dmg, sup, box, kills, caps, cry, stars, low})
function ecoAfterMatch(S,o,X){
 const st=o.st||{},won=!!o.won,drawn=!!o.drawn,top3=!!o.top3,low=typeof st.low==='number'?st.low:0,clean=won&&low>0,M=MODES[o.m]||MODES['1v1'],sw=o.seriesW;
 if(won)S.wins++;else if(!drawn&&!top3)S.losses++;
 S.mp++;
 ecoPassXP(S,(won?PASS_XP_WIN:drawn||top3?PASS_XP_DRAW:PASS_XP_LOSS)+(o.feat?PASS_XP_FEAT:0),X);
 ecoMsAdd(S,'q_win1',won?1:0);ecoMsAdd(S,'q_win3',won?1:0);
 ecoMsAdd(S,'q_dmg',st.dmg||0,true);ecoMsAdd(S,'q_super',st.sup||0,true);ecoMsAdd(S,'q_box',st.box||0,true);
 if(won&&low>=0.75)ecoMsAdd(S,'q_clean',1);   // never below 75% health
 const W=g=>won&&o.g===g?1:0;
 ecoProgress(S,{wins:won?1:0,plays:1,dmg:Math.round(st.dmg||0),boxes:st.box||0,sups:st.sup||0,kills:st.kills||0,zoneWins:W('zone'),teamWins:won&&M.n>1&&!isSolo(o.g)?1:0,caps:st.caps||0,
  crystals:st.cry||0,stars:st.stars||0,top3:top3?1:0,featured:o.feat?1:0,featWins:won&&o.feat?1:0,quick:o.quick?1:0,
  cleanWins:clean?1:0,streak:won?(o.streak||0):0,ovpWins:won&&o.map==='overpass'?1:0,sweeps:won&&sw&&sw[0]>=2&&sw[1]===0?1:0,
  royaleWins:W('royale'),bountyWins:W('bounty'),crystalWins:W('crystal'),day:X.day,winMode:won?o.g:null},X);
}
// ---- squad payouts: milestones your recruits reach + 5% of what they earn (max 2,000 a day from the 5%; the rest carries over) ----
function ecoRefOwed(S,r){
 const c=(S.refC||{})[r.id]||{m:0,seen:0};let m=c.m||0,ms=0;
 while(m<REF_MS.length&&r.days>=REF_MS[m].days&&r.pts>=REF_MS[m].pts){ms+=REF_MS[m].r;m++;}
 const pc=Math.max(0,Math.floor((r.pts-(c.seen||0))*REF_PCT));
 return {ms,pct:pc,m,tot:ms+pc};
}
const ecoPctRoom=(S,X)=>S.refPD&&S.refPD.d===X.day?Math.max(0,REF_PCT_CAP-S.refPD.a):REF_PCT_CAP;
// rows: your recruits {id, pts, days}; me: {ref, days} (your own referrer gives you a welcome bonus on day 2); held: ids whose payouts are on hold
function ecoSquad(S,rows,X,me,held){
 ecoRoll(S,X);held=held||[];
 let room=Math.max(0,DAILY_CAP-(S.dailyPts||0)),got=0,welcome=0;
 if(me&&me.ref&&(me.days||0)>=2&&!S.refWelcome&&room>=REF_WELCOME&&!held.includes('me')){S.refWelcome=true;got+=REF_WELCOME;room-=REF_WELCOME;welcome=REF_WELCOME;}
 let pr=ecoPctRoom(S,X),pgot=0;
 for(const r of rows||[]){if(held.includes(r.id))continue;const o=ecoRefOwed(S,r),pp=Math.min(o.pct,pr),t=o.ms+pp;if(!t)continue;if(t>room)break;
  const c=S.refC[r.id]||{m:0,seen:0};S.refC[r.id]={m:o.m,seen:(c.seen||0)+Math.round(pp/REF_PCT)};   // unpaid % carries over to tomorrow
  got+=t;room-=t;pr-=pp;pgot+=pp;}
 if(pgot)S.refPD={d:X.day,a:(S.refPD&&S.refPD.d===X.day?S.refPD.a:0)+pgot};
 return {pts:got?ecoAward(S,got,X):0,welcome};
}
function ecoSquadPending(S,rows,X,me,held){held=held||[];let t=me&&me.ref&&(me.days||0)>=2&&!S.refWelcome&&!held.includes('me')?REF_WELCOME:0,pr=ecoPctRoom(S,X);
 for(const r of rows||[]){if(held.includes(r.id))continue;const o=ecoRefOwed(S,r);const pp=Math.min(o.pct,pr);pr-=pp;t+=o.ms+pp;}return t;}
