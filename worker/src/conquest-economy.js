import {CONQUEST,RULES} from './sim.gen.js';
import {earn,opKill,discardOpKills,bankMinerals} from './conquest-airdrop.js';
import {roll,face,bind,empty as noLoot,runLoot} from './conquest-loot.js';
import {chainWin,chainBonus,chainBreak} from './conquest-living.js';
import {orderEvent} from './conquest-orders.js';
import {track} from './conquest-analytics.js';
// Separate Conquest ledger. Nothing here modifies Arcade, airdrop or paid inventory.
export const POLICY=Object.freeze({day:86400000,patrolRefresh:1200000,missionRepeat:180000,dropLife:300000,wreckLife:600000,maxDrops:48,maxWrecks:3,pickupRadius:6,visibleRadius:350,daily:{cp:3000,alloy:300,biomass:240,helium:60},terminal:{x:1174,z:1168,r:12},first:{cp:250,alloy:24,biomass:16,helium:6},replay:{cp:75,alloy:8,biomass:5,helium:2}});
const MATERIALS=['alloy','biomass','helium'],empty=()=>({alloy:0,biomass:0,helium:0});
export function ledger(s,now){s.ledger=s.ledger||{cp:0,banked:empty(),cargo:empty()};s.ledger.mn=s.ledger.mn&&typeof s.ledger.mn==='object'?s.ledger.mn:{};s.drops=s.drops||[];s.wrecks=s.wrecks||[];s.spawns=s.spawns||{};s.missionClaims=s.missionClaims||{};const day=Math.floor(now/POLICY.day);if(s.daily?.day!==day)s.daily={day,cp:0,...empty(),missionKills:[]};s.drops=s.drops.filter(d=>d.expires>now).slice(-POLICY.maxDrops);s.wrecks=s.wrecks.filter(d=>d.expires>now).slice(-POLICY.maxWrecks);return s.ledger;}
function grant(s,amount,mission=false){const awarded={};for(const k of ['cp',...MATERIALS]){const n=Math.max(0,mission?(amount[k]||0):amount[k]||0);s.daily[k]+=n;awarded[k]=n;if(k==='cp')s.ledger.cp+=n;else s.ledger.cargo[k]+=n;}s.reputation=(s.reputation||0)+Math.floor((awarded.cp||0)/3);s.notice={kind:'reward',...awarded};return awarded;}
export function killLoot(s,e,now){
 ledger(s,now);if(e.lootCreated)return;e.lootCreated=true;orderEvent(s,'kill');   // War Orders: every verified kill
 // Raid reinforcement waves are combat pressure only; they never add salvage beyond the authored raid economy.
 if(e.noLoot)return;
 let id;if(s.mission&&!e.resident){const key=e.rewardKey;if(!key||s.daily.missionKills.includes(key))return;s.daily.missionKills.push(key);id='m:'+s.daily.day+':'+key;}
 else {const meta=s.spawns[e.key]||(s.spawns[e.key]={generation:Math.floor(now/POLICY.day)});if(meta.lootGeneration===meta.generation)return;meta.lootGeneration=meta.generation;meta.deadAt=now;id='e:'+e.key+':'+meta.generation;}
 const heavy=e.kind==='command'||e.kind==='sentinel',patrol=e.base?.kind==='patrol'||e.base?.kind==='hunter';   // Session 6 hunters pay a patrol's salvage
 const amount=heavy?{cp:45,alloy:6,biomass:4,helium:1}:patrol?{cp:7,alloy:2,biomass:1,helium:0}:{cp:18,alloy:3,biomass:2,helium:0};
 if(s.drops.some(d=>d.id===id))return;
 // Airdrop points: a world kill pays now (spawn generation gated like its salvage); a kill inside an operation is held for
 // the operation's result (its completion pays instead; a failed or abandoned operation pays the held kills).
 const pts=RULES.CQ_PTS.kill[heavy?'heavy':'light'];if(s.mission&&!e.resident)opKill(s,pts);else earn(s,'kill',pts,now);
 // Session 6 loot v1: the kill's roll (RULES.LOOT mob / elite / commander), keyed by this drop id, rides the salvage cache.
 const op=s.mission&&!e.resident?CONQUEST.Combat.operations[s.mission]:null,commander=!!e.commander&&!!op?.raid,src=commander?'commander':heavy?'elite':'mob';
 const loot=roll(s,src,id,{ring:commander?(op.danger==='VETERAN'?4:3):CONQUEST.World.ringAt(e.x,e.z),commander:commander?e.pattern:null}),f=face(loot);
 s.drops.push({id,x:e.x,y:e.drone?CONQUEST.World.groundAt(e.x,e.z):e.y,z:e.z,amount,expires:now+POLICY.dropLife,...(noLoot(loot)?{}:{loot}),r:f.r,label:f.label});s.drops=s.drops.slice(-POLICY.maxDrops);
}
// Picking up a cache: its minerals join the cargo (at risk until banked, like gathered ore); everything else is account-bound now.
function claim(s,d,now){if(noLoot(d.loot))return null;const mn=d.loot.mn||{};for(const [k,v] of Object.entries(mn))s.ledger.mn[k]=(s.ledger.mn[k]||0)+Math.max(0,v|0);
 const got=bind(s,d.loot,now,{where:s.mission||'field'});if(Object.keys(mn).length)got.mn={...mn};runLoot(s,got);return got;}
