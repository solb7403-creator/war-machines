'use strict';
// =====================================================================
// ui: menus (HTML), sheets, VS + results screens, toasts.
// The battle itself is drawn on the canvas by render.js.
// Hooks other files call: uiDirty, showToast, showReveal, onMatchStart, onMatchEnd
// =====================================================================
const $=(s,r)=>(r||document).querySelector(s);
const ICON={
 play:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/></svg>',
 garage:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M14.7 6.3a4 4 0 0 0-5.3 5.2L3.8 17.1a1.6 1.6 0 0 0 0 2.2l.9.9a1.6 1.6 0 0 0 2.2 0l5.6-5.6a4 4 0 0 0 5.2-5.3l-2.6 2.6-2.3-.6-.6-2.3z"/></svg>',
 shop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7.5 12 3.5l9 4v9l-9 4-9-4z"/><path d="M3 7.5l9 4 9-4M12 11.5v9M7.5 5.5l9 4"/></svg>',
 quests:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M5.5 21V3.5M5.5 4h12l-2.5 4.2 2.5 4.3h-12"/></svg>',
 ranks:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M2.5 20.5h19M4.5 20.5v-6h5v6M9.5 20.5V8.5h5v12M14.5 20.5v-9h5v9"/></svg>',
 cog:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/></svg>',
 arena:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8l1.9 5.1 5.3-1.6-2.2 5 4.6 2.9-5.4 1 .6 5.4L12 17.3l-4.8 3.3.6-5.4-5.4-1 4.6-2.9-2.2-5 5.3 1.6z"/></svg>',
 zone:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-dasharray="2.6 3"/><path d="M14.6 7.6a5 5 0 1 0 2.2 7.6 4.1 4.1 0 0 1-2.2-7.6z" stroke-linejoin="round"/></svg>',
 random:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3.5l10 10H21M3 17h3.5l3-3M14 10l2.5-3H21M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>',
 crystal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.8 19 9.5 12 21.2 5 9.5z"/><path d="M5 9.5h14M12 2.8 9.3 9.5 12 21.2l2.7-11.7z"/></svg>',
 bounty:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 6.6l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"/></svg>',
 royale:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M4.2 17.2 3 7.6l5 3.9 4-6 4 6 5-3.9-1.2 9.6z"/><path d="M4.5 20.5h15"/></svg>',
 boss:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><rect x="3.5" y="8.5" width="17" height="11" rx="2.5"/><circle cx="12" cy="14" r="3.2"/><path d="M12 10.8V3M8.5 8.5 7 5.5M15.5 8.5 17 5.5"/></svg>'};
const TAB_LIST=[['play','Play'],['garage','Garage'],['shop','Shop'],['quests','Quests'],['ranks','Ranks']];
let uiTab='play',uiReady=false,uiRaf=0,ptrDown=false,heroCv=null,lbScope='overall';
const stale=new Set(TAB_LIST.map(t=>t[0]));
const inBattle=()=>document.body.classList.contains('battle');

// ---------- render scheduling ----------
function uiDirty(s){
 if(!s)TAB_LIST.forEach(t=>stale.add(t[0]));else stale.add(s);
 if(uiReady&&!uiRaf)uiRaf=requestAnimationFrame(renderUI);
}
function renderUI(){
 uiRaf=0;
 if(ptrDown){uiRaf=requestAnimationFrame(renderUI);return;}   // never swap a button out from under a finger
 renderTop();
 if(!inBattle()&&stale.has(uiTab)){stale.delete(uiTab);renderScreen(uiTab);}
 for(const ov of overlays)if(ov.re)ov.re();
}
function renderScreen(t){
 const el=$('#s-'+t);if(!el)return;
 const html=SCREENS[t]();
 el.innerHTML=html;
 paintArt(el);
}
function setTab(t){
 if(!SCREENS[t])return;
 uiTab=t;
 document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.arg===t));
 document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id==='s-'+t));
 if(t==='ranks')loadLB();
 if(t==='quests')loadSquad();
 if(t==='shop'&&save.payCur==='sol')fetchPrices();
 if(t==='shop'&&typeof loadLB==='function')loadLB();   // the liquidity fund total
 stale.add(t);renderUI();
}

// ---------- top bar + tab badges ----------
function questsAlert(){
 if(!loginState().claimedToday)return true;
 if(passReady())return true;
 if(dailyQuests().some(q=>q.done&&!q.claimed)||weeklyQuests().some(q=>q.done&&!q.claimed))return true;
 if(!save.wq.claimed&&(save.wq.n||0)>=WQ_GOAL)return true;
 if(QUESTS.some(q=>{const e=save.q[q.id];return e&&e.done&&!e.claimed;}))return true;
 return refPending()>0;
}
const nextUp=()=>UORDER.map(k=>({k,lv:save.up[k],c:save.up[k]<4&&upLevels(save.up)<BUILD_MAX?UPS[k].costs[save.up[k]]:Infinity})).sort((a,b)=>a.c-b.c)[0];
const garageAlert=()=>{const u=nextUp();return u.c<=(save.pts||0);};
function renderTop(){
 const p=$('#ptsVal');if(!p)return;
 p.textContent=fmtNum(save.pts);
 const t=tierIdx(),tc=$('#tierChip');
 tc.innerHTML='<i style="background:'+TIERC[t]+'"></i><span>'+TIERS[t]+'</span>';
 const al={quests:questsAlert(),garage:garageAlert()};
 document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('alert',!!al[b.dataset.arg]));
}

// ---------- shared pieces ----------
const rarBadge=it=>'<span class="rar" style="background:'+gcol(it)+'">'+gbadge(it)+'</span>';
const sec=(t,aside,info)=>'<h3 class="sec">'+t+(info?' <button class="info" data-act="info" data-arg="'+info+'" aria-label="About '+esc(t)+'">?</button>':'')+(aside?'<span class="aside">'+aside+'</span>':'')+'</h3>';
const coin=()=>'<span class="coin sm"></span>';
function eqId(isW){
 if(isW)return save.weapon==='moon'?'moon':save.weapon+':'+Math.max(0,save.wTier[save.weapon]||0)+((save.wSal&&save.wSal[save.weapon])?'s':'');
 return save.chassis+':'+Math.max(0,save.cTier[save.chassis]||0)+((save.cSal&&save.cSal[save.chassis])?'s':'');
}
function ownedList(isW){   // everything in this slot: owned first (best first), then what is still to find
 const keys=isW?WORDER:CHORDER,items=[];
 if(isW&&save.moonbeam)items.push(getW('moon'));
 for(let t=2;t>=0;t--)keys.forEach(k=>{
  const own=isW?ownW(k,t):ownC(k,t),it=isW?getW(k,t,false):getC(k,t,false);it.locked=!own;items.push(it);
  if(t>0&&salvOf(k,t))items.push(isW?getW(k,t,true):getC(k,t,true));
 });
 const eq=eqId(isW);
 items.sort((a,b)=>(a.id===eq?-1:b.id===eq?1:0)||((a.locked?1:0)-(b.locked?1:0))||(b.mult-a.mult));
 return items;
}
const gearKey=it=>(it.premium?'moon':(it.arch||it.cls))+':'+Math.max(0,it.tier)+':'+(it.sal?1:0);
function gearMeta(isW,it){
 if(isW)return it.dps+' damage per second, super: '+WEAPONS[it.arch].sup;
 return 'Health ×'+it.hp+', speed ×'+it.spd+', beats '+CH[COUNTER[it.cls]].n;
}
function winRange(gk,mk){
 const st=(save.streak||0)+1;
 if(gk==='random'){const v=GT_ORDER.map(g=>winPoints(g,mk)+streakPts(g,mk,st));return [Math.min(...v),Math.max(...v)];}
 const v=winPoints(gk,mk)+streakPts(gk,mk,st);return [v,v];
}
const shortNum=n=>n<10000?fmtNum(n):fmtK(Math.round(n/100)*100);
const rangeTxt=r=>r[0]===r[1]?'+'+fmtNum(r[0]):'+'+fmtNum(r[0])+' to +'+fmtNum(r[1]);
const pct1=q=>(Math.round(q*1000)/10)+'%';
const modeName=(gk,mk)=>GT_PICK[gk].label+(isSolo(gk)?'':' '+mk);
const daysLeft=()=>seasonFrozen()?PASS_LEN:Math.max(1,Math.ceil(seasonEndMs()/864e5));
const leftTxt=()=>seasonFrozen()?PASS_LEN+' days, clock starts Nov 1':daysLeft()+(daysLeft()===1?' day':' days')+' left';
const bonusTxt=()=>seasonNo()===1?'Launch season: '+PASS_BONUS+' bonus tiers for early pilots.':'';

// ---------- PLAY ----------
function playNudge(){
 const L=loginState();
 if(!L.claimedToday){const nb=streakBoost(L.next);return {gem:'★',b:giftReady()?'Welcome back: your gift is ready':'Daily reward ready',s:'+'+fmtNum(L.reward)+' points'+(giftReady()?' and a free Rare gem cache':', day '+(L.slot+1)+' of 7')+(nb?', +'+Math.round(nb*100)+'% quest points':''),act:'login'};}
 const dq=dailyQuests().find(q=>q.done&&!q.claimed)||weeklyQuests().find(q=>q.done&&!q.claimed);
 if(dq)return {gem:'✓',b:'Quest complete',s:dq.t+': +'+fmtNum(qPts(dq.pts))+' points',act:'tab',arg:'quests'};
 const pr=passReady();
 if(pr)return {gem:String(passTier()),b:'Lunar Pass reward ready',s:pr+(pr===1?' reward':' rewards')+' to claim',act:'pass'};
 if(giftPending()&&(save.mp||0)>=1)return {gem:'🎁',b:'Come back tomorrow: a free Rare gem cache',s:'It unlocks in '+fmtDur(msToDailyReset())+'. Claim it with tomorrow’s daily reward.',act:'tab',arg:'quests'};
 const fm=featuredMode();
 if(gtypeKey()!==fm&&save.featSeen!==dayNum()&&(save.mp||0)>=2)return {svg:ICON[fm],b:'Featured today: '+GTYPES[fm].label,s:'+25% points and +10 pass XP a match. Tap to switch.',act:'feat'};
 if((save.mp||0)>=3){   // each deal nudges once per period, while it's unused
  if(dealWeekFree()&&save.wdealSeen!==weekNum())return {gem:'%',b:'Weekly epic deal: 25% off',s:DEAL_TXT.w.on,act:'deals',arg:'w'};
  if(dealDayFree()&&save.dealSeen!==dayNum())return {gem:'%',b:'Daily gem deal: 30% off',s:DEAL_TXT.d.on,act:'deals',arg:'d'};
 }
 const u=nextUp();
 if(u.c<=(save.pts||0))return {gem:'+',b:'Upgrade ready',s:UPS[u.k].n+' to level '+(u.lv+1)+' for '+fmtNum(u.c)+' points',act:'up',arg:u.k};
 if(IN_TG&&(save.mp||0)>=3&&squad().length<3)return {gem:'↗',b:'Invite friends',s:'Up to 7,500 points for each friend who keeps playing',act:'share'};
 return null;
}
const GT_DESC={arena:'Destroy the enemy team',zone:'Hold the zone, first to 100',crystal:'Hold 10 crystals for 15s',bounty:'Kills earn stars',royale:'6 tanks, 1 survivor',boss:'Take down a megatank',random:'A different mode each match'};
function setupPickers(){
 const gk=gtypeKey(),mk=modeKey(),mp=mapKey(),fm=featuredMode(),solo=isSolo(gk),liveOK=IN_TG&&(save.mp||0)>=1,live=liveOK&&isLiveMode(gk);
 return sec('Game type',liveOK?'Live = real pilots':'','gtypes')+
  '<div class="modes">'+GT_ORDER.concat('random').map(k=>'<button class="mode'+(gk===k?' on':'')+(k==='random'?' rnd':'')+'" data-act="gtype" data-arg="'+k+'">'+(k===fm?'<span class="feat">+25% today</span>':'')+(liveOK&&isLiveMode(k)?'<span class="live">Live</span>':'')+ICON[k]+'<b>'+GT_PICK[k].label+'</b><small>'+GT_DESC[k]+'</small></button>').join('')+'</div>'+
  sec('Team size',solo?'':live?'Live pilots first, AI fills empty seats':MODES[mk].n>1?'AI pilots fill your team':'','modes')+
  (solo?'<div class="seg"><button class="on solo" disabled>Solo<small>'+(live?'Up to 6 live pilots, AI fills the rest':'You and 5 AI pilots')+', free for all. 1st place pays '+fmtNum(winRange(gk,mk)[0])+'</small></button></div>'
   :'<div class="seg c3">'+Object.keys(MODES).map(k=>{const r=winRange(gk,k);return '<button class="'+(mk===k?'on':'')+'" data-act="mode" data-arg="'+k+'">'+k+'<small>win '+(r[0]===r[1]?fmtNum(r[0]):fmtNum(r[0])+'–'+fmtNum(r[1]))+'</small></button>';}).join('')+'</div>')+
  sec('Map',live?'Live matches pick one at random':'')+
  '<div class="maps">'+['classic','overpass','longshot','craters','random'].map(id=>'<button class="map'+(mp===id?' on':'')+'" data-act="map" data-arg="'+id+'"><canvas data-art="map:'+id+'"></canvas><b>'+(MAPS[id].short||MAPS[id].n)+'</b></button>').join('')+'</div>'+
  '<p class="dimtxt" style="margin-top:8px">'+esc(MAPS[mp].d)+'</p>';
}
function openSetup(){sheet('setup',()=>'<h3>Battle setup</h3>'+setupPickers()+'<button class="btn btn-go block" style="margin-top:18px" data-act="setupdone">Done</button>');}
function renderPlay(){
 const W0=getW(save.weapon),C0=getC(save.chassis),pw=calcPower(),brk=powerBracket(pw);
 const gk=gtypeKey(),mk=modeKey(),mp=mapKey(),n=playNudge(),wr=winRange(gk,mk);
 return '<div class="hero"><canvas data-art="hero"></canvas>'+
   '<button class="loadline" data-act="tab" data-arg="garage"><span class="nm">'+esc(C0.name)+'</span><span class="sub">'+esc(W0.name)+', power <b>'+pw+'</b>, '+brk.n+' league</span></button></div>'+
  '<div class="lobby">'+
  (n?'<button class="nudge" data-act="'+n.act+'" data-arg="'+(n.arg||'')+'"><span class="gem">'+(n.svg||n.gem)+'</span><span><b>'+n.b+'</b><br><span>'+esc(n.s)+'</span></span><span class="chev">›</span></button>':'')+
  '<button class="setup" data-act="setup"><canvas data-art="map:'+mp+'"></canvas><span class="grow"><span class="nm">'+modeName(gk,mk)+(gk===featuredMode()?' <span class="featchip">+25%</span>':'')+(IN_TG&&(save.mp||0)>=1&&isLiveMode(gk)?' <span class="livechip">Live</span>':'')+'</span><span class="mut">'+(mp==='random'?'Random map':esc(MAPS[mp].n))+'</span><span class="dimtxt">'+(gk==='arena'&&mk==='1v1'?'Best of 3 rounds, first to 2':GT_DESC[gk])+'</span></span><span class="chg">Change</span></button>'+
  '<button class="fight" data-act="fight"><span class="big">FIGHT</span><span class="small">Win '+rangeTxt(wr)+' points</span></button>'+
  (quickOK()?'<button class="quick" data-act="quick"><b>QUICK MATCH</b><span>Live pilots, any mode, random map</span></button>':'')+
  '</div>';
}

// ---------- GARAGE ----------
function renderGarage(){
 const st=buildStats(),pw=calcPower(),brk=powerBracket(pw),W0=getW(save.weapon),C0=getC(save.chassis);
 const stat=(v,l)=>'<div class="stat"><b>'+v+'</b><span>'+l+'</span></div>';
 const gearRow=(isW,it)=>'<button class="gear" data-act="gear" data-arg="'+(isW?'w':'c')+'"><div class="ico"><canvas data-art="gear:'+(isW?'w':'c')+':'+gearKey(it)+'"></canvas></div>'+
  '<div class="grow"><div class="kind">'+(isW?'Weapon':'Chassis')+'</div><div class="nm">'+esc(it.name)+' '+rarBadge(it)+'</div><div class="meta">'+gearMeta(isW,it)+'</div></div><span class="chev">›</span></button>';
 const coreCard=i=>{const k=save.cores[i];
  if(!k)return '<button class="core empty" data-act="core" data-arg="'+i+'"><div class="gemi" style="border:1.5px dashed var(--dim);box-shadow:none"></div><b>Empty</b><span>Add a core</span></button>';
  const lv=save.gemLvl[k]||1;
  return '<button class="core" data-act="core" data-arg="'+i+'"><div class="gemi" style="background:'+GEM[k].c+';color:'+GEM[k].c+'"></div><b>'+GEM[k].name+'</b><span>Lv '+lv+', '+fmtCore(k,coreVal(k,lv))+'</span></button>';};
 const used=upLevels(save.up),full=used>=BUILD_MAX,inv=upInvested(save.up);
 const upRow=k=>{const U=UPS[k],lv=save.up[k],max=lv>=4,c=max?0:U.costs[lv],ok=!max&&!full&&(save.pts||0)>=c;
  return '<div class="up"><div class="grow"><div class="nm">'+U.n+' <span class="dimtxt">level '+lv+' of 4</span></div><div class="d">'+U.d+'</div><div class="bar4">'+[0,1,2,3].map(i=>'<i class="'+(i<lv?'f':'')+'"></i>').join('')+'</div></div>'+
   (max?'<span class="mut">Maxed</span>':full?'<span class="mut">Budget full</span>':'<button class="btn sm '+(ok?'btn-gold':'btn-quiet')+'" data-act="up" data-arg="'+k+'">'+coin()+fmtNum(c)+'</button>')+'</div>';};
 return labCards()+'<div class="powerline"><div class="grow"><div class="pw num">Power '+pw+'</div><div class="mut"><span style="color:'+brk.c+'">'+brk.n+' league</span>, points ×'+brk.mult+'</div></div><button class="info" data-act="info" data-arg="league" aria-label="About leagues">?</button></div>'+
  '<div class="stats">'+stat(fmtNum(st.hp),'Health')+stat(st.dps,'Damage/s')+stat(st.spd,'Speed')+stat(st.armor+'%','Armor')+stat(st.crit+'%','Crit')+'</div>'+
  sec('Gear')+gearRow(true,W0)+gearRow(false,C0)+
  '<button class="gear" data-act="paints"><div class="ico"><canvas data-art="tank:paint:'+esc(save.paint)+'"></canvas></div><div class="grow"><div class="kind">Paint</div><div class="nm">'+esc(myPaint().n)+'</div><div class="meta">Looks only. '+Object.keys(save.paints||{}).length+' of '+PAINT_ORDER.length+' owned</div></div><span class="chev">›</span></button>'+
  sec('Cores','Each type fits once','cores')+'<div class="cores">'+[0,1,2].map(coreCard).join('')+'</div>'+
  sec('Build',used+' of '+BUILD_MAX+' levels','build')+'<div class="bar14" aria-label="'+used+' of '+BUILD_MAX+' build levels used">'+Array.from({length:BUILD_MAX},(_,i)=>'<i class="'+(i<used?'f':'')+'"></i>').join('')+'</div>'+
  '<div class="ups list">'+UORDER.map(upRow).join('')+'</div>'+
  (inv?'<button class="q respec" data-act="respec"><div class="grow"><div class="t">Reset build</div><div class="p">'+(save.rsCr?'Paid reset ready: every level back to 0 and all '+fmtNum(inv)+' points back.':'Every level back to 0. Pay the fee in points and get '+fmtNum(Math.floor(inv*RESPEC_BACK))+' of the '+fmtNum(inv)+' back'+(respecTier(inv)?', or pay $'+respecTier(inv).toFixed(2)+' and keep all of them.':'.'))+'</div></div><span class="mut">Reset</span></button>':'')+
  (save.skin==='lunar'?'<div class="panel lunar">Lunar skin: +8% health and +8% damage, always on</div>':'');
}

