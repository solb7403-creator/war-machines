// Pure cosmetic motion contracts: no simulation, accounts, WebGL or network.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';
const c=createContext({console,Math,performance:{now:()=>0},globalThis:null});c.globalThis=c;
const p=new URL('../../js/graphics.js',import.meta.url);assert.ok(readFileSync(p,'utf8').includes('GraphicsMotion'),'shared motion module must exist');runInContext(readFileSync(p,'utf8'),c);runInContext('globalThis.M=GraphicsMotion;globalThis.Q=GraphicsQuality;globalThis.G=GraphicsRelease;globalThis.GR=GraphicsResolution',c);
assert.equal(c.G.enabled,true,'2026-10-31 owner-approved nonpayment gear release activates HF; rollback flips this gate');
for(const a of ['pulse','twin','siege','moon']){const s=c.M.state();c.M.shot(s,a);assert.ok(s.kick>0);for(let i=0;i<180;i++)c.M.advance(s,1/60,{dx:0,dz:0,heading:0,aim:0},false);assert.ok(Math.abs(s.kick)<.001,a+' recoil settles');}
assert.ok(c.M.PROFILES.siege.kick>c.M.PROFILES.pulse.kick);assert.ok(c.M.PROFILES.twin.kick<c.M.PROFILES.pulse.kick);
const s=c.M.state();c.M.advance(s,.02,{dx:.03,dz:0,heading:0,aim:0},false);assert.ok(s.left>0&&s.right>0);const x=s.left;c.M.advance(s,.02,{dx:0,dz:0,heading:0,aim:0},false);assert.equal(s.left,x,'stopped tracks stay still');c.M.advance(s,.02,{dx:0,dz:0,heading:.1,aim:.2},false);assert.notEqual(s.left-s.right,0,'turn drives diverge');const before=JSON.stringify(s);c.M.advance(s,.02,{dx:0,dz:0,heading:.1,aim:.2},true);assert.equal(s.kick,0);assert.ok(Number.isFinite(s.aim));
const q=c.Q.state();for(let i=0;i<600;i++)assert.equal(c.Q.sample(q,.04,i*.04,{manual:true}),null,'manual High preserved');c.Q.reset(q,0);for(let i=0;i<90;i++)assert.equal(c.Q.sample(q,.04,i*.04,{}),null,'warmup protected');let decision;for(let i=90;i<800;i++){decision=c.Q.sample(q,.04,i*.04,{});if(decision)break;}assert.equal(decision,'low');c.Q.reset(q,40);assert.equal(c.Q.sample(q,2,42,{}),null,'background gap discarded');
console.log('PASS cosmetic family recoil, movement/stop/turn/reduced motion, release default and quality hysteresis');
// Real THREE model tags and material leases, including all nine hulls, with no added meshes.
for(const p of ['js/vendor/three.lunar.min.js','js/rules.js','js/models3d.js','js/equipment3d.js'])runInContext(readFileSync(new URL('../../'+p,import.meta.url),'utf8'),c);
runInContext('globalThis.E=Equipment3D;globalThis.P=PAINTS;globalThis.B=M3;',c);
for(const q of ['high','low'])for(const cls of ['scout','vanguard','titan'])for(let t=0;t<3;t++){const r=c.E.chassisKit(cls,t,c.P.stock,'#fff',[],false,q),b=c.E.bake(r.k);assert.equal(r.meta.track.length,4);const tagged=Object.values(b).filter(g=>g.attributes.drive);assert.ok(tagged.length>=3);assert.ok(tagged.every(g=>g.attributes.drive.array.every(Number.isFinite)));assert.ok(tagged.some(g=>Array.from(g.attributes.drive.array).some((x,i)=>i%4===2&&x===2)),'real treads tagged');}
const root=new c.THREE.Group(),mat=new c.THREE.MeshBasicMaterial();mat.userData.hfShared=true;const g=new c.THREE.BoxGeometry();root.add(new c.THREE.Mesh(g,mat));const a=c.M.attach(root);assert.notEqual(root.children[0].material,mat);let n=0;root.children[0].material.addEventListener('dispose',()=>n++);a.dispose();a.dispose();assert.equal(n,1);assert.equal(mat.userData.hfShared,true);
console.log('PASS 9 HIGH/LOW real hull drive tags and independent material ownership/disposal');
const gen=c.E.generation;c.E.quality=c.E.quality;assert.equal(c.E.generation,gen,'same profile must not invalidate every cached model');
const tagged=c.E.bake(c.E.chassisKit('vanguard',0,c.P.stock,'#fff',[],false,'high').k);assert.ok(Object.values(tagged).some(g=>Array.from(g.attributes.drive?.array||[]).some((v,i)=>i%4===2&&v>1&&v<1.5)),'wheel metadata must carry its actual radius');
assert.equal(c.Q.initial({mode:'auto',coarse:true,cores:6,memory:null}),'high','unknown iPhone memory starts HIGH (owner, Nov 11 2026: full quality unless the device truly cannot hold frame rate; the watch steps down)');assert.equal(c.Q.initial({mode:'auto',coarse:true,cores:4,memory:2}),'low','a phone that reports 2 GB starts LOW');assert.equal(c.Q.initial({mode:'low',coarse:false,cores:16,memory:32}),'low','manual Low wins');assert.equal(c.Q.initial({mode:'high',coarse:true,cores:4}),'high','manual High wins');assert.equal(c.Q.initial({mode:'auto',coarse:false,cores:12,memory:16}),'high');
const severe=c.Q.state();severe.q='low';let fallback;for(let i=0;i<600;i++){fallback=c.Q.sample(severe,.1,i*.1,{});if(fallback)break;}assert.equal(fallback,'2d','sustained LOW overload reaches 2D without a single-frame downgrade');

