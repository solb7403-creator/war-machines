/* Session 7 Living Front screens (owner brief docs/conquest/audit/SESSION_07_BRIEF.md; blueprint §2 "the War Map is the menu", §5):
   the WAR MAP (20 territories in five rings, two colours and the front line, one highlighted NEXT ORDER, detail only on tap), the
   territory card (DEFENSE vs THREAT and the odds first, FORTIFY, STATION, what holding it gives), the campaign card (the next Citadel
   tier and its FRONT / FORCE / DEFENSE readiness), the Grand Offensive card, the WAR REPORT ("While you were away") and the war-alert
   opt-in (website notifications; the iPhone and iPad Home Screen card; Telegram through the bot). Presentation only: every number
   comes from the Worker's own session state and the shared rules (js/conquest/war.js); every change is a Worker action.
   Phone and computer equal: one column on a phone (fits or scrolls, the NEXT ORDER's button on screen first), map and cards side by
   side on a computer; every territory is a keyboard-focusable button. */
(function(root){
'use strict';
const SVGNS='http://www.w3.org/2000/svg';
const W=()=>root.ConquestWar;
const fmtN=n=>typeof fmtNum==='function'?fmtNum(n):String(n);
const left=ms=>{if(ms>0&&ms<60000)return Math.ceil(ms/1000)+' s';const m=Math.max(0,Math.ceil(ms/60000)),h=Math.floor(m/60);return h>=24?Math.floor(h/24)+' d '+h%24+' h':h?h+' h '+String(m%60).padStart(2,'0')+' m':m+' m';};
const pct=p=>Math.round(p*100)+'%';
const svg=(tag,attrs,parent)=>{const e=document.createElementNS(SVGNS,tag);for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,String(v));if(parent)parent.append(e);return e;};
const ctxOf=(s,now)=>({pilots:s?.bat?.p||[],morale:0,tiers:0,titan:0,now});
const EV_NAME={a:'ASSAULT',c:'LDF COUNTERATTACK',g:'GRAND OFFENSIVE'};
const ownerName=(w,id)=>w.o[id]==='p'?'PARASITE-HELD':'HUMANITY';
function label(e,w){const t=W().BY[e.t];if(e.go||e.k==='g')return 'GRAND OFFENSIVE · '+(w.go?.t?.length||3)+' TERRITORIES';if(e.k==='c')return 'LDF COUNTERATTACK · '+t.name;return (t.heart?'RAID ON ':'ASSAULT ON ')+t.name;}
function action(e){return e.k==='c'?'JOIN THE COUNTERATTACK':e.go||e.k==='g'?'START THE DEFENSE':'DEFEND';}
// the six-sector Frontline and the Moon, side by side, never mixed
function counts(s){const w=s?.war,F=W().frontline(s?.territory);return {moon:w?W().humanHeld(w):16,of:20,parasite:w?W().parasiteHeld(w):4,front:F.held,frontOf:F.of};}
// ---- the board ----------------------------------------------------------------------------------------------------------------
function board(host,s,o,now){const WR=W(),w=s.war,box=o.el('div','wm-board',null,host),g=svg('svg',{viewBox:'0 0 1000 760',class:'wm-svg',role:'group','aria-label':'War Map: 20 territories, humanity in cyan, the Parasites in magenta'},box);
 svg('rect',{x:0,y:0,width:1000,height:760,class:'wm-bg'},g);
 // ring bands behind the board (the danger rises to the east)
 const edges=svg('g',{class:'wm-edges'},g),routes=svg('g',{class:'wm-routes'},g),nodes=svg('g',{class:'wm-nodes'},g),seen=new Set();
 for(const t of WR.TERRITORIES)for(const n of WR.ADJ[t.id]){const k=[t.id,n].sort().join('-');if(seen.has(k))continue;seen.add(k);const u=WR.BY[n],front=w.o[t.id]!==w.o[n];
  svg('line',{x1:t.mx,y1:t.my,x2:u.mx,y2:u.my,class:'wm-edge'+(front?' wm-front':'')},edges);}
 // dropships in flight (an airborne assault flies from the portal's territory; Session 7-V draws the real ships in the world)
 for(const d of WR.dropships(w,now)){const from=WR.BY[w.por.at]||WR.BY.east,to=WR.BY[w.ev.find(e=>e.id===d.id)?.t];if(!to)continue;svg('line',{x1:from.mx,y1:from.my,x2:to.mx,y2:to.my,class:'wm-route'},routes);}
 const next=WR.nextOrder(w,now),go=w.go&&!w.go.done?w.go:null;
 for(const t of WR.TERRITORIES){const own=w.o[t.id],ev=w.ev.find(e=>e.t===t.id),goT=go&&go.t.includes(t.id),sel=o.sel===t.id,isNext=next&&next.t===t.id;
  const cls='wm-t ring-'+t.ring+(own==='p'?' wm-p':' wm-h')+(!t.ex&&!t.inner?' wm-new':'')+(t.heart?' wm-heart':'')+(sel?' wm-sel':'')+(isNext?' wm-next':'')+(ev?' wm-ev wm-ev-'+ev.k:'')+(goT?' wm-go':'');
  const n=svg('g',{class:cls,transform:'translate('+t.mx+' '+t.my+')',tabindex:0,role:'button','data-t':t.id},nodes);
  const what=[t.name,WR.RINGS[t.ring],own==='p'?'held by the Parasites':'held by humanity',!t.ex&&!t.inner?'safe ground (opens later)':'',ev?(ev.k==='c'?'LDF counterattack':'assault')+' lands in '+left(ev.l*WR.WAR.tickMs-now):'',w.f[t.id]?'fortification '+w.f[t.id]:''].filter(Boolean).join(', ');
  n.setAttribute('aria-label',what);svg('title',{},n).textContent=what;
  if(isNext)svg('circle',{r:66,class:'wm-pulse'},n);svg('circle',{r:58,class:'wm-hit'},n);svg('circle',{r:t.inner?44:t.heart?40:36,class:'wm-disc'},n);
  if(t.id==='town')svg('path',{d:'M-14 6 L0 -10 L14 6 L14 16 L-14 16 Z',class:'wm-glyph'},n);
  else if(t.id==='citadel')svg('path',{d:'M-14 14 L-14 -4 L-7 -4 L-7 -12 L0 -6 L7 -12 L7 -4 L14 -4 L14 14 Z',class:'wm-glyph'},n);
  // fortification pips (five), the entrenchment ring, the portal
  const f=w.f[t.id]||0;if(t.cap&&own==='h')for(let i=0;i<5;i++)svg('rect',{x:-24+i*10,y:24,width:7,height:7,class:'wm-pip'+(i<f?' on':'')},n);
  if((w.en[t.id]||0)>now)svg('circle',{r:46,class:'wm-entrench'},n);
  if(w.por.at===t.id)svg('circle',{r:16,cy:-2,class:'wm-portal'+(WR.portalOpen(w,now)?' open':'')},n);
  const txt=svg('text',{y:t.inner?66:58,class:'wm-label'},n);txt.textContent=t.short;
  if(ev||goT){const b=svg('g',{class:'wm-badge',transform:'translate(30 -34)'},n);svg('circle',{r:17},b);const tt=svg('text',{y:7},b);tt.textContent=goT?'★':ev.k==='c'?'↺':'!';}
  const pick=()=>o.pick(t.id);n.addEventListener('click',pick);n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}});}
 const lg=o.el('p','wm-legend','',box);lg.innerHTML='<i class="h"></i>HUMANITY <i class="p"></i>PARASITES <i class="n"></i>SAFE GROUND <b>!</b> ASSAULT <b>↺</b> COUNTERATTACK <b>★</b> OFFENSIVE <b>▪</b> FORTIFIED';
 return box;}
