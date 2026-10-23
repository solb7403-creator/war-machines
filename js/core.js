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

// ---- combat rules, gear math, paints and the whole economy (points, quests, crates, pass, squad) live in rules.js:
// shared with the server, which runs them for every pilot in Telegram ----
const gemMult=k=>gemLvMult(save.gemLvl&&save.gemLvl[k]);
const fmtCore=(k,v)=>'+'+(k==='reg'?(v*100).toFixed(2):(Math.round(v*1000)/10))+'%';
const SUPER_DESC={pulse:'Pierce Lance: a rail beam that goes through cover and hits every enemy in a line.',
 twin:'Static Nova: an electric shockwave that hits every enemy near you.',
 siege:'Siege Blast: a heavy shell with a big blast radius.',
 moon:'Moonfall: a massive lunar beam, the strongest super in the game.'};
const TIER_N=['Common','Rare','Epic'];
const RCOL=['#9fb3c8','#b78bff','#ffcf4a'];
const TIERC=['#c08a54','#c3ccd6','#ffcf4a','#7be3e0','#c79bff'];
// 9 weapons + 9 chassis: each line has one named item per rarity, each drops only from its own rarity's crate
const WNAMES={pulse:['Pulse Cannon','Arc Pulse','Nova Pulse'],twin:['Twin Repeater','Storm Repeater','Helix Repeater'],siege:['Siege Breaker','Rail Breaker','Titanfall']};
const CNAMES={scout:['Scout','Strider','Phantom'],vanguard:['Vanguard','Sentinel','Paladin'],titan:['Titan','Bulwark','Colossus']};
const ownW=(k,t)=>hasW(save,k,t);
const ownC=(k,t)=>hasC(save,k,t);
// Power ladder (stat multiplier vs stock gear). Every crate item beats every salvaged item:
//   stock starter gear 1.00 | Salvaged Rare 1.010-1.030 | Salvaged Epic 1.031-1.044
//   Common crate 1.050-1.100 | Rare crate 1.155-1.210 | Epic crate 1.386-1.452
const SALV_COL='#c48a5c';
const rollOf=(k,t)=>rollIn(save,k,t);
const salvOf=(k,t)=>salvIn(save,k,t);
const gearMult=(k,tc,sal)=>gearMultIn(save,k,tc,sal);
const canTune=(isW,k,t)=>(isW?ownW(k,t):ownC(k,t))&&!!(save.roll&&save.roll[k+':'+t]);   // crate items only: starter gear has no roll to tune
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
 const b=bestOf(save,isW,k);if(!b)return;
 if(isW){save.wTier[k]=b.t;save.wSal=save.wSal||{};save.wSal[k]=b.s;}
 else{save.cTier[k]=b.t;save.cSal=save.cSal||{};save.cSal[k]=b.s;}
}
// what's equipped must be something you own (the server's record can take things away: a refund, or gear it never saw)
function fixEquip(){
 save.wTier=save.wTier||{};save.cTier=save.cTier||{};save.wSal=save.wSal||{};save.cSal=save.cSal||{};
 for(const [isW,keys,T,Sl] of [[true,WORDER,save.wTier,save.wSal],[false,CHORDER,save.cTier,save.cSal]])
  for(const k of keys){const t=T[k],s=!!Sl[k],ok=t>=0&&(s?salvOf(k,t)>0:(isW?ownW(k,t):ownC(k,t)));
   if(!ok){const b=bestOf(save,isW,k);T[k]=b?b.t:-1;Sl[k]=b?b.s:false;}}
 if(save.weapon==='moon'?!save.moonbeam:!WEAPONS[save.weapon]||save.wTier[save.weapon]<0)save.weapon='pulse';
 if(!CH[save.chassis]||save.cTier[save.chassis]<0)save.chassis='vanguard';
 if(!save.paints||!save.paints[save.paint])save.paint='stock';
}
const tierCol=t=>t<0?'#8a97ab':RCOL[t];
const tierName=t=>t<0?'Stock':TIER_N[t];
const gcol=it=>it.premium?'#e8f4ff':it.sal?SALV_COL:tierCol(it.tier);
const gbadge=it=>it.premium?'Legendary':it.sal?'Salvaged':tierName(it.tier);
const ownedChassisClasses=()=>CHORDER.filter(c=>(save.cOwn[c]||[]).length||salvOf(c,1)||salvOf(c,2));
// ---- tiers (lifetime points) and leagues (gear power) ----
const tierIdx=()=>tierOfPts(save.earned||0);
const SKINS={default:{n:'Standard',c:'#3fd0c9',price:0},lunar:{n:'Lunar',c:'#e8f4ff',price:SKIN_PRICE,d:'+8% health, +8% damage'}};
// everything that sets your tank's stats, in the form the server checks (see ecoLoadout in rules.js)
function myLoadout(){
 const W0=getW(save.weapon),C0=getC(save.chassis),ch=x=>({c:x.cls,t:x.tier,q:x.q,s:!!x.sal});
 return {w:{a:W0.arch,t:W0.tier,q:W0.q,s:!!W0.sal},c:ch(C0),up:Object.assign({},save.up),cores:(save.cores||[]).slice(0,3),gl:Object.assign({},save.gemLvl),
  skin:save.skin==='lunar'?'lunar':'default',paint:save.paint||'stock',chs:ownedChassisClasses().map(c=>ch(getC(c))),vl:vaultLevel(save.vg)};
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
 if(save.streak===undefined)save.streak=0;
 if(!save.cores)save.cores=['dmg','rof','arm'];
 {const seen={};save.cores=save.cores.slice(0,3).map(k=>{if(!k||!GEM[k]||seen[k])return null;seen[k]=1;return k;});while(save.cores.length<3)save.cores.push(null);}   // one of each core type
 if(!save.wTier)save.wTier={pulse:0,twin:-1,siege:-1};if(!save.cTier)save.cTier={scout:-1,vanguard:0,titan:-1};
 if(!WEAPONS[save.weapon])save.weapon='pulse';
 if(!CH[save.chassis])save.chassis='vanguard';
 if(save.payCur===undefined||save.payCur==='pts')save.payCur='stars';   // points are a separate button on each crate now
 if(save.sound===undefined)save.sound=true;
 if(save.haptics===undefined)save.haptics=true;
 if(save.mp===undefined)save.mp=(save.wins||0)+(save.losses||0);
 if(!save.mode)save.mode='1v1';if(!save.gtype)save.gtype='arena';if(!save.map)save.map='classic';
 ecoNorm(save);
 if(!save.paint||!save.paints[save.paint])save.paint='stock';
}
function store(){save._ts=Date.now();try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}cloudSave();if(typeof uiDirty==='function')uiDirty();}

