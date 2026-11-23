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
{const w=WR.fresh(0),top=WR.threatOf(w,{g:'hand',t:'town'},{now:1,tiers:9},true).total,L=TN.levelOf(top);let held=0,n=0,lostAny=0,minCore=100,bill=0;const fails=[];
 for(const site of sites){const t=M.fullTown(site),lanes=P.spawnCells(site,10).length;for(let ln=0;ln<lanes;ln++)for(const seed of [3,11]){const R=RD.make(t.plot,seed,{threat:L,lane:ln,units:t.garrison,frames:false,events:false,damage:true}).run();n++;if(RD.outcomeOf(R)==='held')held++;else fails.push(site+' lane '+ln);
  if((R.fell||[]).length)lostAny++;minCore=Math.min(minCore,R.core);const q={...t.plot,dmg:{}};P.applyRaidDamage(q,R,0,'x');const b=P.repairPlan(q).cost;bill+=(b.cp||0)+(b.alloy||0)*3+(b.cm||0)*2;}}
 out.ceiling={threat:top,level:L,held,n,lostAny,minCore,bill:Math.round(bill/n)};console.log('REPORT (a) breach = a vital lost or 3+ buildings wrecked (raid.js outcomeOf; walls and homes never count): at the cap the fully built town still loses a building in '+lostAny+' of '+n+' raids, its Command Center is never below '+minCore+'%, and a raid leaves about '+Math.round(bill/n)+' CP-equivalent of REPAIR (CP + 3 a unit of alloy + 2 a unit of composite)');ok(top===16&&L===TN.TOWN.cap,'the top strength is THREAT '+top+' -> raid level '+L+' (the cap)');ok(held===n,'(a) a fully built town holds every raid at the top strength without a breach: '+held+'/'+n+' (every site, every lane, 2 seeds)'+(fails.length?' FAILED: '+fails.join(', '):''));}