// ---- the NEXT ORDER (one highlighted order; the button first on a phone) ---------------------------------------------------------
function nextCard(host,s,o,now){const WR=W(),w=s.war,e=WR.nextOrder(w,now),c=o.el('section','wm-next-card',null,host);
 if(!e){const k=WR.tickOf(now)+1,wait=k*WR.WAR.tickMs-now;o.el('p','wm-kicker','NEXT ORDER',c);o.el('p','wm-quiet','No fight inbound right now. The next war turn is in '+left(wait)+'.',c);coach(c,s,o);return c;}
 const O=WR.odds(w,e.go?{k:'a',t:e.t,g:e.g,air:1,ds:1,go:1}:e,ctxOf(s,now)),t=WR.BY[e.t];
 o.el('p','wm-kicker','NEXT ORDER · '+(firstOffensive(w,e)?'THE FIRST OFFENSIVE':EV_NAME[e.go?'g':e.k]),c);o.el('h3','wm-next-title',label(e,w),c);if(firstOffensive(w,e))o.el('p','wm-coach','The Parasites\' first offensive: a dropship lands a foothold. Beat it in person, or the LDF will have to take it back.',c);
 o.el('p','wm-time',(e.k==='c'?'The LDF attacks in ':'Lands in ')+left(e.l*WR.WAR.tickMs-now),c);if(O)o.el('p','wm-odds',O.line,c);
 const pay=e.go?WR.battlePoints('go',e.t):WR.battlePoints(e.k==='c'?'c':'a',e.t);o.el('p','wm-pay','WIN IT IN PERSON: '+fmtN(pay)+' base airdrop points × your league × your Command Base, spoils, '+(e.k==='c'?'the territory back, entrenched 24 h':t.heart?'the colony spared':'24 h entrenched')+'. One attempt: lose or leave and the strength roll decides it.',c);
 c.append(o.button(action(e),()=>o.defend(e),'wm-go-btn cq-enter'));return c;}