// ---------- SHOP ----------
const CRATE_N={weapon:'weapon cache',chassis:'chassis crate',gem:'gem cache'};
const crateName=(tk,ri)=>TIER_N[ri]+' '+CRATE_N[tk];
function payNote(){
 if(save.payCur==='stars')return IN_TG?'Pay with Telegram Stars. No wallet needed.':'Stars work inside Telegram.';
 if(save.payCur==='ton')return tonWallet?'TON wallet connected':'Connect a TON wallet to pay';
 const w=SOL_WALLETS[save.solWallet]?save.solWallet:'phantom';
 return px.sol?'Pays from '+SOL_WALLETS[w].n:'Loading the SOL price…';
}
function crate(tk,ri){const f=crateFound(tk,ri),dk=dealOf(tk,ri);
 return '<button class="crate" data-act="crate" data-arg="'+tk+':'+ri+'"><div class="r" style="color:'+RCOL[ri]+'">'+TIER_N[ri]+'</div><canvas data-art="crate:'+tk+':'+ri+'"></canvas>'+
  '<div class="p">'+priceLabel(boxPrice(tk,ri),boxStars(tk,ri))+'</div><div class="f">'+(dk?'<span class="dealf">'+(dk==='d'?'30':'25')+'% off</span>':tk==='gem'?(boxMult(tk,ri)>1?'+'+Math.round((boxMult(tk,ri)-1)*100)+'% today':'Core shards'):(f>=3?'All 3 found':'Found '+f+' of 3'))+'</div></button>';}
// the two deals (rules.js): daily gem cache 30% off, weekly epic crate 25% off. Each is once per period, per pilot
const DEAL_TXT={d:{n:'Daily gem deal',off:'30% off',on:'Your first rare or epic gem cache today',full:'Your first rare or epic gem cache each day is 30% off. It resets at 00:00 UTC.',art:'crate:gem:2'},
 w:{n:'Weekly epic deal',off:'25% off',on:'One epic crate this week, your pick',full:'One epic crate a week is 25% off: weapon, chassis or gem, your pick. It resets Monday 00:00 UTC.',art:'crate:weapon:2'}};
function dealCard(k){const T=DEAL_TXT[k],free=k==='d'?dealDayFree():dealWeekFree();
 return '<button class="deal'+(free?'':' used')+'" data-act="deals" data-arg="'+k+'"><canvas data-art="'+T.art+'"></canvas><span class="tag">'+(free?T.off:'Used')+'</span><h4>'+T.n+'</h4>'+
  '<p>'+(free?T.on:'Back in '+fmtDur(k==='d'?msToDailyReset():msToWeeklyReset()))+'</p></button>';}
function openDeals(k){
 const T=DEAL_TXT[k],list=k==='d'?[['gem',1],['gem',2]]:[['weapon',2],['chassis',2],['gem',2]];
 sheet('deals',()=>'<h3>'+T.n+'</h3><p class="mut">'+T.full+((k==='d'?dealDayFree():dealWeekFree())?'':' You’ve used this one. Prices below are full price.')+'</p>'+
  '<div class="crates'+(list.length===2?' c2':'')+'" style="margin-top:12px">'+list.map(([tk,ri])=>crate(tk,ri)).join('')+'</div>');
}
// the launch liquidity fund: a share of every shop sale goes into the $LUNAR liquidity pool (the server counts it)
const LP_WALLET='HMEAerCzREnzr5zLwJYydFBhisxpUjBPpCuwVXY8owsK';   // the public liquidity wallet (Solana), topped up weekly to match the fund
const lpPct=()=>Math.round(((lbMeta&&lbMeta.lps)||0.25)*100);
function lpfLine(){return '<div class="cutline"><b>$'+fmtNum(lbMeta.lpf)+'</b><span>in the $LUNAR launch liquidity fund. '+lpPct()+'% of every shop sale goes into the pool, topped up weekly; the rest funds development. <button class="linkbtn inl" data-act="lpwallet">Verify the wallet on-chain</button></span></div>';}
// ---------- HYPERSPACE VAULT (rules.js): endless deposits, looks only ----------
const TOOTH_SVG='<svg viewBox="-0.6 -0.72 1.2 1.48" aria-hidden="true"><path d="M-.46 -.3Q-.5 -.64 -.22 -.6Q0 -.5 .22 -.6Q.5 -.64 .46 -.3Q.42 .05 .3 .55Q.2 .7 .12 .5Q.06 .18 0 .16Q-.06 .18 -.12 .5Q-.2 .7 -.3 .55Q-.42 .05 -.46 -.3Z"/></svg>';
const vtIdx=lv=>Math.max(0,Math.min(4,Math.floor((lv||0)/5)));
const vbadge=lv=>lv>0?' <span class="vb t'+vtIdx(lv)+'" title="Hyperspace Vault level '+lv+'">'+TOOTH_SVG+lv+'</span>':'';
const vname=(n,lv)=>lv>=3?'<span class="gname">'+esc(n)+'</span>':esc(n);   // gold name from Vault level 3
const myVl=()=>vaultLevel(save.vg);
function vaultProg(){const g=save.vg||0,lv=vaultLevel(g),lo=vaultNeed(lv),hi=vaultNeed(lv+1),next=VAULT_REW.find(x=>x.lv>lv);
 return {g,lv,f:Math.max(0,Math.min(1,(g-lo)/(hi-lo))),need:hi-g,next};}
function vaultPacks(){return '<div class="vpacks">'+VAULT_ORDER.map(id=>{const B=VAULT[id],bon=Math.round((B.g/B.stars-1)*100);
 return '<button class="vpack'+(id==='hyper'?' hyp':'')+'" data-act="vaultbuy" data-arg="'+id+'"><b>'+B.n+'</b><span class="vgold num">'+fmtNum(B.g)+' Gold</span><span class="bon">'+(bon>0?'+'+bon+'% bonus':'&nbsp;')+'</span><span class="p">'+priceLabel(B.ton,B.stars)+'</span></button>';}).join('')+'</div>';}
function vaultNextTxt(P){return fmtNum(P.need)+' Gold to level '+(P.lv+1)+(P.next?(P.next.lv===P.lv+1?': '+P.next.n:'. Next unlock, level '+P.next.lv+': '+P.next.n):'. Your badge keeps climbing.');}
function vaultCard(){
 const P=vaultProg();
 return '<div class="vaultbox"><span class="tag">Endless</span><div class="vhead"><canvas data-art="vault:'+P.lv+'"></canvas><div class="grow"><h4>Hyperspace Vault</h4>'+
  '<div class="mut">'+(P.lv?'Level '+P.lv+vbadge(P.lv)+(vaultTitle(P.lv)?' · '+vaultTitle(P.lv):'')+'<br>'+fmtNum(P.g)+' Gold deposited':'Deposit Gold to unlock looks you can’t get any other way: a gold tooth, a gold name, trails, auras and the Hyperspace paint.')+'</div></div></div>'+
  '<div class="bar"><i style="width:'+Math.round(P.f*100)+'%"></i></div><div class="dimtxt">'+esc(vaultNextTxt(P))+'</div>'+
  vaultPacks()+
  '<button class="linkbtn" data-act="vault">Every level and reward</button>'+
  '<p class="vfund">Every deposit backs LUNAR directly: '+lpPct()+'% goes into the $LUNAR launch liquidity pool, the other '+(100-lpPct())+'% funds development.</p>'+
  (GENESIS_OPEN||save.vgg?'<div class="vgen"><b>Genesis Gold'+(save.vgg?': '+fmtNum(save.vgg):'')+'</b><span>'+(GENESIS_OPEN?'Every Gold deposited before $LUNAR launches is recorded as Genesis Gold, kept for good. It may unlock limited-edition Genesis rewards down the road.':'Recorded before $LUNAR launched, kept for good. It may unlock limited-edition Genesis rewards down the road.')+'</span></div>':'')+
  '<p class="fnote">Gold is never spent and never expires: each deposit adds to your lifetime total, which sets your level. Looks only, no stats, power or points.</p></div>';
}
function openVault(){
 sheet('vault',()=>{const P=vaultProg();
  const rew=VAULT_REW.map(x=>{const got=P.lv>=x.lv;return '<div class="vrew'+(got?' got':'')+'"><span class="vlv">'+(got?'✓':'Lv '+x.lv)+'</span><div class="grow"><b>'+esc(x.n)+'</b><div class="mut">'+esc(x.d)+'</div></div></div>';}).join('');
  const tiers=VAULT_TIERS.map((T,i)=>'<span class="vtier">'+vbadge(i?i*5:1)+'<i>'+T.n+(i<4?' '+(i?i*5:1)+'–'+(i*5+4):' 20+')+'</i></span>').join('');
  return '<h3>Hyperspace Vault</h3><div class="vhead big"><canvas data-art="vault:'+P.lv+'"></canvas><div class="grow"><div class="vlvl">'+(P.lv?'Level '+P.lv:'Not started')+(vaultTitle(P.lv)?'<small>'+vaultTitle(P.lv)+'</small>':'')+'</div>'+
   '<div class="mut">'+fmtNum(P.g)+' Gold deposited</div><div class="bar"><i style="width:'+Math.round(P.f*100)+'%"></i></div><div class="dimtxt">'+esc(vaultNextTxt(P))+'</div></div></div>'+
   vaultPacks()+
   '<h4 class="vsec">Rewards</h4><div class="vrews">'+rew+'<div class="vrew'+(P.lv>25?' got':'')+'"><span class="vlv">26+</span><div class="grow"><b>Every level after</b><div class="mut">5,000 Gold a level, forever. Your level number and the Vault board keep climbing.</div></div></div></div>'+
   '<h4 class="vsec">Badge colors</h4><p class="mut">Your badge shows your level on every board and on the VS and results screens. Its color steps up every 5 levels.</p><div class="vtiers">'+tiers+'</div>'+
   '<h4 class="vsec">Good to know</h4><ul class="vnotes">'+
   '<li>Gold is never spent and never expires. It only adds up.</li>'+
   (GENESIS_OPEN||save.vgg?'<li><b>Genesis Gold.</b> Every Gold deposited before $LUNAR launches is recorded as Genesis Gold'+(save.vgg?' (yours: '+fmtNum(save.vgg)+')':'')+' and kept for good. It may unlock limited-edition Genesis rewards down the road, only for Genesis holders.</li>':'')+
   '<li>Looks only. The Vault never adds stats, power or points, so it can’t buy leaderboard rank.</li>'+
   '<li>Every deposit counts as verified shop spending, which is considered for the airdrop like any other purchase. It isn’t a purchase of $LUNAR and doesn’t guarantee any amount.</li>'+
   '<li>Every deposit backs LUNAR directly: '+lpPct()+'% goes into the $LUNAR launch liquidity pool, and the other '+(100-lpPct())+'% funds development, servers, promotion and partnerships.</li>'+
   '<li>Bigger bundles carry bonus Gold: Chest +5%, Vault +10%, Hyperspace +15%.</li></ul>'+
   '<button class="btn btn-quiet block" style="margin-top:14px" data-act="vaultboard">See the Vault board</button>';
 });
}
function renderShop(){
 const cur=save.payCur;
 const prem=(id,nm,d,ton,stars,owned)=>'<button class="premium" data-act="premium" data-arg="'+id+'"'+(owned?' disabled':'')+'><canvas data-art="'+(id==='moonbeam'?'gear:w:moon:2:0':'tank:lunar')+'"></canvas><b>'+nm+'</b><span>'+d+'</span><div class="p">'+(owned?'Owned':priceLabel(ton,stars))+'</div></button>';
 const salv=(tk,ri)=>'<div class="up"><div class="grow"><div class="nm">Salvaged '+TIER_N[ri].toLowerCase()+' '+(tk==='weapon'?'weapon':'chassis')+'</div><div class="d">A random '+TIER_N[ri].toLowerCase()+' '+(tk==='weapon'?'weapon':'chassis')+' at '+pct1(SALV_MIN[ri])+' to '+pct1(SALV_MAX[ri])+' power. Crate gear starts at 105%.</div></div><button class="btn sm '+((save.pts||0)>=SALV_PTS[ri]?'btn-gold':'btn-quiet')+'" data-act="salvage" data-arg="'+tk+':'+ri+'">'+coin()+fmtK(SALV_PTS[ri])+'</button></div>';
 const pend=save.pendingSol||save.pendingTx;
 return '<h2 class="title" data-act="devtap">Shop</h2>'+
  '<div class="seg c3">'+[['stars','Stars'],['ton','TON'],['sol','SOL']].map(([k,l])=>'<button class="'+(cur===k?'on':'')+'" data-act="paycur" data-arg="'+k+'">'+l+'</button>').join('')+'</div>'+
  '<div class="paybar"><span class="mut">'+payNote()+'</span>'+(cur==='ton'?'<button class="btn sm btn-quiet" data-act="tonwallet">'+(tonWallet?'Disconnect':'Connect')+'</button>':cur==='sol'?'<button class="btn sm btn-quiet" data-act="solwallet">Change wallet</button>':'')+'</div>'+
  '<p class="dimtxt" style="margin:6px 0 10px">'+lpPct()+'% of every sale goes into the $LUNAR launch liquidity pool'+(lbMeta&&lbMeta.lpf>0?' ($'+fmtNum(lbMeta.lpf)+' so far)':'')+'. The other '+(100-lpPct())+'% funds the game: development, servers and promotion. <button class="linkbtn inl" data-act="lpwallet">Verify</button></p>'+
  '<div class="deals">'+dealCard('d')+dealCard('w')+'</div>'+
  (FOUNDER_OPEN&&!save.founder?'<div class="founder"><canvas data-art="tank:paint:founder"></canvas><span class="tag">Until $LUNAR launches</span><h4>Founder pack</h4>'+
   '<ul><li>Founder paint, never sold again</li><li>An epic weapon you don’t own yet</li><li>2 rare gem caches</li></ul>'+
   '<button class="btn btn-gold block" data-act="founder">'+priceLabel(FOUNDER.ton,FOUNDER.stars)+'</button><p class="fnote">One per pilot. Gear and looks only: it adds no points and doesn’t buy $LUNAR.</p></div>':'')+
  (save.starter?'':'<div class="starter"><span class="tag">One time</span><h4>Starter pack</h4><ul><li>A rare weapon you don’t own yet</li><li>A rare chassis you don’t own yet</li><li>A rare gem cache</li></ul><button class="btn btn-go block" data-act="starter">'+priceLabel(STARTER.ton,STARTER.stars)+'</button></div>')+
  (passState().prem?'':'<div class="passbuy"><span class="tag">Season '+seasonNo()+'</span><h4>Lunar Pass</h4><p>'+seasonTiers()+' premium rewards over '+PASS_LEN+' days: Eclipse and Aurora paints, rare weapon caches, a rare and an epic chassis crate, gem caches, plus an extra daily quest swap.'+(seasonNo()===1?' Launch season: '+PASS_BONUS+' bonus tiers for early pilots, including an epic weapon cache.':'')+' '+leftTxt()+'.</p>'+
   '<div class="acts"><button class="btn btn-go" data-act="buypass">'+priceLabel(PASS_PRICE.ton,PASS_PRICE.stars)+'</button><button class="btn btn-quiet" data-act="pass">See rewards</button></div></div>')+
  vaultCard()+
  sec('Weapon caches','','crates')+'<div class="crates">'+[0,1,2].map(ri=>crate('weapon',ri)).join('')+'</div>'+
  sec('Chassis crates')+'<div class="crates">'+[0,1,2].map(ri=>crate('chassis',ri)).join('')+'</div>'+
  sec('Gem caches','Level up your cores')+'<div class="crates">'+[0,1,2].map(ri=>crate('gem',ri)).join('')+'</div>'+
  sec('Paints','Looks only, no stats')+'<div class="paints">'+PAINT_ORDER.filter(id=>PAINTS[id].stars).map(paintCard).join('')+'</div>'+
  sec('Lunar premium')+'<div class="prem">'+prem('moonbeam','Moonbeam','Laser cannon, Moonfall super',MOONBEAM_PRICE,PSTARS.moonbeam,save.moonbeam)+prem('skin','Lunar skin','+8% health, +8% damage',SKINS.lunar.price,PSTARS.skin,save.skin==='lunar')+'</div>'+
  sec('Salvage yard','Points only')+'<div class="ups list panel">'+salv('weapon',1)+salv('chassis',1)+salv('weapon',2)+salv('chassis',2)+'</div>'+
  (pend?'<div class="pending">Checking your '+(save.pendingSol?'SOL':'TON')+' payment. It unlocks as soon as it confirms.</div>':'');
}

function paintCard(id){
 const P=PAINTS[id],own=!!(save.paints&&save.paints[id]),on=save.paint===id;
 const how=on?'Equipped':own?'Owned':P.only==='founder'?'Founder pack':P.only==='vault'?'Vault level '+VAULT_PAINT_LV:P.pass==='free'?'Pass tier 30':P.pass==='prem'?'Pass premium':priceLabel(P.ton,P.stars);
 return '<button class="paint'+(on?' on':'')+(own?' own':'')+'" data-act="paint" data-arg="'+id+'"><canvas data-art="tank:paint:'+id+'"></canvas><b>'+esc(P.n)+'</b><span class="p">'+how+'</span></button>';
}

