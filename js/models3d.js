'use strict';
// =====================================================================
// models3d: every 3D model in the game, built in code from simple shapes. Each model is merged into a few meshes
// (lit, metallic, glowing) so a whole tank costs a handful of draw calls on a cheap phone.
// Model space: tank radius = 1, forward = +x, up = +y, right side = +z. Visual only: nothing here touches the rules.
// Needs THREE (js/vendor/three.lunar.min.js, loaded by render3d.js before anything here is called).
// =====================================================================
const M3=(function(){
// ---------- colors ----------
function hexMul(hex,k){const n=parseInt(String(hex).slice(1),16),f=c=>Math.max(0,Math.min(255,Math.round(c*k))).toString(16).padStart(2,'0');return '#'+f(n>>16)+f((n>>8)&255)+f(n&255);}
function hexMix(a,b,t){const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16),f=(x,y)=>Math.round(x+(y-x)*t).toString(16).padStart(2,'0');
 return '#'+f(A>>16,B>>16)+f((A>>8)&255,(B>>8)&255)+f(A&255,B&255);}
const TIERC=['#9fb3c8','#b78bff','#ffcf4a'];   // rarity trim: common, rare, epic (RCOL)
const LEG='#e8f4ff',GOLD='#ffcf4a';
// Lunar Skin is an OVERLAY on the equipped paint, shared by the HF collection and the fallback renderer: the paint stays on the
// big armour panels, Lunar adds dark graphite structure, gold trim/crests and blue energy channels. Stock paint keeps the
// approved black/graphite/gold look. Visual only: no stats, sizes or sockets read this.
const LUNAR=Object.freeze({body:'#171d27',plate:'#303946',gold:'#c2a266',graphite:'#1c222b',frame:'#2b323c',energy:'#45c2ff',core:'#b5f0ff',wisp:'#86dcff'});
const LUNAR_CHANNELS=new Set(['#5fd4ff','#6bcde5','#83c6df']);   // existing cyan seams in the designs; Lunar runs its energy through them
const lunarStock=P=>!P||!P.hull||P.hull==='#2c3a49';

// ---------- the kit: shapes go into buckets, then merge ----------
const kit=()=>({lit:[],shine:[],glow:[]});
const V=a=>new THREE.Vector3(a[0],a[1],a[2]);
function put(k,geo,col,p,r,s,mat){
 const smooth=!!geo.userData.defenderSmooth;
 let g=geo.index?geo.toNonIndexed():geo;if(g!==geo)geo.dispose();
 if(g.attributes.uv)g.deleteAttribute('uv');if(g.attributes.normal&&!smooth)g.deleteAttribute('normal');
 const m=new THREE.Matrix4().compose(V(p||[0,0,0]),new THREE.Quaternion().setFromEuler(new THREE.Euler((r||[0,0,0])[0],(r||[0,0,0])[1],(r||[0,0,0])[2])),V(s||[1,1,1]));
 g.applyMatrix4(m);
 if(m.determinant()<0){const a=g.attributes.position.array;for(let i=0;i<a.length;i+=9)for(let j=0;j<3;j++){const t=a[i+3+j];a[i+3+j]=a[i+6+j];a[i+6+j]=t;}}
 const c=new THREE.Color(col),n=g.attributes.position.count,arr=new Float32Array(n*3);
 for(let i=0;i<n;i++){arr[i*3]=c.r;arr[i*3+1]=c.g;arr[i*3+2]=c.b;}
 g.setAttribute('color',new THREE.BufferAttribute(arr,3));
 k[mat||'lit'].push(g);return g;
}
function merge(list){
 if(!list||!list.length)return null;
 let n=0;for(const g of list)n+=g.attributes.position.count;
 const P=new Float32Array(n*3),C=new Float32Array(n*3),N=list.some(g=>g.attributes.normal)?new Float32Array(n*3):null;let o=0;
 for(const g of list){P.set(g.attributes.position.array,o);C.set(g.attributes.color.array,o);if(N){if(!g.attributes.normal)g.computeVertexNormals();N.set(g.attributes.normal.array,o);}o+=g.attributes.position.count*3;g.dispose();}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));
 if(N)g.setAttribute('normal',new THREE.BufferAttribute(N,3));else g.computeVertexNormals();g.computeBoundingSphere();return g;
}
const bake=k=>k.hf&&typeof Equipment3D!=='undefined'?Equipment3D.bake(k):({lit:merge(k.lit),shine:merge(k.shine),glow:merge(k.glow)});
// shapes
const B=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const CY=(rt,rb,h,s)=>new THREE.CylinderGeometry(rt,rb,h,s||10);
const SP=(r,w,h)=>new THREE.SphereGeometry(r,w||10,h||7);
const CO=(r,h,s)=>new THREE.ConeGeometry(r,h,s||8);
const OC=r=>new THREE.OctahedronGeometry(r);
const IC=(r,d)=>new THREE.IcosahedronGeometry(r,d||0);
const TO=(R,t,rs,ts,arc)=>new THREE.TorusGeometry(R,t,rs||4,ts||14,arc||Math.PI*2);
// a solid between two convex outlines (top view [x,z]) at heights y0 and y1: sloped armor, wedges, plows
function loft(bp,tp,y0,y1){
 const pos=[],n=bp.length;let cx=0,cz=0;for(const p of bp.concat(tp)){cx+=p[0];cz+=p[1];}cx/=2*n;cz/=2*n;const cy=(y0+y1)/2;
 const tri=(a,b,c)=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,mx=(a[0]+b[0]+c[0])/3-cx,my=(a[1]+b[1]+c[1])/3-cy,mz=(a[2]+b[2]+c[2])/3-cz;
  if(nx*mx+ny*my+nz*mz<0)pos.push(a[0],a[1],a[2],c[0],c[1],c[2],b[0],b[1],b[2]);else pos.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);};
 const Bv=bp.map(p=>[p[0],y0,p[1]]),Tv=tp.map(p=>[p[0],y1,p[1]]);
 for(let i=0;i<n;i++){const j=(i+1)%n;tri(Bv[i],Bv[j],Tv[j]);tri(Bv[i],Tv[j],Tv[i]);}
 for(let i=1;i<n-1;i++){tri(Bv[0],Bv[i],Bv[i+1]);tri(Tv[0],Tv[i],Tv[i+1]);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));return g;
}
const sc=(pts,sx,sz,dx)=>pts.map(p=>[p[0]*sx+(dx||0),p[1]*sz]);
const mirZ=pts=>pts.map(p=>[p[0],-p[1]]);
function extr(shape,depth){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:5});g.translate(0,0,-depth/2);return g;}
function trackGeo(len,h,th){const s=new THREE.Shape(),r=h/2,l=len/2-r;
 s.moveTo(-l,-r);s.lineTo(l,-r);s.absarc(l,0,r,-Math.PI/2,Math.PI/2,false);s.lineTo(-l,r);s.absarc(-l,0,r,Math.PI/2,Math.PI*1.5,false);return extr(s,th);}
function crescentGeo(R,depth){const s=new THREE.Shape();s.absarc(0,0,R,-Math.PI*0.45,Math.PI*0.45,false);s.absarc(R*0.38,0,R*0.8,Math.PI*0.37,-Math.PI*0.37,true);return extr(s,depth);}
function starGeo(R,depth){const s=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,q=i%2?R*0.45:R;if(i)s.lineTo(Math.cos(a)*q,Math.sin(a)*q);else s.moveTo(Math.cos(a)*q,Math.sin(a)*q);}return extr(s,depth);}
const sym=f=>{f(-1);f(1);};

// ---------- colors for one tank ----------
function palette(P,team,cls,lunar){
 P=P||{hull:'#2c3a49',tur:'#3b4a5b',trim:'#d5dee7'};
 if(lunar&&lunarStock(P))return {hull:'#20252d',hull2:'#363c44',tur:'#272d36',tur2:'#424952',trim:'#bc904b',dark:'#10151c',metal:'#65717c',track:'#101419',light:'#d9eaff',team:team||'#4d9fff',acc:'#c49a54',shine:true,lunar:true};
 const k=P.hull==='#07080d'||P.hull==='#17131f'?2.1:P.hull==='#a9b6c8'||P.hull==='#aab2c0'?1.05:1.7;
 const C={hull:hexMul(P.hull,k),hull2:hexMul(P.hull,k*0.82),tur:hexMul(P.tur,k),tur2:hexMul(P.tur,k*0.8),trim:P.trim,dark:'#262f3b',metal:'#76818f',track:'#171d25',light:'#e9f1f7',team:team||'#4d9fff',acc:CH[cls]?CH[cls].c:'#3fd0c9',shine:!!P.shine};
 // Lunar over a paint: the paint's armour colours stay; trim, accents and running gear take the Lunar graphite/gold.
 return lunar?Object.assign(C,{trim:'#bc904b',dark:'#10151c',metal:'#65717c',track:'#101419',acc:'#c49a54',shine:true,lunar:true,overlay:true}):C;
}
const PM=C=>C.shine?'shine':'lit';   // metallic paints go on the shiny material

// ---------- flagship Defender design: starter Vanguard, visual geometry ONLY ----------
// The approved tracked flagship is an art-direction prototype for stock Vanguard T0.
// Other chassis, paint ownership, combat hitboxes, weapons and legendary cosmetics are untouched.
// All static shapes still bake into the usual three geometry buckets (lit / shine / glow).
// Chamfered convex plates and smooth machined cylinders, used only by the stock flagship.
// Bevel geometry catches real light; rubber, painted armor and exposed metal stay separate.
function defenderPlate(points,height,bevel){
 const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(p[0],-p[1]):s.moveTo(p[0],-p[1]));s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:height-2*bevel,steps:1,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,curveSegments:1});
 g.rotateX(-Math.PI/2);g.translate(0,bevel,0);return g;
}
function defenderCylinder(r,h,segments=20){const g=CY(r,r,h,segments);g.userData.defenderSmooth=true;return g;}
function defenderBelt(len,h,depth){
 const loop=(s,l,r)=>{s.moveTo(-l,-r);s.lineTo(l,-r);s.absarc(l,0,r,-Math.PI/2,Math.PI/2,false);s.lineTo(-l,r);s.absarc(-l,0,r,Math.PI/2,Math.PI*1.5,false);};
 const s=new THREE.Shape(),hole=new THREE.Shape(),l=(len-h)/2;loop(s,l,h/2);loop(hole,l,h/2-.065);s.holes.push(hole);return extr(s,depth);
}
function defenderFinish(C){
 if(C.lunar&&!C.overlay)return {body:C.hull,plate:C.hull2,tur:C.tur,edge:C.trim,steel:C.metal,rubber:C.track,recess:C.dark,amber:'#c49a54',ice:'#ffe1a1'};
 if(C.lunar)return {body:hexMul(C.hull,.87),plate:'#363c44',tur:hexMul(C.tur,.86),edge:C.trim,steel:C.metal,rubber:C.track,recess:C.dark,amber:'#c49a54',ice:'#ffe1a1'};
 // Stock gets graphite armor; selected colored/bright paints remain recognizable.
 const stock=C.hull===hexMul('#2c3a49',1.7),base=stock?hexMul(C.hull,.48):hexMul(C.hull,.87);
 return {body:base,plate:stock?'#35424d':hexMul(C.hull2,1.02),tur:stock?'#29343e':hexMul(C.tur,.86),edge:hexMix(C.trim,'#45505a',.72),steel:'#697987',rubber:'#10171d',recess:'#0a1118',amber:'#ff9d55',ice:'#66c9ff'};
}
function defenderChassis(k,C,gems,M,pm){
 const F=defenderFinish(C),{amber,ice}=F;
 const plate=(pts,y,h,c,b=.025)=>put(k,defenderPlate(pts,h,b),c,[0,y,0],null,null,'shine');
 const deck=[[-1.12,-.55],[.60,-.56],[1.12,-.39],[1.26,-.19],[1.26,.19],[1.12,.39],[.60,.56],[-1.12,.55]];
 // Long wedge glacis, chamfered armored keel and recessed central seam. No hover slab.
 put(k,loft(deck,sc(deck,.86,.82,-.08),.24,.58),F.body,null,null,null,'shine');
 plate([[-1.02,-.46],[.45,-.46],[.91,-.25],[1.04,0],[.91,.25],[.45,.46],[-1.02,.46]],.55,.11,F.plate);
 sym(side=>{
  const prow=[[.24,side*.055],[1.08,side*.035],[1.18,side*.18],[.94,side*.37],[.32,side*.43]];
  put(k,loft(prow,sc(prow,.82,.86,-.02),.40,.60),F.body,null,null,null,'shine');
  plate([[.46,side*.055],[.99,side*.045],[1.05,side*.13],[.85,side*.28],[.45,side*.31]],.60,.045,F.plate,.012);
  put(k,B(.50,.026,.025),amber,[.68,.615,side*.34],[0,side*.17,-.08],null,'shine');
  // Independent wide track pod; an open belt reveals the wheel train instead of a solid block.
  trackAssembly(k,F,{len:2.61,h:.48,w:.38,z:side*.91,y:.25,wheels:7,detail:true});
  // Raised fender leaves wheels and lower suspension exposed. Overlapping sloped plates.
  plate([[-1.13,side*.61],[.88,side*.61],[1.12,side*.77],[.99,side*1.07],[-1.13,side*1.07]],.52,.075,F.body,.018);
  for(let i=0;i<3;i++){
   const x=-.99+i*.57;
   plate([[x,side*.68],[x+.46,side*.66],[x+.52,side*.98],[x+.02,side*1.035]],.59,.065,i%2?F.body:F.plate,.014);
   put(k,B(.31,.012,.018),F.edge,[x+.24,.671,side*.98],null,null,'shine');
   put(k,B(.10,.022,.025),amber,[x+.08,.664,side*.91],null,null,'shine');
  }
  // Headlamps live in dark armored sockets, with tiny lenses rather than emissive white slabs.
  plate([[.77,side*.59],[1.19,side*.70],[1.10,side*.97],[.79,side*.98]],.43,.105,F.plate,.018);
  put(k,B(.025,.070,.22),F.recess,[1.15,.49,side*.80],[0,-side*.32,0]);
  put(k,B(.029,.024,.095),ice,[1.169,.499,side*.80],[0,-side*.32,0],null,'glow');
  put(k,B(.03,.017,.040),amber,[1.174,.463,side*.87],null,null,'glow');
  // Deliberate team identification survives paints and warm stock accents.
  put(k,B(.22,.017,.038),C.team,[.46,.667,side*.70],null,null,'glow');
  // Tow eyes, rear exhaust lip and service hatches are readable from the back/side.
  put(k,TO(.065,.018,5,12),F.steel,[1.12,.32,side*.40],[0,Math.PI/2,0],null,'shine');
  put(k,B(.13,.09,.21),F.recess,[-1.12,.53,side*.72]);
  put(k,B(.018,.025,.12),'#b84827',[-1.19,.54,side*.72],null,null,'glow');
  M.halos.push([1.17,.49,side*.80,ice,.18]);
 });
 // Rear engine grilles: recessed slats, retaining bolts and armor-lipped cooling channels.
 plate([[-1.13,-.42],[-.63,-.42],[-.63,.42],[-1.13,.42]],.61,.05,F.recess,.012);
 for(let i=0;i<7;i++)sym(side=>put(k,B(.27,.014,.035),F.steel,[-.93,.673,side*(.10+i*.040)],[0,0,.09],null,'shine'));
 sym(side=>put(k,B(.35,.021,.022),amber,[-.94,.69,side*.445],null,null,'shine'));
 put(k,defenderCylinder(.49,.065,28),F.recess,[0,.71,0]);
 put(k,defenderCylinder(.43,.04,28),F.steel,[0,.755,0],null,null,'shine');
 cores(k,C,gems,-.90,.715,[-.25,0,.25]);
 M.ty=.777;M.tc=amber; // Existing attachment height and weapon interchange contract.
}
function defenderPulseTurret(k,C,M,pm){
 const F=defenderFinish(C),{amber,ice}=F;
 const plate=(pts,y,h,c,b=.02)=>put(k,defenderPlate(pts,h,b),c,[0,y,0],null,null,'shine');
 const outline=[[-.64,-.42],[.06,-.49],[.43,-.32],[.57,-.16],[.57,.16],[.43,.32],[.06,.49],[-.64,.42]];
 put(k,defenderCylinder(.43,.07,28),F.recess,[0,.035,0]);
 put(k,loft(outline,sc(outline,.84,.8,-.03),.065,.295),F.tur,null,null,null,'shine');
 plate([[-.52,-.27],[.08,-.31],[.34,-.15],[.34,.15],[.08,.31],[-.52,.27]],.29,.065,F.plate);
 sym(side=>{
  // Articulated angular turret cheeks with a dark reveal between separate armor leaves.
  plate([[-.58,side*.30],[-.04,side*.40],[.53,side*.20],[.42,side*.40],[-.06,side*.56],[-.60,side*.47]],.15,.09,F.body,.018);
  plate([[-.44,side*.32],[-.08,side*.34],[.28,side*.24],[.04,side*.45],[-.45,side*.44]],.29,.043,F.plate,.012);
  put(k,B(.40,.021,.018),amber,[-.26,.228,side*.493],[0,side*.12,0],null,'shine');
  for(let i=0;i<4;i++)put(k,B(.040,.055,.018),F.recess,[-.43+i*.073,.22,side*.498],[0,0,-.24]);
  // Small surface insignia; never the legendary fins, halo or orbiting ornament.
  put(k,TO(.067,.011,4,15,Math.PI*1.45),F.edge,[-.39,.225,side*.514],[0,0,.4],null,'shine');
  put(k,B(.095,.018,.025),C.team,[.07,.35,side*.29],null,null,'glow');
 });
 // Armored trunnion, polished exposed barrel and a finite modular thermal jacket.
 put(k,defenderCylinder(.18,.44,20),F.steel,[.40,.215,0],[Math.PI/2,0,0],null,'shine');
 put(k,B(.29,.21,.31),F.recess,[.53,.225,0]);
 put(k,defenderCylinder(.094,1.23,24),F.steel,[1.12,.245,0],[0,0,Math.PI/2],null,'shine');
 for(const x of [.69,1.05,1.42]){
  put(k,defenderCylinder(.137,.21,12),F.body,[x,.245,0],[0,0,Math.PI/2],null,'shine');
  put(k,TO(.138,.010,5,16),amber,[x-.095,.245,0],[0,Math.PI/2,0],null,'shine');
  sym(side=>put(k,B(.115,.029,.025),F.recess,[x,.25,side*.133]));
 }
 // Chamfered top spine and muzzle brake, slots and a recessed dark bore.
 plate([[.56,-.055],[1.53,-.055],[1.63,-.035],[1.63,.035],[1.53,.055],[.56,.055]],.345,.045,F.plate,.010);
 put(k,B(.64,.011,.023),amber,[.97,.40,0],null,null,'shine');
 put(k,defenderCylinder(.148,.22,8),F.plate,[1.73,.245,0],[0,0,Math.PI/2],null,'shine');
 put(k,defenderCylinder(.112,.016,24),F.edge,[1.85,.245,0],[0,0,Math.PI/2],null,'shine');
 put(k,defenderCylinder(.087,.019,24),F.recess,[1.861,.245,0],[0,0,Math.PI/2]);
 sym(side=>{put(k,B(.10,.055,.012),F.recess,[1.73,.245,side*.14]);put(k,B(.065,.018,.013),amber,[1.70,.32,side*.105],null,null,'shine');});
 // Low armored optic and hatch. Roof furniture stays below the cannon's dominant silhouette.
 plate([[-.44,-.19],[-.23,-.19],[-.20,.04],[-.47,.04]],.35,.026,F.recess,.010);
 put(k,defenderCylinder(.11,.032,20),F.edge,[-.36,.39,-.07],null,null,'shine');
 put(k,B(.24,.08,.14),F.body,[-.03,.38,-.14],null,null,'shine');
 put(k,B(.018,.030,.085),ice,[.095,.391,-.14],null,null,'glow');
 put(k,CY(.012,.012,.15,6),F.steel,[-.49,.45,.21],null,null,'shine');
 M.tips.push([1.88,.245,0]);M.halos.push([1.87,.245,0,ice,.15]);
}

// Standard visual catalog v2. IDs/tiers are render selections, never equipment or stat definitions.
const VISUAL_VERSION=2;
// Class size ladder (model space; battle draws it x R x class ds x TANK_VIS). Scout: low and narrow; Vanguard: the
// approved Defender-sized middle; Titan: longer, wider, much taller. ring = turret socket height (meta.ty).
const CHASSIS_VISUALS={
 scout:[
  {len:1.84,trackZ:.58,trackW:.23,h:.30,deck:.40,ring:.47,armor:0,shape:'dart',wheels:4},
  {len:2.04,trackZ:.56,trackW:.25,h:.31,deck:.41,ring:.49,armor:1,shape:'split',wheels:5},
  {len:1.98,trackZ:.66,trackW:.22,h:.27,deck:.35,ring:.45,armor:2,shape:'outrigger',wheels:3}],
 vanguard:[
  {len:2.61,trackZ:.91,trackW:.38,h:.48,deck:.66,ring:.777,armor:0,shape:'defender',wheels:7},
  {len:2.56,trackZ:.90,trackW:.38,h:.48,deck:.70,ring:.78,armor:1,shape:'bastion',wheels:6},
  {len:2.70,trackZ:.93,trackW:.38,h:.48,deck:.71,ring:.80,armor:2,shape:'paladin',wheels:6}],
 titan:[
  {len:2.94,trackZ:1.00,trackW:.46,h:.58,deck:.84,ring:.90,armor:0,shape:'siege',wheels:7},
  {len:2.90,trackZ:.95,trackW:.44,h:.58,deck:.86,ring:.92,armor:1,shape:'ram',wheels:7},
  {len:3.10,trackZ:.98,trackW:.48,h:.62,deck:.90,ring:.96,armor:2,shape:'four-pod',wheels:4}]
};
// Hull-plate fitting seat [x,y,z] on each family chassis' own fender/shelf surface (the Defender keeps its original seat).
const FAM_FIT={'scout:0':[-.13,.44,.58],'scout:1':[-.55,.475,.63],'scout:2':[-.06,.425,.58],'vanguard:1':[-.30,.645,.88],'vanguard:2':[-.40,.72,1.12],
 'titan:0':[-.30,.84,1.0],'titan:1':[-.40,.90,1.08],'titan:2':[-.80,.875,1.06]};
