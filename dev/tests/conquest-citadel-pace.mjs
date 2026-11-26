// Session 7B PACING (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md; blueprint §6), validated with the REAL assault
// (dev/tools/citadel-pace.mjs: js/conquest/citadel.js on the shared combat engine through the Worker bundle, a careful bot pilot on real
// commands, each profile's kit by day from dev/tools/citadel-model.mjs). 3 seeded assaults a day; a day breaks a tier when at least 2 of
// 3 are won inside the 8-minute siege window. SIMULATED results (a bot pilot), never playtesting.
// Session 7R (owner rule, Nov 25, 2026: no seven-day wait between Citadel attacks; a matter of hours, 24 h the absolute maximum, or
// none): the next tier opens the moment a first clear settles (ConquestCitadel.CIT.refortMs 0), so the kit (gear, Battalion, ranks),
// not a timer, gates each tier. Boundary days (the full search with 4 seeds is dev/tools/citadel-pace.mjs; Checkpoint 51 records it).
// Fails if:
//  - the cooldown is above 24 h (the owner's absolute maximum) or is not the recorded choice (none);
//  - tier I: the regular breaks it on day 7 (before week 2) or cannot on day 18; the grinder breaks it on day 4 or cannot on day 7; the
//    heavy player breaks it on day 4 or cannot on day 11 (so: regular weeks 2-3, grinder days 5-7, the heavy between them; unchanged);
//  - the full Battalion's clears fall outside 6-8 minutes;
//  - tier II: the regular or the heavy player breaks it on common gear (days 26 / 14) or the grinder on its common-gear day 7, or the
//    regular / heavy cannot on rare gear (days 30 / 17), or the grinder cannot on day 12;
//  - tier III: any profile breaks it on common gear (regular 26 and 27, heavy 14, grinder 7), or cannot on the day its tier II falls
//    (regular 30, heavy 17, grinder 12).
// Rule 2 (guardrails, owner, Nov 25, 2026): the brief's tier III calendar targets (regular weeks 6-8, grinder week 3) were met only by
// the two 7-day waits (tier III = tier II + 7 here before). They are still REPORTED below against the owner's numbers (TARGETS,
// unchanged) but no longer asserted: the owner's approved change removes the wait that produced them, and no other number may change
// this session. The genuine problem the wait hid is reported, not masked: on rare gear tier III is barely harder than tier II (the same kit
// day breaks both; Checkpoint 51 PROPOSAL).
import assert from 'node:assert/strict';import {cpus} from 'node:os';
const {runner,TARGETS}=await import('../tools/citadel-pace.mjs');const M=await import('../tools/citadel-model.mjs');
const {buildSim}=await import('../../worker/build-sim.mjs');buildSim();const {CONQUEST}=await import('../../worker/src/sim.gen.js');
const run=runner(Math.max(1,Math.min(4,cpus().length))),SEEDS=3,RF=Math.ceil(CONQUEST.Citadel.CIT.refortMs/86400000);let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
const at=async(p,t,d)=>{const rs=await Promise.all(Array.from({length:SEEDS},(_,s)=>run({p,t,d,s})));return {d,won:rs.filter(r=>r.won).length,sec:rs.filter(r=>r.won).map(r=>r.sec).sort((a,b)=>a-b)};};
const k=(p,d)=>{const x=M.kitAt(p,d);return x.allies.length+' allies, force rank '+x.force+', '+['common','rare','epic'][x.tier]+' gear';};
ok(RF===0&&CONQUEST.Citadel.CIT.refortMs===0&&CONQUEST.Citadel.CIT.refortMs<=86400000,'no cooldown between Citadel tiers (owner: hours, 24 h the absolute maximum, or none; Session 7R: none)');
const D={r1a:at('regular',1,7),r1b:at('regular',1,18),g1a:at('grinder',1,4),g1b:at('grinder',1,7),h1a:at('heavy',1,4),h1b:at('heavy',1,11),
 r2a:at('regular',2,26),r2b:at('regular',2,30),h2a:at('heavy',2,14),h2b:at('heavy',2,17),g2a:at('grinder',2,7),g2b:at('grinder',2,12),
 r3a:at('regular',3,26),r3c:at('regular',3,27),h3a:at('heavy',3,14),g3a:at('grinder',3,7),r3b:at('regular',3,30+RF),g3b:at('grinder',3,12+RF),h3b:at('heavy',3,17+RF)};