// ---------- LUNAR PASS ----------
function passCard(){
 const P=passState(),t=passTier(),xpIn=P.xp-t*PASS_XP,ready=passReady(),done=t>=seasonTiers();
 return '<button class="passcard" data-act="pass"><div class="row"><div class="grow"><div class="pt">Lunar Pass'+(P.prem?' <span class="rar" style="background:var(--gold)">Premium</span>':'')+'</div><div class="mut">Season '+seasonNo()+', tier '+t+' of '+seasonTiers()+', '+leftTxt()+'</div></div>'+
  (ready?'<span class="rdy">'+ready+' to claim</span>':'<span class="chev">›</span>')+'</div>'+
  '<div class="bar"><i style="width:'+(done?100:Math.round(xpIn/PASS_XP*100))+'%"></i></div>'+
  '<div class="dimtxt">'+(done?'Season complete. New season in '+daysLeft()+(daysLeft()===1?' day':' days'):'Next: '+esc(rewardLabel(PASS_FREE[t+1]))+(P.prem?' and '+esc(rewardLabel(PASS_PREM[t+1])):'')+'. '+(PASS_XP-xpIn)+' XP to go')+'</div></button>';
}
function openPass(){
 const ov=sheet('pass',()=>{
  const P=passState(),t=passTier(),xpIn=P.xp-t*PASS_XP;
  const cell=(r,track,i,claimed,locked)=>{const got=i<=t;
   return '<div class="pcell'+(claimed?' got':'')+(locked?' lock':'')+'"><span>'+esc(rewardLabel(r))+'</span>'+
    (claimed?'<b class="ok">✓</b>':got&&!locked?'<button class="btn sm btn-gold" data-act="claimpass" data-arg="'+track+':'+i+'">Claim</button>':'')+'</div>';};
  let rows='';for(let i=1;i<=seasonTiers();i++)rows+=(i===PASS_TIERS+1?'<div class="pbonus">Early pilot bonus · launch season only</div>':'')+'<div class="ptier'+(i<=t?' on':'')+(i===t+1?' next':'')+'"><div class="pn num">'+i+'</div>'+cell(PASS_FREE[i],'f',i,P.cf.includes(i),false)+cell(PASS_PREM[i],'p',i,P.cp.includes(i),!P.prem)+'</div>';
  return '<h3>Lunar Pass</h3><p class="mut">Season '+seasonNo()+': '+(seasonFrozen()?'30 days, the clock starts Nov 1':'ends in '+daysLeft()+(daysLeft()===1?' day':' days'))+'. '+bonusTxt()+' XP per match: win +'+PASS_XP_WIN+', draw +'+PASS_XP_DRAW+', loss +'+PASS_XP_LOSS+', featured mode +'+PASS_XP_FEAT+'. Each daily quest +'+PASS_XP_QUEST+', all '+DQ_SLOTS.length+' +'+PASS_XP_ALL+', each weekly quest +'+PASS_XP_WQ+'.</p>'+
   '<div class="pxp"><b class="num">Tier '+t+'</b><div class="bar"><i style="width:'+(t>=seasonTiers()?100:Math.round(xpIn/PASS_XP*100))+'%"></i></div><span class="num">'+(t>=seasonTiers()?'Done':xpIn+' / '+PASS_XP+' XP')+'</span></div>'+
   (P.prem?'<p class="passown">Premium unlocked for this season</p>':'<button class="btn btn-go block" style="margin-top:12px" data-act="buypass">Unlock premium for '+priceLabel(PASS_PRICE.ton,PASS_PRICE.stars)+'</button><p class="dimtxt" style="margin-top:6px">Premium never gives points, so it can’t buy leaderboard rank. Rewards you’ve already reached unlock right away.</p>')+
   '<div class="phead"><span></span><span>Free</span><span>Premium</span></div><div class="ptiers">'+rows+'</div>';
 });
 if(passTier()>=5)setTimeout(()=>{const el=$('.ptier.next',ov.box)||$('.ptier.on:last-child',ov.box);if(el)try{el.scrollIntoView({block:'center'});}catch(e){}},80);   // early on, the header matters more
}

// ---------- QUESTS ----------
function wkSub(q){   // weekly progress line: days for day-based quests, plus today's part of an "N a day" quest
 if(q.pd)return fmtNum(q.p)+' / '+q.goal+' days'+(q.done?'':q.today>=q.pd?'. Today done':q.pd>1?'. Today '+q.today+' / '+q.pd:'');
 return fmtNum(q.p)+' / '+fmtNum(q.goal)+(q.st==='day'?' days':'');
}
function renderQuests(){
 const L=loginState(),dq=dailyQuests(),wk=weeklyQuests(),wq=save.wq,t=tierIdx(),qb=questBoost(),nb=streakBoost(L.next),sw=swapsLeft();
 const cal=STREAK_PTS.map((p,i)=>{
  const got=i<L.slot||(L.claimedToday&&i===L.slot),today=!L.claimedToday&&i===L.slot;
  return '<div class="day'+(got?' got':'')+(today?' today':'')+(i===6?' big':'')+'"><small>Day '+(i+1)+'</small><b>'+(got?'✓':shortNum(p+TDAILY[t]))+'</b></div>';}).join('');
 const qRow=(q,act,sub,pts,swap)=>{const f=Math.min(1,q.p/q.goal);
  return '<div class="q'+(q.claimed?' done':'')+'"><div class="grow"><div class="t">'+esc(q.t)+'</div><div class="bar"><i style="width:'+Math.round(f*100)+'%"></i></div><div class="p">'+(sub||fmtNum(q.p)+' / '+fmtNum(q.goal))+'</div></div>'+
   (swap&&!q.done&&!q.claimed?'<button class="btn sm btn-quiet swap" data-act="swapdq" data-arg="'+q.id+'" aria-label="Swap for another quest"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5"/></svg></button>':'')+
   (q.claimed?'<span class="mut">Claimed</span>':'<button class="btn sm '+(q.done?'btn-gold':'btn-quiet')+'" data-act="'+act+'" data-arg="'+q.id+'">+'+fmtNum(pts||q.pts)+'</button>')+'</div>';};
 const allDone=save.dq&&save.dq.all,lvTag=q=>'<span class="lv l'+q.lv+'">'+DQ_LV[q.lv]+'</span>';
 const sq=squad(),active=sq.filter(r=>refStatus(r)[0]==='Active').length,pend=refPending();
 const recruits=sq.slice().sort((a,b)=>b.pts-a.pts).slice(0,5).map(r=>{const st=refStatus(r),o=refOwed(r),nx=REF_MS[o.m];
  return '<div class="q"><div class="grow"><div class="t">'+esc(r.n)+' <span class="dimtxt" style="color:'+st[1]+'">'+st[0]+'</span></div><div class="p">Day '+r.days+', '+fmtNum(r.pts)+' points'+(nx?'. Next: '+nx.n.toLowerCase():'')+'</div></div>'+(o.tot?'<span class="num" style="color:var(--gold)">+'+fmtNum(o.tot)+'</span>':'')+'</div>';}).join('');
 const ms=QUESTS.map(Q=>{const e=save.q[Q.id]||{p:0,done:false,claimed:false};
  if(Q.link&&!e.done)return '<div class="q"><div class="grow"><div class="t">'+Q.n+'</div><div class="p">'+Q.d+'</div></div><button class="btn sm btn-quiet" data-act="visit" data-arg="'+Q.id+'">Open</button></div>';
  const p=Math.min(e.p||0,Q.goal);
  return qRow({id:Q.id,t:Q.n,goal:Q.goal,p,done:e.done,claimed:e.claimed,pts:Q.pts},'claimq',Q.d+(Q.goal>1&&!e.done?' ('+fmtNum(p)+' / '+fmtNum(Q.goal)+')':''));}).join('');
 return passCard()+sec('Daily reward','Streak: '+L.streak+(L.streak===1?' day':' days'))+
  '<div class="cal">'+cal+'</div>'+
  (L.claimedToday?'<button class="btn btn-quiet block off">Next reward in '+fmtDur(msToDailyReset())+'</button>':'<button class="btn btn-gold block" data-act="login">'+(giftReady()?'Claim +'+fmtNum(L.reward)+' and a Rare gem cache':'Claim day '+(L.slot+1)+': +'+fmtNum(L.reward)+' points'+(L.slot===6?' and a gem cache':''))+'</button>')+
  (giftPending()?'<div class="gift"><b>🎁 Come back tomorrow</b><span>A free Rare gem cache unlocks in '+fmtDur(msToDailyReset())+'. One time, for new pilots.</span></div>':'')+
  '<div class="boost'+(qb?' on':'')+'"><b>'+(qb?'+'+Math.round(qb*100)+'% quest points today':L.claimedToday?'Come back tomorrow for +5% quest points':nb?'Claim to get +'+Math.round(nb*100)+'% quest points today':'Log in tomorrow for +5% quest points')+'</b>'+
   '<span>Each streak day adds +5% to every daily and weekly quest, up to +30% from day 7. Missing a day restarts the streak. Higher tiers add +'+TDAILY[t]+' a day to the reward.</span></div>'+
  sec('Today’s quests','New in '+fmtDur(msToDailyReset()))+
  '<div class="panel list">'+dq.map(q=>qRow(q,'claimdq',lvTag(q)+fmtNum(q.p)+' / '+fmtNum(q.goal),qPts(q.pts),sw>0)).join('')+
   '<div class="q'+(allDone?' done':'')+'"><div class="grow"><div class="t">Finish all '+DQ_SLOTS.length+'</div><div class="p">Bonus on top of each quest'+(sw?'. '+sw+(sw===1?' swap':' swaps')+' left today':'')+'</div></div><span class="num" style="color:'+(allDone?'var(--dust)':'var(--gold)')+'">'+(allDone?'Claimed':'+'+fmtNum(qPts(DQ_ALL_BONUS)))+'</span></div></div>'+
  sec('Weekly quests','Resets in '+fmtDur(msToWeeklyReset()))+
  '<div class="panel list">'+wk.map(q=>qRow(q,'claimwq',wkSub(q),qPts(q.pts))).join('')+
   '<div class="q'+(wq.claimed?' done':'')+'"><div class="grow"><div class="t">Weekly chest: claim '+WQ_GOAL+' daily quests</div><div class="bar"><i style="width:'+Math.round(Math.min(1,(wq.n||0)/WQ_GOAL)*100)+'%;background:var(--gold)"></i></div><div class="p">'+Math.min(wq.n||0,WQ_GOAL)+' / '+WQ_GOAL+'. '+fmtNum(qPts(WQ_PTS))+' points and a rare gem cache</div></div>'+
  (wq.claimed?'<span class="mut">Claimed</span>':'<button class="btn sm '+((wq.n||0)>=WQ_GOAL?'btn-gold':'btn-quiet')+'" data-act="weekly">Open</button>')+'</div></div>'+
  sec('Your squad','','squad')+
  '<div class="plate squad"><div class="t big">Earn when friends you invite keep playing</div><p class="mut">Sign-ups alone pay nothing. Active recruits pay up to +7,500 each, plus 5% of what they earn.</p>'+
  '<div class="kv"><div><b class="num">'+sq.length+'</b><span>Recruits</span></div><div><b class="num">'+active+'</b><span>Active</span></div><div><b class="num" style="color:var(--gold)">'+fmtNum(pend)+'</b><span>Ready to claim</span></div></div>'+
  (IN_TG?'<div class="acts"><button class="btn btn-go" data-act="share">Share invite</button><button class="btn btn-quiet" data-act="copy">Copy link</button></div>':'<p class="mut" style="margin-top:10px">Open the game in Telegram to get your invite link.</p>')+
  (pend?'<button class="btn btn-gold block" style="margin-top:8px" data-act="claimref">Claim +'+fmtNum(pend)+' points</button>':'')+
  (recruits?'<div class="list" style="margin-top:8px">'+recruits+'</div>':'')+'</div>'+
  sec('Milestones','One time')+'<div class="panel list">'+ms+'</div>';
}

// ---------- RANKS ----------
function renderRanks(){
 const t=tierIdx(),e=save.earned||0,me=playerKey();
 const rung=(n,i)=>{const lo=TPTS[i],hi=TPTS[i+1]||lo*2,f=e>=hi?1:e<=lo?0:(e-lo)/(hi-lo);
  return '<div class="rung">'+(i===t?'<span class="you" style="left:'+Math.round(f*100)+'%"></span>':'')+'<div class="track"><i style="width:'+Math.round(f*100)+'%;background:'+TIERC[i]+'"></i></div><b style="color:'+(i<=t?TIERC[i]:'var(--dust)')+'">'+n+'</b><span>'+fmtK(TPTS[i])+'</span></div>';};
 const nextTxt=t<4?fmtNum(TPTS[t+1]-e)+' points to '+TIERS[t+1]:'Top tier reached';
 let cut='';
 const R=lbCache?myRank(e):null;
 if(!lbMeta)cut='<div class="cutline">Loading the leaderboard…</div>';
 else if(!lbMeta.inTop||lbMeta.inTop<1000)cut='<div class="cutline"><span class="info" style="border-color:var(--gold);color:var(--gold)">✓</span><span>'+fmtNum(lbMeta.n||0)+' pilots so far, so everyone is inside the top 1,000. Your $LUNAR share grows with your points and days active.</span></div>';
 else if(R&&!R.outside)cut='<div class="cutline"><b>#'+fmtNum(R.rank)+'</b><span>You’re inside the top 1,000. Cutoff right now: '+fmtNum(lbMeta.cut)+' points.</span></div>';
 else cut='<div class="cutline"><b>'+fmtNum(Math.max(1,lbMeta.cut-e+1))+'</b><span>more points to reach the top 1,000 (cutoff '+fmtNum(lbMeta.cut)+')</span></div>';
 if(lbMeta&&lbMeta.lpf>0)cut+=lpfLine();
 const isV=lbScope==='vault',metric=p=>lbScope==='daily'?(p.dailyPts||0):lbScope==='weekly'?(p.weeklyPts||0):isV?(p.vg||0):(p.pts||0);
 const sub=(p,ti)=>{const vl=p.vl||0,tt=vaultTitle(vl);return isV?'<div class="tr" style="color:'+vaultTier(vl).c+'">Level '+vl+(tt?' · '+tt:'')+'</div>':'<div class="tr" style="color:'+TIERC[ti]+'">'+TIERS[ti]+(tt?' <span class="vtt">· '+tt+'</span>':'')+'</div>';};
 let rows='',pin='';
 if(lbCache){
  const all=lbCache.map(p=>p.id===me?Object.assign({},p,{pts:Math.max(p.pts,e),dailyPts:Math.max(p.dailyPts||0,save.dailyPts||0),weeklyPts:Math.max(p.weeklyPts||0,save.weeklyPts||0),vg:Math.max(p.vg||0,save.vg||0),vl:myVl()}):p);
  if(IN_TG&&!all.some(p=>p.id===me))all.push({id:me,n:tgName(TG_USER),pts:e,dailyPts:save.dailyPts||0,weeklyPts:save.weeklyPts||0,vg:save.vg||0,vl:myVl()});   // you show up before the next 5-minute refresh
  const list=all.filter(p=>metric(p)>0).sort((a,b)=>metric(b)-metric(a));
  const shown=list.slice(0,100);let meShown=false;
  rows=shown.map((p,i)=>{const isMe=p.id===me;if(isMe)meShown=true;const ti=tierOfPts(p.pts);
   return '<div class="r'+(isMe?' me':'')+'"><span class="rk'+(i<3?' t3':'')+'">#'+(i+1)+'</span><div class="grow"><div class="nm">'+vname(p.n,p.vl)+(isMe?' (you)':'')+vbadge(p.vl)+'</div>'+sub(p,ti)+'</div><span class="sc">'+fmtNum(metric(p))+(isV?'<small> Gold</small>':'')+'</span></div>';}).join('');
  if(!rows)rows='<p class="mut" style="padding:14px 0">'+(isV?'No Vault pilots yet. The first deposit takes #1.':lbScope==='overall'?'No pilots on the board yet. Win a match to be first.':'No points yet '+(lbScope==='daily'?'today':'this week')+'. Win a match to take #1.')+'</p>';
  else if(list.length>100)rows+='<p class="dimtxt" style="padding:8px 0">Showing the top 100 of '+fmtNum(lbMeta.n||list.length)+'</p>';
  if(!meShown&&IN_TG&&!(isV&&!myVl())){const mine=lbScope==='daily'?(save.dailyPts||0):lbScope==='weekly'?(save.weeklyPts||0):isV?(save.vg||0):e,above=list.filter(p=>p.id!==me&&metric(p)>mine).length;
   pin='<div class="lb"><div class="r me mepin"><span class="rk">'+(R&&R.outside&&lbScope==='overall'?'1000+':isV&&above>=100?'100+':'#'+(above+1))+'</span><div class="grow"><div class="nm">'+vname('You',myVl())+vbadge(myVl())+'</div>'+sub({vl:myVl()},t)+'</div><span class="sc">'+fmtNum(mine)+(isV?'<small> Gold</small>':'')+'</span></div></div>';}
 }else rows='<p class="mut" style="padding:14px 0">Loading…</p>';
 return '<div class="panel tierbox"><div class="row"><i class="tierdia" style="background:'+TIERC[t]+'"></i><div class="grow"><div class="tn" style="color:'+TIERC[t]+'">'+TIERS[t]+'</div><div class="mut">'+fmtNum(e)+' lifetime points. '+nextTxt+'.</div></div><button class="info" data-act="info" data-arg="tiers" aria-label="About tiers">?</button></div>'+
  '<div class="ladder">'+TIERS.map(rung).join('')+'</div></div>'+
  cut+
  '<button class="linkbtn" data-act="info" data-arg="airdrop">How the airdrop works</button>'+
  '<div class="seg c4" style="margin-top:14px">'+[['overall','All time'],['daily','Today'],['weekly','This week'],['vault','Vault']].map(([k,l])=>'<button class="'+(lbScope===k?'on':'')+'" data-act="lbscope" data-arg="'+k+'">'+l+'</button>').join('')+'</div>'+
  '<div class="lb list">'+rows+'</div>'+pin+
  (isV?'<p class="dimtxt" style="margin-top:10px">Ranked by lifetime Gold in the Hyperspace Vault. Looks only: the Vault never adds points. <button class="linkbtn inl" data-act="vault">Open the Vault</button></p>':'')+
  '<p class="dimtxt" style="margin-top:10px">The board refreshes every 5 minutes.</p>';
}
const SCREENS={play:renderPlay,garage:renderGarage,shop:renderShop,quests:renderQuests,ranks:renderRanks};

// ---------- canvases inside the menus ----------
function paintArt(root){
 for(const c of root.querySelectorAll('canvas[data-art]')){
  const w=c.clientWidth,h=c.clientHeight;if(!w||!h)continue;
  const pw=Math.round(w*dpr),ph=Math.round(h*dpr);if(c.width!==pw||c.height!==ph){c.width=pw;c.height=ph;}
  const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const a=c.dataset.art.split(':');
  try{
   if(c.dataset.locked)ctx.globalAlpha=0.45;
   if(a[0]==='lab'){const M=save.lab&&save.lab.machines[a[1]];if(M)drawMachinePreview(ctx,w,h,ecoLoadout(save,M.spec));continue;}
   if(a[0]==='hero')heroCv=c;
   if(typeof art3D==='function'&&art3D(ctx,w,h,a)){ctx.globalAlpha=1;continue;}   // 3D pictures when the 3D view is on
   ctx.globalAlpha=1;
   if(a[0]==='hero'){drawHeroScene(ctx,w,h,performance.now()/1000);}
   else if(a[0]==='map')drawMapThumb(ctx,w,h,a[1]);
   else if(a[0]==='crate'){const cw=Math.min(w*0.78,h*1.3),ch=cw*0.74;drawCrateArt(ctx,(w-cw)/2,(h-ch)/2,cw,ch,a[1],+a[2]);}
   else if(a[0]==='gear'){const isW=a[1]==='w',k=a[2];
    const it=k==='moon'?getW('moon'):a[3]===undefined?(isW?getW(save.weapon):getC(save.chassis)):(isW?getW(k,+a[3],a[4]==='1'):getC(k,+a[3],a[4]==='1'));
    if(c.dataset.locked)ctx.globalAlpha=0.45;drawGearIcon(ctx,w,h,isW,it);ctx.globalAlpha=1;}
   else if(a[0]==='gem')drawGemArt(ctx,w,h,a[1]);
   else if(a[0]==='vault')drawVaultArt(ctx,w,h,+a[1]||0);
   else if(a[0]==='unit')drawUnitArt(ctx,w,h,units[+a[1]]);
   else if(a[0]==='tank'){const r=Math.min(w,h)*0.22;drawTankPx(ctx,w/2,h/2,r,-Math.PI/2+0.35,-Math.PI/2+0.1,TC[0],null,'pulse',null,3,a[1]==='paint'?PAINTS[a[2]]:a[1]==='me'?myPaint():null,null,a[1]==='lunar'?'lunar':a[1]==='me'?save.skin:'default');}
  }catch(e){}
 }
}
let heroLast=0;
function tickHero(now){   // the hero tank idles at ~30fps while the Play tab is open
 if(uiTab!=='play'||!heroCv||!heroCv.isConnected||inBattle()||document.hidden||now-heroLast<33)return;
 heroLast=now;const w=heroCv.clientWidth,h=heroCv.clientHeight;if(!w)return;
 const ctx=heroCv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
 if(typeof use3D==='function'&&use3D()){try{heroArt(ctx,w,h,now/1000);return;}catch(e){}}
 drawHeroScene(ctx,w,h,now/1000);
}

