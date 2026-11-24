// Session 7B Citadel Act I on the Worker (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md; the rules and the assault are
// js/conquest/citadel.js, shared with the phone). Server-authoritative, in the pilot's own Conquest record (s.cit):
//  - opening a siege: the tier must be the next one (or a cleared one: a Throne Run), both approach territories held at launch; FORCE and
//    DEFENSE are advice only. A pilot far away is moved to the siege camp under fast travel's rule (nothing hostile near);
//  - siege prep: an ANTI-AIR BATTERY KNOCKOUT raid won gives the airstrike, an ARMORED INTERCEPTION raid won the convoy (one fewer
//    reinforcement wave), each for 48 h; the portal suppressed (the war's own rule) removes the portal's reinforcements. Every prep a
//    siege launches with is spent by that assault, won or lost (a loss spends the used siege prep; nothing else is taken: no wreck, no
//    cargo loss, the LDF brings the tank back with a quarter hull; downed allies return at half hull and need repair, the Battalion rule);
//  - the first clear of a tier (exactly once: the tier count only rises): the airdrop bounty rides this request's immutable outbox entry
//    to the account (eco.js credits each bounty id once per account, outside the daily cap); production +5% a tier (materials and CP);
//    the warden's trophy; the Retaliation level (= tiers cleared) rises by one; the next tier appears. Repeat clears (Throne Runs) pay
//    loot, never first-clear points; every won assault pays the battle points (par minutes x 225 x the Inner Ring's danger) under the
//    cap and the hourly limit, in place of the kills it held;
//  - Throne Run: a cleared tier with the week's Gambits, no siege prep, one full chest per tier per UTC week then the reduced chest; the
//    clear time is the Worker's own assault clock (simulated time from verified commands), for the clear-time board (conquest.js).
import {CONQUEST} from './sim.gen.js';
import {earn,discardOpKills,bounty} from './conquest-airdrop.js';
import {roll,bind} from './conquest-loot.js';
import {orderEvent} from './conquest-orders.js';
import {track} from './conquest-analytics.js';
const {Citadel:CI,War:WR,Combat:C}=CONQUEST,CIT=CI.CIT;
const fail=m=>{throw Error('conquest: '+m);};
export function cit(s){s.cit=CI.norm(s.cit);return s.cit;}
export const tiersOf=s=>CI.tiersOf(s);
// every request: the production bonus follows the tiers cleared (materials and CP only: ConquestCombat.baseYield, ConquestPlot.rates read
// cpb); prep that ran out falls away
export function citadelSync(s,now){const c=cit(s),v=CI.prodOf(c.t);if(s.base)s.base.cpb=v;if(s.plot)s.plot.cpb=v;for(const k of ['aa','cv'])if(c.prep[k]&&c.prep[k].until<=now)delete c.prep[k];}
// a raid won (worker/src/conquest-sim.js, the raid's settlement): siege prep for the next siege
export function citadelPrep(s,op,now){if(!op?.raid)return null;const k=Object.entries(CI.PREP).find(([,P])=>P.family&&P.family===op.family)?.[0];if(!k)return null;const c=cit(s);c.prep[k]={at:now,until:now+CIT.prepMs};return k;}
// start-mission for a Citadel tier, before the fight is built: the checks, then the siege camp (arrive: the reducer's fast-travel move)
export function citadelCheck(s,op,B,now,arrive){const why=CI.launchWhy(s,op.citadel,now);if(why)fail(why);
 if(Math.hypot(s.position.x-op.x,s.position.z-op.z)>op.activationRadius){const block=C.travelBlock(s,s.position,B.enemies,now);if(block)fail(block);arrive(CI.stageAt());}}
// the fight is built: what siege prep removes (not in a Throne Run), the Throne Run's Gambits, the seed, the run record
export function citadelBegin(s,B,op,now){const c=cit(s),tier=op.citadel,throne=tier<=c.t,week=CI.weekOf(now),prep=throne?{aa:false,cv:false,po:false}:CI.prepOf(s,now),gambits=throne?[...CI.gambitsOf(week)]:[];
 B.setup({prep,gambits});B.seed=(0x7b17c1ad^Math.imul(s.attempt|0,2654435761))>>>0;c.n++;c.cs[tier]=(c.cs[tier]|0)+1;
 s.citRun={tier,attempt:s.attempt|0,throne:throne?1:0,w:week,at:now,prep:{aa:prep.aa?1:0,cv:prep.cv?1:0,po:prep.po?1:0,...(prep.po?{pu:prep.until.po}:{})},gambits};
 track(s,'citadel_start',String(tier),throne?'throne':'siege');}
