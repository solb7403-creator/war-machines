// Offline generator for the authored colony (owner art direction, Nov 8 2026): roads, core town, farm ring, frontier wall,
// monorail, power line. Rules: construction concentrates near the Refuge/oxygen station and along main roads; everything
// keeps clear of operations, deposits, bio-flora, pylons, water, forests, decks, existing structures and each other.
// usage: node dev/tools/colony-gen.mjs [--write]   (--write replaces the COLONY literal in js/conquest/world.js)
import {readFileSync,writeFileSync} from 'node:fs';import {buildSim} from '../../worker/build-sim.mjs';buildSim();
const {CONQUEST:{World:W,Combat:C}}=await import('../../worker/src/sim.gen.js');
// Loose rocks do not count (the colony's ground is cleared); the colony's own earlier output is ignored.
const hard=(x,z)=>W.structureSolidAt(x,z)&&!W.colonyLotAt(x,z)&&!W.COLONY.railPylons.some(([a,b])=>Math.hypot(a-x,b-z)<1.6);
const B=W.creekBridge,bx=(s)=>[Math.round((B.x+B.ax*s)*10)/10,Math.round((B.z+B.az*s)*10)/10];
const roads=[
 {id:'main',w:9,pts:[[1004,1128],[1226,1128],[1250,1128]]},
 {id:'refuge',w:9,pts:[[1180,1094],[1180,1206]]},
 {id:'base',w:8,pts:[[1080,1128],[1080,1140]]},
 {id:'north',w:8,pts:[[1062,1128],[1062,1072],[1086,1046],[1118,1030],[1139,1027]]},
 {id:'bridge',w:7,pts:[[1004,1128],[1001,1166],[979,1179],[953,1181],[951,1193],bx(-11),bx(11),[905,1187],[880,1178]]},
 {id:'farm',w:7,pts:[[1004,1128],[960,1112],[905,1100],[870,1086]]},
 {id:'oxy',w:8,pts:[[1100,1128],[1100,1094],[1132,1094]]},
 {id:'east',w:8,pts:[[1180,1166],[1228,1166]]},
 {id:'second',w:8,pts:[[1062,1098],[1100,1098]]},
 {id:'west',w:8,pts:[[1040,1128],[1040,1196]]},
 {id:'refuge2',w:8,pts:[[1208,1128],[1208,1196]]},
];
const ops=Object.values(C.operations),base=C.baseDefinition;
const segDist=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
const roadDist=(x,z)=>{let d=Infinity;for(const r of roads)for(let i=1;i<r.pts.length;i++)d=Math.min(d,segDist(x,z,r.pts[i-1],r.pts[i])-r.w/2);return d;};
const problems=[];
// roads: every sample on passable ground (the bridge deck counts), never through a forest core
for(const r of roads)for(let i=1;i<r.pts.length;i++){const [a,b]=[r.pts[i-1],r.pts[i]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2);for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n,deck=W.deckAt(x,z)!==null;
 if(!deck&&(hard(x,z)||W.waterAt(x,z)?.deep))problems.push('road '+r.id+' blocked at '+x.toFixed(0)+','+z.toFixed(0));if(W.forestAt(x,z)?.core)problems.push('road '+r.id+' forest core at '+x.toFixed(0)+','+z.toFixed(0));}}
