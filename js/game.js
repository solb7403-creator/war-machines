'use strict';
// =====================================================================
// game: maps, units, physics, combat, supers, AI, game modes, match flow
// (pure simulation: rendering lives in render.js, menus in ui.js)
// =====================================================================
const W=20,H=32,R=0.7,MATCH=180;
const TC=['#4d9fff','#ff4d5e'];   // team colors in battle: blue (your team) vs red (foes)
const tcol=t=>t===0?TC[0]:TC[1];   // Last Standing has 6 teams: every tank that isn't on your team is red
// ---- two-level bridge (Overpass): elev 0 = ground, 1 = on the deck/ramps ----
// Ground level: the deck is a solid block except the two tunnels; ramps have side rails, so you drive up only from the ramp's open end.
// Deck level: you can only drive on the deck and ramps. High ground shoots over everything; units in a tunnel are hidden from the deck.
let BR=null,baseWalls=[],navWalls=[];
const inRect=(x,y,r)=>x>r[0]&&x<r[0]+r[2]&&y>r[1]&&y<r[1]+r[3];
const inDeck=(x,y)=>!!BR&&inRect(x,y,BR.deck);
const inTunnel=(x,y)=>!!BR&&BR.tunnels.some(([tx,tw])=>x>tx&&x<tx+tw)&&inDeck(x,y);
const rampAt=(x,y)=>BR?BR.ramps.find(r=>inRect(x,y,r)):null;
const underDeck=u=>(u.elev||0)===0&&inDeck(u.x,u.y);
function upOk(x,y){   // a tank centre may sit here while on the upper level
 if(!BR)return false;const [dx,dy,dw,dh]=BR.deck;
 if(x>=dx+R&&x<=dx+dw-R&&y>=dy+R&&y<=dy+dh-R)return true;
 for(const [rx,ry,rw,rh] of BR.ramps)if(x>=rx+R*0.75&&x<=rx+rw-R*0.75&&y>=ry-R&&y<=ry+rh+R)return true;
 return false;
}
function rampExit(x,y){for(const [rx,ry,rw,rh,o] of BR.ramps)if(x>=rx&&x<=rx+rw&&(o<0?y<ry&&y>ry-R*2:y>ry+rh&&y<ry+rh+R*2))return true;return false;}
const lvOK=(a,e)=>(a.elev||0)===(e.elev||0)||!(underDeck(a)||underDeck(e));   // cross-level hits are blocked under the deck
// Map definitions. Every layout is point-symmetric, so both sides get the same map.
// walls: solid boxes [x,y,w,h,style]; rocks: round solids [x,y,r,style]; crates: breakable boxes; craters: [x,y,r] slow you down.
// (data only, so a 3D renderer or a PvP server can use the same maps)
const MAPS={
 classic:{
  n:'Moonbase',d:'Containers, habitat domes, a slow crater on each flank',
  walls:[[8,14.5,4,3,'cmd'],[3,9,3,2,'ctr'],[14,21,3,2,'ctr'],[12,8,2,3,'ctr'],[6,21,2,3,'ctr']],
  rocks:[[16,13,1.2,'dome'],[4,19,1.2,'dome'],[5,13.5,0.8,'rock'],[15,18.5,0.8,'rock']],
  crates:[[9,10.6,1.2,1.2],[9.8,20.2,1.2,1.2]],
  craters:[[3.5,16,1.5],[16.5,16,1.5]]
 },
 overpass:{
  n:'Overpass',d:'Bridge with ramps and tunnels',
  walls:[[2,6,2,2,'ctr'],[16,6,2,2,'ctr'],[2,24,2,2,'ctr'],[16,24,2,2,'ctr']],
  rocks:[[10,8.2,0.9,'rock'],[10,23.8,0.9,'rock']],
  // deck [x,y,w,h]; tunnels [x,width] run under it; ramps [x,y,w,h,openEnd(-1 top/+1 bottom)]
  bridge:{deck:[2,13.5,16,5],tunnels:[[5.8,2.4],[11.8,2.4]],
   ramps:[[3,10.5,2.5,3,-1],[14.5,10.5,2.5,3,-1],[3,18.5,2.5,3,1],[14.5,18.5,2.5,3,1]]}
 },
 longshot:{
  n:'Longshot',d:'Narrow alley, long sight lines',
  // constricted sides + central energy pylon with gaps
  walls:[[0,0,4,32,'cliff'],[16,0,4,32,'cliff'],[7,10,6,2,'ctr'],[7,20,6,2,'ctr'],[9,14.5,2,3,'pylon']],
  crates:[[4,15.4,1.2,1.2],[14.8,15.4,1.2,1.2]],
  narrow:true
 },
 craters:{
  n:'Crater Field',short:'Craters',d:'Open ground, boulders, craters that slow you down',
  walls:[[8.5,11.2,3,1.2,'lander'],[8.5,19.6,3,1.2,'lander']],
  rocks:[[6,11,1.1,'rock'],[14,21,1.1,'rock'],[14.5,10,0.9,'rock'],[5.5,22,0.9,'rock'],[3,16,0.8,'rock'],[17,16,0.8,'rock']],
  crates:[[9.4,7.6,1.2,1.2],[9.4,23.2,1.2,1.2],[12.8,15.4,1.2,1.2],[6,15.4,1.2,1.2]],
  craters:[[10,16,2.6],[15.5,14.5,1.3],[4.5,17.5,1.3]]
 },
 random:{
  n:'Random',d:'A different map every match',
  walls:[],isRandom:true
 }
};
let curMap='classic';
let walls=MAPS.classic.walls,rocks=[],craters=[],crates=[];
const MAP_REAL=['classic','overpass','longshot','craters'];
const CRATE_HP=320,CRATER_SLOW=0.6;
const mapKey=()=>(save.map&&MAPS[save.map])?save.map:'classic';   // the player's pick (may be 'random'); the real map is chosen at match start
function setMap(id){
 if(!MAPS[id]||MAPS[id].isRandom)id=MAP_REAL[(Math.random()*MAP_REAL.length)|0];
 const M=MAPS[id];curMap=id;BR=M.bridge||null;
 rocks=(M.rocks||[]).map(r=>r.slice());craters=(M.craters||[]).map(c=>c.slice());
 crates=(M.crates||[]).map(([x,y,w,h])=>{const c=[x,y,w,h,'crate'];c.hp=c.mhp=CRATE_HP;c.flash=0;return c;});   // fresh crates every match
 baseWalls=M.walls.concat(crates);walls=baseWalls.slice();
 if(BR){const [dx,dy,dw,dh]=BR.deck;let x0=dx;
  for(const [tx,tw] of BR.tunnels){walls.push([x0,dy,tx-x0,dh]);x0=tx+tw;}   // solid deck blocks between tunnels
  walls.push([x0,dy,dx+dw-x0,dh]);
  for(const [rx,ry,rw,rh] of BR.ramps){walls.push([rx-0.2,ry,0.2,rh]);walls.push([rx+rw,ry,0.2,rh]);}   // ramp side rails
 }
 navWalls=BR?walls.concat(BR.ramps.map(r=>r.slice(0,4))):walls;
 if(typeof buildNav==='function')buildNav();
}

let me=null,bullets=[],timeLeft=MATCH,state='menu',endAt=0,boxes=[],sidx=0,sched=[],pops=[],nums=[],beams=[],banner=null,mstat=null,planBudget=2;
// ---- team battle modes ----
const MODES={
 '1v1':{n:1,label:'1v1',win:125,draw:60,loss:30},
 '2v2':{n:2,label:'2v2',win:200,draw:100,loss:50},
 '3v3':{n:3,label:'3v3',win:300,draw:150,loss:75}};
const ZONE_X={'1v1':3,'2v2':2,'3v3':1.5};   // Moon Zone runs ~4x longer, so it pays more per match
const modeKey=()=>(save.mode&&MODES[save.mode])?save.mode:'1v1';
// Game types. The rules are data, so a PvP server or a 3D client can run the same matches.
// t: time limit (s). respawn: tanks come back after dying. x: pay multiplier per team size (longer matches pay more per match,
// so points per minute stay level across modes). solo: free for all with that many tanks, no teams.
// Every mode is playable against AI pilots now and built so live PvP can drop real players into the same slots.
const GTYPES={
 arena:{label:'Arena',d:'Destroy the enemy team',t:180},
 zone:{label:'Moon Zone',d:'Hold the moving zone. First to 100.',t:180,respawn:true,x:ZONE_X},
 crystal:{label:'Crystal Rush',d:'Grab crystals from the mine. Hold 10 for 15 seconds to win.',t:180,respawn:true,x:{'1v1':3,'2v2':2,'3v3':1.5}},
 bounty:{label:'Bounty',d:'Kills earn stars. Every kill raises your bounty.',t:120,respawn:true,x:{'1v1':3.5,'2v2':2.25,'3v3':1.5}},
 royale:{label:'Last Standing',d:'6 tanks, 1 survivor. Stay inside the ring.',t:150,solo:6}};
