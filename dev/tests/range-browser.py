"""Real page + actual isolated engine. Fake Worker only; unmocked destinations aborted by harness."""
import asyncio,json,time,os
from harness import start_dev,open_game,dev
from playwright.async_api import async_playwright
UID=int(time.time()*1000)%1000000000
OUT='/tmp/lunar-session4-shots';os.makedirs(OUT,exist_ok=True)
GUARD="""()=>{
 window.__bad=[];window.__recovery=[];const originalFetch=window.fetch.bind(window);
 window.fetch=(u,o={})=>{const path=String(u);if(/workers\\.dev|firebaseio\\.com/.test(path)&&o.method&&o.method!=='GET'){
  const body=JSON.parse(o.body||'{}');if(path.endsWith('/api/match/end')&&body.tok==='pending-ranked-fixture'){__recovery.push(path);return originalFetch(u,o);}
  __bad.push(['fetch',path]);throw Error('Range mutation '+path);
 }return originalFetch(u,o);};
 for(const n of ['matchStart','matchEnd','localEnd','afterMatch','proofBegin','syncPlayer','doSync','store','ecoMatchPts','ecoAfterMatch','ecoQuit','pvpJoin','pvpSend','placeGhosts']){
  const f=window[n];if(typeof f==='function')window[n]=function(...a){__bad.push(n);throw Error('Range used ranked hook '+n);};
 }
 window.__account=JSON.stringify(ecoCopy());window.__ranked={ticket:mTicket,proof:PR,last:lastResult,battle:battleLoadout};
}"""
COMPLETE="""()=>{const r=rangeRun;let steps=0;while(r.sim.view().state==='play'&&steps++<11000){r.sim.step(1/60,[0,0]);if(steps%60===0)r.sim.events();}if(r.sim.view().state!=='over')throw Error('range did not complete');r.sim.events();rangeFrame(0);return rangeSource.result;}"""
async def start(pg,g='arena',control='ai',preset='standard'):
 await pg.locator('#range-mode').select_option(g)
 await pg.locator('#range-control').select_option(control)
 if g!='boss' and await pg.locator('#range-opponent').input_value()!=preset:
  await pg.locator('summary').click();await pg.locator('#range-opponent').select_option(preset)
 await pg.locator('[data-act="rangestart"]').click()
 await pg.wait_for_function('!!rangeRun?.sim')
