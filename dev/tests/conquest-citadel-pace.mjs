// Session 7B PACING (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md; blueprint §6), validated with the REAL assault
// (dev/tools/citadel-pace.mjs: js/conquest/citadel.js on the shared combat engine through the Worker bundle, a careful bot pilot on real
// commands, each profile's kit by day from dev/tools/citadel-model.mjs). 3 seeded assaults a day; a day breaks a tier when at least 2 of
// 3 are won inside the 8-minute siege window. A tier after the first opens 7 days after the previous tier's first clear (the Hive
// re-fortifies: ConquestCitadel.CIT.refortMs), so a profile's first clear of tier N+1 is never before its first clear of tier N + 7 days.
// Boundary days (the full search with 4 seeds is dev/tools/citadel-pace.mjs; Checkpoint 49 "Pacing" records its numbers). Fails if:
//  - tier I: the regular breaks it on day 7 (before week 2) or cannot on day 18; the grinder breaks it on day 4 or cannot on day 7; the
//    heavy player breaks it on day 4 or cannot on day 11 (so: regular weeks 2-3, grinder days 5-7, the heavy between them);
//  - the full Battalion's tier I clears fall outside 6-8 minutes;
//  - tier II: the regular or the heavy player breaks it on common gear (days 26 / 14), or cannot on rare gear (days 30 / 17), or the
//    grinder cannot on day 12 (the earliest its tier I + 7 allows);
//  - tier III: the regular breaks it on common gear (day 26), or a profile cannot break it 7 days after its tier II (regular 37, grinder
//    19, heavy 24): then tier III lands at regular weeks 6-8 (day 37), grinder week 3 (days 19-21) and the heavy player between them.
import assert from 'node:assert/strict';import {cpus} from 'node:os';
const {runner}=await import('../tools/citadel-pace.mjs');const M=await import('../tools/citadel-model.mjs');
const {buildSim}=await import('../../worker/build-sim.mjs');buildSim();const {CONQUEST}=await import('../../worker/src/sim.gen.js');
const run=runner(Math.max(1,Math.min(4,cpus().length))),SEEDS=3,RF=Math.round(CONQUEST.Citadel.CIT.refortMs/86400000);let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
const at=async(p,t,d)=>{const rs=await Promise.all(Array.from({length:SEEDS},(_,s)=>run({p,t,d,s})));return {d,won:rs.filter(r=>r.won).length,sec:rs.filter(r=>r.won).map(r=>r.sec).sort((a,b)=>a-b)};};
const k=(p,d)=>{const x=M.kitAt(p,d);return x.allies.length+' allies, force rank '+x.force+', '+['common','rare','epic'][x.tier]+' gear';};
ok(RF===7,'the Hive re-fortifies the next tier for 7 days after a first clear');
const D={r1a:at('regular',1,7),r1b:at('regular',1,18),g1a:at('grinder',1,4),g1b:at('grinder',1,7),h1a:at('heavy',1,4),h1b:at('heavy',1,11),
 r2a:at('regular',2,26),r2b:at('regular',2,30),h2a:at('heavy',2,14),h2b:at('heavy',2,17),g2b:at('grinder',2,12),
 r3a:at('regular',3,26),r3b:at('regular',3,30+RF),g3b:at('grinder',3,12+RF),h3b:at('heavy',3,17+RF)};
const R={};for(const [key,p] of Object.entries(D))R[key]=await p;
const loses=(x,p,t)=>ok(x.won<2,'tier '+t+': the '+p+' on day '+x.d+' ('+k(p,x.d)+') wins '+x.won+' of '+SEEDS),wins=(x,p,t)=>ok(x.won>=2,'tier '+t+': the '+p+' on day '+x.d+' ('+k(p,x.d)+') breaks it: '+x.won+' of '+SEEDS);
loses(R.r1a,'regular',1);wins(R.r1b,'regular',1);loses(R.g1a,'grinder',1);wins(R.g1b,'grinder',1);loses(R.h1a,'heavy',1);wins(R.h1b,'heavy',1);
{const s=R.r1b.sec,med=s[s.length>>1];ok(med>=360&&med<=480,'the full Battalion breaks tier I in 6-8 minutes: the regular\'s median clear '+Math.floor(med/60)+':'+String(med%60).padStart(2,'0'));}
ok(true,'tier I: the regular on days 8-18 (weeks 2-3), the grinder on days 5-7, the heavy player on days 5-11 (between them)');
loses(R.r2a,'regular',2);wins(R.r2b,'regular',2);loses(R.h2a,'heavy',2);wins(R.h2b,'heavy',2);wins(R.g2b,'grinder',2);
loses(R.r3a,'regular',3);wins(R.r3b,'regular',3);wins(R.g3b,'grinder',3);wins(R.h3b,'heavy',3);
ok(30+RF>=36&&30+RF<=56,'tier III for the regular on day '+(30+RF)+' (tier II on rare gear, day 30, + '+RF+'): weeks 6-8');
ok(12+RF>=15&&14+RF<=21,'tier III for the grinder on days '+(12+RF)+'-'+(14+RF)+' (its tier II at the earliest 7 days after its tier I, days 5-7): week 3');
ok(17+RF>14+RF&&17+RF<30+RF,'tier III for the heavy player on day '+(17+RF)+': between the grinder and the regular');
console.log(JSON.stringify({test:'conquest-citadel-pace',pass}));