// the Fortify introduction (blueprint §3: the first offensive introduces counterattacks and Fortify): until the first fortification
function coach(c,s,o){const w=s.war;if(w.sc?.fort&&!Object.keys(w.f||{}).length&&!(w.jobs||[]).length)o.el('p','wm-coach','NEW · FORTIFY: tap a territory you hold, then FORTIFY. +1 DEFENSE a level, and supply for your town on the Frontier and the Warfront.',c);}
const firstOffensive=(w,e)=>!!(e&&e.k==='a'&&e.air&&w.sc?.f1===e.t&&!w.sc?.done);
// ---- a territory's card (detail only on tap) -----------------------------------------------------------------------------------
function territoryCard(host,s,o,now,id){const WR=W(),w=s.war,t=WR.BY[id],c=o.el('section','wm-card wm-terr',null,host),own=w.o[id],ev=w.ev.find(e=>e.t===id),goT=w.go&&!w.go.done&&w.go.t.includes(id);
 const top=o.el('div','wm-card-top',null,c);o.el('p','wm-kicker',WR.RINGS[t.ring]+' · '+(own==='p'?'PARASITE-HELD':t.heart?'HEARTLAND · NEVER CAPTURED':'HUMANITY'),top);top.append(o.button('BACK TO THE MAP',()=>o.pick(null),'wm-back'));
 o.el('h3','',t.name,c);o.el('p','wm-what',t.what||'',c);coach(c,s,o);
 const tf=WR.terraOf(w,id);o.el('p','wm-terra wm-terra-'+(tf.level<0?'blight':tf.level>0?'green':'barren'),'LAND · '+tf.name,c);
 if(!t.ex&&!t.inner){o.el('p','wm-note','Safe human ground: its fields open with a later update, so the Parasites cannot reach it yet. You can fortify it now for later.',c);}
 if(t.inner){o.el('p','wm-note','The Inner Ring never falls. '+(id==='citadel'?'The Citadel\'s siege arrives with the Citadel update.':'Five-star generals hold it.'),c);const gens=WR.GENERALS.filter(g=>g.stars>=4);o.el('p','wm-gen','COMMANDERS · '+gens.map(g=>g.name+' '+'★'.repeat(g.stars)).join(' · '),c);}
 // the event first: the odds line, then what makes it up
 const e=ev||(goT?{id:'go'+w.go.w,k:'g',t:id,g:w.go.g,go:1,l:w.go.end}:null);
 if(e){const O=WR.odds(w,e.go?{k:'a',t:id,g:e.g,air:1,ds:1,go:1}:e,ctxOf(s,now)),b=o.el('div','wm-event wm-event-'+(e.go?'g':e.k),null,c),open=!e.go||w.go.open*WR.WAR.tickMs<=now;
  o.el('p','wm-event-k',EV_NAME[e.go?'g':e.k]+(e.air?' · DROPSHIP LANDING':'')+' · '+(open?'LANDS IN '+left(e.l*WR.WAR.tickMs-now):'OPENS IN '+left(w.go.open*WR.WAR.tickMs-now)),b);
  if(O){o.el('p','wm-odds',O.line,b);const parts=O.kind==='c'?[...O.a.parts.map(p=>['+',p]),...O.h.parts.map(p=>['−',p])]:[...O.d.parts.map(p=>['+',p]),...O.th.parts.map(p=>['−',p])];const ul=o.el('ul','wm-parts',null,b);for(const [sign,p] of parts)o.el('li',sign==='+'?'wm-plus':'wm-minus',(sign==='+'?(O.kind==='c'?'LDF ':'DEFENSE '):(O.kind==='c'?'HOLD ':'THREAT '))+p.label+' '+(p.v>0?'+':'')+p.v,ul);}
  const g=WR.GEN[e.g];if(g){o.el('p','wm-gen','LED BY '+g.name+' '+'★'.repeat(g.stars)+' · '+g.pattern.toUpperCase()+' DOCTRINE'+(w.tro[g.id]?' · TROPHY TAKEN':' · BEAT HIM IN PERSON FOR HIS TROPHY'),b);}
  if(e.tr)o.el('p','wm-used','You fought it: the strength roll decides it when it lands.',b);else if(open)b.append(o.button(action(e),()=>o.defend(e),'wm-go-btn cq-enter'));
  if(t.cap||e.k==='c')station(c,s,o,now,id);}
 else if(own==='p'&&t.ex&&!t.inner){const H=WR.holdOf(w,id,ctxOf(s,now)),A=WR.ldfOf(w,id,ctxOf(s,now));o.el('p','wm-odds','HOLD '+H.total+' · the LDF would retake it '+pct(WR.chance(A.total-H.total))+' of the time.'+(t.sector?' Win a raid here to weaken the hold (−1 for 48 h, up to −2)'+(w.por.at===id?' and shut its portal for 48 h':'')+'.':' Wait for the LDF\'s counterattack and join it.'),c);
  if(o.raid&&t.sector)c.append(o.button('RAID '+t.short,()=>o.raid(t.sector),'wm-act'));}
 else if(own==='h'&&t.ex&&!t.town){const D=WR.defenseOf(w,id,ctxOf(s,now));o.el('p','wm-odds','DEFENSE '+D.total+' today ('+D.parts.map(p=>p.label.toLowerCase()+' '+p.v).join(', ')+'). No assault inbound.',c);if((w.en[id]||0)>now)o.el('p','wm-entrenched','ENTRENCHED · no assault can target it for '+left(w.en[id]-now),c);}
 // Fortify (decision 6)
 if(t.cap&&own==='h')fortify(c,s,o,now,id);
 // what holding it gives (decision 10)
 const gives=[];if(t.ring===3||t.ring===4)gives.push('SUPPLY: +0.4% town production (materials and CP) per fortification level while held: now +'+(Math.round(4*(w.f[id]||0))/10)+'%, +2% at level 5');if(t.sector)gives.push((s.territory?.[t.sector]?.owner==='humanity'?'its fast-travel node (your Frontline holds it)':'its fast-travel node once you secure its Frontline sector'));if(WR.APPROACH.includes(id))gives.push('FRONT readiness: an approach to the Citadel');if(t.ex&&!t.inner&&!t.town)gives.push('its veins and missions, safe to work while held');
 if(gives.length){o.el('p','wm-kicker','HOLDING IT GIVES',c);const ul=o.el('ul','wm-gives',null,c);for(const x of gives)o.el('li','',x,ul);}
 return c;}
