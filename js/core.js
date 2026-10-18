'use strict';
// =====================================================================
// LUNAR: War Machines — core: Telegram, data tables, save, points, quests, squad, shop logic
// =====================================================================

// ---- Telegram Mini App bootstrap ----
const TG=(window.Telegram&&window.Telegram.WebApp)||null;
const IN_TG=!!(TG&&TG.initData&&TG.initDataUnsafe&&TG.initDataUnsafe.user);
const TG_USER=IN_TG?TG.initDataUnsafe.user:null;
const DEV_IDS=[]; // Telegram numeric user IDs allowed to use the dev panel inside Telegram
const DEV_USERNAMES=['lunarbattle']; // lowercase, no @
const IS_DEV=!IN_TG||DEV_IDS.indexOf(TG_USER&&TG_USER.id)>=0||DEV_USERNAMES.indexOf(String((TG_USER&&TG_USER.username)||'').toLowerCase())>=0;
const tgv=v=>!!(TG&&TG.isVersionAtLeast&&TG.isVersionAtLeast(v));
function tgName(u){
 if(!u)return 'Pilot';
 let n=(u.username?u.username:((u.first_name||'')+(u.last_name?' '+u.last_name:''))).trim();
 n=n.replace(/[^\w .\-]/g,'').slice(0,16);
 return n||('Pilot-'+String(u.id).slice(-4));
}
if(TG){try{
 TG.ready();TG.expand();
 if(tgv('7.7')&&TG.disableVerticalSwipes)TG.disableVerticalSwipes();
 if(tgv('6.1')){TG.setHeaderColor('#0a0e17');TG.setBackgroundColor('#0a0e17');}
 if(tgv('7.10')&&TG.setBottomBarColor)TG.setBottomBarColor('#0a0e17');
}catch(e){}}
// Telegram's back button closes whatever is on top (sheet, info card, match)
const backStack=[];
function pushBack(fn){backStack.push(fn);try{if(TG&&tgv('6.1'))TG.BackButton.show();}catch(e){}}
function popBack(run){const fn=backStack.pop();if(!backStack.length)try{TG&&TG.BackButton.hide();}catch(e){}if(run&&fn)fn();}
try{if(TG&&tgv('6.1'))TG.BackButton.onClick(()=>popBack(true));}catch(e){}

// ---- Telegram CloudStorage: progress follows the Telegram account (survives cache clears, works across devices) ----
const CLOUD_OK=IN_TG&&TG.CloudStorage&&tgv('6.9');
const CS_CHUNK=3800;
let cloudTimer=null;
function cloudSave(){
 if(!CLOUD_OK||!save)return;
 clearTimeout(cloudTimer);
 cloudTimer=setTimeout(()=>{try{
  const str=JSON.stringify(save),n=Math.ceil(str.length/CS_CHUNK);
  for(let i=0;i<n;i++)TG.CloudStorage.setItem('wm_s'+i,str.slice(i*CS_CHUNK,(i+1)*CS_CHUNK),()=>{});
  TG.CloudStorage.setItem('wm_n',String(n),()=>{});
 }catch(e){}},1500);
}
function cloudLoad(cb){
 if(!CLOUD_OK)return cb(null);
 let done=false;const fin=v=>{if(!done){done=true;cb(v);}};
 setTimeout(()=>fin(null),4000);
 try{TG.CloudStorage.getItem('wm_n',(err,nv)=>{
  const n=parseInt(nv||'0',10);if(err||!n)return fin(null);
  const keys=[];for(let i=0;i<n;i++)keys.push('wm_s'+i);
  TG.CloudStorage.getItems(keys,(e2,vals)=>{
   if(e2||!vals)return fin(null);
   try{fin(JSON.parse(keys.map(k=>vals[k]||'').join('')));}catch(e){fin(null);}
  });
 });}catch(e){fin(null);}
}

// ---- formatting ----
const fmtNum=n=>Math.round(n||0).toLocaleString('en-US');
const fmtK=n=>n>=1000000?(n/1000000)+'M':n>=1000?(n/1000)+'K':''+n;
const pct=q=>Math.round(q*100)+'%';
function msToDailyReset(){const n=new Date();return Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1)-n.getTime();}
function msToWeeklyReset(){const n=new Date();const d=(n.getUTCDay()+6)%7;return Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+(6-d)+1)-n.getTime();}
function fmtDur(ms){const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d>0?d+'d '+h+'h':h+'h '+m+'m';}
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

