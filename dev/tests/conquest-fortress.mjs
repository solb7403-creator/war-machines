// Session 7T (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md) decision 4, the fortress, across the seven town sites, in the
// owner's order: (a) the ceiling (hard rule): raid strength stops rising where a fully built town holds every raid without a breach,
// even at the top strength; (b) no dead upgrades (hard rule): every defense upgrade and every garrison gear upgrade raises the hold
// chance or cuts the damage; (c) the regular path holds about 3 of 4 raids decided while away, building ahead holds more, pushing the
// Citadel without building holds fewer; (d) measured and reported: the grinder late in the year, fully built only after well over a
// year, the paying pilot (Session 8's requirement). The model: dev/tools/fortress-model.mjs (real income, builder, raid engine).
import assert from 'node:assert/strict';import {writeFileSync,mkdirSync} from 'node:fs';
const M=await import('../tools/fortress-model.mjs');const {CONQUEST}=await import('../../worker/src/sim.gen.js');const {Plot:P,Raid:RD,Town:TN,War:WR}=CONQUEST;
let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;console.log('PASS '+m);};const out={};const sites=P.SITE_IDS;
// (a) the ceiling: THREAT at the top (every Citadel tier, a five-star general, the portal open, the Grand Offensive surge)
{const w=WR.fresh(0),top=WR.threatOf(w,{g:'hand',t:'town'},{now:1,tiers:9},true).total,L=TN.levelOf(top);let held=0,n=0;const fails=[];
 for(const site of sites){const t=M.fullTown(site),lanes=P.spawnCells(site,10).length;for(let ln=0;ln<lanes;ln++)for(const seed of [3,11]){const R=RD.make(t.plot,seed,{threat:L,lane:ln,units:t.garrison,frames:false,events:false}).run();n++;if(RD.outcomeOf(R)==='held')held++;else fails.push(site+' lane '+ln);}}
 out.ceiling={threat:top,level:L,held,n};ok(top===16&&L===TN.TOWN.cap,'the top strength is THREAT '+top+' -> raid level '+L+' (the cap)');ok(held===n,'(a) a fully built town holds every raid at the top strength without a breach: '+held+'/'+n+' (every site, every lane, 2 seeds)'+(fails.length?' FAILED: '+fails.join(', '):''));}
// (b) no dead upgrades, on a reference town (the plan at CC10, every turret level 3, support level 3, two Armalcolite medium rings,
// a Rare garrison) at a level that tests it (8): each step must hold more raids, or as many with less damage
{const ref=site=>{const pl=M.plan(site),st={cc:10,lv:{storage:3},rings:[{R:18,n:144,code:P.wcode(3,2)},{R:19,n:152,code:P.wcode(3,2)}]};for(const x of pl.sup)st.lv[x.id]=Math.min(3,P.levelCap(x.t,10));for(const x of pl.slots)st.lv[x.id]=3;return st;};
 const gar=(t,q=1,moon=false)=>[0,1,2,3,4].map(i=>RD.unitOf({id:'g'+i,kind:'g',kit:{w:{a:moon&&!i?'moon':'pulse',t,q},c:{c:'titan',t,q}},rk:3}));
 const score=(mk,units=gar(1),L=8)=>{let held=0,lost=0;for(const site of sites){const st=mk(site),p=M.plotOf(site,st);for(const ln of [0,1]){const R=RD.make(p,5+ln,{threat:L,lane:ln,units,damage:true,frames:false,events:false}).run();if(RD.outcomeOf(R)==='held')held++;lost+=Object.values(R.damage||{}).reduce((a,v)=>a+v,0);}}return {held,lost:Math.round(lost)};};
 const better=(a,b)=>b.held>a.held||b.held===a.held&&b.lost<a.lost,dead=[];out.upgrades={};
 for(const T of P.TURRETS){let prev=null;for(let l=1;l<=5;l++){const sc=score(site=>{const st=ref(site);for(const x of M.plan(site).slots)if(x.t===T)st.lv[x.id]=l;return st;});if(prev&&!better(prev,sc))dead.push(T+' '+(l-1)+'->'+l);out.upgrades[T+l]=sc;prev=sc;}}
 const B=[[0,0],...[1,2,3,4,5,6].flatMap(o=>[1,2,3].map(l=>[o,l]))].sort((a,b)=>P.blendQ(a[0],a[1])-P.blendQ(b[0],b[1]));let prevW=null;
 for(const [o,l] of B){const sc=score(site=>{const st=ref(site);for(const g of st.rings)g.code=P.wcode(o,l);return st;});if(prevW&&!better(prevW.sc,sc))dead.push('wall '+P.blendName(prevW.code)+' -> '+P.blendName(P.wcode(o,l)));prevW={sc,code:P.wcode(o,l)};out.upgrades['wall'+o+l]=sc;}
 {let prev=null;for(let l=1;l<=5;l++){const sc=score(site=>{const st=ref(site);for(const x of M.plan(site).sup)if(x.t==='shield')st.lv[x.id]=l;return st;});if(prev&&!better(prev,sc))dead.push('shield '+(l-1)+'->'+l);prev=sc;out.upgrades['shield'+l]=sc;}}
 {const steps=[['militia',gar(0)],['rare',gar(1)],['epic',gar(2)],['epic best roll',gar(2,1.1)],['epic + Moonbeam',gar(2,1.1,true)]];let prev=null;for(const [n,u] of steps){const sc=score(ref,u);if(prev&&!better(prev.sc,sc))dead.push('garrison '+prev.n+' -> '+n);prev={n,sc};out.upgrades['gar '+n]=sc;}}
 ok(!dead.length,'(b) no dead upgrades: every turret level of all 11 types, every wall blend, every Shield Generator level and every garrison gear step holds more raids or takes less damage'+(dead.length?' DEAD: '+dead.join('; '):''));}
