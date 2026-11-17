// OWNER RULES (Session 6B owner decision 9): one check that fails the build when an owner-decided number changes or a guard test is
// loosened. The numbers and limits live in docs/owner-rules.json, which ONLY an owner-decided prompt may change. It checks:
//  1. the points constants: DAILY_CAP, CQ_PTS, DQ_PTS, DQ_ALL_BONUS, WQ_Q_PTS, WQ_PTS, LG_MULT and the Sortie chain (per, item),
//  2. the research rules: parts and time only (no CP or materials), the Worker clock, the slots, the lab's level cap and CC,
//  3. the chassis kit model: the reference pilot's first kit inside its window (dev/tools/chassis-kit-model.mjs),
//  4. the Science Lab tree: a regular 60-min/day pilot's median inside its weeks (dev/tools/economy-model.mjs researchModel), and
//     the best research build's gear-rating gain over the best build without research on the legend kit (about +8%),
//  5. the guard tests: each named limit is still there and never looser than the file's,
//  6. no CP source or sink is added (every line that changes a pilot's CP, counted per file),
//  7. no code is swallowed by a // comment anywhere in the game, the Worker, the tests or the tools,
//  8. points stay out of research and purchases: the premium pass track never pays points, Lab grants never award points.
// Run: node dev/tests/owner-rules.mjs
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
import {buildSim} from '../../worker/build-sim.mjs';import {GEAR} from './combat-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Combat:C,Plot:P}=CONQUEST;
const {MODEL}=await import('../tools/economy-model.mjs');
const O=JSON.parse(fs.readFileSync('docs/owner-rules.json','utf8'));
let passed=0;const fails=[];const ok=(c,m)=>{if(c){passed++;console.log('PASS '+m);}else{fails.push(m);console.log('FAIL '+m);}};
const J=JSON.stringify;
// ---- 1. the points constants ----
const K=O.constants;
for(const k of ['DAILY_CAP','DQ_PTS','DQ_ALL_BONUS','WQ_Q_PTS','WQ_PTS'])ok(R[k]===K[k],k+' = '+R[k]+' (owner: '+K[k]+')');
ok(J(R.CQ_PTS)===J(K.CQ_PTS),'CQ_PTS unchanged ('+J(R.CQ_PTS)+')');
ok(J(R.LG_MULT)===J(K.LG_MULT),'LG_MULT unchanged ('+R.LG_MULT.join(', ')+')');
ok(C.LIVING.chain.per===K.SORTIE_CHAIN.per&&C.LIVING.chain.item===K.SORTIE_CHAIN.item,'the Sortie chain: per '+C.LIVING.chain.per+', item '+C.LIVING.chain.item);
// ---- 2. the research rules ----
{const Rs=O.research,q=R.rsQuote({done:{},jobs:[]},'vent',3,false);
 ok(J(R.RTREE.timeMs)===J(Rs.timeMs),'research time: '+R.RTREE.timeMs.slice(1).map(ms=>ms/60000+' min').join(' / ')+' on the Worker clock');
 ok(R.RTREE.slots.base===Rs.slots.base&&R.RTREE.slots.lab3===Rs.slots.lab3,'one job at a time, a second slot at Science Lab III');
 ok(R.RTREE.labMax===Rs.labMax&&P.BUILDINGS.lab.max===Rs.labMax&&P.BUILDINGS.lab.cc===Rs.labCC,'the Science Lab: max level '+P.BUILDINGS.lab.max+', built from CC'+P.BUILDINGS.lab.cc);
 ok(J(Object.keys(q).sort())===J(['ms','n','part','tier'])&&R.RTREE_ALL.every(id=>{const x=R.rsQuote({done:Object.fromEntries(R.RTREE.mods[R.rmodOf(id).F.rs].filter(m=>m!==id).map(m=>[m,1])),jobs:[]},id,3,false);return !x.err&&Object.keys(x).every(k=>['ms','n','part','tier'].includes(k));}),'research costs research parts and time only (no CP, alloy, biomass or helium)');}
// ---- 3. the chassis kit model ----
{const out=path.join(os.tmpdir(),'owner-rules-kit-'+process.pid+'.json');execFileSync(process.execPath,['dev/tools/chassis-kit-model.mjs','--json',out],{stdio:'ignore',timeout:300000});
 const kit=JSON.parse(fs.readFileSync(out,'utf8')).reference,[lo,hi]=O.chassisKitFirstKitDays;fs.rmSync(out,{force:true});
 ok(kit.firstKitDays>=lo&&kit.firstKitDays<=hi,'chassis kit model: the reference pilot\'s first kit on day '+kit.firstKitDays+' (window '+lo+'-'+hi+')');}