// ---- combat tuning ----
const STAT={hp:1700,speed:4.4,range:6,dps:70,shot:0.2,bspd:13,turn:3.4};
// mystery box buffs: each lasts until its holder takes BUFF_LIFE damage; same-stat buffs stack
const BUFF={dmg:{n:'DMG',c:'#ff6b5e',amt:0.4,txt:'+40% DAMAGE'},arm:{n:'ARM',c:'#5aa9ff',amt:0.35,txt:'+35% ARMOR'},rof:{n:'ROF',c:'#ffd24a',amt:0.4,txt:'+40% FIRE RATE'},spd:{n:'SPD',c:'#7be07b',amt:0.3,txt:'+30% SPEED'},lck:{n:'LCK',c:'#c28bff',amt:0.1,txt:'+10% CRIT CHANCE'},reg:{n:'REG',c:'#4be3a0',amt:0.003,txt:'+0.3% HP/SEC'}};
const CRIT_BASE=0.1,CRIT_MULT=2,GRAZE=0.75,DIRECT=0.4;
const SUPER_MAX=1000,SUPER_LEN=14,FILL_DEALT=1,FILL_TAKEN=0.7,FILL_CRIT=60;
const BUFF_LIFE=780;
// core gems: socketed in the garage, permanent all game. Weaker than box buffs; they multiply with them.
const GEM={dmg:{n:'DMG',name:'Damage',c:'#ff6b5e',amt:0.12},rof:{n:'ROF',name:'Fire rate',c:'#ffd24a',amt:0.10},arm:{n:'ARM',name:'Armor',c:'#5aa9ff',amt:0.08},spd:{n:'SPD',name:'Speed',c:'#7be07b',amt:0.08},lck:{n:'LCK',name:'Luck',c:'#c28bff',amt:0.03},reg:{n:'REG',name:'Repair',c:'#4be3a0',amt:0.001}};
const GORDER=['dmg','rof','arm','spd','lck','reg'];
const GEM_LV=[1,1.2,1.45,1.8,2.25]; // Lv1..5
const SHARD_NEED={1:3,2:6,3:10,4:15};   // shards to take a gem from level L to L+1
const gemMult=k=>GEM_LV[Math.min(4,Math.max(0,((save.gemLvl&&save.gemLvl[k])||1)-1))];
const coreVal=(k,lv)=>GEM[k].amt*GEM_LV[Math.min(4,Math.max(0,lv-1))];
const fmtCore=(k,v)=>'+'+(k==='reg'?(v*100).toFixed(2):(Math.round(v*1000)/10))+'%';
const UPS={
 hull:{n:'Hull',d:'+8% max health per level',c:'#5aa9ff',costs:[100,250,500,1000]},
 cannon:{n:'Cannon',d:'+8% damage per level',c:'#ff6b5e',costs:[100,250,500,1000]},
 engine:{n:'Engine',d:'+6% speed per level',c:'#7be07b',costs:[100,250,500,1000]},
 target:{n:'Targeting',d:'+2% crit chance per level',c:'#c28bff',costs:[100,250,500,1000]},
 reactor:{n:'Reactor',d:'+10% super charge per level',c:'#ffd24a',costs:[100,250,500,1000]}};
const UORDER=['hull','cannon','engine','target','reactor'];
// ---- chassis classes & weapons ----
const CH={
 scout:{n:'Scout',d:'Fast and agile',hp:0.8,spd:1.25,turn:1.15,ds:0.9,c:'#7be07b'},
 vanguard:{n:'Vanguard',d:'Balanced all-rounder',hp:1.0,spd:1.0,turn:1.0,ds:1.0,c:'#3fd0c9'},
 titan:{n:'Titan',d:'Slow, very tanky',hp:1.35,spd:0.85,turn:0.9,ds:1.12,c:'#c28bff'}};
const CHORDER=['scout','vanguard','titan'];
// counter triangle: Scout beats Titan, Titan beats Vanguard, Vanguard beats Scout (+15% damage dealt, 10% less taken)
const COUNTER={scout:'titan',titan:'vanguard',vanguard:'scout'},COUNTER_BONUS=0.15,COUNTER_RES=0.10;
const cmult=(a,d)=>{if(!a||!d||!a.cls||!d.cls)return 1;
 if(COUNTER[a.cls]===d.cls)return 1+COUNTER_BONUS;
 if(COUNTER[d.cls]===a.cls)return 1-COUNTER_RES;
 return 1;};
const beatenBy=c=>Object.keys(COUNTER).find(k=>COUNTER[k]===c);
const WEAPONS={
 pulse:{n:'Pulse Cannon',d:'Balanced gun',dps:70,shot:0.2,c:'#3fd0c9',sup:'Pierce Lance'},
 twin:{n:'Twin Repeater',d:'Fast, light hits',dps:66,shot:0.09,c:'#ffd24a',sup:'Static Nova'},
 siege:{n:'Siege Breaker',d:'Slow, heavy hits',dps:74,shot:0.45,c:'#ff6b5e',sup:'Siege Blast'},
 moon:{n:'Moonbeam',d:'Lunar precision laser',dps:72,shot:0.12,c:'#e8f4ff',sup:'Moonfall',premium:true}};
const WORDER=['pulse','twin','siege'];
const SUPER_DESC={pulse:'Pierce Lance: a rail beam that goes through cover and hits every enemy in a line.',
 twin:'Static Nova: an electric shockwave that hits every enemy near you.',
 siege:'Siege Blast: a heavy shell with a big blast radius.',
 moon:'Moonfall: a massive lunar beam, the strongest super in the game.'};
