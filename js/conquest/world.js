/* Pure moon theater contract. Absolute coordinates never depend on finite bounds or build order. */
(function(root){
'use strict';
const WIDTH=31680,LENGTH=47520,SPEED=4.4,CHUNK=128,STEP=4,SEED=0x4c554e41;
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
// Exact piecewise triangle interpolation matches the fine rendered ground, including at edges.
function groundAt(x,z){const a=Math.floor(x/STEP)*STEP,b=Math.floor(z/STEP)*STEP,u=(x-a)/STEP,v=(z-b)/STEP,h=heightAt(a,b),e=heightAt(a+STEP,b),n=heightAt(a,b+STEP),ne=heightAt(a+STEP,b+STEP);return u+v<=1?h+(e-h)*u+(n-h)*v:ne+(n-ne)*(1-u)+(e-ne)*(1-v);}
function normalAt(x,z){const dx=(heightAt(x+.5,z)-heightAt(x-.5,z)),dz=(heightAt(x,z+.5)-heightAt(x,z-.5)),l=Math.hypot(dx,1,dz);return [-dx/l,1/l,-dz/l];}
function biomeAt(x,z){if(Math.hypot(x-1150,z-1080)<130||noise(x,z,3400)>.65)return 'terraformed';return noise(x,z,1500)>.54?'massif':'wasteland';}
function deckAt(x,z){if(x<900||x>1140||Math.abs(z-1024)>9)return null;return x<960?mix(groundAt(900,z),24,(x-900)/60):x>1080?mix(24,groundAt(1140,z),(x-1080)/60):24;}
function surfacesAt(x,z){const a=[{id:'ground',y:groundAt(x,z)}],y=deckAt(x,z);if(y!==null)a.push({id:'bridge',y});return a;}
function solidAt(x,z){for(let i=0;i<3;i++)if(Math.hypot(x-(1150+i*30),z-1080)<10)return true;for(let i=0;i<9;i++)if(Math.hypot(x-(1110+i%3*22),z-(1148+Math.floor(i/3)*25))<7.8)return true;return false;}
function move(p,dx,dz){
 let x=clamp(p.x+dx,1,WIDTH-1),z=clamp(p.z+dz,1,LENGTH-1),d=Math.hypot(x-p.x,z-p.z),surface=p.surface||'ground';if(!d)return p;
 if(surface==='ground'&&solidAt(x,z))return p;
 let y=groundAt(x,z),deck=deckAt(x,z);
 if(surface==='bridge') {if(deck===null){if(p.x>901&&p.x<1139)return p;surface='ground';}else y=deck;}
 else if(deck!==null&&Math.abs(deck-p.y)<=d*.55+.03){y=deck;surface='bridge';}
 if(surface==='ground'&&deck!==null&&deck-y<3.8)return p;
 // Pillars are solid on the lower route, away from its clear centerline.
 if(surface==='ground'&&[970,1070].some(a=>Math.abs(x-a)<2.5)&&Math.abs(z-1024)<8)return p;
 if(Math.abs(y-p.y)>d*.65+.04)return p;
 return {x,z,y,surface};
}
// Same permanent speed as a live Arcade tank, before temporary battle buffs.
function travelSpeed(L){return machineSpeed(L);}
function frameSeconds(previous,now){const dt=(now-previous)/1000;return Number.isFinite(dt)&&dt>0&&dt<=.25?dt:0;}
function advance(p,dx,dz){const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.2));for(let i=0;i<n;i++){const next=move(p,dx/n,dz/n);if(next===p)break;p=next;}return p;}
function chunk(cx,cz,step=STEP){const n=CHUNK/step,positions=[],normals=[],colors=[],indices=[];
 for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=cx*CHUNK+i*step,z=cz*CHUNK+j*step,y=heightAt(x,z),b=biomeAt(x,z),v=.85+noise(x,z,20)*.15;positions.push(i*step,y,j*step);normals.push(...normalAt(x,z));const c=b==='terraformed'?[.22,.34,.23]:b==='massif'?[.38,.39,.43]:[.48,.44,.39];colors.push(...c.map(c=>c*v));}
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 return {positions,normals,colors,indices};
}
function chunkKeys(x,z,radius=4,fineRadius=2){const a=[],cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK);for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++){const aX=cx+i,aZ=cz+j;if(aX>=0&&aZ>=0&&aX*CHUNK<WIDTH&&aZ*CHUNK<LENGTH)a.push({key:aX+':'+aZ,cx:aX,cz:aZ,step:Math.max(Math.abs(i),Math.abs(j))<=fineRadius?4:16});}return a;}
// Coarse outer ring merged into one draw; near chunk coordinates and stable terrain remain unchanged.
function horizon(x,z){const positions=[],normals=[],colors=[],indices=[],cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK);
 for(let j=-11;j<=11;j++)for(let i=-11;i<=11;i++){if(Math.max(Math.abs(i),Math.abs(j))<=4)continue;const a=cx+i,b=cz+j;if(a<0||b<0||a*CHUNK>=WIDTH||b*CHUNK>=LENGTH)continue;
 const d=chunk(a,b,64),offset=positions.length/3;for(let k=0;k<d.positions.length;k+=3)positions.push(d.positions[k]+a*CHUNK,d.positions[k+1],d.positions[k+2]+b*CHUNK);normals.push(...d.normals);colors.push(...d.colors);indices.push(...d.indices.map(v=>v+offset));
 // Downward skirts join the unchanged near mesh and all LOD edges.
 for(let side=0;side<4;side++)for(let t=0;t<128;t+=64){const ax=a*128+(side===0?0:side===1?128:t),az=b*128+(side===2?0:side===3?128:t),bx=ax+(side<2?0:64),bz=az+(side<2?64:0),n=positions.length/3,ay=heightAt(ax,az),by=heightAt(bx,bz);positions.push(ax,ay,az,ax,ay-24,az,bx,by,bz,bx,by-24,bz);normals.push(0,1,0,0,1,0,0,1,0,0,1,0);colors.push(...Array(4).fill([.32,.33,.36]).flat());indices.push(n,n+1,n+2,n+2,n+1,n+3);}
 }return {positions,normals,colors,indices,radius:1280};
}
function scenery(cx,cz){const out=[];for(let i=0;i<48;i++){const x=cx*128+hash(cx*53+i,cz)*128,z=cz*128+hash(cz*71+i,cx)*128;if(x<0||z<0||x>WIDTH||z>LENGTH||Math.hypot(x-1024,z-1024)<115)continue;if(solidAt(x,z)||Math.hypot(x-1180,z-1080)<55||x>1095&&x<1170&&z>1130&&z<1240)continue;const b=biomeAt(x,z);out.push({x,z,y:groundAt(x,z),kind:b==='terraformed'?'tree':i===0&&hash(cx,cz)>.85?'relay':'rock',size:1+hash(cx+i,cz+8)*2.8,variant:hash(cx+i,cz+77)});}return out;}
const landmarks=Object.freeze([{id:'bridge-01',x:1024,z:1024,name:'Refuge viaduct'},{id:'oxygen-01',x:1160,z:1080,name:'Oxygen complex'},{id:'refuge-01',x:1140,z:1160,name:'Refuge outpost'},{id:'crater-01',x:1210,z:1130,name:'Refuge ridge'},{id:'massif-01',x:14000,z:8000,name:'Highland overlook'}].map(Object.freeze));
root.ConquestWorld=Object.freeze({id:'moon',version:1,SEED,WIDTH,LENGTH,SPEED,CHUNK,STEP,horizon,scenery,travelSpeed,frameSeconds,advance,heightAt,groundAt,normalAt,biomeAt,surfacesAt,deckAt,move,chunk,chunkKeys,landmarks,mapPoint:(x,z)=>({u:x/WIDTH,v:1-z/LENGTH}),sectorAt:(x,z)=>({theater:'moon',id:Math.floor(x/2400)+':'+Math.floor(z/2400)}),warpNodes:Object.freeze([])});
})(globalThis);
