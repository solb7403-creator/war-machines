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
 royale:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="M4.2 17.2 3 7.6l5 3.9 4-6 4 6 5-3.9-1.2 9.6z"/><path d="M4.5 20.5h15"/></svg>'};
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
 stale.add(t);renderUI();
}

// ---------- top bar + tab badges ----------
function questsAlert(){
 if(!loginState().claimedToday)return true;
 if(passReady())return true;
 if(dailyQuests().some(q=>q.done&&!q.claimed))return true;
 if(!save.wq.claimed&&(save.wq.n||0)>=WQ_GOAL)return true;
 if(QUESTS.some(q=>{const e=save.q[q.id];return e&&e.done&&!e.claimed;}))return true;
 return refPending()>0;
}
const nextUp=()=>UORDER.map(k=>({k,lv:save.up[k],c:save.up[k]<4?UPS[k].costs[save.up[k]]:Infinity})).sort((a,b)=>a.c-b.c)[0];
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
 const sb=Math.min((save.streak||0)+1,5)*20;
 if(gk==='random'){const v=GT_ORDER.map(g=>winPoints(g,mk)+sb);return [Math.min(...v),Math.max(...v)];}
 const v=winPoints(gk,mk)+sb;return [v,v];
}
const shortNum=n=>n<10000?fmtNum(n):fmtK(Math.round(n/100)*100);
const rangeTxt=r=>r[0]===r[1]?'+'+fmtNum(r[0]):'+'+fmtNum(r[0])+' to +'+fmtNum(r[1]);
const pct1=q=>(Math.round(q*1000)/10)+'%';
const modeName=(gk,mk)=>GT_PICK[gk].label+(isSolo(gk)?'':' '+mk);
const daysLeft=()=>Math.max(1,Math.ceil(seasonEndMs()/864e5));

