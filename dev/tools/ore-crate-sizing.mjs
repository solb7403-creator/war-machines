// Session 8 (owner brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md section 2, Nov 26, 2026): the amounts in the four wall-only
// ore crates (Armalcolite $4.99, Tranquillityite $7.99, Selenite $9.99, Moonheart $14.99; at most 1 of each a day; the ore goes to town
// walls only), sized with the fortress model (dev/tools/fortress-model.mjs: the real income, builder and raid engine) so ROADMAP row 8's
// requirement holds: a paying pilot at the 2-hour heavy play time (PROFILES.payerHeavy, the store as shipped) is fully built within the
// year and noticeably stronger than a free pilot who plays as much (PROFILES.heavy), while the free pilots' model is untouched
// (--fingerprint / --prove). Every number here is SIMULATED (a deterministic model with scripted pilots), never playtesting: it says
// what the walls and the hold rates do, not whether buying or building is enjoyable.
// Definitions, fixed before any crate was measured (never tuned to results):
//  FULL    fully built within the year: on day 365 the payerHeavy town (ridge, the fortress test's town) has mean wall blend quality
//          q >= 0.99 (the test's q: the mean of ConquestPlot.blendQ over its wall cells) on the full cap (CC10's 2,000 cells + 50%);
//  STRONG  noticeably stronger than a free pilot who plays as much: payerHeavy's mean hold rate over days 300, 330 and 365 (holdRate,
//          n 3 raids a site and day: the test's) at least 5 points above the free heavy player's, and its day-365 wall q above his.
// The relative value, fixed with them (shapeOf): every crate holds the ore for the same number of wall cells at heavy blend (a cell at
// heavy blend takes 1.0 Armalcolite, 0.4 Tranquillityite, 0.2 Selenite, 0.1 Moonheart), so a crate of a rarer ore costs more per cell
// exactly as the owner's prices step ($4.99 / $7.99 / $9.99 / $14.99 for the same cells: rarer and stronger is dearer) and every crate
// is whole units: Moonheart m, Selenite 2m, Tranquillityite 4m, Armalcolite 10m (10m cells a crate). (Rejected before the search, on
// their shape alone: the fewest units that keep a rarer ore never cheaper per cell, which for larger crates prices every ore the same per
// cell, so Moonheart becomes the best buy per unit of strength; and the same strength per dollar for all four, which drops the rarity
// premium. One probe ran before the search to time the model: {"ar":16,"tq":8,"se":4,"mh":2}, fully built on day 225.) The
// search: the smallest m that meets FULL and STRONG (Moonheart decides FULL: q 0.99 is Moonheart heavy on nearly every cell); each m in
// the list is measured in its own process (the model caches its towns), so the table also shows what larger crates do; m - 1 must fail.
// usage: node dev/tools/ore-crate-sizing.mjs [--quick] [--par 3] [--n 3]            the search; writes docs/conquest/session8/ore-crates.json
//        node dev/tools/ore-crate-sizing.mjs --one '{"ar":10,"tq":4,"se":2,"mh":1}'  one candidate (prints JSON)
//        node dev/tools/ore-crate-sizing.mjs --free                                 the free heavy player (prints JSON)
//        node dev/tools/ore-crate-sizing.mjs --fingerprint out.json [--model ./fortress-model.mjs]
//            every number the fortress test reads from the free profiles (regular, heavy, grinder), exactly; run it on the model before
//            and after a change (the old model copied beside this file, e.g. git show <commit>:dev/tools/fortress-model.mjs)
//        node dev/tools/ore-crate-sizing.mjs --prove before.json after.json         compares two fingerprints; records it in the json
//        node dev/tools/ore-crate-sizing.mjs --diagnose        after the search: the chosen Moonheart crate with smaller lower crates
//                                                              (off the rule; recorded as diagnostics, never used for the choice)
import {spawn} from 'node:child_process';import {writeFileSync,readFileSync,mkdirSync,existsSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;},has=k=>process.argv.includes(k);
const OUT=fileURLToPath(new URL('../../docs/conquest/session8/ore-crates.json',import.meta.url)),LATE=[300,330,365],ORE=['ar','tq','se','mh'];
const USD=Object.freeze({ar:4.99,tq:7.99,se:9.99,mh:14.99}),PER_CELL=Object.freeze({ar:1,tq:.4,se:.2,mh:.1});   // the owner's prices; units a cell at heavy (ORE_UNITS x 4 / 40)
const r2=x=>Math.round(x*100)/100,r4=x=>Math.round(x*1e4)/1e4,pct=x=>Math.round(x*1000)/10,sum=o=>Object.values(o).reduce((a,b)=>a+b,0),mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
// the relative-value rule: a Moonheart crate of m units covers m / 0.1 cells at heavy blend; every other crate the same cells
export function shapeOf(m){const cells=m/PER_CELL.mh;return Object.fromEntries(ORE.map(k=>[k,Math.round(cells*PER_CELL[k])]));}
const valueOf=c=>Object.fromEntries(ORE.map(k=>[k,{units:c[k],cellsAtHeavy:r2(c[k]/PER_CELL[k]),usdPerCell:r4(USD[k]*PER_CELL[k]/c[k])}]));
const fullCap=P=>P.wallBase(P.CC.max)+Math.floor(P.wallBase(P.CC.max)*P.EXT.max/100);
const qOf=(P,t)=>{const w=Object.values(t.plot.w);return w.reduce((a,c)=>{const d=P.wdecode(c);return a+P.blendQ(d.o,d.l);},0)/Math.max(1,w.length);};   // the fortress test's q
const firstFull=(sh,full)=>{const i=sh.q.findIndex((x,k)=>x>=.99&&sh.cells[k]>=full);return i<0?null:i+1;};   // shop.q[d] is townAt(..., d + 1)
// ---- one candidate (its own process) ----
if(has('--one')){const M=await import('./fortress-model.mjs'),{CONQUEST}=await import('../../worker/src/sim.gen.js'),P=CONQUEST.Plot,crates=JSON.parse(arg('--one')),n=Number(arg('--n',3)),t0=Date.now();
 M.KNOB.oreCrates=crates;const full=fullCap(P);
 const hold=LATE.map(d=>{const h=M.holdRate('payerHeavy',d,{n});return {day:d,p:h.p,held:h.held,all:h.all};});   // builds every site's town on these days
 const site=s=>{const t=M.townAt('payerHeavy',s,365),sh=t.shop;return {q365:qOf(P,t),ringQ365:sh.q[364],cells365:Object.keys(t.plot.w).length,full:sh.full,firstFullDay:firstFull(sh,full),crates:sh.crates,usd:Object.fromEntries(ORE.map(k=>[k,r2(sh.usd[k])])),usdTotal:r2(sum(sh.usd)),
  feIl:{ferriteCrates:r2(sh.feIl.fe),ilmeniteCrates:r2(sh.feIl.il),usd:r2(sh.feIl.usd)},wallOreLeft:Object.fromEntries(ORE.map(k=>[k,r2(sh.wallOre[k])])),source:sh.source,qByDay:Object.fromEntries([30,60,90,120,150,180,210,240,270,300,330,365].map(d=>[d,r4(sh.q[d-1])]))};};
 const sites=Object.fromEntries(P.SITE_IDS.map(s=>[s,site(s)]));
 process.stdout.write(JSON.stringify({crates,n,hold,sites,ms:Date.now()-t0})+'\n');}