// ---- 4. the Science Lab tree and its gear gain ----
{const r=MODEL.researchModel({minutes:60}),[lo,hi]=O.research.treeWeeks60min;
 ok(r.weeks.median>=lo&&r.weeks.median<=hi,'the earned tree: a regular 60-min/day pilot finishes in a median '+r.weeks.median+' weeks (10th-90th '+r.weeks.p10+'-'+r.weeks.p90+'; owner '+lo+'-'+hi+')');
 const best=(L,allow)=>{let top=0;const opts=s=>Object.keys(R.FITS[s]).filter(id=>allow(R.FITS[s][id]));for(const h of opts('hull'))for(const m of opts('mobility'))for(const t of opts('mount')){const mods={hull:h,mobility:m,mount:t},f=R.fittingStats(mods);if(f.weight>R.FIT_BUDGET.weight||f.power>R.FIT_BUDGET.power)continue;top=Math.max(top,R.powerOf({...L,mods}));}return top;};
 const L=structuredClone(GEAR[O.research.gearGainBestResearchVsBestFree.kit]),free=best(L,F=>!F.rs),rs=best(L,F=>!F.leg),g=rs/free-1,G=O.research.gearGainBestResearchVsBestFree;
 ok(Math.abs(g-G.target)<=G.tolerance,'best research build vs best without research on the '+G.kit+' kit: '+free+' -> '+rs+' (+'+(g*100).toFixed(2)+'%; owner about +'+G.target*100+'%)');}
// ---- 5. the guard tests are never loosened ----
for(const g of O.guards){const src=fs.existsSync(g.file)?fs.readFileSync(g.file,'utf8'):'',re=new RegExp(g.pattern,'g'),vals=[...src.matchAll(re)].map(m=>Number(m[1]));
 ok(vals.length>0&&vals.every(v=>g.max!==undefined?v<=g.max:v>=g.min),g.file.split('/').pop()+': '+g.what+' ('+(vals.length?vals.join(', '):'MISSING')+(g.max!==undefined?' <= '+g.max:' >= '+g.min)+')');}
// ---- 5b. the guarded results themselves: run the guard tests and judge their outputs against the owner's limits (a loosened
// assert inside a guard test cannot pass this). Their output files are put back as they were, so a local run leaves no diff ----
{const run=(file,out)=>{const keep=fs.existsSync(out)?fs.readFileSync(out):null;let code=0;try{execFileSync(process.execPath,[file],{stdio:'ignore',timeout:600000});}catch(e){code=e.status||1;}
  let j=null;try{j=JSON.parse(fs.readFileSync(out,'utf8'));}catch(_){}if(keep)fs.writeFileSync(out,keep);return {code,j};};
 const Lc=O.computed.ladder,lad=run(Lc.run,Lc.out),A=lad.j?.audit,tol=Lc.tolerance,inBand=(v,a)=>Number.isFinite(v)&&Math.abs(v/a-1)<=tol+1e-9;
 const W=lad.j?.withChainAndOrders,vals=lad.j?[['Decision 10',lad.j.decision10],['every change on (median)',W],['every change on (mean)',W?.mean]]:[];
 ok(lad.code===0&&A&&vals.every(([,v])=>inBand(v?.CC5,A.CC5)&&inBand(v?.CC10,A.CC10)),'the ladder itself: CC5 and CC10 within ±'+tol*100+'% of the audit ('+A?.CC5+' / '+A?.CC10+' days): '+vals.map(([n,v])=>n+' '+v?.CC5+' / '+v?.CC10).join('; '));
 ok(lad.j&&Math.min(lad.j.decision10?.CC10??0,lad.j.withChain?.CC10??0,...(W?.CC10range||[0]))>=Lc.minCC10Day,'no instant max-out: the earliest CC10 of every variant and panel pilot is day '+Math.min(lad.j?.decision10?.CC10??0,lad.j?.withChain?.CC10??0,...(W?.CC10range||[0]))+' (>= '+Lc.minCC10Day+')');
 const Bc=O.computed.baseProgression,bp=run(Bc.run,Bc.out),rg=bp.j?.regular?.hit;
 ok(bp.code===0&&rg?.CC10?.day>=Bc.minCC10Day&&rg?.CC5?.day>=Bc.minCC5Day,'base progression itself: a regular pilot reaches CC5 on day '+rg?.CC5?.day+' (>= '+Bc.minCC5Day+') and CC10 on day '+rg?.CC10?.day+' (floor '+Bc.minCC10Day+')');}