const lots=[];
const why={};const no=k=>{why[k]=(why[k]||0)+1;return false;};
// exact rotated-rectangle geometry: distance from a point to a lot, and lot/lot overlap (separating axes) with a gap
const rectDist=(l,px,pz)=>{const c=Math.cos(l.r),sn=Math.sin(l.r),dx=px-l.x,dz=pz-l.z,u=Math.abs(dx*c+dz*sn)-l.w/2,v=Math.abs(-dx*sn+dz*c)-l.d/2;return Math.hypot(Math.max(u,0),Math.max(v,0))+Math.min(Math.max(u,v),0);};
const corners=l=>{const c=Math.cos(l.r),sn=Math.sin(l.r);return [[1,1],[1,-1],[-1,-1],[-1,1]].map(([a,b])=>[l.x+a*l.w/2*c-b*l.d/2*sn,l.z+a*l.w/2*sn+b*l.d/2*c]);};
function overlap(A,B,gap){const P=corners({...A,w:A.w+gap,d:A.d+gap}),Q=corners({...B,w:B.w+gap,d:B.d+gap});for(const R of [A,B])for(const ax of [[Math.cos(R.r),Math.sin(R.r)],[-Math.sin(R.r),Math.cos(R.r)]]){const pa=P.map(p=>p[0]*ax[0]+p[1]*ax[1]),qa=Q.map(p=>p[0]*ax[0]+p[1]*ax[1]);if(Math.max(...pa)<Math.min(...qa)||Math.max(...qa)<Math.min(...pa))return false;}return true;}
function clear(x,z,w,d,rot,pad,opts={}){const L={x,z,w,d,r:rot},c=Math.cos(rot),s=Math.sin(rot);
 for(let u=-w/2-pad;u<=w/2+pad;u+=2)for(let v=-d/2-pad;v<=d/2+pad;v+=2){const px=x+u*c-v*s,pz=z+u*s+v*c;if(hard(px,pz))return no('solid');if(W.waterAt(px,pz)||W.deckAt(px,pz)!==null)return no('water');if(W.forestAt(px,pz))return no('forest');}
 if(!opts.road){for(const r of roads)for(let i=1;i<r.pts.length;i++){const [a,b]=[r.pts[i-1],r.pts[i]],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let k=0;k<=n;k++)if(rectDist(L,a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n)<r.w/2+1.2)return no('road');}}
 if(!opts.field&&ops.some(o=>rectDist(L,o.x,o.z)<(opts.opGap??18)))return no('op');
 const ng=opts.nodeGap??6;if(W.deposits.some(o=>rectDist(L,o.x,o.z)<ng)||W.floraNodes.some(o=>rectDist(L,o.x,o.z)<ng)||W.pylons.some(o=>rectDist(L,o.x,o.z)<ng))return no('node');
 if(rectDist(L,1174,1168)<14||rectDist(L,base.x,base.z)<base.radius+6||C.strikeSites.some(o=>rectDist(L,o.x,o.z)<24))return no('site');
 // the home approach: a clear 7 m corridor from Main Street straight to the Refuge supply terminal (the drive to bank)
 for(let t=0;t<=44;t+=2)if(rectDist(L,1174,1124+t)<7)return no('approach');
 if(lots.some(o=>overlap(L,o,opts.gap??3)))return no('lot');
 for(let u=-w/2;u<=w/2;u+=2)for(let v=-d/2;v<=d/2;v+=2){const px=x+u*c-v*s,pz=z+u*s+v*c;if(Math.abs(W.groundAt(px,pz)-W.groundAt(x,z))>(opts.flat??4))return no('flat');}
 return true;}
const put=(k,x,z,rot,w,d,h,solid=true,extra={})=>{lots.push({k,x:Math.round(x*10)/10,z:Math.round(z*10)/10,r:Math.round(rot*1000)/1000,w,d,h,s:solid?1:0,...extra});};
const KIT={hab:[9,9,7],block:[10,8,10],shop:[10,7,5],hangar:[16,11,8],tower:[6,6,24],greenhouse:[16,8,5],silo:[7,7,13],turbine:[4,4,24],solar:[12,7,2.5],pad:[22,22,.4],wall:[26,3,5],watch:[6,6,12],turret:[5,5,4]};
// core town: fill the blocks between the streets on the plateau (axis-aligned lots, like the street grid); dense around the
// Refuge/oxygen core, thinning with distance; the plaza stays open for the landing pad
const core=[1130,1125],kindsCore=['hab','shop','block','hab','tower','shop','hab','block','hangar','shop'];let ki=0;const rh=(x,z)=>{let n=Math.imul(Math.round(x)*73856093^Math.round(z)*19349663,1274126177);return ((n^(n>>>13))>>>0)/4294967296;};
for(let gz=1060;gz<=1214;gz+=12)for(let gx=990;gx<=1242;gx+=12){const dc=Math.hypot(gx-core[0],gz-core[1]);if(dc>175||rh(gx,gz)>1.4-dc/175)continue;if(Math.hypot(gx-1120,gz-1108)<16)continue;
 const k=kindsCore[(ki++)%kindsCore.length],[w,d,h]=KIT[k],rot=(Math.round(gx/16)+Math.round(gz/15))%5===0?Math.PI/2:0;if(clear(gx,gz,w,d,rot,1,{gap:2}))put(k,gx,gz,rot,w,d,h*(.85+.4*rh(gz,gx)));}
