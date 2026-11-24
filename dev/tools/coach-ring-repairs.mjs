// Session 7T-P decision 3 (owner brief docs/conquest/audit/SESSION_07TP_BRIEF.md): REPAIR on the way to CC10 after the town coach's
// ring step, re-measured with the fortress model (dev/tools/fortress-model.mjs ladderRun: the audit's town ladder on the real Worker
// reducers with the town clock running, every raid decided unfought, REPAIR paid whenever the town is damaged). Deterministic and
// read-only. The panel is the town-ladder guard's own (dev/tests/conquest-ladder-check.mjs: 101 pilot seeds, CRATER RIM), plus a
// panel across the seven sites for the coach's ring (Ice Basin needs a RECT: walls cannot stand on ice).
//   noRaids     the same pilot with town attacks held off by a standing shield (Session 7's war runs in every variant);
//   undefended  Session 7T's guard measurement: town attacks on, REPAIR paid, no walls (7T: about 111,000 CP, CC10 twice as long);
//   coached     the same pilot following the coach's step 4 with its SUGGEST A RING (the inner ring and, when the composite allows, an
//               outer one: ConquestTown.ringPlan), before CC4;
//   one ring    a pilot who closes only the first ring by hand; xK: with a model-only REPAIR price factor K on town-raid damage (the
//               PROPOSAL's exact price; the game is unchanged);
//   cache xK    the coached pilot with a model-only factor K on the held unfought raid's defense cache (7T decision 5: 160 CP + 15 alloy +
//               10 biomass + 2 He-3; the PROPOSAL's number; the game is unchanged).
// usage: node dev/tools/coach-ring-repairs.mjs [--pilots 101] [--par 4]
import {spawn} from 'node:child_process';import {writeFileSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;},SEED=k=>(1000+k)*7919;
if(process.argv.includes('--one')){const M=await import('./fortress-model.mjs'),{CONQUEST}=await import('../../worker/src/sim.gen.js'),SITES7=CONQUEST.Plot.SITE_IDS,v=JSON.parse(arg('--one','{}')),out=[];
 for(let k=Number(v.from);k<Number(v.to);k++){const r=M.ladderRun(SEED(k),{raids:v.raids!==false,coach:v.coach==='single'?'single':!!v.coach,repairX:v.x??1,cacheX:v.cx??1,site:v.site||(v.sites?SITES7[k%7]:'crater')});out.push({k,cc10:r.cc10,cc5:r.hit.CC5??null,cc4:r.hit.CC4??null,rep:r.repair,raids:r.raids,ring:r.ring});}
 process.stdout.write(JSON.stringify(out)+'\n');}
else{const me=fileURLToPath(import.meta.url),pilots=Number(arg('--pilots',101)),par=Math.max(1,Math.min(8,Number(arg('--par',4)))),chunk=Math.ceil(pilots/par);
 const VARIANTS=[['noRaids',{raids:false}],['undefended',{}],['coached',{coach:true}],['one ring by hand',{coach:'single'}],['one ring x0.5',{coach:'single',x:.5}],['one ring x0.25',{coach:'single',x:.25}],['coached, cache x0.5',{coach:true,cx:.5}],['coached, cache x0',{coach:true,cx:0}],
  ['noRaids, 7 sites',{raids:false,sites:1}],['undefended, 7 sites',{sites:1}],['coached, 7 sites',{coach:true,sites:1}],['one ring by hand, 7 sites',{coach:'single',sites:1}]];
 const run=v=>new Promise((ok,no)=>{const c=spawn(process.execPath,[me,'--one',JSON.stringify(v)]);let o='';c.stdout.on('data',d=>o+=d);c.stderr.pipe(process.stderr);c.on('close',k=>k?no(Error('exit '+k)):ok(JSON.parse(o.trim().split('\n').pop())));});
 const jobs=[];for(const [name,v] of VARIANTS)for(let f=1;f<=pilots;f+=chunk)jobs.push({name,v:{...v,from:f,to:Math.min(pilots+1,f+chunk)}});
 const res={},queue=[...jobs];await Promise.all(Array.from({length:par},async()=>{while(queue.length){const j=queue.shift();(res[j.name]=res[j.name]||[]).push(...await run(j.v));}}));
 const med=a=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[b.length>>1]:null;},avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10:null,summary={};
 for(const [name] of VARIANTS){const rs=(res[name]||[]).sort((a,b)=>a.k-b.k),cc=rs.map(r=>r.cc10??200),cp=rs.map(r=>r.rep.cp);
  summary[name]={pilots:rs.length,CC10:{median:med(cc),mean:avg(cc),fastMode:rs.filter(r=>(r.cc10??200)<24).length,neverIn200Days:rs.filter(r=>r.cc10===null).length},repairCP:{median:med(cp),mean:Math.round(avg(cp))},repairs:{median:med(rs.map(r=>r.rep.n)),mean:avg(rs.map(r=>r.rep.n))},
   repairAlloy:{mean:Math.round(avg(rs.map(r=>r.rep.alloy)))},repairComposite:{mean:Math.round(avg(rs.map(r=>r.rep.cm)))},raids:{held:avg(rs.map(r=>r.raids.held)),breached:avg(rs.map(r=>r.raids.breached)),fallen:avg(rs.map(r=>r.raids.fallen))},
   ring:{closedBeforeCC4:rs.filter(r=>r.ring.closedAt!==null&&(r.cc4===null||r.ring.closedAt<=r.cc4)).length,meanClosedDay:avg(rs.filter(r=>r.ring.closedAt!==null).map(r=>r.ring.closedAt)),meanCells:avg(rs.map(r=>r.ring.cells))}};}
 const base=summary.noRaids.CC10,band=x=>Math.round((x/base.median-1)*1000)/10;
 for(const s of Object.values(summary))s.CC10.vsNoRaids={median:band(s.CC10.median),mean:Math.round((s.CC10.mean/summary.noRaids.CC10.mean-1)*1000)/10};
 const out={about:'Session 7T-P decision 3: REPAIR on the way to CC10 with town attacks on (fortress-model ladderRun; '+pilots+' pilots; 60 min a day; every raid decided unfought; REPAIR paid when damaged)',summary};
 mkdirSync('docs/conquest/session7tp',{recursive:true});writeFileSync('docs/conquest/session7tp/coach-repairs.json',JSON.stringify(out,null,1)+'\n');
 for(const [name,s] of Object.entries(summary))console.log(name.padEnd(22),'CC10 median',s.CC10.median,'('+(s.CC10.vsNoRaids.median>0?'+':'')+s.CC10.vsNoRaids.median+'%) mean',s.CC10.mean,'('+(s.CC10.vsNoRaids.mean>0?'+':'')+s.CC10.vsNoRaids.mean+'%) · REPAIR CP mean',s.repairCP.mean,'in',s.repairs.mean,'repairs · raids held/breached/fallen',s.raids.held,s.raids.breached,s.raids.fallen,'· ring before CC4',s.ring.closedBeforeCC4+'/'+s.pilots);}
