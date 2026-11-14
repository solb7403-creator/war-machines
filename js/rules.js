'use strict';
// =====================================================================
// rules: pure game data and stat math, shared by the phone and the PvP server
// (no save, no DOM: worker/build-sim.mjs bundles this file with game.js for the server)
// =====================================================================
const PVP_V=6;   // game/reward and live-match protocol version: 6 is the 5E-2b2b supers (charge from damage only, measured against the tank's own strength; at most 3 a round; faster timing bar; supers used in the snapshot); 5 is the 5E-2b supers (timing bar, the tap message and the wider snapshot); 4 adds Velocity; the phone and server must agree (2: Canyon and Bunker joined the live map pool; 3: Session 2 mods, Moonbeam Precision and Moonfall hit width, leagues)
// ---- combat tuning ----
const STAT={hp:1700,speed:4.4,range:6,dps:70,shot:0.2,bspd:13,turn:3.4};
// mystery box buffs: each lasts until its holder takes BUFF_LIFE damage; same-stat buffs stack
const BUFF={dmg:{n:'DMG',c:'#ff6b5e',amt:0.4,txt:'+40% DAMAGE'},arm:{n:'ARM',c:'#5aa9ff',amt:0.35,txt:'+35% ARMOR'},rof:{n:'ROF',c:'#ffd24a',amt:0.4,txt:'+40% FIRE RATE'},spd:{n:'SPD',c:'#7be07b',amt:0.3,txt:'+30% SPEED'},lck:{n:'LCK',c:'#c28bff',amt:0.1,txt:'+10% CRIT CHANCE'},reg:{n:'REG',c:'#4be3a0',amt:0.003,txt:'+0.3% HP/SEC'}};
const BUFF_KEYS=Object.keys(BUFF);
const CRIT_BASE=0.1,CRIT_MULT=2,GRAZE=0.75,DIRECT=0.4;
// Supers. Session 5E-2b (owner, Nov 10-11 2026) made them fewer, bigger moments with a timing bar; Session 5E-2b2b (owner, Nov
// 12-14) set the charge rule, the 3-a-round cap, 20-25% less damage per super and the faster bar (everything below).
// Measured with dev/tests/super-rounds.mjs (docs/supers-5e2b2b/): before, a pilot fired 5.5 supers a ROUND (up to 18, the AI up
// to 17, top gear against weaker AI up to 3x a stock tank's count); now about 2.8 (1v1 Arena about 1.9), never more than 3.
// dev/tests/super-timing.mjs holds every rule here.
const SUPER_MAX=1000,SUPER_LEN=14,FILL_DEALT=1,FILL_TAKEN=0.7,FILL_CRIT=60;   // Conquest only (charge per point of damage): unchanged, see game.js SUP_CQ
// ---- Super charge in the Arcade and in live matches (Session 5E-2b2b, owner Nov 12-14 2026) ----
// Owner rules: (1) the charge comes ONLY from damage dealt to enemy tanks and damage received from them: nothing passive, nothing
// per second, nothing per crit; (2) it is measured against the tank's OWN strength, not the target's health: damage dealt counts
// in seconds of the tank's own clean cannon fire (its permanent damage per second: weapon, cannon levels, cores, skin, crit
// chance), damage received as a share of the tank's own full hull. So a Legendary kit shooting a weak tank charges exactly as
// fast, per second of fire landed, as a stock tank shooting its equal (on main the charge was the share of the TARGET's hull: a
// strong kit against the Arcade's weaker AI, with bigger team hulls, refilled several times faster: measured 7-8 supers a 3v3
// round, the AI up to 16); (3) about 3 supers per player per ROUND in every mode (about 2 in a 1v1 Arena round, which lasts about
// 35 s), and NEVER more than SUP_ROUND_CAP: the sim refuses the 4th press, the count survives a respawn and only a new round
// clears it (live matches: the server's sim; AI matches: the server's proof-of-play check counts the presses per round);
// (4) the Reactor (+10% a level) and the charge mods multiply the result as before.
// What never charges: crates and props, terrain, the storm ring, meteors, your own or a team mate's fire (the rules have none),
// damage past the target's remaining health (overkill), a super's own damage (its owner), and anything once the cap is reached.
// No farming by soaking damage: damage received counts for at most ONE full hull per life (repairs and regeneration do not
// refill that allowance), and it is the smaller source by design.
// SUP_FILL[mode][team size] = [d, h]: d seconds of the tank's own clean fire fill one bar; h of its own hulls lost fill one bar.
// The split is the owner's starting point, kept after calibration: in a measured average round about 70% of the charge comes from
// damage dealt and 30% from damage received. The numbers differ by mode because a round's fighting differs (a 35 s duel, a
// 180 s Moon Zone with respawns, a megatank with a huge hull): each row is fitted on seeded rounds of that mode so the pilot's
// uncapped charge is about 3.6 bars a round (1v1 Arena: 2.2), which the cap turns into "about 3, never more".
// dev/tests/super-rounds.mjs measures every cell; dev/tests/super-timing.mjs holds the rules.
const SUP_ROUND_CAP=3;
const SUP_FILL={arena:{1:[5,0.8],2:[7,0.5],3:[16,0.6]},zone:{1:[10,0.9],2:[19,0.75],3:[27,0.75]},crystal:{1:[8.5,0.8],2:[11,0.55],3:[17,0.6]},
 bounty:{1:[9.5,1.7],2:[14,1.15],3:[17,1]},royale:{1:[9.5,0.65]},boss:{1:[15,0.5],2:[17,0.5],3:[18,0.6]}};
const supFillOf=(g,n)=>{const F=SUP_FILL[g]||SUP_FILL.arena;return F[n]||F[1];};
// SUP_GEAR: a super's damage rises with the tank's gear multiplier (weapon tier x roll, cannon upgrades, damage cores, Lunar
// Skin) to this power. It was 1 while better gear also fired more supers; now that every pilot fires about 3, the step that
// used to come from firing more often is in each super's damage (fitted on the measured kits, game.js SUP)
// SUP_GEAR_AI: an AI pilot's super rises a little less steeply with its gear. On main the AI's minimum time between supers
// (LG_AI_SUP_GAP, owner Nov 10: keep AI super frequency limited) held the AI back more the better its gear was (measured: the
// pilot's supers per AI super rose 7% from the stock to the Common kit and 14% to the Rare kit). With about 3 supers a match
// that spacing rarely binds any more, so the same restraint now sits in the damage: fitted (gear ratio)^-0.4 = those steps.
// It only ever makes an AI super weaker than a person's with the same gear (dev/tests/fair-arcade.mjs holds the gear ladder).
const SUP_GEAR=2.2,SUP_GEAR_AI=1.8;
// The timing bar: pressing SUPER starts the charge and a marker sweeps the bar once in SUP_BAR_T seconds. A second tap stops it:
// outside the normal zone = MISS (a weaker, simpler super), inside = NORMAL, inside the jackpot circle = JACKPOT (stronger, with
// the weapon's signature effect). No tap by the end of the sweep = MISS. The super fires SUP_REL after the tap, never sooner
// than the weapon's own telegraph (SUP[..].charge), so it stays as dodgeable as before. All positions are fractions of the bar.
// SUP_OC: damage by outcome. The worst possible tap does 65% of a normal one (owner range 60-70%); the jackpot bonus is +25%:
// with an average person's taps (SUP_TAP_HUMAN) the three outcomes average out at ~1.0x, so a perfect player's supers do at
// most 25% more than an average player's and a careless one never loses more than 35%.
// SUP_TAP_TOL: live matches. The server owns the bar (it draws the zone and the jackpot) and its own clock judges the tap; the
// phone's reported stop time is only believed inside this latency allowance, so a modified client cannot claim a jackpot it
// did not time (it would have to send the tap within the allowance of the right moment anyway).
// The press and the tap reach the server the same way, so steady lag cancels out: the allowance only has to cover jitter
// and one 33 ms server tick (0.06 s). A cheat that times its taps perfectly cannot be told from a perfect player; the
// jackpot bonus is capped at +25% for that reason.
// SUP_HULL_CAP: one super never takes more than this share of the target's FULL hull on a normal stop (39%; x0.65 = 25% on a
// miss, x1.25 = 49% on a jackpot; it was 50 / 32.5 / 62.5% before 5E-2b2b), before the target's armour and shield. With about 3 big supers a match, an uncapped hit could
// delete an equal tank outright where a mode halves the hulls (Bounty 1v1) or against lighter gear: the moment must be
// big, never a one-shot from full health. The megatank is too big for the cap to matter.
// LG_AI_TAP: an AI pilot stops the bar with a timing spread set by its league (seconds of error, as a fraction of the sweep):
// every league taps worse than an average person and none is ever perfect.
// Session 5E-2b2b (owner: "the bar moves way too slowly: 25-50% faster, 2x only if that is the sweet spot"): the Arcade and live
// sweep is 1.5x faster (1.0 s -> 0.667 s). Why 1.5x and not 2x, in numbers: the jackpot circle is 8% of the bar, so the marker is
// inside it for 80 ms at 1x, 53 ms at 1.5x and 40 ms at 2x. A phone drawing 30 frames a second shows the marker inside the circle
// on 2.4 / 1.6 / 1.2 frames: at 2x the jackpot is one frame wide on a slow phone, i.e. luck and device speed, not skill. And the
// circle must be seen before it can be timed: the earliest jackpot centre is 340 ms after the press here (430 ms at 1x; it would
// be 215-255 ms at 2x, under a person's ~250 ms reaction to a new picture). What makes the jackpot hard is therefore (a) the
// marker's speed, (b) the circle's random place, (c) how soon after the press it can come. (a) went up 50%; (b) is unchanged;
// (c) is held at a fair minimum by starting the zone a little later along the bar (44-62% instead of 36-56%).
// SUP_TAP_HUMAN: an average person's tap spread as a fraction of the sweep. Model: timing error (s) = sqrt(0.045^2 + (0.09 T)^2):
// a fixed part (finger and touch-screen jitter) and a part that follows the marker's speed; T = 1.0 gives 0.10 (the value the
// 5E-2b tables were measured with), T = 0.667 gives 0.075 s = 0.1125 of the sweep. LG_AI_TAP rose by the same 1.125 so every
// league's AI still taps worse than an average person. Conquest keeps its own 1.0 s sweep and zone (SUP_BAR_T_CQ, supBar(rnd,1)):
// its taps are judged in 50 ms command steps, too coarse for a 53 ms window, and its super tuning is frozen (owner).
const SUP_BAR_T=0.667,SUP_BAR_T_CQ=1.0,SUP_ZONE_W=0.36,SUP_JACK_W=0.08,SUP_REL=0.2,SUP_TAP_TOL=0.06;
const SUP_OC=[0.65,1,1.25],SUP_OC_TXT=['MISS','HIT','JACKPOT'],SUP_HULL_CAP=0.39;
const SUP_TAP_HUMAN=0.1125,LG_AI_TAP=[0.27,0.235,0.20,0.18,0.158,0.146,0.135];
function supBar(rnd,cq){const z0=cq?0.36+0.2*rnd():0.44+0.18*rnd(),m=0.03+SUP_JACK_W/2;return {z0:Math.round(z0*1000)/1000,jc:Math.round((z0+m+(SUP_ZONE_W-2*m)*rnd())*1000)/1000};}   // the zone starts 44-62% along (Conquest: 36-56%); the jackpot sits anywhere inside it
function supJudge(bar,el,T){const p=el/(T||SUP_BAR_T);return Math.abs(p-bar.jc)<=SUP_JACK_W/2+1e-9?2:p>=bar.z0-1e-9&&p<=bar.z0+SUP_ZONE_W+1e-9?1:0;}   // 0 miss, 1 normal, 2 jackpot. T: the sweep (Conquest passes its own)
// one super per weapon item (ten): the key picks its look (js/fx3d.js); the hit shape stays the archetype's (SUP)
const supKey=(arch,tier)=>arch==='moon'?'moon':(WEAPONS[arch]?arch:'pulse')+Math.max(0,Math.min(2,tier|0));
const SUP_KEYS=['pulse0','pulse1','pulse2','twin0','twin1','twin2','siege0','siege1','siege2','moon'];
const SUP_NAMES={pulse0:'Pierce Lance',pulse1:'Arc Lance',pulse2:'Sunlance',twin0:'Static Nova',twin1:'Storm Nova',twin2:'Helix Nova',siege0:'Siege Blast',siege1:'Rail Blast',siege2:'Titanfall',moon:'Moonfall'};
const BUFF_LIFE=780;
// core gems: socketed in the garage, permanent all game. Weaker than box buffs; they multiply with them.
const GEM={dmg:{n:'DMG',name:'Damage',c:'#ff6b5e',amt:0.12},rof:{n:'ROF',name:'Fire rate',c:'#ffd24a',amt:0.10},arm:{n:'ARM',name:'Armor',c:'#5aa9ff',amt:0.08},spd:{n:'SPD',name:'Speed',c:'#7be07b',amt:0.08},lck:{n:'LCK',name:'Luck',c:'#c28bff',amt:0.03},reg:{n:'REG',name:'Repair',c:'#4be3a0',amt:0.001},vel:{n:'VEL',name:'Velocity',c:'#42d9ff',amt:0.15,impact:0.05}};
const GORDER=['dmg','rof','arm','spd','lck','reg','vel'];
const GEM_LV=[1,1.2,1.45,1.8,2.25]; // Lv1..5
const gemLvMult=lv=>GEM_LV[Math.min(4,Math.max(0,(lv||1)-1))];
const coreVal=(k,lv)=>GEM[k].amt*gemLvMult(lv);
// Physical projectiles only: speed and impact are independent, each applied once.
const projectileImpactMult=t=>1+(t.gems.includes('vel')?GEM.vel.impact*((t.gemM&&t.gemM.vel)||1):0);
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
// paid reset: keep every point. The points fee (half the build) is priced at 6,250 points per $1, in $0.50 tiers
// from $1 to $5 (a smaller build resets with points only). ~77 Stars and 1.25 TON per $1, in line with the shop
const RESPEC_PTS_USD=6250,RESPEC_USD_MIN=1,RESPEC_USD_MAX=5,RESPEC_STARS_USD=77,RESPEC_TON_USD=1.25;
const respecFee=inv=>inv-Math.floor(inv*RESPEC_BACK);
function respecTier(inv){const t=Math.round(respecFee(inv)/RESPEC_PTS_USD*2)/2;return t<RESPEC_USD_MIN?0:Math.min(RESPEC_USD_MAX,t);}
const respecTierOfTon=ton=>Math.min(RESPEC_USD_MAX,Math.max(RESPEC_USD_MIN,Math.round((Number(ton)||0)/RESPEC_TON_USD*2)/2));
const upLevels=U=>UORDER.reduce((a,k)=>a+((U&&U[k])|0),0);
const upInvested=U=>UORDER.reduce((a,k)=>{let s=0;for(let i=0;i<((U&&U[k])|0);i++)s+=UPS[k].costs[i];return a+s;},0);
// ---- chassis classes & weapons ----
// hb: the class's hittable body radius (x R) for shots, supers, shells and hazards; one value for all three tiers.
// Movement and wall collisions stay on R for every class.
const CH={
 scout:{n:'Scout',d:'Fast and agile',hp:0.85,spd:1.23,turn:1.18,ds:0.9,hb:0.9,c:'#7be07b'},
 vanguard:{n:'Vanguard',d:'Balanced all-rounder',hp:1.0,spd:1.0,turn:1.0,ds:1.0,hb:1.0,c:'#3fd0c9'},
 titan:{n:'Titan',d:'Slow, very tanky',hp:1.30,spd:0.88,turn:0.9,ds:1.12,hb:1.12,c:'#c28bff'}};
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
 moon:{n:'Moonbeam',d:'Lunar precision laser',dps:118,shot:0.16,c:'#e8f4ff',sup:'Moonfall',premium:true}};