// (b) no dead upgrades (hard rule): on a reference town (the plan at CC10: every turret level III, support level III with the Reactors at
// their cap so no single step runs short of power, the plan's first 8 wall segments (about 1,000 cells, a realistic belt: the regular's
// town carries 2,600) in Armalcolite medium, a Rare garrison) at the cap's level, every step of every turret type, every wall upgrade
// (a heavier blend of one ore, the next ore at the same blend, Composite to each ore), every Shield Generator level and every garrison
// gear step must hold more raids or cut the damage, and never add to the town's loss. Paired over every site, lane and seed (the same
// raids before and after): loss = 1 a breach (2 a fall) + each building's share of HP lost; walls destroyed counted apart (the walls
// are the consumable). Raiders weigh turrets by the layout, not their levels (js/conquest/raid.js), so an upgrade never moves the path.
{const SEEDS=Number(process.env.FORTRESS_SEEDS||4),L=TN.TOWN.cap;
 const ref=site=>{const pl=M.plan(site),st={cc:10,lv:{storage:3},rings:Array.from({length:Math.min(8,pl.walls.length)},(_,s)=>({s,n:pl.walls[s].length,code:P.wcode(3,2)}))};for(const x of pl.sup)st.lv[x.id]=x.t==='reactor'?P.levelCap('reactor',10):Math.min(3,P.levelCap(x.t,10));for(const x of pl.slots)st.lv[x.id]=3;return st;};
 const gar=(t,q=1,moon=false)=>[0,1,2,3,4].map(i=>RD.unitOf({id:'g'+i,kind:'g',kit:{w:{a:moon&&!i?'moon':'pulse',t,q},c:{c:'titan',t,q}},rk:3}));
 // the raids of a town, by seed (an inconclusive step is measured again with more seeds: 8, then 16 a lane)
 const memo=new Map(),score=(key,mk,units=gar(1),n=SEEDS)=>{const have=memo.get(key);if(have&&have.n>=n)return have.r.filter(x=>x.sd<=n);const from=have?have.n+1:1,out=have?have.r:[];for(const site of sites){const p=M.plotOf(site,mk(site)),lanes=P.spawnCells(site,10).length;
   for(let ln=0;ln<lanes;ln++)for(let sd=from;sd<=n;sd++){const R=RD.make(p,sd*101+ln*7,{threat:L,lane:ln,units,damage:true,frames:false,events:false}).run();let bd=0;for(const [id,v] of Object.entries(R.damage||{})){if(id.startsWith('w:'))continue;const m=P.maxHpOf(p,id);if(m)bd+=Math.min(1,v/m);}const o=RD.outcomeOf(R);out.push({site,ln,sd,h:o==='held'?1:0,loss:(o==='fallen'?2:o==='breached'?1:0)+bd,wl:R.wallsLost|0});}}out.sort((a,b)=>a.site.localeCompare(b.site)||a.ln-b.ln||a.sd-b.sd);memo.set(key,{n,r:out});return out;};
 const mean=(a,b,k)=>a.reduce((x,r,i)=>x+b[i][k]-r[k],0)/a.length,dead=[],steps={};
 // a step passes when it never adds to the loss and holds more, cuts the loss or loses fewer walls; inconclusive, it is measured again
 const judge=(a,b)=>{const dl=mean(a,b,'loss'),dw=mean(a,b,'wl'),dh=b.reduce((x,r)=>x+r.h,0)-a.reduce((x,r)=>x+r.h,0);return {held:dh,loss:Math.round(dl*1000)/1000,walls:Math.round(dw*100)/100,raids:a.length,ok:dl<=0&&(dh>0||dl<0||dw<0)};};
 const steps_=[];const step=(name,ka,ma,ua,kb,mb,ub)=>steps_.push({name,ka,ma,ua,kb,mb,ub});
 for(const T of P.TURRETS){const mk=l=>site=>{const st=ref(site);for(const x of M.plan(site).slots)if(x.t===T)st.lv[x.id]=l;return st;},key=l=>l===3?'ref':T+l;for(let l=2;l<=5;l++)step(T+' '+(l-1)+'->'+l,key(l-1),mk(l-1),null,key(l),mk(l),null);}
 const wk=(o,l)=>o===3&&l===2?'ref':'w'+o+l,wm=(o,l)=>site=>{const st=ref(site);for(const g of st.rings)g.code=P.wcode(o,l);return st;},bn=(o,l)=>P.blendName(P.wcode(o,l)),ws=(name,o1,l1,o2,l2)=>step(name,wk(o1,l1),wm(o1,l1),null,wk(o2,l2),wm(o2,l2),null);
 for(let o=1;o<=6;o++)ws('wall Composite -> '+bn(o,1),0,0,o,1);
 for(let o=1;o<=6;o++)for(let l=2;l<=3;l++)ws('wall '+bn(o,l-1)+' -> '+bn(o,l),o,l-1,o,l);
 for(let o=2;o<=6;o++)for(let l=1;l<=3;l++)ws('wall '+bn(o-1,l)+' -> '+bn(o,l),o-1,l,o,l);
 {const mk=l=>site=>{const st=ref(site);for(const x of M.plan(site).sup)if(x.t==='shield')st.lv[x.id]=l;return st;},key=l=>l===3?'ref':'sh'+l;for(let l=2;l<=5;l++)step('shield '+(l-1)+'->'+l,key(l-1),mk(l-1),null,key(l),mk(l),null);}
 {const g=[['militia',gar(0)],['rare',gar(1)],['epic',gar(2)],['epic best roll',gar(2,1.1)],['epic + Moonbeam',gar(2,1.1,true)]],key=n=>n==='rare'?'ref':'g'+n;for(let i=1;i<g.length;i++)step('garrison '+g[i-1][0]+' -> '+g[i][0],key(g[i-1][0]),ref,g[i-1][1],key(g[i][0]),ref,g[i][1]);}
 for(const x of steps_){let r;for(const n of [SEEDS,8,16]){if(n<SEEDS)continue;r=judge(score(x.ka,x.ma,x.ua||gar(1),n),score(x.kb,x.mb,x.ub||gar(1),n));if(r.ok)break;}const {ok:pass,...rest}=r;steps[x.name]=rest;if(!pass)dead.push(x.name+' ('+JSON.stringify(rest)+')');}
 out.upgrades={level:L,seeds:SEEDS,raids:score('ref',ref).length,steps};
 ok(!dead.length,'(b) no dead upgrades: all '+Object.keys(steps).length+' steps (every level of the 11 turret types, every wall upgrade, every Shield Generator level, every garrison gear step) hold more raids or cut the damage, never adding to the loss, over '+score('ref',ref).length+' or more paired raids each (an inconclusive step measured again with up to 16 seeds a lane)'+(dead.length?' DEAD: '+dead.join('; '):''));}
