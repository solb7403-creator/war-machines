// Command Base town actions (Session 5, Session 5B Town Defense). Server-authoritative: every build, upgrade, move, wall
// order, collect, Foundry load, research, site change and Defense Drill is validated here on the Worker clock with the shared
// rules (js/conquest/plot.js, ConquestPlot). The phone only previews. Costs spend BANKED Conquest materials and the town's
// wall composite; mineral costs spend the pilot's base stores, which are the minerals the pilot moved from the account wallet
// (eco `bmn`, monotonic) minus what the plot has spent (plot.mnSpent). The eco counter only ever grows, so a stale read can
// refuse a build but never overspend.
import {CONQUEST,RULES} from './sim.gen.js';
import {nameBlocked} from './callsign.js';
import {bankMinerals} from './conquest-airdrop.js';
const P=CONQUEST.Plot,DAY=86400000;
export const PLOT_ACTIONS=['plot-site','plot-build','plot-upgrade','plot-move','plot-remove','plot-wall','plot-collect','plot-drill','plot-banner','plot-theme','plot-feed','plot-research','plot-repair','plot-layout','plot-name'];
// Which plot actions may run from the MAP (remote command): upgrades spend already-banked goods, as before Session 5.
export const REMOTE_PLOT_ACTIONS=['plot-upgrade'];
export const MINERAL_PLOT_ACTIONS=['plot-build','plot-upgrade','plot-wall','plot-research','base-module','upgrade-base'];
// Wall orders carry shapes or cell lists (the fast wall tools): a larger request body than other plot actions.
export const BIG_PLOT_ACTIONS=['plot-wall','plot-remove'];
const fail=m=>{throw Error('conquest: '+m);};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const SITE_CHANGE={alloy:150,cooldownMs:DAY};
// Called from campaign(): create/migrate the plot, finish the builder's job, accrue production, and derive the old Command
// Base fields (tier, modules) so every existing system (points multiplier, yield, travel, banking, repair, radar,
// mitigation, CP production) keeps reading exactly what it read before.
export function plotSync(s,now){const b=s.base;if(!b?.tier&&!s.plot)return null;
 if(!s.plot){s.plot=P.migrate(b,now);delete b.pending;}
 else if(s.plot.v!==2)s.plot=P.resetPlot(s.plot,now);   // Session 5B: no live players; a Session 5 plot becomes a fresh town claim (same site and CC level)
 const p=s.plot;p.b=record(p.b)?p.b:{};p.w=record(p.w)?p.w:{};p.mnSpent=record(p.mnSpent)?p.mnSpent:{};p.log=Array.isArray(p.log)?p.log:Object.values(p.log||{});
 p.dmg=record(p.dmg)?p.dmg:{};p.ws=P.stockOf(p);p.lay=record(p.lay)?p.lay:{};p.alerts=Array.isArray(p.alerts)?p.alerts:Object.values(p.alerts||{});p.shieldUntil=Number(p.shieldUntil)||0;   // Session 5B addendum hooks (damage, wall storage, layouts, alerts, peace shield)
 p.ext=record(p.ext)?p.ext:{};p.ext.r=p.ext.r|0;p.ext.d=p.ext.d|0;p.ext.w=Math.max(p.ext.w|0,b?.defense?.wins|0);p.cm=Math.max(0,Number(p.cm)||0);p.fh=Math.max(0,Number(p.fh)||0);
 if(p.theme&&typeof p.theme==='object')p.theme.decor=Array.isArray(p.theme.decor)?p.theme.decor:Object.values(p.theme.decor||{});   // Firebase drops an empty list
 if(!p.b.cc)p.b.cc={t:'cc',...(P.autoPlace(p,'cc')||{i:37,j:37,r:0}),l:p.cc|0};
 const done=P.settle(p,now);if(done)s.notice={kind:'plot-built',type:done.t,level:done.l};
 for(const k of Object.keys(p.dmg))if(!P.maxHpOf(p,k)||!(Number(p.dmg[k])>0))delete p.dmg[k];   // damage of a structure that no longer exists
 P.accrue(p,now);b.tier=P.tierOf(p.cc);b.modules=P.modulesOf(p);p.power=P.power(p);p.def=P.defenseRating(p);
 p.gar={n:P.garrisonSlots(p),t:Array.isArray(p.gar?.t)?p.gar.t:Object.values(p.gar?.t||{})};   // garrison hook: Hangar defenders (Session 7)
 return p;}