// ---- the economy: who runs it ----
// In Telegram the server owns points and gear: every change below is a server call, and the phone copies the server's
// record from each reply (applyEco). Outside Telegram (or with LUNAR_LOCAL_ECO, used by the older tests) the phone runs
// the same rules from rules.js on its own save, instantly.
const SRV_ECO=IN_TG&&!window.LUNAR_LOCAL_ECO;
function dayId(d){return d.toISOString().slice(0,10);}
const dayNum=()=>Math.floor((Date.now()+(typeof srvOff==='number'?srvOff:0))/864e5);
const weekNum=()=>Math.floor((Date.now()+(typeof srvOff==='number'?srvOff:0)-4*864e5)/(7*864e5));
const playerKey=()=>IN_TG?'tg_'+TG_USER.id:'local';
const ecoX=()=>({day:dayNum(),week:weekNum(),rnd:Math.random,pk:playerKey()});
const when=(v,f)=>v&&typeof v.then==='function'?v.then(f):f(v);   // a result now (local) or later (server)
function rollPeriods(){ecoRoll(save,ecoX());}
let ecoBusy=0;
// the server's copy of your points, gear and quests replaces this device's
function applyEco(E){
 if(!E||typeof E!=='object')return;
 if(SRV_ECO&&!save.migOk)return;   // this device's progress hasn't moved to the server yet: keep it until it has (doSync)
 const S=ecoNorm(JSON.parse(JSON.stringify(E)));
 for(const k of ECO_KEYS)if(S[k]!==undefined)save[k]=S[k];
 fixEquip();store();
}
const ecoCopy=()=>{const o={};for(const k of ECO_KEYS)if(save[k]!==undefined)o[k]=save[k];return JSON.parse(JSON.stringify(o));};
// one economy action. local(S, X) runs it on this save; in Telegram the server runs the same thing as action a
function ecoRun(a,args,local){
 if(!SRV_ECO){const r=local(save,ecoX());store();return r;}
 if(!save.migOk)return waitMig().then(ok=>ok?ecoRun(a,args,local):{err:'offline'});   // first launch: the server takes this device's progress first
 if(ecoBusy)return Promise.resolve({err:'busy'});
 ecoBusy++;
 return api('/api/act',Object.assign({a},args||{})).then(r=>{ecoBusy--;if(r&&r.E)applyEco(r.E);return (r&&r.out)||{err:(r&&r.error)||'server'};},
  e=>{ecoBusy--;return {err:'offline'};});
}
function waitMig(){
 return new Promise(res=>{let n=0;const t=()=>{if(save.migOk)return res(true);if(++n>30)return res(false);if(n%10===1&&typeof doSync==='function')doSync(false);setTimeout(t,200);};t();});
}
function ecoErr(r){   // a toast for an action that didn't go through
 if(!r||!r.err)return false;
 const m={pts:'You need '+fmtNum(r.need||0)+' more points',max:'Already at the best it gets',crate:'Only crate gear can be tuned',paid:'Epic crates are paid only',
  join:'Join the channel first, then claim.',budget:'Build budget full: '+BUILD_MAX+' of '+BUILD_MAX+' levels. Reset your build to move them.',empty:'Nothing to reset yet',offline:'No connection. Try again in a moment.',server:'The server is busy. Try again in a moment.'}[r.err];
 if(m&&typeof showToast==='function')showToast(r.err==='max'&&r.k?'Already at max level':m);
 return true;
}
// points (local play only: in Telegram the server awards every point)
function awardPts(n){
 if(SRV_ECO)return 0;
 const a=ecoAward(save,n,ecoX());
 if(n>0&&!a&&typeof showToast==='function')showToast('Daily point cap reached. It resets at 00:00 UTC.');
 store();if(typeof syncPlayer==='function')syncPlayer();
 return a;
}
// points the server already credited (live matches): show them now; the server's record follows
function bankPts(n){
 if(!n||n<=0)return 0;
 rollPeriods();n=Math.round(n);
 save.pts=(save.pts||0)+n;save.earned=(save.earned||0)+n;save.dailyPts=(save.dailyPts||0)+n;save.weeklyPts=(save.weeklyPts||0)+n;
 store();if(typeof syncPlayer==='function')syncPlayer();
 return n;
}
// what a crate, purchase or reward gave, in words for the reveal card (raw: from rules.js ecoOpenBox / ecoGrant / ecoSalvage)
function revealOf(r){
 if(!r)return null;
 if(r.gem){const G=GEM[r.gem],lv=r.lv;return {tk:r.tk||'gem',ri:r.ri,rar:r.ri||0,color:G.c,gem:r.gem,title:'+'+r.n+' '+G.name+(r.n===1?' shard':' shards'),
  sub:r.up>0?G.name+' core reached level '+lv+'!':G.name+' core: level '+lv+(lv<5?' ('+(r.sh!==undefined?r.sh:save.gemShards[r.gem])+'/'+SHARD_NEED[lv]+' shards to next)':' (max)')};}
 if(r.tk==='paint'){const P=PAINTS[r.id]||PAINTS.stock;return r.id==='founder'?{tk:'paint',rar:2,color:P.trim,paint:'founder',title:'Founder paint',sub:'Yours for good. It’s never sold again.'}:
  {tk:'paint',rar:2,color:P.trim,paint:r.id,title:P.n+' paint',sub:'Equipped. Change it in the Garage.'};}
 if(r.tk==='moonbeam')return {tk:'moonbeam',rar:2,color:'#e8f4ff',title:'Moonbeam unlocked',sub:'Equipped. Its super is Moonfall.'};
 if(r.tk==='skin')return {tk:'skin',rar:2,color:'#e8f4ff',title:'Lunar skin unlocked',sub:'+8% health and +8% damage, applied.'};
 if(r.tk==='respec')return {tk:'respec',rar:2,color:'#ffcf4a',title:r.credit?'Paid reset saved':'Build reset',sub:r.credit?'Your next build reset gives back every point.':'Every level is back to 0 and all '+fmtNum(r.back)+' points are back. Spend them in the Garage.'};
 if(r.tk==='pass')return {tk:'pass',rar:2,color:'#ffcf4a',paint:'eclipse',title:'Lunar Pass unlocked',sub:'Claim your premium rewards in Quests.'};
 if(r.tk==='vault'){const lv=r.lv|0,lv0=r.lv0|0,got=VAULT_REW.filter(x=>x.lv>lv0&&x.lv<=lv).map(x=>x.n),t=r.t||save.vg||0;
  return {tk:'vault',rar:2,color:vaultTier(lv).c,lv,title:'+'+fmtNum(r.g)+' Gold',
   sub:(r.gg?'Recorded as Genesis Gold. ':'')+(lv>lv0?'Vault level '+lv+'!'+(got.length?' Unlocked: '+got.join(', ')+'.':' Your badge is brighter on every board.'):'Vault level '+lv+'. '+fmtNum(Math.max(0,vaultNeed(lv+1)-t))+' Gold to level '+(lv+1)+'.')};}
 const isW=r.isW,k=r.k,t=r.tier;if(!k)return null;
 const pw=v=>(Math.round(v*1000)/10)+'%';
 if(r.sal){const nm='Salvaged '+(isW?WNAMES[k][t]:CNAMES[k][t]),item={isW,k,tier:t,sal:true};
  return r.better?{tk:r.tk,ri:r.ri,rar:t,color:SALV_COL,item,title:nm,sub:(r.old?pw(r.old)+' → ':'')+pw(r.q)+' power. Crate gear starts at 105%.'}:
   {tk:r.tk,ri:r.ri,rar:t,color:SALV_COL,item,title:'Rolled '+pw(r.q),sub:'You kept your '+pw(r.old)+' '+nm};}
 const nm=isW?WNAMES[k][t]:CNAMES[k][t],item={isW,k,tier:t};
 if(r.kind==='new'){const w0=getW(k,t,false),c0=getC(k,t,false);
  return {tk:r.tk,ri:r.ri,rar:t,color:RCOL[t],item,title:'New '+TIER_N[t]+': '+nm,sub:'Roll '+pct(r.roll)+(isW?', '+w0.dps+' damage per second':', '+c0.hp+'× health, '+c0.spd+'× speed')};}
 if(r.kind==='up')return {tk:r.tk,ri:r.ri,rar:t,color:RCOL[t],item,title:'Roll upgraded!',sub:nm+': '+pct(r.old)+' → '+pct(r.roll)};
 return {tk:r.tk,ri:r.ri,rar:t,color:RCOL[t],item,title:'Rolled '+pct(r.roll),sub:'You kept your '+pct(r.old)+' '+nm+' and got +'+(r.pts||0)+' points'};
}
// after new gear or a purchase: equip it (the reveal says "Equipped")
function afterGain(r){
 if(!r)return;
 if(r.k&&(r.kind==='new'||r.kind==='up'||(r.sal&&r.better)))equipBest(r.isW,r.k);
 if(r.tk==='moonbeam')save.weapon='moon';
 if(r.tk==='paint'&&r.id)save.paint=r.id;
 if(r.tk==='vault'&&(r.lv0|0)<VAULT_PAINT_LV&&(r.lv|0)>=VAULT_PAINT_LV){save.paints=save.paints||{};save.paints.hyper=1;save.paint='hyper';}   // the Hyperspace paint goes on the moment it unlocks
 if(r.box)afterGain(r.box);
}
// what a server-verified purchase gave: equip it and show it
function showOuts(outs){
 const list=(outs||[]).filter(Boolean);
 list.forEach(afterGain);fixEquip();store();
 if(typeof fx==='function')fx('buy');
 const rv=list.map(revealOf).filter(Boolean);
 if(rv.length&&typeof showReveal==='function')showReveal(rv);
}
// put core k in socket i; if it's already in another socket, the two swap (each core type fits once)
function socketCore(i,k){
 const c=save.cores;if(i<0||i>2)return;
 if(k===null){c[i]=null;store();return;}
 const j=c.indexOf(k);if(j===i)return;
 if(j>=0)c[j]=c[i];c[i]=k;store();
}
function respecBuild(){
 return when(ecoRun('respec',{},S=>ecoRespec(S)),r=>{
  if(ecoErr(r))return false;
  fx('buy');showToast('Build cleared. +'+fmtNum(r.back)+' points back');return true;
 });
}
function buyUp(k){
 return when(ecoRun('up',{k},S=>ecoUp(S,k)),r=>{
  if(ecoErr(r))return false;
  fx('buy');showToast(UPS[k].n+' upgraded to level '+r.lv);return true;
 });
}
function tuneItem(isW,k,t){
 if(!canTune(isW,k,t)){showToast('Only crate gear can be tuned');return null;}
 if(rollOf(k,t)>=ROLL_MAX-0.0001){showToast('Already at the best roll (110%)');return null;}
 return when(ecoRun('tune',{w:isW?1:0,k,t},(S,X)=>ecoTune(S,isW,k,t,X)),r=>{
  if(ecoErr(r))return null;
  if(r.better)equipBest(isW,k);store();
  if(typeof fx==='function')fx(r.better?'claim':'tap');
  return {better:r.better,old:r.old,roll:r.roll};
 });
}