const WEAPON_VISUALS={
 pulse:[{tip:1.88,y:.245,bore:.087,kind:'segmented',width:.46},{tip:1.94,y:.25,bore:.10,kind:'capacitor',width:.49},{tip:2.02,y:.26,bore:.12,kind:'accelerator',width:.52}],
 twin:[{tip:1.74,y:.22,bore:.047,kind:'feed',width:.45},{tip:1.88,y:.23,bore:.055,kind:'drums',width:.50},{tip:1.98,y:.24,bore:.06,kind:'rotary',width:.55}],
 siege:[{tip:1.88,y:.29,bore:.16,kind:'breech',width:.50},{tip:2.0,y:.31,bore:.18,kind:'recoil',width:.55},{tip:2.12,y:.35,bore:.16,kind:'split-brake',width:.59}]
};
const visualTier=t=>Math.max(0,Math.min(2,Number.isFinite(Number(t))?Math.trunc(Number(t)):0));
function armorPart(k,pts,y,h,col,b=.018){put(k,defenderPlate(pts,h,b),col,[0,y,0],null,null,'shine');}
function wheelAssembly(k,F,x,y,z,r,detail){
 const side=Math.sign(z)||1;
 put(k,defenderCylinder(r,.028,detail?16:12),F.recess,[x,y,z],[Math.PI/2,0,0]);
 put(k,defenderCylinder(r*.78,.037,detail?14:10),F.steel,[x,y,z+side*.019],[Math.PI/2,0,0],null,'shine');
 put(k,defenderCylinder(r*.55,.043,detail?12:10),F.body,[x,y,z+side*.034],[Math.PI/2,0,0],null,'shine');
 put(k,defenderCylinder(r*.24,.05,8),F.edge,[x,y,z+side*.05],[Math.PI/2,0,0],null,'shine');
 for(let j=0;j<(detail?3:2);j++){const a=j*Math.PI*2/(detail?3:2);put(k,CY(.012,.012,.016,6),F.edge,[x+Math.cos(a)*r*.64,y+Math.sin(a)*r*.64,z+side*.046],[Math.PI/2,0,0],null,'shine');}
}
function trackAssembly(k,F,o){
 const {len,h,w,z,y=h/2+.01,wheels=5,detail=false,center=0}=o,side=Math.sign(z),a=(len-h)/2,r=h/2;
 put(k,defenderBelt(len,h,w),F.rubber,[center,y,z]);
 const pad=(x,py,ang)=>{put(k,B(detail?.092:.115,.039,w+.015),F.steel,[center+x,py,z],[0,0,ang],null,'shine');if(detail)put(k,B(.068,.055,w*.53),F.rubber,[center+x,py,z],[0,0,ang]);};
 const n=detail?19:13;for(let i=0;i<n;i++){const x=-a+i*2*a/(n-1);pad(x,y+r,0);pad(x,y-r,0);}
 for(const end of [-1,1])for(let i=1;i<7;i++){const q=i*Math.PI/7;pad(end*(a+Math.sin(q)*r),y+Math.cos(q)*r,-end*q);}
 for(let i=0;i<wheels;i++){const x=center-a+2*a*i/(wheels-1),end=i===0||i===wheels-1;wheelAssembly(k,F,x,end?y:y-.035,z+side*(w/2+.015),r*(end?.77:.66),detail);}
 for(const x of [-a*.5,a*.5]){
  put(k,B(.25,.035,.025),F.steel,[center+x,y+.06,z+side*(w/2+.055)],[0,0,.38],null,'shine');
  put(k,defenderCylinder(.024,.24,8),F.steel,[center+x,y+.155,z+side*w/2],[0,0,Math.PI/2],null,'shine');
  for(let j=0;j<4;j++)put(k,TO(.039,.009,3,8),F.amber,[center+x-.09+j*.04,y+.155,z+side*w/2],[0,Math.PI/2,0],null,'shine');
 }
}
function ventBank(k,F,x,y,z,n=5,axis='deck'){
 put(k,B(.34,axis==='deck'?.022:.12,.22),F.recess,[x,y,z]);
 for(let i=0;i<n;i++)put(k,B(.26,.014,.022),F.steel,[x,y+.019,z-.085+i*.17/(n-1)],null,null,'shine');
}
function sensorBlock(k,F,x,y,z,team){
 put(k,B(.16,.075,.15),F.body,[x,y,z],null,null,'shine');put(k,B(.014,.027,.085),team||F.ice,[x+.086,y+.006,z],null,null,'glow');
}
function mountSocket(k,F,y){put(k,defenderCylinder(.48,.06,24),F.recess,[0,y-.055,0]);put(k,defenderCylinder(.43,.035,24),F.steel,[0,y-.0175,0],null,null,'shine');}
// ---------- nine-chassis family: one authored design per class/tier ----------
// Shared by the HF collection and this foundation fallback through an authoring sink, so both renderers draw the same
// silhouettes: S={high, put(geo,mat,color,p,r,scale), mark(geo,x,y,type,side)}; mat is an HF surface id
// (paint|steel|gold|rubber|energy). Class sizes come from CHASSIS_VISUALS. Everything above the deck stays at or below
// the turret ring (meta.ty), so any gun can traverse a full circle without touching armour. Visual only.
function famFinish(P,lunar){P=P||{};const stock=!!lunar&&lunarStock(P);
 // Lunar keeps the approved stock composition (body / graphite plate / gold) and swaps the black body for the paint.
 return {paint:stock?LUNAR.body:P.hull||'#374959',plate:lunar?LUNAR.plate:P.tur||P.hull||'#536372',edge:lunar?LUNAR.gold:P.trim||'#a7b3bc',gold:'#c2a266',steel:'#a2acb8',rubber:'#192028',dark:'#121b25',ice:'#c0eaff',tail:'#b94528',lunar:!!lunar,lunarStock:stock,plateUp:P.tur||P.hull||'#536372'};}
function famTools(S){
 const high=!!S.high,seg=high?16:8;
 const put=(g,m,c,p,r,s)=>S.put(g,m,c,p||[0,0,0],r||[0,0,0],s);
 const box=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
 const cyl=(r,h,n)=>{const g=new THREE.CylinderGeometry(r,r,h,n||seg);g.userData.defenderSmooth=true;return g;};
 // bevelled slab from a top-view outline [x,z], extruded up by h from y=0
 function plate(pts,h,b=.014){if(!high)b=Math.min(b,.008);const s=new THREE.Shape();pts.forEach((p,i)=>i?s.lineTo(p[0],-p[1]):s.moveTo(p[0],-p[1]));s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.005,h-2*b),bevelEnabled:b>0,bevelThickness:b,bevelSize:b,bevelSegments:1,curveSegments:1});g.rotateX(-Math.PI/2);g.translate(0,b,0);return g;}
 const slab=(pts,y,h,m,c,b)=>put(plate(pts,h,b),m,c,[0,y,0]);
 function panel(x,y,z,l,w,h,m,c,b=.012){const t=Math.min(l,w)*.16;return slab([[-l/2+t,-w/2],[l/2-t,-w/2],[l/2,-w/2+t],[l/2,w/2-t],[l/2-t,w/2],[-l/2+t,w/2],[-l/2,w/2-t],[-l/2,-w/2+t]].map(([a,d])=>[a+x,d+z]),y,h,m,c,b);}
 // vertical slab from a side-elevation outline [x,y], thickness t centred on z
 function wall(pts,z,t,m,c,b=.01){const g=plate(pts.map(([x,y])=>[x,-y]),t,b);g.rotateX(Math.PI/2);return put(g,m,c,[0,0,z-t/2]);}
 function slope(g,x0,x1,drop,base,span=.28){const p=g.attributes.position;for(let i=0;i<p.count;i++){const f=Math.max(0,Math.min(1,(p.getX(i)-x0)/(x1-x0)));if(p.getY(i)>base)p.setY(i,p.getY(i)-drop*f*Math.min(1,(p.getY(i)-base)/span));}if(g.attributes.normal)g.deleteAttribute('normal');return g;}
 // a solid between two outlines; sl=[x0,x1,drop,base,span] slopes its top toward +x (glacis)
 function block(bp,tp,y0,y1,m,c,sl){const g=loft(bp,tp,y0,y1);if(sl)slope(g,...sl);return put(g,m,c);}
 function pipe(a,b,r,c,m='steel'){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A),g=cyl(r,v.length(),high?10:6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));return put(g,m,c,A.add(B).multiplyScalar(.5).toArray());}
 function bolt(x,y,z,axis='y',c='#b0bbc6',r=.014){if(!high)return;put(cyl(r,.013,6),'steel',c,[x,y,z],axis==='z'?[Math.PI/2,0,0]:axis==='x'?[0,0,Math.PI/2]:[0,0,0]);}
 // louvres: slats run along x (n across z); grille: slats run across z (n along x)
 function vents(F,x,y,z,l,w,n){panel(x,y,z,l+.04,w+.04,.012,'rubber',F.dark,.004);for(let i=0;i<(high?n:Math.ceil(n/2));i++){const k=high?n:Math.ceil(n/2);put(box(l,.014,.015),'steel','#6f7e8c',[x,y+.017,z-w/2+(i+.5)*w/k],[.18,0,0]);}if(high)for(const s of [-1,1])bolt(x+s*l*.43,y+.026,z+w*.42);}
 function grille(F,x,y,z,l,w,n){panel(x,y,z,l+.04,w+.04,.012,'rubber',F.dark,.004);const k=high?n:Math.ceil(n/2);for(let i=0;i<k;i++)put(box(.016,.014,w),'steel','#6f7e8c',[x-l/2+(i+.5)*l/k,y+.017,z],[0,0,.25]);}
 function crest(r,d){const rr=.85*r,dx=.38*r,x=(r*r-rr*rr+dx*dx)/(2*dx),y=Math.sqrt(r*r-x*x),a=Math.atan2(y,x),b=Math.atan2(y,x-dx),s=new THREE.Shape(),n=high?16:8;
  for(let i=0;i<=n;i++){const t=a+i*(Math.PI*2-2*a)/n;const X=Math.cos(t)*r,Y=Math.sin(t)*r;i?s.lineTo(X,Y):s.moveTo(X,Y);}
  for(let i=1;i<n;i++){const t=-b-i*(Math.PI*2-2*b)/n;s.lineTo(dx+Math.cos(t)*rr,Math.sin(t)*rr);}s.closePath();
  return new THREE.ExtrudeGeometry(s,{depth:Math.max(.003,d-.004),bevelEnabled:high,bevelThickness:.002,bevelSize:.003,bevelSegments:1,curveSegments:1});}
 // headlamp: dark socket and a lens facing +x
 function lamp(F,x,y,z,w=.12){panel(x-.03,y-.03,z,.09,w+.05,.06,'rubber',F.dark,.005);put(box(.018,.022,w),'energy',F.ice,[x+.018,y+.002,z]);}
 // One tracked run (one side): open belt, articulated shoes, road wheels. Pods share one length/height and sit at
 // +-center, so the existing track shader (meta.track) drives every pod. Wheels and shoes carry drive markers.
 function track(F,o,s){
  const c=o.center||0,r=o.height/2,half=(o.length-o.height)/2,z=o.offset,beltY=r+.03,depth=o.depth;
  const shape=new THREE.Shape(),hole=new THREE.Shape(),loop=(sh,l,rr)=>{sh.moveTo(-l,-rr);sh.lineTo(l,-rr);sh.absarc(l,0,rr,-Math.PI/2,Math.PI/2);sh.lineTo(-l,rr);sh.absarc(-l,0,rr,Math.PI/2,Math.PI*1.5);};
  loop(shape,half,r);loop(hole,half,r-.05);shape.holes.push(hole);put(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:high?6:3}),'rubber',F.rubber,[c,beltY,s*z-depth/2]);
  const mark=(g,x,y,type)=>{if(type===2){const rad=r+.005,cy=y-beltY,L=4*half+2*Math.PI*rad;const ph=Math.abs(x)<=half+.001?(cy>0?x+half:Math.PI*rad+3*half-x):x>0?2*half+Math.acos(Math.max(-1,Math.min(1,cy/rad)))*rad:4*half+Math.PI*rad+Math.acos(Math.max(-1,Math.min(1,-cy/rad)))*rad;type=2+ph/L;}S.mark(g,x+c,y,type,s);return g;};
  const pad=(x,y,ang)=>{mark(put(box(high?.082:.11,.035,depth+.02),'steel','#626c76',[c+x,y,s*z],[0,0,ang]),x,y,2);if(high)mark(put(box(.066,.022,depth*.676),'rubber','#171c20',[c+x,y+.022,s*z],[0,0,ang]),x,y,2);};
  const count=Math.max(5,Math.round(o.length*(high?6.6:3.4)));for(let i=0;i<count;i++)for(const v of [-1,1])pad(-half+i*2*half/(count-1),beltY+v*(r+.005),0);
  const ends=high?(r>.2?8:6):3;for(const e of [-1,1])for(let i=1;i<ends;i++){const a=i*Math.PI/ends;pad(e*(half+Math.sin(a)*(r+.005)),beltY+Math.cos(a)*(r+.005),-e*a);}
  for(let i=0;i<o.wheels;i++){const x=-half+i*2*half/(o.wheels-1),rr=i===0||i===o.wheels-1?o.end:o.road,zz=s*(z+depth/2+.02),y=beltY-.01;
   mark(put(cyl(rr,.072),'rubber',F.rubber,[c+x,y,zz],[Math.PI/2,0,0]),x,y,1+rr);mark(put(cyl(rr*.79,.078),'steel','#4e5f70',[c+x,y,zz+s*.007],[Math.PI/2,0,0]),x,y,1+rr);
   mark(put(cyl(rr*.57,.086),'paint',F.paint,[c+x,y,zz+s*.014],[Math.PI/2,0,0]),x,y,1+rr);mark(put(cyl(rr*.24,.096,high?10:6),'gold',F.gold,[c+x,y,zz+s*.025],[Math.PI/2,0,0]),x,y,1+rr);
   if(high)for(let j=0;j<5;j++){const a=j*Math.PI*2/5;mark(put(cyl(.011,.010,6),'steel','#b4bdc5',[c+x+Math.cos(a)*rr*.66,y+Math.sin(a)*rr*.66,zz+s*.049],[Math.PI/2,0,0]),x,y,1+rr);}
  }
  return {half,r,beltY,top:beltY+r+.04};
 }
 function cores(F,gems,x,y,zs){zs.forEach((z,i)=>{put(cyl(.10,.05,8),'rubber',F.dark,[x,y,z]);const g=gems&&gems[i];if(g&&GEM[g])put(new THREE.OctahedronGeometry(.085),'energy',GEM[g].c,[x,y+.08,z],[0,0,0],[1,1.3,1]);});}
 // turret ring at meta.ty (radius R) and an optional armoured collar down to the deck
 function ring(F,o,R){if(o.ring-o.deck>.085)put(cyl(R+.05,o.ring-.07-o.deck+.02,high?24:12),'paint',F.plate,[0,(o.ring-.07+o.deck-.02)/2,0]);put(cyl(R+.035,.040,high?24:12),'rubber',F.dark,[0,o.ring-.055,0]);put(cyl(R,.036,high?24:12),'steel',F.steel,[0,o.ring-.018,0]);if(high)for(let i=0;i<8;i++){const a=i*Math.PI/4;bolt(Math.cos(a)*R*.9,o.ring+.005,Math.sin(a)*R*.9);}}
 return {high,put,box,cyl,plate,slab,panel,wall,slope,block,pipe,bolt,vents,grille,crest,lamp,track,cores,ring};
}
// the highest armour surface over (x,z): non-indexed triangles, same test the Vault tooth uses on the baked hull
function famSurfaceY(geos,x,z){let best=-1;for(const g of geos){const a=g.attributes.position.array;
 for(let i=0;i<a.length;i+=9){const x0=a[i],z0=a[i+2],x1=a[i+3],z1=a[i+5],x2=a[i+6],z2=a[i+8],d=(z1-z2)*(x0-x2)+(x2-x1)*(z0-z2);if(Math.abs(d)<1e-9)continue;
  const l0=((z1-z2)*(x-x2)+(x2-x1)*(z-z2))/d,l1=((z2-z0)*(x-x2)+(x0-x2)*(z-z2))/d,l2=1-l0-l1;if(l0<-1e-6||l1<-1e-6||l2<-1e-6)continue;const y=l0*a[i+1]+l1*a[i+4]+l2*a[i+7];if(y>best)best=y;}}return best;}
