/* Session 6 (Conquest Core Fun): the NEXT chip's rules, the first-hour coach chain, the progressive HUD and the failure lines.
   Pure functions over the Worker's own Conquest state (presentation only: nothing here grants, predicts or sends a reward), so the
   HUD (js/conquest/app.js) and the node tests (dev/tests/conquest-first-hour.mjs) run exactly the same code.
   The NEXT chip is the HUD's single guidance channel (CONQUEST_BLUEPRINT.md §2 rule 3): the operation in progress, a route the
   pilot chose, an operation in range, the coach chain, then the board (claim the town, the next field mission, War Orders). */
(function(root){
'use strict';
const W=root.ConquestWorld,C=root.ConquestCombat;
const fmt=n=>Math.round(Number(n)||0).toLocaleString('en-US');
const nearestOf=(list,p)=>list.reduce((a,b)=>!a||Math.hypot(b.x-p.x,b.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?b:a,null);
// The opening as a 15 s HUD radio over gameplay: two lines at a time, 7.5 s a pair, SKIP. The flag is the old dialog's flag.
const RADIO=Object.freeze({key:'lunar-conquest-onboarding-v1',pairMs:7500,pairs:kb=>[
 ['REFUGE COMMAND · Parasite armor is on the oxygen line.','Those towers are the air we breathe. Your tank is fueled.'],
 [kb?'Press DEFEND, click a red hull to lock on, hold SPACE to fire.':'Tap DEFEND, tap a red hull to lock on, hold FIRE.','Hold the line, pilot. Give the Refuge another dawn.']]});
// A defense (the Oxygen Line, a sector defense, a base defense): the arrow leads to the nearest living attacker (never a guard
// of the open world), and the objective keeps its own bar.
function isDefense(B){const o=B?.operation;return !!B&&B.state==='active'&&(!o||!!o.defense||o.family==='base-defense'||o.id==='oxygen-line');}
function arrowTarget(B,p){if(!isDefense(B))return null;let best=null,bd=Infinity;for(const e of B.enemies||[])if(e.hp>0&&!e.resident){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<bd){bd=d;best=e;}}return best;}
// The first-hour coach chain after the first mission, one line at a time: BANK -> SCAN -> GATHER the Starter Vein -> BANK ->
// (two more Ferrite when the Starter Vein and the first clear's cache leave the pilot short of 40) -> FABRICATE the FRONT plate.
// opts: {kb: keyboard pilot, wallet: account minerals, plates: account plate tiers}. Returns an order or null (chain done).
function coachStep(s,p,opts={}){if(!s||!s.completed?.['oxygen-line']||typeof PLATE==='undefined')return null;
 const plates=opts.plates||[0,0,0,0];if(plates.some(Boolean))return null;
 const R=C.refuge,refuge={x:R.x,z:R.z,radius:R.radius,kind:'refuge'},kb=!!opts.kb,wallet=opts.wallet||{};
 const starter=W.deposits.find(d=>d.m==='starter'),found=!!s.found?.[starter.id],mined=!!s.deposits?.[starter.id],carried=s.ledger?.mn||{};
 if(!s.firsts?.bank)return {...refuge,coach:'bank',name:'BANK YOUR SALVAGE',line:'Drive into the Refuge, tap REFUGE SUPPLY, then BANK SALVAGE'};
 if(!found&&!mined)return {coach:'scan',kind:'coach',name:'SCAN FOR ORE',x:starter.x,z:starter.z,radius:150,line:(kb?'Press C':'Tap SCAN')+': the Starter Vein lies on the Refuge road'};
 if(found&&!mined)return {coach:'gather',kind:'resource',id:starter.id,name:'GATHER THE STARTER VEIN',x:starter.x,z:starter.z,radius:6,line:'Stop on the glowing ore and '+(kb?'hold G':'HOLD GATHER')+' · 35 Ferrite'};
 if((carried.fe|0)>0)return {...refuge,coach:'bank2',name:'BANK THE FERRITE',line:'Minerals are cargo until banked: REFUGE SUPPLY, then BANK SALVAGE'};
 const need=PLATE.cost[1].fe-(wallet.fe|0);
 // The Starter Vein (35) and the first clear's cache (3) leave a new pilot 2 short of the 40 a plate needs. The nearest Ferrite
 // vein this pilot has scanned closes the gap; with none in reach, the next field mission does (every field mission pays 3
 // Ferrite): never a dead end, never a guess about unscanned veins (they are server-only).
 if(need>0){const at=p||refuge,ore=nearestOf(W.knownOre(s,opts.now||Date.now()).filter(o=>o.ready&&o.d.mineral==='fe'&&o.d.m!=='starter').map(o=>({...o.d,left:o.left})),at);
  if(ore&&Math.hypot(ore.x-at.x,ore.z-at.z)<=220)return {coach:'more',kind:'resource',id:ore.id,name:need+' MORE FERRITE',x:ore.x,z:ore.z,radius:6,line:'GATHER this Ferrite vein ('+ore.left+' left), then bank it'};
  const field=nearestOf(C.fieldMissionIds.filter(id=>!s.completed?.[id]).map(id=>C.operations[id]),at);
  if(field)return {...field,coach:'more',name:need+' MORE FERRITE',line:'Every field mission pays 3 Ferrite: '+field.name,reward:orderReward(field,s,opts.pay||1)};
  return {coach:'more',kind:'coach',name:need+' MORE FERRITE',x:1010,z:1100,radius:150,line:(kb?'Press C':'Tap SCAN')+' in the Refuge Corridor: Ferrite veins lie along its roads'};}
 return {...refuge,coach:'plate',name:'FABRICATE YOUR FIRST PLATE',line:'REFUGE SUPPLY · FRONT FERRITE plate: +1% hull, on your tank in every mode'};}
// An operation's reward line on the chip: base points at the pilot's league pay, and CP (a first clear's, a raid's, a strike's).
function orderReward(o,s,pay=1){const P=typeof CQ_PTS==='object'?CQ_PTS:null;if(!P||!o)return '';const done=!!s?.completed?.[o.id];
 const pts=o.raid?P.raid[o.danger]||P.raid.HARD:o.strike?P.strike:o.defense?P.defense:P.field;const cp=o.raid?o.reward?.cp:o.strike?(typeof STRIKE==='object'?STRIKE.cp:0):done?0:o.firstCp;
 return fmt(Math.round(pts*pay))+' PTS'+(cp?' · '+fmt(cp)+' CP':'');}
// The board after the coach: claim the town once it is affordable, else the nearest field mission not cleared yet, else the War
// Orders (js/conquest/orders.js, Part E). Everything else (raids, strikes) is picked from the MAP.
function boardOrder(s,p,opts={}){if(!s)return null;const done=s.completed||{},D=C.baseDefinition,L=s.ledger;
 if(!s.base?.tier&&L){const have=Object.entries(D.recipe).every(([k,n])=>(k==='cp'?L.cp:L.banked?.[k]||0)>=n);if(have)return {kind:'base',x:D.x,z:D.z,radius:D.radius,name:'CLAIM YOUR TOWN',reward:fmt(D.recipe.cp)+' CP',line:'Command Gate: pick your site, name your town'};}
 const field=nearestOf(C.fieldMissionIds.filter(id=>!done[id]).map(id=>C.operations[id]),p);
 if(field){const town=!s.base?.tier&&L?' · TOWN '+fmt(Math.min(L.cp,D.recipe.cp))+' / '+fmt(D.recipe.cp)+' CP':'';return {...field,reward:orderReward(field,s,opts.pay||1),line:(field.danger||'STANDARD')+' · FIRST CLEAR'+town};}
 return root.ConquestOrders?.next?.(s,p,opts)||null;}
// The progressive HUD: minute 0 shows the NEXT chip, HULL and HEAT only; each line appears the first time it matters, read from
// the save (never a timer): AIRDROP after the first credited points, BASE after the first bank, METEOR once the town exists,
// CONTRACTS after the first War Order is done.
function hudOpen(s,k){if(!s)return false;return k==='airdrop'?(s.airdrop?.ack|0)>0:k==='base'?!!(s.firsts?.bank||s.base?.tier):k==='meteor'?!!s.base?.tier:k==='orders'?!!s.wo?.seen:false;}
// A failed operation names the cause and the fix in one line each (where the attackers came from, measured from the objective).
const COMPASS=['north','north-east','east','south-east','south','south-west','west','north-west'];
const compass=(dx,dz)=>COMPASS[((Math.round(Math.atan2(dx,-dz)/(Math.PI/4))%8)+8)%8];
function failureLines(B){const r=String(B?.reason||''),o=B?.operation,obj=B?.objective;
 const foes=(B?.enemies||[]).filter(e=>!e.resident&&e.hp>0);let from='';
 if(obj&&foes.length){const cx=foes.reduce((a,e)=>a+e.x,0)/foes.length,cz=foes.reduce((a,e)=>a+e.z,0)/foes.length;if(Math.hypot(cx-obj.x,cz-obj.z)>4)from=compass(cx-obj.x,cz-obj.z);}
 if(/telegraphed strike/.test(r))return ['A marked strike hit your hull.','When a red ring appears under you, DASH out of it.'];
 if(/disabled/i.test(r))return ['Your hull reached zero.','Raise SHIELD when the hull drops, keep your distance from heavy sentinels, and repair at the Refuge first.'];
 if(/destroyed/.test(r))return ['The attackers reached the '+(o?.defense?'sector beacon':o?.family==='base-defense'?'base':'oxygen processor')+(from?' from the '+from:'')+'.','Follow the red arrow to the nearest attacker. Orange saboteurs go for the towers first.'];
 if(/Retreated|abandoned/.test(r))return ['You left the operation area.','Stay inside the perimeter: the arrow always leads back to the fight.'];
 if(/carrier escaped/i.test(r))return ['The armored carrier reached the exit.','Shoot the carrier first; its escorts can wait.'];
 if(/expired/.test(r))return ['Time ran out.','Go straight for the objective the arrow shows.'];
 return [r||'The operation failed.','Regroup at the Refuge, repair, and try again.'];}
root.ConquestGuide=Object.freeze({RADIO,isDefense,arrowTarget,coachStep,orderReward,boardOrder,hudOpen,failureLines,compass});
})(globalThis);
