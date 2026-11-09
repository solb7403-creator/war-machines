// Command Base plot actions (Session 5). Server-authoritative: every build, upgrade, move, wall, collect, site change and
// Defense Drill is validated here on the Worker clock with the shared rules (js/conquest/plot.js, ConquestPlot). The phone
// only previews. Costs spend BANKED Conquest materials; mineral costs spend the pilot's base stores, which are the minerals
// the pilot moved from the account wallet (eco `bmn`, monotonic) minus what the plot has spent (plot.mnSpent). The eco
// counter only ever grows, so a stale read can refuse a build but never overspend.
import {CONQUEST,RULES} from './sim.gen.js';
import {bankMinerals} from './conquest-airdrop.js';
const P=CONQUEST.Plot,DAY=86400000;
export const PLOT_ACTIONS=['plot-site','plot-build','plot-upgrade','plot-move','plot-remove','plot-wall','plot-collect','plot-drill','plot-banner','plot-theme'];
// Which plot actions may run from the MAP (remote command): upgrades spend already-banked goods, as before Session 5.
export const REMOTE_PLOT_ACTIONS=['plot-upgrade'];
export const MINERAL_PLOT_ACTIONS=['plot-build','plot-upgrade','plot-wall','base-module','upgrade-base'];
const fail=m=>{throw Error('conquest: '+m);};
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const SITE_CHANGE={alloy:150,cooldownMs:DAY};
// Called from campaign(): create/migrate the plot, finish the builder's job, accrue production, and derive the old Command
// Base fields (tier, modules) so every existing system (points multiplier, yield, travel, banking, repair, radar,
// mitigation, CP production) keeps reading exactly what it read before.
export function plotSync(s,now){const b=s.base;if(!b?.tier&&!s.plot)return null;
 if(!s.plot||s.plot.v!==1){s.plot=P.migrate(b,now);delete b.pending;}
 const p=s.plot;p.b=record(p.b)?p.b:{};p.w=record(p.w)?p.w:{};p.mnSpent=record(p.mnSpent)?p.mnSpent:{};p.log=Array.isArray(p.log)?p.log:Object.values(p.log||{});
 if(p.theme&&typeof p.theme==='object')p.theme.decor=Array.isArray(p.theme.decor)?p.theme.decor:Object.values(p.theme.decor||{});   // Firebase drops an empty list
 if(!p.b.cc)p.b.cc={t:'cc',...(P.autoPlace(p,'cc')||{i:20,j:20,r:0}),l:p.cc|0};
 const done=P.settle(p,now);if(done)s.notice={kind:'plot-built',type:done.t,level:done.l};
 P.accrue(p,now);b.tier=P.tierOf(p.cc);b.modules=P.modulesOf(p);p.power=P.power(p);return p;}
function mnAvail(s,ctx){const have=RULES.mnOf(ctx?.bmn),spent=s.plot?.mnSpent||{},o={};for(const k of P.MNS)o[k]=Math.max(0,(have[k]||0)-(spent[k]||0));return o;}
function debit(s,price,ctx){const avail=mnAvail(s,ctx);for(const [k,n] of Object.entries(price||{})){if(!Number.isSafeInteger(n)||n<0)fail('invalid recipe');const have=k==='cp'?s.ledger.cp:P.MNS.includes(k)?avail[k]:s.ledger.banked[k];if(have<n)fail((P.MNS.includes(k)?'base stores need ':'insufficient banked ')+k+': need '+n+(P.MNS.includes(k)?' (move minerals to base stores)':''));}
 for(const [k,n] of Object.entries(price||{})){if(k==='cp')s.ledger.cp-=n;else if(P.MNS.includes(k))s.plot.mnSpent[k]=(s.plot.mnSpent[k]||0)+n;else s.ledger.banked[k]-=n;}}
