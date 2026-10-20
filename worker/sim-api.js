// ---- Appended inside createSim() by worker/build-sim.mjs (it sees everything in js/rules.js and js/game.js).
// The live-match room (worker/src/pvp.js) drives the game's own sim through what this returns.
// The phone decodes snapState() in js/pvp.js: keep the two in step.
const r2=v=>Math.round(v*100)/100;
// seats are in unit order: team 0 then team 1 (Last Standing: one per spawn). A seat is {pid,name,L} for a live player, null for an AI pilot
const SEAT_XY=[[[10,28],[6,26],[14,26]],[[10,4],[6,6],[14,6]]];
function liveSetup(cfg){
 setMap(cfg.map);matchG=cfg.g;
 const solo=isSolo(matchG),n=solo?1:MODES[cfg.m].n,team=i=>solo?i:(i<n?0:1);
 MM={n,series:!!cfg.series,mp:99};
 const hs=hpScale(),pos=solo?royaleSpawns():SEAT_XY[0].slice(0,n).concat(SEAT_XY[1].slice(0,n)).map(([x,y])=>({x,y}));
 const taken=cfg.seats.filter(Boolean).map(s=>s.name),names=BOT_NAMES.filter(nm=>!taken.includes(nm)).sort(()=>Math.random()-0.5);
 const hums=[];
 units=cfg.seats.map((s,i)=>{
  if(!s)return null;
  const u=Object.assign(tankOf(s.L,hs),{x:pos[i].x,y:pos[i].y,flash:0,ang:pos[i].y>16?-Math.PI/2:Math.PI/2,cd:0.3,lk:null,buffs:[],sp:0,sup:null,
   team:team(i),name:s.name,pid:s.pid,L:s.L,pw:powerOf(s.L),hum:true,ctl:'net'});
  u.hp=u.mhp;hums.push(u);return u;});
 const ref=hums.slice().sort((a,b)=>a.pw-b.pw)[(hums.length-1)>>1]||tankOf(STOCK_L,hs);   // AI pilots match the middle human's gear
 units=units.map((u,i)=>u||mkBot(team(i),pos[i].x,pos[i].y,ref,names.pop()));
 units.forEach((u,i)=>{u.id=i;});
 me=null;series=null;state='vs';
}
function liveTank(u,L){Object.assign(u,tankOf(L,hpScale()),{L,pw:powerOf(L)});u.hp=u.mhp;}   // chassis swap on the VS screen or between rounds
function roster(){return units.map(u=>({id:u.id,team:u.team,name:u.name,cls:u.cls,wtype:u.wtype,wtier:u.wtier,gems:u.gems,gemM:u.gemM,dscale:u.dscale,aura:u.aura,
 paint:u.paint,skin:u.skin||'default',mhp:u.mhp,spdM:u.spdM,ai:!u.pid,x:r2(u.x),y:r2(u.y),ang:r2(u.ang)}));}
// the world, ~15 times a second. Units, in id order:
// [x, y, turret angle, hull angle, hp, super, flags (1 bridge deck, 2 dashing, 4 repairing, 8 human driving, 16 AI driving a live player's tank, 32 shielded),
//  crystals, bounty, dash cooldown x10, deaths, time dead x10, teleport count, buffs [[key index, damage taken]] or 0, super charging [t, angle] or 0, max hp]
function snapState(){
 const s={u:units.map(u=>[r2(u.x),r2(u.y),r2(u.ang),r2(u.hd===undefined?u.ang:u.hd),Math.round(Math.max(0,u.hp)),Math.round(u.sp),
  ((u.elev||0)===1?1:0)|(u.dash?2:0)|(u.rep>0?4:0)|(u.hum?8:0)|(u.pid&&!u.hum?16:0)|(u.shieldT>0?32:0),u.cry||0,u.bty||0,Math.round((u.dashCd||0)*10),u.deaths||0,Math.round((u.dead||0)*10),u.tp||0,
  u.buffs.length?u.buffs.map(b=>[BUFF_KEYS.indexOf(b.k),Math.round(b.taken)]):0,u.sup?[r2(u.sup.t),r2(u.sup.ang)]:0,u.mhp]),
  tl:r2(timeLeft),el:r2(elapsed),gs:[r2(gscore[0]),r2(gscore[1])],bx:boxes.map(b=>[r2(b.x),r2(b.y)]),cr:crates.map(c=>[c.id,Math.round(c.hp)]),
  sh:shells.map(q=>[q.id,r2(q.x),r2(q.y)])};
 if(gzones){const z=gzones[0];s.z=[r2(z.x),r2(z.y),z.r,r2(z.cap),z.own,z.p0,z.p1,r2(z.t),z.next?r2(z.next.x):null,z.next?r2(z.next.y):null];}
 if(cry)s.cy=[cry.loose.map(c=>[r2(c.x),r2(c.y),c.l,r2(c.age)]),cry.cd?[cry.cd.team,r2(cry.cd.t)]:null,cry.cnt.slice()];
 if(storm)s.st=[r2(storm.x),r2(storm.y),r2(storm.r)];
 if(evt)s.ev=[evt.k,r2(evt.t)];
 if(series)s.se=[series.w[0],series.w[1],series.round];
 return s;
}
return {
 R:{STOCK_L,PVP_V,UPS,UORDER,CH,CHORDER,WEAPONS,WORDER,TIER_MULT,ROLL_MIN,ROLL_MAX,SALV_MIN,SALV_MAX,GEM,GORDER,PAINTS,LEAGUES,FEATURED_X,
  MODES,GTYPES,GT_ORDER,ROYALE_PTS,SERIES_X,MAP_REAL,ROUND_T,powerOf,tankOf,powerBracket,featuredOn,liveModes,isSolo},
 setup:liveSetup,setTank:liveTank,roster,snap:snapState,start:startMatch,startRound,step:update,
 outcome,placeOf,useSuper,netClaim,netDash,netShield,setCtl,hit:takeHit,
 get state(){return state;},get units(){return units;},get series(){return series;},get map(){return curMap;},get g(){return matchG;},get storm(){return storm;}
};
