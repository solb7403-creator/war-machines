'use strict';
// Public inspection only: no auth, saves, inventory, storage or combat submission code.
const hfL=structuredClone(STOCK_L);hfL.skin='lunar';hfL.w={a:'moon',t:2,q:1,s:false};
let hfScene=null,hfMode=new URLSearchParams(location.search).get('view')==='baseline'?'baseline':'upgraded',hfQuality=new URLSearchParams(location.search).get('quality')==='low'?'low':'high',hfReady=false,hfLoadMs=0,hfReadyMs=0;
const hfStatus=document.querySelector('#hf-status');
for(const [id,p] of Object.entries(PAINTS)){const o=document.createElement('option');o.value=id;o.textContent=p.n;document.querySelector('#hf-paint').append(o);}
async function hfRefresh(){
 document.querySelectorAll('[data-quality]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.quality===hfQuality)));document.querySelectorAll('[data-render]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.render===hfMode)));
 hfReady=false;Equipment3D.enabled=hfMode==='upgraded';Equipment3D.quality=hfQuality==='low'?'low':'high';
 if(!hfScene){hfScene=new LunarShowroom(document.querySelector('#hf-scene'));hfScene.auto=false;hfScene.yaw=-.65;hfScene.tilt=.18;hfScene.zoom=1.35;}
 const t=performance.now(),ok=hfQuality==='2d'||hfMode==='baseline'||!hfScene.renderer?false:await Equipment3D.ensure(Equipment3D.quality);hfLoadMs=performance.now()-t;
 Equipment3D.configure(hfScene.renderer);
 if(hfScene.renderer){ // Matched baseline/upgraded camera, lighting, exposure and contact rig.
  hfScene.renderer.toneMapping=THREE.ACESFilmicToneMapping;hfScene.renderer.toneMappingExposure=1.1;
 }
 hfL.skin=document.querySelector('#hf-skin').value;hfL.w={...hfL.w,a:document.querySelector('#hf-weapon').value,t:document.querySelector('#hf-weapon').value==='moon'?2:0};hfL.paint=document.querySelector('#hf-paint').value;
 hfScene.setLoadout(hfL,+document.querySelector('#hf-parts').value);
 if(hfQuality==='2d')hfScene.fallback();else hfScene.draw();
 document.querySelector('#hf-title').textContent=(hfL.skin==='lunar'?'Lunar Skin':'Vanguard T0')+' / '+WEAPONS[hfL.w.a].n+' · '+(hfMode==='baseline'?'PR #16':hfQuality.toUpperCase());
 hfStatus.textContent=hfQuality==='2d'?'2D fallback — material detail unavailable.':!ok&&hfMode!=='baseline'?'Material asset unavailable — existing PR #16 model retained.':hfMode==='baseline'?'Baseline geometry/materials. Same light and camera rig.':'Verified local UV/PBR assets · '+hfQuality.toUpperCase()+' · no account changes';
 hfReadyMs=performance.now();hfReady=true;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-render],[data-quality],[data-view],[data-zoom]');if(!b)return;if(b.dataset.render){hfMode=b.dataset.render;document.querySelectorAll('[data-render]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));hfRefresh();}else if(b.dataset.quality){hfQuality=b.dataset.quality;document.querySelectorAll('[data-quality]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));if(hfScene&&!hfScene.renderer){hfScene.dispose();document.querySelector('#hf-scene').replaceChildren();hfScene=null;}hfRefresh();}else if(hfScene){if(b.dataset.view){const [yaw,tilt]={front:[-1.1,.08],quarter:[-.65,.18],side:[.46,.06],rear:[2.0,.13]}[b.dataset.view];hfScene.yaw=yaw;hfScene.tilt=tilt;}else hfScene.setZoom(hfScene.zoom+Number(b.dataset.zoom)*.14);hfScene.draw();}});
for(const id of ['hf-skin','hf-weapon','hf-paint','hf-parts'])document.querySelector('#'+id).onchange=hfRefresh;
addEventListener('pagehide',()=>{hfScene?.dispose();Equipment3D.dispose();},{once:true});hfRefresh();

addEventListener('pageshow',e=>{if(e.persisted){hfScene=null;document.querySelector('#hf-scene').replaceChildren();hfRefresh();}});