// every prep the assault launched with is spent (won or lost)
function spend(s,run){const c=cit(s),p=run?.prep||{};if(p.aa)delete c.prep.aa;if(p.cv)delete c.prep.cv;if(p.po)c.pu=Math.max(c.pu|0,p.pu|0);return Object.keys(p).filter(k=>k!=='pu'&&p[k]);}
const merge=(a,b)=>{const o={};for(const x of [a,b])for(const [g,m] of Object.entries(x||{}))if(m&&typeof m==='object'&&!Array.isArray(m)){o[g]=o[g]||{};for(const [k,n] of Object.entries(m))o[g][k]=(o[g][k]|0)+(n|0);}return o;};
// the assault won (applyCommands' victory): exactly once per attempt (the reducer settles a victory only while s.settlement is empty)
export function citadelWon(s,B,now){const c=cit(s),run=s.citRun&&s.citRun.attempt===(s.attempt|0)?s.citRun:null,tier=B.cit.tier,first=tier===c.t+1,week=CI.weekOf(now),ms=Math.max(1,B.cit.clear|0),Tr=CI.TIERS[tier];
 discardOpKills(s);   // the assault's battle points replace the kills it held (an operation's rule)
 const pts=earn(s,'siege',CI.battlePoints(),now,{op:true}),spent=spend(s,run);c.won++;s.campaignScore=(s.campaignScore||0)+10;orderEvent(s,'op');
 const rec={kind:'citadel',tier,first:first?1:0,throne:first?0:1,ms,ptsRaw:pts,spent,...(run?.gambits?.length?{gambits:run.gambits}:{}),down:B.cit.down|0,landed:B.cit.landed|0};
 const best=c.best[tier];if(!best||ms<best.ms){c.best[tier]={ms,w:week};rec.best=1;}
 if(first){c.t=tier;c.fc[tier]=now;c.tro[tier]=now;s.achievements=s.achievements||{};s.achievements['citadel-'+tier]=s.achievements['citadel-'+tier]||now;
  const b=CI.bountyOf(tier);if(b&&!s.dev?.used)bounty(s,'cit'+tier,b);   // owner dev records never earn airdrop points
  Object.assign(rec,{bounty:s.dev?.used?0:b,prod:CI.prodOf(c.t),trophy:Tr.warden.id,retaliation:c.t,next:CI.nextTier(c)?.n||0});}
 else{const full=c.tr.ch[tier]!==week;if(full)c.tr.ch[tier]=week;c.tr.w=week;const key='cit:'+tier+':'+(s.attempt|0);
  const loot=full?merge(roll(s,'commander',key,{ring:4,commander:Tr.warden.pattern}),roll(s,'chest',key)):roll(s,'chest',key);
  const mn=loot.mn||{};for(const [k,v] of Object.entries(mn)){s.ledger.mn=s.ledger.mn||{};s.ledger.mn[k]=(s.ledger.mn[k]||0)+Math.max(0,v|0);}   // minerals ride the cargo (banked at the Refuge), as a cache's do
  const got=bind(s,loot,now,{where:'throne run'});if(Object.keys(mn).length)got.mn={...mn};rec.chest=full?'full':'reduced';rec.loot=got;
  const wk=c.wk[tier];if(!wk||wk.w!==week||ms<wk.ms){c.wk[tier]={ms,w:week};c.lb={w:week,t:tier,ms,at:now};rec.weekBest=1;}}
 citadelSync(s,now);delete s.citRun;track(s,'citadel_end',String(tier),first?'first':'throne');return rec;}
// the assault lost (destroyed, the clock, the perimeter or a retreat): the used siege prep is spent; nothing else is taken
export function citadelLost(s,B,now,why){const run=s.citRun&&s.citRun.attempt===(s.attempt|0)?s.citRun:null;if(!run)return null;const c=cit(s),spent=spend(s,run);c.lost++;delete s.citRun;
 track(s,'citadel_end',String(B?.cit?.tier||run.tier),'lost');return {kind:'citadel-loss',tier:run.tier,why:String(why||B?.reason||'defeat').slice(0,40),spent,stage:B?.cit?.stage|0};}
// the tank destroyed in the assault: no wreck and no cargo lost (nothing else is taken); the LDF tows it back with a quarter hull
export function citadelDown(s,B,now){s.hp=Math.max(1,Math.round((B.playerMax||1)*.25));B.state='defeat';B.reason=B.reason||'War Machine disabled';B.projectiles=[];return citadelLost(s,B,now,'destroyed');}