// ---- the free heavy player (the reference) ----
else if(has('--free')){const M=await import('./fortress-model.mjs'),{CONQUEST}=await import('../../worker/src/sim.gen.js'),P=CONQUEST.Plot,n=Number(arg('--n',3)),t0=Date.now();
 const hold=LATE.map(d=>{const h=M.holdRate('heavy',d,{n});return {day:d,p:h.p,held:h.held,all:h.all};});
 const sites=Object.fromEntries(P.SITE_IDS.map(s=>{const t=M.townAt('heavy',s,365);return [s,{q365:qOf(P,t),cells365:Object.keys(t.plot.w).length}];}));
 process.stdout.write(JSON.stringify({n,hold,sites,ms:Date.now()-t0})+'\n');}
// ---- the free profiles' fingerprint: every number the fortress test reads from them (and more), exactly ----
else if(has('--fingerprint')){const file=arg('--fingerprint'),M=await import(new URL(arg('--model','./fortress-model.mjs'),import.meta.url).href),{CONQUEST}=await import('../../worker/src/sim.gen.js'),P=CONQUEST.Plot,t0=Date.now();
 const H=(pr,d,o={})=>{const h=M.holdRate(pr,d,{n:3,...o});return {p:h.p,held:h.held,all:h.all,per:h.per.map(x=>x.site+':'+x.level+':'+x.o).join(',')};};
 const town=(pr,s,d)=>{const t=M.townAt(pr,s,d);return {q:qOf(P,t),cells:Object.keys(t.plot.w).length,cc:t.st.cc,lv:t.st.lv,rings:t.st.rings,bag:t.bag,garrison:t.garrison.length};};
 const by=(days,f)=>Object.fromEntries(days.map(d=>[d,f(d)])),R=[5,8,14,30,60,120,180,330],V=[60,120,180];
 const out={model:arg('--model','./fortress-model.mjs'),free:{
  regular:{on:by(R,d=>H('regular',d)),off:by(R,d=>H('regular',d,{se:false})),ahead:by(V,d=>H('regular',d,{share:.7})),push:by(V,d=>H('regular',d,{share:.3,citadelX:1.4})),ridge365:town('regular','ridge',365)},
  grinder:{on:by([60,180,300,330,365],d=>H('grinder',d)),off:by(LATE,d=>H('grinder',d,{se:false})),ridge365:town('grinder','ridge',365)},
  heavy:{on:by(LATE,d=>H('heavy',d)),off:by(LATE,d=>H('heavy',d,{se:false})),sites365:Object.fromEntries(P.SITE_IDS.map(s=>[s,town('heavy',s,365)]))},
  minerals:Object.fromEntries(['regular','heavy','grinder'].map(k=>[k,by([0,10,40,135,200,300,364],d=>M.minerals(M.PROFILES[k],d))])),
  ladder:M.ladderRun(1001*7919,{coach:true})},
  payer:{on:by([180,330],d=>H('payer',d)),ridge365:town('payer','ridge',365)}};   // the paying pilot (allowed to change: its Ferrite / Ilmenite)
 out.ms=Date.now()-t0;writeFileSync(file,JSON.stringify(out));console.log('fingerprint',file,out.ms,'ms');}
