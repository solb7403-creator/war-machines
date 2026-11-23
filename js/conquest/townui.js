/* Session 7T Living Town: the town attack screens (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md). Read-only views of the
   Worker's state (s.tw the town attacks and their log, s.td the live defense, s.bcn the Strike Beacon, s.stk the streak, s.bat the
   battalion, s.al the alert settings); every change is a Conquest action through ctx.act (the Worker decides it). Phone and computer
   alike: every row is a plain button (tap or click; Enter and Space on a focused button), and the overlays fit or scroll.
   - hubLines: RAID INCOMING · DEFEND IN PERSON (with the 60-second last chance), RAIDED while away · HELD / BREACHED · REPLAY ·
     REPAIR ALL, the shield and the Peace Ward;
   - beaconLine: STRIKE BEACON READY · site · CALL THE STRIKE (and its 20 minutes);
   - streakLine: the soft return streak, one line, no modal;
   - lastChance: the 60-second RAID INCOMING · DEFEND? overlay, wherever the pilot is in Conquest;
   - replay: the unfought raid re-run from its seed on the phone (js/conquest/raid.js, the Worker's engine), shown in the town;
   - liveHud: the live defense (the town view drives the tank; this HUD: time, raiders, FIRE, LEAVE);
   - gearPicker: the Hangar's per-pilot weapon and chassis (decision 8), with the item's and the pilot's resulting stats;
   - alertSwitches: the per-type alert switches (decision 9). */