const WORDER=['pulse','twin','siege'];
const TIER_MULT=[1.0,1.14,1.34];
// Legendary is a distinct, fixed premium power step, not an Epic roll or tuneable quality.
// Its super scales above the strongest normal Epic roll, while shot cadence limits super farming.
const LEGENDARY_MULT=1.48;
// Moonbeam's signature trait, Precision: its shots never graze. An edge hit (a shot that clips the hull, which deals GRAZE
// for every other weapon) deals MOON_EDGE of a full hit. Crits still need a direct hit.
const MOON_EDGE=1.0;
// Lunar Skin: one always-on bonus to health and to damage (shots and supers)
const SKIN_HP=1.08,SKIN_DMG=1.08;
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
 founder:{n:'Founder',hull:'#aab2c0',tur:'#d3d9e3',trim:'#ffcf4a',shine:true,only:'founder'},   // Founder pack only, never sold on its own
 hyper:{n:'Hyperspace',hull:'#171140',tur:'#261c63',trim:'#ffd46a',shine:true,only:'vault'}};   // Hyperspace Vault level 7, never sold
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
// LEAGUES: 7 steps from Rookie to Lunar Legend, set by your league rating = power x (0.8 + 0.4 x form). Form (S.lwr) is a
// moving average of your results (win 1, draw or Last Standing top 3 0.5, loss or quit 0, over about the last 20 matches); it
// counts from your 10th match (0.5 before). The steps are equal percentages (power is multiplicative), so every league is the
// same step harder than the one below: the AI you meet in AI matches gets a fixed step stronger each league (LG_AI), and each
// league pays more spendable points (mult; the airdrop and the daily cap count base points only). Promote at the line, drop
// LG_DEMOTE below it. Not the same as your TIER (lifetime points). Measured and explained in docs/launch/LEAGUES.md
const LEAGUE=[{n:'Rookie',key:'ROOKIE',c:'#9fb0c2'},{n:'Pilot',key:'PILOT',c:'#6fcf97'},{n:'Veteran',key:'VETERAN',c:'#3fd0c9'},{n:'Ace',key:'ACE',c:'#4d9fff'},
 {n:'Elite',key:'ELITE',c:'#ff9d3c'},{n:'Master',key:'MASTER',c:'#c28bff'},{n:'Lunar Legend',key:'LUNAR',c:'#ff4d6d'}];