// Lunar Skin premium layer, authored once for all nine family chassis (and reused by the Vanguard T0 starter):
// graphite inlay plates with fine gold frame piping, crisp crescents, blue energy conduits ('lunar' surface: the one material
// that pulses) and a moon core in the hood crescent. Everything is attached flush to existing armour faces; no fins, no
// floating parts. Returns the real seams/vents the ghost-flame wisps rise from (renderer effect anchors, visual only).
function famLunar(T,F,cls,anchor,vp,hull){
 const {put,box,cyl,pipe,slab,wall,crest,high}=T,G=LUNAR.graphite,gold=F.gold,wisps=[];
 const [sx,sy,sz,flat]=anchor.side,cr=cls==='scout'?.085:cls==='titan'?.14:.12,L=cr*2.25,Rf=cr*1.75,top=cr*.80,bot=cr*.82,c=cr*.36;
 const outline=[[-L,0],[-L+c,top],[Rf-c,top],[Rf,0],[Rf-c,-bot],[-L+c,-bot]];
 for(const s of [-1,1]){
  if(flat){
   // the medallion lies on a flat shoulder: [x, z] outline, raised along +y
   const pts=outline.map(([u,v])=>[sx+u,s*sz+v]),y=sy+.009;
   slab(pts,sy-.002,.010,'steel',G,.003);
   const edges=high?pts.map((p,i)=>[p,pts[(i+1)%pts.length]]):[[pts[1],pts[2]],[pts[4],pts[5]]];for(const [a,b] of edges)pipe([a[0],y,a[1]],[b[0],y,b[1]],.0055,gold,'gold');
   const g=crest(cr,.008);g.rotateX(-Math.PI/2);put(g,'gold',gold,[sx,y,s*sz]);
   put(box(L-c*.6-cr*.95,.008,.016),'lunar',LUNAR.energy,[sx-(L-c*.6+cr*.95)/2,y+.002,s*sz]);
   put(box(Rf-c*.6-cr*.85,.008,.012),'lunar',LUNAR.energy,[sx+(Rf-c*.6+cr*.85)/2,y+.002,s*sz]);
   wisps.push([sx-L+c*.6,y+.006,s*sz]);continue;
  }
  // vertical side face at z = s*sz, outward +s*z
  const pts=outline.map(([u,v])=>[sx+u,sy+v]),z=d=>s*(sz+d);
  wall(pts,z(.003),.010,'steel',G,.003);
  const edges=high?pts.map((p,i)=>[p,pts[(i+1)%pts.length]]):[[pts[1],pts[2]],[pts[4],pts[5]]];for(const [a,b] of edges)pipe([a[0],a[1],z(.009)],[b[0],b[1],z(.009)],.0055,gold,'gold');
  put(crest(cr,.008),'gold',gold,[sx,sy,s>0?sz+.009:-(sz+.013)]);
  put(box(L-c*.6-cr*.95,.016,.008),'lunar',LUNAR.energy,[sx-(L-c*.6+cr*.95)/2,sy,z(.011)]);
  put(box(Rf-c*.6-cr*.85,.012,.008),'lunar',LUNAR.energy,[sx+(Rf-c*.6+cr*.85)/2,sy,z(.011)]);
  wisps.push([sx-L+c*.6,sy,z(.014)]);
 }
 // gold crown around the turret ring base, on the deck/collar under the rotating turret
 if(anchor.ring)T.put(new THREE.TorusGeometry(anchor.ring[1]+.045,.016,high?6:4,high?40:20),'gold',gold,[0,anchor.ring[0],0],[Math.PI/2,0,0]);
 // Hood: graphite lozenge inlay seated on the measured armour surface (follows the glacis pitch), gold frame, crest, moon core.
 const r=cls==='scout'?.10:.15,hx=anchor.hood[0],at=x=>Math.max(...[0,-.6*r,.6*r].map(zz=>famSurfaceY(hull,x,zz)));
 let y0=at(hx);if(y0<0)y0=anchor.hood[1];const ya=at(hx-r*1.3),yb=at(hx+r*1.3),pitch=ya>0&&yb>0?Math.max(-.6,Math.min(.6,Math.atan2(yb-ya,r*2.6))):0;
 const seat=(g,lift)=>{g.translate(0,lift,0);g.rotateZ(pitch);g.translate(hx,y0,0);return g;};
 const H=[[-r*1.45,0],[-r*.95,r*1.05],[r*1.05,r*1.05],[r*1.5,0],[r*1.05,-r*1.05],[-r*.95,-r*1.05]];
 put(seat(T.plate(H,.010,.003),-.002),'steel',G);
 const he=high?H.map((p,i)=>[p,H[(i+1)%H.length]]):[[H[1],H[2]],[H[4],H[5]]];
 for(const [a,b] of he){const A=new THREE.Vector3(a[0],.009,a[1]),B=new THREE.Vector3(b[0],.009,b[1]),v=B.clone().sub(A),g=cyl(.0055,v.length(),high?8:6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate((A.x+B.x)/2,.009,(A.z+B.z)/2);put(seat(g,0),'gold',gold);}
 const hc=crest(r,.008);hc.rotateX(-Math.PI/2);put(seat(hc,.009),'gold',gold);
 put(seat(cyl(r*.30,.008,high?16:8),.013),'lunar',LUNAR.core);
 for(const s of [-1,1])put(seat(box(r*1.5,.006,.014),.012),'lunar',LUNAR.energy,[0,0,s*r*.80]);
 return {wisps:wisps.concat(vp.slice(0,2)),hood:[hx,y0+.02,0]};
}
// mirror a top-view outline [x,z] to the other side (z -> -z)
const famSide=(pts,s)=>pts.map(([x,z])=>[x,z*s]);
function famChassis(cls,tier,P,team,gems,lunar,S){
 const o=CHASSIS_VISUALS[cls][tier],F=famFinish(P,lunar),halos=[],vp=[],hull=[];
 // Lunar: every existing trim line becomes real gold piping and the designs' cyan seams carry the pulsing Lunar energy.
 if(lunar){const sink=S,ch=(m,c)=>m==='energy'&&LUNAR_CHANNELS.has(c);
  S=Object.assign({},sink,{put:(g,m,c,p,r,s)=>{const trim=m==='steel'&&c===F.edge,q=g.parameters;
   // a long, thin trim box: gold piping on top, a blue channel laid just beneath it on the same face
   if(trim&&p&&g.type==='BoxGeometry'&&q.height<=.016&&Math.max(q.width,q.depth)>=.28)sink.put(new THREE.BoxGeometry(q.width*.94,.010,q.depth*.82),'lunar',LUNAR.energy,[p[0],p[1]-q.height/2-.007,p[2]],r,s);
   // over a paint, secondary plates below the deck line (fenders, skirts, lower shields) are the graphite structure; at roof
   // level they keep the paint (its turret colour), so glacis, roof and upper side armour read as the player's paint
   if(m==='paint'&&c===F.plate&&!F.lunarStock){if(!g.boundingBox)g.computeBoundingBox();if(g.boundingBox.max.y+(p?p[1]:0)>o.deck-.03)c=F.plateUp;}
   const out=sink.put(g,trim?'gold':ch(m,c)?'lunar':m,ch(m,c)?LUNAR.energy:c,p,r,s);if(m==='paint'&&out)hull.push(out);return out;}});}
 const T=famTools(S),high=T.high;
 const {put,box,cyl,slab,panel,wall,block,pipe,bolt,lamp}=T;
 // real vent / radiator positions: the Lunar ghost-flame wisps rise from these
 const vents=(F,x,y,z,l,w,n)=>{T.vents(F,x,y,z,l,w,n);vp.push([x,y+.03,z]);},grille=(F,x,y,z,l,w,n)=>{T.grille(F,x,y,z,l,w,n);vp.push([x,y+.03,z]);};
 // every pod on one tank shares one length/height and sits at +-center, so one track uniform drives them all
 let run=null;const tt=o.h+.075;   // tt: top of the tread shoes; fenders and hull overhangs start above it
 const drive=(extra,centers=[0])=>{const t=Object.assign({length:o.len,height:o.h,depth:o.trackW,offset:o.trackZ,wheels:o.wheels,road:Math.min(.20,o.h*.32),end:o.h*.39},extra||{});for(const s of [-1,1])for(const c of centers)T.track(F,Object.assign({},t,{center:c}),s);run={len:t.length,c:centers.length>1?Math.abs(centers[0]):0};};
 const head=(x,y,z,w)=>{for(const s of [-1,1]){lamp(F,x,y,s*z,w);halos.push([x+.02,y,s*z,'#bdeaff',.10]);}};
 const teamBar=(x,y,z,l=.18)=>{for(const s of [-1,1])put(box(l,.018,.026),'energy',team,[x,y,s*z]);};
 const tierBar=(x,y,z)=>{if(tier)for(const s of [-1,1])put(box(.12,.011,.022),'steel',TIERC[tier],[x,y,s*z]);};
 const tails=(x,y,z)=>{for(const s of [-1,1])put(box(.018,.025,.10),'energy',F.tail,[x,y,s*z]);};
 let anchor={hood:[o.len*.25,o.deck+.004],side:[-.2,o.h*.62,o.trackZ+o.trackW/2+.03]},coreAt=[-(o.len/2-.15),[-.22,0,.22]],ringR=cls==='scout'?.36:cls==='titan'?.47:.43;
 const key=cls+':'+tier;
 if(key==='scout:0'){
  // SCOUT: smallest machine. Narrow dart hull riding between two bare, compact four-wheel tracks on exposed arms.
  drive({length:1.70,road:.082,end:.104});
  const bp=[[-.86,-.27],[.30,-.29],[.82,-.08],[.95,0],[.82,.08],[.30,.29],[-.86,.27]];
  block(bp,bp.map(([x,z])=>[x*.93-.03,z*.80]),.11,o.deck,'paint',F.paint,[.10,.95,.15,.20,.20]);
  slab([[-.80,-.20],[.10,-.215],[.10,.215],[-.80,.20]],o.deck-.026,.034,'paint',F.plate,.01);
  block([[.12,-.035],[.86,-.012],[.86,.012],[.12,.035]],[[.12,-.02],[.80,-.006],[.80,.006],[.12,.02]],o.deck-.05,o.deck+.012,'steel',F.edge,[.12,.86,.12,o.deck-.06,.10]);
  for(const s of [-1,1]){
   for(const x of [-.56,.0,.50]){pipe([x,.21,s*.24],[x,.21,s*(o.trackZ-o.trackW/2+.02)],.026,'#7b8792');put(box(.05,.09,.05),'steel','#5c6772',[x,.25,s*.38]);}
   slab(famSide([[-.80,o.trackZ-.115],[.64,o.trackZ-.115],[.78,o.trackZ-.05],[.66,o.trackZ+.115],[-.80,o.trackZ+.115]],s),tt,.022,'paint',F.paint,.006);
   put(box(1.0,.012,.016),'steel',F.edge,[-.10,tt+.028,s*(o.trackZ+.07)]);
   pipe([-.78,.30,s*.16],[-.97,.30,s*.16],.032,F.steel);put(cyl(.026,.02,8),'rubber',F.dark,[-.975,.30,s*.16],[0,0,Math.PI/2]);
   put(box(.20,.016,.02),'energy',team,[-.10,.30,s*.285]);
  }
  vents(F,-.58,o.deck+.002,0,.24,.22,5);head(.70,.29,.13,.07);tails(-.87,.25,.20);tierBar(-.42,o.deck+.012,.17);
  anchor={hood:[.48,o.deck-.02],side:[-.25,.26,.285]};coreAt=[-.77,[-.14,0,.14]];
 }else if(key==='scout:1'){
  // STRIDER: longer speed recon. Blunt chisel nose, split shield pods over each track, rear speed fins, sensor pod.
  drive({length:1.92,road:.086,end:.108});
  const bp=[[-.98,-.31],[.52,-.31],[1.0,-.19],[1.0,.19],[.52,.31],[-.98,.31]];
  block(bp,[[-.94,-.26],[.40,-.26],[.78,-.17],[.78,.17],[.40,.26],[-.94,.26]],.11,o.deck,'paint',F.paint,[.30,1.0,.12,.22,.18]);
  put(box(.04,.07,.40),'steel',F.edge,[.99,.17,0]);
  for(const s of [-1,1]){
   const zi=o.trackZ-o.trackW/2-.01,zo=o.trackZ+o.trackW/2+.03;
   // split shield pods: a cap over the tread and a raked outer shield clear of the wheels, front and rear
   for(const [x0,x1] of [[.10,.86],[-.98,-.22]]){
    block(famSide([[x0,zi-.01],[x1,zi-.01],[x1+.12,(zi+zo)/2],[x1,zo+.15],[x0,zo+.15]],s),famSide([[x0+.03,zi+.01],[x1-.05,zi+.01],[x1+.04,(zi+zo)/2],[x1-.05,zo+.13],[x0+.03,zo+.13]],s),tt,tt+.05,'paint',F.plate);
    wall([[x0,.13],[x1,.13],[x1+.12,.25],[x1+.12,tt+.01],[x0,tt+.01]],s*(zo+.125),.045,'paint',F.paint,.008);
    put(box((x1-x0)*.7,.012,.016),'steel',F.edge,[(x0+x1)/2,.22,s*(zo+.15)]);
   }
   wall([[-1.0,o.deck-.01],[-.74,o.deck-.01],[-.88,.52],[-1.02,.52]],s*.24,.026,'paint',F.plate,.006);
   put(box(.20,.015,.018),'energy',team,[.48,tt+.055,s*(zi+.06)]);
  }
  for(const s of [-1,1])vents(F,-.64,o.deck+.002,s*.14,.30,.10,4);
  panel(.66,o.deck,-.17,.13,.11,.085,'steel',F.steel,.006);put(box(.015,.03,.06),'energy','#6bcde5',[.73,o.deck+.05,-.17]);
  head(.95,.29,.15,.07);tails(-.99,.26,.22);tierBar(-.40,o.deck+.012,.18);
  anchor={hood:[.55,o.deck-.035],side:[-.60,.20,o.trackZ+o.trackW/2+.035]};coreAt=[-.86,[-.15,0,.15]];
 }else if(key==='scout:2'){
  // PHANTOM: lowest scout. Faceted stealth lens hull, swept wing shoulders over four separated articulated pods.
  const pc=.53;drive({length:.84,wheels:3,road:.072,end:.088},[-pc,pc]);
  const bp=[[-.98,-.14],[-.62,-.27],[.30,-.28],[.90,-.10],[1.02,0],[.90,.10],[.30,.28],[-.62,.27],[-.98,.14]];
  block(bp,bp.map(([x,z])=>[x*.92-.02,z*.62]),.10,o.deck,'paint',F.paint,[.20,1.02,.11,.20,.15]);
  block([[-.70,-.05],[.50,-.06],[.70,0],[.50,.06],[-.70,.05]],[[-.66,-.025],[.44,-.03],[.60,0],[.44,.03],[-.66,.025]],o.deck-.01,o.deck+.035,'paint',F.plate);
  put(box(.24,.028,.04),'steel',F.steel,[1.10,.19,0]);put(box(.02,.02,.03),'energy','#6bcde5',[1.225,.19,0]);
  for(const s of [-1,1]){
   slab(famSide([[.56,.22],[.06,.80],[-.38,.80],[-.30,.22]],s),tt,.04,'paint',F.plate,.01);
   put(box(.50,.012,.016),'steel',F.edge,[-.06,tt+.045,s*.62],[0,s*.85,0]);
   for(const c of [-pc,pc]){
    slab(famSide([[c-.40,o.trackZ-.12],[c+.34,o.trackZ-.12],[c+.42,o.trackZ],[c+.34,o.trackZ+.12],[c-.40,o.trackZ+.12]],s),tt,.026,'paint',F.paint,.006);
    pipe([c,.15,s*.22],[c,.15,s*(o.trackZ-o.trackW/2)],.03,'#7b8792');put(cyl(.05,.05,10),'gold',F.gold,[c,.15,s*(o.trackZ-o.trackW/2-.02)],[Math.PI/2,0,0]);
   }
   put(box(.022,.018,.10),'energy',team,[-.93,.37,s*.28]);
   wall([[-1.0,.25],[-.80,.25],[-.86,.40],[-.98,.40]],s*.30,.024,'paint',F.plate,.005);
  }
  put(box(.06,.04,.62),'steel',F.steel,[-.92,.37,0]);put(box(.03,.012,.50),'energy','#6bcde5',[-.95,.394,0]);
  grille(F,-.55,o.deck+.004,0,.22,.20,5);head(.86,.25,.09,.05);tails(-.99,.22,.12);tierBar(-.30,o.deck+.012,.15);
  anchor={hood:[.52,o.deck-.045],side:[-.08,tt+.042,.55,'flat']};coreAt=[-.78,[-.12,0,.12]];
 }else if(key==='vanguard:1'){
  // SENTINEL: defensive medium. Upright squared prow and bumper, tall vertical side walls, square forward shoulder
  // shields standing proud of the tracks, a tall armoured sensor housing on the rear deck.
  drive();
  const zi=o.trackZ-o.trackW/2,zo=o.trackZ+o.trackW/2;
  block([[-1.24,-zi+.04],[1.10,-zi+.04],[1.22,-zi+.14],[1.22,zi-.14],[1.10,zi-.04],[-1.24,zi-.04]],[[-1.22,-zi+.06],[1.12,-zi+.06],[1.18,-zi+.14],[1.18,zi-.14],[1.12,zi-.06],[-1.22,zi-.06]],.16,.57,'paint',F.paint);
  // squared casemate with near-vertical sides standing on flat fender shelves over the tracks
  block([[-1.26,-zi-.02],[1.04,-zi-.02],[1.20,-zi+.12],[1.20,zi-.12],[1.04,zi+.02],[-1.26,zi+.02]],[[-1.24,-zi+.05],[.96,-zi+.05],[1.08,-zi+.16],[1.08,zi-.16],[.96,zi-.05],[-1.24,zi-.05]],tt,o.deck,'paint',F.paint,[.80,1.2,.07,.6,.10]);
  for(const s of [-1,1]){slab(famSide([[-1.27,zi-.04],[1.12,zi-.04],[1.24,zi+.10],[1.24,zo+.06],[-1.27,zo+.06]],s),tt,.05,'paint',F.plate,.01);
   put(box(2.0,.012,.016),'steel',F.edge,[-.15,tt+.056,s*(zi+.02)]);if(high)for(let i=0;i<6;i++)bolt(-1.1+i*.4,tt+.055,s*(zo+.01));}
  put(box(.11,.40,1.22),'paint',F.plate,[1.25,.39,0],[0,0,.10]);put(box(.07,.07,1.52),'steel',F.steel,[1.32,.24,0]);
  for(const z of [-.36,0,.36])put(box(.02,.30,.012),'rubber',F.dark,[1.31,.40,z],[0,0,.10]);
  slab([[-.95,-.50],[.30,-.50],[.30,.50],[-.95,.50]],o.deck-.02,.04,'paint',F.plate,.012);put(box(.30,.03,.30),'paint',F.plate,[.62,o.deck,0]);if(high)for(const z of [-.1,.1])bolt(.62,o.deck+.016,z);
  for(const s of [-1,1]){
   // upright walls hang over the tread run, clear of the road wheels; the square shoulder shield stands proud
   wall([[.40,.45],[1.24,.45],[1.32,.52],[1.32,.755],[.40,.755]],s*(zo+.085),.07,'paint',F.plate,.012);
   wall([[.40,.70],[1.30,.70],[1.30,.755],[.40,.755]],s*(zo-.005),.12,'paint',F.plate,.008);
   wall([[-1.26,.45],[.40,.45],[.40,tt+.05],[-1.26,tt+.05]],s*(zo+.035),.05,'paint',F.paint,.01);
   for(const x of [-.92,-.48,-.04])put(box(.018,.22,.012),'rubber',F.dark,[x,.57,s*(zo+.056)]);
   if(high)for(const x of [-1.15,-.70,-.26,.25])bolt(x,.50,s*(zo+.058),'z');
   put(box(.70,.012,.02),'steel',F.edge,[.86,.70,s*(zo+.122)]);put(box(.22,.02,.02),'energy',team,[.62,.60,s*(zo+.122)]);
   put(box(.14,.06,.20),'rubber',F.dark,[-1.27,.50,s*.62]);put(box(.03,.03,.14),'energy',F.tail,[-1.30,.50,s*.62]);
  }
  panel(-1.02,o.deck,.40,.22,.20,.075,'paint',F.plate,.012);put(box(.02,.03,.12),'energy','#83c6df',[-.905,o.deck+.045,.40]);pipe([-1.10,o.deck+.07,.40],[-1.10,o.deck+.075,.52],.012,F.steel);
  vents(F,-.95,o.deck+.02,-.30,.26,.26,6);head(1.30,.47,.40,.12);tierBar(-.35,o.deck+.022,.54);
  anchor={hood:[.80,o.deck-.05],side:[-.40,.58,zo+.062]};coreAt=[-1.12,[-.24,0,.24]];
 }else if(key==='vanguard:2'){
  // PALADIN: elite medium assault. Three stacked chevron glacis layers, flared angular cheek armour, two-tier skirts
  // with a trim line, reinforced flank modules and rear cooling banks.
  drive();
  const zi=o.trackZ-o.trackW/2,zo=o.trackZ+o.trackW/2;
  block([[-1.30,-zi+.03],[.95,-zi+.03],[1.32,-.40],[1.32,.40],[.95,zi-.03],[-1.30,zi-.03]],[[-1.28,-zi+.05],[.92,-zi+.05],[1.24,-.38],[1.24,.38],[.92,zi-.05],[-1.28,zi-.05]],.16,.58,'paint',F.paint);
  block([[-1.32,-.98],[.62,-.98],[1.38,-.22],[1.42,0],[1.38,.22],[.62,.98],[-1.32,.98]],[[-1.30,-.94],[.56,-.94],[1.24,-.20],[1.28,0],[1.24,.20],[.56,.94],[-1.30,.94]],tt,o.deck-.02,'paint',F.paint,[.55,1.42,.10,.6,.09]);
  const chev=(xa,w,d,y,t,c)=>{const p=[[xa,0],[xa-.72,w],[xa-.72-d,w],[xa-d,0],[xa-.72-d,-w],[xa-.72,-w]];T.put(T.plate(p,t,.012),'paint',c,[0,y,0]);};
  chev(1.36,.70,.18,.585,.06,F.plate);chev(1.18,.62,.16,.61,.06,F.paint);chev(1.00,.54,.15,.635,.07,F.plate);
  for(const s of [-1,1]){
   block(famSide([[.50,.94],[1.16,.86],[1.30,.98],[.78,zo+.05],[.44,zo+.03]],s),famSide([[.54,.95],[1.08,.89],[1.18,.98],[.76,zo+.01],[.50,zo]],s),tt+.005,o.deck-.01,'paint',F.plate);
   // two-tier skirt: a raked upper strip and a row of lower leaves, both clear of the road wheels
   block(famSide([[-1.30,zo+.01],[.42,zo+.01],[.42,zo+.075],[-1.30,zo+.075]],s),famSide([[-1.30,zo-.04],[.42,zo-.04],[.42,zo+.005],[-1.30,zo+.005]],s),.53,o.deck-.03,'paint',F.paint);
   for(let i=0;i<4;i++){const x=-1.20+i*.42;wall([[x,.455],[x+.38,.455],[x+.36,.535],[x+.02,.535]],s*(zo+.06),.04,'paint',i%2?F.paint:F.plate,.008);}
   put(box(1.70,.014,.02),'steel',F.edge,[-.44,.535,s*(zo+.085)]);
   for(const x of [-.78,-.24])panel(x,o.deck-.02,s*.80,.34,.26,.11,'paint',F.plate,.014);
   if(high)for(const x of [-.78,-.24])for(const d of [-.1,.1])bolt(x+d,o.deck+.095,s*.80);
   put(box(.20,.02,.026),'energy',team,[.80,.64,s*(zo+.03)],[0,s*.14,0]);
   pipe([-1.33,.52,s*.55],[-1.33,o.deck-.03,s*.55],.045,F.steel);put(cyl(.04,.02,10),'rubber',F.dark,[-1.33,o.deck-.02,s*.55]);
   vents(F,-1.02,o.deck,s*.40,.30,.22,6);
  }
  head(1.22,.58,.90,.10);tails(-1.33,.40,.72);tierBar(-.50,o.deck+.012,.55);
  anchor={hood:[.80,o.deck+.01],side:[-.56,.495,zo+.082]};coreAt=[-1.18,[-.24,0,.24]];
 }else if(key==='titan:0'){
  // TITAN "Siege Warden": a faceted arrowhead hull whose flanks rake down over the widest tracks, layered slope armour
  // split by energy seams, overlapping skirt scales above exposed suspension struts, pointed track horns, an undercut
  // beak and twin radiator stacks at the stern.
  drive({length:2.70,road:.19,end:.225});   // a shorter run: the arrowhead nose and tapered stern project beyond the tracks
  const zi=o.trackZ-o.trackW/2,zo=o.trackZ+o.trackW/2,glow='#5fd4ff',a=Math.atan2(o.deck-tt,.36);
  block([[-1.40,-zi+.04],[1.02,-zi+.04],[1.44,-.30],[1.44,.30],[1.02,zi-.04],[-1.40,zi-.04]],[[-1.38,-zi+.06],[1.0,-zi+.06],[1.38,-.28],[1.38,.28],[1.0,zi-.06],[-1.38,zi-.06]],.18,.66,'paint',F.paint);
  block([[1.0,-.62],[1.50,-.18],[1.58,0],[1.50,.18],[1.0,.62]],[[1.0,-.50],[1.40,-.12],[1.46,0],[1.40,.12],[1.0,.50]],.16,.46,'paint',F.plate);
  put(box(.05,.05,.40),'steel',F.edge,[1.52,.20,0]);
  const up=[[-1.48,-.98],[-1.24,-1.20],[.62,-1.20],[1.38,-.52],[1.50,0],[1.38,.52],[.62,1.20],[-1.24,1.20],[-1.48,.98]];
  const top=[[-1.40,-.70],[-1.20,-.84],[.50,-.84],[1.06,-.40],[1.16,0],[1.06,.40],[.50,.84],[-1.20,.84],[-1.40,.70]];
  block(up,top,tt,o.deck,'paint',F.paint);
  // raised armoured roof with recessed seams
  slab([[-1.30,-.62],[-1.10,-.74],[.42,-.74],[.86,-.34],[.86,.34],[.42,.74],[-1.10,.74],[-1.30,.62]],o.deck-.02,.04,'paint',F.plate,.012);
  for(const s of [-1,1]){
   // three layered plates on each raked flank, seams lit between them
   for(const [x0,x1] of [[-1.18,-.64],[-.58,-.04],[.02,.46]]){const w=.30,g=T.plate([[x0,-w/2],[x1,-w/2],[x1-.05,w/2],[x0+.05,w/2]],.032,.01);put(g,'paint',x0<-1?F.plate:x0<0?F.paint:F.plate,[0,(o.deck+tt)/2+.02*Math.cos(a),s*(1.02+.02*Math.sin(a))],[s*a,0,0]);}
   for(const x of [-.61,-.01,.49])pipe([x,o.deck+.004,s*.84],[x,tt+.004,s*1.20],.009,glow,'energy');
   pipe([.50,o.deck+.005,s*.84],[1.06,o.deck+.005,s*.40],.009,glow,'energy');
   // overlapping skirt scales over the tread run; suspension struts stand exposed between the road wheels
   for(let i=0;i<5;i++){const x=-1.12+i*.42;wall([[x,.545],[x+.42,.545],[x+.46,tt+.045],[x-.02,tt+.045]],s*(zo+(i%2?.085:.055)),.045,'paint',i%2?F.plate:F.paint,.01);put(box(.30,.012,.014),'steel',F.edge,[x+.22,.60,s*(zo+(i%2?.11:.08))]);}
   for(let i=0;i<6;i++){const x=-1.06+(i+.5)*2.12/6;pipe([x,.14,s*1.27],[x,.36,s*1.27],.026,'#7b8792');pipe([x,.36,s*1.27],[x,.54,s*1.27],.015,F.edge);put(cyl(.034,.03,10),'gold',F.gold,[x,.36,s*1.27]);}
   // pointed horns over the track fronts, each carrying a headlamp
   block(famSide([[.90,zi],[1.24,zi+.05],[1.40,(zi+zo)/2],[1.24,zo+.02],[.90,zo+.02]],s),famSide([[.90,zi+.03],[1.16,zi+.07],[1.28,(zi+zo)/2],[1.16,zo-.02],[.90,zo-.02]],s),tt,tt+.10,'paint',F.plate);
   pipe([.92,tt+.105,s*(zo-.05)],[1.30,tt+.06,s*(zi+.14)],.008,glow,'energy');
   // stern radiator stacks: thin heat-sink fins in an armoured frame, clear of the core sockets and below the gun line
   // radiator banks recessed into the stern hump: heat-sink fins flush with its roof
   panel(-1.30,o.ring+.04,s*.38,.26,.40,.012,'rubber',F.dark,.004);vp.push([-1.30,o.ring+.08,s*.38]);
   for(let i=0;i<6;i++)put(box(.016,.03,.36),'steel',i%2?'#7d8994':F.steel,[-1.41+i*.045,o.ring+.065,s*.38]);
   pipe([-1.12,o.ring+.058,s*.62],[-1.44,o.ring+.058,s*.62],.009,glow,'energy');
   put(box(.03,.07,.20),'energy','#ff7a3a',[-1.455,.55,s*.46]);put(box(.06,.12,.28),'rubber',F.dark,[-1.425,.55,s*.46]);
   put(box(.26,.022,.028),'energy',team,[.20,o.deck+.004,s*.79]);
  }
  // the raked stern hump: the hull rises toward the rear like a crouched predator, below the gun line
  block([[-1.47,-.74],[-.92,-.74],[-.92,.74],[-1.47,.74]],[[-1.44,-.66],[-1.12,-.66],[-1.12,.66],[-1.44,.66]],o.deck-.01,o.ring+.055,'paint',F.plate);
  put(box(.03,.03,1.30),'steel',F.edge,[-1.115,o.ring+.058,0]);
  // armoured spine ridge running down the glacis, team chevron either side
  block([[.55,-.07],[1.48,-.02],[1.48,.02],[.55,.07]],[[.55,-.03],[1.36,-.008],[1.36,.008],[.55,.03]],.60,o.deck+.035,'paint',F.plate,[1.0,1.48,.22,.62,.25]);
  for(const s of [-1,1])pipe([1.06,o.deck-.008,s*.30],[1.34,.75,s*.06],.011,team,'energy');
  head(1.36,tt+.05,1.0,.09);tierBar(-.30,o.deck+.016,.60);
  anchor={hood:[.74,o.deck+.02],side:[-.30,.625,zo+.11]};coreAt=[-.80,[-.24,0,.24]];
 }else if(key==='titan:1'){
  // BULWARK "Bastion Ram": a moving fortress. Battered (inward-leaning) bastion walls in three segments with glowing
  // slits and buttresses, a raked V-plow with ribbed faces, corner battlement towers at the stern, a recessed deck.
  drive({road:.19,end:.225});
  const zi=o.trackZ-o.trackW/2,zo=o.trackZ+o.trackW/2,glow='#5fd4ff',top=o.ring-.01;
  block([[-1.42,-zi+.03],[1.30,-zi+.03],[1.42,-zi+.12],[1.42,zi-.12],[1.30,zi-.03],[-1.42,zi-.03]],[[-1.40,-zi+.05],[1.28,-zi+.05],[1.38,-zi+.12],[1.38,zi-.12],[1.28,zi-.05],[-1.40,zi-.05]],.18,.65,'paint',F.paint);
  block([[-1.46,-1.04],[-1.30,-1.14],[1.22,-1.14],[1.40,-.98],[1.40,.98],[1.22,1.14],[-1.30,1.14],[-1.46,1.04]],[[-1.42,-.94],[-1.28,-1.02],[1.10,-1.02],[1.26,-.88],[1.26,.88],[1.10,1.02],[-1.28,1.02],[-1.42,.94]],tt,o.deck,'paint',F.paint);
  // the plow: two raked wings meeting in a prow, faces ribbed, a dark throat behind
  for(const s of [-1,1]){
   const bw=famSide([[1.12,1.30],[1.30,1.30],[1.66,0],[1.52,0]],s),tw=famSide([[.96,1.24],[1.12,1.24],[1.50,0],[1.36,0]],s);block(bw,tw,.06,.74,'paint',F.plate);
   // a second, layered armour band across the upper plow face, trimmed along its lower edge
   const fl=k=>[[1.30-.18*k,1.30-.06*k],[1.66-.16*k,0]],band=(k,dx)=>{const [o2,t2]=fl(k);return famSide([[o2[0]+dx,o2[1]],[t2[0]+dx,0],[t2[0]+dx-.10,0],[o2[0]+dx-.10,o2[1]]],s);};
   block(band(.52,.035),band(.92,.035),.06+.68*.52,.06+.68*.92,'paint',F.paint);
   {const [o2,t2]=fl(.52);pipe([t2[0]+.04,.06+.68*.52,0],[o2[0]+.04,.06+.68*.52,s*o2[1]],.014,F.edge);}
  }
  put(box(.06,.70,.06),'paint',F.plate,[1.60,.40,0],[0,0,.24]);put(box(.16,.40,.50),'rubber',F.dark,[1.40,.30,0]);
  for(const s of [-1,1]){
   // three battered wall segments with slits between them and buttresses on the outer face
   // wall heads lean further in toward bow and stern, so the fortress reads as an elongated hexagon from above
   const lean=x=>x>.30?-(x-.30)/.84*.10:x<-.66?-(-.66-x)/.82*.08:0;
   for(const [x0,x1] of [[-1.48,-.66],[-.60,.24],[.30,1.14]]){
    block(famSide([[x0,1.28],[x1,1.28],[x1,1.33],[x0,1.33]],s),famSide([[x0+.03,1.22+lean(x0+.03)],[x1-.03,1.22+lean(x1-.03)],[x1-.03,1.29+lean(x1-.03)],[x0+.03,1.29+lean(x0+.03)]],s),.12,top,'paint',x0<-1||x0>0?F.plate:F.paint);
    put(box(x1-x0-.12,.014,.012),'rubber',F.dark,[(x0+x1)/2,.50,s*1.32]);if(high)for(const d of [.15,.5,.85])bolt(x0+(x1-x0)*d,.40,s*1.33,'z');
    const xb=(x0+x1)/2;block(famSide([[xb-.08,1.32],[xb+.08,1.32],[xb+.08,1.37],[xb-.08,1.37]],s),famSide([[xb-.05,1.28+lean(xb)],[xb+.05,1.28+lean(xb)],[xb+.05,1.30+lean(xb)],[xb-.05,1.30+lean(xb)]],s),.12,.78,'paint',F.paint);
    pipe([x0+.03,top+.004,s*(1.255+lean(x0+.03))],[x1-.03,top+.004,s*(1.255+lean(x1-.03))],.010,F.edge);
   }
   for(const x of [-.63,.27])put(box(.03,.55,.03),'energy',glow,[x,.50,s*1.29]);
   slab(famSide([[-1.46,1.06],[1.18,1.06],[1.18,1.24],[-1.46,1.24]],s),o.deck-.03,.03,'paint',F.dark,.006);
   // forward shoulder towers on the wall heads
   block(famSide([[.52,.98],[1.16,.98],[1.28,1.08],[1.20,1.20],[.52,1.24]],s),famSide([[.58,1.03],[1.08,1.03],[1.16,1.08],[1.10,1.15],[.58,1.20]],s),o.deck-.02,top,'paint',F.plate,[.9,1.30,.06,o.deck,.08]);
   pipe([.62,top+.004,s*1.04],[1.10,top+.004,s*1.04],.008,glow,'energy');
   // stern battlement towers (crenellated) beside the core sockets
   block(famSide([[-1.46,.52],[-1.02,.52],[-1.02,1.0],[-1.46,1.0]],s),famSide([[-1.42,.56],[-1.06,.56],[-1.06,.96],[-1.42,.96]],s),o.deck-.01,o.ring+.03,'paint',F.plate);
   for(const z of [.60,.78,.94])put(box(.30,.035,.08),'paint',F.paint,[-1.24,o.ring+.045,s*z]);
   put(box(.24,.02,.03),'energy',team,[-1.24,o.ring-.02,s*1.005]);
   put(box(.16,.10,.26),'rubber',F.dark,[-1.48,.62,s*.72]);put(box(.03,.04,.18),'energy',F.tail,[-1.565,.62,s*.72]);
   put(box(.30,.022,.03),'energy',team,[-.15,.70,s*1.335]);
  }
  slab([[-.20,-.86],[.60,-.86],[.60,.86],[-.20,.86]],o.deck-.015,.035,'paint',F.plate,.01);
  grille(F,-.78,o.deck+.004,0,.32,.50,6);head(1.34,.66,.60,.12);tierBar(-.30,o.deck+.016,.78);
  anchor={hood:[.76,o.deck+.02],side:[-.85,.45,1.318]};coreAt=[-1.24,[-.25,0,.25]];
 }else{
  // COLOSSUS "Citadel Dreadnought": the flagship. Four pointed armoured nacelles hung on articulated A-frame pylons
  // with hydraulic rams, a stepped faceted keel with glowing conduits, layered shoulder wings, a low spear prow,
  // twin stern thrusters and a swept crown of fins: the largest, most complex silhouette in the game.
  const pc=.80;drive({length:1.42,wheels:4,road:.20,end:.24},[-pc,pc]);
  const zi=o.trackZ-o.trackW/2,zo=o.trackZ+o.trackW/2,glow='#5fd4ff';
  block([[-1.52,-zi+.03],[1.34,-zi+.03],[1.55,-.55],[1.55,.55],[1.34,zi-.03],[-1.52,zi-.03]],[[-1.50,-zi+.05],[1.30,-zi+.05],[1.46,-.53],[1.46,.53],[1.30,zi-.05],[-1.50,zi-.05]],.18,.67,'paint',F.paint);
  block([[1.30,-.42],[1.62,0],[1.30,.42]],[[1.30,-.30],[1.52,0],[1.30,.30]],.20,.42,'paint',F.plate);
  // stepped keel: a raked lower tier and an inset upper citadel, both pointed fore and aft
  block([[-1.58,-.62],[-1.30,-.96],[1.08,-.96],[1.56,-.36],[1.62,0],[1.56,.36],[1.08,.96],[-1.30,.96],[-1.58,.62]],[[-1.50,-.52],[-1.24,-.84],[.98,-.84],[1.40,-.30],[1.46,0],[1.40,.30],[.98,.84],[-1.24,.84],[-1.50,.52]],tt,.80,'paint',F.plate);
  block([[-1.40,-.50],[-1.16,-.74],[.86,-.74],[1.20,-.34],[1.26,0],[1.20,.34],[.86,.74],[-1.16,.74],[-1.40,.50]],[[-1.34,-.40],[-1.12,-.62],[.76,-.62],[1.06,-.28],[1.10,0],[1.06,.28],[.76,.62],[-1.12,.62],[-1.34,.40]],.795,o.deck,'paint',F.paint);
  // layered chevron beak on the lower tier's prow
  const chev=(xa,w,d,y,t,c)=>{const p=[[xa,0],[xa-.46,w],[xa-.46-d,w],[xa-d,0],[xa-.46-d,-w],[xa-.46,-w]];T.put(T.plate(p,t,.01),'paint',c,[0,y,0]);};
  chev(1.50,.40,.12,.74,.04,F.edge);chev(1.36,.36,.12,.78,.04,F.plate);
  for(const s of [-1,1]){
   pipe([-1.10,o.deck+.005,s*.63],[.74,o.deck+.005,s*.63],.009,glow,'energy');pipe([.76,o.deck+.005,s*.62],[1.06,o.deck+.005,s*.29],.009,glow,'energy');
   pipe([-1.22,.805,s*.86],[.96,.805,s*.86],.008,glow,'energy');
   for(const c of [-pc,pc]){
    // a pointed nacelle per pod: faceted roof, angular outer skirt, lit roof strip, pivot joint at the inner end
    const d=c>0?1:-1,X=x=>c+d*(x-c);
    const bp=famSide([[X(c-.66),zi-.04],[X(c+.50),zi-.04],[X(c+.80),(zi+zo)/2+.02],[X(c+.50),zo+.16],[X(c-.66),zo+.16]],s),tp=famSide([[X(c-.62),zi],[X(c+.40),zi],[X(c+.62),(zi+zo)/2+.02],[X(c+.40),zo+.06],[X(c-.62),zo+.06]],s);
    block(bp,tp,tt,tt+.14,'paint',c>0?F.plate:F.paint);
    const sk=[[c-.66,.42],[c+.48,.42],[c+.68,.56],[c+.68,tt+.02],[c-.66,tt+.02]].map(([x,y])=>[X(x),y]);wall(d>0?sk:sk.slice().reverse(),s*(zo+.125),.05,'paint',c>0?F.paint:F.plate,.01);
    pipe([X(c-.58),tt+.145,s*(zo+.03)],[X(c+.38),tt+.145,s*(zo+.03)],.009,glow,'energy');
    put(box(1.0,.014,.02),'steel',F.edge,[c,.66,s*(zo+.152)]);for(const k of [-.30,-.10,.10,.30])put(box(.10,.035,.012),'energy',glow,[c+k,.56,s*(zo+.153)]);if(high)for(const k of [-.45,0,.45])bolt(c+k,.48,s*(zo+.152),'z');
    put(cyl(.09,.08,12),'gold',F.gold,[X(c-.62),tt+.07,s*(zi-.02)],[Math.PI/2,0,0]);
   }
   // articulated A-frame pylon between the pods: two struts, a cross beam, a gold node and two hydraulic rams
   for(const dx of [-1,1])pipe([dx*.12,.80,s*.66],[0,.42,s*(zo+.10)],.045,F.steel);
   pipe([0,.42,s*.70],[0,.42,s*(zo+.10)],.06,'#7b8792');put(cyl(.12,.06,12),'gold',F.gold,[0,.42,s*(zo+.10)],[Math.PI/2,0,0]);put(cyl(.05,.05,10),'steel',F.dark,[0,.42,s*(zo+.13)],[Math.PI/2,0,0]);
   for(const dx of [-1,1]){pipe([0,.44,s*(zo+.10)],[dx*.12,.60,s*(zo+.08)],.03,'#7b8792');pipe([dx*.12,.60,s*(zo+.08)],[dx*.20,.71,s*(zo+.07)],.018,F.edge);}
   // layered shoulder wings over the front nacelles
   block(famSide([[.10,.90],[1.00,.90],[1.30,1.04],[1.02,1.30],[.10,1.30]],s),famSide([[.16,.92],[.92,.92],[1.14,1.02],[.94,1.16],[.16,1.16]],s),tt+.12,o.deck-.035,'paint',F.plate);
   block(famSide([[.30,.92],[.86,.92],[1.02,1.00],[.84,1.10],[.30,1.10]],s),famSide([[.34,.93],[.80,.93],[.94,1.00],[.78,1.06],[.34,1.06]],s),o.deck-.04,o.deck+.01,'paint',F.paint);
   put(box(.70,.014,.02),'steel',F.edge,[.60,o.deck-.035,s*1.18]);put(box(.30,.022,.03),'energy',team,[-.80,.62,s*(zo+.153)]);
   put(new THREE.TorusGeometry(.065,.02,4,high?12:8),'steel',F.edge,[1.56,.28,s*.42],[0,Math.PI/2,0]);
   // twin stern thrusters with lit cores and cooling rings
   put(cyl(.17,.30,high?20:10),'steel',F.steel,[-1.52,.55,s*.50],[0,0,Math.PI/2]);put(cyl(.12,.31,high?18:10),'rubber',F.dark,[-1.53,.55,s*.50],[0,0,Math.PI/2]);
   put(cyl(.075,.02,high?16:8),'energy','#ff8a3d',[-1.675,.55,s*.50],[0,0,Math.PI/2]);
   for(const x of [-1.44,-1.54,-1.64])put(cyl(.19,.018,high?20:10),'steel',F.edge,[x,.55,s*.50],[0,0,Math.PI/2]);
   put(box(.03,.04,.20),'energy',F.tail,[-1.61,.80,s*.84]);
  }
  // swept crown fins on the stern, below the gun line, the flagship's side-view signature
  for(const z of [-.36,-.18,0,.18,.36])wall([[-1.58,.79],[-1.34,.79],[-1.44,o.ring+.075],[-1.58,o.ring+.075]],z,.028,'paint',Math.abs(z)<.1?F.plate:F.paint,.006);
  pipe([-1.56,o.ring+.077,-.40],[-1.56,o.ring+.077,.40],.012,glow,'energy');
  vents(F,-.95,o.deck+.004,-.36,.30,.20,6);vents(F,-.95,o.deck+.004,.36,.30,.20,6);
  head(1.42,.70,.44,.12);tierBar(-.30,o.deck+.012,.50);
  anchor={hood:[.84,o.deck+.004],side:[.80,.52,zo+.152]};coreAt=[-1.12,[-.24,0,.24]];
 }
 T.ring(F,o,ringR);
 T.cores(F,gems,coreAt[0],Math.min(o.deck+.05,o.ring-.11),coreAt[1]);
 const lunarMeta=lunar?famLunar(T,F,cls,Object.assign({ring:[o.ring-.052,ringR]},anchor),vp,hull):undefined;
 return {k:null,anims:[],meta:{ty:o.ring,bob:0,halos,trail:[],tc:F.edge,profile:key,legend:lunar?'lunar-black-gold':undefined,lunar:lunarMeta,track:[(run.len-o.h)/2,o.h/2+.005,o.h/2+.03,run.c]}};
}
// Foundation sink: the same designs in the classic lit/shine/glow buckets (no textures needed).
function famFoundation(cls,tier,P,team,gems,lunar){
 const k=kit(),bucket={energy:'glow',lunar:'glow',rubber:'lit',paint:'shine',steel:'shine',gold:'shine'};
 const r=famChassis(cls,tier,P,team,gems,lunar,{high:false,put:(g,m,c,p,rot,s)=>put(k,g,c,p,rot,s,bucket[m]||'lit'),mark:()=>{}});
 r.k=k;r.meta.visual=VISUAL_VERSION;return r;
}
function standardChassis(cls,tier,P,team,gems,lunar=false){
 const o=CHASSIS_VISUALS[cls][tier];
 if(o.shape!=='defender')return famFoundation(cls,tier,P,team,gems,lunar);
 const k=kit(),A=[],C=palette(P,team,cls,lunar),M={ty:o.ring,halos:[],trail:[],tc:defenderFinish(C).amber,bob:0,visual:VISUAL_VERSION};
 defenderChassis(k,C,gems,M,PM(C));return {k,anims:A,meta:M};
}
function turretHousing(k,F,C,o,tier,arch){
 const w=o.width,back=arch==='siege'?-.66:-.56;
 const p=[[back,-w],[.14,-w],[.49,-w*.65],[.58,0],[.49,w*.65],[.14,w],[back,w]];
 put(k,defenderCylinder(.43,.06,24),F.recess,[0,.03,0]);put(k,loft(p,sc(p,.84,.80,-.025),.06,.29),F.tur,null,null,null,'shine');
 armorPart(k,sc(p,.70,.65,-.08),.285,.055,F.plate);
 sym(s=>{
  armorPart(k,[[back+.06,s*w*.75],[.05,s*w*.73],[.38,s*w*.40],[.17,s*(w+.08)],[back+.06,s*(w+.04)]],.16,.09,F.body,.015);
  put(k,B(.29,.018,.022),F.amber,[-.24,.25,s*(w+.055)],null,null,'shine');
  if(tier)ventBank(k,F,-.29,.35,s*(w-.05),4+tier);
  put(k,B(.12,.018,.024),C.team,[.02,.35,s*w*.60],null,null,'glow');
 });
 sensorBlock(k,F,-.06,.38,-.16,C.team);
}
function barrelUnit(k,F,o,x0,z,r,style){
 const x1=o.tip,y=o.y,len=x1-x0;
 put(k,defenderCylinder(r,len,16),F.steel,[(x0+x1)/2,y,z],[0,0,Math.PI/2],null,'shine');
 // Segmented jacket, collars and recessed cooling slots; muzzle bore is dark geometry.
 const n=style==='heavy'?2:3;
 for(let i=0;i<n;i++){
  const x=x0+.13+(len-.35)*i/Math.max(1,n-1);
  put(k,defenderCylinder(r*1.35,.15,12),F.body,[x,y,z],[0,0,Math.PI/2],null,'shine');
  put(k,TO(r*1.36,.010,4,12),F.amber,[x-.067,y,z],[0,Math.PI/2,0],null,'shine');
  sym(s=>put(k,B(.08,r*.28,.015),F.recess,[x,y,z+s*r*1.34]));
 }
 put(k,defenderCylinder(r*1.57,.18,style==='heavy'?8:12),F.plate,[x1-.10,y,z],[0,0,Math.PI/2],null,'shine');
 put(k,defenderCylinder(r*.98,.014,16),F.edge,[x1-.003,y,z],[0,0,Math.PI/2],null,'shine');
 put(k,defenderCylinder(r*.77,.018,16),F.recess,[x1+.003,y,z],[0,0,Math.PI/2]);
}
function standardWeapon(arch,tier,P,team,lunar=false){
 const o=WEAPON_VISUALS[arch][tier],C=palette(P,team,'vanguard',lunar),F=defenderFinish(C),k=kit(),A=[],M={tips:[],halos:[],visual:VISUAL_VERSION};
 if(C.overlay)F.plate=hexMul(C.hull2,1.02);   // turret plates keep the paint under Lunar
 if(arch==='pulse'&&tier===0){defenderPulseTurret(k,C,M,PM(C));return {k,anims:A,meta:M};}
 turretHousing(k,F,C,o,tier,arch);
 if(C.lunar)sym(s=>put(k,B(.28,.012,.016),LUNAR.energy,[.16,.30,s*o.width*.40],null,null,'glow'));   // Lunar blue channels on the roof
 if(arch==='pulse'){
  barrelUnit(k,F,o,.53,0,o.bore,'energy');
  for(let i=0;i<(tier===2?5:3);i++){const x=.64+i*.24;put(k,TO(o.bore*1.55,.020,4,16),i%2?F.steel:F.ice,[x,o.y,0],[0,Math.PI/2,0],null,i%2?'shine':'glow');}
  if(tier===2){sym(s=>put(k,B(1.2,.07,.08),F.plate,[1.15,o.y,s*.20],null,null,'shine'));const a=kit();put(a,TO(.18,.018,4,16,Math.PI*1.5),F.amber,[0,0,0],[0,Math.PI/2,0],null,'shine');A.push({k:a,p:[.72,o.y,0],axis:'x',spd:3});}
  else sym(s=>put(k,defenderCylinder(.13,.32,12),F.body,[-.30,.21,s*.52],[Math.PI/2,0,0],null,'shine'));
  M.tips.push([o.tip+.012,o.y,0]);
 }else if(arch==='twin'){
  const z=tier===2?.25:.21;
  sym(s=>{
   barrelUnit(k,F,o,.48,s*z,o.bore,'repeater');
   put(k,B(.44,.17,.17),F.plate,[-.12,.20,s*(tier?.54:.46)],null,null,'shine');
   if(tier){put(k,defenderCylinder(.16,.15,16),F.body,[-.25,.23,s*.59],[Math.PI/2,0,0],null,'shine');put(k,defenderCylinder(.085,.17,12),F.edge,[-.25,.23,s*.61],[Math.PI/2,0,0],null,'shine');}
   if(tier===2){put(k,B(.30,.18,.25),F.plate,[-.43,.36,s*.49],null,null,'shine');const r=kit();for(const d of [-1,1])put(r,B(.6,.035,.035),F.steel,[.1,d*.10,0],null,null,'shine');put(r,TO(.115,.018,4,12),F.amber,[.36,0,0],[0,Math.PI/2,0],null,'shine');A.push({k:r,p:[1.10,o.y,s*z],axis:'x',spd:8*s});}
   else for(let i=0;i<3;i++)put(k,B(.05,.055,.028),F.amber,[-.31+i*.10,.30,s*.47],null,null,'shine');
   M.tips.push([o.tip+.012,o.y,s*z]);
  });
  put(k,B(.45,.06,.17),F.recess,[.46,.10,0]);
 }else{
  if(tier===2)sym(s=>barrelUnit(k,F,o,.50,s*.235,o.bore,'heavy'));else barrelUnit(k,F,o,.50,0,o.bore,'heavy');
  // Broad trunnion and recoil cylinders give artillery a fundamentally different profile.
  put(k,B(.48,.29,.54),F.body,[.38,.23,0]);
  sym(s=>{put(k,defenderCylinder(.06,.76,12),F.steel,[.79,.39,s*.30],[0,0,Math.PI/2],null,'shine');put(k,defenderCylinder(.09,.31,12),F.body,[.50,.39,s*.30],[0,0,Math.PI/2],null,'shine');
   if(tier)armorPart(k,[[.38,s*.22],[1.30,s*.21],[1.48,s*.32],[.50,s*.40]],.08,.10,F.plate);
   if(tier===2){put(k,B(.27,.24,.075),F.plate,[o.tip-.13,o.y,s*.29],[0,s*.18,0],null,'shine');put(k,B(.13,.08,.018),F.recess,[o.tip-.12,o.y,s*.333]);}
  });
  if(tier===2){armorPart(k,[[-.72,-.26],[-.37,-.26],[-.37,.26],[-.72,.26]],.20,.22,F.plate);sym(s=>ventBank(k,F,-.57,.45,s*.24,6));}
  if(tier===2)sym(s=>M.tips.push([o.tip+.012,o.y,s*.235]));else M.tips.push([o.tip+.012,o.y,0]);
 }
 for(const p of M.tips)M.halos.push([...p,F.ice,arch==='siege'?.20:.13]);
 return {k,anims:A,meta:M};
}
// Public factories: one final legendary identity, shared by every renderer.
// Moonbeam presentation size per chassis class (visual only; kits stay class-less and unscaled in cache).
// Renderers apply it once, on a weapon child group: tips/halos/anim pivots stay in the kit's own space.
const MOON_SCALE=Object.freeze({titan:.80,vanguard:.76,scout:.72});
const weaponScale=(arch,cls)=>arch==='moon'?MOON_SCALE[cls]||MOON_SCALE.vanguard:1;
function chassisKit(cls,tier,P,team,gems,lunar){if(typeof Equipment3D!=='undefined'&&Equipment3D.canChassis(cls,tier))return Equipment3D.chassisKit(cls,tier,P,team,gems,lunar);return CHASSIS_VISUALS[cls]?(lunar?lunarChassis(cls,visualTier(tier),P,team,gems):standardChassis(cls,visualTier(tier),P,team,gems)):legacyChassisKit(cls,tier,P,team,gems,false);}
function weaponKit(arch,tier,P,team,lunar,cls){if(typeof Equipment3D!=='undefined'&&Equipment3D.canWeapon(arch,tier))return Equipment3D.weaponKit(arch,tier,P,team,lunar,cls);return arch==='moon'?unifiedMoonbeam(team):WEAPON_VISUALS[arch]?standardWeapon(arch,visualTier(tier),P,team,lunar):legacyWeaponKit(arch,tier,P,team,false,cls);}

// Final approved Lunar Skin: class/tier-specific tracked architecture, never a new item.
// Palette ignores paint only while this existing skin is equipped; selected paint data is untouched.
function insetCrescent(R,depth){
 const r=R*.85,d=R*.38,x=(R*R-r*r+d*d)/(2*d),y=Math.sqrt(R*R-x*x),a=Math.atan2(y,x),b=Math.atan2(y,x-d),s=new THREE.Shape();
 s.absarc(0,0,R,a,Math.PI*2-a,false);s.absarc(d,0,r,-b,b-Math.PI*2,true);s.closePath();
 return extr(s,depth);
}
function lunarChassis(cls,tier,P,team,gems){
 if(CHASSIS_VISUALS[cls][tier].shape!=='defender')return famFoundation(cls,tier,P,team,gems,true);
 const raw=standardChassis(cls,tier,P,team,gems,true),k=raw.k,o=CHASSIS_VISUALS[cls][tier],F=defenderFinish(palette(P,team,cls,true));
 const z=o.trackZ+o.trackW/2+.085;
 sym(side=>{
  // Inset heraldic side shields above the exposed wheel line; not floating fins.
  const p=new THREE.Shape();[[-.68,0],[-.15,.01],[-.09,.29],[-.57,.33]].forEach((v,i)=>i?p.lineTo(...v):p.moveTo(...v));p.closePath();
  put(k,extr(p,.032),F.edge,[0,o.h-.11,side*z],null,null,'shine');
  const inner=new THREE.Shape();[[-.65,.022],[-.18,.029],[-.126,.27],[-.55,.306]].forEach((v,i)=>i?inner.lineTo(...v):inner.moveTo(...v));inner.closePath();
  put(k,extr(inner,.035),F.body,[0,o.h-.11,side*z],null,null,'shine');
  put(k,insetCrescent(cls==='scout'?.115:.135,.012),F.edge,[-.38,o.h+.057,side*(z+.032)],null,null,'shine');
  // Lunar energy conduit across the shield (static glow in this fallback renderer).
  put(k,B(.36,.016,.008),LUNAR.energy,[-.43,o.h-.035,side*(z+.036)],null,null,'glow');
  // Narrow gold inlay, fasteners, deck seams and functional tier-coded hardware.
  for(const x of [-.83,.50]){
   armorPart(k,[[x,side*(o.trackZ-.12)],[x+.28,side*(o.trackZ-.10)],[x+.34,side*(o.trackZ+.11)],[x+.02,side*(o.trackZ+.12)]],o.h+.18,.025,F.plate,.009);
   put(k,B(.24,.011,.016),F.edge,[x+.15,o.h+.218,side*(o.trackZ+.08)],null,null,'shine');
   for(const d of [0,.24])put(k,defenderCylinder(.014,.013,6),F.edge,[x+d,o.h+.222,side*o.trackZ],null,null,'shine');
  }
  put(k,B(.19,.013,.030),team||'#4d9fff',[.42,o.h+.23,side*(o.trackZ-.08)],null,null,'glow');
  // Articulated side joints retain dark exposed suspension and restrained gold bushings.
  for(const x of [-.72,.70])put(k,defenderCylinder(.035,.018,8),F.edge,[x,o.h*.55,side*(z-.025)],[Math.PI/2,0,0],null,'shine');
 });
 // Layered wedge visor protects the nose while leaving the original turret socket clear.
 const h=cls==='scout'?.33:cls==='titan'?.48:.40,tip=o.len/2-.08;
 sym(side=>{
  const p=[[.48,side*.035],[tip,side*.04],[tip+.03,side*.17],[tip-.18,side*h],[.49,side*(h-.05)]];
  put(k,loft(p,sc(p,.94,.94,-.015),o.deck-.12,o.deck+.004),F.plate,null,null,null,'shine');
  put(k,B(.32,.009,.015),F.edge,[tip-.25,o.deck+.012,side*(h-.12)],[0,side*.23,0],null,'shine');
 });
 // Hood crest is mounted flush to the inclined prow, ahead of the rotating turret.
 const emblem=insetCrescent(cls==='scout'?.12:.19,.012);emblem.rotateX(-Math.PI/2);
 put(k,emblem,F.edge,[cls==='scout'?.65:.81,o.deck+.018,0],null,null,'shine');
 raw.meta.legend='lunar-black-gold';raw.meta.tc=F.edge;raw.meta.lunar={wisps:[-1,1].map(s=>[-.62,o.h-.035,s*(z+.04)])};return raw;
}
// Annular machined barrel sleeve, through-bore visible from both ends (+X axis).
function energySleeve(k,x,y,R,inner,depth,col,mat='shine'){
 const s=new THREE.Shape(),h=new THREE.Shape();s.absarc(0,0,R,0,Math.PI*2,false);h.absarc(0,0,inner,0,Math.PI*2,true);s.holes.push(h);
 const g=extr(s,depth);g.rotateY(Math.PI/2);put(k,g,col,[x,y,0],null,null,mat);
}
function unifiedMoonbeam(team){
 const k=kit(),A=[],Y=.63,S='#cbd5df',W='#e7eef4',G='#c39a51',D='#1b2430',M='#586879',B0='#167cec',B1='#66cfff',WH='#e5faff';
 const ring=(x,r,t,c,mat='shine')=>put(k,TO(r,t,6,24),c,[x,Y,0],[0,Math.PI/2,0],null,mat);
 // A restrained dark rotary mount and cradle, not the reference's display pedestal.
 put(k,defenderCylinder(.43,.07,24),D,[0,.035,0]);put(k,defenderCylinder(.35,.025,24),G,[0,.082,0],null,null,'shine');
 armorPart(k,[[-.56,-.31],[.29,-.31],[.46,0],[.29,.31],[-.56,.31]],.10,.13,D);
 sym(s=>{
  armorPart(k,[[-.48,s*.22],[.28,s*.24],[.46,s*.40],[-.52,s*.40]],.21,.12,M,.014);
  put(k,B(.56,.055,.065),G,[-.04,.32,s*.33],[0,0,.22],null,'shine');
  put(k,defenderCylinder(.14,.07,20),G,[-.20,.48,s*.34],[Math.PI/2,0,0],null,'shine');
  put(k,defenderCylinder(.09,.076,16),D,[-.20,.48,s*.35],[Math.PI/2,0,0]);
  put(k,B(.12,.025,.025),team||'#4d9fff',[-.20,.25,s*.405],null,null,'glow');
 });
 // Exposed continuous longitudinal blue core runs from the breech to the forward aperture.
 put(k,defenderCylinder(.092,3.01,24),B0,[.80,Y,0],[0,0,Math.PI/2],null,'glow');
 put(k,defenderCylinder(.040,3.03,16),B1,[.80,Y+.05,.055],[0,0,Math.PI/2],null,'glow');
 for(let i=0;i<20;i++){const x=-.66+i*.15,a=i*1.8;put(k,B(.16,.016,.016),i%3?B1:WH,[x,Y+Math.sin(a)*.078,Math.cos(a)*.078],[0,Math.cos(a)*.32,Math.sin(a)*.32],null,'glow');}
 // Silver layered breech with windows, gold pipes and dark mechanical service hardware.
 for(const x of [-.64,-.24,.16]){
  energySleeve(k,x,Y,.25,.16,.16,x===-.24?M:S);ring(x-.08,.252,.014,G);
  sym(s=>{
   put(k,B(.28,.09,.055),W,[x,Y+.21,s*.14],[s*.30,0,0],null,'shine');
   put(k,B(.27,.07,.05),S,[x,Y-.19,s*.14],[-s*.30,0,0],null,'shine');
   put(k,defenderCylinder(.026,.34,8),G,[x,Y+.12,s*.29],[0,0,Math.PI/2],null,'shine');
  });
 }
 // Beveled silver armor leaves, stepped along the rear housing; small dark reveals stay visible.
 for(const x of [-.61,-.25,.11])sym(s=>{
  armorPart(k,[[x-.15,s*.10],[x+.12,s*.10],[x+.16,s*.26],[x-.12,s*.29]],Y+.19,.045,W,.010);
  put(k,B(.19,.012,.018),D,[x,Y+.247,s*.20],null,null,'shine');
 });
 energySleeve(k,-.77,Y,.267,.125,.055,M);ring(-.805,.25,.015,G);
 // The barrel is open-sided: four narrow machined rails, electrically charged annular coils.
 for(const a of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]){
  const y=Y+Math.sin(a)*.21,z=Math.cos(a)*.21;
  put(k,B(2.45,.048,.048),S,[1.02,y,z],[a,0,0],null,'shine');
  put(k,B(2.22,.017,.017),G,[1.02,y+Math.sin(a)*.03,z+Math.cos(a)*.03],null,null,'shine');
 }
 for(const x of [.42,1.02,1.64]){
  energySleeve(k,x,Y,.275,.16,.105,S);ring(x+.065,.237,.025,B0,'glow');ring(x-.067,.27,.020,G);ring(x+.095,.267,.012,WH,'glow');
  for(let i=0;i<8;i++){const a=i*Math.PI/4;put(k,defenderCylinder(.018,.025,6),G,[x+.065,Y+Math.sin(a)*.285,Math.cos(a)*.285],[0,0,Math.PI/2],null,'shine');}
 }
 // Crescents are bolted to paired support cheeks, following the approved unified reference.
 for(const x of [-.18,.95,2.03])sym(s=>{
  put(k,B(.13,.055,.24),D,[x,Y-.25,s*.22],null,null,'shine');
  put(k,insetCrescent(x===2.03?.39:.32,.035),G,[x,Y,s*.26],null,null,'shine');
  put(k,defenderCylinder(.032,.05,8),W,[x-.16,Y,s*.285],[Math.PI/2,0,0],null,'shine');
 });
 // High-detail oversized emitter: silver focusing rings, gold rim, dark aperture and blue-white core.
 energySleeve(k,2.20,Y,.33,.21,.18,S);ring(2.12,.325,.024,G);ring(2.30,.30,.025,G);ring(2.325,.25,.020,B1,'glow');
 put(k,defenderCylinder(.208,.014,32),B0,[2.318,Y,0],[0,0,Math.PI/2],null,'glow');
 put(k,defenderCylinder(.158,.016,28),B1,[2.329,Y,0],[0,0,Math.PI/2],null,'glow');
 put(k,defenderCylinder(.103,.018,24),WH,[2.340,Y,0],[0,0,Math.PI/2],null,'glow');
 for(let i=0;i<8;i++){const a=i*Math.PI/4;put(k,B(.18,.045,.055),i%2?M:S,[2.22,Y+Math.sin(a)*.345,Math.cos(a)*.345],[a,0,0],null,'shine');}
 // Only captive collars rotate. No floating moon, remote ornaments or perpetual firing beam.
 for(const x of [.43,1.65]){const r=kit();put(r,TO(.291,.011,4,24,Math.PI*1.75),G,[0,0,0],[0,Math.PI/2,0],null,'shine');for(let i=0;i<3;i++){const a=i*Math.PI*2/3;put(r,B(.018,.028,.028),B1,[0,Math.sin(a)*.29,Math.cos(a)*.29],null,null,'glow');}A.push({k:r,p:[x,Y,0],axis:'x',spd:x<1?.65:-.65});}
 return {k,anims:A,meta:{legend:'moonbeam-unified',tips:[[2.35,Y,0]],halos:[[2.35,Y,0,B1,.22],[1.1,Y,0,B0,.11]]}};
}

