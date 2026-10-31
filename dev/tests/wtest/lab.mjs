// Session 2: real Worker/rules with in-memory DB; no production fetch fallback.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { makeDB } from './fakedb.mjs';
import { buildSim } from '../../../worker/build-sim.mjs';
buildSim();
const db=makeDB(); let failPlayers=false;
globalThis.fetch=async(url,init)=>{
 if(String(url).startsWith('https://warmachines-a6034-default-rtdb.firebaseio.com/')){
  if(failPlayers&&String(url).includes('/players/'))return new Response('unavailable',{status:503});
  return db.handle(url,init);
 }
 throw new Error('No external calls in Lab tests: '+url);
};
const {default:worker}=await import('../../../worker/src/index.js');
const eco=await import('../../../worker/src/eco.js');
const {RULES:R}=await import('../../../worker/src/sim.gen.js');
const {checkLoadout}=await import('../../../worker/src/pvp.js');
const env={BOT_TOKEN:'local-test',FIREBASE_DB_SECRET:'SECRET'};
function auth(id){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Lab'})});const d=[...p].sort(([a],[b])=>a<b?-1:1).map(([k,v])=>k+'='+v).join('\n');p.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(env.BOT_TOKEN).digest()).update(d).digest('hex'));return p.toString();}
async function call(id,path,body={}){const r=await worker.fetch(new Request('https://local'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://solb7403-creator.github.io'},body:JSON.stringify({initData:auth(id),...body})}),env);return {status:r.status,...await r.json()};}
const sync=(id,body={})=>call(id,'/api/sync',{lab:1,...body});
const act=(id,a,body={})=>call(id,'/api/act',{a,...body});
const S=id=>db.get('/eco/tg_'+id);
let r=await sync(7001);
assert.equal(r.E.lab?.v,1,'new accounts receive Lab v1');
assert.equal(Object.keys(r.E.lab.machines).length,2);
assert.equal(r.E.lab.active,'m_legacy');
assert.equal(r.E.earned,0);assert.equal(r.E.pts,0);
const first=JSON.stringify(S(7001).lab);await sync(7001);assert.equal(JSON.stringify(S(7001).lab),first,'migration twice unchanged');
await Promise.all([sync(7002),sync(7002)]);assert.equal(Object.keys(S(7002).lab.machines).length,2);
// Existing canonical gear wins over stale device selection; global assets stay global.
await call(7003,'/api/sync');
let old=S(7003);old.pts=12345;old.earned=54321;old.wOwn.twin=[1];old.cOwn.scout=[1];old.roll['twin:1']=1.08;old.roll['scout:1']=1.06;old.up.engine=2;old.spendGram=9;old.refC={tg_99:{m:1}};old.L=R.ecoLoadout(old,{w:{a:'twin',t:1},c:{c:'scout',t:1},cores:['spd','reg','dmg'],paint:'stock'});
const protectedKeys=R.ECO_KEYS.filter(k=>k!=='lab');const before=Object.fromEntries(protectedKeys.map(k=>[k,old[k]]));
r=await sync(7003,{L:R.STOCK_L});
assert.equal(r.E.lab.machines.m_legacy.spec.w.a,'twin');assert.equal(r.E.lab.machines.m_spare.spec.w.a,'twin');
assert.deepEqual(Object.fromEntries(protectedKeys.map(k=>[k,S(7003)[k]])),before,'migration preserves normalized account assets');
let lab=r.E.lab;let spec=structuredClone(lab.machines.m_spare.spec);spec.w={a:'pulse',t:0,s:false};
r=await act(7003,'lab_save',{id:'m_spare',rev:lab.rev,name:'MK-II',spec});assert.equal(r.out.err,undefined);assert.equal(r.E.lab.machines.m_spare.spec.w.a,'pulse');assert.equal(r.E.lab.machines.m_legacy.spec.w.a,'twin');
let rev=r.E.lab.rev;
r=await act(7003,'lab_activate',{id:'m_spare',rev});assert.equal(r.E.lab.active,'m_spare');assert.equal(S(7003).L.w.a,'pulse');
r=await sync(7003,{L:old.L});assert.equal(S(7003).L.w.a,'pulse','legacy raw sync cannot overwrite machine');
for(const body of [{id:'m_fake',rev:r.E.lab.rev},{id:'m_legacy',rev:1}]){const x=await act(7003,'lab_activate',body);assert.ok(x.out.err);}
for(const patch of [{w:{a:'moon',t:2,s:false}},{up:{engine:4}},{cores:['dmg','dmg',null]},{c:{c:'scout',t:2,s:false}}]){const x=await act(7003,'lab_save',{id:'m_spare',rev:S(7003).lab.rev,name:'valid',spec:{...spec,...patch}});assert.ok(x.out.err,'illegal configuration rejected');}
r=await act(7003,'lab_rename',{id:'m_spare',rev:S(7003).lab.rev,name:'<img onerror=x>'});assert.ok(r.out.err);
const revision=S(7003).lab.rev;
const both=await Promise.all([act(7003,'lab_rename',{id:'m_spare',rev:revision,name:'Alpha'}),act(7003,'lab_rename',{id:'m_spare',rev:revision,name:'Beta'})]);assert.equal(both.filter(x=>!x.out.err).length,1,'concurrent stale writer rejected');
await sync(7004);r=await act(7004,'lab_save',{id:'m_spare',rev:S(7004).lab.rev,name:'stolen',spec:lab.machines.m_legacy.spec,pid:'tg_7003'});assert.ok(r.out.err,'owner uses only own inventory');
r=await act(7003,'lab_slot',{rev:S(7003).lab.rev});assert.equal(r.status,400,'no grant/checkout endpoint');
// Both authoritative reads must fail closed instead of constructing a fresh user.
failPlayers=true;r=await sync(7005);failPlayers=false;assert.ok(r.status>=500);assert.equal(S(7005),null);
// Six-mode snapshots must retain start-time gear/upgrades despite editing and sync.
const oldClient=await eco.matchStart(env,{g:'arena',m:'1v1',map:'classic',pv:1,L:R.STOCK_L},{id:7003},'tg_7003',Date.now());
assert.equal(oldClient.body.error,'update','old clients must update before a Lab fight, not receive false proof flags');
for(const g of R.GT_ORDER){const now=Date.now();let start=await eco.matchStart(env,{g,m:'1v1',map:'classic',L:R.STOCK_L,labRev:S(7003).lab.rev,pv:1},{id:7003},'tg_7003',now);assert.ok(start.body.ok);const ticket=structuredClone(S(7003).mt);assert.equal(ticket.rv,'lab-fittings-v1');assert.ok(ticket.L.chs.length);old=S(7003);old.up.engine=4;await sync(7003);assert.deepEqual(S(7003).mt.L,ticket.L);assert.equal(S(7003).mt.mult,ticket.mult);}
const canonical=await checkLoadout(env,R,{...R.STOCK_L,w:{a:'moon'}},S(7003));assert.equal(canonical.w.a,S(7003).L.w.a,'PvP fields active machine not raw spoof');
// Legacy migration awaiting reconciliation must not be marked complete by Lab.
db.root.players.tg_7006={pts:900,days:3};r=await sync(7006);assert.equal(S(7006).mig,0);assert.equal(r.E.lab,undefined);
// A pre-reconciliation placeholder L must not replace the migrated device selection.
const pending=S(7006);assert.equal(pending.L.w.a,'pulse');
r=await sync(7006,{mig:{pts:900,wOwn:{pulse:[0],twin:[1]},cOwn:{vanguard:[0]},wTier:{pulse:0,twin:1},cores:['dmg','rof','arm']},L:{w:{a:'twin',t:1},c:{c:'vanguard',t:0},cores:['dmg','rof','arm']}});
assert.equal(r.E.lab.machines.m_legacy.spec.w.a,'twin','migration preserves reconciled selection, not placeholder');
// Firebase can encode null sockets as short arrays, missing arrays, or indexed objects.
for(const cores of [['dmg','rof'],{}, {'1':'rof','2':'arm'}]){
 const persisted=structuredClone(S(7003));persisted.lab.machines.m_spare.spec.cores=cores;
 const normalized=R.ecoNorm(persisted).lab.machines.m_spare.spec.cores;
 assert.equal(normalized.length,3);assert.ok(normalized.every(k=>k===null||R.GEM[k]));
}
const gain=structuredClone(S(7003));const X={day:Math.floor(Date.now()/86400000),week:0,rnd:()=>0.2,pk:'tg_7003'};
R.ecoGrant(gain,{kind:'moonbeam'},X);assert.equal(R.labLoadout(gain).w.a,'moon','purchase auto-equip stays authoritative');
gain.paints.ember=1;R.ecoGrant(gain,{kind:'paint',id:'nebula'},X);assert.equal(R.labLoadout(gain).paint,'nebula');
// Fittings travel through the real owner action and immutable AI start pathway.
const fitted={...S(7003).lab.machines.m_spare.spec,mods:{hull:'plates',mobility:'stable',mount:'stock'},catalog:1};
r=await act(7003,'lab_save',{id:'m_spare',rev:S(7003).lab.rev,name:'Fitted',spec:fitted});assert.ok(!r.out.err);
await act(7003,'lab_activate',{id:'m_spare',rev:S(7003).lab.rev});
for(const g of R.GT_ORDER){
 const st=await eco.matchStart(env,{g,m:'1v1',map:'craters',labRev:S(7003).lab.rev,fv:1,pv:1},{id:7003},'tg_7003',Date.now());
 assert.ok(st.body.ok);const snap=structuredClone(S(7003).mt.L);assert.equal(snap.mods.hull,'plates');
 const rejected=await eco.matchStart(env,{g,m:'1v1',map:'craters',labRev:S(7003).lab.rev,pv:1},{id:7003},'tg_7003',Date.now());assert.equal(rejected.body.error,'update');assert.deepEqual(S(7003).mt.L,snap);
}
const snap=structuredClone(S(7003).mt.L);await act(7003,'lab_save',{id:'m_spare',rev:S(7003).lab.rev,name:'Now stock',spec:{...fitted,mods:{}}});assert.deepEqual(S(7003).mt.L,snap);
// Stock old clients cannot simulate fitted ghosts with their old tank formulas.
const now=Date.now();db.root.gh={tg_7999:{n:'Fitted ghost',pw:Math.floor(S(7003).pw*0.85),t:now-700000,L:{...R.STOCK_L,mods:{mobility:'stable'}}}};
const compatible=await eco.matchStart(env,{g:'arena',m:'1v1',map:'craters',labRev:S(7003).lab.rev,pv:1},{id:7003},'tg_7003',now);
assert.equal(compatible.body.gh.length,0,'old clients must not receive fitted ghost stats');
const modern=await eco.matchStart(env,{g:'arena',m:'1v1',map:'craters',labRev:S(7003).lab.rev,fv:1,pv:1},{id:7003},'tg_7003',now);assert.equal(modern.body.gh.length,1);
console.log('PASS Lab migration, isolation, ownership, revisions, six-mode snapshots and PvP resolution');
