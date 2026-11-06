// Production View movement and Garage-model integration using real THREE objects, without a GPU context.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHash} from 'node:crypto';
const ctx=createContext({console,document:{hidden:false}});
for(const file of ['js/vendor/three.lunar.min.js','js/rules.js','js/graphics.js','js/models3d.js','js/conquest/world.js','js/conquest/view.js'])runInContext(readFileSync(file,'utf8'),ctx,{filename:file});
// Use the actual core helper, with a normalized two-bay account fixture. Its lab path resolves ownership.
const core=readFileSync('js/core.js','utf8');
const loadoutFunction=core.slice(core.indexOf('function myLoadout(){'),core.indexOf('const calcPower='));
runInContext(`const save={};ecoNorm(save);labEnsure(save,STOCK_L);${loadoutFunction}
 globalThis.account=save;globalThis.R={STOCK_L,machineMetrics,machineSpeed,M3,PAINTS,fittingVisuals};`,ctx);
const W=ctx.ConquestWorld,T=ctx.THREE,S=ctx.account;
function fixture(){
 const v=Object.create(ctx.ConquestView.prototype);
 Object.assign(v,{T,safeHistory:[],recoveryClock:0,stuckSeconds:0,recoveryReadyAt:0,disposed:false,vehicle:new T.Group(),chunks:new Map(),keys:{},stick:{x:0,z:0},yaw:-Math.PI/2,pitch:.42,distance:23,frames:0,elapsed:0,origin:{x:0,z:0},props:new T.Group(),horizon:new T.Group(),camera:new T.PerspectiveCamera(55,1,.2,1600),scene:new T.Scene(),renderer:{render(){}},p:{x:980,z:1024,y:24,surface:'bridge'}});
 // Streaming and GPU draw are covered by the browser suite; this fixture tests the unchanged tick movement path.
 v.stream=()=>{};
 v.syncLoadout();
 return v;
}
const v=fixture();
const ids=Object.keys(S.lab.machines),first=ids[0],second=ids[1];
const stock=v.speed,firstModel=v.vehicle.children[0];
assert.equal(v.loadout.c.c,'vanguard');
assert(v.vehicle.children[0].children.some(c=>c.isGroup),'real Garage chassis and mount are assembled');
S.up.engine=4;v.syncLoadout();assert(v.speed>stock,'permanent upgrades refresh live');
S.cOwn.scout=[0];S.lab.machines[second].spec.c={c:'scout',t:0,s:false};S.lab.active=second;
v.syncLoadout();assert.equal(v.loadout.c.c,'scout');assert.notEqual(v.vehicle.children[0],firstModel,'active bay refreshes actual model');
assert.equal(v.speed,2*ctx.R.machineSpeed(v.loadout));
S.lab.machines[second].spec.cores=['spd'];S.gemLvl.spd=5;
v.syncLoadout();const coreSpeed=v.speed;
S.lab.machines[second].spec.cores=[];v.syncLoadout();assert(coreSpeed>v.speed,'equipped core removal refreshes speed');
S.lab.machines[second].spec.c={c:'titan',t:2,s:false};v.syncLoadout();assert.equal(v.loadout.c.c,'vanguard','unowned chassis cannot appear');
S.lab.active=first;v.syncLoadout();
for(const fps of [10,15,20,60]){
 v.p={x:980,z:1024,y:24,surface:'bridge'};v.keys={KeyW:true};v.stick={x:0,z:0};v.resume=false;
 const start=v.p.x;for(let i=0;i<fps;i++)v.tick(1/fps);
 assert(Math.abs(v.p.x-start-v.speed)<1e-8,`production tick at ${fps} FPS uses equipment speed without dt starvation`);
}
// Diagonal keyboard and joystick input share the same normalized magnitude.
v.p={x:980,z:1024,y:24,surface:'bridge'};v.keys={KeyW:true,KeyD:true};v.tick(.1);
assert(Math.abs(Math.hypot(v.p.x-980,v.p.z-1024)-v.speed*.1)<1e-8);
v.p={x:980,z:1024,y:24,surface:'bridge'};v.keys={};v.stick={x:1,z:1};v.tick(.1);
assert(Math.abs(Math.hypot(v.p.x-980,v.p.z-1024)-v.speed*.1)<1e-8);
// Visibility reset discards stale controls and the first resumed delta; a new input moves on the following frame.
v.reset();assert.deepEqual({...v.keys},{});assert.equal(v.stick.x,0);assert.equal(v.stick.z,0);
v.keys={KeyW:true};const before=v.p.x;v.tick(.2);assert.equal(v.p.x,before);v.tick(.1);assert(v.p.x>before);
const enteredAgain=fixture();assert.equal(enteredAgain.speed,v.speed);assert.equal(enteredAgain.loadout.c.c,v.loadout.c.c);
assert(v.vehicle.position.y===v.p.y,'rendered machine origin agrees with authoritative bridge footing');
// Chassis forward is +X in Garage model space; Conquest converts it to local +Z then points along travel.
// Hull heading eases toward travel (no per-frame flip on contact); after a few frames it faces travel exactly.
v.p={x:980,z:1024,y:24,surface:'bridge'};v.resume=false;v.keys={KeyW:true};v.stick={x:0,z:0};for(let i=0;i<8;i++)v.tick(.1);
const forward=new T.Vector3(1,0,0).applyQuaternion(v.vehicle.children[0].quaternion).applyQuaternion(v.vehicle.quaternion);
assert(forward.x>.999&&Math.abs(forward.z)<1e-8,'reused chassis faces its movement heading');
v.keys={};v.p={x:925,z:1024,y:W.deckAt(925,1024),surface:'bridge'};v.tick(0);
const up=new T.Vector3(0,1,0).applyQuaternion(v.vehicle.quaternion),deckSlope=(W.deckAt(925.1,1024)-W.deckAt(924.9,1024))/.2;
const expectedUp=new T.Vector3(-deckSlope,1,0).normalize();assert(up.distanceTo(expectedUp)<1e-10,'machine tilts to the actual bridge ramp');
v.p={x:15840,z:23760,y:W.groundAt(15840,23760),surface:'ground'};v.tick(0);
assert(new T.Vector3(0,1,0).applyQuaternion(v.vehicle.quaternion).distanceTo(new T.Vector3(...W.surfaceNormal(v.p.x,v.p.z)))<1e-10,'machine tilts to terrain normal');
assert.equal(v.vehicle.position.y,v.p.y,'remote ground footing remains authoritative');
let crossing={x:1023,z:1024,y:24,surface:'bridge'};crossing=W.advance(crossing,20,0);assert(Math.abs(crossing.x-1043)<1e-8&&crossing.y===24,'high speed across a streaming seam retains deck');
let rail={x:1024,z:1024,y:24,surface:'bridge'};rail=W.advance(rail,0,-100);assert(rail.z>=1015&&rail.z<1015.21,'high speed from the deck interior stops at its rail');

