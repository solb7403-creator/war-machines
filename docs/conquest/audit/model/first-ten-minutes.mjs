// Conquest fun audit (Nov 10 2026): the first ten minutes measured from the real world data and rules, not a stopwatch in
// software GL. Read-only. Distances are drivable A* routes (ConquestWorld.route, the same rules the HUD arrow uses); speed is
// the stock kit's real machine speed; fight durations come from the authored archetypes vs the stock Pulse Cannon.
import {buildSim} from '../../../../worker/build-sim.mjs';buildSim();
const {CONQUEST,RULES:R}=await import('../../../../worker/src/sim.gen.js');const {Combat:C,World:W}=CONQUEST;
const {createState}=await import('../../../../worker/src/conquest-sim.js');
const s=createState(R.STOCK_L,Date.now());
const B=new C.Encounter(s.loadout,s.position);
const speed=B.combatSpeed; // m/s for the stock kit in Conquest
const route=(a,b)=>{let r=null;try{r=W.route?W.route({x:a.x,z:a.z,y:W.groundAt(a.x,a.z)},{x:b.x,z:b.z,y:W.groundAt(b.x,b.z)}):null;}catch(e){r=null;}if(!r||!r.length)return {m:Math.hypot(a.x-b.x,a.z-b.z),straight:true};let d=0;for(let i=1;i<r.length;i++)d+=Math.hypot(r[i].x-r[i-1].x,r[i].z-r[i-1].z);return {m:d,straight:false};};
const spawn={x:s.position.x,z:s.position.z},refuge={x:C.refuge.x,z:C.refuge.z},gate={x:C.baseDefinition.x,z:C.baseDefinition.z};
const ops=C.operations;const legs=[['spawn → Refuge supply terminal',spawn,refuge],['spawn → HOLD THE OXYGEN LINE (first mission)',spawn,{x:C.mission.x,z:C.mission.z}],['Refuge → Oxygen Line',refuge,{x:C.mission.x,z:C.mission.z}],['Oxygen Line → Refuge (bank)',{x:C.mission.x,z:C.mission.z},refuge],['Refuge → Command Gate (MY BASE)',refuge,gate],['Refuge → INTERCEPT THE CONVOY',refuge,{x:ops.convoy.x,z:ops.convoy.z}],['Refuge → SABOTAGE THE RELAY',refuge,{x:ops.relay.x,z:ops.relay.z}],['Refuge → SIGNAL RECOVERY',refuge,{x:ops.recon.x,z:ops.recon.z}],['Refuge → BEACON EXTRACTION',refuge,{x:ops.rescue.x,z:ops.rescue.z}],['Refuge → BREAK THE REDOUBT',refuge,{x:ops.redoubt.x,z:ops.redoubt.z}],['Refuge → nearest HARD raid (dust-switchback)',refuge,{x:ops['raid-intercept-1'].x,z:ops['raid-intercept-1'].z}]];
const out={speedMs:+speed.toFixed(2),spawn,legs:[]};
for(const [name,a,b] of legs){const r=route(a,b);out.legs.push({leg:name,metres:Math.round(r.m),seconds:Math.round(r.m/speed),straightLine:r.straight});}
// stock Pulse vs each archetype: time to kill at 100% accuracy (no cooling/heat), and the enemy's time to kill the player
const P=B.playerStats,dps=P.wdps/P.wshot;out.playerHp=Math.round(P.mhp);out.playerDps=+dps.toFixed(1);out.enemies={};
for(const [k,a] of Object.entries(C.archetypes))out.enemies[k]={hp:a.hp,dps:a.dps,range:a.range,ttkSeconds:+(a.hp/dps).toFixed(1),killsPlayerInSeconds:+(P.mhp/a.dps).toFixed(1)};
// oxygen line: three waves
out.oxygenLineWaves=C.formations.map(f=>f.map(x=>x[0]));out.oxygenLineTtkSeconds=+C.formations.flat().reduce((t,[k])=>t+C.archetypes[k].hp/dps,0).toFixed(1);
// first-mission rewards and the first plate / first base thresholds
out.firstClearCP={'oxygen-line':250,convoy:140,relay:130,recon:100,rescue:150,redoubt:220};out.firstBase=C.baseDefinition.recipe;out.firstPlate=R.PLATE.cost[1];out.starterVein=35;
out.hullRegenInField=false;out.repairOnlyAt='Refuge terminal (12 m) or base gate zone (30 m)';
console.log(JSON.stringify(out,null,1));