// (c) the regular path, and its two variants
// from the first raids (a new town is safe for 3 days; before any Citadel tier THREAT is 1-4) through the year
{const days=[5,8,14,30,60,120,180,330],rate=(o={})=>days.map(d=>M.holdRate('regular',d,{n:3,...o}).p),r=rate(),mean=r.reduce((a,b)=>a+b,0)/r.length;out.regular={days,p:r,mean};
 ok(mean>=.65&&mean<=.9,'(c) the regular\'s town holds about 3 of 4 raids decided while away along the year: '+r.map((p,i)=>'day '+days[i]+' '+Math.round(p*100)+'%').join(', ')+' (mean '+Math.round(mean*100)+'%)');
 ok((r[1]+r[2])/2>=.65,'the first raids are winnable: from the second week the young town holds '+Math.round((r[1]+r[2])/2*100)+'% (days 8 and 14)');
 // days 60-180, before the raids reach the top strength (from then on every town meets the same level 9 and the walls' rare ore decides)
 const vd=[60,120,180],ahead=vd.map(d=>M.holdRate('regular',d,{n:3,share:.7}).p),push=vd.map(d=>M.holdRate('regular',d,{n:3,share:.3,citadelX:1.4}).p),base=[r[4],r[5],r[6]],sum=a=>a.reduce((x,y)=>x+y,0);out.variants={days:vd,ahead,base,push};
 ok(sum(ahead)>sum(base)&&sum(push)<sum(base),'building ahead of the Citadel holds more ('+ahead.map(p=>Math.round(p*100)+'%').join(', ')+'); pushing the Citadel without building holds fewer ('+push.map(p=>Math.round(p*100)+'%').join(', ')+')');}
// (d) measured and reported: the grinder late in the year; fully built (the plan at its maximum: Moonheart heavy walls) never inside the year
{const g=[60,180,330].map(d=>M.holdRate('grinder',d,{n:3}).p),pay=[180,330].map(d=>M.holdRate('payer',d,{n:3}).p),gt=M.townAt('grinder','ridge',365),pt=M.townAt('payer','ridge',365);
 const q=t=>{const w=Object.values(t.plot.w);return w.reduce((a,c)=>{const d=P.wdecode(c);return a+P.blendQ(d.o,d.l);},0)/Math.max(1,w.length);};out.grinder={p:g,wallQ365:q(gt)};out.payer={p:pay,wallQ365:q(pt)};
 const rg=[60,180,330].map(d=>M.holdRate('regular',d,{n:3}).p);out.grinder.regular=rg;
 // at the same strength: late in the year both meet the top THREAT (earlier the grinder has cleared the Citadel and meets stronger raids)
 ok(g[2]>rg[2],'(d) more play builds a stronger town: at the top strength (day 330) the grinder holds '+Math.round(g[2]*100)+'%, the regular '+Math.round(rg[2]*100)+'% (by day: the grinder '+g.map((p,i)=>'day '+[60,180,330][i]+' '+Math.round(p*100)+'%').join(', ')+'; the regular '+rg.map(p=>Math.round(p*100)+'%').join(', ')+')');
 console.log('REPORT (d) the owner\'s target for the grinder is about 9 of 10 late in the year: measured '+Math.round(g[2]*100)+'% at day 330 with the cap-level Selenite (Session 7T-P decision 2; 81% before it; 56 raids a day on two seed sets: dev/tools/selenite-candidates.mjs)');
 ok(q(gt)<1,'(d) the grinder is not fully built after a year (wall strength '+q(gt).toFixed(2)+' of 1: Moonheart is earn-only and rare)');
 out.payerFullWithinYear=q(pt)>=.99;console.log('REPORT (d) the paying pilot at the grinder\'s play time: '+pay.map(p=>Math.round(p*100)+'%').join(', ')+', wall strength '+q(pt).toFixed(2)+' of 1 after a year: '+(out.payerFullWithinYear?'fully built':'NOT fully built: the store sells no rare ore (PROPOSAL for Session 8, ROADMAP row 8)'));}