// ---------- PLAY ----------
function playNudge(){
 const L=loginState();
 if(!L.claimedToday)return {gem:'★',b:'Daily reward ready',s:'+'+fmtNum(L.reward)+' points, day '+(L.slot+1)+' of 7',act:'login'};
 const dq=dailyQuests().find(q=>q.done&&!q.claimed);
 if(dq)return {gem:'✓',b:'Quest complete',s:dq.t+': +'+dq.pts+' points',act:'tab',arg:'quests'};
 const pr=passReady();
 if(pr)return {gem:String(passTier()),b:'Lunar Pass reward ready',s:pr+(pr===1?' reward':' rewards')+' to claim',act:'pass'};
 const fm=featuredMode();
 if(gtypeKey()!==fm&&save.featSeen!==dayNum()&&(save.mp||0)>=2)return {svg:ICON[fm],b:'Featured today: '+GTYPES[fm].label,s:'+25% points and +10 pass XP a match. Tap to switch.',act:'feat'};
 const u=nextUp();
 if(u.c<=(save.pts||0))return {gem:'+',b:'Upgrade ready',s:UPS[u.k].n+' to level '+(u.lv+1)+' for '+fmtNum(u.c)+' points',act:'up',arg:u.k};
 if(IN_TG&&(save.mp||0)>=3&&squad().length<3)return {gem:'↗',b:'Invite friends',s:'Up to 7,500 points for each friend who keeps playing',act:'share'};
 return null;
}
const GT_DESC={arena:'Destroy the enemy team',zone:'Hold the zone, first to 100',crystal:'Hold 10 crystals for 15s',bounty:'Kills earn stars',royale:'6 tanks, 1 survivor',random:'A different mode each match'};
function setupPickers(){
 const gk=gtypeKey(),mk=modeKey(),mp=mapKey(),fm=featuredMode(),solo=isSolo(gk);
 return sec('Game type','','gtypes')+
  '<div class="modes">'+GT_ORDER.concat('random').map(k=>'<button class="mode'+(gk===k?' on':'')+'" data-act="gtype" data-arg="'+k+'">'+(k===fm?'<span class="feat">+25% today</span>':'')+ICON[k]+'<b>'+GT_PICK[k].label+'</b><small>'+GT_DESC[k]+'</small></button>').join('')+'</div>'+
  sec('Team size',solo?'':MODES[mk].n>1?'AI pilots fill your team':'','modes')+
  (solo?'<div class="seg"><button class="on solo" disabled>Solo<small>You and 5 AI pilots, free for all. 1st place pays '+fmtNum(winRange(gk,mk)[0])+'</small></button></div>'
   :'<div class="seg c3">'+Object.keys(MODES).map(k=>{const r=winRange(gk,k);return '<button class="'+(mk===k?'on':'')+'" data-act="mode" data-arg="'+k+'">'+k+'<small>win '+(r[0]===r[1]?fmtNum(r[0]):fmtNum(r[0])+'–'+fmtNum(r[1]))+'</small></button>';}).join('')+'</div>')+
  sec('Map')+
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
  '<button class="setup" data-act="setup"><canvas data-art="map:'+mp+'"></canvas><span class="grow"><span class="nm">'+modeName(gk,mk)+(gk===featuredMode()?' <span class="featchip">+25%</span>':'')+'</span><span class="mut">'+(mp==='random'?'Random map':esc(MAPS[mp].n))+'</span><span class="dimtxt">'+(gk==='arena'&&mk==='1v1'?'Best of 3 rounds, first to 2':GT_DESC[gk])+'</span></span><span class="chg">Change</span></button>'+
  '<button class="fight" data-act="fight"><span class="big">FIGHT</span><span class="small">Win '+rangeTxt(wr)+' points</span></button>'+
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
 const upRow=k=>{const U=UPS[k],lv=save.up[k],max=lv>=4,c=max?0:U.costs[lv],ok=!max&&(save.pts||0)>=c;
  return '<div class="up"><div class="grow"><div class="nm">'+U.n+' <span class="dimtxt">level '+lv+' of 4</span></div><div class="d">'+U.d+'</div><div class="bar4">'+[0,1,2,3].map(i=>'<i class="'+(i<lv?'f':'')+'"></i>').join('')+'</div></div>'+
   (max?'<span class="mut">Maxed</span>':'<button class="btn sm '+(ok?'btn-gold':'btn-quiet')+'" data-act="up" data-arg="'+k+'">'+coin()+fmtNum(c)+'</button>')+'</div>';};
 return '<div class="powerline"><div class="grow"><div class="pw num">Power '+pw+'</div><div class="mut"><span style="color:'+brk.c+'">'+brk.n+' league</span>, points ×'+brk.mult+'</div></div><button class="info" data-act="info" data-arg="league" aria-label="About leagues">?</button></div>'+
  '<div class="stats">'+stat(fmtNum(st.hp),'Health')+stat(st.dps,'Damage/s')+stat(st.spd,'Speed')+stat(st.armor+'%','Armor')+stat(st.crit+'%','Crit')+'</div>'+
  sec('Gear')+gearRow(true,W0)+gearRow(false,C0)+
  '<button class="gear" data-act="paints"><div class="ico"><canvas data-art="tank:paint:'+esc(save.paint)+'"></canvas></div><div class="grow"><div class="kind">Paint</div><div class="nm">'+esc(myPaint().n)+'</div><div class="meta">Looks only. '+Object.keys(save.paints||{}).length+' of '+PAINT_ORDER.length+' owned</div></div><span class="chev">›</span></button>'+
  sec('Cores','Each type fits once','cores')+'<div class="cores">'+[0,1,2].map(coreCard).join('')+'</div>'+
  sec('Upgrades','Permanent')+'<div class="ups list">'+UORDER.map(upRow).join('')+'</div>'+
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
function renderShop(){
 const cur=save.payCur;
 const crate=(tk,ri)=>{const f=crateFound(tk,ri);
  return '<button class="crate" data-act="crate" data-arg="'+tk+':'+ri+'"><div class="r" style="color:'+RCOL[ri]+'">'+TIER_N[ri]+'</div><canvas data-art="crate:'+tk+':'+ri+'"></canvas>'+
   '<div class="p">'+priceLabel(boxPrice(tk,ri),boxStars(tk,ri))+'</div><div class="f">'+(tk==='gem'?(boxMult(tk,ri)>1?'+'+Math.round((boxMult(tk,ri)-1)*100)+'% today':'Core shards'):(f>=3?'All 3 found':'Found '+f+' of 3'))+'</div></button>';};
 const prem=(id,nm,d,ton,stars,owned)=>'<button class="premium" data-act="premium" data-arg="'+id+'"'+(owned?' disabled':'')+'><canvas data-art="'+(id==='moonbeam'?'gear:w:moon:2:0':'tank:lunar')+'"></canvas><b>'+nm+'</b><span>'+d+'</span><div class="p">'+(owned?'Owned':priceLabel(ton,stars))+'</div></button>';
 const salv=(tk,ri)=>'<div class="up"><div class="grow"><div class="nm">Salvaged '+TIER_N[ri].toLowerCase()+' '+(tk==='weapon'?'weapon':'chassis')+'</div><div class="d">A random '+TIER_N[ri].toLowerCase()+' '+(tk==='weapon'?'weapon':'chassis')+' at '+pct1(SALV_MIN[ri])+' to '+pct1(SALV_MAX[ri])+' power. Crate gear starts at 105%.</div></div><button class="btn sm '+((save.pts||0)>=SALV_PTS[ri]?'btn-gold':'btn-quiet')+'" data-act="salvage" data-arg="'+tk+':'+ri+'">'+coin()+fmtK(SALV_PTS[ri])+'</button></div>';
 const pend=save.pendingSol||save.pendingTx;
 return '<h2 class="title" data-act="devtap">Shop</h2>'+
  '<div class="seg c3">'+[['stars','Stars'],['ton','TON'],['sol','SOL']].map(([k,l])=>'<button class="'+(cur===k?'on':'')+'" data-act="paycur" data-arg="'+k+'">'+l+'</button>').join('')+'</div>'+
  '<div class="paybar"><span class="mut">'+payNote()+'</span>'+(cur==='ton'?'<button class="btn sm btn-quiet" data-act="tonwallet">'+(tonWallet?'Disconnect':'Connect')+'</button>':cur==='sol'?'<button class="btn sm btn-quiet" data-act="solwallet">Change wallet</button>':'')+'</div>'+
  (save.starter?'':'<div class="starter"><span class="tag">One time</span><h4>Starter pack</h4><ul><li>A rare weapon you don’t own yet</li><li>A rare chassis you don’t own yet</li><li>A rare gem cache</li></ul><button class="btn btn-go block" data-act="starter">'+priceLabel(STARTER.ton,STARTER.stars)+'</button></div>')+
  (passState().prem?'':'<div class="passbuy"><span class="tag">Season '+seasonNo()+'</span><h4>Lunar Pass</h4><p>30 premium rewards over '+PASS_LEN+' days: Eclipse and Aurora paints, 2 rare weapon caches, a rare and an epic chassis crate, 24 gem caches. '+daysLeft()+(daysLeft()===1?' day':' days')+' left.</p>'+
   '<div class="acts"><button class="btn btn-go" data-act="buypass">'+priceLabel(PASS_PRICE.ton,PASS_PRICE.stars)+'</button><button class="btn btn-quiet" data-act="pass">See rewards</button></div></div>')+
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
 const how=on?'Equipped':own?'Owned':P.pass==='free'?'Pass tier 30':P.pass==='prem'?'Pass premium':priceLabel(P.ton,P.stars);
 return '<button class="paint'+(on?' on':'')+(own?' own':'')+'" data-act="paint" data-arg="'+id+'"><canvas data-art="tank:paint:'+id+'"></canvas><b>'+esc(P.n)+'</b><span class="p">'+how+'</span></button>';
}

// ---------- LUNAR PASS ----------
function passCard(){
 const P=passState(),t=passTier(),xpIn=P.xp-t*PASS_XP,ready=passReady(),done=t>=PASS_TIERS;
 return '<button class="passcard" data-act="pass"><div class="row"><div class="grow"><div class="pt">Lunar Pass'+(P.prem?' <span class="rar" style="background:var(--gold)">Premium</span>':'')+'</div><div class="mut">Season '+seasonNo()+', tier '+t+' of '+PASS_TIERS+', '+daysLeft()+(daysLeft()===1?' day':' days')+' left</div></div>'+
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
  let rows='';for(let i=1;i<=PASS_TIERS;i++)rows+='<div class="ptier'+(i<=t?' on':'')+(i===t+1?' next':'')+'"><div class="pn num">'+i+'</div>'+cell(PASS_FREE[i],'f',i,P.cf.includes(i),false)+cell(PASS_PREM[i],'p',i,P.cp.includes(i),!P.prem)+'</div>';
  return '<h3>Lunar Pass</h3><p class="mut">Season '+seasonNo()+' ends in '+daysLeft()+(daysLeft()===1?' day':' days')+'. XP per match: win +'+PASS_XP_WIN+', draw +'+PASS_XP_DRAW+', loss +'+PASS_XP_LOSS+', featured mode +'+PASS_XP_FEAT+'. Each daily quest +'+PASS_XP_QUEST+', all 3 +'+PASS_XP_ALL+'.</p>'+
   '<div class="pxp"><b class="num">Tier '+t+'</b><div class="bar"><i style="width:'+(t>=PASS_TIERS?100:Math.round(xpIn/PASS_XP*100))+'%"></i></div><span class="num">'+(t>=PASS_TIERS?'Done':xpIn+' / '+PASS_XP+' XP')+'</span></div>'+
   (P.prem?'<p class="passown">Premium unlocked for this season</p>':'<button class="btn btn-go block" style="margin-top:12px" data-act="buypass">Unlock premium for '+priceLabel(PASS_PRICE.ton,PASS_PRICE.stars)+'</button><p class="dimtxt" style="margin-top:6px">Premium never gives points, so it can’t buy leaderboard rank. Rewards you’ve already reached unlock right away.</p>')+
   '<div class="phead"><span></span><span>Free</span><span>Premium</span></div><div class="ptiers">'+rows+'</div>';
 });
 if(passTier()>=5)setTimeout(()=>{const el=$('.ptier.next',ov.box)||$('.ptier.on:last-child',ov.box);if(el)try{el.scrollIntoView({block:'center'});}catch(e){}},80);   // early on, the header matters more
}