// plaza with a landing pad and a hangar beside it (open, non-solid pad)
{const cands=[];for(let x=1000;x<=1230;x+=6)for(let z=1060;z<=1210;z+=6)cands.push([x,z]);cands.sort((a,b)=>Math.hypot(a[0]-1120,a[1]-1110)-Math.hypot(b[0]-1120,b[1]-1110));for(const [x,z] of cands){if(clear(x,z,20,20,0,1,{gap:3,field:true,flat:2.5})){put('pad',x,z,0,20,20,.4,false);for(const [hx,hz] of [[x+21,z],[x-21,z],[x,z+19],[x,z-19]])if(clear(hx,hz,16,11,0,1)){put('hangar',hx,hz,0,16,11,8);break;}break;}}}
// farm ring: crop fields (non-solid) with greenhouses, silos, turbines and solar arrays; grass/lush ground 130-320 m from the core
const fields=[];let h=4242;const rnd=()=>((h=(Math.imul(h,1664525)+1013904223)>>>0)/4294967296);
const farmCenters=[[900,1075],[875,1120],[925,1150],[905,1135],[960,1085],[1220,1335],[1265,1330],[1180,1345]];
for(const [cx,cz] of farmCenters){let made=0;for(let t=0;t<900&&made<4;t++){const x=cx+(rnd()-.5)*110,z=cz+(rnd()-.5)*90,rot=(rnd()-.5)*.5,w=24+Math.round(rnd()*12),d=14+Math.round(rnd()*8);
  if(W.terraformAt(x,z)<.3||!clear(x,z,w,d,rot,1,{gap:4,flat:3,field:true}))continue;fields.push({x:Math.round(x),z:Math.round(z),r:Math.round(rot*1000)/1000,w,d,c:made%3});lots.push({k:'field',x,z,r:rot,w,d,h:0,s:0,tmp:1});made++;
  const sx=Math.cos(rot),sz=Math.sin(rot),order=['greenhouse','silo','turbine','solar','greenhouse','silo'];let placed=0;
  for(let q=0;q<order.length&&placed<2;q++){const k=order[(q+fields.length)%order.length],[kw,kd,kh]=KIT[k];for(const off of [d/2+kd/2+3,-d/2-kd/2-3])for(const along of [0,-w/3,w/3]){if(placed>=2)break;const gx=x-sz*off+sx*along,gz=z+sx*off+sz*along;if(clear(gx,gz,kw,kd,rot,1,{opGap:12}))put(k,gx,gz,rot,kw,kd,kh),placed++;}}}}
for(const l of lots.filter(l=>l.tmp))lots.splice(lots.indexOf(l),1);
// irrigation canals: from the creek to the south-west fields (decorative shallow channels)
const canals=[];{const near=fields.filter(f=>f.x<1000).sort((a,b)=>W.creekNearest(a.x,a.z).d-W.creekNearest(b.x,b.z).d);for(const f of near.slice(0,3)){const c=W.creekNearest(f.x,f.z);if(c&&c.d<160)canals.push([[Math.round(c.x),Math.round(c.z)],[f.x,f.z]]);}}
// frontier wall: ~28 m runs with watchtowers where green meets barren on the hive side; every fifth run is an open lane.
// The oxygen line stays breached: no wall or watchtower within 60 m of the starter defense objective (Battle.objective,
// 1150,1080; beyond every Parasite weapon range), so its attackers can still reach and destroy it (conquest-combat).
const oxyBreach=(x,z,w,d,rot)=>rectDist({x,z,w,d,r:rot},1150,1080)<60;
const wallPts=[];{const cx=1150,cz=1160;for(let a=-1.0;a<=1.75;a+=0.02){const dx=Math.sin(a),dz=-Math.cos(a);let r=60;while(r<420&&W.terraformAt(cx+dx*r,cz+dz*r)>.06)r+=2;if(r>=420)continue;wallPts.push([cx+dx*(r-2),cz+dz*(r-2)]);}}
{let run=[wallPts[0]],n=0;const flush=()=>{if(run.length<2)return;const a=run[0],b=run[run.length-1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<14)return;const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,rot=Math.atan2(b[1]-a[1],b[0]-a[0]);n++;
  if(n%5===0)return;const WL=L-9;if(WL>=10&&!oxyBreach(x,z,WL,3,rot)&&clear(x,z,WL,3,rot,.5,{opGap:10,gap:.5,flat:7,nodeGap:3}))put('wall',x,z,rot,Math.round(WL*10)/10,3,5);if(!oxyBreach(b[0],b[1],6,6,rot)&&clear(b[0],b[1],6,6,rot,.5,{opGap:10,gap:.5,flat:7,nodeGap:3}))put('watch',b[0],b[1],rot,6,6,12);};
 for(let i=1;i<wallPts.length;i++){const p=wallPts[i];if(roadDist(p[0],p[1])<7){flush();run=[];continue;}if(!run.length){run=[p];continue;}const a=run[0];if(Math.hypot(p[0]-a[0],p[1]-a[1])>=28||Math.hypot(p[0]-run[run.length-1][0],p[1]-run[run.length-1][1])>12){flush();run=[run[run.length-1],p];if(Math.hypot(p[0]-run[0][0],p[1]-run[0][1])>12)run=[p];}else run.push(p);}flush();}