function fortify(c,s,o,now,id){const WR=W(),w=s.war,t=WR.BY[id],F=WR.WAR.fortify,lv=w.f[id]||0,job=w.jobs.find(j=>j.t===id),b=o.el('div','wm-fort',null,c);
 o.el('p','wm-kicker','FORTIFY · LEVEL '+lv+' / '+F.max+' · +1 DEFENSE A LEVEL',b);
 if(job){o.el('p','wm-job','BUILDING LEVEL '+job.l+' · READY IN '+left(job.ready-now),b);return;}
 if(lv>=F.max){o.el('p','','Fully fortified. An assault decided by the strength roll wears it down a level; a defense you win in person keeps it.',b);return;}
 const pass=false,re=lv+1<=(w.pk[id]||0),price=WR.fortifyCost(id,lv+1,pass,re),L=s.ledger||{},have={cp:L.cp||0,alloy:L.banked?.alloy||0,helium:L.banked?.helium||0},short=['cp','alloy','helium'].filter(k=>have[k]<price[k]),busy=w.jobs.length>=WR.fortifySlots(pass);
 o.el('p','wm-price',(re?'REBUILD (a quarter of the price) · ':'')+fmtN(price.cp)+' CP · '+fmtN(price.alloy)+' ALLOY · '+fmtN(price.helium)+' HE-3 · '+left(WR.fortifyTime(lv+1,pass)),b);
 const btn=o.button(busy?'ONE FORTIFICATION AT A TIME':short.length?'NEED MORE '+short.map(k=>k==='helium'?'HE-3':k.toUpperCase()).join(' + '):'FORTIFY TO LEVEL '+(lv+1),()=>o.act('war-fortify',{t:id}),'wm-act');btn.disabled=busy||!!short.length;b.append(btn);
 o.el('small','wm-fine','Banked resources only. A fallen territory loses its fortification. Lunar Pass (when the store opens): a second slot, 20% cheaper, 20% faster.',b);}