// ---------- QUESTS ----------
function renderQuests(){
 const L=loginState(),dq=dailyQuests(),wq=save.wq,t=tierIdx();
 const cal=STREAK_PTS.map((p,i)=>{
  const got=i<L.slot||(L.claimedToday&&i===L.slot),today=!L.claimedToday&&i===L.slot;
  return '<div class="day'+(got?' got':'')+(today?' today':'')+(i===6?' big':'')+'"><small>Day '+(i+1)+'</small><b>'+(got?'✓':shortNum(p+TDAILY[t]))+'</b></div>';}).join('');
 const qRow=(q,act,sub)=>{const f=Math.min(1,q.p/q.goal);
  return '<div class="q'+(q.claimed?' done':'')+'"><div class="grow"><div class="t">'+esc(q.t)+'</div><div class="bar"><i style="width:'+Math.round(f*100)+'%"></i></div><div class="p">'+(sub||fmtNum(q.p)+' / '+fmtNum(q.goal))+'</div></div>'+
   (q.claimed?'<span class="mut">Claimed</span>':'<button class="btn sm '+(q.done?'btn-gold':'btn-quiet')+'" data-act="'+act+'" data-arg="'+q.id+'">+'+q.pts+'</button>')+'</div>';};
 const allDone=save.dq&&save.dq.all;
 const sq=squad(),active=sq.filter(r=>refStatus(r)[0]==='Active').length,pend=refPending();
 const recruits=sq.slice().sort((a,b)=>b.pts-a.pts).slice(0,5).map(r=>{const st=refStatus(r),o=refOwed(r),nx=REF_MS[o.m];
  return '<div class="q"><div class="grow"><div class="t">'+esc(r.n)+' <span class="dimtxt" style="color:'+st[1]+'">'+st[0]+'</span></div><div class="p">Day '+r.days+', '+fmtNum(r.pts)+' points'+(nx?'. Next: '+nx.n.toLowerCase():'')+'</div></div>'+(o.tot?'<span class="num" style="color:var(--gold)">+'+fmtNum(o.tot)+'</span>':'')+'</div>';}).join('');
 const ms=QUESTS.map(Q=>{const e=save.q[Q.id]||{p:0,done:false,claimed:false};
  if(Q.link&&!e.done)return '<div class="q"><div class="grow"><div class="t">'+Q.n+'</div><div class="p">'+Q.d+'</div></div><button class="btn sm btn-quiet" data-act="visit" data-arg="'+Q.id+'">Open</button></div>';
  const p=Math.min(e.p||0,Q.goal);
  return qRow({id:Q.id,t:Q.n,goal:Q.goal,p,done:e.done,claimed:e.claimed,pts:Q.pts},'claimq',Q.d+(Q.goal>1&&!e.done?' ('+fmtNum(p)+' / '+fmtNum(Q.goal)+')':''));}).join('');
 return passCard()+sec('Daily reward','Streak: '+L.streak+(L.streak===1?' day':' days'))+
  '<div class="cal">'+cal+'</div>'+
  (L.claimedToday?'<button class="btn btn-quiet block off">Next reward in '+fmtDur(msToDailyReset())+'</button>':'<button class="btn btn-gold block" data-act="login">Claim day '+(L.slot+1)+': +'+fmtNum(L.reward)+' points'+(L.slot===6?' and a gem cache':'')+'</button>')+
  '<p class="dimtxt" style="margin-top:6px">Missing a day restarts the streak. Higher tiers add +'+TDAILY[t]+' a day.</p>'+
  sec('Today’s quests','New in '+fmtDur(msToDailyReset()))+
  '<div class="panel list">'+dq.map(q=>qRow(q,'claimdq')).join('')+'<div class="q'+(allDone?' done':'')+'"><div class="grow"><div class="t">Finish all 3</div><div class="p">Bonus on top of each quest</div></div><span class="num" style="color:'+(allDone?'var(--dust)':'var(--gold)')+'">'+(allDone?'Claimed':'+'+DQ_ALL_BONUS)+'</span></div></div>'+
  sec('Weekly chest','Resets in '+fmtDur(msToWeeklyReset()))+
  '<div class="panel"><div class="q"><div class="grow"><div class="t">Claim '+WQ_GOAL+' daily quests this week</div><div class="bar"><i style="width:'+Math.round(Math.min(1,(wq.n||0)/WQ_GOAL)*100)+'%;background:var(--gold)"></i></div><div class="p">'+Math.min(wq.n||0,WQ_GOAL)+' / '+WQ_GOAL+'. Chest: '+fmtNum(WQ_PTS)+' points and a rare gem cache</div></div>'+
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
 const metric=p=>lbScope==='daily'?(p.dailyPts||0):lbScope==='weekly'?(p.weeklyPts||0):(p.pts||0);
 let rows='',pin='';
 if(lbCache){
  const all=lbCache.map(p=>p.id===me?Object.assign({},p,{pts:Math.max(p.pts,e),dailyPts:Math.max(p.dailyPts||0,save.dailyPts||0),weeklyPts:Math.max(p.weeklyPts||0,save.weeklyPts||0)}):p);
  if(IN_TG&&!all.some(p=>p.id===me))all.push({id:me,n:tgName(TG_USER),pts:e,dailyPts:save.dailyPts||0,weeklyPts:save.weeklyPts||0});   // you show up before the next 5-minute refresh
  const list=all.filter(p=>metric(p)>0).sort((a,b)=>metric(b)-metric(a));
  const shown=list.slice(0,100);let meShown=false;
  rows=shown.map((p,i)=>{const isMe=p.id===me;if(isMe)meShown=true;const ti=tierOfPts(p.pts);
   return '<div class="r'+(isMe?' me':'')+'"><span class="rk'+(i<3?' t3':'')+'">#'+(i+1)+'</span><div class="grow"><div class="nm">'+esc(p.n)+(isMe?' (you)':'')+'</div><div class="tr" style="color:'+TIERC[ti]+'">'+TIERS[ti]+'</div></div><span class="sc">'+fmtNum(metric(p))+'</span></div>';}).join('');
  if(!rows)rows='<p class="mut" style="padding:14px 0">'+(lbScope==='overall'?'No pilots on the board yet. Win a match to be first.':'No points yet '+(lbScope==='daily'?'today':'this week')+'. Win a match to take #1.')+'</p>';
  else if(list.length>100)rows+='<p class="dimtxt" style="padding:8px 0">Showing the top 100 of '+fmtNum(lbMeta.n||list.length)+'</p>';
  if(!meShown&&IN_TG){const mine=lbScope==='daily'?(save.dailyPts||0):lbScope==='weekly'?(save.weeklyPts||0):e,above=list.filter(p=>p.id!==me&&metric(p)>mine).length;
   pin='<div class="lb"><div class="r me mepin"><span class="rk">'+(R&&R.outside&&lbScope==='overall'?'1000+':'#'+(above+1))+'</span><div class="grow"><div class="nm">You</div><div class="tr" style="color:'+TIERC[t]+'">'+TIERS[t]+'</div></div><span class="sc">'+fmtNum(mine)+'</span></div></div>';}
 }else rows='<p class="mut" style="padding:14px 0">Loading…</p>';
 return '<div class="panel tierbox"><div class="row"><i class="tierdia" style="background:'+TIERC[t]+'"></i><div class="grow"><div class="tn" style="color:'+TIERC[t]+'">'+TIERS[t]+'</div><div class="mut">'+fmtNum(e)+' lifetime points. '+nextTxt+'.</div></div><button class="info" data-act="info" data-arg="tiers" aria-label="About tiers">?</button></div>'+
  '<div class="ladder">'+TIERS.map(rung).join('')+'</div></div>'+
  cut+
  '<button class="linkbtn" data-act="info" data-arg="airdrop">How the airdrop works</button>'+
  '<div class="seg c3" style="margin-top:14px">'+[['overall','All time'],['daily','Today'],['weekly','This week']].map(([k,l])=>'<button class="'+(lbScope===k?'on':'')+'" data-act="lbscope" data-arg="'+k+'">'+l+'</button>').join('')+'</div>'+
  '<div class="lb list">'+rows+'</div>'+pin+
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
   if(a[0]==='hero'){heroCv=c;drawHeroScene(ctx,w,h,performance.now()/1000);}
   else if(a[0]==='map')drawMapThumb(ctx,w,h,a[1]);
   else if(a[0]==='crate'){const cw=Math.min(w*0.78,h*1.3),ch=cw*0.74;drawCrateArt(ctx,(w-cw)/2,(h-ch)/2,cw,ch,a[1],+a[2]);}
   else if(a[0]==='gear'){const isW=a[1]==='w',k=a[2];
    const it=k==='moon'?getW('moon'):a[3]===undefined?(isW?getW(save.weapon):getC(save.chassis)):(isW?getW(k,+a[3],a[4]==='1'):getC(k,+a[3],a[4]==='1'));
    if(c.dataset.locked)ctx.globalAlpha=0.45;drawGearIcon(ctx,w,h,isW,it);ctx.globalAlpha=1;}
   else if(a[0]==='gem')drawGemArt(ctx,w,h,a[1]);
   else if(a[0]==='unit')drawUnitArt(ctx,w,h,units[+a[1]]);
   else if(a[0]==='tank'){const r=Math.min(w,h)*0.22;drawTankPx(ctx,w/2,h/2,r,-Math.PI/2+0.35,-Math.PI/2+0.1,a[1]==='lunar'?'#e8f4ff':TC[0],null,'pulse',null,3,a[1]==='paint'?PAINTS[a[2]]:a[1]==='me'?myPaint():null);}
  }catch(e){}
 }
}
let heroLast=0;
function tickHero(now){   // the hero tank idles at ~30fps while the Play tab is open
 if(uiTab!=='play'||!heroCv||!heroCv.isConnected||inBattle()||document.hidden||now-heroLast<33)return;
 heroLast=now;const w=heroCv.clientWidth,h=heroCv.clientHeight;if(!w)return;
 const ctx=heroCv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);drawHeroScene(ctx,w,h,now/1000);
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
 if(scrim&&!opt.sticky)scrim.addEventListener('click',()=>ov.close());
 if(!opt.noBack){ov.back=()=>closeOverlay(ov,true);pushBack(ov.back);}
 overlays.push(ov);
 requestAnimationFrame(()=>{if(scrim)scrim.classList.add('show');box.classList.add('show');paintArt(box);});
 return ov;
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
  ['Win','Every mode has its own goal: Arena, Moon Zone, Crystal Rush, Bounty and Last Standing. The start screen tells you what it is.'],
  ['Mystery boxes','Drive over the gold box for a random boost. It lasts until you take enough damage; the ring around your tank shows what’s left.'],
  ['Super','The thin bar under your health fills as you fight. When it’s full, tap the red Super button to auto-aim, or drag from it to aim yourself.'],
  ['Dash','The blue Dash button bursts you forward in the direction you’re driving. Use it to dodge supers. It recharges in 4 seconds.'],
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
  ['Featured mode','One mode a day pays +25% points and +'+PASS_XP_FEAT+' pass XP. It changes at 00:00 UTC.'],
  ['Random','Picks any mode when the match starts.']]],
 modes:()=>['Team size',[
  ['Points per match','Before your league multiplier:'],
  ...Object.keys(MODES).map(k=>{const M=MODES[k];return [k,'Win '+M.win+', draw '+M.draw+', loss '+M.loss+'.'];}),
  ['Win streaks','Each win in a row adds 20 more points, up to +100.'],
  ['Teammates','In 2v2 and 3v3, AI pilots fight on your side.']]],
 league:()=>['Leagues',[
  ['Your league','Comes from your tank’s power: gear, upgrades and cores. Higher leagues pay more points per match.'],
  ['Multipliers','Rookie ×1 (under 150 power), Pilot ×1.25 (150+), Ace ×1.5 (250+), Elite ×1.75 (400+), Legend ×2 (600+).'],
  ['Leagues vs tiers','Your tier (Bronze to Diamond) comes from lifetime points and shows on the leaderboard. Your league comes from gear.']]],
 cores:()=>['Cores',[
  ['What they do','Cores are permanent boosts. You have 3 sockets and each core type fits once.'],
  ['Leveling','Gem caches in the Shop give shards. Enough shards level a core up, to level 5.'],
  ['Stacking','Cores add on top of mystery-box boosts of the same type.']]],
 crates:()=>['Crates',[
  ['Gear','Each rarity has 3 weapons and 3 chassis. A crate always gives one you don’t own yet, so Rare and Epic crates cost ×1, then ×2, then ×3 as you collect them. Common crates are always 250 Stars.'],
  ['Rolls','Every crate item rolls 105 to 110% of its rarity’s stats, any value equally likely. Rare is 10% stronger than Common, Epic 32%. So power runs 105–110% (Common), 115.5–121% (Rare), 138.6–145.2% (Epic).'],
  ['Odds','Each item you don’t own yet is equally likely. Gem caches pick one of the 6 core types, 1 in 6 each.'],
  ['Tune-up','In the Garage, pay points to re-roll a crate item: 3,000 for Common, 10,000 for Rare, 30,000 for Epic. You keep the better roll.'],
  ['Collection done','Once you own all 3, a crate re-rolls one of them. You keep the better roll, or get points back.'],
  ['Gem caches','Common gives 1 to 2 shards, Rare 3 to 4, Epic 6 to 9, for a random core. Rare and Epic caches rise 25% with each buy that day and reset at 00:00 UTC. Common stays 250 Stars.'],
  ['Salvage','Paid with points: Salvaged Rare 5,000 (101 to 103% power), Salvaged Epic 10,000 (103.1 to 104.4%). Every crate item beats every salvaged item.']]],
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
  const what=isGem?['1 to 2','3 to 4','6 to 9'][ri]+' shards for a random core. Price rises 25% with each buy today and resets at 00:00 UTC.'
   :found>=3?'You own all 3. Opening re-rolls one: you keep the better roll, or get '+[50,150,400][ri]+' points.'
   :'One '+TIER_N[ri].toLowerCase()+' '+(tk==='weapon'?'weapon':'chassis')+' you don’t own yet, rolled at 105 to 110%. It’s equipped if it beats your current one.';
  const odds=isGem?'Odds: each of the 6 core types is 1 in 6, and every shard count in the range is equally likely.':found>=3?'Odds: each of the 3 items is 1 in 3. Every roll from 105 to 110% is equally likely.':'Odds: each item you don’t own yet is 1 in '+(3-found)+'. Every roll from 105 to 110% is equally likely.';
  return '<div class="row"><canvas class="crateart" data-art="crate:'+tk+':'+ri+'"></canvas><div class="grow"><h3>'+crateName(tk,ri)+'</h3><p class="mut">'+what+'</p></div></div>'+items+
   '<button class="btn btn-go block" style="margin-top:14px" data-act="buybox" data-arg="'+tk+':'+ri+'">Buy for '+priceLabel(boxPrice(tk,ri),boxStars(tk,ri))+'</button>'+
   (pts?'<button class="btn btn-quiet block" style="margin-top:8px" data-act="buypts" data-arg="'+tk+':'+ri+'">Use '+fmtNum(pts)+' points <span class="dimtxt">(you have '+fmtNum(save.pts)+')</span></button>':'<p class="dimtxt" style="margin-top:8px">Epic crates can’t be bought with points.</p>')+
   '<p class="dimtxt odds">'+odds+'</p>'+
   (ri===0?'<p class="dimtxt" style="margin-top:8px">Common crates are always this price.</p>':!isGem?'<p class="dimtxt" style="margin-top:8px">Each purchase of this crate raises its price: ×1, then ×2, then ×3. Now ×'+boxMult(tk,ri)+'.</p>':'');
 });
}
function openPaints(){
 sheet('paints',()=>'<h3>Paints</h3><p class="mut">Paints change how your tank looks, never its stats. Your team color stays on the tracks and core, so allies and foes are always easy to tell apart.</p><div class="paints" style="margin-top:12px">'+PAINT_ORDER.map(paintCard).join('')+'</div>');
}
function openSolWallets(){
 sheet('solw',()=>'<h3>Pay SOL from</h3><div style="margin-top:10px">'+SOL_ORDER.map(k=>'<button class="gear'+((save.solWallet||'phantom')===k?' equipped':'')+'" data-act="setsolw" data-arg="'+k+'"><div class="grow"><div class="nm">'+SOL_WALLETS[k].n+'</div><div class="meta">'+(SOL_WALLETS[k].ul?'Opens the wallet app to approve':'Shows the address and exact amount to send')+'</div></div></button>').join('')+'</div>');
}