// ---- milestone quests (one-time) + community links ----
function qp(id,val,isMax){ecoMsAdd(save,id,val,isMax);}
function claimQuest(id){
 return when(ecoRun('ms',{id},(S,X)=>ecoMsClaim(S,id,X)),r=>{if(!r||r.err){ecoErr(r);return 0;}if(r.pts)fx('claim');return r.pts;});
}
function openLink(url){
 try{if(IN_TG&&/^https?:\/\/t\.me\//.test(url))TG.openTelegramLink(url);else if(IN_TG)TG.openLink(url);else window.open(url,'_blank');}catch(e){window.open(url,'_blank');}
}
// a link quest: open the link and mark it visited. Telegram can pause the game the moment the link opens (the channel
// on iOS), cutting the request off, so the visit is remembered and sent again when you come back until it lands
let visitQ=[];
function sendVisit(id){
 return when(ecoRun('visit',{id},S=>ecoVisit(S,id,1)),r=>{
  if(r&&(r.ok||r.err==='no'))visitQ=visitQ.filter(x=>x!==id);   // done (or already done)
  if(typeof uiDirty==='function')uiDirty('quests');return r;});
}
function visitLinkQuest(id){
 const Q=MS_BY[id];if(!Q||!LINKS[Q.link])return;
 if(Q.read){openLink(LINKS[Q.link]);return;}   // the wiki: it counts from the button at the end of the page (wikiDone)
 if(!visitQ.includes(id))visitQ.push(id);
 const p=sendVisit(id);
 openLink(LINKS[Q.link]);
 return p;
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visitQ.length)setTimeout(()=>visitQ.slice().forEach(sendVisit),400);});

