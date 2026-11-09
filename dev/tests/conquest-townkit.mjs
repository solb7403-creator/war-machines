// Session 5C (docs/conquest/SESSION_05C_BASE_UX_FULL_PROMPT.md §A, §D, §E, §G): the shared town kit (js/conquest/townkit.js).
//  1. parity: the Home Sector (drive camera, wall LOD around the tank) and build mode (overhead camera) draw the same town:
//     identical instance counts for the same plot, equal to the kit's plan, on every site, at CC1/CC5/CC10
//  2. only the fixed style materials (no new shader programs); render budgets of a full CC10 town (2,000 walls, 42 turrets)
//  3. walls: posts on corners, ends and every 6th cell of a straight run (never inside a thick wall), rubble for ruined cells
//  4. the pad diorama shows the same structures, fits inside the shared pad collision (Worker + phone) at every tier, and the
//     Command Gate's portal ring, the apron and the fast-travel arrivals stay open
//  5. the hub hero's lite kit (no style instance) builds the same diorama; the Home Sector ground matches the rendered terrain
//  6. town names: Worker action plot-name (16 characters, profanity list), the public snapshot carries the name
//  7. the plinth never traps a pilot: claiming at the pad centre steps the pilot out to the apron
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {RULES:R,CONQUEST}=await import('../../worker/src/sim.gen.js'),K=CONQUEST.Control,Cw=CONQUEST.Combat;
const {createState,applyAction,refreshState}=await import('../../worker/src/conquest-sim.js');const {snapshot}=await import('../../worker/src/conquest-visit.js');
const {fullTown}=await import('./fixtures/town.mjs');
const ctx2d=new Proxy({},{get:(o,k)=>k in o?o[k]:k==='createImageData'?(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}):k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:10}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const document={createElement:()=>({width:0,height:0,style:{},getContext:()=>ctx2d}),fonts:{check:()=>true}};
class ImageData{constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4);}}class Path2D{moveTo(){}lineTo(){}rect(){}}
const c=vm.createContext({console,document,performance:{now:()=>0},ImageData,Path2D});
for(const f of ['js/vendor/three.lunar.min.js','js/rules.js','js/conquest/world.js','js/conquest/combat.js','js/conquest/plot.js','js/conquest/style.js','js/conquest/townkit.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const {THREE:T,ConquestStyle:CS,ConquestTownKit:TK,ConquestPlot:P,ConquestCombat:C}=c,KC=K;   // the pad collision: the Worker's own ConquestControl
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m);};
const tris=o=>{let t=0;o.traverse(m=>{if(m.isMesh&&m.visible!==false)t+=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3*(m.isInstancedMesh?m.count:1);});return t;};
const draws=o=>{let d=0;o.traverse(m=>{if(m.isMesh&&m.visible!==false&&(!m.isInstancedMesh||m.count>0))d++;});return d;};
const now=Date.UTC(2026,10,9,12);const starter=(site,cc)=>{const p=P.newPlot(site,now);p.cc=cc;p.b.cc.l=cc;return p;};
const evidence={};
for(const low of [false,true]){const S=CS.create(T,{low}),k=TK.kit(S),q=low?'LOW':'HIGH',allowed=new Set(Object.values(S.MAT));
 // ---- 1. parity: drive camera vs build camera ----
 for(const site of P.SITE_IDS)for(const [cc,make] of [[1,()=>starter(site,1)],[5,()=>{const p=fullTown(P,site,{now,cells:900});p.cc=5;p.b.cc.l=5;for(const k2 of Object.keys(p.w)){const [i,j]=k2.split(',').map(Number);if(!P.inTown(5,i,j))delete p.w[k2];}for(const [id,b] of Object.entries(p.b))if(!P.inTown(5,b.i,b.j))delete p.b[id];return p;}],[10,()=>fullTown(P,site,{now})]]){
  const p=make(),A=new TK.Scene(S,k),B=new TK.Scene(S,k),pl=TK.plan(p),want=TK.counts(pl);
  A.sync(p);A.setFocus(0,0,0);A.heads(1,null);           // build mode, zoomed out: every wall on the light model
  B.sync(p);B.setFocus(P.cellX(40),P.cellZ(70),72);B.heads(1,{x:P.cellX(40),z:P.cellZ(70)});   // the Home Sector: full detail around the tank
  const a=A.counts(),b=B.counts();assert.deepEqual(a,b,q+' '+site+' CC'+cc+' build vs drive '+JSON.stringify([a,b]));
  for(const key of ['wallCells','turrets','homes','buildings','posts','rubble'])assert.equal(a[key],want[key],q+' '+site+' CC'+cc+' '+key+' scene '+a[key]+' plan '+want[key]);
  if(cc===10&&site==='ridge'&&!low)evidence.parity=a;
  A.root.traverse(m=>{if(m.isMesh)assert.ok(allowed.has(m.material),q+' only style materials ('+(m.name||m.parent?.name||'?')+')');});
  if(cc===10&&site==='crater'){const tA=tris(A.root),tB=tris(B.root),dA=draws(A.root),dB=draws(B.root);evidence[q]={build:{draws:dA,tris:Math.round(tA)},drive:{draws:dB,tris:Math.round(tB)}};
   ok(dA<=70&&dB<=75,q+' CC10 town draws: build '+dA+', Home Sector '+dB+' (5B budget ~63; the wall LOD adds one far draw per blend near the tank)');
   ok(tA<=(low?195000:215000)&&tB<=(low?195000:260000),q+' CC10 town triangles: build '+Math.round(tA/1000)+'k, Home Sector '+Math.round(tB/1000)+'k (5B: 196-213k HIGH, 195k LOW)');}
  A.dispose();B.dispose();}
 ok(true,q+' the Home Sector and build mode show identical instance counts on all 7 sites at CC1, CC5 and CC10 (walls, turrets, homes, buildings, posts, rubble)');
 // ---- 3. posts and rubble ----
 {const p=starter('ridge',3);for(let i=30;i<=49;i++)p.w[i+','+30]=1;for(let i=30;i<=40;i++)for(let j=40;j<=44;j++)p.w[i+','+j]=1;const pl=TK.plan(p),line=pl.posts.filter(x=>x.endsWith(',30')).map(x=>+x.split(',')[0]).sort((a,b)=>a-b),inner=pl.posts.filter(x=>{const [i,j]=x.split(',').map(Number);return j>40&&j<44&&i>30&&i<40;});
  ok(line[0]===30&&line.at(-1)===49&&line.filter(i=>i>30&&i<49).every(i=>i%6===0),q+' a 20-cell LINE: posts at both ends and every 6th cell ('+line.join(',')+')');ok(inner.length===0,q+' no posts inside a thick wall block');
  p.dmg={'w:35,30':99999,'w:36,30':10};const S2=new TK.Scene(S,k);S2.sync(p);const wc=TK.counts(TK.plan(p));ok(S2.counts().rubble===1&&wc.rubble===1&&S2.counts().wallCells===wc.wallCells&&wc.wallCells===19+55,q+' a ruined wall cell is rubble, not a hole (1 rubble, the damaged one still stands)');S2.dispose();}
 // ---- 4. the pad diorama ----
 for(let tier=1;tier<=5;tier++){const cc=Math.min(10,tier*2),p=cc===10?fullTown(P,'ridge',{now}):starter('canyon',cc),qp=KC.plinthOf(tier),size=2*qp.h-2.2,g=TK.diorama(S,k,p,{size,ex:3.6,low,plinth:1.1}),pl=TK.counts(TK.plan(p));
  g.position.set(0,0,13-qp.h);g.updateMatrixWorld(true);const v=new T.Vector3();let out=0,tot=0;g.traverse(m=>{if(!m.isMesh)return;const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);tot++;if(v.y>.3&&!K.baseBlocked({baseTier:tier},{x:Cw.baseDefinition.x+v.x,z:Cw.baseDefinition.z+v.z}))out++;}});
  ok(out===0,q+' tier '+tier+' (CC'+cc+'): every diorama vertex above the pad floor stands inside the shared pad collision ('+tot+' vertices; plinth '+(2*qp.h)+' m)');
  const dc=g.userData.counts;ok(dc.wallCells+dc.rubble===pl.wallCells+pl.rubble&&dc.turrets===pl.turrets&&dc.homes===pl.homes,q+' tier '+tier+': the diorama shows the same walls ('+dc.wallCells+'), turrets ('+dc.turrets+') and homes ('+dc.homes+') as the town');
  const t=tris(g);ok(t<=(low?36000:42000)&&draws(g)<=3,q+' tier '+tier+' diorama: '+draws(g)+' draws, '+Math.round(t/1000)+'k triangles');if(tier===5&&!low)evidence.diorama={draws:draws(g),tris:Math.round(t)};
  g.traverse(m=>{if(m.isMesh)assert.ok(allowed.has(m.material),q+' diorama uses style materials');});}
}
// the pad stays open where it must
{const D=Cw.baseDefinition;for(let tier=1;tier<=5;tier++){ok(!K.baseBlocked({baseTier:tier},{x:D.x,z:D.z-15.4})&&!K.baseBlocked({baseTier:tier},{x:D.x,z:D.z-26})&&K.baseBlocked({baseTier:tier},{x:D.x,z:D.z+2}),'tier '+tier+': the gate portal ring and the apron are open, the plinth is solid');
  const node=Cw.travelNodes({},tier).find(x=>x.id==='base');ok(node&&node.arrivals.some(p=>!K.baseBlocked({baseTier:tier},p)),'tier '+tier+': fast travel and RECALL still have open arrival points at the base');}}