// ---------- chassis ----------
// returns {k, anims:[{k,p,axis,spd,type}], meta:{ty, halos:[[x,y,z,col,size]], trail:[[x,y,z]], tc, bob}}
const SCB=[[-0.95,-0.42],[0.75,-0.42],[1.05,-0.15],[1.05,0.15],[0.75,0.42],[-0.95,0.42]],SCT=[[-0.85,-0.3],[0.52,-0.3],[0.8,-0.1],[0.8,0.1],[0.52,0.3],[-0.85,0.3]];
const VAB=[[-1.05,-0.5],[0.9,-0.5],[1.12,-0.25],[1.12,0.25],[0.9,0.5],[-1.05,0.5]],VAT=[[-0.98,-0.42],[0.62,-0.42],[0.88,-0.2],[0.88,0.2],[0.62,0.42],[-0.98,0.42]];
const TIB=[[-1.1,-0.6],[0.95,-0.6],[1.15,-0.36],[1.15,0.36],[0.95,0.6],[-1.1,0.6]],TIT=[[-1.0,-0.5],[0.7,-0.5],[0.95,-0.28],[0.95,0.28],[0.7,0.5],[-1.0,0.5]];
function tracks(k,C,len,h,th,z,y,wheels,hub){
 sym(s=>{put(k,trackGeo(len,h,th),C.track,[0,y,s*z]);
  put(k,B(len-h*0.9,0.05,0.02),C.team,[0,y+h*0.1,s*(z+th/2+0.006)],null,null,'glow');   // team stripe
  for(let i=0;i<wheels;i++){const x=-len/2+h/2+i*(len-h)/(wheels-1);
   put(k,CY(h*0.3,h*0.3,0.03,8),C.metal,[x,y,s*(z+th/2+0.01)],[Math.PI/2,0,0]);
   if(hub)put(k,CY(h*0.12,h*0.12,0.035,6),hub,[x,y,s*(z+th/2+0.02)],[Math.PI/2,0,0],null,'glow');}});
}
function cores(k,C,gems,x,y,zs){   // three core sockets on the rear deck, lit by the cores you've fitted
 zs.forEach((z,i)=>{put(k,CY(0.1,0.12,0.05,8),'#0b1016',[x,y,z]);const gk=gems&&gems[i];
  if(gk&&GEM[gk])put(k,OC(0.085),GEM[gk].c,[x,y+0.08,z],null,[1,1.3,1],'glow');});
}
function legacyChassisKit(cls,tier,P,team,gems,lunar){
 const k=kit(),A=[],C=palette(P,team,cls,lunar),rc=TIERC[tier],M={ty:0.55,halos:[],trail:[],tc:C.acc,bob:0},pm=PM(C);
 if(cls==='scout'){
  if(tier<2){
   put(k,loft(SCB,SCT,0.2,0.5),C.hull,null,null,null,pm);
   put(k,loft(sc(SCT,0.62,0.7,-0.18),sc(SCT,0.5,0.55,-0.22),0.5,0.56),C.hull2,null,null,null,pm);
   tracks(k,C,1.9,0.34,0.24,0.62,0.2,4,tier?C.acc:null);
   put(k,B(0.22,0.16,0.5),C.dark,[-0.95,0.42,0]);
   sym(s=>put(k,B(0.06,0.08,0.12),tier?C.acc:C.light,[1.03,0.36,s*0.2],null,null,tier?'glow':'lit'));
   cores(k,C,gems,-0.62,0.56,[-0.2,0,0.2]);
   M.ty=0.56;
   if(tier===1){
    sym(s=>{put(k,B(1.5,0.24,0.05),C.hull,[-0.05,0.36,s*0.77],[s*0.28,0,0],null,pm);
     put(k,B(1.45,0.03,0.03),rc,[-0.05,0.49,s*0.8]);
     put(k,B(0.05,0.2,0.05),C.dark,[-0.9,0.62,s*0.24]);
     put(k,B(1.0,0.03,0.02),C.acc,[0.15,0.42,s*0.39],null,null,'glow');});
    put(k,B(0.24,0.04,0.78),C.trim,[-0.95,0.73,0]);
    put(k,CY(0.012,0.012,0.6,4),C.metal,[-0.55,0.85,-0.26]);put(k,SP(0.035,6,4),C.acc,[-0.55,1.16,-0.26],null,null,'glow');
    M.halos.push([1.05,0.36,0.2,C.acc,0.35],[1.05,0.36,-0.2,C.acc,0.35]);
   }
  }else{   // PHANTOM: hover pods, swept wings, turbines
   const body=[[-1.0,-0.34],[0.55,-0.32],[1.3,0],[0.55,0.32],[-1.0,0.34]];
   put(k,loft(body,sc(body,0.82,0.62,-0.05),0.3,0.62),C.hull,null,null,null,pm);
   put(k,OC(0.22),'#0c1a24',[0.42,0.64,0],null,[1.7,0.55,0.9],'shine');
   for(const px of [0.7,-0.75])sym(s=>{
    put(k,CY(0.14,0.14,0.6,8),C.hull2,[px,0.3,s*0.62],[0,0,Math.PI/2],null,pm);
    put(k,CO(0.14,0.22,8),C.hull2,[px+0.41,0.3,s*0.62],[0,0,-Math.PI/2],null,pm);
    put(k,CY(0.16,0.16,0.02,10),C.acc,[px,0.15,s*0.62],null,null,'glow');
    put(k,B(0.5,0.025,0.025),rc,[px,0.43,s*0.62]);
    M.halos.push([px,0.12,s*0.62,C.acc,0.7]);});
   sym(s=>{const wing=[[0.45,0],[-0.6,0],[-0.85,0.5],[-0.2,0.5]].map(p=>[p[0],s*(0.28+p[1])]);
    put(k,loft(wing,wing,0.38,0.44),C.hull,null,null,null,pm);
    put(k,B(0.68,0.03,0.03),C.acc,[-0.52,0.45,s*0.78],null,null,'glow');
    put(k,B(0.38,0.34,0.04),C.trim,[-0.82,0.74,s*0.2],[s*0.35,0,0]);
    put(k,CY(0.08,0.11,0.14,8),C.dark,[-1.04,0.46,s*0.16],[0,0,Math.PI/2]);
    put(k,CY(0.07,0.07,0.02,8),C.acc,[-1.12,0.46,s*0.16],[0,0,Math.PI/2],null,'glow');
    put(k,B(1.2,0.02,0.02),rc,[0.05,0.63,s*0.2],null,null,'glow');
    M.trail.push([-1.15,0.46,s*0.16]);M.halos.push([-1.14,0.46,s*0.16,C.acc,0.45]);
    const tb=kit();put(tb,TO(0.12,0.02,4,10),C.metal,[0,0,0],[0,Math.PI/2,0]);
    for(let i=0;i<3;i++)put(tb,B(0.02,0.2,0.05),C.light,[0,0,0],[i*Math.PI/3,0,0]);
    A.push({k:tb,p:[-1.08,0.3,s*0.62],axis:'x',spd:28});});
   cores(k,C,gems,-0.6,0.62,[-0.14,0,0.14]);
   M.ty=0.62;M.bob=0.05;
  }
 }else if(cls==='titan'){
  if(tier<2){
   put(k,loft(TIB,TIT,0.24,0.64),C.hull,null,null,null,pm);
   put(k,loft(sc(TIT,0.7,0.7,-0.15),sc(TIT,0.6,0.6,-0.18),0.64,0.7),C.hull2,null,null,null,pm);
   tracks(k,C,2.3,0.52,0.36,0.8,0.27,6,tier?C.acc:null);
   put(k,B(0.36,0.3,0.84),C.dark,[-1.02,0.52,0]);
   for(let i=0;i<4;i++)put(k,B(0.38,0.03,0.05),C.metal,[-1.02,0.68,-0.3+i*0.2]);
   put(k,CY(0.06,0.06,1.0,6),C.dark,[1.2,0.32,0],[Math.PI/2,0,0]);
   cores(k,C,gems,-0.7,0.7,[-0.3,0,0.3]);
   M.ty=0.7;
   if(tier===1){
    const pb=[[1.0,-0.78],[1.38,-0.62],[1.38,0.62],[1.0,0.78]],pt=[[1.0,-0.72],[1.16,-0.56],[1.16,0.56],[1.0,0.72]];
    put(k,loft(pb,pt,0.1,0.52),C.hull2,null,null,null,pm);
    put(k,B(0.04,0.04,1.1),rc,[1.27,0.33,0]);
    sym(s=>{put(k,B(1.9,0.36,0.08),C.hull,[0,0.5,s*1.0],null,null,pm);
     for(let i=0;i<3;i++)put(k,B(0.18,0.045,0.02),C.acc,[-0.5+i*0.45,0.52,s*1.045],null,null,'glow');
     for(let i=0;i<5;i++)put(k,SP(0.025,4,3),C.light,[-0.8+i*0.4,0.64,s*1.04]);
     put(k,B(1.9,0.03,0.03),rc,[0,0.69,s*1.0]);
     put(k,CY(0.08,0.08,0.34,8),C.dark,[-0.95,0.84,s*0.32]);});
    M.halos.push([0,0.52,1.06,C.acc,0.5],[0,0.52,-1.06,C.acc,0.5]);
   }
  }else{   // COLOSSUS: four track pods, battlement crown, spinning reactor
   const hb=[[-1.1,-0.62],[0.9,-0.66],[1.25,-0.32],[1.25,0.32],[0.9,0.66],[-1.1,0.62]];
   put(k,loft(hb,sc(hb,0.86,0.78,-0.08),0.3,0.76),C.hull,null,null,null,pm);
   for(const px of [0.66,-0.66])sym(s=>{put(k,trackGeo(1.05,0.54,0.36),C.track,[px,0.27,s*0.86],[0,s*px*0.08,0]);
    put(k,B(0.9,0.05,0.02),C.team,[px,0.33,s*1.05],null,null,'glow');
    put(k,loft([[px-0.5,s*0.68],[px+0.5,s*0.68],[px+0.5,s*1.06],[px-0.5,s*1.06]],[[px-0.42,s*0.72],[px+0.42,s*0.72],[px+0.42,s*0.98],[px-0.42,s*0.98]],0.52,0.64),C.hull2,null,null,null,pm);
    put(k,CY(0.09,0.09,0.04,8),C.acc,[px,0.27,s*1.06],[Math.PI/2,0,0],null,'glow');});
   for(let i=0;i<8;i++){const a=i/8*Math.PI*2;put(k,B(0.14,0.16,0.14),C.hull2,[Math.cos(a)*0.58,0.84,Math.sin(a)*0.58],[0,-a,0],null,pm);}
   put(k,TO(0.58,0.03,4,24),rc,[0,0.77,0],[Math.PI/2,0,0],null,'glow');
   sym(s=>put(k,loft([[1.0,s*0.3],[1.38,s*0.2],[1.38,s*0.62],[1.0,s*0.7]],[[1.0,s*0.34],[1.2,s*0.3],[1.2,s*0.56],[1.0,s*0.62]],0.12,0.58),C.hull2,null,null,null,pm));
   put(k,CY(0.22,0.24,0.42,10),C.dark,[-0.82,0.98,0]);
   put(k,CY(0.15,0.15,0.44,10),C.acc,[-0.82,0.98,0],null,null,'glow');
   const rr=kit();put(rr,TO(0.33,0.028,4,16,Math.PI*1.5),C.acc,[0,0,0],[Math.PI/2,0,0],null,'glow');put(rr,TO(0.4,0.02,4,16,Math.PI),rc,[0,0,0],[Math.PI/2,0,0]);
   A.push({k:rr,p:[-0.82,0.98,0],axis:'y',spd:2.4});
   cores(k,C,gems,-0.35,0.78,[-0.3,0,0.3]);
   M.halos.push([-0.82,1.1,0,C.acc,1.0]);
   sym(s=>M.trail.push([-1.15,0.4,s*0.86]));
   M.ty=0.84;
  }
 }else{   // vanguard
  if(tier===0&&!lunar){
   defenderChassis(k,C,gems,M,pm);
  }else if(tier<2){
   put(k,loft(VAB,VAT,0.2,0.55),C.hull,null,null,null,pm);
   put(k,loft(sc(VAT,0.66,0.72,-0.16),sc(VAT,0.56,0.6,-0.2),0.55,0.6),C.hull2,null,null,null,pm);
   tracks(k,C,2.2,0.42,0.3,0.7,0.23,5,tier?C.acc:null);
   put(k,B(0.3,0.06,0.62),C.dark,[-0.86,0.57,0]);
   for(let i=0;i<4;i++)put(k,B(0.32,0.02,0.04),C.metal,[-0.86,0.61,-0.24+i*0.16]);
   sym(s=>put(k,B(0.06,0.08,0.12),tier?C.acc:C.light,[1.0,0.42,s*0.3],null,null,tier?'glow':'lit'));
   cores(k,C,gems,-0.55,0.6,[-0.26,0,0.26]);
   M.ty=0.6;
   if(tier===1){
    sym(s=>{put(k,B(1.75,0.3,0.05),C.hull,[0,0.44,s*0.88],null,null,pm);
     for(let i=0;i<4;i++)put(k,SP(0.022,4,3),C.light,[-0.6+i*0.4,0.52,s*0.91]);
     put(k,B(1.75,0.03,0.03),rc,[0,0.6,s*0.88]);
     put(k,CY(0.065,0.065,0.3,8),C.dark,[-0.98,0.72,s*0.3]);
     for(let i=0;i<3;i++)put(k,CY(0.035,0.035,0.16,6),C.metal,[0.72,0.62,s*(0.3+i*0.06)],[0,0,-0.9]);});
    put(k,B(0.04,0.04,0.62),C.acc,[1.0,0.5,0],null,null,'glow');
    put(k,CY(0.012,0.012,0.7,4),C.metal,[-0.7,0.95,0.32]);put(k,SP(0.035,6,4),C.acc,[-0.7,1.3,0.32],null,null,'glow');
    M.halos.push([1.02,0.5,0,C.acc,0.5]);
   }
  }else{   // PALADIN: knight armor, crest, shield plate, spinning shield emitters
   const hb=[[-1.05,-0.52],[0.88,-0.52],[1.14,-0.22],[1.14,0.22],[0.88,0.52],[-1.05,0.52]];
   put(k,loft(hb,sc(hb,0.88,0.7,-0.1),0.22,0.6),C.hull,null,null,null,pm);
   put(k,loft([[-0.9,-0.09],[0.85,-0.09],[1.0,0],[0.85,0.09],[-0.9,0.09]],[[-0.85,-0.03],[0.7,-0.03],[0.8,0],[0.7,0.03],[-0.85,0.03]],0.6,0.78),C.trim,null,null,null,'shine');
   tracks(k,C,2.2,0.44,0.3,0.72,0.24,5,C.acc);
   sym(s=>{put(k,loft([[-0.95,s*0.48],[0.95,s*0.48],[1.05,s*0.7],[0.95,s*0.96],[-0.95,s*0.96]],[[-0.85,s*0.55],[0.8,s*0.55],[0.88,s*0.7],[0.8,s*0.86],[-0.85,s*0.86]],0.34,0.66),C.hull2,null,null,null,pm);
    put(k,B(1.7,0.025,0.025),rc,[0,0.67,s*0.7],null,null,'glow');
    const em=kit();put(em,TO(0.15,0.03,4,6),C.acc,[0,0,0],[Math.PI/2,0,0],null,'glow');put(em,OC(0.06),C.light,[0,0,0],null,null,'glow');
    A.push({k:em,p:[-0.25,0.82,s*0.71],axis:'y',spd:3*s});M.halos.push([-0.25,0.82,s*0.71,C.acc,0.55]);
    M.trail.push([-1.1,0.4,s*0.7]);});
   put(k,B(0.1,0.4,0.74),C.hull2,[1.12,0.42,0],[0,0,-0.4],null,pm);
   put(k,OC(0.12),C.acc,[1.2,0.45,0],null,[0.6,1.2,1.2],'glow');
   M.halos.push([1.24,0.45,0,C.acc,0.6]);
   cores(k,C,gems,-0.62,0.6,[-0.24,0,0.24]);
   M.ty=0.62;
  }
 }
 return {k,anims:A,meta:M};
}

