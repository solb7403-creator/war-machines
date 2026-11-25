/* Session 7C STEP 3: the Hive Titan's screens (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md). The hub's and the HUD's telegraph
   ("TITAN SLOT · 12:00 UTC"), the strike result's "THE HIVE TITAN RISES" button (a Titan slot, the core extracted), the hunt's HUD (the
   phase, its hull bar with the phase marks at 2/3 and 1/3, the 4-minute clock, the call-out) and its result card (the Worker's own
   settlement: the kill's points and loot once per slot, the pilot's damage for the weekly board). Draws only: every change is a Worker
   action (worker/src/conquest-titan.js). Phone and computer alike: real buttons (touch, mouse, keyboard). */
(function(root){
'use strict';
const TT=()=>root.ConquestTitan,fmtN=n=>Math.round(Number(n)||0).toLocaleString('en-US');
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
const left=ms=>{const m=Math.max(0,Math.ceil(ms/60000));return m>=60?Math.floor(m/60)+'H '+String(m%60).padStart(2,'0')+'M':m+' MIN';};
// the telegraph line (hub LIVE EVENTS, the HUD's strike line)
function slotLine(now=Date.now()){const T=TT();if(!T)return '';const n=T.nextTitan(now);return n.live?'☄ THE HIVE TITAN · '+n.site.name+' · EXTRACT THE CORE, THEN FIGHT IT · '+mmss((n.closesAt-now)/1000)+' LEFT':'☄ TITAN SLOT · '+T.hhmm(n.impactAt)+' UTC · '+n.site.name+' · IN '+left(n.impactAt-now);}
function hubLine(card,{el,now=Date.now()}={}){if(!el||!card||!TT())return null;return el('small','cq-hub-titan',slotLine(now),card);}
// the strike result: in a Titan slot, the hunt
function strikeButton(box,state,{el,button,start}){const st=state?.settlement;if(!st||st.kind!=='strike'||!st.titan||!button)return null;const T=TT(),why=T?.startWhy(state,Date.now());
 const w=el('div','cq-titan-rise',null,box);el('p','cq-kicker','A TITAN SLOT',w);el('h3','','THE HIVE TITAN RISES',w);el('p','','9,000 hull · three phases · 4 minutes before it burrows away. Your Wing draws its fire and burns the swarm; your tank does the damage. The kill pays once this slot; your damage counts on the weekly Titan board, won or lost.',w);
 w.append(button(why?String(why).toUpperCase():'FIGHT THE HIVE TITAN',()=>start?.(),'cq-titan-go'));if(why)w.lastChild.disabled=true;return w;}
// the hunt's HUD (js/conquest/app.js calls it every frame, like the Citadel's)
function hud(panel,view,{el}){const B=view?.battle,c=B?.ttn;let h=panel.querySelector('.cq-titan-hud');if(!c||!el){if(h)h.remove();return null;}
 if(!h){h=el('div','cq-titan-hud',null,panel);h.setAttribute('role','status');el('p','cq-titan-head','',h);const bar=el('div','cq-titan-bar',null,h);el('i','cq-titan-fill',null,bar);el('b','cq-titan-mark cq-titan-m1',null,bar);el('b','cq-titan-mark cq-titan-m2',null,bar);el('p','cq-titan-say','',h);}
 const T=(B.enemies||[]).find(e=>e.titan),P=TT()?.PHASES||[],hp=T?Math.max(0,T.hp)/T.maxHp:0,clock=Math.max(0,(TT()?.TITAN.clockS||240)-(B.time||0));
 const head='THE HIVE TITAN · PHASE '+['','I','II','III'][c.phase|0]+' · '+(P[c.phase|0]||'')+' · '+mmss(clock)+(T?.dormant?' · BURROWED':'')+' · YOUR DAMAGE '+fmtN(T?.tp||0);
 if(h.children[0].textContent!==head)h.children[0].textContent=head;h.querySelector('.cq-titan-fill').style.width=Math.round(hp*1000)/10+'%';
 const say=c.say?.t||'';if(h.children[2].textContent!==say)h.children[2].textContent=say;h.classList.toggle('cq-titan-enraged',!!c.enraged);return h;}
// the result card (the Worker's receipt: s.settlement kind titan / titan-loss)
function result(d,rec,{el}){if(!rec||!el)return null;const box=el('section','cq-titan-result',null,d),ul=el('ul','cq-cit-rewards',null,box);
 if(rec.kind==='titan'){el('p','cq-kicker',rec.first?'THE KILL OF THIS SLOT':'ALREADY DOWN THIS SLOT',box);el('h2','','THE HIVE TITAN FALLS',box);
  if(rec.first){el('li','','+'+fmtN(rec.ptsRaw)+' base airdrop points (once this slot, inside the daily cap)',ul);if(rec.loot)el('li','','Loot: '+(root.ConquestLoot?.text?.(rec.loot)||'secured')+(rec.pity?' (the Selenite pity paid)':''),ul);}
  else el('li','','This slot\'s Titan already paid: no second reward',ul);}
 else{el('p','cq-kicker','THE HUNT FAILED',box);el('h2','','THE TITAN '+(rec.why==='destroyed'?'STILL STANDS':'BURROWED AWAY'),box);el('li','',rec.why==='destroyed'?'Your War Machine was disabled: the LDF towed it back (no wreck, no cargo lost)':rec.why==='retreated'?'You withdrew from the hunt':'The 4-minute clock ran out',ul);}
 el('li','','Your damage: '+fmtN(rec.dmg)+(rec.best?' · YOUR BEST THIS SLOT':'')+' · it counts on the weekly Titan board',ul);box.insertBefore(ul,null);return box;}
root.ConquestTitanUI=Object.freeze({slotLine,hubLine,strikeButton,hud,result});
})(globalThis);
