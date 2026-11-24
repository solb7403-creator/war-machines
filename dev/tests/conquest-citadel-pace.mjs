// Session 7B PACING (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md; blueprint §6), validated with the REAL assault
// (dev/tools/citadel-pace.mjs: js/conquest/citadel.js on the shared combat engine through the Worker bundle, a careful bot pilot on real
// commands, each profile's kit by day from dev/tools/citadel-model.mjs). 3 seeded assaults a day; a day breaks a tier when at least 2 of
// 3 are won inside the 8-minute siege window. Fails if:
//  - tier I can be broken without the full Battalion (the kit day before it loses) or the full Battalion cannot break it, for the
//    regular (60 min a day), the heavy player (2 h) and the grinder (4 h); or the full Battalion's clears fall outside 6-8 minutes;
//  - those days leave the brief's targets: tier I in weeks 2-3 for the regular (days 8-21), days 5-7 for the grinder, the heavy between;
//  - the regular breaks tier II or III on common gear, or cannot break tier II on rare gear (the second power step: gear tier 1).
// The tier III targets (weeks 6-8, week 3) are measured and reported by dev/tools/citadel-pace.mjs, not asserted here: Checkpoint 49
// "Pacing" records why the real assault puts tier III at the rare gear day.
import assert from 'node:assert/strict';import {cpus} from 'node:os';
const {runner,kitDays,TARGETS}=await import('../tools/citadel-pace.mjs');const M=await import('../tools/citadel-model.mjs');
const run=runner(Math.max(1,Math.min(4,cpus().length))),SEEDS=3;let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};
const dayOf=(p,f)=>{for(let d=1;d<=80;d++)if(f(M.kitAt(p,d)))return d;return null;};
async function at(p,t,d){const rs=await Promise.all(Array.from({length:SEEDS},(_,s)=>run({p,t,d,s})));return {d,won:rs.filter(r=>r.won).length,sec:rs.filter(r=>r.won).map(r=>r.sec).sort((a,b)=>a-b),rs};}
const before=async(p,d)=>{const ds=await kitDays(p,80);return ds.filter(x=>x<d).at(-1);};
const PROFILES=['regular','heavy','grinder'],gate={};
await Promise.all(PROFILES.map(async p=>{const full=dayOf(p,k=>k.allies.length>=9),prev=await before(p,full);const [a,b]=await Promise.all([at(p,1,prev),at(p,1,full)]);gate[p]={full,prev,a,b};}));
for(const p of PROFILES){const {full,prev,a,b}=gate[p];
 ok(a.won<2,'tier I needs the full Battalion: the '+p+' on day '+prev+' ('+M.kitAt(p,prev).allies.length+' allies) wins '+a.won+' of '+SEEDS);
 ok(b.won>=2,'the '+p+'\'s full Battalion (day '+full+', 9 allies) breaks tier I: '+b.won+' of '+SEEDS+' won');
 const med=b.sec[b.sec.length>>1];ok(med>=360&&med<=480,'the full Battalion breaks tier I in 6-8 minutes: the '+p+'\'s median clear '+Math.floor(med/60)+':'+String(med%60).padStart(2,'0'));}
{const T=TARGETS[1],r=gate.regular.full,g=gate.grinder.full,h=gate.heavy.full;
 ok(r>=T.regular[0]&&r<=T.regular[1],'tier I in weeks 2-3 for the regular: day '+r);
 ok(g>=T.grinder[0]&&g<=T.grinder[1],'tier I on days 5-7 for the grinder: day '+g);
 ok(h>=g&&h<=r,'the heavy player between them: day '+h+' (fortress-model PROFILES.heavy plans about day 10)');}
{const rare=dayOf('regular',k=>k.tier>=1),prev=await before('regular',rare);const [c2,r2,c3]=await Promise.all([at('regular',2,prev),at('regular',2,rare),at('regular',3,prev)]);
 ok(c2.won<2,'tier II needs rare gear: the regular on common gear (day '+prev+', the full Battalion) wins '+c2.won+' of '+SEEDS);
 ok(r2.won>=2,'the regular on rare gear (day '+rare+') breaks tier II: '+r2.won+' of '+SEEDS);
 ok(c3.won<2,'tier III needs at least rare gear: the regular on common gear (day '+prev+') wins '+c3.won+' of '+SEEDS);}
console.log(JSON.stringify({test:'conquest-citadel-pace',pass}));
