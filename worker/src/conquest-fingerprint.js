// Session 7C STEP 2 (owner brief docs/conquest/audit/SESSION_07C_BRIEF.md; old brief A, spec §10): Conquest command fingerprints, made on
// the Worker from the commands it already replays (never from anything the phone reports). Per operation: the steering entropy (17
// stick directions, idle included), the stick's variance, how often the controls changed, the firing cadence (the coefficient of
// variation of the gaps between trigger presses), the completion time and a coarse path hash (the tank's 8 m cell every 2 s). At most
// 200 bytes each (FP.maxBytes), the last 20 kept (s.fp, cold); the running operation's accumulator rides the hot part (s.fpa).
// Flags (flag only: a flagged pilot plays on and sits out boards and the airdrop snapshot until the owner clears them; nothing bans),
// raised once per pilot through the outbox and eco.js addFlags, like cqppm:
//  - cqrepeat: 3 near-identical operations in one UTC day (the same operation, the same coarse path through 3+ cells, completion times
//    within 1 s, steering histograms within 6 points, control changes within 2%): a script replaying one fight. Measured: the scripted
//    bot repeats every value exactly; human runs of one raid differ in path and in control changes by hundreds, and a parked defender
//    never leaves its first cell (the 3-cell floor keeps it out);
//  - cqnoinput: 3 operations won (each 15 s or longer) in the last 20 with no change in the controls at all: nobody on the controls (a
//    Battalion wins a sector defense in about 21 s with the pilot parked; a parked human still changes aim and trigger hundreds of times).
// Thresholds stay on the server (research lesson 14); the measurement: dev/tests/conquest-fingerprints.mjs (scripted bots fire both,
// recorded human-variance fixtures never fire).
import {airdrop} from './conquest-airdrop.js';
const DAY=86400000,BINS=17,PATH_EVERY=40,CELL=8;
export const FP=Object.freeze({keep:20,maxBytes:200,minSteps:200,repeat:Object.freeze({n:3,dt:1,hist:6,cells:3,ic:.02}),noinput:Object.freeze({n:3,steps:300}),FLAGS:Object.freeze(['cqrepeat','cqnoinput'])});
const fnv=(h,v)=>{h=Math.imul(h^(v&0xffff),16777619)>>>0;return Math.imul(h^(v>>>16),16777619)>>>0;};
const q=v=>Math.round((Number(v)||0)*20);
function dirBin(x,z){if(Math.hypot(x,z)<.15)return 16;let a=Math.atan2(x,z);if(a<0)a+=2*Math.PI;return Math.floor(a/(2*Math.PI)*16)%16;}
// every validated command of a running operation (worker/src/conquest-sim.js applyCommands), after the step moved the tank to p
export function fpStep(s,c,p){if(!s.mission)return;let f=s.fpa;const at=s.attempt|0;
 if(!f||f.a!==at||f.o!==s.mission)f=s.fpa={o:s.mission,a:at,n:0,h:new Array(BINS).fill(0),sx:0,sz:0,sxx:0,szz:0,ic:0,lk:0,fp:0,lf:0,lp:-1,gn:0,gs:0,gss:0,ph:2166136261,pc:0,lc:-1,x0:Math.round(p.x),z0:Math.round(p.z)};
 const x=Number(c.x)||0,z=Number(c.z)||0;f.n++;f.h[dirBin(x,z)]++;f.sx+=x;f.sz+=z;f.sxx+=x*x;f.szz+=z*z;
 let k=2166136261;for(const v of [q(x),q(z),q(c.aimYaw),q(c.aimPitch),c.lockId===null||c.lockId===undefined?-1:Number(c.lockId)|0,(c.fire?1:0)|(c.tapFire?2:0)|(c.super?4:0)|(c.dash?8:0)|(c.shield?16:0)|(c.gather?32:0)|(c.scan?64:0)|(c.strike?128:0),c.order|0])k=fnv(k,v>>>0);
 if(f.n>1&&k!==f.lk)f.ic++;f.lk=k;
 const fire=c.fire||c.tapFire?1:0;if(fire&&!f.lf){if(f.lp>=0){const g=f.n-f.lp;f.gn++;f.gs+=g;f.gss+=g*g;}f.lp=f.n;f.fp++;}f.lf=fire;
 if(f.n%PATH_EVERY===0){const ci=Math.floor((p.x-f.x0)/CELL),cj=Math.floor((p.z-f.z0)/CELL),ck=((ci+2048)*4096+cj+2048)>>>0;if(ck!==f.lc){f.lc=ck;f.ph=fnv(f.ph,ck);f.pc++;}}}