// ---- 5. lite kit (hub hero) and the Home Sector ground ----
{const L=TK.lite(T),k=TK.kit(L),p=fullTown(P,'ridge',{now}),g=TK.diorama(L,k,p,{size:34,ex:2.4,low:true,plinth:1.2}),pl=TK.counts(TK.plan(p));ok(g.userData.counts.turrets===pl.turrets&&g.userData.counts.wallCells===pl.wallCells,'the hub hero (lite kit, no style instance) builds the same town diorama');
 let worst=0;for(const site of P.SITE_IDS)for(let x=-150;x<=150;x+=8)for(let z=-150;z<=150;z+=8){const gx=Math.floor((x-2)/4)*4+2,gz=Math.floor((z-2)/4)*4+2;worst=Math.max(worst,Math.abs(TK.groundAt(site,gx,gz)-P.heightAt(site,gx,gz)));}
 ok(worst<1e-9,'the Home Sector ground is the rendered terrain: lattice points match the site height exactly on all 7 sites');}
// ---- 6. town names (Worker) ----
{const D=Cw.baseDefinition,at=(x,z)=>({x,z,y:CONQUEST.World.groundAt(x,z),surface:'ground'});let t=now;let s=createState(R.STOCK_L,t);s.ledger.cp=5e7;s.ledger.banked={alloy:1e6,biomass:1e6,helium:1e6};s.position=at(D.x,D.z);s.battle.enemies=[];
 s=applyAction(s,{seq:s.seq+1,action:'build-base',plot:{site:'ridge'}},t+=1000);ok(s.base.tier===1&&Math.hypot(s.position.x-D.x,s.position.z-(D.z-26))<.01,'claiming at the pad centre works and steps the pilot out of the new plinth to the apron (never stuck, never refused)');
 const act=(name)=>applyAction(structuredClone(s),{seq:s.seq+1,action:'plot-name',plot:{name}},t+=1000);
 const a=act('Ironhold Keep');ok(a.plot.name==='Ironhold Keep','plot-name stores a clean name');ok(snapshot('Pilot',a.plot,t).tn==='Ironhold Keep','the public snapshot carries the town name (visits, diorama plaque)');
 for(const bad of ['Fuuuck Town','sh1t hole','A'.repeat(17),'<script>','N1GG3R'])assert.throws(()=>act(bad),/conquest: /,bad);ok(true,'plot-name refuses profanity (folded case, repeats, digit swaps), names over 16 characters and symbols');
 const cleared=applyAction(structuredClone(a),{seq:a.seq+1,action:'plot-name',plot:{name:'  '}},t+=1000);ok(!cleared.plot.name,'an empty name restores the default "<SITE> TOWN"');
 assert.throws(()=>applyAction(structuredClone(s),{seq:s.seq+1,action:'plot-name',plot:{name:'Ok',x:1}},t+=1000),/invalid plot fields/);ok(true,'plot-name accepts no other fields');
 // a saved position inside the plinth (e.g. after the Command Center grows the pad) steps out on the next session refresh
 const q=structuredClone(s);q.position=at(D.x,D.z+3);refreshState(q,t+=1000);ok(!K.baseBlocked({baseTier:q.base.tier},q.position),'a saved position inside the plinth is moved out on refresh');}
fs.mkdirSync('docs/conquest/session5c',{recursive:true});fs.writeFileSync('docs/conquest/session5c/townkit.json',JSON.stringify(evidence,null,1));
console.log('conquest-townkit: '+n+' checks passed',JSON.stringify(evidence));