// ---- compare two fingerprints ----
else if(has('--prove')){const i=process.argv.indexOf('--prove'),[a,b]=[process.argv[i+1],process.argv[i+2]].map(f=>JSON.parse(readFileSync(f,'utf8')));
 const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),same=k=>JSON.stringify(a.free[k])===JSON.stringify(b.free[k]),keys=Object.keys(a.free);
 const sum3=f=>({regularOn:Object.fromEntries(Object.entries(f.regular.on).map(([d,x])=>[d,pct(x.p)])),regularOff:Object.fromEntries(Object.entries(f.regular.off).map(([d,x])=>[d,pct(x.p)])),regularAhead:Object.fromEntries(Object.entries(f.regular.ahead).map(([d,x])=>[d,pct(x.p)])),regularPush:Object.fromEntries(Object.entries(f.regular.push).map(([d,x])=>[d,pct(x.p)])),
  grinderOn:Object.fromEntries(Object.entries(f.grinder.on).map(([d,x])=>[d,pct(x.p)])),grinderOff:Object.fromEntries(Object.entries(f.grinder.off).map(([d,x])=>[d,pct(x.p)])),heavyOn:Object.fromEntries(Object.entries(f.heavy.on).map(([d,x])=>[d,pct(x.p)])),heavyOff:Object.fromEntries(Object.entries(f.heavy.off).map(([d,x])=>[d,pct(x.p)])),
  wallQ365:{regular:r4(f.regular.ridge365.q),grinder:r4(f.grinder.ridge365.q),heavy:r4(f.heavy.sites365.ridge.q)},ladderCC10:f.ladder.cc10});
 const res={label:'SIMULATED (the fortress model), not playtesting',method:'node dev/tools/ore-crate-sizing.mjs --fingerprint on the model before Session 8 (commit 54696a6, copied beside this tool) and after; every hold rate (each raid\'s site, level and outcome), town (levels, rings, exact bag) and mineral number the fortress test reads from the free profiles, compared as exact JSON',
  identical:keys.every(same),byProfile:Object.fromEntries(keys.map(k=>[k,same(k)])),sha256:{before:h(a.free),after:h(b.free)},numbers:sum3(b.free),
  payer:{note:'the paying pilot at the grinder\'s play time (not a free profile): its Ferrite and Ilmenite corrected to the shipped limits (was 200 Ferrite + 60 Ilmenite a day)',before:{hold:Object.fromEntries(Object.entries(a.payer.on).map(([d,x])=>[d,pct(x.p)])),wallQ365:r4(a.payer.ridge365.q)},after:{hold:Object.fromEntries(Object.entries(b.payer.on).map(([d,x])=>[d,pct(x.p)])),wallQ365:r4(b.payer.ridge365.q)}}};
 const doc=existsSync(OUT)?JSON.parse(readFileSync(OUT,'utf8')):{};doc.freeProfilesUnchanged=res;mkdirSync(fileURLToPath(new URL('../../docs/conquest/session8/',import.meta.url)),{recursive:true});writeFileSync(OUT,JSON.stringify(doc,null,1)+'\n');
 console.log('free profiles identical:',res.identical,JSON.stringify(res.byProfile),'sha256',res.sha256.after.slice(0,16));if(!res.identical)process.exitCode=1;}
