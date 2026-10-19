'use strict';
// =====================================================================
// pvp: live matches on the phone. Gets a seat (POST /api/pvp/join), talks to the match room over a WebSocket,
// draws the server's world a moment in the past so it moves smoothly, drives your own tank at once (the server
// checks every move), and shows the server's result. Your side is always team 0 at the bottom of the screen:
// if you're on team 1 the whole map is turned around for you.
// =====================================================================
const PVP_TMS=1000/30;   // one server tick
const pvpWsBase=()=>(window.LUNAR_WS_BASE||API.replace(/^http/,'ws'))+'/pvp/ws';
let pvp=null;   // the live match this phone is in (or looking for), null otherwise
const pvpOn=()=>!!pvp&&pvp.live;
const pvpQueue=gk=>gk==='royale'?'solo':modeKey();
// live queues: Arena, Moon Zone and today's featured mode; you need Telegram (the server checks your login) and one match played
const isLiveMode=gk=>liveModes(dayNum()).includes(gk)||(!!window.LUNAR_LIVE_ALL&&GT_ORDER.includes(gk));   // LUNAR_LIVE_ALL: local tests of every mode
function pvpEligible(gk){return IN_TG&&(save.mp||0)>=1&&typeof WebSocket==='function'&&!window.LUNAR_NO_PVP&&isLiveMode(gk);}   // LUNAR_NO_PVP: the AI-match tests
// Quick Match: one live queue per team size. Any live mode, picked when the match starts; it also meets players
// queued for a specific live mode at your team size, so it's the fastest way to find real pilots
let lastQuick=false;   // the last match came from Quick Match (Play again repeats it)
const quickOK=()=>IN_TG&&(save.mp||0)>=1&&typeof WebSocket==='function'&&!window.LUNAR_NO_PVP;
const quickModes=()=>liveModes(dayNum()).filter(g=>g!=='royale');
function quickMatch(){
 if(state==='play'||(pvp&&pvp.phase==='find'))return;
 closeAll();if(pvp)pvpClose();
 lastQuick=true;
 if(quickOK()){pvpFind('quick');return;}
 const gs=quickModes();prepareMatch(gs[(Math.random()*gs.length)|0]);showVS();   // outside Telegram: a random live mode against AI
}
function pvpSend(o){const P=pvp;if(P&&P.sock&&P.sock.readyState===1)try{P.sock.send(JSON.stringify(o));}catch(e){}}

// ---- finding opponents ----
function pvpFind(gk){
 const m=pvpQueue(gk);
 pvp={phase:'find',live:false,q:{g:gk,m},quick:gk==='quick',t0:Date.now(),n:1,cap:gk==='royale'?6:MODES[m].n*2,left:30000,snaps:[],evq:[],off:null,jit:0,delay:110,tp:0,sent:null,lastSnapAt:0,retry:0,id:Math.random()};
 const P=pvp;
 showFind();
 api('/api/pvp/join',{v:PVP_V,g:gk,m,L:myLoadout()}).then(r=>{
  if(pvp!==P||P.phase!=='find')return;
  if(!r||!r.ok)throw new Error('no seat');
  P.room=r.room;P.tok=r.tok;P.left=r.wait||30000;P.t0=Date.now();
  pvpConnect();
 }).catch(()=>{if(pvp===P&&P.phase==='find')pvpFallback('Live match unavailable right now. Playing AI pilots.');});
}
function findHTML(){
 const P=pvp,q=P.q,left=Math.max(0,Math.ceil((P.left-(Date.now()-P.t0))/1000)),slots=Array.from({length:P.cap},(_,i)=>'<i class="'+(i<P.n?'on':'')+'"></i>').join('');
 return '<div class="grow"></div><div class="fhead">'+(P.quick?'<b>Quick Match '+esc(q.m)+'</b><span>Any live mode, random map</span>':'<b>'+esc(modeName(q.g,q.m==='solo'?modeKey():q.m))+'</b><span>'+(q.g==='arena'&&q.m==='1v1'?'Best of 3, live':'Live match')+(q.g===featuredMode()?', featured +25%':'')+'</span>')+'</div>'+
  '<div class="radar" aria-hidden="true"><span class="sweep"></span><b class="num" id="fCount">'+left+'</b></div>'+
  '<p class="ftitle">Finding live pilots</p>'+
  '<div class="slots" aria-label="'+P.n+' of '+P.cap+' pilots">'+slots+'</div>'+
  '<p class="mut fnote" id="fNote">'+P.n+' of '+P.cap+' pilots. If seats are still empty when the timer ends, AI pilots fill them.</p>'+
  '<div class="grow"></div><button class="btn btn-quiet block" data-act="pvpai">Play AI pilots now</button><button class="linkbtn" data-act="pvpcancel">Cancel</button>';
}
let findTimer=null;
function showFind(){
 const ov=openOverlay('full',findHTML(),{cls:'find',key:'find',onClose:()=>{clearInterval(findTimer);findTimer=null;if(pvp&&pvp.phase==='find')pvpCancel();}});
 ov.re=()=>{ov.box.innerHTML=findHTML();};
 clearInterval(findTimer);findTimer=setInterval(()=>{const el=$('#fCount');if(!pvp||pvp.phase!=='find'){clearInterval(findTimer);findTimer=null;return;}if(el)el.textContent=Math.max(0,Math.ceil((pvp.left-(Date.now()-pvp.t0))/1000));},250);
}
function closeFind(){clearInterval(findTimer);findTimer=null;const ov=findOv('find');if(ov){ov.onClose=null;closeOverlay(ov);}}
function pvpCancel(){const P=pvp;if(!P)return;pvpSend({k:'q'});pvpClose();}
// no live match: the same mode against AI pilots, on the phone
function pvpFallback(msg){
 let g=pvp&&pvp.q.g;if(g==='quick'){const gs=quickModes();g=gs[(Math.random()*gs.length)|0];}
 pvpClose();closeFind();
 if(msg)showToast(msg);
 prepareMatch(g);showVS();
}
function pvpClose(){
 const P=pvp;pvp=null;
 if(P&&P.sock){try{P.sock.onclose=null;P.sock.close(1000,'bye');}catch(e){}}
 if(P)clearTimeout(P.rt);
 bullets=[];
}

