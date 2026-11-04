/* Pure moon theater contract. Absolute coordinates never depend on finite bounds or build order. */
(function(root){
'use strict';
const WIDTH=31680,LENGTH=47520,SPEED=4.4,CHUNK=128,STEP=4,SEED=0x4c554e41;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function hash(x,z){let n=Math.imul(x^SEED,374761393)^Math.imul(z,668265263);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967295;}
function noise(x,z,s){x/=s;z/=s;let i=Math.floor(x),j=Math.floor(z),u=smooth(x-i),v=smooth(z-j);return mix(mix(hash(i,j),hash(i+1,j),u),mix(hash(i,j+1),hash(i+1,j+1),u),v);}
function heightAt(x,z){
 let h=(noise(x,z,2800)-.5)*480+(noise(x,z,600)-.5)*95+(noise(x,z,110)-.5)*12;
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
function move(p,dx,dz){
 let x=clamp(p.x+dx,1,WIDTH-1),z=clamp(p.z+dz,1,LENGTH-1),d=Math.hypot(x-p.x,z-p.z),surface=p.surface||'ground';if(!d)return p;
 let y=groundAt(x,z),deck=deckAt(x,z);
 if(surface==='bridge') {if(deck===null){if(p.x>901&&p.x<1139)return p;surface='ground';}else y=deck;}
 else if(deck!==null&&Math.abs(deck-p.y)<=d*.55+.03){y=deck;surface='bridge';}
 if(surface==='ground'&&deck!==null&&deck-y<3.8)return p;
 // Pillars are solid on the lower route, away from its clear centerline.
 if(surface==='ground'&&[970,1070].some(a=>Math.abs(x-a)<2.5)&&Math.abs(z-1024)<8)return p;
 if(Math.abs(y-p.y)>d*.65+.04)return p;
 return {x,z,y,surface};
}
function chunk(cx,cz,step=STEP){const n=CHUNK/step,positions=[],normals=[],colors=[],indices=[];
 for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=cx*CHUNK+i*step,z=cz*CHUNK+j*step,y=heightAt(x,z),b=biomeAt(x,z),v=.85+noise(x,z,20)*.15;positions.push(i*step,y,j*step);normals.push(...normalAt(x,z));const c=b==='terraformed'?[.22,.34,.23]:b==='massif'?[.38,.39,.43]:[.48,.44,.39];colors.push(...c.map(c=>c*v));}
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
 return {positions,normals,colors,indices};
}
function chunkKeys(x,z,radius=4){const a=[],cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK);for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++){const aX=cx+i,aZ=cz+j;if(aX>=0&&aZ>=0&&aX*CHUNK<WIDTH&&aZ*CHUNK<LENGTH)a.push({key:aX+':'+aZ,cx:aX,cz:aZ,step:Math.max(Math.abs(i),Math.abs(j))<=2?4:16});}return a;}
const landmarks=Object.freeze([{id:'bridge-01',x:1024,z:1024,name:'Refuge viaduct'},{id:'oxygen-01',x:1160,z:1080,name:'Oxygen complex · placeholder'},{id:'refuge-01',x:1140,z:1160,name:'Refuge outpost · placeholder'},{id:'crater-01',x:1210,z:1130,name:'Refuge ridge'}].map(Object.freeze));
root.ConquestWorld=Object.freeze({id:'moon',version:1,SEED,WIDTH,LENGTH,SPEED,CHUNK,STEP,heightAt,groundAt,normalAt,biomeAt,surfacesAt,deckAt,move,chunk,chunkKeys,landmarks,mapPoint:(x,z)=>({u:x/WIDTH,v:1-z/LENGTH}),sectorAt:(x,z)=>({theater:'moon',id:Math.floor(x/2400)+':'+Math.floor(z/2400)}),warpNodes:Object.freeze([])});
})(globalThis);