// ---- diagnostics (never used for the choice): the chosen Moonheart crate with smaller lower crates (off the relative-value rule) ----
else if(has('--diagnose')){const me=fileURLToPath(import.meta.url),n=Number(arg('--n',3)),doc=JSON.parse(readFileSync(OUT,'utf8')),m=doc.chosenM;if(!m)throw Error('run the search first');
 const lo=m>1?shapeOf(m-1):{ar:1,tq:1,se:1},probes=[{why:'the lower crates of m '+(m-1)+' with the chosen Moonheart crate',crates:{ar:lo.ar,tq:lo.tq,se:lo.se,mh:m}},{why:'one unit in each lower crate (about Moonheart alone) with the chosen Moonheart crate',crates:{ar:1,tq:1,se:1,mh:m}}];
 const run=c=>new Promise((ok,no)=>{const p=spawn(process.execPath,[me,'--one',JSON.stringify(c),'--n',String(n)]);let o='';p.stdout.on('data',d=>o+=d);p.stderr.pipe(process.stderr);p.on('close',k=>k?no(Error('exit '+k)):ok(JSON.parse(o.trim().split('\n').pop())));});
 const res=await Promise.all(probes.map(x=>run(x.crates)));
 doc.diagnostics={label:'SIMULATED; diagnostic only, off the relative-value rule, never used for the choice',probes:probes.map((x,i)=>{const r=res[i],R=r.sites.ridge;return {why:x.why,crates:x.crates,holdByDay:Object.fromEntries(r.hold.map(h=>[h.day,pct(h.p)])),q365:r4(R.q365),firstFullDay:R.firstFullDay,allSitesFull:Object.values(r.sites).every(s=>s.q365>=.99&&s.cells365===s.full),usdTotal:R.usdTotal,cratesBought:R.crates};})};
 writeFileSync(OUT,JSON.stringify(doc,null,1)+'\n');for(const p of doc.diagnostics.probes)console.log(JSON.stringify(p));}