const TIER_N=['Common','Rare','Epic'],TIER_MULT=[1.0,1.10,1.32];
const RCOL=['#9fb3c8','#b78bff','#ffcf4a'];
const TIERS=['Bronze','Silver','Gold','Platinum','Diamond'],TPTS=[0,10000,50000,150000,400000],TDAILY=[25,50,100,200,400];
const TIERC=['#c08a54','#c3ccd6','#ffcf4a','#7be3e0','#c79bff'];
// 9 weapons + 9 chassis: each line has one named item per rarity, each drops only from its own rarity's crate
const WNAMES={pulse:['Pulse Cannon','Arc Pulse','Nova Pulse'],twin:['Twin Repeater','Storm Repeater','Helix Repeater'],siege:['Siege Breaker','Rail Breaker','Titanfall']};
const CNAMES={scout:['Scout','Strider','Phantom'],vanguard:['Vanguard','Sentinel','Paladin'],titan:['Titan','Bulwark','Colossus']};
const ownW=(k,t)=>!!(save.wOwn&&save.wOwn[k]&&save.wOwn[k].indexOf(t)>=0);
const ownC=(k,t)=>!!(save.cOwn&&save.cOwn[k]&&save.cOwn[k].indexOf(t)>=0);
// crate items roll 100-110% of their tier's stats; salvaged gear (points only) gets 50-75% of the real item's boost
const ROLL_MIN=1.00,ROLL_MAX=1.10,SALV_MIN=0.50,SALV_MAX=0.75,SALV_COL='#c48a5c',SALV_PTS=[0,5000,20000];
const rollOf=(k,t)=>(save.roll&&save.roll[k+':'+t])||1;
const salvOf=(k,t)=>(save.salv&&save.salv[k+':'+t])||0;
const gearMult=(k,tc,sal)=>sal?1+(TIER_MULT[tc]-1)*salvOf(k,tc):TIER_MULT[tc]*rollOf(k,tc);
function getW(arch,tt,sal){
 if(arch==='moon'){const b=WEAPONS.moon;return {id:'moon',arch:'moon',tier:2,name:b.n,dps:b.dps,shot:b.shot,pspd:26,premium:true,mult:TIER_MULT[2],q:1,sal:false};}
 if(sal===undefined)sal=tt===undefined&&!!(save.wSal&&save.wSal[arch]);
 const t=tt!==undefined?tt:((save.wTier&&save.wTier[arch])||0),tc=Math.max(0,t),mt=gearMult(arch,tc,sal),b=WEAPONS[arch]||WEAPONS.pulse;
 return {id:arch+':'+tc+(sal?'s':''),arch,tier:t,sal,q:sal?salvOf(arch,tc):rollOf(arch,tc),mult:mt,name:(sal?'Salvaged ':'')+(WNAMES[arch]||WNAMES.pulse)[tc],dps:Math.round(b.dps*mt),shot:b.shot,pspd:22+2*tc};
}
function getC(cls,tt,sal){
 if(sal===undefined)sal=tt===undefined&&!!(save.cSal&&save.cSal[cls]);
 const t=tt!==undefined?tt:((save.cTier&&save.cTier[cls])||0),tc=Math.max(0,t),mt=gearMult(cls,tc,sal),b=CH[cls]||CH.vanguard;
 return {id:cls+':'+tc+(sal?'s':''),cls,tier:t,sal,q:sal?salvOf(cls,tc):rollOf(cls,tc),mult:mt,name:(sal?'Salvaged ':'')+(CNAMES[cls]||CNAMES.vanguard)[tc],hp:Math.round(b.hp*mt*100)/100,spd:Math.round(b.spd*(1+(mt-1)*0.5)*100)/100,turn:Math.round((b.turn+0.05*tc)*100)/100,size:b.ds};
}
// after any new gear, equip the strongest version of that line (paid or salvaged)
function equipBest(isW,k){
 const own=(isW?save.wOwn:save.cOwn)[k]||[];let best=null;
 own.forEach(t=>{const m=gearMult(k,t,false);if(!best||m>best.m)best={t,s:false,m};});
 [1,2].forEach(t=>{if(salvOf(k,t)){const m=gearMult(k,t,true);if(!best||m>best.m)best={t,s:true,m};}});
 if(!best)return;
 if(isW){save.wTier[k]=best.t;save.wSal=save.wSal||{};save.wSal[k]=best.s;}
 else{save.cTier[k]=best.t;save.cSal=save.cSal||{};save.cSal[k]=best.s;}
}
const tierCol=t=>t<0?'#8a97ab':RCOL[t];
const tierName=t=>t<0?'Stock':TIER_N[t];
const gcol=it=>it.premium?'#e8f4ff':it.sal?SALV_COL:tierCol(it.tier);
const gbadge=it=>it.premium?'Legendary':it.sal?'Salvaged':tierName(it.tier);
const ownedChassisClasses=()=>CHORDER.filter(c=>(save.cOwn[c]||[]).length||salvOf(c,1)||salvOf(c,2));
function rollItem(cat,ri){
 const isW=cat==='w',keys=isW?WORDER:CHORDER;
 const cands=keys.filter(k=>!(isW?ownW(k,ri):ownC(k,ri)));
 if(!cands.length)return null;
 return {isW,k:cands[(Math.random()*cands.length)|0],tier:ri};
}
// ---- tiers (lifetime points) and leagues (gear power) ----
const tierOfPts=p=>{let t=0;for(let i=0;i<TPTS.length;i++)if((p||0)>=TPTS[i])t=i;return t;};
const tierIdx=()=>tierOfPts(save.earned||0);
const SKINS={default:{n:'Standard',c:'#3fd0c9',price:0},lunar:{n:'Lunar',c:'#e8f4ff',price:30,d:'+8% health, +8% damage'}};
const MOONBEAM_PRICE=50;
function calcPower(){
 const U=save.up,W=getW(save.weapon),Cc=getC(save.chassis);
 const skinM=save.skin==='lunar'?1.08:1;
 const hp=STAT.hp*(1+0.08*U.hull)*Cc.hp*skinM,dps=W.dps*(1+0.08*U.cannon)*skinM,spd=(1+0.06*U.engine)*Cc.spd;
 let coreM=1;for(const c of (save.cores||[]))if(c){const lv=(save.gemLvl&&save.gemLvl[c])||1;coreM*=(1+0.05*lv);}
 return Math.round(Math.pow(hp*dps*spd,1/3)*coreM*1.2);   // starter ≈ 72-100
}
// LEAGUE (by gear power): who you get matched against + point multiplier. Not the same as your TIER (lifetime points).
function powerBracket(pw){
 if(pw<150)return {n:'Rookie',key:'ROOKIE',mult:1.0,c:'#9fb0c2'};
 if(pw<250)return {n:'Pilot',key:'PILOT',mult:1.25,c:'#6fcf97'};
 if(pw<400)return {n:'Ace',key:'ACE',mult:1.5,c:'#4d9fff'};
 if(pw<600)return {n:'Elite',key:'ELITE',mult:1.75,c:'#ff9d3c'};
 return {n:'Legend',key:'LEGEND',mult:2.0,c:'#ff4d6d'};
}
function buildStats(){
 const U=save.up,W=getW(save.weapon),Cc=getC(save.chassis),skin=save.skin==='lunar'?1.08:1;
 const gb=k=>(save.cores||[]).reduce((a,g)=>a+(g===k?GEM[k].amt*gemMult(k):0),0);
 return {hp:Math.round(STAT.hp*(1+0.08*U.hull)*Cc.hp*skin),dps:Math.round(W.dps*(1+0.08*U.cannon)*(1+gb('dmg'))*(1+gb('rof'))*skin),
  spd:+(STAT.speed*(1+0.06*U.engine)*Cc.spd*(1+gb('spd'))).toFixed(1),armor:Math.round(Math.min(0.7,gb('arm'))*100),crit:Math.round((CRIT_BASE+0.02*U.target+gb('lck'))*100)};
}

