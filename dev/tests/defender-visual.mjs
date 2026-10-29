// Approved LUNAR Defender flagship: actual THREE geometry from the game's own renderer.
// No screenshot mocks, external resources, or any economy/player state.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInContext,createContext} from 'node:vm';

const root=new URL('../../',import.meta.url);
const vendor=readFileSync(new URL('js/vendor/three.lunar.min.js',root),'utf8');
const source=readFileSync(new URL('js/models3d.js',root),'utf8');
const rules=readFileSync(new URL('js/rules.js',root),'utf8');
const context=createContext({console});
runInContext(vendor,context,{timeout:15000});
assert.ok(context.THREE?.BufferGeometry,'the actual vendored THREE runtime is required');
runInContext("const CH={vanguard:{c:'#3fd0c9'},scout:{c:'#7be07b'},titan:{c:'#c28bff'}}; const WEAPONS={pulse:{c:'#3fd0c9'},twin:{c:'#ffd24a'},siege:{c:'#ff6b5e'},moon:{c:'#e8f4ff'}}; const GEM={dmg:{c:'#ff8050'},rof:{c:'#ffd24a'},arm:{c:'#66c9ff'}};",context);
runInContext(source+'\nglobalThis.M3=M3;',context,{timeout:15000});
const {M3,THREE}=context;
const stock={hull:'#2c3a49',tur:'#3b4a5b',trim:'#d5dee7'};
const alt={hull:'#35255a',tur:'#463271',trim:'#c79bff'};
const team='#4d9fff';
function colored(arrays,hex){
 const c=new THREE.Color(hex);
 return arrays.some(g=>{
  const a=g.attributes.color?.array;
  if(!a)return false;
  for(let i=0;i<a.length;i+=3)if(Math.abs(a[i]-c.r)<.0001&&Math.abs(a[i+1]-c.g)<.0001&&Math.abs(a[i+2]-c.b)<.0001)return true;
  return false;
 });
}
function checkKit(label,raw,max=30000){
 assert.ok(raw.k&&raw.meta,label+' has a model kit');
 const all=[...raw.k.lit,...raw.k.shine,...raw.k.glow];
 assert.ok(all.length>0,label+' has true geometry');
 for(const g of all){
  assert.ok(g.attributes.position?.count>0,label+' has vertices');
  assert.ok(g.attributes.position.array.every(Number.isFinite),label+' coordinates finite');
 }
 const baked=M3.bake(raw.k),gs=Object.values(baked).filter(Boolean);
 const count=gs.reduce((n,g)=>n+g.attributes.position.count,0);
 assert.ok(count>100&&count<max,label+' bounded vertices: '+count);
 assert.ok(gs.length<=3,label+' uses the original three-material render pipeline');
 gs.forEach(g=>{assert.ok(g.attributes.normal?.count>0);g.dispose();});
 return count;
}
const defender=M3.chassisKit('vanguard',0,stock,team,['dmg','rof','arm'],false);
assert.equal(defender.meta.ty,.777,'existing modular turret mount aligns with Defender deck');
assert.equal(defender.meta.bob,0,'Defender uses tracks instead of hovering');
assert.ok(defender.meta.halos.length>=2,'headlamps visible on both front shoulders');
assert.ok(colored(defender.k.glow,'#ff9d55'),'amber Lunar signature is geometric');
assert.ok(colored(defender.k.glow,'#66c9ff'),'blue lighting is geometric');
assert.ok(defender.k.shine.length>12,'track wheels and armored plates are physical geometry');
const dc=checkKit('Defender chassis',defender);
const cannon=M3.weaponKit('pulse',0,stock,team,false,'vanguard');
assert.ok(cannon.meta.tips[0][0]>=1.85,'Pulse cannon muzzle aligns with combat shots');
assert.ok(colored(cannon.k.shine,'#ff9d55'),'pulse cannon amber thermal collars are geometric metal');
const wc=checkKit('Defender pulse',cannon);
for(const name of ['twin','siege','moon']){
 const w=M3.weaponKit(name,name==='moon'?2:0,stock,team,false,'vanguard');
 assert.ok(w.meta.tips?.length,'modular '+name+' weapon remains compatible');
 checkKit(name+' weapon',w);
}
for(const [name,tier,paint,lunar] of [['vanguard',1,stock,false],['scout',0,stock,false],
 ['titan',0,stock,false],['vanguard',0,stock,true],['vanguard',0,alt,false]]){
 const model=M3.chassisKit(name,tier,paint,team,[],lunar);
 assert.ok(model.meta.ty>0);
 checkKit(name+' tier '+tier+' appearance',model);
}
assert.match(rules,/const STOCK_L=\{w:\{a:'pulse',t:0/, 'starter weapon unchanged');
assert.match(rules,/c:\{c:'vanguard',t:0/, 'starter chassis and stats unchanged');
console.log('PASS Defender real THREE geometry, tracks, armor, amber/cyan lighting, modular weapons, bounded cost, legend isolation, unchanged game rules',JSON.stringify({defenderVertices:dc,cannonVertices:wc}));

await import('./defender-isolation.mjs');
