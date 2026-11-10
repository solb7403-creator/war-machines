/* Pure moon theater contract. Absolute coordinates never depend on finite bounds or build order. */
(function(root){
'use strict';
const WIDTH=31680,LENGTH=47520,SPEED=4.4,CHUNK=128,STEP=4,SEED=0x4c554e41;
const installations=Object.freeze([
 Object.freeze({id:'redoubt-01',name:'PARASITE / ASH REDOUBT',kind:'outpost',x:1240,z:920}),
 Object.freeze({id:'staging-01',name:'PARASITE / OXYGEN SPEAR',kind:'staging',x:1230,z:995}),
 Object.freeze({id:'west-depot',name:'WESTERN SALVAGE DEPOT',kind:'outpost',x:994,z:944}),
 Object.freeze({id:'crossroads',name:'DUST CROSSROADS',kind:'staging',x:1100,z:954})
]);
// Small, authored cover footprints create five different raid approaches. Their exact
// boxes are shared by vehicle collision, shot occlusion and the client art pass.
const raidObstacles=Object.freeze([
 {id:'dust-long',layout:'dust-switchback',x:915,z:942,width:18,depth:3,height:5},
 {id:'dust-hook',layout:'dust-switchback',x:925,z:948,width:3,depth:15,height:5},
 {id:'basin-west',layout:'basin-crescent',x:1054,z:840,width:5,depth:12,height:5},
 {id:'basin-east',layout:'basin-crescent',x:1094,z:858,width:6,depth:12,height:5},
 {id:'ash-bunker',layout:'ash-approach',x:1274,z:850,width:9,depth:9,height:8},
 {id:'spear-wall',layout:'spear-flank',x:1335,z:1008,width:3,depth:25,height:6},
 {id:'ridge-west',layout:'ridge-hook',x:1270,z:1208,width:6,depth:8,height:5},
 {id:'ridge-north',layout:'ridge-hook',x:1290,z:1190,width:6,depth:8,height:5},
 {id:'ridge-east',layout:'ridge-hook',x:1312,z:1228,width:6,depth:8,height:5}
].map(Object.freeze));
function raidSolidAt(x,z,y=null){return raidObstacles.some(o=>Math.abs(x-o.x)<o.width/2&&Math.abs(z-o.z)<o.depth/2&&(y===null||y<groundAt(o.x,o.z)+o.height));}
// Authored frontier geography; the wider Moon and legacy grid sectors stay intact.
const sectors=Object.freeze([
 {id:'refuge',name:'REFUGE CORRIDOR',x:1010,z:1100,radius:115,threat:'interceptor patrols',architecture:'viaduct and supply bastions',reward:'safe banking approaches'},
 {id:'ash',name:'ASH REDOUBT',x:1250,z:900,radius:120,threat:'shielded command armor',architecture:'armored siege gates',reward:'siege command blueprints'},
 {id:'oxygen',name:'OXYGEN SPEAR',x:1230,z:1020,radius:100,threat:'mixed saboteur assaults',architecture:'reactor towers and air defense',reward:'oxygen defense reputation'},
 {id:'western',name:'WESTERN SALVAGE REACH',x:920,z:925,radius:120,threat:'fast flanking interceptors',architecture:'depot gantries',reward:'alloy recovery operations'},
 {id:'helium',name:'HELIUM BASIN',x:1080,z:835,radius:110,threat:'artillery and plasma batteries',architecture:'paired gun emplacements',reward:'helium extraction routes'},
 {id:'ridge',name:'REFUGE RIDGE',x:1270,z:1175,radius:130,threat:'drone carriers and hunter armor',architecture:'ridge signal arrays',reward:'commander telemetry'}
].map(Object.freeze));
function frontierSectorAt(x,z){return sectors.reduce((a,b)=>Math.hypot(x-a.x,z-a.z)<Math.hypot(x-b.x,z-b.z)?a:b);}
// ---- The terraformed south (docs/economy/RESOURCE_ECONOMY.md; Checkpoint 23). Authored and deterministic, shared by the
// phone and the Worker; never random noise. Atmosphere pylons sustain the green from the Refuge and the oxygen complex
// south-west across the Command Base to the ice-mining crater and down the real south-west valley to the dammed Refuge
// Reservoir. Parasite blight eats the edge near their sites; Parasite territory and the far frontier stay barren.
const pylons=Object.freeze([
 {id:'pylon-oxygen',x:1196,z:1112,r:185,dome:true},{id:'pylon-refuge',x:1194,z:1214,r:160},{id:'pylon-base',x:1072,z:1216,r:175,dome:true},
 {id:'pylon-corridor',x:1004,z:1122,r:132},{id:'pylon-crater',x:960,z:1158,r:158},{id:'pylon-valley',x:898,z:1238,r:152},{id:'pylon-reservoir',x:842,z:1318,r:158,dome:true}
].map(Object.freeze));
const blightSources=Object.freeze([...installations.map(b=>({x:b.x,z:b.z+8,r:165})),{x:1290,z:1200,r:140},{x:1080,z:835,r:150}].map(Object.freeze));
function terraformAt(x,z){
 if(x<640||x>1500||z<900||z>1520)return 0;   // the far frontier stays barren
 let t=0;for(const p of pylons){const d=Math.hypot(x-p.x,z-p.z)/p.r;if(d<1)t=Math.max(t,1-d*Math.sqrt(d));}if(!t)return 0;
 for(const b of blightSources){const d=Math.hypot(x-b.x,z-b.z)/b.r;if(d<1)t-=.95*(1-d);}
 return clamp(t+.12*(noise(x,z,37)-.5),0,1);}
const TERRA=Object.freeze({lichen:.14,grass:.33,lush:.55});
function terraZone(x,z){const t=terraformAt(x,z);return t>=TERRA.lush?'lush':t>=TERRA.grass?'grass':t>=TERRA.lichen?'lichen':'barren';}
// Parasite blight: how hard their influence presses on this point (0..1); the art shows it eating the green edge.
function blightAt(x,z){let b=0;for(const s of blightSources){const d=Math.hypot(x-s.x,z-s.z)/(s.r*1.25);if(d<1)b=Math.max(b,1-d);}return b;}
// Meltwater from the ice-mining crater runs down the real south-west valley (steepest descent on this terrain) into the
// Refuge Reservoir, held by the terraformers' dam. Water exists only where it is defined here: no ground height changes.
// Deep water blocks tracks; shallow water slows them. Cross at the two fords or the creek bridge; the dam is solid.
const water=Object.freeze({
 crater:Object.freeze({x:930,z:1180,r:13,pool:8}),
 creek:Object.freeze([[942,1182],[932,1210],[917,1236],[902,1262],[884,1286],[866,1309],[841,1325],[818,1331]].map(Object.freeze)),
 half:4.2,core:2.6,depth:1.3,carve:1.7,fordCarve:.9,top:.4,
 fords:Object.freeze([{id:'ford-upper',x:920,z:1231,r:7},{id:'ford-reservoir',x:866,z:1309,r:7}].map(Object.freeze)),   // rock-free crossings (checked against the legacy boulders)
 lake:Object.freeze({x:800,z:1326,rx:36,rz:40,surface:-95.5}),
 dam:Object.freeze({x0:768,x1:834,z:1364,depth:4,height:3})
});
const WBOX=[750,960,1160,1372];
function carve(x,z){let c=0;const k=water.crater,dk=Math.hypot(x-k.x,z-k.z);if(dk<k.pool+3)c=2.2*smooth(1-(dk-k.pool+1)/4);
 const n=creekNearest(x,z);if(n&&n.d<5.5){let C=water.carve;for(const f of water.fords){const df=Math.hypot(x-f.x,z-f.z);if(df<f.r+3)C=Math.min(C,mix(water.fordCarve,water.carve,smooth((df-f.r+1)/4)));}c=Math.max(c,C*smooth(1-n.d/5.5));}
 const L=water.lake,e=Math.hypot((x-L.x)/L.rx,(z-L.z)/L.rz);if(e<1&&z<water.dam.z)c=Math.max(c,smooth((1-e)/.25));return c;}
// The water surface along the creek / in the crater pool: 0.4 m under the uncarved ground at the nearest centre point.
function waterTopAt(x,z){const k=water.crater;if(Math.hypot(x-k.x,z-k.z)<k.pool)return baseHeight(k.x,k.z)-water.top;const n=creekNearest(x,z);return n?baseHeight(n.gx,n.gz)-water.top:null;}
// Nearest point on the creek polyline: {d, t (0..1 along the whole creek), gx, gz}
function creekNearest(x,z){const c=water.creek;let best=null,run=0,total=0;for(let i=1;i<c.length;i++)total+=Math.hypot(c[i][0]-c[i-1][0],c[i][1]-c[i-1][1]);
 for(let i=1;i<c.length;i++){const [ax,az]=c[i-1],[bx,bz]=c[i],dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz,u=clamp(((x-ax)*dx+(z-az)*dz)/l2,0,1),px=ax+dx*u,pz=az+dz*u,d=Math.hypot(x-px,z-pz),seg=Math.sqrt(l2);if(!best||d<best.d)best={d,t:(run+seg*u)/total,gx:px,gz:pz};run+=seg;}return best;}
// The creek bridge spans the creek at its middle; the deck ramps from bank to bank (no step at either end).
const creekBridge=(()=>{const [ax,az]=water.creek[0],[bx,bz]=water.creek[1],cx=ax+(bx-ax)*.55,cz=az+(bz-az)*.55,l=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/l,uz=(bz-az)/l;return Object.freeze({id:'creek-bridge',x:cx,z:cz,ax:-uz,az:ux,half:9,width:3.4});})();
// s: across the creek along the deck (-half..half); w: along the creek (deck width).
function creekBridgeLocal(x,z){const b=creekBridge,dx=x-b.x,dz=z-b.z;return {s:dx*b.ax+dz*b.az,w:dx*b.az-dz*b.ax};}
function creekBridgeDeck(x,z){const b=creekBridge,l=creekBridgeLocal(x,z);if(Math.abs(l.s)>b.half||Math.abs(l.w)>b.width)return null;const ga=groundAt(b.x-b.ax*b.half,b.z-b.az*b.half),gb=groundAt(b.x+b.ax*b.half,b.z+b.az*b.half),u=(l.s+b.half)/(2*b.half);return mix(ga,gb,u)+Math.sin(u*Math.PI)*Math.max(0,baseHeight(b.x,b.z)-water.top+.9-mix(ga,gb,.5));}
// Water at a point: null when dry, else {depth, deep, kind}. Fords cap the depth; the bridge deck is a separate surface.
function waterAt(x,z){if(x<WBOX[0]||x>WBOX[1]||z<WBOX[2]||z>WBOX[3])return null;const g=groundAt(x,z);let top=null,kind=null;
 const k=water.crater;if(Math.hypot(x-k.x,z-k.z)<k.pool){top=baseHeight(k.x,k.z)-water.top;kind='pool';}
 const L=water.lake;if(z<water.dam.z&&Math.hypot((x-L.x)/L.rx,(z-L.z)/L.rz)<1&&g<L.surface&&(top===null||L.surface>top)){top=L.surface;kind='lake';}
 if(top===null){const n=creekNearest(x,z);if(n&&n.d<water.half){top=baseHeight(n.gx,n.gz)-water.top;kind=n.d<water.core?'creek':'bank';}}
 if(top===null||top<=g+.12)return null;let depth=top-g;
 const ford=water.fords.find(f=>Math.hypot(x-f.x,z-f.z)<f.r);if(ford)depth=Math.min(depth,.55);
 return {depth,deep:kind!=='bank'&&!ford&&depth>1,kind:ford?'ford':kind,top};}
// Forest stands: the canopy blocks shots and line of sight inside the dense core (cover); tracks pass between trunks.
const forests=Object.freeze([
 {id:'forest-crater',x:972,z:1216,r:21},{id:'forest-valley',x:878,z:1222,r:17},{id:'forest-falls',x:836,z:1279,r:16},
 {id:'forest-base-south',x:1048,z:1236,r:22},{id:'forest-refuge-south',x:1132,z:1246,r:20}
].map(Object.freeze));
const FOREST_CANOPY=7.5,FOREST_EDGE=3;
// Harvestable bio-flora: the main Biomass source. Fixed authored nodes on lush and grass ground, stable ids, placed clear
// of operations, bases, pylons and patrol routes (half of them along the creek).
const floraNodes=Object.freeze([[1048,1094],[1204,1112],[952,1160],[898,1166],[922,1184],[964,1184],[862,1190],[952,1214],[898,1220],[928,1226],[880,1250],[928,1256],[766,1262],[1042,1274],[808,1280],[874,1286],[904,1292],[934,1292],[970,1292],[850,1310],[874,1322],[850,1340],[754,1352],[730,1370]].map(([x,z],i)=>Object.freeze({id:'flora-'+String(i+1).padStart(2,'0'),x,z})));
const HARVEST=Object.freeze({radius:6,channelMs:4000,respawnMs:900000,biomass:3,noiseRadius:120});
// Mineral vein spots (docs/economy/RESOURCE_ECONOMY.md §5.2), authored by rule and frozen here. Each is a CANDIDATE spot: the
// server keeps a few live veins per (mineral, sector) field at these spots, a vein runs dry after a few pulls and a new one
// surfaces at another spot of the same field (owner ore fix, Nov 8 2026; worker/src/conquest-veins.js). Placement: Ferrite on open ground within
// 40 m of routes in every sector; Ilmenite on off-route basalt (Helium Basin, Western Salvage Reach, Ash approaches);
// Armalcolite on the HARD walls (Ash Redoubt, Refuge Ridge, Oxygen Spear); Tranquillityite only at VETERAN raid perimeters
// and hive edges; the Starter Vein beside the Refuge terminal. Every node is reachable and clear of structures, water,
// forests and flora (conquest-minerals test). Gathering rules live in rules.js (MN_GATHER, MN_SCAN).
const deposits=Object.freeze([
 ['starter',[[1189,1170]]],
 ['fe',[[1031,1087],[948,1102],[1173,921],[1249,872],[1168,1070],[1245,1053],[893,945],[946,907],[1130,879],[1096,814],[1201,1140],[1258,1206],[1013,1114],[1153,1159],[1025,1046],[874,1038],[889,1004],[895,902],
  [989,1085],[893,1060],[991,1130],[956,1075],[1056,1174],[1129,1097],[1090,1123],[1133,1132],[1131,1069],[1137,1188],[1200,1193],[975,1108],[936,1129],[923,889],[1179,1100],[912,1037],[1090,1186],[994,1049]]],
 ['il',[[1299,1001],[1011,800],[940,1003],[1211,842],[1091,899],[941,862],[902,986],[1019,861],[826,908],[1132,788],[895,879],[976,1005],[1309,870],[1144,824],[1052,931],[983,886],[819,945],[1042,888],[1277,1014]]],
 ['ar',[[1247,1112],[1293,1037],[1206,877],[1281,1137],[1187,982],[1280,1269],[1332,896],[1271,945],[1288,1228],[1214,1165]]],
 ['tq',[[1355,1018],[1223,1026],[1259,1242],[1250,942],[1272,827],[1310,1210]]]
].flatMap(([m,L])=>L.map(([x,z],i)=>Object.freeze({id:m+'-'+String(i+1).padStart(2,'0'),m,mineral:m==='starter'?'fe':m,x,z}))));
// Presentation helper (phone and MAP): the ore this pilot has scanned, from the public state. The Worker sends scanned veins
// only (s.veins: {left, cap, dry}); the Starter Vein stays in s.found / s.deposits. An exhausted vein is listed (ready:false)
// for MN_VEIN.dryShowMs after it ran dry, then it disappears.
function knownOre(s,now=Date.now()){const out=[];if(!s)return out;const show=typeof MN_VEIN!=='undefined'?MN_VEIN.dryShowMs:600000;
 for(const d of deposits){if(d.m==='starter'){if(s.found?.[d.id]&&!s.deposits?.[d.id])out.push({d,left:35,cap:35,ready:true});continue;}
  const v=s.veins?.[d.id];if(!v)continue;const dry=!(v.left>0);if(dry&&now-(Number(v.dry)||0)>show)continue;out.push({d,left:Math.max(0,v.left|0),cap:v.cap|0,ready:!dry});}
 return out;}
// The colony (owner art direction, Nov 8 2026): about 30% of the terraformed zones are built (core town, farm ring, frontier
// wall, roads), the rest stays wild. Authored by dev/tools/colony-gen.mjs and frozen here. Solid lots (buildings, wall pieces,
// watchtowers, gates) and the monorail pylons collide like any structure and block sight up to their height; fields, pads
// and roads are open ground. The colony's ground is cleared of loose rocks. Paved roads are 15% faster (advance); dirt tracks toward the frontier are not.
const COLONY=Object.freeze(/*COLONY*/{"roads":[{"id":"main","w":9,"pts":[[1004,1128],[1226,1128],[1250,1128]],"p":1},{"id":"refuge","w":9,"pts":[[1180,1094],[1180,1206]],"p":1},{"id":"base","w":8,"pts":[[1080,1128],[1080,1140]],"p":1},{"id":"north","w":8,"pts":[[1062,1128],[1062,1072],[1086,1046],[1118,1030],[1139,1027]],"p":0},{"id":"bridge","w":7,"pts":[[1004,1128],[1001,1166],[979,1179],[953,1181],[951,1193],[946.9,1201.1],[926.1,1193.7],[905,1187],[880,1178]],"p":0},{"id":"farm","w":7,"pts":[[1004,1128],[960,1112],[905,1100],[870,1086]],"p":0},{"id":"oxy","w":8,"pts":[[1100,1128],[1100,1094],[1132,1094]],"p":1},{"id":"east","w":8,"pts":[[1180,1166],[1228,1166]],"p":1},{"id":"second","w":8,"pts":[[1062,1098],[1100,1098]],"p":1},{"id":"west","w":8,"pts":[[1040,1128],[1040,1196]],"p":1},{"id":"refuge2","w":8,"pts":[[1208,1128],[1208,1196]],"p":1}],"lots":[{"k":"hab","x":990,"z":1060,"r":0,"w":9,"d":9,"h":7.3818260482512414,"s":1},{"k":"shop","x":1002,"z":1060,"r":0,"w":10,"d":7,"h":4.646892594639212,"s":1},{"k":"hab","x":1038,"z":1060,"r":0,"w":9,"d":9,"h":6.319696632958949,"s":1},{"k":"tower","x":1050,"z":1060,"r":0,"w":6,"d":6,"h":29.84941530525684,"s":1},{"k":"hangar","x":1098,"z":1060,"r":1.571,"w":16,"d":11,"h":9.546995072811843,"s":1},{"k":"shop","x":1110,"z":1060,"r":1.571,"w":10,"d":7,"h":4.462723782286048,"s":1},{"k":"hab","x":1122,"z":1060,"r":0,"w":9,"d":9,"h":7.718970770947635,"s":1},{"k":"shop","x":1194,"z":1060,"r":0,"w":10,"d":7,"h":5.696256113704294,"s":1},{"k":"hab","x":1206,"z":1060,"r":0,"w":9,"d":9,"h":7.080656672921031,"s":1},{"k":"block","x":1230,"z":1060,"r":0,"w":10,"d":8,"h":11.435258345678449,"s":1},{"k":"shop","x":1002,"z":1072,"r":0,"w":10,"d":7,"h":5.765334712807089,"s":1},{"k":"hab","x":1014,"z":1072,"r":0,"w":9,"d":9,"h":6.056905364897102,"s":1},{"k":"shop","x":1038,"z":1072,"r":0,"w":10,"d":7,"h":5.550181840080768,"s":1},{"k":"block","x":1230,"z":1072,"r":0,"w":10,"d":8,"h":12.100852691568434,"s":1},{"k":"tower","x":1074,"z":1084,"r":0,"w":6,"d":6,"h":29.322989369183777,"s":1},{"k":"shop","x":1086,"z":1084,"r":1.571,"w":10,"d":7,"h":5.850163957104087,"s":1},{"k":"hab","x":1098,"z":1084,"r":0,"w":9,"d":9,"h":6.020307448599487,"s":1},{"k":"block","x":1110,"z":1084,"r":0,"w":10,"d":8,"h":12.111318618990481,"s":1},{"k":"block","x":1230,"z":1084,"r":0,"w":10,"d":8,"h":8.600961877033114,"s":1},{"k":"block","x":1194,"z":1096,"r":0,"w":10,"d":8,"h":11.933374683372676,"s":1},{"k":"tower","x":1218,"z":1096,"r":0,"w":6,"d":6,"h":29.582374341040847,"s":1},{"k":"shop","x":1230,"z":1096,"r":1.571,"w":10,"d":7,"h":5.228791213128716,"s":1},{"k":"hab","x":1038,"z":1108,"r":0,"w":9,"d":9,"h":7.398093136213719,"s":1},{"k":"shop","x":1050,"z":1108,"r":1.571,"w":10,"d":7,"h":4.506891058757901,"s":1},{"k":"hab","x":1074,"z":1108,"r":0,"w":9,"d":9,"h":8.478195757977664,"s":1},{"k":"tower","x":1086,"z":1108,"r":0,"w":6,"d":6,"h":29.336763951927423,"s":1},{"k":"hab","x":1146,"z":1108,"r":0,"w":9,"d":9,"h":8.742358691617847,"s":1},{"k":"block","x":1158,"z":1108,"r":0,"w":10,"d":8,"h":9.900076447054744,"s":1},{"k":"hab","x":990,"z":1144,"r":0,"w":9,"d":9,"h":7.3122970818541955,"s":1},{"k":"block","x":1014,"z":1144,"r":0,"w":10,"d":8,"h":11.981331188231707,"s":1},{"k":"hab","x":1026,"z":1144,"r":1.571,"w":9,"d":9,"h":6.42365580368787,"s":1},{"k":"hab","x":990,"z":1156,"r":0,"w":9,"d":9,"h":5.974063102249056,"s":1},{"k":"block","x":1026,"z":1156,"r":0,"w":10,"d":8,"h":8.506260810419917,"s":1},{"k":"tower","x":1050,"z":1156,"r":0,"w":6,"d":6,"h":22.4010443598032,"s":1},{"k":"hab","x":1050,"z":1192,"r":1.571,"w":9,"d":9,"h":6.637634994369001,"s":1},{"k":"tower","x":1062,"z":1192,"r":1.571,"w":6,"d":6,"h":26.997377034276724,"s":1},{"k":"shop","x":1074,"z":1192,"r":0,"w":10,"d":7,"h":5.2010359186679125,"s":1},{"k":"tower","x":1050,"z":1204,"r":0,"w":6,"d":6,"h":25.62240270674229,"s":1},{"k":"shop","x":1062,"z":1204,"r":0,"w":10,"d":7,"h":5.908664041664451,"s":1},{"k":"hab","x":1086,"z":1204,"r":0,"w":9,"d":9,"h":8.621552816126496,"s":1},{"k":"pad","x":1012,"z":1096,"r":0,"w":20,"d":20,"h":0.4,"s":0},{"k":"silo","x":918.8,"z":1079.8,"r":0.146,"w":7,"d":7,"h":13,"s":1},{"k":"silo","x":906.9,"z":1078,"r":0.146,"w":7,"d":7,"h":13,"s":1},{"k":"greenhouse","x":918.2,"z":1163.5,"r":0.106,"w":16,"d":8,"h":5,"s":1},{"k":"wall","x":980.5,"z":1046.6,"r":0.203,"w":12.6,"d":3,"h":5,"s":1},{"k":"watch","x":1011.6,"z":1054.6,"r":0.278,"w":6,"d":6,"h":12,"s":1},{"k":"wall","x":1022.4,"z":1057.1,"r":0.223,"w":13.3,"d":3,"h":5,"s":1},{"k":"watch","x":1310.9,"z":1093.7,"r":0.956,"w":6,"d":6,"h":12,"s":1},{"k":"watch","x":1300.3,"z":1118.3,"r":1.977,"w":6,"d":6,"h":12,"s":1},{"k":"wall","x":1272,"z":1145.8,"r":2.439,"w":17.5,"d":3,"h":5,"s":1},{"k":"watch","x":1261.9,"z":1154.3,"r":2.439,"w":6,"d":6,"h":12,"s":1},{"k":"wall","x":1255.2,"z":1165.6,"r":2.104,"w":17.2,"d":3,"h":5,"s":1},{"k":"gate","x":1053.8,"z":1067.2,"r":0,"w":5,"d":5,"h":9,"s":1},{"k":"gate","x":1069.8,"z":1067.2,"r":0,"w":5,"d":5,"h":9,"s":1},{"k":"gate","x":1061.9,"z":1064.5,"r":0.745,"w":5,"d":5,"h":9,"s":1},{"k":"gate","x":1073.6,"z":1075.3,"r":0.745,"w":5,"d":5,"h":9,"s":1}],"fields":[{"x":921,"z":1065,"r":0.146,"w":36,"d":17,"c":0},{"x":867,"z":1117,"r":0.174,"w":30,"d":18,"c":1},{"x":906,"z":1119,"r":0.103,"w":30,"d":14,"c":2},{"x":920,"z":1150,"r":0.106,"w":35,"d":14,"c":0},{"x":960,"z":1129,"r":0.159,"w":31,"d":15,"c":0},{"x":970,"z":1090,"r":0.008,"w":24,"d":18,"c":0}],"canals":[[[null,null],[920,1150]],[[null,null],[960,1129]],[[null,null],[906,1119]]],"rail":[[1216,1150],[1216,1104],[1100,1100],[1000,1100],[952,1060],[912,1040]],"railPylons":[[1216,1150],[1216,1116],[1216,1104],[1114,1100],[1032,1100],[974,1078],[952,1060],[922,1045]],"power":[[1004,1135],[1034,1135],[1064,1135],[1094,1135],[1124,1135],[1154,1135],[1184,1135],[1214,1135],[1226,1135],[1173,1094],[1173,1124],[1173,1154],[1173,1184],[1006,1123],[978,1112],[961,1106],[932,1100],[907,1095],[879,1084]]}/*/COLONY*/);
const ROAD_FAST=1.15,colonyGrid=new Map(),cg=(x,z)=>Math.floor(x/32)+':'+Math.floor(z/32);
{const addTo=(x0,z0,x1,z1,item)=>{for(let i=Math.floor(x0/32);i<=Math.floor(x1/32);i++)for(let j=Math.floor(z0/32);j<=Math.floor(z1/32);j++){const k=i+':'+j;(colonyGrid.get(k)||colonyGrid.set(k,{lots:[],roads:[],cleared:[]}).get(k));colonyGrid.get(k)[item.t].push(item.v);}};
 for(const l of [...COLONY.lots,...COLONY.fields.map(f=>({...f,k:'field',s:0,h:0}))]){const R=Math.hypot(l.w,l.d)/2+3,v={...l,c:Math.cos(l.r),sn:Math.sin(l.r)};addTo(l.x-R,l.z-R,l.x+R,l.z+R,{t:'lots',v});addTo(l.x-R,l.z-R,l.x+R,l.z+R,{t:'cleared',v:{...v,pad:3}});}
 for(const r of COLONY.roads)for(let i=1;i<r.pts.length;i++){const [a,b]=[r.pts[i-1],r.pts[i]],m=r.w/2+3,v={a,b,hw:r.w/2,paved:!!r.p};addTo(Math.min(a[0],b[0])-m,Math.min(a[1],b[1])-m,Math.max(a[0],b[0])+m,Math.max(a[1],b[1])+m,{t:'roads',v});}}
const inLot=(l,x,z,pad=0)=>{const dx=x-l.x,dz=z-l.z,u=dx*l.c+dz*l.sn,v=-dx*l.sn+dz*l.c;return Math.abs(u)<=l.w/2+pad&&Math.abs(v)<=l.d/2+pad;};
const segD=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
function colonyLotAt(x,z){const c=colonyGrid.get(cg(x,z));if(!c)return null;for(const l of c.lots)if(l.s&&inLot(l,x,z))return l;return null;}
function roadAt(x,z){const c=colonyGrid.get(cg(x,z));if(!c)return false;for(const r of c.roads)if(r.paved&&segD(x,z,r.a,r.b)<=r.hw)return true;return false;}   // paved roads only (dirt tracks are not faster)
function clearedAt(x,z){const c=colonyGrid.get(cg(x,z));if(!c)return false;for(const l of c.cleared)if(inLot(l,x,z,3))return true;for(const r of c.roads)if(segD(x,z,r.a,r.b)<=r.hw+3)return true;return false;}
const railPylonAt=(x,z)=>COLONY.railPylons.some(([px,pz])=>Math.abs(x-px)<1.5&&Math.abs(z-pz)<1.5&&Math.hypot(x-px,z-pz)<1.4);
function forestAt(x,z){if(x<810||x>1160||z<1190||z>1275)return null;for(const f of forests){const d=Math.hypot(x-f.x,z-f.z);if(d<f.r)return {...f,d,core:d<f.r-FOREST_EDGE};}return null;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function hash(x,z){let n=Math.imul(x^SEED,374761393)^Math.imul(z,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967295;}
function noise(x,z,s){x/=s;z/=s;let i=Math.floor(x),j=Math.floor(z),u=smooth(x-i),v=smooth(z-j);return mix(mix(hash(i,j),hash(i+1,j),u),mix(hash(i,j+1),hash(i+1,j+1),u),v);}
function baseHeight(x,z){
 let h=(noise(x,z,2800)-.5)*720+(noise(x,z,600)-.5)*150+(noise(x,z,110)-.5)*16;
 // Broad highland uplift stays in the one canonical ground provider, including collision and map relief.
 h+=230*smooth((noise(x,z,1500)-.48)/.18);
 // Seeded crater in every infinite global sector; no dependence on theater extents.
 const sx=Math.floor(x/2400),sz=Math.floor(z/2400);
 for(let a=sx-1;a<=sx+1;a++)for(let b=sz-1;b<=sz+1;b++){const cx=(a+.2+hash(a,b)*.6)*2400,cz=(b+.2+hash(b,a)*.6)*2400,r=230+hash(a+9,b)*330,d=Math.hypot(x-cx,z-cz)/r;h+=55*Math.exp(-Math.pow((d-1)/.16,2))-95*Math.exp(-d*d*2);}
 const blend=1-smooth((Math.hypot((x-1024)*.8,z-1024)-150)/180);
 const local=-13*Math.exp(-Math.pow((x-1024)/42,2)) + 26*Math.exp(-Math.pow((x-1210)/65,2)-Math.pow((z-1130)/65,2));
 return mix(h,local,blend);
}
// The creek channel, crater bowl and lakebed are carved into the ground inside the south-west water box only; every
// other point of the Moon keeps its exact height.
function heightAt(x,z){const h=baseHeight(x,z);return x<WBOX[0]||x>WBOX[1]||z<WBOX[2]||z>WBOX[3]?h:h-carve(x,z);}
// Bounded fine-grid cache; numeric in-world keys avoid hot-path strings. The stride exceeds
// the padded Z range; out-of-region queries retain collision-free string keys.
const gridCache=new Map();
function gridHeight(x,z){const k=x>=-4&&x<=WIDTH+4&&z>=-4&&z<=LENGTH+4?(x+4)*(LENGTH+12)+z+4:x+':'+z;const cached=gridCache.get(k);if(cached!==undefined)return cached;const h=heightAt(x,z);if(gridCache.size>=16384)gridCache.delete(gridCache.keys().next().value);gridCache.set(k,h);return h;}
// Exact piecewise triangle interpolation matches the fine rendered ground, including at edges.
function groundAt(x,z){const a=Math.floor(x/STEP)*STEP,b=Math.floor(z/STEP)*STEP,u=(x-a)/STEP,v=(z-b)/STEP,h=gridHeight(a,b),e=gridHeight(a+STEP,b),n=gridHeight(a,b+STEP),ne=gridHeight(a+STEP,b+STEP);return u+v<=1?h+(e-h)*u+(n-h)*v:ne+(n-ne)*(1-u)+(e-ne)*(1-v);}
function surfaceNormal(x,z){const a=Math.floor(x/STEP)*STEP,b=Math.floor(z/STEP)*STEP,u=(x-a)/STEP,v=(z-b)/STEP,h=gridHeight(a,b),e=gridHeight(a+STEP,b),n=gridHeight(a,b+STEP),ne=gridHeight(a+STEP,b+STEP);const dx=(u+v<=1?e-h:ne-n)/STEP,dz=(u+v<=1?n-h:ne-e)/STEP,l=Math.hypot(dx,1,dz);return [-dx/l,1/l,-dz/l];}
function normalAt(x,z){const dx=(heightAt(x+.5,z)-heightAt(x-.5,z)),dz=(heightAt(x,z+.5)-heightAt(x,z-.5)),l=Math.hypot(dx,1,dz);return [-dx/l,1/l,-dz/l];}
function biomeAt(x,z){if(terraformAt(x,z)>=TERRA.lichen)return 'terraformed';return noise(x,z,1500)>.54?'massif':'wasteland';}
function deckAt(x,z){if(x<900||x>1140||Math.abs(z-1024)>9)return Math.abs(x-creekBridge.x)<13&&Math.abs(z-creekBridge.z)<13?creekBridgeDeck(x,z):null;return x<960?mix(groundAt(900,z),24,(x-900)/60):x>1080?mix(24,groundAt(1140,z),(x-1080)/60):24;}
function surfacesAt(x,z){const a=[{id:'ground',y:groundAt(x,z)}],y=deckAt(x,z);if(y!==null)a.push({id:'bridge',y});return a;}
function structureSolidAt(x,z){if(raidSolidAt(x,z))return true;if(installations.some(b=>Math.abs(x-b.x)<11&&Math.abs(z-b.z-8)<8||Math.hypot(x-b.x-14,z-b.z-10)<2))return true;for(let i=0;i<3;i++)if(Math.hypot(x-(1150+i*30),z-1080)<12)return true;for(let i=0;i<9;i++)if(Math.hypot(x-(1110+i%3*22),z-(1148+Math.floor(i/3)*25))<7.8)return true;const dm=water.dam;if(x>dm.x0&&x<dm.x1&&Math.abs(z-dm.z)<dm.depth/2)return true;for(const p of pylons)if(Math.abs(x-p.x)<2.2&&Math.abs(z-p.z)<2.2&&Math.hypot(x-p.x,z-p.z)<1.8)return true;if(colonyLotAt(x,z)||railPylonAt(x,z))return true;return false;}
// Match the deterministic rendered boulders. Cache bounded chunk descriptors, not meshes.
const rockCache=new Map();
function rockSolid(x,z,y=null){for(let j=Math.floor((z-8)/128);j<=Math.floor((z+8)/128);j++)for(let i=Math.floor((x-8)/128);i<=Math.floor((x+8)/128);i++){const key=i+':'+j;let rocks=rockCache.get(key);if(!rocks){rocks=scenery(i,j).filter(p=>p.kind==='rock'&&p.variant>.45).map(p=>({...p,rx:p.size*1.6+1,rz:p.size+1,top:p.y+p.size*(.8+p.variant)}));if(rockCache.size>=128)rockCache.delete(rockCache.keys().next().value);rockCache.set(key,rocks);}for(const p of rocks){if(Math.abs(x-p.x)>=p.rx||Math.abs(z-p.z)>=p.rz||y!==null&&!(y<p.top))continue;if(Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz)<1)return true;}}return false;}
function solidAt(x,z){return structureSolidAt(x,z)||rockSolid(x,z);}
// Exact slab intersection avoids a sampling gap at thin bunker corners.
let coverOccluders;
function installationOccludes(a,b){coverOccluders=coverOccluders||[...installations.map(site=>({x:site.x,z:site.z+8,width:18,depth:12,height:12,baseY:groundAt(site.x,site.z)})),...raidObstacles.map(site=>({...site,baseY:groundAt(site.x,site.z)}))];return coverOccluders.some(site=>{let lo=0,hi=1;for(const [axis,min,max] of [['x',site.x-site.width/2,site.x+site.width/2],['z',site.z-site.depth/2,site.z+site.depth/2],['y',-Infinity,(site.baseY??groundAt(site.x,site.z))+site.height]]){const delta=b[axis]-a[axis];if(Math.abs(delta)<1e-10){if(a[axis]<=min||a[axis]>=max)return false;continue;}const t0=(min-a[axis])/delta,t1=(max-a[axis])/delta;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>=hi)return false;}return hi>1e-6&&lo<1-1e-6;});}
// Shared physical shot occlusion; structure footprints have finite heights, bridge has real underside.
function blockedAt(x,y,z){if(raidSolidAt(x,z,y))return true;{const l=colonyLotAt(x,z);if(l&&y<groundAt(l.x,l.z)+l.h)return true;}if(installations.some(b=>Math.abs(x-b.x)<9&&Math.abs(z-b.z-8)<6&&y<groundAt(b.x,b.z)+12))return true;if(y<=groundAt(x,z)||rockSolid(x,z,y))return true;const deck=deckAt(x,z);if(deck!==null&&y>=deck-1.3&&y<=deck+.25)return true;
 if(z>1068&&z<1092&&x>1138&&x<1222)for(let i=0;i<3;i++){const a=1150+i*30;if(Math.hypot(x-a,z-1080)<12&&y<groundAt(a,1080)+108+i%2*38)return true;}
 if(x>1102&&x<1162&&z>1140&&z<1206)for(let i=0;i<9;i++){const a=1110+i%3*22,b=1148+Math.floor(i/3)*25;if(Math.hypot(x-a,z-b)<8&&y<groundAt(a,b)+9)return true;}
 if(x>dm0&&x<dm1&&Math.abs(z-water.dam.z)<water.dam.depth/2&&y<groundAt(x,z)+water.dam.height+6)return true;
 const f=forestAt(x,z);if(f&&f.core&&y<groundAt(x,z)+FOREST_CANOPY)return true;
 for(const p of pylons)if(Math.hypot(x-p.x,z-p.z)<1.8&&y<groundAt(p.x,p.z)+14)return true;
 return [970,1070].some(a=>[1018,1030].some(b=>Math.abs(x-a)<1.5&&Math.abs(z-b)<1.5&&y<24));}
const dm0=water.dam.x0,dm1=water.dam.x1;
function move(p,dx,dz){
 let x=clamp(p.x+dx,1,WIDTH-1),z=clamp(p.z+dz,1,LENGTH-1),d=Math.hypot(x-p.x,z-p.z),surface=p.surface||'ground';if(!d)return p;
 if(surface==='ground'&&solidAt(x,z))return p;
 let y=groundAt(x,z),deck=deckAt(x,z);
 if(surface==='bridge') {if(deck===null){if(Math.abs(p.z-1024)<=9.5&&p.x>901&&p.x<1139)return p;if(Math.abs(creekBridgeLocal(p.x,p.z).s)<creekBridge.half-.6)return p;surface='ground';}else y=deck;}
 else if(deck!==null&&Math.abs(deck-p.y)<=d*.55+.03){y=deck;surface='bridge';}
 if(surface==='ground'&&deck!==null&&deck-y<3.8)return p;
 // Deep water: tracks cannot enter it (a hull already in deep water may always drive out).
 if(surface==='ground'){const w=waterAt(x,z);if(w&&w.deep&&!waterAt(p.x,p.z)?.deep)return p;}
 // Pillars are solid on the lower route, away from its clear centerline.
 if(surface==='ground'&&[970,1070].some(a=>Math.abs(x-a)<3.5)&&[1018,1030].some(b=>Math.abs(z-b)<3.5))return p;
 if(surface==='ground'){
  // Evaluate support over the six-unit track footprint, rather than vetoing a
  // microstep from a single triangle normal. Ascending and descending share
  // the same traction envelope; sharp cliff faces still reject fall-line motion.
  const ux=(x-p.x)/d,uz=(z-p.z)/d,cx=(p.x+x)/2,cz=(p.z+z)/2;
  const support=(groundAt(cx+ux*3,cz+uz*3)-groundAt(cx-ux*3,cz-uz*3))/6;
  const along=(y-p.y)/d;
  if(Math.abs(support)>1.55||Math.abs(along)>1.7)return p;
 }else if(Math.abs(y-p.y)>d*.65+.001)return p;
 return {x,z,y,surface};
}
// Exploration travel only, after authoritative permanent equipment; never a combat stat.
function travelSpeed(L){return machineSpeed(L)*2;}
function groundColor(x,z,b){const base=b==='massif'?[.38,.39,.43]:[.48,.44,.39],t=terraformAt(x,z);if(t<=0)return base;const k=Math.min(1,t/.85);return [mix(base[0],.12,k),mix(base[1],.36,k),mix(base[2],.16,k)];}
// A slow frame still advances the clock (clamped to 250 ms); only a real pause (over a second: a hidden tab, a resume) is dropped.
// Before, any frame slower than 250 ms was discarded whole, so a device that renders slower than 4 fps (software GL, a weak laptop
// in Telegram Desktop, a 1440x900 window on the CI runner) froze the simulation and the tank never moved (Session 5D).
function frameSeconds(previous,now){const dt=(now-previous)/1000;return Number.isFinite(dt)&&dt>0&&dt<=1?Math.min(dt,.25):0;}
const WATER_SLOW=.55;
// The terrain speed factor advance() applies from p: shallow water slows, paved roads are faster. Footing probes scale by it.
function speedFactor(p){return p.surface!=='bridge'&&p.x>WBOX[0]&&p.x<WBOX[1]&&p.z>WBOX[2]&&p.z<WBOX[3]&&waterAt(p.x,p.z)?WATER_SLOW:p.surface!=='air'&&roadAt(p.x,p.z)?ROAD_FAST:1;}
function advance(p,dx,dz){const f=speedFactor(p);dx*=f;dz*=f;const nSteps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.2));for(let i=0;i<nSteps;i++){const next=move(p,dx/nSteps,dz/nSteps);if(next===p){
 // Project onto the local contour; every candidate still passes the same solids and slope checks.
 const n=surfaceNormal(p.x,p.z),l=Math.hypot(n[0],n[2]);if(p.surface==='bridge'||l<1e-6)break;
 const tx=-n[2]/l,tz=n[0]/l,along=(dx/nSteps)*tx+(dz/nSteps)*tz;
 const slide=move(p,tx*along,tz*along);if(slide===p)break;p=slide;
 }else p=next;}return p;}
