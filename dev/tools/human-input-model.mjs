// Session 7C STEP 2: the human-variance input model that recorded dev/tests/fixtures/cq-human-variance.json.gz (no live players exist yet:
// replace the fixtures with real recordings once they do; PROPOSAL in Checkpoint 50). A pilot is not a script: it re-decides only every
// 180-420 ms (log-normal reaction), its stick drifts (an Ornstein-Uhlenbeck wobble of 8-25 degrees on the heading, the magnitude
// 0.55-0.98), it lets go now and then (0.2-1.6 s), its aim lags and wobbles, it fires in bursts (0.3-2.6 s held, 0.1-0.9 s apart) and
// locks a new hostile a reaction after it shows up. Each pilot draws its own style. Deterministic from a seed.
// usage: node dev/tools/human-input-model.mjs   (writes the fixtures; the test replays them: dev/tests/conquest-fingerprints.mjs)
import {writeFileSync,mkdirSync} from 'node:fs';import {gzipSync} from 'node:zlib';import {buildSim} from '../../worker/build-sim.mjs';
export function rng(seed){let a=seed>>>0||1;return ()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const gauss=r=>Math.sqrt(-2*Math.log(Math.max(1e-9,r())))*Math.cos(2*Math.PI*r());
export function human(seed,{park=false}={}){const r=rng(seed),style={wob:(8+r()*17)*Math.PI/180,mag:.55+r()*.43,react:180+r()*240,burst:[.3+r()*.7,1.2+r()*1.4],gap:[.1+r()*.3,.4+r()*.5],letGo:.08+r()*.12,aimLag:.15+r()*.25};
 let ou=0,next=0,plan=null,hold=0,fireT=0,firing=false,aim=0,letGo=0,lock=null,lockAt=0,t=0;
 return (s)=>{t+=.05;const B=s.battle,p=s.position,dt=.05;ou+=(-ou/.8)*dt+style.wob*Math.sqrt(2*dt/.8)*gauss(r);
  if(t>=next){next=t+Math.exp(Math.log(style.react/1000)+.35*gauss(r));const live=(B.enemies||[]).filter(e=>e&&e.hp>0&&!e.dormant);let tg=null,td=Infinity;for(const e of live){const d=Math.hypot(e.x-p.x,e.z-p.z);if(d<td){td=d;tg=e;}}
   const goal=tg||B.objective||{x:p.x+8,z:p.z};plan={tg,goal,d:Math.hypot(goal.x-p.x,goal.z-p.z)};if(tg&&tg.id!==lock&&t>=lockAt){lock=tg.id;lockAt=t+.2+r()*.6;}if(!tg)lock=null;
   if(r()<style.letGo*(next-t+.2))letGo=t+.2+r()*1.4;}
  const P=plan||{goal:{x:p.x,z:p.z},d:0,tg:null},dx=P.goal.x-p.x,dz=P.goal.z-p.z,want=Math.atan2(dx,dz);aim+=(((want-aim+Math.PI*3)%(Math.PI*2))-Math.PI)*Math.min(1,dt/style.aimLag);
  let x=0,z=0;const move=!park&&t>=letGo&&(!P.tg||P.d>26+((seed%7)*2));if(move){const h=want+ou,m=Math.min(.98,style.mag*(.85+.15*Math.sin(t*1.7+seed)));x=Math.sin(h)*m;z=Math.cos(h)*m;}
  if(P.tg){if(t>=fireT){firing=!firing;const [a,b]=firing?style.burst:style.gap;fireT=t+a+(b-a)*r();}}else firing=false;
  const c={x:Math.round(x*100)/100,z:Math.round(z*100)/100,aimYaw:Math.round((aim+.03*gauss(r))*100)/100,lockId:lock,fire:firing};if(B.playerHp<B.playerMax*.6&&r()<.04)c.shield=true;if((B.charge||0)>=1000&&r()<.03)c.super=true;
  const n=Math.hypot(c.x,c.z);if(n>.99){c.x=Math.round(c.x/n*.98*100)/100;c.z=Math.round(c.z/n*.98*100)/100;}return c;};}
// the fixtures: a day of one pilot (the same raid four times, a parked defender, field work) and a second pilot's day
export const PLAN=[{who:1,op:'raid-intercept-1'},{who:1,op:'raid-intercept-1'},{who:1,op:'raid-intercept-1'},{who:1,op:'raid-intercept-1'},
 {who:1,op:'sector-defense-refuge',park:true},{who:1,op:'sector-defense-refuge',park:true},{who:1,op:'colony-defense-colony',park:true},{who:1,op:'recon'},
 {who:2,op:'raid-siege-2'},{who:2,op:'raid-siege-2'},{who:2,op:'raid-siege-2'},{who:2,op:'strike-1'}];
if(process.argv[1]&&import.meta.url.endsWith(process.argv[1].split('/').pop())){buildSim();const {harness,encode}=await import('../tests/lib/cq-replay.mjs');const Hn=await harness();
 const t0=Date.UTC(2026,10,25,8),out=[],rec={};for(const [i,x] of PLAN.entries()){const s0=rec[x.who]||Hn.pilot(t0,{seed:777*x.who});const s=Hn.begin(s0,x.op,s0.lastWall||t0);const pol=human(1000*x.who+i*17,{park:x.park});
  const r=Hn.run(s,pol,t0,{maxS:150,record:true});rec[x.who]=r.s;out.push({who:x.who,op:x.op,park:!!x.park,end:r.s.battle?.state,rows:encode(r.sent)});console.log(x.who,x.op,r.s.battle?.state,r.sent.length,'commands');
  // back to the field between operations (the reducer's own return), then the next
  try{const {applyAction}=await import('../../worker/src/conquest-sim.js');rec[x.who]=applyAction(r.s,{seq:r.s.seq+1,action:'return-exploration'},r.now+1000);}catch(e){}}
 mkdirSync('dev/tests/fixtures',{recursive:true});const buf=gzipSync(Buffer.from(JSON.stringify({scope:'recorded from the human-variance input model (dev/tools/human-input-model.mjs): no live players yet',t0,plan:PLAN,runs:out})));
 writeFileSync('dev/tests/fixtures/cq-human-variance.json.gz',buf);console.log('wrote',buf.length,'bytes');}
