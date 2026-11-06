// Reproducible local CPU profile, not Cloudflare production or phone telemetry.
// Optional module root supports old/new snapshots without mutating the checkout.
import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
const root=process.argv[2]?pathToFileURL(resolve(process.argv[2])+'/').href:new URL('../../worker/src/',import.meta.url).href;
const {RULES:R,CONQUEST:{World:W}}=await import(root+'sim.gen.js'),{createState,applyAction,applyCommands}=await import(root+'conquest-sim.js');
let now=1800000000000,s=createState(R.STOCK_L,now);s.position={x:1160,z:1048,y:W.groundAt(1160,1048),surface:'ground'};s=applyAction(s,{seq:1,action:'start-mission'},now);
const commands=Array(20).fill({x:0,z:0,shield:true});for(let i=0;i<12;i++){now+=1000;s=applyCommands(s,{seq:s.seq+1,commands},now);}
assert.equal(s.battle.state,'active');assert(s.hp>0);const seed=structuredClone(s),samples=[];
for(let i=0;i<50;i++){const state=structuredClone(seed),cpu=process.cpuUsage(),start=performance.now(),r=applyCommands(state,{seq:state.seq+1,commands},now+1000),used=process.cpuUsage(cpu);if(i>=10)samples.push({wall:performance.now()-start,cpu:(used.user+used.system)/1000,enemies:r.battle.enemies.filter(e=>e.hp>0).length,projectiles:r.battle.projectiles.length});}
const sorted=k=>samples.map(s=>s[k]).sort((a,b)=>a-b),wall=sorted('wall'),cpu=sorted('cpu');
assert(samples.every(s=>s.enemies>=16),'profile retains the authored dense encounter');assert(samples.some(s=>s.projectiles>0),'profile contains real active fire');
console.log(JSON.stringify({scope:'local warm Node Worker replay; 20 canonical commands / one game second; genuine oxygen + world actor state after12s, reset load-test fixture each sample; not Cloudflare production CPU or physical phone evidence',node:process.version,samples:samples.length,wallMedianMs:wall[20],wallP95Ms:wall[38],cpuMedianMs:cpu[20],cpuP95Ms:cpu[38],enemies:samples[0].enemies,projectiles:samples[0].projectiles},null,2));
