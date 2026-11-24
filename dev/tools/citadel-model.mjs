// Session 7B Citadel pacing model (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md, PACING; blueprint §6 pacing targets).
// Deterministic and read-only: the REAL assault (js/conquest/citadel.js on the shared combat engine, through the Worker bundle) driven by
// a phase-aware bot pilot with real commands (ConquestControl.command / validated / advance, the Worker's own mapping), with a Battalion
// fielded the way the Worker fields one (ConquestCombat.friendUnit at the Battalion's strength for its rank), on the kit a profile owns
// on a day (the fortress model's gear schedule and the economy model's Hangar, roster and rank pace). Never a server, a save or Firebase.
//   - assault(tier, {L, allies, prep, gambits, seed}): one fight -> outcome, seconds, stage reached, hull left, damage split
//   - kitAt(profile, day): the profile's tank and Battalion that day
//   - pace(profile): the first day each tier is won in at least half of the seeded fights (with the tier before it already cleared)
// usage: node dev/tools/citadel-model.mjs [--quick] [--json out.json] [--profile regular|heavy|grinder]
import {writeFileSync,mkdirSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST,RULES:R}=await import('../../worker/src/sim.gen.js');const {Combat:C,World:W,Control:K,Citadel:CI,Battalion:BT}=CONQUEST;
const {MODEL}=await import('./economy-model.mjs');const {GEAR}=await import('../tests/combat-sim.mjs');
// the three play times of the fortress model (dev/tools/fortress-model.mjs PROFILES) and their gear schedules
export const PROFILES={regular:{minutes:60,gear:[[0,0],[30,1],[150,2]]},heavy:{minutes:120,gear:[[0,0],[17,1],[95,2]]},grinder:{minutes:240,gear:[[0,0],[10,1],[60,2]]}};
const interp=(pts,d)=>{let v=pts[0][1];for(const [x,y] of pts)if(d>=x)v=y;return v;};
const ROLES=['guardian','lancer','breacher','frostline','mender','corroder','lancer','breacher','guardian'];
const memo=new Map();
function stages(minutes){if(!memo.has(minutes)){const L=MODEL.ladderOf(minutes),B=MODEL.battalionModel({minutes});memo.set(minutes,{L,B});}return memo.get(minutes);}
// the Hangar level a profile stands on at a day (Hangar n needs Command Center 2n-1; the economy model's hangarDay)
function hangarAt(minutes,d){const {L}=stages(minutes),H=[15/3600,3/60,20/60,2,6];for(let lv=5;lv>=1;lv--){const cc=2*lv-1===1?2:2*lv-1,day=L['CC'+cc]+H[lv-1]/24;if(d>=day)return lv;}return 0;}
function pilotsAt(minutes,d){const {B}=stages(minutes),h1=B.stage.wing;let n=1;if(d>=h1+8/24)n+=Math.floor(d-h1-8/24)+1;if(d>=1)n+=Math.floor(d-1)+1;return Math.min(16,n);}
function rankAt(minutes,d){const {B}=stages(minutes),at=B.ranks.onePilot;let r=1;for(let k=2;k<=10;k++)if(at[k]!==undefined&&d>=at[k])r=k;return r;}
export function kitAt(name,d){const pr=PROFILES[name],tier=Math.round(interp(pr.gear,d)),L=[GEAR.common,GEAR.rare,GEAR.epic][Math.min(2,tier)];
 const n=Math.min(BT.fieldCap(hangarAt(pr.minutes,d)),9,Math.max(0,pilotsAt(pr.minutes,d)-1)),top=rankAt(pr.minutes,d);
 // the Battalion's kit: militia (Common, no cores) until the profile owns spare gear of its tier (the fortress model's ally kit)
 const kit=tier>=1?{w:{a:tier>=2?'siege':'pulse',t:Math.min(2,tier),q:tier>=2?1.08:1},c:{c:'titan',t:Math.min(2,tier),q:tier>=2?1.08:1}}:null;
 const allies=ROLES.slice(0,n).map((role,i)=>({role,kit:kit||BT.militia(role),rk:Math.max(1,top-Math.floor(i/3))}));
 return {L,tier,hangar:hangarAt(pr.minutes,d),allies,top};}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// ---- the bot pilot: a careful player's priorities on each phase; real commands only, never edits the battle --------------------------