// ---------- overlays: sheets, modals, full screens ----------
const overlays=[];
function dropBack(fn){const i=backStack.indexOf(fn);if(i>=0)backStack.splice(i,1);if(!backStack.length)try{TG&&TG.BackButton.hide();}catch(e){}}
function openOverlay(kind,html,opt){
 opt=opt||{};
 const wrap=document.createElement('div');wrap.className='ovl';
 let scrim=null;
 if(kind!=='full'){scrim=document.createElement('div');scrim.className='scrim';wrap.appendChild(scrim);}
 const box=document.createElement('div');box.className=kind+(opt.cls?' '+opt.cls:'');
 box.setAttribute('role','dialog');
 wrap.appendChild(box);$('#layer').appendChild(wrap);
 const ov={kind,wrap,box,onClose:opt.onClose||null,re:null,key:opt.key||''};
 const fill=h=>{box.innerHTML=(kind==='sheet'?'<div class="grab"></div>':'')+h;paintArt(box);};
 box.innerHTML=(kind==='sheet'?'<div class="grab"></div>':'')+html;
 if(opt.build)ov.re=()=>fill(opt.build());
 ov.close=()=>closeOverlay(ov);
 if(scrim&&!opt.sticky){scrim.addEventListener('click',()=>ov.close());swipeToClose(ov);}
 if(!opt.noBack){ov.back=()=>closeOverlay(ov,true);pushBack(ov.back);}
 overlays.push(ov);
 requestAnimationFrame(()=>{if(scrim)scrim.classList.add('show');box.classList.add('show');paintArt(box);});
 return ov;
}
// Pull a sheet or popup down to close it. Only a deliberate pull counts: the touch has to start at the
// top of the content (or on the grab bar) and move mostly downward, far or fast enough. Scrolling never closes it.
function swipeToClose(ov){
 const box=ov.box,isSheet=ov.kind==='sheet';
 let sx=0,sy=0,t0=0,dy=0,armed=false,drag=false;
 const place=d=>{box.style.transform=isSheet?'translateY('+d+'px)':'translate(-50%,calc(-50% + '+d+'px))';if(!isSheet)box.style.opacity=String(Math.max(0.4,1-d/400));};
 box.addEventListener('touchstart',e=>{
  if(e.touches.length!==1){armed=false;return;}
  const t=e.touches[0],top=box.getBoundingClientRect().top;
  sx=t.clientX;sy=t.clientY;t0=performance.now();dy=0;drag=false;
  armed=box.scrollTop<=0||t.clientY-top<44;   // already at the top, or touching the grab area
 },{passive:true});
 box.addEventListener('touchmove',e=>{
  if(!armed||e.touches.length!==1)return;
  const t=e.touches[0],ddx=t.clientX-sx,ddy=t.clientY-sy;
  if(!drag){
   if(ddy<-4||(Math.abs(ddx)>10&&Math.abs(ddx)>Math.abs(ddy))){armed=false;return;}   // scrolling or swiping sideways: leave it alone
   if(ddy<12)return;
   drag=true;box.style.transition='none';
  }
  dy=Math.max(0,ddy-12);place(dy);e.preventDefault();
 },{passive:false});
 const end=()=>{
  if(!drag){armed=false;return;}
  drag=false;armed=false;
  const fast=dy>40&&dy/Math.max(1,performance.now()-t0)>0.5;
  box.style.transition='';
  if(dy>110||fast){if(isSheet)box.style.transform='translateY(100%)';else{box.style.transform='';box.style.opacity='';}ov.close();}
  else{box.style.transform='';box.style.opacity='';}
 };
 box.addEventListener('touchend',end);box.addEventListener('touchcancel',end);
}
function closeOverlay(ov,fromBack){
 const i=overlays.indexOf(ov);if(i<0)return;overlays.splice(i,1);
 if(ov.back&&!fromBack)dropBack(ov.back);
 ov.box.classList.remove('show');const s=ov.wrap.querySelector('.scrim');if(s)s.classList.remove('show');
 setTimeout(()=>ov.wrap.remove(),230);
 if(ov.onClose)ov.onClose(!!fromBack);
}
function closeAll(){while(overlays.length){const ov=overlays[overlays.length-1];ov.onClose=null;closeOverlay(ov);}}
const findOv=k=>overlays.find(o=>o.key===k);
function sheet(key,build,opt){const old=findOv(key);if(old)closeOverlay(old);return openOverlay('sheet',build(),Object.assign({key,build},opt||{}));}

// ---------- info cards ----------
function infoBody(sections){return '<div class="infobody">'+sections.map(([h,p])=>(h?'<h4>'+h+'</h4>':'')+'<p>'+p+'</p>').join('')+'</div>';}
const INFO={
 howto:()=>['How to play',[
  ['Drive','Drag anywhere on the screen. Your cannon aims and fires on its own.'],
  ['Win','Every mode has its own goal: Arena, Moon Zone, Crystal Rush, Bounty, Last Standing and Survival. The start screen tells you what it is.'],
  ['Mystery boxes','Drive over the gold box for a random boost. It lasts until you take enough damage; the ring around your tank shows what’s left.'],
  ['Super','The thin bar under your health fills as you fight. When it’s full, tap the red Super button to auto-aim, or drag from it to aim yourself.'],
  ['Dash','The blue Dash button bursts you forward in the direction you’re driving. Use it to dodge supers. It recharges in 4 seconds.'],
  ['Shield','The teal Shield button raises a plasma shield for 3 seconds that cuts the damage you take by 65%. It recharges in 25 seconds.'],
  ['Crits','Direct hits can crit for double damage. Shots that only clip the edge do less.'],
  ['Counters','Scout beats Titan, Titan beats Vanguard, Vanguard beats Scout. The winning side deals 15% more damage and takes 10% less.'],
  ['Map objects','Rocks, domes and containers block shots and movement. Orange supply crates break under fire and sometimes drop a box. Craters slow you down.'],
  ['Events','Most matches get one surprise: a supply drop, a meteor shower (stay out of the red circles) or a solar flare that charges supers twice as fast.'],
  ['Points','Every match pays points. They rank you on the leaderboard and buy upgrades and crates. Spending never lowers your rank.']]],
 gtypes:()=>['Game types',[
  ['Arena','Destroy the enemy team, or have more health left when time runs out. One life each.'],
  ['Arena 1v1','Best of 3 rounds: first to 2 wins and the match pays double. Between rounds you see their next chassis and can switch yours.'],
  ['Moon Zone','Stand in the zone to capture it. While your team holds it, you score. First to 100 wins. It pays ×3 in 1v1, ×2 in 2v2 and ×1.5 in 3v3 because matches run longer.'],
  ['The zone moves','Every 20 to 28 seconds it jumps somewhere new. A gold ring shows where, 6 seconds early.'],
  ['Kills and respawns','Each kill adds 5. You respawn after 4 seconds, plus 1.5 for each death after that (9 at most).'],
  ['Repairs','In Moon Zone, Crystal Rush and Bounty, stay out of fire for 3.5 seconds and your tank repairs itself (not while you’re on the zone).'],
  ['Crystal Rush','A crystal appears at the mine in the middle every 6 seconds. When your team holds 10 or more, and more than the other team, a 15-second countdown starts. Last it out and you win. Destroyed tanks drop every crystal they carry. Pays ×3 / ×2 / ×1.5.'],
  ['Bounty','Every tank starts worth 2 stars. Destroy one and your team gets its stars, and your own bounty rises by 1, up to 7. Get destroyed and yours drops back to 2. Most stars after 2 minutes wins. Tanks are lighter and respawn in 3 seconds. Pays ×3.5 / ×2.25 / ×1.5.'],
  ['Last Standing','You and 5 AI pilots, every tank for itself, no respawns. The ring closes from 15 seconds in; outside it you lose 4% health a second. Wrecks drop boxes. Pays by place: '+ROYALE_PTS.join(', ')+'. 2nd and 3rd keep your win streak.'],
  ['Survival','A megatank hunts you. Solo, or with AI wingmen in 2v2 and 3v3. Destroy it to win; alive at the horn is a draw. Get out of the red circles: shell barrages, and a stomp when you get close. Pays like Moon Zone.'],
  ['Featured mode','One mode a day pays +25% points and +'+PASS_XP_FEAT+' pass XP. It changes at 00:00 UTC.'],
  ['Random','Picks any mode when the match starts.']]],
 modes:()=>['Team size',[
  ['Points per match','Before your league multiplier:'],
  ...Object.keys(MODES).map(k=>{const M=MODES[k];return [k,'Win '+M.win+', draw '+M.draw+', loss '+M.loss+'.'];}),
  ['Win streaks','Each win in a row adds 20 more points, up to +100 (more in 2v2 and 3v3).'],
  ['Teammates','In 2v2 and 3v3, AI pilots fight on your side.']]],
 league:()=>['Leagues',[
  ['Your league','Comes from your tank’s power: gear, upgrades and cores. Higher leagues pay more points per match.'],
  ['Multipliers','Rookie ×1 (under 150 power), Pilot ×1.25 (150+), Ace ×1.5 (250+), Elite ×1.75 (400+), Legend ×2 (600+).'],
  ['Leagues vs tiers','Your tier (Bronze to Diamond) comes from lifetime points and shows on the leaderboard. Your league comes from gear.']]],
 build:()=>['Build',[
  ['Your budget','Each stat has 4 levels, but your tank can hold '+BUILD_MAX+' levels in total: 3 stats maxed and 2 levels to spare, or spread out. Pick what fits how you fight.'],
  ['Cost','Each level costs points: '+UPS.hull.costs.map(fmtNum).join(', ')+' for levels 1 to 4.'],
  ['Reset build','Clears every level so you can build again. You get half the points the levels cost back; the other half is gone.'],
  ['Power','Your power and league come from the levels in your build.']]],
 cores:()=>['Cores',[
  ['What they do','Cores are permanent boosts. You have 3 sockets and each core type fits once.'],
  ['Leveling','Gem caches in the Shop give shards. Enough shards level a core up, to level 5.'],
  ['Stacking','Cores add on top of mystery-box boosts of the same type.']]],
 crates:()=>['Crates',[
  ['Gear','Each rarity has 3 weapons and 3 chassis. A crate always gives one you don’t own yet, so Rare and Epic crates cost ×1, then ×2, then ×3 as you collect them. Common crates are always 250 Stars.'],
  ['Rolls','Every crate item rolls 105 to 110% of its rarity’s stats, any value equally likely. Rare is 14% stronger than Common stock, Epic 34%. Rolled power is 105–110% (Common), 119.7–125.4% (Rare), 140.7–147.4% (Epic). Legendary Moonbeam is fixed above the strongest Epic weapon.'],
  ['Odds','Each item you don’t own yet is equally likely. Gem caches pick one of the 6 core types, 1 in 6 each.'],
  ['Tune-up','In the Garage, pay points to re-roll a crate item: 3,000 for Common, 10,000 for Rare, 30,000 for Epic. You keep the better roll.'],
  ['Collection done','Once you own all 3, a crate re-rolls one of them. You keep the better roll, or get points back.'],
  ['Gem caches','Common gives 1 to 2 shards, Rare 3 to 4, Epic 11 to 14, for a random core. Rare and Epic caches rise 25% with each buy that day and reset at 00:00 UTC. Common stays 250 Stars.'],
  ['Salvage','Paid with points: Salvaged Rare 10,000 (101 to 103% power), Salvaged Epic 20,000 (103.1 to 104.4%). Every crate item beats every salvaged item.']]],
 squad:()=>['Squad rewards',[
  ['How it works','Share your invite link. Anyone who opens the game with it for the first time joins your squad.'],
  ['You get paid when they stick around','+500 when they come back for a 2nd day with 1,500 points. +2,000 at 5 days and 5,000 points. +5,000 at 10 days and 20,000 points.'],
  ['5% ongoing','You also get 5% of the points your squad earns, up to 2,000 a day. Anything over carries to the next day. They lose nothing.'],
  ['They get +1,000','Your recruit gets a 1,000 point welcome bonus when they come back for day 2.'],
  ['Rules','Days active means separate days played. Squad points count toward the 20,000 daily cap and the leaderboard. Fake or alt accounts are removed from the airdrop.']]],
 tiers:()=>['Tiers',[
  ['Lifetime points','Bronze from 0, Silver 10K, Gold 50K, Platinum 150K, Diamond 400K.'],
  ['Daily bonus','Higher tiers add to your daily reward: +25, +50, +100, +200, +400.'],
  ['Spending is safe','Tiers and the leaderboard count lifetime points, so buying upgrades never drops you.']]],
 airdrop:()=>['The $LUNAR airdrop',[
  ['Who gets it','When $LUNAR launches, the top 1,000 pilots on the all-time leaderboard get an allocation.'],
  ['How big','Your share is weighted by your points and the days you were active.'],
  ['Fair play','Fake or duplicate accounts are removed before the snapshot.'],
  ['Details','The wiki has the full tokenomics.']]],
 points:()=>['Points',[
  ['Earning','Matches, quests, daily rewards and your squad all pay points. Up to 20,000 a day; the cap resets at 00:00 UTC.'],
  ['Spending','Upgrades, crates and salvage. Spending never lowers your rank: the leaderboard counts lifetime points.']]]};
function coreInfo(k){
 const I={dmg:['Every shot hits harder, your super too.','damage'],rof:['Your cannon fires faster.','fire rate'],arm:['You take less damage from every hit. Armor from cores and boxes adds up, to 70% at most.','less damage taken'],
  spd:['Your tank drives faster: dodge more, reach boxes first.','speed'],lck:['More critical hits. Crits need a direct hit and deal double damage.','crit chance'],reg:['Slowly repairs your tank during every fight.','health repaired per second']}[k];
 const lv=save.gemLvl[k]||1,sh=save.gemShards[k]||0;
 const s=[['What it does',I[0]],['Level '+lv,fmtCore(k,coreVal(k,lv))+' '+I[1]+'.']];
 if(lv<5)s.push(['Next level',fmtCore(k,coreVal(k,lv+1))+' '+I[1]+'. Shards: '+sh+' of '+SHARD_NEED[lv]+'.']);
 return [GEM[k].name+' core',s];
}
function showInfo(id){
 const f=INFO[id];if(!f)return;const [t,s]=f();
 sheet('info',()=>'<h3>'+t+'</h3>'+infoBody(s)+(id==='airdrop'?'<button class="btn btn-quiet block" style="margin-top:14px" data-act="wiki">Open the wiki</button>':''));
}

// ---------- garage sheets ----------
function openGearPicker(isW){
 sheet('gear',()=>{
  const eq=eqId(isW);
  const rows=ownedList(isW).map(it=>{const id=it.premium?'moon':(it.arch||it.cls)+':'+Math.max(0,it.tier)+(it.sal?'s':''),on=id===eq;
   const k=it.arch||it.cls,t=Math.max(0,it.tier),tunable=!it.locked&&!it.premium&&!it.sal&&canTune(isW,k,t);
   const where=it.locked?'In the '+crateName(isW?'weapon':'chassis',t).toLowerCase():it.premium?'Legendary':it.sal?'Power '+pct1(it.mult)+'. Crate gear starts at 105%':tunable?'Power '+pct1(it.mult)+', roll '+pct(it.q):'Starter gear, power '+pct1(it.mult);
   const tune=tunable&&it.q<ROLL_MAX-0.0001?'<div class="tunerow"><span>Tune-up: re-roll 105 to 110%, keep the better</span><button class="btn sm '+((save.pts||0)>=TUNE_PTS[t]?'btn-gold':'btn-quiet')+'" data-act="tune" data-arg="'+(isW?'w':'c')+'|'+k+'|'+t+'">'+coin()+fmtK(TUNE_PTS[t])+'</button></div>':'';
   return '<button class="gear'+(it.locked?' locked':'')+(on?' equipped':'')+(tune?' hastune':'')+'" data-act="equip" data-arg="'+(isW?'w':'c')+'|'+id+'"><div class="ico"><canvas data-art="gear:'+(isW?'w':'c')+':'+gearKey(it)+'"'+(it.locked?' data-locked="1"':'')+'></canvas></div>'+
    '<div class="grow"><div class="nm">'+esc(it.name)+' '+rarBadge(it)+'</div><div class="meta">'+gearMeta(isW,it)+'</div><div class="meta">'+where+'</div></div>'+(on?'<span class="eq">Equipped</span>':'')+'</button>'+tune;}).join('');
  return '<h3>'+(isW?'Weapons':'Chassis')+'</h3><p class="mut">'+(isW?'Each weapon has its own super.':'Scout beats Titan, Titan beats Vanguard, Vanguard beats Scout.')+'</p><div style="margin-top:12px">'+rows+'</div>';
 });
}
const CORE_UNIT={dmg:'damage',rof:'fire rate',arm:'armor',spd:'speed',lck:'crit chance',reg:'repair per second'};
function openCorePicker(i){
 sheet('core',()=>{
  const rows=GORDER.map(k=>{const lv=save.gemLvl[k]||1,j=save.cores.indexOf(k),sh=save.gemShards[k]||0;
   return '<button class="gear'+(j===i?' equipped':'')+'" data-act="coreset" data-arg="'+i+':'+k+'"><div class="ico"><div class="gemi" style="background:'+GEM[k].c+';color:'+GEM[k].c+'"></div></div>'+
    '<div class="grow"><div class="nm">'+GEM[k].name+' <span class="dimtxt">Lv '+lv+'</span></div><div class="meta">'+fmtCore(k,coreVal(k,lv))+' '+CORE_UNIT[k]+(lv<5?'. Next level: '+sh+'/'+SHARD_NEED[lv]+' shards':'. Max level')+'</div></div>'+
    (j===i?'<span class="eq">In this socket</span>':j>=0?'<span class="eq dim">Socket '+(j+1)+'</span>':'')+'</button>';}).join('');
  return '<h3>Socket '+(i+1)+'</h3><p class="mut">Picking a core from another socket swaps the two.</p><div style="margin-top:12px">'+rows+'</div>'+
   (save.cores[i]?'<button class="btn btn-ghost block" style="margin-top:10px" data-act="coreset" data-arg="'+i+':-">Empty this socket</button>':'')+
   '<button class="linkbtn" data-act="coreinfo" data-arg="'+(save.cores[i]||'dmg')+'">What does each core do?</button>';
 });
}

