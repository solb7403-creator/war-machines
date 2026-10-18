'use strict';
// =====================================================================
// game: maps, units, physics, combat, supers, AI, Moon Zone, match flow
// (pure simulation: rendering lives in render.js, menus in ui.js)
// =====================================================================
const W=20,H=32,R=0.7,MATCH=180;
const TC=['#4d9fff','#ff4d5e'];   // team colors in battle: blue (your team) vs red (foes)
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
// Map definitions
const MAPS={
 classic:{
  n:'Classic Arena',d:'Balanced cover',
  walls:[[8,14.5,4,3],[3,9,3,2],[14,21,3,2],[12,8,2,3],[6,21,2,3]]
 },
 overpass:{
  n:'Overpass',d:'Bridge with ramps and tunnels',
  walls:[[2,6,2,2],[16,6,2,2],[2,24,2,2],[16,24,2,2]],
  // deck [x,y,w,h]; tunnels [x,width] run under it; ramps [x,y,w,h,openEnd(-1 top/+1 bottom)]
  bridge:{deck:[2,13.5,16,5],tunnels:[[5.8,2.4],[11.8,2.4]],
   ramps:[[3,10.5,2.5,3,-1],[14.5,10.5,2.5,3,-1],[3,18.5,2.5,3,1],[14.5,18.5,2.5,3,1]]}
 },
 longshot:{
  n:'Longshot',d:'Narrow alley, long sight lines',
  // constricted sides + central energy pylon with gaps
  walls:[[0,0,4,32],[16,0,4,32],[7,10,6,2],[7,20,6,2],[9,14.5,2,3]],
  narrow:true
 },
 random:{
  n:'Random',d:'Surprise me',
  walls:[],isRandom:true
 }
};
let curMap='classic';
let walls=MAPS.classic.walls;
const MAP_REAL=['classic','overpass','longshot'];
const mapKey=()=>(save.map&&MAPS[save.map])?save.map:'classic';   // the player's pick (may be 'random'); the real map is chosen at match start
function setMap(id){
 if(!MAPS[id]||MAPS[id].isRandom)id=MAP_REAL[(Math.random()*MAP_REAL.length)|0];
 curMap=id;baseWalls=MAPS[id].walls;BR=MAPS[id].bridge||null;walls=baseWalls.slice();
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
// game types: ARENA (destroy the enemy) and MOON ZONE (hold zones to score; 1 zone in 1v1, 3 zones in team modes)
const GTYPES={arena:{label:'Arena',d:'Destroy the enemy team'},zone:{label:'Moon Zone',d:'Hold the moving zone. First to 100.'}};
const GT_PICK={...GTYPES,random:{label:'Random',d:'Arena or Moon Zone'}};   // what the selector shows; Random resolves at match start
const gtypeKey=()=>(save.gtype&&GT_PICK[save.gtype])?save.gtype:'arena';
let matchG='arena';
function winPoints(gk,mk){const M=MODES[mk],x=gk==='zone'?ZONE_X[mk]:gk==='random'?1:1;return Math.round(M.win*x*powerBracket(calcPower()).mult);}
// One zone that jumps to a random spot every 20-28s (6s warning shows where it goes next).
// Score while you hold it uncontested, +5 per kill, respawn gets longer each death, tanks repair when out of combat.
const ZONE_R=2.8,ZONE_WIN=100,CAP_RATE=0.55,RESPAWN_T=4,ZONE_RATE=2.4,KILL_PTS=5,ZONE_WARN=6,REPAIR_DELAY=3.5,REPAIR_RATE=0.07;
let gzones=null,gscore=[0,0];
const respawnFor=u=>Math.min(9,RESPAWN_T+1.5*Math.max(0,(u.deaths||1)-1));
function zoneSpot(avoid){
 for(let k=0;k<80;k++){
  const x=3+Math.random()*14,y=8.5+Math.random()*15;
  if(avoid&&Math.hypot(x-avoid.x,y-avoid.y)<7)continue;
  if(baseWalls.some(([rx,ry,rw,rh])=>x>rx-1.2&&x<rx+rw+1.2&&y>ry-1.2&&y<ry+rh+1.2))continue;
  if(rampAt(x,y))continue;
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
 for(const u of units){
  if(u.hp>0){   // out-of-combat repair: pull back, heal up, come back
   u.calm=(u.calm||0)+dt;
   const zz=gzones[0],inZ=Math.hypot(u.x-zz.x,u.y-zz.y)<zz.r;   // no repairs while standing on the zone: holding it costs you
   if(u.calm>REPAIR_DELAY&&u.hp<u.mhp&&!inZ){u.hp=Math.min(u.mhp,u.hp+u.mhp*REPAIR_RATE*dt);u.rep=0.3;}else u.rep=Math.max(0,(u.rep||0)-dt);
   continue;
  }
  u.dead=(u.dead||0)+dt;
  if(u.dead>=respawnFor(u)){u.dead=0;u.hp=u.mhp;u.x=u.sx;u.y=u.sy;u.px=u.x;u.py=u.y;u.elev=0;u.ox=u.x;u.oy=u.y;u.buffs=[];u.sup=null;u.flash=0;u.trail=[];u.calm=0;
   if(u.brain){u.brain.mode='press';u.brain.t=1;u.brain.spot=null;}
   pop(u.x,u.y-1,u.isPlayer?'BACK IN THE FIGHT':'RESPAWNED',TC[u.team]);}
 }
}
// where a bot wants to be in Moon Zone: rotate early to the next spot, otherwise hold a point inside the zone
function botZoneGoal(u){
 const z=gzones[0];
 const holding=z.own===u.team&&!(u.team===0?z.p1:z.p0);
 const tgt=z.next&&(!holding||z.t<2.5)?z.next:z;
 const rr=(z.next&&tgt===z.next)?0.3:ZONE_R*0.45;
 let p=clampP(tgt.x+Math.cos(u.zo||0)*rr,tgt.y+Math.sin(u.zo||0)*rr);
 if(baseWalls.some(([x,y,w,h])=>p.x>x-R&&p.x<x+w+R&&p.y>y-R&&p.y<y+h+R)||rampAt(p.x,p.y)||(!inDeck(p.x,p.y)&&walls.some(([x,y,w,h])=>p.x>x-R&&p.x<x+w+R&&p.y>y-R&&p.y<y+h+R))){u.zo=Math.random()*6.28;p={x:tgt.x,y:tgt.y};}
 p.l=ptLevel(p);
 return p;
}
let units=[];   // all tanks in the current match; me is units[0] (team 0)
const BOX_COUNT=5;
const foesOf=u=>units.filter(v=>v.team!==u.team&&v.hp>0);
const aliveCount=t=>units.filter(u=>u.team===t&&u.hp>0).length;
function teamHpFrac(t){const us=units.filter(u=>u.team===t);const m=us.reduce((a,u)=>a+u.mhp,0);return m?us.reduce((a,u)=>a+u.hp,0)/m:0;}
function nearestFoe(u){let best=null,bd=1e9;for(const v of units){if(v.team===u.team||v.hp<=0)continue;const d=Math.hypot(v.x-u.x,v.y-u.y);if(d<bd){bd=d;best=v;}}return best;}
function buildMe(){
 const U=save.up,W0=getW(save.weapon),Cc=getC(save.chassis),skin=save.skin==='lunar'?1.08:1,n=MODES[modeKey()].n;
 const m={x:10,y:28,flash:0,ang:-Math.PI/2,cd:0.3,lk:null,buffs:[],gems:(save.cores||[]).filter(Boolean),gemM:Object.fromEntries(GORDER.map(k=>[k,gemMult(k)])),sp:0,sup:null,
  mhp:Math.round(STAT.hp*(1+0.08*U.hull)*Cc.hp*skin*n),dmgM:(1+0.08*U.cannon)*skin,spdM:(1+0.06*U.engine)*Cc.spd,
  critB:0.02*U.target,fillM:1+0.10*U.reactor,turnM:Cc.turn,team:0,isPlayer:true,
  wtype:W0.arch,wdps:W0.dps,wshot:W0.shot,wpspd:W0.pspd,wtier:W0.tier,wmult:W0.mult,dscale:Cc.size,cls:save.chassis,name:IN_TG?tgName(TG_USER):'You'};
 m.hp=m.mhp;return m;
}
const BOT_NAMES=['Rust','Vex','Kilo','Nyx','Bolt','Ion','Echo','Grit','Onyx','Rook','Volt','Zed','Hex','Juno','Mako','Pike'];
// pick the map, mode and bots; the VS screen shows them before the fight starts
function prepareMatch(){
 {const pk=mapKey();setMap(pk==='random'?MAP_REAL[(Math.random()*MAP_REAL.length)|0]:pk);}
 {const gk=gtypeKey(),real=Object.keys(GTYPES);matchG=gk==='random'?real[(Math.random()*real.length)|0]:gk;}
 me=buildMe();
 const W0=getW(save.weapon),Cc=getC(save.chassis);
 const bwm=W0.mult||TIER_MULT[Math.max(0,W0.tier)],bcm=Cc.mult||TIER_MULT[Math.max(0,Cc.tier)];
 const modeN=MODES[modeKey()].n,mp=save.mp||0;
 const names=BOT_NAMES.slice().sort(()=>Math.random()-0.5);
 // AI tank factory (allies and enemies mirror your gear level and cores)
 const mkBot=(team,x,y)=>{
  const bwA=WORDER[(Math.random()*3)|0];
  // brand-new pilots (first 10 matches) never face a chassis that counters theirs
  const cls=team===1&&mp<10?CHORDER.filter(c=>COUNTER[c]!==me.cls):CHORDER;
  const bcC=cls[(Math.random()*cls.length)|0];
  const pScale=(team===1&&mp<3?0.8:0.92)+Math.random()*0.16;   // first 3 matches: gentler enemies
  const u={x,y,flash:0,ang:team===0?-Math.PI/2:Math.PI/2,cd:0.5,lk:null,buffs:[],gems:me.gems.slice(),gemM:Object.assign({},me.gemM),sp:0,sup:null,
   mhp:Math.round(STAT.hp*CH[bcC].hp*bcm*pScale*modeN),dmgM:1,spdM:CH[bcC].spd,critB:0,fillM:1,turnM:CH[bcC].turn,
   wtype:bwA,wdps:Math.round(WEAPONS[bwA].dps*bwm*pScale),wshot:WEAPONS[bwA].shot,wpspd:22,wtier:W0.tier,dscale:CH[bcC].ds,cls:bcC,
   team,isPlayer:false,name:names.pop()||'Bot',brain:{mode:'press',t:2,spot:null,out:false,w:0,side:1,age:0,hideCd:0},strafe:1,strafeT:1.5};
  u.hp=u.mhp;return u;
 };
 units=[me];
 for(let i=1;i<modeN;i++)units.push(mkBot(0,i===1?6:14,26));   // your AI teammates
 for(let i=0;i<modeN;i++)units.push(mkBot(1,i===0?10:(i===1?6:14),i===0?4:6));   // the enemy team
 state='vs';
}
// switch chassis on the VS screen (counter-pick): rebuild your tank with the best owned version of that class
function switchChassis(cls){
 if(!ownedChassisClasses().includes(cls))return;
 save.chassis=cls;store();
 const keep={x:me.x,y:me.y};me=buildMe();Object.assign(me,keep);units[0]=me;
}
function matchup(){   // how your chassis fares against the enemy lineup
 const foes=units.filter(u=>u.team===1),adv=foes.filter(f=>COUNTER[me.cls]===f.cls).length,dis=foes.filter(f=>COUNTER[f.cls]===me.cls).length;
 return {adv,dis,foes};
}
function startMatch(){
 mstat={dmg:0,sup:0,box:0,taken:0,kills:0,caps:0};
 {const {adv,dis}=matchup();
  banner=null;if(adv||dis)banner={t:3,txt:adv&&!dis?'You counter them: +15% damage':dis&&!adv?'Countered: '+CH[beatenBy(me.cls)].n+' beats '+CH[me.cls].n:'Mixed matchup',c:adv&&!dis?'#5fe3a1':dis&&!adv?'#ff6b5e':'#ffcf4a'};}
 bullets=[];timeLeft=MATCH;state='play';
 gscore=[0,0];gzones=null;
 units.forEach(u=>{u.sx=u.x;u.sy=u.y;u.dead=0;u.deaths=0;u.calm=0;u.zo=Math.random()*6.28;u.elev=0;u.ox=u.x;u.oy=u.y;});
 if(matchG==='zone'){const c=zoneSpot(null);gzones=[{x:c.x,y:c.y,r:ZONE_R,cap:0,own:-1,p0:0,p1:0,t:22+Math.random()*6,next:null,moves:0}];}
 boxes=[];sidx=0;pops=[];nums=[];beams=[];shells=[];blasts=[];novas=[];shakeT=0;shakeM=0;sched=[];{let tt=0;for(let i=0;i<BOX_COUNT;i++){tt+=i===0?5+Math.random()*3:15+Math.random()*15;sched.push(tt);}}   // first box lands early so every match has one
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
    else if(upOk(b.x,b.oy))b.y=b.oy;else if(upOk(b.ox,b.y))b.x=b.ox;else{b.x=b.ox;b.y=b.oy;}   // deck edge: slide along it
   }
   if(b.elev===1){b.ox=b.x;b.oy=b.y;return;}
  }else if(rampAt(b.x,b.y)&&!inDeck(b.x,b.y))b.elev=1;     // drove onto a ramp
  if(b.elev===1){b.ox=b.x;b.oy=b.y;return;}
 }
 b.elev=0;
 for(const [x,y,w,h] of walls){
  const cx=Math.max(x,Math.min(b.x,x+w)),cy=Math.max(y,Math.min(b.y,y+h));
  let dx=b.x-cx,dy=b.y-cy,d=Math.hypot(dx,dy);
  if(d<R){if(d===0){dx=0;dy=-1;d=1;}b.x+=dx/d*(R-d);b.y+=dy/d*(R-d);}
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
function losW(a,b,wl){
 for(const [rx,ry,rw,rh] of wl)if(segHitsRect(a.x,a.y,b.x,b.y,rx,ry,rw,rh))return false;
 return true;
}
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
 const b=nearestFoe(a);
 if(!b||a.hp<=0)return;
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
  a.cd=a.wshot/rofMult(a);
  bullets.push({x:a.x,y:a.y,hi:(a.elev||0)===1||(b.elev||0)===1,vx:Math.cos(a.ang)*a.wpspd,vy:Math.sin(a.ang)*a.wpspd,o:a,dps:a.wdps,shot:a.wshot,dm:dmgMult(a),life:(STAT.range+1)/a.wpspd});
 }
}
function moveBullets(dt){
 for(const q of bullets){
  for(let k=0;k<2&&q.life>0;k++){
   q.x+=q.vx*dt/2;q.y+=q.vy*dt/2;
   for(const [rx,ry,rw,rh] of (q.hi?baseWalls:walls))if(q.x>rx&&q.x<rx+rw&&q.y>ry&&q.y<ry+rh)q.life=0;
   if(q.x<0||q.x>W||q.y<0||q.y>H)q.life=0;
   let t=null,bd=1e9;
   for(const v of units){if(v.team===q.o.team||v.hp<=0)continue;if(q.hi?underDeck(v):(v.elev||0)!==0)continue;const d=Math.hypot(q.x-v.x,q.y-v.y);if(d<R+0.12&&d<bd){bd=d;t=v;}}
   if(q.life>0&&t){const sp=Math.hypot(q.vx,q.vy)||1,off=Math.abs((t.x-q.x)*q.vy-(t.y-q.y)*q.vx)/sp,direct=off<DIRECT;
   const owner=q.o,isCrit=direct&&Math.random()<CRIT_BASE+bsum(owner,'lck')+gsum(owner,'lck')+(owner.critB||0);
   const dmg=q.dps*q.shot*q.dm*(1-armor(t))*(direct?(isCrit?CRIT_MULT:1):GRAZE)*cmult(owner,t);
   takeHit(t,dmg,owner);owner.sp=Math.min(SUPER_MAX,owner.sp+(dmg*FILL_DEALT+(isCrit?FILL_CRIT:0))*(owner.fillM||1));t.sp=Math.min(SUPER_MAX,t.sp+dmg*FILL_TAKEN*(t.fillM||1));if(owner.isPlayer&&mstat)mstat.dmg+=dmg;nums.push({x:t.x+(Math.random()-0.5)*1.2,y:t.y-R,t:0.9,z:isCrit?1.6:direct?1:0.75,g:!direct,txt:'',c:isCrit?'#ffd24a':TC[q.o.team]});dmgNum(nums.pop(),t,dmg,isCrit);q.life=0;}
  }
  q.life-=dt;
 }
 bullets=bullets.filter(q=>q.life>0);
}

