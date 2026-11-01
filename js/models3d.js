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
 if(lunar)return {hull:'#20252d',hull2:'#363c44',tur:'#272d36',tur2:'#424952',trim:'#bc904b',dark:'#10151c',metal:'#65717c',track:'#101419',light:'#d9eaff',team:team||'#4d9fff',acc:'#c49a54',shine:true,lunar:true};
 const k=P.hull==='#07080d'||P.hull==='#17131f'?2.1:P.hull==='#a9b6c8'||P.hull==='#aab2c0'?1.05:1.7;
 return {hull:hexMul(P.hull,k),hull2:hexMul(P.hull,k*0.82),tur:hexMul(P.tur,k),tur2:hexMul(P.tur,k*0.8),trim:P.trim,dark:'#262f3b',metal:'#76818f',track:'#171d25',light:'#e9f1f7',team:team||'#4d9fff',acc:CH[cls]?CH[cls].c:'#3fd0c9',shine:!!P.shine};
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
 if(C.lunar)return {body:C.hull,plate:C.hull2,tur:C.tur,edge:C.trim,steel:C.metal,rubber:C.track,recess:C.dark,amber:'#c49a54',ice:'#ffe1a1'};
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
 'titan:0':[-.20,.78,1.0],'titan:1':[-.40,.90,1.08],'titan:2':[-.80,.835,1.06]};
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
function famFinish(P,lunar){P=P||{};return {paint:lunar?'#171d27':P.hull||'#374959',plate:lunar?'#303946':P.tur||P.hull||'#536372',edge:lunar?'#c2a266':P.trim||'#a7b3bc',gold:'#c2a266',steel:'#a2acb8',rubber:'#192028',dark:'#121b25',ice:'#c0eaff',tail:'#b94528'};}
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
// mirror a top-view outline [x,z] to the other side (z -> -z)
const famSide=(pts,s)=>pts.map(([x,z])=>[x,z*s]);
function famChassis(cls,tier,P,team,gems,lunar,S){
 const o=CHASSIS_VISUALS[cls][tier],T=famTools(S),F=famFinish(P,lunar),high=T.high,halos=[];
 const {put,box,cyl,slab,panel,wall,block,pipe,bolt,vents,grille,lamp}=T;
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
  // TITAN: heavy siege hull. Broad slab hull overhanging the widest seven-wheel tracks, a flat low-angle glacis,
  // four deep bolted skirt plates per side and a long rear engine deck.
  drive({road:.19,end:.225});
  const zi=o.trackZ-o.trackW/2,zo=o.trackZ+o.trackW/2;
  block([[-1.44,-zi+.03],[1.24,-zi+.03],[1.42,-zi+.16],[1.42,zi-.16],[1.24,zi-.03],[-1.44,zi-.03]],[[-1.42,-zi+.05],[1.22,-zi+.05],[1.36,-zi+.16],[1.36,zi-.16],[1.22,zi-.05],[-1.42,zi-.05]],.18,.65,'paint',F.paint);
  // broad superstructure with raked sides on thick sponson fenders that span the full track width
  block([[-1.48,-zi-.10],[1.16,-zi-.10],[1.32,-zi+.04],[1.32,zi-.04],[1.16,zi+.10],[-1.48,zi+.10]],[[-1.46,-zi+.06],[1.08,-zi+.06],[1.22,-zi+.14],[1.22,zi-.14],[1.08,zi-.06],[-1.46,zi-.06]],tt,o.deck,'paint',F.paint);
  for(const s of [-1,1]){block(famSide([[-1.50,zi-.06],[1.20,zi-.06],[1.34,zi+.08],[1.34,zo+.04],[-1.50,zo+.04]],s),famSide([[-1.48,zi-.06],[1.16,zi-.06],[1.28,zi+.08],[1.28,zo+.01],[-1.48,zo+.01]],s),tt,tt+.085,'paint',F.plate);
   put(box(2.5,.014,.018),'steel',F.edge,[-.15,tt+.09,s*(zo-.02)]);if(high)for(let i=0;i<7;i++)bolt(-1.32+i*.40,tt+.088,s*(zi+.04));}
  block([[-1.46,-.62],[-.70,-.62],[-.62,-.54],[-.62,.54],[-.70,.62],[-1.46,.62]],[[-1.44,-.56],[-.74,-.56],[-.68,-.50],[-.68,.50],[-.74,.56],[-1.44,.56]],o.deck-.01,o.ring-.02,'paint',F.plate);
  put(box(.24,.035,.30),'paint',F.plate,[.70,o.deck,-.34]);put(cyl(.09,.04,high?14:8),'steel',F.steel,[.40,o.deck+.01,.40]);
  block([[.62,-1.0],[1.47,-.92],[1.47,.92],[.62,1.0]],[[.62,-.98],[1.40,-.90],[1.40,.90],[.62,.98]],.30,o.deck+.012,'paint',F.plate,[.62,1.47,.42,.30,.56]);
  put(box(.16,.16,1.50),'paint',F.plate,[1.44,.26,0]);put(box(.05,.05,1.70),'steel',F.steel,[1.53,.22,0]);
  for(const s of [-1,1])put(new THREE.TorusGeometry(.06,.02,4,high?12:8),'steel',F.edge,[1.52,.30,s*.62],[0,Math.PI/2,0]);
  for(const s of [-1,1]){
   // deep layered side armour: four thick bolted plates over the tread run, the massive wheel train left visible
   for(let i=0;i<4;i++){const x=-1.42+i*.70;wall([[x,.545],[x+.62,.545],[x+.64,tt+.13],[x-.02,tt+.13]],s*(zo+.05),.08,'paint',i%2?F.plate:F.paint,.014);
    if(high)for(const d of [.10,.31,.52])bolt(x+d,.62,s*(zo+.092),'z');put(box(.40,.012,.016),'steel',F.edge,[x+.31,tt+.10,s*(zo+.094)]);}
   slab(famSide([[1.20,zo-.30],[1.46,zo-.24],[1.40,zo+.10],[1.20,zo+.10]],s),tt,.06,'paint',F.plate,.012);
   put(box(.26,.022,.028),'energy',team,[.40,o.deck+.004,s*(zo-.12)]);
   put(box(.18,.10,.28),'rubber',F.dark,[-1.49,.58,s*.80]);put(box(.03,.04,.18),'energy',F.tail,[-1.585,.58,s*.80]);
   put(box(.10,.16,.30),'steel',F.steel,[-1.52,.52,s*.42]);put(box(.02,.10,.22),'rubber',F.dark,[-1.575,.52,s*.42]);
   vents(F,-.94,o.ring-.02,s*.36,.36,.16,6);
  }
  head(1.33,.70,.88,.14);tierBar(-.30,o.deck+.016,.80);
  anchor={hood:[.86,o.deck-.08],side:[-1.07,.63,zo+.095]};coreAt=[-1.30,[-.22,0,.22]];
 }else if(key==='titan:1'){
  // BULWARK: fortress ram. A full-width raked ram slab in front, armour walls covering the whole track side,
  // huge forward shoulder blocks, slab deck. The widest, most enclosed silhouette.
  drive({road:.19,end:.225});
  const zi=o.trackZ-o.trackW/2,zo=o.trackZ+o.trackW/2,zw=zo+.14;
  block([[-1.42,-zi+.03],[1.30,-zi+.03],[1.42,-zi+.12],[1.42,zi-.12],[1.30,zi-.03],[-1.42,zi-.03]],[[-1.40,-zi+.05],[1.28,-zi+.05],[1.38,-zi+.12],[1.38,zi-.12],[1.28,zi-.05],[-1.40,zi-.05]],.18,.65,'paint',F.paint);
  block([[-1.46,-zo],[1.30,-zo],[1.42,-zo+.12],[1.42,zo-.12],[1.30,zo],[-1.46,zo]],[[-1.44,-zo+.02],[1.22,-zo+.02],[1.32,-zo+.12],[1.32,zo-.12],[1.22,zo-.02],[-1.44,zo-.02]],tt,o.deck,'paint',F.paint,[1.0,1.42,.08,.7,.14]);
  block([[1.34,-1.20],[1.72,-1.08],[1.72,1.08],[1.34,1.20]],[[1.30,-1.14],[1.50,-1.02],[1.50,1.02],[1.30,1.14]],.07,.72,'paint',F.plate);
  for(const y of [.22,.42,.60]){const x=1.72-(y-.07)/.65*.22;put(box(.05,.05,1.86),'steel',y===.42?F.edge:F.steel,[x+.02,y,0],[0,0,.32]);}
  for(const s of [-1,1]){
   block(famSide([[1.28,1.10],[1.66,1.06],[1.44,zw+.05],[1.08,zw+.05]],s),famSide([[1.26,1.08],[1.48,1.04],[1.34,zw+.02],[1.10,zw+.02]],s),.10,.70,'paint',F.paint);
   // three fortress wall slabs with chamfered toes rise above the deck as a protective lip
   for(const [x0,x1] of [[-1.47,-.62],[-.58,.28],[.32,1.12]]){wall([[x0,.20],[x0+.10,.11],[x1-.10,.11],[x1,.20],[x1,o.ring-.01],[x0,o.ring-.01]],s*zw,.09,'paint',x0<0&&x0>-1?F.paint:F.plate,.014);
    put(box(x1-x0-.16,.016,.012),'rubber',F.dark,[(x0+x1)/2,.50,s*(zw+.047)]);if(high)for(const d of [.12,.5,.88])for(const y of [.24,.80])bolt(x0+(x1-x0)*d,y,s*(zw+.048),'z');}
   block(famSide([[.50,zo-.20],[1.16,zo-.20],[1.32,zo-.04],[1.24,zw+.06],[.50,zw+.06]],s),famSide([[.54,zo-.16],[1.08,zo-.16],[1.18,zo-.04],[1.12,zw+.01],[.54,zw+.01]],s),o.deck-.02,o.ring-.005,'paint',F.plate,[.9,1.32,.06,o.deck,.08]);
   put(box(.50,.014,.02),'steel',F.edge,[.80,o.ring-.002,s*(zw-.08)]);put(box(.30,.022,.03),'energy',team,[-.15,.70,s*(zw+.05)]);
   put(box(.16,.10,.26),'rubber',F.dark,[-1.48,.62,s*.72]);put(box(.03,.04,.18),'energy',F.tail,[-1.565,.62,s*.72]);
  }
  for(const s of [-1,1]){slab(famSide([[-.55,.62],[.10,.62],[.10,1.0],[-.55,1.0]],s),o.deck-.015,.04,'paint',F.plate,.01);if(high)for(const x of [-.45,-.05])bolt(x,o.deck+.026,s*.80);}put(box(.34,.03,.34),'paint',F.plate,[.72,o.deck,.40]);
  grille(F,-1.04,o.deck+.012,0,.62,.70,9);head(1.46,.62,.66,.16);tierBar(-.30,o.deck+.016,.78);
  anchor={hood:[.80,o.deck-.01],side:[-.62,.50,zw+.05]};coreAt=[-1.28,[-.25,0,.25]];
 }else{
  // COLOSSUS: flagship behemoth. Four separately housed track pods with exposed gold suspension nodes, a stepped
  // three-tier citadel hull, broad raked shoulders and a full-width rear power housing with twin exhaust ports.
  const pc=.80;drive({length:1.42,wheels:4,road:.20,end:.24},[-pc,pc]);
  const zi=o.trackZ-o.trackW/2,zo=o.trackZ+o.trackW/2;
  block([[-1.52,-zi+.03],[1.34,-zi+.03],[1.55,-.55],[1.55,.55],[1.34,zi-.03],[-1.52,zi-.03]],[[-1.50,-zi+.05],[1.30,-zi+.05],[1.46,-.53],[1.46,.53],[1.30,zi-.05],[-1.50,zi-.05]],.18,.67,'paint',F.paint);
  // stepped citadel: raked lower tier, then an inset upper casemate
  block([[-1.56,-1.0],[1.28,-1.0],[1.50,-.74],[1.50,.74],[1.28,1.0],[-1.56,1.0]],[[-1.52,-.90],[1.16,-.90],[1.36,-.68],[1.36,.68],[1.16,.90],[-1.52,.90]],tt,.78,'paint',F.plate,[1.0,1.5,.06,.7,.10]);
  block([[-1.40,-.76],[.86,-.76],[1.16,-.46],[1.16,.46],[.86,.76],[-1.40,.76]],[[-1.36,-.66],[.78,-.66],[1.02,-.42],[1.02,.42],[.78,.66],[-1.36,.66]],.775,o.deck,'paint',F.paint,[.85,1.16,.06,.78,.10]);
  for(const s of [-1,1]){put(box(1.9,.016,.018),'steel',F.edge,[-.30,.785,s*.82]);if(high)for(let i=0;i<6;i++)bolt(-1.25+i*.40,.785,s*.86);}
  block([[1.40,-.62],[1.62,-.40],[1.62,.40],[1.40,.62]],[[1.40,-.58],[1.52,-.38],[1.52,.38],[1.40,.58]],.24,.62,'paint',F.plate,[1.4,1.62,.10,.3,.32]);
  put(box(.06,.05,.96),'steel',F.edge,[1.585,.40,0],[0,0,.40]);
  for(const s of [-1,1]){
   for(const c of [-pc,pc]){
    // each pod in its own armoured housing: a roof over the tread and an outer wall clear of the wheels
    block(famSide([[c-.66,zi-.02],[c+.62,zi-.02],[c+.72,zo-.10],[c+.64,zo+.15],[c-.66,zo+.15]],s),famSide([[c-.62,zi],[c+.56,zi],[c+.64,zo-.10],[c+.56,zo+.12],[c-.62,zo+.12]],s),tt,tt+.10,'paint',c>0?F.plate:F.paint);
    wall([[c-.66,.40],[c+.60,.40],[c+.70,.50],[c+.70,tt+.02],[c-.66,tt+.02]],s*(zo+.125),.05,'paint',c>0?F.paint:F.plate,.01);
    put(box(1.0,.014,.02),'steel',F.edge,[c-.02,.66,s*(zo+.152)]);if(high)for(const d of [-.45,0,.45])bolt(c+d,.48,s*(zo+.152),'z');
   }
   pipe([0,.40,s*(zi-.06)],[0,.40,s*(zo+.10)],.075,F.steel);put(cyl(.11,.07,12),'gold',F.gold,[0,.40,s*(zo+.12)],[Math.PI/2,0,0]);put(cyl(.05,.08,10),'steel',F.dark,[0,.40,s*(zo+.14)],[Math.PI/2,0,0]);
   pipe([-.22,.24,s*(zo-.06)],[.22,.24,s*(zo-.06)],.04,'#7b8792');
   block(famSide([[.12,.95],[1.06,.95],[1.30,1.08],[1.04,zo+.10],[.12,zo+.10]],s),famSide([[.16,.97],[.98,.97],[1.16,1.07],[.96,zo+.02],[.16,zo+.02]],s),tt+.09,o.deck-.01,'paint',F.plate,[.9,1.3,.08,tt+.09,.12]);
   put(box(.70,.014,.02),'steel',F.edge,[.60,o.deck-.005,s*1.04]);put(box(.30,.022,.03),'energy',team,[-.80,.62,s*(zo+.153)]);
   put(new THREE.TorusGeometry(.065,.02,4,high?12:8),'steel',F.edge,[1.56,.28,s*.42],[0,Math.PI/2,0]);
  }
  block([[-1.62,-.98],[-1.50,-.98],[-1.50,.98],[-1.62,.98]],[[-1.60,-.94],[-1.50,-.94],[-1.50,.94],[-1.60,.94]],.30,.86,'paint',F.plate);
  for(const s of [-1,1]){put(cyl(.15,.06,high?18:10),'steel',F.steel,[-1.63,.56,s*.52],[0,0,Math.PI/2]);put(cyl(.11,.07,high?18:10),'rubber',F.dark,[-1.635,.56,s*.52],[0,0,Math.PI/2]);put(box(.03,.04,.20),'energy',F.tail,[-1.625,.78,s*.80]);}
  vents(F,-1.0,o.deck+.004,-.36,.42,.30,8);vents(F,-1.0,o.deck+.004,.36,.42,.30,8);
  head(1.50,.62,.46,.12);tierBar(-.30,o.deck+.012,.66);
  anchor={hood:[.88,o.deck-.04],side:[.80,.52,zo+.152]};coreAt=[-1.24,[-.24,0,.24]];
 }
 T.ring(F,o,ringR);
 T.cores(F,gems,coreAt[0],Math.min(o.deck+.05,o.ring-.11),coreAt[1]);
 if(lunar){
  // Existing Lunar Skin language (black, gold edges): inlaid side crests and a flush hood crest. No new effects.
  const [sx,sy,sz,flat]=anchor.side,cr=cls==='scout'?.085:cls==='titan'?.14:.12;
  for(const s of [-1,1]){if(flat){const g=T.crest(cr,.008);g.rotateX(-Math.PI/2);put(g,'gold',F.gold,[sx,sy,s*sz]);continue;}put(T.crest(cr,.008),'gold',F.gold,[sx,sy,s*sz]);pipe([sx-cr*1.6,sy-cr*.5,s*sz],[sx+cr*1.4,sy-cr*.5,s*sz],.006,F.gold,'gold');}
  const g=T.crest(cls==='scout'?.10:.15,.008);g.rotateX(-Math.PI/2);put(g,'gold',F.gold,[anchor.hood[0],anchor.hood[1]+.012,0]);
 }
 return {k:null,anims:[],meta:{ty:o.ring,bob:0,halos,trail:[],tc:F.edge,profile:key,legend:lunar?'lunar-black-gold':undefined,track:[(run.len-o.h)/2,o.h/2+.005,o.h/2+.03,run.c]}};
}
// Foundation sink: the same designs in the classic lit/shine/glow buckets (no textures needed).
function famFoundation(cls,tier,P,team,gems,lunar){
 const k=kit(),bucket={energy:'glow',rubber:'lit',paint:'shine',steel:'shine',gold:'shine'};
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
 if(arch==='pulse'&&tier===0){defenderPulseTurret(k,C,M,PM(C));return {k,anims:A,meta:M};}
 turretHousing(k,F,C,o,tier,arch);
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
 raw.meta.legend='lunar-black-gold';raw.meta.tc=F.edge;return raw;
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
const DECK_H=1.0,WALL_H={ctr:1.05,cmd:0.85,pylon:1.0,lander:0.75,cliff:1.8,crate:0.85};
const h2=(x,y)=>{const v=Math.sin(x*12.9898+y*78.233)*43758.5453;return v-Math.floor(v);};
const CTRC=['#4a5c75','#6d5543','#4e6a5d','#5b5f78'];
function wallKit(k,glow,pulse,anims,wl){
 const [x,y,w,h,st]=wl,cx=x+w/2,cz=y+h/2,H=WALL_H[st]||1;
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
function craterKit(k,cr){
 const [x,y,r]=cr,pts=[];for(const [a,b] of [[0.78,0],[0.9,0.12],[1.02,0.18],[1.14,0.08],[1.28,0]])pts.push(new THREE.Vector2(r*a,b));
 put(k,new THREE.LatheGeometry(pts,18),'#3b4250',[x,0,y]);
}
// ground: the lunar surface painted once per map (regolith, team pads, crater bowls, soft shadows under everything)
function groundTex(M,ppu){
 const cv=document.createElement('canvas');cv.width=W*ppu;cv.height=H*ppu;const c=cv.getContext('2d'),u=ppu;
 const gr=c.createLinearGradient(0,0,0,cv.height);gr.addColorStop(0,'#363b47');gr.addColorStop(0.5,'#3c414d');gr.addColorStop(1,'#363b47');c.fillStyle=gr;c.fillRect(0,0,cv.width,cv.height);
 let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647;};
 for(let i=0;i<W*H*3;i++){const x=rnd()*cv.width,y=rnd()*cv.height,rr=(0.04+rnd()*0.22)*u,l=rnd();c.fillStyle=l<0.5?'rgba(20,24,32,'+(0.12+rnd()*0.18)+')':'rgba(190,200,215,'+(0.04+rnd()*0.08)+')';c.beginPath();c.arc(x,y,rr,0,7);c.fill();}
 for(let i=0;i<26;i++){const x=rnd()*cv.width,y=rnd()*cv.height,rr=(0.25+rnd()*0.6)*u;c.strokeStyle='rgba(15,18,25,.35)';c.lineWidth=Math.max(1,u*0.06);c.beginPath();c.arc(x,y,rr,0,7);c.stroke();c.strokeStyle='rgba(210,220,235,.12)';c.beginPath();c.arc(x-u*0.04,y-u*0.04,rr,Math.PI,Math.PI*1.6);c.stroke();}
 c.strokeStyle='rgba(120,135,160,.10)';c.lineWidth=1;c.beginPath();for(let i=0;i<=W;i+=2){c.moveTo(i*u,0);c.lineTo(i*u,cv.height);}for(let j=0;j<=H;j+=2){c.moveTo(0,j*u);c.lineTo(cv.width,j*u);}c.stroke();
 const pad=(y0,col)=>{c.fillStyle=col.replace('A','0.06');c.fillRect(0,y0*u,cv.width,5*u);c.strokeStyle=col.replace('A','0.3');c.lineWidth=Math.max(2,u*0.08);c.beginPath();c.moveTo(0,(y0?y0:5)*u);c.lineTo(cv.width,(y0?y0:5)*u);c.stroke();
  c.strokeStyle=col.replace('A','0.16');c.lineWidth=Math.max(1,u*0.04);for(let x=0.5;x<W;x+=1.5){c.beginPath();c.moveTo(x*u,(y0+1)*u);c.lineTo((x+0.6)*u,(y0+4)*u);c.stroke();}};
 pad(0,'rgba(255,77,94,A)');pad(H-5,'rgba(77,159,255,A)');
 c.save();c.filter='blur('+Math.round(u*0.25)+'px)';c.fillStyle='rgba(5,8,14,.55)';
 for(const [x,y,w,h,st] of M.walls||[]){const e=(WALL_H[st]||1)*0.45;c.fillRect((x+e*0.5)*u,(y+e*0.7)*u,w*u,h*u);}
 for(const [x,y,w,h] of M.crates||[])c.fillRect((x+0.3)*u,(y+0.4)*u,w*u,h*u);
 for(const [x,y,r] of M.rocks||[]){c.beginPath();c.ellipse((x+0.3)*u,(y+0.4)*u,r*1.05*u,r*0.95*u,0,0,7);c.fill();}
 if(M.bridge){const [dx,dy,dw,dh]=M.bridge.deck;c.fillRect((dx+0.3)*u,(dy+0.6)*u,dw*u,dh*u);}
 c.restore();
 for(const [x,y,r] of M.craters||[]){const g=c.createRadialGradient((x-r*0.2)*u,(y+r*0.2)*u,r*0.1*u,x*u,y*u,r*u);g.addColorStop(0,'#14181f');g.addColorStop(0.7,'#1c212a');g.addColorStop(1,'#2a303b');c.fillStyle=g;c.beginPath();c.arc(x*u,y*u,r*0.8*u,0,7);c.fill();}
 const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;return t;
}
// the whole map: one static mesh per material, the bridge deck on its own (it fades when you drive under it), a few spinning pylons
// Exact existing bridge topology shared by legacy and optional environment skins.
function bridgeGeometry(k,glow,G,mats,BRd){
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
 for(const cr of Md.craters||[])craterKit(k,cr);
 const deck=bridgeGeometry(k,glow,G,mats,Md.bridge);
 const S=bake(k),Gw=bake(glow),Pl=bake(pulse);
 if(S.lit)G.add(new THREE.Mesh(S.lit,mats.lit));if(S.shine)G.add(new THREE.Mesh(S.shine,mats.shine));
 for(const gg of [Gw.lit,Gw.glow])if(gg)G.add(new THREE.Mesh(gg,mats.glow));
 let pulseMesh=null;if(Pl.lit){pulseMesh=new THREE.Mesh(Pl.lit,mats.pulse);G.add(pulseMesh);}
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshLambertMaterial({map:groundTex(Md,q==='low'?20:32)}));
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
return {famChassis,famTools,bridgeVisual,foundationChassis,foundationWeapon,MOON_SCALE,weaponScale,VISUAL_VERSION,CHASSIS_VISUALS,WEAPON_VISUALS,visualTier,fittingKit,kit,put,bake,merge,loft,palette,chassisKit,weaponKit,bossKit,crateKit,gemKit,buildMap,meshOf,crateGeo,starGeo,trackGeo,hexMul,hexMix,DECK_H,WALL_H,TIERC,shapes:{B,CY,SP,CO,OC,IC,TO}};
})();
