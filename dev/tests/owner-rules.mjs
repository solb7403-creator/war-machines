// OWNER RULES (Session 6B owner decision 9): one check that fails the build when an owner-decided number changes or a guard test is
// loosened. The numbers and limits live in docs/owner-rules.json, which ONLY an owner-decided prompt may change. It checks:
//  1. the points constants: DAILY_CAP, CQ_PTS, DQ_PTS, DQ_ALL_BONUS, WQ_Q_PTS, WQ_PTS, LG_MULT and the Sortie chain (per, item),
//  2. the research rules: parts and time only (no CP or materials), the Worker clock, the slots, the lab's level cap and CC,
//  3. the chassis kit model: the reference pilot's first kit inside its window (dev/tools/chassis-kit-model.mjs),
//  4. the Science Lab tree (owner, Nov 17): the costs 2/4/5/9, one EARNED research part a day per account (the Worker's pickup;
//     packs and the Lunar Pass exempt), each Legendary set mod's free research path (30 parts, 8 h, Science Lab III, after its
//     track's set mod) and its buy gate (after that set mod; Science Lab III alone never opens it), one of each part pack a UTC
//     week (+1 / +3 / +8), the best research build's gear-rating gain over the best build without research (about +8%) and the
//     best Legendary build's over the best research build (about +7%), both on the legend kit. (The old check, a median tree
//     time inside 6-10 weeks, was a Claude-invented target, never the owner's: removed in the Session 6B finish; the model's
//     days are report numbers only, RESOURCE_ECONOMY §7.5),
//  5. the guard tests: each named limit is still there and never looser than the file's,
//  6. no CP source or sink is added (every line that changes a pilot's CP, counted per file),
//  7. no code is swallowed by a // comment anywhere in the game, the Worker, the tests or the tools,
//  8. points stay out of research and purchases: the premium pass track never pays points, Lab grants never award points.
// Run: node dev/tests/owner-rules.mjs
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
import {buildSim} from '../../worker/build-sim.mjs';import {GEAR} from './combat-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js');const {Combat:C,Plot:P}=CONQUEST;
// (the economy model's research days are report numbers only, never pinned: RESOURCE_ECONOMY §7.5)
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
{const Rs=O.research;
 ok(J(R.RTREE.cost)===J(Rs.cost),'research costs '+R.RTREE.cost.join(' / ')+' parts a track ('+R.RTREE.cost.reduce((a,b)=>a+b,0)*4+' in all; owner: '+Rs.cost.join(' / ')+')');
 // one earned part a day, on the Worker's own pickup path (worker/src/conquest-loot.js bind): the second the same UTC day is a fragment
 const {bind}=await import('../../worker/src/conquest-loot.js'),t0=Date.UTC(2026,10,18,9),st={};
 bind(st,{pt:{thermal:1},src:'elite'},t0);bind(st,{pt:{thermal:1},src:'elite'},t0+6e4);const day1=st.inv.pt.thermal;bind(st,{pt:{coil:1},src:'commander'},t0+864e5);
 ok(R.CQ_PART_DAY===Rs.earnedPartsPerDay.n&&day1===1&&st.inv.pt.coil===1&&J(Rs.earnedPartsPerDay.exempt)===J(['packs','pass','firstLabGrant']),'one earned research part a day per account (a second the same UTC day became a fragment; the next day counts again); packs and the Lunar Pass exempt');
 {const S0=R.ecoNorm({});R.ecoAddParts(S0,3);R.ecoAddParts(S0,3);ok(R.CQ_PART_ORDER.every(k=>S0.bpt[k]===6),'pack and pass parts (the account\'s bonus parts) carry no daily count');}
 // the Legendary set mods' free research path and its two gates
 const L=Rs.legendaryResearch,legOk=R.RTREE_LEG.every(id=>{const t=R.rmodOf(id).F.rs,set=R.RTREE.mods[t][3],mods=R.RTREE.mods[t];
   const low=R.rsQuote({done:Object.fromEntries(mods.map(m=>[m,1])),jobs:[]},id,L.labLevel-1,false),noSet=R.rsQuote({done:Object.fromEntries(mods.filter(m=>m!==set).map(m=>[m,1])),jobs:[]},id,L.labLevel,false),q=R.rsQuote({done:Object.fromEntries(mods.map(m=>[m,1])),jobs:[]},id,L.labLevel,false);
   return !!low.err&&!!noSet.err&&!q.err&&q.n===L.parts&&q.ms===L.ms&&q.part===R.RTREE.tracks[t].part;});
 ok(legOk&&R.RTREE.leg.n===L.parts&&R.RTREE.leg.ms===L.ms&&L.afterTrackSetMod===true,'each Legendary set mod: researched for '+L.parts+' of its track\'s part in '+L.ms/36e5+' h, only at Science Lab III and only after its track\'s set mod');
 const B=Rs.legendaryBuy,buyOk=R.RTREE_LEG.every(id=>{const t=R.rmodOf(id).F.rs,set=R.RTREE.mods[t][3],mods=R.RTREE.mods[t];const before=R.ecoNorm({rm:Object.fromEntries(mods.filter(m=>m!==set).map(m=>[m,1]))}),after=R.ecoNorm({rm:Object.fromEntries(mods.map(m=>[m,1]))});
   return R.ecoOwned(before,{kind:'rsleg',tk:id},{week:1})&&!R.ecoOwned(after,{kind:'rsleg',tk:id},{week:1});});
 ok(buyOk&&B.afterTrackSetMod===true&&B.opensAtLabIII===false,'a Legendary set mod is for sale only after its track\'s set mod is researched (Science Lab III alone never opens it)');
 const PK=Rs.partPacks,S1=R.ecoNorm({});S1.buys={[R.rsPackKey('crate',{week:5})]:1};
 ok(R.RS_PACK_ORDER.every(k=>R.RS_PACKS[k].each===PK.each[k])&&R.ecoOwned(S1,{kind:'rspack',tk:'crate'},{week:5})&&!R.ecoOwned(S1,{kind:'rspack',tk:'crate'},{week:6})&&PK.perWeekEach===1,'part packs: '+R.RS_PACK_ORDER.map(k=>R.RS_PACKS[k].n+' +'+R.RS_PACKS[k].each).join(', ')+', one of each a UTC week');
 const best=(L,allow)=>{let top=0;const opts=s=>Object.keys(R.FITS[s]).filter(id=>allow(R.FITS[s][id]));for(const h of opts('hull'))for(const m of opts('mobility'))for(const t of opts('mount')){const mods={hull:h,mobility:m,mount:t},f=R.fittingStats(mods);if(f.weight>R.FIT_BUDGET.weight||f.power>R.FIT_BUDGET.power)continue;top=Math.max(top,R.powerOf({...L,mods}));}return top;};
 const G=Rs.gearGainBestResearchVsBestFree,Lk=structuredClone(GEAR[G.kit]),free=best(Lk,F=>!F.rs),rs=best(Lk,F=>!F.leg),g=rs/free-1;
 ok(Math.abs(g-G.target)<=G.tolerance,'best research build vs best without research on the '+G.kit+' kit: '+free+' -> '+rs+' (+'+(g*100).toFixed(2)+'%; owner about +'+G.target*100+'%)');
 const G2=Rs.gearGainBestLegendaryVsBestResearch,L2=structuredClone(GEAR[G2.kit]),rs2=best(L2,F=>!F.leg),lg=best(L2,()=>true),g2=lg/rs2-1;
 ok(Math.abs(g2-G2.target)<=G2.tolerance,'best Legendary build vs best research build on the '+G2.kit+' kit: '+rs2+' -> '+lg+' (+'+(g2*100).toFixed(2)+'%; owner about +'+Math.round(G2.target*100)+'%)');}
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
// ---- Session 6C Battalion (owner, Nov 18): checked on the Worker's own code ----
{const Bo=O.battalion,{CONQUEST:CQ,RULES:RR}=await import('../../worker/src/sim.gen.js'),BT=CQ.Battalion,{grantChip,chipsHeld,outcome}=await import('../../worker/src/conquest-battalion.js'),
 {researchAction,research}=await import('../../worker/src/conquest-research.js'),{killLoot}=await import('../../worker/src/conquest-economy.js'),{createState}=await import('../../worker/src/conquest-sim.js'),{inventory}=await import('../../worker/src/conquest-loot.js');
 const day=Date.UTC(2026,10,20,12),mk=()=>{const s=createState(RR.STOCK_L,day);s.plot={cc:7,site:'ridge',b:{lab:{t:'lab',l:4},hangar:{t:'hangar',l:2}}};return s;};
 ok(J(BT.RC.cost.slice(2))===J(Bo.roleCoreCost)&&BT.RC.ms===Bo.roleCoreMs&&RR.RTREE.role.lab===Bo.roleCoreLab&&RR.RTREE.role.part==='chip','Role Core levels 2-5 cost '+BT.RC.cost.slice(2).join(' / ')+' command chips, '+BT.RC.ms/3600000+' h jobs, opened by Science Lab '+['','I','II','III','IV'][RR.RTREE.role.lab]);
 {const s=mk();s.bat={ch:{e:2,d:0,bs:0}};const cp=s.ledger.cp;research(s);researchAction(s,{action:'research-start',mod:'rc:guardian'},day,{bch:0});const j=s.rs.jobs.at(-1);
  ok(j&&j.part==='chip'&&j.lv===2&&s.ledger.cp===cp&&s.bat.ch.e===0&&j.ms===Bo.roleCoreMs,'a Role Core job is chips and time only (2 chips spent, CP unchanged), never CP');
  const s2=mk();s2.plot.b.lab.l=3;s2.bat={ch:{e:9,d:0,bs:0}};research(s2);let refused=false;try{researchAction(s2,{action:'research-start',mod:'rc:guardian'},day,{bch:0});}catch(e){refused=/Science Lab level IV/.test(e.message);}ok(refused,'no Role Core job before Science Lab IV');}
 {const s=mk(),a=grantChip(s,'win',day),b=grantChip(s,'win',day+1000),c=grantChip(s,'drop',day+2000),d=grantChip(s,'win',day+864e5);
  ok(BT.CHIP.day===Bo.chipsPerDay.n&&a?.chip===1&&b===null&&c?.swap===1&&d?.chip===1&&chipsHeld(s,5).total===s.bat.ch.e+5&&J(Bo.chipsPerDay.exempt)===J(['pack']),'one earned command chip a UTC day (a later win gives none, a later find is a fragment, the next day gives one); pack chips are never limited');}
 {const S=RR.ecoNorm({}),X={day:20000,week:2857};S.buys[RR.chipPackKey?RR.chipPackKey(X):'chp|'+X.week]=1;ok(RR.ecoOwned(S,{kind:'chippack'},X)===true&&Bo.chipPackPerWeek===1&&RR.CHIP_PACK.chips>0,'the chip pack: one a UTC week');}
 {const s=mk();research(s);const v=inventory(s),pd=J(v.pd);researchAction(s,{action:'research-grant',mod:'coil'},day,{});let twice=false;try{researchAction(s,{action:'research-grant',mod:'thermal'},day,{});}catch(e){twice=true;}
  ok(v.pt.coil===Bo.firstLabGrant.parts&&J(v.pd)===pd&&twice&&J(Bo.firstLabGrant.choices)===J(['thermal','coil']),'the first Science Lab grant: '+Bo.firstLabGrant.parts+' parts of Thermal or Ballistics, once, outside the one-a-day limit');}
 ok(J(BT.FIELD)===J(Bo.field)&&BT.ROSTER_MAX===Bo.roster,'allies fielded: 1 with no Hangar, then '+BT.FIELD.slice(1).join(' / ')+'; a roster of '+BT.ROSTER_MAX);
 {const s=mk(),e={id:1,key:'patrol-01',kind:'raider',x:1200,y:0,z:1100,hp:0,ad:1,base:{kind:'patrol',id:'patrol-01'}};const pend=J(s.airdrop?.pend||null),drops=s.drops.length;killLoot(s,e,day);
  ok(J(s.airdrop?.pend||null)===pend&&s.drops.length===drops,'allies never multiply points: a kill only allies damaged pays no points, CP, salvage or loot');}
 {const open=RR.ecoGrant.toString(),grants=Bo.storeKinds.every(k=>RR.BAT_KINDS.includes(k))&&RR.BAT_KINDS.length===Bo.storeKinds.length,S=RR.ecoNorm({}),X={day:20000,week:2857};const pts=S.pts;for(const k of RR.BAT_KINDS)RR.ecoGrant(S,{kind:k,tk:'liv-arctic',job:'r1'},X);
  ok(grants&&RR.BAT_STORE_OPEN===false&&S.pts===pts&&!S.bch&&!S.liv&&!S.rcx,'the Battalion store kinds ('+RR.BAT_KINDS.join(', ')+') grant nothing while checkout is off, and never points');
  ok(J(Bo.neverSold)===J(['pilots','ranks','roleCoreLevels'])&&!/\bbat\b|\.rc\[|rcLevel|rank/.test(open),'never sold: pilots, ranks, Role Core levels (no store grant touches them)');}
 {const s=mk();s.bat={p:[{id:'p1',n:'A B',cs:'ANVIL',r:'',xp:0,rk:1,k:0,h:1}],ch:{e:0,d:0,bs:0}};const pend=J(s.airdrop?.pend||null);outcome(s,{friends:[{side:'mine',pid:'p1',kills:2}],time:60},CQ.Combat.operations.rescue,'victory',day);
  ok(J(s.airdrop?.pend||null)===pend&&s.bat.ch.e===1&&s.bat.p.length===2&&J(Bo.noPoints)===J(['chips','recruits','liveries']),'command chips and recruits (and liveries) never award points: a won rescue gave a chip and a recruit, no points');}}
// ---- 9. the owner rules of Nov 25, 2026 (Session 7R brief docs/conquest/audit/SESSION_07R_BRIEF.md): Rule 1 (gameplay quality first)
// and Rule 2 (guardrails, permanent), word for word. Their SHA-256 is pinned HERE, so the rules entry of docs/owner-rules.json cannot be
// edited or dropped alone; every governing file below (pinned here too, not only in the JSON) must hold both texts word for word; and the
// Citadel cooldown is never above the owner's 24-hour absolute maximum. Only the owner can change them ----
{const {createHash}=await import('node:crypto'),sha=t=>createHash('sha256').update(String(t),'utf8').digest('hex');
 const PIN={'gameplay-quality-first':'116374e9610bb105487706bda2a2161387c66e25ab8b7db4ed83188d6866bdf8','guardrails':'7634d8e683499b58b46c63b9ab01c571235364f07985406943ced6cb8eb7f05e','additive':'2e4897b07e1ec1cb5a3ac1a5df6398b4c987468b24a3aad9263bce6aa0d4ccc3'};
 const by=Object.fromEntries((Array.isArray(O.rules)?O.rules:[]).map(r=>[r?.id,r]));
 for(const [id,h] of Object.entries(PIN))ok(by[id]&&by[id].owner==='owner'&&by[id].date==='2026-11-25'&&sha(by[id].text)===h,'owner rule "'+id+'" (owner, Nov 25, 2026) present and unchanged in docs/owner-rules.json');
 const FILES=['CLAUDE.md','AGENTS.md','docs/ROADMAP.md','docs/AI_TOOLCHAIN.md','docs/conquest/CONQUEST_FLAGSHIP_EXECUTION_HANDOFF.md','docs/conquest/CONQUEST_BLUEPRINT.md'],E=O.rulesEnforced||{};
 ok(FILES.every(f=>(E.recordedIn||[]).includes(f)),'docs/owner-rules.json lists every governing file that records the Nov 25 rules');
 for(const f of FILES){const src=fs.existsSync(f)?fs.readFileSync(f,'utf8'):'';
  ok(['gameplay-quality-first','guardrails'].every(id=>by[id]&&sha(by[id].text)===PIN[id]&&src.includes(by[id].text))&&src.includes('no existing owner-approved rule is ever removed or weakened'),f+' holds Rule 1 and Rule 2 (Nov 25, 2026) word for word');}
 const cd=CONQUEST.Citadel.CIT.refortMs;
 ok(Number.isFinite(cd)&&cd>=0&&cd<=86400000&&E.citadelCooldownMaxMs===86400000,'the Citadel cooldown between tiers is '+(cd/36e5)+' h (Rule 1: a matter of hours, 24 h the absolute maximum, or none; never the old seven days)');}
if(fails.length){console.log('FAIL owner-rules: '+fails.length+' of '+(fails.length+passed)+' checks: '+fails.join(' || '));process.exit(1);}
console.log('PASS owner-rules ('+passed+' checks)');
