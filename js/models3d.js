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
const CHASSIS_VISUALS={
 scout:[
  {len:1.94,trackZ:.64,trackW:.27,h:.36,deck:.47,ring:.56,armor:0,shape:'dart',wheels:4},
  {len:2.05,trackZ:.69,trackW:.29,h:.38,deck:.49,ring:.59,armor:1,shape:'split',wheels:4},
  {len:2.16,trackZ:.72,trackW:.30,h:.39,deck:.51,ring:.62,armor:2,shape:'outrigger',wheels:5}],
 vanguard:[
  {len:2.61,trackZ:.91,trackW:.38,h:.48,deck:.66,ring:.777,armor:0,shape:'defender',wheels:7},
  {len:2.55,trackZ:.90,trackW:.36,h:.46,deck:.63,ring:.74,armor:1,shape:'wedge',wheels:6},
  {len:2.64,trackZ:.94,trackW:.38,h:.48,deck:.68,ring:.80,armor:2,shape:'citadel',wheels:6}],
 titan:[
  {len:2.58,trackZ:.98,trackW:.42,h:.55,deck:.68,ring:.82,armor:0,shape:'bulwark',wheels:6},
  {len:2.68,trackZ:1.01,trackW:.44,h:.56,deck:.72,ring:.86,armor:1,shape:'ram',wheels:6},
  {len:2.78,trackZ:1.04,trackW:.44,h:.56,deck:.77,ring:.91,armor:2,shape:'four-pod',wheels:6}]
};
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
function standardChassis(cls,tier,P,team,gems,lunar=false){
 const o=CHASSIS_VISUALS[cls][tier],k=kit(),A=[],C=palette(P,team,cls,lunar),F=defenderFinish(C),M={ty:o.ring,halos:[],trail:[],tc:F.amber,bob:0,visual:VISUAL_VERSION};
 if(o.shape==='defender'){defenderChassis(k,C,gems,M,PM(C));return {k,anims:A,meta:M};}
 const scout=cls==='scout',titan=cls==='titan',width=scout?.38:titan?.66:.53,half=o.len/2-.10;
 const bp=[[-half,-width],[half*.52,-width],[half*.88,-width*.64],[half,0],[half*.88,width*.64],[half*.52,width],[-half,width]];
 const tp=sc(bp,scout?.88:.89,scout?.73:.82,-.06);
 put(k,loft(bp,tp,.24,o.deck-.05),F.body,null,null,null,'shine');
 armorPart(k,sc(tp,.94,.93,-.025),o.deck-.05,.07,F.plate);
 sym(side=>{
  if(o.shape==='four-pod'||o.shape==='outrigger')for(const x of (scout?[-.59,.59]:[-.70,.70]))trackAssembly(k,F,{len:scout?1.02:1.26,h:o.h,w:o.trackW,z:side*(o.trackZ+(scout&&x<0?.06:0)),center:x,wheels:3});
  else trackAssembly(k,F,{len:o.len,h:o.h,w:o.trackW,z:side*o.trackZ,wheels:o.wheels});
  // Chassis-specific fenders: narrow Scout rails, layered Vanguard scales, deep Titan shoulder armor.
  const inside=o.trackZ-o.trackW*.42,outside=o.trackZ+o.trackW*.43;
  armorPart(k,[[-half,side*inside],[half*.79,side*inside],[half*.90,side*(inside+.07)],[half*.74,side*outside],[-half,side*outside]],o.h+.045,titan?.12:.065,F.body);
  const count=scout?2:3;
  for(let i=0;i<count;i++){
   const x=-half*.86+i*(o.len*.68/count),length=o.len*.53/count;
   armorPart(k,[[x,side*(inside+.035)],[x+length,side*(inside+.01)],[x+length+.09,side*(outside-.02)],[x+.03,side*outside]],o.h+.10,.04,F.plate,.012);
   put(k,B(length*.57,.014,.023),F.edge,[x+length*.5,o.h+.154,side*(outside-.035)],null,null,'shine');
  }
  put(k,B(.22,.02,.036),C.team,[.26,o.h+.17,side*(inside+.06)],null,null,'glow');
  put(k,B(.035,.065,.17),F.recess,[half*.85,o.h*.8,side*o.trackZ]);
  put(k,B(.04,.025,.08),F.ice,[half*.87,o.h*.8,side*o.trackZ],null,null,'glow');M.halos.push([half*.87,o.h*.8,side*o.trackZ,F.ice,.14]);
  ventBank(k,F,-half*.70,o.deck+.04,side*width*.58,scout?4:6);
  put(k,B(.02,.025,.12),'#b84827',[-half-.02,o.h*.8,side*o.trackZ],null,null,'glow');
  if(tier){
   // Explicit silhouette progression: split sensor shoulders, stepped armor and frontal rams.
   const y=o.deck+.04,xa=scout?-.65:-.45,za=scout?.39:titan?.71:.57;
   armorPart(k,[[xa,side*za],[xa+.44,side*(za-.06)],[xa+.62,side*(za+.08)],[xa+.02,side*(za+.16)]],y,.05+tier*.015,F.body);
   put(k,B(.24,.022,.022),lunar?F.edge:TIERC[tier],[xa+.24,y+.12,side*(za+.12)],null,null,'shine');
   if(scout)sensorBlock(k,F,xa+.10,y+.07,side*za,C.team);
   else armorPart(k,[[half*.52,side*.24],[half*1.02,side*.33],[half*.96,side*.70],[half*.54,side*.63]],.24,.13+tier*.04,F.plate);
  }
  if(tier===2){
   // Epic Scout: swept rear stabilizer rails; Vanguard: armored cooling banks; Titan: pod bridges.
   const x=scout?-.85:-.65,z=scout?.58:titan?.91:.72;
   armorPart(k,[[x-.24,side*(z-.10)],[x+.30,side*(z-.08)],[x+.46,side*(z+.16)],[x-.34,side*(z+.20)]],o.deck+.08,.075,F.plate);
   ventBank(k,F,x+.02,o.deck+.13,side*z,5);
   put(k,B(.32,.018,.025),F.amber,[x,o.deck+.20,side*(z+.12)],null,null,'shine');
  }
 });
 // Class/tier authored modules add different silhouettes, not recolored copies.
 if(scout&&tier===1){
  sym(s=>armorPart(k,[[-.94,s*.31],[-.42,s*.34],[-.35,s*.66],[-1.01,s*.68]],o.deck+.045,.075,F.body));
  armorPart(k,[[.10,-.09],[1.00,-.055],[1.08,0],[1.00,.055],[.10,.09]],o.deck+.015,.06,F.plate,.014);
 }
 if(scout&&tier===2){
  sym(s=>{put(k,B(.45,.055,.07),F.steel,[-.39,.35,s*.49],[0,s*.25,0],null,'shine');armorPart(k,[[-.92,s*.35],[-.49,s*.31],[-.38,s*.72],[-1.08,s*.80]],o.deck+.02,.055,F.plate,.014);});
 }
 if(cls==='vanguard'&&tier===2){
  sym(s=>{armorPart(k,[[.38,s*.59],[.83,s*.65],[.91,s*.93],[.33,s*.98]],.58,.16,F.plate);ventBank(k,F,.61,.758,s*.78,5);});
 }
 if(titan&&tier===1){
  put(k,loft([[1.02,-.96],[1.42,-.85],[1.42,.85],[1.02,.96]],[[1.03,-.91],[1.26,-.78],[1.26,.78],[1.03,.91]],.15,.51),F.plate,null,null,null,'shine');
  put(k,B(.035,.035,1.50),F.edge,[1.35,.27,0],null,null,'shine');
 }
 if(titan&&tier===2){
  sym(s=>{for(const x of [-.68,.67])armorPart(k,[[x-.27,s*.71],[x+.26,s*.72],[x+.32,s*1.16],[x-.32,s*1.16]],.58,.18,F.plate);});
  armorPart(k,[[-1.12,-.40],[-.78,-.40],[-.78,.40],[-1.12,.40]],.76,.13,F.body);
 }
 if(titan){
  // Broad beveled glacis and functional tow eyes emphasize mass rather than just scaling.
  armorPart(k,[[.50,-.47],[half,-.36],[half+.08,0],[half,.36],[.50,.47]],.30,.16+tier*.025,F.plate);
  sym(s=>put(k,TO(.075,.02,4,12),F.steel,[half,.30,s*.46],[0,Math.PI/2,0],null,'shine'));
 }else if(scout){
  armorPart(k,[[.10,-.16],[half*.75,-.11],[half*.93,0],[half*.75,.11],[.10,.16]],o.deck,.04,F.body,.012);
  sensorBlock(k,F,-.76,o.deck+.06,-.16,C.team);
 }else{
  sym(s=>armorPart(k,[[.26,s*.055],[half*.92,s*.03],[half*.98,s*.18],[.50,s*.34]],o.deck-.015,.05,F.body,.012));
 }
 mountSocket(k,F,o.ring);cores(k,C,gems,-.90,o.deck+.05,[-.25,0,.25]);
 if(tier===2)sensorBlock(k,F,-.90,o.deck+.10,o.trackZ,C.team);
 return {k,anims:A,meta:M};
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
   if(f.hull==='plates')sym(s=>put(k,B(.85,.08,.14),steel,[-.13,o.h+.22,s*(o.trackZ-.02)]));
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
return {bridgeVisual,foundationChassis,foundationWeapon,MOON_SCALE,weaponScale,VISUAL_VERSION,CHASSIS_VISUALS,WEAPON_VISUALS,visualTier,fittingKit,kit,put,bake,merge,loft,palette,chassisKit,weaponKit,bossKit,crateKit,gemKit,buildMap,meshOf,crateGeo,starGeo,trackGeo,hexMul,hexMix,DECK_H,WALL_H,TIERC,shapes:{B,CY,SP,CO,OC,IC,TO}};
})();
