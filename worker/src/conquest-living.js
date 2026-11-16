// Session 6 living world (docs/conquest/audit/CONQUEST_1_0_SPEC.md §5.6, §5.7). Server-only spawning, authored archetypes, never
// the pilot's gear (enemyStats stays archetype-only; the hunters' aggro and leash are fixed numbers in ConquestCombat.LIVING).
//  - Hunter packs: 1 + floor(held sectors / 2) roaming groups (2 interceptors + 1 coordinator, + a heavy sentinel in rings 3-4) on
//    authored loops; they hunt the pilot within 200 m, leash 300 m from their anchor, never follow into the Heartland, and a lost
//    member comes back the next UTC hour (its kill pays world-kill points under the hourly limit, salvage and loot once per hour).
//  - Vein ambush: the first GATHER on a vein in ring 3+ rolls 35% once per vein generation (server seed); 20 s of simulated
//    play at that vein later two heavy sentinels arrive 65 m away. Leaving the vein (40 m) calls it off.
//  - Incursion: after 10 minutes of simulated play without a fight, three interceptors arrive 120 m from the pilot (never within 60 m
//    of the Refuge terminal or inside the Command Gate zone; it waits while the pilot is at either).
//  - Sortie chain: consecutive operation wins, each within 10 minutes of the last: +10% CP and salvage per link already made (max
//    +30%), one rarity step on the raid chest at three links; airdrop points are never multiplied. Breaks on death, RECALL or a
//    session opened after more than a minute away.
import {CONQUEST} from './sim.gen.js';
import {u32} from './conquest-loot.js';
const W=CONQUEST.World,C=CONQUEST.Combat,L=C.LIVING,R=C.refuge,HOUR=3600000,VISIBLE=350;   // R: the Refuge supply terminal
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const near=(a,x,z,r)=>Math.hypot(a.x-x,a.z-z)<=r;
const sectorsHeld=s=>C.sectors.filter(x=>s.territory?.[x.id]?.owner==='humanity').length;
export const packCount=s=>Math.min(L.packs.length,1+Math.floor(sectorsHeld(s)/2));
const packKinds=a=>W.ringAt(a.x,a.z)>=3?[...L.pack,L.hardExtra]:[...L.pack];
const offsets=[[0,0],[7,4],[-7,4],[0,-8]];
function fresh(kind,key,id,x,z,hunt,route,now){const e=C.hunter(kind,key,id,x,z,hunt,route);e.born=now;return e;}
function clearPad(x,z,enemies){if(W.solidAt(x,z)||W.waterAt?.(x,z)?.deep)return false;const p={x,z,y:W.groundAt(x,z),surface:'ground'},q=W.advance(p,1.5,0),r=W.advance(p,-1.5,0);return Math.hypot(q.x-x,q.z-z)>1&&Math.hypot(r.x-x,r.z-z)>1&&!enemies.some(e=>e.hp>0&&Math.hypot(e.x-x,e.z-z)<6);}
// Exploration refresh (never inside an operation): packs by held sectors and hour; old incursion / ambush units leave.
export function living(s,now){const B=s.battle;if(!B||!Array.isArray(B.enemies))return;const p=s.position,h=Math.floor(now/HOUR),n=packCount(s);s.spawns=s.spawns||{};
 for(let i=0;i<L.packs.length;i++){const a=L.packs[i],kinds=packKinds(a);
  for(let j=0;j<kinds.length;j++){const key='pack:'+i+':'+j,id=L.ids.pack+i*10+j,at=B.enemies.findIndex(e=>e.key===key),e=at>=0?B.enemies[at]:null;
   if(i>=n){if(e&&!near(p,e.x,e.z,VISIBLE))B.enemies.splice(at,1);continue;}   // fewer held sectors: the extra pack withdraws out of sight
   if(near(p,a.x,a.z,VISIBLE))continue;   // never pops in (or back) where the pilot can see
   const m=s.spawns[key];if(e&&(e.hp>0||(m?.generation??h)>=h))continue;   // alive, or this hour's member already fell
   const [ox,oz]=offsets[j%offsets.length],u=fresh(kinds[j],key,id,a.x+ox,a.z+oz,{r:L.aggro,leash:L.leash,heart:false},a.route,now);
   if(e)B.enemies[at]=u;else B.enemies.push(u);s.spawns[key]={generation:h};}}
 for(let k=B.enemies.length-1;k>=0;k--){const e=B.enemies[k];if(!/^(incursion|ambush):/.test(e.key||''))continue;
  const d=Math.hypot(e.x-p.x,e.z-p.z);if(e.hp<=0&&d>120||d>400||e.hp>0&&now-(e.born||now)>600000&&d>120)B.enemies.splice(k,1);}
 B.id=Math.max(Number(B.id)||0,...B.enemies.map(e=>e.id));}