// ---------- settings + admin ----------
function openSettings(){
 sheet('settings',()=>'<h3>Settings</h3>'+
  '<div class="list" style="margin-top:8px">'+
  '<div class="q"><div class="grow"><div class="t">Sound</div><div class="p">Follows your phone’s silent switch</div></div><button class="toggle'+(save.sound!==false?' on':'')+'" data-act="sound" aria-pressed="'+(save.sound!==false)+'"><i></i></button></div>'+
  '<div class="q"><div class="grow"><div class="t">Vibration</div><div class="p">Buzz on hits, kills and rewards</div></div><button class="toggle'+(save.haptics?' on':'')+'" data-act="haptics" aria-pressed="'+(save.haptics?'true':'false')+'"><i></i></button></div>'+
  '<div class="q"><div class="grow"><div class="t">Daily reminder</div><div class="p">One message when your reward is ready</div></div><button class="toggle'+(save.remind?' on':'')+'" data-act="remind" aria-pressed="'+(!!save.remind)+'"><i></i></button></div>'+
  '<button class="q" data-act="info" data-arg="howto"><div class="grow"><div class="t">How to play</div></div><span class="chev">›</span></button>'+
  '<button class="q" data-act="wiki"><div class="grow"><div class="t">Wiki and tokenomics</div></div><span class="chev">›</span></button>'+
  '<button class="q" data-act="terms"><div class="grow"><div class="t">Terms and purchase help</div><div class="p">Refunds and payment problems: send /paysupport to the bot</div></div><span class="chev">›</span></button>'+
  '<button class="q" data-act="copyid"><div class="grow"><div class="t">Player ID</div><div class="p">'+esc(playerKey())+(IN_TG?', '+esc(tgName(TG_USER)):'')+'</div></div><span class="mut">Copy</span></button>'+
  '</div><p class="dimtxt" style="margin-top:12px">Build '+esc(window.BUILD||'dev')+'</p>');
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
   '<p class="mut" style="margin-top:8px">This device: power '+pw+', '+fmtNum(save.earned)+' lifetime points, '+(save.mp||0)+' matches</p>'+
   '<h3 style="margin-top:16px;font-size:16px">Test grants (this device only)</h3>'+
   '<div class="acts" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><button class="btn sm btn-quiet" data-act="dev" data-arg="pts">+50K points</button><button class="btn sm btn-quiet" data-act="dev" data-arg="epic">All epic gear</button><button class="btn sm btn-quiet" data-act="dev" data-arg="moon">Moonbeam</button><button class="btn sm btn-quiet" data-act="dev" data-arg="skin">Lunar skin</button><button class="btn sm btn-quiet" data-act="dev" data-arg="passxp">+2,000 pass XP</button><button class="btn sm btn-quiet" data-act="dev" data-arg="pass">Premium pass</button></div>';
 });
}