// gates where roads cross the wall line
for(const r of roads)for(let i=1;i<r.pts.length;i++){const [a,b]=[r.pts[i-1],r.pts[i]];for(const p of wallPts){const d=segDist(p[0],p[1],a,b);if(d<6){const rot=Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2;for(const s of [-1,1]){const gx=p[0]+Math.cos(rot)*s*(r.w/2+4),gz=p[1]+Math.sin(rot)*s*(r.w/2+4);if(clear(gx,gz,5,5,rot,.5,{road:true,opGap:20,gap:1,flat:4}))put('gate',gx,gz,rot,5,5,9);}}}}
// monorail: elevated line oxygen station -> Main Street -> spawn corridor, pylons where clear
const rail=[[1216,1150],[1216,1104],[1100,1100],[1000,1100],[952,1060],[912,1040]],railPylons=[];
for(let i=1;i<rail.length;i++){const [a,b]=[rail[i-1],rail[i]],L=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=0;t<L;t+=34){const x=a[0]+(b[0]-a[0])*t/L,z=a[1]+(b[1]-a[1])*t/L;if(clear(x,z,2.4,2.4,0,.5,{road:roadDist(x,z)>3,opGap:10,gap:2,flat:9}))railPylons.push([Math.round(x),Math.round(z)]);}}
// power line along Main Street's south side and the farm road
const power=[];for(const r of roads.filter(r=>['main','farm','refuge'].includes(r.id)))for(let i=1;i<r.pts.length;i++){const [a,b]=[r.pts[i-1],r.pts[i]],L=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/L,nz=(b[0]-a[0])/L;for(let t=0;t<=L;t+=30){const x=a[0]+(b[0]-a[0])*t/L+nx*(r.w/2+2.2),z=a[1]+(b[1]-a[1])*t/L+nz*(r.w/2+2.2);if(!hard(x,z)&&!W.waterAt(x,z)&&!lots.some(o=>Math.hypot(o.x-x,o.z-z)<Math.hypot(o.w,o.d)/2+1))power.push([Math.round(x),Math.round(z)]);}}
const count=k=>lots.filter(l=>l.k===k).length;
console.error('why',JSON.stringify(why));console.error('problems',problems.length,problems.slice(0,8));
console.error('lots',lots.length,Object.fromEntries(Object.keys(KIT).map(k=>[k,count(k)])),'fields',fields.length,'canals',canals.length,'railPylons',railPylons.length,'power',power.length,'wallPts',wallPts.length);
for(const r of roads)r.p=['north','bridge','farm'].includes(r.id)?0:1;
const data=JSON.stringify({roads,lots:lots.map(({k,x,z,r,w,d,h,s})=>({k,x,z,r,w,d,h,s})),fields,canals,rail,railPylons,power});
if(process.argv.includes('--write')){const f=new URL('../../js/conquest/world.js',import.meta.url),src=readFileSync(f,'utf8'),out=src.replace(/\/\*COLONY\*\/[\s\S]*?\/\*\/COLONY\*\//,'/*COLONY*/'+data+'/*/COLONY*/');if(out===src&&!src.includes(data))throw Error('COLONY markers not found');writeFileSync(f,out);console.error('wrote js/conquest/world.js');}
else console.log(data);