// (c) the regular path, and its two variants
{const days=[30,60,120,180,330],rate=(o={})=>days.map(d=>M.holdRate('regular',d,{n:3,...o}).p),r=rate(),mean=r.reduce((a,b)=>a+b,0)/r.length;out.regular={days,p:r,mean};
 ok(mean>=.65&&mean<=.9,'(c) the regular\'s town holds about 3 of 4 raids decided while away along the year: '+r.map((p,i)=>'day '+days[i]+' '+Math.round(p*100)+'%').join(', ')+' (mean '+Math.round(mean*100)+'%)');
 const ahead=[180,330].map(d=>M.holdRate('regular',d,{n:3,share:.7}).p),push=[180,330].map(d=>M.holdRate('regular',d,{n:3,share:.3,citadelX:1.4}).p),base=[r[3],r[4]];out.variants={ahead,base,push};
 ok(ahead.reduce((a,b)=>a+b)>=base.reduce((a,b)=>a+b)&&push.reduce((a,b)=>a+b)<base.reduce((a,b)=>a+b),'building ahead of the Citadel holds more ('+ahead.map(p=>Math.round(p*100)+'%').join(', ')+'); pushing the Citadel without building holds fewer ('+push.map(p=>Math.round(p*100)+'%').join(', ')+')');}
// (d) measured and reported: the grinder late in the year; fully built (the plan at its maximum: Moonheart heavy walls) never inside the year
{const g=[60,180,330].map(d=>M.holdRate('grinder',d,{n:3}).p),pay=[180,330].map(d=>M.holdRate('payer',d,{n:3}).p),gt=M.townAt('grinder','ridge',365),pt=M.townAt('payer','ridge',365);
 const q=t=>{const w=Object.values(t.plot.w);return w.reduce((a,c)=>{const d=P.wdecode(c);return a+P.blendQ(d.o,d.l);},0)/Math.max(1,w.length);};out.grinder={p:g,wallQ365:q(gt)};out.payer={p:pay,wallQ365:q(pt)};
 ok(g[2]>=.8,'(d) the grinder\'s base is very solid late in the year: '+g.map((p,i)=>'day '+[60,180,330][i]+' '+Math.round(p*100)+'%').join(', '));
 ok(q(gt)<1,'(d) the grinder is not fully built after a year (wall strength '+q(gt).toFixed(2)+' of 1: Moonheart is earn-only and rare)');
 out.payerFullWithinYear=q(pt)>=.99;console.log('REPORT (d) the paying pilot at the grinder\'s play time: '+pay.map(p=>Math.round(p*100)+'%').join(', ')+', wall strength '+q(pt).toFixed(2)+' of 1 after a year: '+(out.payerFullWithinYear?'fully built':'NOT fully built: the store sells no rare ore (PROPOSAL for Session 8, ROADMAP row 8)'));}
mkdirSync('docs/conquest/session7t',{recursive:true});writeFileSync('docs/conquest/session7t/fortress-model.json',JSON.stringify(out,null,1)+'\n');
console.log('PASS the fortress (decision 4 a-d): '+pass+' checks');
