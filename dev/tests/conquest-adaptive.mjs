// Conquest adaptive resolution (Session 5E-2a, owner: drop resolution only while frame time is really over budget, climb back
// when it recovers; LOW stays 1x). Real js/graphics.js governor + js/conquest/view.js frame profiler, simulated frame times.
import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
let clock=0,ratio=null;
function view(dpr,mode='auto'){
 clock=0;ratio=null;const c=vm.createContext({console,performance:{now:()=>clock},gfxMode:()=>mode,devicePixelRatio:dpr});c.globalThis=c;
 vm.runInContext(fs.readFileSync('js/graphics.js','utf8'),c);vm.runInContext(fs.readFileSync('js/conquest/view.js','utf8'),c);
 const v=Object.create(c.ConquestView.prototype);v.renderer={setPixelRatio:r=>ratio=r,getPixelRatio:()=>ratio,isConquestCanvas:false};v.setupResolution();return v;
}
const frames=(v,n,ms)=>{for(let i=0;i<n;i++){clock+=ms;v.profileFrame();}};
{const v=view(2);   // desktop at 2x: the full device ratio, no cap at 1.5 any more
 assert.equal(ratio,2,'desktop HIGH starts at the full device ratio');
 frames(v,14,40);assert.equal(ratio,2,'half a second over budget cannot flicker the resolution');
 frames(v,16,40);assert.equal(ratio,1.75,'sustained load lowers the resolution one step');
 assert.equal(!!v.autoLow,false,'shading is not cut while resolution can still drop');
 frames(v,400,40);assert.equal(ratio,1,'still over budget: down to the 1x floor, never below');
 frames(v,200,40);assert.equal(v.autoLow,true,'only at the floor and still slow: cheaper shading (auto-low)');
 frames(v,600,16);assert.ok(ratio>1,'frames recover: the resolution climbs back ('+ratio+')');
 frames(v,2400,16);assert.equal(ratio,2,'long recovery: back to the full ratio');assert.equal(v.autoLow,false,'auto-low lifts once frames recover');
 assert(v.frameSamples.length<=600,'telemetry is bounded');}
{const v=view(3);assert.equal(ratio,3,'desktop 3x display: full ratio');}
{const v=view(3,'low');assert.equal(ratio,1,'LOW graphics stays 1x');frames(v,600,16);assert.equal(ratio,1,'LOW never climbs');}
{const v=view(2,'high');frames(v,900,40);assert.equal(ratio,2,'manual HIGH keeps its resolution (the governor runs in auto only)');}
console.log('PASS adaptive resolution: one step at a time under sustained load, 1x floor, auto-low only at the floor, climbs back, LOW fixed at 1x, bounded telemetry');