const LEAGUES=LEAGUE.map(L=>L.key);
// base pay per league: what a match pays in BASE points (the airdrop, the boards and the daily cap count these), so a higher
// league earns more airdrop points a minute even against its harder AI (measured: docs/launch/LEAGUES.md). The cap stays 20,000
// base points a day in every league: a higher league reaches it sooner, nobody banks more a day
const LG_BASE_PAY=[1,1.09,1.18,1.28,1.39,1.50,1.60];   // front-loaded: the first steps are where the AI hardens most for the kits that play there
const LG_MULT=[1,1.15,1.30,1.45,1.60,1.80,2.00];   // spendable points multiplier per league, on top of base pay (spendable points only)
const LG_FIRST=84,LG_RATIO=1.21;   // league rating lines: Pilot from 84, then each line 21% above the last (Lunar Legend from ~218)
const LG_AT=LEAGUE.slice(1).map((_,i)=>Math.round(LG_FIRST*Math.pow(LG_RATIO,i)*10)/10);
const LG_DEMOTE=0.04,LG_FORM_N=20,LG_FORM_MIN=10,LG_FORM_W=0.4;
// LG_AI: the league's AI power relative to Rookie's (what the league screen shows as "AI +x%"); set from LG_AI_PW below (Session 5D)
let LG_AI=LEAGUE.map(()=>1);
const leagueRating=(pw,lwr,mp)=>(Number(pw)||0)*(1-LG_FORM_W/2+LG_FORM_W*((mp|0)<LG_FORM_MIN?0.5:Math.max(0,Math.min(1,Number(lwr)))));
function leagueIdx(rating,prev){
 prev=Math.max(0,Math.min(LEAGUE.length-1,prev|0));
 let up=0,keep=0;for(let k=0;k<LG_AT.length;k++){if(rating>=LG_AT[k])up=k+1;if(rating>=LG_AT[k]*(1-LG_DEMOTE))keep=k+1;}
 return up>=prev?up:Math.max(up,Math.min(prev,keep));
}
const leagueInfo=i=>{i=Math.max(0,Math.min(LEAGUE.length-1,i|0));return {...LEAGUE[i],i,pay:LG_BASE_PAY[i],mult:LG_MULT[i],ai:LG_AI[i],at:i?LG_AT[i-1]:0,next:LG_AT[i]||null};};
// a match's points in a league: base = the match's pay x league base pay (counts for the airdrop and the cap); pts = base x the
// spendable multiplier (what you can spend). raw: the mode's pay with featured and streak, before the league
const leaguePay=(raw,lg)=>{const L=leagueInfo(lg),base=Math.round(Math.max(0,raw)*L.pay);return {base,pts:Math.round(base*L.mult)};};
// a pilot's league now (the server keeps it on the record as lgi, so a gear change or a run of results moves it there)
function ecoLeague(S,pw){S.lgi=leagueIdx(leagueRating(pw,S.lwr,S.mp),S.lgi);S.lg=LEAGUE[S.lgi].key;return leagueInfo(S.lgi);}
function ecoForm(S,r){const f=typeof S.lwr==='number'&&Number.isFinite(S.lwr)?S.lwr:0.5;S.lwr=Math.round((f+(r-f)/LG_FORM_N)*10000)/10000;}
// ---- gear and tank stats from a loadout ----
// A loadout is everything that sets a tank's stats: {w:{a,t,q,s}, c:{c,t,q,s}, up:{hull..reactor}, cores:[3], gl:{gem levels}, skin, paint}
// t = rarity (-1 stock, 0 common, 1 rare, 2 epic), q = crate roll (1.05-1.10, 1 for starter gear) or the salvage multiplier, s = salvaged
function weaponOf(arch,t,q,sal){
 if(arch==='moon'){const b=WEAPONS.moon;return {arch:'moon',tier:2,dps:b.dps,shot:b.shot,pspd:26,premium:true,mult:LEGENDARY_MULT,edge:MOON_EDGE,q:1,sal:false};}
 const tc=Math.max(0,t|0),b=WEAPONS[arch]||WEAPONS.pulse,mt=sal?q:TIER_MULT[tc]*q;
 return {arch,tier:t,sal:!!sal,q,mult:mt,dps:Math.round(b.dps*mt),shot:b.shot,pspd:22+2*tc};
}
function chassisOf(cls,t,q,sal){
 const tc=Math.max(0,t|0),b=CH[cls]||CH.vanguard,mt=sal?q:TIER_MULT[tc]*q;
 return {cls,tier:t,sal:!!sal,q,mult:mt,hp:Math.round(b.hp*mt*100)/100,spd:Math.round(b.spd*(1+(mt-1)*0.5)*100)/100,turn:Math.round((b.turn+0.05*tc)*100)/100,size:b.ds};
}
const auraOf=it=>it.premium?3:it.sal?0:Math.max(0,it.tier);   // rarity ring under the tank: none, rare, epic, legendary
// Power (gear score): one number for how hard a tank hits in a fight, fitted to measured duels on the real sim
// (dev/tests/s2/power-pairs.mjs + docs/launch/LEAGUES.md: 500 random kit pairs, stock to full Legendary, 240 duels each).
// Every stat the fight uses counts: health, armor, damage, crits, super strength and charge, speed, turret turn, shot speed,
// mods, cores, upgrades, Lunar Skin and the chassis class. Two tanks' powers give the gear-predicted win chance (powerWin):
// P = 1 / (1 + (pB/pA)^POWER_K), plus COUNTER_EDGE when one chassis counters the other. Starter tank = 68.
const POWER_W={h:6.61,a:6.95,d:5.80,c:6.31,su:1.50,fi:1.84,s:3.59,r:1.27,hc:1.61,tu:1.20,ps:1.49,sc:0.29,ti:-0.03,hh:0.49,ss:0.87,dd:-0.33,hd:0.27,hs:-0.51,ds:-1.17};
const POWER_WPN={pulse:0,twin:0.34,siege:0.21,moon:1.20};   // weapon type (its super's base damage included: Siege Blast 375, Moonfall 400 at full width, the others 350; Moonbeam refit on 90 pairs)
const POWER_BASE=68,POWER_K=13.75,COUNTER_EDGE=1.72;
function powerZ(L){
 const t=tankOf(L,1),g=k=>t.gems.includes(k)?GEM[k].amt*t.gemM[k]:0,W=POWER_W,ln=Math.log;
 const h=ln(t.mhp*plateEhp(t.enR,t.arR)/STAT.hp),d=ln(t.wdps*t.dmgM*(1+g('dmg'))*(1+g('rof'))*projectileImpactMult(t)/STAT.dps),s=ln(t.spdM*(1+g('spd')));
 return W.h*h+W.a*-ln(1-Math.min(0.7,g('arm')))+W.d*d+W.c*ln(1+CRIT_BASE+t.critB+g('lck'))+W.su*ln((t.wmult||TIER_MULT[Math.max(0,t.wtier|0)])*t.dmgM*(1+g('dmg'))*(t.wtype==='siege'?projectileImpactMult(t):1))
  +W.fi*ln(t.fillM)+W.s*s+W.r*g('reg')*100+W.hc*ln(t.hitChg||1)+W.tu*ln(t.turnM)+W.ps*ln(t.wpspd/22)+(t.cls==='scout'?W.sc:t.cls==='titan'?W.ti:0)
  +(POWER_WPN[t.wtype]||0)+W.hh*h*h+W.ss*s*s+W.dd*d*d+W.hd*h*d+W.hs*h*s+W.ds*d*s;
}
let POWER_Z0=null;
function powerOf(L){if(POWER_Z0===null)POWER_Z0=powerZ(STOCK_L);return Math.round(POWER_BASE*Math.exp((powerZ(L)-POWER_Z0)/POWER_K));}
// gear-predicted chance that A beats B (pA, pB: powers; ctr +1 if A's chassis counters B's, -1 the other way, 0 same class).
// live: between people (the live lobby's mismatch cap). Bot duels turn small edges into near-certain wins (bots hit ~96% of
// shots); POWER_K_LIVE / COUNTER_EDGE_LIVE are fitted on the same kit pairs flown by the human pilot profile (dev/tests/s2/live-slope.mjs)
const POWER_K_LIVE=3.10,COUNTER_EDGE_LIVE=0.46;   // fitted: 60 held-out kit pairs x 96 human-profile duels (bots: 13.75 / 1.72)
function powerWin(pA,pB,ctr,live){return 1/(1+Math.exp(-((live?POWER_K_LIVE:POWER_K)*Math.log(Math.max(1,pA)/Math.max(1,pB))+(live?COUNTER_EDGE_LIVE:COUNTER_EDGE)*(ctr||0))));}
const STOCK_L={w:{a:'pulse',t:0,q:1,s:false},c:{c:'vanguard',t:0,q:1,s:false},up:{hull:0,cannon:0,engine:0,target:0,reactor:0},cores:['dmg','rof','arm'],gl:{},skin:'default',paint:'stock'};   // a new pilot's tank
// ---- AI difficulty (AI matches). Session 5D (owner rule, Nov 9 2026): THE LEAGUE SETS THE AI. AI pilots never copy your gear,
// upgrades, cores or power. Each league has one authored AI power (LG_AI_PW: the tank you meet there), moved by at most
// AI_GEAR_LO..AI_GEAR_HI for your own gear level ((your power / the league's reference pilot)^AI_GEAR_EXP: a slight adjustment that
// keeps top gear from making a league trivial, never enough to even the fight), never above AI_CAP (a hard cap below the top player
// gear: no Moonbeam, no Lunar Skin, no full 14-level build) and never above your own power. The AI flies the strongest authored
// loadout (AI_TIERS: t rarity, q roll, h hull and cannon levels, e engine levels, g core levels [dmg,rof,arm]; p its power, checked by
// dev/tests/combat-balance.mjs) at or under that power. Inside a league the AI never changes with your results (no rubber-banding).
// Why not a curve of your power (the Oct 31 and Nov 2 models, 68 x (power/68)^0.7 x a league step): it followed every upgrade, so a
// Legendary pilot met an AI at 77% of their power with a full Epic build, level-5 cores and a reactor, and at top gear supers (which
// charge from damage taken too) made that a near-even trade (owner, Nov 8: 16,385 dealt vs 16,160 taken). Measured on the real sim:
// dev/tests/fair-arcade-grid.mjs, docs/launch/s5d/FAIR_ARCADE.md; locked by dev/tests/fair-arcade.mjs (CI).
const AI_TIERS=[[0,1,0,0,[1,1,1],68],[0,1,1,0,[1,1,1],73],[0,1,1,1,[2,2,2],77],[0,1.05,1,1,[1,1,1],79],[1,1.05,0,0,[1,1,1],85],[1,1.05,0,1,[2,2,2],88],[1,1.05,1,0,[1,1,1],92],
 [1,1.05,1,1,[2,1,1],94],[1,1.05,1,1,[2,2,2],95],[1,1.08,1,1,[2,2,2],98],[1,1.05,2,1,[2,2,2],102],[1,1.08,2,2,[2,2,2],107],[1,1.05,3,2,[2,2,2],111],
 [2,1.05,1,1,[2,2,2],115],[1,1.05,4,2,[3,2,2],119],[2,1.05,2,1,[2,2,2],124],[2,1.05,2,1,[3,2,2],125],[2,1.05,2,1,[3,3,2],126],[2,1.05,2,1,[3,3,3],128],[1,1.1,4,1,[4,4,4],132],
 [2,1.05,3,1,[3,3,3],137],[2,1.08,3,2,[3,3,3],143],[2,1.08,3,2,[4,3,3],145],[2,1.08,3,2,[4,4,3],147],[2,1.08,3,2,[4,4,4],149],[2,1.05,4,2,[4,4,4],154],
 [2,1.08,4,2,[4,4,4],159],[2,1.1,4,2,[4,4,4],162]   // the top: Epic items, 10 of 14 upgrade levels, level-4 cores, no reactor, no mod. Never Moonbeam or Lunar Skin
].map(([t,q,h,e,g,p,x])=>({t,q,h,e,g,p,x:x||{}}));
const AI_CAP=165;   // the hard cap: no AI pilot (or megatank reference) above this power. Top free kit 213, full Legendary kit 235
// per league (Rookie .. Lunar Legend): the AI power, the reference pilot power it is tuned for (the middle of the league's rating
// band: a stock tank is 68, the Pilot line 84, each line x1.21), how long an AI pilot holds a ready super before firing (seconds in
// sight and range; a player can fire the instant it is charged) and how often it dashes out of a super it sees coming
const LG_AI_PW=[68,72,82,98,120,134,146];LG_AI=LG_AI_PW.map(p=>Math.round(p/LG_AI_PW[0]*1000)/1000);
const LG_AI_REF=[72,92,112,135,164,198,235];
const AI_GEAR_EXP=0.3,AI_GEAR_LO=0.88,AI_GEAR_HI=1.12;
const LG_AI_SUP_WAIT=[1.0,0.85,0.7,0.6,0.5,0.5,0.5],LG_AI_DODGE=[0.35,0.4,0.45,0.5,0.5,0.5,0.5];
// Owner, Nov 10: "the AI supers every 1-2 s, 3-5x my own". Measured: every AI obeyed the charge rule, but each AI fires the instant it
// is charged (a person is slower), and in team modes five AI tanks' supers add up to one every 1-2 s. So on top of the player's own
// charge rule every AI pilot keeps a minimum time between its supers (by league) and AI teammates never fire within AI_SUP_TEAM_GAP of
// each other. These only ever make the AI fire less than a player could; a player keeps firing the instant the charge is full
const LG_AI_SUP_GAP=[12,11,10,9,8,7,6],AI_SUP_TEAM_GAP=2;
// Last Standing: five rivals at the league's AI, every tank for itself: the league step is diluted (LG_SOLO_W of it) so a place
// among six stays reachable; team modes meet the league's AI in full (your wingmen fly it too)
const LG_SOLO_W=0.7;
const aiGearAdj=(pw,lg)=>Math.max(AI_GEAR_LO,Math.min(AI_GEAR_HI,Math.pow(Math.max(1,Number(pw)||0)/LG_AI_REF[lg],AI_GEAR_EXP)));
// the AI power for a league and a pilot (before the loadout step): the league anchor, the bounded gear adjustment, the caps
function aiPowerFor(pw,lg,n){
 lg=Math.max(0,Math.min(LEAGUE.length-1,lg|0));
 const base=n==='solo'?LG_AI_PW[0]+(LG_AI_PW[lg]-LG_AI_PW[0])*LG_SOLO_W:LG_AI_PW[lg];
 return Math.min(Math.max(AI_TIERS[0].p,Number(pw)||0),AI_CAP,base*aiGearAdj(pw,lg));
}
// e: kept for older callers (the Oct 31 curve exponent); ignored. lg: league index (0 Rookie), n: team size or 'solo'
function aiLevel(pw,e,lg,n){const a=aiPowerFor(pw,lg,n);let i=0;for(let k=1;k<AI_TIERS.length;k++)if(AI_TIERS[k].p<=a)i=k;return {i,p:AI_TIERS[i].p,lg:Math.max(0,Math.min(LEAGUE.length-1,lg|0))};}
// the Survival megatank is tuned to the same league AI's reference tank (never to your own tank)
function aiBossLevel(pw,lg,n){return aiLevel(pw,undefined,lg,n);}
function aiLoadout(i,arch,cls){
 const A=AI_TIERS[Math.max(0,Math.min(AI_TIERS.length-1,i|0))];
 return {w:{a:WORDER.includes(arch)?arch:'pulse',t:A.t,q:A.q,s:false},c:{c:CH[cls]?cls:'vanguard',t:A.t,q:A.q,s:false},up:{hull:A.h,cannon:A.h,engine:A.e,target:A.x.tg|0,reactor:A.x.rc|0},
  cores:['dmg','rof','arm'],gl:{dmg:A.g[0],rof:A.g[1],arm:A.g[2]},skin:'default',paint:'stock',...(A.x.m?{mods:{...A.x.m}}:{})};
}
// ghosts in AI matches: offline pilots' real tanks in AI seats, only when clearly weaker than you AND no stronger than the match's
// AI x AI_GHOST_X (a ghost never turns a league's fight into a hidden max-gear duel), never more than one on the enemy team
const AI_GHOST_LO=0.7,AI_GHOST_HI=0.95,AI_GHOST_X=1.05;
const aiGhostCap=(pw,aiP)=>Math.min((Number(pw)||0)*AI_GHOST_HI,(Number(aiP)||0)*AI_GHOST_X);
// the stat block a tank fights with (n = health scale for the mode and team size)
function tankOf(L,n){
 const T=legacyTankOf(L,n),F=fittingStats(L.mods);
 if(F.hp)T.mhp=Math.round(T.mhp*(1+F.hp));if(F.spd)T.spdM*=1+F.spd;if(F.dps)T.wdps*=1+F.dps;
 // mod behavior effects (game.js reads them; 1 = standard)
 if(F.turn)T.turnM*=1+F.turn;if(F.shotSpd)T.wpspd=Math.round(T.wpspd*(1+F.shotSpd)*100)/100;if(F.charge)T.fillM*=1+F.charge;
 if(F.supTaken)T.supTk=1+F.supTaken;if(F.hitCharge)T.hitChg=1+F.hitCharge;if(F.dashCd)T.dashCdM=1+F.dashCd;if(F.shieldCd)T.shieldCdM=1+F.shieldCd;
 // Apply Velocity once to the actual shot speed, after the existing fitting calculation.
 if(T.gems.includes('vel'))T.wpspd*=1+coreVal('vel',L.gl&&L.gl.vel);
 // Hull Plating: max hull HP per plate and the set traits (energy / area damage taken), the same in every mode
 const Pl=plateStats(L.ap);if(Pl.hp){T.mhp=Math.round(T.mhp*(1+Pl.hp));T.ap=Pl.ap;}if(Pl.e)T.enR=Pl.e;if(Pl.a)T.arR=Pl.a;
 if(hasFittings(L))T.fits=fittingVisuals(L);return T;
}
function legacyTankOf(L,n){
 const U=L.up,W0=weaponOf(L.w.a,L.w.t,L.w.q,L.w.s),Cc=chassisOf(L.c.c,L.c.t,L.c.q,L.c.s),lun=L.skin==='lunar';
 return {gems:(L.cores||[]).filter(Boolean),gemM:Object.fromEntries(GORDER.map(k=>[k,gemLvMult(L.gl&&L.gl[k])])),
  mhp:Math.round(STAT.hp*(1+0.08*U.hull)*Cc.hp*(lun?SKIN_HP:1)*n),dmgM:(1+0.08*U.cannon)*(lun?SKIN_DMG:1),spdM:(1+0.06*U.engine)*Cc.spd,
  critB:0.02*U.target,fillM:1+0.10*U.reactor,turnM:Cc.turn,
  wtype:W0.arch,wdps:W0.dps,wshot:W0.shot,wedge:W0.edge||GRAZE,wpspd:W0.pspd,wtier:W0.tier,wmult:W0.mult,chm:Cc.mult,dscale:Cc.size,cls:Cc.cls,
  aura:Math.max(auraOf(W0),auraOf(Cc)),paint:PAINTS[L.paint]?L.paint:'stock',skin:L.skin==='lunar'?'lunar':'default',vl:Math.max(0,Math.min(999,Math.floor(Number(L.vl)||0)))};
}

// =====================================================================
// economy: points, quests, login streak, Lunar Pass, crates, upgrades, squad payouts, purchases.
// Pure functions over an economy state S (same field names as the phone's save). In Telegram only the server runs
// them, so only the server can change a pilot's points and gear; outside Telegram the phone runs them for local play.
// X = {day, week, rnd, pk}: UTC day and week numbers, a random source (0..1), the player id (picks the dailies)
// =====================================================================
const DAILY_CAP=50000;   // max base points a pilot can bank per UTC day, one cap for Arcade, PvP and Conquest (owner, Nov 8 2026)
// ---- Conquest airdrop points (docs/economy/RESOURCE_ECONOMY.md §3): base points per server-verified Conquest outcome at
// Rookie. The account credit multiplies them by the league's base pay (LG_BASE_PAY, as Arcade) and pays the spendable bonus
// (LG_MULT) on top, through ecoPlayAward: the same daily cap, boards, airdrop credit and squad bonus as a match.
// Values = par minutes x 225 x danger (STANDARD 1, HARD 1.2, VETERAN 1.45): about Arcade's points a minute per league.
const CQ_PTS={kill:{light:35,heavy:90},field:450,raid:{HARD:900,VETERAN:1300},defense:675,strike:1075,gather:{flora:80,fe:100,il:140,ar:240,tq:390},hourMax:120};
const CQ_BASE_MULT=[1,1.05,1.10,1.15,1.20,1.25];   // Command Base tier (none, I..V): multiplies Conquest active-play points only
// Daily Base Yield: one full 24 h fill by Command Base tier. CP keeps the base production formula (ConquestCombat.baseProduction).
// It fills continuously, stops when full, is collected at the physical base (from min of a fill), and its points part
// needs one verified Conquest operation that UTC day (no pure AFK points). The points count inside the daily cap.
const CQ_YIELD={day:86400000,min:0.1,pts:[0,1000,1400,1800,2200,2600],alloy:[0,6,9,12,15,18],biomass:[0,4,6,8,10,12],helium:[0,1,1,2,2,3]};
// ---- minerals and Hull Plating (docs/economy/RESOURCE_ECONOMY.md §5-6, owner-approved Nov 8 2026) ----
// Six minerals, common to legendary. The account wallet (S.mn) is shared by every mode; Conquest carries them as cargo first.
const MINERALS={fe:{n:'Ferrite Regolith',s:'Ferrite',r:'common',c:'#c0703f'},il:{n:'Ilmenite',s:'Ilmenite',r:'uncommon',c:'#5f86b8'},ar:{n:'Armalcolite',s:'Armalcolite',r:'rare',c:'#57d2ea'},
 tq:{n:'Tranquillityite',s:'Tranquillityite',r:'very rare',c:'#ff7a3d'},se:{n:'Selenite Glass',s:'Selenite',r:'epic',c:'#c8a2ff'},mh:{n:'Moonheart',s:'Moonheart',r:'legendary',c:'#a8e4ff'}};