// Station (decision 7): up to two reserve pilots on a threatened territory, DEFENSE from their rating, up to +1 for the pair
function station(c,s,o,now,id){const WR=W(),BT=root.ConquestBattalion,w=s.war,bat=s.bat||{},pilots=bat.p||[];if(!BT||!pilots.length)return;const b=o.el('div','wm-station',null,c);
 const lv=Object.values(s.plot?.b||{}).reduce((m,x)=>x?.t==='hangar'?Math.max(m,x.l|0):m,0),fielded=new Set(BT.picked(bat,lv,'battalion').map(p=>p.id)),here=w.st[id]||[],elsewhere=new Set(Object.entries(w.st).filter(([k])=>k!==id).flatMap(([,v])=>v));
 const res=pilots.filter(p=>!fielded.has(p.id)&&!elsewhere.has(p.id)&&p.h!==.5);o.el('p','wm-kicker','STATION RESERVES · '+here.length+' / '+WR.WAR.station.max+' · +'+WR.stationValue(pilots,here)+' DEFENSE',b);
 if(!res.length&&!here.length){o.el('p','wm-fine','Reserves are roster pilots your Hangar does not field. Recruit more pilots to station them here (free; they come back when it is decided).',b);return;}
 const pick=new Set(here),row=o.el('div','wm-reserves',null,b);
 for(const p of res){const on=pick.has(p.id),btn=o.button((on?'✓ ':'')+p.cs+' · '+(p.r?(BT.ROLE_INFO[p.r]?.n||p.r).toUpperCase():'WINGMAN')+' · RANK '+(p.rk|0||1),()=>{if(pick.has(p.id))pick.delete(p.id);else if(pick.size<WR.WAR.station.max)pick.add(p.id);o.act('war-station',{t:id,p:[...pick]});},'wm-pilot'+(on?' on':''));btn.setAttribute('aria-pressed',on?'true':'false');row.append(btn);}
 o.el('small','wm-fine','Free. They return when the battle is decided. A stationed pilot cannot garrison your town.'+(WR.BY[id].cap?' A stationed Lancer shoots down a landing dropship.':''),b);}
// ---- the campaign card (blueprint §2: the next Citadel tier and three readiness lines) ------------------------------------------
function campaignCard(host,s,o,now){const WR=W(),w=s.war,c=o.el('section','wm-card wm-campaign',null,host),held=WR.APPROACH.filter(id=>w.o[id]==='h').length;
 o.el('p','wm-kicker','THE CAMPAIGN · NEXT: CITADEL I · BREACH POINT',c);o.el('p','wm-what','The Citadel\'s first tier arrives with the Citadel update. Get ready: each line below is advice, never a lock.',c);
 const R=root.ConquestRating,Cb=root.ConquestCombat,band=Cb?.zoneBand?Cb.zoneBand(4):null,force=root.ConquestHangar?.force?.(s)||0,def=s.plot?.def|0;
 const line=(k,txt,ok,go)=>{const b=o.button((ok?'✓ ':'○ ')+txt,go||(()=>{}),'wm-ready'+(ok?' ok':''));if(!go||ok)b.disabled=!go;c.append(b);};
 line('front','FRONT · '+held+' / '+WR.APPROACH.length+' approach territories held ('+WR.APPROACH.map(id=>WR.BY[id].short).join(', ')+')',held>=WR.APPROACH.length,held>=WR.APPROACH.length?null:()=>o.pick(WR.APPROACH.find(id=>w.o[id]!=='h')||WR.APPROACH[0]));
 line('force','FORCE · '+(force?fmtN(force):'—')+(band?' (a Citadel assault fields your whole Battalion)':''),force>0,o.hangar||null);
 line('defense','DEFENSE · TOWN RATING '+(def?fmtN(def):'—'),def>0,o.town||null);
 return c;}
function goCard(host,s,o,now){const WR=W(),w=s.war,g=w.go;if(!g||g.done)return null;const c=o.el('section','wm-card wm-go-card',null,host),open=g.open*WR.WAR.tickMs<=now,G=WR.GEN[g.g];
 o.el('p','wm-kicker','GRAND OFFENSIVE · '+(open?'OPEN · ENDS IN '+left(g.end*WR.WAR.tickMs-now):'OPENS IN '+left(g.open*WR.WAR.tickMs-now)),c);
 o.el('h3','',(G?G.name+' '+'★'.repeat(G.stars)+' · ':'')+g.t.map(id=>WR.BY[id].name).join(' · '),c);
 o.el('p','wm-what','Dropships and a portal surge on '+g.t.length+' territories (+1 THREAT each). Start the defense when you are ready: win it and every target holds, entrenched, for '+fmtN(WR.battlePoints('go',g.t[0]))+' base airdrop points and spoils. Not started by the end of the window, it launches and each target is decided by strength.',c);
 if(g.tr)o.el('p','wm-used','You fought it: each target is decided by strength when the window ends.',c);else if(open)c.append(o.button('START THE DEFENSE · '+WR.BY[g.t[0]].short,()=>o.defend({id:'go'+g.w,k:'g',t:g.t[0],g:g.g,go:1,l:g.end}),'wm-go-btn cq-enter'));
 return c;}
