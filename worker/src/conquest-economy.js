import {CONQUEST,RULES} from './sim.gen.js';
import {earn,opKill,discardOpKills,bankMinerals} from './conquest-airdrop.js';
// Separate Conquest ledger. Nothing here modifies Arcade, airdrop or paid inventory.
export const POLICY=Object.freeze({day:86400000,patrolRefresh:1200000,missionRepeat:180000,dropLife:300000,wreckLife:600000,maxDrops:48,maxWrecks:3,pickupRadius:6,visibleRadius:350,daily:{cp:3000,alloy:300,biomass:240,helium:60},terminal:{x:1174,z:1168,r:12},first:{cp:250,alloy:24,biomass:16,helium:6},replay:{cp:75,alloy:8,biomass:5,helium:2}});
const MATERIALS=['alloy','biomass','helium'],empty=()=>({alloy:0,biomass:0,helium:0});
export function ledger(s,now){s.ledger=s.ledger||{cp:0,banked:empty(),cargo:empty()};s.ledger.mn=s.ledger.mn&&typeof s.ledger.mn==='object'?s.ledger.mn:{};s.drops=s.drops||[];s.wrecks=s.wrecks||[];s.spawns=s.spawns||{};s.missionClaims=s.missionClaims||{};const day=Math.floor(now/POLICY.day);if(s.daily?.day!==day)s.daily={day,cp:0,...empty(),missionKills:[]};s.drops=s.drops.filter(d=>d.expires>now).slice(-POLICY.maxDrops);s.wrecks=s.wrecks.filter(d=>d.expires>now).slice(-POLICY.maxWrecks);return s.ledger;}
function grant(s,amount,mission=false){const awarded={};for(const k of ['cp',...MATERIALS]){const n=Math.max(0,mission?(amount[k]||0):amount[k]||0);s.daily[k]+=n;awarded[k]=n;if(k==='cp')s.ledger.cp+=n;else s.ledger.cargo[k]+=n;}s.reputation=(s.reputation||0)+Math.floor((awarded.cp||0)/3);s.notice={kind:'reward',...awarded};return awarded;}
export function killLoot(s,e,now){
 ledger(s,now);if(e.lootCreated)return;e.lootCreated=true;
 // Raid reinforcement waves are combat pressure only; they never add salvage beyond the authored raid economy.
 if(e.noLoot)return;
 let id;if(s.mission&&!e.resident){const key=e.rewardKey;if(!key||s.daily.missionKills.includes(key))return;s.daily.missionKills.push(key);id='m:'+s.daily.day+':'+key;}
 else {const meta=s.spawns[e.key]||(s.spawns[e.key]={generation:Math.floor(now/POLICY.day)});if(meta.lootGeneration===meta.generation)return;meta.lootGeneration=meta.generation;meta.deadAt=now;id='e:'+e.key+':'+meta.generation;}
 const heavy=e.kind==='command'||e.kind==='sentinel',patrol=e.base?.kind==='patrol';
 const amount=heavy?{cp:45,alloy:6,biomass:4,helium:1}:patrol?{cp:7,alloy:2,biomass:1,helium:0}:{cp:18,alloy:3,biomass:2,helium:0};
 if(s.drops.some(d=>d.id===id))return;
 // Airdrop points: a world kill pays now (spawn generation gated like its salvage); a kill inside an operation is held for
 // the operation's result (its completion pays instead; a failed or abandoned operation pays the held kills).
 const pts=RULES.CQ_PTS.kill[heavy?'heavy':'light'];if(s.mission&&!e.resident)opKill(s,pts);else earn(s,'kill',pts,now);s.drops.push({id,x:e.x,y:e.drone?CONQUEST.World.groundAt(e.x,e.z):e.y,z:e.z,amount,expires:now+POLICY.dropLife});s.drops=s.drops.slice(-POLICY.maxDrops);
}
export function pickups(s,now){ledger(s,now);for(const d of [...s.drops])if(Math.hypot(d.x-s.position.x,d.z-s.position.z)<=POLICY.pickupRadius&&Math.abs(d.y-s.position.y)<6){grant(s,d.amount);s.drops=s.drops.filter(x=>x.id!==d.id);}for(const w of [...s.wrecks])if(Math.hypot(w.x-s.position.x,w.z-s.position.z)<=POLICY.pickupRadius&&Math.abs(w.y-s.position.y)<6){for(const k of MATERIALS)s.ledger.cargo[k]+=w.amount[k];for(const [k,v] of Object.entries(w.amount.mn||{}))s.ledger.mn[k]=(s.ledger.mn[k]||0)+v;s.wrecks=s.wrecks.filter(x=>x.id!==w.id);s.notice={kind:'wreck-recovered',...w.amount};}}
export function death(s,now){ledger(s,now);if(s.death?.active)return;s.deathSerial=(s.deathSerial||0)+1;const amount=empty();for(const k of MATERIALS){amount[k]=Math.floor(s.ledger.cargo[k]/2);s.ledger.cargo[k]-=amount[k];}const mn={};for(const [k,v] of Object.entries(s.ledger.mn)){const h=Math.floor(v/2);if(h>0){mn[k]=h;s.ledger.mn[k]=v-h;}}if(Object.keys(mn).length)amount.mn=mn;const id='wreck:'+s.deathSerial;s.wrecks.push({id,...s.position,amount,expires:now+POLICY.wreckLife});s.wrecks=s.wrecks.slice(-POLICY.maxWrecks);s.death={active:true,id,at:now,expires:now+POLICY.wreckLife,position:{...s.position},amount};s.notice={kind:'defeat'};}
export function missionReward(s,now){ledger(s,now);const id=s.mission,claim=s.missionClaims[id],reputationBefore=s.reputation||0,op=CONQUEST.Combat.operations[id],raid=!!op?.raid;
 if(op?.strike)return strikeReward(s,op,now);
 if(raid&&s.raidReceipts?.[s.attempt])return s.raidReceipts[s.attempt];
 if(claim&&now-(claim.lastAt||claim.firstAt)<POLICY.missionRepeat)return {kind:'cooldown',cp:0,alloy:0,biomass:0,helium:0};
 const first=!claim,daily=claim?.day!==s.daily.day,amount=raid?{...op.reward,cp:Math.floor(op.reward.cp*(first?1:daily?.7:.45))}:first?{...POLICY.first,cp:({convoy:140,relay:130,recon:100,rescue:150,redoubt:220})[id]||250}:daily?POLICY.replay:{cp:45,alloy:6,biomass:4,helium:1};
 const awarded=grant(s,{...amount,cp:amount.cp+(s.featuredMission?20:0)},true);
 discardOpKills(s);const pts=earn(s,raid?'raid':'field',raid?RULES.CQ_PTS.raid[op.danger]||RULES.CQ_PTS.raid.HARD:RULES.CQ_PTS.field,now,{op:true});s.missionClaims[id]={firstAt:claim?.firstAt||now,lastAt:now,day:s.daily.day,count:(claim?.count||0)+1};
 s.orders=s.orders?.day===s.daily.day?s.orders:{day:s.daily.day,completed:0};s.orders.completed++;
 if(s.orders.completed===3){s.ledger.cp+=100;s.reputation+=50;s.achievements=s.achievements||{};s.achievements['field-veteran']=s.achievements['field-veteran']||now;awarded.cp+=100;}
 s.campaignScore=(s.campaignScore||0)+(raid?10:3);
 const mn=cacheMinerals(s,raid?(op.danger==='VETERAN'?'VETERAN':'HARD'):'field',id+':'+(s.attempt||0)+':'+now);
 const receipt={kind:first?'first-clear':daily?'daily-replay':'repeat',reputation:(s.reputation||0)-reputationBefore,...awarded,ptsRaw:pts,...(Object.keys(mn).length?{mn}:{})};
 if(raid){const p=s.raidProgress||(s.raidProgress={shards:0,clears:0,blueprint:false,eliteBlueprint:false});p.shards++;p.clears++;p.blueprint=p.blueprint||p.shards>=25;const elite=s.raidRoll?.attempt===s.attempt&&s.raidRoll.value<350;p.eliteBlueprint=p.eliteBlueprint||elite;receipt.shards=1;receipt.eliteBlueprint=elite;receipt.rareChance=.035;s.raidReceipts=s.raidReceipts||{};s.raidReceipts[s.attempt]=receipt;const keys=Object.keys(s.raidReceipts).sort((a,b)=>a-b);for(const key of keys.slice(0,-32))delete s.raidReceipts[key];}
 return receipt;}
