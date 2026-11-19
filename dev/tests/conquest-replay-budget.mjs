// Reproducible local CPU profile, not Cloudflare production or phone telemetry.
// Optional module root supports old/new snapshots without mutating the checkout.
import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
const root=process.argv[2]?pathToFileURL(resolve(process.argv[2])+'/').href:new URL('../../worker/src/',import.meta.url).href;
const {RULES:R,CONQUEST:{World:W}}=await import(root+'sim.gen.js'),{createState,applyAction,applyCommands}=await import(root+'conquest-sim.js');
let now=1800000000000,s=createState(R.STOCK_L,now);s.position={x:1160,z:1048,y:W.groundAt(1160,1048),surface:'ground'};s=applyAction(s,{seq:1,action:'start-mission'},now);
const commands=Array(20).fill({x:0,z:0,shield:true});for(let i=0;i<12;i++){now+=1000;s=applyCommands(s,{seq:s.seq+1,commands},now);}
assert.equal(s.battle.state,'active');assert(s.hp>0);
// Session 6C: CQ_FRIENDS=10 adds ten friendly units (the cap; six roles, militia kits) beside the pilot and four more Parasites,
// for the replay budget of a full Battalion fight (docs/conquest-living-war/replay-budget.json battalion6c)
const FR=Number(process.env.CQ_FRIENDS)||0;if(FR){const C=(await import(root+'sim.gen.js')).CONQUEST.Combat,roles=['guardian','lancer','mender','breacher','corroder','frostline'];
 for(let i=0;i<FR;i++){const r=roles[i%6];s.battle.friends.push(C.friendUnit({id:800000001+i,pid:'p'+i,role:r,kit:{w:{a:'pulse',t:0,q:1},c:{c:C.ROLES[r].cls[0],t:0,q:1}},x:s.position.x-6+(i%5)*3,z:s.position.z+4+Math.floor(i/5)*4,m:1}));}
 s.battle.squad={...(s.battle.squad||{}),orders:1,f:'wedge'};for(let i=0;i<4;i++)s.battle.enemies.push({...structuredClone(s.battle.enemies.find(e=>!e.resident&&e.hp>0)),id:900+i,x:1140+i*8,z:1090,hp:330,rewardKey:'budget:'+i});
 for(let i=0;i<4;i++){now+=1000;s=applyCommands(s,{seq:s.seq+1,commands},now);}}
const seed=structuredClone(s),samples=[];
for(let i=0;i<50;i++){const state=structuredClone(seed),cpu=process.cpuUsage(),start=performance.now(),r=applyCommands(state,{seq:state.seq+1,commands},now+1000),used=process.cpuUsage(cpu);if(i>=10)samples.push({wall:performance.now()-start,cpu:(used.user+used.system)/1000,enemies:r.battle.enemies.filter(e=>e.hp>0).length,projectiles:r.battle.projectiles.length,friends:(r.battle.friends||[]).length});}
const sorted=k=>samples.map(s=>s[k]).sort((a,b)=>a-b),wall=sorted('wall'),cpu=sorted('cpu');
assert(samples.every(s=>s.enemies>=16),'profile retains the authored dense encounter');assert(samples.some(s=>s.projectiles>0),'profile contains real active fire');
console.log(JSON.stringify({...(FR?{friends:samples[0].friends}:{}),scope:'local warm Node Worker replay; 20 canonical commands / one game second; genuine oxygen + world actor state after12s, reset load-test fixture each sample; not Cloudflare production CPU or physical phone evidence',node:process.version,samples:samples.length,wallMedianMs:wall[20],wallP95Ms:wall[38],cpuMedianMs:cpu[20],cpuP95Ms:cpu[38],enemies:samples[0].enemies,projectiles:samples[0].projectiles},null,2));
