// Byte-level geometry/color/normal/animation parity for every non-target standard variant and both legends.
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),ctx=createContext({console});
runInContext(readFileSync(new URL('js/vendor/three.lunar.min.js',root),'utf8'),ctx);
runInContext(readFileSync(new URL('js/rules.js',root),'utf8'),ctx);
// Fixture recorded from merged PR #13, commit 385356ea4ffac207900d05be6fbdf1965081fa63.
const source=readFileSync(new URL('js/models3d.js',root),'utf8');
runInContext(source+'\nglobalThis.models=M3;globalThis.paints=PAINTS;',ctx);const {models:M,paints}=ctx;
function hash(raw){
 const h=createHash('sha256');
 const add=k=>{const b=M.bake(k);for(const [key,g] of Object.entries(b)){h.update(key);if(!g)continue;for(const a of ['position','color','normal']){const ar=g.attributes[a].array;h.update(Buffer.from(ar.buffer,ar.byteOffset,ar.byteLength));}g.dispose();}};
 add(raw.k);h.update(JSON.stringify(raw.meta));for(const a of raw.anims){const {k,...meta}=a;h.update(JSON.stringify(meta));add(k);}return h.digest('hex');
}
const results={};
for(const cls of ['scout','vanguard','titan'])for(let tier=0;tier<3;tier++)for(const lunar of [false,true]){
 if(!(cls==='vanguard'&&tier===0&&!lunar))results['chassis/'+cls+'/'+tier+'/'+lunar]=hash(M.chassisKit(cls,tier,paints.stock,'#4d9fff',['dmg','rof','arm'],lunar));
 for(const w of ['pulse','twin','siege'])if(!(cls==='vanguard'&&w==='pulse'&&tier===0&&!lunar))results['weapon/'+cls+'/'+w+'/'+tier+'/'+lunar]=hash(M.weaponKit(w,tier,paints.stock,'#4d9fff',lunar,cls));
}
for(const cls of ['scout','vanguard','titan'])for(const lunar of [false,true])results['legend/moon/'+cls+'/'+lunar]=hash(M.weaponKit('moon',2,paints.stock,'#4d9fff',lunar,cls));
const fixture=new URL('fixtures/defender-legacy-geometry.json',import.meta.url);
assert.deepEqual(results,JSON.parse(readFileSync(fixture,'utf8')),'non-target models, Lunar Skin and Moonbeam must remain byte-identical');
console.log('PASS',Object.keys(results).length,'unchanged chassis/weapon/legend geometry, normals, colors and animations against PR #13');
