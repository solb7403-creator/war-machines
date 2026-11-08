// Mineral veins (owner ore fix, Nov 8 2026; docs/economy/RESOURCE_ECONOMY.md §5.2): veins run dry, new ones appear.
// Server-only per-pilot state s.lodes = {v, seed, slots:{[slotId]:{spot, left, seen, dry, next, gen}}}:
//  - every (mineral, sector) FIELD of authored candidate spots keeps RULES.MN_VEIN[m].live veins (more where named);
//  - a vein holds MN_VEIN[m].cap units, mined in a few HOLD GATHER pulls (each pull is MN_GATHER's server roll, capped by
//    what is left); at zero it is EXHAUSTED for this pilot (dry = Worker clock);
//  - regrowMs after that, a NEW vein of that mineral surfaces at another spot of the same field, chosen by a hash of the
//    pilot's server seed, the slot, its generation and the UTC day; it stays hidden (seen = 0) until a SCAN reaches it.
// The client only ever sees the veins it has scanned (publicVeins): never the seed, the next spot or an unscanned vein.
// The Starter Vein keeps its once-ever rule in s.deposits / s.found (unchanged).
import {CONQUEST,RULES} from './sim.gen.js';
const W=CONQUEST.World,V=RULES.MN_VEIN,DAY=86400000;
const fieldMap=new Map();
for(const d of W.deposits){if(d.m==='starter')continue;const sector=W.frontierSectorAt(d.x,d.z).id,id=d.m+':'+sector;(fieldMap.get(id)||fieldMap.set(id,{id,m:d.m,sector,spots:[]}).get(id)).spots.push(d.id);}
export const FIELDS=Object.freeze([...fieldMap.values()].map(f=>Object.freeze({...f,spots:Object.freeze(f.spots),live:Math.min(f.spots.length,V[f.m].more?.[f.sector]||V[f.m].live)})));
export const SLOTS=Object.freeze(FIELDS.flatMap(f=>Array.from({length:f.live},(_,i)=>Object.freeze({id:f.id+':'+i,field:f}))));
const spotOf=Object.fromEntries(W.deposits.map(d=>[d.id,d]));
const hash=t=>{let h=2166136261;for(let i=0;i<t.length;i++)h=Math.imul(h^t.charCodeAt(i),16777619);return h>>>0;};
function seed(){try{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]>>>0;}catch{return hash(String(Date.now())+Math.random());}}
// Next spot for a slot: any spot of its field that no other live slot holds, never the slot's previous spot when another exists.
function pick(L,slot,gen,now,prev,prefer){const taken=new Set(Object.entries(L.slots).filter(([k,v])=>k!==slot.id&&v.spot&&slot.field.spots.includes(v.spot)).map(([,v])=>v.spot));
 let c=slot.field.spots.filter(id=>!taken.has(id));if(c.length>1&&prev)c=c.filter(id=>id!==prev);if(!c.length)c=slot.field.spots.slice();
 const pref=prefer&&c.find(id=>prefer(id));if(pref)return pref;return c[hash(L.seed+':'+slot.id+':'+gen+':'+Math.floor(now/DAY))%c.length];}
// Create (or migrate) the pilot's veins, then surface any vein whose regrow time has passed. Called on every refresh.
export function veins(s,now){
 if(!s.lodes||s.lodes.v!==1||typeof s.lodes.slots!=='object'||!s.lodes.slots){
  // Migration from the Phase 3 respawning deposits: the starter flag stays; a pilot's earlier finds become this pilot's first
  // live veins where they can (already on their MAP, no re-scan needed); old respawn clocks are dropped (nothing is granted).
  const oldFound=s.found&&typeof s.found==='object'?s.found:{},oldClock=s.deposits&&typeof s.deposits==='object'?s.deposits:{};
  const L={v:1,seed:seed(),slots:{}};
  for(const slot of SLOTS){const spot=pick(L,slot,0,now,null,id=>oldFound[id]&&!(oldClock[id]>now));L.slots[slot.id]={spot,left:V[slot.field.m].cap,seen:oldFound[spot]&&!(oldClock[spot]>now)?1:0,dry:0,next:0,gen:0};}
  s.lodes=L;
  const keep=o=>Object.fromEntries(Object.entries(o).filter(([k])=>spotOf[k]?.m==='starter'));if(s.found)s.found=keep(oldFound);if(s.deposits)s.deposits=keep(oldClock);
 }
 const L=s.lodes;
 for(const slot of SLOTS){let v=L.slots[slot.id];
  if(!v||!slot.field.spots.includes(v.spot)){v=L.slots[slot.id]={spot:pick(L,slot,0,now,null),left:V[slot.field.m].cap,seen:0,dry:0,next:0,gen:0};}
  if(v.left<=0&&v.next&&now>=v.next){const gen=(v.gen|0)+1;L.slots[slot.id]={spot:pick(L,slot,gen,v.next,v.spot),left:V[slot.field.m].cap,seen:0,dry:0,next:0,gen};}}
 for(const k of Object.keys(L.slots))if(!SLOTS.some(x=>x.id===k))delete L.slots[k];
 return L;
}
// The live vein at a spot, if this pilot has one there.
export function veinAt(s,spot){const L=s.lodes;if(!L)return null;for(const [id,v] of Object.entries(L.slots))if(v.spot===spot)return {id,v};return null;}
// Gather targets this pilot may pull from: scanned veins with ore left.
export function readyVeins(s){const out=[];for(const [id,v] of Object.entries(s.lodes?.slots||{}))if(v.seen&&v.left>0&&spotOf[v.spot])out.push({slot:id,v,node:spotOf[v.spot]});return out;}
// One pull: the server's roll capped by what the vein holds; at zero the vein is exhausted and its regrow clock starts.
export function pull(s,slotId,units,now){const v=s.lodes.slots[slotId],m=spotOf[v.spot].m,got=Math.max(0,Math.min(v.left,units));v.left-=got;
 if(v.left<=0){v.left=0;v.dry=now;v.next=now+V[m].regrowMs;}return {got,left:v.left,cap:V[m].cap,exhausted:v.left===0,regrowMs:V[m].regrowMs};}
// SCAN: reveal this pilot's live veins (and still-showing exhausted ones) within the radius. Returns {fresh, near}.
export function reveal(s,p,r,now){let fresh=0,near=0;for(const v of Object.values(s.lodes?.slots||{})){const d=spotOf[v.spot];if(!d||Math.hypot(d.x-p.x,d.z-p.z)>r)continue;if(v.left<=0&&now-v.dry>V.dryShowMs)continue;near++;if(!v.seen&&v.left>0){v.seen=1;fresh++;}}return {fresh,near};}
// What the client may see: scanned veins only (ore left, or exhausted within dryShowMs so the MAP can say EXHAUSTED).
export function publicVeins(s,now){const out={};for(const v of Object.values(s.lodes?.slots||{})){if(!v.seen||!spotOf[v.spot])continue;if(v.left<=0&&now-v.dry>V.dryShowMs)continue;const m=spotOf[v.spot].m;out[v.spot]={m,left:v.left,cap:V[m].cap,...(v.left<=0?{dry:v.dry}:{})};}return out;}