// ---- the socket ----
function pvpConnect(){
 const P=pvp;if(!P||!P.room)return;
 let ws;
 try{ws=new WebSocket(pvpWsBase()+'?r='+encodeURIComponent(P.room)+'&t='+encodeURIComponent(P.tok));}catch(e){pvpLost();return;}
 P.sock=ws;
 ws.onmessage=e=>{if(pvp!==P)return;let m;try{m=JSON.parse(e.data);}catch(_){return;}try{pvpMsg(m);}catch(err){setTimeout(()=>{throw err;});}};
 ws.onopen=()=>{P.retry=0;};
 ws.onclose=()=>{if(pvp!==P||P.sock!==ws)return;P.sock=null;pvpLost();};
}
// the connection dropped: keep trying while the match can still be going (an AI pilot drives your tank meanwhile)
function pvpLost(){
 const P=pvp;if(!P)return;
 if(P.phase==='find'){pvpFallback('Live match unavailable right now. Playing AI pilots.');return;}
 if(P.phase==='over'||P.ended)return;
 P.retry++;P.lostAt=P.lostAt||Date.now();
 if(Date.now()-P.lostAt>60000){
  pvpClose();const ov=findOv('vs');if(ov){ov.onClose=null;closeOverlay(ov);}
  if(state==='vs')state='menu';
  exitBattle();showToast('Lost the live match. Check your connection.');return;}
 clearTimeout(P.rt);P.rt=setTimeout(()=>{if(pvp===P&&!P.sock)pvpConnect();},Math.min(3000,400*P.retry));
}
function pvpMsg(m){
 const P=pvp;
 switch(m.k){
  case 'w':P.n=m.n;P.cap=m.cap;P.left=m.left;P.t0=Date.now();{const ov=findOv('find');if(ov)ov.re();}return;
  case 'solo':pvpFallback('No live pilots right now. Playing AI pilots.');return;
  case 'x':if(P.phase==='find')pvpFallback('Live match unavailable right now. Playing AI pilots.');else{pvpClose();exitBattle();showToast('That live match is over.');}return;
  case 'go':pvpGo(m);return;
  case 'u':pvpRoster(m.units);uiDirty();return;   // a chassis swap: the VS screen or the round screen redraws
  case 'f':pvpFight(m);return;
  case 's':pvpSnap(m);return;
  case 'r':pvpRound(m);return;
  case 'rs':pvpRoundStart(m);return;
  case 'res':pvpResult(m.r);return;
  case 'end':P.ended=true;if(P.sock)try{P.sock.onclose=null;P.sock.close(1000,'done');}catch(e){}P.sock=null;return;
 }
}