// ---- save (local + Telegram cloud) ----
let save=null;
const SAVE_KEY=IN_TG?'wm_save_tg_'+TG_USER.id:'wm_save_v1';
function loadSave(obj){
 if(obj!==undefined)save=obj;else{try{save=JSON.parse(localStorage.getItem(SAVE_KEY));}catch(e){save=null;}}
 if(!save||typeof save.pts!=='number')save={pts:0,up:{hull:0,cannon:0,engine:0,target:0,reactor:0},q:{},chassis:'vanguard',weapon:'pulse',
  gemLvl:{dmg:1,rof:1,arm:1,spd:1,lck:1,reg:1},gemShards:{dmg:0,rof:0,arm:0,spd:0,lck:0,reg:0},
  wTier:{pulse:0,twin:-1,siege:-1},cTier:{scout:-1,vanguard:0,titan:-1},wOwn:{pulse:[0],twin:[],siege:[]},cOwn:{scout:[],vanguard:[0],titan:[]},fresh:true};
 if(typeof save.earned!=='number'){let sp=0;for(const k in (save.up||{}))for(let i=0;i<save.up[k];i++)sp+=(UPS[k]?UPS[k].costs[i]:0);save.earned=(save.pts||0)+sp;}
 if(!save.up)save.up={hull:0,cannon:0,engine:0,target:0,reactor:0};
 if(!save.q)save.q={};
 if(!save.gemLvl)save.gemLvl={dmg:1,rof:1,arm:1,spd:1,lck:1,reg:1};
 if(!save.gemShards)save.gemShards={dmg:0,rof:0,arm:0,spd:0,lck:0,reg:0};
 if(save.streak===undefined)save.streak=0;
 if(!save.cores)save.cores=['dmg','rof','arm','spd'];
 {const seen={};save.cores=save.cores.slice(0,4).map(k=>{if(!k||!GEM[k]||seen[k])return null;seen[k]=1;return k;});while(save.cores.length<4)save.cores.push(null);}   // one of each core type
 if(!save.wTier||!save.wOwn){save.wTier={pulse:0,twin:-1,siege:-1};save.cTier={scout:-1,vanguard:0,titan:-1};save.wOwn={pulse:[0],twin:[],siege:[]};save.cOwn={scout:[],vanguard:[0],titan:[]};}
 if(!WEAPONS[save.weapon])save.weapon='pulse';
 if(!CH[save.chassis])save.chassis='vanguard';
 if(!save.skin)save.skin='default';
 if(save.moonbeam===undefined)save.moonbeam=false;
 if(save.spendGram===undefined)save.spendGram=0;
 if(!save.payCur||save.payCur==='pts')save.payCur='stars';   // points are a separate button on each crate now
 if(save.sound===undefined)save.sound=true;
 if(save.haptics===undefined)save.haptics=true;
 if(save.mp===undefined)save.mp=(save.wins||0)+(save.losses||0);
 if(!save.mode)save.mode='1v1';if(!save.gtype)save.gtype='arena';if(!save.map)save.map='classic';
}
function store(){save._ts=Date.now();try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}cloudSave();if(typeof uiDirty==='function')uiDirty();}

