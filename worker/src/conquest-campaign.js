// Additive per-pilot campaign ledger. Called inside the existing ETag/CAS transaction.
import {CONQUEST,RULES} from './sim.gen.js';
import {earn,activeToday,settleOpKills,discardOpKills} from './conquest-airdrop.js';
const D=CONQUEST.Combat.baseDefinition,DAY=86400000;
export const BASE_ACTIONS=['build-base','upgrade-base','base-module','base-claim','repair-base','defense-config'];
export const REMOTE_BASE_ACTIONS=['upgrade-base','base-module'];
export function campaign(s,now){
 s.campaignVersion=2;s.campaignScore=Math.max(0,Number.isSafeInteger(s.campaignScore)?s.campaignScore:0);s.raidProgress=s.raidProgress||{shards:0,clears:0,blueprint:false,eliteBlueprint:false};s.territory=s.territory||{};s.reputation=Math.max(0,Number.isSafeInteger(s.reputation)?s.reputation:0);s.achievements=s.achievements||{};
 for(const sector of CONQUEST.Combat.sectors||[])if(!s.territory[sector.id])s.territory[sector.id]={owner:sector.id==='refuge'?'humanity':'parasites',status:sector.id==='refuge'?'secured':'active-parasites',...(sector.id==='refuge'?{defenseAt:now+1800000}:{})};
 for(const t of Object.values(s.territory)){t.status=t.status||(t.owner==='humanity'?'secured':'active-parasites');if(t.capturedAt&&!t.defenseAt)t.defenseAt=t.capturedAt+1200000;}
 const ids=Object.keys(CONQUEST.Combat.operations).filter(id=>id!=='base-defense'&&!CONQUEST.Combat.operations[id].defense),rotation=Math.floor(now/1800000);s.contracts={ids:[ids[rotation%ids.length],ids[(rotation+3)%ids.length]],until:(rotation+1)*1800000};
 s.base=s.base||{tier:0,modules:{},builtAt:0,claimedAt:0};
 // Firebase drops empty maps: reconstruct this even when the base record already exists.
 s.base.modules=s.base.modules||{};s.base.pvpAvailable=false;if(s.base.tier&&!Number.isFinite(s.base.pointsAt))s.base.pointsAt=s.base.claimedAt||now;
 s.base.defense=s.base.defense||{config:'turret',damage:0,wins:0,alertAt:s.base.tier?now:0,nextAt:0,active:false};
 if(s.base.tier&&!s.base.defense.active&&now>=s.base.defense.nextAt&&!s.base.defense.alertAt)s.base.defense.alertAt=now;
 for(const t of Object.values(s.territory))if(t.owner==='humanity'&&t.defenseAt&&now>=t.defenseAt&&t.status!=='contested')t.status='defense-alert';
 if(s.base.pending&&now>=s.base.pending.readyAt){const p=s.base.pending;s.base.modules[p.module]=p.tier;delete s.base.pending;}
 const intel=CONQUEST.Combat.baseBenefits(s.base.tier,s.base.modules);s.radarContacts=intel.radar?Object.values(s.battle?.enemies||{}).filter(e=>e.hp>0&&Math.hypot(e.x-s.position.x,e.z-s.position.z)<intel.radarRange).map(e=>({id:e.id,x:e.x,z:e.z,kind:e.kind})).slice(0,24):[];
}
export function production(s){return CONQUEST.Combat.baseProduction(s.base,s.reputation);}
function debit(s,price){for(const [k,n] of Object.entries(price)){if(!Number.isSafeInteger(n)||n<0)throw Error('conquest: invalid recipe');if((k==='cp'?s.ledger.cp:s.ledger.banked[k])<n)throw Error('conquest: insufficient banked '+k+': need '+n);}for(const [k,n] of Object.entries(price))if(k==='cp')s.ledger.cp-=n;else s.ledger.banked[k]-=n;}
export function baseAction(s,r,now){
 // Remote command (from the MAP): tier upgrades and module construction spend already-banked resources only. Collecting
 // production, banking salvage, first construction, repair and defense deployment still need the physical base.
 const remote=REMOTE_BASE_ACTIONS.includes(r.action)&&s.base?.tier>0;campaign(s,now);if(s.mission||s.hp<=0)throw Error('conquest: approach physical Command Base terminal');
 if(!remote&&Math.hypot(s.position.x-D.x,s.position.z-D.z)>D.radius)throw Error('conquest: approach physical Command Base terminal');
 if(!remote&&s.battle.enemies.some(e=>e.hp>0&&Math.hypot(e.x-s.position.x,e.z-s.position.z)<65))throw Error('conquest: secure base perimeter');
 const b=s.base;
 if(r.action==='build-base'){if(b.tier)throw Error('conquest: base already built');debit(s,D.recipe);b.tier=1;b.builtAt=now;b.claimedAt=now;b.pointsAt=now;b.defense.alertAt=now;s.achievements['first-command']=now;}
 else if(!b.tier)throw Error('conquest: build base first');
 else if(r.action==='defense-config'){if(!['turret','shield','drone'].includes(r.module))throw Error('conquest: invalid defense configuration');b.defense.config=r.module;}
 else if(r.action==='repair-base'){if(!b.defense.damage)throw Error('conquest: base needs no repair');debit(s,{cp:Math.ceil(b.defense.damage*.5),alloy:Math.ceil(b.defense.damage*.05)});b.defense.damage=0;}
 else if(r.action==='upgrade-base'){if(b.tier>=D.maxTier)throw Error('conquest: maximum base tier');debit(s,D.tiers[b.tier]);b.tier++;}
 else if(r.action==='base-module'){if(!Object.prototype.hasOwnProperty.call(D.modules,r.module))throw Error('conquest: invalid module');const tier=b.modules[r.module]||0;if(b.pending||tier>=Math.min(3,b.tier))throw Error('conquest: module busy or tier locked');debit(s,D.moduleCosts[tier]);b.pending={module:r.module,tier:tier+1,readyAt:now+D.buildSeconds[tier]*1000};}
 else if(r.action==='base-claim'){
  // Daily Base Yield: CP + materials (banked straight into the base) and airdrop points, each clock filling over 24 h.
  // Collect from 10% of a fill. The points part needs the day's first verified operation; until then it keeps filling.
  const Y=CONQUEST.Combat.baseYield(b,s.reputation,now),goods=Y.fill>=Y.min,points=Y.pts>0&&Y.pointsFill>=Y.min&&activeToday(s,now);
  if(!goods&&!points)throw Error('conquest: production yield fills over 24 hours: '+Math.floor(Y.fill*100)+'% now, collect from '+Math.round(Y.min*100)+'%'+(Y.pointsFill>=Y.min&&!activeToday(s,now)?' (points need one operation today)':''));
  const got={cp:0,alloy:0,biomass:0,helium:0,ptsRaw:0};
  if(goods){got.cp=Y.cp;s.ledger.cp+=Y.cp;for(const k of ['alloy','biomass','helium']){got[k]=Y[k];s.ledger.banked[k]+=Y[k];}b.claimedAt=now;}
  if(points){got.ptsRaw=earn(s,'yield',Y.pts,now,{flat:true});b.pointsAt=now;}
  s.notice={kind:'base-production',...got,fill:Math.round(Y.fill*100),pointsHeld:Y.pts>0&&!points};return;}
 s.notice={kind:'base-updated'};
}
export function capture(s,site,now){campaign(s,now);s.territory[site]={...s.territory[site],owner:'humanity',status:'secured',capturedAt:s.territory[site]?.capturedAt||now,defenseAt:now+1200000,awaitingReinforcements:false};s.achievements['secured-'+site]=s.achievements['secured-'+site]||now;}

