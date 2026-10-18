'use strict';
// =====================================================================
// match: the phone's side of a battle. Sets up and scores AI matches, and turns what the sim reports
// (ev() in game.js) into floating text, explosions, the kill feed, banners and sound. Live matches use the
// same drawing code: pvp.js feeds it the server's events, seen from your side.
// =====================================================================
const mapKey=()=>(save.map&&MAPS[save.map])?save.map:'classic';   // the player's pick (may be 'random'); the real map is chosen at match start
const modeKey=()=>(save.mode&&MODES[save.mode])?save.mode:'1v1';
const gtypeKey=()=>(save.gtype&&GT_PICK[save.gtype])?save.gtype:'arena';
function winPoints(gk,mk){return Math.round(winBase(gk,mk)*(gk===featuredMode()?FEATURED_X:1)*powerBracket(calcPower()).mult);}

// ---- your tank and the AI match ----
function buildMe(){
 const m=Object.assign(tankOf(myLoadout(),hpScale()),{x:10,y:28,flash:0,ang:-Math.PI/2,cd:0.3,lk:null,buffs:[],sp:0,sup:null,team:0,hum:true,ctl:'me',name:IN_TG?tgName(TG_USER):'You'});
 m.hp=m.mhp;return m;
}
// pick the map, mode and bots; the VS screen shows them before the fight starts
function prepareMatch(gOver){   // gOver: a game type already picked (a live queue that fell back to AI)
 {const pk=mapKey();setMap(pk==='random'?MAP_REAL[(Math.random()*MAP_REAL.length)|0]:pk);}
 {const gk=gOver||gtypeKey();matchG=gk==='random'?GT_ORDER[(Math.random()*GT_ORDER.length)|0]:gk;}
 const mp=save.mp||0;
 MM={n:MODES[modeKey()].n,series:matchG==='arena'&&modeKey()==='1v1'&&mp>0,mp};
 me=buildMe();
 const modeN=MM.n,names=BOT_NAMES.slice().sort(()=>Math.random()-0.5);
 units=[me];
 if(isSolo(matchG)){   // Last Standing: you and 5 AI pilots, each on their own team
  const sp=royaleSpawns();
  for(let i=1;i<GTYPES[matchG].solo;i++)units.push(mkBot(i,sp[i].x,sp[i].y,me,names.pop()));
 }else{
  for(let i=1;i<modeN;i++)units.push(mkBot(0,i===1?6:14,26,me,names.pop()));   // your AI teammates
  for(let i=0;i<modeN;i++)units.push(mkBot(1,i===0?10:(i===1?6:14),i===0?4:6,me,names.pop()));   // the enemy team
 }
 state='vs';
}
function newMatch(){prepareMatch();startMatch();}   // tests and quick restarts
// switch chassis on the VS screen or between rounds (counter-pick): the best owned version of that class
function switchChassis(cls){
 if(!ownedChassisClasses().includes(cls))return;
 save.chassis=cls;store();
 if(typeof pvpOn==='function'&&pvpOn()){pvpSend({k:'c',c:cls});return;}   // live match: the server swaps your tank
 const keep={x:me.x,y:me.y,sx:me.sx,sy:me.sy,deaths:me.deaths||0,zo:me.zo||0,id:me.id,st:me.st};me=buildMe();Object.assign(me,keep);units[0]=me;
}
function matchup(){   // how your chassis fares against the enemy lineup
 const foes=units.filter(u=>u.team!==me.team),adv=foes.filter(f=>COUNTER[me.cls]===f.cls).length,dis=foes.filter(f=>COUNTER[f.cls]===me.cls).length;
 return {adv,dis,foes};
}
function startBanners(){
 banner=null;
 if(!isSolo(matchG)){const {adv,dis}=matchup();
  if(adv||dis)banner={t:3,txt:adv&&!dis?'You counter them: +15% damage':dis&&!adv?'Countered: '+CH[beatenBy(me.cls)].n+' beats '+CH[me.cls].n:'Mixed matchup',c:adv&&!dis?'#5fe3a1':dis&&!adv?'#ff6b5e':'#ffcf4a'};}
 if(series&&!banner)banner={t:2.4,txt:'Best of 3: first to 2 rounds wins',c:'#ffcf4a'};
 if(!banner&&MODE_TIP[matchG]&&!series)banner={t:3,txt:MODE_TIP[matchG],c:'#ffcf4a'};
}
function roundBanner(){
 const {adv,dis}=matchup();
 banner={t:2.4,txt:'Round '+series.round+(adv&&!dis?': you counter them':dis&&!adv?': they counter you':''),c:adv&&!dis?'#5fe3a1':dis&&!adv?'#ff6b5e':'#ffcf4a'};
}

