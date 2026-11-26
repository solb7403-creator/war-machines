'use strict';
// =====================================================================
// rules: pure game data and stat math, shared by the phone and the PvP server
// (no save, no DOM: worker/build-sim.mjs bundles this file with game.js for the server)
// =====================================================================
const PVP_V=7;   // game/reward and live-match protocol version: 7 is 5E-2b3 (each chassis its own build and cores: the loadout, the economy actions and purchases carry the chassis); 6 is the 5E-2b2b supers (charge from damage only, measured against the tank's own strength; at most 3 a round; faster timing bar; supers used in the snapshot); 5 is the 5E-2b supers (timing bar, the tap message and the wider snapshot); 4 adds Velocity; the phone and server must agree (2: Canyon and Bunker joined the live map pool; 3: Session 2 mods, Moonbeam Precision and Moonfall hit width, leagues)
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
// 24 s), and NEVER more than SUP_ROUND_CAP: the sim refuses the 4th press, the count survives a respawn and only a new round
// clears it (live matches: the server's sim; AI matches: the server's proof-of-play check counts the presses per round);
// (4) the Reactor (+10% a level) and the charge mods multiply the result as before. "Own strength" includes the mystery-box
// buffs a tank holds and its chassis counter against the target, so neither speeds the charge (game.js supDps).
// What never charges: crates and props, terrain, the storm ring, meteors, your own or a team mate's fire (the rules have none),
// damage past the target's remaining health (overkill), a super's own damage (its owner), and anything once the cap is reached.
// No farming by soaking damage: damage received counts for at most ONE full hull per life (repairs and regeneration do not
// refill that allowance) and fills at most SUP_TAKEN_MAX bars a round across all lives, and it is the smaller source by design.
// SUP_FILL[mode][team size] = [d, h]: d seconds of the tank's own clean fire fill one bar; h of its own hulls lost fill one bar.
// The split is the owner's starting point, kept after calibration: in a measured average round about 70% of the charge comes from
// damage dealt and 30% from damage received. The numbers differ by mode because a round's fighting differs (a 24 s duel, a
// 180 s Moon Zone with respawns, a megatank with a huge hull): each row is fitted on seeded rounds of that mode so the pilot's
// uncapped charge is about 4 bars a round (1v1 Arena: 2.7), which the cap turns into "about 3, never more".
// dev/tests/super-rounds.mjs measures every cell; dev/tests/super-timing.mjs holds the rules.
const SUP_ROUND_CAP=3,SUP_TAKEN_MAX=2;   // SUP_TAKEN_MAX: damage received fills at most this many bars a round (the third super of a round always needs damage dealt)
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
// ---- per-chassis builds and cores (Session 5E-2b3, owner Nov 14 2026: "each chassis class needs its own set of full cores and its
// own full set of custom upgrades") ----
// Each chassis class (Scout, Vanguard, Titan) has its own upgrade build S.upc[class] (hull..reactor 0-4, the BUILD_MAX budget and
// the reset per chassis) and its own seven cores: levels S.glc[class] (1-5) and shards S.gsc[class]. Points stay one wallet. A
// loadout carries its chassis's build and core levels (up, gl, as before) and every chassis it can swap to in a match carries its
// own (chs[i].up, chs[i].gl): loadoutFor() swaps all three together. A record from before (one shared up / gemLvl / gemShards)
// moves to the chassis of its active machine (ecoNorm); the owner's account copies it to all three (eco.js, owner rule Nov 14).
const UP0=()=>({hull:0,cannon:0,engine:0,target:0,reactor:0});
// own names only: a plain CH[c] / GEM[k] lookup also takes 'constructor', '__proto__' or 'toString' from a forged request (review, 5E-2b3)
const isCh=c=>typeof c==='string'&&CHORDER.includes(c),isGem=k=>typeof k==='string'&&GORDER.includes(k);
const chKey=c=>isCh(c)?c:'vanguard';
const chUp=(S,c)=>(S&&S.upc&&S.upc[chKey(c)])||UP0();
const chGl=(S,c)=>(S&&S.glc&&S.glc[chKey(c)])||{};
const chGs=(S,c)=>(S&&S.gsc&&S.gsc[chKey(c)])||{};
const upLevelsAll=S=>CHORDER.reduce((a,c)=>a+upLevels(chUp(S,c)),0);
function loadoutFor(L,c){if(!L||!c)return L;const o={...L,c:{c:c.c,t:c.t,q:c.q,s:!!c.s}};if(c.up)o.up={...c.up};if(c.gl)o.gl={...c.gl};return o;}   // swap a loadout to one of its chs entries
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
// each item's own name, Common / Rare / Epic (the server names a chosen item on its invoice)
const WNAMES={pulse:['Pulse Cannon','Arc Pulse','Nova Pulse'],twin:['Twin Repeater','Storm Repeater','Helix Repeater'],siege:['Siege Breaker','Rail Breaker','Titanfall']};
const CNAMES={scout:['Scout','Strider','Phantom'],vanguard:['Vanguard','Sentinel','Paladin'],titan:['Titan','Bulwark','Colossus']};
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
 hyper:{n:'Hyperspace',hull:'#171140',tur:'#261c63',trim:'#ffd46a',shine:true,only:'vault'},   // Hyperspace Vault level 7, never sold
 // Hazard finishes (Session 5E-2e): one per Arcade map, earned by WX_FINISH_N hazard takedowns on that map (hz: the map;
 // counted by the server only: ecoAfterMatch). Never sold.
 scorch:{n:'Meteor Scorch',hull:'#1c1614',tur:'#2b211d',trim:'#ff7a2e',only:'hazard',hz:'classic'},
 maglev:{n:'Maglev Runner',hull:'#8e9aa8',tur:'#aab6c4',trim:'#39e6ff',shine:true,only:'hazard',hz:'overpass'},
 arc:{n:'Arc Charge',hull:'#1b2356',tur:'#27317a',trim:'#b8f1ff',only:'hazard',hz:'longshot'},
 vent:{n:'Vent Breaker',hull:'#4a4f52',tur:'#5f666a',trim:'#8ff5d2',only:'hazard',hz:'craters'},
 devil:{n:'Dust Devil',hull:'#8a6a45',tur:'#a88458',trim:'#ffd9a0',only:'hazard',hz:'canyon'},
 grid:{n:'Laser Grid',hull:'#23272e',tur:'#343a44',trim:'#ff3b30',only:'hazard',hz:'bunker'},
 // The animated LIVE version of each finish: a premium store entry, NOT ON SALE (owner, Nov 17 2026: checkout stays off in
 // every currency until Session 8 certifies payments). soon holds the PROPOSED prices for the owner (TON; SOL follows TON at
 // the live rate, js/net.js; Stars only in Telegram). There is deliberately no ton / stars field: ecoPrice only prices a
 // paint that has one, so neither the phone nor the server can sell these. live: the earned finish it animates; fx: the look
 scorch_live:{n:'Meteor Scorch LIVE',hull:'#1c1614',tur:'#2b211d',trim:'#ff7a2e',shine:true,only:'soon',live:'scorch',fx:'embers',soon:{ton:7.2,stars:450}},
 maglev_live:{n:'Maglev Runner LIVE',hull:'#8e9aa8',tur:'#aab6c4',trim:'#39e6ff',shine:true,only:'soon',live:'maglev',fx:'rail',soon:{ton:7.2,stars:450}},
 arc_live:{n:'Arc Charge LIVE',hull:'#1b2356',tur:'#27317a',trim:'#b8f1ff',shine:true,only:'soon',live:'arc',fx:'arcs',soon:{ton:7.2,stars:450}},
 vent_live:{n:'Vent Breaker LIVE',hull:'#4a4f52',tur:'#5f666a',trim:'#8ff5d2',shine:true,only:'soon',live:'vent',fx:'steam',soon:{ton:7.2,stars:450}},
 devil_live:{n:'Dust Devil LIVE',hull:'#8a6a45',tur:'#a88458',trim:'#ffd9a0',shine:true,only:'soon',live:'devil',fx:'dust',soon:{ton:7.2,stars:450}},
 grid_live:{n:'Laser Grid LIVE',hull:'#23272e',tur:'#343a44',trim:'#ff3b30',shine:true,only:'soon',live:'grid',fx:'scan',soon:{ton:7.2,stars:450}}};
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
// ---- Arcade weather and map hazards (Session 5E-2e, owner decisions Nov 17 2026) ----
// Every Arcade match rolls its weather from one seed: clear / the map's vision effect only / its damaging hazard only / both
// (WX_ODDS). A pilot's first WX_FIRST_CLEAR matches are always clear. Each map has exactly ONE damaging hazard and one
// non-damaging vision effect (WX_MAP). The roll (wxRoll) and the whole timetable (wxPlan) are pure functions of (seed, map,
// round): no sim state, no random(), no trigonometry, only + - * / and sqrt, so the phone, a desktop, the live-match room
// (worker/src/pvp.js) and the proof-of-play check (worker/src/proof.js) all work out exactly the same plan. The sim
// (game.js weatherTick) decides every hit from that plan; the presentation layer (js/weather.js) only draws it.
// Rules for every damaging hazard: seeded; point-mirrored so both halves of the map are threatened equally (twin strikes,
// alternating which half goes first); always warned before it can hit (WX_HZ warn: sound + light, the same every time);
// never more than WX_CAP of a full hull per hit; a hazard that finishes a tank credits the last enemy who hit it within
// WX_CREDIT seconds, and pays exactly what any kill pays (no new points source).
const WX_ODDS=[0.25,0.35,0.20,0.20];   // clear, vision only, hazard only, both
const WX_FIRST_CLEAR=3,WX_CREDIT=5,WX_CAP=0.34,WX_SPAWN_SAFE=2.5,WX_HOME=2.2,WX_FINISH_N=25,WX_W=20,WX_H=32;   // WX_HOME: no hazard touches a tank this close to its own spawn seat
// hz: the damaging hazard; vis: the vision effect; fin: the paint finish 25 hazard takedowns on this map unlock
const WX_MAP={
 classic:{hz:'meteor',hn:'Meteor strikes',vis:'haze',vn:'Regolith haze',fin:'scorch'},
 overpass:{hz:'train',hn:'Maglev train',vis:'flare',vn:'Solar flare',fin:'maglev'},
 longshot:{hz:'arc',hn:'Pylon overload',vis:'flare',vn:'Solar flare',fin:'arc'},
 craters:{hz:'vent',hn:'Crater vents',vis:'steam',vn:'Vent steam',fin:'vent'},
 canyon:{hz:'tornado',hn:'Sand tornadoes',vis:'dust',vn:'Dust storm',fin:'devil'},
 bunker:{hz:'laser',hn:'Ceiling lasers',vis:'flicker',vn:'Power flicker',fin:'grid'}};
// dmg: hull damage of one hit at 1v1 hull scale (x the mode's hull scale, armor and plates apply, never above WX_CAP of the
// tank's full hull); warn: seconds of warning before it can hit; res: the Hull Plating trait that cuts it (a area, e energy)
const WX_HZ={
 meteor:{dmg:300,warn:1.6,r:2,txt:'METEOR',res:'a',how:'Streak and glow: drive off the spot'},
 train:{dmg:420,warn:2.8,hw:1.25,len:8,v:20,shove:2.2,txt:'TRAIN',res:'a',how:'Horn and rail lights: get off the deck'},
 arc:{dmg:320,warn:3,txt:'ARC',res:'e',how:'Three pulses: hide behind a container'},
 vent:{dmg:340,warn:2.2,txt:'VENT',res:'a',how:'Hiss and glowing cracks: leave the crater'},
 tornado:{dmg:70,warn:2.6,r:1.35,v:1.7,life:20,tick:0.5,push:0.9,txt:'TORNADO',res:'a',how:'Slow and loud: drive around it'},
 laser:{dmg:380,warn:2,r:1.1,v:8,txt:'LASER',res:'e',how:'Glowing mounts: step off the row'}};
// how far a tank can see (lock on and fire) while the effect is on it. local: only tanks inside a cloud, or looking into one
const WX_VIS={haze:{r:3.2,local:1,cr:2.8,life:9},flare:{r:4.6,len:20},steam:{r:3.2,local:1},dust:{r:4.2,len:22},flicker:{r:4.4}};
const WX_ARC_BL=[[7,10,6,2],[7,20,6,2]],WX_ARC_AT=[10,16];   // Longshot: the two containers that block the arcs; the pylon
const WX_VENTS={c:[10,16,3.6],f:[[15.5,14.5,2.8],[4.5,17.5,2.8]]};   // Crater Field: centre crater, the flank pair (blast radius: the crater and a wide rim)
const WX_STEAM=[[10,16,3.8],[15.5,14.5,2.9],[4.5,17.5,2.9]];
const WX_ROWS=[6,11,16,21,26];   // Bunker: the rows under the six wall housings 5E-2c left (6, 16, 26) and two rows of ceiling mounts between the blast doors and the reactor pillars (11, 21)
// Canyon: one tornado takes a path, its twin the point mirror. 'through' runs the rille end to end past the mesa, 'loop' circles a half
const WX_TORN=[[[10,2.5],[6,6],[5.5,11],[3.9,13.5],[3.9,18.5],[5,22],[9,25],[10,29.5]],
 [[4.5,3.5],[10,2.8],[16,6.5],[13.5,9],[7,7.2],[5.6,10.8],[5.6,5],[4.5,3.5]]];