// ---- 6. no CP source or sink added ----
{const files=[...fs.readdirSync('worker/src').filter(f=>f.endsWith('.js')&&f!=='sim.gen.js').map(f=>'worker/src/'+f),...fs.readdirSync('js/conquest').filter(f=>f.endsWith('.js')).map(f=>'js/conquest/'+f),'js/rules.js'];
 const re=/ledger(?:\.cp|\[\s*['"]cp['"]\s*\])\s*(?:[+\-*\/]?=(?!=)|\+\+|--)|\.cp\s*(?:[+\-]=|\+\+|--)|\+\+\s*[\w$.]*ledger\.cp|--\s*[\w$.]*ledger\.cp/g,now={},deb={};for(const f of files){const src=fs.readFileSync(f,'utf8'),n=(src.match(re)||[]).length,d=(src.match(/\bdebit\(/g)||[]).length;if(n)now[f]=n;if(d)deb[f]=d;}
 const want=O.cpSites.files,diff=[...new Set([...Object.keys(now),...Object.keys(want)])].filter(f=>(now[f]|0)!==(want[f]|0)).map(f=>f+' '+(want[f]|0)+' -> '+(now[f]|0));
 ok(!diff.length,'no CP source or sink added or removed: '+(diff.length?diff.join('; '):Object.values(now).reduce((a,b)=>a+b,0)+' CP lines in '+Object.keys(now).length+' files, as decided'));
 const wantD=O.cpSites.debit,dd=[...new Set([...Object.keys(deb),...Object.keys(wantD)])].filter(f=>(deb[f]|0)!==(wantD[f]|0)).map(f=>f+' '+(wantD[f]|0)+' -> '+(deb[f]|0));
 ok(!dd.length,'no new cost debit: '+(dd.length?dd.join('; '):Object.values(deb).reduce((a,b)=>a+b,0)+' debit calls in '+Object.keys(deb).length+' files, as decided'));
 // the widened pattern catches the other spellings of a CP change
 ok(['s.ledger["cp"]-=400','ledger[\'cp\'] = 0','s.ledger.cp++','x.cp-=5','s.ledger.cp*=2'].every(c=>(c.match(re)||[]).length===1)&&!(('s.ledger.cp===0').match(re)),'the CP pattern also catches bracket spellings, ++/--, *= and /=, not comparisons');}
// ---- 7. no code swallowed by a // comment ----
{const CODE=[/[;)}\]](for|if|const|let|var|return|while|switch|else|try|do)\b\s*[({]/,/\)\s*\{\s*[A-Za-z_$][\w$.]*\s*(\(|=[^=>])/,/[;)}][A-Za-z_$][\w$.]*\([^)]*\);/,/[A-Za-z0-9_$](assert|ok)(\.[a-z]+)?\(/,/\);\s*(assert|ok|t)(\.[a-z]+)?\(/];
 const swallowed=src=>{const out=[];src.split('\n').forEach((line,i)=>{let q=null,esc=false,k=-1;for(let j=0;j<line.length;j++){const c=line[j];if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(q){if(c===q)q=null;continue;}if(c==="'"||c==='"'||c==='`'){q=c;continue;}if(c==='/'&&line[j+1]==='/'){k=j;break;}if(c==='/'&&line[j+1]==='*'){const e=line.indexOf('*/',j+2);if(e<0)return;j=e+1;}}
  if(k<0)return;const com=line.slice(k+2);if(CODE.some(re=>re.test(com)))out.push((i+1)+': '+com.trim().slice(0,100));});return out;};
 const files=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){if(/node_modules|vendor|assets|^\.|shots|captures/.test(e.name))continue;walk(p);}else if(/\.(m?js|cjs)$/.test(e.name)&&!/sim\.gen\.js$|\.min\.js$/.test(e.name))files.push(p);}};
 for(const r of O.lint.roots)walk(r);const hits=files.flatMap(f=>swallowed(fs.readFileSync(f,'utf8')).map(h=>f+':'+h));
 // the lint itself: the four lines that hid code before Session 6B must all be caught
 const known=["   // re-blending a damaged wall keeps its damage (REPAIR fixes it)for(const [c,n] of Object.entries(plan.used||{})){p.ws[c]=(p.ws[c]|0)-n;}","   // the DEF chip: shield + DEF + the ratingassert.ok(pv.includes(t),'x');","   // the 8 new solo patrols (patrol-03..10)for(const e of a.enemies){assert(!W.solidAt(e.x,e.z));}","assert(x);   // may refreshs.position=point(3000,3000);refreshState(s,now+P.day);assert(s.ok);"];
 ok(known.every(l=>swallowed(l).length===1),'the lint catches the four known swallowed-code lines');
 ok(!hits.length,'no code hidden after a // comment in '+files.length+' files'+(hits.length?': '+hits.slice(0,5).join(' | '):''));}
// ---- 8. points stay out of research and purchases ----
{ok(R.PASS_PREM.every(r=>!r||r.k!=='pts'),'the premium pass track never pays points');
 const src=fs.readFileSync('js/rules.js','utf8'),g=src.slice(src.indexOf('function ecoGrant('),src.indexOf('function ecoRefund('));
 const lab=g.split('\n').filter(l=>/kind==='(rspack|rsleg|rsfin)'/.test(l));ok(lab.length===3&&lab.every(l=>!/ecoAward|\.pts\b|earned|dailyPts/.test(l)),'Science Lab purchases never award points');
 const ra=fs.readFileSync('worker/src/conquest-research.js','utf8');ok(!/ecoAward|ptsRaw|\.pts\s*[+]=/.test(ra),'research jobs never award points');}
if(fails.length){console.log('FAIL owner-rules: '+fails.length+' of '+(fails.length+passed)+' checks: '+fails.join(' || '));process.exit(1);}
console.log('PASS owner-rules ('+passed+' checks)');
