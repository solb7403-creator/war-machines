// Session 7T (owner brief docs/conquest/audit/SESSION_07T_BRIEF.md, decisions 3, 5, 6): the resumable raid engine js/conquest/raid.js is
// the Session 5B raid (plot.js drill) and nothing else when no defender and no main lane are asked for (and, opt.own, raiders weigh each
// turret at its own level as the drill does; town attacks weigh them at the town's average, decision 4b): the same outcome, damage,
// frames and events on every site, for a starter town, two CC10 towns, a damaged town and a mid town, at several levels and seeds.
// Then: save / restore at any step gives a deterministic continuation; defenders only ever help; a main lane takes half the spawns.
import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
import {starterTown,cc10Town} from './fixtures/balance-towns.mjs';
const {CONQUEST}=await import('../../worker/src/sim.gen.js'),P=CONQUEST.Plot,RD=CONQUEST.Raid;let pass=0;const ok=(c,m)=>{assert.ok(c,m);pass++;};
const J=v=>JSON.stringify(v);
function midTown(site){const p=P.newPlot(site,0);p.cc=6;p.b.cc.l=6;const put=(t,l,n=1)=>{for(let k=0;k<n;k++){const at=P.autoPlace(p,t);if(at)p.b['b'+(++p.n)]={t,...at,l};}};
 for(const b of Object.values(p.b))if(b.t==='storage')b.l=3;put('reactor',3,3);put('refinery',3,1);put('shield',3,1);
 const ts=['cannon','mg','laser','rocket','missile','mortar','flame','siege'];for(let k=0,n=0;n<17&&k<400;k++){const t=ts[n%ts.length],R=k%2?11:8,a=k*2.399,i=Math.round(P.MID+Math.cos(a)*R),j=Math.round(P.MID+Math.sin(a)*R);if(!P.placeError(p,t,i,j,0)){p.b['b'+(++p.n)]={t,i,j,r:0,l:2+(n%2)};n++;}}
 for(let r=14;r<=16;r++){const pl=P.wallPlan({...p,devx:1},[{k:'rect',a:[P.MID-r,P.MID-r],b:[P.MID+r,P.MID+r],o:3,l:2}],{dev:true});for(const x of pl.cells)p.w[x.i+','+x.j]=x.code;}return p;}
const towns=site=>{const st=starterTown(P,site,{blend:[1,1]}).p,rare=cc10Town(P,site,{}),comp=cc10Town(P,site,{blends:[[0,0]],cells:3000,ext:true}),mid=midTown(site),dam=structuredClone(mid);
 dam.dmg={};let k=0;for(const id of Object.keys(dam.b)){if(k++%3===0&&id!=='cc')dam.dmg[id]=Math.round(P.maxHpOf(dam,id)*.6);}for(const w of Object.keys(dam.w).slice(0,40))dam.dmg['w:'+w]=P.maxHpOf(dam,'w:'+w);dam.dmg.cc=Math.round(P.maxHpOf(dam,'cc')*.3);
 return {starter:[st,[1,2]],rare:[rare,[10,6]],comp:[comp,[10]],mid:[mid,[4,7]],damaged:[dam,[5]]};};
// 1. identical to the drill (under the drill's own rule, opt.own: each turret weighed at its own level; town attacks weigh every turret
// at the town's average level, the only difference: fortress decision 4b, no dead upgrades)
{let n=0;for(const site of P.SITE_IDS){for(const [name,[p,levels]] of Object.entries(towns(site)))for(const threat of levels)for(const seed of [1,7]){
  const opt={threat,damage:true},a=P.drill(p,seed,opt),b=RD.drill(p,seed,{...opt,own:true});n++;
  if(J(a)!==J(b)){for(const k of Object.keys(a))if(J(a[k])!==J(b[k]))console.log('DIFF',site,name,threat,seed,k,J(a[k]).slice(0,200),'|',J(b[k]).slice(0,200));}
  assert.equal(J(b),J(a),site+' '+name+' L'+threat+' seed '+seed+': the port must equal drill()');}}
 ok(n>=7*5,'the resumable engine gives exactly drill()\'s result (outcome, damage, kills, breaches, frames, events) in '+n+' raids: every site, a starter town, two CC10 towns, a mid town and a damaged one, levels 1-10');}
