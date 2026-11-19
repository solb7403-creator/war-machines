R='./'
def patch(f,pairs):
    s=open(R+f).read()
    for old,new in pairs:
        n=s.count(old);assert n==1,(f,n,old[:150]);s=s.replace(old,new)
    open(R+f,'w').write(s)
# ---- combat.js: the first wingman's rescue, its own STANDARD operation near the Refuge (no pay: its reward is the pilot) ----
patch('js/conquest/combat.js',[
 (""" {id:'redoubt',name:'BREAK THE REDOUBT',""",""" // Session 6C (owner, Nov 18): the first wingman's rescue, right after the first plate (the coach chain's end): its own STANDARD
 // mission at the colony's south fields, 71 m from the Refuge terminal. It pays no airdrop points, CP, salvage or loot: its reward
 // is the pilot, who joins as your wingman (worker/src/conquest-battalion.js outcome). Not one of the six field missions.
 {id:'wingman-rescue',name:'RESCUE THE DOWNED PILOT',family:'wingman',wingman:true,site:'wingman-site',x:1138,z:1236,danger:'STANDARD',firstCp:0,brief:'A pilot is down at the colony\\'s south fields and two interceptors are closing in. Clear them, then hold beside the wreck for 4 seconds to pull the pilot out: they fly with you as your wingman.'},
 {id:'redoubt',name:'BREAK THE REDOUBT',"""),
 ("""const team=o.raid||o.defense||o.strike||id==='base-defense'?[]:id==='relay'||id==='redoubt'?[]:id==='rescue'?['raider','breacher','command']:['raider','raider'];
 team.forEach((kind,i)=>this.deploy(kind,o.x+18+i*12,o.z-25,'guard:'+i));""","""const team=o.raid||o.defense||o.strike||id==='base-defense'||o.wingman?[]:id==='relay'||id==='redoubt'?[]:id==='rescue'?['raider','breacher','command']:['raider','raider'];
 team.forEach((kind,i)=>this.deploy(kind,o.x+18+i*12,o.z-25,'guard:'+i));
 if(o.wingman){for(const [i,dx] of [[0,-14],[1,14]].entries())this.deploy('raider',o.x+dx[1],o.z-22,'pinning:'+i);for(const e of this.enemies){e.noLoot=true;e.noKill=1;}   // pays nothing: no salvage, points, loot or War Order kill
  const w=friendUnit({id:800000999,side:'ldf',kit:{w:{a:'pulse',t:0,q:1},c:{c:'vanguard',t:0,q:1}},x:o.x,z:o.z,heading:Math.PI});w.ctl='none';w.down=1;w.hp=0;w.wreck=1;this.friends.push(w);}   // the downed pilot's tank"""),
 (""" if(o.id==='redoubt'){if(!living.length&&this.stage===0){""",""" if(o.wingman){const dw=Math.hypot(this.player.x-o.x,this.player.z-o.z);this.stage=living.length?0:1;if(!living.length&&dw<8)this.work+=dt;else if(living.length)this.work=0;if(this.work>=4)this.state='victory';}   // only the pilot extracts
 if(o.id==='redoubt'){if(!living.length&&this.stage===0){"""),
 ("""const fieldMissionIds=freeze(Object.keys(operations).filter(id=>!operations[id].raid&&!operations[id].defense&&!operations[id].strike&&id!=='base-defense'));""","""const fieldMissionIds=freeze(Object.keys(operations).filter(id=>!operations[id].raid&&!operations[id].defense&&!operations[id].strike&&!operations[id].wingman&&id!=='base-defense'));   // the six (the wingman's rescue is not one)"""),
])
# ---- conquest-economy.js: allies never multiply points (owner rule): a kill only allies damaged pays nothing; the wingman's rescue pays nothing ----
patch('worker/src/conquest-economy.js',[
 (""" ledger(s,now);if(e.lootCreated)return;e.lootCreated=true;orderEvent(s,'kill');   // War Orders: every verified kill""",""" ledger(s,now);if(e.lootCreated)return;e.lootCreated=true;
 // Session 6C (blueprint §8, owner Nov 18): allies never multiply points. A kill pays points (a world kill now, an operation's held
 // kill if it fails), CP, salvage, loot and its War Order count only when your own tank dealt part of its damage (e.pd); a kill
 // only allies touched (e.ad) pays nothing. The wingman's rescue pays nothing at all (e.noKill).
 if(e.noKill||e.ad&&!e.pd)return;
 orderEvent(s,'kill');   // War Orders: every verified kill"""),
 ("""export function missionReward(s,now){ledger(s,now);const id=s.mission,claim=s.missionClaims[id],reputationBefore=s.reputation||0,op=CONQUEST.Combat.operations[id],raid=!!op?.raid;""","""export function missionReward(s,now){ledger(s,now);const id=s.mission,claim=s.missionClaims[id],reputationBefore=s.reputation||0,op=CONQUEST.Combat.operations[id],raid=!!op?.raid;
 if(op?.wingman)return {kind:'wingman',cp:0,alloy:0,biomass:0,helium:0};   // Session 6C: its reward is the pilot (no points, CP, salvage, chain link or War Order)"""),
])
# ---- conquest-sim.js: the battalion in the Worker's replay ----
patch('worker/src/conquest-sim.js',[
 ("""import {research,researchAction,RESEARCH_ACTIONS} from './conquest-research.js';""","""import {research,researchAction,RESEARCH_ACTIONS} from './conquest-research.js';
import {bat,field,sync,recover,regroup,outcome,tick as batTick,batAction,BAT_ACTIONS} from './conquest-battalion.js';"""),
 ("""const {World:W,Combat:C,Control:K}=CONQUEST,STEP_MS=50""","""const {World:W,Combat:C,Control:K,Battalion:BT}=CONQUEST,STEP_MS=50"""),
 ("""export function refreshState(s,now){campaign(s,now);cosmetics(s,now);veins(s,now);inventory(s);research(s);orders(s,now);""","""export function refreshState(s,now){campaign(s,now);cosmetics(s,now);veins(s,now);inventory(s);research(s);orders(s,now);bat(s);batTick(s,now);"""),
 (""" living(s,now);   // Session 6: hunter packs by held sectors and hour; old incursion / ambush units leave
}""",""" living(s,now);   // Session 6: hunter packs by held sectors and hour; old incursion / ambush units leave
 s.battle.friends=list(s.battle.friends);field(s,s.battle,s.position,'wing');   // Session 6C: your Wing follows you in the open world
}"""),
 (""" if(!s.mission)for(const site of C.installations){const guards=B.enemies.filter(e=>e.base?.id===site.id);if(guards.length&&guards.every(e=>e.hp<=0)&&s.territory[site.id]?.owner!=='humanity'&&!s.territory[site.id]?.awaitingReinforcements){""",""" sync(s,B);   // Session 6C: what the fight did to your pilots (a downed one needs a repair; kills to its card)
 if(!s.mission)for(const site of C.installations){const guards=B.enemies.filter(e=>e.base?.id===site.id);if(guards.length&&guards.every(e=>e.hp<=0)&&(guards.some(e=>e.pd)||Math.hypot(s.position.x-site.x,s.position.z-site.z)<60)&&s.territory[site.id]?.owner!=='humanity'&&!s.territory[site.id]?.awaitingReinforcements){   // only the pilot captures: your tank fought the garrison or stands at the site"""),
 ("""else s.settlement=missionReward(s,now);s.completed=s.completed||{};s.completed[s.mission]=s.completed[s.mission]||{at:now,attempt:s.attempt};if(s.mission!=='base-defense'&&!C.operations[s.mission].defense&&!C.operations[s.mission].strike){""","""else s.settlement=missionReward(s,now);{const bo=outcome(s,B,C.operations[s.mission],'victory',now);if(Object.keys(bo).length)s.settlement={...s.settlement,bat:bo};}s.completed=s.completed||{};s.completed[s.mission]=s.completed[s.mission]||{at:now,attempt:s.attempt};if(s.mission!=='base-defense'&&!C.operations[s.mission].defense&&!C.operations[s.mission].strike&&!C.operations[s.mission].wingman){"""),
 (""" if(s.mission&&B.state==='defeat')opEnd(s,B,'defeat');""",""" if(s.mission&&B.state==='defeat'){opEnd(s,B,'defeat');if(s.batAt!==s.attempt){s.batAt=s.attempt;s.batOut={attempt:s.attempt,...outcome(s,B,C.operations[s.mission],'defeat',now)};}}"""),
 ("""function arrive(s,B,p,notice){s.position={x:p.x,z:p.z,y:p.y,surface:p.surface||'ground'};s.safe=[{...s.position}];s.stuckMs=0;delete s.recall;B.projectiles=[];B.superShells=[];B.superAttack=null;B.dashState=null;B.lockId=null;s.notice=notice;}""","""function arrive(s,B,p,notice){s.position={x:p.x,z:p.z,y:p.y,surface:p.surface||'ground'};s.safe=[{...s.position}];s.stuckMs=0;delete s.recall;B.projectiles=[];B.superShells=[];B.superAttack=null;B.dashState=null;B.lockId=null;regroup(s,B,s.position);s.notice=notice;}   // your pilots come along"""),
 ("""export function applyAction(previous,request,now,ctx={}){
 if(!record(request)||Object.keys(request).some(k=>!['seq','action','upgrade','tuning','position','mission','module','item','slot','destination','plot','order','mod'].includes(k))||!['start-mission','return-exploration','bank','repair','respawn','recover','buy-upgrade','set-tuning',...BASE_ACTIONS,...COSMETIC_ACTIONS,...PLOT_ACTIONS,'start-defense','start-sector-defense',...TRAVEL_ACTIONS,...LOOT_ACTIONS,...RESEARCH_ACTIONS].includes(request.action))fail('invalid action');if(!['buy-upgrade','set-tuning','start-mission','base-module','defense-config','start-sector-defense','fast-travel','build-base',...COSMETIC_ACTIONS,...PLOT_ACTIONS,...LOOT_ACTIONS,...RESEARCH_ACTIONS].includes(request.action)""","""export function applyAction(previous,request,now,ctx={}){
 if(!record(request)||Object.keys(request).some(k=>!['seq','action','upgrade','tuning','position','mission','module','item','slot','destination','plot','order','mod','bat'].includes(k))||!['start-mission','return-exploration','bank','repair','respawn','recover','buy-upgrade','set-tuning',...BASE_ACTIONS,...COSMETIC_ACTIONS,...PLOT_ACTIONS,'start-defense','start-sector-defense',...TRAVEL_ACTIONS,...LOOT_ACTIONS,...RESEARCH_ACTIONS,...BAT_ACTIONS].includes(request.action))fail('invalid action');if(!['buy-upgrade','set-tuning','start-mission','base-module','defense-config','start-sector-defense','fast-travel','build-base',...COSMETIC_ACTIONS,...PLOT_ACTIONS,...LOOT_ACTIONS,...RESEARCH_ACTIONS,...BAT_ACTIONS].includes(request.action)"""),
 ("""if(op.raid&&!C.raidsUnlocked(s.completed))fail(""","""if(op.wingman&&bat(s).w)fail('the downed pilot is already safe');if(op.raid&&!C.raidsUnlocked(s.completed))fail("""),
 ("""B=fresh;B.enemies.push(...s.explorationBattle.enemies.filter(e=>!e.hunt&&!e.base?.solo).map(e=>({...copy(e),id:100000000+e.id,resident:true})));""","""B=fresh;B.enemies.push(...s.explorationBattle.enemies.filter(e=>!e.hunt&&!e.base?.solo).map(e=>({...copy(e),id:100000000+e.id,resident:true})));
 B.friends=[...B.friends,...list(s.explorationBattle.friends).filter(f=>f.side==='mine').map(copy)];B.squad={...(s.explorationBattle.squad||{}),o:'follow',t:0};field(s,B,s.position,BT.scaleOf(op));   // Session 6C: your Wing goes in with you; a raid, defense or strike fields the Platoon"""),
 ("""const fresh=new C.Encounter(s.loadout,s.position);Object.assign(fresh,s.explorationBattle||{});mergeResidents(B,fresh);K.carry(B,fresh);B=fresh;""","""const fresh=new C.Encounter(s.loadout,s.position);Object.assign(fresh,s.explorationBattle||{});mergeResidents(B,fresh);K.carry(B,fresh);fresh.friends=B.friends.filter(f=>f.side==='mine').map(copy);fresh.squad={...(B.squad||{}),o:'follow',t:0};recover(s,fresh);B=fresh;   // your pilots come back with you (a downed one at half hull)"""),
 ("""const old=B;B=new C.Encounter(s.loadout,s.checkpoint||spawnPoint());Object.assign(B,s.explorationBattle||s.battle);mergeResidents(old,B);K.carry(old,B);s.position={...(s.checkpoint||spawnPoint())};""","""const old=B;B=new C.Encounter(s.loadout,s.checkpoint||spawnPoint());Object.assign(B,s.explorationBattle||s.battle);mergeResidents(old,B);K.carry(old,B);s.position={...(s.checkpoint||spawnPoint())};B.friends=list(old.friends).filter(f=>f.side==='mine').map(copy);B.squad={...(old.squad||{}),o:'follow',t:0};recover(s,B);regroup(s,B,s.position);   // never lost: your pilots regroup with you"""),
 (""" }else if(request.action==='use-item'){useItem(s,B,request,now);""",""" }else if(BAT_ACTIONS.includes(request.action)){if(Object.keys(request).some(k=>!['seq','action','bat'].includes(k)))fail('invalid hangar fields');   // Session 6C: the HANGAR (from anywhere outside a fight; repairs at the Refuge or your town)
  batAction(s,request,now,{...ctx,atRepair:atTerminal(s)||!!s.base?.tier&&Math.hypot(s.position.x-C.baseDefinition.x,s.position.z-C.baseDefinition.z)<=C.baseDefinition.radius});
 }else if(request.action==='use-item'){useItem(s,B,request,now);"""),
 (""" B.baseModules=copy(s.base?.modules||{});B.baseTier=s.base?.tier||0;B.id=Math.max(Number(B.id)||0,...B.enemies.map(e=>e.id));s.battle=copy(B);if(s.battle.mf)s.battle.mf.q=[];s.seq=request.seq;""",""" if(!s.mission)field(s,B,s.position,'wing');sync(s,B);   // the roster after this action (a new pilot, a role, a preset, a repair)
 B.baseModules=copy(s.base?.modules||{});B.baseTier=s.base?.tier||0;B.id=Math.max(Number(B.id)||0,...B.enemies.map(e=>e.id));s.battle=copy(B);if(s.battle.mf)s.battle.mf.q=[];s.seq=request.seq;"""),
])
# ---- conquest.js: the account side (spare gear for AUTO-ARM, liveries, finish credits, pack chips) ----
patch('worker/src/conquest.js',[
 ("""import {RESEARCH_ACTIONS,account as researchAccount} from './conquest-research.js';""","""import {RESEARCH_ACTIONS,account as researchAccount} from './conquest-research.js';
import {BAT_ACTIONS,account as batAccount,gearOf,field as batField} from './conquest-battalion.js';"""),
 ("""return {loadout:S.lab?RULES.labLoadout(S):RULES.ecoLoadout(S,S.L),legacy:S.cqState?.v===1?S.cqState:null,rsAcct:researchCtx(S,now),""","""const loadout=S.lab?RULES.labLoadout(S):RULES.ecoLoadout(S,S.L);return {loadout,legacy:S.cqState?.v===1?S.cqState:null,rsAcct:researchCtx(S,now),batAcct:batCtx(S,loadout),"""),
 ("""function researchCtx(S,now){const prem=RULES.passResearch(passPremium(S,now));   /* the pass's research perks wait for the Lab store (rules.js passResearch) */return {bpt:{...(S.bpt||{})},rsx:{...(S.rsx||{})},lsm:{...(S.lsm||{})},prem:prem?1:0,premium:prem};}""","""function researchCtx(S,now){const prem=RULES.passResearch(passPremium(S,now));   /* the pass's research perks wait for the Lab store (rules.js passResearch) */return {bpt:{...(S.bpt||{})},bch:Math.max(0,S.bch|0),rsx:{...(S.rsx||{})},lsm:{...(S.lsm||{})},prem:prem?1:0,premium:prem};}
// Session 6C: what the battalion reads from the account (eco record): its owned weapons and chassis (AUTO-ARM's spare gear), the
// liveries it owns and the RECRUIT instant-finish credits (written only by a verified purchase; checkout is off until Session 8)
function batCtx(S,loadout){return {gear:gearOf(S,loadout),liv:{...(S.liv||{})},rcx:{...(S.rcx||{})}};}"""),
 ("""const {loadout:L,legacy,view,rsAcct}=await canonical(env,a.pid,now);""","""const {loadout:L,legacy,view,rsAcct,batAcct}=await canonical(env,a.pid,now);"""),
 ("""refreshState(state,now);researchAccount(state,rsAcct,now);refitState(state,L);seal(state,now);""","""refreshState(state,now);researchAccount(state,rsAcct,now);batAccount(state,batAcct,now);if(!state.mission)batField(state,state.battle,state.position,'wing');refitState(state,L);seal(state,now);"""),
 ("""if(!allowed(a.b,['gv','initData','seq','action','upgrade','tuning','position','mission','module','item','slot','destination','plot','order','mod'])||!Number.isSafeInteger(a.b.seq)||a.b.seq<1||!['start-mission','return-exploration','bank','repair','respawn','recover','buy-upgrade','set-tuning',...BASE_ACTIONS,...COSMETIC_ACTIONS,...PLOT_ACTIONS,'start-defense','start-sector-defense',...TRAVEL_ACTIONS,...LOOT_ACTIONS,...RESEARCH_ACTIONS].includes(a.b.action))return response(400,'invalid conquest action');
 if(!['buy-upgrade','set-tuning','start-mission','base-module','defense-config','start-sector-defense','fast-travel','build-base',...COSMETIC_ACTIONS,...PLOT_ACTIONS,...LOOT_ACTIONS,...RESEARCH_ACTIONS].includes(a.b.action)""","""if(!allowed(a.b,['gv','initData','seq','action','upgrade','tuning','position','mission','module','item','slot','destination','plot','order','mod','bat'])||!Number.isSafeInteger(a.b.seq)||a.b.seq<1||!['start-mission','return-exploration','bank','repair','respawn','recover','buy-upgrade','set-tuning',...BASE_ACTIONS,...COSMETIC_ACTIONS,...PLOT_ACTIONS,'start-defense','start-sector-defense',...TRAVEL_ACTIONS,...LOOT_ACTIONS,...RESEARCH_ACTIONS,...BAT_ACTIONS].includes(a.b.action))return response(400,'invalid conquest action');
 if(a.b.bat!==undefined&&JSON.stringify(a.b.bat).length>600)return response(400,'invalid conquest action fields');
 if(!['buy-upgrade','set-tuning','start-mission','base-module','defense-config','start-sector-defense','fast-travel','build-base',...COSMETIC_ACTIONS,...PLOT_ACTIONS,...LOOT_ACTIONS,...RESEARCH_ACTIONS,...BAT_ACTIONS].includes(a.b.action)"""),
 ("""const request={seq:a.b.seq,action:a.b.action};for(const key of ['upgrade','tuning','position','mission','module','item','slot','destination','plot','order','mod'])""","""const request={seq:a.b.seq,action:a.b.action};for(const key of ['upgrade','tuning','position','mission','module','item','slot','destination','plot','order','mod','bat'])"""),
 (""":RESEARCH_ACTIONS.includes(a.b.action)?researchCtx(RULES.ecoNorm(await readEco(env,a.pid)),now):{};""",""":RESEARCH_ACTIONS.includes(a.b.action)?researchCtx(RULES.ecoNorm(await readEco(env,a.pid)),now):['hangar-arm','hangar-livery'].includes(a.b.action)?await (async()=>{const S=RULES.ecoNorm(await readEco(env,a.pid));return batCtx(S,S.lab?RULES.labLoadout(S):RULES.ecoLoadout(S,S.L));})():{};   /* Session 6C: AUTO-ARM and liveries read the account once */"""),
])
# ---- index.js descOf: every Battalion store kind refused while checkout is off ----
patch('worker/src/index.js',[
 ("""  if (kind === "rspack" || kind === "rsleg" || kind === "rsfin") return null;""","""  if (kind === "rspack" || kind === "rsleg" || kind === "rsfin") return null;
  // Session 6C Battalion store (chip pack, liveries, RECRUIT instant finish): CHECKOUT OFF (RULES.BAT_STORE_OPEN false) in every
  // currency, refused here like the Lab kinds; ecoGrant enforces the same sale rules itself (batSaleOk)
  if (RULES.BAT_KINDS.includes(kind)) return null;"""),
])
print('worker ok')