// ---------- weapons (the turret): origin = turret ring, barrel along +x ----------
function legacyWeaponKit(arch,tier,P,team,lunar,cls){
 const k=kit(),A=[],C=palette(P,team,cls,lunar),rc=TIERC[tier],M={tips:[],halos:[]},pm=PM(C);
 const wc=WEAPONS[arch]?WEAPONS[arch].c:'#3fd0c9';
 const core=(x,y)=>{put(k,OC(0.11),C.team,[x,y,0],null,[1,1.3,1],'glow');M.halos.push([x,y,0,C.team,0.35]);};
 if(arch==='twin'){
  if(tier<2){
   put(k,loft([[-0.42,-0.38],[0.38,-0.38],[0.48,-0.2],[0.48,0.2],[0.38,0.38],[-0.42,0.38]],[[-0.36,-0.3],[0.3,-0.3],[0.38,-0.15],[0.38,0.15],[0.3,0.3],[-0.36,0.3]],0,0.27),C.tur,null,null,null,pm);
   sym(s=>{put(k,CY(0.06,0.06,1.3,8),C.dark,[1.0,0.15,s*0.17],[0,0,Math.PI/2]);
    put(k,CY(0.085,0.085,0.18,8),tier?wc:C.light,[1.62,0.15,s*0.17],[0,0,Math.PI/2],null,tier?'glow':'lit');
    put(k,B(1.0,0.025,0.03),wc,[0.95,0.22,s*0.17]);
    M.tips.push([1.74,0.15,s*0.17]);});
   core(0,0.32);
   if(tier===1){sym(s=>{put(k,CY(0.17,0.17,0.16,10),C.tur2,[-0.05,0.18,s*0.48],[Math.PI/2,0,0],null,pm);
     put(k,CY(0.18,0.18,0.035,10),wc,[-0.05,0.18,s*0.5],[Math.PI/2,0,0],null,'glow');
     for(let i=0;i<4;i++)put(k,B(0.1,0.13,0.13),C.metal,[0.62+i*0.15,0.15,s*0.17]);
     put(k,B(0.7,0.025,0.025),rc,[0,0.28,s*0.3]);
     M.halos.push([1.64,0.15,s*0.17,wc,0.4]);});}
  }else{   // HELIX: two spinning gatling clusters wrapped in a glowing helix
   put(k,loft([[-0.46,-0.36],[0.3,-0.4],[0.5,-0.18],[0.5,0.18],[0.3,0.4],[-0.46,0.36]],[[-0.4,-0.26],[0.22,-0.3],[0.38,-0.12],[0.38,0.12],[0.22,0.3],[-0.4,0.26]],0,0.3),C.tur,null,null,null,pm);
   sym(s=>{put(k,B(0.42,0.26,0.2),C.tur2,[0.02,0.2,s*0.44],null,null,pm);
    put(k,B(0.42,0.03,0.03),rc,[0.02,0.34,s*0.44],null,null,'glow');
    put(k,CY(0.15,0.15,0.12,10),C.dark,[0.48,0.17,s*0.22],[0,0,Math.PI/2]);
    for(let i=0;i<22;i++){const a=i*0.62;put(k,B(0.07,0.035,0.035),wc,[0.5+i*0.04,0.17+Math.cos(a)*0.16,s*0.22+Math.sin(a)*0.16],[a,0,0],null,'glow');}
    const g=kit();for(let i=0;i<3;i++){const a=i/3*Math.PI*2;put(g,CY(0.045,0.045,1.25,6),C.metal,[0.62,Math.cos(a)*0.08,Math.sin(a)*0.08],[0,0,Math.PI/2],null,'shine');}
    put(g,CY(0.12,0.12,0.06,8),C.metal,[0.3,0,0],[0,0,Math.PI/2]);
    put(g,CY(0.13,0.13,0.06,8),C.metal,[1.2,0,0],[0,0,Math.PI/2]);put(g,CY(0.1,0.1,0.04,8),wc,[1.25,0,0],[0,0,Math.PI/2],null,'glow');
    A.push({k:g,p:[0.0,0.17,s*0.22],axis:'x',spd:16*s});
    M.tips.push([1.36,0.17,s*0.22]);M.halos.push([1.28,0.17,s*0.22,wc,0.55]);});
   core(-0.1,0.35);
  }
 }else if(arch==='siege'){
  if(tier<2){
   put(k,CY(0.52,0.58,0.3,8),C.tur,[0,0.15,0],null,null,pm);
   put(k,B(0.26,0.32,0.5),C.tur2,[0.45,0.17,0],null,null,pm);
   core(-0.1,0.36);
   if(tier===0){
    put(k,CY(0.17,0.2,1.25,10),C.dark,[1.05,0.18,0],[0,0,Math.PI/2]);
    put(k,B(0.26,0.26,0.42),C.light,[1.7,0.18,0]);sym(s=>put(k,B(0.2,0.28,0.04),C.dark,[1.7,0.18,s*0.1]));
    put(k,B(0.9,0.03,0.05),wc,[1.0,0.36,0]);
    M.tips.push([1.88,0.18,0]);
   }else{   // RAIL BREAKER
    sym(s=>{put(k,B(1.5,0.1,0.09),C.metal,[1.1,0.18,s*0.16],null,null,'shine');
     put(k,CY(0.05,0.05,0.6,6),C.dark,[0.5,0.38,s*0.14],[0,0,Math.PI/2]);
     put(k,B(0.6,0.025,0.025),rc,[0,0.31,s*0.42]);});
    for(let i=0;i<5;i++)put(k,B(0.08,0.08,0.2),wc,[0.55+i*0.24,0.18,0],null,null,'glow');
    put(k,B(0.6,0.24,0.5),C.tur2,[0.35,0.2,0],null,null,pm);
    M.tips.push([1.9,0.18,0]);M.halos.push([1.2,0.18,0,wc,0.6]);
   }
  }else{   // TITANFALL: double-barrel artillery, magma core, spinning muzzle crowns
   const tb=[[-0.6,-0.5],[0.35,-0.55],[0.62,-0.25],[0.62,0.25],[0.35,0.55],[-0.6,0.5]];
   put(k,loft(tb,sc(tb,0.8,0.75,-0.05),0,0.38),C.tur,null,null,null,pm);
   sym(s=>{put(k,CY(0.15,0.18,1.4,10),C.dark,[1.1,0.22,s*0.2],[0,0,Math.PI/2]);
    put(k,CY(0.04,0.04,0.55,6),C.metal,[0.6,0.4,s*0.22],[0,0,Math.PI/2-0.25]);
    for(let i=0;i<3;i++)put(k,B(0.16,0.035,0.02),'#ff8a3d',[-0.2+i*0.2,0.22,s*0.53],null,null,'glow');
    put(k,B(0.9,0.03,0.03),rc,[0.0,0.39,s*0.3],null,null,'glow');
    const cr=kit();for(let i=0;i<6;i++){const a=i/6*Math.PI*2;put(cr,CO(0.05,0.16,4),C.light,[0.05,Math.cos(a)*0.17,Math.sin(a)*0.17],[0,0,-Math.PI/2]);}
    put(cr,TO(0.17,0.035,4,10),C.metal,[0,0,0],[0,Math.PI/2,0]);
    A.push({k:cr,p:[1.82,0.22,s*0.2],axis:'x',spd:1.6*s});
    M.tips.push([2.0,0.22,s*0.2]);});
   const mg=kit();put(mg,SP(0.16,10,7),'#ff8a3d',[0,0,0],null,null,'glow');put(mg,SP(0.1,8,6),'#ffe08a',[0,0,0],null,null,'glow');
   A.push({k:mg,p:[-0.22,0.48,0],type:'pulse',spd:5});
   for(let i=0;i<4;i++){const a=i/4*Math.PI*2+0.78;put(k,B(0.035,0.32,0.035),C.metal,[-0.22+Math.cos(a)*0.2,0.5,Math.sin(a)*0.2]);}
   M.halos.push([-0.22,0.48,0,'#ff8a3d',1.0]);
  }
 }else{   // pulse
  if(tier===0&&cls==='vanguard'&&!lunar){
   defenderPulseTurret(k,C,M,pm);
  }else if(tier<2){
   if(tier===0)put(k,CY(0.46,0.5,0.26,8),C.tur,[0,0.13,0],null,null,pm);
   else put(k,loft([[-0.45,-0.4],[0.35,-0.42],[0.56,0],[0.35,0.42],[-0.45,0.4]],[[-0.38,-0.3],[0.25,-0.32],[0.42,0],[0.25,0.32],[-0.38,0.3]],0,0.3),C.tur,null,null,null,pm);
   put(k,CY(0.16,0.16,0.06,8),C.tur2,[-0.14,0.3,0.14],null,null,pm);
   put(k,CY(0.085,0.1,1.3,8),C.dark,[0.95,0.16,0],[0,0,Math.PI/2]);
   put(k,CY(0.13,0.13,0.24,8),tier?C.metal:C.light,[1.62,0.16,0],[0,0,Math.PI/2]);
   put(k,B(1.1,0.03,0.05),wc,[0.9,0.25,0]);
   core(0,0.32);
   M.tips.push([1.78,0.16,0]);
   if(tier===1){   // ARC PULSE
    for(let i=0;i<3;i++)put(k,TO(0.15,0.035,4,10),wc,[0.72+i*0.24,0.16,0],[0,Math.PI/2,0],null,'glow');
    put(k,B(0.9,0.08,0.14),C.dark,[0.9,0.05,0]);
    put(k,B(0.2,0.12,0.14),C.tur2,[0.1,0.36,-0.26],null,null,pm);put(k,B(0.02,0.06,0.08),wc,[0.21,0.36,-0.26],null,null,'glow');
    put(k,CY(0.135,0.135,0.03,10),wc,[1.75,0.16,0],[0,0,Math.PI/2],null,'glow');
    sym(s=>put(k,B(0.6,0.025,0.025),rc,[-0.02,0.3,s*0.34]));
    M.halos.push([0.96,0.16,0,wc,0.7]);
   }
  }else{   // NOVA PULSE: a fork holding a floating energy orb, open coils spinning around it
   const tb=[[-0.5,-0.36],[0.3,-0.4],[0.62,0],[0.3,0.4],[-0.5,0.36]];
   put(k,loft(tb,sc(tb,0.78,0.72,-0.04),0,0.32),C.tur,null,null,null,pm);
   sym(s=>{put(k,B(0.3,0.2,0.03),C.trim,[-0.42,0.3,s*0.3],[s*0.3,0,0]);
    put(k,B(1.25,0.07,0.06),C.metal,[1.05,0.18,s*0.17],null,null,'shine');
    put(k,B(0.22,0.06,0.06),C.metal,[1.73,0.18,s*0.12],[0,s*0.5,0],null,'shine');
    put(k,B(1.1,0.022,0.022),wc,[1.0,0.23,s*0.17],null,null,'glow');
    put(k,B(0.6,0.025,0.025),rc,[-0.05,0.33,s*0.3],null,null,'glow');});
   const orb=kit();put(orb,SP(0.12,10,8),'#e9fffd',[0,0,0],null,null,'glow');put(orb,OC(0.17),wc,[0,0,0],null,[1,1,1],'glow');
   A.push({k:orb,p:[1.42,0.18,0],type:'pulse',spd:7});
   const co=kit();put(co,TO(0.2,0.03,4,12,Math.PI*1.3),wc,[0,0,0],[0,Math.PI/2,0],null,'glow');put(co,TO(0.2,0.03,4,12,Math.PI*1.3),wc,[0.24,0,0],[Math.PI,Math.PI/2,0],null,'glow');
   A.push({k:co,p:[0.55,0.18,0],axis:'x',spd:6});
   core(-0.05,0.36);
   M.tips.push([1.62,0.18,0]);M.halos.push([1.42,0.18,0,wc,1.1]);
  }
 }
 return {k,anims:A,meta:M};
}

