import assert from 'node:assert/strict';
import {buildSim} from '../../../worker/build-sim.mjs';
import {fakeRec} from './fakerec.mjs';
buildSim();
const {RULES:R}=await import('../../../worker/src/sim.gen.js');
const {checkProof}=await import('../../../worker/src/proof.js');
// Hand-checked stock baselines from the pre-Lab rules and wiki.
const S=R.ecoNorm({});S.mig=1;S.L=structuredClone(R.STOCK_L);R.labEnsure(S);
const L=R.labLoadout(S);assert.equal(R.powerOf(L),68);
for(const [n,hp] of [[1,1700],[2,3400],[3,5100],[0.5,850],[1.5,2550]]){
 const T=R.tankOf(L,n);assert.equal(T.mhp,hp);assert.equal(T.wdps,70);assert.equal(T.wshot,0.2);assert.equal(T.spdM,1);assert.equal(T.dmgM,1);assert.equal(T.turnM,1);
}
for(const [g,wins] of [['arena',[250,320,420]],['zone',[375,480,630]],['crystal',[375,480,630]],['bounty',[438,560,720]],['boss',[375,480,630]]]){
 for(const [i,m] of ['1v1','2v2','3v3'].entries())assert.equal(R.winBase(g,m),wins[i]);
}
assert.deepEqual(R.ROYALE_PTS,[900,600,400,200,100,50]);
for(const [g,hp] of [['arena',1700],['zone',1700],['crystal',1700],['bounty',850],['royale',3400],['boss',2550]]){
 const pf=fakeRec({g,m:'1v1',dur:120,won:true,place:g==='royale'?1:0,mhp:hp});
 const out=checkProof(pf,{g,m:'1v1',map:'classic',secs:125,won:true,drawn:false,place:g==='royale'?1:0,series:g==='arena',min:12,spdM:1,st:{dmg:0},variants:[{ci:1,mhp:hp,spdM:1}]});
 assert.equal(out.ok,true,g+': '+out.why);
}
console.log('PASS stock stats/rewards parity and snapshot-bound proof contracts in all six modes');
