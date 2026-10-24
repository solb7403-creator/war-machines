// LEGENDARY WEAPON DESIGNS ON HOLD (Oct 23, 2026), for future legendary weapons. Not loaded by the game.
// Built with the game's own model kit (M3: kit, put, bake, meshOf, shapes), in the same units as js/models3d.js
// weaponKit(): x forward from the turret, y up. To ship one, move its builder into weaponKit() as its own arch,
// keep `tip` as M.tips, add anims (rings, orbs) the way the Moonbeam does, and give its super an impact (firing()).
//  - railgun: LUNAR RAILGUN. Twin gold rails, a capacitor bank, a crescent crystal riding between the rails.
//    Super: a white-hot beam through a row of rings; impact flash, gold blast ring, shards.
//    Sound idea: a rising electric whine, a sharp crack, a deep bass boom.
//  - eclipse: ECLIPSE CANNON. Armored breech, a giant eclipse ring at the muzzle (black moon disc, burning corona).
//    Super: a thick black beam edged in light; impact a dark dome with a blue shockwave.
//    Sound idea: a low suction hum, a beat of silence, a heavy sub-bass thud.
//  - combo: ECLIPSE + RAILGUN + TIDE. Eclipse breech and muzzle ring, twin gold rails, three crystal barrels, the moon.
//  - tide: the TIDE ENGINE, shipped as the Moonbeam (js/models3d.js); kept here for reference.
// Renders: dev/designs/img/. To render again: load the game page, run this file in it, then moonShot(id,'rest'|'fire',w,h).
// three Moonbeam prototypes built with the game's own kit, mounted on the real Lunar-skin tank
(function(){
const {kit,put,bake,meshOf,shapes}=M3,{B,CY,SP,CO,OC,TO}=shapes,G='#ffcf4a',P='#e6ecf5',PD='#c9d3e2',ICE='#bfe6ff',WH='#f4fbff',DK='#1a1f2b';
const sym=f=>{f(-1);f(1);};
function crescent(R,d){const s=new THREE.Shape();s.absarc(0,0,R,-Math.PI*0.45,Math.PI*0.45,false);s.absarc(R*0.38,0,R*0.8,Math.PI*0.37,-Math.PI*0.37,true);const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:10});g.translate(0,0,-d/2);return g;}
// A) LUNAR RAILGUN: two massive gold-edged rails, a capacitor block, a crescent crystal riding between the rails
function railgun(){const k=kit();
 put(k,CY(0.5,0.56,0.26,12),P,[0,0.13,0],null,null,'shine');put(k,TO(0.53,0.035,4,24),G,[0,0.27,0],[Math.PI/2,0,0],null,'shine');
 put(k,B(0.9,0.5,0.8),PD,[-0.15,0.5,0],null,null,'shine');for(let i=0;i<4;i++)put(k,B(0.12,0.3,0.06),ICE,[-0.42+i*0.2,0.52,0.41],null,null,'glow');
 sym(s=>{put(k,B(2.7,0.2,0.14),P,[1.35,0.52,s*0.22],null,null,'shine');put(k,B(2.6,0.04,0.16),G,[1.35,0.64,s*0.22],null,null,'shine');put(k,B(2.5,0.05,0.03),ICE,[1.4,0.52,s*0.145],null,null,'glow');
  put(k,B(0.35,0.3,0.1),G,[2.75,0.52,s*0.26],[0,s*0.35,0],null,'shine');});
 for(const x of[0.6,1.3,2.0])put(k,B(0.12,0.3,0.6),PD,[x,0.52,0],null,null,'shine');
 put(k,crescent(0.26,0.06),ICE,[1.65,0.52,0],[0,Math.PI/2,Math.PI/2],null,'glow');
 put(k,crescent(0.3,0.06),G,[-0.15,0.92,0],[0,Math.PI/2,0],null,'shine');
 return {k,tip:[2.95,0.52,0],len:2.95};}
// B) ECLIPSE CANNON: a heavy armored breech with a giant eclipse ring at the muzzle (a black moon disc with a burning corona)
function eclipse(){const k=kit();
 put(k,CY(0.52,0.6,0.3,12),P,[0,0.15,0],null,null,'shine');put(k,TO(0.56,0.04,4,24),G,[0,0.3,0],[Math.PI/2,0,0],null,'shine');
 put(k,B(1.1,0.62,0.9),PD,[0.05,0.62,0],null,null,'shine');sym(s=>{put(k,B(1.0,0.5,0.12),P,[0.1,0.62,s*0.5],[s*0.12,0,0],null,'shine');put(k,crescent(0.28,0.05),G,[0.05,0.66,s*0.58],[0,0,0],null,'shine');});
 put(k,CY(0.2,0.24,1.3,14),P,[1.1,0.62,0],[0,0,Math.PI/2],null,'shine');for(let i=0;i<3;i++)put(k,TO(0.25,0.04,6,18),G,[0.75+i*0.3,0.62,0],[0,Math.PI/2,0],null,'shine');
 put(k,TO(0.62,0.09,8,40),G,[1.85,0.62,0],[0,Math.PI/2,0],null,'shine');put(k,CY(0.56,0.56,0.06,40),DK,[1.88,0.62,0],[0,0,Math.PI/2],null,'shine');
 put(k,TO(0.68,0.03,6,40),ICE,[1.9,0.62,0],[0,Math.PI/2,0],null,'glow');for(let i=0;i<8;i++){const a=i/8*Math.PI*2;put(k,OC(0.06),WH,[1.9,0.62+Math.cos(a)*0.78,Math.sin(a)*0.78],null,[1,2,1],'glow');}
 return {k,tip:[1.95,0.62,0],len:2.0};}