const GT_ORDER=['arena','zone','crystal','bounty','royale'];
const GT_PICK={...GTYPES,random:{label:'Random',d:'A different mode every match'}};   // what the selector shows; Random resolves at match start
const gtypeKey=()=>(save.gtype&&GT_PICK[save.gtype])?save.gtype:'arena';
let matchG='arena';
const ROYALE_PTS=[260,200,140,100,60,30],ROYALE_HP=2,BTY_HP=0.5,BTY_RESPAWN=3;   // Last Standing pays by place, 1st to 6th. Bounty: lighter tanks and quick respawns, so kills keep coming
const isSolo=gk=>!!(GTYPES[gk]&&GTYPES[gk].solo);
const respawns=()=>!!(GTYPES[matchG]&&GTYPES[matchG].respawn);
const hpScale=()=>isSolo(matchG)?ROYALE_HP:MODES[modeKey()].n*(matchG==='bounty'?BTY_HP:1);   // team matches scale health with team size so fights last
function winBase(gk,mk){   // points for a win before the league multiplier, featured bonus and streak
 if(isSolo(gk))return ROYALE_PTS[0];
 const M=MODES[mk];return Math.round(M.win*(gk==='arena'?(mk==='1v1'?SERIES_X:1):GTYPES[gk].x[mk]));
}
function winPoints(gk,mk){return Math.round(winBase(gk,mk)*(gk===featuredMode()?FEATURED_X:1)*powerBracket(calcPower()).mult);}
// ---- 1v1 Arena is a best of 3: first to 2 round wins pays ×2. A drawn round doesn't count (5 rounds at most) ----
const SERIES_X=2,ROUND_T=90;
let series=null;
const isSeriesMode=()=>matchG==='arena'&&modeKey()==='1v1'&&(save.mp||0)>0;   // the coached first match is a single round
// ---- one random event per team match or Moon Zone match ----
const EVENTS={drop:{txt:'Supply drop: boxes landing mid-map',c:'#ffd24a'},meteor:{txt:'Meteor shower! Stay out of the red circles',c:'#ff6b5e'},flare:{txt:'Solar flare: supers charge twice as fast',c:'#ffb347'}};
const EVT_KEYS=Object.keys(EVENTS),METEOR_DMG=260;
let evt=null,evtAt=0,evtKind='drop',warns=[],ffwd=false,elapsed=0,feed=[];
function feedPush(txt,c){feed.push({txt,c,t:3.2});if(feed.length>3)feed.shift();}
const flareMult=()=>evt&&evt.k==='flare'?2:1;
const boxSchedule=()=>{const a=[];let tt=0;for(let i=0;i<BOX_COUNT;i++){tt+=i===0?5+Math.random()*3:15+Math.random()*15;a.push(tt);}return a;};   // first box lands early
// One zone that jumps to a random spot every 20-28s (6s warning shows where it goes next).
// Score while you hold it uncontested, +5 per kill, respawn gets longer each death, tanks repair when out of combat.
const ZONE_R=2.8,ZONE_WIN=100,CAP_RATE=0.55,RESPAWN_T=4,ZONE_RATE=2.4,KILL_PTS=5,ZONE_WARN=6,REPAIR_DELAY=3.5,REPAIR_RATE=0.07;
let gzones=null,gscore=[0,0];
const respawnFor=u=>matchG==='bounty'?BTY_RESPAWN:Math.min(9,RESPAWN_T+1.5*Math.max(0,(u.deaths||1)-1));
function zoneSpot(avoid){
 for(let k=0;k<80;k++){
  const x=3+Math.random()*14,y=8.5+Math.random()*15;
  if(avoid&&Math.hypot(x-avoid.x,y-avoid.y)<7)continue;
  if(baseWalls.some(([rx,ry,rw,rh])=>x>rx-1.2&&x<rx+rw+1.2&&y>ry-1.2&&y<ry+rh+1.2))continue;
  if(rampAt(x,y))continue;
  if(rocks.some(([rx,ry,rr2])=>Math.hypot(x-rx,y-ry)<rr2+1.3)||craters.some(([cx,cy,cr])=>Math.hypot(x-cx,y-cy)<cr+0.8))continue;
  if(!inDeck(x,y)&&walls.some(([rx,ry,rw,rh])=>x>rx-1&&x<rx+rw+1&&y>ry-1&&y<ry+rh+1))continue;   // deck tops are fine (reach them by ramp)
  return {x,y};
 }
 return {x:10,y:16};
}
function zoneTick(dt){
 const z=gzones[0];
 z.t-=dt;
 if(!z.next&&z.t<=ZONE_WARN){z.next=zoneSpot(z);pop(z.next.x,z.next.y,'ZONE MOVING HERE','#ffd24a');}
 if(z.t<=0){z.x=z.next.x;z.y=z.next.y;z.next=null;z.cap=0;z.own=-1;z.t=20+Math.random()*8;z.moves++;pop(z.x,z.y-1.2,'ZONE MOVED!','#ffd24a');}
 let p0=0,p1=0;
 for(const u of units)if(u.hp>0&&Math.hypot(u.x-z.x,u.y-z.y)<z.r){if(u.team===0)p0++;else p1++;}
 z.p0=p0;z.p1=p1;
 if(p0&&!p1)z.cap=Math.max(-1,z.cap-CAP_RATE*Math.min(2,p0)*dt);
 else if(p1&&!p0)z.cap=Math.min(1,z.cap+CAP_RATE*Math.min(2,p1)*dt);
 if(z.own===0&&z.cap>=0){z.own=-1;pop(z.x,z.y-1.2,'ZONE LOST','#ff9d9d');}
 if(z.own===1&&z.cap<=0){z.own=-1;pop(z.x,z.y-1.2,'ZONE NEUTRAL','#c9d6e3');}
 if(z.cap<=-1&&z.own!==0){z.own=0;pop(z.x,z.y-1.2,'ZONE CAPTURED!',TC[0]);if(mstat&&z.p0&&units.some(u=>u.isPlayer&&u.hp>0&&Math.hypot(u.x-z.x,u.y-z.y)<z.r))mstat.caps++;if(typeof fx==='function')fx('cap');}
 if(z.cap>=1&&z.own!==1){z.own=1;pop(z.x,z.y-1.2,'ENEMY TOOK THE ZONE',TC[1]);}
 const contested=z.own===0?p1>0:z.own===1?p0>0:true;
 if(z.own>=0&&!contested)gscore[z.own]=Math.min(ZONE_WIN,gscore[z.own]+ZONE_RATE*dt);
}
function respawnTick(dt){
 const zz=gzones&&gzones[0];
 for(const u of units){
  if(u.hp>0){   // out-of-combat repair: pull back, heal up, come back
   u.calm=(u.calm||0)+dt;
   const inZ=!!zz&&Math.hypot(u.x-zz.x,u.y-zz.y)<zz.r;   // no repairs while standing on the zone: holding it costs you
   if(u.calm>REPAIR_DELAY&&u.hp<u.mhp&&!inZ){u.hp=Math.min(u.mhp,u.hp+u.mhp*REPAIR_RATE*dt);u.rep=0.3;}else u.rep=Math.max(0,(u.rep||0)-dt);
   continue;
  }
  u.dead=(u.dead||0)+dt;
  if(u.dead>=respawnFor(u)){u.dead=0;u.hp=u.mhp;u.x=u.sx;u.y=u.sy;u.px=u.x;u.py=u.y;u.elev=0;u.ox=u.x;u.oy=u.y;u.buffs=[];u.sup=null;u.flash=0;u.trail=[];u.calm=0;
   if(u.brain){u.brain.mode='press';u.brain.t=1;u.brain.spot=null;}
   pop(u.x,u.y-1,u.isPlayer?'BACK IN THE FIGHT':'RESPAWNED',tcol(u.team));}
 }
}
// where a bot wants to be in Moon Zone: rotate early to the next spot, otherwise hold a point inside the zone
function botZoneGoal(u){
 const z=gzones[0];
 const holding=z.own===u.team&&!(u.team===0?z.p1:z.p0);
 const tgt=z.next&&(!holding||z.t<2.5)?z.next:z;
 const rr=(z.next&&tgt===z.next)?0.3:ZONE_R*0.45;
 let p=clampP(tgt.x+Math.cos(u.zo||0)*rr,tgt.y+Math.sin(u.zo||0)*rr);
 if(baseWalls.some(([x,y,w,h])=>p.x>x-R&&p.x<x+w+R&&p.y>y-R&&p.y<y+h+R)||rocks.some(([rx,ry,rr2])=>Math.hypot(p.x-rx,p.y-ry)<rr2+R)||rampAt(p.x,p.y)||(!inDeck(p.x,p.y)&&walls.some(([x,y,w,h])=>p.x>x-R&&p.x<x+w+R&&p.y>y-R&&p.y<y+h+R))){u.zo=Math.random()*6.28;p={x:tgt.x,y:tgt.y};}
 p.l=ptLevel(p);
 return p;
}
let units=[];   // all tanks in the current match; me is units[0] (team 0)
const BOX_COUNT=5;
const foesOf=u=>units.filter(v=>v.team!==u.team&&v.hp>0);
const aliveCount=t=>units.filter(u=>u.team===t&&u.hp>0).length;
function teamHpFrac(t){const us=units.filter(u=>u.team===t);const m=us.reduce((a,u)=>a+u.mhp,0);return m?us.reduce((a,u)=>a+u.hp,0)/m:0;}
function nearestFoe(u){let best=null,bd=1e9;for(const v of units){if(v.team===u.team||v.hp<=0)continue;const d=Math.hypot(v.x-u.x,v.y-u.y);if(d<bd){bd=d;best=v;}}return best;}
const auraOf=it=>it.premium?3:it.sal?0:Math.max(0,it.tier);   // rarity ring under the tank: none, rare, epic, legendary
function buildMe(){
 const U=save.up,W0=getW(save.weapon),Cc=getC(save.chassis),skin=save.skin==='lunar'?1.08:1,n=hpScale();
 const m={x:10,y:28,flash:0,ang:-Math.PI/2,cd:0.3,lk:null,buffs:[],gems:(save.cores||[]).filter(Boolean),gemM:Object.fromEntries(GORDER.map(k=>[k,gemMult(k)])),sp:0,sup:null,
  mhp:Math.round(STAT.hp*(1+0.08*U.hull)*Cc.hp*skin*n),dmgM:(1+0.08*U.cannon)*skin,spdM:(1+0.06*U.engine)*Cc.spd,
  critB:0.02*U.target,fillM:1+0.10*U.reactor,turnM:Cc.turn,team:0,isPlayer:true,
  wtype:W0.arch,wdps:W0.dps,wshot:W0.shot,wpspd:W0.pspd,wtier:W0.tier,wmult:W0.mult,dscale:Cc.size,cls:save.chassis,name:IN_TG?tgName(TG_USER):'You',
  aura:Math.max(auraOf(W0),auraOf(Cc)),paint:save.paint||'stock'};
 m.hp=m.mhp;return m;
}
const BOT_NAMES=['Rust','Vex','Kilo','Nyx','Bolt','Ion','Echo','Grit','Onyx','Rook','Volt','Zed','Hex','Juno','Mako','Pike'];
const BOT_PAINTS=['nebula','ember','arctic','venom','gold','void'];
// pick the map, mode and bots; the VS screen shows them before the fight starts
function prepareMatch(){
 {const pk=mapKey();setMap(pk==='random'?MAP_REAL[(Math.random()*MAP_REAL.length)|0]:pk);}
 {const gk=gtypeKey();matchG=gk==='random'?GT_ORDER[(Math.random()*GT_ORDER.length)|0]:gk;}
 me=buildMe();
 const W0=getW(save.weapon),Cc=getC(save.chassis);
 const bwm=W0.mult||TIER_MULT[Math.max(0,W0.tier)],bcm=Cc.mult||TIER_MULT[Math.max(0,Cc.tier)];
 const modeN=MODES[modeKey()].n,mp=save.mp||0,hs=hpScale();
 const names=BOT_NAMES.slice().sort(()=>Math.random()-0.5);
 // AI tank factory (allies and enemies mirror your gear level and cores)
 const mkBot=(team,x,y)=>{
  const bwA=WORDER[(Math.random()*3)|0];
  // brand-new pilots (first 10 matches) never face a chassis that counters theirs
  const cls=team!==0&&mp<10?CHORDER.filter(c=>COUNTER[c]!==me.cls):CHORDER;
  const bcC=cls[(Math.random()*cls.length)|0];
  const pScale=(team!==0&&mp<3?0.8:0.92)+Math.random()*0.16;   // first 3 matches: gentler enemies
  const u={x,y,flash:0,ang:team===0?-Math.PI/2:Math.PI/2,cd:0.5,lk:null,buffs:[],gems:me.gems.slice(),gemM:Object.assign({},me.gemM),sp:0,sup:null,
   mhp:Math.round(STAT.hp*CH[bcC].hp*bcm*pScale*hs),dmgM:1,spdM:CH[bcC].spd,critB:0,fillM:1,turnM:CH[bcC].turn,
   wtype:bwA,wdps:Math.round(WEAPONS[bwA].dps*bwm*pScale),wshot:WEAPONS[bwA].shot,wpspd:22,wtier:W0.tier,dscale:CH[bcC].ds,cls:bcC,
   team,isPlayer:false,name:names.pop()||'Bot',brain:{mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0},strafe:1,strafeT:1.5,
   aura:Math.min(2,me.aura),paint:Math.random()<0.35?BOT_PAINTS[(Math.random()*BOT_PAINTS.length)|0]:'stock'};   // about 1 in 3 AI pilots shows off a shop paint
  u.hp=u.mhp;return u;
 };
 units=[me];
 if(isSolo(matchG)){   // Last Standing: you and 5 AI pilots, each on their own team
  const sp=royaleSpawns();
  for(let i=1;i<GTYPES[matchG].solo;i++)units.push(mkBot(i,sp[i].x,sp[i].y));
 }else{
  for(let i=1;i<modeN;i++)units.push(mkBot(0,i===1?6:14,26));   // your AI teammates
  for(let i=0;i<modeN;i++)units.push(mkBot(1,i===0?10:(i===1?6:14),i===0?4:6));   // the enemy team
 }
 state='vs';
}
// switch chassis on the VS screen (counter-pick): rebuild your tank with the best owned version of that class
function switchChassis(cls){
 if(!ownedChassisClasses().includes(cls))return;
 save.chassis=cls;store();
 const keep={x:me.x,y:me.y,sx:me.sx,sy:me.sy,deaths:me.deaths||0,zo:me.zo||0};me=buildMe();Object.assign(me,keep);units[0]=me;
}
function matchup(){   // how your chassis fares against the enemy lineup
 const foes=units.filter(u=>u.team!==0),adv=foes.filter(f=>COUNTER[me.cls]===f.cls).length,dis=foes.filter(f=>COUNTER[f.cls]===me.cls).length;
 return {adv,dis,foes};
}
function startMatch(){
 mstat={dmg:0,sup:0,box:0,taken:0,kills:0,caps:0,cry:0,stars:0};
 {const {adv,dis}=matchup();
  banner=null;if((adv||dis)&&!isSolo(matchG))banner={t:3,txt:adv&&!dis?'You counter them: +15% damage':dis&&!adv?'Countered: '+CH[beatenBy(me.cls)].n+' beats '+CH[me.cls].n:'Mixed matchup',c:adv&&!dis?'#5fe3a1':dis&&!adv?'#ff6b5e':'#ffcf4a'};}
 series=isSeriesMode()?{w:[0,0],round:1}:null;
 if(series&&!banner)banner={t:2.4,txt:'Best of 3: first to 2 rounds wins',c:'#ffcf4a'};
 const G=GTYPES[matchG];
 bullets=[];timeLeft=series?ROUND_T:G.t;state='play';elapsed=0;ffwd=false;warns=[];evt=null;feed=[];
 evtAt=series?0:(matchG==='zone'||matchG==='crystal'?50:matchG==='royale'?40:26)+Math.random()*14;evtKind=EVT_KEYS[(Math.random()*EVT_KEYS.length)|0];
 gscore=[0,0];gzones=null;cry=null;storm=null;
 units.forEach(u=>{u.sx=u.x;u.sy=u.y;u.dead=0;u.deaths=0;u.calm=0;u.zo=Math.random()*6.28;u.elev=0;u.ox=u.x;u.oy=u.y;u.cry=0;u.bty=BTY_START;u.focus=null;u.sg=null;u.ms=null;});
 if(matchG==='zone'){const c=zoneSpot(null);gzones=[{x:c.x,y:c.y,r:ZONE_R,cap:0,own:-1,p0:0,p1:0,t:22+Math.random()*6,next:null,moves:0}];}
 if(matchG==='crystal')cry={mine:{x:10,y:16},loose:[],t:2,cd:null,cnt:[0,0]};
 if(matchG==='royale'){const c=freeSpot(10+(Math.random()-0.5)*4,16+(Math.random()-0.5)*4,2.5)||freeSpot(10,16,6)||{x:10,y:16,l:0};storm={x:c.x,y:c.y,l:c.l,r:STORM_R0,tk:0,warned:false};}
 boxes=[];sidx=0;pops=[];nums=[];beams=[];shells=[];blasts=[];novas=[];shakeT=0;shakeM=0;sched=boxSchedule();
 if(storm)for(let i=0;i<6;i++)placeBox(true);   // Last Standing: loot is already on the ground
 if(!banner&&MODE_TIP[matchG]&&!series)banner={t:3,txt:MODE_TIP[matchG],c:'#ffcf4a'};
 if(typeof onMatchStart==='function')onMatchStart();
}
function newMatch(){prepareMatch();startMatch();}   // tests and quick restarts

