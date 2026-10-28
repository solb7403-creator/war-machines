// Actual shared-engine balance characterization. Bot outcomes are evidence, not human win-rate promises.
// Run from repository root: node dev/tests/gear-combat.mjs (optional BALANCE_OUTPUT JSON path).
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {buildSim} from '../../worker/build-sim.mjs';
buildSim();
const {RULES:R,createSim}=await import('../../worker/src/sim.gen.js');
const clone=x=>structuredClone(x),base=clone(R.STOCK_L);
const load=(a='pulse',t=2,c='vanguard',q=1.1)=>({...clone(base),w:{a,t:a==='moon'?2:t,q:a==='moon'?1:q,s:false},c:{c,t,q,s:false}});
const results=[],DT=1/60;
function duel(label,A,B,seed,flip=false,g='arena',map='classic'){
 const evs=[];const sim=createSim({seed,ev:a=>evs.push(a),end(){},round(){},death(){}});
 const seats=[{pid:'a',name:'A',L:A},{pid:'b',name:'B',L:B}];if(flip)seats.reverse();
 sim.setup({g,m:'1v1',map,series:false,seats});sim.start();sim.units.forEach(u=>sim.setCtl(u,'bot'));
 let steps=0,shots=[0,0],hits=[0,0],supDamage=[0,0],firstSuper=[null,null];
 while(sim.state==='play'&&steps++<11000){sim.step(DT);for(const e of evs){if(e[0]==='b')shots[e[2]]++;if(e[0]==='h'&&e[6]>=0){if(e[3]===0)hits[e[6]]++;if(e[3]===1)supDamage[e[6]]+=e[2];}if(e[0]==='u'&&firstSuper[e[1]]===null)firstSuper[e[1]]=steps*DT;}evs.length=0;}
 assert.equal(sim.state,'over',label+' completes');
 const idx=flip?1:0,u=sim.units[idx],out=sim.outcome(u),s=u.st;
 const v={label,seed,flip,g,map,out:out.won?'win':out.drawn?'draw':'loss',duration:+(steps*DT).toFixed(2),damage:Math.round(s.dmg),taken:Math.round(s.taken),shots:shots[idx],hits:hits[idx],supers:s.sup,superDamage:Math.round(supDamage[idx]),firstSuper:firstSuper[idx],hp:Math.round(u.hp)};results.push(v);return v;
}
const seeds=[71,419,2027,9803,65537];
// Every weapon rarity plus Moonbeam against a same-rarity reference; both spawn directions.
for(const a of [...R.WORDER,'moon'])for(const t of a==='moon'?[2]:[0,1,2])for(const seed of seeds)for(const flip of [false,true])duel('weapon/'+a+'/'+t,load(a,t),load('pulse',t),seed,flip);
// Each chassis rarity against all three class identities; both spawn directions.
for(const c of R.CHORDER)for(const t of [0,1,2])for(const enemy of R.CHORDER)for(const seed of seeds.slice(0,3))for(const flip of [false,true])duel('chassis/'+c+'/'+t+'/vs/'+enemy,load('pulse',t,c),load('pulse',t,enemy),seed,flip);
// Moonbeam against every perfect Epic weapon on all maps, both directions.
for(const a of R.WORDER)for(const map of createSim({ev(){},end(){},round(){},death(){}}).R.MAP_REAL)for(const seed of seeds)for(const flip of [false,true])duel('legend/vs/'+a,load('moon'),load(a),seed,flip,'arena',map);
// Every legal fitting combination, paired against stock using equal Epic equipment.
const mods=[];for(const hull of Object.keys(R.FITS.hull))for(const mobility of Object.keys(R.FITS.mobility))for(const mount of Object.keys(R.FITS.mount)){
 const m={hull,mobility,mount},f=R.fittingStats(m);if(f.weight<=3&&f.power<=3)mods.push(m);
}
for(const m of mods)for(const seed of seeds.slice(0,3))for(const flip of [false,true])duel('fit/'+Object.values(m).join('/'),{...load(),mods:m},load(),seed,flip);
// Exhaust gear/fittings at the monotone HP/DPS/speed upgrade ceiling.
// All three primary investments can reach 4 within 14 total levels. The two
// remaining levels have no effect on powerOf; all maximum-level cores weigh equally.
let maxPower=null;
for(const a of [...R.WORDER,'moon'])for(const c of R.CHORDER)for(const m of mods){
 const L={...load(a,2,c),up:{hull:4,cannon:4,engine:4,target:2,reactor:0},cores:['dmg','rof','arm'],gl:Object.fromEntries(R.GORDER.map(k=>[k,5])),skin:'lunar',mods:m};
 const power=R.powerOf(L);if(!maxPower||power>maxPower.power)maxPower={id:'power-ceiling',L,power};
}
const strongest=[];
for(const [id,c,up,cores] of [
 ['offense','vanguard',{hull:4,cannon:4,engine:2,target:4,reactor:0},['dmg','rof','lck']],
 ['durable','titan',{hull:4,cannon:4,engine:4,target:0,reactor:2},['dmg','rof','arm']],
 ['mobile','scout',{hull:4,cannon:4,engine:4,target:2,reactor:0},['dmg','rof','spd']],
 ['super','vanguard',{hull:4,cannon:4,engine:2,target:0,reactor:4},['dmg','rof','arm']]]){
 assert.equal(R.upLevels(up),14);
 const L={...load('moon',2,c),up,cores,gl:Object.fromEntries(R.GORDER.map(k=>[k,5])),skin:'lunar',mods:{hull:'stock',mobility:'stable',mount:'firing'}};
 assert.ok(R.fittingStats(L.mods).weight<=3&&R.fittingStats(L.mods).power<=3);
 strongest.push({id,L,stats:R.tankOf(L,1),metrics:R.machineMetrics(L),power:R.powerOf(L),league:R.powerBracket(R.powerOf(L)).n});
 for(const seed of seeds)for(const flip of [false,true]){
  duel('max/'+id+'/stock',L,base,seed,flip);
  duel('max/'+id+'/epic',L,{...clone(L),w:{a:'siege',t:2,q:1.1,s:false}},seed,flip);
 }
}
// Also fight the exact enumerated power ceiling, rather than treating a hand-picked build as maximal.
strongest.push({...maxPower,stats:R.tankOf(maxPower.L,1),metrics:R.machineMetrics(maxPower.L),league:R.powerBracket(maxPower.power).n});
for(const seed of seeds)for(const flip of [false,true]){
 duel('max/power-ceiling/stock',maxPower.L,base,seed,flip);
 duel('max/power-ceiling/epic',maxPower.L,{...clone(maxPower.L),w:{a:'siege',t:2,q:1.1,s:false}},seed,flip);
}
// Genuine browser practice adapter for all six objectives, including actual boss/team setup.
const cx=vm.createContext({console});for(const f of ['range-host','rules','game','range-engine'])vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8'),cx);const range=cx.RangeSim;
const practice=[];
for(const g of R.GT_ORDER)for(const [label,L] of [['stock',base],['epic-pulse',load('pulse')],['epic-twin',load('twin')],['epic-siege',load('siege')],['moon',load('moon')],...strongest.map(x=>['max-'+x.id,x.L])])for(const seed of seeds.slice(0,3)){
 range.setup({L,g,map:'classic',seed,preset:'equipped',control:'ai'});let n=0;while(range.view().state==='play'&&n++<11000){range.step(DT,[0,0]);range.events();}assert.equal(range.view().state,'over');practice.push({g,label,seed,...JSON.parse(JSON.stringify(range.result()))});range.dispose();
}
// Browser/server production formula parity for every equipment/rarity and legal fitting set.
const br=vm.runInNewContext(fs.readFileSync('js/rules.js','utf8')+';({tankOf,powerOf})');let parity=0;
for(const a of [...R.WORDER,'moon'])for(const t of a==='moon'?[2]:[0,1,2])for(const c of R.CHORDER)for(const ct of [0,1,2])for(const q of [1.05,1.1])for(const m of mods){const L={...load(a,t,c,q),c:{c,t:ct,q,s:false},mods:m};assert.equal(JSON.stringify(R.tankOf(L,1)),JSON.stringify(br.tankOf(L,1)));assert.equal(R.powerOf(L),br.powerOf(L));parity++;}
const groups=rows=>Object.entries(Object.groupBy?Object.groupBy(rows,r=>r.label):rows.reduce((o,r)=>((o[r.label]??=[]).push(r),o),{})).map(([label,rs])=>({label,n:rs.length,wins:rs.filter(r=>r.out==='win').length,draws:rs.filter(r=>r.out==='draw').length,damage:Math.round(rs.reduce((s,r)=>s+r.damage,0)/rs.length),accuracy:+(rs.reduce((s,r)=>s+r.hits,0)/Math.max(1,rs.reduce((s,r)=>s+r.shots,0))).toFixed(3),supers:+(rs.reduce((s,r)=>s+r.supers,0)/rs.length).toFixed(2)}));
const report={maxPower,source:process.env.COMMIT||null,duels:results.length,practiceTrials:practice.length,legalFittings:mods.length,parityCases:parity,strongest,groups:groups(results),practiceGroups:groups(practice.map(r=>({...r,label:r.g+'/'+r.label,out:r.outcome==='won'?'win':r.outcome==='drawn'?'draw':'loss',shots:0,hits:0,supers:0}))),results,practice};
if(process.env.BALANCE_OUTPUT)fs.writeFileSync(process.env.BALANCE_OUTPUT,JSON.stringify(report,null,2));
console.log('PASS actual combat:',results.length,'paired duels,',practice.length,'six-mode practice trials,',mods.length,'legal fitting combinations,',parity,'client/server parity cases');