const MN_ORDER=['fe','il','ar','tq','se','mh'];
const mnOf=v=>{const o={};for(const k of MN_ORDER){const n=Math.floor(Number(v&&v[k]));o[k]=n>0&&n<1e7?n:0;}return o;};
// Plates: four slots on every hull, tier 0 (none) .. 6 (Moonheart). HP adds up per plate; a set trait needs all four at that
// tier or better. Traits: energy / area damage taken (Moonbeam and Moonfall are exempt: owner decision 2).
const PLATE={slots:['FRONT','LEFT','RIGHT','TURRET'],hp:[0,0.01,0.0175,0.025,0.03,0.035,0.04],
 cost:[null,{fe:40,pts:300},{il:40,fe:20,pts:1500},{ar:30,il:20,pts:4000},{tq:20,ar:15,pts:8000},{se:6,tq:10,pts:15000},{mh:3,se:4,pts:25000}],
 traits:{5:{e:0.10},6:{e:0.10,a:0.10}},eShare:0.35,aShare:0.15};   // e/aShare: the share of damage taken that is energy/area, used only to value traits in power
const apOf=v=>[0,1,2,3].map(i=>{const t=Math.round(Number(v&&v[i]));return t>=1&&t<=6?t:0;});
function plateStats(ap){const a=apOf(ap),set=Math.min(a[0],a[1],a[2],a[3]),T=PLATE.traits[set>=6?6:set>=5?5:0]||{};return {ap:a,hp:a.reduce((n,t)=>n+PLATE.hp[t],0),set,e:T.e||0,a:T.a||0};}
const plateEhp=(e,a)=>1/(1-(e||0)*PLATE.eShare-(a||0)*PLATE.aShare);   // traits valued as effective HP in power (gear rating)
// Arcade/PvP mineral drops: server-verified results only, straight to the wallet (§5.5). rnd: the server's random source
const MN_DROP={win:{fe:[1,0.5],il:[0,0.20],ar:[0,0.06]},draw:{fe:[1,0],il:[0,0.10]},loss:{fe:[0,0.5]}};   // [guaranteed, chance of +1]
// weekly league minerals, at the 20th verified Arcade/PvP match of a UTC week (fractions are a chance of +1)
// Conquest minerals (§5.2-5.4). A pull: channel ms and units (server roll, capped by what the vein holds), the 3% Selenite vein;
// the one-time Starter Vein (35 Ferrite). Scanner pulse. Operation caches on victory (fractions are a chance of +1). Meteor Strike.
const MN_GATHER={fe:{ms:5000,min:2,max:4},il:{ms:8000,min:1,max:3},ar:{ms:12000,min:1,max:2},
 tq:{ms:16000,min:1,max:1,vein:0.03},starter:{ms:5000,min:35,max:35,once:true}};
// Veins run dry, new ones appear (owner ore fix, Nov 8 2026): each (mineral, sector) field keeps `live` veins (more where named)
// at its authored spots; a vein holds `cap` units (a few pulls), then is EXHAUSTED for that pilot and a new vein of that mineral
// surfaces at another spot of the same sector `regrowMs` later (seeded per pilot and day, server-only, hidden until a SCAN).
// The MAP keeps an exhausted vein for `dryShowMs`, then it disappears.
const MN_VEIN={fe:{cap:12,regrowMs:21600000,live:1,more:{refuge:2}},il:{cap:6,regrowMs:43200000,live:1},ar:{cap:5,regrowMs:172800000,live:1},
 tq:{cap:3,regrowMs:432000000,live:1},dryShowMs:600000};
const MN_SCAN={cooldownMs:30000,radius:150,perRadar:50};
const MN_CACHE={field:{fe:3,il:0.5},HARD:{il:2,ar:0.4},VETERAN:{ar:1.5,tq:0.3},defense:{fe:2,il:1}};
const STRIKE={everyMs:7200000,telegraphMs:300000,windowMs:1200000,channelMs:16000,cp:120,guaranteed:{il:2,ar:2},tq:0.5,se:0.15,mh:0.025,resonance:{se:12,mh:40}};
const MN_WEEKLY_N=20,MN_WEEKLY=[{fe:20},{fe:30,il:5},{fe:40,il:10,ar:2,tq:0.25},{il:12,ar:4,tq:0.25},{il:15,ar:5,tq:0.5},{ar:6,tq:1},{ar:8,tq:2}];
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
// Lunar Skin: owner-set price (Nov 2, 2026), just under Moonbeam's: measured with human pilots its edge alone (59.3%) is a
// little below Moonbeam's alone (62.0%) (docs/EQUIPMENT_BALANCE_VALIDATION.md, Session 2)
const STARTER={ton:6,stars:399},FOUNDER={ton:19,stars:1199},MOONBEAM_PRICE=50,SKIN_PRICE=45;
const PREMIUM={moonbeam:{ton:MOONBEAM_PRICE,stars:3300},skin:{ton:SKIN_PRICE,stars:3000},starter:STARTER,founder:FOUNDER};
// ---- Hyperspace Vault: an endless deposit for looks only. Gold is never spent and never expires; lifetime Gold sets
// your Vault level, and each level unlocks a look (badge, gold tooth, gold name, trail, paint, aura, titles). It gives no
// stats, power or points. Bigger bundles carry bonus Gold. Every deposit is verified shop spending like any other buy
const VAULT={pouch:{n:'Pouch',stars:250,ton:4,g:250},chest:{n:'Chest',stars:1000,ton:16,g:1050},vault:{n:'Vault',stars:5000,ton:80,g:5500},hyper:{n:'Hyperspace',stars:25000,ton:400,g:28750}};
const VAULT_ORDER=['pouch','chest','vault','hyper'];
const VLV=[250,750,1500,3000,5000,7500,10000],VLV_STEP=5000;   // Gold for levels 1-7, then +5,000 a level, forever
const vaultNeed=l=>l<=0?0:l<=VLV.length?VLV[l-1]:VLV[VLV.length-1]+(l-VLV.length)*VLV_STEP;   // lifetime Gold to reach level l
function vaultLevel(g){g=Number(g)||0;if(g<VLV[0])return 0;let l=0;while(l<VLV.length&&g>=VLV[l])l++;if(l<VLV.length)return l;return VLV.length+Math.floor((g-VLV[VLV.length-1])/VLV_STEP);}
// what each level unlocks (the looks read the level, so a level never has to be claimed)
const VAULT_REW=[{lv:1,k:'tooth',n:'Vault badge and a gold tooth',d:'Your level badge on every board, VS and results screen. A gold tooth on your hull.'},
 {lv:3,k:'name',n:'Gold name',d:'Your name in gold on the boards and in live matches.'},
 {lv:5,k:'trail',n:'Gold engine trail',d:'A trail of gold behind your tank as it moves.'},
 {lv:7,k:'paint',n:'Hyperspace paint',d:'A paint that’s never sold. Only Vault pilots have it.'},
 {lv:10,k:'aura',n:'Glowing tooth and a gold aura',d:'The tooth glows, and a gold ring circles your tank.'},
 {lv:15,k:'keeper',n:'Title: Vault Keeper',d:'Shown under your name on the boards.'},
 {lv:25,k:'legend',n:'Title: Gold Tooth Legend',d:'The top title, plus a hyperspace shimmer over your tank.'}];
const VAULT_PAINT_LV=7;
// Genesis Gold: every Gold deposited before $LUNAR launches is also recorded as Genesis Gold (vgg), kept for good. It may
// unlock limited-edition Genesis rewards down the road. Closes with the Founder pack at launch (FOUNDER_OPEN)
const GENESIS_OPEN=FOUNDER_OPEN;
const vaultTitle=l=>l>=25?'Gold Tooth Legend':l>=15?'Vault Keeper':'';
// the badge's color steps up every 5 levels: bronze, silver, gold, diamond, hyperspace
const VAULT_TIERS=[{n:'Bronze',c:'#d08c4f'},{n:'Silver',c:'#cfd8e4'},{n:'Gold',c:'#ffcf4a'},{n:'Diamond',c:'#86e8ff'},{n:'Hyperspace',c:'#c79bff'}];
const vaultTier=l=>VAULT_TIERS[Math.max(0,Math.min(4,Math.floor((l||0)/5)))];
// milestone quests (one-time)
// one-time milestones: each worth at least a match (a match pays ~350-1,200); the links pay like a day's quest so
// they actually get clicked (the channel most: it's checked, and it's where airdrop news lands)
const QUESTS=[
 {id:'q_win1',n:'First blood',d:'Win your first match',pts:500,goal:1},
 {id:'q_win3',n:'Warmonger',d:'Win 3 matches',pts:1000,goal:3},
 {id:'q_dmg',n:'Heavy hitter',d:'Deal 2,500 damage in one match',pts:500,goal:2500},
 {id:'q_super',n:'Overcharged',d:'Fire your super twice in one match',pts:500,goal:2},
 {id:'q_box',n:'Scavenger',d:'Grab 3 mystery boxes in one match',pts:500,goal:3},
 {id:'q_clean',n:'Untouchable',d:'Win a match without dropping below 75% health',pts:1500,goal:1},
 {id:'q_wiki',n:'Read the wiki',d:'Read it to the end, then tap Claim at the bottom',pts:2000,goal:1,link:'wiki',read:1},
 {id:'q_x',n:'Follow on X',d:'Updates and announcements',pts:1000,goal:1,link:'x'},
 {id:'q_tg',n:'Join the channel',d:'Airdrop news first',pts:1500,goal:1,link:'tg'}].filter(q=>!q.link||LINKS[q.link]);
const MS_BY={};QUESTS.forEach(q=>MS_BY[q.id]=q);
// daily quests: 4 a day (2 easy, 1 medium, 1 hard), picked per player per day; finish all 4 for a bonus.
// 1 free swap a day (2 with the premium pass). Weekly: 5 quests a week, plus a chest for claiming 20 dailies.
// Your login streak boosts every quest's points (ecoBoost). Stats come from each finished match (ecoAfterMatch).
// every daily quest pays 500 points (Easy, Medium and Hard alike), before the quest streak bonus
const DQ_POOL=[
 {id:'play4',lv:0,t:'Play 4 matches',goal:4,pts:500,st:'plays'},
 {id:'win2',lv:0,t:'Win 2 matches',goal:2,pts:500,st:'wins'},
 {id:'box3',lv:0,t:'Grab 3 mystery boxes',goal:3,pts:500,st:'boxes'},
 {id:'sup3',lv:0,t:'Fire 3 supers',goal:3,pts:500,st:'sups'},
 {id:'dmg6k',lv:0,t:'Deal 6,000 damage',goal:6000,pts:500,st:'dmg'},
 {id:'kill4',lv:0,t:'Destroy 4 enemy tanks',goal:4,pts:500,st:'kills'},
 {id:'feat1',lv:0,t:'Play a featured-mode match',goal:1,pts:500,st:'featured'},
 {id:'quick1',lv:0,t:'Play a Quick Match',goal:1,pts:500,st:'quick'},
 {id:'win4',lv:1,t:'Win 4 matches',goal:4,pts:500,st:'wins'},
 {id:'kill10',lv:1,t:'Destroy 10 enemy tanks',goal:10,pts:500,st:'kills'},
 {id:'dmg15k',lv:1,t:'Deal 15,000 damage',goal:15000,pts:500,st:'dmg'},
 {id:'kill4m',lv:1,t:'Destroy 4 tanks in one match',goal:4,pts:500,st:'kills',mx:1},
 {id:'nodie',lv:1,t:'Win without being destroyed',goal:1,pts:500,st:'cleanWins'},
 {id:'zwin',lv:1,t:'Win a Moon Zone match',goal:1,pts:500,st:'zoneWins'},
 {id:'cap3',lv:1,t:'Capture the Moon Zone 3 times',goal:3,pts:500,st:'caps'},
 {id:'cry10',lv:1,t:'Collect 10 crystals in Crystal Rush',goal:10,pts:500,st:'crystals'},
 {id:'bnt5',lv:1,t:'Earn 5 bounty stars',goal:5,pts:500,st:'stars'},
 {id:'top3',lv:1,t:'Finish top 3 in Last Standing',goal:1,pts:500,st:'top3'},
 {id:'twin',lv:1,t:'Win a 2v2 or 3v3 match',goal:1,pts:500,st:'teamWins'},
 {id:'ovpw',lv:1,t:'Win a match on Overpass',goal:1,pts:500,st:'ovpWins'},
 {id:'win6',lv:2,t:'Win 6 matches',goal:6,pts:500,st:'wins'},
 {id:'row3',lv:2,t:'Win 3 matches in a row',goal:3,pts:500,st:'streak',mx:1},
 {id:'nodie2',lv:2,t:'Win 2 matches without being destroyed',goal:2,pts:500,st:'cleanWins'},
 {id:'sweep',lv:2,t:'Win a 1v1 Arena match 2-0',goal:1,pts:500,st:'sweeps'},
 {id:'ls1',lv:2,t:'Win a Last Standing match',goal:1,pts:500,st:'royaleWins'},
 {id:'featw3',lv:2,t:'Win 3 featured-mode matches',goal:3,pts:500,st:'featWins'},
 {id:'bntw2',lv:2,t:'Win 2 Bounty matches',goal:2,pts:500,st:'bountyWins'},
 {id:'cryw2',lv:2,t:'Win 2 Crystal Rush matches',goal:2,pts:500,st:'crystalWins'}];
