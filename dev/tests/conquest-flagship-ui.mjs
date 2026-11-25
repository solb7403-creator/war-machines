import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildSim} from '../../worker/build-sim.mjs';
for(const f of ['index.html','web/boot.js']){const s=fs.readFileSync(f,'utf8');assert(s.includes('conquest/catalog'),'catalog loaded on '+f);assert(s.includes('conquest/assets'),'assets loaded on '+f);}
buildSim();const {CONQUEST:C}=await import('../../worker/src/sim.gen.js');assert.equal(C.Catalog.items.filter(i=>!i.pool&&!i.earnOnly).length,20);assert.equal(C.Catalog.items.filter(i=>!i.pool&&i.earnOnly).length,6,'Session 7T decision 11: the return streak\'s three earn-only town decorations; Session 7C STEP 4: the War Effort\'s three tier pieces');assert.deepEqual(C.Catalog.items.filter(i=>!i.pool&&i.earnOnly).map(i=>i.id).filter(id=>!id.startsWith('streak-')),['we-standard','we-trail','we-monument']);assert.equal(C.Catalog.items.filter(i=>i.pool).length,20,'Session 6: twenty earn-only fragment pieces');
const app=fs.readFileSync('js/conquest/app.js','utf8'),view=fs.readFileSync('js/conquest/view.js','utf8');
for(const text of ['BRIEF · ','PERMANENT COLLECTION','warfront','raidProgress','3.5%'])assert(app.includes(text),'UI integrates '+text);
// Session 5C: the legacy fortress-defense controls are retired from the UI (the town Defense Drill is the one defense system);
// the Worker keeps the actions and fields for compatibility.
for(const text of ['DEPLOY BASE DEFENSE','REPAIR FORTRESS',"'defense-config'","'start-defense'"])assert(!app.includes(text),'legacy fortress defense UI retired: '+text);
{const w=fs.readFileSync('worker/src/conquest-sim.js','utf8')+fs.readFileSync('worker/src/conquest.js','utf8');for(const text of ['start-defense','defense-config'])assert(w.includes(text),'the Worker still accepts '+text);}
for(const text of ['hazardRender','ConquestAssets','ConquestCatalog','cosmetics.equipped'])assert(view.includes(text),'gameplay renderer integrates '+text);
assert(view.includes('C.sectors.map'),'physical sector banners share the actual sector control state');new vm.Script(app);new vm.Script(view);
console.log('PASS flagship client entry points, catalog shared build, game renderer and accessible UI integration');
