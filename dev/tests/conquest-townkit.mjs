// Session 5C shared town kit (js/conquest/townkit.js): the town screen / Home Sector and the world-pad diorama build the
// same town from the same plan (identical instance counts for walls, corner posts, rubble, turrets, homes, buildings),
// the diorama stays a few draws with only the style programs, LOW is lighter than HIGH, the raider lanes are chevrons,
// damage shows (smoke, sparks), the 2D thumbnail marks damage, and town names are validated by the shared rule and the
// Worker (plot-name, with the call-sign profanity list). Presentation only: no economy number is read or written here.
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const ctx2d=new Proxy({},{get:(o,k)=>k in o?o[k]:k==='createImageData'?(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}):k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):k==='measureText'?()=>({width:10}):()=>{},set:(o,k,v)=>(o[k]=v,true)});
const document={createElement:()=>({width:0,height:0,style:{},getContext:()=>ctx2d}),fonts:{check:()=>true}};
class ImageData{constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4);}}class Path2D{moveTo(){}lineTo(){}rect(){}}
const c=vm.createContext({console,document,performance:{now:()=>0},ImageData,Path2D});
for(const f of ['js/vendor/three.lunar.min.js','js/rules.js','js/conquest/world.js','js/conquest/combat.js','js/conquest/plot.js','js/conquest/style.js','js/conquest/townkit.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
const {THREE:T,ConquestStyle:CS,ConquestPlot:P,ConquestTownKit:TK}=c;let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;};
const now=Date.UTC(2026,10,9);
// a CC10 town: rings in several blends, a gate, turrets of four types and levels, damage on walls and a ruined turret
function town(site){const p=P.newPlot(site,now);p.cc=10;p.b.cc.l=10;const put=(t,l)=>{const at=P.autoPlace(p,t);if(!at)return null;const id='b'+(++p.n);p.b[id]={t,...at,l};return id;};
 for(const [t,l] of [['reactor',3],['storage',2],['refinery',2],['cannon',3],['cannon',3],['mg',2],['laser',4],['railgun',5],['tesla',1],['radar',2]])put(t,l);
 let code=0;for(const [r,o,l] of [[9,0,0],[13,1,2],[17,3,3],[21,6,1]]){for(const [i,j] of P.ringCells([P.MID,P.MID],[P.MID+r,P.MID]))if(P.inTown(p.cc,i,j)&&!P.NOBUILD[P.terrainAt(p.site,i,j)]&&!P.occupancy(p).has(P.key(i,j)))p.w[P.key(i,j)]=P.wcode(o,l);code++;}
 const keys=Object.keys(p.w);p.dmg={};for(const k of keys.slice(0,6))p.dmg['w:'+k]=P.maxHpOf(p,'w:'+k);for(const k of keys.slice(6,10))p.dmg['w:'+k]=Math.floor(P.maxHpOf(p,'w:'+k)/2);
 const tur=Object.keys(p.b).find(id=>p.b[id].t==='laser');p.dmg[tur]=P.maxHpOf(p,tur);p.banner={shape:'shield',colors:['#22e6ff','#1a2230'],emblem:'moon'};p.theme={light:'amber',finish:'steel',decor:['lamps','flags']};return p;}
for(const q of ['high','low']){const S=CS.create(T,{low:q==='low'}),low=q==='low';
 for(const site of ['ridge','canyon','plateau']){const p=town(site),pl=TK.plan(p),R={T,S,k:TK.kit(S),wgeo:new Map(),hgeo:new Map(),tgeo:new Map()},g=new T.Group();
  // the town screen / Home Sector path: instanced walls, posts, rubble, turrets and homes
  const W=TK.walls(R,p,pl,low,g),tur=TK.turrets(R,p,pl,p.theme,g),H=TK.homes(R,p,pl,low,g);
  const view={walls:[...W.wim.values()].reduce((a,m)=>a+m.count,0),posts:W.wpost.size,rubble:pl.rubble.length,turrets:[...tur.values()].reduce((a,t)=>a+t.items.length,0),homes:[...H.him.values()].reduce((a,m)=>a+m.count,0),builds:pl.builds.length};
  const dio=TK.diorama(S,p,{low,scale:.1}),dc=dio.userData.counts,pc=TK.counts(pl);
  ok(JSON.stringify(view)===JSON.stringify(dc)&&JSON.stringify(pc)===JSON.stringify(dc),q+' '+site+': town screen / Home Sector and diorama instance counts match '+JSON.stringify(dc));
  ok(dc.walls>200&&dc.rubble===6&&dc.posts>10&&dc.turrets>=6&&dc.homes>20,q+' '+site+': a real CC10 town (walls, rubble for ruined cells, corner posts, turrets, homes)');
  ok(Object.keys(p.w).length===dc.walls+dc.rubble,q+' '+site+': every wall cell is either standing or rubble (no holes)');
  let draws=0,bad=0,tris=0;dio.traverse(o=>{if(!o.isMesh)return;draws++;if(o.material!==S.MAT.solid&&o.material!==S.MAT.fx&&!o.material?.userData?.conquestStyle)bad++;const ix=o.geometry.index;tris+=(ix?ix.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?Math.max(1,o.count):1);});
  ok(bad===0,q+' '+site+': the diorama uses only the Conquest style materials (no new shader programs)');
  ok(draws<=20,q+' '+site+': the diorama is '+draws+' draws (merged static part + instanced walls)');
  if(site==='ridge')console.log(' '+q+' CC10 diorama: '+draws+' draws, '+Math.round(tris/1000)+'k triangles');
  const dfx=TK.damageFx(R,p,new T.Group());ok(dfx&&dfx.src.length===5&&dfx.src.filter(x=>x.spark).length===1,q+' '+site+': damaged walls smoke and the ruined turret sparks ('+dfx?.src.length+' sources)');}
 // LOW is lighter than HIGH for every wall blend
 if(!low){const S2=CS.create(T,{low:true}),kh=TK.kit(S),kl=TK.kit(S2);let lighter=0,heavier=0,th=0,tl=0;for(let o=0;o<=6;o++)for(let l=o?1:0;l<=(o?3:0);l++){const code=P.wcode(o,l),a=kl.wallGeo(code,true).index.count,b=kh.wallGeo(code,false).index.count;th+=b;tl+=a;if(a<b)lighter++;if(a>b)heavier++;}ok(heavier===0&&lighter>=12&&tl<th*.8,'LOW walls are never heavier than HIGH, lighter for '+lighter+' of 19 blend looks, '+Math.round(100*tl/th)+'% of HIGH in all');
  {let t=0;for(let o=0;o<=6;o++)for(let l=o?1:0;l<=(o?3:0);l++)t+=kh.wallGeo(P.wcode(o,l),false).index.count/3;ok(t/19<=150,'a HIGH wall cell averages '+Math.round(t/19)+' triangles (2,000 cells at CC10)');}}}
// lanes: red chevrons pointing inward (3 per lane), never one box per gathering cell
{const S=CS.create(T,{low:false});for(const site of ['ridge','canyon','ice']){const lanes=TK.lanesOf(site,5);ok(lanes.length===P.SITES[site].lanes.length&&lanes.every(L=>Math.abs(Math.hypot(L.dx,L.dz)-1)<1e-6&&L.x*L.dx+L.z*L.dz<0),site+': every lane has an inward direction toward the town');}
 const src=fs.readFileSync('js/conquest/townkit.js','utf8');ok(src.includes('for(let s2=0;s2<3;s2++)')&&!src.includes('for(const [i,j] of cl)pr.box'),'lane marks are chevrons, not brick strips');}
// 2D thumbnail: red ring when damaged
{const p=town('ridge');let stroke=[];const g2={...ctx2d};const cv={width:0,height:0,getContext:()=>new Proxy({},{get:(o,k)=>k==='drawImage'||k==='fillRect'||k==='strokeRect'?()=>{}:k==='createImageData'?(w,h)=>({data:new Uint8ClampedArray(w*h*4)}):k in o?o[k]:()=>{},set:(o,k,v)=>{if(k==='strokeStyle')stroke.push(v);o[k]=v;return true;}})};
 TK.thumb(p,48,cv);ok(stroke.at(-1)==='#ff3048','the HUD thumbnail is ringed red while the town is damaged');p.dmg={};stroke=[];TK.thumb(p,48,cv);ok(stroke.at(-1)==='#22e6ff','and cyan when repaired');}
// town names: the shared rule, then the Worker action with the profanity list
{for(const [raw,want] of [['Iron Hold','Iron Hold'],['  Iron   Hold ','Iron Hold'],['',''],['A'.repeat(16),'A'.repeat(16)]])ok(P.townName(raw).name===want,'town name "'+raw+'" -> "'+want+'"');
 for(const raw of ['A'.repeat(17),'<b>x</b>','Town🙂','---'])ok(!!P.townName(raw).err,'town name "'+raw+'" is refused: '+P.townName(raw).err);
 const {plotAction}=await import('../../worker/src/conquest-plot.js');const s={plot:P.newPlot('ridge',now),ledger:{cp:0,banked:{alloy:0,biomass:0,helium:0}},base:{tier:1}};
 plotAction(s,{action:'plot-name',plot:{n:'Iron Hold'}},now);ok(s.plot.nm==='Iron Hold'&&s.notice?.kind==='plot-name','the Worker names the town');
 for(const bad of ['Sh1t Town','fuck','Admin Town','x'.repeat(30),'<script>'])assert.throws(()=>plotAction(s,{action:'plot-name',plot:{n:bad}},now),/conquest:/,'refused: '+bad),n++;
 ok(s.plot.nm==='Iron Hold','a refused name never changes the town');assert.throws(()=>plotAction(s,{action:'plot-name',plot:{n:'Ok',cp:5}},now),/invalid plot fields/);n++;
 plotAction(s,{action:'plot-name',plot:{n:''}},now);ok(!('nm' in s.plot),'an empty name clears it');
 const {snapshot}=await import('../../worker/src/conquest-visit.js');s.plot.nm='Iron Hold';ok(snapshot('Pilot',s.plot,now).nm==='Iron Hold','the public snapshot carries the town name for visits');}
console.log('PASS conquest-townkit ('+n+' checks): Home Sector / build view and diorama share one plan (identical instance counts at HIGH and LOW on ridge, canyon, plateau), style programs only, chevron lanes, damage smoke and sparks, thumbnail damage ring, Worker-validated town names');