function mnAvail(s,ctx){const have=RULES.mnOf(ctx?.bmn),spent=s.plot?.mnSpent||{},o={};for(const k of P.MNS)o[k]=Math.max(0,(have[k]||0)-(spent[k]||0));return o;}
// 'cm' is the town's wall composite (whole units); minerals come from the base stores; everything else is banked.
function debit(s,price,ctx){const avail=mnAvail(s,ctx);for(const [k,n] of Object.entries(price||{})){if(!Number.isSafeInteger(n)||n<0)fail('invalid recipe');const have=k==='cp'?s.ledger.cp:k==='cm'?Math.floor(s.plot.cm||0):P.MNS.includes(k)?avail[k]:s.ledger.banked[k];
  if(have<n)fail(k==='cm'?'not enough wall composite: need '+n+', have '+have+' (the Foundry makes more)':(P.MNS.includes(k)?'base stores need ':'insufficient banked ')+k+': need '+n+(P.MNS.includes(k)?' (move minerals to base stores)':''));}
 for(const [k,n] of Object.entries(price||{})){if(k==='cp')s.ledger.cp-=n;else if(k==='cm')s.plot.cm-=n;else if(P.MNS.includes(k))s.plot.mnSpent[k]=(s.plot.mnSpent[k]||0)+n;else s.ledger.banked[k]-=n;}}
// Walls removed by a site change (now blocked ground) give back their composite and the whole ore units they used (no loss);
// a dev-mode test record's walls were free, so nothing comes back.
function refundWalls(s,keys){const p=s.plot,units=[0,0,0,0,0,0,0];let cm=0;for(const k of keys){const {o,l}=P.wdecode(p.w[k]);cm+=P.COMPOSITE.perCell;units[o]+=P.ORE_UNITS[o]*P.BLEND_UNITS[l];delete p.w[k];delete p.dmg['w:'+k];}
 if(s.dev?.used)return;p.cm=(p.cm||0)+cm;for(let o=1;o<=6;o++){const m=P.ORES[o-1],n=Math.floor(units[o]/40);if(n)p.mnSpent[m]=Math.max(0,(p.mnSpent[m]||0)-n);}}
const int=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi,own=(o,k)=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k);
function job(p,t,id,l,now){if(p.job)fail('builder busy: '+(p.job.t==='repair'?'repairs':P.BUILDINGS[p.job.t]?.n||'Command Center')+' ready in '+Math.max(1,Math.ceil((p.job.ready-now)/1000))+'s');p.job={id,t,l,at:now,ready:now+P.timeOf(t,l)};}
export function upgrade(s,id,now,ctx){const p=s.plot;if(id==='cc'){const l=(p.cc|0)+1,e=P.buildCheck(p,'cc',l);if(e)fail(e);job(p,'cc','cc',l,now);debit(s,P.costOf('cc',l),ctx);return;}
 const b=own(p.b,id)?p.b[id]:null;if(!b||b.t==='cc')fail('unknown building');const l=(b.l|0)+1,e=P.buildCheck(p,b.t,l,id);if(e)fail(e);job(p,b.t,id,l,now);debit(s,P.costOf(b.t,l),ctx);}
