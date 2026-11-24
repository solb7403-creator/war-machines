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
const {runner,TARGETS}=await import('../tools/citadel-pace.mjs');const M=await import('../tools/citadel-model.mjs');
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
const mmss=v=>Math.floor(v/60)+':'+String(v%60).padStart(2,'0'),in68=(x,what)=>{const m=x.sec[x.sec.length>>1];ok(x.sec.length&&m>=360&&m<=480,'6-8 minutes with the full Battalion: '+what+' median clear '+mmss(m)+' ('+x.sec.map(mmss).join(', ')+')');};
in68(R.r1b,'the regular, tier I,');in68(R.g1b,'the grinder, tier I,');in68(R.h1b,'the heavy player, tier I,');
loses(R.r2a,'regular',2);wins(R.r2b,'regular',2);loses(R.h2a,'heavy',2);wins(R.h2b,'heavy',2);wins(R.g2b,'grinder',2);
loses(R.r3a,'regular',3);wins(R.r3b,'regular',3);wins(R.g3b,'grinder',3);wins(R.h3b,'heavy',3);
in68(R.r2b,'the regular, tier II,');in68(R.h2b,'the heavy player, tier II,');in68(R.g2b,'the grinder, tier II,');in68(R.r3b,'the regular, tier III,');in68(R.g3b,'the grinder, tier III,');in68(R.h3b,'the heavy player, tier III,');
// the windows these boundary days imply (tier N+1 opens RF days after tier N; a kit day that wins stays won):
// regular tier I in (7, 18], grinder (4, 7], heavy (4, 11]; tier II: regular 30 (26 lost on common gear), heavy 17 (14 lost), grinder
// its tier I + RF (12-14: day 12 won); tier III = tier II + RF, each won on that day
const W={r1:[8,18],g1:[5,7],h1:[5,11],r3:[30+RF,30+RF],g3:[5+2*RF,7+2*RF],h3:[17+RF,Math.max(17,11+RF)+RF]};
ok(W.r1[0]>=TARGETS[1].regular[0]&&W.r1[1]<=TARGETS[1].regular[1],'tier I for the regular on days '+W.r1.join('-')+': weeks 2-3 ('+TARGETS[1].regular.join('-')+')');
ok(W.g1[0]>=TARGETS[1].grinder[0]&&W.g1[1]<=TARGETS[1].grinder[1],'tier I for the grinder on days '+W.g1.join('-')+': days '+TARGETS[1].grinder.join('-'));
ok(W.h1[0]>=W.g1[0]&&W.h1[1]<=W.r1[1],'tier I for the heavy player on days '+W.h1.join('-')+': between the grinder and the regular');
ok(W.r3[0]>=TARGETS[3].regular[0]&&W.r3[1]<=TARGETS[3].regular[1],'tier III for the regular on day '+W.r3[0]+': weeks 6-8 ('+TARGETS[3].regular.join('-')+')');
ok(W.g3[0]>=TARGETS[3].grinder[0]&&W.g3[1]<=TARGETS[3].grinder[1],'tier III for the grinder on days '+W.g3.join('-')+': week 3 ('+TARGETS[3].grinder.join('-')+')');
ok(W.h3[0]>W.g3[1]-RF&&W.h3[1]<W.r3[0],'tier III for the heavy player on days '+W.h3.join('-')+': between the grinder and the regular (planned about 32: measured 24, reported in Checkpoint 49)');
console.log(JSON.stringify({test:'conquest-citadel-pace',pass}));
