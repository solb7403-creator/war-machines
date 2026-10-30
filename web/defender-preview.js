'use strict';
// Deliberately no account/economy imports, storage, fetch, equips or saving.
const previewLoadout=structuredClone(STOCK_L);
const defenderPreview=new LunarShowroom(document.querySelector('#defender-scene'));
defenderPreview.auto=false;defenderPreview.zoom=1.25;
const paintPicker=document.querySelector('#preview-paint');
for(const [id,p] of Object.entries(PAINTS)){const o=document.createElement('option');o.value=id;o.textContent=p.n;paintPicker.append(o);}
function previewUpdate(){
 defenderPreview.setLoadout(previewLoadout);
 document.querySelector('#preview-title').textContent=previewLoadout.skin==='lunar'?'Legendary Lunar Skin · graphite / gold':'Stock Defender · visual prototype';
 document.querySelector('#preview-state').textContent=(previewLoadout.skin==='lunar'?'Legendary skin':'Stock skin')+' · '+PAINTS[previewLoadout.paint].n+' paint swatch · '+(previewLoadout.w.a==='moon'?'Moonbeam':'standard weapon');
 document.querySelectorAll('[data-skin]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skin===previewLoadout.skin)));
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-skin],[data-view],[data-zoom]');if(!b)return;
 if(b.dataset.skin){previewLoadout.skin=b.dataset.skin;previewUpdate();}
 else if(b.dataset.view){const v={front:[-.65,.26],side:[.46,.12],rear:[2.0,.26],top:[-.65,.70]}[b.dataset.view];defenderPreview.yaw=v[0];defenderPreview.tilt=v[1];defenderPreview.auto=false;defenderPreview.draw();}
 else defenderPreview.setZoom(defenderPreview.zoom+Number(b.dataset.zoom)*.12);
});
paintPicker.onchange=()=>{previewLoadout.paint=paintPicker.value;previewUpdate();};
document.querySelector('#preview-weapon').onchange=e=>{previewLoadout.w={...previewLoadout.w,a:e.target.value,t:e.target.value==='moon'?2:0};previewUpdate();};
previewUpdate();addEventListener('pagehide',()=>defenderPreview.dispose(),{once:true});