// ---- daily and weekly quests (rules.js). Stats come from every finished match ----
function questBoost(){return ecoBoost(save,ecoX());}
const qPts=n=>ecoQPts(save,n,ecoX());
const swapsLeft=()=>ecoSwapsLeft(save,ecoX());
function dailyQuests(){return ecoDailyRows(save,ecoX());}
function weeklyQuests(){return ecoWeeklyRows(save,ecoX());}
function dqProgress(stats){ecoProgress(save,stats,ecoX());}
function swapDaily(id){
 const Q=dailyQuests().find(q=>q.id===id);
 if(!Q||Q.done||Q.claimed||swapsLeft()<1)return null;
 return when(ecoRun('swap',{id},(S,X)=>{const N=ecoSwap(S,id,X);return N?{id:N.id}:{err:'none'};}),r=>{if(!r||r.err)return null;fx('tap');return DQ_BY[r.id]||null;});
}
function claimDaily(id){
 return when(ecoRun('daily',{id},(S,X)=>ecoClaimDaily(S,id,X)||{err:'no'}),r=>{if(!r||r.err)return 0;fx('claim');return r.pts;});
}
function claimWeeklyQuest(id){
 return when(ecoRun('weekly',{id},(S,X)=>ecoClaimWeekly(S,id,X)||{err:'no'}),r=>{if(!r||r.err)return 0;fx('claim');return r.pts;});
}
function claimWeekly(){
 dailyQuests();
 if(save.wq.claimed||(save.wq.n||0)<WQ_GOAL)return null;
 return when(ecoRun('chest',{},(S,X)=>ecoChest(S,X)||{err:'no'}),r=>{if(!r||r.err)return null;afterGain(r.box);store();fx('claim');return {pts:r.pts,reveal:revealOf(r.box)};});
}
// ---- Lunar Pass (rules.js): free track for everyone, premium track for pass owners. The premium track never gives points ----
const seasonNo=()=>ecoSeason(ecoX());
const seasonEndMs=()=>(PASS_START+seasonNo()*PASS_LEN)*864e5-(Date.now()+(typeof srvOff==='number'?srvOff:0));
function passState(){return ecoPassState(save,ecoX());}
const passTier=()=>ecoPassTier(save,ecoX());
function passXP(n){   // local play only (the server adds XP in Telegram)
 const up=ecoPassXP(save,n,ecoX());
 if(up>0&&typeof showToast==='function')setTimeout(()=>showToast('Lunar Pass: tier '+passTier()+' reached'),900);
}
function rewardLabel(r){
 if(!r)return '';
 if(r.k==='pts')return '+'+fmtNum(r.n)+' points';
 if(r.k==='paint')return PAINTS[r.id].n+' paint';
 return TIER_N[r.ri]+' '+(r.tk==='weapon'?'weapon cache':r.tk==='chassis'?'chassis crate':'gem cache');
}
const passReady=()=>{const P=passState(),t=passTier();let n=0;for(let i=1;i<=t;i++){if(!P.cf.includes(i))n++;if(P.prem&&!P.cp.includes(i))n++;}return n;};
function claimPass(track,i){
 i=+i;
 return when(ecoRun('pass',{t:track,i},(S,X)=>ecoClaimPass(S,track,i,X)||{err:'no'}),r=>{
  if(!r||r.err)return null;
  if(r.pts!==undefined){fx('claim');return {pts:r.pts};}
  if(r.paint){save.paint=r.paint;store();fx('buy');return {reveal:{tk:'paint',rar:2,color:PAINTS[r.paint].trim,paint:r.paint,title:PAINTS[r.paint].n+' paint',sub:'Equipped. Change it in the Garage.'}};}
  afterGain(r.box);store();return {reveal:revealOf(r.box)};
 });
}
// ---- paints: looks only, no stats. Your team color still shows on the tracks, turret core and health bar ----
const PAINT_ORDER=['stock','nebula','ember','arctic','venom','gold','void','regolith','eclipse','aurora','founder','hyper'];
const myPaint=()=>PAINTS[save.paint]||PAINTS.stock;
// ---- featured mode: one mode a day pays +25% and gets a live queue ----
const featuredMode=()=>featuredOn(dayNum());   // FEATURE_ROT is in rules.js
// ---- daily login reward: 7-day streak calendar (misses reset it) + tier bonus ----
function loginState(){return ecoLoginState(save,ecoX());}
function claimLogin(){
 if(loginState().claimedToday)return null;
 return when(ecoRun('login',{},(S,X)=>ecoLogin(S,X)||{err:'claimed'}),r=>{if(!r||r.err)return null;afterGain(r.box);store();fx('claim');return {pts:r.pts,reveal:r.box?revealOf(r.box):null,day:r.day};});
}

