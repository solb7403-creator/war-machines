import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildSim} from '../../worker/build-sim.mjs';
for(const f of ['index.html','web/boot.js']){const s=fs.readFileSync(f,'utf8');assert(s.includes('conquest/catalog'),'catalog loaded on '+f);assert(s.includes('conquest/assets'),'assets loaded on '+f);}
buildSim();const {CONQUEST:C}=await import('../../worker/src/sim.gen.js');assert.equal(C.Catalog.items.length,20);
const app=fs.readFileSync('js/conquest/app.js','utf8'),view=fs.readFileSync('js/conquest/view.js','utf8');
for(const text of ['BRIEF · ','PERMANENT COLLECTION','start-defense','repair-base','defense-config','warfront','raidProgress','3.5%'])assert(app.includes(text),'UI integrates '+text);
for(const text of ['hazardRender','ConquestAssets','ConquestCatalog','cosmetics.equipped'])assert(view.includes(text),'gameplay renderer integrates '+text);
assert(view.includes('C.sectors.map'),'physical sector banners share the actual sector control state');new vm.Script(app);new vm.Script(view);
console.log('PASS flagship client entry points, catalog shared build, game renderer and accessible UI integration');
