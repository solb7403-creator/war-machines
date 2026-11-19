/* Session 6C COMMAND (owner, Nov 18; blueprint §4 Decision 3): one button for your whole force, in the HUD's context slot (SCAN,
   GATHER near ore, COMMAND in a fight: the HUD stays at eight touch targets). TAP gives the smart order (attack my locked target, or
   regroup when nothing is locked); HOLD opens the four-way wheel FOLLOW / ATTACK / HOLD HERE / FALL BACK (slide onto a wedge and
   let go, or let go and tap one). On a computer the same orders: tap V for the smart order, hold V to open the wheel and pick with
   1-4 or the mouse (let go of V on a wedge). 1-4 pick orders only while the wheel is open (they use your consumables otherwise).
   An order is an edge in the next command the phone sends (view.pendingAbilities.order: 1 follow, 2 attack, 3 hold here, 4 fall
   back, 5 the smart order); the Worker replays the same command (controls.js -> Battle.squadOrder), so phone and Worker agree.
   Presentation only: nothing here reads gear, power or purchases. */
(function(root){
'use strict';
const HOLD_MS=350,KEY_HOLD_MS=300,STICKY_MS=4000,DEAD=24;
// clockwise from the top, so the keys 1-4 read round the wheel
const WEDGES=Object.freeze([
 Object.freeze({k:1,n:'FOLLOW',i:'⇡',d:'Back into formation around you',at:'top'}),
 Object.freeze({k:2,n:'ATTACK',i:'⌖',d:'Your locked target, or the one in your sights',at:'right'}),
 Object.freeze({k:3,n:'HOLD HERE',i:'⛉',d:'Hold this ground until the next order',at:'bottom'}),
 Object.freeze({k:4,n:'FALL BACK',i:'⇣',d:'Pull back behind you, away from the nearest Parasite',at:'left'})]);
const DOING=Object.freeze({follow:'FOLLOWING',attack:'ATTACKING',hold:'HOLDING',fallback:'FALLING BACK'});
const SAID=Object.freeze({1:'FOLLOW',2:'ATTACK',3:'HOLD HERE',4:'FALL BACK'});
let X=null;
const lockAlive=B=>B&&B.lockId!=null&&(B.enemies||[]).some(e=>e.id===B.lockId&&e.hp>0);
const mine=B=>(B?.friends||[]).filter(f=>f.side==='mine');
// in a fight: an operation, or (in the open world) an awake Parasite within 70 m, or a hit taken in the last 4 s
function inFight(v,B){if(!B||!(B.playerHp>0))return false;if(v.battle)return true;const p=v.p||B.player;if(!p)return false;
 if(Date.now()-(v.lastHitAt||0)<4000)return true;for(const e of B.enemies||[])if(e.hp>0&&!e.dormant&&Math.hypot(e.x-p.x,e.z-p.z)<70)return true;return false;}
// shown when your pilots are in the field, COMMAND orders are open (Hangar II) and you are in a fight
function wanted(v){const B=v?.battle||v?.encounter;return !!B&&B.state==='active'&&!!B.squad?.orders&&mine(B).some(f=>!f.down&&f.hp>0)&&inFight(v,B);}
function issue(k,how){if(!X)return false;const v=X.view();if(!v?.pendingAbilities)return false;v.pendingAbilities.order=k;X.last={k,at:Date.now(),how};
 if(typeof fx==='function')fx('tap');try{root.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(k===5?'light':'medium');}catch(_){}
 const B=v.battle||v.encounter,said=k===5?(lockAlive(B)?'ATTACK · LOCKED TARGET':'REGROUP'):SAID[k];X.flash='ORDER · '+said;X.flashUntil=Date.now()+1300;draw(v);return true;}
// the wedge under a point, by angle from the wheel's centre (a forgiving thumb: a quarter turn each, a small dead zone in the middle)
function wedgeAt(x,y,from){let cx,cy;if(from){cx=from.x;cy=from.y;}else{const r=X.wheel.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;}const dx=x-cx,dy=y-cy;if(Math.hypot(dx,dy)<DEAD)return 0;   /* from: where the thumb went down (the slide's direction picks, wherever the wheel had to be drawn) */
 const a=Math.atan2(dx,-dy);/* 0 = up, clockwise */const q=Math.round(((a+2*Math.PI)%(2*Math.PI))/(Math.PI/2))%4;return [1,2,3,4][q];}
function light(k){X.hot=k|0;for(const b of X.wheel.querySelectorAll('.cq-cmd-w')){const on=Number(b.dataset.k)===X.hot;if(b.classList.contains('cq-on')!==on)b.classList.toggle('cq-on',on);}
 const W=WEDGES.find(w=>w.k===X.hot);X.hub.textContent=W?W.n:'ORDERS';X.hubSub.textContent=W?W.d:(X.kb?'1-4 or click · Esc closes':'Slide onto an order');}
// open the wheel around a point on the screen (kept inside the play area), the thumb's or the button's
function open(x,y,kb){const P=X.panel.getBoundingClientRect(),R=106,C=130,cx=Math.max(P.left+C,Math.min(P.right-C,x)),cy=Math.max(P.top+R+84,Math.min(P.bottom-R-8,y));   /* C: room for the caption above the wheel */
 const w=X.wheel;w.style.left=Math.round(cx-P.left)+'px';w.style.top=Math.round(cy-P.top)+'px';X.kb=!!kb;w.classList.toggle('cq-cmd-kb',!!kb);w.hidden=false;X.openAt=Date.now();light(0);{const v=X.view(),o=(v?.battle||v?.encounter)?.squad?.o,cur=({follow:1,attack:2,hold:3,fallback:4})[o]||0;for(const b of w.querySelectorAll('.cq-cmd-w'))b.classList.toggle('cq-cur',Number(b.dataset.k)===cur);}   /* the order in effect is marked */
 clearTimeout(X.sticky);X.sticky=setTimeout(()=>close(),STICKY_MS*2);if(typeof fx==='function')fx('tap');try{root.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();}catch(_){}}
function close(){if(!X)return;clearTimeout(X.sticky);X.wheel.hidden=true;X.hot=0;X.kb=false;X.keyHeld=false;}
const isOpen=()=>!!X&&!X.wheel.hidden;
function draw(v){if(!X)return;const B=v?.battle||v?.encounter,b=X.btn,flash=X.flashUntil>Date.now()?X.flash:'',sub=flash||(X.desk?(lockAlive(B)?'V ATTACK':'V REGROUP')+' · HOLD V ORDERS':(lockAlive(B)?'TAP ATTACK':'TAP REGROUP')+' · HOLD ORDERS'),now=DOING[B?.squad?.o]||'FOLLOWING';
 const t=b.firstChild,s=t.nextSibling;if(t.textContent!=='COMMAND · '+now)t.textContent='COMMAND · '+now;if(s.textContent!==sub)s.textContent=sub;if(b.classList.contains('cq-cmd-flash')!==!!flash)b.classList.toggle('cq-cmd-flash',!!flash);}
// every HUD frame: shown or hidden; the wheel closes when COMMAND is not offered any more (the fight ended, the pilots went down)
function update(v){if(!X)return false;const show=wanted(v);if(X.btn.hidden===show)X.btn.hidden=!show;if(!show){if(isOpen())close();return false;}draw(v);return true;}
function mount(panel,ctx){const {el,button}=ctx;X={panel,view:ctx.view,hot:0,kb:false,flash:'',flashUntil:0,desk:!!(root.matchMedia?.('(hover:hover) and (pointer:fine)')?.matches)};
 const b=button('',()=>{},'cq-command-access');b.id='cq-command-access';b.hidden=true;el('b','cq-cmd-k','COMMAND',b);el('small','cq-cmd-sub','',b);
 b.setAttribute('aria-label','COMMAND your pilots: tap for the smart order (attack your locked target, or regroup), hold for the order wheel. Keyboard: V, hold V');panel.append(b);X.btn=b;
 const w=el('div','cq-cmd-wheel',null,panel);w.hidden=true;w.setAttribute('role','menu');w.setAttribute('aria-label','Squad orders');X.wheel=w;
 for(const W of WEDGES){const x=button('',()=>{issue(W.k,'wheel');close();},'cq-cmd-w cq-cmd-'+W.at);x.dataset.k=String(W.k);x.setAttribute('role','menuitem');x.setAttribute('aria-label',W.n+' · '+W.d+' (key '+W.k+')');
  el('i','',W.i,x);el('b','',W.n,x);el('kbd','',String(W.k),x);x.onpointerenter=()=>light(W.k);w.append(x);}
 const hub=el('div','cq-cmd-hub',null,w);X.hub=el('b','','ORDERS',hub);X.hubSub=el('small','','',hub);
 // the button: a tap is the smart order; a hold (HOLD_MS) opens the wheel under the thumb; slide and let go on a wedge to order
 let id=null,timer=null;const cancel=()=>{clearTimeout(timer);timer=null;};
 let at=null;b.onpointerdown=e=>{if(id!==null)return;e.preventDefault();id=e.pointerId;try{b.setPointerCapture(id);}catch(_){}const x=e.clientX,y=e.clientY;at={x,y};cancel();timer=setTimeout(()=>{timer=null;open(x,y,false);},HOLD_MS);};
 b.onpointermove=e=>{if(e.pointerId!==id||!isOpen())return;light(wedgeAt(e.clientX,e.clientY,at));};
 b.onpointerup=e=>{if(e.pointerId!==id)return;id=null;if(timer){cancel();issue(5,'tap');return;}if(isOpen()){const k=wedgeAt(e.clientX,e.clientY,at);if(k){issue(k,'slide');close();}else{clearTimeout(X.sticky);X.sticky=setTimeout(()=>close(),STICKY_MS);}}};
 b.onpointercancel=b.onlostpointercapture=e=>{if(e.pointerId!==id)return;id=null;cancel();};
 b.onkeydown=e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();e.stopPropagation();issue(5,'key');}};
 b.onclick=e=>{if(e.detail===0){e.preventDefault();}};   // a synthetic click (keyboard) is handled on keydown; a pointer tap on pointerup
 // the keyboard: V taps (smart order) or, held, opens the wheel over the HUD; 1-4 pick while it is open; Esc closes
 let vt=null;const signal=ctx.signal;
 const keydown=e=>{if(!X||!panel.isConnected||e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(isOpen()&&/^Digit[1-4]$/.test(e.code)){e.preventDefault();e.stopImmediatePropagation();issue(Number(e.code.slice(5)),'key');close();return;}
  if(isOpen()&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();return;}
  if(e.code!=='KeyV'||e.repeat||b.hidden||panel.querySelector('.cq-dialog'))return;e.preventDefault();X.keyHeld=true;clearTimeout(vt);
  vt=setTimeout(()=>{vt=null;if(!X.keyHeld||b.hidden)return;const r=b.getBoundingClientRect();open(r.left+r.width/2+150,r.top-90,true);},KEY_HOLD_MS);};
 const keyup=e=>{if(!X||e.code!=='KeyV')return;const was=X.keyHeld;X.keyHeld=false;if(vt){clearTimeout(vt);vt=null;if(was&&!b.hidden)issue(5,'key');return;}if(isOpen()&&X.kb){if(X.hot){issue(X.hot,'key');close();}else{clearTimeout(X.sticky);X.sticky=setTimeout(()=>close(),STICKY_MS);}}};
 root.addEventListener('keydown',keydown,{capture:true,signal});root.addEventListener('keyup',keyup,{capture:true,signal});
 root.addEventListener('blur',()=>{X&&(X.keyHeld=false);clearTimeout(vt);vt=null;},{signal});
 signal?.addEventListener?.('abort',()=>{close();X=null;},{once:true});
 return b;}
root.ConquestCommand=Object.freeze({mount,update,issue:(k,how)=>issue(k,how),isOpen,close,wanted,WEDGES,HOLD_MS,KEY_HOLD_MS,get state(){return X?{open:isOpen(),hot:X.hot,last:X.last||null,flash:X.flashUntil>Date.now()?X.flash:''}:null;}});
})(globalThis);