// ---------- shop sheets ----------
function openCrate(tk,ri){
 sheet('crate',()=>{
  const isGem=tk==='gem',keys=tk==='weapon'?WORDER:CHORDER;
  const items=isGem?'':'<div class="list" style="margin-top:10px">'+keys.map(k=>{const own=tk==='weapon'?ownW(k,ri):ownC(k,ri),it=tk==='weapon'?getW(k,ri,false):getC(k,ri,false);
   return '<div class="q"><div class="ico sm"><canvas data-art="gear:'+(tk==='weapon'?'w':'c')+':'+k+':'+ri+':0"'+(own?'':' data-locked="1"')+'></canvas></div><div class="grow"><div class="t">'+esc(it.name)+'</div><div class="p">'+gearMeta(tk==='weapon',it)+'</div></div><span class="nowrap '+(own?'mut':'dimtxt')+'">'+(own?'Owned, '+pct(it.q):'Not found')+'</span></div>';}).join('')+'</div>';
  const found=crateFound(tk,ri),pts=boxPts(tk,ri);
  const what=isGem?['1 to 2','3 to 4','11 to 14'][ri]+' shards for a random core. Price rises 25% with each buy today and resets at 00:00 UTC.'
   :found>=3?'You own all 3. Opening re-rolls one: you keep the better roll, or get '+[50,150,400][ri]+' points.'
   :'One '+TIER_N[ri].toLowerCase()+' '+(tk==='weapon'?'weapon':'chassis')+' you don’t own yet, rolled at 105 to 110%. It’s equipped if it beats your current one.';
  const odds=isGem?'Odds: each of the 6 core types is 1 in 6, and every shard count in the range is equally likely.':found>=3?'Odds: each of the 3 items is 1 in 3. Every roll from 105 to 110% is equally likely.':'Odds: each item you don’t own yet is 1 in '+(3-found)+'. Every roll from 105 to 110% is equally likely.';
  return '<div class="row"><canvas class="crateart" data-art="crate:'+tk+':'+ri+'"></canvas><div class="grow"><h3>'+crateName(tk,ri)+'</h3><p class="mut">'+what+'</p></div></div>'+items+
   (dealOf(tk,ri)?'<p class="dealnote">'+DEAL_TXT[dealOf(tk,ri)].n+': '+DEAL_TXT[dealOf(tk,ri)].off+'. Normally '+priceLabel(boxPrice(tk,ri,true),boxStars(tk,ri,true))+'.</p>':'')+
   '<button class="btn btn-go block" style="margin-top:14px" data-act="buybox" data-arg="'+tk+':'+ri+'">Buy for '+priceLabel(boxPrice(tk,ri),boxStars(tk,ri))+'</button>'+
   (pts?'<button class="btn btn-quiet block" style="margin-top:8px" data-act="buypts" data-arg="'+tk+':'+ri+'">Use '+fmtNum(pts)+' points <span class="dimtxt">(you have '+fmtNum(save.pts)+')</span></button>':'<p class="dimtxt" style="margin-top:8px">Epic crates can’t be bought with points.</p>')+
   '<p class="dimtxt odds">'+odds+'</p>'+
   (ri===0?'<p class="dimtxt" style="margin-top:8px">Common crates are always this price.</p>':!isGem?'<p class="dimtxt" style="margin-top:8px">Each purchase of this crate raises its price: ×1, then ×2, then ×3. Now ×'+boxMult(tk,ri)+'.</p>':'');
 });
}
function openPaints(){
 sheet('paints',()=>'<h3>Paints</h3><p class="mut">Paints change how your tank looks, never its stats. Your team color stays on the tracks and core, so allies and foes are always easy to tell apart.</p><div class="paints" style="margin-top:12px">'+PAINT_ORDER.filter(id=>id!=='founder'||FOUNDER_OPEN||(save.paints&&save.paints.founder)).map(paintCard).join('')+'</div>');
}
function openSolWallets(){
 sheet('solw',()=>'<h3>Pay SOL from</h3><div style="margin-top:10px">'+SOL_ORDER.map(k=>'<button class="gear'+((save.solWallet||'phantom')===k?' equipped':'')+'" data-act="setsolw" data-arg="'+k+'"><div class="grow"><div class="nm">'+SOL_WALLETS[k].n+'</div><div class="meta">'+(SOL_WALLETS[k].ul?'Opens the wallet app to approve':'Shows the address and exact amount to send')+'</div></div></button>').join('')+'</div>');
}

// ---------- settings + admin ----------
function gfxNote(){
 if(typeof R3==='undefined'||R3.failed||!webglOK())return '3D isn’t supported on this device, so the game uses 2D';
 const m=gfxMode();
 if(m==='2d')return 'Classic 2D view';
 if(m==='auto')return '3D, set for your phone'+(R3.auto==='low'?' (Low for speed)':R3.auto==='2d'?' (2D for speed)':'');
 return m==='high'?'3D, sharpest picture':'3D, smoothest on older phones';
}
function openSettings(){
 sheet('settings',()=>'<h3>Settings</h3>'+
  '<div class="list" style="margin-top:8px">'+
  '<div class="q"><div class="grow"><div class="t">Sound</div><div class="p">Follows your phone’s silent switch</div></div><button class="toggle'+(save.sound!==false?' on':'')+'" data-act="sound" aria-pressed="'+(save.sound!==false)+'"><i></i></button></div>'+
  '<div class="q"><div class="grow"><div class="t">Vibration</div><div class="p">Buzz on hits, kills and rewards</div></div><button class="toggle'+(save.haptics?' on':'')+'" data-act="haptics" aria-pressed="'+(save.haptics?'true':'false')+'"><i></i></button></div>'+
  '<div class="q gfx"><div class="grow"><div class="t">Graphics</div><div class="p">'+gfxNote()+'</div></div></div>'+
  '<div class="seg c4" style="margin:-4px 0 6px">'+[['auto','Auto'],['high','High'],['low','Low'],['2d','2D']].map(([k,l])=>'<button class="'+(gfxMode()===k?'on':'')+'" data-act="gfx" data-arg="'+k+'">'+l+'</button>').join('')+'</div>'+
  '<div class="q"><div class="grow"><div class="t">Daily reminder</div><div class="p">One message when your reward is ready</div></div><button class="toggle'+(save.remind?' on':'')+'" data-act="remind" aria-pressed="'+(!!save.remind)+'"><i></i></button></div>'+
  '<button class="q" data-act="info" data-arg="howto"><div class="grow"><div class="t">How to play</div></div><span class="chev">›</span></button>'+
  '<button class="q" data-act="wiki"><div class="grow"><div class="t">Wiki and tokenomics</div></div><span class="chev">›</span></button>'+
  '<button class="q" data-act="terms"><div class="grow"><div class="t">Terms and purchase help</div><div class="p">Refunds and payment problems: send /paysupport to the bot</div></div><span class="chev">›</span></button>'+
  '<button class="q" data-act="copyid"><div class="grow"><div class="t">Player ID</div><div class="p">'+esc(playerKey())+(IN_TG?', '+esc(tgName(TG_USER)):'')+'</div></div><span class="mut">Copy</span></button>'+
  '</div><p class="dimtxt" style="margin-top:12px">Build '+esc(window.BUILD||'dev')+'</p>');
}
// the offline report: what your ghost did in other pilots' matches while you were away (no points, just the story)
function showGhostReport(r){
 const go=()=>{if(state==='play'||state==='vs'||state==='round'){setTimeout(go,4000);return;}
  sheet('ghost',()=>'<h3>Your ghost fought while you were away</h3>'+
   '<p class="mut">While you were offline, the AI flew your tank (your build and gear) in AI seats of other pilots\' matches, labeled "Ghost of '+esc(IN_TG?tgName(TG_USER):'you')+'". Ghost matches pay no points and don\'t touch your rank.</p>'+
   '<div class="kv"><div><b class="num">'+fmtNum(r.m)+'</b><span>'+(r.m===1?'Match':'Matches')+'</span></div><div><b class="num">'+fmtNum(r.w)+'–'+fmtNum(r.l)+(r.d?'–'+fmtNum(r.d):'')+'</b><span>Won–lost'+(r.d?'–drawn':'')+'</span></div><div><b class="num">'+fmtNum(r.kills)+'</b><span>Tanks destroyed</span></div></div>'+
   '<p class="mut" style="margin-top:10px">'+fmtNum(r.dmg)+' damage dealt'+(r.m?', '+fmtNum(Math.round(r.dmg/r.m))+' a match':'')+'. '+(r.w>r.l?'Your build holds up.':r.w===r.l?'An even record.':'Tougher out there than it looks. A different build might do better.')+'</p>');};
 setTimeout(go,1500);
}
let devTapN=0,devTapT=0;
function openAdmin(){
 loadAdmin();
 sheet('admin',()=>{
  const A=adminData||{loading:true},R=A.revenue||{},pw=calcPower();
  return '<h3>Admin</h3>'+
   (A.loading?'<p class="mut">Loading server stats…</p>':A.error?'<p class="mut">Server stats: '+esc(A.error)+'</p>':
   '<div class="kv"><div><b class="num">'+fmtNum(A.players)+'</b><span>Players</span></div><div><b class="num">'+fmtNum(A.activeToday)+'</b><span>Active today</span></div><div><b class="num">$'+fmtNum(R.USD)+'</b><span>Revenue</span></div></div>'+
   '<p class="mut" style="margin-top:8px">'+fmtNum(R.STARS||0)+' Stars, '+(R.TON||0)+' TON, '+(R.SOL||0)+' SOL from '+fmtNum(R.count||0)+' payments'+(R.unverified?'. '+R.unverified+' need checking':'')+'</p>'+
   (A.stats?'<div class="kv"><div><b class="num">'+fmtNum(A.stats.newToday)+'</b><span>New today</span></div><div><b class="num">'+A.stats.back2+'%</b><span>Came back day 2</span></div><div><b class="num">'+A.stats.back5of7+'%</b><span>5+ of 7 days</span></div></div>'+
    '<div class="kv"><div><b class="num">'+A.stats.avgMatches+'</b><span>Matches per player</span></div><div><b class="num">'+A.stats.conv+'%</b><span>Paid</span></div><div><b class="num">$'+A.stats.arppu+'</b><span>Per payer</span></div></div>'+
    '<p class="dimtxt" style="margin-top:6px">Retention from the top 1,000 players. Paid = payers out of all players.</p>':''))+
   (A.channel===false?'<p class="mut" style="margin-top:8px"><b>Channel check is off.</b> Add the bot as an admin of '+esc(TG_URL.replace('https://',''))+' (Manage channel, Administrators, Add admin, search the bot). Until then the Join the channel quest pays without checking.</p>':A.channel?'<p class="dimtxt" style="margin-top:8px">Channel check is on: the Join the channel quest pays members only.</p>':'')+
   (A.flagged?'<h3 style="margin-top:16px;font-size:16px">Flagged for review ('+A.flagged.length+')</h3>'+
    (A.flagged.length?'<div class="list">'+A.flagged.map(f=>'<div class="row" style="gap:8px;align-items:flex-start;margin-top:8px"><div class="grow"><b>'+esc(f.n)+'</b> <span class="dimtxt">'+esc(f.id)+'</span><div class="dimtxt">'+f.why.map(esc).join('<br>')+'</div></div><button class="btn sm btn-quiet" data-act="flagclear" data-arg="'+esc(f.id)+'">Clear</button></div>').join('')+'</div>':'<p class="mut">Nobody flagged.</p>')+
    '<p class="dimtxt" style="margin-top:6px">Flagged pilots sit out the leaderboard and the airdrop snapshot until you clear them.</p>'+
    '<button class="btn sm btn-quiet block" style="margin-top:8px" data-act="snapshot">Copy the airdrop snapshot (top 1,000)</button>':'')+
   (A.clusters?'<h3 style="margin-top:16px;font-size:16px">Linked accounts ('+A.clusters.filter(c=>!c.ok).length+')</h3>'+
    '<p class="dimtxt" style="margin-top:4px">Accounts that look like one person: the same phone, the same paying wallet, the same controls move for move, starting together on one network, or trading live wins. Only the one with the most points counts for the airdrop until you clear the group.</p>'+
    (A.clusters.length?'<div class="list">'+A.clusters.map(c=>'<div class="row" style="gap:8px;align-items:flex-start;margin-top:8px"><div class="grow"><b>'+c.m.length+' accounts</b> <span class="dimtxt">'+esc(c.why.join(', '))+(c.ok?', cleared':'')+'</span><div class="dimtxt">'+c.m.map(x=>esc(x[1])+' ('+fmtNum(x[2])+')'+(x[0]===c.keep&&!c.ok?' counts':'')).join(', ')+'</div></div>'+(c.ok?'':'<button class="btn sm btn-quiet" data-act="clclear" data-arg="'+esc(c.sig)+'">Clear</button>')+'</div>').join('')+'</div>':'<p class="dimtxt" style="margin-top:6px">None found.</p>'):'')+
   (A.proof?'<h3 style="margin-top:16px;font-size:16px">Match records</h3><p class="dimtxt" style="margin-top:4px">AI results come with a record of the match. Flag only (recommended): every result scores, and a pilot with 3 results a day the record doesn\'t back up is flagged for your review. Enforce: those results score nothing.</p>'+
    '<div class="seg" style="grid-template-columns:1fr 1fr;margin-top:8px">'+[['flag','Flag only'],['enforce','Enforce']].map(([k,l])=>'<button class="'+(A.proof===k?'on':'')+'" data-act="adminproof" data-arg="'+k+'">'+l+'</button>').join('')+'</div>':'')+
   '<p class="mut" style="margin-top:8px">This device: power '+pw+', '+fmtNum(save.earned)+' lifetime points, '+(save.mp||0)+' matches</p>'+
   (SRV_ECO?'':'<h3 style="margin-top:16px;font-size:16px">Test grants (this device only)</h3>'+
   '<div class="acts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><button class="btn sm btn-quiet" data-act="dev" data-arg="pts">+50K points</button><button class="btn sm btn-quiet" data-act="dev" data-arg="epic">All epic gear</button><button class="btn sm btn-quiet" data-act="dev" data-arg="moon">Moonbeam</button><button class="btn sm btn-quiet" data-act="dev" data-arg="skin">Lunar skin</button><button class="btn sm btn-quiet" data-act="dev" data-arg="passxp">+2,000 pass XP</button><button class="btn sm btn-quiet" data-act="dev" data-arg="pass">Premium pass</button></div>');
 });
}

// ---------- crate reveal ----------
let revealQ=[],revealOv=null;
function showReveal(list){revealQ.push(...(list||[]).filter(Boolean));if(revealOv&&!overlays.includes(revealOv))revealOv=null;if(!revealOv)nextReveal();}   // a reveal closed by closeAll() never ran its onClose
function itemArt(r){
 if(r.gem)return 'gem:'+r.gem;
 if(r.tk==='moonbeam')return 'gear:w:moon:2:0';
 if(r.tk==='skin')return 'tank:lunar';
 if(r.tk==='respec')return 'tank:paint:'+esc(save.paint||'stock');
 if(r.tk==='vault')return 'vault:'+(r.lv|0);
 if(r.tk==='paint'||r.tk==='pass')return 'tank:paint:'+(r.paint||'stock');
 if(r.item)return 'gear:'+(r.item.isW?'w':'c')+':'+r.item.k+':'+r.item.tier+':'+(r.item.sal?1:0);
 return 'crate:'+r.tk+':'+(r.ri||0);
}
function nextReveal(){
 const r=revealQ.shift();if(!r){revealOv=null;uiDirty();return;}
 const isCrate=r.tk==='weapon'||r.tk==='chassis'||r.tk==='gem';
 revealOv=openOverlay('modal','<div class="reveal"><canvas data-art="'+(isCrate?'crate:'+r.tk+':'+(r.ri||0):itemArt(r))+'" class="'+(isCrate?'shake':'pop')+'"></canvas>'+
  '<div class="rtext'+(isCrate?' wait':'')+'"><div class="ttl" style="color:'+(r.color||'var(--moon)')+'">'+esc(r.title)+'</div><div class="sub">'+esc(r.sub||'')+'</div></div>'+
  '<button class="btn btn-go block" style="margin-top:16px" data-act="revealok">'+(revealQ.length?'Next':'Nice')+'</button></div>',{cls:'rv',onClose:()=>setTimeout(nextReveal,140)});
 if(isCrate){const box=revealOv.box;setTimeout(()=>{const c=$('canvas',box);if(!c)return;c.dataset.art=itemArt(r);c.classList.remove('shake');void c.offsetWidth;c.classList.add('pop');paintArt(box);const t=$('.rtext',box);if(t)t.classList.remove('wait');fx('box');},620);}
}

// ---------- first open ----------
function showWelcome(){
 openOverlay('full','<div class="grow"></div><canvas class="wtank" data-art="tank:me"></canvas>'+
  '<div class="big">Fight on the moon.<br>Climb for the airdrop.</div>'+
  '<div class="step"><i>1</i><p><b>Quick tank battles.</b> Drag to drive; your cannon fires itself. Most matches take under a minute.</p></div>'+
  '<div class="step"><i>2</i><p><b>Every match pays points.</b> Points rank you on the leaderboard and buy upgrades.</p></div>'+
  '<div class="step"><i>3</i><p><b>The top 1,000 pilots get $LUNAR.</b> At launch, weighted by points and days active.</p></div>'+
  (save.refBy?'<p class="mut" style="margin-top:12px">A friend invited you. Play again tomorrow for a +1,000 welcome bonus.</p>':'')+
  '<div class="grow"></div><button class="fight" data-act="firstfight" style="margin-top:18px"><span class="big">FIGHT</span><span class="small">Your first battle: a quick 1v1</span></button>'+
  '<button class="linkbtn" data-act="info" data-arg="airdrop">How the airdrop works</button>',{cls:'welcome',key:'welcome',noBack:true});
}

