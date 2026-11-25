// Session 7C STEP 3 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md; the old brief's D): the Hive Titan on the Worker (the rules and
// the hunt are js/conquest/titan.js, shared with the phone). Server-authoritative, in the pilot's own Conquest record (s.ttn):
//  - start: only in a Titan slot (every 6th Meteor Strike slot: the slot's own window, or the pilot's Strike Beacon on that slot),
//    after this pilot extracted the slot's core, near the crater, and not once the slot's Titan is down (ConquestTitan.startWhy);
//  - the kill, exactly once per slot (the reducer settles a victory only while s.settlement is empty, and the slot's k mark): 1,600 base
//    points (RULES.CQ_PTS.titan, the Command Base multiplier, under the 50,000 shared cap and the hourly limit, like every operation),
//    the LOOT.titan roll keyed by the slot (25% a research part, 20% Selenite, 2% Moonheart, 30% the Hive Titan
//    trophy, 10% an epic fragment; pity: the 5th Titan without a Selenite pays one), minerals carried like a strike's;
//  - every attempt (won, lost, a retreat or a destroyed tank): the pilot's own damage to the Titan, the slot's best kept (s.ttn.sl), the
//    week's Titan board reads the sum of the week's slots (worker/src/conquest-boards.js).
import {CONQUEST,RULES as R} from './sim.gen.js';
import {earn,discardOpKills} from './conquest-airdrop.js';
import {roll,bind} from './conquest-loot.js';
import {orderEvent} from './conquest-orders.js';
import {track} from './conquest-analytics.js';
const {Titan:TT,Combat:C}=CONQUEST,fail=m=>{throw Error('conquest: '+m);};
export const ttn=s=>s.ttn=TT.norm(s.ttn);
// the crater of the pilot's current strike slot (where the Titan rises)
export function titanSite(s){const slot=Number(s?.strikeSlot),n=C.strikeSites.length,site=Number.isSafeInteger(slot)?C.strikeSites[((slot%n)+n)%n]:C.strikeSites[0];return TT.arenaOf(site);}
export function titanCheck(s,op,now){const why=TT.startWhy(s,now);if(why)fail(why);const a=titanSite(s);if(Math.hypot(s.position.x-a.x,s.position.z-a.z)>op.activationRadius)fail('drive to the strike crater: the Titan rises there');}
export function titanBegin(s,B,now){const slot=Number(s.strikeSlot),n=C.strikeSites.length;B.setup({slot,site:C.strikeSites[((slot%n)+n)%n]});B.seed=(0x71743a4e^Math.imul(s.attempt|0,2654435761))>>>0;
 const T=ttn(s),r=T.sl[slot]||(T.sl[slot]={k:0,d:0,a:0});r.a++;s.ttnRun={slot,attempt:s.attempt|0,at:now};track(s,'titan_start',String(slot),'hunt');}
const dmgOf=B=>{const e=(B?.enemies||[]).find(x=>x&&x.titan);return Math.max(0,Math.min(TT.TITAN.hp,Math.round(Number(e?.tp)||0)));};
function record(s,B){const run=s.ttnRun&&s.ttnRun.attempt===(s.attempt|0)?s.ttnRun:null;if(!run)return null;const T=ttn(s),r=T.sl[run.slot]||(T.sl[run.slot]={k:0,d:0,a:1}),d=dmgOf(B),best=d>r.d;r.d=Math.max(r.d,d);delete s.ttnRun;return {run,r,d,best};}
// the hunt won (applyCommands' victory)
export function titanWon(s,B,now){const x=record(s,B);if(!x)return null;const {run,r,d,best}=x,first=!r.k;
 discardOpKills(s);   // the hunt's points replace the kills it held (an operation's rule)
 const rec={kind:'titan',slot:run.slot,first:first?1:0,dmg:d,best:best?1:0,ms:Math.max(1,B?.ttn?.clear|0),phase:B?.ttn?.phase|0};
 if(first){r.k=1;const T=ttn(s);T.kills++;rec.ptsRaw=earn(s,'titan',R.CQ_PTS.titan,now,{op:true});s.campaignScore=(s.campaignScore||0)+12;s.reputation=(s.reputation||0)+40;orderEvent(s,'op');
  const found=roll(s,'titan','slot:'+run.slot,{commander:'hive-titan'}),mn=found.mn||{};for(const [k,v] of Object.entries(mn)){s.ledger.mn=s.ledger.mn||{};s.ledger.mn[k]=(s.ledger.mn[k]||0)+Math.max(0,v|0);}   // minerals ride the cargo (banked at the Refuge), as a strike's do
  const got=bind(s,found,now,{where:'the hive titan'});if(Object.keys(mn).length)got.mn={...mn};rec.loot=got;if(found.pity)rec.pity=found.pity;}
 else rec.ptsRaw=0;   // a slot's Titan pays once (a second hunt cannot start; this is the guard behind that check)
 track(s,'titan_end',String(run.slot),first?'kill':'again');return rec;}
// the hunt lost (the clock, a retreat, a destroyed tank): its damage still counts for the board
export function titanLost(s,B,now,why){const x=record(s,B);if(!x)return null;track(s,'titan_end',String(x.run.slot),'lost');return {kind:'titan-loss',slot:x.run.slot,dmg:x.d,best:x.best?1:0,why:String(why||B?.reason||'defeat').slice(0,40),phase:B?.ttn?.phase|0};}
// the tank destroyed in the hunt: no wreck and no cargo lost (lead's decision, the Citadel's rule: the Titan rises right after a strike
// whose rewards are carried, and a boss fight must not punish trying); the LDF tows it back with a quarter hull
export function titanDown(s,B,now){s.hp=Math.max(1,Math.round((B.playerMax||1)*.25));B.state='defeat';B.reason=B.reason||'War Machine disabled';B.projectiles=[];return titanLost(s,B,now,'destroyed');}