// ---- physics helpers ----
function push(b){
 b.x=Math.max(R,Math.min(W-R,b.x));b.y=Math.max(R,Math.min(H-R,b.y));
 if(b.ox===undefined){b.ox=b.x;b.oy=b.y;}
 if(BR){
  if(b.elev===1){
   if(!upOk(b.x,b.y)){
    if(rampExit(b.x,b.y))b.elev=0;                          // rolled off the open end of a ramp
    else if(upOk(b.x,b.oy))b.y=b.oy;else if(upOk(b.ox,b.y))b.x=b.ox;else if(upOk(b.ox,b.oy)){b.x=b.ox;b.y=b.oy;}   // deck edge: slide along it
    else{const rp=rampAt(b.x,b.y);if(rp)b.x=Math.max(rp[0]+R*0.75,Math.min(rp[0]+rp[2]-R*0.75,b.x));else if(!inDeck(b.x,b.y))b.elev=0;}   // never left in a spot it can't drive out of
   }
   if(b.elev===1){b.ox=b.x;b.oy=b.y;return;}
  }else if(rampAt(b.x,b.y)&&!inDeck(b.x,b.y)){const rp=rampAt(b.x,b.y);b.elev=1;b.x=Math.max(rp[0]+R*0.75,Math.min(rp[0]+rp[2]-R*0.75,b.x));}     // drove (or dashed) onto a ramp: line up with its lane
  if(b.elev===1){b.ox=b.x;b.oy=b.y;return;}
 }
 b.elev=0;
 for(let pass=0;pass<2;pass++){
  for(const [x,y,w,h] of walls){
   const cx=Math.max(x,Math.min(b.x,x+w)),cy=Math.max(y,Math.min(b.y,y+h));
   let dx=b.x-cx,dy=b.y-cy,d=Math.hypot(dx,dy);
   if(d<R){if(d===0){dx=0;dy=-1;d=1;}b.x+=dx/d*(R-d);b.y+=dy/d*(R-d);}
  }
  for(const [cx,cy,cr] of rocks){
   const dx=b.x-cx,dy=b.y-cy,d=Math.hypot(dx,dy),m=cr+R;
   if(d<m){if(d<1e-6){b.y=cy-m;}else{b.x+=dx/d*(m-d);b.y+=dy/d*(m-d);}}
  }
  b.x=Math.max(R,Math.min(W-R,b.x));b.y=Math.max(R,Math.min(H-R,b.y));
 }
 b.ox=b.x;b.oy=b.y;
}
// exact segment-vs-box test (slab method): fast and can't skip thin walls like ramp rails
function segHitsRect(ax,ay,bx,by,rx,ry,rw,rh){
 let t0=0,t1=1;const dx=bx-ax,dy=by-ay;
 const clip=(p,q)=>{if(p===0)return q>0;const r=q/p;if(p<0){if(r>t1)return false;if(r>t0)t0=r;}else{if(r<t0)return false;if(r<t1)t1=r;}return true;};
 if(!clip(-dx,ax-rx)||!clip(dx,rx+rw-ax)||!clip(-dy,ay-ry)||!clip(dy,ry+rh-ay))return false;
 return t1-t0>1e-6;
}
function segHitsCircle(ax,ay,bx,by,cx,cy,r){
 const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;let t=l2?((cx-ax)*dx+(cy-ay)*dy)/l2:0;t=Math.max(0,Math.min(1,t));
 const px=ax+dx*t-cx,py=ay+dy*t-cy;return px*px+py*py<r*r;
}
function losW(a,b,wl,fat){
 for(const [rx,ry,rw,rh] of wl)if(segHitsRect(a.x,a.y,b.x,b.y,rx,ry,rw,rh))return false;
 for(const [cx,cy,cr] of rocks)if(segHitsCircle(a.x,a.y,b.x,b.y,cx,cy,cr+(fat||0)))return false;
 return true;
}
const inRock=(x,y)=>rocks.some(([cx,cy,cr])=>(x-cx)*(x-cx)+(y-cy)*(y-cy)<cr*cr);
const slowAt=u=>(u.elev||0)===0&&craters.some(([cx,cy,cr])=>(u.x-cx)*(u.x-cx)+(u.y-cy)*(u.y-cy)<cr*cr)?CRATER_SLOW:1;
// breakable supply crates: soak up shots and blasts, sometimes drop a mystery box
function hitCrate(c,dmg){
 if(!c.mhp||c.hp<=0)return;
 c.hp-=dmg;c.flash=0.08;
 if(c.hp>0)return;
 for(const L of [walls,baseWalls,navWalls]){const i=L.indexOf(c);if(i>=0)L.splice(i,1);}
 const i=crates.indexOf(c);if(i>=0)crates.splice(i,1);
 const x=c[0]+c[2]/2,y=c[1]+c[3]/2;
 blasts.push({x,y,r:1.3,t:0.35,t0:0.35,c:'#ffb347'});shake(3,0.2);if(typeof fx==='function')fx('crate');
 if(Math.random()<0.45){boxes.push({x,y,life:20,age:0});pop(x,y-0.8,'MYSTERY BOX','#ffd24a');}
 else pop(x,y-0.8,'CRATE DESTROYED','#c9d6e3');
 buildNav();for(const u of units)u.wp=null;   // routes open up through the gap
}
function hitCratesNear(x,y,r,dmg){for(const c of crates.slice()){const cx=Math.max(c[0],Math.min(x,c[0]+c[2])),cy=Math.max(c[1],Math.min(y,c[1]+c[3]));if(Math.hypot(x-cx,y-cy)<r)hitCrate(c,dmg);}}
function los(a,b){   // combat sight, level aware
 const la=a.elev||0,lb=b.elev||0;
 if(!BR||(la===0&&lb===0))return losW(a,b,walls);
 if(la===1&&lb===1)return true;
 if(underDeck(a)||underDeck(b))return false;
 return losW(a,b,baseWalls);    // high ground sees over the deck blocks
}
// turret turns toward the enemy at a limited rate; fires only when lined up, in range, with clear sight.
// Bullets travel, so shots land where the target WAS: moving well makes enemy shots miss.
function turret(a,dt){
 let b=nearestFoe(a);
 if(!b||a.hp<=0)return;
 const f=a.focus;if(f&&f!==b&&f.hp>0&&f.team!==a.team&&dist2(a,f)<=STAT.range&&los(a,f))b=f;   // bots lock onto their objective target once it's in reach
 const seen=los(a,b);
 if(seen)a.lk={x:b.x,y:b.y};            // remember where the enemy was last seen
 const aim=a.isPlayer?b:a.lk;   // you always see the enemy; the bot only knows where it last saw you
 if(aim){
  const want=Math.atan2(aim.y-a.y,aim.x-a.x);
  let d=want-a.ang;d=Math.atan2(Math.sin(d),Math.cos(d));
  const st=STAT.turn*(a.turnM||1)*dt;a.ang+=Math.max(-st,Math.min(st,d));
 }
 a.cd-=dt;
 let r=Math.atan2(b.y-a.y,b.x-a.x)-a.ang;r=Math.atan2(Math.sin(r),Math.cos(r));
 const dist=Math.hypot(b.x-a.x,b.y-a.y);
 if(a.cd<=0&&seen&&Math.abs(r)<0.14&&dist<=STAT.range){
  a.cd=a.wshot/rofMult(a);if(a.isPlayer&&typeof fx==='function')fx('shot',a.wtype);
  bullets.push({x:a.x,y:a.y,hi:(a.elev||0)===1||(b.elev||0)===1,vx:Math.cos(a.ang)*a.wpspd,vy:Math.sin(a.ang)*a.wpspd,o:a,dps:a.wdps,shot:a.wshot,dm:dmgMult(a),life:(STAT.range+1)/a.wpspd});
 }
}
function moveBullets(dt){
 for(const q of bullets){
  for(let k=0;k<2&&q.life>0;k++){
   q.x+=q.vx*dt/2;q.y+=q.vy*dt/2;
   for(const wl of (q.hi?baseWalls:walls))if(q.x>wl[0]&&q.x<wl[0]+wl[2]&&q.y>wl[1]&&q.y<wl[1]+wl[3]){q.life=0;if(wl.mhp)hitCrate(wl,q.dps*q.shot*q.dm);break;}
   if(q.life>0&&inRock(q.x,q.y))q.life=0;
   if(q.x<0||q.x>W||q.y<0||q.y>H)q.life=0;
   let t=null,bd=1e9;
   for(const v of units){if(v.team===q.o.team||v.hp<=0)continue;if(q.hi?underDeck(v):(v.elev||0)!==0)continue;const d=Math.hypot(q.x-v.x,q.y-v.y);if(d<R+0.12&&d<bd){bd=d;t=v;}}
   if(q.life>0&&t){const sp=Math.hypot(q.vx,q.vy)||1,off=Math.abs((t.x-q.x)*q.vy-(t.y-q.y)*q.vx)/sp,direct=off<DIRECT;
   const owner=q.o,isCrit=direct&&Math.random()<CRIT_BASE+bsum(owner,'lck')+gsum(owner,'lck')+(owner.critB||0);
   const dmg=q.dps*q.shot*q.dm*(1-armor(t))*(direct?(isCrit?CRIT_MULT:1):GRAZE)*cmult(owner,t);
   takeHit(t,dmg,owner);if(owner.isPlayer&&typeof fx==='function')fx('dealt',isCrit);owner.sp=Math.min(SUPER_MAX,owner.sp+(dmg*FILL_DEALT+(isCrit?FILL_CRIT:0))*(owner.fillM||1)*flareMult());t.sp=Math.min(SUPER_MAX,t.sp+dmg*FILL_TAKEN*(t.fillM||1)*flareMult());if(owner.isPlayer&&mstat)mstat.dmg+=dmg;nums.push({x:t.x+(Math.random()-0.5)*1.2,y:t.y-R,t:0.9,z:isCrit?1.6:direct?1:0.75,g:!direct,txt:'',c:isCrit?'#ffd24a':tcol(q.o.team)});dmgNum(nums.pop(),t,dmg,isCrit);q.life=0;}
  }
  q.life-=dt;
 }
 bullets=bullets.filter(q=>q.life>0);
}