export function pickups(s,now){ledger(s,now);for(const d of [...s.drops])if(Math.hypot(d.x-s.position.x,d.z-s.position.z)<=POLICY.pickupRadius&&Math.abs(d.y-s.position.y)<6){grant(s,d.amount);const got=claim(s,d,now);if(got)s.notice={...s.notice,loot:got,r:d.r|0,label:d.label};s.drops=s.drops.filter(x=>x.id!==d.id);}for(const w of [...s.wrecks])if(Math.hypot(w.x-s.position.x,w.z-s.position.z)<=POLICY.pickupRadius&&Math.abs(w.y-s.position.y)<6){for(const k of MATERIALS)s.ledger.cargo[k]+=w.amount[k];for(const [k,v] of Object.entries(w.amount.mn||{}))s.ledger.mn[k]=(s.ledger.mn[k]||0)+v;s.wrecks=s.wrecks.filter(x=>x.id!==w.id);s.notice={kind:'wreck-recovered',...w.amount};}}
export function death(s,now){ledger(s,now);if(s.death?.active)return;chainBreak(s);s.deathSerial=(s.deathSerial||0)+1;const amount=empty();for(const k of MATERIALS){amount[k]=Math.floor(s.ledger.cargo[k]/2);s.ledger.cargo[k]-=amount[k];}const mn={};for(const [k,v] of Object.entries(s.ledger.mn)){const h=Math.floor(v/2);if(h>0){mn[k]=h;s.ledger.mn[k]=v-h;}}if(Object.keys(mn).length)amount.mn=mn;const id='wreck:'+s.deathSerial;s.wrecks.push({id,...s.position,amount,expires:now+POLICY.wreckLife});s.wrecks=s.wrecks.slice(-POLICY.maxWrecks);s.death={active:true,id,at:now,expires:now+POLICY.wreckLife,position:{...s.position},amount};s.notice={kind:'defeat'};}
export function missionReward(s,now){ledger(s,now);const id=s.mission,claim=s.missionClaims[id],reputationBefore=s.reputation||0,op=CONQUEST.Combat.operations[id],raid=!!op?.raid;
 if(op?.strike)return strikeReward(s,op,now);
 if(raid&&s.raidReceipts?.[s.attempt])return s.raidReceipts[s.attempt];
 if(claim&&now-(claim.lastAt||claim.firstAt)<POLICY.missionRepeat)return {kind:'cooldown',cp:0,alloy:0,biomass:0,helium:0};
 const first=!claim,daily=claim?.day!==s.daily.day,amount=raid?{...op.reward,cp:Math.floor(op.reward.cp*(first?1:daily?.7:.45))}:first?{...POLICY.first,cp:op?.firstCp||250}:daily?POLICY.replay:{cp:45,alloy:6,biomass:4,helium:1};
 // Sortie chain (§5.7): this win's bonus is +10% CP and salvage per link already made (max +30%); points are never multiplied.
 const links=chainWin(s,now);
 const awarded=grant(s,chained({...amount,cp:amount.cp+(s.featuredMission?20:0)},links),true);
 // Session 6 (Decision 3a): a field mission's points taper on repeats the same UTC day: 100% x3, then 60%, then 40% (raids unchanged).
 const dn=claim?.day===s.daily.day?(claim.dn|0)+1:1,taper=raid?1:RULES.cqFieldTaper(dn);
 discardOpKills(s);const pts=earn(s,raid?'raid':'field',raid?RULES.CQ_PTS.raid[op.danger]||RULES.CQ_PTS.raid.HARD:Math.round(RULES.CQ_PTS.field*taper),now,{op:true});s.missionClaims[id]={firstAt:claim?.firstAt||now,lastAt:now,day:s.daily.day,count:(claim?.count||0)+1,dn};
 s.orders=s.orders?.day===s.daily.day?s.orders:{day:s.daily.day,completed:0};s.orders.completed++;
 if(s.orders.completed===3){s.ledger.cp+=100;s.reputation+=50;s.achievements=s.achievements||{};s.achievements['field-veteran']=s.achievements['field-veteran']||now;awarded.cp+=100;}
 s.campaignScore=(s.campaignScore||0)+(raid?10:3);orderEvent(s,'op');if(raid)orderEvent(s,'raid');else orderEvent(s,'fieldSector',1,{sector:op?.sector||CONQUEST.World.frontierSectorAt(op?.x||0,op?.z||0).id});
 const mn=cacheMinerals(s,raid?(op.danger==='VETERAN'?'VETERAN':'HARD'):'field',id+':'+(s.attempt||0)+':'+now);
 const receipt={kind:first?'first-clear':daily?'daily-replay':'repeat',reputation:(s.reputation||0)-reputationBefore,...awarded,ptsRaw:pts,...(raid?{}:{run:dn,taper}),...(Object.keys(mn).length?{mn}:{}),...(links?{chain:{links,bonus:chainBonus(links)}}:{})};
 if(raid){const p=s.raidProgress||(s.raidProgress={shards:0,clears:0,blueprint:false,eliteBlueprint:false});p.shards++;p.clears++;p.blueprint=p.blueprint||p.shards>=25;const elite=s.raidRoll?.attempt===s.attempt&&s.raidRoll.value<350;p.eliteBlueprint=p.eliteBlueprint||elite;receipt.shards=1;receipt.eliteBlueprint=elite;receipt.rareChance=.035;
  // Session 6: the raid completion chest (1 consumable + 8% rare fragment), keyed by this attempt, account-bound at once.
  const chest=bind(s,roll(s,'chest','attempt:'+(s.attempt|0),{steps:links>=3?1:0}),now,{where:'raid chest'});if(!noLoot(chest)||chest.pieces)receipt.loot=chest;s.raidReceipts=s.raidReceipts||{};s.raidReceipts[s.attempt]=receipt;const keys=Object.keys(s.raidReceipts).sort((a,b)=>a-b);for(const key of keys.slice(0,-32))delete s.raidReceipts[key];}
 return receipt;}