const DQ_SLOTS=[0,0,1,2],DQ_LV=['Easy','Medium','Hard'],DQ_ALL_BONUS=1000,DQ_SWAPS=1;
// Weekly quests are the same for every pilot: the first WQ_FIXED every week, plus WQ_N-WQ_FIXED picked by the week.
// u: counts different values (days played, modes won), not a total. mx: best single match (or current win streak).
// pd: on how many different days you reached pd of it (N a day on M days); goal counts days
const WQ_POOL=[
 {id:'wdays',t:'Play on 5 different days',goal:5,pts:3000,st:'day',u:1},
 {id:'wquick30',t:'Play 30 Quick Matches',goal:30,pts:5000,st:'quick'},
 {id:'wwin20',t:'Win 20 matches',goal:20,pts:4000,st:'wins'},
 {id:'wplay35',t:'Play 35 matches',goal:35,pts:3500,st:'plays'},
 {id:'wkill50',t:'Destroy 50 enemy tanks',goal:50,pts:3000,st:'kills'},
 {id:'wdmg',t:'Deal 80,000 damage',goal:80000,pts:3000,st:'dmg'},
 {id:'wmodes',t:'Win in 4 different modes',goal:4,pts:3000,st:'winMode',u:1},
 {id:'wzone6',t:'Win 6 Moon Zone matches',goal:6,pts:3000,st:'zoneWins'},
 {id:'wteam8',t:'Win 8 team matches (2v2 or 3v3)',goal:8,pts:3000,st:'teamWins'},
 {id:'wls3d',t:'Win Last Standing on 3 different days',goal:3,pts:4000,st:'royaleWins',pd:1},
 {id:'wrow5',t:'Win 5 matches in a row',goal:5,pts:3000,st:'streak',mx:1},
 {id:'wfeat16',t:'Play 16 featured-mode matches',goal:16,pts:4000,st:'featured'},
 {id:'wsup60',t:'Fire 60 supers',goal:60,pts:3500,st:'sups'},
 {id:'wbox30',t:'Grab 30 mystery boxes',goal:30,pts:2500,st:'boxes'},
 {id:'wclean4d',t:'Win 2 matches without being destroyed on 4 different days',goal:4,pts:4000,st:'cleanWins',pd:2},
 {id:'wcap30',t:'Capture the Moon Zone 30 times',goal:30,pts:4000,st:'caps'}];
const WQ_N=5,WQ_FIXED=2,PASS_XP_WQ=150,WQ_GOAL=20,WQ_PTS=5000;   // WQ_GOAL dailies open the weekly chest
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
const PASS_LEN=30,PASS_TIERS=30,PASS_XP=350,PASS_START=20744,PASS_PRICE={ton:13,stars:799};   // season 1 opened Oct 18, 2026 (UTC day 20744)
// Season 1 is the launch season: its 30-day clock is frozen until Nov 1 (PASS_CLOCK) and it ends Dec 1 (PASS_S2).
// Early pilots get PASS_BONUS extra tiers (31-38) in season 1 only. Every later season is 30 days and 30 tiers.
const PASS_CLOCK=20758,PASS_S2=20788,PASS_BONUS=8;
const passTiers=s=>s===1?PASS_TIERS+PASS_BONUS:PASS_TIERS;
const passStart=s=>s===1?PASS_START:PASS_S2+(s-2)*PASS_LEN;
const passEnd=s=>PASS_S2+(s-1)*PASS_LEN;
const PASS_XP_WIN=40,PASS_XP_DRAW=25,PASS_XP_LOSS=20,PASS_XP_FEAT=10,PASS_XP_QUEST=50,PASS_XP_ALL=100;
const PASS_FREE=[null,{k:'pts',n:150},{k:'box',tk:'gem',ri:0},{k:'pts',n:150},{k:'pts',n:200},{k:'box',tk:'weapon',ri:0},{k:'pts',n:200},{k:'box',tk:'gem',ri:0},{k:'pts',n:250},{k:'pts',n:250},{k:'box',tk:'chassis',ri:0},
 {k:'pts',n:250},{k:'box',tk:'gem',ri:0},{k:'pts',n:300},{k:'pts',n:300},{k:'box',tk:'gem',ri:1},{k:'pts',n:300},{k:'box',tk:'gem',ri:0},{k:'pts',n:350},{k:'pts',n:350},{k:'box',tk:'weapon',ri:0},
 {k:'pts',n:350},{k:'box',tk:'gem',ri:0},{k:'pts',n:400},{k:'pts',n:400},{k:'box',tk:'gem',ri:1},{k:'pts',n:400},{k:'box',tk:'gem',ri:0},{k:'pts',n:500},{k:'pts',n:500},{k:'paint',id:'regolith'},
 // season 1 early bonus tiers 31-38
 {k:'pts',n:500},{k:'box',tk:'gem',ri:0},{k:'pts',n:600},{k:'box',tk:'weapon',ri:0},{k:'pts',n:600},{k:'box',tk:'gem',ri:1},{k:'pts',n:750},{k:'box',tk:'chassis',ri:0}];
const PASS_PREM=[null,{k:'paint',id:'eclipse'},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'weapon',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:1},
 {k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'chassis',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'paint',id:'aurora'},
 {k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'weapon',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'chassis',ri:2},
 // season 1 early bonus tiers 31-38
 {k:'box',tk:'gem',ri:1},{k:'box',tk:'weapon',ri:1},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:2},{k:'box',tk:'gem',ri:1},{k:'box',tk:'chassis',ri:1},{k:'box',tk:'gem',ri:1},{k:'box',tk:'weapon',ri:2}];
// daily login reward: 7-day streak calendar (misses reset it) + tier bonus
const STREAK_PTS=[100,150,200,250,300,400,1000];
// squad (referrals): you get paid when your recruits keep playing
const REF_MS=[{days:2,pts:1500,r:500,n:'Comes back the next day'},{days:5,pts:5000,r:2000,n:'5 days active, 5K points'},{days:10,pts:20000,r:5000,n:'10 days active, 20K points'}];
const REF_PCT=0.05,REF_WELCOME=1000,REF_PCT_CAP=2000;   // 5% of recruits' points, max 2,000/day from the % part
// One level only: you earn from your direct recruits' own play, never from their recruits (referral points, rfe, are
// kept apart from play points and never feed anyone's 5%). Days below are verified match days (vd): a day counts once,
// and only when the server settles a real match that day (an AI match ticket it scored, or a live room's result).
// Launch multiplier on milestones and the 5% (never on the welcome bonus or the match bonus): 3x until 10,000 active
// pilots, 2x until 25,000, 1.5x until 50,000, then 1x. The phase only moves forward (cfg/rph, set by the cron from the
// meta/ap counter) and is pinned on the recruit's record when each point or milestone is earned (rb, rms).
const REF_PHASES=[{n:10000,x:3},{n:25000,x:2},{n:50000,x:1.5},{n:Infinity,x:1}];
const refPhaseOf=(active,prev)=>{let i=0;while(i<REF_PHASES.length-1&&(Number(active)||0)>=REF_PHASES[i].n)i++;return Math.max(i,Math.max(0,Math.min(REF_PHASES.length-1,prev|0)));};
const refPhaseX=i=>REF_PHASES[Math.max(0,Math.min(REF_PHASES.length-1,i|0))].x;
const REF_ACTIVE_DAYS=2;   // a pilot counts toward the launch phase (meta/ap) once they have this many verified match days
// verified active recruit: verified matches on 5+ distinct days, the latest within the last 7 days, not held for review
const REF_VERIFY_DAYS=5,REF_RECENT=7;
const refVerified=(r,day)=>!!r&&!r.held&&(r.vd|0)>=REF_VERIFY_DAYS&&typeof r.vdl==='number'&&day-r.vdl<REF_RECENT;
// match bonus for each verified active recruit (server config only; S.mbx is set by the server, the phone just shows it)
const REF_BONUS={on:true,tiers:[[10,0.03],[50,0.01],[100,0.005]],per:5,step:0.01,squadMax:0.15,cap:1};
function refBonusOf(n,C){
 C=C||REF_BONUS;n=Math.max(0,n|0);let b=0,lo=0;
 for(const [hi,x] of C.tiers){b+=Math.max(0,Math.min(n,hi)-lo)*x;lo=hi;}
 b+=Math.min(C.squadMax,Math.floor(n/C.per)*C.step);
 return Math.round(Math.min(C.cap,b)*10000)/10000;
}
// ---- airdrop research boards (tracking only: distribution is off, nothing is promised) ----
// Points pool: the top 1,000 by play score (play points + 7.5% of referral points). Referral pool: the top 250
// recruiters by quality (each verified active recruit's own verified days, capped at 30), square-root dampened, 10+
// verified active recruits to qualify, no recruiter above 2% of the pool. Pool split 90/10 of the player airdrop.
const AIRDROP={dist:false,ptsTop:1000,refTop:250,refShare:0.10,refW:0.075,refWMin:0.05,refWMax:0.10,refMin:10,qCap:30,refCap:0.02,expand:{on:false,at:50000,top:500},walletCapPct:2.5};
const adCfg=c=>{c=Object.assign({},AIRDROP,c||{});c.refW=Math.max(AIRDROP.refWMin,Math.min(AIRDROP.refWMax,Number(c.refW)||AIRDROP.refW));return c;};
const airdropScore=(ac,rfe,w)=>Math.max(0,Math.round((Number(ac)||0)-(Number(rfe)||0)))+Math.round((Number(rfe)||0)*(w===undefined?AIRDROP.refW:w));
function refPoolScore(rows,day,C){
 C=adCfg(C);let n=0,q=0;
 for(const r of rows||[])if(refVerified(r,day)){n++;q+=Math.min(C.qCap,r.vd|0);}
 return {n,q,s:Math.round(Math.sqrt(q)*100)/100,ok:n>=C.refMin};
}
// shares of a pool proportional to score, nobody above cap; what a capped entry can't take goes to the others
function poolShares(scores,cap){
 const n=scores.length,out=new Array(n).fill(0);if(!n)return out;
 cap=cap>0?cap:1;let left=1,open=scores.map((s,i)=>s>0?i:-1).filter(i=>i>=0);
 for(let k=0;k<n+1&&open.length&&left>1e-12;k++){
  const tot=open.reduce((a,i)=>a+scores[i],0);if(tot<=0)break;
  const over=open.filter(i=>out[i]+left*scores[i]/tot>cap+1e-12);
  if(!over.length){for(const i of open)out[i]+=left*scores[i]/tot;left=0;break;}
  for(const i of over){left-=cap-out[i];out[i]=cap;}
  open=open.filter(i=>!over.includes(i));
 }
 return out;
}

function rng32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

// what the server owns (the phone copies these from every server reply)
const ECO_KEYS=['pts','earned','dailyPts','weeklyPts','dailyDay','weeklyNum','days','sk','ld','fd','up','gemLvl','gemShards','wOwn','cOwn','roll','salv',
 'lab','paints','skin','moonbeam','starter','founder','pass','dq','wk','wq','q','login','streak','buys','dealD','dealW','refC','refPD','refWelcome','vd','vdl','rfe','rb','rms','vac','mbx','wins','losses','mp','ptsSpent','spendGram','rsCr','vg','vgg','fx','g2','lwr','lgi','lg','lgb','mn','ap','mnw','bmn'];