// ---- squad (referrals): you get paid when your recruits keep playing ----
const BOT_PLAY='https://t.me/LunarWarMachinesBot/play';
const refLink=()=>BOT_PLAY+'?startapp=ref_'+(TG_USER?TG_USER.id:'0');
// back from the wiki's end-of-page button (t.me/...?startapp=wikiread): the read quest counts, the Quests tab opens
let wikiBack=false;
function wikiDone(){
 const sp=IN_TG&&TG.initDataUnsafe&&TG.initDataUnsafe.start_param;
 if(sp!=='wikiread'||wikiBack)return;wikiBack=true;
 const e=save.q&&save.q.q_wiki;if(e&&e.claimed)return;
 if(!visitQ.includes('q_wiki'))visitQ.push('q_wiki');
 when(sendVisit('q_wiki'),r=>{if(r&&r.ok){try{closeAll();setTab('quests');}catch(_){}showToast('Wiki read! Claim your +'+fmtNum(MS_BY.q_wiki.pts)+' in Quests');}});
}
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
const squadHeld=()=>squad().filter(r=>r.held).map(r=>r.id);
function refStatus(r){const ago=r.ld==null?99:dayNum()-r.ld;return ago<=1?['Active','#5fe3a1']:ago<=6?['Idle '+ago+'d','#ffcf4a']:['Inactive','#ff6b5e'];}
const refOwed=r=>ecoRefOwed(save,r);
const refMe=()=>({ref:save.refBy&&typeof srv!=='undefined'&&srv&&srv.ref===save.refBy?save.refBy:null,days:(typeof srv!=='undefined'&&srv&&srv.days)||0});
const welcomeReady=()=>!!(save.refBy&&!save.refWelcome&&refMe().ref&&refMe().days>=2);
const pctRoom=()=>ecoPctRoom(save,ecoX());
function refPending(){return ecoSquadPending(save,squad(),ecoX(),refMe(),squadHeld());}
function claimRefs(){
 return when(ecoRun('squad',{},(S,X)=>ecoSquad(S,squad(),X,refMe(),squadHeld())),r=>{
  if(!r||r.err){ecoErr(r);return 0;}
  if(!r.pts){showToast(refPending()?'Daily cap reached. Claim the rest tomorrow.':'Nothing to claim yet. Rewards arrive as your squad plays.');return 0;}
  fx('claim');showToast('+'+fmtNum(r.pts)+' squad points');return r.pts;
 });
}
const SHARE_TXT='Join my squad in LUNAR: War Machines. Fast robot-tank battles right in Telegram, and the top 1,000 pilots get a guaranteed $LUNAR allocation.';
function shareRef(text){
 const u='https://t.me/share/url?url='+encodeURIComponent(refLink())+'&text='+encodeURIComponent(text||SHARE_TXT);
 try{if(IN_TG)TG.openTelegramLink(u);else window.open(u,'_blank');}catch(e){copyRef();}
}
function copyRef(){try{navigator.clipboard.writeText(refLink()).then(()=>showToast('Invite link copied'),()=>showToast(refLink()));}catch(e){showToast(refLink());}}