// ---- buffs & mystery box ----
const bsum=(r,k)=>r.buffs.reduce((a,b)=>a+(b.k===k?BUFF[k].amt:0),0);
const gsum=(r,k)=>r.gems.reduce((a,g)=>a+(g===k?GEM[k].amt*((r.gemM&&r.gemM[k])||1):0),0);
const dmgMult=r=>(1+bsum(r,'dmg'))*(1+gsum(r,'dmg'))*(r.dmgM||1),rofMult=r=>(1+bsum(r,'rof'))*(1+gsum(r,'rof')),spdMult=r=>(1+bsum(r,'spd'))*(1+gsum(r,'spd'))*(r.spdM||1),armor=r=>Math.min(0.7,bsum(r,'arm')+gsum(r,'arm'));
function takeHit(r,amt,src,why){
 const wasAlive=r.hp>0;
 r.hp-=amt;r.flash=0.08;r.calm=0;if(r.isPlayer&&amt>0)r.hurtT=0.3;
 if(r.isPlayer&&mstat)mstat.taken+=amt;
 if(r.isPlayer&&amt>0&&typeof fx==='function')fx('hit',amt);
 for(const b of r.buffs)b.taken+=amt;
 r.buffs=r.buffs.filter(b=>b.taken<BUFF_LIFE);   // buff wears off after enough damage taken
 if(wasAlive&&r.hp<=0){
  r.deaths=(r.deaths||0)+1;
  if(gzones){const k=1-r.team;gscore[k]=Math.min(ZONE_WIN,gscore[k]+KILL_PTS);pop(r.x,r.y-1.6,'+'+KILL_PTS+' KILL',TC[k]);}
  if(cry)dropCrystals(r);
  if(matchG==='bounty')bountyKill(r,src);
  if(storm&&!r.isPlayer){boxes.push({x:r.x,y:r.y,life:20,age:0});pop(r.x,r.y-0.6,'LOOT DROPPED','#ffd24a');}   // every wreck drops a box
 }
 if(wasAlive&&r.hp<=0&&src&&src.isPlayer&&mstat)mstat.kills++;
 if(wasAlive&&r.hp<=0)feedPush(src?(src.isPlayer?'You':src.name)+' destroyed '+(r.isPlayer?'you':r.name):(r.isPlayer?'You':r.name)+(why==='storm'?' got caught in the storm':' got hit by a meteor'),src?tcol(src.team):why==='storm'?'#c79bff':'#ff8a3d');
 if(wasAlive&&r.hp<=0&&typeof fx==='function')fx(r.isPlayer?'die':src&&src.isPlayer?'kill':'boom');
 if(wasAlive&&r.hp<=0){   // robot destroyed: wreck explosion
  blasts.push({x:r.x,y:r.y,r:2.2,t:0.6,t0:0.6,c:'#ff6b3c'});
  blasts.push({x:r.x,y:r.y,r:1.4,t:0.4,t0:0.4,c:'#ffd24a'});
  shake(10,0.5);
  nums.push({x:r.x,y:r.y-R,t:1.1,z:1.4,txt:r.isPlayer?'YOU ARE DOWN':'DESTROYED',c:r.isPlayer?'#ff6b6b':'#ffd24a'});
 }
}
function pop(x,y,txt,c){pops.push({x,y,txt,c,t:1.4});}
// one floating number per target for rapid hits (merged inside 0.25s); crits always get their own
function dmgNum(q,t,dmg,isCrit){
 if(!isCrit){for(const o of nums)if(o.tg===t&&!o.crit&&o.t>0.65&&o.c===q.c){o.v+=dmg;o.txt=String(Math.round(o.v));o.t=0.9;return;}}
 q.tg=t;q.v=dmg;q.crit=isCrit;q.txt=(isCrit?'CRIT ':'')+Math.round(dmg);nums.push(q);
}

function placeBox(quiet){   // one box at a random open spot
 for(let i=0;i<400;i++){
  const x=1.5+Math.random()*(W-3),y=1.5+Math.random()*(H-3);      // anywhere on the map
  if(walls.some(([rx,ry,rw,rh])=>x>rx-1.4&&x<rx+rw+1.4&&y>ry-1.4&&y<ry+rh+1.4))continue;   // not in or hugging cover
  if(rocks.some(([cx,cy,cr])=>Math.hypot(x-cx,y-cy)<cr+1.4))continue;
  if(units.some(r=>r.hp>0&&Math.hypot(r.x-x,r.y-y)<(quiet?4.5:3.5)))continue;      // never spawn on top of a robot
  if(boxes.some(b=>Math.hypot(b.x-x,b.y-y)<4))continue;   // don't stack boxes on each other
  if(storm&&Math.hypot(x-storm.x,y-storm.y)>storm.r-1.5)continue;   // never outside the ring
  boxes.push({x,y,life:quiet?40:20,age:0});if(!quiet)pop(x,y,'MYSTERY BOX','#ffd24a');return true;
 }
 return false;
}
function spawnBox(){
 const n=storm?2:MODES[modeKey()].n,cap=storm?8:n+2;   // boxes per spawn event: 1 in 1v1, 2 in 2v2, 3 in 3v3, 2 in Last Standing
 for(let s=0;s<n;s++){if(boxes.length>=cap)break;placeBox(false);}   // the cap stops unclaimed boxes piling up
}
// ---- super attacks: one per weapon. All telegraphed so they can be dodged ----
const SUP={
 pulse:{kind:'beam',dmg:350,charge:0.7,w:1.2,len:16},          // PIERCE LANCE: railbeam that goes through cover
 siege:{kind:'shell',dmg:375,charge:0.7,r:3.2,spd:11,range:13},  // SIEGE BLAST: huge shell, big AoE explosion
 twin:{kind:'nova',dmg:350,charge:0.55,r:4.6},                 // STATIC NOVA: vibrating electric shockwave
 moon:{kind:'beam',dmg:400,charge:0.8,w:2.0,len:20}};          // MOONFALL: massive lunar beam