// It fights at range (the tank's 92 m against the Parasites' 43-54), lets the garrison come out through the gate before it enters,
// kites the Swarm, dodges every marked zone, pulls back to cover the hull when it is low, and spends the airstrike on the warden's open
// hull, a flying dropship or a gate piece.
export function assault(tier,{L=GEAR.common,allies=[],prep={},gambits=[],seed=1,maxSteps=12600,trace=null,each=null}={}){
 const p=CI.stageAt(),B=CI.make(L,p,'citadel-'+tier).setup({prep,gambits});B.seed=(0x7b17c1ad^Math.imul(seed|0,2654435761))>>>0;
 B.squad.orders=1;B.squad.f='wedge';allies.forEach((a,i)=>{const sl=C.FORMS.wedge[i%C.FORMS.wedge.length];B.friends.push(C.friendUnit({id:800000001+i,side:'mine',pid:'p'+i,role:a.role,kit:a.kit,m:BT.strength(a.rk,1),x:p.x+sl[0]*.5,z:p.z+sl[1]*.5-4}));});
 const g=CI.LAYOUT.gate,cen=CI.centre(),outside=CI.at(g.u-18,0),inside=CI.at(g.u+18,0),home=CI.stageAt(),range=C.engineeringValues(B.playerStats,B.engineering).range;
 let steps=0,stuck=0,last={...p},detour=0,retreat=false;
 while(B.state==='active'&&steps<maxSteps){
  const c=B.cit,alive=B.enemies.filter(e=>e.hp>0&&!e.dormant&&!e.resident),vis=alive.filter(e=>K.visible(B,p,e)),near=f=>vis.filter(f).sort((a,b)=>dist(a,p)-dist(b,p))[0];
  const objective=c.stage===0?alive.filter(e=>e.cit==='gen'||e.cit==='gate').sort((a,b)=>dist(a,p)-dist(b,p))[0]:null,warden=alive.find(e=>e.warden);
  const close=near(e=>!e.cit&&!e.ship&&dist(e,p)<(warden?8:16));   // in the warden's phase only a biting unit draws the pilot off the core
  const target=close||(warden&&vis.includes(warden)?warden:null)||near(e=>e.ship&&!e.landed)||(objective&&vis.includes(objective)?objective:null)||near(e=>e.wave&&!e.swarm)||near(e=>e.cit==='mortar')||near(e=>e.cit==='gun')||near(()=>true);
  const inPark=p.x>cen.x+g.u,hp=B.playerHp/B.playerMax;if(hp<.3)retreat=true;if(hp>.55||B.playerHp>=B.playerMax)retreat=false;
  const garrison=alive.filter(e=>e.wave&&!e.swarm&&!e.ship).sort((a,b)=>dist(a,p)-dist(b,p));
  let goal=objective||warden||garrison[0]||CI.at(CI.LAYOUT.throne.u-24,0);
  // the courtyard: wait outside the gate while the garrison is many, then go in (the gate first)
  if(c.stage>=1&&!inPark&&goal.x>cen.x+g.u){if(garrison.length>2&&!warden)goal=outside;else goal=Math.abs(p.z-cen.z)>6||dist(p,outside)>10?outside:inside;}
  if(warden&&!retreat&&inPark)goal=warden;   // the core is the pilot's job: keep it in sight and in range
  if(retreat)goal=inPark?outside:home;
  const tv=target&&K.visible(B,p,target),dt0=target?dist(target,p):0,lo=target&&target.swarm?.35*range:.42*range,hi=.72*range;let mx=0,mz=0;
  const toward=q=>{const d=dist(q,p)||1;return [(q.x-p.x)/d,(q.z-p.z)/d];};
  if(retreat)[mx,mz]=toward(goal);
  else if(tv&&dt0<lo&&!target.cit)[mx,mz]=toward(target).map(v=>-v);   // too close: back off while firing
  else if(!tv||dt0>hi||c.stage>=1&&goal!==target&&dist(goal,p)>8&&(goal===outside||goal===inside))[mx,mz]=toward(tv&&dt0<=hi?goal:goal);
  const hz=[...(B.hazards||[]),...c.shells.map(x=>({x:x.x,z:x.z,radius:x.r}))].find(h=>Math.hypot(h.x-p.x,h.z-p.z)<h.radius+2.5&&h.kind!=='air');
  if(hz){const ax=p.x-hz.x,az=p.z-hz.z,n=Math.hypot(ax,az)||1;mx=ax/n;mz=az/n;}
  if(detour>0){detour--;const a=Math.atan2(mx||1,mz)+1.4*(Math.floor(steps/300)%2?1:-1);mx=Math.sin(a);mz=Math.cos(a);}
  const cmd=K.validated(K.command({x:mx,z:mz,fire:!!target&&!!tv,lockId:target?.id||null,aimYaw:Math.atan2((target||goal).x-p.x,(target||goal).z-p.z),shield:hp<.8,super:B.charge>=1000||!!(B.superAttack&&B.superAttack.bar&&B.superAttack.oc===undefined&&B.superAttack.el>=B.superAttack.bar.z0+0.06),
   strike:c.air>0&&!!target&&(target.warden&&!(target.core>0)||target.ship&&!target.landed||target.cit==='gen'||target.cit==='gate')}));
  Object.assign(p,K.advance(B,p,cmd,.05,false));steps++;
  if(Math.hypot(mx,mz)>.1&&dist(p,last)<.02)stuck++;else stuck=0;last={...p};if(stuck>40){detour=40;stuck=0;}
  if(each)each(B,steps,p);if(trace&&steps%200===0)trace({t:+(B.time).toFixed(1),stage:c.stage,hp:Math.round(B.playerHp),alive:alive.length,say:c.say.t});}
 const c=B.cit,mine=B.friends.filter(f=>f.side==='mine');
 return {tier,outcome:B.state,seconds:Math.round(B.time),stage:c.stage,clear:c.clear,hullLeft:Math.round(100*Math.max(0,B.playerHp)/B.playerMax),reason:B.reason||'',
  pilotDmg:Math.round(B.pilotDmg||0),allyDmg:Math.round(B.allyDmg||0),allies:mine.length,downed:mine.filter(f=>f.down).length,shipsDown:c.down,shipsLanded:c.landed,waves:c.waves,say:c.say.t};}
