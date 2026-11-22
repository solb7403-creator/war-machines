"""Session 7 Living Front screens in the shipped client against the real Worker on a disposable local DB: the WAR REPORT on the
Conquest page, the WAR MAP (20 territories, the NEXT ORDER's button on screen without scrolling), a territory card (the odds line
first), the campaign and Grand Offensive cards, at 390x844, 390x700, 320x568 (touch, a real swipe reaches the last button) and
1366x768, 1920x1080 (mouse and keyboard: a territory opens with Enter). Every screen fits or scrolls. Pictures: docs/conquest/session7."""
import asyncio,json,pathlib,shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'docs/conquest/session7';OUT.mkdir(parents=True,exist_ok=True)
async def close_ctx(ctx):
 for pg in ctx.pages:
  try:await pg.unroute_all(behavior='ignoreErrors')
  except Exception:pass
 await ctx.close()
async def swipe_to_end(page,sel):   # a real finger (as conquest-plot-ui.py): touchstart, 12 small moves 16 ms apart, touchend, through the app's touch guard
 box=await page.locator(sel).bounding_box();cdp=await page.context.new_cdp_session(page);vw=page.viewport_size;sx=min(max(box['x']+box['width']/2,20),vw['width']-20);sy=min(box['y']+box['height']*0.7,vw['height']*0.8)
 for _ in range(10):
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy}]})
  for k in range(1,13):
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx,'y':sy-k*18}]});await page.wait_for_timeout(16)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await page.wait_for_timeout(300)
async def main():
 server=await asyncio.create_subprocess_exec('node','dev/tests/conquest-server.mjs',cwd=ROOT,stdout=asyncio.subprocess.PIPE)
 ready=json.loads(await server.stdout.readline());base='http://127.0.0.1:'+str(ready['port']);results={}
 try:
  async with async_playwright() as pw:
   opts={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}
   exe=shutil.which('chromium') or ('/opt/pw-browsers/chromium' if pathlib.Path('/opt/pw-browsers/chromium').exists() else None)
   if exe:opts['executable_path']=exe
   browser=await pw.chromium.launch(**opts)
   for w,h,mobile in [(390,844,True),(390,700,True),(320,568,True),(1366,768,False),(1920,1080,False)]:
    ctx=await browser.new_context(viewport={'width':w,'height':h},has_touch=mobile,is_mobile=mobile);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    await page.add_init_script('''window.LUNAR_NO_CS=1;window.LUNAR_NO_PVP=1;window.LUNAR_NO_AUTOGFX=1;window.LUNAR_HUB_STATIC=1;window.Telegram={WebApp:{initData:'''+json.dumps(ready['initData'])+''',initDataUnsafe:{user:{id:8301,first_name:'BrowserPilot'}},isVersionAtLeast:()=>false,ready(){},expand(){},onEvent(){},offEvent(){},setHeaderColor(){},setBackgroundColor(){},BackButton:{show(){},hide(){},onClick(){},offClick(){}},HapticFeedback:{impactOccurred(){},notificationOccurred(){}}}};''')
    async def route(r):
     u=urlparse(r.request.url);f=ROOT/u.path.lstrip('/')
     if u.path.startswith('/api/conquest/') or u.path in ('/api/sync','/api/act'):
      body=json.loads(r.request.post_data or '{}')
      for attempt in range(2):
       try:resp=await page.request.post(base+u.path,data=body);return await r.fulfill(status=resp.status,body=await resp.body(),content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
       except Exception:
        if attempt:return await r.fulfill(status=503,body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
        await asyncio.sleep(0.2)
     if u.path.startswith('/api/'):return await r.fulfill(body='{}',content_type='application/json',headers={'Access-Control-Allow-Origin':'*'})
     if u.netloc=='lunar.test' and f.is_file():return await r.fulfill(path=str(f))
     if u.netloc=='telegram.org':return await r.fulfill(body='',content_type='application/javascript')
     await r.abort()
    await page.route('**/*',route)
    await page.request.post(base+'/fixture',data={'position':[1080,1160],'baseFunds':True,'base':{'tier':2},'war':True})
    await page.goto('https://lunar.test/index.html');await page.wait_for_function('typeof Conquest!=="undefined"&&typeof ConquestWarMap!=="undefined"')
    await page.request.post(base+'/fixture',data={'position':[1080,1160],'baseFunds':True,'base':{'tier':2},'war':True})
    await page.evaluate('closeAll();save.welcomed=true;uiDirty();');await page.evaluate('document.querySelector(\'[data-act="conquest"]\').click()')
    r={}
    # the War Report on arrival
    await page.wait_for_selector('.cq-dialog.cq-warreport',timeout=60000);rep=await page.locator('.cq-warreport').inner_text()
    assert 'WHILE YOU WERE AWAY' in rep and 'WESTERN SALVAGE REACH' in rep and 'fell to the Parasites' in rep and 'INBOUND' in rep and 'YOUR ORDER' in rep,rep[:500]
    await page.screenshot(path=str(OUT/f'war-report-{w}x{h}.png'));r['report']=rep[:160]
    await page.locator('.cq-warreport button',has_text='OPEN THE WAR MAP').click()
    # the War Map: 20 territories, the NEXT ORDER's button on screen without scrolling
    await page.wait_for_selector('.cq-warmap .wm-svg',timeout=30000);n=await page.locator('.cq-warmap .wm-t').count();assert n==20,n
    btn=page.locator('.cq-warmap .wm-next-card .wm-go-btn');bb=await btn.bounding_box();assert bb and bb['y']>=0 and bb['y']+bb['height']<=h,('NEXT ORDER button off screen',bb)
    nxt=await page.locator('.wm-next-card').inner_text();assert 'OXYGEN SPEAR' in nxt and 'DEFENSE' in nxt and 'THREAT' in nxt and '%' in nxt,nxt
    chips=await page.locator('.wm-chips').inner_text();assert 'MOON 15 / 20' in chips and 'FRONTLINE' in chips,chips
    await page.screenshot(path=str(OUT/f'war-map-{w}x{h}.png'));r['next']=nxt[:160]
    # a territory card: tap (touch) or Enter (keyboard)
    node=page.locator('.cq-warmap .wm-t[data-t="oxygen"]')
    if mobile:
     await page.evaluate('document.querySelector(\'.cq-warmap .wm-t[data-t="oxygen"]\').scrollIntoView({block:"center"})');await page.wait_for_timeout(150)
     nb=await node.bounding_box();await page.touchscreen.tap(nb['x']+nb['width']/2,nb['y']+nb['height']/2)   # a real touch at the node (its pulse ring animates, so no 'stable' wait)
    else:
     await node.focus();await page.keyboard.press('Enter')
    await page.wait_for_selector('.cq-warmap .wm-terr',timeout=10000);card=await page.locator('.wm-terr').inner_text()
    assert 'OXYGEN SPEAR' in card and 'DEFENSE' in card and 'THREAT' in card and 'FORTIFY' in card,card
    await page.screenshot(path=str(OUT/f'war-territory-{w}x{h}.png'));r['card']=card[:160]
    await page.locator('.wm-terr .wm-back').click();await page.wait_for_selector('.wm-campaign')
    camp=await page.locator('.wm-campaign').inner_text();assert 'CITADEL I' in camp and 'FRONT' in camp and 'FORCE' in camp and 'DEFENSE' in camp,camp
    goc=await page.locator('.wm-go-card').inner_text();assert 'GRAND OFFENSIVE' in goc,goc
    # every screen fits or scrolls: the last button is reachable
    if mobile:await swipe_to_end(page,'.cq-dialog.cq-warmap .wm-side')
    else:
     await page.mouse.move(w/2,h/2)
     for _ in range(12):await page.mouse.wheel(0,600);await page.wait_for_timeout(40)
    dbg=await page.evaluate('(()=>{const d=document.querySelector(".cq-dialog.cq-warmap"),p=d.parentElement;return {st:d.scrollTop,sh:d.scrollHeight,ch:d.clientHeight,pst:p.scrollTop,top:d.getBoundingClientRect().top}})()')
    alerts=page.locator('.cq-warmap .wm-alerts');ab=await alerts.bounding_box();assert dbg['st']+dbg['ch']>=dbg['sh']-4 and ab and ab['y']+ab['height']<=h+1,('the last card was not reached',dbg,ab)
    await page.screenshot(path=str(OUT/f'war-cards-{w}x{h}.png'))
    assert not errors,errors
    results[f'{w}x{h}']=r;print(json.dumps({f'{w}x{h}':r}),flush=True)
    await close_ctx(ctx)
   await browser.close()
  json.dump(results,open(OUT/'war-screens.json','w'),indent=1)
  print('PASS Living Front screens: War Report, War Map (20 territories, the next order on screen), territory, campaign and Grand Offensive cards at 390x844, 390x700, 320x568 (touch) and 1366x768, 1920x1080 (mouse, keyboard); every screen reaches its last button')
 finally:server.kill()
asyncio.run(main())