// ---------- VS screen (before every match after the first) ----------
let vsTimer=null;
function vsBuild(){
 const {adv,dis}=matchup(),foes=units.filter(u=>u.team!==0),mine=units.filter(u=>u.team===0),solo=isSolo(matchG);
 const live=pvpOn(),liveFoes=live&&pvpLiveFoes();
 const ctag=u=>{if(u===me||u.team===me.team||u.boss)return '';if(COUNTER[me.cls]===u.cls)return '<i class="ctag good">▲ YOU COUNTER</i>';if(COUNTER[u.cls]===me.cls)return '<i class="ctag bad">▼ COUNTERS YOU</i>';return '';};   // read from your side: green is good for you   // every foe card carries its own triangle standing vs you, so it can never go missing from the summary line
 const card=u=>{const i=units.indexOf(u);return '<div class="unit'+(u===me?' me':'')+'"><canvas data-art="unit:'+i+'"></canvas><b>'+vname(u===me?'You':u.name,u.vl|0)+vbadge(u.vl|0)+(live&&u.ai?' <i class="ai">AI</i>':'')+'</b><span style="color:'+(u.boss?'#ff4d5e':CH[u.cls].c)+'">'+(u.boss?'Boss':CH[u.cls].n)+'</span>'+ctag(u)+'</div>';};
 let cls='',txt='';
 if(adv&&!dis){cls='good';txt='Your '+CH[me.cls].n+' counters their '+CH[COUNTER[me.cls]].n+': +15% damage, 10% less taken.';}
 else if(dis&&!adv){cls='bad';const b=beatenBy(me.cls),fix=beatenBy(b);txt='Their '+CH[b].n+' counters your '+CH[me.cls].n+': they deal you +15% damage and take 10% less from you.'+(ownedChassisClasses().includes(fix)?' Switch to '+CH[fix].n+' to beat it.':' '+CH[fix].n+' beats it.');}
 else if(adv&&dis){const wn=foes.filter(f=>COUNTER[me.cls]===f.cls).map(f=>esc(f.name)),ln=foes.filter(f=>COUNTER[f.cls]===me.cls).map(f=>esc(f.name));txt='You counter '+wn.join(', ')+': +15% damage to '+(wn.length>1?'them':'it')+', 10% less taken. '+ln.join(', ')+' '+(ln.length>1?'counter':'counters')+' you: the same against you.';}
 else txt='Even matchup. No counters either way.';
 const owned=battleChassisClasses();
 return '<div class="head"><b>'+modeName(matchG,modeKey())+(isSeriesMode()?', best of 3':'')+'</b><span>'+MAPS[curMap].n+(matchG===featuredMode()?', featured +25%':'')+'</span><br><span class="aitag'+(liveFoes?' live':'')+'">'+(liveFoes?'Live opponents':'AI opponents')+'</span></div>'+
  '<div class="team'+(solo?' many':'')+'">'+foes.map(card).join('')+'</div><div class="mark">'+(solo?'FREE FOR ALL':'VS')+'</div><div class="team">'+mine.map(card).join('')+'</div>'+
  '<p class="mut vsgoal">'+esc(GTYPES[matchG].d)+'</p>'+
  '<div class="match '+cls+'">'+txt+(owned.length>1?'<div class="swap">'+owned.map(c=>'<button class="btn sm '+(c===me.cls?'btn-quiet on':'btn-ghost')+'" data-act="swapcls" data-arg="'+c+'">'+CH[c].n+'</button>').join('')+'</div>':'')+'</div>'+
  '<div class="grow"></div><button class="fight'+(live?' wait':'')+'" data-act="vsstart"'+(live?' disabled':'')+'><span class="big">'+(live?'GET READY':'START')+'</span><span class="small" id="vsCount"></span></button>'+
  '<button class="linkbtn" data-act="vsback">Back to menu</button>';
}
function showVS(o){
 const live=!!(o&&o.live),end=Date.now()+(live?o.ms:4000);
 let n=4;
 const ov=openOverlay('full',vsBuild(),{cls:'vs',key:'vs',build:vsBuild,onClose:fromBack=>{clearInterval(vsTimer);vsTimer=null;if(pvpOn()&&state==='vs'){pvpLeave();state='menu';}else if(state==='vs')state='menu';}});
 // live: the server starts the fight for everyone at once; AI: tap START or wait 4 seconds
 const tick=()=>{const el=$('#vsCount');if(!el)return;if(live)el.textContent='Fight starts in '+Math.max(1,Math.ceil((end-Date.now())/1000));else el.textContent=vsTimer?'Starts in '+n:'Tap to start';};
 clearInterval(vsTimer);vsTimer=setInterval(()=>{if(live){tick();return;}n--;if(n<=0){vsGo();return;}tick();},live?250:1000);tick();
 ov.re=()=>{ov.box.innerHTML=vsBuild();paintArt(ov.box);tick();};
}
let vsStarting=false;
async function vsGo(){
 if(pvpOn()||vsStarting)return;vsStarting=true;clearInterval(vsTimer);vsTimer=null;
 try{if(SRV_ECO&&mTicket&&mTicket.p)await mTicket.p;
  const ov=findOv('vs');if(ov){ov.onClose=null;closeOverlay(ov);}
  if(state==='vs'){
   if(mTicket&&['garage_changed','update'].includes(mTicket.err)){state='menu';doSync(false);showToast(mTicket.err==='update'?'Reconnect to update your garage before battle.':'Garage changed on another device. Please start again.');return;}
   startMatch();
  }
 }finally{vsStarting=false;}
}
function beginMatch(){
 if(state==='play'||(pvp&&pvp.phase==='find'))return;
 if(pvp)pvpClose();   // anything left from a live match that's over
 closeAll();
 // Arena, Moon Zone and today's featured mode look for live pilots first (the coached first match is always AI)
 const gk0=gtypeKey(),gk=gk0==='random'?GT_ORDER[(Math.random()*GT_ORDER.length)|0]:gk0;
 if(pvpEligible(gk)){pvpFind(gk);return;}
 prepareMatch(gk);
 if((save.mp||0)===0){startMatch();return;}   // the first match goes straight in, with coaching
 showVS();
}

// ---------- results ----------
const TIPS=['Mystery boxes boost you until you take enough damage. Grab them early.','Supers are strongest when enemies line up. Pierce Lance goes through cover.',
 'Crystal Rush: if you carry a lot, fall back. Every crystal drops when you go down.','Bounty: a 7-star tank is worth more than three 2-star kills.','Last Standing: let others fight, then clean up. Wrecks drop boxes.',
 'Upgrades in the Garage are permanent and cheap at first.','Moon Zone pays ×3 in 1v1.','Back off to repair in Moon Zone: 3.5 seconds out of fire and you start healing.',
 'Your login streak adds up to +30% to every quest. Check Quests every day.','Friends you invite pay you when they keep playing.'];
const ORD=['1st','2nd','3rd','4th','5th','6th'];
function resultsHTML(r){
 const M=MODES[r.mode],solo=isSolo(r.gtype),G=GTYPES[r.gtype];
 const title=r.won?'Victory':solo&&r.place<=3?ORD[r.place-1]+' place':r.drawn?(r.gtype==='boss'?'Survived':'Draw'):'Defeat',cls=r.won?'win':r.drawn||(solo&&r.place<=3)?'draw':'lose';
 const lines=solo?[[ORD[r.place-1]+' of '+units.length,fmtNum(r.base)]]:[[(r.won?'Win':r.drawn?'Draw':'Loss')+' in '+r.mode,fmtNum(r.won?M.win:r.drawn?M.draw:M.loss)]];
 if(r.series)lines.push(['Best of 3 ('+r.series.w[0]+' to '+r.series.w[1]+')','×'+r.modeX]);
 else if(r.modeX!==1)lines.push([G.label,'×'+r.modeX]);
 if(r.featured)lines.push(['Featured mode','×'+r.featX]);
 if(r.leagueMult!==1)lines.push([r.league.n+' league','×'+r.leagueMult]);
 if(r.streakBonus)lines.push(['Win streak: '+r.streak,'+'+r.streakBonus]);
 if(r.capped)lines.push(['Daily cap (20,000) reached','−'+fmtNum(r.pts-r.awarded)]);
 if(r.note)lines.push([esc(r.note),'0']);   // the server didn't count it (too fast, an expired ticket, no connection at the start)
 const t=tierOfPts(r.after),lo=TPTS[t],hi=TPTS[t+1],f=hi?(r.after-lo)/(hi-lo):1;
 const rb=lbCache?myRank(r.before):null,ra=lbCache?myRank(r.after):null;
 let rank='';
 if(ra&&!ra.outside&&lbMeta&&lbMeta.inTop)rank=rb&&!rb.outside&&rb.rank!==ra.rank?'Rank #'+fmtNum(rb.rank)+' → #'+fmtNum(ra.rank):'Rank #'+fmtNum(ra.rank);
 else if(ra&&ra.outside)rank=fmtNum(Math.max(1,lbMeta.cut-r.after+1))+' points to the top 1,000';
 let tip;
 if((save.mp||0)===1)tip=r.won?'Nice first win. Points rank you on the leaderboard and buy upgrades in the Garage.':'Close one. Drag to dodge shots while your cannon fires, and grab the gold box.';
 else if(giftPending()&&[2,4].includes(save.mp||0))tip='Come back tomorrow: your daily reward comes with a free Rare gem cache, one time.';
 else if(r.countered){const b=beatenBy(r.meCls),fix=beatenBy(b);tip='Their '+CH[b].n+' countered your '+CH[r.meCls].n+'. '+CH[fix].n+' beats '+CH[b].n+(ownedChassisClasses().includes(fix)?': switch on the next start screen.':'. Find one in a chassis crate.');}
 else if(r.quests.length)tip='Quest done: '+r.quests.join(', ')+'. Claim it in Quests.';
 else tip=TIPS[(save.mp||0)%TIPS.length];
 const st=r.stats;
 return (r.won?'<div class="confetti">'+Array.from({length:28},(_,i)=>'<i style="left:'+Math.min(96,i*3.5+Math.random()*2)+'%;background:'+['#ffcf4a','#5fe3a1','#4d9fff','#ff7a2f','#dfe7f2'][i%5]+';animation-duration:'+(1.6+Math.random()*1.4)+'s;animation-delay:'+(Math.random()*0.5)+'s"></i>').join('')+'</div>':'')+
  '<div class="grow"></div><div class="title '+cls+'">'+title+'</div>'+
  '<div class="sub">'+(r.live?'Live ':'')+(r.gtype==='zone'?'Moon Zone '+r.mode+', '+r.score[0]+' to '+r.score[1]:r.gtype==='crystal'?'Crystal Rush '+r.mode+', '+r.score[0]+' to '+r.score[1]+' crystals':r.gtype==='bounty'?'Bounty '+r.mode+', '+r.score[0]+' to '+r.score[1]+' stars':r.gtype==='boss'?'Survival '+r.mode+', megatank '+r.score[0]+'% down':solo?'Last Standing, '+ORD[r.place-1]+' of '+units.length:r.series?'Arena 1v1, rounds '+r.series.w[0]+' to '+r.series.w[1]:'Arena '+r.mode)+' on '+esc(MAPS[r.map].n)+'</div>'+
  '<div class="gain num">+'+fmtNum(r.awarded)+'<small>points</small></div>'+
  '<div class="lines">'+lines.map(([a,b])=>'<div class="line"><span>'+a+'</span><b>'+b+'</b></div>').join('')+'</div>'+
  '<div class="chips">'+(r.gtype==='crystal'?'<span class="chip"><b>'+(st.cry||0)+'</b>'+(st.cry===1?'crystal':'crystals')+'</span>':'')+(r.gtype==='bounty'?'<span class="chip"><b>'+(st.stars||0)+'</b>stars</span>':'')+'<span class="chip"><b>'+fmtNum(st.dmg)+'</b>damage</span><span class="chip"><b>'+fmtNum(st.taken||0)+'</b>taken</span><span class="chip"><b>'+st.kills+'</b>'+(st.kills===1?'kill':'kills')+'</span><span class="chip"><b>'+st.boxes+'</b>'+(st.boxes===1?'box':'boxes')+'</span><span class="chip"><b>'+st.sups+'</b>'+(st.sups===1?'super':'supers')+'</span>'+(st.best?'<span class="chip"><b>'+fmtNum(st.best)+'</b>best hit</span>':'')+(st.arm?'<span class="chip"><b>'+fmtNum(st.arm)+'</b>armor blocked</span>':'')+(st.shd?'<span class="chip"><b>'+fmtNum(st.shd)+'</b>shield blocked</span>':'')+(r.won&&r.streak>=2?'<span class="chip"><b>'+r.streak+'</b>win streak</span>':'')+(st.low>0&&st.low<=0.25?'<span class="chip"><b>'+Math.round(st.low*100)+'%</b>lowest HP</span>':'')+'</div>'+
  '<div class="progress"><div class="row"><span style="color:'+TIERC[t]+';font:600 15px var(--disp)">'+TIERS[t]+'</span>'+vbadge(myVl())+'<span class="grow"></span><span class="mut">'+(hi?fmtNum(hi-r.after)+' to '+TIERS[t+1]:'Top tier')+'</span></div><div class="track"><i id="resBar" style="width:'+Math.round(Math.max(0,(r.before-lo)/((hi||r.after)-lo||1))*100)+'%;background:'+TIERC[t]+'" data-to="'+Math.round(f*100)+'"></i></div>'+(rank?'<div class="mut" style="margin-top:8px">'+rank+'</div>':'')+'</div>'+
  '<div class="tip">'+esc(tip)+'</div>'+
  '<div class="grow"></div><div class="acts"><button class="fight" data-act="again"><span class="big">PLAY AGAIN</span><span class="small">'+(lastQuick?'Another quick match':'Win '+rangeTxt(winRange(gtypeKey(),modeKey()))+' points')+'</span></button>'+
  '<div class="two">'+(r.won&&IN_TG?'<button class="btn btn-quiet" data-act="sharewin">Share win</button>':'<button class="btn btn-quiet" data-act="tabmenu" data-arg="garage">Garage</button>')+'<button class="btn btn-ghost" data-act="menu">Menu</button></div></div>';
}
function onMatchEnd(r){
 if(!r)return;
 dropBack(leaveFn);paused=false;
 const ov=openOverlay('full',resultsHTML(r),{cls:'res',key:'res',onClose:fromBack=>{if(fromBack)exitBattle();}});
 setTimeout(()=>{const b=$('#resBar',ov.box);if(b)b.style.width=b.dataset.to+'%';},120);
 uiDirty();
}

// ---------- between rounds (1v1 best of 3) ----------
let roundTimer=null;
function roundHTML(info){
 const {adv,dis}=matchup(),owned=ownedChassisClasses(),foe=units.find(u=>u.team===1);
 let tip;
 if(dis&&!adv){const b=beatenBy(me.cls),fix=beatenBy(b);tip='Their '+CH[b].n+' counters your '+CH[me.cls].n+(owned.includes(fix)?'. Switch to '+CH[fix].n+' to beat it.':'.');}
 else if(adv&&!dis)tip='Your '+CH[me.cls].n+' counters their '+CH[foe.cls].n+'.';
 else tip='Next up: their '+CH[foe.cls].n+'.';
 return '<div class="rt '+(info.won?'win':info.lost?'lose':'')+'">'+(info.won?'Round won':info.lost?'Round lost':'Round drawn')+'</div>'+
  '<div class="rscore num"><span style="color:var(--ally)">'+info.w[0]+'</span><i>–</i><span style="color:var(--foe)">'+info.w[1]+'</span></div>'+
  '<p class="mut">First to 2 wins. '+esc(tip)+'</p>'+
  (owned.length>1?'<div class="swap">'+owned.map(c=>'<button class="btn sm '+(c===me.cls?'btn-quiet on':'btn-ghost')+'" data-act="rswap" data-arg="'+c+'">'+CH[c].n+'</button>').join('')+'</div>':'')+
  (info.live?'<button class="btn btn-quiet block" style="margin-top:14px" disabled>Round '+info.round+'<span id="rCount" class="dimtxt" style="color:inherit;opacity:.7"></span></button>'
   :'<button class="btn btn-go block" style="margin-top:14px" data-act="nextround">Start round '+info.round+'<span id="rCount" class="dimtxt" style="color:inherit;opacity:.7"></span></button>');
}
function onRoundEnd(info){
 if(state!=='round'||!inBattle())return;
 let n=4;const end=Date.now()+(info.ms||4000);
 const ov=openOverlay('modal',roundHTML(info),{key:'round',sticky:true,noBack:true,cls:'rm'});
 const tick=()=>{const el=$('#rCount',ov.box);if(!el)return;el.textContent=info.live?' starts in '+Math.max(1,Math.ceil((end-Date.now())/1000)):roundTimer?' in '+n:'';};
 ov.re=()=>{ov.box.innerHTML=roundHTML(info);tick();};
 clearInterval(roundTimer);roundTimer=setInterval(()=>{if(info.live){tick();return;}n--;if(n<=0){goRound();return;}tick();},info.live?250:1000);tick();
}
function goRound(){if(pvpOn())return;clearInterval(roundTimer);roundTimer=null;const ov=findOv('round');if(ov){ov.onClose=null;closeOverlay(ov);}startRound();}
function onRoundStart(){clearInterval(roundTimer);roundTimer=null;const ov=findOv('round');if(ov){ov.onClose=null;closeOverlay(ov);}}

// ---------- match start / leave ----------
let leaveFn=null,paused=false;
function onMatchStart(){
 closeAll();
 if(typeof proofBegin==='function')proofBegin();   // AI matches keep a record for the server (proof.js)
 if(typeof resetTapFocus==='function')resetTapFocus();
 document.body.classList.add('battle');fit();
 tut=(save.mp||0)===0?{step:0,t:0,moved:0}:null;
 if(leaveFn)dropBack(leaveFn);
 leaveFn=()=>confirmLeave();pushBack(leaveFn);
}
function confirmLeave(){
 if((state!=='play'&&state!=='round')||findOv('leave'))return;
 paused=true;
 openOverlay('modal','<h3>Leave this match?</h3><p class="mut">It counts as a loss and pays no points.</p><div class="acts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px"><button class="btn btn-quiet" data-act="leavecancel">Keep fighting</button><button class="btn btn-ghost" data-act="leaveok">Leave</button></div>',
  {key:'leave',onClose:()=>{paused=false;if(state==='play'||state==='round'){dropBack(leaveFn);pushBack(leaveFn);}}});
}
function forfeit(){
 const ov=findOv('leave');if(ov){ov.onClose=null;closeOverlay(ov);}
 if(state!=='play'&&state!=='round')return;
 clearInterval(roundTimer);roundTimer=null;
 const live=pvpOn();
 if(live)pvpLeave();
 state='menu';paused=false;
 ecoQuit(save);store();   // a loss, no points (the server records the same: the room for a live match, the ticket for an AI one)
 if(live)applyEcoSoon();else matchEnd({quit:true});
 exitBattle();
}
function exitBattle(){
 if(pvp)pvpClose();   // leaving the results of a live match (or a lost one)
 closeAll();if(leaveFn){dropBack(leaveFn);leaveFn=null;}
 if(state!=='play')state='menu';
 document.body.classList.remove('battle');tut=null;paused=false;
 uiDirty();
}

// ---------- terms: shown once, before the first purchase ----------
const TERMS_URL='https://solb7403-creator.github.io/war-machines/terms.html';
let termsGo=null;
function askTerms(go){
 termsGo=go;
 openOverlay('modal','<h3>Before your first purchase</h3><p>Every purchase backs LUNAR directly. 25% goes into the $LUNAR launch liquidity pool, and the other 75% funds development, servers, promotion and partnerships, so the game keeps growing. Verified spending is considered in the airdrop.</p><p class="mut" style="margin-top:8px">Items are for use in the game. They have no cash value, can’t be traded or cashed out, and don’t buy $LUNAR or a set amount of it. Refunds or payment problems: send /paysupport to the bot.</p>'+
  '<button class="linkbtn" data-act="terms">Read the full terms</button><div class="acts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><button class="btn btn-ghost" data-act="termsno">Not now</button><button class="btn btn-go" data-act="termsok">I agree</button></div>',{key:'terms',onClose:()=>{termsGo=null;}});
}

// ---------- toast ----------
let toastTimer=0;
function showToast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300);}

// ---------- daily reminder (the bot sends one message when the reward is ready) ----------
function setReminders(on){
 if(!IN_TG){showToast('Reminders work inside Telegram');return;}
 save.remindAsked=true;
 if(!on){save.remind=false;store();api('/api/notify-optin',{on:false}).catch(()=>{});showToast('Daily reminder off');return;}
 const done=ok=>{save.remind=!!ok;store();if(ok)api('/api/notify-optin',{on:true}).catch(()=>{});showToast(ok?'Daily reminder on':'Allow messages from the bot to get reminders');uiDirty();};
 try{if(TG.requestWriteAccess&&tgv('6.9'))TG.requestWriteAccess(ok=>done(ok));else done(true);}catch(e){done(true);}
}
function askReminder(){
 setTimeout(()=>{if(findOv('remind')||inBattle())return;
  openOverlay('modal','<h3>Keep your streak alive</h3><p class="mut">Get one message a day when your reward is ready. Turn it off any time in Settings.</p><div class="acts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px"><button class="btn btn-ghost" data-act="remindno">Not now</button><button class="btn btn-go" data-act="remindyes">Remind me</button></div>',{key:'remind'});},700);
}