// ---- seeing the world from your side ----
// team swap (your team is 0) and the half-turn for team 1: positions, angles, team ids, scores
const pvT=t=>{const v=pvp.team;return t===v?0:t===0?v:t;};
const pvX=x=>pvp.flip?W-x:x,pvY=y=>pvp.flip?H-y:y,pvA=a=>pvp.flip?a+Math.PI:a;
const pvSwap=a=>pvp.team===1&&!isSolo(matchG)?[a[1],a[0]]:a;
function pvpUnit(r,old){
 const u=old||{buffs:[],sp:0,sup:null,flash:0,elev:0,trail:[],cd:0,lk:null};
 Object.assign(u,{id:r.id,team:pvT(r.team),name:r.name,cls:r.cls,wtype:r.wtype,wtier:r.wtier,gems:r.gems||[],gemM:r.gemM||{},dscale:r.dscale,aura:r.aura,paint:r.paint,skin:r.skin,mhp:r.mhp,spdM:r.spdM||1,ai:!!r.ai,hum:!r.ai,ctl:'far',dmgM:1,critB:0,fillM:1});
 if(!old){u.x=pvX(r.x);u.y=pvY(r.y);u.ang=pvA(r.ang||0);u.hd=u.ang;u.hp=r.mhp;u.ox=u.x;u.oy=u.y;}
 return u;
}
function pvpRoster(list){
 if(!list)return;
 units=list.map(r=>pvpUnit(r,units[r.id]&&units[r.id].id===r.id?units[r.id]:null));
 me=units[pvp.me];me.ctl='me';
}
const pvpLiveFoes=()=>units.some(u=>u.team!==0&&!u.ai);   // the VS screen only says "Live opponents" when it's true
function pvpGo(m){
 const P=pvp,fresh=!P.live;
 Object.assign(P,{live:true,me:m.me,team:m.team,flip:m.flip,g:m.g,m:m.m,feat:m.feat,lostAt:null,phase:m.phase==='vs'?'vs':m.phase==='round'?'round':'play'});
 if(fresh||curMap!==m.map){setMap(m.map);P.crates=null;}
 matchG=m.g;MM={n:isSolo(m.g)?1:MODES[m.m].n,series:!!m.series,mp:save.mp||0};
 if(fresh)units=[];
 pvpRoster(m.units);
 pvpCrateMap();
 if(m.phase==='vs'){
  state='vs';closeFind();
  const old=findOv('vs');if(old){old.onClose=null;closeOverlay(old);}   // back after a drop on the VS screen: a fresh one
  showVS({live:true,ms:m.vs});
 }else if(fresh||!inBattle()){   // back after a drop, mid-fight
  closeFind();const ov=findOv('vs');if(ov){ov.onClose=null;closeOverlay(ov);}
  series=m.series?{w:[0,0],round:1}:null;
  state=m.phase==='round'?'round':'play';
  if(!inBattle())onMatchStart();
 }
}
function pvpFight(m){
 const P=pvp;if(!P)return;
 const ov=findOv('vs');if(ov){ov.onClose=null;closeOverlay(ov);}
 clearInterval(vsTimer);vsTimer=null;
 pvpRoster(m.units);
 for(const u of units){u.sx=u.x;u.sy=u.y;u.tp=0;u.deaths=0;u.dead=0;u.st=null;}
 series=MM.series?{w:[0,0],round:1}:null;
 bullets=[];boxes=[];shells=[];warns=[];timeLeft=GTYPES[matchG].t;elapsed=0;gscore=[0,0];evt=null;
 gzones=null;cry=null;storm=null;
 pops=[];nums=[];beams=[];blasts=[];novas=[];feed=[];shakeT=0;shakeM=0;
 P.phase='play';P.snaps=[];P.evq=[];P.off=null;P.tp=0;P.sent=null;
 state='play';
 startBanners();
 onMatchStart();
}
// server crate ids -> this phone's crates (the map is turned for team 1, so crate i is the mirror one)
function pvpCrateMap(){
 const M=MAPS[curMap],P=pvp;P.crates={};
 (M.crates||[]).forEach(([x,y,w,h],i)=>{const cx=pvp.flip?W-x-w:x,cy=pvp.flip?H-y-h:y;P.crates[i]=crates.find(c=>Math.abs(c[0]-cx)<0.01&&Math.abs(c[1]-cy)<0.01)||null;});
}
function pvpCrateGone(id){
 const P=pvp;if(!P||!P.crates)return;const c=P.crates[id];if(!c)return;P.crates[id]=null;
 for(const L of [walls,baseWalls,navWalls]){const i=L.indexOf(c);if(i>=0)L.splice(i,1);}
 const i=crates.indexOf(c);if(i>=0)crates.splice(i,1);
}

