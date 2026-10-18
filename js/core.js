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

// ---- combat rules, gear math and paints live in rules.js (shared with the PvP server) ----
const SHARD_NEED={1:3,2:6,3:10,4:15};   // shards to take a gem from level L to L+1
const gemMult=k=>gemLvMult(save.gemLvl&&save.gemLvl[k]);
const fmtCore=(k,v)=>'+'+(k==='reg'?(v*100).toFixed(2):(Math.round(v*1000)/10))+'%';
const SUPER_DESC={pulse:'Pierce Lance: a rail beam that goes through cover and hits every enemy in a line.',
 twin:'Static Nova: an electric shockwave that hits every enemy near you.',
 siege:'Siege Blast: a heavy shell with a big blast radius.',
 moon:'Moonfall: a massive lunar beam, the strongest super in the game.'};
const TIER_N=['Common','Rare','Epic'];
const RCOL=['#9fb3c8','#b78bff','#ffcf4a'];
const TIERS=['Bronze','Silver','Gold','Platinum','Diamond'],TPTS=[0,10000,50000,150000,400000],TDAILY=[25,50,100,200,400];
const TIERC=['#c08a54','#c3ccd6','#ffcf4a','#7be3e0','#c79bff'];
// 9 weapons + 9 chassis: each line has one named item per rarity, each drops only from its own rarity's crate
const WNAMES={pulse:['Pulse Cannon','Arc Pulse','Nova Pulse'],twin:['Twin Repeater','Storm Repeater','Helix Repeater'],siege:['Siege Breaker','Rail Breaker','Titanfall']};
const CNAMES={scout:['Scout','Strider','Phantom'],vanguard:['Vanguard','Sentinel','Paladin'],titan:['Titan','Bulwark','Colossus']};
const ownW=(k,t)=>!!(save.wOwn&&save.wOwn[k]&&save.wOwn[k].indexOf(t)>=0);
const ownC=(k,t)=>!!(save.cOwn&&save.cOwn[k]&&save.cOwn[k].indexOf(t)>=0);
// Power ladder (stat multiplier vs stock gear). Every crate item beats every salvaged item:
//   stock starter gear 1.00 | Salvaged Rare 1.010-1.030 | Salvaged Epic 1.031-1.044
//   Common crate 1.050-1.100 | Rare crate 1.155-1.210 | Epic crate 1.386-1.452
// Crate items roll 105-110% of their rarity; salvage stores its own multiplier.
const SALV_COL='#c48a5c',SALV_PTS=[0,10000,20000];
const rollOf=(k,t)=>(save.roll&&save.roll[k+':'+t])||1;
const salvOf=(k,t)=>{const v=save.salv&&save.salv[k+':'+t];return v?(v<1?SALV_MIN[t]||1.01:v):0;};   // old saves stored a fraction
const gearMult=(k,tc,sal)=>sal?salvOf(k,tc):TIER_MULT[tc]*rollOf(k,tc);
// Tune-up: pay points to re-roll an owned crate item (105-110%), you keep the better roll
const TUNE_PTS=[3000,10000,30000];
const canTune=(isW,k,t)=>(isW?ownW(k,t):ownC(k,t))&&!!(save.roll&&save.roll[k+':'+t]);   // crate items only: starter gear has no roll to tune
function tuneItem(isW,k,t){
 if(!canTune(isW,k,t)){showToast('Only crate gear can be tuned');return null;}
 const old=rollOf(k,t),c=TUNE_PTS[t];
 if(old>=ROLL_MAX-0.0001){showToast('Already at the best roll (110%)');return null;}
 if((save.pts||0)<c){showToast('You need '+fmtNum(c-(save.pts||0))+' more points');return null;}
 save.pts-=c;save.ptsSpent=(save.ptsSpent||0)+c;save.roll=save.roll||{};
 const roll=Math.round((ROLL_MIN+Math.random()*(ROLL_MAX-ROLL_MIN))*100)/100,better=roll>old;
 if(better){save.roll[k+':'+t]=roll;equipBest(isW,k);}
 store();if(typeof fx==='function')fx(better?'claim':'tap');
 return {better,old,roll};
}
function getW(arch,tt,sal){
 if(arch==='moon')return Object.assign(weaponOf('moon'),{id:'moon',name:WEAPONS.moon.n});
 if(sal===undefined)sal=tt===undefined&&!!(save.wSal&&save.wSal[arch]);
 const t=tt!==undefined?tt:((save.wTier&&save.wTier[arch])||0),tc=Math.max(0,t);
 return Object.assign(weaponOf(arch,t,sal?salvOf(arch,tc):rollOf(arch,tc),sal),{id:arch+':'+tc+(sal?'s':''),name:(sal?'Salvaged ':'')+(WNAMES[arch]||WNAMES.pulse)[tc]});
}
function getC(cls,tt,sal){
 if(sal===undefined)sal=tt===undefined&&!!(save.cSal&&save.cSal[cls]);
 const t=tt!==undefined?tt:((save.cTier&&save.cTier[cls])||0),tc=Math.max(0,t);
 return Object.assign(chassisOf(cls,t,sal?salvOf(cls,tc):rollOf(cls,tc),sal),{id:cls+':'+tc+(sal?'s':''),name:(sal?'Salvaged ':'')+(CNAMES[cls]||CNAMES.vanguard)[tc]});
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
// everything that sets your tank's stats, in the form the PvP server checks (see rules.js)
function myLoadout(){
 const W0=getW(save.weapon),C0=getC(save.chassis),ch=x=>({c:x.cls,t:x.tier,q:x.q,s:!!x.sal});
 return {w:{a:W0.arch,t:W0.tier,q:W0.q,s:!!W0.sal},c:ch(C0),up:Object.assign({},save.up),cores:(save.cores||[]).slice(0,3),gl:Object.assign({},save.gemLvl),
  skin:save.skin==='lunar'?'lunar':'default',paint:save.paint||'stock',chs:ownedChassisClasses().map(c=>ch(getC(c)))};
}
const calcPower=()=>powerOf(myLoadout());
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
 if(!save.cores)save.cores=['dmg','rof','arm'];
 {const seen={};save.cores=save.cores.slice(0,3).map(k=>{if(!k||!GEM[k]||seen[k])return null;seen[k]=1;return k;});while(save.cores.length<3)save.cores.push(null);}   // one of each core type
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
 if(!save.paints)save.paints={stock:1};if(!save.paint||!save.paints[save.paint])save.paint='stock';
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
// points the server already credited (live matches): bank them here too, so the next sync has nothing left to claim
function bankPts(n){
 if(!n||n<=0)return 0;
 rollPeriods();n=Math.round(n);
 save.pts=(save.pts||0)+n;save.earned=(save.earned||0)+n;save.dailyPts=(save.dailyPts||0)+n;save.weeklyPts=(save.weeklyPts||0)+n;
 store();if(typeof syncPlayer==='function')syncPlayer();
 return n;
}
// put core k in socket i; if it's already in another socket, the two swap (each core type fits once)
function socketCore(i,k){
 const c=save.cores;if(i<0||i>2)return;
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
const X_URL='https://x.com/thelunarmeme';   // X/Twitter profile
const TG_URL='';  // Telegram news channel: fill in when it exists
const QUESTS=[
 {id:'q_win1',n:'First blood',d:'Win your first match',pts:50,goal:1},
 {id:'q_win3',n:'Warmonger',d:'Win 3 matches',pts:150,goal:3},
 {id:'q_dmg',n:'Heavy hitter',d:'Deal 2,500 damage in one match',pts:100,goal:2500},
 {id:'q_super',n:'Overcharged',d:'Fire your super twice in one match',pts:100,goal:2},
 {id:'q_box',n:'Scavenger',d:'Grab 3 mystery boxes in one match',pts:75,goal:3},
 {id:'q_clean',n:'Untouchable',d:'Win a match without dropping below 20% health',pts:250,goal:1},
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

// ---- daily quests: 4 a day (2 easy, 1 medium, 1 hard), picked per player per day; finish all 4 for a bonus.
// 1 free swap a day (2 with the premium pass). Weekly: 5 quests a week, plus a chest for claiming 20 dailies.
// Your login streak boosts every quest's points (see questBoost). Stats come from afterMatch (match.js).
const DQ_POOL=[
 {id:'play4',lv:0,t:'Play 4 matches',goal:4,pts:100,st:'plays'},
 {id:'win2',lv:0,t:'Win 2 matches',goal:2,pts:120,st:'wins'},
 {id:'box3',lv:0,t:'Grab 3 mystery boxes',goal:3,pts:100,st:'boxes'},
 {id:'sup3',lv:0,t:'Fire 3 supers',goal:3,pts:100,st:'sups'},
 {id:'dmg6k',lv:0,t:'Deal 6,000 damage',goal:6000,pts:100,st:'dmg'},
 {id:'kill4',lv:0,t:'Destroy 4 enemy tanks',goal:4,pts:100,st:'kills'},
 {id:'feat1',lv:0,t:'Play a featured-mode match',goal:1,pts:100,st:'featured'},
 {id:'quick1',lv:0,t:'Play a Quick Match',goal:1,pts:100,st:'quick'},
 {id:'win4',lv:1,t:'Win 4 matches',goal:4,pts:180,st:'wins'},
 {id:'kill10',lv:1,t:'Destroy 10 enemy tanks',goal:10,pts:170,st:'kills'},
 {id:'dmg15k',lv:1,t:'Deal 15,000 damage',goal:15000,pts:170,st:'dmg'},
 {id:'kill4m',lv:1,t:'Destroy 4 tanks in one match',goal:4,pts:180,st:'kills',mx:1},
 {id:'nodie',lv:1,t:'Win without being destroyed',goal:1,pts:170,st:'cleanWins'},
 {id:'zwin',lv:1,t:'Win a Moon Zone match',goal:1,pts:160,st:'zoneWins'},
 {id:'cap3',lv:1,t:'Capture the Moon Zone 3 times',goal:3,pts:160,st:'caps'},
 {id:'cry10',lv:1,t:'Collect 10 crystals in Crystal Rush',goal:10,pts:160,st:'crystals'},
 {id:'bnt5',lv:1,t:'Earn 5 bounty stars',goal:5,pts:160,st:'stars'},
 {id:'top3',lv:1,t:'Finish top 3 in Last Standing',goal:1,pts:160,st:'top3'},
 {id:'twin',lv:1,t:'Win a 2v2 or 3v3 match',goal:1,pts:160,st:'teamWins'},
 {id:'ovpw',lv:1,t:'Win a match on Overpass',goal:1,pts:160,st:'ovpWins'},
 {id:'win6',lv:2,t:'Win 6 matches',goal:6,pts:280,st:'wins'},
 {id:'row3',lv:2,t:'Win 3 matches in a row',goal:3,pts:280,st:'streak',mx:1},
 {id:'nodie2',lv:2,t:'Win 2 matches without being destroyed',goal:2,pts:280,st:'cleanWins'},
 {id:'sweep',lv:2,t:'Win a 1v1 Arena match 2-0',goal:1,pts:260,st:'sweeps'},
 {id:'ls1',lv:2,t:'Win a Last Standing match',goal:1,pts:300,st:'royaleWins'},
 {id:'featw3',lv:2,t:'Win 3 featured-mode matches',goal:3,pts:260,st:'featWins'},
 {id:'bntw2',lv:2,t:'Win 2 Bounty matches',goal:2,pts:260,st:'bountyWins'},
 {id:'cryw2',lv:2,t:'Win 2 Crystal Rush matches',goal:2,pts:260,st:'crystalWins'}];
const DQ_SLOTS=[0,0,1,2],DQ_LV=['Easy','Medium','Hard'],DQ_ALL_BONUS=250,DQ_SWAPS=1;
// u: counts different values (days played, modes won), not a total. mx: best single match (or current win streak)
const WQ_POOL=[
 {id:'wdays',t:'Play on 5 different days',goal:5,pts:1500,st:'day',u:1},
 {id:'wwin20',t:'Win 20 matches',goal:20,pts:1250,st:'wins'},
 {id:'wplay35',t:'Play 35 matches',goal:35,pts:1000,st:'plays'},
 {id:'wkill50',t:'Destroy 50 enemy tanks',goal:50,pts:1000,st:'kills'},
 {id:'wdmg',t:'Deal 80,000 damage',goal:80000,pts:1000,st:'dmg'},
 {id:'wmodes',t:'Win in 4 different modes',goal:4,pts:1000,st:'winMode',u:1},
 {id:'wzone6',t:'Win 6 Moon Zone matches',goal:6,pts:1000,st:'zoneWins'},
 {id:'wteam8',t:'Win 8 team matches (2v2 or 3v3)',goal:8,pts:1000,st:'teamWins'},
 {id:'wls2',t:'Win 2 Last Standing matches',goal:2,pts:1250,st:'royaleWins'},
 {id:'wrow5',t:'Win 5 matches in a row',goal:5,pts:1250,st:'streak',mx:1},
 {id:'wquick8',t:'Play 8 Quick Matches',goal:8,pts:1000,st:'quick'},
 {id:'wfeat8',t:'Play 8 featured-mode matches',goal:8,pts:1000,st:'featured'},
 {id:'wsup25',t:'Fire 25 supers',goal:25,pts:750,st:'sups'},
 {id:'wbox30',t:'Grab 30 mystery boxes',goal:30,pts:750,st:'boxes'},
 {id:'wclean5',t:'Win 5 matches without being destroyed',goal:5,pts:1000,st:'cleanWins'},
 {id:'wcap15',t:'Capture the Moon Zone 15 times',goal:15,pts:1000,st:'caps'}];
const WQ_N=5,PASS_XP_WQ=150,WQ_GOAL=20,WQ_PTS=2000;   // WQ_GOAL dailies open the weekly chest
const DQ_BY={},WQ_BY={};DQ_POOL.forEach(q=>DQ_BY[q.id]=q);WQ_POOL.forEach(q=>WQ_BY[q.id]=q);
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
// login streak bonus on quest points: day 2 of your streak +5%, up to +30% from day 7. Counts once today's daily reward is claimed
const QB_STEP=0.05,QB_MAX=0.3;
const streakBoost=n=>Math.min(QB_MAX,QB_STEP*Math.max(0,n-1));
function questBoost(){const L=loginState();return L.claimedToday?streakBoost(L.streak):0;}
const qPts=n=>Math.round(n*(1+questBoost()));
const swapsLeft=()=>{dailyQuests();return Math.max(0,DQ_SWAPS+(passState().prem?1:0)-(save.dq.sw||0));};
function questRows(ids,p,c,BY){return ids.filter(id=>BY[id]).map(id=>{const Q=BY[id],v=p[id]||0;return {...Q,p:Math.min(v,Q.goal),done:v>=Q.goal,claimed:!!c[id]};});}
function dailyQuests(){
 const d=dayNum();
 if(!save.dq||save.dq.d!==d||save.dq.v!==2){
  const r=rng32(hashStr((playerKey())+':'+d)),ids=[];
  for(const lv of DQ_SLOTS){const pool=DQ_POOL.filter(q=>q.lv===lv&&!ids.includes(q.id));ids.push(pool[(r()*pool.length)|0].id);}
  save.dq={v:2,d,ids,p:{},c:{},all:false,sw:0};
 }
 const w=weekNum();
 if(!save.wq||save.wq.w!==w)save.wq={w,n:0,claimed:false};
 if(!save.wk||save.wk.w!==w){
  const r=rng32(hashStr((playerKey())+':w'+w)),pool=WQ_POOL.slice(1),ids=[WQ_POOL[0].id];   // "play on 5 days" every week
  while(ids.length<WQ_N){const i=(r()*pool.length)|0;ids.push(pool.splice(i,1)[0].id);}
  save.wk={w,ids,p:{},u:{},c:{}};
 }
 return questRows(save.dq.ids,save.dq.p,save.dq.c,DQ_BY);
}
function weeklyQuests(){dailyQuests();return questRows(save.wk.ids,save.wk.p,save.wk.c,WQ_BY);}
function qAdd(p,u,Q,stats){   // one match's stats into one quest
 const v=stats[Q.st];
 if(Q.u){if(v===undefined||v===null||v===false)return;const s=u[Q.id]||(u[Q.id]=[]);if(!s.includes(v))s.push(v);p[Q.id]=s.length;return;}
 if(!v)return;
 p[Q.id]=Q.mx?Math.max(p[Q.id]||0,v):(p[Q.id]||0)+v;
}
function dqProgress(stats){   // called after every match with that match's stats
 dailyQuests();
 for(const id of save.dq.ids)if(DQ_BY[id])qAdd(save.dq.p,{},DQ_BY[id],stats);
 for(const id of save.wk.ids)if(WQ_BY[id])qAdd(save.wk.p,save.wk.u,WQ_BY[id],stats);
}
// swap one unfinished daily for another of the same difficulty
function swapDaily(id){
 const qs=dailyQuests(),Q=qs.find(q=>q.id===id);
 if(!Q||Q.done||Q.claimed||swapsLeft()<1)return null;
 const pool=DQ_POOL.filter(q=>q.lv===Q.lv&&!save.dq.ids.includes(q.id)&&!(save.dq.was||[]).includes(q.id));
 if(!pool.length)return null;
 const N=pool[(Math.random()*pool.length)|0];
 save.dq.ids[save.dq.ids.indexOf(id)]=N.id;delete save.dq.p[id];
 save.dq.was=(save.dq.was||[]).concat(id);save.dq.sw=(save.dq.sw||0)+1;
 store();fx('tap');return N;
}
function claimDaily(id){
 const qs=dailyQuests(),Q=qs.find(q=>q.id===id);
 if(!Q||!Q.done||Q.claimed)return 0;
 save.dq.c[id]=true;save.wq.n=(save.wq.n||0)+1;
 let n=awardPts(qPts(Q.pts));passXP(PASS_XP_QUEST);
 if(!save.dq.all&&qs.every(q=>q.claimed||q.id===id)){save.dq.all=true;n+=awardPts(qPts(DQ_ALL_BONUS));passXP(PASS_XP_ALL);}
 store();fx('claim');return n;
}
function claimWeeklyQuest(id){
 const Q=weeklyQuests().find(q=>q.id===id);
 if(!Q||!Q.done||Q.claimed)return 0;
 save.wk.c[id]=true;const n=awardPts(qPts(Q.pts));passXP(PASS_XP_WQ);
 store();fx('claim');return n;
}
function claimWeekly(){
 dailyQuests();
 if(save.wq.claimed||(save.wq.n||0)<WQ_GOAL)return null;
 save.wq.claimed=true;const n=awardPts(qPts(WQ_PTS));store();fx('claim');
 return {pts:n,reveal:doOpenBox('gem',1)};
}
// ---- Lunar Pass: a 28-day season with 30 tiers. Free track for everyone, premium track for pass owners.
// The premium track never gives points, so buying it can't buy leaderboard rank (the airdrop stays earned).
const PASS_LEN=28,PASS_TIERS=30,PASS_XP=350,PASS_START=20744,PASS_PRICE={ton:13,stars:799};   // season 1 starts Oct 18, 2026 (UTC day 20744)
const PASS_XP_WIN=40,PASS_XP_DRAW=25,PASS_XP_LOSS=20,PASS_XP_FEAT=10,PASS_XP_QUEST=50,PASS_XP_ALL=100;
const seasonNo=()=>Math.max(1,Math.floor((dayNum()-PASS_START)/PASS_LEN)+1);
const seasonEndMs=()=>(PASS_START+seasonNo()*PASS_LEN)*864e5-(Date.now()+(typeof srvOff==='number'?srvOff:0));
const PASS_FREE=[null,{k:'pts',n:150},{k:'box',tk:'gem',ri:0},{k:'pts',n:150},{k:'pts',n:200},{k:'box',tk:'weapon',ri:0},{k:'pts',n:200},{k:'box',tk:'gem',ri:0},{k:'pts',n:250},{k:'pts',n:250},{k:'box',tk:'chassis',ri:0},
 {k:'pts',n:250},{k:'box',tk:'gem',ri:0},{k:'pts',n:300},{k:'pts',n:300},{k:'box',tk:'gem',ri:1},{k:'pts',n:300},{k:'box',tk:'gem',ri:0},{k:'pts',n:350},{k:'pts',n:350},{k:'box',tk:'weapon',ri:0},
 {k:'pts',n:350},{k:'box',tk:'gem',ri:0},{k:'pts',n:400},{k:'pts',n:400},{k:'box',tk:'gem',ri:1},{k:'pts',n:400},{k:'box',tk:'gem',ri:0},{k:'pts',n:500},{k:'pts',n:500},{k:'paint',id:'regolith'}];
const PASS_PREM=[null,{k:'paint',id:'eclipse'},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'weapon',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:1},
 {k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'chassis',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'paint',id:'aurora'},
 {k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'weapon',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'gem',ri:0},{k:'box',tk:'gem',ri:1},{k:'box',tk:'chassis',ri:2}];
function passState(){const s=seasonNo();if(!save.pass||save.pass.s!==s)save.pass={s,xp:0,prem:false,cf:[],cp:[]};return save.pass;}
const passTier=()=>Math.min(PASS_TIERS,Math.floor(passState().xp/PASS_XP));
function passXP(n){
 if(!n)return;const P=passState(),before=passTier();P.xp=Math.min(PASS_TIERS*PASS_XP,P.xp+n);const after=passTier();
 if(after>before&&typeof showToast==='function')setTimeout(()=>showToast('Lunar Pass: tier '+after+' reached'),900);
}
function rewardLabel(r){
 if(!r)return '';
 if(r.k==='pts')return '+'+fmtNum(r.n)+' points';
 if(r.k==='paint')return PAINTS[r.id].n+' paint';
 return TIER_N[r.ri]+' '+(r.tk==='weapon'?'weapon cache':r.tk==='chassis'?'chassis crate':'gem cache');
}
const passReady=()=>{const P=passState(),t=passTier();let n=0;for(let i=1;i<=t;i++){if(!P.cf.includes(i))n++;if(P.prem&&!P.cp.includes(i))n++;}return n;};
function claimPass(track,i){
 const P=passState();i=+i;
 if(i<1||i>passTier())return null;
 const prem=track==='p',list=prem?P.cp:P.cf,r=(prem?PASS_PREM:PASS_FREE)[i];
 if(!r||list.includes(i)||(prem&&!P.prem))return null;
 list.push(i);
 let out;
 if(r.k==='pts'){const n=awardPts(r.n);store();fx('claim');out={pts:n};}
 else if(r.k==='paint'){save.paints[r.id]=1;save.paint=r.id;store();fx('buy');out={reveal:{tk:'paint',rar:2,color:PAINTS[r.id].trim,paint:r.id,title:PAINTS[r.id].n+' paint',sub:'Equipped. Change it in the Garage.'}};}
 else{out={reveal:doOpenBox(r.tk,r.ri)};store();}
 return out;
}
// ---- paints: looks only, no stats. Your team color still shows on the tracks, turret core and health bar ----
const PAINT_ORDER=['stock','nebula','ember','arctic','venom','gold','void','regolith','eclipse','aurora'];
const myPaint=()=>PAINTS[save.paint]||PAINTS.stock;
// ---- featured mode: one mode a day pays +25% and gets a live queue ----
const featuredMode=()=>featuredOn(dayNum());   // FEATURE_ROT is in rules.js
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
function boxMult(tk,ri){if(ri===0)return 1;const n=(save.buys&&save.buys[buyKey(tk,ri)])||0;return tk==='gem'?1+0.25*n:Math.min(3,1+n);}   // Common crates are always 250 Stars / 4 TON
const isDeal=(tk,ri)=>{const D=dealOn(dayNum());return D.tk===tk&&D.ri===ri;};   // today's deal crate (rules.js): 30% off in every currency
const dealX=(tk,ri)=>isDeal(tk,ri)?1-DEAL_OFF:1;
function boxPrice(tk,ri,full){return Math.round(RPRICE[ri]*boxMult(tk,ri)*(full?1:dealX(tk,ri))*100)/100;}   // TON. full: before the deal
function boxStars(tk,ri,full){return Math.round(RSTARS[ri]*boxMult(tk,ri)*(full?1:dealX(tk,ri)));}
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
 const q=Math.round((SALV_MIN[ri]+Math.random()*(SALV_MAX[ri]-SALV_MIN[ri]))*1000)/1000;
 save.pts-=c;save.ptsSpent=(save.ptsSpent||0)+c;save.salv=save.salv||{};
 const nm='Salvaged '+(isW?WNAMES[k][ri]:CNAMES[k][ri]),pw=v=>(Math.round(v*1000)/10)+'%';
 if(q>old){save.salv[key]=q;equipBest(isW,k);store();
  return {tk,ri,rar:ri,color:SALV_COL,item:{isW,k,tier:ri,sal:true},title:nm,sub:(old?pw(old)+' → ':'')+pw(q)+' power. Crate gear starts at 105%.'};}
 store();return {tk,ri,rar:ri,color:SALV_COL,item:{isW,k,tier:ri,sal:true},title:'Rolled '+pw(q),sub:'You kept your '+pw(old)+' '+nm};
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
 }else if(desc.kind==='paint'){
  const P=PAINTS[desc.id];
  if(P&&!save.paints[desc.id]){save.paints[desc.id]=1;save.paint=desc.id;save.spendGram=(save.spendGram||0)+(P.ton||0);
   reveals.push({tk:'paint',rar:2,color:P.trim,paint:desc.id,title:P.n+' paint',sub:'Equipped. Change it in the Garage.'});}
 }else if(desc.kind==='pass'){
  const P=passState();
  if(!P.prem){P.prem=true;save.spendGram=(save.spendGram||0)+PASS_PRICE.ton;
   reveals.push({tk:'pass',rar:2,color:'#ffcf4a',paint:'eclipse',title:'Lunar Pass unlocked',sub:'Claim your premium rewards in Quests.'});}
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
