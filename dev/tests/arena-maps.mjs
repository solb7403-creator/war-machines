// Arcade 3D maps (Session 5E-2c): the prop kits and the environment layer on the real vendored THREE, with no renderer.
// What it holds true for every map, HIGH and LOW:
//  - visuals never read the sim's random() and never change MAPS (layout, hitboxes, spawns are the rules' business)
//  - geometry is finite and bounded, LOW is really lighter than HIGH
//  - raised art stands on a solid the rules know (wall, rock, crate, bridge) or outside the arena: nothing a tank can
//    drive through looks like cover, and nothing it bumps into is invisible
//  - nothing tall stands on the camera's side of the arena (south), and nothing in the arena is taller than before
//  - the environment layer: six presets, blends, flash, emitters, anchors, the rebake hook
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';
const root=new URL('../../',import.meta.url),ctx=createContext({console,URL,Float32Array,Float64Array,Uint8Array,Uint16Array,Map,WeakMap,Math,HOST:{random(){throw Error('authoritative RNG consumed by visuals');}}});
for(const f of ['js/vendor/three.lunar.min.js','js/rules.js','js/game.js','js/mapenv.js','js/arena3d.js','js/arenaprops.js','js/arenacam.js'])runInContext(readFileSync(new URL(f,root),'utf8'),ctx);
runInContext('globalThis.A=Arena3D;globalThis.P=ArenaProps;globalThis.E=MapEnv;globalThis.maps=MAPS;globalThis.snap=JSON.stringify(MAPS);globalThis.T=THREE;globalThis.DECK=typeof M3!=="undefined"?M3.DECK_H:1;',ctx);
const {A,P,E,maps,T}=ctx,W=20,H=32,IDS=['classic','overpass','longshot','craters','canyon','bunker'];
// the views a phone and a desktop ask for (render3d.arenaView)
const VIEWS={phone:{x0:-2,x1:22,z0:-13,z1:44},desk:{x0:-24,x1:44,z0:-2,z1:36}};
// the chase camera (Session 5E-2b2a): the ground it asks for on a phone and a desktop (render3d.chaseView), the raised bridges
{const CAM=runInContext('ArenaCam',ctx);for(const [n,w,h] of [['chasePhone',390,844],['chaseDesk',1920,1080]]){const c=CAM.cover(w,h);VIEWS[n]={x0:c.x0,x1:c.x1,z0:c.z0,z1:c.z1,horizon:c.horizon,fine:c.fine,chase:true};}}
const TOL=0.2;   // how far art may overhang its footprint (ledges, rails, bevels)
const EDGE=0.32;  // wall-mounted trim (lamps, ribs, pipes on a boundary wall) may reach this far in from the arena edge
function solids(M){
 const rect=[],circ=[];
 for(const w of M.walls||[])rect.push([w[0],w[1],w[2],w[3]]);
 for(const c of M.crates||[])rect.push([c[0],c[1],c[2],c[3]]);
 for(const r of M.rocks||[])circ.push([r[0],r[1],r[2]]);
 if(M.bridge){rect.push(M.bridge.deck.slice(0,4));for(const r of M.bridge.ramps){rect.push([r[0]-0.2,r[1],r[2]+0.4,r[3]]);}}
 return {rect,circ};
}
const onSolid=(S,x,z)=>S.rect.some(r=>x>=r[0]-TOL&&x<=r[0]+r[2]+TOL&&z>=r[1]-TOL&&z<=r[1]+r[3]+TOL)||S.circ.some(c=>Math.hypot(x-c[0],z-c[1])<=c[2]+TOL);
const stats={};
for(const id of IDS)for(const q of ['high','low'])for(const [vn,view] of Object.entries(VIEWS)){
 const M=A.prep(id,{q,view:{...view},env:null,chase:!!view.chase}),k=M.kit,S=solids(maps[id]);
 const southWall=x=>(maps[id].walls||[]).some(w=>w[1]+w[3]>H-0.01&&x>=w[0]-0.05&&x<=w[0]+w[2]+0.05);   /* a wall on the south edge: its own columns are not playfield */ let n=0,bad=0,worst='',southTall=0,maxIn=0;
 const kits=[k,...k.spin.map(s=>s.kit)];
 for(const kit of kits)for(const cls of A.CLS){const b=kit[cls];assert.ok(b.P.every(Number.isFinite)&&b.N.every(Number.isFinite)&&b.C.every(Number.isFinite),id+' finite '+cls);n+=b.P.length/3;}
 for(const cls of A.CLS){const b=k[cls];for(let i=0;i<b.P.length;i+=3){const x=b.P[i],y=b.P[i+1],z=b.P[i+2],inside=x>0.02&&x<W-0.02&&z>0.02&&z<H-0.02,open=x>EDGE&&x<W-EDGE&&z>EDGE&&z<H-EDGE;
  if(open&&y>0.2&&!onSolid(S,x,z)){bad++;if(!worst)worst=cls+' '+[x,y,z].map(v=>v.toFixed(2)).join(',');}
  if(inside)maxIn=Math.max(maxIn,y);
  if(z>H+0.05&&x>0.05&&x<W-0.05&&!southWall(x))southTall=Math.max(southTall,y);}} 
 assert.equal(bad,0,id+' '+q+' '+vn+': '+bad+' raised vertices stand on open floor, e.g. '+worst);
 assert.ok(southTall<=0.75,id+' '+q+': art on the camera side of the arena stays low ('+southTall.toFixed(2)+')');
 assert.ok(maxIn<=2.9,id+' '+q+': nothing in the arena is taller than the tallest prop before (pillar 2.1 + cap) '+maxIn.toFixed(2));
 assert.ok(k.gtop.every(p=>p.every(Number.isFinite)),id+' finite tops');
 for(const h of k.halos)assert.ok(h.slice(0,4).every(Number.isFinite)&&/^#[0-9a-f]{6}$/i.test(h[4]),id+' halo');
 const a=k.anchors;assert.ok(Array.isArray(a.vents)&&Array.isArray(a.lasers)&&Array.isArray(a.drops)&&a.drops.length>0&&a.area.length===4,id+' anchors');
 stats[id+'|'+q+'|'+vn]=n;
 assert.ok(n>1500&&n<(q==='high'?(vn==='desk'||vn==='chaseDesk'?260000:vn==='chasePhone'?180000:150000):vn.startsWith('chase')?110000:90000),id+' '+q+' '+vn+' bounded map '+n);
 // the chase camera's bridges: the deck is raised, and where the rules have a tunnel the space under it is open from mouth
 // to mouth (nothing but the floor below tank height, nothing hanging lower than the deck's own beams)
 if(view.chase&&maps[id].bridge){const B=maps[id].bridge,[dx,dy,dw,dh]=B.deck,D=P.DECK_UP,U=D-P.DECK_SLAB;let top=0,inTun=0,eg='';
  assert.equal(M.deckH,D,id+': raised deck');
  for(const cls of ['rock','paint','metal']){const b=k[cls];for(let i=0;i<b.P.length;i+=3){const x=b.P[i],y=b.P[i+1],z=b.P[i+2];if(x>dx&&x<dx+dw&&z>dy&&z<dy+dh)top=Math.max(top,y);
   for(const [tx,tw] of B.tunnels)if(x>tx+0.62&&x<tx+tw-0.62&&z>dy-0.2&&z<dy+dh+0.2&&y>0.2&&y<U-0.36){inTun++;if(!eg)eg=cls+' '+[x,y,z].map(v=>v.toFixed(2)).join(',');}}}
  assert.ok(top>=D&&top<=D+0.65,id+' '+q+': the deck stands at '+D+' (top of its rails '+top.toFixed(2)+')');
  assert.equal(inTun,0,id+' '+q+' '+vn+': '+inTun+' vertices hang in a tunnel, e.g. '+eg);}
 if(!view.chase)assert.equal(M.deckH,P.DECK,id+': the fixed view keeps the low deck');
}
// the menu pictures (render3d.mapArt): a small view, the raised bridge, and nothing but the arena (no far mountains in it)
for(const id of IDS){const M=A.prep(id,{q:'low',view:{x0:-1.5,x1:W+1.5,z0:-1.5,z1:H+1.5},env:null,soft:true,thumb:true,chase:true}),k=M.kit;let top=0,far=0;
 for(const cls of A.CLS){const b=k[cls];for(let i=0;i<b.P.length;i+=3){const x=b.P[i],y=b.P[i+1],z=b.P[i+2];if(x>0.02&&x<W-0.02&&z>0.02&&z<H-0.02)top=Math.max(top,y);if(y>4)far++;}}
 assert.ok(top<=2.9,id+' menu picture: nothing taller than a prop inside the arena ('+top.toFixed(2)+')');assert.equal(far,0,id+' menu picture: '+far+' vertices of a far mountain range in it');
 if(maps[id].bridge)assert.equal(M.deckH,P.DECK_UP,id+' menu picture shows the raised bridge');}
for(const id of IDS)for(const vn of ['phone','desk','chasePhone','chaseDesk'])assert.ok(stats[id+'|low|'+vn]<stats[id+'|high|'+vn]*0.8,id+' '+vn+' real LOW workload '+stats[id+'|low|'+vn]+' vs '+stats[id+'|high|'+vn]);
assert.equal(runInContext('JSON.stringify(MAPS)',ctx),ctx.snap,'layout data untouched');
// themes and crates
for(const id of IDS){const th=P.theme(id);assert.ok(/^#[0-9a-f]{6}$/i.test(th.ground)&&['crate','metal'].includes(th.crateMat)&&['tan','steel'].includes(th.crate),id+' theme');}
console.log('PASS six maps x HIGH/LOW x phone/desktop views: finite bounded kits, LOW under 80% of HIGH, raised art only on solids or outside the arena, low south side, layout untouched, no authoritative RNG');

// ---- the environment layer ----
const lights={hemi:new T.HemisphereLight(0xffffff,0x000000,1),key:new T.DirectionalLight(0xffffff,1),fill:new T.DirectionalLight(0xffffff,1)};lights.fill.position.set(5,4,9);
const emitted=[],scene=new T.Scene(),host={scene,renderer:null,lights,emit:(add,p)=>emitted.push([add,p]),low:()=>false,quiet:()=>false};
const env=E.create(T,host);let rebakes=0;env.onRebake=()=>rebakes++;
for(const id of IDS){const M=A.prep(id,{q:'high',view:{...VIEWS.phone},env});assert.equal(env.mapId(),id);const u=env.uniforms;
 for(const k of ['uAmb','uSun','uFogC','uFog'])assert.ok(u[k].value.toArray().every(Number.isFinite),id+' '+k);
 assert.ok(u.uSun.value.x>u.uAmb.value.x,id+': the sun outshines the shade');assert.ok(lights.key.intensity>0&&lights.hemi.intensity>0);
 const d=env.sunDir();assert.ok(Math.abs(Math.hypot(...d)-1)<1e-9&&d[1]>0.5,id+' sun is above');
 assert.equal(M.sun.join(),d.join(),id+': the bake uses the layer\'s sun');}
assert.equal(rebakes,0,'loading a map is not a rebake');
// a later weather system drives it without rebuilding anything
const before=env.uniforms.uSun.value.x;env.set({sunI:1.0,fog:0.6,fogC:[0.5,0.45,0.4],stars:0.2},2);env.update(1,0);const mid=env.uniforms.uSun.value.x;env.update(1.1,1);
assert.ok(mid<before&&mid>env.uniforms.uSun.value.x-1e-9&&env.uniforms.uSun.value.x<before*0.6,'sun blends down over the time asked');
assert.ok(scene.fog&&scene.fog.far<1e6,'a haze reaches every lit mesh through scene.fog');assert.ok(Math.abs(env.uniforms.uFog.value.x-0.6)<1e-9);
env.set({sunDir:[0.3,0.8,-0.5]},0);env.update(0.016,2);assert.equal(rebakes,1,'moving the sun asks for one re-bake of the ground');
env.update(0.016,2.1);assert.equal(rebakes,1);
const id1=env.addEmitter({group:'weather',rate:120,life:[1,1],size:[0.1,0.1],color:'#ffffff',vel:[0,-6,0]});emitted.length=0;env.update(0.1,3);assert.ok(emitted.length>=4&&emitted.length<=6*env.emitters.length,'emitters write particles, capped per frame');
env.removeEmitter(id1);env.flash([1,0.9,0.7],1.5,0.3);env.update(0.016,3.1);const fl=lights.hemi.intensity;env.update(0.5,3.6);assert.ok(fl>lights.hemi.intensity,'a flash fades');
env.reset(0);env.update(0.016,4);assert.ok(Math.abs(env.uniforms.uSun.value.x-before)<1e-6&&env.uniforms.uFog.value.x===0&&!env.emitters.some(e=>e.group==='weather'),'reset returns to the map preset');
assert.equal(rebakes,2,'the sun going back is one more re-bake');
host.quiet=()=>true;emitted.length=0;for(let i=0;i<20;i++)env.update(0.1,5+i);assert.equal(emitted.length,0,'reduced motion: the air stands still');
// ---- ground marks: a bounded ring buffer ----
const mk=A.marks(64);mk.update(1);for(let i=0;i<400;i++)mk.tread('a',i*0.35,5,0.01,1,0.4);mk.scorch(3,3,1);mk.update(2);
assert.equal(mk.mesh.geometry.attributes.position.count,64*4,'marks never grow');assert.ok(Array.from(mk.mesh.geometry.attributes.position.array).every(Number.isFinite));mk.clear();mk.dispose();
console.log('PASS environment layer: six presets, blend, haze, flash, emitters, reset, one re-bake per sun move, reduced motion; bounded ground marks');
