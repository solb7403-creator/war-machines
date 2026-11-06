// Fast travel network (Worker-authoritative): Refuge, Command Base and captured sectors; safe departure only; position-only.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {createState,applyCommands,applyAction}=await import('../../worker/src/conquest-sim.js');
const C=CONQUEST.Combat,K=CONQUEST.Control,W=CONQUEST.World;let now=1_800_000_000_000;
const act=(s,action,extra={})=>applyAction(s,{seq:s.seq+1,action,...extra},now+=1000);
const fail=(s,action,extra,re)=>assert.throws(()=>act(structuredClone(s),action,extra),re);
const at=(s,x,z)=>{s.position={x,z,y:W.groundAt(x,z),surface:'ground'};return s;};
let s=createState(R.STOCK_L,now);s.ledger.cargo={alloy:40,biomass:30,helium:5};const ledger=JSON.stringify(s.ledger);
// 1. From the respawn point (Refuge viaduct) to the Refuge supply terminal; cargo stays carried and unbanked.
s=act(s,'fast-travel',{destination:'refuge'});const refuge=C.travelNodes({},0)[0];
assert(Math.hypot(s.position.x-C.refuge.x,s.position.z-C.refuge.z)<=C.refuge.radius,'arrives at the Refuge terminal');assert.equal(JSON.stringify(s.ledger),ledger,'cargo stays unbanked; nothing else changes');assert.equal(s.notice.kind,'fast-travel');
assert(K.baseBlocked({baseTier:5},refuge.arrivals[0])===false);
// 2. Destinations must be secured: uncaptured sectors and an unbuilt base are refused; depart-only nodes are not destinations.
fail(s,'fast-travel',{destination:'ash'},/destination not secured/);fail(s,'fast-travel',{destination:'base'},/destination not secured/);fail(s,'fast-travel',{destination:'refuge-viaduct'},/destination not secured/);
fail(s,'fast-travel',{destination:7},/invalid travel/);fail(s,'fast-travel',{destination:'refuge',mission:'x'},/invalid travel/);
// 3. Departure only from a node: an uncaptured frontier spot is refused.
fail(at(structuredClone(s),1160,1030),'fast-travel',{destination:'refuge'},/departs from the Refuge/);
// 4. Not mid-combat: a live hostile within 60 m, or damage in the last 10 s, blocks departure.
{const t=structuredClone(s),e=t.battle.enemies.find(e=>e.hp>0);e.x=t.position.x+20;e.z=t.position.z;fail(t,'fast-travel',{destination:'refuge'},/Hostiles within 60 m/);}
{const t=structuredClone(s);t.lastHitAt=now+500;fail(t,'fast-travel',{destination:'refuge'},/Under fire/);}
// A real hit recorded by the Worker's own replay sets the timer.
{let t=structuredClone(s);const e=t.battle.enemies.find(e=>e.hp>0&&e.kind==='raider');Object.assign(e,{x:t.position.x+14,z:t.position.z,y:t.position.y,home:{x:t.position.x+14,z:t.position.z,y:t.position.y+2.2},route:null});t.creditMs=4000;let hit=false;for(let i=0;i<12&&!hit;i++){t=applyCommands(t,{seq:t.seq+1,commands:Array(20).fill({x:0,z:0})},now+=1000);hit=!!t.lastHitAt;}
 assert(hit,'hostile fire records lastHitAt');for(const x of t.battle.enemies)x.hp=0;fail(t,'fast-travel',{destination:'refuge'},/Under fire/);now+=10001;assert.doesNotThrow(()=>act(structuredClone(t),'fast-travel',{destination:'refuge'}));}
// 5. Not during an operation.
{const t=structuredClone(s);t.mission='convoy';fail(t,'fast-travel',{destination:'refuge'},/Finish or leave the operation/);}
// 6. Every captured sector joins the network; arrival avoids live hostiles; base joins once built and stays outside its walls.
{let t=structuredClone(s);t.territory.ash={owner:'humanity',status:'secured',capturedAt:now};t.base.tier=3;t=act(t,'fast-travel',{destination:'ash'});
 const ash=C.sectors.find(x=>x.id==='ash');assert(Math.hypot(t.position.x-ash.x,t.position.z-ash.z)<=ash.radius,'arrives inside the captured sector');assert(!t.battle.enemies.some(e=>e.hp>0&&Math.hypot(e.x-t.position.x,e.z-t.position.z)<60),'arrival is clear of live hostiles');
 for(const e of t.battle.enemies)if(Math.hypot(e.x-t.position.x,e.z-t.position.z)<60)e.hp=0;t=act(t,'fast-travel',{destination:'base'});
 assert(Math.hypot(t.position.x-C.baseDefinition.x,t.position.z-C.baseDefinition.z)<=C.baseDefinition.radius,'arrives at the Command Base terminal');assert.equal(K.baseBlocked({baseTier:t.base.tier},t.position),false,'outside the base walls');
 t=act(t,'fast-travel',{destination:'ash'});assert.equal(t.notice.destination,'ash','base is a departure node too');}
// 7. Every authored arrival has open, level footing inside its node.
for(const n of C.travelNodes(Object.fromEntries(C.sectors.map(x=>[x.id,{owner:'humanity'}])),5).filter(n=>n.arrivals)){assert(n.arrivals.length>=9,n.id);for(const p of n.arrivals){assert(!W.solidAt(p.x,p.z),n.id);assert(Math.hypot(p.x-n.x,p.z-n.z)<=n.radius,n.id);}}
console.log('PASS fast travel: Refuge/base/captured sectors only, safe departure (60 m, 10 s, no operation), clear arrival, cargo unbanked');