// ---- scoring an AI match (live matches are scored by the server: pvp.js) ----
function localEnd(forced){
 const o=outcome(me,forced),{won,drawn,place,score}=o;
 const mk=modeKey(),M=MODES[mk],feat=matchG===featuredMode(),top3=!!storm&&place<=3;
 if(won)save.streak=(save.streak||0)+1;else if(!drawn&&!top3)save.streak=0;   // Last Standing: 2nd and 3rd keep your streak
 const streak=save.streak||0,sb=won?Math.min(streak,5)*20:0;
 const brk=powerBracket(calcPower()),zx=storm?1:matchG==='arena'?(series?SERIES_X:1):GTYPES[matchG].x[mk],fxm=feat?FEATURED_X:1;
 const base=Math.round(storm?ROYALE_PTS[place-1]:(won?M.win:drawn?M.draw:M.loss)*zx);
 const pts=Math.round(base*fxm*brk.mult)+sb;
 const before=save.earned||0;
 const awarded=awardPts(pts)||0;
 afterMatch({won,drawn,place,score,mode:mk,feat,top3,base,modeX:zx,featX:fxm,league:brk,streak,streakBonus:sb,pts,awarded,before,st:mstat});
}
// everything after the points: wins and losses, pass XP, quests, the results screen. Shared with live matches
function afterMatch(o){
 const {won,drawn,top3,feat}=o,st=o.st||{dmg:0,sup:0,box:0,taken:0,kills:0,caps:0,cry:0,stars:0},M=MODES[o.mode]||MODES['1v1'];
 endAt=performance.now();
 if(won)save.wins=(save.wins||0)+1;else if(!drawn&&!top3)save.losses=(save.losses||0)+1;
 save.mp=(save.mp||0)+1;
 passXP((won?PASS_XP_WIN:drawn||top3?PASS_XP_DRAW:PASS_XP_LOSS)+(feat?PASS_XP_FEAT:0));
 // milestone + daily quest progress
 const wasDone={};QUESTS.forEach(q=>wasDone[q.id]=!!(save.q[q.id]&&save.q[q.id].done));
 qp('q_win1',won?1:0);qp('q_win3',won?1:0);
 qp('q_dmg',st.dmg,true);qp('q_super',st.sup,true);qp('q_box',st.box,true);
 if(won&&st.taken<600)qp('q_clean',1);
 const dqBefore=dailyQuests().filter(q=>q.done).map(q=>q.id);
 dqProgress({wins:won?1:0,plays:1,dmg:Math.round(st.dmg),boxes:st.box,sups:st.sup,kills:st.kills,zoneWins:won&&matchG==='zone'?1:0,teamWins:won&&M.n>1&&!storm?1:0,caps:st.caps,overpass:curMap==='overpass'?1:0,
  crystals:st.cry,stars:st.stars,top3:top3?1:0,featured:feat?1:0});
 const dqNew=dailyQuests().filter(q=>q.done&&!dqBefore.includes(q.id));
 const milestones=QUESTS.filter(q=>!wasDone[q.id]&&save.q[q.id]&&save.q[q.id].done);
 lastResult={won,drawn,mode:o.mode,gtype:matchG,map:curMap,score:o.score,base:o.base,modeX:o.modeX,featured:feat,featX:o.featX,place:o.place,league:o.league,leagueMult:o.league.mult,streak:o.streak,streakBonus:o.streakBonus,pts:o.pts,awarded:o.awarded,capped:o.awarded<o.pts,
  before:o.before,after:save.earned||0,stats:{dmg:Math.round(st.dmg),kills:st.kills,boxes:st.box,sups:st.sup,taken:Math.round(st.taken),cry:st.cry,stars:st.stars},
  quests:milestones.map(q=>q.n).concat(dqNew.map(q=>q.t)),countered:matchup().dis>0&&!won&&!storm,meCls:me.cls,series:series?{w:o.seriesW||series.w.slice()}:null,
  live:!!o.live,quit:!!o.quit,n:units.length};
 store();
 if(typeof fx==='function')fx(won?'win':drawn?'draw':'lose');
 if(typeof onMatchEnd==='function')setTimeout(()=>onMatchEnd(lastResult),won?650:900);
}