// Meteor Strike secured (§5.4): points (1,075 x league x Command Base), 120 CP, carried minerals (2 Ilmenite + 2 Armalcolite,
// 50% Tranquillityite) and the core roll stored at the slot's first start (15% Selenite, 2.5% Moonheart). Strike Resonance:
// every 12th secured strike guarantees a Selenite, every 40th a Moonheart, whatever the rolls. Once per pilot per slot.
function strikeReward(s,op,now){const T=RULES.STRIKE,slot=s.strikeSlot,rec=s.strikes?.[slot];
 if(!rec||rec.claimed)return {kind:'strike-claimed',cp:0,alloy:0,biomass:0,helium:0};rec.claimed=1;
 discardOpKills(s);const ptsRaw=earn(s,'strike',RULES.CQ_PTS.strike,now,{op:true});s.ledger.cp+=T.cp;s.daily.cp+=T.cp;
 const mn={...T.guaranteed};if(rec.roll.tq<T.tq)mn.tq=(mn.tq||0)+1;const core=[];if(rec.roll.se<T.se){mn.se=(mn.se||0)+1;core.push('se');}if(rec.roll.mh<T.mh){mn.mh=(mn.mh||0)+1;core.push('mh');}
 const n=s.resonance=(s.resonance|0)+1;if(n%T.resonance.se===0){mn.se=(mn.se||0)+1;core.push('resonance-se');}if(n%T.resonance.mh===0){mn.mh=(mn.mh||0)+1;core.push('resonance-mh');}
 for(const [k,v] of Object.entries(mn))s.ledger.mn[k]=(s.ledger.mn[k]||0)+v;s.reputation=(s.reputation||0)+40;s.campaignScore=(s.campaignScore||0)+8;
 return {kind:'strike',slot,cp:T.cp,alloy:0,biomass:0,helium:0,mn,core,resonance:n,ptsRaw};}