let shells=[],blasts=[],novas=[],shakeT=0,shakeM=0;
function shake(m,t){shakeM=Math.max(shakeM,m);shakeT=Math.max(shakeT,t);}
function beamLen(a,ang){   // beam stops at cover (siege telegraph only; pulse pierces)
 for(let d=0.3;d<SUPER_LEN;d+=0.2){const x=a.x+Math.cos(ang)*d,y=a.y+Math.sin(ang)*d;
  for(const [rx,ry,rw,rh] of ((a.elev||0)===1?baseWalls:walls))if(x>rx&&x<rx+rw&&y>ry&&y<ry+rh)return d;
  if(inRock(x,y))return d;}
 return SUPER_LEN;
}
function useSuper(r,aimAng){
 if(state!=='play'||r.sup||r.sp<SUPER_MAX||r.hp<=0)return false;
 const S=SUP[r.wtype||'pulse'],e=nearestFoe(r),aimed=aimAng!==undefined&&aimAng!==null;
 if(!aimed){
  if(!e)return false;
  if(S.kind!=='nova'&&!los(r,e)){   // don't burn the charge on a blind auto-fire
   if(r.isPlayer)showToast('No line of sight. Drag from Super to aim it yourself.');
   return false;
  }
 }
 r.sp=0;
 if(r.isPlayer&&mstat)mstat.sup++;
 if(typeof fx==='function')fx(r.isPlayer?'super':'warn');   // an enemy super beeps as it charges
 const ang=aimed?aimAng:Math.atan2(e.y+(e.vy||0)*S.charge-r.y,e.x+(e.vx||0)*S.charge-r.x);
 r.sup={t:S.charge,ang,w:r.wtype||'pulse',fixed:aimed};
 return true;
}
// ---- dash: a quick burst in the direction you're steering (4s cooldown) ----
const DASH_CD=4,DASH_T=0.2,DASH_SPD=3.4;
function useDash(u,dx,dy){
 if(state!=='play'||u.hp<=0||(u.dashCd||0)>0||u.dash)return false;
 let m=Math.hypot(dx||0,dy||0);
 if(m<0.2){const a=u.hd===undefined?u.ang:u.hd;dx=Math.cos(a);dy=Math.sin(a);m=1;}
 u.dash={t:DASH_T,dx:dx/m,dy:dy/m};u.dashCd=DASH_CD;
 if(u.isPlayer&&typeof fx==='function')fx('dash');
 return true;
}
function dashStep(u,dt){   // returns true while dashing
 if(u.dashCd>0)u.dashCd=Math.max(0,u.dashCd-dt);
 if(!u.dash)return false;
 const k=STAT.speed*DASH_SPD*slowAt(u)*dt;u.x+=u.dash.dx*k;u.y+=u.dash.dy*k;push(u);
 u.dash.t-=dt;if(u.dash.t<=0)u.dash=null;
 return true;
}
// bots dash out of a super they see coming (about half the time)
function botDodge(u){
 if((u.dashCd||0)>0||u.dash)return;
 for(const v of units){
  if(v.team===u.team||v.hp<=0||!v.sup||v.sup.dodged&&v.sup.dodged[u.name])continue;
  const S=SUP[v.sup.w];let inDanger=false,px=0,py=0;
  if(S.kind==='nova'){const d=Math.hypot(u.x-v.x,u.y-v.y);if(d<S.r+R){inDanger=true;px=(u.x-v.x)/(d||1);py=(u.y-v.y)/(d||1);}}
  else{const ca=Math.cos(v.sup.ang),sa=Math.sin(v.sup.ang),ex=u.x-v.x,ey=u.y-v.y,along=ex*ca+ey*sa,side=-ex*sa+ey*ca,wd=S.kind==='beam'?S.w:S.r*0.6,ln=S.kind==='beam'?S.len:S.range;
   if(along>0&&along<ln&&Math.abs(side)<wd+R){inDanger=true;const sg=side>=0?1:-1;px=-sa*sg;py=ca*sg;}}
  if(!inDanger)continue;
  v.sup.dodged=v.sup.dodged||{};v.sup.dodged[u.name]=1;
  if(Math.random()<0.5)useDash(u,px,py);
  return;
 }
}
function fireSuper(r,S){
 const col=tcol(r.team);
 const hurt=(e,dmg)=>{if(!lvOK(r,e))return;dmg=dmg*(r.wmult||TIER_MULT[Math.max(0,r.wtier||0)])*dmgMult(r)*(1-armor(e))*cmult(r,e);takeHit(e,dmg,r);e.sp=Math.min(SUPER_MAX,e.sp+dmg*FILL_TAKEN*(e.fillM||1));
  if(r.isPlayer&&mstat)mstat.dmg+=dmg;nums.push({x:e.x,y:e.y-R,t:0.9,z:2,txt:'SUPER '+Math.round(dmg),c:'#ff4d4d'});};
 if(S.kind==='beam'){
  const ang=r.sup.ang;
  beams.push({ax:r.x,ay:r.y,bx:r.x+Math.cos(ang)*S.len,by:r.y+Math.sin(ang)*S.len,t:0.3,c:col,w:S.w});
  for(const c of crates.slice())if(segHitsRect(r.x,r.y,r.x+Math.cos(ang)*S.len,r.y+Math.sin(ang)*S.len,c[0]-S.w*0.5,c[1]-S.w*0.5,c[2]+S.w,c[3]+S.w))hitCrate(c,S.dmg);
  let hit=false;
  for(const e of foesOf(r)){
   const ex=e.x-r.x,ey=e.y-r.y;
   const along=ex*Math.cos(ang)+ey*Math.sin(ang),side=Math.abs(-ex*Math.sin(ang)+ey*Math.cos(ang));
   if(along>0&&along<=S.len&&side<S.w){
    hurt(e,S.dmg);hit=true;
    blasts.push({x:e.x,y:e.y,r:1.4,t:0.25,t0:0.25,c:'#ffd24a'});   // impact flare
   }
  }
  if(!hit)nums.push({x:r.x+Math.cos(ang)*Math.min(S.len,6),y:r.y+Math.sin(ang)*Math.min(S.len,6),t:0.9,z:1.2,txt:'MISSED',c:'#c0cad4'});
 }else if(S.kind==='shell'){
  shells.push({x:r.x+Math.cos(r.sup.ang)*1.2,y:r.y+Math.sin(r.sup.ang)*1.2,
   vx:Math.cos(r.sup.ang)*S.spd,vy:Math.sin(r.sup.ang)*S.spd,
   dmg:S.dmg,r:S.r,life:S.range/S.spd,owner:r});
  shake(4,0.25);
 }else{
  novas.push({x:r.x,y:r.y,r:S.r,t:0.45,t0:0.45,c:col});
  hitCratesNear(r.x,r.y,S.r,S.dmg*0.6);
  shake(6,0.35);
  let hit=false;
  for(const e of foesOf(r)){
   const d=Math.hypot(e.x-r.x,e.y-r.y);
   if(d<S.r+R){hurt(e,S.dmg*(1-0.4*(d/S.r)));hit=true;}
  }
  if(!hit)nums.push({x:r.x,y:r.y-1.6,t:0.9,z:1.2,txt:'MISSED',c:'#c0cad4'});
 }
}
function explode(s){
 s.dead=true;
 const r=s.owner;
 blasts.push({x:s.x,y:s.y,r:s.r,t:0.5,t0:0.5,c:'#ff9d45'});
 hitCratesNear(s.x,s.y,s.r,s.dmg);
 blasts.push({x:s.x,y:s.y,r:s.r*0.65,t:0.35,t0:0.35,c:'#ffd24a'});
 shake(9,0.45);
 for(const e of foesOf(r)){
  const d=Math.hypot(e.x-s.x,e.y-s.y);
  if(d<s.r+R&&lvOK(r,e)){
   const fall=1-0.65*(d/(s.r+R));
   const dmg=s.dmg*fall*(r.wmult||TIER_MULT[Math.max(0,r.wtier||0)])*dmgMult(r)*(1-armor(e))*cmult(r,e);takeHit(e,dmg,r);e.sp=Math.min(SUPER_MAX,e.sp+dmg*FILL_TAKEN*(e.fillM||1));
   if(r.isPlayer&&mstat)mstat.dmg+=dmg;
   nums.push({x:e.x,y:e.y-R,t:0.9,z:2,txt:'SUPER '+Math.round(dmg),c:'#ff4d4d'});
  }
 }
}
function superTick(dt){
 for(const r of units){
  if(!r.sup||r.hp<=0)continue;
  const S=SUP[r.sup.w],e=nearestFoe(r);
  if(e&&S.kind!=='nova'&&r.sup.t>0.25&&!r.sup.fixed){   // the aim keeps steering until the last 0.25s, then locks
   if(los(r,e)){const want=Math.atan2(e.y+(e.vy||0)*r.sup.t-r.y,e.x+(e.vx||0)*r.sup.t-r.x);let d=want-r.sup.ang;d=Math.atan2(Math.sin(d),Math.cos(d));const st=1.6*dt;r.sup.ang+=Math.max(-st,Math.min(st,d));}
  }
  r.sup.t-=dt;
  if(r.sup.t<=0){fireSuper(r,S);r.sup=null;}
 }
 for(const s of shells){   // siege shells fly until they hit an enemy, a wall, or max range
  s.life-=dt;
  let boom=s.life<=0;
  for(let k=0;k<2&&!boom;k++){
   s.x+=s.vx*dt/2;s.y+=s.vy*dt/2;
   if(s.x<0||s.x>W||s.y<0||s.y>H)boom=true;
   for(const [rx,ry,rw,rh] of ((s.owner.elev||0)===1?baseWalls:walls))if(s.x>rx&&s.x<rx+rw&&s.y>ry&&s.y<ry+rh)boom=true;
   if(inRock(s.x,s.y))boom=true;
   if(!boom)for(const v of units){if(v.team===s.owner.team||v.hp<=0)continue;if(Math.hypot(s.x-v.x,s.y-v.y)<R+0.55){boom=true;break;}}
  }
  if(boom)explode(s);
 }
 shells=shells.filter(s=>s.life>0&&!s.dead);
 for(const b of blasts)b.t-=dt;
 blasts=blasts.filter(b=>b.t>0);
 for(const n of novas)n.t-=dt;
 novas=novas.filter(n=>n.t>0);
 for(const b of beams)b.t-=dt;
 beams=beams.filter(b=>b.t>0);
 if(me.sp>=SUPER_MAX&&!me.rdyShown){me.rdyShown=true;nums.push({x:me.x,y:me.y-1.8,t:0.9,z:1.5,txt:'SUPER READY',c:'#ff4d4d'});if(typeof fx==='function')fx('ready');}
 if(me.sp<SUPER_MAX)me.rdyShown=false;
 for(const u of units){   // AI units fire their super when ready, with sight and in range
  if(u.isPlayer||u.hp<=0)continue;
  u.rdy=u.sp>=SUPER_MAX&&!u.sup?(u.rdy||0)+dt:0;
  const brng=u.wtype==='twin'?SUP.twin.r+1.2:STAT.range+1.5;
  const tgt=nearestFoe(u);
  if(u.rdy>0.5&&tgt&&los(u,tgt)&&Math.hypot(tgt.x-u.x,tgt.y-u.y)<=brng)useSuper(u);
 }
}
function heading(dt){   // hull turns toward the direction of travel; the turret aims on its own
 for(const r of units){
  const dx=r.x-(r.px===undefined?r.x:r.px),dy=r.y-(r.py===undefined?r.y:r.py);r.px=r.x;r.py=r.y;r.vx=dx/dt;r.vy=dy/dt;
  if(r.hd===undefined)r.hd=r.ang;
  if(Math.hypot(dx,dy)>0.004){let d=Math.atan2(dy,dx)-r.hd;d=Math.atan2(Math.sin(d),Math.cos(d));const st=7*dt;r.hd+=Math.max(-st,Math.min(st,d));}
 }
}
function boxTick(dt){
 for(const r of units){r.trail=r.trail||[];r.tt=(r.tt||0)+dt;if(r.tt>0.04){r.tt=0;r.trail.push({x:r.x,y:r.y});if(r.trail.length>7)r.trail.shift();}}
 for(const r of units){const rg=bsum(r,'reg')+gsum(r,'reg');   // health regeneration buff
  if(rg>0&&r.hp>0&&r.hp<r.mhp){const h=Math.min(r.mhp-r.hp,r.mhp*rg*dt);r.hp+=h;r.rh=(r.rh||0)+h;
   if(r.rh>=5){nums.push({x:r.x+(Math.random()-0.5)*1.2,y:r.y-R,t:0.9,txt:'+'+Math.round(r.rh),c:'#4be3a0'});r.rh=0;}}}
 if(sidx<sched.length&&elapsed>=sched[sidx]){sidx++;spawnBox();}
 for(const bx of boxes){
  bx.life-=dt;bx.age+=dt;
  for(const r of units){
   if(bx.life>0&&r.hp>0&&Math.hypot(r.x-bx.x,r.y-bx.y)<R+0.9){
    const ks=Object.keys(BUFF),k=ks[Math.floor(Math.random()*ks.length)];
    r.buffs.push({k,taken:0});pop(bx.x,bx.y,BUFF[k].txt,BUFF[k].c);if(r.isPlayer&&mstat){mstat.box++;if(typeof fx==='function')fx('box');}bx.life=0;break;
   }
  }
 }
 boxes=boxes.filter(b=>b.life>0);
 for(const q of pops)q.t-=dt;
 pops=pops.filter(q=>q.t>0);
 for(const q of nums)q.t-=dt;
 nums=nums.filter(q=>q.t>0);
}