// the operation ended (opEnd: victory, defeat or a retreat, once per attempt): the fingerprint, then the flags it completes
export function fpEnd(s,B,outcome){const f=s.fpa;delete s.fpa;if(!f||f.a!==(s.attempt|0)||f.n<FP.minSteps)return null;
 const n=f.n,H=f.h.map(v=>v/n),se=-H.reduce((a,p)=>a+(p>0?p*Math.log2(p):0),0),mx=f.sx/n,mz=f.sz/n,sv=Math.max(0,f.sxx/n-mx*mx+f.szz/n-mz*mz);
 let fc=-1;if(f.gn>=3){const m=f.gs/f.gn,v=Math.max(0,f.gss/f.gn-m*m);fc=Math.round(Math.sqrt(v)/m*100);}
 const day=Math.floor((Number(s.lastWall)||0)/DAY),fp={o:String(f.o).slice(0,24),d:day,t:Math.round((Number(B?.time)||0)*10)/10,r:String(outcome||'?')[0],n,se:Math.round(se*100),sv:Math.round(sv*1000),ic:f.ic,fc,fp:f.fp,ph:(f.ph>>>0).toString(16).padStart(8,'0'),pc:f.pc,h:H.map(p=>Math.min(99,Math.round(p*100)).toString(36).padStart(2,'0')).join('')};
 s.fp=[...(Array.isArray(s.fp)?s.fp:Object.values(s.fp||{})).filter(Boolean),fp].slice(-FP.keep);
 const out=verdicts(s.fp,fp);s.fpf=s.fpf&&typeof s.fpf==='object'?s.fpf:{};
 for(const [k,v] of out)if(!s.fpf[k]){s.fpf[k]=day||1;const a=airdrop(s);a.pfl=[...(Array.isArray(a.pfl)?a.pfl:[]),{k,v}];}   // once per pilot: rides the next outbox entry to the account (eco.js raises it once more there: S.fl)
 return fp;}
const hist=h=>{const o=[];for(let i=0;i<BINS;i++)o.push(parseInt(String(h||'').slice(2*i,2*i+2),36)||0);return o;};
export function nearIdentical(a,b){const R=FP.repeat;if(!a||!b||a.o!==b.o||a.ph!==b.ph||a.pc<R.cells||b.pc<R.cells||Math.abs(a.t-b.t)>R.dt||Math.abs(a.ic-b.ic)>Math.max(2,R.ic*Math.max(a.ic,b.ic)))return false;const x=hist(a.h),y=hist(b.h);let d=0;for(let i=0;i<BINS;i++)d+=Math.abs(x[i]-y[i]);return d<=R.hist;}
// the flags the newest fingerprint completes (pure: the test reads it too)
export function verdicts(list,fp){const out=[],L=(list||[]).filter(Boolean);
 const same=L.filter(x=>x.d===fp.d&&nearIdentical(x,fp));if(same.length>=FP.repeat.n)out.push(['cqrepeat',same.length+' near-identical '+fp.o+' operations in one day (the same route, '+fp.t+' s)']);
 const idle=L.filter(x=>x.r==='v'&&x.n>=FP.noinput.steps&&x.ic===0);if(idle.length>=FP.noinput.n)out.push(['cqnoinput',idle.length+' operations won with no change on the controls']);
 return out;}