export function atTerminal(s){return !s.mission&&s.hp>0&&(Math.hypot(s.position.x-POLICY.terminal.x,s.position.z-POLICY.terminal.z)<=POLICY.terminal.r||s.base?.modules?.vault&&Math.hypot(s.position.x-CONQUEST.Combat.baseDefinition.x,s.position.z-CONQUEST.Combat.baseDefinition.z)<=CONQUEST.Combat.baseDefinition.radius);}   // the gate zone (30 m, Find My Base): the plot screen's BANK / REPAIR work wherever it opens
export function bank(s,now){ledger(s,now);if(!atTerminal(s))throw Error('conquest: approach Refuge supply terminal');for(const k of MATERIALS){s.ledger.banked[k]+=s.ledger.cargo[k];s.ledger.cargo[k]=0;}
 const mn=bankMinerals(s,s.ledger.mn);s.ledger.mn={};s.notice={kind:'banked',...(Object.keys(mn).length?{mn}:{})};}   // minerals: to the account wallet through the outbox (RESOURCE_ECONOMY.md §5.3)
// Mineral caches on a verified operation victory (§5, the approved model): fractions are a chance of +1, rolled by the server
const cacheRoll=(key,k)=>{let h=2166136261;const t=key+':'+k;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);return (h>>>0)/4294967296;};
export function cacheMinerals(s,kind,key){const C=RULES.MN_CACHE[kind];if(!C)return {};s.ledger.mn=s.ledger.mn||{};const got={};for(const [k,v] of Object.entries(C)){const n=Math.floor(v)+(cacheRoll(key,k)<v-Math.floor(v)?1:0);if(n>0){got[k]=n;s.ledger.mn[k]=(s.ledger.mn[k]||0)+n;}}return got;}