// ---------- crate reveal ----------
let revealQ=[],revealOv=null;
function showReveal(list){revealQ.push(...(list||[]).filter(Boolean));if(!revealOv)nextReveal();}
function itemArt(r){
 if(r.gem)return 'gem:'+r.gem;
 if(r.tk==='moonbeam')return 'gear:w:moon:2:0';
 if(r.tk==='skin')return 'tank:lunar';
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
 const card=u=>{const i=units.indexOf(u);return '<div class="unit'+(u.isPlayer?' me':'')+'"><canvas data-art="unit:'+i+'"></canvas><b>'+esc(u.isPlayer?'You':u.name)+'</b><span style="color:'+CH[u.cls].c+'">'+CH[u.cls].n+'</span></div>';};
 let cls='',txt='';
 if(adv&&!dis){cls='good';txt='Your '+CH[me.cls].n+' counters their '+CH[COUNTER[me.cls]].n+': +15% damage, 10% less taken.';}
 else if(dis&&!adv){cls='bad';const b=beatenBy(me.cls),fix=beatenBy(b);txt='Their '+CH[b].n+' counters your '+CH[me.cls].n+'.'+(ownedChassisClasses().includes(fix)?' Switch to '+CH[fix].n+' to beat it.':' '+CH[fix].n+' beats it.');}
 else if(adv&&dis){txt='Mixed matchup: you counter some, some counter you.';}
 else txt='Even matchup. No counters either way.';
 const owned=ownedChassisClasses();
 return '<div class="head"><b>'+modeName(matchG,modeKey())+(isSeriesMode()?', best of 3':'')+'</b><span>'+MAPS[curMap].n+(matchG===featuredMode()?', featured +25%':'')+'</span><br><span class="aitag">AI opponents</span></div>'+
  '<div class="team'+(solo?' many':'')+'">'+foes.map(card).join('')+'</div><div class="mark">'+(solo?'FREE FOR ALL':'VS')+'</div><div class="team">'+mine.map(card).join('')+'</div>'+
  '<p class="mut vsgoal">'+esc(GTYPES[matchG].d)+'</p>'+
  '<div class="match '+cls+'">'+txt+(owned.length>1?'<div class="swap">'+owned.map(c=>'<button class="btn sm '+(c===me.cls?'btn-quiet on':'btn-ghost')+'" data-act="swapcls" data-arg="'+c+'">'+CH[c].n+'</button>').join('')+'</div>':'')+'</div>'+
  '<div class="grow"></div><button class="fight" data-act="vsstart"><span class="big">START</span><span class="small" id="vsCount"></span></button>'+
  '<button class="linkbtn" data-act="vsback">Back to menu</button>';
}
function showVS(){
 let n=4;
 const ov=openOverlay('full',vsBuild(),{cls:'vs',key:'vs',build:vsBuild,onClose:fromBack=>{clearInterval(vsTimer);vsTimer=null;if(state==='vs')state='menu';}});
 const tick=()=>{const el=$('#vsCount');if(el)el.textContent=vsTimer?'Starts in '+n:'Tap to start';};
 clearInterval(vsTimer);vsTimer=setInterval(()=>{n--;if(n<=0){vsGo();return;}tick();},1000);tick();
 ov.re=()=>{ov.box.innerHTML=vsBuild();paintArt(ov.box);tick();};
}
function vsGo(){clearInterval(vsTimer);vsTimer=null;const ov=findOv('vs');if(ov){ov.onClose=null;closeOverlay(ov);}if(state==='vs')startMatch();}
function beginMatch(){
 if(state==='play')return;
 closeAll();prepareMatch();
 if((save.mp||0)===0){startMatch();return;}   // the first match goes straight in, with coaching
 showVS();
}