// ---- bot brain: picks a tactic, paths around cover ----
let nav=[],navAdj=[];
const ptLevel=p=>p.elev!==undefined?p.elev:p.l!==undefined?p.l:(inDeck(p.x,p.y)&&!inTunnel(p.x,p.y))?1:0;
function visL(a,b,l){
 if(l===0)return losW(a,b,navWalls,R*0.8);
 const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d/0.3));
 for(let i=0;i<=n;i++){const t=i/n;if(!upOk(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}
 return true;
}
function buildNav(){
 nav=[];
 const free=(px,py)=>px>R&&px<W-R&&py>R&&py<H-R&&!navWalls.some(([rx,ry,rw,rh])=>px>rx-R&&px<rx+rw+R&&py>ry-R&&py<ry+rh+R)&&!rocks.some(([cx,cy,cr])=>Math.hypot(px-cx,py-cy)<cr+R);
 for(const [x,y,w,h] of navWalls)for(const sx of [-1,1])for(const sy of [-1,1]){
  const px=(sx<0?x:x+w)+sx*(R+0.45),py=(sy<0?y:y+h)+sy*(R+0.45);
  if(free(px,py))nav.push({x:px,y:py,l:0});
 }
 for(const [cx,cy,cr] of rocks)for(let k=0;k<6;k++){const a=k/6*Math.PI*2+Math.PI/6,d=cr+R+0.5,px=cx+Math.cos(a)*d,py=cy+Math.sin(a)*d;if(free(px,py))nav.push({x:px,y:py,l:0});}
 const links=[];
 if(BR){const [dx,dy,dw,dh]=BR.deck;
  for(const [tx,tw] of BR.tunnels){nav.push({x:tx+tw/2,y:dy-1.1,l:0});nav.push({x:tx+tw/2,y:dy+dh+1.1,l:0});}
  for(const [rx,ry,rw,rh,o] of BR.ramps){const cx=rx+rw/2,foot={x:cx,y:o<0?ry-1.0:ry+rh+1.0,l:0},top={x:cx,y:o<0?ry+rh+1.0:ry-1.0,l:1};
   nav.push(foot,top);links.push([nav.length-2,nav.length-1]);}
 }
 navAdj=nav.map((a,i)=>nav.map((c,j)=>i!==j&&a.l===c.l&&visL(a,c,a.l)?dist2(a,c):0));
 for(const [i,j] of links){navAdj[i][j]=navAdj[j][i]=dist2(nav[i],nav[j])+0.5;}
}
const dist2=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clampP=(x,y)=>({x:Math.max(R,Math.min(W-R,x)),y:Math.max(R,Math.min(H-R,y))});
setMap(curMap);
// next point to steer to: straight there if clear, else the first hop of the shortest route (across levels on Overpass)
function waypoint(from,to){
 const lf=ptLevel(from),lt=ptLevel(to);
 if(lf===lt&&visL(from,to,lf))return to;
 const n=nav.length,dd=Array(n).fill(1e9),prev=Array(n).fill(-1),done=Array(n).fill(false);
 const gv=nav.map(c=>c.l===lt&&visL(c,to,lt)?dist2(c,to):0);
 nav.forEach((c,i)=>{if(c.l===lf&&visL(from,c,lf))dd[i]=dist2(from,c);});
 const rp=lf===1&&rampAt(from.x,from.y);   // on a ramp: its foot is one straight drive down (without this, bots rock up and down the ramp)
 if(rp){const cx=rp[0]+rp[2]/2,fy=rp[4]<0?rp[1]-1.0:rp[1]+rp[3]+1.0;nav.forEach((c,i)=>{if(c.l===0&&Math.abs(c.x-cx)<0.01&&Math.abs(c.y-fy)<0.01)dd[i]=Math.min(dd[i],dist2(from,c));});}
 for(let k=0;k<n;k++){
  let u=-1;for(let i=0;i<n;i++)if(!done[i]&&dd[i]<1e9&&(u<0||dd[i]<dd[u]))u=i;
  if(u<0)break;done[u]=true;
  for(let v=0;v<n;v++)if(navAdj[u][v]&&dd[u]+navAdj[u][v]<dd[v]){dd[v]=dd[u]+navAdj[u][v];prev[v]=u;}
 }
 let best=-1,bc=1e9;
 for(let i=0;i<n;i++)if(gv[i]&&dd[i]<1e9&&dd[i]+gv[i]<bc){bc=dd[i]+gv[i];best=i;}
 if(best<0)return to;
 const path=[];for(let i=best;i>=0;i=prev[i])path.unshift(nav[i]);
 for(const c of path)if(dist2(from,c)>0.5)return c;      // skip nodes we are already standing on
 return to;
}
// nearest spot behind a cover block that is hidden from the threat
function coverSpot(from,threat){
 let best=null,bd=1e9;
 for(const [x,y,w,h] of walls){
  const cx=x+w/2,cy=y+h/2,dx=cx-threat.x,dy=cy-threat.y,d=Math.hypot(dx,dy)||1,off=Math.hypot(w,h)/2+R+0.6;
  const s=clampP(cx+dx/d*off,cy+dy/d*off);
  if(los(s,threat))continue;
  const t=dist2(from,s);if(t<bd){bd=t;best=s;}
 }
 for(const [cx,cy,cr] of rocks){
  const dx=cx-threat.x,dy=cy-threat.y,d=Math.hypot(dx,dy)||1,s=clampP(cx+dx/d*(cr+R+0.6),cy+dy/d*(cr+R+0.6));
  if(los(s,threat)||inRock(s.x,s.y))continue;
  const t=dist2(from,s);if(t<bd){bd=t;best=s;}
 }
 return best;
}
function botAI(dt,u){
 const tgt=botTarget(u);
 if(!tgt||u.hp<=0)return;
 u.focus=tgt;
 botDodge(u);if(dashStep(u,dt))return;
 const b=u.brain,d=dist2(u,tgt),seen=los(u,tgt),hurt=u.hp/u.mhp<0.5&&u.hp<tgt.hp;
 u.strafeT-=dt;if(u.strafeT<=0){u.strafe=-u.strafe;u.strafeT=1+Math.random()*1.8;}
 b.t-=dt;b.age+=dt;b.hideCd-=dt;
 b.chk=(b.chk||0)+dt;   // stuck breaker: barely moved for 0.5s while it should be moving -> flip strafe side and re-plan
 if(b.chk>0.5){const waiting=b.spot&&!b.out&&dist2(u,b.spot)<0.7;
  if(!waiting&&b.lx!==undefined&&Math.hypot(u.x-b.lx,u.y-b.ly)<0.3){u.strafe=-u.strafe;u.strafeT=1.5;b.t=0;}
  b.chk=0;b.lx=u.x;b.ly=u.y;}
 const stuck=(b.mode==='peek'||b.mode==='hide')&&!b.out&&b.age>3.2&&dist2(u,b.spot||u)>0.7;
 if(b.t<=0||stuck||(hurt&&b.hideCd<=0&&b.mode!=='hide')){
  const prev=b.mode,r=Math.random();
  let m=r<0.35?'press':r<0.65?'flank':'peek';
  if(m===prev)m=m==='press'?'flank':'press';           // never repeat the same tactic
  if(hurt&&b.hideCd<=0){m='hide';b.hideCd=9;}           // retreat is short and on cooldown
  b.mode=m;b.t=m==='hide'?3:2.5+Math.random()*2.5;b.side=Math.random()<0.5?-1:1;b.spot=null;b.out=false;b.w=0;b.age=0;
 }
 const nx=(tgt.x-u.x)/(d||1),ny=(tgt.y-u.y)/(d||1);
 let goal=tgt;
 if(b.mode==='flank'){
  goal=clampP(tgt.x-ny*b.side*6,tgt.y+nx*b.side*6);       // swing wide to the target's side
  if(dist2(u,goal)<1.5){b.mode='press';b.t=Math.max(b.t,2);}
 }else if(b.mode==='hide'||b.mode==='peek'){
  if(!b.spot)b.spot=coverSpot(u,tgt);
  if(b.spot&&!b.out){
   goal=b.spot;
   if(dist2(u,b.spot)<0.7){b.w+=dt;if(b.mode==='peek'&&b.w>0.7){b.out=true;b.t=Math.max(b.t,2.5);}} // wait, then step out and fight
  }
 }
 let zin=null;
 if(respawns()){   // modes with respawns and repairs: losing the trade? break off, repair out of sight, come back healthy
  const fr=u.hp/u.mhp,tf=tgt.hp/tgt.mhp,lim=(u.cry||0)>=3||(matchG==='bounty'&&(u.bty||0)>=5)?0.45:0.3;   // carriers and big bounties play it safer
  if(!b.zr&&fr<lim&&seen&&d<8&&tf>fr+0.2){b.zr=true;b.spot=coverSpot(u,tgt);}
  if(b.zr&&(fr>0.8||(!seen&&fr>0.6)))b.zr=false;
 }
 if(b.zr){
  goal=b.spot&&dist2(b.spot,tgt)>3?b.spot:clampP(u.x-nx*5,u.y-ny*5);
  if(b.spot&&dist2(u,b.spot)<0.7&&los(u,tgt))b.spot=coverSpot(u,tgt);
 }else if(gzones){
  const z=gzones[0];
  let zg=botZoneGoal(u),nb=null,nd=4.5;for(const bx of boxes){const dd=dist2(u,bx);if(dd<nd){nd=dd;nb=bx;}}if(nb&&!z.next)zg=nb;
  const zt=z.next&&dist2(zg,z.next)<1.5?z.next:z;
  if(zt===z&&dist2(u,z)<z.r-0.4)zin=z;
  if(zg&&!(seen&&d<5.5&&dist2(u,zt)<z.r+3))goal=zg;   // fight only near the objective, otherwise keep moving to it
 }
 else if(cry){const cg=crystalGoal(u,tgt,seen,d);if(cg)goal=cg;}
 else if(storm){const sg=royaleGoal(u,tgt,seen,d);if(sg)goal=sg;}
 else if(boxes.length){let nb=boxes[0],nd=1e9;for(const bx of boxes){const d=dist2(u,bx);if(d<nd){nd=d;nb=bx;}}goal=nb;}   // head for the nearest box
 let tx,ty;
 if(goal===tgt&&seen){            // engaging: hold range and strafe
  let mx=0,my=0;
  if(d>4.8){mx=nx;my=ny;}else if(d<3.2){mx=-nx;my=-ny;}
  mx+=-ny*u.strafe*0.8;my+=nx*u.strafe*0.8;
  if(zin){const zx=zin.x-u.x,zy=zin.y-u.y,zd=Math.hypot(zx,zy)||1;if(zd>zin.r*0.55){mx+=zx/zd*1.4;my+=zy/zd*1.4;}}   // strafe but stay on the point
  const m=Math.hypot(mx,my)||1;tx=u.x+mx/m;ty=u.y+my/m;
 }else{
  u.wpT=(u.wpT===undefined?Math.random()*0.25:u.wpT)-dt;
  if((!u.wp||u.wpT<=0||!u.wpG||Math.hypot(u.wpG.x-goal.x,u.wpG.y-goal.y)>1||Math.hypot(u.wp.x-u.x,u.wp.y-u.y)<0.6)&&(!u.wp||planBudget>0)){planBudget--;u.wp=waypoint(u,goal);u.wpG={x:goal.x,y:goal.y};u.wpT=0.25;}
  tx=u.wp.x;ty=u.wp.y;}
 for(const w of warns){const dx=u.x-w.x,dy=u.y-w.y,d=Math.hypot(dx,dy);if(d<w.r+R+0.4){const k=d||1;tx=u.x+(d?dx/k:1)*2;ty=u.y+(d?dy/k:0)*2;break;}}
 const vx=tx-u.x,vy=ty-u.y,vm=Math.hypot(vx,vy);
 if(vm>0.15){const k=STAT.speed*0.85*spdMult(u)*(u.sup?0.6:1)*slowAt(u)*dt;u.x+=vx/vm*k;u.y+=vy/vm*k;}
 push(u);
}

// ---- shared helpers for the objective modes ----
const MODE_TIP={crystal:'Grab crystals at the mine. Hold 10 for 15s to win',bounty:'Kills earn stars. Hunt the big bounties',royale:'Last tank standing wins. Stay inside the ring'};
// a random open spot within rad of (cx,cy): clear of walls, rocks and ramps. Bridge decks count as level 1 unless ground is set
function freeSpot(cx,cy,rad,ground){
 for(let k=0;k<80;k++){
  const a=Math.random()*6.283,dd=Math.sqrt(Math.random())*rad,x=cx+Math.cos(a)*dd,y=cy+Math.sin(a)*dd;
  if(x<R+0.3||x>W-R-0.3||y<R+0.3||y>H-R-0.3||rampAt(x,y))continue;
  const deck=inDeck(x,y)&&!inTunnel(x,y);
  if(deck&&(ground||!upOk(x,y)))continue;
  if(baseWalls.some(([rx,ry,rw,rh])=>x>rx-R-0.1&&x<rx+rw+R+0.1&&y>ry-R-0.1&&y<ry+rh+R+0.1))continue;
  if(rocks.some(([rx,ry,rr2])=>Math.hypot(x-rx,y-ry)<rr2+R+0.15))continue;
  if(!deck&&walls.some(([rx,ry,rw,rh])=>x>rx-R-0.1&&x<rx+rw+R+0.1&&y>ry-R-0.1&&y<ry+rh+R+0.1))continue;
  return {x,y,l:deck?1:0};
 }
 return null;
}
const groundOk=(x,y)=>x>R*0.6&&x<W-R*0.6&&y>R*0.6&&y<H-R*0.6&&!walls.some(([rx,ry,rw,rh])=>x>rx-R*0.6&&x<rx+rw+R*0.6&&y>ry-R*0.6&&y<ry+rh+R*0.6)&&!rocks.some(([cx,cy,cr])=>Math.hypot(x-cx,y-cy)<cr+R*0.6);

// ---- Crystal Rush: a crystal appears at the mine every 6s. A team holding 10+ (and more than the other team) for 15s wins.
// Destroyed tanks drop everything they carry. At the time limit, the team holding more crystals wins.
const CRY_GOAL=10,CRY_HOLD=15,CRY_EVERY=6,CRY_MAX=10,CRY_PICK=R+0.45,CRY_MINE_R=3.2;
let cry=null;   // {mine, loose:[{x,y,l,age}], t: next spawn, cd: {team,t} countdown, cnt: [held by team 0, team 1]}
function crystalTick(dt){
 const C=cry;C.t-=dt;
 if(C.t<=0){C.t=CRY_EVERY;if(C.loose.length<CRY_MAX){const p=freeSpot(C.mine.x,C.mine.y,CRY_MINE_R);if(p)C.loose.push({x:p.x,y:p.y,l:p.l,age:0});}}
 for(const c of C.loose)c.age+=dt;
 for(const u of units){
  if(u.hp<=0)continue;
  for(let i=C.loose.length-1;i>=0;i--){const c=C.loose[i];
   if((u.elev||0)!==c.l||Math.hypot(u.x-c.x,u.y-c.y)>CRY_PICK||c.age<0.4)continue;
   C.loose.splice(i,1);u.cry=(u.cry||0)+1;
   if(u.isPlayer){if(mstat)mstat.cry++;if(typeof fx==='function')fx('crystal');}
  }
 }
 const n=[0,0];for(const u of units)if(u.hp>0)n[u.team]+=u.cry||0;C.cnt=n;
 const lead=n[0]>=CRY_GOAL&&n[0]>n[1]?0:n[1]>=CRY_GOAL&&n[1]>n[0]?1:-1;
 if(lead<0){if(C.cd){pop(C.mine.x,C.mine.y-1.5,'COUNTDOWN STOPPED','#c9d6e3');C.cd=null;}}
 else if(!C.cd||C.cd.team!==lead){C.cd={team:lead,t:CRY_HOLD};banner={t:2.6,txt:lead===0?'Hold on for 15 seconds to win':'Enemy countdown! Destroy their carriers',c:lead===0?'#5fe3a1':'#ff6b5e'};if(typeof fx==='function')fx('event');}
 else C.cd.t-=dt;
 gscore=n;
}
function dropCrystals(u){
 const n=u.cry||0;u.cry=0;if(!n)return;
 const l=u.elev||0;
 for(let i=0;i<n;i++){let p=null;
  for(let k=0;k<10&&!p;k++){const a=Math.random()*6.283,dd=0.5+Math.random()*1.3,x=u.x+Math.cos(a)*dd,y=u.y+Math.sin(a)*dd;if(l===1?upOk(x,y):groundOk(x,y))p={x,y};}
  cry.loose.push({x:p?p.x:u.x,y:p?p.y:u.y,l,age:0});
 }
 pop(u.x,u.y-1.2,n+(n>1?' CRYSTALS DROPPED':' CRYSTAL DROPPED'),'#c79bff');
}
function crystalGoal(u,tgt,seen,d){   // where a bot goes in Crystal Rush (null = just fight)
 const C=cry,mine=C.cd&&C.cd.team===u.team;
 if(C.cd&&!mine)return null;   // their countdown: botTarget already picked their best carrier
 if((u.cry||0)>0&&mine){   // our countdown: carriers fall back and stay alive
  if(seen&&d<4.2)return null;
  return {x:u.sx,y:u.sy,l:0};
 }
 let nc=null,nd=1e9;for(const c of C.loose){const dd=dist2(u,c)+(c.l!==(u.elev||0)?3:0);if(dd<nd){nd=dd;nc=c;}}
 if(nc&&!(seen&&d<3.5&&nd>2))return {x:nc.x,y:nc.y,l:nc.l};
 if(!nc&&!(seen&&d<6)){if(!u.ms)u.ms=freeSpot(C.mine.x,C.mine.y,CRY_MINE_R+0.8)||{x:C.mine.x,y:C.mine.y+3.5,l:0};return u.ms;}   // wait at the mine for the next one
 return null;
}

// ---- Bounty: every tank starts with a 2-star bounty. A kill pays the killer's team that bounty and raises the killer's by 1 (7 at most).
// Dying resets yours to 2. Most stars when time runs out wins.
const BTY_START=2,BTY_MAX=7;
function bountyKill(r,src){
 const v=r.bty||BTY_START;r.bty=BTY_START;
 if(!src||src.team===r.team)return;
 gscore[src.team]+=v;src.bty=Math.min(BTY_MAX,(src.bty||BTY_START)+1);
 pop(r.x,r.y-1.6,'+'+v+' STARS',tcol(src.team));
 if(src.isPlayer&&mstat)mstat.stars+=v;
 if(src.bty===BTY_MAX&&v<BTY_MAX)feedPush((src.isPlayer?'You have':src.name+' has')+' the top bounty: 7 stars','#ffcf4a');
}
// who a bot wants to fight: the nearest enemy, unless the mode gives it a better target
function botTarget(u){
 if(cry&&cry.cd&&cry.cd.team!==u.team){let best=null,bc=0;for(const v of units)if(v.team===cry.cd.team&&v.hp>0&&(v.cry||0)>bc){bc=v.cry;best=v;}if(best)return best;}   // stop their countdown: hunt the carrier
 if(matchG==='bounty'){let best=null,bs=-1e9;for(const v of units){if(v.team===u.team||v.hp<=0)continue;const s=(v.bty||BTY_START)*1.5-dist2(u,v)*0.5;if(s>bs){bs=s;best=v;}}if(best)return best;}   // a big bounty is worth a detour
 return nearestFoe(u);
}

// ---- Last Standing: 6 tanks, free for all, no respawns. The ring closes from 15s to 95s; outside it you lose 4% health a second.
// Every wreck drops a box. Your match ends when you're destroyed; at the time limit, places go by health left.
const STORM_T0=15,STORM_T1=95,STORM_R0=22,STORM_R1=2.5,STORM_DMG=0.04;
const ROYALE_SPAWN=[[10,28],[10,4],[4,10],[16,22],[4,22],[16,10]];
let storm=null;   // {x,y,l,r}
function royaleSpawns(){return ROYALE_SPAWN.map(([x,y],i)=>i===0?{x,y}:(freeSpot(x,y,2.5,true)||freeSpot(x,y,6,true)||{x:10,y:i%2?5:27}));}
function stormTick(dt){
 const S=storm,k=Math.max(0,Math.min(1,(elapsed-STORM_T0)/(STORM_T1-STORM_T0)));
 S.r=STORM_R0+(STORM_R1-STORM_R0)*k;
 if(!S.warned&&elapsed>=STORM_T0-3){S.warned=true;banner={t:2.6,txt:'The ring is closing. Stay inside it',c:'#c79bff'};if(typeof fx==='function')fx('event');}
 S.tk+=dt;
 if(S.tk>=0.5){S.tk-=0.5;
  for(const u of units)if(u.hp>0&&Math.hypot(u.x-S.x,u.y-S.y)>S.r){const dm=u.mhp*STORM_DMG*0.5;takeHit(u,dm,null,'storm');nums.push({x:u.x,y:u.y-R,t:0.7,z:0.8,txt:'STORM '+Math.round(dm),c:'#c79bff'});}
 }
}
function royaleGoal(u,tgt,seen,d){   // where a bot goes in Last Standing (null = just fight)
 const S=storm,dc=Math.hypot(u.x-S.x,u.y-S.y),inner=Math.max(1.2,Math.min(4,S.r-2.5));
 if(dc>S.r-1.8){   // outside, or the ring is about to pass you: head for the middle
  if(!u.sg||Math.hypot(u.sg.x-S.x,u.sg.y-S.y)>inner+0.3)u.sg=freeSpot(S.x,S.y,inner)||{x:S.x,y:S.y,l:S.l};
  return u.sg;
 }
 let nb=null,nd=elapsed<STORM_T0?12:6;for(const bx of boxes){const dd=dist2(u,bx);if(dd<nd&&Math.hypot(bx.x-S.x,bx.y-S.y)<S.r-1){nd=dd;nb=bx;}}
 if(nb&&!(seen&&d<3.5))return nb;
 return null;
}
function royalePlace(){   // 1 = winner
 const alive=units.filter(u=>u.hp>0);
 if(me.hp<=0)return Math.min(units.length,alive.length+1);
 if(alive.length<=1)return 1;
 const f=me.hp/me.mhp;return 1+alive.filter(u=>u!==me&&u.hp/u.mhp>f).length;
}

// ---- update ----
function update(dt){
 if(banner&&state==='play'){banner.t-=dt;if(banner.t<=0)banner=null;}
 if(shakeT>0){shakeT-=dt;if(shakeT<=0)shakeM=0;}
 if(state!=='play')return;
 if(me.hp>0){   // dead players spectate their team
  if(!dashStep(me,dt)){const [ix,iy]=inputVec();
   const k=STAT.speed*spdMult(me)*(me.sup?0.6:1)*slowAt(me)*dt;me.x+=ix*k;me.y+=iy*k;push(me);}
 }
 me.hurtT=Math.max(0,(me.hurtT||0)-dt);
 for(const f of feed)f.t-=dt;if(feed.length&&feed[0].t<=0)feed.shift();
 planBudget=2;   // at most two bots re-plan their route per frame
 for(const u of units)if(!u.isPlayer&&u.hp>0)botAI(dt,u);
 boxTick(dt);heading(dt);superTick(dt);
 for(const u of units)turret(u,dt);
 moveBullets(dt);
 for(const u of units)u.flash=Math.max(0,u.flash-dt);
 for(const c of crates)c.flash=Math.max(0,(c.flash||0)-dt);
 timeLeft-=dt;elapsed+=dt;eventTick(dt);
 if(gzones){zoneTick(dt);respawnTick(dt);if(gscore[0]>=ZONE_WIN||gscore[1]>=ZONE_WIN||timeLeft<=0)endMatch();}
 else if(cry){crystalTick(dt);respawnTick(dt);if((cry.cd&&cry.cd.t<=0)||timeLeft<=0)endMatch();}
 else if(matchG==='bounty'){respawnTick(dt);if(timeLeft<=0)endMatch();}
 else if(storm){stormTick(dt);if(me.hp<=0||units.filter(u=>u.hp>0).length<=1||timeLeft<=0)endMatch();}
 else if(aliveCount(0)===0||aliveCount(1)===0||timeLeft<=0){if(series)endRound();else endMatch();}
}
// ---- events ----
function eventTick(dt){
 if(!evt&&evtAt&&elapsed>=evtAt){evtAt=0;startEvent(evtKind);}
 if(evt){evt.t-=dt;
  if(evt.k==='meteor'){evt.next-=dt;if(evt.next<=0&&evt.t>1.3){evt.next=0.55+Math.random()*0.35;meteorWarn();}}
  if(evt.t<=0)evt=null;}
 for(const w of warns){w.t-=dt;if(w.t<=0)meteorHit(w);}
 if(warns.length)warns=warns.filter(w=>w.t>0);
}
function startEvent(k){
 const E=EVENTS[k];banner={t:3.2,txt:E.txt,c:E.c};if(typeof fx==='function')fx('event');
 if(k==='drop'){evt={k,t:3};for(let i=0;i<3;i++)dropBoxNear(10+(Math.random()-0.5)*6,16+(Math.random()-0.5)*7);}
 else if(k==='meteor')evt={k,t:10,next:0.9};
 else evt={k,t:20};
}
function dropBoxNear(x0,y0){
 for(let i=0;i<80;i++){
  const x=Math.max(1.5,Math.min(W-1.5,x0+(Math.random()-0.5)*4)),y=Math.max(1.5,Math.min(H-1.5,y0+(Math.random()-0.5)*4));
  if(walls.some(([rx,ry,rw,rh])=>x>rx-1&&x<rx+rw+1&&y>ry-1&&y<ry+rh+1)||rocks.some(([cx,cy,cr])=>Math.hypot(x-cx,y-cy)<cr+1)||boxes.some(b=>Math.hypot(b.x-x,b.y-y)<2))continue;
  boxes.push({x,y,life:22,age:0});pop(x,y,'SUPPLY DROP','#ffd24a');return;
 }
}
function meteorWarn(){
 const alive=units.filter(u=>u.hp>0);let x,y;
 if(alive.length&&Math.random()<0.6){const u=alive[(Math.random()*alive.length)|0];x=u.x+(Math.random()-0.5)*4;y=u.y+(Math.random()-0.5)*4;}
 else{x=2+Math.random()*(W-4);y=4+Math.random()*(H-8);}
 warns.push({x:Math.max(1,Math.min(W-1,x)),y:Math.max(1,Math.min(H-1,y)),r:1.6,t:1.3,t0:1.3});if(typeof fx==='function')fx('warn');
}
function meteorHit(w){
 blasts.push({x:w.x,y:w.y,r:w.r*1.25,t:0.5,t0:0.5,c:'#ff8a3d'});if(typeof fx==='function')fx('meteor');blasts.push({x:w.x,y:w.y,r:w.r*0.6,t:0.3,t0:0.3,c:'#ffe08a'});shake(7,0.35);
 for(const u of units){
  if(u.hp<=0||underDeck(u))continue;
  if(Math.hypot(u.x-w.x,u.y-w.y)<w.r+R*0.5){const d=METEOR_DMG*(1-armor(u));takeHit(u,d,null);nums.push({x:u.x,y:u.y-R,t:0.9,z:1.6,txt:'METEOR '+Math.round(d),c:'#ff8a3d'});}
 }
 hitCratesNear(w.x,w.y,w.r,METEOR_DMG);
}
// ---- best-of-3 rounds ----
function roundWinner(){
 const a0=aliveCount(0),a1=aliveCount(1);
 if(a1===0&&a0>0)return 0;if(a0===0&&a1>0)return 1;if(a0===0&&a1===0)return -1;
 const f0=teamHpFrac(0),f1=teamHpFrac(1);return f0>f1?0:f1>f0?1:-1;
}
function rebuildBot(u,cls){   // same pilot, different chassis
 const f=u.mhp/CH[u.cls].hp;
 u.cls=cls;u.mhp=Math.round(f*CH[cls].hp);u.hp=u.mhp;u.spdM=CH[cls].spd;u.turnM=CH[cls].turn;u.dscale=CH[cls].ds;
}
function endRound(){
 const w=roundWinner();if(w>=0)series.w[w]++;
 series.last=w;
 if(series.w[0]>=2||series.w[1]>=2||series.round>=5){endMatch({won:series.w[0]>series.w[1],drawn:series.w[0]===series.w[1]});return;}
 series.round++;state='round';ffwd=false;
 const foe=units.find(u=>u.team===1);
 // the AI may switch to the chassis that counters yours (never against brand-new pilots); you get to answer before the round starts
 if(foe&&(save.mp||0)>=10&&Math.random()<0.5){const c=beatenBy(me.cls);if(c&&c!==foe.cls)rebuildBot(foe,c);}
 if(typeof fx==='function')fx(w===0?'win':w===1?'lose':'draw');
 const info={won:w===0,lost:w===1,w:series.w.slice(),round:series.round,foe:foe?foe.cls:null};
 if(typeof onRoundEnd==='function')setTimeout(()=>onRoundEnd(info),700);
}
function startRound(){
 if(!series||state!=='round')return;
 setMap(curMap);   // fresh crates
 bullets=[];boxes=[];pops=[];nums=[];beams=[];shells=[];blasts=[];novas=[];warns=[];feed=[];shakeT=0;shakeM=0;sidx=0;sched=boxSchedule();timeLeft=ROUND_T;elapsed=0;ffwd=false;
 me=units[0];
 for(const u of units){u.x=u.sx;u.y=u.sy;u.px=u.x;u.py=u.y;u.ox=u.x;u.oy=u.y;u.elev=0;u.hp=u.mhp;u.buffs=[];u.sp=0;u.sup=null;u.flash=0;u.trail=[];u.wp=null;u.lk=null;u.cd=0.5;
  u.ang=u.team===0?-Math.PI/2:Math.PI/2;u.hd=u.ang;u.rdyShown=false;u.dash=null;u.dashCd=0;u.hurtT=0;if(u.brain){u.brain.mode='press';u.brain.t=1.5;u.brain.spot=null;u.brain.out=false;}}
 const {adv,dis}=matchup();
 banner={t:2.4,txt:'Round '+series.round+(adv&&!dis?': you counter them':dis&&!adv?': they counter you':''),c:adv&&!dis?'#5fe3a1':dis&&!adv?'#ff6b5e':'#ffcf4a'};
 state='play';
 if(typeof onRoundStart==='function')onRoundStart();
}
let lastResult=null;
function endMatch(forced){
 state='over';endAt=performance.now();ffwd=false;evt=null;warns=[];
 for(const u of units)u.hp=Math.max(0,u.hp);
 const a0=aliveCount(0),a1=aliveCount(1),ko=a0===0||a1===0;
 let won=a1===0||(timeLeft<=0&&a0>a1)||(timeLeft<=0&&a0===a1&&teamHpFrac(0)>teamHpFrac(1));
 let drawn=!won&&!ko&&timeLeft<=0&&a0===a1&&teamHpFrac(0)===teamHpFrac(1);
 const score=[Math.floor(gscore[0]),Math.floor(gscore[1])];
 let place=0;
 if(gzones||cry||matchG==='bounty'){drawn=score[0]===score[1];won=!drawn&&score[0]>score[1];}
 if(cry&&cry.cd&&cry.cd.t<=0){won=cry.cd.team===0;drawn=false;}
 if(storm){place=royalePlace();won=place===1;drawn=false;}
 if(forced){won=forced.won;drawn=forced.drawn;}
 const mk=modeKey(),M=MODES[mk],feat=matchG===featuredMode(),top3=!!storm&&place<=3;
 if(won)save.streak=(save.streak||0)+1;else if(!drawn&&!top3)save.streak=0;   // Last Standing: 2nd and 3rd keep your streak
 const streak=save.streak||0,sb=won?Math.min(streak,5)*20:0;
 const brk=powerBracket(calcPower()),zx=storm?1:matchG==='arena'?(series?SERIES_X:1):GTYPES[matchG].x[mk],fxm=feat?FEATURED_X:1;
 const base=Math.round(storm?ROYALE_PTS[place-1]:(won?M.win:drawn?M.draw:M.loss)*zx);
 const pts=Math.round(base*fxm*brk.mult)+sb;
 if(won)save.wins=(save.wins||0)+1;else if(!drawn&&!top3)save.losses=(save.losses||0)+1;
 save.mp=(save.mp||0)+1;
 const before=save.earned||0;
 const awarded=awardPts(pts)||0;
 passXP((won?PASS_XP_WIN:drawn||top3?PASS_XP_DRAW:PASS_XP_LOSS)+(feat?PASS_XP_FEAT:0));
 // milestone + daily quest progress
 const wasDone={};QUESTS.forEach(q=>wasDone[q.id]=!!(save.q[q.id]&&save.q[q.id].done));
 qp('q_win1',won?1:0);qp('q_win3',won?1:0);
 qp('q_dmg',mstat.dmg,true);qp('q_super',mstat.sup,true);qp('q_box',mstat.box,true);
 if(won&&mstat.taken<600)qp('q_clean',1);
 const dqBefore=dailyQuests().filter(q=>q.done).map(q=>q.id);
 dqProgress({wins:won?1:0,plays:1,dmg:Math.round(mstat.dmg),boxes:mstat.box,sups:mstat.sup,kills:mstat.kills,zoneWins:won&&matchG==='zone'?1:0,teamWins:won&&M.n>1&&!storm?1:0,caps:mstat.caps,overpass:curMap==='overpass'?1:0,
  crystals:mstat.cry,stars:mstat.stars,top3:top3?1:0,featured:feat?1:0});
 const dqNew=dailyQuests().filter(q=>q.done&&!dqBefore.includes(q.id));
 const milestones=QUESTS.filter(q=>!wasDone[q.id]&&save.q[q.id]&&save.q[q.id].done);
 lastResult={won,drawn,mode:mk,gtype:matchG,map:curMap,score,base,modeX:zx,featured:feat,featX:fxm,place,league:brk,leagueMult:brk.mult,streak,streakBonus:sb,pts,awarded,capped:awarded<pts,
  before,after:save.earned||0,stats:{dmg:Math.round(mstat.dmg),kills:mstat.kills,boxes:mstat.box,sups:mstat.sup,taken:Math.round(mstat.taken),cry:mstat.cry,stars:mstat.stars},
  quests:milestones.map(q=>q.n).concat(dqNew.map(q=>q.t)),countered:matchup().dis>0&&!won&&!storm,meCls:me.cls,series:series?{w:series.w.slice()}:null};
 store();
 if(typeof fx==='function')fx(won?'win':drawn?'draw':'lose');
 if(typeof onMatchEnd==='function')setTimeout(()=>onMatchEnd(lastResult),won?650:900);
}