// ---- points: every award flows through here so daily/weekly boards and the server stay in step ----
function dayId(d){return d.toISOString().slice(0,10);}
const dayNum=()=>Math.floor((Date.now()+(typeof srvOff==='number'?srvOff:0))/864e5);
const weekNum=()=>Math.floor((Date.now()+(typeof srvOff==='number'?srvOff:0)-4*864e5)/(7*864e5));
function rollPeriods(){
 const d=dayNum(),w=weekNum();
 if(save.dailyDay!==d){save.dailyDay=d;save.dailyPts=0;}
 if(save.weeklyNum!==w){save.weeklyNum=w;save.weeklyPts=0;}
}
const DAILY_CAP=20000;
function awardPts(n){
 if(!n||n<=0)return 0;
 rollPeriods();
 n=Math.min(Math.round(n),Math.max(0,DAILY_CAP-(save.dailyPts||0)));
 if(n<=0){showToast('Daily point cap reached. It resets at 00:00 UTC.');return 0;}
 save.pts=(save.pts||0)+n;
 save.earned=(save.earned||0)+n;
 save.dailyPts=(save.dailyPts||0)+n;
 save.weeklyPts=(save.weeklyPts||0)+n;
 store();if(typeof syncPlayer==='function')syncPlayer();
 return n;
}
// put core k in socket i; if it's already in another socket, the two swap (each core type fits once)
function socketCore(i,k){
 const c=save.cores;if(i<0||i>3)return;
 if(k===null){c[i]=null;store();return;}
 const j=c.indexOf(k);if(j===i)return;
 if(j>=0)c[j]=c[i];c[i]=k;store();
}
function buyUp(k){
 const lvl=save.up[k];
 if(lvl>=4){showToast('Already at max level');return false;}
 const cost=UPS[k].costs[lvl];
 if(save.pts<cost){showToast('Not enough points yet. Win matches to earn more.');return false;}
 save.pts-=cost;save.up[k]++;store();fx('buy');showToast(UPS[k].n+' upgraded to level '+(lvl+1));return true;
}

// ---- milestone quests (one-time) + community links ----
const WIKI_URL='https://solb7403-creator.github.io/war-machines/wiki.html';
const X_URL='';   // X/Twitter profile: fill in when it exists
const TG_URL='';  // Telegram news channel: fill in when it exists
const QUESTS=[
 {id:'q_win1',n:'First blood',d:'Win your first match',pts:50,goal:1},
 {id:'q_win3',n:'Warmonger',d:'Win 3 matches',pts:150,goal:3},
 {id:'q_dmg',n:'Heavy hitter',d:'Deal 2,500 damage in one match',pts:100,goal:2500},
 {id:'q_super',n:'Overcharged',d:'Fire your super twice in one match',pts:100,goal:2},
 {id:'q_box',n:'Scavenger',d:'Grab 3 mystery boxes in one match',pts:75,goal:3},
 {id:'q_clean',n:'Untouchable',d:'Win a match taking under 600 damage',pts:150,goal:1},
 {id:'q_wiki',n:'Read the wiki',d:'How to play, the airdrop and tokenomics',pts:200,goal:1,link:'wiki'},
 {id:'q_x',n:'Follow on X',d:'Updates and announcements',pts:50,goal:1,link:'x'},
 {id:'q_tg',n:'Join the channel',d:'Airdrop news first',pts:50,goal:1,link:'tg'}].filter(q=>!q.link||({wiki:WIKI_URL,x:X_URL,tg:TG_URL})[q.link]);