// ---------- results ----------
const TIPS=['Mystery boxes boost you until you take enough damage. Grab them early.','Supers are strongest when enemies line up. Pierce Lance goes through cover.',
 'Crystal Rush: if you carry a lot, fall back. Every crystal drops when you go down.','Bounty: a 7-star tank is worth more than three 2-star kills.','Last Standing: let others fight, then clean up. Wrecks drop boxes.',
 'Upgrades in the Garage are permanent and cheap at first.','Moon Zone pays ×3 in 1v1.','Back off to repair in Moon Zone: 3.5 seconds out of fire and you start healing.',
 'Daily quests and the login streak add up fast. Check Quests every day.','Friends you invite pay you when they keep playing.'];
const ORD=['1st','2nd','3rd','4th','5th','6th'];
function resultsHTML(r){
 const M=MODES[r.mode],solo=isSolo(r.gtype),G=GTYPES[r.gtype];
 const title=r.won?'Victory':solo&&r.place<=3?ORD[r.place-1]+' place':r.drawn?'Draw':'Defeat',cls=r.won?'win':r.drawn||(solo&&r.place<=3)?'draw':'lose';
 const lines=solo?[[ORD[r.place-1]+' of '+units.length,fmtNum(r.base)]]:[[(r.won?'Win':r.drawn?'Draw':'Loss')+' in '+r.mode,fmtNum(r.won?M.win:r.drawn?M.draw:M.loss)]];
 if(r.series)lines.push(['Best of 3 ('+r.series.w[0]+' to '+r.series.w[1]+')','×'+r.modeX]);
 else if(r.modeX!==1)lines.push([G.label,'×'+r.modeX]);
 if(r.featured)lines.push(['Featured mode','×'+r.featX]);
 if(r.leagueMult!==1)lines.push([r.league.n+' league','×'+r.leagueMult]);
 if(r.streakBonus)lines.push(['Win streak: '+r.streak,'+'+r.streakBonus]);
 if(r.capped)lines.push(['Daily cap (20,000) reached','−'+fmtNum(r.pts-r.awarded)]);
 const t=tierOfPts(r.after),lo=TPTS[t],hi=TPTS[t+1],f=hi?(r.after-lo)/(hi-lo):1;
 const rb=lbCache?myRank(r.before):null,ra=lbCache?myRank(r.after):null;
 let rank='';
 if(ra&&!ra.outside&&lbMeta&&lbMeta.inTop)rank=rb&&!rb.outside&&rb.rank!==ra.rank?'Rank #'+fmtNum(rb.rank)+' → #'+fmtNum(ra.rank):'Rank #'+fmtNum(ra.rank);
 else if(ra&&ra.outside)rank=fmtNum(Math.max(1,lbMeta.cut-r.after+1))+' points to the top 1,000';
 let tip;
 if((save.mp||0)===1)tip=r.won?'Nice first win. Points rank you on the leaderboard and buy upgrades in the Garage.':'Close one. Drag to dodge shots while your cannon fires, and grab the gold box.';
 else if(r.countered){const b=beatenBy(r.meCls),fix=beatenBy(b);tip='Their '+CH[b].n+' countered your '+CH[r.meCls].n+'. '+CH[fix].n+' beats '+CH[b].n+(ownedChassisClasses().includes(fix)?': switch on the next start screen.':'. Find one in a chassis crate.');}
 else if(r.quests.length)tip='Quest done: '+r.quests.join(', ')+'. Claim it in Quests.';
 else tip=TIPS[(save.mp||0)%TIPS.length];
 const st=r.stats;
 return (r.won?'<div class="confetti">'+Array.from({length:28},(_,i)=>'<i style="left:'+Math.min(96,i*3.5+Math.random()*2)+'%;background:'+['#ffcf4a','#5fe3a1','#4d9fff','#ff7a2f','#dfe7f2'][i%5]+';animation-duration:'+(1.6+Math.random()*1.4)+'s;animation-delay:'+(Math.random()*0.5)+'s"></i>').join('')+'</div>':'')+
  '<div class="grow"></div><div class="title '+cls+'">'+title+'</div>'+
  '<div class="sub">'+(r.gtype==='zone'?'Moon Zone '+r.mode+', '+r.score[0]+' to '+r.score[1]:r.gtype==='crystal'?'Crystal Rush '+r.mode+', '+r.score[0]+' to '+r.score[1]+' crystals':r.gtype==='bounty'?'Bounty '+r.mode+', '+r.score[0]+' to '+r.score[1]+' stars':solo?'Last Standing, '+ORD[r.place-1]+' of '+units.length:r.series?'Arena 1v1, rounds '+r.series.w[0]+' to '+r.series.w[1]:'Arena '+r.mode)+' on '+esc(MAPS[r.map].n)+'</div>'+
  '<div class="gain num">+'+fmtNum(r.awarded)+'<small>points</small></div>'+
  '<div class="lines">'+lines.map(([a,b])=>'<div class="line"><span>'+a+'</span><b>'+b+'</b></div>').join('')+'</div>'+
  '<div class="chips">'+(r.gtype==='crystal'?'<span class="chip"><b>'+(st.cry||0)+'</b>'+(st.cry===1?'crystal':'crystals')+'</span>':'')+(r.gtype==='bounty'?'<span class="chip"><b>'+(st.stars||0)+'</b>stars</span>':'')+'<span class="chip"><b>'+fmtNum(st.dmg)+'</b>damage</span><span class="chip"><b>'+st.kills+'</b>'+(st.kills===1?'kill':'kills')+'</span><span class="chip"><b>'+st.boxes+'</b>'+(st.boxes===1?'box':'boxes')+'</span><span class="chip"><b>'+st.sups+'</b>'+(st.sups===1?'super':'supers')+'</span></div>'+
  '<div class="progress"><div class="row"><span style="color:'+TIERC[t]+';font:600 15px var(--disp)">'+TIERS[t]+'</span><span class="grow"></span><span class="mut">'+(hi?fmtNum(hi-r.after)+' to '+TIERS[t+1]:'Top tier')+'</span></div><div class="track"><i id="resBar" style="width:'+Math.round(Math.max(0,(r.before-lo)/((hi||r.after)-lo||1))*100)+'%;background:'+TIERC[t]+'" data-to="'+Math.round(f*100)+'"></i></div>'+(rank?'<div class="mut" style="margin-top:8px">'+rank+'</div>':'')+'</div>'+
  '<div class="tip">'+esc(tip)+'</div>'+
  '<div class="grow"></div><div class="acts"><button class="fight" data-act="again"><span class="big">PLAY AGAIN</span><span class="small">Win '+rangeTxt(winRange(gtypeKey(),modeKey()))+' points</span></button>'+
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
  '<button class="btn btn-go block" style="margin-top:14px" data-act="nextround">Start round '+info.round+'<span id="rCount" class="dimtxt" style="color:inherit;opacity:.7"></span></button>';
}
function onRoundEnd(info){
 if(state!=='round'||!inBattle())return;
 let n=4;
 const ov=openOverlay('modal',roundHTML(info),{key:'round',sticky:true,noBack:true,cls:'rm'});
 const tick=()=>{const el=$('#rCount',ov.box);if(el)el.textContent=roundTimer?' in '+n:'';};
 ov.re=()=>{ov.box.innerHTML=roundHTML(info);tick();};
 clearInterval(roundTimer);roundTimer=setInterval(()=>{n--;if(n<=0){goRound();return;}tick();},1000);tick();
}
function goRound(){clearInterval(roundTimer);roundTimer=null;const ov=findOv('round');if(ov){ov.onClose=null;closeOverlay(ov);}startRound();}
function onRoundStart(){clearInterval(roundTimer);roundTimer=null;const ov=findOv('round');if(ov){ov.onClose=null;closeOverlay(ov);}}