const int=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi,own=(o,k)=>typeof k==='string'&&Object.prototype.hasOwnProperty.call(o,k);
function job(p,t,id,l,now){if(p.job)fail('builder busy: '+(P.BUILDINGS[p.job.t]?.n||'Command Center')+' ready in '+Math.max(1,Math.ceil((p.job.ready-now)/1000))+'s');p.job={id,t,l,at:now,ready:now+P.timeOf(t,l)};}
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
  for(const [k,t] of Object.entries(p.w)){const [i,j]=k.split(',').map(Number);if(P.BLOCKED[P.terrainAt(p.site,i,j)]){delete p.w[k];if(!s.dev?.used)for(const [m,n] of Object.entries(P.WALLS[t].cost))if(P.MNS.includes(m))p.mnSpent[m]=Math.max(0,(p.mnSpent[m]||0)-n);}/* a dev-mode test record's walls were free: no refund */}
  for(const [id,b] of Object.entries(p.b)){if(!P.placeError(p,b.t,b.i,b.j,b.r|0,id))continue;const t=b.t;const at=P.autoPlace({...p,b:Object.fromEntries(Object.entries(p.b).filter(([k])=>k!==id))},t,b.r|0)||P.autoPlace({...p,b:Object.fromEntries(Object.entries(p.b).filter(([k])=>k!==id))},t,0);if(at)Object.assign(b,at);}
  s.notice={kind:'plot-site',site:p.site,free};return;}
 if(r.action==='plot-build'){only(['type','i','j','r']);const B=own(P.BUILDINGS,a.type)?P.BUILDINGS[a.type]:null;if(!B)fail('unknown building');const e=P.buildCheck(p,a.type,1)||P.placeError(p,a.type,a.i,a.j,a.r|0);if(e)fail(e);
  if(p.job)fail('builder busy');const id='b'+(++p.n);p.b[id]={t:a.type,i:a.i,j:a.j,r:a.r|0,l:0};try{job(p,a.type,id,1,now);debit(s,P.costOf(a.type,1),ctx);}catch(err){delete p.b[id];p.n--;throw err;}s.notice={kind:'plot-started',type:a.type,level:1};return;}
 if(r.action==='plot-upgrade'){only(['id']);if(typeof a.id!=='string'||a.id!=='cc'&&!own(p.b,a.id))fail('unknown building');upgrade(s,a.id,now,ctx);s.notice={kind:'plot-started',type:a.id==='cc'?'cc':p.b[a.id].t,level:a.id==='cc'?p.job.l:p.job.l};return;}
 if(r.action==='plot-move'){only(['id','i','j','r']);const b=own(p.b,a.id)?p.b[a.id]:null;if(!b)fail('unknown building');if(p.job?.id===a.id&&!(b.l>0))fail('wait for construction');const e=P.placeError(p,b.t,a.i,a.j,a.r|0,a.id);if(e)fail(e);b.i=a.i;b.j=a.j;b.r=a.r|0;s.notice={kind:'plot-moved',id:a.id};return;}
 if(r.action==='plot-remove'){only(['id','cells']);
  if(a.cells!==undefined){if(!Array.isArray(a.cells)||!a.cells.length||a.cells.length>40)fail('invalid wall path');for(const c of a.cells){if(!Array.isArray(c)||!int(c[0],0,P.GRID.n-1)||!int(c[1],0,P.GRID.n-1))fail('invalid wall path');delete p.w[P.key(c[0],c[1])];}s.notice={kind:'plot-wall-removed'};return;}
  const b=own(p.b,a.id)?p.b[a.id]:null;if(!b||['cc','storage'].includes(b.t))fail('that building cannot be removed');if(p.job?.id===a.id)fail('wait for construction');delete p.b[a.id];s.notice={kind:'plot-removed',type:b.t};return;}
 if(r.action==='plot-wall'){only(['cells','tier']);if(!int(a.tier,1,5))fail('invalid wall tier');const e=P.wallError(p,a.cells,a.tier);if(e)fail(e);debit(s,P.wallCost(p,a.cells,a.tier),ctx);for(const [i,j] of a.cells)p.w[P.key(i,j)]=a.tier;s.notice={kind:'plot-wall',tier:a.tier,n:a.cells.length};return;}
 if(r.action==='plot-collect'){only([]);const st=p.st,got={alloy:Math.floor(st.alloy||0),biomass:Math.floor(st.biomass||0),helium:Math.floor(st.helium||0),fe:Math.floor(st.fe||0)};if(!got.alloy&&!got.biomass&&!got.helium&&!got.fe)fail('nothing to collect yet');
  for(const k of ['alloy','biomass','helium']){s.ledger.banked[k]+=got[k];st[k]-=got[k];}if(got.fe){st.fe-=got.fe;bankMinerals(s,{fe:got.fe});}s.notice={kind:'plot-collected',...got};return;}
 if(r.action==='plot-drill'){only([]);if(now<(p.drillAt||0)+60000)fail('drill crews reset: '+Math.ceil(((p.drillAt||0)+60000-now)/1000)+'s');
  // No rewards, ever: the drill reads the layout and writes only the base log.
  const seed=(P.hash(Math.floor(now/1000),p.n|0,Object.keys(p.w).length)*4294967296)>>>0,R=P.drill(p,seed,{frames:false,events:false});
  p.drillAt=now;p.log=[{at:now,seed,outcome:R.outcome,kills:R.kills,spawned:R.spawned,lost:R.lost,core:R.core,time:R.time,power:p.power},...p.log].slice(0,8);s.notice={kind:'plot-drill',...p.log[0]};return;}
 if(r.action==='plot-banner'){only(['shape','colors','emblem']);if(!['shield','pennant','square','chevron'].includes(a.shape)||!Array.isArray(a.colors)||a.colors.length!==2||!a.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))||!['moon','tank','star','skull','gear','wing','bolt','crown'].includes(a.emblem))fail('invalid banner');
  p.banner={shape:a.shape,colors:a.colors.map(c=>c.toLowerCase()),emblem:a.emblem};s.notice={kind:'plot-banner'};return;}
 if(r.action==='plot-theme'){only(['light','finish','decor']);if(!['cyan','amber','violet','green','red'].includes(a.light)||!['steel','sand','graphite'].includes(a.finish)||!Array.isArray(a.decor)||a.decor.length>6||!a.decor.every(d=>['flags','lamps','crates','antenna','plants','statue'].includes(d)))fail('invalid theme');
  p.theme={light:a.light,finish:a.finish,decor:[...new Set(a.decor)]};s.notice={kind:'plot-theme'};return;}
 fail('invalid plot action');}