// ---- what the sim reports, drawn from your side. Your team is always 0 and blue (pvp.js swaps teams and turns the map for you) ----
function pop(x,y,txt,c){pops.push({x,y,txt,c,t:1.4});}
function feedPush(txt,c){feed.push({txt,c,t:3.2});if(feed.length>3)feed.shift();}
function shake(m,t){shakeM=Math.max(shakeM,m);shakeT=Math.max(shakeT,t);}
// one floating number per target for rapid hits (merged inside 0.25s); crits always get their own
function dmgNum(q,t,dmg,isCrit){
 if(!isCrit){for(const o of nums)if(o.tg===t&&!o.crit&&o.t>0.65&&o.c===q.c){o.v+=dmg;o.txt=String(Math.round(o.v));o.t=0.9;return;}}
 q.tg=t;q.v=dmg;q.crit=isCrit;q.txt=(isCrit?'CRIT ':'')+Math.round(dmg);nums.push(q);
}
const HIT_TXT=[null,{txt:'SUPER',t:0.9,z:2,c:'#ff4d4d'},{txt:'STORM',t:0.7,z:0.8,c:'#c79bff'},{txt:'METEOR',t:0.9,z:1.6,c:'#ff8a3d'}];
const evColor=c=>typeof c==='number'?tcol(c):c;   // a team number means that team's color
const sndF=(k,a)=>{if(typeof fx==='function')fx(k,a);};
function onSimEv(a){
 const U=i=>i>=0?units[i]:null,live=typeof pvpOn==='function'&&pvpOn();
 switch(a[0]){
  case 'h':{const t=U(a[1]),amt=a[2],kind=a[3],cr=!!a[4],dir=!!a[5],s=U(a[6]);if(!t)return;
   t.flash=0.08;
   if(t===me&&amt>0){me.hurtT=0.3;sndF('hit',amt);}
   if(!kind){if(s===me)sndF('dealt',cr);
    dmgNum({x:t.x+(Math.random()-0.5)*1.2,y:t.y-R,t:0.9,z:cr?1.6:dir?1:0.75,g:!dir,txt:'',c:cr?'#ffd24a':tcol(s?s.team:1)},t,amt,cr);
    if(live&&a[7])pvpBulletHit(a[7]);}
   else{const K=HIT_TXT[kind];nums.push({x:t.x,y:t.y-R,t:K.t,z:K.z,txt:K.txt+' '+Math.round(amt),c:K.c});}
   return;}
  case 'k':{const r=U(a[1]),s=U(a[2]),why=a[3];if(!r)return;
   feedPush(s?(s===me?'You':s.name)+' destroyed '+(r===me?'you':r.name):(r===me?'You':r.name)+(why==='storm'?' got caught in the storm':' got hit by a meteor'),s?tcol(s.team):why==='storm'?'#c79bff':'#ff8a3d');
   sndF(r===me?'die':s===me?'kill':'boom');
   blasts.push({x:r.x,y:r.y,r:2.2,t:0.6,t0:0.6,c:'#ff6b3c'});blasts.push({x:r.x,y:r.y,r:1.4,t:0.4,t0:0.4,c:'#ffd24a'});shake(10,0.5);
   nums.push({x:r.x,y:r.y-R,t:1.1,z:1.4,txt:r===me?'YOU ARE DOWN':'DESTROYED',c:r===me?'#ff6b6b':'#ffd24a'});
   return;}
  case 'n':nums.push({x:a[1],y:a[2],t:0.9,z:a[5],txt:a[3],c:a[4]});return;
  case 'p':pop(a[1],a[2],a[3],evColor(a[4]));return;
  case 'B':blasts.push({x:a[1],y:a[2],r:a[3],t:a[4],t0:a[4],c:a[5]});return;
  case 'M':beams.push({ax:a[1],ay:a[2],bx:a[3],by:a[4],t:0.3,c:tcol(a[5]),w:a[6]});return;
  case 'V':novas.push({x:a[1],y:a[2],r:a[3],t:0.45,t0:0.45,c:tcol(a[4])});return;
  case 'S':shake(a[1],a[2]);return;
  case 'z':if(a[1]==='cap'){if(a[2]===0){pop(a[3],a[4],'ZONE CAPTURED!',TC[0]);sndF('cap');}else pop(a[3],a[4],'ENEMY TOOK THE ZONE',TC[1]);}
   else pop(a[3],a[4],a[2]===0?'ZONE LOST':'ZONE NEUTRAL',a[2]===0?'#ff9d9d':'#c9d6e3');
   return;
  case 'c':banner={t:2.6,txt:a[1]===0?'Hold on for 15 seconds to win':'Enemy countdown! Destroy their carriers',c:a[1]===0?'#5fe3a1':'#ff6b5e'};sndF('event');return;
  case 'N':banner={t:a[3]||2.6,txt:a[1],c:a[2]};if(a[4])sndF(a[4]);return;
  case 'F':feedPush(a[1],a[2]);return;
  case 'J':{const u=U(a[1]);if(!u)return;   // live pilots dropping out and coming back
   if(u===me){if(a[2]==='back')feedPush('You\'re back in control','#5fe3a1');return;}
   feedPush(u.name+(a[2]==='drop'?' lost connection. AI is driving':a[2]==='back'?' is back':a[2]==='leftvs'?' left. An AI pilot took the seat':' left. An AI pilot took over'),'#c9d6e3');
   if(a[2]==='left'||a[2]==='leftvs')u.ai=true;return;}
  case 'T':{const s=U(a[1]);if(s)feedPush((s===me?'You have':s.name+' has')+' the top bounty: 7 stars','#ffcf4a');return;}
  case 'u':{const r=U(a[1]);if(r===me&&live)return;sndF(r===me?'super':'warn');return;}   // live: your own super already played when you pressed it
  case 'g':{const u=U(a[1]),B=BUFF[a[2]];if(B)pop(a[3],a[4],B.txt,B.c);if(u===me)sndF('box');return;}
  case 'r':{const u=U(a[1]);if(u)pop(u.x,u.y-1,u===me?'BACK IN THE FIGHT':'RESPAWNED',tcol(u.team));return;}
  case 'C':if(U(a[1])===me)sndF('crystal');return;
  case 'X':{const x=a[2],y=a[3];if(live)pvpCrateGone(a[1]);
   blasts.push({x,y,r:1.3,t:0.35,t0:0.35,c:'#ffb347'});shake(3,0.2);sndF('crate');
   pop(x,y-0.8,a[4]?'MYSTERY BOX':'CRATE DESTROYED',a[4]?'#ffd24a':'#c9d6e3');return;}
  case 'e':{const E=EVENTS[a[1]];if(E){banner={t:3.2,txt:E.txt,c:E.c};sndF('event');}return;}
  case 'w':if(live)warns.push({x:a[1],y:a[2],r:a[3],t:a[4],t0:a[4]});sndF('warn');return;
  case 'm':{const x=a[1],y=a[2],r=a[3];blasts.push({x,y,r:r*1.25,t:0.5,t0:0.5,c:'#ff8a3d'});sndF('meteor');blasts.push({x,y,r:r*0.6,t:0.3,t0:0.3,c:'#ffe08a'});shake(7,0.35);return;}
  case 'b':if(live)pvpShot(a);return;
 }
}
// visuals that run on their own clocks (both in AI and live matches)
function fxTick(dt){
 if(banner){banner.t-=dt;if(banner.t<=0)banner=null;}
 if(shakeT>0){shakeT-=dt;if(shakeT<=0)shakeM=0;}
 if(me)me.hurtT=Math.max(0,(me.hurtT||0)-dt);
 for(const f of feed)f.t-=dt;if(feed.length&&feed[0].t<=0)feed.shift();
 for(const r of units){r.trail=r.trail||[];r.tt=(r.tt||0)+dt;if(r.tt>0.04){r.tt=0;r.trail.push({x:r.x,y:r.y});if(r.trail.length>7)r.trail.shift();}}
 for(const q of pops)q.t-=dt;
 pops=pops.filter(q=>q.t>0);
 for(const q of nums)q.t-=dt;
 nums=nums.filter(q=>q.t>0);
 for(const b of blasts)b.t-=dt;
 blasts=blasts.filter(b=>b.t>0);
 for(const n of novas)n.t-=dt;
 novas=novas.filter(n=>n.t>0);
 for(const b of beams)b.t-=dt;
 beams=beams.filter(b=>b.t>0);
 if(me){
  if(me.sp>=SUPER_MAX&&!me.rdyShown&&me.hp>0){me.rdyShown=true;nums.push({x:me.x,y:me.y-1.8,t:0.9,z:1.5,txt:'SUPER READY',c:'#ff4d4d'});sndF('ready');}
  if(me.sp<SUPER_MAX)me.rdyShown=false;
 }
}