(function(root){
'use strict';
const TN=()=>root.ConquestTown,WR=()=>root.ConquestWar,P=()=>root.ConquestPlot,RD=()=>root.ConquestRaid,BT=()=>root.ConquestBattalion,AL=()=>root.ConquestAlerts;
const pad=n=>String(n).padStart(2,'0');
function t2(ms){const v=Math.max(0,Math.ceil(ms/1000)),h=Math.floor(v/3600),m=Math.floor(v%3600/60),s=v%60;return h?h+':'+pad(m)+':'+pad(s):m+':'+pad(s);}
const stars=n=>'★'.repeat(Math.max(0,n|0));
const genOf=g=>WR()?.GEN?.[g]||null;
const SIDE={n:'NORTH',e:'EAST',s:'SOUTH',w:'WEST'};
function sideOf(s,e){const S=P()?.SITES?.[s?.plot?.site],L=S?.lanes||[];return L.length?SIDE[L[(e.ln|0)%L.length].s]||'':'';}
const OUT={held:'HELD',breached:'BREACHED',fallen:'OVERRUN',called:'CALLED OFF'};
function lossText(x){const k=x?.tk||{},n={alloy:'ALLOY',biomass:'BIOMASS',helium:'HELIUM-3',fe:'FERRITE',cm:'COMPOSITE'},parts=Object.entries(k).map(([a,v])=>'−'+v+' '+(n[a]||a.toUpperCase()));return parts.join(' · ');}
// the latest results the pilot has not read yet (held raids appear here and in the War Report only: decision 9)
function unseen(s){const tw=s?.tw;if(!tw)return [];return (tw.log||[]).filter(x=>x.at>(tw.seen|0)&&x.o!=='called').sort((a,b)=>b.at-a.at);}
// ---- the hub's town lines ------------------------------------------------------------------------------------------------------------
// card: the hub's YOUR BASE card; o: {el, button, act(action, fields), repair(), replay(), defend(id), now}
function hubLines(card,s,o){const T=TN();if(!T||!s?.plot||!s?.base?.tier)return;const {el,button}=o,now=o.now||Date.now(),tw=s.tw||{ev:[],log:[]},Tk=WR()?.WAR?.tickMs||21600000,p=s.plot;
 const box=el('div','cq-town',null,card);box.setAttribute('aria-label','Town attacks');
 if(s.td?.active){el('p','cq-town-live','⚔ DEFENDING YOUR TOWN · '+t2(now-(s.td.t0||now))+' IN',box);if(o.defend)box.append(button('RETURN TO THE FIGHT',()=>o.defend(s.td.id),'cq-town-go'));return;}
 const open=T.defendable(tw,now).sort((a,b)=>(a.lc||a.l*Tk)-(b.lc||b.l*Tk));
 for(const e of open.slice(0,2)){const G=genOf(e.g),lc=!!(e.lc&&e.lc>now),left=(lc?e.lc:e.l*Tk)-now;let lv=0;try{lv=T.strength(s.war,e,{now,tiers:0}).level;}catch(_){}
  const row=el('div','cq-town-row cq-town-incoming'+(lc?' cq-town-lc':''),null,box);
  el('p','cq-town-head',(lc?'⚠ RAID INCOMING · DEFEND? ':'⚠ RAID INCOMING · LANDS IN ')+t2(left),row);
  el('small','',(G?G.name+' '+stars(G.stars)+' · ':'')+'RAID LEVEL '+lv+(sideOf(s,e)?' · MAIN FORCE FROM THE '+sideOf(s,e):'')+(e.go?' · GRAND OFFENSIVE TARGET':'')+(e.first?' · YOUR FIRST RAID: a scouting party':''),row);
  el('small','cq-town-why',lc?'It lands now. Fight beside your turrets, or your garrison and turrets hold it alone.':'Away, your turrets and garrison fight it. Defend in person: the better result counts, and a held defense pays defense points.',row);
  if(o.act||o.defend){const b=button('DEFEND IN PERSON',()=>o.defend?o.defend(e.id):o.act('town-defend',{id:e.id}),'cq-town-defend');b.setAttribute('aria-label','Defend your town in person: raid lands in '+t2(left));row.append(b);}}
 // raided while away
 const fresh=unseen(s).filter(x=>x.by==='away');
 if(fresh.length){const x=fresh[0],G=genOf(x.g),row=el('div','cq-town-row cq-town-raided cq-town-'+x.o,null,box);
  el('p','cq-town-head','RAIDED WHILE AWAY · '+OUT[x.o]+(fresh.length>1?' · +'+(fresh.length-1)+' MORE':''),row);
  el('small','',(G?G.name+' '+stars(G.stars)+' · ':'')+'LEVEL '+x.lv+' · '+x.k+'/'+x.sp+' RAIDERS DOWN'+(x.o==='held'&&x.cache?' · DEFENSE CACHE +160 CP':'')+(x.o!=='held'?' · '+(lossText(x)||'nothing taken')+' · 8 H SHIELD':'')+(x.dn?' · '+x.dn+' GARRISON PILOT'+(x.dn>1?'S':'')+' AT HALF HULL':''),row);
  const btns=el('div','cq-town-btns',null,row);
  if(o.replay&&s.tw?.rp?.id===x.id&&s.tw.rp.by==='away')btns.append(button('REPLAY',()=>o.replay(),'cq-town-replay'));
  if(o.repair&&Object.keys(p.dmg||{}).length)btns.append(button('REPAIR ALL',()=>o.repair(),'cq-town-repair'));
  if(o.act)btns.append(button('OK',()=>o.act('town-seen',{}),'cq-town-ok'));}
 if(Number(p.shieldUntil)>now)el('small','cq-town-shield','🛡 SHIELD UP · NO RAIDS FOR '+t2(p.shieldUntil-now),box);
 if((tw.ws|0)>0&&o.act){const r=el('div','cq-town-row cq-town-ward',null,box);el('small','','PEACE WARD ×'+tw.ws+' · a 24-hour shield (rare loot, never sold)',r);r.append(button('USE A PEACE WARD',()=>o.act('town-ward',{}),'cq-town-ward-go'));}
 if(!open.length&&!fresh.length){el('small','cq-town-quiet',(p.cc|0)<(T.TOWN.fromCC|0)?'Town attacks start at Command Center II.':'NO RAID INBOUND · every attack is announced here 12 h ahead, and in your alerts.',box);}}
// ---- the Strike Beacon (decision 10) ---------------------------------------------------------------------------------------------------
function beaconLine(card,s,o){const T=TN();if(!T)return;const {el,button}=o,now=o.now||Date.now();let b;try{b=T.beaconOf(s,now);}catch(_){return;}if(!b||(!b.ready&&!b.active&&!b.used))return;
 if(b.active){const row=el('div','cq-beacon cq-beacon-on',null,card);el('p','cq-hub-big','☄ STRIKE BEACON · '+(b.site?.name||'')+' · '+t2(b.until-now)+' LEFT',row);el('small','','Your called strike: the same waves, rewards and Resonance as the real one. Drive to the crater.',row);if(o.go)row.append(button('GO TO THE STRIKE',()=>o.go(b.site),'cq-beacon-go'));return;}
 if(b.ready){const row=el('div','cq-beacon',null,card);el('p','cq-hub-big','☄ STRIKE BEACON READY · '+(b.site?.name||''),row);el('small','','Once a UTC day: call this Meteor Strike now and fight it in the next 20 minutes.',row);if(o.act)row.append(button('CALL THE STRIKE',()=>o.act('strike-beacon',{}),'cq-beacon-call'));return;}
 el('small','cq-beacon-used','☄ Strike Beacon used today · recharges at 00:00 UTC',card);}
// ---- the soft return streak (decision 11): one line ---------------------------------------------------------------------------------
const REWARD={repair:'REPAIR KIT',scanner:'SCANNER CHARGE'};
function rewardName(r){if(r.it)return r.n===0?(REWARD[r.it]||r.it.toUpperCase())+' (YOURS ARE FULL)':'+'+(r.n??1)+' '+(REWARD[r.it]||r.it.toUpperCase());if(r.em){const a=TN()?.STREAK_ART?.emblems?.[r.em];return (a?a.glyph+' ':'')+(a?.n||'BANNER EMBLEM')+' (TOWN BANNER)';}if(r.dc){const a=TN()?.STREAK_ART?.decor?.[r.dc];return (a?.n||'TOWN DECORATION').toUpperCase()+' (TOWN ORNAMENT)';}return '';}
function streakLine(card,s,o){const T=TN();if(!T)return;const now=o.now||Date.now(),day=Math.floor(now/864e5),L=T.streakLine(s?.stk,day),{el}=o;
 const line=el('small','cq-hub-streak'+(L.today?' cq-on':''),'🔥 '+L.text,card);line.title='A day counts when you win an operation or harvest. Two freeze days a week cover missed days. Rewards are consumables and earn-only cosmetics, never points.';
 const nw=s?.stk?.nw;if(nw&&nw.d===day&&nw.r?.length)el('small','cq-hub-streak-new','DAY '+nw.n+' · '+nw.r.map(rewardName).join(' · '),card);}
// ---- the 60-second last chance (decision 1): wherever the pilot is in Conquest -------------------------------------------------------
let LC=null;
function lastChance(panel,s,o){const T=TN(),now=Date.now();const e=T&&s?.tw?(s.tw.ev||[]).find(x=>x.lc&&x.lc>now&&!x.tr):null;
 if(!e||s.td?.active||o.skip?.has(e.id)){if(LC){LC.d.remove();LC=null;}return;}
 const {el,button}=o;if(!LC||LC.id!==e.id){if(LC)LC.d.remove();const d=el('section','cq-dialog cq-town-lastchance',null,panel);d.setAttribute('role','alertdialog');d.setAttribute('aria-label','Raid incoming: defend your town?');
  const G=genOf(e.g);el('p','cq-kicker','YOUR TOWN',d);el('h2','','RAID INCOMING · DEFEND?',d);const clock=el('p','cq-town-lc-clock','',d);el('p','',(G?G.name+' '+stars(G.stars)+' · ':'')+'the attack is landing now. Fight beside your turrets and garrison: the better of your fight and theirs counts.',d);
  const row=el('div','cq-town-btns',null,d);const go=button('DEFEND · ONE ATTEMPT',()=>{o.act?.('town-defend',{id:e.id});},'cq-town-defend');row.append(go);row.append(button('LET THE TOWN FIGHT',()=>{o.skip?.add(e.id);d.remove();LC=null;},'cq-town-skip'));
  LC={id:e.id,d,clock};try{go.focus({preventScroll:true});}catch(_){}}
 LC.clock.textContent=t2(e.lc-now)+' LEFT';}
// ---- the replay: the Worker's unfought raid, re-run from its seed (the same engine, the town as it stood at the landing) ---------------
// done(result) gets the drill-shaped result (frames, events, units); progress(0..1) while it simulates (8 ms slices: never freezes)
function replay(s,done,progress){const R=RD(),T=TN(),rp=s?.tw?.rp;if(!R||!T||!rp||rp.by!=='away'||!rp.town)return false;let plot;try{plot=T.plotOfSnap(rp.town);}catch(_){return false;}
 const M=R.make(plot,rp.seed>>>0,{threat:rp.lv,lane:rp.ln,units:rp.u||[],damage:true,frames:true,events:true});
 const pump=()=>{const t=(root.performance||Date).now();while(!M.over&&(root.performance||Date).now()-t<8)M.step();if(!M.over){progress?.(Math.min(.99,M.time/(P()?.RAID?.maxT||130)));setTimeout(pump,0);return;}done({...M.result(),plot,rp});};pump();return true;}
// ---- the live defense HUD (decision 6): time, raiders left, FIRE, LEAVE ---------------------------------------------------------------
function liveHud(host,s,o){const {el,button}=o,td=s?.td;if(!td?.active){host.querySelector('.cq-town-hud')?.remove();host.querySelector('.cq-town-fire')?.remove();return null;}
 let h=host.querySelector('.cq-town-hud');if(!h){h=el('div','cq-town-hud',null,host);h.setAttribute('role','group');h.setAttribute('aria-label','Defending your town');
  h._line=el('p','cq-town-hud-line','',h);h.setAttribute('aria-live','polite');const row=el('div','cq-town-hud-btns',null,h);row.append(button('LEAVE THE FIGHT',()=>o.act?.('town-leave',{}),'cq-town-leave'));
  el('small','cq-town-hud-help',(root.matchMedia?.('(hover:hover) and (pointer:fine)').matches?'WASD or the arrows drive · hold SPACE or FIRE to shoot':'The stick drives · hold FIRE to shoot')+' · your garrison and turrets fight beside you',h);
  const fire=button('FIRE',()=>{},'cq-town-fire');fire.setAttribute('aria-label','Fire: hold to shoot');const hold=v=>e=>{e.preventDefault?.();e.stopPropagation?.();fire.classList.toggle('cq-on',v);o.fire?.(v);};
  fire.addEventListener('pointerdown',hold(true));for(const ev of ['pointerup','pointercancel','pointerleave'])fire.addEventListener(ev,hold(false));fire.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){hold(true)(e);}});fire.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){hold(false)(e);}});host.append(fire);}
 const st=td.st,foes=(st?.fo||[]).filter(f=>!f[10]).length,ui=(td.units||[]),me=(st?.un||[])[ui.findIndex(u=>u.id==='you')],gar=ui.filter(u=>u.k==='g').length,up=(st?.un||[]).filter((u,i)=>ui[i]?.k!=='p'&&!u[5]).length,t=Number(st?.t)||0;
 h._line.textContent='⚔ RAID LEVEL '+td.lv+' · '+t2(t*1000)+' · '+foes+' RAIDERS · '+(st?.k|0)+' DOWN'+(ui.length>1?' · ALLIES '+up+'/'+(ui.length-1):'')+(me?(me[5]?' · YOUR TANK IS DOWN, YOUR ALLIES FIGHT ON':' · HULL '+Math.max(0,Math.round(me[4]))):'');return h;}