const WX_DIR8=[[1,0],[0.7,0.7],[0,1],[-0.7,0.7],[-1,0],[-0.7,-0.7],[0,-1],[0.7,-0.7]];
function wxRoll(seed,clear){
 if(clear||!Number.isInteger(seed))return {k:0,vis:false,haz:false};
 const r=rng32((seed^0x57A7E5)|0)(),k=r<WX_ODDS[0]?0:r<WX_ODDS[0]+WX_ODDS[1]?1:r<WX_ODDS[0]+WX_ODDS[1]+WX_ODDS[2]?2:3;
 return {k,vis:k===1||k===3,haz:k>=2};
}
// The timetable of one round (round 0: a match without rounds; best of 3: 1..5), on the round's own clock. T: its length.
// hz: strikes, each {k, id, w: warning starts, t: it can hit from here, ...}:
//  c  circle (meteor, vent): hits once at t inside r of (x,y). soft: harmless grit (the haze effect without the hazard)
//  a  arc: hits once at t, every tank with a clear line to (x,y); bl: the boxes that block it
//  t  train: front enters the deck at t, runs x0..x1 (dir) at v, length len, half width hw around y
//  l  laser: a spot of radius r runs the row y from x0 to x1 at v, from t
//  n  tornado: forms at w, hits from t to e while it follows pts at v; radius r
// win: [{t0,t1}] when the whole-map vision effect is on (flare, dust, flicker); clouds: [{x,y,r,t0,t1}] (haze, steam)
function wxPlan(seed,map,round,T,clear){
 const roll=wxRoll(seed,clear),M=WX_MAP[map],P={k:roll.k,map,vis:roll.vis&&M?M.vis:null,haz:roll.haz&&M?M.hz:null,hz:[],win:[],clouds:[]};
 if(!M||!roll.k)return P;
 const mix=s=>rng32((Math.imul(((seed|0)+(round|0)*7919)|0,0x9E3779B1)^hashStr(map+s))|0),q=v=>Math.round(v*100)/100,cl=(v,a,b)=>v<a?a:v>b?b:v;
 let id=0;const hz=P.hz,H=WX_HZ[M.hz];
 {const rnd=mix('hz'),rr=(a,b)=>a+(b-a)*rnd();
  if(M.hz==='meteor'&&(roll.haz||roll.vis)){   // salvos of three walking a line 0.8 s apart (two in the air at a time), each with its mirrored twin 0.3 s behind or ahead
   const soft=!roll.haz;let t=rr(8,13),n=(rnd()*2)|0;
   while(t<T-4){const sx=rr(3.5,16.5),sy=rr(5.5,15),d0=(rnd()*8)|0,first=n%2;let d=WX_DIR8[d0];
    // the line stays inside its own half (its twin walks the other), so which half is hit first alternates exactly, salvo by salvo
    for(let j=0;j<8;j++){const c=WX_DIR8[(d0+j)%8],ex=sx+c[0]*5.6,ey=sy+c[1]*5.6;if(ex>=1.5&&ex<=WX_W-1.5&&ey>=2&&ey<=15.4){d=c;break;}}
    for(let i=0;i<3;i++){const x=cl(sx+d[0]*2.8*i,1.5,WX_W-1.5),y=cl(sy+d[1]*2.8*i,2,15.4);
     for(const m of [0,1]){const w=t+i*0.8+(m===first?0:0.3),s={k:'c',id:++id,w:q(w),t:q(w+H.warn),x:q(m?WX_W-x:x),y:q(m?WX_H-y:y),r:H.r};if(soft)s.soft=1;hz.push(s);
      if(roll.vis&&i!==1)P.clouds.push({x:s.x,y:s.y,r:WX_VIS.haze.cr,t0:s.t,t1:q(s.t+WX_VIS.haze.life)});}}
    n++;t+=rr(10,14);}
  }
  if(M.hz==='train'&&roll.haz){let t=rr(9,14),n=(rnd()*2)|0;   // alternate directions: the point mirror of a pass is the pass the other way
   while(t<T-5){hz.push({k:'t',id:++id,w:q(t),t:q(t+H.warn),dir:n%2?-1:1,y:16,hw:H.hw,x0:2,x1:18,len:H.len,v:H.v});n++;t+=rr(11,16);}}
  if(M.hz==='arc'&&roll.haz){let t=rr(11,16);
   while(t<T-5){hz.push({k:'a',id:++id,w:q(t),t:q(t+H.warn),x:WX_ARC_AT[0],y:WX_ARC_AT[1],bl:WX_ARC_BL});t+=rr(20,27);}}
  if(M.hz==='vent'&&roll.haz){let t=rr(8,13),n=(rnd()*4)|0;   // centre crater, then the flank pair (alternating which flank goes first)
   while(t<T-4){
    if(n%2===0)hz.push({k:'c',id:++id,w:q(t),t:q(t+H.warn),x:WX_VENTS.c[0],y:WX_VENTS.c[1],r:WX_VENTS.c[2],vent:1});
    else for(const m of [0,1]){const c=WX_VENTS.f[m],w=t+(m===((n>>1)&1)?0:0.6);hz.push({k:'c',id:++id,w:q(w),t:q(w+H.warn),x:c[0],y:c[1],r:c[2],vent:1});}
    n++;t+=rr(8,11);}}
  if(M.hz==='tornado'&&roll.haz){let t=rr(8,13);
   while(t<T-8){const base=WX_TORN[(rnd()*WX_TORN.length)|0],pts=rnd()<0.5?base:base.slice().reverse(),e=Math.min(T,t+H.warn+H.life);
    hz.push({k:'n',id:++id,w:q(t),t:q(t+H.warn),e:q(e),pts,v:H.v,r:H.r});
    hz.push({k:'n',id:++id,w:q(t),t:q(t+H.warn),e:q(e),pts:pts.map(p=>[q(WX_W-p[0]),q(WX_H-p[1])]),v:H.v,r:H.r});
    t+=H.warn+H.life+rr(8,12);}}
  if(M.hz==='laser'&&roll.haz){let t=rr(8,13),n=(rnd()*4)|0,md=rnd()<0.5?1:-1,pd=rnd()<0.5?1:-1;   // the middle row (its direction alternating), then a pair of rows in opposite directions (point mirrors): the inner pair, the outer pair
   const L=(y,d)=>({k:'l',id:++id,w:q(t),t:q(t+H.warn),y,x0:d>0?0:WX_W,x1:d>0?WX_W:0,v:H.v,r:H.r});
   while(t<T-5){const c=n%4;
    if(c%2===0){hz.push(L(WX_ROWS[2],md));md=-md;}else{const a=c===1?1:0;hz.push(L(WX_ROWS[a],pd));hz.push(L(WX_ROWS[4-a],-pd));pd=-pd;}
    n++;t+=rr(8,11);}}
  hz.sort((a,b)=>a.w-b.w||a.id-b.id);
 }
 if(roll.vis){const rnd=mix('vis'),rr=(a,b)=>a+(b-a)*rnd();
  if(M.vis==='flare'){const t=rr(12,24);P.win.push({t0:q(t),t1:q(t+WX_VIS.flare.len)});}   // one flare a round: supers charge twice as fast while it lasts
  if(M.vis==='dust'){let t=rr(10,18);while(t<T-10){P.win.push({t0:q(t),t1:q(t+WX_VIS.dust.len)});t+=WX_VIS.dust.len+rr(34,48);}}
  if(M.vis==='flicker'){let t=rr(8,14);while(t<T-6){const d=rr(6,8);P.win.push({t0:q(t),t1:q(t+d)});t+=d+rr(13,19);}}
  if(M.vis==='steam')for(const c of WX_STEAM)P.clouds.push({x:c[0],y:c[1],r:c[2],t0:5,t1:1e9});
 }
 return P;
}
// when a strike stops being able to hit
const wxEnd=s=>s.k==='t'?s.t+(s.x1-s.x0+s.len)/s.v:s.k==='l'?s.t+Math.abs(s.x1-s.x0)/s.v:s.k==='n'?s.e:s.t;
// the moving centre of a laser spot or a tornado at round time tau (a tornado holds its path's end once it gets there)
function wxPos(s,tau){
 const d=Math.max(0,tau-s.t)*s.v;
 if(s.k==='l'){const L=Math.abs(s.x1-s.x0),k=Math.min(L,d);return [s.x0+(s.x1>s.x0?k:-k),s.y];}
 let left=d;const p=s.pts;
 for(let i=1;i<p.length;i++){const dx=p[i][0]-p[i-1][0],dy=p[i][1]-p[i-1][1],l=Math.sqrt(dx*dx+dy*dy);
  if(left<=l){const f=l?left/l:0;return [p[i-1][0]+dx*f,p[i-1][1]+dy*f];}left-=l;}
 return [p[p.length-1][0],p[p.length-1][1]];
}
function wxSegRect(ax,ay,bx,by,r){   // does the segment cross the box (slab test)
 let t0=0,t1=1;const dx=bx-ax,dy=by-ay;
 const clip=(p,q)=>{if(p===0)return q>0;const k=q/p;if(p<0){if(k>t1)return false;if(k>t0)t0=k;}else{if(k<t0)return false;if(k<t1)t1=k;}return true;};
 if(!clip(-dx,ax-r[0])||!clip(dx,r[0]+r[2]-ax)||!clip(-dy,ay-r[1])||!clip(dy,r[1]+r[3]-ay))return false;
 return t1-t0>1e-6;
}
const wxArcSees=(s,x,y)=>!s.bl.some(r=>wxSegRect(s.x,s.y,x,y,r));   // a clear line from the pylon to the point
// is the point inside the strike's footprint at round time tau (pad widens it: a tank's body, or a check's tolerance).
// For a circle or an arc tau does not matter (they hit once, at t); the sim adds its own level rules (deck, tunnels)
function wxIn(s,tau,x,y,pad){
 pad=pad||0;
 if(s.k==='c'){const dx=x-s.x,dy=y-s.y,r=s.r+pad;return dx*dx+dy*dy<r*r;}
 if(s.k==='a')return wxArcSees(s,x,y);
 if(s.k==='t'){const f=s.dir>0?s.x0+s.v*(tau-s.t):s.x1-s.v*(tau-s.t),a=Math.max(s.x0,s.dir>0?f-s.len:f),b=Math.min(s.x1,s.dir>0?f:f+s.len);
  return Math.abs(y-s.y)<s.hw+pad&&x>a-pad&&x<b+pad;}
 const c=wxPos(s,tau),dx=x-c[0],dy=y-c[1],r=s.r+pad;return dx*dx+dy*dy<r*r;
}
// the whole-map vision effect: is it on at round time t (flare, dust storm, power flicker)
const wxWinOn=(P,t)=>P.win.some(w=>t>=w.t0&&t<w.t1);
// how far a tank at (ax,ay) can see a tank at (bx,by) at round time t: Infinity when nothing limits it
function wxSight(P,t,ax,ay,bx,by){
 if(!P||!P.vis)return Infinity;const V=WX_VIS[P.vis];
 if(!V.local)return wxWinOn(P,t)?V.r:Infinity;
 for(const c of P.clouds){if(t<c.t0||t>=c.t1)continue;const r2=c.r*c.r;
  if((ax-c.x)*(ax-c.x)+(ay-c.y)*(ay-c.y)<r2||(bx-c.x)*(bx-c.x)+(by-c.y)*(by-c.y)<r2)return V.r;}
 return Infinity;
}
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
 const t=tankOf(L,1),g=k=>t.gems.includes(k)?GEM[k].amt*t.gemM[k]:0,W=POWER_W,ln=Math.log,pe=fittingPe(L.mods);   // pe: the research mods' behaviors (rmodPe), 0 without them
 const h=ln(t.mhp*plateEhp(t.enR,t.arR)*(1+pe.h)/STAT.hp),d=ln(t.wdps*t.dmgM*(1+g('dmg'))*(1+g('rof'))*projectileImpactMult(t)*(1+pe.d)/STAT.dps),s=ln(t.spdM*(1+g('spd'))*(1+pe.s));
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
 return {w:{a:WORDER.includes(arch)?arch:'pulse',t:A.t,q:A.q,s:false},c:{c:isCh(cls)?cls:'vanguard',t:A.t,q:A.q,s:false},up:{hull:A.h,cannon:A.h,engine:A.e,target:A.x.tg|0,reactor:A.x.rc|0},
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
 // Science Lab research mods (Session 6B): their behaviors and numbers, read by both combat engines (RMOD_B below)
 {const B=fittingBehaviors(L.mods);if(Object.keys(B).length)T.rm=B;}
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
const CQ_PTS={kill:{light:35,heavy:90},field:450,raid:{HARD:900,VETERAN:1300},defense:675,strike:1075,titan:1600,gather:{flora:80,fe:100,il:140,ar:240,tq:390},hourMax:120};   // titan: Session 7C (owner brief, the old brief's D): the Hive Titan's kill, once per slot
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
// ---- Conquest loot v1 (Session 6; docs/conquest/audit/CONQUEST_1_0_SPEC.md §4, tables and pity exactly as §4.1) ----
// Every roll is made by the Worker (worker/src/conquest-loot.js) from the pilot's server-only seed and the kill id or attempt,
// so a reload can never re-roll; the client never sends an amount. Nothing here is ever sold (dev/tests/conquest-loot.mjs
// checks every id against the stores and catalogs) and no roll pays airdrop points. One rarity ladder for the whole game:
// grey, green, cyan, violet, gold (ConquestFeel.RARITY_COLORS).
const CQ_RARITY=['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];
const CQ_MN_RARITY={fe:0,il:1,ar:2,tq:3,se:3,mh:4};
// Conquest-only consumables: account-bound on pickup, at most CQ_ITEM_MAX of each, never usable in Arcade, PvP or the Home
// Sector, never sold. w = weight when a roll pays "a consumable"; cdMs = cooldown after a use (server clock).
const CQ_ITEMS={repair:{n:'Repair Kit',w1:'REPAIR',d:'+40% hull over 6 s',w:40,cdMs:60000,r:1,heal:0.4,healS:6},
 shield:{n:'Shield Cell',w1:'SHIELD',d:'Recharges SHIELD at once',w:25,cdMs:30000,r:1},
 scanner:{n:'Scanner Charge',w1:'SCANNER',d:'A SCAN 100 m wider that also finds every vein in this sector',w:20,cdMs:30000,r:1,extra:100},
 decoy:{n:'Decoy Beacon',w1:'DECOY',d:'Pulls Parasites within 120 m to a beacon for 8 s',w:15,cdMs:45000,r:1,radius:120,s:8}};
const CQ_ITEM_ORDER=['repair','shield','scanner','decoy'],CQ_ITEM_MAX=10;
// Session 7T (owner brief decision 2): the Peace Ward, an earnable 24-hour shield for your town (rare loot rows 'ward' below: live town
// defenses and Meteor Strikes; never sold, never in any store). Held in the town record (s.tw.ws, at most 10), used from the town.
const CQ_WARD={n:'Peace Ward',w1:'PEACE WARD',d:'Shields your town from Parasite raids for 24 hours',r:2,max:10};
// Research parts: the Science Lab's inputs (Session 6B). They drop and are stored now; 50 of each at most.
const CQ_PARTS={thermal:{n:'Thermal Core',w1:'THERMAL'},coil:{n:'Ballistic Coil',w1:'COIL'},servo:{n:'Drive Servo',w1:'SERVO'},cap:{n:'Field Capacitor',w1:'CAPACITOR'}};
const CQ_PART_ORDER=['thermal','coil','servo','cap'],CQ_PART_MAX=50,CQ_PART_R=2;
// One EARNED research part a day per account (owner, Nov 17: the UTC day on the Worker's clock, counted when the part reaches your
// inventory). A part found by play after it becomes 1 blueprint fragment of its source's own pool (elites incl. their pity part:
// uncommon; raid commanders, Meteor Strikes: rare): cosmetic only, never points. Parts from Lab store packs and the Lunar Pass
// (the account's bonus parts, eco S.bpt) are not earned: never limited
const CQ_PART_DAY=1,CQ_PART_SWAP=Object.freeze({elite:'u',commander:'r',strike:'r'});
// Blueprint fragments: 10 of a pool = one cosmetic of that pool (ConquestCatalog), server-picked without repeats. Earn-only
// pools, disjoint from every store: common = plate finishes, uncommon = banner standards, rare = muzzle trails, epic = town
// ornaments (the Titan's epic rows arrive in 7B).
const CQ_FRAG={need:10,order:['c','u','r','e'],pools:{c:{n:'COMMON',r:0,slot:'armor'},u:{n:'UNCOMMON',r:1,slot:'commander'},r:{n:'RARE',r:2,slot:'trail'},e:{n:'EPIC',r:3,slot:'base'}}};
// Trophies for the Trophy Hall: one per raid-commander doctrine and the Strike Core (every 12th secured Meteor Strike). Each
// trophy type held adds +15 Town Score once; the full set unlocks the earn-only Hive banner emblem. Session 7C: the Hive Titan's trophy
// (30% a kill, LOOT.titan) joins the set, as reserved.
const CQ_TROPHY={ambush:{n:'Ambush Commander',r:3},shield:{n:'Shield Commander',r:3},artillery:{n:'Artillery Commander',r:3},carrier:{n:'Carrier Commander',r:3},plasma:{n:'Plasma Siege General',r:3},core:{n:'Strike Core',r:4},'hive-titan':{n:'Hive Titan',r:4}};
const CQ_TROPHY_ORDER=['ambush','shield','artillery','carrier','plasma','core','hive-titan'],CQ_TROPHY_SCORE=15,CQ_TROPHY_RESERVED=[];
// The drop tables. rows: independent rolls (p = chance) of a mineral unit (mn), consumables (item = how many), a research part,
// a fragment (frag = pool) or the commander's trophy. ring: extra rows from that ring outward (ConquestWorld.ringAt; a raid's
// ring is its danger: HARD 3, VETERAN 4). always: paid every time. pity: hard pity, never more than that many rolls without.
const LOOT={
 mob:{rows:[{p:0.12,mn:'fe'},{p:0.03,mn:'il'},{p:0.04,item:1},{p:0.005,frag:'c'}]},                       // interceptor, saboteur
 elite:{rows:[{p:0.25,mn:'il'},{p:0.06,mn:'ar'},{p:0.08,item:1},{p:0.03,part:1},{p:0.01,frag:'u'}],pity:{part:20}},   // sentinel, fire coordinator
 commander:{rows:[{p:0.12,part:1},{p:0.10,trophy:1},{p:0.05,frag:'r'}],ring:{4:[{p:0.08,mn:'tq'}]},pity:{trophy:10}},   // the five raid commanders; +8% Tranquillityite at VETERAN
 chest:{always:{item:1},rows:[{p:0.08,frag:'r'}]},                                                       // raid completion chest (the 25-shard blueprint and 3.5% elite roll stay)
 strike:{rows:[{p:0.15,part:1},{p:0.10,frag:'r'},{p:0.03,ward:1}]},                                      // Meteor Strike secured (its minerals and Resonance unchanged); Session 7T: a Peace Ward 3%
 defense:{rows:[{p:0.06,item:2},{p:0.04,frag:'u'},{p:0.05,ward:1}]},                                     // invasion / town defense held live (the defense cache unchanged); Session 7T: a Peace Ward 5%
 order:{daily:{item:1},third:{frag:'u'},weekly:{mn:{ar:1},frag:'r'}},                                    // War Orders (Part E): every daily, the day's third, the weekly
 // Session 7C (spec §4.1's Titan row, the old brief's D): the Hive Titan's kill, rolled once per slot: 25% a research part, 20% Selenite,
 // 2% Moonheart, 30% its trophy, 10% an epic fragment; pity: never more than 5 Titans without a Selenite. The decided row's guaranteed
 // 2 Tranquillityite is kept out: with it the fortress guard (e) fails (Checkpoint 50, "Guards with everything on"; a PROPOSAL)
 titan:{rows:[{p:0.25,part:1},{p:0.20,mn:'se'},{p:0.02,mn:'mh'},{p:0.30,trophy:1},{p:0.10,frag:'e'}],pity:{se:5}}};
// ---- Session 6 Part E (owner Decisions 2a, 3a; spec §6.1, §6.2) ----
// Daily Base Yield points unlock in steps: each verified operation that UTC day unlocks 25% of the points part; a harvest (bio-flora
// or a mineral pull) counts half, and harvests together unlock at most half (so 8 five-second pulls cannot open what 4 operations
// open: the decision's purpose is to quarter the alt yield). Materials part unchanged. A collect pays the unlocked share of the
// meter and leaves the rest filling; later operations that day unlock it.
const CQ_YIELD_STEP={op:0.25,harvest:0.125,harvestMax:0.5};
function cqYieldUnlock(yd,day){const y=yd&&yd.d===day?yd:{op:0,hv:0},S=CQ_YIELD_STEP,u=Math.min(1,S.op*(y.op|0)+Math.min(S.harvestMax,S.harvest*(y.hv|0)));return {u,ops:y.op|0,hv:y.hv|0,toGo:Math.max(0,Math.ceil((1-u)/S.op-1e-9))};}
// Field-mission airdrop points on repeats (Decision 3a): 100% for the first three completions of a mission in a UTC day, then 60%,
// then 40%. CP keeps its own taper; raids, strikes and defenses unchanged.
const CQ_FIELD_TAPER=[1,1,1,0.6,0.4];
const cqFieldTaper=n=>CQ_FIELD_TAPER[Math.min(CQ_FIELD_TAPER.length-1,Math.max(0,(n|0)-1))];
// War Orders (the contracts board, spec §6.1, stored with a source so the war can feed it later): three daily orders drawn per UTC
// day and one weekly per UTC week (Monday) from the pilot's server seed, among the orders the pilot can do now (elig: raids =
// raids unlocked, town = a town claimed, striker = a Meteor Strike secured before). Claimed at the Refuge terminal or the Command
// Gate. Rewards: CP + LOOT.order (a consumable each daily, an uncommon fragment for the day's third, the weekly's Armalcolite + rare
// fragment). Never airdrop points: points come only from the activities themselves.
const CQ_ORDERS={claimR:30,daily:3,
 pool:[{id:'raids2',t:'Win 2 raids',ev:'raid',goal:2,cp:300,elig:'raids'},{id:'bank60',t:'Bank 60 alloy',ev:'bankAlloy',goal:60,cp:200},
  {id:'mine12',t:'Mine 12 ore',ev:'mine',goal:12,cp:200},{id:'drill1',t:'Hold a Defense Drill',ev:'drill',goal:1,cp:200,elig:'town'},
  {id:'strike1',t:'Secure a Meteor Strike',ev:'strike',goal:1,cp:300,elig:'striker'},{id:'kills15',t:'Destroy 15 Parasites',ev:'kill',goal:15,cp:150},
  {id:'sectors3',t:'Finish a field mission in 3 sectors',ev:'fieldSector',goal:3,cp:250}],
 weekly:[{id:'raids10',t:'Win 10 raids',ev:'raid',goal:10,cp:1500,elig:'raids'},{id:'hold4',t:'Hold 3 drills and 1 live defense',ev:'hold',goal:4,cp:1500,elig:'town',parts:{drill:3,defense:1}},
  {id:'strikes3',t:'Secure 3 Meteor Strikes',ev:'strike',goal:3,cp:1500,elig:'striker'},{id:'ops15',t:'Win 15 operations',ev:'op',goal:15,cp:1500}]};
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
const RPRICE=[4,8,23],RSTARS=[250,500,1500];
// Gem caches with points (Session 5E-2b3, owner Nov 14: "cores are bought with points using the same gem caches as the paid version,
// Epic included; the amount of points equals the amount of money: one fixed points-per-Star rate for every gem cache"). GEM_PTS_STAR
// is that rate. Owner's numbers (Nov 14, 2026, Checkpoint 38): 120 points a Star for a random gem cache, CORE_PTS_STAR = 175 a Star
// (of the same cache's Stars price) for a chosen core; the 12-week model (docs/economy/chassis-kit-model.json) reports what they
// give: a free pilot who plays 20 minutes a day plus the daily quests kits one chassis (14 upgrade levels and all seven cores at
// level 5) in about 12 weeks.
// Weapon caches and chassis crates (owner, Nov 14, 2026, Checkpoint 39): the same 120 points a Star of the crate's price as a gem
// cache, Epic included (RPTS). Chosen gear (same as cores): pick the exact weapon or chassis and its rarity, no random roll, for
// CORE_PTS_STAR (175) points a Star of the same crate's price, or CORE_X (1.5x) the crate's money price; it gets the same 105-110%
// quality roll a crate gives it. An item you already own can't be bought again. A points buy never raises a money price step.
// A gem cache or chosen core bought with points does not raise that day's money price (the +25% a buy counts money buys only).
// The chosen core (owner-approved): pick the core and the chassis; CORE_N shards of it (the top of the cache's range) for CORE_X
// times the cache's money price, and CORE_PTS_STAR points a Star in points, so no roll can land on a core you have already maxed.
const GEM_PTS_STAR=120,CORE_PTS_STAR=175,GEM_PTS=RSTARS.map(s=>s*GEM_PTS_STAR),CORE_X=1.5,CORE_N=[2,4,14];   // 30,000 / 60,000 / 180,000 points; chosen cores 43,750 / 87,500 / 262,500
const corePts=ri=>Math.round(RSTARS[ri]*CORE_PTS_STAR);   // points: CORE_PTS_STAR a Star of the same cache's price. Money: CORE_X (1.5x) the cache's price
const RPTS=GEM_PTS;   // weapon caches and chassis crates for points: 30,000 / 60,000 / 180,000 (was 20,000 / 80,000 / paid only)
const gearPts=corePts;   // a chosen weapon or chassis for points: 43,750 / 87,500 / 262,500, the chosen core's rate
const gearTk=k=>WORDER.indexOf(k)>=0?'weapon':CHORDER.indexOf(k)>=0?'chassis':null;   // which crate a chosen item comes from (never a prototype name)
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
// every daily quest pays DQ_PTS (Easy, Medium and Hard alike), before the quest streak bonus; every weekly quest pays WQ_Q_PTS.
// Owner's numbers (Nov 14, 2026, Checkpoint 38): 3,500 a daily and 12,500 a weekly (were 500 and 2,500-5,000); the all-4 bonus
// (DQ_ALL_BONUS) and the weekly chest (WQ_PTS) are unchanged
const DQ_PTS=3500,WQ_Q_PTS=12500;
const DQ_POOL=[
 {id:'play4',lv:0,t:'Play 4 matches',goal:4,pts:DQ_PTS,st:'plays'},
 {id:'win2',lv:0,t:'Win 2 matches',goal:2,pts:DQ_PTS,st:'wins'},
 {id:'box3',lv:0,t:'Grab 3 mystery boxes',goal:3,pts:DQ_PTS,st:'boxes'},
 {id:'sup3',lv:0,t:'Fire 3 supers',goal:3,pts:DQ_PTS,st:'sups'},
 {id:'dmg6k',lv:0,t:'Deal 6,000 damage',goal:6000,pts:DQ_PTS,st:'dmg'},
 {id:'kill4',lv:0,t:'Destroy 4 enemy tanks',goal:4,pts:DQ_PTS,st:'kills'},
 {id:'feat1',lv:0,t:'Play a featured-mode match',goal:1,pts:DQ_PTS,st:'featured'},
 {id:'quick1',lv:0,t:'Play a Quick Match',goal:1,pts:DQ_PTS,st:'quick'},
 {id:'win4',lv:1,t:'Win 4 matches',goal:4,pts:DQ_PTS,st:'wins'},
 {id:'kill10',lv:1,t:'Destroy 10 enemy tanks',goal:10,pts:DQ_PTS,st:'kills'},
 {id:'dmg15k',lv:1,t:'Deal 15,000 damage',goal:15000,pts:DQ_PTS,st:'dmg'},
 {id:'kill4m',lv:1,t:'Destroy 4 tanks in one match',goal:4,pts:DQ_PTS,st:'kills',mx:1},
 {id:'nodie',lv:1,t:'Win without being destroyed',goal:1,pts:DQ_PTS,st:'cleanWins'},
 {id:'zwin',lv:1,t:'Win a Moon Zone match',goal:1,pts:DQ_PTS,st:'zoneWins'},
 {id:'cap3',lv:1,t:'Capture the Moon Zone 3 times',goal:3,pts:DQ_PTS,st:'caps'},
 {id:'cry10',lv:1,t:'Collect 10 crystals in Crystal Rush',goal:10,pts:DQ_PTS,st:'crystals'},
 {id:'bnt5',lv:1,t:'Earn 5 bounty stars',goal:5,pts:DQ_PTS,st:'stars'},
 {id:'top3',lv:1,t:'Finish top 3 in Last Standing',goal:1,pts:DQ_PTS,st:'top3'},
 {id:'twin',lv:1,t:'Win a 2v2 or 3v3 match',goal:1,pts:DQ_PTS,st:'teamWins'},
 {id:'ovpw',lv:1,t:'Win a match on Overpass',goal:1,pts:DQ_PTS,st:'ovpWins'},
 {id:'win6',lv:2,t:'Win 6 matches',goal:6,pts:DQ_PTS,st:'wins'},
 {id:'row3',lv:2,t:'Win 3 matches in a row',goal:3,pts:DQ_PTS,st:'streak',mx:1},
 {id:'nodie2',lv:2,t:'Win 2 matches without being destroyed',goal:2,pts:DQ_PTS,st:'cleanWins'},
 {id:'sweep',lv:2,t:'Win a 1v1 Arena match 2-0',goal:1,pts:DQ_PTS,st:'sweeps'},
 {id:'ls1',lv:2,t:'Win a Last Standing match',goal:1,pts:DQ_PTS,st:'royaleWins'},
 {id:'featw3',lv:2,t:'Win 3 featured-mode matches',goal:3,pts:DQ_PTS,st:'featWins'},
 {id:'bntw2',lv:2,t:'Win 2 Bounty matches',goal:2,pts:DQ_PTS,st:'bountyWins'},
 {id:'cryw2',lv:2,t:'Win 2 Crystal Rush matches',goal:2,pts:DQ_PTS,st:'crystalWins'}];
const DQ_SLOTS=[0,0,1,2],DQ_LV=['Easy','Medium','Hard'],DQ_ALL_BONUS=1000,DQ_SWAPS=1;
// Weekly quests are the same for every pilot: the first WQ_FIXED every week, plus WQ_N-WQ_FIXED picked by the week.
// u: counts different values (days played, modes won), not a total. mx: best single match (or current win streak).
// pd: on how many different days you reached pd of it (N a day on M days); goal counts days
const WQ_POOL=[
 {id:'wdays',t:'Play on 5 different days',goal:5,pts:WQ_Q_PTS,st:'day',u:1},
 {id:'wquick30',t:'Play 30 Quick Matches',goal:30,pts:WQ_Q_PTS,st:'quick'},
 {id:'wwin20',t:'Win 20 matches',goal:20,pts:WQ_Q_PTS,st:'wins'},
 {id:'wplay35',t:'Play 35 matches',goal:35,pts:WQ_Q_PTS,st:'plays'},
 {id:'wkill50',t:'Destroy 50 enemy tanks',goal:50,pts:WQ_Q_PTS,st:'kills'},
 {id:'wdmg',t:'Deal 80,000 damage',goal:80000,pts:WQ_Q_PTS,st:'dmg'},
 {id:'wmodes',t:'Win in 4 different modes',goal:4,pts:WQ_Q_PTS,st:'winMode',u:1},
 {id:'wzone6',t:'Win 6 Moon Zone matches',goal:6,pts:WQ_Q_PTS,st:'zoneWins'},
 {id:'wteam8',t:'Win 8 team matches (2v2 or 3v3)',goal:8,pts:WQ_Q_PTS,st:'teamWins'},
 {id:'wls3d',t:'Win Last Standing on 3 different days',goal:3,pts:WQ_Q_PTS,st:'royaleWins',pd:1},
 {id:'wrow5',t:'Win 5 matches in a row',goal:5,pts:WQ_Q_PTS,st:'streak',mx:1},
 {id:'wfeat16',t:'Play 16 featured-mode matches',goal:16,pts:WQ_Q_PTS,st:'featured'},
 {id:'wsup60',t:'Fire 60 supers',goal:60,pts:WQ_Q_PTS,st:'sups'},
 {id:'wbox30',t:'Grab 30 mystery boxes',goal:30,pts:WQ_Q_PTS,st:'boxes'},
 {id:'wclean4d',t:'Win 2 matches without being destroyed on 4 different days',goal:4,pts:WQ_Q_PTS,st:'cleanWins',pd:2},
 {id:'wcap30',t:'Capture the Moon Zone 30 times',goal:30,pts:WQ_Q_PTS,st:'caps'}];
const WQ_N=5,WQ_FIXED=2,PASS_XP_WQ=150,WQ_GOAL=20,WQ_PTS=5000;   // WQ_GOAL dailies open the weekly chest
// weekly quests from before Oct 19, 2026 (per-pilot lists): kept only so a list started that week still shows. Safe to delete after Oct 26
const WQ_OLD=[{id:'wls2',t:'Win 2 Last Standing matches',goal:2,pts:WQ_Q_PTS,st:'royaleWins'},{id:'wquick8',t:'Play 8 Quick Matches',goal:8,pts:WQ_Q_PTS,st:'quick'},
 {id:'wfeat8',t:'Play 8 featured-mode matches',goal:8,pts:WQ_Q_PTS,st:'featured'},{id:'wsup25',t:'Fire 25 supers',goal:25,pts:WQ_Q_PTS,st:'sups'},
 {id:'wclean5',t:'Win 5 matches without being destroyed',goal:5,pts:WQ_Q_PTS,st:'cleanWins'},{id:'wcap15',t:'Capture the Moon Zone 15 times',goal:15,pts:WQ_Q_PTS,st:'caps'}];
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
const ECO_KEYS=['pts','earned','dailyPts','weeklyPts','dailyDay','weeklyNum','days','sk','ld','fd','upc','glc','gsc','wOwn','cOwn','roll','salv',
 'lab','paints','skin','moonbeam','starter','founder','pass','dq','wk','wq','q','login','streak','buys','dealD','dealW','refC','refPD','refWelcome','vd','vdl','rfe','rb','rms','vac','mbx','wins','losses','mp','ptsSpent','spendGram','rsCr','vg','vgg','fx','g2','lwr','lgi','lg','lgb','mn','ap','mnw','bmn','hz',   // hz: hazard takedowns per Arcade map (5E-2e)
 'rm','lsm','bpt','rsx','rsj','bch','liv','rcx','cq','cqc','wmn','cfx','ord'];   // Session 8: the Conquest store's entitlements, bought pieces, wall-only ore, paid construction finishes, open quotes (the Worker writes them; the phone only shows them)   // Session 6C: pack command chips (a monotonic total), liveries owned, RECRUIT instant-finish credits: written only by ecoGrant after a verified payment (checkout off)   // Session 6B: researched mods (Legendary set mods too, once researched), Legendary set mods bought, bonus research parts (pass tiers, packs; monotonic), instant-finish credits, Legendary set mods being researched
const listOf=v=>Array.isArray(v)?v.filter(x=>x!==null&&x!==undefined):v&&typeof v==='object'?Object.values(v):[];
// fill in anything missing: new pilots, old saves, and database copies (the database drops empty lists and objects)
function ecoNorm(S,opt){
 if(S.lab&&S.lab.v===1&&S.lab.machines)for(const M of Object.values(S.lab.machines)){
  if(M&&M.spec){const c=M.spec.cores;M.spec.cores=[0,1,2].map(i=>c&&GEM[c[i]]?c[i]:null);}
 }
 const obj=k=>{if(!S[k]||typeof S[k]!=='object'||Array.isArray(S[k]))S[k]={};return S[k];};
 if(typeof S.vgg!=='number'&&GENESIS_OPEN)S.vgg=Number(S.vg)||0;   // Gold deposited before Genesis Gold was tracked: all of it was pre-launch
 if(typeof S.lwr!=='number'||!Number.isFinite(S.lwr))S.lwr=0.5;S.lgi=Math.max(0,Math.min(LEAGUE.length-1,S.lgi|0));S.lg=LEAGUE[S.lgi].key;
 for(const k of ['pts','earned','dailyPts','weeklyPts','streak','wins','losses','mp','ptsSpent','spendGram','days','sk','rsCr','vg','vgg','vd','rfe','lgb'])if(typeof S[k]!=='number'||!Number.isFinite(S[k]))S[k]=k==='earned'?(Number(S.pts)||0):0;
 // per-chassis builds and cores (5E-2b3). A record from before: its one shared build and cores move to the chassis of its active
 // machine (opt.allChassis: copied to all three, the owner's account); the old fields are then gone for good
 if(!S.upc||typeof S.upc!=='object'||Array.isArray(S.upc)){
  const home=homeChassis(S),up0=S.up&&typeof S.up==='object'?S.up:{},gl0=S.gemLvl&&typeof S.gemLvl==='object'?S.gemLvl:{},gs0=S.gemShards&&typeof S.gemShards==='object'?S.gemShards:{};
  S.upc={};S.glc={};S.gsc={};for(const c of (opt&&opt.allChassis?CHORDER:[home])){S.upc[c]={...up0};S.glc[c]={...gl0};S.gsc[c]={...gs0};}
 }
 delete S.up;delete S.gemLvl;delete S.gemShards;
 const upc=obj('upc'),glc=obj('glc'),gsc=obj('gsc'),tab=(T,c)=>T[c]&&typeof T[c]==='object'&&!Array.isArray(T[c])?T[c]:(T[c]={});
 for(const T of [upc,glc,gsc])for(const c in T)if(!CHORDER.includes(c))delete T[c];
 for(const c of CHORDER){
  const up=tab(upc,c);for(const k in up)if(!UORDER.includes(k))delete up[k];for(const k of UORDER)up[k]=Math.max(0,Math.min(4,up[k]|0));
  // over the build budget (levels bought before it existed): the top levels come off, paid back in full
  while(upLevels(up)>BUILD_MAX){let k=UORDER[0];for(const j of UORDER)if(up[j]>=up[k])k=j;up[k]--;S.pts+=UPS[k].costs[up[k]];S.ptsSpent=Math.max(0,S.ptsSpent-UPS[k].costs[up[k]]);}
  const gl=tab(glc,c),gs=tab(gsc,c);for(const T of [gl,gs])for(const k in T)if(!GORDER.includes(k))delete T[k];
  for(const k of GORDER){gl[k]=Math.max(1,Math.min(5,gl[k]|0||1));gs[k]=Math.max(0,gs[k]|0);}
 }
 const wo=obj('wOwn'),co=obj('cOwn');
 for(const k of WORDER)wo[k]=[...new Set(listOf(wo[k]).map(Number).filter(t=>t>=0&&t<=2))];
 for(const k of CHORDER)co[k]=[...new Set(listOf(co[k]).map(Number).filter(t=>t>=0&&t<=2))];
 for(const k in wo)if(!WORDER.includes(k))delete wo[k];for(const k in co)if(!CHORDER.includes(k))delete co[k];
 if(!wo.pulse.includes(0))wo.pulse.unshift(0);if(!co.vanguard.includes(0))co.vanguard.unshift(0);   // starter gear
 obj('roll');obj('salv');obj('q');obj('buys');obj('refC');obj('hz');const pa=obj('paints');pa.stock=1;if(vaultLevel(S.vg)>=VAULT_PAINT_LV)pa.hyper=1;else delete pa.hyper;
 if(S.skin!=='lunar')S.skin='default';S.moonbeam=!!S.moonbeam;S.starter=!!S.starter;S.founder=!!S.founder;
 if(S.dq&&typeof S.dq==='object'){S.dq.ids=listOf(S.dq.ids);S.dq.p=S.dq.p||{};S.dq.c=S.dq.c||{};S.dq.was=listOf(S.dq.was);}
 if(S.wk&&typeof S.wk==='object'){S.wk.ids=listOf(S.wk.ids);S.wk.p=S.wk.p||{};S.wk.u=S.wk.u||{};S.wk.c=S.wk.c||{};for(const id in S.wk.u)S.wk.u[id]=listOf(S.wk.u[id]);}
 if(S.pass&&typeof S.pass==='object'){S.pass.cf=listOf(S.pass.cf);S.pass.cp=listOf(S.pass.cp);S.pass.xp=Number(S.pass.xp)||0;S.pass.prem=!!S.pass.prem;}
 // Session 6B research: the mods the Science Lab finished (credited from the Conquest record's outbox), Legendary set mods
 // bought, bonus parts (Lunar Pass premium tiers and part packs: a running total that only grows) and instant-finish credits
 // rm holds Legendary set mods too once researched (the free path, Session 6B finish); rsj: Legendary set mods being researched (bought ones are lsm)
 {const rm=obj('rm'),ls=obj('lsm'),bp=obj('bpt'),rx=obj('rsx'),rj=obj('rsj');for(const k in rm)if(!rmodOf(k)||!rm[k])delete rm[k];else rm[k]=1;
  for(const k in rj)if(!rmodOf(k)||!rmodOf(k).F.leg||!rj[k]||rm[k])delete rj[k];else rj[k]=1;
  for(const k in ls)if(!rmodOf(k)||!rmodOf(k).F.leg||!ls[k])delete ls[k];else ls[k]=1;
  for(const k in bp)if(!CQ_PARTS[k])delete bp[k];for(const k of CQ_PART_ORDER)bp[k]=Math.max(0,Math.min(1e5,Math.floor(Number(bp[k])||0)));
  for(const k of Object.keys(rx))if(!/^j\d{1,6}$/.test(k)||!(Number(rx[k])>0))delete rx[k];}
 // Session 8: the Conquest store's entitlements (S.cq), bought collection pieces (S.cqc), wall-only ore (S.wmn), paid construction
 // finishes (S.cfx) and the open quotes (S.ord: one per item across Stars, GRAM and SOL); written only by the Worker
 {const c=obj('cq');for(const k of Object.keys(c))if(!['b2','lay','gild','neon','aur','ext','fr'].includes(k))delete c[k];for(const k of ['b2','lay','gild','neon','aur'])if(c[k])c[k]=1;else delete c[k];
  c.ext=Math.max(0,Math.min(EXT_MAX_PCT/10,c.ext|0));if(!c.ext)delete c.ext;c.fr=Math.max(0,Number(c.fr)||0);if(!c.fr)delete c.fr;
  const cc=obj('cqc');for(const k of Object.keys(cc))if(!SHOP.cos[k]||!cc[k])delete cc[k];else cc[k]=1;
  const w=obj('wmn');for(const k of Object.keys(w))if(!SHOP.ore[k])delete w[k];for(const k of SHOP.oreOrder)w[k]=Math.max(0,Math.min(1e6,Math.floor(Number(w[k])||0)));
  const fx=obj('cfx');for(const k of Object.keys(fx))if(!cfxKey(k)||!fx[k])delete fx[k];else fx[k]=1;
  const od=obj('ord');for(const k of Object.keys(od)){const v=od[k];if(!v||typeof v!=='object'||typeof v.q!=='string'||!(Number(v.e)>0)||k.length>60)delete od[k];}
  const ra=obj('rsjAt');for(const k of Object.keys(ra))if(!rmodOf(k)||!(Number(ra[k])>0)||!(S.rsj&&S.rsj[k]))delete ra[k];}
 S.mn=mnOf(S.mn);S.ap=apOf(S.ap);if(S.bmn!==undefined)S.bmn=mnOf(S.bmn);if(S.mnw&&typeof S.mnw==='object'){S.mnw={w:S.mnw.w|0,n:Math.max(0,S.mnw.n|0),p:S.mnw.p?1:0};}else delete S.mnw;   // minerals, Hull Plating, weekly league minerals
 return S;
}
// ---- gear in the state ----
// the chassis a record flies now: its active machine's (the Lab), else its last loadout's, else its old garage pick
function homeChassis(S){const M=S&&S.lab&&S.lab.machines&&S.lab.machines[S.lab.active],c=(M&&M.spec&&M.spec.c&&M.spec.c.c)||(S&&S.L&&S.L.c&&S.L.c.c)||(S&&S.chassis);
 if(!isCh(c)||c==='vanguard')return 'vanguard';
 // a chassis no longer owned (refunded) is not home: the fielded loadout falls back to the Vanguard, so free caches and builds do too
 let own=false;try{own=!!(S.cOwn&&typeof S.cOwn==='object'&&bestOf(S,false,c));}catch(e){own=false;}return own?c:'vanguard';}
const ownsCh=(S,c)=>isCh(c)&&!!bestOf(S,false,c);
// the chassis an economy action is for: the one asked for if the pilot owns it, else the one they fly now
const chFor=(S,c)=>ownsCh(S,c)?c:homeChassis(S);
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
 const seen={},cores=[0,1,2].map(i=>{const k=L0.cores&&L0.cores[i];if(!isGem(k)||seen[k])return null;seen[k]=1;return k;});
 const chs=CHORDER.filter(k=>bestOf(S,false,k)).map(k=>({...(k===c.c?{...c}:pick(false,{c:k,t:-9})),up:{...chUp(S,k)},gl:{...chGl(S,k)}}));   // each with its own build and cores
 const paint=PAINTS[L0.paint]&&S.paints&&S.paints[L0.paint]?L0.paint:'stock';
 const mods=fittingOwned(S,S.lab?L0.mods:undefined),f=fittingStats(mods);   // research mods only once researched (S.rm), Legendary set mods once bought (S.lsm): the server record, never the client
 const legal=f.weight<=FIT_BUDGET.weight&&f.power<=FIT_BUDGET.power;
 return {mods:legal?mods:fittingSelection(),looks:fittingValid(L0.looks,true)?{...(L0.looks||{})}:{},catalog:FIT_VERSION,w,c,up:{...chUp(S,c.c)},cores,gl:{...chGl(S,c.c)},skin:S.skin==='lunar'?'lunar':'default',paint,chs,vl:vaultLevel(S.vg),ap:apOf(S.ap)};   // vl: Vault level, looks only; ap: owned Hull Plating (never from the client)
}
// ---- Session 7B: the Citadel's first-clear airdrop bounties (owner, Nov 23: the blueprint's table x5; IV-IX for Session 11), base points,
// once per account, outside the daily cap (a one-time progression milestone: ecoAward's free path). Index = tier. The Conquest record
// sends a tier's bounty once, when that tier is first cleared (worker/src/conquest-citadel.js); the account credits each id once here,
// by id (S.cbty), so a Conquest record reset, a replayed entry or a second entry with the same id can never pay twice
const CIT_BOUNTY=Object.freeze([0,25000,37500,50000,75000,100000,150000,225000,325000,500000]);
const CIT_LIVE=3;   // the Citadel tiers built (Act I); Session 11 raises it with tiers IV-IX (js/conquest/citadel.js CIT.live reads it)
function ecoBounty(S,id,X){const m=/^cit([1-9])$/.exec(String(id||''));if(!m||+m[1]>CIT_LIVE)return 0;const n=CIT_BOUNTY[+m[1]]|0;if(!n)return 0;
 if(!S.cbty||typeof S.cbty!=='object'||Array.isArray(S.cbty))S.cbty={};if(S.cbty[id])return 0;S.cbty[id]=Math.max(1,X.day|0);return ecoAward(S,n,X,true);}
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
 if(d.kind==='rspack'){const P=RS_PACKS[d.tk];return P?{ton:P.ton,stars:P.stars}:null;}
 if(d.kind==='rsleg')return rsLegSet(d.tk)?{ton:RS_LEG_PRICE.ton,stars:RS_LEG_PRICE.stars}:null;
 if(d.kind==='rsfin')return rsFinPrice(d.left);   // the time left comes from the Conquest record's job on the Worker, never from the phone
 if(d.kind==='chippack')return {ton:CHIP_PACK.ton,stars:CHIP_PACK.stars};
 if(d.kind==='livery'){const L=LIVERIES[d.tk];return L?{ton:L.ton,stars:L.stars}:null;}
 if(d.kind==='rcfin')return rsFinPrice(d.left);   // the RECRUIT job's time left, from the Conquest record on the Worker (Session 6C)
 if(CQ_KINDS.includes(d.kind))return cqPrice(d);   // Session 8: the Conquest store, the catalog, mineral and wall-only ore crates, construction speed-ups (SHOP)
 if(d.kind==='respec'){const t=respecTier(upInvested(chUp(S,chFor(S,d.c))));return t?{ton:Math.round(t*RESPEC_TON_USD*100)/100,stars:Math.round(t*RESPEC_STARS_USD),usd:t}:null;}
 if(d.kind==='gear'){const tk=gearTk(d.tk);if(!tk||!(d.ri>=0&&d.ri<=2))return null;const m=ecoBoxMult(S,tk,d.ri,X)*CORE_X;return {ton:Math.round(RPRICE[d.ri]*m*100)/100,stars:Math.round(RSTARS[d.ri]*m)};}   // 1.5x the crate's price right now (before any deal)
 if(d.kind==='core'){if(!isGem(d.tk)||!(d.ri>=0&&d.ri<=2))return null;const m=ecoBoxMult(S,'gem',d.ri,X)*CORE_X;return {ton:Math.round(RPRICE[d.ri]*m*100)/100,stars:Math.round(RSTARS[d.ri]*m)};}   // 1.5x the gem cache's price right now (before any deal)
 return PREMIUM[d.kind]?{ton:PREMIUM[d.kind].ton,stars:PREMIUM[d.kind].stars}:null;
}
// already owned (one-time items): selling it again would charge for nothing
function ecoOwned(S,d,X){
 if(d.kind==='starter')return S.starter;if(d.kind==='founder')return S.founder||!FOUNDER_OPEN;if(d.kind==='moonbeam')return S.moonbeam;
 if(d.kind==='skin')return S.skin==='lunar';if(d.kind==='paint')return !!(S.paints&&S.paints[d.id]);if(d.kind==='pass')return ecoPassState(S,X).prem;
 if(d.kind==='respec')return !!S.rsCr;   // a paid reset is already waiting
 if(d.kind==='rsleg'){const set=rsLegSet(d.tk);return !set||!!(S.lsm&&S.lsm[d.tk])||!!(S.rm&&S.rm[d.tk])||!!(S.rsj&&S.rsj[d.tk])||!(S.rm&&S.rm[set]);}   // bought, researched or being researched (one ownership), or its track's set mod not researched yet: nothing to sell
 if(d.kind==='rspack')return !RS_PACKS[d.tk]||((S.buys&&S.buys[rsPackKey(d.tk,X)])|0)>=1;   // this week's one is bought
 if(d.kind==='rsfin')return !/^j\d{1,6}$/.test(String(d.job||''))||!!(S.rsx&&S.rsx[d.job]);   // that job is already paid for
 if(d.kind==='chippack')return ((S.buys&&S.buys[chipPackKey(X)])|0)>=1;   // this week's one is bought
 if(d.kind==='livery')return !LIVERIES[d.tk]||!!(S.liv&&S.liv[d.tk]);
 if(d.kind==='rcfin')return !/^r\d{1,6}$/.test(String(d.job||''))||!!(S.rcx&&S.rcx[d.job]);
 if(d.kind==='core')return !isGem(d.tk)||!ownsCh(S,d.c)||(chGl(S,d.c)[d.tk]|0)>=5;
 if(d.kind==='cq'){if(!SHOP.cq[d.tk])return true;const f=CQ_FLAG[d.tk];return f?!!(S.cq&&S.cq[f]):false;}   // Session 8: a one-time Conquest store item already bought (repeatables: ecoLimit)
 if(d.kind==='cos')return !SHOP.cos[d.tk]||!!(S.cqc&&S.cqc[d.tk])||!!d.earned;   // a collection piece bought, or already earned in Conquest (d.earned: the Worker reads the Conquest record)
 if(d.kind==='cfin')return !cfxKey(d.job)||!!(S.cfx&&S.cfx[d.job]);   // that construction is already paid for
 if(d.kind==='mncrate')return !SHOP.mn[d.tk];if(d.kind==='orecrate')return !SHOP.ore[d.tk];
 if(d.kind==='gear'){const tk=gearTk(d.tk);return !tk||(tk==='weapon'?hasW(S,d.tk,d.ri):hasC(S,d.tk,d.ri));}   // a chosen item you already own: nothing to sell
 if(d.kind==='box'&&d.tk==='gem'&&d.c&&!ownsCh(S,d.c))return true;   // a gem cache named for a chassis you don't own: refused, never moved to another   // a chosen core for a chassis you don't own, or one already at level 5: nothing to sell
 return false;
}
// open a crate. Returns what came out (the phone words it): gem {gem,n,lv,up}; gear {isW,k,tier,roll,kind: new|up|dup,old,pts}
// c: the chassis a gem cache's shards are for (owned; else the one the pilot flies now)
function ecoOpenBox(S,tk,ri,X,c){const r=ecoOpenBoxRaw(S,tk,ri,X,c);labGain(S,r);return r;}
// n shards of core k for chassis c: level-ups as they fill (shards past level 5 stay as surplus)
function coreShards(S,c,k,n){const gl=S.glc[c],gs=S.gsc[c];gs[k]+=n;let lv=gl[k],up=0;while(lv<5&&gs[k]>=SHARD_NEED[lv]){gs[k]-=SHARD_NEED[lv];lv++;up++;}gl[k]=lv;return {lv,up,sh:gs[k]};}
function ecoOpenBoxRaw(S,tk,ri,X,c){
 const R=X.rnd;
 if(tk==='gem'){
  c=chFor(S,c);
  const k=GORDER[(R()*GORDER.length)|0],n=ri===0?1+((R()*2)|0):ri===1?3+((R()*2)|0):11+((R()*4)|0),o=coreShards(S,c,k,n);
  return {tk,ri,gem:k,n,lv:o.lv,up:o.up,sh:o.sh,c};
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
// a crate or cache for points. Gem caches: GEM_PTS (every rarity, Epic included), for chassis ch, and they don't raise the money price
function ecoCratePts(S,tk,ri,X,ch){
 const gem=tk==='gem',c=gem?GEM_PTS[ri]||0:RPTS[ri]||0;
 if(!c)return {err:'paid'};
 if(gem&&ch!==undefined&&!ownsCh(S,ch))return {err:'chassis'};
 if(S.pts<c)return {err:'pts',need:c-S.pts};
 S.pts-=c;S.ptsSpent+=c;   // a points buy never raises the crate's money price (Checkpoint 39; it used to count toward x2 / x3)
 return ecoOpenBox(S,tk,ri,X,ch);
}
// the chosen weapon or chassis k at rarity ri: it is added with a fresh 105-110% roll, exactly as a crate adds it. Already owned when
// a payment lands (two invoices paid one after the other): re-rolled like a crate re-roll, the better roll kept, else DUP_PTS points
function ecoGearAdd(S,k,ri,X){
 const tk=gearTk(k),isW=tk==='weapon',own=isW?S.wOwn:S.cOwn,R=X.rnd;
 const roll=Math.round((ROLL_MIN+R()*(ROLL_MAX-ROLL_MIN))*100)/100;
 if(!(own[k]||[]).includes(ri)){own[k]=(own[k]||[]).concat(ri);S.roll[k+':'+ri]=roll;return {tk,ri,isW,k,tier:ri,roll,kind:'new',pick:1};}
 const old=rollIn(S,k,ri);
 if(roll>old){S.roll[k+':'+ri]=roll;return {tk,ri,isW,k,tier:ri,roll,old,kind:'up',pick:1};}
 return {tk,ri,isW,k,tier:ri,roll,old,kind:'dup',pick:1,pts:ecoAward(S,DUP_PTS[ri],X)};
}
function ecoGear(S,k,ri,X){const r=ecoGearAdd(S,k,ri,X);labGain(S,r);return r;}
// a chosen weapon or chassis for points (gearPts); refused if you own it
function ecoGearPts(S,k,ri,X){
 const tk=gearTk(k);if(!tk||!(ri>=0&&ri<=2))return {err:'item'};
 if(tk==='weapon'?hasW(S,k,ri):hasC(S,k,ri))return {err:'owned'};
 const p=gearPts(ri);if(S.pts<p)return {err:'pts',need:p-S.pts};
 S.pts-=p;S.ptsSpent+=p;return ecoGear(S,k,ri,X);
}
// the chosen core: CORE_N[ri] shards of core k for chassis c
// a chosen core already at level 5 when the payment lands (two invoices paid one after the other): its shards go to that chassis's
// lowest core still below 5 instead of sitting as surplus (all at 5: surplus, as a cache's)
function ecoCoreAdd(S,k,ri,c){c=chFor(S,c);const gl=S.glc[c];let to=k;if((gl[k]|0)>=5){const low=GORDER.filter(j=>(gl[j]|0)<5).sort((a,b)=>(gl[a]|0)-(gl[b]|0))[0];if(low)to=low;}
 const n=CORE_N[ri]||0,o=coreShards(S,c,to,n);return {tk:'core',ri,gem:to,n,lv:o.lv,up:o.up,sh:o.sh,c,...(to!==k?{was:k}:{})};}
function ecoCorePts(S,k,ri,c,X){
 if(!isGem(k)||!(ri>=0&&ri<=2))return {err:'item'};
 if(!ownsCh(S,c))return {err:'chassis'};
 if((chGl(S,c)[k]|0)>=5)return {err:'max'};
 const p=corePts(ri);if(S.pts<p)return {err:'pts',need:p-S.pts};
 S.pts-=p;S.ptsSpent+=p;return ecoCoreAdd(S,k,ri,c);
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
// one upgrade level for chassis c's own build (the 14-level budget is per chassis)
function ecoUp(S,k,c){
 if(!UPS[k])return {err:'item'};
 if(c!==undefined&&!ownsCh(S,c))return {err:'chassis'};
 c=chFor(S,c);const U=S.upc[c];
 const lvl=U[k];if(lvl>=4)return {err:'max'};
 if(upLevels(U)>=BUILD_MAX)return {err:'budget'};
 const cost=UPS[k].costs[lvl];if(S.pts<cost)return {err:'pts',need:cost-S.pts};
 S.pts-=cost;S.ptsSpent+=cost;U[k]++;return {k,lv:U[k],c};
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
// c: the chassis whose build is reset (a paid reset with nothing to clear on it waits for the next reset, on any chassis)
function ecoRespec(S,paid,c){
 if(c!==undefined&&c!==null&&c!==''&&!ownsCh(S,c))return {err:'chassis'};   // a reset named for a chassis you don't own: refused, never another's
 c=chFor(S,c);const U=S.upc[c],inv=upInvested(U);
 if(!paid&&S.rsCr){paid=S.rsCr;S.rsCr=0;}
 if(!inv){if(paid){S.rsCr=paid;return {tk:'respec',credit:paid,c};}return {err:'empty'};}
 const half=Math.floor(inv*RESPEC_BACK),back=paid?Math.min(inv,half+Math.ceil((paid+0.25)*RESPEC_PTS_USD)):half;
 for(const k of UORDER)U[k]=0;
 S.pts+=back;S.ptsSpent=Math.max(0,S.ptsSpent-back);
 return paid?{tk:'respec',back,lost:inv-back,extra:back-half,usd:paid,c}:{back,lost:inv-back,c};
}
// the Lab store's sale rules hold inside the grant itself (Session 6B review F5): while the store is closed, for a pack already
// bought this UTC week, a Legendary not on sale yet or already owned, or a finish already paid, a verified payment grants nothing
// (the payment stays on record for a refund). The invoice and price checks refuse the same things before anyone pays
const LAB_KINDS=Object.freeze(['rspack','rsleg','rsfin']),labSaleOk=(S,d,X)=>LAB_STORE_OPEN&&!ecoOwned(S,d,X);
// ---- purchases (only after the payment is verified). Returns what each part gave, so a refund can take it back ----
function ecoGrant(S,d,X){
 const outs=[];
 if(d.kind==='box'){const bk=ecoBuyKey(d.tk,d.ri,X);S.buys[bk]=(S.buys[bk]||0)+1;if(d.deal==='d')S.dealD=X.day;else if(d.deal==='w')S.dealW=X.week;
  S.spendGram+=Number(d.price)||RPRICE[d.ri]||0;outs.push({...ecoOpenBox(S,d.tk,d.ri,X,d.c),bk});}   // bk: a refund steps the price back (Session 8)
 else if(d.kind==='core'){const bk=ecoBuyKey('gem',d.ri,X);S.buys[bk]=(S.buys[bk]||0)+1;S.spendGram+=Number(d.price)||RPRICE[d.ri]*CORE_X||0;outs.push({...ecoCoreAdd(S,d.tk,d.ri,d.c),bk});}   // counts toward the day's gem-cache price steps, like a cache
 else if(d.kind==='gear'){const tk=gearTk(d.tk);if(tk){const bk=ecoBuyKey(tk,d.ri,X);S.buys[bk]=(S.buys[bk]||0)+1;S.spendGram+=Number(d.price)||RPRICE[d.ri]*CORE_X||0;outs.push({...ecoGearAdd(S,d.tk,d.ri,X),bk});}}   // counts toward that crate's price steps, like a crate (as a chosen core does for its cache)
 else if(d.kind==='starter'){if(!S.starter){S.starter=true;S.spendGram+=STARTER.ton;outs.push(ecoOpenBox(S,'weapon',1,X),ecoOpenBox(S,'chassis',1,X),ecoOpenBox(S,'gem',1,X,d.c));}}
 else if(d.kind==='founder'){if(!S.founder){S.founder=true;S.spendGram+=FOUNDER.ton;S.paints.founder=1;outs.push({tk:'paint',id:'founder'},ecoOpenBox(S,'weapon',2,X),ecoOpenBox(S,'gem',1,X,d.c),ecoOpenBox(S,'gem',1,X,d.c));}}
 else if(d.kind==='moonbeam'){if(!S.moonbeam){S.moonbeam=true;S.spendGram+=MOONBEAM_PRICE;outs.push({tk:'moonbeam'});}}
 else if(d.kind==='skin'){if(S.skin!=='lunar'){S.skin='lunar';S.spendGram+=SKIN_PRICE;outs.push({tk:'skin'});}}
 else if(d.kind==='paint'){const P=PAINTS[d.id];if(P&&P.stars&&!S.paints[d.id]){S.paints[d.id]=1;S.spendGram+=P.ton||0;outs.push({tk:'paint',id:d.id});}}
 else if(d.kind==='respec'){const t=respecTierOfTon(d.price);S.spendGram+=Number(d.price)||0;outs.push(ecoRespec(S,t,d.c));}
 else if(d.kind==='pass'){const P=ecoPassState(S,X);if(!P.prem){P.prem=true;S.spendGram+=PASS_PRICE.ton;outs.push({tk:'pass',s:P.s});}}
 else if(d.kind==='rspack'){const P=RS_PACKS[d.tk];if(P&&labSaleOk(S,d,X)){const bk=rsPackKey(d.tk,X);S.buys[bk]=(S.buys[bk]||0)+1;S.spendGram+=Number(d.price)||P.ton;outs.push({tk:'rspack',id:d.tk,parts:ecoAddParts(S,P.each)});}}
 else if(d.kind==='rsleg'){if(labSaleOk(S,d,X)&&!ecoLimit(S,d,X)){S.lsm=S.lsm&&typeof S.lsm==='object'?S.lsm:{};S.lsm[d.tk]=1;const wk=rsLegWeekKey(X);S.buys[wk]=(S.buys[wk]|0)+1;S.spendGram+=Number(d.price)||RS_LEG_PRICE.ton;outs.push({tk:'rsleg',id:d.tk});}}   // one a UTC week in all (Session 8)
 else if(d.kind==='rsfin'){if(labSaleOk(S,d,X)){S.rsx=S.rsx&&typeof S.rsx==='object'?S.rsx:{};S.rsx[d.job]=1;S.spendGram+=Number(d.price)||0;outs.push({tk:'rsfin',job:d.job});}}   // Conquest finishes that job once (conquest-research.js account)
 else if(d.kind==='chippack'){if(batSaleOk(S,d,X)){const bk=chipPackKey(X);S.buys[bk]=(S.buys[bk]||0)+1;S.bch=Math.min(1e5,(S.bch|0)+CHIP_PACK.chips);S.spendGram+=Number(d.price)||CHIP_PACK.ton;outs.push({tk:'chippack',chips:CHIP_PACK.chips});}}   // Session 6C: a separate chip total (never the daily limit's)
 else if(d.kind==='livery'){if(batSaleOk(S,d,X)){S.liv=S.liv&&typeof S.liv==='object'?S.liv:{};S.liv[d.tk]=1;S.spendGram+=Number(d.price)||LIVERIES[d.tk].ton;outs.push({tk:'livery',id:d.tk});}}   // looks only
 else if(d.kind==='rcfin'){if(batSaleOk(S,d,X)){S.rcx=S.rcx&&typeof S.rcx==='object'?S.rcx:{};S.rcx[d.job]=1;S.spendGram+=Number(d.price)||0;outs.push({tk:'rcfin',job:d.job});}}   // the Conquest record finishes that RECRUIT job once (conquest-battalion.js account)
 else if(CQ_KINDS.includes(d.kind)){const o=cqSaleOk(S,d,X)?cqGrant(S,d,X):null;if(o)outs.push(o);}   // Session 8: the Conquest store (cqGrant: never points)
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
  if(typeof o.bk==='string'&&S.buys&&S.buys[o.bk]>0)S.buys[o.bk]--;   // Session 8: the crate / gem cache price step this purchase took
  if(o.gem&&isGem(o.gem)){const k=o.gem,c=isCh(o.c)?o.c:homeChassis(S),gl=S.glc[c],gs=S.gsc[c];gs[k]-=o.n||0;while(gs[k]<0&&gl[k]>1){gl[k]--;gs[k]+=SHARD_NEED[gl[k]];}gs[k]=Math.max(0,gs[k]);}
  else if(o.kind==='new'){const own=o.isW?S.wOwn:S.cOwn;own[o.k]=(own[o.k]||[]).filter(t=>t!==o.tier);delete S.roll[o.k+':'+o.tier];if(!S.wOwn.pulse.includes(0))S.wOwn.pulse.unshift(0);if(!S.cOwn.vanguard.includes(0))S.cOwn.vanguard.unshift(0);}
  else if(o.kind==='up'){if(rollIn(S,o.k,o.tier)===o.roll)S.roll[o.k+':'+o.tier]=o.old;}
  else if(o.kind==='dup'){const p=o.pts||0;S.pts=Math.max(0,S.pts-p);S.earned=Math.max(0,S.earned-p);}
  else if(o.tk==='paint'){delete S.paints[o.id];if(o.id==='founder')S.founder=false;}
  else if(o.tk==='moonbeam')S.moonbeam=false;
  else if(o.tk==='rsleg'){if(S.lsm)delete S.lsm[o.id];}
  else if(o.tk==='chippack'){S.bch=Math.max(0,(S.bch|0)-(o.chips|0));}
  else if(o.tk==='livery'){if(S.liv)delete S.liv[o.id];}
  else if(o.tk==='rspack'&&o.parts){S.bpt=S.bpt||{};for(const k of CQ_PART_ORDER)S.bpt[k]=Math.max(0,(S.bpt[k]|0)-(o.parts[k]|0));}   // a finished skip (rsfin) cannot be taken back
  else if(o.tk==='skin')S.skin='default';
  else if(o.tk==='pass'){if(S.pass&&S.pass.s===o.s)S.pass.prem=false;}
  else if(o.tk==='respec'){if(o.credit)S.rsCr=0;else{const p=Math.min(S.pts,o.extra||0);S.pts-=p;S.ptsSpent+=p;}}   // the levels stay cleared; the extra points go back
  else if(o.tk==='cq'||o.tk==='cos'||o.tk==='mncrate'||o.tk==='orecrate'||o.tk==='cfin')cqRefund(S,o);   // Session 8: exactly what that purchase gave
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
function ecoLogin(S,X,c){
 const s=ecoLoginState(S,X);if(s.claimedToday)return null;
 S.login={last:X.day,n:s.next};
 const pts=ecoAward(S,s.reward,X,1),box=s.slot===6?ecoOpenBox(S,'gem',0,X,c):null;   // day 7: a free gem cache too (c: the chassis it is for, else the one you fly)
 const gift=ecoGiftReady(S,X)?(S.g2=X.day,ecoOpenBox(S,'gem',GIFT_RI,X,c)):null;   // once ever: come back the day after your first day
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
function ecoChest(S,X,c){
 ecoQuests(S,X);
 if(S.wq.claimed||(S.wq.n||0)<WQ_GOAL)return null;
 S.wq.claimed=true;const n=ecoAward(S,ecoQPts(S,WQ_PTS,X),X,1);
 return {pts:n,box:ecoOpenBox(S,'gem',1,X,c)};
}
// ---- Lunar Pass ----
const ecoSeason=X=>X.day<PASS_S2?1:2+Math.floor((X.day-PASS_S2)/PASS_LEN);
function ecoPassState(S,X){const s=ecoSeason(X);if(!S.pass||S.pass.s!==s)S.pass={s,xp:0,prem:false,cf:[],cp:[]};S.pass.cf=S.pass.cf||[];S.pass.cp=S.pass.cp||[];return S.pass;}
const ecoPassTier=(S,X)=>{const P=ecoPassState(S,X);return Math.min(passTiers(P.s),Math.floor(P.xp/PASS_XP));};
function ecoPassXP(S,n,X){if(!n)return 0;const P=ecoPassState(S,X),b=ecoPassTier(S,X);P.xp=Math.min(passTiers(P.s)*PASS_XP,P.xp+n);return ecoPassTier(S,X)-b;}
function ecoClaimPass(S,track,i,X,c){
 const P=ecoPassState(S,X);i=+i;
 if(!(i>=1&&i<=ecoPassTier(S,X)))return null;
 const prem=track==='p',list=prem?P.cp:P.cf,r=(prem?PASS_PREM:PASS_FREE)[i];
 if(!r||list.includes(i)||(prem&&!P.prem))return null;
 list.push(i);
 const ex=prem&&passPartsAt(i)?{parts:ecoAddParts(S,passPartsAt(i))}:{};   // Session 6B: research parts on some premium tiers, on top of the tier's reward
 if(r.k==='pts')return {pts:ecoAward(S,r.n,X,1),...ex};   // free track only: the premium track never gives points
 if(r.k==='paint'){S.paints[r.id]=1;labGain(S,{tk:'paint',id:r.id});return {paint:r.id,...ex};}
 return {box:ecoOpenBox(S,r.tk,r.ri,X,c),...ex};
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
 ecoHazard(S,o.map,st.td);
}
// Hazard takedowns (Session 5E-2e): counted per Arcade map, only here, from a match the server settled itself (a live room's
// own sim: worker/src/pvp.js; an AI match: the count the match record shows, worker/src/proof.js). WX_FINISH_N on a map unlock
// that map's finish for good. Looks only: no points, no pass XP, no quest progress
function ecoHazard(S,map,n){
 const M=WX_MAP[map];n=Math.floor(Number(n)||0);if(!M||!(n>0))return;
 if(!S.hz||typeof S.hz!=='object')S.hz={};
 S.hz[map]=Math.min(WX_FINISH_N*400,(S.hz[map]|0)+n);
 if(S.hz[map]>=WX_FINISH_N){if(!S.paints)S.paints={stock:1};S.paints[M.fin]=1;}
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
 {const m=fittingSelection(p.mods);if(FIT_ORDER.some(k=>!rmodOwned(S,k,m[k])))return 'owned';}   // Session 6B: a research mod not yet researched, a Legendary set mod not bought
 for(const [isW,x,k] of [[true,p.w,p.w.a],[false,p.c,p.c.c]]){
  if(!Number.isInteger(x.t)||x.t<0||x.t>2||typeof x.s!=='boolean')return 'gear';
  if(isW&&k==='moon'){if(!S.moonbeam||x.t!==2||x.s)return 'owned';}
  else if(!(isW?WORDER:CHORDER).includes(k)||(x.s?!(x.t>=1&&salvIn(S,k,x.t)>0):!(isW?hasW(S,k,x.t):hasC(S,k,x.t))))return 'owned';
 }
 if(!Array.isArray(p.cores)||p.cores.length!==3||p.cores.some(k=>k!==null&&!isGem(k))||new Set(p.cores.filter(Boolean)).size!==p.cores.filter(Boolean).length)return 'cores';
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
// Session 6B (owner, Nov 16 2026) adds the Science Lab research options below the free ones in each slot. FIT_VERSION stays 2: the
// catalog only grew (every existing option and id is unchanged), and only the server record can make a research option legal.
const FIT_VERSION=2,FIT_BUDGET={weight:3,power:3};
const FIT_FIELDS=['hp','spd','dps','supTaken','dashCd','turn','shotSpd','shieldCd','charge','hitCharge'];
// ---- Science Lab research mods (Session 6B, owner decisions Nov 16 2026) ----
// Research unlocks NEW options in the same three slots: a pilot still fits one option per slot, within the same budget. Four
// tracks, one per research part (rules.js CQ_PARTS): Thermal (Thermal Core), Ballistics (Ballistic Coil), Drive (Drive Servo),
// Field (Field Capacitor); each track has three mods and one set mod (the strongest option in its slot). Slots follow what each
// track is about (the reason, recorded in Checkpoint 41): Thermal and Ballistics are the gun (two mount mods each, their set mods
// on the mount), Drive is movement (two mobility mods and its set mod on mobility), Field is the shield (two hull mods and its set
// mod on the hull); each track's third mod sits in another slot, so every slot holds five or six research choices.
// Fields as above, plus: rs track, lab the Science Lab level that opens it (I Thermal/Ballistics, II Drive/Field, III the set
// mods), set/leg (set mod, Legendary set mod: researched (30 parts, Science Lab III, after its set mod) or bought, one ownership), b behavior (RMOD_B, one per mod; every trigger is
// deterministic: no mod is a chance to deal damage), x its numbers, cue the HUD word, look the existing visual it borrows (no new
// models), role, d what it does in plain words. Behaviors run identically in the Arcade/PvP sim (js/game.js) and in Conquest
// (js/conquest/combat.js + controls.js), on the phone and on the Worker; a mod's damage is counted in seconds of the tank's own
// damage per second, so it is worth the same on every weapon and in both engines. Gear rating: rmodPe (below) values each behavior
// as effective health / damage / speed, the way the plate traits are valued (plateEhp); powerZ reads it.
const FITS={
 hull:{stock:{n:'Stock',weight:0,power:0},
  plates:{n:'Reinforced plates',hp:.05,spd:-.16,shieldCd:-.40,weight:2,power:0},
  light:{n:'Light frame',hp:-.05,spd:.15,dashCd:-.40,weight:0,power:1},
  heatsink:{n:'Heat Sink Plating',rs:'thermal',lab:1,b:'heatsink',role:'Frontliner',cue:'HEAT RING',look:'plates',spd:-.07,weight:1,power:0,x:{every:.2,dmg:.45},
   d:'Every time you lose a fifth of your hull, the plating dumps its heat: a HEAT RING hits every enemy in your range and sight.'},
  momentum:{n:'Momentum Plating',rs:'servo',lab:2,b:'momentum',role:'Runner',cue:'MOMENTUM',look:'light',hp:-.02,weight:1,power:0,x:{after:1,at:.85,cut:.2,hold:.3},
   d:'Drive flat out for a second and MOMENTUM builds: shots hit you 20% softer for as long as you keep moving fast.'},
  capacitor:{n:'Capacitor Bank',rs:'cap',lab:2,b:'capacitor',role:'Anchor',cue:'CHARGING',look:'plates',spd:-.04,weight:0,power:1,x:{after:.5,rate:5},
   d:'Stand still and your shield recharges five times as fast for as long as you hold your ground.'},
  reflector:{n:'Reflector Field',rs:'cap',lab:2,b:'reflector',role:'Bulwark',cue:'REFLECT',look:'plates',spd:-.03,weight:0,power:1,x:{share:1},
   d:'While your shield is up, all the damage it blocks flies straight back at the shooter.'},
  aegis:{n:'Aegis Matrix',rs:'cap',lab:3,set:true,b:'aegis',role:'Guardian',cue:'OVERSHIELD',look:'plates',spd:-.04,weight:1,power:1,x:{share:.11,t:6},
   d:'When your shield ends it leaves an OVERSHIELD worth 11% of your hull that takes the next enemy hits first (it fades after 6 s).'},
  aegisp:{n:'Aegis Prime',rs:'cap',lab:3,set:true,leg:true,b:'aegis',role:'Guardian',cue:'OVERSHIELD',look:'plates',spd:-.04,weight:1,power:1,x:{share:.15,t:8},
   d:'Legendary Aegis: when your shield ends it leaves an OVERSHIELD worth 15% of your hull that takes the next enemy hits first (it fades after 8 s).'}},
 mobility:{stock:{n:'Stock',weight:0,power:0},
  sprint:{n:'Sprint gearing',spd:.11,dps:-.09,turn:.30,weight:0,power:2},
  stable:{n:'Stable gearing',spd:-.15,dps:.07,shotSpd:.10,weight:1,power:1},
  predictor:{n:'Predictor Gyro',rs:'coil',lab:1,b:'predictor',role:'Hunter',cue:'LEAD',look:'stable',spd:-.05,weight:1,power:0,x:{lead:1},
   d:'Your turret leads moving targets: it aims where the enemy will be when the shot lands (your locked target in Conquest).'},
  traction:{n:'Traction Servo',rs:'servo',lab:2,b:'traction',role:'Skirmisher',cue:'TRACTION',look:'sprint',dashCd:.15,weight:0,power:1,x:{spd:.6,t:2},
   d:'Every dash ends in a TRACTION BOOST: 60% more speed for 2 s.'},
  ram:{n:'Ram Servo',rs:'servo',lab:2,b:'ram',role:'Breaker',cue:'RAM',look:'stable',hp:-.03,weight:1,power:0,x:{dmg:1.5,jam:1.5},
   d:'Dash into an enemy to RAM it: it takes one and a half seconds of your damage and its cannon jams for 1.5 s.'},
  reflex:{n:'Reflex Skirts',rs:'cap',lab:2,b:'reflex',role:'Survivor',cue:'REFLEX',look:'sprint',dps:-.02,weight:0,power:1,x:{lead:.5},
   d:'Your shield raises itself (when it is ready) the instant an enemy super or a marked enemy strike is about to hit you.'},
  overdrive:{n:'Overdrive',rs:'servo',lab:3,set:true,b:'overdrive',role:'Phantom',cue:'DASH',look:'sprint',hp:-.01,weight:1,power:1,x:{charges:2},
   d:'TWO DASH CHARGES: dash twice in a row; each charge refills on its own.'},
  hyperdrive:{n:'Hyperdrive',rs:'servo',lab:3,set:true,leg:true,b:'overdrive',role:'Phantom',cue:'DASH',look:'sprint',hp:-.01,spd:.10,weight:1,power:1,x:{charges:3},
   d:'Legendary Overdrive: THREE DASH CHARGES and 10% more top speed: dash three times in a row; each charge refills on its own.'}},
 mount:{stock:{n:'Stock',weight:0,power:0},
  hardened:{n:'Hardened mount',hp:.06,dps:-.14,hitCharge:.20,weight:2,power:0},
  firing:{n:'Firing mount',hp:-.08,dps:.12,charge:.08,weight:1,power:2},
  vent:{n:'Vent Barrel',rs:'thermal',lab:1,b:'vent',role:'Brawler',cue:'VENT',look:'firing',dps:-.07,weight:0,power:1,x:{after:3,bonus:.5,splash:.4},
   d:'Keep firing for 3 s and your next shot is a VENT ROUND: it hits for an extra half second of damage and bursts on the enemies beside its target.'},
  overclock:{n:'Overclock Breech',rs:'thermal',lab:1,b:'overclock',role:'Suppressor',cue:'OVERCLOCK',look:'firing',dps:-.05,weight:0,power:1,x:{after:3.5,rate:1.3,cool:1.5,slow:.7},
   d:'Keep firing for 3.5 s and the breech OVERCLOCKS: 30% faster fire until you let go, then it cools for 1.5 s at a slower rate.'},
  inferno:{n:'Inferno Core',rs:'thermal',lab:3,set:true,b:'inferno',role:'Inferno',cue:'INFERNO',look:'firing',dps:-.04,weight:1,power:1,x:{after:2.5,dur:3,burn:.32,burnT:2,stack:2},
   d:'Keep firing for 2.5 s to ignite INFERNO for 3 s: every hit sets its target BURNING (extra damage over 2 s; a target can burn twice at once).'},
  sunfire:{n:'Sunfire Core',rs:'thermal',lab:3,set:true,leg:true,b:'inferno',role:'Inferno',cue:'SUNFIRE',look:'firing',dps:-.04,weight:1,power:1,x:{after:2,dur:3.5,burn:.25,burnT:2,stack:3},
   d:'Legendary Inferno: keep firing for 2 s to ignite SUNFIRE for 3.5 s: every hit sets its target BURNING (a target can burn three times at once).'},
  pierce:{n:'Penetrator Coil',rs:'coil',lab:1,b:'pierce',role:'Shield-breaker',cue:'PIERCE',look:'hardened',dps:-.02,weight:0,power:1,x:{keep:.8},
   d:'Your shots punch through energy shields: a raised shield stops only a fifth as much of your damage (in Conquest the shield commander\'s barrier too).'},
  marksman:{n:'Marksman Coil',rs:'coil',lab:1,b:'marksman',role:'Duelist',cue:'COIL',look:'hardened',dps:-.05,weight:0,power:1,x:{n:3},
   d:'Land three direct hits in a row on the same target and the third is a sure CRITICAL (double damage). A graze, a miss or a new target restarts the count.'},
  rail:{n:'Rail Driver',rs:'coil',lab:3,set:true,b:'rail',role:'Marksman',cue:'RAIL',look:'hardened',dps:-.04,weight:1,power:1,x:{n:6,mult:1.5,spd:2,through:2},
   d:'Every 6th shot is a RAIL SLUG: half again the damage, twice as fast, straight through shields and through the first tank into the next.'},
  starfall:{n:'Starfall Driver',rs:'coil',lab:3,set:true,leg:true,b:'rail',role:'Marksman',cue:'STARFALL',look:'hardened',dps:-.04,weight:1,power:1,x:{n:5,mult:1.6,spd:2,through:3},
   d:'Legendary Rail: every 5th shot is a STARFALL SLUG: more damage, twice as fast, straight through shields and through two tanks.'}}
};
const FIT_ORDER=['hull','mobility','mount'];
// a research option (earned in the Science Lab) or a Legendary set mod (researched at Science Lab III, or bought in the Lab store); the free options and Stock are neither
const isRmod=(slot,id)=>!!(FITS[slot]&&Object.prototype.hasOwnProperty.call(FITS[slot],id)&&FITS[slot][id].rs);
const rmodOf=id=>{for(const k of FIT_ORDER)if(isRmod(k,id))return {slot:k,id,F:FITS[k][id]};return null;};
// looks: the free options' visuals only (research mods borrow one of them: no new models this session)
const isLook=(slot,id)=>!!(FITS[slot]&&Object.prototype.hasOwnProperty.call(FITS[slot],id)&&!FITS[slot][id].rs);
function fittingValid(v,visual){
 if(v===undefined)return true;
 return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>FIT_ORDER.includes(k))&&FIT_ORDER.every(k=>v[k]===undefined||(visual&&v[k]==='auto')||(visual?isLook(k,v[k]):Object.prototype.hasOwnProperty.call(FITS[k],v[k])));
}
function fittingSelection(v){return Object.fromEntries(FIT_ORDER.map(k=>[k,v&&Object.prototype.hasOwnProperty.call(FITS[k],v[k])?v[k]:'stock']));}
function fittingStats(v){const m=fittingSelection(v),f={weight:0,power:0};for(const s of FIT_FIELDS)f[s]=0;for(const k of FIT_ORDER)for(const s of Object.keys(f))f[s]+=FITS[k][m[k]][s]||0;for(const s of FIT_FIELDS)f[s]=Math.round(f[s]*1000)/1000;return f;}
// who may fit an option: the free ones always; a research mod once the server record holds it (S.rm, credited by the Worker when
// the Science Lab finishes it); a Legendary set mod once bought (S.lsm). Never the client's word (ecoLoadout, labValidate, PvP).
// A Legendary set mod: bought (S.lsm) OR researched (S.rm, the free path): one ownership, two ways in (Session 6B finish, owner Nov 17)
const rmodOwned=(S,slot,id)=>!isRmod(slot,id)||!!(S&&S.rm&&S.rm[id])||(FITS[slot][id].leg&&!!(S&&S.lsm&&S.lsm[id]));
function fittingOwned(S,v){const m=fittingSelection(v);for(const k of FIT_ORDER)if(!rmodOwned(S,k,m[k]))m[k]='stock';return m;}
// the behaviors a fitted set carries: {behavior: params}, read by game.js and the Conquest engine through tankOf (T.rm)
function fittingBehaviors(v){const m=fittingSelection(v),o={};for(const k of FIT_ORDER){const F=FITS[k][m[k]];if(F&&F.b)o[F.b]={...F.x,id:m[k],slot:k};}return o;}
function fittingVisuals(L){const m=fittingSelection(L.mods),look=(k,id)=>isRmod(k,id)?FITS[k][id].look||'stock':id;
 return Object.fromEntries(FIT_ORDER.map(k=>[k,L.looks&&L.looks[k]&&L.looks[k]!=='auto'&&isLook(k,L.looks[k])?L.looks[k]:look(k,m[k])]));}
// ---- Research mods in the gear rating: each behavior valued as effective health (h), damage (d) or speed (s), the way the
// plate traits are valued as effective health (plateEhp). An estimate from a pilot model (MOD_USE, the numbers a human pilot's
// fights show), then checked against measured duels on the real sim (dev/tools/mod-power.mjs, Checkpoint 41). powerZ adds them.
// Retuned toward the measured duels in the Session 6B finish (review, gameplay 7): fast .5 -> .3 (pilots are flat out about a
// third of a fight, not half: Momentum measured under its rating), dash .7 -> .45 (Overdrive measured under its rating) and chain
// .25 (a third dash charge is chained a quarter as often as the second: Hyperdrive measured exactly like Overdrive, byte for byte,
// because no pilot profile needs a second dash inside the cooldown; its real step is now 10% more top speed, measured: see Checkpoint 41)
const MOD_USE={L:4,fight:22,lost:.6,multi:.25,eShield:.12,direct:.62,miss:.14,dashMin:6,ramMin:1.5,still:.2,fast:.3,shUp:.11,shCut:.65,blast:.3,catch:.45,shield:1,dash:.45,chain:.25};
function rmodPe(b,x){const U=MOD_USE,ex=Math.exp,p=t=>ex(-t/U.L);x=x||{};
 switch(b){
  case 'vent':{const q=p(x.after);return {d:q/(U.L*(1-q))*x.bonus*(1+U.multi*x.splash)};}
  case 'overclock':{const q=p(x.after);return {d:(x.rate-1)*q-(q/U.L)*x.cool*(1-x.slow)*.5};}
  case 'inferno':{const q=p(x.after),win=q*(x.dur+x.burnT/2)/(x.after+x.dur);return {d:win*x.stack*x.burn/x.burnT*(1+U.multi*.5)};}
  case 'heatsink':return {d:U.lost/x.every*x.dmg/U.fight*(1+U.multi)};
  case 'pierce':{const s=SHIELD_KEEP,k=s+x.keep*(1-s);return {d:U.eShield*(k-s)/(1-U.eShield*(1-s))};}
  case 'marksman':{const c=U.direct,n=x.n,f=Math.pow(c,n)/[...Array(n).keys()].reduce((a,i)=>a+Math.pow(c,i),0);return {d:f*(1-CRIT_BASE)*(CRIT_MULT-1)};}
  case 'predictor':return {d:U.miss*x.lead*.6};
  case 'rail':return {d:(x.mult-1)/x.n+U.eShield*(1-SHIELD_KEEP)/x.n+U.miss*.5/x.n+U.multi*.5*(x.through-1)/x.n};
  case 'traction':{const F=FITS[x.slot]&&FITS[x.slot][x.id];return {s:U.dashMin/60*x.t*x.spd/(1+((F&&F.dashCd)||0))};}
  case 'ram':return {d:U.ramMin/60*x.dmg,h:U.ramMin/60*x.jam};
  case 'momentum':return {h:1/(1-U.fast*x.cut*(1-U.blast))-1};
  case 'overdrive':{const F=FITS[x.slot]&&FITS[x.slot][x.id],r=1/(1+((F&&F.dashCd)||0)),q=U.chain,k=(1-Math.pow(q,x.charges-1))/(1-q)*r+(r-1);return {h:U.blast*U.catch*U.dash*k,s:U.dashMin/60*.2*k};}   // k: the extra charges (each used U.chain as often as the one before: measured, a third is rarely chained), worth more the faster they come back, plus any faster cooldown itself (no mod has one now: Hyperdrive's edge is its top speed, counted through spd)
  case 'capacitor':{const base=SHIELD_T_S/(SHIELD_CD_S+SHIELD_T_S),cd=SHIELD_CD_S/(1+U.still*(x.rate-1)),up=SHIELD_T_S/(cd+SHIELD_T_S);return {h:(1-U.shCut*base)/(1-U.shCut*up)-1};}
  case 'reflector':return {d:U.shUp*U.shCut*x.share};
  case 'reflex':return {h:1/(1-U.blast*U.catch*U.shCut*.6)-1};
  case 'aegis':return {h:x.share*U.shield*(SHIELD_T_S+x.t)/U.fight*1.6};
 }
 return {};}
const SHIELD_T_S=3,SHIELD_CD_S=25,SHIELD_KEEP=0.35;   // the plasma shield (game.js SHIELD_T / SHIELD_CD / SHIELD_MULT; one source for the valuation)
function fittingPe(v){const o={h:0,d:0,s:0};for(const [b,x] of Object.entries(fittingBehaviors(v))){const e=rmodPe(b,x);for(const k of ['h','d','s'])o[k]+=e[k]||0;}return o;}
// ---- the Science Lab research tree (Session 6B owner decision 1): research parts + time only, never CP, alloy, biomass or
// helium. A job runs on the Worker clock (I 20 min for the Lab I tracks, II 2 h for the Lab II tracks, III 8 h for a set mod),
// one at a time and a second slot at Science Lab III; a ruined Science Lab pauses research. Parts: the n-th mod a pilot researches
// in a track costs RTREE.cost[n] of that track's part, the set mod (needs the track's other three) RTREE.cost[3] (owner, Nov 17:
// 2 / 4 / 5 / 9, 20 a track, 80 in all), and one research part found by play a day per account (CQ_PART_DAY). A track's Legendary
// set mod can also be researched (RTREE.leg: its own job) once Science Lab III stands and the track's set mod is researched; or
// bought (the Lab store, checkout off), never both. The fifth track slot (Role Cores) is shown locked: Session 6C adds Science Lab
// level IV with it.
const RTREE={tracks:{thermal:{n:'Thermal',part:'thermal',lab:1,c:'#ff8a3d',d:'Keep firing: heat becomes damage.'},
  coil:{n:'Ballistics',part:'coil',lab:1,c:'#e8f4ff',d:'Precision: every hit counts.'},
  servo:{n:'Drive',part:'servo',lab:2,c:'#7be07b',d:'Movement is your weapon and your armor.'},
  cap:{n:'Field',part:'cap',lab:2,c:'#5aa9ff',d:'Your shield blocks, stores and strikes back.'}},
 order:['thermal','coil','servo','cap'],role:{id:'role',n:'Role Cores',lab:4,part:'chip',d:'Your pilots\' roles: each level makes that role\'s signature stronger on every pilot fitted with it.'},
 mods:{thermal:['vent','overclock','heatsink','inferno'],coil:['pierce','marksman','predictor','rail'],servo:['traction','ram','momentum','overdrive'],cap:['capacitor','reflector','reflex','aegis']},
 legendary:{thermal:'sunfire',coil:'starfall',servo:'hyperdrive',cap:'aegisp'},
 cost:[2,4,5,9],timeMs:[0,1200000,7200000,28800000],passTime:0.75,slots:{base:1,lab3:1,pass:1},labMax:4,
 leg:{n:30,ms:28800000}};   // leg: a Legendary set mod's own research job (owner, Nov 17: 30 of its track's part, 8 h; Science Lab III and the track's set mod first)   // cost: parts for a track's 1st/2nd/3rd mod and its set mod (owner, Nov 17)
const RTREE_ALL=RTREE.order.flatMap(t=>RTREE.mods[t]);   // the 16 earned mods
const RTREE_LEG=RTREE.order.map(t=>RTREE.legendary[t]),RS_IDS=RTREE_ALL.concat(RTREE_LEG);   // the 4 Legendary set mods (researched or bought); every id a research job can hold
const rsTierOf=id=>{const r=rmodOf(id);return r?(r.F.set?3:RTREE.tracks[r.F.rs].lab):0;};
// the job a mod needs right now for this record (rs: the Conquest record's s.rs; labLv: the Science Lab's level; premium: the
// current-season premium Lunar Pass on the account). Returns {err} or {part, n, ms, tier}
// bought: the account's bought Legendary set mods (eco S.lsm): a bought one is never researched (one ownership, two ways in)
function rsQuote(rs,id,labLv,premium,bought){
 const r=rmodOf(id);if(!r)return {err:'not a research mod'};const F=r.F,T=RTREE.tracks[F.rs],done=rs&&rs.done||{},jobs=(rs&&rs.jobs)||[];
 if(done[id])return {err:'already researched'};if(jobs.some(j=>j&&j.mod===id))return {err:'already researching'};
 if(F.leg){const set=RTREE.mods[F.rs][3];if(bought&&bought[id])return {err:'already yours: bought in the Lab store'};if((labLv|0)<3)return {err:'needs Science Lab III'};
  if(!done[set])return {err:'research '+FITS[r.slot][set].n+' first'};return {part:T.part,n:RTREE.leg.n,ms:Math.round(RTREE.leg.ms*(premium?RTREE.passTime:1)),tier:3,leg:true};}
 const need=F.set?3:T.lab;if((labLv|0)<need)return {err:'needs Science Lab '+['','I','II','III'][need]};
 const own=RTREE.mods[F.rs].filter(m=>m!==id&&!FITS[rmodOf(m).slot][m].set),k=own.filter(m=>done[m]||jobs.some(j=>j&&j.mod===m)).length;
 if(F.set&&!own.every(m=>done[m]))return {err:'research the other three '+T.n+' mods first'};
 const tier=F.set?3:T.lab;return {part:T.part,n:RTREE.cost[F.set?3:k],ms:Math.round(RTREE.timeMs[tier]*(premium?RTREE.passTime:1)),tier};}
const rsSlots=(labLv,premium)=>(labLv>=1?RTREE.slots.base:0)+(labLv>=3?RTREE.slots.lab3:0)+(premium&&labLv>=1?RTREE.slots.pass:0);
// the parts a whole tree costs (the economy model and the lab screen read it)
const rsTreeCost=()=>RTREE.order.reduce((a,t)=>(a[RTREE.tracks[t].part]=RTREE.cost.reduce((x,y)=>x+y,0),a),{});
// ---- Session 6B Science Lab store (owner decision 8): real store entries with CHECKOUT OFF in every currency. While LAB_STORE_OPEN is
// false the Worker's descOf (worker/src/index.js) refuses every Lab kind, so no Stars invoice and no TON or SOL payment can buy one;
// the phone shows each entry with its proposed price and a disabled button. Prices are PROPOSALS priced like the shop: Stars and TON
// at the shop's own dollar rates (the paid build reset: 77 Stars, 1.25 TON a dollar; the Vault's 62.5 Stars a TON), SOL at the live
// TON rate; Telegram shows Stars, the website TON and SOL. Ownership is server-verified: only ecoGrant, after a verified payment,
// writes S.bpt (bonus parts) / S.lsm (Legendary set mods) / S.rsx (finish credits), and the client can never sync them (ECO_KEYS).
// Nothing here gives points (owner: research, mods and purchases give no airdrop points).
const LAB_STORE_OPEN=false;
const RS_STARS_USD=77,RS_TON_USD=1.25;
// instant finish, priced by the time left: concave like the genre's skip prices (Clash of Clans: 1 h ~20 gems, 1 day ~260): the
// longer the skip, the cheaper each hour. $0.22 x hours^0.85 (5-minute steps, $0.10 at least): 20 min 8 Stars, 2 h 31, 8 h 100.
const RS_FIN=Object.freeze({usdH:0.22,exp:0.85,minUsd:0.10,stepMs:300000});
function rsFinPrice(msLeft){const ms=Math.max(0,Number(msLeft)||0);if(!ms)return null;const h=Math.ceil(ms/RS_FIN.stepMs)*RS_FIN.stepMs/3600000,usd=Math.max(RS_FIN.minUsd,RS_FIN.usdH*Math.pow(h,RS_FIN.exp));
 return {usd:Math.round(usd*100)/100,ton:Math.round(usd*RS_TON_USD*100)/100,stars:Math.ceil(usd*RS_STARS_USD)};}
// research part packs: each gives that many of all four parts; one of each pack a UTC week (fair: a payer speeds up, never skips the tree)
const RS_PACKS=Object.freeze({kit:Object.freeze({n:'Field kit',each:1,stars:99,ton:1.6}),crate:Object.freeze({n:'Lab crate',each:3,stars:249,ton:4}),cache:Object.freeze({n:'Research cache',each:8,stars:599,ton:9.6})});
const RS_PACK_ORDER=Object.freeze(['kit','crate','cache']);
const rsPackKey=(tk,X)=>'rsp:'+tk+'|'+X.week;
// a Legendary set mod: on sale only once its track's earned set mod is researched (a step up from it, never a skip of the tree)
// Session 8 (owner, Nov 26, 2026): 1,500 Stars / 23 GRAM each (the Epic crate's price; was 599 / 9.6), at most one a UTC week in all
// (RS_LEG_WEEK: the week's count, rsLegWeekKey), still on sale only after that track's earned set mod is researched
const RS_LEG_PRICE=Object.freeze({stars:1500,ton:23}),RS_LEG_WEEK=1;
const rsLegWeekKey=X=>'rslw|'+X.week;
const rsLegSet=id=>{const r=rmodOf(id);return r&&r.F.leg?RTREE.mods[r.F.rs][3]:null;};
// Lunar Pass premium (season perks while premium is active: +1 research slot, jobs 25% faster: RTREE.slots.pass / passTime) and
// research parts on these premium tiers: tier -> that many of each part, on top of the tier's own reward. Never points. Tiers
// 10/20/30 (12 parts a season) make the tree about 40% faster than free with the daily limit (economy model: 90 vs 149 days), above the genre's
// pass research boosts (Clash of Clans' Gold Pass: about 20%); five tiers (20 parts) halved it, too far ahead of free pilots.
const PASS_PREM_PARTS=Object.freeze({10:1,20:1,30:1});
// The pass's research perks are part of the Lab store's revenue hooks, so they start only when the owner opens that checkout
// (LAB_STORE_OPEN): until then a premium pass changes nothing in the Science Lab and its tiers give no research parts (review F1:
// nothing new may be sold through the pass's live checkout while the Lab store is closed).
const passResearch=(premium,open=LAB_STORE_OPEN)=>!!premium&&!!open;
const passPartsAt=(i,open=LAB_STORE_OPEN)=>open?PASS_PREM_PARTS[i]|0:0;
// ---- Session 6C Battalion store (owner prompt Nov 18): real entries with CHECKOUT OFF in every currency until Session 8 (gated like
// the Lab store: BAT_STORE_OPEN false; the Worker's descOf refuses every kind and ecoGrant enforces the sale rules itself, so no
// invoice, Telegram-confirmed payment, TON or SOL log can grant one). Prices are PROPOSALS at the shop's dollar rates (77 Stars,
// 1.25 TON a dollar; SOL at the live TON rate). Nothing here gives points; never sold: pilots, ranks, Role Core levels.
const BAT_STORE_OPEN=false;
// the chip pack: command chips for the Role Cores (the account's own total, S.bch, outside the one-a-day limit), one a UTC week
const CHIP_PACK=Object.freeze({n:'Command chip pack',chips:5,stars:299,ton:4.8});
const chipPackKey=X=>'chp|'+X.week;
// battalion liveries (blueprint §8 "Battalion colors and insignia: your paint and banner on every ally"), looks only, never power or
// points. Allies wear their stock paint by default; the LDF livery is only for LDF troops. 'colors' puts your own paint and your
// town banner on every ally; each plain set paints every ally one scheme (p: hull, a: trim). Ids never overlap a loot id.
const LIVERIES=Object.freeze({'liv-colors':Object.freeze({n:'Battalion colors',d:'Your paint and your banner on every ally',own:1,stars:399,ton:6.4}),
 'liv-arctic':Object.freeze({n:'Arctic livery',d:'Ice white and glacier blue on every ally',p:'#e6eef2',a:'#7fc8ff',stars:199,ton:3.2}),
 'liv-ember':Object.freeze({n:'Ember livery',d:'Charcoal and ember orange on every ally',p:'#2c2c31',a:'#ff7a3d',stars:199,ton:3.2}),
 'liv-verdant':Object.freeze({n:'Verdant livery',d:'Colony green and brass on every ally',p:'#3f6b4a',a:'#e0b85a',stars:199,ton:3.2}),
 'liv-nightfall':Object.freeze({n:'Nightfall livery',d:'Midnight blue and silver on every ally',p:'#1d2740',a:'#c8d4e8',stars:199,ton:3.2})});
const LIVERY_ORDER=Object.freeze(Object.keys(LIVERIES)),LDF_LIVERY=Object.freeze({p:'#5b646b',a:'#d9c27a'});
const BAT_KINDS=Object.freeze(['chippack','livery','rcfin']),batSaleOk=(S,d,X)=>BAT_STORE_OPEN&&!ecoOwned(S,d,X);
function ecoAddParts(S,n){S.bpt=S.bpt&&typeof S.bpt==='object'?S.bpt:{};const o={};for(const k of CQ_PART_ORDER){S.bpt[k]=Math.min(1e5,(S.bpt[k]|0)+n);o[k]=n;}return o;}
// ---- Session 8 (owner, Nov 26, 2026; brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md): THE ONE PRICE TABLE (SHOP) ----
// Every price and every limit on sale, in every currency, is in SHOP: the new items' numbers live only here, and the shop's older
// constants (crates RPRICE / RSTARS and their price steps, chosen cores and gear CORE_X, PAINTS, VAULT, STARTER, FOUNDER, PREMIUM,
// PASS_PRICE, the paid build reset, the Lab store RS_PACKS / RS_LEG_PRICE / RS_FIN, and the Battalion store kept off) are named in
// SHOP.sold / SHOP.lab / SHOP.off, so this one table lists all of it. The Worker charges these and checks every limit on its own
// record; the phone only shows them. A dollar price converts like the Lab store's (rsFinPrice): Stars = ceil(USD x 77), GRAM = USD x
// 1.25 to 2 decimals (usdPrice; GRAM is the TON coin, renamed June 15, 2026: the code's 'ton' fields hold GRAM), SOL at the live
// GRAM rate (the Worker's quote: no rate, no SOL quote). Guardrails (owner): nothing sold gives airdrop points; never sold: anything
// in the loot tables, points, Gambits, consumables on their own, trophies, boards; research, mods and wall-only rare ore only as the
// brief says. DAILY_CAP and CQ_PTS are untouched by every purchase.
const CRYPTO_OPEN=false;   // GRAM (website and Telegram, the GRAM switch) and SOL (website) checkout on the Worker (/api/order); js/core.js CRYPTO_PAY mirrors it
const CQ_STORE_OPEN=false;   // the Conquest store: ConquestPlot.STORE, the catalog's cosmetics, the mineral and wall-only ore crates, construction speed-ups
function usdPrice(usd){const c=Math.round((Number(usd)||0)*100);if(!(c>0))return null;return {usd:c/100,stars:Math.floor((c*RS_STARS_USD+99)/100),ton:Math.round(c*RS_TON_USD)/100};}   // integer cents: no float drift
const SHOP=Object.freeze({
 rate:Object.freeze({stars:RS_STARS_USD,gram:RS_TON_USD}),
 // the Conquest town store (ConquestPlot.STORE shows these rows): capacity, convenience, cosmetics and time; never points
 cq:Object.freeze({
  'wall-ext-10':Object.freeze({n:'Wall extension pack',d:'+10% wall capacity at your level (capacity only: strength still comes from composite and ore)',usd:2.99,step:10,limit:'up to the +50% extension cap together with the ones you earn'}),
  'skin-gilded':Object.freeze({n:'Gilded wall skin',d:'a gold finish on every wall (looks only: stats unchanged)',usd:4.99,once:1}),
  'skin-turret-neon':Object.freeze({n:'Neon turret skins',d:'a neon finish on all eleven turret types (looks only)',usd:4.99,once:1}),
  'foundry-rush':Object.freeze({n:'Foundry speed-up',d:'your Foundry turns loaded alloy into composite 4x faster for 24 h',usd:1.99,ms:86400000,x:4,limit:'each one adds 24 h'}),
  'builder-2':Object.freeze({n:'Second builder',d:'two constructions at once, for good',usd:9.99,once:1}),
  'theme-aurora':Object.freeze({n:'Aurora town lighting',d:'shifting aurora lights across your town (looks only)',usd:3.99,once:1}),
  'layout-slot':Object.freeze({n:'Extra layout slot',d:'a fourth saved town layout (walls, turrets, vitals)',usd:1.99,once:1})}),
 cqOrder:Object.freeze(['builder-2','wall-ext-10','foundry-rush','layout-slot','skin-gilded','skin-turret-neon','theme-aurora']),
 // the permanent collection (js/conquest/catalog.js reads each piece's price here): looks only, each one also earned by play
 cos:Object.freeze({'base-bastion':7.99,'base-lancer':12.99,'base-cathedral':19.99,'base-orbital':24.99,'base-monolith':29.99,
  'fire-sunlance':3.99,'fire-ionwake':5.99,'fire-prism':7.99,'fire-siege':9.99,'fire-twin':14.99,
  'armor-brass':4.99,'armor-ceramic':7.99,'armor-radiant':9.99,'armor-vector':12.99,'armor-obsidian':19.99,
  'command-standard':2.99,'command-wings':4.99,'command-orrery':7.99,'command-beacon':9.99,'command-parasite':9.99}),
 // minerals (RESOURCE_ECONOMY §9.1): fixed bundles, nothing random, common and uncommon only, into the mineral wallet
 mn:Object.freeze({fe:Object.freeze({n:'Ferrite Crate',give:Object.freeze({fe:150}),usd:1.99,day:2}),il:Object.freeze({n:'Ilmenite Crate',give:Object.freeze({il:60,fe:30}),usd:4.99,day:1,week:4})}),
 // rare-or-better ore for TOWN WALLS ONLY (owner, Nov 23 and Nov 26): one crate of each a UTC day; the ore lands in its own wall-only
 // store (S.wmn): only wall blends spend it (never plates, buildings or Foundry research), never traded or gifted, never points.
 // q (the amount) sized with dev/tools/fortress-model.mjs (docs/conquest/session8/ore-crates.json, SIMULATED)
 ore:Object.freeze({ar:Object.freeze({n:'Armalcolite wall crate',q:20,usd:4.99,day:1}),tq:Object.freeze({n:'Tranquillityite wall crate',q:8,usd:7.99,day:1}),
  se:Object.freeze({n:'Selenite wall crate',q:4,usd:9.99,day:1}),mh:Object.freeze({n:'Moonheart wall crate',q:2,usd:14.99,day:1})}),
 oreOrder:Object.freeze(['ar','tq','se','mh']),
 // construction speed-ups: finish one running construction timer now (a building, a turret or the Command Center; never a repair),
 // priced by the time left on the Lab's instant-finish curve, the earn time shown beside it
 cfin:RS_FIN,
 // the Science Lab store: research part packs (one of each a UTC week), Legendary set mods (one a UTC week in all), instant finish
 lab:Object.freeze({packs:RS_PACKS,packWeek:1,leg:RS_LEG_PRICE,legWeek:RS_LEG_WEEK,fin:RS_FIN}),
 // on sale before Session 8, prices unchanged (the constants above): crates and caches with their price steps and deals, chosen
 // cores and gear (1.5x the crate's price at that moment), paints, the Vault, the packs, Moonbeam and Lunar Skin, the Lunar Pass and
 // the paid build reset
 sold:Object.freeze({box:Object.freeze({stars:RSTARS,ton:RPRICE,steps:'weapon and chassis crates x1 / x2 / x3, gem caches +25% a buy that UTC day; common crates always x1',deals:Object.freeze({d:DEAL_D_OFF,w:DEAL_W_OFF})}),
  core:CORE_X,gear:CORE_X,paint:'PAINTS (stars, ton)',vault:VAULT,starter:STARTER,founder:FOUNDER,moonbeam:PREMIUM.moonbeam,skin:PREMIUM.skin,pass:PASS_PRICE,
  respec:Object.freeze({usdMin:RESPEC_USD_MIN,usdMax:RESPEC_USD_MAX,stars:RESPEC_STARS_USD,ton:RESPEC_TON_USD})}),
 // kept off (not in the Nov 26 sale list): the Battalion store (BAT_STORE_OPEN false)
 off:Object.freeze({chippack:CHIP_PACK,livery:LIVERIES,rcfin:RS_FIN})
});
const CQ_KINDS=Object.freeze(['cq','cos','mncrate','orecrate','cfin']);
const CQ_FLAG=Object.freeze({'builder-2':'b2','layout-slot':'lay','skin-gilded':'gild','skin-turret-neon':'neon','theme-aurora':'aur'});
const cfxKey=v=>/^(?:cc|b\d{1,5})@\d{1,2}$/.test(String(v||''))?String(v):null;   // a construction job: its building and the level it builds
const cqOf=S=>{if(!S.cq||typeof S.cq!=='object'||Array.isArray(S.cq))S.cq={};return S.cq;};
const shopOf=(S,k)=>{if(!S[k]||typeof S[k]!=='object'||Array.isArray(S[k]))S[k]={};return S[k];};
// one Conquest store entry's price (Stars, GRAM, USD) or null
function cqPrice(d){if(d.kind==='cq'){const Q=SHOP.cq[d.tk];return Q?usdPrice(Q.usd):null;}if(d.kind==='cos'){const u=SHOP.cos[d.tk];return u?usdPrice(u):null;}
 if(d.kind==='mncrate'){const M=SHOP.mn[d.tk];return M?usdPrice(M.usd):null;}if(d.kind==='orecrate'){const O=SHOP.ore[d.tk];return O?usdPrice(O.usd):null;}
 if(d.kind==='cfin')return cfxKey(d.job)?rsFinPrice(d.left):null;   // the time left comes from the Conquest record on the Worker, never from the phone
 return null;}
// the counters a limited item steps (S.buys keys; day and week numbers are UTC)
const cqBuyKeys=(d,X)=>d.kind==='mncrate'?['mn'+d.tk+'|'+X.day].concat(SHOP.mn[d.tk]&&SHOP.mn[d.tk].week?['mnw'+d.tk+'|'+X.week]:[]):d.kind==='orecrate'?['ore'+d.tk+'|'+X.day]:d.kind==='rsleg'?[rsLegWeekKey(X)]:[];
// the limit that stops this sale right now, or null: 'limit' (a day or week count), 'cap' (the wall extension cap), 'none' (no
// running construction left to finish), 'town' (needs your town or its Foundry). d.extNow / d.left / d.foundry are the Worker's,
// read from the Conquest record (never the phone's)
function ecoLimit(S,d,X){const b=k=>((S.buys&&S.buys[k])|0);
 if(d.kind==='mncrate'){const M=SHOP.mn[d.tk];if(!M)return 'item';if(b('mn'+d.tk+'|'+X.day)>=M.day)return 'limit';if(M.week&&b('mnw'+d.tk+'|'+X.week)>=M.week)return 'limit';return null;}
 if(d.kind==='orecrate'){const O=SHOP.ore[d.tk];if(!O)return 'item';return b('ore'+d.tk+'|'+X.day)>=O.day?'limit':null;}
 if(d.kind==='rsleg')return b(rsLegWeekKey(X))>=RS_LEG_WEEK?'limit':null;
 if(d.kind==='cq'&&d.tk==='wall-ext-10'){if(!(Number(d.extNow)>=0))return 'town';return Number(d.extNow)+SHOP.cq['wall-ext-10'].step>EXT_MAX_PCT?'cap':null;}
 if(d.kind==='cq'&&d.tk==='foundry-rush')return d.foundry?null:'town';
 if(d.kind==='cfin')return Number(d.left)>0?null:'none';
 return null;}
const EXT_MAX_PCT=50;   // ConquestPlot.EXT.max (the +50% wall extension cap; the Conquest test checks they agree)
// is this item on sale at all (its store open, its rail named in descOf)?
const shopOpen=d=>LAB_KINDS.includes(d.kind)?LAB_STORE_OPEN:BAT_KINDS.includes(d.kind)?BAT_STORE_OPEN:CQ_KINDS.includes(d.kind)?CQ_STORE_OPEN:true;
// every sale rule in one answer (the Worker's quote, the Stars pre-checkout and the grant all ask it): null, or why not
function ecoSaleErr(S,d,X){if(!shopOpen(d))return 'closed';if(d.kind==='founder'&&!FOUNDER_OPEN)return 'closed';if(ecoOwned(S,d,X))return 'owned';return ecoLimit(S,d,X);}
const cqSaleOk=(S,d,X)=>!ecoSaleErr(S,d,X);
// the grant of one Conquest store purchase (after its payment is verified and every sale rule passed): exactly what it gives, on
// the account (S.cq entitlements, S.cqc bought pieces, S.mn the mineral wallet, S.wmn the wall-only ore, S.cfx paid construction
// finishes); the Conquest record reads them (worker/src/conquest-shop.js). Never points, CP or anything in the loot tables
function cqGrant(S,d,X){const P=cqPrice(d),pay=Number(d.price)||(P?P.ton:0);
 const step=()=>{for(const k of cqBuyKeys(d,X))S.buys[k]=(S.buys[k]|0)+1;pruneBuys(S,X);};
 if(d.kind==='cq'){const Q=SHOP.cq[d.tk];if(!Q)return null;const c=cqOf(S);let o={tk:'cq',id:d.tk};
  if(d.tk==='wall-ext-10')c.ext=Math.min(EXT_MAX_PCT/Q.step,(c.ext|0)+1);
  else if(d.tk==='foundry-rush'){const t=Number(X.now)||0;c.fr=Math.max(t,Number(c.fr)||0)+Q.ms;o.until=c.fr;o.ms=Q.ms;}
  else c[CQ_FLAG[d.tk]]=1;
  S.spendGram+=pay;return o;}
 if(d.kind==='cos'){if(!SHOP.cos[d.tk])return null;shopOf(S,'cqc')[d.tk]=1;S.spendGram+=pay;return {tk:'cos',id:d.tk};}
 if(d.kind==='mncrate'){const M=SHOP.mn[d.tk];if(!M)return null;step();const got=ecoMinerals(S,M.give);S.spendGram+=pay;return {tk:'mncrate',id:d.tk,got};}
 if(d.kind==='orecrate'){const O=SHOP.ore[d.tk];if(!O)return null;step();const w=shopOf(S,'wmn');w[d.tk]=Math.min(1e6,(w[d.tk]|0)+O.q);S.spendGram+=pay;return {tk:'orecrate',id:d.tk,q:O.q};}
 if(d.kind==='cfin'){const k=cfxKey(d.job);if(!k)return null;shopOf(S,'cfx')[k]=1;S.spendGram+=pay;return {tk:'cfin',job:k};}
 return null;}
// a refunded Conquest store purchase: take back exactly what it gave (a finished construction stays finished, as an instant finish
// of research does; spent wall-only ore leaves its walls standing and the store at 0)
function cqRefund(S,o){
 if(o.tk==='cq'){const c=cqOf(S),Q=SHOP.cq[o.id];if(!Q)return;if(o.id==='wall-ext-10')c.ext=Math.max(0,(c.ext|0)-1);else if(o.id==='foundry-rush')c.fr=Math.max(0,(Number(c.fr)||0)-(o.ms||Q.ms));else delete c[CQ_FLAG[o.id]];return;}
 if(o.tk==='cos'){if(S.cqc)delete S.cqc[o.id];return;}
 if(o.tk==='mncrate'){S.mn=mnOf(S.mn);for(const [k,n] of Object.entries(o.got||{}))if(MN_ORDER.includes(k))S.mn[k]=Math.max(0,S.mn[k]-(n|0));return;}
 if(o.tk==='orecrate'){const w=shopOf(S,'wmn');if(SHOP.ore[o.id])w[o.id]=Math.max(0,(w[o.id]|0)-(o.q|0));return;}
 if(o.tk==='cfin'){if(S.cfx)delete S.cfx[o.job];}}
// day / week counters older than 5 weeks are dropped when a new one is written (their day or week is past)
function pruneBuys(S,X){for(const k of Object.keys(S.buys||{})){const m=/\|(\d+)$/.exec(k);if(!m)continue;const n=+m[1],wk=/^(rsp:|chp|mnw|rslw)/.test(k);if(wk?n<X.week-5:n<X.day-35)delete S.buys[k];}}
// ---- Research mod behaviors: ONE engine for the Arcade/PvP sim (js/game.js) and Conquest (js/conquest/combat.js + controls.js),
// on the phone and on the Worker. T: the tank (tankOf: T.rm = {behavior: numbers}); mf: its runtime state (plain numbers; Conquest
// saves it with the battle). Every trigger is a count or a timer, never a chance. The engines feed it what happened (a shot left,
// a hit landed, a hit was taken, a dash, the shield ended, how fast the tank moves) and apply what it returns to their own world.
// Damage it adds is in seconds of the tank's own clean damage per second (the engine's modDps), so it is worth the same on every
// weapon in both engines. mf.q: cue words the engine turns into its HUD pop, effect and sound (then empties it).
const MF_GAP=0.25;   // a pause longer than one and a half shot intervals plus this ends a firing streak
function mfNew(T){const R0=T&&T.rm||{},o={st:0,gap:9,iv:0.5,ovc:0,cool:0,inf:0,sc:0,hc:0,ht:-1,lost:0,still:0,fast:0,slow:0,mom:0,tr:0,osh:0,oshT:0,q:[]};if(R0.overdrive){o.dq=R0.overdrive.charges;o.dr=0;}return o;}
function mfCue(mf,k){const q=mf.q||(mf.q=[]);q.push(k);if(q.length>8)q.shift();}   // at most 8 waiting (the Worker never reads them; the phone drains them each frame)
const mfBroken=mf=>mf.gap>mf.iv*1.5+MF_GAP;
// every simulation step. o.spd: the tank's speed as a share of its top speed (dash excluded)
function mfStep(T,mf,dt,o){const R0=T.rm;if(!R0||!mf)return;mf.gap+=dt;
 if(mfBroken(mf)){if(mf.ovc){mf.ovc=0;mf.cool=R0.overclock?R0.overclock.cool:0;mfCue(mf,'cool');}mf.st=0;}
 if(mf.cool>0)mf.cool=Math.max(0,mf.cool-dt);
 if(mf.inf>0){mf.inf=Math.max(0,mf.inf-dt);if(!(mf.inf>0))mfCue(mf,'infernoEnd');}
 if(mf.tr>0)mf.tr=Math.max(0,mf.tr-dt);
 if(mf.oshT>0){mf.oshT=Math.max(0,mf.oshT-dt);if(!(mf.oshT>0))mf.osh=0;}
 const sp=Math.max(0,Number(o&&o.spd)||0);
 if(R0.momentum){const M=R0.momentum;if(sp>=M.at){mf.fast+=dt;mf.slow=0;if(!mf.mom&&mf.fast>=M.after){mf.mom=1;mfCue(mf,'momentum');}}else{mf.slow+=dt;mf.fast=0;if(mf.mom&&mf.slow>=M.hold){mf.mom=0;mfCue(mf,'momentumOff');}}}
 if(R0.capacitor){const was=mf.still>=R0.capacitor.after;if(sp<0.1)mf.still+=dt;else mf.still=0;if(!was&&mf.still>=R0.capacitor.after)mfCue(mf,'charging');}}
// a shot leaves (iv: this shot's interval in seconds, after fire-rate effects). Returns what the shot carries, or null:
// vent: extra seconds of damage + splash share; burn: the Inferno numbers (hits set targets burning); rail: the slug's numbers
function mfShot(T,mf,iv){const R0=T.rm;if(!R0||!mf)return null;
 if(mfBroken(mf))mf.st=0;else mf.st+=mf.gap;mf.gap=0;mf.iv=Math.max(0.05,iv||0.5);let out=null;
 if(R0.vent&&mf.st>=R0.vent.after){mf.st=0;out={vent:R0.vent.bonus,splash:R0.vent.splash};mfCue(mf,'vent');}
 if(R0.overclock&&!mf.ovc&&mf.st>=R0.overclock.after){mf.ovc=1;mfCue(mf,'overclock');}
 if(R0.inferno){if(mf.inf>0)mf.st=0;else if(mf.st>=R0.inferno.after){mf.inf=R0.inferno.dur;mf.st=0;mfCue(mf,'inferno');}if(mf.inf>0)(out||(out={})).burn=R0.inferno;}
 if(R0.rail){mf.sc++;if(mf.sc>=R0.rail.n){mf.sc=0;(out||(out={})).rail=R0.rail;mfCue(mf,'rail');}}
 return out;}
// the fire-rate multiplier now (Overclock Breech: faster while overclocked, slower while it cools)
function mfRate(T,mf){const O=T.rm&&T.rm.overclock;if(!O||!mf)return 1;return mf.ovc?O.rate:mf.cool>0?O.slow:1;}
// a shot of this tank landed on target tid (direct or a graze). Returns true when Marksman Coil makes it a sure critical
function mfHit(T,mf,tid,direct){const M=T.rm&&T.rm.marksman;if(!M||!mf)return false;if(!direct){mf.hc=0;mf.ht=-1;return false;}
 if(tid===mf.ht)mf.hc++;else{mf.ht=tid;mf.hc=1;}if(mf.hc>=M.n){mf.hc=0;mfCue(mf,'crit');return true;}return false;}
function mfMiss(T,mf){if(T.rm&&T.rm.marksman&&mf){mf.hc=0;mf.ht=-1;}}   // a shot that hit nothing restarts the count
// a hit on this tank after its shield and plates (amt). kind 0 a shot, 1 a super, 2 an enemy's marked strike (Conquest), 3 world
// damage (the Arcade storm ring and map hazards: Session 5E-2e + 6B ruling, Checkpoint 41 "Mods and hazards"); blocked: what its
// shield stopped. Returns the damage left after Momentum and the overshield, heat rings owed (Heat Sink), damage to reflect
// (Reflector Field). World damage passes every shield (the overshield too), is never reflected and is cut only by armor and
// plates (before this); it still counts as hull lost for Heat Sink (its words: "every time you lose a fifth of your hull")
function mfTaken(T,mf,amt,kind,blocked,mhp){const R0=T.rm;if(!R0||!mf)return {amt,ring:0,refl:0};
 if(R0.momentum&&mf.mom&&kind===0)amt*=1-R0.momentum.cut;
 if(mf.osh>0&&amt>0&&kind!==3){const a=Math.min(mf.osh,amt);mf.osh-=a;amt-=a;if(!(mf.osh>1e-6)){mf.osh=0;mf.oshT=0;mfCue(mf,'oshBreak');}}
 let ring=0;if(R0.heatsink&&amt>0){mf.lost+=amt;const need=R0.heatsink.every*Math.max(1,mhp);while(mf.lost>=need){mf.lost-=need;ring++;}if(ring)mfCue(mf,'ring');}
 const refl=R0.reflector&&blocked>0&&kind<=1?blocked*R0.reflector.share:0;if(refl>0)mfCue(mf,'reflect');
 return {amt,ring,refl};}
function mfShieldEnd(T,mf,mhp){const A=T.rm&&T.rm.aegis;if(!A||!mf)return;mf.osh=A.share*Math.max(1,mhp);mf.oshT=A.t;mfCue(mf,'aegis');}
function mfShieldRate(T,mf){const C=T.rm&&T.rm.capacitor;return C&&mf&&mf.still>=C.after?C.rate:1;}   // Capacitor Bank: standing still
function mfSpeed(T,mf){const Tr=T.rm&&T.rm.traction;return Tr&&mf&&mf.tr>0?1+Tr.spd:1;}           // Traction Servo after a dash
const mfPierce=T=>{const P=T&&T.rm&&T.rm.pierce;return P?P.keep:0;};                               // share of a shield's protection ignored
const mfRam=T=>T&&T.rm&&T.rm.ram||null;
// dashes: can it dash now (Overdrive: a charge left; else the normal cooldown), a dash started, the charges refilling. mfDashTick
// returns the cooldown the engine shows (0 while a charge is left) or null without Overdrive
function mfDashReady(T,mf,cdLeft){return T.rm&&T.rm.overdrive&&mf?mf.dq>0:!(cdLeft>0);}
function mfDash(T,mf,cd){const R0=T.rm;if(!R0||!mf)return;if(R0.traction){mf.tr=R0.traction.t;mfCue(mf,'traction');}if(R0.overdrive){if(mf.dq>0)mf.dq--;if(!(mf.dr>0))mf.dr=cd;if(mf.dq>0)mfCue(mf,'dash2');}}
function mfDashTick(T,mf,dt,cd){const O=T.rm&&T.rm.overdrive;if(!O||!mf)return null;if(mf.dq<O.charges){if(!(mf.dr>0))mf.dr=cd;mf.dr-=dt;if(mf.dr<=0){mf.dq++;mf.dr=mf.dq<O.charges?cd:0;}}else mf.dr=0;return mf.dq>0?0:Math.max(0,mf.dr);}
// burns on a target (Inferno Core): at most stack from one source at once; a new one replaces the oldest. b: [{s, d dps, t left,
// a built up since the last half-second tick}]. A replaced burn's built-up damage is carried into the new one (Session 6B review:
// dropping it lost 15-49% of Inferno's damage at a fast fire rate); only the rest of its time ends, as the stack cap says
function mfBurn(list,src,I,dps){const L=Array.isArray(list)?list:[],mine=L.filter(b=>b.s===src);let a=0;if(mine.length>=I.stack){const old=mine.reduce((x,b)=>b.t<x.t?b:x);a=old.a||0;L.splice(L.indexOf(old),1);}
 L.push({s:src,d:I.burn*dps/I.burnT,t:I.burnT,a});return L;}
// the cue a pilot sees and hears when a mod triggers (both engines): t the pop text (null: the HUD chip shows it), s the sound
// (js/fx.js SND), gap the shortest time between two pops of it (s)
const MOD_CUE={vent:{tr:'thermal',t:'VENT ROUND',s:'mVent'},overclock:{tr:'thermal',t:'OVERCLOCK',s:'mOver'},cool:{tr:'thermal',t:'COOLING',s:'mCool',gap:1},inferno:{tr:'thermal',t:'INFERNO',s:'mInferno'},infernoEnd:{tr:'thermal',t:null,s:null},
 ring:{tr:'thermal',t:'HEAT RING',s:'mRing'},pierce:{tr:'coil',t:'PIERCE',s:'mPierce',gap:0.7},crit:{tr:'coil',t:'SURE CRIT',s:'mCrit',gap:0.3},rail:{tr:'coil',t:'RAIL SLUG',s:'mRail',gap:0.3},traction:{tr:'servo',t:'TRACTION',s:'mTraction'},
 ram:{tr:'servo',t:'RAM!',s:'mRam'},momentum:{tr:'servo',t:'MOMENTUM',s:'mMomentum',gap:2},momentumOff:{tr:'servo',t:null,s:null},dash2:{tr:'servo',t:'DASH CHARGE',s:'mDash2'},charging:{tr:'cap',t:'CHARGING',s:'mCharge',gap:2},
 reflect:{tr:'cap',t:'REFLECT',s:'mReflect',gap:0.7},reflex:{tr:'cap',t:'REFLEX SHIELD',s:'mReflex'},aegis:{tr:'cap',t:'OVERSHIELD',s:'mAegis'},oshBreak:{tr:'cap',t:'OVERSHIELD DOWN',s:'mBreak',gap:1}};
// what the HUD shows for a tank's research mods: one chip per behavior with its live state (the same in both engines)
function mfHud(T,mf){const R0=T&&T.rm;if(!R0||!mf)return [];const o=[];
 for(const [b,x] of Object.entries(R0)){const F=FITS[x.slot][x.id],c={b,id:x.id,slot:x.slot,tr:F.rs,leg:!!F.leg,w:F.cue,on:0,v:0};
  if(b==='vent'||b==='overclock'||b==='inferno'){c.v=Math.min(1,mf.st/x.after);c.on=b==='overclock'?mf.ovc?1:mf.cool>0?-1:0:b==='inferno'?mf.inf>0?1:0:0;if(b==='inferno'&&mf.inf>0)c.v=mf.inf/x.dur;}
  else if(b==='rail'){c.v=mf.sc/x.n;}else if(b==='marksman'){c.v=mf.hc/x.n;}else if(b==='heatsink'){c.v=Math.min(1,mf.lost/(x.every*Math.max(1,T.mhp||1)));}
  else if(b==='momentum'){c.on=mf.mom;c.v=mf.mom?1:Math.min(1,mf.fast/x.after);}else if(b==='capacitor'){c.on=mf.still>=x.after?1:0;}
  else if(b==='traction'){c.on=mf.tr>0?1:0;c.v=mf.tr/x.t;}else if(b==='overdrive'){c.v=mf.dq;c.n=x.charges;}else if(b==='aegis'){c.on=mf.osh>0?1:0;c.v=mf.osh;}
  o.push(c);}
 return o;}
function hasFittings(L){return FIT_ORDER.some(k=>fittingVisuals(L)[k]!=='stock');}
// Unrounded permanent travel speed, shared by Garage metrics and Conquest physics.
function machineSpeed(L,t=tankOf(L,1)){return STAT.speed*t.spdM*(1+(t.gems.includes('spd')?GEM.spd.amt*t.gemM.spd:0));}
function machineMetrics(L){const t=tankOf(L,1),g=k=>t.gems.includes(k)?GEM[k].amt*t.gemM[k]:0;return {hp:t.mhp,dps:Math.round(t.wdps*t.dmgM*(1+g('dmg'))*(1+g('rof'))*projectileImpactMult(t)),spd:+machineSpeed(L,t).toFixed(1)};}

// ---- garage presentation (UI only): reads the tables above, adds no stat math of its own ----
// Progressive garage: matches played (server-tracked mp) before a section opens. UI gating only: the server accepts every
// legal loadout, and anything already bought or set (upgrade levels, a paid reset, fitted mods) keeps its section open.
const GARAGE_UP_AT=2,GARAGE_FIT_AT=5;
function garageOpen(S,sec){
 if(sec==='up')return (S.mp|0)>=GARAGE_UP_AT||upLevelsAll(S)>0||(S.rsCr|0)>0;
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