// ---- render resolution (Session 5E-2a): ceilings and the frame-time governor ----
{const R=c.GR,hw={software:false};
assert.equal(R.cap('low',{...hw,dpr:3,coarse:true}),1,'LOW graphics stays 1x');assert.equal(R.cap('high',{...hw,dpr:3,coarse:true}),2.5,'phone HIGH: up to 2.5x');assert.equal(R.cap('high',{...hw,dpr:2,coarse:false}),2,'desktop HIGH: the full device ratio');assert.equal(R.cap('high',{dpr:2,coarse:false,software:true}),1,'a CPU rasterizer never goes above 1x');
const g=R.governor(2.5,{min:1});let t=0;const run=(ms,secs)=>{let out=[];for(let i=0;i<secs*1000/ms;i++){t+=ms/1000;const r=g.sample(ms,t);if(r!==null)out.push(r);}return out;};
assert.deepEqual(run(16.7,10),[],'on budget at full ratio: nothing changes');
const down=run(30,1.2);assert.deepEqual(down,[2.25],'over budget for about a second: exactly one step down');
assert.equal(run(30,0.4).length,0,'a short stretch over budget after a step is not acted on at once');
run(30,6);assert.ok(g.ratio<2.25&&g.ratio>=1,'still over budget: keeps stepping down to the floor ('+g.ratio+')');run(30,30);assert.equal(g.ratio,1,'never below the floor');
const ups=run(16.7,60);assert.ok(ups.length>=1&&g.ratio>1,'recovered: climbs back ('+ups.join(',')+')');
const before=g.ratio;run(16.7,600);assert.equal(g.ratio,2.5,'with headroom long enough it returns to the full ratio (from '+before+')');
assert.equal(g.sample(400,t+1),null,'a hidden-tab gap is ignored');
const f=R.governor(2.5,{min:1,auto:false});for(let i=0;i<600;i++)assert.equal(f.sample(40,i*.04),null,'manual mode: the ratio is fixed');
// no flicker: a level that keeps failing is retried less and less often
const h=R.governor(2,{min:1});let tt=0,tries=0;for(let i=0;i<60*120;i++){const ms=h.ratio>1.75?30:16.7;tt+=ms/1000;const r=h.sample(ms,tt);if(r===2)tries++;}assert.ok(tries<=5,'a failing level backs off ('+tries+' retries in 2 min)');}
console.log('graphics-motion: resolution governor checks PASS');