// (e) Session 7T-P decision 2 (owner, Nov 23; the addendum: the target is the 2-hour heavy player): Selenite for the late fortress. A raid
// at the cap level held in person drops ConquestTown.TOWN.se.n Selenite. With it the heavy player holds more late in the year (days 300,
// 330, 365) than the 7T economy (the grinder reported), and the regular's hold rates stay within 5 points of the 7T economy's at every
// measured day (the regular meets the cap level only from about day 320). The 56-raid measurement: dev/tools/selenite-candidates.mjs.
{const late=[300,330,365],days=[5,8,14,30,60,120,180,330],mean=a=>a.reduce((x,y)=>x+y,0)/a.length,on=late.map(d=>M.holdRate('heavy',d,{n:3}).p),off=late.map(d=>M.holdRate('heavy',d,{n:3,se:false}).p);
 const gOn=late.map(d=>M.holdRate('grinder',d,{n:3}).p),gOff=late.map(d=>M.holdRate('grinder',d,{n:3,se:false}).p);
 const rOn=out.regular.p,rOff=days.map(d=>M.holdRate('regular',d,{n:3,se:false}).p),shift=Math.max(...rOn.map((x,i)=>Math.abs(x-rOff[i])));out.selenite={rule:TN.TOWN.se,late,heavy:on,heavy7T:off,grinder:gOn,grinder7T:gOff,regular7T:rOff,regularMaxShift:shift};
 ok(TN.seOf(TN.TOWN.cap)===8&&TN.seOf(TN.TOWN.cap-1)===0,'(e) the rule: '+TN.TOWN.se.n+' Selenite for a raid at the cap level ('+TN.TOWN.se.from+') held in person, none below it (8: the owner\'s addendum)');
 ok(mean(on)>mean(off),'(e) Selenite for the late fortress: the 2-hour heavy player holds '+Math.round(mean(on)*100)+'% late in the year (days '+late.join(', ')+': '+on.map(p=>Math.round(p*100)+'%').join(', ')+') against '+Math.round(mean(off)*100)+'% without it');
 console.log('REPORT (e) the grinder (4 h a day): '+Math.round(mean(gOn)*100)+'% late in the year with the cap-level Selenite ('+gOn.map(p=>Math.round(p*100)+'%').join(', ')+') against '+Math.round(mean(gOff)*100)+'% without it');
 ok(shift<=.05,'(e) the regular\'s hold rates stay within 5 points of the 7T economy\'s at every measured day (largest change '+Math.round(shift*1000)/10+' points: '+rOn.map((p,i)=>'day '+days[i]+' '+Math.round(p*100)+'/'+Math.round(rOff[i]*100)).join(', ')+')');}
// (f) Session 7T-P decision 3 (owner, Nov 23): the town coach's ring step (close a first wall ring before CC4; its SUGGEST A RING drafts an
// inner ring and, when the composite allows, an outer one), re-measured on the way to CC10 with town attacks on (the Nov 10 brief's 5%
// guard method: the audit's 60-minute regular on the real Worker reducers, every raid decided unfought, REPAIR paid when the town is
// damaged; fortress-model.mjs ladderRun). 7T's undefended builder paid about 111,000 CP of REPAIR and took twice as long to CC10.
// The 101-pilot panels and the PROPOSAL variants: dev/tools/coach-ring-repairs.mjs (docs/conquest/session7tp/coach-repairs.json).
{const run=(o,n,sites)=>Array.from({length:n},(_,k)=>M.ladderRun((1001+k)*7919,{...o,site:sites?sites[k%sites.length]:'crater'})),med=a=>{const b=[...a].sort((x,y)=>x-y);return b[b.length>>1];},avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
 const N=Number(process.env.FORTRESS_PILOTS||21),none=run({raids:false},N),open=run({},N),coached=run({coach:true},N),all7=run({coach:true},N,sites);
 const cc=r=>r.map(x=>x.cc10??200),rep=r=>avg(r.map(x=>x.repair.cp));out.coach={pilots:N,noRaids:{CC10:med(cc(none))},undefended:{CC10:med(cc(open)),repairCP:Math.round(rep(open))},coached:{CC10:med(cc(coached)),repairCP:Math.round(rep(coached))},coached7:{CC10:med(cc(all7)),repairCP:Math.round(rep(all7))}};
 ok(coached.every(r=>r.ring.closedAt!==null&&r.ring.closedAt<=(r.hit.CC4??Infinity))&&all7.every(r=>r.ring.closedAt!==null&&r.ring.closedAt<=(r.hit.CC4??Infinity)),'(f) every coached pilot closes the first wall ring before CC4 ('+N+' on CRATER RIM, '+N+' across the seven sites, ICE BASIN by its sealed shore)');
 ok(rep(coached)<=.05*rep(open)&&rep(all7)<=.05*rep(open),'(f) REPAIR on the way to CC10 falls from '+Math.round(rep(open))+' CP (undefended) to '+Math.round(rep(coached))+' CP with the coach\'s ring ('+Math.round(rep(all7))+' CP across the seven sites)');
 ok(med(cc(coached))<=med(cc(none))&&med(cc(all7))<=med(cc(none)),'(f) CC10 is no longer delayed: median day '+med(cc(coached))+' coached (7 sites '+med(cc(all7))+') against '+med(cc(none))+' with no town attacks and '+med(cc(open))+' undefended');
 console.log('REPORT (f) the coached pilot reaches CC10 sooner than with no town attacks (median day '+med(cc(coached))+' against '+med(cc(none))+'): its town holds its raids and each held raid pays 7T\'s defense cache (PROPOSAL in Checkpoint 48)');}
mkdirSync('docs/conquest/session7t',{recursive:true});writeFileSync('docs/conquest/session7t/fortress-model.json',JSON.stringify(out,null,1)+'\n');
console.log('PASS the fortress (decision 4 a-d): '+pass+' checks');