const R={};for(const [key,p] of Object.entries(D))R[key]=await p;
const loses=(x,p,t)=>ok(x.won<2,'tier '+t+': the '+p+' on day '+x.d+' ('+k(p,x.d)+') wins '+x.won+' of '+SEEDS),wins=(x,p,t)=>ok(x.won>=2,'tier '+t+': the '+p+' on day '+x.d+' ('+k(p,x.d)+') breaks it: '+x.won+' of '+SEEDS);
loses(R.r1a,'regular',1);wins(R.r1b,'regular',1);loses(R.g1a,'grinder',1);wins(R.g1b,'grinder',1);loses(R.h1a,'heavy',1);wins(R.h1b,'heavy',1);
const mmss=v=>Math.floor(v/60)+':'+String(v%60).padStart(2,'0'),in68=(x,what)=>{const m=x.sec[x.sec.length>>1];ok(x.sec.length&&m>=360&&m<=480,'6-8 minutes with the full Battalion: '+what+' median clear '+mmss(m)+' ('+x.sec.map(mmss).join(', ')+')');};
in68(R.r1b,'the regular, tier I,');in68(R.g1b,'the grinder, tier I,');in68(R.h1b,'the heavy player, tier I,');
loses(R.r2a,'regular',2);wins(R.r2b,'regular',2);loses(R.h2a,'heavy',2);wins(R.h2b,'heavy',2);loses(R.g2a,'grinder',2);wins(R.g2b,'grinder',2);
loses(R.r3a,'regular',3);loses(R.r3c,'regular',3);loses(R.h3a,'heavy',3);loses(R.g3a,'grinder',3);wins(R.r3b,'regular',3);wins(R.g3b,'grinder',3);wins(R.h3b,'heavy',3);
in68(R.r2b,'the regular, tier II,');in68(R.h2b,'the heavy player, tier II,');in68(R.g2b,'the grinder, tier II,');in68(R.r3b,'the regular, tier III,');in68(R.g3b,'the grinder, tier III,');in68(R.h3b,'the heavy player, tier III,');
// the windows these boundary days imply (a kit day that wins stays won): regular tier I in (7, 18], grinder (4, 7], heavy (4, 11]
const W={r1:[8,18],g1:[5,7],h1:[5,11],r3:[28,30+RF],g3:[8,12+RF],h3:[15,17+RF]};   // tier III: lost on days 27 / 7 / 14, won on 30 / 12 / 17 (+RF)
ok(W.r1[0]>=TARGETS[1].regular[0]&&W.r1[1]<=TARGETS[1].regular[1],'tier I for the regular on days '+W.r1.join('-')+': weeks 2-3 ('+TARGETS[1].regular.join('-')+')');
ok(W.g1[0]>=TARGETS[1].grinder[0]&&W.g1[1]<=TARGETS[1].grinder[1],'tier I for the grinder on days '+W.g1.join('-')+': days '+TARGETS[1].grinder.join('-'));
ok(W.h1[0]>=W.g1[0]&&W.h1[1]<=W.r1[1],'tier I for the heavy player on days '+W.h1.join('-')+': between the grinder and the regular');
ok(W.h3[0]>=W.g3[0]&&W.h3[1]<=W.r3[1],'tier III for the heavy player on days '+W.h3.join('-')+': between the grinder ('+W.g3.join('-')+') and the regular ('+W.r3.join('-')+')');
// tier III comes when the kit breaks it: lost on common gear, broken on the day tier II falls (above). REPORTED against the owner's brief
// targets (Rule 2: not asserted, not changed; see the header), with the step from tier II on the same kit (SIMULATED)
const med=x=>x.sec.length?x.sec[x.sec.length>>1]:null,rep=(n,d,T)=>console.log('REPORT (simulated) tier III for the '+n+' broken by day '+d+' (this test\'s boundary day; the full search in citadel-pace.json may find it earlier) against the 7B brief target '+(Array.isArray(T)?'days '+T.join('-'):T)+': '+(Array.isArray(T)?(d>=T[0]&&d<=T[1]?'inside':'OUTSIDE (the target window was met only by the old two 7-day waits; Checkpoint 51)'):'see the regular and the grinder'));
rep('regular',30+RF,TARGETS[3].regular);rep('grinder',12+RF,TARGETS[3].grinder);rep('heavy',17+RF,TARGETS[3].heavy);
console.log('REPORT (simulated) the same kit, tier II -> tier III median clear: regular '+mmss(med(R.r2b))+' -> '+mmss(med(R.r3b))+', heavy '+mmss(med(R.h2b))+' -> '+mmss(med(R.h3b))+', grinder '+mmss(med(R.g2b))+' -> '+mmss(med(R.g3b))+' (tier III is barely harder on rare gear: the kit day that breaks tier II breaks tier III, its clears about 30 s longer; Checkpoint 51 PROPOSAL)');
console.log(JSON.stringify({test:'conquest-citadel-pace',pass}));
