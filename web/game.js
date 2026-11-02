'use strict';
// Website presentation adapter; all buttons still use the existing game, account and match contracts.
let webStage=null,webShowroom=null,webSceneKey='',webRenewTimer=null;
// The garage's live 3D spot: on phones and small tablets the website's one showroom moves into it; on wide screens the
// showroom beside the garage already shows the selected bay, so the spot stays empty. One live 3D canvas either way.
function webMountStage(slot){
 if(!webStage)return;const narrow=innerWidth<900;slot.hidden=!narrow;
 if(narrow){if(!slot.contains(webStage)){slot.append(webStage);webStage.classList.add('mobile-stage');webShowroom?.size();}}
 else if(!$('#web-showroom-home').contains(webStage)){$('#web-showroom-home').append(webStage);webStage.classList.remove('mobile-stage');webShowroom?.size();}
}
function webMoveStage(){
 if(!webStage)return;const slot=uiTab==='garage'&&$('#g-stage-slot');
 if(slot)webMountStage(slot);else if(!$('#web-showroom-home').contains(webStage)){$('#web-showroom-home').append(webStage);webStage.classList.remove('mobile-stage');webShowroom?.size();}
}
function webUpdateMachine(){
 if(!save||!webStage)return;webMoveStage();
 if(webShowroom?.renderer&&!want3D())webShowroom.fallback();
 else if(want3D()&&typeof THREE!=='undefined'&&!R3.failed&&webShowroom&&!webShowroom.renderer){webShowroom.dispose();$('#web-machine-scene').replaceChildren();webShowroom=new LunarShowroom($('#web-machine-scene'));}
 // the garage shows the bay you picked there; every other screen shows the bay that deploys next
 const id=uiTab==='garage'&&typeof gBayId==='function'?gBayId():save.lab?.active,M=save.lab?.machines[id];
 const L=M?{...ecoLoadout(save,M.spec),vl:vaultLevel(save.vg)}:myLoadout(),name=M?.name||'War Machine';
 webShowroom?.setContext('garage');webShowroom?.setLoadout(L);$('#web-machine-name').textContent=name;$('#web-machine-class').textContent=CNAMES[L.c.c][L.c.t]+' / '+(L.w.a==='moon'?'Moonbeam':WNAMES[L.w.a][L.w.t])+(L.skin==='lunar'?' · LUNAR SKIN':'')+' · '+buildTag(L).n.toUpperCase();
 const m=machineView(L);$('#web-machine-stats').innerHTML='<div>TOUGHNESS<strong>'+fmtNum(m.tough)+'</strong><small>health</small></div><div>FIREPOWER<strong>'+m.fire+'</strong><small>damage per second</small></div><div>SPEED<strong>'+m.speed+'</strong><small>driving speed</small></div>';
 $('#web-pilot').textContent=tgName(TG_USER);$('#web-credit').textContent=fmtNum((srv||window.LUNAR_WEB.snapshot.rec).ac||0)+' airdrop credit · server confirmed';
 document.querySelectorAll('[data-web-tab]').forEach(b=>b.classList.toggle('on',b.dataset.webTab===uiTab));
}
const webCloseOverlay=closeOverlay;closeOverlay=function(ov){const r=webCloseOverlay(ov);if(webStage)setTimeout(webUpdateMachine,0);return r;};
const webOriginalRender=renderScreen;renderScreen=function(t){
 // Keep the one showroom alive when a screen's original HTML is refreshed.
 if(webStage&&$('#s-'+t)?.contains(webStage))$('#web-showroom-home').append(webStage);
 webOriginalRender(t);if(t==='shop'){
  const note=document.createElement('div');note.className='web-shop-note';note.textContent='Purchases happen in the Telegram edition with Telegram Stars for now. Everything you own works here, and points crates work on both.';$('#s-shop').prepend(note);
  $('#s-shop').querySelectorAll('[data-act="paycur"],[data-act="premium"],[data-act="founder"],[data-act="starter"],[data-act="tonwallet"],[data-act="solwallet"],[data-act="vaultbuy"]').forEach(b=>{if(b.dataset.act!=='crate'||!b.textContent.includes('points')){b.disabled=true;b.title='Use Telegram for verified purchases';}});
 }
 webUpdateMachine();
};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-web-tab],[data-web-range],[data-stage-rotate],[data-stage-zoom],[data-stage-view]');if(!b)return;
 if(b.dataset.webTab){closeAll();setTab(b.dataset.webTab);webUpdateMachine();}
 else if(b.hasAttribute('data-web-range')){closeAll();ACT.rangecard(uiTab==='garage'?gBayId():save.lab.active);}
 else if(b.dataset.stageView)webShowroom?.view(b.dataset.stageView);
 else if(b.dataset.stageRotate)webShowroom?.rotate(Number(b.dataset.stageRotate));else webShowroom?.setZoom(webShowroom.zoom+Number(b.dataset.stageZoom)*.12);
});
async function webEndSession(){if(rangeRun)rangeExit();if(pvp)pvpClose();clearInterval(webRenewTimer);await fetch('/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Lunar-CSRF':window.LUNAR_WEB.csrf},body:'{}'}).catch(()=>{});location.replace('/web/');}
$('#web-logout').addEventListener('click',webEndSession);
window.addEventListener('lunar-session-expired',()=>{clearInterval(webRenewTimer);if(pvp)pvpClose();if(rangeRun)rangeExit();location.replace('/web/#login');});
window.lunarWebReady=()=>{
 webStage=$('#web-stage');const start=()=>{if(typeof THREE==='undefined'){if(R3.failed||!want3D()){webShowroom=new LunarShowroom($('#web-machine-scene'));webUpdateMachine();return;}if(!R3.loading)load3D();setTimeout(start,100);return;}webShowroom=new LunarShowroom($('#web-machine-scene'));webUpdateMachine();};
 if(R3.failed||!want3D()){webShowroom=new LunarShowroom($('#web-machine-scene'));webUpdateMachine();}else start();
 const tab=location.hash.slice(1);
 if(['play','garage','quests','ranks'].includes(tab))setTab(tab);
 else if(tab==='engineer')ACT.labedit(save.lab.active);   // old Engineer links: the garage, at the bay that deploys
 else if(tab==='range'){setTab('garage');openRange(save.lab.active);}
 else if(tab.startsWith('mode:')&&GT_ORDER.includes(tab.slice(5))){ACT.gtype(tab.slice(5));setTab('play');}
 addEventListener('resize',webUpdateMachine);addEventListener('lunar-quality-change',webUpdateMachine);addEventListener('pagehide',e=>{if(!e.persisted){clearInterval(webRenewTimer);webShowroom?.dispose();}});addEventListener('pageshow',e=>{if(e.persisted){webShowroom?.run();webUpdateMachine();}});
 webRenewTimer=setInterval(async()=>{if(document.hidden)return;const r=await fetch('/auth/renew',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Lunar-CSRF':window.LUNAR_WEB.csrf},body:'{}'}).catch(()=>null);if(r?.status===401)window.dispatchEvent(new Event('lunar-session-expired'));},20*60000);
};
