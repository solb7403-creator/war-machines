import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
let clock=0,ratio=1.5;const c=vm.createContext({console,performance:{now:()=>clock},gfxMode:()=> 'auto',devicePixelRatio:3});
vm.runInContext(fs.readFileSync('js/conquest/view.js','utf8'),c);
const v=Object.create(c.ConquestView.prototype);v.renderer={setPixelRatio:r=>ratio=r,isConquestCanvas:false};
function frames(n,ms){for(let i=0;i<n;i++){clock+=ms;v.profileFrame();}}
frames(61,40);assert.equal(ratio,1.5,'one slow window cannot flicker quality');frames(60,40);assert.equal(ratio,1,'sustained load reduces supersampling first');frames(120,40);assert.equal(ratio,.75,'heavy sustained GPU load has another bounded scale step');
frames(360,16);assert.equal(ratio,.75,'recovery needs longer hysteresis');frames(720,16);assert.equal(ratio,1,'sustained recovery restores one step');
assert(v.frameSamples.length<=600,'telemetry is bounded');console.log('PASS adaptive visual scale, slow/fast hysteresis and bounded telemetry');