// Resumable builders: run(deadline, clock) does whole rows until the clock passes the deadline and returns true when done.
// The one-shot functions below drain the same builder, so streamed and immediate output are identical.
function chunkJob(cx,cz,step=STEP){const n=CHUNK/step,positions=[],normals=[],colors=[],indices=[];let j=0;
 return {result:{positions,normals,colors,indices},run(deadline=Infinity,clock=null){
 while(j<=n){for(let i=0;i<=n;i++){const x=cx*CHUNK+i*step,z=cz*CHUNK+j*step,y=heightAt(x,z),b=biomeAt(x,z),v=.85+noise(x,z,20)*.15;positions.push(i*step,y,j*step);normals.push(...normalAt(x,z));const c=groundColor(x,z,b==='terraformed'?(noise(x,z,1500)>.54?'massif':'wasteland'):b);colors.push(...c.map(c=>c*v));}
 j++;if(j<=n&&clock&&clock()>=deadline)return false;}
 if(!indices.length)for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 return true;}};
}
function chunk(cx,cz,step=STEP){const job=chunkJob(cx,cz,step);job.run();return job.result;}
function chunkKeys(x,z,radius=4,fineRadius=2){const a=[],cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK);for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++){const aX=cx+i,aZ=cz+j;if(aX>=0&&aZ>=0&&aX*CHUNK<WIDTH&&aZ*CHUNK<LENGTH)a.push({key:aX+':'+aZ,cx:aX,cz:aZ,step:Math.max(Math.abs(i),Math.abs(j))<=fineRadius?4:16});}return a;}
// Coarse outer ring merged into one draw; near chunk coordinates and stable terrain remain unchanged.
function horizonJob(x,z,innerRadius=4){const positions=[],normals=[],colors=[],indices=[],cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK),samples=new Map();let j=-22;
 // Sample once per shared vertex. Distant lighting uses an up normal: relief is physical geometry.
 const sample=(x,z)=>{const key=x+':'+z;if(samples.has(key))return samples.get(key);const y=heightAt(x,z),b=biomeAt(x,z),c=groundColor(x,z,b==='terraformed'?(noise(x,z,1500)>.54?'massif':'wasteland'):b),v=.9+noise(x,z,110)*.1;const out={y,c:c.map(c=>c*v)};samples.set(key,out);return out;};
 const result={positions,normals,colors,indices,radius:2560};
 return {result,run(deadline=Infinity,clock=null){while(j<=22){for(let i=-22;i<=22;i++){const ring=Math.max(Math.abs(i),Math.abs(j));if(ring<=innerRadius)continue;const a=cx+i,b=cz+j;if(a<0||b<0||a*CHUNK>=WIDTH||b*CHUNK>=LENGTH)continue;
 const step=ring<=11?64:128,n=128/step,offset=positions.length/3;
 for(let z=0;z<=128;z+=step)for(let x=0;x<=128;x+=step){const ax=a*128+x,az=b*128+z,d=sample(ax,az);positions.push(ax,d.y,az);normals.push(0,1,0);colors.push(...d.c);}
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const k=offset+z*(n+1)+x;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}
 // Only LOD boundaries need skirts. Equal-resolution neighboring edges already coincide exactly.
 if(ring===innerRadius+1||ring===11)for(let side=0;side<4;side++){const ni=i+(side===0?-1:side===1?1:0),nj=j+(side===2?-1:side===3?1:0),neighbor=Math.max(Math.abs(ni),Math.abs(nj));if(!(ring===innerRadius+1&&neighbor===innerRadius||ring===11&&neighbor===12))continue;for(let t=0;t<128;t+=step){const ax=a*128+(side===0?0:side===1?128:t),az=b*128+(side===2?0:side===3?128:t),bx=ax+(side<2?0:step),bz=az+(side<2?step:0),k=positions.length/3,ay=sample(ax,az).y,by=sample(bx,bz).y;positions.push(ax,ay,az,ax,ay-64,az,bx,by,bz,bx,by-64,bz);normals.push(0,1,0,0,1,0,0,1,0,0,1,0);colors.push(...Array(4).fill([.32,.33,.36]).flat());indices.push(k,k+1,k+2,k+2,k+1,k+3);}}
 }j++;if(j<=22&&clock&&clock()>=deadline)return false;}return true;}};
}
function horizon(x,z,innerRadius=4){const job=horizonJob(x,z,innerRadius);job.run();return job.result;}
// The pre-terraform tree/rock split (an oxygen-complex circle plus noise patches). Kept ONLY for scenery placement, so the
// solid rock field (rockSolid, shot occlusion) is unchanged; the art draws each legacy 'tree' item by today's terraZone
// (lush flora, shrub, lichen, a blight-killed stump inside the war region, nothing on the far frontier).
function legacyGreen(x,z){return Math.hypot(x-1150,z-1080)<130||noise(x,z,3400)>.65;}
// Visual-only engineered flora in the terraformed zones (never solid, never blocks a shot). Per 128 m chunk, deterministic.
function flora(cx,cz){const out=[],x0=cx*128,z0=cz*128;if(x0>1500||x0+128<640||z0>1520||z0+128<900)return out;
 for(let i=0;i<120;i++){const x=x0+hash(cx*131+i,cz*7+3)*128,z=z0+hash(cz*97+i,cx*5+11)*128,zone=terraZone(x,z);if(zone==='barren')continue;
  if(waterAt(x,z)||structureSolidAt(x,z)||deckAt(x,z)!==null||forestAt(x,z)?.core||Math.abs(x-1080)<26&&Math.abs(z-1160)<24)continue;const r=hash(cx+i*3,cz+i*5);
  if(zone==='lichen'&&r>.55||zone==='grass'&&r>.8)continue;
  out.push({x,z,y:groundAt(x,z),kind:zone==='lush'?(r<.42?'tree':r<.78?'shrub':'bloom'):zone==='grass'?(r<.25?'shrub':'grass'):'lichen',size:.7+hash(cx+i,cz+i*2)*.8,variant:hash(cx*3+i,cz*3+i),zone});}
 return out;}