// ---- buffs & mystery box ----
const bsum=(r,k)=>r.buffs.reduce((a,b)=>a+(b.k===k?BUFF[k].amt:0),0);
const gsum=(r,k)=>r.gems.reduce((a,g)=>a+(g===k?GEM[k].amt*((r.gemM&&r.gemM[k])||1):0),0);
const dmgMult=r=>(1+bsum(r,'dmg'))*(1+gsum(r,'dmg'))*(r.dmgM||1),rofMult=r=>(1+bsum(r,'rof'))*(1+gsum(r,'rof')),spdMult=r=>(1+bsum(r,'spd'))*(1+gsum(r,'spd'))*(r.spdM||1),armor=r=>Math.min(0.7,bsum(r,'arm')+gsum(r,'arm'));
function takeHit(r,amt,src){
 const wasAlive=r.hp>0;
 r.hp-=amt;r.flash=0.08;r.calm=0;
 if(r.isPlayer&&mstat)mstat.taken+=amt;
 if(r.isPlayer&&amt>0&&typeof fx==='function')fx('hit',amt);
 for(const b of r.buffs)b.taken+=amt;
 r.buffs=r.buffs.filter(b=>b.taken<BUFF_LIFE);   // buff wears off after enough damage taken
 if(wasAlive&&r.hp<=0&&gzones){r.deaths=(r.deaths||0)+1;const k=1-r.team;gscore[k]=Math.min(ZONE_WIN,gscore[k]+KILL_PTS);pop(r.x,r.y-1.6,'+'+KILL_PTS+' KILL',TC[k]);}
 if(wasAlive&&r.hp<=0&&src&&src.isPlayer&&mstat)mstat.kills++;
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

function spawnBox(){
 const n=MODES[modeKey()].n;   // boxes per spawn event: 1 in 1v1, 2 in 2v2, 3 in 3v3
 for(let s=0;s<n;s++){
  if(boxes.length>=n+2)break;   // safety cap so unclaimed boxes can't pile up
  for(let i=0;i<400;i++){
   const x=1.5+Math.random()*(W-3),y=1.5+Math.random()*(H-3);      // anywhere on the map
   if(walls.some(([rx,ry,rw,rh])=>x>rx-1.4&&x<rx+rw+1.4&&y>ry-1.4&&y<ry+rh+1.4))continue;   // not in or hugging cover
   if(units.some(r=>r.hp>0&&Math.hypot(r.x-x,r.y-y)<3.5))continue;      // never spawn on top of a robot
   if(boxes.some(b=>Math.hypot(b.x-x,b.y-y)<4))continue;   // don't stack boxes on each other
   boxes.push({x,y,life:20,age:0});pop(x,y,'MYSTERY BOX','#ffd24a');break;
  }
 }
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
  for(const [rx,ry,rw,rh] of ((a.elev||0)===1?baseWalls:walls))if(x>rx&&x<rx+rw&&y>ry&&y<ry+rh)return d;}
 return SUPER_LEN;
}
function useSuper(r){
 if(state!=='play'||r.sup||r.sp<SUPER_MAX||r.hp<=0)return;
 const S=SUP[r.wtype||'pulse'],e=nearestFoe(r);
 if(!e)return;
 if(S.kind!=='nova'&&!los(r,e)){
  // don't burn the charge on a blind fire (the bot already requires LOS too)
  if(r.isPlayer)showToast('No line of sight to an enemy');
  return;
 }
 r.sp=0;
 if(r.isPlayer&&mstat)mstat.sup++;
 if(r.isPlayer&&typeof fx==='function')fx('super');
 let ang=Math.atan2(e.y+(e.vy||0)*S.charge-r.y,e.x+(e.vx||0)*S.charge-r.x);
 r.sup={t:S.charge,ang,w:r.wtype||'pulse'};
}
function fireSuper(r,S){
 const col=TC[r.team];
 const hurt=(e,dmg)=>{if(!lvOK(r,e))return;dmg=dmg*(r.wmult||TIER_MULT[Math.max(0,r.wtier||0)])*dmgMult(r)*(1-armor(e))*cmult(r,e);takeHit(e,dmg,r);e.sp=Math.min(SUPER_MAX,e.sp+dmg*FILL_TAKEN*(e.fillM||1));
  if(r.isPlayer&&mstat)mstat.dmg+=dmg;nums.push({x:e.x,y:e.y-R,t:0.9,z:2,txt:'SUPER '+Math.round(dmg),c:'#ff4d4d'});};
 if(S.kind==='beam'){
  const ang=r.sup.ang;
  beams.push({ax:r.x,ay:r.y,bx:r.x+Math.cos(ang)*S.len,by:r.y+Math.sin(ang)*S.len,t:0.3,c:col,w:S.w});
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
  if(e&&S.kind!=='nova'&&r.sup.t>0.25){   // the aim keeps steering until the last 0.25s, then locks
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
 if(me.sp>=SUPER_MAX&&!me.rdyShown){me.rdyShown=true;nums.push({x:me.x,y:me.y-1.8,t:0.9,z:1.5,txt:'SUPER READY',c:'#ff4d4d'});}
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
 if(sidx<sched.length&&MATCH-timeLeft>=sched[sidx]){sidx++;spawnBox();}
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
 if(l===0)return losW(a,b,navWalls);
 const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d/0.3));
 for(let i=0;i<=n;i++){const t=i/n;if(!upOk(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;}
 return true;
}
function buildNav(){
 nav=[];
 const free=(px,py)=>px>R&&px<W-R&&py>R&&py<H-R&&!navWalls.some(([rx,ry,rw,rh])=>px>rx-R&&px<rx+rw+R&&py>ry-R&&py<ry+rh+R);
 for(const [x,y,w,h] of navWalls)for(const sx of [-1,1])for(const sy of [-1,1]){
  const px=(sx<0?x:x+w)+sx*(R+0.45),py=(sy<0?y:y+h)+sy*(R+0.45);
  if(free(px,py))nav.push({x:px,y:py,l:0});
 }
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
 return best;
}
function botAI(dt,u){
 const tgt=nearestFoe(u);
 if(!tgt||u.hp<=0)return;
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
 if(gzones){
  const z=gzones[0],fr=u.hp/u.mhp,tf=tgt.hp/tgt.mhp;
  // losing the trade? break off, repair out of sight, come back healthy
  if(!b.zr&&fr<0.3&&seen&&d<8&&tf>fr+0.2){b.zr=true;b.spot=coverSpot(u,tgt);}
  if(b.zr&&(fr>0.8||(!seen&&fr>0.6)))b.zr=false;
  if(b.zr){
   goal=b.spot&&dist2(b.spot,tgt)>3?b.spot:clampP(u.x-nx*5,u.y-ny*5);
   if(b.spot&&dist2(u,b.spot)<0.7&&los(u,tgt))b.spot=coverSpot(u,tgt);
  }else{
   let zg=botZoneGoal(u),nb=null,nd=4.5;for(const bx of boxes){const dd=dist2(u,bx);if(dd<nd){nd=dd;nb=bx;}}if(nb&&!z.next)zg=nb;
   const zt=z.next&&dist2(zg,z.next)<1.5?z.next:z;
   if(zt===z&&dist2(u,z)<z.r-0.4)zin=z;
   if(zg&&!(seen&&d<5.5&&dist2(u,zt)<z.r+3))goal=zg;   // fight only near the objective, otherwise keep moving to it
  }
 }
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
 const vx=tx-u.x,vy=ty-u.y,vm=Math.hypot(vx,vy);
 if(vm>0.15){u.x+=vx/vm*STAT.speed*0.85*spdMult(u)*(u.sup?0.6:1)*dt;u.y+=vy/vm*STAT.speed*0.85*spdMult(u)*(u.sup?0.6:1)*dt;}
 push(u);
}

// ---- update ----
function update(dt){
 if(banner&&state==='play'){banner.t-=dt;if(banner.t<=0)banner=null;}
 if(shakeT>0){shakeT-=dt;if(shakeT<=0)shakeM=0;}
 if(state!=='play')return;
 if(me.hp>0){   // dead players spectate their team
  const [ix,iy]=inputVec();
  me.x+=ix*STAT.speed*spdMult(me)*(me.sup?0.6:1)*dt;me.y+=iy*STAT.speed*spdMult(me)*(me.sup?0.6:1)*dt;push(me);
 }
 planBudget=2;   // at most two bots re-plan their route per frame
 for(const u of units)if(!u.isPlayer&&u.hp>0)botAI(dt,u);
 boxTick(dt);heading(dt);superTick(dt);
 for(const u of units)turret(u,dt);
 moveBullets(dt);
 for(const u of units)u.flash=Math.max(0,u.flash-dt);
 timeLeft-=dt;
 if(gzones){zoneTick(dt);respawnTick(dt);if(gscore[0]>=ZONE_WIN||gscore[1]>=ZONE_WIN||timeLeft<=0)endMatch();}
 else if(aliveCount(0)===0||aliveCount(1)===0||timeLeft<=0)endMatch();
}
let lastResult=null;
function endMatch(){
 state='over';endAt=performance.now();
 for(const u of units)u.hp=Math.max(0,u.hp);
 const a0=aliveCount(0),a1=aliveCount(1),ko=a0===0||a1===0;
 let won=a1===0||(timeLeft<=0&&a0>a1)||(timeLeft<=0&&a0===a1&&teamHpFrac(0)>teamHpFrac(1));
 let drawn=!won&&!ko&&timeLeft<=0&&a0===a1&&teamHpFrac(0)===teamHpFrac(1);
 const score=[Math.floor(gscore[0]),Math.floor(gscore[1])];
 if(gzones){drawn=score[0]===score[1];won=!drawn&&gscore[0]>gscore[1];}
 const mk=modeKey(),M=MODES[mk];
 if(won)save.streak=(save.streak||0)+1;else if(!drawn)save.streak=0;
 const streak=save.streak||0,sb=won?Math.min(streak,5)*20:0;
 const brk=powerBracket(calcPower()),zx=matchG==='zone'?ZONE_X[mk]:1;
 const base=Math.round((won?M.win:drawn?M.draw:M.loss)*zx);
 const pts=Math.round(base*brk.mult)+sb;
 if(won)save.wins=(save.wins||0)+1;else if(!drawn)save.losses=(save.losses||0)+1;
 save.mp=(save.mp||0)+1;
 const before=save.earned||0;
 const awarded=awardPts(pts)||0;
 // milestone + daily quest progress
 const wasDone={};QUESTS.forEach(q=>wasDone[q.id]=!!(save.q[q.id]&&save.q[q.id].done));
 qp('q_win1',won?1:0);qp('q_win3',won?1:0);
 qp('q_dmg',mstat.dmg,true);qp('q_super',mstat.sup,true);qp('q_box',mstat.box,true);
 if(won&&mstat.taken<600)qp('q_clean',1);
 const dqBefore=dailyQuests().filter(q=>q.done).map(q=>q.id);
 dqProgress({wins:won?1:0,plays:1,dmg:Math.round(mstat.dmg),boxes:mstat.box,sups:mstat.sup,kills:mstat.kills,zoneWins:won&&matchG==='zone'?1:0,teamWins:won&&M.n>1?1:0,caps:mstat.caps,overpass:curMap==='overpass'?1:0});
 const dqNew=dailyQuests().filter(q=>q.done&&!dqBefore.includes(q.id));
 const milestones=QUESTS.filter(q=>!wasDone[q.id]&&save.q[q.id]&&save.q[q.id].done);
 lastResult={won,drawn,mode:mk,gtype:matchG,map:curMap,score,base,zoneX:zx,league:brk,leagueMult:brk.mult,streak,streakBonus:sb,pts,awarded,capped:awarded<pts,
  before,after:save.earned||0,stats:{dmg:Math.round(mstat.dmg),kills:mstat.kills,boxes:mstat.box,sups:mstat.sup,taken:Math.round(mstat.taken)},
  quests:milestones.map(q=>q.n).concat(dqNew.map(q=>q.t)),countered:matchup().dis>0&&!won,meCls:me.cls};
 store();
 if(typeof fx==='function')fx(won?'win':drawn?'draw':'lose');
 if(typeof onMatchEnd==='function')setTimeout(()=>onMatchEnd(lastResult),won?650:900);
}

