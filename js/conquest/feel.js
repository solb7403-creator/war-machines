/* Session 6 (part B, the feel pass): the 80 ms hit flash, floating damage numbers, the kill pop, the loot flyout and the Conquest
   sounds (js/fx.js, code-made, no files). Presentation only: it reads the hp, drops, hazards and notices the battle already has and
   never changes damage, speed, ranges or rewards (the 5D fair-Arcade regression stays green). Research: a hit flash of 60-100 ms
   timed in ms (not frames), numbers merged per target with a crit colour, kills inside 4 s stack (Halo's multi-kill window), loot
   in one rarity colour ladder (docs/conquest/session6/RESEARCH.md). */
(function(root){
'use strict';
const NAMES=Object.freeze({raider:'INTERCEPTOR',breacher:'SABOTEUR',sentinel:'HEAVY SENTINEL',command:'COORDINATOR'});
const RARITY_COLORS=Object.freeze(['#c9d2dc','#5fe08a','#46d9ff','#c18cff','#ffc94a']);   // common, uncommon, rare, epic, legendary
const reduced=()=>{try{return !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
const snd=(n,a)=>{if(typeof fx==='function')fx(n,a);};
function create(view,panel){
 const F={hp:new Map(),flash:new Map(),nums:[],kills:[],lastHit:0,lastWarn:0,shield:0,dash:false,full:false,drops:new Map(),hazards:new Set(),dead:new Set()};
 const layer=document.createElement('div');layer.className='cq-feel';layer.setAttribute('aria-hidden','true');panel.append(layer);
 for(let i=0;i<3;i++){const n=document.createElement('b');n.className='cq-dmg';n.hidden=true;layer.append(n);F.nums.push({el:n,id:null,sum:0,until:0});}
 // Session 6 loot v1: one-word labels over the nearest four loot caches (rarity colour), so a drop reads before you reach it
 F.tags=[];for(let i=0;i<4;i++){const n=document.createElement('i');n.className='cq-drop-tag';n.hidden=true;layer.append(n);F.tags.push(n);}
 const project=(x,y,z)=>{const T=view.T,c=view.camera;if(!T||!c||!view.origin||!view.host)return null;const v=new T.Vector3(x-view.origin.x,y,z-view.origin.z).project(c);
  if(v.z>1||Math.abs(v.x)>1.05||Math.abs(v.y)>1.05)return null;const r=view.host.getBoundingClientRect();return {x:(v.x+1)*r.width/2,y:(1-v.y)*r.height/2};};
 // at most three numbers on screen, merged per target inside 0.7 s; the oldest slot is reused
 function number(e,amount,crit,now){let slot=F.nums.find(s=>s.id===e.id&&s.until>now);if(!slot){slot=F.nums.reduce((a,b)=>a.until<b.until?a:b);slot.id=e.id;slot.sum=0;slot.crit=false;}
  slot.sum+=amount;slot.crit=slot.crit||crit;slot.until=now+700;slot.e=e;const n=slot.el;n.textContent=String(Math.max(1,Math.round(slot.sum)));
  n.classList.toggle('cq-dmg-crit',!!slot.crit);n.classList.toggle('cq-dmg-still',reduced());n.hidden=false;n.style.animation='none';void n.offsetWidth;n.style.animation='';}
 // the hit flash: the hull's solid material swaps to the flash twin (same shaders, uFlash = 1) for 80 ms
 function flash(id,now){const g=view.enemyMeshes?.get(id),M=view.style?.MAT;if(!g||!M?.solidHit)return;let f=F.flash.get(id);
  if(!f){f={list:[],until:0};g.traverse(o=>{if(o.isMesh&&o.material===M.solid){o.material=M.solidHit;f.list.push(o);}});F.flash.set(id,f);}f.until=now+80;}
 function unflash(now,all=false){const M=view.style?.MAT;for(const [id,f] of F.flash)if(all||f.until<=now){for(const o of f.list)if(M&&o.material===M.solidHit)o.material=M.solid;F.flash.delete(id);}}
 function killPop(e,now){F.kills=F.kills.filter(k=>now-k.at<4000);const name=NAMES[e.kind]||'HOSTILE';F.kills.push({at:now,name});const n=F.kills.filter(k=>k.name===name).length;
  const t=panel.querySelector('.cq-reward-ticker');if(t){t.textContent='DESTROYED · '+name+(n>1?' ×'+n:'');t.__cqText=t.textContent;view.tickerUntil=Date.now()+2200;}snd('cqkill');}
 // a picked-up cache flies to the cargo line (or the hull bar) in its rarity colour, with its rarity sound
 function flyout(d,rarity,label){const p=project(d.x,(d.y||0)+2,d.z),mn=panel.querySelector('.cq-mn'),target=mn&&mn.textContent?mn:panel.querySelector('#cq-hull-row');if(!p||!target)return;
  const r=target.getBoundingClientRect(),b=panel.getBoundingClientRect(),chip=document.createElement('span');chip.className='cq-flyout';chip.textContent=label;chip.style.color=RARITY_COLORS[rarity]||RARITY_COLORS[0];chip.style.left=Math.round(p.x)+'px';chip.style.top=Math.round(p.y)+'px';layer.append(chip);
  const go=()=>{chip.style.transform=reduced()?'none':'translate('+Math.round(r.left-b.left+24-p.x)+'px,'+Math.round(r.top-b.top+6-p.y)+'px) scale(.7)';chip.style.opacity='0';};
  requestAnimationFrame(()=>requestAnimationFrame(go));setTimeout(()=>chip.remove(),950);snd('loot',rarity);}
 // rare and above (Session 6 loot v1): a card in the rarity colour holds the ticker for 2.4 s (fx('loot') adds the haptic)
 function card(d){const L=root.ConquestLoot,top=L?.best(d.loot);if(!top||top.r<2)return;panel.querySelector('.cq-loot-card')?.remove();const c=document.createElement('div');c.className='cq-loot-card';c.setAttribute('role','status');c.style.color=RARITY_COLORS[top.r]||RARITY_COLORS[2];
  const k=document.createElement('small');k.textContent=(['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'][top.r]||'RARE')+' FIND';c.append(k,document.createTextNode(top.t.replace(/^RARE · /,'')));panel.append(c);setTimeout(()=>c.remove(),2400);
  const t=panel.querySelector('.cq-reward-ticker');if(t){t.textContent=L.text(d.loot);t.__cqText=t.textContent;view.tickerUntil=Date.now()+2600;}}
 return {flyout,card,
  frame(B,state){const now=performance.now();unflash(now);if(!B)return;
   const superLive=(B.effects||[]).some(x=>x.k&&(x.kind==='beam'||x.kind==='nova'||x.kind==='destroy'));   // a SUPER hit prints gold
   for(const e of B.enemies||[]){const old=F.hp.get(e.id);F.hp.set(e.id,e.hp);if(old===undefined||!(e.hp<old-.5))continue;const d=Math.hypot(e.x-view.p.x,e.z-view.p.z);if(d>160)continue;
    flash(e.id,now);number(e,old-e.hp,superLive,now);if(now-F.lastHit>70){F.lastHit=now;snd('dealt',{k:typeof supKey==='function'?supKey(B.playerStats?.wtype||'pulse',B.playerStats?.wtier|0):null,cr:superLive});}
    if(e.hp<=0&&old>0&&!F.dead.has(e.id)){F.dead.add(e.id);killPop(e,now);}}
   if(F.hp.size>400){const live=new Set((B.enemies||[]).map(e=>e.id));for(const k of F.hp.keys())if(!live.has(k))F.hp.delete(k);}
   for(const s of F.nums){if(s.until<=now||!s.e){s.el.hidden=true;s.id=null;continue;}const p=project(s.e.x,(s.e.y||0)+7,s.e.z);if(!p){s.el.hidden=true;continue;}s.el.style.left=Math.round(p.x)+'px';s.el.style.top=Math.round(p.y)+'px';}
   if(B.dashState&&!F.dash)snd('dash');F.dash=!!B.dashState;if((B.shieldT||0)>0&&!(F.shield>0))snd('shield');F.shield=B.shieldT||0;
   const full=(B.charge||0)>=(typeof SUPER_MAX==='number'?SUPER_MAX:1000);if(full&&!F.full)snd('ready');F.full=full;
   for(const h of B.hazards||[]){const key=Math.round(h.x)+':'+Math.round(h.z)+':'+(h.wave??h.kind);if(h.remaining<=.08&&!F.hazards.has(key)&&Math.hypot(h.x-view.p.x,h.z-view.p.z)<120){F.hazards.add(key);snd('boom');}}if(F.hazards.size>64)F.hazards.clear();
   {const near=(state?.drops||[]).filter(d=>d.loot&&d.expires>Date.now()&&Math.hypot(d.x-view.p.x,d.z-view.p.z)<70).sort((a,b)=>Math.hypot(a.x-view.p.x,a.z-view.p.z)-Math.hypot(b.x-view.p.x,b.z-view.p.z));
    F.tags.forEach((n,i)=>{const d=near[i],p=d&&project(d.x,(d.y||0)+4.2,d.z);if(!p){n.hidden=true;return;}if(n.textContent!==d.label)n.textContent=d.label;n.style.color=RARITY_COLORS[d.r|0]||RARITY_COLORS[0];n.style.left=Math.round(p.x)+'px';n.style.top=Math.round(p.y)+'px';n.hidden=false;});}
   const drops=new Map((state?.drops||[]).map(d=>[d.id,d]));for(const [id,d] of F.drops)if(!drops.has(id)&&Math.hypot(d.x-view.p.x,d.z-view.p.z)<9){flyout(d,d.r|0,d.label||'SALVAGE');card(d);}F.drops=drops;},
  warn(){const now=performance.now();if(now-F.lastWarn>4000){F.lastWarn=now;snd('warn');}},
  dispose(){unflash(0,true);layer.remove();}};}
root.ConquestFeel=Object.freeze({create,RARITY_COLORS,NAMES});
})(globalThis);
