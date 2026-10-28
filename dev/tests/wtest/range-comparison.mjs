// Trial comparability must use STARTING conditions, not the boss's eventual enrage phase.
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c=vm.createContext({});for(const f of ['range-host','rules','game','range-engine'])vm.runInContext(fs.readFileSync(new URL('../../../js/'+f+'.js',import.meta.url),'utf8'),c);
const s=c.RangeSim,L=JSON.parse(s.stock());s.setup({L,g:'boss',map:'classic',seed:123,preset:'standard',control:'player'});
const base=s.view().boss.spdM;s.view().boss.hp=s.view().boss.mhp*.49;s.step(1/60,[0,0]);
assert.notEqual(s.view().boss.spdM,base,'actual Survival enrage changed movement');
assert.equal(s.result().opponents.find(u=>u.boss).spd,base,'comparison retains initial opponent baseline');
console.log('PASS initial trial identity survives real Survival enrage');
