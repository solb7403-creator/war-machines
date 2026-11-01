// Final legend task replaces only legends: protect PR15 standard collection byte for byte.
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),ctx=createContext({console});
runInContext(readFileSync(new URL('js/vendor/three.lunar.min.js',root),'utf8'),ctx);
runInContext(readFileSync(new URL('js/rules.js',root),'utf8'),ctx);
// Fixture recorded from merged PR #13, commit 385356ea4ffac207900d05be6fbdf1965081fa63.
// Re-recorded for the nine-chassis size/silhouette redesign: only the eight redesigned chassis (all chassis except
// Vanguard T0) changed; every weapon kit and the Vanguard starter stay byte identical to PR15.
const source=readFileSync(new URL('js/models3d.js',root),'utf8');
runInContext(source+'\nglobalThis.models=M3;globalThis.paints=PAINTS;',ctx);const {models:M,paints}=ctx;
function hash(raw){
 const h=createHash('sha256');
 const add=k=>{const b=M.bake(k);for(const [key,g] of Object.entries(b)){h.update(key);if(!g)continue;for(const a of ['position','normal','color']){const ar=g.attributes[a].array;h.update(Buffer.from(ar.buffer,ar.byteOffset,ar.byteLength));}g.dispose();}};
 add(raw.k);h.update(JSON.stringify(raw.meta));for(const a of raw.anims){const {k,...meta}=a;h.update(JSON.stringify(meta));add(k);}return h.digest('hex');
}
const results={};
for(const cls of ['scout','vanguard','titan'])for(let tier=0;tier<3;tier++)for(const [paint,P] of Object.entries(paints)){
 results['c/'+cls+'/'+tier+'/'+paint]=hash(M.chassisKit(cls,tier,P,'#4d9fff',['dmg','rof','arm'],false));
 for(const arch of ['pulse','twin','siege'])results['w/'+cls+'/'+arch+'/'+tier+'/'+paint]=hash(M.weaponKit(arch,tier,P,'#4d9fff',false,cls));
}
const fixture=new URL('fixtures/standard-pr15-geometry.json',import.meta.url);
assert.deepEqual(results,JSON.parse(readFileSync(fixture,'utf8')),'PR15 standards must remain byte identical');
console.log('PASS',Object.keys(results).length,'unchanged standard kits, paints, normals, colors, metadata and animations against PR15');