// ---- snapshots: buffered, drawn ~0.1s in the past so other tanks glide between updates ----
function pvpSnap(m){
 const P=pvp;if(!P||!P.live)return;
 const now=performance.now(),st=m.t*PVP_TMS,off=now-st;
 if(P.off===null||off<P.off)P.off=off;else P.off+=(off-P.off)*0.02;   // the fastest arrival sets the clock; drift up slowly
 P.jit+=(Math.min(400,off-P.off)-P.jit)*0.1;
 P.delay=Math.max(80,Math.min(300,70+2*P.jit));
 P.lastSnapAt=now;
 P.snaps.push({t:st,s:m.s});
 if(P.snaps.length>40)P.snaps.splice(0,P.snaps.length-40);
 for(const e of (m.e||[]))P.evq.push(e);
 // your own tank: a resync (respawn, new round, or a move the server couldn't follow) snaps you to the server's spot now
 const mu=m.s.u[P.me];
 if(mu&&mu[12]!==P.tp){P.tp=mu[12];me.x=pvX(mu[0]);me.y=pvY(mu[1]);me.ox=me.px=me.x;me.oy=me.py=me.y;me.elev=mu[6]&1;me.dash=null;P.sent=null;}
}
const lerp=(a,b,k)=>a+(b-a)*k;
const lerpA=(a,b,k)=>{let d=b-a;d=Math.atan2(Math.sin(d),Math.cos(d));return a+d*k;};
function pvpApply(rt){
 const S=pvp.snaps;if(!S.length)return;
 let i=S.length-1;while(i>0&&S[i].t>rt)i--;
 const A=S[i],B=S[i+1]||null,k=B?Math.max(0,Math.min(1,(rt-A.t)/(B.t-A.t||1))):0,s=A.s;
 s.u.forEach((a,id)=>{
  const u=units[id];if(!u)return;
  const b=B&&B.s.u[id],jump=b&&b[12]!==a[12],cur=b&&k>0.5?b:a;
  if(u!==me){
   if(b&&!jump){u.x=pvX(lerp(a[0],b[0],k));u.y=pvY(lerp(a[1],b[1],k));u.ang=pvA(lerpA(a[2],b[2],k));u.hd=pvA(lerpA(a[3],b[3],k));}
   else{u.x=pvX(cur[0]);u.y=pvY(cur[1]);u.ang=pvA(cur[2]);u.hd=pvA(cur[3]);}
   u.elev=cur[6]&1;u.dash=cur[6]&2?{t:0.1,dx:0,dy:0}:null;u.dashCd=cur[9]/10;
  }else u.ang=pvA(lerpA(a[2],b?b[2]:a[2],k));
  u.hp=cur[4];u.sp=cur[5];u.rep=cur[6]&4?0.3:0;u.away=!!(cur[6]&16);u.cry=cur[7];u.bty=cur[8];u.deaths=cur[10];u.dead=cur[11]/10;u.mhp=cur[15];
  u.buffs=cur[13]?cur[13].map(([ki,tk])=>({k:BUFF_KEYS[ki],taken:tk})):[];
  u.sup=cur[14]?{t:cur[14][0],ang:pvA(cur[14][1]),w:u.wtype}:null;
 });
 timeLeft=B?lerp(s.tl,B.s.tl,k):s.tl;elapsed=B?lerp(s.el,B.s.el,k):s.el;
 gscore=pvSwap(s.gs);
 boxes=s.bx.map(([x,y])=>({x:pvX(x),y:pvY(y),life:20,age:1}));
 if(pvp.crates){const have={};for(const [id,hp] of s.cr){have[id]=1;const c=pvp.crates[id];if(c){if(hp<c.hp)c.flash=0.08;c.hp=hp;}}for(const id in pvp.crates)if(pvp.crates[id]&&!have[id])pvpCrateGone(+id);}
 shells=s.sh.map(([id,x,y])=>{const o=B&&B.s.sh.find(q=>q[0]===id);return {id,x:pvX(o?lerp(x,o[1],k):x),y:pvY(o?lerp(y,o[2],k):y)};});
 if(s.z){const z=s.z,sw=pvp.team===1;gzones=[{x:pvX(z[0]),y:pvY(z[1]),r:z[2],cap:sw?-z[3]:z[3],own:z[4]<0?-1:pvT(z[4]),p0:sw?z[6]:z[5],p1:sw?z[5]:z[6],t:z[7],next:z[8]===null?null:{x:pvX(z[8]),y:pvY(z[9])}}];}else gzones=null;
 if(s.cy){const c=s.cy;cry={mine:{x:10,y:16},loose:c[0].map(([x,y,l,age])=>({x:pvX(x),y:pvY(y),l,age})),cd:c[1]?{team:pvT(c[1][0]),t:c[1][1]}:null,cnt:pvSwap(c[2])};}else cry=null;
 storm=s.st?{x:pvX(s.st[0]),y:pvY(s.st[1]),r:B&&B.s.st?lerp(s.st[2],B.s.st[2],k):s.st[2],l:0}:null;
 evt=s.ev?{k:s.ev[0],t:s.ev[1]}:null;
 if(s.se){const w=pvSwap([s.se[0],s.se[1]]);series={w,round:s.se[2]};}
}
// events from the server, turned to your side, then drawn by the same code as AI matches (match.js onSimEv)
const EV_POS={n:[1],p:[1],B:[1],M:[1,3],V:[1],z:[3],g:[3],X:[2],w:[1],m:[1],b:[3]},EV_VEC={b:[5]},EV_TEAM={M:5,V:4,z:2,c:1},EV_KEEP={k:1,X:1,F:1,J:1,T:1,z:1,c:1};
function pvpEv(e){
 const a=e.slice(1),T=a[0];
 for(const i of (EV_POS[T]||[])){a[i]=pvX(a[i]);a[i+1]=pvY(a[i+1]);}
 if(pvp.flip)for(const i of (EV_VEC[T]||[])){a[i]=-a[i];a[i+1]=-a[i+1];}
 if(EV_TEAM[T]!==undefined)a[EV_TEAM[T]]=pvT(a[EV_TEAM[T]]);
 if(T==='p'&&typeof a[4]==='number')a[4]=pvT(a[4]);
 onSimEv(a);
}
// shots: the server says who fired where; the phone flies them until they hit something or the server says they hit
function pvpShot(a){
 const o=units[a[2]];if(!o)return;
 const mine=o===me;
 bullets.push({id:a[1],o,x:mine?me.x:a[3],y:mine?me.y:a[4],vx:a[5],vy:a[6],hi:!!a[7],dm:a[8],life:a[9]});
 if(mine)fx('shot',o.wtype);
}
function pvpBulletHit(id){const i=bullets.findIndex(q=>q.id===id);if(i>=0)bullets.splice(i,1);}
function pvpShots(dt){
 for(const q of bullets){
  q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;
  if(q.x<0||q.x>W||q.y<0||q.y>H||inRock(q.x,q.y))q.life=0;
  else for(const wl of (q.hi?baseWalls:walls))if(q.x>wl[0]&&q.x<wl[0]+wl[2]&&q.y>wl[1]&&q.y<wl[1]+wl[3]){q.life=0;break;}
 }
 bullets=bullets.filter(q=>q.life>0);
}