// Owned premium equipment/appearance must use the same concrete geometry as Garage's shared kits.
function signature(group){const hash=createHash('sha256');group.traverse(o=>{if(!o.geometry)return;for(const name of ['position','normal','color']){const a=o.geometry.attributes[name];if(a)hash.update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));}});return hash.digest('hex');}
const models=[v,enteredAgain],M=ctx.R.M3,team='#88cbdc';
function shared(raw,mats){return M.meshOf(M.bake(raw.k),null,mats);}
function disposeGeometry(group){group.traverse(o=>o.geometry?.dispose());}
S.moonbeam=true;S.paints.gold=1;S.lab.active=first;
S.lab.machines[first].spec.w={a:'moon',t:2,s:false};
S.lab.machines[first].spec.mods={hull:'light',mobility:'sprint',mount:'stock'};
S.lab.machines[first].spec.looks={mount:'firing'};
const appearances=[];
for(const [skin,paint] of [['default','stock'],['default','gold'],['lunar','gold']]){
 S.skin=skin;S.lab.machines[first].spec.paint=paint;
 const styled=fixture(),L=styled.loadout,P=ctx.R.PAINTS[L.paint],body=styled.vehicle.children[0];models.push(styled);
 assert.equal(L.w.a,'moon');assert.equal(L.skin,skin);assert.equal(L.paint,paint);assert.equal(L.mods.mobility,'sprint');
 const chassis=M.chassisKit(L.c.c,L.c.t,P,team,L.cores,L.skin==='lunar'),expectedHull=shared(chassis,styled.modelMats);
 assert.equal(signature(body.children[0]),signature(expectedHull),'rendered chassis/paint/Lunar Skin geometry equals Garage kit');
 const gun=body.children.find(c=>Math.abs(c.position.y-chassis.meta.ty)<1e-9);
 assert(gun,'weapon sits in the canonical chassis mounting socket');
 assert.equal(gun.scale.x,M.weaponScale('moon',L.c.c),'Moonbeam follows Garage class-specific scale');
 const expectedGun=shared(M.weaponKit(L.w.a,L.w.t,P,team,L.skin==='lunar',L.c.c),styled.modelMats);
 assert.equal(signature(gun.children[0]),signature(expectedGun),'owned Moonbeam is the shared approved weapon geometry');
 const fits=ctx.R.fittingVisuals(L),context={cls:L.c.c,ct:L.c.t,arch:L.w.a,wt:L.w.t,lunar:L.skin==='lunar'};
 const expectedBodyFits=shared(M.fittingKit(fits,team,'body',context),styled.modelMats),expectedMountFits=shared(M.fittingKit(fits,team,'mount',context),styled.modelMats);
 assert.equal(signature(body.children.at(-1)),signature(expectedBodyFits),'body appearance respects legal equipped mods');
 assert.equal(signature(gun.children.at(-1)),signature(expectedMountFits),'mount appearance respects valid visual override');
 appearances.push(signature(body.children[0]));
 const reentered=fixture();models.push(reentered);assert.equal(signature(reentered.vehicle),signature(styled.vehicle),'premium equipped appearance survives deterministic re-entry');
 for(const expected of [expectedHull,expectedGun,expectedBodyFits,expectedMountFits])disposeGeometry(expected);
}
assert.equal(new Set(appearances).size,3,'stock paint, owned gold paint and Lunar Skin produce distinct actual chassis geometry/colors');
S.moonbeam=false;S.paints.gold=0;S.skin='default';const revoked=fixture();models.push(revoked);
assert.equal(revoked.loadout.w.a,'pulse','unowned Moonbeam is never rendered');assert.equal(revoked.loadout.paint,'stock','unowned paint is never rendered');

