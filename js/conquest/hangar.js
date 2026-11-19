/* Session 6C Battalion screens (owner prompt Nov 18): the HANGAR (roster cards: role, rank, gear, status; AUTO-ARM; formation
   presets; RECRUIT; repairs; liveries), the briefing strip (the enemy roster as icons with one hint line, your picked force, two
   taps from briefing to deploy), the hub's BATTALION card and the after-action lines. Presentation only: every change is a Worker
   action (worker/src/conquest-battalion.js); the rules are js/conquest/battalion.js. Phone and computer are the same elements. */
(function(root){
'use strict';
const BT=()=>root.ConquestBattalion,CB=()=>root.ConquestCombat;
const ROLE_C=Object.freeze({'':'#d9c27a',guardian:'#5aa9ff',breacher:'#ff8a3d',lancer:'#e8f4ff',mender:'#7be07b',corroder:'#c28bff',frostline:'#7fe3ff'});
const ROLE_L=Object.freeze({'':'W',guardian:'G',breacher:'B',lancer:'L',mender:'M',corroder:'C',frostline:'F'});
const ROMAN=['','I','II','III','IV','V'];
const roleName=r=>r?BT().ROLE_INFO[r].n.toUpperCase():'WINGMAN';
const t2=ms=>{const v=Math.max(0,Math.ceil(ms/1000));return v>=3600?Math.floor(v/3600)+'h '+String(Math.floor(v%3600/60)).padStart(2,'0')+'m':Math.floor(v/60)+'m '+String(v%60).padStart(2,'0')+'s';};
function hangarLv(s){let lv=0;for(const b of Object.values(s?.plot?.b||{}))if(b?.t==='hangar')lv=Math.max(lv,b.l|0);return lv;}
const rolesOpen=s=>hangarLv(s)>=BT().ROLES_AT;
const rcLv=(s,r)=>r&&rolesOpen(s)?Math.max(1,s?.rs?.rc?.[r]|0||1):1;
function gearLine(kit){if(!kit||kit.mil)return 'MILITIA KIT · Common, no cores · a green crew that freezes up against VETERAN';const W=(typeof WNAMES==='object'&&WNAMES[kit.w.a]?.[kit.w.t])||(kit.w.a==='moon'?'Moonbeam':kit.w.a),C=(typeof CNAMES==='object'&&CNAMES[kit.c.c]?.[kit.c.t])||kit.c.c;return String(W).toUpperCase()+' · '+String(C).toUpperCase();}
function badge(el,parent,role){const b=el('span','cq-bat-role',ROLE_L[role||''],parent);b.style.setProperty('--rc',ROLE_C[role||'']);b.dataset.role=role||'wingman';b.setAttribute('aria-hidden','true');return b;}
// "COMMAND CHIP 0/1 TODAY" (1/1 once taken), shown beside the research line on the hub (phone and computer)
function chipDay(s,now=Date.now()){const d=Math.floor(now/864e5),n=s?.bat?.ch?.d===d?1:0,left=Math.ceil((864e5-now%864e5)/36e5);return {n,of:1,text:'COMMAND CHIP '+n+'/1 TODAY'+(n?' · NEXT IN '+left+'H':''),rule:'Your first win each UTC day with at least one of your pilots fielded gives 1 command chip (one a day). Command chips raise Role Cores at the Science Lab.'};}
function chipsHeld(s){const e=s?.bat?.ch?.e|0,b=Math.max(0,(s?.rs?.acct?.bch|0)-(s?.bat?.ch?.bs|0));return {e,b,total:e+b};}
// the FORCE chip (js/conquest/rating.js, key 'force'): the battalion rating, informational only
function forceOf(s,scale){const B=BT();if(!B||!s?.bat)return 0;try{return B.force(B.picked(s.bat,hangarLv(s),scale||'wing'),s.rs?.rc);}catch(_){return 0;}}
function forceChip(el,parent,s,scale){const v=forceOf(s,scale);if(!v||!root.ConquestRating)return null;return root.ConquestRating.chip(el,parent,{key:'force',label:'FORCE',value:v,title:'Your battalion\'s rating: the gear power of the pilots you field, plus their ranks and Role Core levels. A guide only: the Parasites never see it.'});}
// ---- the HANGAR ----
function screen(d,s,ctx){const {el,button}=ctx,B=BT(),T=s?.bat||{p:[],ps:[{f:'wedge',ids:[]},{f:'wedge',ids:[]},{f:'wedge',ids:[]}],pa:0,ch:{e:0}},lv=hangarLv(s),cap=B.fieldCap(lv),open=lv>=B.ROLES_AT,now=ctx.now||Date.now();
 d.classList.add('cq-hangar');el('p','cq-kicker','HANGAR · YOUR BATTALION',d);el('h2','','PILOTS',d);
 {const row=el('div','cq-bat-head',null,d);forceChip(el,row,s,lv>=2?'platoon':'wing');el('small','cq-bat-stage',(lv?'HANGAR '+ROMAN[lv]:'NO HANGAR')+' · FIELD '+cap+' · ROSTER '+T.p.length+'/'+B.ROSTER_MAX,row);}
 if(!T.p.length){el('p','cq-bat-empty',T.w?'Your roster is empty.':'No pilots yet. A pilot is down at the colony\'s south fields: rescue them and they fly with you as your wingman.',d);}
 {const next=lv>=5?'':lv?'HANGAR '+ROMAN[lv+1]+' (CC'+(2*(lv+1)-1)+') fields '+B.FIELD[lv+1]+(lv+1===B.ROLES_AT?' and opens roles, COMMAND orders and formations':''):'Build a Hangar in your town (CC2) to field 2 and recruit.';if(next)el('small','cq-bat-next','NEXT · '+next,d);}
 // presets and formation (formations and roles open with Hangar II)
 {const row=el('div','cq-bat-presets',null,d);for(let i=0;i<B.PRESETS;i++){const p=T.ps[i]||{f:'wedge',ids:[]},b=button('P'+(i+1)+' · '+(B.FORM_NAMES[p.f]||'WEDGE'),()=>ctx.act('hangar-preset',{i}),'cq-bat-preset'+(i===(T.pa|0)?' cq-on':''));b.setAttribute('aria-pressed',String(i===(T.pa|0)));row.append(b);}
  const f=el('div','cq-bat-forms',null,d),cur=T.ps[T.pa|0]?.f||'wedge';for(const k of B.FORMATIONS){const b=button(B.FORM_NAMES[k],()=>ctx.act('hangar-preset',{i:T.pa|0,f:k}),'cq-bat-form'+(k===cur?' cq-on':''));b.disabled=!open&&k!==cur;b.setAttribute('aria-pressed',String(k===cur));f.append(b);}
  if(!open)el('small','cq-bat-lock','🔒 Formations, roles and COMMAND orders open with Hangar level II.',d);}
 {const r=el('div','cq-bat-tools',null,d);r.append(button('AUTO-ARM',()=>ctx.act('hangar-arm',{}),'cq-bat-arm'));el('small','','Your best spare weapons and chassis, one item per tank. No spare gear: a militia kit (Common, no cores): a green crew that hesitates, and freezes up against VETERAN hives.',r);}
 const hurt=T.p.filter(p=>p.h<1);if(hurt.length){const r=el('div','cq-bat-repair',null,d);const cost=B.REPAIR.alloy*hurt.length,b=button('REPAIR '+hurt.length+' PILOT'+(hurt.length>1?'S':'')+' · '+cost+' ALLOY',()=>ctx.act('hangar-repair',{}),'cq-bat-repair-go');r.append(b);el('small','',hurt.length+' at half hull (downed in a fight, never lost). Repair at the Refuge supply terminal or your town.',r);}
 // the roster: tap a card to put the pilot in (or take them out of) the active preset's force; the number is the order they deploy in
 const grid=el('div','cq-bat-grid',null,d),ids=T.ps[T.pa|0]?.ids||[],field=B.picked(T,lv,'battalion').map(p=>p.id);
 for(const p of T.p){const c=el('div','cq-bat-card'+(p.h<1?' cq-bat-hurt':''),null,grid),at=ids.indexOf(p.id),deployed=field.indexOf(p.id);c.style.setProperty('--rc',ROLE_C[p.r||'']);
  const top=el('div','cq-bat-card-top',null,c);badge(el,top,p.r);el('b','cq-bat-cs',p.cs,top);el('span','cq-bat-slot',deployed>=0&&deployed<cap?'#'+(deployed+1):'RESERVE',top);
  el('small','cq-bat-name',p.n,c);el('small','cq-bat-rolename',roleName(p.r)+(p.r?' · CORE '+ROMAN[rcLv(s,p.r)]:''),c);
  {const nx=B.RANK_XP[p.rk]??null,base=B.RANK_XP[p.rk-1]||0,row=el('div','cq-bat-rank',null,c);el('span','cq-bat-chev','▲'.repeat(Math.min(3,B.sigTier(p.rk)+1)),row);el('small','','R'+p.rk+' '+B.RANK_NAMES[p.rk]+(nx?' · '+(p.xp-base)+'/'+(nx-base)+' XP':' · MAX'),row);if(nx){const bar=el('progress','cq-bat-xp',null,c);bar.max=nx-base;bar.value=Math.max(0,p.xp-base);bar.setAttribute('aria-label',p.cs+' rank progress');}}
  el('small','cq-bat-gear',gearLine(p.kit),c);el('small','cq-bat-status',(p.h<1?'HALF HULL · REPAIR':'READY')+' · '+(p.k|0)+' KILLS',c);
  const auto=at<0&&deployed>=0&&deployed<cap,tog=button(at>=0?'IN FORCE #'+(at+1):auto?'IN FORCE #'+(deployed+1)+' · AUTO':'ADD TO FORCE',()=>{const list=at>=0?ids.filter(x=>x!==p.id):auto?field.slice(0,cap).filter(x=>x!==p.id):[...ids,p.id].slice(0,9);ctx.act('hangar-preset',{i:T.pa|0,ids:list});},'cq-bat-toggle'+(at>=0||auto?' cq-on':''));   /* an empty preset fields the roster in order: those pilots read IN FORCE (AUTO) */c.append(tog);
  if(open){const r=button('ROLE · '+roleName(p.r),()=>rolePicker(d,s,p,ctx),'cq-bat-rolebtn');c.append(r);}}
 // recruits: the Hangar's RECRUIT job (8 h, time only), the day's BEACON EXTRACTION win
 {const r=el('div','cq-bat-recruit',null,d);el('h3','','RECRUITS',r);
  if(T.rj){const left=Math.max(0,T.rj.left-Math.max(0,now-(T.rj.at||now)));el('p','cq-bat-job','A RECRUIT ARRIVES IN '+t2(left),r);const pr=el('progress','',null,r);pr.max=T.rj.ms||28800000;pr.value=pr.max-left;pr.setAttribute('aria-label','Recruit on the way');
   if(root.ConquestLabStore?.row)root.ConquestLabStore.row(r,'rcfin',{left,job:T.rj.id},{el,button,state:s});}
  else if(T.p.length>=B.ROSTER_MAX)el('p','','ROSTER FULL · '+B.ROSTER_MAX+'/'+B.ROSTER_MAX,r);
  else if(lv<1)el('small','','Build a Hangar in your town (CC2) to recruit (one at a time, 8 h, no CP). ',r);
  else r.append(button('RECRUIT A PILOT · 8 H',()=>ctx.act('hangar-recruit',{}),'cq-bat-recruit-go'));
  el('small','','Also: your first win of BEACON EXTRACTION each UTC day brings one pilot. Pilots, ranks and Role Core levels are never sold.',r);}
 // liveries: looks only (your paint and banner on every ally, or a plain set); allies wear their stock paint by default
 if(root.ConquestLabStore?.row&&typeof LIVERIES==='object'){const f=el('details','cq-map-fold cq-bat-liveries',null,d);el('summary','','BATTALION LIVERIES · LOOKS ONLY',f);
  const own=s?.bat?.lv||'';for(const id of LIVERY_ORDER){const L=LIVERIES[id],row=el('div','cq-bat-livery',null,f);const sw=el('span','cq-bat-swatch',null,row);sw.style.background=L.own?'linear-gradient(135deg,#88cbdc 50%,#d9c27a 50%)':'linear-gradient(135deg,'+L.p+' 55%,'+L.a+' 55%)';el('b','',L.n.toUpperCase(),row);el('small','',L.d,row);
   const owned=!!(typeof save==='object'&&save?.liv?.[id]);if(owned)row.append(button(own===id?'WEARING':'WEAR ON MY ALLIES',()=>ctx.act('hangar-livery',{id:own===id?'':id}),'cq-bat-wear'));else root.ConquestLabStore.row(row,'livery',{tk:id},{el,button,state:s});}
  el('small','','Stock paint is the default. LDF regulars always wear the LDF livery.',f);}
 {const f=el('details','cq-map-fold cq-bat-help',null,d);el('summary','','ROLES · WHAT EACH ANSWERS',f);for(const r of CB().ROLE_ORDER){const I=B.ROLE_INFO[r],row=el('div','cq-bat-help-row',null,f);badge(el,row,r);el('b','',I.n.toUpperCase()+' · '+I.chassis,row);el('small','',I.sig+'. Answers: '+I.answers+'.',row);}
  el('small','','Ranks 3, 6 and 9 and each Role Core level make a pilot\'s role signature stronger. Combos come from mechanics: Corroder + Lancer, Frostline + Breacher, Guardian + Mender.',f);}
 return d;}
function rolePicker(d,s,p,ctx){const {el,button}=ctx,B=BT(),x=el('div','cq-bat-picker',null,d);x.setAttribute('role','group');x.setAttribute('aria-label','Pick a role for '+p.cs);el('b','','ROLE FOR '+p.cs,x);
 for(const r of CB().ROLE_ORDER){const I=B.ROLE_INFO[r],b=button('',()=>{x.remove();ctx.act('hangar-role',{pilot:p.id,role:r});},'cq-bat-pick'+(p.r===r?' cq-on':''));badge(el,b,r);el('span','',I.n.toUpperCase()+' · '+I.chassis,b);el('small','',I.answers,b);x.append(b);}
 x.append(button('CANCEL',()=>x.remove(),'cq-bat-pick-cancel'));x.scrollIntoView?.({block:'nearest'});x.querySelector('button')?.focus?.();}
// ---- the briefing strip: the enemy roster (icons, one hint line) and your picked force, beside the zone band ----
function strip(parent,s,op,ctx){const {el,button}=ctx,B=BT();if(!B||!op)return null;const R=B.enemyRoster(op),scale=B.scaleOf(op),lv=hangarLv(s),T=s?.bat;
 const st=el('div','cq-bat-strip',null,parent);const er=el('div','cq-bat-enemies',null,st);el('b','cq-bat-strip-k','ENEMY',er);
 for(const u of R.units){const c=el('span','cq-bat-foe'+(u.heavy?' cq-heavy':'')+(u.air?' cq-air':'')+(u.k==='boss'?' cq-boss':''),null,er);el('i','',u.k==='boss'?'★':u.air?'▲':u.heavy?'■':'●',c);el('small','',(u.n>1?u.n+'× ':'')+u.name.toUpperCase(),c);}
 el('small','cq-bat-hint',R.hint,st);
 const mine=T?B.picked(T,lv,scale):[],fr=el('div','cq-bat-force',null,st);el('b','cq-bat-strip-k',scale==='battalion'?'BATTALION':scale==='platoon'?'PLATOON':'WING',fr);
 if(!mine.length)el('small','',T?.w?'No pilot fielded.':'Solo: rescue the downed pilot to fly with a wingman.',fr);
 for(const p of mine){const c=el('span','cq-bat-mine'+(p.h<1?' cq-bat-hurt':''),null,fr);badge(el,c,p.r);el('small','',p.cs+(p.h<1?' · ½':''),c);}
 // Session 6C section 9: militia crews freeze up in a VETERAN operation (combat.js MILITIA_VET); say so where the force is picked
 if(T&&lv>=B.ROLES_AT&&mine.length){const miss=R.want.filter(r=>!mine.some(p=>p.r===r));if(miss.length){const w=el('small','cq-bat-miss','✗ NO '+miss.map(r=>B.ROLE_INFO[r].n.toUpperCase()).join(' OR ')+' IN THIS FORCE · set a role in the HANGAR',st);w.setAttribute('role','note');}}   // the hint's roles you are not bringing
 if(op.danger==='VETERAN'&&mine.some(p=>!p.kit||p.kit.mil)){const w=el('small','cq-bat-warn','⚠ MILITIA CREWS FREEZE UP AGAINST VETERAN HIVES · AUTO-ARM them with spare gear in the HANGAR',st);w.setAttribute('role','note');}
 if(T&&lv>=B.ROLES_AT&&ctx.act){const row=el('div','cq-bat-strip-presets',null,st);for(let i=0;i<B.PRESETS;i++){const b=button('P'+(i+1),()=>ctx.act('hangar-preset',{i}),'cq-bat-preset'+(i===(T.pa|0)?' cq-on':''));b.setAttribute('aria-pressed',String(i===(T.pa|0)));b.title='Preset '+(i+1)+': '+(B.FORM_NAMES[T.ps?.[i]?.f]||'WEDGE');row.append(b);}}
 forceChip(el,st,s,scale);return st;}
// ---- the hub's BATTALION card ----
function hubCard(card,s,ctx){const {el,button}=ctx,B=BT(),T=s?.bat,lv=hangarLv(s);if(!B)return;
 const p=T?.p||[],cap=B.fieldCap(lv);el('p','cq-hub-big',p.length?(p.length===1?'WINGMAN '+p[0].cs+' · R'+p[0].rk:p.length+' PILOTS · FIELD '+Math.min(cap,p.length)):'NO PILOTS YET',card);
 forceChip(el,card,s,lv>=2?'platoon':'wing');
 const cd=chipDay(s,ctx.now||Date.now()),c=el('small','cq-hub-chip-day'+(cd.n?' cq-hub-part-done':''),cd.text+' · '+chipsHeld(s).total+' HELD',card);c.title=cd.rule;
 if(T?.rj){const left=Math.max(0,T.rj.left-Math.max(0,(ctx.now||Date.now())-(T.rj.at||0)));el('small','','RECRUIT ARRIVES IN '+t2(left),card);}
 else if(!p.length)el('small','',T?.w?'':'A downed pilot near the Refuge waits for rescue: your first wingman.',card);
 if(ctx.btn||ctx.open)card.append(ctx.btn||button('OPEN HANGAR',ctx.open,'cq-hub-hangar'));}   // ctx.btn: one persistent node (the hub rebuilds its cards every second: a fresh button each time could lose a tap)
// ---- the after-action: what the fight did for your pilots ----
function aarLines(t){const B=BT(),out=[];if(!t)return out;
 if(t.joined)out.push({t:'WINGMAN JOINED · '+t.joined.cs+' ('+t.joined.n+') flies with you now',c:'cq-aar-bat-join'});
 if(t.recruit)out.push({t:'NEW RECRUIT · '+t.recruit.cs+' ('+t.recruit.n+') from the rescue',c:'cq-aar-bat-join'});
 if(t.xp)out.push({t:'+'+t.xp+' XP to every pilot fielded',c:'cq-aar-bat-xp'});
 for(const u of t.up||[])out.push({t:u.cs+' · RANK '+u.rk+' '+B.RANK_NAMES[u.rk]+(u.sig?' · ROLE SIGNATURE UP':''),c:'cq-aar-bat-rank'});
 if(t.chip?.chip)out.push({t:'+1 COMMAND CHIP · '+t.chip.held+' held (your first win today)',c:'cq-aar-bat-chip'});else if(t.chip?.full)out.push({t:'COMMAND CHIPS FULL ('+t.chip.held+'): spend some at the Science Lab',c:'cq-aar-bat-chip'});
 return out;}
root.ConquestHangar=Object.freeze({screen,strip,hubCard,aarLines,chipDay,chipsHeld,forceOf,forceChip,hangarLv,rolesOpen,ROLE_C,ROLE_L,roleName,gearLine,badge});
})(globalThis);