// ---------- the Megatank (Survival boss) ----------
function bossKit(){
 const k=kit(),A=[],hb=[[-1.2,-0.72],[0.8,-0.78],[1.32,0],[0.8,0.78],[-1.2,0.72]],D='#4a3d63',D2='#2f2740',O='#ff9a55',RD='#ff3b3b';
 put(k,loft(hb,sc(hb,0.84,0.76,-0.06),0.32,0.86),D,null,null,null,'shine');
 for(const px of [0.68,-0.68])sym(s=>{put(k,trackGeo(1.15,0.62,0.42),'#0d0b12',[px,0.32,s*0.96]);
  put(k,B(0.95,0.05,0.02),O,[px,0.4,s*1.18],null,null,'glow');
  put(k,loft([[px-0.55,s*0.74],[px+0.55,s*0.74],[px+0.55,s*1.18],[px-0.55,s*1.18]],[[px-0.45,s*0.8],[px+0.45,s*0.8],[px+0.45,s*1.1],[px-0.45,s*1.1]],0.6,0.74),D2);});
 for(let i=0;i<7;i++)put(k,CO(0.07,0.28,4),'#cfd6e0',[1.42,0.3,-0.6+i*0.2],[0,0,-Math.PI/2]);
 put(k,loft([[1.15,-0.75],[1.38,-0.6],[1.38,0.6],[1.15,0.75]],[[1.15,-0.7],[1.24,-0.55],[1.24,0.55],[1.15,0.7]],0.12,0.5),D2);
 put(k,B(0.06,0.09,0.66),RD,[1.12,0.74,0],null,null,'glow');
 sym(s=>{put(k,B(0.5,0.26,0.26),D2,[-0.25,1.0,s*0.7]);for(let i=0;i<4;i++)put(k,CY(0.04,0.04,0.02,6),RD,[0.01,0.96+(i>>1)*0.1,s*(0.64+(i&1)*0.12)],[0,0,Math.PI/2],null,'glow');
  put(k,B(1.8,0.03,0.03),O,[0,0.87,s*0.6],null,null,'glow');});
 put(k,CY(0.2,0.2,0.3,8),'#3a1410',[-0.75,1.02,0]);put(k,SP(0.16,8,6),'#ff4d2e',[-0.75,1.2,0],null,null,'glow');
 const rr=kit();put(rr,TO(0.34,0.04,4,16,Math.PI*1.4),O,[0,0,0],[Math.PI/2,0,0],null,'glow');A.push({k:rr,p:[-0.75,1.12,0],axis:'y',spd:2});
 const w=kit();
 put(w,CY(0.6,0.7,0.36,6),D,[0,0.18,0],null,null,'shine');
 sym(s=>{put(w,CY(0.2,0.24,1.6,10),'#141018',[1.2,0.25,s*0.24],[0,0,Math.PI/2]);put(w,B(0.3,0.36,0.36),'#cfd6e0',[1.98,0.25,s*0.24]);
  put(w,B(1.2,0.03,0.04),O,[1.1,0.45,s*0.24],null,null,'glow');});
 put(w,B(0.5,0.35,0.06),D2,[-0.55,0.45,0]);put(w,OC(0.12),RD,[0,0.42,0],null,[1,1.3,1],'glow');
 return {hull:{k,anims:A,meta:{ty:0.86,halos:[[-0.75,1.2,0,'#ff4d2e',1.4],[1.14,0.74,0,RD,0.9]],trail:[],tc:O,bob:0}},
  gun:{k:w,anims:[],meta:{tips:[[2.18,0.25,-0.24],[2.18,0.25,0.24]],halos:[]}}};
}

// ---------- crates (shop, crate opening) and cores ----------
function crateKit(tk,ri){
 const k=kit(),A=[],sal=tk==='salvage',rc=sal?'#c48a5c':TIERC[ri],body=sal?'#6a4a36':'#4c5c72',edge=ri===0||sal?'lit':'glow';
 put(k,B(1.6,0.95,1.1),body,[0,0.475,0],null,null,'shine');
 put(k,B(1.66,0.12,1.16),hexMul(body,0.8),[0,0.98,0],null,null,'shine');
 const E=(w,h,d,x,y,z)=>put(k,B(w,h,d),rc,[x,y,z],null,null,edge);
 sym(s=>{E(1.68,0.05,0.05,0,0.03,s*0.57);E(1.68,0.05,0.05,0,1.04,s*0.57);E(0.05,1.0,0.05,s*0.82,0.52,0.57);E(0.05,1.0,0.05,s*0.82,0.52,-0.57);E(0.05,0.05,1.16,s*0.82,0.03,0);E(0.05,0.05,1.16,s*0.82,1.04,0);});
 for(let i=0;i<8;i++)put(k,B(0.14,0.12,0.02),i%2?'#ffcf4a':'#12161d',[-0.56+i*0.16,0.16,0.56],[0,0,0.5]);
 put(k,B(1.62,0.03,0.02),'#3c4858',[0,0.62,0.555]);
 if(ri>=1&&!sal){put(k,B(1.5,0.03,1.0),rc,[0,0.93,0],null,null,'glow');}
 const em=kit();
 if(tk==='gem'){put(em,OC(0.24),rc,[0,0,0],null,[1,1.35,1],'glow');sym(s=>put(em,OC(0.1),'#8fa3b8',[s*0.34,-0.12,0],null,[1,1.3,1],'shine'));}
 else if(tk==='weapon'){sym(s=>{put(em,CY(0.06,0.06,0.9,8),'#0b0f14',[0,0,s*0.13],[0,0,Math.PI/2]);put(em,CY(0.08,0.08,0.14,8),rc,[0.45,0,s*0.13],[0,0,Math.PI/2],null,'glow');});put(em,B(0.3,0.18,0.4),'#202935',[-0.3,0,0]);}
 else{put(em,trackGeo(0.9,0.24,0.18),'#0b0f14',[0,0,0]);for(let i=0;i<3;i++)put(em,CY(0.06,0.06,0.2,8),rc,[-0.25+i*0.25,0,0],[Math.PI/2,0,0],null,'glow');put(em,B(0.6,0.16,0.3),'#232d3a',[0,0.18,0]);}
 A.push({k:em,p:[0,1.32,0],axis:'y',spd:ri===2?1.2:0.6,bobA:0.06});
 return {k,anims:A,meta:{halos:ri>=1&&!sal?[[0,1.35,0,rc,ri===2?2.2:1.4]]:[]}};
}
function gemKit(gk){const k=kit(),c=GEM[gk]?GEM[gk].c:'#8a97ab';put(k,OC(0.62),c,[0,0,0],null,[1,1.35,1],'shine');put(k,OC(0.34),hexMix(c,'#ffffff',0.55),[0,0,0],null,[1,1.35,1],'glow');return {k,anims:[],meta:{halos:[[0,0,0,c,2.4]]}};}