v.pending=0;v.jump(1140,1235);assert.notEqual(v.pending,0,'jump invalidates previous completed-stream status before the next frame');

for(const model of models){model.vehicle.traverse(o=>o.geometry?.dispose());Object.values(model.modelMats).forEach(m=>m.dispose());}
console.log('PASS production ConquestView tick: active legal bays/models, Engine/core refresh, re-entry, 10/15/20/60 FPS, normalized keyboard/joystick, resume reset, bridge footing, owned Moonbeam/Lunar Skin/paint/mod geometry and deterministic re-entry. GPU/streaming covered separately.');
// Real tread links must be driven, including the foundation renderer, without new meshes.
for(const cls of ['scout','vanguard','titan'])for(let tier=0;tier<3;tier++)for(const lunar of [false,true]){
 const raw=M.chassisKit(cls,tier,ctx.R.PAINTS.stock,team,[],lunar),baked=M.bake(raw.k);
 assert(raw.meta.track||cls==='vanguard'&&tier===0,'canonical starter has an explicit Conquest belt adapter');
 assert(Object.values(baked).some(g=>Array.from(g?.attributes.drive?.array||[]).some((v,i)=>i%4===2&&v>=2)),'actual tread links carry GPU drive metadata');
 Object.values(baked).forEach(g=>g?.dispose());
}
const moving=fixture();moving.keys={KeyW:true};moving.tick(.1);
assert(moving.motion,'Conquest attaches shared GPU tread animation');
const phase=moving.motion.state.left;assert(Math.abs(phase-moving.speed*.1/1.65)<1e-9,'belt distance accounts for rendered chassis scale');
moving.keys={};moving.tick(.1);assert.equal(moving.motion.state.left,phase,'stationary tracks stop');
moving.p={x:1024,z:1015,y:24,surface:'bridge'};moving.keys={KeyA:true};moving.tick(.1);assert.equal(moving.motion.state.left,phase,'blocked tracks stop');
const state=ctx.GraphicsMotion; // lexical global accessed inside context below
runInContext(`{const s=GraphicsMotion.state();GraphicsMotion.advance(s,.1,{dx:1,heading:0},false);const a=s.left;GraphicsMotion.advance(s,.1,{dx:-.5,heading:0},false);if(Math.abs(s.left-a+.5)>1e-10)throw Error('reverse tread direction');}`,ctx);
console.log('PASS real foundation tread tags, actual scaled displacement, stopped and blocked tread phases, reverse shared drive');
for(const speed of [8.8,17.6,26.4]){
 const test=fixture();test.speed=speed;test.keys={KeyW:true};test.tick(.1);
 assert(Math.abs(test.motion.state.left-speed*.1/1.65)<1e-8,'faster actual displacement drives proportionally faster shoes');
 test.keys={KeyD:true};test.tick(.1);assert.notEqual(test.motion.state.left,test.motion.state.right,'accepted turn drives differential belts');
 test.motion.dispose();test.vehicle.traverse(o=>o.geometry?.dispose());Object.values(test.modelMats).forEach(m=>m.dispose());
}
const ramp=fixture();ramp.p={x:925,z:1024,y:W.deckAt(925,1024),surface:'bridge'};ramp.keys={KeyW:true};const start={...ramp.p};ramp.tick(.1);
assert(Math.abs(ramp.motion.state.left-Math.hypot(ramp.p.x-start.x,ramp.p.y-start.y,ramp.p.z-start.z)/1.65)<1e-8,'ramp belts include vertical surface displacement');
ramp.motion.dispose();ramp.vehicle.traverse(o=>o.geometry?.dispose());Object.values(ramp.modelMats).forEach(m=>m.dispose());
console.log('PASS proportional treads at 8.8/17.6/26.4 units/s, differential accepted turns and actual 3D ramp distance');