// ---- the Hangar gear picker (decision 8): pick each pilot's spare weapon and chassis ---------------------------------------------------
function itemName(slot,it){if(!it)return 'MILITIA';const R2=root.RULES||{},W=typeof WEAPONS==='object'?WEAPONS:R2.WEAPONS,CHS=typeof CH==='object'?CH:R2.CH,T=['COMMON','RARE','EPIC'],d=slot==='w'?W?.[it.k]:CHS?.[it.k];return (d?.n||d?.name||String(it.k)).toUpperCase()+' · '+(T[it.t|0]||'T'+(it.t|0))+(it.s?' · ★':'');}
function kitWith(kit,slot,it){const k=JSON.parse(JSON.stringify(kit||{}));if(!it)return k;if(slot==='w')k.w={...(k.w||{}),a:it.k,t:it.t|0,q:it.q||1,...(it.s?{s:1}:{})};else k.c={...(k.c||{}),c:it.k,t:it.t|0,q:it.q||1,...(it.s?{s:1}:{})};delete k.mil;return k;}
function statLine(st){return st?st.dps+' DMG/S · '+st.hp+' HULL · '+st.spd+'% SPEED · POWER '+st.power:'';}
function gearPicker(d,s,p,ctx){const B=BT();if(!B||!s?.bat||!p)return null;const {el,button}=ctx,T=s.bat,free=B.spare(T.g,{w:T.own?.w,c:T.own?.c}),x=el('div','cq-bat-gear-pick',null,d);x.setAttribute('role','group');x.setAttribute('aria-label',p.cs+' gear');
 el('p','cq-kicker','GEAR · '+p.cs,x);const now=B.kitStats(p.kit,p.rk);el('small','cq-gear-now','NOW · '+statLine(now),x);
 for(const [slot,label] of [['w','WEAPON'],['c','CHASSIS']]){const sec=el('div','cq-gear-slot',null,x);el('b','',label,sec);const pinned=p.pin?.[slot]||'';
  sec.append(button((pinned?'':'✓ ')+'AUTO · AUTO-ARM picks',()=>ctx.act('hangar-gear',{pilot:p.id,[slot]:''}),'cq-gear-auto'+(pinned?'':' cq-on')));
  const list=free[slot]||[];if(!list.length)el('small','','No spare '+label.toLowerCase()+': everything you own is on your own tank or another pilot.',sec);
  for(const it of list){const key=B.keyOf(it),on=pinned===key,holder=T.p.find(o=>o!==p&&o.pin?.[slot]===key),after=B.kitStats(kitWith(p.kit,slot,it),p.rk);
   const r=el('div','cq-gear-item'+(on?' cq-on':''),null,sec);el('span','cq-gear-name',itemName(slot,it),r);el('small','cq-gear-after','THEN · '+statLine(after)+(now&&after?' ('+(after.power>=now.power?'+':'')+(after.power-now.power)+' POWER)':''),r);
   const b=button(on?'EQUIPPED':holder?'TAKE FROM '+holder.cs:'EQUIP',()=>ctx.act('hangar-gear',{pilot:p.id,[slot]:key}),'cq-gear-pick');b.disabled=on;r.append(b);}}
 el('small','cq-gear-rule','One pilot per item; your own tank keeps its gear. AUTO-ARM clears every pick.',x);return x;}
