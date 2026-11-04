import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const ctx=createContext({console});
for(const f of ['js/rules.js','js/conquest/world.js'])runInContext(readFileSync(f,'utf8'),ctx);
runInContext('globalThis.R={STOCK_L,tankOf,machineMetrics,STAT,GEM,ecoNorm,labEnsure,labLoadout};',ctx);
const {R,ConquestWorld:W}=ctx;
// Removing equipment speed or elapsed accounting must break physical displacement assertions.
let builds=0;
for(const c of ['vanguard','scout','titan'])for(const t of [0,1,2])for(const engine of [0,4])for(const spd of [false,true])for(const level of [1,5])for(const mods of [{},{hull:'light',mobility:'sprint'},{hull:'plates',mobility:'stable'}]){
 builds++;const L=JSON.parse(JSON.stringify(R.STOCK_L));L.c={c,t,q:t?1.1:1,s:false};L.up.engine=engine;L.cores=spd?['spd']:[];L.gl={spd:level};L.mods=mods;
 const tank=R.tankOf(L,1),exact=R.STAT.speed*tank.spdM*(1+(spd?R.GEM.spd.amt*tank.gemM.spd:0));
 assert.equal(W.travelSpeed(L),2*exact);assert(Math.abs(W.travelSpeed(L)/2-R.machineMetrics(L).spd)<=.051);
 for(const fps of [10,15,20,60]){let p={x:902,z:1024,y:W.deckAt(902,1024),surface:'bridge'},time=0;for(let i=0;i<fps*2;i++){const dt=W.frameSeconds(i*1000/fps,(i+1)*1000/fps);p=W.advance(p,W.travelSpeed(L)*dt,0);time+=dt;}assert(Math.abs(p.x-902-2*exact*time)<1e-8);}
}
assert.equal(W.frameSeconds(0,30000),0);assert.equal(W.frameSeconds(0,100),.1);
let p={x:1024,z:1015,y:24,surface:'bridge'};p=W.advance(p,0,-100);assert.equal(p.z,1015,'no tunneling through rail');
const S={};R.ecoNorm(S);R.labEnsure(S,R.STOCK_L);const ids=Object.keys(S.lab.machines);S.lab.active=ids[0];const a=R.labLoadout(S);S.up.engine=4;assert(W.travelSpeed(R.labLoadout(S))>W.travelSpeed(a));S.cOwn.scout=[0];S.lab.machines[ids[1]].spec.c={c:'scout',t:0,s:false};S.lab.active=ids[1];assert.equal(R.labLoadout(S).c.c,'scout');assert(W.travelSpeed(R.labLoadout(S))>W.travelSpeed({...a,up:{...a.up,engine:4}}));S.lab.machines[ids[1]].spec.c={c:'titan',t:2,s:false};assert.equal(R.labLoadout(S).c.c,'vanguard','unowned chassis is rejected');
console.log('PASS '+builds+' builds: exact tankOf speed, rounded machineMetrics tolerance, 10/15/20/60 FPS, bounded resume, rails, current account upgrades/bays. Obstacle-free ramp displacement; terrain/obstacles excluded from speed parity.');