// ---------- maps ----------
const DECK_H=1.0,WALL_H={ctr:1.05,cmd:0.85,pylon:1.0,lander:0.75,cliff:1.8,crate:0.85,canyon:1.45,fin:1.1,bulk:1.35,door:1.45,pillar:2.1,turbine:1.15,lift:0.4,console:0.9};
const h2=(x,y)=>{const v=Math.sin(x*12.9898+y*78.233)*43758.5453;return v-Math.floor(v);};
const CTRC=['#4a5c75','#6d5543','#4e6a5d','#5b5f78'];
function wallKit(k,glow,pulse,anims,wl){
 const [x,y,w,h,st]=wl,cx=x+w/2,cz=y+h/2,H=WALL_H[st]||1;
 if(MapArt.WALLS[st]){MapArt.wall(legacyArt(k,glow),wl,true);return;}
 if(st==='cliff'){   // canyon wall: a rough rock mass, taller along the arena side
  put(k,B(w,H*0.75,h),'#1d222c',[cx,H*0.375,cz]);
  const inner=x<10?x+w:x,dir=x<10?-1:1;
  for(let yy=0.3;yy<h;yy+=0.75){const j=h2(x+yy,yy),hh=H*(0.75+j*0.55),r=0.45+j*0.35;
   put(k,IC(r,0),hexMix('#2b3140','#4a5163',j),[inner+dir*(0.25+j*0.35),hh*0.5,y+yy],[j*3,j*5,j*2],[1.1,hh/r*0.55,1.2]);
   if(j>0.55)put(k,IC(r*0.6,0),'#566074',[inner+dir*(0.9+j*0.6),hh*0.62,y+yy+0.3],[j*7,j,0],[1,1.3,1]);}
  return;}
 if(st==='ctr'){const c=CTRC[Math.floor(h2(x,y)*CTRC.length)],long=w>=h;
  put(k,B(w-0.06,H,h-0.06),c,[cx,H/2,cz]);
  put(k,B(w,0.06,h),hexMul(c,1.2),[cx,H+0.02,cz]);
  for(const sx of [-1,1])for(const sz of [-1,1])put(k,B(0.1,H+0.04,0.1),hexMul(c,0.6),[cx+sx*(w/2-0.05),H/2,cz+sz*(h/2-0.05)]);
  if(long)for(let q=0.45;q<w-0.2;q+=0.45)sym(s=>put(k,B(0.05,H*0.86,0.04),hexMul(c,0.78),[x+q,H/2,cz+s*(h/2-0.01)]));
  else for(let q=0.45;q<h-0.2;q+=0.45)sym(s=>put(k,B(0.04,H*0.86,0.05),hexMul(c,0.78),[cx+s*(w/2-0.01),H/2,y+q]));
  put(k,B(long?0.5:0.3,0.04,long?0.3:0.5),'#d8c49a',[cx,H+0.06,cz]);
  return;}
 if(st==='cmd'){   // command module: base, octagonal deck, hatch, antenna with a red beacon, hazard band
  put(k,B(w,H*0.7,h),'#4c5870',[cx,H*0.35,cz]);
  put(k,CY(Math.min(w,h)*0.36,Math.min(w,h)*0.4,H*0.5,8),'#5d6b86',[cx,H*0.7+H*0.25,cz]);
  put(k,CY(Math.min(w,h)*0.14,Math.min(w,h)*0.14,0.08,10),'#2a3242',[cx,H*1.22,cz]);
  for(let i=0;i<Math.floor(w/0.3);i++)put(k,B(0.16,0.12,0.02),i%2?'#ffcf4a':'#151a22',[x+0.18+i*0.3,0.14,y+h+0.005],[0,0,0.6]);
  put(k,CY(0.025,0.025,1.0,4),'#8a93a6',[x+w-0.4,H*0.7+0.5,y+0.4]);put(glow,SP(0.07,6,4),'#ff4d4d',[x+w-0.4,H*0.7+1.02,y+0.4]);
  sym(s=>{put(k,B(0.9,0.04,0.6),'#1b2a4a',[cx+s*(w/2+0.42),H*0.55,cz],[0,0,s*0.25]);put(glow,B(0.86,0.045,0.02),'#4d9fff',[cx+s*(w/2+0.42),H*0.56,cz],[0,0,s*0.25]);});
  for(let i=0;i<4;i++)put(glow,B(0.12,0.06,0.02),'#ffd48a',[x+0.5+i*(w-1)/3,H*0.5,y+h+0.01]);
  return;}
 if(st==='pylon'){   // energy pylon: base, glowing column, floating rings
  put(k,B(w,0.3,h),'#2d3445',[cx,0.15,cz]);
  put(k,CY(Math.min(w,h)*0.4,Math.min(w,h)*0.48,0.3,8),'#3a4258',[cx,0.45,cz]);
  put(pulse,CY(0.22,0.22,1.6,10),'#3fd0c9',[cx,1.2,cz]);
  for(const [px,pz] of [[x+0.2,y+0.2],[x+w-0.2,y+0.2],[x+0.2,y+h-0.2],[x+w-0.2,y+h-0.2]]){put(k,B(0.14,0.7,0.14),'#4a5468',[px,0.5,pz]);put(glow,SP(0.05,6,4),'#3fd0c9',[px,0.9,pz]);}
  const r=kit();put(r,TO(0.5,0.04,4,18,Math.PI*1.5),'#3fd0c9',[0,0,0],[Math.PI/2,0,0],null,'glow');put(r,TO(0.36,0.03,4,16,Math.PI),'#bff6f2',[0,0.5,0],[Math.PI/2,0,0],null,'glow');
  anims.push({k:r,p:[cx,1.3,cz],axis:'y',spd:1.5});
  return;}
 if(st==='lander'){   // crashed lander: gold foil body, splayed legs, dish
  put(k,CY(0.55,0.62,0.6,8),'#a8873a',[cx,0.6,cz],null,[w/1.24,1,h/1.24]);
  for(let i=0;i<10;i++){const a=h2(x+i,y)*6.28;put(k,B(0.18,0.06,0.18),'#d9b85a',[cx+Math.cos(a)*w*0.3,0.92,cz+Math.sin(a)*h*0.3],[0,a,0.2]);}
  for(const [lx,lz] of [[x-0.1,y-0.1],[x+w+0.1,y-0.1],[x-0.1,y+h+0.1],[x+w+0.1,y+h+0.1]]){
   put(k,CY(0.035,0.035,0.8,5),'#2a2f3a',[(lx+cx)/2,0.35,(lz+cz)/2],[(lz-cz)*0.6,0,(cx-lx)*0.35]);put(k,CY(0.14,0.16,0.05,8),'#3a3f4a',[lx,0.03,lz]);}
  put(k,CY(0.32,0.05,0.12,10),'#cfd6e0',[cx+w*0.2,1.05,cz],[0.6,0,0.3]);
  put(glow,SP(0.05,6,4),'#ffd48a',[cx-w*0.3,0.96,cz]);
  return;}
 put(k,B(w,H,h),'#4a4e5e',[cx,H/2,cz]);
}
function rockKit(k,glow,rk){
 const [x,y,r,st]=rk;
 if(MapArt.ROCKS[st]){MapArt.rock(legacyArt(k,glow),rk,true);return;}
 if(st==='dome'){   // habitat dome: base ring, lit dome, window band, airlock
  put(k,CY(r,r*1.05,0.22,16),'#2f3848',[x,0.11,y]);
  const g=new THREE.SphereGeometry(r*0.9,16,8,0,Math.PI*2,0,Math.PI/2);put(k,g,'#b8c4d6',[x,0.2,y],null,null,'shine');
  put(k,TO(r*0.9,0.03,4,24),'#5a6578',[x,0.2,y],[Math.PI/2,0,0]);
  for(let i=0;i<7;i++){const a=Math.PI*(0.1+i*0.13);put(glow,B(0.1,0.07,0.04),'#ffd48a',[x+Math.cos(a)*r*0.84,0.42,y+Math.sin(a)*r*0.84],[0,-a,0]);}
  put(k,B(0.5,0.4,0.5),'#3a4458',[x,0.2,y+r*0.95]);put(glow,B(0.24,0.05,0.02),'#4d9fff',[x,0.3,y+r*1.2]);
  return;}
 const j=h2(x,y),g=new THREE.IcosahedronGeometry(r,1),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i),n=0.82+h2(v.x*3+x,v.z*3+y)*0.32;p.setXYZ(i,v.x*n,Math.max(-0.1,v.y*n*0.72),v.z*n);}
 put(k,g,hexMix('#4c5466','#6f788b',j),[x,r*0.32,y],[0,j*6,0]);
}
function craterKit(k,cr,glow){
 if(MapArt.CRATERS[cr[3]]){MapArt.crater(legacyArt(k,glow||k),cr,true);return;}
 const [x,y,r]=cr,pts=[];for(const [a,b] of [[0.78,0],[0.9,0.12],[1.02,0.18],[1.14,0.08],[1.28,0]])pts.push(new THREE.Vector2(r*a,b));
 put(k,new THREE.LatheGeometry(pts,18),'#3b4250',[x,0,y]);
}
// ---------- Canyon and Underground Bunker: shared 3D art ----------
// One set of pieces for both renderers: A is an adapter, A.geo(geometry,color,pos,rot,scale,material) with material one of
// paint | steel | gold | rubber | energy. Every raised piece stands on its collision footprint or outside the arena;
// floor pieces (scree, coolant) stay flat, so nothing hides a tank that isn't behind real cover.
const MapArt=(()=>{
 const hz=(a,b)=>h2(a*1.31+0.7,b*0.77-2.3);
 const bx=(A,sz,p,c,m,r)=>A.geo(B(Math.max(0.01,sz[0]),Math.max(0.01,sz[1]),Math.max(0.01,sz[2])),c,p,r||null,null,m||'paint');
 function rockG(r,hgt,detail,sd){   // a lump of rock r wide and hgt tall, base on the ground
  const g=new THREE.IcosahedronGeometry(r,detail),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=0.8+hz(x*3+sd,z*3-sd)*0.36;p.setXYZ(i,x*n,Math.max(0,(y+r)/(2*r))*hgt,z*n);}
  g.deleteAttribute('normal');if(g.attributes.uv)g.deleteAttribute('uv');return g;}
 const rock=(A,x,z,r,hgt,detail,sd,col,y)=>A.geo(rockG(r,hgt,detail,sd),col,[x,y||0,z],[0,hz(x+sd,z)*6.28,0],null,'paint');
 const STRATA=['#2b231d','#3a2f27','#4a3c31','#332a22'],ROCKC=['#3b3028','#4a3c31','#56473a','#30271f'];
 function canyon(A,wl,high,fin){   // layered basalt cliff: strata, ragged buttresses on the faces that look into the arena, towering mass beyond the border
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,sd=x*3.1+z*1.7,Hc=fin?1.2:1.7;
  const inner={W:x>0.01,E:x+w<W-0.01,N:z>0.01,S:z+d<H-0.01};
  const layers=fin?2:3;for(let i=0;i<layers;i++){const hh=Hc/layers,ins=0.07*i;bx(A,[w-2*ins,hh,d-2*ins],[X,i*hh+hh/2,Z],STRATA[(i+Math.floor(hz(x,z)*4))%4]);}
  const step=high?1.0:1.6,col=t=>ROCKC[Math.floor(hz(t,sd)*4)%4];
  const face=(len,at)=>{for(let t=step*0.5;t<len;t+=step){const r=0.3+hz(t,sd)*0.22,h=Hc*(0.55+hz(sd,t)*0.6);at(t,r,h);}};   // buttresses: lower than the rim, so the wall reads as a wall
  if(inner.E)face(d,(t,r,h)=>rock(A,x+w-r*0.7,z+t,r,h,0,sd+t,col(t)));
  if(inner.W)face(d,(t,r,h)=>rock(A,x+r*0.7,z+t,r,h,0,sd-t,col(t+1)));
  if(inner.N)face(w,(t,r,h)=>rock(A,x+t,z+r*0.7,r,h,0,sd+t*2,col(t+2)));
  if(inner.S)face(w,(t,r,h)=>rock(A,x+t,z+d-r*0.7,r,h,0,sd-t*2,col(t+3)));
  const tops=Math.max(1,Math.round(w*d/(high?3.5:7)));   // loose rocks and ridges on top
  for(let i=0;i<tops;i++){const r=0.25+hz(i,sd)*0.35;rock(A,x+r+hz(sd,i)*Math.max(0.01,w-2*r),z+r+hz(i+5,sd)*Math.max(0.01,d-2*r),r,0.25+hz(i,i+sd)*0.55,0,sd+i,ROCKC[i%4],Hc-0.05);}
  const out=(len,at)=>{for(let t=0.6;t<len;t+=high?1.15:1.9){const r=0.9+hz(t,sd+9)*0.6,h=2.4+hz(sd+9,t)*2.2;at(t,r,h);}};   // the canyon wall rises beyond the arena
  if(!fin){
   if(x<0.01)out(d,(t,r,h)=>rock(A,-0.55-hz(t,1)*0.5,z+t,r,h,0,sd+t*3,'#251e19'));
   if(x+w>W-0.01)out(d,(t,r,h)=>rock(A,W+0.55+hz(t,2)*0.5,z+t,r,h,0,sd+t*3,'#251e19'));
  }
 }
 function spire(A,x,z,r,high){const sd=x*7+z;rock(A,x,z,r,r*1.25,high?1:0,sd,'#3a2f27');rock(A,x+r*0.1,z-r*0.05,r*0.68,r*1.15,0,sd+1,'#4a3c31',r*1.05);rock(A,x-r*0.05,z+r*0.05,r*0.4,r*0.9,0,sd+2,'#5a4a3c',r*2.0);}
 function boulder(A,x,z,r,high){rock(A,x,z,r,r*1.15,high?1:0,x*5+z,'#4a3c31');rock(A,x+r*0.75,z+r*0.45,r*0.38,r*0.5,0,x+z*3,'#3b3028');}
 function scree(A,x,z,r,high){
  A.geo(new THREE.CylinderGeometry(r,r*1.05,0.012,high?20:10),'#4a3c31',[x,0.006,z],null,null,'paint');
  const n=high?18:8;for(let i=0;i<n;i++){const a=hz(i,x)*6.28,dd=Math.sqrt(hz(z,i))*r*0.92,q=0.06+hz(i,i+z)*0.1;rock(A,x+Math.cos(a)*dd,z+Math.sin(a)*dd,q,q*0.9,0,i+x,ROCKC[i%4]);}
 }
 // ---- bunker ----
 const CON='#5f646b',CON2='#50555c',STEEL='#8c949c',DARK='#24292f',HAZ='#d9a92e',HAZK='#1b1d20';
 function band(A,x0,x1,y,zf,ht,dz){   // hazard stripes along x on the face at z=zf (dz: which way the face looks)
  const n=Math.max(2,Math.round((x1-x0)/0.45));for(let i=0;i<n;i++)if(i%2)bx(A,[(x1-x0)/n,ht,0.02],[x0+(i+0.5)*(x1-x0)/n,y,zf+dz*0.01],HAZ);bx(A,[x1-x0,ht,0.015],[(x0+x1)/2,y,zf+dz*0.004],HAZK);}
 function bandZ(A,z0,z1,y,xf,ht,dx){const n=Math.max(2,Math.round((z1-z0)/0.45));for(let i=0;i<n;i++)if(i%2)bx(A,[0.02,ht,(z1-z0)/n],[xf+dx*0.01,y,z0+(i+0.5)*(z1-z0)/n],HAZ);bx(A,[0.015,ht,z1-z0],[xf+dx*0.004,y,(z0+z1)/2],HAZK);}
 function faces(A,x,z,w,d,f){if(z>0.01)f(x,x+w,z,-1,true);if(z+d<H-0.01)f(x,x+w,z+d,1,true);if(x>0.01)f(z,z+d,x,-1,false);if(x+w<W-0.01)f(z,z+d,x+w,1,false);}   // faces on the arena border are never seen   // (a0,a1,at,dir,alongX)
 function bulk(A,wl,high){   // reinforced bulkhead: concrete core, steel cap and ribs, hazard skirt, light strips
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,Hb=1.35;
  bx(A,[w,Hb,d],[X,Hb/2,Z],CON);bx(A,[w,0.07,d],[X,Hb+0.035,Z],STEEL,'steel');
  bx(A,[w*0.7,0.03,d*0.5],[X,Hb+0.085,Z],CON2);
  faces(A,x,z,w,d,(a0,a1,at,dir,ax)=>{const L=a1-a0;if(L<0.9)return;
   if(high)if(ax)band(A,a0,a1,0.13,at,0.16,dir);else bandZ(A,a0,a1,0.13,at,0.16,dir);
   const n=Math.max(1,Math.round(L/1.6));for(let i=0;i<=n;i+=high?1:n){const t=a0+L*i/n;bx(A,ax?[0.09,Hb,0.05]:[0.05,Hb,0.09],ax?[Math.min(a1-0.05,Math.max(a0+0.05,t)),Hb/2,at-dir*0.025]:[at-dir*0.025,Hb/2,Math.min(a1-0.05,Math.max(a0+0.05,t))],STEEL,'steel');}
   if(high)for(let i=0;i<n;i++){const t=a0+L*(i+0.5)/n;bx(A,ax?[Math.min(0.8,L/n*0.6),0.05,0.02]:[0.02,0.05,Math.min(0.8,L/n*0.6)],ax?[t,1.05,at+dir*0.012]:[at+dir*0.012,1.05,t],'#ffd9a0','energy');}
  });
 }
 function door(A,wl,high){   // blast door rolled back into its frame: posts, the slab with chevrons, track beam, status lamps
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,long=w>=d,L=long?w:d,D=long?d:w,Hd=1.45;
  const at=(u,y,v)=>long?[x+u,y,Z+v]:[X+v,y,z+u],sz=(a,b,c)=>long?[a,b,c]:[c,b,a];
  for(const u of [0.15,L-0.15])bx(A,sz(0.3,Hd+0.18,D),at(u,(Hd+0.18)/2,0),STEEL,'steel');
  bx(A,sz(L-0.6,Hd,D*0.62),at(L/2,Hd/2,0),'#6d7177');
  bx(A,sz(L,0.14,D),at(L/2,Hd+0.11,0),'#3d4248','steel');
  const n=Math.max(3,Math.round((L-0.7)/(high?0.26:0.4)));for(const v of [-1,1])for(let i=0;i<n;i++){const u=0.38+(i+0.5)*(L-0.76)/n;bx(A,sz((L-0.76)/n*0.9,0.95,0.02),at(u,0.72,v*(D*0.31+0.012)),i%2?HAZ:HAZK,'paint',long?[0,0,0.5]:[0.5,0,0]);}
  for(const v of [-1,1]){bx(A,sz(0.12,0.12,0.03),at(0.15,1.25,v*(D/2+0.015)),'#ff5a46','energy');bx(A,sz(0.12,0.12,0.03),at(L-0.15,1.25,v*(D/2+0.015)),'#5aff96','energy');}
  if(high)for(const v of [-1,1])bx(A,sz(L-0.7,0.05,0.02),at(L/2,1.32,v*(D*0.31+0.012)),'#ffd9a0','energy');
 }
 function pillar(A,wl,high){   // structural column: concrete, steel corner guards, hazard collar, capital
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,Hp=2.1;
  bx(A,[w-0.08,Hp,d-0.08],[X,Hp/2,Z],CON2);bx(A,[w,0.2,d],[X,Hp-0.1,Z],STEEL,'steel');bx(A,[w,0.12,d],[X,0.06,Z],'#3a3f45');
  for(const sx of [-1,1])for(const sz of [-1,1])bx(A,[0.1,Hp-0.2,0.1],[X+sx*(w/2-0.05),Hp/2-0.1,Z+sz*(d/2-0.05)],STEEL,'steel');
  if(high)faces(A,x+0.04,z+0.04,w-0.08,d-0.08,(a0,a1,at2,dir,ax)=>{if(ax)band(A,a0,a1,0.42,at2,0.22,dir);else bandZ(A,a0,a1,0.42,at2,0.22,dir);});
  bx(A,[w*0.5,0.05,0.02],[X,1.6,z+d+0.012],'#ffd9a0','energy');
 }
 function turbine(A,wl,high){   // turbine bank: base, drums lying along it, glowing rings, pipework
  const [x,z,w,d]=wl,X=x+w/2,n=Math.max(1,Math.round(d/1.4)),r=Math.min(w*0.46,d/n*0.4);
  bx(A,[w,0.25,d],[X,0.125,z+d/2],DARK);
  for(let i=0;i<n;i++){const Z=z+d*(i+0.5)/n;
   A.geo(new THREE.CylinderGeometry(r,r,w*0.92,high?14:8,1,true),'#7a838c',[X,0.25+r,Z],[0,0,Math.PI/2],null,'steel');
   for(const s of [-1,1])A.geo(new THREE.TorusGeometry(r*1.02,0.04,3,high?14:8),'#4fd8ff',[X+s*w*0.3,0.25+r,Z],[0,Math.PI/2,0],null,'energy');
   A.geo(new THREE.CylinderGeometry(r*0.55,r*0.55,0.05,high?12:6),'#2d3339',[X+w*0.47,0.25+r,Z],[0,0,Math.PI/2],null,'steel');}
  bx(A,[0.16,0.16,d*0.9],[X-w*0.18,0.25+2*r+0.05,z+d/2],'#5d666f','steel');
  bx(A,[0.06,0.5,d*0.8],[x+w-0.04,0.6,z+d/2],'#4fd8ff','energy');
 }
 function lift(A,wl,high){   // cargo lift platform; its shaft rises beyond the arena wall
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,back=z<0.01?-1:1,face=back<0?z+d:z;
  bx(A,[w,0.32,d],[X,0.16,Z],'#565c63');bx(A,[w-0.4,0.04,d-0.3],[X,0.34,Z],'#6b727a','steel');
  band(A,x,x+w,0.2,face,0.24,-back);
  for(let i=0;i<4;i++)A.geo(new THREE.CylinderGeometry(0.13,0.13,0.9,high?10:6),STEEL,[x+w*(i+0.5)/4,0.75,Z+back*d*0.2],null,null,'steel');
  const zo=back<0?-0.45:H+0.45;   // outside the arena
  for(const s of [-1,1])bx(A,[0.3,3.4,0.3],[X+s*(w/2-0.2),1.7,zo],STEEL,'steel');
  bx(A,[w,0.3,0.35],[X,3.3,zo],'#4a5058','steel');bx(A,[w-0.6,2.6,0.08],[X,1.6,zo+back*0.2],'#2b3036');
  for(let i=0;i<5;i++)bx(A,[w-0.7,0.06,0.05],[X,0.6+i*0.55,zo-back*0.05],i%2?HAZ:HAZK);
  for(const s of [-1,1])bx(A,[0.14,0.14,0.05],[X+s*(w/2-0.2),3.1,zo-back*0.18],'#ff8a3a','energy');
 }
 function consoleArt(A,wl,high){
  const [x,z,w,d]=wl,X=x+w/2,Z=z+d/2,s=x<W/2?1:-1;   // screens face into the arena
  bx(A,[w,0.85,d],[X,0.425,Z],'#2f353c');bx(A,[w*0.9,0.06,d*0.9],[X,0.88,Z],'#4a525b','steel');
  for(let i=0;i<3;i++)bx(A,[0.03,0.22,d*0.25],[X+s*(w/2+0.012),0.6,z+d*(0.2+i*0.3)],i===1?'#ffc85a':'#56d8ff','energy');
  if(high)for(let i=0;i<4;i++)bx(A,[0.05,0.05,0.05],[X+s*w*0.25,0.93,z+0.3+i*(d-0.6)/3],i%2?'#ff5a46':'#5aff96','energy');
 }
 function fuelTank(A,x,z,r,high){   // fuel tank: drum, dome, bands, hazard ring, ladder
  const Ht=1.7,seg=high?14:8;
  A.geo(new THREE.CylinderGeometry(r*0.94,r*0.98,Ht,seg),'#8a929a',[x,Ht/2,z],null,null,'steel');
  A.geo(new THREE.SphereGeometry(r*0.94,seg,high?4:2,0,Math.PI*2,0,Math.PI/2),'#9aa3ab',[x,Ht,z],null,[1,0.35,1],'steel');
  for(const y of high?[0.35,1.2]:[1.2])A.geo(new THREE.TorusGeometry(r*0.96,0.05,3,seg),'#4a5058',[x,y,z],[Math.PI/2,0,0],null,'steel');
  A.geo(new THREE.CylinderGeometry(r*0.955,r*0.955,0.22,seg),HAZ,[x,0.78,z],null,null,'paint');
  const a=Math.atan2(16-z,10-x);for(let i=0;i<6;i++)bx(A,[0.22,0.03,0.05],[x+Math.cos(a)*(r*0.98+0.03),0.25+i*0.25,z+Math.sin(a)*(r*0.98+0.03)],'#c9ced3','steel',[0,-a,0]);
  bx(A,[0.12,0.12,0.04],[x+Math.cos(a)*r*0.99,1.5,z+Math.sin(a)*r*0.99],'#ff8a3a','energy',[0,-a,0]);
 }
 function coolant(A,x,z,r,high){
  A.geo(new THREE.CylinderGeometry(r*0.95,r*0.95,0.012,high?16:10),'#1f8aa8',[x,0.008,z],null,null,'energy');
  A.geo(new THREE.CylinderGeometry(r*0.5,r*0.5,0.014,high?12:6),'#5fe6ff',[x+r*0.15,0.012,z-r*0.1],null,null,'energy');
  A.geo(new THREE.TorusGeometry(r,0.035,3,high?16:10),'#26333b',[x,0.02,z],[Math.PI/2,0,0],null,'rubber');
 }
 // beyond the arena: the bunker's concrete walls with conduits and lamps; the canyon's floor runs on north and south
 function scenery(A,id,high){
  if(id==='bunker'){
   for(const s of [-1,1]){const xo=s<0?-0.6:W+0.6;
    bx(A,[1.2,2.5,H+2.4],[xo,1.25,H/2],'#3b4047');
    for(let z=1;z<H;z+=high?2:4)bx(A,[0.12,2.4,0.14],[xo-s*0.62,1.2,z],'#555b62','steel');
    for(const y of [1.25,1.6])A.geo(new THREE.CylinderGeometry(0.1,0.1,H,8),y<1.4?'#6f7880':'#8a6a3a',[xo-s*0.5,y,H/2],[Math.PI/2,0,0],null,'steel');
    for(let z=3;z<H;z+=4)bx(A,[0.05,0.08,0.6],[xo-s*0.63,2.1,z],'#ffe0b0','energy');}
   for(const s of [-1,1]){const zo=s<0?-0.6:H+0.6;bx(A,[W+2.4,2.5,1.2],[W/2,1.25,zo],'#3b4047');
    for(let x=1;x<W;x+=high?2:4)bx(A,[0.14,2.4,0.12],[x,1.2,zo-s*0.62],'#555b62','steel');}
  }
 }
 const WALLS={canyon:(A,wl,q)=>canyon(A,wl,q,false),fin:(A,wl,q)=>canyon(A,wl,q,true),bulk,door,pillar,turbine,lift,console:consoleArt};
 const ROCKS={spire,boulder,tank:fuelTank},CRATERS={scree,coolant},HEIGHT={canyon:1.7,fin:1.2,bulk:1.35,door:1.45,pillar:2.1,turbine:1.15,lift:0.4,console:0.9};
 return {WALLS,ROCKS,CRATERS,HEIGHT,scenery,
  wall:(A,wl,high)=>WALLS[wl[4]](A,wl,high),rock:(A,rk,high)=>ROCKS[rk[3]](A,rk[0],rk[1],rk[2],high),crater:(A,cr,high)=>CRATERS[cr[3]](A,cr[0],cr[1],cr[2],high)};
})();
// the legacy kit as a MapArt adapter: matte pieces lit, metal shiny, energy into the glow kit
const legacyArt=(k,glow)=>({geo:(g,c,p,r,s,m)=>put(m==='energy'?glow:k,g,c,p,r,s,m==='steel'||m==='gold'?'shine':undefined)});
// Canyon's mesa: the Overpass bridge's exact rules (deck, arch tunnel, ramps), built as a rock plateau. Top surfaces go in the
// deck / tunnel meshes so they fade while you drive underneath, like the bridge.
function mesaGeometry(k,glow,G,mats,BRd){
 const [dx,dy,dw,dh]=BRd.deck,dk=kit(),tn=kit(),A=legacyArt(k,glow);
 let x0=dx;const spans=[];for(const [tx,tw] of BRd.tunnels){spans.push([x0,tx-x0,1]);spans.push([tx,tw,0]);x0=tx+tw;}spans.push([x0,dx+dw-x0,1]);
 for(const [sx,sw,solid] of spans){
  if(solid){
   const L=['#2b231d','#3a2f27','#332a22'];for(let i=0;i<3;i++){const hh=(DECK_H-0.2)/3,ins=0.05*i;put(k,B(sw-ins*2,hh,dh-ins*2),L[i],[sx+sw/2,i*hh+hh/2,dy+dh/2]);}
   put(dk,B(sw,0.2,dh),'#5c4a3c',[sx+sw/2,DECK_H-0.1,dy+dh/2]);
   for(let i=0;i<Math.round(sw*dh/3);i++){const a=h2(sx+i,dy),b=h2(i,sx);put(dk,B(0.6+a*0.9,0.012,0.05),'#3a2f27',[sx+0.4+a*(sw-0.8),DECK_H+0.006,dy+0.4+b*(dh-0.8)],[0,a*3,0]);}   // cracks in the cap rock
   for(const z of [dy,dy+dh])for(let t=0.4;t<sw;t+=0.85){const r=0.28+h2(t,z)*0.18;put(k,rockGeoPublic(r,DECK_H*(0.7+h2(z,t)*0.25),sx+t+z),'#4a3c31',[sx+t,0,z+(z===dy?r*0.7:-r*0.7)],[0,h2(t,z)*6,0]);}
  }else{
   put(tn,B(sw,0.24,dh),'#4f4034',[sx+sw/2,DECK_H-0.12,dy+dh/2]);
   sym(s=>put(glow,B(0.05,0.05,dh),'#ffb066',[sx+(s<0?0.06:sw-0.06),DECK_H-0.3,dy+dh/2]));   // work lamps strung inside the arch
  }
 }
 for(const [rx,ry,rw,rh,o] of BRd.ramps){   // a rock-cut ramp with rubble banks (the same slope as the bridge's)
  const lo=o<0?ry:ry+rh,hi=o<0?ry+rh:ry,pos=[],v=(x,z)=>[x,(z-lo)/(hi-lo)*DECK_H,z],tri=(a,b,c)=>pos.push(...a,...b,...c);
  const A0=[rx,0,lo],B0=[rx+rw,0,lo],C0=[rx+rw,0,hi],D0=[rx,0,hi],C1=v(rx+rw,hi),D1=v(rx,hi);
  for(const [a,b,c] of [[A0,B0,C1],[A0,C1,D1],[B0,C0,C1],[A0,D1,D0],[D0,D1,C1],[D0,C1,C0]]){tri(a,b,c);tri(a,c,b);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));put(k,g,'#4a3c31');
  for(let i=1;i<6;i++){const z=lo+(hi-lo)*i/6;put(k,B(rw-0.2,0.03,0.06),'#6b5645',[rx+rw/2,i/6*DECK_H+0.015,z],[(o<0?-1:1)*Math.atan2(DECK_H,rh),0,0]);}
  sym(s=>{const zx=s<0?rx-0.1:rx+rw+0.1;for(let t=0.25;t<rh;t+=0.5){const z=ry+t,f=Math.abs(z-lo)/rh,r=0.16+h2(t,zx)*0.06;put(k,rockGeoPublic(r,DECK_H*f+0.3,zx+t),'#5a4838',[zx,0,z]);}});
 }
 const ds=bake(dk),ts=bake(tn);
 const deck={solid:new THREE.Mesh(ds.lit,mats.deck),tun:new THREE.Mesh(ts.lit,mats.tun)};G.add(deck.solid,deck.tun);
 return deck;
}
function rockGeoPublic(r,hgt,sd){const g=new THREE.IcosahedronGeometry(r,0),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=0.8+h2(x*3+sd,z*3-sd)*0.36;p.setXYZ(i,x*n,Math.max(0,(y+r)/(2*r))*hgt,z*n);}return g;}
// ground: the lunar surface painted once per map (regolith, team pads, crater bowls, soft shadows under everything)
function groundTex(M,ppu,id){
 const cv=document.createElement('canvas');cv.width=W*ppu;cv.height=H*ppu;const c=cv.getContext('2d'),u=ppu;
 const themed=typeof MAP_THEME!=='undefined'&&MAP_THEME[id]&&typeof floorPaint==='function';
 if(themed)floorPaint(c,id,u,cv.width,cv.height);else{
 const gr=c.createLinearGradient(0,0,0,cv.height);gr.addColorStop(0,'#363b47');gr.addColorStop(0.5,'#3c414d');gr.addColorStop(1,'#363b47');c.fillStyle=gr;c.fillRect(0,0,cv.width,cv.height);
 let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;};
 for(let i=0;i<W*H*3;i++){const x=rnd()*cv.width,y=rnd()*cv.height,rr=(0.04+rnd()*0.22)*u,l=rnd();c.fillStyle=l<0.5?'rgba(20,24,32,'+(0.12+rnd()*0.18)+')':'rgba(190,200,215,'+(0.04+rnd()*0.08)+')';c.beginPath();c.arc(x,y,rr,0,7);c.fill();}
 for(let i=0;i<26;i++){const x=rnd()*cv.width,y=rnd()*cv.height,rr=(0.25+rnd()*0.6)*u;c.strokeStyle='rgba(15,18,25,.35)';c.lineWidth=Math.max(1,u*0.06);c.beginPath();c.arc(x,y,rr,0,7);c.stroke();c.strokeStyle='rgba(210,220,235,.12)';c.beginPath();c.arc(x-u*0.04,y-u*0.04,rr,Math.PI,Math.PI*1.6);c.stroke();}
 c.strokeStyle='rgba(120,135,160,.10)';c.lineWidth=1;c.beginPath();for(let i=0;i<=W;i+=2){c.moveTo(i*u,0);c.lineTo(i*u,cv.height);}for(let j=0;j<=H;j+=2){c.moveTo(0,j*u);c.lineTo(cv.width,j*u);}c.stroke();
 }
 const pad=(y0,col)=>{c.fillStyle=col.replace('A','0.06');c.fillRect(0,y0*u,cv.width,5*u);c.strokeStyle=col.replace('A','0.3');c.lineWidth=Math.max(2,u*0.08);c.beginPath();c.moveTo(0,(y0?y0:5)*u);c.lineTo(cv.width,(y0?y0:5)*u);c.stroke();
  c.strokeStyle=col.replace('A','0.16');c.lineWidth=Math.max(1,u*0.04);for(let x=0.5;x<W;x+=1.5){c.beginPath();c.moveTo(x*u,(y0+1)*u);c.lineTo((x+0.6)*u,(y0+4)*u);c.stroke();}};
 pad(0,'rgba(255,77,94,A)');pad(H-5,'rgba(77,159,255,A)');
 c.save();c.filter='blur('+Math.round(u*0.25)+'px)';c.fillStyle='rgba(5,8,14,.55)';
 for(const [x,y,w,h,st] of M.walls||[]){const e=(WALL_H[st]||1)*0.45;c.fillRect((x+e*0.5)*u,(y+e*0.7)*u,w*u,h*u);}
 for(const [x,y,w,h] of M.crates||[])c.fillRect((x+0.3)*u,(y+0.4)*u,w*u,h*u);
 for(const [x,y,r] of M.rocks||[]){c.beginPath();c.ellipse((x+0.3)*u,(y+0.4)*u,r*1.05*u,r*0.95*u,0,0,7);c.fill();}
 if(M.bridge){const [dx,dy,dw,dh]=M.bridge.deck;c.fillRect((dx+0.3)*u,(dy+0.6)*u,dw*u,dh*u);}
 c.restore();
 for(const [x,y,r,st] of M.craters||[]){if(st)continue;const g=c.createRadialGradient((x-r*0.2)*u,(y+r*0.2)*u,r*0.1*u,x*u,y*u,r*u);g.addColorStop(0,'#14181f');g.addColorStop(0.7,'#1c212a');g.addColorStop(1,'#2a303b');c.fillStyle=g;c.beginPath();c.arc(x*u,y*u,r*0.8*u,0,7);c.fill();}
 const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;return t;
}
// the whole map: one static mesh per material, the bridge deck on its own (it fades when you drive under it), a few spinning pylons
// Exact existing bridge topology shared by legacy and optional environment skins.
function bridgeGeometry(k,glow,G,mats,BRd){
 if(BRd&&BRd.look==='mesa')return mesaGeometry(k,glow,G,mats,BRd);
 let deck=null;
 if(BRd){   // Overpass: deck on supports, tunnels underneath, ramps with rails, lights along the edges
  const [dx,dy,dw,dh]=BRd.deck,dk=kit(),tn=kit();
  let x0=dx;const spans=[];for(const [tx,tw] of BRd.tunnels){spans.push([x0,tx-x0,1]);spans.push([tx,tw,0]);x0=tx+tw;}spans.push([x0,dx+dw-x0,1]);
  for(const [sx,sw,solid] of spans){
   put(solid?dk:tn,B(sw,0.22,dh),'#3d4362',[sx+sw/2,DECK_H-0.11,dy+dh/2]);
   if(solid){put(k,B(sw-0.2,DECK_H-0.22,dh-0.3),'#2b3045',[sx+sw/2,(DECK_H-0.22)/2,dy+dh/2]);
    for(let i=0.6;i<sw-0.3;i+=1.2)sym(s=>put(k,B(0.08,DECK_H-0.25,0.04),'#454b6c',[sx+i,(DECK_H-0.22)/2,dy+dh/2+s*(dh/2-0.14)]));}
   else{sym(s=>put(glow,B(sw,0.05,0.04),'#ffcf4a',[sx+sw/2,DECK_H-0.26,dy+dh/2+s*(dh/2-0.02)]));
    sym(s=>put(glow,B(0.05,0.5,0.05),'#8fd0ff',[sx+(s<0?0.05:sw-0.05),0.25,dy+0.05]));sym(s=>put(glow,B(0.05,0.5,0.05),'#8fd0ff',[sx+(s<0?0.05:sw-0.05),0.25,dy+dh-0.05]));}
  }
  for(let x=dx+0.6;x<dx+dw-0.4;x+=1.2)put(dk,B(0.6,0.012,0.08),'#ffcf4a',[x,DECK_H+0.006,dy+dh/2]);
  sym(s=>{put(dk,B(dw,0.12,0.08),'#7a82ad',[dx+dw/2,DECK_H+0.06,dy+dh/2+s*(dh/2-0.04)]);put(glow,B(dw,0.025,0.02),'#ffcf4a',[dx+dw/2,DECK_H+0.13,dy+dh/2+s*(dh/2-0.04)]);});
  for(const [rx,ry,rw,rh,o] of BRd.ramps){
   const lo=o<0?ry:ry+rh,hi=o<0?ry+rh:ry,pts=[[rx,lo],[rx+rw,lo],[rx+rw,hi],[rx,hi]],pos=[];
   const v=(x,z)=>[x,(z-lo)/(hi-lo)*DECK_H,z];
   const tri=(a,b,c)=>pos.push(...a,...b,...c);
   const A0=[rx,0,lo],B0=[rx+rw,0,lo],C0=[rx+rw,0,hi],D0=[rx,0,hi],C1=v(rx+rw,hi),D1=v(rx,hi);
   // top slope, two sides, back wall (all faces both ways, tiny so the cost is nothing)
   for(const [a,b,c] of [[A0,B0,C1],[A0,C1,D1],[B0,C0,C1],[A0,D1,D0],[D0,D1,C1],[D0,C1,C0]]){tri(a,b,c);tri(a,c,b);}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));put(k,g,'#454b6c');
   sym(s=>{const zx=s<0?rx-0.1:rx+rw+0.1;const rg=new THREE.BufferGeometry(),rp=[];const a=[zx,0,lo],b=[zx,0.25,lo],c=[zx,DECK_H+0.25,hi],d=[zx,DECK_H,hi];
    rp.push(...a,...b,...c,...a,...c,...d,...a,...c,...b,...a,...d,...c);rg.setAttribute('position',new THREE.Float32BufferAttribute(rp,3));put(k,rg,'#8a92bd');});
   for(let i=1;i<5;i++){const z=lo+(hi-lo)*i/5;put(glow,B(rw-0.3,0.02,0.05),'#ffcf4a',[rx+rw/2,i/5*DECK_H+0.02,z],[(o<0?-1:1)*Math.atan2(DECK_H,rh),0,0]);}
  }
  const ds=bake(dk),ts=bake(tn);
  deck={solid:new THREE.Mesh(ds.lit,mats.deck),tun:new THREE.Mesh(ts.lit,mats.tun)};
  G.add(deck.solid,deck.tun);
 }
 return deck;
}
function bridgeVisual(BRd,mats){const k=kit(),glow=kit(),G=new THREE.Group(),deck=bridgeGeometry(k,glow,G,mats,BRd);G.add(meshOf(bake(k),mats),meshOf(bake(glow),mats));return {group:G,deck};}
function buildMap(id,mats,q){
 if(typeof Environment3D!=='undefined'&&Environment3D.active())return Environment3D.buildMap(id,mats,q);
 const Md=MAPS[id]||MAPS.classic,k=kit(),glow=kit(),pulse=kit(),anims=[];
 const G=new THREE.Group();
 // the arena slab: regolith on top, rock sides, trim lights along the edges
 put(k,B(W+0.6,2.2,H+0.6),'#22262f',[W/2,-1.1,H/2]);
 for(const [x0,z0,w,d] of [[W/2,-0.3,W+0.6,0.04],[W/2,H+0.3,W+0.6,0.04]])put(glow,B(w,0.04,d),z0<0?'#ff4d5e':'#4d9fff',[x0,0.02,z0]);
 sym(s=>put(glow,B(0.04,0.04,H+0.6),'#59607a',[W/2+s*(W/2+0.3),0.02,H/2]));
 for(const wl of Md.walls||[])wallKit(k,glow,pulse,anims,wl);
 for(const rk of Md.rocks||[])rockKit(k,glow,rk);
 for(const cr of Md.craters||[])craterKit(k,cr,glow);
 MapArt.scenery(legacyArt(k,glow),id,q!=='low');
 const deck=bridgeGeometry(k,glow,G,mats,Md.bridge);
 const S=bake(k),Gw=bake(glow),Pl=bake(pulse);
 if(S.lit)G.add(new THREE.Mesh(S.lit,mats.lit));if(S.shine)G.add(new THREE.Mesh(S.shine,mats.shine));
 for(const gg of [Gw.lit,Gw.glow])if(gg)G.add(new THREE.Mesh(gg,mats.glow));
 let pulseMesh=null;if(Pl.lit){pulseMesh=new THREE.Mesh(Pl.lit,mats.pulse);G.add(pulseMesh);}
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshLambertMaterial({map:groundTex(Md,q==='low'?20:32,MAPS[id]?id:'classic')}));
 ground.rotation.x=-Math.PI/2;ground.position.set(W/2,0.001,H/2);G.add(ground);
 const spin=[];for(const a of anims){const m=meshOf(bake(a.k),mats);m.position.set(a.p[0],a.p[1],a.p[2]);G.add(m);spin.push({o:m,axis:a.axis,spd:a.spd});}
 return {group:G,deck,spin,ground};
}
// a baked kit as one object (up to three meshes sharing the given materials)
function meshOf(b,mats,ownMats){
 const g=new THREE.Group(),m=ownMats||mats;
 for(const [key,geo] of Object.entries(b))if(key.startsWith('hf_')&&geo){const material=Equipment3D.material(key)||m.lit,mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);}
 if(typeof Equipment3D!=='undefined')Equipment3D.retain(b,g);
 if(b.lit)g.add(new THREE.Mesh(b.lit,m.lit));if(b.shine)g.add(new THREE.Mesh(b.shine,m.shine));if(b.glow)g.add(new THREE.Mesh(b.glow,m.glow));
 return g;
}
function crateGeo(){const k=kit();
 put(k,B(1,1,1),'#7a5530',[0,0.5,0]);
 for(const [w,h,d,x,y,z] of [[1.04,0.08,0.08,0,0.04,0.48],[1.04,0.08,0.08,0,0.96,0.48],[1.04,0.08,0.08,0,0.04,-0.48],[1.04,0.08,0.08,0,0.96,-0.48],[0.08,1,0.08,0.48,0.5,0.48],[0.08,1,0.08,-0.48,0.5,0.48],[0.08,1,0.08,0.48,0.5,-0.48],[0.08,1,0.08,-0.48,0.5,-0.48],[0.08,0.08,1.04,0.48,0.96,0],[0.08,0.08,1.04,-0.48,0.96,0],[0.08,0.08,1.04,0.48,0.04,0],[0.08,0.08,1.04,-0.48,0.04,0]])put(k,B(w,h,d),'#b08a5a',[x,y,z]);
 put(k,B(1.2,0.06,0.06),'#b08a5a',[0,0.5,0.51],[0,0,0.75]);put(k,B(1.2,0.06,0.06),'#b08a5a',[0,0.5,0.51],[0,0,-0.75]);
 return bake(k);}