function qp(id,val,isMax){
 const Q=QUESTS.find(q=>q.id===id);if(!Q)return;
 let e=save.q[id];if(!e)e=save.q[id]={p:0,done:false,claimed:false};
 e.p=isMax?Math.max(e.p,val):e.p+val;
 if(e.p>=Q.goal)e.done=true;
}
function claimQuest(id){
 const Q=QUESTS.find(q=>q.id===id),e=save.q[id];
 if(!Q||!e||!e.done||e.claimed)return 0;
 e.claimed=true;const n=awardPts(Q.pts);if(n)fx('claim');return n;
}
function openLink(url){
 try{if(IN_TG&&/^https?:\/\/t\.me\//.test(url))TG.openTelegramLink(url);else if(IN_TG)TG.openLink(url);else window.open(url,'_blank');}catch(e){window.open(url,'_blank');}
}
function visitLinkQuest(id){
 const Q=QUESTS.find(q=>q.id===id);if(!Q)return;
 const url=({wiki:WIKI_URL,x:X_URL,tg:TG_URL})[Q.link];if(!url)return;
 openLink(url);
 let e=save.q[id];if(!e)e=save.q[id]={p:0,done:false,claimed:false};
 e.p=Q.goal;e.done=true;store();
}

// ---- daily quests: 3 a day, picked per player per day; finish all 3 for a bonus. Weekly chest for 12 dailies. ----
const DQ_POOL=[
 {id:'win3',t:'Win 3 matches',goal:3,pts:150,st:'wins'},
 {id:'play5',t:'Play 5 matches',goal:5,pts:100,st:'plays'},
 {id:'dmg6k',t:'Deal 6,000 damage',goal:6000,pts:120,st:'dmg'},
 {id:'box4',t:'Grab 4 mystery boxes',goal:4,pts:100,st:'boxes'},
 {id:'sup4',t:'Fire 4 supers',goal:4,pts:100,st:'sups'},
 {id:'kill6',t:'Destroy 6 enemy tanks',goal:6,pts:150,st:'kills'},
 {id:'zwin',t:'Win a Moon Zone match',goal:1,pts:150,st:'zoneWins'},
 {id:'twin',t:'Win a 2v2 or 3v3 match',goal:1,pts:150,st:'teamWins'},
 {id:'cap3',t:'Capture the Moon Zone 3 times',goal:3,pts:120,st:'caps'},
 {id:'ovp',t:'Play a match on Overpass',goal:1,pts:75,st:'overpass'}];
const DQ_ALL_BONUS=200,WQ_GOAL=12,WQ_PTS=1500;
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function dailyQuests(){
 const d=dayNum();
 if(!save.dq||save.dq.d!==d){
  const r=rng32(hashStr((playerKey())+':'+d)),pool=DQ_POOL.slice(),ids=[];
  while(ids.length<3){const i=(r()*pool.length)|0;ids.push(pool.splice(i,1)[0].id);}
  save.dq={d,ids,p:{},c:{},all:false};
 }
 const w=weekNum();if(!save.wq||save.wq.w!==w)save.wq={w,n:0,claimed:false};
 return save.dq.ids.map(id=>{const Q=DQ_POOL.find(q=>q.id===id);const p=save.dq.p[id]||0;return {...Q,p:Math.min(p,Q.goal),done:p>=Q.goal,claimed:!!save.dq.c[id]};});
}
function dqProgress(stats){   // called after every match with that match's stats
 dailyQuests();
 for(const id of save.dq.ids){const Q=DQ_POOL.find(q=>q.id===id);if(stats[Q.st])save.dq.p[id]=(save.dq.p[id]||0)+stats[Q.st];}
}
function claimDaily(id){
 const qs=dailyQuests(),Q=qs.find(q=>q.id===id);
 if(!Q||!Q.done||Q.claimed)return 0;
 save.dq.c[id]=true;save.wq.n=(save.wq.n||0)+1;
 let n=awardPts(Q.pts);
 if(!save.dq.all&&qs.every(q=>q.claimed||q.id===id)){save.dq.all=true;n+=awardPts(DQ_ALL_BONUS);}
 store();fx('claim');return n;
}
function claimWeekly(){
 dailyQuests();
 if(save.wq.claimed||(save.wq.n||0)<WQ_GOAL)return null;
 save.wq.claimed=true;const n=awardPts(WQ_PTS);store();fx('claim');
 return {pts:n,reveal:doOpenBox('gem',1)};
}
// ---- daily login reward: 7-day streak calendar (misses reset it) + tier bonus ----
const STREAK_PTS=[100,150,200,250,300,400,1000];
function loginState(){
 const d=dayNum(),L=save.login||{last:-9,n:0};
 const claimedToday=L.last===d,alive=L.last===d||L.last===d-1;
 const next=claimedToday?L.n:(alive?L.n+1:1);   // streak count after today's claim
 return {claimedToday,streak:alive?L.n:0,next,slot:((next-1)%7),reward:STREAK_PTS[(next-1)%7]+TDAILY[tierIdx()]};
}
function claimLogin(){
 const s=loginState();if(s.claimedToday)return null;
 save.login={last:dayNum(),n:s.next};
 const n=awardPts(s.reward);let reveal=null;
 if(s.slot===6)reveal=doOpenBox('gem',0);   // day 7: free gem cache too
 store();fx('claim');return {pts:n,reveal,day:s.slot+1};
}

// ---- squad (referrals): you get paid when your recruits keep playing ----
const BOT_PLAY='https://t.me/LunarWarMachinesBot/play';
const REF_MS=[{days:2,pts:1500,r:500,n:'Comes back the next day'},{days:5,pts:5000,r:2000,n:'5 days active, 5K points'},{days:10,pts:20000,r:5000,n:'10 days active, 20K points'}];
const REF_PCT=0.05,REF_WELCOME=1000,REF_PCT_CAP=2000;   // 5% of recruits' points, max 2,000/day from the % part
const playerKey=()=>IN_TG?'tg_'+TG_USER.id:'local';
const refLink=()=>BOT_PLAY+'?startapp=ref_'+(TG_USER?TG_USER.id:'0');
function captureRef(){   // the start_param of the link that opened the game
 try{
  const sp=IN_TG&&TG.initDataUnsafe&&TG.initDataUnsafe.start_param;
  if(!sp||!/^ref_\d{3,15}$/.test(sp)||save.refBy)return;
  const rid='tg_'+sp.slice(4);
  if(rid===playerKey()||(save.earned||0)>5000)return;   // can't recruit yourself or an existing player
  save.refBy=rid;store();
 }catch(e){}
}
const squad=()=>(typeof squadCache!=='undefined'&&squadCache)||[];
function refStatus(r){const ago=r.ld==null?99:dayNum()-r.ld;return ago<=1?['Active','#5fe3a1']:ago<=6?['Idle '+ago+'d','#ffcf4a']:['Inactive','#ff6b5e'];}
function refOwed(r){   // milestones reached + 5% of what they've earned since you last claimed
 const c=(save.refC||{})[r.id]||{m:0,seen:0};let m=c.m,ms=0;
 while(m<REF_MS.length&&r.days>=REF_MS[m].days&&r.pts>=REF_MS[m].pts){ms+=REF_MS[m].r;m++;}
 const pc=Math.max(0,Math.floor((r.pts-(c.seen||0))*REF_PCT));
 return {ms,pct:pc,m,tot:ms+pc};
}
const welcomeReady=()=>!!(save.refBy&&!save.refWelcome&&typeof srv!=='undefined'&&srv&&srv.ref===save.refBy&&(srv.days||0)>=2);
const pctRoom=()=>{const d=dayNum();return save.refPD&&save.refPD.d===d?Math.max(0,REF_PCT_CAP-save.refPD.a):REF_PCT_CAP;};
function refPending(){let t=welcomeReady()?REF_WELCOME:0,pr=pctRoom();for(const r of squad()){const o=refOwed(r);const pp=Math.min(o.pct,pr);pr-=pp;t+=o.ms+pp;}return t;}
function claimRefs(){
 rollPeriods();let room=Math.max(0,DAILY_CAP-(save.dailyPts||0)),got=0;
 save.refC=save.refC||{};
 if(welcomeReady()&&room>=REF_WELCOME){save.refWelcome=true;got+=REF_WELCOME;room-=REF_WELCOME;}
 let pr=pctRoom(),pgot=0;
 for(const r of squad()){const o=refOwed(r),pp=Math.min(o.pct,pr),t=o.ms+pp;if(!t)continue;if(t>room)break;
  const c=save.refC[r.id]||{m:0,seen:0};save.refC[r.id]={m:o.m,seen:(c.seen||0)+Math.round(pp/REF_PCT)};   // unpaid % carries over to tomorrow
  got+=t;room-=t;pr-=pp;pgot+=pp;}
 if(pgot){const d=dayNum();save.refPD={d,a:(save.refPD&&save.refPD.d===d?save.refPD.a:0)+pgot};}
 if(!got){showToast(refPending()?'Daily cap reached. Claim the rest tomorrow.':'Nothing to claim yet. Rewards arrive as your squad plays.');return 0;}
 const n=awardPts(got);fx('claim');showToast('+'+fmtNum(n)+' squad points');return n;
}
const SHARE_TXT='Join my squad in LUNAR: War Machines. Fast robot-tank battles right in Telegram, and the top 1,000 pilots get a guaranteed $LUNAR allocation.';
function shareRef(text){
 const u='https://t.me/share/url?url='+encodeURIComponent(refLink())+'&text='+encodeURIComponent(text||SHARE_TXT);
 try{if(IN_TG)TG.openTelegramLink(u);else window.open(u,'_blank');}catch(e){copyRef();}
}
function copyRef(){try{navigator.clipboard.writeText(refLink()).then(()=>showToast('Invite link copied'),()=>showToast(refLink()));}catch(e){showToast(refLink());}}

// ---- shop logic: crates, salvage, premium, starter pack ----
const RPRICE=[4,8,23],RSTARS=[250,500,1500],RPTS=[20000,80000,0];
const STARTER={ton:6,stars:399};
const PSTARS={moonbeam:3300,skin:2000,starter:STARTER.stars}; // premium items in Stars (must match the server)
function buyKey(tk,ri){return tk==='gem'?'gem'+ri+'|'+dayNum():tk+ri;}
// gear crates: x1, x2, x3 (only 3 items each). Gem caches: +25% per buy that day, resets daily
function boxMult(tk,ri){const n=(save.buys&&save.buys[buyKey(tk,ri)])||0;return tk==='gem'?1+0.25*n:Math.min(3,1+n);}
function boxPrice(tk,ri){return Math.round(RPRICE[ri]*boxMult(tk,ri)*100)/100;}   // TON
function boxStars(tk,ri){return Math.round(RSTARS[ri]*boxMult(tk,ri));}
function boxPts(tk,ri){return RPTS[ri]||0;} // points price is flat
function crateFound(tk,ri){if(tk==='gem')return 0;const ks=tk==='weapon'?WORDER:CHORDER;return ks.filter(k=>tk==='weapon'?ownW(k,ri):ownC(k,ri)).length;}
function openBoxWithPoints(tk,ri){
 const c=boxPts(tk,ri);
 if(!c){showToast('Epic crates are paid only');return null;}
 if((save.pts||0)<c){showToast('You need '+fmtNum(c-(save.pts||0))+' more points');return null;}
 save.pts-=c;save.buys=save.buys||{};const bk=buyKey(tk,ri);save.buys[bk]=(save.buys[bk]||0)+1;
 save.ptsSpent=(save.ptsSpent||0)+c;store();return doOpenBox(tk,ri);
}
// opens a crate and returns what came out (the UI shows it)
function doOpenBox(tk,ri){
 if(tk==='gem'){
  const k=GORDER[(Math.random()*GORDER.length)|0];
  const n=ri===0?1+((Math.random()*2)|0):ri===1?3+((Math.random()*2)|0):6+((Math.random()*4)|0);
  save.gemShards[k]+=n;
  let lv=save.gemLvl[k],up=0;
  while(lv<5&&save.gemShards[k]>=SHARD_NEED[lv]){save.gemShards[k]-=SHARD_NEED[lv];lv++;up++;}
  save.gemLvl[k]=lv;store();
  return {tk,ri,rar:ri,color:GEM[k].c,gem:k,title:'+'+n+' '+GEM[k].name+(n===1?' shard':' shards'),
   sub:up>0?GEM[k].name+' core reached level '+lv+'!':GEM[k].name+' core: level '+lv+(lv<5?' ('+save.gemShards[k]+'/'+SHARD_NEED[lv]+' shards to next)':' (max)')};
 }
 const isW=tk==='weapon';
 const roll=Math.round((ROLL_MIN+Math.random()*(ROLL_MAX-ROLL_MIN))*100)/100;
 save.roll=save.roll||{};
 const it=rollItem(isW?'w':'c',ri);
 if(it){
  const own=isW?save.wOwn:save.cOwn;
  if(!own[it.k])own[it.k]=[];own[it.k].push(it.tier);
  save.roll[it.k+':'+it.tier]=roll;
  equipBest(isW,it.k);
  store();
  const nm=isW?WNAMES[it.k][it.tier]:CNAMES[it.k][it.tier];
  const w0=getW(it.k,it.tier,false),c0=getC(it.k,it.tier,false);
  return {tk,ri,rar:it.tier,color:RCOL[it.tier],item:{isW,k:it.k,tier:it.tier},title:'New '+TIER_N[it.tier]+': '+nm,
   sub:'Roll '+pct(roll)+(isW?', '+w0.dps+' damage per second':', '+c0.hp+'× health, '+c0.spd+'× speed')};
 }
 // collection complete: re-roll a random item of this rarity, keep the better roll
 const keys=isW?WORDER:CHORDER;
 const k=keys[(Math.random()*3)|0],key=k+':'+ri,old=rollOf(k,ri),nm=isW?WNAMES[k][ri]:CNAMES[k][ri];
 if(roll>old){save.roll[key]=roll;equipBest(isW,k);store();
  return {tk,ri,rar:ri,color:RCOL[ri],item:{isW,k,tier:ri},title:'Roll upgraded!',sub:nm+': '+pct(old)+' → '+pct(roll)};}
 const pts=ri===0?50:ri===1?150:400;awardPts(pts);
 return {tk,ri,rar:ri,color:RCOL[ri],item:{isW,k,tier:ri},title:'Rolled '+pct(roll),sub:'You kept your '+pct(old)+' '+nm+' and got +'+pts+' points'};
}
function buySalvage(tk,ri){
 const c=SALV_PTS[ri],isW=tk==='weapon';
 if((save.pts||0)<c){showToast('You need '+fmtNum(c-(save.pts||0))+' more points');return null;}
 const keys=isW?WORDER:CHORDER;
 const k=keys[(Math.random()*3)|0],key=k+':'+ri,old=salvOf(k,ri);
 const q=Math.round((SALV_MIN+Math.random()*(SALV_MAX-SALV_MIN))*100)/100;
 save.pts-=c;save.ptsSpent=(save.ptsSpent||0)+c;save.salv=save.salv||{};
 const nm='Salvaged '+(isW?WNAMES[k][ri]:CNAMES[k][ri]);
 if(q>old){save.salv[key]=q;equipBest(isW,k);store();
  return {tk,ri,rar:ri,color:SALV_COL,item:{isW,k,tier:ri,sal:true},title:nm,sub:(old?pct(old)+' → ':'')+pct(q)+' of the real boost'};}
 store();return {tk,ri,rar:ri,color:SALV_COL,item:{isW,k,tier:ri,sal:true},title:'Rolled '+pct(q),sub:'You kept your '+pct(old)+' '+nm};
}
// Grant a verified purchase. Single path for live purchases and for purchases finished while the game was closed.
function grantPurchase(desc){
 if(!desc)return;
 let reveals=[];
 if(desc.kind==='box'){
  const cost=desc.price||RPRICE[desc.ri]||0;
  save.buys=save.buys||{};const bk=buyKey(desc.tk,desc.ri);save.buys[bk]=(save.buys[bk]||0)+1;
  save.spendGram=(save.spendGram||0)+cost;reveals.push(doOpenBox(desc.tk,desc.ri));
 }else if(desc.kind==='starter'){
  if(!save.starter){save.starter=true;save.spendGram=(save.spendGram||0)+STARTER.ton;
   reveals.push(doOpenBox('weapon',1),doOpenBox('chassis',1),doOpenBox('gem',1));}
 }else if(desc.kind==='moonbeam'){
  if(!save.moonbeam){save.moonbeam=true;save.weapon='moon';save.spendGram=(save.spendGram||0)+MOONBEAM_PRICE;
   reveals.push({tk:'moonbeam',rar:2,color:'#e8f4ff',title:'Moonbeam unlocked',sub:'Equipped. Its super is Moonfall.'});}
 }else if(desc.kind==='skin'){
  if(save.skin!=='lunar'){save.skin='lunar';save.spendGram=(save.spendGram||0)+SKINS.lunar.price;
   reveals.push({tk:'skin',rar:2,color:'#e8f4ff',title:'Lunar skin unlocked',sub:'+8% health and +8% damage, applied.'});}
 }
 save.pendingTx=null;store();
 if(typeof syncPlayer==='function')syncPlayer();
 fx('buy');
 if(reveals.length&&typeof showReveal==='function')showReveal(reveals);
}
function rng32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