// ---- the war alerts: on/off in settings, and the opt-in (decision 12) -----------------------------------------------------------
function pushSupport(){const nav=root.navigator||{},ua=nav.userAgent||'',ios=/iPad|iPhone|iPod/.test(ua)||nav.platform==='MacIntel'&&nav.maxTouchPoints>1,standalone=nav.standalone===true||!!root.matchMedia?.('(display-mode: standalone)').matches,tg=!!root.Telegram?.WebApp?.initData,web=typeof IN_WEB!=='undefined'&&!!IN_WEB;
 const api='serviceWorker' in nav&&'PushManager' in root&&'Notification' in root;return {ios,standalone,tg,web,api,can:web&&api&&(!ios||standalone),needsHome:web&&ios&&!standalone,perm:root.Notification?.permission||'default'};}
async function subscribe(o){const P=pushSupport();if(!P.can)return false;const perm=await root.Notification.requestPermission();if(perm!=='granted')return false;
 const reg=await root.navigator.serviceWorker.register('/web/sw.js',{scope:'/web/'});await root.navigator.serviceWorker.ready;const k=await (await fetch('/api/push-key')).json();if(!k?.key)return false;
 const raw=atob(k.key.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((k.key.length+3)%4)),key=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)key[i]=raw.charCodeAt(i);
 const sub=(await reg.pushManager.getSubscription())||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key}),j=sub.toJSON();
 return o.act('war-alerts',{push:{endpoint:j.endpoint,keys:{p256dh:j.keys.p256dh,auth:j.keys.auth}},tz:-new Date().getTimezoneOffset()});}
function alertsCard(host,s,o){const a=s.al||{},P=pushSupport(),c=o.el('section','wm-card wm-alerts',null,host);o.el('p','wm-kicker','WAR ALERTS · '+(a.on===0?'OFF':'ON')+(a.ask?'':' after your first war battle'),c);
 o.el('p','wm-what','At most 3 a day, never in your night, several events in one alert: only fights you can still join, and the Grand Offensive.'+(P.tg?' They come from the LUNAR bot in this chat: if you sent it /stop, send /start to get them again.':''),c);
 const row=o.el('div','wm-row',null,c);row.append(o.button(a.on===0?'TURN WAR ALERTS ON':'TURN WAR ALERTS OFF',()=>o.act('war-alerts',{on:a.on===0?1:0}),'wm-act'));
 if(a.ask&&a.on!==0&&P.can&&!(a.ps||[]).length&&P.perm!=='denied')row.append(o.button('ALERTS ON THIS DEVICE',async()=>{const ok=await subscribe(o).catch(()=>false);if(!ok)o.say?.('Alerts were not turned on for this browser.');},'wm-act'));
 if(P.needsHome)o.el('p','wm-fine','On iPhone and iPad, alerts work once LUNAR is on your Home Screen: tap Share, then Add to Home Screen, and open LUNAR from there.',c);
 if(P.perm==='denied')o.el('p','wm-fine','This browser blocks LUNAR\'s notifications: allow them in its site settings.',c);return c;}
// the one-time card after the first war battle (asked from a tap, never at signup)
function optInCard(host,s,o){const a=s.al||{},P=pushSupport();let seen=false;try{seen=localStorage.getItem('lunar-war-optin-v1')==='1';}catch(_){}
 if(!a.ask||a.on===0||seen||P.tg||(a.ps||[]).length||P.perm==='denied'||!(P.can||P.needsHome&&!a.home))return null;const c=o.el('section','wm-card wm-optin',null,host),done=()=>{try{localStorage.setItem('lunar-war-optin-v1','1');}catch(_){}c.remove();};
 if(P.needsHome){o.el('p','wm-kicker','WAR ALERTS ON YOUR IPHONE',c);o.el('p','wm-what','Add LUNAR to your Home Screen to get war alerts: tap Share, then Add to Home Screen. Open LUNAR from your Home Screen and turn alerts on there.',c);c.append(o.button('GOT IT',()=>{done();o.act('war-alerts',{home:1});},'wm-act'));return c;}
 o.el('p','wm-kicker','WAR ALERTS',c);o.el('p','wm-what','Get a heads-up when the Parasites announce an assault you can still stop. At most 3 a day, never at night.',c);
 const row=o.el('div','wm-row',null,c);row.append(o.button('TURN ON',async()=>{const ok=await subscribe(o).catch(()=>false);done();if(!ok)o.say?.('Alerts were not turned on for this browser.');},'wm-act cq-enter'),o.button('NOT NOW',done,'wm-act'));return c;}