// ---------- taps ----------
const ACT={
 tab:a=>setTab(a),
 tabmenu:a=>{exitBattle();setTab(a);},
 info:a=>showInfo(a),
 coreinfo:a=>{const [t,s]=coreInfo(a);sheet('info',()=>'<h3>'+t+'</h3>'+infoBody(s));},
 settings:()=>openSettings(),
 gfx:a=>{setGfx(a);fx('tap');const ov=findOv('settings');if(ov&&ov.re)ov.re();else openSettings();},
 points:()=>showInfo('points'),
 gtype:a=>{save.gtype=a;store();fx('tap');},
 feat:()=>{save.gtype=featuredMode();save.featSeen=dayNum();store();fx('tap');showToast(GTYPES[save.gtype].label+' selected: +25% today');},
 pass:()=>openPass(),
 claimpass:a=>{const [tr,i]=a.split(':');when(claimPass(tr,+i),r=>{if(!r)return;if(r.pts)showToast('+'+fmtNum(r.pts)+' points');if(r.reveal)showReveal([r.reveal]);uiDirty();});},
 buypass:()=>{if(passState().prem)return;pay(PASS_PRICE.ton,{kind:'pass'});},
 paints:()=>openPaints(),
 paint:a=>{const P=PAINTS[a];if(!P)return;
  if(save.paints&&save.paints[a]){if(save.lab){const p=labSpec(myLoadout());p.paint=a;labQuickSpec(p);return;}save.paint=a;store();fx('tap');showToast(P.n+' paint on');return;}
  if(P.pass){openPass();return;}
  if(P.only==='vault'){showToast('Unlocks at Hyperspace Vault level '+VAULT_PAINT_LV);openVault();return;}
  if(P.only){showToast('Only in the Founder pack');if(FOUNDER_OPEN){closeAll();setTab('shop');}return;}
  pay(P.ton,{kind:'paint',id:a});},
 tune:a=>{const [sl,k,t]=a.split('|');when(tuneItem(sl==='w',k,+t),r=>{if(!r)return;showToast(r.better?'New roll '+pct(r.roll)+', up from '+pct(r.old):'Rolled '+pct(r.roll)+'. You kept '+pct(r.old));syncPlayer();uiDirty();});},
 terms:()=>openLink(TERMS_URL),
 termsok:()=>{save.termsOk=Date.now();store();const go=termsGo;termsGo=null;const ov=findOv('terms');if(ov)closeOverlay(ov);if(go)go();},
 termsno:()=>{const ov=findOv('terms');if(ov)closeOverlay(ov);},
 mode:a=>{save.mode=a;store();fx('tap');},
 map:a=>{save.map=a;store();fx('tap');},
 fight:()=>{lastQuick=false;beginMatch();},
 quick:()=>quickMatch(),
 setup:()=>openSetup(),
 setupdone:()=>{const ov=findOv('setup');if(ov)closeOverlay(ov);},
 firstfight:()=>{save.welcomed=true;store();closeAll();beginMatch();},
 vsstart:()=>vsGo(),
 vsback:()=>{const ov=findOv('vs');if(ov)closeOverlay(ov);},
 pvpai:()=>{if(!pvp)return;let g=pvp.q.g;if(g==='quick'){const gs=quickModes();g=gs[(Math.random()*gs.length)|0];}pvpCancel();closeFind();prepareMatch(g);showVS();},
 pvpcancel:()=>{pvpCancel();closeFind();},
 swapcls:a=>{if(!pvpOn()){clearInterval(vsTimer);vsTimer=null;}switchChassis(a);fx('tap');const ov=findOv('vs');if(ov)ov.re();},   // live: the server's countdown keeps running
 again:()=>{closeAll();exitBattle();if(lastQuick)quickMatch();else beginMatch();},   // Play again repeats Quick Match if that's what you played
 menu:()=>{exitBattle();setTab('play');},
 sharewin:()=>{const r=lastResult;shareRef('I just won '+(isSolo(r.gtype)?(r.live?'live ':'')+'Last Standing':'a '+(r.live?'live ':'')+GTYPES[r.gtype].label+' '+r.mode)+' in LUNAR: War Machines (+'+fmtNum(r.awarded)+' points). The top 1,000 pilots get $LUNAR at launch. Join my squad:');},
 login:()=>{const r=loginState();if(r.claimedToday)return;when(claimLogin(),c=>{if(!c)return;const qb=questBoost();showToast('+'+fmtNum(c.pts)+' points, day '+c.day+' of your streak'+(qb?'. Quest points +'+Math.round(qb*100)+'% today':''));const rv=[c.reveal,c.gift].filter(Boolean);if(rv.length)showReveal(rv);else if(IN_TG&&!save.remindAsked&&!save.remind)askReminder();uiDirty();});},
 claimdq:a=>{const q0=dailyQuests().find(x=>x.id===a);if(q0&&!q0.done){showToast(q0.t+': '+fmtNum(q0.p)+' of '+fmtNum(q0.goal));return;}when(claimDaily(a),n=>{if(n)showToast('+'+fmtNum(n)+' points');uiDirty();});},
 claimwq:a=>{const q0=weeklyQuests().find(x=>x.id===a);if(q0&&!q0.done){showToast(q0.t+': '+fmtNum(q0.p)+' of '+fmtNum(q0.goal));return;}when(claimWeeklyQuest(a),n=>{if(n)showToast('+'+fmtNum(n)+' points');uiDirty();});},
 swapdq:a=>{const left=swapsLeft();when(swapDaily(a),N=>{if(N)showToast('New quest: '+N.t);else showToast(left?'No other quest to swap in':'No swaps left today');uiDirty();});},
 deals:a=>{if(a==='w')save.wdealSeen=weekNum();else save.dealSeen=dayNum();store();openDeals(a==='w'?'w':'d');},
 founder:()=>{if(save.founder||!FOUNDER_OPEN)return;pay(FOUNDER.ton,{kind:'founder'});},
 claimq:a=>{const Q=QUESTS.find(q=>q.id===a),e=save.q[a];if(!e||!e.done){showToast(Q?Q.d:'Not done yet');return;}when(claimQuest(a),n=>{if(n)showToast('+'+n+' points: '+Q.n);uiDirty();});},
 visit:a=>{when(visitLinkQuest(a),()=>uiDirty('quests'));},
 weekly:()=>{const v=claimWeekly();if(!v){showToast('Claim '+(WQ_GOAL-(save.wq.n||0))+' more daily quests to open it');return;}when(v,r=>{if(!r)return;showToast('+'+fmtNum(r.pts)+' points');showReveal([r.reveal]);uiDirty();});},
 share:()=>shareRef(),copy:()=>copyRef(),claimref:()=>{when(claimRefs(),()=>uiDirty('quests'));},
 respec:()=>{const inv=upInvested(save.up);if(!inv)return;
  const half=Math.floor(inv*RESPEC_BACK),fee=inv-half,pr=ecoPrice(save,{kind:'respec'},ecoX()),cur=save.payCur;
  const body=save.rsCr?'<p class="mut">All '+upLevels(save.up)+' levels go back to 0. Your paid reset is ready, so all <b>'+fmtNum(inv)+'</b> points come back.</p><div class="acts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px"><button class="btn btn-quiet" data-act="respeccancel">Keep it</button><button class="btn btn-gold" data-act="respecok">Reset</button></div>':
   '<p class="mut">All '+upLevels(save.up)+' levels go back to 0. The reset fee is '+fmtNum(fee)+' points.</p>'+
   '<div style="display:grid;gap:8px;margin-top:14px"><button class="btn btn-ghost block" data-act="respecok">Pay '+fmtNum(fee)+' points · get '+fmtNum(half)+' back</button>'+
   (pr?'<button class="btn btn-gold block" data-act="respecpay">Pay '+priceLabel(pr.ton,pr.stars)+' · get all '+fmtNum(inv)+' back</button>'+
    '<div class="seg c3">'+[['stars','Stars'],['ton','TON'],['sol','SOL']].map(([k,l])=>'<button class="'+(cur===k?'on':'')+'" data-act="respeccur" data-arg="'+k+'">'+l+'</button>').join('')+'</div>':
    '<p class="mut" style="margin:0">Builds worth under 9,375 points reset with points only.</p>')+
   '<button class="btn btn-quiet block" data-act="respeccancel">Keep it</button></div>';
  const ov=findOv('respec');if(ov)closeOverlay(ov);
  openOverlay('modal','<h3>Reset your build?</h3>'+body,{key:'respec'});},
 respeccur:a=>{save.payCur=a;store();if(a==='sol')fetchPrices();if(a==='ton')initTonConnect();fx('tap');ACT.respec();},
 respecpay:()=>{const pr=ecoPrice(save,{kind:'respec'},ecoX());const ov=findOv('respec');if(ov)closeOverlay(ov);if(pr)pay(pr.ton,{kind:'respec'});},
 respeccancel:()=>{const ov=findOv('respec');if(ov)closeOverlay(ov);},
 respecok:()=>{const ov=findOv('respec');if(ov)closeOverlay(ov);when(respecBuild(),ok=>{if(ok)syncPlayer();uiDirty();});},
 up:a=>{const lv=save.up[a];if(lv<4&&upLevels(save.up)>=BUILD_MAX){showToast('Build budget full: '+BUILD_MAX+' of '+BUILD_MAX+' levels. Reset your build to move them.');return;}if(lv<4&&(save.pts||0)<UPS[a].costs[lv]){showToast('You need '+fmtNum(UPS[a].costs[lv]-(save.pts||0))+' more points');return;}if(lv>=4){showToast('Already at max level');return;}when(buyUp(a),ok=>{if(ok)syncPlayer();uiDirty();});},
 gear:a=>openGearPicker(a==='w'),
 equip:a=>{if(save.lab){const [sl,id]=a.split('|'),[k,ts='2']=id.split(':'),p=labSpec(myLoadout()),x={t:parseInt(ts,10),s:ts.endsWith('s')};if(sl==='w')p.w={a:k,...x};else p.c={c:k,...x};labQuickSpec(p);return;}const [s,id]=a.split('|'),isW=s==='w',[k,ts]=id.split(':'),t=ts===undefined?0:parseInt(ts,10),sl=!!ts&&ts.slice(-1)==='s';
  const own=k==='moon'?save.moonbeam:isW?(sl?salvOf(k,t):ownW(k,t)):(sl?salvOf(k,t):ownC(k,t));
  if(!own){showToast('Find it in the '+crateName(isW?'weapon':'chassis',t).toLowerCase());return;}
  if(isW){save.weapon=k;if(k!=='moon'){save.wTier[k]=t;save.wSal=save.wSal||{};save.wSal[k]=sl;}}
  else{save.chassis=k;save.cTier[k]=t;save.cSal=save.cSal||{};save.cSal[k]=sl;}
  store();syncPlayer();fx('tap');showToast('Equipped '+(isW?getW(k):getC(k)).name);},
 core:a=>openCorePicker(+a),
 coreset:a=>{const [i,k]=a.split(':');socketCore(+i,k==='-'?null:k);fx('tap');const ov=findOv('core');if(ov)closeOverlay(ov);showToast(k==='-'?'Socket emptied':GEM[k].name+' core in socket '+(+i+1));},
 paycur:a=>{save.payCur=a;store();if(a==='sol')fetchPrices();if(a==='ton')initTonConnect();fx('tap');},
 tonwallet:()=>tonWalletButton(),
 solwallet:()=>openSolWallets(),
 setsolw:a=>{save.solWallet=a;store();const ov=findOv('solw');if(ov)closeOverlay(ov);},
 crate:a=>{const [tk,ri]=a.split(':');openCrate(tk,+ri);},
 buybox:a=>{const [tk,ri]=a.split(':'),p=boxPrice(tk,+ri);pay(p,{kind:'box',tk,ri:+ri,price:p,deal:dealOf(tk,+ri)});},
 buypts:a=>{const [tk,ri]=a.split(':');when(openBoxWithPoints(tk,+ri),r=>{if(r){const ov=findOv('crate');if(ov)closeOverlay(ov);fx('buy');showReveal([r]);}uiDirty();});},
 salvage:a=>{const [tk,ri]=a.split(':');when(buySalvage(tk,+ri),r=>{if(r){fx('buy');showReveal([r]);}uiDirty();});},
 starter:()=>{if(save.starter)return;pay(STARTER.ton,{kind:'starter'});},
 premium:a=>{if(a==='moonbeam'){if(save.moonbeam)return;pay(MOONBEAM_PRICE,{kind:'moonbeam'});}else{if(save.skin==='lunar')return;pay(SKINS.lunar.price,{kind:'skin'});}},
 revealok:()=>{if(revealOv)closeOverlay(revealOv);},
 lbscope:a=>{lbScope=a;fx('tap');uiDirty('ranks');},
 vault:()=>openVault(),
 vaultbuy:a=>{const B=VAULT[a];if(!B)return;pay(B.ton,{kind:'vault',tk:a});},
 vaultboard:()=>{closeAll();lbScope='vault';loadLB();setTab('ranks');},
 wiki:()=>openLink(WIKI_URL),
 lpwallet:()=>openLink('https://solscan.io/account/'+LP_WALLET),
 haptics:()=>{save.haptics=!save.haptics;store();if(save.haptics)fx('tap');},
 sound:()=>{save.sound=save.sound===false;store();if(save.sound){audioResume();setTimeout(()=>fx('tap'),60);}},
 remind:()=>setReminders(!save.remind),
 remindyes:()=>{const ov=findOv('remind');if(ov)closeOverlay(ov);setReminders(true);},
 remindno:()=>{save.remindAsked=true;store();const ov=findOv('remind');if(ov)closeOverlay(ov);},
 copyid:()=>{try{navigator.clipboard.writeText(playerKey()).then(()=>showToast('Player ID copied'),()=>showToast(playerKey()));}catch(e){showToast(playerKey());}},
 devtap:()=>{if(!IS_DEV)return;const now=performance.now();if(now-devTapT>4000)devTapN=0;devTapT=now;if(++devTapN>=5){devTapN=0;openAdmin();}},
 dev:a=>{if(!IS_DEV)return;
  if(SRV_ECO){showToast('Test grants only work outside Telegram now: the server owns points and gear');return;}
  if(a==='pts'){save.pts=(save.pts||0)+50000;}
  if(a==='epic'){save.cTier={scout:2,vanguard:2,titan:2};save.cOwn={scout:[0,1,2],vanguard:[0,1,2],titan:[0,1,2]};save.wTier={pulse:2,twin:2,siege:2};save.wOwn={pulse:[0,1,2],twin:[0,1,2],siege:[0,1,2]};}
  if(a==='moon'){save.moonbeam=true;}
  if(a==='skin'){save.skin='lunar';}
  if(a==='passxp'){passXP(2000);}
  if(a==='pass'){passState().prem=true;}
  store();showToast('Granted on this device (test)');},
 flagclear:a=>{loadAdmin({clear:a});showToast('Cleared: '+a+' counts for the snapshot again');},
 clclear:a=>{loadAdmin({clearCl:a});showToast('Cleared: every account in that group counts again');},
 adminproof:a=>{loadAdmin({proof:a});showToast(a==='flag'?'Match records: flag only':'Match records: enforced');},
 snapshot:()=>{api('/api/admin',{snap:1}).then(r=>{const rows=(r.snapshot||[]).map((x,i)=>[i+1].concat(x).join(','));const txt='rank,player,name,points,days,airdrop credit,verified spend (TON value),genesis gold\n'+rows.join('\n');
  try{navigator.clipboard.writeText(txt).then(()=>showToast('Snapshot copied: '+rows.length+' pilots'),()=>showToast(rows.length+' pilots (copy failed)'));}catch(e){showToast(rows.length+' pilots');}}).catch(()=>showToast('Snapshot unavailable'));},
 leavecancel:()=>{const ov=findOv('leave');if(ov)closeOverlay(ov);},
 leaveok:()=>forfeit(),
 rswap:a=>{if(!pvpOn()){clearInterval(roundTimer);roundTimer=null;}switchChassis(a);fx('tap');},
 nextround:()=>goRound()};
function onTap(e){
 const el=e.target.closest('[data-act]');if(!el||el.disabled)return;
 const f=ACT[el.dataset.act];if(!f)return;
 e.preventDefault();
 try{f(el.dataset.arg||'',el);}catch(err){setTimeout(()=>{throw err;});}
 uiDirty();
}

// ---------- boot ----------
function initUI(){
 $('#tabbar').innerHTML=TAB_LIST.map(([k,l])=>'<button class="tab'+(k===uiTab?' on':'')+'" data-act="tab" data-arg="'+k+'">'+ICON[k]+'<span>'+l+'</span><i class="dot"></i></button>').join('');
 $('#btnSettings').innerHTML=ICON.cog;
 document.addEventListener('click',onTap);
 document.addEventListener('pointerdown',()=>{ptrDown=true;},true);
 const up=()=>{ptrDown=false;};
 document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
 // keep iOS from rubber-banding the whole app; the menu lists still scroll
 document.addEventListener('touchmove',e=>{if(!e.target.closest('.screen,.pscroll,.sheet,.modal,.full'))e.preventDefault();},{passive:false});
 document.addEventListener('gesturestart',e=>e.preventDefault());
 addEventListener('keydown',e=>{if(e.key==='Escape'&&state==='play')confirmLeave();});
 addEventListener('resize',()=>{if(!inBattle())uiDirty();});
 setInterval(()=>{if(!inBattle()&&(uiTab==='quests'||uiTab==='ranks'))uiDirty(uiTab);},30000);   // countdowns + board refresh
 uiReady=true;renderUI();
}

// Two owned configurations. Engineering is optional; ordinary Play remains unchanged.
let labEditor=null;