// C) TIDE ENGINE: three long crystal barrels in a triangle, bound by gold rings, and a full moon held above on a gold arm
function tide(){const k=kit();
 put(k,CY(0.5,0.58,0.28,12),P,[0,0.14,0],null,null,'shine');put(k,TO(0.54,0.035,4,24),G,[0,0.28,0],[Math.PI/2,0,0],null,'shine');
 put(k,SP(0.42,14,10),PD,[0,0.6,0],null,[1.25,0.85,1],'shine');
 for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/2,y=0.6+Math.sin(a)*0.18,z=Math.cos(a)*0.18;put(k,CY(0.08,0.1,2.2,8),P,[1.3,y,z],[0,0,Math.PI/2],null,'shine');put(k,OC(0.1),ICE,[2.45,y,z],null,[2.2,1,1],'glow');}
 for(const x of[0.7,1.35,2.0])put(k,TO(0.32,0.05,6,20),G,[x,0.6,0],[0,Math.PI/2,0],null,'shine');
 put(k,B(0.1,0.7,0.1),G,[-0.25,1.0,0],[0,0,-0.35],null,'shine');put(k,SP(0.3,16,12),WH,[0.0,1.42,0],null,null,'glow');put(k,TO(0.4,0.03,6,24),G,[0.0,1.42,0],[Math.PI/2.4,0,0],null,'shine');
 return {k,tip:[2.65,0.6,0],len:2.7};}
// D) COMBINED: the Eclipse breech and muzzle ring, the Railgun's twin gold rails, the Tide's three crystal barrels and its moon
function combo(){const k=kit();
 put(k,CY(0.52,0.6,0.3,12),P,[0,0.15,0],null,null,'shine');put(k,TO(0.56,0.04,4,24),G,[0,0.3,0],[Math.PI/2,0,0],null,'shine');
 put(k,B(1.0,0.6,0.86),PD,[-0.1,0.62,0],null,null,'shine');for(let i=0;i<4;i++)put(k,B(0.12,0.3,0.06),ICE,[-0.42+i*0.2,0.64,0.44],null,null,'glow');
 sym(s=>{put(k,crescent(0.28,0.05),G,[-0.1,0.66,s*0.5],null,null,'shine');put(k,B(2.2,0.18,0.12),P,[1.4,0.62,s*0.34],null,null,'shine');put(k,B(2.1,0.04,0.14),G,[1.4,0.73,s*0.34],null,null,'shine');put(k,B(2.0,0.04,0.03),ICE,[1.45,0.62,s*0.27],null,null,'glow');});
 for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/2,y=0.62+Math.sin(a)*0.15,z=Math.cos(a)*0.15;put(k,CY(0.07,0.09,2.0,8),P,[1.35,y,z],[0,0,Math.PI/2],null,'shine');put(k,OC(0.09),ICE,[2.4,y,z],null,[1.8,1,1],'glow');}
 for(const x of[0.75,1.35,1.95])put(k,TO(0.3,0.05,6,20),G,[x,0.62,0],[0,Math.PI/2,0],null,'shine');
 put(k,TO(0.6,0.09,8,40),G,[2.55,0.62,0],[0,Math.PI/2,0],null,'shine');put(k,CY(0.5,0.5,0.05,40),DK,[2.58,0.62,0],[0,0,Math.PI/2],null,'shine');
 put(k,TO(0.66,0.03,6,40),ICE,[2.6,0.62,0],[0,Math.PI/2,0],null,'glow');for(let i=0;i<8;i++){const a=i/8*Math.PI*2;put(k,OC(0.055),WH,[2.6,0.62+Math.cos(a)*0.76,Math.sin(a)*0.76],null,[1,2,1],'glow');}
 put(k,B(0.1,0.7,0.1),G,[-0.35,1.1,0],[0,0,-0.35],null,'shine');put(k,SP(0.28,16,12),WH,[-0.1,1.5,0],null,null,'glow');put(k,TO(0.38,0.03,6,24),G,[-0.1,1.5,0],[Math.PI/2.4,0,0],null,'shine');
 return {k,tip:[2.65,0.62,0],len:2.7};}
