'use strict';
// One WebGL renderer, bounded nine copied card canvases. No identity, storage, saving, networking or gear grants.
const catalogLoadout=structuredClone(STOCK_L),catalogScene=new LunarShowroom(document.querySelector('#catalog-scene'));
catalogScene.auto=false;catalogScene.zoom=1.35;
let catalogParts=3,catalogSheet='chassis',catalogReady=false;
const catalogC=document.querySelector('#catalog-chassis'),catalogW=document.querySelector('#catalog-weapon'),catalogP=document.querySelector('#catalog-paint');
const catalogOption=(select,value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);};
for(const cls of CHORDER)for(let t=0;t<3;t++)catalogOption(catalogC,cls+':'+t,CH[cls].n+' · T'+t);
for(const arch of WORDER)for(let t=0;t<3;t++)catalogOption(catalogW,arch+':'+t,WEAPONS[arch].n+' · T'+t);
catalogOption(catalogW,'moon:2','Moonbeam · Legendary unified cannon');for(const [id,p] of Object.entries(PAINTS))catalogOption(catalogP,id,p.n);
catalogC.value='vanguard:0';catalogW.value='pulse:0';
function catalogInspect(){
 const [cls,ct]=catalogC.value.split(':'),[arch,wt]=catalogW.value.split(':');
 catalogLoadout.c={...catalogLoadout.c,c:cls,t:+ct};catalogLoadout.w={...catalogLoadout.w,a:arch,t:+wt};catalogLoadout.paint=catalogP.value;catalogLoadout.skin=document.querySelector('#catalog-skin').value;
 catalogScene.setLoadout(catalogLoadout,catalogParts);
 document.querySelector('#catalog-title').textContent=CH[cls].n+' T'+ct+' / '+WEAPONS[arch].n+(arch==='moon'?' · Legendary':' T'+wt)+(catalogLoadout.skin==='lunar'?' · Lunar Skin':'');
}
function catalogCards(kind){
 catalogReady=false;catalogSheet=kind;const grid=document.querySelector('#catalog-grid');grid.replaceChildren();
 document.querySelectorAll('[data-sheet]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sheet===kind)));
 document.querySelector('#sheet-heading').textContent=kind==='chassis'?'STANDARD CHASSIS / T0 → T2':kind==='weapons'?'STANDARD WEAPONS / T0 → T2':'REPRESENTATIVE STANDARD PAIRINGS';
 for(let row=0;row<3;row++)for(let tier=0;tier<3;tier++){
  const L=structuredClone(STOCK_L);L.c.c=CHORDER[row];L.c.t=tier;L.w.a=WORDER[row];L.w.t=tier;
  const part=kind==='chassis'?1:kind==='weapons'?2:3;if(part===2)L.c={...STOCK_L.c};
  const title=part===1?CH[L.c.c].n+' T'+tier:part===2?WEAPONS[L.w.a].n+' T'+tier:CH[L.c.c].n+' T'+tier+' / '+WEAPONS[L.w.a].n+' T'+tier;
  const card=document.createElement('article');card.className='catalog-card';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','Inspect '+title);
  const h=document.createElement('h3');h.textContent=title;const label=document.createElement('p');label.textContent=['COMMON / T0','RARE / T1','EPIC / T2'][tier]+' · STANDARD SKIN';const canvas=document.createElement('canvas');canvas.width=660;canvas.height=480;canvas.setAttribute('aria-label',title+' actual 3D render');
  catalogScene.yaw=-.65;catalogScene.tilt=.25;catalogScene.zoom=1.35;catalogScene.setLoadout(L,part);if(catalogScene.renderer){catalogScene.renderer.setSize(660,480,false);catalogScene.camera.aspect=660/480;catalogScene.camera.updateProjectionMatrix();}catalogScene.draw();
  if(catalogScene.renderer)canvas.getContext('2d').drawImage(catalogScene.renderer.domElement,0,0,canvas.width,canvas.height);
  else{const c=canvas.getContext('2d');c.fillStyle='#a5bdcc';c.font='16px Arial';c.fillText('3D unavailable · use game 2D mode',12,80);}
  card.append(h,label,canvas);const inspect=()=>{catalogC.value=L.c.c+':'+L.c.t;catalogW.value=L.w.a+':'+L.w.t;catalogParts=part;catalogInspect();document.querySelector('.inspection').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};card.onclick=inspect;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect();}};grid.append(card);
 }
 catalogParts=3;catalogScene.yaw=-.65;catalogScene.tilt=.25;catalogScene.zoom=1.35;catalogInspect();catalogScene.size();catalogReady=true;
}
for(const s of [catalogC,catalogW,catalogP,document.querySelector('#catalog-skin')])s.onchange=()=>{catalogParts=3;catalogInspect();};
document.addEventListener('click',e=>{const b=e.target.closest('[data-view],[data-zoom],[data-sheet]');if(!b)return;if(b.dataset.sheet){catalogCards(b.dataset.sheet);return;}if(b.dataset.view){const v={front:[-.65,.25],side:[.46,.12],rear:[2.0,.25],top:[-.65,.70]}[b.dataset.view];catalogScene.yaw=v[0];catalogScene.tilt=v[1];catalogScene.draw();}else catalogScene.setZoom(catalogScene.zoom+Number(b.dataset.zoom)*.12);});
const sheet=new URLSearchParams(location.search).get('sheet');if(['chassis','weapons','pairs'].includes(sheet)){document.body.classList.add('sheet-mode');catalogCards(sheet);}else catalogCards('chassis');
addEventListener('pagehide',()=>catalogScene.dispose(),{once:true});
