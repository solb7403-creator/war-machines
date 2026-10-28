// Real rules/game in the same isolated realm as the browser range. No account/network globals.
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
const root=new URL('../../../',import.meta.url);
assert.ok(fs.existsSync(new URL('js/range-engine.js',root)),'independent practice adapter exists');
function engine(){const c=vm.createContext({console});for(const f of ['range-host','rules','game','range-engine'])vm.runInContext(fs.readFileSync(new URL('js/'+f+'.js',root),'utf8'),c);return c.RangeSim;}
const sim=engine(),L=JSON.parse(sim.stock());L.mods={hull:'plates',mobility:'stable',mount:'stock'};L.looks={mount:'firing'};L.catalog=1;
const cfg={L,g:'arena',map:'classic',seed:123,preset:'standard',control:'ai'};
function run(s,cfg){s.setup(cfg);let steps=0;while(s.view().state==='play'&&steps++<11000)s.step(1/30,[0,0]);assert.equal(s.view().state,'over',cfg.g+' completes');return JSON.parse(JSON.stringify(s.result()));}
let count=0;
for(const g of ['arena','zone','crystal','bounty','royale','boss']){
 const a=run(sim,{...cfg,g}),b=run(engine(),{...cfg,g});count+=2;assert.deepEqual(a,b,g+' repeat same environment/seed');assert.ok(a.duration>0);assert.ok(a.damage>=0&&a.taken>=0);assert.ok(a.kills>=0&&a.deaths>=0);assert.equal(a.control,'ai');
}
sim.setup(cfg);const fitted=sim.view().me;assert.equal(fitted.fits.hull,'plates');assert.equal(fitted.fits.mount,'firing');assert.equal(fitted.spdM,0.91);
const frozen=fitted.mhp;L.up.hull=4;assert.equal(sim.view().me.mhp,frozen,'draft detached');L.up.hull=0;
assert.throws(()=>sim.setup({...cfg,seed:NaN}));assert.throws(()=>sim.setup({...cfg,g:'fake'}));assert.throws(()=>sim.setup({...cfg,L:{...L,mods:{hull:'hack'}}}));
sim.setup({...cfg,control:'player',preset:'equipped',g:'boss'});assert.equal(sim.view().me.ctl,'me');assert.ok(sim.view().boss.boss);assert.equal(sim.view().units.length,3);
assert.ok(sim.view().units[1].wdps===70,'wingman stays standard');
const pos=sim.view().me.y;sim.step(1/30,[0,-1]);assert.ok(sim.view().me.y<pos,'actual manual movement');
sim.view().me.sp=1000;sim.action('super',-Math.PI/2);assert.ok(sim.view().me.sup);assert.ok(sim.action('shield'));sim.action('dash',1,0);assert.ok(sim.view().me.dash);
sim.stop();assert.equal(sim.result().outcome,'stopped');sim.dispose();assert.equal(sim.view().units.length,0);
console.log('PASS range engine: '+count+' completed seeded six-mode trials, fitted appearance/stats, real controls, validation and lifecycle');