const W={railgun,eclipse,tide,combo};
// the super firing: beam to an impact point, and the impact explosion (each weapon its own)
function firing(id,tip){const k=kit(),X=7.4,y=tip[1];
 if(id==='railgun'){put(k,B(X-tip[0],0.08,0.08),WH,[(tip[0]+X)/2,y,0],null,null,'glow');put(k,B(X-tip[0],0.2,0.2),ICE,[(tip[0]+X)/2,y,0],null,null,'glow');
  for(let i=0;i<5;i++)put(k,TO(0.25,0.02,4,16),ICE,[tip[0]+0.6+i*0.9,y,0],[0,Math.PI/2,0],null,'glow');}
 if(id==='eclipse'){put(k,CY(0.32,0.38,X-tip[0],16),DK,[(tip[0]+X)/2,y,0],[0,0,Math.PI/2],null,'shine');put(k,CY(0.42,0.46,X-tip[0],16),ICE,[(tip[0]+X)/2+0.02,y,0],[0,0,Math.PI/2],[1,1,0.15],'glow');}
 if(id==='combo'){put(k,CY(0.3,0.36,X-tip[0],16),DK,[(tip[0]+X)/2,y,0],[0,0,Math.PI/2],null,'shine');for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/2;put(k,B(X-tip[0],0.06,0.06),ICE,[(tip[0]+X)/2,y+Math.sin(a)*0.4,Math.cos(a)*0.4],null,null,'glow');}for(let i=0;i<4;i++)put(k,TO(0.45,0.025,4,20),ICE,[tip[0]+0.8+i*1.0,y,0],[0,Math.PI/2,0],null,'glow');}
 if(id==='tide'){for(let i=0;i<3;i++){const a=i/3*Math.PI*2+Math.PI/2;put(k,B(X-tip[0],0.06,0.06),ICE,[(tip[0]+X)/2,y+Math.sin(a)*0.12,Math.cos(a)*0.12],null,null,'glow');}}
 // impact: ground blast ring, a core flash, shards thrown out, and (eclipse) a dark dome; (tide) a rising pillar
 const gy=-0.85;put(k,TO(1.1,0.1,6,40),id==='eclipse'?'#7fa6ff':G,[X,gy+0.05,0],[Math.PI/2,0,0],null,'glow');put(k,TO(1.7,0.05,6,48),WH,[X,gy+0.04,0],[Math.PI/2,0,0],null,'glow');
 const dk=id==='eclipse'||id==='combo';put(k,SP(dk?0.9:0.7,18,14),dk?DK:WH,[X,gy+0.5,0],null,[1,0.8,1],dk?'shine':'glow');
 if(dk)put(k,TO(0.95,0.08,8,40),'#9fd8ff',[X,gy+0.5,0],[Math.PI/2,0,0],null,'glow');
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2;put(k,OC(0.09),i%2?G:ICE,[X+Math.cos(a)*1.3,gy+0.4+(i%3)*0.35,Math.sin(a)*1.3],null,[1,2.4,1],'glow');}
 if(id==='tide'||id==='combo'){put(k,CY(0.3,0.5,3.2,16),ICE,[X,gy+1.6,0],null,[1,1,1],'glow');put(k,SP(0.4,14,10),WH,[X,gy+3.3,0],null,null,'glow');}
 return k;}
window.moonShot=(id,mode,w,h)=>{
 const A=artR(),sp=mySpec({lunar:true,team:'#e8f4ff',paint:'stock',arch:'moon',wt:2,cls:'vanguard',ct:2}),T=buildTank(sp,A.mats);
 while(T.tg.children.length)T.tg.remove(T.tg.children[0]);
 const wp=W[id]();T.tg.add(meshOf(bake(wp.k),null,A.mats));
 T.hull.rotation.y=0;T.tur.rotation.y=0;
 const halos=[];
 if(mode==='fire'){const f=meshOf(bake(firing(id,wp.tip)),null,A.mats);T.tg.add(f);
  T.g.updateMatrixWorld(true);const v=new THREE.Vector3(7.4,-0.35,0);T.tg.localToWorld(v);halos.push([v.clone(),'#ffffff',6],[v.clone(),'#bfe6ff',9]);
  const m=new THREE.Vector3(wp.tip[0],wp.tip[1],0);T.tg.localToWorld(m);halos.push([m,'#e8f4ff',3]);}
 const c=document.createElement('canvas');c.width=w*dpr;c.height=h*dpr;const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.fillStyle='#0a0e17';ctx.fillRect(0,0,w,h);
 if(mode==='fire')artShot(ctx,w,h,T.g,{r:4.0,el:0.62,az:1.15,cx:4.1,cy:-0.2},halos);
 else artShot(ctx,w,h,T.g,{r:1.7,el:0.4,az:0.85,cx:0.8,cy:1.15},halos);
 return c.toDataURL('image/png');};
})();
