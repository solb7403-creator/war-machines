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
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function hash(x,z){let n=Math.imul(x^SEED,374761393)^Math.imul(z,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967295;}
function noise(x,z,s){x/=s;z/=s;let i=Math.floor(x),j=Math.floor(z),u=smooth(x-i),v=smooth(z-j);return mix(mix(hash(i,j),hash(i+1,j),u),mix(hash(i,j+1),hash(i+1,j+1),u),v);}
function heightAt(x,z){
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
// Bounded fine-grid cache amortizes collision/AI ray samples; canonical terrain remains unchanged.
const gridCache=new Map();
function gridHeight(x,z){const k=x+':'+z;if(gridCache.has(k))return gridCache.get(k);const h=heightAt(x,z);if(gridCache.size>=16384)gridCache.delete(gridCache.keys().next().value);gridCache.set(k,h);return h;}
// Exact piecewise triangle interpolation matches the fine rendered ground, including at edges.
function groundAt(x,z){const a=Math.floor(x/STEP)*STEP,b=Math.floor(z/STEP)*STEP,u=(x-a)/STEP,v=(z-b)/STEP,h=gridHeight(a,b),e=gridHeight(a+STEP,b),n=gridHeight(a,b+STEP),ne=gridHeight(a+STEP,b+STEP);return u+v<=1?h+(e-h)*u+(n-h)*v:ne+(n-ne)*(1-u)+(e-ne)*(1-v);}
function surfaceNormal(x,z){const a=Math.floor(x/STEP)*STEP,b=Math.floor(z/STEP)*STEP,u=(x-a)/STEP,v=(z-b)/STEP,h=gridHeight(a,b),e=gridHeight(a+STEP,b),n=gridHeight(a,b+STEP),ne=gridHeight(a+STEP,b+STEP);const dx=(u+v<=1?e-h:ne-n)/STEP,dz=(u+v<=1?n-h:ne-e)/STEP,l=Math.hypot(dx,1,dz);return [-dx/l,1/l,-dz/l];}
function normalAt(x,z){const dx=(heightAt(x+.5,z)-heightAt(x-.5,z)),dz=(heightAt(x,z+.5)-heightAt(x,z-.5)),l=Math.hypot(dx,1,dz);return [-dx/l,1/l,-dz/l];}
function biomeAt(x,z){if(Math.hypot(x-1150,z-1080)<130||noise(x,z,3400)>.65)return 'terraformed';return noise(x,z,1500)>.54?'massif':'wasteland';}
function deckAt(x,z){if(x<900||x>1140||Math.abs(z-1024)>9)return null;return x<960?mix(groundAt(900,z),24,(x-900)/60):x>1080?mix(24,groundAt(1140,z),(x-1080)/60):24;}
function surfacesAt(x,z){const a=[{id:'ground',y:groundAt(x,z)}],y=deckAt(x,z);if(y!==null)a.push({id:'bridge',y});return a;}
function structureSolidAt(x,z){if(installations.some(b=>Math.abs(x-b.x)<11&&Math.abs(z-b.z-8)<8||Math.hypot(x-b.x-14,z-b.z-10)<2))return true;for(let i=0;i<3;i++)if(Math.hypot(x-(1150+i*30),z-1080)<12)return true;for(let i=0;i<9;i++)if(Math.hypot(x-(1110+i%3*22),z-(1148+Math.floor(i/3)*25))<7.8)return true;return false;}
// Match the deterministic rendered boulders. Cache bounded chunk descriptors, not meshes.
const rockCache=new Map();
function rocksNear(x,z){const out=[],cx=Math.floor(x/128),cz=Math.floor(z/128);for(let j=Math.floor((z-8)/128);j<=Math.floor((z+8)/128);j++)for(let i=Math.floor((x-8)/128);i<=Math.floor((x+8)/128);i++){const key=i+':'+j;let rocks=rockCache.get(key);if(!rocks){rocks=scenery(i,j).filter(p=>p.kind==='rock'&&p.variant>.45);if(rockCache.size>=128)rockCache.delete(rockCache.keys().next().value);rockCache.set(key,rocks);}out.push(...rocks);}return out;}
function rockSolid(x,z,y=null){return rocksNear(x,z).some(p=>Math.hypot((x-p.x)/(p.size*1.6+1),(z-p.z)/(p.size+1))<1&&(y===null||y<p.y+p.size*(.8+p.variant)));}
function solidAt(x,z){return structureSolidAt(x,z)||rockSolid(x,z);}
// Shared physical shot occlusion; structure footprints have finite heights, bridge has real underside.
function blockedAt(x,y,z){if(installations.some(b=>Math.abs(x-b.x)<9&&Math.abs(z-b.z-8)<6&&y<groundAt(b.x,b.z)+12))return true;if(y<=groundAt(x,z)||rockSolid(x,z,y))return true;const deck=deckAt(x,z);if(deck!==null&&y>=deck-1.3&&y<=deck+.25)return true;
 for(let i=0;i<3;i++){const a=1150+i*30;if(Math.hypot(x-a,z-1080)<12&&y<groundAt(a,1080)+108+i%2*38)return true;}
 for(let i=0;i<9;i++){const a=1110+i%3*22,b=1148+Math.floor(i/3)*25;if(Math.hypot(x-a,z-b)<8&&y<groundAt(a,b)+9)return true;}
 return [970,1070].some(a=>[1018,1030].some(b=>Math.abs(x-a)<1.5&&Math.abs(z-b)<1.5&&y<24));}
function move(p,dx,dz){
 let x=clamp(p.x+dx,1,WIDTH-1),z=clamp(p.z+dz,1,LENGTH-1),d=Math.hypot(x-p.x,z-p.z),surface=p.surface||'ground';if(!d)return p;
 if(surface==='ground'&&solidAt(x,z))return p;
 let y=groundAt(x,z),deck=deckAt(x,z);
 if(surface==='bridge') {if(deck===null){if(p.x>901&&p.x<1139)return p;surface='ground';}else y=deck;}
 else if(deck!==null&&Math.abs(deck-p.y)<=d*.55+.03){y=deck;surface='bridge';}
 if(surface==='ground'&&deck!==null&&deck-y<3.8)return p;
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
function frameSeconds(previous,now){const dt=(now-previous)/1000;return Number.isFinite(dt)&&dt>0&&dt<=.25?dt:0;}
function advance(p,dx,dz){const nSteps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.2));for(let i=0;i<nSteps;i++){const next=move(p,dx/nSteps,dz/nSteps);if(next===p){
 // Project onto the local contour; every candidate still passes the same solids and slope checks.
 const n=surfaceNormal(p.x,p.z),l=Math.hypot(n[0],n[2]);if(p.surface==='bridge'||l<1e-6)break;
 const tx=-n[2]/l,tz=n[0]/l,along=(dx/nSteps)*tx+(dz/nSteps)*tz;
 const slide=move(p,tx*along,tz*along);if(slide===p)break;p=slide;
 }else p=next;}return p;}
function chunk(cx,cz,step=STEP){const n=CHUNK/step,positions=[],normals=[],colors=[],indices=[];
 for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=cx*CHUNK+i*step,z=cz*CHUNK+j*step,y=heightAt(x,z),b=biomeAt(x,z),v=.85+noise(x,z,20)*.15;positions.push(i*step,y,j*step);normals.push(...normalAt(x,z));const c=b==='terraformed'?[.22,.34,.23]:b==='massif'?[.38,.39,.43]:[.48,.44,.39];colors.push(...c.map(c=>c*v));}
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 return {positions,normals,colors,indices};
}
function chunkKeys(x,z,radius=4,fineRadius=2){const a=[],cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK);for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++){const aX=cx+i,aZ=cz+j;if(aX>=0&&aZ>=0&&aX*CHUNK<WIDTH&&aZ*CHUNK<LENGTH)a.push({key:aX+':'+aZ,cx:aX,cz:aZ,step:Math.max(Math.abs(i),Math.abs(j))<=fineRadius?4:16});}return a;}
// Coarse outer ring merged into one draw; near chunk coordinates and stable terrain remain unchanged.
function horizon(x,z,innerRadius=4){const positions=[],normals=[],colors=[],indices=[],cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK),samples=new Map();
 // Sample once per shared vertex. Distant lighting uses an up normal: relief is physical geometry.
 const sample=(x,z)=>{const key=x+':'+z;if(samples.has(key))return samples.get(key);const y=heightAt(x,z),b=biomeAt(x,z),c=b==='terraformed'?[.22,.34,.23]:b==='massif'?[.38,.39,.43]:[.48,.44,.39],v=.9+noise(x,z,110)*.1;const out={y,c:c.map(c=>c*v)};samples.set(key,out);return out;};
 for(let j=-22;j<=22;j++)for(let i=-22;i<=22;i++){const ring=Math.max(Math.abs(i),Math.abs(j));if(ring<=innerRadius)continue;const a=cx+i,b=cz+j;if(a<0||b<0||a*CHUNK>=WIDTH||b*CHUNK>=LENGTH)continue;
 const step=ring<=11?64:128,n=128/step,offset=positions.length/3;
 for(let z=0;z<=128;z+=step)for(let x=0;x<=128;x+=step){const ax=a*128+x,az=b*128+z,d=sample(ax,az);positions.push(ax,d.y,az);normals.push(0,1,0);colors.push(...d.c);}
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const k=offset+z*(n+1)+x;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}
 // Only LOD boundaries need skirts. Equal-resolution neighboring edges already coincide exactly.
 if(ring===innerRadius+1||ring===11)for(let side=0;side<4;side++){const ni=i+(side===0?-1:side===1?1:0),nj=j+(side===2?-1:side===3?1:0),neighbor=Math.max(Math.abs(ni),Math.abs(nj));if(!(ring===innerRadius+1&&neighbor===innerRadius||ring===11&&neighbor===12))continue;for(let t=0;t<128;t+=step){const ax=a*128+(side===0?0:side===1?128:t),az=b*128+(side===2?0:side===3?128:t),bx=ax+(side<2?0:step),bz=az+(side<2?step:0),k=positions.length/3,ay=sample(ax,az).y,by=sample(bx,bz).y;positions.push(ax,ay,az,ax,ay-64,az,bx,by,bz,bx,by-64,bz);normals.push(0,1,0,0,1,0,0,1,0,0,1,0);colors.push(...Array(4).fill([.32,.33,.36]).flat());indices.push(k,k+1,k+2,k+2,k+1,k+3);}}
 }return {positions,normals,colors,indices,radius:2560};
}
function scenery(cx,cz){const out=[];for(let i=0;i<48;i++){const x=cx*128+hash(cx*53+i,cz)*128,z=cz*128+hash(cz*71+i,cx)*128;if(x<0||z<0||x>WIDTH||z>LENGTH||Math.hypot(x-1024,z-1024)<115)continue;if(structureSolidAt(x,z)||installations.some(b=>Math.hypot(x-b.x,z-b.z)<25)||Math.hypot(x-1180,z-1080)<55||x>1095&&x<1170&&z>1130&&z<1240)continue;const b=biomeAt(x,z);out.push({x,z,y:groundAt(x,z),kind:b==='terraformed'?'tree':i===0&&hash(cx,cz)>.85?'relay':'rock',size:1+hash(cx+i,cz+8)*2.8,variant:hash(cx+i,cz+77)});}return out;}
const landmarks=Object.freeze([{id:'bridge-01',x:1024,z:1024,name:'Refuge viaduct'},{id:'oxygen-01',x:1160,z:1080,name:'Oxygen complex'},{id:'refuge-01',x:1140,z:1160,name:'Refuge outpost'},{id:'crater-01',x:1210,z:1130,name:'Refuge ridge'},{id:'massif-01',x:14000,z:8000,name:'Highland overlook'}].map(Object.freeze));
root.ConquestWorld=Object.freeze({id:'moon',version:1,SEED,WIDTH,LENGTH,SPEED,CHUNK,STEP,installations,surfaceNormal,solidAt,blockedAt,horizon,scenery,travelSpeed,frameSeconds,advance,heightAt,groundAt,normalAt,biomeAt,surfacesAt,deckAt,move,chunk,chunkKeys,landmarks,mapPoint:(x,z)=>({u:x/WIDTH,v:1-z/LENGTH}),sectorAt:(x,z)=>({theater:'moon',id:Math.floor(x/2400)+':'+Math.floor(z/2400)}),warpNodes:Object.freeze([])});
})(globalThis);