// ---- every frame ----
function pvpFrame(dt){
 const P=pvp;if(!P)return;
 if(P.phase==='find')return;
 const now=performance.now();
 if(P.off!==null&&P.snaps.length){
  const rt=now-P.off-P.delay;
  // events due by now; after the app was in the background, old shots and numbers are skipped (kills, crates and the feed still apply)
  while(P.evq.length&&P.evq[0][0]*PVP_TMS<=rt){const e=P.evq.shift();if(e[0]*PVP_TMS<rt-600&&!EV_KEEP[e[1]])continue;pvpEv(e);}
  if(P.evq.length>3000)P.evq.splice(0,P.evq.length-3000);
  pvpApply(rt);
 }
 if(state==='play'&&P.phase==='play'&&me&&me.hp>0){
  // your tank answers your stick right away; the server follows your reports at real speed
  if(!dashStep(me,dt)){const [ix,iy]=inputVec(),k=STAT.speed*spdMult(me)*(me.sup?0.6:1)*slowAt(me)*dt;me.x+=ix*k;me.y+=iy*k;push(me);}
  const dx=me.x-(me.px===undefined?me.x:me.px),dy=me.y-(me.py===undefined?me.y:me.py);me.px=me.x;me.py=me.y;
  if(Math.hypot(dx,dy)>0.004){let d=Math.atan2(dy,dx)-me.hd;d=Math.atan2(Math.sin(d),Math.cos(d));const st=7*dt;me.hd+=Math.max(-st,Math.min(st,d));}
  const s=P.sent,moved=!s||Math.hypot(me.x-s.x,me.y-s.y)>0.02;
  if(!s||(moved&&now-s.t>=100)||now-s.t>=1000){P.sent={x:me.x,y:me.y,t:now};pvpSend({k:'m',x:Math.round(me.x*100)/100,y:Math.round(me.y*100)/100,tp:P.tp});}
 }
 pvpShots(dt);
 for(const u of units)u.flash=Math.max(0,(u.flash||0)-dt);   // hit flashes (the AI-match loop does this in update())
 for(const c of crates)c.flash=Math.max(0,(c.flash||0)-dt);
 fxTick(dt);
}
const pvpLag=()=>!!pvp&&pvp.live&&pvp.phase==='play'&&(!pvp.sock||performance.now()-pvp.lastSnapAt>800);   // drawHUD shows "Reconnecting"
// your controls, sent to the server (the super and dash buttons, keyboard)
function pvpSuper(a){
 if(!me||me.hp<=0||me.sup||me.sp<SUPER_MAX)return false;
 if(a===undefined||a===null){const e=nearestFoe(me);if(!e)return false;if(SUP[me.wtype||'pulse'].kind!=='nova'&&!los(me,e)){showToast('No line of sight. Drag from Super to aim it yourself.');return false;}}
 pvpSend({k:'s',a:a===undefined||a===null?null:Math.round(a*1000)/1000});fx('super');return true;
}
function pvpDash(ix,iy){if(!useDash(me,ix,iy))return false;pvpSend({k:'d',x:Math.round(me.dash.dx*100)/100,y:Math.round(me.dash.dy*100)/100});return true;}