// Bounded fitting geometry, merged into the existing material buckets; no collision changes.
function fittingKit(f,team,part,context){
 const k=kit(),steel='#91a1b3';
 if(context&&CHASSIS_VISUALS[context.cls]){
  const o=CHASSIS_VISUALS[context.cls][visualTier(context.ct)],w=WEAPON_VISUALS[context.arch]?.[visualTier(context.wt)];
  if(part==='body'){
   const fp=FAM_FIT[context.cls+':'+visualTier(context.ct)]||[-.13,o.h+.22,o.trackZ-.02];if(f.hull==='plates')sym(s=>put(k,B(.85,.08,.14),steel,[fp[0],fp[1],s*fp[2]]));
   if(f.hull==='light')for(const x of [-.55,-.30,-.05])put(k,B(.07,.025,.45),team,[x,o.deck+.045,0],null,null,'glow');
   if(f.mobility==='sprint')sym(s=>put(k,B(.55,.07,.12),team,[-.82,o.h*.65,s*o.trackZ],null,null,'glow'));
   if(f.mobility==='stable')sym(s=>{for(const x of [-.65,.65])put(k,CY(.14,.14,.035,10),steel,[x,o.h*.5,s*(o.trackZ+o.trackW/2+.075)],[Math.PI/2,0,0],null,'shine');});
  }else if(w){
   if(f.mount==='hardened')sym(s=>put(k,B(.34,.16,.07),steel,[.27,.21,s*(w.width+.11)],null,null,'shine'));
   if(f.mount==='firing')for(const x of [.60,.82,1.04])put(k,B(.05,.09,.35),steel,[x,w.y+.19,0],null,null,'shine');
  }else if(context.arch==='moon'){
   if(f.mount==='hardened')sym(s=>put(k,B(.32,.13,.055),steel,[-.17,.24,s*.45],null,null,'shine'));
   if(f.mount==='firing')for(const x of [-.54,-.37,-.20])sym(s=>put(k,B(.05,.04,.055),steel,[x,.87,s*.18],null,null,'shine'));
  }else return fittingKit(f,team,part);
  return {k,anims:[],meta:{}};
 }

 if(part==='body'){
  if(f.hull==='plates')sym(z=>put(k,B(1.15,.16,.18),steel,[-.1,.55,z*.5]));
  if(f.hull==='light')for(const x of [-.6,-.3,0])put(k,B(.07,.035,.6),team,[x,.56,0],[0,-.3,0],null,'glow');
  if(f.mobility==='sprint')sym(z=>put(k,B(.65,.08,.14),team,[-.85,.38,z*.67],null,null,'glow'));
  if(f.mobility==='stable')sym(z=>{for(const x of [-.65,.65])put(k,CY(.16,.16,.1,8),steel,[x,.24,z*.83],[Math.PI/2,0,0]);});
 }else{
  if(f.mount==='hardened')put(k,B(.4,.22,.65),steel,[.4,.18,0]);
  if(f.mount==='firing')for(const x of [.4,.65,.9])put(k,B(.07,.3,.62),steel,[x,.2,0]);
 }
 return {k,anims:[],meta:{}};
}
const foundationChassis=(cls,tier,P,team,gems,lunar)=>lunar?lunarChassis(cls,visualTier(tier),P,team,gems):standardChassis(cls,visualTier(tier),P,team,gems);
const foundationWeapon=(arch,tier,P,team,lunar,cls)=>arch==='moon'?unifiedMoonbeam(team):standardWeapon(arch,visualTier(tier),P,team,lunar);
return {MapArt,famChassis,famTools,famFinish,famLunar,famSurfaceY,LUNAR,lunarStock,bridgeVisual,foundationChassis,foundationWeapon,MOON_SCALE,weaponScale,VISUAL_VERSION,CHASSIS_VISUALS,WEAPON_VISUALS,visualTier,fittingKit,kit,put,bake,merge,loft,palette,chassisKit,weaponKit,bossKit,crateKit,gemKit,buildMap,meshOf,crateGeo,starGeo,trackGeo,hexMul,hexMix,DECK_H,WALL_H,TIERC,shapes:{B,CY,SP,CO,OC,IC,TO}};
})();