// ---------- match start / leave ----------
let leaveFn=null,paused=false;
function onMatchStart(){
 closeAll();
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
 state='menu';paused=false;
 save.streak=0;save.losses=(save.losses||0)+1;save.mp=(save.mp||0)+1;store();
 exitBattle();
}
function exitBattle(){
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
 openOverlay('modal','<h3>Before your first purchase</h3><p class="mut">You’re buying in-game items for LUNAR: War Machines. They have no cash value and can’t be traded or cashed out. Purchases don’t buy $LUNAR and aren’t an investment. For refunds or payment problems, send /paysupport to the bot.</p>'+
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
 points:()=>showInfo('points'),
 gtype:a=>{save.gtype=a;store();fx('tap');},
 feat:()=>{save.gtype=featuredMode();save.featSeen=dayNum();store();fx('tap');showToast(GTYPES[save.gtype].label+' selected: +25% today');},
 pass:()=>openPass(),
 claimpass:a=>{const [tr,i]=a.split(':'),r=claimPass(tr,+i);if(!r)return;if(r.pts)showToast('+'+fmtNum(r.pts)+' points');if(r.reveal)showReveal([r.reveal]);},
 buypass:()=>{if(passState().prem)return;pay(PASS_PRICE.ton,{kind:'pass'});},
 paints:()=>openPaints(),
 paint:a=>{const P=PAINTS[a];if(!P)return;
  if(save.paints&&save.paints[a]){save.paint=a;store();fx('tap');showToast(P.n+' paint on');return;}
  if(P.pass){openPass();return;}
  pay(P.ton,{kind:'paint',id:a});},
 tune:a=>{const [sl,k,t]=a.split('|'),r=tuneItem(sl==='w',k,+t);if(!r)return;showToast(r.better?'New roll '+pct(r.roll)+', up from '+pct(r.old):'Rolled '+pct(r.roll)+'. You kept '+pct(r.old));syncPlayer();},
 terms:()=>openLink(TERMS_URL),
 termsok:()=>{save.termsOk=Date.now();store();const go=termsGo;termsGo=null;const ov=findOv('terms');if(ov)closeOverlay(ov);if(go)go();},
 termsno:()=>{const ov=findOv('terms');if(ov)closeOverlay(ov);},
 mode:a=>{save.mode=a;store();fx('tap');},
 map:a=>{save.map=a;store();fx('tap');},
 fight:()=>beginMatch(),
 setup:()=>openSetup(),
 setupdone:()=>{const ov=findOv('setup');if(ov)closeOverlay(ov);},
 firstfight:()=>{save.welcomed=true;store();closeAll();beginMatch();},
 vsstart:()=>vsGo(),
 vsback:()=>{const ov=findOv('vs');if(ov)closeOverlay(ov);},
 swapcls:a=>{clearInterval(vsTimer);vsTimer=null;switchChassis(a);fx('tap');const ov=findOv('vs');if(ov)ov.re();},
 again:()=>{closeAll();exitBattle();beginMatch();},
 menu:()=>{exitBattle();setTab('play');},
 sharewin:()=>{const r=lastResult;shareRef('I just won '+(isSolo(r.gtype)?'Last Standing':'a '+GTYPES[r.gtype].label+' '+r.mode)+' in LUNAR: War Machines (+'+fmtNum(r.awarded)+' points). The top 1,000 pilots get $LUNAR at launch. Join my squad:');},
 login:()=>{const r=loginState();if(r.claimedToday)return;const c=claimLogin();if(!c)return;showToast('+'+fmtNum(c.pts)+' points, day '+c.day+' of your streak');if(c.reveal)showReveal([c.reveal]);else if(IN_TG&&!save.remindAsked&&!save.remind)askReminder();},
 claimdq:a=>{const n=claimDaily(a);if(n)showToast('+'+fmtNum(n)+' points');else{const q=dailyQuests().find(x=>x.id===a);if(q&&!q.done)showToast(q.t+': '+fmtNum(q.p)+' of '+fmtNum(q.goal));}},
 claimq:a=>{const Q=QUESTS.find(q=>q.id===a),e=save.q[a];if(!e||!e.done){showToast(Q?Q.d:'Not done yet');return;}const n=claimQuest(a);if(n)showToast('+'+n+' points: '+Q.n);},
 visit:a=>{visitLinkQuest(a);uiDirty('quests');},
 weekly:()=>{const r=claimWeekly();if(!r){showToast('Claim '+(WQ_GOAL-(save.wq.n||0))+' more daily quests to open it');return;}showToast('+'+fmtNum(r.pts)+' points');showReveal([r.reveal]);},
 share:()=>shareRef(),copy:()=>copyRef(),claimref:()=>{claimRefs();uiDirty('quests');},
 up:a=>{const lv=save.up[a];if(lv<4&&(save.pts||0)<UPS[a].costs[lv]){showToast('You need '+fmtNum(UPS[a].costs[lv]-(save.pts||0))+' more points');return;}if(buyUp(a))syncPlayer();},
 gear:a=>openGearPicker(a==='w'),
 equip:a=>{const [s,id]=a.split('|'),isW=s==='w',[k,ts]=id.split(':'),t=ts===undefined?0:parseInt(ts,10),sl=!!ts&&ts.slice(-1)==='s';
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
 buybox:a=>{const [tk,ri]=a.split(':'),p=boxPrice(tk,+ri);pay(p,{kind:'box',tk,ri:+ri,price:p});},
 buypts:a=>{const [tk,ri]=a.split(':'),r=openBoxWithPoints(tk,+ri);if(r){const ov=findOv('crate');if(ov)closeOverlay(ov);fx('buy');showReveal([r]);}},
 salvage:a=>{const [tk,ri]=a.split(':'),r=buySalvage(tk,+ri);if(r){fx('buy');showReveal([r]);}},
 starter:()=>{if(save.starter)return;pay(STARTER.ton,{kind:'starter'});},
 premium:a=>{if(a==='moonbeam'){if(save.moonbeam)return;pay(MOONBEAM_PRICE,{kind:'moonbeam'});}else{if(save.skin==='lunar')return;pay(SKINS.lunar.price,{kind:'skin'});}},
 revealok:()=>{if(revealOv)closeOverlay(revealOv);},
 lbscope:a=>{lbScope=a;fx('tap');uiDirty('ranks');},
 wiki:()=>openLink(WIKI_URL),
 haptics:()=>{save.haptics=!save.haptics;store();if(save.haptics)fx('tap');},
 sound:()=>{save.sound=save.sound===false;store();if(save.sound){audioResume();setTimeout(()=>fx('tap'),60);}},
 remind:()=>setReminders(!save.remind),
 remindyes:()=>{const ov=findOv('remind');if(ov)closeOverlay(ov);setReminders(true);},
 remindno:()=>{save.remindAsked=true;store();const ov=findOv('remind');if(ov)closeOverlay(ov);},
 copyid:()=>{try{navigator.clipboard.writeText(playerKey()).then(()=>showToast('Player ID copied'),()=>showToast(playerKey()));}catch(e){showToast(playerKey());}},
 devtap:()=>{if(!IS_DEV)return;const now=performance.now();if(now-devTapT>4000)devTapN=0;devTapT=now;if(++devTapN>=5){devTapN=0;openAdmin();}},
 dev:a=>{if(!IS_DEV)return;
  if(a==='pts'){save.pts=(save.pts||0)+50000;}
  if(a==='epic'){save.cTier={scout:2,vanguard:2,titan:2};save.cOwn={scout:[0,1,2],vanguard:[0,1,2],titan:[0,1,2]};save.wTier={pulse:2,twin:2,siege:2};save.wOwn={pulse:[0,1,2],twin:[0,1,2],siege:[0,1,2]};}
  if(a==='moon'){save.moonbeam=true;}
  if(a==='skin'){save.skin='lunar';}
  if(a==='passxp'){passXP(2000);}
  if(a==='pass'){passState().prem=true;}
  store();showToast('Granted on this device (test)');},
 leavecancel:()=>{const ov=findOv('leave');if(ov)closeOverlay(ov);},
 leaveok:()=>forfeit(),
 rswap:a=>{clearInterval(roundTimer);roundTimer=null;switchChassis(a);fx('tap');},
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