// ---- rounds and the result ----
function pvpRound(m){
 const P=pvp;if(!P)return;
 P.phase='round';state='round';
 series={w:m.w,round:m.round};
 fx(m.res==='won'?'win':m.res==='lost'?'lose':'draw');
 const foe=units.find(u=>u.team===1);
 setTimeout(()=>{if(pvp===P&&P.phase==='round')onRoundEnd({won:m.res==='won',lost:m.res==='lost',w:m.w,round:m.round,foe:foe?foe.cls:null,live:true,ms:Math.max(1000,m.left-700)});},700);
}
function pvpRoundStart(m){
 const P=pvp;if(!P)return;
 setMap(curMap);pvpCrateMap();
 pvpRoster(m.units);
 bullets=[];shells=[];warns=[];pops=[];nums=[];beams=[];blasts=[];novas=[];feed=[];shakeT=0;shakeM=0;
 for(const u of units){u.trail=[];u.sup=null;u.buffs=[];}
 me.dash=null;me.dashCd=0;me.rdyShown=false;
 P.phase='play';state='play';
 roundBanner();
 onRoundStart();
}
function pvpResult(r){
 const P=pvp;if(!P||P.gotRes)return;
 P.gotRes=true;
 if(r.quit&&P.quitting)return;   // you left: forfeit() already counted the loss
 P.phase='over';state='over';
 const before=save.earned||0;
 if(r.awarded>0)bankPts(r.awarded);   // the server already credited it (and, in Telegram, the quests and pass XP too)
 if(!SRV_ECO){if(r.won)save.streak=(save.streak||0)+1;else if(!r.drawn&&!r.top3)save.streak=0;}
 const st=r.stats||{};
 afterMatch({won:r.won,drawn:r.drawn,place:r.place,score:r.score,mode:r.m==='solo'?modeKey():r.m,feat:r.featured,top3:r.top3,base:r.base,modeX:r.modeX,featX:r.featX,
  league:r.league,streak:r.streak,streakBonus:r.streakBonus,pts:r.pts,awarded:r.awarded||0,before,live:true,quit:r.quit,seriesW:r.series&&r.series.w,
  st:{dmg:st.dmg||0,sup:st.sups||0,box:st.boxes||0,taken:st.taken||0,kills:st.kills||0,caps:st.caps||0,cry:st.cry||0,stars:st.stars||0,low:typeof st.low==='number'?st.low:0},quick:!!r.quick});
 if(SRV_ECO)applyEcoSoon();   // the server's record of this match replaces the phone's preview
}
// leaving mid-match: a loss, no points. On the VS screen it costs nothing (an AI pilot takes the seat)
function pvpLeave(){const P=pvp;if(!P)return;P.quitting=true;pvpSend({k:'q'});const s=P.sock;pvpClose();if(s)try{s.close(1000,'left');}catch(e){}}
