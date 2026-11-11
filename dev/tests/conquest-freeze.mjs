// Owner, Nov 11 2026: Conquest froze on iPhone after 5E-2a (2.5x + MSAA; frames over 250 ms never stepped the resolution down).
// This guards both halves: an overloaded visible page drops to the floor after three huge frames, a hidden tab never does,
// and Conquest on a phone is capped at 1.5x with no MSAA.
import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const load=(o={})=>{const c=vm.createContext({console,document:{hidden:!!o.hidden},devicePixelRatio:3,matchMedia:q=>({matches:/coarse/.test(q)})});c.globalThis=c;vm.runInContext(fs.readFileSync('js/graphics.js','utf8')+';globalThis.GR=GraphicsResolution;',c);return c;};
let c=load(),g=c.GR.governor(2.5,{min:1,start:2.5});
assert.equal(g.sample(900,1),null);assert.equal(g.sample(900,2),null);assert.equal(g.sample(900,3),1,'three huge frames on a visible page must drop to the floor');
g=c.GR.governor(2.5,{min:1,start:2.5});assert.equal(g.sample(900,1),null);g.sample(16,1.1);g.sample(900,2);g.sample(900,3);assert.equal(g.ratio,2.5,'one hitch between normal frames is not overload');
c=load({hidden:true});g=c.GR.governor(2.5,{min:1,start:2.5});for(let i=0;i<6;i++)g.sample(5000,i);assert.equal(g.ratio,2.5,'a hidden tab never steps down');
c=load();assert.equal(c.GR.CONQUEST_PHONE_MAX,1.5);assert.equal(c.GR.coarse(),true);
const v=fs.readFileSync('js/conquest/view.js','utf8');assert.ok(/antialias:GR&&!phone/.test(v),'Conquest on a phone must not use MSAA');assert.ok(!/this\.occluderFade\(dt\)/.test(v),'see-through buildings are off (owner)');
assert.ok(!/placeCam\(dt\);driveFade/.test(fs.readFileSync('js/conquest/plotview.js','utf8')),'town drive view: no see-through buildings (owner)');
console.log('PASS conquest freeze guard: overload drops to the floor, hidden tab ignored, phone 1.5x no MSAA, no see-through buildings');