// ---- the per-type alert switches (decision 9) -----------------------------------------------------------------------------------------
function alertSwitches(c,s,o){const A=AL();if(!A)return;const sw=s?.al?.sw||{},{el,button}=o,box=el('div','cq-alert-types',null,c);el('p','wm-kicker','ALERT TYPES · AT MOST 3 A DAY, NEVER AT NIGHT, THE MOST URGENT FIRST',box);
 for(const t of A.TYPES){const on=sw[t]!==0,b=button((on?'✓ ':'✕ ')+A.NAMES[t],()=>o.act('war-alerts',{sw:{[t]:on?0:1}}),'cq-alert-type'+(on?' cq-on':''));b.setAttribute('aria-pressed',String(on));box.append(b);}
 el('small','','Alerts off stops every notification, the daily reminder too. On Telegram, /stop in the bot stops its messages.',box);}
// ---- deep links from an alert (?town=defend | repair | yield, ?beacon=1), taken once ------------------------------------------------
let pending=null;try{const q=new URLSearchParams(root.location?.search||'');pending=q.get('town')||(q.get('beacon')==='1'?'beacon':null);}catch(_){}
try{root.navigator?.serviceWorker?.addEventListener?.('message',e=>{const q=String(e.data?.q||'');if(!q)return;try{const u=new URLSearchParams(q);pending=u.get('town')||(u.get('beacon')==='1'?'beacon':pending);}catch(_){}});}catch(_){}
const takeLink=()=>{const v=pending;pending=null;return v;};
root.ConquestTownUI=Object.freeze({hubLines,beaconLine,streakLine,lastChance,replay,liveHud,gearPicker,alertSwitches,takeLink,unseen,t2,rewardName,get link(){return pending;}});
})(globalThis);
