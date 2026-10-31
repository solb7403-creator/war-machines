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
let battleLoadout=null,battlePower=null;
function battleChassisClasses(){if(typeof pvpOn==='function'&&pvpOn())return pvp.chs||ownedChassisClasses();return battleLoadout?(battleLoadout.chs||[battleLoadout.c]).map(c=>c.c):ownedChassisClasses();}
function buildMe(){
 const m=Object.assign(tankOf(battleLoadout||myLoadout(),hpScale()),{x:10,y:28,flash:0,ang:-Math.PI/2,cd:0.3,lk:null,buffs:[],sp:0,sup:null,team:0,hum:true,ctl:'me',name:IN_TG?tgName(TG_USER):'You'});
 m.hp=m.mhp;return m;
}
// pick the map, mode and bots; the VS screen shows them before the fight starts
function prepareMatch(gOver){   // gOver: a game type already picked (a live queue that fell back to AI)
 {const pk=mapKey();setMap(pk==='random'?MAP_REAL[(Math.random()*MAP_REAL.length)|0]:pk);}
 {const gk=gOver||gtypeKey();matchG=gk==='random'?GT_ORDER[(Math.random()*GT_ORDER.length)|0]:gk;}
 battleLoadout=JSON.parse(JSON.stringify(myLoadout()));battlePower=powerOf(battleLoadout);
 const mp=save.mp||0;
 MM={n:MODES[modeKey()].n,series:matchG==='arena'&&modeKey()==='1v1'&&mp>0,mp,cp:(battleLoadout.chs||[battleLoadout.c]).length>1};   // cp: you can counter-pick back between rounds
 populatePreparedMatch();
 state='vs';
 matchStart();
}
// the AI for this match (aiLevel, rules.js): its power, shown on the VS screen, grows slower than yours, and AI pilots
// never copy your tank, so a better tank is always a bigger edge
let aiLv=null;
function populatePreparedMatch(){
 const mp=MM.mp;
 me=buildMe();
 const pw=battlePower||powerOf(battleLoadout||myLoadout());aiLv=aiLevel(pw);
 const modeN=MM.n,names=BOT_NAMES.slice().sort(()=>Math.random()-0.5);
 units=[me];
 if(matchG==='boss'){   // Survival: you (and AI wingmen in 2v2 and 3v3) against one megatank
  for(let i=1;i<modeN;i++)units.push(mkBot(0,i===1?6:14,26,me,names.pop(),aiLv));
  units.push(mkBoss(me,modeN,aiLevel(pw,AI_BOSS_EXP)));
 }else if(isSolo(matchG)){   // Last Standing: you and 5 AI pilots, each on their own team
  const sp=royaleSpawns();
  for(let i=1;i<GTYPES[matchG].solo;i++)units.push(mkBot(i,sp[i].x,sp[i].y,me,names.pop(),aiLv));
 }else{
  for(let i=1;i<modeN;i++)units.push(mkBot(0,i===1?6:14,26,me,names.pop(),aiLv));   // your AI teammates
  for(let i=0;i<modeN;i++)units.push(mkBot(1,i===0?10:(i===1?6:14),i===0?4:6,me,names.pop(),aiLv));   // the enemy team
 }
 fairField(mp);
}
// AI chassis, dealt fairly against yours (the triangle should cut both ways): in Last Standing as many foes counter you
// as you counter (2 and 2, plus 1 of your own class); in team modes not every enemy counters you. Pilots in their first
// 10 matches still never face a counter at all (mkBot)
function fairField(mp){
 if(matchG==='boss'||mp<10)return;
 const foes=units.filter(u=>u!==me&&u.team!==me.team&&!u.hum&&!u.boss&&!u.gh);if(foes.length<2)return;
 const beats=COUNTER[me.cls],beaten=beatenBy(me.cls);
 if(isSolo(matchG)){
  const deal=[];for(let i=0;i<foes.length;i++)deal.push([beats,beaten,me.cls][i%3]);
  deal.sort(()=>Math.random()-0.5);foes.forEach((u,i)=>{if(u.cls!==deal[i])rebuildBot(u,deal[i]);});
  return;
 }
 if(foes.every(u=>COUNTER[u.cls]===me.cls)){const u=foes[(Math.random()*foes.length)|0];rebuildBot(u,Math.random()<0.5?beats:me.cls);}
}
function newMatch(){prepareMatch();startMatch();}   // tests and quick restarts
// switch chassis on the VS screen or between rounds (counter-pick): the best owned version of that class
function switchChassis(cls){
 if(typeof pvpOn==='function'&&pvpOn()){pvpSend({k:'c',c:cls});return;}
 if(!battleLoadout||!['vs','round'].includes(state))return;
 const c=(battleLoadout.chs||[battleLoadout.c]).find(c=>c.c===cls);if(!c)return;
 battleLoadout={...battleLoadout,c:{...c}};
 const keep={x:me.x,y:me.y,sx:me.sx,sy:me.sy,deaths:me.deaths||0,zo:me.zo||0,id:me.id,st:me.st};me=buildMe();Object.assign(me,keep);units[0]=me;
}
function matchup(){   // how your chassis fares against the enemy lineup
 const foes=units.filter(u=>u.team!==me.team&&!u.boss),adv=foes.filter(f=>COUNTER[me.cls]===f.cls).length,dis=foes.filter(f=>COUNTER[f.cls]===me.cls).length;
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
// In Telegram the server scores AI matches too: the VS screen asks it for a ticket (mode, map, start time), and the
// result goes back with that ticket. The server works out the points itself from the shared rules (it never takes a
// number from the phone), so the phone shows the same formula right away and swaps in the server's numbers when they land.
let mTicket=null;
// The ticket request is retried for a few seconds (a dropped request, or the phone pausing Telegram in the background,
// used to cost the whole match). Only within TICKET_RETRY_MS: a ticket that lands much later than the match started
// wouldn't match the match record's length. A server that says no gives its reason (T.err) instead of "no connection"
const TICKET_RETRY_MS=4000,TICKET_TRY_MS=3500;
function apiTimed(path,body,ms){
 const ac=typeof AbortController==='function'?new AbortController():null,tm=ac?setTimeout(()=>ac.abort(),ms):0;
 return apiFetch(path,body,ac?ac.signal:undefined)
  .then(r=>r.json().then(j=>({j,st:r.status}),()=>({j:null,st:r.status}))).finally(()=>clearTimeout(tm));
}
function matchStart(){
 mTicket=null;if(!SRV_ECO)return;
 const T={tok:null,err:null,g:matchG,m:modeKey(),t0:Date.now()},body={g:matchG,m:modeKey(),map:curMap,quick:!!lastQuick,L:battleLoadout||myLoadout(),labRev:save.lab&&save.lab.rev,fv:FIT_VERSION,pv:1,did:deviceId(),dh:deviceHash()};   // pv: this phone sends a match record
 const ask=async()=>{
  for(let k=0;;k++){
   if(mTicket!==T&&k>0)return null;   // a newer match replaced this one
   let out=null;
   const last=Date.now()-T.t0+TICKET_TRY_MS>TICKET_RETRY_MS+TICKET_TRY_MS;   // the last try waits as long as it takes (a slow network)
   try{out=await apiTimed('/api/match/start',body,last?20000:TICKET_TRY_MS);}catch(e){out=null;}   // no answer: network
   const r=out&&out.j;
   if(r&&r.tok){T.tok=r.tok;T.err=null;
    if(mTicket===T&&state==='vs'&&r.L){
     const chosen=battleLoadout&&battleLoadout.c.c;
     battleLoadout=JSON.parse(JSON.stringify(r.L));battlePower=r.power;
     const c=(battleLoadout.chs||[]).find(c=>c.c===chosen);if(c)battleLoadout.c={...c};
     if(r.E)applyEco(r.E);populatePreparedMatch();
     const ov=typeof findOv==='function'&&findOv('vs');if(ov&&ov.re)ov.re();
    }
if(Array.isArray(r.gh)&&r.gh.length&&mTicket===T&&state==='vs')placeGhosts(r.gh);return r;}
   if(out&&out.st<500&&out.st!==429){T.err=(r&&r.error)||'server';return r;}   // the server said no: retrying won't change it
   T.err=out?(out.st===429?'rate':'server'):'offline';
   if(last||Date.now()-T.t0>TICKET_RETRY_MS)return null;
   await new Promise(res=>setTimeout(res,Math.min(2000,600*(k+1))));
  }
 };
 T.p=flushMatches().then(ask).catch(()=>null);
 mTicket=T;
}
// ghosts: offline pilots' real tanks (sent with the ticket) take AI seats, enemies first. The VS screen shows who they are
// Only ghosts clearly weaker than your tank (AI_GHOST_HI, rules.js), and at most one on the enemy team: after the first enemy
// seat they fill your team's seats, so a ghost can't turn an AI match into a hidden fight against stronger pilots
function placeGhosts(list){
 const cap=(battlePower||powerOf(battleLoadout||myLoadout()))*AI_GHOST_HI;
 const free=units.map((u,i)=>i).filter(i=>i>0&&!units[i].hum&&!units[i].boss&&!units[i].gh);
 const foeSeats=free.filter(i=>units[i].team!==me.team),allySeats=free.filter(i=>units[i].team===me.team);
 const seats=foeSeats.slice(0,1).concat(allySeats);
 list.filter(g=>g&&g.L&&(()=>{try{return powerOf(g.L)<=cap;}catch(e){return false;}})()).slice(0,seats.length).forEach((g,k)=>{const i=seats[k],o=units[i];try{units[i]=mkGhost(o.team,o.x,o.y,g);}catch(e){}});
 const ov=typeof findOv==='function'&&findOv('vs');if(ov&&ov.re)ov.re();
}
// results waiting for the server (no connection when the match ended): sent in order, each ticket counts once
let mqBusy=null;
function flushMatches(){
 if(!SRV_ECO||!save.mq||!save.mq.length)return Promise.resolve();
 if(mqBusy)return mqBusy;
 mqBusy=(async()=>{
  while(save.mq&&save.mq.length){
   const it=save.mq[0];let r;
   try{r=await api('/api/match/end',{tok:it.tok,r:it.r});}catch(e){break;}   // offline: try again later
   save.mq.shift();store();
   if(r&&r.E&&!(save.mq&&save.mq.length))applyEco(r.E);
   matchScored(it.tok,r);
  }
  mqBusy=null;
  if(save.mq&&save.mq.length)setTimeout(()=>flushMatches(),30000);
 })();
 return mqBusy;
}
const MATCH_WHY={rate:'too many requests, try again in a minute',server:'the server was busy at the start',mode:'this mode isn’t open right now',map:'this map isn’t open right now',proof:'the match couldn’t be verified',update:'update the game to keep scoring',fast:'the match ended too fast',expired:'the match ticket expired',ticket:'the match ticket was already used',hourly:'too many matches this hour',offline:'no connection at the start'};
function matchScored(tok,r){   // the server's numbers for a result, onto the results screen if it's still up
 const L=lastResult;if(!L||L.tok!==tok)return;
 if(r&&r.ok&&r.res){Object.assign(L,{pts:r.res.pts,awarded:r.res.awarded,capped:r.res.awarded<r.res.pts,streak:r.res.streak,streakBonus:r.res.streakBonus,leagueMult:r.res.mult||L.leagueMult,after:save.earned||L.after,note:null});}
 else{Object.assign(L,{awarded:0,capped:false,note:'Not counted: '+(MATCH_WHY[r&&r.error]||'the server said no')});}
 if(typeof uiDirty==='function')uiDirty();
 const ov=typeof findOv==='function'&&findOv('res');if(ov&&ov.box&&typeof resultsHTML==='function'){ov.box.innerHTML=resultsHTML(L);}
}
function matchEnd(res){
 const T=mTicket;mTicket=null;
 if(!SRV_ECO)return;
 if(!T){if(!res.quit&&lastResult)matchScored(lastResult.tok,{error:'offline'});return;}
 const tok='p'+Math.random().toString(36).slice(2);if(lastResult&&!res.quit)lastResult.tok=tok;
 T.p.then(()=>{
  if(!T.tok){if(lastResult&&lastResult.tok===tok)matchScored(tok,{error:T.err||'offline'});applyEcoSoon();return;}
  if(lastResult&&lastResult.tok===tok)lastResult.tok=T.tok;
  save.mq=(save.mq||[]).concat({tok:T.tok,r:res});store();
  flushMatches();
 });
}
function applyEcoSoon(){if(typeof doSync==='function')setTimeout(()=>doSync(false),300);}   // a result the server won't count: get its record back
function localEnd(forced){
 const o=outcome(me,forced),{won,drawn,place,score}=o;
 const mk=modeKey(),feat=matchG===featuredMode(),top3=!!storm&&place<=3,brk=powerBracket(battlePower===null?calcPower():battlePower);
 const mo={won,drawn,place,top3,g:matchG,m:mk,feat,series:!!series,quick:!!lastQuick,map:curMap};
 const before=save.earned||0;
 const r=ecoMatchPts(IN_WEB?JSON.parse(JSON.stringify(save)):save,mo,brk.mult,ecoX());
 if(IN_WEB){r.pts=0;r.awarded=0;} // Only the scored server response may change website progression.
 if(!SRV_ECO&&r.pts>0&&!r.awarded)showToast('Daily point cap reached. It resets at 00:00 UTC.');
 afterMatch({won,drawn,place,score,mode:mk,feat,top3,base:r.base,modeX:r.modeX,featX:r.featX,league:brk,streak:r.streak,streakBonus:r.streakBonus,pts:r.pts,awarded:r.awarded,before,st:mstat,quick:mo.quick});
 const st=mstat||{};
 const gh=units.filter(u=>u.gh&&u.gid!==undefined).map(u=>{const g=outcome(u,forced),s=u.st||{};return {i:u.gid,won:g.won?1:0,drawn:g.drawn?1:0,dmg:Math.round(s.dmg||0),kills:s.kills||0};});
 matchEnd({won,drawn,place,gh,pf:proofData(),seriesW:series?series.w.slice():null,stats:{dmg:Math.round(st.dmg||0),kills:st.kills||0,box:st.box||0,sup:st.sup||0,caps:st.caps||0,cry:st.cry||0,stars:st.stars||0,low:typeof st.low==='number'?Math.round(st.low*1000)/1000:0}});
 if(!SRV_ECO&&typeof syncPlayer==='function')syncPlayer();
}
// everything after the points: wins and losses, pass XP, quests, the results screen. Shared with live matches
function afterMatch(o){
 const {won,drawn,top3,feat}=o,st=o.st||{dmg:0,sup:0,box:0,taken:0,arm:0,shd:0,best:0,kills:0,caps:0,cry:0,stars:0,low:0};
 const sw=o.seriesW||(series&&series.w);
 endAt=performance.now();
 const wasDone={};QUESTS.forEach(q=>wasDone[q.id]=!!(save.q[q.id]&&save.q[q.id].done));
 const dqBefore=dailyQuests().filter(q=>q.done).map(q=>q.id),wqBefore=weeklyQuests().filter(q=>q.done).map(q=>q.id);
 // the shared rules (rules.js). In Telegram the server does the same with its own copy, and its record replaces this one
 if(!IN_WEB)ecoAfterMatch(save,{won,drawn,top3,feat,quick:o.quick!==undefined?o.quick:(typeof lastQuick!=='undefined'&&lastQuick),g:matchG,m:o.mode,map:curMap,streak:o.streak!==undefined?o.streak:save.streak,seriesW:sw,st},ecoX());
 const dqNew=dailyQuests().filter(q=>q.done&&!dqBefore.includes(q.id)).concat(weeklyQuests().filter(q=>q.done&&!wqBefore.includes(q.id)));
 const milestones=QUESTS.filter(q=>!wasDone[q.id]&&save.q[q.id]&&save.q[q.id].done);
 lastResult={won,drawn,mode:o.mode,gtype:matchG,map:curMap,score:o.score,base:o.base,modeX:o.modeX,featured:feat,featX:o.featX,place:o.place,league:o.league,leagueMult:o.league.mult,streak:o.streak,streakBonus:o.streakBonus,pts:o.pts,awarded:o.awarded,capped:o.awarded<o.pts,
  before:o.before,after:save.earned||0,stats:{dmg:Math.round(st.dmg),kills:st.kills,boxes:st.box,sups:st.sup,taken:Math.round(st.taken),arm:Math.round(st.arm||0),shd:Math.round(st.shd||0),best:Math.round(st.best||0),low:typeof st.low==='number'?st.low:1,cry:st.cry,stars:st.stars},
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
// super impacts, per weapon: blast size and colors (match.js 2D overlay; render3d.js adds the 3D explosion)
const IMPACT={pulse:{r:2.2,c:'#ffb35a',c2:'#ffe08a'},twin:{r:2.6,c:'#7fd4ff',c2:'#e2f4ff'},siege:{r:3.0,c:'#ff7a2f',c2:'#ffd24a'},moon:{r:2.8,c:'#bfe6ff',c2:'#ffffff'}};
const evColor=c=>typeof c==='number'?tcol(c):c;   // a team number means that team's color
const sndF=(k,a)=>{if(typeof fx==='function')fx(k,a);};
function onSimEv(a){
 if(typeof ev3D==='function')ev3D(a);   // 3D effects: explosions, wrecks, sparks
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
  case 'I':{const C=IMPACT[a[3]]||IMPACT.pulse,x=a[1],y=a[2];   // a super landing: an explosion, a shake and the impact sound
   blasts.push({x,y,r:C.r,t:0.55,t0:0.55,c:C.c});blasts.push({x,y,r:C.r*0.55,t:0.35,t0:0.35,c:C.c2});
   shake(a[4]===(me?me.team:0)?7:10,0.4);sndF('impact',a[3]);return;}
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