// Trees of the forest stands (their dense core is the cover canopy in blockedAt). Deterministic jittered grid.
function forestTrees(f){const out=[];for(let gz=-f.r;gz<=f.r;gz+=4.5)for(let gx=-f.r;gx<=f.r;gx+=4.5){const jx=gx+(hash(f.x+gx*7,f.z+gz*3)-.5)*3,jz=gz+(hash(f.z+gz*5,f.x+gx*11)-.5)*3,d=Math.hypot(jx,jz);if(d>f.r)continue;const x=f.x+jx,z=f.z+jz;if(waterAt(x,z)||structureSolidAt(x,z))continue;out.push({x,z,y:groundAt(x,z),kind:'tree',size:1.15+hash(x,z)*.7,variant:hash(z,x),forest:f.id,edge:d>f.r-FOREST_EDGE});}return out;}
function scenery(cx,cz){const out=[];for(let i=0;i<48;i++){const x=cx*128+hash(cx*53+i,cz)*128,z=cz*128+hash(cz*71+i,cx)*128;if(x<0||z<0||x>WIDTH||z>LENGTH||Math.hypot(x-1024,z-1024)<115)continue;if(structureSolidAt(x,z)||clearedAt(x,z)||installations.some(b=>Math.hypot(x-b.x,z-b.z)<25)||Math.hypot(x-1180,z-1080)<55||x>1095&&x<1170&&z>1130&&z<1240)continue;const b=legacyGreen(x,z);out.push({x,z,y:groundAt(x,z),kind:b?'tree':i===0&&hash(cx,cz)>.85?'relay':'rock',size:1+hash(cx+i,cz+8)*2.8,variant:hash(cx+i,cz+77)});}return out;}
const landmarks=Object.freeze([{id:'bridge-01',x:1024,z:1024,name:'Refuge viaduct'},{id:'oxygen-01',x:1160,z:1080,name:'Oxygen complex'},{id:'refuge-01',x:1140,z:1160,name:'Refuge outpost'},{id:'crater-01',x:1210,z:1130,name:'Refuge ridge'},{id:'massif-01',x:14000,z:8000,name:'Highland overlook'}].map(Object.freeze));
// Owner playtest (Nov 8 "can't find my base"): a drivable route for the HUD arrow. Grid A* (4 m cells) over the same move()
// rules the tank drives by, plus a solid check every 0.5 m so a route never cuts a wall corner. Pure geometry: edge results
// are cached (the world never changes), so re-routing after the pilot strays is nearly free. Bounded: a box around start and
// goal and an expansion cap; returns null when it cannot prove a route, and the caller falls back to the straight line.
const ROUTE_EDGES=new Map(),ROUTE_NEAR=new Map();
// cells within ~2.5 m of a wall cost extra, so the route keeps clear of corners a thumb-steered tank would clip
function routeNear(x,z){const k=x+','+z;let v=ROUTE_NEAR.get(k);if(v===undefined){v=[[2.5,0],[-2.5,0],[0,2.5],[0,-2.5],[1.8,1.8],[-1.8,1.8],[1.8,-1.8],[-1.8,-1.8]].some(([a,b])=>solidAt(x+a,z+b))?1:0;if(ROUTE_NEAR.size>250000)ROUTE_NEAR.clear();ROUTE_NEAR.set(k,v);}return v;}
function routeStep(ax,az,bx,bz){const k=ax+','+az+','+bx+','+bz;let v=ROUTE_EDGES.get(k);if(v!==undefined)return v;v=routeClear({x:ax,z:az,y:groundAt(ax,az),surface:'ground'},{x:bx,z:bz});if(ROUTE_EDGES.size>250000)ROUTE_EDGES.clear();ROUTE_EDGES.set(k,v);return v;}
// true when a ground tank at p can drive the straight segment to q (solids every 0.5 m, then the real move() in 2 m steps)
function routeClear(p,q){const L=Math.hypot(q.x-p.x,q.z-p.z);if(L<1e-6)return true;const m=Math.ceil(L/.5);for(let k=1;k<m;k++)if(solidAt(p.x+(q.x-p.x)*k/m,p.z+(q.z-p.z)*k/m))return false;
 const n=Math.ceil(L/2);let c={x:p.x,z:p.z,y:Number.isFinite(p.y)?p.y:groundAt(p.x,p.z),surface:'ground'};for(let k=1;k<=n;k++){const r=move(c,(q.x-p.x)/n,(q.z-p.z)/n);if(r===c)return false;c=r;}return true;}
