/* Science Lab research screen (owner decisions Nov 16, 2026): the research tree by track and lab level, the running jobs with
   their timers, the parts held and what every mod does in plain words. Presentation only: the Worker runs every job
   (worker/src/conquest-research.js) and the rules are js/rules.js (RTREE, rsQuote, rsSlots, FITS). Shown in the town sheet (the
   Science Lab's card and the HOME tab), as its own screen (the hub's RESEARCH button, the MORE menu) and as the reveal card
   when a job finishes. 2D, the town sheet's own style. */
(function(root){
'use strict';
const ROMAN=['','I','II','III','IV'];
const SLOT_N={hull:'HULL',mobility:'MOBILITY',mount:'MOUNT'};
const WORD={hp:'max hull',spd:'speed',dps:'damage per second',dashCd:'dash recharge',shieldCd:'shield recharge',turn:'turret turn',shotSpd:'shot speed',charge:'super charge',hitCharge:'super charge from hits',supTaken:'damage from supers'};
const LOWGOOD=new Set(['dashCd','shieldCd','supTaken']);
const pct=v=>Math.round(Math.abs(v)*100)+'%';
// the trade-off in plain words: what the mod costs (red in the garage compare)
function tradeOff(F){const out=[];for(const k of FIT_FIELDS){const v=F[k];if(!v)continue;const bad=LOWGOOD.has(k)?v>0:v<0;if(!bad)continue;out.push((LOWGOOD.has(k)?'+':'−')+pct(v)+' '+WORD[k]+(LOWGOOD.has(k)?' (slower)':''));}return out.join(', ')||'no stat cost';}
const fmtT=ms=>{const v=Math.max(0,Math.ceil(ms/1000));return v>=3600?Math.floor(v/3600)+'h '+String(Math.floor(v%3600/60)).padStart(2,'0')+'m':v>=60?Math.floor(v/60)+'m '+String(v%60).padStart(2,'0')+'s':v+'s';};
// the Science Lab in the state: its level and whether it stands (a ruined lab pauses research)
function labOf(s){const p=s?.plot,P=root.ConquestPlot;let lv=0,ruined=false,any=false,id=null;if(!p?.b)return {lv,ruined,any,id};
 for(const [k,b] of Object.entries(p.b)){if(b?.t!=='lab'||!(b.l>0))continue;any=true;id=k;lv=Math.max(lv,b.l|0);if(P?.ruined?.(p,k))ruined=true;}return {lv,ruined,any,id};}
const rsOf=s=>s?.rs||{jobs:[],done:{},bs:{},seen:{},acct:{bpt:{},prem:0}};
// parts: earned (the Conquest record, capped at 50) + bonus (Lunar Pass premium tiers and part packs on the account)
function partsOf(s){const r=rsOf(s),pt=s?.inv?.pt||{},bp=r.acct?.bpt||{},bs=r.bs||{},o={};for(const k of CQ_PART_ORDER){const b=Math.max(0,(bp[k]|0)-(bs[k]|0));o[k]={earned:pt[k]|0,bonus:b,total:(pt[k]|0)+b};}return o;}
function jobLeft(j,L,now){const run=L.any&&!L.ruined;return Math.max(0,(Number(j.left)||0)-(run?Math.max(0,now-(j.at||now)):0));}
// a mod's state for this pilot: done | running | ready | short (parts) | locked (lab or order) | busy (slots)
function nodeOf(s,id,now=Date.now()){const r=rsOf(s),L=labOf(s),prem=!!r.acct?.prem,F=rmodOf(id).F;
 if(r.done?.[id])return {st:'done'};const j=(r.jobs||[]).find(x=>x.mod===id);if(j)return {st:'running',left:jobLeft(j,L,now),ms:j.ms,j};
 const q=rsQuote(r,id,L.any?L.lv:0,prem);if(q.err)return {st:'locked',why:q.err};
 const have=partsOf(s)[q.part].total;if(have<q.n)return {st:'short',q,have};
 if(L.ruined)return {st:'locked',why:'the Science Lab is ruined: repair it'};if((r.jobs||[]).length>=rsSlots(L.lv,prem))return {st:'busy',q};return {st:'ready',q};}
// the first finished mod whose reveal card has not been shown
const toReveal=s=>{const r=rsOf(s);return RTREE_ALL.find(id=>r.done?.[id]&&!r.seen?.[id])||null;};
function partChip(el,parent,k,P){const c=el('span','cq-lab-part',null,parent);c.style.setProperty('--tc',RTREE.tracks[Object.keys(RTREE.tracks).find(t=>RTREE.tracks[t].part===k)].c);el('b','',P.total+'',c);el('small','',CQ_PARTS[k].n.toUpperCase()+(P.bonus?' · '+P.bonus+' BONUS':''),c);return c;}
// the whole screen (d: a container; ctx: {el, button, act(mod) -> Promise<boolean>, close, store(row, kind, info)})
function screen(d,s,ctx){const {el,button}=ctx,now=Date.now(),r=rsOf(s),L=labOf(s),prem=!!r.acct?.prem,slots=rsSlots(L.lv,prem),parts=partsOf(s);
 d.classList.add('cq-lab');el('p','cq-kicker','SCIENCE LAB · RESEARCH · TANK MODS',d);el('h2','',L.any?'SCIENCE LAB '+ROMAN[L.lv]:'SCIENCE LAB',d);
 if(!s?.plot)el('p','cq-lab-why','Claim your town, then build a Science Lab (Command Center 3). Research turns the parts you find into new mods for every mode.',d);
 else if(!L.any)el('p','cq-lab-why','Build a Science Lab in your town (Command Center 3) to start researching. Research turns the parts you find into new mods for every mode.',d);
 else{el('p','cq-lab-status',(L.ruined?'⚠ RUINED · research paused until you repair it · ':'')+(r.jobs||[]).length+' of '+slots+' research slot'+(slots>1?'s':'')+' running'+(L.lv<3?' · a second slot at Science Lab III':''),d);
  el('small','cq-lab-pass',prem?'LUNAR PASS PREMIUM · +1 research slot and 25% faster jobs':'LUNAR PASS PREMIUM adds a research slot, 25% faster jobs and research parts on its tiers',d);}
 el('p','cq-lab-explain','Research costs only research parts and time. A finished mod is yours for good: fit it in the garage (one per slot) and it works in every mode, PvP too.',d);
 const pr=el('div','cq-lab-parts',null,d);for(const k of CQ_PART_ORDER)partChip(el,pr,k,parts[k]);
 // running jobs, with their timers
 for(const j of r.jobs||[]){const F=rmodOf(j.mod).F,left=jobLeft(j,L,now),box=el('div','cq-lab-job',null,d);box.style.setProperty('--tc',RTREE.tracks[F.rs].c);
  el('b','',F.n.toUpperCase()+' · '+(L.ruined?'PAUSED':fmtT(left)+' left'),box);const bar=el('progress','',null,box);bar.max=1;bar.value=Math.max(0,Math.min(1,1-left/Math.max(1,j.ms)));bar.setAttribute('aria-label',F.n+' research progress');
  if(ctx.store)ctx.store(box,'rsfin',{job:j,left});}
 // the tree: one fold per track, then the locked fifth track
 for(const t of RTREE.order){const T=RTREE.tracks[t],open=L.lv>=T.lab,f=el('details','cq-map-fold cq-lab-track',null,d),sm=el('summary','',T.n.toUpperCase()+' · '+(open?T.d:'opens at Science Lab '+ROMAN[T.lab]),f);sm.dataset.k='lab-'+t;f.style.setProperty('--tc',T.c);
  if(open&&RTREE.mods[t].some(id=>{const n=nodeOf(s,id,now).st;return n==='ready'||n==='running';}))f.open=true;
  el('small','cq-lab-uses','Uses '+CQ_PARTS[T.part].n+'s · Science Lab '+ROMAN[T.lab]+' for its mods, III for its set mod',f);
  for(const id of [...RTREE.mods[t],RTREE.legendary[t]]){const R0=rmodOf(id),F=R0.F,n=F.leg?{st:'legendary'}:nodeOf(s,id,now),row=el('article','cq-lab-node cq-lab-'+n.st,null,f);
   el('h3','',(F.leg?'★ ':F.set?'◆ ':'')+F.n.toUpperCase(),row);el('small','cq-lab-meta',SLOT_N[R0.slot]+' MOD · '+F.role.toUpperCase()+(F.set?' · SET MOD':'')+(F.leg?' · LEGENDARY':''),row);
   el('p','cq-lab-what',F.d,row);el('small','cq-lab-cost','Trade-off: '+tradeOff(F),row);
   if(n.st==='done')el('b','cq-lab-tag','✓ RESEARCHED · in your garage',row);
   else if(n.st==='running')el('b','cq-lab-tag','RESEARCHING · '+(L.ruined?'paused':fmtT(n.left)+' left'),row);
   else if(n.st==='locked')el('small','cq-lab-lock','🔒 '+String(n.why).replace(/^conquest: /,''),row);
   else if(n.st==='legendary'){el('small','cq-lab-lock','A step stronger than '+rmodOf(RTREE.mods[t][3]).F.n+'. Bought, never researched.',row);if(ctx.store)ctx.store(row,'rsleg',{id});}
   else{const q=n.q,b=button((n.st==='ready'?'RESEARCH':n.st==='busy'?'SLOTS BUSY':'NEED '+q.n)+' · '+q.n+' '+CQ_PARTS[q.part].n.toUpperCase()+(q.n>1?'S':'')+' · '+fmtT(q.ms),async()=>{b.disabled=true;const ok=await ctx.act(id);if(!ok)b.disabled=false;},'cq-lab-go');
    b.disabled=n.st!=='ready';row.append(b);if(n.st==='short')el('small','cq-lab-lock','You have '+n.have+'. Parts drop from heavy Parasites, raid commanders and Meteor Strikes.',row);}}}
 {const Lk=RTREE.locked,f=el('details','cq-map-fold cq-lab-track cq-lab-locked',null,d),sm=el('summary','','🔒 '+Lk.n.toUpperCase()+' · '+Lk.d,f);sm.dataset.k='lab-role';el('small','',Lk.n+' open with Science Lab level '+ROMAN[Lk.lab]+'.',f);}
 if(ctx.store)ctx.store(d,'rspack',{});
 return d;}
// a compact line for the hub and the HOME tab: what is running, what can start
function line(s,now=Date.now()){const r=rsOf(s),L=labOf(s);if(!L.any)return null;const j=(r.jobs||[])[0];
 if(j){const F=rmodOf(j.mod).F;return 'RESEARCH · '+F.n.toUpperCase()+' · '+(L.ruined?'PAUSED (lab ruined)':fmtT(jobLeft(j,L,now))+' left')+((r.jobs||[]).length>1?' · +'+((r.jobs||[]).length-1):'');}
 const ready=RTREE_ALL.filter(id=>nodeOf(s,id,now).st==='ready').length;return ready?'RESEARCH · '+ready+' mod'+(ready>1?'s':'')+' ready to research':'RESEARCH · '+Object.keys(r.done||{}).length+' of '+RTREE_ALL.length+' researched';}
// the reveal card for a finished mod: what it does in plain words, the trade-off, the power change if fitted; FIT asks the
// garage's own save (server-checked) on the active bay
function reveal(d,id,ctx){const {el,button}=ctx,R0=rmodOf(id),F=R0.F,T=RTREE.tracks[F.rs];d.classList.add('cq-lab-reveal');d.style.setProperty('--tc',T.c);
 el('p','cq-kicker','RESEARCH COMPLETE · '+T.n.toUpperCase(),d);el('h2','',F.n.toUpperCase(),d);el('small','cq-lab-meta',SLOT_N[R0.slot]+' MOD · '+F.role.toUpperCase()+(F.set?' · SET MOD':''),d);
 el('p','cq-lab-what',F.d,d);el('p','cq-lab-cost','Trade-off: '+tradeOff(F),d);
 const L=typeof myLoadout==='function'?myLoadout():null;if(L&&typeof powerOf==='function'){const mods={...fittingSelection(L.mods),[R0.slot]:id},f=fittingStats(mods),p0=powerOf(L),p1=powerOf({...L,mods});
  el('p','cq-lab-power',f.weight>FIT_BUDGET.weight||f.power>FIT_BUDGET.power?'Does not fit with your current mods (weight or power budget): swap one in the garage.':'POWER '+p0+' → '+p1+' if you fit it now',d);ctx.fitOk=!(f.weight>FIT_BUDGET.weight||f.power>FIT_BUDGET.power);}
 return d;}
root.ConquestLab=Object.freeze({screen,reveal,line,nodeOf,partsOf,labOf,toReveal,tradeOff,fmtT});
})(globalThis);
