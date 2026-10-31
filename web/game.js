'use strict';
// Website presentation adapter; all buttons still use the existing game, account and match contracts.
let webStage=null,webShowroom=null,webSceneKey='',webRenewTimer=null;
function webMoveStage(){
 if(!webStage)return;const editor=document.querySelector('#lab-weapon')?.closest('.labform');
 const target=editor||(innerWidth<900&&uiTab==='garage'?$('#s-garage'):$('#web-showroom-home'));
 if(target&&!target.contains(webStage)){target.prepend(webStage);webStage.classList.toggle('mobile-stage',target.id==='s-garage');editor?.classList.add('web-engineer-form');webShowroom?.size();}
}
function webUpdateMachine(){
 if(!save||!webStage)return;webMoveStage();
 if(webShowroom?.renderer&&!want3D())webShowroom.fallback();
 else if(want3D()&&typeof THREE!=='undefined'&&!R3.failed&&webShowroom&&!webShowroom.renderer){webShowroom.dispose();$('#web-machine-scene').replaceChildren();webShowroom=new LunarShowroom($('#web-machine-scene'));}
 let L=myLoadout(),name=save.lab?.machines[save.lab.active]?.name||'War Machine';
 if(labEditor&&$('#lab-weapon')){const p=labFormSpec();if(!labValidate(save,p)){L=ecoLoadout(save,p);name=$('#lab-name').value||name;}}
 webShowroom?.setContext(labEditor&&$('#lab-weapon')?'engineer':'garage');webShowroom?.setLoadout(L);$('#web-machine-name').textContent=name;$('#web-machine-class').textContent=CNAMES[L.c.c][L.c.t]+(L.c.c==='vanguard'&&L.c.t===0&&L.skin!=='lunar'?' · DEFENDER 3D PROTOTYPE':'')+' / '+(L.w.a==='moon'?'Moonbeam':WNAMES[L.w.a][L.w.t])+(L.skin==='lunar'?' · LUNAR SKIN · GRAPHITE / GOLD':'');
 const m=machineMetrics(L);$('#web-machine-stats').innerHTML='<div>HULL<strong>'+fmtNum(m.hp)+'</strong><small>base HP</small></div><div>FIREPOWER<strong>'+m.dps+'</strong><small>ordinary DPS</small></div><div>MOBILITY<strong>'+m.spd+'</strong><small>driving speed</small></div>';
 $('#web-pilot').textContent=tgName(TG_USER);$('#web-credit').textContent=fmtNum((srv||window.LUNAR_WEB.snapshot.rec).ac||0)+' airdrop credit · server confirmed';
 document.querySelectorAll('[data-web-tab]').forEach(b=>b.classList.toggle('on',b.dataset.webTab===uiTab));
}
const webCloseOverlay=closeOverlay;closeOverlay=function(ov){if(webStage&&ov?.box?.contains(webStage))$('#web-showroom-home').append(webStage);const r=webCloseOverlay(ov);if(webStage)setTimeout(webUpdateMachine,0);return r;};
const webOriginalRender=renderScreen;renderScreen=function(t){
 // Keep the one showroom alive when a screen's original HTML is refreshed.
 if(webStage&&$('#s-'+t)?.contains(webStage))$('#web-showroom-home').append(webStage);
 webOriginalRender(t);if(t==='shop'){
  const note=document.createElement('div');note.className='web-shop-note';note.textContent='Website checkout is unavailable. Use the Telegram edition for verified Stars, TON or SOL purchases. Existing owned items remain available here.';$('#s-shop').prepend(note);
  $('#s-shop').querySelectorAll('[data-act="paycur"],[data-act="premium"],[data-act="founder"],[data-act="starter"],[data-act="tonwallet"],[data-act="solwallet"],[data-act="vaultbuy"]').forEach(b=>{if(b.dataset.act!=='crate'||!b.textContent.includes('points')){b.disabled=true;b.title='Use Telegram for verified purchases';}});
 }
 webUpdateMachine();
};
const webEdit=ACT.labedit;ACT.labedit=(...a)=>{webEdit(...a);setTimeout(webUpdateMachine,30);};
const webInspectClose=ACT.labinspectclose;ACT.labinspectclose=(...a)=>{webInspectClose(...a);setTimeout(webUpdateMachine,30);};
document.addEventListener('change',e=>{if(e.target.closest('.labform')?.querySelector('#lab-weapon'))webUpdateMachine();});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-web-tab],[data-web-range],[data-stage-rotate],[data-stage-zoom],[data-stage-view]');if(!b)return;
 if(b.dataset.webTab){closeAll();setTab(b.dataset.webTab);webUpdateMachine();}
 else if(b.hasAttribute('data-web-range')){closeAll();openRange(save.lab.active);}
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
 else if(tab==='engineer'){setTab('garage');ACT.labedit(save.lab.active);}
 else if(tab==='range'){setTab('garage');openRange(save.lab.active);}
 else if(tab.startsWith('mode:')&&GT_ORDER.includes(tab.slice(5))){ACT.gtype(tab.slice(5));setTab('play');}
 addEventListener('resize',webUpdateMachine);addEventListener('lunar-quality-change',webUpdateMachine);addEventListener('pagehide',e=>{if(!e.persisted){clearInterval(webRenewTimer);webShowroom?.dispose();}});addEventListener('pageshow',e=>{if(e.persisted){webShowroom?.run();webUpdateMachine();}});
 webRenewTimer=setInterval(async()=>{if(document.hidden)return;const r=await fetch('/auth/renew',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Lunar-CSRF':window.LUNAR_WEB.csrf},body:'{}'}).catch(()=>null);if(r?.status===401)window.dispatchEvent(new Event('lunar-session-expired'));},20*60000);
};