// ---- the War Map --------------------------------------------------------------------------------------------------------------
function render(d,s,o){const WR=W();d.textContent='';d.classList.add('cq-warmap');const now=Date.now();if(!s?.war||!WR){o.el('p','wm-quiet','The War Map needs a connection to the game server.',d);d.append(o.button('CLOSE',o.close));return;}
 const n=counts(s),head=o.el('header','wm-head',null,d);head.append(o.button('CLOSE',o.close,'cq-lab-close-top wm-close'));o.el('p','cq-kicker','LUNAR / THE LIVING FRONT',head);o.el('h2','','WAR MAP',head);
 const chips=o.el('div','wm-chips',null,head);o.el('span','wm-chip wm-moon','MOON '+n.moon+' / '+n.of,chips).title='Territories humanity holds of all twenty';o.el('span','wm-chip wm-frontline','FRONTLINE '+n.front+' / '+n.frontOf,chips).title='The original six sectors you have secured';o.el('span','wm-chip wm-supply','SUPPLY +'+(Math.round(WR.supply(s.war)*1000)/10)+'% / 16%',chips).title='Town production from the Frontier and Warfront ground you fortify';
 o.el('p','wm-count-note','MOON: the twenty territories humanity holds. FRONTLINE: the six original sectors you have secured yourself.',head);
 const body=o.el('div','wm-body',null,d),top=o.el('div','wm-top-card',null,body),mapCol=o.el('div','wm-map-col',null,body),side=o.el('div','wm-side',null,body);
 // on a phone the next order (or the picked territory) and its button come first, above the board; on a computer they head the side column
 if(o.sel)territoryCard(top,s,o,now,o.sel);else{nextCard(top,s,o,now);optInCard(top,s,o);goCard(side,s,o,now);campaignCard(side,s,o,now);alertsCard(side,s,o);}
 board(mapCol,s,o,now);
 const m=o.el('p','cq-lab-msg wm-msg','',d);m.setAttribute('aria-live','polite');
 d.append(o.button('CLOSE',o.close,'cq-close-bottom'));}
// ---- the War Report ("While you were away"; blueprint §3: the first one on day 2 introduces the War Map) ------------------------
const RES={held:'held',lost:'fell to the Parasites',retaken:'retaken',raided:'raided: blight spreads',defended:'defended by you',beaten:'beaten back by you',failed:'counterattack failed',stalled:'counterattack stalled',frozen:'the front held while you were away',announced:'announced'};
function reportItems(s){const WR=W(),w=s.war;return WR.report(w,Date.now()).items.filter(x=>x.r!=='announced').map(x=>{const t=WR.BY[x.t],g=WR.GEN[x.g];
 if(x.r==='frozen')return {c:'wm-r-hold',t:'THE FRONT HELD while you were away (a full day away freezes the war).'};
 const who=x.by==='you'?'YOU':x.by==='ldf'?'THE LDF':x.by==='limit'?'THE LDF (REINFORCED)':'';const what=(x.k==='c'?'LDF counterattack on ':x.k==='g'?'Grand Offensive on ':'')+(t?t.name:'')+': '+(x.r==='held'&&who?who+' HELD IT':RES[x.r]||x.r)+(x.w?' · fortification worn down a level':'')+(g&&x.k!=='c'?' · '+g.name:'');
 return {c:x.r==='lost'||x.r==='raided'||x.r==='failed'?'wm-r-loss':x.r==='retaken'||x.r==='defended'||x.r==='beaten'?'wm-r-win':'wm-r-hold',t:what};});}
function shouldReport(s){const WR=W();if(!WR||!s?.war)return false;return WR.report(s.war,Date.now()).fresh;}
function report(d,s,o){const WR=W(),w=s.war,now=Date.now(),R=WR.report(w,now);d.textContent='';d.classList.add('cq-warreport');
 d.append(o.button('CLOSE',o.done,'cq-lab-close-top'));o.el('p','cq-kicker','LUNAR / WAR REPORT',d);o.el('h2','','WHILE YOU WERE AWAY',d);
 const n=counts(s);o.el('p','wm-chips-line','MOON '+n.moon+' / '+n.of+' · FRONTLINE '+n.front+' / '+n.frontOf,d);
 const ul=o.el('ul','wm-report',null,d);for(const it of reportItems(s).slice(-8))o.el('li',it.c,it.t,ul);if(!ul.children.length)o.el('li','wm-r-hold','Quiet on every front.',ul);
 if(R.inbound.length){o.el('p','wm-kicker','INBOUND',d);const ib=o.el('ul','wm-report',null,d);for(const e of R.inbound.slice(0,4))o.el('li','wm-r-in',label(e,w)+' · '+(e.k==='c'?'the LDF attacks in ':'lands in ')+left(e.l*WR.WAR.tickMs-now),ib);}
 if(R.next){o.el('p','wm-kicker','YOUR ORDER',d);const O=WR.odds(w,R.next.go?{k:'a',t:R.next.t,g:R.next.g,air:1,ds:1,go:1}:R.next,ctxOf(s,now));if(O)o.el('p','wm-odds',O.line,d);d.append(o.button(action(R.next)+' · '+WR.BY[R.next.t].short,()=>{o.done();o.defend(R.next);},'wm-go-btn cq-enter'));}
 d.append(o.button('OPEN THE WAR MAP',()=>{o.done();o.map();},R.next?'wm-act':'wm-act cq-enter'));}