// Incremental: routeJob(...).step(n) expands at most n cells per call (the HUD spreads a search over frames so a phone never
// stalls); route() runs one to the end (tests, tools).
function routeJob(from,to,{goal=6,cell=4,margin=160,max=15000}={}){
 const job={done:false,path:null,step(){return job;}};if(!from||!to||!Number.isFinite(from.x+from.z+to.x+to.z)){job.done=true;return job;}
 const x0=Math.round(Math.min(from.x,to.x)-margin),z0=Math.round(Math.min(from.z,to.z)-margin),nx=Math.ceil((Math.abs(from.x-to.x)+2*margin)/cell)+1,nz=Math.ceil((Math.abs(from.z-to.z)+2*margin)/cell)+1;
 const cx=i=>x0+i*cell,cz=j=>z0+j*cell,N=nx*nz,g=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1),closed=new Uint8Array(N),H=[];
 const push=(f,k)=>{H.push([f,k]);let i=H.length-1;while(i>0){const q=(i-1)>>1;if(H[q][0]<=H[i][0])break;[H[q],H[i]]=[H[i],H[q]];i=q;}};
 const pop=()=>{const top=H[0],last=H.pop();if(H.length){H[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<H.length&&H[l][0]<H[m][0])m=l;if(r<H.length&&H[r][0]<H[m][0])m=r;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];i=m;}}return top;};
 const h=(i,j)=>Math.hypot(cx(i)-to.x,cz(j)-to.z)/cell,si=Math.round((from.x-x0)/cell),sj=Math.round((from.z-z0)/cell);
 // seed from the cells the tank can reach from its exact position (the cell center itself may sit inside a wall corner)
 for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const i=si+di,j=sj+dj;if(i<0||j<0||i>=nx||j>=nz||!routeClear(from,{x:cx(i),z:cz(j)}))continue;const k=j*nx+i,c=Math.hypot(cx(i)-from.x,cz(j)-from.z)/cell;if(c<g[k]){g[k]=c;push(c+h(i,j),k);}}
 let n=0;
 job.step=budget=>{if(job.done)return job;let b=0;
  while(H.length&&n<max&&b<budget){const k=pop()[1];if(closed[k])continue;closed[k]=1;n++;b++;const i=k%nx,j=(k/nx)|0;
   if(Math.hypot(cx(i)-to.x,cz(j)-to.z)<=goal){const path=[];for(let q=k;q>=0;q=prev[q])path.push({x:cx(q%nx),z:cz((q/nx)|0)});path.reverse();path.push({x:to.x,z:to.z});job.path=path;job.done=true;return job;}
   for(let d=0;d<8;d++){const di=[1,-1,0,0,1,1,-1,-1][d],dj=[0,0,1,-1,1,-1,1,-1][d],ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=nx||nj>=nz)continue;const nk=nj*nx+ni;if(closed[nk])continue;const c=g[k]+(d>3?1.4142:1)+routeNear(cx(ni),cz(nj))*1.5;if(c>=g[nk]||!routeStep(cx(i),cz(j),cx(ni),cz(nj)))continue;g[nk]=c;prev[nk]=k;push(c+h(ni,nj),nk);}}
  if(!H.length||n>=max)job.done=true;return job;};
 return job;}