// Recovery only after a genuine rejected drive, to verified local breadcrumbs.
v.safeHistory=[];v.p={x:1130,z:1080,y:W.groundAt(1130,1080),surface:'ground'};v.keys={KeyW:true};v.yaw=-Math.PI/2;v.resume=false;
for(let i=0;i<300;i++)v.tick(.1);
assert(v.stuckSeconds>1.5);const blocked={...v.p};assert(v.recover());assert(Math.hypot(v.p.x-blocked.x,v.p.z-blocked.z)>=6);assert(!v.recover(),'cooldown and stuck gating');
console.log('PASS actual blocked tower recovery, verified breadcrumb and cooldown');
// A fresh saved-position entry can be disabled before it has any breadcrumbs.
const fresh=fixture();fresh.safeHistory=[];fresh.p={x:1240,z:893,y:W.groundAt(1240,893),surface:'ground'};fresh.encounter={state:'defeat',playerMax:1700,playerHp:0,projectiles:[]};const checkpointFrom={...fresh.p};
assert(fresh.recover(),'fresh disabled vehicle needs a verified reachable local checkpoint');
assert(Math.hypot(fresh.p.x-checkpointFrom.x,fresh.p.z-checkpointFrom.z)>=6);assert(!W.solidAt(fresh.p.x,fresh.p.z));assert.equal(fresh.encounter.state,'active');
console.log('PASS disabled fresh-entry recovery without breadcrumb history');
// Conquest damage survives mission/exploration transitions and local re-entry.
runInContext(readFileSync('js/conquest/combat.js','utf8'),ctx);
const hpData=new Map();ctx.localStorage={getItem:k=>hpData.get(k)||null,setItem:(k,v)=>hpData.set(k,v)};ctx.SAVE_KEY='conquest-health-account-a';
const hpView=fixture();hpView.p={x:1160,z:1048,y:W.groundAt(1160,1048),surface:'ground'};hpView.encounter=new ctx.ConquestCombat.Encounter(hpView.loadout,hpView.p);hpView.encounter.playerHp=777;
assert(hpView.startMission());assert.equal(hpView.battle.playerHp,777,'starting a mission cannot refill HP');
hpView.battle.playerHp=321;hpView.clearBattle();assert.equal(hpView.encounter.playerHp,321,'leaving mission cannot refill HP');hpView.flushHealth();
const hpReload=fixture();hpReload.encounter=new ctx.ConquestCombat.Encounter(hpReload.loadout,hpReload.p);hpReload.restoreHealth();assert.equal(hpReload.encounter.playerHp,321,'damage persists across local reload');
ctx.SAVE_KEY='conquest-health-account-b';const hpOther=fixture();hpOther.encounter=new ctx.ConquestCombat.Encounter(hpOther.loadout,hpOther.p);hpOther.restoreHealth();assert.equal(hpOther.encounter.playerHp,hpOther.encounter.playerMax,'other account does not inherit HP');
console.log('PASS mission/exploration/re-entry HP continuity and local account separation');
