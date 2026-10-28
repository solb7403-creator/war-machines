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
 let g=geo.index?geo.toNonIndexed():geo;if(g!==geo)geo.dispose();
 if(g.attributes.uv)g.deleteAttribute('uv');if(g.attributes.normal)g.deleteAttribute('normal');
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
 const P=new Float32Array(n*3),C=new Float32Array(n*3);let o=0;
 for(const g of list){P.set(g.attributes.position.array,o);C.set(g.attributes.color.array,o);o+=g.attributes.position.count*3;g.dispose();}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));
 g.computeVertexNormals();g.computeBoundingSphere();return g;
}
const bake=k=>({lit:merge(k.lit),shine:merge(k.shine),glow:merge(k.glow)});
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
 if(lunar)return {hull:'#dfe6f0',hull2:'#c4cedc',tur:'#e9eef6',tur2:'#cdd6e3',trim:'#9fd8ff',dark:'#26303e',metal:'#8f9bad',track:'#1c2430',light:'#ffffff',team:LEG,acc:'#bfe6ff',shine:true,lunar:true};
 const k=P.hull==='#07080d'||P.hull==='#17131f'?2.1:P.hull==='#a9b6c8'||P.hull==='#aab2c0'?1.05:1.7;
 return {hull:hexMul(P.hull,k),hull2:hexMul(P.hull,k*0.82),tur:hexMul(P.tur,k),tur2:hexMul(P.tur,k*0.8),trim:P.trim,dark:'#262f3b',metal:'#76818f',track:'#171d25',light:'#e9f1f7',team:team||'#4d9fff',acc:CH[cls]?CH[cls].c:'#3fd0c9',shine:!!P.shine};
}
const PM=C=>C.shine?'shine':'lit';   // metallic paints go on the shiny material

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
function chassisKit(cls,tier,P,team,gems,lunar){
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
  if(tier<2){
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
 if(lunar){   // LEGENDARY Lunar skin: pearl armor, crescent fins, hover halo, an orbiting moon
  sym(s=>{put(k,crescentGeo(0.55,0.05),GOLD,[-0.35,M.ty+0.1,s*(cls==='titan'?0.8:0.64)],[s*0.25,0,0.55],null,'shine');
   put(k,B(1.2,0.025,0.025),'#9fd8ff',[0,M.ty-0.02,s*0.4],null,null,'glow');});
  put(k,TO(1.18,0.035,4,28),'#bfe6ff',[0,0.07,0],[Math.PI/2,0,0],null,'glow');
  put(k,SP(0.13,10,7),'#ffffff',[-0.95,M.ty+0.12,0],null,null,'glow');
  const mo=kit();put(mo,SP(0.09,8,6),'#ffffff',[1.35,0,0],null,null,'glow');put(mo,TO(0.13,0.012,3,12),GOLD,[1.35,0,0],[Math.PI/2,0,0],null,'glow');
  A.push({k:mo,p:[0,M.ty+0.35,0],axis:'y',spd:1.4,orb:1});
  M.halos.push([-0.95,M.ty+0.12,0,'#bfe6ff',0.9],[0,0.07,0,'#9fd8ff',0.4]);
  M.bob=Math.max(M.bob,0.035);M.tc='#cfeaff';
  if(!M.trail.length)sym(s=>M.trail.push([-1.05,0.4,s*0.4]));
 }
 return {k,anims:A,meta:M};
}

// ---------- weapons (the turret): origin = turret ring, barrel along +x ----------
function weaponKit(arch,tier,P,team,lunar,cls){
 const k=kit(),A=[],C=palette(P,team,cls,lunar),rc=TIERC[tier],M={tips:[],halos:[]},pm=PM(C);
 const wc=WEAPONS[arch]?WEAPONS[arch].c:'#3fd0c9';
 const core=(x,y)=>{put(k,OC(0.11),C.team,[x,y,0],null,[1,1.3,1],'glow');M.halos.push([x,y,0,C.team,0.35]);};
 if(arch==='moon'){   // LEGENDARY Moonbeam, the Tide Engine: three crystal barrels bound by gold rings, a full moon held above on a gold arm
  const P0='#e6ecf5',PD='#c9d3e2',ICE='#bfe6ff',WH='#f4fbff';
  put(k,CY(0.5,0.58,0.28,12),P0,[0,0.14,0],null,null,'shine');put(k,TO(0.54,0.035,4,24),GOLD,[0,0.28,0],[Math.PI/2,0,0],null,'shine');
  put(k,SP(0.42,14,10),PD,[0,0.6,0],null,[1.25,0.85,1],'shine');
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/2,y=0.6+Math.sin(a)*0.18,z=Math.cos(a)*0.18;
   put(k,CY(0.08,0.1,1.9,8),P0,[1.15,y,z],[0,0,Math.PI/2],null,'shine');put(k,OC(0.1),ICE,[2.15,y,z],null,[2.2,1,1],'glow');
   M.tips.push([2.32,y,z]);M.halos.push([2.2,y,z,ICE,0.7]);}
  put(k,B(0.09,0.5,0.09),GOLD,[-0.18,0.92,0],[0,0,-0.35],null,'shine');
  // the gold rings turn slowly around the barrels; the moon above pulses and its ring spins
  for(const x of[0.65,1.2,1.75]){const r=kit();put(r,TO(0.32,0.05,6,20),GOLD,[0,0,0],[0,Math.PI/2,0],null,'shine');for(let q=0;q<3;q++){const a=q/3*Math.PI*2;put(r,OC(0.045),ICE,[0,Math.cos(a)*0.32,Math.sin(a)*0.32],null,null,'glow');}A.push({k:r,p:[x,0.6,0],axis:'x',spd:x===1.2?-1.4:1.4});}
  const mo=kit();put(mo,SP(0.26,16,12),WH,[0,0,0],null,null,'glow');A.push({k:mo,p:[0,1.2,0],type:'pulse',spd:2.2});
  const mr=kit();put(mr,TO(0.36,0.03,6,24),GOLD,[0,0,0],[Math.PI/2.4,0,0],null,'shine');A.push({k:mr,p:[0,1.2,0],axis:'y',spd:1.6});
  M.halos.push([0,1.2,0,'#e8f4ff',1.4]);
  return {k,anims:A,meta:M};
 }
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
  if(tier<2){
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
function buildMap(id,mats,q){
 const Md=MAPS[id]||MAPS.classic,k=kit(),glow=kit(),pulse=kit(),anims=[];
 const G=new THREE.Group();
 // the arena slab: regolith on top, rock sides, trim lights along the edges
 put(k,B(W+0.6,2.2,H+0.6),'#22262f',[W/2,-1.1,H/2]);
 for(const [x0,z0,w,d] of [[W/2,-0.3,W+0.6,0.04],[W/2,H+0.3,W+0.6,0.04]])put(glow,B(w,0.04,d),z0<0?'#ff4d5e':'#4d9fff',[x0,0.02,z0]);
 sym(s=>put(glow,B(0.04,0.04,H+0.6),'#59607a',[W/2+s*(W/2+0.3),0.02,H/2]));
 for(const wl of Md.walls||[])wallKit(k,glow,pulse,anims,wl);
 for(const rk of Md.rocks||[])rockKit(k,glow,rk);
 for(const cr of Md.craters||[])craterKit(k,cr);
 let deck=null;
 const BRd=Md.bridge;
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
 if(b.lit)g.add(new THREE.Mesh(b.lit,m.lit));if(b.shine)g.add(new THREE.Mesh(b.shine,m.shine));if(b.glow)g.add(new THREE.Mesh(b.glow,m.glow));
 return g;
}
function crateGeo(){const k=kit();
 put(k,B(1,1,1),'#7a5530',[0,0.5,0]);
 for(const [w,h,d,x,y,z] of [[1.04,0.08,0.08,0,0.04,0.48],[1.04,0.08,0.08,0,0.96,0.48],[1.04,0.08,0.08,0,0.04,-0.48],[1.04,0.08,0.08,0,0.96,-0.48],[0.08,1,0.08,0.48,0.5,0.48],[0.08,1,0.08,-0.48,0.5,0.48],[0.08,1,0.08,0.48,0.5,-0.48],[0.08,1,0.08,-0.48,0.5,-0.48],[0.08,0.08,1.04,0.48,0.96,0],[0.08,0.08,1.04,-0.48,0.96,0],[0.08,0.08,1.04,0.48,0.04,0],[0.08,0.08,1.04,-0.48,0.04,0]])put(k,B(w,h,d),'#b08a5a',[x,y,z]);
 put(k,B(1.2,0.06,0.06),'#b08a5a',[0,0.5,0.51],[0,0,0.75]);put(k,B(1.2,0.06,0.06),'#b08a5a',[0,0.5,0.51],[0,0,-0.75]);
 return bake(k);}
// Bounded fitting geometry, merged into the existing material buckets; no collision changes.
function fittingKit(f,team,part){
 const k=kit(),steel='#91a1b3';
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
return {fittingKit,kit,put,bake,merge,loft,palette,chassisKit,weaponKit,bossKit,crateKit,gemKit,buildMap,meshOf,crateGeo,starGeo,trackGeo,hexMul,hexMix,DECK_H,WALL_H,TIERC,shapes:{B,CY,SP,CO,OC,IC,TO}};
})();