// Old remote module command, kept for clients mid-update: upgrades (or places) the building that module became.
export function legacyModule(s,module,now,ctx){const type=Object.keys(P.BUILDINGS).find(k=>P.BUILDINGS[k].mod===module);if(!type)fail('invalid module');const p=s.plot;let id=Object.keys(p.b).find(k=>p.b[k].t===type);
 if(!id){const at=P.autoPlace(p,type);if(!at)fail('no room for '+P.BUILDINGS[type].n);const e=P.buildCheck(p,type,1);if(e)fail(e);id='b'+(++p.n);p.b[id]={t:type,...at,l:0};try{job(p,type,id,1,now);debit(s,P.costOf(type,1),ctx);}catch(err){delete p.b[id];p.n--;throw err;}return;}
 upgrade(s,id,now,ctx);}
export function plotAction(s,r,now,ctx={}){const p=s.plot;if(!p)fail('build your Command Base first');const a=r.plot;if(!record(a))fail('invalid plot request');
 const only=keys=>{if(Object.keys(a).some(k=>!keys.includes(k)))fail('invalid plot fields');};
 if(r.action==='plot-site'){only(['site']);if(!own(P.SITES,a.site))fail('invalid site');if(a.site===p.site)fail('already on that site');
  const free=!p.siteFree;if(!free){if(now<(p.siteAt||0)+SITE_CHANGE.cooldownMs)fail('site change cooldown: '+Math.ceil(((p.siteAt||0)+SITE_CHANGE.cooldownMs-now)/3600000)+' h');debit(s,{alloy:SITE_CHANGE.alloy},ctx);}
  p.site=a.site;p.siteFree=1;p.siteAt=now;
  // Re-seat anything the new terrain blocks: buildings move to the nearest free spot; walls on blocked ground are removed
  // and their minerals return to the base stores (no loss).
  refundWalls(s,Object.keys(p.w).filter(k=>{const [i,j]=k.split(',').map(Number);return P.NOBUILD[P.terrainAt(p.site,i,j)];}));
  for(const [id,b] of Object.entries(p.b)){if(!P.placeError(p,b.t,b.i,b.j,b.r|0,id))continue;const t=b.t;const at=P.autoPlace({...p,b:Object.fromEntries(Object.entries(p.b).filter(([k])=>k!==id))},t,b.r|0)||P.autoPlace({...p,b:Object.fromEntries(Object.entries(p.b).filter(([k])=>k!==id))},t,0);if(at)Object.assign(b,at);}
  s.notice={kind:'plot-site',site:p.site,free};return;}
 if(r.action==='plot-build'){only(['type','i','j','r']);const B=own(P.BUILDINGS,a.type)?P.BUILDINGS[a.type]:null;if(!B)fail('unknown building');const e=P.buildCheck(p,a.type,1)||P.placeError(p,a.type,a.i,a.j,a.r|0);if(e)fail(e);
  if(p.job)fail('builder busy');const id='b'+(++p.n);p.b[id]={t:a.type,i:a.i,j:a.j,r:a.r|0,l:0};try{job(p,a.type,id,1,now);debit(s,P.costOf(a.type,1),ctx);}catch(err){delete p.b[id];p.n--;throw err;}s.notice={kind:'plot-started',type:a.type,level:1};return;}
 if(r.action==='plot-upgrade'){only(['id']);if(typeof a.id!=='string'||a.id!=='cc'&&!own(p.b,a.id))fail('unknown building');upgrade(s,a.id,now,ctx);s.notice={kind:'plot-started',type:a.id==='cc'?'cc':p.b[a.id].t,level:a.id==='cc'?p.job.l:p.job.l};return;}
 if(r.action==='plot-move'){only(['id','i','j','r']);const b=own(p.b,a.id)?p.b[a.id]:null;if(!b)fail('unknown building');if(p.job?.id===a.id&&!(b.l>0))fail('wait for construction');const e=P.placeError(p,b.t,a.i,a.j,a.r|0,a.id);if(e)fail(e);b.i=a.i;b.j=a.j;b.r=a.r|0;s.notice={kind:'plot-moved',id:a.id};return;}
 if(r.action==='plot-remove'){only(['id','w']);
  // removing walls gives their composite back (not the ore); a dev-mode test record's walls were free, so nothing comes back
  if(a.w!==undefined){const plan=P.wallRemovePlan(p,a.w);if(plan.err)fail(plan.err);let share=0;for(const k of plan.keys){const m=P.maxHpOf(p,'w:'+k);share+=m?P.hpLeft(p,'w:'+k)/m:1;delete p.w[k];delete p.dmg['w:'+k];}const back=s.dev?.used?0:Math.floor(share*P.COMPOSITE.perCell/2);p.cm=(p.cm||0)+back;s.notice={kind:'plot-wall-removed',n:plan.keys.length,cm:back};return;}   // 50% of the composite back (a damaged wall: of what is left), none of the ore (no refund loop)
  const b=own(p.b,a.id)?p.b[a.id]:null;if(!b||['cc','storage'].includes(b.t))fail('that building cannot be removed');if(p.job?.id===a.id)fail('wait for construction');
  const back=s.dev?.used?{}:P.turretRefund(b);for(const [k,n] of Object.entries(back)){if(k==='cp')s.ledger.cp+=n;else s.ledger.banked[k]=(s.ledger.banked[k]||0)+n;}   // a turret returns 50% of its cost; other buildings nothing
  delete p.b[a.id];delete p.dmg[a.id];s.notice={kind:'plot-removed',type:b.t,refund:back};return;}
 if(r.action==='plot-wall'){only(['s']);const plan=P.wallPlan(p,a.s,{dev:!!p.devx});if(plan.err)fail(plan.err);debit(s,plan.cost,ctx);for(const c of plan.cells){const k=P.key(c.i,c.j);p.w[k]=c.code;if(c.isNew)delete p.dmg['w:'+k];}   // re-blending a damaged wall keeps its damage (REPAIR fixes it)for(const [c,n] of Object.entries(plan.used||{})){p.ws[c]=(p.ws[c]|0)-n;if(p.ws[c]<=0)delete p.ws[c];}   // cells from storage (a layout switch) are free
  s.notice={kind:'plot-wall',n:plan.cells.length,fresh:plan.fresh,skip:plan.skip};return;}
 if(r.action==='plot-feed'){only(['n']);const c=P.caps(p);if(!c.fh)fail('build a Foundry first');if(!int(a.n,1,10000))fail('invalid amount');const room=Math.floor(c.fh-(p.fh||0));if(room<1)fail('the Foundry hopper is full');const n=Math.min(a.n,room);
  debit(s,{alloy:n},ctx);p.fh=(p.fh||0)+n;s.notice={kind:'plot-feed',n};return;}
 if(r.action==='plot-repair'){only([]);const plan=P.repairPlan(p);if(!plan.keys.length)fail('nothing to repair');if(p.job)fail('builder busy');debit(s,plan.cost,ctx);p.job={id:'repair',t:'repair',l:0,fix:plan.fix,at:now,ready:now+plan.ms};s.notice={kind:'plot-repair',n:plan.keys.length,ms:plan.ms};return;}
 if(r.action==='plot-layout'){only(['op','k']);if(!['save','apply'].includes(a.op)||!int(a.k,0,P.LAYOUT.slots-1))fail('invalid layout slot');const slot='s'+a.k;
  if(a.op==='save'){p.lay[slot]=P.layoutOf(p,now);s.notice={kind:'plot-layout',op:'save',k:a.k};return;}
  const e=P.applyLayout(p,p.lay[slot]);if(e)fail(e);s.notice={kind:'plot-layout',op:'apply',k:a.k,stored:Object.values(p.ws).reduce((x,n)=>x+n,0)};return;}
 if(r.action==='plot-research'){only([]);const k=p.ext.r|0,step=P.EXT.research[k];if(!step)fail('all Foundry research done');if(P.levelOf(p,'foundry')<step.fl)fail('needs a Foundry at level '+step.fl);
  debit(s,step.cost,ctx);p.ext.r=k+1;s.notice={kind:'plot-research',step:k+1,pct:step.pct};return;}
 if(r.action==='plot-collect'){only([]);const st=p.st,got={alloy:Math.floor(st.alloy||0),biomass:Math.floor(st.biomass||0),helium:Math.floor(st.helium||0),fe:Math.floor(st.fe||0)};if(!got.alloy&&!got.biomass&&!got.helium&&!got.fe)fail('nothing to collect yet');
  for(const k of ['alloy','biomass','helium']){s.ledger.banked[k]+=got[k];st[k]-=got[k];}if(got.fe){st.fe-=got.fe;bankMinerals(s,{fe:got.fe});}s.notice={kind:'plot-collected',...got};return;}
 if(r.action==='plot-drill'){only([]);if(now<(p.drillAt||0)+60000)fail('drill crews reset: '+Math.ceil(((p.drillAt||0)+60000-now)/1000)+'s');
  // No rewards, ever: the drill reads the layout and writes only the base log and, the first time a drill is held at a
  // milestone Command Center level, the wall-extension milestone the brief lists as an earned path (capacity only).
  const seed=(P.hash(Math.floor(now/1000),p.n|0,Object.keys(p.w).length)*4294967296)>>>0,R=P.drill(p,seed,{frames:false,events:false});
  let ext=0;if(R.outcome!=='breached'&&R.core>=50)P.EXT.drill.forEach((m,k)=>{if((p.cc|0)>=m.cc&&!((p.ext.d>>k)&1)){p.ext.d|=1<<k;ext+=m.pct;}});
  p.drillAt=now;p.log=[{at:now,seed,threat:R.threat,outcome:R.outcome,kills:R.kills,spawned:R.spawned,lost:R.lost,core:R.core,time:R.time,power:p.power,walls:R.wallsLost,homes:R.homesLost,vitals:R.vitals,breaches:R.breaches.length,...(ext?{ext}:{})},...p.log].slice(0,8);P.alert(p,{at:now,kind:'drill',by:'drill crews',outcome:R.outcome,changed:ext?1:0});s.notice={kind:'plot-drill',...p.log[0]};return;}
 // Session 5C: the town's name (cosmetic; on the HOME card, visits, the hub and the share card). Validated here, never trusted from the phone.
 if(r.action==='plot-name'){only(['n']);if(typeof a.n!=='string'||a.n.length>64)fail('invalid town name');const t=P.townName(a.n);if(t.err)fail(t.err);if(t.name&&nameBlocked(t.name))fail('that name is not allowed: please pick another');if(t.name)p.nm=t.name;else delete p.nm;s.notice={kind:'plot-name',n:t.name};return;}
 if(r.action==='plot-banner'){only(['shape','colors','emblem']);if(!['shield','pennant','square','chevron'].includes(a.shape)||!Array.isArray(a.colors)||a.colors.length!==2||!a.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))||!['moon','tank','star','skull','gear','wing','bolt','crown'].includes(a.emblem))fail('invalid banner');
  p.banner={shape:a.shape,colors:a.colors.map(c=>c.toLowerCase()),emblem:a.emblem};s.notice={kind:'plot-banner'};return;}
 if(r.action==='plot-theme'){only(['light','finish','decor']);if(!['cyan','amber','violet','green','red'].includes(a.light)||!['steel','sand','graphite'].includes(a.finish)||!Array.isArray(a.decor)||a.decor.length>6||!a.decor.every(d=>['flags','lamps','crates','antenna','plants','statue'].includes(d)))fail('invalid theme');
  p.theme={light:a.light,finish:a.finish,decor:[...new Set(a.decor)]};s.notice={kind:'plot-theme'};return;}
 fail('invalid plot action');}