// ---- the search ----
else{const me=fileURLToPath(import.meta.url),n=Number(arg('--n',3)),quick=has('--quick'),MS=quick?[1,2,3,4,6]:[1,2,3,4,5,6,8,10,15,20,30];
 const run=a=>new Promise((ok,no)=>{const c=spawn(process.execPath,[me,...a,'--n',String(n)]);let o='';c.stdout.on('data',d=>o+=d);c.stderr.pipe(process.stderr);c.on('close',k=>k?no(Error(a.join(' ')+' exit '+k)):ok(JSON.parse(o.trim().split('\n').pop())));});
 const jobs=[{k:'free',a:['--free']},...MS.map(m=>({k:m,a:['--one',JSON.stringify(shapeOf(m))]}))],res={},queue=[...jobs],lanes=Math.max(1,Math.min(4,Number(arg('--par',3)))),t0=Date.now();
 await Promise.all(Array.from({length:lanes},async()=>{while(queue.length){const j=queue.shift();res[j.k]=await run(j.a);console.log('measured',j.k==='free'?'free heavy':'m '+j.k+' '+JSON.stringify(shapeOf(j.k)),Math.round((Date.now()-t0)/1000)+' s');}}));
 const F=res.free,fMean=mean(F.hold.map(x=>x.p)),fQ=F.sites.ridge.q365,rows=[];
 for(const m of MS){const r=res[m],R=r.sites.ridge,pMean=mean(r.hold.map(x=>x.p)),full=R.q365>=.99&&R.cells365===R.full,strong=pMean-fMean>=.05&&R.q365>fQ,allSites=Object.values(r.sites).every(s=>s.q365>=.99&&s.cells365===s.full);
  rows.push({m,crates:r.crates,value:valueOf(r.crates),FULL:{pass:full,q365:r4(R.q365),cells365:R.cells365,fullCap:R.full,firstFullDay:R.firstFullDay},STRONG:{pass:strong,holdByDay:Object.fromEntries(r.hold.map(x=>[x.day,pct(x.p)])),holdMean:pct(pMean),freeHeavyMean:pct(fMean),pointsAbove:Math.round((pMean-fMean)*1000)/10,wallQ365:r4(R.q365),freeHeavyWallQ365:r4(fQ)},pass:full&&strong,
   allSitesFull:allSites,sites:Object.fromEntries(Object.entries(r.sites).map(([s,x])=>[s,{q365:r4(x.q365),cells365:x.cells365,firstFullDay:x.firstFullDay,usdTotal:x.usdTotal}])),
   ridge:{cratesBought:R.crates,usd:R.usd,usdTotal:R.usdTotal,feIl:R.feIl,wallOreLeft:R.wallOreLeft,qByDay:R.qByDay}});}
 const pick=rows.find(r=>r.pass)||null,below=pick&&pick.m>1?rows.find(r=>r.m===pick.m-1)||null:null,pickAll=rows.find(r=>r.pass&&r.allSitesFull)||null;
 const doc0=existsSync(OUT)?JSON.parse(readFileSync(OUT,'utf8')):{};
 const doc={about:'Session 8 (owner brief docs/conquest/audit/SESSION_08_PAYMENTS_BRIEF.md section 2): the amounts in the four wall-only ore crates, sized with the fortress model (dev/tools/ore-crate-sizing.mjs; fortress-model.mjs PROFILES.payerHeavy) so ROADMAP row 8\'s requirement holds at the 2-hour heavy play time',
  label:'SIMULATED (the fortress model: the real income, builder and raid engine with scripted pilots), not playtesting; it measures wall strength and hold rates, not enjoyment',
  definitions:{fixed:'before any crate was measured; never tuned to results',FULL:'fully built within the year: on day 365 the payerHeavy town (ridge, the fortress test\'s town) has mean wall blend quality q >= 0.99 (the mean of ConquestPlot.blendQ over its wall cells, the fortress test\'s q) on the full cap (CC10\'s 2,000 cells + 50% = 3,000)',
   STRONG:'noticeably stronger than a free pilot who plays as much: payerHeavy\'s mean hold rate over days 300, 330 and 365 (holdRate, n 3 a site and day, the fortress test\'s) at least 5 points above the free heavy profile\'s, and its day-365 wall q above the free heavy\'s',
   relativeValue:'every crate holds the ore for the same number of wall cells at heavy blend (a cell at heavy blend takes 1.0 Armalcolite, 0.4 Tranquillityite, 0.2 Selenite, 0.1 Moonheart): Moonheart m, Selenite 2m, Tranquillityite 4m, Armalcolite 10m units (10m cells a crate), so a rarer ore costs more per cell exactly as the owner\'s prices step. Rejected before the search, on their shape alone: the fewest units that keep a rarer ore never cheaper per cell (for larger crates it prices every ore the same per cell, so Moonheart becomes the best buy per unit of strength) and the same strength per dollar for all four (no rarity premium). One probe ran before the search to time the model: {"ar":16,"tq":8,"se":4,"mh":2}, fully built on day 225',
   search:'the smallest m (Moonheart units a crate; the lower crates follow) that passes FULL and STRONG; m - 1 must fail; larger m measured for the table',
   payerHeavy:'the heavy player\'s play time (sessions 10:00 and 19:00 UTC, 60 min each), town ladder and Citadel pacing; the store levers as shipped: the second builder from day 1, the wall extension packs (+50%), Epic gear from day 1, the Ferrite Crate (150 Ferrite) 2 a day and the Ilmenite Crate (60 Ilmenite + 30 Ferrite) 4/7 a day (1 a day, 4 a week), and one of each wall-only ore crate a day while that ore can still improve the walls (a built ring below its heavy blend, or cells left to build), none once fully built; bought ore 100% to the walls\' blends only',
   money:'the wall-only ore crates bought on the ridge town over days 0-364 at the owner\'s prices ($4.99 / $7.99 / $9.99 / $14.99); the Ferrite and Ilmenite crates are reported apart (bought at the limits every day: an upper bound)'},
  prices:USD,freeHeavy:{holdByDay:Object.fromEntries(F.hold.map(x=>[x.day,pct(x.p)])),holdMean:pct(fMean),wallQ365:r4(fQ),sites:Object.fromEntries(Object.entries(F.sites).map(([s,x])=>[s,r4(x.q365)]))},
  candidates:rows,chosen:pick?pick.crates:null,chosenM:pick?.m??null,chosenAllSites:pickAll?pickAll.crates:null,smallerFails:below?{m:below.m,crates:below.crates,pass:below.pass,FULL:below.FULL,STRONG:below.STRONG}:null,
  n,quick,ms:Date.now()-t0};
 // what the table says beyond the pick (generated from the measurements, so they stay true when the search is run again)
 const at=m=>rows.find(r=>r.m===m),usdR=r=>Object.values(r.sites).map(s=>s.usdTotal),line=r=>'m '+r.m+' '+JSON.stringify(r.crates)+' fully built day '+r.FULL.firstFullDay+', $'+r.ridge.usdTotal;
 doc.notes=pick?['SIMULATED, not playtesting: the model shows wall strength and hold rates; it says nothing about whether buying or building is enjoyable.',
  'Money (PROPOSAL for the lead and the owner, under the owner\'s Nov 25 rule that monetization must give meaningful value): at the smallest amounts the requirement holds only for a pilot who buys the crates on most days until day '+pick.FULL.firstFullDay+': $'+pick.ridge.usdTotal+' a year of wall-only ore on the ridge town ($'+Math.min(...usdR(pick))+' to $'+Math.max(...usdR(pick))+' across the seven sites; '+Object.entries(pick.ridge.cratesBought).map(([k,v])=>v+' '+k).join(', ')+' crates), besides the Ferrite and Ilmenite crates ($'+pick.ridge.feIl.usd+' bought at their limits every day). Every larger crate is fully built sooner for less money: '+[5,10,30].map(at).filter(Boolean).map(line).join('; ')+'. Smaller crates mean more purchases, not a weaker paid fortress.',
  'STRONG is not the binding definition: every m measured'+(rows.every(r=>r.STRONG.pass)?' (m 1 too)':'')+' holds '+rows.map(r=>r.STRONG.holdMean).filter((v,i,a)=>a.indexOf(v)===i).join(' / ')+'% of the late raids against the free heavy player\'s '+pct(fMean)+'%: with the wall-only ore the paying pilot\'s town reaches the fully built town\'s ceiling (guard (a): it holds every raid at the top strength), so late raids stop being a contest for it.',
  'As needed (the lead\'s rule): a lower ore is bought while any ring is below its heavy blend or cells are left to build, so some is never used (at the pick: '+Object.entries(pick.ridge.wallOreLeft).map(([k,v])=>v+' '+k).join(', ')+' left on day 365); the lower crates\' spend is an upper bound.',
  'Hold rates are '+F.hold[0].all+' raids a day ('+n+' a site), so one raid is '+pct(1/F.hold[0].all)+' points; the requirement\'s 5 points is '+Math.ceil(.05*F.hold.reduce((a,x)=>a+x.all,0)-1e-9)+' more raids held of the '+F.hold.reduce((a,x)=>a+x.all,0)+' measured on days '+LATE.join(', ')+'.']:['no candidate meets both definitions'];
 if(doc0.freeProfilesUnchanged)doc.freeProfilesUnchanged=doc0.freeProfilesUnchanged;if(doc0.diagnostics)doc.diagnostics=doc0.diagnostics;
 mkdirSync(fileURLToPath(new URL('../../docs/conquest/session8/',import.meta.url)),{recursive:true});writeFileSync(OUT,JSON.stringify(doc,null,1)+'\n');
 console.log('SIMULATED (the fortress model), not playtesting. free heavy: hold '+F.hold.map(x=>pct(x.p)+'%').join(' / ')+' (mean '+pct(fMean)+'%), day-365 walls q '+fQ.toFixed(3));
 for(const r of rows)console.log(('m '+r.m).padEnd(5),JSON.stringify(r.crates).padEnd(34),'FULL',r.FULL.pass?'yes':'no ','q365',r.FULL.q365.toFixed(3),'full on day',String(r.FULL.firstFullDay).padEnd(4),'· STRONG',r.STRONG.pass?'yes':'no ',Object.values(r.STRONG.holdByDay).join('/')+'%','(+'+r.STRONG.pointsAbove+') · all sites',r.allSitesFull?'yes':'no ','· wall ore $'+r.ridge.usdTotal+' a year',JSON.stringify(r.ridge.cratesBought));
 console.log('chosen:',pick?'m '+pick.m+' '+JSON.stringify(pick.crates):'none passes',below?'(m '+below.m+' '+(below.pass?'PASSES too: not the smallest':'fails')+')':'');}