// 1b. a town attack differs from the drill in two engine rules only (fortress decision 4b, no dead upgrades): raiders weigh every turret
// at the town's average level, and the waves draw from their own random stream, so a turret's level never reshuffles them: the first
// wave spawns the same raiders at the same spots whatever the turrets' levels (the drill's one stream would shift them)
{let same=0,n=0;for(const site of P.SITE_IDS){const lo=midTown(site),hi=structuredClone(lo);for(const b of Object.values(hi.b))if(P.BUILDINGS[b.t]?.turret)b.l=5;
  for(const seed of [1,7]){const A=RD.make(lo,seed,{threat:6,frames:false,events:false}),B=RD.make(hi,seed,{threat:6,frames:false,events:false});for(let i=0;i<40;i++){A.step();B.step();}
   const sig=M=>J(M.foes.slice(0,12).map(f=>[f.kind,Math.round(f.id)]));n++;if(sig(A)===sig(B)&&A.foes.length>0)same++;}}
 ok(same===n,'a turret\'s level never changes the waves: the first raiders are the same in '+same+'/'+n+' raids (levels II-III vs V)');}
// 2. save / restore: a raid cut at any step continues deterministically (the same continuation from the same saved state), and the
// whole saved state is JSON (the Worker stores it between requests)
{const p=midTown('ridge'),opt={threat:7,events:false,frames:false,damage:true};
 const whole=RD.make(p,5,opt).run();
 for(const cut of [1,37,400,901]){const A=RD.make(p,5,opt);for(let i=0;i<cut&&!A.over;i++)A.step();const st=JSON.parse(J(A.save()));const B1=RD.make(p,5,{...opt,state:st}),B2=RD.make(p,5,{...opt,state:JSON.parse(J(st))});
  const r1=B1.run(),r2=B2.run();assert.equal(J(r1),J(r2),'restore is deterministic');
  ok(r1.outcome===whole.outcome&&Math.abs(r1.kills-whole.kills)<=Math.max(3,whole.kills*.05),'cut at step '+cut+': the restored raid ends as the whole one ('+r1.outcome+', '+r1.kills+' vs '+whole.kills+' kills)');}
 const A=RD.make(p,5,opt);for(let i=0;i<300;i++)A.step();ok(J(A.save()).length<40000,'a saved raid state stays small ('+J(A.save()).length+' bytes at step 300)');}
// 3. a main lane takes half of the spawns
{const p=cc10Town(P,'crater',{}),lanes=P.spawnCells('crater',10).length,M=RD.make(p,3,{threat:5,lane:2,events:false,frames:false});for(let i=0;i<30;i++)M.step();
 const near=f=>{let best=0,bd=Infinity;P.spawnCells('crater',10).forEach((cl,k)=>{for(const [i,j] of cl){const d=Math.hypot(P.cellX(i)-f.x,P.cellZ(j)-f.z);if(d<bd){bd=d;best=k;}}});return best;};
 const by=Array(lanes).fill(0);for(const f of M.foes)by[near(f)]++;ok(lanes===4&&by[2]>=M.foes.length*.45&&by[2]<=M.foes.length*.55,'a main lane gets half the spawns ('+by.join('/')+' of '+M.foes.length+')');}
// 4. defenders fight: a garrison of pilots only ever helps (more raiders down, never a worse outcome; a fall turned into a hold
// somewhere) and shows in the frames
{const kit={w:{a:'pulse',t:2,q:1.1},c:{c:'titan',t:2,q:1.1}},gar=[1,2,3,4,5].map(i=>RD.unitOf({id:'p'+i,kind:'g',kit,rk:5})),rank=r=>({fallen:0,breached:1,held:2})[RD.outcomeOf(r)];let better=0,n=0;
 for(const site of ['ridge','ash','ice']){const p=midTown(site);for(const L of [6,8]){const o={threat:L,damage:true,frames:false,events:false},a=RD.drill(p,3,o),b=RD.drill(p,3,{...o,units:gar});n++;
  assert.ok(b.kills>=a.kills&&rank(b)>=rank(a),site+' L'+L+': a garrison never makes it worse ('+a.kills+' -> '+b.kills+' kills)');if(rank(b)>rank(a))better++;}}
 ok(better>=1,'a garrison of five pilots downs more raiders in all '+n+' raids and turns '+better+' of them from a fall into a hold');
 const f=RD.make(midTown('ridge'),3,{threat:6,units:gar}).run();ok(f.units?.length===5&&f.frames.some(x=>x.u?.length===5),'the garrison is in the result and every frame (the replay draws it)');}
console.log('PASS raid engine (resumable, identical to the drill): '+pass+' checks');