// The first GATHER of a vein generation (not the Starter Vein, not flora) in ring 3+: the 35% roll, once, keyed by the server seed.
export function ambushRoll(s,slot,node){const A=L.ambush,v=s.lodes?.slots?.[slot];if(!v||s.mission)return;s.ambushed=record(s.ambushed)?s.ambushed:{};const gen=(v.gen|0)+1;if(s.ambushed[slot]===gen)return;s.ambushed[slot]=gen;
 for(const k of Object.keys(s.ambushed))if(!s.lodes?.slots?.[k])delete s.ambushed[k];
 if(W.ringAt(node.x,node.z)<A.ring||u32(s.lseed+':ambush:'+slot+':'+gen)/4294967296>=A.chance)return;s.ambush={slot,x:node.x,z:node.z,ms:0};}
function spawnGroup(s,B,kinds,keyBase,id0,dist,heart,now,avoid){const p=s.position,start=u32(s.lseed+':'+keyBase)%16,G=C.baseDefinition;
 for(let k=0;k<16;k++){const a=(start+k)*Math.PI/8,x=p.x+Math.cos(a)*dist,z=p.z+Math.sin(a)*dist;
  if(Math.hypot(x-R.x,z-R.z)<avoid||Math.hypot(x-G.x,z-G.z)<=G.radius+10||x<20||z<20||x>W.WIDTH-20||z>W.LENGTH-20)continue;
  if(!kinds.every((_,j)=>clearPad(x+offsets[j][0],z+offsets[j][1],B.enemies)))continue;
  kinds.forEach((kind,j)=>{const e=fresh(kind,keyBase+':'+j,id0+j,x+offsets[j][0],z+offsets[j][1],{r:L.aggro,leash:L.leash,heart},null,now);const at=B.enemies.findIndex(q=>q.id===e.id);if(at>=0)B.enemies.splice(at,1);B.enemies.push(e);});
  B.id=Math.max(Number(B.id)||0,...B.enemies.map(e=>e.id));return true;}
 return false;}
// One simulated command step in the open world (applyCommands): the calm clock, the incursion, the ambush timer.
export function livingStep(s,B,hit,now){if(s.mission||B.state!=='active'||B.playerHp<=0){s.calm=0;return;}const p=s.position,I=L.incursion,A=L.ambush,G=C.baseDefinition;
 const fight=hit||B.enemies.some(e=>e.hp>0&&Math.hypot(e.x-p.x,e.z-p.z)<I.fightR);s.calm=fight?0:Math.min(I.calmMs,(s.calm||0)+50);
 if(s.calm>=I.calmMs&&Math.hypot(p.x-R.x,p.z-R.z)>80&&Math.hypot(p.x-G.x,p.z-G.z)>G.radius&&!B.enemies.some(e=>e.hp>0&&/^incursion:/.test(e.key||''))){
  const n=(s.incursions|0)+1;if(spawnGroup(s,B,I.kinds,'incursion:'+n,L.ids.incursion,I.from,true,now,I.refuge)){s.incursions=n;s.calm=0;s.notice={kind:'incursion',n,count:I.kinds.length};}}
 if(s.ambush){const a=s.ambush;if(!near(p,a.x,a.z,A.stay)){delete s.ambush;return;}a.ms+=50;
  if(a.ms>=A.afterMs&&!B.enemies.some(e=>e.hp>0&&/^ambush:/.test(e.key||''))){const key='ambush:'+a.slot.replace(/[^a-z0-9]/gi,'-')+':'+(s.ambushed?.[a.slot]|0);if(spawnGroup(s,B,A.kinds,key,L.ids.ambush,A.from,true,now,60)){delete s.ambush;s.notice={kind:'ambush',count:A.kinds.length};}}}}
// Sortie chain (§5.7). links: wins already in the chain (0 if it lapsed). A win returns the links it found (its bonus).
export function chainLinks(s,now){const c=s.chain;return record(c)&&now-(Number(c.at)||0)<=L.chain.windowMs?Math.max(0,c.n|0):0;}
export function chainWin(s,now){const k=chainLinks(s,now);s.chain={n:Math.min(L.chain.max,k+1),at:now};return k;}   // the meter holds at three links
export const chainBonus=k=>Math.min(L.chain.max,Math.max(0,k|0))*L.chain.per;
export function chainBreak(s){delete s.chain;}