export function defenseOutcome(s,outcome,now){
 const d=s.base.defense;if(!d.active)return;d.active=false;d.alertAt=0;d.nextAt=now+1200000;
 const won=outcome==='victory',reward=CONQUEST.Combat.operations['base-defense'].reward;let ptsRaw=0;if(won){discardOpKills(s);ptsRaw=earn(s,'defense',RULES.CQ_PTS.defense,now,{op:true});}else settleOpKills(s,now);if(won){d.wins++;s.ledger.cp+=reward.cp;for(const k of ['alloy','biomass','helium'])s.ledger.cargo[k]+=reward[k]||0;s.reputation+=60;s.campaignScore+=15;s.achievements['base-defender']=s.achievements['base-defender']||now;d.damage=Math.max(0,d.damage-20);}
 else d.damage=Math.min(100,d.damage+25);
 d.report={outcome,at:now,ptsRaw,cp:won?reward.cp:0,alloy:won?reward.alloy:0,biomass:won?reward.biomass:0,helium:won?reward.helium:0,reputation:won?60:0,stolen:0,damage:d.damage};s.notice={kind:won?'base-defended':'base-damaged',...d.report};
}
export function contest(s,site){if(!site)return;s.territory[site]={...s.territory[site],owner:s.territory[site]?.owner||'parasites',status:'contested'};}
export function failedContest(s,site,now){const t=s.territory[site];if(!t||t.status!=='contested')return;t.owner='parasites';t.status='recaptured';t.lostAt=now;t.awaitingReinforcements=true;for(const e of Object.values(s.battle.enemies||{}))if(e.base?.id===site&&s.spawns[e.key])s.spawns[e.key].generation=Math.floor(now/DAY)-1;}
// Offensive sorties never hand an owned sector to an enemy merely for retreating.
export function beginContest(s,ids){s.contestPrevious={};for(const id of ids.filter(Boolean)){s.contestPrevious[id]=s.territory[id]?JSON.parse(JSON.stringify(s.territory[id])):{absent:true};contest(s,id);}}
export function restoreContest(s){for(const [id,t] of Object.entries(s.contestPrevious||{})){if(t&&!t.absent)s.territory[id]=t;else delete s.territory[id];}delete s.contestPrevious;}
export function sectorDefenseOutcome(s,outcome,now){
 const active=s.sectorDefense;if(!active?.active)return s.territory[active?.sector]?.defenseReport;active.active=false;
 const sector=active.sector,t=s.territory[sector],won=outcome==='victory',reward=CONQUEST.Combat.operations['sector-defense-'+sector].reward;
 let ptsRaw=0;if(won){discardOpKills(s);ptsRaw=earn(s,'defense',RULES.CQ_PTS.defense,now,{op:true});}else settleOpKills(s,now);
 if(won){capture(s,sector,now);s.territory[sector].defenseWins=(t.defenseWins||0)+1;s.ledger.cp+=reward.cp;for(const k of ['alloy','biomass','helium'])s.ledger.cargo[k]+=reward[k]||0;s.reputation+=40;s.campaignScore+=12;s.achievements['defended-'+sector]=s.achievements['defended-'+sector]||now;}
 else failedContest(s,sector,now);
 const receipt={kind:'sector-defense',sector,outcome,at:now,ptsRaw,cp:won?reward.cp:0,alloy:won?reward.alloy:0,biomass:won?reward.biomass:0,helium:won?reward.helium:0,reputation:won?40:0,stolen:0};s.territory[sector].defenseReport=receipt;s.notice=receipt;return receipt;
}