// after a war battle lost or left in person (decision 3): nothing falls now; the strength roll decides it when it lands
function lostLine(d,s,o,op){const WR=W();if(!WR||!s?.war||!op?.war)return;const w=s.war,now=Date.now(),e=op.war==='c'?w.ev.find(x=>x.k==='c'&&x.t===op.territory):w.ev.find(x=>x.k==='a'&&x.t===op.territory)||(w.go&&!w.go.done&&w.go.t.includes(op.territory)?{k:'a',t:op.territory,g:w.go.g,air:1,ds:1,go:1,l:w.go.end}:null);
 const O=e?WR.odds(w,e,ctxOf(s,now)):null;o.el('p','wm-lost','ATTEMPT SPENT · NOT LOST YET'+(e?': the strength roll decides it when it lands in '+left(e.l*WR.WAR.tickMs-now)+(O?' · '+(e.k==='c'?'the LDF retakes it ':'it holds ')+pct(O.p)+' of the time':''):'')+'. Fortify or station reserves before then to raise the odds.',d);
 if(o.map)d.append(o.button('OPEN THE WAR MAP',o.map,'wm-act'));}
// ---- the hub's WARFRONT card and the HUD's NEXT ORDER -------------------------------------------------------------------------
function hubLines(card,s,o){const WR=W();if(!WR||!s?.war)return;const n=counts(s),now=Date.now(),e=WR.nextOrder(s.war,now);
 o.el('p','cq-hub-big','MOON '+n.moon+' / '+n.of+' · FRONTLINE '+n.front+' / '+n.frontOf,card);
 if(e)o.el('small','cq-hub-alert','⚠ '+label(e,s.war)+' · '+(e.k==='c'?'the LDF attacks in ':'lands in ')+left(e.l*WR.WAR.tickMs-now),card);
 else o.el('small','','No fight inbound. Next war turn in '+left((WR.tickOf(now)+1)*WR.WAR.tickMs-now)+'.',card);}
// the NEXT chip's war order (the single guidance channel): the most urgent fight you can still join, as an operation to drive to
function nextOp(s,now=Date.now()){const WR=W(),C=root.ConquestCombat;if(!WR||!s?.war||!C)return null;const e=WR.nextOrder(s.war,now);if(!e)return null;const id=WR.opOf(e.go?{k:'a',t:e.t}:e),op=C.operations[id];if(!op)return null;const t=WR.BY[e.t];return {...op,warEvent:e.id,warLeft:e.l*WR.WAR.tickMs-now,line:'WAR · '+(e.k==='c'?'JOIN THE LDF AT '+t.short+' · attacks in ':(t.heart?'RAID ON ':'ASSAULT ON ')+t.short+' · lands in ')+left(e.l*WR.WAR.tickMs-now)+' · follow the beacon'};}
// an alert's button (Telegram's web_app link or the website notification: ?war=1) or the service worker's focus message opens the War
// Map: Conquest opens, then the War Map over its page (js/conquest/app.js hub() takes the flag once)
let pendingMap=false;try{pendingMap=new URLSearchParams(root.location?.search||'').get('war')==='1';}catch(_){}
try{root.navigator?.serviceWorker?.addEventListener?.('message',e=>{if(e.data?.lunar==='war-map'){pendingMap=true;if(root.Conquest&&!root.Conquest.active)root.Conquest.open();else root.ConquestWarMap.onPending?.();}});}catch(_){}
const takePending=()=>{const v=pendingMap;pendingMap=false;return v;};
// opened from an alert (?war=1): once the account is ready, open Conquest (its page then opens the War Map); gives up after 30 s
if(pendingMap&&root.setInterval){let n=0;const t=root.setInterval(()=>{n++;const ready=root.Conquest&&typeof ACCOUNT_OK!=='undefined'&&ACCOUNT_OK;if(ready||n>60||!pendingMap){root.clearInterval(t);if(ready&&pendingMap&&!root.Conquest.active)try{root.Conquest.open();}catch(_){}}},500);}
root.ConquestWarMap={render,report,shouldReport,hubLines,nextOp,counts,pushSupport,subscribe,label,left,takePending,lostLine,want:()=>{pendingMap=true;},get pending(){return pendingMap;},onPending:null};
})(globalThis);