// the first day a profile's kit wins this tier in at least half of n seeded fights (days from `from`, step `by`)
export function firstWin(name,tier,{from=1,to=120,by=2,n=4,prep={}}={}){for(let d=from;d<=to;d+=by){const k=kitAt(name,d);let won=0;const runs=[];for(let i=0;i<n;i++){const r=assault(tier,{L:k.L,allies:k.allies,prep,seed:1000*tier+i});runs.push(r);if(r.outcome==='victory')won++;}
  if(won*2>=n)return {day:d,won,of:n,kit:{tier:k.tier,hangar:k.hangar,allies:k.allies.length,rank:k.top},median:runs.filter(r=>r.outcome==='victory').map(r=>r.seconds).sort((a,b)=>a-b)[0]};}return null;}
if(process.argv[1]&&process.argv[1].endsWith('citadel-model.mjs')){
 const quick=process.argv.includes('--quick'),only=process.argv.includes('--profile')?process.argv[process.argv.indexOf('--profile')+1]:null,out={};
 for(const name of only?[only]:Object.keys(PROFILES)){out[name]={};let from=1;for(const tier of [1,2,3]){const r=firstWin(name,tier,{from,to:quick?80:160,by:quick?3:1,n:quick?2:4});out[name][tier]=r;console.log(name,'tier',tier,JSON.stringify(r));if(r)from=r.day;}}
 const j=process.argv.includes('--json')?process.argv[process.argv.indexOf('--json')+1]:null;if(j){mkdirSync(j.replace(/\/[^/]*$/,''),{recursive:true});writeFileSync(j,JSON.stringify(out,null,1)+'\n');}}