// Meteor Strike secured (§5.4): points (1,075 x league x Command Base), 120 CP, carried minerals (2 Ilmenite + 2 Armalcolite,
// 50% Tranquillityite) and the core roll stored at the slot's first start (15% Selenite, 2.5% Moonheart). Strike Resonance:
// every 12th secured strike guarantees a Selenite, every 40th a Moonheart, whatever the rolls. Once per pilot per slot.
function strikeReward(s,op,now){const T=RULES.STRIKE,slot=s.strikeSlot,rec=s.strikes?.[slot];
 if(!rec||rec.claimed)return {kind:'strike-claimed',cp:0,alloy:0,biomass:0,helium:0};rec.claimed=1;
 discardOpKills(s);const ptsRaw=earn(s,'strike',RULES.CQ_PTS.strike,now,{op:true});const links=chainWin(s,now),cp=Math.round(T.cp*(1+chainBonus(links)));s.ledger.cp+=cp;s.daily.cp+=cp;
 const mn={...T.guaranteed};if(rec.roll.tq<T.tq)mn.tq=(mn.tq||0)+1;const core=[];if(rec.roll.se<T.se){mn.se=(mn.se||0)+1;core.push('se');}if(rec.roll.mh<T.mh){mn.mh=(mn.mh||0)+1;core.push('mh');}
 const n=s.resonance=(s.resonance|0)+1;if(n%T.resonance.se===0){mn.se=(mn.se||0)+1;core.push('resonance-se');}if(n%T.resonance.mh===0){mn.mh=(mn.mh||0)+1;core.push('resonance-mh');}
 for(const [k,v] of Object.entries(mn))s.ledger.mn[k]=(s.ledger.mn[k]||0)+v;s.reputation=(s.reputation||0)+40;s.campaignScore=(s.campaignScore||0)+8;orderEvent(s,'op');orderEvent(s,'strike');
 // Session 6: 15% research part + 10% rare fragment, keyed by the slot; every 12th secured strike also gives the Strike Core trophy.
 const found=roll(s,'strike','slot:'+slot);if(n%T.resonance.se===0)(found.tr||(found.tr={})).core=1;const loot=bind(s,found,now,{where:'meteor strike'});
 return {kind:'strike',slot,cp,alloy:0,biomass:0,helium:0,mn,core,resonance:n,ptsRaw,...(links?{chain:{links,bonus:chainBonus(links)}}:{}),...(noLoot(loot)&&!loot.pieces?{}:{loot})};}
