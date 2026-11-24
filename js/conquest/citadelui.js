/* Session 7B Citadel Act I screens (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md): the campaign card on the War Map (the
   next tier, FRONT / FORCE / DEFENSE beside the tier's recommended band: advice, never a lock; the three siege prep objectives; LAUNCH;
   the first-clear rewards), Throne Run (this week's Gambits, each tier's chest, your best time, the clear-time board), the assault's HUD
   (the phase, its objective, the warden's shield core, the clock, the call-out, the LDF airstrike button) and the result card. Draws
   only: every change is a Worker action (worker/src/conquest-citadel.js). Phone and computer alike: every row is a real button
   (keyboard and touch), the card fits or scrolls inside the War Map. */
(function(root){
'use strict';
const CI=()=>root.ConquestCitadel,WR=()=>root.ConquestWar;
const fmtN=n=>Math.round(Number(n)||0).toLocaleString('en-US');
const left=ms=>{const m=Math.max(0,Math.ceil(ms/60000));return m>=60?Math.floor(m/60)+' H '+(m%60?m%60+' M':''):m+' M';};
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const stars=n=>'★'.repeat(Math.max(0,n|0));
const DESK=()=>!!(root.matchMedia?.('(hover:hover) and (pointer:fine)')?.matches);   // the key hint only where a keyboard and mouse are (command.js's test)
// ---- the campaign card (the War Map's side column) -------------------------------------------------------------------------------
function card(host,s,o,now){const C=CI(),c=C.norm(s?.cit),T=C.nextTier(c),R=C.ROMAN,box=o.el('section','wm-card wm-campaign cq-cit-card',null,host);box.setAttribute('aria-label','The Citadel campaign');
 o.el('p','wm-kicker',T?'THE CAMPAIGN · NEXT: CITADEL '+R[T.n]+' · '+T.name:'THE CAMPAIGN · ACT I · THE OUTER WORKS BROKEN',box);
 if(T){o.el('p','cq-cit-mech',T.mech+'. New Parasite: '+T.unitName+'. Rewards the '+T.role.toUpperCase()+' role.',box);
  o.el('p','cq-cit-warden',T.warden.name+' '+stars(T.warden.stars)+' · '+T.warden.tell+'. Only your tank breaks the shield core.',box);
  const line=(txt,ok,go,cls='')=>{const b=o.button((ok?'✓ ':'○ ')+txt,go||(()=>{}),'wm-ready'+(ok?' ok':'')+cls);if(!go||ok)b.disabled=!go;box.append(b);return b;};
  const W0=WR(),held=W0.APPROACH.filter(id=>s.war?.o?.[id]==='h').length,band=C.BANDS[T.n]||{force:[0,0],defense:[0,0]},force=root.ConquestHangar?.force?.(s)||0,def=s?.plot?.def|0;
  line('FRONT · '+held+' / '+W0.APPROACH.length+' approach territories held ('+W0.APPROACH.map(id=>W0.BY[id].short).join(', ')+') · needed to launch',held>=W0.APPROACH.length,held>=W0.APPROACH.length?null:()=>o.pick?.(W0.APPROACH.find(id=>s.war?.o?.[id]!=='h')||W0.APPROACH[0]));
  line('FORCE · '+(force?fmtN(force):'—')+' · recommended '+fmtN(band.force[0])+'-'+fmtN(band.force[1])+' (advice: a Citadel assault fields your whole Battalion)',force>=band.force[0],o.hangar||null);
  line('DEFENSE · TOWN RATING '+(def?fmtN(def):'—')+' · recommended '+fmtN(band.defense[0])+'-'+fmtN(band.defense[1])+' (advice: your town meets stronger raids after each tier)',def>=band.defense[0],o.town||null);
  // siege prep: three optional objectives, 48 h each
  const P=C.prepOf(s,now),prep=o.el('div','cq-cit-prep',null,box);o.el('p','wm-kicker','SIEGE PREP · OPTIONAL · EACH LASTS 48 H',prep);
  for(const k of ['aa','cv','po']){const Q=C.PREP[k],on=P[k],row=o.button((on?'✓ ':'○ ')+Q.name+' · '+(on?Q.short+' READY · '+left(P.until[k]-now)+' LEFT':Q.gives),()=>{if(on)return;if(k==='po')o.raid?.(s.war?.por?.at||'ash');else o.raidFamily?.(Q.family);},'cq-cit-prep-row'+(on?' ok':''));if(on)row.disabled=true;prep.append(row);}
  o.el('p','cq-cit-reward','FIRST CLEAR: +'+fmtN(C.bountyOf(T.n))+' airdrop points (once per account, outside the daily cap) · production +5% (materials and CP) · the warden\'s trophy · Retaliation '+R[T.n]+': attacks on your town and the front grow stronger.',box);
  const why=C.launchWhy(s,T.n,now),go=o.button(why?'○ '+why.toUpperCase():'LAUNCH THE ASSAULT · CITADEL '+R[T.n],()=>o.launch?.(T.n),'cq-enter cq-cit-launch');go.disabled=!!why||!o.launch;box.append(go);
  o.el('small','wm-fine','Breach, push, then the warden inside the '+mmss(C.CIT.limitS)+' siege window: 6-8 minutes with a full Battalion. A loss spends the siege prep it used; downed allies need repair; nothing else is taken.',box);}
 if(c.t>0)throne(box,s,o,now);
 return box;}
// ---- Throne Run (a cleared tier, the week's Gambits) ----------------------------------------------------------------------------------
function throne(box,s,o,now){const C=CI(),c=C.norm(s?.cit),w=C.weekOf(now),g=C.gambitsOf(w),R=C.ROMAN,t=o.el('div','cq-cit-throne',null,box);t.setAttribute('aria-label','Throne Run');
 o.el('p','wm-kicker','THRONE RUN · THIS WEEK\'S GAMBITS',t);
 const chips=o.el('div','cq-cit-gambits',null,t);for(const k of g){const G=C.GAMBITS[k];const x=o.el('span','cq-cit-gambit'+(G.bane?' bane':' boon'),G.name,chips);x.title=G.what;o.el('small','',' '+G.what,x);}
 for(let n=1;n<=c.t;n++){const T=C.TIERS[n],full=c.tr.ch[n]!==w,wk=c.wk[n]?.w===w?c.wk[n].ms:0,row=o.el('div','cq-cit-tier',null,t);
  o.el('p','',`CITADEL ${R[n]} · ${T.name} · ${full?'FULL CHEST READY':'REDUCED CHEST (this week\'s full chest is yours)'} · BEST THIS WEEK ${wk?mmss(wk/1000):'—'}`,row);
  const run=o.button('RUN CITADEL '+R[n],()=>o.launch?.(n),'cq-cit-run');run.disabled=!o.launch||!!C.launchWhy(s,n,now);row.append(run);if(o.board)row.append(o.button('BOARD',()=>o.board(n),'cq-cit-board-btn'));}
 o.el('small','wm-fine','One full chest per tier each UTC week, then the reduced chest. No siege prep in a Throne Run. Your clear time is the server\'s own clock.',t);}
// the clear-time board (rows from the Worker: {tier, w, top: [{n, ms, me}]})
function boardRows(host,doc,{el,button},close){const C=CI(),box=el('section','cq-cit-board',null,host);box.setAttribute('aria-label','Clear-time board');
 el('p','cq-kicker','THRONE RUN · CITADEL '+C.ROMAN[doc?.tier|0]+' · THIS WEEK',box);el('h2','','CLEAR TIMES',box);
 const rows=Array.isArray(doc?.top)?doc.top:[];if(!rows.length)el('p','cq-lab-why','No clear this week yet. Be the first: the par is '+C.CIT.par+':00.',box);
 const ol=el('ol','cq-cit-rows',null,box);rows.forEach((r,i)=>el('li',r.me?'me':'',(i+1)+'. '+String(r.n||'PILOT').slice(0,16)+' · '+mmss((r.ms|0)/1000),ol));
 el('small','wm-fine','The server times every run from its own record of your inputs: no clock on the phone counts.',box);if(close)box.append(button('CLOSE',close));return box;}
// ---- the assault HUD (the battle's own state; drawn every HUD tick) ----------------------------------------------------------------
function hud(host,view,{el,button}){const C=CI(),B=view?.battle;if(!B?.cit||!C){host.querySelector('.cq-cit-hud')?.remove();host.querySelector('#cq-strike')?.remove();return null;}
 const c=B.cit,T=C.TIERS[c.tier];let h=host.querySelector('.cq-cit-hud');
 if(!h){h=el('section','cq-cit-hud',null,host);h.setAttribute('aria-live','polite');h.setAttribute('aria-label','Citadel assault');el('p','cq-cit-hud-head','',h);el('p','cq-cit-hud-obj','',h);el('p','cq-cit-hud-say','',h);
  const air=button('LDF AIRSTRIKE',()=>{if(view.pendingAbilities)view.pendingAbilities.strike=true;},'cq-cit-air');air.id='cq-strike';host.append(air);}   // beside the ability buttons (thumb reach); the HUD strip itself never takes a tap
 const stage=['BREACH','PUSH','THE GENERAL','CLEARED'][c.stage]||'',live=B.enemies.filter(e=>e.hp>0&&!e.dormant),R=C.ROMAN;
 let obj='';
 if(c.stage===0)obj=T.gate==='shield'?'GATE GENERATORS '+live.filter(e=>e.cit==='gen').length+' / '+T.gens+' standing · the shield gate holds':'THE GATE '+fmtN(live.find(e=>e.cit==='gate')?.hp||0)+' / '+fmtN(C.CIT.gate.hp);
 else if(c.stage===1)obj=c.shipsMax?'DROPSHIPS '+c.ships+' / '+c.shipsMax+' · '+c.down+' SHOT DOWN · '+c.landed+' LANDED':'WAVES '+c.waves+' / '+c.wavesMax+' · '+live.filter(e=>e.wave&&!e.swarm&&!e.ship).length+' IN THE COURTYARD';
 else if(c.stage===2){const w=live.find(e=>e.warden);obj=w?T.warden.name+' '+stars(T.warden.stars)+' · '+(w.core>0?'SHIELD CORE '+fmtN(w.core)+' · ONLY YOUR TANK BREAKS IT':'CORE DOWN · EVERYONE FIRE')+' · HULL '+Math.round(100*w.hp/w.maxHp)+'%':'';}
 const clock=Math.max(0,C.CIT.limitS-(B.time||0)),gam=c.gam?.length?' · '+c.gam.map(k=>C.GAMBITS[k]?.name).join(' · '):'';
 h.children[0].textContent='CITADEL '+R[c.tier]+' · '+stage+' · '+mmss(clock)+gam;h.children[1].textContent=obj;
 const fresh=(B.time||0)-(c.say?.at||0)<4;h.children[2].textContent=c.say?.t||'';h.children[2].classList.toggle('fresh',fresh);
 const air=host.querySelector('#cq-strike');if(air){air.hidden=!(c.air>0)||B.state!=='active';const t='LDF AIRSTRIKE · '+c.air+(DESK()?' · X':'');if(air.textContent!==t)air.textContent=t;}
 h.classList.toggle('cq-cit-core',c.stage===2&&!!live.find(e=>e.warden&&e.core>0));return h;}
// ---- the result card (the Worker's receipt: s.settlement) --------------------------------------------------------------------------
function result(d,rec,{el}){const C=CI();if(!rec||!C)return null;const R=C.ROMAN,T=C.TIERS[rec.tier]||{};const box=el('section','cq-cit-result',null,d);
 if(rec.kind==='citadel'){el('p','cq-kicker',rec.first?'FIRST CLEAR':'THRONE RUN',box);el('h2','','CITADEL '+R[rec.tier]+' · '+(T.name||'')+' BROKEN',box);el('p','cq-cit-time','CLEAR TIME '+mmss((rec.ms|0)/1000)+(rec.best?' · YOUR BEST':'')+(rec.weekBest?' · YOUR BEST THIS WEEK':''),box);
  const ul=el('ul','cq-cit-rewards',null,box);
  if(rec.first){if(rec.bounty)el('li','','+'+fmtN(rec.bounty)+' airdrop bounty (once per account, outside the daily cap)',ul);el('li','','Production +'+Math.round((rec.prod||0)*100)+'% (materials and CP)',ul);el('li','','Trophy: '+(T.warden?.name||'the warden'),ul);el('li','','Retaliation '+R[rec.retaliation|0]+': your town and the front meet stronger attacks',ul);el('li','',rec.next?'Next: CITADEL '+R[rec.next]+' · '+C.TIERS[rec.next].name+' · the Hive re-fortifies it for '+Math.round(C.CIT.refortMs/86400000)+' days (Throne Runs meanwhile)':'Act I is broken. Act II (The Hive Wall) arrives with a later update.',ul);}
  else{el('li','',(rec.chest==='full'?'The full reward chest':'The reduced chest')+lootLine(rec.loot),ul);if(rec.gambits?.length)el('li','','Gambits: '+rec.gambits.map(k=>C.GAMBITS[k]?.name).join(' · '),ul);}
  el('li','','+'+fmtN(rec.ptsRaw)+' base airdrop points (battle points, inside the daily cap)',ul);if(rec.spent?.length)el('li','','Siege prep used: '+rec.spent.map(k=>C.PREP[k]?.short||k).join(', '),ul);}
 else{el('p','cq-kicker','THE ASSAULT FAILED',box);el('h2','','CITADEL '+R[rec.tier]+' HOLDS',box);const ul=el('ul','cq-cit-rewards',null,box);
  el('li','',rec.spent?.length?'Siege prep spent: '+rec.spent.map(k=>C.PREP[k]?.short||k).join(', '):'No siege prep was used',ul);el('li','','Downed allies need repair (half hull)',ul);el('li','','Nothing else is taken: no wreck, no cargo lost',ul);}
 return box;}
function lootLine(l){if(!l)return '';const n=[];for(const g of ['it','pt','fr','tr','mn'])for(const [k,v] of Object.entries(l[g]||{}))n.push((v|0)+' '+k);return n.length?': '+n.join(', '):'';}
root.ConquestCitadelUI=Object.freeze({card,throne,boardRows,hud,result,mmss});
})(globalThis);
