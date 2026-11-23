// Session 7T-P decision 2 (owner brief docs/conquest/audit/SESSION_07TP_BRIEF.md): the two Selenite candidates for the late fortress,
// measured with the fortress model (dev/tools/fortress-model.mjs: the real income, builder and raid engine) and the economy model's
// mineral formula. Deterministic and read-only. Each candidate runs in its own process (the model caches its towns):
//   base  the Session 7T economy (no town-defense Selenite, Strike Resonance every 12 strikes);
//   A     Strike Resonance for Selenite every 8 strikes instead of 12 (STRIKE.resonance.se);
//   B     the shipped rule: n Selenite for a raid at the cap level held in person (ConquestTown.TOWN.se).
// Two raid seed sets (the fortress test's own seeds, and a second set) with 8 raids a site and day (56 a day) so a one-raid change is
// 1.8 points, not the CI test's 4.8. The rule (brief decision 2): ship the candidate that brings the grinder closest to about 9 of 10
// late in the year (days 300, 330, 365) while the regular's hold rates stay within 5 points of today's at every measured day.
// usage: node dev/tools/selenite-candidates.mjs [--n 8]           all candidates, both seed sets (about 6 minutes on 4 cores)
//        node dev/tools/selenite-candidates.mjs --one B --off 500  one candidate, one seed set (prints JSON)
import {spawn} from 'node:child_process';import {writeFileSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;},n=Number(arg('--n',8)),REG=[5,8,14,30,60,120,180,330],GR=[60,180,300,330,365];
if(process.argv.includes('--one')){const cand=arg('--one','B'),off=Number(arg('--off',0));const M=await import('./fortress-model.mjs');const {CONQUEST}=await import('../../worker/src/sim.gen.js');const P=CONQUEST.Plot;
 if(cand!=='B')M.KNOB.noTownSe=true;if(cand==='A')M.KNOB.resonanceSe=8;
 const rate=(prName,d)=>{if(!off)return M.holdRate(prName,d,{n}).p;let held=0,all=0;for(const site of P.SITE_IDS){const t=M.townAt(prName,site,d),rs=M.raidSet(M.PROFILES[prName],d,n,{seed:site.length+off});for(const [i,r] of rs.entries()){all++;if(M.raid(t,r,site,1000+off*7+i).o==='held')held++;}}return held/all;};
 const q=t=>{const w=Object.values(t.plot.w);return w.reduce((a,c)=>{const x=P.wdecode(c);return a+P.blendQ(x.o,x.l);},0)/Math.max(1,w.length);};
 const se=pr=>{let a=0;for(let d=0;d<365;d++)a+=M.minerals(M.PROFILES[pr],d).se;return Math.round(a);};
 const out={cand,off,n,regular:REG.map(d=>rate('regular',d)),grinder:GR.map(d=>rate('grinder',d)),payer:[180,330].map(d=>rate('payer',d)),
  wallQ:{regular330:q(M.townAt('regular','ridge',330)),grinder330:q(M.townAt('grinder','ridge',330)),grinder365:q(M.townAt('grinder','ridge',365)),payer365:q(M.townAt('payer','ridge',365))},seYear:{regular:se('regular'),grinder:se('grinder'),payer:se('payer')}};
 process.stdout.write(JSON.stringify(out)+'\n');}
else{const me=fileURLToPath(import.meta.url),jobs=[];for(const off of [0,500])for(const cand of ['base','A','B'])jobs.push({cand,off});
 const run=j=>new Promise((ok,no)=>{const c=spawn(process.execPath,[me,'--one',j.cand,'--off',String(j.off),'--n',String(n)]);let o='';c.stdout.on('data',d=>o+=d);c.stderr.pipe(process.stderr);c.on('close',k=>k?no(Error(j.cand+' exit '+k)):ok(JSON.parse(o.trim().split('\n').pop())));});
 const res=[],queue=[...jobs],lanes=Math.max(1,Math.min(4,Number(arg('--par',3))));await Promise.all(Array.from({length:lanes},async()=>{while(queue.length){const j=queue.shift();res.push(await run(j));}}));
 const get=(c,o)=>res.find(r=>r.cand===c&&r.off===o),pct=x=>Math.round(x*1000)/10,late=r=>(r.grinder[2]+r.grinder[3]+r.grinder[4])/3,summary={};
 for(const c of ['base','A','B']){const s=[0,500].map(o=>{const r=get(c,o),b=get('base',o);return {seeds:o?'second set':'the fortress test\'s',grinderLate:pct(late(r)),grinderByDay:Object.fromEntries(GR.map((d,i)=>[d,pct(r.grinder[i])])),
  regularByDay:Object.fromEntries(REG.map((d,i)=>[d,pct(r.regular[i])])),regularMaxShift:Math.round(Math.max(...r.regular.map((x,i)=>Math.abs(x-b.regular[i])))*1000)/10,regularMean:pct(r.regular.reduce((a,x)=>a+x,0)/REG.length),payer:Object.fromEntries([180,330].map((d,i)=>[d,pct(r.payer[i])])),wallQ:r.wallQ,seYear:r.seYear};});
  summary[c]={sets:s,grinderLate:Math.round((s[0].grinderLate+s[1].grinderLate)/2*10)/10,regularMaxShift:Math.max(s[0].regularMaxShift,s[1].regularMaxShift)};}
 const ok=c=>summary[c].regularMaxShift<=5,pick=['A','B'].filter(ok).sort((a,b)=>Math.abs(summary[a].grinderLate-90)-Math.abs(summary[b].grinderLate-90))[0]||null;
 const out={about:'Session 7T-P decision 2: the Selenite candidates (dev/tools/selenite-candidates.mjs, '+n+' raids a site and day, two seed sets)',rule:'closest to 90% late (days 300/330/365) with the regular within 5 points of base at every measured day',summary,choice:pick&&summary[pick].grinderLate>summary.base.grinderLate?pick:'neither'};
 mkdirSync('docs/conquest/session7tp',{recursive:true});writeFileSync('docs/conquest/session7tp/selenite-candidates.json',JSON.stringify(out,null,1)+'\n');
 for(const c of ['base','A','B'])console.log(c,'grinder late',summary[c].grinderLate+'%','('+summary[c].sets.map(x=>x.grinderLate).join(' / ')+')','regular max shift',summary[c].regularMaxShift,'points');console.log('choice:',out.choice);}