// Sortie chain (§5.7): CP and salvage (alloy, biomass, helium) of a win, +10% per link already made, max +30%. Minerals and points unchanged.
export function chained(amount,links){const k=1+chainBonus(links),o={...amount};for(const x of ['cp',...MATERIALS])if(o[x])o[x]=Math.round(o[x]*k);return o;}
export function atTerminal(s){return !s.mission&&s.hp>0&&(Math.hypot(s.position.x-POLICY.terminal.x,s.position.z-POLICY.terminal.z)<=POLICY.terminal.r||s.base?.modules?.vault&&Math.hypot(s.position.x-CONQUEST.Combat.baseDefinition.x,s.position.z-CONQUEST.Combat.baseDefinition.z)<=CONQUEST.Combat.baseDefinition.radius);}   // the gate zone (30 m, Find My Base): the plot screen's BANK / REPAIR work wherever it opens
export function bank(s,now){ledger(s,now);if(!atTerminal(s))throw Error('conquest: approach Refuge supply terminal');s.firsts=s.firsts&&typeof s.firsts==='object'?s.firsts:{};if(!s.firsts.bank)s.firsts.bank=now;   // Session 6: the HUD's BASE line and the coach chain read the first bank (state in the save)
 if(s.ledger.cargo.alloy>0)orderEvent(s,'bankAlloy',s.ledger.cargo.alloy);if(['alloy','biomass','helium'].some(k=>s.ledger.cargo[k]>0)||Object.values(s.ledger.mn||{}).some(v=>v>0))track(s,'bank');
 for(const k of MATERIALS){s.ledger.banked[k]+=s.ledger.cargo[k];s.ledger.cargo[k]=0;}
 const mn=bankMinerals(s,s.ledger.mn);s.ledger.mn={};s.notice={kind:'banked',...(Object.keys(mn).length?{mn}:{})};}   // minerals: to the account wallet through the outbox (RESOURCE_ECONOMY.md §5.3)
// Mineral caches on a verified operation victory (§5, the approved model): fractions are a chance of +1, rolled by the server
const cacheRoll=(key,k)=>{let h=2166136261;const t=key+':'+k;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);return (h>>>0)/4294967296;};
export function cacheMinerals(s,kind,key){const C=RULES.MN_CACHE[kind];if(!C)return {};s.ledger.mn=s.ledger.mn||{};const got={};for(const [k,v] of Object.entries(C)){const n=Math.floor(v)+(cacheRoll(key,k)<v-Math.floor(v)?1:0);if(n>0){got[k]=n;s.ledger.mn[k]=(s.ledger.mn[k]||0)+n;}}return got;}
