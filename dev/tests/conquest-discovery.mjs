import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const local=new Map(),source=readFileSync('js/conquest/discovery.js','utf8');
function account(key){const ctx=createContext({console,Uint8Array,Map,Set,Math,Number,JSON,Date,setTimeout,clearTimeout,localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary')});runInContext(`const SAVE_KEY=${JSON.stringify(key)};const save={};function store(){}`,ctx);runInContext(readFileSync('js/conquest/world.js','utf8'),ctx);runInContext(source,ctx);return ctx.ConquestDiscovery.create();}
const d=account('alice');assert(!d.has(900,1024));d.spawn({x:898,z:1024});assert(d.has(898,1024));assert(!d.has(1500,1500));
let p={x:898,z:1024};for(let i=0;i<200;i++){const q={x:p.x+2,z:p.z};assert(d.accept(p,q,.25,8.8));p=q;}assert(d.has(1100,1024));assert(d.has(1298,1024));assert(!d.has(1800,1024));
const version=d.version;assert(!d.accept(p,p,.25,8.8));assert(!d.accept(p,{x:20000,z:20000},.25,8.8));assert(!d.has(20000,20000));assert(!d.has(10000,10000));assert.equal(d.version,version);
// Rendering, map queries and arbitrary camera/display locations never mutate discovery.
for(let i=0;i<30;i++){d.has(i*1000,i*1000);d.cellsIn({x:0,z:0,width:31680,height:47520});}assert.equal(d.version,version);
d.flush();const same=account('alice');assert(same.has(1298,1024));assert(!same.has(20000,20000));assert(!account('bob').has(1298,1024));
assert(!same.accept({x:0,z:0},{x:NaN,z:0},.1,8.8));assert(!same.accept({x:0,z:0},{x:1,z:0},10,8.8));
// Diagnostic jump followed by legitimate travel reveals only the destination's physical travel radius.
assert(same.accept({x:20000,z:20000},{x:20001,z:20000},.2,8.8));assert(same.has(20001,20000));assert(!same.has(10000,10000));same.flush();
console.log('PASS discovery: blank start, spawn, accepted path continuity, blocked/overspeed/invalid rejection, read-only map queries, persistence, account isolation, no teleport corridor');
// Execute the production map with a lightweight DOM/canvas, exercising the real button handlers.
const mapSource=readFileSync('js/conquest/app.js','utf8');
const mapFunction=mapSource.slice(mapSource.indexOf('function map(v){'),mapSource.indexOf('function tick(now)'));
const mapCtx=createContext({console,Map,Set,Math,Number});
runInContext(readFileSync('js/conquest/world.js','utf8'),mapCtx);
mapCtx.ledger=account('map-only');
runInContext(`const original=ConquestWorld;let samples=0;const W={...original,biomeAt(...args){if(!ledger.has(...args))throw Error('map sampled undiscovered terrain');samples++;return original.biomeAt(...args);}};
const root={ConquestDiscovery:{create:()=>ledger}};const panel={querySelector:()=>null};let view=null,mapOpen=false;const buttons=[];
const context=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
function el(){return {getContext:()=>context,append(){},getBoundingClientRect:()=>({x:0,y:0,width:360,height:420})};}
function button(label,fn){buttons.push({label,fn});return {};}
function dialog(){return {classList:{add(){}},remove(){}};}
${mapFunction}
map(null);for(const b of buttons)b.fn();globalThis.sampleCount=samples;`,mapCtx);
assert.equal(mapCtx.sampleCount,0,'unexplored map does not even sample unknown biomes');
assert.equal(mapCtx.ledger.version,0,'opening and zooming production map never discovers terrain');
mapCtx.ledger.spawn({x:898,z:1024});
const beforeMap=mapCtx.ledger.version;
runInContext('map({discovery:ledger,p:{x:898,z:1024}});for(const b of buttons)b.fn();',mapCtx);
assert.equal(mapCtx.ledger.version,beforeMap,'locate-self, pan/zoom controls remain read-only');
runInContext('W.horizon(20000,20000);',mapCtx);
assert.equal(mapCtx.ledger.version,beforeMap,'rendering remote horizon cannot discover terrain');
assert(!mapCtx.ledger.has(20000,20000));mapCtx.ledger.flush();
console.log('PASS production strategic map: unknown biomes never sampled, zoom/whole-world/locate cannot discover; distant horizon generation cannot discover');
// Account save remains the persistence path if local storage is unavailable (e.g. private/offline quota).
const failingStorage=createContext({console,setTimeout,clearTimeout,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),localStorage:{getItem(){throw Error('unavailable');},setItem(){throw Error('quota');}}});
runInContext(readFileSync('js/conquest/world.js','utf8'),failingStorage);runInContext(source,failingStorage);
runInContext(`let saved={},writes=0;const ledger=ConquestDiscovery.Discovery;const first=new ledger('alice',()=>saved,()=>writes++);first.spawn({x:898,z:1024});first.flush();globalThis.writes=writes;globalThis.savedBytes=JSON.stringify(saved).length;const second=new ledger('alice',()=>saved,()=>{});globalThis.restored=second.has(898,1024);`,failingStorage);
assert.equal(failingStorage.writes,1);assert(failingStorage.restored);assert(failingStorage.savedBytes<1000,'spawn is compact tile state rather than map imagery');
console.log('PASS account-save persistence survives localStorage failure; spawn ledger under1KB');
// Telegram cloudLoad may replace save after the view was constructed; flushing must union, never overwrite it.
runInContext(`{
 let current={};const D=ConquestDiscovery.Discovery;
 const local=new D('cloud-race',()=>current,()=>{});local.spawn({x:898,z:1024});
 const remoteSave={};const remote=new D('cloud-race',()=>remoteSave,()=>{});remote.spawn({x:20000,z:20000});remote.flush();
 current=remoteSave;local.flush();const restored=new D('cloud-race',()=>current,()=>{});
 globalThis.raceLocal=restored.has(898,1024);globalThis.raceRemote=restored.has(20000,20000);
}`,failingStorage);
assert(failingStorage.raceLocal&&failingStorage.raceRemote,'flush unions newly loaded account discoveries with physical travel');
console.log('PASS late Telegram account snapshot cannot erase local or remote exploration');
// A physically plausible 46km corridor must not resample thousands of invisible subpixel terrain cells.
for(let z=1000;z<=47000;z+=64)mapCtx.ledger.spawn({x:10000,z});mapCtx.ledger.flush();
runInContext('globalThis.beforeSamples=samples;map(null);globalThis.coarseSamples=samples-beforeSamples;',mapCtx);
assert(mapCtx.coarseSamples<1000,`whole-world coarse terrain sampling bounded for 46km corridor: ${mapCtx.coarseSamples}`);
console.log('PASS long-travel whole-world map coarse samples:',mapCtx.coarseSamples);
// Execute the real boot cloud callback: older cloud exploration must survive a newer local economy save.
const bootCtx=createContext({console,setTimeout,clearTimeout,btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)}});
for(const file of ['js/conquest/world.js','js/conquest/discovery.js'])runInContext(readFileSync(file,'utf8'),bootCtx);
runInContext(`const SAVE_KEY='boot-account';let save={pts:10,earned:10,_ts:200,marker:'local winner'};let stores=0;function store(){stores++;save._ts=999;};function cloudSave(){};function loadSave(obj){save=obj;}function rollPeriods(){}function afterCloud(){};
const visited=ConquestDiscovery.create();visited.spawn({x:898,z:1024});visited.flush();
const cs={pts:10,earned:10,_ts:100,marker:'older cloud'};const remote=new ConquestDiscovery.Discovery('remote-boot',()=>cs,()=>{});remote.spawn({x:20000,z:20000});remote.flush();
function cloudLoad(cb){cb(cs);}`,bootCtx);
runInContext('globalThis.preCloudStores=stores;globalThis.preCloudTimestamp=save._ts;',bootCtx);
assert.equal(bootCtx.preCloudStores,0,'discovery cannot advance account timestamp before initial cloud selection');assert.equal(bootCtx.preCloudTimestamp,200);
const bootSource=readFileSync('js/main.js','utf8'),callback=bootSource.slice(bootSource.indexOf(' cloudLoad(cs=>{'),bootSource.indexOf(' // canvas text'));
runInContext(callback,bootCtx);
runInContext(`globalThis.postCloudStores=stores;globalThis.economyWinner=save.marker;const restored=ConquestDiscovery.create();globalThis.bootLocal=restored.has(898,1024);globalThis.bootCloud=restored.has(20000,20000);`,bootCtx);
assert(bootCtx.postCloudStores>0,'deferred account discovery persists after cloud readiness');assert.equal(bootCtx.economyWinner,'local winner');assert(bootCtx.bootLocal&&bootCtx.bootCloud,'boot reconciles exploration independently of economy snapshot timestamps');
console.log('PASS boot cloud reconciliation preserves local economy winner and unions older cloud exploration');
runInContext(`cs._ts=1000;cs.marker='new cloud winner';delete cs.conquestDiscovery;`,bootCtx);runInContext(callback,bootCtx);
runInContext(`globalThis.newWinner=save.marker;globalThis.accountKeepsLocal=!!save.conquestDiscovery;`,bootCtx);
assert.equal(bootCtx.newWinner,'new cloud winner');assert(bootCtx.accountKeepsLocal,'newer economy snapshot without exploration receives merged local discoveries');
// The independent website must load the same exploration ledger before its consumers.
const webBoot=readFileSync('web/boot.js','utf8'),modules=webBoot.match(/for\(const src of (\[[^\]]+\])/)[1];
const ordered=runInContext(modules,createContext());
assert(ordered.indexOf('conquest/discovery')>ordered.indexOf('conquest/world')&&ordered.indexOf('conquest/discovery')<ordered.indexOf('conquest/view'),'website boots discovery before view and map');
console.log('PASS independent website discovery dependency order');