function route(from,to,opts){const job=routeJob(from,to,opts);while(!job.done)job.step(1e9);return job.path;}
// The point the arrow should aim at: the farthest route point within 10 m that the tank can reach in a straight line.
function routeAim(p,path,from=0){let best=from,bd=Infinity;for(let k=Math.max(0,from-3);k<Math.min(path.length,from+14);k++){const d=Math.hypot(path[k].x-p.x,path[k].z-p.z);if(d<bd){bd=d;best=k;}}
 let aim=Math.min(best+1,path.length-1);for(let k=best+1;k<path.length;k++){if(Math.hypot(path[k].x-p.x,path[k].z-p.z)>10)break;if(routeClear(p,path[k]))aim=k;}return {index:best,aim,off:bd,point:path[aim]};}
root.ConquestWorld=Object.freeze({id:'moon',version:1,route,routeJob,routeAim,routeClear,knownOre,speedFactor,waterTopAt,baseHeight,floraNodes,HARVEST,deposits,COLONY,ROAD_FAST,colonyLotAt,roadAt,clearedAt,structureSolidAt,flora,forestTrees,legacyGreen,pylons,blightSources,terraformAt,terraZone,blightAt,TERRA,water,waterAt,creekNearest,creekBridge,forests,forestAt,FOREST_CANOPY,raidObstacles,sectors,frontierSectorAt,SEED,WIDTH,LENGTH,SPEED,CHUNK,STEP,installations,surfaceNormal,solidAt,blockedAt,installationOccludes,horizon,scenery,travelSpeed,frameSeconds,advance,chunkJob,horizonJob,heightAt,groundAt,normalAt,biomeAt,surfacesAt,deckAt,move,chunk,chunkKeys,landmarks,mapPoint:(x,z)=>({u:x/WIDTH,v:1-z/LENGTH}),sectorAt:(x,z)=>({theater:'moon',id:Math.floor(x/2400)+':'+Math.floor(z/2400)}),warpNodes:Object.freeze([])});
})(globalThis);
