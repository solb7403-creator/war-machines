// Session 7B PACING (owner brief docs/conquest/audit/SESSION_07B_CITADEL_BRIEF.md; blueprint §6): the first day each profile's kit breaks
// each Citadel tier, with the REAL assault (dev/tools/citadel-model.mjs: js/conquest/citadel.js on the shared combat engine through the
// Worker bundle, a careful bot pilot on real commands, the Battalion fielded as the Worker fields it). A day "breaks" a tier when at least
// half of its seeded assaults are won inside the siege window. Kits change only on some days (the Hangar, the roster, ranks, Role Cores,
// the gear tier), so each tier is searched over those days, from the day before its expected gate. Each assault runs in a child process
// (lanes in parallel). Deterministic and read-only.
// usage: node dev/tools/citadel-pace.mjs [--seeds 4] [--par 4]                 writes docs/conquest/session7b/citadel-pace.json
//        node dev/tools/citadel-pace.mjs --one '{"p":"regular","t":1,"d":18,"s":0}'  one assault (prints JSON)
import {spawn} from 'node:child_process';import {writeFileSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
// the brief's targets (days): tier I in weeks 2-3 for the regular and days 5-7 for the grinder; tier III in weeks 6-8 and week 3; the
// 2-hour heavy player between them (fortress-model.mjs PROFILES.heavy: tier I about day 10, III about day 32)
export const TARGETS=Object.freeze({1:Object.freeze({regular:[8,21],grinder:[5,7],heavy:'between'}),3:Object.freeze({regular:[36,56],grinder:[15,21],heavy:'between'})});
export async function one({p,t,d,s}){const M=await import('./citadel-model.mjs');const k=M.kitAt(p,d),r=M.assault(t,{L:k.L,allies:k.allies,seed:1000*t+s});
 return {p,t,d,s,won:r.outcome==='victory',sec:r.seconds,stage:r.stage,hull:r.hullLeft,reason:r.reason,kit:{gear:k.tier,allies:k.allies.length,top:k.top,force:k.force,rc:k.rc}};}
// the days a profile's kit changes (1..max)
export async function kitDays(p,max=80){const M=await import('./citadel-model.mjs');const key=k=>JSON.stringify([k.tier,k.allies.length,k.top,k.force,k.rc]);const out=[];let prev='';for(let d=1;d<=max;d++){const s=key(M.kitAt(p,d));if(s!==prev){out.push(d);prev=s;}}return out;}
// run assaults in child processes, lanes at a time
export function runner(par){const me=fileURLToPath(import.meta.url);let lanes=0;const wait=[];
 const take=()=>new Promise(ok=>{if(lanes<par){lanes++;ok();}else wait.push(ok);}),give=()=>{const n=wait.shift();if(n)n();else lanes--;};
 return async job=>{await take();try{return await new Promise((ok,no)=>{const c=spawn(process.execPath,[me,'--one',JSON.stringify(job)]);let o='';c.stdout.on('data',x=>o+=x);c.stderr.pipe(process.stderr);c.on('close',k=>k?no(Error('exit '+k)):ok(JSON.parse(o.trim().split('\n').pop())));});}finally{give();}};}
// the first kit day at or after `from` whose seeded assaults are won at least half the time (scanning up to `steps` kit days)
export async function firstWin(run,p,t,{from=1,seeds=4,steps=6,max=80}={}){const days=[from,...(await kitDays(p,max)).filter(d=>d>from)];const tried=[];
 for(const d of days.slice(0,steps)){const rs=await Promise.all(Array.from({length:seeds},(_,s)=>run({p,t,d,s})));const won=rs.filter(r=>r.won).length;tried.push({d,won,of:seeds,sec:rs.map(r=>r.sec),kit:rs[0].kit});if(won*2>=seeds)return {day:d,tried};}
 return {day:null,tried};}
if(process.argv.includes('--one')){process.stdout.write(JSON.stringify(await one(JSON.parse(arg('--one','{}'))))+'\n');}
else if(process.argv[1]&&process.argv[1].endsWith('citadel-pace.mjs')){const seeds=Number(arg('--seeds',4)),run=runner(Math.max(1,Math.min(8,Number(arg('--par',4)))));
 // where each search starts: the kit day before the full Battalion (tier I) and before the rare gear day (tiers II-III)
 const M=await import('./citadel-model.mjs'),start=(p,f)=>{let d=1;for(let x=1;x<=80;x++){if(f(M.kitAt(p,x))){d=x;break;}}return Math.max(1,d-3);};
 // a tier after the first opens CIT.refortMs (7 days) after the previous tier's first clear (the Hive re-fortifies): its search starts there
 const {CONQUEST}=await import('../../worker/src/sim.gen.js'),RF=Math.round(CONQUEST.Citadel.CIT.refortMs/86400000);
 const res={};await Promise.all(['regular','heavy','grinder'].map(async p=>{res[p]={};const t1=await firstWin(run,p,1,{from:start(p,k=>k.allies.length>=9),seeds});res[p][1]=t1;
  const t2=await firstWin(run,p,2,{from:Math.max((t1.day||1)+RF,start(p,k=>k.tier>=1)),seeds});res[p][2]=t2;res[p][3]=await firstWin(run,p,3,{from:(t2.day||1)+RF,seeds,steps:8});}));
 const inside=(x,[a,b])=>x!==null&&x>=a&&x<=b,check={};for(const t of [1,3]){const T=TARGETS[t],g=res.grinder[t].day,r=res.regular[t].day,h=res.heavy[t].day;
  check[t]={regular:{day:r,target:T.regular,ok:inside(r,T.regular)},grinder:{day:g,target:T.grinder,ok:inside(g,T.grinder)},heavy:{day:h,target:'between the grinder and the regular',ok:h!==null&&g!==null&&r!==null&&h>=g&&h<=r}};}
 const out={about:'Session 7B pacing: the first day each profile\'s kit breaks each Citadel tier with the real assault (citadel-model.mjs bot, '+seeds+' seeded assaults a day, won at least half); a tier after the first opens '+RF+' days after the previous first clear',seeds,refortDays:RF,check,results:res};
 mkdirSync('docs/conquest/session7b',{recursive:true});writeFileSync('docs/conquest/session7b/citadel-pace.json',JSON.stringify(out,null,1)+'\n');
 for(const p of ['regular','heavy','grinder'])console.log(p.padEnd(8),[1,2,3].map(t=>'tier '+t+': day '+res[p][t].day+' ('+res[p][t].tried.map(x=>x.d+':'+x.won+'/'+x.of).join(' ')+')').join(' · '));
 for(const t of [1,3])console.log('tier',t,Object.entries(check[t]).map(([p,c])=>p+' '+c.day+(c.ok?' ok':' OUTSIDE '+JSON.stringify(c.target))).join(' · '));}
