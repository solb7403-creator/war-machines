import assert from 'node:assert/strict';
import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C,Control:K},RULES:R}=await import('../../worker/src/sim.gen.js');
const p={x:1500,z:1500,y:W.groundAt(1500,1500),surface:'ground'},results=[];
for(const fps of [15,30,60])for(const coreLevel of [-1,0,5,10])for(const thermal of [-3,0,3]){
 const L=structuredClone(R.STOCK_L);L.w.a='moon';L.cores=coreLevel<0?[]:['rof'];L.gl={rof:Math.max(0,coreLevel)};
 const b=new C.Encounter(L,p);b.enemies=[];b.engineering=C.engineeringDefaults({tuning:{thermal}});
 // Real legal RoF core levels, through canonical tankOf and rofMult.
 while(!b.overheated&&b.time<90)K.advance(b,p,{x:0,z:0,fire:true},1/fps,false);
 assert(b.overheated,'finite uninterrupted thermal budget');assert(b.playerShots>=20,`Moonbeam ${fps} FPS / RoF ${coreLevel} / thermal ${thermal}: ${b.playerShots} shots`);
 if(coreLevel===-1&&thermal===0)assert(b.playerShots>=24&&b.playerShots<=35,'baseline 24–35 shots');
 const shots=b.playerShots,vent=b.time;while(b.overheated&&b.time<vent+12)K.advance(b,p,{x:0,z:0},1/fps,false);
 assert(b.time-vent>=4&&b.time-vent<=8,'4–8 second vent');assert.equal(b.playerShots,shots);
 if(fps===60)results.push({coreLevel,thermal,shots,ventSeconds:+(b.time-vent).toFixed(2)});
}
console.log('PASS Moonbeam held-fire thermal matrix',JSON.stringify(results));