async def main():
 server=start_dev()
 try:
  async with async_playwright() as p:
   b,pg,errs=await open_game(p,320,740,eco='server',user={'id':UID,'first_name':'Range'})
   await pg.wait_for_function('!!save.lab')
   await pg.wait_for_timeout(500)
   await pg.evaluate('()=>{closeAll();setTab("garage");}')
   assert await pg.locator('[data-act="rangecard"]').count()==2,'Free Test on both cards'
   # Owned draft, no save or equip. Reject unowned/over-budget payloads through real entry.
   await pg.locator('[data-act="labedit"][data-arg="m_spare"]').click()
   await pg.locator('#lab-name').fill('Test draft')
   await pg.locator('#lab-fit-hull').select_option('plates')
   await pg.locator('#lab-fit-mobility').select_option('stable')
   await pg.locator('#lab-fit-mount').select_option('firing')
   assert await pg.locator('[data-act="rangedraft"]').is_disabled()
   await pg.locator('#lab-fit-mount').select_option('stock')
   # Capture exactly after unrelated boot syncs; no range can call account hooks thereafter.
   await pg.evaluate(GUARD)
   before_server=dev('/__dump')['eco']['tg_'+str(UID)]
   await pg.locator('[data-act="rangedraft"]').click()
   assert 'unsaved draft' in await pg.locator('.sheet').last.inner_text()
   await pg.screenshot(path=OUT+'/setup-320.png',full_page=True)
   await start(pg,'arena')
   assert await pg.evaluate('()=>rangeRun.sim.view().me.fits.hull')=='plates'
   assert await pg.evaluate('()=>rangeRun.sim.view().me.spdM')==.91
   assert await pg.evaluate('()=>state')=='menu','main ranked state never becomes practice'
   assert await pg.evaluate('()=>rangeRun.frame.contentWindow.RangeSim!==undefined')
   assert await pg.evaluate('()=>rangeRun.frame.contentWindow.Telegram===undefined')
   # Seed deterministic UI fixed-step replay. Pause RAF so automated driver controls exact start.
   await pg.evaluate('()=>{rangeRun.paused=true;rangeRun.sim.setup(rangeRun.cfg);}')
   first=await pg.evaluate(COMPLETE)
   await pg.screenshot(path=OUT+'/results-320.png',full_page=True)
   await pg.locator('[data-act="rangerepeat"]').click();await pg.wait_for_function('!!rangeRun?.sim')
   await pg.evaluate('()=>{rangeRun.paused=true;rangeRun.sim.setup(rangeRun.cfg);}')
   second=await pg.evaluate(COMPLETE)
   assert {k:v for k,v in first.items() if k!='at'}=={k:v for k,v in second.items() if k!='at'},'repeat same trial actual combat'
   assert 'Same AI trial conditions' in await pg.locator('.sheet').last.inner_text()
   results=[first,second]
   for g in ['zone','crystal','bounty','royale','boss']:
    await pg.locator('[data-act="rangeoptions"]').click();await start(pg,g)
    await pg.evaluate('()=>{rangeRun.paused=true;rangeRun.sim.setup(rangeRun.cfg);}')
    results.append(await pg.evaluate(COMPLETE))
   assert len(results)==7
   # Engineer return restores the unsaved draft and does not activate or save it.
   await pg.locator('[data-act="rangeadjust"]').click()
   assert await pg.locator('#lab-name').input_value()=='Test draft'
   assert await pg.locator('#lab-fit-hull').input_value()=='plates'
   assert await pg.locator('#lab-fit-mobility').input_value()=='stable'
   assert await pg.evaluate('()=>save.lab.active')=='m_legacy'
   assert await pg.evaluate('()=>save.lab.machines.m_spare.spec.mods.hull')=='stock'
   # Real touch, manual buttons, background/resume and fitted 3D then 2D. No hidden timers.
   await pg.locator('[data-act="rangedraft"]').click();await start(pg,'zone',control='player')
   y=await pg.evaluate('()=>rangeRun.sim.view().me.y')
   await pg.locator('#c').dispatch_event('pointerdown',{'pointerId':3,'clientX':70,'clientY':550})
   await pg.locator('#c').dispatch_event('pointermove',{'pointerId':3,'clientX':70,'clientY':495})
   await pg.wait_for_timeout(350)
   await pg.locator('#c').dispatch_event('pointerup',{'pointerId':3,'clientX':70,'clientY':495})
   assert await pg.evaluate('()=>rangeRun.sim.view().me.y')<y
   await pg.evaluate('()=>{rangeRun.sim.view().me.sp=1000;combatView(()=>{superGo(-Math.PI/2);shieldGo();dashGo(1,0);});}')
   assert await pg.evaluate('()=>!!rangeRun.sim.view().me.sup')
   assert await pg.evaluate('()=>!!rangeRun.sim.view().me.dash')
   assert await pg.evaluate('()=>rangeRun.sim.view().me.shieldT>0')
   await pg.screenshot(path=OUT+'/combat-320-high.png',full_page=True)
   await pg.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}")
   assert await pg.evaluate('()=>rangeRun.paused')
   await pg.evaluate('()=>{rangeRun.sim.view().me.shieldT=0;rangeRun.sim.view().me.shieldCd=0;}')
   await pg.keyboard.press('e')
   assert await pg.evaluate('()=>rangeRun.sim.view().me.shieldT')==0,'paused controls do not act'
   t=await pg.evaluate('()=>rangeRun.sim.view().elapsed');await pg.wait_for_timeout(150)
   assert await pg.evaluate('()=>rangeRun.sim.view().elapsed')==t
   await pg.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));}")
   await pg.locator('[data-act="rangeresume"]').click()
   # Gfx change itself is an existing preference write; use renderer-only test setting without store.
   await pg.evaluate("()=>{R3.off2d=true;apply3D();}")
   await pg.set_viewport_size({'width':430,'height':844});await pg.wait_for_timeout(100)
   await pg.screenshot(path=OUT+'/combat-430-2d.png',full_page=True)
   await pg.locator('[data-act="rangepause"]').click();await pg.locator('[data-act="rangestop"]').click()
   assert await pg.evaluate('()=>rangeSource.result.outcome')=='stopped'
   # Different conditions detected; bounded histories, other slot independent and clear local only.
   assert await pg.evaluate('()=>rangeCompare(rangeHistory("m_spare")[0],rangeHistory("m_spare").at(-1)).startsWith("Different")')
   assert await pg.evaluate('()=>{const r=rangeHistory("m_spare")[0];for(let i=0;i<25;i++)rangeWriteHistory("m_spare",r);return rangeHistory("m_spare").length;}')==20
   assert await pg.evaluate('()=>rangeHistory("m_legacy").length')==0
   assert await pg.evaluate('()=>JSON.stringify(ecoCopy())===__account')
   assert await pg.evaluate('()=>mTicket===__ranked.ticket&&PR===__ranked.proof&&lastResult===__ranked.last&&battleLoadout===__ranked.battle')
   assert await pg.evaluate('()=>__bad')==[]
   assert dev('/__dump')['eco']['tg_'+str(UID)]==before_server,'no account writes from range'
   # Pending ranked/payment fields survive repeated starts/exits; range never consumes them.
   await pg.evaluate("()=>{save.mq=[{tok:'pending-ranked-fixture',r:{quit:true}}];save.pendingTx={memo:'unchanged',since:Date.now(),amount:1};save.payQ=[{rec:{memo:'queued-existing'},t:Date.now()}];window.__pending=JSON.stringify([save.mq,save.pendingTx,save.payQ]);}")
   for i in range(3):
    await pg.locator('[data-act="rangerepeat"]').click();await pg.wait_for_function('!!rangeRun?.sim')
    await pg.locator('[data-act="rangepause"]').click();await pg.locator('[data-act="rangeexit"]').click()
    assert await pg.evaluate('()=>JSON.stringify([save.mq,save.pendingTx,save.payQ])===__pending')
    await pg.locator('[data-act="rangecard"][data-arg="m_spare"]').click();await start(pg)
    await pg.locator('[data-act="rangepause"]').click();await pg.locator('[data-act="rangestop"]').click()
   assert await pg.evaluate('()=>__bad')==[]
   assert await pg.evaluate('()=>document.querySelectorAll("iframe").length')==0
   # Invalid owned draft is refused even if called directly rather than disabled button.
   await pg.locator('[data-act="rangeclose"]').click()
   assert await pg.evaluate('()=>{openRange("m_spare",{spec:{...save.lab.machines.m_spare.spec,w:{a:"moon",t:2,s:false}}});return !findOv("rangesetup");}')
   await pg.evaluate('()=>{rangeSource=null;rangeWriteHistory("m_spare",null);}')
   assert await pg.evaluate('()=>rangeHistory("m_spare").length')==0
   assert not errs,errs
   # Reload only persists separately queued work/history/validated cache. Pagehide disposes no forfeit.
   await pg.evaluate('()=>{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}')
   await pg.reload();await pg.wait_for_timeout(1800)
   # Failed/rejected fixture remains queued via existing recovery and never appears as practice outcome.
   assert await pg.evaluate('()=>save.pendingTx?.memo')=='unchanged'
   assert await pg.evaluate('()=>rangeHistory("m_spare").length')==0
   assert not errs,errs
   await b.close()
   # Fresh no-WebGL page, offline cached ownership, actual fallback practice at 320px.
   b,fb,ferr=await open_game(p,320,740,eco='server',user={'id':UID+1,'first_name':'Fallback'},init="const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...args){return String(t).includes('webgl')?null:original.call(this,t,...args);};")
   await fb.wait_for_function('!!save.lab')
   await fb.evaluate('()=>{closeAll();setTab("garage");rangeOwnedLive=null;syncFails=1;}')
   await fb.locator('[data-act="rangecard"][data-arg="m_legacy"]').click()
   assert 'Offline experiment' in await fb.locator('#range-connection').inner_text()
   await fb.evaluate(GUARD)
   await start(fb,control='player');assert await fb.evaluate('()=>R3.failed')
   await fb.wait_for_timeout(300);await fb.screenshot(path=OUT+'/fallback-320.png',full_page=True)
   await fb.locator('[data-act="rangepause"]').click();await fb.locator('[data-act="rangeexit"]').click()
   assert await fb.evaluate('()=>__bad')==[]
   assert not ferr,ferr
   await b.close()
   print('PASS range browser: 7 completed actual seeded trials/all six modes, manual touch/actions, isolation, bounded summaries/drafts, pending preservation, 320/430px 3D/2D/no-WebGL/offline')
 finally:
  if server:server.terminate();server.wait()
asyncio.run(main())