const listOf=v=>Array.isArray(v)?v.filter(x=>x!==null&&x!==undefined):v&&typeof v==='object'?Object.values(v):[];
// fill in anything missing: new pilots, old saves, and database copies (the database drops empty lists and objects)
function ecoNorm(S){
 if(S.lab&&S.lab.v===1&&S.lab.machines)for(const M of Object.values(S.lab.machines)){
  if(M&&M.spec){const c=M.spec.cores;M.spec.cores=[0,1,2].map(i=>c&&GEM[c[i]]?c[i]:null);}
 }
 const obj=k=>{if(!S[k]||typeof S[k]!=='object'||Array.isArray(S[k]))S[k]={};return S[k];};
 if(typeof S.vgg!=='number'&&GENESIS_OPEN)S.vgg=Number(S.vg)||0;   // Gold deposited before Genesis Gold was tracked: all of it was pre-launch
 if(typeof S.lwr!=='number'||!Number.isFinite(S.lwr))S.lwr=0.5;S.lgi=Math.max(0,Math.min(LEAGUE.length-1,S.lgi|0));S.lg=LEAGUE[S.lgi].key;
 for(const k of ['pts','earned','dailyPts','weeklyPts','streak','wins','losses','mp','ptsSpent','spendGram','days','sk','rsCr','vg','vgg','vd','rfe','lgb'])if(typeof S[k]!=='number'||!Number.isFinite(S[k]))S[k]=k==='earned'?(Number(S.pts)||0):0;
 const up=obj('up');for(const k of UORDER)up[k]=Math.max(0,Math.min(4,up[k]|0));
 // over the build budget (levels bought before it existed): the top levels come off, paid back in full
 while(upLevels(up)>BUILD_MAX){let k=UORDER[0];for(const j of UORDER)if(up[j]>=up[k])k=j;up[k]--;S.pts+=UPS[k].costs[up[k]];S.ptsSpent=Math.max(0,S.ptsSpent-UPS[k].costs[up[k]]);}
 const gl=obj('gemLvl'),gs=obj('gemShards');for(const k of GORDER){gl[k]=Math.max(1,Math.min(5,gl[k]|0||1));gs[k]=Math.max(0,gs[k]|0);}
 const wo=obj('wOwn'),co=obj('cOwn');
 for(const k of WORDER)wo[k]=[...new Set(listOf(wo[k]).map(Number).filter(t=>t>=0&&t<=2))];
 for(const k of CHORDER)co[k]=[...new Set(listOf(co[k]).map(Number).filter(t=>t>=0&&t<=2))];
 for(const k in wo)if(!WORDER.includes(k))delete wo[k];for(const k in co)if(!CHORDER.includes(k))delete co[k];
 if(!wo.pulse.includes(0))wo.pulse.unshift(0);if(!co.vanguard.includes(0))co.vanguard.unshift(0);   // starter gear
 obj('roll');obj('salv');obj('q');obj('buys');obj('refC');const pa=obj('paints');pa.stock=1;if(vaultLevel(S.vg)>=VAULT_PAINT_LV)pa.hyper=1;else delete pa.hyper;
 if(S.skin!=='lunar')S.skin='default';S.moonbeam=!!S.moonbeam;S.starter=!!S.starter;S.founder=!!S.founder;
 if(S.dq&&typeof S.dq==='object'){S.dq.ids=listOf(S.dq.ids);S.dq.p=S.dq.p||{};S.dq.c=S.dq.c||{};S.dq.was=listOf(S.dq.was);}
 if(S.wk&&typeof S.wk==='object'){S.wk.ids=listOf(S.wk.ids);S.wk.p=S.wk.p||{};S.wk.u=S.wk.u||{};S.wk.c=S.wk.c||{};for(const id in S.wk.u)S.wk.u[id]=listOf(S.wk.u[id]);}
 if(S.pass&&typeof S.pass==='object'){S.pass.cf=listOf(S.pass.cf);S.pass.cp=listOf(S.pass.cp);S.pass.xp=Number(S.pass.xp)||0;S.pass.prem=!!S.pass.prem;}
 S.mn=mnOf(S.mn);S.ap=apOf(S.ap);if(S.bmn!==undefined)S.bmn=mnOf(S.bmn);if(S.mnw&&typeof S.mnw==='object'){S.mnw={w:S.mnw.w|0,n:Math.max(0,S.mnw.n|0),p:S.mnw.p?1:0};}else delete S.mnw;   // minerals, Hull Plating, weekly league minerals
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
 const mods=fittingSelection(S.lab?L0.mods:undefined),f=fittingStats(mods);
 const legal=f.weight<=FIT_BUDGET.weight&&f.power<=FIT_BUDGET.power;
 return {mods:legal?mods:fittingSelection(),looks:fittingValid(L0.looks,true)?{...(L0.looks||{})}:{},catalog:FIT_VERSION,w,c,up:{...S.up},cores,gl:{...S.gemLvl},skin:S.skin==='lunar'?'lunar':'default',paint,chs,vl:vaultLevel(S.vg),ap:apOf(S.ap)};   // vl: Vault level, looks only; ap: owned Hull Plating (never from the client)
}
// ---- points ----
function ecoRoll(S,X){if(S.dailyDay!==X.day){S.dailyDay=X.day;S.dailyPts=0;}if(S.weeklyNum!==X.week){S.weeklyNum=X.week;S.weeklyPts=0;}}
// every point a pilot earns goes through here: the daily cap, the daily/weekly boards and days active
// free: a fixed reward you claim (quests, milestones, the daily reward, the pass, the chest). Those never hit the daily
// cap, which is there for match grinding, and don't use up its room: S.fx counts today's free points so matches still
// get the full DAILY_CAP. They still count on the daily and weekly boards
const capRoom=(S,X)=>Math.max(0,DAILY_CAP+(S.fx&&S.fx.d===X.day?S.fx.n:0)-(S.dailyPts||0));
function ecoAward(S,n,X,free){
 n=Math.round(Number(n)||0);if(n<=0)return 0;
 ecoRoll(S,X);
 if(free)S.fx={d:X.day,n:(S.fx&&S.fx.d===X.day?S.fx.n:0)+n};
 else{n=Math.min(n,capRoom(S,X));if(n<=0)return 0;}
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
 if(d.kind==='vault'){const B=VAULT[d.tk];return B?{ton:B.ton,stars:B.stars}:null;}
 if(d.kind==='respec'){const t=respecTier(upInvested(S.up));return t?{ton:Math.round(t*RESPEC_TON_USD*100)/100,stars:Math.round(t*RESPEC_STARS_USD),usd:t}:null;}
 return PREMIUM[d.kind]?{ton:PREMIUM[d.kind].ton,stars:PREMIUM[d.kind].stars}:null;
}
// already owned (one-time items): selling it again would charge for nothing
function ecoOwned(S,d,X){
 if(d.kind==='starter')return S.starter;if(d.kind==='founder')return S.founder||!FOUNDER_OPEN;if(d.kind==='moonbeam')return S.moonbeam;
 if(d.kind==='skin')return S.skin==='lunar';if(d.kind==='paint')return !!(S.paints&&S.paints[d.id]);if(d.kind==='pass')return ecoPassState(S,X).prem;
 if(d.kind==='respec')return !!S.rsCr;   // a paid reset is already waiting
 return false;
}
// open a crate. Returns what came out (the phone words it): gem {gem,n,lv,up}; gear {isW,k,tier,roll,kind: new|up|dup,old,pts}
function ecoOpenBox(S,tk,ri,X){const r=ecoOpenBoxRaw(S,tk,ri,X);labGain(S,r);return r;}
function ecoOpenBoxRaw(S,tk,ri,X){
 const R=X.rnd;
 if(tk==='gem'){
  const k=GORDER[(R()*GORDER.length)|0],n=ri===0?1+((R()*2)|0):ri===1?3+((R()*2)|0):11+((R()*4)|0);
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
function ecoSalvage(S,tk,ri,X){const r=ecoSalvageRaw(S,tk,ri,X);labGain(S,r);return r;}
function ecoSalvageRaw(S,tk,ri,X){
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
// Fabricate a Hull Plating plate in a slot (0 FRONT, 1 LEFT, 2 RIGHT, 3 TURRET). Instant, from the account wallet and
// spendable points. Upgrading absorbs the plate already there (no refund); a plate is permanent (never lost, never traded).
function ecoPlate(S,slot,tier){
 slot=Math.round(Number(slot));tier=Math.round(Number(tier));if(!(slot>=0&&slot<=3)||!(tier>=1&&tier<=6))return {err:'item'};
 S.mn=mnOf(S.mn);S.ap=apOf(S.ap);if(S.ap[slot]>=tier)return {err:'have'};
 const C=PLATE.cost[tier];for(const k of MN_ORDER)if(C[k]&&S.mn[k]<C[k])return {err:'mn',k,need:C[k]-S.mn[k]};
 if(S.pts<C.pts)return {err:'pts',need:C.pts-S.pts};
 for(const k of MN_ORDER)if(C[k])S.mn[k]-=C[k];S.pts-=C.pts;S.ptsSpent+=C.pts;S.ap[slot]=tier;
 return {slot,tier,set:plateStats(S.ap).set};
}
// Move wallet minerals into the Conquest base stores (Session 5): walls and late Command Center levels spend them. One way and
// permanent (stores never return to the wallet); S.bmn only ever grows, the Conquest plot counts what it has spent.
function ecoBaseStore(S,mn){S.mn=mnOf(S.mn);S.bmn=mnOf(S.bmn);const moved={};let n=0;for(const k of MN_ORDER){const v=Math.floor(Number(mn&&mn[k])||0);if(v<0||v>100000)return {err:'item'};if(!v)continue;if(S.mn[k]<v)return {err:'mn',k,need:v-S.mn[k]};moved[k]=v;n+=v;}
 if(!n)return {err:'item'};for(const [k,v] of Object.entries(moved)){S.mn[k]-=v;S.bmn[k]+=v;}return {moved,bmn:{...S.bmn}};}
// Minerals into the wallet (Conquest banking, Arcade/PvP drops, weekly league minerals, strike rewards)
function ecoMinerals(S,add){S.mn=mnOf(S.mn);const got={};for(const k of MN_ORDER){const n=Math.floor(Number(add&&add[k])||0);if(n>0){S.mn[k]+=n;got[k]=n;}}return got;}
// A verified Arcade/PvP result's minerals (§5.5): its drop, plus the weekly league minerals at the week's 20th match.
// Quits never reach here. lg: the league the match was played in.
function ecoMatchMinerals(S,o,lg,X){
 const row=o.won?MN_DROP.win:o.drawn||o.top3?MN_DROP.draw:MN_DROP.loss,drop={};
 for(const [k,[g,c]] of Object.entries(row)){const n=g+(c>0&&X.rnd()<c?1:0);if(n>0)drop[k]=n;}
 const got=ecoMinerals(S,drop);
 if(!S.mnw||S.mnw.w!==X.week)S.mnw={w:X.week,n:0,p:0};S.mnw.n++;let weekly=null;
 if(!S.mnw.p&&S.mnw.n>=MN_WEEKLY_N){S.mnw.p=1;const W=MN_WEEKLY[Math.max(0,Math.min(MN_WEEKLY.length-1,lg|0))],add={};
  for(const [k,v] of Object.entries(W)){const n=Math.floor(v)+(X.rnd()<v-Math.floor(v)?1:0);if(n>0)add[k]=n;}weekly=ecoMinerals(S,add);}
 return {drop:got,weekly};
}
// clear the build: every level to 0, half the points back. A paid reset (tier in $) also covers the points fee, so every
// point comes back; it covers any fee that rounds to that tier. A paid reset with nothing to clear waits for the next one (rsCr)
function ecoRespec(S,paid){
 const inv=upInvested(S.up);
 if(!paid&&S.rsCr){paid=S.rsCr;S.rsCr=0;}
 if(!inv){if(paid){S.rsCr=paid;return {tk:'respec',credit:paid};}return {err:'empty'};}
 const half=Math.floor(inv*RESPEC_BACK),back=paid?Math.min(inv,half+Math.ceil((paid+0.25)*RESPEC_PTS_USD)):half;
 for(const k of UORDER)S.up[k]=0;
 S.pts+=back;S.ptsSpent=Math.max(0,S.ptsSpent-back);
 return paid?{tk:'respec',back,lost:inv-back,extra:back-half,usd:paid}:{back,lost:inv-back};
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
 else if(d.kind==='respec'){const t=respecTierOfTon(d.price);S.spendGram+=Number(d.price)||0;outs.push(ecoRespec(S,t));}
 else if(d.kind==='pass'){const P=ecoPassState(S,X);if(!P.prem){P.prem=true;S.spendGram+=PASS_PRICE.ton;outs.push({tk:'pass',s:P.s});}}
 else if(d.kind==='vault'){const B=VAULT[d.tk];if(B){const lv0=vaultLevel(S.vg);S.vg=(S.vg||0)+B.g;const gg=GENESIS_OPEN?B.g:0;S.vgg=(S.vgg||0)+gg;S.spendGram+=Number(d.price)||B.ton;const lv=vaultLevel(S.vg);
  if(lv>=VAULT_PAINT_LV)S.paints.hyper=1;outs.push({tk:'vault',id:d.tk,g:B.g,gg,lv0,lv,t:S.vg});}}   // any number of times: the Vault never fills
 for(const r of outs)labGain(S,r);
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
  else if(o.tk==='respec'){if(o.credit)S.rsCr=0;else{const p=Math.min(S.pts,o.extra||0);S.pts-=p;S.ptsSpent+=p;}}   // the levels stay cleared; the extra points go back
  else if(o.tk==='vault'){S.vg=Math.max(0,(S.vg||0)-(o.g||0));S.vgg=Math.max(0,(S.vgg||0)-(o.gg||0));if(vaultLevel(S.vg)<VAULT_PAINT_LV&&S.paints)delete S.paints.hyper;}
 }
}
// ---- milestones ----
function ecoMsAdd(S,id,val,isMax){const Q=MS_BY[id];if(!Q)return;const e=S.q[id]||(S.q[id]={p:0,done:false,claimed:false});e.p=isMax?Math.max(e.p||0,val||0):(e.p||0)+(val||0);if(e.p>=Q.goal)e.done=true;}
function ecoMsClaim(S,id,X){const Q=MS_BY[id],e=S.q[id];if(!Q||!e||!e.done||e.claimed)return null;e.claimed=true;return {pts:ecoAward(S,Q.pts,X,1)};}
// read: the quest counts only when the pilot comes back through the wiki's end-of-page button (start_param wikiread)
function ecoVisit(S,id,read){const Q=MS_BY[id];if(!Q||!Q.link||(Q.read&&!read))return false;const e=S.q[id]||(S.q[id]={p:0,done:false,claimed:false});e.p=Q.goal;e.done=true;return true;}
// ---- login streak ----
function ecoLoginState(S,X){
 const d=X.day,L=S.login||{last:-9,n:0};
 const claimedToday=L.last===d,alive=L.last===d||L.last===d-1;
 const next=claimedToday?L.n:(alive?L.n+1:1);   // streak count after today's claim
 return {claimedToday,streak:alive?L.n:0,next,slot:((next-1)%7),reward:STREAK_PTS[(next-1)%7]+TDAILY[tierOfPts(ecoBase(S))]};
}
// welcome-back gift: a rare gem cache with the first daily reward claimed on any day after your first day (once per pilot)
const GIFT_RI=1;
const ecoGiftReady=(S,X)=>!S.g2&&typeof S.fd==='number'&&X.day>S.fd;
const ecoGiftPending=(S,X)=>!S.g2&&(typeof S.fd!=='number'||X.day<=S.fd);   // still to come: shown as "come back tomorrow"
function ecoLogin(S,X){
 const s=ecoLoginState(S,X);if(s.claimedToday)return null;
 S.login={last:X.day,n:s.next};
 const pts=ecoAward(S,s.reward,X,1),box=s.slot===6?ecoOpenBox(S,'gem',0,X):null;   // day 7: a free gem cache too
 const gift=ecoGiftReady(S,X)?(S.g2=X.day,ecoOpenBox(S,'gem',GIFT_RI,X)):null;   // once ever: come back the day after your first day
 return {pts,box,gift,day:s.slot+1};
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
 let n=ecoAward(S,ecoQPts(S,Q.pts,X),X,1),all=false;ecoPassXP(S,PASS_XP_QUEST,X);
 if(!S.dq.all&&qs.every(q=>q.claimed||q.id===id)){S.dq.all=true;all=true;n+=ecoAward(S,ecoQPts(S,DQ_ALL_BONUS,X),X,1);ecoPassXP(S,PASS_XP_ALL,X);}
 return {pts:n,all};
}
function ecoClaimWeekly(S,id,X){
 const Q=ecoWeeklyRows(S,X).find(q=>q.id===id);
 if(!Q||!Q.done||Q.claimed)return null;
 S.wk.c[id]=true;const n=ecoAward(S,ecoQPts(S,Q.pts,X),X,1);ecoPassXP(S,PASS_XP_WQ,X);
 return {pts:n};
}
function ecoChest(S,X){
 ecoQuests(S,X);
 if(S.wq.claimed||(S.wq.n||0)<WQ_GOAL)return null;
 S.wq.claimed=true;const n=ecoAward(S,ecoQPts(S,WQ_PTS,X),X,1);
 return {pts:n,box:ecoOpenBox(S,'gem',1,X)};
}
// ---- Lunar Pass ----
const ecoSeason=X=>X.day<PASS_S2?1:2+Math.floor((X.day-PASS_S2)/PASS_LEN);
function ecoPassState(S,X){const s=ecoSeason(X);if(!S.pass||S.pass.s!==s)S.pass={s,xp:0,prem:false,cf:[],cp:[]};S.pass.cf=S.pass.cf||[];S.pass.cp=S.pass.cp||[];return S.pass;}
const ecoPassTier=(S,X)=>{const P=ecoPassState(S,X);return Math.min(passTiers(P.s),Math.floor(P.xp/PASS_XP));};
function ecoPassXP(S,n,X){if(!n)return 0;const P=ecoPassState(S,X),b=ecoPassTier(S,X);P.xp=Math.min(passTiers(P.s)*PASS_XP,P.xp+n);return ecoPassTier(S,X)-b;}
function ecoClaimPass(S,track,i,X){
 const P=ecoPassState(S,X);i=+i;
 if(!(i>=1&&i<=ecoPassTier(S,X)))return null;
 const prem=track==='p',list=prem?P.cp:P.cf,r=(prem?PASS_PREM:PASS_FREE)[i];
 if(!r||list.includes(i)||(prem&&!P.prem))return null;
 list.push(i);
 if(r.k==='pts')return {pts:ecoAward(S,r.n,X,1)};   // free track only: the premium track never gives points
 if(r.k==='paint'){S.paints[r.id]=1;labGain(S,{tk:'paint',id:r.id});return {paint:r.id};}
 return {box:ecoOpenBox(S,r.tk,r.ri,X)};
}
// ---- matches ----
// points for a finished match: mode pay, best of 3, featured, win streak, then the league: base pay and the spendable multiplier
// (o: won, drawn, place, top3, g, m, feat, series; lg: league index, as on the ticket)
function ecoMatchPts(S,o,lg,X){
 if(o.won)S.streak++;else if(!o.drawn&&!o.top3)S.streak=0;   // Last Standing: 2nd and 3rd keep your streak
 const mk=MODES[o.m]?o.m:'1v1',sb=o.won?streakPts(o.g,mk,S.streak):0,M=MODES[mk],solo=isSolo(o.g);
 const zx=teamX(o.g,mk,!!o.series),fxm=o.feat?FEATURED_X:1;
 const base=Math.round(solo?ROYALE_PTS[Math.max(1,Math.min(6,o.place||6))-1]:(o.won?M.win:o.drawn?M.draw:M.loss)*zx);
 const P=leaguePay(base*fxm+sb,lg),b=ecoPlayAward(S,P.base,P.pts,X),mn=ecoMatchMinerals(S,o,lg,X);
 return {pts:P.pts,awarded:b.awarded,bonus:b.bonus,base,basePts:P.base,lgBonus:b.lb,lgPay:leagueInfo(lg).pay,modeX:zx,featX:fxm,streak:S.streak,streakBonus:sb,mn};
}
// A match's points, split in two. Base points (b1: the match with featured, streak and league base pay) are what the daily
// cap, the daily/weekly boards, the leaderboard and the airdrop count. The league bonus (pts - b1) is paid on top, to spendable
// points only (pts and earned; S.lgb keeps the lifetime total), so climbing leagues never shrinks airdrop progress. A capped
// day pays the bonus on the base that fit. The squad match bonus (referral points, S.mbx) is on pts as it always was, and
// takes the cap's hit first. AI tickets (eco.js matchEnd) and live rooms (eco.js creditMatch) both come through here
function ecoPlayAward(S,b1,pts,X){
 b1=Math.max(0,Math.round(b1||0));pts=Math.max(b1,Math.round(pts||0));
 const bx=Math.max(0,Math.min(REF_BONUS.cap,Number(S.mbx)||0)),sq=pts>0?Math.round(pts*bx):0;
 const got=ecoAward(S,b1+sq,X),play=Math.min(got,b1),extra=got-play;
 if(extra)S.rfe=(S.rfe||0)+extra;
 const lb=b1>0?Math.round((pts-b1)*play/b1):0;
 if(lb>0){S.pts+=lb;S.earned+=lb;S.lgb=(S.lgb||0)+lb;}
 return {awarded:got+lb,bonus:extra,base:play,lb};
}
// lifetime base points: what the leaderboard shows and the airdrop counts (lifetime points minus the league bonus)
const ecoBase=S=>Math.max(0,(S.earned||0)-(S.lgb||0));
function ecoQuit(S){S.streak=0;S.losses++;S.mp++;ecoForm(S,0);}   // left mid-match: a loss, no points, and a loss for your form
// everything else a finished match changes: wins and losses, pass XP, milestone and quest progress
// (o: won, drawn, top3, feat, quick, g, m, map, streak, seriesW, st: {dmg, sup, box, kills, caps, cry, stars, low})
function ecoAfterMatch(S,o,X){
 const st=o.st||{},won=!!o.won,drawn=!!o.drawn,top3=!!o.top3,low=typeof st.low==='number'?st.low:0,clean=won&&low>0,M=MODES[o.m]||MODES['1v1'],sw=o.seriesW;
 if(won)S.wins++;else if(!drawn&&!top3)S.losses++;
 S.mp++;ecoPlayDay(S,X);ecoForm(S,won?1:drawn||top3?0.5:0);
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
// a verified match day: the server settled a real match today (counted once a day)
function ecoPlayDay(S,X){if(S.vdl!==X.day){S.vd=(S.vd|0)+1;S.vdl=X.day;}}
// after every change to a pilot's record (the server runs this inside the same write): the play points they just earned,
// times the launch phase right now (rb, what the 5% pays from), and each milestone stamped with the phase when reached
function ecoRefTrack(S,X,e0,f0){
 const x=X&&X.rx>0?X.rx:1,ep=Math.max(0,(S.earned||0)-(S.rfe||0));
 if(typeof S.rb!=='number')S.rb=Math.max(0,(e0||0)-(f0||0));
 const play=Math.max(0,((S.earned||0)-(e0||0))-((S.rfe||0)-(f0||0)));
 if(play>0)S.rb=Math.round(S.rb+play*x);
 const rms=Array.isArray(S.rms)?S.rms.filter(v=>typeof v==='number'):[];
 while(rms.length<REF_MS.length&&(S.vd|0)>=REF_MS[rms.length].days&&ep>=REF_MS[rms.length].pts)rms.push(x);
 S.rms=rms;
}
// what a recruit's row owes you. r: {id, rb (phase-weighted play points), rms (phase pinned per milestone reached)}.
// Milestone points are owed as an amount (mp = paid so far), so a big one pays in parts when the day's room is short
const refMsTotal=rms=>{let t=0;for(let i=0;i<Math.min(REF_MS.length,rms.length);i++)t+=Math.round(REF_MS[i].r*(Number(rms[i])||1));return t;};
function ecoRefOwed(S,r){
 const c=(S.refC||{})[r.id]||{m:0,seen:0};const rms=Array.isArray(r.rms)?r.rms:[];
 const paid=typeof c.mp==='number'?c.mp:REF_MS.slice(0,c.m||0).reduce((t,M)=>t+M.r,0);   // older records: count milestones paid at 1x
 const ms=Math.max(0,refMsTotal(rms)-paid),base=typeof r.rb==='number'?r.rb:0;
 const pc=Math.max(0,Math.floor((base-(c.seen||0))*REF_PCT));
 return {ms,pct:pc,m:Math.max(c.m||0,Math.min(REF_MS.length,rms.length)),paid,tot:ms+pc};
}
const ecoPctRoom=(S,X)=>S.refPD&&S.refPD.d===X.day?Math.max(0,REF_PCT_CAP-S.refPD.a):REF_PCT_CAP;
// your own welcome bonus: your referrer is on record and you have 2 verified match days
const refWelcomeDue=(S,me,held)=>!!(me&&me.ref&&(S.vd|0)>=2&&!S.refWelcome&&!(held||[]).includes('me'));
// rows: your recruits; me: {ref} (your own referrer: a welcome bonus on your 2nd verified day); held: ids on hold
function ecoSquad(S,rows,X,me,held){
 ecoRoll(S,X);held=held||[];
 let room=capRoom(S,X),got=0,welcome=0;
 if(refWelcomeDue(S,me,held)&&room>=REF_WELCOME){S.refWelcome=true;got+=REF_WELCOME;room-=REF_WELCOME;welcome=REF_WELCOME;}
 let pr=ecoPctRoom(S,X),pgot=0;
 for(const r of rows||[]){if(room<=0)break;if(r.held||held.includes(r.id))continue;const o=ecoRefOwed(S,r);if(!o.tot)continue;
  const pm=Math.min(o.ms,room),pp=Math.min(o.pct,pr,room-pm),t=pm+pp;if(!t)continue;
  const c=S.refC[r.id]||{m:0,seen:0};S.refC[r.id]={m:o.m,mp:o.paid+pm,seen:(c.seen||0)+Math.round(pp/REF_PCT)};   // what doesn't fit today carries over
  got+=t;room-=t;pr-=pp;pgot+=pp;}
 if(pgot)S.refPD={d:X.day,a:(S.refPD&&S.refPD.d===X.day?S.refPD.a:0)+pgot};
 const pts=got?ecoAward(S,got,X):0;
 if(pts)S.rfe=(S.rfe||0)+pts;
 return {pts,welcome};
}
function ecoSquadPending(S,rows,X,me,held){held=held||[];let t=refWelcomeDue(S,me,held)?REF_WELCOME:0,pr=ecoPctRoom(S,X);
 for(const r of rows||[]){if(r.held||held.includes(r.id))continue;const o=ecoRefOwed(S,r);const pp=Math.min(o.pct,pr);pr-=pp;t+=o.ms+pp;}return t;}

// Lab v1 stores selections, never inventory, upgrades, prices or public data.
const LAB_RULES_VERSION='lab-fittings-v1';
function labSpec(L){return {w:{a:L.w.a,t:L.w.t,s:!!L.w.s},c:{c:L.c.c,t:L.c.t,s:!!L.c.s},cores:L.cores.slice(),paint:L.paint,mods:fittingSelection(L.mods),looks:{...(L.looks||{})},catalog:FIT_VERSION};}
function labEnsure(S,hint){
 if(S.lab||S.mig===0)return;
 const spec=labSpec(ecoLoadout(S,S.L||hint||STOCK_L));
 S.lab={v:1,rev:1,policy:1,active:'m_legacy',slots:{base_1:'m_legacy',base_2:'m_spare'},machines:{
  m_legacy:{name:'War Machine MK-I',rev:1,spec:JSON.parse(JSON.stringify(spec))},
  m_spare:{name:'War Machine MK-II',rev:1,spec:JSON.parse(JSON.stringify(spec))}}};
}
function labValidate(S,p){
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const keys=(v,ks)=>obj(v)&&Object.keys(v).every(k=>ks.includes(k));
 if(!keys(p,['w','c','cores','paint','mods','looks','catalog'])||!keys(p.w,['a','t','s'])||!keys(p.c,['c','t','s']))return 'shape';
 if(!fittingValid(p.mods)||!fittingValid(p.looks,true)||(p.catalog!==undefined&&p.catalog!==FIT_VERSION))return 'modules';
 if(FIT_ORDER.some(k=>fittingSelection(p.mods)[k]!=='stock')&&p.catalog!==FIT_VERSION)return 'modules';
 const f=fittingStats(p.mods);if(f.weight>FIT_BUDGET.weight||f.power>FIT_BUDGET.power)return 'budget';
 for(const [isW,x,k] of [[true,p.w,p.w.a],[false,p.c,p.c.c]]){
  if(!Number.isInteger(x.t)||x.t<0||x.t>2||typeof x.s!=='boolean')return 'gear';
  if(isW&&k==='moon'){if(!S.moonbeam||x.t!==2||x.s)return 'owned';}
  else if(!(isW?WORDER:CHORDER).includes(k)||(x.s?!(x.t>=1&&salvIn(S,k,x.t)>0):!(isW?hasW(S,k,x.t):hasC(S,k,x.t))))return 'owned';
 }
 if(!Array.isArray(p.cores)||p.cores.length!==3||p.cores.some(k=>k!==null&&!GEM[k])||new Set(p.cores.filter(Boolean)).size!==p.cores.filter(Boolean).length)return 'cores';
 if(typeof p.paint!=='string'||!PAINTS[p.paint]||!S.paints[p.paint])return 'paint';
 return null;
}
function labAction(S,a,b){
 if(!S.lab||S.lab.v!==1)return {err:'sync'};
 if(a==='lab_read')return {ok:true};
 if(!['lab_save','lab_rename','lab_activate'].includes(a))return {err:'action'};
 if(!Object.values(S.lab.slots).includes(b.id)||!Object.prototype.hasOwnProperty.call(S.lab.machines,b.id))return {err:'machine'};
 if(!Number.isInteger(b.rev)||b.rev!==S.lab.rev)return {err:'conflict'};
 const M=S.lab.machines[b.id];
 if(a!=='lab_activate'){
  if(typeof b.name!=='string')return {err:'name'};
  const name=b.name.normalize('NFC').trim();
  if(!name||[...name].length>24||!/^[-\p{L}\p{N} ._()]+$/u.test(name))return {err:'name'};
  if(a==='lab_save'&&FIT_ORDER.some(k=>fittingSelection(M.spec.mods)[k]!=='stock')&&(!b.spec||b.spec.catalog!==FIT_VERSION))return {err:'update'};
  if(a==='lab_save'){const err=labValidate(S,b.spec);if(err)return {err};M.spec=labSpec(ecoLoadout(S,b.spec));}
  M.name=name;M.rev++;
 }else S.lab.active=b.id;
 S.lab.rev++;return {ok:true};
}
function labLoadout(S){const M=S.lab&&S.lab.machines[S.lab.active];return ecoLoadout(S,M?M.spec:S.L);}

// Preserve acquisition auto-equip, on the authoritative account rather than legacy UI fields.
function labGain(S,r){
 if(!S.lab||!r)return;
 const M=S.lab.machines[S.lab.active],before=JSON.stringify(M.spec),p=M.spec;
 if(r.k&&((r.kind==='new'||r.kind==='up')||(r.sal&&r.better))){
  const isW=!!r.isW,current=isW?p.w.a:p.c.c;
  if(current===r.k){const b=bestOf(S,isW,r.k);if(b){if(isW)p.w={a:r.k,t:b.t,s:b.s};else p.c={c:r.k,t:b.t,s:b.s};}}
 }
 if(r.tk==='moonbeam'&&S.moonbeam)p.w={a:'moon',t:2,s:false};
 if(r.tk==='paint'&&S.paints[r.id])p.paint=r.id;
 if(r.tk==='vault'&&(r.lv0|0)<VAULT_PAINT_LV&&(r.lv|0)>=VAULT_PAINT_LV)p.paint='hyper';
 if(JSON.stringify(p)!==before){M.rev++;S.lab.rev++;}
}

// Free functional sidegrades; visual styles never enter stat math. Each non-stock mod trades two stats (about 10-12% on
// average; health counts for more on the field, so it moves less) and carries ONE behavior effect, so a set of three changes how the machine plays, not just its numbers.
// Fields (all shares, 0.1 = 10%): hp health, spd driving speed, dps damage per second; effects: supTaken damage taken from
// supers, dashCd dash cooldown, turn turret turn rate, shotSpd shot speed, shieldCd shield cooldown, charge super charge,
// hitCharge super charge from hits taken.
// Measured on the real sim (dev/tests/s2/mods.mjs): every legal set wins 42-58% against the field on its chassis and weapon.
const FIT_VERSION=2,FIT_BUDGET={weight:3,power:3};
const FIT_FIELDS=['hp','spd','dps','supTaken','dashCd','turn','shotSpd','shieldCd','charge','hitCharge'];
const FITS={
 hull:{stock:{n:'Stock',weight:0,power:0},
  plates:{n:'Reinforced plates',hp:.05,spd:-.16,shieldCd:-.40,weight:2,power:0},
  light:{n:'Light frame',hp:-.05,spd:.15,dashCd:-.40,weight:0,power:1}},
 mobility:{stock:{n:'Stock',weight:0,power:0},
  sprint:{n:'Sprint gearing',spd:.11,dps:-.09,turn:.30,weight:0,power:2},
  stable:{n:'Stable gearing',spd:-.15,dps:.07,shotSpd:.10,weight:1,power:1}},
 mount:{stock:{n:'Stock',weight:0,power:0},
  hardened:{n:'Hardened mount',hp:.06,dps:-.14,hitCharge:.20,weight:2,power:0},
  firing:{n:'Firing mount',hp:-.08,dps:.12,charge:.08,weight:1,power:2}}
};
const FIT_ORDER=['hull','mobility','mount'];
function fittingValid(v,visual){
 if(v===undefined)return true;
 return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>FIT_ORDER.includes(k))&&FIT_ORDER.every(k=>v[k]===undefined||(visual&&v[k]==='auto')||Object.prototype.hasOwnProperty.call(FITS[k],v[k]));
}
function fittingSelection(v){return Object.fromEntries(FIT_ORDER.map(k=>[k,v&&Object.prototype.hasOwnProperty.call(FITS[k],v[k])?v[k]:'stock']));}
function fittingStats(v){const m=fittingSelection(v),f={weight:0,power:0};for(const s of FIT_FIELDS)f[s]=0;for(const k of FIT_ORDER)for(const s of Object.keys(f))f[s]+=FITS[k][m[k]][s]||0;for(const s of FIT_FIELDS)f[s]=Math.round(f[s]*1000)/1000;return f;}
function fittingVisuals(L){const m=fittingSelection(L.mods);return Object.fromEntries(FIT_ORDER.map(k=>[k,L.looks&&L.looks[k]&&L.looks[k]!=='auto'&&Object.prototype.hasOwnProperty.call(FITS[k],L.looks[k])?L.looks[k]:m[k]]));}
function hasFittings(L){return FIT_ORDER.some(k=>fittingVisuals(L)[k]!=='stock');}
// Unrounded permanent travel speed, shared by Garage metrics and Conquest physics.
function machineSpeed(L,t=tankOf(L,1)){return STAT.speed*t.spdM*(1+(t.gems.includes('spd')?GEM.spd.amt*t.gemM.spd:0));}
function machineMetrics(L){const t=tankOf(L,1),g=k=>t.gems.includes(k)?GEM[k].amt*t.gemM[k]:0;return {hp:t.mhp,dps:Math.round(t.wdps*t.dmgM*(1+g('dmg'))*(1+g('rof'))*projectileImpactMult(t)),spd:+machineSpeed(L,t).toFixed(1)};}

// ---- garage presentation (UI only): reads the tables above, adds no stat math of its own ----
// Progressive garage: matches played (server-tracked mp) before a section opens. UI gating only: the server accepts every
// legal loadout, and anything already bought or set (upgrade levels, a paid reset, fitted mods) keeps its section open.
const GARAGE_UP_AT=2,GARAGE_FIT_AT=5;
function garageOpen(S,sec){
 if(sec==='up')return (S.mp|0)>=GARAGE_UP_AT||upLevels(S.up)>0||(S.rsCr|0)>0;
 if(sec==='fit')return (S.mp|0)>=GARAGE_FIT_AT||!!(S.lab&&S.lab.machines&&Object.values(S.lab.machines).some(M=>M&&M.spec&&FIT_ORDER.some(k=>fittingSelection(M.spec.mods)[k]!=='stock')));
 return true;
}
// What the garage shows for a loadout: Toughness (health), Firepower (ordinary DPS), Speed (driving), power, and the extras.
function machineView(L){
 const m=machineMetrics(L),t=tankOf(L,1),g=k=>t.gems.includes(k)?GEM[k].amt*t.gemM[k]:0;
 const sup=typeof SUP!=='undefined'&&SUP[t.wtype]?Math.round(SUP[t.wtype].dmg*Math.pow((t.wmult||TIER_MULT[Math.max(0,t.wtier|0)])*t.dmgM*(1+g('dmg')),SUP_GEAR)*(SUP[t.wtype].kind==='shell'?projectileImpactMult(t):1)):0;   // super damage (game.js SUP; 0 where the sim isn't loaded)
 return {tough:m.hp,fire:m.dps,speed:m.spd,power:powerOf(L),armor:Math.round(Math.min(0.7,g('arm'))*100),
  crit:Math.round((CRIT_BASE+t.critB+g('lck'))*100),charge:Math.round((t.fillM-1)*100),repair:+(g('reg')*100).toFixed(2),
  edge:Math.round((t.wedge||GRAZE)*100),super:sup};
}
// B minus A for every machineView field (speed to 0.1, repair to 0.01)
function machineDelta(A,B){const a=machineView(A),b=machineView(B),o={};for(const k in a)o[k]=k==='speed'?+(b[k]-a[k]).toFixed(1):k==='repair'?+(b[k]-a[k]).toFixed(2):b[k]-a[k];return o;}
// Legendary showcase: the edge of Moonbeam over the best Epic weapon (top roll), or of Lunar Skin over Standard,
// on this exact build. Both sides are built from the tables, so new numbers show up on their own.
function legendaryEdge(S,spec,kind){
 const L=ecoLoadout(S,spec);
 if(kind==='skin')return {vs:'default',d:machineDelta({...L,skin:'default'},{...L,skin:'lunar'})};
 let best=null;
 for(const k of WORDER){const X={...L,w:{a:k,t:2,q:ROLL_MAX,s:false}},p=powerOf(X);if(!best||p>best.p)best={k,p,L:X};}
 return {vs:best.k,d:machineDelta(best.L,{...L,w:{a:'moon',t:2,q:1,s:false}})};
}
// Build tag: a name for the shape of a build. It reads only choices (chassis class, weapon type, upgrade spread, mods,
// core types), never rarity, rolls, core levels, paint or looks, so gear upgrades never change it. Axes: T toughness,
// F firepower, S speed, C crits, R super charge.
const BUILD_TAGS={
 crit:{n:'Crit Hunter',d:'Built around critical hits'},
 charger:{n:'Overcharger',d:'Fills its super fast'},
 jugg:{n:'Juggernaut',d:'Tough and hard-hitting, but slow'},
 skirm:{n:'Skirmisher',d:'Fast and punchy: hit, then slip away'},
 glass:{n:'Glass Cannon',d:'Hits hard, breaks fast'},
 wall:{n:'Iron Wall',d:'Soaks up hits and holds ground'},
 intercept:{n:'Interceptor',d:'Built for pure speed'},
 sniper:{n:'Sniper',d:'Heavy shots from a steady platform'},
 brawler:{n:'Brawler',d:'Rapid fire, built to trade hits up close'},
 balanced:{n:'Balanced',d:'No weak spot and no extreme'}};
const TAG_UP={hull:'T',cannon:'F',engine:'S',target:'C',reactor:'R'},TAG_CORE={dmg:'F',rof:'F',arm:'T',reg:'T',spd:'S',lck:'C',vel:'F'};
function buildAxes(L){
 const a={T:0,F:0,S:0,C:0,R:0},C=CH[L.c&&L.c.c]||CH.vanguard,W=WEAPONS[L.w&&L.w.a]||WEAPONS.pulse,sg=v=>v>0?1:v<0?-1:0;
 if(C.hp>=1.15)a.T+=2;else if(C.hp<1)a.T-=1;
 if(C.spd>=1.15)a.S+=2;else if(C.spd<1)a.S-=1;
 if(W.premium)a.F+=2;else if(W.shot>=0.4)a.F+=1;
 for(const k of UORDER)if(TAG_UP[k])a[TAG_UP[k]]+=(L.up&&L.up[k])|0;
 const m=fittingSelection(L.mods);for(const k of FIT_ORDER){const f=FITS[k][m[k]];a.T+=sg(f.hp);a.S+=sg(f.spd);a.F+=sg(f.dps);a.R+=sg(f.charge);}   // super charge (Firing mount) counts toward Overcharger; the other effects ride with their stat trade
 for(const g of (L.cores||[]))if(g&&TAG_CORE[g])a[TAG_CORE[g]]+=TAG_CORE[g]==='C'?2:1;
 return a;
}
function buildTag(L){
 const {T,F,S,C,R}=buildAxes(L),W=WEAPONS[L.w&&L.w.a]||WEAPONS.pulse,top=Math.max(T,F,S);let id='balanced';
 if(C>=4&&C>=top)id='crit';
 else if(R>=4&&R>=top)id='charger';
 else if(T>=4&&F>=4&&S<=1)id='jugg';
 else if(F>=4&&S>=4)id='skirm';
 else if(F>=4&&T<=0)id='glass';
 else if(T>=4&&T>=F+2&&T>=S+2)id='wall';
 else if(S>=4&&S>=F+2&&S>=T+2)id='intercept';
 else if((W.premium||W.shot>=0.4)&&F>=3&&S<=1)id='sniper';
 else if(W.shot<=0.1&&T>=3)id='brawler';
 return {id,n:BUILD_TAGS[id].n,d:BUILD_TAGS[id].d};
}
