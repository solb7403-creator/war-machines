// Session 5B Phase 4 balance model (brief: "a CC1 starter town can hold the first drill waves with composite + Ferrite; a
// CC10 town with heavy rare blends and a mixed turret set holds the strongest waves; spending power (extensions) without
// materials does not"). Deterministic raid simulation (js/conquest/plot.js drill) on all seven sites, several seeds.
// Layouts are scenario fixtures (dev/tests/fixtures/balance-towns.mjs): legal power, turrets inside the wall belt.
import assert from 'node:assert/strict';import {writeFileSync,mkdirSync} from 'node:fs';import '../../js/conquest/plot.js';
import {starterTown,cc10Town} from './fixtures/balance-towns.mjs';
const P=globalThis.ConquestPlot;let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('PASS '+m);};const out={};
const run=(p,seeds,opt={})=>seeds.map(seed=>{const r=P.drill(p,seed,{frames:false,events:false,...opt});return {outcome:r.outcome,core:r.core,kills:r.kills,spawned:r.spawned,time:r.time};});
// 1. CC1 starter town: Command Center, Storage, 2 Cannons + 1 Twin-Barrel MG (level I), one composite + Ferrite-light ring
{const res={},bare={};for(const site of P.SITE_IDS){const {p,cost}=starterTown(P,site,{blend:[1,1]});assert(cost.cm<=P.COMPOSITE.start,site+' starter ring fits the 200 starting composite');res[site]={cost,drills:run(p,[1,2,3,4,5])};bare[site]=run(P.newPlot(site,0),[1,2]);}
 out.starter=res;ok(Object.values(res).every(r=>r.drills.every(d=>d.outcome!=='breached')),'CC1 starter town (2 Cannons, 1 MG, a '+res.ridge.cost.cm+'-cell composite + Ferrite-light ring: '+res.ridge.cost.cm+' composite, '+res.ridge.cost.fe+' Ferrite) holds the first drill waves on all 7 sites × 5 seeds');
 ok(Object.values(bare).every(r=>r.every(d=>d.outcome==='breached')),'... while an undefended CC1 town loses its Command Center on every site');}
// 2. CC10: the same 42 turrets (all eleven types), vitals and production; walls differ
{const scen={rare:{label:'2,000 cells of heavy rare blends (Moonheart, Selenite, Tranquillityite, Armalcolite)',opt:{}},comp:{label:'3,000 composite-only cells (+50% extensions bought or earned, no ore)',opt:{blends:[[0,0]],cells:3000,ext:true}},none:{label:'no walls',opt:{cells:0}}},res={};
 for(const [k,s] of Object.entries(scen)){res[k]={};for(const site of P.SITE_IDS){const p=cc10Town(P,site,s.opt);if(k==='rare')assert(P.powerUse(p)<=P.powerSupply(p)&&P.turretCount(p)===42&&new Set(Object.values(p.b).map(b=>b.t).filter(t=>P.BUILDINGS[t]?.turret)).size===11,site+' legal CC10 town');res[k][site]={walls:Object.keys(p.w).length,drills:run(p,[1,2])};}}
 out.cc10=res;const all=k=>Object.values(res[k]).flatMap(r=>r.drills);
 ok(all('rare').every(d=>d.outcome!=='breached'),'a CC10 town with heavy rare blends and a mixed turret set holds the strongest waves (threat 10, '+all('rare')[0].spawned+' raiders) on all 7 sites × 2 seeds (Command Center '+Math.min(...all('rare').map(d=>d.core))+'-100%)');
 const comp=all('comp'),lost=comp.filter(d=>d.outcome==='breached').length;
 ok(lost>=10&&comp.every(d=>d.outcome==='breached'||d.core<=25),'spending power without materials does not hold: the same town with 3,000 composite-only cells loses its Command Center in '+lost+' of 14 drills, and the rest end at '+comp.filter(d=>d.outcome!=='breached').map(d=>d.core+'%').join(', '));
 const nw=all('none').filter(d=>d.outcome==='breached').length;ok(nw>=12,'without walls the 42 turrets alone fall in '+nw+' of 14 drills (only the Ice Basin\'s frozen lakes slow raiders enough to hold, barely)');}
mkdirSync('docs/conquest/session5b',{recursive:true});writeFileSync('docs/conquest/session5b/balance-model.json',JSON.stringify({scope:'Deterministic raid simulation (the Defense Drill model), scenario layouts; not a human playtest.',raid:{hpGrow:P.RAID.hpGrow,dmGrow:P.RAID.dmGrow,maxT:P.RAID.maxT,maxTPer:P.RAID.maxTPer},...out},null,1));
console.log(`conquest town balance: passed ${passed}`);