// Laboratory inspection: all values are taken from the same loadout calculators as gameplay.
const labStatRows=(spec)=>{
 const L=ecoLoadout(save,spec),m=machineMetrics(L),fit=fittingStats(spec.mods||{});
 const skin=1.08;
 // Capacity applies to the whole build: legal pairs can exceed a single fitting's 6%.
 const ceilings={hp:0,spd:0,dps:0};
 for(const hull of Object.keys(FITS.hull))for(const mobility of Object.keys(FITS.mobility))for(const mount of Object.keys(FITS.mount)){
  const f=fittingStats({hull,mobility,mount});
  if(f.weight<=FIT_BUDGET.weight&&f.power<=FIT_BUDGET.power)for(const k of Object.keys(ceilings))ceilings[k]=Math.max(ceilings[k],f[k]);
 }
 const topChassis=CHORDER.map(k=>chassisOf(k,2,ROLL_MAX,false));
 const hpMax=Math.round(Math.round(STAT.hp*1.32*Math.max(...topChassis.map(c=>c.hp))*skin)*(1+ceilings.hp));
 const dpsMax=Math.round(Math.max(WEAPONS.moon.dps,...WORDER.map(k=>weaponOf(k,2,ROLL_MAX,false).dps))*1.32*skin*(1+ceilings.dps)*
  (1+GEM.dmg.amt*GEM_LV[GEM_LV.length-1])*(1+GEM.rof.amt*GEM_LV[GEM_LV.length-1]));
 const spdMax=+(STAT.speed*1.24*Math.max(...topChassis.map(c=>c.spd))*(1+ceilings.spd)*(1+GEM.spd.amt*GEM_LV[GEM_LV.length-1])).toFixed(1);
 const powerMax=Math.pow(hpMax*dpsMax*(spdMax/STAT.speed),1/3)*1.2*Math.pow(1.25,3);
 return [['Health',m.hp,hpMax],['DPS',m.dps,dpsMax],['Speed',m.spd,spdMax],
  ['Power',powerOf(L),powerMax],['Fitting weight',fit.weight,FIT_BUDGET.weight],['Fitting power',fit.power,FIT_BUDGET.power]];
};
function labBars(spec,reference){
 const rows=labStatRows(spec),base=reference?labStatRows(reference):rows;
 return '<div class="lab-stats">'+rows.map((r,i)=>{
  const max=Math.max(r[2],r[1],base[i][1],1),pct=Math.max(0,Math.min(100,100*r[1]/max));
  const beforePct=Math.max(0,Math.min(100,100*base[i][1]/max));
  return '<div class="lab-stat"><div><span>'+esc(r[0])+'</span><strong>'+esc(String(r[1]))+
  (reference?' <small>(saved '+esc(String(base[i][1]))+')</small>':'')+'</strong></div>'+
  '<div class="lab-track"><i style="width:'+pct+'%"></i>'+(reference?'<em style="left:'+beforePct+'%" title="Saved configuration"></em>':'')+
  '</div></div>';
 }).join('')+'</div>';
}
function labItemBars(key,spec){
 const L=ecoLoadout(save,spec),entries=[];
 const add=(name,value,max,suffix='')=>entries.push([name,+Number(value).toFixed(3),max,suffix]);
 if(key==='weapon'){
  const w=weaponOf(L.w.a,L.w.t,L.w.q,L.w.s);
  // Legendary is already a complete fixed weapon. Never apply Epic roll scaling to its base DPS.
  const ceiling=Math.max(WEAPONS.moon.dps,...WORDER.map(k=>WEAPONS[k].dps*TIER_MULT[2]*ROLL_MAX));
  add('Weapon DPS',w.dps,ceiling);add('Damage per shot',w.dps*w.shot,ceiling*WEAPONS.siege.shot);
  add('Shots / sec',1/w.shot,1/Math.min(...Object.values(WEAPONS).map(w=>w.shot)));
  add('Projectile speed',w.pspd,26);
  // Compare genuine rarity levels, not the underlying premium compatibility tier.
  add('Item level',w.premium?4:w.tier+1,4);
 }else if(key==='chassis'){
  const c=chassisOf(L.c.c,L.c.t,L.c.q,L.c.s);
  const tier=TIER_MULT[2]*ROLL_MAX;
  add('HP multiplier',c.hp,Math.max(...Object.values(CH).map(x=>x.hp))*tier,'×');
  add('Speed multiplier',c.spd,Math.max(...Object.values(CH).map(x=>x.spd))*(1+(tier-1)*0.5),'×');
  add('Turning multiplier',c.turn,Math.max(...Object.values(CH).map(x=>x.turn))+.1,'×');
  add('Item level',c.tier+1,3);
 }else if(key.startsWith('core')){
  const k=spec.cores[Number(key.slice(4))];
  if(k&&GEM[k]){const lv=save.gemLvl?.[k]||1;add('Core level',lv,GEM_LV.length);add('Effect',100*coreVal(k,lv),100*coreVal(k,GEM_LV.length),'%');}
 }else if(key.startsWith('fit')){
  const k=key.slice(3),v=fittingSelection(spec.mods)[k],f=FITS[k][v];
  if(f){for(const [n,v] of [['HP',f.hp],['Speed',f.spd],['DPS',f.dps]])add(n+' change',v*100,6,'%');
   add('Weight',f.weight,FIT_BUDGET.weight);add('Power',f.power,FIT_BUDGET.power);}
 }
 return entries.length?'<div class="lab-stats lab-item-stats">'+entries.map(([name,val,max,suffix])=>
  '<div class="lab-stat"><div><span>'+esc(name)+'</span><strong>'+esc(String(val))+suffix+'</strong></div>'+
  '<div class="lab-track '+(val<0?'lab-negative':'')+'"><i style="width:'+Math.max(0,Math.min(100,Math.abs(val)*100/max))+'%"></i></div></div>'
 ).join('')+'</div>':'<p class="mut">Cosmetic item. No combat attributes.</p>';
}
function labItemFacts(key,spec){
 const details=[];
 const line=(name,value)=>details.push([name,String(value)]);
 const pct=n=>(+(n*100).toFixed(2))+'%';
 if(key==='weapon'){
  const base=WEAPONS[spec.w.a],live=ecoLoadout(save,spec).w;
  const actual=weaponOf(live.a,live.t,live.q,live.s),T=tankOf(ecoLoadout(save,spec),1);
  const gem=k=>T.gems.includes(k)?GEM[k].amt*T.gemM[k]:0;
  const supreme=(typeof SUP!=='undefined'&&SUP[actual.arch])||null;
  if(base){
   line('Rarity',actual.premium?'Legendary':(live.s?'Salvaged':['Common','Rare','Epic'][live.t]));
   line('Gear level',actual.premium?'4 / 4':(live.t+1)+' / 3');
   line('Weapon class',base.n);
   line('Role',base.d);
   line('Actual weapon DPS',actual.dps);
   line('Hit damage',+(actual.dps*actual.shot).toFixed(2));
   line('Fire rate',+(1/actual.shot).toFixed(2)+' shots/sec');
   line('Equipped hit damage',+(T.wdps*T.wshot*T.dmgM*(1+gem('dmg'))).toFixed(2));
   line('Equipped fire rate',+((1+gem('rof'))/T.wshot).toFixed(2)+' shots/sec');
   line('Projectile speed',actual.pspd+' units/sec');
   line('Weapon quality',actual.premium?'Fixed legendary':live.q+'×');
   line('Super ability',base.sup);
   if(supreme){line('Super base damage',supreme.dmg);line('Unbuffed super damage',+(supreme.dmg*actual.mult).toFixed(2));
    line('Equipped super damage',+(supreme.dmg*T.wmult*T.dmgM*(1+gem('dmg'))).toFixed(2));
    line('Super wind-up',supreme.charge+' sec');}
  }
 }else if(key==='chassis'){
  const base=CH[spec.c.c],live=ecoLoadout(save,spec).c;
  const actual=chassisOf(live.c,live.t,live.q,live.s);
  if(base){
   line('Rarity',live.s?'Salvaged':['Common','Rare','Epic'][live.t]);
   line('Gear level',(live.t+1)+' / 3');
   line('Chassis class',base.n);line('Role',base.d);
   line('Actual HP multiplier',actual.hp+'×');
   line('Actual speed multiplier',actual.spd+'×');
   line('Actual turning multiplier',actual.turn+'×');
   line('Physical size',actual.size+'×');
   line('Item quality',live.q+'×');
   line('Counter advantage','Versus '+CH[COUNTER[live.c]].n);
  }
 }else if(key.startsWith('core')){
  const k=spec.cores[Number(key.slice(4))];
  if(k&&GEM[k]){const lv=save.gemLvl?.[k]||1;line('Core type',GEM[k].name);line('Core level',lv+' / '+GEM_LV.length);line('Actual bonus',pct(coreVal(k,lv)));}else line('Core slot','Empty');
 }else if(key.startsWith('fit')){
  const k=key.slice(3),v=fittingSelection(spec.mods)[k],fit=FITS[k][v];
  if(fit){line('Fitting',fit.n);line('HP change',pct(fit.hp));line('Speed change',pct(fit.spd));line('DPS change',pct(fit.dps));line('Weight cost',fit.weight+'/'+FIT_BUDGET.weight);line('Power cost',fit.power+'/'+FIT_BUDGET.power);}
 }else if(key.startsWith('look')){line('Appearance','Visual only');line('Stat impact','None');
 }else if(key==='paint'){line('Paint',PAINTS[spec.paint]?.n||spec.paint);line('Stat impact','None');}
 return '<div class="lab-facts">'+details.map(([k,v])=>'<div><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>').join('')+'</div>';
}
function labDrawSelectedItem(canvas,key,spec){
 if(!canvas)return;
 const w=canvas.clientWidth||220,h=canvas.clientHeight||120;
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.clearRect(0,0,w,h);
 if(key==='weapon'){const x=spec.w;drawGearIcon(ctx,w,h,true,getW(x.a,x.t,x.s));}
 else if(key==='chassis'){const x=spec.c;drawGearIcon(ctx,w,h,false,getC(x.c,x.t,x.s));}
 else if(key.startsWith('core')){const k=spec.cores[Number(key.slice(4))];if(k)drawGemArt(ctx,w,h,k);}
 else drawMachinePreview(ctx,w,h,{...ecoLoadout(save,spec),mods:spec.mods,looks:spec.looks});
}
function labInspect(key){
 if(!labEditor)return;
 const spec=labFormSpec(),ref=labEditor.base||labEditor.spec;
 const selector=key==='weapon'?'#lab-weapon':key==='chassis'?'#lab-chassis':key==='paint'?'#lab-paint':
 key.startsWith('core')?'#lab-core-'+key.slice(4):key.startsWith('fit')?'#lab-fit-'+key.slice(3):'#lab-look-'+key.slice(4);
 const el=$(selector);if(!el)return;
 const name=el.options[el.selectedIndex]?.textContent||'Empty';
 const category=key.startsWith('fit')?'Fitting':key.startsWith('look')?'Appearance':key.startsWith('core')?'Core':key;
 const note=key.startsWith('look')||key==='paint'?'Appearance only — no performance change.':
 key.startsWith('core')?'Core effects are included in the resulting machine stats.':
 key.startsWith('fit')?'Fitting effects and capacity are reflected below.':'This item is reflected in the resulting machine stats.';
 const itemSheet=sheet('labinspect',()=>'<canvas id="lab-item-art" class="lab-item-art" aria-label="Selected equipment preview"></canvas><h3>'+esc(category.toUpperCase())+' · '+esc(name)+'</h3><p class="mut">'+esc(note)+'</p>'+
 '<p class="mut">Live machine performance with this exact selection, compared with the saved configuration. Bars are relative within each stat, not fictional item levels.</p>'+
 labItemFacts(key,spec)+labItemBars(key,spec)+'<h4>Assembled machine performance</h4>'+labBars(spec,ref)+'<button class="btn btn-go block" data-act="labinspectclose">Back to Engineer</button>');
 itemSheet.re=null; // don't blank the rendered art when global UI becomes dirty
 setTimeout(()=>labDrawSelectedItem($('#lab-item-art'),key,spec),0);
}
ACT.labinspect=key=>labInspect(key);
ACT.labinspectclose=()=>{const ov=findOv('labinspect');if(ov)closeOverlay(ov);};
let labQuickRefreshers=[];
function labInspectButtons(){
 if(!labEditor)return;
 const pairs=[['weapon','Weapon'],['chassis','Chassis'],...[0,1,2].map(i=>['core'+i,'Core '+(i+1)]),
 ...FIT_ORDER.flatMap(k=>[['fit'+k,k.toUpperCase()+' fitting'],['look'+k,k.toUpperCase()+' appearance']]),['paint','Paint']];
 const root=$('.labform');if(!root)return;
 labQuickRefreshers=[];
 pairs.forEach(([key])=>{
  const sel=$('#lab-'+(key==='weapon'||key==='chassis'||key==='paint'?key:
   key.startsWith('core')?'core-'+key.slice(4):key.startsWith('fit')?'fit-'+key.slice(3):'look-'+key.slice(4)));
  if(!sel||sel.parentElement.querySelector('.lab-inspect-btn'))return;
  const b=document.createElement('button');b.type='button';b.className='btn btn-quiet lab-inspect-btn';
  b.dataset.act='labinspect';b.dataset.arg=key;b.textContent='View exact details';
  sel.parentElement.appendChild(b);
  const preview=document.createElement('div');preview.className='lab-item-quick';
  const refresh=()=>{
   if(!labEditor)return;
   const name=sel.options[sel.selectedIndex]?.textContent||'Empty';
   const next=labFormSpec();
   preview.innerHTML='<canvas class="lab-item-thumb" aria-hidden="true"></canvas><div class="lab-quick-data"><strong>'+esc(name)+'</strong>'+labItemBars(key,next)+'</div>';
   labDrawSelectedItem(preview.querySelector('canvas'),key,next);
  };
  sel.parentElement.appendChild(preview);
  sel.addEventListener('focus',refresh);sel.addEventListener('pointerenter',refresh);labQuickRefreshers.push(refresh);
  refresh();
 });
}
function labCards(){
 if(!save.lab)return '<p class="mut">Connect in Telegram to load your two saved machines.</p>';
 return '<h2 class="title">Your machine bays</h2><p class="mut">Two independent builds, shown side by side. Shared inventory and upgrades.</p><div class="labcards">'+Object.entries(save.lab.machines).map(([id,M])=>{
  const L=ecoLoadout(save,M.spec),T=tankOf(L,1),active=id===save.lab.active;
  return '<section class="panel labcard"><div class="lab-bay-label">BAY '+esc(String(id).toUpperCase())+'</div><b>'+esc(M.name)+'</b><canvas class="labpreview" data-art="lab:'+id+'" aria-label="Machine appearance"></canvas><span class="tag">'+(active?'Active':'Ready')+'</span><p>'+esc((L.c.s?'Salvaged ':'')+CNAMES[L.c.c][L.c.t])+' · '+esc(L.w.a==='moon'?'Moonbeam':(L.w.s?'Salvaged ':'')+WNAMES[L.w.a][L.w.t])+'</p><p class="mut">Power '+powerOf(L)+' · '+fmtNum(T.mhp)+' HP</p>'+labBars(M.spec)+'<div class="acts"><button class="btn btn-quiet" data-act="labequip" data-arg="'+id+'"'+(active?' disabled':'')+'>Equip</button><button class="btn btn-go" data-act="labedit" data-arg="'+id+'">Engineer</button><button class="btn btn-quiet block" data-act="rangecard" data-arg="'+id+'">Free Test</button></div></section>';
 }).join('')+'</div>';
}
function openLabEditor(id,draft){
 const original=save.lab&&save.lab.machines[id];if(!original)return;
 const M=draft?{...original,name:draft.name,spec:draft.spec}:original;
 labEditor={id,rev:draft?.rev||save.lab.rev,spec:JSON.parse(JSON.stringify(M.spec)),base:JSON.parse(JSON.stringify(draft?.base||M.spec))};
 const opts=(items,chosen)=>items.map(([id,n])=>'<option value="'+esc(id)+'"'+(id===chosen?' selected':'')+'>'+esc(n)+'</option>').join('');
 const key=x=>(x.a||x.c)+':'+x.t+(x.s?'s':'');
 const gear=(isW,p)=>opts(ownedList(isW).filter(x=>!x.locked).map(x=>[x.premium?'moon:2':x.id,x.name]),key(p));
 const editorSheet=sheet('labeditor',()=>'<h3>Engineer</h3><p class="mut">Edit this machine’s owned equipment. Account upgrades apply to both machines.</p><div class="labform">'+
  '<canvas id="lab-preview" class="labpreview" aria-label="Unsaved machine preview"></canvas><p id="lab-metrics" role="status"></p>'+
  '<label>Name<input id="lab-name" maxlength="48" value="'+esc(M.name)+'" autocomplete="off"></label>'+
  '<label>Weapon<select id="lab-weapon">'+gear(true,M.spec.w)+'</select></label>'+
  '<label>Chassis<select id="lab-chassis">'+gear(false,M.spec.c)+'</select></label>'+
  M.spec.cores.map((k,i)=>'<label>Core '+(i+1)+'<select id="lab-core-'+i+'">'+opts([['-','Empty'],...GORDER.map(k=>[k,GEM[k].name])],k||'-')+'</select></label>').join('')+
  FIT_ORDER.map(k=>'<label>'+k.toUpperCase()+' fitting<select id="lab-fit-'+k+'">'+opts(Object.entries(FITS[k]).map(([id,f])=>[id,fittingLabel(f)]),fittingSelection(M.spec.mods)[k])+'</select></label><label>'+k+' appearance (visual only)<select id="lab-look-'+k+'">'+opts([['auto','Follow fitting'],...Object.entries(FITS[k]).map(([id,f])=>[id,f.n])],(M.spec.looks||{})[k]||'auto')+'</select></label>').join('')+
  '<label>Paint<select id="lab-paint">'+opts(Object.keys(save.paints).filter(k=>PAINTS[k]).map(k=>[k,PAINTS[k].n]),M.spec.paint)+'</select></label></div>'+
  '<p id="lab-status" role="status" class="mut">Private configuration. Saving does not change the active slot.</p><div class="range-actions"><button class="btn btn-go block" data-act="labsave">Save machine</button><button class="btn btn-quiet block" data-act="rangedraft">Free Test draft · no rewards</button></div>');
 editorSheet.re=null; // preserve unsaved selections and injected inspection controls across UI refreshes
 setTimeout(()=>{updateLabPreview();labInspectButtons();},0);
}
ACT.labedit=id=>openLabEditor(id);
ACT.labequip=async id=>{const r=await labRequest('lab_activate',{id,rev:save.lab.rev});showToast(r.err?labMessage(r.err):'Machine equipped');};
ACT.labsave=async()=>{
 if(!labEditor||labBusy)return;
 const status=$('#lab-status'),button=$('[data-act="labsave"]');
 const spec=labFormSpec();
 status.textContent='Saving…';button.disabled=true;
 const r=await labRequest('lab_save',{id:labEditor.id,rev:labEditor.rev,name:$('#lab-name').value,spec});
 if(r.err){status.textContent=labMessage(r.err);button.disabled=false;return;}
 const ov=findOv('labeditor');if(ov)closeOverlay(ov);labEditor=null;showToast('Machine saved');
};

function fittingLabel(f){const delta=[['HP',f.hp],['speed',f.spd],['ordinary DPS',f.dps]].filter(x=>x[1]).map(([k,v])=>(v>0?'+':'')+Math.round(v*100)+'% '+k).join(', ');return f.n+(delta?' · '+delta:'')+' · W'+f.weight+'/P'+f.power;}
function labFormSpec(){
 const parse=v=>{const [k,t]=v.split(':');return {k,t:parseInt(t,10),s:t.endsWith('s')};};
 const w=parse($('#lab-weapon').value),c=parse($('#lab-chassis').value);
 return {w:{a:w.k,t:w.t,s:w.s},c:{c:c.k,t:c.t,s:c.s},cores:[0,1,2].map(i=>$('#lab-core-'+i).value).map(k=>k==='-'?null:k),paint:$('#lab-paint').value,catalog:FIT_VERSION,mods:Object.fromEntries(FIT_ORDER.map(k=>[k,$('#lab-fit-'+k).value])),looks:Object.fromEntries(FIT_ORDER.map(k=>[k,$('#lab-look-'+k).value]))};
}
function updateLabPreview(){
 if(!labEditor||!$('#lab-preview'))return;
 const p=labFormSpec(),L={...ecoLoadout(save,p),mods:p.mods,looks:p.looks},before=machineMetrics(ecoLoadout(save,labEditor.base||labEditor.spec)),after=machineMetrics(L),f=fittingStats(p.mods),err=labValidate(save,p);
 $('#lab-metrics').innerHTML=labBars(p,labEditor.base||labEditor.spec);
 $('#lab-status').textContent=err?labMessage(err):'Private draft. All fittings are free. Speed means driving; dash and supers stay unchanged.';
 $('[data-act="labsave"]').disabled=!!err;
 $('[data-act="rangedraft"]').disabled=!!err;
 const c=$('#lab-preview'),w=c.clientWidth||260,h=typeof Environment3D!=='undefined'&&Environment3D.active()?220:180;c.width=w*dpr;c.height=h*dpr;const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);drawMachinePreview(ctx,w,h,L);
}
document.addEventListener('change',e=>{if(e.target.closest('.labform')?.querySelector('#lab-weapon')){updateLabPreview();labQuickRefreshers.forEach(fn=>fn());}});
