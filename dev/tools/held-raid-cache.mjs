// Session 7B STEP 3 (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md): the held-raid reward. Each held UNFOUGHT town raid pays
// 7T's defense cache (ConquestTown.TOWN.cache: 160 CP + 15 alloy + 10 biomass + 2 He-3), which brings the walled 1-hour regular to CC10
// below the Session 6 band. With EVERY Session 7B change on (the Citadel tiers on each profile's pacing: the production bonus +5% a tier
// and the Retaliation; dev/tools/fortress-model.mjs KNOB.cit7b) this measures four options for that cache, in the brief's order:
//   full   the whole cache;  half   half of it;  noCP   its alloy, biomass and He-3 without the CP;  none   nothing,
// on (1) the walled regular's CC10 day: the town-ladder guard's 101-pilot panel (dev/tests/conquest-ladder-check.mjs's seeds) on the
// fortress model's ladder with town attacks on and the coach's ring (fortress-model.mjs ladderRun: the real Worker reducers, every raid
// decided unfought), median and mean, against the band 25.9-31.7 (the audit's day 28.8 +-10%); and (2) the 2-hour heavy player's late
// fortress (days 300, 330, 365; the Selenite tool's method: dev/tools/selenite-candidates.mjs, 8 raids a site and day on its two seed
// sets; 88.1% before this session). The first option in that order that keeps both is the one to ship. Deterministic and read-only.
// usage: node dev/tools/held-raid-cache.mjs [--pilots 101] [--par 4]       writes docs/conquest/session7b/held-raid-cache.json
import {spawn} from 'node:child_process';import {writeFileSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;},SEED=k=>(1000+k)*7919,LATE=[300,330,365],N=8,SETS=[0,500];
export const OPTIONS=Object.freeze([['full',{cp:1,mat:1}],['half',{cp:.5,mat:.5}],['noCP',{cp:0,mat:1}],['none',{cp:0,mat:0}]]);
export const BAND=Object.freeze([25.9,31.7]);
if(process.argv.includes('--one')){const v=JSON.parse(arg('--one','{}')),M=await import('./fortress-model.mjs'),{CONQUEST}=await import('../../worker/src/sim.gen.js'),P=CONQUEST.Plot;
 M.KNOB.cit7b=v.cit7b!==false;M.KNOB.heldCache=v.cache;
 if(v.kind==='ladder'){const out=[];for(let k=v.from;k<v.to;k++){const r=M.ladderRun(SEED(k),{raids:v.raids!==false,coach:v.coach!==false,cacheX:v.cache});out.push({k,cc10:r.cc10,held:r.raids.held,breached:r.raids.breached,fallen:r.raids.fallen,repairCP:r.repair.cp});}
  process.stdout.write(JSON.stringify(out)+'\n');}
 else{const off=v.off;let held=0,all=0;const byDay=[];for(const d of LATE){let h=0,a=0;for(const site of P.SITE_IDS){const t=M.townAt('heavy',site,d),rs=M.raidSet(M.PROFILES.heavy,d,N,{seed:site.length+off});
   for(const [i,r] of rs.entries()){a++;if(M.raid(t,r,site,1000+off*7+i).o==='held')h++;}}held+=h;all+=a;byDay.push(Math.round(h/a*1000)/10);}
  process.stdout.write(JSON.stringify({off,late:Math.round(held/all*1000)/10,byDay})+'\n');}}
else{const me=fileURLToPath(import.meta.url),pilots=Number(arg('--pilots',101)),par=Math.max(1,Math.min(8,Number(arg('--par',4)))),chunk=Math.ceil(pilots/par);
 const run=v=>new Promise((ok,no)=>{const c=spawn(process.execPath,[me,'--one',JSON.stringify(v)]);let o='';c.stdout.on('data',d=>o+=d);c.stderr.pipe(process.stderr);c.on('close',k=>k?no(Error('exit '+k)):ok(JSON.parse(o.trim().split('\n').pop())));});
 const jobs=[];const variants=[...OPTIONS.map(([name,cache])=>({name,cache})),{name:'noRaids',cache:{cp:1,mat:1},raids:false},{name:'full, 7B off',cache:{cp:1,mat:1},cit7b:false}];
 for(const v of variants){for(let f=1;f<=pilots;f+=chunk)jobs.push({key:v.name,v:{kind:'ladder',cache:v.cache,raids:v.raids,cit7b:v.cit7b,from:f,to:Math.min(pilots+1,f+chunk)}});
  if(v.raids!==false)for(const off of SETS)jobs.push({key:v.name,v:{kind:'late',cache:v.cache,cit7b:v.cit7b,off}});}
 const res={},queue=[...jobs];await Promise.all(Array.from({length:par},async()=>{while(queue.length){const j=queue.shift(),r=await run(j.v);(res[j.key]=res[j.key]||{ladder:[],late:[]})[j.v.kind==='ladder'?'ladder':'late'].push(...(Array.isArray(r)?r:[r]));}}));
 const med=a=>{const b=[...a].sort((x,y)=>x-y);return b[b.length>>1];},avg=a=>Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10,inside=x=>x>=BAND[0]&&x<=BAND[1],summary={};
 for(const v of variants){const r=res[v.name],cc=r.ladder.sort((a,b)=>a.k-b.k).map(x=>x.cc10??200),late=r.late.sort((a,b)=>a.off-b.off);
  summary[v.name]={cache:v.cache,citadel7B:v.cit7b!==false,raids:v.raids!==false,CC10:{median:med(cc),mean:avg(cc),inBand:inside(med(cc))&&inside(avg(cc))},raids:{held:avg(r.ladder.map(x=>x.held)),breached:avg(r.ladder.map(x=>x.breached)),fallen:avg(r.ladder.map(x=>x.fallen))},
   repairCP:Math.round(avg(r.ladder.map(x=>x.repairCP))),...(late.length?{heavyLate:{mean:Math.round(late.reduce((a,x)=>a+x.late,0)/late.length*10)/10,sets:late}}:{})};}
 const pick=OPTIONS.map(([n])=>n).find(n=>summary[n].CC10.inBand&&Math.abs(summary[n].heavyLate.mean-90)<=5)||null;
 const out={about:'Session 7B STEP 3: the held unfought raid\'s defense cache, four options with every 7B change on (fortress-model ladderRun, '+pilots+' pilots, the coach\'s ring, 60 min a day; the heavy player\'s late fortress, days '+LATE.join('/')+', 8 raids a site and day, two seed sets)',band:BAND,order:OPTIONS.map(([n])=>n),pick,summary};
 mkdirSync('docs/conquest/session7b',{recursive:true});writeFileSync('docs/conquest/session7b/held-raid-cache.json',JSON.stringify(out,null,1)+'\n');
 for(const [n,s] of Object.entries(summary))console.log(n.padEnd(14),'CC10 median',s.CC10.median,'mean',s.CC10.mean,s.CC10.inBand?'(in band)':'(outside '+BAND.join('-')+')','· raids held/breached/fallen',s.raids.held,s.raids.breached,s.raids.fallen,s.heavyLate?'· heavy late '+s.heavyLate.mean+'% ('+s.heavyLate.sets.map(x=>x.late).join(' / ')+')':'');
 console.log('ship:',pick||'none of the four passes both');}