// ---- shop logic: crates, salvage, premium, starter pack (prices in rules.js; the server charges them) ----
const PSTARS={moonbeam:PREMIUM.moonbeam.stars,skin:PREMIUM.skin.stars,starter:STARTER.stars}; // premium items in Stars
const boxMult=(tk,ri)=>ecoBoxMult(save,tk,ri,ecoX());
const dealDayFree=()=>save.dealD!==dayNum(),dealWeekFree=()=>save.dealW!==weekNum();
const dealOf=(tk,ri)=>ecoDealOf(save,tk,ri,ecoX());   // the deal this crate gets right now, if any (the better one when both fit)
const dealX=(tk,ri)=>dealMult(dealOf(tk,ri));
function markDeal(k){if(k==='d')save.dealD=dayNum();else if(k==='w')save.dealW=weekNum();}
function boxPrice(tk,ri,full){return Math.round(RPRICE[ri]*boxMult(tk,ri)*(full?1:dealX(tk,ri))*100)/100;}   // TON. full: before the deal
function boxStars(tk,ri,full){return Math.round(RSTARS[ri]*boxMult(tk,ri)*(full?1:dealX(tk,ri)));}
function boxPts(tk,ri){return RPTS[ri]||0;} // points price is flat
function crateFound(tk,ri){if(tk==='gem')return 0;const ks=tk==='weapon'?WORDER:CHORDER;return ks.filter(k=>tk==='weapon'?ownW(k,ri):ownC(k,ri)).length;}
function openBoxWithPoints(tk,ri){
 const c=boxPts(tk,ri);
 if(!c){showToast('Epic crates are paid only');return null;}
 if((save.pts||0)<c){showToast('You need '+fmtNum(c-(save.pts||0))+' more points');return null;}
 return when(ecoRun('crate',{tk,ri},(S,X)=>ecoCratePts(S,tk,ri,X)),r=>{if(ecoErr(r))return null;afterGain(r);store();return revealOf(r);});
}
// opens a crate on this device (local play and tests only: in Telegram every crate is opened by the server)
function doOpenBox(tk,ri){const r=ecoOpenBox(save,tk,ri,ecoX());afterGain(r);store();return revealOf(r);}
function buySalvage(tk,ri){
 const c=SALV_PTS[ri];
 if((save.pts||0)<c){showToast('You need '+fmtNum(c-(save.pts||0))+' more points');return null;}
 return when(ecoRun('salvage',{tk,ri},(S,X)=>ecoSalvage(S,tk,ri,X)),r=>{if(ecoErr(r))return null;afterGain(r);store();return revealOf(r);});
}
// Grant a verified purchase on this device (local play and the older tests). In Telegram the server grants it (showOuts)
function grantPurchase(desc){
 if(!desc)return;
 const outs=ecoGrant(save,{kind:desc.kind,tk:desc.tk,ri:desc.ri,id:desc.id,deal:desc.deal,price:desc.price},ecoX());
 save.pendingTx=null;
 if(typeof syncPlayer==='function')syncPlayer();
 showOuts(outs);
}
